(function () {
  "use strict";

  const candidates = [
    {
      id: "CM-S001-BALANCED-v1",
      name: "稳健评分候选",
      method: "确定性评分卡",
      version: "MV-S001-BALANCED-0001",
      status: "已完成比较",
      metrics: { coverage: "92%", repeatability: "100%", monotonicity: "100%", violations: "0" },
      inputs: ["FIN-ASSET-20251231-v02", "T019-S001-v1"],
      outputs: ["预测融资成本", "结构风险分", "coverage"],
      author: "模型候选 · 林一",
      environment: "确定性运行环境 v1",
      review: "待人工评审",
      color: "blue"
    },
    {
      id: "CM-S001-CONSERVATIVE-v1",
      name: "利差敏感候选",
      method: "风险敏感评分卡",
      version: "MV-S001-CONSERVATIVE-0001",
      status: "已完成比较",
      metrics: { coverage: "92%", repeatability: "100%", monotonicity: "100%", violations: "0" },
      inputs: ["FIN-ASSET-20251231-v02", "T019-S001-v1"],
      outputs: ["预测融资成本", "利差敏感度", "coverage"],
      author: "模型候选 · 周二",
      environment: "确定性运行环境 v1",
      review: "未提交",
      color: "teal"
    },
    {
      id: "CM-S001-LEGACY-v1",
      name: "缺失重分权候选",
      method: "历史兼容评分卡",
      version: "MV-S001-LEGACY-0001",
      status: "已降级",
      metrics: { coverage: "100%", repeatability: "100%", monotonicity: "96%", violations: "1" },
      inputs: ["FIN-ASSET-20251231-v02", "T019-S001-v1"],
      outputs: ["预测融资成本", "coverage"],
      author: "模型候选 · 兼容线",
      environment: "确定性运行环境 v1",
      review: "禁止发布",
      color: "amber"
    }
  ];

  const timeline = [
    { id: "data", label: "数据版本", detail: "FIN-ASSET-20251231-v02", status: "ready", module: "data" },
    { id: "ontology", label: "Published 本体", detail: "T019-S001-v1", status: "ready", module: "ontology" },
    { id: "objective", label: "建模目标", detail: "MO-S001-FINANCING-v1", status: "active", module: "modeling" },
    { id: "review", label: "人工评审", detail: "1 个候选待评审", status: "pending", module: "modeling" },
    { id: "binding", label: "Ontology Binding", detail: "草案 · 需 M01 CR", status: "pending", module: "modeling" },
    { id: "simulation", label: "隔离模拟", detail: "2 个 Case 可运行", status: "ready", module: "modeling" },
    { id: "report", label: "报告并列比较", detail: "只读消费", status: "ready", module: "report" }
  ];

  const simulations = [
    {
      id: "SC-S001-RATE-UP-v1",
      name: "利率上行 +100bp",
      type: "单模型",
      parameterSummary: "利率 +100bp · 其余保持基线",
      graph: "Market Shock v1",
      status: "可运行",
      score: "—",
      impact: "预计成本上行 · 模拟"
    },
    {
      id: "SC-S001-COMPOSITE-v1",
      name: "利率 + 利差复合压力",
      type: "两模型串联",
      parameterSummary: "利率 +150bp · 利差 +200bp · 流动性折价 8%",
      graph: "Market Shock → Financing Evaluation",
      status: "可运行",
      score: "—",
      impact: "预计结构风险上升 · 模拟"
    }
  ];

  const s001CaseStudy = {
    id: "CASE-S001-RATE-STRESS-v1",
    title: "利率上行下的融资组合压力",
    subtitle: "用同一批对象和时间上下文，串起 Quiver、M07 与 M08",
    classification: "SYNTHETIC_RESEARCH_ONLY",
    context: {
      dataVersionId: "DATA-SYN-S001-EVAL-v1",
      ontologyVersionId: "ONT-SYN-S001-FINANCING-v1",
      bindingId: "MB-S001-EVALUATION-v1",
      timeRange: "2025-01 至 2025-12",
      purpose: "隔离验证 · 不进入正式工作流"
    },
    quiver: {
      seriesName: "融资组合平均成本",
      unit: "%",
      transform: "12 个月观测值 · 3 个月滚动均值 · 期末差分",
      observed: [2.48, 2.51, 2.53, 2.56, 2.59, 2.61, 2.64, 2.68, 2.71, 2.75, 2.79, 2.84],
      labels: ["25-01", "25-02", "25-03", "25-04", "25-05", "25-06", "25-07", "25-08", "25-09", "25-10", "25-11", "25-12"]
    },
    m07: {
      selectedObjectId: "FIN-UNIT-553",
      objects: [
        { id: "FIN-UNIT-553", name: "单位553", type: "FinancingEntity", balance: "393.134 亿元", rate: "2.880984%", maturity: "2026-09", relation: "融资成本偏高", simulationBaselineMemberRef: "SYN-HOLDING-001" },
        { id: "FIN-UNIT-465", name: "单位465", type: "FinancingEntity", balance: "770.000 亿元", rate: "2.196617%", maturity: "2026-06", relation: "浮动利率暴露", simulationBaselineMemberRef: "SYN-HOLDING-002" },
        { id: "FIN-UNIT-561", name: "单位561", type: "FinancingEntity", balance: "20.016 亿元", rate: "2.228380%", maturity: "2027-03", relation: "短期债务集中", simulationBaselineMemberRef: "SYN-HOLDING-003" }
      ],
      links: [
        ["FIN-UNIT-553", "RULE-FIN-R01", "融资成本偏高"],
        ["FIN-UNIT-465", "RULE-FIN-R02", "浮动利率暴露"],
        ["FIN-UNIT-561", "RULE-FIN-R03", "短期债务集中"]
      ],
      spatialStatus: "NOT_APPLICABLE",
      spatialReason: "S001 合成融资对象没有权威 GeoRef；不生成地图坐标。"
    },
    m08: {
      defaultCaseId: "SC-S001-COMPOSITE-v1",
      cases: [
        { id: "SC-S001-SINGLE-RATE-v1", name: "利率上行 +100bp", detail: "只改变基准利率，观察市场冲击模型输出。", params: "利率 +100bp" },
        { id: "SC-S001-COMPOSITE-v1", name: "复合压力：利率 + 利差 + 流动性", detail: "市场冲击 → 评价模型，观察组合损失和评价分数变化。", params: "利率 +150bp · 利差 +200bp · 评级 -1 档 · 流动性折价 8% · 赎回 12%" }
      ]
    }
  };

  const s005CaseStudy = {
    id: "CASE-S005-POST-INVESTMENT-v1",
    title: "金融产品投后评价",
    subtitle: "保持当前产品、时间范围和评价目标的一致上下文",
    classification: "SCENARIO_CANDIDATE_DATA",
    context: {
      dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
      ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
      bindingId: "MB-S005-EVALUATION-v1",
      timeRange: "2026-01 至 2026-07",
      purpose: "投后评价与压力情景比较"
    },
    quiver: {
      seriesName: "产品池累计表现",
      unit: "指数",
      transform: "月度观察 · 基期 100",
      observed: [100, 100.8, 101.6, 102.4, 103.3, 104.1, 105],
      labels: ["26-01", "26-02", "26-03", "26-04", "26-05", "26-06", "26-07"]
    },
    m07: {
      selectedObjectId: null,
      objects: [
        { id: "PRD-223C00000000A5FB", name: "基金 A", objectTypeRef: "InvestmentProduct", category: "混合二级债基", scopeStatus: "需复核", relation: "已选 · 证据部分可用", simulationBaselineMemberRef: "SYN-HOLDING-001" },
        { id: "PRD-40A100000000B2C7", name: "基金 B", objectTypeRef: "InvestmentProduct", category: "中长期纯债基金", scopeStatus: "符合范围", relation: "未选 · 证据完整", simulationBaselineMemberRef: "SYN-HOLDING-002" },
        { id: "PRD-62D200000000C1A9", name: "基金 C", objectTypeRef: "InvestmentProduct", category: "混合一级债基", scopeStatus: "无法判断", relation: "已选 · 历史数据不足", simulationBaselineMemberRef: "SYN-HOLDING-003" }
      ]
    },
    m08: {
      defaultCaseId: "SC-S005-COMPOSITE-v1",
      cases: [
        { id: "SC-S005-SINGLE-RATE-v1", name: "利率上行 +100bp", detail: "只改变基准利率，观察产品与组合评价变化。", params: "利率 +100bp" },
        { id: "SC-S005-COMPOSITE-v1", name: "复合压力：利率 + 利差 + 流动性", detail: "市场冲击后重新计算评价分数与价值影响。", params: "利率 +150bp · 利差 +200bp · 评级 -1 档 · 流动性折价 8% · 赎回 12%" }
      ]
    }
  };

  window.M08_MODELING_DATA = Object.freeze({
    namespace: "ofw.m08.research.v1",
    activeBaseline: "v1.1.0",
    governanceParent: "v1.0.3（只读历史父版本）",
    objective: {
      id: "MO-S001-FINANCING-v1",
      name: "集团融资成本与债务结构优化",
      status: "建模目标 · 待业务 Owner 确认",
      purpose: "在同一数据与本体版本上比较候选模型，并隔离验证融资压力情景。",
      dataVersion: "FIN-ASSET-20251231-v02",
      evaluationDataVersion: "DATA-S001-EVAL-v1",
      asOf: "2025-12-31",
      ontology: "T019-S001-v1",
      evaluator: "EVAL-M08-DETERMINISTIC-v1"
    },
    candidates,
    timeline,
    simulations,
    defaultObjectiveByScenario: Object.freeze({
      S001: "MO-S001-COST-FORECAST-v1",
      S002: "MO-S002-BUDGET-OVERRUN-v1",
      S004: "MO-S004-PRELOAN-RISK-v1",
      S005: "MO-S005-POST-INVESTMENT-RESEARCH-v1"
    }),
    caseStudies: Object.freeze({
      S001: Object.freeze(s001CaseStudy),
      S005: Object.freeze(s005CaseStudy)
    }),
    states: {
      fact: { label: "真实评价", score: "2.880984%", id: "FACT-S001-COST-0001", scope: "fact.read" },
      prediction: { label: "模型预测", score: "2.731%", id: "PRED-S001-COST-0001", scope: "prediction.read" },
      simulation: { label: "模拟结果", score: "3.184%", id: "SIMRES-S001-COST-0001", scope: "simulation.read" }
    },
    links: {
      data: "#module/data",
      ontology: "#module/ontology",
      query: "#module/query",
      decision: "#module/decision",
      agent: "#module/agent",
      report: "#module/report"
    }
  });
})();
