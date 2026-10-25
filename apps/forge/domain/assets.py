import base64
import binascii
from dataclasses import dataclass


MAX_ASSET_BYTES = 2 * 1024 * 1024
IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}


@dataclass(slots=True)
class Asset:
    id: str
    name: str
    mime_type: str
    data: str | None


def validate_asset(asset: Asset) -> int:
    if not isinstance(asset.name, str) or not asset.name.strip() or len(asset.name) > 255:
        raise ValueError("Nome de asset inválido")

    if not isinstance(asset.mime_type, str) or asset.mime_type not in IMAGE_TYPES:
        raise ValueError("Preview inicial aceita PNG, JPEG, GIF e WebP")

    if asset.data is None:
        return 0

    if not isinstance(asset.data, str) or len(asset.data) > MAX_ASSET_BYTES * 4 // 3 + 4:
        raise ValueError("Asset excede o limite de 2 MiB")

    try:
        content = base64.b64decode(asset.data, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("Dados base64 do asset inválidos") from error

    signatures = {
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/gif": content.startswith((b"GIF87a", b"GIF89a")),
        "image/webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
    }

    if not content or len(content) > MAX_ASSET_BYTES or not signatures[asset.mime_type]:
        raise ValueError("Conteúdo de imagem inválido ou maior que 2 MiB")

    return len(content)
