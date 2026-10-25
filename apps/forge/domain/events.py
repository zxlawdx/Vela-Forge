from dataclasses import dataclass


@dataclass(slots=True)
class Event:
    id: str
    name: str
