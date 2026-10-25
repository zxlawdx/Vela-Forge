import base64

import pytest

from apps.forge.services.forge_service import ForgeService


PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII="


def test_image_asset_survives_round_trip(tmp_path):
    service = ForgeService()
    asset = service.import_asset("pixel.png", "image/png", PNG)
    path = tmp_path / "assets.vforge"
    service.save_project_file(str(path))
    loaded = ForgeService()
    loaded.open_project_file(str(path))

    assert loaded.assets[asset.id].data == PNG
    assert loaded.list_assets() == service.list_assets()

    data = loaded.get_project()
    data["assets"][0]["data"] = None
    loaded.open_project(data)

    assert any(problem["code"] == "missing_asset" for problem in loaded.validate())


@pytest.mark.parametrize("mime,data", [
    ("image/svg+xml", PNG),
    ([], PNG),
    ("image/png", "broken"),
    ("image/png", base64.b64encode(b"not a PNG").decode()),
])
def test_invalid_image_keeps_assets_empty(mime, data):
    service = ForgeService()

    with pytest.raises(ValueError):
        service.import_asset("image", mime, data)

    assert service.assets == {}
