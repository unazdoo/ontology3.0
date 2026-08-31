import { ContractError, assertContract } from "./errors.mjs";
import { sha256 } from "./hash.mjs";
import { getObjective, validateObjectiveBinding } from "./objective-registry.mjs";
import {
  candidateWeightAudit,
  createDeterministicS003Candidates,
  createS003BaselineModelVersion,
  createS003ResultEnvelope,
  evaluateS003Model,
  loadS003BenchmarkSources,
  materializeS003Observations
} from "./s003-benchmark.mjs";
import { S003_FIXED_RESULT_SOURCE, S003_OBJECTIVE_ID } from "./s003-contract.mjs";

const BASE_CLOCK = Date.parse("2026-08-31T00:00:00.000Z");

function clone(value) {
  return structuredClone(value);
}

function operationTime(sequence) {
  return new Date(BASE_CLOCK + sequence * 60_000).toISOString();
}

function publicCandidate(candidate) {
  return {
    id: candidate.id,
    candidateId: candidate.candidateId,
    modelVersionId: candidate.modelVersion.modelVersionId,
    modelVersionLabel: candidate.modelVersion.modelVersion,
    name: candidate.name,
    type: candidate.type,
    status: candidate.status,
    blockedReason: candidate.blockedReason,
    primaryMetric: candidate.primaryMetric,
    metrics: clone(candidate.metrics),
    diff: clone(candidate.diff),
    evidenceRefs: [...candidate.evidenceRefs],
    branchCreatedBy: candidate.branchCreatedBy,
    numericParametersGeneratedBy: candidate.numericParametersGeneratedBy,
    parameterSearch: clone(candidate.parameterSearch),
    modelVersion: clone(candidate.modelVersion),
    experimentRunId: candidate.experimentRunId || null,
    fairnessContext: clone(candidate.fairnessContext || null),
    weightAudit: clone(candidate.weightAudit || null)
  };
}

function initialState(sources, baselineModelVersion) {
  return {
    schemaVersion: "ofw.m08.s003-continuous-optimization-workspace.v1",
    objectiveId: S003_OBJECTIVE_ID,
    status: "READY_TO_BENCHMARK",
    lifecycle: {
      stage: "OBJECTIVE_READY",
      history: [{ stage: "OBJECTIVE_READY", at: operationTime(0), resourceId: S003_OBJECTIVE_ID }]
    },
    operationSequence: 0,
    baselineModelVersion,
    sourceVerification: clone(sources.sourceVerification),
    lastBenchmark: null,
    benchmark: null,
    insights: [],
    candidates: [],
    experiments: [],
    review: null,
    releaseCandidate: null,
    binding: null,
    shadowTrial: null,
    trend: [],
    currentResultEnvelope: null,
    maturedLabelCount: 0,
    holdout: {
      status: "SEALED",
      policy: sources.fixture.benchmark.holdoutPolicy,
      usedAt: null,
      usedByReleaseCandidateId: null,
      repeatedTuningAllowed: false
    },
    nextAction: { code: "RUN_BENCHMARK", label: "运行基线评测", reason: "先用验证集形成可复算基线，封存测试集保持未使用。" },
    aiAssistancePolicy: {
      supportedSuggestionTypes: ["REWEIGHT", "ANCHOR_ADJUST", "THRESHOLD_ADJUST", "FACTOR_ADD", "FACTOR_MODIFY", "FACTOR_REMOVE", "MISSING_POLICY"],
      structuredInsightOnly: true,
      scoreCalculationAllowed: false,
      labelMutationAllowed: false,
      ontologyMutationAllowed: false,
      dataMutationAllowed: false,
      benchmarkMutationAllowed: false,
      automaticChampionSelectionAllowed: false,
      automaticReleaseAllowed: false
    },
    ownershipBoundary: {
      m01: "Published Ontology、Metric、Rule、Action Type 与现有 1.0.2 来源配置",
      m08: "Objective、Benchmark、Experiment、ModelInsight、候选 Model Version、Release Candidate、Binding 与 Shadow Trial",
      t019ModelRegistrationAllowed: false,
      ownershipMigrationCrRequired: true,
      crRef: "CR-M08-S003-MODEL-OWNER-MIGRATION"
    },
    scenarioRunIsolation: {
      benchmarkUsesScenarioRunId: false,
      archivedS003RunReadOnly: true,
      archivedScenarioRunId: sources.fixedResultSet.scenarioIdentity.scenarioRunId,
      overwrittenScenarioRunIds: []
    },
    resultBoundary: {
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false,
      m04NonFactCode: "NON_FACT_SOURCE_REJECTED",
      simulationCanReplaceFact: false,
      publishedModelRegistrationAllowed: false
    }
  };
}

function transition(state, stage, status, resourceId, nextAction) {
  state.operationSequence += 1;
  const at = operationTime(state.operationSequence);
  state.lifecycle.stage = stage;
  state.lifecycle.history.push({ stage, at, resourceId });
  state.status = status;
  state.nextAction = nextAction;
  return at;
}

function insightRecords(report) {
  const reportRef = report.reportId;
  return [
    {
      insightId: "INSIGHT-S003-LIQUIDITY-COVERAGE-v1",
      type: "REWEIGHT",
      evidenceRefs: [reportRef, ...report.metrics.worstSlices.map((item) => `${reportRef}#/metrics/worstSlices/${item.dimension}/${item.value}`)],
      problem: "固定容量排序对流动性、偿债覆盖和资金缺口信号的敏感度需要单独验证。",
      suggestedDiff: { operation: "REWEIGHT", scope: ["经营活动产生的现金流入", "现金比率", "资产负债率", "利息保障倍数", "现金流动负债比率"] },
      impactScope: "15 项指标的行业权重；语义顺序和权重合计约束不变。",
      expectedImprovement: "期望减少重大债务事件漏报；不预设改善数值。",
      possibleRisk: "可能降低对盈利与周转维度的敏感度。",
      dataOntologyDependencies: ["M01 既有指标语义", "M02 synthetic 纵向特征与独立 Outcome"],
      validationMethod: "同一验证集、固定 Top20% 容量、相同 Evaluator 与 Metric Schema 对比。"
    },
    {
      insightId: "INSIGHT-S003-CALIBRATION-v1",
      type: "ANCHOR_ADJUST",
      evidenceRefs: [reportRef, `${reportRef}#/metrics/stability`, `${reportRef}#/metrics/drift`],
      problem: "分数锚点、风险阈值与负向因子系数需要在时间外样本中联合校准。",
      suggestedDiff: { operations: ["ANCHOR_ADJUST", "THRESHOLD_ADJUST", "FACTOR_MODIFY"] },
      impactScope: "风险分数校准、四档边界及三个负向因子；不改变标签和 Benchmark 口径。",
      expectedImprovement: "期望改善固定容量排序和等级稳定性；不自动选择冠军。",
      possibleRisk: "阈值迁移可能放大逐户升降档，需要影子窗口观察。",
      dataOntologyDependencies: ["M01 既有风险分档", "成熟 Outcome 标签"],
      validationMethod: "验证集比较后进入三窗口 Shadow Trial，再以封存测试集完成一次最终候选评测。"
    },
    {
      insightId: "INSIGHT-S003-MATURITY-CONCENTRATION-v1",
      type: "FACTOR_ADD",
      evidenceRefs: [reportRef, "S003-M01-DEBT-RISK-PKG@1.0.2#/factors", "DATA-SYN-S003-LONGITUDINAL-v1"],
      problem: "现有输入未表达未来90日到期债务集中度，无法验证该信号的增量。",
      suggestedDiff: { operation: "FACTOR_ADD", factorId: "future90dMaturityConcentration", companionOperation: "FACTOR_REMOVE_AFTER_ABLATION_ONLY" },
      impactScope: "M01 因子语义、M02 历史数据和 S003 输入合同。",
      expectedImprovement: "仅形成待验证假设，不宣称模型改善。",
      possibleRisk: "与资金余缺预警或偿债指标重复，可能造成双重计量。",
      dataOntologyDependencies: ["M01 新因子语义定义缺失", "M02 历史观测缺失"],
      validationMethod: "语义和历史数据齐备后重建同一时间切分并执行相关性、消融和封存测试。"
    }
  ].map((insight) => ({
    resourceKind: "ModelInsight",
    ...insight,
    generatedBy: "STRUCTURED_AI_ASSISTANT",
    scoreCalculationPerformed: false,
    labelMutationAllowed: false,
    ontologyMutationAllowed: false,
    dataMutationAllowed: false,
    benchmarkMutationAllowed: false,
    championSelectionAllowed: false,
    releaseAllowed: false,
    actionWriteAllowed: false
  }));
}

function benchmarkSummary(benchmarkRunId, report) {
  return {
    benchmarkRunId,
    reportId: report.reportId,
    status: report.status,
    primaryMetric: report.metrics.recallAtFixedCapacity,
    fixedCapacityRatio: report.fixedContext.fixedCapacityRatio,
    benchmarkVersion: report.fixedContext.benchmarkVersion,
    datasetSplits: report.fixedContext.datasetSplits,
    holdoutUsed: report.fixedContext.holdoutUsed,
    maturedLabels: report.labels.maturedCount,
    conclusion: report.conclusion
  };
}

function runnableCandidate(state, candidateId) {
  const candidate = state.candidates.find((item) => item.candidateId === candidateId || item.modelVersion.modelVersionId === candidateId);
  assertContract(candidate, "CANDIDATE_NOT_FOUND", `Unknown S003 candidate: ${candidateId}`);
  assertContract(candidate.status !== "DATA_REQUIRED", "DATA_REQUIRED", candidate.blockedReason || "Candidate dependencies are missing.");
  return candidate;
}

function workspaceProjection(state) {
  return {
    ...clone(state),
    candidates: state.candidates.map(publicCandidate),
    activeCandidates: state.candidates.filter((item) => item.status !== "DATA_REQUIRED").map((item) => ({ candidateId: item.candidateId, modelVersionId: item.modelVersion.modelVersionId, status: item.status })),
    report: clone(state.benchmark?.report || null),
    objective: getObjective(S003_OBJECTIVE_ID),
    researchRunRefs: {
      benchmarkRunId: state.benchmark?.benchmarkRunId || null,
      experimentRunIds: state.experiments.map((item) => item.experimentRunId),
      shadowRunId: state.shadowTrial?.shadowRunId || null,
      releaseCandidateId: state.releaseCandidate?.releaseCandidateId || null
    }
  };
}

export function createS003Runtime() {
  const sources = loadS003BenchmarkSources();
  const observations = materializeS003Observations(sources.fixture, sources.baselinePackage);
  const baselineModelVersion = createS003BaselineModelVersion(sources.sourceVerification);
  let state = initialState(sources, baselineModelVersion);

  function workspace() {
    return workspaceProjection(state);
  }

  function reset() {
    state = initialState(sources, baselineModelVersion);
    return workspace();
  }

  function runBenchmark() {
    const maturedWindowIds = new Set(state.shadowTrial?.maturedWindows?.map((item) => item.maturityWindowId) || []);
    const useShadow = maturedWindowIds.size > 0;
    const evaluationRows = useShadow
      ? observations.filter((item) => item.split === "SHADOW" && maturedWindowIds.has(item.outcome.maturityWindowId))
      : observations.filter((item) => item.split === "VALIDATION");
    const referenceRows = observations.filter((item) => item.split === (useShadow ? "VALIDATION" : "TRAIN"));
    const sequence = state.operationSequence + 1;
    const benchmarkRunId = `BENCHRUN-S003-${String(sequence).padStart(3, "0")}`;
    const report = evaluateS003Model({
      observations: evaluationRows,
      referenceObservations: referenceRows,
      modelVersion: baselineModelVersion,
      baselinePackage: sources.baselinePackage,
      benchmark: sources.fixture.benchmark
    });
    report.benchmarkRunId = benchmarkRunId;
    let comparison = null;
    if (useShadow && state.shadowTrial) {
      const candidate = runnableCandidate(state, state.shadowTrial.candidateId);
      const candidateReport = evaluateS003Model({ observations: evaluationRows, referenceObservations: referenceRows, modelVersion: candidate.modelVersion, baselinePackage: sources.baselinePackage, benchmark: sources.fixture.benchmark });
      candidateReport.benchmarkRunId = `${benchmarkRunId}-CANDIDATE`;
      comparison = { baseline: report, candidate: candidateReport, autoChampionSelected: false };
    }
    state.benchmark = { benchmarkRunId, scope: useShadow ? "MATURED_SHADOW_LABELS" : "VALIDATION", report, comparison };
    state.lastBenchmark = benchmarkSummary(benchmarkRunId, report);
    transition(state, "BENCHMARK_EVALUATED", report.status === "INSUFFICIENT_LABELS" ? "BENCHMARK_INSUFFICIENT_LABELS" : "BENCHMARK_READY", benchmarkRunId, report.status === "INSUFFICIENT_LABELS"
      ? { code: "WAIT_FOR_LABELS", label: "等待更多独立标签", reason: "成熟标签不足，当前不生成模型有效性结论。" }
      : { code: "GENERATE_INSIGHTS", label: "生成有证据的优化洞察", reason: "评测指标已由确定性引擎形成，AI 仅生成结构化建议。" });
    return workspace();
  }

  function generateInsights() {
    assertContract(state.benchmark?.report, "BENCHMARK_REQUIRED", "Run a deterministic benchmark before generating ModelInsight records.");
    assertContract(state.benchmark.report.status !== "INSUFFICIENT_LABELS", "INSUFFICIENT_LABELS", "ModelInsight generation is blocked until enough independent labels mature.");
    state.insights = insightRecords(state.benchmark.report);
    transition(state, "INSIGHTS_READY", "INSIGHTS_READY", state.insights.map((item) => item.insightId).join(","), { code: "GENERATE_CANDIDATES", label: "形成三个候选分支", reason: "数值参数由受约束确定性搜索生成，AI 不计算分数。" });
    return workspace();
  }

  function generateCandidates() {
    assertContract(state.insights.length > 0, "INSIGHTS_REQUIRED", "Structured evidence-backed insights are required before candidate generation.");
    state.candidates = createDeterministicS003Candidates();
    transition(state, "CANDIDATES_GENERATED", "CANDIDATES_READY", state.candidates.map((item) => item.candidateId).join(","), { code: "EVALUATE_CANDIDATES", label: "在同一验证集评测候选", reason: "A、B 可运行；C 因语义和历史数据缺失保持 DATA_REQUIRED。" });
    return workspace();
  }

  function evaluateCandidates() {
    assertContract(state.candidates.length === 3, "CANDIDATES_REQUIRED", "Generate the deterministic candidate branches before evaluation.");
    const evaluationRows = observations.filter((item) => item.split === "VALIDATION");
    const referenceRows = observations.filter((item) => item.split === "TRAIN");
    state.experiments = [];
    state.candidates.forEach((candidate, index) => {
      if (candidate.status === "DATA_REQUIRED") return;
      const report = evaluateS003Model({ observations: evaluationRows, referenceObservations: referenceRows, modelVersion: candidate.modelVersion, baselinePackage: sources.baselinePackage, benchmark: sources.fixture.benchmark });
      const experimentRunId = `EXPRUN-S003-${String(index + 1).padStart(3, "0")}`;
      candidate.status = report.status === "EVALUATED" ? "EVALUATED" : report.status;
      candidate.primaryMetric = report.metrics.recallAtFixedCapacity;
      candidate.metrics = report.metrics;
      candidate.experimentRunId = experimentRunId;
      candidate.fairnessContext = clone(report.fixedContext);
      candidate.weightAudit = candidateWeightAudit(candidate, sources.baselinePackage);
      state.experiments.push({
        resourceKind: "ExperimentRun",
        experimentRunId,
        objectiveId: S003_OBJECTIVE_ID,
        candidateId: candidate.candidateId,
        modelVersionId: candidate.modelVersion.modelVersionId,
        status: candidate.status,
        benchmarkReport: report,
        sameBenchmarkVersion: true,
        sameDatasetSplit: true,
        sameEvaluator: true,
        sameMetricSchema: true,
        holdoutUsed: false,
        autoChampionSelected: false
      });
    });
    transition(state, "CANDIDATES_EVALUATED", "AWAITING_SHADOW_SELECTION", state.experiments.map((item) => item.experimentRunId).join(","), { code: "START_SHADOW", label: "选择一个候选进入影子观察", reason: "系统不自动选择冠军；需明确选择 A 或 B。" });
    return workspace();
  }

  function startShadow({ candidateId = null, modelVersionId = null } = {}) {
    const candidate = runnableCandidate(state, candidateId || modelVersionId);
    assertContract(candidate.status === "EVALUATED", "CANDIDATE_NOT_EVALUATED", "Only an evaluated candidate can enter Shadow Trial.");
    const shadowTrialId = `SHADOWTRIAL-S003-${candidate.candidateId}-v1`;
    state.shadowTrial = {
      resourceKind: "ShadowTrial",
      shadowTrialId,
      shadowRunId: `SHADOWRUN-S003-${candidate.candidateId}-001`,
      objectiveId: S003_OBJECTIVE_ID,
      candidateId: candidate.candidateId,
      modelVersionId: candidate.modelVersion.modelVersionId,
      role: "SHADOW",
      status: "ACTIVE",
      currentWindow: 0,
      totalWindows: sources.fixture.maturityWindows.length,
      maturedWindows: [],
      continueObserveAllowed: true,
      formReleaseCandidateAllowed: false,
      endTrialAllowed: true,
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false
    };
    transition(state, "SHADOW_ACTIVE", "SHADOW_ACTIVE", shadowTrialId, { code: "ADVANCE_SHADOW_WINDOW", label: "读取第一个成熟标签窗口", reason: "影子结果与正式事实隔离，仅在标签成熟后评测。" });
    return workspace();
  }

  function advanceShadow({ decision = "CONTINUE" } = {}) {
    assertContract(state.shadowTrial, "SHADOW_TRIAL_REQUIRED", "Start a Shadow Trial before reading maturity windows.");
    if (decision === "END") {
      state.shadowTrial.status = "ENDED";
      state.shadowTrial.endedWithoutRelease = true;
      transition(state, "SHADOW_ENDED", "SHADOW_ENDED", state.shadowTrial.shadowTrialId, { code: "SELECT_ANOTHER_CANDIDATE", label: "选择其他候选或结束优化", reason: "结束试用不会改变任何正式结果。" });
      return workspace();
    }
    if (decision === "CONTINUE_OBSERVE") {
      assertContract(state.shadowTrial.status === "MATURED", "SHADOW_MATURITY_REQUIRED", "Continue-observe is available after the configured maturity windows complete.");
      state.shadowTrial.continueObserveDecision = { status: "CONTINUE_OBSERVING", at: operationTime(state.operationSequence + 1) };
      transition(state, "SHADOW_OBSERVING", "SHADOW_OBSERVING", state.shadowTrial.shadowTrialId, { code: "WAIT_OR_REBENCHMARK", label: "继续观察新标签", reason: "不形成新模型版本，不自动发布；新标签到达后可重新运行 Benchmark。" });
      return workspace();
    }
    assertContract(decision === "CONTINUE", "SHADOW_DECISION_INVALID", "Shadow decision must be CONTINUE, CONTINUE_OBSERVE or END.");
    assertContract(state.shadowTrial.status === "ACTIVE", "SHADOW_NOT_ACTIVE", "Only an active Shadow Trial can advance.");
    const nextWindow = sources.fixture.maturityWindows[state.shadowTrial.currentWindow];
    assertContract(nextWindow, "ALL_SHADOW_WINDOWS_MATURED", "All configured Shadow Trial windows have already matured.");
    const candidate = runnableCandidate(state, state.shadowTrial.candidateId);
    const rows = observations.filter((item) => item.split === "SHADOW" && item.outcome.maturityWindowId === nextWindow.maturityWindowId);
    const referenceRows = observations.filter((item) => item.split === "VALIDATION");
    const baselineReport = evaluateS003Model({ observations: rows, referenceObservations: referenceRows, modelVersion: baselineModelVersion, baselinePackage: sources.baselinePackage, benchmark: { ...sources.fixture.benchmark, minimumMaturedLabels: 1 } });
    const candidateReport = evaluateS003Model({ observations: rows, referenceObservations: referenceRows, modelVersion: candidate.modelVersion, baselinePackage: sources.baselinePackage, benchmark: { ...sources.fixture.benchmark, minimumMaturedLabels: 1 } });
    const trendPoint = {
      maturityWindowId: nextWindow.maturityWindowId,
      maturedAt: nextWindow.maturedAt,
      newMaturedLabelCount: rows.length,
      cumulativeMaturedLabelCount: state.maturedLabelCount + rows.length,
      baseline: { reportId: baselineReport.reportId, status: baselineReport.status, metrics: baselineReport.metrics },
      candidate: { reportId: candidateReport.reportId, status: candidateReport.status, metrics: candidateReport.metrics },
      autoReleaseTriggered: false
    };
    state.maturedLabelCount += rows.length;
    state.trend.push(trendPoint);
    state.shadowTrial.maturedWindows.push({ maturityWindowId: nextWindow.maturityWindowId, maturedAt: nextWindow.maturedAt, trendPointRef: `${state.shadowTrial.shadowTrialId}#/trend/${state.trend.length - 1}` });
    state.shadowTrial.currentWindow += 1;
    const complete = state.shadowTrial.currentWindow === state.shadowTrial.totalWindows;
    if (complete) {
      state.shadowTrial.status = "MATURED";
      state.shadowTrial.continueObserveAllowed = true;
      state.shadowTrial.formReleaseCandidateAllowed = true;
      transition(state, "SHADOW_MATURED", "SHADOW_MATURED", nextWindow.maturityWindowId, { code: "REBENCHMARK_OR_FORM_RC", label: "重新评测或形成发布候选", reason: "三个成熟窗口已形成；仍需明确选择，系统不会自动发布。" });
    } else {
      transition(state, "SHADOW_ACTIVE", "SHADOW_ACTIVE", nextWindow.maturityWindowId, { code: "ADVANCE_SHADOW_WINDOW", label: "继续读取下一个成熟窗口", reason: `已完成 ${state.shadowTrial.currentWindow}/${state.shadowTrial.totalWindows} 个窗口。` });
    }
    return workspace();
  }

  function formReleaseCandidate({ candidateId = null, modelVersionId = null } = {}) {
    assertContract(state.shadowTrial?.status === "MATURED", "SHADOW_MATURITY_REQUIRED", "All configured maturity windows must complete before forming a Release Candidate.");
    const candidate = runnableCandidate(state, candidateId || modelVersionId || state.shadowTrial.candidateId);
    assertContract(candidate.candidateId === state.shadowTrial.candidateId, "SHADOW_CANDIDATE_MISMATCH", "Release Candidate must match the completed Shadow Trial candidate.");
    assertContract(state.holdout.status === "SEALED", "HOLDOUT_ALREADY_CONSUMED", "The sealed holdout can be used only once for the final candidate.");
    const holdoutRows = observations.filter((item) => item.split === "HOLDOUT");
    const trainValidationRows = observations.filter((item) => ["TRAIN", "VALIDATION"].includes(item.split));
    const finalReport = evaluateS003Model({ observations: holdoutRows, referenceObservations: trainValidationRows, modelVersion: candidate.modelVersion, baselinePackage: sources.baselinePackage, benchmark: sources.fixture.benchmark });
    assertContract(finalReport.fixedContext.holdoutUsed === true, "HOLDOUT_NOT_USED", "Final candidate evaluation must use the sealed holdout exactly once.");
    const releaseCandidateId = `RC-S003-${candidate.modelVersion.modelVersionId}-001`;
    const at = transition(state, "RELEASE_CANDIDATE_FORMED", "RELEASE_CANDIDATE_READY", releaseCandidateId, { code: "VALIDATE_BINDING", label: "校验消费者 Binding", reason: "Release Candidate 仍是研究候选，尚未设为仪表盘默认候选。" });
    state.holdout = { ...state.holdout, status: "CONSUMED_FINAL_ONCE", usedAt: at, usedByReleaseCandidateId: releaseCandidateId };
    state.review = {
      resourceKind: "ReleaseCandidateSelectionRecord",
      status: "EXPLICIT_CANDIDATE_SELECTION_RECORDED",
      selectedCandidateId: candidate.candidateId,
      selectedModelVersionId: candidate.modelVersion.modelVersionId,
      selectedAutomatically: false,
      approvalGateAdded: false,
      at
    };
    state.releaseCandidate = {
      resourceKind: "ReleaseCandidate",
      releaseCandidateId,
      objectiveId: S003_OBJECTIVE_ID,
      candidateId: candidate.candidateId,
      modelVersionId: candidate.modelVersion.modelVersionId,
      modelVersionFingerprint: candidate.modelVersion.definitionFingerprint,
      status: "RESEARCH_RELEASE_CANDIDATE",
      holdoutReport: finalReport,
      published: false,
      productionEligible: false,
      t019WriteAllowed: false,
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false,
      formedAt: at
    };
    return workspace();
  }

  function validateBinding({ binding = null } = {}) {
    assertContract(state.releaseCandidate, "RELEASE_CANDIDATE_REQUIRED", "Form a Release Candidate before validating its consumer Binding.");
    const objective = getObjective(S003_OBJECTIVE_ID);
    const draft = binding ? clone(binding) : clone(objective.bindingDraft);
    draft.releaseSelector = {
      kind: "RESEARCH_RELEASE_SELECTOR",
      releaseCandidateId: state.releaseCandidate.releaseCandidateId,
      modelVersionId: state.releaseCandidate.modelVersionId,
      published: false
    };
    try {
      const genericValidation = validateObjectiveBinding({ objectiveId: S003_OBJECTIVE_ID, binding: draft });
      state.binding = {
        ...genericValidation,
        status: "VALIDATED_RESEARCH_BINDING",
        validationStatus: "VALID",
        activationStatus: "READY_FOR_RESEARCH_CANDIDATE_APPLICATION",
        releaseCandidateId: state.releaseCandidate.releaseCandidateId,
        modelVersionId: state.releaseCandidate.modelVersionId,
        applicationRole: null,
        appliedAsDashboardDefaultCandidate: false,
        humanConfirmationRequiredForApplication: true,
        factWriteAllowed: false,
        actionWriteAllowed: false,
        actionSourceAllowed: false
      };
      transition(state, "BINDING_VALIDATED", "BINDING_VALIDATED", state.binding.bindingRevisionId, { code: "APPLY_DEFAULT_CANDIDATE", label: "确认设为仪表盘默认候选", reason: "这是唯一人工确认门；只改变候选显示角色，不发布模型或覆盖正式事实。" });
    } catch (error) {
      if (!(error instanceof ContractError)) throw error;
      state.binding = {
        resourceKind: "BindingValidationResult",
        status: "REJECTED",
        validationStatus: "REJECTED",
        code: error.code,
        reasons: [error.message],
        details: clone(error.details),
        factWriteAllowed: false,
        actionWriteAllowed: false,
        actionSourceAllowed: false
      };
      transition(state, "BINDING_REJECTED", "BINDING_REJECTED", error.code, { code: "FIX_BINDING", label: "修正 Binding 漂移", reason: error.message });
    }
    return workspace();
  }

  function applyDefaultCandidate({ candidateId = null, modelVersionId = null, confirmed = false, confirmedBy = null, reviewerId = null } = {}) {
    assertContract(state.binding?.validationStatus === "VALID", "VALID_BINDING_REQUIRED", "A validated Binding is required before applying a dashboard default candidate.");
    const candidate = runnableCandidate(state, candidateId || modelVersionId || state.releaseCandidate.candidateId);
    assertContract(candidate.candidateId === state.releaseCandidate.candidateId, "RELEASE_CANDIDATE_MISMATCH", "The applied candidate must match the validated Release Candidate.");
    const confirmer = confirmedBy || reviewerId;
    assertContract(confirmed === true && typeof confirmer === "string" && confirmer.length > 0, "HUMAN_CONFIRMATION_REQUIRED", "Applying a dashboard default candidate requires one explicit human confirmation.");
    const at = transition(state, "DEFAULT_CANDIDATE_APPLIED", "DEFAULT_CANDIDATE_APPLIED", state.binding.bindingRevisionId, { code: "RECALCULATE_FIXED_DATA", label: "返回 S003 查看候选试算", reason: "候选仅以 PREDICTION / WHAT_IF 或 SHADOW 角色显示。" });
    state.binding = {
      ...state.binding,
      status: "APPLIED_RESEARCH_DEFAULT",
      applicationRole: "DASHBOARD_DEFAULT_CANDIDATE",
      appliedAsDashboardDefaultCandidate: true,
      appliedAt: at,
      humanConfirmation: { confirmed: true, confirmedBy: confirmer, confirmedAt: at, confirmationCount: 1 },
      formalFactPointerChanged: false,
      publishedModelPointerChanged: false
    };
    state.review = {
      ...state.review,
      applicationConfirmation: clone(state.binding.humanConfirmation)
    };
    return workspace();
  }

  function recalculate({ candidateId = null, modelVersionId = null, usageIntent = "WHAT_IF", asOf = null, dataVersion = null, enterpriseIds = null } = {}) {
    const selectedId = candidateId || modelVersionId || state.shadowTrial?.candidateId || state.releaseCandidate?.candidateId;
    assertContract(selectedId, "CANDIDATE_REQUIRED", "Select an evaluated candidate for fixed-data recalculation.");
    const candidate = runnableCandidate(state, selectedId);
    assertContract(candidate.status === "EVALUATED", "CANDIDATE_NOT_EVALUATED", "Only an evaluated candidate can recalculate the fixed S003 data projection.");
    assertContract(!dataVersion || dataVersion === S003_FIXED_RESULT_SOURCE.dataVersion, "DATA_VERSION_MISMATCH", "Candidate recalculation must use the fixed S003 DataVersion.", { expected: S003_FIXED_RESULT_SOURCE.dataVersion, actual: dataVersion });
    assertContract(!asOf || asOf === S003_FIXED_RESULT_SOURCE.assessmentAsOf, "AS_OF_DATA_VERSION_MISMATCH", "The requested asOf does not match the fixed S003 DataVersion.", { expected: S003_FIXED_RESULT_SOURCE.assessmentAsOf, actual: asOf });
    const formedAt = operationTime(state.operationSequence + 1);
    const benchmarkReport = state.experiments.find((item) => item.candidateId === candidate.candidateId)?.benchmarkReport || state.benchmark?.report || null;
    const envelope = createS003ResultEnvelope({ fixedResultSet: sources.fixedResultSet, baselinePackage: sources.baselinePackage, candidate, benchmarkReport, shadowTrial: state.shadowTrial, usageIntent, enterpriseIds, formedAt });
    envelope.actionSourceAllowed = false;
    envelope.benchmarkRunId = state.benchmark?.benchmarkRunId || envelope.benchmarkRunId;
    envelope.experimentRunId = candidate.experimentRunId || null;
    envelope.shadowRunId = state.shadowTrial?.shadowRunId || null;
    envelope.runIdentities = {
      benchmarkRunId: envelope.benchmarkRunId,
      experimentRunId: envelope.experimentRunId,
      shadowRunId: envelope.shadowRunId,
      forbiddenScenarioRunPrefix: "S003-RUN",
      scenarioRunReused: false
    };
    state.currentResultEnvelope = envelope;
    transition(state, "FIXED_DATA_RECALCULATED", "RESULT_ENVELOPE_READY", envelope.resultId, { code: "VIEW_DIFFERENCE_OR_RETURN", label: "查看正式、候选与差异", reason: "正式 FACT 保持只读，候选结果不打开旧正式报告或行动入口。" });
    return { workspace: workspace(), resultEnvelope: clone(envelope) };
  }

  return {
    workspace,
    reset,
    runBenchmark,
    generateInsights,
    generateCandidates,
    evaluateCandidates,
    startShadow,
    advanceShadow,
    formReleaseCandidate,
    validateBinding,
    applyDefaultCandidate,
    recalculate,
    sources: () => ({ fixture: clone(sources.fixture), observations: clone(observations), baselinePackage: clone(sources.baselinePackage), fixedResultSet: clone(sources.fixedResultSet) })
  };
}

export function m04S003ResultGuard(resultEnvelope) {
  if (resultEnvelope?.resultKind !== "FACT") {
    return {
      status: "BLOCKED",
      code: "NON_FACT_SOURCE_REJECTED",
      resultKind: resultEnvelope?.resultKind || null,
      actionRequestCreated: false,
      notificationCreated: false,
      approvalCreated: false,
      todoCreated: false,
      transactionCreated: false,
      sideEffectsEmitted: 0
    };
  }
  return { status: "FACT_REQUIRED_INDEPENDENT_FLOW", code: null, sideEffectsEmitted: 0 };
}
