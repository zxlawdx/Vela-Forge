import pytest

from apps.forge.services.forge_service import ForgeService


def test_events_persist_and_track_references(tmp_path):
    service = ForgeService()
    event = service.create_event("door_open")
    node = service.create_node("event", {"event": event.id})

    assert service.list_events()[0]["usages"] == [node.id]

    path = tmp_path / "events.vforge"
    service.save_project_file(str(path))
    loaded = ForgeService()
    loaded.open_project_file(str(path))

    assert loaded.list_events() == service.list_events()
    assert loaded.get_project() == service.get_project()

    loaded.delete_event(event.id)

    assert loaded.get_node(node.id)["properties"]["event"] == event.id
    assert any(p["code"] == "missing_event" for p in loaded.validate())


def test_duplicate_event_name_does_not_replace_event():
    service = ForgeService()
    event = service.create_event(" test ")

    with pytest.raises(ValueError):
        service.create_event("test")

    assert list(service.events) == [event.id]
