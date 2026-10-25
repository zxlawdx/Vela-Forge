"""Small, explicit Python surface used by the starter's JavaScript."""

from __future__ import annotations

import os
import subprocess
import sys
import webbrowser
from pathlib import Path

from vela.core.bridge import BaseBridge

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STARTER_LINKS = {
    "docs": "https://github.com/zxlawdx/Vela-framework/tree/main/docs",
    "examples": "https://github.com/zxlawdx/Vela-framework/blob/main/docs/API.md",
}


class StarterBridge(BaseBridge):
    """Expose only fixed actions; never accept paths or commands from JS."""

    def increment_counter(self, value: int) -> int:
        """Return an incremented value, rejecting malformed bridge input."""
        if type(value) is not int or not 0 <= value < 1_000_000:
            raise ValueError("O contador deve ser um inteiro entre 0 e 999999.")
        return value + 1

    def starter_action(self, action: str) -> dict[str, object]:
        """Open a fixed reference link or this project's own directory."""
        if not isinstance(action, str) or action not in (*STARTER_LINKS, "project"):
            return {"ok": False, "error": "Ação desconhecida."}
        try:
            if action in STARTER_LINKS:
                if not webbrowser.open(STARTER_LINKS[action], new=2):
                    return {"ok": False, "error": "Não foi possível abrir o navegador."}
            elif sys.platform.startswith("win"):
                os.startfile(str(PROJECT_ROOT))
            else:
                command = "open" if sys.platform == "darwin" else "xdg-open"
                subprocess.Popen(
                    [command, str(PROJECT_ROOT)],
                    shell=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            return {"ok": True}
        except (OSError, webbrowser.Error) as exc:
            self.logger.warning(f"Falha na ação do starter {action}: {exc}")
            return {"ok": False, "error": "Não foi possível abrir o recurso neste ambiente."}


    def save_forge_project(self, save_as: bool = False) -> dict:
        import webview
        from apps.forge.services.forge_service import forge_service

        if type(save_as) is not bool:
            return {"error": "save_as deve ser booleano"}

        try:
            path = forge_service.project_path

            if save_as or path is None:
                selected = webview.windows[0].create_file_dialog(
                    webview.FileDialog.SAVE,
                    save_filename=Path(path).name if path else "project.vforge",
                    file_types=("Vela Forge (*.vforge)",),
                )

                if not selected:
                    return {"cancelled": True}

                path = selected if isinstance(selected, str) else selected[0]

                if not path.lower().endswith(".vforge"):
                    path += ".vforge"

            forge_service.save_project_file(path)

            return {"ok": True}
        except (OSError, ValueError) as error:
            return {"error": str(error)}

    def open_forge_project(self) -> dict:
        import webview
        from apps.forge.services.forge_service import forge_service

        try:
            selected = webview.windows[0].create_file_dialog(
                webview.FileDialog.OPEN,
                allow_multiple=False,
                file_types=("Vela Forge (*.vforge)",),
            )

            if not selected:
                return {"cancelled": True}

            path = selected if isinstance(selected, str) else selected[0]
            forge_service.open_project_file(path)

            return {"ok": True}
        except (OSError, ValueError) as error:
            return {"error": str(error)}


    def export_forge_project(self, engine: str) -> dict:
        import webview
        from apps.forge.services.forge_service import forge_service

        try:
            selected = webview.windows[0].create_file_dialog(webview.FileDialog.FOLDER)

            if not selected:
                return {"cancelled": True}

            path = selected if isinstance(selected, str) else selected[0]
            forge_service.export_directory(engine, path)

            return {"ok": True}
        except (OSError, ValueError) as error:
            return {"error": str(error)}
