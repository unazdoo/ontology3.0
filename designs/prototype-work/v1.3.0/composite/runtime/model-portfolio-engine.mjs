import { createHash } from "node:crypto";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function required(condition, code, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
}

function summarizeCycle(state) {
  return {
    cycleId: state.cycle.cycleId,
    startedAt: state.cycle.startedAt,
    archivedAt: state.cycle.archivedAt || null,
    status: state.cycle.status,
    dataVersionId: state.data?.dataVersionId || null,
    semanticContractVersionId: state.semanticContract?.semanticContractVersionId || null,
    benchmarkRunIds: state.benchmarks.map((item) => item.benchmarkRunId),
    candidateModelVersionIds: state.candidates.map((item) => item.modelVersionId),
    insightReviewReceiptId: state.insightReview?.reviewReceiptId || null,
    shadowTrialId: state.shadowTrial?.shadowTrialId || null,
    releaseCandidateId: state.releaseCandidate?.releaseCandidateId || null,
    bindingRevisionId: state.consumerBinding?.bindingRevisionId || null,
    bindingStatus: state.consumerBinding?.status || "NOT_CREATED",
    resultPackageId: state.results?.resultPackage?.resultPackageId || null,
    resultPackageDigest: state.results?.resultPackage?.digest || null,
    operationCount: state.operationLog.length,
    touchedScenarioIds: [state.scenario.scenarioId],
    formalBaselineMutated: false,
    externalSideEffects: 0
  };
}

export function createModelPortfolioRuntime(registration) {
  required(registration?.scenario?.scenarioId, "REGISTRATION_INVALID", "A scenario registration is required.");
  required(registration?.formalBaseline?.modelVersionId, "REGISTRATION_INVALID", "A formal baseline Model Version is required.");
  required(Array.isArray(registration.objectives) && registration.objectives.length > 0, "REGISTRATION_INVALID", "At least one modeling objective is required.");

  const formalBaseline = deepFreeze(clone(registration.formalBaseline));
  const objectives = deepFreeze(clone(registration.objectives));
  const modelDefinitions = deepFreeze(clone(registration.modelDefinitions));
  const maturityWindows = deepFreeze(clone(registration.maturityWindows));
  const clockStart = Date.parse(registration.clockStart || "2026-09-02T00:00:00.000Z");
  let operationSequence = 0;
  let cycleSequence = 0;
  let archives = [];
  let bindingHistory = [];
  let state = createCycle();

  function at() {
    operationSequence += 1;
    return new Date(clockStart + operationSequence * 60_000).toISOString();
  }

  function artifactId(prefix) {
    return `${prefix}-${String(cycleSequence).padStart(3, "0")}-${String(operationSequence + 1).padStart(3, "0")}`;
  }

  function context() {
    return {
      at,
      id: artifactId,
      digest,
      scenario: clone(registration.scenario),
      formalBaseline: clone(formalBaseline),
      objectives: clone(objectives),
      modelDefinitions: clone(modelDefinitions),
      maturityWindows: clone(maturityWindows),
      state: clone(state)
    };
  }

  function createCycle(previousBinding = null) {
    cycleSequence += 1;
    const startedAt = new Date(clockStart + operationSequence * 60_000).toISOString();
    const cycleId = `${registration.cyclePrefix || "MODEL-CYCLE"}-${String(cycleSequence).padStart(3, "0")}`;
    return {
      schemaVersion: "ofw.modeling.continuous-optimization-cycle.v1",
      prototypeVersion: registration.prototypeVersion,
      scenario: clone(registration.scenario),
      cycle: {
        cycleId,
        cycleNumber: cycleSequence,
        startedAt,
        archivedAt: null,
        status: "DATA_PREPARATION",
        stage: "M02_BUILD",
        resetScope: "CURRENT_OPTIMIZATION_CYCLE_ONLY",
        historicalCyclesPreserved: true
      },
      formalBaseline: clone(formalBaseline),
      objectives: clone(objectives),
      modelDefinitions: clone(modelDefinitions),
      data: null,
      semanticContract: null,
      benchmarks: [],
      modelRuns: [],
      insights: [],
      insightHistory: [],
      insightReview: null,
      candidates: [],
      shadowTrial: null,
      releaseCandidate: null,
      consumerBinding: previousBinding ? {
        ...clone(previousBinding),
        status: "CARRIED_FORWARD",
        validationStatus: "REVALIDATION_REQUIRED",
        carriedFromBindingRevisionId: previousBinding.bindingRevisionId,
        carriedActiveCandidateModelVersionId: previousBinding.activeCandidateModelVersionId || null,
        activeCandidateModelVersionId: previousBinding.activeCandidateModelVersionId || null,
        formalModelPointerChanged: false,
        formalFactPointerChanged: false
      } : null,
      results: {
        formalEnvelope: clone(formalBaseline.resultEnvelope),
        candidateEnvelope: null,
        shadowEnvelope: null,
        simulationEnvelope: null,
        supplementalEnvelopes: [],
        resultPackage: null
      },
      holdout: {
        status: "SEALED",
        usedAt: null,
        usedByReleaseCandidateId: null,
        repeatedUseAllowed: false
      },
      operationLog: [],
      triggers: [],
      boundaries: {
        formalModelMutable: false,
        formalResultsMutable: false,
        aiMayMutateLabels: false,
        aiMaySelectChampion: false,
        aiMayPublish: false,
        nonFactMayCreateAction: false,
        externalSideEffects: 0
      }
    };
  }

  function record(action, artifactRefs, detail = null) {
    const performedAt = at();
    state.operationLog.push({
      operationId: artifactId("OP"),
      action,
      performedAt,
      artifactRefs: [...new Set((artifactRefs || []).filter(Boolean))],
      detail: clone(detail),
      formalBaselineMutated: false,
      externalSideEffects: 0
    });
    return performedAt;
  }

  function updateResultPackage() {
    if (!state.results.formalEnvelope) return;
    const envelopes = [
      state.results.formalEnvelope,
      state.results.candidateEnvelope,
      state.results.shadowEnvelope,
      state.results.simulationEnvelope,
      ...state.results.supplementalEnvelopes
    ].filter(Boolean);
    const packageCore = {
      schemaVersion: "ofw.modeling.result-package.v2",
      resultPackageId: `${state.cycle.cycleId}-RESULT-PACKAGE-${String(state.operationLog.length).padStart(2, "0")}`,
      scenario: clone(state.scenario),
      cycleId: state.cycle.cycleId,
      dataVersionId: state.data?.dataVersionId || state.formalBaseline.dataVersionId,
      semanticContractVersionId: state.semanticContract?.semanticContractVersionId || state.formalBaseline.ontologyVersionId,
      consumerBindingRevisionId: state.consumerBinding?.bindingRevisionId || null,
      formedAt: state.operationLog.at(-1)?.performedAt || state.cycle.startedAt,
      envelopes,
      viewBindings: {
        formalResultId: state.results.formalEnvelope?.resultId || null,
        candidateResultId: state.results.candidateEnvelope?.resultId || null,
        shadowResultId: state.results.shadowEnvelope?.resultId || null,
        simulationResultId: state.results.simulationEnvelope?.resultId || null,
        supplementalResultIds: state.results.supplementalEnvelopes.map((item) => item.resultId)
      },
      truthBoundary: {
        formalResultKind: "FACT",
        nonFactResultKinds: ["PREDICTION", "SHADOW", "SIMULATION"],
        formalFactsMutated: false,
        actionWriteAllowed: false,
        sideEffectsEmitted: 0
      }
    };
    state.results.resultPackage = { ...packageCore, digest: digest(packageCore) };
  }

  function nextAction() {
    if (!state.data) return { id: "build-data", moduleId: "M02", label: "构建模型评测数据", reason: "形成当前业务对象的观察数据、独立标签、关键事件和关系数据，并保留缺失原因。" };
    if (state.data.validationStatus !== "VALID") return { id: "validate-data", moduleId: "M02", label: "校验数据质量与未来信息泄漏", reason: "冻结前必须核对数据质量、观察时点和可得时间。" };
    if (!state.data.immutable) return { id: "freeze-data", moduleId: "M02", label: "冻结 DataVersion", reason: "只有冻结且可复算的数据版本才能交给 M08。" };
    if (!state.semanticContract) return { id: "create-contract", moduleId: "M01", label: "形成模型语义合同", reason: "明确对象、指标、单位、时间粒度、空值和结果身份。" };
    if (!state.benchmarks.some((item) => item.scope === "BASELINE_VALIDATION")) return { id: "benchmark-baseline", moduleId: "M08", label: "运行当前正式模型 Benchmark", reason: "先固定基线评测口径，再比较回答同一问题的 Challenger。" };
    if (!state.modelRuns.length) return { id: "run-models", moduleId: "M08", label: "运行 Challenger 与补充模型", reason: "同问题模型公平比较；补充模型按各自业务目标独立评价。" };
    if (!state.insights.length) return { id: "generate-insights", moduleId: "M08", label: "生成有证据的 AI 优化洞察", reason: "AI 只分析误判、漂移、缺失和切片，不修改标签或正式模型。" };
    if (state.insightReview?.decision === "REJECTED") return { id: "generate-insights", moduleId: "M08", label: "根据审查意见重新生成优化洞察", reason: "被驳回的洞察和审查凭证进入历史，新一批洞察使用新的不可变身份。" };
    if (state.insightReview?.decision !== "APPROVED") return { id: "review-insights", moduleId: "M08", label: "人工审查优化洞察", reason: "业务评审人必须核对证据、预期收益和风险，批准后才能创建候选版本。" };
    if (!state.candidates.length) return { id: "create-candidate", moduleId: "M08", label: "形成新的不可变候选版本", reason: "候选通过新 Model Version 产生，不在原版本上原地改权重。" };
    if (!state.shadowTrial) return { id: "start-shadow", moduleId: "M08", label: "选择候选进入 Shadow Trial", reason: "人工选择候选；影子结果不覆盖正式事实。" };
    if (state.shadowTrial.maturedWindows.length < maturityWindows.length) return { id: "advance-shadow", moduleId: "M08", label: "推进下一个标签成熟窗口", reason: "只在新标签成熟后比较候选与基线。" };
    if (!state.benchmarks.some((item) => item.scope === "MATURED_SHADOW_LABELS")) return { id: "rebenchmark", moduleId: "M08", label: "使用成熟标签重新评测", reason: "保持相同 Evaluator、指标口径和版本证据。" };
    if (!state.releaseCandidate) return { id: "form-release", moduleId: "M08", label: "形成 Release Candidate", reason: "仅封存已选候选和一次 Holdout 结果，不自动发布。" };
    if (!state.consumerBinding || state.consumerBinding.validationStatus !== "VALID") return { id: "validate-binding", moduleId: "M08", label: "校验 Dashboard Consumer Binding", reason: "检查每个视图所需的模型、字段、单位、时间和权限。" };
    if (state.consumerBinding.status !== "APPLIED") return { id: "apply-binding", moduleId: "M08", label: "人工确认应用 Dashboard Binding", reason: "只改变 Dashboard 的候选消费绑定，不改变正式模型指针。" };
    return { id: "start-next-cycle", moduleId: "M08", label: "等待新数据或标签并启动下一周期", reason: "当前周期已闭合；历史、版本和回退路径继续保留。" };
  }

  function availableActions() {
    const next = nextAction();
    return {
      primary: next,
      runStress: state.modelRuns.length > 0,
      rollbackBinding: state.consumerBinding?.status === "APPLIED",
      startNextCycle: state.consumerBinding?.status === "APPLIED",
      resetCurrentCycle: true
    };
  }

  function projection() {
    updateResultPackage();
    return clone({
      ...state,
      nextAction: nextAction(),
      availableActions: availableActions(),
      cycleHistory: archives.map(summarizeCycle),
      bindingHistory,
      parentReference: clone(registration.parentReference),
      acceptanceReady: false
    });
  }

  function action(name, payload = {}) {
    const ctx = context();
    switch (name) {
      case "build-data": {
        required(!state.data, "DATA_ALREADY_BUILT", "The current cycle already has a data build.");
        state.data = registration.buildData(ctx);
        state.cycle.stage = "M02_VALIDATE";
        state.cycle.status = "DATA_BUILT";
        record(name, [state.data.dataBuildRunId, state.data.dataVersionId], { classification: state.data.classification });
        break;
      }
      case "validate-data": {
        required(state.data, "DATA_BUILD_REQUIRED", "Build the longitudinal dataset before validation.");
        required(!state.data.immutable, "DATA_ALREADY_FROZEN", "A frozen DataVersion cannot be revalidated in place.");
        state.data = { ...state.data, ...registration.validateData({ ...ctx, data: clone(state.data) }) };
        required(state.data.validationStatus === "VALID", "DATA_VALIDATION_FAILED", "Data quality or future leakage validation failed.");
        state.cycle.stage = "M02_FREEZE";
        state.cycle.status = "DATA_VALIDATED";
        record(name, [state.data.qualityResultId, state.data.leakageCheckId]);
        break;
      }
      case "freeze-data": {
        required(state.data?.validationStatus === "VALID", "DATA_VALIDATION_REQUIRED", "Validate the DataVersion before freezing it.");
        required(!state.data.immutable, "DATA_ALREADY_FROZEN", "The DataVersion is already immutable.");
        state.data = {
          ...state.data,
          status: "FROZEN",
          immutable: true,
          frozenAt: at(),
          checksum: digest({ ...state.data, immutable: true })
        };
        state.cycle.stage = "M01_CONTRACT";
        state.cycle.status = "DATA_FROZEN";
        record(name, [state.data.dataVersionId, state.data.checksum]);
        break;
      }
      case "create-contract": {
        required(state.data?.immutable, "FROZEN_DATA_REQUIRED", "M01 requires an immutable DataVersion.");
        required(!state.semanticContract, "CONTRACT_ALREADY_CREATED", "Create a new contract version instead of mutating the current one.");
        state.semanticContract = registration.createSemanticContract({ ...ctx, data: clone(state.data) });
        state.cycle.stage = "M08_BASELINE_BENCHMARK";
        state.cycle.status = "CONTRACT_READY";
        record(name, [state.semanticContract.semanticContractVersionId, ...state.semanticContract.evidenceRefs]);
        break;
      }
      case "benchmark-baseline": {
        required(state.semanticContract, "SEMANTIC_CONTRACT_REQUIRED", "Create the semantic contract before Benchmark.");
        const benchmark = registration.benchmarkBaseline({ ...ctx, data: clone(state.data), semanticContract: clone(state.semanticContract) });
        state.benchmarks.push(benchmark);
        state.cycle.stage = "M08_MODEL_PORTFOLIO";
        state.cycle.status = "BASELINE_BENCHMARKED";
        record(name, [benchmark.benchmarkRunId, benchmark.reportId, benchmark.modelVersionId]);
        break;
      }
      case "run-models": {
        required(state.benchmarks.some((item) => item.scope === "BASELINE_VALIDATION"), "BASELINE_BENCHMARK_REQUIRED", "Run the formal baseline Benchmark first.");
        const result = registration.runModelPortfolio({ ...ctx, data: clone(state.data), semanticContract: clone(state.semanticContract), benchmarks: clone(state.benchmarks) });
        state.modelRuns = result.modelRuns;
        state.benchmarks.push(...result.benchmarks);
        state.results.candidateEnvelope = result.candidateEnvelope;
        state.results.supplementalEnvelopes = result.supplementalEnvelopes;
        state.cycle.stage = "M08_AI_INSIGHTS";
        state.cycle.status = "MODEL_PORTFOLIO_EVALUATED";
        record(name, [...result.modelRuns.map((item) => item.modelRunId), ...result.benchmarks.map((item) => item.benchmarkRunId)]);
        break;
      }
      case "generate-insights": {
        required(state.modelRuns.length > 0, "MODEL_RUNS_REQUIRED", "Run the model portfolio before generating insights.");
        required(!state.insights.length || state.insightReview?.decision === "REJECTED", "INSIGHTS_ALREADY_GENERATED", "Review the current insight batch before generating another one.");
        if (state.insights.length) {
          state.insightHistory.push({
            batchId: state.insights[0]?.batchId || state.insights[0]?.insightId || artifactId("INSIGHT-BATCH"),
            insights: clone(state.insights),
            review: clone(state.insightReview),
            archivedAt: at()
          });
        }
        state.insights = registration.generateInsights({ ...ctx, data: clone(state.data), benchmarks: clone(state.benchmarks), modelRuns: clone(state.modelRuns), results: clone(state.results) });
        const batchId = artifactId("INSIGHT-BATCH");
        state.insights = state.insights.map((item) => ({ ...item, batchId }));
        state.insightReview = null;
        state.cycle.stage = "M08_INSIGHT_REVIEW";
        state.cycle.status = "INSIGHT_REVIEW_REQUIRED";
        record(name, state.insights.map((item) => item.insightId), { generatedBy: "STRUCTURED_AI_ASSISTANT", automaticChampionSelection: false });
        break;
      }
      case "review-insights": {
        required(state.insights.length > 0, "INSIGHTS_REQUIRED", "Generate evidence-backed insights before review.");
        required(!state.insightReview, "INSIGHT_REVIEW_IMMUTABLE", "The current insight review receipt is immutable.");
        const decision = String(payload.decision || "").toUpperCase();
        required(["APPROVED", "REJECTED"].includes(decision), "REVIEW_DECISION_REQUIRED", "Review decision must be APPROVED or REJECTED.");
        required(String(payload.reviewedBy || "").trim(), "REVIEWER_REQUIRED", "A named business reviewer is required.");
        const reviewedAt = at();
        const receiptCore = {
          schemaVersion: "ofw.modeling.insight-review-receipt.v1",
          reviewReceiptId: artifactId("INSIGHT-REVIEW"),
          cycleId: state.cycle.cycleId,
          batchId: state.insights[0]?.batchId || null,
          insightRefs: state.insights.map((item) => item.insightId),
          proposedChangeDigest: digest(state.insights.map((item) => item.suggestedDiff || null)),
          decision,
          reviewedBy: String(payload.reviewedBy).trim(),
          reviewComment: String(payload.comment || "").trim(),
          reviewedAt,
          immutable: true,
          aiReviewerAllowed: false,
          candidateCreationAllowed: decision === "APPROVED",
          automaticChampionSelectionAllowed: false,
          automaticReleaseAllowed: false
        };
        state.insightReview = { ...receiptCore, receiptDigest: digest(receiptCore) };
        state.cycle.stage = decision === "APPROVED" ? "M08_CANDIDATE" : "M08_AI_INSIGHTS";
        state.cycle.status = decision === "APPROVED" ? "INSIGHTS_APPROVED" : "INSIGHTS_REJECTED";
        record(name, [state.insightReview.reviewReceiptId, state.insightReview.receiptDigest, ...state.insightReview.insightRefs], { decision, humanReviewed: true });
        break;
      }
      case "create-candidate": {
        required(state.insights.length > 0, "INSIGHTS_REQUIRED", "Evidence-backed insights are required before candidate creation.");
        required(state.insightReview?.decision === "APPROVED", "APPROVED_INSIGHT_REVIEW_REQUIRED", "An approved immutable insight review receipt is required before candidate creation.");
        const candidate = registration.createCandidate({ ...ctx, data: clone(state.data), semanticContract: clone(state.semanticContract), insights: clone(state.insights), insightReview: clone(state.insightReview), benchmarks: clone(state.benchmarks), modelRuns: clone(state.modelRuns) });
        required(!state.candidates.some((item) => item.modelVersionId === candidate.modelVersionId), "MODEL_VERSION_ID_CONFLICT", "A Model Version ID is immutable and cannot be reused.");
        state.candidates.push({
          ...candidate,
          insightReviewReceiptId: state.insightReview.reviewReceiptId,
          insightReviewDigest: state.insightReview.receiptDigest
        });
        state.results.candidateEnvelope = candidate.resultEnvelope;
        state.cycle.stage = "M08_SHADOW_SELECTION";
        state.cycle.status = "CANDIDATE_READY";
        record(name, [candidate.candidateId, candidate.modelVersionId, candidate.experimentRunId, candidate.versionDigest, state.insightReview.reviewReceiptId]);
        break;
      }
      case "start-shadow": {
        const candidate = state.candidates.find((item) => item.candidateId === payload.candidateId || item.modelVersionId === payload.modelVersionId) || state.candidates[0];
        required(candidate, "CANDIDATE_REQUIRED", "Select an immutable candidate Model Version for Shadow Trial.");
        required(!state.shadowTrial, "SHADOW_ALREADY_STARTED", "The current cycle already has a Shadow Trial.");
        state.shadowTrial = {
          schemaVersion: "ofw.modeling.shadow-trial.v1",
          shadowTrialId: artifactId("SHADOW-TRIAL"),
          shadowRunId: artifactId("SHADOW-RUN"),
          candidateId: candidate.candidateId,
          modelVersionId: candidate.modelVersionId,
          status: "ACTIVE",
          startedAt: at(),
          maturityWindows: clone(maturityWindows),
          maturedWindows: [],
          factWriteAllowed: false,
          actionWriteAllowed: false,
          actionSourceAllowed: false,
          automaticReleaseAllowed: false
        };
        state.cycle.stage = "M08_SHADOW";
        state.cycle.status = "SHADOW_ACTIVE";
        record(name, [state.shadowTrial.shadowTrialId, state.shadowTrial.shadowRunId, candidate.modelVersionId]);
        break;
      }
      case "advance-shadow": {
        required(state.shadowTrial?.status === "ACTIVE", "ACTIVE_SHADOW_REQUIRED", "Start an active Shadow Trial before advancing maturity windows.");
        const window = maturityWindows[state.shadowTrial.maturedWindows.length];
        required(window, "ALL_WINDOWS_MATURED", "All configured maturity windows are already complete.");
        const comparison = registration.evaluateShadowWindow({ ...ctx, window: clone(window), windowIndex: state.shadowTrial.maturedWindows.length, data: clone(state.data), candidate: clone(state.candidates[0]), baseline: clone(formalBaseline) });
        state.shadowTrial.maturedWindows.push(comparison);
        state.shadowTrial.status = state.shadowTrial.maturedWindows.length === maturityWindows.length ? "MATURED" : "ACTIVE";
        state.results.shadowEnvelope = comparison.shadowResultEnvelope;
        state.cycle.stage = state.shadowTrial.status === "MATURED" ? "M08_REBENCHMARK" : "M08_SHADOW";
        state.cycle.status = state.shadowTrial.status === "MATURED" ? "SHADOW_MATURED" : "SHADOW_ACTIVE";
        record(name, [comparison.windowResultId, comparison.baselineReportId, comparison.candidateReportId, comparison.shadowResultEnvelope?.resultId]);
        break;
      }
      case "rebenchmark": {
        required(state.shadowTrial?.status === "MATURED", "SHADOW_MATURITY_REQUIRED", "All configured label windows must mature before rebenchmarking.");
        const benchmark = registration.rebenchmark({ ...ctx, data: clone(state.data), candidate: clone(state.candidates[0]), shadowTrial: clone(state.shadowTrial) });
        state.benchmarks.push(benchmark);
        state.cycle.stage = "M08_RELEASE";
        state.cycle.status = "REBENCHMARKED";
        record(name, [benchmark.benchmarkRunId, benchmark.reportId, benchmark.baselineReportId, benchmark.candidateReportId]);
        break;
      }
      case "form-release": {
        required(state.benchmarks.some((item) => item.scope === "MATURED_SHADOW_LABELS"), "REBENCHMARK_REQUIRED", "Rebenchmark on matured labels before forming a Release Candidate.");
        required(state.holdout.status === "SEALED", "HOLDOUT_ALREADY_USED", "The sealed Holdout can be consumed only once.");
        const release = registration.formReleaseCandidate({ ...ctx, data: clone(state.data), semanticContract: clone(state.semanticContract), candidate: clone(state.candidates[0]), benchmarks: clone(state.benchmarks), shadowTrial: clone(state.shadowTrial) });
        state.releaseCandidate = release;
        state.holdout = { status: "CONSUMED_ONCE", usedAt: release.formedAt, usedByReleaseCandidateId: release.releaseCandidateId, repeatedUseAllowed: false };
        state.cycle.stage = "M08_BINDING_VALIDATE";
        state.cycle.status = "RELEASE_CANDIDATE_READY";
        record(name, [release.releaseCandidateId, release.modelVersionId, release.holdoutReportId]);
        break;
      }
      case "validate-binding": {
        required(state.releaseCandidate, "RELEASE_CANDIDATE_REQUIRED", "A Release Candidate is required before Binding validation.");
        const binding = registration.validateBinding({ ...ctx, data: clone(state.data), semanticContract: clone(state.semanticContract), releaseCandidate: clone(state.releaseCandidate), currentBinding: clone(state.consumerBinding) });
        state.consumerBinding = binding;
        state.cycle.stage = "M08_BINDING_APPLY";
        state.cycle.status = binding.validationStatus === "VALID" ? "BINDING_VALIDATED" : "BINDING_REJECTED";
        record(name, [binding.bindingId, binding.bindingRevisionId, binding.validationEvidenceRef], { validationStatus: binding.validationStatus });
        break;
      }
      case "apply-binding": {
        required(state.consumerBinding?.validationStatus === "VALID", "VALID_BINDING_REQUIRED", "Validate the Dashboard Consumer Binding before applying it.");
        required(payload.confirmed === true, "HUMAN_CONFIRMATION_REQUIRED", "Applying a Dashboard Binding requires explicit human confirmation.");
        const previousCandidateModelVersionId = state.consumerBinding.activeCandidateModelVersionId || null;
        state.consumerBinding = {
          ...state.consumerBinding,
          status: "APPLIED",
          appliedAt: at(),
          appliedBy: payload.confirmedBy || "当前业务评审人",
          activeCandidateModelVersionId: state.releaseCandidate.modelVersionId,
          previousCandidateModelVersionId,
          formalModelVersionId: formalBaseline.modelVersionId,
          formalModelPointerChanged: false,
          formalFactPointerChanged: false,
          applicationRole: "DASHBOARD_CONSUMER_BINDING"
        };
        bindingHistory.push(clone(state.consumerBinding));
        state.cycle.stage = "CONTINUOUS_MONITORING";
        state.cycle.status = "BINDING_APPLIED";
        record(name, [state.consumerBinding.bindingRevisionId, state.releaseCandidate.modelVersionId], { humanConfirmed: true, formalModelPointerChanged: false });
        break;
      }
      case "run-stress": {
        required(state.modelRuns.length > 0, "MODEL_RESULTS_REQUIRED", "Run the model portfolio before pressure simulation.");
        const simulation = registration.runStress({ ...ctx, data: clone(state.data), semanticContract: clone(state.semanticContract), candidate: clone(state.candidates[0] || null), results: clone(state.results), parameters: clone(payload.parameters || {}) });
        state.results.simulationEnvelope = simulation;
        record(name, [simulation.runId, simulation.resultId, ...simulation.evidenceRefs]);
        break;
      }
      case "rollback-binding": {
        required(state.consumerBinding?.status === "APPLIED", "APPLIED_BINDING_REQUIRED", "Only an applied Dashboard Binding can be rolled back.");
        const rollbackAt = at();
        const rollback = {
          rollbackId: artifactId("BINDING-ROLLBACK"),
          bindingId: state.consumerBinding.bindingId,
          fromRevisionId: state.consumerBinding.bindingRevisionId,
          fromCandidateModelVersionId: state.consumerBinding.activeCandidateModelVersionId,
          toCandidateModelVersionId: state.consumerBinding.previousCandidateModelVersionId || null,
          formalModelVersionId: formalBaseline.modelVersionId,
          rolledBackAt: rollbackAt,
          reason: payload.reason || "业务评审选择回到上一 Dashboard 候选绑定",
          formalModelPointerChanged: false,
          sideEffectsEmitted: 0
        };
        state.consumerBinding = {
          ...state.consumerBinding,
          status: "ROLLED_BACK",
          activeCandidateModelVersionId: rollback.toCandidateModelVersionId,
          rollback
        };
        bindingHistory.push(clone(state.consumerBinding));
        state.cycle.status = "BINDING_ROLLED_BACK";
        record(name, [rollback.rollbackId, rollback.fromRevisionId]);
        break;
      }
      case "start-next-cycle":
      case "reset-current-cycle": {
        const archivedAt = at();
        state.cycle.archivedAt = archivedAt;
        state.cycle.status = name === "start-next-cycle" ? "CLOSED_FOR_NEXT_CYCLE" : "RESET_ARCHIVED";
        state.triggers.push({
          triggerId: artifactId(name === "start-next-cycle" ? "NEW-DATA-LABEL-TRIGGER" : "CYCLE-RESET"),
          type: name === "start-next-cycle" ? "NEW_DATA_OR_MATURED_LABELS" : "MANUAL_CURRENT_CYCLE_RESET",
          triggeredAt: archivedAt,
          touchedScenarioIds: [state.scenario.scenarioId],
          archivedScenarioRunMutated: false,
          historicalCyclesPreserved: true
        });
        archives.push(clone(state));
        const carriedBinding = state.consumerBinding ? clone(state.consumerBinding) : null;
        state = createCycle(carriedBinding);
        break;
      }
      default:
        required(false, "ACTION_NOT_SUPPORTED", `Unsupported continuous optimization action: ${name}`);
    }
    updateResultPackage();
    return projection();
  }

  function guard(resultKind) {
    const kind = String(resultKind || "PREDICTION").toUpperCase();
    if (kind === "FACT") {
      return { status: "ALLOWED", code: null, resultKind: kind, reason: "仅正式事实可继续进入既有受控行动流程。", sideEffectsEmitted: 0 };
    }
    return {
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
    };
  }

  function consumerProjection(consumerId) {
    updateResultPackage();
    const resultPackage = clone(state.results.resultPackage);
    if (consumerId === "M04_DECISION") {
      const blocked = ["PREDICTION", "SHADOW", "SIMULATION"].map(guard);
      return {
        schemaVersion: "ofw.modeling.consumer-projection.v1",
        consumerId,
        scenario: clone(state.scenario),
        cycleId: state.cycle.cycleId,
        status: "BLOCKED_NON_FACT",
        blocked,
        resultPackageId: resultPackage?.resultPackageId || null,
        resultPackageDigest: resultPackage?.digest || null,
        sideEffectsEmitted: 0
      };
    }
    required(registration.allowedConsumers.includes(consumerId), "CONSUMER_NOT_ALLOWED", `Unknown or unsupported consumer: ${consumerId}`);
    return {
      schemaVersion: "ofw.modeling.consumer-projection.v1",
      consumerId,
      scenario: clone(state.scenario),
      cycleId: state.cycle.cycleId,
      status: resultPackage ? "AVAILABLE" : "FORMAL_ONLY",
      accessMode: "READ_ONLY",
      resultPackage,
      resultPackageId: resultPackage?.resultPackageId || null,
      resultPackageDigest: resultPackage?.digest || null,
      formalModelVersionId: formalBaseline.modelVersionId,
      activeCandidateModelVersionId: state.consumerBinding?.activeCandidateModelVersionId || state.candidates[0]?.modelVersionId || null,
      factWriteAllowed: false,
      actionWriteAllowed: false,
      sideEffectsEmitted: 0
    };
  }

  return Object.freeze({
    state: projection,
    action,
    guard,
    consumerProjection,
    formalBaseline: () => clone(formalBaseline),
    archives: () => clone(archives)
  });
}
