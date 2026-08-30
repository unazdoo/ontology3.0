(function () {
  "use strict";

  window.RC_EVIDENCE_DATA = {
    reportTypes: [
      {
        id: "RD-FIN-001",
        name: "集团融资经营分析报告",
        scene: "S001",
        purpose: "固定呈现集团融资成本、债务结构、重点单位与 Rule 发现。",
        audience: "集团财务管理者",
        version: "1.0.0",
        template: "融资经营分析模板 2.2.0",
        formats: ["系统内 HTML", "PDF 固定版"],
        status: "已启用"
      },
      {
        id: "RD-CREDIT-001",
        name: "财务公司贷款贷前调查报告",
        scene: "S004",
        purpose: "形成贷前调查的正式交付产物。",
        audience: "授信评审人员",
        version: "—",
        template: "待补充",
        formats: ["待资料确认"],
        status: "资料待补充"
      }
    ],
    semanticResources: [
      { type: "Object", id: "OBJ-FINANCING", name: "融资业务", version: "3.8.1", owner: "本体管理", status: "Published", effective: "2026-01-01 起" },
      { type: "Object", id: "OBJ-ORG-UNIT", name: "组织单位", version: "3.8.1", owner: "本体管理", status: "Published", effective: "2026-01-01 起" },
      { type: "Property", id: "PROP-LOAN-BALANCE", name: "融资余额", version: "3.8.1", owner: "本体管理", status: "Published", effective: "2026-01-01 起" },
      { type: "Link", id: "LINK-UNIT-FINANCING", name: "单位持有融资", version: "3.8.1", owner: "本体管理", status: "Published", effective: "2026-01-01 起" },
      { type: "Metric", id: "MET-FIN-008", name: "余额加权融资成本", version: "3.8.1", owner: "本体管理", status: "Published", effective: "2026-01-01—2026-12-31" },
      { type: "Metric", id: "MET-FIN-011", name: "高成本融资余额占比", version: "3.8.1", owner: "本体管理", status: "Published", effective: "2026-01-01—2026-12-31" },
      { type: "Rule", id: "R01", name: "融资成本偏高", version: "2.3.0", owner: "本体管理", status: "Published", effective: "2026-06-01 起" },
      { type: "Rule", id: "R02", name: "浮动利率暴露", version: "2.3.0", owner: "本体管理", status: "Published", effective: "2026-06-01 起" },
      { type: "Rule", id: "R03", name: "短期债务集中", version: "2.3.0", owner: "本体管理", status: "Published", effective: "2026-06-01 起" }
    ],
    dataContexts: [
      {
        id: "ctx-current",
        label: "2026 年 8 月正式月末组合",
        semanticVersion: "3.8.1",
        dataVersion: "2026.08.09-01",
        metricResultVersion: "MR-20260809-0918",
        ruleResultVersion: "RR-20260809-0918",
        asOf: "2026-08-09",
        quality: "有提示",
        freshness: "当前",
        readiness: "可消费",
        compatibility: "兼容",
        owner: "本体管理（权威组合）/ 数据工程（可信度事实）",
        note: "当前权威组合；质量提示已披露，不影响本报告允许的证据范围。"
      },
      {
        id: "ctx-stale",
        label: "2026 年 7 月正式月末组合",
        semanticVersion: "3.8.1",
        dataVersion: "2026.07.31-02",
        metricResultVersion: "MR-20260731-1730",
        ruleResultVersion: "RR-20260731-1730",
        asOf: "2026-07-31",
        quality: "通过",
        freshness: "陈旧",
        readiness: "可消费",
        compatibility: "兼容",
        owner: "本体管理（权威组合）/ 数据工程（可信度事实）",
        note: "可用于固定历史口径；生成前必须确认陈旧披露。"
      },
      {
        id: "ctx-incompatible",
        label: "2026 年 8 月重算窗口",
        semanticVersion: "3.8.1",
        dataVersion: "2026.08.09-R1",
        metricResultVersion: "等待重算",
        ruleResultVersion: "等待重算",
        asOf: "2026-08-09",
        quality: "检查中",
        freshness: "当前",
        readiness: "不可消费",
        compatibility: "版本不兼容",
        owner: "本体管理（权威组合）/ 数据工程（可信度事实）",
        note: "结果版本尚未完成兼容确认，不能固定为报告证据。"
      },
      {
        id: "ctx-history-missing",
        label: "2025 年 12 月历史归档组合",
        semanticVersion: "3.6.2",
        dataVersion: "2025.12.31-04",
        metricResultVersion: "MR-20251231-2205",
        ruleResultVersion: "RR-20251231-2205",
        asOf: "2025-12-31",
        quality: "历史记录",
        freshness: "历史",
        readiness: "无法定位",
        compatibility: "无法核验",
        owner: "本体管理（历史语义解析）/ 数据工程（历史版本定位）",
        note: "原 Property 版本定位信息缺失；不得改用当前 Published 定义代替。"
      }
    ],
    metrics: {
      balance: {
        id: "MET-FIN-001",
        name: "融资余额",
        definition: "统计范围内处于存续状态的融资本金余额折人民币合计。",
        unit: "亿元",
        appliesTo: "集团、板块、单位",
        filter: "融资状态 = 存续；币种按期末汇率折人民币",
        range: "截至 2026-08-09",
        effective: "2026-01-01—2026-12-31",
        version: "3.8.1",
        value: "21,613.387"
      },
      cost: {
        id: "MET-FIN-008",
        name: "余额加权融资成本",
        definition: "以融资余额为权重，对存续融资的执行年化利率进行加权。",
        unit: "%",
        appliesTo: "集团、板块、单位",
        filter: "融资状态 = 存续；排除零余额记录",
        range: "截至 2026-08-09",
        effective: "2026-01-01—2026-12-31",
        version: "3.8.1",
        value: "2.372231"
      },
      floating: {
        id: "MET-FIN-010",
        name: "浮动利率余额占比",
        definition: "浮动利率融资余额占全部存续融资余额的比例。",
        unit: "%",
        appliesTo: "集团、板块、单位",
        filter: "利率类型 = 浮动；融资状态 = 存续",
        range: "截至 2026-08-09",
        effective: "2026-01-01—2026-12-31",
        version: "3.8.1",
        value: "95.149492"
      },
      highCost: {
        id: "MET-FIN-011",
        name: "高成本融资余额占比",
        definition: "执行利率高于治理阈值的融资余额占全部存续融资余额的比例。",
        unit: "%",
        appliesTo: "集团、板块、单位",
        filter: "融资状态 = 存续；阈值取 Rule R01 的 Published 条件",
        range: "截至 2026-08-09",
        effective: "2026-01-01—2026-12-31",
        version: "3.8.1",
        value: "9.859389"
      }
    },
    reportSections: [
      { id: "sec-summary", number: "01", name: "经营概览", count: 4 },
      { id: "sec-cost", number: "02", name: "融资成本", count: 5 },
      { id: "sec-structure", number: "03", name: "债务结构", count: 6 },
      { id: "sec-units", number: "04", name: "重点单位与机构", count: 7 },
      { id: "sec-rules", number: "05", name: "Rule 发现", count: 6 },
      { id: "sec-limits", number: "06", name: "证据与限制", count: 3 }
    ],
    anchors: [
      { id: "a-summary-01", section: "sec-summary", kind: "段落", label: "经营概览 · 第 1 段", preview: "集团融资余额为 21,613.387 亿元……", evidence: ["MET-FIN-001", "MET-FIN-008"] },
      { id: "a-balance-value", section: "sec-summary", kind: "数值", label: "融资余额 21,613.387 亿元", preview: "21,613.387", evidence: ["MET-FIN-001", "PROP-LOAN-BALANCE"] },
      { id: "a-cost-value", section: "sec-summary", kind: "数值", label: "加权融资成本 2.372231%", preview: "2.372231%", evidence: ["MET-FIN-008"] },
      { id: "a-cost-chart", section: "sec-cost", kind: "图表", label: "最近 12 个月融资成本趋势", preview: "2.46% → 2.372231%", evidence: ["MET-FIN-008"] },
      { id: "a-structure-cell", section: "sec-structure", kind: "表格单元格", label: "浮动利率余额占比 95.149492%", preview: "95.149492%", evidence: ["MET-FIN-010", "PROP-LOAN-BALANCE"] },
      { id: "a-unit553-cost", section: "sec-units", kind: "表格单元格", label: "单位553 · 融资成本", preview: "2.880984%", evidence: ["OBJ-ORG-UNIT", "MET-FIN-008"] },
      { id: "a-rule-r01", section: "sec-rules", kind: "Rule 结论", label: "R01 · 单位553 命中", preview: "高成本余额占比超过 20%", evidence: ["R01", "MET-FIN-011"] },
      { id: "a-rule-r02", section: "sec-rules", kind: "Rule 结论", label: "R02 · 单位465 命中", preview: "浮动利率余额占比超过 80%", evidence: ["R02", "MET-FIN-010"] },
      { id: "a-unbound-note", section: "sec-limits", kind: "无绑定内容", label: "管理建议 · 利率窗口判断", preview: "建议关注后续利率窗口……", evidence: [] }
    ],
    baseChecks: [
      { id: "CHK-01", name: "证据完整性", status: "warning", anchor: "a-unbound-note", issue: "管理建议没有结构化证据绑定。", authority: "T044 内容—锚点—证据绑定", impact: "该句不能作为已核验事实引用。", action: "形成复核问题，要求在新草稿中改为限制披露。", owner: "报告中心" },
      { id: "CHK-02", name: "数值一致性", status: "pass", anchor: "a-cost-value", issue: "报告值与固定指标快照一致。", authority: "MET-FIN-008 = 2.372231%", impact: "无。", action: "保持当前绑定。", owner: "报告中心" },
      { id: "CHK-03", name: "语义一致性", status: "fail", anchor: "a-unit553-cost", issue: "表头单位写为“亿元”，单元格实际绑定融资成本（%）。", authority: "MET-FIN-008 · 单位 %", impact: "读者可能将比率误读为金额。", action: "修正表头并生成新草稿版本。", owner: "报告中心" },
      { id: "CHK-04", name: "版本兼容性", status: "pass", anchor: "a-summary-01", issue: "Published 语义 3.8.1 与数据 2026.08.09-01 兼容。", authority: "当前权威消费组合", impact: "无。", action: "保持当前组合。", owner: "本体管理 / 数据工程" },
      { id: "CHK-05", name: "时点与新鲜度披露", status: "warning", anchor: "sec-limits", issue: "质量提示已披露；其中 18 条担保类型为空。", authority: "数据工程可信度事实", impact: "担保结构的未知分类不可并入其他类别。", action: "保留“未知”单列与脚注。", owner: "数据工程" },
      { id: "CHK-06", name: "Rule 结论一致性", status: "fail", anchor: "a-rule-r02", issue: "正文把 R02 阈值写成 85%，绑定 Rule 条件为 80%。", authority: "R02 2.3.0 · > 80%", impact: "Rule 解释与正式命中结果不一致。", action: "按绑定 Rule 条件重新生成该段。", owner: "本体管理 / 报告中心" },
      { id: "CHK-07", name: "跨载体一致性", status: "pass", anchor: "sec-summary", issue: "摘要、正文、表格与附件中的集团余额一致。", authority: "MET-FIN-001 = 21,613.387 亿元", impact: "无。", action: "保持当前内容。", owner: "报告中心" },
      { id: "CHK-08", name: "无绑定内容识别", status: "unverifiable", anchor: "a-unbound-note", issue: "利率窗口判断没有可定位的结构化证据。", authority: "未找到生成时绑定", impact: "无法确认该判断属于事实、预测或建议。", action: "标记为建议并披露限制，或从新草稿移除。", owner: "报告中心" }
    ],
    cleanChecks: [
      { id: "CHK-01", name: "证据完整性", status: "pass", anchor: "a-unbound-note", issue: "原无绑定判断已改为限制披露，不再作为事实陈述。", authority: "T044 内容—锚点—证据绑定", impact: "无。", action: "保持限制披露。", owner: "报告中心" },
      { id: "CHK-02", name: "数值一致性", status: "pass", anchor: "a-cost-value", issue: "报告值与固定指标快照一致。", authority: "MET-FIN-008 = 2.372231%", impact: "无。", action: "保持当前绑定。", owner: "报告中心" },
      { id: "CHK-03", name: "语义一致性", status: "pass", anchor: "a-unit553-cost", issue: "指标名称、定义、单位、筛选范围与时间范围一致。", authority: "MET-FIN-008 · 单位 %", impact: "无。", action: "保持当前绑定。", owner: "报告中心" },
      { id: "CHK-04", name: "版本兼容性", status: "pass", anchor: "a-summary-01", issue: "Published 语义 3.8.1 与数据 2026.08.09-01 兼容。", authority: "当前权威消费组合", impact: "无。", action: "保持当前组合。", owner: "本体管理 / 数据工程" },
      { id: "CHK-05", name: "时点与新鲜度披露", status: "warning", anchor: "sec-limits", issue: "18 条担保类型为空，已在正文与脚注披露。", authority: "数据工程可信度事实", impact: "担保结构保留“未知”单列。", action: "发布时保留质量脚注。", owner: "数据工程" },
      { id: "CHK-06", name: "Rule 结论一致性", status: "pass", anchor: "a-rule-r02", issue: "R02 阈值、触发分支和命中证据一致。", authority: "R02 2.3.0 · > 80%", impact: "无。", action: "保持当前绑定。", owner: "本体管理 / 报告中心" },
      { id: "CHK-07", name: "跨载体一致性", status: "pass", anchor: "sec-summary", issue: "摘要、正文、表格与附件中的集团余额一致。", authority: "MET-FIN-001 = 21,613.387 亿元", impact: "无。", action: "保持当前内容。", owner: "报告中心" },
      { id: "CHK-08", name: "无绑定内容识别", status: "pass", anchor: "a-unbound-note", issue: "未绑定内容已显式标记为建议，不参与确定性核验。", authority: "报告定义 1.0.0 的发布规则", impact: "无。", action: "保持当前标记。", owner: "报告中心" }
    ]
  };
})();
