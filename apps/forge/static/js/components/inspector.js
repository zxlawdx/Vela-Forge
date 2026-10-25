import {
    getSelectedNode,
} from "../state.js";


export function renderInspector() {
    const inspector = document.querySelector(
        "#forge-inspector"
    );

    if (!inspector) {
        return;
    }

    const node = getSelectedNode();

    if (!node) {
        inspector.innerHTML = `
            <div class="inspector-empty">
                <span>Nenhum node selecionado</span>
            </div>
        `;

        return;
    }

    inspector.innerHTML = `
        <div class="inspector-title">
            <span class="big-dot"></span>

            <div>
                <strong>${escapeHtml(node.type)}</strong>

                <div class="inspector-node-id">
                    ${escapeHtml(node.id)}
                </div>
            </div>
        </div>

        <div class="section-title">
            Properties
        </div>

        <div id="inspector-properties">
            ${renderProperties(node.properties)}
        </div>

        <div class="section-title">
            Metadata
        </div>

        <div class="field">
            <label>ID</label>

            <input
                value="${escapeHtml(node.id)}"
                disabled
            >
        </div>

        <div class="field">
            <label>Type</label>

            <input
                value="${escapeHtml(node.type)}"
                disabled
            >
        </div>
    `;
}


function renderProperties(properties = {}) {
    const entries = Object.entries(properties);

    if (entries.length === 0) {
        return `
            <div class="inspector-empty">
                Sem propriedades.
            </div>
        `;
    }

    return entries
        .map(([key, value]) => {
            if (
                typeof value === "string" &&
                value.length > 60
            ) {
                return `
                    <div class="field">
                        <label>${escapeHtml(key)}</label>

                        <textarea disabled>${escapeHtml(
                            value
                        )}</textarea>
                    </div>
                `;
            }

            return `
                <div class="field">
                    <label>${escapeHtml(key)}</label>

                    <input
                        value="${escapeHtml(
                            stringifyValue(value)
                        )}"
                        disabled
                    >
                </div>
            `;
        })
        .join("");
}


function stringifyValue(value) {
    if (
        typeof value === "object" &&
        value !== null
    ) {
        return JSON.stringify(value);
    }

    return String(value ?? "");
}


function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}