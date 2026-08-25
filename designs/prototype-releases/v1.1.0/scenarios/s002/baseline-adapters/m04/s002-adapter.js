(function () {
  "use strict";

  // S002 adapter for the unmodified v1.0.3 decision-center review-v2 page.
  // It only supplies scenario data, Owner State and C017/C019 read projections; the baseline
  // DOM, React components, routes and action-confirmation semantics remain
  // owned by the copied v1.0.3 page.
  const params = new URLSearchParams(location.search);
  const context = {
    scenarioId: params.get("scenarioId") || "S002",
    scenarioVersion: params.get("scenarioVersion") || "S002-v1",
    scenarioRunId: params.get("scenarioRunId") || "S002-RUN-20260815160000000-9f72297443c6",
    formedAt: params.get("formedAt") || "2026-08-15T08:00:00.000Z",
    status: params.get("status") || "active",
    source: "预算监督管理运行"
  };
  const STATE_KEY = "ontology3-decision-center-review-v2-portfolio-state-v6";
  const C017_KEY = "ontology3.c017.decision-center.projection.v1";
  const C019_KEY = "ontology3.decision-center.c019.projection.v1";
  const PLATFORM_CONTEXT_KEY = "ontology3.platform.scenario-runtime.v1";
  const OWNER_STATE_KEY = `ofw:v1.1.0:${encodeURIComponent(context.scenarioId)}:${encodeURIComponent(context.scenarioVersion)}:${encodeURIComponent(context.scenarioRunId)}:m04:owned-state`;
  const DATA_VERSIONS = Object.freeze({
    budget: "S002-BUDGET-EXEC-v1",
    project: "S002-PROJECT-OCC-v1",
    compatibility: "S002-DATA-v1"
  });
  const DATA_VERSION = DATA_VERSIONS.compatibility;
  const SEMANTIC_VERSION = "S002-ONTO-v1";
  const ACTION_VERSION = "S002-ACTION-TYPE-v1";
  const RULE_VERSION = "S002-RULE-v1";
  const FORMED_AT = "2026-08-15 10:00:00";
  // S002 当前交付范围只保留决策中心基线能力，不生成运行态行动申请、
  // 决策事项或平台内待办。Action Type 仍由 M01 作为 Published 语义资源提供。
  const ACTION_RUNTIME_ENABLED = false;
  const REVIEW_WRITABLE = ACTION_RUNTIME_ENABLED && !["historical-readonly", "closed"].includes(context.status);
  const reviewWaiters = new Map();

  const LEGACY_ACTION_TYPE_ID_MAP = Object.freeze({
    "ACT-BUDGET-INCREASE": "ACT-BUDGET-EXECUTION-RECTIFICATION",
    "ACT-BUDGET-DECREASE": "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW",
    "ACT-SUBJECT-TRANSFER": "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW",
    "ACT-SUBMISSION-RETURN": "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT",
    "ACT-RELEASE-COMMITMENT": "ACT-PROCUREMENT-COMMITMENT-CLEANUP",
    "ACT-PRICE-REVIEW": "ACT-SUPPLIER-PRICE-REVIEW"
  });
  const canonicalActionTypeId = (id) => LEGACY_ACTION_TYPE_ID_MAP[id] || id;
  const actionType = (id, name, legacyCompatibleId) => ({ id, legacyCompatibleId, name, version: ACTION_VERSION, status: "已发布", publishedSemanticVersion: SEMANTIC_VERSION });
  const ACTIONS = {
    increase: actionType("ACT-BUDGET-EXECUTION-RECTIFICATION", "预算执行整改", "ACT-BUDGET-INCREASE"),
    decrease: actionType("ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", "下一年度预算合理性复核", "ACT-BUDGET-DECREASE"),
    transfer: actionType("ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", "费用管理优化核查", "ACT-SUBJECT-TRANSFER"),
    returnSubmission: actionType("ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", "预算申报依据补充", "ACT-SUBMISSION-RETURN"),
    release: actionType("ACT-PROCUREMENT-COMMITMENT-CLEANUP", "采购占用清理", "ACT-RELEASE-COMMITMENT"),
    priceReview: actionType("ACT-SUPPLIER-PRICE-REVIEW", "供应商价格复核", "ACT-PRICE-REVIEW")
  };
  const ACTION_BY_ID = new Map(Object.values(ACTIONS).flatMap((item) => [[item.id, item], [item.legacyCompatibleId, item]]));

  const RULE_CATALOG = {
    "RULE-001": { name: "项目预算覆盖风险", branch: "availableBalance < 0" },
    "RULE-002": { name: "费用预算执行偏离合理区间", branch: "expenseExecutionRate >= 95% OR expenseExecutionRate <= 70%" },
    "RULE-003": { name: "成本占收比异常", branch: "costToRevenue >= 100%" },
    "RULE-004": { name: "年末采购/预算占用集中", branch: "decemberProcurementShare >= 10% OR decemberBudgetOccupancyShare >= 10%" },
    "RULE-005": { name: "可比供应商价格偏高", branch: "currentUnitPrice / cohortMedianUnitPrice >= 1.2" }
  };

  const ACTION_DEFAULTS = {
    "ACT-BUDGET-EXECUTION-RECTIFICATION": { metricId: "MET-006", metricName: "项目可用立项余额", dataVersion: DATA_VERSIONS.project, recommendation: "形成项目预算执行整改核查，要求负责人说明覆盖不足原因和后续计划；仅生成平台内待办，不自动调增预算。" },
    "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW": { metricId: "MET-007", metricName: "预算执行率", dataVersion: DATA_VERSIONS.budget, recommendation: "形成下一年度预算合理性复核，核实未执行计划和预算测算依据；仅生成平台内待办，不覆盖最终批准预算。" },
    "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW": { metricId: "MET-001", metricName: "成本占收比", dataVersion: DATA_VERSIONS.budget, recommendation: "形成费用管理优化核查，复核收入确认、费用结构和可优化空间；仅生成平台内待办，不自动调账或科目调剂。" },
    "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT": { metricId: "MET-001", metricName: "成本占收比", dataVersion: DATA_VERSIONS.budget, recommendation: "形成预算申报依据补充，要求补充收入依据、成本拆解和测算说明；仅生成平台内待办，不自动退回申报。" },
    "ACT-PROCUREMENT-COMMITMENT-CLEANUP": { metricId: "MET-009", metricName: "年末采购/预算占用集中度", dataVersion: DATA_VERSIONS.project, recommendation: "形成采购占用逐笔清理核查，识别长期未转单或已取消采购；仅生成平台内待办，不直接释放外部占用。" },
    "ACT-SUPPLIER-PRICE-REVIEW": { metricId: "RULE-005-SUPPORT", metricName: "可比供应商价格倍率", dataVersion: DATA_VERSIONS.budget, recommendation: "形成供应商价格复核，核实可比组、税率、服务月数和报价依据；仅生成平台内待办，不触发供应商系统。" }
  };

  function businessAssignment(actionId, subjectName, suppliedOwner, suppliedOwnerId) {
    actionId = canonicalActionTypeId(actionId);
    const supplied = String(suppliedOwner || "").trim();
    const isLegacyPlaceholder = /承接人$/.test(supplied) || ["平台管理员", "财务运营账号"].includes(supplied);
    if (supplied && !isLegacyPlaceholder) {
      return { owner: supplied, ownerId: suppliedOwnerId || `BUSINESS-${String(actionId || "OWNER").replace(/[^A-Z0-9]+/gi, "-")}` };
    }
    const department = ["设备管理部", "技术部", "安全运行部"].find((name) => String(subjectName || "").includes(name));
    const departmentCode = department === "设备管理部" ? "SB" : department === "技术部" ? "JS" : department === "安全运行部" ? "AQ" : "BUDGET";
    const ownerId = suppliedOwnerId || `BUSINESS-OWNER-${departmentCode}-BUDGET`;
    if (actionId === "ACT-SUPPLIER-PRICE-REVIEW") return { owner: "采购管理部价格复核负责人", ownerId: suppliedOwnerId || "BUSINESS-OWNER-PROCUREMENT-PRICE" };
    if (actionId === "ACT-PROCUREMENT-COMMITMENT-CLEANUP") return { owner: department ? `${department}采购计划负责人` : "采购管理部占用清理负责人", ownerId: suppliedOwnerId || `BUSINESS-OWNER-${departmentCode}-COMMITMENT` };
    if (actionId === "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT") return { owner: department ? `${department}预算申报负责人` : "预算管理部申报复核负责人", ownerId: suppliedOwnerId || `BUSINESS-OWNER-${departmentCode}-SUBMISSION` };
    if (actionId === "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW") return { owner: department ? `${department}费用管理负责人` : "预算管理部费用评价负责人", ownerId };
    if (actionId === "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW") return { owner: department ? `${department}年度预算编制负责人` : "预算管理部年度预算编制负责人", ownerId };
    if (actionId === "ACT-BUDGET-EXECUTION-RECTIFICATION" && String(subjectName || "").includes("项目")) return { owner: department ? `${department}项目预算负责人` : "预算管理部项目预算负责人", ownerId };
    return { owner: department ? `${department}费用预算负责人` : "预算管理部预算执行负责人", ownerId };
  }

  function evidenceGroup(name, balance, contribution, loanCount, note) {
    return { name, balance, contribution, loanCount, note };
  }

  function evidenceDetail(id, bank, type, balance, rate) {
    return { id, bank, type, balance, rate };
  }

  function supportingEvidence(action, subjectId, subjectName, metric, suppliedBanks, suppliedLoans) {
    if (Array.isArray(suppliedBanks) && suppliedBanks.length && Array.isArray(suppliedLoans) && suppliedLoans.length) {
      return { banks: clone(suppliedBanks), loans: clone(suppliedLoans) };
    }
    const objectLabel = action.id === "ACT-SUPPLIER-PRICE-REVIEW"
      ? String(subjectName || "供应商价格可比组").split(" · ").at(-1)
      : String(subjectName || subjectId || "预算业务主体").split(" · ")[0];
    const reference = metric?.value || "待人工核对";
    return {
      banks: [{ name: objectLabel, balance: reference, contribution: "100%", loanCount: 1, note: `${metric?.name || "固定指标"}与业务主体已完成版本绑定` }],
      loans: [{ id: `EVID-${String(subjectId || action.id).replace(/[^a-zA-Z0-9\u3400-\u9fff-]/g, "-")}`, bank: objectLabel, type: `${action.name}固定证据`, balance: reference, rate: metric?.id || "固定指标" }]
    };
  }

  const evidence = (snapshotId, cutoff, dataVersion) => ({
    semanticVersion: SEMANTIC_VERSION,
    dataVersion: dataVersion || DATA_VERSION,
    cutoff: cutoff || "2025-12-31 23:59",
    quality: "质量检查通过（演示数据）",
    ready: "消费就绪",
    snapshotId,
    freshness: "演示数据（DERIVED/CORRECTED 标识保留）",
    availability: "完整可用",
    availableSections: ["指标快照", "预算版本", "主体范围", "异常证据", "Action 边界"],
    missingItems: []
  });

  const request = ({
    id,
    reminderId,
    subjectId,
    subjectName,
    sourceType,
    sourceRef,
    action,
    metric,
    rule,
    recommendation,
    priority,
    snapshotId,
    cutoff,
    generatedTime,
    owner,
    ownerId,
    banks,
    loans,
    requester,
    dataVersion,
    decisionFocus,
    executionBoundary,
    dataMarkers
  }) => {
    const assignment = businessAssignment(action.id, subjectName, owner, ownerId);
    const support = supportingEvidence(action, subjectId, subjectName, metric, banks, loans);
    const formed = generatedTime || FORMED_AT;
    return {
      id,
      reminderId,
      subjectId,
      subjectName,
      scenarioContext: context,
      scenario: "预算监督管理",
      sourceType,
      sourceRef,
      requester: requester || (sourceType === "agent" ? "预算异常分析 Agent" : sourceType === "report" ? "预算管理驾驶舱" : "规则运行服务"),
      requestTime: formed,
      generatedTime: formed,
      actionType: action,
      rule: rule ? { ...rule, version: rule.version || RULE_VERSION, publishedSemanticVersion: SEMANTIC_VERSION } : null,
      metric: { ...metric, evaluatedAt: metric.evaluatedAt || formed, scope: metric.scope || subjectName },
      loanCount: support.loans.length,
      balance: metric.value || "待人工核对",
      owner: assignment.owner,
      ownerId: assignment.ownerId,
      recommendation,
      banks: support.banks,
      loans: support.loans,
      evidence: evidence(snapshotId, cutoff, dataVersion),
      status: "awaiting",
      priority,
      decisionFocus: decisionFocus || recommendation,
      executionBoundary: executionBoundary || "仅生成平台内决策草稿和负责人待办；禁止自动审批、过账、外部派发或改写最终批准预算。",
      dataMarkers: Array.isArray(dataMarkers) ? clone(dataMarkers) : ["DERIVED"],
      sourceEvents: [],
      duplicateRequests: [],
      requestGate: {
        status: "accepted",
        checkedAt: generatedTime,
        reason: "S002 Action Type、主体、Metric/Rule 与固定证据完整；仅生成平台内决策事项。",
        reminderCreated: true
      },
      confirmationEligibility: { allowed: REVIEW_WRITABLE, requiresAcknowledgement: REVIEW_WRITABLE, reason: REVIEW_WRITABLE ? "固定预算证据可进入人工确认或拒绝" : "历史快照只读，禁止提交人工决定" },
      supplementPolicy: { canRequest: false, editableUpstream: false, resolutionMode: "等待新的 S002 固定证据" },
      supplementRequests: [],
      decision: null,
      formation: {
        requestGateStatus: "accepted",
        requestGateCheckedAt: generatedTime,
        requestGateReason: "请求校验通过",
        reminderCreated: true,
        confirmationGateStatus: REVIEW_WRITABLE ? "passed" : "blocked",
        confirmationGateReason: REVIEW_WRITABLE ? "固定预算证据可进入人工判断" : "历史快照只读，禁止提交人工决定"
      },
      c017SafetyReads: [],
      c017ReadAttempts: { request_receipt: 0, confirmation_submit: 0, task_formation: 0 },
      s001DataStructure: { members: ["预算主体", "预算版本", "实际凭证", "项目占用"], relations: ["预算主体→预算版本", "预算版本→实际凭证", "项目→采购占用"] }
    };
  };

  const SOURCE_ID_ORDER = ["HIT-001", "HIT-002-2024-AQ", "HIT-003-2025-AQ", "HIT-002-2025-AQ", "HIT-004", "HIT-005", "SUG-001", "HIT-002-2025-SB"];
  const INACTIVE_LEGACY_REQUEST_FIXTURES = [
    request({
      id: "AR-S002-001", reminderId: "DR-S002-001", subjectId: "PRJ-AQ-概率-2025-002", subjectName: "安全运行部 · 概率安全分析项目",
      sourceType: "rule", sourceRef: "M03 · HIT-001 · RULE-001", action: ACTIONS.increase, priority: "高", snapshotId: "CP-E2E-S002-001", dataVersion: DATA_VERSIONS.project,
      metric: { id: "MET-006", name: "项目可用立项余额", value: "-20.50 万元", explanation: "124.00 - 82.4138 - 62.09 - 0 = -20.5038 万元；显示值四舍五入为 -20.50 万元" },
      rule: { id: "RULE-001", name: "项目预算覆盖风险", evaluatedAt: FORMED_AT, branch: "availableBalance < 0", hitEvidence: "概率安全分析项目可用立项余额 -20.5038 万元，低于 0 万元" },
      recommendation: "请核实剩余交付、采购占用和预计成本，说明覆盖不足原因并提交项目预算执行整改计划；仅形成平台内待办，不自动调增、调剂或覆盖最终批准预算。",
      decisionFocus: "是否需要安全运行部提交项目预算执行整改计划，并说明后续支出如何控制在可用资源范围内。",
      owner: "安全运行部项目预算负责人", ownerId: "BUSINESS-OWNER-AQ-BUDGET", dataMarkers: ["DERIVED", "SOURCE_COVERED"],
      banks: [
        evidenceGroup("项目立项金额", "124.00 万元", "预算基准", 1, "项目预算使用表确认快照"),
        evidenceGroup("实际执行", "82.4138 万元", "66.46%", 1, "实际执行明细汇总"),
        evidenceGroup("净在途占用", "62.09 万元", "50.07%", 1, "项目预算占用确认快照")
      ],
      loans: [
        evidenceDetail("EVID-PRJ-AQ-001", "概率安全分析项目", "立项与已用重算", "124.00 - 82.4138 - 62.09", "MET-006"),
        evidenceDetail("EVID-PRJ-AQ-002", "概率安全分析项目", "剩余余额", "-20.5038 万元", "RULE-001")
      ]
    }),
    request({
      id: "AR-S002-002", reminderId: "DR-S002-002", subjectId: "ORG-AQ-FY2024", subjectName: "安全运行部 · 2024最终批准预算",
      sourceType: "rule", sourceRef: "M03 · HIT-002-2024-AQ · RULE-002", action: ACTIONS.transfer, priority: "高", snapshotId: "CP-E2E-S002-002", cutoff: "2024-12-31 23:59", dataVersion: DATA_VERSIONS.budget,
      metric: { id: "MET-007", name: "预算执行率", value: "125.48%", explanation: "实际费用 377.7032 万元 / 2024最终批准费用预算 301.00 万元" },
      rule: { id: "RULE-002", name: "费用预算执行偏离合理区间", evaluatedAt: FORMED_AT, branch: "expenseExecutionRate > 100%", hitEvidence: "安全运行部2024费用预算执行率 125.48%，高于最终批准预算 25.48 个百分点" },
      recommendation: "先确认21组重复凭证属于多科目合法分录，且13条期间修正、6条日期修正未造成重复计量，再复盘费用结构和管理改进空间；2024期间已关闭，建议不新建历史调整待办。",
      decisionFocus: "是否接受凭证口径解释并将该事项作为历史复盘归档，而不是发起预算调剂或追溯修改。",
      owner: "安全运行部费用管理负责人", ownerId: "BUSINESS-OWNER-AQ-BUDGET", dataMarkers: ["MIXED_SOURCE_AND_DEMO_MARKERS", "CORRECTED", "SOURCE"],
      banks: [
        evidenceGroup("2024最终批准费用预算", "301.00 万元", "预算基准", 1, "预算下达明细"),
        evidenceGroup("2024实际费用", "377.7032 万元", "125.48%", 1, "场景确认快照"),
        evidenceGroup("凭证口径核验", "21组 / 13条 / 6条", "不去重不覆盖", 40, "合法重复、期间修正、日期修正均保留源值")
      ],
      loans: [
        evidenceDetail("EVID-AQ-2024-001", "21组重复凭证", "合法多科目分录", "全部保留", "SOURCE"),
        evidenceDetail("EVID-AQ-2024-002", "13条期间记录", "源值与修正值并存", "参与演示计算使用修正期间", "CORRECTED"),
        evidenceDetail("EVID-AQ-2024-003", "6条日期记录", "源日期与修正日期并存", "不覆盖源记录", "CORRECTED")
      ]
    }),
    request({
      id: "AR-S002-003", reminderId: "DR-S002-003", subjectId: "ORG-AQ-FY2025-COST", subjectName: "安全运行部 · 2025成本费用表现",
      sourceType: "rule", sourceRef: "M03 · HIT-003-2025-AQ · RULE-003", action: ACTIONS.transfer, priority: "中", snapshotId: "CP-E2E-S002-003", dataVersion: DATA_VERSIONS.budget,
      metric: { id: "MET-001", name: "成本占收比", value: "112.63%", explanation: "实际费用 310.3201 万元 / 收入净额 275.5278 万元；真正毛利率为 -12.63%" },
      rule: { id: "RULE-003", name: "成本占收比异常", evaluatedAt: FORMED_AT, branch: "costToRevenue >= 100%", hitEvidence: "安全运行部2025成本占收比 112.63%，超过100%关注线，真正毛利率为负" },
      recommendation: "核实收入确认、费用结构及可优化空间，提交成本费用原因说明与整改建议；仅生成评价整改待办，不自动调增、调减或科目调剂。",
      decisionFocus: "是否要求安全运行部核实收入确认与费用管理优化空间，并提交整改说明。",
      owner: "安全运行部费用管理负责人", ownerId: "BUSINESS-OWNER-AQ-COST", dataMarkers: ["MIXED_SOURCE_AND_DEMO_MARKERS", "DERIVED"],
      banks: [
        evidenceGroup("2025收入净额", "275.5278 万元", "年度分母", 1, "实际执行确认快照"),
        evidenceGroup("2025实际费用", "310.3201 万元", "112.63%", 1, "实际执行确认快照"),
        evidenceGroup("真正毛利率", "-12.63%", "经营结果", 1, "1 - 成本占收比")
      ],
      loans: [evidenceDetail("EVID-AQ-2025-COST-001", "安全运行部", "成本费用表现", "112.63% / -12.63%", "RULE-003")]
    }),
    request({
      id: "AR-S002-004", reminderId: "DR-S002-004", subjectId: "ORG-AQ-FY2025", subjectName: "安全运行部 · 2025最终批准预算",
      sourceType: "rule", sourceRef: "M03 · HIT-002-2025-AQ · RULE-002", action: ACTIONS.increase, priority: "中", snapshotId: "CP-E2E-S002-004", dataVersion: DATA_VERSIONS.budget,
      metric: { id: "MET-007", name: "预算执行率", value: "98.86%", explanation: "实际费用 310.3201 万元 / 2025最终批准费用预算 313.90 万元" },
      rule: { id: "RULE-002", name: "费用预算执行偏离合理区间", evaluatedAt: FORMED_AT, branch: "expenseExecutionRate >= 95% AND expenseExecutionRate <= 100%", hitEvidence: "安全运行部2025费用预算执行率 98.86%，进入95%—100%关注区间" },
      recommendation: "核实剩余3.5799万元预算空间、仍在途采购和未结计划，形成费用控制与后续执行说明；仅生成整改核查待办，不自动增加预算。",
      decisionFocus: "是否要求安全运行部提交费用控制说明和剩余计划核对结果。",
      owner: "安全运行部费用预算负责人", ownerId: "BUSINESS-OWNER-AQ-BUDGET", dataMarkers: ["MIXED_SOURCE_AND_DEMO_MARKERS", "DERIVED"],
      banks: [
        evidenceGroup("2025最终批准费用预算", "313.90 万元", "预算基准", 1, "预算下达明细"),
        evidenceGroup("2025实际费用", "310.3201 万元", "98.86%", 1, "实际执行确认快照"),
        evidenceGroup("剩余预算空间", "3.5799 万元", "1.14%", 1, "最终批准预算减实际")
      ],
      loans: [evidenceDetail("EVID-AQ-2025-001", "安全运行部", "费用执行接近上限", "98.86%", "MET-007")]
    }),
    request({
      id: "AR-S002-005", reminderId: "DR-S002-005", subjectId: "PRJ-SB-设备-2025-002", subjectName: "设备管理部 · 设备维护项目采购占用",
      sourceType: "rule", sourceRef: "M03 · HIT-004 · RULE-004", action: ACTIONS.release, priority: "高", snapshotId: "CP-E2E-S002-005", dataVersion: DATA_VERSIONS.project,
      metric: { id: "MET-009", name: "年末采购/预算占用集中度", value: "18.94%", explanation: "12月净在途占用 9.29 万元 / 全年净在途占用 49.04 万元" },
      rule: { id: "RULE-004", name: "年末采购/预算占用集中", evaluatedAt: FORMED_AT, branch: "decemberBudgetOccupancyShare >= 15%", hitEvidence: "设备维护项目12月净在途占用占全年 18.94%，达到高等级" },
      recommendation: "逐笔核对长期未转PO、已取消采购和年末集中发起记录，形成采购占用清理清单；只生成平台内待办，不直接释放外部系统占用。",
      decisionFocus: "是否要求设备管理部逐笔确认需继续保留、转单或建议释放的采购占用。",
      owner: "设备管理部采购计划负责人", ownerId: "BUSINESS-OWNER-SB-COMMITMENT", dataMarkers: ["SOURCE", "DERIVED", "SYNTHETIC_FOR_DEMO"],
      banks: [
        evidenceGroup("全年净在途占用", "49.04 万元", "年度分母", 1, "项目预算占用快照"),
        evidenceGroup("12月净在途占用", "9.29 万元", "18.94%", 2, "12月采购发起与释放记录"),
        evidenceGroup("项目可用立项余额", "321.9713 万元", "可用", 1, "立项金额583.00万元重算")
      ],
      loans: [
        evidenceDetail("OCC-2025-081", "PR-2512-088", "12月正向采购发起", "12.05 万元", "SYNTHETIC_FOR_DEMO"),
        evidenceDetail("OCC-2025-094", "PO-2512-014", "12月占用释放记录", "-4.10 万元", "SYNTHETIC_FOR_DEMO")
      ]
    }),
    request({
      id: "AR-S002-006", reminderId: "DR-S002-006", subjectId: "PRJ-AQ-灾害-2025-002", subjectName: "安全运行部 · 供应商3初级技术服务",
      sourceType: "rule", sourceRef: "M03 · HIT-005 · RULE-005", action: ACTIONS.priceReview, priority: "中", snapshotId: "CP-E2E-S002-006", cutoff: "2025-10-31 23:59", dataVersion: DATA_VERSIONS.budget,
      metric: { id: "RULE-005-SUPPORT", name: "可比供应商价格倍率（Rule输入快照）", value: "1.20 倍", explanation: "13,200 / 11,000 元/人月；同年度、同服务类别、同级别、同单位、6%税率、12服务人月" },
      rule: { id: "RULE-005", name: "可比供应商价格偏高", evaluatedAt: FORMED_AT, branch: "currentUnitPrice / cohortMedianUnitPrice >= 1.2", hitEvidence: "供应商3初级技术服务单价达到同口径组中位数 1.20 倍" },
      recommendation: "核实可比组、税率、服务月数和报价依据，记录价格差异解释；只生成价格复核待办，不自动改价或调用供应商系统。",
      decisionFocus: "是否要求采购管理部对供应商3报价开展同口径价格复核。",
      owner: "采购管理部价格复核负责人", ownerId: "BUSINESS-OWNER-PROCUREMENT-PRICE", dataMarkers: ["SOURCE", "DERIVED"],
      banks: [
        evidenceGroup("供应商3报价", "13,200 元/人月", "120.00%", 1, "2026初始申报报价"),
        evidenceGroup("同口径组中位价", "11,000 元/人月", "100.00%", 3, "同税率同服务月数可比组"),
        evidenceGroup("价格差额", "2,200 元/人月", "20.00%", 1, "达到RULE-005复核线")
      ],
      loans: [evidenceDetail("QUOTE-AQ-S3-2026", "供应商3", "初级技术服务报价", "13,200 元/人月", "1.20倍")]
    }),
    request({
      id: "AR-S002-007", reminderId: "DR-S002-007", subjectId: "ORG-JS-FY2025-INITIAL", subjectName: "技术部 · 2025初始申报预算",
      sourceType: "qa", sourceRef: "M03 · SUG-001 · 预算分析建议", requester: "预算分析建议", action: ACTIONS.returnSubmission, priority: "中", snapshotId: "CP-E2E-S002-007", cutoff: "2024-10-31 23:59", dataVersion: DATA_VERSIONS.budget,
      metric: { id: "MET-001", name: "成本占收比", value: "310.30%", explanation: "初始申报总成本 1,695.15 万元 / 收入净额 546.30 万元；该项为分析建议，不冒充正式Rule命中" },
      recommendation: "要求技术部补充收入依据、项目成本、技术配置费和公共费用测算说明，并解释成本占收比超过100%的原因；只生成资料补充待办，不自动退回或改写申报。",
      decisionFocus: "是否要求技术部补充2025初始申报的成本拆解和收入实现依据。",
      owner: "技术部预算申报负责人", ownerId: "BUSINESS-OWNER-JS-SUBMISSION", dataMarkers: ["MIXED_SOURCE_AND_DEMO_MARKERS", "DERIVED"],
      banks: [
        evidenceGroup("申报收入净额", "546.30 万元", "100.00%", 1, "2025初始申报快照"),
        evidenceGroup("申报总成本", "1,695.15 万元", "310.30%", 1, "项目成本、技术配置费和公共费用"),
        evidenceGroup("技术配置费", "801.58 万元", "146.73%", 1, "场景加工叠加项，保留DERIVED标识")
      ],
      loans: [evidenceDetail("SUB-JS-2025-001", "技术部", "2025初始申报测算", "1,695.15 / 546.30", "MET-001")]
    }),
    request({
      id: "AR-S002-008", reminderId: "DR-S002-008", subjectId: "ORG-SB-FY2025", subjectName: "设备管理部 · 2025最终批准预算",
      sourceType: "rule", sourceRef: "M03 · HIT-002-2025-SB · RULE-002", action: ACTIONS.decrease, priority: "中", snapshotId: "CP-E2E-S002-008", dataVersion: DATA_VERSIONS.budget,
      metric: { id: "MET-007", name: "预算执行率", value: "63.20%", explanation: "实际费用 255.6557 万元 / 2025最终批准费用预算 404.50 万元，低于70%合理区间下限" },
      rule: { id: "RULE-002", name: "费用预算执行偏离合理区间", evaluatedAt: FORMED_AT, branch: "expenseExecutionRate <= 70%", hitEvidence: "设备管理部2025费用预算执行率 63.20%，低于70%合理区间下限" },
      recommendation: "核实148.8443万元未执行预算对应的计划取消、延期、采购占用和年末应计情况，将结论用于下一年度预算测算；不自动调减或覆盖最终批准预算。",
      decisionFocus: "是否要求设备管理部提交未执行计划清单，并启动下一年度预算合理性复核。",
      owner: "设备管理部年度预算编制负责人", ownerId: "BUSINESS-OWNER-SB-BUDGET", dataMarkers: ["MIXED_SOURCE_AND_DEMO_MARKERS", "DERIVED"],
      banks: [
        evidenceGroup("2025最终批准费用预算", "404.50 万元", "预算基准", 1, "预算下达明细"),
        evidenceGroup("2025实际费用", "255.6557 万元", "63.20%", 1, "实际执行确认快照"),
        evidenceGroup("未执行预算", "148.8443 万元", "36.80%", 1, "需核对计划、占用和应计")
      ],
      loans: [evidenceDetail("EVID-SB-2025-001", "设备管理部", "预算执行偏低Rule命中", "63.20%", "RULE-002")]
    })
  ].map((item, index) => ({ ...item, sourceId: SOURCE_ID_ORDER[index] }));
  // 旧事项仅保留为纠偏前实现证据，不再进入任何运行态投影。
  const requests = Object.freeze([]);

  const allowedRead = (gate, dataVersion = DATA_VERSION) => ({
    gate,
    gateLabel: gate === "request_receipt" ? "行动申请接收前" : gate === "confirmation_submit" ? "人工确认提交前" : "负责人待办形成前",
    t007: dataVersion,
    dataAssetVersions: [DATA_VERSIONS.budget, DATA_VERSIONS.project],
    summaryId: dataVersion === DATA_VERSIONS.project ? "C017-S002-PROJECT-OCC-v1" : dataVersion === DATA_VERSIONS.budget ? "C017-S002-BUDGET-EXEC-v1" : "C017-S002-DATA-v1",
    summaryVersion: "current-1",
    summaryFormedAt: FORMED_AT,
    readAt: FORMED_AT,
    qualityStatus: "允许推进",
    hardFailure: "否",
    detectedAt: "不适用",
    impactScope: "无硬质量失败影响",
    businessFieldCategories: "预算、实际、项目占用、供应商价格",
    reason: "S002 演示质量摘要允许平台内 Action 草稿与待办流程继续推进。",
    recovery: "无需恢复",
    evidenceLocator: `${dataVersion === DATA_VERSIONS.project ? "C017-S002-PROJECT-OCC-v1" : dataVersion === DATA_VERSIONS.budget ? "C017-S002-BUDGET-EXEC-v1" : "C017-S002-DATA-v1"} / current`,
    outcome: "allowed"
  });

  const draftState = {
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: context,
    actionPolicy: "disabled-for-s002-current-scope",
    requests: requests.map((item) => ({ ...item, c017SafetyReads: [allowedRead("request_receipt", item.evidence.dataVersion)] })),
    tasks: [],
    receipts: [],
    auditHistory: [],
    aiSummaries: { workbench: { status: "idle" }, operationsOverview: { status: "idle" } },
    pageStates: { workbench: { status: "ready" }, taskWork: { status: "ready" }, operationsOverview: { status: "ready" } },
    activity: [],
    resetAt: null,
    decisionSummary: { id: "C019-S002-NOT-APPLICABLE", status: "no-runtime-actions", requestCount: 0, pendingCount: 0, awaitingCount: 0, confirmedCount: 0, rejectedCount: 0, todoCount: 0, formedAt: context.formedAt },
    ownerProjection: { status: "missing", ownerModule: "M04", ownerStateKey: OWNER_STATE_KEY, externalDispatchCount: 0 }
  };

  const c017 = {
    schemaVersion: 1,
    projectionId: C017_KEY,
    projectionVersion: "S002-C017-v1",
    formedAt: FORMED_AT,
    readStatus: "ready",
    contractCode: "C017",
    sourceModule: "数据工程",
    consumer: "决策中心",
    scenarioContext: context,
    projections: [{
      scenarioContext: context,
      assetId: "S002-BUDGET-EXEC",
      dataVersion: DATA_VERSIONS.budget,
      asOf: "2025-12-31",
      allowConsumption: true,
      quality: { status: "质量检查通过", warnings: ["21组合法重复凭证保留；13条期间异常、6条日期倒置保留源值与CORRECTED标识"] },
      freshness: { label: "演示快照已固定", status: "当前" },
      currentStateSummary: { id: "C017-S002-BUDGET-EXEC-v1", version: "current-1", formedAt: FORMED_AT, qualityStatus: "质量检查通过", hardQualityFailure: false, reason: "预算编制与执行资产可消费；合法重复保留，修正记录保留源值和修正值。", recovery: "无需恢复" },
      versionBindingSummary: { id: "C017-S002-BUDGET-BINDING-v1", version: "1.0", formedAt: FORMED_AT },
      refresh: { t018EvidenceId: "C018-S002-v1" },
      gates: { request_receipt: { hardQualityFailure: false, qualityStatus: "允许推进" }, confirmation_submit: { hardQualityFailure: false, qualityStatus: "允许推进" }, task_formation: { hardQualityFailure: false, qualityStatus: "允许推进" } }
    }, {
      scenarioContext: context,
      assetId: "S002-PROJECT-OCC",
      dataVersion: DATA_VERSIONS.project,
      asOf: "2025-12-31",
      allowConsumption: true,
      quality: { status: "质量检查通过", warnings: ["仅3个项目具备源占用覆盖；其余项目占用按IMPUTED_ZERO标识，不用于推断真实生产状态"] },
      freshness: { label: "演示快照已固定", status: "当前" },
      currentStateSummary: { id: "C017-S002-PROJECT-OCC-v1", version: "current-1", formedAt: FORMED_AT, qualityStatus: "质量检查通过", hardQualityFailure: false, reason: "项目预算占用与余额资产可消费；立项金额、实际、净在途与计提可追溯。", recovery: "无需恢复" },
      versionBindingSummary: { id: "C017-S002-PROJECT-BINDING-v1", version: "1.0", formedAt: FORMED_AT },
      refresh: { t018EvidenceId: "C018-S002-v1" },
      gates: { request_receipt: { hardQualityFailure: false, qualityStatus: "允许推进" }, confirmation_submit: { hardQualityFailure: false, qualityStatus: "允许推进" }, task_formation: { hardQualityFailure: false, qualityStatus: "允许推进" } }
    }]
  };

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function parentOrigin() {
    try { return new URL(window.location.href).origin; } catch (_) { return window.location.origin || "*"; }
  }
  function ownerShellApi() {
    try {
      if (window.parent !== window && typeof window.parent?.S002_SHELL?.reviewM04Action === "function") return window.parent.S002_SHELL;
      if (window.top !== window && typeof window.top?.S002_SHELL?.reviewM04Action === "function") return window.top.S002_SHELL;
    } catch (_) {}
    return null;
  }
  function normalizeOwnerDecisionResult(result) {
    return {
      ...(result || {}),
      ok: result?.outcome === "accepted",
      message: result?.reason || null
    };
  }
  function submitOwnerDecision(payload) {
    if (!REVIEW_WRITABLE) return Promise.resolve({ ok: false, outcome: "rejected", message: "历史快照只读，禁止提交人工决定。" });
    if (window.parent === window || typeof window.parent?.postMessage !== "function") return Promise.resolve({ ok: false, outcome: "rejected", message: "请从S002统一工作台进入决策中心。" });
    const requestId = payload && payload.requestId;
    const decision = payload && payload.decision;
    if (!requestId || !["confirm", "reject"].includes(decision)) return Promise.resolve({ ok: false, outcome: "rejected", message: "人工决定请求不完整。" });
    const correlationId = `M04-REVIEW-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const message = {
      channel: "ofw.s002",
      type: "m04-review-action",
      correlationId,
      context: clone(context),
      requestId,
      decision,
      metadata: clone(payload.metadata || {})
    };
    const ownerShell = ownerShellApi();
    if (ownerShell) {
      try {
        return Promise.resolve(normalizeOwnerDecisionResult(ownerShell.reviewM04Action(message)));
      } catch (error) {
        return Promise.resolve({ ok: false, outcome: "rejected", message: error?.message || "统一工作台未能保存本次人工决定。" });
      }
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        reviewWaiters.delete(correlationId);
        resolve({ ok: false, outcome: "timeout", message: "统一工作台未在限定时间内返回人工决定结果。" });
      }, 8000);
      reviewWaiters.set(correlationId, { resolve, timer });
      window.parent.postMessage(message, parentOrigin());
    });
  }
  function receiveOwnerDecisionResult(event) {
    if (event.origin !== parentOrigin() || event.data?.channel !== "ofw.s002" || event.data?.type !== "m04-review-action-result") return;
    const waiter = reviewWaiters.get(event.data.correlationId);
    if (!waiter) return;
    window.clearTimeout(waiter.timer);
    reviewWaiters.delete(event.data.correlationId);
    waiter.resolve({ ...event.data, ok: event.data.outcome === "accepted", message: event.data.reason || null });
  }
  window.addEventListener("message", receiveOwnerDecisionResult);
  function candidateContext(value) { return value?.scenarioContext || value?.context || value; }
  function sameRun(value) {
    const candidate = candidateContext(value);
    return candidate?.scenarioId === context.scenarioId
      && candidate?.scenarioVersion === context.scenarioVersion
      && candidate?.scenarioRunId === context.scenarioRunId;
  }
  function readOwnerM04State() {
    try {
      const snapshot = window.parent !== window && window.parent?.S002_STORE?.get?.();
      if (sameRun(snapshot?.context)) {
        return {
          moduleId: "M04",
          moduleVersion: "S002-M04-1.0.0",
          progress: {
            actionsDrafted: Boolean(snapshot.progress?.actionsDrafted),
            actionConfirmed: Boolean(snapshot.progress?.actionConfirmed),
            todoCreated: Boolean(snapshot.progress?.todoCreated)
          },
          actionRequests: Array.isArray(snapshot.actionRequests) ? snapshot.actionRequests : [],
          decisionAlerts: Array.isArray(snapshot.decisionAlerts) ? snapshot.decisionAlerts : [],
          todos: Array.isArray(snapshot.todos) ? snapshot.todos : [],
          actionPolicy: snapshot.actionPolicy || (snapshot.decisionSummary?.status === "no-runtime-actions" ? "disabled-for-s002-current-scope" : null),
          decisionSummary: snapshot.decisionSummary || null
        };
      }
    } catch (_) {}
    const envelope = readJson(OWNER_STATE_KEY);
    const ownerState = envelope?.payload;
    if (!sameRun(envelope) || ownerState?.moduleId !== "M04") return null;
    return ownerState;
  }
  function displayTime(value, fallback = FORMED_AT) {
    const text = String(value || fallback);
    return text.replace("T", " ").replace(/\.\d{3}Z$/, "").replace(/Z$/, "");
  }
  function dueDate(value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return value;
    const source = new Date(value || context.formedAt || "2026-08-15T10:00:00.000Z");
    if (Number.isNaN(source.getTime())) return "2026-08-22";
    source.setUTCDate(source.getUTCDate() + 7);
    return source.toISOString().slice(0, 10);
  }
  function ownerStatus(value) {
    if (["confirmed", "simulated-confirmed"].includes(value)) return "confirmed";
    if (value === "rejected") return "rejected";
    return "awaiting";
  }
  function taskStatus(value) {
    const labels = { "待处理": "assigned", "待承接": "assigned", "处理中": "in_progress", "已完成": "completed", "已取消": "cancelled" };
    return labels[value] || (['assigned', 'pending', 'in_progress', 'completed', 'cancelled', 'corrected'].includes(value) ? value : "assigned");
  }
  function ownerField(ownerRequest, name, fallback = null) {
    if (ownerRequest?.[name] !== undefined && ownerRequest?.[name] !== null) return ownerRequest[name];
    if (ownerRequest?.payload?.[name] !== undefined && ownerRequest?.payload?.[name] !== null) return ownerRequest.payload[name];
    if (ownerRequest?.dashboardTrigger?.[name] !== undefined && ownerRequest?.dashboardTrigger?.[name] !== null) return ownerRequest.dashboardTrigger[name];
    return fallback;
  }
  function preferDetailedText(candidate, fallback, minimumLength = 30) {
    const candidateText = String(candidate || "").trim();
    const fallbackText = String(fallback || "").trim();
    return candidateText.length >= minimumLength ? candidateText : fallbackText || candidateText;
  }
  function normalizeSourceType(value) {
    const source = String(value || "report").toLowerCase();
    if (source.includes("report") || source.includes("dashboard")) return "report";
    if (source.includes("query") || source.includes("qa") || source.includes("suggestion")) return "qa";
    if (source.includes("agent")) return "agent";
    return "rule";
  }
  function formatMetricValue(value, unit, amount) {
    if (value !== undefined && value !== null && value !== "") {
      if (typeof value === "number" && unit === "%") return `${value.toFixed(2)}%`;
      if (typeof value === "number" && unit === "倍") return `${value.toFixed(2)} 倍`;
      if (typeof value === "number" && unit) return `${value} ${unit}`;
      return String(value);
    }
    if (amount !== undefined && amount !== null && amount !== "") return `${amount} 万元`;
    return "待人工核对";
  }
  function dynamicTemplate(ownerRequest, index) {
    const actionId = canonicalActionTypeId(ownerField(ownerRequest, "actionTypeId", "ACT-BUDGET-EXECUTION-RECTIFICATION"));
    const actionName = ownerField(ownerRequest, "actionType", ACTION_DEFAULTS[actionId]?.recommendation ? ACTION_BY_ID.get(actionId)?.name : "预算行动");
    const action = clone(ACTION_BY_ID.get(actionId) || actionType(actionId, actionName || "预算行动"));
    const defaults = ACTION_DEFAULTS[actionId] || { metricId: ownerField(ownerRequest, "metricId", "MET-S002-DASHBOARD"), metricName: "驾驶舱预警指标", recommendation: "形成平台内行动草稿，待人工确认。" };
    const sourceId = ownerField(ownerRequest, "sourceId", `DASHBOARD-${String(index + 1).padStart(3, "0")}`);
    const ownerRequestId = ownerField(ownerRequest, "requestId", `AR-S002-DASHBOARD-${String(index + 1).padStart(3, "0")}`);
    const subjectId = ownerField(ownerRequest, "subjectId", ownerField(ownerRequest, "singleBusinessSubjectId", ownerField(ownerRequest, "subject", `SUBJECT-${sourceId}`)));
    const department = ownerField(ownerRequest, "department", "");
    const subjectName = ownerField(ownerRequest, "subjectName", ownerField(ownerRequest, "singleBusinessSubjectName", ownerField(ownerRequest, "subject", department || "预算业务主体")));
    const unit = ownerField(ownerRequest, "metricUnit", ownerField(ownerRequest, "unit", ""));
    const metricValue = formatMetricValue(ownerField(ownerRequest, "metricValue", ownerField(ownerRequest, "value")), unit, ownerField(ownerRequest, "amount"));
    const metric = {
      id: ownerField(ownerRequest, "metricId", defaults.metricId),
      name: ownerField(ownerRequest, "metricName", defaults.metricName),
      value: metricValue,
      explanation: ownerField(ownerRequest, "metricExplanation", ownerField(ownerRequest, "triggerReason", ownerField(ownerRequest, "title", "预算驾驶舱预警已达到人工关注条件"))),
      evaluatedAt: displayTime(ownerField(ownerRequest, "evaluatedAt", ownerField(ownerRequest, "createdAt", context.formedAt))),
      scope: subjectName
    };
    const ruleId = ownerField(ownerRequest, "ruleId");
    const ruleCatalog = RULE_CATALOG[ruleId] || {};
    const rule = ruleId ? {
      id: ruleId,
      name: ownerField(ownerRequest, "ruleName", ruleCatalog.name || "预算监督规则"),
      version: ownerField(ownerRequest, "ruleVersion", RULE_VERSION),
      evaluatedAt: metric.evaluatedAt,
      branch: ownerField(ownerRequest, "ruleBranch", ruleCatalog.branch || "按已发布条件评估"),
      hitEvidence: ownerField(ownerRequest, "ruleHitEvidence", `${metric.name} ${metric.value}`)
    } : null;
    const suppliedOwner = ownerField(ownerRequest, "businessOwner", ownerField(ownerRequest, "assignee", ownerField(ownerRequest, "responsibleOwner", ownerField(ownerRequest, "owner"))));
    const suppliedOwnerId = ownerField(ownerRequest, "businessOwnerId", ownerField(ownerRequest, "assigneeId", ownerField(ownerRequest, "responsibleOwnerId", ownerField(ownerRequest, "ownerId"))));
    return {
      ...request({
        id: ownerRequestId,
        reminderId: ownerField(ownerRequest, "reminderId", `DR-${String(ownerRequestId).replace(/^AR-/, "")}`),
        subjectId,
        subjectName,
        sourceType: normalizeSourceType(ownerField(ownerRequest, "sourceType")),
        sourceRef: ownerField(ownerRequest, "sourceRef", `M06 · ${sourceId} · 预算驾驶舱预警`),
        requester: ownerField(ownerRequest, "requester", "预算管理驾驶舱"),
        action,
        metric,
        rule,
        recommendation: ownerField(ownerRequest, "recommendation", defaults.recommendation),
        priority: ownerField(ownerRequest, "priority", "中"),
        snapshotId: ownerField(ownerRequest, "snapshotId", ownerField(ownerRequest, "metricSnapshotId", `CP-M06-${sourceId}`)),
        cutoff: ownerField(ownerRequest, "cutoff", ownerField(ownerRequest, "asOf", "2025-12-31 23:59")),
        generatedTime: displayTime(ownerField(ownerRequest, "createdAt", context.formedAt)),
        dataVersion: ownerField(ownerRequest, "dataVersion", ownerField(ownerRequest, "dataAssetVersion", defaults.dataVersion || (actionId === "ACT-PROCUREMENT-COMMITMENT-CLEANUP" || actionId === "ACT-BUDGET-EXECUTION-RECTIFICATION" && String(subjectName).includes("项目") ? DATA_VERSIONS.project : DATA_VERSIONS.budget))),
        decisionFocus: ownerField(ownerRequest, "decisionFocus", ownerField(ownerRequest, "triggerReason", ownerField(ownerRequest, "title", defaults.recommendation))),
        executionBoundary: ownerField(ownerRequest, "executionBoundary", "仅生成平台内决策草稿和负责人待办；禁止自动审批、过账、外部派发或改写最终批准预算。"),
        dataMarkers: ownerField(ownerRequest, "dataMarkers", [ownerField(ownerRequest, "dataMarker", "DERIVED")]),
        owner: suppliedOwner,
        ownerId: suppliedOwnerId,
        banks: ownerField(ownerRequest, "banks", ownerField(ownerRequest, "evidenceGroups")),
        loans: ownerField(ownerRequest, "loans", ownerField(ownerRequest, "evidenceDetails"))
      }),
      sourceId,
      dashboardTrigger: clone(ownerRequest.dashboardTrigger || ownerRequest.payload?.dashboardTrigger || null)
    };
  }
  function ownerBackedTemplate(template, ownerRequest) {
    if (!ownerRequest) return clone(template);
    const fixedScenarioTemplate = SOURCE_ID_ORDER.includes(template.sourceId);
    const metricUnit = ownerField(ownerRequest, "metricUnit", ownerField(ownerRequest, "unit", ""));
    const metricValue = ownerField(ownerRequest, "metricValue", ownerField(ownerRequest, "value", null));
    const ruleId = ownerField(ownerRequest, "ruleId", template.rule?.id || null);
    const ruleCatalog = RULE_CATALOG[ruleId] || {};
    return {
      ...clone(template),
      subjectId: ownerField(ownerRequest, "subjectId", template.subjectId),
      subjectName: ownerField(ownerRequest, "subjectName", template.subjectName),
      sourceType: normalizeSourceType(ownerField(ownerRequest, "sourceType", template.sourceType)),
      sourceRef: ownerField(ownerRequest, "sourceRef", template.sourceRef),
      requester: ownerField(ownerRequest, "requester", template.requester),
      priority: ownerField(ownerRequest, "priority", template.priority),
      recommendation: fixedScenarioTemplate ? template.recommendation : preferDetailedText(ownerField(ownerRequest, "recommendation"), template.recommendation),
      decisionFocus: fixedScenarioTemplate ? template.decisionFocus : preferDetailedText(ownerField(ownerRequest, "decisionFocus", ownerField(ownerRequest, "triggerReason")), template.decisionFocus, 20),
      executionBoundary: ownerField(ownerRequest, "executionBoundary", template.executionBoundary),
      dataMarkers: clone(ownerField(ownerRequest, "dataMarkers", ownerField(ownerRequest, "dataMarker") ? [ownerField(ownerRequest, "dataMarker")] : template.dataMarkers)),
      evidence: fixedScenarioTemplate ? clone(template.evidence) : {
        ...clone(template.evidence),
        dataVersion: ownerField(ownerRequest, "dataVersion", ownerField(ownerRequest, "dataAssetVersion", template.evidence.dataVersion)),
        snapshotId: ownerField(ownerRequest, "snapshotId", ownerField(ownerRequest, "metricSnapshotId", template.evidence.snapshotId)),
        cutoff: ownerField(ownerRequest, "cutoff", ownerField(ownerRequest, "asOf", template.evidence.cutoff))
      },
      metric: fixedScenarioTemplate ? clone(template.metric) : {
        ...clone(template.metric),
        id: ownerField(ownerRequest, "metricId", template.metric.id),
        name: ownerField(ownerRequest, "metricName", template.metric.name),
        value: metricValue === null ? template.metric.value : formatMetricValue(metricValue, metricUnit, ownerField(ownerRequest, "amount")),
        explanation: ownerField(ownerRequest, "metricExplanation", template.metric.explanation),
        evaluatedAt: displayTime(ownerField(ownerRequest, "evaluatedAt", ownerField(ownerRequest, "createdAt", template.metric.evaluatedAt))),
        scope: ownerField(ownerRequest, "subjectName", template.metric.scope || template.subjectName)
      },
      rule: fixedScenarioTemplate ? clone(template.rule) : ruleId ? {
        ...(template.rule ? clone(template.rule) : {}),
        id: ruleId,
        name: ownerField(ownerRequest, "ruleName", template.rule?.name || ruleCatalog.name || "预算监督规则"),
        version: ownerField(ownerRequest, "ruleVersion", template.rule?.version || RULE_VERSION),
        evaluatedAt: displayTime(ownerField(ownerRequest, "evaluatedAt", ownerField(ownerRequest, "createdAt", template.rule?.evaluatedAt || context.formedAt))),
        branch: ownerField(ownerRequest, "ruleBranch", template.rule?.branch || ruleCatalog.branch || "按已发布条件评估"),
        hitEvidence: ownerField(ownerRequest, "ruleHitEvidence", template.rule?.hitEvidence || `${template.metric.name} ${template.metric.value}`)
      } : null
    };
  }
  function projectedBusinessAssignment(template, ownerRequest, todo) {
    const suppliedOwner = todo?.businessOwner || todo?.assignee || ownerRequest?.businessOwner || ownerRequest?.assignee || ownerRequest?.responsibleOwner
      || (!["平台管理员", "财务运营账号"].includes(todo?.owner) ? todo?.owner : null)
      || (!["平台管理员", "财务运营账号"].includes(ownerRequest?.owner) ? ownerRequest?.owner : null)
      || template.owner;
    const suppliedOwnerId = todo?.businessOwnerId || todo?.assigneeId || ownerRequest?.businessOwnerId || ownerRequest?.assigneeId || ownerRequest?.responsibleOwnerId
      || (!["PLATFORM-ADMIN", "FINANCE-OPERATOR"].includes(todo?.ownerId) ? todo?.ownerId : null)
      || (!["PLATFORM-ADMIN", "FINANCE-OPERATOR"].includes(ownerRequest?.ownerId) ? ownerRequest?.ownerId : null)
      || template.ownerId;
    return businessAssignment(template.actionType.id, template.subjectName, suppliedOwner, suppliedOwnerId);
  }
  function ownerRequestMap(ownerState) {
    const sourceRows = Array.isArray(ownerState?.actionRequests) ? ownerState.actionRequests : [];
    if (!ACTION_RUNTIME_ENABLED || ownerState?.actionPolicy === "disabled-for-s002-current-scope" || ownerState?.decisionSummary?.status === "no-runtime-actions") return [];
    const bySourceId = new Map();
    sourceRows.forEach((item) => { if (item?.sourceId && !bySourceId.has(item.sourceId)) bySourceId.set(item.sourceId, item); });
    const used = new Set();
    const mapped = requests.map((template, index) => {
      let ownerRequest = bySourceId.get(template.sourceId) || null;
      if (ownerRequest) used.add(ownerRequest);
      if (!ownerRequest && sourceRows[index] && !used.has(sourceRows[index])) {
        ownerRequest = sourceRows[index];
        used.add(ownerRequest);
      }
      return { template, ownerRequest, mapping: ownerRequest?.sourceId === template.sourceId ? "sourceId" : ownerRequest ? "position" : "draft" };
    });
    sourceRows.forEach((ownerRequest, index) => {
      if (used.has(ownerRequest)) return;
      mapped.push({ template: dynamicTemplate(ownerRequest, index), ownerRequest, mapping: ownerRequest?.sourceId ? "dynamic-sourceId" : "dynamic-requestId" });
      used.add(ownerRequest);
    });
    return mapped;
  }
  function ownerDecision(template, ownerRequest, status, todo) {
    const assignment = projectedBusinessAssignment(template, ownerRequest, todo);
    const recorded = ownerRequest.decision || {};
    if (status === "confirmed") {
      return {
        type: "confirm",
        reason: recorded.reason || ownerRequest.decisionReason || "平台管理员已确认该预算 Action 草稿；仅形成平台内待办，不派发外部预算系统。",
        operator: recorded.operator || ownerRequest.confirmedBy || "平台管理员",
        time: displayTime(ownerRequest.confirmedAt || todo?.createdAt || ownerRequest.createdAt),
        scenarioContext: context,
        owner: assignment.owner,
        dueDate: dueDate(recorded.dueDate || todo?.due || ownerRequest.decisionDue || todo?.createdAt || ownerRequest.confirmedAt),
        instructions: recorded.instructions || ownerRequest.decisionInstructions || todo?.instructions || template.recommendation,
        banks: template.banks.map((item) => item.name)
      };
    }
    if (status === "rejected") {
      return {
        type: "reject",
        reason: recorded.reason || ownerRequest.decisionReason || "平台管理员已拒绝该预算 Action 草稿；未创建待办。",
        operator: recorded.operator || ownerRequest.rejectedBy || "平台管理员",
        time: displayTime(ownerRequest.rejectedAt || ownerRequest.createdAt),
        scenarioContext: context,
        owner: null,
        dueDate: null,
        instructions: recorded.instructions || ownerRequest.decisionInstructions || template.recommendation,
        banks: []
      };
    }
    return null;
  }
  function projectedTask(template, ownerRequest, todo) {
    if (!todo) return null;
    const assignment = projectedBusinessAssignment(template, ownerRequest, todo);
    const formed = displayTime(todo.createdAt || ownerRequest.confirmedAt || ownerRequest.createdAt);
    const taskId = todo.todoId || `TODO-${template.id}`;
    return {
      id: taskId,
      requestId: template.id,
      reminderId: template.reminderId,
      subjectId: template.subjectId,
      subjectName: template.subjectName,
      sourceType: template.sourceType,
      scenarioContext: context,
      owner: assignment.owner,
      ownerId: assignment.ownerId,
      title: todo.title || `${template.actionType.name} · ${template.subjectName}`,
      actionType: clone(template.actionType),
      ruleLabel: template.rule ? `${template.rule.id} ${template.rule.name} · ${template.rule.version}` : "Rule 条件引用：不适用",
      metricLabel: `${template.metric.name} ${template.metric.value}`,
      dataVersion: template.evidence.dataVersion,
      semanticVersion: template.evidence.semanticVersion,
      metricSnapshotId: template.evidence.snapshotId,
      sourceRef: template.sourceRef,
      sourceRequestTime: template.requestTime,
      cutoff: template.evidence.cutoff,
      createdAt: formed,
      dueDate: dueDate(todo.due || todo.createdAt || ownerRequest.confirmedAt),
      status: taskStatus(todo.status),
      overdue: false,
      instructions: todo.instructions || ownerRequest.decisionInstructions || template.recommendation,
      banks: template.banks.map((item) => item.name),
      decisionReason: todo.decisionReason || ownerRequest.decisionReason || "平台管理员已人工确认，仅生成平台内待办。",
      progress: [],
      history: [
        { time: displayTime(ownerRequest.confirmedAt || todo.createdAt), label: "人工确认", detail: `${ownerRequest.confirmedBy || "平台管理员"}完成确认 · 不派发外部预算系统` },
        { time: formed, label: "负责人待办创建", detail: `${assignment.owner} · ${taskId} · ${todo.status || "待处理"}` }
      ],
      sourceChanged: false,
      failure: null,
      result: null,
      correction: null,
      updateAttempts: 0,
      ownerRequestId: ownerRequest.requestId,
      idempotencyKey: ownerRequest.idempotencyKey,
      externalDispatch: false
    };
  }
  function projectOwnerState(ownerState) {
    if (!ACTION_RUNTIME_ENABLED) {
      return {
        ...clone(draftState),
        stateRevision: ownerState ? 2 : 1,
        ownerProjection: {
          status: ownerState ? "bound" : "missing",
          ownerModule: "M04",
          ownerModuleVersion: ownerState?.moduleVersion || "S002-M04-1.0.0",
          ownerStateKey: OWNER_STATE_KEY,
          sourceIdOrder: [],
          awaitingCount: 0,
          confirmedCount: 0,
          rejectedCount: 0,
          todoCount: 0,
          externalDispatchCount: 0
        }
      };
    }
    if (!ownerState) return clone(draftState);
    const todoByRequest = new Map((ownerState.todos || []).map((item) => [item.requestId, item]));
    const tasks = [];
    const projectedRequests = ownerRequestMap(ownerState).map(({ template, ownerRequest, mapping }) => {
      if (!ownerRequest) return clone(template);
      const liveTemplate = ownerBackedTemplate(template, ownerRequest);
      const status = ownerStatus(ownerRequest.status);
      const todo = todoByRequest.get(ownerRequest.requestId) || null;
      const assignment = projectedBusinessAssignment(liveTemplate, ownerRequest, todo);
      const task = status === "confirmed" ? projectedTask(liveTemplate, ownerRequest, todo) : null;
      if (task) tasks.push(task);
      const decision = ownerDecision(liveTemplate, ownerRequest, status, todo);
      const reads = [allowedRead("request_receipt", liveTemplate.evidence.dataVersion)];
      if (["confirmed", "rejected"].includes(status)) reads.push(allowedRead("confirmation_submit", liveTemplate.evidence.dataVersion));
      if (status === "confirmed") reads.push(allowedRead("task_formation", liveTemplate.evidence.dataVersion));
      return {
        ...clone(liveTemplate),
        scenarioContext: context,
        generatedTime: displayTime(ownerRequest.createdAt || template.generatedTime),
        requestTime: displayTime(ownerRequest.createdAt || template.requestTime),
        status,
        owner: assignment.owner,
        ownerId: assignment.ownerId,
        decision,
        taskId: task?.id || null,
        taskCreating: false,
        // “待我决策”表示事项在形成时满足人工判断条件；历史查看只
        // 关闭写入，不应把这批事项从待决策目录中抹掉。真正的提交门
        // 仍由 S002_M04_OWNER_BRIDGE.canReview=false 拒绝，因此只读查看
        // 不会产生新的确认、拒绝或待办。
        confirmationEligibility: {
          allowed: status === "awaiting",
          requiresAcknowledgement: status === "awaiting",
          reason: status !== "awaiting"
            ? "Owner State 已存在人工决定"
            : REVIEW_WRITABLE
              ? "固定预算证据可进入人工确认或拒绝"
              : "历史快照只读展示；事项形成时满足人工判断条件，但当前运行禁止提交决定"
        },
        decisionAttempts: decision ? 1 : 0,
        sourceId: ownerRequest.sourceId || template.sourceId,
        ownerSourceType: ownerRequest.sourceType || null,
        ownerRequestId: ownerRequest.requestId,
        ownerMapping: mapping,
        idempotencyKey: ownerRequest.idempotencyKey,
        externalStatus: "not-dispatched",
        externalDispatch: false,
        sideEffectPolicy: clone(ownerRequest.sideEffectPolicy || { allowExternalDispatch: false }),
        c017SafetyReads: reads,
        c017ReadAttempts: { request_receipt: 1, confirmation_submit: ["confirmed", "rejected"].includes(status) ? 1 : 0, task_formation: task ? 1 : 0 },
        formation: {
          ...clone(template.formation),
          confirmationGateStatus: !REVIEW_WRITABLE ? "blocked" : status === "awaiting" ? "passed" : "completed",
          confirmationGateReason: !REVIEW_WRITABLE ? "历史快照只读，禁止提交人工决定" : status === "awaiting" ? "固定预算证据可进入人工判断" : "已按同轮次 Owner State 投影人工决定"
        }
      };
    });
    const confirmedCount = projectedRequests.filter((item) => item.status === "confirmed").length;
    const rejectedCount = projectedRequests.filter((item) => item.status === "rejected").length;
    const awaitingCount = projectedRequests.filter((item) => item.status === "awaiting").length;
    const summary = {
      id: ownerState.decisionSummary?.id || "C019-S002-v1",
      status: awaitingCount ? "reviewing" : ownerState.decisionSummary?.status || (confirmedCount || rejectedCount ? "reviewing" : "drafted"),
      requestCount: projectedRequests.length,
      awaitingCount,
      confirmedCount,
      rejectedCount,
      todoCount: tasks.length,
      formedAt: ownerState.decisionSummary?.formedAt || context.formedAt
    };
    return {
      ...clone(draftState),
      stateRevision: 2,
      requests: projectedRequests,
      tasks,
      decisionSummary: summary,
      activity: projectedRequests.filter((item) => item.decision).map((item) => ({ time: item.decision.time, label: item.decision.type === "confirm" ? "人工确认并形成平台内待办" : "人工拒绝行动建议", detail: `${item.subjectName} · ${item.actionType.name}`, scenarioContext: context, requestId: item.id, ownerRequestId: item.ownerRequestId, taskId: item.taskId || null })),
      ownerProjection: {
        status: "bound",
        ownerModule: "M04",
        ownerModuleVersion: ownerState.moduleVersion || "S002-M04-1.0.0",
        ownerStateKey: OWNER_STATE_KEY,
        sourceIdOrder: projectedRequests.map((item) => item.sourceId),
        awaitingCount,
        confirmedCount,
        rejectedCount,
        todoCount: tasks.length,
        externalDispatchCount: 0
      }
    };
  }
  function c019TargetRef(type, id) {
    if (!id) return null;
    const route = type === "trace" ? "trace/request" : type;
    const search = new URLSearchParams({ scenarioId: context.scenarioId, scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, scenarioStatus: context.status || "active" });
    const entryPath = new URL("../index.html", window.location.href).pathname;
    return { targetType: type, targetId: id, stableDetailEntry: `${entryPath}?${search}#${route}/${encodeURIComponent(type === "trace" ? id.replace(/^TR-/, "AR-") : id)}` };
  }
  function buildC019Projection(projectedState, baselineProjection) {
    const byId = new Map(projectedState.requests.map((item) => [item.id, item]));
    const records = Array.isArray(baselineProjection?.records) ? baselineProjection.records.map((record) => {
      const requestId = record?.requestRef?.targetId;
      const request = byId.get(requestId);
      if (!request) return record;
      const task = projectedState.tasks.find((item) => item.requestId === request.id) || null;
      return {
        ...record,
        scenarioContext: context,
        requestStatus: request.status,
        reminderStatus: request.reminderId ? (request.decision ? "已处理" : "待决策") : null,
        decisionStatus: request.decision?.type || null,
        taskStatus: task?.status || null,
        businessSubject: { id: request.subjectId, name: request.subjectName },
        semanticVersionId: "SEM-S002-BUDGET-v1",
        semanticVersion: request.evidence.semanticVersion,
        dataAssetVersionId: request.evidence.dataVersion,
        dataVersion: request.evidence.dataVersion,
        asOf: "2025-12-31",
        requestRef: c019TargetRef("request", request.id),
        reminderRef: c019TargetRef("reminder", request.reminderId),
        taskRef: c019TargetRef("task", request.taskId),
        traceRef: c019TargetRef("trace", request.id),
        ownerRequestId: request.ownerRequestId || null,
        ownerTodoId: request.taskId || null,
        externalStatus: "not-dispatched",
        externalDispatch: false
      };
    }) : projectedState.requests.map((request) => ({
      scenarioContext: context,
      requestStatus: request.status,
      reminderStatus: request.reminderId ? (request.decision ? "已处理" : "待决策") : null,
      decisionStatus: request.decision?.type || null,
      taskStatus: projectedState.tasks.find((item) => item.requestId === request.id)?.status || null,
      businessSubject: { id: request.subjectId, name: request.subjectName },
      semanticVersionId: "SEM-S002-BUDGET-v1",
      semanticVersion: request.evidence.semanticVersion,
      dataAssetVersionId: request.evidence.dataVersion,
      dataVersion: request.evidence.dataVersion,
      asOf: "2025-12-31",
      requestRef: c019TargetRef("request", request.id),
      reminderRef: c019TargetRef("reminder", request.reminderId),
      taskRef: c019TargetRef("task", request.taskId),
      traceRef: c019TargetRef("trace", request.id),
      ownerRequestId: request.ownerRequestId || null,
      ownerTodoId: request.taskId || null,
      externalStatus: "not-dispatched",
      externalDispatch: false,
      navigationContext: { sourceScene: "预算监督管理", businessSubject: request.subjectName, filter: null, returnRoute: null, returnPosition: null }
    }));
    const recordedRequestIds = new Set(records.map((record) => record?.requestRef?.targetId).filter(Boolean));
    projectedState.requests.forEach((request) => {
      if (recordedRequestIds.has(request.id)) return;
      records.push({
        scenarioContext: context,
        requestStatus: request.status,
        reminderStatus: request.reminderId ? (request.decision ? "已处理" : "待决策") : null,
        decisionStatus: request.decision?.type || null,
        taskStatus: projectedState.tasks.find((item) => item.requestId === request.id)?.status || null,
        businessSubject: { id: request.subjectId, name: request.subjectName },
        semanticVersionId: "SEM-S002-BUDGET-v1",
        semanticVersion: request.evidence.semanticVersion,
        dataAssetVersionId: request.evidence.dataVersion,
        dataVersion: request.evidence.dataVersion,
        asOf: "2025-12-31",
        requestRef: c019TargetRef("request", request.id),
        reminderRef: c019TargetRef("reminder", request.reminderId),
        taskRef: c019TargetRef("task", request.taskId),
        traceRef: c019TargetRef("trace", request.id),
        ownerRequestId: request.ownerRequestId || null,
        ownerTodoId: request.taskId || null,
        externalStatus: "not-dispatched",
        externalDispatch: false,
        navigationContext: { sourceScene: "预算监督管理", businessSubject: request.subjectName, filter: null, returnRoute: null, returnPosition: null }
      });
    });
    return {
      ...(baselineProjection || {}),
      contractCode: "C019",
      schemaVersion: 1,
      owner: "决策中心",
      consumer: "报告中心",
      scenarioContext: context,
      summaryAsOf: displayTime(projectedState.decisionSummary?.formedAt || context.formedAt),
      status: "可读取",
      decisionSummary: clone(projectedState.decisionSummary),
      externalDispatchCount: 0,
      records
    };
  }
  const ownerState = readOwnerM04State();
  const state = projectOwnerState(ownerState);
  function syncC017Projection() {
    const live = readJson(C017_KEY);
    const valid = live?.contractCode === "C017" && live?.consumer === "决策中心" && sameRun(live);
    if (!valid) {
      try { localStorage.setItem(C017_KEY, JSON.stringify(c017)); } catch (_) {}
    }
  }
  function syncC019Projection() {
    try {
      const live = readJson(C019_KEY);
      localStorage.setItem(C019_KEY, JSON.stringify(buildC019Projection(state, sameRun(live) ? live : null)));
    } catch (_) {}
  }
  try {
    const current = readJson(PLATFORM_CONTEXT_KEY);
    if (!sameRun(current)) localStorage.setItem(PLATFORM_CONTEXT_KEY, JSON.stringify(context));
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    syncC017Projection();
    syncC019Projection();
  } catch (_) {}

  const TEXT_REPLACEMENTS = [
    ["调整筛选，或等待新的决策事项形成。", "当前 S002 范围不生成行动申请、决策事项或平台内待办。"],
    ["调整筛选条件后重新查看。", "当前 S002 范围保持决策中心零事项空态。"],
    ["当前无法同时核对优先银行与贷款明细", "当前需要补充业务主体与指标明细"],
    ["补齐银行与贷款证据后再评估预期影响", "补齐主体、指标和业务明细后再评估预期影响"],
    ["主体、指标、银行归因和贷款明细均可核对", "主体、指标、业务归因和明细均可核对"],
    ["主要协商银行", "主要核对对象"], ["本次协商银行", "本次核对对象"], ["优先协商银行", "重点核对对象"], ["优先银行", "重点核对对象"], ["协商银行", "核对对象"],
    ["尚缺可核对的银行证据", "尚缺可核对的业务证据"], ["建议银行证据缺失", "业务证据缺失"], ["当前银行证据不可用", "当前业务证据不可用"], ["银行证据尚不可核对", "业务证据尚不可核对"], ["当前缺少可核对的银行证据", "当前缺少可核对的业务证据"], ["银行归因", "业务对象归因"],
    ["金融机构归属说明", "业务对象归属说明"], ["金融机构映射", "业务对象映射"], ["金融机构标识", "业务对象标识"], ["金融机构", "业务对象"], ["银行", "核对对象"],
    ["贷款明细", "业务明细"], ["贷款类型", "证据类型"], ["贷款余额", "影响金额"], ["涉及哪些贷款", "涉及哪些业务明细"], ["贷款", "业务记录"], ["关联借据", "关联业务记录"], ["借据编号", "业务记录编号"], ["借据", "业务记录"],
    ["亿元", "万元"], ["利率 / 定价", "指标 / 口径"], ["融资", "预算"], ["债务", "预算占用"], ["财务分析员", "平台管理员"], ["融资负责人", "预算业务负责人"], ["集团资金管理岗", "预算管理负责人"],
    ["优先协商：", "重点核对："], ["优先覆盖", "重点核对"], ["协商范围", "核对范围"], ["优先机构", "重点核对对象"], ["问题余额", "影响金额"], ["贡献占比", "影响占比"],
    ["先和谁协商", "先核对哪些业务对象"], ["本次协商供应商", "本次核对对象"], ["协商供应商", "核对对象"], ["建议按证据贡献从高到低协商", "建议按业务影响从高到低核对"], ["实际银行、范围和结果", "实际核对对象、范围和结果"], ["协商回填", "核对结果回填"], ["协商影响", "核对影响"]
  ];
  function localizeVisibleText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      let text = node.nodeValue || "";
      TEXT_REPLACEMENTS.forEach(([from, to]) => { text = text.replaceAll(from, to); });
      if (text !== node.nodeValue) node.nodeValue = text;
    });
    root.querySelectorAll?.("[title], [aria-label], [placeholder], input, textarea").forEach((element) => {
      ["title", "aria-label", "placeholder"].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          let text = element.getAttribute(attribute) || "";
          TEXT_REPLACEMENTS.forEach(([from, to]) => { text = text.replaceAll(from, to); });
          element.setAttribute(attribute, text);
        }
      });
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        let value = element.value || "";
        TEXT_REPLACEMENTS.forEach(([from, to]) => { value = value.replaceAll(from, to); });
        if (value !== element.value) element.value = value;
      }
    });
    if (!REVIEW_WRITABLE) {
      root.querySelectorAll?.("button").forEach((button) => {
        const label = String(button.textContent || "").replace(/\s+/g, "").trim();
        if (!["确认并交办", "拒绝", "请求补充信息"].includes(label)) return;
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.setAttribute("title", "历史快照只读，禁止提交人工决定");
      });
    }
  }
  window.S002_M04_TEXT_REPLACEMENTS = TEXT_REPLACEMENTS;
  const localize = () => localizeVisibleText(document.body);
  function startLocalizationObserver() {
    const target = document.body;
    if (!target || target.nodeType !== 1 || typeof MutationObserver !== "function" || typeof Node !== "function" || !(target instanceof Node)) return;
    try {
      const observer = new MutationObserver(localize);
      observer.observe(target, { childList: true, subtree: true });
      window.S002_M04_LOCALIZATION_OBSERVER = observer;
    } catch (_) {}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { localize(); startLocalizationObserver(); }, { once: true });
  } else {
    localize();
    startLocalizationObserver();
  }

  const bridgeCanReview = REVIEW_WRITABLE && window.parent !== window && typeof window.parent?.postMessage === "function";
  const ownerBridge = Object.freeze({
    canReview: bridgeCanReview,
    readOnlyReason: !REVIEW_WRITABLE ? "历史快照只读，禁止提交人工决定。" : bridgeCanReview ? null : "请从S002统一工作台进入决策中心。",
    submitDecision: submitOwnerDecision
  });
  window.S002_M04_OWNER_BRIDGE = ownerBridge;
  window.S002_M04_ADAPTER = Object.freeze({ context, requests, actionTypes: Object.values(ACTIONS), stateKey: STATE_KEY, ownerStateKey: OWNER_STATE_KEY, c017Key: C017_KEY, c019Key: C019_KEY, ownerStatePresent: Boolean(ownerState), reviewWritable: REVIEW_WRITABLE, ownerBridge, projectedState: clone(state) });
  // Reconcile only on lifecycle or cross-tab events. The baseline page reads
  // the fixed C017 projection on demand; a polling loop would mask drift and
  // leave debug-only DOM attributes in the production-shaped adapter.
  window.addEventListener("pageshow", syncC017Projection);
  window.addEventListener("focus", syncC017Projection);
  window.addEventListener("ontology3:decision-center:c019-updated", syncC019Projection);
  window.addEventListener("storage", (event) => { if (event.key === C017_KEY) syncC017Projection(); if (event.key === C019_KEY) syncC019Projection(); });
})();
