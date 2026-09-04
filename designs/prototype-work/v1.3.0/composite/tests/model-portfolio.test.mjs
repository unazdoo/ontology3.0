import assert from "node:assert/strict";
import test from "node:test";
import { createModelPortfolioRuntime } from "../runtime/model-portfolio-engine.mjs";
import { S003_REGISTRATION } from "../runtime/s003-registration.mjs";

function completeRuntime() {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of [
    "build-data",
    "validate-data",
    "freeze-data",
    "create-contract",
    "benchmark-baseline",
    "run-models",
    "generate-insights"
  ]) runtime.action(action);
  runtime.action("review-insights", { decision: "APPROVED", reviewedBy: "test-business-reviewer", comment: "证据与验证约束已核对。" });
  for (const action of [
    "create-candidate",
    "start-shadow",
    "advance-shadow",
    "advance-shadow",
    "advance-shadow",
    "rebenchmark",
    "form-release",
    "validate-binding"
  ]) runtime.action(action);
  return runtime;
}

test("exact v1.2.0 parent and formal 1.0.2 baseline remain immutable", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  const baseline = runtime.formalBaseline();
  assert.equal(S003_REGISTRATION.parentReference.parentCommit, "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0");
  assert.equal(S003_REGISTRATION.parentReference.parentSubtree, "e57caf36b4a815b4d363ca93ee69305c12228938");
  assert.equal(baseline.modelVersion, "1.0.2");
  assert.equal(baseline.sourceModelSha256, "c1bcfdf2c61313e57233ad4ecd471e24b09535aa7f62d4bfb97741e15ec9b014");
  assert.equal(baseline.sourceResultSha256, "fbcbff5095a556293cf3ede0249c548bb9208da8a2e2f66139be418419fabf7a");
  assert.equal(baseline.resultEnvelope.resultKind, "FACT");
  assert.equal(baseline.resultEnvelope.subjects.length, 21);
  assert.equal(baseline.publishedPointerMutableByPrototype, false);
});

test("M02 creates, validates and freezes a recomputable synthetic longitudinal DataVersion", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  let state = runtime.action("build-data");
  assert.equal(state.data.synthetic, true);
  assert.equal(state.data.deidentified, true);
  assert.equal(state.data.recomputable, true);
  assert.equal(state.data.observationCount, 168);
  assert.equal(state.data.enterpriseCount, 21);
  assert.equal(state.data.immutable, false);
  state = runtime.action("validate-data");
  assert.equal(state.data.validationStatus, "VALID");
  assert.equal(state.data.quality.futureLeakageRows, 0);
  assert.equal(state.data.quality.invalidOutcomeRows, 0);
  assert.equal(state.data.quality.labelIndependence, "PASSED");
  state = runtime.action("freeze-data");
  assert.equal(state.data.status, "FROZEN");
  assert.equal(state.data.immutable, true);
  assert.match(state.data.checksum, /^[a-f0-9]{64}$/);
  assert.throws(() => runtime.action("validate-data"), (error) => error.code === "DATA_ALREADY_FROZEN");
});

test("M01 forms a cycle-frozen multi-model semantic contract with explicit result identities", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  runtime.action("build-data");
  runtime.action("validate-data");
  runtime.action("freeze-data");
  const state = runtime.action("create-contract");
  assert.equal(state.semanticContract.publishedOntology, false);
  assert.equal(state.semanticContract.immutableWithinCycle, true);
  assert.ok(state.semanticContract.objectTypes.includes("RelationshipEdge"));
  assert.ok(state.semanticContract.objectTypes.includes("ModelResult"));
  assert.deepEqual(state.semanticContract.resultIdentities.map((item) => item.resultKind), ["FACT", "PREDICTION", "SHADOW", "SIMULATION"]);
  assert.ok(state.semanticContract.metrics.some((item) => item.propertyRef === "probability90d" && item.unit === "probability"));
  assert.ok(state.semanticContract.metrics.some((item) => item.propertyRef === "liquidityGap" && item.unit === "CNY_million"));
});

test("M08 runs one formal baseline, two core Challengers and seven supplemental models", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models"]) runtime.action(action);
  const state = runtime.state();
  assert.equal(state.objectives.length, 8);
  assert.equal(state.modelDefinitions.length, 10);
  assert.equal(state.modelDefinitions.filter((item) => item.modelRole === "CORE_CHALLENGER").length, 2);
  assert.equal(state.modelDefinitions.filter((item) => item.modelRole === "SUPPLEMENTAL").length, 7);
  assert.equal(state.modelRuns.length, 9);
  assert.equal(new Set(state.modelRuns.map((item) => item.modelRunId)).size, 9);
  assert.ok(state.modelRuns.every((item) => item.status === "SUCCEEDED" && item.factWriteAllowed === false && item.actionWriteAllowed === false));
  const comparable = state.benchmarks.find((item) => item.scope === "PORTFOLIO_COMPARISON");
  assert.equal(comparable.comparableModels.length, 3);
  assert.equal(comparable.automaticChampionSelected, false);
  assert.ok(state.benchmarks.filter((item) => item.scope === "SUPPLEMENTAL_OBJECTIVE").every((item) => item.crossObjectiveRankingAllowed === false));
  assert.equal(new Set(state.benchmarks.map((item) => item.benchmarkRunId)).size, state.benchmarks.length);
  assert.equal(state.results.candidateEnvelope.resultKind, "PREDICTION");
  assert.equal(state.results.supplementalEnvelopes.length, 7);
  assert.ok(state.results.supplementalEnvelopes.every((item) => item.subjects.length === 21));
});

test("AI insights cannot mutate labels, select a champion or publish", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models", "generate-insights"]) runtime.action(action);
  const state = runtime.state();
  assert.equal(state.insights.length, 3);
  for (const insight of state.insights) {
    assert.ok(insight.evidenceRefs.length > 0);
    assert.equal(insight.labelMutationAllowed, false);
    assert.equal(insight.formalModelMutationAllowed, false);
    assert.equal(insight.automaticChampionSelectionAllowed, false);
    assert.equal(insight.releaseAllowed, false);
  }
});

test("human insight review is immutable and gates candidate creation", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models", "generate-insights"]) runtime.action(action);
  assert.equal(runtime.state().nextAction.id, "review-insights");
  assert.throws(() => runtime.action("create-candidate"), (error) => error.code === "APPROVED_INSIGHT_REVIEW_REQUIRED");
  const reviewed = runtime.action("review-insights", { decision: "APPROVED", reviewedBy: "risk-owner", comment: "批准进入候选构建。" });
  assert.equal(reviewed.insightReview.decision, "APPROVED");
  assert.equal(reviewed.insightReview.immutable, true);
  assert.match(reviewed.insightReview.receiptDigest, /^[a-f0-9]{64}$/);
  assert.equal(reviewed.nextAction.id, "create-candidate");
  assert.throws(() => runtime.action("review-insights", { decision: "REJECTED", reviewedBy: "risk-owner" }), (error) => error.code === "INSIGHT_REVIEW_IMMUTABLE");
  const candidate = runtime.action("create-candidate").candidates[0];
  assert.equal(candidate.insightReviewReceiptId, reviewed.insightReview.reviewReceiptId);
  assert.equal(candidate.insightReviewDigest, reviewed.insightReview.receiptDigest);
});

test("rejected insight review is preserved before a new insight batch is generated", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models", "generate-insights"]) runtime.action(action);
  const firstBatch = runtime.state().insights[0].batchId;
  runtime.action("review-insights", { decision: "REJECTED", reviewedBy: "risk-owner", comment: "需要补充最弱切片证据。" });
  assert.equal(runtime.state().nextAction.id, "generate-insights");
  const regenerated = runtime.action("generate-insights");
  assert.equal(regenerated.insightHistory.length, 1);
  assert.equal(regenerated.insightHistory[0].review.decision, "REJECTED");
  assert.notEqual(regenerated.insights[0].batchId, firstBatch);
  assert.equal(regenerated.insightReview, null);
});

test("candidate creation uses a new immutable Model Version and survives Shadow/Release unchanged", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models", "generate-insights"]) runtime.action(action);
  runtime.action("review-insights", { decision: "APPROVED", reviewedBy: "risk-owner" });
  runtime.action("create-candidate");
  const before = runtime.state().candidates[0];
  assert.equal(before.immutable, true);
  assert.equal(before.published, false);
  assert.equal(before.automaticChampionSelected, false);
  assert.notEqual(before.modelVersionId, S003_REGISTRATION.formalBaseline.modelVersionId);
  for (const action of ["start-shadow", "advance-shadow", "advance-shadow", "advance-shadow", "rebenchmark", "form-release"]) runtime.action(action);
  const after = runtime.state().candidates[0];
  assert.equal(after.modelVersionId, before.modelVersionId);
  assert.equal(after.versionDigest, before.versionDigest);
  assert.deepEqual(after.parameterPolicy, before.parameterPolicy);
});

test("three label windows mature, rebenchmark uses the same context, and holdout is consumed once", () => {
  const runtime = completeRuntime();
  const state = runtime.state();
  assert.equal(state.shadowTrial.status, "MATURED");
  assert.equal(state.shadowTrial.maturedWindows.length, 3);
  assert.deepEqual(state.shadowTrial.maturedWindows.map((item) => item.newMaturedLabelCount), [7, 7, 7]);
  assert.ok(state.shadowTrial.maturedWindows.every((item) => item.automaticReleaseTriggered === false));
  const rebenchmark = state.benchmarks.find((item) => item.scope === "MATURED_SHADOW_LABELS");
  assert.equal(rebenchmark.fixedContext.dataVersionId, state.data.dataVersionId);
  assert.equal(rebenchmark.fixedContext.holdoutUsed, false);
  assert.equal(state.holdout.status, "CONSUMED_ONCE");
  assert.equal(state.holdout.repeatedUseAllowed, false);
  assert.equal(state.releaseCandidate.published, false);
  assert.equal(state.releaseCandidate.productionEligible, false);
  assert.throws(() => runtime.action("form-release"), (error) => error.code === "HOLDOUT_ALREADY_USED");
});

test("Dashboard Binding requires explicit confirmation and never changes the formal pointer", () => {
  const runtime = completeRuntime();
  assert.throws(() => runtime.action("apply-binding", { confirmed: false }), (error) => error.code === "HUMAN_CONFIRMATION_REQUIRED");
  const applied = runtime.action("apply-binding", { confirmed: true, confirmedBy: "reviewer-s003" });
  assert.equal(applied.consumerBinding.status, "APPLIED");
  assert.equal(applied.consumerBinding.applicationRole, "DASHBOARD_CONSUMER_BINDING");
  assert.equal(applied.consumerBinding.formalModelVersionId, "MV-S003-DEBT-RISK-1.0.2-FORMAL");
  assert.equal(applied.consumerBinding.formalModelPointerChanged, false);
  assert.equal(applied.consumerBinding.formalFactPointerChanged, false);
  assert.deepEqual(applied.consumerBinding.viewMappings.map((item) => item.view), ["FORMAL", "CANDIDATE", "SHADOW", "SIMULATION", "DIFF"]);
});

test("Dashboard and all read-only consumers share one Result Package digest", () => {
  const runtime = completeRuntime();
  runtime.action("apply-binding", { confirmed: true, confirmedBy: "reviewer-s003" });
  runtime.action("run-stress", {});
  const consumers = ["Dashboard", "M07_EXPLORATION", "M03_QUERY", "M05_EXPLANATION", "M06_REPORT"].map((consumerId) => runtime.consumerProjection(consumerId));
  assert.equal(new Set(consumers.map((item) => item.resultPackageId)).size, 1);
  assert.equal(new Set(consumers.map((item) => item.resultPackageDigest)).size, 1);
  const dashboard = consumers[0].resultPackage;
  assert.equal(dashboard.envelopes.filter((item) => item.resultKind === "FACT").length, 1);
  assert.ok(dashboard.envelopes.some((item) => item.resultKind === "PREDICTION"));
  assert.ok(dashboard.envelopes.some((item) => item.resultKind === "SHADOW"));
  assert.ok(dashboard.envelopes.some((item) => item.resultKind === "SIMULATION"));
  assert.equal(dashboard.truthBoundary.formalFactsMutated, false);
  assert.equal(dashboard.truthBoundary.sideEffectsEmitted, 0);
});

test("M04 hard-rejects every non-FACT result with zero side effects", () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const kind of ["PREDICTION", "SHADOW", "SIMULATION"]) {
    assert.deepEqual(runtime.guard(kind), {
      status: "BLOCKED",
      code: "NON_FACT_SOURCE_REJECTED",
      resultKind: kind,
      reason: "预测、候选、影子或模拟结果不能直接创建行动、审批、提醒、待办、通知或交易。",
      actionRequestCreated: false,
      approvalCreated: false,
      reminderCreated: false,
      todoCreated: false,
      notificationCreated: false,
      transactionCreated: false,
      sideEffectsEmitted: 0
    });
  }
  const projection = runtime.consumerProjection("M04_DECISION");
  assert.equal(projection.status, "BLOCKED_NON_FACT");
  assert.equal(projection.sideEffectsEmitted, 0);
});

test("rollback and next-cycle reset preserve history and formal results", () => {
  const runtime = completeRuntime();
  runtime.action("apply-binding", { confirmed: true, confirmedBy: "reviewer-s003" });
  const formalBefore = runtime.formalBaseline();
  let state = runtime.action("rollback-binding", { reason: "test rollback" });
  assert.equal(state.consumerBinding.status, "ROLLED_BACK");
  assert.equal(state.consumerBinding.rollback.formalModelPointerChanged, false);
  state = runtime.action("start-next-cycle");
  assert.equal(state.cycle.cycleNumber, 2);
  assert.equal(state.cycleHistory.length, 1);
  assert.equal(state.cycleHistory[0].historicalCyclesPreserved, undefined);
  assert.equal(state.cycleHistory[0].formalBaselineMutated, false);
  assert.equal(state.cycleHistory[0].externalSideEffects, 0);
  assert.equal(state.nextAction.id, "build-data");
  assert.deepEqual(runtime.formalBaseline(), formalBefore);
});

test("a carried binding must be revalidated for the new cycle release", () => {
  const runtime = completeRuntime();
  const first = runtime.action("apply-binding", { confirmed: true, confirmedBy: "reviewer-s003" });
  const firstRevision = first.consumerBinding.bindingRevisionId;
  let state = runtime.action("start-next-cycle");
  assert.equal(state.consumerBinding.status, "CARRIED_FORWARD");
  assert.equal(state.consumerBinding.validationStatus, "REVALIDATION_REQUIRED");
  assert.equal(state.consumerBinding.carriedFromBindingRevisionId, firstRevision);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract", "benchmark-baseline", "run-models", "generate-insights"]) state = runtime.action(action);
  state = runtime.action("review-insights", { decision: "APPROVED", reviewedBy: "reviewer-s003" });
  for (const action of ["create-candidate", "start-shadow", "advance-shadow", "advance-shadow", "advance-shadow", "rebenchmark", "form-release"]) state = runtime.action(action);
  assert.equal(state.nextAction.id, "validate-binding");
  state = runtime.action("validate-binding");
  assert.notEqual(state.consumerBinding.bindingRevisionId, firstRevision);
  assert.equal(state.nextAction.id, "apply-binding");
});

test("generic engine contains no S003, Enterprise or debt-specific registration logic", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../runtime/model-portfolio-engine.mjs", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /S003|Enterprise|债务风险|liquidityGap/);
});
