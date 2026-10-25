from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.get("/forge/project")
def get_project():
    return forge_service.get_project()


@api.put("/forge/project")
def open_project(request: Request):
    return forge_service.open_project(request.json)


@api.post("/forge/project/new")
def new_project():
    return forge_service.new_project()


@api.patch("/forge/project")
def rename_project(request: Request):
    return forge_service.rename_project(request.json.get("name"))
