from dataclasses import dataclass, field
from typing import Any

@dataclass(slots=True)
class Node:
    id: str
    type: str
    properties: dict[str, any] = field(default_factory=dict)