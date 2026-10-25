from copy import deepcopy
from math import isfinite


DEFAULT_WORKSPACE = {
    "mode": "animation",
    "leftWidth": 226,
    "previewWidth": 34,
    "bottomHeight": 210,
    "bottomCollapsed": False,
    "inspectorWidth": 292,
    "inspectorCollapsed": False,
    "activeBottomTab": "ir",
    "inspectorSide": "right",
    "bottomPosition": "bottom",
}


def validate_workspace(data: dict) -> dict:
    if not isinstance(data, dict) or set(data) - set(DEFAULT_WORKSPACE):
        raise ValueError("Estado de workspace inválido")

    workspace = deepcopy(DEFAULT_WORKSPACE)
    workspace.update(data)

    for key, minimum, maximum in [
        ("leftWidth", 160, 360), ("inspectorWidth", 180, 600),
        ("bottomHeight", 70, 800), ("previewWidth", 15, 75),
    ]:
        value = workspace[key]

        if type(value) not in (int, float) or not isfinite(value) or not minimum <= value <= maximum:
            raise ValueError(f"Dimensão de workspace inválida: {key}")

    for key in ("bottomCollapsed", "inspectorCollapsed"):
        if type(workspace[key]) is not bool:
            raise ValueError(f"Preferência de workspace deve ser booleana: {key}")

    for key, allowed in [
        ("mode", ("animation", "event")),
        ("activeBottomTab", ("problems", "generated", "ir", "console", "inspector", "visible")),
        ("inspectorSide", ("left", "right")),
        ("bottomPosition", ("top", "bottom")),
    ]:
        if workspace[key] not in allowed:
            raise ValueError(f"Opção de workspace inválida: {key}")

    return workspace
