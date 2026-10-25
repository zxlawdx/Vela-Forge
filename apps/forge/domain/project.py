from copy import deepcopy

from .assets import Asset, validate_asset
from .connections import Connection
from .events import Event
from .graph import Graph
from .nodes import Node
from .registry import default_properties, validate_properties


FORMAT_VERSION = 1


def serialize_project(graph: Graph, metadata: dict, events: dict, assets: dict) -> dict:
    data = graph.to_dict()

    for node in data["nodes"]:
        del node["ports"]

    project = {
        "format_version": FORMAT_VERSION,
        "metadata": deepcopy(metadata),
        "graph": data,
        "assets": [
            {"id": asset.id, "name": asset.name, "mime_type": asset.mime_type, "data": asset.data}
            for asset in assets.values()
        ],
        "events": [
            {"id": event.id, "name": event.name}
            for event in events.values()
        ],
    }

    return deepcopy(project)


def parse_project(project: dict) -> tuple[Graph, dict, dict, dict]:
    if not isinstance(project, dict):
        raise ValueError("Projeto .vforge deve ser um objeto JSON")

    if type(project.get("format_version")) is not int or project["format_version"] != 1:
        raise ValueError("Versão .vforge não suportada; esperada format_version 1")

    metadata = project.get("metadata")

    if not isinstance(metadata, dict):
        raise ValueError("Metadata do projeto inválida")

    name = metadata.get("name")

    if not isinstance(name, str) or not name.strip() or len(name) > 128:
        raise ValueError("Nome do projeto deve ter entre 1 e 128 caracteres")

    data = project.get("graph")

    if (
        not isinstance(data, dict)
        or not isinstance(data.get("nodes"), list)
        or not isinstance(data.get("connections"), list)
    ):
        raise ValueError("Graph deve conter listas nodes e connections")

    graph = Graph()

    try:
        for record in data["nodes"]:
            node_id = record["id"]

            if not isinstance(node_id, str) or not node_id:
                raise ValueError("ID de node inválido")

            properties = default_properties(record["type"])
            properties.update(record["properties"])
            validate_properties(record["type"], properties)
            node = Node(node_id, record["type"], deepcopy(properties))
            graph.add_node(node)
            graph.update_position(node.id, record["position"])

        for record in data["connections"]:
            connection_id = record["id"]

            if not isinstance(connection_id, str) or not connection_id:
                raise ValueError("ID de connection inválido")

            connection = Connection(
                id=connection_id,
                source_node_id=record["source_node_id"],
                source_port=record["source_port"],
                target_node_id=record["target_node_id"],
                target_port=record["target_port"],
            )
            graph.connect(connection)
    except (KeyError, TypeError, AttributeError) as error:
        raise ValueError("Node ou connection com campos inválidos no .vforge") from error

    events = {}
    records = project.get("events", [])

    if not isinstance(records, list):
        raise ValueError("Events deve ser uma lista")

    for record in records:
        if not isinstance(record, dict):
            raise ValueError("Evento inválido")

        event_id = record.get("id")
        name = record.get("name")

        if not isinstance(event_id, str) or not event_id or event_id in events:
            raise ValueError("ID de evento inválido ou duplicado")

        if not isinstance(name, str) or not name.strip() or len(name) > 128:
            raise ValueError("Nome de evento inválido")

        if any(event.name == name for event in events.values()):
            raise ValueError("Nome de evento duplicado")

        events[event_id] = Event(event_id, name)

    assets = {}
    records = project.get("assets", [])
    total_size = 0

    if not isinstance(records, list):
        raise ValueError("Assets deve ser uma lista")

    for record in records:
        if not isinstance(record, dict):
            raise ValueError("Asset inválido")

        asset_id = record.get("id")

        if not isinstance(asset_id, str) or not asset_id or asset_id in assets:
            raise ValueError("ID de asset inválido ou duplicado")

        asset = Asset(asset_id, record.get("name"), record.get("mime_type"), record.get("data"))
        total_size += validate_asset(asset)
        assets[asset.id] = asset

    if total_size > 8 * 1024 * 1024:
        raise ValueError("Assets do projeto excedem o limite total de 8 MiB")

    return graph, deepcopy(metadata), events, assets
