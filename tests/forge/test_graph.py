import pytest

from apps.forge.domain.connections import Connection
from apps.forge.domain.nodes import Node
from apps.forge.domain.graph import Graph


def test_add_node():
    graph = Graph()
    node = Node(id="start_1", type="start")

    graph.add_node(node)

    assert graph.get_node("start_1") is node


def test_cannot_add_duplicate_node_id():
    graph = Graph()

    graph.add_node(
        Node(id="start_1", type="start")
    )

    with pytest.raises(ValueError):
        graph.add_node(
            Node(id="start_1", type="dialogue")
        )

def test_connect_nodes():
    graph = Graph()

    start = Node(id="start_1", type="start")
    dialogue = Node(id="dialogue_1", type="dialogue")

    graph.add_node(start)
    graph.add_node(dialogue)

    connection = Connection(
        id="connection_1",
        source_node_id="start_1",
        source_port="out",
        target_node_id="dialogue_1",
        target_port="in",
    )

    graph.connect(connection)

    assert graph.connections[connection.id] is connection
    assert graph.to_dict()["connections"] == [{
        "id": "connection_1",
        "source_node_id": "start_1",
        "source_port": "out",
        "target_node_id": "dialogue_1",
        "target_port": "in",
    }]


def test_connection_requires_existing_nodes():
    graph = Graph()

    graph.add_node(
        Node(id="start_1", type="start")
    )

    connection = Connection(
        id="connection_1",
        source_node_id="start_1",
        source_port="out",
        target_node_id="dialogue_1",
        target_port="in",
    )

    with pytest.raises(ValueError):
        graph.connect(connection)

def test_adjacency():
    graph = Graph()

    graph.add_node(Node("start_1", "start"))
    graph.add_node(Node("dialogue_1", "dialogue"))
    graph.add_node(Node("end_1", "end"))

    graph.connect(
        Connection(
            id="connection_1",
            source_node_id="start_1",
            source_port="out",
            target_node_id="dialogue_1",
            target_port="in",
        )
    )

    graph.connect(
        Connection(
            id="connection_2",
            source_node_id="dialogue_1",
            source_port="out",
            target_node_id="end_1",
            target_port="in",
        )
    )

    assert graph.adjacency() == {
        "start_1": ["dialogue_1"],
        "dialogue_1": ["end_1"],
        "end_1": [],
    }

def to_dict(self) -> dict:
    return {
        "nodes": [
            {
                "id": node.id,
                "type": node.type,
                "properties": node.properties,
            }
            for node in self.nodes.values()
        ],
        "connections": [
            {
                "id": connection.id,
                "source_node_id": connection.source_node_id,
                "source_port": connection.source_port,
                "target_node_id": connection.target_node_id,
                "target_port": connection.target_port,
            }
            for connection in self.connections.values()
        ],
    }

@pytest.mark.parametrize(
    "source,source_port,target,target_port",
    [
        ("missing", "out", "target", "in"),
        ("source", "out", "missing", "in"),
        ("source", "out", "source", "in"),
        ("source", "in", "target", "in"),
        ("source", "out", "target", "out"),
    ],
)
def test_invalid_connection_does_not_change_graph(
    source,
    source_port,
    target,
    target_port,
):
    graph = Graph()
    graph.add_node(Node("source", "dialogue"))
    graph.add_node(Node("target", "dialogue"))

    connection = Connection(
        "connection_1",
        source,
        source_port,
        target,
        target_port,
    )

    with pytest.raises(ValueError):
        graph.connect(connection)

    assert graph.connections == {}
