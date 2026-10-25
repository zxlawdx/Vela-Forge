import {
    getPreferences,
    updatePreferences,
    getRecents,
    openRecent,
    resetEditorState,
} from "../api.js";


function applyPreferences(preferences) {
    document.querySelector("#vf-engine").value = preferences.target;
    document.querySelector(".vf-preview-grid").style.display = preferences.show_grid ? "" : "none";
}


export async function setupPreferences(refreshGraph, logConsole) {
    const dialog = document.createElement("dialog");
    dialog.className = "vf-settings-dialog";
    document.querySelector("#vela-forge").appendChild(dialog);

    async function loadPreferences() {
        applyPreferences(await getPreferences());
    }

    await loadPreferences();

    document.querySelector("#vf-engine").addEventListener("change", async (event) => {
        try {
            await updatePreferences({target: event.target.value});
        } catch (error) {
            logConsole(`Erro ao salvar target: ${error.message}`);
            await loadPreferences();
        }
    });

    document.addEventListener("click", async (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;

        if (!["recent-projects", "configuration"].includes(action)) {
            return;
        }

        try {
            dialog.replaceChildren();
            const close = document.createElement("button");
            close.textContent = "Fechar";
            close.addEventListener("click", () => dialog.close());
            dialog.appendChild(close);

            if (action === "recent-projects") {
                const recents = await getRecents();

                if (!recents.length) {
                    const empty = document.createElement("p");
                    empty.textContent = "Nenhum projeto recente. Abra ou salve um .vforge pelo diálogo nativo.";
                    dialog.appendChild(empty);
                }

                for (const recent of recents) {
                    const button = document.createElement("button");
                    button.textContent = `${recent.name} — ${recent.path}`;
                    button.addEventListener("click", async () => {
                        if (!window.confirm("Abrir este projeto e substituir o atual?")) {
                            return;
                        }

                        try {
                            await openRecent(recent.path);
                            await refreshGraph();
                            dialog.close();
                        } catch (error) {
                            logConsole(`Erro ao abrir recente: ${error.message}`);
                        }
                    });
                    dialog.appendChild(button);
                }
            } else {
                const preferences = await getPreferences();
                const label = document.createElement("label");
                const grid = document.createElement("input");
                grid.type = "checkbox";
                grid.checked = preferences.show_grid;
                label.append(grid, "Mostrar grade do Scene Preview");
                dialog.appendChild(label);
                grid.addEventListener("change", async () => {
                    try {
                        applyPreferences(await updatePreferences({show_grid: grid.checked}));
                    } catch (error) {
                        logConsole(`Erro ao salvar preferência: ${error.message}`);
                    }
                });

                const reset = document.createElement("button");
                reset.textContent = "Limpar recentes e restaurar preferências";
                reset.addEventListener("click", async () => {
                    if (window.confirm("Limpar apenas os dados locais do editor?")) {
                        try {
                            await resetEditorState();
                            await loadPreferences();
                            dialog.close();
                        } catch (error) {
                            logConsole(`Erro ao restaurar preferências: ${error.message}`);
                        }
                    }
                });
                dialog.appendChild(reset);
            }

            dialog.showModal();
        } catch (error) {
            logConsole(`Erro nas preferências: ${error.message}`);
        }
    });
}
