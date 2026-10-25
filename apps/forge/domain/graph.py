from dataclasses import dataclass, field

from .nodes import Node
from .connections import Connection


@dataclass(slots=True)
class Graph:
    nodes: dict[str, Node] = field(default_factory=dict)
    connections: dict[str, Connection] = field(default_factory=dict)

    def add_node(self, node: Node) -> None:
        if node.id in self.nodes:
            raise ValueError(f"Node '{node.id}' já existe")

        self.nodes[node.id] = node

    def get_node(self, node_id: str) -> Node:
        if node_id not in self.nodes:
            raise ValueError(f"Node '{node_id}' não existe")

        return self.nodes[node_id]

    def remove_node(self, node_id: str) -> None:
        if node_id not in self.nodes:
            raise ValueError(f"Node '{node_id}' não existe")

        del self.nodes[node_id]

        connections_to_remove = [
            connection_id
            for connection_id, connection in self.connections.items()
            if (
                connection.source_node_id == node_id
                or connection.target_node_id == node_id
            )
        ]

        for connection_id in connections_to_remove:
            del self.connections[connection_id]

    def connect(self, connection: Connection) -> None:
        if connection.id in self.connections:
            raise ValueError(
                f"Connection '{connection.id}' já existe"
            )

        if connection.source_node_id not in self.nodes:
            raise ValueError(
                f"Node de origem '{connection.source_node_id}' não existe"
            )

        if connection.target_node_id not in self.nodes:
            raise ValueError(
                f"Node de destino '{connection.target_node_id}' não existe"
            )

        if connection.source_node_id == connection.target_node_id:
            raise ValueError("Self-connection não é permitida")

        if connection.source_port != "out":
            raise ValueError("Port de origem deve ser 'out'")

        if connection.target_port != "in":
            raise ValueError("Port de destino deve ser 'in'")

        self.connections[connection.id] = connection

    def disconnect(self, connection_id: str) -> None:
        if connection_id not in self.connections:
            raise ValueError(
                f"Connection '{connection_id}' não existe"
            )

        del self.connections[connection_id]

    def adjacency(self) -> dict[str, list[str]]:
        adjacency = {
            node_id: []
            for node_id in self.nodes
        }

        for connection in self.connections.values():
            adjacency[connection.source_node_id].append(
                connection.target_node_id
            )

        return adjacency

    def to_dict(self) -> dict:
        return {
            "nodes": [
                {
                    "id": node.id,
                    "type": node.type,
                    "properties": node.properties,
                }
                for node in self.nodes.values()
            ],
            "connections": [
                {
                    "id": connection.id,
                    "source_node_id": connection.source_node_id,
                    "source_port": connection.source_port,
                    "target_node_id": connection.target_node_id,
                    "target_port": connection.target_port,
                }
                for connection in self.connections.values()
            ],
        }