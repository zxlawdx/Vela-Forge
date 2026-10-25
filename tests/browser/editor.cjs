const assert = require("node:assert/strict");
const {chromium} = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright"
    : "playwright");

(async () => {
    const browser = await chromium.launch({headless: true, executablePath: process.env.FORGE_CHROMIUM_PATH, args: process.env.FORGE_CHROMIUM_PATH ? ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote", "--single-process", "--in-process-gpu", "--use-gl=angle", "--use-angle=swiftshader"] : []});
    const page = await browser.newPage({viewport: {width: Number(process.env.FORGE_VIEWPORT_WIDTH || 1600), height: Number(process.env.FORGE_VIEWPORT_HEIGHT || 1000)}});
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    try {
        await page.request.post("http://127.0.0.1:8765/api/forge/project/new");
        await page.goto("http://127.0.0.1:8765/");
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        await page.click("#vf-create-node");
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 1);
        await page.click("#vf-create-node");
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 2);

        const source = page.locator('.vf-node .vf-socket--out').first();
        const target = page.locator('.vf-node .vf-socket--in').nth(1);
        const a = await source.boundingBox();
        const b = await target.boundingBox();
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {steps: 8});
        assert.equal(await page.locator(".vf-wire--preview").count(), 1);
        assert.equal(await page.locator(".vf-socket--connection-target").count(), 1);
        await page.mouse.up();
        await page.waitForFunction(() => document.querySelectorAll(".vf-wire:not(.vf-wire--preview)").length === 1);
        assert.equal(await page.locator(".vf-wire--preview").count(), 0);

        const before = await page.locator(".vf-wire").getAttribute("d");
        const header = await page.locator(".vf-node-head").nth(1).boundingBox();
        await page.mouse.move(header.x + 40, header.y + 15);
        await page.mouse.down();
        await page.mouse.move(header.x + 100, header.y + 90, {steps: 8});
        assert.notEqual(await page.locator(".vf-wire").getAttribute("d"), before);
        const patch = page.waitForResponse(response => response.request().method() === "PATCH");
        await page.mouse.up();
        assert.equal((await patch).status(), 200);
        await page.waitForTimeout(100);
        const left = await page.locator(".vf-node").nth(1).evaluate(node => node.style.left);

        await page.reload();
        await page.waitForSelector(".vf-wire", {state: "attached"});
        assert.equal(await page.locator(".vf-node").nth(1).evaluate(node => node.style.left), left);
        await page.locator(".vf-node-head").nth(1).click();
        await page.locator('[data-property="text"]').fill("Persisted from inspector");
        const saved = page.waitForResponse(response => response.request().method() === "PATCH");
        await page.locator('#vf-node-properties-form button[type="submit"]').click();
        assert.equal((await saved).status(), 200);
        await page.waitForFunction(() => document.querySelector("#vf-ir-output").textContent.includes("Persisted from inspector"));
        await page.click("#vf-inspector-delete");
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 1);
        assert.equal(await page.locator(".vf-wire").count(), 0);
        console.log("PASS: connection lifecycle, persisted drag, Inspector edit/delete");

        // Spatial creation uses the viewport transform, including zoom and pan.
        await page.request.post("http://127.0.0.1:8765/api/forge/project/new");
        await page.reload();
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        await page.click("#vf-zoom-in");
        await page.click("#vf-zoom-in");
        const viewport = await page.evaluate(async () => {
            const {state} = await import("/__vela__/static/forge/js/state.js");
            state.viewport.x = 31;
            state.viewport.y = -19;
            document.querySelector("#vf-zoom-in").click();
            return {...state.viewport};
        });
        const workspace = await page.locator("#vf-workspace").boundingBox();
        const dropX = Math.round(workspace.width * 0.6);
        const dropY = Math.round(workspace.height * 0.6);
        await page.locator('.vf-library-node[data-type="branch"]').dragTo(page.locator("#vf-workspace"), {
            targetPosition: {x: dropX, y: dropY},
        });
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 1);
        let graph = await (await page.request.get("http://127.0.0.1:8765/api/forge/graph")).json();
        assert.equal(graph.nodes[0].type, "branch");
        assert.ok(Math.abs(graph.nodes[0].position.x - (dropX - viewport.x) / viewport.zoom) < 2);
        assert.ok(Math.abs(graph.nodes[0].position.y - (dropY - viewport.y) / viewport.zoom) < 2);
        assert.equal(await page.locator(".vf-socket--out").count(), 2);
        await page.waitForSelector('[data-history="undo"]:not([disabled])');
        await page.keyboard.press("Control+z");
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 0);
        await page.waitForSelector('[data-history="redo"]:not([disabled])');
        await page.keyboard.press("Control+y");
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 1);
        console.log("PASS: typed sockets, drop coordinates with pan/zoom, undo/redo");

        await page.request.post("http://127.0.0.1:8765/api/forge/project/new");
        await page.reload();
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        await page.click('[data-mode="event"]');
        page.once("dialog", dialog => dialog.accept("door_open"));
        await page.click('[data-action="create-event"]');
        await page.waitForSelector(".vf-event-row");
        const events = await (await page.request.get("http://127.0.0.1:8765/api/forge/events")).json();
        await page.click('[data-mode="animation"]');
        await page.locator('.vf-library-node[data-type="event"]').dblclick();
        await page.waitForSelector(".vf-node-head");
        await page.locator(".vf-node-head").click();
        await page.locator('select[data-property="event"]').selectOption(events[0].id);
        await page.locator('#vf-node-properties-form button[type="submit"]').click();
        await page.waitForFunction(id => document.querySelector("#vf-ir-output").textContent.includes(id), events[0].id);
        assert.equal((await (await page.request.get("http://127.0.0.1:8765/api/forge/events")).json())[0].usages.length, 1);

        const chooserPromise = page.waitForEvent("filechooser");
        await page.click('[data-action="import-to"]');
        const chooser = await chooserPromise;
        await chooser.setFiles({
            name: "pixel.png", mimeType: "image/png",
            buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNu0AAAAASUVORK5CYII=", "base64"),
        });
        await page.waitForFunction(() => document.querySelector("#vf-preview-layer img")?.naturalWidth === 1);
        assert.ok((await page.locator("#vf-assets").textContent()).includes("pixel.png"));

        page.once("dialog", dialog => dialog.accept("BrowserProject"));
        const downloadPromise = page.waitForEvent("download");
        await page.click('[data-action="save-project"]');
        const download = await downloadPromise;
        const savedProject = JSON.parse(require("node:fs").readFileSync(await download.path(), "utf8"));
        assert.equal(savedProject.events[0].id, events[0].id);
        assert.equal(savedProject.assets.length, 1);
        page.once("dialog", dialog => dialog.accept());
        await page.click('[data-action="new-project"]');
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 0);
        page.once("dialog", dialog => dialog.accept());
        const openChooser = page.waitForEvent("filechooser");
        await page.click('[data-action="open-project"]');
        await (await openChooser).setFiles({name: "saved.vforge", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(savedProject))});
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 1);
        assert.deepEqual(await (await page.request.get("http://127.0.0.1:8765/api/forge/project")).json(), savedProject);
        console.log("PASS: Event Manager/reference, image preview, vforge save/load");

        await page.request.post("http://127.0.0.1:8765/api/forge/project/new");
        await page.reload();
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        await page.locator('.vf-library-node[data-type="start"]').dblclick();
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 1);
        await page.locator('.vf-library-node[data-type="end"]').dblclick();
        await page.waitForFunction(() => document.querySelectorAll(".vf-node").length === 2);
        assert.equal(await page.locator(".vf-node").first().locator(".vf-socket--in").count(), 0);
        assert.equal(await page.locator(".vf-node").nth(1).locator(".vf-socket--out").count(), 0);
        const start = await page.locator(".vf-socket--out").boundingBox();
        const end = await page.locator(".vf-socket--in").boundingBox();
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {steps: 8});
        await page.mouse.up();
        await page.waitForSelector(".vf-wire", {state: "attached"});
        const point = await page.locator(".vf-wire").evaluate(path => {
            const p = path.getPointAtLength(path.getTotalLength() / 2);
            const screen = new DOMPoint(p.x, p.y).matrixTransform(path.getScreenCTM());
            return {x: screen.x, y: screen.y};
        });
        await page.mouse.click(point.x, point.y);
        assert.equal(await page.locator(".vf-wire--selected").count(), 1);
        await page.keyboard.press("Delete");
        await page.waitForFunction(() => document.querySelectorAll(".vf-wire").length === 0);
        await page.keyboard.press("Control+z");
        await page.waitForSelector(".vf-wire", {state: "attached"});
        let exportDownload = page.waitForEvent("download");
        await page.locator('[data-action="export"]').first().click();
        assert.equal((await exportDownload).suggestedFilename(), "forge-godot.zip");
        assert.ok((await page.locator("#vf-generated-code").textContent()).includes("forge_runner.gd"));
        const preferenceSaved = page.waitForResponse(response => response.url().endsWith("/preferences") && response.request().method() === "PATCH");
        await page.locator("#vf-engine").selectOption("unity");
        await preferenceSaved;
        exportDownload = page.waitForEvent("download");
        await page.locator('[data-action="export"]').first().click();
        assert.equal((await exportDownload).suggestedFilename(), "forge-unity.zip");
        assert.ok((await page.locator("#vf-generated-code").textContent()).includes("ForgeRunner.cs"));
        await page.reload();
        await page.waitForFunction(() => document.querySelector("#vf-console")?.textContent.includes("iniciado"));
        assert.equal(await page.locator("#vf-engine").inputValue(), "unity");
        await page.click('[data-action="configuration"]');
        await page.locator("dialog input[type=checkbox]").uncheck();
        await page.waitForFunction(() => document.querySelector(".vf-preview-grid").style.display === "none");
        await page.locator("dialog button").first().click();

        if (process.env.FORGE_SCREENSHOT) {
            await page.screenshot({path: process.env.FORGE_SCREENSHOT});
        }

        assert.deepEqual(errors, []);
        console.log("PASS: wire select/delete/undo, both exporters, persisted preferences; no JS errors");
    } catch (error) {
        console.error("Forge console:", await page.locator("#vf-console").textContent());
        console.error("Active element:", await page.evaluate(() => document.activeElement.outerHTML.slice(0, 300)));
        throw error;
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
