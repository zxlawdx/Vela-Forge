from uuid import uuid4

from apps.forge.domain.connections import Connection
from apps.forge.domain.graph import Graph
from apps.forge.domain.nodes import Node


class ForgeService:
    def __init__(self):
        self.graph = Graph()

    def create_node(
        self,
        node_type: str,
        properties: dict | None = None,
    ) -> Node:
        node = Node(
            id=f"node_{uuid4().hex}",
            type=node_type,
            properties=properties or {},
            position={
                "x": 120.0 + len(self.graph.nodes) % 3 * 300,
                "y": 120.0 + len(self.graph.nodes) // 3 * 190,
            },
        )

        self.graph.add_node(node)

        return node

    def update_node_position(
        self,
        node_id: str,
        position: dict,
    ) -> Node:
        node = self.graph.update_position(node_id, position)

        return node

    def update_node(
        self,
        node_id: str,
        changes: dict,
    ) -> Node:
        node = self.graph.get_node(node_id)

        if not isinstance(changes, dict) or not changes:
            raise ValueError("Informe position ou properties")

        if set(changes) - {"position", "properties"}:
            raise ValueError("Somente position e properties podem ser alterados")

        if "properties" in changes and not isinstance(changes["properties"], dict):
            raise ValueError("Propriedades devem ser um objeto")

        if "position" in changes:
            self.graph.update_position(node_id, changes["position"])

        if "properties" in changes:
            self.graph.update_properties(node_id, changes["properties"])

        return node

    def delete_node(self, node_id: str) -> None:
        self.graph.remove_node(node_id)

    def get_graph(self) -> dict:
        return self.graph.to_dict()

    def create_connection(
        self,
        source_node_id: str,
        source_port: str,
        target_node_id: str,
        target_port: str,
    ) -> Connection:
        connection = Connection(
            id=f"connection_{uuid4().hex}",
            source_node_id=source_node_id,
            source_port=source_port,
            target_node_id=target_node_id,
            target_port=target_port,
        )

        self.graph.connect(connection)

        return connection

forge_service = ForgeService()