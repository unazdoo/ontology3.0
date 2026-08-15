(function () {
  const modules = [
    {
      id: "data",
      name: "数据工程",
      short: "数据",
      icon: "database",
      source: "../data-engineering-prototype-review/review-v3/方案B2.html",
      description: "接入融资明细，运行质量门并发布可引用的数据资产。",
      steps: ["upload", "pipeline", "dataPublish"],
      color: "blue"
    },
    {
      id: "ontology",
      name: "本体管理",
      short: "本体",
      icon: "network",
      source: "../ontology-management-review/canvas-first/index.html?v=20260815-11",
      description: "维护融资对象、指标、规则与行动类型，形成可消费版本。",
      steps: ["mapping", "ontologyPublish"],
      color: "violet"
    },
    {
      id: "query",
      name: "智能问数",
      short: "问数",
      icon: "sparkles",
      source: "../intelligent-query-prototype/review-next/conversation-workspace/index.html",
      description: "基于已发布口径回答融资问题，并保留数据与本体版本。",
      steps: ["query", "rules"],
      color: "cyan"
    },
    {
      id: "decision",
      name: "决策中心",
      short: "决策",
      icon: "target",
      source: "../decision-center-prototype/index.html?prototypeBuild=20260814-02",
      description: "接收行动申请，经人工确认后形成负责人待办。",
      steps: ["actions", "confirm", "todo"],
      color: "orange"
    },
    {
      id: "agent",
      name: "Agent 应用",
      short: "Agent",
      icon: "bot",
      source: "../agent-application/Agent应用.html",
      description: "围绕固定证据解释报告结论，不改写正式指标。",
      steps: ["companion"],
      color: "teal"
    },
    {
      id: "report",
      name: "报告中心",
      short: "报告",
      icon: "file",
      source: "../report-center/review-lifecycle/index.html",
      description: "生成、核验和发布同源的 HTML/PDF 报告，并与当前数据比较。",
      steps: ["report", "verify", "publish", "compare"],
      color: "green"
    }
  ];

  const workflow = [
    {
      id: "upload",
      module: "data",
      title: "上传融资数据",
      action: "选择并上传数据",
      summary: "读取 5,218 条融资明细与配套业务表。",
      prerequisite: null
    },
    {
      id: "pipeline",
      module: "data",
      title: "运行数据管道",
      action: "运行管道",
      summary: "完成字段、余额与质量规则检查。",
      prerequisite: "upload"
    },
    {
      id: "dataPublish",
      module: "data",
      title: "发布数据资产",
      action: "发布数据资产",
      summary: "形成可被本体管理引用的数据版本。",
      prerequisite: "pipeline"
    },
    {
      id: "mapping",
      module: "ontology",
      title: "完成本体映射",
      action: "应用映射",
      summary: "将融资主体、贷款与金融机构映射到业务对象。",
      prerequisite: "dataPublish"
    },
    {
      id: "ontologyPublish",
      module: "ontology",
      title: "发布本体版本",
      action: "发布本体版本",
      summary: "发布指标、三条规则和行动类型的同一业务版本。",
      prerequisite: "mapping"
    },
    {
      id: "query",
      module: "query",
      title: "查询融资成本",
      action: "运行标准问数",
      summary: "返回集团与任意两家、三家单位的综合平均融资成本。",
      prerequisite: "ontologyPublish"
    },
    {
      id: "rules",
      module: "query",
      title: "识别重点事项",
      action: "运行规则检查",
      summary: "三条规则分别触发三家单位，并给出优先协商银行。",
      prerequisite: "query"
    },
    {
      id: "actions",
      module: "decision",
      title: "提交行动申请",
      action: "提交 3 条行动申请",
      summary: "将已固定证据的重点事项送入决策中心。",
      prerequisite: "rules"
    },
    {
      id: "confirm",
      module: "decision",
      title: "人工确认行动",
      action: "确认 1 笔代表性行动",
      summary: "选择一笔确认负责人、优先银行与行动建议；其余事项继续留在待决策队列。",
      prerequisite: "actions"
    },
    {
      id: "todo",
      module: "decision",
      title: "负责人待办形成",
      action: "追踪待办",
      summary: "代表性确认后形成 1 条负责人待办，并保留来源回链；未确认事项不形成待办。",
      prerequisite: "confirm",
      automatic: true
    },
    {
      id: "report",
      module: "report",
      title: "生成融资分析报告",
      action: "生成报告",
      summary: "只读决策运行摘要，形成报告草稿和证据包。",
      prerequisite: "todo"
    },
    {
      id: "verify",
      module: "report",
      title: "完成确定性核验",
      action: "执行数据核验",
      summary: "逐项核对余额、成本、规则触发与负责人信息。",
      prerequisite: "report"
    },
    {
      id: "publish",
      module: "report",
      title: "发布 HTML/PDF",
      action: "发布两种格式",
      summary: "两种格式共享报告编号、内容版本和证据链。",
      prerequisite: "verify"
    },
    {
      id: "companion",
      module: "agent",
      title: "阅读报告结论",
      action: "打开报告伴读",
      summary: "基于固定证据解释结论和下一步，不重新计算正式指标。",
      prerequisite: "publish"
    },
    {
      id: "compare",
      module: "report",
      title: "与当前数据比较",
      action: "与当前数据比较",
      summary: "显式比较报告证据版本与当前数据，并记录新鲜度。",
      prerequisite: "companion"
    }
  ];

  const scenario = {
    id: "S001",
    scenarioVersion: "S001-v1",
    status: "active",
    name: "融资成本洞察与行动闭环",
    enabled: true,
    organization: "集团融资板块",
    selectedEntities: ["553", "465", "561"],
    focus: "3 家重点单位",
    dataAsOf: "待在数据工程确认",
    sourceFile: "融资一览表_一期业务数据.xlsx",
    sourceArtifactFile: "融资一览表_一期演示数据.xlsx",
    sourceRows: 5218,
    dataVersion: "融资数据 2026.08.13-01",
    ontologyVersion: "财务本体 2026.08.13-01",
    trustedOntologyVersion: "财务本体 2026.08.12",
    moduleIds: modules.map((module) => module.id)
  };

  const scenarioRegistry = [scenario];

  window.S001_DATA = {
    homepage: {
      source: "../ontology3-homepage-review/方案A-经典复刻版.html",
      baseline: "方案 A · 经典复刻版"
    },
    brand: {
      zh: "智财问策",
      en: "Ontology Financial World",
      full: "智财问策（Ontology Financial World）"
    },
    scenario,
    scenarioRegistry,
    scenarioById: Object.fromEntries(scenarioRegistry.map((item) => [item.id, item])),
    modules,
    moduleById: Object.fromEntries(modules.map((module) => [module.id, module])),
    workflow,
    stepById: Object.fromEntries(workflow.map((step, index) => [step.id, { ...step, index }])),
    nav: [
      { id: "home", name: "首页", icon: "home", route: "#home" },
      { id: "data", name: "数据工程", icon: "database", route: "#module/data" },
      { id: "ontology", name: "本体管理", icon: "network", route: "#module/ontology" },
      { id: "query", name: "智能问数", icon: "sparkles", route: "#module/query" },
      { id: "decision", name: "决策中心", icon: "target", route: "#module/decision" },
      { id: "agent", name: "Agent 应用", icon: "bot", route: "#module/agent" },
      { id: "report", name: "报告中心", icon: "file", route: "#module/report" },
      { id: "dashboard", name: "仪表盘", icon: "chart", route: "#dashboard" }
    ],
    entities: [
      {
        id: "553",
        name: "单位553",
        balance: "393.134 亿元",
        cost: "2.880984%",
        loans: "75 笔",
        rule: "融资成本偏高",
        ruleMetricLabel: "平均融资成本",
        ruleMetricValue: "2.880984%",
        owner: "负责人001",
        banks: ["欧陆银行", "寰宇银行", "海联银行"]
      },
      {
        id: "465",
        name: "单位465",
        balance: "770.000 亿元",
        cost: "2.196617%",
        loans: "176 笔",
        rule: "浮动利率暴露",
        ruleValue: "100%",
        ruleMetricLabel: "浮动利率余额占比",
        ruleMetricValue: "100%",
        owner: "负责人009",
        banks: ["融通银行", "启明银行", "嘉禾银行"]
      },
      {
        id: "561",
        name: "单位561",
        balance: "20.016 亿元",
        cost: "2.228380%",
        loans: "50 笔",
        rule: "短期债务集中",
        ruleValue: "93.545164%",
        ruleMetricLabel: "短期债务余额占比",
        ruleMetricValue: "93.545164%",
        owner: "负责人009",
        banks: ["同州银行", "星河银行", "恒信银行"]
      }
    ],
    groupMetrics: [
      { label: "融资余额", value: "21,613.387", unit: "亿元" },
      { label: "加权平均融资成本", value: "2.372231", unit: "%" },
      { label: "浮动利率余额占比", value: "95.149492", unit: "%" },
      { label: "短期债务余额占比", value: "0.911805", unit: "%" }
    ],
    combinations: [
      { units: "单位553 + 单位465", balance: "1,163.134 亿元", cost: "2.427930%" },
      { units: "单位553 + 单位561", balance: "413.150 亿元", cost: "2.849367%" },
      { units: "单位465 + 单位561", balance: "790.016 亿元", cost: "2.197422%" },
      { units: "单位553 + 单位465 + 单位561", balance: "1,183.150 亿元", cost: "2.424554%" }
    ],
    report: {
      id: "RPT-FIN-20260813-001",
      version: "内容版本 1.0",
      evidence: "证据包 2026.08.13-01",
      title: "集团融资成本与重点行动分析",
      formats: ["HTML", "PDF"]
    }
  };
})();
