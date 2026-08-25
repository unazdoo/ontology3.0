"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const m04Root = path.resolve(__dirname, "..");
const scenarioRoot = path.resolve(m04Root, "../..");
const adapterPath = path.join(m04Root, "s002-adapter.js");
const baselineAppPath = path.join(m04Root, "decision-center-prototype/review-v2/shared/app.jsx");
const baselineEntryPath = path.join(m04Root, "decision-center-prototype/review-v2/action-portfolio.html");
const shellAppPath = path.join(scenarioRoot, "app.js");
const { createRuntime } = require(path.join(scenarioRoot, "tests/runtime-harness.cjs"));

const STATE_KEY = "ontology3-decision-center-review-v2-portfolio-state-v6";
const C017_KEY = "ontology3.c017.decision-center.projection.v1";
const C019_KEY = "ontology3.decision-center.c019.projection.v1";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    entries() { return [...values.entries()]; }
  };
}

function runFullScenario() {
  const runtime = createRuntime({ startIso: "2026-08-15T02:00:00.000Z", randomSeed: 420 });
  runtime.store.connectData();
  runtime.store.runQuality();
  runtime.store.publishData();
  runtime.store.applyMapping();
  runtime.store.publishOntology();
  runtime.store.executeQuestion("Q-EXECUTION");
  runtime.store.runRules();
  runtime.store.submitActions();
  runtime.store.runAgents();
  runtime.store.buildReport();
  runtime.store.publishDashboard();
  return { runtime, snapshot: runtime.store.get() };
}

function executeAdapter({ context, parentSnapshot = null, initial = {} }) {
  const storage = memoryStorage(initial);
  const listeners = new Map();
  const parentMessages = [];
  const query = new URLSearchParams({
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId,
    formedAt: context.formedAt,
    status: context.status
  });
  const body = { nodeType: 1, querySelectorAll() { return []; } };
  const document = {
    readyState: "complete",
    body,
    documentElement: {},
    addEventListener() {},
    createTreeWalker() { return { currentNode: null, nextNode() { return false; } }; }
  };
  const runtimeWindow = {
    location: { search: `?${query}`, href: `http://127.0.0.1:18102/scenarios/s002/baseline-adapters/m04/decision-center-prototype/review-v2/action-portfolio.html?${query}#workbench`, origin: "http://127.0.0.1:18102" },
    localStorage: storage,
    setTimeout,
    clearTimeout,
    addEventListener(type, handler) { listeners.set(type, [...(listeners.get(type) || []), handler]); }
  };
  runtimeWindow.parent = parentSnapshot ? {
    S002_STORE: { get() { return parentSnapshot; } },
    postMessage(message, origin) { parentMessages.push({ message, origin }); }
  } : runtimeWindow;
  runtimeWindow.top = runtimeWindow.parent;
  const sandbox = {
    window: runtimeWindow,
    location: runtimeWindow.location,
    localStorage: storage,
    document,
    URL,
    URLSearchParams,
    NodeFilter: { SHOW_TEXT: 4 },
    HTMLInputElement: class HTMLInputElement {},
    HTMLTextAreaElement: class HTMLTextAreaElement {},
    MutationObserver: class MutationObserver { observe() {} },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterPath, "utf8"), sandbox, { filename: adapterPath });
  return {
    adapter: runtimeWindow.S002_M04_ADAPTER,
    state: JSON.parse(storage.getItem(STATE_KEY)),
    c017: JSON.parse(storage.getItem(C017_KEY)),
    c019: JSON.parse(storage.getItem(C019_KEY)),
    parentMessages
  };
}

test("M04 继续加载 v1.0.3 决策中心入口，但当前 S002 运行态 Action 被显式禁用", () => {
  const entry = fs.readFileSync(baselineEntryPath, "utf8");
  const adapter = fs.readFileSync(adapterPath, "utf8");
  const shell = fs.readFileSync(shellAppPath, "utf8");
  assert.match(entry, /s002-adapter\.js\?v=20260817-30/);
  assert.match(adapter, /const ACTION_RUNTIME_ENABLED = false/);
  assert.match(adapter, /disabled-for-s002-current-scope/);
  assert.match(shell, /decision:\s*"baseline-adapters\/m04\/decision-center-prototype\/index\.html"/);
  assert.doesNotMatch(shell, /decision:\s*"module\.html"/);
});

test("全链路完成态在 M04 投影为零行动申请、零决策事项和零待办", () => {
  const { snapshot } = runFullScenario();
  assert.equal(snapshot.actionRequests.length, 0);
  assert.equal(snapshot.decisionAlerts.length, 0);
  assert.equal(snapshot.todos.length, 0);
  assert.equal(snapshot.decisionSummary.status, "no-runtime-actions");

  const result = executeAdapter({ context: snapshot.context, parentSnapshot: snapshot });
  assert.equal(result.adapter.ownerStatePresent, true);
  assert.equal(result.adapter.reviewWritable, false);
  assert.equal(result.adapter.ownerBridge.canReview, false);
  assert.equal(result.adapter.requests.length, 0);
  assert.equal(result.adapter.actionTypes.length, 6, "六类 Action Type 只作为 Published 语义能力保留");
  assert.equal(result.state.actionPolicy, "disabled-for-s002-current-scope");
  assert.equal(result.state.requests.length, 0);
  assert.equal(result.state.tasks.length, 0);
  assert.equal(result.state.decisionSummary.status, "no-runtime-actions");
  assert.equal(result.c019.records.length, 0);
  assert.equal(result.c019.decisionSummary.status, "no-runtime-actions");
  assert.equal(result.c019.externalDispatchCount, 0);
});

test("CP07 历史只读与直接访问均不得恢复旧行动示例", async () => {
  const { snapshot } = runFullScenario();
  const historicalContext = { ...snapshot.context, status: "historical-readonly" };
  const historical = executeAdapter({ context: historicalContext, parentSnapshot: { ...snapshot, context: historicalContext } });
  assert.equal(historical.state.requests.length, 0);
  assert.equal(historical.state.tasks.length, 0);
  assert.equal(historical.state.decisionSummary.status, "no-runtime-actions");
  assert.equal((await historical.adapter.ownerBridge.submitDecision({ requestId: "AR-LEGACY", decision: "confirm" })).ok, false);
  assert.equal(historical.parentMessages.length, 0);

  const direct = executeAdapter({ context: snapshot.context });
  assert.equal(direct.adapter.ownerStatePresent, false);
  assert.equal(direct.state.requests.length, 0);
  assert.equal(direct.state.tasks.length, 0);
  assert.equal(direct.state.decisionSummary.status, "no-runtime-actions");
});

test("旧 namespaced Owner State 或旧本地缓存不能重新注入行动事项", () => {
  const { snapshot } = runFullScenario();
  const ownerKey = `ofw:v1.1.0:${snapshot.context.scenarioId}:${snapshot.context.scenarioVersion}:${snapshot.context.scenarioRunId}:m04:owned-state`;
  const staleEnvelope = {
    schemaVersion: "ofw.module-owned-state.v1",
    scenarioContext: snapshot.context,
    payload: {
      moduleId: "M04",
      moduleVersion: "S002-M04-legacy",
      actionPolicy: "enabled",
      actionRequests: [{ requestId: "AR-LEGACY", sourceId: "HIT-LEGACY", status: "draft" }],
      todos: [{ todoId: "TODO-LEGACY", requestId: "AR-LEGACY" }],
      decisionSummary: { id: "C019-LEGACY", status: "reviewing", requestCount: 1, awaitingCount: 1, todoCount: 1 }
    }
  };
  const result = executeAdapter({
    context: snapshot.context,
    initial: {
      [ownerKey]: JSON.stringify(staleEnvelope),
      [STATE_KEY]: JSON.stringify({ scenarioContext: snapshot.context, requests: [{ id: "AR-CACHED" }], tasks: [{ id: "TODO-CACHED" }] })
    }
  });
  assert.equal(result.adapter.ownerStatePresent, true);
  assert.equal(result.state.requests.length, 0);
  assert.equal(result.state.tasks.length, 0);
  assert.equal(result.state.decisionSummary.status, "no-runtime-actions");
  assert.equal(result.c019.records.length, 0);
});

test("保留基线导航、空态和人工决策组件，S002 只覆盖零事项文案与运行边界", () => {
  const baseline = fs.readFileSync(baselineAppPath, "utf8");
  const adapter = fs.readFileSync(adapterPath, "utf8");
  assert.match(baseline, /DecisionProductNav/);
  assert.match(baseline, /DecisionModal/);
  assert.match(baseline, /确认并交办/);
  assert.match(baseline, /正在读取决策运行记录/);
  assert.match(baseline, /当前没有待我决策事项/);
  assert.match(adapter, /当前 S002 范围不生成行动申请、决策事项或平台内待办/);
  assert.match(adapter, /当前 S002 范围保持决策中心零事项空态/);
});
