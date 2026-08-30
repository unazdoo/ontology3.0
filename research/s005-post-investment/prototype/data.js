(() => {
  "use strict";

  const months = ["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"];
  const series = (values) => months.map((date, index) => ({ date, value: values[index] }));

  window.S005_DATA = {
    meta: {
      scenarioId: "S005",
      scenarioVersion: "S005-research-v1",
      namespace: "ofw.s005.research.v1",
      activeBase: "v1.1.0",
      rollbackBase: "v1.0.3",
      baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7",
      asOf: "2026-07-17",
      sourceStatus: "研究夹具 · 待 Wind 导出",
      coverage: "示意数据 12/12 月；不代表生产数据覆盖",
      formulaVersion: "S005-RESEARCH-METHOD-V0.2"
    },
    kpis: [
      { label: "评价对象", value: "15", unit: "只候选", note: "脱敏回放候选", tone: "blue" },
      { label: "市场同类样本", value: "1,284", unit: "只", note: "研究夹具 · Wind 市场同类基金池待接入", tone: "blue" },
      { label: "准入合规", value: "12 / 2 / 1", unit: "通过 / 复核 / 未知", note: "事件源待补齐", tone: "amber" },
      { label: "池内选择差异", value: "+0.42", unit: "百分点", note: "匹配未选 · 12 月窗口", tone: "green" },
      { label: "已交易组合回撤", value: "-1.86", unit: "%", note: "研究夹具 · 日频待接入", tone: "red" },
      { label: "结论状态", value: "部分评价", unit: "", note: "日 NAV / 现金流缺口", tone: "amber" }
    ],
    marketSeries: [
      { key: "pool", label: "入池组合", color: "#1d5d8b", values: [100, 100.8, 101.5, 102.1, 102.8, 103.5, 104.0, 104.9, 105.4, 106.1, 106.7, 107.4] },
      { key: "peer", label: "同类中位数", color: "#4f8e8c", values: [100, 100.4, 100.9, 101.6, 102.0, 102.6, 103.1, 103.7, 104.0, 104.4, 105.0, 105.6] },
      { key: "peerTopThird", label: "同类前三分之一", color: "#bb7a35", values: [100, 100.7, 101.2, 102.0, 102.6, 103.3, 103.9, 104.6, 105.1, 105.7, 106.3, 107.0] },
      { key: "benchmark", label: "合同基准", color: "#a36a2a", values: [100, 100.2, 100.6, 101.1, 101.7, 102.0, 102.4, 102.9, 103.2, 103.7, 104.1, 104.5] },
      { key: "selected", label: "实际交易子集", color: "#7b5ea7", values: [100, 100.7, 101.7, 102.5, 103.2, 104.1, 104.9, 105.7, 106.4, 107.1, 107.9, 108.3] }
    ],
    selectionSeries: [
      { key: "selected", label: "已选交易", color: "#1d5d8b", values: [100, 100.9, 101.9, 102.7, 103.4, 104.4, 105.1, 106.0, 106.6, 107.2, 108.0, 108.5] },
      { key: "unselected", label: "池内未选", color: "#a9b6c1", values: [100, 100.2, 100.8, 101.3, 101.9, 102.4, 102.9, 103.7, 104.1, 104.7, 105.3, 106.0] }
    ],
    drawdownSeries: [
      { date: "2026-01-02", value: -0.18 }, { date: "2026-01-12", value: -0.42 }, { date: "2026-01-22", value: -0.31 }, { date: "2026-02-02", value: -0.66 }, { date: "2026-02-12", value: -0.54 }, { date: "2026-02-27", value: -0.91 }, { date: "2026-03-12", value: -0.72 }, { date: "2026-03-27", value: -1.08 }, { date: "2026-04-10", value: -0.86 }, { date: "2026-04-24", value: -1.27 }, { date: "2026-05-08", value: -1.12 }, { date: "2026-05-22", value: -1.58 }, { date: "2026-06-05", value: -1.42 }, { date: "2026-06-19", value: -1.86 }, { date: "2026-07-03", value: -1.51 }, { date: "2026-07-17", value: -1.63 }
    ],
    compliance: [
      { id: "PRD-223C4E179176A5FB", name: "基金 A", category: "混合二级债基", status: "复核", tone: "warning", manager: "管理人甲（脱敏）", exposure: "权益 8.4% · 转债 5.1%", event: "监管措施 · 2026-05-18", freshness: "34 天" },
      { id: "PRD-3ADC1B8FB9E03B0E", name: "基金 B", category: "中长期纯债", status: "通过", tone: "success", manager: "管理人乙（脱敏）", exposure: "权益 0% · 转债 0%", event: "未发现已确认事件", freshness: "12 天" },
      { id: "PRD-3B8D17A841F6786E", name: "基金 C", category: "混合一级债基", status: "未知", tone: "neutral", manager: "管理人丙（脱敏）", exposure: "穿透数据缺失", event: "中基协数据待核", freshness: "76 天" },
      { id: "PRD-471C3465F80997F5", name: "基金 D", category: "短期纯债", status: "通过", tone: "success", manager: "管理人丁（脱敏）", exposure: "权益 0% · 转债 0%", event: "未发现已确认事件", freshness: "12 天" }
    ],
    poolRows: [
      { name: "基金 A", category: "混合二级债基", nav: "1.086", excess: "+0.82%", vol: "1.92%", drawdown: "-1.86%", selected: "已选", reason: "策略配置", tone: "success" },
      { name: "基金 B", category: "中长期纯债", nav: "1.072", excess: "+0.51%", vol: "1.14%", drawdown: "-0.92%", selected: "未选", reason: "额度保留", tone: "neutral" },
      { name: "基金 C", category: "混合一级债基", nav: "1.064", excess: "+0.38%", vol: "1.47%", drawdown: "-1.20%", selected: "已选", reason: "流动性", tone: "success" },
      { name: "基金 D", category: "短期纯债", nav: "1.051", excess: "+0.14%", vol: "0.72%", drawdown: "-0.48%", selected: "未选", reason: "现金计划", tone: "neutral" },
      { name: "基金 E", category: "中长期纯债", nav: "1.048", excess: "+0.08%", vol: "1.33%", drawdown: "-1.08%", selected: "未选", reason: "人工保留", tone: "neutral" }
    ],
    tradeRows: [
      { date: "2026-07-15", name: "基金 A", action: "申购", ref: "下一可得 NAV", slippage: "+1.2bp", pnl: "+0.08%", status: "已核对", tone: "success" },
      { date: "2026-07-08", name: "基金 C", action: "赎回", ref: "确认 NAV", slippage: "-0.6bp", pnl: "+0.03%", status: "待现金流", tone: "warning" },
      { date: "2026-06-26", name: "利率债 A", action: "买入", ref: "中债收益率曲线", slippage: "+2.8bp", pnl: "-0.11%", status: "已核对", tone: "success" },
      { date: "2026-06-18", name: "利率债 B", action: "卖出", ref: "CFETS 参考价", slippage: "+1.7bp", pnl: "+0.16%", status: "结算完成", tone: "success" }
    ],
    riskLamps: [
      { label: "准入合规", value: "黄", detail: "2 条复核 / 1 条未知", tone: "warning" },
      { label: "权益与转债暴露", value: "灰", detail: "季度穿透未齐", tone: "neutral" },
      { label: "久期与利率", value: "绿", detail: "研究夹具范围内", tone: "success" },
      { label: "集中度", value: "绿", detail: "前五占比 36.8%", tone: "success" },
      { label: "流动性与赎回", value: "黄", detail: "2 只限购/待核", tone: "warning" },
      { label: "估值与数据", value: "黄", detail: "日 NAV 待导入", tone: "warning" },
      { label: "操作与事件", value: "绿", detail: "无已确认结算失败", tone: "success" }
    ],
    reasonRows: [
      { label: "额度保留", value: 5, color: "#7e9aaa" },
      { label: "流动性", value: 3, color: "#4f8e8c" },
      { label: "现金计划", value: 2, color: "#a36a2a" },
      { label: "策略/人工", value: 4, color: "#7b5ea7" },
      { label: "数据不足", value: 1, color: "#b4423d" }
    ],
    sources: [
      { label: "Wind 全市场导出", state: "待接入", detail: "许可定量主源 · 日 NAV / 分类 / 持仓" },
      { label: "证监会处罚与监管措施", state: "可核验", detail: "官方正文 · URL / 日期 / 哈希" },
      { label: "中基协机构 / 产品 / 基准", state: "可核验", detail: "公开查询 · 需主体类型复核" },
      { label: "中债 / 中证指数", state: "部分可得", detail: "曲线与指数规则公开，历史下载按许可" }
    ],
    modules: [
      { id: "M02", name: "数据工程", detail: "Wind 导出、官方事件、质量与证据", state: "研究输入", href: "http://127.0.0.1:4342/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html" },
      { id: "M01", name: "本体管理", detail: "产品、管理人、发行人、准入语义候选", state: "待裁决", href: "http://127.0.0.1:4342/ontology-management-review/canvas-first/index.html" },
      { id: "M06", name: "报告中心", detail: "评价结果只读报告与历史比较", state: "后置消费", href: "http://127.0.0.1:4342/report-center/review-lifecycle/index.html" },
      { id: "M04", name: "决策中心", detail: "一期禁用 Action / 待办写入", state: "禁用", href: "http://127.0.0.1:4342/decision-center-prototype/review-v2/action-portfolio.html" }
    ]
  };
})();
