from dataclasses import dataclass
from math import isfinite
from typing import Any


@dataclass(slots=True)
class Variable:
    name: str
    type: str
    default: Any


def validate_variable(variable: Variable) -> None:
    name = variable.name

    if (
        not isinstance(name, str) or not name.strip() or len(name) > 128
        or name in (".", "..") or "/" in name or "\\" in name
        or any(ord(character) < 32 for character in name)
    ):
        raise ValueError("Nome de variável inválido")

    if variable.type not in ("string", "number", "boolean"):
        raise ValueError("Tipo de variável deve ser string, number ou boolean")

    validate_variable_value(variable, variable.default)


def validate_variable_value(variable: Variable, value) -> None:
    valid = False

    if variable.type == "string":
        valid = isinstance(value, str)
    elif variable.type == "boolean":
        valid = type(value) is bool
    elif variable.type == "number":
        try:
            valid = type(value) in (int, float) and isfinite(value)
        except OverflowError:
            valid = False

    if not valid:
        raise ValueError(f"Valor incompatível com a variável {variable.name} ({variable.type})")


def infer_legacy_variables(nodes) -> dict:
    variables = {}

    nodes = list(nodes)
    nodes.sort(key=lambda node: node.type != "set-variable")

    for node in nodes:
        if node.type == "set-variable":
            name = node.properties.get("variable")
            value = node.properties.get("value", "")
        elif node.type == "branch":
            condition = node.properties["condition"]
            name = condition["variable"]
            value = condition["value"] if condition["value"] is not None else False
        else:
            continue

        if not name or name in variables:
            continue

        variable_type = "boolean" if type(value) is bool else "number" if type(value) in (int, float) else "string"
        default = False if variable_type == "boolean" else 0 if variable_type == "number" else ""
        variable = Variable(name, variable_type, default)
        validate_variable(variable)
        variables[name] = variable

    return variables
