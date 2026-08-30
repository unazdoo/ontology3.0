(() => {
  "use strict";

  const months = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
  const points = (values) => months.map((date, index) => ({ date, value: values[index] }));
  const dailyDates = ["2026-01-02", "2026-01-16", "2026-01-30", "2026-02-13", "2026-02-27", "2026-03-13", "2026-03-27", "2026-04-10", "2026-04-24", "2026-05-08", "2026-05-22", "2026-06-05", "2026-06-19", "2026-07-03", "2026-07-17"];
  const daily = (values) => dailyDates.map((date, index) => ({ date, value: values[index] }));

  window.S005_FULL_CHAIN_DATA = {
    meta: {
      scenarioId: "S005",
      scenarioVersion: "S005-v1",
      namespace: "ofw.s005.research.v1",
      activeBaseline: "v1.1.0",
      rollbackBaseline: "v1.0.3",
      baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7",
      asOf: "2026-07-17",
      sourceStatus: "部分可得 · 研究夹具",
      formulaVersion: "S005-RESEARCH-METHOD-V0.3",
      evaluationState: "部分评价"
    },
    stages: [
      { id: "M02", label: "数据工程", short: "来源批次", icon: "database", owner: "M02", description: "快照、Wind 导出、官方事件与质量证据" },
      { id: "M01", label: "分类与语义", short: "范围映射", icon: "network", owner: "M01", description: "Wind fund_type 与一期允许范围映射" },
      { id: "C01", label: "持续合规", short: "准入跟踪", icon: "shield-check", owner: "M02 / 业务", description: "处罚、监管措施、管理人和底层范围" },
      { id: "C02", label: "市场横评", short: "同类基金", icon: "bar-chart-3", owner: "M02", description: "市场同类基金池、基准和前三分之一" },
      { id: "C03", label: "池内选择", short: "选择能力", icon: "git-compare", owner: "业务 / M02", description: "选中、未选与前瞻窗口差异" },
      { id: "C04", label: "交易与风险", short: "投后监控", icon: "activity", owner: "M02 / 业务", description: "择时、回撤、波动、归因和操作风险" },
      { id: "M06", label: "报告中心", short: "研究结果", icon: "file-text", owner: "M06", description: "研究草稿、证据链和诚实降级" }
    ],
    sourceBatch: {
      count: 79,
      dateRange: "2025-02-21 至 2026-07-17",
      workbookBytes: "4,042,246",
      sheetInstances: 393,
      distinctSheetNames: 5,
      structures: 2,
      cadence: "54 个七日间隔 · 24 个非常规间隔",
      hashMode: "SHA-256",
      sourcePath: "投资情况明细表/投资业务台账（YYYYMMDD）.xlsx",
      firstHash: "7fb801b4179101d729ce9fe193110ef1a0c7b94cbf2fafe9713696bfe439bdd2",
      lastHash: "ba69d8043eeae731eb66a087bca9cc605b899dd73c09d88ede8c14d80aed2a31",
      structureChange: "2025-10-20 缺少两张风险表，后续恢复；不做邻期填补",
      fields: [
        { sheet: "投资项目每周简报", role: "产品持仓快照", fields: "证券代码、证券名称、投资分类、持仓数量、投资金额、当前市值、浮动盈亏", records: "17–28 / 期", quality: "产品代码为强候选键" },
        { sheet: "债券投资交易风险监控周报表", role: "债券交易风险", fields: "债券名称、面值、买入净价、当前净价、累计收益率", records: "1 / 期", quality: "不能由邻期差分推断交易" },
        { sheet: "固收业务风险监控周报表", role: "固收持仓风险", fields: "发行人、单户集中度、占比、投资期限、总投资额", records: "15–25 / 期", quality: "发行人名称需主数据确认" },
        { sheet: "投资风险限额监控表", role: "限额快照", fields: "投资品种、仓位、风险限额、实际比例、限额状态", records: "6–8 / 期", quality: "仅为周期间快照" }
      ],
      sampleRows: [
        { date: "2025-02-21", file: "投资业务台账（20250221）.xlsx", hash: "7fb801b4…39bdd2", structure: "INITIAL", records: 21 },
        { date: "2025-10-20", file: "投资业务台账（20251020）.xlsx", hash: "e517bb49…5e4c", structure: "缺两张风险表", records: 19 },
        { date: "2026-07-17", file: "投资业务台账（20260717）.xlsx", hash: "ba69d804…ed2a31", structure: "UNCHANGED", records: 26 }
      ]
    },
    windExport: {
      batch: "WIND-S005-FUND-20260717-001",
      state: "待导入",
      provider: "Wind 许可导出",
      fields: "基金代码、基金简称、fund_type、单位净值、复权净值、净值日期、基准、存续状态、基金经理",
      frequency: "日频 NAV；评价日点时截面",
      note: "当前页面以脱敏夹具演示字段和流程，不把周快照冒充日频"
    },
    categories: [
      { id: "rate", label: "利率债", windType: "债券型-利率债", rule: "内部债券品种映射", note: "直接债券持仓，不含权益" },
      { id: "short", label: "短期纯债基金", windType: "短期纯债型基金", rule: "Wind fund_type", note: "久期与期限单独展示" },
      { id: "medium", label: "中长期纯债基金", windType: "中长期纯债型基金", rule: "Wind fund_type", note: "默认市场同类示例" },
      { id: "first", label: "混合一级债基", windType: "混合一级债券型基金", rule: "Wind fund_type", note: "需跟踪转债/权益穿透" },
      { id: "second", label: "混合二级债基", windType: "混合二级债券型基金", rule: "Wind fund_type", note: "允许范围内的最高权益弹性" }
    ],
    products: [
      { id: "F-A", name: "基金 A", code: "PRD-223C4E179176A5FB", category: "混合二级债基", windType: "混合二级债券型基金", manager: "管理人甲（脱敏）", semantic: "已映射", status: "需复核", tone: "warning", equity: "8.4%", convert: "5.1%", peerRank: "前 27%", selected: true },
      { id: "F-B", name: "基金 B", code: "PRD-3ADC1B8FB9E03B0E", category: "中长期纯债基金", windType: "中长期纯债型基金", manager: "管理人乙（脱敏）", semantic: "已映射", status: "符合范围", tone: "success", equity: "0%", convert: "0%", peerRank: "前 39%", selected: false },
      { id: "F-C", name: "基金 C", code: "PRD-3B8D17A841F6786E", category: "混合一级债基", windType: "混合一级债券型基金", manager: "管理人丙（脱敏）", semantic: "待人工确认", status: "无法判断", tone: "neutral", equity: "缺失", convert: "缺失", peerRank: "观察期不足", selected: true },
      { id: "F-D", name: "基金 D", code: "PRD-471C3465F80997F5", category: "短期纯债基金", windType: "短期纯债型基金", manager: "管理人丁（脱敏）", semantic: "已映射", status: "符合范围", tone: "success", equity: "0%", convert: "0%", peerRank: "前 45%", selected: false },
      { id: "F-E", name: "基金 E", code: "PRD-52F0C2C2D5A10E66", category: "利率债", windType: "债券型-利率债", manager: "管理人戊（脱敏）", semantic: "已映射", status: "符合范围", tone: "success", equity: "0%", convert: "0%", peerRank: "前 31%", selected: false },
      { id: "F-F", name: "基金 F", code: "PRD-6AA31F9E8D2C2A10", category: "股票型基金", windType: "股票型基金", manager: "管理人己（脱敏）", semantic: "超出一期范围", status: "不在允许范围", tone: "danger", equity: "72.1%", convert: "0%", peerRank: "不参与", selected: false }
    ],
    complianceSources: [
      { id: "CSRC-P", name: "中国证监会行政处罚目录", authority: "中国证监会官网", freshness: "2026-07-18", state: "可核验", tone: "success", url: "https://www.csrc.gov.cn/", use: "管理人处罚与监管事件原文、公告日期、正文哈希" },
      { id: "CSRC-R", name: "中国证监会监管措施目录", authority: "中国证监会官网", freshness: "2026-07-18", state: "可核验", tone: "success", url: "https://www.csrc.gov.cn/", use: "监管措施、整改和对象主体映射" },
      { id: "AMAC", name: "中基协机构 / 产品 / 自律信息", authority: "中国证券投资基金业协会", freshness: "2026-07-17", state: "可核验", tone: "success", url: "https://www.amac.org.cn/", use: "管理人登记、产品状态和自律处分交叉核验" },
      { id: "MGR", name: "基金管理人公告", authority: "管理人官方网站", freshness: "2026-07-17", state: "人工复核", tone: "warning", url: "https://www.csrc.gov.cn/", use: "重大事项、估值、暂停申赎和风格变化" }
    ],
    complianceRows: [
      { product: "基金 A", manager: "管理人甲（脱敏）", status: "需复核", tone: "warning", fact: "监管措施 · 2026-05-18", rule: "事件回溯窗口与整改状态待确认", source: "CSRC-R / 管理人公告", freshness: "34 天" },
      { product: "基金 B", manager: "管理人乙（脱敏）", status: "符合范围", tone: "success", fact: "未发现已确认处罚", rule: "Wind 分类 + 最近持仓可见", source: "Wind / CSRC-P / AMAC", freshness: "12 天" },
      { product: "基金 C", manager: "管理人丙（脱敏）", status: "无法判断", tone: "neutral", fact: "管理人主体映射缺失", rule: "未知不等于通过", source: "AMAC 待核", freshness: "76 天" },
      { product: "基金 D", manager: "管理人丁（脱敏）", status: "符合范围", tone: "success", fact: "未发现已确认事件", rule: "Wind 分类 + 权益 0%", source: "Wind / CSRC-P / AMAC", freshness: "12 天" },
      { product: "基金 E", manager: "管理人戊（脱敏）", status: "符合范围", tone: "success", fact: "利率债范围匹配", rule: "债券品种映射", source: "Wind / 中债", freshness: "12 天" },
      { product: "基金 F", manager: "管理人己（脱敏）", status: "不在允许范围", tone: "danger", fact: "Wind fund_type=股票型基金", rule: "一期仅允许五类范围", source: "Wind 分类", freshness: "12 天" }
    ],
    market: {
      defaultCategory: "中长期纯债基金",
      categories: ["利率债", "短期纯债基金", "中长期纯债基金", "混合一级债基", "混合二级债基"],
      sampleCount: 1284,
      included: 1172,
      excluded: 112,
      asOf: "2026-07-17",
      sampleRule: "评价日可得、存续/历史退出保留、同类分类版本 WIND-FUND-TYPE-2026Q2",
      series: [
        { key: "pool", label: "入池基金组合", color: "#315fae", values: [100, 100.8, 101.5, 102.1, 102.8, 103.5, 104.0, 104.9, 105.4, 106.1, 106.7, 107.4] },
        { key: "median", label: "同类中位数", color: "#16718a", values: [100, 100.4, 100.9, 101.6, 102.0, 102.6, 103.1, 103.7, 104.0, 104.4, 105.0, 105.6] },
        { key: "topThird", label: "同类前三分之一", color: "#a45c12", values: [100, 100.7, 101.2, 102.0, 102.6, 103.3, 103.9, 104.6, 105.1, 105.7, 106.3, 107.0] },
        { key: "benchmark", label: "合同基准", color: "#64743a", values: [100, 100.2, 100.6, 101.1, 101.7, 102.0, 102.4, 102.9, 103.2, 103.7, 104.1, 104.5] },
        { key: "selected", label: "实际交易子集", color: "#6750a4", values: [100, 100.7, 101.7, 102.5, 103.2, 104.1, 104.9, 105.7, 106.4, 107.1, 107.9, 108.3] }
      ],
      table: [
        { name: "基金 A", category: "混合二级债基", nav: "1.086", excess: "+0.82%", sharpe: "1.38", drawdown: "-1.86%", rank: "前 27%", state: "入池" },
        { name: "基金 B", category: "中长期纯债基金", nav: "1.072", excess: "+0.51%", sharpe: "1.12", drawdown: "-0.92%", rank: "前 39%", state: "入池" },
        { name: "基金 C", category: "混合一级债基", nav: "1.064", excess: "+0.38%", sharpe: "0.94", drawdown: "-1.20%", rank: "观察期不足", state: "入池" },
        { name: "同类中位数", category: "中长期纯债基金", nav: "1.056", excess: "基准", sharpe: "0.87", drawdown: "-1.31%", rank: "P50", state: "比较线" },
        { name: "同类前三分之一", category: "中长期纯债基金", nav: "1.070", excess: "基准", sharpe: "1.26", drawdown: "-1.08%", rank: "P33", state: "比较线" }
      ]
    },
    selection: {
      decisionId: "DEC-S005-20260717-004",
      frozenAt: "2026-07-17 09:10",
      executablePool: "5 只（合规状态可见）",
      selectedCount: 2,
      unselectedCount: 3,
      spread: "+0.42 个百分点",
      confidence: "95% CI [+0.08%, +0.76%]",
      series: [
        { key: "selected", label: "已选交易", color: "#315fae", values: [100, 100.9, 101.9, 102.7, 103.4, 104.4, 105.1, 106.0, 106.6, 107.2, 108.0, 108.5] },
        { key: "unselected", label: "池内未选", color: "#9aaab8", values: [100, 100.2, 100.8, 101.3, 101.9, 102.4, 102.9, 103.7, 104.1, 104.7, 105.3, 106.0] },
        { key: "peer", label: "同类中位数", color: "#16718a", values: [100, 100.4, 100.9, 101.6, 102.0, 102.6, 103.1, 103.7, 104.0, 104.4, 105.0, 105.6] }
      ],
      windows: [
        { label: "T+1", selected: "+0.06%", unselected: "+0.02%", spread: "+0.04%", confidence: "低" },
        { label: "T+5", selected: "+0.18%", unselected: "+0.10%", spread: "+0.08%", confidence: "中" },
        { label: "T+20", selected: "+0.46%", unselected: "+0.21%", spread: "+0.25%", confidence: "中" },
        { label: "T+60", selected: "+1.24%", unselected: "+0.82%", spread: "+0.42%", confidence: "高" }
      ],
      reasons: [
        { label: "策略配置", value: 2, color: "#315fae" },
        { label: "流动性", value: 1, color: "#16718a" },
        { label: "现金计划", value: 1, color: "#a45c12" },
        { label: "额度保留", value: 1, color: "#64743a" }
      ]
    },
    trading: {
      trades: [
        { date: "2026-07-15", name: "基金 A", category: "混合二级债基", action: "申购", ref: "下一可得 NAV", expected: "1.084", actual: "1.086", slippage: "+1.2bp", pnl: "+0.08%", settlement: "已核对", tone: "success" },
        { date: "2026-07-08", name: "基金 C", category: "混合一级债基", action: "赎回", ref: "确认 NAV", expected: "1.061", actual: "待现金流", slippage: "待补", pnl: "+0.03%", settlement: "待现金流", tone: "warning" },
        { date: "2026-06-26", name: "利率债 A", category: "利率债", action: "买入", ref: "中债收益率曲线", expected: "2.18%", actual: "2.21%", slippage: "+2.8bp", pnl: "-0.11%", settlement: "已核对", tone: "success" },
        { date: "2026-06-18", name: "利率债 B", category: "利率债", action: "卖出", ref: "CFETS 参考价", expected: "99.82", actual: "99.79", slippage: "+1.7bp", pnl: "+0.16%", settlement: "结算完成", tone: "success" },
        { date: "2026-05-21", name: "基金 B", category: "中长期纯债基金", action: "未交易", ref: "可执行池", expected: "-", actual: "-", slippage: "-", pnl: "-", settlement: "未选原因已记录", tone: "neutral" }
      ],
      drawdown: daily([-0.18, -0.31, -0.42, -0.66, -0.91, -0.72, -1.08, -0.86, -1.27, -1.12, -1.58, -1.42, -1.86, -1.51, -1.63]),
      metrics: [
        { key: "twr", label: "产品 TWR", value: "+7.40%", note: "单位净值时间加权", tone: "positive" },
        { key: "mwr", label: "实际 MWR", value: "+6.92%", note: "资金加权 / 现金流待补", tone: "warning" },
        { key: "sharpe", label: "夏普比率", value: "1.38", note: "日频年化 · 无风险利率可替换", tone: "positive" },
        { key: "sortino", label: "Sortino", value: "1.91", note: "下行波动惩罚", tone: "positive" },
        { key: "calmar", label: "Calmar", value: "3.98", note: "年化收益 / 最大回撤", tone: "positive" },
        { key: "vol", label: "年化波动", value: "1.86%", note: "日收益标准差年化", tone: "neutral" },
        { key: "dd", label: "最大回撤", value: "-1.86%", note: "高点到低点", tone: "negative" },
        { key: "ir", label: "信息比率", value: "0.74", note: "相对合同基准", tone: "positive" }
      ],
      attribution: [
        { label: "票息 / Carry", value: "+0.86%", width: 86, tone: "positive" },
        { label: "骑乘 / Roll-down", value: "+0.31%", width: 44, tone: "positive" },
        { label: "曲线 / Curve", value: "+0.18%", width: 27, tone: "positive" },
        { label: "信用 / Spread", value: "-0.09%", width: 15, tone: "negative" },
        { label: "选择 / Selection", value: "+0.42%", width: 62, tone: "positive" },
        { label: "择时 / Timing", value: "+0.16%", width: 24, tone: "positive" },
        { label: "费用 / 现金拖累", value: "-0.21%", width: 31, tone: "negative" }
      ],
      macro: [
        { label: "政策利率", value: "1.50%", note: "人民银行公开市场操作" },
        { label: "DR007", value: "1.68%", note: "中国货币网 / 日频" },
        { label: "10Y 国债收益率", value: "1.92%", note: "中债收益率曲线" },
        { label: "市场状态", value: "利率下行后震荡", note: "研究标签，不作预测" }
      ]
    },
    riskLamps: [
      { label: "范围与合规", value: "黄", detail: "2 条复核 / 1 条未知 / 1 条超范围", tone: "warning" },
      { label: "权益与转债暴露", value: "灰", detail: "季度穿透未齐", tone: "neutral" },
      { label: "久期与利率", value: "绿", detail: "研究夹具范围内稳定", tone: "success" },
      { label: "集中度", value: "绿", detail: "前五占比 36.8%", tone: "success" },
      { label: "流动性与赎回", value: "黄", detail: "1 笔现金流待补", tone: "warning" },
      { label: "估值与数据", value: "黄", detail: "日 NAV / Wind 批次待导入", tone: "warning" },
      { label: "操作与事件", value: "绿", detail: "无已确认结算失败", tone: "success" }
    ],
    modules: [
      { id: "M01", name: "本体管理", state: "只读关联", tone: "warning", detail: "产品、管理人、发行人和范围语义候选", href: "http://127.0.0.1:4342/ontology-management-review/canvas-first/index.html" },
      { id: "M02", name: "数据工程", state: "研究输入", tone: "success", detail: "快照、Wind 导出、官方事件与质量证据", href: "http://127.0.0.1:4342/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html" },
      { id: "M03", name: "智能问数", state: "后置消费", tone: "warning", detail: "一期不接入评价重算", href: "http://127.0.0.1:4342/intelligent-query-prototype/review-next/conversation-workspace/index.html" },
      { id: "M04", name: "决策中心", state: "只读禁用", tone: "danger", detail: "不创建 Action / 待办 / 审批", href: "http://127.0.0.1:4342/decision-center-prototype/review-v2/action-portfolio.html" },
      { id: "M05", name: "Agent 应用", state: "只读禁用", tone: "danger", detail: "不生成正式指标和风险判定", href: "http://127.0.0.1:4342/agent-application/Agent%E5%BA%94%E7%94%A8.html" },
      { id: "M06", name: "报告中心", state: "研究草稿", tone: "warning", detail: "只读结果，不写入正式报告", href: "http://127.0.0.1:4342/report-center/review-lifecycle/index.html" },
      { id: "M07", name: "多视图探索", state: "研究预留", tone: "neutral", detail: "未来承接产品 / 管理人 Lens", href: "#" },
      { id: "M08", name: "建模与数字孪生", state: "研究预留", tone: "neutral", detail: "候选比较，不写回生产状态", href: "#" }
    ],
    sources: [
      { name: "Wind 许可导出", state: "待接入", tone: "warning", detail: "日 NAV / fund_type / 基准 / 持仓穿透" },
      { name: "中国证监会处罚与监管措施", state: "可核验", tone: "success", detail: "官方目录、公告日期、正文哈希" },
      { name: "中基协机构 / 产品 / 自律信息", state: "可核验", tone: "success", detail: "登记状态与自律处分交叉核验" },
      { name: "中债 / 中证 / 中国货币网", state: "部分可得", tone: "warning", detail: "曲线、指数、回购和宏观状态" },
      { name: "管理人官方网站", state: "人工复核", tone: "warning", detail: "重大事项、估值、暂停申赎公告" }
    ]
  };
})();
