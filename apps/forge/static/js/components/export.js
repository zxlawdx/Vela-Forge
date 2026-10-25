import {exportProject} from "../api.js";
import {downloadFile} from "./project.js";


export function setupExport(refreshGraph, logConsole) {
    for (const button of document.querySelectorAll('[data-action="export"], [data-action="export-to"]')) {
        button.addEventListener("click", async () => {
            const engine = document.querySelector("#vf-engine").value;

            try {
                const result = await exportProject(engine);
                const output = document.querySelector("#vf-generated-code");
                output.textContent = Object.entries(result.files)
                    .map(([name, content]) => `===== ${name} =====\n${content}`)
                    .join("\n\n");
                document.querySelector('[data-tab="generated"]').click();

                if (window.pywebview?.api?.export_forge_project) {
                    const saved = await window.pywebview.api.export_forge_project(engine);

                    if (saved.error) {
                        throw new Error(saved.error);
                    }

                    if (saved.cancelled) {
                        return;
                    }
                } else {
                    const binary = atob(result.archive);
                    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
                    downloadFile(`forge-${engine}.zip`, bytes, "application/zip");
                }

                logConsole(`Export ${engine} gerado.`);
            } catch (error) {
                await refreshGraph();
                document.querySelector('[data-tab="problems"]').click();
                logConsole(`Erro ao exportar: ${error.message}`);
            }
        });
    }
}
