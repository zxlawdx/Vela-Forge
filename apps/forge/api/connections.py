from vela.api import api
from vela.core.http import Request

from apps.forge.services.forge_service import forge_service


@api.post("/forge/connections")
def create_connection(data: dict):
    connection = forge_service.create_connection(
        source_node_id=data["source_node_id"],
        source_port=data["source_port"],
        target_node_id=data["target_node_id"],
        target_port=data["target_port"],
    )

    return {
        "id": connection.id,
        "source_node_id": connection.source_node_id,
        "source_port": connection.source_port,
        "target_node_id": connection.target_node_id,
        "target_port": connection.target_port,
    }

@api.delete("/forge/connections/<connection_id>")
def delete_connection(request: Request):
    connection_id = request.path_params["connection_id"]

    forge_service.delete_connection(connection_id)

    return {"deleted": connection_id}
