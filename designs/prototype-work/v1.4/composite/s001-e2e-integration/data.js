(function installCompositeData(global) {
  "use strict";

  const frozenRoot = "../../../../prototype-releases/v1.1.0";
  const modules = [
    {
      id: "data",
      ownerId: "M02",
      name: "数据工程",
      short: "数据",
      icon: "database",
      route: "#module/data",
      source: `${frozenRoot}/data-engineering-prototype-review/review-v3/方案B2.html?v=20260822-05`,
      rootHash: "#/resources",
      description: "统一管理数据源、快照、管道、质量和已发布数据资产。"
    },
    {
      id: "ontology",
      ownerId: "M01",
      name: "本体管理",
      short: "本体",
      icon: "network",
      route: "#module/ontology",
      source: "../ontology/index.html?v=20260907-01",
      rootHash: "#published",
      description: "统一管理业务对象、关系、指标、规则、行动类型和语义版本。"
    },
    {
      id: "query",
      ownerId: "M03",
      name: "智能问数",
      short: "问数",
      icon: "message-square-text",
      route: "#module/query",
      source: `${frozenRoot}/intelligent-query-prototype/review-next/conversation-workspace/index.html?v=20260823-07`,
      rootHash: "#/ask",
      description: "基于已发布业务定义回答问题，并保留版本与证据。"
    },
    {
      id: "decision",
      ownerId: "M04",
      name: "决策中心",
      short: "决策",
      icon: "circle-dot-dashed",
      route: "#module/decision",
      source: `${frozenRoot}/decision-center-prototype/review-v2/action-portfolio.html?prototypeBuild=20260823-15`,
      rootHash: "#workbench",
      description: "承接受控行动申请，经人工确认后形成负责人待办。"
    },
    {
      id: "agent",
      ownerId: "M05",
      name: "Agent 应用",
      short: "Agent",
      icon: "bot",
      route: "#module/agent",
      source: `${frozenRoot}/agent-application/Agent应用.html?v=20260824-08`,
      rootHash: "#/agents",
      description: "配置并运行受控任务，保存结果、证据与复核记录。"
    },
    {
      id: "report",
      ownerId: "M06",
      name: "报告中心",
      short: "报告",
      icon: "files",
      route: "#module/report",
      source: `${frozenRoot}/report-center/review-lifecycle/index.html?v=20260824-12`,
      rootHash: "#/catalog",
      description: "统一创建、核验、发布和阅读报告及历史版本。"
    },
    {
      id: "m07",
      ownerId: "M07",
      name: "业务对象探索",
      short: "探索",
      icon: "scan-search",
      route: "#module/m07",
      source: "../modules/m07/index.html?v=20260904-01",
      rootHash: "#discover",
      description: "从业务对象和对象集出发，联动关系、时序、地图、对比和证据。"
    },
    {
      id: "modeling",
      ownerId: "M08",
      resourceOwnerId: "M08",
      name: "模型目标与优化",
      short: "模型",
      icon: "activity",
      route: "#module/modeling",
      source: "../model-center/index.html?v=20260904-01",
      rootHash: "#objectives",
      description: "围绕业务目标管理模型、代码、评测、候选观察和结果消费。"
    }
  ];

  const dashboard = {
    id: "dashboard",
    ownerId: "Dashboard",
    name: "经营驾驶舱",
    short: "驾驶舱",
    icon: "layout-dashboard",
    route: "#dashboard",
    source: "../dashboard/index.html?v=20260904-01",
    rootHash: "#/dashboards",
    description: "按业务领域查看已形成的指标、状态和行动。"
  };

  const scenarioDefinitions = [
    {
      id: "S001",
      scenarioVersion: "S001-v1",
      name: "融资成本洞察与行动闭环",
      businessDomain: "融资管理",
      dataAsOf: "2025-12-31",
      archived: true,
      status: "completed",
      scenarioRunId: "S001-RUN-20260816081748567-705ac89fb83a",
      formedAt: "2026-08-16T08:17:48.567Z"
    },
    {
      id: "S002",
      scenarioVersion: "S002-v1",
      name: "预算监督管理闭环",
      businessDomain: "预算管理",
      dataAsOf: "2025 年度",
      archived: true,
      status: "completed",
      scenarioRunId: "S002-RUN-20260815080000000-6ef5d0ef82f9",
      formedAt: "2026-08-15T08:00:00.000Z"
    },
    {
      id: "S003",
      scenarioVersion: "S003-v1",
      name: "债务风险智能监测",
      businessDomain: "债务风险",
      dataAsOf: "2025-12-31",
      archived: true,
      status: "completed",
      scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
      formedAt: "2026-08-17T16:30:00.000Z"
    },
    {
      id: "S004",
      scenarioVersion: "S004-v2.1.0",
      name: "贷款贷前调查闭环",
      businessDomain: "信贷管理",
      dataAsOf: "2026-08-15",
      archived: true,
      status: "completed",
      scenarioRunId: "S004-RUN-20260815233000000-7f3c8e42a1b6",
      formedAt: "2026-08-15T23:30:00.000Z"
    },
    {
      id: "S005",
      scenarioVersion: "S005-v1",
      name: "投后评价与池内选择分析",
      businessDomain: "投资管理",
      dataAsOf: "2026-07-17",
      archived: false,
      status: "active",
      default: true
    }
  ];

  const data = Object.freeze({
    version: "v1.4-rc.1",
    parentVersion: "v1.3.2-rc.1",
    parentManifest: "INHERITANCE-MANIFEST.json",
    ancestorCommit: "e3990c69e77882062035490ef718fd93549bbf82",
    ancestorSubtree: "a24109c8be2ffceca73e0fedbb9387f4b85a7176",
    sourceTag: "prototype-v1.1.0-frozen",
    sourceCommit: "a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716",
    baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7",
    acceptanceReady: false,
    brand: Object.freeze({ zh: "智财问策", en: "Ontology Financial World" }),
    modules: Object.freeze(modules.map(Object.freeze)),
    moduleById: Object.freeze(Object.fromEntries(modules.map((module) => [module.id, module]))),
    dashboard: Object.freeze(dashboard),
    scenarios: Object.freeze(scenarioDefinitions.map(Object.freeze)),
    scenarioById: Object.freeze(Object.fromEntries(scenarioDefinitions.map((scenario) => [scenario.id, scenario]))),
    nav: Object.freeze([
      Object.freeze({ id: "home", name: "首页", icon: "house", route: "#home" }),
      ...modules.map((module) => Object.freeze({ id: module.id, name: module.name, icon: module.icon, route: module.route })),
      Object.freeze({ id: "dashboard", name: dashboard.name, icon: dashboard.icon, route: dashboard.route })
    ])
  });

  // Compatibility names keep the v1.2-derived local Shell and parent module assets on one contract.
  global.OFW_V120_DATA = data;
  global.OFW_V130_DATA = data;
  global.OFW_V131_DATA = data;
})(window);
