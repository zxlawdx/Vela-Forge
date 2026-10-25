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


export async function getProject() {
    const response = await fetch(`${API_BASE}/project`);

    return parseResponse(response);
}

export async function openProject(project) {
    const response = await fetch(`${API_BASE}/project`, {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(project),
    });

    return parseResponse(response);
}

export async function newProject() {
    const response = await fetch(`${API_BASE}/project/new`, {method: "POST"});

    return parseResponse(response);
}

export async function renameProject(name) {
    const response = await fetch(`${API_BASE}/project`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name}),
    });

    return parseResponse(response);
}


export async function getProblems() {
    const response = await fetch(`${API_BASE}/problems`);

    return parseResponse(response);
}


export async function getEvents() {
    const response = await fetch(`${API_BASE}/events`);

    return parseResponse(response);
}

export async function createEvent(name) {
    const response = await fetch(`${API_BASE}/events`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({name}),
    });

    return parseResponse(response);
}

export async function deleteEvent(eventId) {
    const response = await fetch(`${API_BASE}/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
    });

    return parseResponse(response);
}


export async function getAssets() {
    const response = await fetch(`${API_BASE}/assets`);

    return parseResponse(response);
}

export async function importAsset(asset) {
    const response = await fetch(`${API_BASE}/assets`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(asset),
    });

    return parseResponse(response);
}


export async function getHistory() {
    const response = await fetch(`${API_BASE}/history`);

    return parseResponse(response);
}

export async function changeHistory(action) {
    const response = await fetch(`${API_BASE}/history/${action}`, {method: "POST"});

    return parseResponse(response);
}


export async function exportProject(engine) {
    const response = await fetch(`${API_BASE}/export/${encodeURIComponent(engine)}`, {
        method: "POST",
    });

    return parseResponse(response);
}
