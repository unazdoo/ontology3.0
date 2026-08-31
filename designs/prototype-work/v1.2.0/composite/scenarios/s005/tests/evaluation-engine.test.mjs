import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const adapter = require(path.join(root, "scenario-adapter.js"));
const evaluation = require(path.join(root, "evaluation-engine.js"));
const bytes = (last) => () => Uint8Array.from([0, 1, 2, 3, 4, last]);

const context = adapter.createScenarioContext({
  now: new Date("2026-08-30T01:00:00.000Z"),
  randomBytes: bytes(5)
});

const nextContext = adapter.createScenarioContext({
  now: new Date("2026-08-30T02:00:00.000Z"),
  randomBytes: bytes(6)
});

function event(moduleId, operation, minute, payload) {
  return {
    moduleId,
    operation,
    scenarioContext: context,
    occurredAt: `2026-08-30T01:${String(minute).padStart(2, "0")}:00.000Z`,
    payload: {
      evidenceRefs: [`evidence://S005/${moduleId}/${operation}`],
      ...payload
    }
  };
}

function sourceEvent() {
  return event("M02", evaluation.OPERATIONS.SOURCE_DELIVERY, 1, {
    evaluationDate: "2026-07-17",
    eventReadAt: "2026-08-30T01:00:30.000Z",
    sourceAudit: {
      snapshotCount: 79,
      sheetInstanceCount: 393,
      candidateCount: 15,
      asOf: "2026-07-17",
      windBatchId: null,
      windBatchMissingReason: "Wind batch has not been delivered.",
      dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
      qualityStatus: "partial"
    }
  });
}

function semanticEvent() {
  return event("M01", evaluation.OPERATIONS.SEMANTIC_CANDIDATE, 2, {
    classificationStatus: "candidate",
    windFundType: null,
    windFundTypeMissingReason: "Wind fund_type 尚未交付。",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    publishedOntology: false,
    publishedMetric: false,
    publishedRule: false,
    publishedT019: false,
    missingReasons: ["Wind fund_type 尚未交付。", "分类和评价口径仍为候选。"],
    metricUpdates: {
      continuingEligibilityCompliance: {
        continuingEligibility: { status: "partial", value: { eligible: 3, reviewRequired: 1, unknown: 1, displayedProducts: 5, candidateCount: 15 }, missingReason: "10 只候选尚未逐项列示。" },
        classificationConfidence: { status: "not_evaluable", value: null, missingReason: "Wind fund_type 与候选分类尚未完成复核。" }
      },
      selectionExecution: {
        selectionAttribution: { status: "partial", value: 0.42, unit: "pct", missingReason: "仅为 T+60 归一化选择差异。" }
      }
    }
  });
}

function transition(state, nextEvent) {
  return evaluation.applyModuleEvent(state, nextEvent);
}

function consume(state, payload = {}) {
  return { consumerResultRef: state.current.evaluationResult.evaluationResultId, ...payload };
}

function explorationPayload(state) {
  return consume(state, {
    explorationResultRef: "exploration://S005/current-run/object-relations-series",
    objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" },
    lensRef: { moduleId: "m07", lensId: "object360", route: "#module/m07" },
    seriesRef: null,
    timeRange: { start: "2025-02-21", end: "2026-07-17" },
    dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    bindingId: "MB-S005-EVALUATION-v1"
  });
}

function modelPayload(state, overrides = {}) {
  return consume(state, {
    outputRef: "modeling://S005/output/synthetic-001",
    inputMode: "SYNTHETIC_CANDIDATE_SIMULATION",
    objectiveId: "MO-S005-POST-INVESTMENT-RESEARCH-V1",
    objectiveRevisionId: "MOR-S005-POST-INVESTMENT-0001",
    bindingRevisionId: "MB-S005-EVALUATION-v1-R1",
    releaseId: "MR-S005-EVALUATION-v1",
    modelVersionId: "MV-S005-BALANCED-0001",
    objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" },
    lensRef: { moduleId: "m07", lensId: "object360", route: "#module/m07" },
    seriesRef: null,
    timeRange: { start: "2025-02-21", end: "2026-07-17" },
    dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    bindingId: "MB-S005-EVALUATION-v1",
    resultKind: "SIMULATION",
    resultStatus: "available",
    truthClass: "candidate",
    replacesFact: false,
    fixtureId: "FIX-S005-SYNTHETIC-v1",
    inputClassification: "SYNTHETIC_RESEARCH_ONLY",
    containsSourceBusinessValues: false,
    factWriteAllowed: false,
    actionWriteAllowed: false,
    sideEffectsEmitted: 0,
    ...overrides
  });
}

function advanceToM08() {
  let state = evaluation.createEvaluationState(context);
  state = transition(state, sourceEvent()).state;
  state = transition(state, semanticEvent()).state;
  state = transition(state, event("M03", evaluation.OPERATIONS.COMPLIANCE_EVALUATION, 3, {
    accessMode: "read_only",
    consumerResultRef: state.current.evaluationResult.evaluationResultId,
    complianceResultRef: "evaluation://S005/M03/compliance-read-only",
    conclusionStatus: "partial"
  })).state;
  state = transition(state, event("M03", evaluation.OPERATIONS.MARKET_PEER_EVALUATION, 4, {
    accessMode: "read_only",
    consumerResultRef: state.current.evaluationResult.evaluationResultId,
    marketPeerResultRef: "evaluation://S005/M03/market-peer-read-only",
    conclusionStatus: "not_evaluable"
  })).state;
  state = transition(state, event("M04", evaluation.OPERATIONS.SELECTION_READ_ONLY, 5, consume(state, {
    accessMode: "read_only",
    applicability: "not_applicable",
    actions: [],
    reminders: [],
    approvals: [],
    todos: [],
    trades: []
  }))).state;
  state = transition(state, event("M05", evaluation.OPERATIONS.RISK_EXPLANATION, 6, consume(state, {
    accessMode: "read_only",
    explanationRef: "evaluation://S005/M05/risk-explanation"
  }))).state;
  state = transition(state, event("M07", evaluation.OPERATIONS.EXPLORATION_RESULT, 7, explorationPayload(state))).state;
  return state;
}

test("a new S005 scenario run starts at 0/7 without an evaluation run or result", () => {
  const state = evaluation.createEvaluationState(context);
  assert.equal(state.schemaVersion, "ofw.s005.evaluation-engine.v2");
  const dashboard = evaluation.dashboardProjection(state);
  assert.equal(dashboard.progress.done, 0);
  assert.equal(dashboard.progress.total, 7);
  assert.equal(dashboard.evaluationRun, null);
  assert.equal(dashboard.evaluationResult, null);
  assert.equal(dashboard.expectedEvent.eventType, evaluation.EVENT_TYPES.SOURCE_DELIVERED);
  assert.equal(evaluation.eventTypeForOperation("sourceBatch"), evaluation.EVENT_TYPES.SOURCE_DELIVERED);
  assert.equal(evaluation.eventTypeForOperation("model_result"), evaluation.EVENT_TYPES.MODEL_RESULT_DELIVERED);
  assert.equal("completeAll" in evaluation, false);
});

test("M02 stores a verifiable source delivery and M01 creates deterministic evaluation ids", () => {
  const initial = evaluation.createEvaluationState(context);
  const afterSource = transition(initial, sourceEvent());
  assert.equal(afterSource.moduleOutput.moduleId, "M02");
  assert.equal(afterSource.moduleOutput.verification.verifiable, true);
  assert.deepEqual(afterSource.moduleOutput.scenarioContext, context);
  assert.equal(afterSource.state.current.evaluationRun, null);
  assert.equal(afterSource.state.current.evaluationResult, null);
  assert.equal(evaluation.dashboardProjection(afterSource.state).progress.done, 1);

  const afterSemantic = transition(afterSource.state, semanticEvent());
  assert.match(afterSemantic.state.current.evaluationRun.evaluationRunId, /^S005-EVAL-RUN-[a-f0-9]{16}$/);
  assert.match(afterSemantic.state.current.evaluationResult.evaluationResultId, /^S005-EVAL-RESULT-[a-f0-9]{16}$/);
  assert.equal(afterSemantic.state.current.evaluationRun.sourceAudit.snapshotCount, 79);
  assert.equal(afterSemantic.state.current.evaluationRun.sourceAudit.sheetInstanceCount, 393);
  assert.equal(afterSemantic.state.current.evaluationRun.sourceAudit.candidateCount, 15);
  assert.equal(afterSemantic.state.current.evaluationResult.statusBar.windBatchId, null);
  assert.equal(afterSemantic.state.current.evaluationResult.statusBar.eventReadAt, "2026-08-30T01:00:30.000Z");
  assert.equal(afterSemantic.state.current.evaluationResult.evaluationStatus, "partial");
  assert.equal(afterSemantic.moduleOutput.payload.windFundType, null);
  assert.equal(afterSemantic.moduleOutput.payload.windFundTypeStatus, "missing");
  assert.deepEqual(afterSemantic.moduleOutput.missingReasons, ["Wind fund_type 尚未交付。", "分类和评价口径仍为候选。"]);
  assert.deepEqual(afterSemantic.moduleOutput.payload.missingReasons, afterSemantic.moduleOutput.missingReasons);

  const replaySource = transition(evaluation.createEvaluationState(context), sourceEvent()).state;
  const replaySemantic = transition(replaySource, semanticEvent()).state;
  assert.equal(replaySemantic.current.evaluationRun.evaluationRunId, afterSemantic.state.current.evaluationRun.evaluationRunId);
  assert.equal(replaySemantic.current.evaluationResult.evaluationResultId, afterSemantic.state.current.evaluationResult.evaluationResultId);
});

test("evaluation result ids change with stage and factual output content while deterministic replays stay stable", () => {
  let state = transition(evaluation.createEvaluationState(context), sourceEvent()).state;
  state = transition(state, semanticEvent()).state;
  const semanticResultId = state.current.evaluationResult.evaluationResultId;
  const compliance = event("M03", evaluation.OPERATIONS.COMPLIANCE_EVALUATION, 3, {
    accessMode: "read_only",
    consumerResultRef: semanticResultId,
    complianceResultRef: "evaluation://S005/M03/compliance-read-only",
    conclusionStatus: "partial",
  });
  const afterCompliance = transition(state, compliance);
  const complianceResultId = afterCompliance.state.current.evaluationResult.evaluationResultId;
  assert.notEqual(complianceResultId, semanticResultId);
  assert.equal(afterCompliance.moduleOutput.evaluationResultId, complianceResultId);
  assert.equal(afterCompliance.state.current.stages.compliance.evidence.evaluationResultId, complianceResultId);
  assert.equal(afterCompliance.stageUpdate.evidence.evaluationResultId, complianceResultId);
  assert.ok(afterCompliance.state.current.evaluationResult.factualModuleOutputRefs.includes(afterCompliance.moduleOutput.outputId));

  let replay = transition(evaluation.createEvaluationState(context), sourceEvent()).state;
  replay = transition(replay, semanticEvent()).state;
  replay = transition(replay, { ...compliance, payload: { ...compliance.payload, consumerResultRef: replay.current.evaluationResult.evaluationResultId } }).state;
  assert.equal(replay.current.evaluationResult.evaluationResultId, complianceResultId);
});

test("M01 metric updates are canonical, verifiable and fail closed on unit or Sharpe provenance drift", () => {
  const afterSource = transition(evaluation.createEvaluationState(context), sourceEvent()).state;
  const noScoredMetrics = semanticEvent();
  delete noScoredMetrics.payload.metricUpdates;
  assert.equal(transition(afterSource, noScoredMetrics).state.current.evaluationResult.evaluationStatus, "not_evaluable");
  const semanticA = semanticEvent();
  const semanticB = semanticEvent();
  semanticB.payload.metricUpdates.continuingEligibilityCompliance.continuingEligibility.value.eligible = 99;
  const resultA = transition(afterSource, semanticA);
  const resultB = transition(afterSource, semanticB);
  assert.notEqual(resultA.moduleOutput.outputId, resultB.moduleOutput.outputId);
  assert.notEqual(resultA.moduleOutput.verification.payloadDigest, resultB.moduleOutput.verification.payloadDigest);
  assert.notEqual(resultA.state.current.evaluationResult.evaluationResultId, resultB.state.current.evaluationResult.evaluationResultId);
  assert.equal(resultA.moduleOutput.payload.metricUpdates.continuingEligibilityCompliance.continuingEligibility.value.eligible, 3);

  const wrongUnit = semanticEvent();
  wrongUnit.payload.metricUpdates.selectionExecution.selectionAttribution.unit = "ratio";
  assert.throws(() => transition(afterSource, wrongUnit), /unit must remain pct/);

  const missingSharpeProvenance = semanticEvent();
  missingSharpeProvenance.payload.metricUpdates.productPerformance = { sharpe: { status: "available", value: 1.12 } };
  assert.throws(() => transition(afterSource, missingSharpeProvenance), /requires explicit/);

  const weeklyAsDaily = semanticEvent();
  weeklyAsDaily.payload.metricUpdates.productPerformance = { sharpe: { status: "available", value: 1.12, observationFrequency: "weekly", annualizationBasis: "daily" } };
  const guarded = transition(afterSource, weeklyAsDaily).state.current.evaluationResult.domains.productPerformance.metrics.sharpe;
  assert.equal(guarded.value, null);
  assert.equal(guarded.status, "observation_period_insufficient");

  const current = resultA.state;
  assert.throws(() => transition(current, event("M03", evaluation.OPERATIONS.COMPLIANCE_EVALUATION, 3, {
    accessMode: "read_only",
    consumerResultRef: current.current.evaluationResult.evaluationResultId,
    metricUpdates: { continuingEligibilityCompliance: { continuingEligibility: { status: "partial", value: { eligible: 4 }, missingReason: "forbidden" } } }
  })), /read-only evaluation consumer/);
});

test("only the ordered actual module event advances progress and M04 is side-effect free", () => {
  const initial = evaluation.createEvaluationState(context);
  assert.throws(() => transition(initial, event("M02", "page_navigation", 1, {})), /do not advance S005/);
  assert.equal(evaluation.dashboardProjection(initial).progress.done, 0);

  let state = transition(initial, sourceEvent()).state;
  state = transition(state, semanticEvent()).state;
  state = transition(state, event("M03", evaluation.OPERATIONS.COMPLIANCE_EVALUATION, 3, {
    accessMode: "read_only",
    consumerResultRef: state.current.evaluationResult.evaluationResultId,
    complianceResultRef: "evaluation://S005/M03/compliance-read-only",
    conclusionStatus: "partial"
  })).state;
  state = transition(state, event("M03", evaluation.OPERATIONS.MARKET_PEER_EVALUATION, 4, {
    accessMode: "read_only",
    consumerResultRef: state.current.evaluationResult.evaluationResultId,
    marketPeerResultRef: "evaluation://S005/M03/market-peer-read-only",
    conclusionStatus: "not_evaluable"
  })).state;

  const invalidM04 = event("M04", evaluation.OPERATIONS.SELECTION_READ_ONLY, 5, consume(state, {
    accessMode: "read_only",
    applicability: "not_applicable",
    actions: [{ id: "forbidden" }],
    reminders: [],
    approvals: [],
    todos: [],
    trades: []
  }));
  assert.throws(() => transition(state, invalidM04), /actions must be an empty array/);
  assert.equal(evaluation.dashboardProjection(state).progress.done, 4);
});

test("M05, M07 and a proven isolated M08 result jointly close stage 6; unavailable does not", () => {
  let state = advanceToM08();
  assert.deepEqual(evaluation.dashboardProjection(state).progress, { done: 5, total: 7, active: 1, blocked: 0 });

  const invalidModel = event("M08", evaluation.OPERATIONS.MODEL_RESULT, 8, modelPayload(state, {
    outputRef: "modeling://S005/output/invalid",
    containsSourceBusinessValues: true
  }));
  assert.throws(() => transition(state, invalidModel), /containsSourceBusinessValues must be false/);

  for (const field of ["fixtureId", "inputClassification", "containsSourceBusinessValues", "factWriteAllowed", "actionWriteAllowed", "sideEffectsEmitted"]) {
    const incomplete = modelPayload(state);
    delete incomplete[field];
    assert.throws(() => transition(state, event("M08", evaluation.OPERATIONS.MODEL_RESULT, 8, incomplete)), /M08|must be|is required/);
  }

  const unavailable = transition(state, event("M08", evaluation.OPERATIONS.SERIES_INPUT_UNAVAILABLE, 8, consume(state, {
    missingReason: "产品级受治理时序尚未交付。"
  })));
  state = unavailable.state;
  assert.equal(unavailable.moduleOutput.progressAdvanced, false);
  assert.equal(unavailable.stageUpdate.status, "blocked");
  assert.deepEqual(evaluation.dashboardProjection(state).progress, { done: 5, total: 7, active: 0, blocked: 1 });

  const coverageBefore = state.current.evaluationResult.scoredCoverage;
  const available = transition(state, event("M08", evaluation.OPERATIONS.MODEL_RESULT, 9, modelPayload(state)));
  state = available.state;
  assert.equal(available.stageUpdate.status, "complete");
  assert.equal(evaluation.dashboardProjection(state).progress.done, 6);
  assert.equal(state.current.evaluationResult.scoredCoverage, coverageBefore);
  const modelingOutput = state.current.evaluationResult.modelingOutputs[0];
  assert.equal(modelingOutput.outputRef, "modeling://S005/output/synthetic-001");
  assert.equal(modelingOutput.inputMode, "SYNTHETIC_CANDIDATE_SIMULATION");
  assert.equal(modelingOutput.objectiveRevisionId, "MOR-S005-POST-INVESTMENT-0001");
  assert.equal(modelingOutput.modelVersionId, "MV-S005-BALANCED-0001");
  assert.equal(modelingOutput.objectRef.id, "PRD-223C00000000A5FB");
  assert.equal(modelingOutput.factWriteAllowed, false);
  assert.equal(modelingOutput.sideEffectsEmitted, 0);
});

test("all six domains retain honest missing data and a real M06 output reaches 7/7", () => {
  let state = advanceToM08();
  state = transition(state, event("M08", evaluation.OPERATIONS.MODEL_RESULT, 8, modelPayload(state, {
    outputRef: "modeling://S005/output/prediction-001",
    resultKind: "PREDICTION"
  }))).state;
  assert.throws(() => transition(state, event("M06", evaluation.OPERATIONS.REPORT_DRAFT, 9, consume(state, {
    reportRef: "report://S005/forged-history",
    reportStatus: "draft",
    reviewStatus: "pending",
    reviewEvidenceRefs: ["evidence://S005/M06/review-pending"],
    historyComparisonStatus: "available",
    previousScenarioRunId: "OTHER",
    previousEvaluationResultId: "OTHER"
  }))), /do not match/);
  const report = transition(state, event("M06", evaluation.OPERATIONS.REPORT_DRAFT, 9, consume(state, {
    reportRef: "report://S005/current-run/draft",
    reportStatus: "draft",
    reviewStatus: "pending",
    reviewEvidenceRefs: ["evidence://S005/M06/review-pending"],
    historyComparisonStatus: "not_applicable",
    historyComparisonMissingReason: "当前为首个可比较评价运行，暂无上一轮结果。",
    publishedOntology: false,
    publishedMetric: false,
    publishedRule: false,
    publishedT019: false
  })));
  state = report.state;

  const dashboard = evaluation.dashboardProjection(state);
  assert.deepEqual(dashboard.progress, { done: 7, total: 7, active: 0, blocked: 0 });
  assert.equal(dashboard.evaluationRun.status, "completed_with_partial_evaluation");
  assert.equal(dashboard.evaluationResult.evaluationStatus, "partial");
  assert.equal(Object.keys(dashboard.domains).length, 6);
  const requiredMetrics = {
    productPerformance: ["twr", "sharpe", "sortino", "calmar", "informationRatio", "volatility", "maxDrawdown", "drawdownRecovery"],
    actualInvestorResult: ["actualTwr", "mwrXirr", "realizedReturn", "unrealizedReturn", "cashFlow", "fees"],
    fixedIncomeRisk: ["duration", "ratingMigration", "concentration", "liquidity", "carryAttribution", "rollDownAttribution", "curveAttribution", "creditAttribution"],
    managementOperationsQuality: ["navPublicationTimeliness", "valuationExceptionCount", "operationIncidentCount"],
    continuingEligibilityCompliance: ["continuingEligibility", "complianceExceptions", "classificationConfidence"],
    selectionExecution: ["selectionAttribution", "timingAttribution", "nextAvailableNav", "actualNav", "slippage", "settlementStatus"]
  };
  Object.values(dashboard.domains).forEach((domain) => {
    assert.ok(domain.status);
    assert.equal(typeof domain.scoredCoverage, "number");
    assert.ok(domain.conclusion);
    assert.ok(Array.isArray(domain.missingReasons));
    assert.ok(Array.isArray(domain.evidenceRefs));
  });
  Object.entries(requiredMetrics).forEach(([domainId, metricIds]) => {
    assert.deepEqual(Object.keys(dashboard.domains[domainId].metrics).sort(), [...metricIds].sort());
    Object.values(dashboard.domains[domainId].metrics).forEach((metric) => {
      assert.ok(metric.status);
      assert.ok(Object.hasOwn(metric, "value"));
      assert.ok(Object.hasOwn(metric, "missingReason"));
      assert.ok(Array.isArray(metric.evidenceRefs));
    });
  });

  const product = dashboard.domains.productPerformance.metrics;
  assert.equal(product.sharpe.value, null);
  assert.equal(product.sharpe.status, "observation_period_insufficient");
  assert.match(product.sharpe.missingReason, /周快照.*按日频/);
  assert.equal(dashboard.domains.actualInvestorResult.metrics.actualTwr.status, "not_evaluable");
  assert.equal(dashboard.domains.fixedIncomeRisk.metrics.ratingMigration.value, null);
  assert.equal(dashboard.domains.selectionExecution.metrics.actualNav.value, null);
  assert.equal(report.moduleOutput.payload.publicationStatus, "not_published");
});

test("reset returns the new run to 0/7, retains the old result and round-trips through serialize", () => {
  let state = advanceToM08();
  state = transition(state, event("M08", evaluation.OPERATIONS.MODEL_RESULT, 8, modelPayload(state, {
    outputRef: "modeling://S005/output/simulation-002",
  }))).state;
  state = transition(state, event("M06", evaluation.OPERATIONS.REPORT_DRAFT, 9, consume(state, {
    reportRef: "report://S005/current-run/draft-002",
    reportStatus: "draft",
    reviewStatus: "pending",
    reviewEvidenceRefs: ["evidence://S005/M06/review-pending"],
    historyComparisonStatus: "not_applicable",
    historyComparisonMissingReason: "当前为首个可比较评价运行，暂无上一轮结果。"
  }))).state;
  const oldRunId = state.current.scenarioContext.scenarioRunId;
  const oldResultId = state.current.evaluationResult.evaluationResultId;

  const reset = evaluation.resetEvaluationState(state, nextContext);
  const dashboard = evaluation.dashboardProjection(reset.state);
  assert.equal(reset.receipt.previousScenarioRunId, oldRunId);
  assert.equal(reset.receipt.preservedHistoricalRuns, 1);
  assert.deepEqual(dashboard.progress, { done: 0, total: 7, active: 0, blocked: 0 });
  assert.equal(dashboard.evaluationRun, null);
  assert.equal(dashboard.evaluationResult, null);
  assert.equal(reset.state.history[0].evaluationResult.evaluationResultId, oldResultId);

  const nextEvent = (moduleId, operation, minute, payload) => ({
    moduleId,
    operation,
    scenarioContext: nextContext,
    occurredAt: `2026-08-30T02:${String(minute).padStart(2, "0")}:00.000Z`,
    payload: { evidenceRefs: [`evidence://S005-next/${moduleId}/${operation}`], ...payload }
  });
  let nextState = reset.state;
  const nextSourcePayload = sourceEvent().payload;
  nextSourcePayload.eventReadAt = "2026-08-30T02:00:30.000Z";
  nextState = transition(nextState, nextEvent("M02", evaluation.OPERATIONS.SOURCE_DELIVERY, 1, nextSourcePayload)).state;
  nextState = transition(nextState, nextEvent("M01", evaluation.OPERATIONS.SEMANTIC_CANDIDATE, 2, semanticEvent().payload)).state;
  nextState = transition(nextState, nextEvent("M03", evaluation.OPERATIONS.COMPLIANCE_EVALUATION, 3, consume(nextState, {
    accessMode: "read_only", complianceResultRef: "evaluation://S005-next/M03/compliance", conclusionStatus: "partial"
  }))).state;
  nextState = transition(nextState, nextEvent("M03", evaluation.OPERATIONS.MARKET_PEER_EVALUATION, 4, consume(nextState, {
    accessMode: "read_only", marketPeerResultRef: "evaluation://S005-next/M03/market-peer", conclusionStatus: "not_evaluable"
  }))).state;
  nextState = transition(nextState, nextEvent("M04", evaluation.OPERATIONS.SELECTION_READ_ONLY, 5, consume(nextState, {
    accessMode: "read_only", applicability: "not_applicable", actions: [], reminders: [], approvals: [], todos: [], trades: []
  }))).state;
  nextState = transition(nextState, nextEvent("M05", evaluation.OPERATIONS.RISK_EXPLANATION, 6, consume(nextState, {
    accessMode: "read_only", explanationRef: "evaluation://S005-next/M05/risk"
  }))).state;
  nextState = transition(nextState, nextEvent("M07", evaluation.OPERATIONS.EXPLORATION_RESULT, 7, explorationPayload(nextState))).state;
  nextState = transition(nextState, nextEvent("M08", evaluation.OPERATIONS.MODEL_RESULT, 8, modelPayload(nextState, { outputRef: "modeling://S005-next/output" }))).state;

  const reportBase = consume(nextState, {
    reportRef: "report://S005-next/draft",
    reportStatus: "draft",
    reviewStatus: "pending",
    reviewEvidenceRefs: ["evidence://S005-next/M06/review-pending"]
  });
  assert.throws(() => transition(nextState, nextEvent("M06", evaluation.OPERATIONS.REPORT_DRAFT, 9, {
    ...reportBase,
    historyComparisonStatus: "not_applicable",
    historyComparisonMissingReason: "forged"
  })), /cannot be not_applicable/);
  assert.throws(() => transition(nextState, nextEvent("M06", evaluation.OPERATIONS.REPORT_DRAFT, 9, {
    ...reportBase,
    historyComparisonStatus: "available",
    previousScenarioRunId: "OTHER",
    previousEvaluationResultId: "OTHER"
  })), /do not match/);
  const compared = transition(nextState, nextEvent("M06", evaluation.OPERATIONS.REPORT_DRAFT, 9, {
    ...reportBase,
    historyComparisonStatus: "available",
    previousScenarioRunId: oldRunId,
    previousEvaluationResultId: oldResultId
  }));
  assert.equal(compared.moduleOutput.payload.previousEvaluationResultId, oldResultId);

  const restored = evaluation.createEngine({ scenarioContext: nextContext, restoredState: reset.state });
  assert.deepEqual(restored.serialize(), reset.state);
  assert.equal(restored.getEvaluationResult(oldRunId).evaluationResultId, oldResultId);
  assert.throws(() => evaluation.createEngine({ scenarioContext: context, restoredState: reset.state }), /does not match the current S005 run/);
});
