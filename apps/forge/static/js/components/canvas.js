import {
    state,
    selectNode,
    setNodePosition,
    getNodePosition,
} from "../state.js";

import {
    renderInspector,
} from "./inspector.js";


let workspace = null;
let world = null;
let nodeLayer = null;
let svg = null;

let draggingNode = null;

let dragOffsetX = 0;
let dragOffsetY = 0;

let panning = false;

let panStartX = 0;
let panStartY = 0;

let panOriginX = 0;
let panOriginY = 0;


/*
 * Connection sendo criada.
 */
let pendingConnection = null;
let previewWire = null;


/* =========================================================
   SETUP
   ========================================================= */

export function setupCanvas() {
    workspace =
        document.querySelector(
            "#vf-workspace"
        );

    world =
        document.querySelector(
            "#vf-world"
        );

    nodeLayer =
        document.querySelector(
            "#vf-node-layer"
        );

    svg =
        document.querySelector(
            "#vf-connections"
        );


    if (
        !workspace ||
        !world ||
        !nodeLayer ||
        !svg
    ) {
        console.error(
            "[Forge] Canvas incompleto:",
            {
                workspace,
                world,
                nodeLayer,
                svg,
            }
        );

        return;
    }


    setupViewportEvents();

    setupZoomControls();

    setupConnectionEvents();

    applyViewport();


    console.log(
        "[Forge] Canvas inicializado."
    );
}


/* =========================================================
   RENDER GRAPH
   ========================================================= */

export function renderGraph() {
    if (
        !nodeLayer ||
        !svg
    ) {
        console.error(
            "[Forge] Canvas ainda não inicializado."
        );

        return;
    }


    console.log(
        "[Forge] Renderizando graph:",
        state.graph
    );


    /*
     * Limpa os nodes.
     */
    nodeLayer.innerHTML = "";


    /*
     * Limpa connections antigas.
     */
    svg.innerHTML = "";


    /*
     * Renderiza cada node.
     */
    state.graph.nodes.forEach(
        (node) => {
            const element =
                createNodeElement(
                    node
                );


            nodeLayer.appendChild(
                element
            );
        }
    );


    /*
     * Espera layout dos nodes ser calculado
     * antes de desenhar as linhas.
     */
    requestAnimationFrame(
        () => {
            drawConnections();
        }
    );
}


/* =========================================================
   CREATE NODE ELEMENT
   ========================================================= */

function createNodeElement(
    node
) {
    let position =
        getNodePosition(
            node.id
        );


    /*
     * Fallback caso o state ainda
     * não tenha posição.
     */
    if (!position) {
        const index =
            state.graph.nodes.findIndex(
                (item) =>
                    item.id ===
                    node.id
            );


        const column =
            index % 3;

        const row =
            Math.floor(
                index / 3
            );


        position = {
            x:
                80 +
                column * 280,

            y:
                80 +
                row * 180,
        };


        setNodePosition(
            node.id,
            position.x,
            position.y
        );
    }


    const article =
        document.createElement(
            "article"
        );


    article.className =
        "vf-node";


    article.dataset.nodeId =
        node.id;


    article.dataset.type =
        node.type;


    article.style.left =
        `${position.x}px`;


    article.style.top =
        `${position.y}px`;


    if (
        state.selectedNodeId ===
        node.id
    ) {
        article.classList.add(
            "selected"
        );
    }


    article.innerHTML = `
        <header class="vf-node-head">

            <span class="vf-type-dot"></span>

            <span class="vf-node-title">
                ${escapeHtml(
                    formatNodeType(
                        node.type
                    )
                )}
            </span>

        </header>


        <div class="vf-node-body">

            ${renderNodeProperties(
                node
            )}

        </div>


        <footer class="vf-node-footer">

            <span>
                ${escapeHtml(
                    node.type
                )}
            </span>

            <span>
                ${escapeHtml(
                    shortId(
                        node.id
                    )
                )}
            </span>

        </footer>


        <span
            class="vf-socket vf-socket--in"
            data-port="in"
            data-direction="in"
            title="Input"
        ></span>


        <span
            class="vf-socket vf-socket--out"
            data-port="out"
            data-direction="out"
            title="Output"
        ></span>
    `;


    /* =====================================================
       SELECT NODE
       ===================================================== */

    article.addEventListener(
        "pointerdown",
        (event) => {
            /*
             * Não seleciona pelo evento do socket.
             * O socket controla a própria interação.
             */
            if (
                event.target.closest(
                    ".vf-socket"
                )
            ) {
                return;
            }


            setSelectedNode(
                article,
                node.id
            );
        }
    );


    /* =====================================================
       NODE DRAG
       ===================================================== */

    const header =
        article.querySelector(
            ".vf-node-head"
        );


    header.addEventListener(
        "pointerdown",
        (event) => {
            beginNodeDrag(
                event,
                article,
                node.id
            );
        }
    );


    header.addEventListener(
        "pointermove",
        dragNode
    );


    header.addEventListener(
        "pointerup",
        endNodeDrag
    );


    header.addEventListener(
        "pointercancel",
        endNodeDrag
    );


    /* =====================================================
       CONNECTION START
       ===================================================== */

    article
        .querySelectorAll(
            '.vf-socket[data-direction="out"]'
        )
        .forEach(
            (socket) => {
                socket.addEventListener(
                    "pointerdown",
                    (event) => {
                        beginConnection(
                            event,
                            article,
                            socket
                        );
                    }
                );
            }
        );


    return article;
}


/* =========================================================
   NODE CONTENT
   ========================================================= */

function renderNodeProperties(
    node
) {
    const properties =
        node.properties ?? {};


    const entries =
        Object.entries(
            properties
        );


    if (
        entries.length === 0
    ) {
        return `
            <span class="vf-node-empty">
                No properties
            </span>
        `;
    }


    return entries
        .slice(
            0,
            4
        )
        .map(
            ([key, value]) => `
                <div class="vf-node-property">

                    <span class="vf-node-property-name">
                        ${escapeHtml(
                            key
                        )}
                    </span>

                    <span class="vf-node-property-value">
                        ${escapeHtml(
                            formatValue(
                                value
                            )
                        )}
                    </span>

                </div>
            `
        )
        .join("");
}


/* =========================================================
   SELECT NODE
   ========================================================= */

function setSelectedNode(
    element,
    nodeId
) {
    selectNode(
        nodeId
    );


    document
        .querySelectorAll(
            ".vf-node.selected"
        )
        .forEach(
            (node) => {
                node.classList.remove(
                    "selected"
                );
            }
        );


    element.classList.add(
        "selected"
    );


    renderInspector();
}


/* =========================================================
   NODE DRAG
   ========================================================= */

function beginNodeDrag(
    event,
    nodeElement,
    nodeId
) {
    if (
        event.button !== 0
    ) {
        return;
    }


    /*
     * Não inicia drag do node
     * se clicou num socket.
     */
    if (
        event.target.closest(
            ".vf-socket"
        )
    ) {
        return;
    }


    event.preventDefault();

    event.stopPropagation();


    setSelectedNode(
        nodeElement,
        nodeId
    );


    draggingNode = {
        element:
            nodeElement,

        nodeId,
    };


    const pointer =
        pointerToWorld(
            event.clientX,
            event.clientY
        );


    const position =
        getNodePosition(
            nodeId
        );


    dragOffsetX =
        pointer.x -
        position.x;


    dragOffsetY =
        pointer.y -
        position.y;


    event.currentTarget
        .setPointerCapture(
            event.pointerId
        );
}


function dragNode(
    event
) {
    if (!draggingNode) {
        return;
    }


    const pointer =
        pointerToWorld(
            event.clientX,
            event.clientY
        );


    const x =
        pointer.x -
        dragOffsetX;


    const y =
        pointer.y -
        dragOffsetY;


    setNodePosition(
        draggingNode.nodeId,
        x,
        y
    );


    draggingNode
        .element
        .style
        .left =
        `${x}px`;


    draggingNode
        .element
        .style
        .top =
        `${y}px`;


    /*
     * Connections seguem o node.
     */
    drawConnections();
}


function endNodeDrag(
    event
) {
    if (!draggingNode) {
        return;
    }


    if (
        event?.currentTarget &&
        event?.pointerId !==
            undefined &&
        event.currentTarget
            .hasPointerCapture?.(
                event.pointerId
            )
    ) {
        event.currentTarget
            .releasePointerCapture(
                event.pointerId
            );
    }


    draggingNode = null;
}


/* =========================================================
   VIEWPORT
   ========================================================= */

function setupViewportEvents() {

    /* =====================================================
       ZOOM COM WHEEL
       ===================================================== */

    workspace.addEventListener(
        "wheel",
        (event) => {
            event.preventDefault();


            const rect =
                workspace
                    .getBoundingClientRect();


            const mouseX =
                event.clientX -
                rect.left;


            const mouseY =
                event.clientY -
                rect.top;


            const worldX =
                (
                    mouseX -
                    state.viewport.x
                ) /
                state.viewport.zoom;


            const worldY =
                (
                    mouseY -
                    state.viewport.y
                ) /
                state.viewport.zoom;


            const factor =
                event.deltaY < 0
                    ? 1.08
                    : 0.92;


            const nextZoom =
                clamp(
                    state.viewport.zoom *
                        factor,
                    0.4,
                    2
                );


            state.viewport.x =
                mouseX -
                worldX *
                    nextZoom;


            state.viewport.y =
                mouseY -
                worldY *
                    nextZoom;


            state.viewport.zoom =
                nextZoom;


            applyViewport();
        },
        {
            passive: false,
        }
    );


    /* =====================================================
       PAN
       Middle mouse
       Shift + left mouse
       ===================================================== */

    workspace.addEventListener(
        "pointerdown",
        (event) => {
            if (
                event.target.closest(
                    ".vf-node"
                )
            ) {
                return;
            }


            const shouldPan =
                event.button === 1 ||
                (
                    event.button === 0 &&
                    event.shiftKey
                );


            if (!shouldPan) {
                return;
            }


            event.preventDefault();


            panning = true;


            panStartX =
                event.clientX;


            panStartY =
                event.clientY;


            panOriginX =
                state.viewport.x;


            panOriginY =
                state.viewport.y;


            workspace
                .setPointerCapture(
                    event.pointerId
                );
        }
    );


    workspace.addEventListener(
        "pointermove",
        (event) => {
            if (!panning) {
                return;
            }


            state.viewport.x =
                panOriginX +
                (
                    event.clientX -
                    panStartX
                );


            state.viewport.y =
                panOriginY +
                (
                    event.clientY -
                    panStartY
                );


            applyViewport();
        }
    );


    workspace.addEventListener(
        "pointerup",
        (event) => {
            if (!panning) {
                return;
            }


            panning = false;


            if (
                workspace
                    .hasPointerCapture(
                        event.pointerId
                    )
            ) {
                workspace
                    .releasePointerCapture(
                        event.pointerId
                    );
            }
        }
    );


    workspace.addEventListener(
        "pointercancel",
        () => {
            panning = false;
        }
    );


    window.addEventListener(
        "resize",
        () => {
            drawConnections();
        }
    );
}


/* =========================================================
   ZOOM BUTTONS
   ========================================================= */

function setupZoomControls() {
    document
        .querySelector(
            "#vf-zoom-in"
        )
        ?.addEventListener(
            "click",
            () => {
                state.viewport.zoom =
                    clamp(
                        state.viewport.zoom +
                            0.1,
                        0.4,
                        2
                    );


                applyViewport();
            }
        );


    document
        .querySelector(
            "#vf-zoom-out"
        )
        ?.addEventListener(
            "click",
            () => {
                state.viewport.zoom =
                    clamp(
                        state.viewport.zoom -
                            0.1,
                        0.4,
                        2
                    );


                applyViewport();
            }
        );


    document
        .querySelector(
            "#vf-zoom-reset"
        )
        ?.addEventListener(
            "click",
            () => {
                state.viewport.x =
                    0;

                state.viewport.y =
                    0;

                state.viewport.zoom =
                    1;


                applyViewport();
            }
        );
}


/* =========================================================
   APPLY VIEWPORT
   ========================================================= */

function applyViewport() {
    if (!world) {
        return;
    }


    world.style.transform =
        `translate(
            ${state.viewport.x}px,
            ${state.viewport.y}px
        )
        scale(
            ${state.viewport.zoom}
        )`;


    const label =
        document.querySelector(
            "#vf-zoom-label"
        );


    if (label) {
        label.textContent =
            `${Math.round(
                state.viewport.zoom *
                    100
            )}%`;
    }


    drawConnections();
}


/* =========================================================
   CONNECTION EVENTS
   ========================================================= */

function setupConnectionEvents() {
    document.addEventListener(
        "pointermove",
        updateConnectionPreview
    );


    document.addEventListener(
        "pointerup",
        finishConnection
    );


    document.addEventListener(
        "pointercancel",
        cancelPendingConnection
    );


    /*
     * ESC cancela connection.
     */
    document.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key ===
                "Escape"
            ) {
                cancelPendingConnection();
            }
        }
    );
}


/* =========================================================
   BEGIN CONNECTION
   ========================================================= */

function beginConnection(
    event,
    nodeElement,
    socket
) {
    if (
        event.button !== 0
    ) {
        return;
    }


    event.preventDefault();

    event.stopPropagation();


    /*
     * Cancela connection antiga
     * caso exista.
     */
    cancelPendingConnection();


    socket.setPointerCapture(
        event.pointerId
    );


    const nodeId =
        nodeElement
            .dataset
            .nodeId;


    const port =
        socket
            .dataset
            .port;


    const start =
        getSocketPoint(
            nodeElement,
            socket
        );


    pendingConnection = {
        sourceNodeId:
            nodeId,

        sourcePort:
            port,

        start,

        pointerId:
            event.pointerId,

        sourceSocket:
            socket,
    };


    previewWire =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );


    previewWire.setAttribute(
        "class",
        "vf-wire vf-wire--preview"
    );


    svg.appendChild(
        previewWire
    );


    updatePreviewPath(
        start,
        start
    );


    socket.classList.add(
        "vf-socket--connecting"
    );
}


/* =========================================================
   UPDATE CONNECTION PREVIEW
   ========================================================= */

function updateConnectionPreview(
    event
) {
    if (
        !pendingConnection ||
        !previewWire
    ) {
        return;
    }


    const mouse =
        pointerToWorld(
            event.clientX,
            event.clientY
        );


    updatePreviewPath(
        pendingConnection.start,
        mouse
    );


    clearConnectionTarget();


    const element =
        document.elementFromPoint(
            event.clientX,
            event.clientY
        );


    const targetSocket =
        element
            ?.closest?.(
                '.vf-socket[data-direction="in"]'
            );


    if (!targetSocket) {
        return;
    }


    const targetNode =
        targetSocket.closest(
            ".vf-node"
        );


    /*
     * Não permite self connection.
     */
    if (
        targetNode?.dataset.nodeId ===
        pendingConnection.sourceNodeId
    ) {
        return;
    }


    targetSocket.classList.add(
        "vf-socket--connection-target"
    );
}


/* =========================================================
   FINISH CONNECTION
   ========================================================= */

function finishConnection(
    event
) {
    if (!pendingConnection) {
        return;
    }


    /*
     * IMPORTANTE:
     *
     * Como usamos Pointer Capture,
     * event.target pode continuar sendo
     * o socket de origem.
     *
     * Por isso usamos elementFromPoint().
     */
    const element =
        document.elementFromPoint(
            event.clientX,
            event.clientY
        );


    const targetSocket =
        element
            ?.closest?.(
                '.vf-socket[data-direction="in"]'
            );


    if (targetSocket) {
        const targetNode =
            targetSocket.closest(
                ".vf-node"
            );


        const targetNodeId =
            targetNode
                ?.dataset
                .nodeId;


        const targetPort =
            targetSocket
                .dataset
                .port;


        if (
            targetNodeId &&
            targetNodeId !==
                pendingConnection
                    .sourceNodeId
        ) {
            const detail = {
                sourceNodeId:
                    pendingConnection
                        .sourceNodeId,

                sourcePort:
                    pendingConnection
                        .sourcePort,

                targetNodeId,

                targetPort,
            };


            console.log(
                "[Forge] Connection request:",
                detail
            );


            document.dispatchEvent(
                new CustomEvent(
                    "forge:connection-request",
                    {
                        detail,
                    }
                )
            );
        }
    }


    releaseConnectionPointer();


    cancelPendingConnection();
}


/* =========================================================
   RELEASE POINTER
   ========================================================= */

function releaseConnectionPointer() {
    if (!pendingConnection) {
        return;
    }


    const {
        sourceSocket,
        pointerId,
    } = pendingConnection;


    if (
        sourceSocket &&
        pointerId !== undefined &&
        sourceSocket
            .hasPointerCapture(
                pointerId
            )
    ) {
        sourceSocket
            .releasePointerCapture(
                pointerId
            );
    }
}


/* =========================================================
   CANCEL CONNECTION
   ========================================================= */

function cancelPendingConnection() {
    if (
        pendingConnection
            ?.sourceSocket
    ) {
        pendingConnection
            .sourceSocket
            .classList
            .remove(
                "vf-socket--connecting"
            );
    }


    previewWire?.remove();


    previewWire = null;

    pendingConnection = null;


    clearConnectionTarget();
}


/* =========================================================
   CLEAR TARGET
   ========================================================= */

function clearConnectionTarget() {
    document
        .querySelectorAll(
            ".vf-socket--connection-target"
        )
        .forEach(
            (socket) => {
                socket.classList.remove(
                    "vf-socket--connection-target"
                );
            }
        );
}


/* =========================================================
   DRAW PERMANENT CONNECTIONS
   ========================================================= */

export function drawConnections() {
    if (
        !svg ||
        !nodeLayer
    ) {
        return;
    }


    /*
     * Cuidado:
     *
     * Se estivermos desenhando uma connection
     * temporária, precisamos preservar ela.
     */
    const currentPreview =
        previewWire;


    /*
     * Remove apenas wires permanentes.
     */
    svg
        .querySelectorAll(
            ".vf-wire:not(.vf-wire--preview)"
        )
        .forEach(
            (wire) => {
                wire.remove();
            }
        );


    state.graph.connections.forEach(
        (connection) => {

            const source =
                findNodeElement(
                    connection
                        .source_node_id
                );


            const target =
                findNodeElement(
                    connection
                        .target_node_id
                );


            if (
                !source ||
                !target
            ) {
                console.warn(
                    "[Forge] Node da connection não encontrado:",
                    connection
                );

                return;
            }


            const sourceSocket =
                findSocket(
                    source,
                    connection
                        .source_port,
                    "out"
                );


            const targetSocket =
                findSocket(
                    target,
                    connection
                        .target_port,
                    "in"
                );


            if (
                !sourceSocket ||
                !targetSocket
            ) {
                console.warn(
                    "[Forge] Socket da connection não encontrado:",
                    connection
                );

                return;
            }


            const start =
                getSocketPoint(
                    source,
                    sourceSocket
                );


            const end =
                getSocketPoint(
                    target,
                    targetSocket
                );


            drawWire(
                start,
                end,
                connection
            );
        }
    );


    /*
     * Mantém preview na frente.
     */
    if (
        currentPreview &&
        currentPreview
            .isConnected
    ) {
        svg.appendChild(
            currentPreview
        );
    }
}


/* =========================================================
   FIND NODE
   ========================================================= */

function findNodeElement(
    nodeId
) {
    if (!nodeLayer) {
        return null;
    }


    /*
     * Evita interpolar ID diretamente
     * num seletor CSS complexo.
     */
    return [
        ...nodeLayer.querySelectorAll(
            ".vf-node"
        ),
    ].find(
        (node) =>
            node.dataset.nodeId ===
            nodeId
    ) ?? null;
}


/* =========================================================
   FIND SOCKET
   ========================================================= */

function findSocket(
    nodeElement,
    port,
    direction = null
) {
    const sockets =
        nodeElement
            .querySelectorAll(
                ".vf-socket"
            );


    return [
        ...sockets,
    ].find(
        (socket) => {
            const samePort =
                socket.dataset.port ===
                port;


            const sameDirection =
                direction === null ||
                socket
                    .dataset
                    .direction ===
                    direction;


            return (
                samePort &&
                sameDirection
            );
        }
    ) ?? null;
}


/* =========================================================
   SOCKET COORDINATES
   ========================================================= */

function getSocketPoint(
    node,
    socket
) {
    return {
        x:
            node.offsetLeft +
            socket.offsetLeft +
            socket.offsetWidth / 2,

        y:
            node.offsetTop +
            socket.offsetTop +
            socket.offsetHeight / 2,
    };
}


/* =========================================================
   DRAW PERMANENT WIRE
   ========================================================= */

function drawWire(
    start,
    end,
    connection = null
) {
    const path =
        document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        );


    path.setAttribute(
        "class",
        "vf-wire"
    );


    if (
        connection?.id
    ) {
        path.dataset.connectionId =
            connection.id;
    }


    path.setAttribute(
        "d",
        buildWirePath(
            start,
            end
        )
    );


    svg.appendChild(
        path
    );
}


/* =========================================================
   PREVIEW PATH
   ========================================================= */

function updatePreviewPath(
    start,
    end
) {
    if (!previewWire) {
        return;
    }


    previewWire.setAttribute(
        "d",
        buildWirePath(
            start,
            end
        )
    );
}


/* =========================================================
   BUILD BEZIER PATH
   ========================================================= */

function buildWirePath(
    start,
    end
) {
    const distance =
        Math.abs(
            end.x -
            start.x
        );


    /*
     * Curvatura mínima.
     */
    const dx =
        Math.max(
            60,
            distance * 0.45
        );


    /*
     * Se target está à direita,
     * curva normal.
     */
    if (
        end.x >=
        start.x
    ) {
        return [
            `M ${start.x} ${start.y}`,

            `C ${start.x + dx} ${start.y},`,

            `${end.x - dx} ${end.y},`,

            `${end.x} ${end.y}`,
        ].join(" ");
    }


    /*
     * Se target está atrás do source,
     * cria uma curva maior para evitar
     * uma linha estranha dobrando.
     */
    const reverseDx =
        Math.max(
            100,
            distance * 0.6
        );


    return [
        `M ${start.x} ${start.y}`,

        `C ${start.x + reverseDx} ${start.y},`,

        `${end.x - reverseDx} ${end.y},`,

        `${end.x} ${end.y}`,
    ].join(" ");
}


/* =========================================================
   POINTER → WORLD COORDINATES
   ========================================================= */

function pointerToWorld(
    clientX,
    clientY
) {
    const rect =
        workspace
            .getBoundingClientRect();


    return {
        x:
            (
                clientX -
                rect.left -
                state.viewport.x
            ) /
            state.viewport.zoom,

        y:
            (
                clientY -
                rect.top -
                state.viewport.y
            ) /
            state.viewport.zoom,
    };
}


/* =========================================================
   FORMAT NODE TYPE
   ========================================================= */

function formatNodeType(
    type
) {
    return String(
        type
    )
        .split("-")
        .map(
            (part) =>
                part
                    .charAt(0)
                    .toUpperCase() +
                part.slice(1)
        )
        .join(" ");
}


/* =========================================================
   FORMAT VALUE
   ========================================================= */

function formatValue(
    value
) {
    if (
        typeof value ===
            "object" &&
        value !== null
    ) {
        return JSON.stringify(
            value
        );
    }


    return String(
        value ?? ""
    );
}


/* =========================================================
   SHORT ID
   ========================================================= */

function shortId(
    id
) {
    const value =
        String(id);


    if (
        value.length <= 22
    ) {
        return value;
    }


    return (
        value.slice(
            0,
            18
        ) +
        "…"
    );
}


/* =========================================================
   CLAMP
   ========================================================= */

function clamp(
    value,
    min,
    max
) {
    return Math.min(
        max,
        Math.max(
            min,
            value
        )
    );
}


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(
    value
) {
    return String(
        value
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}