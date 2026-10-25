import pytest

from apps.forge.services.forge_service import ForgeService


@pytest.fixture
def flow():
    service = ForgeService()
    nodes = [service.create_node("dialogue") for _ in range(3)]
    connection = service.create_connection(nodes[0].id, "out", nodes[1].id, "in")

    return service, nodes, connection


def test_reconnect_both_endpoints_preserves_identity_and_history(flow):
    service, nodes, connection = flow
    original = service.get_project()
    result = service.reconnect_connection(connection.id, {"target_node_id": nodes[2].id})

    assert result is connection
    assert len(service.graph.connections) == 1
    assert result.target_node_id == nodes[2].id
    service.reconnect_connection(connection.id, {"source_node_id": nodes[1].id})
    changed = service.get_project()
    service.undo()
    service.undo()
    assert service.get_project() == original
    service.redo()
    service.redo()
    assert service.get_project() == changed


@pytest.mark.parametrize("changes", [
    {}, None, {"id": "replace"}, {"target_node_id": "missing"},
    {"target_port": "out"}, {"source_port": "in"}, {"source_port": "missing"},
    {"source_node_id": []},
])
def test_invalid_reconnect_is_atomic(flow, changes):
    service, nodes, connection = flow
    before = service.get_project()
    history = len(service.history.undo_commands)

    with pytest.raises(ValueError):
        service.reconnect_connection(connection.id, changes)

    assert service.get_project() == before
    assert len(service.history.undo_commands) == history


def test_self_connection_and_unknown_id_are_rejected(flow):
    service, nodes, connection = flow

    with pytest.raises(ValueError):
        service.reconnect_connection(connection.id, {"target_node_id": nodes[0].id})

    with pytest.raises(ValueError):
        service.reconnect_connection("missing", {"target_node_id": nodes[2].id})

    assert connection.target_node_id == nodes[1].id
