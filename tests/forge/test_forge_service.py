from apps.forge.services.forge_service import ForgeService


def test_create_node():
    service = ForgeService()

    result = service.create_node(
        node_id="start_1",
        node_type="start",
    )

    assert len(result["nodes"]) == 1
    assert result["nodes"][0]["id"] == "start_1"