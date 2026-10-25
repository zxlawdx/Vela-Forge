from collections import Counter

from apps.forge.domain.conditions import normalize_condition
from apps.forge.domain.registry import node_ports, validate_properties


def validate_graph(graph: dict, events: dict | None = None) -> list[dict]:
    problems = []
    nodes = graph.get("nodes", [])
    connections = graph.get("connections", [])
    node_ids = [node["id"] for node in nodes]
    connection_ids = [item["id"] for item in connections]
    nodes_by_id = {node["id"]: node for node in nodes}
    valid_ports = {}

    def report(severity, code, message, node_id=None, connection_id=None):
        problems.append({
            "severity": severity,
            "code": code,
            "message": message,
            "node_id": node_id,
            "connection_id": connection_id,
        })

    for kind, ids in (("node", node_ids), ("connection", connection_ids)):
        for identifier, count in Counter(ids).items():
            if count > 1:
                report("error", "duplicate_id", f"ID duplicado de {kind}: {identifier}")

    starts = [node for node in nodes if node["type"] == "start"]

    if len(starts) != 1:
        report("error", "start_count", "O fluxo precisa de exatamente um Start")

    if not any(node["type"] == "end" for node in nodes):
        report("warning", "missing_end", "O fluxo não possui End")

    for node in nodes:
        try:
            validate_properties(node["type"], node["properties"])
            valid_ports[node["id"]] = node_ports(node["type"], node["properties"])
        except ValueError as error:
            report("error", "invalid_node", str(error), node["id"])
            continue

        if (
            node["type"] == "event"
            and events is not None
            and node["properties"].get("event") not in events
        ):
            report("error", "missing_event", "Evento referenciado não existe", node["id"])

        if node["type"] == "branch":
            try:
                normalize_condition(node["properties"]["condition"], allow_empty_variable=False)
            except ValueError as error:
                report("error", "invalid_condition", str(error), node["id"])

        required = {
            "set-variable": "variable",
            "event": "event",
        }.get(node["type"])

        if required and not node["properties"].get(required):
            report("error", "required_property", f"Preencha {required}", node["id"])

    adjacency = {node_id: [] for node_id in node_ids}
    connected_outputs = set()

    for connection in connections:
        source = connection["source_node_id"]
        target = connection["target_node_id"]
        connection_id = connection["id"]

        if source not in nodes_by_id or target not in nodes_by_id:
            report("error", "missing_node", "Connection aponta para node inexistente",
                   connection_id=connection_id)
            continue

        if source == target:
            report("error", "self_connection", "Self-connection não permitida",
                   source, connection_id)

        output_names = [port["name"] for port in valid_ports.get(source, {}).get("outputs", [])]
        input_names = [port["name"] for port in valid_ports.get(target, {}).get("inputs", [])]

        if connection["source_port"] not in output_names or connection["target_port"] not in input_names:
            report("error", "invalid_port", "Port ou direção inválida", source, connection_id)
            continue

        key = (source, connection["source_port"])

        if key in connected_outputs:
            report("error", "ambiguous_output", "Uma saída possui múltiplos destinos",
                   source, connection_id)

        connected_outputs.add(key)
        adjacency[source].append(target)

    reached = set()
    pending = [node["id"] for node in starts]

    while pending:
        node_id = pending.pop()

        if node_id not in reached:
            reached.add(node_id)
            pending.extend(adjacency[node_id])

    for node in nodes:
        if starts and node["id"] not in reached:
            report("warning", "unreachable", "Node não alcançável a partir do Start", node["id"])

        outputs = valid_ports.get(node["id"], {}).get("outputs", [])

        for port in outputs:
            if (node["id"], port["name"]) not in connected_outputs:
                report("warning", "unconnected_output", f"Saída sem destino: {port['name']}", node["id"])

    return problems
