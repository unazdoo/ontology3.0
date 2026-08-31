export const S003_OBJECTIVE_ID = "MO-S003-DEBT-RISK-EARLY-WARNING-v1";

export const S003_BASELINE_SOURCE = Object.freeze({
  packageId: "S003-M01-DEBT-RISK-PKG",
  packageVersion: "1.0.2",
  sourceRef: "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json",
  sha256: "c1bcfdf2c61313e57233ad4ecd471e24b09535aa7f62d4bfb97741e15ec9b014",
  ownerModuleId: "M01",
  authorityMode: "READ_ONLY_SOURCE_REFERENCE",
  copiedIntoM08: false
});

export const S003_FIXED_RESULT_SOURCE = Object.freeze({
  resultSetId: "S003-C035-RISK-RESULTS-20251231-v2",
  sourceRef: "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/c035-risk-results.v2.json",
  sha256: "fbcbff5095a556293cf3ede0249c548bb9208da8a2e2f66139be418419fabf7a",
  dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
  assessmentAsOf: "2025-12-31",
  ownerModuleId: "M01",
  authorityMode: "READ_ONLY_FIXED_RESULT_SOURCE"
});

export const S003_OBJECTIVE = Object.freeze({
  resourceKind: "ModelingObjective",
  objectiveId: S003_OBJECTIVE_ID,
  revisionId: "MOR-S003-DEBT-RISK-EARLY-WARNING-0001",
  name: "企业债务风险持续预警",
  shortName: "债务风险预警",
  kind: "SCORING",
  domain: "债务风险管理",
  scenarioIds: ["S003"],
  owner: "财务公司风险管理负责人",
  status: "RESEARCH_BENCHMARK_READY",
  executionStatus: "DETERMINISTIC_LONGITUDINAL_RUNTIME_READY",
  resultKinds: ["PREDICTION"],
  businessQuestion: "哪些企业可能在未来180天发生重大债务风险，风险来自哪些指标和因子？",
  intendedUse: "支持企业风险排序、候选模型比较、影子观察和只读解释。",
  prohibitedUses: [
    "不得把预测或影子结果写成 Published FACT",
    "不得触发行动、提醒、审批、待办或交易",
    "不得用旧模型评分、风险灯、报告结论或处置状态充当监督标签"
  ],
  acceptedObjectTypes: ["Enterprise", "EnterpriseAssessmentContext"],
  ontologyVersionId: "S003-M01-DEBT-RISK-PKG@1.0.2",
  dataProductRef: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
  outcomeDataVersionId: "OUTCOME-SYN-S003-180D-v1",
  evaluationTransactionId: "BENCH-S003-LONGITUDINAL-v1",
  evaluatorVersion: "EVAL-S003-FIXED-CAPACITY-v1",
  metricSchemaVersion: "METRIC-S003-SUPERVISED-v1",
  successCriteria: [
    "固定 Top20% 处置容量下重大事件召回率可复算",
    "全部特征 availableAt 不晚于 predictionAsOf",
    "候选锁定相同 Benchmark、Split、Evaluator 和 Metric Schema",
    "标签不足时返回 INSUFFICIENT_LABELS"
  ],
  baselineModelSource: S003_BASELINE_SOURCE,
  release: {
    releaseId: "MREL-S003-DEBT-RISK-BASELINE-REFERENCE",
    modelVersionId: "MV-S003-DEBT-RISK-1.0.2-REFERENCE",
    status: "READ_ONLY_BASELINE_REFERENCE",
    published: false
  },
  binding: {
    bindingId: "MB-S003-DEBT-RISK-v1",
    revision: 1,
    status: "RESEARCH_BINDING_DRAFT"
  },
  inputContract: [
    { modelPort: "enterprise", label: "企业", objectTypeRef: "Enterprise", propertyRef: "enterpriseId", type: "object_ref", unit: "enterprise", timeGrain: "as_of", shape: "OBJECT", cardinality: "ONE_PER_SUBJECT", required: true, sourceOwner: "M01" },
    { modelPort: "industry", label: "行业", objectTypeRef: "Enterprise", propertyRef: "industry", type: "enum", unit: "industry", timeGrain: "as_of", required: true, sourceOwner: "M01" },
    { modelPort: "operatingStage", label: "经营阶段", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "operatingStage", type: "enum", unit: "operating_stage", timeGrain: "as_of", required: true, sourceOwner: "M01" },
    { modelPort: "financialIndicators", label: "当前15项财务指标", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "financialIndicatorObservations", type: "object_set", unit: "financial_indicator_observation", timeGrain: "as_of", shape: "OBJECT_SET", cardinality: "EXACTLY_15", required: true, sourceOwner: "M02" },
    { modelPort: "adjustmentFactors", label: "当前6项调节因子观测", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "adjustmentFactorObservations", type: "object_set", unit: "adjustment_factor_observation", timeGrain: "as_of", shape: "OBJECT_SET", cardinality: "EXACTLY_6", required: true, sourceOwner: "M02" },
    { modelPort: "assessmentAsOf", label: "评价时点", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "assessmentAsOf", type: "date", unit: "date", timeGrain: "as_of", required: true, sourceOwner: "M02" },
    { modelPort: "dataVersion", label: "数据版本", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "dataVersion", type: "version_ref", unit: "data_version", timeGrain: "as_of", required: true, sourceOwner: "M02" },
    { modelPort: "outcomeDataVersion", label: "结果标签版本", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "outcomeDataVersion", type: "version_ref", unit: "outcome_data_version", timeGrain: "event", required: true, sourceOwner: "M02" },
    { modelPort: "ontologyVersion", label: "本体版本", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "ontologyVersion", type: "version_ref", unit: "ontology_version", timeGrain: "as_of", required: true, sourceOwner: "M01" },
    { modelPort: "availableAt", label: "数据可得时间", objectTypeRef: "EnterpriseAssessmentContext", propertyRef: "availableAt", type: "datetime", unit: "datetime", timeGrain: "event", required: true, sourceOwner: "M02" }
  ],
  outputContract: [
    { modelPort: "riskScore", label: "预测风险评分", objectTypeRef: "EnterpriseRiskPrediction", propertyRef: "riskScore", type: "double", unit: "score_0_100", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "PRIMARY" },
    { modelPort: "riskIndex", label: "预测风险指数", objectTypeRef: "EnterpriseRiskPrediction", propertyRef: "riskIndex", type: "double", unit: "index_0_100", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "PRIMARY" },
    { modelPort: "predictedRiskTier", label: "预测风险分档", objectTypeRef: "EnterpriseRiskPrediction", propertyRef: "predictedRiskTier", type: "enum", unit: "risk_tier", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "PRIMARY" },
    { modelPort: "topContributors", label: "主要贡献项", objectTypeRef: "EnterpriseRiskPrediction", propertyRef: "topContributors", type: "object_set", unit: "risk_contribution", timeGrain: "as_of", shape: "OBJECT_SET", cardinality: "MANY", resultKind: "PREDICTION", displayRole: "EVIDENCE" },
    { modelPort: "coverage", label: "结果覆盖率", objectTypeRef: "EnterpriseRiskPrediction", propertyRef: "coverage", type: "double", unit: "ratio", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "EVIDENCE" }
  ],
  candidates: [],
  sampleResult: {
    resultId: "PRED-S003-AWAITING-DETERMINISTIC-RUN",
    resultKind: "PREDICTION",
    asOf: "2025-12-31",
    outputs: {
      riskScore: null,
      riskIndex: null,
      predictedRiskTier: null,
      topContributors: [],
      coverage: null
    },
    evidenceClass: "NO_FIXED_PREVIEW_RESULT"
  }
});
