import base64
from io import BytesIO
import json
from zipfile import ZipFile

import pytest

from apps.forge.services.forge_service import ForgeService


def complete_flow():
    service = ForgeService()
    event = service.create_event("greeted")
    start = service.create_node("start")
    set_variable = service.create_node("set-variable", {"variable": "allowed", "value": True})
    branch = service.create_node("branch", {"condition": "allowed"})
    dialogue = service.create_node("dialogue", {"actor": "Guide", "text": "Hello\nworld"})
    choice = service.create_node("choice")
    emit = service.create_node("event", {"event": event.id})
    end = service.create_node("end")

    for source, port, target in [
        (start, "out", set_variable), (set_variable, "out", branch),
        (branch, "true", dialogue), (branch, "false", end),
        (dialogue, "out", choice), (choice, "choice_0", emit),
        (choice, "choice_1", end), (emit, "out", end),
    ]:
        service.create_connection(source.id, port, target.id, "in")

    return service


def test_godot_export_is_deterministic_and_preserves_project(tmp_path):
    service = complete_flow()
    before = service.get_project()
    result = service.generate_export("godot")

    assert result == service.generate_export("godot")
    assert service.get_project() == before
    assert json.loads(result["files"]["forge_project.json"]) == before
    assert "run/main_scene" in result["files"]["project.godot"]
    assert "signal event_emitted" in result["files"]["forge_runner.gd"]

    with ZipFile(BytesIO(base64.b64decode(result["archive"]))) as archive:
        assert set(archive.namelist()) == set(result["files"])
        assert archive.read("forge_runner.gd").decode() == result["files"]["forge_runner.gd"]

    service.export_directory("godot", str(tmp_path))
    assert (tmp_path / "main.tscn").read_text() == result["files"]["main.tscn"]


def test_fatal_validation_blocks_export():
    service = ForgeService()

    with pytest.raises(ValueError, match="Problems"):
        service.generate_export("godot")


def test_same_ir_exports_to_unity_without_domain_changes(tmp_path):
    service = complete_flow()
    before = service.get_project()
    godot = service.generate_export("godot")
    unity = service.generate_export("unity")

    assert unity == service.generate_export("unity")
    assert service.get_project() == before
    assert godot["files"] != unity["files"]
    assert json.loads(unity["files"]["Assets/Forge/forge_project.json"]) == before
    service.export_directory("unity", str(tmp_path))
    assert (tmp_path / "Assets/Forge/ForgeRunner.cs").is_file()


def test_unity_literals_escape_user_content():
    from apps.forge.exporters.unity import csharp_value

    assert csharp_value('a"\\b\n') == '"a\\"\\\\b\\n"'
    assert csharp_value([True, None, 3]) == "new object[] {true, null, 3.0d}"
    assert "new Dictionary" in csharp_value({"flag": False})


def test_generated_gdscript_parses():
    parser_module = pytest.importorskip("gdtoolkit.parser")
    result = complete_flow().generate_export("godot")

    parser_module.parser.parse(result["files"]["forge_runner.gd"])


def test_generated_csharp_parses():
    tree_sitter = pytest.importorskip("tree_sitter")
    csharp = pytest.importorskip("tree_sitter_c_sharp")
    parser = tree_sitter.Parser(tree_sitter.Language(csharp.language()))
    result = complete_flow().generate_export("unity")

    for name, content in result["files"].items():
        if name.endswith(".cs"):
            syntax = parser.parse(content.encode("utf-8"))
            assert not syntax.root_node.has_error, name
