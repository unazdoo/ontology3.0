import { NAMESPACE } from "./constants.mjs";
import { assertContract } from "./errors.mjs";
import { sha256 } from "./hash.mjs";

const FORBIDDEN_BINDING_KEYS = /endpoint|credential|secret|token|container|url|targetRid/i;

const CONSUMERS = Object.freeze({
  M07_EXPLORATION: {
    consumerId: "M07_EXPLORATION",
    moduleId: "exploration",
    name: "探索分析",
    allowed: true,
    permissionScope: "prediction.read",
    displayModes: {
      FORECAST: "TIMELINE_OVERLAY",
      CLASSIFICATION: "OBJECT_BADGE",
      SCORING: "OBJECT_SCORE",
      OPTIMIZATION: "OPTION_COMPARISON"
    },
    fieldPolicy: "ALL_DISPLAYABLE"
  },
  M06_REPORT: {
    consumerId: "M06_REPORT",
    moduleId: "report",
    name: "报告中心",
    allowed: true,
    permissionScope: "prediction.read",
    displayModes: { DEFAULT: "REPORT_EVIDENCE_TABLE" },
    fieldPolicy: "ALL_DISPLAYABLE"
  },
  M03_QUERY: {
    consumerId: "M03_QUERY",
    moduleId: "query",
    name: "智能问数",
    allowed: true,
    permissionScope: "prediction.read",
    displayModes: { DEFAULT: "ANSWER_EVIDENCE_CARD" },
    fieldPolicy: "PRIMARY_AND_RANGE"
  },
  M05_AGENT: {
    consumerId: "M05_AGENT",
    moduleId: "agent",
    name: "Agent 应用",
    allowed: true,
    permissionScope: "prediction.read",
    displayModes: { DEFAULT: "EXPLANATION_PANEL" },
    fieldPolicy: "ALL_DISPLAYABLE"
  },
  M04_DECISION: {
    consumerId: "M04_DECISION",
    moduleId: "decision",
    name: "决策中心",
    allowed: false,
    permissionScope: null,
    displayModes: {},
    fieldPolicy: "NONE",
    blockedCode: "NON_FACT_SOURCE_REJECTED",
    blockedReason: "预测和优化候选不能直接创建行动申请；必须回到最新真实事实并经过独立人工流程。"
  }
});

const OBJECTIVES = Object.freeze([
  {
    resourceKind: "ModelingObjective",
    objectiveId: "MO-S001-COST-FORECAST-v1",
    revisionId: "MOR-S001-COST-FORECAST-0001",
    name: "融资成本预测",
    shortName: "成本预测",
    kind: "FORECAST",
    domain: "融资管理",
    scenarioIds: ["S001"],
    owner: "集团融资管理负责人",
    status: "RESEARCH_EVALUATED",
    executionStatus: "SYNTHETIC_PREVIEW_READY",
    businessQuestion: "未来 6 个月融资成本可能落在什么区间？",
    intendedUse: "支持融资成本趋势核查、预算测算和压力情景准备。",
    prohibitedUses: ["不得替代真实融资定价", "不得直接创建交易或行动申请"],
    acceptedObjectTypes: ["FinancingEntity", "FinancingPortfolio"],
    ontologyVersionId: "ONT-SYN-S001-FINANCING-v1",
    dataProductRef: "DATA-SYN-S001-EVAL-v1",
    evaluationTransactionId: "TX-SYN-S001-COST-FORECAST-0001",
    evaluatorVersion: "EVAL-FORECAST-CONTRACT-v1",
    metricSchemaVersion: "METRIC-FORECAST-v1",
    successCriteria: ["MAE <= 0.15 个百分点", "区间覆盖率 >= 90%", "相同输入可复算"],
    release: { releaseId: "MREL-S001-COST-FORECAST-RC1", modelVersionId: "MV-S001-COST-FORECAST-0001", status: "RESEARCH_RELEASE_CANDIDATE", published: false },
    binding: { bindingId: "MB-S001-COST-FORECAST-v1", revision: 1, status: "VALIDATED_RESEARCH_BINDING_REQUIRES_M01_CR" },
    inputContract: [
      { modelPort: "weightedAverageCost", label: "加权平均融资成本", objectTypeRef: "FinancingEntity", propertyRef: "weightedAverageFinancingCost", type: "double", unit: "percent", timeGrain: "month", required: true, sourceOwner: "M02" },
      { modelPort: "floatingRateExposure", label: "浮动利率余额占比", objectTypeRef: "FinancingEntity", propertyRef: "floatingRateBalanceRatio", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "shortTermDebtRatio", label: "短期债务余额占比", objectTypeRef: "FinancingEntity", propertyRef: "shortTermDebtRatio", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "benchmarkRateSeries", label: "基准利率序列", objectTypeRef: "MarketRate", propertyRef: "benchmarkRate", type: "double", unit: "percent", timeGrain: "month", required: true, sourceOwner: "M02" }
    ],
    outputContract: [
      { modelPort: "predictedCost", label: "预测融资成本", objectTypeRef: "FinancingCostPrediction", propertyRef: "predictedCost", type: "double", unit: "percent", timeGrain: "horizon_month", resultKind: "PREDICTION", displayRole: "PRIMARY" },
      { modelPort: "lowerBound", label: "预测区间下界", objectTypeRef: "FinancingCostPrediction", propertyRef: "lowerBound", type: "double", unit: "percent", timeGrain: "horizon_month", resultKind: "PREDICTION", displayRole: "RANGE" },
      { modelPort: "upperBound", label: "预测区间上界", objectTypeRef: "FinancingCostPrediction", propertyRef: "upperBound", type: "double", unit: "percent", timeGrain: "horizon_month", resultKind: "PREDICTION", displayRole: "RANGE" },
      { modelPort: "coverage", label: "结果覆盖率", objectTypeRef: "FinancingCostPrediction", propertyRef: "coverage", type: "double", unit: "ratio", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "EVIDENCE" }
    ],
    candidates: [
      { candidateId: "CM-S001-COST-TREND-v1", name: "趋势基线候选", modelVersionId: "MV-S001-COST-TREND-0001", status: "EVALUATED", primaryMetric: "MAE 0.12pp" },
      { candidateId: "CM-S001-COST-DRIVER-v1", name: "驱动因子候选", modelVersionId: "MV-S001-COST-DRIVER-0001", status: "UNDER_REVIEW", primaryMetric: "MAE 0.10pp" }
    ],
    sampleResult: {
      resultId: "PRED-S001-COST-PREVIEW-0001",
      resultKind: "PREDICTION",
      asOf: "2025-12-31",
      horizon: "6 个月",
      outputs: { predictedCost: 2.96, lowerBound: 2.81, upperBound: 3.12, coverage: 0.94 },
      evidenceClass: "SYNTHETIC_CONTRACT_PREVIEW"
    }
  },
  {
    resourceKind: "ModelingObjective",
    objectiveId: "MO-S001-DEBT-STRUCTURE-OPT-v1",
    revisionId: "MOR-S001-DEBT-STRUCTURE-OPT-0001",
    name: "债务结构优化",
    shortName: "结构优化",
    kind: "OPTIMIZATION",
    domain: "融资管理",
    scenarioIds: ["S001"],
    owner: "集团融资管理负责人",
    status: "CONTRACT_READY",
    executionStatus: "SYNTHETIC_PREVIEW_ONLY",
    businessQuestion: "在成本、期限和流动性约束下有哪些可行债务结构？",
    intendedUse: "比较满足全部约束的候选融资结构。",
    prohibitedUses: ["不得自动执行融资交易", "不得把候选方案升级为事实"],
    acceptedObjectTypes: ["FinancingPortfolio"],
    ontologyVersionId: "ONT-SYN-S001-FINANCING-v1",
    dataProductRef: "DATA-SYN-S001-DEBT-PORTFOLIO-v1",
    evaluationTransactionId: "TX-SYN-S001-DEBT-OPT-0001",
    evaluatorVersion: "EVAL-OPT-CONSTRAINT-v1",
    metricSchemaVersion: "METRIC-OPTIMIZATION-v1",
    successCriteria: ["全部硬约束满足", "可行方案可复算", "成本改善不以风险越界换取"],
    release: { releaseId: "MREL-S001-DEBT-OPT-DRAFT", modelVersionId: "MV-S001-DEBT-OPT-0001", status: "DRAFT_RESEARCH_RELEASE", published: false },
    binding: { bindingId: "MB-S001-DEBT-OPT-v1", revision: 1, status: "DRAFT_REQUIRES_M01_CR" },
    inputContract: [
      { modelPort: "portfolio", label: "当前融资组合", objectTypeRef: "FinancingPortfolio", propertyRef: "instruments", type: "object_set", unit: "financing_instrument", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "costCeiling", label: "成本上限", objectTypeRef: "DebtOptimizationConstraint", propertyRef: "costCeiling", type: "double", unit: "percent", timeGrain: "as_of", required: true, sourceOwner: "业务 Owner" },
      { modelPort: "liquidityFloor", label: "流动性下限", objectTypeRef: "DebtOptimizationConstraint", propertyRef: "liquidityFloor", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "业务 Owner" }
    ],
    outputContract: [
      { modelPort: "optionSet", label: "可行方案集", objectTypeRef: "DebtStructureOptionSet", propertyRef: "options", type: "object_set", unit: "debt_structure_option", timeGrain: "as_of", resultKind: "SIMULATION", outputKind: "OPTIMIZATION_CANDIDATE", displayRole: "PRIMARY" },
      { modelPort: "expectedCost", label: "预期融资成本", objectTypeRef: "DebtStructureOption", propertyRef: "expectedCost", type: "double", unit: "percent", timeGrain: "as_of", resultKind: "SIMULATION", outputKind: "OPTIMIZATION_CANDIDATE", displayRole: "PRIMARY" },
      { modelPort: "constraintStatus", label: "约束状态", objectTypeRef: "DebtStructureOption", propertyRef: "constraintStatus", type: "enum", unit: "constraint_status", timeGrain: "as_of", resultKind: "SIMULATION", outputKind: "OPTIMIZATION_CANDIDATE", displayRole: "EVIDENCE" }
    ],
    candidates: [
      { candidateId: "CM-S001-DEBT-LINEAR-v1", name: "线性优化候选", modelVersionId: "MV-S001-DEBT-LINEAR-0001", status: "CONTRACT_VALIDATED", primaryMetric: "3 个可行方案" },
      { candidateId: "CM-S001-DEBT-ROBUST-v1", name: "稳健优化候选", modelVersionId: "MV-S001-DEBT-ROBUST-0001", status: "DRAFT", primaryMetric: "待评估" }
    ],
    sampleResult: {
      resultId: "PRED-S001-DEBT-OPT-PREVIEW-0001",
      resultKind: "SIMULATION",
      outputKind: "OPTIMIZATION_CANDIDATE",
      asOf: "2025-12-31",
      outputs: { optionSet: 3, expectedCost: 2.31, constraintStatus: "ALL_HARD_CONSTRAINTS_SATISFIED" },
      evidenceClass: "SYNTHETIC_CONTRACT_PREVIEW"
    }
  },
  {
    resourceKind: "ModelingObjective",
    objectiveId: "MO-S002-BUDGET-OVERRUN-v1",
    revisionId: "MOR-S002-BUDGET-OVERRUN-0001",
    name: "预算超支预警",
    shortName: "超支预警",
    kind: "CLASSIFICATION",
    domain: "预算管理",
    scenarioIds: ["S002"],
    owner: "预算监督负责人",
    status: "CONTRACT_READY",
    executionStatus: "SYNTHETIC_PREVIEW_ONLY",
    businessQuestion: "当前预算单元在期末发生超支的风险等级是什么？",
    intendedUse: "支持预算核查排序和解释，不替代预算调整审批。",
    prohibitedUses: ["不得自动调增预算", "不得直接创建整改待办"],
    acceptedObjectTypes: ["BudgetUnit"],
    ontologyVersionId: "ONT-SYN-S002-BUDGET-v1",
    dataProductRef: "DATA-SYN-S002-BUDGET-v1",
    evaluationTransactionId: "TX-SYN-S002-BUDGET-0001",
    evaluatorVersion: "EVAL-CLASSIFICATION-v1",
    metricSchemaVersion: "METRIC-CLASSIFICATION-v1",
    successCriteria: ["召回率 >= 85%", "概率校准误差 <= 0.08", "UNKNOWN 不当作低风险"],
    release: { releaseId: "MREL-S002-BUDGET-DRAFT", modelVersionId: "MV-S002-BUDGET-0001", status: "DRAFT_RESEARCH_RELEASE", published: false },
    binding: { bindingId: "MB-S002-BUDGET-OVERRUN-v1", revision: 1, status: "DRAFT_REQUIRES_M01_CR" },
    inputContract: [
      { modelPort: "executionRate", label: "预算执行率", objectTypeRef: "BudgetUnit", propertyRef: "executionRate", type: "double", unit: "ratio", timeGrain: "month", required: true, sourceOwner: "M02" },
      { modelPort: "committedAmount", label: "已承诺金额", objectTypeRef: "BudgetUnit", propertyRef: "committedAmount", type: "double", unit: "cny", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "remainingPlan", label: "剩余期间计划", objectTypeRef: "BudgetUnit", propertyRef: "remainingPlanAmount", type: "double", unit: "cny", timeGrain: "as_of", required: true, sourceOwner: "M02" }
    ],
    outputContract: [
      { modelPort: "overrunProbability", label: "超支概率", objectTypeRef: "BudgetRiskPrediction", propertyRef: "overrunProbability", type: "double", unit: "ratio", timeGrain: "period_end", resultKind: "PREDICTION", displayRole: "PRIMARY" },
      { modelPort: "riskLevel", label: "风险等级", objectTypeRef: "BudgetRiskPrediction", propertyRef: "riskLevel", type: "enum", unit: "risk_level", timeGrain: "period_end", resultKind: "PREDICTION", displayRole: "PRIMARY" },
      { modelPort: "coverage", label: "结果覆盖率", objectTypeRef: "BudgetRiskPrediction", propertyRef: "coverage", type: "double", unit: "ratio", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "EVIDENCE" }
    ],
    candidates: [
      { candidateId: "CM-S002-BUDGET-LOGIT-v1", name: "可解释分类候选", modelVersionId: "MV-S002-BUDGET-LOGIT-0001", status: "CONTRACT_VALIDATED", primaryMetric: "召回率 87%" },
      { candidateId: "CM-S002-BUDGET-TREE-v1", name: "树模型候选", modelVersionId: "MV-S002-BUDGET-TREE-0001", status: "DRAFT", primaryMetric: "待评估" }
    ],
    sampleResult: {
      resultId: "PRED-S002-BUDGET-PREVIEW-0001",
      resultKind: "PREDICTION",
      asOf: "2025-12-31",
      outputs: { overrunProbability: 0.78, riskLevel: "HIGH", coverage: 1 },
      evidenceClass: "SYNTHETIC_CONTRACT_PREVIEW"
    }
  },
  {
    resourceKind: "ModelingObjective",
    objectiveId: "MO-S004-PRELOAN-RISK-v1",
    revisionId: "MOR-S004-PRELOAN-RISK-0001",
    name: "贷前风险评价",
    shortName: "贷前评价",
    kind: "SCORING",
    domain: "信贷管理",
    scenarioIds: ["S004"],
    owner: "贷前调查负责人",
    status: "CONTRACT_READY",
    executionStatus: "SYNTHETIC_PREVIEW_ONLY",
    businessQuestion: "借款主体的预测风险评分和人工复核建议是什么？",
    intendedUse: "辅助贷前调查材料排序和风险解释。",
    prohibitedUses: ["不得自动授信或拒贷", "不得替代人工调查结论"],
    acceptedObjectTypes: ["LoanApplicant"],
    ontologyVersionId: "ONT-SYN-S004-CREDIT-v1",
    dataProductRef: "DATA-SYN-S004-PRELOAN-v1",
    evaluationTransactionId: "TX-SYN-S004-PRELOAN-0001",
    evaluatorVersion: "EVAL-SCORING-v1",
    metricSchemaVersion: "METRIC-SCORING-v1",
    successCriteria: ["评分范围稳定", "缺失关键维度时阻断", "人工复核标志可解释"],
    release: { releaseId: "MREL-S004-PRELOAN-DRAFT", modelVersionId: "MV-S004-PRELOAN-0001", status: "DRAFT_RESEARCH_RELEASE", published: false },
    binding: { bindingId: "MB-S004-PRELOAN-RISK-v1", revision: 1, status: "DRAFT_REQUIRES_M01_CR" },
    inputContract: [
      { modelPort: "leverageRatio", label: "资产负债率", objectTypeRef: "LoanApplicant", propertyRef: "leverageRatio", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "operatingCashFlow", label: "经营现金流", objectTypeRef: "LoanApplicant", propertyRef: "operatingCashFlow", type: "double", unit: "cny", timeGrain: "year", required: true, sourceOwner: "M02" },
      { modelPort: "collateralCoverage", label: "抵质押覆盖率", objectTypeRef: "LoanApplicant", propertyRef: "collateralCoverageRatio", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "M02" }
    ],
    outputContract: [
      { modelPort: "riskScore", label: "预测风险评分", objectTypeRef: "PreloanRiskPrediction", propertyRef: "riskScore", type: "double", unit: "score_0_100", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "PRIMARY" },
      { modelPort: "riskGrade", label: "预测风险等级", objectTypeRef: "PreloanRiskPrediction", propertyRef: "riskGrade", type: "enum", unit: "risk_grade", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "PRIMARY" },
      { modelPort: "reviewRequired", label: "建议人工复核", objectTypeRef: "PreloanRiskPrediction", propertyRef: "reviewRequired", type: "boolean", unit: "boolean", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "EVIDENCE" }
    ],
    candidates: [
      { candidateId: "CM-S004-PRELOAN-SCORE-v1", name: "可解释评分候选", modelVersionId: "MV-S004-PRELOAN-SCORE-0001", status: "CONTRACT_VALIDATED", primaryMetric: "单调性 100%" },
      { candidateId: "CM-S004-PRELOAN-ENSEMBLE-v1", name: "组合评分候选", modelVersionId: "MV-S004-PRELOAN-ENSEMBLE-0001", status: "DRAFT", primaryMetric: "待评估" }
    ],
    sampleResult: {
      resultId: "PRED-S004-PRELOAN-PREVIEW-0001",
      resultKind: "PREDICTION",
      asOf: "2026-08-15",
      outputs: { riskScore: 68.4, riskGrade: "B", reviewRequired: true },
      evidenceClass: "SYNTHETIC_CONTRACT_PREVIEW"
    }
  },
  {
    resourceKind: "ModelingObjective",
    objectiveId: "MO-S005-POST-INVESTMENT-RESEARCH-v1",
    revisionId: "MOR-S005-POST-INVESTMENT-0001",
    name: "金融产品投后评价",
    shortName: "投后评价",
    kind: "SCORING",
    domain: "投资管理",
    scenarioIds: ["S005"],
    owner: "投后评价负责人",
    status: "CONTRACT_READY",
    executionStatus: "ISOLATED_RUN_READY",
    resultKinds: ["PREDICTION", "SIMULATION"],
    businessQuestion: "当前金融产品的评价分数、覆盖情况和压力影响是什么？",
    intendedUse: "支持投后评价、池内比较和压力情景核查。",
    prohibitedUses: ["不得把预测或模拟结果覆盖为业务事实", "不得自动生成交易指令"],
    acceptedObjectTypes: ["InvestmentProduct"],
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    dataProductRef: "S005-DATA-AUDIT-79-SNAPSHOTS",
    evaluationTransactionId: "TX-SYN-S005-EVAL-0001",
    evaluatorVersion: "EVAL-M08-DETERMINISTIC-v1",
    metricSchemaVersion: "METRIC-ENGINEERING-FITNESS-v1",
    successCriteria: ["关键维度缺失时阻断", "相同输入可复算", "预测与模拟结果身份分离"],
    release: { releaseId: "MREL-S005-POST-INVESTMENT-DRAFT", modelVersionId: "MV-S005-BALANCED-0001", status: "DRAFT_RESEARCH_RELEASE", published: false },
    binding: { bindingId: "MB-S005-EVALUATION-v1", revision: 1, status: "DRAFT_REQUIRES_M01_CR" },
    inputContract: [
      { modelPort: "returnRatio", label: "区间收益率", objectTypeRef: "InvestmentProduct", propertyRef: "ytdReturnRatio", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "concentrationRatio", label: "最大持仓占比", objectTypeRef: "InvestmentPortfolio", propertyRef: "largestPositionRatio", type: "double", unit: "ratio", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "liquidityScore", label: "流动性评价", objectTypeRef: "InvestmentProduct", propertyRef: "liquidityAssessment", type: "double", unit: "score_0_1", timeGrain: "as_of", required: true, sourceOwner: "M02" },
      { modelPort: "ratingScore", label: "信用质量评价", objectTypeRef: "InvestmentProduct", propertyRef: "creditQualityAssessment", type: "double", unit: "score_0_5", timeGrain: "as_of", required: true, sourceOwner: "M02" }
    ],
    outputContract: [
      { modelPort: "score", label: "预测评价分数", objectTypeRef: "InvestmentEvaluation", propertyRef: "predictedEvaluationScore", type: "double", unit: "score_0_100", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "PRIMARY" },
      { modelPort: "coverage", label: "预测结果覆盖率", objectTypeRef: "InvestmentEvaluation", propertyRef: "predictedEvaluationCoverage", type: "double", unit: "ratio", timeGrain: "as_of", resultKind: "PREDICTION", displayRole: "EVIDENCE" }
    ],
    candidates: [
      { candidateId: "CM-S005-BALANCED-v1", name: "均衡评价候选", modelVersionId: "MV-S005-BALANCED-0001", status: "EVALUATED", primaryMetric: "覆盖率 80%" },
      { candidateId: "CM-S005-CONSERVATIVE-v1", name: "审慎评价候选", modelVersionId: "MV-S005-CONSERVATIVE-0001", status: "UNDER_REVIEW", primaryMetric: "待人工复核" }
    ],
    sampleResult: {
      resultId: "PRED-S005-POST-INVESTMENT-0001",
      resultKind: "PREDICTION",
      asOf: "2026-07-17",
      outputs: { score: 72.4, coverage: 0.8 },
      evidenceClass: "CONTROLLED_RESULT_PREVIEW"
    }
  }
]);

function clone(value) {
  return structuredClone(value);
}

function baseType(ref) {
  return String(ref || "").split("@")[0];
}

function objectiveById(objectiveId) {
  const objective = OBJECTIVES.find((item) => item.objectiveId === objectiveId);
  assertContract(objective, "OBJECTIVE_NOT_FOUND", `Unknown modeling objective: ${objectiveId}`);
  return objective;
}

function containsForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    if (key === "concreteEndpointExposed") return child !== false;
    return FORBIDDEN_BINDING_KEYS.test(key) || containsForbiddenKey(child);
  });
}

function normalizedPort(item, direction) {
  const shape = item.shape || (item.type === "object_set" ? "OBJECT_SET" : ["month", "horizon_month"].includes(item.timeGrain) ? "TIME_SERIES" : "SCALAR");
  const semanticKind = item.semanticKind || (direction === "input"
    ? shape === "TIME_SERIES" ? "ONTOLOGY_SERIES" : shape === "OBJECT_SET" ? "OBJECT_SET" : "ONTOLOGY_PROPERTY"
    : shape === "TIME_SERIES" ? "RESULT_SERIES" : shape === "OBJECT_SET" ? "RESULT_SET" : "RESULT_OBJECT_FIELD");
  return {
    ...item,
    role: item.role || (direction === "input" ? "FEATURE" : item.displayRole || "OUTPUT"),
    semanticKind,
    shape,
    cardinality: item.cardinality || (shape === "OBJECT_SET" ? "MANY" : "ONE_PER_SUBJECT"),
    nullable: item.nullable === true
  };
}

function bindingDraft(objective) {
  return {
    resourceKind: "ModelBinding",
    bindingId: objective.binding.bindingId,
    bindingRevisionId: `${objective.binding.bindingId}-R${objective.binding.revision}`,
    bindingRevision: objective.binding.revision,
    status: objective.binding.status,
    objectiveId: objective.objectiveId,
    objectiveRevisionId: objective.revisionId,
    publishedOntologyRef: objective.ontologyVersionId,
    inputMappings: objective.inputContract.map((item) => normalizedPort(item, "input")),
    outputMappings: objective.outputContract.map((item) => normalizedPort(item, "output")),
    releaseSelector: { kind: "RESEARCH_RELEASE_SELECTOR", ...objective.release },
    concreteEndpointExposed: false,
    t019WriteAllowed: false
  };
}

function validateMappings(expected, actual, direction) {
  assertContract(Array.isArray(actual), "BINDING_MAPPING_REQUIRED", `${direction} mappings are required.`);
  const expectedPorts = expected.map((item) => item.modelPort).sort();
  const actualPorts = actual.map((item) => item.modelPort).sort();
  assertContract(JSON.stringify(expectedPorts) === JSON.stringify(actualPorts), "BINDING_PORT_SET_MISMATCH", `${direction} model ports differ from the objective contract.`, { expectedPorts, actualPorts });
  for (const sourceContract of expected) {
    const contract = normalizedPort(sourceContract, direction);
    const mapping = actual.find((item) => item.modelPort === contract.modelPort);
    for (const field of ["objectTypeRef", "propertyRef", "type", "unit", "timeGrain", "semanticKind", "shape", "cardinality", "nullable"]) {
      assertContract(mapping?.[field] === contract[field], "BINDING_FIELD_MISMATCH", `${direction} mapping ${contract.modelPort}.${field} is incompatible.`, { modelPort: contract.modelPort, field, expected: contract[field], actual: mapping?.[field] });
    }
    if (direction === "output") {
      assertContract(mapping.resultKind === contract.resultKind, "BINDING_RESULT_KIND_MISMATCH", `Output mapping ${contract.modelPort} has the wrong result kind.`);
    }
  }
}

function displayMode(profile, kind) {
  return profile.displayModes[kind] || profile.displayModes.DEFAULT;
}

function projectedPorts(objective, fieldPolicy) {
  if (fieldPolicy === "NONE") return [];
  if (fieldPolicy === "PRIMARY_AND_RANGE") return objective.outputContract.filter((item) => ["PRIMARY", "RANGE"].includes(item.displayRole));
  return objective.outputContract;
}

export function listObjectives() {
  return OBJECTIVES.map((objective) => ({
    objectiveId: objective.objectiveId,
    revisionId: objective.revisionId,
    name: objective.name,
    shortName: objective.shortName,
    kind: objective.kind,
    domain: objective.domain,
    scenarioIds: [...objective.scenarioIds],
    owner: objective.owner,
    status: objective.status,
    executionStatus: objective.executionStatus,
    resultKinds: [...(objective.resultKinds || [objective.sampleResult.resultKind])],
    businessQuestion: objective.businessQuestion,
    targetObjectTypes: [...objective.acceptedObjectTypes],
    inputCount: objective.inputContract.length,
    outputCount: objective.outputContract.length,
    candidateCount: objective.candidates.length,
    bindingStatus: objective.binding.status,
    releaseStatus: objective.release.status,
    consumerCount: Object.values(CONSUMERS).filter((item) => item.allowed).length
  }));
}

export function getObjective(objectiveId) {
  const objective = clone(objectiveById(objectiveId));
  objective.inputContract = objective.inputContract.map((item) => normalizedPort(item, "input"));
  objective.outputContract = objective.outputContract.map((item) => normalizedPort(item, "output"));
  objective.bindingDraft = bindingDraft(objective);
  objective.consumers = Object.values(CONSUMERS).map((item) => ({
    consumerId: item.consumerId,
    moduleId: item.moduleId,
    name: item.name,
    allowed: item.allowed,
    displayMode: item.allowed ? displayMode(item, objective.kind) : null,
    blockedCode: item.blockedCode || null,
    blockedReason: item.blockedReason || null
  }));
  return objective;
}

export function findCompatibleObjectives({ objectTypeRef, useKind = null, scenarioId = null } = {}) {
  const requestedType = baseType(objectTypeRef);
  assertContract(requestedType, "OBJECT_TYPE_REQUIRED", "An Object Type is required for objective compatibility lookup.");
  return listObjectives().filter((summary) => {
    const objective = objectiveById(summary.objectiveId);
    const typeCompatible = objective.acceptedObjectTypes.includes(requestedType);
    const scenarioCompatible = !scenarioId || objective.scenarioIds.includes(scenarioId);
    const useCompatible = !useKind
      || objective.kind === useKind
      || useKind === "MODEL_OUTPUT"
      || objective.resultKinds?.includes(useKind)
      || (useKind === "SIMULATION" && ["FORECAST", "SCORING", "OPTIMIZATION"].includes(objective.kind));
    return typeCompatible && scenarioCompatible && useCompatible;
  });
}

export function validateObjectiveBinding({ objectiveId, binding = null } = {}) {
  const objective = objectiveById(objectiveId);
  const draft = binding ? clone(binding) : bindingDraft(objective);
  assertContract(!containsForbiddenKey(draft), "CONCRETE_ENDPOINT_EXPOSED", "Binding cannot expose endpoint, credential, secret, token, URL or runtime topology fields.");
  assertContract(draft.objectiveId === objective.objectiveId, "OBJECTIVE_MISMATCH", "Binding is attached to a different objective.");
  assertContract(draft.publishedOntologyRef === objective.ontologyVersionId, "ONTOLOGY_VERSION_MISMATCH", "Binding targets a different Ontology version.");
  validateMappings(objective.inputContract, draft.inputMappings, "input");
  validateMappings(objective.outputContract, draft.outputMappings, "output");
  const validated = {
    ...draft,
    status: objective.release.status === "RESEARCH_RELEASE_CANDIDATE" ? "VALIDATED_RESEARCH_BINDING_REQUIRES_M01_CR" : "SCHEMA_VALIDATED_RELEASE_REQUIRED",
    compatibility: "VALIDATED",
    activationStatus: objective.release.status === "RESEARCH_RELEASE_CANDIDATE" ? "READY_FOR_RESEARCH_CONSUMPTION" : "BLOCKED_RELEASE_NOT_APPROVED",
    concreteEndpointExposed: false,
    t019WriteAllowed: false,
    validationFingerprint: sha256({ objectiveId, objectiveRevisionId: objective.revisionId, inputMappings: draft.inputMappings, outputMappings: draft.outputMappings, releaseSelector: draft.releaseSelector })
  };
  return validated;
}

export function projectObjectiveForConsumer({ objectiveId, consumerId } = {}) {
  const objective = objectiveById(objectiveId);
  const consumer = CONSUMERS[consumerId];
  assertContract(consumer, "CONSUMER_NOT_FOUND", `Unknown objective consumer: ${consumerId}`);
  if (!consumer.allowed) {
    return {
      resourceKind: "ObjectiveConsumerCompatibility",
      namespace: NAMESPACE,
      objectiveId,
      consumerId,
      consumerName: consumer.name,
      status: "BLOCKED",
      code: consumer.blockedCode,
      reason: consumer.blockedReason,
      resultKindAccepted: false,
      factWriteAllowed: false,
      actionWriteAllowed: false
    };
  }
  const ports = projectedPorts(objective, consumer.fieldPolicy);
  const outputs = Object.fromEntries(ports.map((port) => [port.modelPort, objective.sampleResult.outputs[port.modelPort]]));
  return {
    resourceKind: "ObjectiveConsumerProjection",
    namespace: NAMESPACE,
    objectiveId,
    objectiveRevisionId: objective.revisionId,
    objectiveName: objective.name,
    objectiveKind: objective.kind,
    consumerId,
    consumerName: consumer.name,
    status: "COMPATIBLE_RESEARCH_PREVIEW",
    permissionScope: objective.sampleResult.resultKind === "SIMULATION" ? "simulation.read" : consumer.permissionScope,
    displayMode: displayMode(consumer, objective.kind),
    bindingRef: { bindingId: objective.binding.bindingId, revision: objective.binding.revision },
    releaseSelector: { kind: "RESEARCH_RELEASE_SELECTOR", ...objective.release },
    outputContract: clone(ports),
    result: { ...clone(objective.sampleResult), outputs },
    concreteEndpointExposed: false,
    factWriteAllowed: false,
    actionWriteAllowed: false
  };
}

export function listConsumers() {
  return Object.values(CONSUMERS).map((item) => clone(item));
}
