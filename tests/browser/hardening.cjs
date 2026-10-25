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
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
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
        assert.deepEqual(errors, []);
        console.log("PASS: reconnect target/source, invalid direction/self-drop, Escape, ID stability, undo/redo");
    } catch (error) {
        console.error(await page.locator("#vf-console").textContent());
        throw error;
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
