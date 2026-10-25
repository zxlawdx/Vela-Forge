from copy import deepcopy


NODE_TYPES = {
    "start": {
        "name": "Start",
        "properties": {"trigger": "scene_ready"},
        "inputs": [],
        "outputs": ["out"],
    },
    "end": {
        "name": "End",
        "properties": {},
        "inputs": ["in"],
        "outputs": [],
    },
    "dialogue": {
        "name": "Dialogue",
        "properties": {"actor": "", "text": "Novo diálogo"},
        "inputs": ["in"],
        "outputs": ["out"],
    },
    "choice": {
        "name": "Choice",
        "properties": {"choices": ["Opção A", "Opção B"]},
        "inputs": ["in"],
        "outputs": [],
    },
    "branch": {
        "name": "Branch",
        "properties": {"condition": ""},
        "inputs": ["in"],
        "outputs": ["true", "false"],
    },
    "set-variable": {
        "name": "Set Variable",
        "properties": {"variable": "", "value": ""},
        "inputs": ["in"],
        "outputs": ["out"],
    },
    "event": {
        "name": "Emit Event",
        "properties": {"event": ""},
        "inputs": ["in"],
        "outputs": ["out"],
    },
}


def get_node_type(node_type: str) -> dict:
    if node_type not in NODE_TYPES:
        raise ValueError(f"Tipo de node desconhecido: {node_type}")

    return NODE_TYPES[node_type]


def default_properties(node_type: str) -> dict:
    definition = get_node_type(node_type)
    properties = deepcopy(definition["properties"])

    return properties


def validate_properties(node_type: str, properties: dict) -> None:
    definition = get_node_type(node_type)

    if not isinstance(properties, dict):
        raise ValueError("Propriedades devem ser um objeto")

    for name, default in definition["properties"].items():
        if name not in properties:
            continue

        value = properties[name]

        if name == "value":
            continue

        if not isinstance(value, type(default)):
            raise ValueError(f"Tipo inválido para a propriedade '{name}'")

    if node_type == "choice":
        choices = properties.get("choices", [])

        if not choices or any(not isinstance(item, str) for item in choices):
            raise ValueError("Choice precisa de uma lista de textos")


def node_ports(node_type: str, properties: dict) -> dict:
    definition = get_node_type(node_type)
    outputs = definition["outputs"]

    if node_type == "choice":
        choices = properties.get("choices", definition["properties"]["choices"])
        outputs = [f"choice_{index}" for index in range(len(choices))]

    ports = {
        "inputs": [
            {"name": name, "type": "flow"}
            for name in definition["inputs"]
        ],
        "outputs": [
            {"name": name, "type": "flow"}
            for name in outputs
        ],
    }

    return ports
