import {changeHistory} from "../api.js";


export function setupHistory(refreshGraph, logConsole) {
    async function apply(action) {
        try {
            await changeHistory(action);
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro no histórico: ${error.message}`);
        }
    }

    for (const button of document.querySelectorAll("[data-history]")) {
        button.addEventListener("click", () => apply(button.dataset.history));
    }

    document.addEventListener("keydown", (event) => {
        if (
            !(event.ctrlKey || event.metaKey) ||
            event.altKey ||
            event.target.closest("input, textarea, select, [contenteditable]")
        ) {
            return;
        }

        const key = event.key.toLowerCase();
        let action = null;

        if (key === "z") {
            action = event.shiftKey ? "redo" : "undo";
        } else if (key === "y") {
            action = "redo";
        }

        if (action) {
            event.preventDefault();
            const button = document.querySelector(`[data-history="${action}"]`);

            if (!button.disabled) {
                apply(action);
            }
        }
    });
}


export function renderHistory(history) {
    for (const action of ["undo", "redo"]) {
        const button = document.querySelector(`[data-history="${action}"]`);
        button.disabled = !history[`can_${action}`];
        button.title = history[`${action}_name`] ?? "Histórico vazio";
    }
}
