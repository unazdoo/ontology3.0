(function () {
  "use strict";

  const portfolio = window.RC_PORTFOLIO?.data || {};
  const riskSummary = portfolio.s003?.summary || {};
  const portfolioRiskReports = portfolio.s003?.reports || [];

  const riskFallback = [
    ["S003-ENT-001", "风电测试公司01", "新能源产业-风电", 59.08, "绿灯", "总资产收益率"],
    ["S003-ENT-002", "风电测试公司02", "新能源产业-风电", 88.41, "绿灯", "经营现金流"],
    ["S003-ENT-003", "风电测试公司03", "新能源产业-风电", 71.57, "绿灯", "应收账款周转率"],
    ["S003-ENT-004", "风电测试公司04", "新能源产业-风电", 80.37, "绿灯", "销售毛利率"],
    ["S003-ENT-005", "风电测试公司05", "新能源产业-风电", 57.30, "绿灯", "资金余缺预警"],
    ["S003-ENT-006", "风电测试公司06", "新能源产业-风电", 60.64, "绿灯", "总资产收益率"],
    ["S003-ENT-007", "风电测试公司07", "新能源产业-风电", 37.75, "黄灯", "利息保障倍数"],
    ["S003-ENT-008", "风电测试公司08", "新能源产业-风电", 56.62, "绿灯", "资产负债率"],
    ["S003-ENT-009", "风电测试公司09", "新能源产业-风电", 47.32, "绿灯", "经营现金流"],
    ["S003-ENT-010", "风电测试公司10", "在建企业", 54.00, "绿灯", "建设资金覆盖"],
    ["S003-ENT-011", "风电测试公司11", "在建企业", 54.00, "绿灯", "建设资金覆盖"],
    ["S003-ENT-012", "风电测试公司12", "在建企业", 54.00, "绿灯", "建设资金覆盖"],
    ["S003-ENT-013", "风电测试公司13", "新能源产业-风电", 43.96, "绿灯", "应收账款周转率"],
    ["S003-ENT-014", "风电测试公司14", "新能源产业-风电", 54.57, "绿灯", "融资能力"],
    ["S003-ENT-015", "风电测试公司15", "新能源产业-风电", 49.92, "绿灯", "销售毛利率"],
    ["S003-ENT-016", "风电测试公司16", "新能源产业-风电", 57.33, "绿灯", "总资产收益率"],
    ["S003-ENT-017", "环保测试公司1", "环保", 30.52, "黄灯", "现金流动负债比率"],
    ["S003-ENT-018", "环保测试公司2", "环保", 33.92, "黄灯", "资产负债率"],
    ["S003-ENT-019", "环保测试公司3", "环保", 37.31, "黄灯", "利息保障倍数"],
    ["S003-ENT-020", "环保测试公司4", "环保", 23.05, "红灯", "资金余缺预警"],
    ["S003-ENT-021", "核电测试公司1", "核电", 45.10, "绿灯", "应收账款周转率"],
  ].map(([enterpriseId, enterpriseName, category, finalScore, riskTier, focus], index) => ({
    enterpriseId,
    enterpriseName,
    category,
    finalScore,
    riskTier,
    focus,
    reportId: `S003-RPT-S003-RUN-20260817163000000-c02200000001-${enterpriseId}`,
    report: `../../../../prototype-releases/v1.1.0/report-center/review-lifecycle/portfolio-assets/s003/${String(index + 1).padStart(2, "0")}-S003-RPT-S003-RUN-20260817163000000-c02200000001-${enterpriseId}.html`,
  }));

  const riskCompanies = (portfolioRiskReports.length === 21 ? portfolioRiskReports : riskFallback).map((item, index) => ({
    enterpriseId: item.enterpriseId || riskFallback[index].enterpriseId,
    enterpriseName: item.enterpriseName || riskFallback[index].enterpriseName,
    category: item.category || riskFallback[index].category,
    finalScore: Number(item.finalScore ?? riskFallback[index].finalScore),
    riskTier: item.riskTier || riskFallback[index].riskTier,
    focus: riskFallback[index]?.focus || "核心偿债指标",
    reportId: item.reportId || riskFallback[index].reportId,
    report: item.html ? `../../../../prototype-releases/v1.1.0/report-center/review-lifecycle/${item.html}` : riskFallback[index].report,
  }));

  const financing = {
    id: "financing",
    scenarioId: "S001",
    name: "集团融资驾驶舱",
    description: "从集团到板块、单位和融资机构，分析融资成本、债务结构与优化行动。",
    period: "2025-12-31",
    dataLabel: "融资数据 2025-12-31",
    semanticLabel: "企业融资语义 3.8.1",
    updatedAt: "2026-08-16 09:26",
    metrics: [
      { key: "balance", label: "融资余额", value: 21613.387, display: "21,613.387", unit: "亿元", change: "本期结果", trend: "flat", note: "存续融资本金折人民币合计" },
      { key: "cost", label: "余额加权融资成本", value: 2.372231, display: "2.372231", unit: "%", change: "集团范围", trend: "flat", note: "按融资余额加权的执行年化利率" },
      { key: "floating", label: "浮动利率余额占比", value: 95.149492, display: "95.15", unit: "%", change: "本期结构", trend: "flat", note: "浮动利率融资余额占比" },
      { key: "shortTerm", label: "短期债务余额占比", value: 0.911805, display: "0.91", unit: "%", change: "本期结构", trend: "flat", note: "一年内到期及短期融资余额占比" },
      { key: "foreign", label: "外币融资余额占比", value: 4.224132, display: "4.22", unit: "%", change: "本期结构", trend: "flat", note: "非人民币融资折人民币后的余额占比" },
      { key: "highCost", label: "高成本融资余额占比", value: 9.859389, display: "9.86", unit: "%", change: "当前规则口径", trend: "flat", note: "命中当前高成本规则的融资余额占比" },
      { key: "credit", label: "信用融资余额占比", value: 34.680039, display: "34.68", unit: "%", change: "本期结构", trend: "flat", note: "担保方式为信用的融资余额占比" },
    ],
    structures: [
      { id: "rate", name: "利率结构", items: [["浮动利率", 95.149492], ["固定利率", 4.850508]] },
      { id: "term", name: "期限结构", items: [["长期", 95.022], ["中期", 3.503], ["短期", 0.912], ["未知", 0.563]] },
      { id: "currency", name: "币种结构", items: [["人民币", 95.775868], ["外币", 4.224132]] },
      { id: "guarantee", name: "担保结构", items: [["信用", 34.680039], ["质押", 34.337], ["其他担保", 3.547], ["未知", 27.436]] },
      { id: "finance", name: "融资类型", items: [["间接融资", 98.492], ["直接融资", 0.945], ["票据贴现", 0.563]] },
      { id: "region", name: "境内外结构", items: [["境内", 95.303], ["境外", 4.697]] },
    ],
    units: [
      { name: "单位553", board: "境外新能源", balance: 393.134, cost: 2.880984, floating: 79.21, shortTerm: 4.82, highCost: 77.34, credit: 0, finding: "高成本融资占比 77.34%", tone: "danger" },
      { name: "单位465", board: "境内新能源", balance: 770.000, cost: 2.196617, floating: 100, shortTerm: 2.16, highCost: 8.36, credit: 0, finding: "浮动利率占比 100%", tone: "warning" },
      { name: "单位561", board: "产业金融", balance: 20.016, cost: 2.228380, floating: 65.37, shortTerm: 93.55, highCost: 11.44, credit: 41.91, finding: "短期债务占比 93.55%", tone: "warning" },
    ],
    boards: [
      { name: "境内新能源", balance: 16164.098, cost: 2.322729, floating: 95.15, shortTerm: 0.91, foreign: 4.22, highCost: 9.46, credit: 34.68 },
      { name: "核能", balance: 3693.838, cost: 2.175301, floating: 90.35, shortTerm: 2.26, foreign: 3.77, highCost: 8.28, credit: 32.48 },
      { name: "境外新能源", balance: 559.801, cost: 4.518092, floating: 85.55, shortTerm: 3.61, foreign: 100, highCost: 27.03, credit: 30.28 },
      { name: "集团及直管公司", balance: 463.441, cost: 2.917414, floating: 80.75, shortTerm: 4.96, foreign: 2.87, highCost: 14.22, credit: 28.08 },
    ],
    institutions: [
      { name: "启明银行", balance: 2012.564, share: 9.312, cost: 2.260199, count: 439 },
      { name: "盛景银行", balance: 1830.405, share: 8.469, cost: 2.304004, count: 430 },
      { name: "嘉禾银行", balance: 1820.424, share: 8.423, cost: 2.277055, count: 439 },
      { name: "海川银行", balance: 1819.037, share: 8.416, cost: 2.295205, count: 413 },
      { name: "融通银行", balance: 1808.807, share: 8.369, cost: 2.249150, count: 423 },
      { name: "安泰银行", balance: 1747.870, share: 8.087, cost: 2.326359, count: 392 },
    ],
    rules: [
      { code: "R01", title: "高成本融资余额占比", unit: "单位553", result: "命中", observed: "77.34%", threshold: "> 20%", branch: "高成本融资占比超过单位阈值", institution: "欧陆银行", evaluatedAt: "2026-08-16 09:18" },
      { code: "R02", title: "浮动利率余额占比", unit: "单位465", result: "命中", observed: "100.00%", threshold: "> 80%", branch: "浮动利率余额占比超过结构阈值", institution: "融通银行", evaluatedAt: "2026-08-16 09:18" },
      { code: "R03", title: "短期债务余额占比", unit: "单位561", result: "命中", observed: "93.55%", threshold: "> 30%", branch: "短期债务余额占比超过期限阈值", institution: "同州银行", evaluatedAt: "2026-08-16 09:18" },
    ],
    actions: [
      { title: "单位553高成本融资优化", owner: "境外新能源资金负责人", status: "执行中", basis: "欧陆银行、寰宇银行、海联银行", updatedAt: "2026-08-16 10:22" },
      { title: "单位465利率结构复核", owner: "境内新能源资金负责人", status: "待人工确认", basis: "融通银行、启明银行、嘉禾银行", updatedAt: "2026-08-16 10:18" },
      { title: "单位561短期债务滚动安排", owner: "产业金融资金负责人", status: "待人工确认", basis: "同州银行、星河银行、恒信银行", updatedAt: "2026-08-16 10:16" },
    ],
  };

  const budgetTopics = [
    { id: "cost", label: "成本与预算", short: "成本与预算", icon: "gauge", description: "最终批准预算、实际费用、执行率与成本占收比。", rule: "执行率低于或等于 70% 为偏低，95%—100% 为接近上限，超过 100% 为超支。" },
    { id: "project", label: "项目余额", short: "项目余额", icon: "folder-kanban", description: "项目立项、实际、采购占用、计提、剩余计划与可用余额。", rule: "项目可用余额低于 0 时列为高关注，余额不足但尚未为负时列为关注。" },
    { id: "travel", label: "费用与差旅", short: "费用与差旅", icon: "briefcase-business", description: "2025 实际差旅费与 2026 初始申报差旅费的同口径比较。", rule: "同比增幅达到 15% 列为高关注，5%—15% 列为关注。" },
    { id: "accrual", label: "跨年计提", short: "跨年计提", icon: "calendar-range", description: "预估计提与次年结算差异，逐部门穿透到项目。", rule: "差异率达到 15% 列为高关注，3%—15% 列为关注。" },
    { id: "concentration", label: "年末占用", short: "年末占用", icon: "scan-line", description: "12 月采购发起与净在途占用分别衡量年末集中度。", rule: "任一占比达到 10% 列为关注，达到 15% 列为高关注。" },
    { id: "supplier", label: "供应商价格", short: "供应商价格", icon: "badge-dollar-sign", description: "同供应商、同级别、同口径的人月成本跨部门比较。", rule: "最高与最低人月成本倍率严格大于 1.20 时判定异常。" },
  ];

  const budget = {
    id: "budget",
    scenarioId: "S002",
    name: "预算监督管理驾驶舱",
    description: "围绕预算执行、项目余额、费用差旅、跨年计提、年末占用和供应商价格开展专题监督。",
    period: "2025 年度",
    dataLabel: "预算管理数据 2025 年度",
    semanticLabel: "预算管理语义 1.0.0",
    updatedAt: "2026-08-15 16:30",
    metrics: [
      { key: "approved", label: "最终批准费用预算", value: 1097.70, display: "1,097.70", unit: "万元", change: "3 个部门", trend: "flat", note: "以最终批准版本为预算基准" },
      { key: "actual", label: "实际费用", value: 861.73, display: "861.73", unit: "万元", change: "不含税", trend: "flat", note: "本年度累计实际费用" },
      { key: "execution", label: "预算执行率", value: 78.50, display: "78.50", unit: "%", change: "+3.8 个百分点", trend: "up", note: "实际费用除以最终批准费用预算" },
      { key: "available", label: "项目可用立项余额", value: 2157.02, display: "2,157.02", unit: "万元", change: "36 个项目", trend: "flat", note: "立项减实际、占用、计提和剩余计划" },
      { key: "inTransit", label: "净在途占用", value: 163.84, display: "163.84", unit: "万元", change: "3 个部门", trend: "flat", note: "采购占用与释放按带符号金额累计" },
      { key: "attention", label: "重点监督事项", value: 6, display: "6", unit: "项", change: "已完成业务复核", trend: "flat", note: "由预算规则和专题分析形成" },
      { key: "supplier", label: "供应商可比组", value: 4, display: "4", unit: "组", change: "1 组需关注", trend: "flat", note: "同口径供应商人月成本可比组" },
    ],
    annualTrend: [["2024", 73.64], ["2025", 78.50]],
    units: [
      { name: "安全运行部", board: "运营保障", budget: 313.90, actual: 310.32, execution: 98.86, costToRevenue: 112.63, available: 278.89, inTransit: 62.09, status: "接近上限" },
      { name: "技术部", board: "技术研发", budget: 379.30, actual: 295.75, execution: 77.97, costToRevenue: 74.96, available: 749.37, inTransit: 52.25, status: "进度正常" },
      { name: "设备管理部", board: "资产运维", budget: 404.50, actual: 255.66, execution: 63.20, costToRevenue: 52.29, available: 1128.77, inTransit: 49.04, status: "执行偏慢" },
    ],
    topics: budgetTopics,
    details: {
      cost: [
        { group: "安全运行部", name: "安全运行部", budget: 313.90, actual: 310.32, execution: 98.86, costToRevenue: 112.63, delta: -3.58, status: "接近上限" },
        { group: "技术部", name: "技术部", budget: 379.30, actual: 295.75, execution: 77.97, costToRevenue: 74.96, delta: -83.55, status: "正常" },
        { group: "设备管理部", name: "设备管理部", budget: 404.50, actual: 255.66, execution: 63.20, costToRevenue: 52.29, delta: -148.84, status: "执行偏低" },
      ],
      project: [
        { group: "安全运行部", name: "概率安全分析项目", code: "AQ-PRJ-018", approved: 184.50, actual: 122.30, occupied: 48.20, accrual: 12.40, remaining: 22.10, available: -20.50, status: "高关注" },
        { group: "安全运行部", name: "运行风险评价项目", code: "AQ-PRJ-022", approved: 160.00, actual: 92.10, occupied: 31.20, accrual: 8.00, remaining: 11.60, available: 17.10, status: "关注" },
        { group: "技术部", name: "技术研发平台升级", code: "JS-PRJ-006", approved: 305.00, actual: 188.40, occupied: 42.80, accrual: 15.00, remaining: 26.30, available: 32.50, status: "正常" },
        { group: "技术部", name: "仿真计算能力扩容", code: "JS-PRJ-011", approved: 238.00, actual: 131.20, occupied: 36.40, accrual: 8.60, remaining: 20.00, available: 41.80, status: "正常" },
        { group: "设备管理部", name: "设备可靠性提升", code: "SB-PRJ-009", approved: 420.00, actual: 216.80, occupied: 55.30, accrual: 10.50, remaining: 38.60, available: 98.80, status: "正常" },
        { group: "设备管理部", name: "备件结构优化", code: "SB-PRJ-016", approved: 310.00, actual: 158.40, occupied: 43.80, accrual: 9.40, remaining: 27.20, available: 71.20, status: "正常" },
      ],
      travel: [
        { group: "安全运行部", name: "生产检查与现场支持", code: "AQ-TRAVEL-01", actual2025: 28.40, application2026: 34.10, delta: 5.70, rate: 20.07, status: "高关注" },
        { group: "安全运行部", name: "专项评审差旅", code: "AQ-TRAVEL-02", actual2025: 16.20, application2026: 17.10, delta: 0.90, rate: 5.56, status: "关注" },
        { group: "技术部", name: "技术交流与验证", code: "JS-TRAVEL-01", actual2025: 22.80, application2026: 23.20, delta: 0.40, rate: 1.75, status: "正常" },
        { group: "技术部", name: "研发项目现场支持", code: "JS-TRAVEL-02", actual2025: 19.60, application2026: 20.00, delta: 0.40, rate: 2.04, status: "正常" },
        { group: "设备管理部", name: "设备检修现场支持", code: "SB-TRAVEL-01", actual2025: 24.90, application2026: 27.10, delta: 2.20, rate: 8.84, status: "关注" },
        { group: "设备管理部", name: "供应商验收差旅", code: "SB-TRAVEL-02", actual2025: 13.50, application2026: 13.40, delta: -0.10, rate: -0.74, status: "正常" },
      ],
      accrual: [
        { group: "安全运行部", name: "概率安全分析项目", code: "AQ-ACCR-01", estimated: 42.60, settled: 51.20, delta: 8.60, rate: 20.19, status: "高关注" },
        { group: "安全运行部", name: "运行风险评价项目", code: "AQ-ACCR-02", estimated: 26.40, settled: 27.50, delta: 1.10, rate: 4.17, status: "关注" },
        { group: "技术部", name: "研发平台升级", code: "JS-ACCR-01", estimated: 33.80, settled: 34.20, delta: 0.40, rate: 1.18, status: "正常" },
        { group: "技术部", name: "仿真能力扩容", code: "JS-ACCR-02", estimated: 19.20, settled: 18.80, delta: -0.40, rate: 2.08, status: "正常" },
        { group: "设备管理部", name: "设备可靠性提升", code: "SB-ACCR-01", estimated: 28.60, settled: 31.80, delta: 3.20, rate: 11.19, status: "关注" },
        { group: "设备管理部", name: "备件结构优化", code: "SB-ACCR-02", estimated: 17.50, settled: 17.70, delta: 0.20, rate: 1.14, status: "正常" },
      ],
      concentration: [
        { group: "安全运行部", name: "概率安全分析项目", code: "AQ-CON-01", annualPr: 146.20, decemberPr: 27.70, prRate: 18.95, annualTransit: 62.09, decemberTransit: 11.76, transitRate: 18.94, status: "高关注" },
        { group: "安全运行部", name: "运行风险评价项目", code: "AQ-CON-02", annualPr: 94.20, decemberPr: 8.20, prRate: 8.70, annualTransit: 31.80, decemberTransit: 2.40, transitRate: 7.55, status: "正常" },
        { group: "技术部", name: "研发平台升级", code: "JS-CON-01", annualPr: 182.40, decemberPr: 20.10, prRate: 11.02, annualTransit: 52.25, decemberTransit: 6.10, transitRate: 11.67, status: "关注" },
        { group: "技术部", name: "仿真能力扩容", code: "JS-CON-02", annualPr: 88.60, decemberPr: 7.20, prRate: 8.13, annualTransit: 27.30, decemberTransit: 2.10, transitRate: 7.69, status: "正常" },
        { group: "设备管理部", name: "设备可靠性提升", code: "SB-CON-01", annualPr: 210.30, decemberPr: 25.60, prRate: 12.17, annualTransit: 49.04, decemberTransit: 6.60, transitRate: 13.46, status: "关注" },
        { group: "设备管理部", name: "备件结构优化", code: "SB-CON-02", annualPr: 112.80, decemberPr: 8.90, prRate: 7.89, annualTransit: 24.10, decemberTransit: 1.80, transitRate: 7.47, status: "正常" },
      ],
      supplier: [
        { group: "供应商3 · 高级", name: "供应商3 · 高级技术顾问", code: "SUP-03-AQ", department: "安全运行部", net: 79.20, months: 18, monthly: 44000, ratio: 1.23, status: "异常" },
        { group: "供应商3 · 高级", name: "供应商3 · 高级技术顾问", code: "SUP-03-JS", department: "技术部", net: 64.80, months: 18, monthly: 36000, ratio: 1.23, status: "异常" },
        { group: "供应商2 · 中级", name: "供应商2 · 中级工程师", code: "SUP-02-JS", department: "技术部", net: 48.00, months: 16, monthly: 30000, ratio: 1.08, status: "正常" },
        { group: "供应商2 · 中级", name: "供应商2 · 中级工程师", code: "SUP-02-SB", department: "设备管理部", net: 44.40, months: 16, monthly: 27750, ratio: 1.08, status: "正常" },
        { group: "供应商4 · 初级", name: "供应商4 · 初级工程师", code: "SUP-04-AQ", department: "安全运行部", net: 28.80, months: 16, monthly: 18000, ratio: 1.05, status: "正常" },
        { group: "供应商4 · 初级", name: "供应商4 · 初级工程师", code: "SUP-04-SB", department: "设备管理部", net: 27.60, months: 16, monthly: 17250, ratio: 1.05, status: "正常" },
      ],
    },
    supervision: [
      { title: "概率安全分析项目预算覆盖复核", owner: "安全运行部", status: "业务复核完成", basis: "项目可用余额 -20.50 万元" },
      { title: "设备项目年末采购占用清理", owner: "设备管理部", status: "业务跟踪中", basis: "年末占用集中度 13.46%" },
    ],
  };

  const riskCounts = riskCompanies.reduce((result, item) => {
    result[item.riskTier] = (result[item.riskTier] || 0) + 1;
    return result;
  }, { "绿灯": 0, "黄灯": 0, "红灯": 0, "黑灯": 0 });

  const risk = {
    id: "risk",
    scenarioId: "S003",
    name: "债务风险监测驾驶舱",
    description: "按企业、产业和风险分档查看正式评估结果，并穿透企业报告与处置进展。",
    period: "2025-12-31",
    dataLabel: "债务风险评估数据 2025-12-31",
    semanticLabel: "债务风险模型 1.0.2",
    updatedAt: "2026-08-17 19:40",
    metrics: [
      { key: "companies", label: "纳入评估企业", value: riskCompanies.length, display: String(riskCompanies.length), unit: "家", change: "3 个产业 · 2 个经营阶段", trend: "flat", note: "当前评估轮次全部企业" },
      { key: "average", label: "集团平均风险评分", value: Number(riskSummary.averageFinalScore || 52.23), display: String(riskSummary.averageFinalScore || 52.23), unit: "分", change: "当前正式结果", trend: "flat", note: "21 家企业最终评分平均值" },
      { key: "alerts", label: "黄 / 红 / 黑", value: riskCounts["黄灯"] + riskCounts["红灯"] + riskCounts["黑灯"], display: `${riskCounts["黄灯"]} / ${riskCounts["红灯"]} / ${riskCounts["黑灯"]}`, unit: "家", change: "需持续跟踪", trend: "flat", note: "按当前风险分档统计" },
      { key: "todos", label: "负责人待办", value: 1, display: "1", unit: "笔", change: "红灯企业处置", trend: "flat", note: "人工确认后形成" },
    ],
    thresholds: [
      { name: "绿灯", range: "≥ 40 分", count: riskCounts["绿灯"], color: "#16806a" },
      { name: "黄灯", range: "25—40 分", count: riskCounts["黄灯"], color: "#d39a2c" },
      { name: "红灯", range: "10—25 分", count: riskCounts["红灯"], color: "#c84a43" },
      { name: "黑灯", range: "< 10 分", count: riskCounts["黑灯"], color: "#344256" },
    ],
    companies: riskCompanies,
    actions: [
      { enterpriseId: "S003-ENT-020", enterprise: "环保测试公司4", category: "环保", tier: "红灯", score: 23.05, decisionStatus: "已形成负责人待办", actionTypeId: "S003_SPECIAL_DISPOSAL", actionTypeName: "专项风险处置", actionTypeVersion: "1.0.2", memberUnitId: "S003-UNIT-020", recipientId: "S003-CONTACT-020", recipient: "环保测试公司4债务风险接口人", recommendedOwner: "环保测试公司4债务风险责任人", focus: "资金余缺预警与偿债安排", basis: "当月资金余缺预警，综合评分 23.05 分，命中红灯分档。", recommendation: "逐笔核实未来三个月到期债务、回款、可动用授信和应急资金来源，形成专项处置安排。" },
      { enterpriseId: "S003-ENT-007", enterprise: "风电测试公司07", category: "新能源产业-风电", tier: "黄灯", score: 37.75, decisionStatus: "待接口人确认", actionTypeId: "S003_RISK_FOLLOW_UP", actionTypeName: "风险分档跟踪", actionTypeVersion: "1.0.2", memberUnitId: "S003-UNIT-007", recipientId: "S003-CONTACT-007", recipient: "风电测试公司07债务风险接口人", recommendedOwner: "风电测试公司07债务风险责任人", focus: "利息保障倍数", basis: "利息保障倍数为本轮重点关注指标，综合评分 37.75 分，命中黄灯分档。", recommendation: "核实利息费用、利润总额和未来偿债现金流，按月跟踪保障倍数变化。" },
      { enterpriseId: "S003-ENT-017", enterprise: "环保测试公司1", category: "环保", tier: "黄灯", score: 30.52, decisionStatus: "待接口人确认", actionTypeId: "S003_RISK_FOLLOW_UP", actionTypeName: "风险分档跟踪", actionTypeVersion: "1.0.2", memberUnitId: "S003-UNIT-017", recipientId: "S003-CONTACT-017", recipient: "环保测试公司1债务风险接口人", recommendedOwner: "环保测试公司1债务风险责任人", focus: "现金流动负债比率", basis: "经营现金流对流动负债覆盖偏弱，综合评分 30.52 分，命中黄灯分档。", recommendation: "核实经营现金流、流动负债到期结构和回款安排，形成滚动偿债计划。" },
      { enterpriseId: "S003-ENT-018", enterprise: "环保测试公司2", category: "环保", tier: "黄灯", score: 33.92, decisionStatus: "待接口人确认", actionTypeId: "S003_RISK_FOLLOW_UP", actionTypeName: "风险分档跟踪", actionTypeVersion: "1.0.2", memberUnitId: "S003-UNIT-018", recipientId: "S003-CONTACT-018", recipient: "环保测试公司2债务风险接口人", recommendedOwner: "环保测试公司2债务风险责任人", focus: "资产负债率", basis: "资产负债率为本轮重点关注指标，综合评分 33.92 分，命中黄灯分档。", recommendation: "复核有息负债、权益缓冲和资产盘活安排，明确杠杆改善目标与验证时点。" },
      { enterpriseId: "S003-ENT-019", enterprise: "环保测试公司3", category: "环保", tier: "黄灯", score: 37.31, decisionStatus: "尚未提交", actionTypeId: "S003_RISK_FOLLOW_UP", actionTypeName: "风险分档跟踪", actionTypeVersion: "1.0.2", memberUnitId: "S003-UNIT-019", recipientId: "S003-CONTACT-019", recipient: "环保测试公司3债务风险接口人", recommendedOwner: "环保测试公司3债务风险责任人", focus: "利息保障倍数", basis: "利息保障倍数为本轮重点关注指标，综合评分 37.31 分，命中黄灯分档。", recommendation: "核实盈利、利息支出和债务滚续安排，设置月度保障倍数观察值。" },
    ],
    modelConfig: {
      configurationId: "S003-M01-MODEL-CONFIGURATION",
      configurationVersion: "3.0.0",
      publishedVersion: "1.0.2",
      pointerId: "S003-M01-PUBLISHED-POINTER",
      owner: "本体管理",
      businessOwner: "财务公司",
      status: "已发布",
      formedAt: "2026-08-17 16:30",
      sections: [
        { id: "overview", label: "配置总览", description: "当前模型版本、权威指针和生效流程。" },
        { id: "weights", label: "评分权重", description: "按企业类别维护十五项财务指标权重，每类合计 100%。" },
        { id: "factors", label: "调节因子", description: "维护适用范围、档位和系数；企业当期取值仍来自独立输入快照。" },
        { id: "tiers", label: "风险分档", description: "维护绿、黄、红、黑四档阈值，连续覆盖且不重叠。" },
      ],
      indicators: ["总资产", "净利润", "经营活动产生的现金流入", "现金比率", "资产负债率", "利息保障倍数", "现金流动负债比率", "应收账款周转率", "总资产周转率", "总资产收益率", "净资产收益率", "销售毛利率", "营业利润率", "盈利稳定性", "股东权益同比增长率"],
      weights: {
        "新能源产业-风电": [5, 5, 10, 5, 10, 5, 5, 5, 5, 5, 5, 5, 10, 15, 5],
        "核电": [5, 5, 5, 5, 10, 5, 5, 5, 5, 10, 10, 5, 10, 10, 5],
        "环保": [5, 5, 15, 5, 5, 5, 5, 20, 5, 5, 5, 5, 5, 5, 5],
      },
      factors: [
        { factorId: "credit-utilization", name: "融资能力（已用授信余额/授信总额）", range: "全量企业", applicableCategories: ["ALL"], tiers: [{ tierId: "ZERO", label: "融资使用率小于等于50%", coefficient: 0 }, { tierId: "MID", label: "融资使用率大于50%且小于等于80%", coefficient: -0.1 }, { tierId: "HIGH", label: "融资使用率大于80%", coefficient: -0.2 }] },
        { factorId: "guarantee", name: "担保情况", range: "全量企业", applicableCategories: ["ALL"], tiers: [{ tierId: "ZERO", label: "未涉及担保", coefficient: 0 }, { tierId: "EXTERNAL", label: "仅提供对外担保", coefficient: -0.05 }, { tierId: "RECEIVED", label: "仅接受担保", coefficient: 0.05 }] },
        { factorId: "headquarters-support", name: "总部支持程度", range: "全量企业", applicableCategories: ["ALL"], tiers: [{ tierId: "FULL", label: "总部持股比例100%", coefficient: 0.1 }, { tierId: "HIGH", label: "总部持股比例75%以上且小于100%", coefficient: 0.05 }, { tierId: "ZERO", label: "总部持股比例50%以上且小于75%", coefficient: 0 }, { tierId: "LOW", label: "总部持股比例25%以上且小于50%", coefficient: -0.05 }, { tierId: "VERY_LOW", label: "总部持股比例25%以下", coefficient: -0.1 }] },
        { factorId: "electricity-price", name: "电价波动率", range: "新能源产业-风电、核电", applicableCategories: ["新能源产业-风电", "核电"], tiers: [{ tierId: "LOW", label: "电价变化率小于等于-15%", coefficient: -0.2 }, { tierId: "MID", label: "电价变化率大于-15%且小于等于0", coefficient: -0.1 }, { tierId: "ZERO", label: "电价变化率大于0", coefficient: 0 }] },
        { factorId: "litigation", name: "是否存在重大诉讼", range: "全量企业", applicableCategories: ["ALL"], tiers: [{ tierId: "ZERO", label: "诉讼标的小于净资产1%", coefficient: 0 }, { tierId: "MID", label: "诉讼标的为净资产1%至5%", coefficient: -0.05 }, { tierId: "HIGH", label: "诉讼标的大于净资产5%", coefficient: -0.15 }] },
        { factorId: "fund-gap", name: "资金余缺预警", range: "全量企业", applicableCategories: ["ALL"], tiers: [{ tierId: "ZERO", label: "无资金缺口", coefficient: 0 }, { tierId: "CURRENT", label: "当月资金余缺预警", coefficient: -0.3 }, { tierId: "M1", label: "未来第一个月资金余缺预警", coefficient: -0.2 }, { tierId: "M2", label: "未来第二个月资金余缺预警", coefficient: -0.1 }, { tierId: "M3", label: "未来第三个月资金余缺预警", coefficient: -0.05 }] },
      ],
      tiers: [
        { tierId: "GREEN", name: "绿灯", minInclusive: 40, range: "≥ 40 分", tone: "success" },
        { tierId: "YELLOW", name: "黄灯", minInclusive: 25, range: "25 ≤ 分值 < 40", tone: "warning" },
        { tierId: "RED", name: "红灯", minInclusive: 10, range: "10 ≤ 分值 < 25", tone: "danger" },
        { tierId: "BLACK", name: "黑灯", minInclusive: 0, range: "< 10 分", tone: "plain" },
      ],
      semantics: ["在建企业原始分固定为 60 分", "盈利历史不足按 A 档 100 分", "适用但缺失使用 DEFAULTED_ZERO", "业务不适用使用 NOT_APPLICABLE", "非法或越界值阻断发布与重评"],
    },
    runHistory: [
      { runId: "S003-RUN-20260817163000000-c02200000001", status: "正式评估", model: "1.0.2", data: "S003-T007-DEBT-RISK-20251231-v1", result: "21 家 · 绿 16 / 黄 4 / 红 1 / 黑 0", at: "2026-08-17 16:30" },
      { runId: "S003-RUN-20260815133000000-c03503000001", status: "上一正式运行", model: "1.0.0", data: "历史固定资产引用", result: "21 家 · 已归档只读", at: "2026-08-15 13:30" },
    ],
  };

  const postInvestment = {
    id: "post-investment",
    scenarioId: "S005",
    scenarioVersion: "S005-v1",
    name: "金融产品投后评价驾驶舱",
    description: "汇总当前 S005 评价轮次的六域状态、指标覆盖、结论与可回溯证据。",
    period: "等待当前轮次",
    dataLabel: "当前评价轮次",
    semanticLabel: "S005-v1 候选评价口径",
    updatedAt: "等待读取",
    status: "等待评价",
    metrics: [],
  };

  const s003ModelingConsumer = Object.freeze({
    schemaVersion: "ofw.dashboard.s003-modeling-consumer.v1",
    consumerId: "dashboard",
    objective: {
      objectiveId: "MO-S003-DEBT-RISK-EARLY-WARNING-v1",
      kind: "SCORING",
      acceptedObjectTypes: ["Enterprise", "EnterpriseAssessmentContext"],
      businessQuestion: "哪些企业可能在未来180天发生重大债务风险，风险来自哪些指标和因子？",
    },
    formalBinding: {
      modelVersion: "1.0.2",
      modelVersionId: "S003-M01-DEBT-RISK-PKG@1.0.2",
      bindingId: "CB-S003-DASHBOARD-DEBT-RISK",
      bindingRevision: "1",
      dataVersionId: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
      ontologyVersionId: "S003-M01-PUBLISHED-ONTOLOGY@2026-08-17",
      assessmentAsOf: "2025-12-31",
      resultKind: "FACT",
    },
    benchmark: {
      status: "等待 M08 工作区",
      metric: "固定处置容量下的重大事件召回率",
    },
    views: [
      { id: "formal", label: "正式结果", resultKind: "FACT", useKind: "FORMAL" },
      { id: "candidate", label: "候选试算", resultKind: "PREDICTION", useKind: "WHAT_IF" },
      { id: "difference", label: "差异", resultKind: "PREDICTION", useKind: "SHADOW" },
    ],
    selectionFields: [
      { id: "modelVersionId", label: "Model Version", source: "workspace.candidates", required: true },
      { id: "asOf", label: "asOf", source: "formalBinding.assessmentAsOf", required: true },
      { id: "dataVersionId", label: "固定 DataVersion", source: "formalBinding.dataVersionId", required: true, immutable: true },
      { id: "enterpriseScope", label: "企业范围", source: "workspace.enterpriseScopes", required: true },
      { id: "useKind", label: "用途", options: ["BENCHMARK", "SHADOW"], required: true },
    ],
    resultEnvelope: {
      schemaVersion: "ofw.modeling.result-envelope.v1",
      acceptedSchemaVersions: ["ofw.modeling.result-envelope.v1", "ofw.m08.result-envelope.v1"],
      acceptedResultKinds: ["FACT", "PREDICTION"],
      acceptedCandidateUseKinds: ["WHAT_IF", "SHADOW"],
      subjectCollectionAliases: ["outputs", "enterprises", "subjects"],
      subjectIdentityAliases: ["enterpriseId", "objectId", "subjectId"],
      scoreAliases: ["riskScore", "finalScore", "score"],
      tierAliases: ["predictedRiskTier", "riskTier", "tier"],
      contributorCollectionAliases: ["topContributors", "contributors", "contributions"],
      projectionRoles: ["riskDistribution", "industrySlices", "stageSlices", "enterpriseScores", "migrationMatrix", "contributionChanges", "benchmark"],
    },
    messages: {
      scenarioFocus: "OFW_DASHBOARD_SCENARIO_FOCUS",
      contextRequest: "OFW_S003_MODELING_CONTEXT_REQUEST",
      contextResponse: "OFW_S003_MODELING_CONTEXT",
      openObjective: "OFW_S003_OPEN_MODELING_OBJECTIVE",
      recalculateRequest: "OFW_S003_MODELING_RECALCULATE_REQUEST",
      resultResponse: "OFW_S003_MODELING_RESULT",
      errorResponse: "OFW_S003_MODELING_ERROR",
    },
  });

  window.DASHBOARD_DATA = Object.freeze({
    version: "ofw.dashboard.composite.v1.2.0-rc.1",
    dashboards: [financing, budget, risk, postInvestment],
    consumerSchemas: Object.freeze({ s003Modeling: s003ModelingConsumer }),
  });
})();
