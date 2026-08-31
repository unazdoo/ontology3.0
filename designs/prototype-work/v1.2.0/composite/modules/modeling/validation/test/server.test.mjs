import test from "node:test";
import assert from "node:assert/strict";
import { listen } from "../src/server.mjs";

async function withServer(operation) {
  const server = await listen({ port: 0 });
  const address = server.address();
  try {
    return await operation(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test("health endpoint declares isolated read-only capabilities", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-ofw-namespace"), "ofw.m08.research.v1");
    assert.equal(body.mode, "isolated-research-read-only");
    assert.equal(body.factWriteAllowed, false);
    assert.ok(body.forbiddenCapabilities.includes("transaction"));
  });
});

test("objective registry API returns reusable objective kinds and full revisions", async () => {
  await withServer(async (baseUrl) => {
    const catalogResponse = await fetch(`${baseUrl}/v1/objectives`);
    const catalog = await catalogResponse.json();
    assert.equal(catalogResponse.status, 200);
    assert.equal(catalog.objectives.length, 6);
    assert.deepEqual([...new Set(catalog.objectives.map((item) => item.kind))].sort(), ["CLASSIFICATION", "FORECAST", "OPTIMIZATION", "SCORING"]);
    const detailResponse = await fetch(`${baseUrl}/v1/objectives/MO-S001-COST-FORECAST-v1`);
    const detail = await detailResponse.json();
    assert.equal(detailResponse.status, 200);
    assert.equal(detail.bindingDraft.inputMappings[0].shape, "TIME_SERIES");
    assert.equal(detail.bindingDraft.outputMappings[0].semanticKind, "RESULT_SERIES");
  });
});

test("objective API resolves compatibility, validates binding and adapts consumer projection", async () => {
  await withServer(async (baseUrl) => {
    const compatibleResponse = await fetch(`${baseUrl}/v1/objectives/compatible?objectTypeRef=FinancingEntity%40ONT-SYN-S001-FINANCING-v1&useKind=SIMULATION`);
    const compatible = await compatibleResponse.json();
    assert.deepEqual(compatible.objectives.map((item) => item.objectiveId), ["MO-S001-COST-FORECAST-v1"]);
    const bindingResponse = await fetch(`${baseUrl}/v1/objectives/MO-S001-COST-FORECAST-v1/binding/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const binding = await bindingResponse.json();
    assert.equal(binding.compatibility, "VALIDATED");
    assert.equal(binding.activationStatus, "READY_FOR_RESEARCH_CONSUMPTION");
    const projectionResponse = await fetch(`${baseUrl}/v1/objectives/MO-S001-COST-FORECAST-v1/consumer-projection?consumerId=M07_EXPLORATION`);
    const projection = await projectionResponse.json();
    assert.equal(projection.displayMode, "TIMELINE_OVERLAY");
    assert.equal(projection.concreteEndpointExposed, false);
    const s005Response = await fetch(`${baseUrl}/v1/objectives/compatible?objectTypeRef=InvestmentProduct&useKind=SIMULATION&scenarioId=S005`);
    const s005 = await s005Response.json();
    assert.deepEqual(s005.objectives.map((item) => item.objectiveId), ["MO-S005-POST-INVESTMENT-RESEARCH-v1"]);
    const isolatedResponse = await fetch(`${baseUrl}/v1/objectives/compatible?objectTypeRef=InvestmentProduct&useKind=SIMULATION&scenarioId=S001`);
    const isolated = await isolatedResponse.json();
    assert.deepEqual(isolated.objectives, []);
  });
});

test("objective consumer API returns an explainable M04 denial", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/objectives/MO-S004-PRELOAN-RISK-v1/consumer-projection?consumerId=M04_DECISION`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "BLOCKED");
    assert.equal(body.code, "NON_FACT_SOURCE_REJECTED");
    assert.equal(body.actionWriteAllowed, false);
  });
});

test("parameterized integration fixture keeps exact scenario identity and lineage", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/demo?scenarioId=S001&scenarioVersion=S001-v1&scenarioRunId=S001-RUN-TEST-001&dataVersionId=FIN-ASSET-20251231-v02&ontologyVersionId=T019-S001-v1&bindingId=T019%3AS001`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.fixture.fixtureId, "FIX-S001-SYNTHETIC-v1");
    assert.equal(body.objective.objectiveId, "MO-S001-FINANCING-v1");
    assert.equal(body.candidateComparison.topCandidateId, "CM-S001-BALANCED-v1");
    assert.ok(body.simulationRuns.every((run) => run.caseId.startsWith("SC-S001-")));
    assert.doesNotMatch(JSON.stringify(body), /S005/);
    assert.deepEqual(body.sourceContext, {
      scenarioId: "S001",
      scenarioVersion: "S001-v1",
      scenarioRunId: "S001-RUN-TEST-001",
      dataVersionId: "FIN-ASSET-20251231-v02",
      ontologyVersionId: "T019-S001-v1",
      semanticVersionId: null,
      bindingId: "T019:S001",
      projectionDigest: null
    });
  });
});

test("simulation run accepts a fresh research identity and CORS preflight", async () => {
  await withServer(async (baseUrl) => {
    const options = await fetch(`${baseUrl}/v1/simulations/run`, { method: "OPTIONS" });
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("access-control-allow-origin"), "*");
    const response = await fetch(`${baseUrl}/v1/simulations/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "S001", caseId: "SC-S001-COMPOSITE-v1", runNonce: "M08RUN-S001-TEST-001" })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.researchRunId, "M08RUN-S001-TEST-001");
    assert.equal(body.result.resultKind, "SIMULATION");
    assert.equal(body.result.factWriteAllowed, false);
    assert.equal(body.result.actionWriteAllowed, false);
    assert.equal(body.fixture.classification, "SYNTHETIC_RESEARCH_ONLY");
    assert.equal(body.fixture.containsSourceBusinessValues, false);
    const secondResponse = await fetch(`${baseUrl}/v1/simulations/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "S001", caseId: "SC-S001-COMPOSITE-v1", runNonce: "M08RUN-S001-TEST-002" })
    });
    const second = await secondResponse.json();
    assert.notEqual(second.simulationRunId, body.simulationRunId);
  });
});

test("S001 exploration context is fixed into the simulation run envelope", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/simulations/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenarioId: "S001",
        scenarioVersion: "S001-v1",
        scenarioRunId: "S001-RUN-TEST-002",
        formedAt: "2026-08-27T09:30:00.000Z",
        status: "completed",
        caseId: "SC-S001-COMPOSITE-v1",
        runNonce: "M08RUN-S001-M07-HANDOFF-001",
        sourceKind: "SYNTHETIC_RESEARCH_ONLY",
        objectiveId: "MO-S001-COST-FORECAST-v1",
        objectiveRevisionId: "MOR-S001-COST-FORECAST-0001",
        bindingRevisionId: "MB-S001-COST-FORECAST-v1-R1",
        releaseId: "MREL-S001-COST-FORECAST-RC1",
        modelVersionId: "MV-S001-COST-FORECAST-0001",
        objectRef: { id: "FIN-UNIT-553", title: "单位553" },
        focusBaselineMemberRef: "SYN-HOLDING-001",
        seriesRef: { id: "TS-FIN-COST-553-v1", unit: "%" },
        lensRef: { lensId: "LENS-S001-FINANCING-TIMELINE-v1", revision: 1 },
        timeRange: { start: "2025-07-01", end: "2025-12-31", months: 6 },
        observation: { latest: 2.880984, changePp: 0.130984 }
      })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.result.asOf, "2025-12-31");
    assert.equal(body.sourceContext.objectRef.id, "FIN-UNIT-553");
    assert.equal(body.sourceContext.scenarioVersion, "S001-v1");
    assert.equal(body.sourceContext.scenarioRunId, "S001-RUN-TEST-002");
    assert.equal(body.sourceContext.formedAt, "2026-08-27T09:30:00.000Z");
    assert.equal(body.sourceContext.status, "completed");
    assert.equal(body.sourceContext.objectiveRevisionId, "MOR-S001-COST-FORECAST-0001");
    assert.equal(body.sourceContext.bindingRevisionId, "MB-S001-COST-FORECAST-v1-R1");
    assert.equal(body.sourceContext.modelVersionId, "MV-S001-COST-FORECAST-0001");
    assert.equal(body.sourceContext.focusBaselineMemberRef, "SYN-HOLDING-001");
    assert.equal(body.sourceContext.timeRange.months, 6);
    assert.equal(body.sourceContext.observation.latest, 2.880984);
  });
});

test("review and binding endpoints return governed research resources", async () => {
  await withServer(async (baseUrl) => {
    const request = await fetch(`${baseUrl}/v1/reviews/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "S001", candidateId: "CM-S001-BALANCED-v1", sourceContext: { dataVersionId: "FIN-ASSET-20251231-v02", ontologyVersionId: "T019-S001-v1", projectionDigest: "abc" } })
    });
    const pending = await request.json();
    assert.equal(request.status, 200);
    assert.equal(pending.review.status, "PENDING_HUMAN_REVIEW");
    assert.equal(pending.sourceContext.dataVersionId, "FIN-ASSET-20251231-v02");
    const bindingResponse = await fetch(`${baseUrl}/v1/bindings/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenarioId: "S001", candidateId: "CM-S001-BALANCED-v1", sourceContext: { dataVersionId: "FIN-ASSET-20251231-v02", ontologyVersionId: "T019-S001-v1", projectionDigest: "abc" } })
    });
    const binding = await bindingResponse.json();
    assert.equal(bindingResponse.status, 200);
    assert.equal(binding.binding.status, "VALIDATED_RESEARCH_BINDING_REQUIRES_M01_CR");
    assert.equal(binding.binding.concreteEndpointExposed, false);
    assert.equal(binding.binding.t019WriteAllowed, false);
    assert.equal(binding.sourceContext.ontologyVersionId, "T019-S001-v1");
  });
});

test("demo endpoint returns the complete research flow without a Published model", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/demo`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.releaseCandidate.published, false);
    assert.equal(body.releaseCandidate.t019WriteAllowed, false);
    assert.equal(body.consumerBinding.concreteEndpointExposed, false);
    assert.deepEqual(
      body.threeStateComparison.columns.map((item) => item.resultKind),
      ["FACT", "PREDICTION", "SIMULATION"]
    );
  });
});

test("simulation endpoint executes only registered fixture cases", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/simulations/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId: "SC-S005-COMPOSITE-v1" })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "SUCCEEDED");
    assert.equal(body.sideEffectAudit.emitted, 0);
  });
});

test("side-effect routes do not exist", async () => {
  await withServer(async (baseUrl) => {
    for (const path of ["actions", "notifications", "approvals", "todos", "transactions", "webhooks"]) {
      const response = await fetch(`${baseUrl}/v1/${path}`, { method: "POST" });
      const body = await response.json();
      assert.equal(response.status, 404);
      assert.equal(body.code, "CAPABILITY_NOT_AVAILABLE");
    }
  });
});

test("invalid JSON is rejected without changing state", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/simulations/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid"
    });
    const body = await response.json();
    assert.equal(response.status, 422);
    assert.equal(body.code, "INVALID_JSON");
  });
});

test("S003 API executes the real benchmark, insight, candidate, shadow, release, binding and result chain", async () => {
  await withServer(async (baseUrl) => {
    const post = async (pathname, body = {}) => {
      const response = await fetch(`${baseUrl}${pathname}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      return { response, body: await response.json() };
    };
    let response = await fetch(`${baseUrl}/v1/s003/workspace`);
    let workspace = await response.json();
    assert.equal(workspace.status, "READY_TO_BENCHMARK");

    ({ response, body: workspace } = await post("/v1/s003/benchmark/run"));
    assert.equal(response.status, 200);
    assert.match(workspace.benchmark.benchmarkRunId, /^BENCHRUN-S003-/);
    assert.equal(workspace.benchmark.report.fixedContext.holdoutUsed, false);

    ({ body: workspace } = await post("/v1/s003/insights/generate"));
    assert.equal(workspace.insights.length, 3);
    ({ body: workspace } = await post("/v1/s003/candidates/generate"));
    assert.equal(workspace.candidates[2].status, "DATA_REQUIRED");
    ({ body: workspace } = await post("/v1/s003/candidates/evaluate"));
    assert.equal(workspace.experiments.length, 2);

    ({ body: workspace } = await post("/v1/s003/shadow/start", { candidateId: "CAND-S003-A-REWEIGHT-v1" }));
    assert.match(workspace.shadowTrial.shadowRunId, /^SHADOWRUN-S003-/);
    for (let index = 0; index < 3; index += 1) {
      ({ body: workspace } = await post("/v1/s003/shadow/advance", { decision: "CONTINUE" }));
    }
    assert.equal(workspace.shadowTrial.status, "MATURED");
    assert.equal(workspace.trend.length, 3);

    ({ body: workspace } = await post("/v1/s003/release-candidates/form", { candidateId: "CAND-S003-A-REWEIGHT-v1" }));
    assert.equal(workspace.holdout.status, "CONSUMED_FINAL_ONCE");
    ({ body: workspace } = await post("/v1/s003/bindings/validate"));
    assert.equal(workspace.binding.validationStatus, "VALID");

    let failed = await post("/v1/s003/bindings/apply-default", { candidateId: "CAND-S003-A-REWEIGHT-v1", confirmed: false });
    assert.equal(failed.response.status, 422);
    assert.equal(failed.body.code, "HUMAN_CONFIRMATION_REQUIRED");
    ({ body: workspace } = await post("/v1/s003/bindings/apply-default", { candidateId: "CAND-S003-A-REWEIGHT-v1", confirmed: true, confirmedBy: "reviewer-api-001" }));
    assert.equal(workspace.binding.applicationRole, "DASHBOARD_DEFAULT_CANDIDATE");

    const recalculated = await post("/v1/s003/results/recalculate", { candidateId: "CAND-S003-A-REWEIGHT-v1", usageIntent: "SHADOW", dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1", asOf: "2025-12-31" });
    assert.equal(recalculated.response.status, 200);
    assert.equal(recalculated.body.resultEnvelope.subjects.length, 21);
    assert.match(recalculated.body.resultEnvelope.runId, /^M08-S003-RECALC-/);
    assert.equal(recalculated.body.resultEnvelope.actionSourceAllowed, false);

    const m04 = await post("/v1/s003/m04/guard", { resultEnvelope: recalculated.body.resultEnvelope });
    assert.equal(m04.body.code, "NON_FACT_SOURCE_REJECTED");
    assert.equal(m04.body.sideEffectsEmitted, 0);
  });
});
