import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
function sandbox() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const context = { console, URLSearchParams, localStorage: storage, sessionStorage: storage, location: { search: "" }, dispatchEvent() {}, CustomEvent: class {}, crypto: { randomUUID: () => `id-${values.size}` } };
  context.window = context;
  context.global = context;
  vm.createContext(context);
  vm.runInContext(read("shared/workflow.js"), context);
  return context;
}
function loadFunction(context, path, name) {
  const source = read(path);
  const start = source.indexOf(`  function ${name}(`);
  const rest = source.slice(start + 2);
  const end = rest.slice(1).search(/\n  (?:async )?function /);
  const code = end < 0 ? rest : rest.slice(0, end + 1);
  vm.runInContext(code, context);
  return context[name];
}

test("numeric input rejects null, empty, codes and booleans but retains zero and negatives", () => {
  const { number } = sandbox().OFW_WORKFLOW;
  for (const value of [null, undefined, "", "0", true, false, {}, [], NaN, Infinity]) assert.equal(number(value), null);
  for (const value of [0, -2, 0.4, 100]) assert.equal(number(value), value);
});

test("requested result mode never falls through to another available envelope", () => {
  const W = sandbox().OFW_WORKFLOW;
  const state = { results: { candidateEnvelope: { resultId: "candidate" }, simulationEnvelope: { resultId: "simulation" } } };
  assert.equal(W.envelopeFor(state, "formal"), null);
  assert.equal(W.envelopeFor(state, "shadow"), null);
  assert.equal(W.envelopeFor(state, "simulation").resultId, "simulation");
  assert.equal(W.envelopeFor(state, "candidate").resultId, "candidate");
});

test("explicit current object, object set and all scopes are respected", () => {
  const W = sandbox().OFW_WORKFLOW;
  const rows = [{ id: "A" }, { id: "B" }, { id: "C" }];
  const context = { activeObjectRef: { id: "B" }, objectSetRef: { objectIds: ["A", "B"], selectionMode: "EXPLICIT" } };
  assert.deepEqual(W.scopeRows(rows, context).map((item) => item.id), ["B"]);
  assert.deepEqual(W.scopeRows(rows, { ...context, analysisScope: "set" }).map((item) => item.id), ["A", "B"]);
  assert.equal(W.scopeRows(rows, { ...context, analysisScope: "all" }).length, 3);
  assert.equal(W.scopeRows(rows, { activeObjectRef: { id: "missing" } }).length, 0);
  assert.equal(W.scopeRows(rows, { objectSetRef: { objectIds: [], selectionMode: "FILTERED" } }).length, 0);
  assert.equal(W.scopeRows(rows, { objectSetRef: { objectIds: [], count: 0, id: "asset-catalog" } }).length, 3);
});

test("explicit cross-module identity mappings do not guess other objects", () => {
  const W = sandbox().OFW_WORKFLOW;
  const rows = [{ subjectId: "FinancingEntity-002", score: 68 }, { subjectId: "FinancingEntity-003", score: 74 }];
  assert.equal(W.scopeRows(rows, { activeObjectRef: { id: "s001.entity.553" } })[0].score, 68);
  assert.equal(W.scopeRows(rows, { activeObjectRef: { id: "UNIT-561" } }).length, 0);
  assert.equal(W.canonicalId("unknown-id"), "unknown-id");
});

test("report snapshot retains exact result and model provenance without promoting null values", () => {
  const W = sandbox().OFW_WORKFLOW;
  const state = { results: { formalEnvelope: { resultId: "FACT-1", modelVersionId: "MODEL-1", dataVersionId: "DATA-1", ontologyVersionId: "ONT-1", subjects: [{ id: "B", name: "Subject B", score: null }] }, candidateEnvelope: { resultId: "CANDIDATE-2", modelVersionId: "MODEL-2", subjects: [{ id: "B", score: 77 }] } } };
  const block = W.snapshotBlock(state, { resultView: "formal", activeObjectRef: { id: "B" } }, "report");
  assert.equal(block.resultId, "FACT-1");
  assert.equal(block.modelVersionId, "MODEL-1");
  assert.equal(block.ontologyVersionId, "ONT-1");
  assert.equal(block.rows[0].value, null);
});

test("report writes are idempotent, editable and isolated from older versions", () => {
  const context = sandbox(), W = context.OFW_WORKFLOW;
  context.localStorage.setItem("ofw.v130.native-report.S003", "old-report");
  const block = { title: "Report", text: "Observation", rows: [{ name: "A", value: 0 }], resultMode: "formal", sourceModuleId: "m07" };
  W.appendBlock("S003", block); W.appendBlock("S003", block);
  const saved = W.readReport("S003");
  assert.equal(saved.contentBlocks.length, 1);
  saved.contentBlocks[0].text = "Edited";
  W.saveReport("S003", saved);
  assert.equal(W.readReport("S003").contentBlocks[0].text, "Edited");
  assert.equal(W.readReport("S004"), null);
  assert.equal(context.localStorage.getItem("ofw.v130.native-report.S003"), "old-report");
});

test("explicit target switch clears incompatible selection atomically and keeps target identity", () => {
  const context = sandbox();
  vm.runInContext(read("s001-e2e-integration/data.js"), context);
  vm.runInContext(read("s001-e2e-integration/state.js"), context);
  const store = context.OFW_V131_STORE;
  store.updateWorkspaceContext({ activeObjectRef: { id: "old", scenarioId: "S005" }, resultView: "simulation" });
  store.updateWorkspaceContext({ scenarioId: "S003", objectiveRef: { id: "objective", scenarioId: "S003" } });
  assert.equal(store.get().activeScenarioId, "S003");
  assert.equal(store.workspaceContext().activeObjectRef, null);
  assert.equal(store.workspaceContext().scenarioId, "S003");
  assert.equal(store.workspaceContext().resultView, "formal");
  assert.match(store.STORAGE_KEY, /v1\.4/);
  assert.doesNotThrow(() => store.modelingProjection("S003", "M04_DECISION"));
});

test("metric lookup matches the selected version and never another version of the same model", () => {
  const context = sandbox();
  context.state = { benchmarks: [{ comparableModels: [{ modelId: "model", modelVersionId: "v1", metrics: { prAuc: .4 } }, { modelId: "model", modelVersionId: "v2", metrics: { prAuc: .8 } }] }], candidates: [{ modelId: "model", modelVersionId: "v2", metrics: { mae: .9 } }] };
  const metrics = loadFunction(context, "model-center/app.js", "metricsForOption");
  assert.equal(metrics({ modelId: "model", versionId: "v1" }).prAuc, .4);
  assert.equal(metrics({ modelId: "model", versionId: "unknown" }).mae, undefined);
});

test("metric formatting uses metric types, not the magnitude of a value", () => {
  const context = sandbox();
  context.finite = (value) => typeof value === "number" && Number.isFinite(value);
  context.percent = (value) => `${value * 100}%`;
  context.METRIC_DEFINITIONS = { mae: { format: "decimal", digits: 3 }, coverage: { format: "percent" } };
  const format = loadFunction(context, "model-center/app.js", "metricValue");
  assert.equal(format("mae", .4), "0.400");
  assert.equal(format("coverage", .4), "40%");
  assert.equal(format("mae", null), "无法评价");
});

test("candidate return cannot substitute simulation or another subject", () => {
  const context = sandbox();
  context.hostContext = { explorationHandoff: { objectRef: { id: "B", title: "B", objectTypeRef: "Subject" }, lensRef: {}, timeRange: {}, dataVersionId: "REQUEST-DATA", ontologyVersionId: "REQUEST-ONT" } };
  context.selectedResultView = "candidate"; context.scenarioId = "S003"; context.scenarioContext = { scenarioId: "S003" };
  context.resultKindLabel = (value) => value;
  context.state = { cycle: { cycleId: "CYCLE" }, scenario: {}, results: { candidateEnvelope: { resultId: "CANDIDATE", runId: "RUN-C", resultKind: "PREDICTION", dataVersionId: "ACTUAL-DATA", modelVersionId: "v1", subjects: [{ subjectId: "B", score: 12 }] }, simulationEnvelope: { resultKind: "SIMULATION", subjects: [{ subjectId: "A", score: 73 }] } } };
  const result = loadFunction(context, "model-center/app.js", "explorationReturnPayload");
  assert.equal(result().resultEnvelope.subjects[0].score, 12);
  assert.equal(result().resultEnvelope.sourceProvenance.dataVersionId, "ACTUAL-DATA");
  assert.equal(result().resultEnvelope.inputSnapshot.dataVersionId, "ACTUAL-DATA");
  assert.equal(result().resultEnvelope.requestSnapshot.dataVersionId, "REQUEST-DATA");
  context.selectedResultView = "simulation";
  assert.throws(result, /没有可返回/);
  context.selectedResultView = "formal";
  assert.throws(result, /请选择/);
});

test("expanding both sides of a cyclic relationship terminates without duplicating nodes", () => {
  const context = sandbox();
  const a = { id: "A" }, b = { id: "B" }, link = { id: "AB", from: "A", to: "B" };
  context.state = { graphExpanded: ["A", "B"] };
  context.activeObject = () => a;
  context.resolveObject = (id) => id === "A" ? a : id === "B" ? b : null;
  context.indexes = { linksByObject: new Map([["A", [link]], ["B", [link]]]) };
  context.hashString = () => "0";
  const graph = loadFunction(context, "modules/m07/app.js", "graphProjection")();
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.links.length, 1);
});
