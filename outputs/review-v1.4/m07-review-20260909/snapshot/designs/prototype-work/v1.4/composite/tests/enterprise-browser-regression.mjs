import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startCandidate } from "../start-candidate.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const output = fileURLToPath(new URL("../evidence/enterprise-identity/", import.meta.url));
await mkdir(output, { recursive: true });
const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const checks = [], errors = [];
let page;
async function frameFor(id) {
  await page.locator(`#module-frame[data-module-id="${id}"]`).waitFor();
  const frame = await (await page.locator("#module-frame").elementHandle()).contentFrame();
  await frame.waitForFunction(() => document.body?.innerText.length > 30);
  if (id === "m07") await frame.locator('#app[aria-busy="false"]').waitFor();
  return frame;
}
async function check(name, run) {
  try { checks.push({ name, status: "passed", detail: await run() }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, status: "failed", error: error.message }); console.error(`FAIL ${name}: ${error.message}`); await page.screenshot({ path: path.join(output, `failure-${checks.length}.png`) }).catch(() => {}); }
}
try {
  for (const scenarioId of ["S001", "S003"]) for (const operation of ["build-data", "validate-data", "freeze-data", "create-contract"]) {
    const response = await fetch(`${runtime.modelingUrl}/v1/model-management/actions/${operation}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId, payload: {} }) });
    assert.ok(response.ok, `${scenarioId} ${operation}`);
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(runtime.entryUrl.replace("#home", "#module/m07"));
    await check(`${viewport.width}: all 21 enterprises on offline map`, async () => {
      const frame = await frameFor("m07");
      await frame.locator("#enterprise-map").click();
      assert.equal(await frame.locator(".map-marker").count(), 21);
      assert.ok(await frame.locator(".province-boundaries path").count() >= 30);
      assert.match(await frame.locator(".map-crs").innerText(), /演示布点/);
      const plot = await frame.locator(".map-surface > svg").boundingBox();
      for (const marker of await frame.locator(".map-marker .marker-core").all()) {
        const box = await marker.boundingBox();
        assert.ok(box.x >= plot.x && box.x + box.width <= plot.x + plot.width + 1);
        assert.ok(box.y >= plot.y && box.y + box.height <= plot.y + plot.height + 1);
      }
      const ids = await frame.locator(".map-marker").evaluateAll((nodes) => nodes.map((node) => node.dataset.setActive));
      for (const id of ids) {
        await frame.locator(`.map-marker[data-set-active="${id}"] .marker-core`).click();
        assert.equal((await frame.evaluate(() => window.__OFW_M07_DEBUG__.getContext())).activeObjectRef.id, id);
      }
      await frame.locator('.map-marker[data-set-active="ENT-020"] .marker-core').click();
      await page.screenshot({ path: path.join(output, `map-${viewport.width}.png`) });
      return { enterprises: 21, individuallyClicked: 21, offlineGeometry: true };
    });
    await check(`${viewport.width}: financing and risk share one selected enterprise`, async () => {
      const frame = await frameFor("m07");
      await frame.locator('.map-marker[data-set-active="ENT-020"]').click();
      await frame.locator('[data-enterprise-domain]').selectOption("S001");
      await page.waitForFunction(() => window.OFW_V131_STORE.get().activeScenarioId === "S001");
      assert.equal((await frame.evaluate(() => window.__OFW_M07_DEBUG__.getContext())).activeObjectRef.id, "ENT-020");
      await frame.locator('[data-enterprise-domain]').selectOption("S003");
      await page.waitForFunction(() => window.OFW_V131_STORE.get().activeScenarioId === "S003");
      assert.equal((await frame.evaluate(() => window.__OFW_M07_DEBUG__.getContext())).activeObjectRef.id, "ENT-020");
      await frame.locator('[data-lens="object360"]').click();
      const text = await frame.locator("#canvas-stage").innerText();
      assert.match(text, /2\.88/); assert.match(text, /23\.05/); assert.match(text, /单位553/);
    });
    if (viewport.width === 1440) for (const scenario of ["S001", "S003"]) {
      await check(`${scenario}: master identity survives model calculation and return`, async () => {
        let frame = await frameFor("m07");
        await frame.locator('[data-enterprise-domain]').selectOption(scenario);
        await frame.locator('#continue-analysis').click();
        await frame.locator('[data-navigate-module="modeling"]').click();
        frame = await frameFor("modeling");
        await frame.locator('[data-action="benchmark-baseline"]:visible').first().click();
        await frame.locator('[data-action="run-models"]:visible').first().click();
        await frame.locator('[data-action="return-result"]').waitFor();
        await frame.locator('[data-result-view]').selectOption("candidate");
        await frame.locator('[data-action="return-result"]').click();
        frame = await frameFor("m07");
        await frame.locator('.model-return').waitFor();
        assert.equal((await frame.evaluate(() => window.__OFW_M07_DEBUG__.getContext())).activeObjectRef.id, "ENT-020");
        return { scenario, enterpriseId: "ENT-020" };
      });
    }
    await context.close();
  }
} finally {
  await browser.close(); await runtime.close();
  const evidence = { version: "v1.4-rc.1", identityVersion: "ENTERPRISE-MASTER-20260907-v1", observedAt: new Date().toISOString(), checks, errors, passed: checks.filter((item) => item.status === "passed").length, failed: checks.filter((item) => item.status === "failed").length };
  await writeFile(path.join(output, "regression.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ passed: evidence.passed, failed: evidence.failed, errors }));
  if (evidence.failed || errors.length) process.exitCode = 1;
}
