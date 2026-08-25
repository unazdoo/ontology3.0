(function () {
  "use strict";

  const BASELINE_SNAPSHOT_ID = "BSL-S001-V103-DE0119608E26";
  const workflow = {
    S001: { completed: 15, total: 15, completedAt: "2026-08-16 09:28:53", evidence: "runtime-snapshots/S001-RUN-20260816081748567-705ac89fb83a.runtime.json" },
    S002: { completed: 13, total: 13, completedAt: "2026-08-15 16:00:00", evidence: "scenarios/s002/checkpoints/runs/S002-RUN-20260815080000000-6ef5d0ef82f9" },
    S003: { completed: 15, total: 15, completedAt: "2026-08-19 14:14:20", evidence: "scenarios/s003/checkpoints/CP38-performance-and-m04-ux.json" },
    S004: { completed: 15, total: 15, completedAt: "2026-08-15 23:30:00", evidence: "scenarios/s004-runtime-v2.1.0/INTEGRATION-HANDOFF.md" }
  };
  const scenes = [
    {
      scenarioId: "S001",
      scenarioVersion: "S001-v1",
      scenarioRunId: "S001-RUN-20260816081748567-705ac89fb83a",
      name: "集团融资成本与债务结构优化",
      domain: "融资管理",
      dataAsOf: "2025-12-31",
      status: "completed",
      sourceProductBaseline: "v1.0.7"
    },
    {
      scenarioId: "S002",
      scenarioVersion: "S002-v1",
      scenarioRunId: "S002-RUN-20260815080000000-6ef5d0ef82f9",
      name: "预算监督管理",
      domain: "预算管理",
      dataAsOf: "2025-12-31",
      status: "completed",
      sourcePackage: "scenarios/s002"
    },
    {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
      name: "债务风险监测",
      domain: "风险管理",
      dataAsOf: "2025-12-31",
      status: "completed",
      checkpointId: "CP-S003-20260819141420000-c03838000038",
      sourcePackage: "scenarios/s003"
    },
    {
      scenarioId: "S004",
      scenarioVersion: "S004-v2.1.0",
      scenarioRunId: "S004-RUN-20260815233000000-7f3c8e42a1b6",
      name: "财务公司贷款贷前调查",
      domain: "授信管理",
      dataAsOf: "2026-08-15",
      status: "completed",
      sourcePackage: "scenarios/s004-runtime-v2.1.0"
    }
  ];

  const dataEngineering = {
    S001: {
      sources: ["融资一览表", "融资数据共享文件夹"],
      pipelines: ["融资数据标准化与发布"],
      assets: ["FIN-ASSET-20251231-v02"],
      quality: "通过",
      members: "4 个成员 / 3 条关系"
    },
    S002: {
      sources: ["实际执行明细", "预算下达明细", "预算申报明细", "项目预算占用", "项目预算使用表"],
      snapshots: 8,
      pipelines: ["预算编制与执行标准化管道", "项目预算余额与采购占用标准化管道"],
      assets: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
      combinationAsset: "S002-DATA-v1",
      quality: "426 项检查通过",
      members: "14 个成员"
    },
    S003: {
      sources: ["企业债务风险评估模版"],
      pipelines: ["债务风险输入标准化"],
      assets: ["S003-T007-DEBT-RISK-20251231-v1"],
      sourceVersionAliases: {
        "S003-T007-FORMAL-CANDIDATE-20251231-v1": "S003-T007-DEBT-RISK-20251231-v1"
      },
      quality: "双成员质量通过",
      members: "财务数据 / 调节因子"
    },
    S004: {
      sources: ["年度报告", "贷前调查资料包"],
      pipelines: ["贷前调查资料归集与核验"],
      assets: ["DATA-ASSET-S004-20260815-V01"],
      quality: "18 项核验通过",
      members: "财务公司主体 / 借款人 / 资料证据"
    }
  };

  const ontology = {
    S001: { name: "企业融资语义", publishedVersion: "semantic-MSVJM48O-VJC6 / V1", pointer: "T019-S001-v1", scope: "4 Object / 3 Link / 7 Metric / 3 Rule / 1 Action Type" },
    S002: { name: "预算管理本体", publishedVersion: "S002-ONTO-v1", pointer: "T019-S002-v1", scope: "7 Object / 8 Link / 9 Metric / 5 Rule / 6 Action Type" },
    S003: { name: "企业债务风险本体", publishedVersion: "S003-M01-DEBT-RISK-PKG 1.0.2", pointer: "T019-S003-v1", scope: "风险对象 / 15 指标 / 风险 Rule / Action Type" },
    S004: { name: "贷款贷前调查本体", publishedVersion: "V1", semanticVersionId: "SEM-S004-PREFLIGHT-V1", pointer: "REC-T019-S004-20260815", scope: "财务公司 / 借款人 / 成员关系 / 贷前调查事实" }
  };

  const query = {
    S001: { agent: "融资问数 Agent", configId: "IQ-AGENT-S001-FINANCING", semanticResources: 37, status: "available", questions: ["三家单位综合平均融资成本是多少？", "单位553需要优先与哪些银行协商？", "集团融资成本、债务结构和产业板块对比如何？"] },
    S002: { agent: "预算问数 Agent", configId: "IQ-AGENT-S002-BUDGET", semanticResources: 10, status: "available", questions: ["2025 年预算执行率是多少？", "项目可用立项余额最低的是哪些项目？", "哪些采购占用在年末集中？"] },
    S003: { agent: "债务风险问数 Agent", configId: "IQ-AGENT-S003-RISK", semanticResources: 8, status: "available", questions: ["哪些企业进入红色风险区？", "风险评分最低企业的弱项指标是什么？", "环保企业的调节因子如何处理？"] },
    S004: { agent: null, status: "not_applicable", reason: "贷前调查场景使用正式报告伴读，不启用标准智能问数。", questions: [] }
  };

  const decisions = {
    S001: { requests: 3, reminders: 3, confirmed: 1, tasks: 1, summary: "三条融资优化请求；一条人工确认并形成负责人待办。" },
    S002: { requests: 0, reminders: 0, confirmed: 0, tasks: 0, summary: "当前授权范围不形成 Action Request。" },
    S003: { requests: 4, reminders: 4, confirmed: 1, tasks: 1, summary: "CP38 风险候选经人工确认后按成员单位接口人分办。" },
    S004: { requests: 0, reminders: 0, confirmed: 0, tasks: 0, summary: "授信结论在报告流程内人工复核，不进入通用行动队列。" }
  };

  const agents = {
    S001: ["融资洞察与行动协作 Agent", "融资经营分析报告生成 Agent", "报告伴读与数据核验助手"],
    S002: ["预算异常分析 Agent", "预算报告草稿 Agent"],
    S003: ["债务风险报告伴读 Agent"],
    S004: ["贷前调查报告生成 Agent", "贷前调查报告伴读 Agent"]
  };

  const reports = {
    S001: { definitions: ["集团融资经营分析报告"], dashboards: ["集团融资驾驶舱"], reports: ["RPT-20260816-092626-010 / 2.0.0"], template: "report-center/review-lifecycle/templates/s001-financing-report-template.html", formats: ["HTML", "PDF"] },
    S002: { definitions: ["预算监督管理分析报告"], dashboards: ["预算管理驾驶舱"], reports: ["BUDGET-RPT-2026-0001 / 1.0.0"], sourceDraft: "RPT-S002-BUDGET-DRAFT-v1", verificationRun: "VRF-20260815-153001-001", topics: 6, formats: ["HTML", "打印为 PDF"] },
    S003: { definitions: ["企业债务风险评估报告"], dashboards: ["债务风险监测驾驶舱"], reports: ["21 份企业风险评估报告"], formats: ["HTML", "打印为 PDF"] },
    S004: { definitions: ["财务公司贷款贷前调查报告"], dashboards: [], reports: ["S004-PLR-2026-0001"], template: "scenarios/s004-runtime-v2.1.0/artifacts/templates/RT-S004-PREFLIGHT-002-v2.0.0.html", formats: ["HTML", "PDF"] }
  };

  const dashboards = [
    { id: "financing", name: "集团融资驾驶舱", status: "published", dataAsOf: "2025-12-31" },
    { id: "budget", name: "预算管理驾驶舱", status: "published", dataAsOf: "2025 年度" },
    { id: "risk", name: "债务风险监测驾驶舱", status: "published", dataAsOf: "2025-12-31" }
  ];

  const chain = {
    S001: {
      M02: { status: "completed", refs: ["RUN-20251231-002", "FIN-ASSET-20251231-v02"] },
      M01: { status: "completed", refs: ["semantic-MSVJM48O-VJC6", "T019-S001-v1"] },
      M03: { status: "completed", refs: ["RUN-MSVJWKPO-002", "C018-S001-v1"] },
      M04: { status: "completed", refs: ["AR-RUN-MSVJWKPO-002-UNIT-553", "TD-6872111633"] },
      M05: { status: "completed", refs: ["RUN-20260816-004", "RES-20260816-004"] },
      M06: { status: "completed", refs: ["RPT-20260816-092626-010", "EP-20260816-092248-003", "CMP-20260816-092853-001"] }
    },
    S002: {
      M02: { status: "completed", refs: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"] },
      M01: { status: "completed", refs: ["S002-ONTO-v1", "T019-S002-v1"] },
      M03: { status: "completed", refs: ["RUN-S002-QUERY-001-PORTFOLIO", "C018-S002-v1"] },
      M04: { status: "not_applicable", refs: [], reason: "预算监督当前闭环不形成通用决策事项。" },
      M05: { status: "completed", refs: ["AG-RUN-S002-ANOMALY-20260815", "AG-RUN-S002-REPORT-20260815"] },
      M06: { status: "completed", refs: ["RPT-S002-BUDGET-001", "VRF-RESULT-S002-REPORT-v1"] }
    },
    S003: {
      M02: { status: "completed", refs: ["RUN-S003-DATA-20251231-v1", "S003-T007-DEBT-RISK-20251231-v1"] },
      M01: { status: "completed", refs: ["SEM-S003-DEBT-RISK-v1", "T019-S003-v1"] },
      M03: { status: "completed", refs: ["S003-M03-QUERY-RESULTS-20260817-002"] },
      M04: { status: "completed", refs: ["CP-S003-20260819141420000-c03838000038", "S003_RISK_FOLLOW_UP"] },
      M05: { status: "completed", refs: ["AGENT-S003-RISK-REPORT-COPILOT-v1"] },
      M06: { status: "completed", refs: ["S003-C035-RISK-RESULTS-20251231-v2", "21份企业风险报告"] }
    },
    S004: {
      M02: { status: "completed", refs: ["RUN-S004-20260815-001", "DATA-ASSET-S004-20260815-V01"] },
      M01: { status: "completed", refs: ["SEM-S004-PREFLIGHT-V1", "REC-T019-S004-20260815"] },
      M03: { status: "not_applicable", refs: [], reason: "贷前调查使用报告伴读，不启用标准智能问数。" },
      M04: { status: "not_applicable", refs: [], reason: "授信结论在报告流程内人工复核，不创建通用行动待办。" },
      M05: { status: "completed", refs: ["AGENT-S004-PREFLIGHT-REPORT-002", "EVID-S004-20260815-0002"] },
      M06: { status: "completed", refs: ["RPT-S004-20260815-0001", "RPT-S004-CGNPC-20260815-v2.0"] }
    }
  };

  function scene(scenarioId) {
    return scenes.find((item) => item.scenarioId === scenarioId) || null;
  }

  window.OFW_COMPOSITE_REGISTRY = Object.freeze({
    schemaVersion: "ofw.composite-resource-registry.v1",
    productBaseline: "v1.0.7",
    governanceBaseline: "v1.0.3",
    baselineSnapshotId: BASELINE_SNAPSHOT_ID,
    scenes: Object.freeze(scenes.map(Object.freeze)),
    dataEngineering: Object.freeze(dataEngineering),
    ontology: Object.freeze(ontology),
    query: Object.freeze(query),
    decisions: Object.freeze(decisions),
    agents: Object.freeze(agents),
    reports: Object.freeze(reports),
    workflow: Object.freeze(workflow),
    chain: Object.freeze(chain),
    dashboards: Object.freeze(dashboards.map(Object.freeze)),
    scene
  });
})();
