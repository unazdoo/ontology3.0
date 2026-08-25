const IQ_STORAGE_KEY = "ontology3.intelligent-query.workspace.v1";

const IQ_QUERY_LIBRARY = [
  {
    id: "unit-cost",
    title: "单位融资成本及构成",
    question: "单位553平均融资成本及构成是什么？",
    description: "查看单一单位的融资余额、平均成本和结构构成。",
    icon: "Building2"
  },
  {
    id: "pair-cost",
    title: "两家单位综合成本",
    question: "单位553和单位465综合平均融资成本是多少？",
    description: "按融资余额加权计算两家单位综合成本。",
    icon: "Columns3"
  },
  {
    id: "triple-cost",
    title: "三家单位综合成本",
    question: "单位553、单位465和单位561综合平均融资成本是多少？",
    description: "对三家单位去重后按同一正式指标求值。",
    icon: "ChartNoAxesColumnIncreasing"
  },
  {
    id: "group-overview",
    title: "集团与产业板块对比",
    question: "集团融资成本、债务结构和产业板块对比如何？",
    description: "查看集团总体指标和产业板块差异。",
    icon: "Landmark"
  },
  {
    id: "rule-explain",
    title: "三条规则命中解释",
    question: "为什么单位553、单位465和单位561分别命中不同规则？",
    description: "逐单位查看实际值、阈值、条件分支和证据。",
    icon: "ShieldCheck"
  },
  {
    id: "institution-priority",
    title: "优先协商金融机构",
    question: "单位553的异常贷款应优先与哪些金融机构协商？",
    description: "依据问题余额和成本贡献定位优先机构。",
    icon: "BadgeDollarSign"
  },
  {
    id: "ambiguous-unit",
    title: "对象名称需要确认",
    question: "查单位55和单位465综合融资成本。",
    description: "对象名称不完整时先确认范围。",
    icon: "CircleHelp"
  },
  {
    id: "trend-blocked",
    title: "上期趋势查询",
    question: "集团融资成本较上期变化了多少？",
    description: "当前没有可比较时间序列时明确阻断。",
    icon: "TrendingUp"
  }
];

const IQ_SEMANTIC_RESOURCES = [
  { type: "对象", name: "融资主体", stableId: "OBJ-FINANCING-ENTITY", scope: "集团、产业板块、单位", status: "已发布" },
  { type: "对象", name: "融资明细", stableId: "OBJ-FINANCING-DETAIL", scope: "融资借据", status: "已发布" },
  { type: "对象", name: "融资机构", stableId: "OBJ-FINANCIAL-INSTITUTION", scope: "金融机构", status: "已发布" },
  { type: "对象", name: "融资负责人", stableId: "OBJ-FINANCING-OWNER", scope: "责任承接", status: "已发布" },
  { type: "指标", name: "融资余额", stableId: "MET-FIN-BALANCE", scope: "集团、板块、单位、对象集合", unit: "元", status: "已发布" },
  { type: "指标", name: "余额加权平均融资成本", stableId: "MET-WAVG-COST", scope: "集团、板块、单位、对象集合", unit: "%", status: "已发布" },
  { type: "指标", name: "浮动利率余额占比", stableId: "MET-FLOATING-RATE-SHARE", scope: "集团、板块、单位", unit: "%", status: "已发布" },
  { type: "指标", name: "短期债务余额占比", stableId: "MET-SHORT-DEBT-SHARE", scope: "集团、板块、单位", unit: "%", status: "已发布" },
  { type: "指标", name: "高成本融资余额占比", stableId: "MET-HIGH-COST-SHARE", scope: "集团、板块、单位", unit: "%", status: "已发布" },
  { type: "规则", name: "融资成本偏高", stableId: "RULE-HIGH-COST", scope: "融资主体", status: "已发布" },
  { type: "规则", name: "浮动利率暴露", stableId: "RULE-FLOATING-EXPOSURE", scope: "融资主体", status: "已发布" },
  { type: "规则", name: "短期债务集中", stableId: "RULE-SHORT-DEBT", scope: "融资主体", status: "已发布" },
  { type: "关系", name: "主体拥有融资", stableId: "LINK-ENTITY-FINANCING", scope: "融资主体 → 融资明细", status: "已发布" },
  { type: "关系", name: "融资由机构提供", stableId: "LINK-FINANCING-INSTITUTION", scope: "融资明细 → 融资机构", status: "已发布" },
  { type: "行动类型", name: "发起融资优化建议", stableId: "ACTION-FINANCING-OPTIMIZATION", scope: "单一融资主体", status: "已发布" }
];

const IQ_CONFIG_CANDIDATE = {
  name: "融资问数配置",
  scene: "集团融资成本与债务结构优化",
  promptLabel: "企业融资问数约束",
  skills: [
    { name: "场景与资源发现", expected: "1.8", loaded: "1.7" },
    { name: "对象解析与消歧", expected: "2.1", loaded: "2.1" },
    { name: "指标与规则查询", expected: "2.4", loaded: "2.4" },
    { name: "证据组装", expected: "1.9", loaded: "1.9" },
    { name: "结果展示与导出适配", expected: "1.3", loaded: "1.3" },
    { name: "受控行动请求", expected: "1.2", loaded: "1.2" }
  ],
  resourceCount: IQ_SEMANTIC_RESOURCES.length,
  tests: [
    "单一单位成本及构成",
    "两家和三家综合成本",
    "集团和板块对比",
    "三条规则解释",
    "金融机构归因",
    "展示切换与证据保持",
    "当前结果 CSV",
    "受控行动请求"
  ]
};

const IQ_RESULT_TEMPLATES = {
  "unit-cost": {
    title: "单位553融资成本及构成",
    scope: ["单位553"],
    resultType: "unit",
    summary: "单位553平均融资成本为 2.881%，融资余额为 393.134 亿元。高成本融资余额占比 77.337%，是当前成本结构中的主要关注项。",
    highlights: [
      { label: "平均融资成本", value: "2.881%", raw: 2.881, unit: "%", tone: "warning" },
      { label: "融资余额", value: "393.134 亿元", raw: 393.134, unit: "亿元" },
      { label: "高成本融资占比", value: "77.337%", raw: 77.337, unit: "%", tone: "danger" }
    ],
    rows: [
      { object: "单位553", item: "融资余额", value: 393.134, display: "393.134", unit: "亿元", status: "可计算" },
      { object: "单位553", item: "余额加权平均融资成本", value: 2.881, display: "2.881", unit: "%", status: "可计算" },
      { object: "单位553", item: "高成本融资余额占比", value: 77.337, display: "77.337", unit: "%", status: "可计算" },
      { object: "单位553", item: "其他融资余额占比", value: 22.663, display: "22.663", unit: "%", status: "可计算" },
      { object: "单位553", item: "浮动利率余额占比", value: 0, display: "0.000", unit: "%", status: "真实零值" },
      { object: "单位553", item: "短期债务余额占比", value: 0, display: "0.000", unit: "%", status: "真实零值" }
    ],
    chart: { default: "metric", allowed: ["metric", "donut", "bar"], categories: ["高成本融资", "其他融资"], values: [77.337, 22.663], unit: "%" },
    nextQuestions: ["为什么单位553融资成本偏高？", "单位553应优先与哪些金融机构协商？"]
  },
  "pair-cost": {
    title: "两家单位综合平均融资成本",
    scope: ["单位553", "单位465"],
    resultType: "comparison",
    summary: "单位553和单位465融资余额合计 1,163.134 亿元，综合平均融资成本为 2.428%。综合结果按融资余额加权计算，不是两个单位成本的简单平均。",
    highlights: [
      { label: "综合平均融资成本", value: "2.428%", raw: 2.428, unit: "%" },
      { label: "合计融资余额", value: "1,163.134 亿元", raw: 1163.134, unit: "亿元" },
      { label: "对象范围", value: "2 家单位", raw: 2, unit: "家" }
    ],
    rows: [
      { object: "组合结果", item: "综合平均融资成本", value: 2.428, display: "2.428", unit: "%", status: "可计算" },
      { object: "组合结果", item: "合计融资余额", value: 1163.134, display: "1,163.134", unit: "亿元", status: "可计算" },
      { object: "单位553", item: "平均融资成本", value: 2.881, display: "2.881", unit: "%", status: "可计算" },
      { object: "单位465", item: "平均融资成本", value: 2.197, display: "2.197", unit: "%", status: "可计算" }
    ],
    chart: { default: "bar", allowed: ["metric", "bar"], categories: ["单位553", "单位465"], values: [2.881, 2.197], unit: "%" },
    nextQuestions: ["把单位561加入组合。", "分别查看两家单位的成本构成。"]
  },
  "triple-cost": {
    title: "三家单位综合平均融资成本",
    scope: ["单位553", "单位465", "单位561"],
    resultType: "comparison",
    summary: "三家单位融资余额合计 1,183.150 亿元，综合平均融资成本为 2.425%。对象已按稳定身份去重。",
    highlights: [
      { label: "综合平均融资成本", value: "2.425%", raw: 2.425, unit: "%" },
      { label: "合计融资余额", value: "1,183.150 亿元", raw: 1183.15, unit: "亿元" },
      { label: "对象范围", value: "3 家单位", raw: 3, unit: "家" }
    ],
    rows: [
      { object: "组合结果", item: "综合平均融资成本", value: 2.425, display: "2.425", unit: "%", status: "可计算" },
      { object: "组合结果", item: "合计融资余额", value: 1183.15, display: "1,183.150", unit: "亿元", status: "可计算" },
      { object: "单位553", item: "平均融资成本", value: 2.881, display: "2.881", unit: "%", status: "可计算" },
      { object: "单位465", item: "平均融资成本", value: 2.197, display: "2.197", unit: "%", status: "可计算" },
      { object: "单位561", item: "平均融资成本", value: 2.229, display: "2.229", unit: "%", status: "可计算" }
    ],
    chart: { default: "bar", allowed: ["metric", "bar"], categories: ["单位553", "单位465", "单位561"], values: [2.881, 2.197, 2.229], unit: "%" },
    nextQuestions: ["去掉单位561后重新计算。", "三家分别命中了哪些规则？"]
  },
  "group-overview": {
    title: "集团融资成本与产业板块对比",
    scope: ["集团"],
    resultType: "group",
    summary: "集团融资余额为 21,613.387 亿元，平均融资成本为 2.372%。浮动利率融资占比 95.149%，不同产业板块之间存在明显成本差异。",
    highlights: [
      { label: "集团平均融资成本", value: "2.372%", raw: 2.372, unit: "%" },
      { label: "集团融资余额", value: "21,613.387 亿元", raw: 21613.387, unit: "亿元" },
      { label: "浮动利率融资占比", value: "95.149%", raw: 95.149, unit: "%", tone: "warning" },
      { label: "短期债务占比", value: "0.912%", raw: 0.912, unit: "%" }
    ],
    rows: [
      { object: "集团", item: "平均融资成本", value: 2.372, display: "2.372", unit: "%", status: "可计算" },
      { object: "核能", item: "平均融资成本", value: 1.948, display: "1.948", unit: "%", status: "可计算" },
      { object: "新能源", item: "平均融资成本", value: 2.286, display: "2.286", unit: "%", status: "可计算" },
      { object: "产业金融", item: "平均融资成本", value: 2.614, display: "2.614", unit: "%", status: "可计算" },
      { object: "环保产业", item: "平均融资成本", value: 2.741, display: "2.741", unit: "%", status: "可计算" },
      { object: "数字化", item: "平均融资成本", value: 2.523, display: "2.523", unit: "%", status: "可计算" },
      { object: "产业服务", item: "平均融资成本", value: 2.462, display: "2.462", unit: "%", status: "可计算" }
    ],
    chart: {
      default: "bar",
      allowed: ["metric", "bar", "stacked"],
      categories: ["核能", "新能源", "产业服务", "数字化", "产业金融", "环保产业"],
      values: [1.948, 2.286, 2.462, 2.523, 2.614, 2.741],
      stacks: [[91.2, 8.8], [96.7, 3.3], [94.1, 5.9], [97.5, 2.5], [93.4, 6.6], [95.8, 4.2]],
      unit: "%"
    },
    nextQuestions: ["查看环保产业下的单位明细。", "按高成本融资占比比较产业板块。"]
  },
  "rule-explain": {
    title: "三家单位规则命中解释",
    scope: ["单位553", "单位465", "单位561"],
    resultType: "rules",
    summary: "三家单位分别命中不同规则：单位553命中融资成本偏高，单位465命中浮动利率暴露，单位561命中短期债务集中。每条结论均来自已发布规则的本次评估结果。",
    highlights: [
      { label: "单位553", value: "融资成本偏高", raw: 1, unit: "命中", tone: "danger" },
      { label: "单位465", value: "浮动利率暴露", raw: 1, unit: "命中", tone: "warning" },
      { label: "单位561", value: "短期债务集中", raw: 1, unit: "命中", tone: "warning" }
    ],
    rows: [
      { object: "单位553", item: "融资成本偏高", value: 2.881, display: "实际 2.881 / 阈值 2.622", unit: "%", status: "命中" },
      { object: "单位465", item: "浮动利率暴露", value: 100, display: "实际 100.000 / 阈值 80.000", unit: "%", status: "命中" },
      { object: "单位561", item: "短期债务集中", value: 87.4, display: "实际 87.400 / 阈值 30.000", unit: "%", status: "命中" }
    ],
    chart: { default: "table", allowed: ["metric", "bar"], categories: ["单位553", "单位465", "单位561"], values: [2.881, 100, 87.4], unit: "各规则单位" },
    nextQuestions: ["查看单位553的金融机构贡献。", "分别为三家单位发起融资优化建议。"]
  },
  "institution-priority": {
    title: "单位553优先协商金融机构",
    scope: ["单位553"],
    resultType: "institutions",
    summary: "按融资成本偏高规则的问题余额贡献排序，建议优先关注欧陆银行、寰宇银行和海联银行。排序只覆盖当前查询定义返回的前三家机构。",
    highlights: [
      { label: "首要机构", value: "欧陆银行", raw: 1, unit: "第1位", tone: "danger" },
      { label: "问题余额", value: "99.586 亿元", raw: 99.586, unit: "亿元" },
      { label: "成本贡献", value: "32.754%", raw: 32.754, unit: "%" }
    ],
    rows: [
      { object: "欧陆银行", item: "问题余额贡献", value: 99.586, display: "99.586", unit: "亿元", status: "优先级 1", detail: "16 笔融资 · 平均成本 2.994%" },
      { object: "寰宇银行", item: "问题余额贡献", value: 65.494, display: "65.494", unit: "亿元", status: "优先级 2", detail: "11 笔融资 · 平均成本 2.900%" },
      { object: "海联银行", item: "问题余额贡献", value: 58.476, display: "58.476", unit: "亿元", status: "优先级 3", detail: "10 笔融资 · 平均成本 3.004%" }
    ],
    chart: { default: "bar", allowed: ["metric", "bar"], categories: ["欧陆银行", "寰宇银行", "海联银行"], values: [99.586, 65.494, 58.476], unit: "亿元" },
    nextQuestions: ["查看欧陆银行对应借据。", "为单位553发起融资优化建议。"]
  }
};

function iqInitialState() {
  return {
    schemaVersion: 1,
    idCounter: 0,
    config: {
      status: "待验证",
      validationStatus: "not_started",
      validationAttempt: 0,
      skillRepaired: false,
      activeVersion: null,
      promptVersion: null,
      whitelistVersion: null,
      bindingVersion: null,
      context: null,
      lastCheckedAt: null
    },
    dataCheck: {
      status: "idle",
      attempt: 0,
      message: "尚未读取权威数据上下文",
      lastCheckedAt: null,
      currentVersion: null,
      currentAsOf: null,
      bindingRef: null,
      candidateVersion: null,
      previousVersion: null
    },
    runs: [],
    currentRunId: null,
    views: [],
    pins: [],
    actionRequests: [],
    displayPreference: "text",
    chartPreference: "recommended",
    draftQuestion: null
  };
}

Object.assign(window, {
  IQ_STORAGE_KEY,
  IQ_QUERY_LIBRARY,
  IQ_SEMANTIC_RESOURCES,
  IQ_CONFIG_CANDIDATE,
  IQ_RESULT_TEMPLATES,
  iqInitialState
});
