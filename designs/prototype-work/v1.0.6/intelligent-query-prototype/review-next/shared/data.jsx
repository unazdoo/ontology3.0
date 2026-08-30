/* Intelligent Query review domain. This file reads upstream prototype state but never writes it. */
(() => {
  "use strict";

  const ONTOLOGY_STORAGE_KEY = "ontology3-canvas-first-review-v16";
  const C017_PROJECTION_STORAGE_KEY = "ontology3.c017.intelligent-query.projection.v1";
  const IDENTITY_COUNTER_STORAGE_KEY = "ontology3.iq.review.identity-counter.v1";
  const ACTIVE_ONTOLOGY_ID = "ONT-GROUP-FINANCING-OPTIMIZATION";
  const ACTIVE_DATA_ASSET_ID = "FIN-ASSET";
  const ONTOLOGY_ENTRY = "../../../ontology-management-review/canvas-first/index.html";
  const DATA_ENGINEERING_ENTRY = "../../../data-engineering-prototype-review/review-v3/方案B2.html#/resources/asset/finance-asset-target";
  const STATE_SCHEMA_VERSION = 19;
  const ONTOLOGY_INITIAL_CATALOG = Object.freeze({ draftCount: 1, publishedCount: 0 });
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
    resource("Property", "PROP-FINANCING-DETAIL-LOAN-ID", "借据编号", { parentId: "OBJ-FINANCING-DETAIL", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-DETAIL-DOMESTIC-OVERSEAS", "境内外", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-DRAWDOWN-DATE", "提款日", { parentId: "OBJ-FINANCING-DETAIL", dataType: "日期" }),
    resource("Property", "PROP-FINANCING-DETAIL-MATURITY-DATE", "到期日", { parentId: "OBJ-FINANCING-DETAIL", dataType: "日期" }),
    resource("Property", "PROP-FINANCING-DETAIL-CURRENCY", "币种", { parentId: "OBJ-FINANCING-DETAIL", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-DETAIL-FX-RATE", "汇率", { parentId: "OBJ-FINANCING-DETAIL", dataType: "数值" }),
    resource("Property", "PROP-FINANCING-DETAIL-ORIGINAL-BALANCE", "原币余额", { parentId: "OBJ-FINANCING-DETAIL", dataType: "数值" }),
    resource("Property", "PROP-FINANCING-DETAIL-CNY-BALANCE", "折合人民币余额", { parentId: "OBJ-FINANCING-DETAIL", dataType: "数值", unit: "人民币元" }),
    resource("Property", "PROP-FINANCING-DETAIL-INTEREST-RATE", "当前利率", { parentId: "OBJ-FINANCING-DETAIL", dataType: "数值", unit: "%" }),
    resource("Property", "PROP-FINANCING-DETAIL-RATE-TYPE", "利率形式", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-FINANCING-TYPE", "融资类型", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-TERM-TYPE", "期限种类", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCING-DETAIL-GUARANTEE-TYPE", "担保方式", { parentId: "OBJ-FINANCING-DETAIL", dataType: "枚举" }),
    resource("Property", "PROP-FINANCIAL-INSTITUTION-CODE", "机构编码", { parentId: "OBJ-FINANCIAL-INSTITUTION", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCIAL-INSTITUTION-NAME", "机构名称", { parentId: "OBJ-FINANCIAL-INSTITUTION", role: "标题", dataType: "文本" }),
    resource("Property", "PROP-FINANCIAL-INSTITUTION-CATEGORY", "机构类别", { parentId: "OBJ-FINANCIAL-INSTITUTION", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-OWNER-ID", "负责人标识", { parentId: "OBJ-FINANCING-OWNER", role: "身份", dataType: "文本" }),
    resource("Property", "PROP-FINANCING-OWNER-NAME", "负责人名称", { parentId: "OBJ-FINANCING-OWNER", role: "标题", dataType: "文本" }),

    resource("Link Type", "LINK-ENTITY-FINANCING", "融资归属主体", { scope: "融资明细 → 融资主体；允许主体反向取得融资明细", source: "OBJ-FINANCING-DETAIL", target: "OBJ-FINANCING-ENTITY", allowedDirection: "融资明细→主体；主体→明细" }),
    resource("Link Type", "LINK-FINANCING-INSTITUTION", "融资由机构提供", { scope: "融资明细 → 融资机构", source: "OBJ-FINANCING-DETAIL", target: "OBJ-FINANCIAL-INSTITUTION", allowedDirection: "融资明细→机构" }),
    resource("Link Type", "LINK-ENTITY-OWNER", "主体由负责人承接", { scope: "融资主体 → 融资负责人", source: "OBJ-FINANCING-ENTITY", target: "OBJ-FINANCING-OWNER", allowedDirection: "主体→负责人" }),

    resource("Metric", "MET-FIN-BALANCE", "融资余额", { unit: "人民币元", scope: "集团、板块、主体及主体集合", time: "数据截至时点" }),
    resource("Metric", "MET-WAVG-COST", "余额加权平均融资成本", { unit: "%", scope: "集团、板块、主体及主体集合", time: "数据截至时点" }),
    resource("Metric", "MET-FLOATING-RATE-SHARE", "浮动利率余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点" }),
    resource("Metric", "MET-SHORT-DEBT-SHARE", "短期债务余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点", decision: "短期债务口径待确认" }),
    resource("Metric", "MET-FX-FINANCING-SHARE", "外币融资余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点" }),
    resource("Metric", "MET-HIGH-COST-SHARE", "高成本融资余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点", decision: "高成本阈值待确认" }),
    resource("Metric", "MET-CREDIT-FINANCING-SHARE", "信用融资余额占比", { unit: "%", scope: "集团、板块、融资主体", time: "数据截至时点" }),

    resource("Rule", "RULE-HIGH-COST", "融资成本偏高", { code: "R01", scope: "融资主体", decision: "阈值与排序口径待确认" }),
    resource("Rule", "RULE-FLOATING-EXPOSURE", "浮动利率暴露", { code: "R02", scope: "融资主体", decision: "规则阈值待确认" }),
    resource("Rule", "RULE-SHORT-DEBT", "短期债务集中", { code: "R03", scope: "融资主体", decision: "阈值与短期债务口径待确认" }),
    resource("Action Type", "ACTION-FINANCING-OPTIMIZATION", "发起融资优化建议", { scope: "单一融资主体", decision: "默认完成期限待确认" })
  ];

  const resourceById = Object.fromEntries(RESOURCES.map((item) => [item.id, item]));

  const SKILLS = [
    { id: "SK-IQ-DISCOVERY", name: "场景与资源发现", version: "1.8", source: "智能问数能力目录", owner: "智能问数", boundary: "只发现白名单内已发布资源" },
    { id: "SK-IQ-SCOPE", name: "对象解析与消歧", version: "2.1", source: "智能问数能力目录", owner: "智能问数", boundary: "按稳定身份确认对象范围" },
    { id: "SK-IQ-PLAN", name: "受控查询规划", version: "1.0", source: "智能问数能力目录", owner: "智能问数", boundary: "只规划获准 Object、Metric、Rule 与 Link，不计算业务结果" }
  ];

  const TOOLS = [
    { id: "TOOL-IQ-SEMANTIC-QUERY", name: "语义查询", version: "1.0", owner: "智能问数", boundary: "对正式 Object、Metric、Rule 与 Link 求值；不读取源表字段" },
    { id: "TOOL-IQ-EVIDENCE-READ", name: "证据读取", version: "1.0", owner: "智能问数", boundary: "只读取本轮固定结果对应的受控证据" },
    { id: "TOOL-IQ-ACTION-REQUEST", name: "行动请求提交", version: "1.0", owner: "智能问数", boundary: "只提交标准 Action Request，不运行提醒或待办" }
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
    { id: "unit-cost", title: "单位融资成本及构成", question: "单位553平均融资成本及构成是什么？", theme: "单位成本", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-COST", "MET-FIN-BALANCE", "MET-HIGH-COST-SHARE"] },
    { id: "pair-cost", title: "两家单位综合成本", question: "单位553和单位465综合平均融资成本是多少？", theme: "组合对比", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-COST", "MET-FIN-BALANCE"] },
    { id: "triple-cost", title: "三家单位综合成本", question: "单位553、单位465和单位561综合平均融资成本是多少？", theme: "组合对比", resources: ["OBJ-FINANCING-ENTITY", "MET-WAVG-COST", "MET-FIN-BALANCE"] },
    { id: "group-overview", title: "集团与产业板块对比", question: "集团融资成本、债务结构和产业板块对比如何？", theme: "集团概览", resources: ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "MET-WAVG-COST", "MET-FLOATING-RATE-SHARE", "MET-SHORT-DEBT-SHARE"] },
    { id: "rule-explain", title: "三条规则命中解释", question: "为什么单位553、单位465和单位561分别命中不同规则？", theme: "规则解释", resources: ["RULE-HIGH-COST", "RULE-FLOATING-EXPOSURE", "RULE-SHORT-DEBT"] },
    { id: "institution-priority", title: "优先协商金融机构", question: "单位553的异常贷款应优先与哪些金融机构协商？", theme: "机构归因", resources: ["RULE-HIGH-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION"] }
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
        metric: { items: [chartItem(template.id, "avg-cost", "平均融资成本", 2.881, "%", "MET-WAVG-COST")], unit: "%" },
        donut: { items: itemsForRows(["high-cost", "other-cost"], ["高成本融资", "其他融资"], [77.337, 22.663], "%"), unit: "%", composition: true },
        bar: { items: itemsForRows(["high-cost", "other-cost"], ["高成本融资", "其他融资"], [77.337, 22.663], "%"), unit: "%" }
      };
    } else if (template.id === "pair-cost") {
      adapters = {
        metric: { items: [chartItem(template.id, "combined-cost", "综合平均融资成本", 2.428, "%", "MET-WAVG-COST")], unit: "%" },
        bar: { items: itemsForRows(["unit-553", "unit-465"], ["单位553", "单位465"], [2.881, 2.197], "%", "MET-WAVG-COST"), unit: "%" }
      };
    } else if (template.id === "triple-cost") {
      adapters = {
        metric: { items: [chartItem(template.id, "combined-cost", "综合平均融资成本", 2.425, "%", "MET-WAVG-COST")], unit: "%" },
        bar: { items: itemsForRows(["unit-553", "unit-465", "unit-561"], ["单位553", "单位465", "单位561"], [2.881, 2.197, 2.228], "%", "MET-WAVG-COST"), unit: "%" }
      };
    } else if (template.id === "group-overview") {
      const ids = ["nuclear", "renewable", "service", "digital", "finance", "environment"];
      const labels = ["核能", "境内新能源", "产业服务", "数字化", "产业金融", "环保产业"];
      const costValues = [1.948, 2.286, 2.462, 2.523, 2.614, 2.741];
      const structure = [[91.2, 8.8], [96.7, 3.3], [94.1, 5.9], [97.5, 2.5], [93.4, 6.6], [95.8, 4.2]];
      adapters = {
        metric: { items: [chartItem(template.id, "group", "集团平均融资成本", 2.372, "%", "MET-WAVG-COST")], unit: "%" },
        bar: { items: itemsForRows(ids, labels, costValues, "%", "MET-WAVG-COST"), unit: "%", meaning: "板块平均融资成本" },
        stacked: { items: ids.map((rowId, index) => ({ ...chartItem(template.id, `${rowId}-structure-total`, labels[index], 100, "%", "MET-FLOATING-RATE-SHARE"), segments: [
          chartItem(template.id, `${rowId}-floating`, "浮动利率", structure[index][0], "%", "MET-FLOATING-RATE-SHARE", "可计算", { evidenceId: evidenceIdFor(template.id, rowId) }),
          chartItem(template.id, `${rowId}-fixed`, "固定利率", structure[index][1], "%", "MET-FLOATING-RATE-SHARE", "可计算", { evidenceId: evidenceIdFor(template.id, rowId) })
        ] })), unit: "%", segmentLabels: ["浮动利率", "固定利率"], meaning: "融资利率结构" }
      };
    } else if (template.id === "rule-explain") {
      adapters = { table: { items: rows.map((row) => ({ id: row.id, rowId: row.id, evidenceId: row.evidenceId, label: row.object, value: null, exact: row.exact, unit: row.unit, resourceId: row.resourceId, status: row.status })) } };
    } else if (template.id === "institution-priority") {
      adapters = {
        metric: { items: [chartItem(template.id, "problem-balance", "问题余额", 99.586, "亿元", "MET-FIN-BALANCE")], unit: "亿元" },
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
      ["OBJ-FINANCING-ENTITY", "OBJ-FINANCING-DETAIL", "LINK-ENTITY-FINANCING", "MET-FIN-BALANCE", "MET-WAVG-COST", "MET-HIGH-COST-SHARE", "MET-FLOATING-RATE-SHARE", "MET-SHORT-DEBT-SHARE"],
      "单位553平均融资成本为 2.881%，融资余额为 393.134 亿元。高成本融资余额占比 77.337%，是当前成本结构的主要关注项。",
      [
        { id: "avg-cost", label: "平均融资成本", value: "2.881%", exact: "2.881", unit: "%", tone: "warning" },
        { id: "balance", label: "融资余额", value: "393.134 亿元", exact: "393.134", unit: "亿元" },
        { id: "high-cost", label: "高成本融资余额占比", value: "77.337%", exact: "77.337", unit: "%", tone: "danger" }
      ],
      [
        { id: "balance", object: "单位553", resourceId: "MET-FIN-BALANCE", label: "融资余额", exact: "393.134", unit: "亿元", status: "可计算" },
        { id: "avg-cost", object: "单位553", resourceId: "MET-WAVG-COST", label: "余额加权平均融资成本", exact: "2.881", unit: "%", status: "可计算" },
        { id: "high-cost", object: "单位553", resourceId: "MET-HIGH-COST-SHARE", label: "高成本融资余额占比", exact: "77.337", unit: "%", status: "可计算", warning: "高成本阈值待确认" },
        { id: "other-cost", object: "单位553", resourceId: "MET-FIN-BALANCE", label: "其他融资余额占比", exact: "22.663", unit: "%", status: "可计算" },
        { id: "floating", object: "单位553", resourceId: "MET-FLOATING-RATE-SHARE", label: "浮动利率余额占比", exact: "0.000", unit: "%", status: "真实零值" },
        { id: "short", object: "单位553", resourceId: "MET-SHORT-DEBT-SHARE", label: "短期债务余额占比", exact: "0.000", unit: "%", status: "真实零值", warning: "短期债务口径待确认" }
      ],
      { recommended: "metric", allowed: ["metric", "bar", "donut"], categories: ["高成本融资", "其他融资"], values: [77.337, 22.663], unit: "%", composition: true },
      ["为什么单位553、单位465和单位561分别命中不同规则？", "单位553应优先与哪些金融机构协商？"]
    ),
    "pair-cost": result(
      "pair-cost", "两家单位综合平均融资成本", ["单位553", "单位465"],
      ["OBJ-FINANCING-ENTITY", "LINK-ENTITY-FINANCING", "MET-FIN-BALANCE", "MET-WAVG-COST"],
      "单位553和单位465融资余额合计 1,163.134 亿元，综合平均融资成本为 2.428%。综合结果按融资余额加权计算，不是两个单位成本的简单平均。",
      [
        { id: "combined-cost", label: "综合平均融资成本", value: "2.428%", exact: "2.428", unit: "%" },
        { id: "combined-balance", label: "合计融资余额", value: "1,163.134 亿元", exact: "1163.134", unit: "亿元" },
        { id: "object-count", label: "对象范围", value: "2 家单位", exact: "2", unit: "家", resourceId: "OBJ-FINANCING-ENTITY" }
      ],
      [
        { id: "combined-cost", object: "组合结果", resourceId: "MET-WAVG-COST", label: "综合平均融资成本", exact: "2.428", unit: "%", status: "可计算" },
        { id: "combined-balance", object: "组合结果", resourceId: "MET-FIN-BALANCE", label: "合计融资余额", exact: "1163.134", unit: "亿元", status: "可计算" },
        { id: "object-count", object: "对象范围", resourceId: "OBJ-FINANCING-ENTITY", label: "单位数量", exact: "2", unit: "家", status: "可计数" },
        { id: "unit-553", object: "单位553", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.881", unit: "%", status: "可计算" },
        { id: "unit-465", object: "单位465", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.197", unit: "%", status: "可计算" }
      ],
      { recommended: "bar", allowed: ["metric", "bar"], categories: ["单位553", "单位465"], values: [2.881, 2.197], unit: "%" },
      ["把单位561加入组合。", "查看单位553的融资成本及构成。"]
    ),
    "triple-cost": result(
      "triple-cost", "三家单位综合平均融资成本", ["单位553", "单位465", "单位561"],
      ["OBJ-FINANCING-ENTITY", "LINK-ENTITY-FINANCING", "MET-FIN-BALANCE", "MET-WAVG-COST"],
      "三家单位融资余额合计 1,183.150 亿元，综合平均融资成本为 2.425%。对象已按稳定身份去重。",
      [
        { id: "combined-cost", label: "综合平均融资成本", value: "2.425%", exact: "2.425", unit: "%" },
        { id: "combined-balance", label: "合计融资余额", value: "1,183.150 亿元", exact: "1183.150", unit: "亿元" },
        { id: "object-count", label: "对象范围", value: "3 家单位", exact: "3", unit: "家", resourceId: "OBJ-FINANCING-ENTITY" }
      ],
      [
        { id: "combined-cost", object: "组合结果", resourceId: "MET-WAVG-COST", label: "综合平均融资成本", exact: "2.425", unit: "%", status: "可计算" },
        { id: "combined-balance", object: "组合结果", resourceId: "MET-FIN-BALANCE", label: "合计融资余额", exact: "1183.150", unit: "亿元", status: "可计算" },
        { id: "object-count", object: "对象范围", resourceId: "OBJ-FINANCING-ENTITY", label: "单位数量", exact: "3", unit: "家", status: "可计数" },
        { id: "unit-553", object: "单位553", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.881", unit: "%", status: "可计算" },
        { id: "unit-465", object: "单位465", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.197", unit: "%", status: "可计算" },
        { id: "unit-561", object: "单位561", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.228", unit: "%", status: "可计算" }
      ],
      { recommended: "bar", allowed: ["metric", "bar"], categories: ["单位553", "单位465", "单位561"], values: [2.881, 2.197, 2.228], unit: "%" },
      ["去掉单位561后重新计算。", "三家分别命中了哪些规则？"]
    ),
    "group-overview": result(
      "group-overview", "集团融资成本与产业板块对比", ["集团"],
      ["OBJ-FINANCING-ENTITY", "PROP-FINANCING-ENTITY-SECTOR", "LINK-ENTITY-FINANCING", "MET-FIN-BALANCE", "MET-WAVG-COST", "MET-FLOATING-RATE-SHARE", "MET-SHORT-DEBT-SHARE"],
      "集团融资余额为 21,613.387 亿元，平均融资成本为 2.372%。浮动利率融资占比 95.149%，产业板块之间存在成本差异。",
      [
        { id: "group-cost", rowId: "group", resourceId: "MET-WAVG-COST", label: "集团平均融资成本", value: "2.372%", exact: "2.372", unit: "%" },
        { id: "group-balance", resourceId: "MET-FIN-BALANCE", label: "集团融资余额", value: "21,613.387 亿元", exact: "21613.387", unit: "亿元" },
        { id: "floating", resourceId: "MET-FLOATING-RATE-SHARE", label: "浮动利率融资占比", value: "95.149%", exact: "95.149", unit: "%", tone: "warning" },
        { id: "short", resourceId: "MET-SHORT-DEBT-SHARE", label: "短期债务占比", value: "0.912%", exact: "0.912", unit: "%" }
      ],
      [
        { id: "group", object: "集团", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.372", unit: "%", status: "可计算" },
        { id: "group-balance", object: "集团", resourceId: "MET-FIN-BALANCE", label: "融资余额", exact: "21613.387", unit: "亿元", status: "可计算" },
        { id: "floating", object: "集团", resourceId: "MET-FLOATING-RATE-SHARE", label: "浮动利率融资占比", exact: "95.149", unit: "%", status: "可计算" },
        { id: "short", object: "集团", resourceId: "MET-SHORT-DEBT-SHARE", label: "短期债务占比", exact: "0.912", unit: "%", status: "可计算" },
        { id: "nuclear", object: "核能", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "1.948", unit: "%", status: "可计算" },
        { id: "renewable", object: "境内新能源", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.286", unit: "%", status: "可计算" },
        { id: "service", object: "产业服务", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.462", unit: "%", status: "可计算" },
        { id: "digital", object: "数字化", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.523", unit: "%", status: "可计算" },
        { id: "finance", object: "产业金融", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.614", unit: "%", status: "可计算" },
        { id: "environment", object: "环保产业", resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: "2.741", unit: "%", status: "可计算" }
      ],
      { recommended: "bar", allowed: ["metric", "bar", "stacked"], categories: ["核能", "境内新能源", "产业服务", "数字化", "产业金融", "环保产业"], values: [1.948, 2.286, 2.462, 2.523, 2.614, 2.741], stacks: [[91.2,8.8],[96.7,3.3],[94.1,5.9],[97.5,2.5],[93.4,6.6],[95.8,4.2]], unit: "%" },
      ["为什么单位553、单位465和单位561分别命中不同规则？", "单位553的异常贷款应优先与哪些金融机构协商？"]
    ),
    "rule-explain": result(
      "rule-explain", "三家单位规则命中解释", ["单位553", "单位465", "单位561"],
      ["OBJ-FINANCING-ENTITY", "RULE-HIGH-COST", "RULE-FLOATING-EXPOSURE", "RULE-SHORT-DEBT", "MET-WAVG-COST", "MET-FLOATING-RATE-SHARE", "MET-SHORT-DEBT-SHARE"],
      "三家单位分别命中不同规则：单位553命中融资成本偏高，单位465命中浮动利率暴露，单位561命中短期债务集中。规则阈值与短期债务口径仍待确认，本轮只忠实展示绑定的已发布资源求值结果。",
      [
        { id: "rule-553", label: "单位553", value: "融资成本偏高", exact: "命中", unit: "R01", tone: "danger" },
        { id: "rule-465", label: "单位465", value: "浮动利率暴露", exact: "命中", unit: "R02", tone: "warning" },
        { id: "rule-561", label: "单位561", value: "短期债务集中", exact: "命中", unit: "R03", tone: "warning" }
      ],
      [
        { id: "rule-553", object: "单位553", resourceId: "RULE-HIGH-COST", label: "融资成本偏高", exact: "实际 2.881 / 阈值 2.622", unit: "%", status: "命中", warning: "阈值与排序口径待确认" },
        { id: "rule-465", object: "单位465", resourceId: "RULE-FLOATING-EXPOSURE", label: "浮动利率暴露", exact: "实际 100.000 / 阈值 80.000", unit: "%", status: "命中", warning: "规则阈值待确认" },
        { id: "rule-561", object: "单位561", resourceId: "RULE-SHORT-DEBT", label: "短期债务集中", exact: "实际 93.545 / 阈值 30.000", unit: "%", status: "命中", warning: "阈值与短期债务口径待确认" }
      ],
      { recommended: "table", allowed: ["metric", "table"], categories: ["单位553", "单位465", "单位561"], values: [2.881, 100, 93.545], unit: "各规则量纲" },
      ["查看单位553的金融机构贡献。", "分别按单一主体查看行动条件。"]
    ),
    "institution-priority": result(
      "institution-priority", "单位553优先协商金融机构", ["单位553"],
      ["OBJ-FINANCING-ENTITY", "OBJ-FINANCING-DETAIL", "OBJ-FINANCIAL-INSTITUTION", "OBJ-FINANCING-OWNER", "RULE-HIGH-COST", "LINK-ENTITY-FINANCING", "LINK-FINANCING-INSTITUTION", "LINK-ENTITY-OWNER", "MET-FIN-BALANCE", "MET-WAVG-COST"],
      "按融资成本偏高结果的问题余额贡献排序，建议优先关注欧陆银行、寰宇银行和海联银行。查询定义本身返回前三家机构。",
      [
        { id: "bank-1", rowId: "primary-institution", resourceId: "LINK-FINANCING-INSTITUTION", label: "首要机构", value: "欧陆银行", exact: "欧陆银行", unit: "第1位", tone: "danger" },
        { id: "problem-balance", resourceId: "MET-FIN-BALANCE", label: "问题余额", value: "99.586 亿元", exact: "99.586", unit: "亿元" },
        { id: "contribution", resourceId: "RULE-HIGH-COST", label: "成本贡献", value: "32.754%", exact: "32.754", unit: "%" }
      ],
      [
        { id: "target-unit", object: "单位553", resourceId: "OBJ-FINANCING-ENTITY", label: "行动目标稳定身份", exact: "UNIT-553", unit: "", status: "已确认" },
        { id: "primary-institution", object: "单位553", resourceId: "LINK-FINANCING-INSTITUTION", label: "首要机构", exact: "欧陆银行", unit: "第1位", status: "优先级 1" },
        { id: "problem-balance", object: "单位553", resourceId: "MET-FIN-BALANCE", label: "问题余额", exact: "99.586", unit: "亿元", status: "可计算" },
        { id: "contribution", object: "单位553", resourceId: "RULE-HIGH-COST", label: "成本贡献", exact: "32.754", unit: "%", status: "可计算" },
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
    { ...evidenceRefsFor("group-overview", `${rowId}-structure-total`), type: "融资结构合计", resourceId: "MET-FLOATING-RATE-SHARE", object, exact: "100", unit: "%", status: "可计算" },
    { ...evidenceRefsFor("group-overview", `${rowId}-floating`), type: "融资结构分段", resourceId: "MET-FLOATING-RATE-SHARE", object, label: "浮动利率", exact: String(floating), unit: "%", status: "可计算" },
    { ...evidenceRefsFor("group-overview", `${rowId}-fixed`), type: "融资结构分段", resourceId: "MET-FLOATING-RATE-SHARE", object, label: "固定利率", exact: String(fixed), unit: "%", status: "可计算" }
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
    ruleMetricResourceIds: ["RULE-HIGH-COST", "MET-FIN-BALANCE", "MET-WAVG-COST"],
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
    { ...evidenceRefsFor("institution-priority", "bank-1-loans"), type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "欧陆银行", label: "必要借据证据", exact: "LOAN-004842、LOAN-004791", unit: "", status: "可追溯", detail: "只保留本轮行动请求所需的借据稳定身份。" },
    { ...evidenceRefsFor("institution-priority", "bank-2-loans"), type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "寰宇银行", label: "必要借据证据", exact: "LOAN-003206、LOAN-003241", unit: "", status: "可追溯", detail: "只保留本轮行动请求所需的借据稳定身份。" },
    { ...evidenceRefsFor("institution-priority", "bank-3-loans"), type: "借据集合", resourceId: "OBJ-FINANCING-DETAIL", object: "海联银行", label: "必要借据证据", exact: "LOAN-002118、LOAN-002164", unit: "", status: "可追溯", detail: "只保留本轮行动请求所需的借据稳定身份。" },
    { ...evidenceRefsFor("institution-priority", "owner-unit-553"), type: "负责人关系", resourceId: "LINK-ENTITY-OWNER", object: "单位553", label: "责任承接", exact: "OWNER-001 · 融资负责人001", unit: "", status: "可追溯", detail: "负责人只作为行动请求证据引用，不在智能问数中形成待办。" }
  ];

  const queryDefinition = (templateId) => {
    const template = RESULT_TEMPLATES[templateId];
    return {
      scene: "集团融资成本与债务结构优化",
      sceneId: "S001",
      sceneVersion: null,
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
    actionContext.institutionBindings = (actionContext.institutionBindings || []).map((binding) => ({
      ...binding,
      institutionEvidenceId: evidenceByItem[binding.institutionResultItemId] || null,
      loanEvidenceId: evidenceByItem[binding.loanResultItemId] || null
    }));
    actionContext.institutionStableIds = actionContext.institutionBindings.map((binding) => binding.institutionStableId);
    actionContext.institutionEvidenceIds = actionContext.institutionBindings.map((binding) => binding.institutionEvidenceId).filter(Boolean);
    actionContext.loanStableIds = actionContext.institutionBindings.flatMap((binding) => binding.loanStableIds || []);
    actionContext.loanEvidenceIds = actionContext.institutionBindings.map((binding) => binding.loanEvidenceId).filter(Boolean);
    actionContext.ownerBinding = {
      ...(actionContext.ownerBinding || {}),
      ownerEvidenceId: evidenceByItem[actionContext.ownerBinding?.ownerResultItemId] || null
    };
    actionContext.ownerEvidenceId = actionContext.ownerBinding.ownerEvidenceId;
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
      candidateConsumptionValidation: { status: "未开始", attempts: [], activeRun: null },
      draftQuestion: "",
      preferredDisplay: { mode: "text", chart: "recommended", reducedMotion: false },
      currentScenario: "S001",
      scenarioContext: {
        id: "S001",
        name: "集团融资成本与债务结构优化",
        version: null,
        source: "平台场景清单",
        status: "场景版本待读取"
      },
      ui: { resourceView: "cards", historyFilter: "全部", viewMode: "cards" }
    };
  }

  function loadState(storageKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      if (!parsed || parsed.schemaVersion !== STATE_SCHEMA_VERSION) return createInitialState();
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
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function resetState(storageKey) {
    localStorage.removeItem(storageKey);
    return createInitialState();
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

  function resourceContractFingerprint(resources) {
    const contracts = (resources || []).map(normalizedResourceContract).sort((left, right) => left.id.localeCompare(right.id));
    return `RC-${stableDigest(contracts)}`;
  }

  function projectPublishedResource(resource) {
    if (!resource) return null;
    const listOrNull = (value) => Array.isArray(value) ? clone(value) : null;
    const safeEndpoint = (endpoint, objectId) => endpoint ? {
      kind: endpoint.kind || null,
      objectId: objectId || null,
      memberId: endpoint.memberId || null,
      propertyId: endpoint.kind === "property" ? endpoint.id || null : null
    } : null;
    return {
      id: resource.id || null, type: resource.type || null, name: resource.name || null, definition: resource.definition || null,
      owner: resource.owner || null,
      memberId: resource.memberId || null, parentId: resource.parentId || null, objectId: resource.objectId || null,
      sourceObjectId: resource.sourceObjectId || null, subjectObjectId: resource.subjectObjectId || null,
      targetObjectId: resource.targetObjectId || null, source: resource.source || null, target: resource.target || null,
      sourceEndpoint: safeEndpoint(resource.sourceEndpoint, resource.source),
      targetEndpoint: safeEndpoint(resource.targetEndpoint, resource.target),
      endpointCompatible: typeof resource.endpointCompatible === "boolean" ? resource.endpointCompatible : null,
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
      terms: resource.terms ? { preferredName: resource.terms.preferredName || null, synonyms: listOrNull(resource.terms.synonyms) } : null
    };
  }

  function rawPublishedVersionForContext(context) {
    if (!context?.versionId) return null;
    const stored = readStoredJson(ONTOLOGY_STORAGE_KEY, "本体管理");
    if (!stored.ok) return null;
    const versions = Array.isArray(stored.value.publishedVersions) ? stored.value.publishedVersions : [];
    return versions.find((item) => item.id === context.versionId && item.ontologyStableId === ACTIVE_ONTOLOGY_ID) || null;
  }

  function findVersionRecord(state, versionId, contractCode, dataVersion) {
    const records = Array.isArray(state.recordsByVersion?.[versionId]) ? state.recordsByVersion[versionId] : [];
    return records.slice().reverse().find((record) => {
      const codes = String(record.contractCode || "").split(/\s*\/\s*/).filter(Boolean);
      return codes.includes(contractCode) && (!dataVersion || record.dataVersion === dataVersion);
    }) || null;
  }

  function findT019Record(state, version, binding) {
    if (!version?.id || !binding?.dataVersion) return null;
    const records = Array.isArray(state.recordsByVersion?.[version.id]) ? state.recordsByVersion[version.id] : [];
    return records.slice().reverse().find((record) => {
      if (record.resourceRef !== "T019" || record.formsContract !== true || record.status !== "成功") return false;
      if (!record.evidenceCode || record.semanticVersion !== version.semanticVersion || record.dataVersion !== binding.dataVersion) return false;
      if (record.decisionRef !== "D034") return false;
      const validation = binding.candidateValidationReference || null;
      if (validation?.status !== "passed" || validation?.contractCode !== "C008" || validation?.decisionRef !== "D064") return false;
      if (!validation?.runId || record.externalRunId !== validation.runId) return false;
      if (!binding.validationEvidenceRef || record.externalEvidenceRef !== binding.validationEvidenceRef) return false;
      if (!validation.evidenceLocator || record.externalEvidenceRef !== validation.evidenceLocator) return false;
      if (record.externalValidationContractRef !== "C008") return false;
      return true;
    }) || null;
  }

  function t019AdoptionIssues(state, version, binding) {
    if (!version?.id || !binding?.dataVersion) return ["正式消费组合缺少精确语义版本或数据版本"];
    const records = Array.isArray(state.recordsByVersion?.[version.id]) ? state.recordsByVersion[version.id] : [];
    const candidate = records.slice().reverse().find((record) =>
      record.resourceRef === "T019" &&
      record.status === "成功" &&
      record.semanticVersion === version.semanticVersion &&
      record.dataVersion === binding.dataVersion
    );
    if (!candidate) return ["没有成功且同版本的正式采用记录"];
    const validation = binding.candidateValidationReference || null;
    const issues = [];
    if (candidate.formsContract !== true || !candidate.evidenceCode) issues.push("正式采用记录没有形成可定位证据");
    if (candidate.decisionRef !== "D034") issues.push("正式采用记录缺少权威切换依据");
    if (candidate.externalValidationContractRef !== "C008") issues.push("正式采用记录没有引用候选固定题验证合同");
    if (validation?.status !== "passed" || validation?.contractCode !== "C008" || validation?.decisionRef !== "D064") issues.push("正式绑定中的候选固定题验证引用不完整");
    if (!validation?.runId || candidate.externalRunId !== validation.runId) issues.push("正式采用记录与候选验证运行不一致");
    if (!validation?.evidenceLocator || !binding.validationEvidenceRef || candidate.externalEvidenceRef !== validation.evidenceLocator || binding.validationEvidenceRef !== validation.evidenceLocator) issues.push("正式采用记录与候选验证证据定位不一致");
    return issues;
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
    if (endpoint.kind === "property") return (Array.isArray(version.properties) ? version.properties : []).some((item) => item.id === endpoint.id && item.parentId === objectId);
    if (endpoint.kind === "assetField") {
      const object = (Array.isArray(version.objects) ? version.objects : []).find((item) => item.id === objectId);
      const members = collectionValues(version.dataContract?.members);
      return Boolean(object?.memberId && endpoint.memberId === object.memberId && members.some((member) => {
        if ((member.id || member.stableId) !== endpoint.memberId) return false;
        const fieldIds = collectionValues(member.fields).map((field) => Array.isArray(field) ? field[3] : field.id || field.stableId || field.fieldId).filter(Boolean);
        return fieldIds.includes(endpoint.id) || (Array.isArray(member.fieldIds) && member.fieldIds.includes(endpoint.id));
      }));
    }
    return false;
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
    RESOURCES.forEach((expected) => {
      const actual = byId[expected.id];
      if (!actual) {
        problems.push(`${expected.id} 未出现在精确已发布版本中`);
        return;
      }
      if (actual.type !== expected.type) problems.push(`${expected.id} 的资源类型已变化`);
      if (expected.type === "Object Type") {
        if (!actual.identity || !actual.title || byId[actual.identity]?.type !== "Property" || byId[actual.title]?.type !== "Property" || byId[actual.identity]?.parentId !== actual.id || byId[actual.title]?.parentId !== actual.id) {
          problems.push(`${expected.id} 的身份或标题 Property 不完整`);
        }
      }
      if (expected.type === "Property" && (!actual.parentId || byId[actual.parentId]?.type !== "Object Type")) problems.push(`${expected.id} 的所属 Object 不完整`);
      if (expected.type === "Property" && !actual.nullable) problems.push(`${expected.id} 的空值约束不完整`);
      if (expected.type === "Link Type" && (!byId[actual.source] || !byId[actual.target] || !endpointBelongsToObject(version, actual.sourceEndpoint, actual.source) || !endpointBelongsToObject(version, actual.targetEndpoint, actual.target))) problems.push(`${expected.id} 的端点对象或稳定端点不可定位`);
      if (expected.type === "Link Type" && (!actual.reverseName || !actual.coverage)) problems.push(`${expected.id} 的反向业务名称或覆盖约束不完整`);
      if (expected.type === "Metric") {
        if (actual.unit !== expected.unit) problems.push(`${expected.id} 的单位与配置期望不一致`);
        if (!actual.scope || !actual.time || !actual.calculation || !actual.zeroHandling || !(actual.dependencyIds || []).length || actual.dependencyIds.some((id) => !byId[id] || !["Property", "Link Type"].includes(byId[id].type))) problems.push(`${expected.id} 的范围、时间语义、计算约束、零值处理或依赖不完整`);
      }
      if (expected.type === "Rule" && (!actual.appliesTo || !actual.objectId || byId[actual.objectId]?.type !== "Object Type" || !actual.condition || !actual.validity || !actual.testSample || !actual.bankRanking || !actual.evidence || !(actual.metricIds || []).length || actual.metricIds.some((id) => byId[id]?.type !== "Metric") || actual.businessBasis === "recommended")) {
        problems.push(`${expected.id} 的适用对象、Metric 依赖或业务口径状态不满足正式问数`);
      }
      if (expected.type === "Action Type" && (actual.targetObjectId !== "OBJ-FINANCING-ENTITY" || byId[actual.targetObjectId]?.type !== "Object Type" || !actual.parameters || !actual.prerequisite || !actual.result || !actual.failure || !actual.defaultDue || !(actual.ruleIds || []).length || actual.ruleIds.some((id) => byId[id]?.type !== "Rule") || (actual.linkIds || []).some((id) => byId[id]?.type !== "Link Type") || !/人工确认/.test(String(actual.confirmation || actual.requirement || "")))) {
        problems.push(`${expected.id} 的目标、Rule 依赖或人工确认合同不完整`);
      }
    });
    return [...new Set(problems)];
  }

  function recordIsSuccessful(record, acceptedStatuses) {
    return Boolean(record?.id && record?.evidenceCode && acceptedStatuses.includes(String(record.status || "")));
  }

  function combinationIncidentFor(state, version, binding) {
    const key = `${version?.id || ""}|${binding?.dataVersion || ""}`;
    const exact = state.combinationIncidents?.[key] || null;
    const legacy = state.qualityIncidentsByVersion?.[version?.id] || null;
    if (exact?.status === "blocked") return exact;
    return legacy?.status === "blocked" && (!legacy.dataVersion || legacy.dataVersion === binding?.dataVersion) ? legacy : null;
  }

  function locateCurrentPublishedContext() {
    const stored = readStoredJson(ONTOLOGY_STORAGE_KEY, "本体管理");
    if (!stored.ok) {
      if (stored.missing) {
        return {
          ok: false,
          status: "尚未发布",
          reason: `已知本体目录为 ${ONTOLOGY_INITIAL_CATALOG.draftCount} 个 Draft、${ONTOLOGY_INITIAL_CATALOG.publishedCount} 个 Published，但当前页面未取得可核对的精确已发布状态`,
          recovery: "先打开本体管理并确认精确已发布版本；正式问数还必须取得权威数据绑定。",
          drafts: ONTOLOGY_INITIAL_CATALOG.draftCount,
          published: ONTOLOGY_INITIAL_CATALOG.publishedCount
        };
      }
      return { ok: false, status: "不可读取", reason: stored.reason, recovery: "前往本体管理核对已发布版本与当前正式组合后重试。" };
    }
    const state = stored.value;
    if (!Array.isArray(state.publishedVersions) || !state.currentFormalVersionIdsByOntology || typeof state.currentFormalVersionIdsByOntology !== "object" || !state.bindingsByVersion || typeof state.bindingsByVersion !== "object") {
      return { ok: false, status: "不可读取", reason: "本体管理状态结构不完整，无法安全定位精确已发布版本与当前正式组合", recovery: "前往本体管理恢复完整的已发布版本与权威绑定后重试。" };
    }
    const versions = (state.publishedVersions || []).filter((item) => item.ontologyStableId === ACTIVE_ONTOLOGY_ID);
    if (!versions.length) return { ok: false, status: "尚未发布", reason: "融资语义仍未进入已发布目录", recovery: "在本体管理完成校验与发布；发布不等于正式数据已切换。", drafts: state.drafts?.length || 0 };
    const currentId = state.currentFormalVersionIdsByOntology?.[ACTIVE_ONTOLOGY_ID] || null;
    const version = versions.find((item) => item.id === currentId) || null;
    if (!version) {
      const selected = versions.find((item) => item.id === state.selectedVersionId) || (versions.length === 1 ? versions[0] : null);
      const selectedResources = selected ? allPublishedResources(selected) : [];
      return {
        ok: false,
        status: "等待正式绑定",
        reason: "已有已发布语义版本，但没有该本体的当前正式组合",
        recovery: selected ? "已发布目录仍可按所选精确版本只读查看；正式问数需等待本体管理完成权威数据绑定。" : "先在本体管理明确选择一个精确已发布版本；不得自动采用最近发布版本。",
        state,
        version: selected,
        resources: selectedResources,
        projectedResources: selectedResources.map(projectPublishedResource).filter(Boolean),
        endpointContract: projectEndpointContract(selected?.dataContract),
        endpointContractFingerprint: endpointContractFingerprint(selected?.dataContract),
        missingIds: selected ? RESOURCES.map((item) => item.id).filter((id) => !selectedResources.some((resource) => resource.id === id)) : [],
        duplicateIds: selected ? [...new Set(selectedResources.map((item) => item.id).filter((id, index, all) => id && all.indexOf(id) !== index))] : [],
        linkProblems: selected ? linkDirectionProblems(selected) : [],
        contractProblems: selected ? publishedContractProblems(selected) : []
      };
    }
    const requiredCollections = ["objects", "properties", "links", "metrics", "rules", "actions"];
    const collectionProblem = requiredCollections.find((key) => !Array.isArray(version[key]));
    if (collectionProblem) return { ok: false, status: "上下文不完整", reason: `精确已发布版本缺少完整的 ${collectionProblem} 资源快照`, recovery: "在本体管理恢复该精确版本的完整资源快照后重新装配。", version };
    const binding = state.bindingsByVersion?.[version.id]?.current || null;
    const resources = allPublishedResources(version);
    const resourceIds = resources.map((item) => item.id).filter(Boolean);
    const duplicateIds = [...new Set(resourceIds.filter((id, index) => resourceIds.indexOf(id) !== index))];
    const missingIds = RESOURCES.map((item) => item.id).filter((id) => !resourceIds.includes(id));
    const linkProblems = linkDirectionProblems(version);
    const contractProblems = publishedContractProblems(version);
    const projectedResources = resources.map(projectPublishedResource);
    const endpointContract = projectEndpointContract(version.dataContract);
    const endpointContractFingerprintValue = endpointContractFingerprint(version.dataContract);
    return {
      ok: true, state, version, binding,
      incident: binding ? combinationIncidentFor(state, version, binding) : null,
      resources, projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue,
      missingIds, duplicateIds, linkProblems, contractProblems
    };
  }

  function readCandidateConsumptionContext() {
    const stored = readStoredJson(ONTOLOGY_STORAGE_KEY, "本体管理");
    if (!stored.ok) return {
      status: stored.missing ? "暂无候选" : "不可读取",
      ready: false,
      reason: stored.missing ? "本体管理尚未形成可供智能问数隔离验证的候选消费上下文" : stored.reason,
      recovery: "在本体管理选择精确 Published 版本，并完成候选数据匹配与消费验证资格检查。",
      ontologyId: ACTIVE_ONTOLOGY_ID,
      readOnly: true,
      readAt: nowText()
    };

    const state = stored.value;
    const versions = Array.isArray(state.publishedVersions)
      ? state.publishedVersions.filter((version) => version.ontologyStableId === ACTIVE_ONTOLOGY_ID)
      : [];
    const updatesByVersion = state.updatesByVersion && typeof state.updatesByVersion === "object"
      ? state.updatesByVersion
      : {};
    const candidates = versions.map((version) => ({ version, update: updatesByVersion[version.id] || null })).filter(({ update }) => update);

    if (!candidates.length) return {
      status: versions.length ? "暂无候选" : "尚未发布",
      ready: false,
      reason: versions.length ? "当前融资本体没有待验证的候选数据上下文" : "融资语义尚未形成精确 Published 版本",
      recovery: versions.length ? "等待本体管理接收并完成候选数据匹配。" : "先在本体管理完成语义发布，再处理候选数据更新。",
      ontologyId: ACTIVE_ONTOLOGY_ID,
      readOnly: true,
      readAt: nowText()
    };

    const selectedCandidate = candidates.find(({ version }) => version.id === state.selectedVersionId) || (candidates.length === 1 ? candidates[0] : null);
    if (!selectedCandidate) return {
      status: "候选待选择",
      ready: false,
      reason: "存在多个 Published 版本的候选数据，无法静默选择候选双版本",
      recovery: "在本体管理明确选择要验证的精确 Published 版本后重新读取。",
      ontologyId: ACTIVE_ONTOLOGY_ID,
      candidateOptions: candidates.map(({ version, update }) => ({
        versionId: version.id,
        semanticVersion: version.semanticVersion,
        updateId: update.id,
        dataVersion: update.dataVersion,
        asOf: update.asOf,
        phase: update.phase
      })),
      readOnly: true,
      readAt: nowText()
    };

    const { version, update } = selectedCandidate;
    const c029Record = findVersionRecord(state, version.id, "C029", update.dataVersion);
    const t018Record = findVersionRecord(state, version.id, "T018", update.dataVersion);
    const recordMatches = (record) => record?.semanticVersion === version.semanticVersion && record?.dataVersion === update.dataVersion;
    const c029Valid = recordIsSuccessful(c029Record, ["成功"]) && recordMatches(c029Record);
    const t018Valid = recordIsSuccessful(t018Record, ["具备条件", "成功"]) && recordMatches(t018Record);
    const phaseLabels = {
      eligible: "具备消费验证条件",
      verify_failed: "可关联重试",
      verifying: "验证结果处理中",
      verified: "候选验证已形成",
      adopted: "已由本体管理采用"
    };
    const phaseReady = ["eligible", "verify_failed"].includes(update.phase);
    const eligibilityReady = update.eligibility?.status === "eligible" && Boolean(update.eligibility.checkedAt);
    const identityComplete = Boolean(version.id && version.semanticVersion && update.id && update.dataVersion && update.asOf);
    const resources = allPublishedResources(version);
    const projectedResources = resources.map(projectPublishedResource).filter(Boolean);
    const resourceIds = resources.map((item) => item.id).filter(Boolean);
    const duplicateIds = [...new Set(resourceIds.filter((id, index) => resourceIds.indexOf(id) !== index))];
    const requiredIds = [...new Set(CANDIDATE_VALIDATION_QUESTIONS.flatMap((item) => RESULT_TEMPLATES[item.templateId]?.resourceIds || []))];
    const missingIds = requiredIds.filter((id) => !resourceIds.includes(id));
    const linkProblems = linkDirectionProblems(version);
    const contractProblems = publishedContractProblems(version);
    const evidenceProjection = (record) => record ? {
      recordId: record.id || null,
      status: record.status || null,
      time: record.time || null,
      evidenceCode: record.evidenceCode || null,
      semanticVersion: record.semanticVersion || null,
      dataVersion: record.dataVersion || null
    } : null;
    const eligibilityEvidence = {
      eligibility: clone(update.eligibility || null),
      c029: evidenceProjection(c029Record),
      t018: evidenceProjection(t018Record)
    };
    const semanticContractReady = !missingIds.length && !duplicateIds.length && !linkProblems.length && !contractProblems.length;
    const ready = Boolean(phaseReady && eligibilityReady && identityComplete && c029Valid && t018Valid && semanticContractReady);
    const eligibilityEvidenceSummary = [
      eligibilityEvidence.c029?.evidenceCode || eligibilityEvidence.c029?.recordId,
      eligibilityEvidence.t018?.evidenceCode || eligibilityEvidence.t018?.recordId
    ].filter(Boolean).join(" · ") || null;
    const inputFingerprint = `CAND-${stableDigest({
      ontologyId: ACTIVE_ONTOLOGY_ID,
      versionId: version.id,
      semanticVersion: version.semanticVersion,
      dataVersion: update.dataVersion,
      asOf: update.asOf,
      updateId: update.id,
      eligibilityCheckedAt: update.eligibility?.checkedAt || null,
      eligibilityEvidence,
      resourceContractFingerprint: resources.length ? resourceContractFingerprint(resources) : null,
      endpointContractFingerprint: endpointContractFingerprint(version.dataContract)
    })}`;

    return {
      status: ready ? (update.phase === "verify_failed" ? "可关联重试" : "可开始候选验证") : phaseReady ? "候选资格不完整" : "候选尚不可验证",
      ready,
      reason: ready ? "" : !phaseReady ? "候选尚未进入可验证阶段" : !identityComplete ? "候选双版本身份或数据截至时间不完整" : !eligibilityReady ? "候选缺少完整的消费验证资格结论" : !c029Valid ? "候选缺少同一双版本的数据匹配证据" : !t018Valid ? "候选缺少同一双版本的消费验证资格证据" : missingIds.length ? `候选已发布语义缺少 ${missingIds.length} 项必需资源` : duplicateIds.length ? "候选已发布语义存在重复稳定身份" : linkProblems[0] || contractProblems[0] || "候选语义合同不完整",
      recovery: ready ? "" : "返回本体管理完成当前候选的匹配与资格检查；不得改用当前正式消费组合或其他候选。",
      ontologyId: ACTIVE_ONTOLOGY_ID,
      versionId: version.id,
      semanticVersion: version.semanticVersion,
      dataVersion: update.dataVersion,
      asOf: update.asOf,
      updateId: update.id,
      candidateKey: `${version.id}|${version.semanticVersion}|${update.dataVersion}|${update.asOf}|${update.candidateRevision || 1}`,
      phase: update.phase,
      phaseLabel: phaseLabels[update.phase] || "候选处理中",
      eligibilityEvidence,
      eligibilityEvidenceSummary,
      inputFingerprint,
      resources: projectedResources,
      resourceContractFingerprint: resources.length ? resourceContractFingerprint(resources) : null,
      endpointContract: projectEndpointContract(version.dataContract),
      endpointContractFingerprint: endpointContractFingerprint(version.dataContract),
      missingIds,
      duplicateIds,
      linkProblems,
      contractProblems,
      readOnly: true,
      readAt: nowText()
    };
  }

  function readPublishedOntologyContext() {
    const located = locateCurrentPublishedContext();
    if (!located.ok) {
      const version = located.version?.ontologyStableId === ACTIVE_ONTOLOGY_ID ? located.version : null;
      const rawResources = located.resources || (version ? allPublishedResources(version) : []);
      const resources = located.projectedResources || rawResources.map(projectPublishedResource).filter(Boolean);
      const discoverable = Boolean(version?.id && version?.semanticVersion && resources.length);
      const linkProblems = located.linkProblems || [];
      const contractProblems = located.contractProblems || [];
      const semanticReason = linkProblems[0]?.reason || contractProblems[0] || located.reason || "精确已发布语义版本尚未形成完整运行上下文";
      return {
        status: located.status || "不可读取",
        ready: false,
        semanticReady: false,
        discoverable,
        formalAnswerable: false,
        answerabilityStatus: "正式问数暂不可用",
        answerabilityReason: semanticReason,
        blocked: false,
        reason: semanticReason,
        recovery: located.recovery || "前往本体管理核对精确已发布版本后重试。",
        ontologyId: version?.ontologyStableId || ACTIVE_ONTOLOGY_ID,
        versionId: version?.id || null,
        semanticVersion: version?.semanticVersion || null,
        resources,
        endpointContract: located.endpointContract || null,
        endpointContractFingerprint: located.endpointContractFingerprint || null,
        missingIds: located.missingIds || [],
        duplicateIds: located.duplicateIds || [],
        linkProblems,
        contractProblems,
        resourceContractFingerprint: rawResources.length ? resourceContractFingerprint(rawResources) : null,
        readAt: nowText()
      };
    }
    const { version, binding, incident, projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue, missingIds, duplicateIds, linkProblems, contractProblems } = located;
    const semanticIssues = [
      ...(missingIds.length ? [`缺少 ${missingIds.length} 项问数配置所需资源`] : []),
      ...(duplicateIds.length ? ["存在重复稳定资源身份"] : []),
      ...linkProblems.map((item) => item.reason),
      ...contractProblems
    ];
    const semanticReady = semanticIssues.length === 0;
    const discoverable = Boolean(version.id && version.semanticVersion && projectedResources.length);
    const runtime = semanticReady ? readRuntimeContext() : null;
    return {
      status: semanticIssues.length ? "语义不完整" : "已发布",
      ready: semanticReady, semanticReady, discoverable,
      formalAnswerable: runtime?.ready === true,
      answerabilityStatus: runtime?.ready ? "可正式问数" : runtime?.status || "正式问数暂不可用",
      answerabilityReason: runtime?.ready ? "" : runtime?.reason || semanticIssues[0] || "运行上下文尚未完整",
      blocked: Boolean(incident), consumptionStatus: incident ? "当前组合不可消费" : binding ? "等待数据可信度核对" : "正式数据未绑定",
      reason: semanticIssues[0] || incident?.reason || incident?.detail || "",
      recovery: semanticIssues.length ? "在本体管理修复并重新发布完整语义版本。" : incident?.recovery || "",
      ontologyId: version.ontologyStableId, versionId: version.id, semanticVersion: version.semanticVersion,
      dataVersion: binding?.dataVersion || null, asOf: binding?.asOf || null,
      resources: projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue,
      missingIds, duplicateIds, linkProblems, contractProblems,
      resourceContractFingerprint: resourceContractFingerprint(located.resources),
      readAt: nowText()
    };
  }

  function readOntologyBindingContext() {
    const located = locateCurrentPublishedContext();
    if (!located.ok) {
      const version = located.version?.ontologyStableId === ACTIVE_ONTOLOGY_ID ? located.version : null;
      const rawResources = located.resources || (version ? allPublishedResources(version) : []);
      const linkProblems = located.linkProblems || [];
      const contractProblems = located.contractProblems || [];
      const semanticReason = linkProblems.length ? "已发布关系的导航方向或连接对象与当前问数范围不一致" : contractProblems[0] || located.reason || "当前精确已发布版本无法定位";
      return {
        status: located.status || "不可读取",
        ready: false,
        blocked: false,
        reason: semanticReason,
        recovery: located.recovery || "前往本体管理核对精确已发布版本与当前正式组合后重试。",
        ontologyId: version?.ontologyStableId || ACTIVE_ONTOLOGY_ID,
        versionId: version?.id || null,
        semanticVersion: version?.semanticVersion || null,
        resources: rawResources.map(projectPublishedResource).filter(Boolean),
        endpointContract: located.endpointContract || projectEndpointContract(version?.dataContract),
        endpointContractFingerprint: located.endpointContractFingerprint || endpointContractFingerprint(version?.dataContract),
        resourceContractFingerprint: rawResources.length ? resourceContractFingerprint(rawResources) : null,
        missingIds: located.missingIds || [],
        duplicateIds: located.duplicateIds || [],
        linkProblems,
        contractProblems,
        evidenceComplete: false,
        readAt: nowText()
      };
    }
    const { state, version, binding, incident, resources, projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue, missingIds, duplicateIds, linkProblems, contractProblems } = located;
    if (!binding) return {
      status: "上下文不完整", ready: false, reason: "当前精确语义版本缺少正式数据绑定",
      recovery: "返回本体管理的精确已发布版本核对更新、回退与正式切换。",
      ontologyId: version.ontologyStableId, versionId: version.id, semanticVersion: version.semanticVersion,
      resources: projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue, resourceContractFingerprint: resourceContractFingerprint(resources)
    };
    if (incident) return {
      status: "不可消费", ready: false, blocked: true,
      reason: incident.reason || incident.detail || "当前权威组合已登记质量阻断",
      recovery: incident.recovery || "在上游完成质量修复并形成新的完整权威组合后重新运行；不得自动改用候选或最新版本。",
      ontologyId: version.ontologyStableId, versionId: version.id, semanticVersion: version.semanticVersion,
      dataVersion: binding.dataVersion, asOf: binding.asOf,
      resources: projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue, resourceContractFingerprint: resourceContractFingerprint(resources)
    };
    const c029Record = findVersionRecord(state, version.id, "C029", binding.dataVersion);
    const t018Record = findVersionRecord(state, version.id, "T018", binding.dataVersion);
    const t019Record = findT019Record(state, version, binding);
    const t019Issues = t019AdoptionIssues(state, version, binding);
    const bindingComplete = Boolean(binding.semanticVersion === version.semanticVersion && binding.dataVersion && binding.asOf && binding.switchedAt);
    const recordMatches = (record) => record?.semanticVersion === version.semanticVersion && record?.dataVersion === binding.dataVersion;
    const c029Valid = recordIsSuccessful(c029Record, ["成功"]) && recordMatches(c029Record);
    const t018Valid = recordIsSuccessful(t018Record, ["具备条件", "成功"]) && recordMatches(t018Record);
    const t019RecordValid = Boolean(t019Record && recordMatches(t019Record) && !t019Issues.length);
    const evidenceComplete = Boolean(bindingComplete && c029Valid && t018Valid && t019RecordValid && !missingIds.length && !duplicateIds.length && !contractProblems.length);
    if (linkProblems.length || missingIds.length || duplicateIds.length || contractProblems.length || !evidenceComplete) {
      return {
        status: "上下文不完整", ready: false,
        reason: linkProblems.length ? "已发布关系的导航方向或连接对象与当前问数范围不一致" : missingIds.length ? `精确已发布版本缺少 ${missingIds.length} 项融资问数必需资源` : duplicateIds.length ? "精确已发布版本存在重复稳定资源身份" : contractProblems.length ? contractProblems[0] : !c029Valid ? "缺少同一正式组合的数据匹配证据" : !t018Valid ? "缺少同一正式组合的消费验证资格证据" : t019Issues[0] || "没有成功且同版本的正式采用证据，无法证明版本与数据截至属于同一上下文",
        recovery: linkProblems.length ? "由本体管理修订并重新发布关系方向后，再由智能问数重新核对正式上下文。" : "核对精确已发布资源、数据匹配、消费资格、候选固定题验证与正式采用的完整证据链后重新装配。",
        ontologyId: version.ontologyStableId, versionId: version.id, semanticVersion: version.semanticVersion,
        dataVersion: binding.dataVersion, asOf: binding.asOf,
        switchedAt: binding.switchedAt || null,
        resources: projectedResources,
        endpointContract,
        endpointContractFingerprint: endpointContractFingerprintValue,
        resourceContractFingerprint: resourceContractFingerprint(resources),
        missingIds, duplicateIds, linkProblems, contractProblems,
        c029EvidenceCode: c029Record?.evidenceCode || null,
        t018EvidenceCode: t018Record?.evidenceCode || null,
        t019EvidenceCode: t019Record?.evidenceCode || null,
        evidenceComplete,
        readAt: nowText()
      };
    }
    const adoptedAt = t019Record.time;
    const t019Proof = {
      ontologyId: version.ontologyStableId,
      versionId: version.id,
      dataVersion: binding.dataVersion,
      switchedAt: adoptedAt
    };
    return {
      status: "语义与绑定完整", ready: true, ontologyId: version.ontologyStableId, versionId: version.id,
      semanticVersion: version.semanticVersion, dataVersion: binding.dataVersion, asOf: binding.asOf,
      switchedAt: adoptedAt, bindingSwitchedAt: binding.switchedAt,
      t019Ref: `${version.id} / ${binding.dataVersion} / ${adoptedAt}`, t019Proof,
      t019EvidenceCode: t019Record.evidenceCode,
      c029EvidenceCode: c029Record.evidenceCode, t018EvidenceCode: t018Record.evidenceCode,
      t019RecordId: t019Record.id, candidateValidationEvidenceProjection: binding.validationEvidenceRef,
      questionSetVersionProjection: binding.questionSetVersion || null,
      evidenceComplete, resources: projectedResources, endpointContract, endpointContractFingerprint: endpointContractFingerprintValue,
      resourceContractFingerprint: resourceContractFingerprint(resources), readAt: nowText()
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

  function readDataTrustContext(dataVersion) {
    const stored = readStoredJson(C017_PROJECTION_STORAGE_KEY, "数据可信度安全投影");
    if (!stored.ok) return { status: stored.missing ? "安全投影尚未形成" : "安全投影不可读取", ready: false, allowConsumption: false, dataEligibility: "无法判断", reason: stored.missing ? "数据工程尚未向智能问数交付可核对的数据可信度受限上下文" : stored.reason, recovery: "前往数据工程核对同一精确数据版本的可信度投影、权限和证据后重试。" };
    if (!dataVersion) return { status: "上下文不完整", ready: false, allowConsumption: false, dataEligibility: "无法判断", reason: "当前正式组合未提供精确数据版本", recovery: "先在本体管理核对当前正式绑定。" };
    const envelope = stored.value;
    if (envelope?.contractCode !== "C017" || envelope?.consumer !== "智能问数") return { status: "安全投影不适用", ready: false, allowConsumption: false, dataEligibility: "无法判断", dataVersion, reason: "当前投影不是面向智能问数的数据可信度受限上下文", recovery: "由数据工程重新形成面向智能问数的安全投影，不得改读完整数据工程工作区。" };
    const projections = Array.isArray(envelope.projections) ? envelope.projections : [];
    const projection = projections.find((item) => item?.dataVersion === dataVersion && item?.assetId === ACTIVE_DATA_ASSET_ID) || null;
    if (!projection) return { status: "版本不匹配", ready: false, allowConsumption: false, dataEligibility: "无法判断", dataVersion, reason: "数据可信度安全投影无法定位当前正式组合所指的精确数据版本", recovery: "核对数据工程安全投影与当前正式绑定，不得改用最新发布版本。" };
    const quality = isRecord(projection.quality) ? projection.quality : {};
    const freshness = isRecord(projection.freshness) ? projection.freshness : {};
    const evidence = isRecord(projection.evidence) ? projection.evidence : {};
    const evidenceIds = safeTextList(evidence.ids);
    const evidenceCategories = projectEvidenceCategories(evidence.categories);
    const qualityWarnings = Array.isArray(quality.warnings) ? quality.warnings.map(projectQualityWarning).filter(Boolean) : [];
    const contextId = safeText(projection.contextId);
    const contextVersion = safeText(projection.contextVersion);
    const formedAt = safeText(projection.formedAt);
    const projectedDataVersion = safeText(projection.dataVersion);
    const projectedAsOf = safeText(projection.asOf);
    const projectedPublishedAt = safeText(projection.publishedAt);
    const consistency = safeText(projection.consistency) || "无法判断";
    const qualityStatus = safeText(quality.status);
    const qualityEvidenceId = safeText(quality.evidenceId);
    const freshnessStatus = safeText(freshness.status);
    const freshnessBasis = safeText(freshness.basis);
    const freshnessEvidenceId = safeText(freshness.evidenceId);
    const shapeValid = Boolean(
      fieldsHaveTypes(projection, ["contextId", "contextVersion", "formedAt", "dataVersion", "assetId", "asOf", "asOfSource", "asOfPrecision", "timezone", "publishedAt", "lastSuccessfulAt", "consistency", "dataEligibility", "consumptionStatus"], ["allowConsumption"]) &&
      fieldsHaveTypes(projection.quality, ["status", "evidenceId"]) &&
      fieldsHaveTypes(projection.freshness, ["label", "status", "basis", "evidenceId"]) &&
      fieldsHaveTypes(projection.evidence, [], ["complete"]) &&
      Array.isArray(evidence.ids) && evidence.ids.every((item) => typeof item === "string" && item.trim()) &&
      (evidence.categories === undefined || (evidenceCategories && Object.keys(evidence.categories).filter((key) => ["version", "source", "quality", "members", "relationships", "refresh"].includes(key)).every((key) => typeof evidence.categories[key] === "boolean"))) &&
      (quality.warnings === undefined || (Array.isArray(quality.warnings) && qualityWarnings.length === quality.warnings.length && quality.warnings.every((item) => fieldsHaveTypes(item, ["status", "reason", "scopeSummary", "recovery", "evidenceId"])))) &&
      fieldsHaveTypes(projection.candidate, ["dataVersion", "asOf", "status", "phase", "reason", "recovery", "evidenceId"]) &&
      fieldsHaveTypes(projection.previousTrusted, ["dataVersion", "asOf", "status", "evidenceId"], ["consumable"]) &&
      fieldsHaveTypes(projection.refresh, ["requestId", "resultId", "status", "time", "phase", "failureReason", "recovery", "t018Eligibility", "evidenceId"])
    );
    const qualification = dataQualification(projection);
    const evidenceComplete = Boolean(shapeValid && contextId && contextVersion && formedAt && evidence.complete === true && evidenceIds.length);
    const ready = Boolean(shapeValid && qualification.allowed && projection.allowConsumption === true && projectedAsOf && evidenceComplete && consistency === "数据侧一致");
    return {
      status: ready ? (qualification.value === "带警告允许" ? "带警告允许" : "数据可信度完整") : qualification.value === "禁止" ? "不可消费" : "上下文不完整",
      ready, allowConsumption: ready, dataEligibility: qualification.value, dataVersion: projectedDataVersion, asOf: projectedAsOf,
      asOfSource: safeText(projection.asOfSource), asOfPrecision: safeText(projection.asOfPrecision), timezone: safeText(projection.timezone),
      publishedAt: projectedPublishedAt, lastSuccessfulAt: safeText(projection.lastSuccessfulAt),
      quality: qualityStatus || "无法判断", qualityEvidenceId,
      qualityWarnings,
      freshness: safeText(freshness.label) || freshnessStatus || "无法判断", freshnessStatus: freshnessStatus || "未知",
      freshnessBasis, freshnessEvidenceId,
      candidate: projectCandidateSummary(projection.candidate),
      previousTrusted: projectPreviousTrustedSummary(projection.previousTrusted),
      refresh: projectRefreshSummary(projection.refresh),
      evidenceIds, evidenceCategories, evidenceComplete, consistency,
      trustFingerprint: JSON.stringify({
        contextId, contextVersion, formedAt,
        dataVersion: projectedDataVersion, asOf: projectedAsOf, publishedAt: projectedPublishedAt,
        dataQualification: qualification.value, allowConsumption: projection.allowConsumption === true,
        qualityStatus, qualityEvidenceId,
        freshnessStatus, freshnessBasis,
        freshnessEvidenceId, evidenceIds
      }),
      reason: ready ? "" : !shapeValid ? "数据可信度安全投影包含类型不正确或无法安全解释的关键字段" : qualification.value === "禁止" ? "精确数据版本的数据侧资格禁止消费" : "数据可信度投影的时点、质量、新鲜度、一致性或证据上下文不完整",
      recovery: ready ? "" : "在数据工程补齐同一精确版本的安全投影；不得切换到候选、最新文件或完整工作区状态。",
      readAt: nowText()
    };
  }

  function runtimeContextFingerprint(context) {
    if (!context) return null;
    return JSON.stringify({
      ontologyId: context.ontologyId || null,
      versionId: context.versionId || null,
      semanticVersion: context.semanticVersion || null,
      dataVersion: context.dataVersion || null,
      asOf: context.asOf || null,
      switchedAt: context.switchedAt || null,
      t019RecordId: context.t019RecordId || null,
      t019EvidenceCode: context.t019EvidenceCode || null,
      candidateValidationEvidenceProjection: context.candidateValidationEvidenceProjection || null,
      questionSetVersionProjection: context.questionSetVersionProjection || null,
      c029EvidenceCode: context.c029EvidenceCode || null,
      t018EvidenceCode: context.t018EvidenceCode || null,
      resourceContractFingerprint: context.resourceContractFingerprint || null,
      endpointContractFingerprint: context.endpointContractFingerprint || `EP-${stableDigest(context.endpointContract || null)}`,
      dataTrustFingerprint: context.dataTrustFingerprint || context.dataTrust?.trustFingerprint || null,
      qualityEvidenceId: context.qualityEvidenceId || null,
      freshnessStatus: context.freshnessStatus || null,
      allowConsumption: context.allowConsumption === true,
      scenarioId: context.scenarioId || null,
      scenarioVersion: context.scenarioVersion || null
    });
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
      freshness: context.freshness, freshnessStatus: context.freshnessStatus,
      freshnessBasis: context.freshnessBasis, freshnessEvidenceId: context.freshnessEvidenceId,
      candidate: clone(context.candidate || null), previous: clone(context.previous || null), refresh: clone(context.refresh || null),
      evidenceIds: clone(context.evidenceIds || []), evidenceCategories: clone(context.evidenceCategories || null), lastSuccessfulAt: context.lastSuccessfulAt,
      consistencyProof: clone(context.consistencyProof || null), readAt: context.readAt,
      reason: context.reason || "", recovery: context.recovery || "",
      recoveryOwner: context.recoveryOwner || null,
      dataTrustFingerprint: context.dataTrustFingerprint || context.dataTrust?.trustFingerprint || null,
      scenarioId: context.scenarioId || null,
      scenarioVersion: context.scenarioVersion || null,
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
      scenarioId: scenarioContext?.id || config?.sceneId || null,
      scenarioVersion: scenarioContext?.version || config?.sceneVersion || null,
      scenarioName: scenarioContext?.name || config?.scene || null,
      scenarioReferenceStatus: scenarioContext?.status || config?.sceneVersionStatus || "场景版本待读取"
    };
    if (context.inputFingerprint) scoped.inputFingerprint = `${context.inputFingerprint}|SCENE:${scoped.scenarioId || "missing"}@${scoped.scenarioVersion || "missing"}`;
    scoped.runtimeContextFingerprint = runtimeContextFingerprint(scoped);
    return scoped;
  }

  function projectRuntimeContextForScenario(context, scenarioContext = null, config = null) {
    return attachScenarioContext(projectRuntimeContext(context), scenarioContext, config);
  }

  function readRuntimeContext() {
    const ontologyContext = readOntologyBindingContext();
    if (!ontologyContext.ready) return { ...ontologyContext, ontologyContext, dataTrust: null, allowConsumption: false, evidenceComplete: false, recoveryOwner: "ontology" };
    const dataTrust = readDataTrustContext(ontologyContext.dataVersion);
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
      freshness: dataTrust.freshness, freshnessStatus: dataTrust.freshnessStatus,
      freshnessBasis: dataTrust.freshnessBasis, freshnessEvidenceId: dataTrust.freshnessEvidenceId,
      candidate: dataTrust.candidate, previous: dataTrust.previousTrusted, refresh: dataTrust.refresh,
      evidenceIds: dataTrust.evidenceIds, evidenceCategories: dataTrust.evidenceCategories,
      lastSuccessfulAt: dataTrust.lastSuccessfulAt,
      consistencyProof: { semanticVersion: ontologyContext.semanticVersion, versionId: ontologyContext.versionId, dataVersion: ontologyContext.dataVersion, asOf: ontologyContext.asOf, t019Ref: ontologyContext.t019Ref, ontologyEvidenceComplete: ontologyContext.evidenceComplete, dataEvidenceComplete: dataTrust.evidenceComplete, dataConsistency: dataTrust.consistency, versionsMatch },
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
      validation.dataVersion === runtimeContext.dataVersion && validation.asOf === runtimeContext.asOf &&
      validation.t019EvidenceCode === runtimeContext.t019EvidenceCode &&
      validation.configFingerprint === config.contentFingerprint &&
      validation.resourceContractFingerprint === runtimeContext.resourceContractFingerprint &&
      validation.runtimeContextFingerprint === runtimeContext.runtimeContextFingerprint
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
    if (!ontologyContext?.scenarioId || !ontologyContext?.scenarioVersion || config?.sceneId !== ontologyContext?.scenarioId || config?.sceneVersion !== ontologyContext?.scenarioVersion) {
      issues.push({ gate: "场景", owner: "平台场景目录 / 智能问数", reason: "当前运行缺少同一 C021 场景身份与场景版本引用", recovery: "由平台场景目录提供 S001 的精确场景版本；智能问数重新读取后固定到配置和本轮上下文。" });
    }
    if (!ontologyContext?.ready) {
      if (!ontologyContext?.versionId) {
        issues.push({ gate: "Published 语义", owner: "本体管理", reason: ontologyContext?.reason || "当前没有可定位的精确 Published 语义版本", recovery: ontologyContext?.recovery || "在本体管理完成校验与发布后重新检查。" });
        issues.push({ gate: "正式消费组合", owner: "本体管理", reason: "当前没有可定位的权威消费绑定", recovery: "Published 形成后仍需由本体管理按完整门禁原子提交正式消费绑定；数据侧消费资格不能替代。" });
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
        validation.dataVersion === ontologyContext.dataVersion && validation.asOf === ontologyContext.asOf &&
        validation.t019EvidenceCode === ontologyContext.t019EvidenceCode &&
        validation.configFingerprint === config.contentFingerprint &&
        validation.resourceContractFingerprint === ontologyContext.resourceContractFingerprint &&
        validation.runtimeContextFingerprint === ontologyContext.runtimeContextFingerprint
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
    const required = ["version", "promptVersion", "whitelistVersion", "bindingVersionId", "semanticVersion", "contentFingerprint", "resourceContractFingerprint", "sceneId", "sceneVersion"];
    const missing = required.filter((key) => !config?.[key]);
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
      const sanitized = String(value ?? "").replace(/\b(?:OBJ|PROP|LINK|MET|RULE|ACTION|UNIT|INST|LOAN|OWNER|E)-[A-Za-z0-9_-]+\b/g, "");
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

    if (result?.actionContext) {
      const action = result.actionContext;
      const actionResourceIds = [action.actionTypeId, ...(action.ruleMetricResourceIds || [])].filter(Boolean);
      actionResourceIds.forEach((id) => {
        if (!resultResourceIds.has(id) || !resources.has(id) || !allowed.has(id)) issues.push(`行动上下文引用了结果资源范围之外的资源 ${id}`);
      });
      stableIdsIn(JSON.stringify(action)).forEach((id) => {
        if (!resultResourceIds.has(id)) issues.push(`行动上下文出现结果资源范围之外的稳定资源身份 ${id}`);
      });
      formalNumbers(JSON.stringify(action)).forEach((number) => {
        if (!trustedNumbers.has(number)) issues.push(`行动上下文出现固定结果之外的正式数值 ${number}`);
      });
      const trustedBusinessIdentities = new Set(allEvidence.flatMap((fact) => factScalars(fact).flatMap((value) => String(value).match(/\b(?:UNIT|INST|LOAN|OWNER)-[A-Za-z0-9-]+\b/g) || [])));
      const actionBusinessIdentities = JSON.stringify(action).match(/\b(?:UNIT|INST|LOAN|OWNER)-[A-Za-z0-9-]+\b/g) || [];
      actionBusinessIdentities.forEach((id) => {
        if (!trustedBusinessIdentities.has(id)) issues.push(`行动上下文出现固定结果之外的业务对象身份 ${id}`);
      });
      const actionEvidenceIds = [action.targetEvidenceId, ...(action.institutionEvidenceIds || []), ...(action.loanEvidenceIds || []), action.ownerEvidenceId].filter(Boolean);
      if (actionEvidenceIds.some((id) => !evidenceIds.has(id))) issues.push("行动上下文引用了本轮固定结果之外的证据");
      const targetFact = factByItemId.get(action.targetResultItemId);
      if (!targetFact || targetFact.resourceId !== "OBJ-FINANCING-ENTITY" || targetFact.exact !== action.singleTargetStableId || targetFact.evidenceId !== action.targetEvidenceId) issues.push("行动目标稳定身份未绑定本轮固定对象结果与证据");
      const bindings = Array.isArray(action.institutionBindings) ? action.institutionBindings : [];
      const boundInstitutionIds = bindings.map((binding) => binding.institutionStableId);
      const boundInstitutionEvidenceIds = bindings.map((binding) => binding.institutionEvidenceId);
      const boundLoanIds = bindings.flatMap((binding) => binding.loanStableIds || []);
      const boundLoanEvidenceIds = bindings.map((binding) => binding.loanEvidenceId);
      if (!bindings.length || new Set(boundInstitutionIds).size !== bindings.length || new Set(boundLoanIds).size !== boundLoanIds.length) issues.push("行动上下文的机构与借据显式绑定缺失或重复");
      if (JSON.stringify(boundInstitutionIds) !== JSON.stringify(action.institutionStableIds || []) || JSON.stringify(boundInstitutionEvidenceIds) !== JSON.stringify(action.institutionEvidenceIds || []) || JSON.stringify(boundLoanIds) !== JSON.stringify(action.loanStableIds || []) || JSON.stringify(boundLoanEvidenceIds) !== JSON.stringify(action.loanEvidenceIds || [])) issues.push("行动上下文的汇总身份或证据清单与逐机构绑定不一致");
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
      const targetLabel = action.singleTargetStableId ? `单位${action.singleTargetStableId.replace(/^UNIT-/, "")}` : null;
      if (!owner || owner.ownerStableId !== action.ownerStableId || owner.ownerEvidenceId !== action.ownerEvidenceId || owner.targetStableId !== action.singleTargetStableId || owner.relationResourceId !== "LINK-ENTITY-OWNER" || !ownerFact || ownerFact.resourceId !== owner.relationResourceId || ownerFact.evidenceId !== owner.ownerEvidenceId || ownerFact.object !== targetLabel || !factSupportsValue(ownerFact, owner.ownerStableId)) issues.push("行动上下文的主体、负责人和关系证据绑定不一致");
    }
    const identity = result?.contextIdentity || {};
    if (identity.versionId !== context?.versionId || identity.semanticVersion !== context?.semanticVersion || identity.dataVersion !== context?.dataVersion || identity.asOf !== context?.asOf || identity.scenarioId !== context?.scenarioId || identity.scenarioVersion !== context?.scenarioVersion) issues.push("结果身份与本轮固定上下文不一致");
    return { passed: issues.length === 0, issues: [...new Set(issues)] };
  }

  function validateFixedQuestionSet(config, context) {
    const structural = validateCandidateConfig(config, context);
    if (!structural.passed) return { passed: false, issues: structural.issues, questions: [] };
    const questions = RECOMMENDED_QUESTIONS.map((question, index) => {
      const runId = `CONFIG-CHECK-${String(index + 1).padStart(2, "0")}`;
      const template = RESULT_TEMPLATES[question.id];
      const gate = validateRunContext(context, { ...config, status: "已启用", compatibility: "兼容", c009Validation: {
        owner: "智能问数", status: "通过", versionId: context.versionId, semanticVersion: context.semanticVersion,
        dataVersion: context.dataVersion, asOf: context.asOf, t019EvidenceCode: context.t019EvidenceCode,
        configFingerprint: config.contentFingerprint, resourceContractFingerprint: context.resourceContractFingerprint,
        runtimeContextFingerprint: context.runtimeContextFingerprint
      } }, template);
      const result = gate.passed ? materializeResult(question.id, context, runId, { unitCodes: referencedUnitCodes(question.question), originalQuestion: question.question }) : null;
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
    const template = item ? RESULT_TEMPLATES[item.id] : null;
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
    if (templateId === "rule-explain" && ["RULE-HIGH-COST", "RULE-FLOATING-EXPOSURE", "RULE-SHORT-DEBT"].every(businessBasisConfirmed)) {
      fixed.summary = "三家单位分别命中不同规则：单位553命中融资成本偏高，单位465命中浮动利率暴露，单位561命中短期债务集中。本轮忠实展示当前已发布规则的正式求值结果。";
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
    fixed.fixedResultId = `${runId || fixed.id}-RESULT`;
    fixed.contextIdentity = {
      versionId: context.versionId,
      semanticVersion: context.semanticVersion,
      dataVersion: context.dataVersion,
      asOf: context.asOf,
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion
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
        : { passed: false, issues: ["未形成可核验的候选固定结构化结果"] };
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
    if (!current?.ready || !run.context?.runtimeContextFingerprint || current.runtimeContextFingerprint !== run.context.runtimeContextFingerprint) return { allowed: false, reason: "当前权威消费上下文已变化，请按当前版本重新运行后导出" };
    const output = verifyFixedResult(run.result, run.context, run.configSnapshot);
    if (!output.passed) return { allowed: false, reason: output.issues[0] };
    return { allowed: true, reason: "" };
  }

  function actionEligibility(run, config = null, scenarioContext = null) {
    if (run?.past || run?.context?.past) return { allowed: false, reason: "历史轮次只读；请按当前权威上下文重新运行后发起行动请求" };
    if (run?.status !== "成功" || !run?.result) return { allowed: false, reason: "只有成功形成的固定结果可以发起行动请求" };
    if (!run.context?.ready || run.context?.allowConsumption !== true || !run.context?.evidenceComplete) return { allowed: false, reason: "双版本、数据可信度或证据不完整" };
    const current = projectRuntimeContextForScenario(readRuntimeContext(), scenarioContext, config || run.configSnapshot);
    if (!current?.ready || !run.context?.runtimeContextFingerprint || current.runtimeContextFingerprint !== run.context.runtimeContextFingerprint) return { allowed: false, reason: "当前权威消费上下文已变化，请按当前版本重新运行后发起行动请求" };
    const action = run.result.actionContext;
    if (!action?.singleTargetStableId || run.result.scope?.length !== 1 || run.result.scope[0] === "集团") return { allowed: false, reason: "行动请求必须绑定一个已确认的非集团主体" };
    const effectiveConfig = config || run.configSnapshot;
    const actionResource = resourceFromContext(run.context, action.actionTypeId);
    if (actionResource?.type !== "Action Type" || !effectiveConfig?.allowedResources?.includes(action.actionTypeId) || !effectiveConfig?.allowedActions?.includes("提交标准 Action Request")) return { allowed: false, reason: "行动类型不在当前配置白名单、已发布资源包或后续操作范围内" };
    if (action.singleTargetStableId !== `UNIT-${String(run.result.scope[0]).replace(/\D/g, "")}`) return { allowed: false, reason: "行动目标稳定身份与本轮固定单一主体不一致" };
    const stableIds = new Set(run.result.resourceIds || []);
    if (!action.ruleMetricResourceIds?.length || action.ruleMetricResourceIds.some((id) => !stableIds.has(id))) return { allowed: false, reason: "缺少同版本 Rule 或 Metric 快照" };
    if (!action.institutionBindings?.length || !action.ownerBinding || !action.institutionEvidenceIds?.length || !action.loanEvidenceIds?.length || !action.ownerEvidenceId) return { allowed: false, reason: "机构、借据或负责人证据绑定不完整" };
    const evidenceIds = new Set([
      ...(run.result.rows || []).map((row) => row.evidenceId),
      ...(run.result.evidenceReferences || []).map((item) => item.evidenceId)
    ].filter(Boolean));
    const requiredEvidence = [...action.institutionEvidenceIds, ...action.loanEvidenceIds, action.ownerEvidenceId];
    if (requiredEvidence.some((id) => !evidenceIds.has(id))) return { allowed: false, reason: "行动上下文引用了本轮固定结果之外的证据" };
    const output = verifyFixedResult(run.result, run.context, effectiveConfig);
    if (!output.passed) return { allowed: false, reason: output.issues[0] };
    return { allowed: true, reason: "", actionContext: clone(action) };
  }

  function buildOntologyDeepLink(context, resourceId, tab = "overview") {
    if (!context?.versionId || !context?.resources?.some((item) => item.id === resourceId)) return null;
    const stored = readStoredJson(ONTOLOGY_STORAGE_KEY, "本体管理");
    if (!stored.ok) return null;
    const version = (stored.value.publishedVersions || []).find((item) => item.id === context.versionId && item.ontologyStableId === ACTIVE_ONTOLOGY_ID);
    if (!version || !allPublishedResources(version).some((item) => item.id === resourceId)) return null;
    return `${ONTOLOGY_ENTRY}#published/resource?version=${encodeURIComponent(context.versionId)}&id=${encodeURIComponent(resourceId)}&tab=${encodeURIComponent(tab)}`;
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
      { id: "combined-cost", object: "组合结果", resourceId: "MET-WAVG-COST", label: "综合平均融资成本", exact: combinedCost.toFixed(3), unit: "%", status: "可计算" },
      { id: "combined-balance", object: "组合结果", resourceId: "MET-FIN-BALANCE", label: "合计融资余额", exact: totalBalance.toFixed(3), unit: "亿元", status: "可计算" },
      { id: "object-count", object: "对象范围", resourceId: "OBJ-FINANCING-ENTITY", label: "单位数量", exact: "2", unit: "家", status: "可计数" },
      ...normalized.map((code) => ({ id: `unit-${code}`, object: `单位${code}`, resourceId: "MET-WAVG-COST", label: "平均融资成本", exact: unitFacts[code].cost.toFixed(3), unit: "%", status: "可计算" }))
    ];
    source.chart.adapters.metric.items[0] = { ...source.chart.adapters.metric.items[0], value: Number(combinedCost.toFixed(3)), exact: combinedCost.toFixed(3) };
    source.chart.adapters.bar.items = normalized.map((code) => ({ id: `unit-${code}`, rowId: `unit-${code}`, label: `单位${code}`, value: unitFacts[code].cost, exact: String(unitFacts[code].cost), unit: "%", resourceId: "MET-WAVG-COST", status: "可计算" }));
    source.chart.categories = units;
    source.chart.values = normalized.map((code) => unitFacts[code].cost);
    source.nextQuestions = ["把第三家单位加入组合。", `分别查看${units.join("和")}的成本构成。`];
    return source;
  }

  function resolveQuestion(text) {
    const normalized = String(text || "").trim();
    const exact = RECOMMENDED_QUESTIONS.find((item) => item.question === normalized);
    if (exact) return exact.id;
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
    ONTOLOGY_STORAGE_KEY, C017_PROJECTION_STORAGE_KEY, IDENTITY_COUNTER_STORAGE_KEY, ACTIVE_ONTOLOGY_ID, ONTOLOGY_ENTRY, DATA_ENGINEERING_ENTRY,
    STATE_SCHEMA_VERSION, LINK_CANONICAL_ENDPOINTS, LINK_DIRECTION_WHITELIST, QUERY_LINK_PATHS,
    RESOURCES, resourceById, SKILLS, TOOLS, PLATFORM_CAPABILITIES, ACTIVE_CONFIG, CANDIDATE_CONFIG,
    RECOMMENDED_QUESTIONS, CANDIDATE_VALIDATION_QUESTIONS, RESULT_TEMPLATES, HISTORY, SAVED_VIEWS, PINS,
    clone, nowText, nextStableId, createInitialState, loadState, saveState, resetState,
    readStoredJson, readPublishedOntologyContext, readCandidateConsumptionContext, readOntologyBindingContext, readDataTrustContext, readRuntimeContext, readOntologyContext,
    projectRuntimeContext, attachScenarioContext, projectRuntimeContextForScenario, runtimeContextFingerprint, resourceContractFingerprint, publishedContractProblems,
    bindConfigSnapshot, deriveConfigRuntimeState, runtimeCapabilityProof, isLinkDirectionAllowed, validateRunContext, configCompleteness,
    validateCandidateConfig, validateFixedQuestionSet, verifyFixedResult, isConfigCompatible, matchApplicableAgents,
    recommendationEligibility, recommendableQuestions, materializeResult, validateCandidateFixedQuestionSet,
    csvEligibility, actionEligibility, buildOntologyDeepLink, resourceFromContext, resolveQuestion,
    referencedUnitCodes, unitCostResultFor, pairCostResultFor, queryDefinition
  };
})();
