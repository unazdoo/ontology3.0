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
  vm.runInContext(read(path.join(compositeRoot, "scenarios/s005/evaluation-engine.js")), context, { filename: "evaluation-engine.js" });
  vm.runInContext(read(path.join(root, "data.js")), context, { filename: "data.js" });
  vm.runInContext(read(path.join(root, "state.js")), context, { filename: "state.js" });
  return context.OFW_V120_STORE;
}

test("S005 starts with a fresh canonical run identity", () => {
  const store = loadStore();
  const context = store.scenarioContext();
  assert.equal(store.get().schemaVersion, 2);
  assert.match(store.STORAGE_KEY, /state\.v2$/);
  assert.match(store.HANDOFF_KEY, /handoff\.v2$/);
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

test("S003 M08 research results stay separate from the archived scenario run and block M04", () => {
  const store = loadStore();
  const before = store.scenario("S003");
  const context = store.scenarioContext("S003");
  const workspace = { objectiveId: "MO-S003-DEBT-RISK-EARLY-WARNING-v1", status: "BENCHMARK_READY", activeCandidates: 3 };
  store.saveModelingWorkspace(context, workspace);
  const envelope = {
    resultId: "PRED-S003-SHADOW-001",
    resultKind: "PREDICTION",
    runId: "SHADOWRUN-S003-001",
    objectiveId: workspace.objectiveId,
    inputSnapshot: { scenarioContext: context, asOf: "2025-12-31", dataVersionId: "S003-T007-DEBT-RISK-20251231-v1" },
    permissionScope: "prediction.read",
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    subjects: [{ objectRef: { id: "ENT-001", objectTypeRef: "Enterprise" }, riskScore: 72.4 }]
  };
  store.saveModelingResult(context, envelope, workspace);
  assert.equal(store.modelingProjection("S003", "M03_QUERY").resultEnvelope.resultId, envelope.resultId);
  assert.equal(store.modelingProjection("S003", "M04_DECISION").code, "NON_FACT_SOURCE_REJECTED");
  assert.deepEqual(store.scenario("S003"), before);
  assert.throws(() => store.saveModelingResult(context, { ...envelope, resultId: "BAD", runId: context.scenarioRunId }), /不得复用/);
  assert.throws(() => store.saveModelingResult(context, { ...envelope, resultId: "BAD-2", runId: "S003-RUN-FORGED" }), /不得复用/);
  assert.throws(() => store.saveModelingResult(context, { ...envelope, resultId: "BAD-3", runId: "EXPRUN-003", factWriteAllowed: true }), /必须显式禁止/);
  assert.throws(() => store.saveModelingResult(context, { ...envelope, resultId: "BAD-4", runId: "OTHER-RUN" }), /身份无效/);
  assert.throws(() => store.saveModelingResult(context, { ...envelope, resultId: "BAD-5", runId: "EXPRUN-005", inputSnapshot: { scenarioContext: { ...context, status: "active" } } }), /输入快照/);
  assert.throws(() => store.saveModelingResult(context, { ...envelope, subjects: [] }), /不可变 Result ID/);
});

test("handoff session accepts only the active scenario run", () => {
  const store = loadStore();
  const context = store.scenarioContext();
  store.saveM07Handoff({ ...context, context: { ...context, objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" } }, returnUrl: "http://localhost/m07" });
  assert.equal(store.handoff().m07.scenarioRunId, context.scenarioRunId);
  assert.throws(() => store.saveM07Handoff({ ...context, scenarioRunId: "S005-RUN-20260827000000000-ffffffffffff" }), /轮次与当前场景不一致/);
});

test("M08 return must match the full five-field identity and fixed M07 handoff", () => {
  const store = loadStore();
  const scenarioContext = store.scenarioContext();
  const objectRef = { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" };
  const lensRef = { moduleId: "m07", lensId: "object360", route: "#module/m07" };
  const timeRange = { start: "2025-02-21", end: "2026-07-17" };
  const handoff = {
    ...scenarioContext,
    scenarioContext,
    objectRef,
    lensRef,
    seriesRef: null,
    timeRange,
    dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    bindingId: "MB-S005-EVALUATION-v1",
  };
  store.saveM07Handoff({ ...scenarioContext, context: handoff, returnUrl: "http://localhost/m07" });
  const inputManifest = {
    ...handoff,
    sourceKind: "SYNTHETIC_CANDIDATE_SIMULATION",
    objectiveId: "MO-S005-POST-INVESTMENT-RESEARCH-V1",
    objectiveRevisionId: "MOR-S005-POST-INVESTMENT-0001",
    bindingRevisionId: "MB-S005-EVALUATION-v1-R1",
    releaseId: "MR-S005-EVALUATION-v1",
    modelVersionId: "MV-S005-BALANCED-0001",
  };
  const resultEnvelope = {
    resultId: "SIMRES-001",
    runId: "SIMRUN-001",
    resultKind: "SIMULATION",
    objectiveId: inputManifest.objectiveId,
    objectiveRevisionId: inputManifest.objectiveRevisionId,
    bindingRevisionId: inputManifest.bindingRevisionId,
    releaseId: inputManifest.releaseId,
    modelVersionId: inputManifest.modelVersionId,
    subjectRefs: [objectRef],
    inputSnapshot: { ...scenarioContext, dataVersionId: inputManifest.dataVersionId, ontologyVersionId: inputManifest.ontologyVersionId, timeRange },
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    sideEffectsEmitted: 0,
  };
  const payload = { ...scenarioContext, inputManifest, resultEnvelope, simulationRunId: "SIMRUN-001", simulationResultId: "SIMRES-001", simulationStatus: "SUCCEEDED", sideEffectsEmitted: 0 };
  assert.equal(store.validateM08Return(payload).resultEnvelope.resultId, "SIMRES-001");

  const mutate = (update) => {
    const value = JSON.parse(JSON.stringify(payload));
    update(value);
    return value;
  };
  assert.throws(() => store.validateM08Return(mutate((value) => { value.formedAt = "2026-08-30T00:00:00.000Z"; })), /五字段/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.inputManifest.status = "completed"; })), /五字段/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.inputManifest.objectRef.id = "OTHER"; })), /对象/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.inputManifest.lensRef.lensId = "temporal"; })), /Lens/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.inputManifest.timeRange.end = "2026-07-18"; })), /时间范围/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.inputManifest.dataVersionId = "OTHER"; })), /版本/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.resultEnvelope.inputSnapshot.ontologyVersionId = "OTHER"; })), /快照版本/);
  for (const field of ["objectiveId", "objectiveRevisionId", "bindingRevisionId", "releaseId", "modelVersionId"]) {
    assert.throws(() => store.validateM08Return(mutate((value) => { value.resultEnvelope[field] = "OTHER"; })), /谱系/);
  }
  assert.throws(() => store.validateM08Return(mutate((value) => { value.simulationResultId = "OTHER"; })), /Result 标识/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.resultEnvelope.actionSourceAllowed = true; })), /三重禁写/);
  assert.throws(() => store.validateM08Return(mutate((value) => { value.sideEffectsEmitted = 1; })), /外部副作用/);
});

test("S003 PREDICTION return preserves the M07 object context and independent research identity", () => {
  const store = loadStore();
  store.setActiveScenario("S003");
  const scenarioContext = store.scenarioContext("S003");
  const objectRef = { id: "S003-ENT-020", objectTypeRef: "Enterprise", title: "环保测试公司4" };
  const lensRef = { moduleId: "m07", lensId: "temporal", route: "#module/m07" };
  const timeRange = { start: "2025-12-31", end: "2025-12-31" };
  const handoff = {
    ...scenarioContext,
    scenarioContext,
    objectRef,
    lensRef,
    seriesRef: null,
    timeRange,
    dataVersionId: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
    ontologyVersionId: "SEM-S003-DEBT-RISK-v1",
    bindingId: "MB-S003-DEBT-RISK-v1",
    usageIntent: "SCORING",
  };
  store.saveM07Handoff({ ...scenarioContext, context: handoff, returnUrl: "http://localhost/m07" });
  const inputManifest = {
    ...handoff,
    sourceKind: "S003_FIXED_DATA_PREDICTION",
    objectiveId: "MO-S003-DEBT-RISK-EARLY-WARNING-v1",
    objectiveRevisionId: "MOR-S003-DEBT-RISK-EARLY-WARNING-0001",
    bindingRevisionId: "MB-S003-DEBT-RISK-v1-R1",
    releaseId: "RC-S003-MV-A-001",
    modelVersionId: "MV-S003-A-001",
  };
  const resultEnvelope = {
    resultId: "PRED-S003-MV-A-001-001",
    runId: "M08-S003-RECALC-001",
    resultKind: "PREDICTION",
    objectiveId: inputManifest.objectiveId,
    objectiveRevisionId: inputManifest.objectiveRevisionId,
    bindingRevisionId: inputManifest.bindingRevisionId,
    releaseId: inputManifest.releaseId,
    modelVersionId: inputManifest.modelVersionId,
    subjectRefs: [objectRef],
    subjects: [{ objectId: objectRef.id, objectTypeRef: "Enterprise", riskScore: 23.05 }],
    inputSnapshot: { ...scenarioContext, scenarioContext, dataVersionId: inputManifest.dataVersionId, ontologyVersionId: inputManifest.ontologyVersionId, timeRange },
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    sideEffectsEmitted: 0,
  };
  const payload = { ...scenarioContext, inputManifest, resultEnvelope, modelingRunId: resultEnvelope.runId, modelingResultId: resultEnvelope.resultId, sideEffectsEmitted: 0 };
  assert.equal(store.validateM08Return(payload, "S003").resultEnvelope.resultId, resultEnvelope.resultId);
  assert.throws(() => store.validateM08Return({ ...payload, modelingRunId: "S003-RUN-FORBIDDEN" }, "S003"), /Prediction Run/);
});

test("M07 to M08 navigation requires an atomic verifiable exploration result", () => {
  const appRuntime = read(path.join(root, "app.js"));
  const m07Runtime = read(path.join(compositeRoot, "modules/m07/module/workspace-v2.js"));
  assert.match(m07Runtime, /explorationResultEnvelope/);
  assert.match(m07Runtime, /\.\.\.\(explorationResultEnvelope \? \{ explorationResultEnvelope \} : \{\}\)/);
  assert.match(appRuntime, /recordS005M07Exploration\(message\.explorationResultEnvelope\)/);
  assert.match(appRuntime, /M07 尚未形成当前轮次的可验证探索结果/);
  assert.match(appRuntime, /sameM07ExplorationResult/);
  assert.match(appRuntime, /S005 打开 M08 必须携带可验证的 M07 探索结果包络/);
  assert.match(appRuntime, /M07 交接对象、Lens、系列、时间或版本与已固定探索结果不一致/);
  assert.match(appRuntime, /payload\.simulationStatus === "SUCCEEDED"/);
  assert.doesNotMatch(appRuntime, /MutationObserver|\.observe\(doc\.body/);
});

test("actual M01-M08 module outputs advance the host run to 7/7 and reset preserves the old result", () => {
  const store = loadStore();
  const scenarioContext = store.scenarioContext("S005");
  const at = (offset) => new Date(Date.parse(scenarioContext.formedAt) + offset * 1000).toISOString();
  const record = (moduleId, operation, offset, payload) => {
    const currentResultRef = store.s005EvaluationProjection()?.evaluationResult?.evaluationResultId || null;
    return store.recordS005ModuleEvent({
      moduleId,
      operation,
      scenarioContext,
      occurredAt: at(offset),
      payload: { evidenceRefs: [`evidence://${scenarioContext.scenarioRunId}/${moduleId}/${operation}`], ...(currentResultRef ? { consumerResultRef: currentResultRef } : {}), ...payload }
    });
  };

  record("M02", "source_delivery", 1, {
    evaluationDate: "2026-07-17",
    eventReadAt: at(1),
    sourceAudit: { snapshotCount: 79, sheetInstanceCount: 393, candidateCount: 15, asOf: "2026-07-17", windBatchId: null, windBatchMissingReason: "Wind 批次尚未交付。", dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS", qualityStatus: "partial" }
  });
  assert.equal(store.s005Progress().done, 1);
  assert.equal(store.s005EvaluationProjection().evaluationRun, null);

  record("M01", "semantic_candidate", 2, {
    classificationStatus: "candidate",
    windFundType: null,
    windFundTypeMissingReason: "Wind fund_type 尚未交付。",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    metricUpdates: {
      continuingEligibilityCompliance: { continuingEligibility: { status: "partial", value: { eligible: 3, reviewRequired: 1, unknown: 1, displayedProducts: 5, candidateCount: 15 }, missingReason: "10 只候选尚未逐项列示。" } },
      selectionExecution: { selectionAttribution: { status: "partial", value: 0.42, unit: "pct", missingReason: "仅为 T+60 归一化选择差异，不是完整归因。" } }
    },
    publishedOntology: false, publishedMetric: false, publishedRule: false, publishedT019: false
  });
  let resultId = store.s005EvaluationProjection().evaluationResult.evaluationResultId;
  record("M03", "compliance_evaluation", 3, {
    accessMode: "read_only",
    consumerResultRef: resultId,
    complianceResultRef: `evaluation://${scenarioContext.scenarioRunId}/M03/compliance-read-only`,
    conclusionStatus: "partial"
  });
  resultId = store.s005EvaluationProjection().evaluationResult.evaluationResultId;
  record("M03", "market_peer_evaluation", 4, { accessMode: "read_only", consumerResultRef: resultId, marketPeerResultRef: `evaluation://${scenarioContext.scenarioRunId}/M03/market-peer-read-only`, conclusionStatus: "not_evaluable" });
  record("M04", "selection_read_only", 5, {
    accessMode: "read_only", applicability: "not_applicable", actions: [], reminders: [], approvals: [], todos: [], trades: []
  });
  const m04 = store.s005ModuleProjection("M04").moduleOutputs[0];
  assert.equal(m04.payload.applicability, "not_applicable");
  assert.equal(m04.payload.externalSideEffects, 0);

  record("M05", "risk_explanation", 6, { accessMode: "read_only", explanationRef: `evaluation://${scenarioContext.scenarioRunId}/M05/risk` });
  record("M07", "exploration_result", 7, {
    explorationResultRef: `exploration://${scenarioContext.scenarioRunId}/PRD-223C00000000A5FB/object360`,
    objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" },
    lensRef: { moduleId: "m07", lensId: "object360", route: "#module/m07" },
    seriesRef: null,
    timeRange: { start: "2025-02-21", end: "2026-07-17" },
    dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    bindingId: "MB-S005-EVALUATION-v1"
  });
  assert.deepEqual({ ...store.s005Progress() }, { done: 5, total: 7, active: 1, blocked: 0 });
  record("M08", "model_result", 8, {
    outputRef: `modeling://${scenarioContext.scenarioRunId}/SIMRES-001`, inputMode: "SYNTHETIC_CANDIDATE_SIMULATION",
    objectiveId: "MO-S005-POST-INVESTMENT-RESEARCH-V1", objectiveRevisionId: "MOR-S005-POST-INVESTMENT-0001", bindingRevisionId: "MB-S005-EVALUATION-v1-R1", releaseId: "MR-S005-EVALUATION-v1", modelVersionId: "MV-S005-BALANCED-0001",
    objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" }, lensRef: { moduleId: "m07", lensId: "object360", route: "#module/m07" }, seriesRef: null, timeRange: { start: "2025-02-21", end: "2026-07-17" }, dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS", ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1", bindingId: "MB-S005-EVALUATION-v1",
    resultKind: "SIMULATION", resultStatus: "available", truthClass: "candidate", replacesFact: false,
    fixtureId: "FIX-S005-SYNTHETIC-v1", inputClassification: "SYNTHETIC_RESEARCH_ONLY", containsSourceBusinessValues: false,
    factWriteAllowed: false, actionWriteAllowed: false, sideEffectsEmitted: 0
  });
  record("M06", "report_draft", 9, {
    reportRef: `report://${scenarioContext.scenarioRunId}/draft`,
    reportStatus: "draft",
    reviewStatus: "pending",
    reviewEvidenceRefs: [`evidence://${scenarioContext.scenarioRunId}/M06/review-pending`],
    historyComparisonStatus: "not_applicable",
    historyComparisonMissingReason: "当前为首个可比较评价运行，暂无上一轮结果。"
  });

  const dashboard = store.s005EvaluationProjection();
  assert.deepEqual({ ...dashboard.progress }, { done: 7, total: 7, active: 0, blocked: 0 });
  assert.equal(dashboard.scenarioContext.scenarioRunId, scenarioContext.scenarioRunId);
  assert.equal(dashboard.evaluationResult.scenarioContext.scenarioRunId, scenarioContext.scenarioRunId);
  assert.equal(Object.keys(dashboard.domains).length, 6);
  const oldResultId = dashboard.evaluationResult.evaluationResultId;

  const beforeArchived = Object.fromEntries(["S001", "S002", "S003", "S004"].map((id) => [id, store.scenario(id)]));
  const receipt = store.resetCurrentScenario("S005");
  assert.notEqual(receipt.scenarioRunId, scenarioContext.scenarioRunId);
  assert.deepEqual({ ...store.s005Progress() }, { done: 0, total: 7, active: 0, blocked: 0 });
  assert.equal(store.s005EvaluationProjection().evaluationRun, null);
  assert.equal(store.s005EvaluationProjection().evaluationResult, null);
  assert.equal(store.scenario("S005").runHistory.at(-1).evaluationResult.evaluationResultId, oldResultId);
  assert.equal(store.s005ModuleProjection("M06").historyComparison.previousEvaluationResultId, oldResultId);
  for (const id of ["S001", "S002", "S003", "S004"]) assert.deepEqual(store.scenario(id), beforeArchived[id]);
});
