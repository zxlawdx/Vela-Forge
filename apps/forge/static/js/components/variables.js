import {createVariable, deleteVariable} from "../api.js";


export function setupVariables(refreshGraph, logConsole) {
    const panel = document.querySelector("#vf-variables");
    document.querySelector('[data-item-view="variables"]').addEventListener("click", () => {
        panel.hidden = !panel.hidden;
    });
    panel.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;

        try {
            await createVariable({
                name: form.elements.name.value,
                type: form.elements.type.value,
                default: JSON.parse(form.elements.default.value),
            });
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro na variável: ${error.message}`);
        }
    });
    panel.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-delete-variable]");

        if (!button || !window.confirm("Excluir variável? Usos existentes serão sinalizados em Problems.")) {
            return;
        }

        try {
            await deleteVariable(button.dataset.deleteVariable);
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro ao excluir variável: ${error.message}`);
        }
    });
}


export function renderVariables(variables) {
    const panel = document.querySelector("#vf-variables");
    panel.innerHTML = `
        <form id="vf-variable-form">
            <input name="name" placeholder="Nome da variável" required>
            <select name="type"><option>string</option><option>number</option><option>boolean</option></select>
            <input name="default" placeholder="Valor inicial JSON" value='""' required>
            <button type="submit">Criar variável</button>
        </form>
    `;
    const form = panel.querySelector("form");
    form.elements.type.addEventListener("change", () => {
        form.elements.default.value = {string: '""', number: "0", boolean: "false"}[form.elements.type.value];
    });

    for (const variable of variables) {
        const row = document.createElement("div");
        row.append(document.createTextNode(`${variable.name} (${variable.type}) = ${JSON.stringify(variable.default)}`));
        const remove = document.createElement("button");
        remove.textContent = "Excluir";
        remove.dataset.deleteVariable = variable.name;
        row.appendChild(remove);
        panel.appendChild(row);
    }
}
