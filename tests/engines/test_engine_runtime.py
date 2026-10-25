import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest

from apps.forge.services.forge_service import ForgeService


ROOT = Path(__file__).resolve().parents[2]
GODOT = os.environ.get("FORGE_GODOT") or shutil.which("godot4") or shutil.which("godot")


def smoke_service():
    service = ForgeService()
    service.open_project(json.loads((ROOT / "examples/engine_smoke.vforge").read_text()))

    return service


@pytest.mark.skipif(not GODOT, reason="Godot 4 executable not installed; set FORGE_GODOT")
def test_godot_import_and_both_runtime_branches(tmp_path):
    service = smoke_service()
    service.export_directory("godot", str(tmp_path))
    shutil.copyfile(ROOT / "tests/engines/godot_smoke.gd", tmp_path / "smoke.gd")
    imported = subprocess.run(
        [GODOT, "--headless", "--path", str(tmp_path), "--editor", "--import", "--quit"],
        capture_output=True, text=True, timeout=30,
    )
    assert imported.returncode == 0, imported.stdout + imported.stderr
    result = subprocess.run(
        [GODOT, "--headless", "--path", str(tmp_path), "--script", "smoke.gd"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "FORGE_GODOT_SMOKE_PASSED" in result.stdout, result.stdout + result.stderr
    assert "SCRIPT ERROR" not in result.stderr


def test_smoke_fixture_is_valid_and_exportable():
    service = smoke_service()

    assert service.validate() == []
    assert service.generate_export("godot")["files"]
    assert service.generate_export("unity")["files"]


def test_unity_compile_with_real_engine_references(tmp_path):
    compiler = os.environ.get("FORGE_CSC") or shutil.which("csc")
    managed = os.environ.get("FORGE_UNITY_MANAGED_DIR")

    if not compiler or not managed:
        pytest.skip("C# compiler and real Unity reference DLLs required; no stub compilation")

    service = smoke_service()
    service.export_directory("unity", str(tmp_path))
    references = [
        Path(managed) / "UnityEngine" / "UnityEngine.CoreModule.dll",
        Path(managed) / "UnityEngine" / "UnityEngine.IMGUIModule.dll",
    ]

    for reference in references:
        assert reference.is_file(), str(reference)

    sources = sorted((tmp_path / "Assets/Forge").glob("*.cs"))
    result = subprocess.run(
        [compiler, "/target:library", "/out:" + str(tmp_path / "Forge.dll")]
        + ["/reference:" + str(path) for path in references]
        + [str(path) for path in sources],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert (tmp_path / "Forge.dll").is_file()


@pytest.mark.skipif(not GODOT, reason="Godot 4 executable not installed; set FORGE_GODOT")
@pytest.mark.parametrize("operator,value,scenarios", [
    ("equals", True, [[False, False], [True, True]]),
    ("not_equals", True, [[True, False], [False, True]]),
    ("greater_than", 10, [[9, False], [11, True]]),
    ("less_than", 10, [[11, False], [9, True]]),
    ("greater_or_equal", 10, [[9, False], [10, True]]),
    ("less_or_equal", 10, [[11, False], [10, True]]),
    ("falsy", None, [[True, False], [False, True]]),
])
def test_godot_structured_comparison_runtime(tmp_path, operator, value, scenarios):
    service = smoke_service()
    if type(value) in (int, float):
        service.delete_variable("has_key")
        service.create_variable("has_key", "number", 0)

    service.update_node("branch", {"properties": {"condition": {
        "variable": "has_key", "operator": operator, "value": value,
    }}})
    service.export_directory("godot", str(tmp_path))
    source = (ROOT / "tests/engines/godot_smoke.gd").read_text()
    source = source.replace(
        "for flag in [false, true]:",
        "for scenario in " + json.dumps(scenarios) + ":\n        var flag = scenario[1]",
    ).replace('scene.variables["has_key"] = flag', 'scene.variables["has_key"] = scenario[0]')
    (tmp_path / "smoke.gd").write_text(source)
    result = subprocess.run(
        [GODOT, "--headless", "--path", str(tmp_path), "--script", "smoke.gd"],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "FORGE_GODOT_SMOKE_PASSED" in result.stdout, result.stdout + result.stderr
    assert "SCRIPT ERROR" not in result.stderr
