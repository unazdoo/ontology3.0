(function installV120Catalog(global) {
  "use strict";

  const scenarioRows = [
    { scenarioId: "S001", scenarioVersion: "S001-v1", name: "集团融资成本与债务结构优化", status: "archived", archived: true, dataAsOf: "2025-12-31", domain: "融资管理" },
    { scenarioId: "S002", scenarioVersion: "S002-v1", name: "预算监督管理", status: "archived", archived: true, dataAsOf: "2025-12-31", domain: "预算管理" },
    { scenarioId: "S003", scenarioVersion: "S003-v1", name: "债务风险监测", status: "archived", archived: true, dataAsOf: "2025-12-31", domain: "风险管理" },
    { scenarioId: "S004", scenarioVersion: "S004-v2.1.0", name: "财务公司贷款贷前调查", status: "archived", archived: true, dataAsOf: "2026-08-15", domain: "授信管理" },
    { scenarioId: "S005", scenarioVersion: "S005-v1", name: "金融产品投后评价", status: "active", archived: false, dataAsOf: "2026-07-17", domain: "投资管理" }
  ];

  const moduleMeta = {
    data: { owner: "M02 数据工程", route: "#module/data" },
    ontology: { owner: "M01 本体管理", route: "#module/ontology" },
    query: { owner: "M03 智能问数", route: "#module/query" },
    decision: { owner: "M04 决策中心", route: "#module/decision" },
    agent: { owner: "M05 Agent 应用", route: "#module/agent" },
    report: { owner: "M06 报告中心", route: "#module/report" },
    m07: { owner: "M07 多视图探索", route: "#module/m07" },
    modeling: { owner: "M08 模型与模拟", route: "#module/modeling" },
    dashboard: { owner: "仪表盘", route: "#dashboard" }
  };

  const moduleFacts = {
    data: {
      S001: { name: "融资数据资产", type: "DataAsset", status: "published", refs: ["RUN-20251231-002", "FIN-ASSET-20251231-v02"], summary: "5,218 条融资明细经标准化和质量检查形成版本化数据资产。", dataVersionId: "FIN-ASSET-20251231-v02" },
      S002: { name: "预算数据组合资产", type: "DataAsset", status: "published", refs: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1", "S002-DATA-v1"], summary: "预算执行与项目占用两类资产组成统一预算数据版本。", dataVersionId: "S002-DATA-v1" },
      S003: { name: "债务风险输入资产", type: "DataAsset", status: "published", refs: ["RUN-S003-DATA-20251231-v1", "S003-T007-DEBT-RISK-20251231-v1"], summary: "企业债务风险评估输入按成员和调节因子完成标准化。", dataVersionId: "S003-T007-DEBT-RISK-20251231-v1" },
      S004: { name: "贷前调查数据资产", type: "DataAsset", status: "published", refs: ["RUN-S004-20260815-001", "DATA-ASSET-S004-20260815-V01"], summary: "年度报告与贷前资料包完成归集并保留核验引用。", dataVersionId: "DATA-ASSET-S004-20260815-V01" },
      S005: { name: "投后评价来源快照", type: "DataAssetCandidate", status: "candidate", refs: ["S005-DATA-AUDIT-79-SNAPSHOTS", "s005-research-fixture.json#sourceSummary"], summary: "79 份脱敏快照覆盖 393 个表实例；日净值与现金流仍待接入。", dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS" }
    },
    ontology: {
      S001: { name: "企业融资语义", type: "OntologyDefinition", status: "published", refs: ["semantic-MSVJM48O-VJC6", "T019-S001-v1"], summary: "融资对象、关系、指标、规则和行动类型的已发布业务定义。", ontologyVersionId: "semantic-MSVJM48O-VJC6" },
      S002: { name: "预算管理本体", type: "OntologyDefinition", status: "published", refs: ["S002-ONTO-v1", "T019-S002-v1"], summary: "预算对象、关系、指标、规则与行动类型的归档定义。", ontologyVersionId: "S002-ONTO-v1" },
      S003: { name: "企业债务风险本体", type: "OntologyDefinition", status: "published", refs: ["SEM-S003-DEBT-RISK-v1", "T019-S003-v1"], summary: "风险对象、十五项指标、风险规则和行动类型的归档定义。", ontologyVersionId: "SEM-S003-DEBT-RISK-v1" },
      S004: { name: "贷款贷前调查本体", type: "OntologyDefinition", status: "published", refs: ["SEM-S004-PREFLIGHT-V1", "REC-T019-S004-20260815"], summary: "财务公司、借款人、成员关系和调查事实的归档定义。", ontologyVersionId: "SEM-S004-PREFLIGHT-V1" },
      S005: { name: "投后评价语义候选", type: "OntologyCandidate", status: "candidate", refs: ["S005-SEMANTIC-CANDIDATE-v1", "MB-S005-EVALUATION-v1"], summary: "投资产品评价语义与模型绑定仍为候选，不代表已发布定义。", ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1" }
    },
    query: {
      S001: { name: "融资问数配置", type: "QueryConfiguration", status: "available", refs: ["IQ-AGENT-S001-FINANCING", "RUN-MSVJWKPO-002", "C018-S001-v1"], summary: "按已发布融资语义回答成本、重点事项和产业板块问题。" },
      S002: { name: "预算问数配置", type: "QueryConfiguration", status: "available", refs: ["IQ-AGENT-S002-BUDGET", "RUN-S002-QUERY-001-PORTFOLIO", "C018-S002-v1"], summary: "覆盖预算执行、项目余额和采购占用问题。" },
      S003: { name: "债务风险问数配置", type: "QueryConfiguration", status: "available", refs: ["IQ-AGENT-S003-RISK", "S003-M03-QUERY-RESULTS-20260817-002"], summary: "覆盖风险分区、弱项指标和调节因子问题。" },
      S004: { name: "贷前调查问数登记", type: "QueryRegistration", status: "not_applicable", refs: [], summary: "该场景使用报告伴读，不启用标准智能问数。" },
      S005: { name: "投后评价合规与横评输入", type: "QueryInputCandidate", status: "candidate", refs: ["S005-EVAL-INPUT-RESEARCH-v1", "s005-research-fixture.json#marketSeries"], summary: "支持持续合规与同类横评查看；评价结论仍为部分状态。" }
    },
    decision: {
      S001: { name: "融资优化行动记录", type: "DecisionRecord", status: "confirmed", refs: ["AR-RUN-MSVJWKPO-002-UNIT-553", "TD-6872111633"], summary: "三条融资优化请求中一条经人工确认并形成负责人待办。" },
      S002: { name: "预算监督行动边界", type: "DecisionRegistration", status: "not_applicable", refs: [], summary: "当前授权范围不形成 Action Request。" },
      S003: { name: "债务风险处置记录", type: "DecisionRecord", status: "confirmed", refs: ["CP-S003-20260819141420000-c03838000038", "S003_RISK_FOLLOW_UP"], summary: "风险候选经人工确认后按成员单位接口人分办。" },
      S004: { name: "贷前调查人工复核边界", type: "DecisionRegistration", status: "not_applicable", refs: [], summary: "授信结论在报告流程内复核，不创建通用行动待办。" },
      S005: { name: "投后评价池内选择复核", type: "DecisionInputCandidate", status: "read_only", refs: ["S005-EVAL-INPUT-RESEARCH-v1", "s005-research-fixture.json#selectionSeries"], summary: "只读呈现池内选择差异，不创建行动申请或交易指令。" }
    },
    agent: {
      S001: { name: "融资分析 Agent 组合", type: "AgentApplication", status: "available", refs: ["RUN-20260816-004", "RES-20260816-004"], summary: "包含融资洞察、报告生成和报告伴读能力。" },
      S002: { name: "预算分析 Agent 组合", type: "AgentApplication", status: "available", refs: ["AG-RUN-S002-ANOMALY-20260815", "AG-RUN-S002-REPORT-20260815"], summary: "包含预算异常分析和预算报告草稿能力。" },
      S003: { name: "债务风险报告伴读 Agent", type: "AgentApplication", status: "available", refs: ["AGENT-S003-RISK-REPORT-COPILOT-v1"], summary: "基于归档报告证据解释债务风险结论。" },
      S004: { name: "贷前调查 Agent 组合", type: "AgentApplication", status: "available", refs: ["AGENT-S004-PREFLIGHT-REPORT-002", "EVID-S004-20260815-0002"], summary: "包含贷前调查报告生成和伴读能力。" },
      S005: { name: "投后交易与风险查看", type: "AgentInputCandidate", status: "read_only", refs: ["s005-research-fixture.json#riskLamps"], summary: "只读查看交易与风险信号，不启动 Agent 行动或外部副作用。" }
    },
    report: {
      S001: { name: "集团融资经营分析报告", type: "Report", status: "published", refs: ["RPT-20260816-092626-010", "EP-20260816-092248-003", "CMP-20260816-092853-001"], summary: "HTML 与 PDF 共用报告编号、内容版本和固定证据。" },
      S002: { name: "预算监督管理分析报告", type: "Report", status: "published", refs: ["RPT-S002-BUDGET-001", "VRF-RESULT-S002-REPORT-v1"], summary: "预算报告与确定性核验结果保存在归档运行中。" },
      S003: { name: "企业债务风险评估报告", type: "ReportCollection", status: "published", refs: ["S003-C035-RISK-RESULTS-20251231-v2", "21份企业风险报告"], summary: "二十一份企业风险报告使用同一归档评估结果。" },
      S004: { name: "财务公司贷款贷前调查报告", type: "Report", status: "published", refs: ["RPT-S004-20260815-0001", "RPT-S004-CGNPC-20260815-v2.0"], summary: "贷前调查报告保留 HTML、PDF 和证据引用。" },
      S005: { name: "金融产品投后评价报告", type: "ReportDraft", status: "draft", refs: ["S005-EVAL-INPUT-RESEARCH-v1", "s005-research-fixture.json#kpis"], summary: "当前仅形成研究草稿，未进入正式发布结果。" }
    },
    m07: {
      S001: { name: "融资多视图资源", type: "ExplorationResource", status: "available", refs: ["modules/m07/resources/s001.json", "FIN-ASSET-20251231-v02", "semantic-MSVJM48O-VJC6"], summary: "以融资主体、关系、时序和证据的脱敏投影进入多视图探索。", objectRef: { id: "s001.entity.553", objectTypeRef: "m01.object-type.financing-entity", title: "单位553" }, dataVersionId: "FIN-ASSET-20251231-v02", ontologyVersionId: "semantic-MSVJM48O-VJC6" },
      S002: { name: "预算多视图登记", type: "ExplorationRegistration", status: "not_registered", refs: ["SCENARIO-REGISTRY.json#S002"], summary: "当前候选未登记 S002 多视图资源；归档场景保持不变。" },
      S003: { name: "债务风险多视图登记", type: "ExplorationRegistration", status: "not_registered", refs: ["SCENARIO-REGISTRY.json#S003"], summary: "当前候选未登记 S003 多视图资源；归档场景保持不变。" },
      S004: { name: "贷前调查多视图登记", type: "ExplorationRegistration", status: "not_registered", refs: ["SCENARIO-REGISTRY.json#S004"], summary: "当前候选未登记 S004 多视图资源；归档场景保持不变。" },
      S005: { name: "投后评价多视图资源", type: "ExplorationResource", status: "candidate", refs: ["modules/m07/resources/s005.json", "S005-DATA-AUDIT-79-SNAPSHOTS", "S005-SEMANTIC-CANDIDATE-v1"], summary: "五个规范 InvestmentProduct 引用进入对象、关系、时序和无底图空间视图。", objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" }, dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS", ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1" }
    },
    modeling: {
      S001: { name: "融资模型目标", type: "ModelingObjective", status: "candidate", refs: ["MO-S001-COST-FORECAST-v1", "MO-S001-DEBT-STRUCTURE-OPT-v1"], summary: "登记融资成本预测与债务结构方案目标，不回写业务事实。", objectRef: { id: "s001.entity.553", objectTypeRef: "FinancingEntity", title: "单位553" }, dataVersionId: "FIN-ASSET-20251231-v02", ontologyVersionId: "semantic-MSVJM48O-VJC6", modelingObjectiveRef: "MO-S001-COST-FORECAST-v1" },
      S002: { name: "预算超支模型目标", type: "ModelingObjective", status: "candidate", refs: ["MO-S002-BUDGET-OVERRUN-v1"], summary: "登记预算超支预测目标，不改变 S002 归档运行。", modelingObjectiveRef: "MO-S002-BUDGET-OVERRUN-v1" },
      S003: { name: "债务风险模型登记", type: "ModelingRegistration", status: "not_registered", refs: ["SCENARIO-REGISTRY.json#S003"], summary: "当前 M08 包未登记 S003 Objective；不得回退到其他场景。" },
      S004: { name: "贷前风险模型目标", type: "ModelingObjective", status: "candidate", refs: ["MO-S004-PRELOAN-RISK-v1"], summary: "登记贷前风险预测目标，不写入授信事实。", modelingObjectiveRef: "MO-S004-PRELOAN-RISK-v1" },
      S005: { name: "投后评价模型目标", type: "ModelingObjective", status: "candidate", refs: ["MO-S005-POST-INVESTMENT-RESEARCH-v1", "MB-S005-EVALUATION-v1"], summary: "使用 InvestmentProduct 输入形成 PREDICTION 或 SIMULATION 结果；不作为正式评价事实。", objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" }, dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS", ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1", modelingObjectiveRef: "MO-S005-POST-INVESTMENT-RESEARCH-v1" }
    },
    dashboard: {
      S001: { name: "集团融资驾驶舱", type: "Dashboard", status: "published", refs: ["dashboard:financing"], summary: "展示归档融资经营指标和行动状态。" },
      S002: { name: "预算管理驾驶舱", type: "Dashboard", status: "published", refs: ["dashboard:budget"], summary: "展示归档预算执行和项目占用状态。" },
      S003: { name: "债务风险监测驾驶舱", type: "Dashboard", status: "published", refs: ["dashboard:risk"], summary: "展示归档风险分区与处置状态。" },
      S004: { name: "贷前调查驾驶舱登记", type: "DashboardRegistration", status: "not_applicable", refs: [], summary: "v1.1.0 场景未登记独立驾驶舱。" },
      S005: { name: "投后评价概览", type: "DashboardInputCandidate", status: "candidate", refs: ["s005-research-fixture.json#sourceSummary", "s005-research-fixture.json#kpis"], summary: "汇总来源覆盖、评价范围和证据状态；结论仍为部分评价。" }
    }
  };

  function freezeRecord(record) {
    if (Array.isArray(record.refs)) Object.freeze(record.refs);
    if (record.objectRef) Object.freeze(record.objectRef);
    return Object.freeze(record);
  }

  const scenarios = Object.freeze(scenarioRows.map((row) => freezeRecord({ ...row })));
  const resources = Object.freeze(Object.entries(moduleFacts).flatMap(([moduleId, scenarioFacts]) => {
    const module = moduleMeta[moduleId];
    return scenarios.map((scenario) => {
      const fact = scenarioFacts[scenario.scenarioId];
      return freezeRecord({
        id: `ofw.v120.${moduleId}.${scenario.scenarioId.toLowerCase()}`,
        moduleId,
        scenarioId: scenario.scenarioId,
        name: fact.name,
        type: fact.type,
        businessDomain: scenario.domain,
        status: fact.status,
        scenarioStatus: scenario.status,
        scenarioArchived: scenario.archived,
        owner: module.owner,
        asOf: scenario.dataAsOf,
        summary: fact.summary,
        refs: [...fact.refs],
        route: module.route,
        ...(fact.objectRef ? { objectRef: { ...fact.objectRef } } : {}),
        ...(fact.dataVersionId ? { dataVersionId: fact.dataVersionId } : {}),
        ...(fact.ontologyVersionId ? { ontologyVersionId: fact.ontologyVersionId } : {}),
        ...(fact.modelingObjectiveRef ? { modelingObjectiveRef: fact.modelingObjectiveRef } : {})
      });
    });
  }));

  function resourcesFor(moduleId) {
    return Object.freeze(resources.filter((item) => item.moduleId === moduleId));
  }

  function scenario(scenarioId) {
    return scenarios.find((item) => item.scenarioId === scenarioId) || null;
  }

  function resource(resourceId) {
    return resources.find((item) => item.id === resourceId) || null;
  }

  global.OFW_V120_CATALOG = Object.freeze({ scenarios, resources, resourcesFor, scenario, resource });
})(typeof window !== "undefined" ? window : globalThis);
