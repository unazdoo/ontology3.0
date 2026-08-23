#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PLAYWRIGHT_NODE_MODULES = "/Users/domi/.codex/skills/baoyu-design/agents/gen-pptx/node_modules";
const DEFAULT_BASE_URL = "http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S003#home";
const S001_URL_SUFFIX = "/s001-e2e-integration/index.html?scenarioId=S001#home";
const SCENARIO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_ROOT = path.join(SCENARIO_ROOT, "evidence", "browser-cp12");
const READY_TIMEOUT_MS = 30_000;
const MODULE_TIMEOUT_MS = 30_000;
const S001_SENTINELS = Object.freeze({
  "ontology3-decision-center-review-v2-portfolio-state-v6": "CP12-S001-STATE-SENTINEL",
  "ontology3-decision-center-view-v2-portfolio": "CP12-S001-VIEW-SENTINEL",
  "ontology3.decision-center.c019.projection.v1": "CP12-S001-C019-SENTINEL"
});

const TEST_PLAN = Object.freeze([
  ["clean-state", "干净态启动与正式 Published 健康检查"],
  ["legacy-v0", "已知 browser-projection.v0 显式迁移并保留恢复回执"],
  ["unknown-schema", "未知投影 schema 原样隔离并从正式输入重建 Draft"],
  ["m02-draft-m01-published", "M02 Draft 异常不影响 M01 Published 只读资源"],
  ["native-navigation", "M01—M06 原生模块导航和场景上下文连续传递"],
  ["s001-isolation", "S003 操作不污染 S001 当前上下文和固定键"],
  ["historical-no-side-effects", "历史查看禁止 Action Request/待办/通知/审批副作用"],
  ["restore-no-side-effects", "克隆恢复创建新 runId 且不重放历史副作用"],
  ["regression-no-side-effects", "隔离回归创建新 runId 且不产生正式副作用"],
  ["rerun-no-side-effects", "快速重跑只形成工作投影且不产生正式副作用"]
]);

const MODULE_EXPECTATIONS = Object.freeze([
  { id: "data", path: /data-engineering-prototype-review\/review-v3\/%E6%96%B9%E6%A1%88B2\.html|data-engineering-prototype-review\/review-v3\/方案B2\.html/, texts: ["数据工程", "调节因子"] },
  // M01 默认入口必须保持 v1.0.3 原生建模首页；S003 Published 资源通过
  // 原生 Published 深链单独验证，不能把场景内容强塞进默认建模页。
  { id: "ontology", path: /ontology-management-review\/canvas-first\/index\.html/, texts: ["本体建模"] },
  { id: "query", path: /intelligent-query-prototype\/review-next\/conversation-workspace\/index\.html/, texts: ["智能问数", "Published"] },
  { id: "decision", path: /decision-center-prototype\/(?:index\.html|review-v2\/action-portfolio\.html)/, texts: ["决策中心", "待我决策"] },
  { id: "agent", path: /agent-application\/(?:Agent%E5%BA%94%E7%94%A8|Agent应用)\.html/, texts: ["Agent", "一期不建设专属 Agent"] },
  { id: "report", path: /report-center\/review-lifecycle\/index\.html/, texts: ["报告中心", "S003"] }
]);

function parseArgs(argv) {
  const result = {
    baseUrl: process.env.S003_BROWSER_BASE_URL || DEFAULT_BASE_URL,
    outputRoot: process.env.S003_BROWSER_OUTPUT_ROOT || DEFAULT_OUTPUT_ROOT,
    playwrightNodeModules: process.env.PLAYWRIGHT_NODE_MODULES || DEFAULT_PLAYWRIGHT_NODE_MODULES,
    headed: false,
    screenshots: true,
    list: false,
    only: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--base-url") result.baseUrl = argv[++index];
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
    return childProcess.execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: path.resolve(SCENARIO_ROOT, "../../../../.."),
      encoding: "utf8"
    }).trim();
  } catch (_) {
    return null;
  }
}

function s001Url(baseUrl) {
  const url = new URL(baseUrl);
  return `${url.origin}${S001_URL_SUFFIX}`;
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
    const record = { url: request.url(), method: request.method(), resourceType: request.resourceType(), failure };
    if (/ERR_ABORTED|NS_BINDING_ABORTED/i.test(failure)) diagnostics.ignoredAbortedRequests.push(record);
    else diagnostics.requestErrors.push(record);
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

async function waitForS003Ready(page) {
  await page.waitForFunction(() => {
    const snapshot = window.S003Store?.getRuntimeSnapshot?.();
    return Boolean(snapshot?.ready || snapshot?.fatalError);
  }, null, { timeout: READY_TIMEOUT_MS });
  const snapshot = await page.evaluate(() => window.S003Store.getRuntimeSnapshot());
  assert.equal(snapshot.fatalError, null, snapshot.fatalError || "S003 bootstrap fatalError");
  assert.equal(snapshot.ready, true, "S003 运行服务未就绪");
  return snapshot;
}

async function openS003(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  const snapshot = await waitForS003Ready(page);
  await page.locator(".scenario-workspace").waitFor({ state: "visible", timeout: READY_TIMEOUT_MS });
  return snapshot;
}

async function reloadS003(page) {
  await page.reload({ waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  return waitForS003Ready(page);
}

async function mutateM02Projection(page, mode) {
  return page.evaluate((mutationMode) => {
    const runtime = window.S003Store.getRuntimeSnapshot();
    window.S003Store.replaceFactorInputs(runtime.factorInputs);
    const key = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .find((item) => item && item.includes(":S003:S003-v1:") && item.endsWith(":m02:factor-inputs%2Fcurrent"));
    if (!key) throw new Error("未形成 M02 factor-inputs/current 工作投影");
    const envelope = JSON.parse(localStorage.getItem(key));
    if (mutationMode === "legacy-v0") envelope.payload.projectionSchemaVersion = "ofw.s003.browser-projection.v0";
    else if (mutationMode === "unknown-schema") envelope.payload.projectionSchemaVersion = "ofw.s003.browser-projection.v999";
    else if (mutationMode === "invalid-enterprise") envelope.payload.values["S003-ENT-999"] = {};
    else throw new Error(`未知 M02 注入模式: ${mutationMode}`);
    localStorage.setItem(key, JSON.stringify(envelope));
    return { key, mutationMode };
  }, mode);
}

async function recoverySnapshot(page) {
  return page.evaluate(() => {
    const runtime = window.S003Store.getRuntimeSnapshot();
    return {
      projectionHealth: runtime.projectionHealth,
      recoveryReceipts: runtime.projectionRecoveryReceipts,
      runtimeHealth: runtime.runtimeHealth,
      published: window.S003Store.getPublishedResourceSnapshot()
    };
  });
}

async function currentFrame(page) {
  const handle = await page.locator("#module-frame").elementHandle({ timeout: MODULE_TIMEOUT_MS });
  if (!handle) throw new Error("模块 iframe 不存在");
  const frame = await handle.contentFrame();
  if (!frame) throw new Error("模块 iframe 尚未形成 contentFrame");
  return frame;
}

async function waitForModule(page, expectation) {
  await page.locator(`.nav-item[data-route="#module/${expectation.id}"]`).click();
  await page.waitForFunction((moduleId) => window.location.hash === `#module/${moduleId}`, expectation.id, { timeout: MODULE_TIMEOUT_MS });
  const startedAt = Date.now();
  let frame;
  while (Date.now() - startedAt < MODULE_TIMEOUT_MS) {
    try {
      frame = await currentFrame(page);
      const decodedUrl = decodeURI(frame.url());
      if (expectation.path.test(decodedUrl)) break;
    } catch (_) {}
    await sleep(100);
  }
  if (!frame || !expectation.path.test(decodeURI(frame.url()))) {
    throw new Error(`${expectation.id} 未进入预期原生路径，当前 ${frame?.url() || "无 iframe"}`);
  }
  await frame.waitForLoadState("domcontentloaded", { timeout: MODULE_TIMEOUT_MS }).catch(() => {});
  const body = frame.locator("body");
  await body.waitFor({ state: "attached", timeout: MODULE_TIMEOUT_MS });
  const startedTextAt = Date.now();
  let text = "";
  while (Date.now() - startedTextAt < MODULE_TIMEOUT_MS) {
    text = await body.innerText().catch(() => "");
    if (expectation.texts.every((item) => text.includes(item))) break;
    await sleep(120);
  }
  for (const expectedText of expectation.texts) assert.match(text, new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${expectation.id} 缺少 ${expectedText}`);
  const scenarioId = await page.locator("#module-frame").getAttribute("data-scenario-id");
  assert.equal(scenarioId, "S003", `${expectation.id} iframe 未保持 S003 上下文`);
  assert.doesNotMatch(decodeURI(frame.url()), /\/scenarios\/s003\/(?:index|runtime)/, `${expectation.id} 错误跳回 S003 独立原型`);
  return { moduleId: expectation.id, url: frame.url(), matchedTexts: expectation.texts };
}

async function seedS001Sentinels(page) {
  return page.evaluate((sentinels) => {
    Object.entries(sentinels).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify({ cp12Sentinel: value })));
    return Object.fromEntries(Object.keys(sentinels).map((key) => [key, localStorage.getItem(key)]));
  }, S001_SENTINELS);
}

async function sideEffectSnapshot(page) {
  return page.evaluate((sentinelKeys) => {
    const identifierKeys = new Set(["actionRequestId", "todoId", "notificationId", "approvalId"]);
    const truthySideEffectKeys = new Set(["actionRequestCreated", "todoCreated", "notificationSent", "approvalCreated", "dispatchTriggered"]);
    const ids = new Set();
    const truthyFlags = new Set();
    const visit = (value, trail) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${trail}[${index}]`));
      Object.entries(value).forEach(([key, child]) => {
        const nextTrail = trail ? `${trail}.${key}` : key;
        if (identifierKeys.has(key) && typeof child === "string" && child) ids.add(`${key}:${child}`);
        if (truthySideEffectKeys.has(key) && child === true) truthyFlags.add(nextTrail);
        visit(child, nextTrail);
      });
    };
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean).sort();
    keys.forEach((key) => {
      try { visit(JSON.parse(localStorage.getItem(key)), key); } catch (_) {}
    });
    return {
      ids: [...ids].sort(),
      truthyFlags: [...truthyFlags].sort(),
      sentinels: Object.fromEntries(sentinelKeys.map((key) => [key, localStorage.getItem(key)])),
      s003NamespacedKeys: keys.filter((key) => key.startsWith("ofw:v1.1.0:S003:"))
    };
  }, Object.keys(S001_SENTINELS));
}

function assertNoNewSideEffects(before, after) {
  const newIds = after.ids.filter((item) => !before.ids.includes(item));
  const newFlags = after.truthyFlags.filter((item) => !before.truthyFlags.includes(item));
  assert.deepEqual(newIds, [], `新增副作用标识: ${newIds.join(", ")}`);
  assert.deepEqual(newFlags, [], `新增副作用真值: ${newFlags.join(", ")}`);
  assert.deepEqual(after.sentinels, before.sentinels, "S001 固定键被 S003 操作改写");
}

async function checkpointCodes(page) {
  return page.evaluate(() => window.S003Store.getBundle().checkpoints
    .filter((item) => item.manifest)
    .map((item) => item.code)
    .reverse());
}

async function runFirstSupportedCheckpointOperation(page, method) {
  return page.evaluate(async (methodName) => {
    const codes = window.S003Store.getBundle().checkpoints
      .filter((item) => item.manifest)
      .map((item) => item.code)
      .reverse();
    const errors = [];
    for (const code of codes) {
      const checkpoint = window.S003Store.getBundle().checkpoints.find((item) => item.code === code);
      try {
        const value = await window.S003Store[methodName](code);
        return {
          code,
          sourceScenarioRunId: checkpoint?.manifest?.scenarioContext?.scenarioRunId || null,
          value
        };
      } catch (error) {
        errors.push({ code, message: error?.message || String(error) });
      }
    }
    throw new Error(`${methodName} 无可用 Checkpoint: ${JSON.stringify(errors)}`);
  }, method);
}

async function blockedDecisionAttempt(page) {
  return page.evaluate(() => {
    try {
      window.S003Store.confirmDecision({ confirmed: true, owner: "CP12 测试负责人" });
      return { blocked: false, message: null };
    } catch (error) {
      return { blocked: true, message: error?.message || String(error) };
    }
  });
}

async function caseCleanState(page, record, config) {
  const runtime = await openS003(page, config.baseUrl);
  assert.equal(runtime.context.scenarioId, "S003");
  assert.equal(runtime.context.scenarioVersion, "S003-v1");
  assert.equal(runtime.runtimeHealth.status, "healthy");
  assert.equal(runtime.activeRun.authorityMode, "published-evidence");
  assert.equal(runtime.activeRun.projectionOnly, false);
  const shell = await page.locator("body").innerText();
  assert.match(shell, /S003 · 债务风险监测/);
  assert.match(shell, /15\/15/);
  record.details = { scenarioContext: runtime.context, runtimeHealth: runtime.runtimeHealth.status, authorityMode: runtime.activeRun.authorityMode };
}

async function caseLegacyV0(page, record, config) {
  await openS003(page, config.baseUrl);
  const injected = await mutateM02Projection(page, "legacy-v0");
  await reloadS003(page);
  const recovery = await recoverySnapshot(page);
  assert.equal(recovery.projectionHealth.M02.status, "migrated");
  const receipt = recovery.recoveryReceipts.find((item) => item.scope === "m02" && item.action === "migrate-known-schema" && item.status === "completed");
  assert.ok(receipt, "缺少 legacy v0 completed 恢复回执");
  assert.equal(receipt.originalProjectionSchemaVersion, "ofw.s003.browser-projection.v0");
  assert.equal(recovery.published.publishedModel.packageVersion, "1.0.1");
  record.details = { injected, health: recovery.projectionHealth.M02, receiptId: receipt.receiptId };
}

async function caseUnknownSchema(page, record, config) {
  await openS003(page, config.baseUrl);
  const injected = await mutateM02Projection(page, "unknown-schema");
  await reloadS003(page);
  const recovery = await recoverySnapshot(page);
  assert.equal(recovery.projectionHealth.M02.status, "isolated-rebuilt");
  const receipt = recovery.recoveryReceipts.find((item) => item.scope === "m02" && item.action === "isolate-incompatible-projection" && item.status === "completed");
  assert.ok(receipt, "缺少未知 schema completed 隔离回执");
  assert.equal(receipt.originalProjectionSchemaVersion, "ofw.s003.browser-projection.v999");
  assert.equal(receipt.formalArtifactsUnaffected, true);
  record.details = { injected, health: recovery.projectionHealth.M02, receiptId: receipt.receiptId };
}

async function caseM02DraftM01Published(page, record, config) {
  await openS003(page, config.baseUrl);
  const injected = await mutateM02Projection(page, "invalid-enterprise");
  await reloadS003(page);
  const recovery = await recoverySnapshot(page);
  assert.equal(recovery.projectionHealth.M02.status, "isolated-rebuilt");
  assert.equal(recovery.published.ready, true);
  assert.equal(recovery.published.publishedModel.packageVersion, "1.0.1");
  assert.equal(recovery.published.publishedPointer.status, "active");
  assert.equal(recovery.published.publishedPointer.activeTarget.packageVersion, "1.0.1");
  assert.equal(recovery.runtimeHealth.modules.M01.formalRead, "ready");
  record.details = { injected, m02Health: recovery.projectionHealth.M02, m01: recovery.runtimeHealth.modules.M01 };
}

async function caseNativeNavigation(page, record, config) {
  await openS003(page, config.baseUrl);
  const modules = [];
  for (const expectation of MODULE_EXPECTATIONS) modules.push(await waitForModule(page, expectation));
  record.details = { modules };
}

async function caseS001Isolation(page, record, config) {
  await openS003(page, config.baseUrl);
  await seedS001Sentinels(page);
  const before = await sideEffectSnapshot(page);
  const rerun = await page.evaluate(() => window.S003Store.quickRerun());
  assert.equal(rerun.scenarioContext.scenarioId, "S003");
  const afterRerun = await sideEffectSnapshot(page);
  assertNoNewSideEffects(before, afterRerun);
  await page.goto(s001Url(config.baseUrl), { waitUntil: "domcontentloaded", timeout: READY_TIMEOUT_MS });
  await page.waitForFunction(() => window.S001_STORE?.getScenarioContext?.()?.scenarioId === "S001", null, { timeout: READY_TIMEOUT_MS });
  const s001 = await page.evaluate(() => ({
    context: window.S001_STORE.getScenarioContext(),
    scenario: window.S001_STORE.getScenario("S001"),
    sentinels: Object.fromEntries(Object.keys(window.__cp12Sentinels || {}).map((key) => [key, localStorage.getItem(key)]))
  }));
  assert.equal(s001.context.scenarioId, "S001");
  assert.match(s001.context.scenarioRunId, /^S001-RUN-/);
  assert.doesNotMatch(s001.context.scenarioRunId, /^S003-RUN-/);
  assert.ok((s001.scenario.scenarioRunHistory || []).every((item) => item.scenarioContext?.scenarioId !== "S003"), "S001 历史混入 S003 运行");
  const afterS001 = await sideEffectSnapshot(page);
  assert.deepEqual(afterS001.sentinels, before.sentinels);
  const body = await page.locator("body").innerText();
  assert.match(body, /S001 · 融资成本洞察与行动闭环/);
  record.details = { s003RerunId: rerun.scenarioContext.scenarioRunId, s001Context: s001.context };
}

async function prepareSideEffectCase(page, config) {
  await openS003(page, config.baseUrl);
  await seedS001Sentinels(page);
  return sideEffectSnapshot(page);
}

async function caseHistoricalNoSideEffects(page, record, config) {
  const before = await prepareSideEffectCase(page, config);
  const codes = await checkpointCodes(page);
  assert.ok(codes.length, "无可查看 Checkpoint");
  const view = await page.evaluate((code) => window.S003Store.viewCheckpoint(code), codes[0]);
  const blocked = await blockedDecisionAttempt(page);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.message, /历史|只读|重放/);
  const after = await sideEffectSnapshot(page);
  assertNoNewSideEffects(before, after);
  record.details = { checkpoint: codes[0], historicalRunId: view.context?.scenarioRunId || view.scenarioContext?.scenarioRunId, blocked };
}

async function caseRestoreNoSideEffects(page, record, config) {
  const before = await prepareSideEffectCase(page, config);
  const operation = await runFirstSupportedCheckpointOperation(page, "cloneRestore");
  const state = await page.evaluate(() => window.S003Store.getState());
  assert.equal(state.context.status, "restored");
  assert.ok(operation.sourceScenarioRunId, "恢复来源 Checkpoint 缺少 scenarioRunId");
  assert.notEqual(state.context.scenarioRunId, operation.sourceScenarioRunId);
  const blocked = await blockedDecisionAttempt(page);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.message, /恢复|不得创建|负责人待办/);
  const after = await sideEffectSnapshot(page);
  assertNoNewSideEffects(before, after);
  record.details = { checkpoint: operation.code, context: state.context, blocked };
}

async function caseRegressionNoSideEffects(page, record, config) {
  const before = await prepareSideEffectCase(page, config);
  const operation = await runFirstSupportedCheckpointOperation(page, "isolatedRegression");
  assert.ok(operation.sourceScenarioRunId, "回归来源 Checkpoint 缺少 scenarioRunId");
  assert.equal(operation.value.run.scenarioContext.status, "regression");
  assert.notEqual(operation.value.run.scenarioContext.scenarioRunId, operation.sourceScenarioRunId);
  assert.equal(operation.value.run.authorityMode, "isolated-regression");
  assert.equal(operation.value.run.projectionOnly, true);
  const blocked = await blockedDecisionAttempt(page);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.message, /隔离回归|不得创建|负责人待办/);
  const after = await sideEffectSnapshot(page);
  assertNoNewSideEffects(before, after);
  record.details = { checkpoint: operation.code, context: operation.value.run.scenarioContext, blocked };
}

async function caseRerunNoSideEffects(page, record, config) {
  const before = await prepareSideEffectCase(page, config);
  const run = await page.evaluate(() => window.S003Store.quickRerun());
  assert.equal(run.authorityMode, "published-runtime");
  assert.equal(run.projectionOnly, true);
  assert.equal(run.scenarioContext.status, "active");
  const blocked = await blockedDecisionAttempt(page);
  assert.equal(blocked.blocked, true);
  assert.match(blocked.message, /工作投影|Published|已阻断/);
  const after = await sideEffectSnapshot(page);
  assertNoNewSideEffects(before, after);
  record.details = { context: run.scenarioContext, authorityMode: run.authorityMode, blocked };
}

const CASE_RUNNERS = Object.freeze({
  "clean-state": caseCleanState,
  "legacy-v0": caseLegacyV0,
  "unknown-schema": caseUnknownSchema,
  "m02-draft-m01-published": caseM02DraftM01Published,
  "native-navigation": caseNativeNavigation,
  "s001-isolation": caseS001Isolation,
  "historical-no-side-effects": caseHistoricalNoSideEffects,
  "restore-no-side-effects": caseRestoreNoSideEffects,
  "regression-no-side-effects": caseRegressionNoSideEffects,
  "rerun-no-side-effects": caseRerunNoSideEffects
});

async function executeCase(browser, item, config, runDir) {
  const [id, label] = item;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN", timezoneId: "Asia/Shanghai" });
  const page = await context.newPage();
  await page.addInitScript((sentinels) => { window.__cp12Sentinels = sentinels; }, S001_SENTINELS);
  const diagnostics = attachDiagnostics(page);
  const record = { id, label, status: "running", startedAt: new Date().toISOString(), durationMs: 0, details: null, diagnostics, screenshot: null, error: null };
  const startedAt = Date.now();
  try {
    await CASE_RUNNERS[id](page, record, config);
    await sleep(250);
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
  await context.close();
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
    process.stdout.write(`${JSON.stringify({ baseUrl: config.baseUrl, s001Url: s001Url(config.baseUrl), selectors: { scenario: ".scenario-workspace", nav: ".nav-item[data-route=\"#module/<id>\"]", frame: "#module-frame" }, cases: selectedPlan.map(([id, label]) => ({ id, label })) }, null, 2)}\n`);
    return;
  }

  const { chromium } = loadPlaywright(config.playwrightNodeModules);
  const runId = `${isoCompact()}-${crypto.randomBytes(4).toString("hex")}`;
  const runDir = path.join(config.outputRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const result = {
    schemaVersion: "ofw.s003.browser-cp12-result.v1",
    runId,
    formedAt: new Date().toISOString(),
    baseUrl: config.baseUrl,
    s001Url: s001Url(config.baseUrl),
    gitHead: gitHead(),
    playwrightNodeModules: config.playwrightNodeModules,
    headless: !config.headed,
    cases: [],
    totals: null,
    errorBudget: { consoleErrors: 0, pageErrors: 0, requestErrors: 0, httpErrors: 0 },
    checkpointCreated: false
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
  const resultPath = path.join(runDir, "browser-cp12-results.json");
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`RESULT ${resultPath}\n`);
  if (result.totals.failed || result.totals.consoleErrors || result.totals.pageErrors || result.totals.requestErrors || result.totals.httpErrors) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exitCode = 1;
});
