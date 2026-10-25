from apps.forge.services.forge_service import ForgeService
from apps.forge.services.validator import validate_graph


def test_valid_flow_and_orphan_warning():
    service = ForgeService()
    start = service.create_node("start")
    end = service.create_node("end")
    service.create_connection(start.id, "out", end.id, "in")

    assert service.validate() == []

    orphan = service.create_node("dialogue")
    problems = service.validate()

    assert any(p["code"] == "unreachable" and p["node_id"] == orphan.id for p in problems)
    assert not any(p["severity"] == "error" for p in problems)


def test_duplicate_ids_missing_nodes_and_wrong_direction():
    service = ForgeService()
    start = service.create_node("start")
    end = service.create_node("end")
    graph = service.get_graph()
    graph["nodes"].append(graph["nodes"][0])
    graph["connections"] = [
        {"id": "a", "source_node_id": "missing", "source_port": "out",
         "target_node_id": end.id, "target_port": "in"},
        {"id": "b", "source_node_id": end.id, "source_port": "out",
         "target_node_id": start.id, "target_port": "in"},
    ]

    codes = {problem["code"] for problem in validate_graph(graph)}

    assert {"duplicate_id", "missing_node", "invalid_port", "start_count"} <= codes


def test_validator_terminates_on_cycle():
    service = ForgeService()
    start = service.create_node("start")
    first = service.create_node("dialogue")
    second = service.create_node("dialogue")
    service.create_connection(start.id, "out", first.id, "in")
    service.create_connection(first.id, "out", second.id, "in")
    service.create_connection(second.id, "out", first.id, "in")

    assert any(p["code"] == "missing_end" for p in service.validate())


def test_missing_branch_condition_is_reported_without_exception():
    graph = {"nodes": [{"id": "branch", "type": "branch", "properties": {}}], "connections": []}

    problems = validate_graph(graph)

    assert any(problem["code"] == "invalid_condition" for problem in problems)
