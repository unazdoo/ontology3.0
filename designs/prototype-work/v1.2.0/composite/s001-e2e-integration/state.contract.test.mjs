import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const compositeRoot = path.resolve(root, "..");
const read = (file) => fs.readFileSync(file, "utf8");

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  };
}

function loadStore() {
  const context = vm.createContext({
    console,
    URLSearchParams,
    Date,
    Math,
    JSON,
    Uint8Array,
    crypto: { randomUUID: () => "00112233-4455-6677-8899-aabbccddeeff" },
    location: { search: "" },
    localStorage: storage(),
    sessionStorage: storage(),
    matchMedia: () => ({ matches: false }),
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  });
  context.window = context;
  context.globalThis = context;
  vm.runInContext(read(path.join(compositeRoot, "scenarios/s005/scenario-config.js")), context, { filename: "scenario-config.js" });
  vm.runInContext(read(path.join(compositeRoot, "scenarios/s005/scenario-adapter.js")), context, { filename: "scenario-adapter.js" });
  vm.runInContext(read(path.join(root, "data.js")), context, { filename: "data.js" });
  vm.runInContext(read(path.join(root, "state.js")), context, { filename: "state.js" });
  return context.OFW_V120_STORE;
}

test("S005 starts with a fresh canonical run identity", () => {
  const store = loadStore();
  const context = store.scenarioContext();
  assert.equal(context.scenarioId, "S005");
  assert.equal(context.scenarioVersion, "S005-v1");
  assert.match(context.scenarioRunId, /^S005-RUN-[0-9]{17}-[a-f0-9]{12}$/);
  assert.equal(context.status, "active");
});

test("reset archives only the current S005 run and preserves S001-S004", () => {
  const store = loadStore();
  const before = Object.fromEntries(["S001", "S002", "S003", "S004"].map((id) => [id, store.scenario(id)]));
  const previousRunId = store.scenarioContext().scenarioRunId;
  const receipt = store.resetCurrentScenario();
  assert.equal(receipt.scope, "current S005 scenario run only");
  assert.equal(receipt.previousScenarioRunId, previousRunId);
  assert.notEqual(receipt.scenarioRunId, previousRunId);
  assert.equal(receipt.preservedHistoricalRuns, 1);
  assert.deepEqual(Array.from(receipt.touchedScenarios), ["S005"]);
  assert.equal(receipt.externalSideEffects, 0);
  for (const id of ["S001", "S002", "S003", "S004"]) assert.deepEqual(store.scenario(id), before[id]);
});

test("archived scenario reset is refused without changing its run", () => {
  const store = loadStore();
  store.setActiveScenario("S004");
  const before = store.scenario("S004");
  const receipt = store.resetCurrentScenario();
  assert.equal(receipt.scope, "archived scenario protected");
  assert.equal(receipt.changed, false);
  assert.deepEqual(store.scenario("S004"), before);
});

test("handoff session accepts only the active scenario run", () => {
  const store = loadStore();
  const context = store.scenarioContext();
  store.saveM07Handoff({ ...context, context: { ...context, objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" } }, returnUrl: "http://localhost/m07" });
  assert.equal(store.handoff().m07.scenarioRunId, context.scenarioRunId);
  assert.throws(() => store.saveM07Handoff({ ...context, scenarioRunId: "S005-RUN-20260827000000000-ffffffffffff" }), /轮次与当前场景不一致/);
});
