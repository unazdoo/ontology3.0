import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startCandidate } from "../start-candidate.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const output = fileURLToPath(new URL("../evidence/v11-parity/", import.meta.url));
await mkdir(output, { recursive: true });
const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const checks = [], errors = [];
let page;
async function check(name, run) {
  try { checks.push({ name, status: "passed", detail: await run() }); console.log(`PASS ${name}`); }
  catch (error) { checks.push({ name, status: "failed", error: error.message }); console.error(`FAIL ${name}: ${error.message}`); await page.screenshot({ path: path.join(output, `failure-${checks.length}.png`) }).catch(() => {}); }
}
async function frameFor(id) {
  await page.locator(`#module-frame[data-module-id="${id}"]`).waitFor();
  const frame = await (await page.locator("#module-frame").elementHandle()).contentFrame();
  await frame.waitForFunction(() => document.body?.innerText.length > 30 && window.__OFW_NATIVE_MODULE_INTEGRATION__);
  return frame;
}
async function module(id) {
  await page.locator(`[data-primary-nav][data-route="#module/${id}"]`).click();
  return frameFor(id);
}
async function task(id, moduleId, width) {
  if (width <= 620) await page.locator(`[data-module-task-select="${moduleId}"]`).selectOption(id);
  else await page.locator(`[data-module-id="${moduleId}"][data-module-task="${id}"]`).click();
}
async function shot(name) {
  await page.waitForTimeout(200);
  await page.locator('#toast-region .toast').waitFor({ state: 'detached', timeout: 5000 });
  await page.screenshot({ path: path.join(output, name) });
}

try {
  // API setup supplies a real candidate; the journeys below use ordinary UI controls.
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models"]) {
    const response = await fetch(`${runtime.modelingUrl}/v1/model-management/actions/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: "S003", payload: {} }) });
    assert.ok(response.ok, action);
  }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: "reduce" });
    page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => errors.push({ width: viewport.width, message: error.message }));
    await page.goto(runtime.entryUrl);
    await check(`${viewport.width}: query settings and original view catalog`, async () => {
      const frame = await module("query");
      await task("settings", "query", viewport.width);
      await frame.waitForFunction(() => location.hash === "#/agent" && document.body.innerText.includes("智能问数助手"));
      await frame.waitForFunction(() => !document.querySelector('[data-ofw-workspace-context]'));
      const heading = await frame.locator('h1').first().innerText();
      await task("views", "query", viewport.width);
      await frame.waitForFunction(() => location.hash === "#/views" && document.body.innerText.includes("问数视图"));
      return { settings: heading };
    });

    await check(`${viewport.width}: Agent configuration and orchestration creation`, async () => {
      const frame = await module("agent");
      await task("resources", "agent", viewport.width);
      await frame.waitForFunction(() => location.hash === "#/resources" && document.body.innerText.includes("Prompt"));
      const text = await frame.locator('body').innerText();
      for (const kind of ['Prompt', 'Skill', 'Tool']) assert.ok(text.includes(kind));
      await task("orchestrations", "agent", viewport.width);
      await frame.getByRole('button', { name: '创建编排', exact: true }).first().click();
      await frame.locator('[role="dialog"]').waitFor();
      assert.match(await frame.locator('[role="dialog"]').innerText(), /编排/);
      await shot(`agent-authoring-${viewport.width}.png`);
      await frame.locator('[role="dialog"]').press('Escape');
    });

    await check(`${viewport.width}: model answer CSV, persistent history and report handoff`, async () => {
      let frame = await module("query");
      await task("ask", "query", viewport.width);
      await frame.locator('[data-ofw-model-question="未来90天最需要关注哪些企业？"]').click();
      await frame.locator('#ofw-native-query-answer .ofw-native-query-row').first().waitFor();
      const rows = await frame.locator('#ofw-native-query-answer .ofw-native-query-row').count();
      const saved = await page.evaluate(() => window.OFW_WORKFLOW.readQueryHistory()[0]);
      assert.equal(saved.scenarioId, 'S003'); assert.equal(saved.answer.rows.length, rows);
      const pending = page.waitForEvent('download');
      await frame.locator('[data-ofw-native-action="query-export"]').first().click();
      const download = await pending; const destination = path.join(output, `query-${viewport.width}.csv`);
      await download.saveAs(destination);
      const csv = await readFile(destination, 'utf8');
      assert.match(csv, /S003/); assert.ok(csv.includes(saved.answer.runtimeContext.state.results.candidateEnvelope.modelVersionId));
      await module('ontology'); frame = await module('query');
      await task('history', 'query', viewport.width);
      await frame.locator('[data-ofw-native-action="query-history-open"]').first().click();
      assert.match(await frame.locator('#ofw-native-drawer-root').innerText(), /未来90天/);
      await shot(`query-history-${viewport.width}.png`);
      await frame.locator('#ofw-native-drawer-root [data-ofw-native-route="#module/report"]').click();
      frame = await frameFor('report');
      await frame.locator('[data-ofw-native-action="report-open"]').first().click();
      const draft = await page.evaluate(() => window.OFW_WORKFLOW.readReport('S003'));
      assert.equal(draft.contentBlocks.at(-1).rows.length, rows);
      assert.equal(draft.contentBlocks.at(-1).modelVersionId, saved.answer.runtimeContext.state.results.candidateEnvelope.modelVersionId);
      await page.reload(); frame = await frameFor('report');
      assert.ok((await page.evaluate(() => window.OFW_WORKFLOW.readQueryHistory())).length > 0);
      return { rows, version: draft.contentBlocks.at(-1).modelVersionId };
    });

    await check(`${viewport.width}: decision summaries reach original request and trace pages`, async () => {
      const frame = await module('decision');
      await task('todos', 'decision', viewport.width);
      await frame.getByRole('heading', { name: '决策运营概览', exact: true }).waitFor();
      for (const filter of ['all', 'review', 'executing', 'blocked']) {
        const button = frame.locator(`.ofw-ops-metrics [data-filter="${filter}"]`);
        const count = Number(await button.locator('strong').innerText());
        await button.click();
        assert.equal(await frame.locator('.ofw-ops-table > button').count(), count, filter);
      }
      await frame.locator('.ofw-ops-metrics [data-filter="executing"]').click();
      assert.ok(await frame.locator('.ofw-ops-table > button').count() > 0);
      await frame.locator('.ofw-ops-table > button').first().click();
      await frame.getByRole('button', { name: '查看行动申请', exact: true }).click();
      await frame.waitForFunction(() => location.hash.startsWith('#request/'));
      await frame.locator('[data-ofw-native-action="decision-return-tracking"]').click();
      await frame.locator('.ofw-ops-table > button').first().click();
      await frame.getByRole('button', { name: '处理负责人待办', exact: true }).click();
      await frame.waitForFunction(() => location.hash.startsWith('#task/'));
      await frame.locator('[data-ofw-native-action="decision-return-tracking"]').click();
      await frame.locator('.ofw-ops-table > button').first().click();
      await frame.getByRole('button', { name: '全链路追溯', exact: true }).click();
      await frame.waitForFunction(() => location.hash.startsWith('#trace/request/'));
      await frame.locator('.trace-page').waitFor();
      await page.waitForFunction(() => document.querySelector('#frame-breadcrumb-current')?.textContent.includes('这项行动是如何产生的'));
      await shot(`decision-trace-${viewport.width}.png`);
      await frame.locator('[data-ofw-native-action="decision-return-tracking"]').click();
    });

    await check(`${viewport.width}: frozen report creation, reading, copilot and verification retained`, async () => {
      const frame = await module('report');
      await task('create', 'report', viewport.width);
      await frame.getByRole('heading', { name: '创建与生成', exact: true }).waitFor();
      await task('definitions', 'report', viewport.width);
      await frame.getByRole('heading', { name: '报告定义与模板', exact: true }).waitFor();
      await task('catalog', 'report', viewport.width);
      await frame.locator('a[href^="#/report/"]:visible').first().click();
      await frame.locator('.report-document-frame').waitFor();
      const reportTitle = await frame.locator('.reader-title strong').innerText();
      await page.waitForFunction((title) => document.querySelector('#frame-breadcrumb-current')?.textContent === title, reportTitle);
      await frame.locator('.report-document-frame').evaluate((node) => { window.__V11_READER_FRAME__ = node; });
      const source = await frame.locator('.report-document-frame').getAttribute('src');
      const before = await (await fetch(new URL(source, frame.url()))).text();
      await frame.locator('[data-action="ask-report"]').first().click();
      await frame.waitForFunction(() => document.querySelector('#chat-question')?.disabled === false && (document.querySelector('.reader-chat')?.innerText.length || 0) > 160, null, { timeout: 20000 });
      await frame.locator('[data-action="set-reader-panel"][data-panel="verification"]').click();
      await frame.locator('[data-action="run-verification"]').click();
      await frame.getByText('本次核验已完成', { exact: false }).first().waitFor({ timeout: 20000 });
      assert.equal(await frame.locator('.report-document-frame').evaluate((node) => node === window.__V11_READER_FRAME__), true);
      assert.equal(await (await fetch(new URL(source, frame.url()))).text(), before);
      await shot(`report-verification-${viewport.width}.png`);
      return { immutableSource: true, readerFrameReloaded: false };
    });
    await context.close();
  }
} finally {
  await browser.close(); await runtime.close();
  const result = { version: 'v1.4-rc.1', referenceVersion: 'v1.1.0', observedAt: new Date().toISOString(), checks, errors, passed: checks.filter((item) => item.status === 'passed').length, failed: checks.filter((item) => item.status === 'failed').length };
  await writeFile(path.join(output, 'regression.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, failed: result.failed, errors }, null, 2));
  if (result.failed || errors.length) process.exitCode = 1;
}
