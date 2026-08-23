"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const adapterPath = path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
const ownersPath = path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/external-owners.js");
const shellPath = path.join(root, "app.js");

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  const reads = [];
  return {
    reads,
    getItem(key) { reads.push(key); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function ownerState(moduleId, context) {
  if (moduleId === "M01") return { moduleId, progress: { ontologyPublished: true }, publishedOntology: { ontologyVersion: "S002-ONTO-v1", publishedPointer: "T019-S002-v1" } };
  if (moduleId === "M02") return { moduleId, progress: { qualityPassed: true, assetPublished: true }, dataAsset: { assetId: "S002-DATA-BUNDLE", version: "S002-DATA-v1", asOf: "2025-12-31" }, qualityReceipt: { receiptId: "S002-QUALITY-RECEIPT-v1", formedAt: "2026-08-15T08:05:31.000Z", checksPassed: 20, checksTotal: 20, status: "passed-for-demo" } };
  if (moduleId === "M04") return { moduleId, progress: { actionsDrafted: true }, actionRequests: [], todos: [], decisionAlerts: [], decisionSummary: { requestCount: 0, confirmedCount: 0, rejectedCount: 0, pendingCount: 0, todoCount: 0 } };
  return {
    moduleId: "M06",
    progress: { reportBuilt: true, dashboardPublished: true },
    reports: [{ reportId: "RPT-S002-BUDGET-DRAFT-v1", version: "S002-REPORT-DRAFT-v1", status: "draft", scenarioContext: context }],
    dashboardVersions: [{ dashboardVersionId: "DASH-S002-001", version: "S002-DASHBOARD-v1", status: "published", scenarioContext: context }],
    dashboardView: { status: "published" }
  };
}

function executeHistoricalAdapter() {
  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-HANDSHAKE-001",
    formedAt: "2026-08-15T08:04:01.000Z",
    status: "historical-readonly"
  };
  const handlers = new Map();
  const parentMessages = [];
  const dispatched = [];
  const localStorage = memoryStorage({
    [`ofw:v1.1.0:S002:S002-v1:${context.scenarioRunId}:m01:owned-state`]: JSON.stringify({ scenarioContext: context, payload: { moduleId: "M01", progress: { ontologyPublished: false } } })
  });
  const sessionStorage = memoryStorage();
  const parent = { postMessage(message, origin) { parentMessages.push({ message, origin }); } };
  const document = {
    readyState: "complete",
    documentElement: { nodeType: 1 },
    addEventListener() {},
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const window = {
    parent,
    location: {
      origin: "http://127.0.0.1:4400",
      search: `?view=dashboard&scenarioId=${context.scenarioId}&scenarioVersion=${context.scenarioVersion}&scenarioRunId=${context.scenarioRunId}&formedAt=${encodeURIComponent(context.formedAt)}&status=${context.status}`,
      hash: "#/dashboard/s002?tab=overview",
      reload() {}
    },
    RC_DATA: { product: {}, publishedSemantic: {}, metrics: {}, rules: [], actionTypes: [], reportEvidence: { factPackages: {} }, scenes: [], definitions: [], templates: [] },
    addEventListener(type, handler) { handlers.set(type, handler); },
    dispatchEvent(event) { dispatched.push(event); return true; }
  };
  const sandbox = {
    window,
    document,
    localStorage,
    sessionStorage,
    URLSearchParams,
    MutationObserver: class MutationObserver { observe() {} },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    setTimeout() { return 0; },
    Date,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterPath, "utf8"), sandbox, { filename: adapterPath });
  return { context, handlers, parentMessages, dispatched, localStorage, window, parent };
}

test("M06 在全新会话主动请求父工作台上下文，并接受同轮 Owner envelope", () => {
  const runtime = executeHistoricalAdapter();
  const request = runtime.parentMessages.find((entry) => entry.message.type === "request-view-context");
  assert.ok(request, "M06 iframe 未主动发送 ready/request 握手");
  assert.equal(request.message.view, "dashboard");
  assert.equal(request.message.context.scenarioRunId, runtime.context.scenarioRunId);

  const ownerStates = Object.fromEntries([["m01", "M01"], ["m02", "M02"], ["m04", "M04"], ["m06", "M06"]].map(([scope, moduleId]) => [scope, {
    schemaVersion: "ofw.namespaced-storage.v1",
    scenarioContext: runtime.context,
    payload: ownerState(moduleId, runtime.context)
  }]));
  runtime.handlers.get("message")({
    origin: "http://127.0.0.1:4400",
    source: runtime.parent,
    data: { channel: "ofw.s002", type: "restore-view-context", view: "dashboard", context: runtime.context, ownerStates }
  });

  assert.equal(runtime.window.S002_M06_UPSTREAM.ownerStates.m01.moduleId, "M01");
  assert.equal(runtime.window.S002_M06_UPSTREAM.ownerStates.m02.dataAsset.version, "S002-DATA-v1");
  assert.equal(runtime.window.S002_M06_UPSTREAM.ownerStates.m06.progress.dashboardPublished, true);
  assert.ok(runtime.dispatched.some((event) => event.type === "s002-owner-context-updated"));
  assert.ok(runtime.parentMessages.some((entry) => entry.message.type === "view-context-accepted" && entry.message.accepted === true));
});

test("M06 历史只读握手不回退活动 namespaced localStorage", () => {
  const runtime = executeHistoricalAdapter();
  assert.equal(runtime.localStorage.reads.some((key) => /:m0[1246]:owned-state$/.test(key)), false);
  assert.equal(runtime.window.S002_M06_UPSTREAM.ownerStates.m01, null);
});

test("统一工作台只向当前 iframe 的同视图请求回传 Owner State", () => {
  const shell = fs.readFileSync(shellPath, "utf8");
  assert.ok(shell.includes('event.data.type === "request-view-context"'));
  assert.ok(shell.includes("event.source !== frame.contentWindow"));
  assert.ok(shell.includes("requestedView !== renderedFrameId"));
  assert.ok(shell.includes("adaptFrame(frame, requestedView)"));
});

test("报告核验留下失败缓存时，仪表盘仍优先消费父工作台同轮 Owner State", () => {
  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-HANDSHAKE-002",
    formedAt: "2026-08-15T08:04:01.000Z",
    status: "historical-readonly"
  };
  const stale = {
    schemaVersion: 1,
    projectionId: "ontology3-c008-authoritative-projection-v1",
    projectionVersion: "stale-failed",
    formedAt: "2026-08-15T08:03:00.000Z",
    readStatus: "failed",
    contractCode: "C008",
    sourceModule: "本体管理",
    scenarioContext: context,
    reason: "自动核验遗留失败态"
  };
  const localStorage = memoryStorage({ "ontology3-c008-authoritative-projection-v1": JSON.stringify(stale) });
  const window = {
    location: {
      search: `?scenarioId=${context.scenarioId}&scenarioVersion=${context.scenarioVersion}&scenarioRunId=${context.scenarioRunId}&formedAt=${encodeURIComponent(context.formedAt)}&status=${context.status}`
    },
    S002_M06_UPSTREAM: {
      scenarioContext: context,
      ownerStates: {
        m01: ownerState("M01", context),
        m02: ownerState("M02", context),
        m04: ownerState("M04", context)
      }
    }
  };
  const sandbox = { window, localStorage, URLSearchParams, Intl, Date, console, structuredClone };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(ownersPath, "utf8"), sandbox, { filename: ownersPath });
  const projection = window.RC_EXTERNAL_OWNERS.trust.peekCurrent();
  assert.equal(projection.readStatus, "ready");
  assert.equal(projection.binding.dataVersion, "S002-DATA-v1");
  assert.equal(projection.binding.semanticVersion, "S002-ONTO-v1");
  assert.equal(localStorage.reads.includes("ontology3-c008-authoritative-projection-v1"), false, "历史只读不应读取活动 C008 缓存");
});
