import pytest

from apps.forge.domain.registry import NODE_TYPES, node_ports
from apps.forge.services.forge_service import ForgeService


def test_registry_covers_expected_types():
    assert set(NODE_TYPES) == {
        "start", "end", "dialogue", "choice", "branch", "set-variable", "event",
    }
    assert node_ports("start", {})["inputs"] == []
    assert node_ports("end", {})["outputs"] == []


def test_choice_outputs_and_defaults_are_independent():
    service = ForgeService()
    choice = service.create_node("choice", {"choices": ["A", "B", "C"]})
    other = service.create_node("choice")
    end = service.create_node("end")
    service.create_connection(choice.id, "choice_2", end.id, "in")

    assert len(service.get_node(choice.id)["ports"]["outputs"]) == 3
    assert other.properties["choices"] == ["Opção A", "Opção B"]

    with pytest.raises(ValueError):
        service.update_node(choice.id, {"properties": {"choices": ["A"]}})

    assert len(choice.properties["choices"]) == 3
    assert len(service.graph.connections) == 1


def test_unknown_type_and_wrong_ports_are_rejected():
    service = ForgeService()

    with pytest.raises(ValueError):
        service.create_node("unknown")

    start = service.create_node("start")
    end = service.create_node("end")

    with pytest.raises(ValueError):
        service.create_connection(end.id, "out", start.id, "in")

    assert service.graph.connections == {}
