const assert = require("node:assert/strict");
const {chromium} = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright"
    : "playwright");

(async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.FORGE_CHROMIUM_PATH,
        args: process.env.FORGE_CHROMIUM_PATH ? ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--single-process", "--in-process-gpu", "--use-gl=angle", "--use-angle=swiftshader"] : [],
    });
    const page = await browser.newPage({viewport: {width: Number(process.env.FORGE_VIEWPORT_WIDTH || 1600), height: Number(process.env.FORGE_VIEWPORT_HEIGHT || 1000)}});
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const base = "http://127.0.0.1:8765";
    const api = base + "/api/forge";

    try {
        await page.request.post(api + "/project/new");
        const nodes = [];
        for (const position of [{x: 80, y: 80}, {x: 340, y: 80}, {x: 340, y: 230}, {x: 80, y: 230}]) {
            const response = await page.request.post(api + "/nodes", {data: {type: "dialogue", position}});
            nodes.push(await response.json());
        }
        const connection = await (await page.request.post(api + "/connections", {data: {
            source_node_id: nodes[0].id, source_port: "out", target_node_id: nodes[1].id, target_port: "in",
        }})).json();
        await page.goto(base);
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        const point = await page.locator(".vf-wire").evaluate(path => {
            const p = path.getPointAtLength(path.getTotalLength() / 2);
            const screen = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM());
            return {x: screen.x, y: screen.y};
        });
        await page.mouse.click(point.x, point.y);
        assert.equal(await page.locator(".vf-connection-handle").count(), 2);

        async function graphConnection() {
            return (await (await page.request.get(api + "/graph")).json()).connections[0];
        }

        async function dragEndpoint(endpoint, index, direction, cancel = false) {
            const handle = await page.locator(`.vf-connection-handle[data-endpoint="${endpoint}"]`).boundingBox();
            const target = await page.locator(`.vf-node[data-node-id="${nodes[index].id}"] .vf-socket--${direction}`).boundingBox();
            await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
            await page.mouse.down();
            await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, {steps: 8});
            assert.equal(await page.locator(".vf-wire--preview").count(), 1);
            if (cancel) await page.keyboard.press("Escape");
            await page.mouse.up();
            await page.waitForFunction(() => !document.querySelector(".vf-wire--preview"));
        }

        await dragEndpoint("target", 2, "in", true);
        assert.deepEqual(await graphConnection(), connection);
        await dragEndpoint("target", 2, "out");
        assert.deepEqual(await graphConnection(), connection);
        await dragEndpoint("target", 0, "in");
        assert.deepEqual(await graphConnection(), connection);
        await dragEndpoint("target", 2, "in");
        await page.waitForFunction(id => JSON.parse(document.querySelector("#vf-ir-output").textContent).connections[0].target_node_id === id, nodes[2].id);
        assert.equal((await graphConnection()).id, connection.id);
        await dragEndpoint("source", 3, "out");
        await page.waitForFunction(id => JSON.parse(document.querySelector("#vf-ir-output").textContent).connections[0].source_node_id === id, nodes[3].id);
        await page.keyboard.press("Control+z");
        await page.waitForFunction(id => JSON.parse(document.querySelector("#vf-ir-output").textContent).connections[0].source_node_id === id, nodes[0].id);
        await page.keyboard.press("Control+z");
        await page.waitForFunction(id => JSON.parse(document.querySelector("#vf-ir-output").textContent).connections[0].target_node_id === id, nodes[1].id);
        await page.keyboard.press("Control+y");
        await page.waitForFunction(id => JSON.parse(document.querySelector("#vf-ir-output").textContent).connections[0].target_node_id === id, nodes[2].id);
        await page.keyboard.press("Control+y");
        await page.waitForFunction(id => JSON.parse(document.querySelector("#vf-ir-output").textContent).connections[0].source_node_id === id, nodes[3].id);
        await page.click('[data-action="configuration"]');
        await page.locator('[data-workspace="inspectorSide"]').selectOption("left");
        await page.locator('[data-workspace="bottomPosition"]').selectOption("top");
        await page.locator("dialog button").first().click();
        const sidebar = await page.locator("#vf-left-resizer").boundingBox();
        await page.mouse.move(sidebar.x + 2, sidebar.y + 50);
        await page.mouse.down();
        await page.mouse.move(sidebar.x + 42, sidebar.y + 50, {steps: 5});
        await page.mouse.up();
        await page.click('[data-mode="event"]');
        await page.click('[data-tab="console"]');
        await page.click("#vf-collapse-workspace");
        await page.locator("#vf-right-resizer").dblclick();
        await page.waitForFunction(async () => {
            const prefs = await (await fetch("/api/forge/preferences")).json();
            return prefs.workspace.inspectorSide === "left" && prefs.workspace.bottomPosition === "top"
                && prefs.workspace.leftWidth > 250 && prefs.workspace.mode === "event"
                && prefs.workspace.activeBottomTab === "console"
                && prefs.workspace.bottomCollapsed && prefs.workspace.inspectorCollapsed;
        });
        await page.reload();
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        assert.equal(await page.locator(".vf-app.inspector-left").count(), 1);
        assert.equal(await page.locator(".vf-main-pane.bottom-top").count(), 1);
        assert.equal(await page.locator('[data-mode="event"]').getAttribute("class"), "active");
        assert.equal(await page.locator('[data-tab="console"]').getAttribute("aria-selected"), "true");
        assert.equal(await page.locator(".bottom-collapsed").count(), 1);
        assert.equal(await page.locator(".inspector-collapsed").count(), 1);
        assert.ok(await page.locator(".vf-bottom-pane").evaluate(panel => panel.getBoundingClientRect().height <= 2));
        await page.click('[data-action="configuration"]');
        await page.click('[data-action="restore-layout"]');
        await page.waitForFunction(() => !document.querySelector(".inspector-left"));
        assert.equal(await page.locator(".bottom-top").count(), 0);
        console.log("PASS: centralized workspace persistence, placement, sidebar resize and default restore");

        await page.request.post(api + "/project/new");
        await page.request.post(api + "/nodes", {data: {type: "branch", position: {x: 80, y: 80}}});
        await page.reload();
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        await page.locator(".vf-node-head").click();
        await page.click('[data-item-view="variables"]');
        await page.locator('#vf-variable-form [name="name"]').fill("score");
        await page.locator('#vf-variable-form [name="type"]').selectOption("number");
        await page.locator('#vf-variable-form [name="default"]').fill("0");
        await page.locator('#vf-variable-form button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelector('#vf-variables [data-delete-variable="score"]'));
        await page.locator(".vf-node-head").click();
        await page.locator('[data-condition="variable"]').selectOption("score");
        await page.locator('[data-condition="operator"]').selectOption("greater_than");
        await page.locator('[data-condition="value"]').fill("10");
        await page.locator('#vf-node-properties-form button[type="submit"]').click();
        await page.waitForFunction(() => JSON.parse(document.querySelector("#vf-ir-output").textContent).nodes[0].properties.condition.operator === "greater_than");
        await page.locator(".vf-node-head").click();
        await page.keyboard.press("Control+z");
        await page.waitForFunction(() => JSON.parse(document.querySelector("#vf-ir-output").textContent).nodes[0].properties.condition.operator === "truthy");
        await page.keyboard.press("Control+y");
        await page.waitForFunction(() => JSON.parse(document.querySelector("#vf-ir-output").textContent).nodes[0].properties.condition.value === 10);
        console.log("PASS: structured Branch editor, JSON comparison value, undo/redo");
        await page.locator('.vf-library-node[data-type="set-variable"]').dblclick();
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 2);
        await page.locator('.vf-node[data-type="set-variable"] .vf-node-head').click();
        await page.locator('[data-property="variable"]').selectOption("score");
        await page.locator('[data-property="value"]').fill("20");
        await page.locator('#vf-node-properties-form button[type="submit"]').click();
        await page.waitForFunction(() => JSON.parse(document.querySelector("#vf-ir-output").textContent).nodes.some(node => node.type === "set-variable" && node.properties.value === 20));
        page.once("dialog", dialog => dialog.accept());
        await page.click('[data-delete-variable="score"]');
        await page.waitForFunction(async () => {
            const problems = await (await fetch("/api/forge/problems")).json();
            return problems.some(problem => problem.code === "missing_variable");
        });
        await page.keyboard.press("Control+z");
        await page.waitForFunction(() => document.querySelector('#vf-variables [data-delete-variable="score"]'));
        console.log("PASS: typed variable creation, reference selection, deletion warning and undo");

        await page.click('[data-mode="event"]');
        page.once("dialog", dialog => dialog.accept("original_event"));
        await page.click('[data-action="create-event"]');
        await page.waitForSelector("[data-rename-event]");
        const eventId = await page.locator("[data-rename-event]").getAttribute("data-rename-event");
        page.once("dialog", dialog => dialog.accept("renamed_event"));
        await page.click("[data-rename-event]");
        await page.waitForFunction(() => document.querySelector(".vf-event-row").textContent.includes("renamed_event"));
        assert.equal(await page.locator("[data-rename-event]").getAttribute("data-rename-event"), eventId);
        await page.keyboard.press("Control+z");
        await page.waitForFunction(() => document.querySelector(".vf-event-row").textContent.includes("original_event"));
        console.log("PASS: event rename retains ID and integrates undo");

        const preview = await page.evaluate(async () => {
            const {renderAssetPreview, previewRenderers} = await import("/__vela__/static/forge/js/components/preview.js");
            const layer = document.createElement("div");
            const dispose = renderAssetPreview(layer, {name: "model.glb", mime_type: "model/gltf-binary", data: "unsupported"});
            const unsupported = layer.textContent;
            dispose();
            renderAssetPreview(layer, {name: "missing.png", mime_type: "image/png", data: null});
            return {types: Object.keys(previewRenderers), unsupported, missing: layer.textContent};
        });
        assert.equal(preview.types.length, 4);
        assert.ok(preview.unsupported.includes("não suportado"));
        assert.ok(preview.missing.includes("indisponível"));
        assert.deepEqual(errors, []);
        console.log("PASS: reconnect target/source, invalid direction/self-drop, Escape, ID stability, undo/redo");
    } catch (error) {
        console.error(await page.locator("#vf-console").textContent());
        throw error;
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
