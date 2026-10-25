import pytest

from apps.forge.services.forge_service import ForgeService


def test_command_sequence_round_trip():
    service = ForgeService()
    initial = service.get_project()
    start = service.create_node("start")
    dialogue = service.create_node("dialogue")
    service.update_node_position(dialogue.id, {"x": 900, "y": -42})
    service.update_node(dialogue.id, {"properties": {"text": "Edited"}})
    connection = service.create_connection(start.id, "out", dialogue.id, "in")
    connected = service.get_project()
    service.delete_node(dialogue.id)
    service.undo()

    assert service.get_project() == connected
    assert connection.id in service.graph.connections

    service.redo()
    assert dialogue.id not in service.graph.nodes
    service.undo()

    for _ in range(5):
        service.undo()

    assert service.get_project() == initial

    for _ in range(5):
        service.redo()

    assert service.get_project() == connected


def test_new_branch_clears_redo_and_open_clears_history():
    service = ForgeService()
    service.create_node("start")
    service.undo()
    service.create_node("dialogue")
    assert not service.history.status()["can_redo"]

    project = service.get_project()
    service.open_project(project)
    assert not service.history.status()["can_undo"]

    with pytest.raises(ValueError):
        service.undo()

    assert service.get_project() == project


def test_invalid_commands_and_no_op_do_not_enter_history():
    service = ForgeService()
    node = service.create_node("dialogue")
    count = len(service.history.undo_commands)
    service.update_node_position(node.id, node.position)

    with pytest.raises(ValueError):
        service.update_node_position(node.id, {"x": 1, "y": "wrong"})

    assert len(service.history.undo_commands) == count
    service.history.limit = 2
    service.create_node("end")
    service.create_node("start")
    assert len(service.history.undo_commands) == 2
