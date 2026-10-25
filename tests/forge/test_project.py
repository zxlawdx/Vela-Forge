from copy import deepcopy

import pytest

from apps.forge.services.forge_service import ForgeService


def test_file_round_trip(tmp_path):
    original = ForgeService()
    start = original.create_node("start", position={"x": -40, "y": 300})
    end = original.create_node("end")
    original.create_connection(start.id, "out", end.id, "in")
    original.rename_project("Meu projeto")
    path = tmp_path / "example.vforge"

    original.save_project_file(str(path))
    loaded = ForgeService()
    loaded.open_project_file(str(path))

    assert loaded.get_project() == original.get_project()
    assert loaded.get_graph() == original.get_graph()
    assert "ports" not in loaded.get_project()["graph"]["nodes"][0]


def test_invalid_load_keeps_current_project():
    service = ForgeService()
    service.create_node("start")
    previous = service.get_project()

    for invalid in [None, {}, {"format_version": 2}, {"format_version": True}]:
        with pytest.raises(ValueError):
            service.open_project(invalid)

        assert service.get_project() == previous

    invalid = deepcopy(previous)
    invalid["graph"]["nodes"].append(invalid["graph"]["nodes"][0])

    with pytest.raises(ValueError):
        service.open_project(invalid)

    assert service.get_project() == previous


def test_broken_file_is_understandable(tmp_path):
    path = tmp_path / "bad.vforge"
    path.write_text("{broken", encoding="utf-8")

    with pytest.raises(ValueError, match="JSON UTF-8"):
        ForgeService().open_project_file(str(path))


@pytest.mark.parametrize("properties", [None, [], [["text", "invalid"]], "invalid"])
def test_malformed_properties_do_not_replace_project(properties):
    service = ForgeService()
    node = service.create_node("dialogue")
    before = service.get_project()
    data = deepcopy(before)
    data["graph"]["nodes"][0]["properties"] = properties

    with pytest.raises(ValueError):
        service.open_project(data)

    assert service.get_project() == before
    assert service.graph.get_node(node.id) is node


def test_non_finite_metadata_and_oversized_coordinates_are_atomic():
    service = ForgeService()
    service.create_node("dialogue")
    before = service.get_project()

    for field in ("metadata", "coordinate"):
        data = deepcopy(before)
        if field == "metadata":
            data["metadata"]["bad"] = float("nan")
        else:
            data["graph"]["nodes"][0]["position"]["x"] = 10 ** 400

        with pytest.raises(ValueError):
            service.open_project(data)

        assert service.get_project() == before
