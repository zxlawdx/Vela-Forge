"""Headless test host: real Vela API and Forge view, without desktop GUI."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from vela.api import api
from vela.cli.collectstatic import collect_static
from vela.core.api_server import ApiServer
from vela.core.router import Router

import apps.forge.api
from apps.forge.views.forge import forge_view


collect_static(
    output_dir="staticfiles",
    skip_tailwind=True,
    asset_config={"tailwind": False},
    allow_install=False,
    verbose=False,
)
server = ApiServer(api.new_router(), port=8765, docs_enabled=False)
router = Router()
router.base_url = "http://127.0.0.1:8765"


@server.app.get("/")
def index():
    return forge_view({"router": router})


server.start()
print("READY", flush=True)
try:
    input()
finally:
    server.stop()
