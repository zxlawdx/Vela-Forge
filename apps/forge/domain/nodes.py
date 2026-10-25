from dataclasses import dataclass, field
from typing import Any

@dataclass(slots=True)
class Node:
    id: str
    type: str
    properties: dict[str, Any] = field(default_factory=dict)
    position: dict[str, float] = field(
        default_factory=lambda: {"x": 120.0, "y": 120.0}
    )
