from copy import deepcopy

from .connections import Connection
from .graph import Graph
from .nodes import Node
from .registry import default_properties, validate_properties


FORMAT_VERSION = 1


def serialize_project(graph: Graph, metadata: dict) -> dict:
    data = graph.to_dict()

    for node in data["nodes"]:
        del node["ports"]

    project = {
        "format_version": FORMAT_VERSION,
        "metadata": deepcopy(metadata),
        "graph": data,
    }

    return deepcopy(project)


def parse_project(project: dict) -> tuple[Graph, dict]:
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

    return graph, deepcopy(metadata)
