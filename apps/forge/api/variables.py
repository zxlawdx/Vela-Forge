from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.get("/forge/variables")
def list_variables():
    return forge_service.list_variables()


@api.post("/forge/variables")
def create_variable(request: Request):
    data = request.json

    return forge_service.create_variable(data.get("name"), data.get("type"), data.get("default"))


@api.delete("/forge/variables/<name>")
def delete_variable(request: Request):
    name = request.path_params["name"]
    forge_service.delete_variable(name)

    return {"deleted": name}
