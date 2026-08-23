(function () {
  "use strict";

  const departments = [
    { id: "SB", name: "设备管理部", accent: "blue" },
    { id: "JS", name: "技术部", accent: "violet" },
    { id: "AQ", name: "安全运行部", accent: "orange" }
  ];

  const sourceManifest = [
    {
      id: "SRC-2024-ACTUAL",
      logicalSourceId: "DS-ACTUAL-EXECUTION",
      logicalSourceName: "实际执行明细",
      snapshotKey: "FY2024",
      snapshotLabel: "2024年度快照",
      file: "2024年实际执行.xlsx",
      members: ["Sheet"],
      range: "Sheet!A1:L162",
      version: "data_v5",
      asOf: "2024-12-31",
      rows: 161,
      use: "2024实际执行、年末计提",
      sensitivity: "内部财务中高敏感",
      sha256: "5064556a172d2e91dbc33454987ae12caab2849f00a2888c6646559b50ba92a7"
    },
    {
      id: "SRC-2025-ACTUAL",
      logicalSourceId: "DS-ACTUAL-EXECUTION",
      logicalSourceName: "实际执行明细",
      snapshotKey: "FY2025",
      snapshotLabel: "2025年度快照",
      file: "2025年实际执行.xlsx",
      members: ["Sheet"],
      range: "Sheet!A1:L204",
      version: "data_v5",
      asOf: "2025-12-31",
      rows: 203,
      use: "2025实际执行、次年确认",
      sensitivity: "内部财务中高敏感",
      sha256: "2714661fa34651bc01332fa6f58c2f0259357385ac5ef77a2dacaae6b1eb69d2"
    },
    {
      id: "SRC-2024-BUDGET",
      logicalSourceId: "DS-APPROVED-BUDGET",
      logicalSourceName: "预算下达明细",
      snapshotKey: "FY2024-APPROVED",
      snapshotLabel: "2024年度最终批准预算快照",
      file: "2024年预算下达明细.xlsx",
      members: ["Sheet"],
      range: "Sheet!A1:I31",
      version: "FY2024-APPROVED-FINAL-v1",
      asOf: "2024-01-15",
      rows: 30,
      use: "2024最终批准预算",
      sensitivity: "内部财务中高敏感",
      sha256: "29b6a7060f504ba8c96c019e0cb9a295c734e02e6afc70f86d59d628590d3438"
    },
    {
      id: "SRC-2025-BUDGET",
      logicalSourceId: "DS-APPROVED-BUDGET",
      logicalSourceName: "预算下达明细",
      snapshotKey: "FY2025-APPROVED",
      snapshotLabel: "2025年度最终批准预算快照",
      file: "2025年预算下达明细.xlsx",
      members: ["Sheet"],
      range: "Sheet!A1:I31",
      version: "FY2025-APPROVED-FINAL-v1",
      asOf: "2025-01-15",
      rows: 30,
      use: "2025最终批准预算",
      sensitivity: "内部财务中高敏感",
      sha256: "e194594c61cb27a5c4355a6e8f75d9c463ccf1686e0def5715921eca8d137c79"
    },
    {
      id: "SRC-2025-SUBMISSION",
      logicalSourceId: "DS-INITIAL-SUBMISSION",
      logicalSourceName: "预算申报明细",
      snapshotKey: "FY2025-INITIAL",
      snapshotLabel: "2025年度初始申报快照",
      file: "2025年预算申报明细汇总.xlsx",
      members: ["收入成本预算汇总表", "市场项目预算明细", "部门公共费用明细", "技术配置"],
      range: "4个逻辑成员",
      version: "FY2025-INITIAL-SUBMISSION-v1",
      asOf: "2024-10-31",
      rows: 64,
      use: "2025部门最初申报",
      sensitivity: "内部财务中高敏感",
      sha256: "850af12aaece5fe14adb7c2609018a618e64018fc36724ff7f5f3ea3b51e441a"
    },
    {
      id: "SRC-2026-SUBMISSION",
      logicalSourceId: "DS-INITIAL-SUBMISSION",
      logicalSourceName: "预算申报明细",
      snapshotKey: "FY2026-INITIAL",
      snapshotLabel: "2026年度初始申报快照",
      file: "2026年预算申报明细汇总.xlsx",
      members: ["收入成本预算汇总表", "市场项目预算明细", "部门公共费用明细", "技术配置"],
      range: "4个逻辑成员",
      version: "FY2026-INITIAL-SUBMISSION-v1",
      asOf: "2025-10-31",
      rows: 64,
      use: "2026部门最初申报",
      sensitivity: "内部财务中高敏感",
      sha256: "85f0ce556faad8d0ef51b3bf7a5f49dc73508321d75f419db6f6bafd8427827f"
    },
    {
      id: "SRC-2025-COMMITMENT",
      logicalSourceId: "DS-PROJECT-COMMITMENT",
      logicalSourceName: "项目预算占用",
      snapshotKey: "FY2025",
      snapshotLabel: "2025年度占用快照",
      file: "2025年预算占用.XLSX",
      members: ["Sheet"],
      range: "Sheet!A1:L109",
      version: "data_v5",
      asOf: "2025-12-31",
      rows: 108,
      use: "PR/PO占用及释放事件；源覆盖3项目",
      sensitivity: "内部采购财务中高敏感",
      sha256: "af94789f3ac8238ffd076c9006f5a29a096978ce182284efd5478994f249d20a"
    },
    {
      id: "SRC-PROJECT-USE",
      logicalSourceId: "DS-PROJECT-USE",
      logicalSourceName: "项目预算使用表",
      snapshotKey: "ASOF-2025-12-31",
      snapshotLabel: "2025-12-31确认快照",
      file: "项目预算使用情况表.xlsx",
      members: ["Sheet"],
      range: "Sheet!A1:D22",
      version: "derived-2025-12-31",
      asOf: "2025-12-31",
      rows: 21,
      use: "项目立项金额及源已使用值",
      sensitivity: "内部项目财务中高敏感",
      sha256: "36bbb71e67f995ce815703528b9cb1a062df02caa4f816581369a00b7b536d1c"
    }
  ];

  const dataSources = [
    { id: "DS-ACTUAL-EXECUTION", name: "实际执行明细", sourceType: "财务执行明细", connection: "手工工作簿", purpose: "形成2024/2025实际执行、计提与跨期确认事实", snapshotIds: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL"], snapshotCount: 2, years: [2024, 2025], sensitivity: "内部财务中高敏感" },
    { id: "DS-APPROVED-BUDGET", name: "预算下达明细", sourceType: "最终批准预算", connection: "手工工作簿", purpose: "形成2024/2025最终批准预算，不被场景Action覆盖", snapshotIds: ["SRC-2024-BUDGET", "SRC-2025-BUDGET"], snapshotCount: 2, years: [2024, 2025], sensitivity: "内部财务中高敏感" },
    { id: "DS-INITIAL-SUBMISSION", name: "预算申报明细", sourceType: "部门初始申报", connection: "手工工作簿", purpose: "形成2025/2026部门最初申报及合理性评价输入", snapshotIds: ["SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION"], snapshotCount: 2, years: [2025, 2026], sensitivity: "内部财务中高敏感" },
    { id: "DS-PROJECT-COMMITMENT", name: "项目预算占用", sourceType: "采购占用事件", connection: "手工工作簿", purpose: "形成PR/PO占用、释放和年末集中度事实", snapshotIds: ["SRC-2025-COMMITMENT"], snapshotCount: 1, years: [2025], sensitivity: "内部采购财务中高敏感" },
    { id: "DS-PROJECT-USE", name: "项目预算使用表", sourceType: "项目预算原子事实", connection: "手工工作簿", purpose: "形成项目立项金额与源已使用值；实际、计提和占用从其他来源回链", snapshotIds: ["SRC-PROJECT-USE"], snapshotCount: 1, years: [2025], sensitivity: "内部项目财务中高敏感" }
  ].map(function (source) {
    return { ...source, snapshots: source.snapshotIds.map(function (snapshotId) { return sourceManifest.find(function (item) { return item.id === snapshotId; }); }) };
  });

  const dataAssets = [
    {
      assetId: "S002-BUDGET-EXECUTION-ASSET",
      name: "预算编制与执行数据资产",
      version: "S002-BUDGET-EXEC-v1",
      asOf: "2025-12-31",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"],
      memberIds: ["MEM-S002-BUDGET-SUBJECT", "MEM-S002-BUDGET-VERSION", "MEM-S002-BUDGET-ACCOUNT", "MEM-S002-ACTUAL-VOUCHER"],
      internalRelationIds: ["REL-LINK-S002-VERSION-SUBJECT", "REL-LINK-S002-VERSION-ACCOUNT", "REL-LINK-S002-VOUCHER-SUBJECT", "REL-LINK-S002-VOUCHER-ACCOUNT"],
      crossAssetRelationIds: ["REL-LINK-S002-VOUCHER-PROJECT"],
      relationshipScope: { internal: 4, crossAsset: 1 },
      purpose: "支撑预算执行、差异、初始申报、跨年趋势与单位对比",
      owner: "M02 数据工程"
    },
    {
      assetId: "S002-PROJECT-OCCUPANCY-ASSET",
      name: "项目预算占用与余额数据资产",
      version: "S002-PROJECT-OCC-v1",
      asOf: "2025-12-31",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"],
      memberIds: ["MEM-S002-PROJECT-OCCUPANCY", "MEM-S002-PURCHASE-INITIATION", "MEM-S002-SUPPLIER"],
      internalRelationIds: ["REL-LINK-S002-PURCHASE-PROJECT", "REL-LINK-S002-PURCHASE-SUPPLIER"],
      crossAssetRelationIds: ["REL-LINK-S002-PROJECT-VERSION"],
      relationshipScope: { internal: 2, crossAsset: 1 },
      purpose: "支撑项目可用立项余额、净在途占用、采购集中度与供应商价格复核",
      owner: "M02 数据工程"
    }
  ];

  const dataPipelines = [
    {
      pipelineId: "S002-PIPE-BUDGET-v1",
      name: "预算编制与执行标准化管道",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"],
      targetAssetVersion: "S002-BUDGET-EXEC-v1",
      stages: ["锁定6个来源快照", "期间/日期修正映射", "主体·期间·科目·版本·情景标准化", "20项数据质量门", "发布数据资产"],
      boundary: "只处理来源、修正映射、质量和资产版本；不计算业务阈值或Rule。"
    },
    {
      pipelineId: "S002-PIPE-PROJECT-v1",
      name: "项目预算余额与采购占用标准化管道",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"],
      targetAssetVersion: "S002-PROJECT-OCC-v1",
      stages: ["锁定4个逻辑源的6个快照", "项目与采购稳定键校验", "实际/计提与技术配置事实回链", "占用事件带符号标准化并保留原子值", "发布数据资产"],
      boundary: "只形成项目、实际/计提、采购事件与供应商可比键原子事实；余额、净在途、价格倍率及Rule阈值归M01。"
    }
  ];

  // Read-only reconciliation captured from the eight byte-identical source
  // workbooks. Runtime business values are intentionally not rewritten here:
  // where the demo processing layer differs from the raw workbook aggregate,
  // the delta and marker are retained so M03/M06 cannot present it as a
  // directly sourced production fact.
  const sourceReconciliation = {
    schemaVersion: "S002-SOURCE-RECONCILIATION-v1",
    auditedAt: "2026-08-15",
    lineage: {
      sourceFiles: 8,
      logicalSources: 5,
      snapshots: 8,
      logicalMembers: 14,
      assetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
      mapping: [
        { assetVersion: "S002-BUDGET-EXEC-v1", logicalSourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"], snapshotCount: 6 },
        { assetVersion: "S002-PROJECT-OCC-v1", logicalSourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"], snapshotCount: 6 }
      ]
    },
    portfolio2025: {
      approvedExpenseBudget: { sourceAmount: 1097.70, scenarioAmount: 1097.70, delta: 0, marker: "SOURCE", sourceRefs: ["SRC-2025-BUDGET"] },
      actualExpense: { sourceWorkbookAmount: 981.5595, scenarioAmount: 861.7265, displayAmount: 861.73, delta: -119.8330, marker: "MIXED_SOURCE_AND_DEMO_MARKERS", sourceRefs: ["SRC-2025-ACTUAL"], basis: "场景加工结果；包含授权修正/派生冲回与演示合理化，不等于源工作簿直接求和。" },
      expenseExecutionRate: { exact: 0.7850291519, displayPercent: 78.50, marker: "DERIVED", formula: "861.7265 / 1097.70" },
      actualRevenue: { sourceWorkbookAmount: 1159.022229, scenarioAmount: 1159.0222, delta: -0.000029, marker: "SOURCE", basis: "源负号收益展示转正，并按四位小数展示。" },
      costToRevenue: { exact: 0.7434943869, displayPercent: 74.35, marker: "DERIVED", formula: "861.7265 / 1159.0222" },
      grossMargin: { exact: 0.2565056131, displayPercent: 25.65, marker: "DERIVED", formula: "1 - 0.7434943869" }
    },
    annualActualExpense: [
      { year: 2024, department: "设备管理部", sourceWorkbookAmount: 368.331233, scenarioAmount: 395.5392, delta: 27.207967, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      { year: 2024, department: "技术部", sourceWorkbookAmount: 321.579233, scenarioAmount: 361.6323, delta: 40.053067, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      { year: 2024, department: "安全运行部", sourceWorkbookAmount: 330.5518, scenarioAmount: 377.7032, delta: 47.1514, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      { year: 2025, department: "设备管理部", sourceWorkbookAmount: 306.7382, scenarioAmount: 255.6557, delta: -51.0825, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      { year: 2025, department: "技术部", sourceWorkbookAmount: 328.7767, scenarioAmount: 295.7507, delta: -33.0260, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" },
      { year: 2025, department: "安全运行部", sourceWorkbookAmount: 346.0446, scenarioAmount: 310.3201, delta: -35.7245, marker: "MIXED_SOURCE_AND_DEMO_MARKERS" }
    ],
    procurement2025: {
      positivePr: { sourceAmount: 273.09, decemberSourceAmount: 23.45, decemberShare: 0.085869, marker: "SOURCE", sourceRefs: ["SRC-2025-COMMITMENT"] },
      netInTransit: { sourceAmount: 163.38, decemberSourceAmount: 23.45, decemberShare: 0.14353, marker: "SOURCE", sourceRefs: ["SRC-2025-COMMITMENT"] }
    },
    projectBalance: {
      projectCount: 21,
      sourceLaunchAmount: 4317.00,
      sourceUsedAmount: 3080.00,
      scenarioAvailableBalance: 2157.0187,
      negativeProjectId: "PRJ-AQ-概率-2025-002",
      negativeBalance: -20.5038,
      marker: "DERIVED",
      basis: "立项金额来自SRC-PROJECT-USE；实际、净在途与计提按确认快照重算。只有3个项目具备源占用覆盖，其余项目占用为IMPUTED_ZERO。"
    },
    disclaimer: "SOURCE表示可由工作簿直接复核；DERIVED表示按已发布公式计算；MIXED_SOURCE_AND_DEMO_MARKERS表示包含演示加工、补全或修正，不代表生产数据验收。"
  };

  const annualFacts = [
    { year: 2024, department: "设备管理部", actualRevenue: 250, actualExpense: 395.5392, sourceActualExpense: 368.331233, scenarioAdjustmentAmount: 27.207967, approvedRevenueBudget: 357, approvedExpenseBudget: 469.5, revenueRate: 0.7003, expenseRate: 0.8425, costToRevenue: 1.5822, grossMargin: -0.5822, revenueYoY: null, expenseYoY: null, trend: "基期", note: "设备项目地域相对集中，差旅占比较低；设备物料和技术配置占比较高。", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { actualRevenue: "SOURCE", actualExpense: "MIXED_SOURCE_AND_DEMO_MARKERS", approvedBudget: "SOURCE", calculatedMetrics: "DERIVED", trendExplanation: "SYNTHETIC_FOR_DEMO" } },
    { year: 2024, department: "技术部", actualRevenue: 431, actualExpense: 361.6323, sourceActualExpense: 321.579233, scenarioAdjustmentAmount: 40.053067, approvedRevenueBudget: 530, approvedExpenseBudget: 401.3, revenueRate: 0.8132, expenseRate: 0.9012, costToRevenue: 0.8391, grossMargin: 0.1609, revenueYoY: null, expenseYoY: null, trend: "基期", note: "多研究专题并行，外部技术配置和跨点协同形成较高业务支持及差旅需求。", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { actualRevenue: "SOURCE", actualExpense: "MIXED_SOURCE_AND_DEMO_MARKERS", approvedBudget: "SOURCE", calculatedMetrics: "DERIVED", trendExplanation: "SYNTHETIC_FOR_DEMO" } },
    { year: 2024, department: "安全运行部", actualRevenue: 540, actualExpense: 377.7032, sourceActualExpense: 330.5518, scenarioAdjustmentAmount: 47.1514, approvedRevenueBudget: 398, approvedExpenseBudget: 301, revenueRate: 1.3568, expenseRate: 1.2548, costToRevenue: 0.6995, grossMargin: 0.3005, revenueYoY: null, expenseYoY: null, trend: "基期", note: "现场核查、灾害防护与安全评估跨区域开展，差旅强度高于设备管理部。", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { actualRevenue: "SOURCE", actualExpense: "MIXED_SOURCE_AND_DEMO_MARKERS", approvedBudget: "SOURCE", calculatedMetrics: "DERIVED", trendExplanation: "SYNTHETIC_FOR_DEMO" } },
    { year: 2025, department: "设备管理部", actualRevenue: 488.9444, actualExpense: 255.6557, sourceActualExpense: 306.7382, scenarioAdjustmentAmount: -51.0825, approvedRevenueBudget: 500, approvedExpenseBudget: 404.5, revenueRate: 0.9779, expenseRate: 0.6320, costToRevenue: 0.5229, grossMargin: 0.4771, revenueYoY: 0.9558, expenseYoY: -0.3537, trend: "收入确认期抬升", note: "2025设备维护框架项目集中进入收入确认期，收入基数抬升；成本随交付增长但仍受预算约束。", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { actualRevenue: "SOURCE", actualExpense: "MIXED_SOURCE_AND_DEMO_MARKERS", approvedBudget: "SOURCE", calculatedMetrics: "DERIVED", trendExplanation: "SYNTHETIC_FOR_DEMO" } },
    { year: 2025, department: "技术部", actualRevenue: 394.55, actualExpense: 295.7507, sourceActualExpense: 328.7767, scenarioAdjustmentAmount: -33.0260, approvedRevenueBudget: 400, approvedExpenseBudget: 379.3, revenueRate: 0.9864, expenseRate: 0.7797, costToRevenue: 0.7496, grossMargin: 0.2504, revenueYoY: -0.0846, expenseYoY: -0.1822, trend: "组合交付", note: "2024高强度研究阶段结束，2025转为多项目组合交付，收入小幅回落、费用结构更分散。", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { actualRevenue: "SOURCE", actualExpense: "MIXED_SOURCE_AND_DEMO_MARKERS", approvedBudget: "SOURCE", calculatedMetrics: "DERIVED", trendExplanation: "SYNTHETIC_FOR_DEMO" } },
    { year: 2025, department: "安全运行部", actualRevenue: 275.5278, actualExpense: 310.3201, sourceActualExpense: 346.0446, scenarioAdjustmentAmount: -35.7245, approvedRevenueBudget: 300, approvedExpenseBudget: 313.9, revenueRate: 0.9184, expenseRate: 0.9886, costToRevenue: 1.1263, grossMargin: -0.1263, revenueYoY: -0.4898, expenseYoY: -0.1784, trend: "常态化组合", note: "2024一次性安全评估波次完成，2025回归常态化项目组合，收入与费用同比回落。", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { actualRevenue: "SOURCE", actualExpense: "MIXED_SOURCE_AND_DEMO_MARKERS", approvedBudget: "SOURCE", calculatedMetrics: "DERIVED", trendExplanation: "SYNTHETIC_FOR_DEMO" } }
  ];

  const submissionFacts = [
    { year: 2025, department: "设备管理部", revenue: 677, projectCost: 179.14, techCost: 40.53, projectCostWithTech: 219.67, publicExpense: 5, totalCost: 224.67, sourceReportedCost: 184.14, scenarioOverlayAmount: 40.53, costToRevenue: 0.3319, grossMargin: 0.6681, snapshot: "2024-10-31", version: "FY2025-INITIAL-SUBMISSION-v1", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { sourceValues: "SOURCE", scenarioCostAssembly: "DERIVED", calculatedMetrics: "DERIVED" } },
    { year: 2025, department: "技术部", revenue: 546.3, projectCost: 888.57, techCost: 801.58, projectCostWithTech: 1690.15, publicExpense: 5, totalCost: 1695.15, sourceReportedCost: 893.56, scenarioOverlayAmount: 801.59, costToRevenue: 3.1030, grossMargin: -2.1030, snapshot: "2024-10-31", version: "FY2025-INITIAL-SUBMISSION-v1", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { sourceValues: "SOURCE", scenarioCostAssembly: "DERIVED", calculatedMetrics: "DERIVED" } },
    { year: 2025, department: "安全运行部", revenue: 406.8, projectCost: 378.52, techCost: 279.5, projectCostWithTech: 658.02, publicExpense: 5, totalCost: 663.02, sourceReportedCost: 383.52, scenarioOverlayAmount: 279.5, costToRevenue: 1.6298, grossMargin: -0.6298, snapshot: "2024-10-31", version: "FY2025-INITIAL-SUBMISSION-v1", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { sourceValues: "SOURCE", scenarioCostAssembly: "DERIVED", calculatedMetrics: "DERIVED" } },
    { year: 2026, department: "设备管理部", revenue: 746.6, projectCost: 293.604, techCost: 37.58, projectCostWithTech: 331.184, publicExpense: 5.22, totalCost: 336.404, sourceReportedCost: 298.604, scenarioOverlayAmount: 37.8, costToRevenue: 0.4506, grossMargin: 0.5494, snapshot: "2025-10-31", version: "FY2026-INITIAL-SUBMISSION-v1", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { sourceValues: "SOURCE", scenarioCostAssembly: "DERIVED", publicExpense: "SYNTHETIC_FOR_DEMO", calculatedMetrics: "DERIVED" } },
    { year: 2026, department: "技术部", revenue: 611.5, projectCost: 964.95, techCost: 795.55, projectCostWithTech: 1760.5, publicExpense: 5.44, totalCost: 1765.94, sourceReportedCost: 969.94, scenarioOverlayAmount: 796.0, costToRevenue: 2.8879, grossMargin: -1.8879, snapshot: "2025-10-31", version: "FY2026-INITIAL-SUBMISSION-v1", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { sourceValues: "SOURCE", scenarioCostAssembly: "DERIVED", publicExpense: "SYNTHETIC_FOR_DEMO", calculatedMetrics: "DERIVED" } },
    { year: 2026, department: "安全运行部", revenue: 455.2, projectCost: 472.598, techCost: 289.8, projectCostWithTech: 762.398, publicExpense: 5.31, totalCost: 767.708, sourceReportedCost: 477.598, scenarioOverlayAmount: 290.11, costToRevenue: 1.6865, grossMargin: -0.6865, snapshot: "2025-10-31", version: "FY2026-INITIAL-SUBMISSION-v1", dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS", fieldMarkers: { sourceValues: "SOURCE", scenarioCostAssembly: "DERIVED", publicExpense: "SYNTHETIC_FOR_DEMO", calculatedMetrics: "DERIVED" } }
  ];

  const commitmentCoveredProjectIds = new Set([
    "PRJ-SB-设备-2025-002",
    "PRJ-JS-热能-2025-002",
    "PRJ-AQ-概率-2025-002"
  ]);

  const projects = [
    ["PRJ-SB-设备-2024-001", "设备管理部", "设备维护", 567, 240.9912, 0, 0, 326.0088, "可用", 397],
    ["PRJ-SB-设备-2025-002", "设备管理部", "设备维护", 583, 211.9887, 49.04, 0, 321.9713, "可用", 407],
    ["PRJ-SB-设备-2025-003", "设备管理部", "设备维护", 679, 198.2151, 0, 0, 480.7849, "可用", 596],
    ["PRJ-JS-热能-2024-001", "技术部", "热能动力研究", 160, 70.5068, 0, 0, 89.4932, "可用", 90],
    ["PRJ-JS-热能-2025-002", "技术部", "热能动力研究", 165, 78.7408, 52.25, 0, 34.0092, "可用", 163],
    ["PRJ-JS-热能-2025-003", "技术部", "热能动力研究", 180, 64.3665, 0, 0, 115.6335, "可用", 78],
    ["PRJ-JS-经验-2024-001", "技术部", "经验反馈改进", 177, 88.0668, 0, 0, 88.9332, "可用", 153],
    ["PRJ-JS-经验-2025-002", "技术部", "经验反馈改进", 156, 79.4861, 0, 0, 76.5139, "可用", 79],
    ["PRJ-JS-经验-2025-003", "技术部", "经验反馈改进", 134, 63.9299, 0, 0, 70.0701, "可用", 112],
    ["PRJ-JS-新技-2024-001", "技术部", "新技术应用", 154, 70.7961, 0, 0, 83.2039, "可用", 117],
    ["PRJ-JS-新技-2025-002", "技术部", "新技术应用", 222, 77.538, 0, 0, 144.462, "可用", 173],
    ["PRJ-JS-新技-2025-003", "技术部", "新技术应用", 111, 63.9521, 0, 0, 47.0479, "可用", 84],
    ["PRJ-AQ-概率-2024-001", "安全运行部", "概率安全分析", 105, 75.0204, 0, 0, 29.9796, "可用", 49],
    ["PRJ-AQ-概率-2025-002", "安全运行部", "概率安全分析", 124, 82.4138, 62.09, 0, -20.5038, "超立项余额", 103],
    ["PRJ-AQ-概率-2025-003", "安全运行部", "概率安全分析", 94, 70.7148, 0, 0, 23.2852, "可用", 36],
    ["PRJ-AQ-灾害-2024-001", "安全运行部", "灾害防护", 95, 74.3752, 0, 0, 20.6248, "可用", 94],
    ["PRJ-AQ-灾害-2025-002", "安全运行部", "灾害防护", 125, 76.8498, 0, 0, 48.1502, "可用", 56],
    ["PRJ-AQ-灾害-2025-003", "安全运行部", "灾害防护", 138, 84.2229, 0, 0, 53.7771, "可用", 96],
    ["PRJ-AQ-安全-2024-001", "安全运行部", "安全评估", 116, 85.8326, 0, 0, 30.1674, "可用", 67],
    ["PRJ-AQ-安全-2025-002", "安全运行部", "安全评估", 98, 69.0726, 0, 0, 28.9274, "可用", 68],
    ["PRJ-AQ-安全-2025-003", "安全运行部", "安全评估", 134, 69.5211, 0, 0, 64.4789, "可用", 62]
  ].map(function (row) {
    const hasCommitmentSourceCoverage = commitmentCoveredProjectIds.has(row[0]);
    const recalculatedUsed = Number((row[4] + row[5] + row[6]).toFixed(4));
    return {
      projectId: row[0], department: row[1], name: row[2], launchAmount: row[3], approvedAmount: row[3], actualUsed: row[4], netInTransit: row[5], accrual: row[6], availableBalance: row[7], status: row[8],
      sourceUsedAmount: row[9],
      recalculatedUsed: recalculatedUsed,
      usedAmountVariance: Number((recalculatedUsed - row[9]).toFixed(4)),
      usedAmountRecalculationBasis: "确认快照口径：实际 + 净在途占用 + 未结计提",
      usedBreakdown: { actual: row[4], commitment: row[5], accrual: row[6] },
      dataMarker: "DERIVED",
      synthetic: false,
      containsSyntheticInputs: true,
      commitmentSourceCoverage: hasCommitmentSourceCoverage ? "SOURCE_COVERED" : "NOT_COVERED",
      netInTransitDataMarker: hasCommitmentSourceCoverage ? "SOURCE" : "IMPUTED_ZERO"
    };
  });

  const occupancy = {
    eventCount: 108,
    coveredProjects: 3,
    totalPositivePr: 273.09,
    decemberPositivePr: 23.45,
    decemberShare: 0.085869,
    budgetOccupancyDecemberAmount: 23.45,
    budgetOccupancyDecemberShare: 0.14353,
    budgetOccupancyDenominator: "全年净在途占用",
    netInTransit: 163.38,
    sourceCoverage: "3/21项目",
    totalsDataMarker: "SOURCE",
    calculationBasis: {
      totalPositivePr: "SRC-2025-COMMITMENT中值类型=购买申请且支付金额>0的全年合计",
      decemberPositivePr: "SRC-2025-COMMITMENT中2025-012正向购买申请合计",
      netInTransit: "SRC-2025-COMMITMENT全部PR/PO占用与释放事件带符号合计",
      budgetOccupancyDecemberShare: "23.45 / 163.38"
    },
    examplesDataMarker: "SYNTHETIC_FOR_DEMO",
    byProject: [
      { department: "设备管理部", projectId: "PRJ-SB-设备-2025-002", netInTransit: 49.04, positivePr: 85.57, decemberShare: 0.108566, decemberNetInTransit: 9.29, budgetOccupancyDecemberShare: 0.189437, dataMarker: "SOURCE" },
      { department: "技术部", projectId: "PRJ-JS-热能-2025-002", netInTransit: 52.25, positivePr: 93.99, decemberShare: 0.069688, decemberNetInTransit: 6.55, budgetOccupancyDecemberShare: 0.125359, dataMarker: "SOURCE" },
      { department: "安全运行部", projectId: "PRJ-AQ-概率-2025-002", netInTransit: 62.09, positivePr: 93.53, decemberShare: 0.081364, decemberNetInTransit: 7.61, budgetOccupancyDecemberShare: 0.122564, dataMarker: "SOURCE" }
    ],
    examples: [
      { id: "OCC-2025-001", type: "PR_POSITIVE", month: "2025-02", amount: 27.50, projectId: "PRJ-SB-设备-2025-002", department: "设备管理部", pr: "PR-2502-017", po: "PO-2502-014", dataMarker: "SYNTHETIC_FOR_DEMO", synthetic: true },
      { id: "OCC-2025-014", type: "PO_RELEASE", month: "2025-04", amount: -8.20, projectId: "PRJ-SB-设备-2025-002", department: "设备管理部", pr: "PR-2502-017", po: "PO-2504-004", dataMarker: "SYNTHETIC_FOR_DEMO", synthetic: true },
      { id: "OCC-2025-037", type: "PR_POSITIVE", month: "2025-06", amount: 52.25, projectId: "PRJ-JS-热能-2025-002", department: "技术部", pr: "PR-2506-023", po: "PO-2506-021", dataMarker: "SYNTHETIC_FOR_DEMO", synthetic: true },
      { id: "OCC-2025-081", type: "PR_POSITIVE", month: "2025-12", amount: 12.05, projectId: "PRJ-SB-设备-2025-002", department: "设备管理部", pr: "PR-2512-088", po: null, dataMarker: "SYNTHETIC_FOR_DEMO", synthetic: true },
      { id: "OCC-2025-082", type: "PR_POSITIVE", month: "2025-12", amount: 11.40, projectId: "PRJ-AQ-概率-2025-002", department: "安全运行部", pr: "PR-2512-089", po: null, dataMarker: "SYNTHETIC_FOR_DEMO", synthetic: true },
      { id: "OCC-2025-094", type: "PO_RELEASE", month: "2025-12", amount: -4.10, projectId: "PRJ-SB-设备-2025-002", department: "设备管理部", pr: "PR-2502-017", po: "PO-2512-014", dataMarker: "SYNTHETIC_FOR_DEMO", synthetic: true }
    ]
  };

  const expenseSubjects = ["项目实施成本", "技术配置费", "差旅及业务支持费", "公共费用"];
  const expensePeriods = [
    { id: "Q1", name: "一季度", share: 0.20 },
    { id: "Q2", name: "二季度", share: 0.25 },
    { id: "Q3", name: "三季度", share: 0.25 },
    { id: "Q4", name: "四季度", share: 0.30 }
  ];
  const subjectSharesByDepartment = {
    "设备管理部": [0.50, 0.20, 0.20, 0.10],
    "技术部": [0.25, 0.50, 0.15, 0.10],
    "安全运行部": [0.30, 0.25, 0.35, 0.10]
  };

  function round4(value) { return Number(Number(value).toFixed(4)); }

  function buildExpenseDetails() {
    const details = [];
    // The source files provide annual department totals, not a subject×quarter
    // ledger.  Keep the annual totals exactly conserved while using a stable,
    // non-uniform demonstration allocation for the drill-down rows.  This
    // avoids implying that every quarter has the same execution rate as the
    // department aggregate; each visible row is still recomputed as
    // actual ÷ final approved budget by the report-center adapter.
    const periodActualFactors = [0.84, 1.06, 1.12, 0.96];
    const subjectActualFactors = [1.08, 0.94, 1.05, 0.88];
    annualFacts.forEach(function (fact) {
      const departmentProjects = projects.filter(function (project) {
        return project.department === fact.department && project.projectId.includes(`-${fact.year}-`);
      });
      const subjectShares = subjectSharesByDepartment[fact.department];
      let budgetRemaining = fact.approvedExpenseBudget;
      let actualRemaining = fact.actualExpense;
      const actualWeights = expenseSubjects.flatMap(function (_, subjectIndex) {
        return expensePeriods.map(function (period, periodIndex) {
          const budgetWeight = subjectShares[subjectIndex] * period.share;
          return budgetWeight * subjectActualFactors[subjectIndex] * periodActualFactors[periodIndex];
        });
      });
      const actualWeightTotal = actualWeights.reduce((sum, value) => sum + value, 0);
      let actualWeightIndex = 0;
      expenseSubjects.forEach(function (subject, subjectIndex) {
        expensePeriods.forEach(function (period, periodIndex) {
          const isLast = subjectIndex === expenseSubjects.length - 1 && periodIndex === expensePeriods.length - 1;
          const weight = subjectShares[subjectIndex] * period.share;
          const budget = isLast ? round4(budgetRemaining) : round4(fact.approvedExpenseBudget * weight);
          const normalizedActualWeight = actualWeights[actualWeightIndex] / actualWeightTotal;
          const actual = isLast ? round4(actualRemaining) : round4(fact.actualExpense * normalizedActualWeight);
          budgetRemaining = round4(budgetRemaining - budget);
          actualRemaining = round4(actualRemaining - actual);
          actualWeightIndex += 1;
          const project = departmentProjects.length ? departmentProjects[(subjectIndex + periodIndex) % departmentProjects.length] : null;
          details.push({
            id: `EXP-${fact.year}-${fact.department}-${subjectIndex + 1}-${period.id}`,
            year: fact.year,
            department: fact.department,
            subject: subject,
            period: period.id,
            periodName: period.name,
            projectId: project ? project.projectId : null,
            approvedBudget: budget,
            actual: actual,
            variance: round4(actual - budget),
            executionRate: budget ? actual / budget : null,
            dataMarker: "SYNTHETIC_FOR_DEMO",
            derivation: "年度×部门总额可回链；科目×季度采用守恒且非均匀的演示分配，明细执行率按本行实际费用÷本行最终批准预算重算，不代表来源工作簿原始明细。"
          });
        });
      });
    });
    return details;
  }

  const expenseDetails = buildExpenseDetails();

  const travelFacts = [
    { year: 2024, department: "设备管理部", tripCount: 18, personDays: 74, amount: 14.80, averagePerTrip: 0.8222, topDestination: "华东设备现场", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { year: 2024, department: "技术部", tripCount: 39, personDays: 156, amount: 37.50, averagePerTrip: 0.9615, topDestination: "华北研究协作点", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { year: 2024, department: "安全运行部", tripCount: 47, personDays: 188, amount: 42.60, averagePerTrip: 0.9064, topDestination: "跨区域核查现场", dataMarker: "SYNTHETIC_FOR_DEMO" },
    { year: 2025, department: "设备管理部", tripCount: 22, personDays: 88, amount: 18.20, averagePerTrip: 0.8273, topDestination: "华东设备现场", dataMarker: "DERIVED" },
    { year: 2025, department: "技术部", tripCount: 34, personDays: 137, amount: 31.90, averagePerTrip: 0.9382, topDestination: "多项目交付现场", dataMarker: "DERIVED" },
    { year: 2025, department: "安全运行部", tripCount: 43, personDays: 174, amount: 39.40, averagePerTrip: 0.9163, topDestination: "安全评估现场", dataMarker: "DERIVED" }
  ];

  const accrualPairs = [5.50, 4.20, 3.85, 3.60, 3.25, 2.90, 2.65, 2.40, 2.10, 1.85, 1.60, 1.35, 1.10, 0.85].map(function (amount, index) {
    const project = projects[index % projects.length];
    return {
      pairId: `ACCRUAL-PAIR-${String(index + 1).padStart(2, "0")}`,
      department: project.department,
      projectId: project.projectId,
      accrualVoucher: `FY2024-ACCR-${String(index + 1).padStart(3, "0")}`,
      settlementVoucher: `FY2025-SETTLE-${String(index + 1).padStart(3, "0")}`,
      accrualAmount: amount,
      settledAmount: amount,
      variance: 0,
      status: "已配对无差异",
      dataMarker: "DERIVED_REVERSAL"
    };
  });

  // 权威来源：2025/2026 初始预算申报工作簿的“技术配置”成员。
  // 每行保留源净额和服务人月；人月成本只由净额÷人月派生，不再使用单价/中位价。
  const supplierBenchmarkSourceRows = [
    [2025, "设备管理部", "PRJ-SB-设备-2024-001", "初级", "供应商2", 13.70, 12, 0.06],
    [2025, "设备管理部", "PRJ-SB-设备-2025-002", "初级", "供应商2", 13.36, 12, 0.06],
    [2025, "设备管理部", "PRJ-SB-设备-2025-003", "初级", "供应商3", 13.47, 12, 0.06],
    [2025, "技术部", "PRJ-JS-热能-2024-001", "专家", "供应商1", 100.87, 36, 0.06],
    [2025, "技术部", "PRJ-JS-热能-2025-002", "专家", "供应商3", 93.74, 36, 0.06],
    [2025, "技术部", "PRJ-JS-热能-2025-003", "专家", "供应商3", 112.08, 36, 0.06],
    [2025, "技术部", "PRJ-JS-经验-2024-001", "高级", "供应商2", 68.21, 30, 0.06],
    [2025, "技术部", "PRJ-JS-经验-2025-002", "高级", "供应商1", 58.02, 30, 0.06],
    [2025, "技术部", "PRJ-JS-经验-2025-003", "高级", "供应商1", 61.98, 30, 0.06],
    [2025, "技术部", "PRJ-JS-新技-2024-001", "专家", "供应商2", 110.04, 36, 0.06],
    [2025, "技术部", "PRJ-JS-新技-2025-002", "专家", "供应商1", 99.51, 36, 0.06],
    [2025, "技术部", "PRJ-JS-新技-2025-003", "专家", "供应商1", 97.13, 36, 0.06],
    [2025, "安全运行部", "PRJ-AQ-概率-2024-001", "中级", "供应商3", 38.94, 24, 0.06],
    [2025, "安全运行部", "PRJ-AQ-概率-2025-002", "中级", "供应商1", 44.38, 24, 0.06],
    [2025, "安全运行部", "PRJ-AQ-概率-2025-003", "中级", "供应商1", 42.11, 24, 0.06],
    [2025, "安全运行部", "PRJ-AQ-灾害-2024-001", "初级", "供应商2", 12.68, 12, 0.06],
    [2025, "安全运行部", "PRJ-AQ-灾害-2025-002", "初级", "供应商3", 12.79, 12, 0.06],
    [2025, "安全运行部", "PRJ-AQ-灾害-2025-003", "初级", "供应商1", 13.81, 12, 0.06],
    [2025, "安全运行部", "PRJ-AQ-安全-2024-001", "中级", "供应商2", 37.13, 24, 0.06],
    [2025, "安全运行部", "PRJ-AQ-安全-2025-002", "中级", "供应商1", 37.13, 24, 0.06],
    [2025, "安全运行部", "PRJ-AQ-安全-2025-003", "中级", "供应商1", 40.53, 24, 0.06],
    [2026, "设备管理部", "PRJ-SB-设备-2024-001", "初级", "供应商1", 12.68, 12, 0.06],
    [2026, "设备管理部", "PRJ-SB-设备-2025-002", "初级", "供应商2", 12.45, 12, 0.06],
    [2026, "设备管理部", "PRJ-SB-设备-2025-003", "初级", "供应商3", 12.45, 12, 0.06],
    [2026, "技术部", "PRJ-JS-热能-2024-001", "专家", "供应商2", 105.62, 36, 0.06],
    [2026, "技术部", "PRJ-JS-热能-2025-002", "专家", "供应商1", 99.85, 36, 0.06],
    [2026, "技术部", "PRJ-JS-热能-2025-003", "专家", "供应商1", 96.79, 36, 0.06],
    [2026, "技术部", "PRJ-JS-经验-2024-001", "高级", "供应商3", 56.60, 30, 0.06],
    [2026, "技术部", "PRJ-JS-经验-2025-002", "高级", "供应商1", 61.13, 30, 0.06],
    [2026, "技术部", "PRJ-JS-经验-2025-003", "高级", "供应商2", 63.11, 30, 0.06],
    [2026, "技术部", "PRJ-JS-新技-2024-001", "专家", "供应商2", 110.72, 36, 0.06],
    [2026, "技术部", "PRJ-JS-新技-2025-002", "专家", "供应商2", 105.28, 36, 0.06],
    [2026, "技术部", "PRJ-JS-新技-2025-003", "专家", "供应商1", 96.45, 36, 0.06],
    [2026, "安全运行部", "PRJ-AQ-概率-2024-001", "中级", "供应商3", 37.81, 24, 0.06],
    [2026, "安全运行部", "PRJ-AQ-概率-2025-002", "中级", "供应商2", 39.17, 24, 0.06],
    [2026, "安全运行部", "PRJ-AQ-概率-2025-003", "中级", "供应商3", 44.15, 24, 0.06],
    [2026, "安全运行部", "PRJ-AQ-灾害-2024-001", "初级", "供应商1", 12.23, 12, 0.06],
    [2026, "安全运行部", "PRJ-AQ-灾害-2025-002", "初级", "供应商3", 14.94, 12, 0.06],
    [2026, "安全运行部", "PRJ-AQ-灾害-2025-003", "初级", "供应商2", 12.45, 12, 0.06],
    [2026, "安全运行部", "PRJ-AQ-安全-2024-001", "中级", "供应商2", 40.75, 24, 0.06],
    [2026, "安全运行部", "PRJ-AQ-安全-2025-002", "中级", "供应商3", 44.38, 24, 0.06],
    [2026, "安全运行部", "PRJ-AQ-安全-2025-003", "中级", "供应商2", 43.92, 24, 0.06]
  ];
  const supplierBenchmarkTaxLabel = (rate) => `${Math.round(Number(rate) * 100)}%`;
  const supplierBenchmarkGroupKey = (row) => [row.year, row.budgetSubject, row.personCategory, row.supplier, row.level, row.currency, row.taxRate].join("|");
  const supplierBenchmarks = supplierBenchmarkSourceRows.map(function (row, index) {
    const [year, department, projectId, level, supplier, netAmountWan, serviceMonths, taxRateValue] = row;
    const monthlyNetCostWan = serviceMonths > 0 ? Number((netAmountWan / serviceMonths).toFixed(6)) : null;
    const monthlyNetCostRmb = monthlyNetCostWan == null ? null : Number((monthlyNetCostWan * 10000).toFixed(2));
    const item = {
      id: `SUPPLIER-SOURCE-${String(index + 1).padStart(3, "0")}`,
      year, department, projectId, budgetSubject: "业务支持费-技术配置", personCategory: "技术服务", category: "业务支持费-技术配置", level, supplier,
      currency: "CNY", unit: "元/人月", serviceMonths, taxRate: supplierBenchmarkTaxLabel(taxRateValue), taxRateValue,
      netAmountWan, monthlyNetCostWan, monthlyNetCostRmb,
      sourceFile: `${year}年预算申报明细汇总.xlsx`, sourceMember: "技术配置", sourceDataMarker: "SOURCE", dataMarker: "SOURCE"
    };
    return { ...item, comparisonGroupKey: supplierBenchmarkGroupKey(item) };
  });
  const supplierBenchmarkGroups = Object.values(supplierBenchmarks.reduce(function (map, row) {
    const key = row.comparisonGroupKey;
    (map[key] ||= []).push(row);
    return map;
  }, {})).map(function (members) {
    const valid = members.filter((item) => Number.isFinite(item.monthlyNetCostRmb) && item.monthlyNetCostRmb > 0);
    const minMonthlyNetCostRmb = valid.length ? Math.min(...valid.map((item) => item.monthlyNetCostRmb)) : null;
    const maxMonthlyNetCostRmb = valid.length ? Math.max(...valid.map((item) => item.monthlyNetCostRmb)) : null;
    const maxMinRatio = minMonthlyNetCostRmb > 0 ? Number((maxMonthlyNetCostRmb / minMonthlyNetCostRmb).toFixed(6)) : null;
    const anomaly = valid.length >= 2 && maxMinRatio > 1.2;
    return {
      comparisonGroupKey: members[0].comparisonGroupKey, year: members[0].year, budgetSubject: members[0].budgetSubject,
      personCategory: members[0].personCategory, supplier: members[0].supplier, level: members[0].level, currency: members[0].currency,
      taxRate: members[0].taxRate, departmentCount: new Set(members.map((item) => item.department)).size, memberCount: members.length,
      minMonthlyNetCostRmb, maxMonthlyNetCostRmb, maxMinRatio, anomaly, status: anomaly ? "异常" : "已评估无异常", threshold: 1.2,
      members: members.map((item) => item.id)
    };
  });

  const legalRecordExplanations = [
    { issue: "重复凭证组", count: 21, classification: "合法业务记录", handling: "按凭证号+行号10/20保留，不去重；用于解释同凭证多科目分录。", dataMarker: "SOURCE" },
    { issue: "期间异常", count: 13, classification: "授权演示修正", handling: "源期间与演示映射期间双留存，参与演示计算时使用修正期间。", dataMarker: "CORRECTED" },
    { issue: "日期倒置", count: 6, classification: "授权演示修正", handling: "保留原日期、修正日期和理由，不覆盖源记录。", dataMarker: "CORRECTED" }
  ];

  const metrics = [
    { id: "MET-001", name: "成本占收比", formula: "总成本 / 收入净额", unit: "%", owner: "M01", status: "候选", note: "将源列‘毛利率’更名；费用不含税。" },
    { id: "MET-002", name: "真正毛利率", formula: "(收入净额 - 总成本) / 收入净额", unit: "%", owner: "M01", status: "候选", note: "与成本占收比互补，恒等于 1 - 成本占收比。" },
    { id: "MET-003", name: "净在途占用", formula: "PR/PO 占用变动金额带符号累计", unit: "万元", owner: "M01", status: "候选", note: "负向表示释放/确认，不等于付款。" },
    { id: "MET-004", name: "正向采购发起量", formula: "正向 PR 金额合计", unit: "万元", owner: "M01", status: "候选", note: "不重复累计 PO 正向金额。" },
    { id: "MET-005", name: "12月正向采购发起占比", formula: "12月正向 PR / 全年正向 PR", unit: "%", owner: "M01", status: "候选", note: "仅采购发起口径，不与预算占用分母混算。" },
    { id: "MET-006", name: "项目可用立项余额", formula: "立项金额 - 实际 - 净在途占用 - 未结计提", unit: "万元", owner: "M01", status: "候选", note: "不使用合同额。" },
    { id: "MET-007", name: "预算执行率", formula: "实际 / 最终批准预算", unit: "%", owner: "M01", status: "候选", note: "收入与费用分开观察。" },
    { id: "MET-008", name: "预算差异额", formula: "实际 - 最终批准预算", unit: "万元", owner: "M01", status: "候选", note: "金额差异需与版本、情景绑定。" },
    { id: "MET-009", name: "年末采购/预算占用集中度", formula: "{12月正向PR/全年正向PR, 12月净在途占用/全年净在途占用}", unit: "%（双分量）", owner: "M01", status: "候选", note: "采购发起与预算占用分别使用各自同口径年度分母，不合并成一个分数。" }
  ];

  const rules = [
    { id: "RULE-001", name: "项目预算覆盖风险", metricId: "MET-006", expression: "availableBalance < 0", threshold: "项目可用立项余额 < 0万元", priority: "高", actionType: "预算执行整改", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", evidence: "项目立项金额、实际、净在途占用、未结计提及确认快照" },
    {
      id: "RULE-002", name: "费用预算执行偏离合理区间", metricId: "MET-007",
      expression: "expenseExecutionRate >= 95% OR expenseExecutionRate <= 70%",
      threshold: "<=70%偏低；95%—100%关注；>100%高",
      priority: "中/高", actionType: "按执行率分支路由", actionTypeId: null,
      actionRoutes: [
        { branch: "expenseExecutionRate > 100%", actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", actionType: "费用管理优化核查" },
        { branch: "expenseExecutionRate >= 95% AND expenseExecutionRate <= 100%", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算执行整改" },
        { branch: "expenseExecutionRate <= 70%", actionTypeId: "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", actionType: "下一年度预算合理性复核" }
      ],
      evidence: "年度、部门、最终批准预算版本、实际执行和期间"
    },
    { id: "RULE-003", name: "成本占收比异常", metricId: "MET-001", expression: "costToRevenue >= 100%", threshold: ">=100%关注；>=120%高", priority: "中/高", actionType: "费用管理优化核查", actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", evidence: "年度、部门、收入净额、总成本、成本占收比和真正毛利率" },
    { id: "RULE-004", name: "年末采购/预算占用集中", metricId: "MET-009", expression: "decemberProcurementShare >= 10% OR decemberBudgetOccupancyShare >= 10%", threshold: "10%—15%关注；>=15%高", priority: "中/高", actionType: "采购占用清理", actionTypeId: "ACT-PROCUREMENT-COMMITMENT-CLEANUP", evidence: "采购发起使用全年正向PR，预算占用使用全年净在途占用作为同口径年度分母" },
    { id: "RULE-005", name: "供应商同级人月成本差异", metricId: null, supportingMeasure: "同年度、同预算二级科目、同人员分类、同供应商、同级别、同币种和税率的各部门人月成本=净额÷人月", expression: "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2", threshold: "最高/最低人月成本倍率 > 1.2", priority: "中", actionType: "供应商价格复核", actionTypeId: "ACT-SUPPLIER-PRICE-REVIEW", evidence: "比较组键、部门、项目、年度预算净额、人月、人月成本；严格大于1.2才异常，等于1.2不命中" }
  ];

  const ruleHitMappings = [
    { hitId: "HIT-001", ruleId: "RULE-001", metricId: "MET-006", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION" },
    { hitId: "HIT-002-2024-AQ", ruleId: "RULE-002", metricId: "MET-007", actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW" },
    { hitId: "HIT-002-2025-AQ", ruleId: "RULE-002", metricId: "MET-007", actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION" },
    { hitId: "HIT-003-2025-AQ", ruleId: "RULE-003", metricId: "MET-001", actionTypeId: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW" },
    { hitId: "HIT-004", ruleId: "RULE-004", metricId: "MET-009", actionTypeId: "ACT-PROCUREMENT-COMMITMENT-CLEANUP" },
    { hitId: "HIT-002-2025-SB", ruleId: "RULE-002", metricId: "MET-007", actionTypeId: "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW" }
  ];

  const ruleHitInputs = [
    { id: "HIT-001", title: "概率安全分析项目预算覆盖不足", subject: "PRJ-AQ-概率-2025-002", subjectId: "PRJ-AQ-概率-2025-002", subjectName: "安全运行部 · 概率安全分析项目", department: "安全运行部", year: 2025, subjectCategories: ["项目实施成本"], periods: ["全年"], value: -20.5038, unit: "万元", priority: "高", dataMarker: "DERIVED" },
    { id: "HIT-002-2024-AQ", title: "2024安全运行部费用预算执行率超过最终批准预算", subject: "安全运行部|FY2024-APPROVED-FINAL-v1", subjectId: "ORG-AQ-FY2024", subjectName: "安全运行部 · 2024最终批准预算", department: "安全运行部", year: 2024, subjectCategories: expenseSubjects.slice(), periods: ["全年"], value: 125.48, unit: "%", priority: "高", dataMarker: "DERIVED" },
    { id: "HIT-002-2025-AQ", title: "2025安全运行部费用预算执行率接近上限", subject: "安全运行部|FY2025-APPROVED-FINAL-v1", subjectId: "ORG-AQ-FY2025", subjectName: "安全运行部 · 2025最终批准预算", department: "安全运行部", year: 2025, subjectCategories: expenseSubjects.slice(), periods: ["全年"], value: 98.86, unit: "%", priority: "中", dataMarker: "DERIVED" },
    { id: "HIT-003-2025-AQ", title: "2025安全运行部成本占收比超过100%", subject: "安全运行部|FY2025-APPROVED-FINAL-v1", subjectId: "ORG-AQ-FY2025-COST", subjectName: "安全运行部 · 2025成本费用表现", department: "安全运行部", year: 2025, subjectCategories: expenseSubjects.slice(), periods: ["全年"], value: 112.63, unit: "%", priority: "中", numerator: 310.3201, denominator: 275.5278, denominatorBasis: "实际费用 / 收入净额；真正毛利率=-12.63%", dataMarker: "DERIVED" },
    { id: "HIT-004", title: "设备项目年末预算占用集中度达到高等级", subject: "PRJ-SB-设备-2025-002|2025净在途占用", department: "设备管理部", year: 2025, subjectCategories: ["项目实施成本"], periods: ["Q4"], value: 18.9437, unit: "%", priority: "高", component: "budgetOccupancyDecemberShare", numerator: 9.29, denominator: 49.04, denominatorBasis: "全年净在途占用", dataMarker: "DERIVED" },
    { id: "HIT-002-2025-SB", title: "2025设备管理部费用预算执行率低于合理区间", subject: "设备管理部|FY2025-APPROVED-FINAL-v1", subjectId: "ORG-SB-FY2025", subjectName: "设备管理部 · 2025最终批准预算", department: "设备管理部", year: 2025, subjectCategories: expenseSubjects.slice(), periods: ["全年"], value: 63.20, unit: "%", priority: "中", numerator: 255.6557, denominator: 404.50, denominatorBasis: "实际费用 / 最终批准费用预算", dataMarker: "DERIVED" }
  ];

  const ruleEvaluations = [
    { evaluationId: "EVAL-ACCRUAL-001", ruleId: null, ruleName: "跨年计提配对质量核验", evaluationPurpose: "计提配对差异解释与质量核验", actionPolicy: "no-action", status: "evaluated-no-hit", years: [2024, 2025], subjectCategories: ["项目实施成本"], periods: ["全年"], pairedAccrualCount: 14, unmatchedAccrualCount: 0, maxAbsoluteVariance: 0, threshold: 0.5, unit: "万元", dataMarker: "DERIVED", note: "2024计提与2025冲回/实际确认已逐条配对；不存在达到0.5万元关注线的差异。本项属于数据质量与业务解释核验，不占用5项正式Rule，也不生成Action Request。" },
    { evaluationId: "EVAL-SUPPLIER-MONTHLY-COST-001", ruleId: "RULE-005", ruleName: "供应商同级人月成本差异", evaluationPurpose: "按年度、业务支持费-技术配置、技术服务、供应商、级别、币种和税率比较各部门人月成本", actionPolicy: "review-only-on-hit", status: "evaluated-no-hit", years: [2025, 2026], subjectCategories: ["业务支持费-技术配置"], periods: ["全年"], sourceRowCount: 42, comparisonGroupCount: 5, anomalyCount: 0, maxRatio: 1.2, threshold: 1.2, comparator: ">", unit: "倍", dataMarker: "SOURCE_AND_DERIVED", note: "人月成本=年度预算净额（万元）×10000÷服务人月。最高/最低倍率严格大于1.2才异常；2026供应商3初级组恰为1.20，因此不命中。" }
  ];

  const actionSuggestions = [
    { id: "SUG-001", title: "技术部2025初始申报成本占收比异常", subject: "技术部|FY2025-INITIAL-SUBMISSION-v1", subjectId: "ORG-JS-FY2025-INITIAL", subjectName: "技术部 · 2025初始申报预算", department: "技术部", year: 2025, subjectCategories: expenseSubjects.slice(), periods: ["全年"], sourceRef: "M03 · SUG-001 · 预算分析建议", requester: "预算分析建议", metricId: "MET-001", metricName: "成本占收比", metricValue: 310.30, metricUnit: "%", metricExplanation: "初始申报总成本1,695.15万元 / 收入净额546.30万元 = 310.30%", actionTypeId: "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", suggestedAmount: null, recommendation: "生成预算申报依据补充待办，要求补充成本拆解、收入依据和调整说明；不自动退回申报。", rationale: "该项是预算分析建议，不冒充正式Rule命中。", dataMarker: "DERIVED" }
  ];

  const actionReviewPlan = [
    { sourceId: "HIT-001", decision: "confirm", reason: "项目可用立项余额为负，已核对项目实际、净在途和剩余计划，确认形成预算执行整改待办；不改变最终批准预算。", owner: "安全运行部项目预算负责人", ownerId: "BUSINESS-OWNER-AQ-BUDGET", due: "2026-08-22", instructions: "提交预算覆盖不足原因、剩余交付、采购占用和后续支出控制计划；不覆盖最终批准预算。" },
    { sourceId: "HIT-002-2024-AQ", decision: "reject", reason: "2024预算期间已关闭，不再发起历史期间整改事项。", owner: "安全运行部费用管理负责人", ownerId: "BUSINESS-OWNER-AQ-BUDGET", due: "2026-08-22", instructions: "保留历史事实用于预算绩效复盘，不修改2024最终批准预算。" },
    { sourceId: "HIT-002-2025-AQ", decision: "await", pending: true, reason: "2025费用预算执行率98.86%接近上限，需结合剩余采购占用和下一期间计划再决定是否形成整改待办。", owner: "安全运行部费用预算负责人", ownerId: "BUSINESS-OWNER-AQ-BUDGET", due: "2026-08-22", instructions: "核对剩余3.5799万元预算空间、后续计划和占用情况，提交费用控制说明；不自动调账。" },
    { sourceId: "HIT-003-2025-AQ", decision: "await", pending: true, reason: "2025成本占收比112.63%、真正毛利率-12.63%，需核实费用结构、收入确认和可优化空间后再决定整改要求。", owner: "安全运行部费用管理负责人", ownerId: "BUSINESS-OWNER-AQ-COST", due: "2026-08-22", instructions: "核实收入确认、费用结构和管理优化空间并提交原因说明；不自动调剂、调增或调减预算。" },
    { sourceId: "HIT-004", decision: "confirm", reason: "设备项目年末预算占用集中度18.94%，确认逐笔核对长期未转PO或已取消采购。", owner: "设备管理部采购计划负责人", ownerId: "BUSINESS-OWNER-SB-COMMITMENT", due: "2026-08-22", instructions: "形成采购占用逐笔清理清单，区分继续保留、转单和建议释放；不直接释放外部系统占用。" },
    { sourceId: "SUG-001", decision: "confirm", reason: "技术部2025初始申报成本占收比310.30%，确认要求补充申报依据。", owner: "技术部预算申报负责人", ownerId: "BUSINESS-OWNER-JS-SUBMISSION", due: "2026-08-22", instructions: "补充收入实现依据、项目成本、技术配置费和公共费用测算说明；不自动退回或改写申报。" },
    { sourceId: "HIT-002-2025-SB", decision: "await", pending: true, reason: "设备管理部2025费用预算执行率63.20%，已命中RULE-002低执行率分支；需先核实未执行计划及采购占用，再决定下一年度预算合理性复核。", owner: "设备管理部年度预算编制负责人", ownerId: "BUSINESS-OWNER-SB-BUDGET", due: "2026-08-22", instructions: "提交未执行计划清单并复核下一年度预算测算依据；不覆盖最终批准预算。" }
  ];

  const dashboardActionCandidates = [
    {
      id: "DASH-EXEC-AQ-2025", relatedSourceId: "HIT-001", sourceType: "report-dashboard-rule-hit",
      title: "概率安全分析项目预算覆盖不足预警", subjectId: "PRJ-AQ-概率-2025-002", subject: "PRJ-AQ-概率-2025-002", subjectName: "安全运行部 · 概率安全分析项目",
      department: "安全运行部", year: 2025, subjectCategories: ["项目实施成本"], periods: ["全年"],
      metricId: "MET-006", metricName: "项目可用立项余额", metricValue: -20.5038, metricUnit: "万元",
      metricExplanation: "项目立项金额 - 实际使用 - 净在途占用 - 未结计提 - 剩余计划 = -20.5038万元",
      ruleId: "RULE-001", ruleName: "项目预算覆盖风险", ruleBranch: "availableBalance < 0",
      ruleHitEvidence: "概率安全分析项目可用立项余额-20.5038万元，低于0万元关注线。",
      actionTypeId: "ACT-BUDGET-EXECUTION-RECTIFICATION", actionType: "预算执行整改", suggestedAmount: null, priority: "高",
      businessOwner: "安全运行部项目预算负责人", businessOwnerId: "BUSINESS-OWNER-AQ-BUDGET",
      recommendation: "形成预算执行整改提醒，待平台管理员人工确认后生成平台内待办；不覆盖最终批准预算，不反写外部系统。",
      triggerReason: "驾驶舱按项目下钻复用已发布RULE-001及HIT-001，不重复创建同一业务事项。", dataMarker: "DERIVED",
      evidence: ["C018-S002-v1", "RULE-001", "MET-006", "HIT-001", "S002-DATA-v1"],
      dashboardTrigger: { theme: "项目余额与采购占用", category: "项目余额", alertType: "项目余额不足", cardId: "ALERT-DASH-EXEC-AQ-2025" }
    },
    {
      id: "DASH-OCC-JS-2025", sourceType: "report-dashboard-rule-hit",
      title: "技术部热能项目年末预算占用集中预警", subjectId: "PRJ-JS-热能-2025-002", subject: "PRJ-JS-热能-2025-002|2025净在途占用", subjectName: "技术部 · 热能项目采购占用",
      department: "技术部", year: 2025, subjectCategories: ["项目实施成本"], periods: ["Q4"],
      metricId: "MET-009", metricName: "年末采购/预算占用集中度", metricValue: 12.5359, metricUnit: "%",
      metricExplanation: "12月净在途占用6.55万元 / 全年净在途占用52.25万元",
      ruleId: "RULE-004", ruleName: "年末采购/预算占用集中", ruleBranch: "decemberBudgetOccupancyShare >= 10%",
      ruleHitEvidence: "技术部热能项目12月净在途占用占全年12.54%，达到关注线。",
      actionTypeId: "ACT-PROCUREMENT-COMMITMENT-CLEANUP", actionType: "采购占用清理", suggestedAmount: null, priority: "中",
      businessOwner: "技术部采购计划负责人", businessOwnerId: "BUSINESS-OWNER-JS-COMMITMENT",
      recommendation: "形成采购占用清理核对草稿，待平台管理员人工确认；不直接释放外部预算系统占用。",
      triggerReason: "同一指标在驾驶舱按项目下钻后达到已发布RULE-004关注线。", dataMarker: "SYNTHETIC_FOR_DEMO",
      evidence: ["C018-S002-v1", "RULE-004", "MET-009", "S002-DATA-v1"],
      dashboardTrigger: { theme: "项目余额与采购占用", category: "年末占用", alertType: "年末采购/预算占用集中", cardId: "ALERT-DASH-OCC-JS-2025" }
    }
  ];

  const legacyActionTypeIdMap = Object.freeze({
    "ACT-BUDGET-INCREASE": "ACT-BUDGET-EXECUTION-RECTIFICATION",
    "ACT-BUDGET-DECREASE": "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW",
    "ACT-SUBJECT-TRANSFER": "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW",
    "ACT-SUBMISSION-RETURN": "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT",
    "ACT-RELEASE-COMMITMENT": "ACT-PROCUREMENT-COMMITMENT-CLEANUP",
    "ACT-PRICE-REVIEW": "ACT-SUPPLIER-PRICE-REVIEW"
  });

  const actionTypes = [
    { id: "ACT-BUDGET-EXECUTION-RECTIFICATION", legacyCompatibleId: "ACT-BUDGET-INCREASE", name: "预算执行整改", legacyActionType: "预算调增", boundary: "只生成预算执行整改提醒/草稿；如需预算调增仅作为人工确认后的下游草稿，不反写外部预算系统" },
    { id: "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", legacyCompatibleId: "ACT-BUDGET-DECREASE", name: "下一年度预算合理性复核", legacyActionType: "预算调减", boundary: "只生成下一年度预算合理性复核提醒/草稿；不覆盖最终批准预算" },
    { id: "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", legacyCompatibleId: "ACT-SUBJECT-TRANSFER", name: "费用管理优化核查", legacyActionType: "科目调剂", boundary: "只生成费用结构与科目余额核查提醒；不自动调账" },
    { id: "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", legacyCompatibleId: "ACT-SUBMISSION-RETURN", name: "预算申报依据补充", legacyActionType: "申报退回", boundary: "只生成申报依据补充待办；不自动退回或改写申报" },
    { id: "ACT-PROCUREMENT-COMMITMENT-CLEANUP", legacyCompatibleId: "ACT-RELEASE-COMMITMENT", name: "采购占用清理", legacyActionType: "占用释放", boundary: "只生成采购占用逐笔清理待办；不直接释放外部系统占用" },
    { id: "ACT-SUPPLIER-PRICE-REVIEW", legacyCompatibleId: "ACT-PRICE-REVIEW", name: "供应商价格复核", boundary: "只生成同口径价格复核待办；不触发供应商系统或自动改价" }
  ];

  const questions = [
    { id: "Q-EXECUTION", label: "2025年各部门费用预算执行率和差异额分别是多少？", type: "execution" },
    { id: "Q-COST-MARGIN", label: "哪些单位2025年成本占收比超过100%，对应真正毛利率是否为负？", type: "cost-margin" },
    { id: "Q-BALANCE", label: "项目可用立项余额不足或净在途占用异常的项目有哪些？", type: "balance" },
    { id: "Q-COMMITMENT", label: "12月正向采购发起占比和年末采购/预算占用集中度如何？", type: "commitment" },
    { id: "Q-SUBMISSION", label: "2026年初始申报中，哪个部门成本占收比最高？", type: "submission" },
    { id: "Q-TREND", label: "2024—2025年各部门费用预算执行率变化分别是多少？", type: "trend" }
  ];

  const themes = [
    { id: "execution", title: "年度预算执行", subtitle: "最终批准预算 vs 期间实际", metric: "执行率", color: "blue" },
    { id: "submission", title: "初始申报分析", subtitle: "部门最初申报，不替代正式下达", metric: "成本占收比", color: "violet" },
    { id: "balance", title: "项目余额与占用", subtitle: "可用立项余额 = 立项 - 实际 - 在途 - 计提", metric: "可用余额", color: "orange" },
    { id: "anomaly", title: "异常与关注事项", subtitle: "Rule 命中与分析发现，仅用于监督下钻", metric: "关注项", color: "red" },
    { id: "trend", title: "跨年趋势和单位对比", subtitle: "2024/2025可解释趋势与部门对比", metric: "同比", color: "green" }
  ];

  const modules = [
    { id: "m02", code: "M02", name: "数据工程", icon: "database", description: "来源、快照、管道、质量与数据资产版本", steps: ["dataConnected", "qualityPassed", "assetPublished"] },
    { id: "m01", code: "M01", name: "本体管理", icon: "network", description: "预算对象、关系、Metric、Rule、Action Type 与 Published", steps: ["mappingApplied", "ontologyPublished"] },
    { id: "m03", code: "M03", name: "智能问数", icon: "sparkles", description: "预算问数 Agent、Prompt、Skill、运行与固定视图", steps: ["queryRun", "rulesRun"] },
    { id: "m04", code: "M04", name: "决策中心", icon: "target", description: "保留基线决策工作台；S002 当前运行不生成行动申请示例", steps: ["actionsDrafted", "actionConfirmed", "todoCreated"] },
    { id: "m05", code: "M05", name: "Agent 应用", icon: "bot", description: "异常分析 Agent 与预算报告草稿 Agent 的轻量编排", steps: ["agentsRun"] },
    { id: "m06", code: "M06", name: "报告中心", icon: "file", description: "六专题预算驾驶舱、真实明细下钻、报告展示与证据链", steps: ["reportBuilt", "dashboardPublished"] }
  ];

  const checkpoints = [
    { id: "CP01", node: "initial-configured", label: "初始配置", file: "checkpoints/current/CP01-initial-configured.json" },
    { id: "CP02", node: "data-connected", label: "数据接入", file: "checkpoints/current/CP02-data-connected.json" },
    { id: "CP03", node: "published-switched", label: "Published切换", file: "checkpoints/current/CP03-published-switched.json" },
    { id: "CP04", node: "query-integrated", label: "问数联调", file: "checkpoints/current/CP04-query-integrated.json" },
    { id: "CP05", node: "decision-chain-completed", label: "决策链", file: "checkpoints/current/CP05-decision-chain-completed.json" },
    { id: "CP06", node: "agent-report-dashboard-completed", label: "Agent/报告/驾驶舱", file: "checkpoints/current/CP06-agent-report-dashboard-completed.json" },
    { id: "CP07", node: "e2e-integrated", label: "端到端联调", file: "checkpoints/current/CP07-e2e-integrated.json" },
    { id: "CP-PRE", node: "pre-risk-change", label: "高风险修改前", file: "checkpoints/current/CP-PRE-risk-change.json" }
  ];

  window.S002_DATA = {
    brand: { zh: "智财问策", en: "Ontology Financial World" },
    scenario: {
      id: "S002",
      scenarioVersion: "S002-v1",
      name: "预算监督管理",
      organization: "平台管理员演示空间",
      currency: "CNY",
      unit: "万元",
      expenseBasis: "费用不含税",
      incomeSign: "源负号代表收益，展示转正",
      baselineVersion: "1.0.3",
      baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
      parentVersion: "1.0.3",
      sourcePackage: "S002预算监督管理_演示加工数据候选包_v0.1.xlsx",
      sourceSha256: "a283fabf23f63506f33c5900d0f3643c82734659a890ee504d7394bdb0244599",
      syntheticMark: "SYNTHETIC_FOR_DEMO",
      implementationDate: "2026-08-15",
      implementationTimestamp: "2026-08-15T08:00:00.000Z",
      implementationDayEnd: "2026-08-15T15:59:59.999Z",
      dataAsOf: "2025-12-31",
      status: "active"
    },
    departments: departments,
    sourceManifest: sourceManifest,
    dataSources: dataSources,
    dataAssets: dataAssets,
    dataPipelines: dataPipelines,
    sourceReconciliation: sourceReconciliation,
    annualFacts: annualFacts,
    submissionFacts: submissionFacts,
    projects: projects,
    occupancy: occupancy,
    expenseSubjects: expenseSubjects,
    expensePeriods: expensePeriods,
    expenseDetails: expenseDetails,
    travelFacts: travelFacts,
    accrualPairs: accrualPairs,
    supplierBenchmarks: supplierBenchmarks,
    supplierBenchmarkGroups: supplierBenchmarkGroups,
    legalRecordExplanations: legalRecordExplanations,
    metrics: metrics,
    rules: rules,
    ruleHitMappings: ruleHitMappings,
    ruleHitInputs: ruleHitInputs,
    ruleEvaluations: ruleEvaluations,
    actionSuggestions: actionSuggestions,
    actionReviewPlan: actionReviewPlan,
    dashboardActionCandidates: dashboardActionCandidates,
    actionTypes: actionTypes,
    legacyActionTypeIdMap: legacyActionTypeIdMap,
    questions: questions,
    themes: themes,
    modules: modules,
    checkpoints: checkpoints,
    quality: {
      sourceFiles: 8,
      logicalSources: 5,
      snapshotCount: 8,
      logicalMembers: 14,
      actualRows: 420,
      budgetRows: 60,
      submissionRows: 128,
      commitmentRows: 108,
      projectRows: 21,
      checksPassed: 20,
      checksTotal: 20,
      formulaErrors: 0,
      dataMarkers: {
        actual2024: { SOURCE: 161, SYNTHETIC_FOR_DEMO: 42 },
        actual2025: { SOURCE: 147, CORRECTED: 56, DERIVED_REVERSAL: 14 },
        publicExpense2026: { SYNTHETIC_FOR_DEMO: 12 },
        occupancyExamples: { SYNTHETIC_FOR_DEMO: 6 },
        imputedZeroProjects: { IMPUTED_ZERO: 18 },
        projectBalances: { DERIVED: 21 }
      },
      repairedIssues: { duplicateVoucherGroups: 21, periodAnomalies: 13, dateInversions: 6 },
      repairPolicy: "合法业务记录保留并映射为演示合理日期/期间；不删除源记录"
    },
    nav: [
      { id: "home", name: "场景首页", icon: "home", route: "#home" },
      { id: "data", name: "数据工程", icon: "database", route: "#module/data" },
      { id: "ontology", name: "本体管理", icon: "network", route: "#module/ontology" },
      { id: "query", name: "智能问数", icon: "sparkles", route: "#module/query" },
      { id: "decision", name: "决策中心", icon: "target", route: "#module/decision" },
      { id: "agent", name: "Agent 应用", icon: "bot", route: "#module/agent" },
      { id: "report", name: "报告中心", icon: "file", route: "#module/report" },
      { id: "dashboard", name: "预算驾驶舱", icon: "chart", route: "#dashboard" }
    ]
  };
})();
