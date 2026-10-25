import json
from pathlib import Path
from types import SimpleNamespace

import pytest
import webview

from apps.forge.services import forge_service as service_module
from apps.forge.services.editor_state import EditorState
from apps.forge.services.forge_service import ForgeService
from config.bridge import StarterBridge


@pytest.fixture
def native(tmp_path, monkeypatch):
    service = ForgeService(EditorState(tmp_path / "editor.sqlite3"))
    monkeypatch.setattr(service_module, "forge_service", service)
    replies = []
    calls = []

    def dialog(kind, **options):
        calls.append((kind, options))
        return replies.pop(0)

    monkeypatch.setattr(webview, "windows", [SimpleNamespace(create_file_dialog=dialog)])

    return StarterBridge(), service, replies, calls


def test_save_save_as_unicode_overwrite_and_cancel(native, tmp_path):
    bridge, service, replies, calls = native
    node = service.create_node("dialogue")
    folder = tmp_path / "Projeto com espaços 日本語"
    folder.mkdir()
    path = folder / "diálogo"
    replies.append(str(path))

    assert bridge.save_forge_project() == {"ok": True}
    saved = path.with_suffix(".vforge")
    assert service.project_path == str(saved)
    assert json.loads(saved.read_text(encoding="utf-8"))["graph"]["nodes"][0]["id"] == node.id
    service.update_node(node.id, {"properties": {"text": "Alterado"}})

    assert bridge.save_forge_project() == {"ok": True}
    assert len(calls) == 1
    assert "Alterado" in saved.read_text(encoding="utf-8")
    before = service.get_project()
    history = service.history.status().copy()
    replies.append(None)

    assert bridge.save_forge_project(save_as=True) == {"cancelled": True}
    assert service.project_path == str(saved)
    assert service.get_project() == before
    assert service.history.status() == history
    copy = folder / "cópia.vforge"
    replies.append((str(copy),))
    assert bridge.save_forge_project(save_as=True) == {"ok": True}
    assert copy.read_bytes() == saved.read_bytes()
    assert service.project_path == str(copy)


def test_open_missing_invalid_and_cancel_preserve_state(native, tmp_path):
    bridge, service, replies, calls = native
    service.create_node("start")
    path = tmp_path / "original.vforge"
    service.save_project_file(str(path))
    before = service.get_project()

    for selection in [None, (str(tmp_path / "missing.vforge"),)]:
        replies.append(selection)
        result = bridge.open_forge_project()
        assert result.get("cancelled") or result.get("error")
        assert service.get_project() == before
        assert service.project_path == str(path)

    bad = tmp_path / "bad.vforge"
    bad.write_text("{bad", encoding="utf-8")
    replies.append(str(bad))
    assert "error" in bridge.open_forge_project()
    assert service.get_project() == before

    service.new_project()
    assert service.project_path is None
    replies.append((str(path),))
    assert bridge.open_forge_project() == {"ok": True}
    assert service.get_project() == before
    assert service.project_path == str(path)


def test_permission_error_preserves_existing_file(native, tmp_path, monkeypatch):
    bridge, service, replies, calls = native
    path = tmp_path / "project.vforge"
    service.create_node("start")
    service.save_project_file(str(path))
    original = path.read_bytes()
    service.create_node("end")

    def deny_replace(source, target):
        raise PermissionError("Diretório sem permissão")

    monkeypatch.setattr(service_module.os, "replace", deny_replace)
    assert "sem permissão" in bridge.save_forge_project()["error"]
    assert path.read_bytes() == original
    assert set(tmp_path.iterdir()) == {path, tmp_path / "editor.sqlite3"}


@pytest.mark.parametrize("engine", ["godot", "unity"])
def test_native_export_directory_and_cancel(native, tmp_path, engine):
    bridge, service, replies, calls = native
    start = service.create_node("start")
    end = service.create_node("end")
    service.create_connection(start.id, "out", end.id, "in")
    before = service.get_project()
    replies.append(None)
    assert bridge.export_forge_project(engine) == {"cancelled": True}
    folder = tmp_path / "Saída 日本語 com espaços"
    replies.append((str(folder),))
    assert bridge.export_forge_project(engine) == {"ok": True}
    assert (folder / ("project.godot" if engine == "godot" else "Assets/Forge/ForgeRunner.cs")).is_file()
    assert service.get_project() == before
