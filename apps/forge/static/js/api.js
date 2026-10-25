const API_BASE = "/api/forge";


async function parseResponse(response) {
    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `HTTP ${response.status}: ${text}`
        );
    }

    return response.json();
}


export async function getGraph() {
    const response = await fetch(
        `${API_BASE}/graph`
    );

    return parseResponse(response);
}


export async function createNode(
    type,
    properties = {},
    position = null
) {
    const response = await fetch(
        `${API_BASE}/nodes`,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",
            },

            body: JSON.stringify({
                type,
                properties,
                position,
            }),
        }
    );

    return parseResponse(response);
}


export async function deleteNode(nodeId) {
    const response = await fetch(
        `${API_BASE}/nodes/${encodeURIComponent(nodeId)}`,
        {
            method: "DELETE",
        }
    );

    return parseResponse(response);
}


export async function createConnection(
    sourceNodeId,
    sourcePort,
    targetNodeId,
    targetPort
) {
    const response = await fetch(
        `${API_BASE}/connections`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",
            },

            body: JSON.stringify({
                source_node_id: sourceNodeId,
                source_port: sourcePort,
                target_node_id: targetNodeId,
                target_port: targetPort,
            }),
        }
    );

    return parseResponse(response);
}

export async function updateNode(nodeId, changes) {
    const response = await fetch(
        `${API_BASE}/nodes/${encodeURIComponent(nodeId)}`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(changes),
        }
    );

    return parseResponse(response);
}


export async function deleteConnection(connectionId) {
    const response = await fetch(
        `${API_BASE}/connections/${encodeURIComponent(connectionId)}`,
        {method: "DELETE"}
    );

    return parseResponse(response);
}
