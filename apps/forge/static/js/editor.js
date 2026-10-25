import {setupPreferences} from "./components/preferences.js";
import {setupExport} from "./components/export.js";
import {setupHistory, renderHistory} from "./components/history.js";
import {setupAssets, renderAssets} from "./components/assets.js";
import {setupEvents, renderEvents} from "./components/events.js";
import {renderProblems} from "./components/problems.js";
import {setupProjectActions} from "./components/project.js";
import {
    getGraph,
    createNode,
    deleteNode,
    deleteConnection,
    createConnection,
    reconnectConnection,
    updateNode,
    getProject,
    getProblems,
    getEvents,
    getAssets,
    getHistory,
} from "./api.js";


import {
    state,
    setGraph,
} from "./state.js";


import {
    setupCanvas,
    renderGraph,
} from "./components/canvas.js";


import {
    setupTabs,
} from "./components/tabs.js";


import {
    renderInspector,
} from "./components/inspector.js";


import {
    setupWorkspace,
} from "./components/workspace.js";


/* =========================================================
   BOOTSTRAP
   ========================================================= */

async function bootstrap() {
    setupWorkspace();

    setupTabs();
    setupCanvas();

    setupCreateNode();
    setupNodeLibrary();

    document.addEventListener("forge:node-drop", async (event) => {
        await createNodeByType(event.detail.type, event.detail.position);
    });
    setupDeleteNode();
    setupRefresh();

    setupConnectionCreation();

    document.addEventListener("forge:connection-reconnect", async (event) => {
        try {
            await reconnectConnection(event.detail.connectionId, event.detail.changes);
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro ao reconectar: ${error.message}`);
        }
    });
    setupConnectionDeletion();
    setupNodeMovement();
    setupPropertyEditing();
    setupProjectActions(refreshGraph, logConsole);
    setupEvents(refreshGraph, logConsole);
    setupAssets(refreshGraph, logConsole);
    setupHistory(refreshGraph, logConsole);
    setupExport(refreshGraph, logConsole);
    await setupPreferences(refreshGraph, logConsole);

    document.querySelector("#vf-preview-project").addEventListener("click", async () => {
        try {
            const problems = await getProblems();
            renderProblems(problems);

            if (problems.some(problem => problem.severity === "error")) {
                document.querySelector('[data-tab="problems"]').click();
                logConsole("Corrija os erros em Problems antes do preview/export.");
            } else {
                logConsole("Graph válido. Selecione um asset para visualizar no Scene Preview.");
            }
        } catch (error) {
            logConsole(`Erro na validação: ${error.message}`);
        }
    });

    await refreshGraph();

    renderInspector();

    logConsole(
        "Vela Forge iniciado."
    );
}


/* =========================================================
   GRAPH
   ========================================================= */

async function refreshGraph() {
    try {
        const graph =
            await getGraph();

        console.log(
            "[Forge] Graph recebido:",
            graph
        );

        setGraph(graph);

        renderGraph();

        state.events = await getEvents();
        renderEvents(state.events);
        renderAssets(await getAssets());
        renderHistory(await getHistory());
        renderInspector();

        renderForgeIR();

        updateStatusBar();

        const problems = await getProblems();
        renderProblems(problems);

        const project = await getProject();
        document.querySelector("#vf-project-name").textContent = project.metadata.name;

    } catch (error) {
        console.error(
            "[Forge] Erro ao carregar graph:",
            error
        );

        logConsole(
            `Erro ao carregar graph: ${error.message}`
        );
    }
}


/* =========================================================
   CREATE NODE BUTTON
   ========================================================= */

function setupCreateNode() {
    document
        .querySelector(
            "#vf-create-node"
        )
        ?.addEventListener(
            "click",
            async () => {
                await createNodeByType(
                    "dialogue"
                );
            }
        );
}


/* =========================================================
   NODE LIBRARY
   ========================================================= */

function setupNodeLibrary() {
    const nodes =
        document.querySelectorAll(
            ".vf-library-node[data-type]"
        );


    nodes.forEach((item) => {
        item.draggable = true;

        item.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("application/x-forge-node", item.dataset.type);
            event.dataTransfer.effectAllowed = "copy";
        });

        item.addEventListener(
            "dblclick",
            async () => {
                await createNodeByType(
                    item.dataset.type
                );
            }
        );
    });


    /*
     * Search
     */
    const search =
        document.querySelector(
            "#vf-node-search"
        );


    search?.addEventListener(
        "input",
        () => {
            const query =
                search.value
                    .trim()
                    .toLowerCase();


            nodes.forEach((node) => {
                const name =
                    (
                        node.dataset.name ??
                        node.dataset.type ??
                        ""
                    )
                    .toLowerCase();


                node.style.display =
                    name.includes(query)
                        ? ""
                        : "none";
            });
        }
    );
}


/* =========================================================
   CREATE NODE
   ========================================================= */

async function createNodeByType(
    type,
    position = null
) {
    try {
        const node =
            await createNode(
                type,
                {},
                position
            );


        console.log(
            "[Forge] Node criado:",
            node
        );


        logConsole(
            `Node criado: ${node.id}`
        );


        await refreshGraph();

    } catch (error) {
        console.error(
            "[Forge] Erro ao criar node:",
            error
        );


        logConsole(
            `Erro ao criar node: ${error.message}`
        );
    }
}


/* =========================================================
   DELETE NODE
   ========================================================= */

function setupDeleteNode() {
    document.querySelector("#vf-delete-node")?.addEventListener("click", deleteSelectedNode);
    document.addEventListener("forge:node-delete-request", deleteSelectedNode);
}


async function deleteSelectedNode() {
    const nodeId = state.selectedNodeId;

    if (!nodeId) {
        logConsole("Nenhum node selecionado.");
        return;
    }

    try {
        await deleteNode(nodeId);
        state.selectedNodeId = null;
        logConsole(`Node removido: ${nodeId}`);
        await refreshGraph();
    } catch (error) {
        logConsole(`Erro ao remover node: ${error.message}`);
    }
}


/* =========================================================
   REFRESH
   ========================================================= */

function setupRefresh() {
    document
        .querySelector(
            "#vf-refresh-graph"
        )
        ?.addEventListener(
            "click",
            refreshGraph
        );
}


/* =========================================================
   CREATE CONNECTION
   ========================================================= */

function setupConnectionCreation() {
    document.addEventListener(
        "forge:connection-request",
        async (event) => {
            const {
                sourceNodeId,
                sourcePort,
                targetNodeId,
                targetPort,
            } = event.detail;


            console.log(
                "[Forge] Pedido de connection:",
                {
                    sourceNodeId,
                    sourcePort,
                    targetNodeId,
                    targetPort,
                }
            );


            logConsole(
                `Conectando ${sourceNodeId}:${sourcePort} → ${targetNodeId}:${targetPort}`
            );


            try {
                const connection =
                    await createConnection(
                        sourceNodeId,
                        sourcePort,
                        targetNodeId,
                        targetPort
                    );


                console.log(
                    "[Forge] Connection criada:",
                    connection
                );


                logConsole(
                    `Connection criada: ${connection.id}`
                );


                /*
                 * Busca novamente o Graph
                 * no backend.
                 *
                 * Se o Graph.connect() armazenou,
                 * ela volta aqui e o canvas desenha
                 * permanentemente.
                 */
                await refreshGraph();

            } catch (error) {
                console.error(
                    "[Forge] Erro ao criar connection:",
                    error
                );


                logConsole(
                    `Erro ao conectar: ${error.message}`
                );
            }
        }
    );
}


/* =========================================================
   FORGE IR
   ========================================================= */

function renderForgeIR() {
    const output =
        document.querySelector(
            "#vf-ir-output"
        );


    if (!output) {
        return;
    }


    output.textContent =
        JSON.stringify(
            state.graph,
            null,
            2
        );
}


/* =========================================================
   STATUS BAR
   ========================================================= */

function updateStatusBar() {
    const nodeCount =
        document.querySelector(
            "#vf-node-count"
        );


    const connectionCount =
        document.querySelector(
            "#vf-connection-count"
        );


    if (nodeCount) {
        nodeCount.textContent =
            `${state.graph.nodes.length} nodes`;
    }


    if (connectionCount) {
        connectionCount.textContent =
            `${state.graph.connections.length} connections`;
    }
}


/* =========================================================
   CONSOLE
   ========================================================= */

function logConsole(
    message
) {
    const consoleOutput =
        document.querySelector(
            "#vf-console"
        );


    /*
     * Sempre manda também pro DevTools.
     */
    console.log(
        `[Forge] ${message}`
    );


    if (!consoleOutput) {
        return;
    }


    const now =
        new Date()
            .toLocaleTimeString();


    /*
     * Evita colar tudo na primeira
     * mensagem sem quebra.
     */
    if (
        consoleOutput.textContent &&
        !consoleOutput.textContent.endsWith(
            "\n"
        )
    ) {
        consoleOutput.textContent +=
            "\n";
    }


    consoleOutput.textContent +=
        `[${now}] ${message}\n`;


    consoleOutput.scrollTop =
        consoleOutput.scrollHeight;
}


/* =========================================================
   DEFAULT NODE PROPERTIES
   ========================================================= */

/* =========================================================
   START
   ========================================================= */

bootstrap();

function setupNodeMovement() {
    document.addEventListener(
        "forge:node-moved",
        async (event) => {
            const {nodeId, position} = event.detail;

            try {
                await updateNode(nodeId, {position});
            } catch (error) {
                logConsole(`Erro ao mover node: ${error.message}`);
            }

            await refreshGraph();
        }
    );
}


function setupPropertyEditing() {
    document.addEventListener("forge:error", (event) => {
        logConsole(event.detail);
    });

    document.addEventListener(
        "forge:node-properties-request",
        async (event) => {
            const {nodeId, properties} = event.detail;

            try {
                await updateNode(nodeId, {properties});
                await refreshGraph();
            } catch (error) {
                logConsole(`Erro ao editar node: ${error.message}`);
            }
        }
    );
}


function setupConnectionDeletion() {
    document.addEventListener("keydown", async (event) => {
        if (
            !["Delete", "Backspace"].includes(event.key) ||
            event.target.closest("input, textarea, select, [contenteditable]") ||
            !state.selectedConnectionId
        ) {
            return;
        }

        event.preventDefault();

        try {
            await deleteConnection(state.selectedConnectionId);
            state.selectedConnectionId = null;
            await refreshGraph();
        } catch (error) {
            logConsole(`Erro ao remover connection: ${error.message}`);
        }
    });
}
