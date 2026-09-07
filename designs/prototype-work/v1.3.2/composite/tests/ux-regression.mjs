import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startCandidate } from "../start-candidate.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const output = fileURLToPath(new URL("../evidence/ux/", import.meta.url));
await mkdir(output, { recursive: true });
const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const checks = [], errors = [];
let activePage;
async function check(name, action) {
  try { const detail = await action(); checks.push({ name, status: "passed", detail }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, status: "failed", error: error.message }); console.error(`FAIL ${name}: ${error.message}`); if (activePage) await activePage.screenshot({ path: path.join(output, `failure-${checks.length}.png`) }).catch(() => {}); }
}
async function frameFor(page, id) {
  await page.locator(`#module-frame[data-module-id="${id}"]`).waitFor();
  const frame = await (await page.locator("#module-frame").elementHandle()).contentFrame();
  await frame.waitForFunction(() => (document.body?.innerText.trim().length || 0) > 30);
  if (id === "m07") await frame.locator('#app[aria-busy="false"]').waitFor();
  if (["query", "report", "agent", "data", "ontology", "decision"].includes(id)) await frame.locator("#ofw-native-integration-style").waitFor({ state: "attached" });
  return frame;
}
async function go(page, id) {
  await page.locator(`[data-primary-nav][data-route="${id === "dashboard" ? "#dashboard" : `#module/${id}`}"]`).click();
  return frameFor(page, id);
}
async function screenshot(page, name) {
  await page.waitForTimeout(250);
  await page.locator('#toast-region .toast').waitFor({ state: 'detached', timeout: 6000 });
  await page.screenshot({ path: path.join(output, name) });
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: "reduce" });
    const page = await context.newPage(); activePage = page;
    page.on("pageerror", (error) => errors.push({ width: viewport.width, message: error.message }));
    page.setDefaultTimeout(8000);
    await page.goto(runtime.entryUrl);

    await check(`${viewport.width}: resource finder and domain filter`, async () => {
      await page.getByRole("button", { name: "搜索业务资源", exact: true }).click();
      await page.locator("[data-catalog-domain]").selectOption("S003");
      assert.ok(await page.locator(".finder-result").count() >= 9);
      await page.locator("[data-catalog-search]").fill("不可能存在的资源");
      assert.equal(await page.locator(".finder-result").count(), 0);
      await page.keyboard.press("Escape");
    });

    await check(`${viewport.width}: all nine workspaces are nonblank and fit`, async () => {
      const observations = [];
      for (const id of ["data", "ontology", "query", "decision", "agent", "report", "m07", "modeling", "dashboard"]) {
        const frame = await go(page, id);
        const dimensions = await frame.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, text: document.body.innerText.length }));
        assert.ok(dimensions.text > 30, id);
        assert.ok(dimensions.scroll <= dimensions.width + 1, `${id} overflow: ${JSON.stringify(dimensions)}`);
        observations.push({ id, ...dimensions });
      }
      return observations;
    });

    await check(`${viewport.width}: saved exploration restores search and object scope`, async () => {
      const frame = await go(page, "m07");
      if (viewport.width <= 620) await page.locator('[data-module-task-select="m07"]').selectOption("discover");
      else await page.locator('[data-module-task="discover"]').click();
      await frame.locator("#object-search").fill("环保测试");
      const before = await frame.locator(".result-table tbody tr").count();
      await frame.locator("#save-exploration").click();
      await frame.locator("#exploration-name").fill("环保企业比较");
      await frame.locator('#save-form button[value="default"]').click();
      await frame.locator("#object-search").fill("银行");
      await frame.locator("#open-saved-explorations").click();
      await frame.locator("#drawer [data-open-saved]").first().click();
      const snapshot = await frame.evaluate(() => window.__OFW_M07_DEBUG__.getState());
      assert.equal(snapshot.search, "环保测试");
      assert.equal((await frame.evaluate(() => window.__OFW_M07_DEBUG__.getContext())).objectSetRef.count, before);
      return { restoredObjects: before };
    });

    await check(`${viewport.width}: graph zoom, comparison and shared link`, async () => {
      const frame = await frameFor(page, "m07");
      await frame.locator('[data-lens="graph"]').click();
      await frame.locator('[data-graph-scale="in"]').click();
      assert.ok((await frame.evaluate(() => window.__OFW_M07_DEBUG__.getState())).graphTransform.k > 1);
      await screenshot(page, `graph-${viewport.width}.png`);
      await frame.locator('.graph-node [data-graph-expand]').first().click();
      assert.ok(await frame.locator('.graph-node').count() > 2);
      await frame.locator('[data-lens="compare"]').click();
      const metrics = await frame.locator('#compare-metric').innerText();
      assert.doesNotMatch(metrics, /空间位置|来源编码/);
      await screenshot(page, `compare-${viewport.width}.png`);
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await frame.locator('#copy-link').click();
      const url = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(url, /s001-e2e-integration\/index\.html\?exploration=/);
      const linked = await context.newPage();
      await linked.goto(url);
      const restored = await frameFor(linked, "m07");
      await restored.waitForFunction(() => window.__OFW_M07_DEBUG__?.getState().lens === "compare");
      assert.equal((await restored.evaluate(() => window.__OFW_M07_DEBUG__.getState())).search, "环保测试");
      await linked.close();
    });

    for (const [scenario, name, id] of [["S001", "单位553", "ENT-020"], ["S002", "信息科技费用", "BudgetUnit-002"], ["S003", "风电测试公司02", "ENT-002"], ["S004", "申请主体B", "LoanApplicant-002"], ["S005", "基金 B", "PRD-40A100000000B2C7"]]) {
      await check(`${viewport.width}: ${scenario} object to report and return`, async () => {
        let frame = await go(page, "m07");
        if (viewport.width <= 620) await page.locator('[data-module-task-select="m07"]').selectOption("discover");
        else await page.locator('[data-module-task="discover"]').click();
        await frame.locator("#clear-search").click();
        await frame.locator("#object-search").fill(name);
        const open = frame.locator(`[data-open-object]:visible`).first();
        await open.click();
        if (scenario === "S001") await frame.locator('[data-enterprise-domain]').selectOption("S001");
        await frame.locator("#continue-analysis").click();
        await frame.locator('[data-navigate-module="report"]').click();
        frame = await frameFor(page, "report");
        await frame.locator('[data-ofw-native-action="report-open"]').first().click();
        await frame.locator("[data-report-block]").first().waitFor();
        assert.match(await frame.locator(".report-editor").innerText(), new RegExp(scenario === "S001" ? "环保测试公司4|单位553" : name));
        const draft = await page.evaluate((scenarioId) => window.OFW_WORKFLOW.readReport(scenarioId), scenario);
        assert.equal(draft.contentBlocks.at(-1).workspaceContext.activeObjectRef.id, id);
        assert.ok(draft.contentBlocks.at(-1).rows.length > 0);
        await frame.locator('[data-ofw-report-action="source"]').first().click();
        frame = await frameFor(page, "m07");
        await frame.waitForFunction((objectId) => window.__OFW_M07_DEBUG__?.getContext().activeObjectRef?.id === objectId, id);
        return { objectId: id, reportRows: draft.contentBlocks.at(-1).rows.length };
      });
    }

    await check(`${viewport.width}: report editing, reorder, delete, undo, export and reload`, async () => {
      const frame = await go(page, "report");
      await frame.locator('[data-ofw-native-action="report-open"]').first().click();
      const initial = await frame.locator("[data-report-block]").count();
      await frame.locator("[data-report-title]").fill("投后复核工作记录");
      await frame.locator('[data-ofw-report-action="add"]').click();
      await frame.locator('[data-report-field="text"]').last().fill("保留缺失原因，不将缺失值补零。");
      await frame.locator('[data-ofw-report-action="up"]').last().click();
      await frame.locator('[data-ofw-report-action="delete"]').first().click();
      assert.equal(await frame.locator("[data-report-block]").count(), initial);
      await frame.locator('[data-ofw-report-action="undo"]').click();
      assert.equal(await frame.locator("[data-report-block]").count(), initial + 1);
      await frame.locator('[data-ofw-report-action="preview"]').click();
      assert.match(await frame.locator(".report-editor").innerText(), /保留缺失原因/);
      const pending = page.waitForEvent("download");
      await frame.locator('[data-ofw-report-action="export"]').click();
      const download = await pending;
      const file = path.join(output, `report-${viewport.width}.html`);
      await download.saveAs(file);
      const text = await readFile(file, "utf8");
      assert.match(text, /投后复核工作记录/); assert.match(text, /保留缺失原因/); assert.match(text, /PRD-40A100000000B2C7|基金 B/);
      await screenshot(page, `report-${viewport.width}.png`);
      await page.reload();
      const reloaded = await frameFor(page, "report");
      await reloaded.locator('[data-ofw-native-action="report-open"]').first().click();
      assert.equal(await reloaded.locator("[data-report-title]").inputValue(), "投后复核工作记录");
      return { blocks: initial + 1, exported: path.basename(file) };
    });

    await check(`${viewport.width}: model target survives module round trip`, async () => {
      let frame = await go(page, "modeling");
      await frame.locator('[data-select-target="S003"]').click();
      await page.waitForFunction(() => window.OFW_V131_STORE.get().activeScenarioId === "S003");
      await go(page, "query");
      frame = await go(page, "modeling");
      assert.equal(await page.evaluate(() => window.OFW_V131_STORE.get().activeScenarioId), "S003");
      await screenshot(page, `model-${viewport.width}.png`);
    });
    await check(`${viewport.width}: unavailable model service can recover`, async () => {
      await page.route(`${runtime.modelingUrl}/**`, (route) => route.abort());
      await page.getByRole('button', { name: '重新读取当前模块', exact: true }).click();
      let frame = await frameFor(page, "modeling");
      await frame.getByText("模型服务暂不可用", { exact: true }).waitFor();
      assert.doesNotMatch(await frame.locator('body').innerText(), /正在读取模型目标/);
      await page.unroute(`${runtime.modelingUrl}/**`);
      await frame.getByRole('button', { name: '重新连接', exact: true }).click();
      await frame.locator('[data-select-target="S003"]').waitFor();
    });
    await context.close();
  }
} finally {
  await browser.close();
  await runtime.close();
  const evidence = { version: "v1.3.2-rc.1", observedAt: new Date().toISOString(), checks, errors, passed: checks.filter((item) => item.status === "passed").length, failed: checks.filter((item) => item.status === "failed").length, acceptanceReady: false };
  await writeFile(path.join(output, "regression.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ passed: evidence.passed, failed: evidence.failed, errors }, null, 2));
  if (evidence.failed || errors.length) process.exitCode = 1;
}
