from math import isfinite


CONDITION_OPERATORS = {
    "equals": "Igual a",
    "not_equals": "Diferente de",
    "greater_than": "Maior que",
    "less_than": "Menor que",
    "greater_or_equal": "Maior ou igual",
    "less_or_equal": "Menor ou igual",
    "truthy": "Verdadeiro / não vazio",
    "falsy": "Falso / vazio",
}
NUMERIC_OPERATORS = (
    "greater_than", "less_than", "greater_or_equal", "less_or_equal",
)


def normalize_condition(condition, allow_empty_variable: bool = True) -> dict:
    if isinstance(condition, str):
        condition = {"variable": condition, "operator": "truthy"}

    if not isinstance(condition, dict) or set(condition) - {"variable", "operator", "value"}:
        raise ValueError("Condição deve conter variable, operator e value")

    variable = condition.get("variable")
    operator = condition.get("operator")

    if not isinstance(variable, str) or (not allow_empty_variable and not variable.strip()):
        raise ValueError("Selecione uma variável para Branch")

    if not isinstance(operator, str) or operator not in CONDITION_OPERATORS:
        raise ValueError("Operador de Branch inválido")

    value = condition.get("value")

    if operator not in ("truthy", "falsy") and "value" not in condition:
        raise ValueError("Operador precisa de um valor de comparação")

    if value is not None and type(value) not in (str, int, float, bool):
        raise ValueError("Branch compara apenas valores escalares")

    if operator in NUMERIC_OPERATORS:
        try:
            finite = type(value) in (int, float) and isfinite(value)
        except OverflowError:
            finite = False

        if not finite:
            raise ValueError("Operador numérico precisa de um número finito")

    return {
        "variable": variable,
        "operator": operator,
        "value": None if operator in ("truthy", "falsy") else value,
    }
