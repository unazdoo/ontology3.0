import { getObjective, listObjectives } from "../../../v1.2.0/composite/modules/modeling/validation/src/objective-registry.mjs";
import { digest } from "./model-portfolio-engine.mjs";
import { S003_REGISTRATION } from "./s003-registration.mjs";

const PARENT_REFERENCE = Object.freeze({
  parentVersion: "v1.2.0-rc.1",
  parentCommit: "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0",
  parentSubtree: "e57caf36b4a815b4d363ca93ee69305c12228938",
  immutable: true
});

const COMMON_CONSUMERS = Object.freeze(["Dashboard", "M07_EXPLORATION", "M03_QUERY", "M05_EXPLANATION", "M06_REPORT"]);

const SPECS = Object.freeze({
  S001: Object.freeze({
    scenarioVersion: "S001-v1",
    archivedScenarioRunId: "S001-RUN-20260816081748567-705ac89fb83a",
    businessName: "融资成本洞察与结构优化",
    domain: "融资管理",
    dataAsOf: "2025-12-31",
    dataVersionId: "DATA-SYN-S001-EVAL-v1",
    semanticContractVersionId: "ONT-SYN-S001-FINANCING-v1",
    objectiveIds: ["MO-S001-COST-FORECAST-v1", "MO-S001-DEBT-STRUCTURE-OPT-v1"],
    baselineName: "融资成本当前正式模型",
    baselineModelVersionId: "MV-S001-COST-BASELINE-1.0.0",
    baselineVersion: "1.0.0",
    subjectType: "FinancingEntity",
    subjectLabel: "融资主体",
    subjectNames: ["集团融资组合", "单位553", "单位465", "单位561"],
    recordCount: 48,
    benchmarkLabels: ["预测误差", "区间覆盖率", "稳定性", "数据覆盖率"]
  }),
  S002: Object.freeze({
    scenarioVersion: "S002-v1",
    archivedScenarioRunId: "S002-RUN-20260815080000000-6ef5d0ef82f9",
    businessName: "预算风险与异常监测",
    domain: "预算管理",
    dataAsOf: "2025-12-31",
    dataVersionId: "DATA-SYN-S002-BUDGET-v1",
    semanticContractVersionId: "ONT-SYN-S002-BUDGET-v1",
    objectiveIds: ["MO-S002-BUDGET-OVERRUN-v1"],
    baselineName: "预算超支当前正式规则模型",
    baselineModelVersionId: "MV-S002-BUDGET-BASELINE-1.0.0",
    baselineVersion: "1.0.0",
    subjectType: "BudgetUnit",
    subjectLabel: "预算单元",
    subjectNames: ["总部管理费用", "信息科技费用", "市场推广费用", "运营支持费用"],
    recordCount: 36,
    benchmarkLabels: ["高风险召回率", "概率校准误差", "稳定性", "数据覆盖率"]
  }),
  S004: Object.freeze({
    scenarioVersion: "S004-v2.1.0",
    archivedScenarioRunId: "S004-RUN-20260815233000000-7f3c8e42a1b6",
    businessName: "贷前风险评估",
    domain: "信贷管理",
    dataAsOf: "2026-08-15",
    dataVersionId: "DATA-SYN-S004-PRELOAN-v1",
    semanticContractVersionId: "ONT-SYN-S004-CREDIT-v1",
    objectiveIds: ["MO-S004-PRELOAN-RISK-v1"],
    baselineName: "贷前调查当前正式模型",
    baselineModelVersionId: "MV-S004-PRELOAN-BASELINE-1.0.0",
    baselineVersion: "1.0.0",
    subjectType: "LoanApplicant",
    subjectLabel: "借款主体",
    subjectNames: ["申请主体A", "申请主体B", "申请主体C", "申请主体D"],
    recordCount: 32,
    benchmarkLabels: ["排序一致性", "关键样本召回率", "单调性", "数据覆盖率"]
  }),
  S005: Object.freeze({
    scenarioVersion: "S005-v1",
    archivedScenarioRunId: "S005-RUN-CURRENT",
    businessName: "投后评价与产品选择",
    domain: "投资管理",
    dataAsOf: "2026-07-17",
    dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
    semanticContractVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    objectiveIds: ["MO-S005-POST-INVESTMENT-RESEARCH-v1"],
    baselineName: "投后评价当前正式模型",
    baselineModelVersionId: "MV-S005-EVALUATION-BASELINE-1.0.0",
    baselineVersion: "1.0.0",
    subjectType: "InvestmentProduct",
    subjectLabel: "金融产品",
    subjectNames: ["基金A", "基金B", "基金C", "产品池组合"],
    recordCount: 79,
    benchmarkLabels: ["评价覆盖率", "排序稳定性", "压力一致性", "数据覆盖率"]
  })
});

function clone(value) {
  return structuredClone(value);
}

function score(seed, offset = 0) {
  const total = [...String(seed)].reduce((sum, char) => sum + char.charCodeAt(0), 0) + offset * 17;
  return Number((0.68 + (total % 25) / 100).toFixed(3));
}

function objectiveContracts(spec) {
  return spec.objectiveIds.map(getObjective);
}

function metricCards(spec, values) {
  return spec.benchmarkLabels.map((label, index) => ({
    id: `metric-${index + 1}`,
    label,
    value: index === 0 && /误差/.test(label) ? Number((1 - values[index]).toFixed(3)) : values[index],
    format: index === 0 && /误差/.test(label) ? "decimal" : "percent",
    direction: /误差/.test(label) ? "lower" : "higher",
    note: index === 3 ? "缺失项保留原因，不以补零代替。" : "使用同一数据版本、切分和评测口径。"
  }));
}

function resultSubjects(spec, modelVersionId, shift = 0) {
  return spec.subjectNames.map((name, index) => ({
    subjectId: `${spec.subjectType}-${String(index + 1).padStart(3, "0")}`,
    subjectName: name,
    subjectType: spec.subjectType,
    resultStatus: index === spec.subjectNames.length - 1 && spec.scenarioVersion === "S005-v1" ? "PARTIAL" : "EVALUATED",
    score: Number((62 + index * 6 + shift).toFixed(1)),
    confidence: Number((0.91 - index * 0.08).toFixed(2)),
    missingReasons: index === spec.subjectNames.length - 1 && spec.scenarioVersion === "S005-v1" ? ["部分历史观察期不足。"] : [],
    modelVersionId,
    evidenceRefs: [`${spec.dataVersionId}#subject-${index + 1}`, `${spec.semanticContractVersionId}#${spec.subjectType}`]
  }));
}

function envelope(ctx, spec, model, { resultKind, useKind, shift = 0, evidenceRefs = [], extra = {} }) {
  const formedAt = ctx.at();
  const core = {
    schemaVersion: "ofw.modeling.result-envelope.v2",
    resultId: ctx.id(`RESULT-${spec.scenarioVersion}`),
    runId: ctx.id(`MODELRUN-${spec.scenarioVersion}`),
    resultKind,
    useKind,
    scenario: clone(ctx.scenario),
    objectiveId: ctx.objectives[0].objectiveId,
    modelVersionId: model.modelVersionId,
    dataVersionId: ctx.data?.dataVersionId || spec.dataVersionId,
    semanticContractVersionId: ctx.semanticContract?.semanticContractVersionId || spec.semanticContractVersionId,
    formedAt,
    subjects: resultSubjects(spec, model.modelVersionId, shift),
    confidence: { status: "PARTIAL_EVALUATION_VISIBLE", score: 0.86, missingReasonsPreserved: true },
    evidenceRefs: [...evidenceRefs, spec.dataVersionId, spec.semanticContractVersionId],
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    formalFactsMutated: false,
    sideEffectsEmitted: 0,
    ...extra
  };
  return { ...core, digest: digest(core) };
}

function makeRegistration(scenarioId, spec) {
  const objectiveDetails = objectiveContracts(spec);
  const objectives = objectiveDetails.map((item, objectiveIndex) => ({
    objectiveId: item.objectiveId,
    name: item.name,
    kind: item.kind,
    businessQuestion: item.businessQuestion,
    intendedUse: item.intendedUse,
    resultKinds: item.resultKinds || [item.sampleResult.resultKind],
    comparisonGroup: objectiveIndex === 0 ? "PRIMARY_OBJECTIVE" : "INDEPENDENT_OBJECTIVE",
    outputIdentity: item.outputContract.map((port) => port.label).join(" / "),
    evidenceRefs: [item.dataProductRef, item.ontologyVersionId, item.evaluationTransactionId]
  }));
  const candidateDefinitions = objectiveDetails.flatMap((objective, objectiveIndex) => objective.candidates.map((candidate, candidateIndex) => ({
    modelId: candidate.candidateId,
    modelVersionId: candidate.modelVersionId,
    name: candidate.name,
    version: candidate.modelVersionId.split("-").at(-1) || "candidate",
    modelRole: objectiveIndex === 0 ? "CORE_CHALLENGER" : "SUPPLEMENTAL",
    objectiveId: objective.objectiveId,
    businessQuestion: objective.businessQuestion,
    outputIdentity: objective.outputContract.map((port) => port.label).join(" / "),
    evidenceRefs: [objective.evaluationTransactionId, objective.metricSchemaVersion],
    displayOrder: objectiveIndex * 10 + candidateIndex + 1
  })));
  const baselineModel = {
    modelId: `MODEL-${scenarioId}-BASELINE`,
    modelVersionId: spec.baselineModelVersionId,
    name: spec.baselineName,
    modelVersion: spec.baselineVersion,
    version: spec.baselineVersion,
    modelRole: "FORMAL_BASELINE",
    objectiveId: objectives[0].objectiveId,
    outputIdentity: objectives[0].outputIdentity,
    immutable: true
  };
  const formalBaseline = {
    ...baselineModel,
    dataVersionId: spec.dataVersionId,
    ontologyVersionId: spec.semanticContractVersionId,
    publishedPointerMutableByPrototype: false,
    resultEnvelope: {
      schemaVersion: "ofw.modeling.result-envelope.v2",
      resultId: `FACT-${scenarioId}-BASELINE-READONLY`,
      runId: spec.archivedScenarioRunId,
      resultKind: "FACT",
      useKind: "FORMAL_REFERENCE",
      modelVersionId: spec.baselineModelVersionId,
      dataVersionId: spec.dataVersionId,
      subjects: resultSubjects(spec, spec.baselineModelVersionId),
      immutable: true,
      evidenceRefs: [spec.archivedScenarioRunId, spec.dataVersionId, spec.semanticContractVersionId]
    }
  };
  const maturityWindows = [
    { maturityWindowId: `MW-${scenarioId}-2026-02`, label: "标签成熟窗口 1", maturedAt: "2026-02-28", newLabelCount: 6 },
    { maturityWindowId: `MW-${scenarioId}-2026-05`, label: "标签成熟窗口 2", maturedAt: "2026-05-31", newLabelCount: 6 },
    { maturityWindowId: `MW-${scenarioId}-2026-08`, label: "标签成熟窗口 3", maturedAt: "2026-08-31", newLabelCount: 6 }
  ];

  function buildData(ctx) {
    return {
      schemaVersion: "ofw.data-version.v1",
      dataBuildRunId: ctx.id(`DATABUILD-${scenarioId}`),
      dataVersionId: `${spec.dataVersionId}-C${ctx.state.cycle.cycleNumber}`,
      sourceDataVersionId: spec.dataVersionId,
      classification: "SYNTHETIC_OR_SCENARIO_CANDIDATE",
      synthetic: true,
      deidentified: true,
      recomputable: true,
      observationCount: spec.recordCount,
      subjectCount: spec.subjectNames.length,
      observationAsOf: spec.dataAsOf,
      availableAt: spec.dataAsOf,
      validationStatus: "PENDING",
      immutable: false,
      missingSummary: [{ field: "optionalHistory", reason: "部分对象观察期不足，结果保持部分评价。", affectedCount: 1 }],
      evidenceRefs: [spec.dataVersionId, ...objectiveDetails.map((item) => item.evaluationTransactionId)]
    };
  }

  function validateData(ctx) {
    return {
      validationStatus: "VALID",
      qualityResultId: ctx.id(`QUALITY-${scenarioId}`),
      leakageCheckId: ctx.id(`LEAKAGE-${scenarioId}`),
      quality: { futureLeakageRows: 0, invalidOutcomeRows: 0, labelIndependence: "PASSED", missingReasonsPreserved: true }
    };
  }

  function createSemanticContract(ctx) {
    return {
      schemaVersion: "ofw.modeling.semantic-contract.v1",
      semanticContractVersionId: `${spec.semanticContractVersionId}-C${ctx.state.cycle.cycleNumber}`,
      sourceSemanticContractVersionId: spec.semanticContractVersionId,
      immutableWithinCycle: true,
      publishedOntology: false,
      objectTypes: [...new Set(objectiveDetails.flatMap((item) => item.acceptedObjectTypes))],
      metrics: objectiveDetails.flatMap((item) => item.outputContract.map((port) => ({ propertyRef: port.propertyRef, label: port.label, unit: port.unit, timeGrain: port.timeGrain, resultKind: port.resultKind }))),
      resultIdentities: ["FACT", "PREDICTION", "SHADOW", "SIMULATION"].map((resultKind) => ({ resultKind })),
      evidenceRefs: [spec.semanticContractVersionId, ctx.data.dataVersionId]
    };
  }

  function benchmarkBaseline(ctx) {
    const values = [score(scenarioId, 1), score(scenarioId, 2), score(scenarioId, 3), 0.94];
    return {
      schemaVersion: "ofw.modeling.benchmark-run.v2",
      benchmarkRunId: ctx.id(`BENCH-${scenarioId}-BASELINE`),
      reportId: ctx.id(`BENCHREPORT-${scenarioId}-BASELINE`),
      scope: "BASELINE_VALIDATION",
      status: "EVALUATED",
      modelId: baselineModel.modelId,
      modelVersionId: baselineModel.modelVersionId,
      fixedContext: { dataVersionId: ctx.data.dataVersionId, semanticContractVersionId: ctx.semanticContract.semanticContractVersionId, evaluatorVersion: objectiveDetails[0].evaluatorVersion, metricSchemaVersion: objectiveDetails[0].metricSchemaVersion, holdoutUsed: false },
      metrics: { primaryMetric: values[0], stability: values[1], calibrationError: Number((1 - values[2]).toFixed(3)), coverage: values[3] },
      metricCards: metricCards(spec, values),
      evidenceRefs: [ctx.data.dataVersionId, ctx.semanticContract.semanticContractVersionId, objectiveDetails[0].evaluationTransactionId]
    };
  }

  function runModelPortfolio(ctx) {
    const modelRuns = candidateDefinitions.map((definition, index) => ({
      schemaVersion: "ofw.modeling.model-run.v1",
      modelRunId: ctx.id(`MODELRUN-${scenarioId}-${index + 1}`),
      modelId: definition.modelId,
      modelVersionId: definition.modelVersionId,
      objectiveId: definition.objectiveId,
      status: "SUCCEEDED",
      dataVersionId: ctx.data.dataVersionId,
      semanticContractVersionId: ctx.semanticContract.semanticContractVersionId,
      factWriteAllowed: false,
      actionWriteAllowed: false,
      evidenceRefs: definition.evidenceRefs
    }));
    const values = [score(scenarioId, 5), score(scenarioId, 6), score(scenarioId, 7), 0.92];
    const comparable = candidateDefinitions.filter((item) => item.objectiveId === objectives[0].objectiveId);
    const portfolioBenchmark = {
      schemaVersion: "ofw.modeling.benchmark-run.v2",
      benchmarkRunId: ctx.id(`BENCH-${scenarioId}-PORTFOLIO`),
      reportId: ctx.id(`BENCHREPORT-${scenarioId}-PORTFOLIO`),
      scope: "PORTFOLIO_COMPARISON",
      status: "EVALUATED",
      objectiveId: objectives[0].objectiveId,
      fixedContext: { dataVersionId: ctx.data.dataVersionId, semanticContractVersionId: ctx.semanticContract.semanticContractVersionId, evaluatorVersion: objectiveDetails[0].evaluatorVersion, metricSchemaVersion: objectiveDetails[0].metricSchemaVersion, holdoutUsed: false },
      metrics: { primaryMetric: values[0], stability: values[1], calibrationError: Number((1 - values[2]).toFixed(3)), coverage: values[3] },
      metricCards: metricCards(spec, values),
      comparableModels: [baselineModel, ...comparable].map((item, index) => ({ modelId: item.modelId, modelVersionId: item.modelVersionId, metrics: { primaryMetric: score(item.modelVersionId, index), coverage: Number((0.9 + index * 0.01).toFixed(2)) } })),
      automaticChampionSelected: false,
      evidenceRefs: modelRuns.map((item) => item.modelRunId)
    };
    const supplementalBenchmarks = objectives.slice(1).map((objective, index) => ({
      schemaVersion: "ofw.modeling.benchmark-run.v2",
      benchmarkRunId: ctx.id(`BENCH-${scenarioId}-OBJECTIVE-${index + 2}`),
      reportId: ctx.id(`BENCHREPORT-${scenarioId}-OBJECTIVE-${index + 2}`),
      scope: "SUPPLEMENTAL_OBJECTIVE",
      status: "EVALUATED",
      objectiveId: objective.objectiveId,
      crossObjectiveRankingAllowed: false,
      metrics: { coverage: 0.9, stability: score(objective.objectiveId, index) },
      metricCards: [{ id: "coverage", label: "结果覆盖率", value: 0.9, format: "percent", direction: "higher", note: "独立业务目标不跨目标排名。" }],
      evidenceRefs: modelRuns.filter((item) => item.objectiveId === objective.objectiveId).map((item) => item.modelRunId)
    }));
    const lead = candidateDefinitions[0] || baselineModel;
    return {
      modelRuns,
      benchmarks: [portfolioBenchmark, ...supplementalBenchmarks],
      candidateEnvelope: envelope(ctx, spec, lead, { resultKind: "PREDICTION", useKind: "PORTFOLIO_EVALUATION", shift: 2, evidenceRefs: [portfolioBenchmark.reportId] }),
      supplementalEnvelopes: objectives.slice(1).map((objective, index) => envelope(ctx, spec, candidateDefinitions.find((item) => item.objectiveId === objective.objectiveId) || lead, { resultKind: "PREDICTION", useKind: "SUPPLEMENTAL_OBJECTIVE", shift: index + 1, evidenceRefs: [objective.objectiveId] }))
    };
  }

  function generateInsights(ctx) {
    const portfolio = ctx.benchmarks.find((item) => item.scope === "PORTFOLIO_COMPARISON");
    return [
      {
        schemaVersion: "ofw.modeling.model-insight.v1",
        insightId: ctx.id(`INSIGHT-${scenarioId}-PERFORMANCE`),
        title: "改善最弱业务切片的稳定性",
        businessInterpretation: "当前候选在整体指标上可比较，但最弱切片仍需降低波动并保留可解释边界。",
        evidenceRefs: [portfolio?.reportId, `${portfolio?.reportId}#metricCards`].filter(Boolean),
        suggestedDiff: { operation: "CREATE_NEW_MODEL_VERSION", constraints: ["same-data-version", "same-evaluator", "explainable-change"] },
        expectedImprovement: "改善最弱切片，不预设模型有效性结论。",
        possibleRisk: "边界对象排序可能变化，必须进入影子试运行。",
        validationMethod: "同口径重新评测，并使用三个成熟标签窗口观察。"
      },
      {
        schemaVersion: "ofw.modeling.model-insight.v1",
        insightId: ctx.id(`INSIGHT-${scenarioId}-COVERAGE`),
        title: "保留缺失原因并提高可评价覆盖率",
        businessInterpretation: "部分对象观察期不足；后续候选不得把缺失值填零或伪装成完整评价。",
        evidenceRefs: [ctx.data.qualityResultId, ...ctx.data.missingSummary.map((item) => `${ctx.data.qualityResultId}#${item.field}`)],
        suggestedDiff: { operation: "NEW_DATA_VERSION_AND_MODEL_VERSION", constraints: ["availableAt-check", "missing-reason-visible"] },
        expectedImprovement: "提高覆盖率并保持结果身份清晰。",
        possibleRisk: "回补数据若晚于观察时点会造成未来信息泄漏。",
        validationMethod: "新 DataVersion 重新执行质量与泄漏校验。"
      }
    ].map((item) => ({
      ...item,
      generatedBy: "STRUCTURED_AI_ASSISTANT",
      scoreCalculationPerformed: false,
      labelMutationAllowed: false,
      formalModelMutationAllowed: false,
      benchmarkMutationAllowed: false,
      automaticChampionSelectionAllowed: false,
      releaseAllowed: false,
      actionWriteAllowed: false
    }));
  }

  function createCandidate(ctx) {
    const source = candidateDefinitions[0] || baselineModel;
    const versionCore = {
      schemaVersion: "ofw.modeling.model-version.v2",
      modelId: `MODEL-${scenarioId}-CONTROLLED-CANDIDATE`,
      modelVersionId: `${ctx.id(`MV-${scenarioId}-CANDIDATE`)}-0.2.0`,
      modelVersion: "0.2.0-candidate",
      name: `${spec.businessName}受控优化候选`,
      objectiveId: objectives[0].objectiveId,
      modelRole: "CORE_CHALLENGER",
      parentModelVersionIds: [source.modelVersionId],
      insightRefs: ctx.insights.map((item) => item.insightId),
      insightReviewReceiptId: ctx.insightReview.reviewReceiptId,
      dataVersionId: ctx.data.dataVersionId,
      semanticContractVersionId: ctx.semanticContract.semanticContractVersionId,
      immutable: true,
      published: false,
      productionEligible: false,
      createdBy: "CONTROLLED_CANDIDATE_BUILDER",
      aiRole: "evidence-backed-diff-suggestion-only"
    };
    const versionDigest = digest(versionCore);
    const experimentRunId = ctx.id(`EXPRUN-${scenarioId}-CANDIDATE`);
    const resultEnvelope = envelope(ctx, spec, { ...source, modelVersionId: versionCore.modelVersionId }, { resultKind: "PREDICTION", useKind: "CANDIDATE_EVALUATION", shift: 4, evidenceRefs: [experimentRunId, versionDigest, ctx.insightReview.reviewReceiptId] });
    return {
      schemaVersion: "ofw.modeling.candidate-model-version.v2",
      candidateId: ctx.id(`CAND-${scenarioId}`),
      ...versionCore,
      versionDigest,
      experimentRunId,
      status: "EVALUATED_AWAITING_SHADOW",
      metrics: { primaryMetric: score(versionCore.modelVersionId, 1), coverage: 0.93 },
      resultEnvelope,
      automaticChampionSelected: false,
      humanSelectionRequired: true,
      evidenceRefs: [experimentRunId, versionDigest, ctx.insightReview.reviewReceiptId]
    };
  }

  function evaluateShadowWindow(ctx) {
    const windowResultId = ctx.id(`SHADOW-WINDOW-${scenarioId}`);
    return {
      windowResultId,
      maturityWindowId: ctx.window.maturityWindowId,
      label: ctx.window.label,
      maturedAt: ctx.window.maturedAt,
      newMaturedLabelCount: ctx.window.newLabelCount,
      cumulativeMaturedLabelCount: (ctx.windowIndex + 1) * ctx.window.newLabelCount,
      baselineReportId: ctx.id(`SHADOW-BASELINE-${scenarioId}`),
      candidateReportId: ctx.id(`SHADOW-CANDIDATE-${scenarioId}`),
      baselineMetrics: { primaryMetric: score(spec.baselineModelVersionId, ctx.windowIndex) },
      candidateMetrics: { primaryMetric: score(ctx.candidate.modelVersionId, ctx.windowIndex + 2) },
      shadowResultEnvelope: envelope(ctx, spec, ctx.candidate, { resultKind: "SHADOW", useKind: "SHADOW_TRIAL", shift: 3 + ctx.windowIndex, evidenceRefs: [ctx.window.maturityWindowId, windowResultId] }),
      automaticReleaseTriggered: false,
      formalFactsMutated: false
    };
  }

  function rebenchmark(ctx) {
    const values = [score(ctx.candidate.modelVersionId, 8), score(ctx.candidate.modelVersionId, 9), score(ctx.candidate.modelVersionId, 10), 0.93];
    return {
      schemaVersion: "ofw.modeling.benchmark-run.v2",
      benchmarkRunId: ctx.id(`BENCH-${scenarioId}-MATURED`),
      reportId: ctx.id(`BENCHREPORT-${scenarioId}-MATURED`),
      baselineReportId: ctx.id(`BENCHREPORT-${scenarioId}-MATURED-BASELINE`),
      candidateReportId: ctx.id(`BENCHREPORT-${scenarioId}-MATURED-CANDIDATE`),
      scope: "MATURED_SHADOW_LABELS",
      status: "EVALUATED",
      fixedContext: { dataVersionId: ctx.data.dataVersionId, semanticContractVersionId: ctx.state.semanticContract.semanticContractVersionId, evaluatorVersion: objectiveDetails[0].evaluatorVersion, metricSchemaVersion: objectiveDetails[0].metricSchemaVersion, holdoutUsed: false },
      metrics: { primaryMetric: values[0], stability: values[1], calibrationError: Number((1 - values[2]).toFixed(3)), coverage: values[3] },
      metricCards: metricCards(spec, values),
      evidenceRefs: ctx.shadowTrial.maturedWindows.map((item) => item.windowResultId)
    };
  }

  function formReleaseCandidate(ctx) {
    return {
      schemaVersion: "ofw.modeling.release-candidate.v1",
      releaseCandidateId: ctx.id(`RC-${scenarioId}`),
      modelVersionId: ctx.candidate.modelVersionId,
      formedAt: ctx.at(),
      holdoutReportId: ctx.id(`HOLDOUT-${scenarioId}`),
      holdoutMetrics: { primaryMetric: score(ctx.candidate.modelVersionId, 12), coverage: 0.92 },
      published: false,
      productionEligible: false,
      automaticReleaseAllowed: false,
      evidenceRefs: [ctx.candidate.versionDigest, ...ctx.shadowTrial.maturedWindows.map((item) => item.windowResultId)]
    };
  }

  function validateBinding(ctx) {
    const revision = Number(ctx.currentBinding?.revision || 0) + 1;
    return {
      schemaVersion: "ofw.modeling.consumer-binding.v2",
      bindingId: `CB-${scenarioId}-DASHBOARD-MODEL-RESULTS`,
      bindingRevisionId: `CB-${scenarioId}-DASHBOARD-MODEL-RESULTS-R${revision}`,
      revision,
      status: "VALIDATED",
      validationStatus: "VALID",
      validationEvidenceRef: ctx.id(`BINDING-VALIDATION-${scenarioId}`),
      releaseCandidateId: ctx.releaseCandidate.releaseCandidateId,
      formalModelVersionId: baselineModel.modelVersionId,
      activeCandidateModelVersionId: null,
      viewMappings: ["FORMAL", "CANDIDATE", "SHADOW", "SIMULATION", "DIFF"].map((view) => ({ view, status: "VALID" })),
      formalModelPointerChanged: false,
      formalFactPointerChanged: false,
      sideEffectsEmitted: 0
    };
  }

  function runStress(ctx) {
    const model = ctx.candidate || candidateDefinitions[0] || baselineModel;
    return envelope(ctx, spec, model, { resultKind: "SIMULATION", useKind: "STRESS", shift: 7, evidenceRefs: [`STRESS-PARAMS:${digest(ctx.parameters || {})}`], extra: { parameters: ctx.parameters || {}, simulationReplacesFact: false } });
  }

  return Object.freeze({
    prototypeVersion: "v1.3.0-rc.1",
    clockStart: "2026-09-02T00:00:00.000Z",
    cyclePrefix: `CYCLE-${scenarioId}-MODEL-20260902`,
    parentReference: PARENT_REFERENCE,
    scenario: {
      scenarioId,
      scenarioVersion: spec.scenarioVersion,
      archivedScenarioRunId: spec.archivedScenarioRunId,
      archivedScenarioMutable: false,
      businessName: spec.businessName,
      domain: spec.domain,
      dataAsOf: spec.dataAsOf,
      subjectLabel: spec.subjectLabel
    },
    formalBaseline,
    objectives,
    modelDefinitions: [baselineModel, ...candidateDefinitions],
    maturityWindows,
    allowedConsumers: [...COMMON_CONSUMERS],
    seedActions: [],
    capabilities: { currentCycleReset: true, nextCycleStart: true, pressureSimulation: true, rollback: true },
    ui: { moduleName: "模型优化中心", domain: spec.domain, businessName: spec.businessName, subjectLabel: spec.subjectLabel, consumerLabel: `${spec.businessName}驾驶舱` },
    buildData,
    validateData,
    createSemanticContract,
    benchmarkBaseline,
    runModelPortfolio,
    generateInsights,
    createCandidate,
    evaluateShadowWindow,
    rebenchmark,
    formReleaseCandidate,
    validateBinding,
    runStress
  });
}

const S003_WITH_PLATFORM_METADATA = Object.freeze({
  ...S003_REGISTRATION,
  capabilities: Object.freeze({ currentCycleReset: true, nextCycleStart: true, pressureSimulation: true, rollback: true }),
  seedActions: Object.freeze([]),
  ui: Object.freeze({ moduleName: "模型优化中心", domain: "债务风险管理", businessName: "债务风险智能监测", subjectLabel: "企业", consumerLabel: "债务风险监测驾驶舱" })
});

export const SCENARIO_MODEL_REGISTRATIONS = Object.freeze({
  S001: makeRegistration("S001", SPECS.S001),
  S002: makeRegistration("S002", SPECS.S002),
  S003: S003_WITH_PLATFORM_METADATA,
  S004: makeRegistration("S004", SPECS.S004),
  S005: makeRegistration("S005", SPECS.S005)
});

export function getScenarioModelRegistration(scenarioId) {
  return SCENARIO_MODEL_REGISTRATIONS[String(scenarioId || "") ] || null;
}

export function listScenarioModelRegistrations() {
  const summaries = listObjectives();
  return Object.values(SCENARIO_MODEL_REGISTRATIONS).map((registration) => ({
    scenario: clone(registration.scenario),
    objectiveCount: registration.objectives.length,
    modelCount: registration.modelDefinitions.length,
    objectiveIds: summaries.filter((item) => item.scenarioIds.includes(registration.scenario.scenarioId)).map((item) => item.objectiveId),
    capabilities: clone(registration.capabilities)
  }));
}
