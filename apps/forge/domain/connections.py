from dataclasses import dataclass


@dataclass(slots=True)
class Connection:
    id: str
    source_node_id: str
    source_port: str
    target_node_id: str
    target_port: str