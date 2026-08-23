#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PLAYWRIGHT_ROOT = process.env.PLAYWRIGHT_NODE_MODULES || "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const ORIGIN = process.env.S003_BROWSER_ORIGIN || "http://127.0.0.1:4333";
const SCENARIO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_ROOT = path.resolve(process.env.S003_CP14_BROWSER_OUTPUT || path.join(SCENARIO_ROOT, "evidence", "browser-cp14"));
const RUN_ID = `${new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}-${crypto.randomBytes(4).toString("hex")}`;
const RUN_DIR = path.join(OUTPUT_ROOT, RUN_ID);
const TIMEOUT = 30_000;
const FORMAL = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260815133000000-c03503000001",
  formedAt: "2026-08-15T13:30:00.000Z",
  status: "active"
});

const MODULES = Object.freeze([
  { id: "data", path: /data-engineering-prototype-review\/review-v3\/(?:%E6%96%B9%E6%A1%88B2|方案B2)\.html/, marker: "数据资源" },
  { id: "ontology", path: /ontology-management-review\/canvas-first\/index\.html/, marker: "本体建模" },
  { id: "query", path: /intelligent-query-prototype\/review-next\/conversation-workspace\/index\.html/, marker: "已发布风险问数投影" },
  { id: "decision", path: /decision-center-prototype\/(?:index\.html|review-v2\/action-portfolio\.html)/, marker: "待人工确认" },
  { id: "agent", path: /agent-application\/(?:Agent%E5%BA%94%E7%94%A8|Agent应用)\.html/, marker: "一期不建设专属 Agent" },
  { id: "report", path: /report-center\/review-lifecycle\/index\.html/, marker: "报告目录" }
]);

function shellUrl(scenarioId, hash) {
  if (scenarioId === "S001") return `${ORIGIN}/s001-e2e-integration/index.html?scenarioId=S001${hash}`;
  const query = new URLSearchParams({
    scenarioId: FORMAL.scenarioId,
    scenarioVersion: FORMAL.scenarioVersion,
    scenarioRunId: FORMAL.scenarioRunId,
    scenarioFormedAt: FORMAL.formedAt,
    scenarioStatus: FORMAL.status
  });
  return `${ORIGIN}/s001-e2e-integration/index.html?${query}${hash}`;
}

function attachDiagnostics(page) {
  const value = { consoleErrors: [], pageErrors: [], requestErrors: [], httpErrors: [] };
  page.on("console", message => { if (message.type() === "error") value.consoleErrors.push(message.text()); });
  page.on("pageerror", error => value.pageErrors.push(error.message));
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(reason)) value.requestErrors.push({ url: request.url(), reason });
  });
  page.on("response", response => { if (response.status() >= 400) value.httpErrors.push({ url: response.url(), status: response.status() }); });
  return value;
}

function assertClean(value) {
  assert.deepEqual(value.consoleErrors, []);
  assert.deepEqual(value.pageErrors, []);
  assert.deepEqual(value.requestErrors, []);
  assert.deepEqual(value.httpErrors, []);
}

async function openShell(browser, scenarioId = "S003", hash = "#home") {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: "zh-CN", timezoneId: "Asia/Shanghai", acceptDownloads: true });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);
  await page.goto(shellUrl(scenarioId, hash), { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  if (scenarioId === "S003") {
    await page.waitForFunction(() => window.S003Store?.getRuntimeSnapshot?.()?.ready === true, null, { timeout: TIMEOUT });
  } else {
    await page.waitForFunction(() => window.S001_STORE?.getScenarioContext?.("S001")?.scenarioId === "S001", null, { timeout: TIMEOUT });
  }
  await page.locator(".scenario-workspace").waitFor({ state: "visible", timeout: TIMEOUT });
  return { context, page, diagnostics };
}

async function currentFrame(page) {
  const handle = await page.locator("#module-frame").elementHandle({ timeout: TIMEOUT });
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error("模块 iframe 未形成");
  return frame;
}

async function waitFrame(page, expected) {
  const started = Date.now();
  let frame;
  while (Date.now() - started < TIMEOUT) {
    frame = await currentFrame(page).catch(() => null);
    if (frame && expected.path.test(decodeURI(frame.url()))) {
      const body = await frame.locator("body").innerText().catch(() => "");
      if (!expected.marker || body.includes(expected.marker)) return frame;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${expected.id} 未进入基线原生页面：${frame?.url() || "无 iframe"}`);
}

async function navigateModule(page, expected) {
  await page.locator(`.nav-item[data-route="#module/${expected.id}"]`).click();
  await page.waitForFunction(id => location.hash === `#module/${id}`, expected.id, { timeout: TIMEOUT });
  return waitFrame(page, expected);
}

function runIdFrom(value) {
  return new URL(value).searchParams.get("scenarioRunId");
}

async function caseShellAndModules(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#home");
  const labels = (await page.locator(".primary-nav .nav-item span").allTextContents()).map(value => value.trim()).filter(Boolean);
  assert.deepEqual(labels, ["首页", "数据工程", "本体管理", "智能问数", "决策中心", "Agent 应用", "报告中心", "仪表盘"]);
  assert.equal(await page.locator(".global-nav .nav-context").count(), 0, "S003 左栏不应重复显示第二层场景标签");
  assert.match(await page.locator(".nav-foot strong").innerText(), /历史节点 15\/15/);

  const results = {};
  for (const expected of MODULES) {
    const frame = await navigateModule(page, expected);
    assert.equal(runIdFrom(frame.url()), FORMAL.scenarioRunId, `${expected.id} 运行身份不一致`);
    assert.doesNotMatch(decodeURI(frame.url()), /\/scenarios\/s003\/(?:index|runtime)/);
    results[expected.id] = { url: frame.url(), bodyMarker: expected.marker };
  }

  const dataFrame = await navigateModule(page, MODULES[0]);
  await dataFrame.waitForFunction(() => {
    const text = document.querySelector(".source-resource-table")?.innerText || "";
    return text.includes("调节因子配置") && text.includes("风险分档配置");
  }, null, { timeout: TIMEOUT });
  const directory = await dataFrame.locator(".source-resource-table").innerText();
  for (const name of ["企业债务风险评估模版", "调节因子配置", "风险分档配置"]) assert.match(directory, new RegExp(name));
  assert.equal(await dataFrame.locator(".source-resource-table tbody tr").count() >= 3, true);

  const queryFrame = await navigateModule(page, MODULES[2]);
  await queryFrame.getByLabel("S003 已发布风险问数投影").waitFor({ state: "visible", timeout: TIMEOUT });
  assert.match(await queryFrame.locator("body").innerText(), /固定的 6 个只读风险问数|常用问题\s*6/);

  const decisionFrame = await navigateModule(page, MODULES[3]);
  const decisionText = await decisionFrame.locator("body").innerText();
  assert.match(decisionText, /8 条未确认候选|待人工确认/);
  assert.match(decisionText, /Action Request/);

  const agentFrame = await navigateModule(page, MODULES[4]);
  const agentText = await agentFrame.locator("body").innerText();
  assert.match(agentText, /一期不建设专属 Agent/);
  assert.match(agentText, /以下 3 个能力不会自动绑定/);

  const reportFrame = await navigateModule(page, MODULES[5]);
  await reportFrame.waitForFunction(() => window.S003ReportModuleHealth?.()?.status !== "checking", null, { timeout: TIMEOUT });
  await reportFrame.waitForFunction(() => document.body?.innerText?.includes("正式报告") && document.body?.innerText?.includes("21"), null, { timeout: TIMEOUT });
  const reportText = await reportFrame.locator("body").innerText();
  assert.match(reportText, /正式报告\s*21/);
  assert.doesNotMatch(reportText, /S003 场景工作台/);
  assert.equal(await reportFrame.locator(".product-nav-item").filter({ hasText: "S003 场景工作台" }).count(), 0);

  await page.screenshot({ path: path.join(RUN_DIR, "shell-and-modules.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { labels, modules: results, sourceCount: 3 };
}

async function caseM01Canvas(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#module/ontology");
  const frame = await waitFrame(page, MODULES[1]);
  await frame.locator("[data-s003-m01-modeling-summary]").waitFor({ state: "visible", timeout: TIMEOUT });
  await frame.locator('[data-s003-m01-open-version="canvas"]').click();
  await frame.locator('.published-canvas-panel[data-s003-m01-canvas-enhanced="true"]').waitFor({ state: "visible", timeout: TIMEOUT });
  const nodes = frame.locator(".published-canvas-world > .canvas-node");
  const edges = frame.locator(".published-canvas-world > .edge-layer .edge");
  assert.equal(await nodes.count(), 34);
  assert.equal(await edges.count(), 18);
  const overlaps = await frame.locator(".published-canvas-world").evaluate(world => {
    const items = [...world.querySelectorAll(":scope > .canvas-node")].map(node => ({ id: node.dataset.node, left: parseFloat(node.style.left), top: parseFloat(node.style.top), right: parseFloat(node.style.left) + node.offsetWidth, bottom: parseFloat(node.style.top) + node.offsetHeight }));
    const pairs = [];
    for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]; const b = items[j];
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) pairs.push([a.id, b.id]);
    }
    return pairs;
  });
  assert.deepEqual(overlaps, []);

  const scroll = frame.locator(".published-canvas-scroll");
  const world = frame.locator(".published-canvas-world");
  const beforeScale = await world.getAttribute("style");
  await scroll.hover();
  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(120);
  const afterScale = await world.getAttribute("style");
  assert.notEqual(afterScale, beforeScale, "鼠标滚轮未改变画布比例");

  const first = nodes.first();
  const beforePosition = await first.getAttribute("style");
  const box = await first.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 48, box.y + box.height / 2 + 28, { steps: 5 });
  await page.mouse.up();
  const movedPosition = await first.getAttribute("style");
  assert.notEqual(movedPosition, beforePosition, "画布节点拖动未生效");
  await frame.locator("[data-s003-m01-canvas-reset-layout]").click();
  await page.waitForTimeout(100);
  assert.equal(await first.getAttribute("style"), beforePosition, "恢复布局未恢复节点位置");

  await page.screenshot({ path: path.join(RUN_DIR, "m01-published-canvas.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { nodeCount: 34, edgeCount: 18, overlaps, wheelZoomed: true, nodeDragged: true };
}

async function caseDashboardAndReport(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#dashboard");
  let frame = await waitFrame(page, { id: "dashboard", path: MODULES[5].path, marker: "集团债务风险监测" });
  const dashboardText = await frame.locator("body").innerText();
  for (const token of ["企业风险评分明细", "产业板块与集团高频弱项", "债务风险触发与行动", "风险分档分布与口径", "风电测试公司01", "环保测试公司4"]) assert.match(dashboardText, new RegExp(token));
  assert.equal(await frame.locator('button[data-action="s003-open-formal-report"]').count(), 21);
  assert.match(dashboardText, /风险分档跟踪/);
  assert.match(dashboardText, /重大因子应急/);
  assert.match(dashboardText, /专项风险处置/);

  await frame.locator('button[data-action="s003-set-tab"][data-tab="configuration"]').first().click();
  const configText = await frame.locator("body").innerText();
  for (const token of ["调节因子配置", "风险分档配置", "企业因子输入版本", "采用配置并快速重跑"]) assert.match(configText, new RegExp(token));

  await frame.locator('button[data-action="s003-set-tab"][data-tab="overview"]').first().click();
  await frame.locator('button[data-action="s003-open-formal-report"]').first().click();
  await page.waitForFunction(() => location.hash === "#module/report", null, { timeout: TIMEOUT });
  const startedAt = Date.now();
  while (Date.now() - startedAt < TIMEOUT) {
    const candidate = await currentFrame(page).catch(() => null);
    if (candidate && /#\/reports\/s003\?/.test(candidate.url())) {
      frame = candidate;
      break;
    }
    await page.waitForTimeout(100);
  }
  assert.match(frame.url(), /#\/reports\/s003\?/);
  await frame.getByText("债务风险评估报告", { exact: false }).first().waitFor({ state: "visible", timeout: TIMEOUT });
  const reportText = await frame.locator("body").innerText();
  for (const token of ["总体结论", "关键风险诊断", "调节因子", "财务指标评分明细", "报告核验", "报告伴读", "8/8 通过", "版本与证据"]) assert.match(reportText, new RegExp(token));
  assert.match(reportText, /8\/8/);

  await page.screenshot({ path: path.join(RUN_DIR, "dashboard-enterprise-report.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { enterpriseRows: 21, actionTypes: 3, reportSections: 8 };
}

async function caseQuickRerunAndHistory(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S003", "#dashboard");
  let frame = await waitFrame(page, { id: "dashboard", path: MODULES[5].path, marker: "集团债务风险监测" });
  const oldSnapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  const oldRunId = oldSnapshot.context.scenarioRunId;
  const oldFrameUrl = frame.url();
  await frame.locator('button[data-action="s003-request-rerun"]:visible').first().click();
  await page.locator('[data-modal-panel] [data-action="confirm-reset"]').waitFor({ state: "visible", timeout: TIMEOUT });
  await page.locator('[data-modal-panel] [data-action="confirm-reset"]').click();
  await page.waitForFunction(previous => window.S003Store?.getRuntimeSnapshot?.()?.context?.scenarioRunId !== previous, oldRunId, { timeout: TIMEOUT });
  const nextRunId = await page.evaluate(() => window.S003Store.getRuntimeSnapshot().context.scenarioRunId);
  await page.waitForFunction(runId => new URL(location.href).searchParams.get("scenarioRunId") === runId, nextRunId, { timeout: TIMEOUT });
  await page.waitForFunction(runId => {
    const item = document.querySelector("#module-frame");
    return item && new URL(item.src).searchParams.get("scenarioRunId") === runId && item.dataset.dashboardRunId === runId;
  }, nextRunId, { timeout: TIMEOUT });
  frame = await currentFrame(page);
  await frame.waitForFunction(runId => location.href.includes(runId) && document.body?.innerText?.includes("当前工作投影"), nextRunId, { timeout: TIMEOUT });
  const runSelect = frame.locator('select[data-change="s003-run-selection"]');
  const options = await runSelect.locator("option").allTextContents();
  assert.equal(options.length, 2);
  assert.match(options[0], /工作投影/);
  assert.match(options[1], /正式运行/);

  let snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.context.scenarioRunId, nextRunId);
  assert.equal(snapshot.activeRun.runId, nextRunId);
  assert.equal(snapshot.activeRun.projectionOnly, true);
  assert.equal(snapshot.lastSuccessfulRun.runId, oldRunId);
  assert.deepEqual(snapshot.decisions, []);

  await runSelect.selectOption(oldRunId);
  await frame.waitForFunction(runId => document.body?.innerText?.includes("历史快照 · 只读") && document.body?.innerText?.includes(runId), oldRunId, { timeout: TIMEOUT });
  snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.context.scenarioRunId, nextRunId, "切换历史运行覆盖了当前运行身份");
  assert.equal(snapshot.activeRun.runId, nextRunId);
  assert.deepEqual(snapshot.decisions, []);
  await runSelect.selectOption(nextRunId);
  await frame.waitForFunction(() => document.body?.innerText?.includes("当前工作投影"), null, { timeout: TIMEOUT });

  const final = await page.evaluate(() => {
    const snapshot = window.S003Store.getRuntimeSnapshot();
    const iframe = document.querySelector("#module-frame");
    return { shellUrl: location.href, frameUrl: iframe?.src, frameRunId: iframe?.dataset.dashboardRunId, context: snapshot.context, activeRunId: snapshot.activeRun?.runId, lastSuccessfulRunId: snapshot.lastSuccessfulRun?.runId, decisionCount: snapshot.decisions?.length || 0 };
  });
  assert.equal(runIdFrom(final.shellUrl), nextRunId);
  assert.equal(runIdFrom(final.frameUrl), nextRunId);
  assert.equal(final.frameRunId, nextRunId);
  assert.equal(final.decisionCount, 0);
  assert.notEqual(oldFrameUrl, final.frameUrl);
  await page.screenshot({ path: path.join(RUN_DIR, "quick-rerun-current-projection.png"), fullPage: false });
  assertClean(diagnostics);
  await context.close();
  return { oldRunId, nextRunId, options, final, historicalSideEffectsReplayed: false };
}

async function caseS001Isolation(browser) {
  const { context, page, diagnostics } = await openShell(browser, "S001", "#home");
  const body = await page.locator("body").innerText();
  assert.match(body, /S001 · 融资成本洞察与行动闭环/);
  const checked = [];
  for (const expected of MODULES) {
    const frame = await navigateModule(page, { ...expected, marker: "" });
    const url = new URL(frame.url());
    assert.equal(url.searchParams.get("scenarioId"), "S001");
    const state = await frame.evaluate(() => ({
      htmlScenario: document.documentElement.dataset.ofwScenario || null,
      m01: window.ONTOLOGY_SCENARIO_EXTENSION?.scenarioId === "S003",
      m02: window.DE_SCENARIO_EXTENSION?.scenarioId === "S003" || window.DE_SCENARIO_EXTENSION?.isActive === true,
      m03: window.S003IQNativeBridge?.isActive === true,
      m04: Boolean(window.S003DecisionAdapter?.isActive?.({ scenarioId: "S001" })),
      m05: window.S003AgentAdapter?.isActive === true,
      m06: [...document.querySelectorAll(".product-nav-item")].some(item => item.textContent.includes("S003 场景工作台"))
    }));
    assert.equal(state.htmlScenario === "S003", false);
    assert.deepEqual([state.m01, state.m02, state.m03, state.m04, state.m05, state.m06], [false, false, false, false, false, false]);
    checked.push({ module: expected.id, url: frame.url() });
  }
  assertClean(diagnostics);
  await context.close();
  return { checked };
}

async function runCase(browser, id, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn(browser);
    process.stdout.write(`PASS ${id}\n`);
    return { id, status: "passed", durationMs: Date.now() - startedAt, details };
  } catch (error) {
    process.stdout.write(`FAIL ${id} ${error.message}\n`);
    return { id, status: "failed", durationMs: Date.now() - startedAt, error: { name: error.name, message: error.message, stack: error.stack } };
  }
}

async function main() {
  fs.mkdirSync(RUN_DIR, { recursive: true });
  const { chromium } = require(path.join(PLAYWRIGHT_ROOT, "playwright"));
  const browser = await chromium.launch({ headless: process.env.S003_BROWSER_HEADED !== "1" });
  const cases = [];
  for (const [id, fn] of [
    ["shell-and-modules", caseShellAndModules],
    ["m01-canvas", caseM01Canvas],
    ["dashboard-and-report", caseDashboardAndReport],
    ["quick-rerun-and-history", caseQuickRerunAndHistory],
    ["s001-isolation", caseS001Isolation]
  ]) cases.push(await runCase(browser, id, fn));
  const browserVersion = browser.version();
  await browser.close();
  const result = {
    schemaVersion: "ofw.s003.browser-cp14-result.v1",
    runId: RUN_ID,
    formedAt: new Date().toISOString(),
    origin: ORIGIN,
    formalSourceScenarioRunId: FORMAL.scenarioRunId,
    browserVersion,
    cases,
    totals: { cases: cases.length, passed: cases.filter(item => item.status === "passed").length, failed: cases.filter(item => item.status === "failed").length },
    checkpointCreated: false,
    acceptanceReady: false
  };
  const output = path.join(RUN_DIR, "browser-cp14-results.json");
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`RESULT ${output}\n`);
  if (result.totals.failed) process.exitCode = 1;
}

main().catch(error => { process.stderr.write(`${error.stack || error.message}\n`); process.exitCode = 1; });
