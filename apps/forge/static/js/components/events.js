import {createEvent, deleteEvent, renameEvent} from "../api.js";


export function setupEvents(refreshGraph, logConsole) {
    document.querySelector('[data-action="create-event"]').addEventListener("click", async () => {
        const name = window.prompt("Nome do evento");

        if (name === null) {
            return;
        }

        try {
            await createEvent(name);
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro ao criar evento: ${error.message}`);
        }
    });

    document.querySelector("#vf-events").addEventListener("click", async (event) => {
        const rename = event.target.closest("[data-rename-event]");

        if (rename) {
            const name = window.prompt("Novo nome do evento", rename.dataset.name);

            if (name !== null) {
                try {
                    await renameEvent(rename.dataset.renameEvent, name);
                    await refreshGraph();
                } catch (error) {
                    logConsole(`Erro ao renomear evento: ${error.message}`);
                }
            }

            return;
        }

        const eventId = event.target.closest("[data-delete-event]")?.dataset.deleteEvent;

        if (!eventId || !window.confirm("Excluir evento? Referências existentes serão sinalizadas em Problems.")) {
            return;
        }

        try {
            await deleteEvent(eventId);
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro ao excluir evento: ${error.message}`);
        }
    });
}


export function renderEvents(events) {
    const panel = document.querySelector("#vf-events");
    panel.replaceChildren();

    if (!events.length) {
        panel.textContent = "Nenhum evento. Use + Event para criar.";
    }

    for (const event of events) {
        const row = document.createElement("div");
        row.className = "vf-event-row";
        const label = document.createElement("span");
        label.textContent = `${event.name} — ${event.id} — ${event.usages.length} uso(s)`;
        row.appendChild(label);

        for (const nodeId of event.usages) {
            const usage = document.createElement("button");
            usage.textContent = nodeId;
            usage.addEventListener("click", () => {
                document.querySelector('[data-mode="animation"]').click();
                document.dispatchEvent(new CustomEvent("forge:select-node", {detail: nodeId}));
            });
            row.appendChild(usage);
        }

        const rename = document.createElement("button");
        rename.textContent = "Renomear";
        rename.dataset.renameEvent = event.id;
        rename.dataset.name = event.name;
        row.appendChild(rename);

        const remove = document.createElement("button");
        remove.textContent = "Excluir";
        remove.dataset.deleteEvent = event.id;
        row.appendChild(remove);
        panel.appendChild(row);
    }
}
