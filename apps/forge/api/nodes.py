from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.post("/forge/nodes")
def create_node(data: dict):
    return forge_service.create_node(
        node_type=data["type"],
        properties=data.get("properties"),
    )


@api.delete("/forge/nodes/<node_id>")
def delete_node(request: Request):
    node_id = request.path_params["node_id"]

    forge_service.graph.remove_node(node_id)

    return {
        "deleted": node_id
    }