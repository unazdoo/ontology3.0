#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PLAYWRIGHT_NODE_MODULES = "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const DEFAULT_ORIGIN = "http://127.0.0.1:4333";
const SCENARIO_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(SCENARIO_ROOT, "../../../../..");
const DEFAULT_OUTPUT_ROOT = path.join(SCENARIO_ROOT, "evidence", "browser-cp13");
const READY_TIMEOUT_MS = 30_000;
const MODULE_TIMEOUT_MS = 30_000;
const STORAGE_SCHEMA_VERSION = "ofw.namespaced-storage.v1";
const FORMAL_CONTEXT = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260815133000000-c03503000001",
  formedAt: "2026-08-15T13:30:00.000Z",
  status: "active"
});

const MODULE_EXPECTATIONS = Object.freeze([
  { key: "ontology", healthId: "M01", path: /ontology-management-review\/canvas-first\/index\.html/, texts: ["本体建模"] },
  { key: "data", healthId: "M02", path: /data-engineering-prototype-review\/review-v3\/(?:%E6%96%B9%E6%A1%88B2|方案B2)\.html/, texts: ["数据工程", "数据资源"] },
  { key: "query", healthId: "M03", path: /intelligent-query-prototype\/review-next\/conversation-workspace\/index\.html/, texts: ["智能问数"] },
  { key: "decision", healthId: "M04", path: /decision-center-prototype\/(?:index\.html|review-v2\/action-portfolio\.html)/, texts: ["决策中心"] },
  { key: "agent", healthId: "M05", path: /agent-application\/(?:Agent%E5%BA%94%E7%94%A8|Agent应用)\.html/, texts: ["Agent"] },
  { key: "report", healthId: "M06", path: /report-center\/review-lifecycle\/index\.html/, texts: ["报告中心"] }
]);

const TEST_PLAN = Object.freeze([
  ["health-gating", "首页初始 checking；逐个真实打开 M01—M06 后才健康"],
  ["m02-native-detail", "M02 基线目录与数据源详情结构复用"],
  ["m03-incompatible-projection", "M03 不兼容工作投影原字节保留并写入恢复键"],
  ["m04-incompatible-projections", "M04 state/view/projection 不兼容记录隔离与 React 重建"],
  ["m01-legacy-bootstrap-projection", "M01 旧 S001 启动投影显式隔离并重建"],
  ["m01-dynamic-publish", "M01 实际发布 1.0.2，保留 1.0.1 历史并精确更新 C008"],
  ["m06-native-routes", "M06 原生目录、资源、生成、draft/view/pdf 与条件式工作台"],
  ["m06-v2-priority", "M06 健康 v2 优先于 stale session legacy"],
  ["m06-reset-new-run", "M06 重置只请求统一壳创建新 scenarioRunId"],
  ["module-failure-home-health", "模块页面失败时首页不得显示当前运行健康"],
  ["s001-six-module-isolation", "S001 六模块真实回归且无 S003 条件装入泄漏"]
]);

function parseArgs(argv) {
  const result = {
    origin: process.env.S003_BROWSER_ORIGIN || DEFAULT_ORIGIN,
    outputRoot: path.resolve(process.env.S003_BROWSER_OUTPUT_ROOT || DEFAULT_OUTPUT_ROOT),
    playwrightNodeModules: path.resolve(process.env.PLAYWRIGHT_NODE_MODULES || DEFAULT_PLAYWRIGHT_NODE_MODULES),
    headed: false,
    screenshots: true,
    list: false,
    only: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--origin") result.origin = argv[++index];
    else if (arg === "--output-root") result.outputRoot = path.resolve(argv[++index]);
    else if (arg === "--playwright-node-modules") result.playwrightNodeModules = path.resolve(argv[++index]);
    else if (arg === "--headed") result.headed = true;
    else if (arg === "--no-screenshots") result.screenshots = false;
    else if (arg === "--list") result.list = true;
    else if (arg === "--only") result.only = new Set(String(argv[++index] || "").split(",").map((value) => value.trim()).filter(Boolean));
    else throw new Error(`未知参数: ${arg}`);
  }
  return result;
}

function loadPlaywright(nodeModulesRoot) {
  const modulePath = path.join(nodeModulesRoot, "playwright");
  if (!fs.existsSync(modulePath)) throw new Error(`Playwright 不存在: ${modulePath}`);
  return require(modulePath);
}

function isoCompact(value = new Date()) {
  return value.toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gitHead() {
  try {
    return childProcess.execFileSync("git", ["rev-parse", "HEAD"], { cwd: WORKSPACE_ROOT, encoding: "utf8" }).trim();
  } catch (_) {
    return null;
  }
}

function s003Url(origin, hash = "#home") {
  const query = new URLSearchParams({
    scenarioId: FORMAL_CONTEXT.scenarioId,
    scenarioVersion: FORMAL_CONTEXT.scenarioVersion,
    scenarioRunId: FORMAL_CONTEXT.scenarioRunId,
    scenarioFormedAt: FORMAL_CONTEXT.formedAt,
    scenarioStatus: FORMAL_CONTEXT.status
  });
  return `${origin}/s001-e2e-integration/index.html?${query}${hash}`;
}

function s001Url(origin, hash = "#home") {
  return `${origin}/s001-e2e-integration/index.html?scenarioId=S001${hash}`;
}

function namespacedKey(context, scope, logicalKey) {
  return `ofw:v1.1.0:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}:${scope}:${encodeURIComponent(logicalKey)}`;
}

function namespaceEnvelope(context, payload, schemaVersion = STORAGE_SCHEMA_VERSION) {
  return JSON.stringify({
    schemaVersion,
    scenarioContext: context,
    savedAt: "2026-08-16T10:00:00.000Z",
    payload
  });
}

function attachDiagnostics(page) {
  const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestErrors: [],
    httpErrors: [],
    ignoredAbortedRequests: []
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push({ text: message.text(), location: message.location() });
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push({ name: error.name, message: error.message, stack: error.stack || null }));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown request failure";
    const item = { url: request.url(), method: request.method(), resourceType: request.resourceType(), failure };
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure)) diagnostics.ignoredAbortedRequests.push(item);
    else diagnostics.requestErrors.push(item);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push({ url: response.url(), status: response.status(), statusText: response.statusText() });
  });
  return diagnostics;
}

function assertDiagnosticsClean(diagnostics) {
  assert.equal(diagnostics.consoleErrors.length, 0, `console error 非零: ${JSON.stringify(diagnostics.consoleErrors)}`);
  assert.equal(diagnostics.pageErrors.length, 0, `page error 非零: ${JSON.stringify(diagnostics.pageErrors)}`);
  assert.equal(diagnostics.requestErrors.length, 0, `request error 非零: ${JSON.stringify(diagnostics.requestErrors)}`);
  assert.equal(diagnostics.httpErrors.length, 0, `HTTP error 非零: ${JSON.stringify(diagnostics.httpErrors)}`);
}

async function seedTopLevelStorage(context, seed) {
  await context.addInitScript((input) => {
    if (window.top !== window) return;
    Object.entries(input.local || {}).forEach(([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    });
    Object.entries(input.session || {}).forEach(([key, value]) => {
      if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
    });
  }, seed);
}

async function openS003(page, origin, hash = "#home") {
  await page.goto(s003Url(origin, hash), { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => {
    const snapshot = window.S003Store?.getRuntimeSnapshot?.();
    return Boolean(snapshot?.ready || snapshot?.fatalError);
  }, null, { timeout: READY_TIMEOUT_MS });
  const snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.fatalError, null, snapshot.fatalError || "S003 bootstrap fatalError");
  assert.equal(snapshot.ready, true, "S003 运行服务未就绪");
  await page.locator(".scenario-workspace").waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  return snapshot;
}

async function openS001(page, origin, hash = "#home") {
  await page.goto(s001Url(origin, hash), { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => window.S001_STORE?.getScenarioContext?.("S001")?.scenarioId === "S001", null, { timeout: READY_TIMEOUT_MS });
  await page.locator(".scenario-workspace").waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  return page.evaluate(() => window.S001_STORE.getScenarioContext("S001"));
}

async function currentFrame(page) {
  const handle = await page.locator("#module-frame").elementHandle({ timeout: MODULE_TIMEOUT_MS });
  if (!handle) throw new Error("模块 iframe 不存在");
  const frame = await handle.contentFrame();
  if (!frame) throw new Error("模块 iframe 尚未形成 contentFrame");
  return frame;
}

async function waitForFramePath(page, matcher, expectedTexts = []) {
  const startedAt = Date.now();
  let frame = null;
  let lastUrl = "";
  while (Date.now() - startedAt < MODULE_TIMEOUT_MS) {
    try {
      frame = await currentFrame(page);
      lastUrl = decodeURI(frame.url());
      if (matcher.test(lastUrl)) {
        const body = frame.locator("body");
        await body.waitFor({ state: "attached", timeout: 2_000 });
        const text = await body.innerText().catch(() => "");
        if (expectedTexts.every((item) => text.includes(item))) return frame;
      }
    } catch (_) {}
    await sleep(100);
  }
  throw new Error(`模块 iframe 未进入预期路径或内容，当前 ${lastUrl || frame?.url() || "无 iframe"}`);
}

async function navigateModule(page, expectation, { waitHealth = true } = {}) {
  const selector = `.nav-item[data-route="#module/${expectation.key}"]`;
  await page.locator(selector).click();
  await page.waitForFunction((moduleKey) => window.location.hash === `#module/${moduleKey}`, expectation.key, { timeout: MODULE_TIMEOUT_MS });
  const frame = await waitForFramePath(page, expectation.path, expectation.texts);
  const scenarioId = await page.locator("#module-frame").getAttribute("data-scenario-id");
  if (new URL(page.url()).searchParams.get("scenarioId") === "S003") {
    assert.equal(scenarioId, "S003", `${expectation.key} iframe 未保持 S003 上下文`);
    assert.doesNotMatch(decodeURI(frame.url()), /\/scenarios\/s003\/(?:index|runtime)/, `${expectation.key} 错误跳回 S003 独立原型`);
    if (waitHealth) {
      await page.waitForFunction((moduleId) => {
        const item = window.S003ShellHealth?.getSnapshot?.()?.modules?.[moduleId]?.pageHealth;
        return item && item.status !== "checking";
      }, expectation.healthId, { timeout: MODULE_TIMEOUT_MS });
    }
  } else {
    assert.equal(scenarioId, "S001", `${expectation.key} iframe 未保持 S001 上下文`);
  }
  return frame;
}

async function waitForFrameHash(frame, hash, expectedText) {
  await frame.evaluate((nextHash) => { window.location.hash = nextHash; }, hash);
  await frame.waitForFunction((nextHash) => window.location.hash === nextHash, hash, { timeout: MODULE_TIMEOUT_MS });
  if (expectedText) {
    await frame.waitForFunction((text) => document.body?.innerText?.includes(text), expectedText, { timeout: MODULE_TIMEOUT_MS });
  }
}

async function waitForM06Ready(frame) {
  await frame.waitForFunction(() => {
    const value = window.S003ReportModuleHealth?.();
    return value && value.status !== "checking";
  }, null, { timeout: MODULE_TIMEOUT_MS });
  const health = await frame.evaluate(() => window.S003ReportModuleHealth());
  assert.equal(health.status, "healthy", health.detail);
  assert.equal(health.reportCount, 21);
  return health;
}

async function caseHealthGating(page, record, config) {
  await openS003(page, config.origin, "#home");
  const initial = await page.evaluate(() => window.S003ShellHealth.getSnapshot());
  assert.equal(initial.status, "checking");
  assert.equal(initial.currentRunHealthy, false);
  assert.equal(Object.keys(initial.modulePageHealth).length, 0);
  await page.locator(".home-blocker strong").waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  assert.match(await page.locator(".home-blocker strong").innerText(), /当前运行检查中/);

  const moduleHealth = [];
  for (let index = 0; index < MODULE_EXPECTATIONS.length; index += 1) {
    const expectation = MODULE_EXPECTATIONS[index];
    const frame = await navigateModule(page, expectation);
    const snapshot = await page.evaluate(() => window.S003ShellHealth.getSnapshot());
    const pageHealth = snapshot.modules[expectation.healthId].pageHealth;
    assert.equal(pageHealth.status, "healthy", `${expectation.healthId}: ${pageHealth.detail}`);
    assert.equal(pageHealth.scenarioContext.scenarioRunId, FORMAL_CONTEXT.scenarioRunId);
    if (index < MODULE_EXPECTATIONS.length - 1) assert.equal(snapshot.status, "checking", `${expectation.healthId} 后仍有模块未真实打开`);
    moduleHealth.push({ moduleId: expectation.healthId, status: pageHealth.status, url: frame.url() });
  }
  await page.waitForFunction(() => window.S003ShellHealth.getSnapshot()?.status === "healthy", null, { timeout: MODULE_TIMEOUT_MS });
  const finalHealth = await page.evaluate(() => window.S003ShellHealth.getSnapshot());
  assert.equal(finalHealth.currentRunHealthy, true);
  assert.equal(finalHealth.acceptanceReady, false);
  assert.deepEqual(Object.values(finalHealth.modules).map((item) => item.pageHealth.status), ["healthy", "healthy", "healthy", "healthy", "healthy", "healthy"]);

  await page.evaluate(() => { window.location.hash = "#home"; });
  await page.waitForFunction(() => window.location.hash === "#home", null, { timeout: MODULE_TIMEOUT_MS });
  await page.locator(".home-blocker strong").waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  assert.match(await page.locator(".home-blocker strong").innerText(), /当前无待处理事项/);
  record.details = { initialStatus: initial.status, finalStatus: finalHealth.status, moduleHealth };
}

async function caseM02NativeDetail(page, record, config) {
  await openS003(page, config.origin, "#home");
  const frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "data"));
  assert.match(frame.url(), /#\/resources$/);
  const row = frame.locator("tr").filter({ hasText: "企业债务风险评估模版" }).first();
  await row.waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  await row.getByRole("button", { name: "查看详情" }).click();
  await frame.waitForFunction(() => /#\/resources\/source\/s003-workbook\?tab=overview$/.test(location.href), null, { timeout: MODULE_TIMEOUT_MS });
  const overview = await frame.locator("body").innerText();
  for (const expected of ["企业债务风险评估模版", "财务数据", "调节因子", "I / AA", "CNY / 元", "企业因子在线填报", "质量通过", "质量检查不拥有业务模型"]) {
    assert.match(overview, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `M02 详情缺少 ${expected}`);
  }
  assert.equal(await frame.locator(".detail-hero").count(), 1);
  assert.equal(await frame.locator(".tabs").count() >= 1, true);
  assert.equal(await frame.locator(".detail-grid").count() >= 1, true);
  await frame.getByRole("link", { name: "企业因子在线填报" }).click();
  await frame.waitForFunction(() => /tab=factors$/.test(location.href), null, { timeout: MODULE_TIMEOUT_MS });
  const factorSelectCount = await frame.locator("select").count();
  assert.equal(factorSelectCount > 100, true, `企业因子填报控件数量异常: ${factorSelectCount}`);
  record.details = { route: frame.url(), baselineStructures: ["detail-hero", "tabs", "detail-grid"], factorSelectCount };
}

async function caseM03IncompatibleProjection(page, record, config, browserContext) {
  const primaryKey = namespacedKey(FORMAL_CONTEXT, "m03", "workspace/state");
  const recoveryKey = namespacedKey(FORMAL_CONTEXT, "m03", "workspace/state.recovered.v1");
  const originalRaw = namespaceEnvelope(FORMAL_CONTEXT, { marker: "cp13-old-m03", actionRequests: [{ id: "must-not-load" }] }, "ofw.namespaced-storage.v0");
  await seedTopLevelStorage(browserContext, { local: { [primaryKey]: originalRaw } });
  await openS003(page, config.origin, "#home");
  const frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "query"), { waitHealth: false });
  await frame.waitForFunction(() => window.S003IQNativeBridge?.getHealth?.()?.status === "warning", null, { timeout: MODULE_TIMEOUT_MS });
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, recoveryKey, { timeout: MODULE_TIMEOUT_MS });
  await sleep(500);
  const snapshot = await page.evaluate(({ primaryKey, recoveryKey }) => ({
    primaryRaw: localStorage.getItem(primaryKey),
    recoveryRaw: localStorage.getItem(recoveryKey)
  }), { primaryKey, recoveryKey });
  assert.equal(snapshot.primaryRaw, originalRaw, "M03 React effect 覆盖了原不兼容投影");
  const recovered = JSON.parse(snapshot.recoveryRaw);
  assert.equal(recovered.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.equal(recovered.scenarioContext.scenarioRunId, FORMAL_CONTEXT.scenarioRunId);
  assert.equal(recovered.payload.currentScenario, "S003");
  assert.deepEqual(recovered.payload.actionRequests || [], []);
  const bridge = await frame.evaluate(() => ({ issue: window.S003IQNativeBridge.getProjectionIssue(), health: window.S003IQNativeBridge.getHealth() }));
  assert.equal(bridge.issue.isolated, true);
  assert.equal(bridge.issue.originalLogicalKey, "workspace/state");
  assert.equal(bridge.issue.rebuiltLogicalKey, "workspace/state.recovered.v1");
  assert.equal(bridge.health.status, "warning");
  record.details = { primaryKey, recoveryKey, issue: bridge.issue, recoveredSavedAt: recovered.savedAt };
}

async function caseM04IncompatibleProjections(page, record, config, browserContext) {
  const logical = {
    state: "decision-center.portfolio.state.v6",
    view: "decision-center.portfolio.view.v2",
    projection: "decision-center.c019.projection.v1"
  };
  const recoveredLogical = {
    state: "decision-center.portfolio.state.recovered.v1",
    view: "decision-center.portfolio.view.recovered.v1",
    projection: "decision-center.c019.projection.recovered.v1"
  };
  const primaryKeys = Object.fromEntries(Object.entries(logical).map(([kind, key]) => [kind, namespacedKey(FORMAL_CONTEXT, "m04", key)]));
  const recoveryKeys = Object.fromEntries(Object.entries(recoveredLogical).map(([kind, key]) => [kind, namespacedKey(FORMAL_CONTEXT, "m04", key)]));
  const original = Object.fromEntries(Object.keys(logical).map((kind) => [kind, namespaceEnvelope(FORMAL_CONTEXT, { marker: `cp13-old-m04-${kind}` }, "ofw.namespaced-storage.v0")]));
  await seedTopLevelStorage(browserContext, {
    local: { [primaryKeys.state]: original.state, [primaryKeys.projection]: original.projection },
    session: { [primaryKeys.view]: original.view }
  });
  await openS003(page, config.origin, "#home");
  const frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "decision"), { waitHealth: false });
  await frame.waitForFunction(() => window.S003DecisionAdapter?.getHealth?.()?.status === "warning", null, { timeout: MODULE_TIMEOUT_MS });
  await frame.locator("#screen-stage").waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  await frame.locator("#screen-stage").evaluate((node) => node.dispatchEvent(new Event("scroll")));
  await sleep(1_200);
  const stored = await page.evaluate(({ primaryKeys, recoveryKeys }) => ({
    primary: {
      state: localStorage.getItem(primaryKeys.state),
      view: sessionStorage.getItem(primaryKeys.view),
      projection: localStorage.getItem(primaryKeys.projection)
    },
    recovered: {
      state: localStorage.getItem(recoveryKeys.state),
      view: sessionStorage.getItem(recoveryKeys.view),
      projection: localStorage.getItem(recoveryKeys.projection)
    }
  }), { primaryKeys, recoveryKeys });
  record.details = { primaryKeys, recoveryKeys, recoveredPresence: Object.fromEntries(Object.entries(stored.recovered).map(([kind, value]) => [kind, Boolean(value)])) };
  assert.deepEqual(stored.primary, original, "M04 React effects 覆盖了原不兼容 envelope");
  for (const kind of Object.keys(logical)) {
    assert.ok(stored.recovered[kind], `M04 ${kind} 未形成独立恢复键`);
    const envelope = JSON.parse(stored.recovered[kind]);
    assert.equal(envelope.schemaVersion, STORAGE_SCHEMA_VERSION, kind);
    assert.equal(envelope.scenarioContext.scenarioRunId, FORMAL_CONTEXT.scenarioRunId, kind);
  }
  const adapter = await frame.evaluate(() => ({
    health: window.S003DecisionAdapter.getHealth(),
    issues: ["state", "view", "projection"].map((kind) => window.S003DecisionAdapter.getProjectionIssue(kind))
  }));
  assert.equal(adapter.health.status, "warning");
  assert.ok(adapter.issues.every((item) => item?.isolated === true));
  record.details = { ...record.details, issues: adapter.issues };
}

async function caseM01LegacyBootstrapProjection(page, record, config, browserContext) {
  const c008Key = `ontology3-c008-authoritative-projection-v1:${FORMAL_CONTEXT.scenarioId}:${FORMAL_CONTEXT.scenarioVersion}:${FORMAL_CONTEXT.scenarioRunId}`;
  const workspaceKey = `ontology3-canvas-first-review-v17:${FORMAL_CONTEXT.scenarioId}:${FORMAL_CONTEXT.scenarioVersion}:${FORMAL_CONTEXT.scenarioRunId}`;
  const originalProjection = {
    projectionId: c008Key,
    projectionVersion: "1",
    schemaVersion: 1,
    formedAt: "2026-08-16T09:59:59.000Z",
    sourceModule: "本体管理",
    contractCode: "C008",
    readStatus: "empty",
    scenarioContext: {
      scenarioId: "S001",
      scenarioVersion: "S001-v1",
      scenarioRunId: "s001-awaiting-delivery",
      scenarioName: "集团融资成本与债务结构优化",
      formedAt: "2026-08-16T09:59:59.000Z",
      status: "等待合法交付"
    },
    scenarioId: "S001",
    scenarioVersion: "S001-v1",
    scenarioRunId: "s001-awaiting-delivery",
    scenarioName: "集团融资成本与债务结构优化",
    scenarioFormedAt: "2026-08-16T09:59:59.000Z",
    scenarioStatus: "等待合法交付",
    publishedSemanticVersionId: null,
    publishedSemanticVersion: null,
    consumableDataVersion: null,
    dataAsOf: null,
    switchedAt: null,
    previousTrustedCombination: null,
    candidate: null,
    validationReference: null,
    consumptionState: "尚未形成正式组合",
    reason: "当前场景轮次没有权威消费绑定",
    recoverySuggestion: "完成 Published 语义版本、数据匹配、业务消费验证和受控采用后重新读取。",
    ontologyStableId: null,
    current: null,
    evidenceLocator: null
  };
  await seedTopLevelStorage(browserContext, { local: { [c008Key]: JSON.stringify(originalProjection) } });
  const query = new URLSearchParams({
    scenarioId: FORMAL_CONTEXT.scenarioId,
    scenarioVersion: FORMAL_CONTEXT.scenarioVersion,
    scenarioRunId: FORMAL_CONTEXT.scenarioRunId,
    scenarioFormedAt: FORMAL_CONTEXT.formedAt,
    scenarioStatus: FORMAL_CONTEXT.status
  });
  await page.goto(`${config.origin}/ontology-management-review/canvas-first/index.html?${query}#published/ontology?id=S003-M01-DEBT-RISK-PKG&version=S003-M01-DEBT-RISK-V1`, { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => window.ontologyReview?.handoffSnapshot?.()?.published?.length > 0, null, { timeout: MODULE_TIMEOUT_MS });
  await page.waitForFunction(() => window.ONTOLOGY_SCENARIO_EXTENSION?.getHealth?.()?.status !== "checking", null, { timeout: MODULE_TIMEOUT_MS });
  await sleep(1_200);
  const result = await page.evaluate(({ c008Key, workspaceKey }) => ({
    projection: JSON.parse(localStorage.getItem(c008Key) || "null"),
    workspace: JSON.parse(localStorage.getItem(workspaceKey) || "null"),
    matchingKeys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key) => key?.includes("canvas-first-review-v17") || key?.includes("c008-authoritative-projection"))
  }), { c008Key, workspaceKey });
  record.details = { c008Key, workspaceKey, matchingKeys: result.matchingKeys, projection: result.projection, recoveryHistory: result.workspace?.c008ProjectionRecoveryHistory || [] };
  assert.equal(result.projection?.scenarioContext?.scenarioId, "S003", "M01 未按当前 S003 上下文重建 C008");
  const receipt = result.workspace?.c008ProjectionRecoveryHistory?.find((item) => item.recoveryType === "known-legacy-s003-bootstrap-context");
  assert.ok(receipt, "未形成 known-legacy-s003-bootstrap-context 恢复记录");
  assert.equal(receipt.previousProjection.scenarioContext.scenarioId, "S001");
  assert.equal(receipt.previousProjection.scenarioContext.scenarioRunId, "s001-awaiting-delivery");
  assert.equal(result.projection.scenarioContext.scenarioId, "S003");
  assert.equal(result.projection.scenarioContext.scenarioRunId, FORMAL_CONTEXT.scenarioRunId);
  assert.equal(result.projection.readStatus, "failed", "独立深链未收到公共壳 C033 时应保持 fail-closed");
  assert.match(result.projection.reason, /C033 场景运行上下文/);
  record.details = { ...record.details, recoveryId: receipt.recoveryId, rebuiltReadStatus: result.projection.readStatus };
}

async function openM01PublishedConfig(frame) {
  await waitForFrameHash(frame, "#published/ontology?id=S003-M01-DEBT-RISK-PKG&version=S003-M01-DEBT-RISK-V1", "企业债务风险评估模型");
  await frame.getByRole("button", { name: "查看详情" }).click();
  await frame.getByRole("button", { name: "模型配置" }).click();
  await frame.locator('[data-s003-m01-action="publish"]').waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
}

async function caseM01DynamicPublish(page, record, config) {
  await openS003(page, config.origin, "#home");
  const frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "ontology"));
  await openM01PublishedConfig(frame);
  const before = await frame.evaluate(() => window.ontologyReview.handoffSnapshot());
  assert.ok(before.published.some((item) => item.semanticVersion === "V1.0.1"));
  await frame.locator('[data-s003-m01-action="publish"]').click();
  await page.waitForFunction(() => window.S003Store.getRuntimeSnapshot()?.publishedModel?.packageVersion === "1.0.2", null, { timeout: MODULE_TIMEOUT_MS });
  await frame.waitForFunction(() => {
    const snapshot = window.ontologyReview?.handoffSnapshot?.();
    return snapshot?.published?.some((item) => item.semanticVersion === "V1.0.2")
      && snapshot?.outputs?.authoritativeC008Projection?.publishedSemanticVersionId === "S003-M01-DEBT-RISK-V1_0_2";
  }, null, { timeout: MODULE_TIMEOUT_MS });
  const after = await frame.evaluate(() => window.ontologyReview.handoffSnapshot());
  const versions = after.published.slice().sort((left, right) => left.semanticVersion.localeCompare(right.semanticVersion));
  const v101 = versions.find((item) => item.semanticVersion === "V1.0.1");
  const v102 = versions.find((item) => item.semanticVersion === "V1.0.2");
  assert.ok(v101, "1.0.1 历史版本丢失");
  assert.ok(v102, "1.0.2 新版本未装入原生 Published 生命周期");
  assert.equal(v101.currentFormal, false);
  assert.equal(v102.currentFormal, true);
  assert.equal(v101.dataVersion, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  assert.equal(v102.dataVersion, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  const c008 = after.outputs.authoritativeC008Projection;
  assert.equal(c008.publishedSemanticVersionId, "S003-M01-DEBT-RISK-V1_0_2");
  assert.equal(c008.publishedSemanticVersion, "V1.0.2");
  assert.equal(c008.readStatus, "unavailable");
  assert.equal(c008.validationReference, null);
  assert.match(c008.consumptionState, /等待智能问数候选固定题验证/);
  const runtime = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(runtime.lastSuccessfulRun.modelVersion, "1.0.1", "发布配置不得原地改写既有正式结果");
  assert.equal(runtime.publishedModel.packageVersion, "1.0.2");
  record.details = { versions: versions.map((item) => ({ semanticVersion: item.semanticVersion, currentFormal: item.currentFormal, dataVersion: item.dataVersion })), c008: { readStatus: c008.readStatus, publishedSemanticVersionId: c008.publishedSemanticVersionId, validationReference: c008.validationReference }, formalResultModelVersion: runtime.lastSuccessfulRun.modelVersion };
}

async function caseM06NativeRoutes(page, record, config) {
  await openS003(page, config.origin, "#home");
  const frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "report"), { waitHealth: false });
  await waitForM06Ready(frame);
  const routes = [];
  const verifyRoute = async (hash, screenLabel, expectedText) => {
    await waitForFrameHash(frame, hash, expectedText);
    await frame.locator(".app-shell").waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
    assert.equal(await frame.locator(".platform-rail").count(), 1, hash);
    assert.equal(await frame.locator(".product-nav").count(), 1, hash);
    assert.equal(await frame.locator(`[data-screen-label="${screenLabel}"]`).count(), 1, hash);
    routes.push({ hash, screenLabel, url: frame.url() });
  };
  await verifyRoute("#/lifecycle", "报告目录", "报告目录");
  assert.equal(await frame.locator(".ledger-toolbar").count(), 1);
  assert.equal(await frame.locator(".lifecycle-rail").count(), 1);
  await verifyRoute("#/reports?tab=definitions", "报告资源管理", "报告管理");
  assert.match(await frame.locator("body").innerText(), /企业债务风险评估报告/);
  await verifyRoute("#/reports?tab=templates", "报告资源管理", "报告管理");
  assert.match(await frame.locator("body").innerText(), /企业债务风险评估报告模板/);
  await verifyRoute("#/reports?tab=products", "报告资源管理", "正式报告");
  assert.equal(await frame.locator('.resource-row button[data-action="s003-open-report"]').count(), 21);
  await verifyRoute("#/reports/generate", "报告生成工作区", "报告生成");
  assert.equal(await frame.locator(".workflow-strip .workflow-step").count(), 6);
  await verifyRoute("#/reports/draft", "报告生成工作区", "报告生成");
  await verifyRoute("#/reports/view", "报告资源管理", "报告管理");
  assert.equal(await frame.locator(".reader-shell").count(), 0, "S003 /reports/view 不得进入 S001 专属阅读页");
  await verifyRoute("#/reports/pdf", "报告资源管理", "报告管理");
  assert.equal(await frame.locator(".reader-shell").count(), 0, "S003 /reports/pdf 不得进入 S001 专属 PDF 页");
  await waitForFrameHash(frame, "#/dashboard/s003", "集团债务风险监测");
  const dashboardText = await frame.locator("body").innerText();
  for (const expected of ["集团债务风险监测", "企业风险评分明细", "风电测试公司01", FORMAL_CONTEXT.scenarioRunId]) assert.match(dashboardText, new RegExp(expected));
  const reportButton = frame.locator('button[data-action="s003-open-report"]').first();
  await reportButton.click();
  await frame.getByText("债务风险诊断报告", { exact: false }).first().waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  const reportText = await frame.locator("body").innerText();
  for (const expected of ["财务指标评分明细", "规则说明与默认语义", "证据与版本追溯", FORMAL_CONTEXT.scenarioRunId]) assert.match(reportText, new RegExp(expected));
  routes.push({ hash: "#/dashboard/s003", screenLabel: "S003 条件式场景工作台", url: frame.url() });
  record.details = { routes, productCount: 21, reportRunId: FORMAL_CONTEXT.scenarioRunId };
}

async function caseM06V2Priority(page, record, config) {
  await openS003(page, config.origin, "#home");
  let frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "report"), { waitHealth: false });
  await waitForM06Ready(frame);
  await frame.locator('button[data-action="navigate"][data-route="/reports?tab=definitions"]').first().click();
  await frame.waitForFunction(() => window.location.hash === "#/reports?tab=definitions", null, { timeout: MODULE_TIMEOUT_MS });
  await frame.waitForFunction(() => document.body?.innerText?.includes("报告管理"), null, { timeout: MODULE_TIMEOUT_MS });
  const currentKey = namespacedKey(FORMAL_CONTEXT, "m06", "report-center/state.v2");
  const legacyKey = namespacedKey(FORMAL_CONTEXT, "m06", "report-center/state");
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, currentKey, { timeout: MODULE_TIMEOUT_MS });
  const primaryBefore = await page.evaluate((key) => localStorage.getItem(key), currentKey);
  const staleLegacyRaw = namespaceEnvelope(FORMAL_CONTEXT, { stateVersion: 999, savedAtMs: Date.now() + 60_000, marker: "cp13-stale-session-legacy" });
  await page.evaluate(({ legacyKey, staleLegacyRaw }) => sessionStorage.setItem(legacyKey, staleLegacyRaw), { legacyKey, staleLegacyRaw });
  await frame.evaluate(() => window.location.reload());
  frame = await waitForFramePath(page, MODULE_EXPECTATIONS.find((item) => item.key === "report").path, ["报告中心"]);
  await waitForM06Ready(frame);
  await frame.getByText("报告管理", { exact: false }).first().waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  const result = await page.evaluate(({ currentKey, legacyKey }) => ({
    currentRaw: localStorage.getItem(currentKey),
    legacyRaw: sessionStorage.getItem(legacyKey)
  }), { currentKey, legacyKey });
  assert.equal(result.currentRaw, primaryBefore, "M06 重载不应改写已存在的健康 v2 投影");
  assert.equal(result.legacyRaw, staleLegacyRaw, "M06 不应删除或覆盖 stale session legacy");
  const health = await frame.evaluate(() => window.S003ReportModuleHealth());
  assert.equal(health.status, "healthy");
  assert.equal(health.projectionIssue, null);
  assert.equal(await frame.locator(".persistence-banner").count(), 0);
  record.details = { currentKey, legacyKey, health: { status: health.status, reportCount: health.reportCount }, staleLegacyRetained: true };
}

async function caseM06ResetNewRun(page, record, config) {
  await openS003(page, config.origin, "#home");
  let frame = await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "report"), { waitHealth: false });
  await waitForM06Ready(frame);
  await frame.locator('button[data-action="navigate"][data-route="/dashboard/s003"]').first().click();
  await frame.waitForFunction(() => window.location.hash === "#/dashboard/s003", null, { timeout: MODULE_TIMEOUT_MS });
  await frame.waitForFunction(() => document.body?.innerText?.includes("集团债务风险监测"), null, { timeout: MODULE_TIMEOUT_MS });
  await page.evaluate(() => {
    window.__cp13ScenarioShellMessages = [];
    window.addEventListener("message", (event) => {
      if (event.origin === location.origin && event.data?.channel === "ontology3.0-scenario-shell-v1") {
        window.__cp13ScenarioShellMessages.push(JSON.parse(JSON.stringify(event.data)));
      }
    });
  });
  const oldContext = await page.evaluate(() => window.S003Store.getRuntimeSnapshot().context);
  const oldM06Key = namespacedKey(oldContext, "m06", "report-center/state.v2");
  await frame.locator('button[data-action="s003-request-rerun"]:visible').first().click();
  await page.waitForFunction(() => (window.__cp13ScenarioShellMessages || []).some((item) => item.operation === "requestScenarioRerun"), null, { timeout: MODULE_TIMEOUT_MS });
  await page.locator('[data-modal-panel] [data-action="confirm-reset"]').waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  const beforeConfirm = await page.evaluate((oldM06Key) => ({
    context: window.S003Store.getRuntimeSnapshot().context,
    oldM06Raw: localStorage.getItem(oldM06Key),
    messages: window.__cp13ScenarioShellMessages
  }), oldM06Key);
  assert.equal(beforeConfirm.context.scenarioRunId, oldContext.scenarioRunId, "M06 页面不得自行生成 runId");
  const request = beforeConfirm.messages.find((item) => item.operation === "requestScenarioRerun");
  assert.equal(request.sourceModule, "M06");
  assert.equal(request.scenarioRunId, oldContext.scenarioRunId);
  assert.ok(beforeConfirm.oldM06Raw, "M06 请求前应保存当前隔离工作投影");
  await page.locator('[data-modal-panel] [data-action="confirm-reset"]').click();
  await page.waitForFunction((oldRunId) => window.S003Store.getRuntimeSnapshot()?.context?.scenarioRunId !== oldRunId, oldContext.scenarioRunId, { timeout: MODULE_TIMEOUT_MS });
  const after = await page.evaluate((oldM06Key) => ({
    context: window.S003Store.getRuntimeSnapshot().context,
    oldM06Raw: localStorage.getItem(oldM06Key),
    activeRun: window.S003Store.getRuntimeSnapshot().activeRun
  }), oldM06Key);
  assert.match(after.context.scenarioRunId, /^S003-RUN-\d{17}-[a-f0-9]{12}$/);
  assert.notEqual(after.context.scenarioRunId, oldContext.scenarioRunId);
  assert.equal(after.oldM06Raw, beforeConfirm.oldM06Raw, "新轮次不得覆盖旧 runId 的 M06 投影");
  assert.equal(after.activeRun.scenarioContext.scenarioRunId, after.context.scenarioRunId);
  assert.equal(after.activeRun.projectionOnly, true);
  record.details = { request: { operation: request.operation, sourceModule: request.sourceModule, oldRunId: request.scenarioRunId }, newRunId: after.context.scenarioRunId, oldProjectionRetained: true };
}

async function caseModuleFailureHomeHealth(page, record, config, browserContext) {
  await browserContext.addInitScript(() => {
    if (!/\/agent-application\/(?:Agent%E5%BA%94%E7%94%A8|Agent应用)\.html/.test(location.pathname)) return;
    const timer = setInterval(() => {
      if (!window.S003AgentAdapter) return;
      const original = window.S003AgentAdapter;
      window.S003AgentAdapter = Object.freeze({
        ...original,
        getHealth: () => ({
          moduleId: "M05",
          status: "blocked",
          detail: "CP13 注入：模拟模块页面健康阻断",
          scenarioContext: original.getHealth?.().scenarioContext,
          acceptanceReady: false
        })
      });
      clearInterval(timer);
    }, 0);
  });
  await openS003(page, config.origin, "#home");
  await navigateModule(page, MODULE_EXPECTATIONS.find((item) => item.key === "agent"), { waitHealth: false });
  await page.waitForFunction(() => window.S003ShellHealth.getSnapshot()?.modules?.M05?.pageHealth?.status === "blocked", null, { timeout: MODULE_TIMEOUT_MS });
  const blocked = await page.evaluate(() => window.S003ShellHealth.getSnapshot());
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.currentRunHealthy, false);
  assert.match(blocked.modules.M05.pageHealth.detail, /CP13 注入/);
  await page.evaluate(() => { window.location.hash = "#home"; });
  await page.waitForFunction(() => window.location.hash === "#home", null, { timeout: MODULE_TIMEOUT_MS });
  await page.locator(".home-blocker strong").waitFor({ state: "visible", timeout: MODULE_TIMEOUT_MS });
  const homeStatus = await page.locator(".home-blocker strong").innerText();
  assert.match(homeStatus, /当前运行已阻断/);
  assert.doesNotMatch(homeStatus, /当前运行健康/);
  record.details = { shellStatus: blocked.status, module: blocked.modules.M05.pageHealth, homeStatus };
}

async function caseS001SixModuleIsolation(page, record, config) {
  const context = await openS001(page, config.origin, "#home");
  assert.equal(context.scenarioId, "S001");
  const body = await page.locator("body").innerText();
  assert.match(body, /S001 · 融资成本洞察与行动闭环/);
  const modules = [];
  for (const expectation of MODULE_EXPECTATIONS) {
    const frame = await navigateModule(page, expectation, { waitHealth: false });
    const snapshot = await frame.evaluate(() => ({
      url: location.href,
      body: document.body?.innerText || "",
      htmlScenario: document.documentElement.dataset.ofwScenario || null,
      m01Active: window.ONTOLOGY_SCENARIO_EXTENSION?.scenarioId === "S003",
      m02Active: window.DE_SCENARIO_EXTENSION?.scenarioId === "S003" || window.DE_SCENARIO_EXTENSION?.isActive === true,
      m03Active: window.S003IQNativeBridge?.isActive === true,
      m04Active: Boolean(window.S003DecisionAdapter?.isActive?.({ scenarioId: "S001" })),
      m05Active: window.S003AgentAdapter?.isActive === true,
      m06WorkspaceCount: [...document.querySelectorAll(".product-nav-item")].filter((item) => item.textContent.includes("S003 场景工作台")).length
    }));
    assert.equal(new URL(snapshot.url).searchParams.get("scenarioId"), "S001", `${expectation.healthId} URL 场景身份`);
    assert.equal(snapshot.htmlScenario === "S003", false, `${expectation.healthId} html 标记泄漏`);
    assert.equal(snapshot.m01Active, false, `${expectation.healthId} M01 条件装入泄漏`);
    assert.equal(snapshot.m02Active, false, `${expectation.healthId} M02 条件装入泄漏`);
    assert.equal(snapshot.m03Active, false, `${expectation.healthId} M03 条件装入泄漏`);
    assert.equal(snapshot.m04Active, false, `${expectation.healthId} M04 条件装入泄漏`);
    assert.equal(snapshot.m05Active, false, `${expectation.healthId} M05 条件装入泄漏`);
    assert.equal(snapshot.m06WorkspaceCount, 0, `${expectation.healthId} M06 S003 工作台泄漏`);
    for (const forbidden of ["企业债务风险评估模型", "企业因子在线填报", "一期不建设专属 Agent", "集团债务风险监测"]) {
      assert.doesNotMatch(snapshot.body, new RegExp(forbidden), `${expectation.healthId} 泄漏 ${forbidden}`);
    }
    modules.push({ moduleId: expectation.healthId, url: snapshot.url });
  }
  const leakedKeys = await page.evaluate(() => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key) => key?.startsWith("ofw:v1.1.0:S003:") || key?.includes(":S003:S003-v1:")));
  assert.deepEqual(leakedKeys, []);
  record.details = { scenarioContext: context, modules, leakedKeys };
}

const CASE_RUNNERS = Object.freeze({
  "health-gating": caseHealthGating,
  "m02-native-detail": caseM02NativeDetail,
  "m03-incompatible-projection": caseM03IncompatibleProjection,
  "m04-incompatible-projections": caseM04IncompatibleProjections,
  "m01-legacy-bootstrap-projection": caseM01LegacyBootstrapProjection,
  "m01-dynamic-publish": caseM01DynamicPublish,
  "m06-native-routes": caseM06NativeRoutes,
  "m06-v2-priority": caseM06V2Priority,
  "m06-reset-new-run": caseM06ResetNewRun,
  "module-failure-home-health": caseModuleFailureHomeHealth,
  "s001-six-module-isolation": caseS001SixModuleIsolation
});

async function executeCase(browser, item, config, runDir) {
  const [id, label] = item;
  const browserContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
  const page = await browserContext.newPage();
  const diagnostics = attachDiagnostics(page);
  const record = {
    id,
    label,
    status: "running",
    startedAt: new Date().toISOString(),
    durationMs: 0,
    details: null,
    diagnostics,
    screenshot: null,
    error: null
  };
  const startedAt = Date.now();
  try {
    await CASE_RUNNERS[id](page, record, config, browserContext);
    await sleep(300);
    assertDiagnosticsClean(diagnostics);
    record.status = "passed";
  } catch (error) {
    record.status = "failed";
    record.error = { name: error.name, message: error.message, stack: error.stack || null };
  }
  if (config.screenshots || record.status === "failed") {
    const screenshotPath = path.join(runDir, `${safeName(id)}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch((error) => {
      record.screenshotError = error.message || String(error);
    });
    if (fs.existsSync(screenshotPath)) record.screenshot = path.relative(SCENARIO_ROOT, screenshotPath).replaceAll(path.sep, "/");
  }
  record.durationMs = Date.now() - startedAt;
  record.completedAt = new Date().toISOString();
  await browserContext.close();
  return record;
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const selectedPlan = TEST_PLAN.filter(([id]) => !config.only || config.only.has(id));
  if (config.only) {
    const known = new Set(TEST_PLAN.map(([id]) => id));
    const unknown = [...config.only].filter((id) => !known.has(id));
    if (unknown.length) throw new Error(`--only 包含未知用例: ${unknown.join(", ")}`);
  }
  if (config.list) {
    process.stdout.write(`${JSON.stringify({ origin: config.origin, s003Url: s003Url(config.origin), s001Url: s001Url(config.origin), cases: selectedPlan.map(([id, label]) => ({ id, label })) }, null, 2)}\n`);
    return;
  }

  const { chromium } = loadPlaywright(config.playwrightNodeModules);
  const runId = `${isoCompact()}-${crypto.randomBytes(4).toString("hex")}`;
  const runDir = path.join(config.outputRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const result = {
    schemaVersion: "ofw.s003.browser-cp13-result.v1",
    runId,
    formedAt: new Date().toISOString(),
    origin: config.origin,
    formalScenarioContext: FORMAL_CONTEXT,
    gitHead: gitHead(),
    playwrightNodeModules: config.playwrightNodeModules,
    headless: !config.headed,
    cases: [],
    totals: null,
    errorBudget: { consoleErrors: 0, pageErrors: 0, requestErrors: 0, httpErrors: 0 },
    checkpointCreated: false,
    acceptanceReady: false
  };
  const browser = await chromium.launch({ headless: !config.headed });
  try {
    result.browserVersion = browser.version();
    for (const item of selectedPlan) {
      const record = await executeCase(browser, item, config, runDir);
      result.cases.push(record);
      process.stdout.write(`${record.status === "passed" ? "PASS" : "FAIL"} ${record.id} ${record.durationMs}ms${record.error ? ` ${record.error.message}` : ""}\n`);
    }
  } finally {
    await browser.close();
  }
  result.completedAt = new Date().toISOString();
  result.totals = {
    cases: result.cases.length,
    passed: result.cases.filter((item) => item.status === "passed").length,
    failed: result.cases.filter((item) => item.status === "failed").length,
    consoleErrors: result.cases.reduce((sum, item) => sum + item.diagnostics.consoleErrors.length, 0),
    pageErrors: result.cases.reduce((sum, item) => sum + item.diagnostics.pageErrors.length, 0),
    requestErrors: result.cases.reduce((sum, item) => sum + item.diagnostics.requestErrors.length, 0),
    httpErrors: result.cases.reduce((sum, item) => sum + item.diagnostics.httpErrors.length, 0),
    ignoredAbortedRequests: result.cases.reduce((sum, item) => sum + item.diagnostics.ignoredAbortedRequests.length, 0)
  };
  const resultPath = path.join(runDir, "browser-cp13-results.json");
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`RESULT ${resultPath}\n`);
  if (result.totals.failed || result.totals.consoleErrors || result.totals.pageErrors || result.totals.requestErrors || result.totals.httpErrors) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exitCode = 1;
});
