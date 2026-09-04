import assert from "node:assert/strict";
import test from "node:test";
import { startCandidate } from "../start-candidate.mjs";

test("one launcher serves the unified Shell, continuous optimization API and parent M08 compatibility routes", async (t) => {
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  t.after(() => runtime.close());
  const entry = await fetch(runtime.entryUrl.split("#")[0]);
  assert.equal(entry.status, 200);
  assert.match(await entry.text(), /id="app"/);
  const health = await fetch(`${runtime.modelingUrl}/v1/continuous/health`).then((response) => response.json());
  assert.equal(health.prototypeVersion, "v1.3.0-rc.1");
  assert.equal(health.parentCommit, "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0");
  assert.equal(health.formalModelMutable, false);
  const parentHealth = await fetch(`${runtime.modelingUrl}/health`).then((response) => response.json());
  assert.equal(parentHealth.namespace, "ofw.m08.research.v1");
  const parentObjectives = await fetch(`${runtime.modelingUrl}/v1/objectives`).then((response) => response.json());
  assert.equal(parentObjectives.objectives.filter((item) => item.scenarioIds?.includes("S003")).length, 8);
  const built = await fetch(`${runtime.modelingUrl}/v1/continuous/actions/build-data`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((response) => response.json());
  assert.equal(built.cycle.status, "DATA_BUILT");
  assert.equal(built.nextAction.id, "validate-data");
  const m07 = await fetch(`${runtime.staticUrl}/designs/prototype-work/v1.2.0/composite/modules/m07/module/workspace-v2.html`);
  assert.equal(m07.headers.get("x-ofw-parent-compatibility-fix"), "m07-leaflet-css-sri");
  const m07Html = await m07.text();
  assert.match(m07Html, /sha384-Eg\+NzzpxiHf8n8FR0ootH\/p\/s0a33ljAFe4AqhcVbsQfR\/WmVsHNIR1Uh37E0omq/);
  assert.match(m07Html, /m07-type-overlays\.js\?v=20260902-01/);
});

test("not-yet-formed result kinds return an honest 200 NOT_READY envelope", async (t) => {
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  t.after(() => runtime.close());
  const response = await fetch(`${runtime.modelingUrl}/v1/s003/results/recalculate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioContext: { scenarioId: "S003", scenarioVersion: "S003-v1", scenarioRunId: "S003-RUN-20260817163000000-c02200000001", formedAt: "2026-08-17T16:30:00.000Z", status: "completed" }, resultKind: "SHADOW" }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.status, "NOT_READY");
  assert.equal(body.resultEnvelope, null);
  assert.match(body.missingReason, /尚未形成/);
});

test("v1.2 M08 routes drive the v1.3 continuous runtime without wrapper redirects", async (t) => {
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  t.after(() => runtime.close());
  const post = async (path, body = {}) => {
    const response = await fetch(`${runtime.modelingUrl}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    assert.equal(response.ok, true, `${path}: ${payload.code || payload.message}`);
    return payload;
  };
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract"]) await post(`/v1/continuous/actions/${action}`);
  let workspace = await post("/v1/s003/benchmark/run");
  assert.equal(workspace.lastBenchmark.status, "EVALUATED");
  assert.equal(workspace.supplementalModels.length, 7);
  workspace = await post("/v1/s003/insights/generate");
  assert.equal(workspace.insights.length, 3);
  workspace = await post("/v1/s003/insights/review", { decision: "APPROVED", reviewedBy: "test-reviewer", comment: "批准进入候选构建。" });
  assert.equal(workspace.insightReview.decision, "APPROVED");
  workspace = await post("/v1/s003/candidates/evaluate");
  assert.equal(workspace.candidates.length, 3);
  workspace = await post("/v1/s003/shadow/start", { candidateId: workspace.candidates.at(-1).candidateId });
  for (let index = 0; index < 3; index += 1) workspace = await post("/v1/s003/shadow/advance");
  assert.equal(workspace.shadowTrial.status, "MATURED");
  workspace = await post("/v1/s003/benchmark/run");
  workspace = await post("/v1/s003/release-candidates/form");
  workspace = await post("/v1/s003/bindings/validate");
  workspace = await post("/v1/s003/bindings/apply-default", { confirmed: true, confirmedBy: "test-reviewer" });
  assert.equal(workspace.binding.status, "APPLIED");
  const result = await post("/v1/s003/results/recalculate", { scenarioContext: { scenarioId: "S003", scenarioVersion: "S003-v1", scenarioRunId: "S003-RUN-20260817163000000-c02200000001", formedAt: "2026-08-17T16:30:00.000Z", status: "completed" }, usageIntent: "SHADOW" });
  assert.equal(result.resultEnvelope.outputs.length, 21);
  assert.equal(result.resultEnvelope.subjects.length, 21);
  assert.deepEqual(result.resultEnvelope.resultItems.map((item) => item.outputId), ["enterpriseCount", "highRisk90d", "liquidityGap90d", "modelDisagreements"]);
  assert.equal(result.resultEnvelope.factWriteAllowed, false);
});

test("generic model-management contract drives all five registered scenarios", async (t) => {
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  t.after(() => runtime.close());
  const post = async (scenarioId, action, payload = {}) => {
    const response = await fetch(`${runtime.modelingUrl}/v1/model-management/actions/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId, payload }) });
    const body = await response.json();
    assert.equal(response.ok, true, `${scenarioId}/${action}: ${body.code || body.message}`);
    return body;
  };
  const catalog = await fetch(`${runtime.modelingUrl}/v1/model-management/scenarios`).then((response) => response.json());
  assert.deepEqual(catalog.scenarios.map((item) => item.scenario.scenarioId), ["S001", "S002", "S003", "S004", "S005"]);
  for (const scenarioId of ["S001", "S002", "S003", "S004", "S005"]) {
    let context = await fetch(`${runtime.modelingUrl}/v1/model-management/context?scenarioId=${scenarioId}`).then((response) => response.json());
    assert.equal(context.module.name, "模型优化中心");
    assert.equal(context.state.nextAction.id, "build-data");
    for (const action of ["build-data", "validate-data", "freeze-data", "create-contract"]) context = await post(scenarioId, action);
    assert.equal(context.state.nextAction.id, "benchmark-baseline");
    for (const action of ["benchmark-baseline", "run-models", "generate-insights"]) context = await post(scenarioId, action);
    assert.equal(context.state.nextAction.id, "review-insights");
    context = await post(scenarioId, "review-insights", { decision: "APPROVED", reviewedBy: "scenario-reviewer" });
    for (const action of ["create-candidate", "start-shadow", "advance-shadow", "advance-shadow", "advance-shadow", "rebenchmark", "form-release", "validate-binding"]) context = await post(scenarioId, action, action === "start-shadow" ? { candidateId: context.state.candidates.at(-1)?.candidateId } : {});
    context = await post(scenarioId, "apply-binding", { confirmed: true, confirmedBy: "scenario-reviewer" });
    assert.equal(context.state.consumerBinding.status, "APPLIED");
    assert.equal(context.state.formalBaseline.publishedPointerMutableByPrototype, false);
  }
});
