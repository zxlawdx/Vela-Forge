import {
    getSelectedNode,
} from "../state.js";


export function renderInspector() {
    const inspector = document.querySelector(
        "#vf-inspector"
    );

    if (!inspector) {
        return;
    }

    const node = getSelectedNode();

    if (!node) {
        inspector.innerHTML = `
            <div class="vf-inspector-empty">
                <span>Nenhum node selecionado</span>
            </div>
        `;

        return;
    }

    inspector.innerHTML = `
        <form id="vf-node-properties-form">
        <div class="vf-inspector-title">
            <span class="vf-big-dot"></span>

            <div>
                <strong>${escapeHtml(node.type)}</strong>

                <div class="vf-inspector-node-id">
                    ${escapeHtml(node.id)}
                </div>
            </div>
        </div>

        <div class="vf-section-title">
            Properties
        </div>

        <div id="vf-inspector-properties">
            ${renderProperties(node.properties)}
        </div>

        <button type="submit">Salvar propriedades</button>
        <button type="button" id="vf-inspector-delete">Excluir node</button>
        </form>

        <div class="vf-section-title">
            Metadata
        </div>

        <div class="vf-field">
            <label>ID</label>

            <input
                value="${escapeHtml(node.id)}"
                disabled
            >
        </div>

        <div class="vf-field">
            <label>Type</label>

            <input
                value="${escapeHtml(node.type)}"
                disabled
            >
        </div>
    `;

    inspector.querySelector("form").addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            try {
                const properties = {};
                const fields = inspector.querySelectorAll("[data-property]");

                for (const field of fields) {
                    const key = field.dataset.property;
                    const previous = node.properties[key];

                    properties[key] = typeof previous === "string"
                        ? field.value
                        : JSON.parse(field.value);

                    if (typeof properties[key] !== typeof previous) {
                        throw new Error(`Tipo inválido para ${key}`);
                    }
                }

                document.dispatchEvent(
                    new CustomEvent("forge:node-properties-request", {
                        detail: {nodeId: node.id, properties},
                    })
                );
            } catch (error) {
                document.dispatchEvent(
                    new CustomEvent("forge:error", {
                        detail: error.message,
                    })
                );
            }
        }
    );

    inspector.querySelector("#vf-inspector-delete").addEventListener(
        "click",
        () => {
            document.querySelector("#vf-delete-node")?.click();
        }
    );
}


function renderProperties(properties = {}) {
    const entries = Object.entries(properties);

    if (entries.length === 0) {
        return `
            <div class="vf-inspector-empty">
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
                    <div class="vf-field">
                        <label>${escapeHtml(key)}</label>

                        <textarea data-property="${escapeHtml(key)}">${escapeHtml(
                            value
                        )}</textarea>
                    </div>
                `;
            }

            return `
                <div class="vf-field">
                    <label>${escapeHtml(key)}</label>

                    <input
                        value="${escapeHtml(
                            stringifyValue(value)
                        )}"
                        data-property="${escapeHtml(key)}"
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