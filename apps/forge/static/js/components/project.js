import {getProject, openProject, newProject, renameProject} from "../api.js";


export function setupProjectActions(refreshGraph, logConsole) {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".vforge";

    picker.addEventListener("change", async () => {
        const file = picker.files[0];

        if (!file) {
            return;
        }

        try {
            if (file.size > 16 * 1024 * 1024) {
                throw new Error("Projeto excede o limite de 16 MiB");
            }

            const project = JSON.parse(await file.text());
            await openProject(project);
            await refreshGraph();
            logConsole(`Projeto aberto: ${file.name}`);
        } catch (error) {
            logConsole(`Erro ao abrir projeto: ${error.message}`);
        }

        picker.value = "";
    });

    document.addEventListener("click", async (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;

        if (!["save-project", "save-project-as", "open-project", "new-project"].includes(action)) {
            return;
        }

        try {
            if (action === "new-project") {
                if (!window.confirm("Descartar o projeto atual e criar um novo?")) {
                    return;
                }

                await newProject();
            }

            if (action === "open-project") {
                if (!window.confirm("Abrir outro projeto e substituir o atual?")) {
                    return;
                }

                if (window.pywebview?.api?.open_forge_project) {
                    const result = await window.pywebview.api.open_forge_project();

                    if (result.error) {
                        throw new Error(result.error);
                    }

                    if (result.cancelled) {
                        return;
                    }
                } else {
                    picker.click();
                    return;
                }
            }

            if (action === "save-project" || action === "save-project-as") {
                if (window.pywebview?.api?.save_forge_project) {
                    const result = await window.pywebview.api.save_forge_project(
                        action === "save-project-as"
                    );

                    if (result.error) {
                        throw new Error(result.error);
                    }

                    if (result.cancelled) {
                        return;
                    }
                } else {
                    const current = await getProject();
                    const name = window.prompt("Nome do projeto", current.metadata.name);

                    if (name === null) {
                        return;
                    }

                    const project = await renameProject(name);
                    downloadFile(`${name.replace(/[^a-z0-9_-]/gi, "_")}.vforge`,
                        JSON.stringify(project, null, 2), "application/json");
                }

                logConsole("Projeto salvo.");
            }

            await refreshGraph();
        } catch (error) {
            logConsole(`Erro no projeto: ${error.message}`);
        }
    });
}


export function downloadFile(name, content, type = "text/plain") {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
