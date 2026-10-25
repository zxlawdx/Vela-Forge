function renderImage(layer, asset) {
    const image = document.createElement("img");
    image.alt = asset.name;
    image.className = "vf-asset-preview";
    image.src = `data:${asset.mime_type};base64,${asset.data}`;
    image.onerror = () => {
        layer.textContent = `Não foi possível decodificar a imagem: ${asset.name}`;
    };
    layer.dataset.renderer = "image";
    layer.appendChild(image);

    return () => {
        image.onerror = null;
        image.remove();
    };
}


export const previewRenderers = {
    "image/png": renderImage,
    "image/jpeg": renderImage,
    "image/gif": renderImage,
    "image/webp": renderImage,
};


export function renderAssetPreview(layer, asset) {
    layer.replaceChildren();
    delete layer.dataset.renderer;

    if (!asset.data) {
        layer.textContent = `Asset indisponível: ${asset.name}`;
        return () => {};
    }

    const renderer = previewRenderers[asset.mime_type];

    if (!renderer) {
        layer.textContent = `Preview não suportado: ${asset.mime_type}`;
        return () => {};
    }

    return renderer(layer, asset);
}
