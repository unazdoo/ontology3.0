import { S003_REGISTRATION } from "./s003-registration.mjs";

const OBJECTIVE_ID = "MO-S003-DEBT-RISK-EARLY-WARNING-v1";
const DEFAULT_SCENARIO_CONTEXT = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
  formedAt: "2026-08-17T16:30:00.000Z",
  status: "completed"
});

const clone = (value) => value == null ? value : structuredClone(value);

function metricSummary(metrics = {}) {
  return Object.fromEntries(Object.entries(metrics).filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value)));
}

function supplementalPorts(objective) {
  const outputs = {
    "MO-S003-HORIZON-PROBABILITY-v1": [
      ["probability30d", "未来30天风险概率", "probability", "prediction_as_of"],
      ["probability90d", "未来90天风险概率", "probability", "prediction_as_of"],
      ["probability180d", "未来180天风险概率", "probability", "prediction_as_of"]
    ],
    "MO-S003-RISK-TIMING-v1": [["survivalCurve", "风险时间曲线", "probability_series", "horizon_day"], ["expectedRiskWindow", "可能风险窗口", "risk_window", "prediction_as_of"]],
    "MO-S003-EVENT-TYPE-v1": [["eventTypeProbabilities", "风险事件类型概率", "probability_map", "prediction_as_of"]],
    "MO-S003-LIQUIDITY-GAP-v1": [["liquidityGap", "流动性缺口", "CNY_million", "forecast_window"], ["maturityWall", "债务到期墙", "CNY_million_series", "maturity_bucket"], ["refinancePressure", "再融资压力", "score_0_1", "prediction_as_of"]],
    "MO-S003-CONTAGION-v1": [["relationRiskScore", "关系传染风险", "score_0_100", "as_of"], ["riskPath", "关系风险路径", "relationship_path", "as_of"]],
    "MO-S003-ANOMALY-v1": [["anomalyScore", "异常分", "score_0_100", "as_of"], ["anomalyEvents", "异常事件", "event_set", "event"]],
    "MO-S003-REVIEW-PRIORITY-v1": [["reviewPriority", "复核优先级", "rank", "prediction_as_of"], ["priorityReasons", "优先复核原因", "reason_set", "prediction_as_of"]]
  }[objective.objectiveId] || [];
  return outputs.map(([modelPort, label, unit, timeGrain]) => ({ modelPort, label, objectTypeRef: "EnterpriseRiskPrediction", propertyRef: modelPort, type: unit.includes("series") ? "time_series" : unit.includes("set") || unit.includes("path") || unit.includes("map") ? "object_set" : "double", unit, timeGrain, resultKind: "PREDICTION", displayRole: modelPort.includes("Reason") || modelPort.includes("Path") || modelPort.includes("Events") ? "EVIDENCE" : "PRIMARY", nullable: true }));
}

function supplementalDetail(objective) {
  const outputContract = supplementalPorts(objective);
  return {
    resourceKind: "ModelingObjective",
    objectiveId: objective.objectiveId,
    revisionId: `${objective.objectiveId.replace(/^MO-/, "MOR-")}-0001`,
    name: objective.name,
    shortName: objective.name,
    kind: objective.kind,
    domain: "债务风险管理",
    scenarioIds: ["S003"],
    owner: "财务公司风险管理负责人",
    status: "CONTRACT_READY",
    executionStatus: "MODEL_PORTFOLIO_RUNTIME_READY",
    resultKinds: ["PREDICTION", "SHADOW", "SIMULATION"],
    businessQuestion: objective.businessQuestion,
    intendedUse: "作为正式评分之外的独立风险维度，只读进入 Dashboard、M07、M03、M05 和 M06。",
    prohibitedUses: ["不得覆盖正式评分或分档", "不得跨目标排序模型", "不得触发行动、审批、提醒、待办、通知或交易"],
    acceptedObjectTypes: ["Enterprise", "EnterpriseAssessmentContext"],
    ontologyVersionId: "SC-S003-MULTIMODEL-20260902-v1",
    dataProductRef: "DV-S003-SYN-LONGITUDINAL-20260902-v1",
    evaluationTransactionId: "BENCH-S003-MULTIMODEL-v1",
    evaluatorVersion: "EVAL-S003-MULTIOBJECTIVE-v1",
    metricSchemaVersion: "METRIC-S003-SUPPLEMENTAL-v1",
    successCriteria: ["覆盖率和缺失原因可见", "结果身份与正式 FACT 分离", "每个模型保留独立 ModelRun 和证据"],
    release: { releaseId: `${objective.objectiveId}-RESEARCH-RELEASE`, modelVersionId: objective.comparableModelIds?.[0] || "等待 Model Version", status: "DRAFT_RESEARCH_RELEASE", published: false },
    binding: { bindingId: `MB-${objective.objectiveId}`, revision: 1, status: "DRAFT_REQUIRES_M01_CR" },
    inputContract: [
      { modelPort: "enterprise", label: "企业", objectTypeRef: "Enterprise", propertyRef: "enterpriseId", type: "object_ref", unit: "enterprise", timeGrain: "as_of", required: true, sourceOwner: "M01" },
      { modelPort: "observation", label: "纵向风险观察", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "longitudinalObservations", type: "object_set", unit: "risk_observation", timeGrain: "quarter", required: true, sourceOwner: "M02" },
      { modelPort: "dataVersion", label: "数据版本", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "dataVersion", type: "version_ref", unit: "data_version", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "availableAt", label: "数据可得时间", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "availableAt", type: "datetime", unit: "datetime", timeGrain: "event", required: true, sourceOwner: "M02" }
    ],
    outputContract,
    candidates: [],
    sampleResult: { resultId: `${objective.objectiveId}-AWAITING-RUN`, resultKind: "PREDICTION", asOf: "2025-12-31", outputs: Object.fromEntries(outputContract.map((port) => [port.modelPort, null])), evidenceClass: "NO_FIXED_PREVIEW_RESULT" },
    bindingDraft: {
      resourceKind: "ModelBinding",
      bindingId: `MB-${objective.objectiveId}`,
      bindingRevisionId: `MB-${objective.objectiveId}-R1`,
      bindingRevision: 1,
      status: "DRAFT_REQUIRES_M01_CR",
      objectiveId: objective.objectiveId,
      objectiveRevisionId: `${objective.objectiveId.replace(/^MO-/, "MOR-")}-0001`,
      publishedOntologyRef: "SC-S003-MULTIMODEL-20260902-v1",
      inputMappings: [],
      outputMappings: [],
      releaseSelector: { kind: "RESEARCH_RELEASE_SELECTOR", releaseId: `${objective.objectiveId}-RESEARCH-RELEASE`, modelVersionId: objective.comparableModelIds?.[0] || null },
      concreteEndpointExposed: false,
      t019WriteAllowed: false
    },
    consumers: [
      ["M07_EXPLORATION", "M07", "多视图探索", true, "OBJECT_BADGE"],
      ["M03_QUERY", "M03", "智能问数", true, "ANSWER_EVIDENCE_CARD"],
      ["M05_AGENT", "M05", "Agent 应用", true, "EXPLANATION_PANEL"],
      ["M06_REPORT", "M06", "报告中心", true, "REPORT_BLOCK"],
      ["DASHBOARD", "Dashboard", "仪表盘", true, "OBJECT_SCORE"],
      ["M04_DECISION", "M04", "决策中心", false, null]
    ].map(([consumerId, moduleId, name, allowed, displayMode]) => ({ consumerId, moduleId, name, allowed, displayMode, blockedCode: allowed ? null : "NON_FACT_SOURCE_REJECTED", blockedReason: allowed ? null : "非正式结果不能作为行动来源" }))
  };
}

function objectiveSummary(objective) {
  const detail = supplementalDetail(objective);
  return {
    objectiveId: detail.objectiveId,
    revisionId: detail.revisionId,
    name: detail.name,
    shortName: detail.shortName,
    kind: detail.kind,
    domain: detail.domain,
    scenarioIds: detail.scenarioIds,
    owner: detail.owner,
    status: detail.status,
    executionStatus: detail.executionStatus,
    resultKinds: detail.resultKinds,
    businessQuestion: detail.businessQuestion,
    targetObjectTypes: detail.acceptedObjectTypes,
    inputCount: detail.inputContract.length,
    outputCount: detail.outputContract.length,
    candidateCount: detail.candidates.length,
    bindingStatus: detail.binding.status,
    releaseStatus: detail.release.status,
    consumerCount: detail.consumers.filter((item) => item.allowed).length
  };
}

export function legacyObjectiveCatalog(parentObjectives) {
  const supplemental = S003_REGISTRATION.objectives.filter((item) => item.objectiveId !== "MO-S003-FORMAL-DEBT-RISK-SCORE-v1").map(objectiveSummary);
  return parentObjectives.map((item) => item.objectiveId === OBJECTIVE_ID ? { ...item, name: "企业债务风险智能监测", shortName: "债务风险监测", businessQuestion: "当前正式风险怎样，未来何时、何类风险可能发生，流动性和关系传染影响多大？", inputCount: 10, outputCount: 12, candidateCount: 3 } : item).concat(supplemental);
}

export function legacyObjectiveDetail(objectiveId, parentDetail) {
  const supplemental = S003_REGISTRATION.objectives.find((item) => item.objectiveId === objectiveId);
  if (supplemental && objectiveId !== "MO-S003-FORMAL-DEBT-RISK-SCORE-v1") return supplementalDetail(supplemental);
  if (objectiveId !== OBJECTIVE_ID) return parentDetail;
  const outputContract = [
    ...(parentDetail.outputContract || []),
    ["probability30d", "未来30天风险概率", "probability", "prediction_as_of"],
    ["probability90d", "未来90天风险概率", "probability", "prediction_as_of"],
    ["probability180d", "未来180天风险概率", "probability", "prediction_as_of"],
    ["expectedRiskWindow", "可能风险窗口", "risk_window", "prediction_as_of"],
    ["mostLikelyEventType", "最可能风险事件", "risk_event_type", "prediction_as_of"],
    ["liquidityGap90d", "90天流动性缺口", "CNY_million", "forecast_window"],
    ["relationRiskScore", "关系传染风险", "score_0_100", "as_of"]
  ].map((item) => Array.isArray(item) ? ({ modelPort: item[0], label: item[1], objectTypeRef: "EnterpriseRiskPrediction", propertyRef: item[0], type: item[2].includes("window") || item[2].includes("type") ? "enum" : "double", unit: item[2], timeGrain: item[3], resultKind: "PREDICTION", displayRole: "PRIMARY", nullable: true, role: "PRIMARY", semanticKind: "RESULT_OBJECT_FIELD", shape: "SCALAR", cardinality: "ONE_PER_SUBJECT" }) : item);
  return {
    ...parentDetail,
    name: "企业债务风险智能监测",
    shortName: "债务风险监测",
    businessQuestion: "当前正式风险怎样，未来何时、何类风险可能发生，流动性和关系传染影响多大？",
    intendedUse: "保留 1.0.2 正式基线，并行比较核心 Challenger 与七类补充模型，支持受控持续优化。",
    dataProductRef: "DV-S003-SYN-LONGITUDINAL-20260902-v1",
    ontologyVersionId: "SC-S003-MULTIMODEL-20260902-v1",
    evaluationTransactionId: "BENCH-S003-MULTIMODEL-v1",
    evaluatorVersion: "EVAL-S003-MULTIOBJECTIVE-v1",
    metricSchemaVersion: "METRIC-S003-MULTIMODEL-v1",
    outputContract,
    bindingDraft: { ...parentDetail.bindingDraft, publishedOntologyRef: "SC-S003-MULTIMODEL-20260902-v1", outputMappings: outputContract }
  };
}

function legacyBenchmark(state) {
  const source = [...(state.benchmarks || [])].reverse().find((item) => item.scope === "MATURED_SHADOW_LABELS")
    || state.benchmarks?.find((item) => item.scope === "PORTFOLIO_COMPARISON")
    || state.benchmarks?.find((item) => item.scope === "BASELINE_VALIDATION")
    || null;
  if (!source) return null;
  return {
    benchmarkRunId: source.benchmarkRunId,
    reportId: source.reportId,
    status: source.status,
    conclusion: source.metrics?.conclusion || source.businessConclusion || "脱敏 synthetic Benchmark 仅验证合同与计算链，不证明模型有效性。",
    fixedContext: {
      benchmarkVersion: source.fixedContext?.benchmarkVersion,
      datasetSplits: [source.fixedContext?.datasetSplit].filter(Boolean),
      evaluatorVersion: source.fixedContext?.evaluatorVersion,
      metricSchemaVersion: source.fixedContext?.metricSchemaVersion,
      outcomeDataVersion: state.data?.dataVersionId,
      holdoutUsed: source.fixedContext?.holdoutUsed === true
    },
    temporalIntegrity: { futureLeakageRows: state.data?.quality?.futureLeakageRows || 0 },
    metrics: metricSummary(source.metrics),
    evidenceRefs: source.evidenceRefs || []
  };
}

function legacyCandidates(state) {
  if (!state.insights?.length && !state.candidates?.length) return [];
  const comparison = state.benchmarks?.find((item) => item.scope === "PORTFOLIO_COMPARISON");
  const comparable = comparison?.comparableModels || [];
  const cards = comparable.filter((item) => item.modelId !== state.formalBaseline.modelId).map((item) => {
    const definition = state.modelDefinitions.find((model) => model.modelId === item.modelId);
    return {
      candidateId: `CAND-${item.modelId}`,
      id: `CAND-${item.modelId}`,
      modelVersionId: item.modelVersionId,
      name: definition?.name || item.modelId,
      type: definition?.modelRole || "CORE_CHALLENGER",
      status: state.candidates?.length ? "EVALUATED" : "PENDING_EVALUATION",
      metrics: metricSummary(item.metrics),
      primaryMetric: item.metrics?.recallAtFixedCapacity,
      businessSummary: "回答与正式评分相同的问题，使用统一 Benchmark 比较。",
      evidenceRefs: [comparison?.reportId, item.modelVersionId].filter(Boolean),
      fairnessContext: comparison?.fixedContext || null,
      modelVersion: { modelVersionId: item.modelVersionId, modelVersion: definition?.version || "0.1.0" }
    };
  });
  if (state.candidates?.[0]) {
    const candidate = state.candidates[0];
    cards.push({
      ...candidate,
      id: candidate.candidateId,
      status: "EVALUATED",
      name: candidate.name,
      businessSummary: "由证据洞察形成的新不可变 Model Version，用于 Shadow Trial。",
      fairnessContext: comparison?.fixedContext || null,
      modelVersion: { modelVersionId: candidate.modelVersionId, modelVersion: candidate.modelVersion }
    });
  }
  return cards;
}

function legacyShadow(state) {
  if (!state.shadowTrial) return null;
  return {
    ...state.shadowTrial,
    statusLabel: state.shadowTrial.status,
    maturedWindows: state.shadowTrial.maturedWindows.map((item) => ({
      ...item,
      observedAt: item.maturedAt,
      status: "EVALUATED",
      baseline: { reportId: item.baselineReportId, metrics: item.baselineMetrics },
      candidate: { reportId: item.candidateReportId, metrics: item.candidateMetrics }
    }))
  };
}

export function legacyResultEnvelope(state, { resultKind = "PREDICTION", useKind = "SHADOW", scenarioContext = DEFAULT_SCENARIO_CONTEXT } = {}) {
  const source = resultKind === "SIMULATION" ? state.results?.simulationEnvelope : resultKind === "SHADOW" ? state.results?.shadowEnvelope : state.results?.candidateEnvelope;
  if (!source) return null;
  const outputs = (source.subjects || []).map((item) => ({
    enterpriseId: item.enterpriseId,
    enterpriseName: item.name,
    industry: item.industry,
    operatingStage: item.industry === "在建企业" ? "在建" : "运营",
    riskScore: item.candidate?.score,
    riskIndex: item.candidate?.score,
    predictedRiskTier: item.candidate?.tier,
    probability30d: item.horizons?.probability30d,
    probability90d: item.horizons?.probability90d,
    probability180d: item.horizons?.probability180d,
    survivalCurve: item.survivalCurve || [],
    expectedRiskWindow: item.expectedRiskWindow,
    eventTypeProbabilities: item.eventTypeProbabilities || {},
    mostLikelyEventType: item.mostLikelyEventType?.type,
    mostLikelyEventProbability: item.mostLikelyEventType?.probability,
    liquidityGap30d: item.liquidity?.gap30dMillions,
    liquidityGap90d: item.liquidity?.gap90dMillions,
    liquidityGap180d: item.liquidity?.gap180dMillions,
    maturityWall: item.liquidity?.maturityWall || [],
    refinancePressure: item.liquidity?.refinancePressure,
    liquidityMissingReason: item.liquidity?.missingReason,
    relationRiskScore: item.relation?.score,
    relationStatus: item.relation?.status,
    relationRiskPath: item.relation?.path || [],
    relationMissingReason: item.relation?.missingReason,
    anomalyScore: item.anomaly?.score,
    anomalyStatus: item.anomaly?.status,
    anomalyEvents: item.anomaly?.events || [],
    confidence: item.confidence,
    coverage: item.confidence?.score,
    topContributors: item.formalContributors || [],
    evidenceRefs: item.evidenceRefs || [],
    baseline: { riskScore: item.formal?.score, riskTier: item.formal?.tier },
    baselineRiskScore: item.formal?.score,
    baselineRiskTier: item.formal?.tier
  }));
  const highRisk90d = outputs.filter((item) => Number(item.probability90d) >= 0.55).length;
  const liquidityGap90d = outputs.reduce((sum, item) => sum + (Number(item.liquidityGap90d) || 0), 0);
  const modelDisagreements = outputs.filter((item) => item.baselineRiskTier && item.baselineRiskTier !== item.predictedRiskTier).length;
  return {
    schemaVersion: "ofw.modeling.result-envelope.v1",
    resultId: source.resultId,
    runId: source.runId,
    resultKind: resultKind === "SHADOW" ? "PREDICTION" : resultKind,
    useKind: resultKind === "SIMULATION" ? "WHAT_IF" : useKind,
    usageIntent: resultKind === "SHADOW" ? "SHADOW" : resultKind === "SIMULATION" ? "WHAT_IF" : useKind,
    objectiveId: OBJECTIVE_ID,
    objectiveRevisionId: "MOR-S003-DEBT-RISK-EARLY-WARNING-0002",
    bindingId: state.consumerBinding?.bindingId || "CB-S003-DASHBOARD-MULTIMODEL",
    bindingRevision: state.consumerBinding?.revision || 1,
    bindingRevisionId: state.consumerBinding?.bindingRevisionId || "CB-S003-DASHBOARD-MULTIMODEL-R1",
    releaseId: state.releaseCandidate?.releaseCandidateId || "MREL-S003-DEBT-RISK-BASELINE-REFERENCE",
    modelVersionId: source.modelVersionId,
    dataVersionId: state.data?.dataVersionId,
    formedAt: source.formedAt,
    inputSnapshot: { ...scenarioContext, scenarioContext: clone(scenarioContext), asOf: source.asOf, dataVersionId: state.data?.dataVersionId, ontologyVersionId: state.semanticContract?.semanticContractVersionId },
    outputs,
    subjects: outputs.map((item) => ({
      objectRef: { id: item.enterpriseId, title: item.enterpriseName, objectTypeRef: "Enterprise" },
      predictedRiskTierName: item.predictedRiskTier,
      riskScore: item.riskScore,
      probability90d: item.probability90d,
      survivalCurve: item.survivalCurve,
      eventTypeProbabilities: item.eventTypeProbabilities,
      liquidityGap90d: item.liquidityGap90d,
      maturityWall: item.maturityWall,
      refinancePressure: item.refinancePressure,
      relationRiskScore: item.relationRiskScore,
      relationRiskPath: item.relationRiskPath,
      anomalyEvents: item.anomalyEvents,
      topContributors: item.topContributors,
      baseline: item.baseline,
      delta: item.riskScore == null || item.baselineRiskScore == null ? null : Number((item.riskScore - item.baselineRiskScore).toFixed(2))
    })),
    resultItems: [
      { outputId: "enterpriseCount", label: "企业范围", value: outputs.length, unit: "家" },
      { outputId: "highRisk90d", label: "90天高概率企业", value: highRisk90d, unit: "家" },
      { outputId: "liquidityGap90d", label: "90天流动性缺口", value: Number(liquidityGap90d.toFixed(1)), unit: "百万元" },
      { outputId: "modelDisagreements", label: "模型分歧企业", value: modelDisagreements, unit: "家" }
    ],
    coverage: source.confidence?.lowConfidenceCount == null ? 1 : (21 - source.confidence.lowConfidenceCount) / 21,
    summaries: { benchmark: legacyBenchmark(state) },
    evidenceRefs: source.evidenceRefs || [],
    evidenceRef: state.results?.resultPackage?.resultPackageId || source.evidenceRefs?.[0] || null,
    permissionScope: resultKind === "SIMULATION" ? "simulation.read" : resultKind === "SHADOW" ? "shadow.read" : "prediction.read",
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    formalFactsMutated: false,
    sideEffectsEmitted: 0
  };
}

export function legacyWorkspace(state) {
  const benchmark = legacyBenchmark(state);
  const shadow = legacyShadow(state);
  const candidateResult = legacyResultEnvelope(state);
  const releaseCandidate = state.releaseCandidate ? {
    ...state.releaseCandidate,
    status: "RESEARCH_RELEASE_CANDIDATE",
    holdoutReport: { reportId: state.releaseCandidate.holdoutReportId, metrics: state.releaseCandidate.holdoutMetrics }
  } : null;
  const binding = state.consumerBinding ? {
    ...state.consumerBinding,
    validationStatus: state.consumerBinding.validationStatus,
    appliedAsDashboardDefaultCandidate: state.consumerBinding.status === "APPLIED",
    applicationRole: state.consumerBinding.applicationRole,
    humanConfirmation: state.consumerBinding.status === "APPLIED" ? { confirmationCount: 1, confirmedBy: state.consumerBinding.appliedBy, confirmedAt: state.consumerBinding.appliedAt } : null
  } : null;
  return {
    schemaVersion: "ofw.m08.s003-continuous-optimization-workspace.v2",
    objectiveId: OBJECTIVE_ID,
    status: state.cycle.status,
    lifecycle: { stage: state.cycle.stage, history: state.operationLog.map((item) => ({ stage: item.action, at: item.performedAt, resourceId: item.artifactRefs?.[0] })) },
    baselineModelVersion: { modelVersionId: state.formalBaseline.modelVersionId, modelVersion: state.formalBaseline.modelVersion, version: state.formalBaseline.modelVersion, name: state.formalBaseline.name },
    lastBenchmark: benchmark,
    benchmark: benchmark ? { benchmarkRunId: benchmark.benchmarkRunId, report: benchmark, status: benchmark.status } : null,
    report: benchmark,
    insights: clone(state.insights || []),
    insightReview: clone(state.insightReview),
    insightHistory: clone(state.insightHistory || []),
    candidates: legacyCandidates(state),
    activeCandidates: legacyCandidates(state).filter((item) => item.status === "EVALUATED").map((item) => ({ candidateId: item.candidateId, modelVersionId: item.modelVersionId, status: item.status })),
    shadowTrial: shadow,
    trend: shadow?.maturedWindows || [],
    maturedLabelCount: shadow?.maturedWindows?.reduce((sum, item) => sum + Number(item.newMaturedLabelCount || 0), 0) || 0,
    newlyMaturedLabelCount: shadow?.maturedWindows?.at(-1)?.newMaturedLabelCount || 0,
    releaseCandidate,
    binding,
    consumerBinding: binding,
    currentResultEnvelope: candidateResult,
    resultEnvelope: candidateResult,
    supplementalModels: state.modelDefinitions.filter((item) => item.modelRole === "SUPPLEMENTAL").map((item) => ({ modelId: item.modelId, modelVersionId: item.modelVersionId, name: item.name, objectiveId: item.objectiveId, outputIdentity: item.outputIdentity, status: state.modelRuns.some((run) => run.modelId === item.modelId) ? "EVALUATED" : "PENDING" })),
    modelPortfolio: state.modelDefinitions.map((item) => ({ modelId: item.modelId, modelVersionId: item.modelVersionId, name: item.name, modelRole: item.modelRole, objectiveId: item.objectiveId, outputIdentity: item.outputIdentity })),
    nextAction: clone(state.nextAction),
    nextActionLabel: state.nextAction?.label,
    sourceVerification: { formalModelSha256: state.formalBaseline.sourceModelSha256, formalResultSha256: state.formalBaseline.sourceResultSha256 },
    holdout: clone(state.holdout),
    scenarioRunIsolation: { archivedS003RunReadOnly: true, archivedScenarioRunId: DEFAULT_SCENARIO_CONTEXT.scenarioRunId, overwrittenScenarioRunIds: [] },
    resultBoundary: clone(state.boundaries),
    researchRunRefs: {
      benchmarkRunId: benchmark?.benchmarkRunId || null,
      experimentRunIds: state.candidates?.map((item) => item.experimentRunId).filter(Boolean) || [],
      shadowRunId: shadow?.shadowRunId || null,
      releaseCandidateId: releaseCandidate?.releaseCandidateId || null
    }
  };
}

export function legacyBindingValidation(state) {
  const binding = state.consumerBinding;
  if (!binding) return { validationStatus: "PENDING", status: "PENDING", code: "RELEASE_CANDIDATE_REQUIRED" };
  return { ...binding, status: binding.status, validationStatus: binding.validationStatus, compatibility: binding.validationStatus === "VALID" ? "VALIDATED" : "REJECTED", activationStatus: binding.validationStatus === "VALID" ? "READY_FOR_RESEARCH_CONSUMPTION" : "BLOCKED" };
}

export { OBJECTIVE_ID, DEFAULT_SCENARIO_CONTEXT };
