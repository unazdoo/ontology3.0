import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
function context() {
  const values = new Map(); let id = 0;
  const sandbox = { console, crypto: { randomUUID: () => `QUERY-${++id}` }, localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) } };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox); vm.runInContext(read("shared/workflow.js"), sandbox);
  return sandbox;
}
function loadFunction(sandbox, name) {
  const source = read("integrations/native-module-integrations.js");
  const start = source.indexOf(`    function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf("\n    function ", start + 1);
  vm.runInContext(source.slice(start, end), sandbox);
  return sandbox[name];
}

test("baseline query settings and Agent authoring routes remain reachable from the Shell", () => {
  const source = read("s001-e2e-integration/app.js");
  for (const hash of ["#/agent", "#/history", "#/resources", "#/orchestrations"]) assert.ok(source.includes(`hash: "${hash}"`), hash);
  const baseline = readFileSync(new URL("../../../../prototype-releases/v1.1.0/report-center/review-lifecycle/canonical-app.js", import.meta.url), "utf8");
  for (const route of ["/catalog", "/create", "/definitions"]) {
    assert.ok(baseline.includes(`href="#${route}"`));
    assert.ok(source.includes(`hash: "#${route}"`));
  }
});

test("model question history freezes the answer, result version and original object scope", () => {
  const W = context().OFW_WORKFLOW;
  const answer = { ready: true, question: "风险排序", queryScenarioId: "S003", spec: { resultMode: "candidate" }, rows: [{ id: "B", name: "企业B", primary: "12.3" }], kpis: [], runtimeContext: { ui: { businessName: "债务风险" }, state: { modelRuns: new Array(1000).fill("large"), results: { candidateEnvelope: { resultId: "R1", modelVersionId: "V1", dataVersionId: "D1", subjects: new Array(1000).fill({ score: 99 }) } } } } };
  const scope = { activeObjectRef: { id: "B" }, resultView: "candidate" };
  W.saveQueryAnswer(answer, scope);
  answer.rows[0].primary = "99"; scope.activeObjectRef.id = "A";
  const saved = W.readQueryHistory()[0];
  assert.equal(saved.answer.rows[0].primary, "12.3");
  assert.equal(saved.workspaceContext.activeObjectRef.id, "B");
  assert.equal(saved.answer.runtimeContext.state.results.candidateEnvelope.modelVersionId, "V1");
  assert.ok(JSON.stringify(saved).length < 4000);
});

test("failed and cancelled queries do not get recorded as successful conversations", () => {
  const W = context().OFW_WORKFLOW;
  assert.equal(W.saveQueryAnswer({ ready: false }, {}), null);
  W.saveQueryAnswer({ ready: false, question: "failed", rows: [] }, {});
  W.saveQueryAnswer({ ready: false, cancelled: true, question: "cancelled", rows: [] }, {});
  assert.equal(W.readQueryHistory()[0].status, "cancelled");
  assert.equal(W.readQueryHistory()[1].status, "failed");
  for (let i = 0; i < 35; i++) W.saveQueryAnswer({ ready: true, question: `Q${i}`, rows: [], spec: {}, runtimeContext: {} }, {});
  assert.equal(W.readQueryHistory().length, 30);
  assert.equal(W.readQueryHistory()[0].answer.question, "Q34");
});

test("CSV preserves values and provenance while quoting delimiters and neutralizing formulas", () => {
  const W = context().OFW_WORKFLOW;
  const csv = W.queryResultCsv({ queryScenarioId: "S003", spec: { resultMode: "candidate" }, rows: [{ name: '=HYPERLINK("bad")', primary: "12,3", secondary: 'a"b', evidence: ["E1"] }], runtimeContext: { state: { results: { candidateEnvelope: { resultId: "R1", modelVersionId: "V1", dataVersionId: "D1" } } } } });
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"12,3"/);
  assert.match(csv, /a""b/);
  assert.match(csv, /"R1","V1","D1","E1"/);
});

test("decision projection distinguishes cancelled, failed and executing tasks", () => {
  const sandbox = context();
  const stage = loadFunction(sandbox, "decisionStage");
  const request = { taskId: "T1", status: "confirmed" };
  assert.equal(stage(request, new Map([["T1", { status: "cancelled" }]])), "closed");
  assert.equal(stage(request, new Map([["T1", { status: "failed" }]])), "blocked");
  assert.equal(stage(request, new Map([["T1", { status: "in_progress", overdue: true }]])), "executing");
});

test("decision summary counts and detail filters use identical stage groups", () => {
  const match = loadFunction(context(), "decisionMatchesFilter");
  assert.ok(match({ stage: "assigned" }, "executing"));
  assert.ok(match({ stage: "executing" }, "executing"));
  assert.ok(match({ stage: "closed" }, "completed"));
  assert.ok(match({ stage: "executing", overdue: true }, "blocked"));
  assert.equal(match({ stage: "executing", overdue: false }, "completed"), false);
});

test("task corrections take precedence over the original assignment without losing execution stage", () => {
  const sandbox = context();
  loadFunction(sandbox, "decisionStage"); loadFunction(sandbox, "decisionSourceLabel");
  sandbox.win = { loadDecisionState: () => ({ requests: [{ id: "R1", taskId: "T1", decision: { owner: "old", dueDate: "2000-01-01" } }], tasks: [{ id: "T1", owner: "new", dueDate: "2999-01-01", status: "in_progress" }] }) };
  const projection = loadFunction(sandbox, "decisionOperationsData")();
  assert.equal(projection.records[0].owner, "new");
  assert.equal(projection.records[0].stage, "executing");
  assert.equal(projection.records[0].overdue, false);
});

test("baseline business answers do not inherit a previously viewed model answer or model version", () => {
  const sandbox = context();
  sandbox.W = sandbox.OFW_WORKFLOW;
  sandbox.queryAnswer = { title: "旧模型历史", spec: { resultMode: "candidate" }, rows: [] };
  sandbox.context = { state: { results: { formalEnvelope: { modelVersionId: "MODEL-WRONG", dataVersionId: "MODEL-DATA" } } } };
  sandbox.state = (value) => value.state;
  sandbox.module = { id: "query" }; sandbox.scenarioId = "S001"; sandbox.workspaceContext = {};
  sandbox.workspaceResultMode = () => ({ id: "formal" }); sandbox.businessName = () => "融资";
  sandbox.readCurrentQueryRun = () => ({ run: { id: "QUERY-FACT", question: "融资成本", context: { dataVersion: "FACT-DATA", versionId: "SEM-EXACT" }, result: { title: "原生事实回答", highlights: [{ label: "成本", value: "2.372%" }] } } });
  sandbox.queryRunWorkspacePatch = () => ({ scenarioId: "S001" });
  const block = loadFunction(sandbox, "captureAnalysisBlock")(null);
  assert.equal(block.title, "原生事实回答");
  assert.equal(block.modelVersionId, null);
  assert.equal(block.dataVersionId, "FACT-DATA");
  assert.equal(block.ontologyVersionId, "SEM-EXACT");
});

test("baseline historyRuns are resolved by the selected run without falling back to a live answer", () => {
  const sandbox = context();
  sandbox.frame = { isConnected: true };
  sandbox.doc = { body: { isConnected: true } };
  const data = { currentRunId: "HISTORY", liveRuns: [{ id: "LIVE" }], historyRuns: [{ id: "HISTORY" }] };
  sandbox.win = { IQ_VARIANT: { storageKey: "baseline" }, IQDomain: { loadState: () => data } };
  const readRun = loadFunction(sandbox, "readCurrentQueryRun");
  assert.equal(readRun().run.id, "HISTORY");
  data.currentRunId = "MISSING";
  assert.equal(readRun(), null);
});
