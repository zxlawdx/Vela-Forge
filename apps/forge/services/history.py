from dataclasses import dataclass


@dataclass(slots=True)
class Command:
    name: str
    before: dict
    after: dict


class CommandHistory:
    def __init__(self, limit: int = 50):
        self.limit = limit
        self.undo_commands = []
        self.redo_commands = []

    def record(self, name: str, before: dict, after: dict) -> None:
        if before == after:
            return

        command = Command(name, before, after)
        self.undo_commands.append(command)
        self.undo_commands = self.undo_commands[-self.limit:]
        self.redo_commands.clear()

    def undo(self) -> dict:
        if not self.undo_commands:
            raise ValueError("Nada para desfazer")

        command = self.undo_commands.pop()
        self.redo_commands.append(command)

        return command.before

    def redo(self) -> dict:
        if not self.redo_commands:
            raise ValueError("Nada para refazer")

        command = self.redo_commands.pop()
        self.undo_commands.append(command)

        return command.after

    def clear(self) -> None:
        self.undo_commands.clear()
        self.redo_commands.clear()

    def status(self) -> dict:
        return {
            "can_undo": bool(self.undo_commands),
            "can_redo": bool(self.redo_commands),
            "undo_name": self.undo_commands[-1].name if self.undo_commands else None,
            "redo_name": self.redo_commands[-1].name if self.redo_commands else None,
        }
