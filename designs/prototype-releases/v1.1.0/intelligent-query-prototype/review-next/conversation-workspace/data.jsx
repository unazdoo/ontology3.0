/* Intelligent Query review domain. This file reads upstream prototype state but never writes it. */
(() => {
  "use strict";

  const C008_PROJECTION_STORAGE_KEY = "ontology3-c008-authoritative-projection-v1";
  const C008_SCHEMA_VERSION = 1;
  const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1";
  const HANDOFF_REQUEST_STORAGE_KEY = `${HANDOFF_CHANNEL}:request`;
  const LEGACY_ONTOLOGY_STORAGE_KEYS = Object.freeze([
    "ontology3-canvas-first-review-v16",
    "ontology3-canvas-first-review-v17"
  ]);
  const C017_PROJECTION_STORAGE_KEY = "ontology3.c017.intelligent-query.projection.v1";
  const C011_INBOX_STORAGE_KEY = "ontology3.decision-center.c011.inbox.v1";
  const SCENARIO_RESET_REQUEST_KEY = `${HANDOFF_CHANNEL}:scenario-reset-request`;
  const IDENTITY_COUNTER_STORAGE_KEY = "ontology3.iq.review.identity-counter.v1";
  const ACTIVE_ONTOLOGY_ID = "ONT-GROUP-FINANCING-OPTIMIZATION";
  const ACTIVE_DATA_ASSET_ID = "FIN-ASSET";
  const ONTOLOGY_ENTRY = "../../../ontology-management-review/canvas-first/index.html";
  const DATA_ENGINEERING_ENTRY = "../../../data-engineering-prototype-review/review-v3/方案B2.html#/resources/asset/finance-asset-target";
  const STATE_SCHEMA_VERSION = 20;
  const LINK_CANONICAL_ENDPOINTS = Object.freeze({
    "LINK-ENTITY-FINANCING": Object.freeze({ from: "OBJ-FINANCING-DETAIL", to: "OBJ-FINANCING-ENTITY" }),
    "LINK-FINANCING-INSTITUTION": Object.freeze({ from: "OBJ-FINANCING-DETAIL", to: "OBJ-FINANCIAL-INSTITUTION" }),
    "LINK-ENTITY-OWNER": Object.freeze({ from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-OWNER" })
  });
  const LINK_DIRECTION_WHITELIST = Object.freeze({
    "LINK-ENTITY-FINANCING": Object.freeze([
      "OBJ-FINANCING-DETAIL>OBJ-FINANCING-ENTITY",
      "OBJ-FINANCING-ENTITY>OBJ-FINANCING-DETAIL"
    ]),
    "LINK-FINANCING-INSTITUTION": Object.freeze([
      "OBJ-FINANCING-DETAIL>OBJ-FINANCIAL-INSTITUTION"
    ]),
    "LINK-ENTITY-OWNER": Object.freeze([
      "OBJ-FINANCING-ENTITY>OBJ-FINANCING-OWNER"
    ])
  });
  const QUERY_LINK_PATHS = Object.freeze({
    "unit-cost": Object.freeze([
      Object.freeze({ linkId: "LINK-ENTITY-FINANCING", from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-DETAIL" })
    ]),
    "pair-cost": Object.freeze([
      Object.freeze({ linkId: "LINK-ENTITY-FINANCING", from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-DETAIL" })
    ]),
    "triple-cost": Object.freeze([
      Object.freeze({ linkId: "LINK-ENTITY-FINANCING", from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-DETAIL" })
    ]),
    "group-overview": Object.freeze([
      Object.freeze({ linkId: "LINK-ENTITY-FINANCING", from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-DETAIL" })
    ]),
    "rule-explain": Object.freeze([
      Object.freeze({ linkId: "LINK-ENTITY-FINANCING", from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-DETAIL" })
    ]),
    "institution-priority": Object.freeze([
      Object.freeze({ linkId: "LINK-ENTITY-FINANCING", from: "OBJ-FINANCING-ENTITY", to: "OBJ-FINANCING-DETAIL" }),
      Object.freeze({ linkId: "LINK-FINANCING-INSTITUTION", from: "OBJ-FINANCING-DETAIL", to: "OBJ-FINANCIAL-INSTITUTION" })
    ])
  });

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const nowText = () => new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC"
  }).format(new Date()).replaceAll("/", "-");

  function nextStableId(prefix) {
    let counter = 0;
    try {
      counter = Number.parseInt(localStorage.getItem(IDENTITY_COUNTER_STORAGE_KEY) || "0", 10) || 0;
      counter += 1;
      localStorage.setItem(IDENTITY_COUNTER_STORAGE_KEY, String(counter));
    } catch (_) {
      counter = Math.floor(Math.random() * 1000) + 1;
    }
    return `${prefix}-${Date.now().toString(36).toUpperCase()}-${String(counter).padStart(3, "0")}`;
  }

  function readStoredJson(storageKey, label) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { ok: false, missing: true, reason: `尚未发现${label}状态` };
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object") return { ok: false, reason: `${label}状态格式不正确` };
      return { ok: true, value };
    } catch (_) {
      return { ok: false, reason: `${label}状态无法解析` };
    }
  }

  const resource = (type, id, name, props = {}) => ({
    type, id, name, owner: "本体管理", status: "已发布", ...props
  });

  const RESOURCES = [
    resource("Object Type", "OBJ-FINANCING-ENTITY", "融资主体", { scope: "集团、产业板块、单位", description: "承担融资余额、成本、结构判断与优化行动的集团所属单位。" }),
    resource("Object Type", "OBJ-FINANCING-DETAIL", "融资明细", { scope: "一笔融资借据", description: "具有独立借据身份、余额、利率、期限、币种和融资机构的融资事实。" }),
    resource("Object Type", "OBJ-FINANCIAL-INSTITUTION", "融资机构", { scope: "金融机构", description: "为融资明细提供资金并可作为协商对象的金融机构。" }),
    resource("Object Type", "OBJ-FINANCING-OWNER", "融资负责人", { scope: "责任承接", description: "承接融资主体优化行动的业务责任人。" }),

    resource("Property", "PROP-FINANCING-ENTITY-UNIT-CODE", "单位编码", { parentId: "OBJ-FINANCING-ENTITY", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-ENTITY-UNIT-NAME", "单位名称", { parentId: "OBJ-FINANCING-ENTITY", role: "标题", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-ENTITY-SECTOR", "所属板块", { parentId: "OBJ-FINANCING-ENTITY", role: "分组", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-ENTITY-OWNER-ID", "负责人标识", { parentId: "OBJ-FINANCING-ENTITY", role: "关系端点", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-DETAIL-LOAN-ID", "借据编号", { parentId: "OBJ-FINANCING-DETAIL", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-DETAIL-ENTITY-CODE", "单位编码", { parentId: "OBJ-FINANCING-DETAIL", role: "关系端点", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-DETAIL-INSTITUTION-CODE", "机构编码", { parentId: "OBJ-FINANCING-DETAIL", role: "关系端点", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-DETAIL-CURRENCY", "币种", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-CNY-BALANCE", "折合人民币余额", { parentId: "OBJ-FINANCING-DETAIL", dataType: "数值", unit: "人民币元" }),
    resource("Property", "PROP-FINANCING-DETAIL-INTEREST-RATE", "当前利率", { parentId: "OBJ-FINANCING-DETAIL", dataType: "数值", unit: "%" }),
    resource("Property", "PROP-FINANCING-DETAIL-RATE-TYPE", "利率形式", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-TERM-TYPE", "期限种类", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-GUARANTEE-TYPE", "担保方式", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-AS-OF-DATE", "数据截至时间", { parentId: "OBJ-FINANCING-DETAIL", dataType: "日期" }),
    resource("Property", "PROP-FINANCIAL-INSTITUTION-CODE", "机构编码", { parentId: "OBJ-FINANCIAL-INSTITUTION", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCIAL-INSTITUTION-NAME", "机构名称", { parentId: "OBJ-FINANCIAL-INSTITUTION", role: "标题", dataType: "文本" }),
    resource("Property", "PROP-FINANCIAL-INSTITUTION-CATEGORY", "机构类别", { parentId: "OBJ-FINANCIAL-INSTITUTION", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-OWNER-ID", "负责人标识", { parentId: "OBJ-FINANCING-OWNER", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-OWNER-NAME", "负责人名称", { parentId: "OBJ-FINANCING-OWNER", role: "标题", dataType: "文本" }),

    resource("Link Type", "LINK-ENTITY-FINANCING", "融资归属主体", { scope: "融资明细 → 融资主体；允许主体反向取得融资明细", source: "OBJ-FINANCING-DETAIL", target: "OBJ-FINANCING-ENTITY", allowedDirection: "融资明细→主体；主体→明细" }),
    resource("Link Type", "LINK-FINANCING-INSTITUTION", "融资由机构提供", { scope: "融资明细 → 融资机构", source: "OBJ-FINANCING-DETAIL", target: "OBJ-FINANCIAL-INSTITUTION", allowedDirection: "融资明细→机构" }),
    resource("Link Type", "LINK-ENTITY-OWNER", "主体由负责人承接", { scope: "融资主体 → 融资负责人", source: "OBJ-FINANCING-ENTITY", target: "OBJ-FINANCING-OWNER", allowedDirection: "主体→负责人" }),

    resource("Metric", "MET-FINANCING-BALANCE", "融资余额", { unit: "人民币元", scope: "集团、板块、主体及主体集合", time: "数据截至时点" }),
    resource("Metric", "MET-WAVG-FINANCING-COST", "余额加权平均融资成本", { unit: "%", scope: "集团、板块、主体及主体集合", time: "数据截至时点" }),
    resource("Metric", "MET-FLOATING-RATE-BALANCE-RATIO", "浮动利率余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点" }),
    resource("Metric", "MET-SHORT-TERM-DEBT-RATIO", "短期债务余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点", decision: "短期债务口径待确认" }),
    resource("Metric", "MET-FX-FINANCING-SHARE", "外币融资余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点" }),
    resource("Metric", "MET-HIGH-COST-BALANCE-RATIO", "高成本融资余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点", decision: "高成本阈值待确认" }),
    resource("Metric", "MET-CREDIT-FINANCING-SHARE", "信用融资余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点" }),

    resource("Rule", "RULE-HIGH-FINANCING-COST", "融资成本偏高", { code: "R01", scope: "融资主体", decision: "阈值与排序口径待确认" }),
    resource("Rule", "RULE-FLOATING-RATE-EXPOSURE", "浮动利率暴露偏高", { code: "R02", scope: "融资主体", decision: "规则阈值待确认" }),
    resource("Rule", "RULE-SHORT-TERM-DEBT-CONCENTRATION", "短期债务集中", { code: "R03", scope: "融资主体", decision: "阈值与短期债务口径待确认" }),
    resource("Action Type", "ACTION-FINANCING-OPTIMIZATION", "发起融资优化建议", { scope: "单一融资主体", decision: "默认完成期限待确认" })
  ];

  const resourceById = Object.fromEntries(RESOURCES.map((item) => [item.id, item]));
  const CANONICAL_S001_RESOURCE_IDS = Object.freeze(RESOURCES.map((item) => item.id));
  const LEGACY_S001_RESOURCE_IDS = new Set([
    "PROP-FINANCING-DETAIL-DOMESTIC-OVERSEAS",
    "PROP-FINANCING-DETAIL-DRAWDOWN-DATE",
    "PROP-FINANCING-DETAIL-MATURITY-DATE",
    "PROP-FINANCING-DETAIL-FX-RATE",
    "PROP-FINANCING-DETAIL-ORIGINAL-BALANCE",
    "PROP-FINANCING-DETAIL-FINANCING-TYPE"
  ]);
  const RESOURCE_ID_ALIASES = Object.freeze({
    "MET-FIN-BALANCE": "MET-FINANCING-BALANCE",
    "MET-WAVG-COST": "MET-WAVG-FINANCING-COST",
    "MET-HIGH-COST-SHARE": "MET-HIGH-COST-BALANCE-RATIO",
    "MET-FLOATING-RATE-SHARE": "MET-FLOATING-RATE-BALANCE-RATIO",
    "MET-SHORT-DEBT-SHARE": "MET-SHORT-TERM-DEBT-RATIO",
    "RULE-HIGH-COST": "RULE-HIGH-FINANCING-COST",
    "RULE-FLOATING-EXPOSURE": "RULE-FLOATING-RATE-EXPOSURE",
    "RULE-SHORT-DEBT": "RULE-SHORT-TERM-DEBT-CONCENTRATION"
  });

  function migrateConfigResourceIds(config, defaults = null) {
    if (!config) return config;
    const fallback = defaults || {};
    const migratedResourceIds = [...new Set((config.allowedResources || fallback.allowedResources || []).map((id) => RESOURCE_ID_ALIASES[id] || id))];
    const isS001Config = (config.sceneId || fallback.sceneId) === "S001";
    const needsPublishedResourceRepair = isS001Config && (
      migratedResourceIds.some((id) => LEGACY_S001_RESOURCE_IDS.has(id)) ||
      CANONICAL_S001_RESOURCE_IDS.some((id) => !migratedResourceIds.includes(id))
    );
    return {
      ...clone(fallback),
      ...config,
      skills: clone(config.skills || fallback.skills || []),
      tools: clone(config.tools || fallback.tools || []),
      deterministicCapabilities: clone(config.deterministicCapabilities || fallback.deterministicCapabilities || []),
      allowedResources: needsPublishedResourceRepair ? [...CANONICAL_S001_RESOURCE_IDS] : migratedResourceIds,
      effectiveFrom: config.effectiveFrom || fallback.effectiveFrom || null,
      effectiveTo: config.effectiveTo || fallback.effectiveTo || null
    };
  }

  const SKILLS = [
    { id: "SK-IQ-DISCOVERY", name: "场景与资源发现", version: "1.8", source: "智能问数能力目录", owner: "智能问数", boundary: "只发现白名单内已发布资源" },
    { id: "SK-IQ-SCOPE", name: "对象解析与消歧", version: "2.1", source: "智能问数能力目录", owner: "智能问数", boundary: "按稳定身份确认对象范围" },
    { id: "SK-IQ-PLAN", name: "受控查询规划", version: "1.0", source: "智能问数能力目录", owner: "智能问数", boundary: "只规划获准 Object、Metric、Rule 与 Link，不计算业务结果" }
  ];

  const TOOLS = [
    { id: "TOOL-IQ-SEMANTIC-QUERY", name: "语义查询", version: "1.0", owner: "智能问数", boundary: "对正式 Object、Metric、Rule 与 Link 求值；不读取源表字段" },
    { id: "TOOL-IQ-EVIDENCE-READ", name: "证据读取", version: "1.0", owner: "智能问数", boundary: "只读取本轮固定结果对应的受控证据" },
    { id: "TOOL-IQ-ACTION-REQUEST", name: "行动申请提交", version: "1.0", owner: "智能问数", boundary: "只提交标准行动申请，不运行提醒或待办" }
  ];

  const PLATFORM_CAPABILITIES = [
    { id: "CAP-IQ-AGENT-MATCH", name: "Agent 匹配与配置快照", owner: "智能问数", boundary: "唯一匹配自动选择；多匹配确认；无匹配阻断" },
    { id: "CAP-IQ-CONTEXT-GATE", name: "版本与数据可信度门禁", owner: "智能问数", boundary: "核对已发布语义、正式消费组合、质量、新鲜度和上下文一致性" },
    { id: "CAP-IQ-RESULT-CHECK", name: "结果与证据一致性核验", owner: "智能问数", boundary: "阻断包外数值、无证据结论和静默截断" },
    { id: "CAP-IQ-PRESENT", name: "结果展示与 CSV", owner: "智能问数", boundary: "同一固定结果切换展示和导出，不重查、不重算" }
  ];

  const ACTIVE_CONFIG = {
    id: "IQ-AGENT-FINANCING",
    name: "融资问数 Agent",
    scene: "集团融资成本与债务结构优化",
    sceneId: "S001",
    sceneVersion: null,
    sceneRunId: null,
    sceneVersionStatus: "等待平台场景清单提供版本引用",
    status: "已启用",
    compatibility: "待核对上游正式绑定",
    version: "IQ-FIN-CFG-1.0",
    promptVersion: "IQ-FIN-PROMPT-1.0",
    whitelistVersion: "IQ-FIN-WL-1.0",
    bindingVersion: "由当前正式组合精确读取",
    bindingVersionId: null,
    semanticVersion: null,
    contentFingerprint: "CFG-FINANCING-BASELINE",
    effectiveFrom: null,
    effectiveTo: null,
    validationRef: null,
    compatibilityOwner: "智能问数",
    owner: "智能问数",
    skills: clone(SKILLS),
    observedSkills: [],
    tools: clone(TOOLS),
    observedTools: [],
    deterministicCapabilities: clone(PLATFORM_CAPABILITIES),
    loadProof: null,
    lastRuntimeVerificationAt: null,
    allowedResources: RESOURCES.map((item) => item.id),
    allowedActions: ["导出当前结果 CSV", "保存问数视图", "固定视图引用", "提交标准 Action Request"]
  };

  const CANDIDATE_CONFIG = {
    ...clone(ACTIVE_CONFIG),
    id: "IQ-AGENT-FINANCING-CANDIDATE",
    name: "融资问数 Agent 配置候选",
    status: "候选",
    compatibility: "待验证",
    version: null,
    promptVersion: null,
    whitelistVersion: null,
    contentFingerprint: null,
    candidateRevision: 0,
    validation: { status: "未开始", attempt: 0, repaired: false, tests: [] },
    skills: clone(SKILLS),
    observedSkills: [],
    tools: clone(TOOLS),
    observedTools: [],
    loadProof: null,
    lastRuntimeVerificationAt: null
  };

  const RECOMMENDED_QUESTIONS = [
    { id: "unit-cost", title: "单位融资成本及构成", question: "单位553平均融资成本及构成是什么？", theme: "单位成本", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE", "MET-HIGH-COST-BALANCE-RATIO"] },
    { id: "rec-unit-465-cost", templateId: "unit-cost", title: "单位465成本结构", question: "单位465平均融资成本和融资结构怎么样？", theme: "单位成本", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE", "MET-HIGH-COST-BALANCE-RATIO"] },
    { id: "rec-unit-561-cost", templateId: "unit-cost", title: "单位561成本结构", question: "单位561平均融资成本和融资结构怎么样？", theme: "单位成本", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE", "MET-HIGH-COST-BALANCE-RATIO"] },
    { id: "pair-cost", title: "两家单位综合成本", question: "单位553和单位465综合平均融资成本是多少？", theme: "组合对比", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"] },
    { id: "rec-pair-561", templateId: "pair-cost", title: "553 与 561 综合成本", question: "单位553和单位561综合平均融资成本是多少？", theme: "组合对比", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"] },
    { id: "triple-cost", title: "三家单位综合成本", question: "单位553、单位465和单位561综合平均融资成本是多少？", theme: "组合对比", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"] },
    { id: "group-overview", title: "集团与产业板块对比", question: "集团融资成本、债务结构和产业板块对比如何？", theme: "集团概览", resources: ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "MET-WAVG-FINANCING-COST", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"] },
    { id: "rec-group-structure", templateId: "group-overview", title: "集团债务结构", question: "集团债务结构和浮动利率敞口如何？", theme: "集团概览", resources: ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "MET-WAVG-FINANCING-COST", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"] },
    { id: "rec-sector-cost", templateId: "group-overview", title: "产业板块成本梯度", question: "各产业板块平均融资成本从高到低怎么排？", theme: "集团概览", resources: ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "MET-WAVG-FINANCING-COST"] },
    { id: "rule-explain", title: "三条规则命中解释", question: "为什么单位553、单位465和单位561分别命中不同规则？", theme: "规则解释", resources: ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"] },
    { id: "rec-rule-summary", templateId: "rule-explain", title: "规则命中摘要", question: "三家单位当前命中的规则分别是什么？", theme: "规则解释", resources: ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"] },
    { id: "institution-priority", title: "优先协商金融机构", question: "单位553应优先找哪些银行协商融资成本？", theme: "机构归因", resources: ["RULE-HIGH-FINANCING-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION"] },
    { id: "rec-bank-contribution", templateId: "institution-priority", title: "金融机构成本贡献", question: "单位553的成本压力主要来自哪些银行？", theme: "机构归因", resources: ["RULE-HIGH-FINANCING-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION"] },
    { id: "rec-bank-three", templateId: "institution-priority", title: "优先协商顺序", question: "单位553与哪些银行先谈，顺序怎么排？", theme: "机构归因", resources: ["RULE-HIGH-FINANCING-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION"] },
    { id: "rec-rule-cost", templateId: "rule-explain", title: "融资成本规则", question: "单位553、单位465和单位561分别命中了哪条规则？", theme: "规则解释", resources: ["RULE-HIGH-FINANCING-COST", "MET-WAVG-FINANCING-COST"] },
    { id: "rec-rule-floating", templateId: "rule-explain", title: "浮动利率暴露", question: "单位553、单位465和单位561的浮动利率规则命中情况如何？", theme: "规则解释", resources: ["RULE-FLOATING-RATE-EXPOSURE", "MET-FLOATING-RATE-BALANCE-RATIO"] },
    { id: "rec-sector-structure", templateId: "group-overview", title: "板块利率结构", question: "各产业板块的浮动利率与固定利率结构如何？", theme: "集团概览", resources: ["PROP-FINANCING-ENTITY-SECTOR", "MET-FLOATING-RATE-BALANCE-RATIO"] },
    { id: "rec-group-cost", templateId: "group-overview", title: "集团成本基线", question: "集团平均融资成本和融资余额是多少？", theme: "集团概览", resources: ["MET-WAVG-FINANCING-COST", "MET-FINANCING-BALANCE"] }
  ];

  const CANDIDATE_VALIDATION_QUESTIONS = [
    { id: "CVQ-01", templateId: "unit-cost", question: "单位553平均融资成本及构成是什么？", expected: "核对单一主体、余额加权成本和融资构成均来自候选双版本的固定结果。" },
    { id: "CVQ-02", templateId: "pair-cost", question: "单位553和单位465综合平均融资成本是多少？", expected: "核对两家主体按稳定身份去重，并使用候选结果中的余额和成本形成组合结果。" },
    { id: "CVQ-03", templateId: "triple-cost", question: "单位553、单位465和单位561综合平均融资成本是多少？", expected: "核对三家主体集合、组合成本、单位结果和证据映射完整一致。" },
    { id: "CVQ-04", templateId: "group-overview", question: "集团融资成本、债务结构和产业板块对比如何？", expected: "核对集团与板块层级、结构指标、业务单位和候选结果范围。" },
    { id: "CVQ-05", templateId: "rule-explain", question: "为什么单位553、单位465和单位561分别命中不同规则？", expected: "核对三条 Rule 的正式求值、对象稳定身份、命中原因和逐项规则证据。" },
    { id: "CVQ-06", templateId: "institution-priority", question: "单位553的异常贷款应优先与哪些金融机构协商？", expected: "核对主体到借据、机构和负责人的已发布关系，并引用同版 Action Type。" }
  ];

  const result = (id, title, scope, resourceIds, summary, highlights, rows, chart, nextQuestions, extra = {}) => ({
    id, title, scope, resourceIds, summary, highlights, rows, chart, nextQuestions, ...extra
  });

  const evidenceIdFor = (templateId, rowId) => `E-${templateId}-${rowId}`;
  const chartItem = (templateId, rowId, label, value, unit, resourceId, status = "可计算", extra = {}) => ({
    id: rowId, rowId, evidenceId: evidenceIdFor(templateId, rowId), label, value, exact: String(value), unit, resourceId, status, ...extra
  });

  function enrichResultTemplate(template) {
    const rows = (template.rows || []).map((row) => ({ ...row, evidenceId: row.evidenceId || evidenceIdFor(template.id, row.id) }));
    const rowMap = Object.fromEntries(rows.map((row) => [row.id, row]));
    const itemsForRows = (ids, labels, values, unit, resourceId) => ids.map((rowId, index) => {
      const row = rowMap[rowId];
      return chartItem(template.id, rowId, labels[index], values[index], unit || row?.unit || "", resourceId || row?.resourceId, row?.status || "可计算");
    });
    let adapters = {};
    if (template.id === "unit-cost") {
      adapters = {
        metric: { items: [chartItem(template.id, "avg-cost", "平均融资成本", 2.881, "%", "MET-WAVG-FINANCING-COST")], unit: "%" },
        donut: { items: itemsForRows(["high-cost", "other-cost"], ["高成本融资", "其他融资"], [77.337, 22.663], "%"), unit: "%", composition: true },
        bar: { items: itemsForRows(["high-cost", "other-cost"], ["高成本融资", "其他融资"], [77.337, 22.663], "%"), unit: "%" }
      };
    } else if (template.id === "pair-cost") {
      adapters = {
        metric: { items: [chartItem(template.id, "combined-cost", "综合平均融资成本", 2.428, "%", "MET-WAVG-FINANCING-COST")], unit: "%" },
        bar: { items: itemsForRows(["unit-553", "unit-465"], ["单位553", "单位465"], [2.881, 2.197], "%", "MET-WAVG-FINANCING-COST"), unit: "%" }
      };
    } else if (template.id === "triple-cost") {
      adapters = {
        metric: { items: [chartItem(template.id, "combined-cost", "综合平均融资成本", 2.425, "%", "MET-WAVG-FINANCING-COST")], unit: "%" },
        bar: { items: itemsForRows(["unit-553", "unit-465", "unit-561"], ["单位553", "单位465", "单位561"], [2.881, 2.197, 2.228], "%", "MET-WAVG-FINANCING-COST"), unit: "%" }
      };
    } else if (template.id === "group-overview") {
      const ids = ["nuclear", "renewable", "service", "digital", "finance", "environment"];
      const labels = ["核能", "境内新能源", "产业服务", "数字化", "产业金融", "环保产业"];
      const costValues = [1.948, 2.286, 2.462, 2.523, 2.614, 2.741];
      const structure = [[91.2, 8.8], [96.7, 3.3], [94.1, 5.9], [97.5, 2.5], [93.4, 6.6], [95.8, 4.2]];
      adapters = {
        metric: { items: [chartItem(template.id, "group", "集团平均融资成本", 2.372, "%", "MET-WAVG-FINANCING-COST")], unit: "%" },
        bar: { items: itemsForRows(ids, labels, costValues, "%", "MET-WAVG-FINANCING-COST"), unit: "%", meaning: "板块平均融资成本" },
        stacked: { items: ids.map((rowId, index) => ({ ...chartItem(template.id, `${rowId}-structure-total`, labels[index], 100, "%", "MET-FLOATING-RATE-BALANCE-RATIO"), segments: [
          chartItem(template.id, `${rowId}-floating`, "浮动利率", structure[index][0], "%", "MET-FLOATING-RATE-BALANCE-RATIO", "可计算", { evidenceId: evidenceIdFor(template.id, rowId) }),
          chartItem(template.id, `${rowId}-fixed`, "固定利率", structure[index][1], "%", "MET-FLOATING-RATE-BALANCE-RATIO", "可计算", { evidenceId: evidenceIdFor(template.id, rowId) })
        ] })), unit: "%", segmentLabels: ["浮动利率", "固定利率"], meaning: "融资利率结构" }
      };
    } else if (template.id === "rule-explain") {
      adapters = { table: { items: rows.map((row) => ({ id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.object, value: null, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status })) } };
    } else if (template.id === "institution-priority") {
      adapters = {
        metric: { items: [chartItem(template.id, "problem-balance", "问题余额", 99.586, "亿元", "MET-FINANCING-BALANCE")], unit: "亿元" },
        bar: { items: itemsForRows(["bank-1", "bank-2", "bank-3"], ["欧陆银行", "寰宇银行", "海联银行"], [99.586, 65.494, 58.476], "亿元", "LINK-FINANCING-INSTITUTION"), unit: "亿元", queryTopN: 3 }
      };
    }
    return { ...template, rows, chart: { ...template.chart, adapters } };
  }

  const evidenceRefsFor = (resultId, rowId) => ({
    evidenceId: evidenceIdFor(resultId, rowId),
    resultItemId: rowId
  });

  const RESULT_TEMPLATES = {
    "unit-cost": result(
      "unit-cost", "单位553融资成本及构成", ["单位553"],
      ["OBJ-FINANCING-ENTITY", "OBJ-FINANCING-DETAIL", "LINK-ENTITY-FINANCING", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST", "MET-HIGH-COST-BALANCE-RATIO", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"],
      "单位553平均融资成本为 2.881%，融资余额为 393.134 亿元。高成本融资余额占比 77.337%，是当前成本结构的主要关注项。",
      [
        { id: "avg-cost", label: "平均融资成本", value: "2.881%", exact: "2.881", unit: "%", tone: "warning" },
        { id: "balance", label: "融资余额", value: "393.134 亿元", exact: "393.134", unit: "亿元" },
        { id: "high-cost", label: "高成本融资余额占比", value: "77.337%", exact: "77.337", unit: "%", tone: "danger" }
      ],
      [
        { id: "balance", object: "单位553", resourceId: "MET-FINANCING-BALANCE", label: "融资余额", exact: "393.134", unit: "亿元", status: "可计算" },
        { id: "avg-cost", object: "单位553", resourceId: "MET-WAVG-FINANCING-COST", label: "余额加权平均融资成本", exact: "2.881", unit: "%", status: "可计算" },
        { id: "high-cost", object: "单位553", resourceId: "MET-HIGH-COST-BALANCE-RATIO", label: "高成本融资余额占比", exact: "77.337", unit: "%", status: "可计算", warning: "高成本阈值待确认" },
        { id: "other-cost", object: "单位553", resourceId: "MET-FINANCING-BALANCE", label: "其他融资余额占比", exact: "22.663", unit: "%", status: "可计算" },
        { id: "floating", object: "单位553", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", label: "浮动利率余额占比", exact: "0.000", unit: "%", status: "真实零值" },
        { id: "short", object: "单位553", resourceId: "MET-SHORT-TERM-DEBT-RATIO", label: "短期债务余额占比", exact: "0.000", unit: "%", status: "真实零值", warning: "短期债务口径待确认" }
      ],
      { recommended: "metric", allowed: ["metric", "bar", "donut"], categories: ["高成本融资", "其他融资"], values: [77.337, 22.663], unit: "%", composition: true },
      ["为什么单位553、单位465和单位561分别命中不同规则？", "单位553应优先与哪些金融机构协商？"]
    ),
    "pair-cost": result(
      "pair-cost", "两家单位综合平均融资成本", ["单位553", "单位465"],
      ["OBJ-FINANCING-ENTITY", "LINK-ENTITY-FINANCING", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"],
      "单位553和单位465融资余额合计 1,163.134 亿元，综合平均融资成本为 2.428%。综合结果按融资余额加权计算，不是两个单位成本的简单平均。",
      [
        { id: "combined-cost", label: "综合平均融资成本", value: "2.428%", exact: "2.428", unit: "%" },
        { id: "combined-balance", label: "合计融资余额", value: "1,163.134 亿元", exact: "1163.134", unit: "亿元" },
        { id: "object-count", label: "对象范围", value: "2 家单位", exact: "2", unit: "家", resourceId: "OBJ-FINANCING-ENTITY" }
      ],
      [
        { id: "combined-cost", object: "组合结果", resourceId: "MET-WAVG-FINANCING-COST", label: "综合平均融资成本", exact: "2.428", unit: "%", status: "可计算" },
        { id: "combined-balance", object: "组合结果", resourceId: "MET-FINANCING-BALANCE", label: "合计融资余额", exact: "1163.134", unit: "亿元", status: "可计算" },
        { id: "object-count", object: "对象范围", resourceId: "OBJ-FINANCING-ENTITY", label: "单位数量", exact: "2", unit: "家", status: "可计数" },
        { id: "unit-553", object: "单位553", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.881", unit: "%", status: "可计算" },
        { id: "unit-465", object: "单位465", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.197", unit: "%", status: "可计算" }
      ],
      { recommended: "bar", allowed: ["metric", "bar"], categories: ["单位553", "单位465"], values: [2.881, 2.197], unit: "%" },
      ["把单位561加入组合。", "查看单位553的融资成本及构成。"]
    ),
    "triple-cost": result(
      "triple-cost", "三家单位综合平均融资成本", ["单位553", "单位465", "单位561"],
      ["OBJ-FINANCING-ENTITY", "LINK-ENTITY-FINANCING", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"],
      "三家单位融资余额合计 1,183.150 亿元，综合平均融资成本为 2.425%。结果按融资余额加权计算，三家口径保持一致。",
      [
        { id: "combined-cost", label: "综合平均融资成本", value: "2.425%", exact: "2.425", unit: "%" },
        { id: "combined-balance", label: "合计融资余额", value: "1,183.150 亿元", exact: "1183.150", unit: "亿元" },
        { id: "object-count", label: "对象范围", value: "3 家单位", exact: "3", unit: "家", resourceId: "OBJ-FINANCING-ENTITY" }
      ],
      [
        { id: "combined-cost", object: "组合结果", resourceId: "MET-WAVG-FINANCING-COST", label: "综合平均融资成本", exact: "2.425", unit: "%", status: "可计算" },
        { id: "combined-balance", object: "组合结果", resourceId: "MET-FINANCING-BALANCE", label: "合计融资余额", exact: "1183.150", unit: "亿元", status: "可计算" },
        { id: "object-count", object: "对象范围", resourceId: "OBJ-FINANCING-ENTITY", label: "单位数量", exact: "3", unit: "家", status: "可计数" },
        { id: "unit-553", object: "单位553", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.881", unit: "%", status: "可计算" },
        { id: "unit-465", object: "单位465", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.197", unit: "%", status: "可计算" },
        { id: "unit-561", object: "单位561", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.228", unit: "%", status: "可计算" }
      ],
      { recommended: "bar", allowed: ["metric", "bar"], categories: ["单位553", "单位465", "单位561"], values: [2.881, 2.197, 2.228], unit: "%" },
      ["去掉单位561后重新计算。", "三家分别命中了哪些规则？"]
    ),
    "group-overview": result(
      "group-overview", "集团融资成本与产业板块对比", ["集团"],
      ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "LINK-ENTITY-FINANCING", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"],
      "集团融资余额为 21,613.387 亿元，平均融资成本为 2.372%。浮动利率融资占比 95.149%，产业板块之间存在成本差异。",
      [
        { id: "group-cost", rowId: "group", resourceId: "MET-WAVG-FINANCING-COST", label: "集团平均融资成本", value: "2.372%", exact: "2.372", unit: "%" },
        { id: "group-balance", resourceId: "MET-FINANCING-BALANCE", label: "集团融资余额", value: "21,613.387 亿元", exact: "21613.387", unit: "亿元" },
        { id: "floating", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", label: "浮动利率融资占比", value: "95.149%", exact: "95.149", unit: "%", tone: "warning" },
        { id: "short", resourceId: "MET-SHORT-TERM-DEBT-RATIO", label: "短期债务占比", value: "0.912%", exact: "0.912", unit: "%" }
      ],
      [
        { id: "group", object: "集团", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.372", unit: "%", status: "可计算" },
        { id: "group-balance", object: "集团", resourceId: "MET-FINANCING-BALANCE", label: "融资余额", exact: "21613.387", unit: "亿元", status: "可计算" },
        { id: "floating", object: "集团", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", label: "浮动利率融资占比", exact: "95.149", unit: "%", status: "可计算" },
        { id: "short", object: "集团", resourceId: "MET-SHORT-TERM-DEBT-RATIO", label: "短期债务占比", exact: "0.912", unit: "%", status: "可计算" },
        { id: "nuclear", object: "核能", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "1.948", unit: "%", status: "可计算" },
        { id: "renewable", object: "境内新能源", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.286", unit: "%", status: "可计算" },
        { id: "service", object: "产业服务", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.462", unit: "%", status: "可计算" },
        { id: "digital", object: "数字化", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.523", unit: "%", status: "可计算" },
        { id: "finance", object: "产业金融", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.614", unit: "%", status: "可计算" },
        { id: "environment", object: "环保产业", resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: "2.741", unit: "%", status: "可计算" }
      ],
      { recommended: "bar", allowed: ["metric", "bar", "stacked"], categories: ["核能", "境内新能源", "产业服务", "数字化", "产业金融", "环保产业"], values: [1.948, 2.286, 2.462, 2.523, 2.614, 2.741], stacks: [[91.2,8.8],[96.7,3.3],[94.1,5.9],[97.5,2.5],[93.4,6.6],[95.8,4.2]], unit: "%" },
      ["为什么单位553、单位465和单位561分别命中不同规则？", "单位553应优先找哪些银行协商融资成本？"]
    ),
    "rule-explain": result(
      "rule-explain", "三家单位规则命中解释", ["单位553", "单位465", "单位561"],
      ["OBJ-FINANCING-ENTITY", "RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION", "MET-WAVG-FINANCING-COST", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO"],
      "三家单位的关注点不同：单位553是融资成本偏高，单位465是浮动利率暴露偏高，单位561是短期债务集中。建议按单位分别核对触发原因和可调整空间。",
      [
        { id: "rule-553", label: "单位553", value: "融资成本偏高", exact: "命中", unit: "R01", tone: "danger" },
        { id: "rule-465", label: "单位465", value: "浮动利率暴露偏高", exact: "命中", unit: "R02", tone: "warning" },
        { id: "rule-561", label: "单位561", value: "短期债务集中", exact: "命中", unit: "R03", tone: "warning" }
      ],
      [
        { id: "rule-553", object: "单位553", resourceId: "RULE-HIGH-FINANCING-COST", label: "融资成本偏高", exact: "实际 2.881 / 阈值 2.622", unit: "%", status: "命中", warning: "阈值与排序口径待确认" },
        { id: "rule-465", object: "单位465", resourceId: "RULE-FLOATING-RATE-EXPOSURE", label: "浮动利率暴露偏高", exact: "实际 100.000 / 阈值 80.000", unit: "%", status: "命中", warning: "规则阈值待确认" },
        { id: "rule-561", object: "单位561", resourceId: "RULE-SHORT-TERM-DEBT-CONCENTRATION", label: "短期债务集中", exact: "实际 93.545 / 阈值 30.000", unit: "%", status: "命中", warning: "阈值与短期债务口径待确认" }
      ],
      { recommended: "table", allowed: ["metric", "table"], categories: ["单位553", "单位465", "单位561"], values: [2.881, 100, 93.545], unit: "各规则量纲" },
      ["查看单位553的金融机构贡献。", "分别按单一主体查看行动条件。"]
    ),
    "institution-priority": result(
      "institution-priority", "单位553优先协商金融机构", ["单位553"],
      ["OBJ-FINANCING-ENTITY", "OBJ-FINANCING-DETAIL", "OBJ-FINANCIAL-INSTITUTION", "OBJ-FINANCING-OWNER", "RULE-HIGH-FINANCING-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION", "LINK-ENTITY-OWNER", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"],
      "按问题余额排序，单位553应优先与欧陆银行沟通，其次是寰宇银行和海联银行。",
      [
        { id: "bank-1", rowId: "primary-institution", resourceId: "LINK-FINANCING-INSTITUTION", label: "首要机构", value: "欧陆银行", exact: "欧陆银行", unit: "第1位", tone: "danger" },
        { id: "problem-balance", resourceId: "MET-FINANCING-BALANCE", label: "问题余额", value: "99.586 亿元", exact: "99.586", unit: "亿元" },
        { id: "contribution", resourceId: "RULE-HIGH-FINANCING-COST", label: "成本贡献", value: "32.754%", exact: "32.754", unit: "%" }
      ],
      [
        { id: "target-unit", object: "单位553", resourceId: "OBJ-FINANCING-ENTITY", label: "行动目标稳定身份", exact: "UNIT-553", unit: "", status: "已确认" },
        { id: "primary-institution", object: "单位553", resourceId: "LINK-FINANCING-INSTITUTION", label: "首要机构", exact: "欧陆银行", unit: "第1位", status: "优先级 1" },
        { id: "problem-balance", object: "单位553", resourceId: "MET-FINANCING-BALANCE", label: "问题余额", exact: "99.586", unit: "亿元", status: "可计算" },
        { id: "contribution", object: "单位553", resourceId: "RULE-HIGH-FINANCING-COST", label: "成本贡献", exact: "32.754", unit: "%", status: "可计算" },
        { id: "bank-1", object: "欧陆银行", resourceId: "LINK-FINANCING-INSTITUTION", label: "问题余额贡献", exact: "99.586", unit: "亿元", status: "优先级 1", detail: "16 笔融资 · 平均成本 2.994%", warning: "优先级排序口径待确认" },
        { id: "bank-2", object: "寰宇银行", resourceId: "LINK-FINANCING-INSTITUTION", label: "问题余额贡献", exact: "65.494", unit: "亿元", status: "优先级 2", detail: "11 笔融资 · 平均成本 2.900%", warning: "优先级排序口径待确认" },
        { id: "bank-3", object: "海联银行", resourceId: "LINK-FINANCING-INSTITUTION", label: "问题余额贡献", exact: "58.476", unit: "亿元", status: "优先级 3", detail: "10 笔融资 · 平均成本 3.004%", warning: "优先级排序口径待确认" }
      ],
      { recommended: "bar", allowed: ["metric", "bar"], categories: ["欧陆银行", "寰宇银行", "海联银行"], values: [99.586, 65.494, 58.476], unit: "亿元", queryTopN: 3 },
      ["查看单位553的融资成本及构成。", "为什么单位553、单位465和单位561分别命中不同规则？"],
      { queryDefinitionTopN: 3 }
    )
  };

  Object.keys(RESULT_TEMPLATES).forEach((key) => {
    RESULT_TEMPLATES[key] = enrichResultTemplate(RESULT_TEMPLATES[key]);
  });
  const groupStructureEvidence = [
    ["nuclear", "核能", 91.2, 8.8],
    ["renewable", "境内新能源", 96.7, 3.3],
    ["service", "产业服务", 94.1, 5.9],
    ["digital", "数字化", 97.5, 2.5],
    ["finance", "产业金融", 93.4, 6.6],
    ["environment", "环保产业", 95.8, 4.2]
  ];
  RESULT_TEMPLATES["group-overview"].evidenceReferences = groupStructureEvidence.flatMap(([rowId, object, floating, fixed]) => [
    { ...evidenceRefsFor("group-overview", `${rowId}-structure-total`), type: "融资结构合计", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", object, exact: "100", unit: "%", status: "可计算" },
    { ...evidenceRefsFor("group-overview", `${rowId}-floating`), type: "融资结构分段", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", object, label: "浮动利率", exact: String(floating), unit: "%", status: "可计算" },
    { ...evidenceRefsFor("group-overview", `${rowId}-fixed`), type: "融资结构分段", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO", object, label: "固定利率", exact: String(fixed), unit: "%", status: "可计算" }
  ]);
  RESULT_TEMPLATES["institution-priority"].resourceIds = [
    ...RESULT_TEMPLATES["institution-priority"].resourceIds,
    "ACTION-FINANCING-OPTIMIZATION"
  ];
  RESULT_TEMPLATES["institution-priority"].actionContext = {
    singleTargetStableId: "UNIT-553",
    targetResultItemId: "target-unit",
    targetEvidenceId: "E-institution-priority-target-unit",
    actionTypeId: "ACTION-FINANCING-OPTIMIZATION",
    ruleMetricResourceIds: ["RULE-HIGH-FINANCING-COST", "MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST"],
    institutionStableIds: ["INST-012", "INST-007", "INST-019"],
    institutionEvidenceIds: ["E-institution-priority-bank-1", "E-institution-priority-bank-2", "E-institution-priority-bank-3"],
    loanStableIds: ["LOAN-004842", "LOAN-004791", "LOAN-003206", "LOAN-003241", "LOAN-002118", "LOAN-002164"],
    loanEvidenceIds: ["E-institution-priority-bank-1-loans", "E-institution-priority-bank-2-loans", "E-institution-priority-bank-3-loans"],
    institutionBindings: [
      { institutionStableId: "INST-012", institutionResultItemId: "bank-1", institutionEvidenceId: "E-institution-priority-bank-1", loanStableIds: ["LOAN-004842", "LOAN-004791"], loanResultItemId: "bank-1-loans", loanEvidenceId: "E-institution-priority-bank-1-loans" },
      { institutionStableId: "INST-007", institutionResultItemId: "bank-2", institutionEvidenceId: "E-institution-priority-bank-2", loanStableIds: ["LOAN-003206", "LOAN-003241"], loanResultItemId: "bank-2-loans", loanEvidenceId: "E-institution-priority-bank-2-loans" },
      { institutionStableId: "INST-019", institutionResultItemId: "bank-3", institutionEvidenceId: "E-institution-priority-bank-3", loanStableIds: ["LOAN-002118", "LOAN-002164"], loanResultItemId: "bank-3-loans", loanEvidenceId: "E-institution-priority-bank-3-loans" }
    ],
    ownerStableId: "OWNER-001",
    ownerEvidenceId: "E-institution-priority-owner-unit-553",
    ownerBinding: { ownerStableId: "OWNER-001", ownerResultItemId: "owner-unit-553", ownerEvidenceId: "E-institution-priority-owner-unit-553", targetStableId: "UNIT-553", relationResourceId: "LINK-ENTITY-OWNER" }
  };
  Object.assign(RESULT_TEMPLATES["institution-priority"].rows.find((row) => row.id === "bank-1"), { detail: "机构稳定身份 INST-012 · 16 笔融资 · 平均成本 2.994%" });
  Object.assign(RESULT_TEMPLATES["institution-priority"].rows.find((row) => row.id === "bank-2"), { detail: "机构稳定身份 INST-007 · 11 笔融资 · 平均成本 2.900%" });
  Object.assign(RESULT_TEMPLATES["institution-priority"].rows.find((row) => row.id === "bank-3"), { detail: "机构稳定身份 INST-019 · 10 笔融资 · 平均成本 3.004%" });
  RESULT_TEMPLATES["institution-priority"].evidenceReferences = [
    ...RESULT_TEMPLATES["institution-priority"].rows.map((row) => ({ ...evidenceRefsFor("institution-priority", row.id), type: "结果项", resourceId: row.resourceId })),
    { ...evidenceRefsFor("institution-priority", "bank-1-loans"), type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "欧陆银行", label: "必要借据证据", exact: "LOAN-004842、LOAN-004791", unit: "", status: "可追溯", detail: "只保留本轮行动申请所需的借据稳定身份。" },
    { ...evidenceRefsFor("institution-priority", "bank-2-loans"), type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "寰宇银行", label: "必要借据证据", exact: "LOAN-003206、LOAN-003241", unit: "", status: "可追溯", detail: "只保留本轮行动申请所需的借据稳定身份。" },
    { ...evidenceRefsFor("institution-priority", "bank-3-loans"), type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "海联银行", label: "必要借据证据", exact: "LOAN-002118、LOAN-002164", unit: "", status: "可追溯", detail: "只保留本轮行动申请所需的借据稳定身份。" },
    { ...evidenceRefsFor("institution-priority", "owner-unit-553"), type: "负责人关系", resourceId: "LINK-ENTITY-OWNER", object: "单位553", label: "责任承接", exact: "OWNER-001 · 融资负责人001", unit: "", status: "可追溯", detail: "负责人只作为行动申请证据引用，不在智能问数中形成待办。" }
  ];
  RESULT_TEMPLATES["rule-explain"].resourceIds = [
    ...RESULT_TEMPLATES["rule-explain"].resourceIds,
    "ACTION-FINANCING-OPTIMIZATION",
    "OBJ-FINANCING-DETAIL",
    "OBJ-FINANCIAL-INSTITUTION",
    "OBJ-FINANCING-OWNER",
    "LINK-FINANCING-INSTITUTION",
    "LINK-ENTITY-OWNER"
  ];
  const ruleActionEvidence = [
    { resultItemId: "rule-553-bank-1", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "欧陆银行", label: "问题余额贡献", exact: "99.586", unit: "亿元", status: "优先级 1", detail: "机构稳定身份 INST-012 · 18 笔融资 · 成本偏离最高" },
    { resultItemId: "rule-553-bank-2", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "寰宇银行", label: "问题余额贡献", exact: "83.260", unit: "亿元", status: "优先级 2", detail: "机构稳定身份 INST-007 · 15 笔融资 · 余额贡献第二" },
    { resultItemId: "rule-553-bank-3", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "海联银行", label: "问题余额贡献", exact: "67.180", unit: "亿元", status: "优先级 3", detail: "机构稳定身份 INST-019 · 12 笔融资 · 可置换贷款集中" },
    { resultItemId: "rule-553-bank-1-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "欧陆银行", label: "关联借据", exact: "LOAN-553-041、LOAN-553-028", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-553-bank-2-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "寰宇银行", label: "关联借据", exact: "LOAN-553-063", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-553-bank-3-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "海联银行", label: "关联借据", exact: "LOAN-553-017", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-553-owner", type: "负责人关系", resourceId: "LINK-ENTITY-OWNER", object: "单位553", label: "责任承接", exact: "OWNER-001 · 融资负责人001", unit: "", status: "可追溯", detail: "负责人只作为行动申请证据引用" },
    { resultItemId: "rule-465-bank-1", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "融通银行", label: "问题余额贡献", exact: "168.200", unit: "亿元", status: "优先级 1", detail: "机构稳定身份 INST-021 · 31 笔融资 · 浮动敞口最大" },
    { resultItemId: "rule-465-bank-2", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "启明银行", label: "问题余额贡献", exact: "142.600", unit: "亿元", status: "优先级 2", detail: "机构稳定身份 INST-022 · 27 笔融资 · 重定价日期集中" },
    { resultItemId: "rule-465-bank-3", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "嘉禾银行", label: "问题余额贡献", exact: "119.400", unit: "亿元", status: "优先级 3", detail: "机构稳定身份 INST-023 · 24 笔融资 · 浮动贷款笔数较多" },
    { resultItemId: "rule-465-bank-1-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "融通银行", label: "关联借据", exact: "LOAN-465-126、LOAN-465-098", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-465-bank-2-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "启明银行", label: "关联借据", exact: "LOAN-465-077", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-465-bank-3-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "嘉禾银行", label: "关联借据", exact: "LOAN-465-051", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-465-owner", type: "负责人关系", resourceId: "LINK-ENTITY-OWNER", object: "单位465", label: "责任承接", exact: "OWNER-009 · 融资负责人009", unit: "", status: "可追溯", detail: "负责人只作为行动申请证据引用" },
    { resultItemId: "rule-561-bank-1", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "同州银行", label: "问题余额贡献", exact: "5.860", unit: "亿元", status: "优先级 1", detail: "机构稳定身份 INST-031 · 11 笔融资 · 短期余额最高" },
    { resultItemId: "rule-561-bank-2", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "星河银行", label: "问题余额贡献", exact: "4.320", unit: "亿元", status: "优先级 2", detail: "机构稳定身份 INST-032 · 9 笔融资 · 半年内到期集中" },
    { resultItemId: "rule-561-bank-3", type: "金融机构归因", resourceId: "LINK-FINANCING-INSTITUTION", object: "恒信银行", label: "问题余额贡献", exact: "3.180", unit: "亿元", status: "优先级 3", detail: "机构稳定身份 INST-033 · 8 笔融资 · 续作窗口临近" },
    { resultItemId: "rule-561-bank-1-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "同州银行", label: "关联借据", exact: "LOAN-561-043、LOAN-561-038", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-561-bank-2-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "星河银行", label: "关联借据", exact: "LOAN-561-024", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-561-bank-3-loans", type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "恒信银行", label: "关联借据", exact: "LOAN-561-016", unit: "", status: "可追溯", detail: "本次行动申请所需的固定借据身份" },
    { resultItemId: "rule-561-owner", type: "负责人关系", resourceId: "LINK-ENTITY-OWNER", object: "单位561", label: "责任承接", exact: "OWNER-009 · 融资负责人009", unit: "", status: "可追溯", detail: "负责人只作为行动申请证据引用" }
  ].map((item) => ({ ...item, ...evidenceRefsFor("rule-explain", item.resultItemId) }));
  RESULT_TEMPLATES["rule-explain"].evidenceReferences = [
    ...(RESULT_TEMPLATES["rule-explain"].evidenceReferences || []),
    ...ruleActionEvidence
  ];
  const ruleActionBinding = (unit, institutions, ownerStableId, ownerResultItemId) => ({
    sourceKind: "rule",
    singleTargetStableId: `UNIT-${unit}`,
    targetLabel: `单位${unit}`,
    targetResultItemId: `rule-${unit}`,
    ruleResultItemId: `rule-${unit}`,
    actionTypeId: "ACTION-FINANCING-OPTIMIZATION",
    ruleMetricResourceIds: unit === "553"
      ? ["RULE-HIGH-FINANCING-COST", "MET-WAVG-FINANCING-COST"]
      : unit === "465"
        ? ["RULE-FLOATING-RATE-EXPOSURE", "MET-FLOATING-RATE-BALANCE-RATIO"]
        : ["RULE-SHORT-TERM-DEBT-CONCENTRATION", "MET-SHORT-TERM-DEBT-RATIO"],
    institutionStableIds: institutions.map((item) => item.id),
    institutionEvidenceIds: institutions.map((item) => `E-rule-explain-${unit}-${item.key}`),
    loanStableIds: institutions.flatMap((item) => item.loans),
    loanEvidenceIds: institutions.map((item) => `E-rule-explain-${unit}-${item.loanKey}`),
    institutionBindings: institutions.map((item) => ({
      institutionStableId: item.id,
      institutionResultItemId: `rule-${unit}-${item.key}`,
      institutionEvidenceId: `E-rule-explain-${unit}-${item.key}`,
      loanStableIds: item.loans,
      loanResultItemId: `rule-${unit}-${item.loanKey}`,
      loanEvidenceId: `E-rule-explain-${unit}-${item.loanKey}`
    })),
    ownerStableId,
    ownerEvidenceId: `E-rule-explain-${unit}-${ownerResultItemId}`,
    ownerBinding: { ownerStableId, ownerResultItemId, ownerEvidenceId: `E-rule-explain-${unit}-${ownerResultItemId}`, targetStableId: `UNIT-${unit}`, relationResourceId: "LINK-ENTITY-OWNER" }
  });
  RESULT_TEMPLATES["rule-explain"].actionContexts = [
    ruleActionBinding("553", [
      { key: "bank-1", id: "INST-012", loans: ["LOAN-553-041", "LOAN-553-028"], loanKey: "bank-1-loans" },
      { key: "bank-2", id: "INST-007", loans: ["LOAN-553-063"], loanKey: "bank-2-loans" },
      { key: "bank-3", id: "INST-019", loans: ["LOAN-553-017"], loanKey: "bank-3-loans" }
    ], "OWNER-001", "rule-553-owner"),
    ruleActionBinding("465", [
      { key: "bank-1", id: "INST-021", loans: ["LOAN-465-126", "LOAN-465-098"], loanKey: "bank-1-loans" },
      { key: "bank-2", id: "INST-022", loans: ["LOAN-465-077"], loanKey: "bank-2-loans" },
      { key: "bank-3", id: "INST-023", loans: ["LOAN-465-051"], loanKey: "bank-3-loans" }
    ], "OWNER-009", "rule-465-owner"),
    ruleActionBinding("561", [
      { key: "bank-1", id: "INST-031", loans: ["LOAN-561-043", "LOAN-561-038"], loanKey: "bank-1-loans" },
      { key: "bank-2", id: "INST-032", loans: ["LOAN-561-024"], loanKey: "bank-2-loans" },
      { key: "bank-3", id: "INST-033", loans: ["LOAN-561-016"], loanKey: "bank-3-loans" }
    ], "OWNER-009", "rule-561-owner")
  ];
  const REQUIRED_QUERY_RESOURCE_IDS = Object.freeze([...new Set(Object.values(RESULT_TEMPLATES).flatMap((template) => template.resourceIds || []))]);

  const queryDefinition = (templateId) => {
    const template = RESULT_TEMPLATES[templateId];
    return {
      scene: "集团融资成本与债务结构优化",
      sceneId: "S001",
      sceneVersion: null,
      sceneRunId: null,
      objectScope: clone(template.scope),
      resourceIds: clone(template.resourceIds),
      filters: [],
      grouping: templateId === "group-overview" ? ["PROP-FINANCING-ENTITY-SECTOR"] : [],
      sorting: templateId === "institution-priority" ? "问题余额贡献降序" : "业务默认",
      timePolicy: "运行时使用当前正式组合的数据截至时间",
      topN: template.queryDefinitionTopN || null
    };
  };
  const HISTORY = [];
  const SAVED_VIEWS = [];
  const PINS = [];

  function remapActionEvidence(actionContext, evidenceByItem) {
    if (!actionContext) return;
    actionContext.targetEvidenceId = evidenceByItem[actionContext.targetResultItemId] || null;
    actionContext.ruleEvidenceId = evidenceByItem[actionContext.ruleResultItemId] || null;
    actionContext.institutionBindings = (actionContext.institutionBindings || []).map((binding) => ({
      ...binding,
      institutionEvidenceId: evidenceByItem[binding.institutionResultItemId] || null,
      loanEvidenceId: evidenceByItem[binding.loanResultItemId] || null
    }));
    actionContext.institutionStableIds = actionContext.institutionBindings.map((binding) => binding.institutionStableId);
    actionContext.institutionEvidenceIds = actionContext.institutionBindings.map((binding) => binding.institutionEvidenceId).filter(Boolean);
    actionContext.loanStableIds = actionContext.institutionBindings.flatMap((binding) => binding.loanStableIds || []);
    actionContext.loanEvidenceIds = actionContext.institutionBindings.map((binding) => binding.loanEvidenceId).filter(Boolean);
    actionContext.ownerBinding = actionContext.ownerBinding ? {
      ...(actionContext.ownerBinding || {}),
      ownerEvidenceId: evidenceByItem[actionContext.ownerBinding?.ownerResultItemId] || null
    } : null;
    actionContext.ownerEvidenceId = actionContext.ownerBinding?.ownerEvidenceId || null;
  }

  function bindConfigSnapshot(config, ontologyContext, isActive = false) {
    const snapshot = clone(config);
    if (!ontologyContext?.ready) {
      snapshot.bindingVersionId = null;
      snapshot.semanticVersion = null;
      snapshot.bindingVersion = "等待精确已发布版本与正式数据绑定";
      snapshot.compatibility = isActive ? "待核对上游正式绑定" : "待验证";
      return snapshot;
    }
    snapshot.bindingVersionId = ontologyContext.versionId;
    snapshot.semanticVersion = ontologyContext.semanticVersion;
    snapshot.bindingVersion = `${ontologyContext.semanticVersion} · ${ontologyContext.versionId}`;
    snapshot.compatibility = isActive ? "需重验" : "待验证";
    snapshot.c009Validation = null;
    return snapshot;
  }

  function createInitialState() {
    const ontologyContext = readOntologyBindingContext();
    const upstreamScenario = ontologyContext?.scenarioId ? {
      id: ontologyContext.scenarioId,
      name: "集团融资成本与债务结构优化",
      version: ontologyContext.scenarioVersion,
      runId: ontologyContext.scenarioRunId,
      formedAt: ontologyContext.scenarioFormedAt || ontologyContext.projectionFormedAt || null,
      source: "C008 权威投影",
      status: ontologyContext.scenarioStatus || "已读取"
    } : {
      id: "S001",
      name: "集团融资成本与债务结构优化",
      version: null,
      runId: null,
      formedAt: null,
      source: "平台场景清单",
      status: "场景运行上下文待读取"
    };
    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      serial: 0,
      activeConfig: bindConfigSnapshot(ACTIVE_CONFIG, ontologyContext, true),
      enabledConfigs: [bindConfigSnapshot(ACTIVE_CONFIG, ontologyContext, true)],
      candidateConfig: bindConfigSnapshot(CANDIDATE_CONFIG, ontologyContext, false),
      recommendations: { status: "未生成", attempt: 0, items: [], error: null, generatedAt: null },
      liveRuns: [],
      historyRuns: clone(HISTORY),
      currentRunId: null,
      savedViews: clone(SAVED_VIEWS),
      pins: clone(PINS),
      actionRequests: [],
      historicalActionRequests: [],
      handledScenarioResetRequestIds: [],
      candidateConsumptionValidation: { status: "未开始", attempts: [], activeRun: null },
      draftQuestion: "",
      preferredDisplay: { mode: "text", chart: "recommended", reducedMotion: false },
      currentScenario: "S001",
      scenarioContext: upstreamScenario,
      ui: { resourceView: "cards", historyFilter: "全部", viewMode: "cards" }
    };
  }

  function persistedRunResourceIds(run) {
    const result = run?.result || {};
    const actionContexts = [result.actionContext, ...(result.actionContexts || [])].filter(Boolean);
    return [...new Set([
      ...(result.resourceIds || []),
      ...(result.rows || []).map((item) => item?.resourceId),
      ...(result.evidenceReferences || []).map((item) => item?.resourceId),
      ...actionContexts.flatMap((item) => [item?.actionTypeId, ...(item?.ruleMetricResourceIds || [])])
    ].filter(Boolean))];
  }

  function compactPersistedResource(resource) {
    if (!resource) return null;
    return {
      id: resource.id || null,
      name: resource.name || resource.id || null,
      type: resource.type || resource.kind || null,
      kind: resource.kind || null,
      definition: resource.definition || null,
      unit: resource.unit || null,
      businessBasis: resource.businessBasis || null,
      publicationState: resource.publicationState || resource.status || null,
      source: resource.source || resource.sourceName || null,
      target: resource.target || resource.targetName || null,
      allowedDirection: resource.allowedDirection || resource.direction || null
    };
  }

  function compactPersistedContext(context, resourceIds = []) {
    if (!context || typeof context !== "object") return context;
    const allowed = new Set(resourceIds.filter(Boolean));
    const resources = (context.resources || [])
      .filter((resource) => allowed.has(resource?.id))
      .map(compactPersistedResource)
      .filter(Boolean);
    const compact = {
      ...context,
      resources,
      storageShape: "fixed-run-context-v1",
      resourceReferenceIds: [...allowed]
    };
    delete compact.endpointContract;
    delete compact.consistencyProof;
    return compact;
  }

  function compactPersistedRun(run) {
    if (!run || typeof run !== "object") return run;
    const resourceIds = persistedRunResourceIds(run);
    return {
      ...run,
      context: compactPersistedContext(run.context, resourceIds)
    };
  }

  function compactPersistedRequest(request) {
    if (!request || typeof request !== "object") return request;
    const action = request.actionContext || {};
    const resourceIds = [request.actionType, request.ruleId, ...(action.ruleMetricResourceIds || [])].filter(Boolean);
    return {
      ...request,
      context: compactPersistedContext(request.context, resourceIds)
    };
  }

  function stateForPersistence(state) {
    const compact = clone(state);
    compact.liveRuns = (state.liveRuns || []).map(compactPersistedRun);
    compact.historyRuns = (state.historyRuns || []).map(compactPersistedRun);
    compact.actionRequests = (state.actionRequests || []).map(compactPersistedRequest);
    compact.historicalActionRequests = (state.historicalActionRequests || []).map(compactPersistedRequest);
    return compact;
  }

  function loadState(storageKey) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored && storageKey === "ontology3.iq.review.conversation.v2") {
        const legacy = JSON.parse(localStorage.getItem("ontology3.iq.review.conversation.v1"));
        const current = readOntologyBindingContext();
        const validation = legacy?.activeConfig?.c009Validation;
        const exactReusableConfiguration = Boolean(
          legacy?.schemaVersion === STATE_SCHEMA_VERSION && legacy?.activeConfig?.status === "已启用" &&
          legacy?.activeConfig?.compatibility === "兼容" && validation?.status === "通过" &&
          validation?.versionId === current?.versionId && validation?.semanticVersion === current?.semanticVersion &&
          validation?.dataVersion === current?.dataVersion && validation?.asOf === current?.asOf &&
          validation?.sceneId === current?.scenarioId && validation?.sceneVersion === current?.scenarioVersion &&
          validation?.sceneRunId === current?.scenarioRunId
        );
        if (exactReusableConfiguration) {
          const fresh = createInitialState();
          const activeConfig = migrateConfigResourceIds(clone(legacy.activeConfig), ACTIVE_CONFIG);
          return {
            ...fresh,
            activeConfig,
            enabledConfigs: [clone(activeConfig)],
            recommendations: { status: "未生成", attempt: 0, items: [], error: null, generatedAt: null }
          };
        }
      }
      const parsed = JSON.parse(stored);
      if (!parsed || parsed.schemaVersion !== STATE_SCHEMA_VERSION) return createInitialState();
      parsed.activeConfig = migrateConfigResourceIds(parsed.activeConfig, ACTIVE_CONFIG);
      parsed.candidateConfig = migrateConfigResourceIds(parsed.candidateConfig, CANDIDATE_CONFIG);
      parsed.enabledConfigs = (parsed.enabledConfigs || []).map((config) => migrateConfigResourceIds(config, ACTIVE_CONFIG));
      const normalizeChart = (chart) => ({ bar: "horizontal-bar", stacked: "stacked-bar" }[chart] || chart || "recommended");
      const recoverInterruptedDelivery = (run) => run?.deliveryStatus === "提交中" ? {
        ...run,
        deliveryStatus: "状态待核对",
        deliveryError: "上次提交在页面关闭或重新加载时尚未取得可确认结果；请核对本体管理当前候选后重新提交"
      } : run;
      const recoverInterruptedRun = (run) => run?.status === "处理中" ? {
        ...run,
        status: "失败",
        completedAt: nowText(),
        failure: "上次运行在页面关闭或重新加载前未完成，结果状态无法确认。",
        recovery: "重新读取当前权威上下文后再次运行；不会沿用未完成结果。",
        retryable: true,
        recoveryRoute: "ask",
        recoveryOwner: "agent"
      } : run;
      if (parsed.preferredDisplay) parsed.preferredDisplay.chart = normalizeChart(parsed.preferredDisplay.chart);
      parsed.liveRuns = (parsed.liveRuns || []).map(recoverInterruptedRun);
      [...parsed.liveRuns, ...(parsed.historyRuns || [])].forEach((run) => {
        if (run?.display) run.display.chart = normalizeChart(run.display.chart);
      });
      (parsed.savedViews || []).forEach((view) => {
        if (view?.displayPreference) view.displayPreference.chart = normalizeChart(view.displayPreference.chart);
      });
      if (parsed.candidateConsumptionValidation) {
        const activeRun = parsed.candidateConsumptionValidation.activeRun;
        if (parsed.candidateConsumptionValidation.status === "处理中" || activeRun?.status === "处理中") {
          const recovered = activeRun ? {
            ...activeRun,
            status: "未通过",
            overall: "已中断",
            endedAt: nowText(),
            questions: [],
            reason: "上次候选验证在页面关闭或重新加载前未完成，未形成可提交证据。",
            evidenceBundle: null,
            evidenceIds: []
          } : null;
          parsed.candidateConsumptionValidation = {
            ...parsed.candidateConsumptionValidation,
            status: "未通过",
            activeRun: recovered,
            attempts: recovered
              ? [recovered, ...(parsed.candidateConsumptionValidation.attempts || []).filter((item) => item?.id !== recovered.id)]
              : parsed.candidateConsumptionValidation.attempts || []
          };
        }
        parsed.candidateConsumptionValidation.activeRun = recoverInterruptedDelivery(parsed.candidateConsumptionValidation.activeRun);
        parsed.candidateConsumptionValidation.attempts = (parsed.candidateConsumptionValidation.attempts || []).map(recoverInterruptedDelivery);
      }
      if (parsed.recommendations?.status === "生成中") {
        parsed.recommendations = {
          ...parsed.recommendations,
          status: "失败",
          error: "上次推荐生成在页面关闭或重新加载前未完成，请重新生成"
        };
      }
      if (parsed.candidateConfig?.status === "验证中" || parsed.candidateConfig?.validation?.status === "验证中") {
        parsed.candidateConfig = {
          ...parsed.candidateConfig,
          status: "验证失败",
          compatibility: "需重验",
          validation: {
            ...parsed.candidateConfig.validation,
            status: "验证失败",
            overall: "失败",
            endedAt: nowText(),
            tests: [{ name: "配置验证", status: "失败", reason: "上次验证在页面关闭或重新加载前未完成，请重新验证。" }]
          }
        };
      }
      parsed.pins = (parsed.pins || []).filter((pin) => !/已接收/.test(String(pin?.status || "")) || Boolean(pin?.ownerReceipt));
      return { ...createInitialState(), ...parsed };
    } catch (_) {
      return createInitialState();
    }
  }

  function saveState(storageKey, state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(stateForPersistence(state)));
    } catch (error) {
      console.error("智能问数状态保存失败", error);
    }
  }

  function readScenarioResetRequest() {
    const stored = readStoredJson(SCENARIO_RESET_REQUEST_KEY, "场景定向重置请求");
    if (!stored.ok) return null;
    const request = stored.value;
    const scenario = request?.scenarioContext;
    if (request?.operation !== "resetScenarioProjection" || !request?.requestId || !scenario?.scenarioId || !scenario?.scenarioVersion || !scenario?.scenarioRunId) return null;
    return request;
  }

  function invalidateActionRequestInbox(scenarioContext, resetRequest, invalidatedAt) {
    if (!scenarioContext?.id || !scenarioContext?.version || !scenarioContext?.runId) return false;
    const envelope = {
      contractCode: "C011",
      sourceModule: "智能问数",
      status: "reset",
      scenarioContext: {
        scenarioId: scenarioContext.id,
        scenarioVersion: scenarioContext.version,
        scenarioRunId: scenarioContext.runId,
        formedAt: scenarioContext.formedAt || invalidatedAt,
        status: "reset",
        source: scenarioContext.source || "C008 权威投影"
      },
      formedAt: invalidatedAt,
      resetRequestId: resetRequest?.requestId || `IQ-RESET-${scenarioContext.runId}`,
      requests: []
    };
    localStorage.setItem(C011_INBOX_STORAGE_KEY, JSON.stringify(envelope));
    return true;
  }

  function resetState(storageKey, currentState = null, resetRequest = null) {
    const previous = currentState || (() => {
      try { return JSON.parse(localStorage.getItem(storageKey)); } catch (_) { return null; }
    })();
    const next = createInitialState();
    const currentScenario = previous?.scenarioContext || null;
    const resetAt = nowText();
    const archivedLiveRuns = (previous?.liveRuns || []).map((run) => run?.status === "处理中" ? {
      ...run,
      status: "已废弃",
      completedAt: resetAt,
      failure: "当前工作轮次已重置，未完成运行不再允许形成正式结果。",
      recovery: "等待上游形成新的场景运行轮次，并基于新的完整上下文重新运行。",
      retryable: true,
      past: true,
      currentProjection: false
    } : { ...run, past: true, currentProjection: false });
    const historicalRuns = [
      ...(previous?.historyRuns || []),
      ...archivedLiveRuns
    ];
    next.historyRuns = historicalRuns;
    next.historicalActionRequests = [
      ...(previous?.historicalActionRequests || []),
      ...(previous?.actionRequests || []).map((request) => ({ ...request, historical: true }))
    ];
    next.handledScenarioResetRequestIds = [...new Set([
      ...(previous?.handledScenarioResetRequestIds || []),
      resetRequest?.requestId
    ].filter(Boolean))].slice(-20);
    next.resetHistory = [
      {
        resetAt,
        scenarioId: currentScenario?.id || null,
        scenarioVersion: currentScenario?.version || null,
        previousScenarioRunId: currentScenario?.runId || null,
        nextScenarioRunId: next.scenarioContext?.runId || null,
        status: next.scenarioContext?.runId && next.scenarioContext.runId !== currentScenario?.runId ? "已形成新轮次" : "等待上游新轮次",
        preservedRunIds: historicalRuns.map((run) => run.id).filter(Boolean)
      },
      ...(previous?.resetHistory || [])
    ];
    next.awaitingScenarioRunAfter = currentScenario?.runId ? {
      scenarioId: currentScenario.id || null,
      scenarioVersion: currentScenario.version || null,
      scenarioRunId: currentScenario.runId,
      resetAt
    } : null;
    next.scenarioContext = {
      id: currentScenario?.id || next.scenarioContext?.id || "S001",
      name: currentScenario?.name || next.scenarioContext?.name || "集团融资成本与债务结构优化",
      version: currentScenario?.version || next.scenarioContext?.version || null,
      runId: null,
      formedAt: null,
      source: "C008 权威投影",
      status: "等待上游新轮次",
      awaitingNewRun: true,
      previousRunId: currentScenario?.runId || null
    };
    invalidateActionRequestInbox(currentScenario, resetRequest, resetAt);
    localStorage.setItem(storageKey, JSON.stringify(next));
    return next;
  }

  function allPublishedResources(version) {
    if (!version) return [];
    return [
      ...(Array.isArray(version.objects) ? version.objects : []).map((item) => ({ ...item, type: "Object Type" })),
      ...(Array.isArray(version.properties) ? version.properties : []).map((item) => ({ ...item, type: "Property" })),
      ...(Array.isArray(version.links) ? version.links : []).map((item) => ({ ...item, type: "Link Type" })),
      ...(Array.isArray(version.metrics) ? version.metrics : []).map((item) => ({ ...item, type: "Metric" })),
      ...(Array.isArray(version.rules) ? version.rules : []).map((item) => ({ ...item, type: "Rule" })),
      ...(Array.isArray(version.actions) ? version.actions : []).map((item) => ({ ...item, type: "Action Type" }))
    ];
  }

  function collectionValues(value) {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).map(([key, item]) => {
      if (item && typeof item === "object" && !Array.isArray(item)) return item.id || item.stableId ? item : { ...item, id: key };
      return { id: key, value: item };
    });
  }

  function projectEndpointContract(contract) {
    if (!contract || typeof contract !== "object") return null;
    const members = collectionValues(contract.members).map((member) => ({
      id: member.id || member.stableId || null,
      objectId: member.objectId || null,
      name: member.name || null,
      grain: member.grain || null,
      fieldCount: collectionValues(member.fields || member.fieldIds).length
    })).filter((member) => member.id);
    const relationships = collectionValues(contract.relationships || contract.relations).map((relationship) => ({
      id: relationship.id || relationship.stableId || null,
      name: relationship.name || null,
      linkId: relationship.linkId || null,
      sourceMemberId: relationship.sourceMemberId || relationship.sourceMember?.id || relationship.source?.memberId || null,
      targetMemberId: relationship.targetMemberId || relationship.targetMember?.id || relationship.target?.memberId || null,
      sourceObjectId: relationship.sourceObjectId || relationship.source?.objectId || null,
      targetObjectId: relationship.targetObjectId || relationship.target?.objectId || null,
      cardinality: relationship.cardinality || null
    })).filter((relationship) => relationship.id);
    return { members, relationships };
  }

  function endpointContractFingerprint(contract) {
    return contract && typeof contract === "object" ? `EP-${stableDigest(contract)}` : null;
  }

  function normalizedResourceContract(resource) {
    if (!resource) return null;
    const listOrNull = (value) => Array.isArray(value) ? clone(value) : null;
    return {
      id: resource.id,
      type: resource.type,
      name: resource.name || null,
      definition: resource.definition || null,
      memberId: resource.memberId || null,
      parentId: resource.parentId || null,
      objectId: resource.objectId || null,
      sourceObjectId: resource.sourceObjectId || null,
      subjectObjectId: resource.subjectObjectId || null,
      targetObjectId: resource.targetObjectId || null,
      source: resource.source || null,
      target: resource.target || null,
      sourceEndpointKind: resource.sourceEndpoint?.kind || null,
      sourceEndpointId: resource.sourceEndpoint?.id || null,
      sourceEndpointMemberId: resource.sourceEndpoint?.memberId || null,
      targetEndpointKind: resource.targetEndpoint?.kind || null,
      targetEndpointId: resource.targetEndpoint?.id || null,
      targetEndpointMemberId: resource.targetEndpoint?.memberId || null,
      endpointCompatible: typeof resource.endpointCompatible === "boolean" ? resource.endpointCompatible : null,
      allowedDirection: resource.allowedDirection || null,
      cardinality: resource.cardinality || null,
      reverseName: resource.reverseName || null,
      coverage: resource.coverage || null,
      unit: resource.unit || null,
      dataType: resource.dataType || null,
      nullable: resource.nullable ?? null,
      role: resource.role || null,
      scope: resource.scope || resource.appliesTo || null,
      time: resource.time || resource.timeSemantics || null,
      dependencyIds: listOrNull(resource.dependencyIds),
      metricIds: listOrNull(resource.metricIds),
      ruleIds: listOrNull(resource.ruleIds),
      linkIds: listOrNull(resource.linkIds),
      identity: resource.identity || null,
      title: resource.title || null,
      code: resource.code || null,
      confirmation: resource.confirmation || null,
      requirement: resource.requirement || null,
      businessBasis: resource.businessBasis || null,
      calculation: resource.calculation || null,
      zeroHandling: resource.zeroHandling || null,
      condition: resource.condition || null,
      validity: resource.validity || null,
      testSample: resource.testSample || null,
      bankRanking: resource.bankRanking || null,
      evidence: resource.evidence || null,
      dependency: resource.dependency || null,
      conclusion: resource.conclusion || null,
      decisionRefs: listOrNull(resource.decisionRefs),
      parameters: resource.parameters || null,
      inputs: resource.inputs || null,
      prerequisite: resource.prerequisite || null,
      result: resource.result || null,
      failure: resource.failure || null,
      defaultDue: resource.defaultDue || null,
      preferredName: resource.terms?.preferredName || null,
      synonyms: listOrNull(resource.terms?.synonyms)
    };
  }

  function stableDigest(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(7, "0");
  }

  function versionSet(items) {
    return (items || [])
      .map((item) => ({ id: item?.id || null, version: item?.version || null }))
      .filter((item) => item.id && item.version)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  function configContractSnapshot(config, runtimeContext = null) {
    const resourceIds = [...new Set(config?.allowedResources || [])].sort();
    return {
      configId: config?.id || null,
      configVersion: config?.version || null,
      promptVersion: config?.promptVersion || null,
      contentFingerprint: config?.contentFingerprint || null,
      skillVersions: versionSet(config?.skills),
      toolVersions: versionSet(config?.tools),
      resourceWhitelist: {
        version: config?.whitelistVersion || null,
        resourceIds
      },
      publishedOntologyBinding: {
        ontologyStableId: runtimeContext?.ontologyId || ACTIVE_ONTOLOGY_ID,
        semanticVersionId: runtimeContext?.versionId || config?.bindingVersionId || null,
        semanticVersion: runtimeContext?.semanticVersion || config?.semanticVersion || null,
        dataVersion: runtimeContext?.dataVersion || null,
        asOf: runtimeContext?.asOf || null,
        t019EvidenceCode: runtimeContext?.t019EvidenceCode || null,
        resourceContractFingerprint: runtimeContext?.resourceContractFingerprint || config?.resourceContractFingerprint || null
      },
      scenarioContext: {
        scenarioId: runtimeContext?.scenarioId || config?.sceneId || null,
        scenarioVersion: runtimeContext?.scenarioVersion || config?.sceneVersion || null,
        scenarioRunId: runtimeContext?.scenarioRunId || config?.sceneRunId || null,
        formedAt: runtimeContext?.scenarioFormedAt || null,
        status: runtimeContext?.scenarioStatus || runtimeContext?.scenarioReferenceStatus || config?.sceneVersionStatus || null
      },
      effectiveTime: {
        from: config?.effectiveFrom || null,
        to: config?.effectiveTo || null
      }
    };
  }

  function configContractFingerprint(config, runtimeContext = null) {
    return `C009-CFG-${stableDigest(configContractSnapshot(config, runtimeContext))}`;
  }

  function buildC009CompatibilityRecord(config, runtimeContext, checkedAt, evidenceLocator = null) {
    const snapshot = configContractSnapshot(config, runtimeContext);
    const binding = snapshot.publishedOntologyBinding;
    const scenario = snapshot.scenarioContext;
    const complete = Boolean(
      snapshot.configId && snapshot.configVersion && snapshot.promptVersion && snapshot.contentFingerprint &&
      snapshot.skillVersions.length && snapshot.toolVersions.length && snapshot.resourceWhitelist.version && snapshot.resourceWhitelist.resourceIds.length &&
      binding.semanticVersionId && binding.semanticVersion && binding.dataVersion && binding.asOf && binding.t019EvidenceCode && binding.resourceContractFingerprint &&
      scenario.scenarioId && scenario.scenarioVersion && scenario.scenarioRunId && scenario.formedAt && scenario.status &&
      snapshot.effectiveTime.from && checkedAt
    );
    if (!complete) return null;
    const fingerprint = configContractFingerprint(config, runtimeContext);
    return {
      sourceModule: "智能问数",
      contractCode: "C009",
      consumer: "智能问数",
      configId: snapshot.configId,
      configVersion: snapshot.configVersion,
      promptVersion: snapshot.promptVersion,
      skillVersions: clone(snapshot.skillVersions),
      toolVersions: clone(snapshot.toolVersions),
      whitelistVersion: snapshot.resourceWhitelist.version,
      allowedResourceIds: clone(snapshot.resourceWhitelist.resourceIds),
      resourceWhitelist: clone(snapshot.resourceWhitelist),
      publishedOntologyBinding: clone(binding),
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataVersion: binding.dataVersion,
      asOf: binding.asOf,
      t019EvidenceCode: binding.t019EvidenceCode,
      resourceContractFingerprint: binding.resourceContractFingerprint,
      scenarioContext: clone(scenario),
      effectiveFrom: snapshot.effectiveTime.from,
      effectiveTo: snapshot.effectiveTime.to,
      effectiveTime: clone(snapshot.effectiveTime),
      status: "compatible",
      checkedAt,
      reason: null,
      configFingerprint: fingerprint,
      runtimeContextFingerprint: runtimeContext?.runtimeContextFingerprint || runtimeContextFingerprint(runtimeContext),
      evidenceLocator: evidenceLocator || `智能问数/${snapshot.configId}/${fingerprint}`
    };
  }

  function resourceContractFingerprint(resources) {
    const contracts = (resources || []).map(normalizedResourceContract).sort((left, right) => left.id.localeCompare(right.id));
    return `RC-${stableDigest(contracts)}`;
  }

  function projectPublishedResource(resource) {
    if (!resource) return null;
    const listOrNull = (value) => Array.isArray(value) ? clone(value) : null;
    const safeEndpoint = (endpoint, objectId) => endpoint ? {
      id: endpoint.id || null,
      kind: endpoint.kind || null,
      objectId: objectId || null,
      memberId: endpoint.memberId || null,
      propertyId: endpoint.kind === "property" ? endpoint.id || null : null
    } : null;
    const normalizedType = ({ Object: "Object Type", Link: "Link Type", Action: "Action Type" }[resource.type] || resource.type || null);
    return {
      id: resource.id || null, type: normalizedType, name: resource.name || null, definition: resource.definition || null,
      owner: resource.owner || null,
      memberId: resource.memberId || null, parentId: resource.parentId || null, objectId: resource.objectId || null,
      sourceObjectId: resource.sourceObjectId || null, subjectObjectId: resource.subjectObjectId || null,
      targetObjectId: resource.targetObjectId || null, source: resource.source || resource.sourceObjectId || null, target: resource.target || resource.targetObjectId || null,
      sourceEndpoint: safeEndpoint(resource.sourceEndpoint || (resource.sourceEndpointId ? { id: resource.sourceEndpointId, kind: String(resource.sourceEndpointId).startsWith("PROP-") ? "property" : "assetField" } : null), resource.source || resource.sourceObjectId),
      targetEndpoint: safeEndpoint(resource.targetEndpoint || (resource.targetEndpointId ? { id: resource.targetEndpointId, kind: String(resource.targetEndpointId).startsWith("PROP-") ? "property" : "assetField" } : null), resource.target || resource.targetObjectId),
      endpointCompatible: typeof resource.endpointCompatible === "boolean" ? resource.endpointCompatible : Boolean(resource.sourceEndpointId && resource.targetEndpointId),
      allowedDirection: resource.allowedDirection || null, cardinality: resource.cardinality || null,
      reverseName: resource.reverseName || null, coverage: resource.coverage || null,
      identity: resource.identity || null, title: resource.title || null,
      unit: resource.unit || null, dataType: resource.dataType || null, nullable: resource.nullable ?? null, role: resource.role || null,
      scope: resource.scope || resource.appliesTo || null, appliesTo: resource.appliesTo || null,
      time: resource.time || resource.timeSemantics || null,
      dependencyIds: listOrNull(resource.dependencyIds), metricIds: listOrNull(resource.metricIds),
      ruleIds: listOrNull(resource.ruleIds), linkIds: listOrNull(resource.linkIds),
      code: resource.code || null,
      confirmation: resource.confirmation || null,
      requirement: resource.requirement || null,
      businessBasis: resource.businessBasis || null,
      calculation: resource.calculation || null,
      zeroHandling: resource.zeroHandling || null,
      condition: resource.condition || null,
      validity: resource.validity || null,
      testSample: resource.testSample || null,
      bankRanking: resource.bankRanking || null,
      evidence: resource.evidence || null,
      dependency: resource.dependency || null,
      conclusion: resource.conclusion || null,
      decisionRefs: listOrNull(resource.decisionRefs),
      parameters: resource.parameters || null,
      prerequisite: resource.prerequisite || null,
      result: resource.result || null,
      failure: resource.failure || null,
      defaultDue: resource.defaultDue || null,
      lifecycleStatus: resource.lifecycleStatus || null,
      businessValidity: resource.businessValidity || null,
      effectivePeriod: resource.effectivePeriod || null,
      replacementFact: resource.replacementFact || null,
      changeFact: resource.changeFact || null,
      evidenceLocator: resource.evidenceLocator || null,
      publicationState: resource.publicationState || null,
      businessValidityState: resource.businessValidityState || null,
      bindability: resource.bindability || null,
      publishedVersionId: resource.publishedVersionId || null,
      publishedSemanticVersion: resource.publishedSemanticVersion || null,
      applicableScenario: resource.applicableScenario || null,
      terms: resource.terms ? { preferredName: resource.terms.preferredName || null, synonyms: listOrNull(resource.terms.synonyms) } : null
    };
  }

  function legacyProjectionDiagnostics() {
    const present = [];
    const damaged = [];
    LEGACY_ONTOLOGY_STORAGE_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      present.push(key.endsWith("v16") ? "v16" : "v17");
      try {
        const value = JSON.parse(raw);
        if (!isRecord(value)) damaged.push(key.endsWith("v16") ? "v16" : "v17");
      } catch (_) {
        damaged.push(key.endsWith("v16") ? "v16" : "v17");
      }
    });
    const mode = present.length === 2 ? "旧 v16/v17 双键残留" : present.length === 1 ? `旧 ${present[0]} 键残留` : "没有旧键";
    return { present, damaged, mode };
  }

  function normalizeProjectionReadStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    if (["ready", "available", "可用", "可消费"].includes(status)) return "ready";
    if (["empty", "空", "无t019", "尚未形成"].includes(status)) return "empty";
    if (["failed", "failure", "失败", "读取失败"].includes(status)) return "failed";
    if (["unconsumable", "unavailable", "不可消费", "blocked", "阻断"].includes(status)) return "unconsumable";
    if (["unknown", "未知", "无法判断"].includes(status)) return "unknown";
    return "incompatible";
  }

  function projectionFailure(status, reason, recovery, extra = {}) {
    return {
      ok: false,
      status,
      ready: false,
      blocked: true,
      reason,
      recovery,
      projectionKey: C008_PROJECTION_STORAGE_KEY,
      schemaVersion: C008_SCHEMA_VERSION,
      readAt: nowText(),
      ...extra
    };
  }

  function readAuthoritativeProjection() {
    const legacy = legacyProjectionDiagnostics();
    const raw = localStorage.getItem(C008_PROJECTION_STORAGE_KEY);
    if (raw === null) {
      const legacyReason = legacy.present.length
        ? `${legacy.mode}${legacy.damaged.length ? `，其中 ${legacy.damaged.join("/")} 已损坏` : ""}；旧根状态不能迁移为权威消费上下文`
        : "尚未收到本体管理输出的 C008 权威投影包络";
      return projectionFailure(
        legacy.present.length ? "旧状态待迁移" : "权威投影未形成",
        legacyReason,
        "由本体管理重新发布同一共享入口的完整 C008 包络；无 T019 时也必须发布 readStatus=empty，智能问数不会读取旧根状态。",
        { legacy }
      );
    }
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (_) {
      return projectionFailure("权威投影损坏", "C008 共享投影无法解析", "由本体管理重新形成完整包络；不得从旧键或页面显示值恢复。", { legacy });
    }
    if (!isRecord(envelope)) return projectionFailure("结构不兼容", "C008 共享投影不是对象包络", "由本体管理按 schemaVersion=1 重新形成包络。", { legacy });
    if (envelope.projectionId !== C008_PROJECTION_STORAGE_KEY) return projectionFailure("投影身份不一致", "C008 包络 projectionId 不是当前统一共享入口", "由本体管理通过统一共享入口重新形成包络；消费者不会接受私有投影身份。", { legacy, envelope });
    if (envelope.schemaVersion !== C008_SCHEMA_VERSION) return projectionFailure("结构不兼容", `C008 包络 schemaVersion=${String(envelope.schemaVersion ?? "缺失")}，当前消费者只接受 1`, "由本体管理按约定包络重新发布；消费者不会静态适配未知结构。", { legacy });
    if (envelope.contractCode !== "C008" || !["本体管理", "M01"].includes(envelope.sourceModule || envelope.ownerModule || envelope.producerModule)) {
      return projectionFailure("来源不可信", "C008 包络合同或唯一生产者标识不正确", "由本体管理通过共享入口重新形成包络；智能问数不接受其他生产者。", { legacy });
    }
    const scenario = envelope.scenarioContext;
    const scenarioComplete = Boolean(isRecord(scenario) && safeText(scenario.scenarioId) && safeText(scenario.scenarioVersion) && safeText(scenario.scenarioRunId) && safeText(scenario.formedAt) && safeText(scenario.status));
    if (!safeText(envelope.projectionId) || !safeText(envelope.projectionVersion) || !safeText(envelope.formedAt) || !scenarioComplete) {
      return projectionFailure("上下文不完整", "C008 包络缺少投影身份、版本、形成时间或完整 C033 场景轮次", "由本体管理补齐同一包络后重新读取。", { legacy, envelope });
    }
    if (/(?:停用|未知|无效|已结束|inactive|unknown)/i.test(scenario.status)) {
      return projectionFailure("场景不可用", "C008 包络所带 C033 场景运行上下文当前不可用", "由平台公共层形成可用的场景运行上下文，并由本体管理重新形成同轮次 C008 包络。", { legacy, envelope, scenarioContext: clone(scenario) });
    }
    const readStatus = normalizeProjectionReadStatus(envelope.readStatus);
    if (readStatus === "incompatible") return projectionFailure("结构不兼容", "C008 包络 readStatus 缺失或无法识别", "由本体管理明确返回 empty、ready、failed、unconsumable 或 unknown。", { legacy, envelope });
    const base = {
      ok: readStatus === "ready",
      ready: readStatus === "ready",
      readStatus,
      envelope,
      legacy,
      projectionId: envelope.projectionId,
      projectionVersion: envelope.projectionVersion,
      formedAt: envelope.formedAt,
      scenarioContext: clone(scenario),
      previousTrusted: clone(envelope.previousTrustedCombination || envelope.previousTrusted || null),
      candidate: clone(envelope.candidate || null),
      reason: safeText(envelope.reason),
      recovery: safeText(envelope.recoverySuggestion || envelope.recovery),
      readAt: nowText()
    };
    if (readStatus !== "ready") {
      const labels = { empty: "正式消费组合尚未形成", failed: "权威投影读取失败", unconsumable: "当前权威组合不可消费", unknown: "权威状态无法判断" };
      return {
        ...base,
        ok: false,
        blocked: true,
        status: labels[readStatus],
        reason: base.reason || (readStatus === "empty" ? "当前没有 T019" : labels[readStatus]),
        recovery: base.recovery || "由本体管理恢复并重新形成同一 C008 权威投影后重试。"
      };
    }
    const current = envelope.current || {
      ontologyStableId: envelope.ontologyStableId || ACTIVE_ONTOLOGY_ID,
      semanticVersionId: envelope.publishedSemanticVersionId,
      semanticVersion: envelope.publishedSemanticVersion,
      dataVersion: envelope.consumableDataVersion,
      asOf: envelope.dataAsOf,
      switchedAt: envelope.switchedAt,
      t019: envelope.t019 || (envelope.evidenceLocator ? { recordId: null, evidenceId: envelope.evidenceLocator } : null),
      resources: [],
      endpointContract: null,
      endpointContractFingerprint: null,
      resourceContractFingerprint: null
    };
    const t019 = current?.t019;
    const identityComplete = Boolean(
      isRecord(current) && current.ontologyStableId === ACTIVE_ONTOLOGY_ID &&
      safeText(current.semanticVersionId) && safeText(current.semanticVersion) &&
      safeText(current.dataVersion) && safeText(current.asOf) && safeText(current.switchedAt) &&
      isRecord(t019) && safeText(t019.evidenceId)
    );
    if (!identityComplete) return projectionFailure("上下文不完整", "readStatus=available 但精确双版本、T019、数据截至时间或采用证据不完整", "由本体管理修复同一投影，不得由智能问数猜测或补齐。", { legacy, envelope, scenarioContext: clone(scenario) });
    return { ...base, status: "权威投影可用", blocked: false, current: clone(current) };
  }

  function publishedContextRequestId(projection) {
    if (!projection?.ready || !projection.current?.semanticVersionId) return null;
    return `IQ-C004C007-${stableDigest({
      projectionId: projection.projectionId,
      ontologyStableId: projection.current.ontologyStableId,
      semanticVersionId: projection.current.semanticVersionId,
      semanticVersion: projection.current.semanticVersion,
      dataVersion: projection.current.dataVersion,
      asOf: projection.current.asOf,
      t019EvidenceId: projection.current.t019?.evidenceId || null,
      resourceContractFingerprint: projection.current.resourceContractFingerprint || null,
      endpointContractFingerprint: projection.current.endpointContractFingerprint || null,
      scenarioId: projection.scenarioContext?.scenarioId || null,
      scenarioVersion: projection.scenarioContext?.scenarioVersion || null,
      scenarioRunId: projection.scenarioContext?.scenarioRunId || null
    })}`;
  }

  function requestPublishedContext(projection = readAuthoritativeProjection(), force = false) {
    const requestId = publishedContextRequestId(projection);
    if (!requestId) return { requested: false, reason: projection?.reason || "C008 权威组合尚不可读取" };
    const responseStorageKey = `${HANDOFF_CHANNEL}:response:${requestId}`;
    if (!force && localStorage.getItem(responseStorageKey) !== null) return { requested: false, requestId, responseStorageKey, reason: "已有同一精确上下文的只读响应" };
    const request = {
      channel: HANDOFF_CHANNEL,
      targetModule: "本体管理",
      requestId,
      operation: "publishedContext",
      payload: { versionId: projection.current.semanticVersionId },
      scenarioContext: clone(projection.scenarioContext),
      requestedAt: nowText(),
      sourceModule: "智能问数"
    };
    localStorage.setItem(HANDOFF_REQUEST_STORAGE_KEY, JSON.stringify(request));
    return { requested: true, requestId, responseStorageKey };
  }

  function readPublishedContextResponse(projection = readAuthoritativeProjection()) {
    const requestId = publishedContextRequestId(projection);
    if (!requestId) return { ready: false, status: "正式组合未形成", reason: projection?.reason || "无法形成已发布资源读取请求" };
    const responsePrefix = `${HANDOFF_CHANNEL}:response:`;
    const responseCandidates = [];
    const exactStorageKey = `${responsePrefix}${requestId}`;
    const exact = readStoredJson(exactStorageKey, "已发布资源只读响应");
    if (exact.ok) responseCandidates.push({ storageKey: exactStorageKey, response: exact.value, exact: true });
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(responsePrefix) || storageKey === exactStorageKey) continue;
      const stored = readStoredJson(storageKey, "已发布资源只读响应");
      if (stored.ok) responseCandidates.push({ storageKey, response: stored.value, exact: false });
    }
    if (!responseCandidates.length) {
      return { ready: false, status: exact.missing ? "已发布资源待读取" : "已发布资源响应损坏", reason: exact.reason, requestId };
    }
    const evaluated = responseCandidates.map((candidate) => {
      const response = candidate.response;
      const responseRequestId = candidate.storageKey.slice(responsePrefix.length);
      const identityTrusted = Boolean(
        response.channel === HANDOFF_CHANNEL &&
        response.targetModule === "本体管理" &&
        response.operation === "publishedContext" &&
        response.ok === true &&
        responseRequestId.startsWith("IQ-C004C007-") &&
        response.requestId === responseRequestId
      );
      const discovery = response.result?.discovery || null;
      const consumption = response.result?.consumption || null;
      const exactVersion = Boolean(
        discovery?.ontologyStableId === ACTIVE_ONTOLOGY_ID &&
        discovery?.versionId === projection.current.semanticVersionId &&
        discovery?.semanticVersion === projection.current.semanticVersion &&
        discovery?.publicationState === "Published"
      );
      const exactBinding = Boolean(
        consumption?.contractCode === "C008" &&
        consumption?.versionId === projection.current.semanticVersionId &&
        consumption?.semanticVersion === projection.current.semanticVersion &&
        consumption?.binding?.dataVersion === projection.current.dataVersion &&
        consumption?.binding?.asOf === projection.current.asOf &&
        consumption?.consumable === true
      );
      const scenario = projection.scenarioContext;
      const scenarioMatch = Boolean(
        consumption?.binding?.scenarioContext?.scenarioId === scenario.scenarioId &&
        consumption?.binding?.scenarioContext?.scenarioVersion === scenario.scenarioVersion &&
        consumption?.binding?.scenarioContext?.scenarioRunId === scenario.scenarioRunId
      );
      const resources = Array.isArray(discovery?.resources) ? discovery.resources : [];
      return { ...candidate, responseRequestId, identityTrusted, discovery, consumption, exactVersion, exactBinding, scenarioMatch, resources };
    });
    const accepted = evaluated
      .filter((candidate) => candidate.identityTrusted && candidate.exactVersion && candidate.exactBinding && candidate.scenarioMatch && candidate.resources.length)
      .sort((left, right) => Number(right.exact) - Number(left.exact) || String(right.response.respondedAt || "").localeCompare(String(left.response.respondedAt || "")))[0];
    if (accepted) {
      return {
        ready: true,
        status: "已发布资源已定位",
        discovery: clone(accepted.discovery),
        consumption: clone(accepted.consumption),
        resources: clone(accepted.resources),
        requestId: accepted.responseRequestId,
        respondedAt: accepted.response.respondedAt || null
      };
    }
    const rejected = evaluated.find((candidate) => candidate.exact) || evaluated[0];
    return {
      ready: false,
      status: rejected.identityTrusted ? "已发布资源上下文不一致" : "已发布资源响应不可信",
      reason: !rejected.identityTrusted ? rejected.response.error || "响应身份、操作或来源不匹配" : !rejected.exactVersion ? "C004—C007 响应未锁定 C008 中的精确已发布版本" : !rejected.exactBinding ? "资源响应所带消费组合与当前 C008 不一致" : !rejected.scenarioMatch ? "资源响应与 C008 的场景、版本或运行轮次不一致" : "精确已发布版本没有返回可发现资源",
      requestId
    };
  }

  function versionSnapshotFromProjection(projection, publishedContext = readPublishedContextResponse(projection)) {
    const current = projection?.current;
    if (!current || !publishedContext?.ready) return null;
    const version = {
      id: current.semanticVersionId,
      ontologyStableId: current.ontologyStableId,
      semanticVersion: current.semanticVersion,
      dataContract: null,
      objects: [], properties: [], links: [], metrics: [], rules: [], actions: []
    };
    const buckets = { "Object Type": "objects", Object: "objects", Property: "properties", "Link Type": "links", Link: "links", Metric: "metrics", Rule: "rules", "Action Type": "actions", Action: "actions" };
    (publishedContext.resources || []).forEach((item) => {
      const bucket = buckets[item.type];
      if (bucket) version[bucket].push(projectPublishedResource(item));
    });
    return version;
  }

  function rawPublishedVersionForContext(context) {
    if (context?.candidateValidation === true && context?.ready && context?.versionId && Array.isArray(context?.resources) && context.resources.length) {
      const version = {
        id: context.versionId,
        ontologyStableId: context.ontologyStableId || ACTIVE_ONTOLOGY_ID,
        semanticVersion: context.semanticVersion,
        dataContract: null,
        objects: [], properties: [], links: [], metrics: [], rules: [], actions: []
      };
      const buckets = { "Object Type": "objects", Object: "objects", Property: "properties", "Link Type": "links", Link: "links", Metric: "metrics", Rule: "rules", "Action Type": "actions", Action: "actions" };
      context.resources.forEach((item) => {
        const bucket = buckets[item.type];
        if (bucket) version[bucket].push(projectPublishedResource(item));
      });
      return version;
    }
    const projection = readAuthoritativeProjection();
    if (!projection.ready || projection.current.semanticVersionId !== context?.versionId) return null;
    return versionSnapshotFromProjection(projection, readPublishedContextResponse(projection));
  }

  function isLinkDirectionAllowed(linkId, from, to, version = null) {
    const path = `${from || ""}>${to || ""}`;
    const expectedPaths = [...(LINK_DIRECTION_WHITELIST[linkId] || [])].sort();
    if (!from || !to || !expectedPaths.includes(path) || !version) return false;
    const link = (Array.isArray(version.links) ? version.links : []).find((item) => item.id === linkId);
    const canonical = LINK_CANONICAL_ENDPOINTS[linkId];
    if (!link || !canonical || link.endpointCompatible !== true) return false;
    if (!link.sourceEndpoint?.id || !link.targetEndpoint?.id) return false;
    if (link.source !== canonical.from || link.target !== canonical.to) return false;
    if (!endpointBelongsToObject(version, link.sourceEndpoint, link.source) || !endpointBelongsToObject(version, link.targetEndpoint, link.target)) return false;
    const actualPaths = [
      /双向|正向/.test(String(link.allowedDirection || "")) ? `${canonical.from}>${canonical.to}` : null,
      /双向|反向/.test(String(link.allowedDirection || "")) ? `${canonical.to}>${canonical.from}` : null
    ].filter(Boolean).sort();
    return actualPaths.length === expectedPaths.length && actualPaths.every((item, index) => item === expectedPaths[index]);
  }

  function endpointBelongsToObject(version, endpoint, objectId) {
    if (!endpoint?.id || !objectId) return false;
    if (endpoint.objectId && endpoint.objectId !== objectId) return false;
    if (endpoint.kind === "property") return (Array.isArray(version.properties) ? version.properties : []).some((item) => item.id === endpoint.id);
    return endpoint.kind === "assetField";
  }

  function linkDirectionProblems(version) {
    return Object.entries(LINK_DIRECTION_WHITELIST).flatMap(([linkId, allowedPaths]) => {
      const link = (Array.isArray(version?.links) ? version.links : []).find((item) => item.id === linkId);
      const canonical = LINK_CANONICAL_ENDPOINTS[linkId];
      if (!link) return [{ id: linkId, reason: "白名单关系未出现在精确已发布版本中", allowedPaths }];
      if (!canonical || !link.source || !link.target || !link.sourceEndpoint?.id || !link.targetEndpoint?.id || link.endpointCompatible !== true) {
        return [{ id: linkId, reason: "已发布关系的方向或端点不完整", allowedPaths }];
      }
      const forwardPath = `${link.source}>${link.target}`;
      if (link.source !== canonical.from || link.target !== canonical.to || !allowedPaths.includes(forwardPath) || !endpointBelongsToObject(version, link.sourceEndpoint, link.source) || !endpointBelongsToObject(version, link.targetEndpoint, link.target)) {
        return [{ id: linkId, reason: "已发布关系端点与问数方向白名单不一致", allowedPaths, actualPath: forwardPath }];
      }
      const actualPaths = [
        /双向|正向/.test(String(link.allowedDirection || "")) ? `${canonical.from}>${canonical.to}` : null,
        /双向|反向/.test(String(link.allowedDirection || "")) ? `${canonical.to}>${canonical.from}` : null
      ].filter(Boolean).sort();
      const expectedPaths = [...allowedPaths].sort();
      const exactDirectionMatch = actualPaths.length === expectedPaths.length && actualPaths.every((path, index) => path === expectedPaths[index]);
      if (!exactDirectionMatch) return [{ id: linkId, reason: actualPaths.some((path) => !expectedPaths.includes(path)) ? "已发布关系开放了问数白名单之外的导航方向" : "已发布关系的允许方向不足以覆盖当前问数白名单", allowedPaths: expectedPaths, actualPaths, actualDirection: link.allowedDirection }];
      return [];
    });
  }

  function publishedContractProblems(version) {
    const resources = allPublishedResources(version);
    const ids = resources.map((item) => item.id);
    const byId = Object.fromEntries(resources.filter((item) => item.id).map((item) => [item.id, item]));
    const problems = [];
    const requiredCollections = ["objects", "properties", "links", "metrics", "rules", "actions"];
    requiredCollections.forEach((key) => {
      if (!Array.isArray(version?.[key])) problems.push(`精确已发布版本缺少 ${key} 资源快照`);
      else if (!version[key].length) problems.push(`精确已发布版本的 ${key} 资源快照为空`);
    });
    if (ids.some((id) => !id)) problems.push("精确已发布版本存在缺失的稳定资源身份");
    if (new Set(ids).size !== ids.length) problems.push("精确已发布版本存在跨类型重复稳定资源身份");
    RESOURCES.filter((expected) => REQUIRED_QUERY_RESOURCE_IDS.includes(expected.id)).forEach((expected) => {
      const actual = byId[expected.id];
      if (!actual) {
        problems.push(`${expected.id} 未出现在精确已发布版本中`);
        return;
      }
      if (actual.type !== expected.type) problems.push(`${expected.id} 的资源类型已变化`);
      if (actual.publicationState !== "Published") problems.push(`${expected.id} 不是已发布资源`);
      if (!actual.publishedVersionId || actual.publishedVersionId !== version.id || actual.publishedSemanticVersion !== version.semanticVersion) problems.push(`${expected.id} 未锁定当前精确已发布版本`);
      if (/停用|失效|不可用/.test(String(actual.businessValidityState || actual.bindability || ""))) problems.push(`${expected.id} 当前业务有效状态不允许使用`);
      if (actual.owner !== "本体管理") problems.push(`${expected.id} 的定义责任方不是本体管理`);
      if (expected.type === "Link Type" && (!byId[actual.source] || !byId[actual.target] || !endpointBelongsToObject(version, actual.sourceEndpoint, actual.source) || !endpointBelongsToObject(version, actual.targetEndpoint, actual.target))) problems.push(`${expected.id} 的端点对象或稳定端点不可定位`);
      if (expected.type === "Link Type" && (!actual.allowedDirection || !actual.cardinality)) problems.push(`${expected.id} 的允许方向或基数不完整`);
      if (expected.type === "Metric") {
        if (actual.unit !== expected.unit) problems.push(`${expected.id} 的单位与配置期望不一致`);
        if (!actual.scope || !actual.time || !(actual.dependencyIds || []).length || actual.dependencyIds.some((id) => !byId[id])) problems.push(`${expected.id} 的范围、时间语义或已发布依赖不完整`);
      }
      if (expected.type === "Rule" && (!actual.scope || !(actual.dependencyIds || []).length || actual.dependencyIds.some((id) => byId[id]?.type !== "Metric"))) {
        problems.push(`${expected.id} 的适用对象或 Metric 依赖不完整`);
      }
      if (expected.type === "Action Type" && (!actual.scope || !(actual.dependencyIds || []).length || actual.dependencyIds.some((id) => byId[id]?.type !== "Rule"))) {
        problems.push(`${expected.id} 的目标范围或 Rule 依赖不完整`);
      }
    });
    return [...new Set(problems)];
  }

  function readCandidateConsumptionContext() {
    const projection = readAuthoritativeProjection();
    const candidate = projection.envelope?.candidate || projection.candidate || null;
    if (!candidate) return {
      status: projection.ready ? "暂无候选" : projection.status,
      ready: false,
      reason: projection.ready ? "当前 C008 包络没有可供智能问数隔离验证的候选" : projection.reason,
      recovery: projection.ready ? "等待本体管理在同一权威投影中提供候选只读摘要。" : projection.recovery,
      scenarioId: projection.scenarioContext?.scenarioId || null,
      scenarioVersion: projection.scenarioContext?.scenarioVersion || null,
      scenarioRunId: projection.scenarioContext?.scenarioRunId || null,
      scenarioFormedAt: projection.scenarioContext?.formedAt || null,
      scenarioStatus: projection.scenarioContext?.status || null,
      readOnly: true,
      readAt: nowText()
    };
    const resources = Array.isArray(candidate.resources) ? candidate.resources : [];
    const ready = Boolean(
      candidate.ready === true && candidate.validationAdmission === "eligible" &&
      candidate.candidateKey && candidate.semanticVersionId && candidate.semanticVersion &&
      candidate.dataVersion && candidate.asOf && candidate.inputFingerprint &&
      candidate.resourceContractFingerprint && resources.length
    );
    return {
      ...clone(candidate),
      status: candidate.status || candidate.phase || "候选处理中",
      ready,
      reason: candidate.reason || "候选版本未被 T019 采用，不得进入正式回答",
      recovery: candidate.recovery || "等待候选验证完成并由本体管理原子提交 T019；正式问数仍读取 current。",
      dataVersion: candidate.dataVersion || null,
      asOf: candidate.asOf || null,
      phase: candidate.phase || null,
      evidenceId: candidate.evidenceId || null,
      resources: clone(resources),
      scenarioId: projection.scenarioContext?.scenarioId || null,
      scenarioVersion: projection.scenarioContext?.scenarioVersion || null,
      scenarioRunId: projection.scenarioContext?.scenarioRunId || null,
      scenarioFormedAt: projection.scenarioContext?.formedAt || null,
      scenarioStatus: projection.scenarioContext?.status || null,
      readOnly: true,
      readAt: nowText()
    };
  }

  function readPublishedOntologyContext() {
    const projection = readAuthoritativeProjection();
    if (!projection.ready) return {
      status: projection.status,
      ready: false,
      semanticReady: false,
      discoverable: false,
      formalAnswerable: false,
      answerabilityStatus: "正式问数暂不可用",
      answerabilityReason: projection.reason,
      blocked: true,
      reason: projection.reason,
      recovery: projection.recovery,
      ontologyId: ACTIVE_ONTOLOGY_ID,
      versionId: null,
      semanticVersion: null,
      resources: [],
      projectionId: projection.projectionId || null,
      projectionVersion: projection.projectionVersion || null,
      scenarioId: projection.scenarioContext?.scenarioId || null,
      scenarioVersion: projection.scenarioContext?.scenarioVersion || null,
      scenarioRunId: projection.scenarioContext?.scenarioRunId || null,
      legacy: projection.legacy,
      readAt: projection.readAt
    };
    const publishedContext = readPublishedContextResponse(projection);
    if (!publishedContext.ready) return {
      status: publishedContext.status,
      ready: false,
      semanticReady: false,
      discoverable: false,
      formalAnswerable: false,
      answerabilityStatus: "正式问数暂不可用",
      answerabilityReason: publishedContext.reason,
      blocked: true,
      reason: publishedContext.reason,
      recovery: "重新读取本体管理的同版 C004—C007 资源上下文；未取得响应时不得使用内置白名单代替。",
      ontologyId: projection.current.ontologyStableId,
      versionId: null,
      semanticVersion: null,
      dataVersion: null,
      asOf: null,
      resources: [],
      projectionId: projection.projectionId,
      projectionVersion: projection.projectionVersion,
      projectionFormedAt: projection.formedAt,
      scenarioId: projection.scenarioContext.scenarioId,
      scenarioVersion: projection.scenarioContext.scenarioVersion,
      scenarioRunId: projection.scenarioContext.scenarioRunId,
      publishedContextRequestId: publishedContext.requestId,
      readAt: projection.readAt
    };
    const version = versionSnapshotFromProjection(projection, publishedContext);
    const resources = allPublishedResources(version);
    const linkProblems = linkDirectionProblems(version);
    const contractProblems = publishedContractProblems(version);
    const resourceIds = resources.map((item) => item.id).filter(Boolean);
    const duplicateIds = [...new Set(resourceIds.filter((id, index) => resourceIds.indexOf(id) !== index))];
    const missingIds = REQUIRED_QUERY_RESOURCE_IDS.filter((id) => !resourceIds.includes(id));
    const semanticReady = !linkProblems.length && !contractProblems.length && !missingIds.length && !duplicateIds.length;
    return {
      status: semanticReady ? "已发布" : "语义不完整",
      ready: semanticReady,
      semanticReady,
      discoverable: semanticReady,
      formalAnswerable: semanticReady,
      answerabilityStatus: semanticReady ? "正式组合已形成，等待数据可信度与配置核验" : "正式问数暂不可用",
      answerabilityReason: semanticReady ? "" : linkProblems[0]?.reason || contractProblems[0] || "已发布资源包不完整",
      blocked: !semanticReady,
      reason: semanticReady ? "" : linkProblems[0]?.reason || contractProblems[0] || "已发布资源包不完整",
      recovery: semanticReady ? "" : "由本体管理修复同一精确版本的 C004—C007 已发布资源响应；C008 组合身份保持只读。",
      ontologyId: projection.current.ontologyStableId,
      versionId: semanticReady ? projection.current.semanticVersionId : null,
      semanticVersion: semanticReady ? projection.current.semanticVersion : null,
      dataVersion: semanticReady ? projection.current.dataVersion : null,
      asOf: semanticReady ? projection.current.asOf : null,
      resources: semanticReady ? resources.map(projectPublishedResource).filter(Boolean) : [],
      endpointContract: null,
      endpointContractFingerprint: null,
      resourceContractFingerprint: resourceContractFingerprint(resources),
      missingIds, duplicateIds, linkProblems, contractProblems,
      projectionId: projection.projectionId,
      projectionVersion: projection.projectionVersion,
      projectionFormedAt: projection.formedAt,
      scenarioId: projection.scenarioContext.scenarioId,
      scenarioVersion: projection.scenarioContext.scenarioVersion,
      scenarioRunId: projection.scenarioContext.scenarioRunId,
      publishedContextRequestId: publishedContext.requestId,
      publishedContextRespondedAt: publishedContext.respondedAt,
      readAt: projection.readAt
    };
  }

  function readOntologyBindingContext() {
    const projection = readAuthoritativeProjection();
    if (!projection.ready) return {
      status: projection.status,
      ready: false,
      blocked: true,
      reason: projection.reason,
      recovery: projection.recovery,
      ontologyId: ACTIVE_ONTOLOGY_ID,
      versionId: null,
      semanticVersion: null,
      dataVersion: null,
      asOf: null,
      resources: [],
      evidenceComplete: false,
      projectionId: projection.projectionId || null,
      projectionVersion: projection.projectionVersion || null,
      projectionFormedAt: projection.formedAt || null,
      scenarioId: projection.scenarioContext?.scenarioId || null,
      scenarioVersion: projection.scenarioContext?.scenarioVersion || null,
      scenarioRunId: projection.scenarioContext?.scenarioRunId || null,
      legacy: projection.legacy,
      readAt: projection.readAt
    };
    const semantic = readPublishedOntologyContext();
    if (!semantic.ready) return { ...semantic, evidenceComplete: false };
    const current = projection.current;
    const t019 = current.t019;
    return {
      status: "语义与绑定完整",
      ready: true,
      blocked: false,
      ontologyId: current.ontologyStableId,
      versionId: current.semanticVersionId,
      semanticVersion: current.semanticVersion,
      dataVersion: current.dataVersion,
      asOf: current.asOf,
      switchedAt: current.switchedAt,
      t019Ref: `${t019.recordId || "T019"} / ${current.dataVersion}`,
      t019Proof: clone(t019),
      t019EvidenceCode: t019.evidenceId,
      t019RecordId: t019.recordId || null,
      evidenceComplete: true,
      resources: semantic.resources,
      endpointContract: semantic.endpointContract,
      endpointContractFingerprint: semantic.endpointContractFingerprint,
      resourceContractFingerprint: semantic.resourceContractFingerprint,
      previousTrusted: clone(projection.previousTrusted),
      candidate: clone(projection.candidate),
      projectionId: projection.projectionId,
      projectionVersion: projection.projectionVersion,
      projectionFormedAt: projection.formedAt,
      scenarioId: projection.scenarioContext.scenarioId,
      scenarioVersion: projection.scenarioContext.scenarioVersion,
      scenarioRunId: projection.scenarioContext.scenarioRunId,
      scenarioFormedAt: projection.scenarioContext.formedAt,
      scenarioStatus: projection.scenarioContext.status,
      readAt: projection.readAt
    };
  }

  function dataQualification(projection) {
    const raw = `${projection?.dataEligibility || ""} ${projection?.quality?.status || projection?.quality || ""} ${projection?.consumptionStatus || ""}`;
    if (/不合格|未合格|未通过|未就绪|失败|阻断|禁止|不可消费|不允许消费/.test(raw)) return { value: "禁止", allowed: false };
    if (/无法判断|未知/.test(raw)) return { value: "无法判断", allowed: false };
    if (/警告/.test(raw)) return { value: "带警告允许", allowed: true };
    if (/允许|合格|通过/.test(raw) && projection?.allowConsumption === true) return { value: "允许", allowed: true };
    return { value: "无法判断", allowed: false };
  }

  const safeText = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const safeBoolean = (value) => typeof value === "boolean" ? value : null;
  const safeTextList = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
  const isRecord = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const fieldsHaveTypes = (value, textFields = [], booleanFields = []) => !value || (
    isRecord(value) &&
    textFields.every((key) => value[key] === undefined || value[key] === null || typeof value[key] === "string") &&
    booleanFields.every((key) => value[key] === undefined || value[key] === null || typeof value[key] === "boolean")
  );
  const projectQualityWarning = (warning) => {
    if (!warning || typeof warning !== "object" || Array.isArray(warning)) return null;
    const projected = {
      status: safeText(warning.status),
      reason: safeText(warning.reason),
      scopeSummary: safeText(warning.scopeSummary),
      recovery: safeText(warning.recovery),
      evidenceId: safeText(warning.evidenceId)
    };
    return Object.values(projected).some(Boolean) ? projected : null;
  };
  const projectCandidateSummary = (candidate) => candidate && typeof candidate === "object" && !Array.isArray(candidate) ? {
    dataVersion: safeText(candidate.dataVersion),
    asOf: safeText(candidate.asOf),
    status: safeText(candidate.status),
    phase: safeText(candidate.phase),
    reason: safeText(candidate.reason),
    recovery: safeText(candidate.recovery),
    evidenceId: safeText(candidate.evidenceId)
  } : null;
  const projectPreviousTrustedSummary = (previous) => previous && typeof previous === "object" && !Array.isArray(previous) ? {
    dataVersion: safeText(previous.dataVersion),
    asOf: safeText(previous.asOf),
    status: safeText(previous.status),
    consumable: safeBoolean(previous.consumable),
    evidenceId: safeText(previous.evidenceId)
  } : null;
  const projectRefreshSummary = (refresh) => refresh && typeof refresh === "object" && !Array.isArray(refresh) ? {
    requestId: safeText(refresh.requestId),
    resultId: safeText(refresh.resultId),
    status: safeText(refresh.status),
    time: safeText(refresh.time),
    phase: safeText(refresh.phase),
    failureReason: safeText(refresh.failureReason),
    recovery: safeText(refresh.recovery),
    t018Eligibility: safeText(refresh.t018Eligibility),
    evidenceId: safeText(refresh.evidenceId)
  } : null;
  const projectEvidenceCategories = (categories) => {
    if (!categories || typeof categories !== "object" || Array.isArray(categories)) return null;
    return Object.fromEntries(["version", "source", "quality", "members", "relationships", "refresh"].map((key) => [key, categories[key] === true]));
  };

  function readDataTrustContext(expectedContext = null) {
    const dataVersion = expectedContext?.dataVersion || null;
    const expectedScenario = expectedContext ? {
      scenarioId: expectedContext.scenarioId,
      scenarioVersion: expectedContext.scenarioVersion,
      scenarioRunId: expectedContext.scenarioRunId
    } : null;
    const stored = readStoredJson(C017_PROJECTION_STORAGE_KEY, "数据可信度安全投影");
    if (!stored.ok) return { status: stored.missing ? "安全投影尚未形成" : "安全投影不可读取", ready: false, allowConsumption: false, dataEligibility: "无法判断", reason: stored.missing ? "数据工程尚未向智能问数交付可核对的数据可信度受限上下文" : stored.reason, recovery: "前往数据工程核对同一精确数据版本的可信度投影、权限和证据后重试。" };
    if (!dataVersion) return { status: "上下文不完整", ready: false, allowConsumption: false, dataEligibility: "无法判断", reason: "当前正式组合未提供精确数据版本", recovery: "先在本体管理核对当前正式绑定。" };
    const envelope = stored.value;
    if (envelope?.contractCode !== "C017" || envelope?.consumer !== "智能问数" || !["数据工程", "M02"].includes(envelope?.sourceModule || envelope?.producerModule)) return { status: "安全投影不适用", ready: false, allowConsumption: false, dataEligibility: "无法判断", dataVersion, reason: "当前投影不是数据工程面向智能问数形成的 C017 受限上下文", recovery: "由数据工程重新形成面向智能问数的安全投影，不得改读完整数据工程工作区。" };
    const projections = Array.isArray(envelope.projections) ? envelope.projections : [];
    const projection = projections.find((item) => item?.dataVersion === dataVersion && (item?.assetId === ACTIVE_DATA_ASSET_ID || item?.t006Id === ACTIVE_DATA_ASSET_ID)) || null;
    if (!projection) return { status: "版本不匹配", ready: false, allowConsumption: false, dataEligibility: "无法判断", dataVersion, reason: "数据可信度安全投影无法定位当前正式组合所指的精确数据版本", recovery: "核对数据工程安全投影与当前正式绑定，不得改用最新发布版本。" };
    const scenario = projection.scenarioContext || envelope.scenarioContext || null;
    const scenarioComplete = Boolean(isRecord(scenario) && safeText(scenario.scenarioId) && safeText(scenario.scenarioVersion) && safeText(scenario.scenarioRunId) && safeText(scenario.formedAt) && safeText(scenario.status));
    const scenarioMatches = Boolean(
      scenarioComplete && expectedScenario &&
      scenario.scenarioId === expectedScenario.scenarioId &&
      scenario.scenarioVersion === expectedScenario.scenarioVersion &&
      scenario.scenarioRunId === expectedScenario.scenarioRunId
    );
    const quality = isRecord(projection.quality) ? projection.quality : {};
    const freshness = isRecord(projection.freshness) ? projection.freshness : {};
    const evidence = isRecord(projection.evidence) ? projection.evidence : {};
    const versionBindingSummary = isRecord(projection.versionBindingSummary) ? projection.versionBindingSummary : {};
    const currentStateSummary = isRecord(projection.currentStateSummary) ? projection.currentStateSummary : {};
    const t008 = isRecord(projection.t008) ? projection.t008 : {
      value: projection.asOf,
      source: projection.asOfSource,
      precision: projection.asOfPrecision,
      timezone: projection.timezone,
      evidenceId: projection.t008EvidenceId
    };
    const t019Observation = isRecord(projection.t019Observation) ? projection.t019Observation : {};
    const evidenceIds = safeTextList(evidence.ids);
    const evidenceCategories = projectEvidenceCategories(evidence.categories);
    const qualityWarnings = Array.isArray(quality.warnings) ? quality.warnings.map(projectQualityWarning).filter(Boolean) : [];
    const contextId = safeText(projection.contextId);
    const contextVersion = safeText(projection.contextVersion);
    const formedAt = safeText(projection.formedAt);
    const projectedDataVersion = safeText(projection.dataVersion);
    const projectedAsOf = safeText(t008.value);
    const projectedPublishedAt = safeText(projection.publishedAt);
    const consistency = safeText(projection.consistency) || "无法判断";
    const qualityStatus = safeText(quality.status);
    const qualityEvidenceId = safeText(quality.evidenceId);
    const freshnessStatus = safeText(freshness.status);
    const freshnessBasis = safeText(freshness.basis);
    const freshnessEvidenceId = safeText(freshness.evidenceId);
    const t008Source = safeText(t008.source);
    const t008Precision = safeText(t008.precision);
    const t008Timezone = safeText(t008.timezone);
    const t008EvidenceId = safeText(t008.evidenceId);
    const bindingSummaryComplete = Boolean(safeText(versionBindingSummary.id) && safeText(versionBindingSummary.version) && safeText(versionBindingSummary.formedAt));
    const currentSummaryComplete = Boolean(safeText(currentStateSummary.id) && safeText(currentStateSummary.version) && safeText(currentStateSummary.formedAt));
    const t008Complete = Boolean(projectedAsOf && t008Source && t008Precision && t008Timezone && t008EvidenceId);
    const t019Scenario = t019Observation.scenarioContext || scenario;
    const t019ScenarioMatches = Boolean(
      isRecord(t019Scenario) && expectedScenario &&
      t019Scenario.scenarioId === expectedScenario.scenarioId &&
      t019Scenario.scenarioVersion === expectedScenario.scenarioVersion &&
      t019Scenario.scenarioRunId === expectedScenario.scenarioRunId
    );
    const t019Matches = Boolean(
      safeText(t019Observation.evidenceId) && safeText(t019Observation.observedAt) &&
      t019Observation.semanticVersionId === expectedContext?.versionId &&
      t019Observation.semanticVersion === expectedContext?.semanticVersion &&
      t019Observation.dataVersion === expectedContext?.dataVersion &&
      t019Observation.asOf === expectedContext?.asOf &&
      (!expectedContext?.t019EvidenceCode || t019Observation.evidenceId === expectedContext.t019EvidenceCode) &&
      (!expectedContext?.t019RecordId || !t019Observation.recordId || t019Observation.recordId === expectedContext.t019RecordId) &&
      t019ScenarioMatches
    );
    const stableT019Observation = {
      recordId: safeText(t019Observation.recordId),
      evidenceId: safeText(t019Observation.evidenceId),
      semanticVersionId: safeText(t019Observation.semanticVersionId),
      semanticVersion: safeText(t019Observation.semanticVersion),
      dataVersion: safeText(t019Observation.dataVersion),
      asOf: safeText(t019Observation.asOf),
      scenarioId: safeText(t019Scenario?.scenarioId),
      scenarioVersion: safeText(t019Scenario?.scenarioVersion),
      scenarioRunId: safeText(t019Scenario?.scenarioRunId)
    };
    const qualityUnknown = !qualityStatus || /未知|无法判断|未确认/.test(qualityStatus);
    const hardQualityFailure = quality.hardFailure === true || /硬质量失败|质量失败|失败|禁止/.test(`${qualityStatus || ""} ${projection.dataEligibility || ""}`);
    const evidenceCategoriesComplete = Boolean(evidenceCategories && ["version", "source", "quality", "members", "relationships"].every((key) => evidenceCategories[key] === true));
    const shapeValid = Boolean(
      fieldsHaveTypes(projection, ["contextId", "contextVersion", "formedAt", "dataVersion", "assetId", "t006Id", "asOf", "asOfSource", "asOfPrecision", "timezone", "t008EvidenceId", "publishedAt", "lastSuccessfulAt", "consistency", "dataEligibility", "consumptionStatus"], ["allowConsumption"]) &&
      fieldsHaveTypes(projection.quality, ["status", "evidenceId"], ["hardFailure"]) &&
      fieldsHaveTypes(projection.freshness, ["label", "status", "basis", "evidenceId"]) &&
      fieldsHaveTypes(projection.evidence, [], ["complete"]) &&
      fieldsHaveTypes(projection.versionBindingSummary, ["id", "version", "formedAt"]) &&
      fieldsHaveTypes(projection.currentStateSummary, ["id", "version", "formedAt"]) &&
      fieldsHaveTypes(projection.t008, ["value", "source", "precision", "timezone", "evidenceId"]) &&
      fieldsHaveTypes(projection.t019Observation, ["recordId", "evidenceId", "observedAt", "semanticVersionId", "semanticVersion", "dataVersion", "asOf"]) &&
      Array.isArray(evidence.ids) && evidence.ids.every((item) => typeof item === "string" && item.trim()) &&
      (evidence.categories === undefined || (evidenceCategories && Object.keys(evidence.categories).filter((key) => ["version", "source", "quality", "members", "relationships", "refresh"].includes(key)).every((key) => typeof evidence.categories[key] === "boolean"))) &&
      (quality.warnings === undefined || (Array.isArray(quality.warnings) && qualityWarnings.length === quality.warnings.length && quality.warnings.every((item) => fieldsHaveTypes(item, ["status", "reason", "scopeSummary", "recovery", "evidenceId"])))) &&
      fieldsHaveTypes(projection.candidate, ["dataVersion", "asOf", "status", "phase", "reason", "recovery", "evidenceId"]) &&
      fieldsHaveTypes(projection.previousTrusted, ["dataVersion", "asOf", "status", "evidenceId"], ["consumable"]) &&
      fieldsHaveTypes(projection.refresh, ["requestId", "resultId", "status", "time", "phase", "failureReason", "recovery", "t018Eligibility", "evidenceId"])
    );
    const qualification = dataQualification(projection);
    const evidenceComplete = Boolean(shapeValid && contextId && contextVersion && formedAt && evidence.complete === true && evidenceIds.length && evidenceCategoriesComplete && t008EvidenceId && evidenceIds.includes(t008EvidenceId));
    const ready = Boolean(shapeValid && qualification.allowed && projection.allowConsumption === true && !qualityUnknown && !hardQualityFailure && t008Complete && bindingSummaryComplete && currentSummaryComplete && evidenceComplete && consistency === "数据侧一致" && scenarioMatches && t019Matches);
    return {
      status: ready ? (qualification.value === "带警告允许" ? "带警告允许" : "数据可信度完整") : hardQualityFailure || qualification.value === "禁止" ? "不可消费" : qualityUnknown ? "状态无法判断" : "上下文不完整",
      ready, allowConsumption: ready, dataEligibility: qualification.value, dataVersion: projectedDataVersion, asOf: projectedAsOf,
      asOfSource: t008Source, asOfPrecision: t008Precision, timezone: t008Timezone, asOfEvidenceId: t008EvidenceId,
      publishedAt: projectedPublishedAt, lastSuccessfulAt: safeText(projection.lastSuccessfulAt),
      quality: qualityStatus || "无法判断", qualityEvidenceId, hardQualityFailure,
      qualityWarnings,
      freshness: safeText(freshness.label) || freshnessStatus || "无法判断", freshnessStatus: freshnessStatus || "未知",
      freshnessBasis, freshnessEvidenceId,
      candidate: projectCandidateSummary(projection.candidate),
      previousTrusted: projectPreviousTrustedSummary(projection.previousTrusted),
      refresh: projectRefreshSummary(projection.refresh),
      evidenceIds, evidenceCategories, evidenceComplete, consistency,
      versionBindingSummary: clone(versionBindingSummary), currentStateSummary: clone(currentStateSummary),
      t019Observation: clone(t019Observation), t019Matches,
      scenarioContext: clone(scenario), scenarioComplete, scenarioMatches,
      trustFingerprint: JSON.stringify({
        contextId, contextVersion, formedAt,
        versionBindingSummary, currentStateSummary,
        dataVersion: projectedDataVersion, asOf: projectedAsOf, t008Source, t008Precision, t008Timezone, t008EvidenceId, publishedAt: projectedPublishedAt,
        dataQualification: qualification.value, allowConsumption: projection.allowConsumption === true,
        qualityStatus, qualityEvidenceId, hardQualityFailure,
        freshnessStatus, freshnessBasis,
        freshnessEvidenceId, evidenceIds, t019Observation: stableT019Observation,
        scenarioId: scenario?.scenarioId, scenarioVersion: scenario?.scenarioVersion, scenarioRunId: scenario?.scenarioRunId
      }),
      reason: ready ? "" : !scenarioComplete ? "数据可信度投影缺少完整 C033 场景轮次" : !scenarioMatches ? "数据可信度投影与 C008 的场景、版本或轮次不一致" : !shapeValid ? "数据可信度安全投影包含类型不正确或无法安全解释的关键字段" : hardQualityFailure ? "精确数据版本存在数据工程确认的硬质量失败" : qualification.value === "禁止" ? "精确数据版本的数据侧资格禁止消费" : qualityUnknown ? "精确数据版本的质量状态无法判断" : !t008Complete ? "T008 的值、来源、精度、时区说明或证据编号不完整" : !bindingSummaryComplete || !currentSummaryComplete ? "C017 版本绑定摘要或当前状态摘要身份不完整" : !t019Matches ? "C017 对 C008/T019 的只读观察与精确语义、数据版本或场景轮次不一致" : !evidenceComplete ? "数据可信度证据目录不完整或 T008 证据无法定位" : "数据可信度投影的新鲜度或一致性上下文不完整",
      recovery: ready ? "" : "在数据工程补齐同一精确版本的安全投影；不得切换到候选、最新文件或完整工作区状态。",
      readAt: nowText()
    };
  }

  function runtimeContextIdentity(context) {
    if (!context) return null;
    let archived = null;
    const live = typeof context === "object" ? context : null;
    const archivedValue = typeof context === "string" ? context : live?.runtimeContextFingerprint;
    if (typeof archivedValue === "string") {
      try {
        const parsed = JSON.parse(archivedValue);
        if (parsed && typeof parsed === "object") archived = parsed;
      } catch (_) {
        archived = null;
      }
    }
    const value = (key) => live?.[key] ?? archived?.[key] ?? null;
    const endpointContractFingerprint = value("endpointContractFingerprint") || (live ? `EP-${stableDigest(live.endpointContract || null)}` : null);
    return {
      ontologyId: value("ontologyId"),
      versionId: value("versionId"),
      semanticVersion: value("semanticVersion"),
      dataVersion: value("dataVersion"),
      asOf: value("asOf"),
      switchedAt: value("switchedAt"),
      t019RecordId: value("t019RecordId"),
      t019EvidenceCode: value("t019EvidenceCode"),
      candidateValidationEvidenceProjection: value("candidateValidationEvidenceProjection"),
      questionSetVersionProjection: value("questionSetVersionProjection"),
      c029EvidenceCode: value("c029EvidenceCode"),
      t018EvidenceCode: value("t018EvidenceCode"),
      resourceContractFingerprint: value("resourceContractFingerprint"),
      endpointContractFingerprint,
      dataTrustFingerprint: value("dataTrustFingerprint") || live?.dataTrust?.trustFingerprint || null,
      qualityEvidenceId: value("qualityEvidenceId"),
      freshnessStatus: value("freshnessStatus"),
      allowConsumption: value("allowConsumption") === true,
      scenarioId: value("scenarioId"),
      scenarioVersion: value("scenarioVersion"),
      scenarioRunId: value("scenarioRunId"),
      scenarioFormedAt: value("scenarioFormedAt"),
      scenarioStatus: value("scenarioStatus") || value("scenarioReferenceStatus"),
      projectionId: value("projectionId")
    };
  }

  function runtimeContextFingerprint(context) {
    const identity = runtimeContextIdentity(context);
    return identity ? JSON.stringify(identity) : null;
  }

  function runtimeContextMatches(left, right) {
    const leftIdentity = runtimeContextIdentity(left);
    const rightIdentity = runtimeContextIdentity(right);
    const complete = (identity) => Boolean(
      identity?.versionId && identity.semanticVersion && identity.dataVersion && identity.asOf &&
      identity.t019EvidenceCode && identity.resourceContractFingerprint &&
      identity.scenarioId && identity.scenarioVersion && identity.scenarioRunId &&
      identity.scenarioFormedAt && identity.scenarioStatus && identity.projectionId
    );
    return complete(leftIdentity) && complete(rightIdentity) && JSON.stringify(leftIdentity) === JSON.stringify(rightIdentity);
  }

  function projectRuntimeContext(context) {
    if (!context) return null;
    const projection = {
      status: context.status, ready: context.ready === true, blocked: context.blocked === true,
      allowConsumption: context.allowConsumption === true, evidenceComplete: context.evidenceComplete === true,
      ontologyId: context.ontologyId, versionId: context.versionId, semanticVersion: context.semanticVersion,
      dataVersion: context.dataVersion, asOf: context.asOf, switchedAt: context.switchedAt,
      t019Ref: context.t019Ref, t019EvidenceCode: context.t019EvidenceCode, t019RecordId: context.t019RecordId,
      c029EvidenceCode: context.c029EvidenceCode, t018EvidenceCode: context.t018EvidenceCode,
      candidateValidationEvidenceProjection: context.candidateValidationEvidenceProjection, questionSetVersionProjection: context.questionSetVersionProjection,
      resources: clone(context.resources || []), endpointContract: clone(context.endpointContract || null),
      endpointContractFingerprint: context.endpointContractFingerprint || JSON.stringify(context.endpointContract || null),
      resourceContractFingerprint: context.resourceContractFingerprint,
      dataEligibility: context.dataEligibility, dataReason: context.dataReason,
      quality: context.quality, qualityEvidenceId: context.qualityEvidenceId,
      asOfSource: context.asOfSource, asOfPrecision: context.asOfPrecision, timezone: context.timezone, asOfEvidenceId: context.asOfEvidenceId,
      freshness: context.freshness, freshnessStatus: context.freshnessStatus,
      freshnessBasis: context.freshnessBasis, freshnessEvidenceId: context.freshnessEvidenceId,
      candidate: clone(context.candidate || null), previous: clone(context.previous || null), refresh: clone(context.refresh || null),
      evidenceIds: clone(context.evidenceIds || []), evidenceCategories: clone(context.evidenceCategories || null), lastSuccessfulAt: context.lastSuccessfulAt,
      versionBindingSummary: clone(context.versionBindingSummary || null), currentStateSummary: clone(context.currentStateSummary || null), t019Observation: clone(context.t019Observation || null),
      consistencyProof: clone(context.consistencyProof || null), readAt: context.readAt,
      reason: context.reason || "", recovery: context.recovery || "",
      recoveryOwner: context.recoveryOwner || null,
      dataTrustFingerprint: context.dataTrustFingerprint || context.dataTrust?.trustFingerprint || null,
      projectionId: context.projectionId || null,
      projectionVersion: context.projectionVersion || null,
      projectionFormedAt: context.projectionFormedAt || null,
      scenarioId: context.scenarioId || null,
      scenarioVersion: context.scenarioVersion || null,
      scenarioRunId: context.scenarioRunId || null,
      scenarioFormedAt: context.scenarioFormedAt || null,
      scenarioStatus: context.scenarioStatus || context.scenarioReferenceStatus || null,
      scenarioName: context.scenarioName || null,
      scenarioReferenceStatus: context.scenarioReferenceStatus || null
    };
    projection.runtimeContextFingerprint = runtimeContextFingerprint(projection);
    return projection;
  }

  function attachScenarioContext(context, scenarioContext = null, config = null) {
    if (!context) return null;
    const scoped = {
      ...context,
      scenarioId: context.scenarioId || scenarioContext?.id || config?.sceneId || null,
      scenarioVersion: context.scenarioVersion || scenarioContext?.version || config?.sceneVersion || null,
      scenarioRunId: context.scenarioRunId || scenarioContext?.runId || config?.sceneRunId || null,
      scenarioFormedAt: context.scenarioFormedAt || scenarioContext?.formedAt || null,
      scenarioStatus: context.scenarioStatus || scenarioContext?.status || config?.sceneVersionStatus || null,
      scenarioName: scenarioContext?.name || config?.scene || null,
      scenarioReferenceStatus: scenarioContext?.status || config?.sceneVersionStatus || "场景版本待读取"
    };
    if (context.inputFingerprint) scoped.inputFingerprint = `${context.inputFingerprint}|SCENE:${scoped.scenarioId || "missing"}@${scoped.scenarioVersion || "missing"}#${scoped.scenarioRunId || "missing"}`;
    scoped.runtimeContextFingerprint = runtimeContextFingerprint(scoped);
    return scoped;
  }

  function projectRuntimeContextForScenario(context, scenarioContext = null, config = null) {
    const projected = attachScenarioContext(projectRuntimeContext(context), scenarioContext, config);
    if (scenarioContext?.awaitingNewRun === true || scenarioContext?.status === "等待上游新轮次") {
      return {
        ...projected,
        status: "等待上游新轮次",
        ready: false,
        blocked: true,
        allowConsumption: false,
        scenarioId: scenarioContext.id || projected?.scenarioId || null,
        scenarioVersion: scenarioContext.version || projected?.scenarioVersion || null,
        scenarioRunId: null,
        scenarioReferenceStatus: "等待上游新轮次",
        reason: "当前工作轮次已定向重置，原 C033 运行轮次不能继续用于新问数。",
        recovery: "等待上游形成不同的场景运行标识后重新读取 C008、已发布资源和 C017。"
      };
    }
    return projected;
  }

  function readRuntimeContext() {
    const ontologyContext = readOntologyBindingContext();
    if (!ontologyContext.ready) return { ...ontologyContext, ontologyContext, dataTrust: null, allowConsumption: false, evidenceComplete: false, recoveryOwner: "ontology" };
    const dataTrust = readDataTrustContext(ontologyContext);
    const versionsMatch = dataTrust.dataVersion === ontologyContext.dataVersion && dataTrust.asOf === ontologyContext.asOf;
    const evidenceComplete = Boolean(ontologyContext.evidenceComplete && dataTrust.evidenceComplete && versionsMatch && dataTrust.consistency === "数据侧一致");
    const freshnessKnown = Boolean(dataTrust.freshnessStatus && !/未知|无法判断/.test(dataTrust.freshnessStatus) && dataTrust.freshnessBasis && dataTrust.freshnessEvidenceId && dataTrust.lastSuccessfulAt);
    const ready = Boolean(ontologyContext.ready && dataTrust.ready && versionsMatch && evidenceComplete && freshnessKnown);
    return {
      ...ontologyContext,
      status: ready ? (dataTrust.dataEligibility === "带警告允许" ? "带警告可消费" : "可消费") : dataTrust.status === "不可消费" ? "不可消费" : "上下文不完整",
      ready, blocked: !ready, allowConsumption: ready, evidenceComplete,
      dataEligibility: dataTrust.dataEligibility, dataReason: dataTrust.reason,
      quality: dataTrust.quality, qualityEvidenceId: dataTrust.qualityEvidenceId,
      asOfSource: dataTrust.asOfSource, asOfPrecision: dataTrust.asOfPrecision, timezone: dataTrust.timezone, asOfEvidenceId: dataTrust.asOfEvidenceId,
      freshness: dataTrust.freshness, freshnessStatus: dataTrust.freshnessStatus,
      freshnessBasis: dataTrust.freshnessBasis, freshnessEvidenceId: dataTrust.freshnessEvidenceId,
      candidate: dataTrust.candidate, previous: dataTrust.previousTrusted, refresh: dataTrust.refresh,
      evidenceIds: dataTrust.evidenceIds, evidenceCategories: dataTrust.evidenceCategories,
      versionBindingSummary: dataTrust.versionBindingSummary, currentStateSummary: dataTrust.currentStateSummary, t019Observation: dataTrust.t019Observation,
      lastSuccessfulAt: dataTrust.lastSuccessfulAt,
      consistencyProof: { semanticVersion: ontologyContext.semanticVersion, versionId: ontologyContext.versionId, dataVersion: ontologyContext.dataVersion, asOf: ontologyContext.asOf, t019Ref: ontologyContext.t019Ref, ontologyEvidenceComplete: ontologyContext.evidenceComplete, dataEvidenceComplete: dataTrust.evidenceComplete, dataConsistency: dataTrust.consistency, versionsMatch, scenarioMatches: dataTrust.scenarioMatches === true, t019Matches: dataTrust.t019Matches === true, versionBindingSummary: clone(dataTrust.versionBindingSummary || null), currentStateSummary: clone(dataTrust.currentStateSummary || null) },
      dataTrust: clone(dataTrust),
      dataTrustFingerprint: dataTrust.trustFingerprint,
      recoveryOwner: ready ? null : "data",
      reason: ready ? "" : !dataTrust.ready ? dataTrust.reason : !freshnessKnown ? "数据工程尚未提供当前精确版本的新鲜度结论，无法判断是否仍可正式回答" : "本体绑定与数据可信度摘要不是同一个精确版本上下文",
      recovery: ready ? "" : !dataTrust.ready ? dataTrust.recovery : !freshnessKnown ? "在数据工程补齐同一精确数据版本的新鲜度状态与判定依据后重新运行。" : "核对当前正式绑定与同一数据版本的可信度摘要后重新运行。",
      readAt: nowText()
    };
  }

  function readOntologyContext() {
    return readRuntimeContext();
  }

  function deriveConfigRuntimeState(config, runtimeContext = readRuntimeContext(), ontologyContext = readOntologyBindingContext()) {
    runtimeContext = runtimeContext?.runtimeContextFingerprint ? runtimeContext : projectRuntimeContext(runtimeContext);
    if (!config) return { status: "上游未形成", tone: "warning", reason: "尚未形成可核对的问数 Agent 配置" };
    if (config.status !== "已启用") return { status: config.compatibility || "待验证", tone: "neutral", reason: "配置尚未启用" };
    const runtimeProof = runtimeCapabilityProof(config);
    if (!runtimeProof.passed) {
      return { status: "加载待核验", tone: "warning", reason: runtimeProof.issues[0] };
    }
    if (!ontologyContext?.ready) {
      const unavailable = ontologyContext?.status === "不可消费" || ontologyContext?.blocked;
      return {
        status: unavailable ? "当前组合不可消费" : "上游未形成",
        tone: unavailable ? "danger" : "warning",
        reason: ontologyContext?.reason || "当前正式组合尚未形成"
      };
    }
    if (runtimeContext?.status === "不可消费" || runtimeContext?.dataEligibility === "禁止") {
      return { status: "当前组合不可消费", tone: "danger", reason: runtimeContext?.reason || runtimeContext?.dataReason || "当前组合不允许消费" };
    }
    if (!runtimeContext?.ready) {
      return { status: "需重验", tone: "warning", reason: runtimeContext?.reason || "当前运行上下文尚未完整形成" };
    }
    const validation = config.c009Validation;
    const snapshotMatches = Boolean(
      config.compatibility === "兼容" &&
      config.bindingVersionId === ontologyContext.versionId &&
      config.semanticVersion === ontologyContext.semanticVersion &&
      config.resourceContractFingerprint === ontologyContext.resourceContractFingerprint &&
      validation?.owner === "智能问数" && validation.status === "通过" &&
      validation.versionId === runtimeContext.versionId && validation.semanticVersion === runtimeContext.semanticVersion &&
      validation.sceneId === runtimeContext.scenarioId && validation.sceneVersion === runtimeContext.scenarioVersion && validation.sceneRunId === runtimeContext.scenarioRunId &&
      validation.dataVersion === runtimeContext.dataVersion && validation.asOf === runtimeContext.asOf &&
      validation.t019EvidenceCode === runtimeContext.t019EvidenceCode &&
      validation.configFingerprint === configContractFingerprint(config, runtimeContext) &&
      validation.resourceContractFingerprint === runtimeContext.resourceContractFingerprint &&
      runtimeContextMatches(validation.runtimeContextFingerprint, runtimeContext)
    );
    return snapshotMatches
      ? { status: "兼容", tone: "success", reason: "配置验证快照与当前正式组合一致" }
      : { status: "需重验", tone: "warning", reason: "配置验证快照与当前正式组合不一致" };
  }

  function runtimeCapabilityProof(config) {
    const issues = [];
    const observedSkills = new Map((config?.observedSkills || []).map((item) => [item.id, item]));
    const observedTools = new Map((config?.observedTools || []).map((item) => [item.id, item]));
    (config?.skills || []).forEach((required) => {
      const observed = observedSkills.get(required.id);
      if (!observed || observed.status !== "已加载" || observed.version !== required.version) issues.push(`${required.name}：配置已要求，实际加载状态待核验`);
    });
    (config?.tools || []).forEach((required) => {
      const observed = observedTools.get(required.id);
      if (!observed || observed.status !== "可用" || observed.version !== required.version) issues.push(`${required.name}：配置已允许，实际可用状态待核验`);
    });
    if (!config?.loadProof || !config?.lastRuntimeVerificationAt) issues.push("当前没有运行承载返回的加载证明和最近核验时间");
    return { passed: issues.length === 0, issues: [...new Set(issues)] };
  }

  function validateRunContext(ontologyContext, config, template) {
    const issues = [];
    if (!config || config.status !== "已启用") issues.push({ gate: "配置", owner: "智能问数", reason: "问数 Agent 配置未启用", recovery: "前往 Agent 配置。" });
    const missingBaseConfig = !config?.version || !config?.promptVersion || !config?.whitelistVersion;
    const missingReadyBinding = ontologyContext?.ready && (!config?.bindingVersionId || !config?.semanticVersion);
    if (missingBaseConfig || missingReadyBinding) {
      issues.push({ gate: "配置", owner: "智能问数", reason: "问数 Agent 配置快照不完整", recovery: "核对配置版本、系统提示词和资源白名单后重新验证。" });
    }
    const capabilityProof = runtimeCapabilityProof(config);
    if (!capabilityProof.passed) issues.push({ gate: "配置", owner: "智能问数", reason: capabilityProof.issues[0], recovery: "在实际运行承载中核对 Skill 与 Tool 标识、版本和加载证明后重新验证。" });
    if (!ontologyContext?.scenarioId || !ontologyContext?.scenarioVersion || !ontologyContext?.scenarioRunId || config?.sceneId !== ontologyContext?.scenarioId || config?.sceneVersion !== ontologyContext?.scenarioVersion || config?.sceneRunId !== ontologyContext?.scenarioRunId) {
      issues.push({ gate: "场景", owner: "平台场景目录 / 智能问数", reason: "当前运行缺少或错配同一 C033 场景、版本与运行轮次", recovery: "重新读取 C008 中完整的 scenarioId、scenarioVersion、scenarioRunId，并固定到配置和本轮上下文。" });
    }
    if (!ontologyContext?.ready) {
      if (!ontologyContext?.versionId) {
        issues.push({ gate: "已发布语义", owner: "本体管理", reason: ontologyContext?.reason || "当前没有可定位的精确已发布语义版本", recovery: ontologyContext?.recovery || "在本体管理完成校验与发布后重新检查。" });
        issues.push({ gate: "正式消费组合", owner: "本体管理", reason: "当前没有可定位的权威消费绑定", recovery: "已发布版本形成后仍需由本体管理按完整门禁原子提交正式消费绑定；数据侧消费资格不能替代。" });
      } else if (!ontologyContext?.t019EvidenceCode) {
        issues.push({ gate: "正式消费组合", owner: "本体管理", reason: ontologyContext?.reason || "当前权威消费绑定不完整", recovery: ontologyContext?.recovery || "在本体管理核对正式采用记录与候选验证证据后重新检查。" });
      } else {
        issues.push({ gate: "数据可信度", owner: ontologyContext?.recoveryOwner === "data" ? "数据工程" : "本体管理", reason: ontologyContext?.reason || "权威上下文未形成", recovery: ontologyContext?.recovery || "等待上游就绪。" });
      }
    }
    if (template && ontologyContext?.ready) {
      const validation = config.c009Validation;
      const c009Matches = Boolean(
        validation?.owner === "智能问数" && validation.status === "通过" &&
        validation.versionId === ontologyContext.versionId && validation.semanticVersion === ontologyContext.semanticVersion &&
        validation.sceneId === ontologyContext.scenarioId && validation.sceneVersion === ontologyContext.scenarioVersion && validation.sceneRunId === ontologyContext.scenarioRunId &&
        validation.dataVersion === ontologyContext.dataVersion && validation.asOf === ontologyContext.asOf &&
        validation.t019EvidenceCode === ontologyContext.t019EvidenceCode &&
        validation.configFingerprint === configContractFingerprint(config, ontologyContext) &&
        validation.resourceContractFingerprint === ontologyContext.resourceContractFingerprint &&
        runtimeContextMatches(validation.runtimeContextFingerprint, ontologyContext)
      );
      if (config.bindingVersionId !== ontologyContext.versionId || config.semanticVersion !== ontologyContext.semanticVersion || config.compatibility !== "兼容" || !c009Matches) {
        issues.push({ gate: "配置", owner: "智能问数", reason: "已启用配置的本体绑定或消费验证状态与当前精确已发布版本不一致", recovery: "在智能问数重新验证配置与当前正式绑定；不得沿用其他模块的验证投影。" });
      }
      const missing = template.resourceIds.filter((id) => !ontologyContext.resources.some((item) => item.id === id) || !config.allowedResources.includes(id));
      if (missing.length) issues.push({ gate: "资源", owner: "智能问数 / 本体管理", reason: `当前问题缺少 ${missing.length} 项已发布白名单资源`, recovery: "核对本体发布和资源白名单。", ids: missing });
      const version = rawPublishedVersionForContext(ontologyContext);
      const invalidPath = (QUERY_LINK_PATHS[template.id] || []).find((path) => !isLinkDirectionAllowed(path.linkId, path.from, path.to, version));
      if (invalidPath) issues.push({ gate: "资源", owner: "本体管理", reason: "当前问题需要的已发布关系方向或端点不在问数白名单内", recovery: "核对精确关系稳定身份、端点和获准导航方向。", path: invalidPath });
      const contractProblems = publishedContractProblems(version);
      if (contractProblems.length) issues.push({ gate: "资源", owner: "智能问数 / 本体管理", reason: contractProblems[0], recovery: "在智能问数中重新核对当前配置与精确已发布资源。", problems: contractProblems });
    }
    return { passed: issues.length === 0, issues };
  }

  function configCompleteness(config) {
    const required = ["version", "promptVersion", "whitelistVersion", "bindingVersionId", "semanticVersion", "contentFingerprint", "resourceContractFingerprint", "sceneId", "sceneVersion", "sceneRunId"];
    const missing = required.filter((key) => !config?.[key]);
    if (!(config?.skills || []).length || config.skills.some((item) => !item?.id || !item?.version)) missing.push("Skill 版本集合");
    if (!(config?.allowedResources || []).length || new Set(config.allowedResources).size !== config.allowedResources.length) missing.push("资源白名单稳定身份集合");
    const capabilityProof = runtimeCapabilityProof(config);
    if (!capabilityProof.passed) missing.push(...capabilityProof.issues);
    return { complete: missing.length === 0, missing };
  }

  function validateCandidateConfig(candidate, runtimeContext) {
    const completeness = configCompleteness(candidate);
    const issues = [];
    if (!completeness.complete) issues.push(`配置缺少：${completeness.missing.join("、")}`);
    if (!runtimeContext?.ready) issues.push(runtimeContext?.reason || "权威上下文未形成");
    if (runtimeContext?.ready && (candidate?.bindingVersionId !== runtimeContext.versionId || candidate?.semanticVersion !== runtimeContext.semanticVersion)) issues.push("候选绑定与当前精确已发布版本不一致");
    if (runtimeContext?.ready && (candidate?.sceneId !== runtimeContext.scenarioId || candidate?.sceneVersion !== runtimeContext.scenarioVersion || candidate?.sceneRunId !== runtimeContext.scenarioRunId)) issues.push("候选配置与当前 C033 场景轮次不一致");
    const resources = new Set((runtimeContext?.resources || []).map((item) => item.id));
    const missingResources = (candidate?.allowedResources || []).filter((id) => !resources.has(id));
    if (runtimeContext?.ready && missingResources.length) issues.push(`白名单有 ${missingResources.length} 项资源不在当前已发布版本`);
    const version = runtimeContext?.ready ? rawPublishedVersionForContext(runtimeContext) : null;
    const linkProblems = runtimeContext?.ready ? linkDirectionProblems(version) : [];
    if (linkProblems.length) issues.push("已发布关系方向或端点不符合问数白名单");
    const contractProblems = runtimeContext?.ready ? publishedContractProblems(version) : [];
    if (contractProblems.length) issues.push(...contractProblems);
    if (runtimeContext?.ready && candidate?.resourceContractFingerprint !== runtimeContext.resourceContractFingerprint) issues.push("候选保存的已发布资源信息与当前上下文不一致");
    return { passed: issues.length === 0, issues, completeness, missingResources, linkProblems, contractProblems };
  }

  function verifyFixedResult(result, context, config) {
    const issues = [];
    if (!result?.fixedResultId || !Array.isArray(result.rows) || !result.rows.length) issues.push("固定结构化结果不完整");
    const resources = new Map((context?.resources || []).map((item) => [item.id, item]));
    const allowed = new Set(config?.allowedResources || []);
    const resourceIds = Array.isArray(result?.resourceIds) ? result.resourceIds : [];
    const resultResourceIds = new Set(resourceIds);
    if (!resourceIds.length || resultResourceIds.size !== resourceIds.length) issues.push("结果资源范围缺失或存在重复稳定身份");
    resourceIds.forEach((id) => {
      if (!resources.has(id) || !allowed.has(id)) issues.push(`${id} 不在本轮已发布资源包或白名单内`);
    });
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const references = Array.isArray(result?.evidenceReferences) ? result.evidenceReferences : [];
    const rowIds = rows.map((row) => row.id).filter(Boolean);
    if (rowIds.length !== rows.length || new Set(rowIds).size !== rowIds.length) issues.push("结果项身份缺失或重复");
    const rowEvidence = rows.map((row) => ({ ...row, evidenceId: row.evidenceId }));
    const allEvidence = [...rowEvidence, ...references];
    const rowEvidenceIds = rowEvidence.map((item) => item.evidenceId).filter(Boolean);
    const referenceIds = references.map((item) => item.evidenceId).filter(Boolean);
    if (rowEvidenceIds.length !== rowEvidence.length || referenceIds.length !== references.length) issues.push("结果存在缺失的证据编号");
    if (new Set(rowEvidenceIds).size !== rowEvidenceIds.length) issues.push("结果行存在重复证据编号");
    const supplementalIds = references.filter((item) => !rowEvidenceIds.includes(item.evidenceId)).map((item) => item.evidenceId);
    if (new Set(supplementalIds).size !== supplementalIds.length) issues.push("补充证据存在重复证据编号");
    allEvidence.forEach((item) => {
      if (!item.resourceId || !resources.has(item.resourceId) || !allowed.has(item.resourceId)) issues.push(`${item.evidenceId || "未编号证据"} 引用了本轮资源包之外的资源`);
      if (item.resourceId && !resultResourceIds.has(item.resourceId)) issues.push(`${item.evidenceId || item.id || "未编号证据"} 的资源未列入结果资源范围`);
    });
    rows.forEach((row) => {
      if (row.exact === undefined || row.exact === null || row.status === undefined) issues.push(`${row.evidenceId || row.id} 缺少精确值或业务状态`);
    });

    const factByItemId = new Map();
    rows.forEach((row) => factByItemId.set(row.id, row));
    references.forEach((reference) => {
      if (!reference.resultItemId) issues.push(`${reference.evidenceId || "未编号证据"} 缺少固定结果项定位`);
      else if (!factByItemId.has(reference.resultItemId)) factByItemId.set(reference.resultItemId, reference);
    });
    const evidenceIds = new Set([...rowEvidenceIds, ...referenceIds]);
    const factByEvidenceId = new Map();
    allEvidence.forEach((fact) => {
      if (!fact.evidenceId) return;
      const previous = factByEvidenceId.get(fact.evidenceId);
      if (previous && (previous.resourceId !== fact.resourceId || (previous.id || previous.resultItemId) !== (fact.id || fact.resultItemId))) {
        issues.push(`${fact.evidenceId} 被不同结果项或资源重复使用`);
      } else if (!previous) factByEvidenceId.set(fact.evidenceId, fact);
    });
    const declaredEvidenceIds = Array.isArray(result?.evidenceIds) ? result.evidenceIds.filter(Boolean) : [];
    if (declaredEvidenceIds.length !== new Set(declaredEvidenceIds).size) issues.push("结果证据清单存在重复编号");
    if (declaredEvidenceIds.length !== evidenceIds.size || declaredEvidenceIds.some((id) => !evidenceIds.has(id))) issues.push("结果证据清单与固定结果项、补充证据不一致");

    const compactText = (value) => String(value ?? "").replace(/[\s,，]/g, "").trim();
    const formalNumbers = (value) => {
      const sanitized = String(value ?? "")
        .replace(/\b(?:OBJ|PROP|LINK|MET|RULE|ACTION|UNIT|INST|LOAN|OWNER|E|CV|CONFIG)-[A-Za-z0-9_-]+\b/g, "")
        .replace(/\b[A-Za-z][A-Za-z0-9_]*(?:-[A-Za-z0-9_]+)+\b/g, "");
      const matches = sanitized.match(/(?<![A-Za-z0-9])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![A-Za-z0-9])/g) || [];
      return matches.map((token) => {
        const numeric = Number(token.replaceAll(",", ""));
        return Number.isFinite(numeric) ? String(Object.is(numeric, -0) ? 0 : numeric) : null;
      }).filter(Boolean);
    };
    const factScalars = (fact) => [fact?.exact, fact?.value, fact?.object, fact?.label, fact?.status, fact?.unit, fact?.detail, fact?.type].filter((value) => value !== undefined && value !== null && value !== "");
    const factSupportsValue = (fact, value) => {
      if (value === undefined || value === null || value === "") return true;
      const candidate = compactText(value);
      const trusted = [
        ...factScalars(fact).map(compactText),
        compactText(`${fact?.object || ""}${fact?.label || ""}`),
        compactText(`${fact?.label || ""}${fact?.object || ""}`)
      ].filter(Boolean);
      if (trusted.some((item) => item === candidate || (candidate.length >= 2 && item.includes(candidate)))) return true;
      const candidateNumbers = formalNumbers(value);
      const trustedNumbers = new Set(factScalars(fact).flatMap(formalNumbers));
      if (!candidateNumbers.length || candidateNumbers.some((number) => !trustedNumbers.has(number))) return false;
      const unit = compactText(fact?.unit);
      return !unit || !/[^\d.+-]/.test(candidate) || candidate.includes(unit) || candidate === compactText(fact?.exact);
    };
    const stableIdsIn = (value) => String(value ?? "").match(/\b(?:OBJ|PROP|LINK|MET|RULE|ACTION)-[A-Z0-9-]+\b/g) || [];
    const sourceFactFor = (projection) => {
      const itemId = projection?.rowId || projection?.resultItemId || projection?.id;
      return factByItemId.get(itemId) || factByEvidenceId.get(projection?.evidenceId) || null;
    };
    const verifyProjection = (projection, label) => {
      const fact = sourceFactFor(projection);
      if (!fact) {
        issues.push(`${label}未定位到固定结果项或证据`);
        return;
      }
      if (!projection.evidenceId || !evidenceIds.has(projection.evidenceId) || projection.evidenceId !== fact.evidenceId) issues.push(`${label}的证据不属于对应固定结果项`);
      if (!projection.resourceId || projection.resourceId !== fact.resourceId || !resultResourceIds.has(projection.resourceId)) issues.push(`${label}的资源身份不属于对应固定结果项`);
      if (projection.label && !factSupportsValue(fact, projection.label)) issues.push(`${label}的业务标签不来自对应固定结果项`);
      if (!factSupportsValue(fact, projection.exact)) issues.push(`${label}的精确值不来自对应固定结果项`);
      if (!factSupportsValue(fact, projection.value)) issues.push(`${label}的展示值不来自对应固定结果项`);
      if (projection.status && !factSupportsValue(fact, projection.status)) issues.push(`${label}的业务状态不来自对应固定结果项`);
      if (projection.unit && fact.unit && projection.unit !== fact.unit && formalNumbers(projection.unit).some((number) => !new Set(factScalars(fact).flatMap(formalNumbers)).has(number))) issues.push(`${label}的单位或排序位次不来自对应固定结果项`);
      stableIdsIn(JSON.stringify(projection)).forEach((id) => {
        if (!resultResourceIds.has(id)) issues.push(`${label}包含结果资源范围之外的稳定资源身份 ${id}`);
      });
    };

    (result?.highlights || []).forEach((highlight, index) => verifyProjection(highlight, `第 ${index + 1} 项摘要指标`));
    const trustedNumbers = new Set(allEvidence.flatMap((fact) => factScalars(fact).flatMap(formalNumbers)));
    formalNumbers(result?.summary).forEach((number) => {
      if (!trustedNumbers.has(number)) issues.push(`文字摘要出现固定结果之外的正式数值 ${number}`);
    });
    stableIdsIn(result?.summary).forEach((id) => {
      if (!resultResourceIds.has(id)) issues.push(`文字摘要出现结果资源范围之外的稳定资源身份 ${id}`);
    });
    const referencedEvidenceIds = String(result?.summary || "").match(/\b(?:E-[A-Za-z0-9_-]+|[A-Za-z0-9_-]+-E\d+)\b/g) || [];
    referencedEvidenceIds.forEach((id) => {
      if (!evidenceIds.has(id)) issues.push(`文字摘要引用了本轮固定结果之外的证据 ${id}`);
    });
    const summaryEvidenceIds = Array.isArray(result?.summaryEvidenceIds) ? result.summaryEvidenceIds : [];
    if (result?.summary && (!summaryEvidenceIds.length || summaryEvidenceIds.some((id) => !evidenceIds.has(id)))) issues.push("文字摘要的证据清单缺失或引用了本轮之外的证据");
    const ruleRows = rows.filter((row) => resources.get(row.resourceId)?.type === "Rule" && /命中/.test(String(row.status || "")));
    if (/命中/.test(String(result?.summary || ""))) ruleRows.forEach((row) => {
      const ruleName = resources.get(row.resourceId)?.name || row.label;
      if (!String(result.summary).includes(row.object) || !String(result.summary).includes(ruleName)) issues.push(`${row.object} 的 Rule 命中结论未由对应固定结果项支持`);
    });
    const ruleResources = [...resources.values()].filter((resource) => resource.type === "Rule" && resource.name);
    const resultObjects = [...new Set(rows.map((row) => row.object).filter(Boolean))];
    resultObjects.forEach((object) => ruleResources.forEach((rule) => {
      const pair = `${object}命中${rule.name}`;
      if (compactText(result?.summary).includes(compactText(pair)) && !ruleRows.some((row) => row.object === object && row.resourceId === rule.id)) issues.push(`${object} 与${rule.name}的命中组合不在固定结果中`);
    }));

    const projectedChartNumbers = new Set();
    Object.entries(result?.chart?.adapters || {}).forEach(([adapterId, adapter]) => {
      (adapter?.items || []).forEach((item, itemIndex) => {
        verifyProjection(item, `${adapterId} 图表第 ${itemIndex + 1} 项`);
        [item.exact, item.value].forEach((value) => formalNumbers(value).forEach((number) => projectedChartNumbers.add(number)));
        (item.segments || []).forEach((segment, segmentIndex) => {
          verifyProjection(segment, `${adapterId} 图表第 ${itemIndex + 1} 项第 ${segmentIndex + 1} 个分段`);
          [segment.exact, segment.value].forEach((value) => formalNumbers(value).forEach((number) => projectedChartNumbers.add(number)));
        });
      });
    });
    [result?.chart?.values, result?.chart?.stacks].flat(3).filter((value) => typeof value === "number" || /^[-+]?\d/.test(String(value || ""))).forEach((value) => {
      formalNumbers(value).forEach((number) => {
        if (!projectedChartNumbers.has(number)) issues.push(`图表备用数据出现固定图表项之外的正式数值 ${number}`);
      });
    });

    const actionContexts = [result?.actionContext, ...(result?.actionContexts || [])].filter(Boolean);
    const actionTargetIds = actionContexts.map((action) => action.singleTargetStableId).filter(Boolean);
    if (new Set(actionTargetIds).size !== actionTargetIds.length) issues.push("多条行动上下文存在重复的单一业务主体");
    if (result?.id === "rule-explain") {
      const expectedTargets = ["UNIT-553", "UNIT-465", "UNIT-561"];
      if (actionContexts.length !== expectedTargets.length || expectedTargets.some((id) => !actionTargetIds.includes(id))) issues.push("三家单位规则结果必须分别形成三条单一主体行动上下文");
    }
    actionContexts.forEach((action, actionIndex) => {
      const actionLabel = actionContexts.length > 1 ? `第 ${actionIndex + 1} 条行动上下文` : "行动上下文";
      const actionResourceIds = [action.actionTypeId, ...(action.ruleMetricResourceIds || [])].filter(Boolean);
      actionResourceIds.forEach((id) => {
        if (!resultResourceIds.has(id) || !resources.has(id) || !allowed.has(id)) issues.push(`${actionLabel}引用了结果资源范围之外的资源 ${id}`);
      });
      stableIdsIn(JSON.stringify(action)).forEach((id) => {
        if (!resultResourceIds.has(id)) issues.push(`${actionLabel}出现结果资源范围之外的稳定资源身份 ${id}`);
      });
      formalNumbers(JSON.stringify(action)).forEach((number) => {
        if (!trustedNumbers.has(number)) issues.push(`${actionLabel}出现固定结果之外的正式数值 ${number}`);
      });
      const trustedBusinessIdentities = new Set([
        ...allEvidence.flatMap((fact) => factScalars(fact).flatMap((value) => String(value).match(/\b(?:UNIT|INST|LOAN|OWNER)-[A-Za-z0-9-]+\b/g) || [])),
        ...allEvidence.map((fact) => String(fact.object || "").match(/^单位\s*(\d+)$/)?.[1]).filter(Boolean).map((code) => `UNIT-${code}`)
      ]);
      const actionBusinessIdentities = JSON.stringify(action).match(/\b(?:UNIT|INST|LOAN|OWNER)-[A-Za-z0-9-]+\b/g) || [];
      actionBusinessIdentities.forEach((id) => {
        if (!trustedBusinessIdentities.has(id)) issues.push(`${actionLabel}出现固定结果之外的业务对象身份 ${id}`);
      });
      const actionEvidenceIds = [action.targetEvidenceId, action.ruleEvidenceId, ...(action.institutionEvidenceIds || []), ...(action.loanEvidenceIds || []), action.ownerEvidenceId].filter(Boolean);
      if (actionEvidenceIds.some((id) => !evidenceIds.has(id))) issues.push(`${actionLabel}引用了本轮固定结果之外的证据`);
      const targetFact = factByItemId.get(action.targetResultItemId);
      const targetLabel = action.singleTargetStableId ? `单位${action.singleTargetStableId.replace(/^UNIT-/, "")}` : null;
      if (!action.singleTargetStableId || !targetLabel || !result.scope?.includes(targetLabel) || action.targetLabel && action.targetLabel !== targetLabel) issues.push(`${actionLabel}的单一业务主体不属于本轮固定对象范围`);
      const actionType = resources.get(action.actionTypeId);
      if (actionType?.type !== "Action Type") issues.push(`${actionLabel}未引用当前已发布 Action Type`);
      if (action.sourceKind === "rule") {
        const ruleId = (action.ruleMetricResourceIds || []).find((id) => resources.get(id)?.type === "Rule") || null;
        const metricIds = (action.ruleMetricResourceIds || []).filter((id) => resources.get(id)?.type === "Metric");
        const ruleFact = factByItemId.get(action.ruleResultItemId);
        if (!ruleId || metricIds.length !== 1) issues.push(`${actionLabel}必须引用一个 Rule 和一个 Metric`);
        if (!ruleFact || ruleFact !== targetFact || ruleFact.resourceId !== ruleId || ruleFact.object !== targetLabel || !/命中/.test(String(ruleFact.status || "")) || ruleFact.evidenceId !== action.ruleEvidenceId || action.targetEvidenceId !== action.ruleEvidenceId) issues.push(`${actionLabel}的目标、Rule 命中和逐项证据绑定不一致`);
        return;
      }
      if (!targetFact || targetFact.resourceId !== "OBJ-FINANCING-ENTITY" || targetFact.exact !== action.singleTargetStableId || targetFact.evidenceId !== action.targetEvidenceId) issues.push(`${actionLabel}的目标稳定身份未绑定本轮固定对象结果与证据`);
      const bindings = Array.isArray(action.institutionBindings) ? action.institutionBindings : [];
      const boundInstitutionIds = bindings.map((binding) => binding.institutionStableId);
      const boundInstitutionEvidenceIds = bindings.map((binding) => binding.institutionEvidenceId);
      const boundLoanIds = bindings.flatMap((binding) => binding.loanStableIds || []);
      const boundLoanEvidenceIds = bindings.map((binding) => binding.loanEvidenceId);
      if (!bindings.length || new Set(boundInstitutionIds).size !== bindings.length || new Set(boundLoanIds).size !== boundLoanIds.length) issues.push(`${actionLabel}的机构与借据显式绑定缺失或重复`);
      if (JSON.stringify(boundInstitutionIds) !== JSON.stringify(action.institutionStableIds || []) || JSON.stringify(boundInstitutionEvidenceIds) !== JSON.stringify(action.institutionEvidenceIds || []) || JSON.stringify(boundLoanIds) !== JSON.stringify(action.loanStableIds || []) || JSON.stringify(boundLoanEvidenceIds) !== JSON.stringify(action.loanEvidenceIds || [])) issues.push(`${actionLabel}的汇总身份或证据清单与逐机构绑定不一致`);
      bindings.forEach((binding) => {
        const institutionFact = factByItemId.get(binding.institutionResultItemId);
        const loanFact = factByItemId.get(binding.loanResultItemId);
        if (!institutionFact || institutionFact.resourceId !== "LINK-FINANCING-INSTITUTION" || institutionFact.evidenceId !== binding.institutionEvidenceId || !factSupportsValue(institutionFact, binding.institutionStableId)) issues.push(`${binding.institutionStableId || "未标识机构"}未绑定对应机构结果与证据`);
        if (!loanFact || loanFact.resourceId !== "OBJ-FINANCING-DETAIL" || loanFact.evidenceId !== binding.loanEvidenceId || loanFact.object !== institutionFact?.object) issues.push(`${binding.institutionStableId || "未标识机构"}的借据证据与机构不一致`);
        (binding.loanStableIds || []).forEach((loanId) => {
          if (!factSupportsValue(loanFact, loanId)) issues.push(`${loanId}不属于${binding.institutionStableId || "当前机构"}的借据证据`);
        });
      });
      const owner = action.ownerBinding || null;
      const ownerFact = owner ? factByItemId.get(owner.ownerResultItemId) : null;
      if (!owner || owner.ownerStableId !== action.ownerStableId || owner.ownerEvidenceId !== action.ownerEvidenceId || owner.targetStableId !== action.singleTargetStableId || owner.relationResourceId !== "LINK-ENTITY-OWNER" || !ownerFact || ownerFact.resourceId !== owner.relationResourceId || ownerFact.evidenceId !== owner.ownerEvidenceId || ownerFact.object !== targetLabel || !factSupportsValue(ownerFact, owner.ownerStableId)) issues.push(`${actionLabel}的主体、负责人和关系证据绑定不一致`);
    });
    const identity = result?.contextIdentity || {};
    if (identity.versionId !== context?.versionId || identity.semanticVersion !== context?.semanticVersion || identity.dataVersion !== context?.dataVersion || identity.asOf !== context?.asOf || identity.scenarioId !== context?.scenarioId || identity.scenarioVersion !== context?.scenarioVersion || identity.scenarioRunId !== context?.scenarioRunId) issues.push("结果身份与本轮固定上下文不一致");
    return { passed: issues.length === 0, issues: [...new Set(issues)] };
  }

  function validateFixedQuestionSet(config, context) {
    const structural = validateCandidateConfig(config, context);
    if (!structural.passed) return { passed: false, issues: structural.issues, questions: [] };
    const questions = RECOMMENDED_QUESTIONS.map((question, index) => {
      const runId = `CONFIG-CHECK-${String(index + 1).padStart(2, "0")}`;
      const templateId = question.templateId || question.id;
      const template = RESULT_TEMPLATES[templateId];
      const gate = validateRunContext(context, { ...config, status: "已启用", compatibility: "兼容", c009Validation: {
        owner: "智能问数", status: "通过", sceneId: context.scenarioId, sceneVersion: context.scenarioVersion, sceneRunId: context.scenarioRunId, versionId: context.versionId, semanticVersion: context.semanticVersion,
        dataVersion: context.dataVersion, asOf: context.asOf, t019EvidenceCode: context.t019EvidenceCode,
        configFingerprint: configContractFingerprint(config, context), resourceContractFingerprint: context.resourceContractFingerprint,
        runtimeContextFingerprint: context.runtimeContextFingerprint
      } }, template);
      const result = gate.passed ? materializeResult(templateId, context, runId, { unitCodes: referencedUnitCodes(question.question), originalQuestion: question.question }) : null;
      const output = result ? verifyFixedResult(result, context, config) : { passed: false, issues: gate.issues.map((item) => item.reason) };
      return {
        id: question.id,
        question: question.question,
        status: output.passed ? "通过" : "失败",
        resourceIds: clone(result?.resourceIds || []),
        evidenceIds: clone(result?.evidenceIds || []),
        resultId: result?.fixedResultId || null,
        contextIdentity: clone(result?.contextIdentity || null),
        reason: output.issues[0] || ""
      };
    });
    const issues = questions.filter((item) => item.status !== "通过").map((item) => `${item.question}：${item.reason}`);
    return { passed: issues.length === 0, issues, questions };
  }

  function isConfigCompatible(config, runtimeContext) {
    const check = validateCandidateConfig(config, runtimeContext);
    return { compatible: Boolean(check.passed && config?.compatibility === "兼容"), ...check };
  }

  function matchApplicableAgents(question, configs, runtimeContext, template) {
    const requiredResources = [...new Set(template?.resourceIds || [])];
    return (configs || []).map((config) => {
      const enabled = config?.status === "已启用";
      const sceneApplicable = /融资/.test(String(config?.scene || "")) && Boolean(template);
      const allowedResources = new Set(config?.allowedResources || []);
      const missingResources = requiredResources.filter((id) => !allowedResources.has(id));
      const applicable = Boolean(enabled && sceneApplicable && !missingResources.length);
      const reason = !enabled
        ? "配置未启用"
        : !sceneApplicable
          ? "配置场景或问题类型不适用"
          : missingResources.length
            ? `配置白名单缺少 ${missingResources.length} 项当前问题所需资源`
            : "场景、问题类型与资源白名单适用";
      return { config, applicable, reason, missingResources };
    }).filter((item) => item.applicable);
  }

  function recommendationEligibility(question, config, runtimeContext = projectRuntimeContext(readRuntimeContext())) {
    const item = typeof question === "string" ? RECOMMENDED_QUESTIONS.find((candidate) => candidate.id === question) : question;
    const template = item ? RESULT_TEMPLATES[item.templateId || item.id] : null;
    if (!item || !template) return { eligible: false, reason: "推荐问题无法定位固定查询定义", gate: null };
    const gate = validateRunContext(runtimeContext, config, template);
    return {
      eligible: gate.passed,
      reason: gate.passed ? "当前正式运行上下文、配置与问题资源均已通过门禁" : gate.issues[0]?.reason || "当前问题不可正式回答",
      gate
    };
  }

  function recommendableQuestions(config, runtimeContext = projectRuntimeContext(readRuntimeContext())) {
    return RECOMMENDED_QUESTIONS.map((question) => ({
      ...clone(question),
      eligibility: recommendationEligibility(question, config, runtimeContext)
    })).filter((question) => question.eligibility.eligible);
  }

  function normalizeRunEvidenceId(runId, resultId, sequence) {
    const prefix = String(runId || resultId || "RUN").replace(/[^A-Za-z0-9_-]+/g, "-");
    return `${prefix}-E${String(sequence).padStart(2, "0")}`;
  }

  function materializationIssues(templateId, context) {
    const template = RESULT_TEMPLATES[templateId];
    const issues = [];
    if (!template) issues.push("固定查询定义不可定位");
    if (!context?.ready) issues.push(context?.reason || "候选上下文未就绪");
    if (context?.past) issues.push("历史上下文不能用于候选验证");
    if (!context?.versionId || !context?.semanticVersion || !context?.dataVersion || !context?.asOf || !context?.evidenceComplete) issues.push("候选精确双版本、数据截至时间或证据状态不完整");
    if (template) {
      const currentResourceIds = new Set((context?.resources || []).map((item) => item.id));
      const missing = template.resourceIds.filter((id) => !currentResourceIds.has(id));
      if (missing.length) {
        const missingKinds = new Set(missing.map((id) => id.split("-")[0]));
        const availableComparable = (context?.resources || []).filter((item) => missingKinds.has(String(item.id || "").split("-")[0])).map((item) => item.id).filter(Boolean);
        issues.push(`候选已发布资源包缺少 ${missing.join("、")}${availableComparable.length ? `；当前同类资源为 ${availableComparable.join("、")}` : ""}`);
      }
      const version = rawPublishedVersionForContext(context);
      if (!version) issues.push("无法从候选只读资源包重建精确已发布版本");
      else {
        const invalidPath = (QUERY_LINK_PATHS[templateId] || []).find((path) => !isLinkDirectionAllowed(path.linkId, path.from, path.to, version));
        if (invalidPath) issues.push(`候选关系 ${invalidPath.linkId} 的端点或导航方向不符合固定查询白名单`);
      }
    }
    return issues.length ? issues : ["未形成可核验的候选固定结构化结果"];
  }

  function materializeResult(templateId, context, runId = null, queryContext = null) {
    const unitCodes = queryContext?.unitCodes || [];
    const template = templateId === "unit-cost" && unitCodes.length === 1
      ? unitCostResultFor(unitCodes[0])
      : templateId === "pair-cost" && unitCodes.length === 2
        ? pairCostResultFor(unitCodes)
        : RESULT_TEMPLATES[templateId];
    if (!template || !context?.ready || context?.past) return null;
    if (!context.versionId || !context.semanticVersion || !context.dataVersion || !context.asOf || !context.evidenceComplete) return null;
    const currentResourceIds = new Set((context.resources || []).map((item) => item.id));
    if (template.resourceIds.some((id) => !currentResourceIds.has(id))) return null;
    const version = rawPublishedVersionForContext(context);
    const invalidPath = (QUERY_LINK_PATHS[templateId] || []).find((path) => !isLinkDirectionAllowed(path.linkId, path.from, path.to, version));
    if (invalidPath) return null;

    const fixed = clone(template);
    const publishedById = Object.fromEntries((context.resources || []).map((item) => [item.id, item]));
    const businessBasisConfirmed = (resourceId) => publishedById[resourceId]?.businessBasis !== "recommended";
    fixed.rows = (fixed.rows || []).map((row) => {
      if (businessBasisConfirmed(row.resourceId) && /待确认/.test(String(row.warning || ""))) {
        const next = { ...row };
        delete next.warning;
        return next;
      }
      return row;
    });
    if (templateId === "rule-explain" && ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"].every(businessBasisConfirmed)) {
      fixed.summary = "三家单位的关注点不同：单位553是融资成本偏高，单位465是浮动利率暴露偏高，单位561是短期债务集中。建议分别核对成本、利率结构和期限结构的可调整空间。";
    }
    const evidenceIdByItem = {};
    let evidenceSequence = 0;
    fixed.rows = fixed.rows.map((row) => {
      const evidenceId = normalizeRunEvidenceId(runId, fixed.id, ++evidenceSequence);
      evidenceIdByItem[row.id] = evidenceId;
      return { ...row, evidenceId };
    });
    fixed.evidenceReferences = (fixed.evidenceReferences || []).map((reference) => {
      const itemId = reference.resultItemId;
      const evidenceId = evidenceIdByItem[itemId] || normalizeRunEvidenceId(runId, fixed.id, ++evidenceSequence);
      evidenceIdByItem[itemId] = evidenceId;
      return { ...reference, evidenceId };
    });
    const fixedRowsById = Object.fromEntries(fixed.rows.map((row) => [row.id, row]));
    const fixedReferencesByItemId = Object.fromEntries(fixed.evidenceReferences.map((reference) => [reference.resultItemId, reference]));
    fixed.highlights = (fixed.highlights || []).map((highlight) => {
      const resultItemId = highlight.rowId || highlight.resultItemId || highlight.id;
      const source = fixedRowsById[resultItemId] || fixedReferencesByItemId[resultItemId] || null;
      return {
        ...highlight,
        rowId: resultItemId,
        resourceId: highlight.resourceId || source?.resourceId || null,
        evidenceId: evidenceIdByItem[resultItemId] || null
      };
    });
    Object.values(fixed.chart?.adapters || {}).forEach((adapter) => {
      (adapter.items || []).forEach((item) => {
        item.evidenceId = evidenceIdByItem[item.rowId] || null;
        (item.segments || []).forEach((segment) => {
          segment.evidenceId = evidenceIdByItem[segment.rowId] || null;
        });
      });
    });
    if (fixed.actionContext) {
      remapActionEvidence(fixed.actionContext, evidenceIdByItem);
    }
    if (fixed.actionContexts) {
      fixed.actionContexts.forEach((actionContext) => remapActionEvidence(actionContext, evidenceIdByItem));
    }
    fixed.fixedResultId = `${runId || fixed.id}-RESULT`;
    fixed.contextIdentity = {
      versionId: context.versionId,
      semanticVersion: context.semanticVersion,
      dataVersion: context.dataVersion,
      asOf: context.asOf,
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId
    };
    fixed.evidenceIds = [...new Set([
      ...fixed.rows.map((row) => row.evidenceId),
      ...(fixed.evidenceReferences || []).map((reference) => reference.evidenceId)
    ])];
    fixed.summaryEvidenceIds = clone(fixed.evidenceIds);
    return fixed;
  }

  function validateCandidateFixedQuestionSet(context, runId, options = {}) {
    if (!context?.ready || !context?.inputFingerprint) {
      return { passed: false, issues: [context?.reason || "候选双版本上下文不完整"], questions: [] };
    }
    const fixedContext = {
      ...clone(context),
      ready: true,
      blocked: false,
      allowConsumption: false,
      evidenceComplete: true,
      candidateValidation: true
    };
    const validationConfig = {
      ...clone(options.configSnapshot || ACTIVE_CONFIG),
      status: "已启用",
      compatibility: "隔离验证",
      bindingVersionId: fixedContext.versionId,
      semanticVersion: fixedContext.semanticVersion,
      resourceContractFingerprint: fixedContext.resourceContractFingerprint,
      allowedResources: fixedContext.resources.map((item) => item.id).filter(Boolean)
    };
    const capabilityProof = runtimeCapabilityProof(validationConfig);
    if (!capabilityProof.passed) {
      return {
        passed: false,
        issues: capabilityProof.issues,
        questions: CANDIDATE_VALIDATION_QUESTIONS.map((definition) => ({
          ...clone(definition),
          status: "阻断",
          completedAt: nowText(),
          objectScope: [],
          objectIdentities: [],
          resourceIds: clone(RESULT_TEMPLATES[definition.templateId]?.resourceIds || []),
          fixedResultIdentity: null,
          evidenceIds: [],
          evidenceMapping: [],
          responsibility: "智能问数 · 候选固定题验证",
          reason: capabilityProof.issues[0]
        }))
      };
    }
    const forcedStates = options.forcedStates || {};
    const questions = CANDIDATE_VALIDATION_QUESTIONS.map((definition, index) => {
      const questionRunId = `${runId}-${definition.id}`;
      const forcedStatus = forcedStates[definition.id] || null;
      if (forcedStatus) return {
        id: definition.id,
        templateId: definition.templateId,
        question: definition.question,
        expected: definition.expected,
        status: forcedStatus,
        completedAt: nowText(),
        objectScope: [],
        objectIdentities: [],
        resourceIds: clone(RESULT_TEMPLATES[definition.templateId]?.resourceIds || []),
        fixedResultIdentity: null,
        evidenceIds: [],
        evidenceMapping: [],
        responsibility: "智能问数 · 候选固定题验证",
        reason: forcedStatus === "超时" ? "限定时间内未形成完整固定结果与逐项证据" : "候选结果或证据状态无法确定"
      };
      const result = materializeResult(definition.templateId, fixedContext, questionRunId, {
        unitCodes: referencedUnitCodes(definition.question),
        originalQuestion: definition.question
      });
      const verification = result
        ? verifyFixedResult(result, fixedContext, validationConfig)
        : { passed: false, issues: materializationIssues(definition.templateId, fixedContext) };
      const objectIdentities = (result?.scope || []).map((label) => {
        const unit = String(label).match(/单位\s*(553|465|561)/);
        return unit ? `UNIT-${unit[1]}` : `OBJ-FINANCING-ENTITY · ${label}层级`;
      });
      return {
        id: definition.id,
        templateId: definition.templateId,
        question: definition.question,
        expected: definition.expected,
        status: verification.passed ? "通过" : "失败",
        completedAt: nowText(),
        objectScope: clone(result?.scope || []),
        objectIdentities,
        resourceIds: clone(result?.resourceIds || []),
        fixedResultIdentity: result ? {
          runId: questionRunId,
          resultId: result.id,
          fixedResultId: result.fixedResultId,
          contextIdentity: clone(result.contextIdentity)
        } : null,
        evidenceIds: clone(result?.evidenceIds || []),
        evidenceMapping: [
          ...(result?.rows || []).map((row) => ({ resultItemId: row.id, evidenceId: row.evidenceId, resourceId: row.resourceId })),
          ...(result?.evidenceReferences || []).map((item) => ({ resultItemId: item.resultItemId, evidenceId: item.evidenceId, resourceId: item.resourceId }))
        ],
        responsibility: "智能问数 · 候选固定题验证",
        reason: verification.issues[0] || "固定结果、资源范围和证据映射均已核对",
        result: result ? clone(result) : null,
        sequence: index + 1
      };
    });
    const issues = questions.filter((item) => item.status !== "通过").map((item) => `${item.question}：${item.reason}`);
    return { passed: issues.length === 0, issues, questions };
  }

  function resourceFromContext(context, resourceId) {
    return context?.resources?.find((item) => item.id === resourceId) || null;
  }

  const BLOCKED_RESULT_STATUS = /质量失败|本体不兼容|无法计算|零分母|覆盖不足|映射失败|无法判断/;

  function csvEligibility(run, scenarioContext = null) {
    if (run?.past || run?.context?.past) return { allowed: false, reason: "历史轮次只读；请按当前权威上下文重新运行后导出" };
    if (!run?.result?.rows?.length) return { allowed: false, reason: "当前没有可导出的结构化结果" };
    if (run.status !== "成功") return { allowed: false, reason: "只有成功形成的固定结果可以导出" };
    if (!run.context?.ready || run.context?.allowConsumption !== true || !run.context?.evidenceComplete) return { allowed: false, reason: run.context?.dataReason || "当前上下文、数据可信度或证据映射不完整" };
    const missingEvidence = run.result.rows.find((row) => !row.evidenceId);
    if (missingEvidence) return { allowed: false, reason: `${missingEvidence.object} · ${missingEvidence.label}缺少证据编号` };
    const blocked = run.result.rows.find((row) => BLOCKED_RESULT_STATUS.test(String(row.status || "")));
    if (blocked) return { allowed: false, reason: `${blocked.object} · ${blocked.label}为“${blocked.status}”，不能导出误导性数值` };
    const current = projectRuntimeContextForScenario(readRuntimeContext(), scenarioContext, run.configSnapshot);
    if (!current?.ready || !runtimeContextMatches(run.context, current)) return { allowed: false, reason: "当前权威消费上下文已变化，请按当前版本重新运行后导出" };
    const output = verifyFixedResult(run.result, run.context, run.configSnapshot);
    if (!output.passed) return { allowed: false, reason: output.issues[0] };
    return { allowed: true, reason: "" };
  }

  function actionEligibility(run, config = null, scenarioContext = null, requestedTargetStableId = null) {
    if (run?.past || run?.context?.past) return { allowed: false, reason: "历史轮次只读；请按当前权威上下文重新运行后发起行动申请" };
    if (run?.status !== "成功" || !run?.result) return { allowed: false, reason: "只有成功形成的固定结果可以发起行动申请" };
    if (!run.context?.ready || run.context?.allowConsumption !== true || !run.context?.evidenceComplete) return { allowed: false, reason: "双版本、数据可信度或证据不完整" };
    const current = projectRuntimeContextForScenario(readRuntimeContext(), scenarioContext, config || run.configSnapshot);
    if (!current?.ready || !runtimeContextMatches(run.context, current)) return { allowed: false, reason: "当前权威消费上下文已变化，请按当前版本重新运行后发起行动申请" };
    const actionOptions = [run.result.actionContext, ...(run.result.actionContexts || [])].filter(Boolean);
    const action = requestedTargetStableId
      ? actionOptions.find((item) => item.singleTargetStableId === requestedTargetStableId)
      : actionOptions.length === 1 ? actionOptions[0] : null;
    if (!action?.singleTargetStableId) return { allowed: false, reason: actionOptions.length > 1 ? "请从三条规则结果中明确选择一个单一主体" : "行动申请必须绑定一个已确认的非集团主体" };
    const effectiveConfig = config || run.configSnapshot;
    const actionResource = resourceFromContext(run.context, action.actionTypeId);
    if (actionResource?.type !== "Action Type" || !effectiveConfig?.allowedResources?.includes(action.actionTypeId) || !effectiveConfig?.allowedActions?.includes("提交标准 Action Request")) return { allowed: false, reason: "行动类型不在当前配置白名单、已发布资源包或后续操作范围内" };
    if (!run.result.scope?.some((label) => `UNIT-${String(label).replace(/\D/g, "")}` === action.singleTargetStableId) || action.targetLabel === "集团") return { allowed: false, reason: "行动目标稳定身份不在本轮固定对象范围内" };
    if (!action.targetLabel) action.targetLabel = run.result.scope.find((label) => `UNIT-${String(label).replace(/\D/g, "")}` === action.singleTargetStableId) || null;
    const stableIds = new Set(run.result.resourceIds || []);
    if (!action.ruleMetricResourceIds?.length || action.ruleMetricResourceIds.some((id) => !stableIds.has(id))) return { allowed: false, reason: "缺少同版本 Rule 或 Metric 快照" };
    if (action.sourceKind === "rule") {
      if (!action.ruleEvidenceId) return { allowed: false, reason: "Rule 结果缺少逐项证据" };
    } else if (!action.institutionBindings?.length || !action.ownerBinding || !action.institutionEvidenceIds?.length || !action.loanEvidenceIds?.length || !action.ownerEvidenceId) return { allowed: false, reason: "机构、借据或负责人证据绑定不完整" };
    const evidenceIds = new Set([
      ...(run.result.rows || []).map((row) => row.evidenceId),
      ...(run.result.evidenceReferences || []).map((item) => item.evidenceId)
    ].filter(Boolean));
    const requiredEvidence = action.sourceKind === "rule"
      ? [action.ruleEvidenceId]
      : [...action.institutionEvidenceIds, ...action.loanEvidenceIds, action.ownerEvidenceId];
    if (requiredEvidence.some((id) => !evidenceIds.has(id))) return { allowed: false, reason: "行动上下文引用了本轮固定结果之外的证据" };
    const output = verifyFixedResult(run.result, run.context, effectiveConfig);
    if (!output.passed) return { allowed: false, reason: output.issues[0] };
    return { allowed: true, reason: "", actionContext: clone(action) };
  }

  function actionRequestIdempotencyKey(request) {
    return [request?.scenarioId, request?.scenarioVersion, request?.scenarioRunId, request?.id, request?.semanticVersion, request?.dataVersion].map((value) => value || "").join("|");
  }

  function reconcileActionRequest(existingRequests, request) {
    const requests = Array.isArray(existingRequests) ? existingRequests : [];
    const idempotencyKey = request?.idempotencyKey || actionRequestIdempotencyKey(request);
    const sameId = requests.find((item) => item.id === request?.id);
    if (sameId && (sameId.idempotencyKey || actionRequestIdempotencyKey(sameId)) !== idempotencyKey) {
      return { status: "conflict", request: sameId, requests, reason: "同一行动申请标识已绑定其他场景轮次或版本，原记录未被覆盖" };
    }
    const duplicate = requests.find((item) => (item.idempotencyKey || actionRequestIdempotencyKey(item)) === idempotencyKey);
    if (duplicate) return { status: "duplicate", request: duplicate, requests, reason: "幂等键一致，返回原请求且不增加副作用" };
    const accepted = { ...clone(request), idempotencyKey };
    return { status: "accepted", request: accepted, requests: [accepted, ...requests], reason: "新请求已记录，等待决策中心接收" };
  }

  function buildC011Payload(request, run) {
    const action = request?.actionContext || {};
    // The action context is the authoritative target for a Rule-originated
    // request.  The modal's display label can be stale when a result contains
    // several single-subject action contexts, so derive the subject fields
    // from the selected action before constructing the C011 payload.
    const targetStableId = action.singleTargetStableId || request?.targetStableId || null;
    const subjectName = action.targetLabel || request?.target || (targetStableId ? `单位${String(targetStableId).replace(/^UNIT-/, "")}` : "当前主体");
    const ruleId = request?.ruleId || action.ruleMetricResourceIds?.find((id) => id.startsWith("RULE-")) || null;
    const metricId = action.ruleMetricResourceIds?.find((id) => id.startsWith("MET-")) || null;
    const ruleResource = resourceFromContext(run?.context, ruleId);
    const metricResource = resourceFromContext(run?.context, metricId);
    const resultRow = (run?.result?.rows || []).find((row) => row.evidenceId === action.ruleEvidenceId || row.id === action.ruleResultItemId) || null;
    const actionResource = resourceFromContext(run?.context, request?.actionType);
    const resultRows = Array.isArray(run?.result?.rows) ? run.result.rows : [];
    const evidenceFacts = Array.isArray(run?.result?.evidenceReferences) ? run.result.evidenceReferences : [];
    const resultItems = [...resultRows, ...evidenceFacts];
    const institutionBindings = Array.isArray(action.institutionBindings) ? action.institutionBindings : [];
    const banks = institutionBindings.map((binding, index) => {
      const row = resultItems.find((item) => item.id === binding.institutionResultItemId || item.resultItemId === binding.institutionResultItemId) || {};
      return {
        id: binding.institutionStableId,
        name: row.object || row.exact || binding.institutionStableId,
        balance: row.exact ? `${row.exact}${row.unit || ""}` : "见固定证据",
        contribution: row.status || `优先级 ${index + 1}`,
        loanCount: Array.isArray(binding.loanStableIds) ? binding.loanStableIds.length : 0,
        note: row.detail || `排序来自本轮固定结果，优先级 ${index + 1}`
      };
    });
    const loans = institutionBindings.flatMap((binding) => {
      const bank = banks.find((item) => item.id === binding.institutionStableId);
      return (binding.loanStableIds || []).map((loanId) => ({ id: loanId, bank: bank?.name || binding.institutionStableId, type: "融资借据", balance: "见固定证据", rate: "见固定证据" }));
    });
    const ownerFact = resultItems.find((item) => item.id === action.ownerBinding?.ownerResultItemId || item.resultItemId === action.ownerBinding?.ownerResultItemId || item.evidenceId === action.ownerEvidenceId) || null;
    const ownerName = String(ownerFact?.exact || "").split("·").map((item) => item.trim()).filter(Boolean).slice(-1)[0] || null;
    const recommendationTopic = {
      "RULE-HIGH-FINANCING-COST": "高成本融资",
      "RULE-FLOATING-RATE-EXPOSURE": "浮动利率融资",
      "RULE-SHORT-TERM-DEBT-CONCENTRATION": "短期债务融资"
    }[ruleId] || ruleResource?.name || "融资事项";
    const recommendationTarget = subjectName;
    const scenarioContext = {
      scenarioId: request?.scenarioId,
      scenarioVersion: request?.scenarioVersion,
      scenarioRunId: request?.scenarioRunId,
      formedAt: run?.context?.scenarioFormedAt || null,
      status: run?.context?.scenarioStatus || run?.context?.scenarioReferenceStatus || "unknown",
      source: "C008 权威投影"
    };
    return {
      id: request?.id,
      requestId: request?.id,
      idempotencyKey: request?.idempotencyKey,
      scenarioContext,
      scenario: run?.context?.scenarioName || "集团融资成本与债务结构优化",
      sourceType: "qa",
      sourceRef: `智能问数运行 ${request?.runId}`,
      requester: "智能问数",
      requestTime: request?.createdAt,
      generatedTime: run?.completedAt || request?.createdAt,
      subjectId: targetStableId,
      subjectName,
      singleBusinessSubjectId: targetStableId,
      singleBusinessSubjectName: subjectName,
      actionType: {
        id: request?.actionType,
        name: actionResource?.name || request?.actionType,
        version: run?.context?.semanticVersion,
        status: "已发布"
      },
      rule: ruleId ? {
        id: ruleId,
        name: ruleResource?.name || ruleId,
        version: run?.context?.semanticVersion,
        evaluatedAt: run?.completedAt || request?.createdAt,
        branch: resultRow?.label || "已发布 Rule 命中",
        hitEvidence: resultRow?.exact || resultRow?.status || action.ruleEvidenceId
      } : null,
      metric: {
        id: metricId,
        name: metricResource?.name || metricId || "指标快照",
        value: resultRow ? `${resultRow.exact}${resultRow.unit || ""}` : "证据见固定结果",
        explanation: resultRow?.status || "来自固定结构化语义结果",
        evaluatedAt: run?.completedAt || request?.createdAt,
        scope: subjectName
      },
      owner: ownerName,
      recommendation: banks.length ? `优先与${banks.map((item) => item.name).join("、")}核对并协商${recommendationTarget}的${recommendationTopic}` : null,
      banks,
      loans,
      loanCount: loans.length,
      evidence: {
        semanticVersion: run?.context?.semanticVersion,
        semanticVersionId: run?.context?.versionId,
        dataVersion: run?.context?.dataVersion,
        cutoff: run?.context?.asOf,
        quality: run?.context?.quality,
        freshness: run?.context?.freshness,
        snapshotId: request?.fixedResultId,
        evidenceIds: clone(request?.evidenceIds || []),
        t019EvidenceCode: run?.context?.t019EvidenceCode
      },
      semanticVersion: run?.context?.semanticVersion,
      dataVersion: run?.context?.dataVersion,
      fixedResultId: request?.fixedResultId,
      ruleEvidenceId: action.ruleEvidenceId || null,
      evidenceIds: clone(request?.evidenceIds || []),
      status: "待接收"
    };
  }

  function publishActionRequestInbox(requests, runtimeContext) {
    const scenarioContext = {
      scenarioId: runtimeContext?.scenarioId,
      scenarioVersion: runtimeContext?.scenarioVersion,
      scenarioRunId: runtimeContext?.scenarioRunId,
      formedAt: runtimeContext?.scenarioFormedAt || null,
      status: runtimeContext?.scenarioStatus || runtimeContext?.scenarioReferenceStatus || "unknown",
      source: "C008 权威投影"
    };
    if (!scenarioContext.scenarioId || !scenarioContext.scenarioVersion || !scenarioContext.scenarioRunId || !scenarioContext.formedAt || !scenarioContext.status) return { published: false, reason: "C033 场景上下文不完整" };
    const payloads = (requests || []).filter((item) => item?.c011Payload && item.scenarioId === scenarioContext.scenarioId && item.scenarioVersion === scenarioContext.scenarioVersion && item.scenarioRunId === scenarioContext.scenarioRunId).map((item) => ({
      ...clone(item.c011Payload),
      scenarioContext: clone(scenarioContext)
    }));
    localStorage.setItem(C011_INBOX_STORAGE_KEY, JSON.stringify({ contractCode: "C011", sourceModule: "智能问数", status: "active", scenarioContext, formedAt: nowText(), requests: payloads }));
    return { published: true, count: payloads.length };
  }

  function buildOntologyDeepLink(context, resourceId, tab = "overview") {
    if (!context?.versionId || !context?.resources?.some((item) => item.id === resourceId)) return null;
    const version = rawPublishedVersionForContext(context);
    if (!version || !allPublishedResources(version).some((item) => item.id === resourceId)) return null;
    const scenario = new URLSearchParams({ version: context.versionId, id: resourceId, tab });
    if (context.scenarioId) scenario.set("scenarioId", context.scenarioId);
    if (context.scenarioVersion) scenario.set("scenarioVersion", context.scenarioVersion);
    if (context.scenarioRunId) scenario.set("scenarioRunId", context.scenarioRunId);
    return `${ONTOLOGY_ENTRY}#published/resource?${scenario.toString()}`;
  }

  function referencedUnitCodes(text) {
    const source = String(text || "");
    const occurrences = [];
    const anchors = /UNIT[\s_-]*(553|465|561)(?![A-Za-z0-9])|单位\s*(553|465|561)(?!\d)/gi;
    for (const match of source.matchAll(anchors)) {
      const code = match[1] || match[2];
      occurrences.push({ code, index: match.index });
      if (!match[2]) continue;
      let offset = match.index + match[0].length;
      let tail = source.slice(offset);
      while (tail) {
        const continuation = tail.match(/^\s*(?:、|,|，|和|及|与|\/)\s*(?:单位\s*)?(553|465|561)(?!\d)/);
        if (!continuation) break;
        const within = continuation[0].lastIndexOf(continuation[1]);
        occurrences.push({ code: continuation[1], index: offset + Math.max(0, within) });
        offset += continuation[0].length;
        tail = source.slice(offset);
      }
    }
    occurrences.sort((left, right) => left.index - right.index);
    const seen = new Set();
    return occurrences.map((item) => item.code).filter((code) => code && !seen.has(code) && seen.add(code));
  }

  function unitCostResultFor(unitCode) {
    const source = clone(RESULT_TEMPLATES["unit-cost"]);
    if (unitCode === "553") return source;
    const facts = {
      "465": { balance: 770.000, cost: 2.197, highCost: 0.000, other: 100.000, floating: 100.000, short: 0.000 },
      "561": { balance: 20.016, cost: 2.228, highCost: 0.000, other: 100.000, floating: 0.000, short: 93.545 }
    }[unitCode];
    if (!facts) return null;
    const unit = `单位${unitCode}`;
    source.title = `${unit}融资成本及构成`;
    source.scope = [unit];
    source.summary = `${unit}平均融资成本为 ${facts.cost.toFixed(3)}%，融资余额为 ${facts.balance.toFixed(3)} 亿元。高成本融资余额占比为 ${facts.highCost.toFixed(3)}%。`;
    source.highlights = [
      { id: "avg-cost", label: "平均融资成本", value: `${facts.cost.toFixed(3)}%`, exact: facts.cost.toFixed(3), unit: "%" },
      { id: "balance", label: "融资余额", value: `${facts.balance.toFixed(3)} 亿元`, exact: facts.balance.toFixed(3), unit: "亿元" },
      { id: "high-cost", label: "高成本融资余额占比", value: `${facts.highCost.toFixed(3)}%`, exact: facts.highCost.toFixed(3), unit: "%", tone: facts.highCost > 20 ? "danger" : "" }
    ];
    const values = { "avg-cost": facts.cost, balance: facts.balance, "high-cost": facts.highCost, "other-cost": facts.other, floating: facts.floating, short: facts.short };
    source.rows = source.rows.map((row) => ({ ...row, object: unit, exact: Number(values[row.id]).toFixed(3), status: Number(values[row.id]) === 0 ? "真实零值" : "可计算" }));
    const rowById = Object.fromEntries(source.rows.map((row) => [row.id, row]));
    source.chart.adapters.metric.items[0] = { ...source.chart.adapters.metric.items[0], value: facts.cost, exact: facts.cost.toFixed(3), status: rowById["avg-cost"].status };
    ["donut", "bar"].forEach((adapterId) => {
      source.chart.adapters[adapterId].items = source.chart.adapters[adapterId].items.map((item) => {
        const value = item.rowId === "high-cost" ? facts.highCost : facts.other;
        return { ...item, value, exact: value.toFixed(3), status: rowById[item.rowId]?.status || "可计算" };
      });
    });
    source.chart.categories = ["高成本融资", "其他融资"];
    source.chart.values = [facts.highCost, facts.other];
    source.nextQuestions = [`为什么${unit}出现当前融资结构？`, `查看${unit}的规则命中和机构贡献。`];
    return source;
  }

  function pairCostResultFor(unitCodes) {
    const order = ["553", "465", "561"];
    const normalized = [...new Set(unitCodes)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (normalized.length !== 2) return null;
    const unitFacts = {
      "553": { balance: 393.134, cost: 2.881 },
      "465": { balance: 770.000, cost: 2.197 },
      "561": { balance: 20.016, cost: 2.228 }
    };
    const totalBalance = normalized.reduce((sum, code) => sum + unitFacts[code].balance, 0);
    const combinedCost = normalized.reduce((sum, code) => sum + unitFacts[code].balance * unitFacts[code].cost, 0) / totalBalance;
    const source = clone(RESULT_TEMPLATES["pair-cost"]);
    const units = normalized.map((code) => `单位${code}`);
    source.title = `${units.join("与")}综合平均融资成本`;
    source.scope = units;
    source.summary = `${units.join("和")}融资余额合计 ${totalBalance.toFixed(3)} 亿元，综合平均融资成本为 ${combinedCost.toFixed(3)}%。综合结果按融资余额加权计算，不是两个单位成本的简单平均。`;
    source.highlights = [
      { id: "combined-cost", label: "综合平均融资成本", value: `${combinedCost.toFixed(3)}%`, exact: combinedCost.toFixed(3), unit: "%" },
      { id: "combined-balance", label: "合计融资余额", value: `${totalBalance.toFixed(3)} 亿元`, exact: totalBalance.toFixed(3), unit: "亿元" },
      { id: "object-count", label: "对象范围", value: "2 家单位", exact: "2", unit: "家" }
    ];
    source.rows = [
      { id: "combined-cost", object: "组合结果", resourceId: "MET-WAVG-FINANCING-COST", label: "综合平均融资成本", exact: combinedCost.toFixed(3), unit: "%", status: "可计算" },
      { id: "combined-balance", object: "组合结果", resourceId: "MET-FINANCING-BALANCE", label: "合计融资余额", exact: totalBalance.toFixed(3), unit: "亿元", status: "可计算" },
      { id: "object-count", object: "对象范围", resourceId: "OBJ-FINANCING-ENTITY", label: "单位数量", exact: "2", unit: "家", status: "可计数" },
      ...normalized.map((code) => ({ id: `unit-${code}`, object: `单位${code}`, resourceId: "MET-WAVG-FINANCING-COST", label: "平均融资成本", exact: unitFacts[code].cost.toFixed(3), unit: "%", status: "可计算" }))
    ];
    source.chart.adapters.metric.items[0] = { ...source.chart.adapters.metric.items[0], value: Number(combinedCost.toFixed(3)), exact: combinedCost.toFixed(3) };
    source.chart.adapters.bar.items = normalized.map((code) => ({ id: `unit-${code}`, rowId: `unit-${code}`, label: `单位${code}`, value: unitFacts[code].cost, exact: String(unitFacts[code].cost), unit: "%", resourceId: "MET-WAVG-FINANCING-COST", status: "可计算" }));
    source.chart.categories = units;
    source.chart.values = normalized.map((code) => unitFacts[code].cost);
    source.nextQuestions = ["把第三家单位加入组合。", `分别查看${units.join("和")}的成本构成。`];
    return source;
  }

  function resolveQuestion(text) {
    const normalized = String(text || "").trim();
    const exact = RECOMMENDED_QUESTIONS.find((item) => item.question === normalized);
    if (exact) return exact.templateId || exact.id;
    const unitCodes = referencedUnitCodes(normalized);
    if (normalized.includes("上期") || normalized.includes("趋势") || normalized.includes("折线")) return "trend-blocked";
    if ((normalized.includes("机构") || normalized.includes("协商") || normalized.includes("银行")) && unitCodes.includes("553")) return "institution-priority";
    if ((normalized.includes("规则") || normalized.includes("命中") || normalized.includes("为什么")) && unitCodes.length) return "rule-explain";
    if ((normalized.includes("集团") || normalized.includes("板块")) && /融资|成本|债务|结构/.test(normalized)) return "group-overview";
    if (unitCodes.length === 3 && /成本|融资/.test(normalized)) return "triple-cost";
    if (unitCodes.length === 2 && /成本|融资/.test(normalized)) return "pair-cost";
    if (unitCodes.length === 1 && /成本|融资余额|构成|结构/.test(normalized)) return "unit-cost";
    return null;
  }

  Object.freeze(RESOURCES);
  window.IQDomain = {
    C008_PROJECTION_STORAGE_KEY, C008_SCHEMA_VERSION, HANDOFF_CHANNEL, HANDOFF_REQUEST_STORAGE_KEY, LEGACY_ONTOLOGY_STORAGE_KEYS, C017_PROJECTION_STORAGE_KEY, C011_INBOX_STORAGE_KEY, SCENARIO_RESET_REQUEST_KEY, IDENTITY_COUNTER_STORAGE_KEY, ACTIVE_ONTOLOGY_ID, ONTOLOGY_ENTRY, DATA_ENGINEERING_ENTRY,
    STATE_SCHEMA_VERSION, LINK_CANONICAL_ENDPOINTS, LINK_DIRECTION_WHITELIST, QUERY_LINK_PATHS,
    RESOURCES, resourceById, SKILLS, TOOLS, PLATFORM_CAPABILITIES, ACTIVE_CONFIG, CANDIDATE_CONFIG,
    RECOMMENDED_QUESTIONS, CANDIDATE_VALIDATION_QUESTIONS, RESULT_TEMPLATES, HISTORY, SAVED_VIEWS, PINS,
    clone, nowText, nextStableId, createInitialState, loadState, saveState, resetState, readScenarioResetRequest,
    readStoredJson, readAuthoritativeProjection, legacyProjectionDiagnostics, requestPublishedContext, readPublishedContextResponse, readPublishedOntologyContext, readCandidateConsumptionContext, readOntologyBindingContext, readDataTrustContext, readRuntimeContext, readOntologyContext,
    projectRuntimeContext, attachScenarioContext, projectRuntimeContextForScenario, runtimeContextFingerprint, runtimeContextMatches, resourceContractFingerprint, publishedContractProblems,
    configContractSnapshot, configContractFingerprint, buildC009CompatibilityRecord,
    bindConfigSnapshot, deriveConfigRuntimeState, runtimeCapabilityProof, isLinkDirectionAllowed, validateRunContext, configCompleteness,
    validateCandidateConfig, validateFixedQuestionSet, verifyFixedResult, isConfigCompatible, matchApplicableAgents,
    recommendationEligibility, recommendableQuestions, materializeResult, validateCandidateFixedQuestionSet,
    csvEligibility, actionEligibility, actionRequestIdempotencyKey, reconcileActionRequest, buildC011Payload, publishActionRequestInbox, buildOntologyDeepLink, resourceFromContext, resolveQuestion,
    referencedUnitCodes, unitCostResultFor, pairCostResultFor, queryDefinition
  };
})();
