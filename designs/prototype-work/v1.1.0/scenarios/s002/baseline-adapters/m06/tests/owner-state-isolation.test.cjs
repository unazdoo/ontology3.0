"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const adapterPath = path.resolve(__dirname, "../report-center/review-lifecycle/s002-adapter.js");
const REPORT_STATE_KEY = "ontology3.s002.report-center.lifecycle-review.v1";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function ownerState(context) {
  return {
    moduleId: "M06",
    moduleVersion: "S002-M06-1.0.0",
    progress: { reportBuilt: true, dashboardPublished: true },
    reports: [{ reportId: "RPT-S002-BUDGET-DRAFT-v1", version: "S002-REPORT-DRAFT-v1", status: "draft", scenarioContext: context }],
    dashboardVersions: [{ dashboardVersionId: "DASH-S002-001", version: "S002-DASHBOARD-v1", status: "published", publishedAt: "2026-08-15T16:30:00.000Z", scenarioContext: context }],
    dashboardView: { status: "published" }
  };
}

function executeAdapter({ context, parentState = null, initial = {} }) {
  const localStorage = memoryStorage(initial);
  const sessionStorage = memoryStorage();
  const query = new URLSearchParams(context);
  const document = {
    readyState: "complete",
    documentElement: { nodeType: 1 },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const runtimeWindow = {
    location: { search: `?${query}`, hash: "#/lifecycle" },
    localStorage,
    sessionStorage,
    addEventListener() {}
  };
  runtimeWindow.parent = parentState ? { S002_STORE: { get() { return parentState; } } } : runtimeWindow;
  const sandbox = {
    window: runtimeWindow,
    localStorage,
    sessionStorage,
    document,
    URLSearchParams,
    MutationObserver: class MutationObserver { observe() {} },
    setTimeout() { return 0; },
    Date,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterPath, "utf8"), sandbox, { filename: adapterPath });
  return {
    runtime: runtimeWindow.S002_M06_RUNTIME,
    adapter: runtimeWindow.S002_M06_ADAPTER,
    reportState: JSON.parse(localStorage.getItem(REPORT_STATE_KEY)),
    bootstrapState: runtimeWindow.S002_M06_INITIAL_STATE || null
  };
}

test("同 scenarioId、scenarioVersion、scenarioRunId 的 Parent M06 Owner State 才能发布驾驶舱投影", () => {
  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-M06-OWNER-001",
    formedAt: "2026-08-15T16:00:00.000Z",
    status: "active"
  };
  const parentState = { context, ...ownerState(context) };
  const result = executeAdapter({ context, parentState });
  assert.equal(result.runtime.source, "scenario-owned-state");
  assert.equal(result.runtime.reportBuilt, true);
  assert.equal(result.runtime.dashboardPublished, true);
  assert.equal(result.reportState.report.stage, "draft");
  assert.equal(result.reportState.publishedReports.length, 0);
  assert.equal(result.reportState.s002RuntimeSummary.formalReportPublished, false);
  assert.equal(result.reportState.s002RuntimeSummary.t049Ref, null);
});

test("Parent 不可用时只接受精确三元上下文的 namespaced M06 Owner State", () => {
  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-M06-OWNER-002",
    formedAt: "2026-08-15T16:00:00.000Z",
    status: "active"
  };
  const key = `ofw:v1.1.0:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}:m06:owned-state`;
  const validEnvelope = { schemaVersion: 1, scenarioContext: context, payload: ownerState(context) };
  const valid = executeAdapter({ context, initial: { [key]: JSON.stringify(validEnvelope) } });
  assert.equal(valid.runtime.source, "scenario-owned-state");
  assert.equal(valid.runtime.dashboardPublished, true);

  const wrongContext = { ...context, scenarioVersion: "S002-v0" };
  const wrongEnvelope = { schemaVersion: 1, scenarioContext: wrongContext, payload: ownerState(wrongContext) };
  const rejected = executeAdapter({ context, initial: { [key]: JSON.stringify(wrongEnvelope) } });
  assert.equal(rejected.runtime.source, "adapter-fallback");
  assert.equal(rejected.runtime.reportBuilt, false);
  assert.equal(rejected.runtime.dashboardPublished, false);
  assert.equal(Object.keys(rejected.reportState.report).length, 0);
  assert.equal(rejected.reportState.publishedReports.length, 0);
});

test("historical-readonly 使用内存态 M06 投影且不覆盖活动工作区", () => {
  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-M06-HISTORY-001",
    formedAt: "2026-08-15T16:00:00.000Z",
    status: "historical-readonly"
  };
  const parentState = { context, ...ownerState(context) };
  const activeWorkspace = { sentinel: "active-workspace-must-remain" };
  const result = executeAdapter({ context, parentState, initial: { [REPORT_STATE_KEY]: JSON.stringify(activeWorkspace) } });
  assert.equal(result.runtime.source, "scenario-owned-state");
  assert.deepEqual(result.reportState, activeWorkspace, "历史查看不应覆盖活动 M06 localStorage");
  assert.equal(result.bootstrapState.scenarioContext.scenarioRunId, context.scenarioRunId);
  assert.equal(result.bootstrapState.report.stage, "draft");
  assert.equal(result.bootstrapState.report.humanReview.note, "报告草稿已形成；未发布为 T049 正式报告。");
});
