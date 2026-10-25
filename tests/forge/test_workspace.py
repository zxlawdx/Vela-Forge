import pytest

from apps.forge.services.editor_state import EditorState
from apps.forge.services.workspace import DEFAULT_WORKSPACE


def test_workspace_survives_restart_and_reset(tmp_path):
    path = tmp_path / "editor.sqlite3"
    state = EditorState(path)
    workspace = {**DEFAULT_WORKSPACE, "inspectorSide": "left", "bottomPosition": "top", "leftWidth": 270, "activeBottomTab": "console", "bottomCollapsed": True}
    state.update_preferences({"workspace": workspace})

    assert EditorState(path).preferences()["workspace"] == workspace
    state.reset()
    assert state.preferences()["workspace"] == DEFAULT_WORKSPACE


@pytest.mark.parametrize("changes", [
    {"leftWidth": -1}, {"bottomHeight": float("nan")}, {"inspectorSide": "unknown"},
    {"mode": []}, {"bottomCollapsed": 1}, {"activeBottomTab": "<script>"},
])
def test_invalid_workspace_does_not_replace_preferences(tmp_path, changes):
    state = EditorState(tmp_path / "editor.sqlite3")

    with pytest.raises(ValueError):
        state.update_preferences({"workspace": changes})

    assert state.preferences()["workspace"] == DEFAULT_WORKSPACE
