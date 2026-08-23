(function () {
  "use strict";

  // S002 adapter for the copied v1.0.3 report-center lifecycle page. Baseline
  // lifecycle markup and handlers remain authoritative; this adapter supplies
  // report-owned facts and reads upstream Owner State without publishing
  // C008/C017/C019/C011 on behalf of M01, M02 or M04.
  const params = new URLSearchParams(window.location.search);
  const context = {
    scenarioId: params.get("scenarioId") || "S002",
    scenarioVersion: params.get("scenarioVersion") || "S002-v1",
    scenarioRunId: params.get("scenarioRunId") || "S002-RUN-20260815160000000-9f72297443c6",
    formedAt: params.get("formedAt") || "2026-08-15T08:00:00.000Z",
    status: params.get("status") || "active",
    source: "预算监督管理运行"
  };
  const DATA_VERSION = "S002-DATA-v1";
  // S002-DATA-v1 is only the compatibility delivery pointer.  The report
  // center consumes the two independently published M02 assets below and
  // keeps the bundle pointer solely for C003/C018 traceability.
  const DATA_ASSET_COMPONENTS = [
    { assetId: "S002-BUDGET-EXECUTION-ASSET", version: "S002-BUDGET-EXEC-v1", name: "预算编制与执行数据资产", scope: "预算、实际、初始申报" },
    { assetId: "S002-PROJECT-OCCUPANCY-ASSET", version: "S002-PROJECT-OCC-v1", name: "项目预算占用与余额数据资产", scope: "项目余额、采购占用、供应商" }
  ];
  const DATA_ASSET_VERSIONS = DATA_ASSET_COMPONENTS.map((item) => item.version);
  const DATA_EVIDENCE_REFS = [...DATA_ASSET_VERSIONS, DATA_VERSION];
  const SEMANTIC_VERSION_ID = "SEM-S002-BUDGET-v1";
  const ONTOLOGY_VERSION = "S002-ONTO-v1";
  const FORMED_AT = "2026-08-15 10:00:00";
  const C019_READ_KEY = "ontology3.decision-center.c019.projection.v1";
  const REPORT_STATE_KEY = "ontology3.s002.report-center.lifecycle-review.v1";
  const REPORT_PROJECTION_REVISION = "S002-M06-REPORT-PROJECTION-v11";
  const LEGACY_ACTION_TYPE_ID_MAP = Object.freeze({
    "ACT-BUDGET-INCREASE": "ACT-BUDGET-EXECUTION-RECTIFICATION",
    "ACT-BUDGET-DECREASE": "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW",
    "ACT-SUBJECT-TRANSFER": "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW",
    "ACT-SUBMISSION-RETURN": "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT",
    "ACT-RELEASE-COMMITMENT": "ACT-PROCUREMENT-COMMITMENT-CLEANUP",
    "ACT-PRICE-REVIEW": "ACT-SUPPLIER-PRICE-REVIEW"
  });
  const canonicalActionTypeId = (id) => LEGACY_ACTION_TYPE_ID_MAP[id] || id;
  const OWNER_STATE_KEY = `ofw:v1.1.0:${encodeURIComponent(context.scenarioId)}:${encodeURIComponent(context.scenarioVersion)}:${encodeURIComponent(context.scenarioRunId)}:m06:owned-state`;
  const HISTORICAL_READONLY = ["historical", "historical-readonly", "历史只读"].includes(context.status);

  function storeReportState(value) {
    if (HISTORICAL_READONLY) {
      // The copied baseline app reads this in-memory bootstrap before it
      // starts. Historical checkpoints never overwrite the active M06 store.
      window.S002_M06_INITIAL_STATE = cloneValue(value);
      return;
    }
    localStorage.setItem(REPORT_STATE_KEY, JSON.stringify(value));
  }

  const departments = [
    { name: "安全运行部", id: "ORG-S002-AQ", board: "运营保障", budget: 313.90, actual: 310.32, costToRevenue: 112.63, execution: 98.86, occupancy: 62.09, variance: -3.58, projectAvailableBalance: 278.8868, rule: { code: "R02", id: "RULE-002", name: "费用预算执行偏离合理区间", metricId: "MET-007", metric: "预算执行率", metricValue: "98.86%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", branch: "expenseExecutionRate >= 95% AND expenseExecutionRate <= 100%", evaluationId: "RULE-EVAL-S002-AQ-20260815", evaluatedAt: "2026-08-15 10:00:00", resultVersion: "S002-RULE-v1", status: "命中", publicationStatus: "Published" }, supplier: "供应商3" },
    { name: "技术部", id: "ORG-S002-JS", board: "技术研发", budget: 379.30, actual: 295.75, costToRevenue: 74.96, execution: 77.97, occupancy: 52.25, variance: -83.55, projectAvailableBalance: 749.3669, rule: { code: "R02", id: "RULE-002", name: "费用预算执行偏离合理区间", metricId: "MET-007", metric: "预算执行率", metricValue: "77.97%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", branch: "expenseExecutionRate > 70% AND expenseExecutionRate < 95%", evaluationId: "RULE-EVAL-S002-JS-20260815", evaluatedAt: "2026-08-15 10:00:00", resultVersion: "S002-RULE-v1", status: "已评估无命中", publicationStatus: "Published" }, supplier: "供应商2" },
    { name: "设备管理部", id: "ORG-S002-SB", board: "资产运维", budget: 404.50, actual: 255.66, costToRevenue: 52.29, execution: 63.20, occupancy: 49.04, variance: -148.84, projectAvailableBalance: 1128.7650, rule: { code: "R02", id: "RULE-002", name: "费用预算执行偏离合理区间", metricId: "MET-007", metric: "预算执行率", metricValue: "63.20%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", branch: "expenseExecutionRate <= 70%", evaluationId: "RULE-EVAL-S002-SB-20260815", evaluatedAt: "2026-08-15 10:00:00", resultVersion: "S002-RULE-v1", status: "命中", publicationStatus: "Published" }, supplier: "供应商4" }
  ];

  const departmentUnits = Object.fromEntries(departments.map((item) => [item.name, {
    singleBusinessSubjectId: item.id,
    singleBusinessSubjectName: item.name,
    singleBusinessSubjectObjectType: "OBJ-BUDGET-DEPARTMENT",
    board: item.board,
    balance: item.budget,
    cost: item.costToRevenue,
    floating: item.execution,
    shortTerm: item.occupancy,
    foreign: 0,
    highCost: Math.abs(item.variance),
    credit: item.budget - item.actual,
    approvedBudget: item.budget,
    actualExpense: item.actual,
    executionRate: item.execution,
    budgetVariance: item.variance,
    costToRevenue: item.costToRevenue,
    grossMargin: 100 - item.costToRevenue,
    // 项目可用立项余额来自21个项目按部门汇总，不以部门费用预算减实际/占用替代。
    availableBalance: item.projectAvailableBalance,
    netInTransit: item.occupancy,
    positivePr: item.name === "设备管理部" ? 85.57 : item.name === "技术部" ? 93.99 : 93.53,
    decemberPositivePrShare: item.name === "设备管理部" ? 10.86 : item.name === "技术部" ? 6.97 : 8.14,
    decemberBudgetOccupancyShare: item.name === "设备管理部" ? 18.94 : item.name === "技术部" ? 12.54 : 12.26,
    procurementCount: item.name === "设备管理部" ? 7 : item.name === "技术部" ? 8 : 6,
    rule: {
      ...item.rule,
      version: "S002-RULE-v1",
      publishedSemanticVersion: ONTOLOGY_VERSION,
      publicationStatus: "Published",
      status: item.rule.status || "命中",
      effective: "2025-01-01 起",
      metricValue: item.rule.metricValue,
    },
    institutions: [],
    loans: []
  }]));

  const budgetMetrics = [
    { id: "MET-001", type: "Metric", name: "成本占收比", description: "总成本 / 收入净额", formula: "总成本 / 收入净额", unit: "%", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-002", type: "Metric", name: "真正毛利率", description: "(收入净额 - 总成本) / 收入净额", formula: "(收入净额 - 总成本) / 收入净额", unit: "%", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-003", type: "Metric", name: "净在途占用", description: "PR/PO 占用变动金额带符号累计", formula: "Σ signed PR/PO occupancy", unit: "万元", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-004", type: "Metric", name: "正向采购发起量", description: "正向 PR 金额合计", formula: "Σ positive PR", unit: "万元", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-005", type: "Metric", name: "12月正向采购发起占比", description: "12月正向 PR / 全年正向 PR", formula: "December positive PR / annual positive PR", unit: "%", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-006", type: "Metric", name: "项目可用立项余额", description: "立项 - 实际 - 净在途占用 - 未结计提", formula: "budget - actual - netInTransit - accrual", unit: "万元", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-007", type: "Metric", name: "预算执行率", description: "实际 / 最终批准预算", formula: "actual / approvedBudget", unit: "%", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-008", type: "Metric", name: "预算差异额", description: "实际 - 最终批准预算", formula: "actual - approvedBudget", unit: "万元", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" },
    { id: "MET-009", type: "Metric", name: "年末采购/预算占用集中度", description: "采购发起与预算占用双分量", formula: "{December positive PR / annual positive PR, December net occupancy / annual net occupancy}", unit: "%（双分量）", version: "S002-METRIC-v1", status: "Published", owner: "本体管理" }
  ];
  const budgetRules = [
    { id: "RULE-001", code: "R01", name: "项目可用立项余额为负", version: "S002-RULE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", metricId: "MET-006", branch: "availableBalance < 0", threshold: "0万元", actionType: "预算执行整改" },
    { id: "RULE-002", code: "R02", name: "费用预算执行偏离合理区间", version: "S002-RULE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", metricId: "MET-007", branch: "expenseExecutionRate > 100% OR (expenseExecutionRate >= 95% AND expenseExecutionRate <= 100%) OR expenseExecutionRate <= 70%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", actionType: "按执行率分支路由" },
    { id: "RULE-003", code: "R03", name: "成本占收比异常", version: "S002-RULE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", metricId: "MET-001", branch: "costToRevenue >= 100%", threshold: ">=100%关注；>=120%高", actionType: "费用管理优化核查" },
    { id: "RULE-004", code: "R04", name: "年末采购/预算占用集中", version: "S002-RULE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", metricId: "MET-009", branch: "decemberBudgetOccupancyShare >= 10%", threshold: "10%—15%关注；>=15%高", actionType: "采购占用清理" },
    { id: "RULE-005", code: "R05", name: "供应商同级人月成本差异", version: "S002-RULE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", metricId: null, branch: "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2", threshold: "最高/最低人月成本倍率 > 1.2", actionType: "供应商价格复核" }
  ];
  const budgetActions = [
    { id: "ACT-BUDGET-EXECUTION-RECTIFICATION", legacyCompatibleId: "ACT-BUDGET-INCREASE", name: "预算执行整改", version: "S002-ACTION-TYPE-v1", definitionVersion: "S002-ACTION-TYPE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", boundary: "只创建预算执行整改草稿，不反写外部系统" },
    { id: "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", legacyCompatibleId: "ACT-BUDGET-DECREASE", name: "下一年度预算合理性复核", version: "S002-ACTION-TYPE-v1", definitionVersion: "S002-ACTION-TYPE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", boundary: "只创建下一年度预算合理性复核草稿，不覆盖最终批准预算" },
    { id: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", legacyCompatibleId: "ACT-SUBJECT-TRANSFER", name: "费用管理优化核查", version: "S002-ACTION-TYPE-v1", definitionVersion: "S002-ACTION-TYPE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", boundary: "只生成费用结构和科目余额核查待办，不自动调账" },
    { id: "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", legacyCompatibleId: "ACT-SUBMISSION-RETURN", name: "预算申报依据补充", version: "S002-ACTION-TYPE-v1", definitionVersion: "S002-ACTION-TYPE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", boundary: "只生成申报依据补充待办，不自动退回申报" },
    { id: "ACT-PROCUREMENT-COMMITMENT-CLEANUP", legacyCompatibleId: "ACT-RELEASE-COMMITMENT", name: "采购占用清理", version: "S002-ACTION-TYPE-v1", definitionVersion: "S002-ACTION-TYPE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", boundary: "只生成采购占用清理待办，不释放外部占用" },
    { id: "ACT-SUPPLIER-PRICE-REVIEW", legacyCompatibleId: "ACT-PRICE-REVIEW", name: "供应商价格复核", version: "S002-ACTION-TYPE-v1", definitionVersion: "S002-ACTION-TYPE-v1", publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published", boundary: "只生成价格复核待办，不触发供应商系统" }
  ];

  const facts = [
    { id: "FACT-BUDGET-EXECUTION", type: "指标结果", name: "2025最终批准费用预算执行", value: "费用预算 1,097.70 万元；实际费用 861.73 万元；执行率 78.50%", scope: "S002 全部部门", source: "C018-S002-v1", anchor: "budget-execution" },
    { id: "FACT-COST-TO-REVENUE", type: "指标结果", name: "成本占收比", value: "74.35%（费用 861.73 ÷ 收入 1,159.02）", scope: "S002 全部部门", source: "C018-S002-v1", anchor: "cost-to-revenue" },
    { id: "FACT-NET-IN-TRANSIT", type: "指标结果", name: "净在途占用", value: "163.38 万元", scope: "21 项目中 3 项有源占用", source: "C018-S002-v1", anchor: "net-in-transit" },
    { id: "FACT-DECEMBER", type: "指标结果", name: "年末采购/预算占用集中度", value: "正向 PR 8.59% / 净在途 14.35%", scope: "2025", source: "C018-S002-v1", anchor: "year-end-concentration" },
    { id: "FACT-ACTIONS", type: "范围声明", name: "决策触发边界", value: "当前 S002 运行不生成行动申请、决策事项或平台内待办；异常与关注事项仅用于预算监督分析和证据下钻。", scope: "S002", source: "S002-SCOPE-20260815", anchor: "action-status" },
    { id: "FACT-DATA-MARKER", type: "质量标识", name: "演示加工", value: "DERIVED / CORRECTED；21组合法重复凭证保留", scope: "S002", source: DATA_VERSION, anchor: "data-quality" }
  ];
  const reportFact = (id, name, value, unit, scope, source, anchorIds, evidenceRefs = []) => ({
    id,
    type: id.includes("RULE") || /^FACT-R\d\d-/.test(id) ? "Rule 结果" : "报告事实",
    kind: id.includes("RULE") || /^FACT-R\d\d-/.test(id) ? "Rule 结果" : "报告事实",
    name,
    label: name,
    value,
    unit,
    scope,
    source,
    resultVersion: source,
    evidence: evidenceRefs.length ? evidenceRefs : [source],
    evidenceRefs: evidenceRefs.length ? evidenceRefs : [source],
    anchor: anchorIds[0],
    anchorIds
  });
  facts.push(
    reportFact("FACT-AS-OF", "数据截至", "2025-12-31", null, "S002", "C017-S002-BINDING-v1", ["date-asof"], [...DATA_EVIDENCE_REFS, "C017-S002-BINDING-v1"]),
    reportFact("FACT-GROUP-BALANCE", "2025最终批准费用预算", 1097.70, "万元", "全部部门", "S002-METRIC-RESULT-v1", ["metric-balance", "kpi-balance"], ["MET-S002-BUDGET-EXECUTION-RATE", "C018-S002-v1"]),
    reportFact("FACT-GROUP-COST", "费用预算执行率", 78.50, "%", "全部部门", "S002-METRIC-RESULT-v1", ["metric-cost", "kpi-cost", "chart-cost"], ["MET-S002-BUDGET-EXECUTION-RATE", "C018-S002-v1"]),
    reportFact("FACT-GROUP-FLOATING", "项目可用立项余额", 2157.02, "万元", "21个项目", "S002-METRIC-RESULT-v1", ["kpi-floating", "structure-floating", "cell-floating"], ["MET-S002-PROJECT-AVAILABLE-BALANCE", "C018-S002-v1"]),
    reportFact("FACT-GROUP-HIGH-COST", "成本占收比", 74.35, "%", "全部部门", "S002-METRIC-RESULT-v1", ["metric-high-cost"], ["MET-S002-COST-TO-REVENUE", "C018-S002-v1"]),
    reportFact("FACT-GROUP-SHORT", "净在途占用", 163.38, "万元", "3/21项目有源占用", "S002-METRIC-RESULT-v1", ["structure-short", "cell-short"], ["MET-S002-NET-IN-TRANSIT", "C018-S002-v1"]),
    reportFact("FACT-GROUP-FOREIGN", "12月正向采购发起占比", 8.59, "%", "2025", "S002-METRIC-RESULT-v1", ["structure-foreign", "cell-foreign"], ["MET-S002-DEC-POSITIVE-PURCHASE-SHARE", "C018-S002-v1"]),
    reportFact("FACT-GROUP-CREDIT", "12月净在途占用占比", 14.35, "%", "2025", "S002-METRIC-RESULT-v1", ["cell-credit"], ["MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION", "C018-S002-v1"]),
    reportFact("FACT-GUARANTEE-UNKNOWN", "需复核数据占比", 0, "%", "全部部门", "S002-QUALITY-RECEIPT-v1", ["structure-unknown"], ["S002-QUALITY-RECEIPT-v1"]),
    reportFact("FACT-THREE-UNIT-BALANCE", "三部门最终批准费用预算", 1097.70, "万元", "安全运行部、技术部、设备管理部", "S002-METRIC-RESULT-v1", ["compare-balance"], ["C018-S002-v1"]),
    reportFact("FACT-THREE-UNIT-COST", "三部门费用预算执行率", 78.50, "%", "安全运行部、技术部、设备管理部", "S002-METRIC-RESULT-v1", ["compare-cost"], ["C018-S002-v1"]),
    reportFact("FACT-UNIT-553-BALANCE", "安全运行部最终批准费用预算", 313.90, "万元", "安全运行部", "S002-METRIC-RESULT-v1", ["unit-553-balance"], ["C018-S002-v1"]),
    reportFact("FACT-UNIT-553-COST", "安全运行部费用预算执行率", 98.86, "%", "安全运行部", "S002-METRIC-RESULT-v1", ["unit-553-cost"], ["C018-S002-v1"]),
    reportFact("FACT-UNIT-465-BALANCE", "技术部最终批准费用预算", 379.30, "万元", "技术部", "S002-METRIC-RESULT-v1", ["unit-465-balance"], ["C018-S002-v1"]),
    reportFact("FACT-UNIT-465-COST", "技术部费用预算执行率", 77.97, "%", "技术部", "S002-METRIC-RESULT-v1", ["unit-465-cost"], ["C018-S002-v1"]),
    reportFact("FACT-UNIT-561-BALANCE", "设备管理部最终批准费用预算", 404.50, "万元", "设备管理部", "S002-METRIC-RESULT-v1", ["unit-561-balance"], ["C018-S002-v1"]),
    reportFact("FACT-UNIT-561-COST", "设备管理部费用预算执行率", 63.20, "%", "设备管理部", "S002-METRIC-RESULT-v1", ["unit-561-cost"], ["C018-S002-v1"]),
    reportFact("FACT-R01-INSTITUTIONS", "供应商人月成本比对", "按年度、预算二级科目、人员分类、供应商、级别、币种和税率分组；各部门人月成本=净额÷人月，只有组内最高/最低倍率>1.2才判定异常。", null, "S002 技术配置", "S002-RULE-RESULT-v1", ["institution-priority"], ["RULE-005", "C018-S002-v1"]),
    reportFact("FACT-R01-RESULT", "项目可用立项余额为负", "命中：可用立项余额 -20.50 万元", null, "PRJ-AQ-概率-2025-002", "S002-RULE-RESULT-v1", ["rule-r01-result"], ["RULE-S002-PROJECT-BALANCE", "C018-S002-v1"]),
    reportFact("FACT-R01-BRANCH", "R01触发分支", "availableBalance < 0", null, "PRJ-AQ-概率-2025-002", "S002-RULE-RESULT-v1", ["rule-r01-branch"], ["RULE-S002-PROJECT-BALANCE"]),
    reportFact("FACT-R01-THRESHOLD", "R01阈值", "0万元", null, "PRJ-AQ-概率-2025-002", "S002-RULE-RESULT-v1", ["rule-r01-threshold"], ["RULE-S002-PROJECT-BALANCE"]),
    reportFact("FACT-R01-EVALUATED-AT", "R01评估时间", "2026-08-15 10:00:00", null, "PRJ-AQ-概率-2025-002", "S002-RULE-RESULT-v1", ["rule-r01-evaluated-at"], ["RULE-EVAL-S002-AQ-20260815"]),
    reportFact("FACT-R02-RESULT", "费用预算执行偏离合理区间", "命中2项：安全运行部98.86%接近上限；设备管理部63.20%偏低", null, "安全运行部、设备管理部", "S002-RULE-RESULT-v1", ["rule-r02-result"], ["RULE-002", "HIT-002-2025-AQ", "HIT-002-2025-SB", "C018-S002-v1"]),
    reportFact("FACT-R02-BRANCH", "R02触发分支", "95%—100%接近上限；<=70%偏低", null, "安全运行部、设备管理部", "S002-RULE-RESULT-v1", ["rule-r02-branch"], ["RULE-002", "HIT-002-2025-AQ", "HIT-002-2025-SB"]),
    reportFact("FACT-R02-THRESHOLD", "R02阈值", "<=70%偏低；95%—100%接近上限；>100%超支", null, "安全运行部、设备管理部", "S002-RULE-RESULT-v1", ["rule-r02-threshold"], ["RULE-002"]),
    reportFact("FACT-R02-EVALUATED-AT", "R02评估时间", "2026-08-15 10:00:00", null, "安全运行部、设备管理部", "S002-RULE-RESULT-v1", ["rule-r02-evaluated-at"], ["RULE-EVAL-S002-AQ-20260815", "RULE-EVAL-S002-SB-20260815"]),
    reportFact("FACT-R03-RESULT", "成本占收比异常", "命中：成本占收比 112.63%；真正毛利率 -12.63%", null, "安全运行部 · 2025", "S002-RULE-RESULT-v1", ["rule-r03-result"], ["RULE-003", "MET-001", "MET-002", "HIT-003-2025-AQ", "C018-S002-v1"]),
    reportFact("FACT-R03-BRANCH", "R03触发分支", "costToRevenue >= 100%", null, "安全运行部 · 2025", "S002-RULE-RESULT-v1", ["rule-r03-branch"], ["RULE-003", "MET-001", "HIT-003-2025-AQ"]),
    reportFact("FACT-R03-THRESHOLD", "R03阈值", ">=100%关注；>=120%高", null, "安全运行部 · 2025", "S002-RULE-RESULT-v1", ["rule-r03-threshold"], ["RULE-003", "MET-001"]),
    reportFact("FACT-R03-EVALUATED-AT", "R03评估时间", "2026-08-15 10:00:00", null, "安全运行部 · 2025", "S002-RULE-RESULT-v1", ["rule-r03-evaluated-at"], ["RULE-EVAL-S002-RULE-003-20260815", "HIT-003-2025-AQ"]),
    reportFact("FACT-SUGGESTION-SCOPE", "关注事项处理边界", "报告草稿只组织预算异常、Rule命中、分析关注和建议核查方向；当前版本不提交行动申请、不形成决策事项或待办，也不调用外部预算系统。", null, "S002", "S002-SCOPE-20260815", ["narrative-suggestion", "suggestion-basis"], ["S002-SCOPE-20260815"]),
    reportFact("FACT-JUDGMENT-COST-TREND", "预算执行判断", "2025费用预算执行率为78.50%，安全运行部接近上限，设备管理部预算余量较高。", null, "全部部门", "C018-S002-v1", ["judgment-cost-trend"], ["MET-S002-BUDGET-EXECUTION-RATE"]),
    reportFact("FACT-JUDGMENT-FLOATING-EXPOSURE", "项目余额判断", "21个项目可用立项余额合计2157.02万元，其中1个项目余额为负；建议核对该项目实际、净在途占用和剩余计划构成。", null, "21个项目", "C018-S002-v1", ["judgment-floating-exposure"], ["MET-S002-PROJECT-AVAILABLE-BALANCE"]),
    reportFact("FACT-JUDGMENT-COST-LOW", "成本与毛利判断", "集团成本占收比74.35%、真正毛利率25.65%；安全运行部成本占收比112.63%、真正毛利率-12.63%，需核实收入确认、费用结构和可优化空间。", null, "全部部门", "C018-S002-v1", ["judgment-cost-low"], ["MET-001", "MET-002", "RULE-003", "HIT-003-2025-AQ"]),
    reportFact("FACT-JUDGMENT-HIGH-COST-UNIT553", "重点单位判断", "安全运行部费用预算执行率98.86%，需核对科目余额、剩余采购占用和下一年度预算合理性。", null, "安全运行部", "C018-S002-v1", ["judgment-high-cost-unit553"], ["RULE-002", "MET-007", "HIT-002-2025-AQ"]),
    reportFact("FACT-DISCLOSURE-WEIGHTED-METHOD", "指标方法披露", "预算执行率、成本占收比、项目可用立项余额和采购占用均直接引用M01 Published定义，报告正文不重新计算。", null, "S002", "T019-S002-v1", ["disclosure-weighted-method"], ["T019-S002-v1"]),
    reportFact("FACT-DISCLOSURE-FIXED-RESULTS", "固定结果披露", "报告草稿固定引用 C018-S002-v1、预算执行资产 S002-BUDGET-EXEC-v1 和项目占用资产 S002-PROJECT-OCC-v1；S002-DATA-v1 仅作为组合交付指针，后续数据变化不会原地改写本草稿。", null, "S002", "C018-S002-v1", ["disclosure-fixed-results"], ["C018-S002-v1", ...DATA_EVIDENCE_REFS]),
    reportFact("FACT-JUDGMENT-FLOATING-HIGH", "项目余额与占用说明", "可用立项余额与净在途占用分别展示，未使用合同额。", null, "S002", "C018-S002-v1", ["judgment-floating-high"], ["MET-S002-PROJECT-AVAILABLE-BALANCE", "MET-S002-NET-IN-TRANSIT"]),
    reportFact("FACT-JUDGMENT-SHORT-LOW", "年末占用说明", "集团组合12月净在途占用占比14.35%，仅作总体观察，不单独形成Rule Hit；设备项目18.9437%命中RULE-004，建议下钻核对12月采购发起与占用构成。", null, "2025", "C018-S002-v1", ["judgment-short-low"], ["RULE-004", "HIT-004", "MET-009"]),
    reportFact("FACT-UNIT553-FOREIGN-CURRENCY", "币种说明", "全部预算与实际金额均为人民币、万元口径。", null, "S002", DATA_VERSION, ["judgment-unit553-foreign"], DATA_EVIDENCE_REFS),
    reportFact("FACT-INSTITUTION-PRIORITY-BASIS", "供应商复核依据", "比较同一供应商同一级别人员在不同部门的人月成本；人月成本=年度预算净额（万元）×10000÷服务人月，最高/最低倍率严格大于1.2才形成异常。", null, "S002 技术配置", "C018-S002-v1", ["institution-priority-basis"], ["RULE-005"]),
    reportFact("FACT-REPORT-DEFINITION-VERSION", "报告定义版本", "RD-S002-001 / 1.0.0", null, "S002", "RD-S002-001", ["disclosure-definition-version"], ["RD-S002-001"]),
    reportFact("FACT-REPORT-TEMPLATE-VERSION", "报告模板版本", "RT-S002-001 / 1.0.0", null, "S002", "RT-S002-001", ["disclosure-template-version"], ["RT-S002-001"]),
    reportFact("FACT-PUBLISHED-SEMANTIC-VERSION", "Published语义版本", "SEM-S002-BUDGET-v1 / S002-ONTO-v1 / T019-S002-v1", null, "S002", "T019-S002-v1", ["disclosure-semantic-version"], ["T019-S002-v1"]),
    reportFact("FACT-DATA-VERSION", "数据资产版本", "S002-DATA-v1（组合指针；预算执行 S002-BUDGET-EXEC-v1 + 项目占用 S002-PROJECT-OCC-v1）", null, "S002", DATA_VERSION, ["disclosure-data-version"], DATA_EVIDENCE_REFS),
    reportFact("FACT-DATA-AS-OF-DISCLOSURE", "数据时点披露", "2025-12-31", null, "S002", "C017-S002-BINDING-v1", ["disclosure-data-asof"], ["C017-S002-BINDING-v1"]),
    reportFact("FACT-DATA-QUALITY-STATUS", "数据质量披露", "演示加工通过；不等于生产数据验收", null, "S002", "S002-QUALITY-RECEIPT-v1", ["disclosure-quality"], ["S002-QUALITY-RECEIPT-v1", ...DATA_EVIDENCE_REFS]),
    reportFact("FACT-DATA-FRESHNESS", "数据新鲜度披露", "截至2025-12-31的固定演示数据", null, "S002", "C017-S002-BINDING-v1", ["disclosure-freshness"], ["C017-S002-BINDING-v1"]),
    reportFact("FACT-DATA-READINESS", "数据消费状态", "可消费（演示场景）", null, "S002", "C017-S002-BINDING-v1", ["disclosure-readiness"], ["C017-S002-BINDING-v1"]),
    reportFact("FACT-QUALITY-LIMITATION", "数据加工限制", "21组合法重复凭证保留；13条期间异常和6条日期倒置均保留源值、修正值与CORRECTED标识；14组跨年计提与冲回/实际确认已逐条配对，最大绝对差异0.00万元，仅作为质量核验，不占用5项正式Rule且不生成Action。", null, "S002", "S002-QUALITY-RECEIPT-v1", ["disclosure-quality-limitation"], ["S002-QUALITY-RECEIPT-v1", "EVAL-ACCRUAL-001"]),
    reportFact("FACT-LLM-ROLE-LIMITATION", "Agent边界", "Agent只生成分析或报告草稿，不创建Rule、不审批、不生成外部系统结果。", null, "S002", "C022-S002-v1", ["disclosure-llm-role"], ["C022-S002-v1"]),
    reportFact("FACT-SNAPSHOT-FREEZE-LIMITATION", "快照边界", "本草稿与驾驶舱版本分离；历史查看只读，恢复和回归均创建新的scenarioRunId。", null, "S002", "C034-S002", ["disclosure-snapshot-freeze"], ["C034-S002"])
  );

  // The baseline lifecycle verifier consumes a structured fact contract.  The
  // S002 adapter keeps that contract explicit instead of relying on the text
  // rendered by the report.  Every fact therefore carries the same semantic,
  // trust and applicable-check snapshots that were fixed at generation time.
  const S002_METRIC_CHECKS = ["evidenceCompleteness", "valueConsistency", "semanticConsistency", "versionCompatibility", "trustDisclosure", "crossContentConsistency", "unboundContentDetection"];
  const S002_RULE_CHECKS = [...S002_METRIC_CHECKS.slice(0, 5), "ruleConsistency", ...S002_METRIC_CHECKS.slice(5)];
  const S002_DISCLOSURE_CHECKS = ["evidenceCompleteness", "semanticConsistency", "versionCompatibility", "trustDisclosure", "crossContentConsistency", "unboundContentDetection"];
  const S002_RULE_BY_FACT = {
    "FACT-R01-INSTITUTIONS": { ruleId: "RULE-005", metricId: null, branch: "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2", threshold: "最高/最低人月成本倍率 > 1.2", result: "按可比组评估", scope: "业务支持费-技术配置" },
    "FACT-R01-RESULT": { ruleId: "RULE-001", metricId: "MET-006", branch: "availableBalance < 0", threshold: "0万元", result: "命中", scope: "PRJ-AQ-概率-2025-002" },
    "FACT-R01-BRANCH": { ruleId: "RULE-001", metricId: "MET-006", branch: "availableBalance < 0", threshold: "0万元", result: "命中", scope: "PRJ-AQ-概率-2025-002" },
    "FACT-R01-THRESHOLD": { ruleId: "RULE-001", metricId: "MET-006", branch: "availableBalance < 0", threshold: "0万元", result: "命中", scope: "PRJ-AQ-概率-2025-002" },
    "FACT-R01-EVALUATED-AT": { ruleId: "RULE-001", metricId: "MET-006", branch: "availableBalance < 0", threshold: "0万元", result: "命中", scope: "PRJ-AQ-概率-2025-002" },
    "FACT-R02-RESULT": { ruleId: "RULE-002", metricId: "MET-007", branch: "95%—100% OR <=70%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", result: "命中", scope: "安全运行部、设备管理部" },
    "FACT-R02-BRANCH": { ruleId: "RULE-002", metricId: "MET-007", branch: "95%—100% OR <=70%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", result: "命中", scope: "安全运行部、设备管理部" },
    "FACT-R02-THRESHOLD": { ruleId: "RULE-002", metricId: "MET-007", branch: "95%—100% OR <=70%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", result: "命中", scope: "安全运行部、设备管理部" },
    "FACT-R02-EVALUATED-AT": { ruleId: "RULE-002", metricId: "MET-007", branch: "95%—100% OR <=70%", threshold: "<=70%偏低；95%—100%接近上限；>100%超支", result: "命中", scope: "安全运行部、设备管理部" },
    "FACT-R03-RESULT": { ruleId: "RULE-003", metricId: "MET-001", branch: "costToRevenue >= 100%", threshold: ">=100%关注；>=120%高", result: "命中", scope: "安全运行部 · 2025" },
    "FACT-R03-BRANCH": { ruleId: "RULE-003", metricId: "MET-001", branch: "costToRevenue >= 100%", threshold: ">=100%关注；>=120%高", result: "命中", scope: "安全运行部 · 2025" },
    "FACT-R03-THRESHOLD": { ruleId: "RULE-003", metricId: "MET-001", branch: "costToRevenue >= 100%", threshold: ">=100%关注；>=120%高", result: "命中", scope: "安全运行部 · 2025" },
    "FACT-R03-EVALUATED-AT": { ruleId: "RULE-003", metricId: "MET-001", branch: "costToRevenue >= 100%", threshold: ">=100%关注；>=120%高", result: "命中", scope: "安全运行部 · 2025" },
  };
  const S002_METRIC_IDS = new Set(budgetMetrics.map((item) => item.id));
  const semanticForFact = (fact) => {
    const metricId = (fact.evidenceRefs || []).find((ref) => S002_METRIC_IDS.has(ref)) || null;
    const rule = S002_RULE_BY_FACT[fact.id];
    const resourceId = rule?.ruleId || metricId || "OBJ-BUDGET-SCOPE";
    return {
      resourceId,
      publishedVersion: ONTOLOGY_VERSION,
      semanticVersionId: SEMANTIC_VERSION_ID,
      publishedSemanticVersion: ONTOLOGY_VERSION,
      name: fact.name || fact.label || fact.id,
      definition: fact.name || fact.label || "S002 预算监督管理固定事实",
      applicableObject: rule?.scope?.startsWith("PRJ-") ? "OBJ-BUDGET-PROJECT" : "OBJ-BUDGET-SCOPE",
      timeRange: fact.scope === "2025" ? "2025-01-01—2025-12-31" : "2024-01-01—2026-12-31",
      unit: fact.unit || null,
    };
  };
  facts.forEach((fact) => {
    // Older S002 fact fixtures only carried `source`; the report contract
    // requires every fact to expose a stable result version and an evidence
    // reference list.  Normalize at package construction time so historical
    // snapshots can be verified without inventing a new business result.
    fact.resultVersion = fact.resultVersion || fact.source || DATA_VERSION;
    fact.unit = fact.unit ?? null;
    fact.evidenceRefs = Array.isArray(fact.evidenceRefs) && fact.evidenceRefs.length
      ? fact.evidenceRefs.slice()
      : (Array.isArray(fact.evidence) && fact.evidence.length ? fact.evidence.slice() : [fact.source || DATA_VERSION]);
    fact.evidence = Array.isArray(fact.evidence) && fact.evidence.length ? fact.evidence.slice() : fact.evidenceRefs.slice();
    const isRule = Boolean(S002_RULE_BY_FACT[fact.id]);
    const isSuggestion = fact.id === "FACT-SUGGESTION-SCOPE" || fact.id === "FACT-SUGGESTION-BASIS";
    // The action summary is a scope/disclosure fact, not a Rule result.  Rule
    // consistency is evaluated on the structured FACT-R01/R02/R03 records;
    // applying it to this narrative summary would manufacture an unverifiable
    // Rule basis.
    fact.applicableChecks = isRule ? S002_RULE_CHECKS.slice() : isSuggestion ? S002_DISCLOSURE_CHECKS.slice() : S002_METRIC_CHECKS.slice();
    fact.semanticSnapshot = semanticForFact(fact);
    fact.trustSnapshot = {
      asOf: "2025-12-31",
      dataVersion: DATA_VERSION,
      qualityStatus: "passed-for-demo",
      freshnessStatus: "截至 2025-12-31",
      consumptionReadiness: "可消费",
      hardQualityFailure: false,
      limitations: ["演示加工通过，不等于生产数据验收"]
    };
    if (isRule) {
      const rule = S002_RULE_BY_FACT[fact.id];
      fact.ruleSnapshot = {
        ruleId: rule.ruleId,
        ruleVersion: "S002-RULE-v1",
        evaluationRecordId: `RULE-EVAL-S002-${rule.ruleId}-${fact.id}-20260815`,
        evaluationTime: "2026-08-15 10:00:00",
        branch: rule.branch,
        threshold: rule.threshold,
        metricId: rule.metricId,
        supportingMeasureId: rule.ruleId === "RULE-005" ? "RULE-005-SUPPORT" : null,
        result: rule.result,
        publishedSemanticVersion: ONTOLOGY_VERSION,
        resultVersion: "S002-RULE-RESULT-v1"
      };
    }
  });
  const anchors = facts.flatMap((item) => (item.anchorIds || [item.anchor]).filter(Boolean).map((anchorId) => ({
    anchorId,
    id: anchorId,
    contentItemId: `CONTENT-S002-${item.id}-${anchorId}`,
    label: item.name,
    sectionId: anchorId,
    factRefs: [item.id],
    evidenceRefs: item.evidenceRefs || [item.source],
    stable: true,
    origin: "generated",
    claimType: item.type || "报告事实",
    presentationType: "fact",
    requiresEvidence: true,
    rendered: true,
    renderedValue: item.value,
    displayValue: item.value,
    displayUnit: item.unit || null,
  })));
  // The overview chart compares like-for-like final-approved-budget execution.
  // 2026 is an initial submission and is therefore shown in its own theme,
  // never mixed into the actual/budget execution series.
  const trend = [
    { month: "2024", approvedBudget: 1171.80, actualExpense: 1134.8747, execution: 96.8488, dataMarker: "SOURCE" },
    { month: "2025", approvedBudget: 1097.70, actualExpense: 861.7265, execution: 78.50, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS" }
  ];
  const annualComparisons = [
    { id: "ANNUAL-SB-2024-2025", unit: "设备管理部", execution2024: 84.25, execution2025: 63.20, executionDelta: -21.05, costToRevenue2024: 158.22, costToRevenue2025: 52.29, revenueYoY: 95.58, expenseYoY: -35.37, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", detailId: "BSD-S002-015" },
    { id: "ANNUAL-JS-2024-2025", unit: "技术部", execution2024: 90.12, execution2025: 77.97, executionDelta: -12.15, costToRevenue2024: 83.91, costToRevenue2025: 74.96, revenueYoY: -8.46, expenseYoY: -18.22, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", detailId: "BSD-S002-016" },
    { id: "ANNUAL-AQ-2024-2025", unit: "安全运行部", execution2024: 125.48, execution2025: 98.86, executionDelta: -26.62, costToRevenue2024: 69.95, costToRevenue2025: 112.63, revenueYoY: -48.98, expenseYoY: -17.84, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", detailId: "BSD-S002-017" }
  ];
  const submissionComparisons = [
    { id: "SUBMISSION-SB-2025-2026", unit: "设备管理部", revenue2025: 677.00, totalCost2025: 224.67, costToRevenue2025: 33.19, revenue2026: 746.60, totalCost2026: 336.404, costToRevenue2026: 45.06, ratioDelta: 11.87, revenueYoY: 10.28, costYoY: 49.73, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", detailId: "BSD-S002-012" },
    { id: "SUBMISSION-JS-2025-2026", unit: "技术部", revenue2025: 546.30, totalCost2025: 1695.15, costToRevenue2025: 310.30, revenue2026: 611.50, totalCost2026: 1765.94, costToRevenue2026: 288.79, ratioDelta: -21.51, revenueYoY: 11.93, costYoY: 4.18, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", detailId: "BSD-S002-013" },
    { id: "SUBMISSION-AQ-2025-2026", unit: "安全运行部", revenue2025: 406.80, totalCost2025: 663.02, costToRevenue2025: 162.98, revenue2026: 455.20, totalCost2026: 767.708, costToRevenue2026: 168.65, ratioDelta: 5.67, revenueYoY: 11.90, costYoY: 15.79, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", detailId: "BSD-S002-014" }
  ];
  const groupMetrics = {
    balance: 1097.7,
    cost: 74.35,
    floating: 2157.02,
    shortTerm: 14.35,
    foreign: 0,
    highCost: 235.97,
    credit: 235.97,
    approvedBudget: 1097.70,
    actualExpense: 861.73,
    executionRate: 78.50,
    budgetVariance: -235.97,
    costToRevenue: 74.35,
    grossMargin: 25.65,
    availableBalance: 2157.02,
    netInTransit: 163.38,
    positivePr: 273.09,
    decemberPositivePrShare: 8.59,
    decemberBudgetOccupancyShare: 14.35,
  };
  const comparisons = {};
  const names = departments.map((item) => item.name);
  for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) {
    const left = departmentUnits[names[i]], right = departmentUnits[names[j]];
    const approvedBudget = Number((left.approvedBudget + right.approvedBudget).toFixed(2));
    const actualExpense = Number((left.actualExpense + right.actualExpense).toFixed(2));
    comparisons[[names[i], names[j]].sort().join("|")] = {
      balance: approvedBudget,
      cost: Number((actualExpense / approvedBudget * 100).toFixed(2)),
      approvedBudget,
      actualExpense,
      executionRate: Number((actualExpense / approvedBudget * 100).toFixed(2)),
      availableBalance: Number((left.availableBalance + right.availableBalance).toFixed(2)),
      netInTransit: Number((left.netInTransit + right.netInTransit).toFixed(2)),
    };
  }
  comparisons[names.slice().sort().join("|")] = { balance: groupMetrics.approvedBudget, cost: groupMetrics.executionRate, approvedBudget: groupMetrics.approvedBudget, actualExpense: groupMetrics.actualExpense, executionRate: groupMetrics.executionRate, availableBalance: groupMetrics.availableBalance, netInTransit: groupMetrics.netInTransit };

  function supervisionAttentionNote(item) {
    const text = `${item.anomaly || ""} ${item.subject || ""}`;
    if (/可用立项余额|项目实施/.test(text)) return "核对项目实际、净在途占用、未结计提和剩余计划构成";
    if (/历史预算执行率|合法重复/.test(text)) return "核对合法重复凭证、期间修正和日期修正是否造成重复计量";
    if (/接近最终批准预算上限/.test(text)) return "核对剩余预算空间、未结采购占用和后续执行计划";
    if (/成本占收比|毛利率/.test(text)) return "核对收入确认、费用结构、申报依据和可优化空间";
    if (/年末采购|预算占用集中/.test(text)) return "核对12月采购发起、净在途占用和全年占比构成";
    if (/供应商|人月成本/.test(text)) return "核对同供应商同级别跨部门记录的预算净额、服务人月、人月成本和报价依据";
    if (/初始预算申报|初始预算|初始申报/.test(text)) return "核对收入依据、成本拆解、技术配置费和公共费用测算";
    if (/期间异常/.test(text)) return "查看源期间、修正期间和 CORRECTED 标识";
    if (/日期倒置/.test(text)) return "查看源日期、修正排序日期和 CORRECTED 标识";
    if (/重复凭证/.test(text)) return "查看合法多科目分录的业务原因和源记录";
    if (/执行率/.test(text)) return "核对跨年项目组合、收入费用变化和下一年度预算测算依据";
    return "查看指标口径、规则依据和明细证据";
  }

  const budgetSupervisionDetails = [
    { id: "BSD-S002-001", unit: "安全运行部", year: "2025", subject: "项目实施成本", period: "Q4", project: "PRJ-AQ-概率-2025-002", anomaly: "项目可用立项余额不足", action: "预算执行整改", actionRequestId: "AR-S002-001", dataMarker: "DERIVED", evidence: "C018-S002-v1 / RULE-001" },
    { id: "BSD-S002-002", unit: "安全运行部", year: "2024", subject: "部门公共费用", period: "全年", project: "ORG-AQ-FY2024-APPROVED", anomaly: "历史预算执行率超限", action: "费用管理复盘（已拒绝形成新待办）", actionRequestId: "AR-S002-002", dataMarker: "DERIVED", evidence: "C018-S002-v1 / RULE-002" },
    { id: "BSD-S002-003", unit: "安全运行部", year: "2025", subject: "部门公共费用", period: "全年", project: "ORG-AQ-FY2025-APPROVED", anomaly: "费用预算执行率98.86%，接近最终批准预算上限", action: "预算执行整改", actionRequestId: "AR-S002-004", dataMarker: "DERIVED", evidence: "C018-S002-v1 / RULE-002 / HIT-002-2025-AQ" },
    { id: "BSD-S002-004", unit: "安全运行部", year: "2025", subject: "成本费用表现", period: "全年", project: "ORG-AQ-FY2025-COST", anomaly: "成本占收比112.63%，费用高于收入净额", action: "费用管理优化核查", actionRequestId: "AR-S002-003", dataMarker: "DERIVED", evidence: "C018-S002-v1 / RULE-003 / HIT-003-2025-AQ" },
    { id: "BSD-S002-005", unit: "设备管理部", year: "2025", subject: "项目实施成本", period: "Q4", project: "PRJ-SB-设备-2025-002", anomaly: "年末采购/预算占用集中度异常", action: "采购占用清理", actionRequestId: "AR-S002-005", dataMarker: "DERIVED", evidence: "C018-S002-v1 / RULE-004" },
    { id: "BSD-S002-006", unit: "设备管理部、安全运行部", year: "2026", subject: "业务支持费-技术配置", period: "全年", project: "供应商3|初级", anomaly: "同供应商同级别人月成本最高/最低倍率1.20，等于边界值，未命中RULE-005", action: "无需 Action", actionRequestId: null, dataMarker: "SOURCE", evidence: "FY2026-INITIAL-SUBMISSION-v1 / 技术配置 / RULE-005 / 12.45万元÷12人月 vs 14.94万元÷12人月" },
    { id: "BSD-S002-007", unit: "技术部", year: "2025", subject: "部门公共费用", period: "初始申报", project: "ORG-JS-FY2025-INITIAL", anomaly: "初始预算申报异常", action: "预算申报依据补充", actionRequestId: "AR-S002-007", dataMarker: "DERIVED", evidence: "C018-S002-v1 / 分析建议" },
    { id: "BSD-S002-008", unit: "设备管理部", year: "2025", subject: "部门公共费用", period: "全年", project: "ORG-SB-FY2025-APPROVED", anomaly: "费用预算执行率63.20%，低于合理区间", action: "下一年度预算合理性复核", actionRequestId: "AR-S002-008", dataMarker: "DERIVED", evidence: "C018-S002-v1 / RULE-002 / HIT-002-2025-SB" },
    { id: "BSD-S002-009", unit: "安全运行部", year: "2025", subject: "实际凭证", period: "第13期→第12期", project: "VCH-S002-PERIOD-013", anomaly: "期间异常记录解释", action: "无需 Action", actionRequestId: null, dataMarker: "CORRECTED", evidence: "源期间保留 / 修正期间12 / 质量记录" },
    { id: "BSD-S002-010", unit: "技术部", year: "2025", subject: "实际凭证", period: "2025-12", project: "VCH-S002-DATE-REV-006", anomaly: "日期倒置记录解释", action: "无需 Action", actionRequestId: null, dataMarker: "CORRECTED", evidence: "源日期保留 / 修正排序日期 / 质量记录" },
    { id: "BSD-S002-011", unit: "设备管理部", year: "2025", subject: "实际凭证", period: "2025-09", project: "VCH-S002-DUP-021", anomaly: "合法重复凭证解释", action: "无需 Action", actionRequestId: null, dataMarker: "DERIVED", evidence: "21组合法业务记录 / 重复原因说明" },
    { id: "BSD-S002-012", unit: "设备管理部", year: "2025/2026", subject: "初始预算申报", period: "年度申报", project: "ORG-SB-FY2026-INITIAL", anomaly: "成本占收比由33.19%升至45.06%，成本增幅高于收入增幅", action: "关联同部门既有待决策事项；原事项依据为2025最终批准费用预算执行率63.20%偏低", actionRequestId: "AR-S002-008", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", evidence: "FY2025-INITIAL-SUBMISSION-v1 / FY2026-INITIAL-SUBMISSION-v1 / MET-001 / 关联HIT-002-2025-SB（本趋势不直接触发）" },
    { id: "BSD-S002-013", unit: "技术部", year: "2025/2026", subject: "初始预算申报", period: "年度申报", project: "ORG-JS-FY2026-INITIAL", anomaly: "2026成本占收比288.79%，虽同比下降21.51个百分点仍显著高于100%", action: "预算申报依据补充", actionRequestId: "AR-S002-007", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", evidence: "FY2025-INITIAL-SUBMISSION-v1 / FY2026-INITIAL-SUBMISSION-v1 / MET-001" },
    { id: "BSD-S002-014", unit: "安全运行部", year: "2025/2026", subject: "初始预算申报", period: "年度申报", project: "ORG-AQ-FY2026-INITIAL", anomaly: "2026成本占收比168.65%，较2025上升5.67个百分点", action: "费用管理优化核查建议（尚未形成Action Request）", actionRequestId: null, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", evidence: "FY2025-INITIAL-SUBMISSION-v1 / FY2026-INITIAL-SUBMISSION-v1 / MET-001" },
    { id: "BSD-S002-015", unit: "设备管理部", year: "2024/2025", subject: "最终批准费用预算执行", period: "年度实际", project: "ORG-SB-ANNUAL-2024-2025", anomaly: "执行率由84.25%降至63.20%，收入同比增长95.58%、费用同比下降35.37%", action: "下一年度预算合理性复核", actionRequestId: "AR-S002-008", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", evidence: "FY2024-APPROVED-FINAL-v1 / FY2025-APPROVED-FINAL-v1 / FY2024-ACTUAL-v1 / FY2025-ACTUAL-v1 / MET-007" },
    { id: "BSD-S002-016", unit: "技术部", year: "2024/2025", subject: "最终批准费用预算执行", period: "年度实际", project: "ORG-JS-ANNUAL-2024-2025", anomaly: "执行率由90.12%降至77.97%，收入同比下降8.46%、费用同比下降18.22%", action: "核实项目组合变化与下一年度预算依据（尚未形成Action Request）", actionRequestId: null, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", evidence: "FY2024-APPROVED-FINAL-v1 / FY2025-APPROVED-FINAL-v1 / FY2024-ACTUAL-v1 / FY2025-ACTUAL-v1 / MET-007" },
    { id: "BSD-S002-017", unit: "安全运行部", year: "2024/2025", subject: "最终批准费用预算执行", period: "年度实际", project: "ORG-AQ-ANNUAL-2024-2025", anomaly: "执行率由125.48%降至98.86%；2025成本占收比112.63%，费用高于收入净额", action: "费用管理优化核查", actionRequestId: "AR-S002-003", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", evidence: "FY2024-APPROVED-FINAL-v1 / FY2025-APPROVED-FINAL-v1 / FY2024-ACTUAL-v1 / FY2025-ACTUAL-v1 / MET-001 / RULE-003" }
  ].map((item) => ({ ...item, attentionNote: supervisionAttentionNote(item), action: supervisionAttentionNote(item), actionRequestId: null }));

  // Six dashboard topics keep the source report's drill grain without turning
  // workbook tabs into platform objects.  The workbench supplies the full S002
  // scenario data through the same-origin parent; direct module access keeps a
  // small deterministic fallback so the copied baseline page never renders an
  // empty dashboard.  Supplemental rows are always marked SYNTHETIC_FOR_DEMO.
  function readRootScenarioData() {
    try {
      return window.parent !== window && window.parent?.S002_DATA ? cloneValue(window.parent.S002_DATA) : null;
    } catch (_) {
      return null;
    }
  }

  const rootScenarioData = readRootScenarioData();
  const roundDashboard = (value, digits = 4) => Number(Number(value || 0).toFixed(digits));
  const rootProjects = Array.isArray(rootScenarioData?.projects) ? rootScenarioData.projects : [];
  const rootProjectById = new Map(rootProjects.map((item) => [item.projectId, item]));

  function costDashboardDetails() {
    const source = Array.isArray(rootScenarioData?.expenseDetails) ? rootScenarioData.expenseDetails : [];
    if (source.length) return source.filter((item) => Number(item.year) === 2025).map((item) => ({
      id: item.id,
      unit: item.department,
      year: Number(item.year),
      subject: item.subject,
      period: item.period,
      periodName: item.periodName,
      project: item.projectId || "部门公共费用",
      approvedBudget: Number(item.approvedBudget || 0),
      actual: Number(item.actual || 0),
      variance: Number((Number(item.actual || 0) - Number(item.approvedBudget || 0)).toFixed(4)),
      executionRate: Number(item.approvedBudget || 0) ? Number((Number(item.actual || 0) / Number(item.approvedBudget || 0) * 100).toFixed(4)) : null,
      dataMarker: item.dataMarker || "SYNTHETIC_FOR_DEMO",
      derivation: item.derivation || "年度×部门总额可回链；科目×季度分配用于演示下钻。"
    }));
    return departments.map((item) => ({
      id: `COST-FALLBACK-${item.id}`,
      unit: item.name,
      year: 2025,
      subject: "部门费用合计",
      period: "全年",
      periodName: "全年",
      project: `${item.id}-FY2025`,
      approvedBudget: item.budget,
      actual: item.actual,
      variance: Number((Number(item.actual || 0) - Number(item.budget || 0)).toFixed(4)),
      executionRate: Number(item.budget || 0) ? Number((Number(item.actual || 0) / Number(item.budget || 0) * 100).toFixed(4)) : null,
      dataMarker: "DERIVED",
      derivation: "直接访问模块时使用部门汇总事实。"
    }));
  }

  function projectDashboardDetails() {
    if (rootProjects.length) return rootProjects.map((item) => ({
      id: item.projectId,
      unit: item.department,
      project: item.projectId,
      name: item.name,
      launchAmount: Number(item.launchAmount || item.approvedAmount || 0),
      actualUsed: Number(item.actualUsed || 0),
      netInTransit: Number(item.netInTransit || 0),
      accrual: Number(item.accrual || 0),
      usedAmount: Number(item.recalculatedUsed ?? (Number(item.actualUsed || 0) + Number(item.netInTransit || 0) + Number(item.accrual || 0))),
      availableBalance: Number(item.availableBalance || 0),
      status: item.status || (Number(item.availableBalance || 0) < 0 ? "余额不足" : "可用"),
      dataMarker: item.dataMarker || "DERIVED",
      netInTransitDataMarker: item.netInTransitDataMarker || "SOURCE"
    }));
    return [
      { id: "PRJ-SB-设备-2025-002", unit: "设备管理部", project: "PRJ-SB-设备-2025-002", name: "设备维护", launchAmount: 583, actualUsed: 211.9887, netInTransit: 49.04, accrual: 0, usedAmount: 261.0287, availableBalance: 321.9713, status: "可用", dataMarker: "DERIVED" },
      { id: "PRJ-JS-热能-2025-002", unit: "技术部", project: "PRJ-JS-热能-2025-002", name: "热能动力研究", launchAmount: 165, actualUsed: 78.7408, netInTransit: 52.25, accrual: 0, usedAmount: 130.9908, availableBalance: 34.0092, status: "可用", dataMarker: "DERIVED" },
      { id: "PRJ-AQ-概率-2025-002", unit: "安全运行部", project: "PRJ-AQ-概率-2025-002", name: "概率安全分析", launchAmount: 124, actualUsed: 82.4138, netInTransit: 62.09, accrual: 0, usedAmount: 144.5038, availableBalance: -20.5038, status: "余额不足", dataMarker: "DERIVED" }
    ];
  }

  const travelDashboardDetails = [
    { id: "TRAVEL-SB-2025-2026", unit: "设备管理部", priorYear: 17.55, currentYear: 29.86, delta: 12.31, yoy: 70.14, dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", note: "2025实际与2026初始申报总额来自附件；项目拆分含演示补齐，第二项校准0.01万元以保持合计守恒。", details: [
      { project: "PRJ-SB-设备-2024-001", name: "设备维护（存量现场）", priorYear: 5.20, currentYear: 9.61, delta: 4.41, dataMarker: "SYNTHETIC_FOR_DEMO" },
      { project: "PRJ-SB-设备-2025-002", name: "设备维护（年度检修）", priorYear: 5.85, currentYear: 10.29, delta: 4.44, dataMarker: "SYNTHETIC_FOR_DEMO" },
      { project: "PRJ-SB-设备-2025-003", name: "设备维护（专项巡检）", priorYear: 6.50, currentYear: 9.96, delta: 3.46, dataMarker: "SYNTHETIC_FOR_DEMO" }
    ] },
    { id: "TRAVEL-JS-2025-2026", unit: "技术部", priorYear: 36.11, currentYear: 24.46, delta: -11.65, yoy: -32.26, dataMarker: "SYNTHETIC_FOR_DEMO", note: "附件未提供技术部逐项目差旅，按项目组合合理补齐用于演示。", details: [
      { project: "PRJ-JS-热能-2025-002", name: "热能项目交付", priorYear: 12.30, currentYear: 8.52, delta: -3.78, dataMarker: "SYNTHETIC_FOR_DEMO" },
      { project: "PRJ-JS-经验-2025-002", name: "经验反馈改进", priorYear: 11.46, currentYear: 7.86, delta: -3.60, dataMarker: "SYNTHETIC_FOR_DEMO" },
      { project: "PRJ-JS-新技-2025-002", name: "新技术应用", priorYear: 12.35, currentYear: 8.08, delta: -4.27, dataMarker: "SYNTHETIC_FOR_DEMO" }
    ] },
    { id: "TRAVEL-AQ-2025-2026", unit: "安全运行部", priorYear: 43.66, currentYear: 18.21, delta: -25.45, yoy: -58.29, dataMarker: "SYNTHETIC_FOR_DEMO", note: "附件未提供安全运行部逐项目差旅，按核查项目组合合理补齐用于演示。", details: [
      { project: "PRJ-AQ-概率-2025-002", name: "概率安全分析", priorYear: 15.20, currentYear: 6.45, delta: -8.75, dataMarker: "SYNTHETIC_FOR_DEMO" },
      { project: "PRJ-AQ-灾害-2025-002", name: "灾害防护", priorYear: 14.66, currentYear: 5.98, delta: -8.68, dataMarker: "SYNTHETIC_FOR_DEMO" },
      { project: "PRJ-AQ-安全-2025-002", name: "安全评估", priorYear: 13.80, currentYear: 5.78, delta: -8.02, dataMarker: "SYNTHETIC_FOR_DEMO" }
    ] }
  ];

  const accrualDashboardDetails = [
    { id: "ACCRUAL-SB-001", unit: "设备管理部", project: "PRJ-SB-设备-2024-001", projectName: "设备维护（存量现场）", estimated: 24.88, settled: 20.00, delta: -4.88, varianceRate: 19.61, label: "高关注", dataMarker: "SOURCE" },
    { id: "ACCRUAL-SB-002", unit: "设备管理部", project: "PRJ-SB-设备-2025-002", projectName: "设备维护（年度检修）", estimated: 26.20, settled: 21.00, delta: -5.20, varianceRate: 19.85, label: "高关注", dataMarker: "SOURCE" },
    { id: "ACCRUAL-JS-001", unit: "技术部", project: "PRJ-JS-热能-2024-001", projectName: "热能动力研究", estimated: 8.00, settled: 6.80, delta: -1.20, varianceRate: 15.00, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-JS-002", unit: "技术部", project: "PRJ-JS-热能-2025-002", projectName: "热能项目交付", estimated: 9.50, settled: 8.46, delta: -1.04, varianceRate: 10.95, label: "关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-JS-003", unit: "技术部", project: "PRJ-JS-经验-2024-001", projectName: "经验反馈改进", estimated: 8.50, settled: 7.20, delta: -1.30, varianceRate: 15.29, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-JS-004", unit: "技术部", project: "PRJ-JS-经验-2025-002", projectName: "经验改进交付", estimated: 8.00, settled: 6.90, delta: -1.10, varianceRate: 13.75, label: "关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-JS-005", unit: "技术部", project: "PRJ-JS-新技-2024-001", projectName: "新技术应用", estimated: 6.40, settled: 6.40, delta: 0, varianceRate: 0, label: "正常", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-JS-006", unit: "技术部", project: "PRJ-JS-新技-2025-002", projectName: "新技术应用交付", estimated: 5.90, settled: 5.90, delta: 0, varianceRate: 0, label: "正常", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-AQ-001", unit: "安全运行部", project: "PRJ-AQ-概率-2024-001", projectName: "概率安全分析", estimated: 7.10, settled: 6.00, delta: -1.10, varianceRate: 15.49, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-AQ-002", unit: "安全运行部", project: "PRJ-AQ-概率-2025-002", projectName: "概率安全分析交付", estimated: 7.62, settled: 6.40, delta: -1.22, varianceRate: 16.01, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-AQ-003", unit: "安全运行部", project: "PRJ-AQ-灾害-2024-001", projectName: "灾害防护", estimated: 7.80, settled: 6.50, delta: -1.30, varianceRate: 16.67, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-AQ-004", unit: "安全运行部", project: "PRJ-AQ-灾害-2025-002", projectName: "灾害防护交付", estimated: 8.35, settled: 7.00, delta: -1.35, varianceRate: 16.17, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-AQ-005", unit: "安全运行部", project: "PRJ-AQ-安全-2024-001", projectName: "安全评估", estimated: 8.40, settled: 7.00, delta: -1.40, varianceRate: 16.67, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { id: "ACCRUAL-AQ-006", unit: "安全运行部", project: "PRJ-AQ-安全-2025-002", projectName: "安全评估交付", estimated: 8.15, settled: 6.80, delta: -1.35, varianceRate: 16.56, label: "高关注", dataMarker: "SYNTHETIC_FOR_DEMO" }
  ];

  function concentrationDashboardDetails() {
    const occupancy = rootScenarioData?.occupancy;
    const byProject = Array.isArray(occupancy?.byProject) ? occupancy.byProject : [];
    const examples = Array.isArray(occupancy?.examples) ? occupancy.examples : [];
    if (byProject.length) return byProject.map((item) => ({
      id: `CONCENTRATION-${item.projectId}`,
      unit: item.department,
      project: item.projectId,
      projectName: rootProjectById.get(item.projectId)?.name || "采购占用项目",
      positivePr: Number(item.positivePr || 0),
      decemberPositivePr: roundDashboard(Number(item.positivePr || 0) * Number(item.decemberShare || 0), 2),
      decemberPositivePrShare: Number(item.decemberShare || 0) * 100,
      netInTransit: Number(item.netInTransit || 0),
      decemberNetInTransit: Number(item.decemberNetInTransit || 0),
      decemberBudgetOccupancyShare: Number(item.budgetOccupancyDecemberShare || 0) * 100,
      dataMarker: item.dataMarker || "SOURCE",
      details: examples.filter((event) => event.projectId === item.projectId).map((event) => ({ ...event }))
    }));
    return [
      { id: "CONCENTRATION-PRJ-SB-设备-2025-002", unit: "设备管理部", project: "PRJ-SB-设备-2025-002", projectName: "设备维护", positivePr: 85.57, decemberPositivePr: 9.29, decemberPositivePrShare: 10.86, netInTransit: 49.04, decemberNetInTransit: 9.29, decemberBudgetOccupancyShare: 18.94, dataMarker: "SOURCE", details: [] },
      { id: "CONCENTRATION-PRJ-JS-热能-2025-002", unit: "技术部", project: "PRJ-JS-热能-2025-002", projectName: "热能动力研究", positivePr: 93.99, decemberPositivePr: 6.55, decemberPositivePrShare: 6.97, netInTransit: 52.25, decemberNetInTransit: 6.55, decemberBudgetOccupancyShare: 12.54, dataMarker: "SOURCE", details: [] },
      { id: "CONCENTRATION-PRJ-AQ-概率-2025-002", unit: "安全运行部", project: "PRJ-AQ-概率-2025-002", projectName: "概率安全分析", positivePr: 93.53, decemberPositivePr: 7.61, decemberPositivePrShare: 8.14, netInTransit: 62.09, decemberNetInTransit: 7.61, decemberBudgetOccupancyShare: 12.26, dataMarker: "SOURCE", details: [] }
    ];
  }

  // 供应商/人月成本专题使用“技术配置”来源的净额和服务人月原子值。
  // 这里不再以中位价或单条报价作为比较基准，而是先形成同口径组，再
  // 比较组内各部门的最高/最低人月成本。若根场景尚未注入新字段，旧演示
  // 行只作为兼容性回退，并明确标记为 DERIVED_LEGACY_FALLBACK。
  function supplierTaxKey(value) {
    if (value == null || value === "") return "未知";
    const text = String(value).trim();
    const number = Number(text.replace("%", ""));
    if (!Number.isFinite(number)) return text;
    return `${number > 1 ? number : number * 100}%`;
  }
  function supplierNetAmountWan(item) {
    const value = [item.netAmountWan, item.annualNetAmountWan, item.budgetNetAmountWan, item.netAmount, item.amountWan]
      .map((candidate) => Number(candidate)).find((candidate) => Number.isFinite(candidate));
    if (Number.isFinite(value)) return value;
    const legacyUnitPrice = Number(item.unitPrice);
    const months = Number(item.serviceMonths || item.personMonths || item.months);
    return Number.isFinite(legacyUnitPrice) && Number.isFinite(months) && months > 0 ? legacyUnitPrice * months / 10000 : null;
  }
  function supplierServiceMonths(item) {
    const value = [item.serviceMonths, item.personMonths, item.months]
      .map((candidate) => Number(candidate)).find((candidate) => Number.isFinite(candidate));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  function supplierMonthlyNetCostRmb(item) {
    const direct = [item.monthlyNetCostRmb, item.monthlyCostRmb, item.netUnitCostRmb]
      .map((candidate) => Number(candidate)).find((candidate) => Number.isFinite(candidate));
    if (Number.isFinite(direct)) return direct;
    const netAmountWan = supplierNetAmountWan(item);
    const serviceMonths = supplierServiceMonths(item);
    return Number.isFinite(netAmountWan) && Number.isFinite(serviceMonths) && serviceMonths > 0
      ? netAmountWan * 10000 / serviceMonths
      : Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : null;
  }
  function supplierMonthlyNetCostWan(item) {
    const direct = [item.monthlyNetCostWan, item.monthlyCostWan, item.netUnitCostWan]
      .map((candidate) => Number(candidate)).find((candidate) => Number.isFinite(candidate));
    if (Number.isFinite(direct)) return direct;
    const rmb = supplierMonthlyNetCostRmb(item);
    return Number.isFinite(rmb) ? rmb / 10000 : null;
  }
  function supplierGroupKey(item) {
    return [
      item.year ?? "未知年度",
      item.budgetSubject || item.subject || item.budgetAccount || "业务支持费-技术配置",
      item.personCategory || item.category || "技术服务",
      item.supplier || "未知供应商",
      item.level || "未知级别",
      item.currency || "CNY",
      supplierTaxKey(item.taxRate),
      item.unit || item.pricingUnit || "元/人月"
    ].map((value) => String(value).trim()).join("|");
  }
  function supplierSourceRows() {
    const source = Array.isArray(rootScenarioData?.supplierBenchmarks) ? rootScenarioData.supplierBenchmarks : [];
    if (source.length) return source;
    return [
      { year: 2026, department: "设备管理部", projectId: "PRJ-SB-设备-2025-003", budgetSubject: "业务支持费-技术配置", personCategory: "技术服务", level: "初级", supplier: "供应商3", unit: "元/人月", serviceMonths: 12, netAmountWan: 12.45, taxRate: "6%", currency: "CNY", sourceDataMarker: "SOURCE", dataMarker: "DERIVED_LEGACY_FALLBACK" },
      { year: 2026, department: "安全运行部", projectId: "PRJ-AQ-灾害-2025-002", budgetSubject: "业务支持费-技术配置", personCategory: "技术服务", level: "初级", supplier: "供应商3", unit: "元/人月", serviceMonths: 12, netAmountWan: 14.94, taxRate: "6%", currency: "CNY", sourceDataMarker: "SOURCE", dataMarker: "DERIVED_LEGACY_FALLBACK" },
      { year: 2026, department: "设备管理部", projectId: "PRJ-SB-设备-2025-002", budgetSubject: "业务支持费-技术配置", personCategory: "技术服务", level: "初级", supplier: "供应商2", unit: "元/人月", serviceMonths: 12, netAmountWan: 12.45, taxRate: "6%", currency: "CNY", sourceDataMarker: "SOURCE", dataMarker: "DERIVED_LEGACY_FALLBACK" },
      { year: 2026, department: "安全运行部", projectId: "PRJ-AQ-灾害-2025-003", budgetSubject: "业务支持费-技术配置", personCategory: "技术服务", level: "初级", supplier: "供应商2", unit: "元/人月", serviceMonths: 12, netAmountWan: 12.45, taxRate: "6%", currency: "CNY", sourceDataMarker: "SOURCE", dataMarker: "DERIVED_LEGACY_FALLBACK" }
    ];
  }
  function supplierDashboardDetails() {
    const rows = supplierSourceRows().map((item, index) => {
      const netAmountWan = supplierNetAmountWan(item);
      const serviceMonths = supplierServiceMonths(item);
      const monthlyNetCostRmb = supplierMonthlyNetCostRmb(item);
      const monthlyNetCostWan = supplierMonthlyNetCostWan(item);
      const fallback = item.dataMarker === "DERIVED_LEGACY_FALLBACK" || (!item.netAmountWan && !item.annualNetAmountWan && !item.budgetNetAmountWan && !item.netAmount);
      return {
        id: item.id || `SUPPLIER-${String(index + 1).padStart(3, "0")}`,
        year: Number(item.year),
        department: item.department || item.unitName || item.organization || "未标注部门",
        projectId: item.projectId || item.project || item.projectCode || "未标注项目",
        projectName: item.projectName || item.projectTitle || item.project || "技术配置",
        budgetSubject: item.budgetSubject || item.subject || item.budgetAccount || "业务支持费-技术配置",
        personCategory: item.personCategory || item.category || "技术服务",
        category: item.personCategory || item.category || "技术服务",
        level: item.level || item.serviceLevel || "未标注级别",
        supplier: item.supplier || item.supplierName || "未标注供应商",
        unit: item.unit || item.pricingUnit || "元/人月",
        pricingUnit: item.pricingUnit || item.unit || "元/人月",
        serviceMonths,
        netAmountWan,
        monthlyNetCostWan,
        monthlyNetCostRmb,
        taxRate: supplierTaxKey(item.taxRate),
        currency: item.currency || "CNY",
        sourceDataMarker: item.sourceDataMarker || item.dataMarker || "SOURCE",
        dataMarker: item.dataMarker || (fallback ? "DERIVED_LEGACY_FALLBACK" : "DERIVED"),
        legacyFallback: fallback,
        groupKey: supplierGroupKey(item)
      };
    }).filter((item) => Number.isFinite(item.monthlyNetCostRmb) && item.monthlyNetCostRmb > 0);
    const grouped = rows.reduce((result, row) => {
      (result[row.groupKey] ||= []).push(row);
      return result;
    }, {});
    return Object.values(grouped).flatMap((group) => {
      const departmentsInGroup = [...new Set(group.map((item) => item.department))];
      const costs = group.map((item) => item.monthlyNetCostRmb).filter((value) => Number.isFinite(value) && value > 0);
      const minMonthlyNetCostRmb = costs.length ? Math.min(...costs) : null;
      const maxMonthlyNetCostRmb = costs.length ? Math.max(...costs) : null;
      const ratio = minMonthlyNetCostRmb > 0 ? maxMonthlyNetCostRmb / minMonthlyNetCostRmb : null;
      const crossDepartment = departmentsInGroup.length > 1;
      const anomaly = crossDepartment && Number.isFinite(ratio) && ratio > 1.2;
      const status = !crossDepartment ? "单部门样本" : anomaly ? "异常" : "正常";
      return group.map((item) => ({
        ...item,
        departmentCount: departmentsInGroup.length,
        departments: departmentsInGroup,
        minMonthlyNetCostRmb,
        maxMonthlyNetCostRmb,
        minMonthlyNetCostWan: Number.isFinite(minMonthlyNetCostRmb) ? minMonthlyNetCostRmb / 10000 : null,
        maxMonthlyNetCostWan: Number.isFinite(maxMonthlyNetCostRmb) ? maxMonthlyNetCostRmb / 10000 : null,
        maxMinRatio: Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : null,
        priceRatio: Number.isFinite(ratio) ? Number(ratio.toFixed(4)) : null,
        comparisonEligible: crossDepartment,
        anomaly,
        status,
        details: group.map((member) => ({ ...member }))
      }));
    });
  }

  function supplierInstitutionSummaries(rows = supplierDashboardDetails()) {
    const groups = rows.reduce((result, row) => {
      (result[row.groupKey] ||= []).push(row);
      return result;
    }, {});
    const summaries = Object.values(groups).map((group) => {
      const first = group[0] || {};
      const representative = group.find((item) => item.anomaly) || first;
      const cost = Number(representative.maxMinRatio);
      const netAmount = group.reduce((sum, item) => sum + Number(item.netAmountWan || 0), 0);
      return {
        name: `${first.supplier} · ${first.level}`,
        supplier: first.supplier,
        level: first.level,
        category: first.personCategory,
        year: first.year,
        balance: Number(netAmount.toFixed(4)),
        budgetAmount: Number(netAmount.toFixed(4)),
        share: 0,
        cost: Number.isFinite(cost) ? cost : null,
        priceRatio: Number.isFinite(cost) ? cost : null,
        maxMinRatio: Number.isFinite(cost) ? cost : null,
        minMonthlyNetCostRmb: representative.minMonthlyNetCostRmb,
        maxMonthlyNetCostRmb: representative.maxMonthlyNetCostRmb,
        departmentCount: representative.departmentCount,
        count: group.length,
        anomaly: Boolean(representative.anomaly),
        status: representative.status,
        details: group.map((item) => ({ ...item }))
      };
    });
    const total = summaries.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0);
    return summaries.map((item) => ({ ...item, share: total ? Number((item.budgetAmount / total * 100).toFixed(2)) : 0 }));
  }

  // Replace the copied baseline institution summaries with the same supplier
  // group facts used by the dashboard. This keeps Rule drawers and report
  // appendices on one evidence grain and removes the old median-price sample.
  const supplierInstitutionRows = supplierInstitutionSummaries();
  departments.forEach((department) => {
    departmentUnits[department.name].institutions = supplierInstitutionRows.filter((item) =>
      item.details.some((detail) => detail.department === department.name)
    );
  });

  const dashboardSourceDetails = {
    cost: costDashboardDetails(),
    projects: projectDashboardDetails(),
    travel: travelDashboardDetails,
    accrual: accrualDashboardDetails,
    concentration: concentrationDashboardDetails(),
    suppliers: supplierDashboardDetails(),
    sourceNote: "来源：设备管理部预算分析报告与S002场景事实包；差旅、计提及跨单位补齐项逐条标记SYNTHETIC_FOR_DEMO。所有专题只读展示，不生成Action Request。"
  };

  // Dashboard warnings are report-owned presentation records. They bind an
  // already Published Action Type to either a real Rule hit or an explicitly
  // labelled analysis suggestion. The latter never masquerades as a Rule hit.
  // Selecting a record only prepares a standard C011 Action Request draft;
  // Decision Center remains the owner of receipt, decision and todo state.
  const legacyDashboardActionWarnings = [
    {
      id: "WARN-S002-001",
      severity: "高",
      sourceKind: "rule-hit",
      sourceLabel: "Rule 命中",
      title: "项目可用立项余额不足",
      unit: "安全运行部",
      subjectId: "PRJ-AQ-概率-2025-002",
      subjectName: "概率安全分析项目",
      subjectObjectType: "OBJ-BUDGET-PROJECT",
      period: "2025 · Q4",
      metric: { id: "MET-006", name: "项目可用立项余额", value: "-20.50 万元", explanation: "立项金额 - 实际 - 净在途占用 - 未结计提" },
      rule: { id: "RULE-001", code: "R01", name: "项目可用立项余额为负", version: "S002-RULE-v1", status: "命中", evaluatedAt: FORMED_AT, branch: "availableBalance < 0", hitEvidence: "项目可用立项余额 -20.50 万元", evaluationId: "RULE-EVAL-S002-R01-20260815", resultVersion: "S002-RULE-RESULT-v1" },
      actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION",
      actionType: "预算执行整改",
      assignee: "安全运行部预算承接人",
      operator: "平台管理员",
      recommendation: "创建预算执行整改草稿，核实项目实际、占用与后续计划；仅待人工决定，不覆盖最终批准预算。",
      snapshotId: "EVD-S002-WARN-001-20260815",
      evidenceRefs: ["C018-S002-v1", "RULE-001", "MET-006", "PRJ-AQ-概率-2025-002"],
      suppliers: [],
      procurements: ["PRJ-AQ-概率-2025-002"],
      dataMarker: "DERIVED"
    },
    {
      id: "WARN-S002-002",
      severity: "中",
      sourceKind: "rule-hit",
      sourceLabel: "Rule 命中",
      title: "费用预算执行率接近上限",
      unit: "安全运行部",
      subjectId: "ORG-AQ-FY2025",
      subjectName: "安全运行部 · 2025最终批准预算",
      subjectObjectType: "OBJ-BUDGET-DEPARTMENT",
      period: "2025 · 全年",
      metric: { id: "MET-007", name: "预算执行率", value: "98.86%", explanation: "实际费用 / 2025最终批准费用预算" },
      rule: { id: "RULE-002", code: "R02", name: "费用预算执行率接近上限", version: "S002-RULE-v1", status: "命中", evaluatedAt: FORMED_AT, branch: "expenseExecutionRate >= 90%", hitEvidence: "安全运行部费用预算执行率 98.86%", evaluationId: "RULE-EVAL-S002-AQ-20260815", resultVersion: "S002-RULE-RESULT-v1" },
      actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW",
      actionType: "费用管理优化核查",
      assignee: "安全运行部预算承接人",
      operator: "平台管理员",
      recommendation: "核对费用结构、科目余额和后续采购计划，形成费用管理优化核查草稿；不自动调账。",
      snapshotId: "EVD-S002-WARN-002-20260815",
      evidenceRefs: ["C018-S002-v1", "RULE-002", "MET-007", "ORG-AQ-FY2025"],
      suppliers: [],
      procurements: [],
      dataMarker: "DERIVED"
    },
    {
      id: "WARN-S002-003",
      severity: "高",
      sourceKind: "rule-hit",
      sourceLabel: "Rule 命中",
      title: "年末采购/预算占用集中度异常",
      unit: "设备管理部",
      subjectId: "PRJ-SB-设备-2025-002",
      subjectName: "设备管理部 · 采购占用项目",
      subjectObjectType: "OBJ-BUDGET-PROJECT",
      period: "2025 · Q4",
      metric: { id: "MET-009", name: "年末采购/预算占用集中度", value: "18.94%", explanation: "12月净在途占用 9.29 / 全年 49.04 万元" },
      rule: { id: "RULE-004", code: "R04", name: "年末采购/预算占用集中", version: "S002-RULE-v1", status: "命中", evaluatedAt: FORMED_AT, branch: "decemberBudgetOccupancyShare >= 10%", hitEvidence: "设备项目12月净在途占用占全年 18.94%", evaluationId: "RULE-EVAL-S002-SB-20260815", resultVersion: "S002-RULE-RESULT-v1" },
      actionTypeId: "ACT-PROCUREMENT-COMMITMENT-CLEANUP",
      actionType: "采购占用清理",
      assignee: "设备管理部采购承接人",
      operator: "平台管理员",
      recommendation: "生成采购占用清理核对草稿；只形成平台内待办，不直接释放外部占用。",
      snapshotId: "EVD-S002-WARN-003-20260815",
      evidenceRefs: ["C018-S002-v1", "RULE-004", "MET-009", "PRJ-SB-设备-2025-002"],
      suppliers: ["供应商4"],
      procurements: ["PO-ORG-S002-SB-001"],
      dataMarker: "DERIVED"
    },
    {
      id: "WARN-S002-004",
      severity: "中",
      sourceKind: "rule-hit",
      sourceLabel: "Rule 命中",
      title: "供应商同级人月成本差异",
      unit: "安全运行部、设备管理部",
      subjectId: "SUPPLIER-GROUP-S002-2026-S3-BEGINNER",
      subjectName: "供应商3 · 初级 · 业务支持费-技术配置",
      subjectObjectType: "OBJ-BUDGET-PROCUREMENT",
      period: "2026 · 全年",
      metric: { id: "RULE-005-SUPPORT", name: "同供应商同级别人月成本最高/最低倍率", value: "待按源技术配置评估", explanation: "人月成本=年度预算净额（万元）×10000÷服务人月；仅跨部门同口径组比较" },
      rule: { id: "RULE-005", code: "R05", name: "供应商同级人月成本差异", version: "S002-RULE-v1", status: "按可比组评估", evaluatedAt: FORMED_AT, branch: "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2", hitEvidence: "以同供应商同级别跨部门组的最高/最低人月成本倍率判定" , evaluationId: "RULE-EVAL-S002-PRICE-20260815", resultVersion: "S002-RULE-RESULT-v1" },
      actionTypeId: "ACT-SUPPLIER-PRICE-REVIEW",
      actionType: "供应商价格复核",
      assignee: "采购价格复核承接人",
      operator: "平台管理员",
      recommendation: "创建供应商价格复核草稿；不触发供应商系统或自动变更采购价格。",
      snapshotId: "EVD-S002-WARN-004-20260815",
      evidenceRefs: ["C018-S002-v1", "RULE-005", "SUPPLIER-GROUP-S002-2026-S3-BEGINNER"],
      suppliers: ["供应商3"],
      procurements: [],
      dataMarker: "DERIVED"
    },
    {
      id: "WARN-S002-005",
      severity: "中",
      sourceKind: "analysis-suggestion",
      sourceLabel: "分析建议（非Rule命中）",
      title: "初始预算申报需补充说明",
      unit: "技术部",
      subjectId: "ORG-JS-FY2025-INITIAL",
      subjectName: "技术部 · 2025初始申报预算",
      subjectObjectType: "OBJ-BUDGET-DEPARTMENT",
      period: "2025 · 初始申报",
      metric: { id: "MET-001", name: "成本占收比", value: "310.30%", explanation: "2025初始申报总成本1,695.15万元 / 收入546.30万元；仅作为分析建议依据" },
      rule: null,
      actionTypeId: "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT",
      actionType: "预算申报依据补充",
      assignee: "技术部预算申报承接人",
      operator: "平台管理员",
      recommendation: "生成预算申报依据补充草稿，要求补充收入依据、成本拆解和测算说明；不自动退回预算申报。",
      snapshotId: "EVD-S002-WARN-005-20260815",
      evidenceRefs: ["C018-S002-v1", "SUG-001", "MET-001", "ORG-JS-FY2025-INITIAL"],
      suppliers: [],
      procurements: [],
      dataMarker: "DERIVED"
    },
    {
      id: "WARN-S002-006",
      severity: "中",
      sourceKind: "rule-hit",
      sourceLabel: "Rule 命中",
      title: "费用预算执行率偏低",
      unit: "设备管理部",
      subjectId: "ORG-SB-FY2025",
      subjectName: "设备管理部 · 2025最终批准预算",
      subjectObjectType: "OBJ-BUDGET-DEPARTMENT",
      period: "2025 · 全年",
      metric: { id: "MET-007", name: "预算执行率", value: "63.20%", explanation: "实际费用 255.66 / 最终批准费用预算 404.50 万元" },
      rule: { id: "RULE-002", code: "R02", name: "费用预算执行偏离合理区间", version: "S002-RULE-v1", status: "命中", evaluatedAt: FORMED_AT, branch: "expenseExecutionRate <= 70%", hitEvidence: "设备管理部费用预算执行率 63.20%", evaluationId: "RULE-EVAL-S002-SB-20260815", resultVersion: "S002-RULE-RESULT-v1" },
      actionTypeId: "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW",
      actionType: "下一年度预算合理性复核",
      assignee: "设备管理部年度预算编制负责人",
      operator: "平台管理员",
      recommendation: "复核未执行计划、采购占用和下一年度预算测算依据；不覆盖最终批准预算。",
      snapshotId: "EVD-S002-WARN-006-20260815",
      evidenceRefs: ["C018-S002-v1", "HIT-002-2025-SB", "RULE-002", "MET-007", "ORG-SB-FY2025"],
      suppliers: [],
      procurements: [],
      dataMarker: "DERIVED"
    }
  ];

  const dashboardCandidateFallback = [
    { id: "DASH-EXEC-AQ-2025", relatedSourceId: "HIT-001", sourceType: "report-dashboard-analysis", title: "概率安全分析项目预算覆盖不足预警", subjectId: "PRJ-AQ-概率-2025-002", subjectName: "安全运行部 · 概率安全分析项目", department: "安全运行部", year: 2025, periods: ["全年"], metricId: "MET-006", metricName: "项目可用立项余额", metricValue: -20.5038, metricUnit: "万元", metricExplanation: "项目立项金额 - 实际使用 - 净在途占用 - 未结计提 - 剩余计划 = -20.5038万元", ruleId: "RULE-001", ruleName: "项目预算覆盖风险", ruleBranch: "availableBalance < 0", ruleHitEvidence: "概率安全分析项目可用立项余额-20.5038万元，低于0万元关注线。", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算执行整改", priority: "高", businessOwner: "安全运行部预算承接人", businessOwnerId: "BUSINESS-OWNER-AQ-BUDGET", recommendation: "形成预算执行整改提醒，待平台管理员人工确认后生成平台内待办；不覆盖最终批准预算，不反写外部系统。", triggerReason: "驾驶舱按项目下钻复用已发布RULE-001及HIT-001，不重复创建同一业务事项。", dataMarker: "DERIVED", evidence: ["C018-S002-v1", "RULE-001", "MET-006", "HIT-001", ...DATA_EVIDENCE_REFS], dashboardTrigger: { theme: "项目余额与采购占用", category: "项目余额", alertType: "项目余额不足", cardId: "ALERT-DASH-EXEC-AQ-2025" } },
    { id: "DASH-OCC-JS-2025", sourceType: "report-dashboard-rule-hit", title: "技术部热能项目年末预算占用集中预警", subjectId: "PRJ-JS-热能-2025-002", subjectName: "技术部 · 热能项目采购占用", department: "技术部", year: 2025, periods: ["Q4"], metricId: "MET-009", metricName: "年末采购/预算占用集中度", metricValue: 12.5359, metricUnit: "%", metricExplanation: "12月净在途占用6.55万元 / 全年净在途占用52.25万元", ruleId: "RULE-004", ruleName: "年末采购/预算占用集中", ruleBranch: "decemberBudgetOccupancyShare >= 10%", ruleHitEvidence: "技术部热能项目12月净在途占用占全年12.54%，达到关注线。", actionTypeId: "ACT-PROCUREMENT-COMMITMENT-CLEANUP", actionType: "采购占用清理", priority: "中", businessOwner: "技术部采购占用承接人", businessOwnerId: "BUSINESS-OWNER-JS-COMMITMENT", recommendation: "形成采购占用清理核对草稿，待平台管理员人工确认；不直接释放外部预算系统占用。", triggerReason: "同一指标在驾驶舱按项目下钻后达到已发布RULE-004关注线。", dataMarker: "SYNTHETIC_FOR_DEMO", evidence: ["C018-S002-v1", "RULE-004", "MET-009", ...DATA_EVIDENCE_REFS], dashboardTrigger: { theme: "项目余额与采购占用", category: "年末占用", alertType: "年末占用集中", cardId: "ALERT-DASH-OCC-JS-2025" } }
  ];

  function supplierDashboardWarningCandidates() {
    return supplierInstitutionRows.filter((group) => group.anomaly === true && Number(group.maxMinRatio) > 1.2).map((group, index) => {
      const departments = [...new Set((group.details || []).map((item) => item.department).filter(Boolean))];
      const subjectId = `SUPPLIER-GROUP-S002-${group.year}-${String(index + 1).padStart(3, "0")}`;
      return {
        id: `DASH-PRICE-GROUP-S002-${group.year}-${String(index + 1).padStart(3, "0")}`,
        sourceType: "report-dashboard-rule-hit",
        title: `${group.supplier}${group.level}人员跨部门人月成本差异`,
        subjectId,
        subjectName: `${group.supplier} · ${group.level} · 业务支持费-技术配置`,
        department: departments.join("、"),
        year: group.year,
        periods: ["全年"],
        metricId: "RULE-005-SUPPORT",
        metricName: "同供应商同级别人月成本最高/最低倍率",
        metricValue: Number(group.maxMinRatio),
        metricUnit: "倍",
        metricExplanation: `最高${Number(group.maxMonthlyNetCostRmb).toFixed(0)}元/人月 ÷ 最低${Number(group.minMonthlyNetCostRmb).toFixed(0)}元/人月；人月成本=净额÷人月`,
        ruleId: "RULE-005",
        ruleName: "供应商同级人月成本差异",
        ruleBranch: "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2",
        ruleHitEvidence: `${departments.join("、")}同供应商同级别人月成本最高/最低倍率${Number(group.maxMinRatio).toFixed(2)}，严格大于1.2。`,
        actionTypeId: "ACT-SUPPLIER-PRICE-REVIEW",
        actionType: "供应商价格复核",
        priority: "中",
        businessOwner: "采购管理业务承接人",
        businessOwnerId: "BUSINESS-OWNER-PROCUREMENT-PRICE",
        recommendation: "核对同供应商同级别跨部门的人月成本、净额、服务人月和报价依据；不触发供应商系统或自动改价。",
        triggerReason: "驾驶舱从技术配置组比对事实派生，仅异常组进入关注清单。",
        dataMarker: group.details?.some((item) => item.dataMarker === "SYNTHETIC_FOR_DEMO") ? "SYNTHETIC_FOR_DEMO" : "DERIVED",
        suppliers: [group.supplier],
        evidence: ["C018-S002-v1", "RULE-005", subjectId, ...DATA_EVIDENCE_REFS],
        dashboardTrigger: { theme: "供应商/人月成本", category: "供应商价格", alertType: "供应商同级人月成本差异", cardId: `ALERT-${subjectId}` }
      };
    });
  }
  const dashboardBudgetExecutionCandidate = {
    id: "HIT-002-2025-AQ", sourceType: "report-dashboard-rule-hit", title: "安全运行部费用预算执行率接近上限",
    subjectId: "ORG-AQ-FY2025", subjectName: "安全运行部 · 2025最终批准预算", department: "安全运行部", year: 2025, periods: ["全年"],
    metricId: "MET-007", metricName: "预算执行率", metricValue: 98.86, metricUnit: "%", metricExplanation: "实际费用310.3201万元 / 最终批准费用预算313.90万元 = 98.86%",
    ruleId: "RULE-002", ruleName: "费用预算执行偏离合理区间", ruleBranch: "expenseExecutionRate >= 95% AND expenseExecutionRate <= 100%", ruleHitEvidence: "安全运行部费用预算执行率98.86%，处于95%—100%接近上限分支。",
    actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算执行整改", priority: "中", businessOwner: "安全运行部费用预算负责人", businessOwnerId: "BUSINESS-OWNER-AQ-BUDGET",
    recommendation: "核对剩余3.5799万元预算空间、未结采购占用与后续计划，人工确认后形成费用控制说明待办；不自动调账或覆盖最终批准预算。",
    triggerReason: "驾驶舱复用已发布RULE-002及HIT-002-2025-AQ，对接既有待决策事项。", dataMarker: "DERIVED",
    evidence: ["C018-S002-v1", "RULE-002", "MET-007", "HIT-002-2025-AQ", ...DATA_EVIDENCE_REFS], dashboardTrigger: { theme: "预算执行", category: "预算执行", alertType: "预算执行接近上限", cardId: "ALERT-HIT-002-2025-AQ" }
  };
  const dashboardCostRatioCandidate = {
    id: "HIT-003-2025-AQ",
    sourceType: "report-dashboard-rule-hit",
    title: "安全运行部成本占收比超过100%",
    subjectId: "ORG-AQ-FY2025-COST",
    subjectName: "安全运行部 · 2025成本费用表现",
    department: "安全运行部",
    year: 2025,
    periods: ["全年"],
    metricId: "MET-001",
    metricName: "成本占收比",
    metricValue: 112.63,
    metricUnit: "%",
    metricExplanation: "实际费用310.3201万元 / 收入净额275.5278万元 = 112.63%，费用高于收入净额",
    ruleId: "RULE-003",
    ruleName: "成本占收比异常",
    ruleBranch: "costToRevenue >= 100%",
    ruleHitEvidence: "2025安全运行部成本占收比112.63%，达到RULE-003关注线。",
    actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW",
    actionType: "费用管理优化核查",
    priority: "中",
    businessOwner: "安全运行部费用管理负责人",
    businessOwnerId: "BUSINESS-OWNER-AQ-COST",
    recommendation: "核实收入确认、费用结构和可优化空间，人工确认后形成费用管理优化核查待办；不自动调剂、调增或调减预算。",
    triggerReason: "驾驶舱复用已发布RULE-003及HIT-003-2025-AQ，不重复创建同一待决策事项。",
    dataMarker: "DERIVED",
    evidence: ["C018-S002-v1", "RULE-003", "MET-001", "MET-002", "HIT-003-2025-AQ", ...DATA_EVIDENCE_REFS],
    dashboardTrigger: { theme: "预算执行", category: "成本效率", alertType: "成本效率异常", cardId: "ALERT-HIT-003-2025-AQ" }
  };
  const dashboardSubmissionCandidate = {
    id: "SUG-001", sourceType: "report-dashboard-analysis", title: "技术部初始预算申报成本占收比需补充依据",
    subjectId: "ORG-JS-FY2025-INITIAL", subjectName: "技术部 · 2025初始申报预算", department: "技术部", year: 2025, periods: ["全年"],
    metricId: "MET-001", metricName: "成本占收比", metricValue: 310.30, metricUnit: "%", metricExplanation: "初始申报总成本1,695.15万元 / 收入净额546.30万元 = 310.30%",
    ruleId: null, ruleName: null, ruleBranch: null, ruleHitEvidence: null,
    actionTypeId: "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", actionType: "预算申报依据补充", priority: "中", businessOwner: "技术部预算申报负责人", businessOwnerId: "BUSINESS-OWNER-JS-SUBMISSION",
    recommendation: "补充收入实现依据、项目成本、技术配置费和公共费用测算说明，人工确认后形成申报依据补充待办；不自动退回或改写申报。",
    triggerReason: "该项来自已获准预算分析建议SUG-001，不冒充正式Rule命中，并复用既有决策事项。", dataMarker: "DERIVED",
    evidence: ["C018-S002-v1", "SUG-001", "MET-001", "FY2025-INITIAL-SUBMISSION-v1", ...DATA_EVIDENCE_REFS], dashboardTrigger: { theme: "初始申报", category: "申报合理性", alertType: "申报合理性复核", cardId: "ALERT-SUG-001" }
  };
  const existingActionRequestBySource = Object.freeze({ "HIT-001": "AR-S002-001", "HIT-003-2025-AQ": "AR-S002-003", "HIT-002-2025-AQ": "AR-S002-004", "SUG-001": "AR-S002-007" });
  function readDashboardActionCandidates() {
    try {
      const candidates = window.parent !== window && window.parent?.S002_DATA?.dashboardActionCandidates;
      const selected = (Array.isArray(candidates) && candidates.length ? cloneValue(candidates) : cloneValue(dashboardCandidateFallback))
        .filter((item) => item.ruleId !== "RULE-005" && !String(item.id || "").startsWith("DASH-PRICE"));
      for (const required of [dashboardBudgetExecutionCandidate, dashboardCostRatioCandidate, dashboardSubmissionCandidate]) if (!selected.some((item) => item.id === required.id)) selected.push(cloneValue(required));
      selected.push(...supplierDashboardWarningCandidates());
      const order = ["HIT-002-2025-AQ", "HIT-003-2025-AQ", "DASH-EXEC-AQ-2025", "DASH-OCC-JS-2025", "SUG-001"];
      const rank = (item) => String(item.id || "").startsWith("DASH-PRICE-GROUP-") ? 4 : order.indexOf(item.id) >= 0 ? order.indexOf(item.id) : 99;
      return selected.sort((left, right) => rank(left) - rank(right));
    } catch (_) {
      const selected = cloneValue(dashboardCandidateFallback).filter((item) => item.ruleId !== "RULE-005" && !String(item.id || "").startsWith("DASH-PRICE"));
      selected.push(cloneValue(dashboardBudgetExecutionCandidate), cloneValue(dashboardCostRatioCandidate), cloneValue(dashboardSubmissionCandidate));
      selected.push(...supplierDashboardWarningCandidates());
      const order = ["HIT-002-2025-AQ", "HIT-003-2025-AQ", "DASH-EXEC-AQ-2025", "DASH-OCC-JS-2025", "SUG-001"];
      const rank = (item) => String(item.id || "").startsWith("DASH-PRICE-GROUP-") ? 4 : order.indexOf(item.id) >= 0 ? order.indexOf(item.id) : 99;
      return selected.sort((left, right) => rank(left) - rank(right));
    }
  }
  function warningMetricText(candidate) {
    const decimals = candidate.metricUnit === "%" ? 2 : candidate.metricUnit === "倍" ? 2 : 2;
    const value = Number(candidate.metricValue);
    return `${Number.isFinite(value) ? value.toFixed(decimals) : candidate.metricValue} ${candidate.metricUnit || ""}`.trim();
  }
  const canonicalActionName = (actionTypeId, fallback) => ({
    "ACT-BUDGET-EXECUTION-RECTIFICATION": "预算执行整改",
    "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW": "下一年度预算合理性复核",
    "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW": "费用管理优化核查",
    "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT": "预算申报依据补充",
    "ACT-PROCUREMENT-COMMITMENT-CLEANUP": "采购占用清理",
    "ACT-SUPPLIER-PRICE-REVIEW": "供应商价格复核",
  }[canonicalActionTypeId(actionTypeId)] || fallback || "预算行动");
  function canonicalWarningCategory(trigger = {}) {
    const raw = String(trigger.category || trigger.alertType || trigger.theme || "");
    if (/项目余额|预算覆盖不足/.test(raw)) return "项目余额";
    if (/年末占用|占用集中/.test(raw)) return "年末占用";
    if (/供应商|报价偏高|价格复核/.test(raw)) return "供应商价格";
    if (/成本效率|成本占收比/.test(raw)) return "成本效率";
    if (/申报/.test(raw)) return "申报合理性";
    if (/预算执行|执行率/.test(raw)) return "预算执行";
    return raw || "预算预警";
  }
  function attentionRecommendation(candidate) {
    const text = `${candidate.dashboardTrigger?.category || ""} ${candidate.title || ""}`;
    if (/项目余额/.test(text)) return "核对项目实际、净在途占用、未结计提和剩余计划构成。";
    if (/供应商|人月成本/.test(text)) return "核对同供应商同级别跨部门记录的预算净额、服务人月、人月成本和报价依据。";
    if (/成本|费用/.test(text)) return "核对收入确认、费用结构、科目余额和可优化空间。";
    if (/年末占用|采购/.test(text)) return "核对12月采购发起、净在途占用和全年占比构成。";
    if (/申报/.test(text)) return "核对收入依据、成本拆解、技术配置费和公共费用测算。";
    if (/预算执行/.test(text)) return "核对最终批准预算、实际费用、剩余预算空间和后续计划。";
    return "查看指标口径、Rule依据和明细证据。";
  }
  const canonicalRuleCode = (ruleId) => ({
    "RULE-001": "R01",
    "RULE-002": "R02",
    "RULE-003": "R03",
    "RULE-004": "R04",
    "RULE-005": "R05",
  }[ruleId] || "RULE");
  const dashboardActionWarnings = readDashboardActionCandidates().map((candidate) => {
    const isRuleHit = candidate.sourceType === "report-dashboard-rule-hit" || Boolean(candidate.relatedSourceId && candidate.ruleId);
    const subjectObjectType = ["DASH-EXEC-AQ-2025", "DASH-OCC-JS-2025"].includes(candidate.id) ? "OBJ-BUDGET-PROJECT" : String(candidate.id || "").startsWith("DASH-PRICE-GROUP-") ? "OBJ-BUDGET-PROCUREMENT" : "OBJ-BUDGET-DEPARTMENT";
    return {
      id: candidate.id,
      sourceId: candidate.id,
      relatedSourceId: candidate.relatedSourceId || null,
      existingActionRequestId: null,
      severity: candidate.priority || "中",
      sourceKind: isRuleHit ? "rule-hit" : "analysis-suggestion",
      sourceLabel: isRuleHit ? "Rule 命中" : "驾驶舱分析建议（非Rule命中）",
      title: candidate.title,
      theme: String(candidate.dashboardTrigger?.theme || "异常与关注").replaceAll("异常事项与Action", "异常与关注"),
      category: canonicalWarningCategory(candidate.dashboardTrigger),
      alertType: candidate.dashboardTrigger?.alertType || "预算预警",
      cardId: candidate.dashboardTrigger?.cardId || `ALERT-${candidate.id}`,
      unit: candidate.department,
      subjectId: candidate.subjectId,
      subjectName: candidate.subjectName,
      subjectObjectType,
      period: `${candidate.year} · ${(candidate.periods || []).join("、") || "全年"}`,
      metric: { id: candidate.metricId, name: candidate.metricName, value: warningMetricText(candidate), explanation: candidate.metricExplanation },
      rule: isRuleHit ? { id: candidate.ruleId, code: canonicalRuleCode(candidate.ruleId), name: candidate.ruleName, version: "S002-RULE-v1", status: "命中", evaluatedAt: FORMED_AT, branch: candidate.ruleBranch, hitEvidence: candidate.ruleHitEvidence, evaluationId: `RULE-EVAL-${candidate.id}-20260815`, resultVersion: "S002-RULE-RESULT-v1" } : null,
      actionTypeId: canonicalActionTypeId(candidate.actionTypeId),
      actionType: canonicalActionName(candidate.actionTypeId, candidate.actionType),
      assignee: candidate.businessOwner,
      assigneeId: candidate.businessOwnerId,
      operator: "平台管理员",
      recommendation: attentionRecommendation(candidate),
      triggerReason: candidate.triggerReason,
      suggestedAmount: candidate.suggestedAmount ?? null,
      snapshotId: `EVD-${candidate.id}-20260815`,
      evidenceRefs: [...new Set([...(candidate.evidence || []), ...DATA_ASSET_VERSIONS, DATA_VERSION])],
      suppliers: String(candidate.id || "").startsWith("DASH-PRICE-GROUP-") ? (candidate.suppliers || [candidate.supplier || "供应商"]) : [],
      procurements: candidate.id === "DASH-OCC-JS-2025" ? ["PRJ-JS-热能-2025-002"] : [],
      dataMarker: candidate.dataMarker || "DERIVED"
    };
  });

  const factPackage = {
    packageId: "PKG-S002-BUDGET-v1",
    packageVersion: "1.0",
    schemaVersion: "ofw.s002.report-fact-package.v1",
    factInventoryVersion: "C018-S002-v1",
    status: "available",
    factPackageStatus: "available",
    sceneId: "S002",
    authorityBindingId: "T019-S002-v1",
    semanticVersionId: SEMANTIC_VERSION_ID,
    semanticVersion: ONTOLOGY_VERSION,
    dataAssetVersionId: DATA_VERSION,
    dataAssetId: "S002-DATA-BUNDLE",
    dataAssetIds: DATA_ASSET_COMPONENTS.map((item) => item.assetId),
    dataAssetVersions: DATA_ASSET_VERSIONS,
    componentAssets: DATA_ASSET_COMPONENTS,
    dataVersion: DATA_VERSION,
    consumableVersionId: "C018-S002-v1",
    asOf: "2025-12-31",
    statusReason: "S002 预算事实包已固定；演示加工和修正标识保留。",
    contentFacts: facts,
    anchors,
    contentItems: facts.map((item) => ({ id: item.id, contentItemId: `CONTENT-S002-${item.id}`, anchor: item.anchor, anchorIds: item.anchorIds || [item.anchor], factRefs: [item.id], text: item.value, value: item.value, displayValue: item.value, displayUnit: item.unit || null, evidenceRefs: item.evidenceRefs || [item.source], origin: "generated", claimType: item.type || "报告事实", presentationType: "fact", requiresEvidence: true, rendered: true })),
    renderManifest: { manifestId: "RM-S002-BUDGET-v1", version: "1.0", items: anchors },
    generatedNarrativeContract: { id: "C022-S002-v1", status: "draft-only", owner: "报告中心", prohibited: ["T049正式报告冒充", "覆盖最终批准预算"] },
    resultVersions: { metric: "S002-METRIC-RESULT-v1", rule: "S002-RULE-RESULT-v1" },
    metrics: budgetMetrics,
    rules: budgetRules,
    actionTypes: budgetActions,
    groupMetrics,
    units: departmentUnits,
    comparisons,
    boards: departments.map((item) => ({ name: item.board, publishedMetrics: departmentUnits[item.name] })),
    institutions: supplierInstitutionRows,
    structures: { rate: [{ name: "实际", value: 78.50 }, { name: "预算余量", value: 21.50 }], term: [{ name: "全年", value: 85.65 }, { name: "Q4", value: 14.35 }], currency: [{ name: "非12月正向PR", value: 91.41 }, { name: "12月正向PR", value: 8.59 }], guarantee: [{ name: "项目占用", value: 14.35 }, { name: "无占用", value: 85.65 }], finance: [{ name: "费用", value: 74.35 }, { name: "收入", value: 25.65 }], region: [{ name: "境内单位", value: 100 }] },
    trend,
    annualComparisons,
    submissionComparisons,
    budgetSupervisionDetails,
    dashboardActionWarnings,
    verificationChecks: [],
    dashboardSourceDetails,
    sections: ["变动成本执行率", "项目立项余额", "差旅费", "跨年计提", "年末采购/预算占用", "供应商/人月成本"],
    owners: { contentFacts: "报告中心", contentManifest: "报告中心", authoritativeBinding: "本体管理", semanticEvidence: "本体管理", dataTrust: "数据工程" }
  };

  function readJson(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; } }
  function cloneValue(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function candidateContext(value) { return value?.scenarioContext || value?.context || value; }
  function sameRun(value) {
    const candidate = candidateContext(value);
    return candidate?.scenarioId === context.scenarioId
      && candidate?.scenarioVersion === context.scenarioVersion
      && candidate?.scenarioRunId === context.scenarioRunId;
  }
  function readParentModules() {
    try {
      const exported = window.parent !== window && window.parent?.S002_STORE?.exportOwnedState?.();
      return sameRun(exported?.scenarioContext) && exported?.modules ? exported.modules : null;
    } catch (_) { return null; }
  }
  const parentModules = readParentModules();
  function readScenarioOwnedState(scope, expectedModuleId) {
    const parentState = parentModules?.[scope] || null;
    if (parentState?.moduleId === expectedModuleId) return cloneValue(parentState);
    if (HISTORICAL_READONLY) return null;
    const key = `ofw:v1.1.0:${encodeURIComponent(context.scenarioId)}:${encodeURIComponent(context.scenarioVersion)}:${encodeURIComponent(context.scenarioRunId)}:${encodeURIComponent(scope)}:owned-state`;
    const envelope = readJson(key);
    const ownerState = envelope?.payload;
    if (!sameRun(envelope) || ownerState?.moduleId !== expectedModuleId) return null;
    return cloneValue(ownerState);
  }
  let upstreamOwnerStates = {
    m01: readScenarioOwnedState("m01", "M01"),
    m02: readScenarioOwnedState("m02", "M02"),
    m04: readScenarioOwnedState("m04", "M04"),
    m06: readScenarioOwnedState("m06", "M06")
  };
  const actionPresentationBySource = Object.freeze({
    "HIT-001": { id: "AR-S002-001", reminderId: "DR-S002-001", subjectId: "PRJ-AQ-概率-2025-002" },
    "HIT-002-2024-AQ": { id: "AR-S002-002", reminderId: "DR-S002-002", subjectId: "ORG-AQ-FY2024" },
    "HIT-003-2025-AQ": { id: "AR-S002-003", reminderId: "DR-S002-003", subjectId: "ORG-AQ-FY2025-COST" },
    "HIT-002-2025-AQ": { id: "AR-S002-004", reminderId: "DR-S002-004", subjectId: "ORG-AQ-FY2025" },
    "HIT-004": { id: "AR-S002-005", reminderId: "DR-S002-005", subjectId: "PRJ-SB-设备-2025-002" },
    "HIT-005": { id: "AR-S002-006", reminderId: "DR-S002-006", subjectId: "PRJ-AQ-灾害-2025-002" },
    "SUG-001": { id: "AR-S002-007", reminderId: "DR-S002-007", subjectId: "ORG-JS-FY2025-INITIAL" },
    "HIT-002-2025-SB": { id: "AR-S002-008", reminderId: "DR-S002-008", subjectId: "ORG-SB-FY2025" }
  });
  const actionPresentationOrder = Object.values(actionPresentationBySource);
  function decisionProjectionMatchesOwner(projection, ownerState) {
    if (!ownerState?.decisionSummary) return true;
    const projected = projection?.decisionSummary || {};
    const owner = ownerState.decisionSummary;
    return ["requestCount", "confirmedCount", "rejectedCount", "todoCount"].every((field) => Number(projected[field] || 0) === Number(owner[field] || 0));
  }
  function readDecisionProjection() {
    const projection = readJson(C019_READ_KEY);
    return projection?.contractCode === "C019" && projection?.owner === "决策中心" && sameRun(projection)
      && decisionProjectionMatchesOwner(projection, upstreamOwnerStates.m04) ? projection : null;
  }
  const decisionProjection = readDecisionProjection();
  function actionReferencesFromProjection(projection) {
    return (projection?.records || []).filter((record) => sameRun(record)).map((record) => ({
      id: record.requestRef?.targetId,
      scenarioContext: cloneValue(record.scenarioContext),
      sourceScene: record.navigationContext?.sourceScene || "S002",
      singleBusinessSubject: record.businessSubject?.name || null,
      singleBusinessSubjectId: record.businessSubject?.id || null,
      singleBusinessSubjectName: record.businessSubject?.name || null,
      singleBusinessSubjectObjectType: "OBJ-BUDGET-SUBJECT",
      returnRoute: record.navigationContext?.returnRoute || "/dashboard/s002?tab=evidence",
      filter: record.navigationContext?.filter || "预算异常与 Action",
      returnPosition: record.navigationContext?.returnPosition || "action-collaboration",
      createdAt: projection.summaryAsOf || null
    })).filter((item) => item.id);
  }
  function actionReferencesFromOwner(ownerState) {
    return (ownerState?.actionRequests || []).map((request, index) => {
      const presentation = actionPresentationBySource[request.sourceId] || actionPresentationOrder[index] || null;
      const id = presentation?.id || request.requestId;
      return id ? {
        id,
        ownerRequestId: request.requestId || null,
        scenarioContext: cloneValue(request.scenarioContext || context),
        sourceScene: "S002",
        singleBusinessSubject: request.subject || null,
        singleBusinessSubjectId: presentation?.subjectId || request.sourceId || request.requestId || null,
        singleBusinessSubjectName: request.subject || null,
        singleBusinessSubjectObjectType: "OBJ-BUDGET-SUBJECT",
        returnRoute: "/dashboard/s002?tab=evidence",
        filter: "预算异常与 Action",
        returnPosition: "action-collaboration",
        createdAt: request.createdAt || null
      } : null;
    }).filter(Boolean);
  }
  let upstreamActionReferences = decisionProjection
    ? actionReferencesFromProjection(decisionProjection)
    : actionReferencesFromOwner(upstreamOwnerStates.m04);
  const actionFact = facts.find((item) => item.id === "FACT-ACTIONS");
  function syncUpstreamProjection() {
    // 当前 S002 范围不消费运行时决策事项。M04 的基线能力保留，
    // 但报告与驾驶舱只呈现预算监督事实、Rule 和关注事项。
    upstreamActionReferences = [];
    budgetSupervisionDetails.forEach((item) => { item.actionRequestId = null; });
    if (!actionFact) return;
    actionFact.value = "当前 S002 运行不生成行动申请、决策事项或平台内待办；异常与关注事项仅用于预算监督分析和证据下钻。";
    // `anchors` was materialized from the generated fact inventory before the
    // cross-module C019 summary was reread.  Keep the rendered T044 value on
    // the same fixed fact value so cross-content verification does not compare
    // a current decision summary with the pre-reread placeholder.
    anchors
      .filter((anchor) => anchor.factRefs?.includes(actionFact.id))
      .forEach((anchor) => {
        anchor.renderedValue = actionFact.value;
        anchor.displayValue = actionFact.value;
      });
  }
  function publishUpstreamSnapshot() {
    syncUpstreamProjection();
    window.S002_M06_UPSTREAM = Object.freeze({
      scenarioContext: cloneValue(context),
      ownerStates: cloneValue(upstreamOwnerStates),
      decisionProjection: cloneValue(decisionProjection),
      actionReferences: cloneValue(upstreamActionReferences)
    });
  }
  publishUpstreamSnapshot();
  function readOwnerM06State() {
    if (upstreamOwnerStates.m06) return cloneValue(upstreamOwnerStates.m06);
    try {
      const snapshot = window.parent !== window && window.parent?.S002_STORE?.get?.();
      if (sameRun(snapshot?.context)) {
        return {
          moduleId: "M06",
          moduleVersion: "S002-M06-1.0.0",
          progress: { reportBuilt: Boolean(snapshot.progress?.reportBuilt), dashboardPublished: Boolean(snapshot.progress?.dashboardPublished) },
          reports: Array.isArray(snapshot.reports) ? snapshot.reports : [],
          dashboardVersions: Array.isArray(snapshot.dashboardVersions) ? snapshot.dashboardVersions : [],
          dashboardView: snapshot.dashboardView || null
        };
      }
    } catch (_) {}
    if (HISTORICAL_READONLY) return null;
    const envelope = readJson(OWNER_STATE_KEY);
    const ownerState = envelope?.payload;
    if (!sameRun(envelope) || ownerState?.moduleId !== "M06") return null;
    return ownerState;
  }
  function projectedContentSnapshot(draftId, formedAt) {
    const authoritativeFacts = JSON.parse(JSON.stringify(factPackage.contentFacts || []));
    return {
      snapshotId: `CNT-${draftId}`,
      revisionNumber: 1,
      factPackageId: factPackage.packageId,
      dataVersion: DATA_VERSION,
      contentFacts: authoritativeFacts.map((fact) => ({
        contentFactId: `GCF-${fact.id}`,
        sourceFactId: fact.id,
        factId: fact.id,
        intendedFactId: fact.id,
        label: fact.name || fact.label,
        kind: fact.type || fact.kind,
        value: fact.value,
        authoritativeValue: fact.value,
        unit: fact.unit || null,
        scope: fact.scope,
        resultVersion: fact.resultVersion || fact.source,
        evidenceRefs: cloneValue(fact.evidenceRefs || fact.evidence || [fact.source]),
        anchorIds: cloneValue(fact.anchorIds || [fact.anchor]),
        bindingStatus: "bound"
      })),
      authoritativeFacts,
      bindingGaps: [],
      narratives: [],
      groupMetrics: JSON.parse(JSON.stringify(factPackage.groupMetrics)),
      units: JSON.parse(JSON.stringify(factPackage.units)),
      trend: JSON.parse(JSON.stringify(factPackage.trend)),
      annualComparisons: JSON.parse(JSON.stringify(factPackage.annualComparisons || [])),
      submissionComparisons: JSON.parse(JSON.stringify(factPackage.submissionComparisons || [])),
      budgetSupervisionDetails: JSON.parse(JSON.stringify(factPackage.budgetSupervisionDetails || [])),
      dashboardSourceDetails: JSON.parse(JSON.stringify(factPackage.dashboardSourceDetails || {})),
      structures: JSON.parse(JSON.stringify(factPackage.structures)),
      institutions: JSON.parse(JSON.stringify(factPackage.institutions)),
      facts: authoritativeFacts,
      createdAt: formedAt
    };
  }
  function projectedDraftRecord(runtime) {
    if (!runtime.reportBuilt || !runtime.report) return {};
    const draftId = runtime.report.reportId || "RPT-S002-BUDGET-DRAFT-v1";
    const formedAt = runtime.reportFormedAt || context.formedAt || FORMED_AT;
    const evidencePackId = "EP-S002-BUDGET-001";
    const reviewCopyId = `${draftId}-REVIEW-001`;
    const bindingSnapshot = {
      bindingId: "T019-S002-v1",
      semanticVersionId: SEMANTIC_VERSION_ID,
      semanticVersion: ONTOLOGY_VERSION,
      dataAssetId: "S002-DATA-BUNDLE",
      dataAssetVersionId: DATA_VERSION,
      dataAssetIds: DATA_ASSET_COMPONENTS.map((item) => item.assetId),
      dataAssetVersions: DATA_ASSET_VERSIONS,
      dataVersion: DATA_VERSION,
      consumableVersionId: "C018-S002-v1",
      asOf: "2025-12-31",
      quality: "passed-for-demo",
      freshness: "截至 2025-12-31",
      consumption: "可消费",
      readiness: "可消费",
      compatibility: "兼容",
      semanticResolution: "resolved",
      fixedAt: formedAt
    };
    const contentSnapshot = projectedContentSnapshot(draftId, formedAt);
    const evidencePack = {
      scenarioContext: context,
      id: evidencePackId,
      version: "1.0.0",
      reportDefinition: { id: "RD-S002-001", version: "1.0.0" },
      template: { id: "RT-S002-001", version: "1.0.0" },
      semanticBinding: bindingSnapshot,
      dataTrustAtGeneration: { id: "C017-S002-BINDING-v1", version: "1.0", formedAt, asOf: "2025-12-31", dataVersion: DATA_VERSION, dataAssetVersions: DATA_ASSET_VERSIONS, publishedQuality: "passed-for-demo", freshness: "截至 2025-12-31", readiness: "可消费", hardQualityFailure: false },
      authoritativeFactPackage: factPackage,
      fixedAt: formedAt
    };
    return {
      scenarioContext: context,
      aggregateId: `RAG-${draftId}`,
      stage: "draft",
      definitionId: "RD-S002-001",
      generationMode: "standard",
      progress: 100,
      requestId: `RGEN-${draftId}`,
      evidencePackId,
      generationRunId: "AG-RUN-S002-REPORT-20260815",
      generationResultId: "AG-RESULT-S002-REPORT-20260815",
      agentGenerationRefs: [{ scenarioContext: context, requestId: `RGEN-${draftId}`, runId: "AG-RUN-S002-REPORT-20260815", resultId: "AG-RESULT-S002-REPORT-20260815", sourceDraftId: draftId, evidencePackId, submittedAt: formedAt }],
      contentVersions: [{
        scenarioContext: context,
        reviewCopyId,
        draftId,
        draftVersion: runtime.report.version || "S002-REPORT-DRAFT-v1",
        contentVersion: runtime.report.version || "S002-REPORT-DRAFT-v1",
        snapshot: contentSnapshot,
        t044Bindings: factPackage.anchors.map((anchor) => ({
          id: `T044-S002-${anchor.anchorId}`,
          anchorId: anchor.anchorId,
          contentItemId: anchor.contentItemId || `CONTENT-S002-${anchor.anchorId}`,
          templateSlot: anchor.sectionId || anchor.anchorId,
          bindingStatus: "bound",
          location: anchor.label,
          contentType: "报告事实",
          factRefs: cloneValue(anchor.factRefs || []),
          evidenceRefs: cloneValue(anchor.evidenceRefs || []),
          renderedValue: anchor.renderedValue ?? anchor.displayValue ?? null,
          displayValue: anchor.displayValue ?? anchor.renderedValue ?? null,
          displayUnit: anchor.displayUnit || null
        })),
        factInventory: cloneValue(factPackage.contentFacts),
        renderManifest: cloneValue(factPackage.renderManifest),
        verificationPlan: [],
        verificationRunIds: []
      }],
      verificationRuns: [],
      evidencePacks: [evidencePack],
      reviewHistory: [],
      publicationRuns: [],
      activeOperation: null,
      draftId,
      reviewCopyId,
      draftVersion: runtime.report.version || "S002-REPORT-DRAFT-v1",
      contentVersion: runtime.report.version || "S002-REPORT-DRAFT-v1",
      contentSnapshot,
      revisionNumber: 1,
      generatedAt: formedAt,
      returnedAt: null,
      confirmedAt: null,
      publishedAt: null,
      reportNo: null,
      publicationId: null,
      frozenHtml: null,
      artifactManifest: null,
      bindingSnapshot,
      humanReview: { status: "pending", contentVersion: runtime.report.version || "S002-REPORT-DRAFT-v1", reviewer: null, completedAt: null, note: "报告草稿已形成；未发布为 T049 正式报告。" },
      issues: [],
      trustWarnings: [],
      generationBlock: null,
      publicationVerificationRef: null,
      postPublicationVerification: null,
      s002RuntimeProjection: { revision: REPORT_PROJECTION_REVISION, reportId: draftId, sourceStatus: runtime.report.status || "draft", dashboardVersionId: runtime.dashboard?.dashboardVersionId || null, dashboardStatus: runtime.dashboard?.status || null, formalReportPublished: false, t049Ref: null }
    };
  }

  const upstreamM06 = readOwnerM06State() || readScenarioOwnedState("m06", "M06");
  const latestUpstreamReport = upstreamM06?.reports?.at?.(-1) || null;
  const latestUpstreamDashboard = upstreamM06?.dashboardVersions?.at?.(-1) || null;
  const runtimeSummary = {
    source: upstreamM06 ? "scenario-owned-state" : "adapter-fallback",
    reportBuilt: Boolean(upstreamM06?.progress?.reportBuilt && latestUpstreamReport?.status === "draft"),
    dashboardPublished: Boolean(upstreamM06?.progress?.dashboardPublished && latestUpstreamDashboard?.status === "published"),
    report: latestUpstreamReport,
    dashboard: latestUpstreamDashboard,
    reportFormedAt: latestUpstreamDashboard?.contentSnapshot?.capturedAt || latestUpstreamDashboard?.publishedAt || context.formedAt
  };
  window.S002_M06_RUNTIME = runtimeSummary;

  try {
    const DATA = window.RC_DATA;
    if (DATA) {
      DATA.product = { ...DATA.product, dashboardVersion: "S002-DASH-v1", semanticVersionId: SEMANTIC_VERSION_ID, semanticVersion: ONTOLOGY_VERSION, dataAssetId: "S002-DATA-BUNDLE", dataAssetIds: DATA_ASSET_COMPONENTS.map((item) => item.assetId), dataAssetVersionId: DATA_VERSION, dataAssetVersions: DATA_ASSET_VERSIONS, dataVersion: DATA_VERSION, asOf: "2025-12-31", metricResultVersion: "S002-METRIC-RESULT-v1", ruleResultVersion: "S002-RULE-RESULT-v1", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算监督管理 Action", actionTypeVersion: "S002-ACTION-TYPE-v1" };
      DATA.publishedSemantic = { ...DATA.publishedSemantic, id: SEMANTIC_VERSION_ID, version: ONTOLOGY_VERSION, status: "Published", owner: "本体管理", discoveryContract: "C004 / C005 / C006 / C007" };
      DATA.metrics = budgetMetrics;
      DATA.rules = budgetRules;
      DATA.actionTypes = budgetActions;
      // Replace baseline sample payloads in memory as well as in the report
      // projection. The copied data.js remains historical source evidence;
      // no S001 sample row is consumable by this S002 runtime.
      DATA.units = factPackage.units;
      DATA.groupMetrics = factPackage.groupMetrics;
      DATA.comparisons = factPackage.comparisons;
      DATA.boards = factPackage.boards;
      DATA.institutions = factPackage.institutions;
      DATA.structures = factPackage.structures;
      DATA.trend = factPackage.trend;
      DATA.semanticResources = [
        { id: "OBJ-BUDGET-DEPARTMENT", type: "Object", name: "预算管理单位", version: ONTOLOGY_VERSION, publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published" },
        { id: "OBJ-BUDGET-PROJECT", type: "Object", name: "预算项目", version: ONTOLOGY_VERSION, publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published" },
        { id: "OBJ-BUDGET-VOUCHER", type: "Object", name: "实际凭证", version: ONTOLOGY_VERSION, publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published" },
        { id: "OBJ-BUDGET-PROCUREMENT", type: "Object", name: "采购发起与占用", version: ONTOLOGY_VERSION, publishedSemanticVersion: ONTOLOGY_VERSION, status: "Published" },
        ...budgetMetrics.map((item) => ({ id: item.id, type: "Metric", name: item.name, version: item.version, publishedSemanticVersion: ONTOLOGY_VERSION, status: item.status })),
        ...budgetRules.map((item) => ({ id: item.id, type: "Rule", name: item.name, version: item.version, publishedSemanticVersion: ONTOLOGY_VERSION, status: item.status })),
        ...budgetActions.map((item) => ({ id: item.id, type: "Action Type", name: item.name, version: item.version, publishedSemanticVersion: ONTOLOGY_VERSION, status: item.status })),
      ];
      DATA.reportEvidence = { ...DATA.reportEvidence, schemaVersion: "ofw.s002.report-evidence.v1", factPackages: { ...(DATA.reportEvidence.factPackages || {}), [DATA_VERSION]: factPackage } };
      factPackage.verificationRuleVersion = DATA.reportEvidence.verificationRuleVersion || "1.5.0";
      factPackage.verificationChecks = cloneValue(DATA.reportEvidence.verificationChecks || []);
      // Keep the baseline scene card and lifecycle layout, but expose only the
      // current S002 scenario in this isolated copy; S001/S003/S004 records
      // must not leak into the S002 report catalog.
      DATA.scenes = [{ id: "S002", name: "预算监督管理", type: "管理驾驶舱", status: "可使用", description: "变动成本执行率、项目立项余额、差旅费、跨年计提、年末采购/预算占用、供应商/人月成本。" }];
      DATA.definitions = [{ id: "RD-S002-001", name: "预算监督管理报告", scene: "S002", purpose: "形成预算执行、初始申报、项目余额与采购占用、异常事项及单位对比的可追溯管理报告。", audience: "预算管理人员", version: "1.0.0", template: "预算监督管理模板 1.0.0", evidence: "预算执行、初始申报、项目余额与采购占用、Rule/关注事项、数据质量标识", agent: "预算报告草稿 Agent 1.0", validation: "所有指标、差异、Rule 与关注结论均需有结构化证据", review: "由平台管理员人工复核", publish: "仅形成报告草稿或驾驶舱版本，不冒充 T049 正式报告", status: "已启用" }];
      DATA.templates = [{ id: "RT-S002-001", name: "预算监督管理模板", version: "1.0.0", status: "已启用", chapters: ["变动成本执行率", "项目立项余额", "差旅费", "跨年计提", "年末采购/预算占用", "供应商/人月成本", "证据与数据标识"], formats: ["HTML", "PDF"] }];
      window.S002_M06_TEXT_REPLACEMENTS = [
        ["集团融资成本与债务结构优化", "预算监督管理"], ["集团融资成本与债务结构分析报告", "预算执行与偏差分析报告"],
        ["集团融资经营分析报告", "预算监督管理报告"], ["集团融资经营分析", "预算监督管理"],
        ["集团融资驾驶舱", "预算监督管理驾驶舱"], ["集团融资成本", "预算执行"],
        ["融资经营分析模板", "预算监督管理模板"], ["融资报告生成助手", "预算报告草稿 Agent"],
        ["集团财务管理", "预算管理"], ["S001", "S002"], ["单位553", "安全运行部"], ["单位465", "技术部"], ["单位561", "设备管理部"],
        ["S002 融资驾驶舱", "S002 预算监督管理驾驶舱"], ["融资驾驶舱", "预算监督管理驾驶舱"],
        ["RD-FIN-001", "RD-S002-001"], ["RT-FIN-002", "RT-S002-001"], ["AT-FIN-OPT-001", "ACT-BUDGET-EXECUTION-RECTIFICATION"], ["T006-S002-BUDGET", "S002-DATA-BUNDLE"],
        ["预算调增", "预算执行整改"], ["预算调减", "下一年度预算合理性复核"], ["科目调剂", "费用管理优化核查"], ["申报退回", "预算申报依据补充"], ["占用释放", "采购占用清理"],
        ["RULE-FIN-R01", "RULE-001"], ["RULE-FIN-R02", "RULE-002"], ["RULE-FIN-R03", "RULE-003"],
        ["MET-FIN-001", "MET-001"], ["MET-FIN-008", "MET-008"], ["MET-FIN-010", "MET-007"], ["MET-FIN-011", "MET-002"], ["MET-FIN-012", "MET-003"],
        ["PUB-SEM-FIN-3.8.1", SEMANTIC_VERSION_ID], ["T019-FIN-CURRENT", "T019-S002-v1"], ["T019-FIN-PREVIOUS", "T019-S002-v1"], ["T006-FINANCING-S001", "S002-DATA-BUNDLE"], ["T006-S002-BUDGET", "S002-DATA-BUNDLE"],
        ["融资余额", "预算金额"], ["余额加权融资成本", "预算执行率"], ["高成本融资余额占比", "成本占收比"],
        ["浮动利率余额占比", "项目可用立项余额"], ["短期债务余额占比", "净在途占用"], ["外币融资余额占比", "正向采购发起占比"],
        ["信用融资余额占比", "预算差异额"], ["债务结构", "项目余额与采购占用"], ["金融机构分布", "单位/科目对比"],
        ["融资机构", "供应商"], ["借据数", "项目数"], ["融资类型", "预算类型"], ["融资成本", "预算执行"],
        ["融资业务对象与属性集合", "预算管理对象与属性集合"],
        ["融资余额、加权融资成本与结构占比", "预算金额、预算执行与结构占比"],
        ["R01 / R02 / R03 评估结果", "R01—R05 预算规则评估结果"],
        ["R01/R02/R03", "R01—R05 预算规则"],
        ["集团指标、三家重点单位、R01/R02/R03、机构贡献和可信度披露。", "预算执行、三家单位、R01—R05、科目对比和数据标识披露。"],
        ["报告中心拥有 T049 四态与覆盖", "报告中心拥有草稿核验四态与覆盖"],
        ["机构融资明细", "供应商采购明细"],
        ["融资成本趋势", "预算执行趋势"],
        ["集团融资成本与结构", "预算执行与结构"],
        ["当前无法同时核对优先银行与贷款明细", "当前需要补充项目预算与采购明细"],
        ["尚缺可核对的银行证据", "尚缺可核对的采购/预算证据"],
        ["补齐银行与贷款证据后再评估预期影响", "补齐项目、科目与采购证据后再评估预期影响"],
        ["优先协商银行", "重点供应商"], ["优先银行", "重点供应商"], ["优先协商机构", "重点供应商"],
        ["建议银行证据缺失", "采购/预算证据缺失"], ["银行证据", "采购/预算证据"],
        ["候选借据", "候选采购记录"], ["关联借据", "关联采购记录"], ["没有匹配的借据", "没有匹配的采购记录"],
        ["机构授信附件", "采购合同/占用明细"], ["全部融资明细", "全部预算与采购明细"], ["融资明细并集", "预算与采购明细并集"],
        ["发起融资优化建议", "发起预算行动申请"], ["融资优化建议", "预算行动建议"], ["融资优化", "预算监督"],
        ["融资成本趋势", "预算执行趋势"], ["融资成本与结构", "预算执行与结构"], ["融资成本", "预算执行"], ["融资结构", "预算结构"],
        ["融资余额", "预算金额"], ["融资金额", "预算金额"], ["余额（亿元）", "预算金额（万元）"], ["预算金额（亿元）", "预算金额（万元）"], ["亿元", "万元"],
        ["余额加权融资成本", "预算执行率"], ["加权融资成本", "预算执行率"], ["加权成本", "预算执行率"], ["余额占比", "金额占比"],
        ["浮动利率余额占比", "预算执行率"], ["短期债务余额占比", "Q4占用占比"], ["外币融资余额占比", "单位范围占比"], ["信用融资余额占比", "项目占用结构"],
        ["利率结构", "执行结构"], ["期限结构", "期间结构"], ["担保结构", "采购占用结构"], ["境内外结构", "单位范围"], ["浮动利率", "价格波动"], ["利率", "价格"], ["重定价", "价格复核"],
        ["短期债务", "Q4占用"], ["债务结构", "项目余额与采购占用"], ["债务", "预算占用"], ["金融机构分布", "单位/科目对比"], ["金融机构", "供应商"], ["融资机构", "供应商"], ["银行", "供应商"],
        ["借据数", "采购记录数"], ["借据编号", "采购记录编号"], ["借据", "采购记录"], ["贷款明细", "采购明细"], ["贷款类型", "采购类型"], ["贷款余额", "采购金额"], ["贷款", "采购项目"],
        ["机构指标", "供应商指标"], ["机构融资明细", "供应商采购明细"], ["存量融资", "预算与采购占用"], ["协商银行", "复核供应商"], ["主要协商银行", "主要复核供应商"], ["银行排名", "供应商排序"], ["银行建议", "供应商建议"],
        ["固定利率、利率上限或重定价条款", "采购价格复核、预算口径和供应商条件"], ["降息或置换高成本借据", "价格复核或调整采购计划"], ["展期或置换中长期融资", "释放跨期占用或调整采购计划"],
        ["融资业务对象与属性集合", "预算管理对象与属性集合"], ["融资余额、加权融资成本与结构占比", "预算金额、预算执行与结构占比"], ["融资经营分析模板", "预算监督管理模板"], ["融资报告生成助手", "预算报告草稿 Agent"],
        ["当前范围总体融资分布", "当前范围预算与采购占用分布"], ["融资明细", "预算与采购明细"], ["融资负责人", "平台管理员"], ["财务分析员", "平台管理员"], ["融资分析 Agent", "预算异常分析 Agent"],
        ["主要协商", "主要复核"], ["协商范围", "复核范围"], ["问题余额", "异常金额"], ["贡献占比", "金额占比"], ["关联贷款", "关联采购项目"], ["贷款利率", "采购价格倍率"], ["到期融资", "期间占用"], ["融资类型", "预算类型"],
        ["加权预算执行", "预算执行率"], ["高成本预算金额占比", "成本占收比"], ["信用预算金额占比", "12月净在途占用占比"],
        ["担保方式未知预算金额占比", "需复核数据占比"], ["担保方式未知金额占比", "需复核数据占比"],
        ["高成本问题融资", "需复核的预算事项"], ["未知值未被归入信用融资", "不存在未归类预算记录"],
        ["真正毛价格", "真正毛利率"], ["外币预算金额占比", "12月正向采购发起占比"],
        ["价格波动", "可用立项余额"], ["期间结构", "净在途结构"], ["短期", "净在途"],
        ["币种结构", "采购发起结构"], ["外币", "12月正向PR"], ["采购占用结构", "年末占用结构"], ["信用", "净在途"],
        ["近六个月预算执行", "跨年预算趋势"]
        ,["重点单位与机构贡献", "重点单位与供应商贡献"], ["重点单位与机构", "重点单位与供应商"]
        ,["预算金额", "最终批准费用预算"]
      ];
    }
    const reportState = HISTORICAL_READONLY ? null : readJson(REPORT_STATE_KEY);
    const initialReportState = {
      stateVersion: 4,
      savedAtMs: Date.now(),
      scenarioContext: context,
      navOpen: false,
      catalog: { query: "", status: "all", type: "all", view: "list" },
      wizard: { step: 1, reportType: "budget", scope: "集团", semantic: "published-current", dataContext: "current", compatibility: "idle", generationMode: "standard" },
      dashboard: { tab: "overview", scopeType: "group", scopeId: "集团", compareUnits: ["安全运行部", "技术部", "设备管理部"], budgetFilters: { year: "全部", unit: "全部", subject: "全部", project: "全部", period: "全部", anomaly: "全部" } },
      actionRequests: cloneValue(upstreamActionReferences),
      publishedReports: [],
      withdrawnReports: [],
      replacementRelations: [],
      exportTasks: [],
      publishAttempt: 0,
      regenerationRequest: null,
      report: {},
      customDefinitions: [],
      assistant: { tab: "qa", selectedAnchor: "budget-execution", selectedSection: "budget-execution", qaDraft: "", requestRef: null },
      insight: { requestId: null, resultId: null, runId: null, sessionId: null, bindingId: null, confirmationRequestId: null, submittedAt: null, bindingSnapshot: null, referenced: false },
      ui: { modal: null, drawer: null, readerMoreOpen: false, actionUnit: "安全运行部", actionWarningId: "DASH-EXEC-AQ-2025", actionSubmissionId: null, pendingActionRef: null, tempDefinitionName: "", tempDefinitionPurpose: "", pendingScrollAnchor: null, pendingExternalReturn: null, viewingReportNo: null }
    };
    const sourceReportState = reportState && sameRun(reportState) ? reportState : initialReportState;
    const reconciledState = {
      ...sourceReportState,
      stateVersion: 4,
      savedAtMs: Date.now(),
      scenarioContext: context,
      // M06 stores only stable references returned by M04/C019. Historical
      // adapter payloads are intentionally discarded because they duplicated
      // Decision Center-owned Action Request truth.
      actionRequests: cloneValue(upstreamActionReferences)
    };
    storeReportState(reconciledState);
    if (runtimeSummary.reportBuilt) {
      const sourceReportId = runtimeSummary.report?.reportId || null;
      const currentSourceReportId = reconciledState.report?.s002RuntimeProjection?.reportId || null;
      const currentProjectionRevision = reconciledState.report?.s002RuntimeProjection?.revision || null;
      const currentDashboardVersionId = reconciledState.s002RuntimeSummary?.dashboardVersionId || null;
      const sourceDashboardVersionId = runtimeSummary.dashboard?.dashboardVersionId || null;
      const staleLifecycle = reconciledState.report?.stage !== "draft"
        || currentSourceReportId !== sourceReportId
        || currentProjectionRevision !== REPORT_PROJECTION_REVISION
        || currentDashboardVersionId !== sourceDashboardVersionId
        || Boolean(reconciledState.s002RuntimeSummary?.dashboardPublished) !== runtimeSummary.dashboardPublished;
      if (staleLifecycle) {
        storeReportState({
          ...reconciledState,
          stateVersion: 4,
          savedAtMs: Date.now(),
          scenarioContext: context,
          report: projectedDraftRecord(runtimeSummary),
          publishedReports: [],
          withdrawnReports: [],
          s002RuntimeSummary: {
            source: runtimeSummary.source,
            reportBuilt: runtimeSummary.reportBuilt,
            dashboardPublished: runtimeSummary.dashboardPublished,
            reportId: sourceReportId,
            reportVersion: runtimeSummary.report?.version || null,
            reportStatus: runtimeSummary.report?.status || null,
            dashboardVersionId: runtimeSummary.dashboard?.dashboardVersionId || null,
            dashboardVersion: runtimeSummary.dashboard?.version || null,
            dashboardStatus: runtimeSummary.dashboard?.status || null,
            formalReportPublished: false,
            t049Ref: null
          }
        });
        if (!HISTORICAL_READONLY) try { sessionStorage.removeItem(`${REPORT_STATE_KEY}.active-tab`); } catch (_) {}
      }
    } else if (reconciledState.report?.stage && reconciledState.report.stage !== "idle") {
      storeReportState({
        ...reconciledState,
        stateVersion: 4,
        savedAtMs: Date.now(),
        scenarioContext: context,
        report: {},
        publishedReports: [],
        withdrawnReports: [],
        s002RuntimeSummary: {
          source: runtimeSummary.source,
          reportBuilt: false,
          dashboardPublished: runtimeSummary.dashboardPublished,
          reportId: null,
          reportVersion: null,
          reportStatus: null,
          dashboardVersionId: runtimeSummary.dashboard?.dashboardVersionId || null,
          dashboardVersion: runtimeSummary.dashboard?.version || null,
          dashboardStatus: runtimeSummary.dashboard?.status || null,
          formalReportPublished: false,
          t049Ref: null
        }
      });
      if (!HISTORICAL_READONLY) try { sessionStorage.removeItem(`${REPORT_STATE_KEY}.active-tab`); } catch (_) {}
    }
  } catch (error) {
    console.error("S002 报告中心运行初始化失败", error);
  }

  // The copied v1.0.3 page keeps its DOM and lifecycle handlers, while this
  // S002 copy owns the visible scenario route and storage namespace.
  function normalizeDashboardRoute() {
    const hash = window.location.hash || "";
    if (hash.match(/^#\/?dashboard\/s001(.*)$/)) window.location.hash = hash.replace(/dashboard\/s001/, "dashboard/s002");
  }
  normalizeDashboardRoute();
  window.addEventListener("hashchange", normalizeDashboardRoute);
  function ownerStateFromEnvelope(candidate, expectedModuleId, messageContext) {
    const envelopeContext = candidate?.scenarioContext || candidate?.context || messageContext;
    const payload = candidate?.payload || candidate;
    if (!sameRun(envelopeContext) || payload?.moduleId !== expectedModuleId) return null;
    return cloneValue(payload);
  }

  function acceptParentViewContext(message) {
    if (!sameRun(message?.context)) return false;
    const received = message.ownerStates || {};
    const next = { ...upstreamOwnerStates };
    const expected = { m01: "M01", m02: "M02", m04: "M04", m06: "M06" };
    Object.entries(expected).forEach(([scope, moduleId]) => {
      const ownerState = ownerStateFromEnvelope(received[scope], moduleId, message.context);
      if (ownerState) next[scope] = ownerState;
    });
    if (!next.m01 || !next.m02 || !next.m06) return false;
    upstreamOwnerStates = next;
    publishUpstreamSnapshot();
    window.dispatchEvent(new CustomEvent("s002-owner-context-updated", {
      detail: { scenarioContext: cloneValue(context), view: message.view || params.get("view") || "report" }
    }));
    return true;
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.channel !== "ofw.s002") return;
    if (event.data.type === "refresh") {
      // The unified workbench owns the live scenario state. An explicit
      // "重新读取" reloads the copied baseline page so read-only Owner
      // projections are rebuilt from the latest same-run state.
      window.location.reload();
      return;
    }
    if (event.data.type !== "restore-view-context") return;
    const accepted = acceptParentViewContext(event.data);
    event.source?.postMessage({
      channel: "ofw.s002",
      type: "view-context-accepted",
      view: event.data.view || params.get("view") || "report",
      context: cloneValue(context),
      accepted
    }, event.origin);
  });

  function requestParentViewContext() {
    if (window.parent === window || typeof window.parent?.postMessage !== "function") return;
    window.parent.postMessage({
      channel: "ofw.s002",
      type: "request-view-context",
      view: params.get("view") || ((window.location.hash || "").includes("dashboard") ? "dashboard" : "report"),
      context: cloneValue(context)
    }, window.location.origin);
  }
  requestParentViewContext();
  [120, 420].forEach((delay) => setTimeout(requestParentViewContext, delay));

  function isolateS002Catalog() {
    if (!(window.location.hash || "").includes("#/lifecycle")) return;
    // The frozen report-center page carries S003/S004 readiness examples as
    // baseline evidence. They are not consumable in an isolated S002 run, so
    // remove only those catalog records after the baseline renderer commits
    // its DOM. The S002 lifecycle rows, counters and all baseline controls stay
    // intact.
    const ownerState = readOwnerM06State();
    const reportBuilt = Boolean(ownerState?.progress?.reportBuilt);
    const dashboardPublished = Boolean(ownerState?.progress?.dashboardPublished);
    const report = ownerState?.reports?.[ownerState.reports.length - 1] || null;
    const dashboardVersion = ownerState?.dashboardVersions?.[ownerState.dashboardVersions.length - 1] || null;
    document.querySelectorAll(".ledger-row, .ledger-card").forEach((row) => {
      const code = row.querySelector(".scene-code")?.textContent?.trim();
      if (code === "S003" || code === "S004") row.remove();
      if (code !== "S002") return;
      if (!reportBuilt) return;
      const badgeNode = row.querySelector(".badge");
      if (badgeNode) {
        badgeNode.textContent = "草稿待复核";
        badgeNode.classList.remove("danger", "warning", "success", "neutral");
        badgeNode.classList.add("warning");
      }
      if (row.matches(".ledger-row")) {
        const columns = row.querySelectorAll(":scope > div");
        const version = columns[1]?.querySelector("strong");
        const updated = columns[2]?.querySelector("small");
        const next = columns[3]?.querySelector("strong");
        if (version) version.textContent = report?.version || "S002-REPORT-DRAFT-v1";
        if (updated) updated.textContent = "实施基准日 2026-08-15 · 报告草稿已形成";
        if (next) next.textContent = dashboardPublished ? "驾驶舱版本已发布；报告草稿继续人工复核" : "完成人工复核后再决定是否发布报告";
      } else {
        const values = row.querySelectorAll("dd");
        if (values[0]) values[0].textContent = report?.version || "S002-REPORT-DRAFT-v1";
        if (values[1]) values[1].textContent = "实施基准日 2026-08-15 · 报告草稿已形成";
        if (values[2]) values[2].textContent = dashboardPublished ? "驾驶舱版本已发布；报告草稿继续人工复核" : "完成人工复核";
      }
      const button = row.querySelector("button");
      if (button && reportBuilt) {
        button.dataset.action = "navigate";
        button.dataset.route = "/reports/draft";
        button.textContent = "打开报告草稿";
      }
    });
    document.querySelectorAll("button[disabled]").forEach((button) => {
      if (/\bS003\b|\bS004\b/.test(button.textContent || "")) button.remove();
    });
    const blocked = document.querySelector('[data-action="set-catalog-status"][data-status="阻断"]');
    if (blocked && !blocked.dataset.s002Isolated) {
      const count = blocked.querySelector("strong");
      const note = blocked.querySelector("small");
      const readinessGaps = [];
      if (!(upstreamOwnerStates.m02?.progress?.qualityPassed && upstreamOwnerStates.m02?.progress?.assetPublished)) readinessGaps.push("数据工程质量与资产发布");
      if (!upstreamOwnerStates.m01?.progress?.ontologyPublished) readinessGaps.push("本体管理 Published 切换");
      if (count) count.textContent = readinessGaps.length ? "1" : "0";
      if (note) note.textContent = readinessGaps.length
        ? `等待${readinessGaps.join("、")}；报告中心不补建前置状态`
        : "S002 数据资产与 Published 本体已就绪";
      blocked.dataset.s002Isolated = "true";
    }
    const review = document.querySelector('[data-action="set-catalog-status"][data-status="草稿待复核"]');
    if (review && reportBuilt) {
      const count = review.querySelector("strong");
      const note = review.querySelector("small");
      if (count) count.textContent = "1";
      if (note) note.textContent = dashboardPublished
        ? `报告草稿待复核；驾驶舱 ${dashboardVersion?.version || "S002-DASHBOARD-v1"} 已发布`
        : "报告草稿已形成，等待人工复核";
    }
    if (reportBuilt) {
      const lifecycleNodes = [...document.querySelectorAll(".lifecycle-rail .life-node")];
      lifecycleNodes.forEach((node, index) => {
        node.classList.toggle("done", index < 3);
        node.classList.toggle("active", index === 3);
      });
      const currentWork = document.querySelector('.lifecycle-board [data-action="navigate"]');
      if (currentWork && dashboardPublished) {
        currentWork.dataset.route = "/dashboard/s002?tab=overview";
        currentWork.textContent = "查看已发布驾驶舱";
      }
    }
  }
  let catalogRefreshScheduled = false;
  const scheduleCatalogRefresh = () => {
    if (catalogRefreshScheduled) return;
    catalogRefreshScheduled = true;
    setTimeout(() => { catalogRefreshScheduled = false; isolateS002Catalog(); }, 80);
  };
  scheduleCatalogRefresh();
  [160, 420, 900, 1600].forEach((delay) => setTimeout(isolateS002Catalog, delay));
  function bindCatalogRefresh() {
    document.addEventListener("click", scheduleCatalogRefresh, true);
    window.addEventListener("hashchange", scheduleCatalogRefresh);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindCatalogRefresh, { once: true });
  else bindCatalogRefresh();
  window.S002_M06_ADAPTER = Object.freeze({
    context: cloneValue(context),
    factPackage,
    get upstream() { return window.S002_M06_UPSTREAM; },
    dataVersion: DATA_VERSION
  });
})();
