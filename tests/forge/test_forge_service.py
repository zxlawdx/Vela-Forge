import pytest

from apps.forge.services.forge_service import ForgeService


def test_create_node():
    service = ForgeService()

    node = service.create_node(
        node_type="start",
    )

    result = service.get_graph()

    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["id"] == node.id
    assert node.type == "start"
    assert service.graph.get_node(node.id) is node


def test_create_connection():
    service = ForgeService()
    source = service.create_node("start")
    target = service.create_node("dialogue")

    connection = service.create_connection(
        source.id,
        "out",
        target.id,
        "in",
    )

    assert service.graph.connections[connection.id] is connection
    assert service.get_graph()["connections"][0]["id"] == connection.id


def test_rejected_connection_is_not_stored():
    service = ForgeService()
    source = service.create_node("start")

    with pytest.raises(ValueError):
        service.create_connection(source.id, "out", "missing", "in")

    assert service.get_graph()["connections"] == []


def test_update_position_is_serialized():
    service = ForgeService()
    node = service.create_node("dialogue")

    result = service.update_node_position(node.id, {"x": -20, "y": 73.5})

    assert result is node
    assert service.get_graph()["nodes"][0]["position"] == {
        "x": -20.0,
        "y": 73.5,
    }


@pytest.mark.parametrize(
    "position",
    [None, {}, {"x": True, "y": 1}, {"x": float("nan"), "y": 0},
     {"x": 1, "y": "2"}, {"x": 1, "y": float("inf")}],
)
def test_invalid_position_preserves_node(position):
    service = ForgeService()
    node = service.create_node("dialogue")
    previous = node.position.copy()

    with pytest.raises(ValueError):
        service.update_node_position(node.id, position)

    assert node.position == previous


def test_property_update_is_partial():
    service = ForgeService()
    node = service.create_node("dialogue", {"actor": "A", "text": "Before"})

    result = service.update_node(node.id, {"properties": {"text": "After"}})

    assert result is node
    assert node.properties == {"actor": "A", "text": "After"}
    assert service.get_graph()["nodes"][0]["properties"] == node.properties


def test_delete_node_removes_only_attached_connections():
    service = ForgeService()
    first = service.create_node("dialogue")
    second = service.create_node("dialogue")
    third = service.create_node("dialogue")
    attached = service.create_connection(first.id, "out", second.id, "in")
    remaining = service.create_connection(first.id, "out", third.id, "in")

    service.delete_node(second.id)

    assert second.id not in service.graph.nodes
    assert attached.id not in service.graph.connections
    assert list(service.graph.connections) == [remaining.id]


def test_invalid_property_patch_is_atomic():
    service = ForgeService()
    node = service.create_node("dialogue")
    position = node.position.copy()

    with pytest.raises(ValueError):
        service.update_node(node.id, {
            "position": {"x": 1, "y": 2},
            "properties": [],
        })

    assert node.position == position
    assert node.properties == {}
