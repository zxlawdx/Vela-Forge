from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.post("/forge/nodes")
def create_node(data: dict):
    node = forge_service.create_node(
        node_type=data["type"],
        properties=data.get("properties"),
    )


    return forge_service.get_node(node.id)


@api.delete("/forge/nodes/<node_id>")
def delete_node(request: Request):
    node_id = request.path_params["node_id"]

    forge_service.delete_node(node_id)

    return {
        "deleted": node_id
    }

@api.patch("/forge/nodes/<node_id>")
def update_node(request: Request):
    data = request.json
    node_id = request.path_params["node_id"]

    node = forge_service.update_node(
        node_id,
        data,
    )

    return forge_service.get_node(node.id)


@api.get("/forge/node-types")
def get_node_types():
    return forge_service.get_node_types()
