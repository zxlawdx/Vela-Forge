const assert = require("node:assert/strict");
const {chromium} = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + "/playwright"
    : "playwright");

(async () => {
    const browser = await chromium.launch({headless: true});
    const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    try {
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
        await page.waitForSelector(".vf-wire");
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
        assert.deepEqual(errors, []);
        console.log("PASS: connection preview/target/POST/GET, following wires, persisted drag, Inspector edit/delete");
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
