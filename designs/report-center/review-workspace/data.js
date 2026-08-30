(function () {
  window.RC_WORKSPACE_DATA = {
    reportTypes: [
      {
        id: "finance-analysis",
        name: "集团融资成本与债务结构优化分析报告",
        description: "面向集团管理层，形成融资成本、债务结构、机构分布与 Rule 风险结论。",
        scene: "S001",
        definition: "集团融资分析报告定义",
        definitionVersion: "RD-S001-04",
        template: "集团融资经营分析模板",
        templateVersion: "RT-FIN-03",
        agentRelease: "融资报告生成 Agent · Release 6"
      }
    ],
    semanticResources: [
      { id: "OBJ-FIN-ORG", kind: "Object", name: "融资主体", version: "Published 3.2", required: true },
      { id: "PROP-FIN-BAL", kind: "Property", name: "融资余额、币种、利率类型、到期日", version: "Published 5.1", required: true },
      { id: "MET-FIN-COST", kind: "Metric", name: "综合融资成本", version: "Published 4.3", required: true },
      { id: "MET-FIN-STRUCT", kind: "Metric", name: "浮动利率、高成本及短期债务占比", version: "Published 4.3", required: true },
      { id: "RULE-FIN-R01", kind: "Rule", name: "R01 融资成本偏高", version: "Published 2.4", required: true },
      { id: "RULE-FIN-R02", kind: "Rule", name: "R02 浮动利率暴露", version: "Published 2.1", required: false }
    ],
    dataContexts: [
      {
        id: "current",
        name: "当前权威消费组合",
        semantic: "SEM-FIN-2025.4",
        dataVersion: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过 · 2 项提示",
        freshness: "陈旧 · 超场景阈值 12 天",
        readiness: "可消费",
        compatible: true,
        warning: true
      },
      {
        id: "trusted",
        name: "上一可信数据版本",
        semantic: "SEM-FIN-2025.4",
        dataVersion: "DV-FIN-2025M11-04",
        asOf: "2025-11-30",
        quality: "通过",
        freshness: "历史快照",
        readiness: "可复现",
        compatible: true,
        warning: false
      },
      {
        id: "incompatible",
        name: "待迁移的历史组合",
        semantic: "SEM-FIN-2024.9",
        dataVersion: "DV-FIN-2024Q4-12",
        asOf: "2024-12-31",
        quality: "通过",
        freshness: "历史快照",
        readiness: "版本不兼容",
        compatible: false,
        warning: false
      }
    ],
    toc: [
      { id: "cover", number: "封", title: "封面与版本" },
      { id: "summary", number: "01", title: "管理摘要", issues: 1 },
      { id: "cost", number: "02", title: "融资规模与成本" },
      { id: "structure", number: "03", title: "债务结构" },
      { id: "institutions", number: "04", title: "金融机构分布" },
      { id: "rules", number: "05", title: "Rule 风险结论" },
      { id: "trust", number: "06", title: "数据可信度" },
      { id: "attachments", number: "附", title: "证据与附件", issues: 1 }
    ],
    metricMeta: {
      balance: {
        name: "融资余额",
        definition: "所选主体在报告时点仍有效的融资明细余额之和。",
        unit: "亿元",
        object: "集团及纳入合并范围的融资主体",
        filters: "状态=存续；币种按报告定义折算；截至 2025-12-31",
        valid: "2025-01-01 至 2026-12-31",
        semantic: "MET-FIN-BAL · Published 4.3"
      },
      cost: {
        name: "综合融资成本",
        definition: "按融资余额加权的年化融资成本，不对单位成本作简单平均。",
        unit: "%",
        object: "集团融资组合",
        filters: "存续借据；余额>0；截至 2025-12-31",
        valid: "2025-01-01 至 2026-12-31",
        semantic: "MET-FIN-COST · Published 4.3"
      },
      floating: {
        name: "浮动利率余额占比",
        definition: "浮动利率融资余额占融资总余额的比例。",
        unit: "%",
        object: "集团融资组合",
        filters: "利率类型=浮动；状态=存续",
        valid: "2025-01-01 至 2026-12-31",
        semantic: "MET-FIN-FLOAT · Published 4.3"
      },
      highcost: {
        name: "高成本融资余额占比",
        definition: "命中当前 Published 高成本阈值的融资余额占总余额比例。",
        unit: "%",
        object: "集团融资组合",
        filters: "阈值引用 RULE-FIN-R01 Published 2.4",
        valid: "2025-07-01 至 2026-06-30",
        semantic: "MET-FIN-HIGH · Published 4.3"
      }
    },
    evidence: {
      cover: {
        location: "封面 · 版本披露",
        kind: "报告版本",
        fact: "报告定义、模板、证据包和内容版本",
        semantic: "报告定义 RD-S001-04 · 模板 RT-FIN-03",
        resource: "报告中心",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过 · 2 项提示",
        status: "可定位"
      },
      summary: {
        location: "第 1 章 · 管理摘要 · 第 1 段",
        kind: "段落",
        fact: "融资规模、成本与结构摘要",
        semantic: "MET-FIN-BAL / COST / FLOAT · Published 4.3",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过 · 数据陈旧提示",
        status: "可定位"
      },
      "metric-balance": {
        location: "第 2 章 · 指标卡 · 融资余额",
        kind: "数值",
        fact: "21,613.39 亿元",
        semantic: "MET-FIN-BAL · Published 4.3",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位",
        metric: "balance"
      },
      "metric-cost": {
        location: "第 2 章 · 指标卡 · 综合融资成本",
        kind: "数值",
        fact: "2.372%",
        semantic: "MET-FIN-COST · Published 4.3",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位",
        metric: "cost"
      },
      "metric-floating": {
        location: "第 3 章 · 指标卡 · 浮动利率余额占比",
        kind: "数值",
        fact: "95.149%",
        semantic: "MET-FIN-FLOAT · Published 4.3",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位",
        metric: "floating"
      },
      "metric-high": {
        location: "第 3 章 · 指标卡 · 高成本融资余额占比",
        kind: "数值",
        fact: "9.859%",
        semantic: "MET-FIN-HIGH · Published 4.3",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位",
        metric: "highcost"
      },
      "cell-unit553": {
        location: "第 4 章 · 机构分布表 · 单位553/欧陆银行/融资余额",
        kind: "表格单元格",
        fact: "99.586 亿元",
        semantic: "OBJ-FIN-ORG / PROP-FIN-BAL · Published 3.2 / 5.1",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位"
      },
      chart: {
        location: "第 4 章 · 金融机构余额分布图",
        kind: "图表",
        fact: "前六家金融机构融资余额分布",
        semantic: "MET-FIN-BAL + PROP-INSTITUTION · Published 4.3 / 3.8",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位"
      },
      rule: {
        location: "第 5 章 · Rule 风险结论 · R01",
        kind: "Rule 结论",
        fact: "单位553 命中 R01 融资成本偏高",
        semantic: "RULE-FIN-R01 · Published 2.4",
        resource: "本体管理",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过",
        status: "可定位"
      },
      trust: {
        location: "第 6 章 · 数据可信度",
        kind: "可信度披露",
        fact: "数据版本、截至时间、质量、新鲜度与消费就绪",
        semantic: "权威消费组合 SEM-FIN-2025.4",
        resource: "数据工程（可信度事实）/ 本体管理（权威绑定）",
        data: "DV-FIN-2025Q4-07",
        asOf: "2025-12-31",
        quality: "通过 · 2 项提示",
        status: "可定位"
      },
      attachment: {
        location: "附件 A · 2024 年利率结构补充说明",
        kind: "附件引用",
        fact: "历史 Property 版本及原始定位",
        semantic: "PROP-FIN-RATE · Published 1.7",
        resource: "本体管理 / 数据工程",
        data: "DV-FIN-2024Q4-12",
        asOf: "2024-12-31",
        quality: "历史资源已超保留期",
        status: "历史资源不可定位",
        unavailable: true
      }
    },
    verificationBad: [
      { id:"evidence", name:"证据完整性", status:"无法核验", anchor:"attachment", issue:"附件 A 的原版本 Property 与数据定位均无法解析。", authority:"PROP-FIN-RATE Published 1.7 / DV-FIN-2024Q4-12", version:"报告内容 C01", impact:"附件结论不能进入正式报告。", suggestion:"移除无结构化绑定的附件结论，或补齐原版本定位后重新生成。" },
      { id:"numeric", name:"数值与绑定证据一致性", status:"失败", anchor:"summary", issue:"管理摘要写为 94.1%，绑定证据为 95.149%。", authority:"MET-FIN-FLOAT Published 4.3 = 95.149%", version:"SEM-FIN-2025.4 / DV-FIN-2025Q4-07", impact:"管理层可能低估浮动利率敞口。", suggestion:"基于当前证据包重新生成摘要，不修改 Metric。" },
      { id:"semantic", name:"名称、单位与范围语义一致性", status:"通过", anchor:"metric-cost", issue:"指标名称、单位、适用对象与报告定义一致。", authority:"MET-FIN-COST Published 4.3", version:"RD-S001-04", impact:"无。", suggestion:"保持当前绑定。" },
      { id:"compat", name:"语义版本与数据版本兼容性", status:"通过", anchor:"cover", issue:"生成时精确 Published 语义与数据版本兼容。", authority:"权威消费组合 SEM-FIN-2025.4", version:"DV-FIN-2025Q4-07", impact:"无。", suggestion:"保持冻结。" },
      { id:"fresh", name:"截至时间、质量与新鲜度披露", status:"警告", anchor:"trust", issue:"数据超过场景新鲜度阈值 12 天，正文已披露。", authority:"C017 可信度摘要", version:"DV-FIN-2025Q4-07", impact:"结论可复核，但不宜表述为当前即时状态。", suggestion:"人工确认披露充分；需要当前经营判断时显式比较当前版本。" },
      { id:"rule", name:"Rule 命中结论一致性", status:"通过", anchor:"rule", issue:"命中分支、阈值、评估时间与证据一致。", authority:"RULE-FIN-R01 Published 2.4", version:"评估 2026-01-02 09:18", impact:"无。", suggestion:"保持当前绑定。" },
      { id:"cross", name:"摘要、正文、表格与附件一致性", status:"失败", anchor:"summary", issue:"摘要与第 3 章浮动利率比例不一致。", authority:"第 3 章 95.149% / 绑定证据", version:"报告内容 C01", impact:"同一报告存在互相矛盾的数字。", suggestion:"创建复核问题并生成新内容版本。" },
      { id:"unbound", name:"无结构化证据绑定内容识别", status:"警告", anchor:"attachment", issue:"附件 A 含 1 段未建立稳定锚点的历史说明。", authority:"T044 内容—锚点—证据绑定", version:"报告内容 C01", impact:"该段无法进入自动核验覆盖率。", suggestion:"删除该段或补齐结构化证据绑定。" }
    ],
    verificationFixed: [
      { id:"evidence", name:"证据完整性", status:"通过", anchor:"summary", issue:"全部正式事实项已绑定稳定锚点和证据。", authority:"T044 内容—锚点—证据绑定", version:"报告内容 C02", impact:"无。", suggestion:"保持当前绑定。" },
      { id:"numeric", name:"数值与绑定证据一致性", status:"通过", anchor:"summary", issue:"管理摘要、指标卡与表格数值一致，展示舍入符合报告定义。", authority:"MET-FIN-FLOAT Published 4.3", version:"SEM-FIN-2025.4 / DV-FIN-2025Q4-07", impact:"无。", suggestion:"保持当前绑定。" },
      { id:"semantic", name:"名称、单位与范围语义一致性", status:"通过", anchor:"metric-cost", issue:"名称、定义、单位、范围、有效期均与精确 Published 版本一致。", authority:"C026 历史语义证据", version:"RD-S001-04", impact:"无。", suggestion:"保持当前绑定。" },
      { id:"compat", name:"语义版本与数据版本兼容性", status:"通过", anchor:"cover", issue:"精确语义与数据版本兼容。", authority:"权威消费组合 SEM-FIN-2025.4", version:"DV-FIN-2025Q4-07", impact:"无。", suggestion:"保持冻结。" },
      { id:"fresh", name:"截至时间、质量与新鲜度披露", status:"警告", anchor:"trust", issue:"数据超过场景阈值 12 天；封面与第 6 章已显式披露。", authority:"C017 可信度摘要", version:"DV-FIN-2025Q4-07", impact:"正式报告必须保留陈旧提示。", suggestion:"人工确认披露充分，发布后不得移除。" },
      { id:"rule", name:"Rule 命中结论一致性", status:"通过", anchor:"rule", issue:"Rule 结论、触发分支、阈值和证据一致。", authority:"RULE-FIN-R01 Published 2.4", version:"评估 2026-01-02 09:18", impact:"无。", suggestion:"保持当前绑定。" },
      { id:"cross", name:"摘要、正文、表格与附件一致性", status:"通过", anchor:"summary", issue:"跨章节事实一致。", authority:"报告内容 C02", version:"C02", impact:"无。", suggestion:"保持当前内容。" },
      { id:"unbound", name:"无结构化证据绑定内容识别", status:"通过", anchor:"attachments", issue:"未发现无结构化证据绑定的正式内容。", authority:"T044 内容清单", version:"C02", impact:"无。", suggestion:"保持当前内容。" }
    ]
  };
})();
