import test from "node:test";
import assert from "node:assert/strict";
import {
  candidateWeightAudit,
  createDeterministicS003Candidates,
  createS003BaselineModelVersion,
  evaluateS003Model,
  loadS003BenchmarkSources,
  materializeS003Observations,
  validateS003TemporalIntegrity
} from "../src/s003-benchmark.mjs";
import { createS003Runtime, m04S003ResultGuard } from "../src/s003-runtime.mjs";

function prepareEvaluatedRuntime() {
  const runtime = createS003Runtime();
  runtime.runBenchmark();
  runtime.generateInsights();
  runtime.generateCandidates();
  runtime.evaluateCandidates();
  return runtime;
}

function completeShadow(runtime, candidateId = "CAND-S003-A-REWEIGHT-v1") {
  runtime.startShadow({ candidateId });
  runtime.advanceShadow();
  runtime.advanceShadow();
  return runtime.advanceShadow();
}

test("S003 source descriptors verify exact read-only M01 and fixed-result SHA-256 values", () => {
  const sources = loadS003BenchmarkSources();
  assert.equal(sources.baselinePackage.packageId, "S003-M01-DEBT-RISK-PKG");
  assert.equal(sources.baselinePackage.packageVersion, "1.0.2");
  assert.equal(sources.sourceVerification.baselinePackage.actualSha256, "c1bcfdf2c61313e57233ad4ecd471e24b09535aa7f62d4bfb97741e15ec9b014");
  assert.equal(sources.sourceVerification.baselinePackage.copiedIntoM08, false);
  assert.equal(sources.sourceVerification.fixedResultSet.actualSha256, "fbcbff5095a556293cf3ede0249c548bb9208da8a2e2f66139be418419fabf7a");
  assert.equal(sources.fixedResultSet.enterpriseCount, 21);
});

test("synthetic benchmark materializes 21 enterprises across four time windows without future leakage", () => {
  const sources = loadS003BenchmarkSources();
  const observations = materializeS003Observations(sources.fixture, sources.baselinePackage);
  assert.equal(observations.length, 84);
  assert.deepEqual(Object.fromEntries(["TRAIN", "VALIDATION", "HOLDOUT", "SHADOW"].map((split) => [split, observations.filter((item) => item.split === split).length])), {
    TRAIN: 21,
    VALIDATION: 21,
    HOLDOUT: 21,
    SHADOW: 21
  });
  assert.ok(observations.every((item) => item.metricRiskSignals.length === 15));
  assert.ok(observations.every((item) => item.factorRiskSignals.length === 6));
  assert.ok(observations.every((item) => item.outcome.evidenceRef.startsWith("SYN-EVID-")));
  assert.ok(observations.every((item) => item.outcome.observedAt > `${item.predictionAsOf}T00:00:00.000Z`));
  assert.deepEqual(validateS003TemporalIntegrity(observations), { status: "VALID", checkedRows: 84, futureLeakageRows: 0 });
  assert.equal(sources.fixture.labelsDerivedFromModelOutput, false);
  assert.equal(sources.fixture.labelsDerivedFromRiskLights, false);
  assert.equal(sources.fixture.labelsDerivedFromReports, false);
  assert.equal(sources.fixture.labelsDerivedFromM04Disposition, false);
});

test("temporal validator rejects a feature that became available after predictionAsOf", () => {
  const sources = loadS003BenchmarkSources();
  const observations = materializeS003Observations(sources.fixture, sources.baselinePackage);
  observations[0].availableAt = "2024-02-01T00:00:00.000Z";
  assert.throws(
    () => validateS003TemporalIntegrity(observations),
    (error) => error.code === "FUTURE_INFORMATION_LEAKAGE"
  );
});

test("baseline benchmark uses validation only and reports the full supervised metric set", () => {
  const runtime = createS003Runtime();
  const workspace = runtime.runBenchmark();
  const report = workspace.benchmark.report;
  assert.equal(workspace.status, "BENCHMARK_READY");
  assert.deepEqual(report.fixedContext.datasetSplits, ["VALIDATION"]);
  assert.equal(report.fixedContext.holdoutUsed, false);
  assert.equal(report.fixedContext.benchmarkVersion, "BENCH-S003-LONGITUDINAL-v1");
  assert.equal(report.fixedContext.evaluatorVersion, "EVAL-S003-FIXED-CAPACITY-v1");
  for (const metric of ["recallAtFixedCapacity", "prAuc", "precisionAtTop20Percent", "missedAdverseOutcomeCount", "medianLeadTimeDays", "coverage", "worstSlices", "stability", "missingRate", "drift"]) {
    assert.ok(Object.hasOwn(report.metrics, metric), metric);
  }
  assert.ok(report.labels.censoredInterventionCount > 0);
  assert.equal(report.validityClaimAllowed, false);
  assert.match(report.conclusion, /不证明正式模型有效性/);
});

test("insufficient labels return null metrics instead of zero or a validity conclusion", () => {
  const sources = loadS003BenchmarkSources();
  const observations = materializeS003Observations(sources.fixture, sources.baselinePackage).filter((item) => item.split === "VALIDATION").slice(0, 4);
  const report = evaluateS003Model({
    observations,
    referenceObservations: [],
    modelVersion: createS003BaselineModelVersion(sources.sourceVerification),
    baselinePackage: sources.baselinePackage,
    benchmark: sources.fixture.benchmark
  });
  assert.equal(report.status, "INSUFFICIENT_LABELS");
  assert.equal(report.metrics.recallAtFixedCapacity, null);
  assert.equal(report.metrics.prAuc, null);
  assert.equal(report.metrics.precisionAtTop20Percent, null);
  assert.equal(report.metrics.missedAdverseOutcomeCount, null);
  assert.match(report.conclusion, /无法评价/);
});

test("AI insights are structured evidence only and deterministic search creates A, B and blocked C", () => {
  const runtime = createS003Runtime();
  runtime.runBenchmark();
  const insightWorkspace = runtime.generateInsights();
  assert.equal(insightWorkspace.insights.length, 3);
  assert.deepEqual(insightWorkspace.aiAssistancePolicy.supportedSuggestionTypes, ["REWEIGHT", "ANCHOR_ADJUST", "THRESHOLD_ADJUST", "FACTOR_ADD", "FACTOR_MODIFY", "FACTOR_REMOVE", "MISSING_POLICY"]);
  for (const insight of insightWorkspace.insights) {
    for (const field of ["evidenceRefs", "problem", "suggestedDiff", "impactScope", "expectedImprovement", "possibleRisk", "dataOntologyDependencies", "validationMethod"]) {
      assert.ok(Object.hasOwn(insight, field), `${insight.insightId}.${field}`);
    }
    assert.equal(insight.scoreCalculationPerformed, false);
    assert.equal(insight.labelMutationAllowed, false);
    assert.equal(insight.championSelectionAllowed, false);
    assert.equal(insight.releaseAllowed, false);
  }
  const candidateWorkspace = runtime.generateCandidates();
  assert.deepEqual(candidateWorkspace.candidates.map((item) => item.type), ["REWEIGHT", "ANCHOR_ADJUST", "FACTOR_ADD"]);
  assert.deepEqual(candidateWorkspace.candidates.map((item) => item.status), ["PENDING_EVALUATION", "PENDING_EVALUATION", "DATA_REQUIRED"]);
  assert.match(candidateWorkspace.candidates[2].blockedReason, /M01.*M02/);
  assert.equal(new Set(candidateWorkspace.candidates.map((item) => item.modelVersion.modelVersionId)).size, 3);
  const direct = createDeterministicS003Candidates();
  assert.ok(direct.every((item) => Object.isFrozen(item.modelVersion)));
  assert.ok(direct.every((item) => item.modelVersion.publishedByM08 === false && item.modelVersion.t019WriteAllowed === false));
});

test("candidate experiments share one benchmark context, normalize weights and never auto-select a champion", () => {
  const runtime = prepareEvaluatedRuntime();
  const workspace = runtime.workspace();
  assert.equal(workspace.experiments.length, 2);
  assert.ok(workspace.experiments.every((item) => item.sameBenchmarkVersion && item.sameDatasetSplit && item.sameEvaluator && item.sameMetricSchema));
  assert.ok(workspace.experiments.every((item) => item.holdoutUsed === false && item.autoChampionSelected === false));
  assert.deepEqual(workspace.experiments[0].benchmarkReport.fixedContext, workspace.experiments[1].benchmarkReport.fixedContext);
  for (const candidate of workspace.candidates.slice(0, 2)) {
    assert.ok(candidate.weightAudit.every((item) => item.totalPercent === 100 && item.semanticOrderPreserved));
    assert.equal(candidate.status, "EVALUATED");
  }
  assert.equal(workspace.candidates[2].status, "DATA_REQUIRED");
  assert.equal(workspace.candidates[2].metrics, null);
});

test("three Shadow Trial windows mature independently and support rebenchmarking without holdout use", () => {
  const runtime = prepareEvaluatedRuntime();
  const workspace = completeShadow(runtime);
  assert.equal(workspace.shadowTrial.status, "MATURED");
  assert.equal(workspace.shadowTrial.currentWindow, 3);
  assert.equal(workspace.maturedLabelCount, 21);
  assert.equal(workspace.trend.length, 3);
  assert.ok(workspace.trend.every((item) => item.autoReleaseTriggered === false));
  assert.ok(workspace.trend.every((item) => item.baseline.metrics.recallAtFixedCapacity !== null));
  assert.ok(workspace.trend.every((item) => item.candidate.metrics.recallAtFixedCapacity !== null));
  assert.equal(workspace.holdout.status, "SEALED");
  const observing = runtime.advanceShadow({ decision: "CONTINUE_OBSERVE" });
  assert.equal(observing.status, "SHADOW_OBSERVING");
  assert.equal(observing.shadowTrial.continueObserveDecision.status, "CONTINUE_OBSERVING");
  const rebenchmarked = runtime.runBenchmark();
  assert.equal(rebenchmarked.benchmark.scope, "MATURED_SHADOW_LABELS");
  assert.equal(rebenchmarked.benchmark.report.fixedContext.holdoutUsed, false);
  assert.equal(rebenchmarked.benchmark.comparison.autoChampionSelected, false);
});

test("sealed holdout is consumed once only when forming the selected Release Candidate", () => {
  const runtime = prepareEvaluatedRuntime();
  completeShadow(runtime);
  const workspace = runtime.formReleaseCandidate({ candidateId: "CAND-S003-A-REWEIGHT-v1" });
  assert.equal(workspace.releaseCandidate.status, "RESEARCH_RELEASE_CANDIDATE");
  assert.equal(workspace.releaseCandidate.holdoutReport.fixedContext.holdoutUsed, true);
  assert.equal(workspace.releaseCandidate.published, false);
  assert.equal(workspace.releaseCandidate.productionEligible, false);
  assert.equal(workspace.holdout.status, "CONSUMED_FINAL_ONCE");
  assert.equal(workspace.review.selectedAutomatically, false);
  assert.throws(
    () => runtime.formReleaseCandidate({ candidateId: "CAND-S003-A-REWEIGHT-v1" }),
    (error) => error.code === "HOLDOUT_ALREADY_CONSUMED"
  );
});

test("Binding rejects unit and time-grain drift and requires exactly one explicit default-application confirmation", () => {
  const runtime = prepareEvaluatedRuntime();
  completeShadow(runtime);
  runtime.formReleaseCandidate({});
  const badBinding = runtime.workspace().objective.bindingDraft;
  badBinding.inputMappings.find((item) => item.modelPort === "assessmentAsOf").timeGrain = "month";
  let workspace = runtime.validateBinding({ binding: badBinding });
  assert.equal(workspace.binding.validationStatus, "REJECTED");
  assert.equal(workspace.binding.code, "BINDING_FIELD_MISMATCH");
  workspace = runtime.validateBinding({});
  assert.equal(workspace.binding.validationStatus, "VALID");
  assert.equal(workspace.binding.appliedAsDashboardDefaultCandidate, false);
  assert.throws(
    () => runtime.applyDefaultCandidate({ candidateId: "CAND-S003-A-REWEIGHT-v1", confirmed: false }),
    (error) => error.code === "HUMAN_CONFIRMATION_REQUIRED"
  );
  workspace = runtime.applyDefaultCandidate({ candidateId: "CAND-S003-A-REWEIGHT-v1", confirmed: true, confirmedBy: "reviewer-s003-001" });
  assert.equal(workspace.binding.applicationRole, "DASHBOARD_DEFAULT_CANDIDATE");
  assert.equal(workspace.binding.humanConfirmation.confirmationCount, 1);
  assert.equal(workspace.binding.formalFactPointerChanged, false);
  assert.equal(workspace.binding.publishedModelPointerChanged, false);
});

test("fixed S003 recalculation returns 21 enterprise predictions and preserves archived FACT identity", () => {
  const runtime = prepareEvaluatedRuntime();
  completeShadow(runtime);
  runtime.formReleaseCandidate({});
  runtime.validateBinding({});
  runtime.applyDefaultCandidate({ confirmed: true, confirmedBy: "reviewer-s003-001" });
  const { resultEnvelope, workspace } = runtime.recalculate({ usageIntent: "SHADOW", dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1", asOf: "2025-12-31" });
  assert.equal(resultEnvelope.schemaVersion, "ofw.modeling.result-envelope.v1");
  assert.equal(resultEnvelope.resultKind, "PREDICTION");
  assert.equal(resultEnvelope.usageIntent, "SHADOW");
  assert.equal(resultEnvelope.subjects.length, 21);
  assert.ok(resultEnvelope.subjects.every((item) => item.baseline.resultKind === "FACT" && item.formalFactMutated === false));
  assert.ok(resultEnvelope.subjects.every((item) => Array.isArray(item.topContributors) && item.topContributors.length > 0));
  assert.equal(resultEnvelope.inputSnapshot.scenarioContext.scenarioId, "S003");
  assert.equal(resultEnvelope.inputSnapshot.scenarioContext.scenarioVersion, "S003-v1");
  assert.match(resultEnvelope.inputSnapshot.scenarioContext.scenarioRunId, /^S003-RUN-/);
  assert.match(resultEnvelope.runId, /^M08-S003-RECALC-/);
  assert.doesNotMatch(resultEnvelope.runId, /^S003-RUN-/);
  assert.equal(resultEnvelope.scenarioRunId, null);
  assert.equal(resultEnvelope.runIdentities.scenarioRunReused, false);
  assert.match(resultEnvelope.runIdentities.benchmarkRunId, /^BENCHRUN-S003-/);
  assert.match(resultEnvelope.runIdentities.experimentRunId, /^EXPRUN-S003-/);
  assert.match(resultEnvelope.runIdentities.shadowRunId, /^SHADOWRUN-S003-/);
  assert.equal(resultEnvelope.factWriteAllowed, false);
  assert.equal(resultEnvelope.actionWriteAllowed, false);
  assert.equal(resultEnvelope.actionSourceAllowed, false);
  assert.equal(resultEnvelope.permissions.reportAccess, false);
  assert.equal(resultEnvelope.permissions.actionAccess, false);
  assert.equal(resultEnvelope.formalFactsMutated, false);
  assert.equal(resultEnvelope.archivedScenarioRunMutated, false);
  assert.equal(resultEnvelope.sideEffectsEmitted, 0);
  assert.equal(resultEnvelope.summaries.migrationMatrix.rows.length, 16);
  assert.equal(workspace.currentResultEnvelope.resultId, resultEnvelope.resultId);
  const repeated = runtime.recalculate({ usageIntent: "SHADOW", dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1", asOf: "2025-12-31" }).resultEnvelope;
  assert.notEqual(repeated.resultId, resultEnvelope.resultId);
  assert.notEqual(repeated.runId, resultEnvelope.runId);
  assert.deepEqual(repeated.subjects, resultEnvelope.subjects);
});

test("M04 hard-rejects every non-FACT S003 result with zero side effects", () => {
  const guard = m04S003ResultGuard({ resultKind: "PREDICTION" });
  assert.deepEqual(guard, {
    status: "BLOCKED",
    code: "NON_FACT_SOURCE_REJECTED",
    resultKind: "PREDICTION",
    actionRequestCreated: false,
    notificationCreated: false,
    approvalCreated: false,
    todoCreated: false,
    transactionCreated: false,
    sideEffectsEmitted: 0
  });
});

test("candidate C cannot be evaluated, shadowed or used to fabricate a result", () => {
  const runtime = prepareEvaluatedRuntime();
  assert.throws(
    () => runtime.startShadow({ candidateId: "CAND-S003-C-MATURITY-CONCENTRATION-v1" }),
    (error) => error.code === "DATA_REQUIRED"
  );
  assert.throws(
    () => runtime.recalculate({ candidateId: "CAND-S003-C-MATURITY-CONCENTRATION-v1" }),
    (error) => error.code === "DATA_REQUIRED"
  );
});

test("runtime reset clears research state without overwriting the archived S003 run", () => {
  const runtime = prepareEvaluatedRuntime();
  completeShadow(runtime);
  const archivedRunId = runtime.workspace().scenarioRunIsolation.archivedScenarioRunId;
  const reset = runtime.reset();
  assert.equal(reset.status, "READY_TO_BENCHMARK");
  assert.equal(reset.benchmark, null);
  assert.equal(reset.candidates.length, 0);
  assert.equal(reset.shadowTrial, null);
  assert.equal(reset.maturedLabelCount, 0);
  assert.equal(reset.scenarioRunIsolation.archivedScenarioRunId, archivedRunId);
  assert.deepEqual(reset.scenarioRunIsolation.overwrittenScenarioRunIds, []);
});

test("weight audit is deterministic for every source industry", () => {
  const sources = loadS003BenchmarkSources();
  const candidate = createDeterministicS003Candidates()[0];
  assert.deepEqual(candidateWeightAudit(candidate, sources.baselinePackage), candidateWeightAudit(candidate, sources.baselinePackage));
  assert.deepEqual(candidateWeightAudit(candidate, sources.baselinePackage).map((item) => item.industry).sort(), ["新能源产业-风电", "核电", "环保"].sort());
});
