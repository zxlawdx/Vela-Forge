import {
    getSelectedNode,
    state,
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
            ${renderProperties(node.properties, node.type)}
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

                    properties[key] = typeof previous === "string" && !field.hasAttribute("data-json-value")
                        ? field.value
                        : JSON.parse(field.value);

                    if (!field.hasAttribute("data-json-value") && typeof properties[key] !== typeof previous) {
                        throw new Error(`Tipo inválido para ${key}`);
                    }
                }

                if (node.type === "branch") {
                    const variable = inspector.querySelector('[data-condition="variable"]').value;
                    const variableSelect = inspector.querySelector('[data-property="variable"]');

    if (variableSelect) {
        variableSelect.addEventListener("change", () => {
            const variable = state.variables.find(item => item.name === variableSelect.value);

            if (variable) {
                inspector.querySelector('[data-property="value"]').value = JSON.stringify(variable.default);
            }
        });
    }

    const operator = inspector.querySelector('[data-condition="operator"]').value;
                    const field = inspector.querySelector('[data-condition="value"]');
                    properties.condition = {variable, operator, value: field.disabled ? null : JSON.parse(field.value)};
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

    const operator = inspector.querySelector('[data-condition="operator"]');

    if (operator) {
        const updateValueField = () => {
            inspector.querySelector('[data-condition="value"]').disabled = ["truthy", "falsy"].includes(operator.value);
        };
        operator.addEventListener("change", updateValueField);
        updateValueField();
    }

    inspector.querySelector("#vf-inspector-delete").addEventListener(
        "click",
        () => {
            document.dispatchEvent(new CustomEvent("forge:node-delete-request"));
        }
    );
}


function variableOptions(selected) {
    const variables = [...state.variables];

    if (selected && !variables.some(variable => variable.name === selected)) {
        variables.push({name: selected, type: "ausente"});
    }

    return '<option value="">Selecione uma variável</option>' + variables.map(variable => `
        <option value="${escapeHtml(variable.name)}" ${variable.name === selected ? "selected" : ""}>
            ${escapeHtml(variable.name)} (${escapeHtml(variable.type)})
        </option>
    `).join("");
}


function renderProperties(properties = {}, nodeType = "") {
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
            if (nodeType === "branch" && key === "condition") {
                const operators = state.nodeTypes.branch.condition_operators;

                return `
                    <div class="vf-field">
                        <label>Variável</label>
                        <select data-condition="variable">${variableOptions(value.variable)}</select>
                        <label>Comparação</label>
                        <select data-condition="operator">
                            ${Object.entries(operators).map(([name, label]) => `
                                <option value="${name}" ${name === value.operator ? "selected" : ""}>${escapeHtml(label)}</option>
                            `).join("")}
                        </select>
                        <label>Valor (JSON: true, 123, "texto")</label>
                        <input data-condition="value" value="${escapeHtml(JSON.stringify(value.value))}">
                    </div>
                `;
            }

            if (nodeType === "set-variable" && key === "variable") {
                return `<div class="vf-field"><label>Variável</label>
                    <select data-property="variable">${variableOptions(value)}</select></div>`;
            }

            if (nodeType === "set-variable" && key === "value") {
                return `
                    <div class="vf-field">
                        <label>Value (JSON: true, 123, "texto", null...)</label>
                        <textarea data-property="value" data-json-value>${escapeHtml(JSON.stringify(value))}</textarea>
                    </div>
                `;
            }

            if (nodeType === "event" && key === "event") {
                const events = [...state.events];

                if (value && !events.some(event => event.id === value)) {
                    events.push({id: value, name: "Evento ausente"});
                }

                return `
                    <div class="vf-field">
                        <label>Evento</label>
                        <select data-property="event">
                            <option value="">Selecione um evento</option>
                            ${events.map(event => `
                                <option value="${escapeHtml(event.id)}" ${event.id === value ? "selected" : ""}>
                                    ${escapeHtml(event.name)}
                                </option>
                            `).join("")}
                        </select>
                    </div>
                `;
            }

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
    if (value === null) {
        return "null";
    }

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