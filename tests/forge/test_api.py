import json
from io import BytesIO
from wsgiref.util import setup_testing_defaults

import pytest

from vela.api import api
from vela.core.api_server import ApiServer

import apps.forge.api
from apps.forge.domain.graph import Graph
from apps.forge.services.editor_state import EditorState
from apps.forge.services.forge_service import forge_service


@pytest.fixture
def client(tmp_path):
    forge_service.editor_state = EditorState(tmp_path / "editor.sqlite3")
    forge_service.new_project()
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
    forge_service.new_project()


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


def test_delete_connection_endpoint(client):
    _, source = client("POST", "/nodes", {"type": "start"})
    _, target = client("POST", "/nodes", {"type": "end"})
    _, connection = client("POST", "/connections", {
        "source_node_id": source["id"], "source_port": "out",
        "target_node_id": target["id"], "target_port": "in",
    })

    assert client("DELETE", "/connections/" + connection["id"])[0] == 200
    assert client("GET", "/graph")[1]["connections"] == []
    assert client("DELETE", "/connections/" + connection["id"])[0] == 400


def test_project_http_round_trip(client):
    client("POST", "/nodes", {"type": "start"})
    status, project = client("GET", "/project")
    assert status == 200

    assert client("POST", "/project/new")[0] == 200
    assert client("GET", "/graph")[1]["nodes"] == []
    assert client("PUT", "/project", project)[0] == 200
    assert client("GET", "/project")[1] == project
    assert client("PUT", "/project", {"format_version": 99})[0] == 400
    assert client("GET", "/project")[1] == project


def test_events_history_export_and_preferences_over_http(client):
    status, event = client("POST", "/events", {"name": "ready"})
    assert status == 200
    _, start = client("POST", "/nodes", {"type": "start"})
    _, emit = client("POST", "/nodes", {"type": "event", "properties": {"event": event["id"]}})
    _, end = client("POST", "/nodes", {"type": "end"})

    for source, target in [(start, emit), (emit, end)]:
        assert client("POST", "/connections", {
            "source_node_id": source["id"], "source_port": "out",
            "target_node_id": target["id"], "target_port": "in",
        })[0] == 200

    assert client("GET", "/problems")[1] == []
    assert client("GET", "/events")[1][0]["usages"] == [emit["id"]]
    assert client("GET", "/history")[1]["can_undo"] is True
    assert client("POST", "/history/undo")[0] == 200
    assert len(client("GET", "/graph")[1]["connections"]) == 1
    assert client("POST", "/history/redo")[0] == 200

    before = client("GET", "/project")[1]

    for engine in ["godot", "unity"]:
        status, result = client("POST", "/export/" + engine)
        assert status == 200
        assert result["engine"] == engine
        assert result["files"]

    assert client("GET", "/project")[1] == before
    assert client("PATCH", "/preferences", {"target": "unity"})[0] == 200
    assert client("GET", "/preferences")[1]["target"] == "unity"
    assert client("DELETE", "/editor-state")[0] == 200
    assert client("GET", "/preferences")[1]["target"] == "godot"
    assert client("GET", "/project")[1] == before


def test_asset_http_round_trip(client):
    image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII="
    status, asset = client("POST", "/assets", {
        "name": "pixel.png", "mime_type": "image/png", "data": image,
    })
    assert status == 200
    assert client("GET", "/assets")[1] == [asset]
    project = client("GET", "/project")[1]
    client("POST", "/project/new")
    assert client("PUT", "/project", project)[0] == 200
    assert client("GET", "/assets")[1] == [asset]


def test_reconnection_http_preserves_id(client):
    nodes = [client("POST", "/nodes", {"type": "dialogue"})[1] for _ in range(3)]
    _, connection = client("POST", "/connections", {
        "source_node_id": nodes[0]["id"], "source_port": "out",
        "target_node_id": nodes[1]["id"], "target_port": "in",
    })
    path = "/connections/" + connection["id"]
    status, updated = client("PATCH", path, {"target_node_id": nodes[2]["id"]})
    assert status == 200
    assert updated["id"] == connection["id"]
    assert client("GET", "/graph")[1]["connections"] == [updated]
    assert client("PATCH", path, {"target_port": "out"})[0] == 400
    assert client("GET", "/graph")[1]["connections"] == [updated]


def test_variable_http_history_and_validation(client):
    status, variable = client("POST", "/variables", {"name": "score", "type": "number", "default": 0})
    assert status == 200
    assert client("GET", "/variables")[1] == [variable]
    _, node = client("POST", "/nodes", {"type": "branch", "properties": {"condition": {
        "variable": "score", "operator": "greater_than", "value": 10,
    }}})
    assert not any(p["code"] == "missing_variable" for p in client("GET", "/problems")[1])
    assert client("DELETE", "/variables/score")[0] == 200
    assert any(p["code"] == "missing_variable" for p in client("GET", "/problems")[1])
    assert client("POST", "/history/undo")[0] == 200
    assert client("GET", "/variables")[1] == [variable]


def test_event_rename_http(client):
    _, event = client("POST", "/events", {"name": "before"})
    status, renamed = client("PATCH", "/events/" + event["id"], {"name": "after"})
    assert status == 200
    assert renamed == {"id": event["id"], "name": "after"}
    assert client("PATCH", "/events/" + event["id"], {"name": ""})[0] == 400
