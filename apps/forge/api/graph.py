from vela.api import api

from apps.forge.services.forge_service import forge_service



@api.get("/forge/graph")
def get_graph():
    return forge_service.get_graph()

