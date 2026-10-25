import pytest

from apps.forge.services.editor_state import EditorState
from apps.forge.services.forge_service import ForgeService


def test_preferences_recents_restart_and_reset(tmp_path):
    database = tmp_path / "editor.sqlite3"
    state = EditorState(database)
    state.update_preferences({"target": "unity", "show_grid": False})
    service = ForgeService(editor_state=state)
    service.create_node("start")
    path = tmp_path / "project.vforge"
    service.save_project_file(str(path))
    content = path.read_bytes()

    restarted = EditorState(database)
    assert restarted.preferences()["target"] == "unity"
    assert restarted.preferences()["show_grid"] is False
    assert restarted.recents()[0]["path"] == str(path)
    assert restarted.preferences()["last_project"] == str(path)

    restarted.reset()
    assert restarted.recents() == []
    assert restarted.preferences() == {"target": "godot", "show_grid": True}
    assert path.read_bytes() == content
    assert len(service.graph.nodes) == 1


def test_missing_recent_keeps_current_graph(tmp_path):
    state = EditorState(tmp_path / "state.sqlite3")
    service = ForgeService(editor_state=state)
    service.create_node("dialogue")
    before = service.get_project()
    missing = str(tmp_path / "gone.vforge")
    state.remember(missing, "Gone")

    assert state.recents()[0]["name"] == "Gone"

    with pytest.raises(ValueError, match="indisponível"):
        service.open_recent(missing)

    assert service.get_project() == before


def test_recents_are_bounded_and_preferences_are_validated(tmp_path):
    state = EditorState(tmp_path / "state.sqlite3")

    for index in range(25):
        state.remember(str(tmp_path / f"{index}.vforge"), str(index))

    assert len(state.recents()) == 20
    assert state.recents()[0]["name"] == "24"

    with pytest.raises(ValueError):
        state.update_preferences({"target": "unknown"})

    assert state.preferences()["target"] == "godot"
