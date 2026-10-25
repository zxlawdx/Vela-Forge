import base64
from io import BytesIO
import json
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import os
from pathlib import Path, PureWindowsPath
from tempfile import NamedTemporaryFile
from uuid import uuid4

from apps.forge.exporters import godot, unity
from apps.forge.domain.assets import Asset, validate_asset
from apps.forge.domain.conditions import normalize_condition
from apps.forge.domain.connections import Connection
from apps.forge.domain.events import Event
from apps.forge.domain.graph import Graph
from apps.forge.domain.nodes import Node
from apps.forge.domain.project import parse_project, serialize_project
from apps.forge.services.validator import validate_graph
from apps.forge.services.history import CommandHistory
from apps.forge.services.editor_state import EditorState
from apps.forge.domain.variables import Variable, validate_variable
from apps.forge.domain.registry import NODE_TYPES, default_properties, validate_properties


class ForgeService:
    def __init__(self, editor_state: EditorState | None = None):
        self.editor_state = editor_state or EditorState()
        self.history = CommandHistory()
        self.project_path = None
        self.graph = Graph()
        self.metadata = {"name": "untitled"}
        self.events = {}
        self.assets = {}
        self.variables = {}

    def generate_export(self, engine: str) -> dict:
        problems = self.validate()

        if any(problem["severity"] == "error" for problem in problems):
            raise ValueError("Export bloqueado: corrija os erros no painel Problems")

        if engine == "godot":
            files = godot.export_project(self.get_project())
        elif engine == "unity":
            files = unity.export_project(self.get_project())
        else:
            raise ValueError("Exporter não disponível")
        buffer = BytesIO()

        with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
            for name, content in sorted(files.items()):
                info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.compress_type = ZIP_DEFLATED
                archive.writestr(info, content.encode("utf-8"))

        return {
            "engine": engine,
            "files": files,
            "archive": base64.b64encode(buffer.getvalue()).decode("ascii"),
        }

    def export_directory(self, engine: str, directory: str) -> None:
        result = self.generate_export(engine)
        target = Path(directory).resolve()
        paths = []

        for name, content in result["files"].items():
            if (
                not isinstance(name, str)
                or not name
                or "\\" in name
                or ":" in name
                or "\x00" in name
                or Path(name).is_absolute()
                or PureWindowsPath(name).drive
                or ".." in Path(name).parts
                or not isinstance(content, str)
            ):
                raise ValueError("Caminho de export inválido")

            path = (target / name).resolve()

            if not path.is_relative_to(target) or path == target:
                raise ValueError("Export não pode sair do diretório selecionado")

            paths.append((path, content))

        target.mkdir(parents=True, exist_ok=True)

        for path, content in paths:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary_path = None

            try:
                with NamedTemporaryFile(
                    mode="w", encoding="utf-8", dir=path.parent, delete=False,
                ) as temporary:
                    temporary_path = Path(temporary.name)
                    temporary.write(content)

                os.replace(temporary_path, path)
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)

    def validate(self) -> list[dict]:
        problems = validate_graph(self.graph.to_dict(), self.events, self.variables)

        for asset in self.assets.values():
            if asset.data is None:
                problems.append({
                    "severity": "warning",
                    "code": "missing_asset",
                    "message": f"Asset indisponível: {asset.name}",
                    "node_id": None,
                    "connection_id": None,
                })

        return problems

    def import_asset(self, name: str, mime_type: str, data: str) -> Asset:
        before = self.get_project()

        if data is None:
            raise ValueError("Selecione um arquivo de imagem")

        asset = Asset(f"asset_{uuid4().hex}", name, mime_type, data)
        size = validate_asset(asset)
        total_size = sum(validate_asset(item) for item in self.assets.values())

        if size + total_size > 8 * 1024 * 1024:
            raise ValueError("Assets do projeto excedem o limite total de 8 MiB")

        self.assets[asset.id] = asset
        self.history.record("Import asset", before, self.get_project())

        return asset

    def list_assets(self) -> list[dict]:
        return self.get_project()["assets"]

    def create_event(self, name: str) -> Event:
        before = self.get_project()

        if not isinstance(name, str) or not name.strip() or len(name) > 128:
            raise ValueError("Nome de evento deve ter entre 1 e 128 caracteres")

        name = name.strip()

        if any(event.name == name for event in self.events.values()):
            raise ValueError("Já existe um evento com esse nome")

        event = Event(id=f"event_{uuid4().hex}", name=name)
        self.events[event.id] = event
        self.history.record("Create event", before, self.get_project())

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
        before = self.get_project()

        if event_id not in self.events:
            raise ValueError("Evento não existe")

        del self.events[event_id]
        self.history.record("Delete event", before, self.get_project())

    def create_variable(self, name: str, variable_type: str, default) -> Variable:
        variable = Variable(name, variable_type, default)
        validate_variable(variable)

        if name in self.variables:
            raise ValueError("Variável já existe")

        before = self.get_project()
        self.variables[name] = variable
        self.history.record("Create variable", before, self.get_project())

        return variable

    def list_variables(self) -> list[dict]:
        return self.get_project()["variables"]

    def delete_variable(self, name: str) -> None:
        if name not in self.variables:
            raise ValueError("Variável não existe")

        before = self.get_project()
        del self.variables[name]
        self.history.record("Delete variable", before, self.get_project())

    def get_project(self) -> dict:
        project = serialize_project(self.graph, self.metadata, self.events, self.assets, self.variables)

        return project

    def _restore_project(self, data: dict) -> None:
        graph, metadata, events, assets, variables = parse_project(data)
        self.graph = graph
        self.metadata = metadata
        self.events = events
        self.assets = assets
        self.variables = variables

    def open_project(self, data: dict) -> dict:
        self._restore_project(data)
        self.project_path = None
        self.history.clear()

        return self.get_project()

    def undo(self) -> dict:
        self._restore_project(self.history.undo())

        return self.get_project()

    def redo(self) -> dict:
        self._restore_project(self.history.redo())

        return self.get_project()

    def new_project(self) -> dict:
        self.project_path = None
        self.history.clear()
        self.graph = Graph()
        self.metadata = {"name": "untitled"}
        self.events = {}
        self.assets = {}
        self.variables = {}

        return self.get_project()

    def rename_project(self, name: str) -> dict:
        before = self.get_project()

        if not isinstance(name, str) or not name.strip() or len(name) > 128:
            raise ValueError("Nome do projeto deve ter entre 1 e 128 caracteres")

        self.metadata["name"] = name.strip()
        self.history.record("Rename project", before, self.get_project())

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
            self.project_path = str(target.resolve())
            self.editor_state.remember(str(target), self.metadata["name"])
        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    def open_project_file(self, path: str) -> dict:
        target = Path(path)

        if target.suffix.lower() != ".vforge":
            raise ValueError("Use a extensão .vforge")

        if target.stat().st_size > 16 * 1024 * 1024:
            raise ValueError("Projeto excede o limite de 16 MiB")

        try:
            data = json.loads(target.read_text(encoding="utf-8"))
        except (UnicodeError, json.JSONDecodeError) as error:
            raise ValueError("Arquivo .vforge não contém JSON UTF-8 válido") from error

        project = self.open_project(data)
        self.project_path = str(target.resolve())
        self.editor_state.remember(str(target), self.metadata["name"])

        return project

    def open_recent(self, path: str) -> dict:
        recents = self.editor_state.recents()

        if not any(item["path"] == path for item in recents):
            raise ValueError("Projeto não está na lista de recentes")

        try:
            project = self.open_project_file(path)
        except OSError as error:
            raise ValueError("Projeto recente indisponível; o arquivo pode ter sido movido") from error

        return project

    def create_node(
        self,
        node_type: str,
        properties: dict | None = None,
        position: dict | None = None,
    ) -> Node:
        before = self.get_project()
        values = default_properties(node_type)

        if properties is not None:
            if not isinstance(properties, dict):
                raise ValueError("Propriedades devem ser um objeto")

            values.update(properties)

        if node_type == "branch":
            values["condition"] = normalize_condition(values["condition"])

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

        self.history.record("Create node", before, self.get_project())

        return node

    def update_node_position(
        self,
        node_id: str,
        position: dict,
    ) -> Node:
        node = self.update_node(node_id, {"position": position})

        return node

    def update_node(
        self,
        node_id: str,
        changes: dict,
    ) -> Node:
        before = self.get_project()
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

        self.history.record("Update node", before, self.get_project())

        return node

    def delete_node(self, node_id: str) -> None:
        before = self.get_project()

        self.graph.remove_node(node_id)
        self.history.record("Delete node", before, self.get_project())

    def get_node_types(self) -> dict:
        return NODE_TYPES

    def get_node(self, node_id: str) -> dict:
        self.graph.get_node(node_id)
        graph = self.get_graph()
        node = next(node for node in graph["nodes"] if node["id"] == node_id)

        return node

    def get_graph(self) -> dict:
        return self.graph.to_dict()

    def reconnect_connection(self, connection_id: str, changes: dict) -> Connection:
        before = self.get_project()
        connection = self.graph.reconnect(connection_id, changes)
        self.history.record("Reconnect connection", before, self.get_project())

        return connection

    def delete_connection(self, connection_id: str) -> None:
        before = self.get_project()

        self.graph.disconnect(connection_id)
        self.history.record("Delete connection", before, self.get_project())

    def create_connection(
        self,
        source_node_id: str,
        source_port: str,
        target_node_id: str,
        target_port: str,
    ) -> Connection:
        before = self.get_project()
        connection = Connection(
            id=f"connection_{uuid4().hex}",
            source_node_id=source_node_id,
            source_port=source_port,
            target_node_id=target_node_id,
            target_port=target_port,
        )

        self.graph.connect(connection)
        self.history.record("Create connection", before, self.get_project())

        return connection

forge_service = ForgeService()