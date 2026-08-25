"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const test = require("node:test");

const builder = require("../scripts/build-published-assets.cjs");
const packageRoot = path.resolve(__dirname, "..");
const baseModel = require("../resources/m01/model-package.v1.json");
const initialManifest = require("../resources/scenario-manifest.json");
const previousCheckpoint = require("../checkpoints/CP02-data-connected.json");
const pointer = require("../resources/m01/published-pointer.v1.json");
const evaluationRun = require("../resources/m01/evaluation-run.v1.json");
const resultSet = require("../resources/m01/c035-risk-results.v1.json");
const factSet = require("../resources/m01/published-risk-facts.v1.json");
const runtimeExport = require("../resources/m01/runtime-export.v1.json");

function sha256File(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(packageRoot, ref))).digest("hex");
}

test("CP03 builder is deterministic and creates a new fixed scenarioRunId", () => {
  const first = builder.buildPublishedAssets();
  const second = builder.buildPublishedAssets();
  assert.deepEqual(first.digests, second.digests);
  assert.equal(first.scenarioContext.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
  assert.notEqual(first.scenarioContext.scenarioRunId, initialManifest.scenario.initialScenarioRunId);
  assert.notEqual(first.scenarioContext.scenarioRunId, previousCheckpoint.scenarioContext.scenarioRunId);
  assert.equal(first.scenarioContext.scenarioId, "S003");
  assert.equal(first.scenarioContext.scenarioVersion, "S003-v1");
});

test("Published pointer activates a validated immutable 1.0.1 package without mutating the base", () => {
  assert.equal(baseModel.packageVersion, "1.0.0");
  assert.equal(baseModel.lifecycleStatus, "published");
  assert.equal(pointer.status, "active");
  assert.equal(pointer.activeTarget.packageVersion, "1.0.1");
  assert.equal(pointer.activeTarget.lifecycleStatus, "published");
  assert.equal(pointer.activeTarget.publishedSnapshot.lifecycleStatus, "published");
  assert.equal(pointer.activeTarget.publishedSnapshot.provenance.basedOnVersion, "1.0.0");
  assert.equal(pointer.sourceDraft.validationStatus, "validated");
  assert.equal(pointer.invariants.businessParametersChanged, false);
  assert.deepEqual(pointer.activeTarget.publishedSnapshot.weights, baseModel.weights);
  assert.deepEqual(pointer.activeTarget.publishedSnapshot.factors, baseModel.factors);
  assert.deepEqual(pointer.activeTarget.publishedSnapshot.riskTiers, baseModel.riskTiers);
  assert.equal(
    pointer.activeTarget.snapshotSha256,
    builder.jsonSha256(pointer.activeTarget.publishedSnapshot)
  );
});

test("first formal evaluation publishes 21 complete C035 results with golden scores", () => {
  assert.equal(evaluationRun.status, "succeeded");
  assert.equal(evaluationRun.runMode, "first-formal-evaluation");
  assert.equal(evaluationRun.newScenarioRunCreated, true);
  assert.equal(evaluationRun.sourceScenarioRunId, previousCheckpoint.scenarioContext.scenarioRunId);
  assert.equal(resultSet.status, "published-results");
  assert.equal(resultSet.enterpriseCount, 21);
  assert.equal(resultSet.results.length, 21);
  assert.ok(resultSet.results.every((result) => result.indicatorResults.length === 15));
  assert.deepEqual(resultSet.summary.riskTierCounts, {GREEN: 16, YELLOW: 4, RED: 1, BLACK: 0});

  const wind01 = resultSet.results.find((result) => result.enterprise.enterpriseId === "S003-ENT-001");
  const wind07 = resultSet.results.find((result) => result.enterprise.enterpriseId === "S003-ENT-007");
  const construction = resultSet.results.find((result) => result.enterprise.enterpriseId === "S003-ENT-010");
  assert.deepEqual([wind01.rawScore, wind01.factorSum, wind01.finalScore], [84.4, -0.3, 59.08]);
  assert.deepEqual([wind07.rawScore, wind07.factorSum, wind07.finalScore], [75.5, -0.5, 37.75]);
  assert.deepEqual([construction.rawScore, construction.factorSum, construction.finalScore], [60, -0.1, 54]);
  assert.equal(construction.factorStates["electricity-price"], "NOT_APPLICABLE");
  assert.ok(resultSet.results.every((result) => result.reportLifecycle.status === "not-generated-at-cp03"));
});

test("Published facts and runtime projection share the exact CP03 scenario identity", () => {
  const expected = resultSet.scenarioIdentity;
  assert.deepEqual(pointer.scenarioIdentity, expected);
  assert.deepEqual(evaluationRun.scenarioIdentity, expected);
  assert.deepEqual(factSet.scenarioIdentity, expected);
  assert.deepEqual(runtimeExport.scenarioIdentity, expected);
  assert.equal(factSet.status, "published");
  assert.equal(factSet.factCount, 21);
  assert.equal(factSet.facts.length, 21);
  assert.ok(factSet.facts.every((fact) => (
    fact.scenarioIdentity.scenarioId === expected.scenarioId
    && fact.scenarioIdentity.scenarioVersion === expected.scenarioVersion
    && fact.scenarioIdentity.scenarioRunId === expected.scenarioRunId
  )));
  assert.deepEqual(factSet.contracts, {
    semanticPublication: "C008",
    authoritativeDistribution: "T019",
    resultContract: "C035"
  });
});

test("disposition output remains candidate-only with no Action Request, todo or dispatch", () => {
  const candidates = resultSet.results.flatMap((result) => result.dispositionCandidates);
  assert.equal(candidates.length, 9);
  for (const candidate of candidates) {
    assert.equal(candidate.status, "CANDIDATE_AWAITING_HUMAN_CONFIRMATION");
    assert.equal(candidate.requiresHumanConfirmation, true);
    assert.equal(candidate.actionRequestId, null);
    assert.equal(candidate.todoId, null);
    assert.equal(candidate.autoCreateActionRequest, false);
    assert.equal(candidate.autoCreateTodo, false);
  }
  assert.deepEqual(evaluationRun.counts, {
    enterprisesEvaluated: 21,
    c035Results: 21,
    publishedFacts: 21,
    dispositionCandidates: 9,
    actionRequestsCreated: 0,
    todosCreated: 0,
    notificationsDispatched: 0,
    reportsGenerated: 0
  });
  assert.equal(runtimeExport.consumptionPolicy.actionRequestRequiresHumanConfirmation, true);
});

test("all materialized resources and SHA sidecars are reproducible and internally linked", () => {
  for (const ref of builder.OUTPUT_REFS) {
    const digest = sha256File(ref);
    const sidecar = fs.readFileSync(path.join(packageRoot, `${ref}.sha256`), "utf8");
    assert.equal(sidecar, `${digest}  ${path.basename(ref)}\n`);
  }
  assert.equal(evaluationRun.inputs.publishedPointer.sha256, sha256File(builder.OUTPUT_REFS[0]));
  assert.equal(evaluationRun.outputs.c035Results.sha256, sha256File(builder.OUTPUT_REFS[2]));
  assert.equal(evaluationRun.outputs.publishedFacts.sha256, sha256File(builder.OUTPUT_REFS[3]));
  assert.equal(runtimeExport.authority.evaluationRun.sha256, sha256File(builder.OUTPUT_REFS[1]));

  assert.equal(pointer.scenarioIdentity.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
  assert.equal(pointer.activeTarget.packageVersion, "1.0.1");
  assert.equal(pointer.activeTarget.snapshotSha256, builder.jsonSha256(pointer.activeTarget.publishedSnapshot));
});
