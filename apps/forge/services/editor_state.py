from pathlib import Path
import time

from vela.database import SQLiteStore


DEFAULT_PREFERENCES = {"target": "godot", "show_grid": True}


class EditorState:
    def __init__(self, database=None):
        self.store = SQLiteStore("vela-forge", database=database)

    def _connect(self):
        connection = self.store.connect()
        connection.execute(
            "CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
        )
        connection.execute(
            "CREATE TABLE IF NOT EXISTS recent_projects ("
            "path TEXT PRIMARY KEY, name TEXT NOT NULL, opened_at INTEGER NOT NULL)"
        )

        return connection

    def preferences(self) -> dict:
        preferences = DEFAULT_PREFERENCES.copy()

        with self._connect() as connection:
            rows = connection.execute("SELECT key, value FROM preferences").fetchall()

        for row in rows:
            if row["key"] == "show_grid":
                preferences["show_grid"] = row["value"] == "true"
            elif row["key"] in {"target", "last_project"}:
                preferences[row["key"]] = row["value"]

        return preferences

    def update_preferences(self, changes: dict) -> dict:
        if not isinstance(changes, dict) or set(changes) - set(DEFAULT_PREFERENCES):
            raise ValueError("Preferência não suportada")

        if "target" in changes and (
            not isinstance(changes["target"], str)
            or changes["target"] not in {"godot", "unity"}
        ):
            raise ValueError("Target deve ser godot ou unity")

        if "show_grid" in changes and type(changes["show_grid"]) is not bool:
            raise ValueError("show_grid deve ser booleano")

        with self._connect() as connection:
            for key, value in changes.items():
                encoded = str(value).lower() if isinstance(value, bool) else value
                connection.execute(
                    "INSERT INTO preferences(key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (key, encoded),
                )

        return self.preferences()

    def remember(self, path: str, name: str) -> None:
        path = str(Path(path).resolve())

        with self._connect() as connection:
            connection.execute(
                "INSERT INTO recent_projects(path, name, opened_at) VALUES (?, ?, ?) "
                "ON CONFLICT(path) DO UPDATE SET name=excluded.name, opened_at=excluded.opened_at",
                (path, name, time.time_ns()),
            )
            connection.execute(
                "DELETE FROM recent_projects WHERE path NOT IN "
                "(SELECT path FROM recent_projects ORDER BY opened_at DESC LIMIT 20)"
            )
            connection.execute(
                "INSERT INTO preferences(key, value) VALUES ('last_project', ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (path,),
            )

    def recents(self) -> list[dict]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT path, name, opened_at FROM recent_projects ORDER BY opened_at DESC"
            ).fetchall()

        return [dict(row) for row in rows]

    def reset(self) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM preferences")
            connection.execute("DELETE FROM recent_projects")
