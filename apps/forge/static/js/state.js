export const state = {
    graph: {
        nodes: [],
        connections: [],
    },

    selectedNodeId: null,
    selectedConnectionId: null,

    positions: new Map(),

    viewport: {
        x: 0,
        y: 0,
        zoom: 1,
    },
};

export function setGraph(graph) {
    state.graph = graph;

    if (!graph.connections.some(item => item.id === state.selectedConnectionId)) {
        state.selectedConnectionId = null;
    }

    if (!graph.nodes.some(item => item.id === state.selectedNodeId)) {
        state.selectedNodeId = null;
    }

    state.positions.clear();

    for (const node of graph.nodes) {
        setNodePosition(node.id, node.position.x, node.position.y);
    }
}

export function getNode(nodeId) {
    return state.graph.nodes.find(
        (node) => node.id === nodeId
    );
}

export function selectNode(nodeId) {
    state.selectedNodeId = nodeId;
    state.selectedConnectionId = null;
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

