import json
from io import BytesIO
from wsgiref.util import setup_testing_defaults

import pytest

from vela.api import api
from vela.core.api_server import ApiServer

import apps.forge.api
from apps.forge.domain.graph import Graph
from apps.forge.services.forge_service import forge_service


@pytest.fixture
def client():
    forge_service.graph = Graph()
    server = ApiServer(api.new_router(), docs_enabled=False)
    server.register_routes()

    def request(method, path, data=None):
        body = json.dumps(data).encode() if data is not None else b""
        environ = {}
        setup_testing_defaults(environ)
        environ.update({
            "REQUEST_METHOD": method,
            "PATH_INFO": "/api/forge" + path,
            "CONTENT_TYPE": "application/json",
            "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": BytesIO(body),
        })
        status = []
        response = server.app(environ, lambda value, headers, exc_info=None: status.append(value))
        payload = b"".join(response)

        return int(status[0].split()[0]), json.loads(payload)

    yield request
    forge_service.graph = Graph()


def test_connection_position_and_property_lifecycle(client):
    status, source = client("POST", "/nodes", {"type": "start"})
    assert status == 200
    status, target = client("POST", "/nodes", {"type": "dialogue"})
    assert status == 200

    status, connection = client("POST", "/connections", {
        "source_node_id": source["id"],
        "source_port": "out",
        "target_node_id": target["id"],
        "target_port": "in",
    })
    assert status == 200

    status, node = client("PATCH", "/nodes/" + target["id"], {
        "position": {"x": 42, "y": 96},
        "properties": {"text": "Hello"},
    })
    assert status == 200
    assert node["position"] == {"x": 42, "y": 96}
    assert node["properties"]["text"] == "Hello"

    status, graph = client("GET", "/graph")
    assert status == 200
    assert graph["connections"] == [connection]
    assert graph["nodes"][1] == node

    status, result = client("DELETE", "/nodes/" + target["id"])
    assert status == 200
    assert result == {"deleted": target["id"]}
    assert client("GET", "/graph")[1]["connections"] == []


def test_api_rejects_self_connection(client):
    _, node = client("POST", "/nodes", {"type": "dialogue"})

    status, result = client("POST", "/connections", {
        "source_node_id": node["id"],
        "source_port": "out",
        "target_node_id": node["id"],
        "target_port": "in",
    })

    assert status == 400
    assert client("GET", "/graph")[1]["connections"] == []


def test_registry_drives_serialized_ports(client):
    status, types = client("GET", "/node-types")
    assert status == 200
    assert types["start"]["inputs"] == []

    status, node = client("POST", "/nodes", {"type": "branch"})
    assert status == 200
    assert [port["name"] for port in node["ports"]["outputs"]] == ["true", "false"]
    assert client("GET", "/graph")[1]["nodes"][0]["ports"] == node["ports"]
