import pytest

from apps.forge.domain.conditions import normalize_condition
from apps.forge.services.forge_service import ForgeService


def test_legacy_truthy_is_normalized_and_round_trips():
    service = ForgeService()
    node = service.create_node("branch", {"condition": "has_key"})
    expected = {"variable": "has_key", "operator": "truthy", "value": None}
    assert node.properties["condition"] == expected
    loaded = ForgeService()
    loaded.open_project(service.get_project())
    assert loaded.get_project() == service.get_project()


@pytest.mark.parametrize("condition", [
    {"variable": "x", "operator": "eval", "value": 1},
    {"variable": "x", "operator": "equals"},
    {"variable": "x", "operator": "greater_than", "value": True},
    {"variable": "x", "operator": "less_than", "value": "2"},
    {"variable": "x", "operator": "equals", "value": []},
])
def test_invalid_condition_is_rejected_without_history_change(condition):
    service = ForgeService()
    node = service.create_node("branch")
    before = service.get_project()
    history = len(service.history.undo_commands)

    with pytest.raises(ValueError):
        service.update_node(node.id, {"properties": {"condition": condition}})

    assert service.get_project() == before
    assert len(service.history.undo_commands) == history


def test_condition_edit_undo_redo():
    service = ForgeService()
    node = service.create_node("branch", {"condition": "score"})
    condition = {"variable": "score", "operator": "greater_than", "value": 10}
    service.update_node(node.id, {"properties": {"condition": condition}})
    service.undo()
    assert service.graph.get_node(node.id).properties["condition"]["operator"] == "truthy"
    service.redo()
    assert service.graph.get_node(node.id).properties["condition"] == condition
