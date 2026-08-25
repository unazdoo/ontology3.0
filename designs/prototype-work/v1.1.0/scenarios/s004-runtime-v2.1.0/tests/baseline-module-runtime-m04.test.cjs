"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-runtime.js"), "utf8");
const M04_STATE_KEY = "ontology3-decision-center-review-v2-portfolio-state-v6";

function createSandbox({ scenarioId = "S004", requests = [], tasks = [], stateRunId = null } = {}) {
  const scenarioRunId = `${scenarioId}-RUN-20260816000000000-test`;
  const records = new Map([[M04_STATE_KEY, JSON.stringify({
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    scenarioContext: {
      scenarioId,
      scenarioVersion: `${scenarioId}-v2.1.0`,
      scenarioRunId: stateRunId || scenarioRunId,
      formedAt: "2026-08-16T00:00:00.000Z",
      status: "active"
    },
    scenarioApplicability: { status: "EMPTY_ACTION_REQUEST_QUEUE" },
    requests,
    tasks,
    receipts: [],
    auditHistory: []
  })]]);
  const params = new URLSearchParams({
    moduleId: "M04",
    scenarioId,
    scenarioVersion: `${scenarioId}-v2.1.0`,
    scenarioRunId,
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  }).toString();
  const page = { dataset: {} };
  const emptyStates = [{ dataset: {} }, { dataset: {} }];
  const document = {
    currentScript: { src: "http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-runtime.js" },
    documentElement: { dataset: {} },
    body: {},
    querySelector(selector) { return selector === ".page-shell, main, [data-screen-label]" ? page : null; },
    querySelectorAll(selector) { return selector === ".dc-empty" ? emptyStates : []; },
    getElementById() { return null; },
    addEventListener() {}
  };
  const sandbox = {
    document,
    location: {
      href: `http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?${params}`,
      search: `?${params}`,
      hash: ""
    },
    localStorage: {
      getItem(key) { return records.get(String(key)) ?? null; },
      setItem(key, value) { records.set(String(key), String(value)); },
      removeItem(key) { records.delete(String(key)); }
    },
    MutationObserver: class { observe() {} },
    URL,
    URLSearchParams,
    setTimeout() { return 0; },
    addEventListener() {},
    __OFW_BASELINE_MODULE_RUNTIME_TEST__: true
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", "MutationObserver", runtimeSource)(sandbox, sandbox, sandbox.MutationObserver);
  return { sandbox, api: sandbox.OFWBaselineModuleRuntimeTestApi, page, emptyStates };
}

test("M04 将同一 S004 场景轮次的零请求零待办识别为空 Action Request 队列", () => {
  const { api } = createSandbox();
  assert.equal(api.isM04EmptyActionRequestQueue(), true);

  assert.equal(createSandbox({ requests: [{ id: "AR-1" }] }).api.isM04EmptyActionRequestQueue(), false);
  assert.equal(createSandbox({ tasks: [{ id: "TASK-1" }] }).api.isM04EmptyActionRequestQueue(), false);
  assert.equal(createSandbox({ stateRunId: "S004-RUN-other" }).api.isM04EmptyActionRequestQueue(), false);
  assert.equal(createSandbox({ scenarioId: "S001" }).api.isM04EmptyActionRequestQueue(), false);
});

test("M04 空队列投影保留 v1.0.3 页面、空状态和原生交互", () => {
  const { sandbox, api, page, emptyStates } = createSandbox();
  api.patchM04EmptyActionRequestQueue();
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M04Queue, "EMPTY_ACTION_REQUEST_QUEUE");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M04InteractionMode, "BASELINE_NATIVE_CONTROLS_PRESERVED");
  assert.equal(page.dataset.ofwS004M04ScenarioProjection, "empty-action-request-queue");
  emptyStates.forEach((node) => assert.equal(node.dataset.ofwS004M04NativeEmptyState, "preserved"));
  assert.match(runtimeSource, /patchM04EmptyActionRequestQueue/);
  assert.doesNotMatch(runtimeSource, /function patchM04EmptyActionRequestQueue[\s\S]{0,1000}(?:disabled\s*=\s*true|preventDefault\(|stopImmediatePropagation\()/);
});

