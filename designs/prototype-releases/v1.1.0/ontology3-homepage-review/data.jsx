const ONTOLOGY_MODULES = [
  {
    id: "data-engineering",
    code: "M02",
    name: "数据工程",
    en: "DATA ENGINEERING",
    icon: "pipeline",
    status: "S001 评审优先",
    statusTone: "focus",
    statusDetail: "模块尚未正式通过；真实运行与联调证据仍需补齐。",
    runtime: "尚未运行",
    summary: "把持续变化的来源数据转化为本体可稳定引用、可追溯的数据资产版本。",
    capabilities: ["数据源", "数据管道", "已发布数据资产", "运行与质量"],
    continueText: "继续核对 S001 核心链路与真实运行证据",
    owns: "数据源、原始快照、管道、质量检查、数据资产及其不可变版本。",
    boundary: "不拥有 Object、Property、Link、Metric、Rule 或 Action Type；资产已发布不等于已消费就绪。"
  },
  {
    id: "ontology-management",
    code: "M01",
    name: "本体管理",
    en: "ONTOLOGY MANAGEMENT",
    icon: "ontology",
    status: "具备评审材料",
    statusTone: "review",
    statusDetail: "已具备恢复正式设计评审的材料条件；以总控台账为准，尚未正式评审通过。",
    runtime: "尚未运行",
    summary: "把数据资产组织为 Object、Property、Link、Metric、Rule 与 Action Type 的共享业务定义。",
    capabilities: ["Object", "Property", "Link", "Metric", "Rule", "Action Type", "Published"],
    continueText: "等待明确恢复正式设计评审",
    owns: "语义资源定义、Published 生命周期，以及权威消费绑定的原子提交。",
    boundary: "不采集、加工或修复上游数据，不拥有问答、提醒、待办或报告运行记录。"
  },
  {
    id: "intelligent-query",
    code: "M03",
    name: "智能问数",
    en: "TRUSTED QUERY",
    icon: "query",
    status: "草案完成·待评审",
    statusTone: "pending",
    statusDetail: "模块草案已完成，尚未获得用户正式评审结论。",
    runtime: "尚未运行",
    summary: "在固定语义、数据与证据上下文中理解问题、返回可信答案并沉淀可重跑视图。",
    capabilities: ["可信问数", "固定问数视图", "证据与版本上下文"],
    continueText: "完成裁决与依赖回写后进入评审",
    owns: "问数 Agent 配置、问题理解、查询计划、回答、历史与可复用问数视图。",
    boundary: "不把工作簿交给 LLM，不复制 Metric/Rule 定义，不拥有仪表盘布局和决策运行状态。"
  },
  {
    id: "decision-center",
    code: "M04",
    name: "决策中心",
    en: "DECISION CENTER",
    icon: "decision",
    status: "可条件评审",
    statusTone: "conditional",
    statusDetail: "跨模块一致性检查通过；前置依赖收敛前不可标记正式通过。",
    runtime: "尚未运行",
    summary: "把标准 Action Request 转化为提醒、人工判断和负责人待办，并保持全过程可追溯。",
    capabilities: ["Action Request", "提醒", "人工确认", "待办"],
    continueText: "先评审稳定边界、运行闭环与恢复",
    owns: "Action Request、决策提醒、人工确认、负责人待办及决策运行摘要。",
    boundary: "不定义 Metric、Rule、Action Type，不拥有通用业务仪表盘；任何来源都不能绕过人工确认。"
  },
  {
    id: "agent-application",
    code: "M05",
    name: "Agent 应用",
    en: "AGENT APPLICATIONS",
    icon: "agent",
    status: "可条件评审",
    statusTone: "conditional",
    statusDetail: "主体设计及报告助手对账完成；前置数据与语义依赖尚未收敛。",
    runtime: "尚未运行",
    summary: "把受控配置、固定证据与版本组合成可发布、可运行、可追溯的 Agent 应用。",
    capabilities: ["Agent 配置", "发布", "运行", "分析结果"],
    continueText: "评审配置、发布、运行、结果与禁止越界",
    owns: "报告/洞察 Agent 配置、Release、运行、分析结果和受约束轻量编排。",
    boundary: "不拥有问数 Agent、正式计算、报告发布、人工决策或待办；Agent 只显式发起 Action 请求。"
  },
  {
    id: "report-center",
    code: "M06",
    name: "报告中心",
    en: "REPORT CENTER",
    icon: "report",
    status: "可条件评审",
    statusTone: "conditional",
    statusDetail: "决策边界及报告助手一致性检查通过；前置依赖未收敛前不可正式通过。",
    runtime: "尚未运行",
    summary: "承载持续经营观察、正式报告产物、报告助手与确定性数据核验。",
    capabilities: ["报告", "报告助手", "仪表盘", "数据核验"],
    continueText: "评审报告助手、同源展示与确定性核验",
    owns: "仪表盘与报告定义、证据包、草稿复核、正式产物、报告核验与阅读体验。",
    boundary: "不重算业务指标，不复制决策状态，不维护 Agent 运行副本；正式报告不可原地修改。"
  }
];

const CLASSIC_MODULE_OVERRIDES = {
  "data-engineering": {
    capabilities: ["数据源", "数据管道", "已发布数据资产", "运行与质量"],
    boundary: "不拥有对象、属性、关联、指标、规则或行动类型；资产发布不等于已被下游使用。"
  },
  "ontology-management": {
    summary: "把数据资产组织为对象、属性、关联、指标、规则和行动类型等共享业务定义。",
    capabilities: ["对象", "属性", "关联", "指标", "规则", "行动类型", "已发布业务定义"],
    owns: "业务对象、属性、关联、指标、规则、行动类型及其发布生命周期。",
    boundary: "不采集或修复上游数据，不拥有问答、提醒、待办或报告运行记录。"
  },
  "intelligent-query": {
    owns: "问数智能体配置、问题理解、查询计划、回答、历史与可复用问数视图。",
    boundary: "不复制指标与规则定义，不拥有仪表盘布局和决策运行状态。"
  },
  "decision-center": {
    summary: "把标准行动请求转化为提醒、人工判断和负责人待办，并保持全过程可追溯。",
    capabilities: ["行动请求", "提醒", "人工确认", "待办"],
    owns: "行动请求、决策提醒、人工确认、负责人待办及决策运行摘要。",
    boundary: "不定义指标、规则或行动类型，不拥有通用业务仪表盘；任何来源都不能绕过人工确认。"
  },
  "agent-application": {
    summary: "把受控配置、固定证据与版本组合成可发布、可运行、可追溯的智能体应用。",
    capabilities: ["智能体配置", "发布", "运行", "分析结果"],
    owns: "报告与洞察智能体配置、发布版本、运行记录、分析结果和受约束轻量编排。",
    boundary: "不拥有问数智能体、正式计算、报告发布、人工决策或待办；智能体只显式发起行动请求。"
  },
  "report-center": {
    boundary: "不重算业务指标，不复制决策状态，不维护智能体运行副本；正式报告不可原地修改。"
  }
};

const CLASSIC_MODULES = ONTOLOGY_MODULES.map((module) => ({
  ...module,
  ...(CLASSIC_MODULE_OVERRIDES[module.id] || {})
}));

const CLASSIC_MODULE_BY_ID = Object.fromEntries(CLASSIC_MODULES.map((module) => [module.id, module]));

const CLASSIC_DOMAINS = {
  foundation: {
    key: "foundation",
    order: "01",
    en: "可信数据",
    zh: "数据治理",
    icon: "database",
    kicker: "数据治理 · 可信底座",
    title: "把持续变化的数据，治理成稳定、可追溯的业务基础",
    lead: "数据工程负责来源、管道、已发布数据资产与运行质量；本体管理负责对象、属性、关联、指标、规则、行动类型以及业务定义发布。两个模块共同保证数据与业务定义能够被稳定引用。",
    scope: "资产与定义",
    flow: "数据治理 → 语义问数",
    flowDetail: "可信数据资产与已发布业务定义进入问数、报告和核验。",
    core: "数据治理 · 语义问数 · 行动智能",
    moduleIds: ["data-engineering", "ontology-management"]
  },
  intelligence: {
    key: "intelligence",
    order: "02",
    en: "可信理解",
    zh: "语义问数",
    icon: "insight",
    kicker: "语义问数 · 可信理解",
    title: "让每次问数与报告都能回到明确的数据和业务定义",
    lead: "智能问数负责问题理解、可信回答和可复用问数视图；报告中心负责仪表盘、正式报告、报告助手与数据核验。答案与报告始终保留证据和版本上下文，不绕过已发布的业务定义重新计算。",
    scope: "问数与报告",
    flow: "语义问数 → 行动智能",
    flowDetail: "带证据的答案、报告和规则结果形成受控行动申请。",
    core: "数据治理 · 语义问数 · 行动智能",
    moduleIds: ["intelligent-query", "report-center"]
  },
  action: {
    key: "action",
    order: "03",
    en: "受控协作",
    zh: "行动智能",
    icon: "action",
    kicker: "行动智能 · 受控闭环",
    title: "让洞察进入人的判断，再形成清晰、可追溯的行动",
    lead: "智能体应用负责配置、发布、运行和分析结果；决策中心负责行动请求、提醒、人工确认与待办。系统只能提出行动建议，不能绕过人工确认直接形成待办。",
    scope: "决策与协作",
    flow: "行动智能 → 数据治理",
    flowDetail: "确认、待办与执行结果作为只读证据回流，不改写历史事实。",
    core: "数据治理 · 语义问数 · 行动智能",
    moduleIds: ["decision-center", "agent-application"]
  }
};

const LOOP_STEPS = [
  {
    id: "data",
    order: "01",
    name: "数据",
    en: "DATA",
    title: "把来源变成可追溯的数据资产",
    description: "数据源进入版本化管道，经运行与质量门形成不可变资产；没有真实证据时保持“尚未运行”。",
    moduleIds: ["data-engineering"]
  },
  {
    id: "semantics",
    order: "02",
    name: "语义",
    en: "SEMANTICS",
    title: "把资产组织成可发布的业务定义",
    description: "Object、Property、Link、Metric、Rule 与 Action Type 在本体管理中统一定义和发布。",
    moduleIds: ["ontology-management"]
  },
  {
    id: "decision",
    order: "03",
    name: "决策",
    en: "DECISION",
    title: "把可信解释送进人的判断",
    description: "问数与报告提供带证据的理解和观察，决策中心承接标准请求、提醒和人工确认。",
    moduleIds: ["intelligent-query", "report-center", "decision-center"]
  },
  {
    id: "action",
    order: "04",
    name: "行动",
    en: "ACTION",
    title: "把受控协作变成可追溯行动",
    description: "Agent 应用产生受控分析与行动候选；正式待办仍由决策中心在人工确认后形成。",
    moduleIds: ["agent-application"]
  }
];

const VARIANT_META = {
  a: { label: "方案 A", name: "经典复刻版", file: "方案A-经典复刻版.html" },
  b: { label: "方案 B", name: "模块工作台版", file: "方案B-模块工作台版.html" },
  c: { label: "方案 C", name: "业务闭环版", file: "方案C-业务闭环版.html" }
};

const MODULE_BY_ID = Object.fromEntries(ONTOLOGY_MODULES.map((module) => [module.id, module]));

Object.assign(window, {
  ONTOLOGY_MODULES,
  MODULE_BY_ID,
  CLASSIC_MODULES,
  CLASSIC_MODULE_BY_ID,
  CLASSIC_DOMAINS,
  LOOP_STEPS,
  VARIANT_META
});
