from vela.api import api

from apps.forge.services.forge_service import forge_service


@api.get("/forge/history")
def history_status():
    return forge_service.history.status()


@api.post("/forge/history/undo")
def undo():
    return forge_service.undo()


@api.post("/forge/history/redo")
def redo():
    return forge_service.redo()
