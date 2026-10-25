import {renderAssetPreview} from "./preview.js";
import {importAsset} from "../api.js";


let selectedAssetId = null;
let currentAssets = [];
let disposePreview = () => {};


export function setupAssets(refreshGraph, logConsole) {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/png,image/jpeg,image/gif,image/webp";
    picker.addEventListener("change", async () => {
        const file = picker.files[0];

        if (!file) {
            return;
        }

        try {
            if (file.size > 2 * 1024 * 1024) {
                throw new Error("Limite de 2 MiB por imagem");
            }

            const data = await readImage(file);
            const asset = await importAsset({name: file.name, mime_type: file.type, data});
            selectedAssetId = asset.id;
            await refreshGraph();
            document.querySelector("#vf-assets").hidden = false;
        } catch (error) {
            logConsole(`Erro ao importar asset: ${error.message}`);
        }

        picker.value = "";
    });

    for (const button of document.querySelectorAll('[data-action="import-to"], [data-action="import-models"]')) {
        button.addEventListener("click", () => picker.click());
    }

    document.querySelector('[data-item-view="assets"]').addEventListener("click", () => {
        const panel = document.querySelector("#vf-assets");
        panel.hidden = !panel.hidden;
    });

    document.querySelector('[data-action="preview-camera-reset"]').addEventListener("click", () => {
        selectedAssetId = null;
        renderAssets(currentAssets);
    });
}


function readImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem"));
        reader.readAsDataURL(file);
    });
}


export function renderAssets(assets) {
    currentAssets = assets;
    const list = document.querySelector("#vf-assets");
    const layer = document.querySelector("#vf-preview-layer");
    const empty = document.querySelector("#vf-preview-empty");
    disposePreview();
    list.replaceChildren();
    layer.replaceChildren();
    empty.hidden = false;
    empty.style.display = "";

    if (!assets.length) {
        list.textContent = "Nenhum asset. Use Import To para adicionar uma imagem.";
    }

    for (const asset of assets) {
        const button = document.createElement("button");
        button.textContent = asset.name;
        button.addEventListener("click", () => {
            selectedAssetId = asset.id;
            renderAssets(assets);
        });
        list.appendChild(button);
    }

    const selected = assets.find(asset => asset.id === selectedAssetId);

    if (!selected) {
        selectedAssetId = null;
        return;
    }

    disposePreview = renderAssetPreview(layer, selected);
    empty.style.display = "none";
}
