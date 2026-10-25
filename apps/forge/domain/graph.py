from dataclasses import dataclass, field
from math import isfinite

from .nodes import Node
from .registry import get_node_type, node_ports, validate_properties
from .connections import Connection


@dataclass(slots=True)
class Graph:
    nodes: dict[str, Node] = field(default_factory=dict)
    connections: dict[str, Connection] = field(default_factory=dict)

    def add_node(self, node: Node) -> None:
        if node.id in self.nodes:
            raise ValueError(f"Node '{node.id}' já existe")

        get_node_type(node.type)

        self.nodes[node.id] = node

    def get_node(self, node_id: str) -> Node:
        if node_id not in self.nodes:
            raise ValueError(f"Node '{node_id}' não existe")

        return self.nodes[node_id]

    def update_position(
        self,
        node_id: str,
        position: dict,
    ) -> Node:
        node = self.get_node(node_id)

        if not isinstance(position, dict):
            raise ValueError("Posição deve conter x e y numéricos")

        coordinates = {}

        for axis in ("x", "y"):
            value = position.get(axis)

            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not isfinite(value)
            ):
                raise ValueError("Posição deve conter x e y finitos")

            coordinates[axis] = float(value)

        node.position = coordinates

        return node

    def update_properties(
        self,
        node_id: str,
        properties: dict,
    ) -> Node:
        node = self.get_node(node_id)

        if not isinstance(properties, dict):
            raise ValueError("Propriedades devem ser um objeto")

        updated = {**node.properties, **properties}
        validate_properties(node.type, updated)
        ports = node_ports(node.type, updated)
        output_names = [port["name"] for port in ports["outputs"]]

        for connection in self.connections.values():
            if (
                connection.source_node_id == node_id
                and connection.source_port not in output_names
            ):
                raise ValueError("Remova a connection antes de remover sua saída")

        node.properties = updated

        return node

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

        self.validate_connection(connection)
        self.connections[connection.id] = connection

    def validate_connection(self, connection: Connection) -> None:
        fields = (
            connection.source_node_id,
            connection.source_port,
            connection.target_node_id,
            connection.target_port,
        )

        if any(not isinstance(value, str) or not value for value in fields):
            raise ValueError("Endpoints e ports devem ser textos não vazios")

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

        source = self.nodes[connection.source_node_id]
        target = self.nodes[connection.target_node_id]
        source_ports = node_ports(source.type, source.properties)["outputs"]
        target_ports = node_ports(target.type, target.properties)["inputs"]
        output = next(
            (port for port in source_ports if port["name"] == connection.source_port),
            None,
        )
        input_port = next(
            (port for port in target_ports if port["name"] == connection.target_port),
            None,
        )

        if output is None or input_port is None:
            raise ValueError("Port ou direção inválida para o tipo de node")

        if output["type"] != input_port["type"]:
            raise ValueError("Tipos de ports incompatíveis")


    def get_connection(self, connection_id: str) -> Connection:
        if connection_id not in self.connections:
            raise ValueError(f"Connection '{connection_id}' não existe")

        return self.connections[connection_id]

    def reconnect(self, connection_id: str, changes: dict) -> Connection:
        connection = self.get_connection(connection_id)
        fields = {"source_node_id", "source_port", "target_node_id", "target_port"}

        if not isinstance(changes, dict) or not changes or set(changes) - fields:
            raise ValueError("Informe apenas endpoints e ports da connection")

        candidate = Connection(
            id=connection.id,
            source_node_id=changes.get("source_node_id", connection.source_node_id),
            source_port=changes.get("source_port", connection.source_port),
            target_node_id=changes.get("target_node_id", connection.target_node_id),
            target_port=changes.get("target_port", connection.target_port),
        )
        self.validate_connection(candidate)

        connection.source_node_id = candidate.source_node_id
        connection.source_port = candidate.source_port
        connection.target_node_id = candidate.target_node_id
        connection.target_port = candidate.target_port

        return connection

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
                    "position": node.position,
                    "ports": node_ports(node.type, node.properties),
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