"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const foundation = require("../../../foundation/ofw-scenario-foundation.js");
globalThis.OFWScenarioFoundation = foundation;
const adapterApi = require("../ofw-baseline-module-adapter.js");

class MemoryStorage {
  constructor() { this.records = new Map(); }
  get length() { return this.records.size; }
  key(index) { return Array.from(this.records.keys())[index] ?? null; }
  getItem(key) { return this.records.has(String(key)) ? this.records.get(String(key)) : null; }
  setItem(key, value) { this.records.set(String(key), String(value)); }
  removeItem(key) { this.records.delete(String(key)); }
}

function config(scenarioId, scenarioVersion) {
  return {
    scenarioId,
    scenarioVersion,
    baselineVersion: "v1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    name: `${scenarioId} 演示场景`,
    organization: "财务公司",
    focus: "成员单位",
    dataAsOf: "2026-08-15",
    moduleSources: {
      M01: "../../prototype-releases/v1.0.3/ontology-management-review/canvas-first/index.html",
      M02: "../../prototype-releases/v1.0.3/data-engineering-prototype-review/review-v3/方案B2.html",
      M03: "../../prototype-releases/v1.0.3/intelligent-query-prototype/review-next/conversation-workspace/index.html",
      M04: "../../prototype-releases/v1.0.3/decision-center-prototype/index.html",
      M05: "../../prototype-releases/v1.0.3/agent-application/Agent应用.html",
      M06: "../../prototype-releases/v1.0.3/report-center/review-lifecycle/index.html"
    },
    workflow: [
      { id: "configure", moduleId: "M02", title: "配置", summary: "配置", initialStatus: "complete" },
      { id: "queryBoundary", moduleId: "M03", title: "问数边界", summary: "不适用", initialStatus: "not_applicable" },
      { id: "decisionBoundary", moduleId: "M04", title: "决策边界", summary: "空队列", initialStatus: "not_applicable" }
    ],
    selectedEntities: ["BORROWER-001"],
    entities: [],
    groupMetrics: [],
    report: { id: "RPT-001", formats: ["HTML", "PDF"] }
  };
}

function withS004DemoClock(value) {
  return {
    ...value,
    runtimeConfig: {
      configVersion: "S004-RUNTIME-CONFIG-TEST",
      demoClock: {
        enabled: true,
        scenarioId: "S004",
        mode: "FIXED",
        date: "2026-08-16",
        now: "2026-08-16T08:00:00.000Z",
        timeZone: "Asia/Shanghai"
      }
    }
  };
}

test("S004 adapter keeps external v1.0.3 and normalized Foundation 1.0.3", function () {
  const storage = new MemoryStorage();
  const adapter = adapterApi.createAdapter(config("S004", "S004-v2.1.0"), { storage });
  assert.equal(adapter.config.baselineVersion, "v1.0.3");
  assert.equal(adapter.config.foundationBaselineVersion, "1.0.3");
  assert.equal(adapter.config.baselineSnapshotId, "BSL-S001-V103-DE0119608E26");
  assert.equal(adapter.shellData.moduleById.data.source.includes("prototype-releases/v1.0.3"), true);
  assert.equal(adapter.store.getProjection().steps.queryBoundary.status, "not_applicable");
  assert.equal(adapter.store.getProjection().steps.decisionBoundary.status, "not_applicable");
});

test("S004 外壳 createContext 与 directionalReset 共用 2026-08-16 演示时钟，S001 默认行为不变", function () {
  const storage = new MemoryStorage();
  storage.setItem("ofw:v1.1.0:scenario-registry:S004:active-context", JSON.stringify({
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260817010101000-stalefuture1",
    formedAt: "2026-08-17T01:01:01.000Z",
    status: "active"
  }));
  const s004 = adapterApi.createAdapter(withS004DemoClock(config("S004", "S004-v2.1.0")), { storage });
  const initial = s004.store.getScenarioContext();
  assert.match(initial.scenarioRunId, /^S004-RUN-20260816/);
  assert.equal(initial.formedAt.slice(0, 10), "2026-08-16");
  assert.ok(Date.parse(initial.formedAt) >= Date.parse("2026-08-16T08:00:00.000Z"));
  assert.doesNotMatch(JSON.stringify(initial), /20260817|2026-08-17/);

  const reset = s004.store.resetCurrentScenario().resetReceipt;
  assert.match(reset.operationId, /^OP-S004-20260816/);
  assert.match(reset.context.scenarioRunId, /^S004-RUN-20260816/);
  assert.equal(reset.context.formedAt.slice(0, 10), "2026-08-16");
  assert.ok(Date.parse(reset.context.formedAt) >= Date.parse(initial.formedAt));
  assert.notEqual(reset.context.scenarioRunId, initial.scenarioRunId);
  assert.doesNotMatch(JSON.stringify(reset), /20260817|2026-08-17/);

  const s001 = adapterApi.createAdapter(config("S001", "S001-v1"), {
    storage: new MemoryStorage(),
    now: "2026-08-15T08:00:00.000Z"
  });
  assert.match(s001.store.getScenarioContext().scenarioRunId, /^S001-RUN-20260815/);
  assert.equal(s001.store.getScenarioContext().formedAt, "2026-08-15T08:00:00.000Z");
});

test("场景 registry 使用 Foundation namespace 隔离模块状态和运行轮次", function () {
  const storage = new MemoryStorage();
  const s001 = adapterApi.createAdapter(config("S001", "S001-v1"), { storage });
  const s004 = adapterApi.createAdapter(config("S004", "S004-v2.1.0"), { storage });
  const s001Module = s001.store.createModuleStorage("M02");
  const s004Module = s004.store.createModuleStorage("M02");

  s001Module.set("legacy/state", { owner: "S001" }, { now: "2026-08-15T08:00:00.000Z" });
  s004Module.set("legacy/state", { owner: "S004" }, { now: "2026-08-15T08:00:01.000Z" });
  assert.deepEqual(s001Module.get("legacy/state"), { owner: "S001" });
  assert.deepEqual(s004Module.get("legacy/state"), { owner: "S004" });
  assert.notEqual(s001.store.getScenarioContext().scenarioRunId, s004.store.getScenarioContext().scenarioRunId);

  const previousRun = s004.store.getScenarioContext().scenarioRunId;
  s004.store.resetCurrentScenario();
  assert.notEqual(s004.store.getScenarioContext().scenarioRunId, previousRun);
  assert.deepEqual(s001Module.get("legacy/state"), { owner: "S001" });
});

test("registry 可并行注册多个场景而不共享兼容别名或运行存储", function () {
  const storage = new MemoryStorage();
  const registry = adapterApi.createRegistry([
    config("S001", "S001-v1"),
    config("S004", "S004-v2.1.0")
  ], { storage });
  assert.deepEqual(Object.keys(registry).sort(), ["S001", "S004"]);
  assert.equal(registry.S001.config.scenarioId, "S001");
  assert.equal(registry.S004.config.scenarioId, "S004");
  assert.notEqual(registry.S001.context().scenarioRunId, registry.S004.context().scenarioRunId);
});
