(function (root) {
  "use strict";

  const baselineSources = {
    M01: "./baseline-v110/ontology-management-review/canvas-first/index.html",
    M02: "./baseline-v110/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html",
    M03: "./baseline-v110/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    M04: "./baseline-v110/decision-center-prototype/review-v2/action-portfolio.html",
    M05: "./baseline-v110/agent-application/Agent%E5%BA%94%E7%94%A8.html",
    M06: "./baseline-v110/report-center/review-lifecycle/index.html"
  };
  const moduleSource = (moduleId) => `./s005-module-loader.html?moduleId=${moduleId}&source=${encodeURIComponent(baselineSources[moduleId])}&loaderVersion=s005-v110-real-4`;
  const workflow = [
    {
      id: "sourceBatch",
      moduleId: "M02",
      title: "登记来源批次",
      action: "确认 79 份快照",
      summary: "核对日期范围、SHA-256、工作表、字段、记录数和结构变化。"
    },
    {
      id: "classification",
      moduleId: "M01",
      title: "完成分类与语义映射",
      action: "确认 Wind fund_type",
      summary: "将利率债、短期纯债、中长期纯债、混合一级和混合二级映射到一期范围。",
      prerequisite: "sourceBatch"
    },
    {
      id: "compliance",
      moduleId: "M03",
      title: "完成持续合规观察",
      action: "读取官方事件源",
      summary: "核对证监会、中基协和管理人公告，输出四态事实状态。",
      prerequisite: "classification"
    },
    {
      id: "marketPeer",
      moduleId: "M03",
      title: "完成市场同类横评",
      action: "计算中位数 / 前三分之一",
      summary: "用 Wind 点时样本比较入池基金、同类中位数、同类前三分之一和合同基准。",
      prerequisite: "compliance"
    },
    {
      id: "selection",
      moduleId: "M04",
      title: "冻结池内选择评价",
      action: "复核选中 / 未选",
      summary: "按交易前冻结决策和 T+1/T+5/T+20/T+60 前瞻窗口评估选择能力。",
      prerequisite: "marketPeer"
    },
    {
      id: "tradingRisk",
      moduleId: "M05",
      title: "完成交易与风险复盘",
      action: "复核 TWR / MWR / 风险",
      summary: "拆分产品表现、实际资金结果、交易执行、回撤、波动和固定收益归因。",
      prerequisite: "selection"
    },
    {
      id: "reportDraft",
      moduleId: "M06",
      title: "形成研究报告草稿",
      action: "生成研究草稿",
      summary: "汇总证据链、指标、独立风险灯和诚实降级状态，不发布正式报告。",
      prerequisite: "tradingRisk"
    }
  ];

  root.S005_SCENARIO_CONFIG = {
    scenarioId: "S005",
    scenarioVersion: "S005-v1",
    baselineVersion: "v1.1.0",
    baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7",
    governanceBaselineVersion: "v1.0.3",
    governanceBaselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    implementationBaselineStatus: "frozen-implementation-baseline",
    name: "金融产品投后评价全周期闭环",
    organization: "财务公司投资部门",
    focus: "债券型基金与利率债",
    dataAsOf: "2026-07-17",
    sourceFile: "投资情况明细表/投资业务台账（YYYYMMDD）.xlsx",
    sourceArtifactFile: "S005 研究数据审计与 Wind 导出合同",
    sourceRows: 79,
    dataVersion: "S005-DATA-AUDIT-79-SNAPSHOTS",
    ontologyVersion: "S005-SEMANTIC-CANDIDATE-WIND-FUND-TYPE-v1",
    trustedOntologyVersion: "研究候选 · 未发布",
    bindingId: "S005-RESEARCH-BINDING-20260717",
    companionRunId: null,
    selectedEntities: ["F-A", "F-B", "F-C", "F-D", "F-E"],
    moduleSources: {
      M01: moduleSource("M01"),
      M02: moduleSource("M02"),
      M03: moduleSource("M03"),
      M04: moduleSource("M04"),
      M05: moduleSource("M05"),
      M06: moduleSource("M06")
    },
    baselineModuleSources: baselineSources,
    moduleMeta: {
      M01: { name: "分类与语义", short: "分类", icon: "network", color: "violet", description: "Wind fund_type、一期允许范围和语义候选。" },
      M02: { name: "数据工程", short: "数据", icon: "database", color: "blue", description: "79 份周期间快照、Wind 导出和来源质量证据。" },
      M03: { name: "市场与合规", short: "横评", icon: "chart", color: "cyan", description: "官方合规观察、市场同类基金池和前三分之一比较。" },
      M04: { name: "池内选择", short: "选择", icon: "target", color: "orange", description: "冻结决策、选中 / 未选和前瞻窗口。" },
      M05: { name: "交易与风险", short: "风险", icon: "activity", color: "teal", description: "交易执行、TWR/MWR、夏普和固定收益归因。" },
      M06: { name: "报告中心", short: "报告", icon: "file", color: "green", description: "研究草稿、证据链和诚实降级。" }
    },
    workflow,
    runtimeConfig: {
      configVersion: "S005-RUNTIME-CONFIG-1.0.0",
      artifactMode: "research-http",
      demoClock: { enabled: false, scenarioId: "S005", mode: "LIVE", appliesTo: ["scenario-context", "directional-reset", "M01", "M02", "M03", "M04", "M05", "M06"] },
      sideEffectPolicy: { externalDispatch: false, actionRequest: false, reminder: false, approval: false, todo: false, tradeInstruction: false }
    },
    entities: [
      { id: "F-A", name: "基金 A", balance: "混合二级债基", cost: "+0.82%", loans: "前 27%", rule: "需复核", owner: "管理人甲（脱敏）" },
      { id: "F-B", name: "基金 B", balance: "中长期纯债基金", cost: "+0.51%", loans: "前 39%", rule: "符合范围", owner: "管理人乙（脱敏）" },
      { id: "F-C", name: "基金 C", balance: "混合一级债基", cost: "+0.38%", loans: "观察期不足", rule: "无法判断", owner: "管理人丙（脱敏）" },
      { id: "F-D", name: "基金 D", balance: "短期纯债基金", cost: "+0.14%", loans: "前 45%", rule: "符合范围", owner: "管理人丁（脱敏）" },
      { id: "F-E", name: "基金 E", balance: "利率债", cost: "+0.08%", loans: "前 31%", rule: "符合范围", owner: "管理人戊（脱敏）" }
    ],
    groupMetrics: [
      { label: "评价对象", value: "15", unit: "只候选" },
      { label: "市场同类样本", value: "1,284", unit: "只" },
      { label: "池内选择差异", value: "+0.42", unit: "百分点" },
      { label: "产品 TWR", value: "+7.40", unit: "%" },
      { label: "夏普比率", value: "1.38", unit: "" },
      { label: "最大回撤", value: "-1.86", unit: "%" }
    ],
    report: { id: "S005-RESEARCH-DRAFT-20260717", title: "金融产品投后评价研究草稿", formats: ["HTML"] }
  };
})(typeof window !== "undefined" ? window : globalThis);
