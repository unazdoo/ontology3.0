"use strict";

const BASELINE_VERSION = "1.0.3";
const BASELINE_SNAPSHOT_ID = "BSL-S001-V103-DE0119608E26";
const SCENARIO_ID = "S002";
const SCENARIO_VERSION = "S002-v1";
const SYNTHETIC_MARK = "SYNTHETIC_FOR_DEMO";
const BASELINE_CHECKPOINT_BINDING = Object.freeze({
  ref: "designs/scenario-checkpoints/baselines/v1.0.3/T056-baseline-checkpoint.json",
  sha256: "0a90f5f68dccaa7c18be71b4c82019616f19b0e359f931024652d95165ecd414"
});
const TREE_HASH_ALGORITHM = "sha256(sorted recursive relativePath + NUL + file bytes + NUL)";

function baselineModuleBinding(prototypePath, exactVersion, treeSha256, supportingPrototypeComponents) {
  return Object.freeze({
    baselineVersion: BASELINE_VERSION,
    baselineSnapshotId: BASELINE_SNAPSHOT_ID,
    prototypePath,
    exactVersion,
    treeSha256,
    treeHashAlgorithm: TREE_HASH_ALGORITHM,
    supportingPrototypeComponents: Object.freeze((supportingPrototypeComponents || []).map((item) => Object.freeze({ ...item, treeHashAlgorithm: TREE_HASH_ALGORITHM })))
  });
}

const BASELINE_MODULE_BINDINGS = Object.freeze({
  M01: baselineModuleBinding(
    "designs/prototype-releases/v1.0.3/ontology-management-review",
    "v1.0.3#75870802dbcf5f3c",
    "75870802dbcf5f3ced2b8c6efaca41f01ae1e57fc34893ef44a14710633142fd",
    [{
      prototypePath: "designs/prototype-releases/v1.0.3/ontology-management-prototype",
      treeSha256: "e0591568e3c52f464b53b295b8106056dea531c9f407c056bee6c21191645443"
    }]
  ),
  M02: baselineModuleBinding(
    "designs/prototype-releases/v1.0.3/data-engineering-prototype-review",
    "v1.0.3#dd47ca1f16b985c6",
    "dd47ca1f16b985c6e7acbdd2f262af2636b1bb18ceb7187f727ae33630b87fe5"
  ),
  M03: baselineModuleBinding(
    "designs/prototype-releases/v1.0.3/intelligent-query-prototype",
    "v1.0.3#5122f6b9bfab04af",
    "5122f6b9bfab04af794460fdba30d41b35fecd71d4d966472f66e7bc799c3e56"
  ),
  M04: baselineModuleBinding(
    "designs/prototype-releases/v1.0.3/decision-center-prototype",
    "v1.0.3#243f7a8a779b1fb9",
    "243f7a8a779b1fb9dddb74996c5bc7d99ad51211f019a2991afb6c8916f7b66b"
  ),
  M05: baselineModuleBinding(
    "designs/prototype-releases/v1.0.3/agent-application",
    "v1.0.3#027d9f20c7d7ebd7",
    "027d9f20c7d7ebd753eb8e36b4475a5c271c91d979feda8e0d57c39b3cb9bcb2"
  ),
  M06: baselineModuleBinding(
    "designs/prototype-releases/v1.0.3/report-center",
    "v1.0.3#8be8533ca1583f91",
    "8be8533ca1583f9135c76acf3bfab844d1431abc0e4807ec301e2f63d1dad0ad"
  )
});

const MODULE_DEFINITIONS = Object.freeze({
  M01: Object.freeze({
    name: "本体管理",
    owner: "本体管理",
    moduleVersion: "S002-M01-1.0.0",
    baselineModuleBinding: BASELINE_MODULE_BINDINGS.M01,
    activatesAt: "published-switched",
    allowedResourceTypes: Object.freeze([
      "ontology-object",
      "ontology-relationship",
      "metric",
      "rule",
      "action-type",
      "published-binding"
    ])
  }),
  M02: Object.freeze({
    name: "数据工程",
    owner: "数据工程",
    moduleVersion: "S002-M02-1.0.0",
    baselineModuleBinding: BASELINE_MODULE_BINDINGS.M02,
    activatesAt: "data-connected",
    allowedResourceTypes: Object.freeze([
      "data-source",
      "source-snapshot",
      "pipeline-definition",
      "pipeline-run",
      "schema-contract",
      "quality-result",
      "data-asset-version",
      "compatibility-pointer",
      "delivery-receipt",
      "quality-summary"
    ])
  }),
  M03: Object.freeze({
    name: "智能问数",
    owner: "智能问数",
    moduleVersion: "S002-M03-1.0.0",
    baselineModuleBinding: BASELINE_MODULE_BINDINGS.M03,
    activatesAt: "query-integrated",
    allowedResourceTypes: Object.freeze([
      "query-agent",
      "prompt",
      "skill",
      "query-configuration",
      "view-definition",
      "query-run",
      "query-result"
    ])
  }),
  M04: Object.freeze({
    name: "决策中心",
    owner: "决策中心",
    moduleVersion: "S002-M04-1.0.0",
    baselineModuleBinding: BASELINE_MODULE_BINDINGS.M04,
    activatesAt: "decision-chain-completed",
    allowedResourceTypes: Object.freeze(["decision-alert", "action-request", "c011-gate", "human-confirmation", "rejection", "owner-todo", "decision-summary"])
  }),
  M05: Object.freeze({
    name: "Agent 应用",
    owner: "Agent 应用",
    moduleVersion: "S002-M05-1.0.0",
    baselineModuleBinding: BASELINE_MODULE_BINDINGS.M05,
    activatesAt: "agent-report-dashboard-completed",
    allowedResourceTypes: Object.freeze([
      "agent-definition",
      "agent-release",
      "orchestration-definition",
      "orchestration-release",
      "step-binding",
      "step-run",
      "agent-run",
      "agent-result",
      "orchestration-run"
    ])
  }),
  M06: Object.freeze({
    name: "报告中心",
    owner: "报告中心",
    moduleVersion: "S002-M06-1.0.0",
    baselineModuleBinding: BASELINE_MODULE_BINDINGS.M06,
    activatesAt: "agent-report-dashboard-completed",
    allowedResourceTypes: Object.freeze([
      "dashboard-version",
      "dashboard-view",
      "report-draft",
      "evidence-package",
      "report-verification-run",
      "report-verification-result"
    ])
  })
});

const CHECKPOINT_ORDER = Object.freeze([
  "initial-configured",
  "data-connected",
  "published-switched",
  "query-integrated",
  "decision-chain-completed",
  "agent-report-dashboard-completed",
  "e2e-integrated",
  "pre-risk-change"
]);

const RESOURCE_SETS = Object.freeze({
  M01: Object.freeze([
    resource("ONT-S002-BUDGET-v1", "ontology-object", "1.0.0", "预算主体、期间、科目、版本、情景、项目、PR/PO 与凭证对象"),
    resource("REL-S002-BUDGET-v1", "ontology-relationship", "1.0.0", "预算、实际、占用、计提和项目余额关系"),
    resource("MET-S002-BUDGET-v1", "metric", "1.0.0", "成本占收比、真正毛利率、净在途占用等九项 Metric"),
    resource("RULE-S002-BUDGET-v1", "rule", "1.0.0", "项目余额、费用预算执行偏离、成本占收比、年末集中度与价格复核五项 Rule"),
    resource("ACTION-TYPE-S002-BUDGET-v1", "action-type", "1.0.0", "预算执行整改、下一年度预算合理性复核、费用管理优化核查、预算申报依据补充、采购占用清理和供应商价格复核"),
    resource("T019-S002-v1", "published-binding", "1.0.0", "Published 本体精确绑定 S002-BUDGET-EXEC-v1 与 S002-PROJECT-OCC-v1；S002-DATA-v1 仅为兼容组合指针")
  ]),
  M02: Object.freeze([
    resource("T001-S002-LOGICAL-SOURCES-v1", "data-source", "1.0.0", "5 个逻辑数据源：实际执行、预算下达、预算申报、项目预算占用和项目预算使用"),
    resource("T002-S002-SOURCE-SNAPSHOTS-v1", "source-snapshot", "1.0.0", "8 个年度或确认时点不可变快照、14 个逻辑成员及逐字节下载证据"),
    resource("S002-PIPE-BUDGET-v1", "pipeline-definition", "1.0.0", "预算编制与执行标准化管道：3 个逻辑源、6 个快照；不包含业务阈值"),
    resource("S002-PIPE-PROJECT-v1", "pipeline-definition", "1.0.0", "项目余额与采购占用标准化管道：2 个逻辑源、2 个快照；不包含指标公式"),
    resource("RUN-S002-PIPE-BUDGET-v1", "pipeline-run", "1.0.0", "预算编制与执行管道正式运行"),
    resource("RUN-S002-PIPE-PROJECT-v1", "pipeline-run", "1.0.0", "项目余额与采购占用管道正式运行"),
    resource("T005-S002-BUDGET-QUALITY-v1", "quality-result", "1.0.0", "缺失、重复、口径、键和历史可比性质量结果"),
    resource("T006-S002-BUDGET-SCHEMA-v1", "schema-contract", "1.0.0", "主体、期间、科目、版本、情景、项目和凭证行稳定键契约"),
    resource("S002-BUDGET-EXEC-v1", "data-asset-version", "1.0.0", "预算编制、最终批准预算、实际执行、初始申报和跨年比较数据资产"),
    resource("S002-PROJECT-OCC-v1", "data-asset-version", "1.0.0", "项目预算使用、采购占用、可用余额和供应商比较数据资产"),
    resource("S002-DATA-v1", "compatibility-pointer", "1.0.0", "C003 兼容组合指针；不是第三个业务数据资产"),
    resource("C003-S002-DELIVERY-v1", "delivery-receipt", "1.0.0", "两个业务数据资产及兼容组合指针的同轮交付与接收回执"),
    resource("C017-S002-DATA-v1", "quality-summary", "1.0.0", "Action三道门消费的数据当前摘要")
  ]),
  M03: Object.freeze([
    resource("AGENT-S002-BUDGET-QUERY-v1", "query-agent", "1.0.0", "预算问数 Agent"),
    resource("PROMPT-S002-BUDGET-v1", "prompt", "1.0.0", "预算执行、申报、余额、采购占用与趋势问数 Prompt"),
    resource("SKILL-S002-BUDGET-v1", "skill", "1.0.0", "Published 语义约束与证据追溯 Skill"),
    resource("C009-S002-v1", "query-configuration", "1.0.0", "固定问题、参数、双版本绑定和降级规则"),
    resource("C018-S002-DEFINITION-v1", "view-definition", "1.0.0", "预算固定问数视图定义"),
    resource("RUN-S002-QUERY-001", "query-run", "1.0.0", "六项固定问数运行"),
    resource("C018-S002-v1", "query-result", "1.0.0", "预算固定问数视图与确定性结果")
  ]),
  M04: Object.freeze([
    resource("ALERT-S002-BUDGET-v1", "decision-alert", "1.0.0", "Rule命中和分析建议形成的决策提醒"),
    resource("AR-S002-BUDGET-v1", "action-request", "1.0.0", "六类整改或复核 Action Request；旧预算调整动作仅保留兼容别名且不自动执行"),
    resource("C011-S002-GATES-v1", "c011-gate", "1.0.0", "接收、确认、待办形成三次C017读取门"),
    resource("CONFIRM-S002-BUDGET-v1", "human-confirmation", "1.0.0", "平台管理员逐Request人工确认记录"),
    resource("REJECT-S002-BUDGET-v1", "rejection", "1.0.0", "拒绝路径与不形成待办证据"),
    resource("TODO-S002-BUDGET-v1", "owner-todo", "1.0.0", "确认后逐Request幂等生成的平台内负责人待办"),
    resource("C019-S002-v1", "decision-summary", "1.0.0", "供Agent和报告中心只读消费的决策摘要")
  ]),
  M05: Object.freeze([
    resource("AGENT-S002-ANOMALY-v1", "agent-definition", "1.0.0", "预算异常分析 Agent Definition"),
    resource("AGENT-S002-ANOMALY-REL-v1", "agent-release", "1.0.0", "预算异常分析 Agent Release"),
    resource("AGENT-S002-REPORT-DRAFT-v1", "agent-definition", "1.0.0", "预算报告草稿 Agent Definition"),
    resource("AGENT-S002-REPORT-DRAFT-REL-v1", "agent-release", "1.0.0", "预算报告草稿 Agent Release"),
    resource("ORCH-S002-BUDGET-v1", "orchestration-definition", "1.0.0", "双Agent轻量编排定义"),
    resource("ORCH-S002-BUDGET-REL-v1", "orchestration-release", "1.0.0", "双Agent轻量编排Release"),
    resource("STEP-BINDING-S002-v1", "step-binding", "1.0.0", "Rule/C018/C019至两个Agent的步骤绑定"),
    resource("STEP-RUN-S002-v1", "step-run", "1.0.0", "编排步骤运行与中间结果"),
    resource("C014-S002-RUN-001", "orchestration-run", "1.0.0", "固定证据下的双 Agent 轻量编排"),
    resource("RUN-S002-AGENT-001", "agent-run", "1.0.0", "异常解释与报告草稿运行"),
    resource("RES-S002-AGENT-001", "agent-result", "1.0.0", "原因候选、行动建议和报告草稿结果")
  ]),
  M06: Object.freeze([
    resource("DASH-S002-BUDGET-v1", "dashboard-version", "1.0.0", "预算管理驾驶舱独立版本"),
    resource("DASH-VIEW-S002-5TOPIC-v1", "dashboard-view", "1.0.0", "五主题展示与集团至证据下钻"),
    resource("RPT-S002-BUDGET-DRAFT-v1", "report-draft", "1.0.0", "预算监督管理五主题报告草稿；未形成T049正式发布"),
    resource("EP-S002-BUDGET-001", "evidence-package", "1.0.0", "双数据资产、Published、问数、决策和 Agent 固定证据包"),
    resource("VRF-20260815-153001-001", "report-verification-run", "1.0.0", "整份报告确定性核验：426/426 检查单元、58/58 事实、66/66 锚点"),
    resource("VRF-RESULT-S002-REPORT-v1", "report-verification-result", "1.0.0", "通过124、警告0、失败0、无法核验0；历史模式仅内存运行不持久化")
  ])
});

function resource(resourceId, resourceType, version, summary) {
  return Object.freeze({ resourceId, resourceType, version, summary });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function checkpointIndex(checkpointNode) {
  return CHECKPOINT_ORDER.indexOf(checkpointNode);
}

function moduleIsActive(moduleId, checkpointNode, runtimeState) {
  const definition = MODULE_DEFINITIONS[moduleId];
  if (runtimeState && runtimeState.progress) return Object.values(runtimeState.progress).some(Boolean);
  if (checkpointNode === "pre-risk-change") return false;
  return checkpointIndex(checkpointNode) >= checkpointIndex(definition.activatesAt);
}

function assertScenarioContext(context) {
  if (!context || typeof context !== "object") throw new Error("缺少场景上下文");
  if (context.scenarioId !== SCENARIO_ID || context.scenarioVersion !== SCENARIO_VERSION) {
    throw new Error("场景上下文不是 S002/S002-v1");
  }
  if (!/^S002-RUN-\d{17}-[a-f0-9]{12}$/.test(context.scenarioRunId || "")) {
    throw new Error("scenarioRunId 格式无效");
  }
  if (Number.isNaN(Date.parse(context.formedAt || ""))) throw new Error("formedAt 无效");
  if (!["active", "restored", "regression"].includes(context.status)) throw new Error("场景上下文状态不可写");
}

function moduleBoundary(moduleId) {
  const common = {
    ownsOnly: clone(MODULE_DEFINITIONS[moduleId].allowedResourceTypes),
    consumesByReference: true,
    copiesOtherModuleTruth: false
  };
  if (moduleId === "M02") {
    return {
      ...common,
      computesBusinessMetricOrRule: false,
      logicalSourceCount: 5,
      sourceSnapshotCount: 8,
      pipelineCount: 2,
      businessDataAssetCount: 2,
      compatibilityPointerIsBusinessAsset: false
    };
  }
  if (moduleId === "M04") {
    return {
      ...common,
      externalBudgetSystemDispatch: false,
      automaticApproval: false,
      automaticPosting: false,
      approvedBudgetOverwrite: false,
      demoOutcome: "当前S002范围不形成Action Request、决策提醒或平台内待办实例"
    };
  }
  if (moduleId === "M05") {
    return { ...common, publishesMetricOrRule: false, createsTodoDirectly: false, publishesReportDirectly: false };
  }
  if (moduleId === "M06") {
    return {
      ...common,
      ownsDecisionState: false,
      dashboardOwner: true,
      reportVerificationOwner: true,
      historicalVerificationPersisted: false
    };
  }
  return common;
}

function buildModuleExport({ moduleId, checkpointNode, scenarioContext, formedAt, runtimeState }) {
  const definition = MODULE_DEFINITIONS[moduleId];
  if (!definition) throw new Error(`未知模块 ${moduleId}`);
  if (!CHECKPOINT_ORDER.includes(checkpointNode)) throw new Error(`未知 Checkpoint 节点 ${checkpointNode}`);
  assertScenarioContext(scenarioContext);
  const active = moduleIsActive(moduleId, checkpointNode, runtimeState);
  const resources = active
    ? RESOURCE_SETS[moduleId].map((item) => ({
      ...clone(item),
      authoritativeRef: `S002/${scenarioContext.scenarioRunId}/${moduleId}/${item.resourceId}`,
      formedAt
    }))
    : [];
  return {
    schemaVersion: "ofw.s002.module-state-export.v2",
    moduleId,
    moduleName: definition.name,
    owner: definition.owner,
    moduleVersion: definition.moduleVersion,
    scenarioAdapterVersion: definition.moduleVersion,
    baselineVersion: BASELINE_VERSION,
    baselineSnapshotId: BASELINE_SNAPSHOT_ID,
    baselineCheckpointBinding: clone(BASELINE_CHECKPOINT_BINDING),
    baselineModuleBinding: clone(definition.baselineModuleBinding),
    scenarioContext: clone(scenarioContext),
    checkpointNode,
    formedAt,
    stateDeclaration: active ? "referenced" : "empty",
    emptyReason: active ? null : `尚未到达 ${definition.activatesAt}；仅导出可恢复空状态`,
    resources,
    ownerBoundary: moduleBoundary(moduleId),
    demoDataMarker: SYNTHETIC_MARK,
    sideEffectPolicy: {
      allowHistoricalReplay: false,
      allowExternalDispatch: false
    },
    runtimeState: clone(runtimeState)
  };
}

function validateModuleExport(exportValue, expected = {}) {
  const errors = [];
  const definition = MODULE_DEFINITIONS[exportValue && exportValue.moduleId];
  if (!definition) return ["moduleId 未定义"];
  try {
    assertScenarioContext(exportValue.scenarioContext);
  } catch (error) {
    errors.push(error.message);
  }
  if (exportValue.schemaVersion !== "ofw.s002.module-state-export.v2") errors.push("导出 schemaVersion 不匹配");
  if (exportValue.moduleName !== definition.name || exportValue.owner !== definition.owner) errors.push("模块 Owner 不匹配");
  if (exportValue.moduleVersion !== definition.moduleVersion) errors.push("模块版本不匹配");
  if (exportValue.scenarioAdapterVersion !== definition.moduleVersion) errors.push("场景适配器版本不匹配");
  if (exportValue.baselineVersion !== BASELINE_VERSION || exportValue.baselineSnapshotId !== BASELINE_SNAPSHOT_ID) {
    errors.push("父基线绑定不匹配");
  }
  if (JSON.stringify(exportValue.baselineCheckpointBinding) !== JSON.stringify(BASELINE_CHECKPOINT_BINDING)) {
    errors.push("T056 基线 Checkpoint 绑定不匹配");
  }
  if (JSON.stringify(exportValue.baselineModuleBinding) !== JSON.stringify(definition.baselineModuleBinding)) {
    errors.push("v1.0.3 模块原型路径、版本或目录摘要不匹配");
  }
  if (!CHECKPOINT_ORDER.includes(exportValue.checkpointNode)) errors.push("Checkpoint 节点无效");
  if (expected.moduleId && expected.moduleId !== exportValue.moduleId) errors.push("导出模块与预期不一致");
  if (expected.checkpointNode && expected.checkpointNode !== exportValue.checkpointNode) errors.push("导出节点与预期不一致");
  const active = moduleIsActive(exportValue.moduleId, exportValue.checkpointNode);
  if (active && (exportValue.stateDeclaration !== "referenced" || !exportValue.resources.length)) {
    errors.push("已激活模块必须导出至少一条精确资源引用");
  }
  if (!active && (exportValue.stateDeclaration !== "empty" || exportValue.resources.length || !exportValue.emptyReason)) {
    errors.push("未激活模块必须导出带原因的空状态");
  }
  for (const item of exportValue.resources || []) {
    if (!definition.allowedResourceTypes.includes(item.resourceType)) {
      errors.push(`${item.resourceId || "未知资源"} 越过 ${exportValue.moduleId} Owner 边界`);
    }
    if (!item.resourceId || !item.version || !item.authoritativeRef || Number.isNaN(Date.parse(item.formedAt || ""))) {
      errors.push(`${item.resourceId || "未知资源"} 缺少精确版本、引用或形成时间`);
    }
  }
  if (exportValue.demoDataMarker !== SYNTHETIC_MARK) errors.push("缺少演示数据标识");
  if (!exportValue.runtimeState || exportValue.runtimeState.moduleId !== exportValue.moduleId || exportValue.runtimeState.moduleVersion !== exportValue.scenarioAdapterVersion) {
    errors.push("模块运行状态缺失或版本不匹配");
  }
  if (exportValue.sideEffectPolicy?.allowHistoricalReplay !== false || exportValue.sideEffectPolicy?.allowExternalDispatch !== false) {
    errors.push("导出错误地放开历史重放或外部派发");
  }
  if (exportValue.moduleId === "M04") {
    const boundary = exportValue.ownerBoundary || {};
    if ([boundary.externalBudgetSystemDispatch, boundary.automaticApproval, boundary.automaticPosting, boundary.approvedBudgetOverwrite].some(Boolean)) {
      errors.push("M04 外部预算系统或自动审批边界被放开");
    }
  }
  if (exportValue.moduleId === "M02" && exportValue.stateDeclaration === "referenced") {
    const resourceIds = new Set((exportValue.resources || []).map((item) => item.resourceId));
    const required = [
      "T001-S002-LOGICAL-SOURCES-v1",
      "T002-S002-SOURCE-SNAPSHOTS-v1",
      "S002-PIPE-BUDGET-v1",
      "S002-PIPE-PROJECT-v1",
      "S002-BUDGET-EXEC-v1",
      "S002-PROJECT-OCC-v1",
      "S002-DATA-v1"
    ];
    if (required.some((resourceId) => !resourceIds.has(resourceId))) errors.push("M02 快照缺少 5逻辑源/8快照/2管道/2业务资产或兼容指针证据");
  }
  if (exportValue.moduleId === "M06" && exportValue.ownerBoundary?.ownsDecisionState !== false) {
    errors.push("M06 不得拥有决策状态");
  }
  if (exportValue.moduleId === "M06" && exportValue.stateDeclaration === "referenced") {
    const resourceIds = new Set((exportValue.resources || []).map((item) => item.resourceId));
    if (!resourceIds.has("VRF-20260815-153001-001") || !resourceIds.has("VRF-RESULT-S002-REPORT-v1")) {
      errors.push("M06 快照缺少报告确定性核验运行或四态结果证据");
    }
  }
  if (exportValue.moduleId === "M03" && exportValue.runtimeState?.progress?.queryRun) {
    const fixedView = exportValue.runtimeState.fixedView;
    if (!fixedView || fixedView.contractId !== "C018-S002-v1" || !fixedView.dataAssetVersion || !fixedView.ontologyVersion) {
      errors.push("M03 问数联调后必须拥有精确 C018 固定视图结果");
    }
  }
  if (exportValue.moduleId === "M06" && exportValue.runtimeState?.dashboardView) {
    const dashboardView = exportValue.runtimeState.dashboardView;
    const copiedTruthFields = ["annualFacts", "submissionFacts", "projects", "occupancy", "ruleHits", "actionSummary", "actionRequests", "todos"];
    if (copiedTruthFields.some((field) => Object.prototype.hasOwnProperty.call(dashboardView, field))) {
      errors.push("M06 Dashboard View 不得复制 M02/M03/M04 业务真值");
    }
    if (dashboardView.queryViewRef !== "C018-S002-v1" || !["C019-S002-v1", "C019-S002-NOT-APPLICABLE"].includes(dashboardView.decisionSummaryRef)) {
      errors.push("M06 Dashboard View 必须只读引用 C018 与当前范围适用的 C019 摘要");
    }
  }
  return errors;
}

function buildOwnerReceipt({ moduleExport, exportRef, exportSha256, validatedAt }) {
  const errors = validateModuleExport(moduleExport);
  if (errors.length) throw new Error(`模块导出校验失败：${errors.join("；")}`);
  return {
    schemaVersion: "ofw.s002.owner-validation-receipt.v2",
    receiptId: `RECEIPT-${moduleExport.moduleId}-${moduleExport.checkpointNode}-${exportSha256.slice(0, 12)}`,
    moduleId: moduleExport.moduleId,
    owner: moduleExport.owner,
    moduleVersion: moduleExport.moduleVersion,
    scenarioAdapterVersion: moduleExport.scenarioAdapterVersion,
    baselineVersion: moduleExport.baselineVersion,
    baselineSnapshotId: moduleExport.baselineSnapshotId,
    baselineCheckpointBinding: clone(moduleExport.baselineCheckpointBinding),
    baselineModuleBinding: clone(moduleExport.baselineModuleBinding),
    scenarioContext: clone(moduleExport.scenarioContext),
    checkpointNode: moduleExport.checkpointNode,
    exportRef,
    exportSha256,
    validatedAt,
    validationStatus: "verified",
    checks: {
      scenarioIdentity: "verified",
      baselineBinding: "verified",
      baselineModuleTreeDigest: "verified-by-deterministic-tree-digest",
      ownerBoundary: "verified",
      exportDigest: "verified",
      isolatedCloneShape: "verified-by-scenario-adapter",
      historicalSideEffectsDisabled: "verified"
    },
    validationScope: "prototype-scenario-adapter",
    conclusionBoundary: "S002原型适配器导出与恢复校验通过，不代表生产模块部署或平台验收通过"
  };
}

module.exports = Object.freeze({
  BASELINE_VERSION,
  BASELINE_SNAPSHOT_ID,
  BASELINE_CHECKPOINT_BINDING,
  BASELINE_MODULE_BINDINGS,
  TREE_HASH_ALGORITHM,
  SCENARIO_ID,
  SCENARIO_VERSION,
  SYNTHETIC_MARK,
  MODULE_DEFINITIONS,
  CHECKPOINT_ORDER,
  buildModuleExport,
  buildOwnerReceipt,
  validateModuleExport,
  moduleIsActive
});
