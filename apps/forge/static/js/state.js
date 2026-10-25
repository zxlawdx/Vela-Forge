export const state = {
    graph: {
        nodes: [],
        connections: [],
    },

    selectedNodeId: null,

    positions: new Map(),

    viewport: {
        x: 0,
        y: 0,
        zoom: 1,
    },
};

export function setGraph(graph) {
    state.graph = graph;

    assignInitialPositions();
}

export function getNode(nodeId) {
    return state.graph.nodes.find(
        (node) => node.id === nodeId
    );
}

export function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
}

export function getSelectedNode() {
    if (!state.selectedNodeId) {
        return null;
    }

    return getNode(state.selectedNodeId);
}

export function setNodePosition(nodeId, x, y) {
    state.positions.set(nodeId, {
        x,
        y,
    });
}

export function getNodePosition(nodeId) {
    return state.positions.get(nodeId);
}

function assignInitialPositions() {
    state.graph.nodes.forEach((node, index) => {
        if (state.positions.has(node.id)) {
            return;
        }

        const column = index % 3;
        const row = Math.floor(index / 3);

        state.positions.set(node.id, {
            x: 120 + column * 300,
            y: 120 + row * 190,
        });
    });
}