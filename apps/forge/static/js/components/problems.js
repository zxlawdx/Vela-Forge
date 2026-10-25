export function renderProblems(problems) {
    const panel = document.querySelector("#vf-problems");
    panel.replaceChildren();
    document.querySelector("#vf-problem-count").textContent = problems.length;

    if (!problems.length) {
        panel.textContent = "Nenhum problema encontrado.";
    }

    for (const problem of problems) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `vf-problem vf-problem--${problem.severity}`;
        item.textContent = `${problem.severity}: ${problem.message}`;
        item.addEventListener("click", () => {
            if (problem.node_id) {
                document.dispatchEvent(new CustomEvent("forge:select-node", {
                    detail: problem.node_id,
                }));
            }
        });
        panel.appendChild(item);
    }
}
