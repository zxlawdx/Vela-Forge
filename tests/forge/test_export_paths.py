from pathlib import Path

import pytest

from apps.forge.services.forge_service import ForgeService


@pytest.mark.parametrize("name", ["../escape", "/absolute", "C:/escape", "C:\\escape", "a/../../escape", "a\\..\\escape", "file:stream", "", "."])
def test_invalid_export_paths_are_rejected_before_writes(tmp_path, monkeypatch, name):
    service = ForgeService()
    monkeypatch.setattr(service, "generate_export", lambda engine: {
        "files": {"valid.txt": "safe", name: "unsafe"},
    })

    with pytest.raises(ValueError):
        service.export_directory("godot", str(tmp_path / "output"))

    assert not (tmp_path / "output" / "valid.txt").exists()
    assert not (tmp_path / "escape").exists()


def test_export_rejects_symlink_escape(tmp_path, monkeypatch):
    outside = tmp_path / "outside"
    outside.mkdir()
    output = tmp_path / "output"
    output.mkdir()

    try:
        (output / "assets").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("Creating symlinks requires OS privileges")

    service = ForgeService()
    monkeypatch.setattr(service, "generate_export", lambda engine: {
        "files": {"assets/escape.txt": "unsafe"},
    })

    with pytest.raises(ValueError):
        service.export_directory("godot", str(output))

    assert not (outside / "escape.txt").exists()
