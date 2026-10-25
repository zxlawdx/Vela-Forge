from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.post("/forge/export/<engine>")
def export_project(request: Request):
    return forge_service.generate_export(request.path_params["engine"])
