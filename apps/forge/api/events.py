from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.get("/forge/events")
def list_events():
    return forge_service.list_events()


@api.post("/forge/events")
def create_event(request: Request):
    return forge_service.create_event(request.json.get("name"))


@api.delete("/forge/events/<event_id>")
def delete_event(request: Request):
    event_id = request.path_params["event_id"]
    forge_service.delete_event(event_id)

    return {"deleted": event_id}


@api.patch("/forge/events/<event_id>")
def rename_event(request: Request):
    if not isinstance(request.json, dict):
        raise ValueError("Informe o novo nome do evento")

    return forge_service.rename_event(request.path_params["event_id"], request.json.get("name"))
