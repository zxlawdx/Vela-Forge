from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.get("/forge/assets")
def list_assets():
    return forge_service.list_assets()


@api.post("/forge/assets")
def import_asset(request: Request):
    data = request.json

    return forge_service.import_asset(
        name=data.get("name"),
        mime_type=data.get("mime_type"),
        data=data.get("data"),
    )
