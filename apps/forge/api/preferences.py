from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.get("/forge/preferences")
def get_preferences():
    return forge_service.editor_state.preferences()


@api.patch("/forge/preferences")
def update_preferences(request: Request):
    return forge_service.editor_state.update_preferences(request.json)


@api.get("/forge/recents")
def recent_projects():
    return forge_service.editor_state.recents()


@api.post("/forge/recents/open")
def open_recent(request: Request):
    return forge_service.open_recent(request.json.get("path"))


@api.delete("/forge/editor-state")
def reset_editor_state():
    forge_service.editor_state.reset()

    return {"reset": True}
