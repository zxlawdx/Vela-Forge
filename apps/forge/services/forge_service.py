import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import uuid4

from apps.forge.domain.connections import Connection
from apps.forge.domain.events import Event
from apps.forge.domain.graph import Graph
from apps.forge.domain.nodes import Node
from apps.forge.domain.project import parse_project, serialize_project
from apps.forge.services.validator import validate_graph
from apps.forge.domain.registry import NODE_TYPES, default_properties, validate_properties


class ForgeService:
    def __init__(self):
        self.graph = Graph()
        self.metadata = {"name": "untitled"}
        self.events = {}

    def validate(self) -> list[dict]:
        problems = validate_graph(self.graph.to_dict(), self.events)

        return problems

    def create_event(self, name: str) -> Event:
        if not isinstance(name, str) or not name.strip() or len(name) > 128:
            raise ValueError("Nome de evento deve ter entre 1 e 128 caracteres")

        name = name.strip()

        if any(event.name == name for event in self.events.values()):
            raise ValueError("Já existe um evento com esse nome")

        event = Event(id=f"event_{uuid4().hex}", name=name)
        self.events[event.id] = event

        return event

    def list_events(self) -> list[dict]:
        events = []

        for event in self.events.values():
            usages = [
                node.id
                for node in self.graph.nodes.values()
                if node.type == "event" and node.properties.get("event") == event.id
            ]
            events.append({"id": event.id, "name": event.name, "usages": usages})

        return events

    def delete_event(self, event_id: str) -> None:
        if event_id not in self.events:
            raise ValueError("Evento não existe")

        del self.events[event_id]

    def get_project(self) -> dict:
        project = serialize_project(self.graph, self.metadata, self.events)

        return project

    def open_project(self, data: dict) -> dict:
        graph, metadata, events = parse_project(data)
        self.graph = graph
        self.metadata = metadata
        self.events = events

        return self.get_project()

    def new_project(self) -> dict:
        self.graph = Graph()
        self.metadata = {"name": "untitled"}
        self.events = {}

        return self.get_project()

    def rename_project(self, name: str) -> dict:
        if not isinstance(name, str) or not name.strip() or len(name) > 128:
            raise ValueError("Nome do projeto deve ter entre 1 e 128 caracteres")

        self.metadata["name"] = name.strip()

        return self.get_project()

    def save_project_file(self, path: str) -> None:
        target = Path(path)

        if target.suffix.lower() != ".vforge":
            raise ValueError("Use a extensão .vforge")

        content = json.dumps(self.get_project(), ensure_ascii=False, indent=2, allow_nan=False)
        temporary_path = None

        try:
            with NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=target.parent,
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(content)

            os.replace(temporary_path, target)
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    def open_project_file(self, path: str) -> dict:
        target = Path(path)

        if target.suffix.lower() != ".vforge":
            raise ValueError("Use a extensão .vforge")

        try:
            data = json.loads(target.read_text(encoding="utf-8"))
        except (UnicodeError, json.JSONDecodeError) as error:
            raise ValueError("Arquivo .vforge não contém JSON UTF-8 válido") from error

        project = self.open_project(data)

        return project

    def create_node(
        self,
        node_type: str,
        properties: dict | None = None,
        position: dict | None = None,
    ) -> Node:
        values = default_properties(node_type)

        if properties is not None:
            if not isinstance(properties, dict):
                raise ValueError("Propriedades devem ser um objeto")

            values.update(properties)

        validate_properties(node_type, values)

        node = Node(
            id=f"node_{uuid4().hex}",
            type=node_type,
            properties=values,
            position={
                "x": 120.0 + len(self.graph.nodes) % 3 * 300,
                "y": 120.0 + len(self.graph.nodes) // 3 * 190,
            },
        )

        self.graph.add_node(node)

        if position is not None:
            try:
                self.graph.update_position(node.id, position)
            except ValueError:
                self.graph.remove_node(node.id)
                raise

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

        previous_properties = node.properties.copy()

        if "properties" in changes:
            self.graph.update_properties(node_id, changes["properties"])

        try:
            if "position" in changes:
                self.graph.update_position(node_id, changes["position"])
        except ValueError:
            node.properties = previous_properties
            raise

        return node

    def delete_node(self, node_id: str) -> None:
        self.graph.remove_node(node_id)

    def get_node_types(self) -> dict:
        return NODE_TYPES

    def get_node(self, node_id: str) -> dict:
        self.graph.get_node(node_id)
        graph = self.get_graph()
        node = next(node for node in graph["nodes"] if node["id"] == node_id)

        return node

    def get_graph(self) -> dict:
        return self.graph.to_dict()

    def delete_connection(self, connection_id: str) -> None:
        self.graph.disconnect(connection_id)

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