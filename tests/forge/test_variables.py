from copy import deepcopy

import pytest

from apps.forge.services.forge_service import ForgeService


def test_typed_variables_round_trip_references_and_history():
    service = ForgeService()
    service.create_variable("score", "number", 0)
    node = service.create_node("set-variable", {"variable": "score", "value": 10})
    before = service.get_project()
    loaded = ForgeService()
    loaded.open_project(before)
    assert loaded.get_project() == before
    loaded.delete_variable("score")
    assert any(problem["code"] == "missing_variable" for problem in loaded.validate())
    loaded.undo()
    assert loaded.get_project() == before
    loaded.redo()
    assert loaded.variables == {}
    assert loaded.graph.get_node(node.id).properties["variable"] == "score"


@pytest.mark.parametrize("kind,value", [("number", True), ("boolean", "false"), ("string", 1), ("unknown", 0)])
def test_invalid_declaration_is_atomic(kind, value):
    service = ForgeService()

    with pytest.raises(ValueError):
        service.create_variable("value", kind, value)

    assert service.variables == {}
    assert service.history.status()["can_undo"] is False


def test_type_mismatch_blocks_export_and_duplicate_load_preserves_state():
    service = ForgeService()
    service.create_variable("has_key", "boolean", False)
    service.create_node("set-variable", {"variable": "has_key", "value": 3})
    assert any(problem["code"] == "variable_type" for problem in service.validate())
    before = service.get_project()
    bad = deepcopy(before)
    bad["variables"].append(bad["variables"][0])

    with pytest.raises(ValueError, match="duplicado"):
        service.open_project(bad)

    assert service.get_project() == before


def test_legacy_projects_infer_missing_declarations_once():
    service = ForgeService()
    service.create_node("set-variable", {"variable": "score", "value": 3})
    service.create_node("branch", {"condition": "score"})
    old = service.get_project()
    del old["variables"]
    service.open_project(old)
    assert service.variables["score"].type == "number"
    assert service.variables["score"].default == 0
