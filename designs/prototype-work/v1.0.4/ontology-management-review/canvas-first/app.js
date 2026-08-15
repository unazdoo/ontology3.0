(() => {
  "use strict";

  const STORAGE_KEY = "ontology3-canvas-first-review-v17";
  const LEGACY_STORAGE_KEYS = ["ontology3-canvas-first-review-v16"];
  const C003_CONTRACT_SCHEMA_VERSION = 2;
  const C008_PROJECTION_KEY = "ontology3-c008-authoritative-projection-v1";
  const C008_PROJECTION_SCHEMA_VERSION = 1;
  const DEFAULT_SCENARIO = Object.freeze({
    scenarioId: "S001",
    scenarioVersion: "S001-v1",
    scenarioRunId: "s001-awaiting-delivery",
    scenarioName: "集团融资成本与债务结构优化",
    formedAt: fullNowText(),
    status: "等待合法交付"
  });
  const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1";
  const DATA_ENGINEERING_PATH_MARKER = "/data-engineering-prototype-review/";
  const DATA_ENGINEERING_ENTRY_PATH = "/data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html";
  const WORLD = { width: 2140, height: 1120 };
  const ONTOLOGY_DEFINITION_OWNER = "本体管理";
  const ALLOWED_LINK_DIRECTIONS = ["双向导航", "仅正向导航", "仅反向导航"];
  const S001_REQUIRED_MEMBER_IDS = Object.freeze(["FIN-MEMBER-SUBJECT", "FIN-MEMBER-DETAIL", "FIN-MEMBER-INSTITUTION", "FIN-MEMBER-OWNER"]);
  const S001_REQUIRED_RELATION_IDS = Object.freeze(["FIN-REL-DETAIL-SUBJECT", "FIN-REL-DETAIL-INSTITUTION", "FIN-REL-SUBJECT-OWNER"]);
  const S001_AUTHORITATIVE_FACT_SNAPSHOT = window.S001_AUTHORITATIVE_FACT_SNAPSHOT || null;

  const OBJECT_BLUEPRINTS = [
    {
      id: "OBJ-FINANCING-ENTITY", name: "融资主体", identity: "PROP-FINANCING-ENTITY-UNIT-CODE", title: "PROP-FINANCING-ENTITY-UNIT-NAME", memberId: "FIN-MEMBER-SUBJECT",
      definition: "独立承担融资余额、成本、结构判断与优化行动的集团所属单位。", count: 574,
      properties: [
        ["PROP-FINANCING-ENTITY-UNIT-CODE", "单位编码", "文本", "单位编码", "身份"],
        ["PROP-FINANCING-ENTITY-UNIT-NAME", "单位名称", "文本", "单位名称", "标题"],
        ["PROP-FINANCING-ENTITY-SECTOR", "所属板块", "文本", "产业板块", "普通属性"],
        ["PROP-FINANCING-ENTITY-OWNER-ID", "负责人标识", "文本", "负责人标识", "普通属性"]
      ]
    },
    {
      id: "OBJ-FINANCING-DETAIL", name: "融资明细", identity: "PROP-FINANCING-DETAIL-LOAN-ID", title: "PROP-FINANCING-DETAIL-LOAN-ID", memberId: "FIN-MEMBER-DETAIL",
      definition: "具有独立借据身份、余额、利率、期限、币种和金融机构的融资事实。", count: 5218,
      properties: [
        ["PROP-FINANCING-DETAIL-LOAN-ID", "借据编号", "文本", "借据编号", "身份"],
        ["PROP-FINANCING-DETAIL-ENTITY-CODE", "单位编码", "文本", "单位编码", "普通属性"],
        ["PROP-FINANCING-DETAIL-INSTITUTION-CODE", "机构编码", "文本", "机构编码", "普通属性"],
        ["PROP-FINANCING-DETAIL-CURRENCY", "币种", "文本", "借据币种", "普通属性"],
        ["PROP-FINANCING-DETAIL-CNY-BALANCE", "折合人民币余额", "数值", "借据余额（折合人民币）", "普通属性"],
        ["PROP-FINANCING-DETAIL-INTEREST-RATE", "当前利率", "数值", "当前利率", "普通属性"],
        ["PROP-FINANCING-DETAIL-RATE-TYPE", "利率形式", "枚举", "利率形式", "普通属性"],
        ["PROP-FINANCING-DETAIL-TERM-TYPE", "期限种类", "枚举", "期限种类", "普通属性"],
        ["PROP-FINANCING-DETAIL-GUARANTEE-TYPE", "担保方式", "枚举", "担保方式", "普通属性"],
        ["PROP-FINANCING-DETAIL-AS-OF-DATE", "数据截至时间", "日期", "数据截至时间", "普通属性"]
      ]
    },
    {
      id: "OBJ-FINANCIAL-INSTITUTION", name: "融资机构", identity: "PROP-FINANCIAL-INSTITUTION-CODE", title: "PROP-FINANCIAL-INSTITUTION-NAME", memberId: "FIN-MEMBER-INSTITUTION",
      definition: "为融资明细提供资金并可作为协商对象的金融机构。", count: 24,
      properties: [
        ["PROP-FINANCIAL-INSTITUTION-CODE", "机构编码", "文本", "机构编码", "身份"],
        ["PROP-FINANCIAL-INSTITUTION-NAME", "机构名称", "文本", "机构名称", "标题"],
        ["PROP-FINANCIAL-INSTITUTION-CATEGORY", "机构类别", "文本", "机构类别", "普通属性"]
      ]
    },
    {
      id: "OBJ-FINANCING-OWNER", name: "融资负责人", identity: "PROP-FINANCING-OWNER-ID", title: "PROP-FINANCING-OWNER-NAME", memberId: "FIN-MEMBER-OWNER",
      definition: "承接融资主体优化任务的业务责任人。", count: 24,
      properties: [
        ["PROP-FINANCING-OWNER-ID", "负责人标识", "文本", "负责人标识", "身份"],
        ["PROP-FINANCING-OWNER-NAME", "负责人名称", "文本", "负责人名称", "标题"]
      ]
    }
  ];

  const LINK_BLUEPRINTS = [
    { id: "LINK-ENTITY-FINANCING", name: "融资归属主体", reverseName: "主体拥有融资", allowedDirection: "双向导航", coverage: "覆盖已匹配融资明细与融资主体", source: "OBJ-FINANCING-DETAIL", target: "OBJ-FINANCING-ENTITY", cardinality: "多对一", sourceEndpoint: { kind: "assetField", id: "FIELD-FINANCING-DETAIL-ENTITY-CODE", memberId: "FIN-MEMBER-DETAIL" }, targetEndpoint: { kind: "property", id: "PROP-FINANCING-ENTITY-UNIT-CODE" }, definition: "从一笔融资明细定位其归属的融资主体；反向可查看主体拥有的融资明细。" },
    { id: "LINK-FINANCING-INSTITUTION", name: "融资由机构提供", reverseName: "机构提供融资", allowedDirection: "仅正向导航", coverage: "覆盖已匹配融资明细与金融机构", source: "OBJ-FINANCING-DETAIL", target: "OBJ-FINANCIAL-INSTITUTION", cardinality: "多对一", sourceEndpoint: { kind: "assetField", id: "FIELD-FINANCING-DETAIL-INSTITUTION-CODE", memberId: "FIN-MEMBER-DETAIL" }, targetEndpoint: { kind: "property", id: "PROP-FINANCIAL-INSTITUTION-CODE" }, definition: "从一笔融资定位提供资金的金融机构。" },
    { id: "LINK-ENTITY-OWNER", name: "主体由负责人承接", reverseName: "负责人承接主体", allowedDirection: "仅正向导航", coverage: "覆盖已匹配融资主体与融资负责人", source: "OBJ-FINANCING-ENTITY", target: "OBJ-FINANCING-OWNER", cardinality: "多对一", sourceEndpoint: { kind: "assetField", id: "FIELD-FINANCING-ENTITY-OWNER-ID", memberId: "FIN-MEMBER-SUBJECT" }, targetEndpoint: { kind: "property", id: "PROP-FINANCING-OWNER-ID" }, definition: "从融资主体定位承接优化行动的负责人。" }
  ];

  const METRICS = [
    ["MET-FINANCING-BALANCE", "融资余额", "人民币元", "集团、板块、主体及主体集合", "所选融资明细折合人民币余额之和。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "LINK-ENTITY-FINANCING"]],
    ["MET-WAVG-FINANCING-COST", "余额加权平均融资成本", "%", "集团、板块、主体及主体集合", "按融资明细余额加权计算融资成本。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-INTEREST-RATE", "LINK-ENTITY-FINANCING"]],
    ["MET-FLOATING-RATE-BALANCE-RATIO", "浮动利率余额占比", "%", "集团、板块、融资主体", "浮动利率融资余额占融资余额的比例。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-RATE-TYPE", "LINK-ENTITY-FINANCING"]],
    ["MET-SHORT-TERM-DEBT-RATIO", "短期债务余额占比", "%", "集团、板块、融资主体", "短期融资余额占融资余额的比例。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-TERM-TYPE", "LINK-ENTITY-FINANCING"]],
    ["MET-FX-FINANCING-SHARE", "外币融资余额占比", "%", "集团、板块、融资主体", "非人民币融资折合人民币余额占比。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-CURRENCY", "LINK-ENTITY-FINANCING"]],
    ["MET-HIGH-COST-BALANCE-RATIO", "高成本融资余额占比", "%", "集团、板块、融资主体", "融资成本高于业务阈值的余额占比。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-INTEREST-RATE", "LINK-ENTITY-FINANCING"]],
    ["MET-CREDIT-FINANCING-SHARE", "信用融资余额占比", "%", "集团、板块、融资主体", "担保方式为信用的融资余额占比。", ["PROP-FINANCING-DETAIL-CNY-BALANCE", "PROP-FINANCING-DETAIL-GUARANTEE-TYPE", "LINK-ENTITY-FINANCING"]]
  ].map(([id, name, unit, scope, definition, dependencyIds]) => ({
    id, name, unit, scope, definition, dependencyIds, type: "Metric", owner: "",
    sourceObjectId: "OBJ-FINANCING-DETAIL", subjectObjectId: "OBJ-FINANCING-ENTITY",
    time: "数据截至时点", zeroHandling: "分母为零或没有有效数据时返回无法计算",
    calculation: ({
      "MET-FINANCING-BALANCE": "Σ 折合人民币余额",
      "MET-WAVG-FINANCING-COST": "Σ（折合人民币余额 × 当前利率）÷ Σ 折合人民币余额",
      "MET-FLOATING-RATE-BALANCE-RATIO": "浮动利率融资人民币余额 ÷ 融资余额",
      "MET-SHORT-TERM-DEBT-RATIO": "期限种类为“短期”的人民币余额 ÷ 融资余额",
      "MET-FX-FINANCING-SHARE": "非人民币融资的折合人民币余额 ÷ 融资余额",
      "MET-HIGH-COST-BALANCE-RATIO": "当前利率高于本规则版本阈值的人民币余额 ÷ 融资余额",
      "MET-CREDIT-FINANCING-SHARE": "担保方式为“信用”的人民币余额 ÷ 融资余额"
    })[id]
  }));

  const RULES = [
    { id: "RULE-HIGH-FINANCING-COST", name: "融资成本偏高", code: "R01", appliesTo: "融资主体", objectId: "OBJ-FINANCING-ENTITY", metricIds: ["MET-WAVG-FINANCING-COST", "MET-HIGH-COST-BALANCE-RATIO"], dependency: "余额加权平均融资成本、高成本融资余额占比", conclusion: "单位553", evidence: "指标快照、关联借据、前三家融资银行" },
    { id: "RULE-FLOATING-RATE-EXPOSURE", name: "浮动利率暴露", code: "R02", appliesTo: "融资主体", objectId: "OBJ-FINANCING-ENTITY", metricIds: ["MET-FLOATING-RATE-BALANCE-RATIO"], dependency: "浮动利率余额占比", conclusion: "单位465", evidence: "指标快照、关联借据、前三家融资银行" },
    { id: "RULE-SHORT-TERM-DEBT-CONCENTRATION", name: "短期债务集中", code: "R03", appliesTo: "融资主体", objectId: "OBJ-FINANCING-ENTITY", metricIds: ["MET-SHORT-TERM-DEBT-RATIO"], dependency: "短期债务余额占比", conclusion: "单位561", evidence: "指标快照、关联借据、前三家融资银行" }
  ].map(item => ({
    ...item,
    type: "Rule",
    owner: "",
    condition: item.code === "R01" ? "主体融资成本高于集团基准 0.25 个百分点，或高成本融资余额占比大于 20%（高成本阈值 2.75%）" : item.code === "R02" ? "浮动利率余额占比大于 80%" : "短期债务余额占比大于 30%",
    definition: item.code === "R01" ? "识别融资成本相对集团基准明显偏高的融资主体。" : item.code === "R02" ? "识别浮动利率敞口较高的融资主体。" : "识别短期债务集中度较高的融资主体。",
    validity: "随当前 Published 语义版本生效",
    testSample: item.code === "R01" ? "单位553：应命中融资成本偏高" : item.code === "R02" ? "单位465：应命中浮动利率暴露" : "单位561：应命中短期债务集中",
    bankRanking: item.code === "R01" ? "仅由单位成本支路命中时，按各机构正向增量利息成本 Σ余额 × max（当前利率 - 集团基准 - 0.25 个百分点，0）降序取前三；两条支路同时命中时按高成本融资余额贡献排序" : "按对应问题融资余额降序列出前三家银行",
    businessBasis: "recommended",
    decisionRefs: item.code === "R01" ? ["Q001", "Q004"] : item.code === "R02" ? ["Q001"] : ["Q001", "Q002"]
  }));

  const ACTIONS = [{
    id: "ACTION-FINANCING-OPTIMIZATION", name: "发起融资优化建议", type: "Action Type", owner: "",
    targetObjectId: "OBJ-FINANCING-ENTITY", ruleIds: ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"],
    target: "融资主体", inputs: "主体、命中规则、指标证据、关联借据、优先协商银行、负责人、数据截至时间",
    parameters: "主体、命中规则、指标证据、关联借据、优先协商银行、负责人、数据截至时间",
    prerequisite: "目标主体、规则命中、指标快照和负责人关系均可追溯。",
    result: "形成融资优化行动申请；人工确认后由决策中心形成负责人待办。",
    failure: "缺少目标主体、规则证据、负责人关系或同版数据证据时，不形成行动申请并返回缺失项。",
    defaultDue: "人工确认后 5 个工作日内完成",
    confirmation: "必须人工确认",
    definition: "针对已识别的融资成本或债务结构问题，请求发起融资优化行动。",
    requirement: "需要人工确认后，才可由决策中心形成负责人待办。",
    businessBasis: "recommended",
    decisionRefs: ["Q003"]
  }];

  const INSTANCE_ROWS = {
    "OBJ-FINANCING-ENTITY": [
      ["UNIT-553", "单位553", "集团及直管公司", "393.134 亿元", "2.881%", "融资负责人001"],
      ["UNIT-465", "单位465", "核能", "770.000 亿元", "2.197%", "融资负责人009"],
      ["UNIT-561", "单位561", "核技术", "20.016 亿元", "2.228%", "融资负责人009"]
    ],
    "OBJ-FINANCING-DETAIL": [
      ["LOAN-004842", "单位553", "欧陆银行", "12.560 亿元", "2.90%", "长期"],
      ["LOAN-003493", "单位465", "融通银行", "3.580 亿元", "2.25%", "长期"],
      ["LOAN-005007", "单位561", "同州银行", "0.235 亿元", "2.20%", "短期"]
    ],
    "OBJ-FINANCIAL-INSTITUTION": [
      ["INST-012", "欧陆银行", "商业银行", "单位553", "99.586 亿元", "17 笔"],
      ["INST-014", "融通银行", "商业银行", "单位465", "249.081 亿元", "164 笔"],
      ["INST-018", "同州银行", "商业银行", "单位561", "5.047 亿元", "171 笔"]
    ],
    "OBJ-FINANCING-OWNER": [
      ["OWNER-001", "融资负责人001", "单位553", "1 个主体", "可承接", "—"],
      ["OWNER-009", "融资负责人009", "单位465、单位561", "2 个主体", "可承接", "—"]
    ]
  };

  const TYPE_LABEL = { object: "Object Type", metric: "Metric", rule: "Rule", action: "Action Type", link: "Link Type", property: "Property" };
  const PUBLISHED_METADATA_KEYS = new Set(["kind", "type", "publicationState", "businessValidityState", "lifecycleState", "bindability", "effectiveFrom", "effectiveTo", "replaces", "replacedBy", "changeType", "changeReason", "lastChangedAt", "semanticChangedAt", "controlledEvidenceLocator", "publishRecordId", "discoverability", "discoveryScope", "applicableScenario"]);
  const POSITION_PRESET = {
    "OBJ-FINANCING-DETAIL": [110, 260], "LINK-ENTITY-FINANCING": [390, 280], "OBJ-FINANCING-ENTITY": [640, 260],
    "LINK-FINANCING-INSTITUTION": [390, 82], "OBJ-FINANCIAL-INSTITUTION": [640, 62],
    "LINK-ENTITY-OWNER": [920, 280], "OBJ-FINANCING-OWNER": [1170, 260],
    "MET-FINANCING-BALANCE": [80, 570], "MET-WAVG-FINANCING-COST": [300, 570], "MET-HIGH-COST-BALANCE-RATIO": [520, 570],
    "MET-FLOATING-RATE-BALANCE-RATIO": [740, 570], "MET-SHORT-TERM-DEBT-RATIO": [960, 570], "MET-FX-FINANCING-SHARE": [1180, 570],
    "MET-CREDIT-FINANCING-SHARE": [1400, 570], "RULE-HIGH-FINANCING-COST": [390, 790], "RULE-FLOATING-RATE-EXPOSURE": [740, 790],
    "RULE-SHORT-TERM-DEBT-CONCENTRATION": [960, 790], "ACTION-FINANCING-OPTIMIZATION": [740, 1010]
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function scenarioContextOf(value, fallback = DEFAULT_SCENARIO) {
    const source = value?.scenarioContext || value || {};
    const scenarioTextName = String(value?.scenario || "").replace(/^S\d+\s*/, "").trim();
    return {
      scenarioId: source.scenarioId || fallback.scenarioId,
      scenarioVersion: source.scenarioVersion || fallback.scenarioVersion,
      scenarioRunId: source.scenarioRunId || fallback.scenarioRunId,
      scenarioName: resolvedExternalValue(source.scenarioName) ? source.scenarioName : resolvedExternalValue(scenarioTextName) ? scenarioTextName : fallback.scenarioName,
      formedAt: source.formedAt || fallback.formedAt || null,
      status: source.status || fallback.status || null
    };
  }
  function sameScenarioContext(left, right) {
    const a = scenarioContextOf(left); const b = scenarioContextOf(right);
    return a.scenarioId === b.scenarioId && a.scenarioVersion === b.scenarioVersion && a.scenarioRunId === b.scenarioRunId;
  }
  function sameScenarioEnvelope(left, right) {
    const a = scenarioContextOf(left); const b = scenarioContextOf(right);
    return sameScenarioContext(a, b) && a.formedAt === b.formedAt && a.status === b.status;
  }
  function sameScenarioDefinition(left, right) {
    const a = scenarioContextOf(left); const b = scenarioContextOf(right);
    return a.scenarioId === b.scenarioId && a.scenarioVersion === b.scenarioVersion;
  }
  function scenarioContextFromParams(params) {
    return {
      scenarioId: params.get("scenarioId") || null,
      scenarioVersion: params.get("scenarioVersion") || null,
      scenarioRunId: params.get("scenarioRunId") || null,
      scenarioName: params.get("scenarioName") || null,
      formedAt: params.get("scenarioFormedAt") || params.get("formedAt") || null,
      status: params.get("scenarioStatus") || params.get("status") || null
    };
  }
  function appendScenarioContextParams(params, context) {
    const value = scenarioContextOf(context, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null });
    const fields = {
      scenarioId: value.scenarioId,
      scenarioVersion: value.scenarioVersion,
      scenarioRunId: value.scenarioRunId,
      scenarioName: value.scenarioName,
      scenarioFormedAt: value.formedAt,
      scenarioStatus: value.status
    };
    Object.entries(fields).forEach(([key, fieldValue]) => fieldValue ? params.set(key, fieldValue) : params.delete(key));
    return params;
  }
  function canonicalSnapshot(value) {
    if (Array.isArray(value)) return value.map(canonicalSnapshot);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalSnapshot(value[key])]));
  }
  function snapshotFingerprint(value) { return JSON.stringify(canonicalSnapshot(value)); }
  function resolvedExternalValue(value) {
    const text = String(value ?? "").trim();
    return !!text
      && !/^(?:-|TBD|TODO|N\/A|NA|NONE|NULL|UNKNOWN|PLACEHOLDER)$/i.test(text)
      && !/(待确认|待填写|待由|未提供|尚未形成|请由|占位)/.test(text);
  }

  function scenarioDisplayName(value) {
    const context = value?.scenarioContext || value || {};
    if (resolvedExternalValue(context.scenarioName)) return String(context.scenarioName).trim();
    if (context.scenarioId === DEFAULT_SCENARIO.scenarioId) return DEFAULT_SCENARIO.scenarioName;
    return "场景名称待确认";
  }

  function scenarioDisplayLabel(value) {
    const context = scenarioContextOf(value, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null });
    return [context.scenarioId, scenarioDisplayName({ ...context, scenarioContext: context })].filter(Boolean).join(" ");
  }

  function c003PayloadFingerprint(value) {
    if (!value || typeof value !== "object") return null;
    const snapshot = { ...value };
    delete snapshot.payloadFingerprint;
    const text = snapshotFingerprint(snapshot);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `C003-PF-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}-${text.length}`;
  }

  function c003AttemptNumberFromId(seriesId, deliveryId) {
    if (!resolvedExternalValue(seriesId) || !resolvedExternalValue(deliveryId)) return null;
    if (deliveryId === seriesId) return 1;
    const escaped = String(seriesId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = String(deliveryId).match(new RegExp(`^${escaped}-A(\\d+)$`));
    return match ? Number(match[1]) : null;
  }

  function resolvedExternalTime(value) {
    if (!resolvedExternalValue(value)) return false;
    return Number.isFinite(Date.parse(String(value).trim().replace(" ", "T")));
  }

  function scenarioContextIssues(value) {
    const source = value?.scenarioContext || value || {};
    const issues = [];
    if (!resolvedExternalValue(source.scenarioId)) issues.push("场景标识缺失");
    if (!resolvedExternalValue(source.scenarioVersion)) issues.push("场景版本缺失");
    if (!resolvedExternalValue(source.scenarioRunId)) issues.push("场景轮次缺失");
    if (!resolvedExternalTime(source.formedAt)) issues.push("场景上下文形成时间缺失或无效");
    if (!resolvedExternalValue(source.status)) issues.push("场景上下文状态缺失");
    if (/(?:停用|未知|无效|已结束|inactive|unknown)/i.test(String(source.status || ""))) issues.push("场景上下文当前不可用");
    return issues;
  }

  function normalizedDataAssetContract(payload) {
    if (!payload || typeof payload !== "object") return null;
    return {
      contractSchemaVersion: C003_CONTRACT_SCHEMA_VERSION,
      sourceModule: payload.sourceModule || null,
      contractCode: payload.contractCode || null,
      deliveryId: payload.deliveryId || payload.deliveryStableId || null,
      deliverySeriesId: payload.deliverySeriesId || null,
      attemptNumber: Number.isInteger(payload.attemptNumber) ? payload.attemptNumber : null,
      retryOf: payload.retryOf || null,
      previousDeliveryId: payload.previousDeliveryId || null,
      deliveryStatus: payload.deliveryStatus || payload.status || null,
      deliveredAt: payload.deliveredAt || null,
      scenarioContext: scenarioContextOf(payload.scenarioContext || payload, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null }),
      evidenceLocator: payload.evidenceLocator || null,
      assetId: payload.assetId || payload.t006Id || null,
      declaredT006Id: payload.t006Id || null,
      assetName: payload.assetName || null,
      assetVersion: payload.assetVersion || payload.t007Version || null,
      declaredT007Version: payload.t007Version || null,
      asOf: payload.asOf || payload.t008AsOf || payload.t008 || null,
      t008AsOf: payload.t008AsOf || payload.t008 || null,
      t008Confirmation: clone(payload.t008Confirmation || null),
      sourceSnapshotId: payload.sourceSnapshotId || null,
      sourceReadEventId: payload.sourceReadEventId || payload.t008Confirmation?.sourceReadEventId || null,
      sourceFingerprint: clone(payload.sourceFingerprint || null),
      processingModuleVersion: payload.processingModuleVersion || null,
      runEvidence: clone(payload.runEvidence || null),
      publishedAt: payload.publishedAt || null,
      versionDescription: payload.versionDescription || null,
      source: payload.source || null,
      sourceChain: clone(payload.sourceChain || []),
      publicationState: payload.publicationState || null,
      purpose: payload.purpose || null,
      consumptionRestriction: payload.consumptionRestriction || null,
      lineageCheckStatus: payload.lineageCheckStatus || null,
      lineageEvidenceLocator: payload.lineageEvidenceLocator || null,
      mappingEligibility: clone(payload.mappingEligibility || null),
      qualitySummary: clone(payload.qualitySummary || null),
      members: clone(payload.members || []),
      relations: clone(payload.relations || []),
      payloadFingerprint: payload.payloadFingerprint || null,
      payloadFingerprintValid: payload.payloadFingerprint === c003PayloadFingerprint(payload)
    };
  }

  function normalizedScenarioContextEnvelope(payload) {
    if (!payload || typeof payload !== "object") return null;
    return {
      sourceModule: payload.sourceModule || null,
      contractCode: payload.contractCode || null,
      contextId: payload.contextId || payload.scenarioContextId || null,
      deliveredAt: payload.deliveredAt || null,
      evidenceLocator: payload.evidenceLocator || null,
      scenarioContext: scenarioContextOf(payload.scenarioContext || payload, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null })
    };
  }

  function scenarioContextEnvelopeIssues(envelope) {
    const issues = [];
    if (envelope?.sourceModule !== "平台公共层" || envelope?.contractCode !== "C033") issues.push("来源模块或合同编号不符合场景运行上下文合同");
    if (!resolvedExternalValue(envelope?.contextId)) issues.push("场景上下文稳定标识缺失");
    if (!resolvedExternalTime(envelope?.deliveredAt)) issues.push("场景上下文交付时间缺失或无效");
    if (!resolvedExternalValue(envelope?.evidenceLocator)) issues.push("场景上下文证据定位缺失");
    issues.push(...scenarioContextIssues(envelope?.scenarioContext));
    return issues;
  }

  function waitingScenarioPlaceholder(context) {
    return !!context
      && context.scenarioRunId === "s001-awaiting-delivery"
      && context.status === "等待合法交付";
  }

  function acceptedScenarioContextReceipt(context = currentScenarioContext()) {
    return Object.values(state?.scenarioContextReceipts || {}).find(item =>
      item?.receipt?.status === "accepted" && sameScenarioEnvelope(item.receipt, context)
    )?.receipt || null;
  }

  function currentScenarioContextReady() {
    const context = currentScenarioContext();
    return !state?.pendingScenarioReset
      && !waitingScenarioPlaceholder(context)
      && !scenarioContextIssues(context).length
      && !!acceptedScenarioContextReceipt(context);
  }

  function currentVersionWriteIssue(version) {
    if (!currentScenarioContextReady()) return state?.pendingScenarioReset ? "正在等待平台公共层返回新的场景轮次" : "当前场景运行上下文尚未就绪";
    if (!version || !sameScenarioEnvelope(version, currentScenarioContext())) return "该 Published 版本属于历史场景轮次，只能查看和追溯";
    return null;
  }

  function scenarioInputMatchesCurrent(value, context = currentScenarioContext()) {
    const input = String(value || "").trim();
    if (!input || input === "暂不指定") return true;
    const displayName = scenarioDisplayName(context);
    return [context.scenarioId, context.scenarioName, displayName, `${context.scenarioId} ${displayName}`].filter(Boolean).some(candidate => input === candidate);
  }

  function dataAssetDeliveryIssues(contract) {
    const issues = [];
    if (state?.pendingScenarioReset) issues.push("场景定向重置尚未取得平台公共层返回的新 C033，当前不接收数据资产交付");
    if (contract?.sourceModule !== "数据工程" || contract?.contractCode !== "C003") issues.push("来源模块或合同编号不符合数据资产交付合同");
    if (!resolvedExternalValue(contract?.deliveryId)) issues.push("稳定交付标识缺失");
    const transportMetadataProvided = [contract?.deliverySeriesId, contract?.attemptNumber, contract?.retryOf, contract?.previousDeliveryId].some(value => value !== null && value !== undefined && value !== "");
    if (transportMetadataProvided) {
      const declaredAttempt = Number(contract?.attemptNumber);
      const parsedAttempt = c003AttemptNumberFromId(contract?.deliverySeriesId, contract?.deliveryId);
      if (!resolvedExternalValue(contract?.deliverySeriesId)
        || !Number.isSafeInteger(declaredAttempt)
        || declaredAttempt < 1
        || parsedAttempt !== declaredAttempt
        || contract.deliverySeriesId !== `C003-${contract?.assetVersion || "UNKNOWN"}`) issues.push("已提供的交付系列、稳定交付标识、精确数据版本或尝试序号不一致");
      const previousAttempt = c003AttemptNumberFromId(contract?.deliverySeriesId, contract?.retryOf);
      if ((contract?.retryOf || null) !== (contract?.previousDeliveryId || null)
        || (declaredAttempt === 1 && contract?.retryOf)
        || (declaredAttempt > 1 && (!previousAttempt || previousAttempt >= declaredAttempt))) issues.push("已提供的交付重试没有精确回指同系列更早尝试，或首次尝试错误携带重试来源");
    }
    const contextIssues = scenarioContextIssues(contract?.scenarioContext);
    if (contextIssues.length) issues.push(`场景运行上下文不完整：${contextIssues.join("、")}`);
    const activeContext = state?.scenarioContexts?.[state.activeScenarioId] || DEFAULT_SCENARIO;
    const acceptedScenarioContext = Object.values(state?.scenarioContextReceipts || {}).some(item => item?.receipt?.status === "accepted" && sameScenarioEnvelope(item.receipt, contract));
    const activatesWaitingContext = !contextIssues.length
      && waitingScenarioPlaceholder(activeContext)
      && acceptedScenarioContext
      && contract?.scenarioContext?.scenarioId === activeContext.scenarioId
      && contract?.scenarioContext?.scenarioVersion === activeContext.scenarioVersion;
    if (!contextIssues.length && !sameScenarioEnvelope(contract, activeContext) && !activatesWaitingContext) issues.push("交付场景身份、版本、轮次、形成时间或状态与当前工作投影不一致");
    if (!contextIssues.length && !acceptedScenarioContext) issues.push("尚未取得平台公共层对同一 C033 场景轮次的已接收根上下文");
    if (contract?.purpose?.startsWith?.("S001") && contract?.scenarioContext?.scenarioId !== "S001") issues.push("交付用途与场景身份不一致");
    if (!contract?.assetId || !contract?.assetVersion || !contract?.asOf) issues.push("稳定资产身份、精确数据版本或数据截至时间缺失");
    if (contract?.declaredT006Id && contract.declaredT006Id !== contract.assetId) issues.push("T006 稳定身份与数据资产身份不一致");
    if (contract?.declaredT007Version && contract.declaredT007Version !== contract.assetVersion) issues.push("T007 精确版本与数据资产版本不一致");
    if (contract?.t008AsOf && contract.t008AsOf !== contract.asOf) issues.push("T008 与数据截至时间不一致");
    const t008 = contract?.t008Confirmation;
    if (!t008 || t008.snapshotId !== contract?.sourceSnapshotId || t008.asOf !== contract?.asOf || t008.sourceReadEventId !== contract?.sourceReadEventId || !resolvedExternalValue(t008.confirmedBy) || !resolvedExternalTime(t008.confirmedAt) || !resolvedExternalValue(t008.basis) || !resolvedExternalValue(t008.evidenceId) || !resolvedExternalValue(t008.evidenceLocator) || scenarioContextIssues(t008.scenarioContext).length || !sameScenarioEnvelope(t008, contract)) issues.push("T008 缺少精确快照、读取事件、确认人、确认时间、依据、同轮次 C033 或证据定位");
    if (!resolvedExternalTime(contract?.deliveredAt)) issues.push("数据资产交付时间缺失、无效或仍为占位值");
    if (!["已发送", "已交付", "sent", "delivered"].includes(contract?.deliveryStatus)) issues.push("数据资产交付状态缺失或不可接收");
    if (!resolvedExternalValue(contract?.sourceSnapshotId) || !resolvedExternalValue(contract?.sourceReadEventId) || !resolvedExternalValue(contract?.source) || !resolvedExternalValue(contract?.processingModuleVersion) || !resolvedExternalTime(contract?.publishedAt) || !resolvedExternalValue(contract?.versionDescription)) issues.push("来源快照、真实读取事件、来源说明、处理模块版本、发布时间或版本说明缺失");
    const fingerprint = contract?.sourceFingerprint;
    if (fingerprint?.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/i.test(String(fingerprint?.value || "")) || !Number.isFinite(Number(fingerprint?.sizeBytes)) || Number(fingerprint?.sizeBytes) <= 0 || Number(contract?.t008Confirmation?.sizeBytes) !== Number(fingerprint?.sizeBytes)) issues.push("来源 SHA-256、文件字节数或 T008 快照大小证据不完整或不一致");
    const runEvidence = contract?.runEvidence;
    if (!resolvedExternalValue(runEvidence?.runId) || !resolvedExternalValue(runEvidence?.definitionVersion) || !resolvedExternalValue(runEvidence?.qualityResultId) || !resolvedExternalValue(runEvidence?.evidenceLocator) || runEvidence?.qualityResultId !== contract?.qualitySummary?.resultId) issues.push("正式运行、处理定义、质量结果身份或运行证据定位不完整或不一致");
    if (contract?.publicationState !== "已发布") issues.push("数据资产不是已发布状态");
    if (!contract?.purpose || !contract?.consumptionRestriction) issues.push("用途或消费限制缺失");
    if (contract?.mappingEligibility?.status !== "可供本体映射" || !resolvedExternalValue(contract?.mappingEligibility?.evidenceLocator)) issues.push("本体映射资格或证据定位缺失");
    if (contract?.qualitySummary?.status !== "通过" || !resolvedExternalValue(contract?.qualitySummary?.resultId) || !resolvedExternalTime(contract?.qualitySummary?.checkedAt) || !resolvedExternalValue(contract?.qualitySummary?.evidenceLocator)) issues.push("质量摘要未通过，或质量结果身份、核验时间、证据定位缺失");
    const expectedSourceChain = [contract?.sourceSnapshotId, contract?.sourceReadEventId, runEvidence?.definitionVersion, runEvidence?.runId, runEvidence?.qualityResultId, contract?.assetVersion];
    if (contract?.lineageCheckStatus !== "通过" || !resolvedExternalValue(contract?.lineageEvidenceLocator) || contract?.sourceChain?.length !== expectedSourceChain.length || expectedSourceChain.some((item, index) => contract?.sourceChain?.[index] !== item)) issues.push("完整来源链与精确快照、真实读取事件、处理定义、正式运行、质量结果或数据版本不一致");
    if (!resolvedExternalValue(contract?.evidenceLocator)) issues.push("数据资产版本证据定位缺失");
    if (!resolvedExternalValue(contract?.payloadFingerprint) || !contract?.payloadFingerprintValid) issues.push("交付载荷指纹缺失或与当前冻结内容不一致");
    if (!contract?.members?.length) issues.push("资产成员范围缺失");
    if (contract?.members?.some(member => {
      const fields = Array.isArray(member.fields) ? member.fields : [];
      const fieldIds = fields.map(field => field?.[3]).filter(Boolean);
      return !resolvedExternalValue(member.id) || !resolvedExternalValue(member.name) || !resolvedExternalValue(member.grain) || !resolvedExternalValue(member.identity) || !resolvedExternalValue(member.identityFieldId)
        || member.identityCheckStatus !== "通过" || !resolvedExternalValue(member.identityEvidenceLocator) || !Number.isFinite(Number(member.rows)) || Number(member.rows) < 0
        || !fields.length || fields.some(field => !Array.isArray(field) || field.length < 4 || !resolvedExternalValue(field[0]) || !resolvedExternalValue(field[1]) || !resolvedExternalValue(field[3]))
        || new Set(fieldIds).size !== fieldIds.length || !fieldIds.includes(member.identityFieldId);
    })) issues.push("成员稳定身份、粒度、稳定键、字段身份或身份检查证据不完整");
    const memberFields = new Map((contract?.members || []).map(member => [member.id, new Set((member.fields || []).map(field => field?.[3]).filter(Boolean))]));
    if (contract?.relations?.some(relation => !resolvedExternalValue(relation.id) || !resolvedExternalValue(relation.name) || !memberFields.has(relation.sourceMemberId) || !memberFields.has(relation.targetMemberId) || !memberFields.get(relation.sourceMemberId)?.has(relation.sourceFieldId) || !memberFields.get(relation.targetMemberId)?.has(relation.targetFieldId) || !resolvedExternalValue(relation.cardinality) || relation.endpointCheckStatus !== "通过" || Number(relation.unmatchedSourceCount || 0) !== 0 || Number(relation.unmatchedTargetCount || 0) !== 0 || !resolvedExternalValue(relation.endpointEvidenceLocator))) issues.push("资产成员关系、端点身份、端点检查结果或证据不完整");
    if (contract?.purpose?.startsWith?.("S003")) issues.push("该数据资产当前不可进入本体选择或正式消费链");
    if (contract?.scenarioContext?.scenarioId === "S001") {
      const expectedMembers = new Set(S001_REQUIRED_MEMBER_IDS);
      const expectedRelations = new Set(S001_REQUIRED_RELATION_IDS);
      if (contract.members.length !== 4 || [...expectedMembers].some(id => !contract.members.some(member => member.id === id))) issues.push("S001 数据资产必须完整交付四个成员");
      if (contract.relations.length !== 3 || [...expectedRelations].some(id => !contract.relations.some(relation => relation.id === id))) issues.push("S001 数据资产必须完整交付三条成员关系");
    }
    return issues;
  }

  function dataAssetContractKey(assetId, assetVersion) {
    return `${assetId || ""}::${assetVersion || ""}`;
  }

  function memberTargetObjectId(member) {
    if (!member) return null;
    return member.objectId || OBJECT_BLUEPRINTS.find(blueprint => blueprint.memberId === member.id)?.id || null;
  }

  function memberCompatibleWithObject(member, object) {
    if (!member || !object) return false;
    const expected = OBJECT_BLUEPRINTS.find(blueprint => blueprint.id === object.id);
    if (!expected) return true;
    return member.id === expected.memberId && (!member.objectId || member.objectId === object.id);
  }

  function isCompatibleContractEnrichment(existing, incoming) {
    if (!existing || !incoming || existing.contractSchemaVersion === C003_CONTRACT_SCHEMA_VERSION) return false;
    if (existing.deliveryId !== incoming.deliveryId || existing.assetId !== incoming.assetId || existing.assetVersion !== incoming.assetVersion || existing.asOf !== incoming.asOf || !sameScenarioEnvelope(existing, incoming)) return false;
    const compatible = (left, right) => {
      if (left === null || left === undefined || left === "") return true;
      if (Array.isArray(left)) return Array.isArray(right) && left.length === right.length && left.every((item, index) => compatible(item, right[index]));
      if (typeof left === "object") return !!right && typeof right === "object" && !Array.isArray(right) && Object.keys(left).every(key => compatible(left[key], right[key]));
      return left === right;
    };
    return compatible(existing, incoming);
  }

  function receivedDataAsset(assetId, assetVersion) {
    const exact = state.externalDataAssets?.[dataAssetContractKey(assetId, assetVersion)] || null;
    if (exact) return exact;
    return Object.values(state.externalDataAssets || {}).find(item => item.assetId === assetId && item.assetVersion === assetVersion) || null;
  }

  function dataAssetDeliveryById(deliveryId) {
    if (!deliveryId) return null;
    const current = Object.values(state.externalDataAssets || {}).find(item => item.deliveryId === deliveryId);
    if (current) return current;
    return (state.scenarioHistory || []).slice().reverse().flatMap(item => item.archivedWorkProjection?.dataAssets || []).find(item => item.deliveryId === deliveryId) || null;
  }

  function availableDataAssets() {
    const context = state?.scenarioContexts?.[state.activeScenarioId] || DEFAULT_SCENARIO;
    return Object.values(state.externalDataAssets || {}).filter(contract => !dataAssetDeliveryIssues(contract).length && sameScenarioEnvelope(contract, context));
  }
  function nowText() { return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace("/", "-"); }
  function fullNowText() { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date()).replaceAll("/", "-"); }
  function nowLocalValue() {
    const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return date.toISOString().slice(0, 16);
  }
  function humanDateTime(value, fallback = "待确认") { return value ? String(value).replace("T", " ") : fallback; }
  function publicationStateOf(resource) {
    if (!resource) return "待确认";
    const declared = resource.publicationState || resource.status || resource.lifecycleState || "待确认";
    if (declared === "Draft") return "Draft";
    if (declared === "Published" || resource.status === "Published") return "Published";
    return "待确认";
  }
  function businessValidityStateOf(resource) {
    if (!resource) return "待确认";
    const declared = resource.businessValidityState || resource.lifecycleState || resource.status || "待确认";
    if (["停用", "已停用"].includes(declared)) return "停用";
    if (publicationStateOf(resource) !== "Published") return declared === "Draft" ? "未生效" : "待确认";
    if (!resource.effectiveFrom) return "待确认";
    const now = Date.now();
    const startsAt = new Date(resource.effectiveFrom).getTime();
    const endsAt = resource.effectiveTo ? new Date(resource.effectiveTo).getTime() : null;
    if (!Number.isFinite(startsAt) || (resource.effectiveTo && !Number.isFinite(endsAt))) return "待确认";
    if (Number.isFinite(endsAt) && endsAt <= now) return "失效";
    if (Number.isFinite(startsAt) && startsAt > now) return "待生效";
    return "有效";
  }
  function lifecycleStateOf(resource) { return businessValidityStateOf(resource); }
  function publishedResourceAvailable(resource) { return publicationStateOf(resource) === "Published" && businessValidityStateOf(resource) === "有效"; }
  function lifecycleTone(label) {
    if (["Published", "有效"].includes(label)) return "green";
    if (label === "Draft") return "blue";
    if (["停用", "失效"].includes(label)) return "red";
    return "amber";
  }
  function newBindingStateOf(resource, version = null) {
    if (!resource) return "待确认";
    if (version && resourceReplacementContext(version, resource).replacedBy.length) return "不可新绑定（已被后续版本替代）";
    if (!publishedResourceAvailable(resource)) return "不可新绑定";
    if (["recommended", "unknown"].includes(resource.businessBasis)) return "不可新绑定";
    return resource.bindability === "可新绑定" ? "可新绑定" : resource.bindability || "待确认";
  }
  function makeId(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
  function stableSemanticId(prefix, value) {
    const normalized = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
    const code = normalized.startsWith(`${prefix}-`) ? normalized.slice(prefix.length + 1) : normalized;
    return code ? `${prefix}-${code}` : "";
  }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }

  function defaultPropertyUnit(name, dataType) {
    if (dataType !== "数值") return "—";
    if (/利率|占比/.test(name)) return "%";
    if (/汇率/.test(name)) return "人民币/原币";
    if (/原币/.test(name)) return "原币金额";
    if (/余额|金额/.test(name)) return "人民币元";
    return "数值";
  }

  function defaultTerms(resource) {
    const special = {
      "OBJ-FINANCING-ENTITY": { synonyms: ["融资单位", "融资主体单位"], abbreviation: "", discouraged: "公司", discouragedReason: "集团范围内的融资主体不一定都是公司法人" },
      "MET-WAVG-FINANCING-COST": { synonyms: ["综合融资成本", "平均融资利率"], abbreviation: "", discouraged: "平均利率", discouragedReason: "容易被误解为借据利率的简单平均" },
      "ACTION-FINANCING-OPTIMIZATION": { synonyms: ["融资优化行动"], abbreviation: "", discouraged: "自动优化融资", discouragedReason: "行动必须经人工确认后才进入后续处理" }
    }[resource?.id] || {};
    return { preferredName: resource?.name || "", synonyms: special.synonyms || [], abbreviation: special.abbreviation || "", discouraged: special.discouraged || "", discouragedReason: special.discouragedReason || "" };
  }

  function defaultReleaseContract(draft = null) {
    return {
      owner: ONTOLOGY_DEFINITION_OWNER,
      effectiveFrom: "",
      effectiveTo: "",
      changeReason: "待确认",
      replacementMode: "待确认",
      replacementResourceIds: [],
      replacementMap: {},
      replacementDeclaration: "待确认",
      evidenceState: "尚未形成",
      confirmed: false
    };
  }

  function ensureDraftReleaseContract(draft) {
    if (!draft) return;
    draft.release = { ...defaultReleaseContract(draft), ...(draft.release || {}) };
    draft.release.owner = ONTOLOGY_DEFINITION_OWNER;
    draft.release.replacementResourceIds = Array.isArray(draft.release.replacementResourceIds) ? draft.release.replacementResourceIds : [];
    draft.release.replacementMap = draft.release.replacementMap && typeof draft.release.replacementMap === "object" ? draft.release.replacementMap : {};
    if (!draft.release.replacementMode) draft.release.replacementMode = draft.release.replacementDeclaration === "无替代关系" ? "无替代关系" : "待确认";
    if (draft.release.confirmed === undefined) draft.release.confirmed = !!draft.release.effectiveFrom && !!draft.release.changeReason && draft.release.changeReason !== "待确认" && draft.release.replacementMode !== "待确认";
    if (draft.release.replacementMode !== "替代指定资源") draft.release.replacementDeclaration = draft.release.replacementMode;
  }

  function draftReleaseEffectiveToLabel(draft) {
    ensureDraftReleaseContract(draft);
    if (!draft?.release?.confirmed) return "待确认";
    return draft.release.effectiveTo ? humanDateTime(draft.release.effectiveTo) : "未预设失效时间";
  }

  function replacementReferenceParts(reference) {
    if (!reference) return { versionId: null, semanticVersion: null, resourceId: null };
    if (typeof reference === "object") return { versionId: reference.versionId || null, semanticVersion: reference.semanticVersion || null, resourceId: reference.resourceId || null };
    const value = String(reference);
    const parts = value.split("·").map(item => item.trim()).filter(Boolean);
    return parts.length > 1 ? { versionId: null, semanticVersion: parts[0], resourceId: parts.slice(1).join(" · ") } : { versionId: null, semanticVersion: null, resourceId: value };
  }

  function replacementReferenceLabel(reference) {
    const parts = replacementReferenceParts(reference);
    return [parts.semanticVersion, parts.resourceId].filter(Boolean).join(" · ") || "待确认";
  }

  function replacementReferenceMatches(reference, version, resourceId) {
    const parts = replacementReferenceParts(reference);
    return parts.resourceId === resourceId && (!parts.versionId || parts.versionId === version?.id) && (!parts.semanticVersion || parts.semanticVersion === version?.semanticVersion);
  }

  function resourceReplacementContext(version, resource) {
    const replaces = Array.isArray(resource?.replaces) ? resource.replaces : [];
    const replacedBy = [];
    state.publishedVersions
      .filter(candidate => candidate.ontologyStableId === version?.ontologyStableId && candidate.id !== version?.id)
      .forEach(candidate => {
        publishedResources(candidate).forEach(candidateResource => {
          if ((candidateResource.replaces || []).some(reference => replacementReferenceMatches(reference, version, resource?.id))) {
            replacedBy.push({ versionId: candidate.id, semanticVersion: candidate.semanticVersion, resourceId: candidateResource.id });
          }
        });
      });
    return { replaces, replacedBy };
  }

  function ensureDraftResourceOwners(draft) {
    if (!draft) return;
    draft.objects.forEach(object => {
      object.owner = ONTOLOGY_DEFINITION_OWNER;
      object.properties.forEach(property => { property.owner = ONTOLOGY_DEFINITION_OWNER; });
    });
    [...draft.links, ...draft.metrics, ...draft.rules, ...draft.actions].forEach(resource => { resource.owner = ONTOLOGY_DEFINITION_OWNER; });
  }

  function recommendedBusinessResources(container) {
    return [...(container?.rules || []), ...(container?.actions || [])].filter(resource => resource.businessBasis === "recommended");
  }

  function draftResourceList(draft) {
    if (!draft) return [];
    return [
      ...draft.objects.map(item => ({ ...item, kind: "object" })),
      ...draft.objects.flatMap(object => object.properties.map(item => ({ ...item, kind: "property", parentId: object.id, parentName: object.name }))),
      ...draft.links.map(item => ({ ...item, kind: "link" })),
      ...draft.metrics.map(item => ({ ...item, kind: "metric" })),
      ...draft.rules.map(item => ({ ...item, kind: "rule" })),
      ...draft.actions.map(item => ({ ...item, kind: "action" }))
    ];
  }

  function historicalResourceIdentityConflicts(draft) {
    if (!draft) return [];
    const basedOnVersion = state.publishedVersions.find(version => version.id === draft.basedOnVersionId) || null;
    const inherited = new Set((basedOnVersion ? publishedResources(basedOnVersion) : []).map(resource => `${resource.kind}|${resource.id}`));
    const current = draftResourceList(draft);
    const conflicts = [];
    state.publishedVersions.filter(version => version.ontologyStableId === draft.ontologyStableId).forEach(version => {
      publishedResources(version).forEach(resource => {
        current.filter(candidate => candidate.id === resource.id).forEach(candidate => {
          if (candidate.kind !== resource.kind || !inherited.has(`${candidate.kind}|${candidate.id}`)) {
            conflicts.push({ candidate, resource, version, typeConflict: candidate.kind !== resource.kind });
          }
        });
      });
    });
    return conflicts.filter((item, index, items) => items.findIndex(other => other.candidate.id === item.candidate.id && other.version.id === item.version.id && other.resource.kind === item.resource.kind) === index);
  }

  function draftResourceLifecycleProjection(draft, resource) {
    const baseVersion = state.publishedVersions.find(version => version.id === draft?.basedOnVersionId) || null;
    const baseResource = baseVersion ? publishedResources(baseVersion).find(item => item.id === resource.id && item.kind === resource.kind) : null;
    const retired = replacementRetiredIds(draft).has(resource.id);
    const directlyRetired = draft.release?.replacementResourceIds?.includes(resource.id) || false;
    const parentObject = resource.kind === "property" ? draft.objects.find(object => object.id === resource.parentId) : null;
    const retiredWithParent = retired && !directlyRetired && !!parentObject && draft.release?.replacementResourceIds?.includes(parentObject.id);
    const replaces = Object.entries(draft.release?.replacementMap || {})
      .filter(([, targetId]) => targetId === resource.id)
      .map(([sourceId]) => ({ versionId: baseVersion?.id || null, semanticVersion: baseVersion?.semanticVersion || draft.basedOn || null, resourceId: sourceId }));
    const replacementTargetId = retired ? draft.release?.replacementMap?.[resource.id] || null : null;
    const changeType = retired ? "停用" : !baseResource ? "新增" : sameSemanticDefinition(resource, baseResource) ? "沿用" : "修改";
    const replacementDetail = retiredWithParent
      ? `随父对象 ${parentObject.id} 停用；无直接替代`
      : replacementTargetId
      ? `${baseVersion?.semanticVersion || "来源版本待确认"} · ${resource.id} → ${replacementTargetId}`
      : replaces.length
        ? `替代 ${replaces.map(replacementReferenceLabel).join("、")}`
        : "无";
    return {
      id: resource.id,
      name: resource.name,
      type: TYPE_LABEL[resource.kind] || resource.type || resource.kind,
      kind: resource.kind,
      publicationState: "Draft",
      expectedPublicationState: "Published",
      expectedBusinessValidityState: retired ? "停用" : "按生效与失效时间判定",
      owner: resource.owner || draft.release?.owner || "待确认",
      effectiveFrom: draft.release?.effectiveFrom || null,
      effectiveTo: retired ? draft.release?.effectiveFrom || null : draft.release?.effectiveTo || null,
      changeReason: retiredWithParent ? `随父 Object Type 停用；本 Property 无直接替代：${draft.release?.changeReason || "待确认"}` : draft.release?.changeReason || "待确认",
      changeType,
      replaces,
      replacedBy: [],
      replacementTargetId,
      replacementDetail,
      replacementDeclaration: draft.release?.replacementDeclaration || "待确认",
      applicableScenario: draft.scenario || "待确认",
      publishedVersionContext: "尚未形成",
      sourcePublishedVersion: baseVersion?.semanticVersion || null,
      sourcePublishedVersionId: baseVersion?.id || null,
      lastChangedAt: resource.lastChangedAt || "待确认",
      controlledEvidenceState: "发布成功后形成"
    };
  }

  function renderLifecycleManifestTable(manifest) {
    return `<div class="table-wrap lifecycle-manifest-table"><table><thead><tr><th>业务名称</th><th>资源类型</th><th>追溯标识</th><th>已发布版本</th><th>本版本变更</th><th>状态</th><th>业务有效期</th><th>替代关系</th><th>责任人</th><th>最近语义变更</th><th>证据</th></tr></thead><tbody>${manifest.map(resource => `<tr><td><b>${esc(resource.name)}</b><small>${esc(resource.applicableScenario || "待确认")}</small></td><td>${esc(resource.type)}</td><td class="mono">${esc(resource.id)}</td><td><b>${esc(resource.publishedVersionContext || resource.semanticVersion || "尚未形成")}</b><small>${resource.sourcePublishedVersion ? `基于 ${esc(resource.sourcePublishedVersion)} 修订` : "发布成功后形成"}</small></td><td>${esc(resource.changeType || "待确认")}</td><td><b>${esc(localizeUiText(resource.publicationState || "待确认"))}</b><small>${resource.publicationState === "Draft" ? "发布成功后才成为已发布版本" : `业务 ${esc(resource.expectedBusinessValidityState || resource.businessValidityAtPublish || "待确认")}`}</small></td><td>${esc(humanDateTime(resource.effectiveFrom))} / ${esc(resource.effectiveTo ? humanDateTime(resource.effectiveTo) : "未预设")}</td><td class="mono">${esc(resource.replacementDetail || "无")}</td><td>${esc(resource.owner || "待确认")}</td><td>${esc(resource.lastChangedAt || "待确认")}</td><td>${esc(resource.controlledEvidenceState || resource.controlledEvidenceLocator || "待确认")}</td></tr>`).join("")}</tbody></table></div>`;
  }

  const DRAFT_PRIMARY_STATUS = {
    "not-started": { label: "未开始", tone: "neutral", helper: "尚未建立语义资源" },
    modeling: { label: "建模中", tone: "blue", helper: "需要针对当前内容重新校验" },
    validating: { label: "校验中", tone: "blue", helper: "正在执行统一校验" },
    blocked: { label: "存在阻断", tone: "red", helper: "最新有效校验发现发布阻断" },
    ready: { label: "待发布", tone: "green", helper: "最新有效校验通过且内容未再修改" }
  };

  function draftSemanticResourceCount(draft) {
    return draftResourceList(draft).length;
  }

  function draftPrimaryStatus(draft) {
    const validation = draft?.validation || { status: "idle" };
    if (validation.status === "processing") return "validating";
    if (validation.status === "failed" && validation.checkedAt) return "blocked";
    if (validation.status === "success" && validation.checkedAt) return "ready";
    if (!draftSemanticResourceCount(draft)) return "not-started";
    return "modeling";
  }

  function draftPrimaryStatusMeta(draft) {
    return DRAFT_PRIMARY_STATUS[draftPrimaryStatus(draft)];
  }

  function stableIdExists(draft, id) {
    if (!id || !draft) return false;
    if (draftResourceList(draft).some(item => item.id === id)) return true;
    return state.publishedVersions
      .filter(version => version.ontologyStableId === draft.ontologyStableId)
      .some(version => publishedResources(version).some(resource => resource.id === id));
  }

  function draftResourceSemanticFingerprint(draft, resource) {
    const release = draft?.release || {};
    return JSON.stringify({
      definition: semanticDefinitionSnapshot(resource),
      lifecycle: {
        owner: resource?.owner || release.owner || null,
        effectiveFrom: release.effectiveFrom || null,
        effectiveTo: release.effectiveTo || null,
        changeReason: release.changeReason || null,
        replacementMode: release.replacementMode || null,
        replacementTarget: release.replacementMap?.[resource?.id] || null,
        replaces: Object.entries(release.replacementMap || {}).filter(([, targetId]) => targetId === resource?.id).map(([sourceId]) => sourceId).sort()
      }
    });
  }

  function ensureDraftSemanticTracking(draft) {
    if (!draft) return;
    if (draft.resourceSemanticFingerprintVersion !== 2) {
      draft.resourceSemanticFingerprints = {};
      draft.resourceSemanticFingerprintVersion = 2;
    }
    draft.resourceSemanticFingerprints = draft.resourceSemanticFingerprints || {};
    const activeIds = new Set();
    draftResourceList(draft).forEach(resource => {
      const ref = mutableDraftResource(draft, resource.id); if (!ref) return;
      activeIds.add(resource.id);
      if ((!ref.resource.lastChangedAt || ref.resource.lastChangedAt === "待确认") && ref.resource.semanticChangedAt) ref.resource.lastChangedAt = ref.resource.semanticChangedAt;
      delete ref.resource.semanticChangedAt;
      if (!ref.resource.lastChangedAt) ref.resource.lastChangedAt = "待确认";
      if (!Object.prototype.hasOwnProperty.call(draft.resourceSemanticFingerprints, resource.id)) draft.resourceSemanticFingerprints[resource.id] = draftResourceSemanticFingerprint(draft, ref.resource);
    });
    Object.keys(draft.resourceSemanticFingerprints).filter(id => !activeIds.has(id)).forEach(id => delete draft.resourceSemanticFingerprints[id]);
  }

  function touchChangedDraftResources(draft) {
    if (!draft) return;
    if (draft.resourceSemanticFingerprintVersion !== 2) {
      draft.resourceSemanticFingerprints = {};
      draft.resourceSemanticFingerprintVersion = 2;
    }
    draft.resourceSemanticFingerprints = draft.resourceSemanticFingerprints || {};
    const changedAt = fullNowText();
    const activeIds = new Set();
    draftResourceList(draft).forEach(resource => {
      const ref = mutableDraftResource(draft, resource.id); if (!ref) return;
      activeIds.add(resource.id);
      const fingerprint = draftResourceSemanticFingerprint(draft, ref.resource);
      if (!Object.prototype.hasOwnProperty.call(draft.resourceSemanticFingerprints, resource.id) || draft.resourceSemanticFingerprints[resource.id] !== fingerprint) ref.resource.lastChangedAt = changedAt;
      draft.resourceSemanticFingerprints[resource.id] = fingerprint;
    });
    Object.keys(draft.resourceSemanticFingerprints).filter(id => !activeIds.has(id)).forEach(id => delete draft.resourceSemanticFingerprints[id]);
  }

  function mutableDraftResource(draft, id) {
    if (!draft || !id) return null;
    const object = draft.objects.find(item => item.id === id);
    if (object) return { kind: "object", resource: object, parentObject: null };
    for (const parentObject of draft.objects) {
      const property = parentObject.properties.find(item => item.id === id);
      if (property) return { kind: "property", resource: property, parentObject };
    }
    for (const [kind, collection] of [["link", draft.links], ["metric", draft.metrics], ["rule", draft.rules], ["action", draft.actions]]) {
      const resource = collection.find(item => item.id === id);
      if (resource) return { kind, resource, parentObject: null };
    }
    return null;
  }

  function compatibleTypes(left, right) {
    const normalizedType = value => ({
      "文本标识": "文本",
      "十进制数": "数值",
    })[String(value || "").trim()] || String(value || "").trim();
    return !!left && !!right && normalizedType(left) === normalizedType(right);
  }

  function objectOptions(draft, selectedId = "") {
    return (draft?.objects || []).map(object => `<option value="${esc(object.id)}" ${object.id === selectedId ? "selected" : ""}>${esc(object.name)}</option>`).join("");
  }

  function fieldRecordsFor(draft, object, member = null) {
    const selectedMember = member || draftMembers(draft).find(item => item.id === object?.memberId);
    return assetFieldsFor(draft, object, selectedMember).map(([name, type, sample, id]) => ({
      id: id || null,
      name,
      type,
      sample,
      memberId: selectedMember?.id || null,
      stableIdentityState: id ? "已确认" : "待确认"
    }));
  }

  function fieldForProperty(draft, object, property) {
    if (!property?.sourceFieldId) return null;
    return fieldRecordsFor(draft, object).find(field => field.id === property.sourceFieldId) || null;
  }

  function endpointToken(candidate) {
    return `${candidate.kind}|${candidate.objectId}|${candidate.id}`;
  }

  function endpointCandidates(draft, object) {
    if (!draft || !object) return [];
    const propertyCandidates = object.properties.filter(property => fieldForProperty(draft, object, property) && (property.id === object.identity || property.linkEndpoint)).map(property => ({
      kind: "property",
      objectId: object.id,
      id: property.id,
      type: property.dataType,
      label: `${property.name} · ${property.role}${property.linkEndpoint ? " · Link 端点" : ""}`
    }));
    const existingEndpointIds = new Set(draft.links.flatMap(link => [
      link.source === object.id && link.sourceEndpoint?.kind === "assetField" ? link.sourceEndpoint.id : null,
      link.target === object.id && link.targetEndpoint?.kind === "assetField" ? link.targetEndpoint.id : null
    ]).filter(Boolean));
    const allowedFieldIds = new Set([...(object.linkEndpointFields || []), ...existingEndpointIds]);
    const fieldCandidates = fieldRecordsFor(draft, object).filter(field => allowedFieldIds.has(field.id)).map(field => ({
      kind: "assetField",
      objectId: object.id,
      memberId: object.memberId,
      id: field.id,
      type: field.type,
      label: `${field.name} · 数据资产字段端点`
    }));
    return [...propertyCandidates, ...fieldCandidates];
  }

  function resolveEndpointSelection(draft, token) {
    const [kind, objectId, id] = String(token || "").split("|");
    const object = draft?.objects.find(item => item.id === objectId);
    return endpointCandidates(draft, object).find(candidate => candidate.kind === kind && candidate.id === id) || null;
  }

  function endpointOptionsForObject(draft, objectId, selectedToken = "") {
    const object = draft?.objects.find(item => item.id === objectId);
    const items = endpointCandidates(draft, object);
    return `<option value="">请选择稳定端点</option>${items.map(item => `<option value="${esc(endpointToken(item))}" ${endpointToken(item) === selectedToken ? "selected" : ""}>${esc(item.label)} · ${esc(item.type)}</option>`).join("")}`;
  }

  function dependencyChoices(items, inputName, selectedIds = []) {
    if (!items.length) return `<div class="dependency-empty">当前还没有可选择的依赖资源</div>`;
    const selected = new Set(selectedIds);
    return `<div class="dependency-choices">${items.map(item => `<label class="dependency-choice"><input type="checkbox" name="${esc(inputName)}" value="${esc(item.id)}" ${selected.has(item.id) ? "checked" : ""} /><span class="type-${esc(item.kind || "property")}">${item.kind === "action" ? "A" : (item.kind || "property")[0].toUpperCase()}</span><div><b>${esc(item.code ? `${item.code} · ${item.name}` : item.name)}</b><small class="mono">${esc(item.id)}</small></div></label>`).join("")}</div>`;
  }

  function checkedValues(name) {
    return [...document.querySelectorAll(`input[name="${CSS.escape(name)}"]:checked`)].map(input => input.value);
  }

  function resetDraftValidation(draft = activeDraft()) {
    if (!draft) return;
    touchChangedDraftResources(draft);
    const previous = draft.validation || { status: "idle", checkedAt: null, issues: [] };
    draft.validation = previous.status === "idle" && !previous.checkedAt
      ? { status: "idle", checkedAt: null, issues: [] }
      : { status: "stale", checkedAt: previous.checkedAt || null, issues: clone(previous.issues || []), snapshot: clone(previous.snapshot || null), invalidatedAt: nowText() };
    if (draft.publishRun?.status === "processing") draft.publishRun = { status: "failed", failedAt: nowText(), reason: "发布期间建模内容发生变化，请重新校验后重试。" };
    touchDraft(draft);
  }

  function markDraftSaved(draft = activeDraft()) {
    if (!draft) return;
    if (draft.publishRun?.status === "processing") draft.publishRun = { status: "failed", failedAt: nowText(), reason: "发布期间建模内容发生变化，请重新校验后重试。" };
    touchDraft(draft);
  }

  function nextResourcePosition(draft, kind) {
    const rows = { object: 180, link: 360, metric: 590, rule: 820, action: 930 };
    const collections = { object: draft.objects, link: draft.links, metric: draft.metrics, rule: draft.rules, action: draft.actions };
    const count = (collections[kind] || []).length;
    const width = kind === "action" ? 240 : kind === "object" ? 250 : 215;
    return [100 + (count % 7) * width, rows[kind] + Math.floor(count / 7) * 140];
  }

  function freezeDataContract(draft, mappingVersionId = null) {
    const baseContract = draft.sourceDataContract || null;
    const selectedMemberIds = new Set(draft.objects.map(object => object.memberId).filter(Boolean));
    const members = clone((baseContract?.members || []).filter(member => selectedMemberIds.has(member.id)));
    const selectedRelations = clone((baseContract?.relations || []).filter(relation => selectedMemberIds.has(relation.sourceMemberId) && selectedMemberIds.has(relation.targetMemberId)));
    const objectMappings = clone(draft.objects).map(object => ({
      objectId: object.id,
      memberId: object.memberId,
      identityPropertyId: object.identity,
      titlePropertyId: object.title,
      propertyMappings: object.properties.map(property => ({
        propertyId: property.id,
        definition: property.definition,
        unit: property.unit,
        sourceFieldId: property.sourceFieldId,
        sourceField: property.sourceField,
        dataType: property.dataType,
        role: property.role,
        nullable: property.nullable,
        linkEndpoint: !!property.linkEndpoint
      }))
    }));
    const resolveEndpointField = (objectId, endpoint) => {
      const objectMapping = objectMappings.find(item => item.objectId === objectId);
      if (!objectMapping || !endpoint?.id) return null;
      if (endpoint.kind === "assetField") return { memberId: endpoint.memberId || objectMapping.memberId, fieldId: endpoint.id };
      const propertyMapping = objectMapping.propertyMappings.find(item => item.propertyId === endpoint.id);
      return propertyMapping?.sourceFieldId ? { memberId: objectMapping.memberId, fieldId: propertyMapping.sourceFieldId } : null;
    };
    const linkMappings = clone(draft.links).map(link => {
      const endpoint = linkEndpointInfo(draft, link);
      const source = resolveEndpointField(link.source, link.sourceEndpoint);
      const target = resolveEndpointField(link.target, link.targetEndpoint);
      const assetRelation = source && target ? selectedRelations.find(relation => relation.sourceMemberId === source.memberId && relation.sourceFieldId === source.fieldId && relation.targetMemberId === target.memberId && relation.targetFieldId === target.fieldId) : null;
      return {
        linkId: link.id,
        sourceObjectId: link.source,
        targetObjectId: link.target,
        sourceEndpoint: clone(link.sourceEndpoint),
        targetEndpoint: clone(link.targetEndpoint),
        sourceField: endpoint.sourceFieldName,
        targetField: endpoint.targetFieldName,
        cardinality: link.cardinality,
        assetRelationId: assetRelation?.id || null
      };
    });
    return {
      sourceModule: baseContract?.sourceModule || null,
      contractCode: baseContract?.contractCode || null,
      deliveredAt: baseContract?.deliveredAt || null,
      evidenceLocator: baseContract?.evidenceLocator || null,
      sourceContractFingerprint: baseContract ? snapshotFingerprint(baseContract) : null,
      mappingVersionId,
      assetId: baseContract?.assetId || null,
      assetName: baseContract?.assetName || null,
      assetVersion: draft.pendingUpdate?.dataVersion || baseContract?.assetVersion || null,
      asOf: draft.pendingUpdate?.asOf || baseContract?.asOf || null,
      sourceSnapshotId: baseContract?.sourceSnapshotId || null,
      processingModuleVersion: baseContract?.processingModuleVersion || null,
      publishedAt: baseContract?.publishedAt || null,
      versionDescription: baseContract?.versionDescription || null,
      source: baseContract?.source || null,
      sourceChain: clone(baseContract?.sourceChain || []),
      publicationState: baseContract?.publicationState || null,
      purpose: baseContract?.purpose || null,
      consumptionRestriction: baseContract?.consumptionRestriction || null,
      lineageCheckStatus: baseContract?.lineageCheckStatus || null,
      lineageEvidenceLocator: baseContract?.lineageEvidenceLocator || null,
      mappingEligibility: clone(baseContract?.mappingEligibility || null),
      qualitySummary: clone(baseContract?.qualitySummary || null),
      scope: `${members.length} 个资产成员、${selectedRelations.length} 条资产成员关系`,
      members,
      relations: selectedRelations,
      objectMappings,
      linkMappings
    };
  }

  function versionDataContract(version) { return version?.dataContract || null; }
  function contractMember(contract, id) { return contract?.members?.find(member => member.id === id) || null; }

  function blueprintObject(blueprint, populated = true, sourceDataContract = null) {
    const member = (sourceDataContract?.members || []).find(item => item.id === blueprint.memberId) || null;
    return {
      id: blueprint.id, name: blueprint.name, definition: blueprint.definition, identity: populated ? blueprint.identity : null,
      title: populated ? blueprint.title : null, memberId: populated ? blueprint.memberId : null, count: populated ? blueprint.count : 0,
      objectKind: "业务实体", linkEndpointFields: [], lastChangedAt: "待确认",
      properties: populated ? blueprint.properties.map(([id, name, dataType, sourceField, role]) => {
        const exactField = member?.fields?.find(field => field[0] === sourceField && field[3]) || null;
        return {
          id,
          name,
          dataType,
          unit: defaultPropertyUnit(name, dataType),
          definition: `${blueprint.name}的${name}，用于支撑当前场景的业务理解与计算。`,
          sourceFieldId: exactField?.[3] || null,
          sourceField: exactField?.[0] || null,
          role: role === "Link 端点" ? "普通属性" : role,
          linkEndpoint: role === "Link 端点",
          nullable: role === "身份" ? "否" : "是",
          status: exactField ? "已映射" : "阻断",
          lastChangedAt: "待确认"
        };
      }) : []
    };
  }

  function completeDraft(sourceDataContract, baseVersion = null) {
    const scenarioContext = scenarioContextOf(sourceDataContract);
    const createdAt = fullNowText();
    const sourceContractFingerprint = snapshotFingerprint(sourceDataContract);
    const draft = {
      id: makeId("draft"), ontologyStableId: "ONT-GROUP-FINANCING-OPTIMIZATION", name: "集团融资成本与债务结构优化本体", definition: "以融资主体、融资明细、融资机构和融资负责人组织融资事实、判断与行动。",
      draftName: baseVersion ? `${baseVersion.semanticVersion} 数据合同修订 Draft` : "融资语义 Draft", scenario: scenarioDisplayLabel(scenarioContext), status: "Draft", createdAt, updatedAt: createdAt, basedOn: baseVersion?.semanticVersion || null, basedOnVersionId: baseVersion?.id || null,
      scenarioContext,
      sourceDeliveryId: sourceDataContract?.deliveryId || null,
      sourceAssetVersion: sourceDataContract?.assetVersion || null,
      sourceContractFingerprint,
      sourceDeliverySnapshot: clone(sourceDataContract),
      draftRevision: baseVersion ? Number(baseVersion.draftRevision || 1) + 1 : 1,
      replacesDraftId: null,
      sourceDataContract: clone(sourceDataContract),
      objects: OBJECT_BLUEPRINTS.map(item => blueprintObject(item, true, sourceDataContract)), links: clone(LINK_BLUEPRINTS), metrics: clone(METRICS), rules: clone(RULES), actions: clone(ACTIONS),
      positions: clone(POSITION_PRESET), canvasView: { zoom: .64, pan: { x: 24, y: 28 } }, validation: { status: "idle", checkedAt: null, issues: [] }, publishedVersionId: null
    };
    ensureDraftReleaseContract(draft);
    ensureDraftResourceOwners(draft);
    draftResourceList(draft).forEach(resource => { resource.terms = defaultTerms(resource); });
    draft.objects.forEach(object => {
      const source = draftResourceList(draft).find(resource => resource.id === object.id); object.terms = clone(source?.terms || defaultTerms(object));
      object.properties.forEach(property => { property.terms = clone(draftResourceList(draft).find(resource => resource.id === property.id)?.terms || defaultTerms(property)); });
    });
    [...draft.links, ...draft.metrics, ...draft.rules, ...draft.actions].forEach(resource => { resource.terms = clone(defaultTerms(resource)); });
    ensureDraftSemanticTracking(draft);
    return draft;
  }

  function latestS001PublishedVersion(context) {
    return state.publishedVersions
      .filter(version => version.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION" && sameScenarioDefinition(version, context))
      .sort((left, right) => {
        const leftNumber = Number(String(left.semanticVersion || "").match(/\d+/)?.[0] || 0);
        const rightNumber = Number(String(right.semanticVersion || "").match(/\d+/)?.[0] || 0);
        return rightNumber - leftNumber || String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""), "zh-CN");
      })[0] || null;
  }

  function draftHasSemanticContent(draft) {
    return !!draft && [draft.objects, draft.links, draft.metrics, draft.rules, draft.actions].some(collection => Array.isArray(collection) && collection.length > 0);
  }

  function emptyDraft(name = "未命名本体", ontologyStableId = "", definition = "", scenario = "") {
    const scenarioContext = currentScenarioContext();
    const scenarioLabel = String(scenario || "").trim() || scenarioDisplayLabel(scenarioContext);
    const draft = {
      id: makeId("draft"), ontologyStableId, name, definition, draftName: "初始 Draft", scenario: scenarioLabel, status: "Draft", createdAt: nowText(), updatedAt: nowText(), basedOn: null, basedOnVersionId: null,
      scenarioContext: clone(scenarioContext), draftRevision: 1, replacesDraftId: null,
      objects: [], links: [], metrics: [], rules: [], actions: [], positions: {}, canvasView: { zoom: .72, pan: { x: 34, y: 42 } }, validation: { status: "idle", checkedAt: null, issues: [] }, publishedVersionId: null
    };
    ensureDraftReleaseContract(draft);
    return draft;
  }

  function defaultState() {
    return {
      drafts: [], activeDraftId: null, publishedVersions: [], selectedVersionId: null,
      updatesByVersion: {}, bindingsByVersion: {}, recordsByVersion: {},
      externalDataAssets: {}, externalRefreshRequests: {}, refreshRequestReceipts: {}, refreshRequestFingerprints: {}, externalQualityFacts: {}, externalConsumerCompatibility: {}, externalDeliveryIssues: [],
      dataAssetDeliveryReceipts: {}, dataAssetDeliveryFingerprints: {}, scenarioContexts: { S001: clone(DEFAULT_SCENARIO) }, activeScenarioId: "S001", scenarioHistory: [],
      scenarioContextReceipts: {}, pendingScenarioReset: null, scenarioActivationIntent: null,
      storageMigration: { status: "clean", checkedAt: fullNowText(), reason: "未发现需要迁移的旧状态" },
      refreshTargetBindingsByVersion: {}, refreshTargetDiscoveries: {},
      externalValidationRequirements: {}, externalValidationInbox: {}, validationRetryRequests: {}, qualityIncidentsByVersion: {}, combinationIncidents: {}, formalHistory: [], currentFormalVersionIdsByOntology: {}, currentFormalVersionId: null,
      c008ProjectionRevision: 1, c008ProjectionFormedAt: fullNowText(), serial: 0
    };
  }

  let state = loadState();
  let asyncEpoch = 0;
  const ui = {
    modal: null, drawer: null, selectedNode: null, workspaceView: "semantic", semanticEdgeMode: "main", resourceFilter: "all", validationGroup: "all",
    versionResourceView: "cards", versionResourceType: "全部", publishedCanvasView: "semantic", publishedCanvasZoom: .72, mappingSource: null, mappingProperty: null,
    versionResourceQuery: "",
    zoom: .72, pan: { x: 34, y: 42 }, canvasDraftId: null, drag: null, panDrag: null, objectTab: null, versionTab: null, resourceTab: null,
    updateChoice: "compatible", assetObjectId: null, assetChoice: null, assetContractVersion: null, propertyObjectId: null, propertyFieldChoice: null,
    resourceObjectId: null, linkSourceObjectId: null, linkTargetObjectId: null, editResourceId: null,
    propertyForm: null, validationOutcome: "success", adoptSnapshot: null, suppressCanvasClick: false, handoffReturning: false,
    deliveryLookupId: "", deliveryLookupPerformed: false
  };

  function resetUiState() {
    Object.assign(ui, {
      modal: null, drawer: null, selectedNode: null, workspaceView: "semantic", semanticEdgeMode: "main", resourceFilter: "all", validationGroup: "all",
      versionResourceView: "cards", versionResourceType: "全部", publishedCanvasView: "semantic", publishedCanvasZoom: .72, mappingSource: null, mappingProperty: null, versionResourceQuery: "",
      zoom: .72, pan: { x: 34, y: 42 }, canvasDraftId: null, drag: null, panDrag: null, objectTab: null, versionTab: null, resourceTab: null,
      updateChoice: "compatible", assetObjectId: null, assetChoice: null, assetContractVersion: null, propertyObjectId: null, propertyFieldChoice: null,
      resourceObjectId: null, linkSourceObjectId: null, linkTargetObjectId: null, editResourceId: null, propertyForm: null,
      validationOutcome: "success", adoptSnapshot: null, suppressCanvasClick: false, handoffReturning: false,
      deliveryLookupId: "", deliveryLookupPerformed: false
    });
  }

  function loadState() {
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY);
      const legacyPresent = LEGACY_STORAGE_KEYS.filter(key => localStorage.getItem(key) !== null);
      if (!currentRaw) {
        const fresh = defaultState();
        if (legacyPresent.length) fresh.storageMigration = { status: "blocked", checkedAt: fullNowText(), reason: `检测到旧状态 ${legacyPresent.join("、")}，为避免把旧键作为权威真值，未自动迁移` };
        return fresh;
      }
      const saved = JSON.parse(currentRaw);
      if (!saved || typeof saved !== "object" || !Array.isArray(saved.drafts) || !Array.isArray(saved.publishedVersions)) throw new Error("当前状态结构不兼容");
      saved.storageMigration = legacyPresent.length
        ? { status: "isolated", checkedAt: fullNowText(), reason: `当前 v17 状态有效；旧状态 ${legacyPresent.join("、")} 已隔离且不参与权威判断` }
        : (saved.storageMigration || { status: "clean", checkedAt: fullNowText(), reason: "当前状态结构有效" });
      saved.scenarioContexts = saved.scenarioContexts || { S001: clone(DEFAULT_SCENARIO) };
      saved.activeScenarioId = saved.activeScenarioId || "S001";
      saved.scenarioHistory = saved.scenarioHistory || [];
      saved.scenarioContextReceipts = saved.scenarioContextReceipts || {};
      saved.pendingScenarioReset = saved.pendingScenarioReset || null;
      saved.scenarioActivationIntent = saved.scenarioActivationIntent || null;
      saved.isolatedLegacyState = saved.isolatedLegacyState || [];
      saved.dataAssetDeliveryReceipts = saved.dataAssetDeliveryReceipts || {};
      saved.dataAssetDeliveryFingerprints = saved.dataAssetDeliveryFingerprints || {};
      saved.drafts = saved.drafts.filter(draft => {
        const rawContextIssues = scenarioContextIssues(draft?.scenarioContext);
        if (rawContextIssues.length) {
          saved.isolatedLegacyState.push({ kind: "Draft", isolatedAt: fullNowText(), reason: `旧记录缺少完整 C033：${rawContextIssues.join("、")}`, snapshot: clone(draft) });
          saved.storageMigration = { status: "blocked", checkedAt: fullNowText(), reason: "旧 Draft 缺少完整 C033，已隔离" };
          return false;
        }
        const isInjectedLegacyDraft = draft?.sourceDataContract?.assetVersion === "FIN-ASSET-20251130-v01"
          && !Object.values(saved.externalDataAssets || {}).some(asset => asset.deliveryId && asset.assetVersion === draft.sourceDataContract.assetVersion);
        if (isInjectedLegacyDraft) {
          saved.storageMigration = { status: "blocked", checkedAt: fullNowText(), reason: "已隔离未取得合法 C003 交付即生成的旧融资 Draft" };
          return false;
        }
        return true;
      });
      saved.publishedVersions = saved.publishedVersions.filter(version => {
        if (version?.scenarioContext?.scenarioId && version?.scenarioContext?.scenarioVersion && version?.scenarioContext?.scenarioRunId && resolvedExternalTime(version?.scenarioContext?.formedAt) && resolvedExternalValue(version?.scenarioContext?.status)) return true;
        saved.isolatedLegacyState.push({ kind: "Published", isolatedAt: fullNowText(), reason: "旧 Published 记录缺少完整 C033，未自动归入当前场景", snapshot: clone(version) });
        saved.storageMigration = { status: "blocked", checkedAt: fullNowText(), reason: "旧 Published 记录缺少完整 C033，已隔离" };
        return false;
      });
      saved.drafts?.forEach(draft => {
        draft.scenarioContext = scenarioContextOf(draft, saved.scenarioContexts?.[String(draft.scenario || "").match(/^S\d+/)?.[0]] || DEFAULT_SCENARIO);
        draft.draftRevision = draft.draftRevision || 1;
        if (draft.validation?.status === "processing") draft.validation = { status: "idle", checkedAt: null, issues: [] };
        if (draft.publishRun?.status === "processing") draft.publishRun = { status: "failed", failedAt: nowText(), reason: "发布过程被中断，Draft 已保留，请检查后重试。" };
        if (!draft.draftName) draft.draftName = draft.basedOn ? `${draft.basedOn} 修订 Draft` : "初始 Draft";
        if (draft.basedOnVersionId === undefined) draft.basedOnVersionId = (saved.publishedVersions || []).find(version => version.semanticVersion === draft.basedOn && version.ontologyStableId === draft.ontologyStableId)?.id || null;
        if (!draft.canvasView) draft.canvasView = { zoom: .64, pan: { x: 24, y: 28 } };
        ensureDraftReleaseContract(draft);
        draft.actions = draft.actions || draft.actionTypes || [];
        draft.objects = draft.objects || [];
        draft.objects.forEach(object => {
          object.objectKind = object.objectKind || "业务实体";
          object.linkEndpointFields = object.linkEndpointFields || [];
          object.properties = object.properties || [];
          const member = (draft.sourceDataContract?.members || []).find(item => item.id === object.memberId);
          object.properties.forEach(property => {
            property.dataType = property.dataType || property.type || "文本";
            property.unit = property.unit || defaultPropertyUnit(property.name, property.dataType);
            property.definition = property.definition || `${object.name}的${property.name}，用于支撑当前场景的业务理解与计算。`;
            property.sourceFieldId = property.sourceFieldId || null;
            const exactField = property.sourceFieldId && member?.fields?.find(field => field[3] && field[3] === property.sourceFieldId);
            property.status = exactField && compatibleTypes(exactField[1], property.dataType) ? "已映射" : "阻断";
          });
          const identityProperty = object.properties.find(property => property.id === object.identity);
          if (identityProperty) { identityProperty.role = "身份"; identityProperty.nullable = "否"; }
        });
        (draft.metrics || []).forEach(metric => {
          metric.time = metric.time || "数据截至时点";
          metric.zeroHandling = metric.zeroHandling || "分母为零或没有有效数据时返回无法计算";
          metric.calculation = metric.calculation || METRICS.find(item => item.id === metric.id)?.calculation || "按已配置依赖计算";
        });
        (draft.links || []).forEach(link => {
          link.reverseName = link.reverseName || `${objectName(draft, link.target)}关联${objectName(draft, link.source)}`;
          link.allowedDirection = link.allowedDirection || "待确认";
          link.coverage = link.coverage || "等待关系覆盖检查";
        });
        (draft.rules || []).forEach(rule => {
          rule.condition = rule.condition || "按当前业务阈值进行判断";
          rule.definition = rule.definition || `识别${rule.name}相关业务问题。`;
          rule.validity = rule.validity || "随当前 Published 语义版本生效";
          rule.testSample = rule.testSample || "等待配置代表性命中或不命中样例";
          rule.bankRanking = rule.bankRanking || "按对应问题融资余额降序列出前三家银行";
          const knownRule = RULES.find(item => item.id === rule.id);
          rule.businessBasis = rule.businessBasis || knownRule?.businessBasis || "unknown";
          rule.decisionRefs = rule.decisionRefs || clone(knownRule?.decisionRefs || []);
        });
        (draft.actions || []).forEach(action => {
          action.parameters = action.parameters || action.inputs || "目标对象与业务证据";
          action.prerequisite = action.prerequisite || "目标对象与规则证据可追溯";
          action.result = action.result || "形成行动申请，人工确认后进入后续处理";
          action.confirmation = action.confirmation || "必须人工确认";
          action.definition = action.definition || action.requirement || "定义允许请求的业务行动。";
          action.failure = action.failure || "缺少必要参数或前置证据时不形成行动申请，并返回缺失项。";
          action.defaultDue = action.defaultDue || "人工确认后 5 个工作日内完成";
          action.linkIds = action.linkIds || [];
          const knownAction = ACTIONS.find(item => item.id === action.id);
          action.businessBasis = action.businessBasis || knownAction?.businessBasis || "unknown";
          action.decisionRefs = action.decisionRefs || clone(knownAction?.decisionRefs || []);
        });
        ensureDraftResourceOwners(draft);
        ensureDraftSemanticTracking(draft);
        draftResourceList(draft).forEach(resource => { resource.terms = { ...defaultTerms(resource), ...(resource.terms || {}) }; });
      });
      saved.drafts = saved.drafts.filter(draft => {
        const issues = scenarioContextIssues(draft?.scenarioContext);
        if (!issues.length) return true;
        saved.isolatedLegacyState.push({ kind: "Draft", isolatedAt: fullNowText(), reason: `旧 Draft 的 C033 不完整：${issues.join("、")}`, snapshot: clone(draft) });
        saved.storageMigration = { status: "blocked", checkedAt: fullNowText(), reason: "旧 Draft 的完整 C033 无法证明，已隔离" };
        return false;
      });
      (saved.publishedVersions || []).forEach(version => {
        version.scenarioContext = scenarioContextOf(version, saved.scenarioContexts?.[String(version.scenario || "").match(/^S\d+/)?.[0]] || DEFAULT_SCENARIO);
        const receivedDelivery = Object.values(saved.externalDataAssets || {}).find(item => item?.deliveryId === version.sourceDeliveryId) || null;
        const receivedReceipt = version.sourceDeliveryId ? saved.dataAssetDeliveryReceipts?.[version.sourceDeliveryId] || null : null;
        const receivedFingerprint = version.sourceDeliveryId ? saved.dataAssetDeliveryFingerprints?.[version.sourceDeliveryId] || null : null;
        if (!version.sourceDeliverySnapshot && receivedDelivery && receivedReceipt?.status === "accepted" && receivedFingerprint === snapshotFingerprint(receivedDelivery)) {
          version.sourceDeliverySnapshot = clone(receivedDelivery);
          version.sourceDeliveryReceiptSnapshot = clone(receivedReceipt);
          version.sourceDeliveryFingerprint = receivedFingerprint;
        }
        if (!version.resourceManifestSnapshot?.resources?.length) {
          const legacyManifest = clone(version.publishedResourceManifest || version.resourceManifest || []);
          version.resourceManifestSnapshot = {
            versionId: version.id || null,
            semanticVersion: version.semanticVersion || null,
            capturedAt: legacyManifest.length ? version.publishedAt || "待确认" : "待确认",
            resources: legacyManifest.length ? legacyManifest : []
          };
        }
        delete version.publishedResourceManifest;
        delete version.resourceManifest;
      });
      Object.entries(saved.updatesByVersion || {}).forEach(([versionId, update]) => {
        if (update?.phase === "matching") {
          const version = (saved.publishedVersions || []).find(item => item.id === versionId);
          const interruptedAt = fullNowText();
          const result = {
            ...(update.matchResult || {}),
            sourceModule: "本体管理", contractCode: "C029", resultId: update.matchResult?.resultId || makeId("match-result"),
            resultStatus: "未知", status: "unknown", formedAt: update.matchResult?.formedAt || interruptedAt, checkedAt: interruptedAt,
            candidateKey: update.matchResult?.candidateKey || `${version?.id || ""}|${version?.semanticVersion || ""}|${update?.dataVersion || ""}|${update?.asOf || ""}|${update?.candidateRevision || 1}`,
            semanticVersionId: version?.id || update.targetSemanticVersionId || null, semanticVersion: version?.semanticVersion || null,
            t017VersionId: update.targetSemanticVersionId || null, dataAssetId: update.dataAssetId || null, dataVersion: update.dataVersion || null,
            asOf: update.asOf || null, sourceMappingVersionId: update.sourceMappingVersionId || null,
            scenarioContext: clone(scenarioContextOf(update || version)),
            reason: "匹配检查过程被中断，无法确认最终结果",
            recoverySuggestion: "重新执行数据与本体匹配检查；当前正式版本保持不变。", evidenceLocator: null
          };
          update.matchResult = result;
          update.matchResultHistory = [...(update.matchResultHistory || []).filter(item => item?.resultId !== result.resultId || item?.status !== "processing"), clone(result)];
          update.phase = "match_unknown";
          update.failure = result.reason;
          update.eligibility = null;
          saved.recordsByVersion = saved.recordsByVersion || {};
          saved.recordsByVersion[versionId] = saved.recordsByVersion[versionId] || [];
          saved.recordsByVersion[versionId].push({
            id: makeId("record"), title: "数据与本体匹配结果未知", detail: `${result.reason}；当前正式数据未改变。`, status: "未知", tone: "amber",
            time: interruptedAt, semanticVersion: version?.semanticVersion || null, dataVersion: update.dataVersion || null, evidenceCode: null,
            contractCode: "C029", resourceRef: null, sourceModule: "本体管理", externalRunId: null, externalEvidenceRef: null,
            externalValidationContractRef: null, requestedExternalValidationContractRef: null, expectedExternalValidationContractRef: null,
            externalValidationSnapshot: null, decisionRef: null, formsContract: false
          });
        }
        if (update?.phase === "verifying") update.phase = update.validationReference?.status === "processing" ? "verification_pending" : "eligible";
        if (update?.phase === "switching") {
          update.phase = "switch_failed";
          update.failure = "正式切换过程被中断；当前正式数据未改变。";
          update.adoptionRun = { ...(update.adoptionRun || {}), status: "failed", failedAt: nowText(), reason: update.failure };
        }
      });
      const candidates = (saved.publishedVersions || []).filter(version => saved.bindingsByVersion?.[version.id]?.current).sort((left, right) => {
        const leftTime = String(saved.bindingsByVersion?.[left.id]?.current?.switchedAt || "");
        const rightTime = String(saved.bindingsByVersion?.[right.id]?.current?.switchedAt || "");
        return rightTime.localeCompare(leftTime, "zh-CN");
      });
      const currentByOntology = { ...(saved.currentFormalVersionIdsByOntology || {}) };
      const ontologyIds = [...new Set(candidates.map(version => version.ontologyStableId).filter(Boolean))];
      ontologyIds.forEach(ontologyStableId => {
        const ontologyCandidates = candidates.filter(version => version.ontologyStableId === ontologyStableId);
        const explicit = ontologyCandidates.find(version => version.id === currentByOntology[ontologyStableId]);
        const legacy = ontologyCandidates.find(version => version.id === saved.currentFormalVersionId);
        currentByOntology[ontologyStableId] = (explicit || legacy || ontologyCandidates[0])?.id || null;
      });
      saved.currentFormalVersionIdsByOntology = currentByOntology;
      if (!candidates.some(version => version.id === saved.currentFormalVersionId)) saved.currentFormalVersionId = candidates[0]?.id || null;
      const baseline = defaultState();
      saved.externalDataAssets = saved.externalDataAssets || {};
      saved.externalRefreshRequests = saved.externalRefreshRequests || {};
      saved.refreshRequestReceipts = saved.refreshRequestReceipts || {};
      saved.refreshRequestFingerprints = saved.refreshRequestFingerprints || {};
      saved.externalQualityFacts = saved.externalQualityFacts || {};
      saved.externalConsumerCompatibility = saved.externalConsumerCompatibility || {};
      saved.externalDeliveryIssues = saved.externalDeliveryIssues || [];
      saved.refreshTargetBindingsByVersion = saved.refreshTargetBindingsByVersion || {};
      saved.refreshTargetDiscoveries = saved.refreshTargetDiscoveries || {};
      saved.validationRetryRequests = saved.validationRetryRequests || {};
      Object.entries(saved.updatesByVersion || {}).forEach(([versionId, update]) => {
        if (update && (!update.sourceModule || update.sourceModule !== "数据工程" || update.contractCode !== "C028" || !update.requestId)) delete saved.updatesByVersion[versionId];
      });
      Object.values(saved.bindingsByVersion || {}).forEach(slot => {
        if (slot?.current) delete slot.current.consumerValidation;
        if (slot?.previous) delete slot.previous.consumerValidation;
      });
      saved.combinationIncidents = Object.fromEntries(Object.entries(saved.combinationIncidents || {}).filter(([, incident]) => incident?.sourceModule === "数据工程" && incident?.contractCode === "C017" && incident?.evidenceLocator));
      saved.qualityIncidentsByVersion = {};
      Object.entries(saved.recordsByVersion || {}).forEach(([versionId, records]) => {
        saved.recordsByVersion[versionId] = (records || []).filter(record => !(record.contractCode === "C028" && record.sourceModule !== "数据工程") && !(record.contractCode === "C017" && record.sourceModule !== "数据工程")).map(record => {
          const isExternalValidationReference = record.sourceModule === "智能问数"
            && record.externalValidationContractRef === "C008"
            && record.decisionRef === "D064"
            && record.formsContract === false;
          const isValidationRetryRequest = record.title === "已请求智能问数重新验证" && record.formsContract === false;
          if (isValidationRetryRequest) {
            return {
              ...record,
              contractCode: "",
              externalValidationContractRef: null,
              expectedExternalValidationContractRef: null,
              requestedExternalValidationContractRef: record.requestedExternalValidationContractRef || record.externalValidationContractRef || record.expectedExternalValidationContractRef || "C008"
            };
          }
          return isExternalValidationReference && record.contractCode === "C008" ? { ...record, contractCode: "" } : record;
        });
      });
      return { ...baseline, ...saved };
    } catch (error) {
      const fresh = defaultState();
      fresh.storageMigration = { status: "failed", checkedAt: fullNowText(), reason: `当前状态损坏或不兼容：${error?.message || "无法解析"}` };
      return fresh;
    }
  }

  function persist({ refreshProjection = true } = {}) {
    if (refreshProjection) {
      state.c008ProjectionRevision = Math.max(1, Number(state.c008ProjectionRevision || 1)) + 1;
      state.c008ProjectionFormedAt = fullNowText();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (refreshProjection) writeAuthoritativeC008Projection();
  }
  function synchronizeStateFromStorage() {
    const latest = loadState();
    state = latest;
    return state;
  }
  function commit(mutator) { mutator(state); persist(); render(); }
  function activeDraft() {
    const requestedId = routeParams().get("draft");
    const current = currentScenarioContext();
    const available = state.drafts.filter(item => !item.publishedVersionId && sameScenarioEnvelope(item, current));
    return available.find(item => item.id === requestedId) || available.find(item => item.id === state.activeDraftId) || available[0] || null;
  }
  function touchDraft(draft = activeDraft()) { if (draft) draft.updatedAt = nowText(); }
  function loadDraftCanvasView(draft = activeDraft()) {
    const view = draft?.canvasView || { zoom: .72, pan: { x: 34, y: 42 } };
    ui.zoom = view.zoom; ui.pan = clone(view.pan);
  }
  function saveDraftCanvasView(draft = activeDraft()) {
    if (!draft) return;
    draft.canvasView = { zoom: ui.zoom, pan: clone(ui.pan) };
    persist();
  }
  function currentFormalVersionIdFor(ontologyStableId) {
    if (!ontologyStableId) return null;
    const explicit = state.currentFormalVersionIdsByOntology?.[ontologyStableId];
    if (explicit) return explicit;
    const legacy = state.publishedVersions.find(version => version.id === state.currentFormalVersionId);
    return legacy?.ontologyStableId === ontologyStableId ? legacy.id : null;
  }
  function isCurrentFormalVersion(version) {
    if (!version || !sameScenarioEnvelope(version, currentScenarioContext()) || currentFormalVersionIdFor(version.ontologyStableId) !== version.id) return false;
    const binding = state.bindingsByVersion[version.id]?.current;
    return !!binding && sameScenarioEnvelope(binding, version);
  }
  function currentFormalVersion(ontologyStableId = selectedVersion()?.ontologyStableId) { return state.publishedVersions.find(version => version.ontologyStableId === ontologyStableId && isCurrentFormalVersion(version)) || null; }
  function currentFormalSnapshotAnyRun(contextVersion = selectedVersion()) {
    const versionId = currentFormalVersionIdFor(contextVersion?.ontologyStableId);
    const version = state.publishedVersions.find(candidate => candidate.id === versionId && candidate.ontologyStableId === contextVersion?.ontologyStableId) || null;
    const binding = version && state.bindingsByVersion[version.id]?.current;
    return version && binding ? { versionId: version.id, ontologyStableId: version.ontologyStableId, ...clone(binding), semanticVersion: version.semanticVersion } : null;
  }
  function currentFormalSnapshot(contextVersion = selectedVersion()) {
    const version = currentFormalVersion(contextVersion?.ontologyStableId); const binding = version && state.bindingsByVersion[version.id]?.current;
    return version && binding ? { versionId: version.id, ontologyStableId: version.ontologyStableId, ...clone(binding), semanticVersion: version.semanticVersion } : null;
  }
  function rememberFormalSnapshot(snapshot = currentFormalSnapshot()) {
    if (!snapshot || isCombinationBlocked(snapshot)) return;
    state.formalHistory = state.formalHistory || [];
    const key = `${snapshot.versionId}|${snapshot.dataVersion}|${snapshot.switchedAt}`;
    if (!state.formalHistory.some(item => `${item.versionId}|${item.dataVersion}|${item.switchedAt}` === key)) state.formalHistory.push(clone(snapshot));
  }
  function combinationKey(versionId, dataVersion) { return `${versionId || ""}|${dataVersion || ""}`; }
  function combinationIncident(snapshot) {
    if (!snapshot?.versionId || !snapshot?.dataVersion) return null;
    return state.combinationIncidents?.[combinationKey(snapshot.versionId, snapshot.dataVersion)] || null;
  }
  function isCombinationBlocked(snapshot) { return combinationIncident(snapshot)?.status === "blocked"; }
  function previousTrustedCombination(version) {
    if (!isCurrentFormalVersion(version)) return null;
    const current = currentFormalSnapshot(version);
    return (state.formalHistory || []).slice().reverse().find(item =>
      (item.versionId !== current?.versionId || item.dataVersion !== current?.dataVersion) &&
      sameScenarioEnvelope(item, current) &&
      state.publishedVersions.some(candidate => candidate.id === item.versionId && candidate.ontologyStableId === version.ontologyStableId) &&
      !isCombinationBlocked(item) &&
      !!successfulT019RecordForBinding(state.publishedVersions.find(candidate => candidate.id === item.versionId), item)
    ) || null;
  }
  function qualityIncidentFor(version) {
    if (!version) return null;
    const binding = historicalBindingFor(version);
    return combinationIncident({ versionId: version.id, dataVersion: binding?.dataVersion });
  }
  function isCurrentFormalBlocked(version) { return isCurrentFormalVersion(version) && qualityIncidentFor(version)?.status === "blocked"; }
  function historicalBindingFor(version) { return version ? state.bindingsByVersion[version.id]?.current || null : null; }
  function hasFormalCombination(version, dataVersion) {
    if (!version || !resolvedExternalValue(dataVersion)) return false;
    const slot = state.bindingsByVersion?.[version.id] || {};
    const slotMatches = [slot.current, slot.previous].some(binding => binding?.dataVersion === dataVersion);
    const historyMatches = (state.formalHistory || []).some(binding => binding?.versionId === version.id && binding?.dataVersion === dataVersion);
    return slotMatches || historyMatches;
  }
  function formalUseStateOf(version) {
    const binding = historicalBindingFor(version);
    if (isCurrentFormalBlocked(version)) return { label: "当前正式使用已阻断", tone: "red", detail: "当前正式组合已停止新的正式输出" };
    if (isCurrentFormalVersion(version) && !publishedResourceAvailable(version)) return { label: "当前正式使用已阻断", tone: "red", detail: `语义版本业务有效状态为${businessValidityStateOf(version)}` };
    if (isCurrentFormalVersion(version)) return { label: "当前正式使用", tone: "green", detail: "同一本体唯一正在服务的精确版本" };
    if (binding) return { label: "历史只读", tone: "neutral", detail: "保留原正式组合和证据，不再用于新的正式输出" };
    return { label: "待正式数据启用", tone: "amber", detail: "发布时映射合同已冻结，尚未完成人工切换" };
  }
  function publishedMappingContractAssessment(version) {
    const contract = versionDataContract(version);
    const issues = [];
    const sourceDelivery = version?.sourceDeliverySnapshot || dataAssetDeliveryById(version?.sourceDeliveryId);
    const sourceReceipt = version?.sourceDeliveryReceiptSnapshot || (version?.sourceDeliveryId ? state.dataAssetDeliveryReceipts?.[version.sourceDeliveryId] || null : null);
    const recordedFingerprint = version?.sourceDeliveryFingerprint || (version?.sourceDeliveryId ? state.dataAssetDeliveryFingerprints?.[version.sourceDeliveryId] || null : null);
    if (publicationStateOf(version) === "Published" && !resolvedExternalValue(contract?.mappingVersionId)) issues.push("来源映射版本不可定位");
    if (!version?.sourceDeliveryId || !sourceDelivery || sourceReceipt?.status !== "accepted" || sourceReceipt.deliveryId !== version.sourceDeliveryId || sourceReceipt.t006Id !== contract?.assetId || sourceReceipt.t007Version !== contract?.assetVersion || !sameScenarioEnvelope(sourceReceipt, version) || !contract?.sourceContractFingerprint || contract.sourceContractFingerprint !== recordedFingerprint || snapshotFingerprint(sourceDelivery) !== contract.sourceContractFingerprint) issues.push("发布时映射未能回指同一场景轮次中已接收且不可变的数据资产交付快照");
    if (!contract?.assetId || !contract?.assetVersion || !contract?.asOf) issues.push("数据资产版本或数据截至时间缺失");
    if (contract?.publicationState !== "已发布") issues.push("数据资产不是可供本体选择的已发布状态");
    if (!contract?.purpose || !contract?.consumptionRestriction) issues.push("数据资产用途或消费限制缺失");
    if (contract?.mappingEligibility?.status !== "可供本体映射" || !contract?.mappingEligibility?.evidenceLocator) issues.push("数据资产映射资格或证据定位缺失");
    if (contract?.qualitySummary?.status !== "通过" || !contract?.qualitySummary?.evidenceLocator) issues.push("数据资产质量摘要未通过或证据定位缺失");
    if (contract?.lineageCheckStatus !== "通过" || !contract?.lineageEvidenceLocator) issues.push("来源链检查未通过或证据定位缺失");
    if (!Array.isArray(contract?.sourceChain) || !contract.sourceChain.length) issues.push("完整来源链缺失");
    const members = Array.isArray(contract?.members) ? contract.members : [];
    const objectMappings = Array.isArray(contract?.objectMappings) ? contract.objectMappings : [];
    const linkMappings = Array.isArray(contract?.linkMappings) ? contract.linkMappings : [];
    const stableFieldId = (_member, field) => field?.[3] || null;
    const objectMappingFor = objectId => objectMappings.find(item => item.objectId === objectId);
    const resolvedEndpoint = (objectId, endpoint) => {
      const objectMapping = objectMappingFor(objectId);
      if (!objectMapping || !endpoint?.id) return null;
      if (endpoint.kind === "assetField") return { memberId: endpoint.memberId || objectMapping.memberId, fieldId: endpoint.id };
      const propertyMapping = (objectMapping.propertyMappings || []).find(item => item.propertyId === endpoint.id);
      return propertyMapping?.sourceFieldId ? { memberId: objectMapping.memberId, fieldId: propertyMapping.sourceFieldId } : null;
    };
    (version?.objects || []).forEach(object => {
      const mapping = objectMappings.find(item => item.objectId === object.id);
      if (!mapping || !members.some(member => member.id === mapping.memberId)) { issues.push(`${object.name}未锁定资产成员`); return; }
      const member = members.find(item => item.id === mapping.memberId);
      const propertyMappings = mapping.propertyMappings || [];
      const identity = (object.properties || []).find(property => property.id === mapping.identityPropertyId);
      const title = (object.properties || []).find(property => property.id === mapping.titlePropertyId);
      const identityMapping = propertyMappings.find(item => item.propertyId === mapping.identityPropertyId);
      const titleMapping = propertyMappings.find(item => item.propertyId === mapping.titlePropertyId);
      if (!identity || !title || !identityMapping?.sourceFieldId || !titleMapping?.sourceFieldId) issues.push(`${object.name}身份或标题未冻结到当前对象的有效字段映射`);
      if (identity && (identity.role !== "身份" || identity.nullable !== "否")) issues.push(`${object.name}身份必须标记为非空稳定身份`);
      if (identityMapping?.sourceFieldId !== member?.identityFieldId) issues.push(`${object.name}身份未映射到资产成员声明的稳定身份字段`);
      if (member?.identityCheckStatus !== "通过" || Number(member?.identityMissingCount) !== 0 || Number(member?.identityDuplicateCount) !== 0 || !member?.identityEvidenceLocator) issues.push(`${object.name}身份检查存在缺失、重复或证据不可定位`);
      (object.properties || []).forEach(property => {
        const propertyMapping = propertyMappings.find(item => item.propertyId === property.id);
        if (!propertyMapping?.sourceFieldId) { issues.push(`${object.name}.${property.name}未冻结字段映射`); return; }
        const sourceField = member?.fields?.find(field => stableFieldId(member, field) === propertyMapping.sourceFieldId);
        if (!sourceField) issues.push(`${object.name}.${property.name}来源字段不在精确资产成员中`);
        else if (!compatibleTypes(sourceField[1], propertyMapping.dataType || property.dataType)) issues.push(`${object.name}.${property.name}来源类型与 Property 不兼容`);
      });
    });
    const matchedRelations = new Set();
    (version?.links || []).forEach(link => {
      const mapping = linkMappings.find(item => item.linkId === link.id);
      if (!mapping?.sourceEndpoint?.id || !mapping?.targetEndpoint?.id) { issues.push(`${link.name}未冻结关系端点`); return; }
      if (mapping.sourceObjectId !== link.source || mapping.targetObjectId !== link.target) issues.push(`${link.name}映射方向与语义端点不一致`);
      const source = resolvedEndpoint(link.source, mapping.sourceEndpoint);
      const target = resolvedEndpoint(link.target, mapping.targetEndpoint);
      const relation = source && target ? (contract?.relations || []).find(item => item.sourceMemberId === source.memberId && item.sourceFieldId === source.fieldId && item.targetMemberId === target.memberId && item.targetFieldId === target.fieldId) : null;
      if (!relation) issues.push(`${link.name}未对应精确资产关系及两端字段`);
      else {
        matchedRelations.add(relation.id);
        if (mapping.assetRelationId && mapping.assetRelationId !== relation.id) issues.push(`${link.name}冻结的资产关系标识不一致`);
        if (relation.endpointCheckStatus !== "通过" || Number(relation.unmatchedSourceCount) !== 0 || Number(relation.unmatchedTargetCount) !== 0) issues.push(`${link.name}资产关系端点检查未通过`);
      }
    });
    if (version?.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION") {
      const requiredMembers = new Set(S001_REQUIRED_MEMBER_IDS);
      const requiredRelations = new Set(S001_REQUIRED_RELATION_IDS);
      if (members.length !== 4 || [...requiredMembers].some(id => !members.some(member => member.id === id))) issues.push("融资场景未冻结完整四成员范围");
      if ((contract?.relations || []).length !== 3 || [...requiredRelations].some(id => !matchedRelations.has(id))) issues.push("融资场景未由三条 Link 精确覆盖三条资产关系");
    }
    return issues.length
      ? { complete: false, label: "映射合同不完整", tone: "red", detail: issues[0], issues }
      : { complete: true, label: "发布时映射已冻结", tone: "green", detail: `${contract.members.length} 个资产成员与 ${(contract.relations || []).length} 条成员关系已冻结`, issues: [] };
  }

  function draftMappingContractAssessment(draft) {
    if (!draft) return { complete: false, label: "映射合同不完整", tone: "red", detail: "当前 Draft 不存在", issues: ["当前 Draft 不存在"] };
    const source = draft.sourceDataContract || null;
    const delivered = source?.assetVersion ? receivedDataAsset(source.assetId, source.assetVersion) : null;
    const sourceIssues = dataAssetDeliveryIssues(source);
    if (sourceIssues.length || !delivered || snapshotFingerprint(delivered) !== snapshotFingerprint(source)) {
      const issues = sourceIssues.length ? sourceIssues : ["当前 Draft 的数据来源未对应一份已实际接收且不可变的数据资产交付"];
      return { complete: false, label: "映射合同不完整", tone: "red", detail: issues[0], issues };
    }
    return publishedMappingContractAssessment({
      ontologyStableId: draft.ontologyStableId,
      scenarioContext: clone(draft.scenarioContext || source.scenarioContext),
      sourceDeliveryId: draft.sourceDeliveryId || source.deliveryId,
      objects: draft.objects,
      links: draft.links,
      dataContract: freezeDataContract(draft)
    });
  }

  function refreshTargetHistory(version) {
    return version ? state.refreshTargetBindingsByVersion?.[version.id] || [] : [];
  }

  function allRefreshTargets() {
    return Object.values(state.refreshTargetBindingsByVersion || {}).flatMap(items => Array.isArray(items) ? items : []);
  }

  function latestRefreshTargetByStableId(stableId) {
    return allRefreshTargets().filter(target => target.stableId === stableId).sort((left, right) => Number(right.bindingVersion || 0) - Number(left.bindingVersion || 0))[0] || null;
  }

  function latestRefreshTarget(version) {
    return refreshTargetHistory(version).slice().sort((left, right) => Number(right.bindingVersion || 0) - Number(left.bindingVersion || 0))[0] || null;
  }

  function findRefreshTarget(stableId, bindingVersion) {
    return allRefreshTargets().find(target => target.stableId === stableId && String(target.bindingVersion) === String(bindingVersion)) || null;
  }

  function refreshTargetCoverage(version, target) {
    const contract = versionDataContract(version);
    const expectedMemberIds = (contract?.members || []).map(member => member.id);
    const expectedRelationIds = (contract?.relations || []).map(relation => relation.id);
    const actualMemberIds = target?.memberIds || [];
    const actualRelationIds = target?.relationIds || [];
    const memberSet = new Set(actualMemberIds);
    const relationSet = new Set(actualRelationIds);
    const missingMemberIds = expectedMemberIds.filter(id => !memberSet.has(id));
    const missingRelationIds = expectedRelationIds.filter(id => !relationSet.has(id));
    const extraMemberIds = actualMemberIds.filter(id => !expectedMemberIds.includes(id));
    const extraRelationIds = actualRelationIds.filter(id => !expectedRelationIds.includes(id));
    return {
      expectedMemberIds,
      expectedRelationIds,
      actualMemberIds: clone(actualMemberIds),
      actualRelationIds: clone(actualRelationIds),
      missingMemberIds,
      missingRelationIds,
      extraMemberIds,
      extraRelationIds,
      complete: !!version && missingMemberIds.length === 0 && missingRelationIds.length === 0 && extraMemberIds.length === 0 && extraRelationIds.length === 0
    };
  }

  function refreshTargetAssessment(version, target = latestRefreshTarget(version), queryAssetId = null) {
    const blocked = (key, label, contractStatus, reason, recovery) => ({ key, label, contractStatus, allowSubmit: false, tone: key === "not_created" ? "neutral" : "red", reason, recovery });
    if (!target) return blocked("not_created", "尚未建立", "尚未建立", "当前 Published 版本尚未建立数据刷新目标。", "在当前精确版本中核对发布时映射后建立刷新目标。");
    const locatedVersion = state.publishedVersions.find(item => item.id === target.semanticVersionId && item.semanticVersion === target.semanticVersion) || null;
    const latest = latestRefreshTargetByStableId(target.stableId);
    if (!locatedVersion) return blocked("semantic_missing", "Published 版本不可定位", "T017 不可定位", "目标引用的精确 Published 版本不存在或版本号不一致。", "返回已发布本体，选择可定位的精确版本重新建立目标。");
    if (publicationStateOf(locatedVersion) !== "Published" || target.status === "draft") return blocked("not_published", "草稿或未发布", "草稿或未发布", "目标引用的语义资源尚未形成 Published 版本。", "完成统一校验和语义发布后重新建立目标。");
    if (target.status === "disabled" || (latest && (latest.semanticVersionId !== target.semanticVersionId || String(latest.bindingVersion) !== String(target.bindingVersion)))) return blocked("disabled", "已停用", "已停用", target.status === "disabled" ? target.statusReason || "该数据刷新目标已停用。" : `已由绑定版本 ${latest.bindingVersion} 替代。`, "如需恢复，请在目标 Published 版本中重新启用并形成新的绑定版本。");
    if (target.status !== "active") return blocked("unknown", "状态未知", "状态未知", "目标状态无法被识别，不能据此提交数据更新。", "由本体管理核对目标配置并形成新的明确状态版本。");
    if (!publishedResourceAvailable(locatedVersion)) return blocked("disabled", "已停用", "已停用", `目标语义版本的业务有效状态为${businessValidityStateOf(locatedVersion)}。`, "从仍有效的 Published 版本建立刷新目标，或先完成语义版本修订。");
    const contract = versionDataContract(locatedVersion);
    if (!resolvedExternalValue(target.sourceMappingVersionId) || !resolvedExternalValue(contract?.mappingVersionId) || target.sourceMappingVersionId !== contract.mappingVersionId) return blocked("mapping_missing", "来源映射不可定位", "映射版本不可定位", "目标引用的来源映射版本不存在或与 Published 快照不一致。", "从当前 Published 版本重新建立刷新目标；不得按同名映射迁移。");
    if (!resolvedExternalValue(target.dataAssetId)) return blocked("unknown", "状态未知", "状态未知", "目标缺少稳定数据资产身份。", "补齐稳定资产身份后形成新的目标绑定版本。");
    if (queryAssetId && target.dataAssetId !== queryAssetId) return blocked("asset_mismatch", "数据资产不匹配", "与当前 T006 不匹配", "当前查询的数据资产与目标绑定的稳定资产身份不一致。", "由数据工程使用正确的稳定数据资产重新发现；不得拼装目标。");
    const coverage = refreshTargetCoverage(locatedVersion, target);
    const s001Coverage = locatedVersion.ontologyStableId !== "ONT-GROUP-FINANCING-OPTIMIZATION" || (coverage.actualMemberIds.length === 4 && coverage.actualRelationIds.length === 3);
    if (!coverage.complete || !s001Coverage) return blocked("coverage_short", "覆盖范围不足", "成员或关系覆盖不足", "刷新目标未覆盖当前 Published 映射合同的完整成员与关系范围。", "在本体管理中核对四成员、三关系后形成新的完整目标绑定版本。");
    if (!resolvedExternalValue(target.evidenceLocator) || !resolvedExternalTime(target.lastCheckedAt)) return blocked("unknown", "状态未知", "状态未知", "目标缺少最近核验时间或受控证据定位。", "由本体管理重新核验并形成新的目标绑定版本；未恢复前不得提交刷新请求。");
    return { key: "available", label: "可供刷新", contractStatus: "可用", allowSubmit: true, tone: "green", reason: null, recovery: "无需恢复；数据工程仍须在提交前重新读取本发现包。" };
  }

  function currentRefreshTargetCandidates() {
    const byStableId = new Map();
    allRefreshTargets().forEach(target => {
      const previous = byStableId.get(target.stableId);
      if (!previous || Number(target.bindingVersion || 0) > Number(previous.bindingVersion || 0)) byStableId.set(target.stableId, target);
    });
    return [...byStableId.values()];
  }

  function ontologyManagementEntry({ versionId = "", dataAssetId = "", refreshTargetId = "", bindingVersion = "", tab = "updates", returnTo = "", evidenceCode = "", recordId = "", scenarioContext = currentScenarioContext() } = {}) {
    const entry = new URL(window.location.href);
    entry.search = "";
    entry.hash = "";
    const params = new URLSearchParams({ id: versionId, tab, sourceModule: "data-engineering", dataAssetId, semanticVersionId: versionId });
    if (refreshTargetId) params.set("refreshTargetId", refreshTargetId);
    if (bindingVersion) params.set("bindingVersion", String(bindingVersion));
    const safeReturn = safeReturnTarget(returnTo);
    if (safeReturn) params.set("returnTo", safeReturn);
    if (evidenceCode) params.set("evidence", evidenceCode);
    if (recordId) params.set("record", recordId);
    appendScenarioContextParams(params, scenarioContext);
    entry.hash = `published/version?${params.toString()}`;
    return entry.href;
  }

  function refreshTargetCandidate(target, queryAssetId, returnTo = "") {
    const version = state.publishedVersions.find(item => item.id === target.semanticVersionId && item.semanticVersion === target.semanticVersion) || null;
    const assessment = refreshTargetAssessment(version, target, queryAssetId);
    const coverage = refreshTargetCoverage(version, target);
    const evidenceRecord = (state.recordsByVersion[target.semanticVersionId] || []).find(record => record.evidenceCode === target.evidenceLocator) || null;
    const entryContext = { versionId: target.semanticVersionId || "", dataAssetId: queryAssetId || target.dataAssetId || "", refreshTargetId: target.stableId || "", bindingVersion: target.bindingVersion || "", returnTo, scenarioContext: scenarioContextOf(target || version) };
    return {
      refreshTargetId: target.stableId,
      scenarioContext: clone(scenarioContextOf(target || version)),
      bindingVersion: String(target.bindingVersion),
      bindingName: target.name,
      currentStatus: assessment.contractStatus,
      displayStatus: assessment.label,
      allowRefreshSubmission: assessment.allowSubmit,
      semanticVersionId: target.semanticVersionId,
      semanticVersion: target.semanticVersion,
      publishedSemanticVersionId: target.semanticVersionId,
      t017VersionId: target.semanticVersionId,
      sourceMappingVersionId: target.sourceMappingVersionId,
      dataAssetId: target.dataAssetId,
      memberIds: clone(target.memberIds || []),
      relationIds: clone(target.relationIds || []),
      memberCoverage: { expected: coverage.expectedMemberIds.length, covered: coverage.actualMemberIds.length, complete: !coverage.missingMemberIds.length && !coverage.extraMemberIds.length, memberIds: clone(coverage.actualMemberIds), missingMemberIds: clone(coverage.missingMemberIds), extraMemberIds: clone(coverage.extraMemberIds) },
      relationCoverage: { expected: coverage.expectedRelationIds.length, covered: coverage.actualRelationIds.length, complete: !coverage.missingRelationIds.length && !coverage.extraRelationIds.length, relationIds: clone(coverage.actualRelationIds), missingRelationIds: clone(coverage.missingRelationIds), extraRelationIds: clone(coverage.extraRelationIds) },
      owner: target.owner || ONTOLOGY_DEFINITION_OWNER,
      lastCheckedAt: target.lastCheckedAt || target.createdAt || null,
      notAllowedReason: assessment.reason,
      recoverySuggestion: assessment.recovery,
      evidenceLocator: target.evidenceLocator || null,
      managementEntry: ontologyManagementEntry({ ...entryContext, tab: "updates" }),
      evidenceEntry: target.evidenceLocator ? ontologyManagementEntry({ ...entryContext, tab: "records", evidenceCode: target.evidenceLocator, recordId: evidenceRecord?.id || "" }) : null,
      targetFingerprint: snapshotFingerprint(target)
    };
  }

  function discoverRefreshTargets(query = {}) {
    const dataAssetId = query.dataAssetId || query.assetId || query.t006Id || null;
    const readPurpose = query.readPurpose === "提交前重读" ? "提交前重读" : query.readPurpose === "返回重读" ? "返回重读" : "发现";
    const returnTo = safeReturnTarget(query.returnTo) || "";
    const suppliedScenario = query.scenarioContext || query;
    const contextIssues = scenarioContextIssues(suppliedScenario);
    const requestedScenario = scenarioContextOf(suppliedScenario, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null });
    const activeScenario = currentScenarioContext();
    const scenarioMismatch = !contextIssues.length && !sameScenarioEnvelope(requestedScenario, activeScenario);
    const resetPending = !!state.pendingScenarioReset;
    const now = fullNowText();
    const targets = currentRefreshTargetCandidates();
    const candidates = contextIssues.length || scenarioMismatch || resetPending ? [] : targets.map(target => refreshTargetCandidate(target, dataAssetId, returnTo)).filter(candidate => sameScenarioEnvelope(candidate, requestedScenario));
    const relevant = resolvedExternalValue(dataAssetId) ? candidates.filter(candidate => candidate.dataAssetId === dataAssetId) : candidates;
    const usable = relevant.filter(candidate => candidate.allowRefreshSubmission);
    const relatedPublished = state.publishedVersions.filter(version => versionDataContract(version)?.assetId === dataAssetId && publicationStateOf(version) === "Published" && sameScenarioEnvelope(version, requestedScenario));
    const relatedDrafts = state.drafts.filter(draft => !draft.publishedVersionId && draft.sourceDataContract?.assetId === dataAssetId && sameScenarioEnvelope(draft, requestedScenario));
    const recoveryVersion = relatedPublished.sort((left, right) => String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""), "zh-CN"))[0] || null;
    const noRelevantTarget = resolvedExternalValue(dataAssetId) && !relevant.length;
    const overallStatus = resetPending ? "等待新场景轮次" : contextIssues.length ? "状态未知" : scenarioMismatch ? "场景不匹配" : !resolvedExternalValue(dataAssetId) ? "状态未知" : usable.length ? "可用" : noRelevantTarget && recoveryVersion ? "尚未建立" : noRelevantTarget && relatedDrafts.length ? "草稿或未发布" : !targets.length ? "尚未建立" : relevant[0]?.currentStatus || candidates[0]?.currentStatus || "状态未知";
    const response = {
      sourceModule: "本体管理", contractCode: "C032", responseId: makeId("refresh-discovery"), responseVersion: "1", queryDataAssetId: dataAssetId,
      scenarioContext: clone(requestedScenario),
      formedAt: now, readAt: now, readPurpose, status: overallStatus, candidates,
      reason: resetPending ? "定向重置请求已提交，平台公共层尚未返回新的场景运行上下文。" : contextIssues.length ? `场景运行上下文不完整：${contextIssues.join("、")}。` : scenarioMismatch ? "请求的场景身份、版本或轮次与本体管理当前工作投影不一致。" : !resolvedExternalValue(dataAssetId) ? "缺少稳定数据资产身份，不能发现刷新目标。" : usable.length ? null : overallStatus === "草稿或未发布" ? "当前数据资产只关联到尚未发布的本体 Draft。" : noRelevantTarget && recoveryVersion ? "精确 Published 版本尚未建立可返回的数据刷新目标。" : !targets.length ? "尚未建立可返回的数据刷新目标。" : relevant[0]?.notAllowedReason || candidates[0]?.notAllowedReason || "没有可用的数据刷新目标。",
      recoverySuggestion: resetPending ? "等待平台公共层返回新的完整 C033 后，从数据工程重新发起发现；不得沿用旧轮次结果。" : contextIssues.length ? "由数据工程携带平台当前场景的完整身份、版本、轮次、形成时间和状态后重新发现。" : scenarioMismatch ? "返回平台当前场景重新读取根上下文，不得用导航参数或旧轮次继续提交。" : !resolvedExternalValue(dataAssetId) ? "返回数据工程并使用稳定数据资产身份重新发现。" : usable.length ? "提交刷新请求前必须重新读取；不得复用本次发现状态。" : overallStatus === "草稿或未发布" ? "完成统一校验和语义发布，再从精确 Published 版本建立刷新目标。" : noRelevantTarget && recoveryVersion ? "进入本体管理对应 Published 版本，核对发布时映射后建立刷新目标。" : !targets.length ? "进入本体管理对应 Published 版本，核对发布时映射后建立刷新目标。" : relevant[0]?.recoverySuggestion || candidates[0]?.recoverySuggestion || "由本体管理 Owner 核验后重试发现。",
      managementEntry: !resetPending && recoveryVersion ? ontologyManagementEntry({ versionId: recoveryVersion.id, dataAssetId, tab: "updates", returnTo, scenarioContext: requestedScenario }) : null,
      requiresSubmitReread: true
    };
    response.responseFingerprint = snapshotFingerprint(response);
    state.refreshTargetDiscoveries = state.refreshTargetDiscoveries || {};
    state.refreshTargetDiscoveries[response.responseId] = clone(response);
    persist(); render();
    return response;
  }

  function refreshTargetForVersionSnapshot(version) {
    const target = latestRefreshTarget(version); const assessment = refreshTargetAssessment(version, target, versionDataContract(version)?.assetId || null);
    return target ? { ...refreshTargetCandidate(target, versionDataContract(version)?.assetId || null), scenarioContext: clone(scenarioContextOf(version)), semanticVersionId: version.id, assessment: clone(assessment) } : { scenarioContext: clone(scenarioContextOf(version)), semanticVersionId: version?.id || null, currentStatus: assessment.contractStatus, displayStatus: assessment.label, allowRefreshSubmission: false, reason: assessment.reason, recoverySuggestion: assessment.recovery };
  }

  function appendRefreshTargetVersion(version, statusValue, statusReason) {
    const contract = versionDataContract(version); const stableId = stableSemanticId("TARGET", `${version.ontologyStableId}-${contract?.assetId || ""}`);
    const previous = latestRefreshTargetByStableId(stableId);
    const bindingVersion = Math.max(0, ...allRefreshTargets().filter(target => target.stableId === stableId).map(target => Number(target.bindingVersion || 0))) + 1;
    const createdAt = fullNowText();
    const target = {
      stableId, bindingVersion: String(bindingVersion), name: `${version.name} · 数据刷新目标`, status: statusValue, statusReason: statusReason || null,
      semanticVersionId: version.id, semanticVersion: version.semanticVersion, publishedSemanticVersionId: version.id, t017VersionId: version.id,
      scenarioContext: clone(scenarioContextOf(version)),
      sourceMappingVersionId: contract?.mappingVersionId || null, dataAssetId: contract?.assetId || null,
      memberIds: (contract?.members || []).map(member => member.id), relationIds: (contract?.relations || []).map(relation => relation.id), owner: ONTOLOGY_DEFINITION_OWNER,
      createdAt, lastCheckedAt: createdAt, supersedes: previous ? { refreshTargetId: previous.stableId, bindingVersion: previous.bindingVersion, semanticVersionId: previous.semanticVersionId } : null,
      evidenceLocator: null
    };
    state.refreshTargetBindingsByVersion = state.refreshTargetBindingsByVersion || {};
    state.refreshTargetBindingsByVersion[version.id] = [...refreshTargetHistory(version), target];
    const active = statusValue === "active";
    const record = addRecord(version.id, active ? previous ? "数据刷新目标已重新启用" : "数据刷新目标已建立" : "数据刷新目标已停用", active ? `已形成绑定版本 ${target.bindingVersion}；数据工程可以只读发现，但提交数据更新前仍须重新读取。` : `${statusReason || "业务确认停用"}；后续发现将返回不可提交。`, active ? "可供发现" : "已停用", active ? "green" : "red", null, "", { resourceRef: "T054", decisionRef: "CR028" });
    target.evidenceLocator = record.evidenceCode;
    return target;
  }
  function versionRecord(version, referenceCode, dataVersion = null) {
    return (state.recordsByVersion[version?.id] || []).slice().reverse().find(record => {
      const contractCodes = String(record.contractCode || "").split(/\s*\/\s*/).filter(Boolean);
      const resourceRefs = String(record.resourceRef || "").split(/\s*\/\s*/).filter(Boolean);
      return (contractCodes.includes(referenceCode) || resourceRefs.includes(referenceCode)) && (!dataVersion || record.dataVersion === dataVersion);
    }) || null;
  }
  function externalValidationReferenceRecord(version, dataVersion = null) {
    return (state.recordsByVersion[version?.id] || []).slice().reverse().find(record => {
      const snapshot = record.externalValidationSnapshot || null;
      return record.sourceModule === "智能问数"
        && record.formsContract === false
        && record.externalValidationContractRef === "C008"
        && record.decisionRef === "D064"
        && snapshot?.semanticVersionId === version?.id
        && snapshot?.semanticVersion === version?.semanticVersion
        && (!dataVersion || (record.dataVersion === dataVersion && snapshot.dataVersion === dataVersion));
    }) || null;
  }
  function consumerValidationFor(version, consumer) {
    if (!version) return null;
    const binding = historicalBindingFor(version);
    const entries = Object.values(state.externalConsumerCompatibility || {}).filter(item => item.consumer === consumer && item.semanticVersionId === version.id && item.semanticVersion === version.semanticVersion && item.dataVersion === binding?.dataVersion);
    return entries.sort((left, right) => String(right.checkedAt || "").localeCompare(String(left.checkedAt || ""), "zh-CN"))[0] || null;
  }
  function consumerStatusFor(version, consumer) {
    const binding = historicalBindingFor(version);
    if (isCurrentFormalBlocked(version)) return { label: "不可消费", tone: "red", detail: "当前正式数据存在质量阻断" };
    if (!publishedResourceAvailable(version)) return { label: "不可消费", tone: "red", detail: `当前语义版本业务有效状态为${businessValidityStateOf(version)}` };
    if (!isCurrentFormalVersion(version)) return binding
      ? { label: "历史引用", tone: "neutral", detail: "仅供旧结果和证据追溯" }
      : { label: "待正式数据启用", tone: "neutral", detail: "发布时映射合同已冻结，尚未形成人工确认的正式组合" };
    const evidence = consumerValidationFor(version, consumer);
    if (!evidence) return { label: "待确认", tone: "amber", detail: "尚未收到该消费方拥有的兼容状态" };
    return ({
      compatible: { label: "兼容", tone: "green", detail: "消费方已确认当前精确版本兼容" },
      passed: { label: "验证通过", tone: "green", detail: "精确版本与证据已返回" },
      failed: { label: "验证失败", tone: "red", detail: "保留当前正式数据并等待修正" },
      processing: { label: "验证中", tone: "blue", detail: "正在等待消费方返回结果" },
      unknown: { label: "无法判断", tone: "amber", detail: "结果超时、未知或证据不完整" },
      incompatible: { label: "需迁移", tone: "red", detail: "资源类型、单位或适用范围已不兼容" },
      revalidate: { label: "需重验", tone: "amber", detail: "资源变化后需要重新完成消费验证" }
    })[evidence.status] || { label: "待确认", tone: "amber", detail: "尚未取得该消费方的权威状态" };
  }
  function publishedConsumptionState(version) {
    const binding = historicalBindingFor(version);
    if (isCurrentFormalBlocked(version)) return { label: "不可消费", tone: "red", detail: "当前正式数据存在质量阻断" };
    if (!publishedResourceAvailable(version)) return { label: "不可消费", tone: "red", detail: `当前语义版本业务有效状态为${businessValidityStateOf(version)}` };
    if (isCurrentFormalVersion(version) && binding) return { label: "可供消费", tone: "green", detail: "已发布范围与当前正式数据组合均可定位" };
    if (binding) return { label: "历史引用", tone: "neutral", detail: "仅供旧结果和历史证据追溯" };
    return { label: "待正式数据启用", tone: "neutral", detail: "发布时映射已冻结，尚未形成正式使用组合" };
  }
  function isSuccessfulT019Record(record) {
    return record?.resourceRef === "T019" && record.formsContract === true && record.status === "成功" && !!record.evidenceCode;
  }
  function successfulT019RecordForBinding(version, binding) {
    if (!version || !binding) return null;
    return (state.recordsByVersion[version.id] || []).slice().reverse().find(record =>
      isSuccessfulT019Record(record)
      && record.semanticVersion === version.semanticVersion
      && record.dataVersion === binding.dataVersion
      && sameScenarioEnvelope(record, binding)
      && (!binding.candidateKey || record.candidateKey === binding.candidateKey)
      && (!binding.adoptionRecordId || record.id === binding.adoptionRecordId)
      && (!binding.adoptionEvidenceLocator || record.evidenceCode === binding.adoptionEvidenceLocator)
    ) || null;
  }
  function versionContextAssessment(version) {
    const binding = historicalBindingFor(version);
    if (isCurrentFormalBlocked(version)) return { label: "不可消费", tone: "red", complete: false, detail: "当前正式数据存在硬质量问题", issues: ["数据质量阻断"] };
    if (!publishedResourceAvailable(version)) return { label: "不可消费", tone: "red", complete: false, detail: `当前语义版本业务有效状态为${businessValidityStateOf(version)}`, issues: ["语义业务有效状态阻断"] };
    if (!isCurrentFormalVersion(version)) return { label: binding ? "历史上下文" : "上下文未完整", tone: "neutral", complete: false, detail: binding ? "仅供旧结果和历史证据追溯" : "发布时映射合同已冻结，尚未形成正式使用组合", issues: binding ? [] : ["待正式数据启用"] };
    const resources = publishedResources(version);
    const stableIdsReady = resources.length > 0 && resources.every(resource => resource.id) && new Set(resources.map(resource => resource.id)).size === resources.length;
    const linksReady = version.links.length > 0 && version.links.every(link => link.source && link.target && link.sourceEndpoint?.id && link.targetEndpoint?.id && link.endpointCompatible !== false);
    const exactBinding = !!binding && binding.semanticVersion === version.semanticVersion && !!binding.dataVersion && !!binding.asOf;
    const matchRecord = versionRecord(version, "C029", binding?.dataVersion);
    const eligibleRecord = versionRecord(version, "T018", binding?.dataVersion);
    const validationRecord = externalValidationReferenceRecord(version, binding?.dataVersion);
    const adoptionRecord = successfulT019RecordForBinding(version, binding);
    const validation = binding?.candidateValidationReference || null;
    const locatorReady = validation?.status === "passed" && validation?.contractCode === "C008" && validation?.decisionRef === "D064" && !!validation.evidenceLocator && !!binding?.validationEvidenceRef && validation.evidenceLocator === binding.validationEvidenceRef;
    const intelligentQueryCompatibility = consumerValidationFor(version, "智能问数");
    const compatibilityReady = intelligentQueryCompatibility?.status === "compatible";
    const decisionsReady = [...version.rules, ...version.actions].every(resource => !["recommended", "unknown"].includes(resource.businessBasis));
    const issues = [];
    if (!stableIdsReady) issues.push("稳定语义身份缺失或重复");
    if (!linksReady) issues.push("Published Link 不完整");
    if (!exactBinding) issues.push("正式数据版本未锁定");
    if (!matchRecord) issues.push("缺少数据匹配证据");
    if (!eligibleRecord) issues.push("缺少消费验证资格证据");
    if (!validationRecord || !locatorReady) issues.push("候选固定题验证引用或证据定位不完整");
    if (!adoptionRecord) issues.push("缺少正式切换证据");
    if (!compatibilityReady) issues.push("等待智能问数确认正式配置兼容状态");
    if (!decisionsReady) issues.push("业务口径尚未随版本确认");
    return issues.length
      ? { label: "上下文未完整", tone: "amber", complete: false, detail: issues.join("；"), issues }
      : { label: "智能问数上下文完整", tone: "green", complete: true, detail: "稳定身份、精确双版本、Published Link 与验证证据均可定位", issues: [] };
  }
  function selectedVersion() {
    const params = routeParams();
    const currentRoute = route();
    if (currentRoute === "published/version") {
      const requestedId = params.get("id") || params.get("version");
      return requestedId ? state.publishedVersions.find(item => item.id === requestedId) || null : null;
    }
    if (currentRoute === "published/resource") {
      const requestedId = params.get("version");
      return requestedId ? state.publishedVersions.find(item => item.id === requestedId) || null : null;
    }
    return state.publishedVersions.find(item => item.id === state.selectedVersionId) || state.publishedVersions[0] || null;
  }
  function route() { return (location.hash.replace(/^#/, "").split("?")[0] || "modeling"); }
  function routeParams() { return new URLSearchParams(location.hash.split("?")[1] || ""); }
  function handoffContext() {
    const params = routeParams();
    const sourceModule = params.get("sourceModule") || params.get("from") || null;
    const returnTo = params.get("returnTo") || null;
    const dataAssetId = params.get("dataAssetId") || params.get("assetId") || params.get("t006") || null;
    const refreshTargetId = params.get("refreshTargetId") || params.get("targetBindingId") || null;
    const bindingVersion = params.get("bindingVersion") || params.get("targetBindingVersion") || null;
    const semanticVersionId = params.get("semanticVersionId") || params.get("publishedVersionId") || null;
    const fromDataEngineering = sourceModule === "数据工程" || sourceModule === "data-engineering" || !!returnTo || !!dataAssetId || !!refreshTargetId;
    return fromDataEngineering ? { sourceModule: "数据工程", returnTo, dataAssetId, refreshTargetId, bindingVersion, semanticVersionId, scenarioContext: scenarioContextFromParams(params) } : null;
  }
  function safeReturnTarget(value) {
    if (!value) return null;
    try {
      const raw = String(value).trim();
      const target = raw.startsWith("#")
        ? new URL(`${DATA_ENGINEERING_ENTRY_PATH}${raw}`, window.location.origin)
        : new URL(raw, window.location.origin);
      if (target.origin !== window.location.origin || !target.pathname.startsWith(DATA_ENGINEERING_PATH_MARKER)) return null;
      return target.href;
    } catch { return null; }
  }
  function returnTargetWithFreshRead(context, discovery) {
    const safeTarget = safeReturnTarget(context?.returnTo);
    if (!safeTarget || !discovery) return null;
    const target = new URL(safeTarget);
    const untrustedStateKeys = ["status", "success", "available", "ready", "adopted", "consumable", "result", "t019", "t019Status", "refreshStatus"];
    untrustedStateKeys.forEach(key => target.searchParams.delete(key));
    const discoveryRefs = {
      ontologyRefreshDiscoveryId: discovery.responseId,
      ontologyRefreshDiscoveryVersion: discovery.responseVersion,
      ontologyRefreshDiscoveryReadAt: discovery.readAt,
      ontologyRefreshDiscoveryContract: discovery.contractCode,
      dataAssetId: context?.dataAssetId || ""
    };
    const discoveryContext = scenarioContextOf(discovery.scenarioContext, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null });
    const rawHash = target.hash.replace(/^#/, "");
    if (rawHash) {
      const separator = rawHash.indexOf("?");
      const hashPath = separator < 0 ? rawHash : rawHash.slice(0, separator);
      const hashParams = new URLSearchParams(separator < 0 ? "" : rawHash.slice(separator + 1));
      untrustedStateKeys.forEach(key => hashParams.delete(key));
      Object.entries(discoveryRefs).forEach(([key, value]) => value ? hashParams.set(key, value) : hashParams.delete(key));
      appendScenarioContextParams(hashParams, discoveryContext);
      const query = hashParams.toString();
      target.hash = `#${hashPath}${query ? `?${query}` : ""}`;
    } else {
      Object.entries(discoveryRefs).forEach(([key, value]) => value ? target.searchParams.set(key, value) : target.searchParams.delete(key));
      appendScenarioContextParams(target.searchParams, discoveryContext);
    }
    return target.href;
  }
  function handoffTargetSnapshot(context = handoffContext()) {
    const requestedTarget = context?.refreshTargetId && context?.bindingVersion ? findRefreshTarget(context.refreshTargetId, context.bindingVersion) : null;
    const routeVersion = selectedVersion();
    const version = requestedTarget ? state.publishedVersions.find(item => item.id === requestedTarget.semanticVersionId) || null : context?.semanticVersionId ? state.publishedVersions.find(item => item.id === context.semanticVersionId) || null : routeVersion;
    const target = requestedTarget || latestRefreshTarget(version);
    const suppliedContext = context?.scenarioContext || null;
    const contextIssues = scenarioContextIssues(suppliedContext);
    const contextMismatch = !contextIssues.length && !sameScenarioEnvelope(suppliedContext, currentScenarioContext());
    const assessment = contextIssues.length
      ? { key: "scenario_unknown", label: "场景上下文不完整", contractStatus: "状态未知", allowSubmit: false, tone: "red", reason: `数据工程跳转未携带完整场景运行上下文：${contextIssues.join("、")}。`, recovery: "返回平台当前场景重新进入；不得从页面默认值补齐。" }
      : contextMismatch
        ? { key: "scenario_mismatch", label: "场景不匹配", contractStatus: "场景不匹配", allowSubmit: false, tone: "red", reason: "跳转携带的场景身份、版本、轮次、形成时间或状态与当前工作投影不一致。", recovery: "返回平台当前场景重新读取根上下文后再进入。" }
        : refreshTargetAssessment(version, target, context?.dataAssetId || null);
    return { version, target, assessment };
  }
  function handoffQuerySuffix(context = handoffContext()) {
    if (!context) return "";
    const params = new URLSearchParams();
    if (context.sourceModule) params.set("sourceModule", context.sourceModule);
    if (context.returnTo) params.set("returnTo", context.returnTo);
    if (context.dataAssetId) params.set("dataAssetId", context.dataAssetId);
    if (context.refreshTargetId) params.set("refreshTargetId", context.refreshTargetId);
    if (context.bindingVersion) params.set("bindingVersion", context.bindingVersion);
    if (context.semanticVersionId) params.set("semanticVersionId", context.semanticVersionId);
    appendScenarioContextParams(params, context.scenarioContext);
    const value = params.toString();
    return value ? `&${value}` : "";
  }
  function renderHandoffNotice() {
    const context = handoffContext();
    if (!context) return "";
    const { version, target, assessment } = handoffTargetSnapshot(context);
    const safeReturn = safeReturnTarget(context.returnTo);
    return `<section class="handoff-notice ${assessment.allowSubmit ? "ready" : "blocked"}"><div><span>来自数据工程</span><b>${esc(context.dataAssetId || "稳定数据资产待确认")}</b><small>${target ? `${esc(target.name)} · 绑定版本 ${esc(target.bindingVersion)}` : version ? `${esc(version.semanticVersion)} · 尚未建立刷新目标` : "未定位到精确 Published 版本"}</small></div><div class="handoff-notice-state">${status(assessment.label, assessment.tone)}<span>${esc(assessment.allowSubmit ? "返回时将重新读取当前状态" : assessment.reason || "当前不能提交刷新请求")}</span></div><div class="handoff-notice-actions">${target ? btn("查看目标", `open-refresh-target:${version?.id || target.semanticVersionId}`) : version ? btn("处理目标", `open-refresh-target:${version.id}`, { primary: true }) : ""}${safeReturn ? btn(ui.handoffReturning ? "正在重新读取" : "返回数据工程", "return-data-engineering", { primary: true, disabled: ui.handoffReturning }) : status("返回地址无效", "red")}</div></section>`;
  }
  function clearTransientUi() {
    ui.modal = null; ui.drawer = null; ui.editResourceId = null; ui.propertyForm = null;
  }
  function withHandoffContext(hash) {
    const context = handoffContext();
    if (!context || /(?:^|[?&])sourceModule=/.test(hash)) return hash;
    const [path, query = ""] = hash.split("?");
    const params = new URLSearchParams(query);
    if (context.sourceModule) params.set("sourceModule", context.sourceModule);
    if (context.returnTo) params.set("returnTo", context.returnTo);
    if (context.dataAssetId) params.set("dataAssetId", context.dataAssetId);
    if (context.refreshTargetId) params.set("refreshTargetId", context.refreshTargetId);
    if (context.bindingVersion) params.set("bindingVersion", context.bindingVersion);
    if (context.semanticVersionId) params.set("semanticVersionId", context.semanticVersionId);
    appendScenarioContextParams(params, context.scenarioContext);
    return `${path}?${params.toString()}`;
  }
  function go(hash) { clearTransientUi(); const next = withHandoffContext(hash); if (location.hash === `#${next}`) render(); else location.hash = next; }
  function toast(message, tone = "") {
    const region = document.getElementById("toast-region");
    const el = document.createElement("div"); el.className = `toast ${tone}`; el.innerHTML = `<b>${tone === "error" ? "未完成" : "已更新"}</b><span>${esc(localizeUiText(message))}</span>`;
    region.appendChild(el); requestAnimationFrame(() => el.classList.add("show")); setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 220); }, 2600);
  }

  function localizeUiText(value) {
    return String(value ?? "")
      .replace(/行动请求/g, "行动申请")
      .replace(/\bPublished\b/g, "已发布")
      .replace(/\bDraft\b/g, "草稿")
      .replace(/\bOwner\b/g, "责任人")
      .replace(/([\u3400-\u9fff])\s+(已发布|草稿|责任人)/g, "$1$2")
      .replace(/(已发布|草稿|责任人)\s+([\u3400-\u9fff])/g, "$1$2");
  }
  function localizeMainInterface(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, textarea, code, .mono, [data-preserve-technical]")) return;
      const localized = localizeUiText(node.nodeValue);
      if (localized !== node.nodeValue) node.nodeValue = localized;
    });
    root.querySelectorAll('input:not([type="hidden"]):not(.mono):not([data-preserve-technical]), textarea:not(.mono):not([data-preserve-technical])').forEach(control => {
      const localized = localizeUiText(control.value);
      if (localized !== control.value) control.value = localized;
    });
    root.querySelectorAll("[title], [aria-label], [placeholder]").forEach(control => {
      ["title", "aria-label", "placeholder"].forEach(attribute => {
        if (!control.hasAttribute(attribute)) return;
        const localized = localizeUiText(control.getAttribute(attribute));
        if (localized !== control.getAttribute(attribute)) control.setAttribute(attribute, localized);
      });
    });
  }
  function networkIcon(className = "") {
    return `<svg class="network-icon ${esc(className)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="2.5"></circle><circle cx="6" cy="18" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"></path></svg>`;
  }

  function status(label, tone = "neutral") { return `<span class="status ${tone}"><i></i>${esc(localizeUiText(label))}</span>`; }
  function btn(label, action, options = {}) {
    const { primary = false, danger = false, quiet = false, small = false, disabled = false } = options;
    return `<button type="button" class="btn ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${quiet ? "quiet" : ""} ${small ? "small" : ""}" data-action="${esc(action)}" ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
  }

  function shell(content) {
    const current = route().startsWith("published") ? "published" : "modeling";
    const draft = activeDraft(); const version = selectedVersion();
    const versionRoute = ["published/version", "published/resource"].includes(route());
    const context = current === "modeling" ? (draft ? `${draft.name} · ${draft.status}` : "尚未选择本体") : (version ? `${version.name} · ${version.semanticVersion}` : versionRoute ? "未找到请求的精确版本" : "尚无已发布本体");
    return `<div class="app-shell">
      <aside class="platform-rail" aria-label="平台模块栏">
        <button class="platform-logo" data-action="nav-modeling" title="智财问策">${networkIcon("brand-network-icon")}</button>
        <button class="platform-button active" data-action="nav-modeling" title="本体管理" aria-label="本体管理">${networkIcon("module-network-icon")}</button><button class="platform-button" data-action="open-boundary" title="数据工程">数</button>
        <div class="platform-spacer"></div><button class="platform-button" data-action="open-help" title="帮助">?</button><button class="platform-button" data-action="open-reset" title="重置工作区状态">↺</button>
      </aside>
      <nav class="product-nav" aria-label="本体管理导航">
        <div class="product-nav-list"><span class="product-nav-label">产品</span><button class="product-nav-item active" data-action="nav-modeling"><span class="nav-glyph">${networkIcon("module-network-icon")}</span><span>语义资产</span></button></div>
        <div class="product-nav-foot"><strong>S001</strong><span>融资成本与债务结构优化</span><button data-action="open-s003">查看后续场景边界</button></div>
      </nav>
      <section class="app-workspace"><header class="topbar"><div class="breadcrumb">${networkIcon("breadcrumb-network-icon")}<strong>本体管理</strong>${route() !== "modeling" && route() !== "published" ? `<i>›</i><span>${esc(current === "modeling" ? "草稿" : "已发布")}</span>` : ""}</div><div class="workspace-context"><span>${esc(localizeUiText(context))}</span></div></header><main class="main" data-screen-label="本体管理">${content}</main></section>
      ${renderOverlay()}
    </div>`;
  }

  function pageHeader(title, description, actions = "", kicker = "") {
    return `<header class="page-head"><div><span class="kicker">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="page-actions">${actions}</div></header>`;
  }

  function renderLifecycleTabs(active) {
    const current = currentScenarioContext();
    const draftCount = state.drafts.filter(draft => !draft.publishedVersionId && sameScenarioEnvelope(draft, current)).length;
    const ontologyCount = new Set(state.publishedVersions.filter(version => scenarioContextOf(version).scenarioId === current.scenarioId && scenarioContextOf(version).scenarioVersion === current.scenarioVersion).map(version => version.ontologyStableId)).size;
    return `<nav class="lifecycle-tabs" aria-label="本体生命周期"><button class="${active === "draft" ? "active" : ""}" data-action="nav-modeling" aria-current="${active === "draft" ? "page" : "false"}"><span>草稿</span><b>${draftCount}</b></button><button class="${active === "published" ? "active" : ""}" data-action="nav-published" aria-current="${active === "published" ? "page" : "false"}"><span>已发布</span><b>${ontologyCount}</b></button></nav>`;
  }

  function render() {
    const pages = {
      modeling: renderModelingHome,
      "modeling/workbench": renderWorkbench,
      "modeling/object": renderObjectDetail,
      "modeling/mapping": renderMappingWorkspace,
      "modeling/validation": renderValidation,
      published: renderPublishedHome,
      "published/ontology": renderPublishedOntology,
      "published/version": renderPublishedVersion,
      "published/resource": renderPublishedResource
    };
    if (route() === "modeling/workbench" && activeDraft() && ui.canvasDraftId !== activeDraft().id) { loadDraftCanvasView(activeDraft()); ui.canvasDraftId = activeDraft().id; }
    document.getElementById("app").innerHTML = shell(`${renderHandoffNotice()}${(pages[route()] || renderModelingHome)()}`);
    localizeMainInterface(document.getElementById("app"));
    if (route() === "modeling/workbench") requestAnimationFrame(() => { applyWorldTransform(); updateEdges(); });
    if (route() === "modeling/mapping") requestAnimationFrame(updateMappingLines);
    if (ui.modal === "addLink") requestAnimationFrame(refreshLinkEndpointCompatibility);
    if (document.querySelector(".readonly-world")) requestAnimationFrame(updateEdges);
  }

  function renderModelingHome() {
    const current = currentScenarioContext();
    const scenarioReady = currentScenarioContextReady();
    const drafts = state.drafts.filter(draft => !draft.publishedVersionId && sameScenarioEnvelope(draft, current));
    const statusCounts = Object.keys(DRAFT_PRIMARY_STATUS).reduce((result, key) => ({ ...result, [key]: drafts.filter(draft => draftPrimaryStatus(draft) === key).length }), {});
    const visibleDrafts = ui.resourceFilter === "all" ? drafts : drafts.filter(draft => draftPrimaryStatus(draft) === ui.resourceFilter);
    const selectedStatus = DRAFT_PRIMARY_STATUS[ui.resourceFilter] || null;
    return `<div class="page-scroll ontology-home">${pageHeader("本体建模", "创建和修订业务本体，并在发布后维护精确版本、正式数据与消费证据。", btn("创建本体", "open-create-draft", { primary: true, disabled: !scenarioReady }), "语义资产")}
      ${renderLifecycleTabs("draft")}
      ${state.pendingScenarioReset ? `<section class="result-banner warning"><span>…</span><div><b>正在等待新的场景轮次</b><p>定向重置请求 ${esc(state.pendingScenarioReset.requestId)} 已提交。平台公共层返回完整场景上下文前，不能创建当前轮次 Draft 或接收数据资产。</p></div>${status("等待平台返回", "amber")}</section>` : ""}
      ${!state.pendingScenarioReset && !scenarioReady ? `<section class="result-banner warning"><span>…</span><div><b>等待工作场景就绪</b><p>平台当前场景的稳定身份、版本和运行轮次尚未完整送达。本体建模保持空状态，不会自行补齐场景身份。</p></div>${status("不可开始", "amber")}</section>` : ""}
      <section class="workspace-intro"><div><h2>本体建模工作台</h2><p>从业务骨架开始，在对象内部选择已发布数据资产并完成映射；当前内容校验通过后才能发布。</p></div><span>${drafts.length} 个 Draft</span></section>
      <nav class="draft-status-filters" aria-label="草稿状态筛选"><button class="${ui.resourceFilter === "all" ? "active" : ""}" data-action="filter-drafts:all"><span>全部</span><b>${drafts.length}</b></button>${Object.entries(DRAFT_PRIMARY_STATUS).map(([key, meta]) => `<button class="${ui.resourceFilter === key ? "active" : ""}" data-action="filter-drafts:${key}"><span>${esc(meta.label)}</span><b>${statusCounts[key]}</b></button>`).join("")}</nav>
      <section class="panel draft-catalog-panel">
        ${visibleDrafts.length ? `<div class="draft-grid">${visibleDrafts.map(draft => {
          const mapped = draft.objects.filter(obj => obj.memberId).length;
          const primary = draftPrimaryStatusMeta(draft);
          const auxiliary = draft.publishRun?.status === "processing" ? "正在发布语义版本" : draft.validation.status === "stale" ? "上次校验结果已失效" : draft.publishRun?.status === "failed" ? `上次发布失败：${draft.publishRun.reason}` : "";
          return `<article class="draft-card"><div class="draft-card-top"><span class="draft-symbol">${networkIcon("module-network-icon")}</span>${status(primary.label, primary.tone)}</div><h3>${esc(draft.name)}</h3><p>${esc(draft.definition || "尚未填写业务定义")}</p><small class="mono">${esc(draft.ontologyStableId)}</small><div class="draft-facts"><span><b>${draft.objects.length}</b> Object</span><span><b>${draft.links.length}</b> Link</span><span><b>${mapped}</b> 数据资产成员</span></div>${auxiliary ? `<div class="draft-run-note ${draft.publishRun?.status === "failed" ? "error" : ""}"><b>${esc(auxiliary)}</b>${draft.publishRun?.status === "failed" && draftPrimaryStatus(draft) === "ready" ? btn("重试发布", `retry-publish:${draft.id}`, { small: true }) : ""}</div>` : ""}<div class="draft-meta"><span>${esc(draft.draftName || "初始 Draft")}${draft.basedOn ? ` · 基于 ${esc(draft.basedOn)}` : ""}</span><span>保存于 ${esc(draft.updatedAt)}</span></div><div class="card-actions">${btn("进入工作台", `open-draft:${draft.id}`, { primary: true })}</div></article>`;
        }).join("")}</div>` : ui.resourceFilter !== "all" ? `<div class="empty"><span>${networkIcon("module-network-icon")}</span><h3>没有${esc(selectedStatus.label)}的 Draft</h3><p>其他状态的 Draft 不会出现在当前筛选中。</p>${btn("查看全部 Draft", "filter-drafts:all", { primary: true })}</div>` : `<div class="empty"><span>${networkIcon("module-network-icon")}</span><h3>${scenarioReady ? "还没有本体 Draft" : "工作场景尚未就绪"}</h3><p>${scenarioReady ? "先创建一个本体，再建立 Object Type 业务骨架。" : "等待平台提供当前场景的完整运行上下文后，再开始创建本体。"}</p>${btn("创建本体", "open-create-draft", { primary: true, disabled: !scenarioReady })}</div>`}
      </section>
      <section class="modeling-lifecycle"><div class="modeling-lifecycle-head"><h2>建模顺序</h2><p>可从当前阶段继续，也可以随时返回对象、属性、关系或映射位置修正。</p></div><div class="lifecycle-track"><span><b>1</b>创建本体 Draft</span><i></i><span><b>2</b>建立对象骨架</span><i></i><span><b>3</b>对象内选择资产成员</span><i></i><span><b>4</b>显式创建并映射属性</span><i></i><span><b>5</b>配置关系与业务逻辑</span><i></i><span><b>6</b>统一校验与发布</span></div></section>
    </div>`;
  }

  function draftProgress(draft) {
    const membersReady = draft.objects.length > 0 && draft.objects.every(object => object.memberId);
    const propertiesReady = draft.objects.length > 0 && draft.objects.every(object => object.properties.length && object.identity && object.title && object.properties.every(property => fieldForProperty(draft, object, property)));
    const logicReady = draft.links.length > 0 && draft.metrics.length > 0 && draft.rules.length > 0 && draft.actions.length > 0;
    const stages = [
      { label: "创建本体 Draft", done: true },
      { label: "Object 业务骨架", done: draft.objects.length > 0 },
      { label: "选择数据资产成员", done: membersReady },
      { label: "Property 与字段映射", done: propertiesReady },
      { label: "关系与业务逻辑", done: logicReady },
      { label: "统一校验", done: draft.validation.status === "success" },
      { label: "发布语义版本", done: !!draft.publishedVersionId }
    ];
    const firstIncomplete = stages.findIndex(stage => !stage.done);
    return stages.map((stage, index) => ({ ...stage, current: index === firstIncomplete }));
  }

  function draftValidationLabel(draft) {
    return draftPrimaryStatusMeta(draft).label;
  }

  function draftNextStep(draft) {
    if (!draft.objects.length) return { title: "建立业务骨架", detail: "先创建第一个 Object Type；属性不会随源字段自动生成。", label: "新增 Object", action: "open-add-object" };
    const memberPending = draft.objects.find(object => !object.memberId);
    if (memberPending) return { title: `连接${memberPending.name}的数据`, detail: "在对象内选择已发布数据资产成员，再明确创建 Property。", label: "选择数据资产成员", action: `open-object:${memberPending.id}:mapping` };
    const propertyPending = draft.objects.find(object => !object.properties.length || !object.identity || !object.title || object.properties.some(property => !fieldForProperty(draft, object, property)));
    if (propertyPending) return { title: `完成${propertyPending.name}的属性映射`, detail: "逐项创建或映射 Property，并设置身份、标题及关系端点。", label: "继续映射", action: `open-object:${propertyPending.id}:properties` };
    if (!draft.links.length || !draft.metrics.length || !draft.rules.length || !draft.actions.length) return { title: "补齐关系与业务逻辑", detail: "继续配置 Link、Metric、Rule 和 Action Type。", label: "添加语义资源", action: "open-add-resource" };
    if (draft.validation.status !== "success") {
      if (draft.validation.status === "failed") return { title: "修正阻断并重新校验", detail: `${draft.validation.issues?.length || 0} 项问题需要回到原位置修正。`, label: "查看阻断", action: "go-validation" };
      if (draft.validation.status === "stale") return { title: "重新运行统一校验", detail: "建模内容已变化，上次结果不再支持发布。", label: "重新校验", action: "go-validation" };
      return { title: "运行统一校验", detail: "检查对象、属性、关系、映射和业务逻辑合同。", label: "开始校验", action: "go-validation" };
    }
    return { title: "发布语义版本", detail: "发布只形成不可变语义版本，不会自动切换正式数据。", label: "发布语义版本", action: "open-publish" };
  }

  function renderWorkbench() {
    const draft = activeDraft();
    if (!draft) return renderModelingHome();
    const scene = ui.workspaceView === "semantic" ? semanticScene(draft) : lineageScene(draft);
    const highlight = sceneHighlight(scene, ui.selectedNode);
    const selected = findDraftResource(draft, ui.selectedNode);
    const next = draftNextStep(draft);
    const validationTone = draftPrimaryStatusMeta(draft).tone;
    return `<div class="workbench-shell">
      <div class="workbench-head"><header class="workbench-bar"><div class="workbench-title"><button class="back-btn" data-action="nav-modeling">←</button><div><b>${esc(draft.name)}</b><span>${esc(scenarioDisplayLabel(draft))}</span></div></div><div class="view-switch"><button class="${ui.workspaceView === "semantic" ? "active" : ""}" data-action="view-semantic">语义结构</button><button class="${ui.workspaceView === "lineage" ? "active" : ""}" data-action="view-lineage">数据沿袭</button></div><div class="workbench-actions">${btn("新增 Object", "open-add-object")}${btn("统一校验", "go-validation")}${btn("发布语义版本", "open-publish", { primary: true, disabled: draft.validation.status !== "success" })}</div></header>
        <section class="draft-context"><button class="draft-switch" data-action="open-draft-switcher"><span>当前编辑 Draft</span><b>${esc(draft.draftName || draft.id)}</b><small class="mono">${esc(draft.id)}</small><em>切换</em></button><div><span>资源状态</span>${status("Draft", "blue")}</div><div><span>来源版本</span><b>${draft.basedOn ? `基于 ${esc(draft.basedOn)} 创建` : "全新创建"}</b></div><div><span>最近保存</span><b>${esc(draft.updatedAt)}</b></div><div><span>校验状态</span>${status(draftValidationLabel(draft), validationTone)}</div><aside><div><span>推荐下一步</span><b>${esc(next.title)}</b><small>${esc(next.detail)}</small></div>${btn(next.label, next.action, { primary: true, small: true })}</aside></section>
      </div>
      <div class="workbench-grid">
        <aside class="resource-palette">${renderResourcePalette(draft)}</aside>
        <section class="canvas-viewport" id="canvas-viewport">
          <div class="canvas-toolbar"><span>${ui.workspaceView === "semantic" ? ui.semanticEdgeMode === "all" ? "语义结构 · 完整依赖" : "语义结构 · 业务主干" : "只读上游沿袭"}</span>${ui.workspaceView === "semantic" ? `<nav class="edge-mode-switch" aria-label="关系显示范围"><button class="${ui.semanticEdgeMode === "main" ? "active" : ""}" data-action="edge-mode:main">业务主干</button><button class="${ui.semanticEdgeMode === "all" ? "active" : ""}" data-action="edge-mode:all">完整依赖</button></nav>` : ""}<div><button data-action="zoom-out" title="缩小">−</button><b>${Math.round(ui.zoom * 100)}%</b><button data-action="zoom-in" title="放大">＋</button><button data-action="fit-canvas">适配视图</button><button data-action="reset-layout">恢复默认布局</button></div></div>
          <div class="world" id="world" style="width:${WORLD.width}px;height:${WORLD.height}px">
            <svg class="edge-layer" width="${WORLD.width}" height="${WORLD.height}"><defs><marker id="arrow-semantic" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker><marker id="arrow-data" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>${scene.edges.map(edge => renderEdge(edge, highlight)).join("")}</svg>
            ${scene.nodes.map(node => renderCanvasNode(node, highlight)).join("")}
            ${scene.empty || ""}
          </div>
          <div class="canvas-legend"><span><i class="legend-object"></i>业务对象</span><span><i class="legend-link"></i>关系</span><span><i class="legend-metric"></i>指标</span><span><i class="legend-rule"></i>规则</span><span><i class="legend-action"></i>行动类型</span>${ui.workspaceView === "semantic" && (ui.semanticEdgeMode === "all" || ui.selectedNode) ? `<span><i class="legend-dependency"></i>定义依赖</span>` : ""}${ui.workspaceView === "lineage" ? `<span><i class="legend-data"></i>数据资产（只读）</span>` : ""}</div>
        </section>
        <aside class="inspector">${renderInspector(draft, selected)}</aside>
      </div>
      <footer class="progress-ribbon">${draftProgress(draft).map((stage, index) => `<div class="${stage.done ? "done" : ""} ${stage.current ? "current" : ""}"><i>${stage.done ? "✓" : index + 1}</i><span>${esc(stage.label)}</span></div>`).join("")}</footer>
    </div>`;
  }

  function renderResourcePalette(draft) {
    const groups = [
      ["对象", draft.objects, "object"], ["关系", draft.links, "link"], ["指标", draft.metrics, "metric"], ["规则", draft.rules, "rule"], ["行动类型", draft.actions, "action"]
    ];
    return `<div class="palette-head"><b>语义资源</b><span>${draft.objects.length + draft.links.length + draft.metrics.length + draft.rules.length + draft.actions.length} 项</span></div><div class="palette-scroll">${groups.map(([name, items, kind]) => `<section class="palette-group"><div><b>${esc(name)}</b><span>${items.length}</span></div>${items.length ? items.map(item => `<button class="palette-item ${ui.selectedNode === item.id ? "active" : ""}" data-resource="${esc(item.id)}"><i class="type-${kind}">${kind === "action" ? "A" : kind[0].toUpperCase()}</i><span>${esc(item.name)}</span>${kind === "object" ? `<em>${item.memberId ? "已映射" : "待映射"}</em>` : ""}</button>`).join("") : `<p>尚未配置</p>`}</section>`).join("")}</div><div class="palette-foot">${btn("添加资源", "open-add-resource", { small: true })}</div>`;
  }

  function semanticScene(draft) {
    if (!draft.objects.length) return { nodes: [], edges: [], empty: `<div class="canvas-empty"><span>${networkIcon("module-network-icon")}</span><h3>建立 Object Type 业务骨架</h3><p>一级画布只承载业务语义结构；数据字段映射在对象内部完成。</p>${btn("新增 Object", "open-add-object", { primary: true })}</div>` };
    const nodes = [
      ...draft.objects.map(item => ({ ...item, kind: "object", subtitle: item.memberId ? `${item.properties.length} 个属性 · 已选择数据资产成员` : `${item.properties.length} 个属性 · 待选择数据资产成员` })),
      ...draft.links.map(item => ({ ...item, kind: "link", subtitle: `${objectName(draft, item.source)} → ${objectName(draft, item.target)}` })),
      ...draft.metrics.map(item => ({ ...item, kind: "metric", subtitle: `${item.unit} · ${item.scope}` })),
      ...draft.rules.map(item => ({ ...item, kind: "rule", subtitle: `${item.code} · ${item.appliesTo}` })),
      ...draft.actions.map(item => ({ ...item, kind: "action", subtitle: item.target }))
    ].map(node => ({ ...node, pos: draft.positions[node.id] || POSITION_PRESET[node.id] || [200 + Math.random() * 600, 200 + Math.random() * 450] }));
    const ids = new Set(nodes.map(n => n.id));
    const mainEdges = [];
    const auxiliaryEdges = [];
    draft.links.forEach(link => {
      if (ids.has(link.source) && ids.has(link.id)) mainEdges.push({ id: `${link.id}-source`, from: link.source, to: link.id, label: "关系起点", kind: "link", labelT: .42, layer: "main" });
      if (ids.has(link.id) && ids.has(link.target)) mainEdges.push({ id: `${link.id}-target`, from: link.id, to: link.target, label: "关系终点", kind: "link", labelT: .58, layer: "main" });
    });
    draft.metrics.forEach((metric, metricIndex) => {
      const factT = .3 + (metricIndex % 3) * .055;
      const scopeT = .61 + (metricIndex % 2) * .06;
      if (ids.has(metric.sourceObjectId)) auxiliaryEdges.push({ id: `fact-${metric.sourceObjectId}-${metric.id}`, from: metric.sourceObjectId, to: metric.id, label: "事实对象", kind: "dependency", labelT: factT, layer: "auxiliary" });
      if (ids.has(metric.subjectObjectId) && metric.subjectObjectId !== metric.sourceObjectId) auxiliaryEdges.push({ id: `scope-${metric.subjectObjectId}-${metric.id}`, from: metric.subjectObjectId, to: metric.id, label: "适用对象", kind: "dependency", labelT: scopeT, layer: "auxiliary" });
    });
    draft.metrics.forEach((metric, metricIndex) => (metric.dependencyIds || []).forEach(dependencyId => {
      if (draft.links.some(link => link.id === dependencyId)) auxiliaryEdges.push({ id: `dep-${dependencyId}-${metric.id}`, from: dependencyId, to: metric.id, label: "归集依赖", kind: "dependency", labelT: .7 + (metricIndex % 2) * .055, layer: "auxiliary" });
      if (draft.metrics.some(item => item.id === dependencyId) && ids.has(dependencyId)) auxiliaryEdges.push({ id: `dep-${dependencyId}-${metric.id}`, from: dependencyId, to: metric.id, label: "指标依赖", kind: "dependency", labelT: .58, layer: "auxiliary" });
    }));
    draft.rules.forEach(rule => (rule.metricIds || []).filter(id => ids.has(id)).forEach(metricId => {
      mainEdges.push({ id: `dep-${metricId}-${rule.id}`, from: metricId, to: rule.id, label: "判断依据", kind: "logic", labelT: .58, layer: "main" });
    }));
    draft.actions.forEach(action => (action.ruleIds || []).filter(id => ids.has(id)).forEach((ruleId, index) => mainEdges.push({ id: `dep-${ruleId}-${action.id}`, from: ruleId, to: action.id, label: "允许请求", kind: "action", labelT: .5 + (index - 1) * .07, layer: "main" })));
    draft.actions.forEach(action => {
      if (ids.has(action.targetObjectId)) auxiliaryEdges.push({ id: `target-${action.targetObjectId}-${action.id}`, from: action.targetObjectId, to: action.id, label: "目标对象", kind: "dependency", labelT: .72, layer: "auxiliary" });
      (action.linkIds || []).filter(id => ids.has(id)).forEach(linkId => auxiliaryEdges.push({ id: `evidence-${linkId}-${action.id}`, from: linkId, to: action.id, label: "证据导航", kind: "dependency", labelT: .68, layer: "auxiliary" }));
    });
    const selectedId = ui.selectedNode;
    const selectedAuxiliary = selectedId ? auxiliaryEdges.filter(edge => edge.from === selectedId || edge.to === selectedId) : [];
    const requested = ui.semanticEdgeMode === "all" ? [...mainEdges, ...auxiliaryEdges] : [...mainEdges, ...selectedAuxiliary];
    const seen = new Set();
    const edges = requested.filter(edge => {
      const key = `${edge.from}|${edge.to}|${edge.label}|${edge.kind}`;
      if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to || seen.has(key)) return false;
      seen.add(key); return true;
    });
    return { nodes, edges, mainEdges, auxiliaryEdges, empty: "" };
  }

  function publishedSemanticScene(version) {
    const previousSelection = ui.selectedNode;
    const previousMode = ui.semanticEdgeMode;
    ui.selectedNode = null;
    ui.semanticEdgeMode = "main";
    const scene = semanticScene(version);
    ui.selectedNode = previousSelection;
    ui.semanticEdgeMode = previousMode;
    return scene;
  }

  function lineageScene(draft) {
    const selectedMemberIds = new Set(draft.objects.map(object => object.memberId).filter(Boolean));
    const members = draftMembers(draft).filter(member => selectedMemberIds.has(member.id));
    if (!members.length) {
      return {
        nodes: [], edges: [],
        empty: `<div class="canvas-empty"><span>D</span><h3>尚未关联数据资产成员</h3><p>先进入 Object Type，在“数据与映射”中选择已发布数据资产成员。</p>${draft.objects[0] ? btn("选择数据资产成员", `open-object:${draft.objects[0].id}:mapping`, { primary: true }) : btn("新增 Object", "open-add-object", { primary: true })}</div>`
      };
    }
    const sourceChain = draft.sourceDataContract?.sourceChain || [];
    const assetName = draft.sourceDataContract?.assetName || "未选择数据资产";
    const chain = [
      { id: "lineage.folder", name: sourceChain[0] || "数据来源", kind: "source", subtitle: "数据来源入口", pos: [100, 480] },
      { id: "lineage.workbook", name: sourceChain[1] || "来源数据", kind: "data", subtitle: "已登记来源", pos: [380, 480] },
      { id: "lineage.pipeline", name: sourceChain[2] || "标准化处理", kind: "process", subtitle: "数据工程拥有 · 只读", pos: [690, 480] },
      { id: "lineage.asset", name: assetName, kind: "asset", subtitle: `${draftDataVersion(draft)} · 截至 ${draftDataAsOf(draft).slice(0, 10)}`, pos: [1000, 480] }
    ];
    const memberNodes = members.map((member, index) => ({ id: member.id, name: member.name, kind: "member", subtitle: `${member.grain} · ${member.rows.toLocaleString("zh-CN")} 行`, pos: [1320, 110 + index * 235] }));
    const fieldNodes = members.map((member, index) => {
      const endpoints = [...new Set(draft.links.flatMap(link => {
        const endpoint = linkEndpointInfo(draft, link);
        const objectId = memberTargetObjectId(member);
        return link.source === objectId ? [endpoint.sourceFieldName] : link.target === objectId ? [endpoint.targetFieldName] : [];
      }).filter(Boolean))];
      return { id: `fields.${member.id}`, name: `${member.name}字段`, kind: "field", subtitle: `${member.fields.length} 个字段 · 身份 ${member.identity}${endpoints.length ? ` · Link端点 ${endpoints.join("、")}` : ""}`, pos: [1580, 110 + index * 235] };
    });
    const objectNodes = draft.objects.filter(o => o.memberId).map((object, index) => ({ id: `target.${object.id}`, resourceId: object.id, name: object.name, kind: "object", subtitle: "本体对象 · 映射入口", pos: [1810, 110 + index * 235] }));
    const nodes = [...chain, ...memberNodes, ...fieldNodes, ...objectNodes];
    const edges = [
      { id: "l1", from: "lineage.folder", to: "lineage.workbook", label: "读取", kind: "data" },
      { id: "l2", from: "lineage.workbook", to: "lineage.pipeline", label: "处理", kind: "data" },
      { id: "l3", from: "lineage.pipeline", to: "lineage.asset", label: "发布", kind: "data" },
      ...members.map(member => ({ id: `l-${member.id}`, from: "lineage.asset", to: member.id, label: "包含", kind: "data" })),
      ...members.map(member => ({ id: `lf-${member.id}`, from: member.id, to: `fields.${member.id}`, label: "字段", kind: "data" })),
      ...draft.objects.filter(o => o.memberId).map(object => ({ id: `lo-${object.id}`, from: `fields.${object.memberId}`, to: `target.${object.id}`, label: "Property / Link端点映射", kind: "mapping" }))
    ];
    return { nodes, edges, empty: "" };
  }

  function nodeSize(kind) {
    if (["object", "asset", "data", "process", "source", "member", "field"].includes(kind)) return [210, 104];
    if (kind === "link") return [220, 74];
    if (kind === "action") return [220, 92];
    return [190, 82];
  }

  function sceneHighlight(scene, selectedResourceId) {
    const selectedNode = scene.nodes.find(node => node.id === selectedResourceId || node.resourceId === selectedResourceId);
    if (!selectedNode) return { active: false, selectedId: null, relatedNodeIds: new Set(), relatedEdgeIds: new Set() };
    const relatedNodeIds = new Set([selectedNode.id]);
    const relatedEdgeIds = new Set();
    scene.edges.forEach(edge => {
      if (edge.from !== selectedNode.id && edge.to !== selectedNode.id) return;
      relatedEdgeIds.add(edge.id); relatedNodeIds.add(edge.from); relatedNodeIds.add(edge.to);
    });
    return { active: true, selectedId: selectedNode.id, relatedNodeIds, relatedEdgeIds };
  }

  function renderCanvasNode(node, highlight = null) {
    const [x, y] = node.pos; const dataKind = ["asset", "data", "process", "source", "member", "field"].includes(node.kind);
    const selected = highlight?.active ? highlight.selectedId === node.id : ui.selectedNode === (node.resourceId || node.id);
    const related = !!highlight?.active && highlight.relatedNodeIds.has(node.id);
    const dimmed = !!highlight?.active && !related;
    if (node.kind === "link") return `<article class="canvas-node semantic-node link ${selected ? "selected" : ""} ${related && !selected ? "related" : ""} ${dimmed ? "dimmed" : ""}" data-node="${esc(node.id)}" data-resource="${esc(node.resourceId || node.id)}" data-drag-node="${esc(node.id)}" style="left:${x}px;top:${y}px">
      <div class="link-core"><span>L</span><div><small>LINK TYPE</small><b>${esc(node.name)}</b></div><em>${esc(node.cardinality || "关系")}</em></div><p>${esc(node.subtitle || "")}</p>
    </article>`;
    return `<article class="canvas-node ${dataKind ? "data-node" : `semantic-node ${node.kind}`} ${selected ? "selected" : ""} ${related && !selected ? "related" : ""} ${dimmed ? "dimmed" : ""}" data-node="${esc(node.id)}" data-resource="${esc(node.resourceId || node.id)}" data-drag-node="${esc(node.id)}" style="left:${x}px;top:${y}px">
      ${dataKind ? `<i class="data-port left"></i><i class="data-port right"></i><div class="data-topline"></div>` : `<div class="semantic-band"></div>`}
      <div class="node-head"><span>${node.kind === "object" ? "O" : node.kind === "link" ? "L" : node.kind === "metric" ? "M" : node.kind === "rule" ? "R" : node.kind === "action" ? "A" : node.kind === "process" ? "P" : node.kind === "field" ? "F" : "D"}</span><small>${esc(dataKind ? "DATA" : TYPE_LABEL[node.kind] || node.kind)}</small></div>
      <b>${esc(node.name)}</b><p>${esc(node.subtitle || "")}</p>
      ${node.kind === "object" ? `<button class="node-open" data-action="open-object:${esc(node.resourceId || node.id)}">配置对象</button>` : dataKind ? `<em>只读</em>` : ""}
    </article>`;
  }

  function renderEdge(edge, highlight = null) {
    const related = !!highlight?.active && highlight.relatedEdgeIds.has(edge.id);
    const dimmed = !!highlight?.active && !related;
    const labelWidth = Math.max(44, String(edge.label || "").length * 12 + 18);
    return `<g class="edge ${esc(edge.kind)} ${related ? "related" : ""} ${dimmed ? "dimmed" : ""}" data-edge-id="${esc(edge.id)}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}" data-label-t="${Number.isFinite(edge.labelT) ? edge.labelT : .5}"><path marker-end="url(#${edge.kind === "data" || edge.kind === "mapping" ? "arrow-data" : "arrow-semantic"})"></path>${edge.label ? `<g class="edge-label"><rect x="${-labelWidth / 2}" y="-9" width="${labelWidth}" height="18" rx="4"></rect><text y="3.5">${esc(edge.label)}</text></g>` : ""}</g>`;
  }

  function findDraftResource(draft, id) {
    return draftResourceList(draft).find(item => item.id === id) || null;
  }

  function renderInspector(draft, resource) {
    if (ui.workspaceView === "lineage" && (!resource || resource.id?.startsWith("lineage") || resource.id?.startsWith("member"))) {
      const ownerLink = draft.links.find(link => link.id === "LINK-ENTITY-OWNER");
      const ownerEndpoint = ownerLink ? linkEndpointInfo(draft, ownerLink) : null;
      const selectedMembers = new Set(draft.objects.map(object => object.memberId).filter(Boolean));
      if (!selectedMembers.size) return `<div class="inspector-empty"><span>D</span><h3>暂无数据沿袭</h3><p>对象选择已发布数据资产成员后，这里将展开对应资产、成员、字段和上游来源链。</p></div>`;
      return `<div class="inspector-head"><span>D</span><div><b>数据沿袭</b><small>来自数据工程的只读证据</small></div></div><div class="inspector-body"><section><h3>完整上游链路</h3><dl><dt>来源</dt><dd>${esc(draft.sourceDataContract?.source || "未提供")}</dd><dt>已发布资产</dt><dd>${esc(draft.sourceDataContract?.assetName || "未选择")}</dd><dt>资产版本</dt><dd>${esc(draftDataVersion(draft))}</dd><dt>已关联范围</dt><dd>${selectedMembers.size} 个资产成员 · ${draftAssetRelations(draft).length} 条资产成员关系</dd><dt>本体关系</dt><dd>${draft.links.length} 条 Link Type</dd><dt>数据截至</dt><dd>${esc(draftDataAsOf(draft))}</dd></dl></section>${ownerEndpoint ? `<section><h3>负责人关系端点</h3><dl><dt>起点</dt><dd>${esc(ownerEndpoint.sourceLabel)} · ${esc(ownerEndpoint.sourceType)}</dd><dt>终点</dt><dd>${esc(ownerEndpoint.targetLabel)} · ${esc(ownerEndpoint.targetType)}</dd><dt>匹配状态</dt><dd>${ownerEndpoint.compatible ? "两端兼容" : "端点不兼容"}</dd></dl></section>` : ""}<div class="boundary-note"><b>只读边界</b><p>本体管理可以查看资产、成员、字段和上游创建链路，但不能修改读取、处理、质量检查或数据资产发布。</p></div></div><div class="inspector-foot">${btn("查看来源详情", "open-lineage-detail", { primary: true })}</div>`;
    }
    if (!resource) return `<div class="inspector-empty"><span>${networkIcon("module-network-icon")}</span><h3>选择语义资源</h3><p>查看定义、稳定身份、生命周期、映射与依赖。</p></div>`;
    const type = TYPE_LABEL[resource.kind] || resource.kind;
    let body = "";
    if (resource.kind === "object") body = `<section><h3>对象定义</h3><p>${esc(resource.definition)}</p><dl><dt>稳定语义身份</dt><dd class="mono">${esc(resource.id)}</dd><dt>身份 Property</dt><dd>${esc(propertyName(resource, resource.identity) || "待设置")}</dd><dt>标题 Property</dt><dd>${esc(propertyName(resource, resource.title) || "待设置")}</dd><dt>数据资产成员</dt><dd>${esc(memberName(resource.memberId) || "待选择")}</dd><dt>实例预览</dt><dd>${resource.memberId ? resource.count.toLocaleString("zh-CN") : "不可用"}</dd></dl></section><section><h3>配置完整度</h3><div class="meter"><i style="width:${resource.memberId && resource.properties.length ? 100 : resource.memberId ? 55 : 28}%"></i></div><p>${resource.memberId && resource.properties.length ? "对象骨架、属性与数据资产成员已连接。" : "进入对象详情继续配置。"}</p></section>`;
    if (resource.kind === "link") {
      const endpoint = linkEndpointInfo(draft, resource);
      body = `<section><h3>关系定义</h3><p>${esc(resource.definition)}</p><dl><dt>方向</dt><dd>${esc(objectName(draft, resource.source))} → ${esc(objectName(draft, resource.target))}</dd><dt>基数</dt><dd>${esc(resource.cardinality)}</dd><dt>起点引用</dt><dd class="mono">${endpoint.sourceEndpointKind === "property" ? "Property" : "资产字段"} · ${esc(endpoint.sourceEndpointId)}</dd><dt>起点字段</dt><dd>${esc(endpoint.sourceLabel)} · ${esc(endpoint.sourceType)}</dd><dt>终点引用</dt><dd class="mono">${endpoint.targetEndpointKind === "property" ? "Property" : "资产字段"} · ${esc(endpoint.targetEndpointId)}</dd><dt>终点字段</dt><dd>${esc(endpoint.targetLabel)} · ${esc(endpoint.targetType)}</dd><dt>兼容状态</dt><dd>${endpoint.compatible ? "两端兼容" : "端点不兼容"}</dd></dl></section>`;
    }
    if (resource.kind === "metric") body = `<section><h3>指标定义</h3><p>${esc(resource.definition)}</p><dl><dt>稳定语义身份</dt><dd class="mono">${esc(resource.id)}</dd><dt>单位</dt><dd>${esc(resource.unit)}</dd><dt>时间语义</dt><dd>${esc(resource.time || "待配置")}</dd><dt>适用范围</dt><dd>${esc(resource.scope)}</dd><dt>无数据处理</dt><dd>${esc(resource.zeroHandling || "待配置")}</dd><dt>精确依赖</dt><dd class="mono">${esc((resource.dependencyIds || []).join("、"))}</dd><dt>责任人</dt><dd>${esc(resource.owner)}</dd></dl></section>`;
    if (resource.kind === "rule") body = `<section><h3>规则定义</h3><p>${esc(resource.definition || "")}</p><dl><dt>规则标识</dt><dd>${esc(resource.code)}</dd><dt>适用对象</dt><dd>${esc(resource.appliesTo)}</dd><dt>判断条件</dt><dd>${esc(resource.condition || "待配置")}</dd><dt>依赖 Metric</dt><dd>${esc(resource.dependency)}</dd><dt>有效期</dt><dd>${esc(resource.validity || "待配置")}</dd><dt>测试样例</dt><dd>${esc(resource.testSample || "待配置")}</dd><dt>银行排序</dt><dd>${esc(resource.bankRanking || "待配置")}</dd><dt>证据要求</dt><dd>${esc(resource.evidence)}</dd><dt>业务口径状态</dt><dd>${resource.businessBasis === "recommended" ? "推荐基线 · 待发布确认" : resource.businessBasis === "unknown" ? "待确认 · 阻断发布" : "已配置"}</dd></dl></section>`;
    if (resource.kind === "action") body = `<section><h3>行动类型定义</h3><p>${esc(resource.definition || "")}</p><dl><dt>目标对象</dt><dd>${esc(resource.target)}</dd><dt>必要输入</dt><dd>${esc(resource.parameters || resource.inputs)}</dd><dt>前置证据</dt><dd>${esc(resource.prerequisite || "待配置")}</dd><dt>预期结果</dt><dd>${esc(resource.result || "待配置")}</dd><dt>失败表现</dt><dd>${esc(resource.failure || "待配置")}</dd><dt>默认办理期限</dt><dd>${esc(resource.defaultDue || "待配置")}</dd><dt>确认要求</dt><dd>${esc(resource.confirmation || resource.requirement)}</dd><dt>业务口径状态</dt><dd>${resource.businessBasis === "recommended" ? "推荐基线 · 待发布确认" : resource.businessBasis === "unknown" ? "待确认 · 阻断发布" : "已配置"}</dd></dl></section><div class="boundary-note"><b>运行边界</b><p>这里只定义可请求的行动类型，不创建提醒、确认或负责人待办。</p></div>`;
    ensureDraftReleaseContract(draft);
    const lifecycle = `<section class="draft-lifecycle"><h3>生命周期与证据</h3><dl><dt>资源状态</dt><dd>草稿</dd><dt>发布状态</dt><dd>未发布</dd><dt>业务有效状态</dt><dd>尚未生效</dd><dt>稳定语义身份</dt><dd class="mono">${esc(resource.id)}</dd><dt>适用场景</dt><dd>${esc(scenarioDisplayLabel(draft))}</dd><dt>责任人</dt><dd>${esc(draft.release.owner || "待确认")}</dd><dt>业务生效时间</dt><dd>${esc(humanDateTime(draft.release.effectiveFrom))}</dd><dt>业务失效时间</dt><dd>${esc(draftReleaseEffectiveToLabel(draft))}</dd><dt>变更原因</dt><dd>${esc(draft.release.changeReason || "待确认")}</dd><dt>替代关系</dt><dd>${esc(draft.release.replacementDeclaration || "待确认")}</dd><dt>受控证据定位</dt><dd>${esc(draft.release.evidenceState || "尚未形成")}</dd><dt>最近语义变更</dt><dd>${esc(resource.lastChangedAt || "待确认")}</dd><dt>草稿最近保存</dt><dd>${esc(draft.updatedAt || "待确认")}</dd><dt>来源版本</dt><dd>${draft.basedOn ? `基于 ${esc(draft.basedOn)} 创建` : "全新创建"}</dd></dl></section>`;
    return `<div class="inspector-head"><span class="type-${resource.kind}">${resource.kind === "action" ? "A" : resource.kind[0].toUpperCase()}</span><div><b>${esc(resource.name)}</b><small>${esc(type)} · 草稿</small></div></div><div class="inspector-body">${lifecycle}${body}</div><div class="inspector-foot">${resource.kind === "object" ? btn("查看详情", `open-object:${resource.id}`) : btn("查看详情", `open-draft-resource:${resource.id}`)}${btn("配置术语", `open-terms:${resource.id}`)}${btn("编辑配置", `edit-resource:${resource.id}`, { primary: true })}</div>`;
  }

  function objectName(draft, id) { return draft.objects.find(o => o.id === id)?.name || id; }
  function propertyName(object, id) { return object.properties.find(p => p.id === id)?.name; }
  function memberName(id, contract = null) { return (contract?.members || activeDraft()?.sourceDataContract?.members || []).find(m => m.id === id)?.name; }
  function draftMembers(draft) { return draft?.sourceDataContract?.members || []; }
  function draftAssetRelations(draft) { return draft?.sourceDataContract?.relations || []; }
  function draftDataVersion(draft) { return draft?.pendingUpdate?.dataVersion || draft?.sourceDataContract?.assetVersion || "未选择"; }
  function draftDataAsOf(draft) { return draft?.pendingUpdate?.asOf || draft?.sourceDataContract?.asOf || "未提供"; }
  function endpointUsage(draft, objectId, fieldId) {
    return draft.links.find(link => {
      return (link.source === objectId && link.sourceEndpoint?.id === fieldId) || (link.target === objectId && link.targetEndpoint?.id === fieldId);
    }) || null;
  }
  function resolveLinkEndpoint(draft, link, side) {
    const endpoint = link[`${side}Endpoint`];
    const objectId = side === "source" ? link.source : link.target;
    const object = draft.objects.find(item => item.id === objectId);
    const members = draftMembers(draft);
    if (!endpoint || !object) return { exists: false, id: endpoint?.id || null, kind: endpoint?.kind || null, fieldName: null, type: "引用缺失", label: `${objectName(draft, objectId)}.未配置` };
    if (endpoint.kind === "property") {
      const property = object.properties.find(item => item.id === endpoint.id);
      const member = members.find(item => item.id === object.memberId);
      const field = property ? fieldForProperty(draft, object, property) : null;
      const exists = !!property && !!field && compatibleTypes(field.type, property.dataType);
      return { exists, id: endpoint.id, kind: endpoint.kind, fieldName: field?.name || null, type: exists ? property.dataType : "引用缺失", label: property && member ? `${member.name}.${field?.name || "需重新映射"}` : `${objectName(draft, objectId)}.${property?.name || endpoint.id}` };
    }
    if (endpoint.kind === "assetField") {
      const member = members.find(item => item.id === endpoint.memberId && item.id === object.memberId);
      const field = assetFieldsFor(draft, object, member).find(item => item[3] === endpoint.id);
      return { exists: !!member && !!field, id: endpoint.id, kind: endpoint.kind, fieldName: field?.[0] || null, type: field?.[1] || "引用缺失", label: member && field ? `${member.name}.${field[0]}` : `${objectName(draft, objectId)}.${endpoint.id}` };
    }
    return { exists: false, id: endpoint.id, kind: endpoint.kind, fieldName: null, type: "引用类型无效", label: `${objectName(draft, objectId)}.${endpoint.id}` };
  }
  function linkEndpointInfo(draft, link) {
    const source = resolveLinkEndpoint(draft, link, "source");
    const target = resolveLinkEndpoint(draft, link, "target");
    return {
      sourceEndpointId: source.id,
      targetEndpointId: target.id,
      sourceEndpointKind: source.kind,
      targetEndpointKind: target.kind,
      sourceFieldName: source.fieldName,
      targetFieldName: target.fieldName,
      sourceLabel: source.label,
      targetLabel: target.label,
      sourceType: source.type,
      targetType: target.type,
      compatible: source.exists && target.exists && compatibleTypes(source.type, target.type)
    };
  }
  function assetFieldsFor(draft, object, member) {
    const change = draft?.pendingFieldChange;
    return (member?.fields || []).map(field => {
      const normalized = [field[0], field[1], field[2], field[3] || null];
      return change && change.objectId === object?.id && normalized[3] === change.fromId ? [change.to, normalized[1], change.sample, change.toId] : normalized;
    });
  }

  function renderObjectDetail() {
    const draft = activeDraft(); const object = draft?.objects.find(o => o.id === routeParams().get("id"));
    if (!draft || !object) return `<div class="page-scroll">${pageHeader("对象不存在", "请返回本体建模工作台重新选择。", btn("返回工作台", "go-workbench", { primary: true }))}</div>`;
    const tab = routeParams().get("tab") || "overview";
    const tabs = [["overview", "概览"], ["properties", "属性"], ["links", "关系"], ["mapping", "数据与映射"], ["logic", "业务逻辑与行动"], ["consumption", "下游消费"]];
    const mappingAction = object.memberId ? btn("配置字段映射", `open-mapping:${object.id}`, { primary: true }) : btn("选择数据资产成员", `choose-member:${object.id}`, { primary: true });
    return `<div class="page-scroll object-page">${pageHeader(object.name, `${object.definition}`, `${btn("返回画布", "go-workbench")}${btn("编辑对象定义", `edit-resource:${object.id}`)}${mappingAction}`, "Object Type · Draft")}
      <div class="resource-identity"><div><span>稳定语义身份</span><b class="mono">${esc(object.id)}</b></div><div><span>身份</span><b>${esc(propertyName(object, object.identity) || "待设置")}</b></div><div><span>标题</span><b>${esc(propertyName(object, object.title) || "待设置")}</b></div><div><span>数据资产成员</span><b>${esc(memberName(object.memberId) || "待选择")}</b></div>${status(object.memberId && object.properties.length ? "配置中" : "待完善", object.memberId && object.properties.length ? "blue" : "amber")}</div>
      <nav class="tabs">${tabs.map(([key, label]) => `<button class="${tab === key ? "active" : ""}" data-action="object-tab:${key}">${esc(label)}</button>`).join("")}</nav>
      ${renderObjectTab(draft, object, tab)}
    </div>`;
  }

  function objectPreviewReadiness(draft, object) {
    if (!object?.memberId) return { ready: false, label: "未选择数据", tone: "neutral", reason: "等待选择数据资产成员" };
    const identity = object.properties.find(property => property.id === object.identity);
    const identityField = fieldForProperty(draft, object, identity);
    if (!identity || !identityField || !compatibleTypes(identityField.type, identity.dataType)) return { ready: false, label: "身份待确认", tone: "amber", reason: "先设置身份 Property 并完成有效字段映射" };
    const member = draftMembers(draft).find(item => item.id === object.memberId);
    if (!member || member.identity !== identityField.name) return { ready: false, label: "身份需核对", tone: "amber", reason: "当前身份字段与数据资产成员的稳定身份声明不一致" };
    return { ready: true, label: "可预览", tone: "green", reason: "身份字段与成员稳定身份声明一致" };
  }

  function renderObjectTab(draft, object, tab) {
    if (tab === "overview") {
      const rows = INSTANCE_ROWS[object.id] || [];
      const preview = objectPreviewReadiness(draft, object);
      return `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>业务定义</h2><p>对象身份与业务含义集中维护。</p></div></div><div class="panel-body"><dl class="definition-grid"><dt>业务名称</dt><dd>${esc(object.name)}</dd><dt>业务定义</dt><dd>${esc(object.definition)}</dd><dt>稳定语义身份</dt><dd class="mono">${esc(object.id)}</dd><dt>身份 Property</dt><dd>${esc(propertyName(object, object.identity) || "待设置")}</dd><dt>可读标题</dt><dd>${esc(propertyName(object, object.title) || "待设置")}</dd><dt>适用场景</dt><dd>${esc(scenarioDisplayLabel(draft))}</dd></dl></div></section><section class="panel"><div class="panel-head"><div><h2>实例概况</h2><p>身份映射通过后才显示对象实例检查结果。</p></div>${status(preview.label, preview.tone)}</div><div class="panel-body"><div class="big-stat"><b>${preview.ready ? object.count.toLocaleString("zh-CN") : "—"}</b><span>对象实例</span></div><dl class="definition-grid compact"><dt>数据截至</dt><dd>${preview.ready ? draftDataAsOf(draft) : esc(preview.reason)}</dd><dt>身份重复</dt><dd>${preview.ready ? "0" : "未检查"}</dd><dt>身份缺失</dt><dd>${preview.ready ? "0" : "未检查"}</dd></dl></div></section></div>${rows.length && preview.ready ? `<section class="panel"><div class="panel-head"><div><h2>代表性实例</h2><p>实例仅用于确认语义和关系，不作为字段批量生成依据。</p></div></div>${instanceTable(object.id, rows)}</section>` : ""}`;
    }
    if (tab === "properties") {
      return `<section class="panel"><div class="panel-head"><div><h2>Property</h2><p>Property 必须由用户明确创建；可以先定义业务属性，也可以从已发布数据字段创建并映射。</p></div>${btn("新增 Property", `open-add-property:${object.id}`, { primary: true })}</div>${object.properties.length ? `<div class="table-wrap"><table><thead><tr><th>业务名称</th><th>稳定身份</th><th>类型与单位</th><th>角色</th><th>来源字段</th><th>状态</th><th></th></tr></thead><tbody>${object.properties.map(property => { const mappedField = fieldForProperty(draft, object, property); return `<tr><td><b>${esc(property.name)}</b><small>${esc(property.definition || "待补充定义")}</small></td><td class="mono">${esc(property.id)}</td><td>${esc(property.dataType)}${property.unit && property.unit !== "—" ? ` · ${esc(property.unit)}` : ""}</td><td>${esc(`${property.id === object.identity ? "身份" : property.id === object.title ? "标题" : property.role || "普通属性"}${property.linkEndpoint ? " · Link 端点" : ""}`)}</td><td>${esc(mappedField?.name || (property.sourceFieldId ? "需重新映射" : "未映射"))}</td><td>${status(mappedField ? "已映射" : "阻断", mappedField ? "green" : "red")}</td><td><div class="table-actions">${btn("编辑", `edit-resource:${property.id}`, { small: true })}${property.id !== object.identity ? btn("设为身份", `set-identity:${object.id}:${property.id}`, { small: true }) : ""}${property.id !== object.title ? btn("设为标题", `set-title:${object.id}:${property.id}`, { small: true }) : ""}${!property.linkEndpoint ? btn("设为 Link 端点", `set-link-endpoint:${object.id}:${property.id}`, { small: true }) : ""}${btn("配置映射", `focus-mapping:${object.id}:${property.id}`, { small: true })}</div></td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty compact"><span>P</span><h3>还没有 Property</h3><p>先创建业务属性。选择数据资产成员后，可同步选择字段建立明确映射。</p>${btn("新增 Property", `open-add-property:${object.id}`, { primary: true })}</div>`}</section>`;
    }
    if (tab === "links") {
      const links = draft.links.filter(link => link.source === object.id || link.target === object.id);
      return `<section class="panel"><div class="panel-head"><div><h2>关系</h2><p>关系方向、基数和端点字段必须显式确认。</p></div>${btn("返回画布添加关系", "go-workbench")}</div>${links.length ? `<div class="link-list">${links.map(link => {
        const endpoint = linkEndpointInfo(draft, link);
        return `<article><div class="link-direction"><b>${esc(objectName(draft, link.source))}</b><span>→</span><b>${esc(objectName(draft, link.target))}</b></div><div><h3>${esc(link.name)} / ${esc(link.reverseName || "反向名称待配置")}</h3><p>${esc(link.definition)}</p><span>${esc(link.cardinality)} · ${esc(link.allowedDirection || "导航方向待配置")} · ${esc(endpoint.sourceEndpointId)} → ${esc(endpoint.targetEndpointId)} · ${esc(endpoint.sourceType)} ↔ ${esc(endpoint.targetType)}</span></div><div class="link-actions">${status(endpoint.compatible ? "两端兼容" : "端点不兼容", endpoint.compatible ? "green" : "red")}${btn("编辑关系", `edit-resource:${link.id}`, { small: true })}</div></article>`;
      }).join("")}</div>` : `<div class="empty compact"><span>L</span><h3>尚未建立关系</h3><p>回到一级画布，在现有 Object Type 之间创建 Link Type。</p>${btn("返回画布", "go-workbench", { primary: true })}</div>`}</section>`;
    }
    if (tab === "mapping") return renderObjectMappingTab(draft, object);
    if (tab === "logic") {
      const metrics = draft.metrics.filter(metric => metric.subjectObjectId === object.id || metric.sourceObjectId === object.id);
      const rules = draft.rules.filter(rule => rule.objectId === object.id);
      const actions = draft.actions.filter(action => action.targetObjectId === object.id);
      return `<div class="logic-columns"><section class="panel"><div class="panel-head"><div><h2>Metric</h2><p>计算业务事实。</p></div><b>${metrics.length}</b></div><div class="compact-cards">${metrics.map(m => `<button data-action="open-draft-resource:${m.id}"><i class="type-metric">M</i><span><b>${esc(m.name)}</b><small>${esc(m.unit)} · ${esc(m.scope)}</small></span></button>`).join("") || `<p>当前对象没有直接依赖的 Metric。</p>`}</div></section><section class="panel"><div class="panel-head"><div><h2>Rule</h2><p>基于 Metric 判断问题。</p></div><b>${rules.length}</b></div><div class="compact-cards">${rules.map(r => `<button data-action="open-draft-resource:${r.id}"><i class="type-rule">R</i><span><b>${esc(r.code)} · ${esc(r.name)}</b><small>${esc(r.dependency)}</small></span></button>`).join("") || `<p>当前对象没有直接适用的 Rule。</p>`}</div></section><section class="panel"><div class="panel-head"><div><h2>Action Type</h2><p>定义允许请求的行动。</p></div><b>${actions.length}</b></div><div class="compact-cards">${actions.map(a => `<button data-action="open-draft-resource:${a.id}"><i class="type-action">A</i><span><b>${esc(a.name)}</b><small>${esc(a.requirement)}</small></span></button>`).join("") || `<p>当前对象没有可请求的行动类型。</p>`}</div></section></div>`;
    }
    return `<section class="panel"><div class="panel-head"><div><h2>下游消费</h2><p>Draft 资源不会进入正式消费目录。</p></div>${status("等待语义发布", "amber")}</div><div class="consumer-list">${["智能问数", "决策中心", "Agent 应用", "报告中心"].map(name => `<article><span>${esc(name.slice(0, 1))}</span><div><b>${esc(name)}</b><p>发布精确语义版本并形成正式数据后，可按稳定语义身份只读引用。</p></div>${status("不可消费", "neutral")}</article>`).join("")}</div></section>`;
  }

  function renderObjectMappingTab(draft, object) {
    const member = draftMembers(draft).find(m => m.id === object.memberId);
    if (!member) return `<section class="panel"><div class="panel-head"><div><h2>数据资产成员</h2><p>Object Type 创建后，再选择已发布数据资产成员。</p></div></div><div class="empty"><span>D</span><h3>尚未选择数据资产成员</h3><p>从数据工程已发布的数据资产中选择与该对象粒度一致的成员。</p>${btn("选择数据资产成员", `choose-member:${object.id}`, { primary: true })}</div></section>`;
    const fields = fieldRecordsFor(draft, object, member);
    const repair = draft.pendingFieldChange?.objectId === object.id ? draft.pendingFieldChange : null;
    const repairAction = repair?.propertyId
      ? btn("重新配置映射", `focus-mapping:${object.id}:${repair.propertyId}`, { primary: true })
      : repair?.linkId ? btn("编辑关系端点", `edit-resource:${repair.linkId}`, { primary: true }) : btn("打开映射工作区", `open-mapping:${object.id}`, { primary: true });
    return `${repair && !repair.mapped ? `<div class="result-banner error"><span>!</span><div><b>数据映射需要显式修正</b><p>${esc(repair.oldFieldName || "原映射")} 在候选资产中不再可用；系统不会按同名或相似名称自动迁移。</p></div><div class="repair-actions">${repairAction}</div></div>` : ""}<section class="panel"><div class="panel-head"><div><h2>数据资产成员</h2><p>资产选择与字段语义映射是两个独立步骤。</p></div>${btn("更换成员", `choose-member:${object.id}`)}</div><div class="asset-reference"><div><span class="asset-symbol">D</span><div><b>${esc(draft.sourceDataContract?.assetName || "未选择数据资产")}</b><p>${esc(draftDataVersion(draft))} · ${esc(draftDataAsOf(draft))}</p></div></div><dl><dt>资产成员</dt><dd>${esc(member.name)}</dd><dt>成员粒度</dt><dd>${esc(member.grain)}</dd><dt>稳定标识</dt><dd>${esc(member.identity)}</dd><dt>记录数</dt><dd>${member.rows.toLocaleString("zh-CN")}</dd></dl></div></section>
      <section class="panel"><div class="panel-head"><div><h2>字段语义映射</h2><p>从字段创建 Property 或连接已有 Property；系统不会批量复制字段，也不会按同名自动迁移。</p></div>${btn("打开映射工作区", `open-mapping:${object.id}`, { primary: true })}</div><div class="table-wrap"><table><thead><tr><th>数据字段</th><th>稳定字段身份</th><th>类型</th><th>示例值</th><th>对应 Property</th><th>用途</th><th></th></tr></thead><tbody>${fields.map(field => {
        const property = object.properties.find(p => p.sourceFieldId === field.id);
        const endpointLink = endpointUsage(draft, object.id, field.id);
        const fieldEndpoint = (object.linkEndpointFields || []).includes(field.id);
        return `<tr><td><b>${esc(field.name)}</b></td><td class="mono">${esc(field.id)}</td><td>${esc(field.type)}</td><td>${esc(field.sample)}</td><td>${property ? esc(property.name) : "未映射"}</td><td>${property ? esc(property.role) : endpointLink || fieldEndpoint ? "Link 端点" : "—"}</td><td><div class="table-actions">${property ? btn("配置映射", `focus-mapping:${object.id}:${property.id}`, { small: true }) : `${btn("创建 Property", `open-add-property:${object.id}:${field.id}`, { primary: true, small: true })}${object.properties.length ? btn("映射已有 Property", `open-mapping:${object.id}`, { small: true }) : ""}`}${fieldEndpoint ? btn("取消端点", `toggle-field-endpoint:${object.id}:${field.id}`, { small: true }) : btn("设为 Link 端点", `toggle-field-endpoint:${object.id}:${field.id}`, { small: true })}</div></td></tr>`;
      }).join("")}</tbody></table></div></section>`;
  }

  function instanceTable(objectId, rows) {
    const heads = objectId === "OBJ-FINANCING-ENTITY" ? ["单位编码", "单位名称", "产业板块", "融资余额", "融资成本", "负责人"] : objectId === "OBJ-FINANCING-DETAIL" ? ["借据编号", "融资主体", "融资机构", "余额", "利率", "期限"] : objectId === "OBJ-FINANCIAL-INSTITUTION" ? ["机构编码", "机构名称", "类别", "代表主体", "关联余额", "借据数"] : ["负责人标识", "负责人名称", "融资主体", "主体数", "状态", "备注"];
    return `<div class="table-wrap"><table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td ${i === 0 ? 'class="mono"' : ""}>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function renderMappingWorkspace() {
    const draft = activeDraft(); const object = draft?.objects.find(o => o.id === routeParams().get("object"));
    if (!draft || !object) return renderModelingHome();
    const member = draftMembers(draft).find(m => m.id === object.memberId); const focusId = routeParams().get("property");
    if (!member) return `<div class="page-scroll">${pageHeader("字段映射", "请先在对象详情中选择已发布数据资产成员。", btn("返回对象", `open-object:${object.id}`, { primary: true }), `${object.name} · Draft`)}</div>`;
    const fields = fieldRecordsFor(draft, object, member); const mappedCount = object.properties.filter(p => fieldForProperty(draft, object, p)).length;
    const selectedPropertyId = ui.mappingProperty || focusId;
    const selectedProperty = object.properties.find(property => property.id === selectedPropertyId) || null;
    const selectedField = fields.find(field => field.id === ui.mappingSource) || null;
    return `<div class="mapping-page"><header class="mapping-head"><div><button class="back-btn" data-action="open-object:${object.id}">←</button><div><span>${esc(object.name)} · Object Type</span><h1>字段映射工作区</h1><p>只在当前对象范围内连接数据字段与 Property；连接不会按同名字段自动迁移。</p></div></div><div>${status(`${mappedCount}/${object.properties.length} 已映射`, mappedCount === object.properties.length ? "green" : "amber")}${btn("返回对象", `open-object:${object.id}`)}${btn("保存映射", "save-mapping", { primary: true })}</div></header>
      <div class="mapping-grid">
        <section class="mapping-column source"><header><div><b>数据资产字段</b><span>${esc(member.name)} · ${fields.length} 项</span></div>${status("只读", "blue")}</header><div class="mapping-list">${fields.map((field, index) => `<button class="mapping-item ${ui.mappingSource === field.id ? "active" : ""}" data-map-source="${esc(field.id)}" data-map-index="${index}"><span>D</span><div><b>${esc(field.name)}</b><small>${esc(field.type)} · ${esc(field.sample)}</small><small class="mono">${esc(field.id)}</small></div><i></i></button>`).join("")}</div></section>
        <section class="mapping-lines"><div class="mapping-hint"><b>${selectedField ? `已选择字段：${esc(selectedField.name)}` : "选择左侧字段"}</b><span>${selectedProperty ? `目标 Property：${esc(selectedProperty.name)}` : "再选择右侧 Property"}</span></div><svg id="mapping-svg"></svg><div class="mapping-connect-bar"><div><span>本次连接</span><b>${selectedField ? esc(selectedField.name) : "待选择字段"} → ${selectedProperty ? esc(selectedProperty.name) : "待选择 Property"}</b><small>${selectedField && selectedProperty ? `${esc(selectedField.type)} ↔ ${esc(selectedProperty.dataType)}` : "连接前会检查类型和字段占用"}</small></div>${btn(selectedProperty && fieldForProperty(draft, object, selectedProperty) ? "更新映射" : "建立映射", "connect-mapping", { primary: true, disabled: !selectedField || !selectedProperty })}</div></section>
        <section class="mapping-column target"><header><div><b>本体 Property</b><span>${esc(object.name)} · ${object.properties.length} 项</span></div>${status("Draft", "blue")}</header><div class="mapping-list">${object.properties.map((property, index) => { const mappedField = fieldForProperty(draft, object, property); return `<button class="mapping-item target ${selectedPropertyId === property.id ? "focused" : ""} ${!mappedField ? "blocked" : ""}" data-map-property="${esc(property.id)}" data-map-index="${index}"><i></i><span class="type-property">P</span><div><b>${esc(property.name)}</b><small>${esc(property.dataType)}${property.unit && property.unit !== "—" ? ` · ${esc(property.unit)}` : ""} · ${esc(`${property.role}${property.linkEndpoint ? " · Link 端点" : ""}`)}</small><small>${mappedField ? `来自 ${esc(mappedField.name)}` : property.sourceFieldId ? "来源字段已变化，需重新映射" : "未映射"}</small></div></button>`; }).join("")}</div><footer>${btn("新增 Property", `open-add-property:${object.id}`, { primary: true, small: true })}</footer></section>
      </div>
      <footer class="mapping-preview"><div><b>实例预览</b><span>当前连接后的业务语义与真实实例</span></div><div class="preview-values"><span><small>当前 Property</small><b>${esc(selectedProperty?.name || "待选择")}</b></span><span><small>来源示例值</small><b>${esc(selectedField?.sample || (selectedProperty ? fieldForProperty(draft, object, selectedProperty)?.sample : null) || "—")}</b></span><span><small>映射状态</small><b>${mappedCount === object.properties.length ? "完整" : `${object.properties.length - mappedCount} 项待处理`}</b></span></div><div class="mapping-preview-actions">${selectedProperty ? `${btn("编辑属性", `edit-resource:${selectedProperty.id}`, { small: true })}${selectedProperty.id !== object.identity ? btn("设为身份", `set-identity:${object.id}:${selectedProperty.id}`, { small: true }) : ""}${selectedProperty.id !== object.title ? btn("设为标题", `set-title:${object.id}:${selectedProperty.id}`, { small: true }) : ""}${!selectedProperty.linkEndpoint ? btn("设为 Link 端点", `set-link-endpoint:${object.id}:${selectedProperty.id}`, { small: true }) : ""}${fieldForProperty(draft, object, selectedProperty) ? btn("解除映射", `unmap-property:${object.id}:${selectedProperty.id}`, { danger: true, small: true }) : ""}` : ""}</div></footer>
    </div>`;
  }

  function metricDependencyIssues(draft, metric) {
    const propertyIds = new Set(draft.objects.flatMap(object => object.properties.map(property => property.id)));
    const linkIds = new Set(draft.links.map(link => link.id));
    const metricIds = new Set(draft.metrics.filter(item => item.id !== metric.id).map(item => item.id));
    const dependencyIds = metric.dependencyIds || [];
    if (!dependencyIds.length) return ["未声明依赖"];
    return dependencyIds.filter(id => !(id.startsWith("PROP-") && propertyIds.has(id)) && !(id.startsWith("LINK-") && linkIds.has(id)) && !(id.startsWith("MET-") && metricIds.has(id)));
  }

  function replacementRetiredIds(draft) {
    const retired = new Set(draft?.release?.replacementMode === "替代指定资源" ? draft.release.replacementResourceIds || [] : []);
    draft?.objects?.forEach(object => {
      if (retired.has(object.id)) object.properties.forEach(property => retired.add(property.id));
    });
    return retired;
  }

  function replacementDependencyIssues(draft) {
    const retired = replacementRetiredIds(draft);
    if (!retired.size) return [];
    const issues = [];
    const add = (resource, ids) => {
      const blocked = [...new Set((ids || []).filter(id => retired.has(id)))];
      if (blocked.length) issues.push({ resource, blocked });
    };
    draft.objects.filter(object => !retired.has(object.id)).forEach(object => add(object, [object.identity, object.title]));
    draft.links.filter(link => !retired.has(link.id)).forEach(link => add(link, [link.source, link.target, link.sourceEndpoint?.id, link.targetEndpoint?.id]));
    draft.metrics.filter(metric => !retired.has(metric.id)).forEach(metric => add(metric, [metric.sourceObjectId, metric.subjectObjectId, ...(metric.dependencyIds || [])]));
    draft.rules.filter(rule => !retired.has(rule.id)).forEach(rule => add(rule, [rule.objectId, ...(rule.metricIds || [])]));
    draft.actions.filter(action => !retired.has(action.id)).forEach(action => add(action, [action.targetObjectId, ...(action.ruleIds || []), ...(action.linkIds || [])]));
    return issues;
  }

  function validationIssues(draft) {
    ensureDraftReleaseContract(draft);
    const issues = [];
    if (!/^ONT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(draft.ontologyStableId || "")) issues.push({ kind: "本体", name: "本体缺少有效的稳定语义身份", detail: "请在本体定义中补充英文业务编码。", action: "go-workbench" });
    if (!draft.objects.length) issues.push({ kind: "对象", name: "缺少 Object Type", detail: "至少建立一个业务对象骨架。", action: "open-add-object" });
    const resources = draftResourceList(draft); const duplicatedIds = [...new Set(resources.map(item => item.id).filter((id, index, ids) => ids.indexOf(id) !== index))];
    duplicatedIds.forEach(id => issues.push({ kind: "稳定身份", name: `${id} 被重复使用`, detail: "稳定语义身份必须在当前本体内唯一。", action: "go-workbench" }));
    historicalResourceIdentityConflicts(draft).forEach(conflict => issues.push({
      kind: "稳定身份",
      name: `${conflict.candidate.id} 与历史 Published 资源冲突`,
      detail: conflict.typeConflict
        ? `${conflict.version.semanticVersion} 已将该稳定身份用于 ${TYPE_LABEL[conflict.resource.kind] || conflict.resource.kind}；不同资源类型不得复用。`
        : `${conflict.version.semanticVersion} 已包含该稳定身份，但当前 Draft 不是从该资源来源版本延续；请使用新稳定身份或从正确版本创建修订 Draft。`,
      action: `edit-resource:${conflict.candidate.id}`
    }));
    resources.filter(resource => !/^[A-Z]+-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(resource.id || "")).forEach(resource => issues.push({ kind: "稳定身份", name: `${resource.name || "语义资源"}缺少有效稳定身份`, detail: "稳定身份必须显式填写，不能用显示名称代替。", action: `edit-resource:${resource.id}` }));
    resources.filter(resource => resource.owner !== ONTOLOGY_DEFINITION_OWNER).forEach(resource => issues.push({ kind: "生命周期", name: `${resource.name}责任位置与平台合同不一致`, detail: `一期定义责任位置应只读引用“${ONTOLOGY_DEFINITION_OWNER}”，不在此配置 Owner 治理。`, action: "open-release-settings" }));
    const release = draft.release || defaultReleaseContract(draft);
    if (!release.effectiveFrom) issues.push({ kind: "生命周期", name: "业务生效时间待确认", detail: "发布前必须明确本语义版本及所含资源从何时开始生效，不能用发布时间静默代替。", action: "open-release-settings" });
    if (!release.changeReason?.trim() || release.changeReason.trim() === "待确认") issues.push({ kind: "生命周期", name: "变更原因待确认", detail: "首次发布或修订发布都必须说明业务原因；修订版本不能使用空白、待确认或无意义摘要。", action: "open-release-settings" });
    if (release.owner !== ONTOLOGY_DEFINITION_OWNER) issues.push({ kind: "生命周期", name: "版本责任位置与平台合同不一致", detail: `当前版本的定义责任位置应为“${ONTOLOGY_DEFINITION_OWNER}”。`, action: "open-release-settings" });
    if (!release.replacementDeclaration || release.replacementDeclaration === "待确认" || !release.confirmed || (release.replacementMode === "替代指定资源" && (!release.replacementResourceIds?.length || release.replacementResourceIds.some(sourceId => !release.replacementMap?.[sourceId])))) issues.push({ kind: "生命周期", name: "替代关系待确认", detail: "发布前必须明确无替代关系，或按来源 Published 版本和稳定身份逐项指定被替代资源及目标资源；系统不会根据同名资源自动推断。", action: "open-release-settings" });
    if (release.effectiveFrom && release.effectiveTo && new Date(release.effectiveTo).getTime() <= new Date(release.effectiveFrom).getTime()) issues.push({ kind: "生命周期", name: "业务失效时间早于生效时间", detail: "请调整有效期；失效时间必须晚于生效时间。", action: "open-release-settings" });
    draft.objects.forEach(object => {
      if (!object.name || !object.definition) issues.push({ kind: "对象", name: `${object.name || object.id}定义不完整`, detail: "Object Type 必须具有业务名称和业务定义。", action: `edit-resource:${object.id}` });
      if (!object.memberId) issues.push({ kind: "对象", name: `${object.name}未选择数据资产成员`, detail: "选择与对象粒度一致的已发布数据资产成员。", action: `open-object:${object.id}:mapping` });
      const identityProperty = object.properties.find(property => property.id === object.identity);
      const titleProperty = object.properties.find(property => property.id === object.title);
      if (!identityProperty || identityProperty.role !== "身份" || identityProperty.nullable !== "否") issues.push({ kind: "属性", name: `${object.name}未设置有效身份`, detail: "身份必须属于当前对象、完成字段映射，并明确非空和稳定。", action: `open-object:${object.id}:properties` });
      if (!titleProperty || (titleProperty.role !== "标题" && titleProperty.id !== object.identity)) issues.push({ kind: "属性", name: `${object.name}未设置有效标题`, detail: "标题必须属于当前对象并完成字段映射；允许与身份使用同一 Property。", action: `open-object:${object.id}:properties` });
      object.properties.forEach(property => {
        const field = fieldForProperty(draft, object, property);
        if (!property.name || !property.definition) issues.push({ kind: "属性", name: `${object.name}.${property.name || property.id}定义不完整`, detail: "Property 必须具有业务名称和定义。", action: `edit-resource:${property.id}` });
        if (property.dataType === "数值" && (!property.unit || property.unit === "—")) issues.push({ kind: "属性", name: `${object.name}.${property.name}缺少业务单位`, detail: "数值 Property 必须明确业务单位。", action: `edit-resource:${property.id}` });
        if (!property.sourceField || !field) issues.push({ kind: "映射", name: `${object.name}.${property.name}缺少有效来源字段`, detail: "重新连接字段；不得按同名自动迁移。", action: `focus-mapping:${object.id}:${property.id}` });
        else if (!compatibleTypes(field.type, property.dataType)) issues.push({ kind: "映射", name: `${object.name}.${property.name}类型不兼容`, detail: `来源字段为 ${field.type}，Property 为 ${property.dataType}。`, action: `focus-mapping:${object.id}:${property.id}` });
      });
    });
    draft.links.forEach(link => {
      if (!link.name || !link.reverseName || !ALLOWED_LINK_DIRECTIONS.includes(link.allowedDirection) || !link.cardinality || !link.definition) issues.push({ kind: "关系", name: `${link.name || link.id}业务合同不完整`, detail: "Link 必须包含正反向业务名称、获准导航方向、基数和定义。", action: `edit-resource:${link.id}` });
      if (!draft.objects.some(o => o.id === link.source) || !draft.objects.some(o => o.id === link.target)) issues.push({ kind: "关系", name: `${link.name}端点不兼容`, detail: "关系起点或终点对象不存在。", action: `edit-resource:${link.id}` });
      else {
        const endpoint = linkEndpointInfo(draft, link);
        if (!link.sourceEndpoint?.kind || !link.sourceEndpoint?.id || !link.targetEndpoint?.kind || !link.targetEndpoint?.id) issues.push({ kind: "关系", name: `${link.name}缺少稳定端点`, detail: "Link 必须显式声明 Property 或资产字段端点及稳定身份。", action: `edit-resource:${link.id}` });
        else if (!endpoint.compatible) issues.push({ kind: "关系", name: `${link.name}端点不兼容`, detail: `${endpoint.sourceEndpointId} / ${endpoint.sourceLabel}（${endpoint.sourceType}）无法连接 ${endpoint.targetEndpointId} / ${endpoint.targetLabel}（${endpoint.targetType}）。`, action: `edit-resource:${link.id}` });
      }
    });
    if (draft.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION") {
      const requiredDirections = new Map([
        ["LINK-ENTITY-FINANCING", "双向导航"],
        ["LINK-FINANCING-INSTITUTION", "仅正向导航"],
        ["LINK-ENTITY-OWNER", "仅正向导航"]
      ]);
      requiredDirections.forEach((direction, linkId) => {
        const link = draft.links.find(item => item.id === linkId);
        if (link && link.allowedDirection !== direction) issues.push({ kind: "关系", name: `${link.name}的消费导航范围不符合当前场景`, detail: `该关系只允许“${direction}”；扩大或反转范围会改变下游可达性。`, action: `edit-resource:${link.id}` });
      });
    }
    if (!draft.metrics.length) issues.push({ kind: "指标", name: "缺少 Metric", detail: "至少配置一个可供业务判断的 Metric。", action: "open-add-metric" });
    draft.metrics.forEach(metric => {
      if (!draft.objects.some(object => object.id === metric.sourceObjectId) || !draft.objects.some(object => object.id === metric.subjectObjectId)) issues.push({ kind: "指标", name: `${metric.name}对象引用无效`, detail: "Metric 必须引用当前 Draft 中明确的事实对象和适用对象。", action: `edit-resource:${metric.id}` });
      if (!metric.name || !metric.definition || !metric.calculation || !metric.unit || !metric.scope || !metric.time || !metric.zeroHandling) issues.push({ kind: "指标", name: `${metric.name || metric.id}业务合同不完整`, detail: "Metric 必须包含定义、计算口径、单位、范围、时间语义和无数据处理。", action: `edit-resource:${metric.id}` });
      const dependencyIssues = metricDependencyIssues(draft, metric);
      if (dependencyIssues.length) issues.push({ kind: "指标", name: `${metric.name}依赖合同不完整`, detail: `以下 Property / Link 稳定身份不可用：${dependencyIssues.join("、")}。`, action: `edit-resource:${metric.id}` });
    });
    if (!draft.rules.length) issues.push({ kind: "规则", name: "缺少 Rule", detail: "至少配置一个依赖 Metric 的 Rule。", action: "open-add-rule" });
    draft.rules.filter(rule => !rule.name || !rule.definition || !rule.condition || !rule.validity || !rule.testSample || !rule.bankRanking || !rule.evidence || !draft.objects.some(object => object.id === rule.objectId) || !(rule.metricIds || []).length || (rule.metricIds || []).some(id => !draft.metrics.some(metric => metric.id === id))).forEach(rule => issues.push({ kind: "规则", name: `${rule.name}业务合同或依赖无效`, detail: "Rule 必须包含定义、判断条件、有效期、测试样例、机构排序、证据要求，并引用当前 Draft 的适用对象和 Metric。", action: `edit-resource:${rule.id}` }));
    draft.rules.filter(rule => rule.businessBasis === "unknown").forEach(rule => issues.push({ kind: "规则", name: `${rule.name}业务口径状态待确认`, detail: "未知状态不能被静默升级为已确认，也不能进入 Published 目录。", action: `edit-resource:${rule.id}` }));
    if (!draft.actions.length) issues.push({ kind: "行动", name: "缺少 Action Type", detail: "配置允许请求的行动类型及人工确认要求。", action: "open-add-action" });
    draft.actions.filter(action => !action.name || !action.definition || !action.parameters || !action.prerequisite || !action.result || !action.failure || !action.defaultDue || action.confirmation !== "必须人工确认" || !draft.objects.some(object => object.id === action.targetObjectId) || !(action.ruleIds || []).length || (action.ruleIds || []).some(id => !draft.rules.some(rule => rule.id === id)) || (action.linkIds || []).some(id => !draft.links.some(link => link.id === id))).forEach(action => issues.push({ kind: "行动", name: `${action.name}业务合同或依赖无效`, detail: "Action Type 必须包含目标、参数、前置证据、结果、失败表现、办理期限、人工确认，并引用有效 Rule 或 Link。", action: `edit-resource:${action.id}` }));
    draft.actions.filter(action => action.businessBasis === "unknown").forEach(action => issues.push({ kind: "行动", name: `${action.name}业务口径状态待确认`, detail: "未知状态不能被静默升级为已确认，也不能进入 Published 目录。", action: `edit-resource:${action.id}` }));
    replacementDependencyIssues(draft).forEach(item => issues.push({ kind: "生命周期", name: `${item.resource.name}仍引用将停用的稳定身份`, detail: `请显式迁移依赖 ${item.blocked.join("、")}；系统不会按显示名称自动替换。`, action: `edit-resource:${item.resource.id}` }));
    const mappingAssessment = draftMappingContractAssessment(draft);
    if (!mappingAssessment.complete) issues.push({ kind: "数据合同", name: "发布时数据映射合同不完整", detail: mappingAssessment.issues.join("；"), action: "go-workbench" });
    return issues;
  }

  const VALIDATION_GROUPS = [
    { id: "ontology", name: "本体与稳定身份", kinds: ["本体", "稳定身份"], summary: "检查本体及全部语义资源的英文稳定身份是否有效且唯一。", count: draft => 1 + draftResourceList(draft).length },
    { id: "lifecycle", name: "生命周期与证据包络", kinds: ["生命周期"], summary: "检查 Owner、业务有效时间、变更原因、替代迁移和发布后证据定位生成条件。", count: draft => 1 + draftResourceList(draft).length },
    { id: "object", name: "Object Type", kinds: ["对象"], summary: "检查业务名称、定义、对象范围与已发布数据资产成员。", count: draft => draft.objects.length },
    { id: "property", name: "身份、标题与 Property", kinds: ["属性"], summary: "检查身份与标题，以及 Property 定义、类型、单位和空值规则。", count: draft => draft.objects.reduce((sum, object) => sum + object.properties.length, 0) },
    { id: "mapping", name: "数据成员与字段映射", kinds: ["映射", "数据合同"], summary: "检查精确资产版本、四成员三关系、来源链、字段类型和发布时映射合同。", count: draft => draft.objects.filter(object => object.memberId).length },
    { id: "link", name: "Link Type", kinds: ["关系"], summary: "检查业务方向、获准导航范围、正反向名称、基数、稳定端点与端点类型兼容。", count: draft => draft.links.length },
    { id: "metric", name: "Metric", kinds: ["指标"], summary: "检查定义、计算口径、单位、范围、时间语义、无数据处理及依赖。", count: draft => draft.metrics.length },
    { id: "rule", name: "Rule", kinds: ["规则"], summary: "检查适用对象、判断条件、有效期、测试样例、证据与 Metric 依赖。", count: draft => draft.rules.length },
    { id: "action", name: "Action Type", kinds: ["行动"], summary: "检查目标、参数、前置证据、结果、失败表现、期限、人工确认及 Rule 依赖。", count: draft => draft.actions.length }
  ];

  function validationScopeSummary(draft) {
    return `${draft.objects.length} Object · ${draft.objects.reduce((sum, object) => sum + object.properties.length, 0)} Property · ${draft.links.length} Link · ${draft.metrics.length} Metric · ${draft.rules.length} Rule · ${draft.actions.length} Action Type`;
  }

  function draftValidationFingerprint(draft) {
    return JSON.stringify({
      ontologyStableId: draft.ontologyStableId,
      name: draft.name,
      definition: draft.definition,
      scenario: draft.scenario,
      release: draft.release,
      objects: draft.objects,
      links: draft.links,
      metrics: draft.metrics,
      rules: draft.rules,
      actions: draft.actions,
      dataContract: freezeDataContract(draft)
    });
  }

  function buildValidationSnapshot(draft, issues, checkedAt) {
    const mapping = draftMappingContractAssessment(draft);
    const resourceManifest = draftResourceList(draft).map(resource => draftResourceLifecycleProjection(draft, resource));
    return {
      status: issues.length ? "failed" : "passed",
      checkedAt,
      draftId: draft.id,
      draftUpdatedAt: draft.updatedAt,
      fingerprint: draftValidationFingerprint(draft),
      scopeSummary: validationScopeSummary(draft),
      resourceManifest,
      groups: VALIDATION_GROUPS.map(group => {
        const groupIssues = issues.filter(issue => group.kinds.includes(issue.kind));
        return { id: group.id, name: group.name, checkedCount: group.count(draft), status: groupIssues.length ? "failed" : "passed", issueCount: groupIssues.length };
      }),
      releaseEnvelope: {
        publicationTarget: "Published",
        owner: draft.release?.owner || "待确认",
        effectiveFrom: draft.release?.effectiveFrom || null,
        effectiveTo: draft.release?.effectiveTo || null,
        changeReason: draft.release?.changeReason || "待确认",
        replacementDeclaration: draft.release?.replacementDeclaration || "待确认",
        resourceManifest: clone(resourceManifest)
      },
      mapping: { complete: mapping.complete, label: mapping.label, detail: mapping.detail, issues: clone(mapping.issues || []) },
      issues: clone(issues)
    };
  }

  function renderValidation() {
    const draft = activeDraft(); if (!draft) return renderModelingHome();
    ensureDraftReleaseContract(draft);
    const issues = draft.validation.issues || [];
    const hasResult = ["success", "failed"].includes(draft.validation.status)
      && draft.validation?.snapshot?.draftId === draft.id
      && draft.validation.snapshot.fingerprint === draftValidationFingerprint(draft);
    const selectedGroup = VALIDATION_GROUPS.find(group => group.id === ui.validationGroup) || null;
    const visibleIssues = selectedGroup ? issues.filter(issue => selectedGroup.kinds.includes(issue.kind)) : issues;
    const scopeSummary = validationScopeSummary(draft);
    const lifecycleManifest = hasResult
      ? draft.validation.snapshot.resourceManifest || []
      : draftResourceList(draft).map(resource => draftResourceLifecycleProjection(draft, resource));
    return `<div class="page-scroll">${pageHeader("统一校验", "检查当前 Draft 是否满足语义发布条件；不执行数据工程管道，也不判断业务 Rule 是否命中。", `${btn("返回工作台", "go-workbench")}${btn("配置发布信息", "open-release-settings")}${btn(draft.validation.status === "processing" ? "校验中" : draft.validation.status === "stale" ? "重新校验" : "运行校验", "run-validation", { primary: true, disabled: draft.validation.status === "processing" })}`, draft.name)}
      <section class="validation-context"><div><span>当前 Draft</span><b>${esc(draft.draftName || draft.id)}</b><small class="mono">${esc(draft.id)}</small></div><div><span>校验范围</span><b>${esc(scopeSummary)}</b><small>含发布时数据映射合同</small></div><div><span>业务有效期</span><b>${esc(humanDateTime(draft.release.effectiveFrom))}</b><small>${draft.release.confirmed ? (draft.release.effectiveTo ? `失效 ${esc(humanDateTime(draft.release.effectiveTo))}` : "未预设失效时间") : "失效时间待确认"}</small></div><div><span>最近校验</span><b>${esc(draft.validation.checkedAt || "尚未校验")}</b><small>${draft.validation.status === "stale" ? `建模内容已于 ${esc(draft.validation.invalidatedAt || draft.updatedAt)} 变化` : `最近保存 ${esc(draft.updatedAt)}`}</small></div></section>
      <section class="lifecycle-review-strip"><div><span>当前发布状态</span><b>草稿</b><small>发布成功后才成为已发布版本</small></div><div><span>责任人</span><b>${esc(draft.release.owner || "待确认")}</b></div><div><span>变更原因</span><b>${esc(draft.release.changeReason || "待确认")}</b></div><div><span>替代关系</span><b>${esc(draft.release.replacementDeclaration || "待确认")}</b></div><div><span>受控证据定位</span><b>${esc(draft.release.evidenceState || "待确认")}</b></div></section>
      ${draft.validation.status === "stale" ? `<div class="result-banner warning"><span>↺</span><div><b>上次校验结果已失效</b><p>建模内容已变化；上次结果和时间仅供参考，重新校验前不能发布。</p></div>${btn("重新校验", "run-validation", { primary: true })}</div>` : draft.validation.status === "success" ? `<div class="result-banner success"><span>✓</span><div><b>本次校验通过</b><p>校验结果只说明语义版本具备发布条件，不代表数据已正式投入消费。</p></div>${btn("发布语义版本", "open-publish", { primary: true })}</div>` : draft.validation.status === "failed" ? `<div class="result-banner error"><span>!</span><div><b>${issues.length} 项问题阻断发布</b><p>返回原位置修正后，可再次运行统一校验。</p></div>${btn("重新校验", "run-validation", { primary: true })}</div>` : `<div class="result-banner neutral"><span>${networkIcon("module-network-icon")}</span><div><b>${draft.validation.status === "processing" ? "正在校验语义资源" : "尚未运行校验"}</b><p>${draft.validation.status === "processing" ? "正在检查稳定身份、关系端点、映射和业务逻辑合同。" : "校验成功后才能发布不可变语义版本。"}</p></div></div>`}
      <div class="validation-layout"><section class="panel"><div class="panel-head"><div><h2>校验范围</h2><p>点击任一范围筛选对应问题；范围状态与问题定位使用同一校验结果。</p></div>${ui.validationGroup !== "all" ? btn("查看全部", "validation-group:all", { small: true }) : ""}</div><div class="check-list">${VALIDATION_GROUPS.map((group, index) => { const groupIssues = hasResult ? issues.filter(issue => group.kinds.includes(issue.kind)) : []; const stateMarkup = draft.validation.status === "processing" ? status("处理中", "blue") : draft.validation.status === "idle" ? status("未开始") : draft.validation.status === "stale" ? status("需重验", "amber") : status(groupIssues.length ? `${groupIssues.length} 项失败` : "通过", groupIssues.length ? "red" : "green"); return `<button class="validation-check ${ui.validationGroup === group.id ? "active" : ""}" data-action="validation-group:${group.id}"><span class="check-index">${index + 1}</span><div><b>${esc(group.name)}</b><p>${esc(group.summary)}</p><small>${group.count(draft)} 项资源或合同</small></div>${stateMarkup}</button>`; }).join("")}</div></section><section class="panel"><div class="panel-head"><div><h2>${selectedGroup ? `${esc(selectedGroup.name)} · 问题定位` : "问题定位"}</h2><p>失败项可直接返回具体对象、属性、关系或映射位置。</p></div><b>${hasResult ? visibleIssues.length : "—"}</b></div>${hasResult && visibleIssues.length ? `<div class="issue-list">${visibleIssues.map(issue => `<article><span>${esc(issue.kind)}</span><div><b>${esc(issue.name)}</b><p>${esc(issue.detail)}</p></div>${btn("返回修正", issue.action, { primary: true, small: true })}</article>`).join("")}</div>` : `<div class="empty compact"><span>${draft.validation.status === "success" ? "✓" : draft.validation.status === "processing" ? "…" : networkIcon("module-network-icon")}</span><h3>${draft.validation.status === "success" ? selectedGroup ? "该范围没有阻断项" : "没有阻断项" : draft.validation.status === "processing" ? "正在检查" : draft.validation.status === "stale" ? "等待重新校验" : "等待校验结果"}</h3><p>${draft.validation.status === "success" ? "可以进入语义发布。" : draft.validation.status === "stale" ? "上次结果不再作为发布依据。" : "运行校验后在这里查看问题。"}</p></div>`}</section></div>
      <section class="panel wide"><div class="panel-head"><div><h2>资源生命周期清单</h2><p>${hasResult ? "来自当前内容的有效校验快照。" : draft.validation.status === "stale" ? "当前内容已变化；以下为待重验的当前资源投影，不沿用旧校验结论。" : "发布前逐项核对稳定身份、有效期、责任位置和证据生成条件。"}</p></div><b>${lifecycleManifest.length}</b></div>${renderLifecycleManifestTable(lifecycleManifest)}</section>
    </div>`;
  }

  function renderPublishedHome() {
    const versions = state.publishedVersions;
    const groups = [...new Set(versions.map(version => version.ontologyStableId))].map(ontologyStableId => {
      const items = versions.filter(version => version.ontologyStableId === ontologyStableId).sort((left, right) => Number(String(right.semanticVersion).replace(/\D/g, "")) - Number(String(left.semanticVersion).replace(/\D/g, "")));
      const current = items.find(version => isCurrentFormalVersion(version)) || null;
      return { ontologyStableId, items, current, latest: items[0] };
    });
    return `<div class="page-scroll ontology-home">${pageHeader("语义资产目录", "查看已发布本体的精确版本、正式数据与消费证据。", "", "语义资产")}
      ${renderLifecycleTabs("published")}
      <section class="workspace-intro"><div><h2>已发布本体</h2><p>目录按本体聚合；进入详情后再选择精确 Published 版本查看资源、映射、消费、更新、回退和证据。</p></div><span>${groups.length} 个本体</span></section>
      ${groups.length ? `<div class="published-ontology-grid">${groups.map(group => {
        const lead = group.latest; const formal = group.current ? formalUseStateOf(group.current) : formalUseStateOf(group.latest); const mapping = publishedMappingContractAssessment(group.latest);
        return `<article class="published-ontology-card"><header><span class="ontology-mark">${networkIcon("module-network-icon")}</span><div>${status("语义已发布", "green")}${status(formal.label, formal.tone)}</div></header><h2>${esc(lead.name)}</h2><p>${esc(lead.definition)}</p><small class="mono">${esc(group.ontologyStableId)}</small><dl><div><dt>最新发布版本</dt><dd>${esc(group.latest.semanticVersion)}</dd></div><div><dt>当前正式版本</dt><dd>${group.current ? esc(group.current.semanticVersion) : "尚未启用"}</dd></div><div><dt>发布时数据映射</dt><dd class="${mapping.complete ? "positive" : "negative"}">${mapping.complete ? "已冻结" : "不完整"}</dd></div><div><dt>可追溯版本</dt><dd>${group.items.length}</dd></div></dl><footer>${btn("查看详情", `open-ontology:${group.ontologyStableId}`, { primary: true })}</footer></article>`;
      }).join("")}</div>` : `<section class="panel"><div class="empty"><span>V</span><h3>尚无已发布本体</h3><p>Draft 资源不会出现在这里。完成统一校验并实际发布后，才形成不可变版本。</p>${btn("前往 Draft", "nav-modeling", { primary: true })}</div></section>`}
    </div>`;
  }

  function renderPublishedOntology() {
    const ontologyStableId = routeParams().get("id");
    const items = state.publishedVersions.filter(version => version.ontologyStableId === ontologyStableId).sort((left, right) => Number(String(right.semanticVersion).replace(/\D/g, "")) - Number(String(left.semanticVersion).replace(/\D/g, "")));
    if (!items.length) return renderMissingPublishedVersion();
    const latest = items[0]; const current = items.find(version => isCurrentFormalVersion(version)) || null;
    const requestedVersionId = routeParams().get("version");
    const focus = items.find(version => version.id === requestedVersionId) || current || latest;
    const formal = formalUseStateOf(focus); const mapping = publishedMappingContractAssessment(focus);
    return `<div class="page-scroll published-ontology-detail">${pageHeader(latest.name, "选择精确 Published 版本，进入后查看该版本的资源、映射、消费、更新、回退和证据。", btn("返回已发布", "nav-published"), "已发布本体")}
      <section class="ontology-detail-summary"><div><span>本体稳定身份</span><b class="mono">${esc(ontologyStableId)}</b></div><div><span>最新发布版本</span><b>${esc(latest.semanticVersion)}</b></div><div><span>当前正式版本（唯一）</span><b>${current ? esc(current.semanticVersion) : "尚未启用"}</b></div><div><span>可追溯版本</span><b>${items.length}</b></div></section>
      <section class="panel published-version-picker"><div class="panel-head"><div><h2>选择精确版本</h2><p>Published 版本均保留且只读；下游只读取“当前正式使用”的一个精确版本。</p></div></div><div class="version-picker-bar"><label><span>精确 Published 版本</span><select id="published-version-select" data-ontology="${esc(ontologyStableId)}">${items.map(version => `<option value="${esc(version.id)}" ${version.id === focus.id ? "selected" : ""}>${esc(version.semanticVersion)} · ${esc(formalUseStateOf(version).label)}</option>`).join("")}</select></label><div><span>正式服务规则</span><b>同一本体同一时刻仅一个版本</b></div></div><article class="published-version-focus"><span class="version-token">${esc(focus.semanticVersion)}</span><div><b>${esc(focus.changeSummary || "语义版本发布")}</b><p>发布于 ${esc(focus.publishedAt)} · ${focus.objects.length} Object · ${focus.metrics.length} Metric · ${focus.rules.length} Rule</p><small class="mono">${esc(focus.id)}</small></div><div class="version-focus-states">${status("语义已发布", "green")}${status(mapping.label, mapping.tone)}${status(formal.label, formal.tone)}</div>${btn("查看详情", `open-version:${focus.id}`, { primary: true })}</article><footer class="version-trace-note"><b>${esc(formal.detail)}</b><span>${esc(mapping.detail)}</span></footer></section>
    </div>`;
  }

  function renderMissingPublishedVersion() {
    const params = routeParams();
    const requestedId = route() === "published/resource" ? params.get("version") : params.get("id") || params.get("version");
    const returnAction = handoffContext() && safeReturnTarget(handoffContext().returnTo) ? btn("返回数据工程", "return-data-engineering", { primary: true }) : btn("返回已发布本体", "nav-published", { primary: true });
    return `<div class="page-scroll">${pageHeader("未找到此已发布版本", "请求的精确语义版本不存在或已无法访问。", returnAction, "已发布本体")}
      <section class="panel"><div class="empty"><span>V</span><h3>无法打开指定版本</h3><p>${requestedId ? `版本标识 ${esc(requestedId)} 未出现在已发布目录中。` : "当前链接没有包含精确语义版本。"} 系统不会自动切换到其他版本。</p>${btn("返回版本目录", "nav-published", { primary: true })}</div></section>
    </div>`;
  }

  function renderMissingPublishedResource(version) {
    const resourceId = routeParams().get("id");
    return `<div class="page-scroll">${pageHeader("未找到此语义资源", `${version.semanticVersion} 中不存在请求的语义资源。`, btn("返回资源与模型", `open-version-tab:${version.id}:resources`, { primary: true }), "Published 资源")}
      <section class="panel"><div class="empty"><span>${networkIcon("module-network-icon")}</span><h3>无法打开指定资源</h3><p>${resourceId ? `稳定语义身份 ${esc(resourceId)} 不属于该精确版本。` : "当前链接没有包含稳定语义身份。"} 系统不会按同名资源自动迁移。</p>${btn("返回资源目录", `open-version-tab:${version.id}:resources`, { primary: true })}</div></section>
    </div>`;
  }

  function renderPublishedVersion() {
    const version = selectedVersion(); if (!version) return renderMissingPublishedVersion();
    const tab = routeParams().get("tab") || "overview";
    const tabs = [["overview", "版本概览"], ["resources", "资源与模型"], ["canvas", "在画布中查看"], ["data", "数据与消费"], ["updates", "更新与回退"], ["records", "记录与证据"]];
    const publication = publicationStateOf(version); const validity = businessValidityStateOf(version); const formal = formalUseStateOf(version); const mapping = publishedMappingContractAssessment(version);
    const headerActions = `${btn("返回本体详情", `open-ontology:${version.ontologyStableId}`)}${handoffContext() && safeReturnTarget(handoffContext().returnTo) ? btn("返回数据工程", "return-data-engineering") : ""}${tab === "canvas" ? "" : btn("创建修订 Draft", `clone-version:${version.id}`)}`;
    return `<div class="page-scroll published-version">${pageHeader(version.name, `${version.semanticVersion} · 精确 Published 语义版本`, headerActions, "已发布本体")}
      <div class="version-context"><div><span>精确语义版本</span><b>${esc(version.semanticVersion)}</b></div><div><span>版本稳定标识</span><b class="mono">${esc(version.id)}</b></div><div><span>发布状态</span><b>${esc(publication)}</b></div><div><span>业务有效状态</span><b>${esc(validity)}</b></div><div><span>发布时数据映射</span>${status(mapping.label, mapping.tone)}</div><div><span>正式使用状态</span>${status(formal.label, formal.tone)}</div><div><span>业务生效</span><b>${esc(humanDateTime(version.effectiveFrom))}</b></div><div><span>发布时间</span><b>${esc(version.publishedAt)}</b></div><div><span>适用场景</span><b>${esc(scenarioDisplayLabel(version))}</b></div></div>
      <nav class="tabs">${tabs.map(([key, label]) => `<button class="${tab === key ? "active" : ""}" data-action="version-tab:${key}">${esc(label)}</button>`).join("")}</nav>
      ${renderVersionTab(version, tab)}
    </div>`;
  }

  function renderVersionTab(version, tab) {
    const contract = versionDataContract(version);
    if (tab === "overview") {
      const publication = publicationStateOf(version); const validity = businessValidityStateOf(version); const mapping = publishedMappingContractAssessment(version); const formal = formalUseStateOf(version); const snapshot = version.validationSnapshot || null;
      const snapshotReady = snapshot?.status === "passed"; const passedGroups = snapshot?.groups?.filter(group => group.status === "passed").length || 0; const snapshotResourceCount = snapshot?.resourceManifest?.length || 0;
      return `<div class="version-overview">
        <section class="panel"><div class="panel-head"><div><h2>版本定义</h2><p>该快照内容不可变。</p></div>${status(publication, lifecycleTone(publication))}</div><div class="panel-body"><dl class="definition-grid"><dt>业务定义</dt><dd>${esc(version.definition)}</dd><dt>本体追溯标识</dt><dd class="mono">${esc(version.ontologyStableId)}</dd><dt>版本追溯标识</dt><dd class="mono">${esc(version.id)}</dd><dt>精确语义版本</dt><dd class="mono">${esc(version.semanticVersion)}</dd><dt>责任人</dt><dd>${esc(version.owner || "待确认")}</dd><dt>发布状态</dt><dd>${esc(localizeUiText(publication))}</dd><dt>业务有效状态</dt><dd>${esc(validity)}</dd><dt>业务生效时间</dt><dd>${esc(humanDateTime(version.effectiveFrom))}</dd><dt>业务失效时间</dt><dd>${esc(version.effectiveTo ? humanDateTime(version.effectiveTo) : "未预设失效时间")}</dd><dt>发布时数据映射</dt><dd>${esc(mapping.label)} · ${esc(mapping.detail)}</dd><dt>正式使用状态</dt><dd>${esc(formal.label)} · ${esc(formal.detail)}</dd><dt>发布时间</dt><dd>${esc(version.publishedAt)}</dd><dt>基于草稿</dt><dd>${esc(localizeUiText(version.sourceDraftName))}</dd><dt>变更原因</dt><dd>${esc(version.changeSummary || "待确认")}</dd><dt>替代关系</dt><dd>${esc(version.replacementDeclaration || "待确认")}</dd><dt>最近变更时间</dt><dd>${esc(version.lastChangedAt || "待确认")}</dd><dt>受控证据定位</dt><dd><span class="mono">${esc(version.publishEvidenceRef || "待确认")}</span> ${version.publishEvidenceRef ? btn("查看证据", `open-evidence:publish:${version.id}`, { small: true }) : ""}</dd><dt>数据资产版本</dt><dd class="mono">${esc(contract?.assetVersion || "未冻结")}</dd><dt>数据截至</dt><dd>${esc(contract?.asOf || "未冻结")}</dd></dl></div></section>
        <section class="panel"><div class="panel-head"><div><h2>资源构成</h2><p>所有资源均归属于本精确版本。</p></div></div><div class="resource-counts"><span><b>${version.objects.length}</b>Object</span><span><b>${version.properties.length}</b>Property</span><span><b>${version.links.length}</b>Link</span><span><b>${version.metrics.length}</b>Metric</span><span><b>${version.rules.length}</b>Rule</span><span><b>${version.actions.length}</b>Action Type</span></div></section>
        <section class="panel wide"><div class="panel-head"><div><h2>发布校验证据</h2><p>显示发布时冻结的校验快照；不根据当前页面内容反推历史结果。</p></div>${btn("查看证据", `open-evidence:publish:${version.id}`)}</div><div class="evidence-summary"><div><b>校验范围</b><span>${snapshotReady ? `${esc(snapshot.scopeSummary)} · ${snapshotResourceCount} 项稳定资源身份` : "历史校验快照待确认"}</span></div><div><b>分组结果</b><span>${snapshotReady ? `${passedGroups}/${snapshot.groups.length} 个校验范围通过 · ${esc(snapshot.checkedAt)}` : "未冻结分组结果，不能据此宣称完整"}</span></div><div><b>关系与映射</b><span>${snapshotReady && snapshot.mapping?.complete ? esc(snapshot.mapping.detail) : snapshot?.mapping?.detail ? esc(snapshot.mapping.detail) : "映射校验证据待确认"}</span></div></div></section>
      </div>`;
    }
    if (tab === "resources") return renderVersionResources(version);
    if (tab === "canvas") return renderPublishedCanvas(version);
    if (tab === "data") return renderVersionData(version);
    if (tab === "updates") return renderVersionUpdates(version);
    return renderVersionRecords(version);
  }

  function publishedResources(version) {
    return [
      ...version.objects.map(x => ({ ...x, kind: "object", type: "Object Type" })), ...version.properties.map(x => ({ ...x, kind: "property", type: "Property" })),
      ...version.links.map(x => ({ ...x, kind: "link", type: "Link Type" })), ...version.metrics.map(x => ({ ...x, kind: "metric", type: "Metric" })),
      ...version.rules.map(x => ({ ...x, kind: "rule", type: "Rule" })), ...version.actions.map(x => ({ ...x, kind: "action", type: "Action Type" }))
    ];
  }

  function renderVersionResources(version) {
    const all = publishedResources(version);
    const typed = ui.versionResourceType === "全部" ? all : all.filter(r => r.type === ui.versionResourceType);
    const query = ui.versionResourceQuery.trim().toLowerCase();
    const resources = query ? typed.filter(resource => {
      const terms = { ...defaultTerms(resource), ...(resource.terms || {}) };
      return [resource.name, resource.id, resource.definition, resource.type, terms.preferredName, terms.abbreviation, terms.discouraged, ...(terms.synonyms || [])]
        .some(value => String(value || "").toLowerCase().includes(query));
    }) : typed;
    if (ui.versionResourceView === "model") return `<section class="panel model-panel"><div class="panel-head"><div><h2>模型全景</h2><p>${esc(version.semanticVersion)} · 只读 Published 快照</p></div>${resourceControls()}</div>${renderReadonlyModel(version)}</section>`;
    const result = resources.length
      ? ui.versionResourceView === "cards"
        ? `<div class="resource-cards">${resources.map(resource => resourceCard(resource, version.id)).join("")}</div>`
        : `<div class="table-wrap"><table><thead><tr><th>业务名称</th><th>资源类型</th><th>稳定语义身份</th><th>精确版本</th><th>发布 / 业务有效</th><th>可供新消费配置</th><th></th></tr></thead><tbody>${resources.map(resource => `<tr><td><b>${esc(resource.name)}</b></td><td>${esc(resource.type)}</td><td class="mono">${esc(resource.id)}</td><td>${esc(version.semanticVersion)}</td><td>${resourceLifecycleStatus(resource)}</td><td>${esc(newBindingStateOf(resource, version))}</td><td>${btn("查看详情", `open-published-resource:${version.id}:${resource.id}`, { small: true })}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty compact"><span>⌕</span><h3>没有匹配的语义资源</h3><p>调整搜索词或资源类型后再试。</p>${btn("清除筛选", "clear-resource-filter", { primary: true })}</div>`;
    return `<section class="panel"><div class="panel-head"><div><h2>语义资源</h2><p>点击资源进入精确版本下的完整详情。</p></div>${resourceControls()}</div>${result}</section>`;
  }

  function resourceControls() {
    return `<div class="resource-controls"><input data-input="published-resource-query" value="${esc(ui.versionResourceQuery)}" placeholder="搜索业务名称、定义或稳定身份" /><select data-input="published-resource-type">${["全部", "Object Type", "Property", "Link Type", "Metric", "Rule", "Action Type"].map(t => `<option ${ui.versionResourceType === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select><div class="segmented"><button class="${ui.versionResourceView === "cards" ? "active" : ""}" data-action="resource-view:cards">卡片</button><button class="${ui.versionResourceView === "list" ? "active" : ""}" data-action="resource-view:list">列表</button><button class="${ui.versionResourceView === "model" ? "active" : ""}" data-action="resource-view:model">模型全景</button></div></div>`;
  }

  function resourceLifecycleStatus(resource) {
    const publication = publicationStateOf(resource); const validity = businessValidityStateOf(resource);
    return `<span class="resource-state-pair">${status(publication, lifecycleTone(publication))}${status(validity, lifecycleTone(validity))}</span>`;
  }

  function resourceCard(resource, versionId = selectedVersion()?.id) {
    const version = state.publishedVersions.find(item => item.id === versionId) || null;
    return `<article><div><span class="type-${resource.kind}">${resource.kind === "action" ? "A" : resource.kind[0].toUpperCase()}</span>${resourceLifecycleStatus(resource)}</div><h3>${esc(resource.name)}</h3><p class="mono">${esc(resource.id)}</p><small>${esc(resource.type)} · ${esc(newBindingStateOf(resource, version))}</small>${btn("查看详情", `open-published-resource:${versionId}:${resource.id}`, { primary: true, small: true })}</article>`;
  }

  function renderReadonlyModel(version) {
    const scene = publishedSemanticScene({ ...version, positions: version.positions || POSITION_PRESET });
    const matchedResources = publishedResources(version).filter(resource => {
      const typeMatched = ui.versionResourceType === "全部" || resource.type === ui.versionResourceType;
      const query = ui.versionResourceQuery.trim().toLowerCase();
      const terms = { ...defaultTerms(resource), ...(resource.terms || {}) };
      const queryMatched = !query || [resource.name, resource.id, resource.definition, resource.type, terms.preferredName, terms.abbreviation, terms.discouraged, ...(terms.synonyms || [])]
        .some(value => String(value || "").toLowerCase().includes(query));
      return typeMatched && queryMatched;
    });
    const allowed = new Set(matchedResources.filter(resource => resource.kind !== "property").map(resource => resource.id));
    const propertyMatchesByObject = new Map();
    matchedResources.filter(resource => resource.kind === "property").forEach(property => {
      allowed.add(property.parentId);
      const matches = propertyMatchesByObject.get(property.parentId) || [];
      matches.push(property);
      propertyMatchesByObject.set(property.parentId, matches);
    });
    const visibleNodes = scene.nodes.filter(node => allowed.has(node.id)).map(node => {
      const matches = propertyMatchesByObject.get(node.id) || [];
      if (!matches.length) return node;
      const names = matches.slice(0, 3).map(property => property.name).join("、");
      return { ...node, subtitle: `命中 ${matches.length} 个 Property${names ? ` · ${names}${matches.length > 3 ? "等" : ""}` : ""}` };
    });
    const visibleIds = new Set(visibleNodes.map(node => node.id));
    const visibleEdges = scene.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to));
    const body = visibleNodes.length
      ? `<div class="readonly-world" style="width:${WORLD.width}px;height:${WORLD.height}px"><svg class="edge-layer" width="${WORLD.width}" height="${WORLD.height}"><defs><marker id="arrow-semantic" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>${visibleEdges.map(edge => renderEdge(edge)).join("")}</svg>${visibleNodes.map(node => renderReadonlyNode(node, version.id)).join("")}</div>`
      : `<div class="empty compact readonly-filter-empty"><span>⌕</span><h3>模型中没有匹配资源</h3><p>调整搜索词或资源类型后再试。</p>${btn("清除筛选", "clear-resource-filter", { primary: true })}</div>`;
    const note = ui.versionResourceType === "Property" || propertyMatchesByObject.size
      ? `Property 归属于 Object；一级全景显示命中属性的所属对象，点击对象查看 ${esc(version.semanticVersion)} 下的完整属性。`
      : `点击任一语义资源查看 ${esc(version.semanticVersion)} 下的精确详情`;
    return `<div class="readonly-model">${body}<div class="readonly-note">${status("只读 Published 模型", "green")}<span>${note}</span></div></div>`;
  }

  function renderReadonlyNode(node, versionId) {
    const [x, y] = node.pos;
    if (node.kind === "link") return `<button class="canvas-node semantic-node link readonly-link" data-node="${esc(node.id)}" data-action="open-published-resource:${esc(versionId)}:${esc(node.id)}" style="left:${x}px;top:${y}px"><div class="link-core"><span>L</span><div><small>LINK TYPE</small><b>${esc(node.name)}</b></div><em>${esc(node.cardinality || "关系")}</em></div><p>${esc(node.subtitle || "")}</p></button>`;
    return `<button class="canvas-node semantic-node ${esc(node.kind)}" data-node="${esc(node.id)}" data-action="open-published-resource:${esc(versionId)}:${esc(node.id)}" style="left:${x}px;top:${y}px"><div class="semantic-band"></div><div class="node-head"><span>${node.kind === "object" ? "O" : node.kind === "link" ? "L" : node.kind === "metric" ? "M" : node.kind === "rule" ? "R" : "A"}</span><small>${esc(TYPE_LABEL[node.kind] || node.kind)}</small></div><b>${esc(node.name)}</b><p>${esc(node.subtitle || "")}</p></button>`;
  }

  function publishedLineageScene(version) {
    const contract = versionDataContract(version);
    if (!contract?.members?.length) return {
      nodes: [], edges: [],
      empty: `<div class="published-canvas-empty"><span>D</span><h3>尚未取得发布时数据映射</h3><p>当前精确版本没有可定位的数据资产成员，不能据此绘制数据沿袭。</p></div>`
    };
    const sourceDataContract = {
      ...clone(contract),
      sourceChain: ["融资业务数据", "数据读取与登记", "标准化与质量处理"]
    };
    const scene = lineageScene({ ...version, sourceDataContract });
    const nodeIds = new Set(scene.nodes.map(node => node.id));
    const relationEdges = (contract.relations || []).filter(relation => nodeIds.has(relation.sourceMemberId) && nodeIds.has(relation.targetMemberId)).map((relation, index) => ({
      id: `published-asset-relation-${relation.id || index}`,
      from: relation.sourceMemberId,
      to: relation.targetMemberId,
      label: relation.name || "资产成员关系",
      kind: "data",
      labelT: .38 + (index % 3) * .1
    }));
    const semanticLinkEdges = (version.links || []).filter(link => nodeIds.has(`target.${link.source}`) && nodeIds.has(`target.${link.target}`)).map((link, index) => ({
      id: `published-semantic-link-${link.id || index}`,
      from: `target.${link.source}`,
      to: `target.${link.target}`,
      label: link.name || "本体关系",
      kind: "mapping",
      labelT: .42 + (index % 3) * .08
    }));
    return { ...scene, edges: [...scene.edges, ...relationEdges, ...semanticLinkEdges] };
  }

  function renderPublishedLineageNode(node, versionId) {
    const [x, y] = node.pos;
    const dataKind = ["asset", "data", "process", "source", "member", "field"].includes(node.kind);
    const content = `${dataKind ? `<i class="data-port left"></i><i class="data-port right"></i><div class="data-topline"></div>` : `<div class="semantic-band"></div>`}<div class="node-head"><span>${node.kind === "object" ? "O" : node.kind === "process" ? "P" : node.kind === "field" ? "F" : "D"}</span><small>${esc(dataKind ? "数据沿袭" : TYPE_LABEL[node.kind] || node.kind)}</small></div><b>${esc(node.name)}</b><p>${esc(node.subtitle || "")}</p>${dataKind ? `<em>只读</em>` : ""}`;
    if (node.resourceId) return `<button class="canvas-node semantic-node object published-lineage-target" data-node="${esc(node.id)}" data-action="open-published-resource:${esc(versionId)}:${esc(node.resourceId)}" style="left:${x}px;top:${y}px">${content}</button>`;
    return `<article class="canvas-node data-node published-lineage-data" data-node="${esc(node.id)}" aria-label="${esc(`${node.name}，只读数据沿袭节点`)}" style="left:${x}px;top:${y}px">${content}</article>`;
  }

  function renderPublishedCanvas(version) {
    const contract = versionDataContract(version);
    const lineage = ui.publishedCanvasView === "lineage";
    const scene = lineage ? publishedLineageScene(version) : publishedSemanticScene({ ...version, positions: version.positions || POSITION_PRESET });
    const zoom = Math.max(.5, Math.min(1, Number(ui.publishedCanvasZoom || .72)));
    const scaledWidth = Math.ceil(WORLD.width * zoom);
    const scaledHeight = Math.ceil(WORLD.height * zoom);
    const nodes = scene.nodes.map(node => lineage ? renderPublishedLineageNode(node, version.id) : renderReadonlyNode(node, version.id)).join("");
    const markers = `<defs><marker id="arrow-semantic" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker><marker id="arrow-data" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z"></path></marker></defs>`;
    const summary = lineage
      ? `${contract?.members?.length || 0} 个数据资产成员 · ${contract?.relations?.length || 0} 条成员关系 · ${version.objects.length} 个本体对象`
      : `${version.objects.length} 个对象 · ${version.links.length} 条关系 · ${version.metrics.length + version.rules.length + version.actions.length} 项业务逻辑`;
    const canvasBody = scene.nodes.length
      ? `<div class="published-canvas-space" style="width:${scaledWidth}px;height:${scaledHeight}px"><div class="readonly-world published-canvas-world" style="width:${WORLD.width}px;height:${WORLD.height}px;transform:scale(${zoom})"><svg class="edge-layer" width="${WORLD.width}" height="${WORLD.height}">${markers}${scene.edges.map(edge => renderEdge(edge)).join("")}</svg>${nodes}</div></div>`
      : scene.empty;
    return `<section class="panel published-canvas-panel"><div class="panel-head"><div><h2>已发布本体画布</h2><p>${esc(version.semanticVersion)} 的不可变快照；可查看语义结构或发布时数据沿袭。</p></div><div class="published-canvas-switch" role="group" aria-label="画布视图"><button class="${lineage ? "" : "active"}" data-action="published-canvas-view:semantic" aria-pressed="${lineage ? "false" : "true"}">语义结构</button><button class="${lineage ? "active" : ""}" data-action="published-canvas-view:lineage" aria-pressed="${lineage ? "true" : "false"}">数据沿袭视图</button></div></div><div class="published-canvas-viewport"><div class="published-canvas-toolbar"><div>${status("只读已发布快照", "green")}<span>${lineage ? "数据资产至本体" : "本体语义结构"}</span></div><div class="published-canvas-zoom"><button data-action="published-canvas-zoom:out" aria-label="缩小画布">−</button><b>${Math.round(zoom * 100)}%</b><button data-action="published-canvas-zoom:in" aria-label="放大画布">＋</button><button data-action="published-canvas-zoom:reset">恢复比例</button></div></div><div class="published-canvas-scroll">${canvasBody}</div><div class="readonly-note published-canvas-note"><span>${esc(summary)}</span><span>${lineage ? "数据侧节点只读；本体对象可进入已发布资源详情。" : "点击语义节点查看该精确版本下的资源详情。"}</span></div></div></section>`;
  }

  function renderRefreshTargetSection(version) {
    const target = latestRefreshTarget(version); const contract = versionDataContract(version); const assessment = refreshTargetAssessment(version, target, contract?.assetId || null);
    const coverage = refreshTargetCoverage(version, target);
    const evidenceRecord = target ? (state.recordsByVersion[version.id] || []).find(record => record.evidenceCode === target.evidenceLocator) || null : null;
    const action = !target
      ? btn("建立刷新目标", `open-refresh-target:${version.id}`, { primary: true })
      : assessment.key === "disabled"
        ? btn("查看并重新启用", `open-refresh-target:${version.id}`, { primary: true })
        : btn("查看详情", `open-refresh-target:${version.id}`, { primary: true });
    return `<section class="panel"><div class="panel-head"><div><h2>数据刷新目标</h2><p>说明数据工程可以把哪个稳定数据资产提交到当前精确已发布版本；不代表数据已经更新或正式启用。</p></div>${status(assessment.label, assessment.tone)}${action}</div>${target ? `<div class="panel-body"><dl class="definition-grid compact"><dt>目标名称</dt><dd>${esc(target.name)}</dd><dt>目标追溯标识</dt><dd class="mono">${esc(target.stableId)} · 绑定版本 ${esc(target.bindingVersion)}</dd><dt>精确语义版本</dt><dd>${esc(target.semanticVersion)} · <span class="mono">${esc(target.semanticVersionId)}</span></dd><dt>稳定数据资产</dt><dd class="mono">${esc(target.dataAssetId)}</dd><dt>来源映射版本</dt><dd class="mono">${esc(target.sourceMappingVersionId || "不可定位")}</dd><dt>成员覆盖</dt><dd>${coverage.actualMemberIds.length}/${coverage.expectedMemberIds.length} · <span class="mono">${esc(coverage.actualMemberIds.join("、") || "未覆盖")}</span></dd><dt>关系覆盖</dt><dd>${coverage.actualRelationIds.length}/${coverage.expectedRelationIds.length} · <span class="mono">${esc(coverage.actualRelationIds.join("、") || "未覆盖")}</span></dd><dt>是否允许提交刷新</dt><dd>${assessment.allowSubmit ? "允许；提交前必须重新读取" : `不允许；${esc(assessment.reason || "状态不可确认")}`}</dd><dt>责任人</dt><dd>${esc(target.owner || "待确认")}</dd><dt>最近核验</dt><dd>${esc(target.lastCheckedAt || "待确认")}</dd><dt>受控证据</dt><dd><span class="mono">${esc(target.evidenceLocator || "待确认")}</span>${evidenceRecord ? btn("查看证据", `open-record:${version.id}:${evidenceRecord.id}`, { small: true }) : ""}</dd></dl>${assessment.allowSubmit ? `<div class="boundary-note"><b>可供数据工程发现</b><p>数据工程提交更新前仍须重新读取当前状态，并固定本次发现响应、目标绑定版本和来源映射版本。</p></div>` : `<div class="result-banner error compact"><span>!</span><div><b>${esc(assessment.label)}</b><p>${esc(assessment.reason)} ${esc(assessment.recovery)}</p></div></div>`}</div>` : `<div class="empty compact"><span>↻</span><h3>尚未建立数据刷新目标</h3><p>发布时数据映射已经冻结，但数据工程还不能据此提交更新。建立后仍需由数据工程在提交前重新读取。</p></div>`}</section>`;
  }

  function renderVersionData(version) {
    const binding = historicalBindingFor(version);
    const current = isCurrentFormalVersion(version);
    const qualityBlocked = isCurrentFormalBlocked(version);
    const lifecycleBlocked = !publishedResourceAvailable(version);
    const blocked = qualityBlocked || lifecycleBlocked;
    const contract = versionDataContract(version);
    const consumers = [
      ["智能问数", "对象、属性、关系、指标、规则与行动类型"], ["决策中心", "规则结果、行动类型与证据"], ["Agent 应用", "获准使用的已发布语义资源"], ["报告中心", "语义证据与原版本引用"]
    ];
    const assessment = versionContextAssessment(version);
    const mapping = publishedMappingContractAssessment(version);
    const formal = formalUseStateOf(version);
    const consumption = publishedConsumptionState(version);
    const compatibility = consumerValidationFor(version, "智能问数");
    const compatibilityState = compatibility ? consumerStatusFor(version, "智能问数") : { label: "未归档", tone: "amber", detail: "当前运行尚未取得智能问数兼容证据归档" };
    const bindingLabel = current ? "当前正式使用版本" : binding ? "历史正式记录" : "正式数据启用状态";
    const bindingStatus = status(formal.label, formal.tone);
    const blockedReason = qualityBlocked ? qualityIncidentFor(version)?.reason || "数据质量状态发生变化" : `语义版本业务有效状态为${businessValidityStateOf(version)}`;
    const blockedAction = qualityBlocked ? btn("处理失败恢复", "version-tab:updates", { primary: true }) : btn("创建修订 Draft", `clone-version:${version.id}`, { primary: true });
    return `<div class="data-consumption">
      ${blocked ? `<div class="result-banner error"><span>!</span><div><b>当前正式版本已停止新的正式输出</b><p>${esc(blockedReason)}。历史证据保持可读，当前组合不得继续新绑定或产生新的正式消费结果。</p></div>${blockedAction}</div>` : ""}
      <section class="panel"><div class="panel-head"><div><h2>${bindingLabel}</h2><p>${current && !blocked ? "语义版本与数据版本作为一个整体对下游提供服务。" : binding ? "该组合已停止当前服务，旧报告与历史证据仍可回到这里。" : "发布时数据映射已经冻结；待更新数据需通过匹配与业务消费验证后，再由用户确认启用。"}</p></div>${bindingStatus}</div>${binding ? `<div class="binding-hero"><div><span>语义版本</span><b>${esc(binding.semanticVersion)}</b></div><i>＋</i><div><span>数据版本</span><b>${esc(binding.dataVersion)}</b></div><dl><dt>数据截至</dt><dd>${esc(binding.asOf)}</dd><dt>切换时间</dt><dd>${esc(binding.switchedAt)}</dd></dl></div>` : `<div class="empty compact"><span>D</span><h3>发布时映射已冻结，尚未启用正式数据</h3><p>${esc(mapping.detail)}。前往“更新与回退”完成待更新数据检查、业务消费验证和人工确认。</p>${btn("处理数据更新", `version-tab:updates`, { primary: true })}</div>`}</section>
      <section class="panel"><div class="panel-head"><div><h2>已发布消费范围</h2><p>说明当前精确版本向各下游开放的业务范围；不代替消费方自己的兼容核验。</p></div>${status(consumption.label, consumption.tone)}</div><div class="consumer-list published-consumption-list">${consumers.map(([name, range]) => `<article><span>${esc(name[0])}</span><div><b>${esc(name)}</b><p>${esc(range)}</p></div>${status(consumption.label, consumption.tone)}</article>`).join("")}</div></section>
      <section class="panel compatibility-evidence"><div class="panel-head"><div><h2>智能问数兼容证据</h2><p>由智能问数核对当前精确语义与数据版本后返回；本体管理仅保存只读结果。</p></div>${status(compatibilityState.label, compatibilityState.tone)}</div><div class="panel-body"><dl class="definition-grid compact"><dt>消费方</dt><dd>智能问数</dd><dt>精确使用组合</dt><dd>${binding ? `${esc(binding.semanticVersion)} ＋ ${esc(binding.dataVersion)}` : "尚未形成"}</dd><dt>兼容状态</dt><dd>${esc(compatibilityState.label)} · ${esc(compatibilityState.detail)}</dd><dt>配置版本</dt><dd>${esc(compatibility?.configVersion || "未归档")}</dd><dt>核验时间</dt><dd>${esc(compatibility?.checkedAt || "未归档")}</dd><dt>来源记录</dt><dd class="mono">${esc(compatibility?.evidenceLocator || "未归档")}</dd></dl>${compatibility ? "" : `<div class="boundary-note warning"><b>兼容证据尚未归档</b><p>当前页面不会根据链路完成数量自动补写兼容结论；取得智能问数返回的精确版本证据后，此处才会更新。</p></div>`}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>消费上下文完整性</h2><p>稳定身份、精确版本、已发布关系和证据定位共同决定。</p></div>${status(assessment.label, assessment.tone)}</div><div class="panel-body"><dl class="definition-grid compact"><dt>资源身份</dt><dd>${version.objects.length + version.properties.length + version.links.length + version.metrics.length + version.rules.length + version.actions.length} 项稳定资源身份</dd><dt>已发布关系</dt><dd>${version.links.length} 条关系可导航</dd><dt>发布时数据映射</dt><dd>${esc(mapping.label)}</dd><dt>正式数据版本</dt><dd>${binding ? esc(binding.dataVersion) : "尚未启用"}</dd><dt>证据定位</dt><dd>${assessment.complete ? "精确版本证据可定位" : "尚未形成完整定位"}</dd><dt>结论说明</dt><dd>${esc(assessment.detail)}</dd></dl></div></section>
      <section class="panel"><div class="panel-head"><div><h2>数据映射合同</h2><p>${esc(contract?.assetVersion || "未冻结")} · 截至 ${esc(contract?.asOf || "未冻结")} · 发布时冻结</p></div>${status(mapping.label, mapping.tone)}${btn("查看沿袭", `open-evidence:lineage:${version.id}`)}</div><div class="mapping-contracts">${version.objects.map(o => `<article><b>${esc(o.name)}</b><span>${esc(memberName(o.memberId, contract))}</span><small>${o.properties.length} 个属性 · 身份 ${esc(propertyName(o, o.identity))}</small></article>`).join("")}</div><div class="mapping-contracts">${(contract?.relations || []).map(relation => `<article><b>${esc(relation.name)}</b><span>${esc(memberName(relation.sourceMemberId, contract))} → ${esc(memberName(relation.targetMemberId, contract))}</span><small class="mono">${esc(relation.id)} · ${esc(relation.cardinality)}</small></article>`).join("")}</div></section>
    </div>`;
  }

  function updateFor(version) { return state.updatesByVersion[version.id] || null; }
  function bindingFor(version) { return state.bindingsByVersion[version.id] || { current: null, previous: null }; }
  function adoptedDataVersionIds(version) {
    const adopted = new Set();
    const bindings = bindingFor(version);
    [bindings.current, bindings.previous].forEach(binding => {
      if (binding?.dataVersion) adopted.add(binding.dataVersion);
    });
    (state.recordsByVersion[version.id] || []).forEach(record => {
      if (isSuccessfulT019Record(record) && record.dataVersion) adopted.add(record.dataVersion);
    });
    return adopted;
  }
  function updatePhaseLabel(update, version = selectedVersion()) {
    if (!update) return "未开始";
    const referenceState = update.validationReference ? validationReferenceState(update.validationReference, version, update) : null;
    if (update.phase === "verification_pending" && referenceState && referenceState.key !== "processing") return `验证引用${referenceState.label}，阻断采用`;
    if (["verified", "switch_failed"].includes(update.phase) && !candidateValidationGate(version, update).passed) return "验证引用已失效，阻断采用";
    return ({ received: "已收到待更新数据", matching: "正在检查匹配", match_failed: "匹配失败", match_incompatible: "数据与本体不兼容", match_unknown: "匹配结果未知", eligible: "具备消费验证条件", verifying: "正在检查验证引用", verification_pending: "智能问数验证运行中", verify_failed: "验证引用阻断采用", verified: "验证门禁通过，待确认切换", switching: "正在切换", switch_failed: "正式切换失败", adopted: "已切换为正式数据" })[update.phase] || "处理中";
  }

  function candidateMappingIssues(version, update) {
    const issues = [];
    const publishedContract = versionDataContract(version);
    const candidateContract = update?.sourceDataContract || null;
    if (!version || !update) return [{ kind: "候选", detail: "待更新数据或精确 Published 版本无法定位" }];
    if (update.sourceModule !== "数据工程" || update.contractCode !== "C028" || !update.requestId || !update.requestEvidenceLocator) issues.push({ kind: "请求", detail: "待更新数据缺少数据工程 C028 的稳定请求标识或证据定位" });
    if (!candidateContract || dataAssetDeliveryIssues(candidateContract).length) issues.push({ kind: "资产", detail: "候选数据资产未通过 C003 完整性与消费资格检查" });
    if (candidateContract && (candidateContract.assetVersion !== update.dataVersion || candidateContract.asOf !== update.asOf || candidateContract.assetId !== update.dataAssetId)) issues.push({ kind: "版本", detail: "C028 引用与候选 C003 的资产身份、精确版本或数据截至时间不一致" });
    const memberById = new Map((candidateContract?.members || []).map(member => [member.id, member]));
    const relationById = new Map((candidateContract?.relations || []).map(relation => [relation.id, relation]));
    const fieldById = member => new Map((member?.fields || []).map(field => [field?.[3], field]));
    for (const mapping of publishedContract?.objectMappings || []) {
      const object = version.objects.find(item => item.id === mapping.objectId);
      const candidateMember = memberById.get(mapping.memberId);
      if (!candidateMember) { issues.push({ kind: "成员", objectId: mapping.objectId, objectName: object?.name, memberId: mapping.memberId, detail: `${object?.name || mapping.objectId}所需资产成员已缺失` }); continue; }
      const candidateFields = fieldById(candidateMember);
      for (const propertyMapping of mapping.propertyMappings || []) {
        const property = object?.properties?.find(item => item.id === propertyMapping.propertyId);
        const candidateField = candidateFields.get(propertyMapping.sourceFieldId);
        if (!candidateField) issues.push({ kind: "字段", objectId: mapping.objectId, objectName: object?.name, propertyId: propertyMapping.propertyId, propertyName: property?.name, fieldId: propertyMapping.sourceFieldId, detail: `${object?.name || mapping.objectId}.${property?.name || propertyMapping.propertyId}的来源字段已缺失` });
        else if (!compatibleTypes(candidateField[1], propertyMapping.dataType || property?.dataType)) issues.push({ kind: "类型", objectId: mapping.objectId, objectName: object?.name, propertyId: propertyMapping.propertyId, propertyName: property?.name, fieldId: propertyMapping.sourceFieldId, expectedType: propertyMapping.dataType || property?.dataType, actualType: candidateField[1], detail: `${object?.name || mapping.objectId}.${property?.name || propertyMapping.propertyId}要求${propertyMapping.dataType || property?.dataType}，候选字段为${candidateField[1]}` });
      }
    }
    for (const mapping of publishedContract?.linkMappings || []) {
      const link = version.links.find(item => item.id === mapping.linkId);
      const relation = mapping.assetRelationId ? relationById.get(mapping.assetRelationId) : null;
      if (!relation) { issues.push({ kind: "关系", linkId: mapping.linkId, linkName: link?.name, relationId: mapping.assetRelationId, detail: `${link?.name || mapping.linkId}依赖的资产成员关系已缺失` }); continue; }
      const sourceMember = memberById.get(relation.sourceMemberId); const targetMember = memberById.get(relation.targetMemberId);
      const sourceField = fieldById(sourceMember).get(relation.sourceFieldId); const targetField = fieldById(targetMember).get(relation.targetFieldId);
      if (!sourceField || !targetField) issues.push({ kind: "端点", linkId: mapping.linkId, linkName: link?.name, relationId: relation.id, detail: `${link?.name || mapping.linkId}的资产关系端点无法完整定位` });
      else if (!compatibleTypes(sourceField[1], targetField[1])) issues.push({ kind: "端点", linkId: mapping.linkId, linkName: link?.name, relationId: relation.id, detail: `${link?.name || mapping.linkId}的候选端点类型不兼容：${sourceField[1]} 与 ${targetField[1]}` });
      if (relation.endpointCheckStatus !== "通过" || Number(relation.unmatchedSourceCount) !== 0 || Number(relation.unmatchedTargetCount) !== 0) issues.push({ kind: "覆盖", linkId: mapping.linkId, linkName: link?.name, relationId: relation.id, detail: `${link?.name || mapping.linkId}存在未匹配关系端点` });
    }
    return issues;
  }

  const CANDIDATE_MATCH_STATES = Object.freeze({
    processing: { status: "processing", label: "处理中", objectFallback: "检查中", relationFallback: "检查中", recovery: "等待当前检查结束；不得提前形成消费验证资格。" },
    passed: { status: "passed", label: "成功", objectFallback: "通过", relationFallback: "通过", recovery: "无需恢复；该结果仅用于判定是否具备业务消费验证条件。" },
    failed: { status: "failed", label: "失败", objectFallback: "失败", relationFallback: "失败", recovery: "检查运行未完成；保留原因后重新执行匹配检查，当前正式版本保持不变。" },
    incompatible: { status: "incompatible", label: "不兼容", objectFallback: "不兼容", relationFallback: "不兼容", recovery: "返回对应 Object、Property、Link 或映射位置显式修正，重新发布后再由数据工程提交新请求。" },
    unknown: { status: "unknown", label: "未知", objectFallback: "未知", relationFallback: "未知", recovery: "重新执行匹配检查；在取得明确结果前继续使用当前正式版本。" }
  });

  function candidateMatchOutcome(issues = []) {
    if (!issues.length) return "passed";
    return issues.some(item => ["成员", "字段", "类型", "关系", "端点", "覆盖"].includes(item.kind)) ? "incompatible" : "failed";
  }

  function formCandidateMatchResult(version, update, issues = [], outcome = issues.length ? candidateMatchOutcome(issues) : "passed") {
    const stateDefinition = CANDIDATE_MATCH_STATES[outcome] || CANDIDATE_MATCH_STATES.unknown;
    const candidateKey = candidateKeyFor(version, update);
    const objectIssues = issues.filter(item => ["成员", "字段", "类型", "版本", "资产", "请求", "候选"].includes(item.kind));
    const relationIssues = issues.filter(item => ["关系", "端点", "覆盖"].includes(item.kind));
    const finished = stateDefinition.status !== "processing";
    return {
      sourceModule: "本体管理", contractCode: "C029", resultId: makeId("match-result"), resultStatus: stateDefinition.label, status: stateDefinition.status,
      formedAt: fullNowText(), checkedAt: finished ? fullNowText() : null, candidateKey,
      semanticVersionId: version.id, semanticVersion: version.semanticVersion, t017VersionId: update.targetSemanticVersionId,
      scenarioContext: clone(scenarioContextOf(update || version)),
      dataAssetId: update.dataAssetId, dataVersion: update.dataVersion, asOf: update.asOf, sourceMappingVersionId: update.sourceMappingVersionId,
      originalRequest: { contractCode: "C028", requestId: update.requestId, evidenceLocator: update.requestEvidenceLocator },
      refreshTarget: { stableId: update.refreshTargetId, bindingVersion: update.refreshTargetBindingVersion, evidenceLocator: update.refreshTargetEvidenceLocator },
      objectChecks: { status: objectIssues.length ? stateDefinition.objectFallback : outcome === "passed" ? "通过" : stateDefinition.objectFallback, checkedCount: version.objects.length, issues: clone(objectIssues) },
      relationChecks: { status: relationIssues.length ? stateDefinition.relationFallback : outcome === "passed" ? "通过" : stateDefinition.relationFallback, checkedCount: version.links.length, issues: clone(relationIssues) },
      reason: outcome === "passed" ? null : outcome === "processing" ? "正在核对对象身份、Property 类型、Link 端点和成员范围" : issues[0]?.detail || "匹配检查未形成明确成功结果",
      recoverySuggestion: stateDefinition.recovery,
      currentFormalSnapshot: clone(currentFormalSnapshot(version)), evidenceLocator: null
    };
  }

  function storeCandidateMatchResult(update, result) {
    update.matchResult = result;
    update.matchResultHistory = [...(update.matchResultHistory || []), clone(result)];
    return result;
  }

  function replaceCandidateMatchResult(update, result) {
    update.matchResult = result;
    update.matchResultHistory = [
      ...(update.matchResultHistory || []).filter(item => item?.resultId !== result.resultId),
      clone(result)
    ];
    return result;
  }

  function requestedMatchOutcome(update, issues = []) {
    const declared = (update?.changeHints || []).map(item => typeof item === "string" ? item : item?.outcome || item?.status || item?.type || "").join(" ").toLowerCase();
    if (/(unknown|timeout|interrupted|evidence_missing|结果未知|超时|中断|证据缺失)/.test(declared)) return "unknown";
    if (/(failed|execution_failed|运行失败|检查失败)/.test(declared)) return "failed";
    return issues.length ? candidateMatchOutcome(issues) : "passed";
  }

  function candidateMatchPhase(outcome) {
    return outcome === "passed" ? "eligible" : outcome === "incompatible" ? "match_incompatible" : outcome === "unknown" ? "match_unknown" : "match_failed";
  }

  function candidateMatchRecordPresentation(outcome) {
    return ({
      passed: { title: "数据与本体匹配通过", status: "成功", tone: "green", detail: "对象身份、Property 类型、Link 端点和成员范围均与当前语义版本兼容。" },
      incompatible: { title: "待更新数据与本体不兼容", status: "不兼容", tone: "red" },
      failed: { title: "数据与本体匹配检查失败", status: "失败", tone: "red" },
      unknown: { title: "数据与本体匹配结果未知", status: "未知", tone: "amber" }
    })[outcome] || { title: "数据与本体匹配结果未知", status: "未知", tone: "amber" };
  }

  function pendingRepairDetail(version, update) {
    const issue = update?.matchIssues?.find(item => ["字段", "类型", "关系", "端点", "覆盖"].includes(item.kind)) || null;
    if (!issue) return null;
    const fallback = breakingUpdateDetail(version);
    return {
      ...fallback,
      objectId: issue.objectId || fallback?.objectId || version?.links?.find(link => link.id === issue.linkId)?.source || null,
      objectName: issue.objectName || fallback?.objectName || "相关对象",
      propertyId: issue.propertyId || null,
      propertyName: issue.propertyName || null,
      linkId: issue.linkId || fallback?.linkId || null,
      linkName: issue.linkName || fallback?.linkName || "关系端点",
      oldFieldId: issue.fieldId || fallback?.oldFieldId || null,
      oldFieldName: issue.propertyName || fallback?.oldFieldName || "原映射字段",
      newFieldId: null,
      newFieldName: "需要从候选资产中显式选择",
      sample: null,
      memberId: issue.memberId || fallback?.memberId || null,
      detail: issue.detail
    };
  }

  function breakingUpdateDetail(version) {
    const link = version?.links?.find(item => item.id === "LINK-FINANCING-INSTITUTION") || version?.links?.find(item => item.sourceEndpoint?.kind === "assetField" || item.targetEndpoint?.kind === "assetField");
    if (!link) return null;
    const side = link.sourceEndpoint?.kind === "assetField" ? "source" : "target";
    const endpoint = link[`${side}Endpoint`]; const objectId = side === "source" ? link.source : link.target;
    const object = version.objects.find(item => item.id === objectId); const member = contractMember(versionDataContract(version), endpoint?.memberId || object?.memberId);
    const field = member?.fields?.find(item => item[3] && item[3] === endpoint?.id);
    if (!endpoint?.id || !field) return null;
    const newName = field[0] === "机构编码" ? "机构代码" : `${field[0]}（新字段）`;
    return { linkId: link.id, linkName: link.name, side, objectId, objectName: object?.name || objectId, memberId: member.id, oldFieldId: endpoint.id, oldFieldName: field[0], newFieldId: `${endpoint.id}-V2`, newFieldName: newName, sample: field[2] };
  }

  function candidateKeyFor(version, update) {
    const context = scenarioContextOf(update || version, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null });
    return `${context.scenarioId || ""}|${context.scenarioVersion || ""}|${context.scenarioRunId || ""}|${version?.id || ""}|${version?.semanticVersion || ""}|${update?.dataVersion || ""}|${update?.asOf || ""}|${update?.candidateRevision || 1}`;
  }
  function candidateValidationAdmission(version, update) {
    const expectedKey = candidateKeyFor(version, update);
    const checks = [
      { pass: !!version && !!update && updateFor(version) === update, reason: "当前待更新数据已经变化或不可定位" },
      { pass: update?.matchResult?.status === "passed", reason: "数据与本体匹配检查尚未成功" },
      { pass: update?.matchResult?.candidateKey === expectedKey, reason: "匹配结果不属于当前候选双版本" },
      { pass: update?.eligibility?.status === "eligible", reason: "尚未形成当前候选的消费验证资格" },
      { pass: update?.eligibility?.candidateKey === expectedKey, reason: "消费验证资格不属于当前候选双版本" },
      { pass: update?.eligibility?.basedOnMatchResult === update?.matchResult?.resultId, reason: "消费验证资格没有回指当前匹配结果" },
      { pass: !["switching", "adopted"].includes(update?.phase), reason: update?.phase === "adopted" ? "当前候选已经完成正式切换" : "当前候选正在受控切换，不能接收新的验证输入" }
    ];
    const failed = checks.find(check => !check.pass);
    return { passed: !failed, expectedKey, checks, reason: failed?.reason || null };
  }
  function validationReferenceSnapshot(reference) {
    if (!reference || typeof reference !== "object") return null;
    return {
      sourceModule: reference.sourceModule || null,
      contractCode: reference.contractCode || null,
      decisionRef: reference.decisionRef || null,
      candidateKey: reference.candidateKey || null,
      semanticVersionId: reference.semanticVersionId || null,
      semanticVersion: reference.semanticVersion || null,
      dataVersion: reference.dataVersion || null,
      asOf: reference.asOf || null,
      scenarioContext: scenarioContextOf(reference.scenarioContext || reference, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null }),
      questionSetVersion: reference.questionSetVersion || null,
      questionSetEvidenceLocator: reference.questionSetEvidenceLocator || null,
      validationRequirementFingerprint: reference.validationRequirementFingerprint || null,
      status: reference.status || null,
      completedAt: reference.completedAt || null,
      expiresAtEpoch: reference.expiresAtEpoch || null,
      runId: reference.runId || null,
      evidenceLocator: reference.evidenceLocator || null,
      retryOf: reference.retryOf || null,
      items: (Array.isArray(reference.items) ? reference.items : []).map(item => ({ id: item?.id || null, status: item?.status || null, evidenceLocator: item?.evidenceLocator || null })).sort((left, right) => String(left.id).localeCompare(String(right.id)))
    };
  }
  function validationReferenceFingerprint(reference) { return snapshotFingerprint(validationReferenceSnapshot(reference)); }
  function externalExpiryLabel(value) {
    const epoch = Number(value);
    return Number.isFinite(epoch) && epoch > 0 ? new Date(epoch).toISOString().replace("T", " ").replace(".000Z", "Z") : "待确认";
  }
  function validationReferenceIdentity(reference) {
    const snapshot = validationReferenceSnapshot(reference) || {};
    return snapshotFingerprint({ sourceModule: snapshot.sourceModule, contractCode: snapshot.contractCode, decisionRef: snapshot.decisionRef, candidateKey: snapshot.candidateKey, semanticVersionId: snapshot.semanticVersionId, semanticVersion: snapshot.semanticVersion, dataVersion: snapshot.dataVersion, asOf: snapshot.asOf, questionSetVersion: snapshot.questionSetVersion, questionSetEvidenceLocator: snapshot.questionSetEvidenceLocator, validationRequirementFingerprint: snapshot.validationRequirementFingerprint, runId: snapshot.runId, retryOf: snapshot.retryOf });
  }
  function validationRequirement(reference) {
    const itemIds = Array.isArray(reference?.requiredItemIds) ? reference.requiredItemIds.filter(Boolean) : [];
    return {
      questionSetVersion: reference?.questionSetVersion || null,
      questionSetEvidenceLocator: reference?.questionSetEvidenceLocator || null,
      requiredItemIds: itemIds.slice().sort(),
      itemIdsUnique: itemIds.length > 0 && new Set(itemIds).size === itemIds.length
    };
  }
  function validationRequirementSnapshot(requirement) {
    if (!requirement || typeof requirement !== "object") return null;
    const normalized = validationRequirement(requirement);
    return {
      sourceModule: requirement.sourceModule || null,
      contractCode: requirement.contractCode || null,
      decisionRef: requirement.decisionRef || null,
      candidateKey: requirement.candidateKey || null,
      semanticVersionId: requirement.semanticVersionId || null,
      semanticVersion: requirement.semanticVersion || null,
      dataVersion: requirement.dataVersion || null,
      asOf: requirement.asOf || null,
      scenarioContext: scenarioContextOf(requirement.scenarioContext || requirement, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null }),
      questionSetVersion: normalized.questionSetVersion,
      questionSetEvidenceLocator: normalized.questionSetEvidenceLocator,
      requiredItemIds: normalized.requiredItemIds,
      issuedAt: requirement.issuedAt || null
    };
  }
  function validationTargetMatches(payload, version, update) {
    if (!payload || !version || !update) return false;
    return payload.sourceModule === "智能问数"
      && payload.contractCode === "C008"
      && payload.decisionRef === "D064"
      && payload.candidateKey === candidateKeyFor(version, update)
      && payload.semanticVersionId === version.id
      && payload.semanticVersion === version.semanticVersion
      && payload.dataVersion === update.dataVersion
      && payload.asOf === update.asOf
      && sameScenarioEnvelope(payload, update || version);
  }

  function validationRequirementFieldsReady(requirement) {
    const normalized = validationRequirement(requirement);
    return resolvedExternalValue(requirement?.questionSetVersion)
      && resolvedExternalValue(requirement?.questionSetEvidenceLocator)
      && resolvedExternalTime(requirement?.issuedAt)
      && normalized.itemIdsUnique;
  }
  function validationRunIdsForCandidate(version, update) {
    const key = externalValidationInboxKey(version, update);
    const inbox = state.externalValidationInbox?.[key];
    const events = Array.isArray(inbox) ? inbox : inbox ? [{ payload: inbox }] : [];
    return new Set([
      ...events.map(event => event?.payload?.runId),
      ...(update?.validationReferenceHistory || []).map(reference => reference?.runId),
      update?.validationReference?.runId
    ].filter(Boolean));
  }
  function validationReferenceState(reference, version = null, update = null) {
    if (!reference) return { key: "missing", label: "尚未收到", tone: "neutral" };
    const expectedKey = version && update ? candidateKeyFor(version, update) : null;
    if (reference.contractCode !== "C008" || reference.decisionRef !== "D064") return { key: "contract_conflict", label: "采用合同或验证依据冲突", tone: "red" };
    if (reference.sourceModule !== "智能问数") return { key: "source_conflict", label: "来源不符合合同", tone: "red" };
    if (expectedKey && (reference.candidateKey !== expectedKey || reference.semanticVersionId !== version?.id || reference.semanticVersion !== version?.semanticVersion || reference.dataVersion !== update?.dataVersion || reference.asOf !== update?.asOf)) return { key: "version_mismatch", label: "版本不一致", tone: "red" };
    if (reference.status === "contract_conflict") return { key: "contract_conflict", label: "采用合同或验证依据冲突", tone: "red" };
    if (reference.status === "version_mismatch") return { key: "version_mismatch", label: "版本不一致", tone: "red" };
    if (reference.status === "evidence_missing") return { key: "evidence_missing", label: "证据缺失", tone: "red" };
    if (reference.status === "expired" || (reference.expiresAtEpoch && Date.now() > Number(reference.expiresAtEpoch))) return { key: "expired", label: "已过期", tone: "red" };
    const completedAtEpoch = reference.completedAt ? Date.parse(reference.completedAt) : NaN;
    const issuedAtEpoch = update?.validationRequirement?.issuedAt ? Date.parse(update.validationRequirement.issuedAt) : NaN;
    if (reference.completedAt && !Number.isFinite(completedAtEpoch)) return { key: "time_invalid", label: "完成时间无效", tone: "red" };
    if (Number.isFinite(completedAtEpoch) && completedAtEpoch > Date.now()) return { key: "time_invalid", label: "完成时间晚于当前时间", tone: "red" };
    if (Number.isFinite(completedAtEpoch) && Number.isFinite(issuedAtEpoch) && completedAtEpoch < issuedAtEpoch) return { key: "time_invalid", label: "完成时间早于题集签发", tone: "red" };
    if (reference.expiresAtEpoch && (!Number.isFinite(Number(reference.expiresAtEpoch)) || (reference.completedAt && Date.parse(reference.completedAt) > Number(reference.expiresAtEpoch)))) return { key: "time_invalid", label: "有效期不一致", tone: "red" };
    if (update?.validationReferenceFingerprint && update.validationReferenceFingerprint !== validationReferenceFingerprint(reference)) return { key: "snapshot_changed", label: "引用快照已变化", tone: "red" };
    if (reference.status === "processing") return { key: "processing", label: "运行中", tone: "blue" };
    if (reference.status === "passed") return { key: "passed", label: "本体核对待完成", tone: "amber" };
    if (reference.status === "failed") return { key: "failed", label: "运行失败", tone: "red" };
    return { key: "unknown", label: "结果未知", tone: "amber" };
  }
  function candidateValidationGate(version, update) {
    const reference = update?.validationReference || null;
    const expectedKey = candidateKeyFor(version, update);
    const items = reference?.items || [];
    const itemIds = items.map(item => item?.id).filter(Boolean);
    const uniqueItemIds = new Set(itemIds);
    const requirement = update?.validationRequirement || null;
    const requiredItemIds = requirement?.requiredItemIds || [];
    const requirementItemIdsUnique = requiredItemIds.length > 0 && new Set(requiredItemIds).size === requiredItemIds.length;
    const historicalRunIds = new Set((update?.validationReferenceHistory || []).map(item => item?.runId).filter(Boolean));
    const resources = publishedResources(version);
    const mapping = publishedMappingContractAssessment(version);
    const contextualState = validationReferenceState(reference, version, update);
    const activeResources = resources.filter(resource => businessValidityStateOf(resource) !== "停用");
    const checks = [
      { label: "数据与本体匹配检查", pass: update?.matchResult?.status === "passed" && update.matchResult.candidateKey === expectedKey, reason: "匹配结果必须属于当前候选双版本" },
      { label: "消费验证资格", pass: update?.eligibility?.status === "eligible" && update.eligibility.candidateKey === expectedKey, reason: "资格必须来自当前匹配结果" },
      { label: "采用合同引用", pass: reference?.contractCode === "C008", reason: "外部证据必须明确供 C008 权威消费绑定引用；这不改变固定题运行归智能问数拥有" },
      { label: "验证裁决依据", pass: reference?.decisionRef === "D064", reason: "固定题验证必须符合 D064 / CR024；冲突时本体不得自行改号" },
      { label: "验证来源模块", pass: reference?.sourceModule === "智能问数", reason: "固定题运行与证据只能由智能问数提供" },
      { label: "外部交付冲突已关闭", pass: !update?.validationDeliveryIssue, reason: update?.validationDeliveryIssue?.reason || "存在尚未关闭的错合同、错来源、混版或不可变引用冲突" },
      { label: "候选双版本一致", pass: !!reference && reference.candidateKey === expectedKey && reference.semanticVersionId === version?.id && reference.semanticVersion === version?.semanticVersion && reference.dataVersion === update?.dataVersion && reference.asOf === update?.asOf, reason: "返回引用必须锁定同一语义版本、数据版本和数据截至时间" },
      { label: "验证引用快照未变化", pass: !!reference && !!update?.validationReferenceFingerprint && update.validationReferenceFingerprint === validationReferenceFingerprint(reference), reason: "已接收引用必须保持不可变，任何变化都需重新接收并核对" },
      { label: "题集要求已锁定", pass: requirement?.sourceModule === "智能问数" && requirement?.contractCode === "C008" && requirement?.decisionRef === "D064" && requirement?.candidateKey === expectedKey && requirement?.semanticVersionId === version?.id && requirement?.semanticVersion === version?.semanticVersion && requirement?.dataVersion === update?.dataVersion && requirement?.asOf === update?.asOf && validationRequirementFieldsReady(requirement) && requirement.questionSetVersion === reference?.questionSetVersion && resolvedExternalValue(reference?.questionSetEvidenceLocator) && reference.questionSetEvidenceLocator === requirement.questionSetEvidenceLocator && requiredItemIds.length > 0 && requirementItemIdsUnique && update?.validationRequirementFingerprint === snapshotFingerprint(requirement) && reference?.validationRequirementFingerprint === update?.validationRequirementFingerprint, reason: "必须先锁定同一候选的题集版本、签发时间、唯一必测项稳定身份清单和题集证据定位；运行引用必须原样回指该要求" },
      { label: "题集与逐题完整", pass: itemIds.length === items.length && uniqueItemIds.size === items.length && items.length === requiredItemIds.length && requiredItemIds.every(id => uniqueItemIds.has(id)) && items.every(item => item.status === "passed" && resolvedExternalValue(item.evidenceLocator)), reason: "逐题引用必须与已锁定必测项清单精确一致、无重复且全部通过并可定位" },
      { label: "重试关系", pass: !update?.validationRetryRequested || (!!update.validationRetryOf && reference?.retryOf === update.validationRetryOf && !!reference?.runId && reference.runId !== update.validationRetryOf && !historicalRunIds.has(reference.runId)), reason: "关联重试必须由智能问数回指原运行，并使用未出现过的新运行标识" },
      { label: "整体状态", pass: contextualState.key === "passed", reason: "失败、超时、未知、过期、引用变化或版本不一致均不放行" },
      { label: "完成时间与证据定位", pass: resolvedExternalTime(reference?.completedAt) && Date.parse(reference.completedAt) <= Date.now() && Date.parse(reference.completedAt) >= Date.parse(requirement?.issuedAt || "") && resolvedExternalValue(reference?.runId) && resolvedExternalValue(reference?.evidenceLocator), reason: "完成时间必须可解析、不晚于当前时间且不早于题集签发时间；运行标识和真实证据定位均不可缺失" },
      { label: "验证仍在有效期", pass: Number.isFinite(Number(reference?.expiresAtEpoch)) && Date.parse(reference?.completedAt || "") <= Number(reference?.expiresAtEpoch) && Date.now() <= Number(reference?.expiresAtEpoch), reason: "有效期缺失、不一致或已经过期时，必须由智能问数重新验证" },
      { label: "发布时数据映射合同", pass: mapping.complete, reason: mapping.complete ? "发布时映射合同完整" : `Published 版本映射合同不完整：${mapping.detail}` },
      { label: "Published 资源可新绑定", pass: publishedResourceAvailable(version) && newBindingStateOf(version) === "可新绑定" && activeResources.length > 0 && activeResources.every(resource => publishedResourceAvailable(resource) && newBindingStateOf(resource, version) === "可新绑定" && resource.owner && resource.controlledEvidenceLocator), reason: "待生效、失效、待确认、证据缺失、已被替代或不可新绑定的活跃资源不能形成正式组合" }
    ];
    const failed = checks.filter(check => !check.pass);
    return { passed: failed.length === 0, checks, issues: failed.map(check => `${check.label}：${check.reason}`), expectedKey };
  }

  function freezeValidationGate(gate) {
    return { passed: gate.passed, checks: clone(gate.checks || []), issues: clone(gate.issues || []), expectedKey: gate.expectedKey, checkedAt: fullNowText(), frozenAtAdoption: true };
  }

  function validationGateForDisplay(version, update) {
    return update?.phase === "adopted" && update?.adoptedGateSnapshot?.frozenAtAdoption
      ? update.adoptedGateSnapshot
      : candidateValidationGate(version, update);
  }
  function externalValidationInboxKey(version, update) { return candidateKeyFor(version, update); }

  function consumeExternalValidationRequirement(version, update) {
    const key = externalValidationInboxKey(version, update);
    const payload = state.externalValidationRequirements?.[key];
    return payload ? clone(payload) : null;
  }

  function consumeExternalValidationReference(version, update) {
    const key = externalValidationInboxKey(version, update);
    const events = state.externalValidationInbox?.[key];
    const payload = Array.isArray(events) ? events.at(-1)?.payload : events;
    return payload ? clone(payload) : null;
  }

  function declaredCandidateTarget(payload) {
    if (!payload || typeof payload !== "object") return null;
    const candidates = state.publishedVersions.map(version => ({ version, update: updateFor(version) })).filter(item => item.update);
    return candidates.find(({ version, update }) => payload.candidateKey && payload.candidateKey === candidateKeyFor(version, update))
      || candidates.find(({ version }) => payload.semanticVersionId && payload.semanticVersionId === version.id)
      || null;
  }

  function validationDeliveryIssue(payload, version, update, kind) {
    if (payload.contractCode !== "C008") return "采用合同引用冲突：外部验证证据必须明确供 C008 权威消费绑定引用";
    if (payload.decisionRef !== "D064") return "验证依据冲突：固定题验证必须符合 D064 / CR024";
    if (payload.sourceModule !== "智能问数") return "来源模块冲突：固定题运行与证据只能由智能问数提供";
    if (!validationTargetMatches(payload, version, update)) return "候选版本不一致：引用未锁定当前语义版本、数据版本和数据截至时间";
    if (!resolvedExternalValue(payload.questionSetVersion) || !resolvedExternalValue(payload.questionSetEvidenceLocator)) return "题集版本或题集证据定位缺失或仍为占位值";
    if (kind === "requirement" && !resolvedExternalTime(payload.issuedAt)) return "题集要求签发时间缺失、无效或仍为占位值";
    if (kind === "reference" && (!resolvedExternalValue(payload.runId) || !payload.status)) return "运行状态或运行标识缺失或仍为占位值";
    return "验证引用不完整，不能进入本体门禁";
  }

  function rememberValidationDeliveryIssue(target, payload, kind, reason) {
    if (!target) return;
    target.update.validationDeliveryIssue = {
      kind,
      reason,
      receivedAt: fullNowText(),
      sourceModule: payload?.sourceModule || "待确认",
      contractCode: payload?.contractCode || "待确认",
      decisionRef: payload?.decisionRef || "待确认",
      candidateKey: payload?.candidateKey || "待确认",
      semanticVersionId: payload?.semanticVersionId || "待确认",
      semanticVersion: payload?.semanticVersion || "待确认",
      dataVersion: payload?.dataVersion || "待确认",
      asOf: payload?.asOf || "待确认",
      questionSetVersion: payload?.questionSetVersion || "待确认",
      status: payload?.status || "待确认",
      completedAt: payload?.completedAt || "待确认",
      evidenceLocator: payload?.evidenceLocator || "未提供"
    };
    const externalSnapshot = kind === "reference" ? validationReferenceSnapshot(payload) : validationRequirementSnapshot(payload);
    addRecord(target.version.id, kind === "reference" ? "智能问数验证引用被拒绝" : "智能问数验证要求被拒绝", reason, "阻断", "red", target.update.dataVersion, "", {
      sourceModule: payload?.sourceModule || "待确认",
      externalRunId: payload?.runId || null,
      externalEvidenceRef: payload?.evidenceLocator || null,
      externalValidationContractRef: payload?.contractCode || null,
      expectedExternalValidationContractRef: "C008",
      decisionRef: payload?.decisionRef || null,
      externalValidationSnapshot: externalSnapshot,
      formsContract: false
    });
    persist(); render();
  }

  function rememberValidationAdmissionIssue(target, payload, kind, reason) {
    if (!target) {
      rememberExternalDeliveryIssue(kind === "reference" ? "C008-REFERENCE" : "C008-REQUIREMENT", payload, reason);
      return;
    }
    rememberValidationDeliveryIssue(target, payload, kind, reason);
  }

  function rememberExternalDeliveryIssue(kind, payload, reason) {
    state.externalDeliveryIssues = state.externalDeliveryIssues || [];
    const suppliedContext = scenarioContextOf(payload?.scenarioContext || payload, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null });
    state.externalDeliveryIssues.push({
      kind,
      reason,
      receivedAt: fullNowText(),
      sourceModule: payload?.sourceModule || "待确认",
      contractCode: payload?.contractCode || "待确认",
      deliveryId: payload?.deliveryId || null,
      requestId: payload?.requestId || null,
      deliverySeriesId: payload?.deliverySeriesId || null,
      attemptNumber: Number.isInteger(payload?.attemptNumber) ? payload.attemptNumber : null,
      assetId: payload?.assetId || null,
      assetVersion: payload?.assetVersion || null,
      evidenceLocator: payload?.evidenceLocator || null,
      scenarioContext: scenarioContextIssues(suppliedContext).length ? null : clone(suppliedContext)
    });
    persist(); render();
  }

  function declaredPublishedVersion(payload) {
    if (!payload || typeof payload !== "object") return null;
    return state.publishedVersions.find(version => payload.semanticVersionId === version.id && (!payload.semanticVersion || payload.semanticVersion === version.semanticVersion)) || null;
  }

  function normalizeRefreshRequest(payload) {
    if (!payload || typeof payload !== "object") return null;
    return {
      sourceModule: payload.sourceModule || null,
      contractCode: payload.contractCode || null,
      requestId: payload.requestId || null,
      requestedAt: payload.requestedAt || null,
      scenarioContext: scenarioContextOf(payload.scenarioContext || payload, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null }),
      semanticVersionId: payload.semanticVersionId || null,
      semanticVersion: payload.semanticVersion || null,
      dataAssetId: payload.dataAssetId || payload.assetId || null,
      dataVersion: payload.dataVersion || payload.assetVersion || null,
      assetVersionId: payload.assetVersionId || payload.dataVersion || payload.assetVersion || null,
      dataAssetDeliveryId: payload.dataAssetDeliveryId || payload.deliveryId || null,
      asOf: payload.asOf || null,
      t008Confirmation: clone(payload.t008Confirmation || null),
      memberIds: clone(payload.memberIds || []),
      members: clone(payload.members || []),
      memberContracts: clone(payload.memberContracts || []),
      relationIds: clone(payload.relationIds || []),
      relationships: clone(payload.relationships || []),
      relationshipContracts: clone(payload.relationshipContracts || []),
      coverage: clone(payload.coverage || null),
      qualityStatus: payload.qualityStatus || null,
      quality: clone(payload.quality || null),
      trigger: payload.trigger || null,
      retryOf: payload.retryOf || null,
      evidenceLocator: payload.evidenceLocator || null,
      hasCurrentFormalSnapshot: Object.prototype.hasOwnProperty.call(payload, "currentFormalSnapshot"),
      currentFormalSnapshot: clone(payload.currentFormalSnapshot ?? null),
      refreshDiscoveryResponseId: payload.refreshDiscoveryResponseId || payload.c032ResponseId || null,
      refreshDiscoveryResponseVersion: payload.refreshDiscoveryResponseVersion || payload.c032ResponseVersion || null,
      refreshDiscoveryFingerprint: payload.refreshDiscoveryFingerprint || payload.c032Fingerprint || null,
      refreshDiscoveryFormedAt: payload.refreshDiscoveryFormedAt || payload.c032FormedAt || null,
      refreshDiscoveryReadAt: payload.refreshDiscoveryReadAt || payload.c032ReadAt || null,
      refreshTargetId: payload.refreshTargetId || payload.targetBindingId || null,
      refreshTargetBindingVersion: payload.refreshTargetBindingVersion || payload.targetBindingVersion || null,
      refreshTargetEvidenceLocator: payload.refreshTargetEvidenceLocator || payload.targetEvidenceLocator || null,
      refreshTargetFingerprint: payload.refreshTargetFingerprint || payload.targetFingerprint || null,
      sourceMappingVersionId: payload.sourceMappingVersionId || payload.sourceMappingVersion || null,
      mappingVersion: payload.mappingVersion || payload.sourceMappingVersionId || payload.sourceMappingVersion || null,
      targetSemanticVersionId: payload.targetSemanticVersionId || payload.t017VersionId || payload.publishedSemanticVersionId || null,
      changeHints: clone(payload.changeHints || [])
    };
  }

  function refreshRequestIssues(request) {
    const issues = [];
    const version = declaredPublishedVersion(request);
    const asset = Object.values(state.externalDataAssets || {}).find(item => item.assetVersion === request?.dataVersion && (!request?.dataAssetId || item.assetId === request.dataAssetId));
    const discovery = request?.refreshDiscoveryResponseId ? state.refreshTargetDiscoveries?.[request.refreshDiscoveryResponseId] || null : null;
    const latestSubmitRead = Object.values(state.refreshTargetDiscoveries || {}).filter(item => item.queryDataAssetId === request?.dataAssetId && item.readPurpose === "提交前重读").slice(-1)[0] || null;
    const discoveredTarget = discovery?.candidates?.find(candidate => candidate.refreshTargetId === request?.refreshTargetId && String(candidate.bindingVersion) === String(request?.refreshTargetBindingVersion)) || null;
    const currentTarget = request?.refreshTargetId && request?.refreshTargetBindingVersion ? findRefreshTarget(request.refreshTargetId, request.refreshTargetBindingVersion) : null;
    const targetAssessment = currentTarget && version ? refreshTargetAssessment(version, currentTarget, request?.dataAssetId || null) : null;
    const delivery = request?.dataAssetDeliveryId ? state.dataAssetDeliveryReceipts?.[request.dataAssetDeliveryId] || null : null;
    if (state.pendingScenarioReset) issues.push("场景定向重置尚未取得平台公共层返回的新 C033，当前不接收刷新请求");
    if (request?.sourceModule !== "数据工程" || request?.contractCode !== "C028") issues.push("来源模块或合同编号不符合刷新请求合同");
    const contextIssues = scenarioContextIssues(request?.scenarioContext);
    if (contextIssues.length) issues.push(`场景运行上下文不完整：${contextIssues.join("、")}`);
    if (!contextIssues.length && !sameScenarioEnvelope(request, currentScenarioContext())) issues.push("刷新请求与当前场景工作投影的完整场景上下文不一致");
    if (!sameScenarioEnvelope(request, version || {})) issues.push("刷新请求与目标 Published 版本的完整场景上下文不一致");
    if (discovery && !sameScenarioEnvelope(request, discovery)) issues.push("刷新请求与提交前 C032 发现响应的完整场景上下文不一致");
    if (!resolvedExternalValue(request?.requestId) || !resolvedExternalTime(request?.requestedAt) || !resolvedExternalValue(request?.evidenceLocator)) issues.push("请求标识、请求时间或证据定位缺失、无效或仍为占位值");
    if (!version) issues.push("目标精确 Published 语义版本不存在或版本号不一致");
    if (!discovery || discovery.sourceModule !== "本体管理" || discovery.contractCode !== "C032") issues.push("刷新请求缺少本体管理 C032 发现响应引用");
    if (discovery && (discovery.readPurpose !== "提交前重读" || latestSubmitRead?.responseId !== discovery.responseId)) issues.push("C032 不是当前数据资产最新一次提交前重读结果，发现引用已过期");
    if (discovery && (request?.refreshDiscoveryResponseVersion !== discovery.responseVersion || request?.refreshDiscoveryFingerprint !== discovery.responseFingerprint || snapshotFingerprint({ ...discovery, responseFingerprint: undefined }) !== discovery.responseFingerprint)) issues.push("C032 响应版本、指纹缺失或内容已变化");
    if (!resolvedExternalTime(request?.refreshDiscoveryFormedAt) || (discovery && request.refreshDiscoveryFormedAt !== discovery.formedAt)) issues.push("刷新请求缺少 C032 形成时间，或形成时间与发现响应不一致");
    if (!resolvedExternalTime(request?.refreshDiscoveryReadAt) || (discovery && request.refreshDiscoveryReadAt !== discovery.readAt)) issues.push("刷新请求缺少提交前重新读取的 C032 时间，或读取时间与发现响应不一致");
    if (discovery && resolvedExternalTime(request?.requestedAt) && Date.parse(String(request.requestedAt).replace(" ", "T")) < Date.parse(String(discovery.readAt).replace(" ", "T"))) issues.push("刷新请求形成时间早于 C032 提交前重读时间");
    if (discovery && discovery.queryDataAssetId !== request?.dataAssetId) issues.push("C032 发现响应查询的数据资产与本次刷新请求不一致");
    if (!discoveredTarget || !currentTarget) issues.push("刷新请求引用的 T054 目标绑定或绑定版本不可定位");
    if (discoveredTarget && (request?.refreshTargetFingerprint !== discoveredTarget.targetFingerprint || request?.refreshTargetEvidenceLocator !== discoveredTarget.evidenceLocator || snapshotFingerprint(currentTarget) !== discoveredTarget.targetFingerprint)) issues.push("C028 引用的 T054 证据或目标指纹缺失、错版或已变化");
    if (discoveredTarget && (!discoveredTarget.allowRefreshSubmission || discoveredTarget.currentStatus !== "可用")) issues.push("C032 发现响应未提供可提交的 T054 目标绑定");
    if (targetAssessment && !targetAssessment.allowSubmit) issues.push(`提交前重新读取发现目标失败：${targetAssessment.reason}`);
    if (discoveredTarget && (discoveredTarget.semanticVersionId !== request?.semanticVersionId || discoveredTarget.semanticVersion !== request?.semanticVersion || discoveredTarget.sourceMappingVersionId !== request?.sourceMappingVersionId || discoveredTarget.semanticVersionId !== request?.targetSemanticVersionId)) issues.push("C028 引用的精确 Published 版本或来源映射版本与 C032/T054 不一致");
    if (!request?.dataVersion || !request?.asOf || !asset) issues.push("候选数据版本未通过 C003 只读交付或数据截至时间缺失");
    if (request?.assetVersionId !== request?.dataVersion) issues.push("精确 T007 标识与候选数据版本不一致");
    if (!delivery || delivery.status !== "accepted" || delivery.deliveryId !== request?.dataAssetDeliveryId || delivery.assetId !== request?.dataAssetId || delivery.assetVersion !== request?.dataVersion || !sameScenarioEnvelope(delivery, request)) issues.push("刷新请求没有引用同轮次、同资产、同精确版本的已接收 C003 交付");
    if (asset && dataAssetDeliveryIssues(asset).length) issues.push("候选数据资产合同不完整或不可消费");
    if (asset && snapshotFingerprint(request?.t008Confirmation) !== snapshotFingerprint(asset.t008Confirmation)) issues.push("刷新请求携带的 T008 与精确数据资产交付不一致");
    if (asset && (request.memberIds.length !== asset.members.length || request.memberIds.some(id => !asset.members.some(member => member.id === id)))) issues.push("刷新请求的成员范围与精确数据资产版本不一致");
    if (asset && snapshotFingerprint(request.memberContracts) !== snapshotFingerprint(asset.members)) issues.push("刷新请求的成员字段合同与精确数据资产版本不一致");
    if (asset && (request.relationIds.length !== asset.relations.length || request.relationIds.some(id => !asset.relations.some(relation => relation.id === id)))) issues.push("刷新请求的关系范围与精确数据资产版本不一致");
    if (asset && snapshotFingerprint(request.relationshipContracts) !== snapshotFingerprint(asset.relations)) issues.push("刷新请求的关系端点合同与精确数据资产版本不一致");
    if (discoveredTarget && snapshotFingerprint(request.coverage) !== snapshotFingerprint({ members: discoveredTarget.memberCoverage, relationships: discoveredTarget.relationCoverage })) issues.push("刷新请求的成员与关系覆盖结果与 C032 发现包不一致");
    if (request?.qualityStatus !== "通过") issues.push("候选数据质量状态不允许进入本体匹配检查");
    if (asset && (request?.quality?.status !== asset.qualitySummary?.status || request?.quality?.resultId !== asset.qualitySummary?.resultId || request?.quality?.evidenceLocator !== asset.qualitySummary?.evidenceLocator)) issues.push("刷新请求的质量结果与精确数据资产版本不一致");
    if (!resolvedExternalValue(request?.mappingVersion) || request.mappingVersion !== request.sourceMappingVersionId) issues.push("刷新请求的映射版本与来源映射版本不一致");
    if (version && adoptedDataVersionIds(version).has(request.dataVersion)) issues.push("该数据版本已经正式使用过，不能作为新的待更新数据");
    if (!request?.hasCurrentFormalSnapshot) issues.push("刷新请求必须明确携带当前正式版本快照；没有正式组合时也必须显式传入空值");
    if (version && request?.hasCurrentFormalSnapshot && snapshotFingerprint(request.currentFormalSnapshot) !== snapshotFingerprint(currentFormalSnapshot(version))) issues.push("刷新请求携带的当前正式版本快照已变化");
    return issues;
  }

  function receiveExternalRefreshRequest(request) {
    const version = declaredPublishedVersion(request);
    const asset = Object.values(state.externalDataAssets || {}).find(item => item.assetVersion === request.dataVersion && (!request.dataAssetId || item.assetId === request.dataAssetId));
    const previous = version ? updateFor(version) : null;
    if (previous && previous.phase !== "adopted") return null;
    const update = {
      id: makeId("update"), sourceModule: "数据工程", contractCode: "C028", requestId: request.requestId, requestEvidenceLocator: request.evidenceLocator, requestedAt: request.requestedAt,
      dataAssetId: request.dataAssetId, dataVersion: request.dataVersion, asOf: request.asOf, memberIds: clone(request.memberIds), relationIds: clone(request.relationIds), qualityStatus: request.qualityStatus,
      refreshDiscoveryResponseId: request.refreshDiscoveryResponseId, refreshDiscoveryResponseVersion: request.refreshDiscoveryResponseVersion, refreshDiscoveryFingerprint: request.refreshDiscoveryFingerprint, refreshDiscoveryReadAt: request.refreshDiscoveryReadAt, refreshTargetId: request.refreshTargetId, refreshTargetBindingVersion: request.refreshTargetBindingVersion, refreshTargetEvidenceLocator: request.refreshTargetEvidenceLocator, refreshTargetFingerprint: request.refreshTargetFingerprint, sourceMappingVersionId: request.sourceMappingVersionId, targetSemanticVersionId: request.targetSemanticVersionId,
      trigger: request.trigger, retryOf: request.retryOf, scenarioContext: clone(request.scenarioContext), sourceDataContract: clone(asset), candidateRevision: (previous?.candidateRevision || 0) + 1, phase: "received", priorPhase: "received",
      changeHints: clone(request.changeHints || []), breaking: false, breakingDetail: null, compatFixed: false, matchIssues: [], failure: null, validationRetryRequested: false, adoptionAttempts: 0, failFirstAdoption: false
    };
    state.externalRefreshRequests[request.requestId] = clone(request);
    state.updatesByVersion[version.id] = update;
    addRecord(version.id, "收到待更新数据", `${request.dataVersion} 已由数据工程提交，并进入本体匹配检查队列。`, "待处理", "blue", request.dataVersion, "C028", { sourceModule: "数据工程", externalRunId: request.requestId, externalEvidenceRef: request.evidenceLocator, formsContract: false });
    return update;
  }

  function receiptForRefreshRequest(request, statusValue, reason = null, update = null) {
    const receivedAt = fullNowText();
    return {
      sourceModule: "本体管理",
      contractCode: "C028",
      requestId: request?.requestId || null,
      status: statusValue,
      receivedAt,
      reason,
      scenarioContext: clone(request?.scenarioContext || currentScenarioContext()),
      semanticVersionId: request?.semanticVersionId || null,
      semanticVersion: request?.semanticVersion || null,
      dataAssetId: request?.dataAssetId || null,
      dataVersion: request?.dataVersion || null,
      asOf: request?.asOf || null,
      targetUpdateId: update?.id || null,
      targetPhase: update?.phase || null,
      requestEvidenceLocator: request?.evidenceLocator || null,
      evidenceLocator: request?.requestId ? `本体管理 / C028 接收回执 / ${request.requestId}` : null,
      requestFingerprint: request ? snapshotFingerprint(request) : null,
      originalRequest: request ? clone(request) : null
    };
  }

  function refreshRequestStatus(requestId) {
    const stableId = String(requestId || "").trim();
    const receipt = stableId ? state.refreshRequestReceipts?.[stableId] || null : null;
    return {
      sourceModule: "本体管理",
      contractCode: "C028",
      requestId: stableId || null,
      readStatus: !stableId ? "invalid" : receipt ? "found" : "unknown",
      observedAt: fullNowText(),
      receipt: clone(receipt),
      reason: !stableId ? "请提供稳定刷新请求标识" : receipt ? null : "未找到该刷新请求的持久化接收或拒绝回执"
    };
  }

  function normalizeQualityFact(payload) {
    if (!payload || typeof payload !== "object") return null;
    return { sourceModule: payload.sourceModule || null, contractCode: payload.contractCode || null, factId: payload.factId || null, semanticVersionId: payload.semanticVersionId || null, semanticVersion: payload.semanticVersion || null, dataVersion: payload.dataVersion || null, status: payload.status || null, detectedAt: payload.detectedAt || null, impactScope: payload.impactScope || null, reason: payload.reason || null, recoverySuggestion: payload.recoverySuggestion || null, evidenceLocator: payload.evidenceLocator || null };
  }

  function qualityFactIssues(fact) {
    const version = declaredPublishedVersion(fact);
    const issues = [];
    if (fact?.sourceModule !== "数据工程" || fact?.contractCode !== "C017") issues.push("来源模块或合同编号不符合数据可信度合同");
    if (!resolvedExternalValue(fact?.factId) || !resolvedExternalTime(fact?.detectedAt) || !resolvedExternalValue(fact?.evidenceLocator)) issues.push("质量事实标识、形成时间或证据定位缺失、无效或仍为占位值");
    if (!version || !hasFormalCombination(version, fact?.dataVersion)) issues.push("质量事实没有锁定当前或历史正式组合的精确双版本");
    if (!fact?.status || !["blocked", "recovered"].includes(fact.status)) issues.push("质量事实状态必须明确为阻断或已恢复");
    if (fact?.status === "recovered" && version && fact?.dataVersion && !state.combinationIncidents?.[combinationKey(version.id, fact.dataVersion)]) issues.push("质量恢复事实缺少同一精确组合的前序质量阻断事实");
    if (!resolvedExternalValue(fact?.reason) || !resolvedExternalValue(fact?.impactScope) || !resolvedExternalValue(fact?.recoverySuggestion)) issues.push("原因、影响范围或恢复建议缺失或仍为占位值");
    return issues;
  }

  function normalizeConsumerCompatibility(payload) {
    if (!payload || typeof payload !== "object") return null;
    const ontologyBinding = clone(payload.publishedOntologyBinding || null);
    const whitelist = clone(payload.resourceWhitelist || null);
    const effectiveTime = clone(payload.effectiveTime || null);
    return {
      sourceModule: payload.sourceModule || null,
      contractCode: payload.contractCode || null,
      configId: payload.configId || null,
      configVersion: payload.configVersion || null,
      consumer: payload.consumer || "智能问数",
      promptVersion: payload.promptVersion || null,
      contentFingerprint: payload.contentFingerprint || null,
      skillVersions: clone(Array.isArray(payload.skillVersions) ? payload.skillVersions : []),
      toolVersions: clone(Array.isArray(payload.toolVersions) ? payload.toolVersions : []),
      whitelistVersion: payload.whitelistVersion || whitelist?.version || null,
      allowedResourceIds: clone(Array.isArray(payload.allowedResourceIds) ? payload.allowedResourceIds : Array.isArray(whitelist?.resourceIds) ? whitelist.resourceIds : []),
      resourceWhitelist: whitelist,
      publishedOntologyBinding: ontologyBinding,
      semanticVersionId: payload.semanticVersionId || ontologyBinding?.semanticVersionId || null,
      semanticVersion: payload.semanticVersion || ontologyBinding?.semanticVersion || null,
      dataVersion: payload.dataVersion || ontologyBinding?.dataVersion || null,
      asOf: payload.asOf || ontologyBinding?.asOf || null,
      t019EvidenceCode: payload.t019EvidenceCode || ontologyBinding?.t019EvidenceCode || null,
      resourceContractFingerprint: payload.resourceContractFingerprint || ontologyBinding?.resourceContractFingerprint || null,
      scenarioContext: scenarioContextOf(payload.scenarioContext || payload, { scenarioId: null, scenarioVersion: null, scenarioRunId: null, scenarioName: null, formedAt: null, status: null }),
      effectiveFrom: payload.effectiveFrom || effectiveTime?.from || null,
      effectiveTo: payload.effectiveTo || effectiveTime?.to || null,
      effectiveTime,
      status: payload.status || null,
      checkedAt: payload.checkedAt || null,
      reason: payload.reason || null,
      configFingerprint: payload.configFingerprint || null,
      runtimeContextFingerprint: payload.runtimeContextFingerprint || null,
      evidenceLocator: payload.evidenceLocator || null
    };
  }

  function consumerCompatibilityIssues(item) {
    const version = declaredPublishedVersion(item); const binding = version && historicalBindingFor(version); const issues = [];
    if (item?.sourceModule !== "智能问数" || item?.contractCode !== "C009" || item?.consumer !== "智能问数") issues.push("来源模块、消费方或合同编号不符合智能问数兼容状态合同");
    if (!resolvedExternalValue(item?.configId) || !resolvedExternalValue(item?.configVersion) || !resolvedExternalValue(item?.promptVersion) || !resolvedExternalValue(item?.configFingerprint) || !resolvedExternalTime(item?.checkedAt) || !resolvedExternalValue(item?.evidenceLocator)) issues.push("配置身份、配置版本、Prompt 版本、配置指纹、检查时间或证据定位缺失、无效或仍为占位值");
    const skillKeys = (item?.skillVersions || []).map(skill => `${skill?.id || ""}@${skill?.version || ""}`);
    if (!skillKeys.length || skillKeys.some(key => !resolvedExternalValue(key.split("@")[0]) || !resolvedExternalValue(key.split("@")[1])) || new Set(skillKeys).size !== skillKeys.length) issues.push("Skill 版本集合缺失、含占位值或存在重复身份");
    const whitelistIds = Array.isArray(item?.resourceWhitelist?.resourceIds) ? item.resourceWhitelist.resourceIds : [];
    if (!resolvedExternalValue(item?.whitelistVersion) || item.whitelistVersion !== item?.resourceWhitelist?.version || !whitelistIds.length || new Set(whitelistIds).size !== whitelistIds.length || snapshotFingerprint([...item.allowedResourceIds].sort()) !== snapshotFingerprint([...whitelistIds].sort())) issues.push("资源白名单版本、稳定身份集合或内外层快照不一致");
    const publishedIds = new Set(version ? publishedResources(version).map(resource => resource.id) : []);
    if (version && whitelistIds.some(id => !publishedIds.has(id))) issues.push("资源白名单包含不属于目标 Published 版本的稳定身份");
    const ontologyBinding = item?.publishedOntologyBinding;
    if (!ontologyBinding || ontologyBinding.ontologyStableId !== version?.ontologyStableId || ontologyBinding.semanticVersionId !== item?.semanticVersionId || ontologyBinding.semanticVersion !== item?.semanticVersion || ontologyBinding.dataVersion !== item?.dataVersion || ontologyBinding.asOf !== item?.asOf || ontologyBinding.t019EvidenceCode !== item?.t019EvidenceCode || ontologyBinding.resourceContractFingerprint !== item?.resourceContractFingerprint) issues.push("Published 本体绑定内外层身份、精确双版本、时点或证据不一致");
    if (!version || binding?.dataVersion !== item?.dataVersion || binding?.asOf !== item?.asOf) issues.push("兼容状态未锁定精确正式双版本及数据截至时间");
    const adoptionRecord = version && binding ? successfulT019RecordForBinding(version, binding) : null;
    if (!resolvedExternalValue(item?.t019EvidenceCode) || adoptionRecord?.evidenceCode !== item.t019EvidenceCode) issues.push("兼容状态没有回指同一权威组合的 T019 采用证据");
    const contextIssues = scenarioContextIssues(item?.scenarioContext);
    if (contextIssues.length || !sameScenarioEnvelope(item, currentScenarioContext()) || !sameScenarioEnvelope(item, version || {})) issues.push("兼容状态缺少与当前权威组合一致的完整场景上下文");
    if (!resolvedExternalTime(item?.effectiveFrom) || item?.effectiveTime?.from !== item?.effectiveFrom || (item?.effectiveTo && (!resolvedExternalTime(item.effectiveTo) || item?.effectiveTime?.to !== item.effectiveTo))) issues.push("配置生效时间包络缺失、无效或内外层不一致");
    const checkedAt = Date.parse(String(item?.checkedAt || "").replace(" ", "T"));
    const effectiveFrom = Date.parse(String(item?.effectiveFrom || "").replace(" ", "T"));
    const effectiveTo = item?.effectiveTo ? Date.parse(String(item.effectiveTo).replace(" ", "T")) : null;
    if (Number.isFinite(checkedAt) && Number.isFinite(effectiveFrom) && checkedAt < effectiveFrom) issues.push("兼容判定时间早于配置生效时间");
    if (Number.isFinite(checkedAt) && Number.isFinite(effectiveTo) && checkedAt >= effectiveTo) issues.push("兼容判定使用了已失效配置");
    if (!["compatible", "incompatible", "revalidate"].includes(item?.status)) issues.push("兼容状态必须为兼容、需迁移或需重验");
    if (item?.status !== "compatible" && !item?.reason) issues.push("非兼容状态必须提供业务可读原因");
    return issues;
  }

  function publishedResourceContractItem(version, resource) {
    const replacement = resourceReplacementContext(version, resource);
    return {
      id: resource.id,
      type: resource.type,
      name: resource.name,
      definition: resource.definition || resource.requirement || resource.evidence || null,
      publishedVersionId: version.id,
      publishedSemanticVersion: version.semanticVersion,
      publicationState: publicationStateOf(resource),
      businessValidityState: businessValidityStateOf(resource),
      bindability: newBindingStateOf(resource, version),
      effectiveFrom: resource.effectiveFrom || null,
      effectiveTo: resource.effectiveTo || null,
      changeType: resource.changeType || null,
      changeReason: resource.changeReason || null,
      replaces: clone(replacement.replaces),
      replacedBy: clone(replacement.replacedBy),
      lastChangedAt: resource.lastChangedAt || null,
      applicableScenario: resource.applicableScenario || version.scenario || null,
      owner: resource.owner || null,
      controlledEvidenceLocator: resource.controlledEvidenceLocator || null,
      evidenceLocator: resource.controlledEvidenceLocator || null,
      unit: resource.unit || null,
      time: resource.time || null,
      scope: resource.scope || resource.appliesTo || resource.target || null,
      dependencyIds: clone(resource.dependencyIds || resource.metricIds || resource.ruleIds || []),
      sourceObjectId: resource.sourceObjectId || resource.source || null,
      targetObjectId: resource.targetObjectId || resource.target || null,
      sourceEndpointId: resource.sourceEndpoint?.id || null,
      targetEndpointId: resource.targetEndpoint?.id || null,
      allowedDirection: resource.allowedDirection || null,
      discoveryScope: resource.discoveryScope || null,
      cardinality: resource.cardinality || null
    };
  }

  function publishedDiscoveryPackage(version) {
    if (!version || publicationStateOf(version) !== "Published") return null;
    return {
      contractCodes: ["C004", "C005", "C006", "C007"],
      ontologyStableId: version.ontologyStableId, versionId: version.id, semanticVersion: version.semanticVersion, publicationState: publicationStateOf(version), publishedAt: version.publishedAt,
      businessValidityState: businessValidityStateOf(version), effectiveFrom: version.effectiveFrom || null, effectiveTo: version.effectiveTo || null,
      scenario: version.scenario || null, owner: version.owner || null, changeReason: version.changeSummary || null, replacementDeclaration: version.replacementDeclaration || null,
      lastChangedAt: version.lastChangedAt || null, controlledEvidenceLocator: version.controlledEvidenceLocator || null, evidenceLocator: version.controlledEvidenceLocator || null,
      resources: publishedResources(version).map(resource => publishedResourceContractItem(version, resource))
    };
  }

  function authoritativeFactPackageFor(version, binding, update, adoptionRecord) {
    const snapshot = S001_AUTHORITATIVE_FACT_SNAPSHOT;
    const buildPackage = window.buildS001AuthoritativeFactPackage;
    const sourceContract = update?.sourceDataContract || null;
    const t018 = update?.eligibility || null;
    const t018Record = versionRecord(version, "T018", binding?.dataVersion);
    const versionContract = versionDataContract(version);
    if (!snapshot || typeof buildPackage !== "function" || !version || !binding || !sourceContract || !t018 || !t018Record || !adoptionRecord) return null;

    const requiredMetricIds = new Set(METRICS.map(item => item.id));
    const requiredRuleIds = new Set(RULES.map(item => item.id));
    const requiredActionIds = new Set(ACTIONS.map(item => item.id));
    const publishedMetricIds = new Set((version.metrics || []).map(item => item.id));
    const publishedRuleIds = new Set((version.rules || []).map(item => item.id));
    const publishedActionIds = new Set((version.actions || []).map(item => item.id));
    const sourceMemberIds = new Set((sourceContract.members || []).map(item => item.id));
    const sourceRelationIds = new Set((sourceContract.relations || []).map(item => item.id));
    const versionMemberIds = new Set((versionContract?.members || []).map(item => item.id));
    const versionRelationIds = new Set((versionContract?.relations || []).map(item => item.id));
    const sourceFingerprint = sourceContract.sourceFingerprint || null;
    const t008 = sourceContract.t008Confirmation || null;
    const resourcesReady = requiredMetricIds.size === publishedMetricIds.size
      && requiredRuleIds.size === publishedRuleIds.size
      && requiredActionIds.size === publishedActionIds.size
      && [...requiredMetricIds].every(id => publishedMetricIds.has(id))
      && [...requiredRuleIds].every(id => publishedRuleIds.has(id))
      && [...requiredActionIds].every(id => publishedActionIds.has(id))
      && [...version.rules, ...version.actions].every(resource => !["recommended", "unknown"].includes(resource.businessBasis));
    const coverageReady = S001_REQUIRED_MEMBER_IDS.every(id => sourceMemberIds.has(id) && versionMemberIds.has(id))
      && sourceMemberIds.size === S001_REQUIRED_MEMBER_IDS.length
      && versionMemberIds.size === S001_REQUIRED_MEMBER_IDS.length
      && S001_REQUIRED_RELATION_IDS.every(id => sourceRelationIds.has(id) && versionRelationIds.has(id))
      && sourceRelationIds.size === S001_REQUIRED_RELATION_IDS.length
      && versionRelationIds.size === S001_REQUIRED_RELATION_IDS.length;
    const sourceReady = sourceContract.sourceModule === "数据工程"
      && sourceContract.contractCode === "C003"
      && sourceContract.assetId === versionContract?.assetId
      && sourceContract.assetVersion === binding.dataVersion
      && sourceContract.assetVersion === update.dataVersion
      && sourceContract.asOf === snapshot.asOf
      && sourceContract.asOf === binding.asOf
      && sourceFingerprint?.algorithm === "SHA-256"
      && sourceFingerprint.value === snapshot.source.sha256
      && Number(sourceFingerprint.sizeBytes) === snapshot.source.sizeBytes
      && !!sourceContract.qualitySummary?.status
      && sourceContract.publicationState === "已发布"
      && sourceContract.mappingEligibility?.status === "可供本体映射";
    const t008Ready = t008?.snapshotId === sourceContract.sourceSnapshotId
      && t008?.asOf === snapshot.asOf
      && t008?.sourceReadEventId === sourceContract.sourceReadEventId
      && Number(t008?.sizeBytes) === snapshot.source.sizeBytes
      && resolvedExternalValue(t008?.confirmedBy)
      && resolvedExternalTime(t008?.confirmedAt)
      && resolvedExternalValue(t008?.basis)
      && resolvedExternalValue(t008?.evidenceId)
      && resolvedExternalValue(t008?.evidenceLocator)
      && sameScenarioEnvelope(t008, sourceContract);
    const t018Ready = t018.status === "eligible"
      && t018.semanticVersionId === version.id
      && t018.semanticVersion === version.semanticVersion
      && t018.dataVersion === binding.dataVersion
      && resolvedExternalValue(t018.evidenceLocator)
      && t018Record.evidenceCode === t018.evidenceLocator
      && sameScenarioEnvelope(t018, version)
      && sameScenarioEnvelope(update, version);
    const t019Ready = adoptionRecord.id === binding.adoptionRecordId
      && adoptionRecord.evidenceCode === binding.adoptionEvidenceLocator
      && adoptionRecord.semanticVersion === version.semanticVersion
      && adoptionRecord.dataVersion === binding.dataVersion
      && sameScenarioEnvelope(adoptionRecord, version)
      && sameScenarioEnvelope(binding, version);
    const identityReady = snapshot.sceneId === scenarioContextOf(version).scenarioId
      && version.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION"
      && isCurrentFormalVersion(version)
      && binding.semanticVersion === version.semanticVersion
      && binding.dataVersion === update.dataVersion
      && binding.asOf === snapshot.asOf;
    if (!resourcesReady || !coverageReady || !sourceReady || !t008Ready || !t018Ready || !t019Ready || !identityReady) return null;

    const factPackage = buildPackage({
      scenarioContext: scenarioContextOf(version),
      version: clone(version),
      binding: clone(binding),
      adoptionRecord: clone(adoptionRecord),
      t018: clone(t018),
      sourceContract: clone(sourceContract)
    });
    const factPackageReady = factPackage?.factPackageStatus === "available"
      && factPackage.sceneId === snapshot.sceneId
      && factPackage.authorityBindingId === adoptionRecord.id
      && factPackage.semanticVersionId === version.id
      && factPackage.semanticVersion === version.semanticVersion
      && factPackage.dataAssetVersionId === binding.dataVersion
      && factPackage.dataVersion === binding.dataVersion
      && factPackage.consumableVersionId === t018.evidenceLocator
      && factPackage.asOf === snapshot.asOf
      && Array.isArray(factPackage.contentFacts) && factPackage.contentFacts.length > 0
      && Array.isArray(factPackage.anchors) && factPackage.anchors.length > 0
      && Array.isArray(factPackage.contentItems) && factPackage.contentItems.length > 0;
    return factPackageReady ? factPackage : null;
  }

  function authoritativeBindingPackage(version) {
    if (!version) return null;
    const binding = historicalBindingFor(version); const update = updateFor(version); const currentFormal = isCurrentFormalVersion(version);
    const qualityIncident = qualityIncidentFor(version); const lifecycleAvailable = publishedResourceAvailable(version);
    const adoptionRecord = binding ? successfulT019RecordForBinding(version, binding) : null;
    const adoptionEvidenceReady = !!adoptionRecord && !!binding?.adoptionEvidenceLocator && adoptionRecord.evidenceCode === binding.adoptionEvidenceLocator;
    const consumable = !!binding && currentFormal && adoptionEvidenceReady && !qualityIncident && lifecycleAvailable;
    const consumptionState = !binding
      ? "尚未形成正式组合"
      : !currentFormal
        ? "历史只读"
        : !adoptionEvidenceReady
          ? "采用证据缺失"
        : qualityIncident
          ? qualityIncident.recoveryReportedAt ? "质量恢复待受控处理" : "质量阻断"
          : !lifecycleAvailable
            ? `语义资源${businessValidityStateOf(version)}`
            : "可消费";
    const blockedReason = qualityIncident
      ? qualityIncident.recoveryReportedAt
        ? `${qualityIncident.reason}；数据工程已报告恢复事实，但尚未完成受控更新或回退`
        : qualityIncident.reason
      : currentFormal && !lifecycleAvailable
        ? `语义版本业务有效状态为${businessValidityStateOf(version)}`
        : currentFormal && !adoptionEvidenceReady
          ? "当前 binding 缺少同一场景、精确双版本和候选键的成功 T019 证据"
        : null;
    return {
      contractCode: "C008", versionId: version.id, semanticVersion: version.semanticVersion, currentFormal, consumable, consumptionState, blockedReason,
      binding: binding ? clone(binding) : null, previousTrusted: clone(previousTrustedCombination(version)),
      qualityFact: qualityIncident ? { contractCode: "C017", factId: qualityIncident.factId, status: qualityIncident.status, detectedAt: qualityIncident.detectedAt, evidenceLocator: qualityIncident.evidenceLocator, recoveryReportedAt: qualityIncident.recoveryReportedAt || null, recoveryFactId: qualityIncident.recoveryFactId || null, recoveryEvidenceLocator: qualityIncident.recoveryEvidenceLocator || null } : null,
      candidate: update ? { requestId: update.requestId, dataVersion: update.dataVersion, asOf: update.asOf, phase: update.phase } : null,
      c029: update?.matchResult ? clone(update.matchResult) : null, t018: update?.eligibility ? clone(update.eligibility) : null,
      adoptionRecord: adoptionRecord ? clone(adoptionRecord) : null
    };
  }

  function currentScenarioContext() {
    return clone(state?.scenarioContexts?.[state.activeScenarioId] || DEFAULT_SCENARIO);
  }

  function authoritativeProjectionReadFailure(compareToCurrentState = false) {
    try {
      const raw = localStorage.getItem(C008_PROJECTION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return "统一权威投影不是有效对象";
      if (parsed.projectionId !== C008_PROJECTION_KEY) return "统一权威投影标识不一致";
      if (parsed.schemaVersion !== C008_PROJECTION_SCHEMA_VERSION) return "统一权威投影结构版本不兼容";
      if (!resolvedExternalValue(parsed.projectionVersion) || !resolvedExternalTime(parsed.formedAt)) return "统一权威投影版本或形成时间无效";
      const contextIssues = scenarioContextIssues(parsed.scenarioContext || parsed);
      if (contextIssues.length) return `统一权威投影场景上下文不完整：${contextIssues.join("、")}`;
      const nestedContext = scenarioContextOf(parsed.scenarioContext);
      const flatContext = scenarioContextOf(parsed);
      if (!sameScenarioEnvelope(nestedContext, flatContext)) return "统一权威投影内外层场景上下文不一致";
      const activeContext = currentScenarioContext();
      if (!sameScenarioEnvelope(nestedContext, activeContext)) return "统一权威投影与当前场景运行上下文不一致";
      if (!["empty", "available", "unavailable", "failed"].includes(parsed.readStatus)) return "统一权威投影读取状态无法识别";
      const reasonReady = !!String(parsed.reason || "").trim() && !/(待填写|占位|placeholder|todo|tbd)/i.test(String(parsed.reason));
      const recoveryReady = !!String(parsed.recoverySuggestion || "").trim() && !/(待填写|占位|placeholder|todo|tbd)/i.test(String(parsed.recoverySuggestion));
      if (parsed.readStatus === "empty") {
        if (!reasonReady || !recoveryReady) return "空状态投影缺少原因或恢复建议";
        if ([parsed.publishedSemanticVersionId, parsed.publishedSemanticVersion, parsed.consumableDataVersion, parsed.dataAsOf, parsed.switchedAt, parsed.evidenceLocator].some(value => value !== null)) return "空状态投影不得携带正式双版本或采用证据";
      }
      if (parsed.readStatus === "available") {
        if (![parsed.publishedSemanticVersionId, parsed.publishedSemanticVersion, parsed.consumableDataVersion, parsed.dataAsOf, parsed.switchedAt, parsed.evidenceLocator].every(resolvedExternalValue)) return "可用状态投影缺少精确双版本、时点或 T019 证据";
        if (!parsed.current || parsed.current.semanticVersionId !== parsed.publishedSemanticVersionId || parsed.current.semanticVersion !== parsed.publishedSemanticVersion || parsed.current.dataVersion !== parsed.consumableDataVersion || parsed.current.asOf !== parsed.dataAsOf || parsed.current.switchedAt !== parsed.switchedAt) return "可用状态投影的当前组合与外层精确双版本不一致";
        if (!resolvedExternalValue(parsed.current?.t019?.recordId) || parsed.current?.t019?.evidenceId !== parsed.evidenceLocator) return "可用状态投影缺少与当前组合一致的 T019 记录和证据";
        const factPackage = parsed.current?.authoritativeFactPackage || null;
        if (factPackage && (factPackage.factPackageStatus !== "available"
          || factPackage.sceneId !== nestedContext.scenarioId
          || factPackage.authorityBindingId !== parsed.current.t019.recordId
          || factPackage.semanticVersionId !== parsed.current.semanticVersionId
          || factPackage.semanticVersion !== parsed.current.semanticVersion
          || factPackage.dataAssetVersionId !== parsed.current.dataVersion
          || factPackage.dataVersion !== parsed.current.dataVersion
          || factPackage.asOf !== parsed.current.asOf
          || !resolvedExternalValue(factPackage.consumableVersionId)
          || !factPackage.contentFacts?.length
          || !factPackage.anchors?.length
          || !factPackage.contentItems?.length)) return "可用状态投影中的权威事实包与当前 T019、精确双版本或事实清单不一致";
        const validation = parsed.validationReference;
        if (validation?.sourceModule !== "智能问数" || validation?.contractCode !== "C008" || validation?.decisionRef !== "D064" || validation?.semanticVersionId !== parsed.publishedSemanticVersionId || validation?.semanticVersion !== parsed.publishedSemanticVersion || validation?.dataVersion !== parsed.consumableDataVersion || !sameScenarioEnvelope(validation, nestedContext) || !resolvedExternalValue(validation?.runId) || !resolvedExternalValue(validation?.evidenceLocator)) return "可用状态投影缺少同场景、同双版本的候选固定题验证引用";
      }
      if (["unavailable", "failed"].includes(parsed.readStatus) && (!reasonReady || !recoveryReady)) return "不可消费或失败状态投影缺少原因或恢复建议";
      if (compareToCurrentState) {
        const candidates = (state.publishedVersions || []).filter(version => sameScenarioEnvelope(version, activeContext));
        const current = candidates.find(version => isCurrentFormalVersion(version)) || null;
        const binding = current ? historicalBindingFor(current) : null;
        const packageValue = current ? authoritativeBindingPackage(current) : null;
        const expectedStatus = !currentScenarioContextReady() || state.pendingScenarioReset ? "failed" : !current || !binding ? "empty" : packageValue?.consumable ? "available" : "unavailable";
        if (parsed.readStatus !== expectedStatus) return "统一权威投影读取状态与本体当前权威记录不一致";
        if (["available", "unavailable"].includes(expectedStatus) && (parsed.publishedSemanticVersionId !== current.id || parsed.publishedSemanticVersion !== current.semanticVersion || parsed.consumableDataVersion !== binding.dataVersion || parsed.dataAsOf !== binding.asOf || parsed.switchedAt !== binding.switchedAt)) return "统一权威投影精确双版本与本体当前权威记录不一致";
        if (expectedStatus === "available" && parsed.evidenceLocator !== packageValue?.adoptionRecord?.evidenceCode) return "统一权威投影 T019 证据与当前正式组合不一致";
      }
      return null;
    } catch (error) {
      return `统一权威投影损坏：${error?.message || "无法解析"}`;
    }
  }

  function authoritativeC008Projection(validateStored = true) {
    const scenarioContext = currentScenarioContext();
    const migration = state.storageMigration || { status: "clean", reason: null };
    const projectionReadFailure = validateStored ? authoritativeProjectionReadFailure(true) : null;
    if (projectionReadFailure && !state.c008ProjectionFault) state.c008ProjectionFault = { detectedAt: fullNowText(), reason: projectionReadFailure };
    const resetPending = state.pendingScenarioReset || null;
    const scenarioReady = currentScenarioContextReady();
    const candidates = (state.publishedVersions || []).filter(version => sameScenarioEnvelope(version, scenarioContext));
    const candidatePair = candidates.map(version => ({ version, update: updateFor(version) })).find(({ version, update }) => candidateValidationAdmission(version, update).passed) || null;
    const candidateAdmission = candidatePair ? candidateValidationAdmission(candidatePair.version, candidatePair.update) : null;
    const candidateDiscovery = candidatePair ? publishedDiscoveryPackage(candidatePair.version) : null;
    const candidateResources = candidateDiscovery?.resources || [];
    const candidateSummary = candidatePair ? {
      status: "具备消费验证条件",
      ready: true,
      readOnly: true,
      phase: candidatePair.update.phase,
      phaseLabel: "具备消费验证条件",
      reason: null,
      recovery: "完成隔离固定题验证并由本体管理独立核对；在 T019 形成前不得进入正式回答。",
      candidateKey: candidateAdmission.expectedKey,
      semanticVersionId: candidatePair.version.id,
      versionId: candidatePair.version.id,
      semanticVersion: candidatePair.version.semanticVersion,
      dataVersion: candidatePair.update.dataVersion,
      asOf: candidatePair.update.asOf,
      updateId: candidatePair.update.requestId,
      validationAdmission: "eligible",
      eligibilityEvidence: clone(candidatePair.update.eligibility),
      eligibilityEvidenceSummary: candidatePair.update.eligibility?.evidenceLocator || null,
      evidenceId: candidatePair.update.eligibility?.evidenceLocator || null,
      resources: clone(candidateResources),
      resourceContractFingerprint: snapshotFingerprint(candidateResources),
      inputFingerprint: snapshotFingerprint({
        candidateKey: candidateAdmission.expectedKey,
        semanticVersionId: candidatePair.version.id,
        semanticVersion: candidatePair.version.semanticVersion,
        dataVersion: candidatePair.update.dataVersion,
        asOf: candidatePair.update.asOf,
        resourceIds: candidateResources.map(resource => resource.id)
      })
    } : null;
    const current = resetPending || !scenarioReady ? null : candidates.find(version => isCurrentFormalVersion(version)) || null;
    const binding = current ? historicalBindingFor(current) : null;
    const packageValue = current ? authoritativeBindingPackage(current) : null;
    const authoritativeFactPackage = current && binding && packageValue?.consumable && packageValue.adoptionRecord
      ? authoritativeFactPackageFor(current, binding, updateFor(current), packageValue.adoptionRecord)
      : null;
    const projectionFault = state.c008ProjectionFault || null;
    const readStatus = projectionReadFailure || projectionFault || resetPending || !scenarioReady || migration.status === "failed" || migration.status === "blocked"
      ? "failed"
      : !current || !binding
        ? "empty"
        : packageValue?.consumable
          ? "available"
          : "unavailable";
    const exposeBinding = ["available", "unavailable"].includes(readStatus) && !!current && !!binding;
    const previous = exposeBinding ? previousTrustedCombination(current) : null;
    const reason = readStatus === "failed"
      ? projectionReadFailure || projectionFault?.reason || (resetPending ? "场景定向重置请求已提交，正在等待平台公共层返回新的 C033 场景轮次" : !scenarioReady ? "尚未接收平台公共层提供的当前完整 C033 场景运行上下文" : migration.reason)
      : readStatus === "empty"
        ? "当前场景轮次没有权威消费绑定"
        : readStatus === "unavailable"
          ? packageValue?.blockedReason || packageValue?.consumptionState || "当前正式组合不可消费"
          : null;
    return {
      projectionId: C008_PROJECTION_KEY,
      projectionVersion: String(Math.max(1, Number(state.c008ProjectionRevision || 1))),
      schemaVersion: C008_PROJECTION_SCHEMA_VERSION,
      formedAt: state.c008ProjectionFormedAt || state.storageMigration?.checkedAt || DEFAULT_SCENARIO.formedAt,
      sourceModule: "本体管理",
      contractCode: "C008",
      readStatus,
      scenarioContext,
      scenarioId: scenarioContext.scenarioId,
      scenarioVersion: scenarioContext.scenarioVersion,
      scenarioRunId: scenarioContext.scenarioRunId,
      scenarioName: scenarioContext.scenarioName,
      scenarioFormedAt: scenarioContext.formedAt,
      scenarioStatus: scenarioContext.status,
      publishedSemanticVersionId: exposeBinding ? current.id : null,
      publishedSemanticVersion: exposeBinding ? current.semanticVersion : null,
      consumableDataVersion: exposeBinding ? binding.dataVersion : null,
      dataAsOf: exposeBinding ? binding.asOf : null,
      switchedAt: exposeBinding ? binding.switchedAt : null,
      previousTrustedCombination: previous ? clone(previous) : null,
      candidate: candidateSummary,
      validationReference: exposeBinding && binding?.candidateValidationReference ? clone(binding.candidateValidationReference) : null,
      consumptionState: readStatus === "failed" ? "权威投影读取失败" : packageValue?.consumptionState || "尚未形成正式组合",
      reason,
      recoverySuggestion: readStatus === "failed"
        ? resetPending
          ? "等待平台公共层返回新场景轮次后重新读取；不得沿用旧轮次正式组合。"
          : !scenarioReady
            ? "由平台公共层提供当前完整 C033；本体管理接收后重新形成同一场景轮次的权威投影。"
            : "在本体管理中隔离损坏状态并对当前场景执行定向重置，再重新读取权威投影。"
        : readStatus === "empty"
          ? "完成 Published 语义版本、数据匹配、业务消费验证和受控采用后重新读取。"
          : readStatus === "unavailable"
            ? "按阻断原因完成受控更新或回退；当前不得推断为可消费。"
            : null,
      ontologyStableId: exposeBinding ? current.ontologyStableId : null,
      current: exposeBinding ? {
        ontologyStableId: current.ontologyStableId,
        semanticVersionId: current.id,
        semanticVersion: current.semanticVersion,
        dataVersion: binding.dataVersion,
        asOf: binding.asOf,
        switchedAt: binding.switchedAt,
        t019: packageValue?.adoptionRecord ? { recordId: packageValue.adoptionRecord.id, evidenceId: packageValue.adoptionRecord.evidenceCode } : null,
        authoritativeFactPackage: readStatus === "available" && authoritativeFactPackage ? clone(authoritativeFactPackage) : null
      } : null,
      evidenceLocator: exposeBinding ? packageValue?.adoptionRecord?.evidenceCode || null : null
    };
  }

  function writeAuthoritativeC008Projection() {
    if (state.c008ProjectionFault) return false;
    const failure = authoritativeProjectionReadFailure(false);
    if (failure) {
      state.c008ProjectionFault = { detectedAt: fullNowText(), reason: failure };
      return false;
    }
    localStorage.setItem(C008_PROJECTION_KEY, JSON.stringify(authoritativeC008Projection(false)));
    return true;
  }

  function repairAuthoritativeC008Projection() {
    localStorage.removeItem(C008_PROJECTION_KEY);
    state.c008ProjectionFault = null;
    state.c008ProjectionRevision = Math.max(1, Number(state.c008ProjectionRevision || 1)) + 1;
    state.c008ProjectionFormedAt = fullNowText();
    writeAuthoritativeC008Projection();
    return authoritativeC008Projection(false);
  }

  function resetCurrentScenarioProjection() {
    if (!currentScenarioContextReady()) throw new Error("当前尚未接收平台公共层提供的完整场景运行上下文，不能提交定向重置");
    const previous = currentScenarioContext();
    const resetAt = fullNowText();
    const request = { requestId: makeId("scenario-reset"), sourceModule: "本体管理", contractCode: "C033", requestedAt: resetAt, scenarioId: previous.scenarioId, scenarioVersion: previous.scenarioVersion, previousScenarioRunId: previous.scenarioRunId, status: "等待平台公共层形成新轮次" };
    const preservedFormalSnapshot = currentFormalSnapshotAnyRun(state.publishedVersions.find(version => sameScenarioContext(version, previous)) || selectedVersion());
    const archivedDrafts = clone(state.drafts.filter(draft => sameScenarioContext(draft, previous))).map(draft => {
      if (draft.validation?.status === "processing") draft.validation = { ...draft.validation, status: "interrupted", interruptedAt: resetAt, reason: "场景定向重置终止了当前校验" };
      if (draft.publishRun?.status === "processing") draft.publishRun = { ...draft.publishRun, status: "failed", failedAt: resetAt, reason: "场景定向重置终止了当前发布" };
      return draft;
    });
    const archivedUpdates = clone(Object.fromEntries(Object.entries(state.updatesByVersion || {}).filter(([, update]) => sameScenarioContext(update, previous))));
    Object.values(archivedUpdates).forEach(update => {
      if (["matching", "verifying", "verification_pending", "switching"].includes(update.phase)) {
        update.priorPhase = update.phase;
        update.phase = "reset_interrupted";
        update.failure = "场景定向重置终止了当前候选处理；旧轮次证据仅供追溯";
        update.interruptedAt = resetAt;
        if (update.matchResult?.status === "processing") update.matchResult = { ...update.matchResult, status: "unknown", resultStatus: "未知", checkedAt: resetAt, reason: update.failure };
        if (update.adoptionRun?.status === "processing") update.adoptionRun = { ...update.adoptionRun, status: "failed", failedAt: resetAt, reason: update.failure };
      }
    });
    state.scenarioHistory = state.scenarioHistory || [];
    state.scenarioHistory.push({
      type: "scenario-reset",
      resetAt,
      previousScenarioContext: clone(previous),
      nextScenarioContext: null,
      resetRequest: clone(request),
      preservedPublishedVersionIds: state.publishedVersions.filter(version => sameScenarioContext(version, previous)).map(version => version.id),
      preservedFormalSnapshot: clone(preservedFormalSnapshot),
      preservedRecordCount: Object.values(state.recordsByVersion || {}).flat().filter(record => sameScenarioContext(record, previous)).length,
      archivedWorkProjection: {
        drafts: archivedDrafts,
        updates: archivedUpdates,
        dataAssets: clone(Object.values(state.externalDataAssets || {}).filter(contract => sameScenarioContext(contract, previous))),
        refreshRequests: clone(Object.values(state.externalRefreshRequests || {}).filter(request => sameScenarioContext(request, previous))),
        validationRequirements: clone(Object.values(state.externalValidationRequirements || {}).filter(requirement => sameScenarioContext(requirement, previous))),
        validationReferences: clone(Object.values(state.externalValidationInbox || {}).filter(events => {
          const latest = Array.isArray(events) ? events.at(-1)?.payload : events;
          return sameScenarioContext(latest, previous);
        }))
      }
    });
    state.drafts = state.drafts.filter(draft => !sameScenarioContext(draft, previous));
    state.activeDraftId = null;
    Object.entries(state.updatesByVersion || {}).forEach(([versionId, update]) => { if (sameScenarioContext(update, previous)) delete state.updatesByVersion[versionId]; });
    state.externalDataAssets = Object.fromEntries(Object.entries(state.externalDataAssets || {}).filter(([, contract]) => !sameScenarioContext(contract, previous)));
    state.externalRefreshRequests = Object.fromEntries(Object.entries(state.externalRefreshRequests || {}).filter(([, request]) => !sameScenarioContext(request, previous)));
    state.refreshTargetDiscoveries = Object.fromEntries(Object.entries(state.refreshTargetDiscoveries || {}).filter(([, discovery]) => !sameScenarioContext(discovery, previous)));
    state.externalValidationRequirements = Object.fromEntries(Object.entries(state.externalValidationRequirements || {}).filter(([, requirement]) => !sameScenarioContext(requirement, previous)));
    state.externalValidationInbox = Object.fromEntries(Object.entries(state.externalValidationInbox || {}).filter(([, events]) => {
      const latest = Array.isArray(events) ? events.at(-1)?.payload : events;
      return !sameScenarioContext(latest, previous);
    }));
    state.validationRetryRequests = Object.fromEntries(Object.entries(state.validationRetryRequests || {}).filter(([, request]) => !sameScenarioContext(request, previous)));
    state.pendingScenarioReset = request;
    return request;
  }

  function acceptScenarioContextEnvelope(payload) {
    const envelope = normalizedScenarioContextEnvelope(payload);
    const issues = scenarioContextEnvelopeIssues(envelope);
    if (issues.length) return { sourceModule: "本体管理", contractCode: "C033", contextId: envelope?.contextId || null, status: "rejected", receivedAt: fullNowText(), reason: issues.join("；"), scenarioContext: clone(envelope?.scenarioContext || null) };
    const existing = state.scenarioContextReceipts?.[envelope.contextId];
    if (existing) {
      const recorded = existing.envelope || null;
      if (recorded && snapshotFingerprint(recorded) === snapshotFingerprint(envelope)) return clone(existing.receipt);
      return { sourceModule: "本体管理", contractCode: "C033", contextId: envelope.contextId, status: "rejected", receivedAt: fullNowText(), reason: "同一场景上下文稳定标识的内容不可被改写", scenarioContext: clone(envelope.scenarioContext) };
    }
    const current = currentScenarioContext();
    if (sameScenarioContext(current, envelope.scenarioContext) && !sameScenarioEnvelope(current, envelope.scenarioContext)) {
      return { sourceModule: "本体管理", contractCode: "C033", contextId: envelope.contextId, status: "rejected", receivedAt: fullNowText(), reason: "同一场景轮次的形成时间或状态不可被改写；请由平台公共层提供新的不可变场景轮次", scenarioContext: clone(envelope.scenarioContext) };
    }
    let pendingResetMatches = state.pendingScenarioReset
      && state.pendingScenarioReset.scenarioId === envelope.scenarioContext.scenarioId
      && state.pendingScenarioReset.scenarioVersion === envelope.scenarioContext.scenarioVersion
      && state.pendingScenarioReset.previousScenarioRunId !== envelope.scenarioContext.scenarioRunId;
    let replaceable = waitingScenarioPlaceholder(current)
      || pendingResetMatches;
    const newerPlatformRun = !sameScenarioContext(current, envelope.scenarioContext)
      && sameScenarioDefinition(current, envelope.scenarioContext)
      && currentScenarioContextReady()
      && envelope.sourceModule === "平台公共层"
      && envelope.contractCode === "C033"
      && Date.parse(envelope.scenarioContext.formedAt) > Date.parse(current.formedAt);
    if (!replaceable && newerPlatformRun) {
      resetCurrentScenarioProjection();
      pendingResetMatches = state.pendingScenarioReset
        && state.pendingScenarioReset.scenarioId === envelope.scenarioContext.scenarioId
        && state.pendingScenarioReset.scenarioVersion === envelope.scenarioContext.scenarioVersion
        && state.pendingScenarioReset.previousScenarioRunId !== envelope.scenarioContext.scenarioRunId;
      replaceable = !!pendingResetMatches;
    }
    if (!sameScenarioContext(current, envelope.scenarioContext) && !replaceable) {
      return { sourceModule: "本体管理", contractCode: "C033", contextId: envelope.contextId, status: "rejected", receivedAt: fullNowText(), reason: "当前场景工作投影已存在，不能用新的轮次静默覆盖；请先执行定向重置", scenarioContext: clone(envelope.scenarioContext) };
    }
    state.scenarioContexts[envelope.scenarioContext.scenarioId] = clone(envelope.scenarioContext);
    state.activeScenarioId = envelope.scenarioContext.scenarioId;
    if (state.scenarioActivationIntent && scenarioInputMatchesCurrent(state.scenarioActivationIntent.requestedScenario, envelope.scenarioContext)) state.scenarioActivationIntent = null;
    if (pendingResetMatches) {
      const latestReset = [...(state.scenarioHistory || [])].reverse().find(item => item.type === "scenario-reset" && item.resetRequest?.requestId === state.pendingScenarioReset.requestId);
      if (latestReset) latestReset.nextScenarioContext = clone(envelope.scenarioContext);
      state.pendingScenarioReset = null;
    }
    const receipt = { sourceModule: "本体管理", contractCode: "C033", contextId: envelope.contextId, status: "accepted", receivedAt: fullNowText(), reason: null, scenarioContext: clone(envelope.scenarioContext), evidenceLocator: envelope.evidenceLocator };
    state.scenarioContextReceipts[envelope.contextId] = { envelope: clone(envelope), receipt: clone(receipt) };
    localStorage.removeItem(C008_PROJECTION_KEY);
    state.c008ProjectionFault = null;
    persist(); render();
    return receipt;
  }

  function receiptForDelivery(contract, statusValue, reason, draft = null, replacedDraft = null) {
    const receivedAt = fullNowText();
    const contractFingerprint = contract ? snapshotFingerprint(contract) : null;
    return {
      sourceModule: "本体管理",
      contractCode: "C003",
      deliveryId: contract?.deliveryId || null,
      status: statusValue,
      receivedAt,
      reason: reason || null,
      scenarioContext: clone(contract?.scenarioContext || currentScenarioContext()),
      targetDraftId: draft?.id || null,
      targetDraftRevision: draft?.draftRevision || null,
      assetId: contract?.assetId || null,
      assetVersion: contract?.assetVersion || null,
      asOf: contract?.asOf || null,
      t006Id: contract?.assetId || null,
      t007Version: contract?.assetVersion || null,
      t008AsOf: contract?.asOf || null,
      evidenceLocator: contract?.evidenceLocator || null,
      contractSchemaVersion: contract?.contractSchemaVersion || null,
      sourceContractFingerprint: contractFingerprint,
      sourceDataContract: statusValue === "accepted" ? clone(contract) : null,
      immutableReceiptSnapshot: statusValue === "accepted" ? {
        snapshotId: `C003-RECEIPT-${contract?.deliveryId || "UNKNOWN"}`,
        formedAt: receivedAt,
        deliveryId: contract?.deliveryId || null,
        assetId: contract?.assetId || null,
        assetVersion: contract?.assetVersion || null,
        draftId: draft?.id || null,
        draftRevision: draft?.draftRevision || null,
        contractFingerprint
      } : null,
      previousDraftId: replacedDraft?.id || null,
      previousAssetVersion: replacedDraft?.sourceDataContract?.assetVersion || null,
      replacement: replacedDraft && draft ? { previousDraftId: replacedDraft.id, newDraftId: draft.id, previousAssetVersion: replacedDraft.sourceDataContract?.assetVersion || null, newAssetVersion: contract?.assetVersion || null, relation: "替代" } : null
    };
  }

  function dataAssetDeliveryTargetDraft(contract) {
    const context = scenarioContextOf(contract);
    const openDrafts = state.drafts.filter(draft => !draft.publishedVersionId && sameScenarioEnvelope(draft, context));
    const compatibleEmptyDraft = draft => !draftHasSemanticContent(draft) && (!draft.ontologyStableId || draft.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION");
    return openDrafts.find(item => item.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION")
      || openDrafts.find(item => item.id === state.activeDraftId && compatibleEmptyDraft(item))
      || openDrafts.find(compatibleEmptyDraft)
      || null;
  }

  function applyDataAssetDelivery(contract, draft = dataAssetDeliveryTargetDraft(contract)) {
    let targetDraft = draft;
    let created = false;
    if (!targetDraft) {
      targetDraft = completeDraft(contract, latestS001PublishedVersion(contract));
      state.drafts.unshift(targetDraft);
      state.activeDraftId = targetDraft.id;
      created = true;
    } else {
      const semanticContentExists = draftHasSemanticContent(targetDraft);
      const targetContractFingerprint = targetDraft.sourceContractFingerprint || (targetDraft.sourceDataContract ? snapshotFingerprint(targetDraft.sourceDataContract) : null);
      const sameAcceptedSource = targetDraft.sourceDeliveryId === contract.deliveryId
        && targetContractFingerprint === snapshotFingerprint(contract);
      if (semanticContentExists && !sameAcceptedSource) {
        return { draft: null, replacedDraft: null, created: false, error: "当前目标 Draft 已包含用户建模内容；数据资产交付不能静默覆盖或更换其来源合同" };
      }
      if (!semanticContentExists) {
        const populated = completeDraft(contract, latestS001PublishedVersion(contract));
        targetDraft.ontologyStableId = populated.ontologyStableId;
        targetDraft.name = populated.name;
        targetDraft.definition = populated.definition;
        targetDraft.draftName = populated.draftName;
        targetDraft.basedOn = populated.basedOn;
        targetDraft.basedOnVersionId = populated.basedOnVersionId;
        targetDraft.draftRevision = populated.draftRevision;
        targetDraft.objects = populated.objects;
        targetDraft.links = populated.links;
        targetDraft.metrics = populated.metrics;
        targetDraft.rules = populated.rules;
        targetDraft.actions = populated.actions;
        targetDraft.positions = populated.positions;
        targetDraft.canvasView = populated.canvasView;
        targetDraft.release = populated.release;
        targetDraft.resourceSemanticFingerprints = populated.resourceSemanticFingerprints;
        targetDraft.resourceSemanticFingerprintVersion = populated.resourceSemanticFingerprintVersion;
      }
      targetDraft.draftRevision = Math.max(1, Number(targetDraft.draftRevision || 1));
    }
    targetDraft.sourceDeliveryId = contract.deliveryId;
    targetDraft.sourceAssetVersion = contract.assetVersion;
    targetDraft.sourceDataContract = clone(contract);
    targetDraft.sourceDeliverySnapshot = clone(contract);
    targetDraft.sourceContractFingerprint = snapshotFingerprint(contract);
    targetDraft.receivedDataAssetDelivery = clone(contract);
    targetDraft.receivedDataAssetDelivery.receivedAt = fullNowText();
    targetDraft.receivedDataAssetDelivery.receiptSnapshotId = `C003-RECEIPT-${contract.deliveryId}`;
    targetDraft.receivedDataAssetDelivery.contractFingerprint = snapshotFingerprint(contract);
    targetDraft.receivedDataAssetDelivery.draftRevision = targetDraft.draftRevision;
    resetDraftValidation(targetDraft);
    touchDraft(targetDraft);
    return { draft: targetDraft, replacedDraft: null, created };
  }

  function dataAssetDeliveryLookup(deliveryId) {
    const stableId = String(deliveryId || "").trim();
    const receipt = stableId ? state.dataAssetDeliveryReceipts?.[stableId] || null : null;
    const issues = stableId ? (state.externalDeliveryIssues || []).filter(item => item?.kind === "C003" && item.deliveryId === stableId) : [];
    const evidenceContext = receipt?.scenarioContext || issues.at(-1)?.scenarioContext || currentScenarioContext();
    const rootReceipt = Object.values(state.scenarioContextReceipts || {}).map(item => item.receipt).find(item => item?.status === "accepted" && sameScenarioEnvelope(item, evidenceContext)) || null;
    const readStatus = !stableId ? "invalid" : receipt ? "found" : issues.length ? "issue_only" : "unknown";
    return {
      sourceModule: "本体管理",
      contractCode: "C003",
      deliveryId: stableId || null,
      readStatus,
      observedAt: fullNowText(),
      currentScenarioContext: clone(currentScenarioContext()),
      evidenceScenarioContext: clone(evidenceContext),
      rootScenarioReceipt: clone(rootReceipt),
      receipt: clone(receipt),
      issues: clone(issues),
      reason: readStatus === "invalid" ? "请提供稳定交付标识" : readStatus === "unknown" ? "未找到本体管理实际接收或拒绝该交付的持久化记录" : readStatus === "issue_only" ? "已定位交付异常，但未形成可作为接收事实的回执" : null
    };
  }

  function resolveHistoricalSemanticEvidence(request) {
    const version = state.publishedVersions.find(item => item.id === request?.semanticVersionId && (!request?.semanticVersion || item.semanticVersion === request.semanticVersion));
    if (!version) return { contractCode: "C026", status: "无法定位", reason: "精确 Published 语义版本不存在或不可访问", responsibility: "本体管理 · Published 版本" };
    const ids = [...new Set(request?.resourceIds || [])];
    if (!ids.length) return { contractCode: "C026", status: "无法定位", reason: "缺少稳定语义资源身份", responsibility: "请求方 · 报告证据绑定" };
    const resources = ids.map(id => publishedResources(version).find(resource => resource.id === id));
    if (resources.some(resource => !resource)) return { contractCode: "C026", status: "无法定位", reason: "至少一个稳定语义身份不属于请求的精确版本", responsibility: "请求方 · 报告证据绑定" };
    return { contractCode: "C026", status: "已定位", semanticVersionId: version.id, semanticVersion: version.semanticVersion, resources: resources.map(resource => publishedResourceContractItem(version, resource)), responsibility: "本体管理 · Published 资源定义" };
  }

  const ontologyReviewBridge = Object.freeze({
    deliverScenarioContext(payload) {
      synchronizeStateFromStorage();
      return clone(acceptScenarioContextEnvelope(payload));
    },
    deliverDataAsset(payload) {
      synchronizeStateFromStorage();
      const contract = normalizedDataAssetContract(payload);
      const deliveryExisting = contract?.deliveryId ? state.dataAssetDeliveryReceipts?.[contract.deliveryId] || null : null;
      const storedContract = contract?.deliveryId ? dataAssetDeliveryById(contract.deliveryId) : null;
      const recordedFingerprint = contract?.deliveryId ? state.dataAssetDeliveryFingerprints?.[contract.deliveryId] || null : null;
      const incomingFingerprint = snapshotFingerprint(contract);
      const schemaEnrichment = deliveryExisting?.status === "accepted" && isCompatibleContractEnrichment(storedContract, contract);
      if (deliveryExisting && recordedFingerprint === incomingFingerprint) return clone(deliveryExisting);
      if (deliveryExisting && !schemaEnrichment) {
        const conflictReceipt = receiptForDelivery(contract, "rejected", "同一稳定交付标识的内容不可被改写；原始接收或拒绝回执保持不变");
        rememberExternalDeliveryIssue("C003", contract, conflictReceipt.reason);
        return clone(conflictReceipt);
      }
      const issues = dataAssetDeliveryIssues(contract);
      if (issues.length) {
        const receipt = receiptForDelivery(contract, "rejected", issues.join("；"));
        if (contract?.deliveryId) {
          state.dataAssetDeliveryReceipts[contract.deliveryId] = receipt;
          state.dataAssetDeliveryFingerprints[contract.deliveryId] = incomingFingerprint;
        }
        rememberExternalDeliveryIssue("C003", contract, issues.join("；"));
        return clone(receipt);
      }
      const key = dataAssetContractKey(contract.assetId, contract.assetVersion);
      const existing = state.externalDataAssets?.[key] || receivedDataAsset(contract.assetId, contract.assetVersion);
      if (deliveryExisting) {
        if (schemaEnrichment) {
          state.externalDataAssets = state.externalDataAssets || {};
          state.externalDataAssets[key] = clone(contract);
          state.dataAssetDeliveryFingerprints[contract.deliveryId] = incomingFingerprint;
          const receipt = clone(deliveryExisting);
          receipt.contractUpgradedAt = fullNowText();
          state.dataAssetDeliveryReceipts[contract.deliveryId] = receipt;
          persist(); render(); return clone(receipt);
        }
      }
      if (existing && snapshotFingerprint(existing) !== snapshotFingerprint(contract)) {
        const receipt = receiptForDelivery(contract, "rejected", "同一精确数据版本的已接收合同不可被改写");
        state.dataAssetDeliveryReceipts[contract.deliveryId] = receipt;
        state.dataAssetDeliveryFingerprints[contract.deliveryId] = snapshotFingerprint(contract);
        rememberExternalDeliveryIssue("C003", contract, receipt.reason); return clone(receipt);
      }
      const applied = applyDataAssetDelivery(contract, dataAssetDeliveryTargetDraft(contract));
      if (applied.error) {
        const receipt = receiptForDelivery(contract, "rejected", applied.error);
        state.dataAssetDeliveryReceipts[contract.deliveryId] = receipt;
        state.dataAssetDeliveryFingerprints[contract.deliveryId] = incomingFingerprint;
        rememberExternalDeliveryIssue("C003", contract, applied.error);
        return clone(receipt);
      }
      state.externalDataAssets = state.externalDataAssets || {}; state.externalDataAssets[key] = clone(contract);
      const receipt = receiptForDelivery(contract, "accepted", null, applied.draft, applied.replacedDraft);
      state.dataAssetDeliveryReceipts[contract.deliveryId] = receipt;
      state.dataAssetDeliveryFingerprints[contract.deliveryId] = incomingFingerprint;
      persist(); render(); return clone(receipt);
    },
    deliverRefreshRequest(payload) {
      synchronizeStateFromStorage();
      const request = normalizeRefreshRequest(payload);
      const incomingFingerprint = request ? snapshotFingerprint(request) : null;
      const storedReceipt = request?.requestId ? state.refreshRequestReceipts?.[request.requestId] || null : null;
      const storedFingerprint = request?.requestId ? state.refreshRequestFingerprints?.[request.requestId] || null : null;
      if (storedReceipt && storedFingerprint === incomingFingerprint) return clone(storedReceipt);
      if (storedReceipt) {
        const reason = "同一刷新请求标识的内容不可被改写；原始接收或拒绝回执保持不变";
        rememberExternalDeliveryIssue("C028", request, reason);
        return receiptForRefreshRequest(request, "rejected", reason);
      }
      const issues = refreshRequestIssues(request);
      if (issues.length) {
        const receipt = receiptForRefreshRequest(request, "rejected", issues.join("；"));
        if (request?.requestId) {
          state.refreshRequestReceipts[request.requestId] = clone(receipt);
          state.refreshRequestFingerprints[request.requestId] = incomingFingerprint;
        }
        rememberExternalDeliveryIssue("C028", request, receipt.reason);
        return clone(receipt);
      }
      const existing = state.externalRefreshRequests?.[request.requestId];
      if (existing && snapshotFingerprint(existing) !== incomingFingerprint) {
        const reason = "同一刷新请求标识的已接收内容不可被改写";
        rememberExternalDeliveryIssue("C028", request, reason);
        return receiptForRefreshRequest(request, "rejected", reason);
      }
      if (existing) {
        const update = Object.values(state.updatesByVersion || {}).find(item => item?.requestId === request.requestId) || null;
        const receipt = receiptForRefreshRequest(request, "accepted", null, update);
        state.refreshRequestReceipts[request.requestId] = clone(receipt);
        state.refreshRequestFingerprints[request.requestId] = incomingFingerprint;
        persist({ refreshProjection: false }); render(); return clone(receipt);
      }
      const update = receiveExternalRefreshRequest(request);
      if (!update) {
        const reason = "当前精确语义版本已有尚未完成的待更新数据；新请求不能覆盖现有候选";
        const receipt = receiptForRefreshRequest(request, "rejected", reason);
        state.refreshRequestReceipts[request.requestId] = clone(receipt);
        state.refreshRequestFingerprints[request.requestId] = incomingFingerprint;
        rememberExternalDeliveryIssue("C028", request, reason);
        return clone(receipt);
      }
      const receipt = receiptForRefreshRequest(request, "accepted", null, update);
      state.refreshRequestReceipts[request.requestId] = clone(receipt);
      state.refreshRequestFingerprints[request.requestId] = incomingFingerprint;
      persist(); render(); return clone(receipt);
    },
    deliverQualityFact(payload) {
      const fact = normalizeQualityFact(payload); const issues = qualityFactIssues(fact);
      if (issues.length) { rememberExternalDeliveryIssue("C017", fact, issues.join("；")); return false; }
      const existing = state.externalQualityFacts?.[fact.factId];
      if (existing && snapshotFingerprint(existing) !== snapshotFingerprint(fact)) { rememberExternalDeliveryIssue("C017", fact, "同一质量事实标识的已接收内容不可被改写"); return false; }
      if (existing) return true;
      state.externalQualityFacts[fact.factId] = clone(fact);
      const version = declaredPublishedVersion(fact); const key = combinationKey(version.id, fact.dataVersion);
      if (fact.status === "blocked") {
        state.combinationIncidents[key] = clone(fact);
        addRecord(version.id, "收到正式数据质量阻断事实", `${fact.reason}；本体管理已停止该组合产生新的正式输出。`, "阻断", "red", fact.dataVersion, "C017", { sourceModule: "数据工程", externalRunId: fact.factId, externalEvidenceRef: fact.evidenceLocator, formsContract: false });
      } else {
        const incident = state.combinationIncidents[key];
        if (incident) state.combinationIncidents[key] = { ...incident, recoveryReportedAt: fact.detectedAt, recoveryFactId: fact.factId, recoveryEvidenceLocator: fact.evidenceLocator, recoveryReason: fact.reason };
        addRecord(version.id, "收到数据质量恢复事实", `${fact.reason}；该事实不自动恢复正式服务，仍需通过本体管理的受控更新或回退流程。`, "待受控恢复", "blue", fact.dataVersion, "C017", { sourceModule: "数据工程", externalRunId: fact.factId, externalEvidenceRef: fact.evidenceLocator, formsContract: false });
      }
      persist(); render(); return true;
    },
    deliverConsumerCompatibility(payload) {
      synchronizeStateFromStorage();
      const item = normalizeConsumerCompatibility(payload); const issues = consumerCompatibilityIssues(item);
      if (issues.length) { rememberExternalDeliveryIssue("C009", item, issues.join("；")); return false; }
      const key = `${item.configId}|${item.configVersion}|${item.semanticVersionId}|${item.dataVersion}`;
      const existing = state.externalConsumerCompatibility?.[key];
      if (existing && snapshotFingerprint(existing) !== snapshotFingerprint(item)) { rememberExternalDeliveryIssue("C009", item, "同一配置与精确双版本的兼容状态不可被原地改写；请形成新的配置版本或检查记录"); return false; }
      state.externalConsumerCompatibility[key] = clone(item);
      // C009 is a consumer-owned compatibility record. Archiving it must not
      // create a new revision of the C008 authority binding when that binding
      // itself has not changed.
      persist({ refreshProjection: false }); render(); return true;
    },
    publishedContext(versionId) {
      const version = state.publishedVersions.find(item => item.id === versionId) || null;
      return version ? clone({ discovery: publishedDiscoveryPackage(version), consumption: authoritativeBindingPackage(version) }) : null;
    },
    authoritativeC008Projection() { return clone(authoritativeC008Projection()); },
    repairAuthoritativeC008Projection() { return clone(repairAuthoritativeC008Projection()); },
    dataAssetDeliveryReceipt(deliveryId) {
      synchronizeStateFromStorage();
      return clone(state.dataAssetDeliveryReceipts?.[deliveryId] || null);
    },
    dataAssetDeliveryStatus(deliveryId) {
      synchronizeStateFromStorage();
      return clone(dataAssetDeliveryLookup(deliveryId));
    },
    refreshRequestStatus(requestId) {
      synchronizeStateFromStorage();
      return clone(refreshRequestStatus(requestId));
    },
    consumerCompatibilityRecords(query = {}) {
      synchronizeStateFromStorage();
      const records = Object.values(state.externalConsumerCompatibility || {}).filter(item => {
        if (query.configId && item.configId !== query.configId) return false;
        if (query.configVersion && item.configVersion !== query.configVersion) return false;
        if (query.semanticVersionId && item.semanticVersionId !== query.semanticVersionId) return false;
        if (query.dataVersion && item.dataVersion !== query.dataVersion) return false;
        if (query.scenarioRunId && item.scenarioContext?.scenarioRunId !== query.scenarioRunId) return false;
        return true;
      });
      return clone({ sourceModule: "本体管理", contractCode: "C009", readOnly: true, readAt: fullNowText(), records });
    },
    discoverRefreshTargets(query) { return clone(discoverRefreshTargets(query || {})); },
    resolvePublishedEvidence(request) { return clone(resolveHistoricalSemanticEvidence(request)); },
    handoffSnapshot() {
      synchronizeStateFromStorage();
      const context = currentScenarioContext();
      const currentVersions = state.publishedVersions.filter(version => sameScenarioEnvelope(version, context));
      const versionInCurrentContext = item => {
        const version = declaredPublishedVersion(item);
        return !!version && sameScenarioEnvelope(version, context);
      };
      const currentValidationReferences = Object.values(state.externalValidationInbox || {}).flatMap(value => Array.isArray(value) ? value.map(event => event.payload) : [value]).filter(item => sameScenarioEnvelope(item, context));
      return clone({
        module: "本体管理", scenarioContext: context, pendingScenarioReset: clone(state.pendingScenarioReset), scenarioActivationIntent: clone(state.scenarioActivationIntent), scenarioContextReceipts: Object.values(state.scenarioContextReceipts || {}).map(item => item.receipt).map(clone), drafts: state.drafts.filter(draft => !draft.publishedVersionId && sameScenarioEnvelope(draft, context)).map(draft => {
          const intake = draft.receivedDataAssetDelivery || null;
          return {
            id: draft.id,
            ontologyStableId: draft.ontologyStableId,
            name: draft.name,
            scenarioContext: clone(scenarioContextOf(draft)),
            status: draftPrimaryStatus(draft),
            basedOnVersionId: draft.basedOnVersionId,
            draftRevision: Number(draft.draftRevision || 1),
            sourceDeliveryId: intake?.deliveryId || draft.sourceDeliveryId || null,
            sourceAssetVersion: intake?.assetVersion || draft.sourceDataContract?.assetVersion || null,
            receivedDataAssetDelivery: clone(intake),
            objectCount: draft.objects.length,
            propertyCount: draft.objects.reduce((count, object) => count + object.properties.length, 0),
            linkCount: draft.links.length,
            publishedVersionId: draft.publishedVersionId || null
          };
        }),
        published: currentVersions.map(version => {
          const consumption = authoritativeBindingPackage(version);
          const historicalBinding = historicalBindingFor(version);
          return {
            versionId: version.id,
            semanticVersion: version.semanticVersion,
            ontologyStableId: version.ontologyStableId,
            scenarioContext: clone(scenarioContextOf(version)),
            publicationState: publicationStateOf(version),
            businessValidityState: businessValidityStateOf(version),
            currentFormal: consumption.currentFormal,
            consumable: consumption.consumable,
            consumptionState: consumption.consumptionState,
            dataVersion: historicalBinding?.dataVersion || null,
            sourceDraftId: version.sourceDraftId || null,
            draftRevision: Number(version.draftRevision || 1),
            sourceDeliveryId: version.sourceDeliveryId || null,
            sourceAssetVersion: version.dataContract?.assetVersion || historicalBinding?.dataVersion || null
          };
        }),
        inputs: { c003: Object.values(state.externalDataAssets || {}).filter(item => sameScenarioEnvelope(item, context)), c028: Object.values(state.externalRefreshRequests || {}).filter(item => sameScenarioEnvelope(item, context)), c028Receipts: Object.values(state.refreshRequestReceipts || {}).filter(item => sameScenarioEnvelope(item, context)), c017: Object.values(state.externalQualityFacts || {}).filter(versionInCurrentContext), c009: Object.values(state.externalConsumerCompatibility || {}).filter(versionInCurrentContext), c008Requirements: Object.values(state.externalValidationRequirements || {}).filter(item => sameScenarioEnvelope(item, context)), c008References: currentValidationReferences },
        outputs: {
          publishedContexts: currentVersions.map(version => ({ versionId: version.id, c004ToC007: publishedDiscoveryPackage(version), c008: authoritativeBindingPackage(version), t054: refreshTargetForVersionSnapshot(version) })),
          validationRetryRequests: Object.values(state.validationRetryRequests || {}).filter(item => sameScenarioEnvelope(item, context)), authoritativeC008Projection: authoritativeC008Projection(), dataAssetDeliveryReceipts: Object.values(state.dataAssetDeliveryReceipts || {}).map(clone)
        },
        c032Discoveries: Object.values(state.refreshTargetDiscoveries || {}).filter(item => sameScenarioEnvelope(item, context)), deliveryIssues: (state.externalDeliveryIssues || []).filter(item => item.scenarioContext && sameScenarioEnvelope(item, context))
      });
    },
    candidateContext() {
      const version = selectedVersion(); const update = updateFor(version);
      const admission = version && update ? candidateValidationAdmission(version, update) : { passed: false, reason: "尚未形成待验证候选" };
      if (!admission.passed) return { ready: false, status: update?.phase || "not_ready", reason: admission.reason || "尚未形成待验证候选", recovery: update ? "先完成当前候选的数据与本体匹配检查，并取得同一候选的消费验证资格。" : "等待数据工程提交合规刷新请求，并由本体管理完成匹配检查。" };
      const requirement = version && update ? consumeExternalValidationRequirement(version, update) : null;
      const retryRequests = Object.values(state.validationRetryRequests || {}).filter(item => item.candidateKey === admission.expectedKey);
      const latestRetryRequest = retryRequests.slice().sort((left, right) => String(right.requestedAt || "").localeCompare(String(left.requestedAt || ""), "zh-CN"))[0] || null;
      return { ready: true, status: "eligible", scenarioContext: clone(scenarioContextOf(update || version)), requirementKey: externalValidationInboxKey(version, update), inboxKey: externalValidationInboxKey(version, update), candidateKey: admission.expectedKey, semanticVersionId: version.id, semanticVersion: version.semanticVersion, dataVersion: update.dataVersion, asOf: update.asOf, validationRequirementFingerprint: requirement ? snapshotFingerprint(requirement) : null, validationAdmission: "eligible", validationRetryRequest: clone(latestRetryRequest), validationRetryRequests: clone(retryRequests) };
    },
    deliverValidationRequirement(payload) {
      const target = declaredCandidateTarget(payload);
      if (!target) { rememberValidationAdmissionIssue(null, payload, "requirement", "无法定位精确候选双版本，题集要求未接收"); return false; }
      const { version, update } = target;
      const admission = candidateValidationAdmission(version, update);
      if (!admission.passed) { rememberValidationAdmissionIssue(target, payload, "requirement", `${admission.reason}，题集要求未接收`); return false; }
      const key = externalValidationInboxKey(version, update);
      state.externalValidationRequirements = state.externalValidationRequirements || {};
      const incoming = validationRequirementSnapshot(payload);
      if (!validationTargetMatches(incoming, version, update) || !validationRequirementFieldsReady(incoming)) {
        rememberValidationDeliveryIssue(target, incoming, "requirement", validationDeliveryIssue(incoming, version, update, "requirement"));
        return false;
      }
      const existing = state.externalValidationRequirements[key];
      if (existing) {
        const sameRequirement = snapshotFingerprint(existing) === snapshotFingerprint(incoming);
        if (sameRequirement) { delete update.validationDeliveryIssue; persist(); render(); }
        else rememberValidationDeliveryIssue(target, incoming, "requirement", "不可变题集要求冲突：当前候选已锁定的题集版本和必测项不能被改写");
        return sameRequirement;
      }
      state.externalValidationRequirements[key] = incoming;
      delete update.validationDeliveryIssue;
      persist(); render(); return true;
    },
    deliverValidationReference(payload) {
      const target = declaredCandidateTarget(payload);
      if (!target) { rememberValidationAdmissionIssue(null, payload, "reference", "无法定位精确候选双版本，验证引用未接收"); return false; }
      const { version, update } = target;
      const admission = candidateValidationAdmission(version, update);
      if (!admission.passed) { rememberValidationAdmissionIssue(target, payload, "reference", `${admission.reason}，验证引用未接收`); return false; }
      const key = externalValidationInboxKey(version, update);
      state.externalValidationInbox = state.externalValidationInbox || {};
      const events = Array.isArray(state.externalValidationInbox[key]) ? state.externalValidationInbox[key] : state.externalValidationInbox[key] ? [{ payload: clone(state.externalValidationInbox[key]), fingerprint: validationReferenceFingerprint(state.externalValidationInbox[key]), receivedAt: fullNowText() }] : [];
      const incoming = validationReferenceSnapshot(payload); const fingerprint = validationReferenceFingerprint(incoming); const previous = events.at(-1);
      const requirement = consumeExternalValidationRequirement(version, update);
      if (!validationTargetMatches(incoming, version, update) || !resolvedExternalValue(incoming.runId) || !requirement || !validationRequirementFieldsReady(requirement) || incoming.questionSetVersion !== requirement.questionSetVersion || incoming.questionSetEvidenceLocator !== requirement.questionSetEvidenceLocator || incoming.validationRequirementFingerprint !== snapshotFingerprint(requirement)) {
        rememberValidationDeliveryIssue(target, incoming, "reference", validationDeliveryIssue(incoming, version, update, "reference"));
        return false;
      }
      const usedRunIds = validationRunIdsForCandidate(version, update);
      const sameExistingRun = previous?.payload?.runId === incoming.runId;
      if (!sameExistingRun && usedRunIds.has(incoming.runId)) {
        rememberValidationDeliveryIssue(target, incoming, "reference", "运行标识冲突：该运行标识已用于当前候选的其他验证引用");
        return false;
      }
      if (update.validationRetryRequested && (incoming.retryOf !== update.validationRetryOf || incoming.runId === update.validationRetryOf)) {
        rememberValidationDeliveryIssue(target, incoming, "reference", "重试关系冲突：新引用必须回指原运行并使用新的运行标识");
        return false;
      }
      if (previous?.fingerprint === fingerprint) { delete update.validationDeliveryIssue; persist(); render(); return true; }
      if (previous) {
        const previousStatus = previous.payload?.status;
        const sameIdentity = validationReferenceIdentity(previous.payload) === validationReferenceIdentity(incoming);
        const processingTransition = previousStatus === "processing" && incoming.status !== "processing" && sameIdentity;
        if (!processingTransition) {
          rememberValidationDeliveryIssue(target, incoming, "reference", "不可变引用冲突：同一运行的已接收结果不能被改写");
          return false;
        }
      }
      events.push({ payload: incoming, fingerprint, receivedAt: fullNowText() });
      state.externalValidationInbox[key] = events;
      if (update.validationRetryRequestId && state.validationRetryRequests?.[update.validationRetryRequestId]) {
        state.validationRetryRequests[update.validationRetryRequestId] = { ...state.validationRetryRequests[update.validationRetryRequestId], status: "已收到新运行引用", receivedRunId: incoming.runId, receivedAt: fullNowText() };
      }
      delete update.validationDeliveryIssue;
      persist(); render(); return true;
    }
  });
  window.ontologyReview = ontologyReviewBridge;
  document.documentElement.ontologyReview = ontologyReviewBridge;
  window.getOntologyReviewHandoff = () => ontologyReviewBridge;
  document.getOntologyReviewHandoff = () => ontologyReviewBridge;
  document.documentElement.setAttribute("data-ontology-handoff-ready", "true");
  document.addEventListener("ontology-handoff-request", event => {
    const callback = event?.detail?.callback;
    if (typeof callback === "function") callback(ontologyReviewBridge);
  });

  function handoffResponse(requestId, operation, ok, result = null, error = null) {
    return {
      channel: HANDOFF_CHANNEL,
      targetModule: "本体管理",
      requestId: requestId || null,
      operation,
      ok,
      result: clone(result),
      error,
      respondedAt: fullNowText()
    };
  }

  function handleHandoffMessage(payload) {
    if (!payload || payload.channel !== HANDOFF_CHANNEL || payload.targetModule !== "本体管理" || !resolvedExternalValue(payload.requestId)) return null;
    const operation = payload.operation;
    try {
      if (operation === "handoffSnapshot") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.handoffSnapshot());
      if (operation === "discoverRefreshTargets") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.discoverRefreshTargets(payload.payload || {}));
      if (operation === "publishedContext") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.publishedContext(payload.payload?.versionId));
      if (operation === "candidateContext") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.candidateContext());
      if (operation === "dataAssetDeliveryStatus") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.dataAssetDeliveryStatus(payload.payload?.deliveryId));
      if (operation === "refreshRequestStatus") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.refreshRequestStatus(payload.payload?.refreshRequestId || payload.payload?.requestId));
      if (operation === "consumerCompatibilityRecords") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.consumerCompatibilityRecords(payload.payload || {}));
      if (operation === "repairAuthoritativeC008Projection") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.repairAuthoritativeC008Projection());
      if (operation === "resolvePublishedEvidence") return handoffResponse(payload.requestId, operation, true, ontologyReviewBridge.resolvePublishedEvidence(payload.payload || {}));
      const mutations = {
        deliverScenarioContext: ontologyReviewBridge.deliverScenarioContext,
        deliverDataAsset: ontologyReviewBridge.deliverDataAsset,
        deliverRefreshRequest: ontologyReviewBridge.deliverRefreshRequest,
        deliverQualityFact: ontologyReviewBridge.deliverQualityFact,
        deliverConsumerCompatibility: ontologyReviewBridge.deliverConsumerCompatibility,
        deliverValidationRequirement: ontologyReviewBridge.deliverValidationRequirement,
        deliverValidationReference: ontologyReviewBridge.deliverValidationReference
      };
      if (mutations[operation]) {
        const accepted = mutations[operation](payload.payload || {});
        const ok = typeof accepted === "object" ? accepted.status === "accepted" : !!accepted;
        return handoffResponse(payload.requestId, operation, ok, typeof accepted === "object" ? accepted : { accepted: ok }, ok ? null : "交付未通过本体管理合同校验");
      }
      return handoffResponse(payload.requestId, operation, false, null, "未知联调操作");
    } catch (error) {
      return handoffResponse(payload.requestId, operation, false, null, error?.message || "联调操作未完成");
    }
  }

  window.addEventListener("message", event => {
    if (event.origin !== window.location.origin) return;
    const response = handleHandoffMessage(event.data);
    if (!response) return;
    const target = event.source && typeof event.source.postMessage === "function" ? event.source : window;
    target.postMessage(response, window.location.origin);
  });
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY && event.newValue) {
      synchronizeStateFromStorage();
      render();
      return;
    }
    if (event.key !== `${HANDOFF_CHANNEL}:request` || !event.newValue) return;
    try {
      const response = handleHandoffMessage(JSON.parse(event.newValue));
      if (response) localStorage.setItem(`${HANDOFF_CHANNEL}:response:${response.requestId}`, JSON.stringify(response));
    } catch { /* Invalid handoff payloads are ignored and never mutate module state. */ }
  });

  function renderCandidateValidationEvidence(version, update) {
    if (!update || !["eligible", "verifying", "verification_pending", "verify_failed", "verified", "switching", "switch_failed", "adopted"].includes(update.phase)) return "";
    const reference = update.validationReference || null;
    const gate = validationGateForDisplay(version, update);
    const issue = update.validationDeliveryIssue || null;
    if (!reference) {
      const issueDetails = issue ? `<div class="result-banner error compact"><span>!</span><div><b>验证引用已被拒绝</b><p>${esc(issue.reason)}。本体管理不会改写合同编号、补算结果或把该引用作为采用证据。</p></div></div><dl class="definition-grid compact"><dt>来源模块</dt><dd>${esc(issue.sourceModule)}</dd><dt>采用合同引用</dt><dd class="mono">${esc(issue.contractCode)}</dd><dt>验证依据</dt><dd class="mono">${esc(issue.decisionRef)} / CR024</dd><dt>候选语义版本</dt><dd>${esc(issue.semanticVersion)} · <span class="mono">${esc(issue.semanticVersionId)}</span></dd><dt>候选数据版本</dt><dd class="mono">${esc(issue.dataVersion)}</dd><dt>题集版本</dt><dd class="mono">${esc(issue.questionSetVersion)}</dd><dt>运行状态</dt><dd>${esc(issue.status)}</dd><dt>完成时间</dt><dd>${esc(issue.completedAt)}</dd><dt>证据定位</dt><dd class="mono">${esc(issue.evidenceLocator)}</dd><dt>接收时间</dt><dd>${esc(issue.receivedAt)}</dd></dl>` : "";
      return `<section class="panel validation-reference"><div class="panel-head"><div><h2>智能问数验证引用</h2><p>本体管理只读接收当前候选双版本的验证引用，不执行固定题。</p></div>${status(issue ? "引用被阻断" : "尚未收到", issue ? "red" : "neutral")}</div>${issueDetails}<div class="empty compact"><span>引</span><h3>${issue ? "等待智能问数修正后重新发送" : update.validationRetryRequested ? "等待新的验证引用" : "尚未收到智能问数验证引用"}</h3><p>${issue ? "请由智能问数按当前候选双版本和已生效合同重新形成引用。" : update.validationRetryRequested ? "智能问数需要形成新的验证运行；原失败引用和重试关系已保留。" : "请先由智能问数完成候选固定题，再返回接收并核对引用。"} 当前正式数据不会改变。</p>${btn(update.validationRetryRequested ? "刷新重试引用" : "接收并核对引用", "check-validation-reference", { primary: true })}</div></section>`;
    }
    const referenceState = validationReferenceState(reference, version, update);
    const passedItems = (reference.items || []).filter(item => item.status === "passed").length;
    const requiredCount = update.validationRequirement?.requiredItemIds?.length || "—";
    const issueDetails = issue ? `<div class="result-banner error compact"><span>!</span><div><b>新收到的验证引用存在冲突</b><p>${esc(issue.reason)}。旧引用不会继续放行采用；等待智能问数重新发送合规引用。</p></div></div>` : "";
    const gateLabel = update.phase === "adopted" && gate.frozenAtAdoption ? "采用时门禁通过" : issue ? "引用被阻断" : gate.passed ? "门禁通过" : referenceState.label;
    return `<section class="panel validation-reference"><div class="panel-head"><div><h2>智能问数验证引用</h2><p>${update.phase === "adopted" && gate.frozenAtAdoption ? "显示正式切换时冻结的只读验证引用与门禁结果。" : "外部结果保持只读；本体只核对完整性、同版、时效和采用门禁。"}</p></div>${status(gateLabel, gate.passed ? "green" : issue ? "red" : referenceState.tone)}</div>${issueDetails}<div class="panel-body"><dl class="definition-grid compact"><dt>来源模块</dt><dd>${esc(reference.sourceModule || "待确认")}</dd><dt>采用合同引用</dt><dd class="mono">${esc(reference.contractCode || "待确认")}</dd><dt>验证依据</dt><dd class="mono">${esc(reference.decisionRef || "待确认")} / CR024</dd><dt>候选语义版本</dt><dd>${esc(reference.semanticVersion || "待确认")} · <span class="mono">${esc(reference.semanticVersionId || "待确认")}</span></dd><dt>候选数据版本</dt><dd class="mono">${esc(reference.dataVersion || "待确认")}</dd><dt>数据截至时间</dt><dd>${esc(reference.asOf || "待确认")}</dd><dt>题集版本</dt><dd class="mono">${esc(reference.questionSetVersion || "待确认")}</dd><dt>题集证据定位</dt><dd class="mono">${esc(reference.questionSetEvidenceLocator || "待确认")}</dd><dt>运行状态</dt><dd>${esc(gate.passed ? update.phase === "adopted" ? "采用时整体通过" : "整体通过，门禁已核对" : issue ? "引用冲突，阻断采用" : referenceState.label)}</dd><dt>完成时间</dt><dd>${esc(reference.completedAt || (referenceState.key === "processing" ? "处理中" : "待确认"))}</dd><dt>证据定位</dt><dd class="mono">${esc(reference.evidenceLocator || "尚未形成")}</dd><dt>运行标识</dt><dd class="mono">${esc(reference.runId || "待确认")}</dd><dt>重试来源</dt><dd class="mono">${esc(reference.retryOf || "首次运行")}</dd></dl><div class="validation-tally"><span><small>锁定必测项</small><b>${requiredCount}</b></span><span><small>已返回</small><b>${(reference.items || []).length}</b></span><span><small>通过</small><b>${passedItems}</b></span></div></div>${renderExternalValidationItems(reference.items)}<div class="gate-checks"><header><div><b>本体门禁核对</b><span>${gate.frozenAtAdoption ? `采用时冻结 · ${esc(gate.checkedAt || "时间待确认")}` : "固定题整体通过只代表其中一项门禁通过"}</span></div>${status(gate.passed ? "门禁通过" : `${gate.issues.length} 项阻断`, gate.passed ? "green" : "red")}</header>${gate.checks.map(check => `<div class="gate-check ${check.pass ? "pass" : "fail"}"><i>${check.pass ? "✓" : "!"}</i><div><b>${esc(check.label)}</b><span>${esc(check.pass ? "符合当前候选" : check.reason)}</span></div></div>`).join("")}</div>${update.phase !== "adopted" && referenceState.key === "processing" ? `<div class="card-actions">${btn("刷新接收状态", "check-validation-reference", { primary: true })}</div>` : update.phase !== "adopted" && !gate.passed ? `<div class="card-actions">${btn("请求智能问数重新验证", "request-validation-retry", { primary: true })}</div>` : ""}</section>`;
  }

  function renderExternalValidationItems(items = []) {
    if (!items.length) return `<div class="external-validation-items empty-row"><b>逐题引用尚未形成</b><span>本体管理不会自行生成题目、结果或证据。</span></div>`;
    return `<div class="external-validation-items"><header><div><b>逐题只读引用</b><span>以下状态和证据定位均由智能问数提供</span></div><em>${items.length} 项</em></header><div>${items.map(item => `<article><span class="mono">${esc(item.id || "稳定身份待确认")}</span>${status(item.status === "passed" ? "通过" : item.status === "failed" ? "失败" : item.status || "待确认", item.status === "passed" ? "green" : item.status === "processing" ? "blue" : "red")}<small class="mono">${esc(item.evidenceLocator || "证据定位缺失")}</small></article>`).join("")}</div></div>`;
  }

  function renderVersionUpdates(version) {
    const update = updateFor(version); const bindings = bindingFor(version); const binding = bindings.current; const previous = bindings.previous;
    const current = isCurrentFormalVersion(version);
    const qualityBlocked = isCurrentFormalBlocked(version); const lifecycleBlocked = !publishedResourceAvailable(version); const blocked = qualityBlocked || lifecycleBlocked; const priorCombination = previousTrustedCombination(version);
    const bindingStatus = qualityBlocked ? status("正式输出已阻断", "red") : lifecycleBlocked ? status(`业务状态：${businessValidityStateOf(version)}`, "red") : current ? status("正在服务", "green") : binding ? status("历史正式记录", "neutral") : status("尚未形成", "amber");
    const bindingLabel = current ? "当前正式数据" : binding ? "历史正式数据" : "当前正式数据";
    const validationGate = update ? validationGateForDisplay(version, update) : null;
    const validationBlockedNow = !!update && ["verified", "switch_failed"].includes(update.phase) && !validationGate?.passed;
    const steps = [
      ["收到待更新数据", !!update],
      ["检查数据与本体是否匹配", !!update?.matchResult && update.matchResult.status === "passed"],
      ["具备消费验证条件", !!update?.eligibility && update.eligibility.status === "eligible"],
      ["接收并核对智能问数验证引用", !!validationGate?.passed],
      ["切换为正式数据", update?.phase === "adopted"]
    ];
    return `<div class="updates-layout">
      ${renderRefreshTargetSection(version)}
      ${qualityBlocked ? `<div class="result-banner error"><span>!</span><div><b>当前正式数据发现硬质量问题</b><p>${esc(qualityIncidentFor(version)?.reason || "当前正式数据不再满足质量门槛")}。新的正式输出已停止，历史证据保持不变。</p></div>${priorCombination ? btn("回退上一可信版本", "open-combination-rollback", { primary: true }) : status("无安全组合", "red")}</div>` : lifecycleBlocked ? `<div class="result-banner error"><span>!</span><div><b>业务有效状态阻断新的正式切换</b><p>当前版本已经发布，但业务有效状态为${esc(businessValidityStateOf(version))}；历史记录继续保留，不能形成新的正式数据组合。</p></div>${btn("创建修订 Draft", `clone-version:${version.id}`, { primary: true })}</div>` : ""}
      ${update?.phase === "match_incompatible" ? `<div class="result-banner error"><span>!</span><div><b>待更新数据与本体不兼容</b><p>${esc(update.failure)}。当前正式版本继续服务；请从精确位置显式修正映射并形成新 Published 版本。</p></div>${btn("创建修正 Draft", "open-fix-update", { primary: true })}</div>` : ""}
      ${update?.phase === "match_failed" ? `<div class="result-banner error"><span>!</span><div><b>数据与本体匹配检查失败</b><p>${esc(update.failure)}。当前正式版本继续服务；可关联原结果重新检查。</p></div>${btn("重新检查", "retry-match", { primary: true })}</div>` : ""}
      ${update?.phase === "match_unknown" ? `<div class="result-banner warning"><span>!</span><div><b>数据与本体匹配结果未知</b><p>${esc(update.failure)}。当前正式版本继续服务；在取得明确结果前不会形成消费验证资格。</p></div>${btn("重新检查", "retry-match", { primary: true })}</div>` : ""}
      ${update?.phase === "verify_failed" ? `<div class="result-banner error"><span>!</span><div><b>智能问数验证引用阻断采用</b><p>${esc(update.failure || "未取得完整、同版且有效的验证引用")}。本体不会改写或补算外部结果，当前正式数据保持不变。</p></div>${btn("请求重新验证", "request-validation-retry", { primary: true })}</div>` : ""}
      ${validationBlockedNow ? `<div class="result-banner error"><span>!</span><div><b>智能问数验证引用已失效</b><p>${esc(validationGate?.issues?.[0] || "验证引用不再满足当前采用门禁")}。当前正式数据保持不变。</p></div>${btn("请求重新验证", "request-validation-retry", { primary: true })}</div>` : ""}
      ${update?.phase === "switch_failed" && !validationBlockedNow ? `<div class="result-banner error"><span>!</span><div><b>正式切换未完成</b><p>${esc(update.failure || "受控切换失败")}。${binding ? `仍继续使用 ${esc(binding.semanticVersion)} ＋ ${esc(binding.dataVersion)}。` : "当前仍无正式使用版本。"}</p></div>${btn("重新切换", "open-adopt", { primary: true })}</div>` : ""}
      <section class="panel update-current"><div class="panel-head"><div><h2>正式数据状态</h2><p>检查或刷新成功不会自动改变这里。</p></div>${bindingStatus}</div><div class="binding-cards"><article><span>${bindingLabel}</span><b>${binding ? esc(binding.dataVersion) : "尚未切换"}</b><p>${binding ? `数据截至 ${esc(binding.asOf)} · ${esc(binding.switchedAt)} 切换${current ? "" : " · 仅供历史追溯"}` : "完成业务消费验证并人工确认后形成。"}</p></article><article><span>${current ? "上一可信版本" : binding ? "历史上一可信版本" : "上一可信版本"}</span><b>${priorCombination ? `${esc(priorCombination.semanticVersion)} ＋ ${esc(priorCombination.dataVersion)}` : previous && !isCombinationBlocked({ versionId: version.id, dataVersion: previous.dataVersion }) ? esc(previous.dataVersion) : "暂无"}</b><p>${priorCombination ? `数据截至 ${esc(priorCombination.asOf)} · 可用于完整版本回退` : previous && !isCombinationBlocked({ versionId: version.id, dataVersion: previous.dataVersion }) ? `数据截至 ${esc(previous.asOf)} · ${current ? "可用于同语义版本数据回退" : "仅供历史追溯"}` : "形成第二个正式版本后自动保留。"}</p>${current && !blocked && previous && !isCombinationBlocked({ versionId: version.id, dataVersion: previous.dataVersion }) ? btn("回退到此数据", "open-rollback", { small: true }) : ""}</article></div></section>
      <section class="panel update-flow"><div class="panel-head"><div><h2>数据更新</h2><p>每一步都有独立状态；失败时继续使用当前正式数据。</p></div>${update ? status(updatePhaseLabel(update, version), validationBlockedNow || ["match_failed", "match_incompatible", "verify_failed", "switch_failed"].includes(update.phase) ? "red" : update.phase === "match_unknown" ? "amber" : update.phase === "adopted" ? "green" : "blue") : status("等待数据工程提交", "neutral")}</div>
        ${update ? `<div class="incoming-card"><div><span>D</span><div><b>${esc(update.dataVersion)}</b><p>数据截至 ${esc(update.asOf)} · 请求 ${esc(update.requestId || "标识缺失")}</p><small class="mono">${esc(update.requestEvidenceLocator || "证据定位缺失")}</small></div></div>${updateAction(version, update)}</div>` : `<div class="empty compact"><span>↻</span><h3>尚未收到待更新数据</h3><p>由数据工程针对当前精确语义版本提交刷新请求后，才会进入匹配检查。本体管理不会自行生成候选数据。</p>${btn("刷新接收状态", "refresh-external-inputs", { primary: true })}</div>`}
        <div class="stepper">${steps.map(([label, done], index) => `<div class="${done ? "done" : ""} ${update && ((index === 0 && update.phase === "received") || (index === 1 && ["matching", "match_failed", "match_incompatible", "match_unknown"].includes(update.phase)) || (index === 3 && (["verifying", "verification_pending", "verify_failed"].includes(update.phase) || validationBlockedNow)) || (index === 4 && ["switching", "switch_failed"].includes(update.phase) && !validationBlockedNow)) ? "active" : ""}"><i>${done ? "✓" : index + 1}</i><span>${esc(label)}</span></div>`).join("")}</div>
      </section>
      ${renderCandidateValidationEvidence(version, update)}
      <section class="panel"><div class="panel-head"><div><h2>恢复方式</h2><p>失败不会覆盖当前正式数据。</p></div></div><div class="recovery-grid"><article><b>匹配失败</b><p>从当前版本创建修正 Draft，在对象字段映射中显式重新映射后再发布。</p></article><article><b>验证引用失败</b><p>保留外部运行与证据定位，继续使用当前正式数据；由智能问数形成关联重试后再检查。</p></article><article><b>正式切换失败</b><p>不修改当前正式组合；无正式组合时继续保持未形成，满足门禁后可关联重试。</p></article><article><b>采用后质量失败</b><p>${current ? (priorCombination ? "收到数据工程质量阻断事实后停止新正式输出，并可确认回退完整的上一可信版本。" : "收到数据工程质量阻断事实后停止新正式输出；没有安全组合时保持不可消费。") : binding ? "历史版本只保留质量事实、切换与回退证据。" : "形成正式版本后才可能进入事故恢复。"}</p></article></div><div class="boundary-note"><b>质量事实来自数据工程</b><p>本体管理只读接收精确正式组合的质量阻断或恢复事实，不在此登记、改写或补算。</p></div></section>
    </div>`;
  }

  function updateAction(version, update) {
    if (update.phase === "received") return btn("检查数据与本体是否匹配", "run-match", { primary: true });
    if (update.phase === "matching") return btn("检查中", "noop", { disabled: true });
    if (update.phase === "match_incompatible") return btn("查看并创建修正 Draft", "open-fix-update", { primary: true });
    if (["match_failed", "match_unknown"].includes(update.phase)) return btn("重新检查", "retry-match", { primary: true });
    if (update.phase === "eligible") return btn(update.validationRetryRequested ? "刷新重试引用" : "接收并核对引用", "check-validation-reference", { primary: true });
    if (update.phase === "verifying") return btn("检查中", "noop", { disabled: true });
    if (update.phase === "verification_pending") return btn("刷新接收状态", "check-validation-reference", { primary: true });
    if (update.phase === "verify_failed") return btn("请求重新验证", "request-validation-retry", { primary: true });
    if (update.phase === "verified") return candidateValidationGate(version, update).passed ? btn("切换为正式数据", "open-adopt", { primary: true }) : btn("重新验证", "request-validation-retry", { primary: true });
    if (update.phase === "switching") return btn("切换中", "noop", { disabled: true });
    if (update.phase === "switch_failed") return candidateValidationGate(version, update).passed ? btn("重新切换", "open-adopt", { primary: true }) : btn("重新验证", "request-validation-retry", { primary: true });
    return update.phase === "adopted" ? status("等待下一次数据工程请求", "neutral") : status("已处理", "green");
  }

  function renderVersionRecords(version) {
    const records = state.recordsByVersion[version.id] || [];
    const requestedRecordId = routeParams().get("record");
    const requestedEvidence = routeParams().get("evidence");
    const focusedRecord = records.find(record => (requestedRecordId && record.id === requestedRecordId) || (requestedEvidence && record.evidenceCode === requestedEvidence)) || null;
    const focusNotice = requestedRecordId || requestedEvidence
      ? focusedRecord
        ? `<div class="evidence-focus"><div><span>已定位受控证据</span><b>${esc(focusedRecord.title)}</b><small class="mono">${esc(focusedRecord.evidenceCode || focusedRecord.id)}</small></div>${btn("查看详情", `open-record:${version.id}:${focusedRecord.id}`, { primary: true, small: true })}</div>`
        : `<div class="result-banner error compact"><span>!</span><div><b>证据无法定位</b><p>该记录不属于当前精确 Published 版本，系统不会按相似编号或名称自动替代。</p></div></div>`
      : "";
    return `<section class="panel"><div class="panel-head"><div><h2>记录与证据</h2><p>只展示 ${esc(version.semanticVersion)} 相关的发布、更新、验证、切换、失败、重试和回退记录。</p></div></div>${focusNotice}${records.length ? `<div class="record-list">${records.slice().reverse().map(record => `<article class="${focusedRecord?.id === record.id ? "focused" : ""}"><span class="record-dot ${record.tone || ""}"></span><div><b>${esc(record.title)}</b><p>${esc(record.detail)}</p><small>${esc(record.time)}</small></div>${status(record.status, record.tone || "neutral")}${btn("查看详情", `open-record:${version.id}:${record.id}`, { small: true })}</article>`).join("")}</div>` : `<div class="empty compact"><span>证</span><h3>暂无版本记录</h3><p>执行发布后的数据更新和切换操作后，记录会归入当前精确语义版本。</p></div>`}</section>`;
  }

  function renderPublishedResource() {
    const version = selectedVersion(); const id = routeParams().get("id"); const resource = version ? publishedResources(version).find(r => r.id === id) : null;
    if (!version) return renderMissingPublishedVersion();
    if (!resource) return renderMissingPublishedResource(version);
    const tab = routeParams().get("tab") || "overview";
    const tabs = [["overview", "概览"], ["structure", "定义与结构"], ["mapping", "映射与依赖"], ["lineage", "沿袭与消费"], ["history", "版本记录"]];
    return `<div class="page-scroll resource-detail">${pageHeader(resource.name, `${resource.type} · ${esc(version.semanticVersion)}`, btn("返回资源与模型", `open-version-tab:${version.id}:resources`), "Published 资源")}
      <div class="resource-identity published"><div><span>业务名称</span><b>${esc(resource.name)}</b></div><div><span>资源类型</span><b>${esc(resource.type)}</b></div><div><span>追溯标识</span><b class="mono">${esc(resource.id)}</b></div><div><span>精确已发布版本</span><b>${esc(version.semanticVersion)}</b></div><div><span>适用场景</span><b>${esc(resolvedExternalValue(resource.applicableScenario) ? resource.applicableScenario : scenarioDisplayLabel(version))}</b></div><div><span>发布状态</span><b>${esc(localizeUiText(publicationStateOf(resource)))}</b></div><div><span>业务有效状态</span><b>${esc(businessValidityStateOf(resource))}</b></div><div><span>可供新消费配置</span><b>${esc(newBindingStateOf(resource, version))}</b></div><div><span>责任人</span><b>${esc(resource.owner || "待确认")}</b></div></div>
      <nav class="tabs">${tabs.map(([key, label]) => `<button class="${tab === key ? "active" : ""}" data-action="published-resource-tab:${key}">${esc(label)}</button>`).join("")}</nav>
      ${renderPublishedResourceTab(version, resource, tab)}
    </div>`;
  }

  function publishedResourceReferences(version, resource) {
    const all = publishedResources(version);
    const byId = new Map(all.map(item => [item.id, item]));
    const ids = new Set();
    if (resource.kind === "object") {
      resource.properties.forEach(property => ids.add(property.id));
      version.links.filter(link => link.source === resource.id || link.target === resource.id).forEach(link => ids.add(link.id));
      version.metrics.filter(metric => metric.sourceObjectId === resource.id || metric.subjectObjectId === resource.id).forEach(metric => ids.add(metric.id));
      version.rules.filter(rule => rule.objectId === resource.id).forEach(rule => ids.add(rule.id));
      version.actions.filter(action => action.targetObjectId === resource.id).forEach(action => ids.add(action.id));
    } else if (resource.kind === "property") {
      ids.add(resource.parentId);
      version.metrics.filter(metric => (metric.dependencyIds || []).includes(resource.id)).forEach(metric => ids.add(metric.id));
      version.links.filter(link => link.sourceEndpoint?.id === resource.id || link.targetEndpoint?.id === resource.id).forEach(link => ids.add(link.id));
    } else if (resource.kind === "link") {
      [resource.source, resource.target, resource.sourceEndpoint?.id, resource.targetEndpoint?.id].filter(Boolean).forEach(id => ids.add(id));
      version.metrics.filter(metric => (metric.dependencyIds || []).includes(resource.id)).forEach(metric => ids.add(metric.id));
      version.actions.filter(action => (action.linkIds || []).includes(resource.id)).forEach(action => ids.add(action.id));
    } else if (resource.kind === "metric") {
      [resource.sourceObjectId, resource.subjectObjectId, ...(resource.dependencyIds || [])].filter(Boolean).forEach(id => ids.add(id));
      version.rules.filter(rule => (rule.metricIds || []).includes(resource.id)).forEach(rule => ids.add(rule.id));
    } else if (resource.kind === "rule") {
      [resource.objectId, ...(resource.metricIds || [])].filter(Boolean).forEach(id => ids.add(id));
      version.actions.filter(action => (action.ruleIds || []).includes(resource.id)).forEach(action => ids.add(action.id));
    } else if (resource.kind === "action") {
      [resource.targetObjectId, ...(resource.ruleIds || []), ...(resource.linkIds || [])].filter(Boolean).forEach(id => ids.add(id));
    }
    return [...ids].map(id => byId.get(id)).filter(Boolean);
  }

  function publishedStructureFacts(resource, frozenMember) {
    let facts = "";
    if (resource.kind === "object") facts = `<dt>对象范围</dt><dd>${esc(resource.definition)}</dd><dt>身份 Property</dt><dd>${esc(propertyName(resource, resource.identity))}</dd><dt>标题 Property</dt><dd>${esc(propertyName(resource, resource.title))}</dd><dt>允许 Property</dt><dd>${esc(resource.properties.map(property => property.name).join("、") || "无")}</dd><dt>Property 数量</dt><dd>${resource.properties.length}</dd><dt>实例粒度</dt><dd>${esc(frozenMember?.grain || "无直接成员")}</dd>`;
    if (resource.kind === "property") facts = `<dt>所属 Object</dt><dd>${esc(resource.parentName)}</dd><dt>数据类型</dt><dd>${esc(resource.dataType)}</dd><dt>业务单位</dt><dd>${esc(resource.unit || "—")}</dd><dt>语义角色</dt><dd>${esc(resource.role)}</dd><dt>允许为空</dt><dd>${esc(resource.nullable)}</dd><dt>空值解释</dt><dd>${resource.nullable === "否" ? "缺失时阻断相关对象或关系" : "缺失表示该事实未知，不按零值解释"}</dd><dt>时间语义</dt><dd>随数据资产截至时间解释</dd><dt>来源字段</dt><dd>${esc(resource.sourceField || "未映射")}</dd>`;
    if (resource.kind === "link") facts = `<dt>正向业务名称</dt><dd>${esc(resource.name)}</dd><dt>反向业务名称</dt><dd>${esc(resource.reverseName || "未配置")}</dd><dt>关系方向</dt><dd>${esc(resource.sourceName)} → ${esc(resource.targetName)}</dd><dt>允许导航方向</dt><dd>${esc(resource.allowedDirection || "未配置")}</dd><dt>可发现范围</dt><dd>${esc(resource.discoveryScope || "待确认")}</dd><dt>适用场景</dt><dd>${esc(resource.applicableScenario || "待确认")}</dd><dt>发现状态</dt><dd>${esc(resource.discoverability || "待确认")}</dd><dt>基数</dt><dd>${esc(resource.cardinality)}</dd><dt>关系覆盖</dt><dd>${esc(resource.coverage || "等待覆盖摘要")}</dd><dt>起点引用</dt><dd class="mono">${resource.sourceEndpoint?.kind === "property" ? "Property" : "资产字段"} · ${esc(resource.sourceEndpoint?.id)}</dd><dt>起点字段</dt><dd>${esc(resource.sourceEndpointLabel || "")} · ${esc(resource.sourceEndpointType || "")}</dd><dt>终点引用</dt><dd class="mono">${resource.targetEndpoint?.kind === "property" ? "Property" : "资产字段"} · ${esc(resource.targetEndpoint?.id)}</dd><dt>终点字段</dt><dd>${esc(resource.targetEndpointLabel || "")} · ${esc(resource.targetEndpointType || "")}</dd><dt>兼容状态</dt><dd>${resource.endpointCompatible === false ? "端点不兼容" : "两端兼容"}</dd>`;
    if (resource.kind === "metric") facts = `<dt>适用 Object</dt><dd class="mono">${esc(resource.subjectObjectId || resource.sourceObjectId || "未配置")}</dd><dt>计算口径</dt><dd>${esc(resource.calculation || "按已配置依赖计算")}</dd><dt>单位</dt><dd>${esc(resource.unit)}</dd><dt>时间语义</dt><dd>${esc(resource.time)}</dd><dt>适用范围</dt><dd>${esc(resource.scope)}</dd><dt>结果状态</dt><dd>可计算、无数据、零分母、无法判断</dd><dt>零分母或无数据</dt><dd>${esc(resource.zeroHandling)}</dd><dt>精确依赖</dt><dd class="mono">${esc((resource.dependencyIds || []).join("、"))}</dd><dt>定义</dt><dd>${esc(resource.definition)}</dd>`;
    if (resource.kind === "rule") facts = `<dt>适用对象</dt><dd>${esc(resource.appliesTo)}</dd><dt>判断条件</dt><dd>${esc(resource.condition)}</dd><dt>有效期</dt><dd>${esc(resource.validity || "未配置")}</dd><dt>结果状态</dt><dd>命中、未命中、无法判断</dd><dt>命中解释</dt><dd>返回触发条件、指标值、阈值和精确证据范围</dd><dt>测试样例</dt><dd>${esc(resource.testSample || "未配置")}</dd><dt>机构排序</dt><dd>${esc(resource.bankRanking || "未配置")}</dd><dt>依赖 Metric</dt><dd>${esc(resource.dependency)}</dd><dt>证据要求</dt><dd>${esc(resource.evidence)}</dd>`;
    if (resource.kind === "action") facts = `<dt>目标对象</dt><dd>${esc(resource.target)}</dd><dt>允许请求入口</dt><dd>获准消费者引用本精确版本 Action Type 发起标准行动申请</dd><dt>必要参数</dt><dd>${esc(resource.parameters || resource.inputs)}</dd><dt>前置证据</dt><dd>${esc(resource.prerequisite)}</dd><dt>预期结果</dt><dd>${esc(resource.result)}</dd><dt>失败表现</dt><dd>${esc(resource.failure || "未配置")}</dd><dt>默认办理期限</dt><dd>${esc(resource.defaultDue || "未配置")}</dd><dt>有效期</dt><dd>随本 Published 语义版本有效</dd><dt>确认要求</dt><dd>${esc(resource.confirmation || resource.requirement)}</dd>`;
    if (resource.businessBasis === "recommended") facts += `<dt>业务口径状态</dt><dd>推荐基线 · 等待业务确认（${esc((resource.decisionRefs || []).join("、"))}）</dd>`;
    if (resource.businessBasis === "unknown") facts += `<dt>业务口径状态</dt><dd>待确认 · 不可新绑定</dd>`;
    const terms = { ...defaultTerms(resource), ...(resource.terms || {}) };
    return `${facts}<dt>首选业务名称</dt><dd>${esc(terms.preferredName)}</dd><dt>同义词</dt><dd>${esc((terms.synonyms || []).join("、") || "无")}</dd><dt>缩写</dt><dd>${esc(terms.abbreviation || "无")}</dd><dt>不推荐表达</dt><dd>${esc(terms.discouraged || "无")}${terms.discouragedReason ? ` · ${esc(terms.discouragedReason)}` : ""}</dd>`;
  }

  function renderPublishedResourceTab(version, resource, tab) {
    const contract = versionDataContract(version);
    const frozenMember = contractMember(contract, resource.memberId);
    const dependencyIds = resource.kind === "link" ? [resource.sourceEndpoint?.id, resource.targetEndpoint?.id].filter(Boolean) : resource.kind === "metric" ? (resource.dependencyIds || []) : resource.kind === "rule" ? (resource.metricIds || []) : resource.kind === "action" ? [resource.targetObjectId, ...(resource.ruleIds || []), ...(resource.linkIds || [])].filter(Boolean) : [];
    const references = publishedResourceReferences(version, resource);
    const replacement = resourceReplacementContext(version, resource);
    const replacesLabel = replacement.replaces.map(replacementReferenceLabel).join("、") || "无";
    const replacedByLabel = replacement.replacedBy.map(replacementReferenceLabel).join("、") || "无";
    if (tab === "overview") {
      const binding = historicalBindingFor(version);
      const current = isCurrentFormalVersion(version);
      const blocked = isCurrentFormalBlocked(version) || !publishedResourceAvailable(version);
      const assessment = versionContextAssessment(version);
      const consumption = blocked
        ? `<div class="big-status failure"><span>!</span><b>不可消费</b><p>${esc(isCurrentFormalBlocked(version) ? qualityIncidentFor(version)?.reason || "当前正式数据存在质量阻断" : `当前语义版本业务有效状态为${businessValidityStateOf(version)}`)}；历史证据仍可追溯。</p></div>`
        : current && assessment.complete
          ? `<div class="big-status success"><span>✓</span><b>智能问数上下文可用</b><p>其他消费方仍按各自验证与兼容状态只读引用。</p></div>`
          : current
            ? `<div class="big-status waiting"><span>…</span><b>正式版本已锁定，消费上下文未完整</b><p>${esc(assessment.detail)}</p></div>`
        : binding
          ? `<div class="big-status waiting"><span>↺</span><b>历史正式记录</b><p>不再承接当前消费；旧报告与历史证据仍可按本版本追溯。</p></div>`
          : `<div class="big-status waiting"><span>…</span><b>待正式数据启用</b><p>发布时映射合同已经冻结，尚未完成待更新数据检查、业务消费验证和人工切换。</p></div>`;
      return `<div class="two-col"><section class="panel"><div class="panel-head"><div><h2>业务摘要</h2><p>面向消费方的只读定义。</p></div></div><div class="panel-body"><p class="lead">${esc(resource.definition || resource.requirement || resource.evidence || "已发布语义资源。")}</p><dl class="definition-grid"><dt>业务名称</dt><dd>${esc(resource.name)}</dd><dt>追溯标识</dt><dd class="mono">${esc(resource.id)}</dd><dt>资源类型</dt><dd>${esc(resource.type || TYPE_LABEL[resource.kind] || "待确认")}</dd><dt>适用场景</dt><dd>${esc(resolvedExternalValue(resource.applicableScenario) ? resource.applicableScenario : scenarioDisplayLabel(version))}</dd><dt>所属已发布版本</dt><dd>${esc(version.semanticVersion)} · <span class="mono">${esc(version.id)}</span></dd><dt>发布状态</dt><dd>${esc(localizeUiText(publicationStateOf(resource)))}</dd><dt>业务有效状态</dt><dd>${esc(businessValidityStateOf(resource))}</dd><dt>业务生效时间</dt><dd>${esc(humanDateTime(resource.effectiveFrom))}</dd><dt>业务失效时间</dt><dd>${esc(resource.effectiveTo ? humanDateTime(resource.effectiveTo) : "未预设失效时间")}</dd><dt>可供新消费配置</dt><dd>${esc(newBindingStateOf(resource, version))}</dd><dt>责任人</dt><dd>${esc(resource.owner || "待确认")}</dd><dt>本版本变更</dt><dd>${esc(resource.changeType || "待确认")} · ${esc(resource.changeReason || "待确认")}</dd><dt>替代资源</dt><dd class="mono">${esc(replacesLabel)}</dd><dt>被替代为</dt><dd class="mono">${esc(replacedByLabel)}</dd><dt>最近变更时间</dt><dd>${esc(resource.lastChangedAt || "待确认")}</dd><dt>受控证据定位</dt><dd><span class="mono">${esc(resource.controlledEvidenceLocator || "待确认")}</span> ${resource.controlledEvidenceLocator && resource.controlledEvidenceLocator !== "待确认" ? btn("查看证据", `open-evidence:resource:${version.id}:${resource.id}`, { small: true }) : ""}</dd></dl></div></section><section class="panel"><div class="panel-head"><div><h2>消费状态</h2><p>发布状态、业务有效状态、正式数据启用与消费方兼容状态分别记录。</p></div></div><div class="panel-body">${consumption}</div></section></div>`;
    }
    if (tab === "structure") return `<section class="panel"><div class="panel-head"><div><h2>${esc(resource.type)} 定义与结构</h2><p>显示名称不作为绑定身份；术语随本精确版本冻结。</p></div></div><div class="panel-body"><dl class="definition-grid">${publishedStructureFacts(resource, frozenMember)}</dl></div></section>`;
    if (tab === "mapping") return `<section class="panel"><div class="panel-head"><div><h2>映射与依赖</h2><p>发布时冻结的语义合同。</p></div>${status("不可变", "green")}</div><div class="dependency-map"><div><span>数据资产</span><b>${esc(contract?.assetName || "未冻结")}</b><small>${esc(contract?.assetVersion || "未冻结")} · 截至 ${esc(contract?.asOf || "未冻结")}</small></div><i>→</i><div><span>${frozenMember ? "数据资产成员" : "稳定语义依赖"}</span><b>${esc(frozenMember?.name || dependencyIds.join("、") || resource.sourceField || "无直接依赖")}</b><small>${esc(resource.id)}</small></div><i>→</i><div><span>当前资源</span><b>${esc(resource.name)}</b><small>${esc(version.semanticVersion)}</small></div></div><div class="reference-list">${references.length ? references.map(item => `<article><span class="type-${esc(item.kind)}">${item.kind === "action" ? "A" : item.kind[0].toUpperCase()}</span><div><b>${esc(item.name)}</b><small class="mono">${esc(item.id)}</small></div>${btn("查看详情", `open-published-resource:${version.id}:${item.id}`, { small: true })}</article>`).join("") : `<div class="dependency-empty">没有其他直接语义依赖</div>`}</div></section>`;
    if (tab === "lineage") {
      const binding = historicalBindingFor(version);
      const bindingLabel = isCurrentFormalVersion(version) ? "当前正式数据" : binding ? "历史正式数据" : "正式数据";
      const consumerRows = ["智能问数", "决策中心", "Agent 应用", "报告中心"].map(name => {
        const consumer = consumerStatusFor(version, name);
        return `<article><b>${esc(name)}</b><span>${esc(consumer.detail)}</span>${status(consumer.label, consumer.tone)}</article>`;
      }).join("");
      return `<section class="panel"><div class="panel-head"><div><h2>沿袭与消费</h2><p>发布时映射合同与正式消费数据分别保留精确版本。</p></div>${btn("查看完整证据", `open-evidence:resource:${version.id}:${resource.id}`)}</div><div class="lineage-chain"><div><b>发布时映射版本</b><span>${esc(contract?.assetVersion || "未冻结")} · ${esc(contract?.asOf || "")}</span></div><i>→</i><div><b>直接依赖</b><span>${esc(references.map(item => item.name).join("、") || "无直接依赖")}</span></div><i>→</i><div><b>Published 资源</b><span>${esc(resource.id)} · ${esc(version.semanticVersion)}</span></div><i>→</i><div><b>${bindingLabel}</b><span>${esc(binding?.dataVersion || "尚未切换")} ${binding?.asOf ? `· ${esc(binding.asOf)}` : ""}</span></div></div><dl class="definition-grid compact"><dt>证据责任位置</dt><dd>本体管理维护语义定义与版本定位；数据资产来源与质量证据由数据工程提供；消费运行证据由各消费模块提供</dd><dt>受控语义证据定位</dt><dd class="mono">${esc(resource.controlledEvidenceLocator || "待确认")}</dd><dt>正式消费定位</dt><dd class="mono">${esc(resource.id)} · ${esc(version.semanticVersion)} · ${esc(binding?.dataVersion || "未形成正式数据")}</dd></dl><div class="consumer-list resource-consumers">${consumerRows}</div></section>`;
    }
    return `<section class="panel"><div class="panel-head"><div><h2>版本记录</h2><p>旧正式报告和消费证据可以继续回到本版本定义。</p></div></div><div class="history-row"><span>${esc(resource.changeType || "Published")}</span><div><b>${esc(version.semanticVersion)}</b><p>${esc(resource.changeReason || "待确认")}</p><small class="mono">${esc(resource.controlledEvidenceLocator || "待确认")}</small></div><time>${esc(resource.lastChangedAt || version.publishedAt)}</time></div>${replacement.replaces.length ? `<div class="history-row"><span>替代</span><div><b>${esc(replacesLabel)}</b><p>由本版本资源显式声明；不会按显示名称自动映射。</p></div></div>` : ""}${replacement.replacedBy.length ? `<div class="history-row"><span>后续替代</span><div><b>${esc(replacedByLabel)}</b><p>从后续 Published 版本的显式声明只读反查；当前历史快照未被改写。</p></div></div>` : ""}${version.basedOnVersion ? `<div class="history-row"><span>来源</span><div><b>${esc(version.basedOnVersion)}</b><p>本版本由上一正式版本创建修订 Draft 后发布；同名资源不会自动替代本资源。</p></div></div>` : ""}</section>`;
  }

  function editResource(kind) {
    const resource = findDraftResource(activeDraft(), ui.editResourceId);
    return resource?.kind === kind ? resource : null;
  }

  function codePart(id, prefix) {
    return String(id || "").replace(new RegExp(`^${prefix}-`), "");
  }

  function selectedOption(value, selected) { return value === selected ? "selected" : ""; }

  function capturePropertyForm() {
    if (!document.getElementById("property-name")) return;
    ui.propertyForm = {
      name: document.getElementById("property-name")?.value || "",
      dataType: document.getElementById("property-type")?.value || "文本",
      code: document.getElementById("property-code")?.value || "",
      unit: document.getElementById("property-unit")?.value || "—",
      nullable: document.getElementById("property-nullable")?.value || "是",
      definition: document.getElementById("property-definition")?.value || ""
    };
  }

  function renderDataAssetReceptionEvidence() {
    const context = currentScenarioContext();
    const rootReceipt = acceptedScenarioContextReceipt(context);
    const receipts = Object.values(state.dataAssetDeliveryReceipts || {})
      .filter(receipt => receipt?.contractCode === "C003")
      .sort((left, right) => String(right.receivedAt || "").localeCompare(String(left.receivedAt || ""), "zh-CN"));
    const issueEvents = (state.externalDeliveryIssues || [])
      .filter(issue => {
        if (issue?.kind !== "C003") return false;
        const recorded = issue.deliveryId ? state.dataAssetDeliveryReceipts?.[issue.deliveryId] || null : null;
        return !recorded || recorded.status === "accepted" || recorded.reason !== issue.reason;
      })
      .sort((left, right) => String(right.receivedAt || "").localeCompare(String(left.receivedAt || ""), "zh-CN"));
    const lookup = ui.deliveryLookupPerformed ? dataAssetDeliveryLookup(ui.deliveryLookupId) : null;
    const receiptRows = receipts.length
      ? receipts.map(receipt => {
        const currentRun = sameScenarioEnvelope(receipt, context);
        const accepted = receipt.status === "accepted";
        return `<article class="delivery-receipt-row ${accepted ? "accepted" : "rejected"}"><div class="delivery-receipt-head"><div><b class="mono">${esc(receipt.deliveryId || "交付标识缺失")}</b><small>${esc(receipt.assetVersion || "精确数据版本缺失")} · ${currentRun ? "当前场景轮次" : "历史场景轮次"}</small></div>${status(accepted ? "已接收" : "已拒绝", accepted ? "green" : "red")}</div><dl><dt>场景身份</dt><dd><span class="mono">${esc(receipt.scenarioContext?.scenarioId || "缺失")}</span> / <span class="mono">${esc(receipt.scenarioContext?.scenarioVersion || "缺失")}</span></dd><dt>场景轮次</dt><dd class="mono">${esc(receipt.scenarioContext?.scenarioRunId || "缺失")}</dd><dt>形成时间</dt><dd>${esc(receipt.scenarioContext?.formedAt || "缺失")}</dd><dt>场景状态</dt><dd>${esc(receipt.scenarioContext?.status || "缺失")}</dd><dt>精确数据合同</dt><dd><span class="mono">${esc(receipt.t006Id || receipt.assetId || "T006 缺失")}</span> · <span class="mono">${esc(receipt.t007Version || receipt.assetVersion || "T007 缺失")}</span> · 截至 ${esc(receipt.t008AsOf || receipt.asOf || "T008 缺失")}</dd><dt>接收时间</dt><dd>${esc(receipt.receivedAt || "未记录")}</dd><dt>目标 Draft</dt><dd>${receipt.targetDraftId ? `<span class="mono">${esc(receipt.targetDraftId)}</span> · R${esc(receipt.targetDraftRevision)}` : "未形成"}</dd><dt>结果说明</dt><dd>${esc(receipt.reason || "合同校验通过，等待用户选择资产成员。")}</dd><dt>证据定位</dt><dd class="mono">${esc(receipt.evidenceLocator || "未提供")}</dd></dl></article>`;
      }).join("")
      : `<div class="delivery-receipt-empty"><b>尚未形成可定位接收回执</b><p>本体管理未实际收到数据资产交付时，状态保持未知，不会写成已拒绝或已接收。请数据工程按当前场景轮次重新发送后刷新。</p></div>`;
    const issueRows = issueEvents.length ? `<section class="delivery-issue-list"><header><b>接收异常记录</b><span>${issueEvents.length} 条</span></header>${issueEvents.map(issue => `<article><div><b class="mono">${esc(issue.deliveryId || "未提供稳定交付标识")}</b><small>${esc(issue.assetVersion || "精确数据版本缺失")} · ${esc(issue.scenarioContext?.scenarioRunId || "场景轮次缺失")}</small></div>${status("已阻断", "red")}<p>${esc(issue.reason || "交付合同未通过核验")}</p><small>${esc(issue.receivedAt || "未记录时间")} · ${esc(issue.evidenceLocator || "证据定位未提供")}</small></article>`).join("")}</section>` : "";
    const lookupTone = lookup?.readStatus === "found" ? lookup.receipt?.status === "accepted" ? "green" : "red" : lookup?.readStatus === "issue_only" ? "red" : "neutral";
    const lookupLabel = lookup?.readStatus === "found" ? lookup.receipt?.status === "accepted" ? "已接收" : "已拒绝" : lookup?.readStatus === "issue_only" ? "已定位异常" : lookup?.readStatus === "unknown" ? "未找到记录" : "等待查询";
    const lookupResult = lookup ? `<div class="delivery-lookup-result ${esc(lookup.readStatus)}"><div><span>查询结果</span>${status(lookupLabel, lookupTone)}</div><dl><dt>稳定交付标识</dt><dd class="mono">${esc(lookup.deliveryId || "未提供")}</dd><dt>回执状态</dt><dd>${esc(lookup.receipt?.status || "无接收或拒绝回执")}</dd><dt>场景轮次</dt><dd class="mono">${esc(lookup.receipt?.scenarioContext?.scenarioRunId || lookup.evidenceScenarioContext?.scenarioRunId || "无法从本体记录证明")}</dd><dt>结果说明</dt><dd>${esc(lookup.receipt?.reason || lookup.reason || "已定位持久化回执")}</dd><dt>观察时间</dt><dd>${esc(lookup.observedAt)}</dd></dl></div>` : "";
    const lookupBox = `<div class="delivery-lookup"><label for="delivery-receipt-query">按稳定交付标识核对</label><div><input id="delivery-receipt-query" value="${esc(ui.deliveryLookupId)}" placeholder="输入 deliveryId" autocomplete="off" />${btn("查询记录", "lookup-data-asset-delivery", { primary: true })}</div><small>未找到记录仅表示本体管理没有持久化该次交付，不会自动写成已拒绝。</small>${lookupResult}</div>`;
    const summaryLabel = receipts.length || issueEvents.length ? `${receipts.length} 条回执${issueEvents.length ? ` · ${issueEvents.length} 条异常` : ""}` : "状态未知";
    return `<details class="delivery-reception-evidence" ${receipts.length || issueEvents.length || lookup ? "open" : ""}><summary><span>数据资产接收记录</span>${status(summaryLabel, receipts.length || issueEvents.length ? "blue" : "neutral")}</summary>${lookupBox}<div class="delivery-root-context"><div><span>工作场景</span><b>${esc(scenarioDisplayLabel(context))}</b></div><div><span>场景版本</span><b class="mono">${esc(context.scenarioVersion || "缺失")}</b></div><div><span>场景轮次</span><b class="mono">${esc(context.scenarioRunId || "缺失")}</b></div><div><span>形成时间</span><b>${esc(context.formedAt || "缺失")}</b></div><div><span>场景状态</span><b>${esc(context.status || "缺失")}</b></div><div class="root-receipt-proof"><span>根上下文回执</span><b>${rootReceipt ? `${esc(rootReceipt.status)} · ${esc(rootReceipt.contextId)}` : "尚未取得"}</b>${rootReceipt ? `<small>${esc(rootReceipt.receivedAt || "时间缺失")} · ${esc(rootReceipt.evidenceLocator || "证据定位缺失")}</small>` : ""}</div></div><div class="delivery-receipt-list">${receiptRows}</div>${issueRows}<p class="delivery-evidence-note">接收记录只反映本体管理实际收到并校验的交付；历史轮次不会进入当前资产选择目录。</p></details>`;
  }

  function renderOverlay() {
    if (!ui.modal && !ui.drawer) return "";
    if (ui.modal === "createDraft") return modal("创建本体 Draft", "先定义业务范围，再进入空白本体建模工作台建立 Object Type。", `<div class="form-grid"><label class="form-field full"><span>本体业务名称</span><input id="draft-name" placeholder="例如：集团融资业务本体" autocomplete="off" /></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>ONT-</b><input id="draft-code" placeholder="GROUP-FINANCING-OPTIMIZATION" autocomplete="off" /></div></label><label class="form-field full"><span>业务定义</span><textarea id="draft-definition" placeholder="说明这一本体统一表达哪些业务事实、关系和行动"></textarea></label><label class="form-field full scene-combobox"><span>适用场景（可选）</span><input id="draft-scenario" list="scenario-options" placeholder="选择已有场景或直接输入新的业务场景" autocomplete="off" /><datalist id="scenario-options"><option value="S001 集团融资成本与债务结构优化"></option><option value="暂不指定"></option></datalist><small class="scene-custom">可选择已有场景、直接输入新场景，也可以暂不指定。</small></label></div><div class="boundary-note"><b>创建后是空白 Draft</b><p>系统不会自动复制数据字段，也不会预置正式资源或消费结果。</p></div>`, `${btn("取消", "close-overlay")}${btn("创建并进入建模工作台", "confirm-create-draft", { primary: true })}`);
    if (ui.modal === "scenarioActivation") {
      const intent = state.scenarioActivationIntent || {};
      const current = currentScenarioContext();
      return modal("等待场景切换", "新场景需要先由平台场景目录形成可用的场景运行上下文。", `<dl class="modal-facts"><dt>申请场景</dt><dd>${esc(intent.requestedScenario || "待确认")}</dd><dt>申请时间</dt><dd>${esc(intent.requestedAt || "待确认")}</dd><dt>当前工作场景</dt><dd>${esc(scenarioDisplayLabel(current))}</dd><dt>当前状态</dt><dd>等待平台激活</dd></dl><div class="boundary-note"><b>尚未创建 Draft</b><p>场景名称不会替代稳定场景身份，也不会借用当前场景轮次生成本体。平台返回完整新场景上下文后，再从该场景创建 Draft。</p></div>`, `${btn("关闭", "close-overlay")}`);
    }
    if (ui.modal === "draftSwitcher") {
      const current = activeDraft(); const context = currentScenarioContext();
      const others = state.drafts.filter(draft => !draft.publishedVersionId && draft.id !== current?.id && sameScenarioEnvelope(draft, context));
      const published = state.publishedVersions.filter(version => {
        const versionContext = scenarioContextOf(version);
        return versionContext.scenarioId === context.scenarioId && versionContext.scenarioVersion === context.scenarioVersion;
      });
      return modal("切换建模上下文", "Draft 可编辑；已发布语义版本只读。", `<div class="context-groups"><section><h3>当前编辑 Draft</h3>${current ? draftContextChoice(current, true) : `<p>当前没有正在编辑的 Draft。</p>`}</section><section><h3>其他未发布 Draft</h3>${others.length ? others.map(draft => draftContextChoice(draft, false)).join("") : `<p>没有其他未发布 Draft。</p>`}</section><section><h3>已发布语义版本</h3>${published.length ? published.map(version => `<button data-action="open-version-from-switcher:${version.id}"><span class="context-symbol published">V</span><div><b>${esc(version.name)}</b><small>${esc(version.semanticVersion)} · ${esc(version.publishedAt)}</small></div><em>只读查看</em></button>`).join("") : `<p>尚无已发布语义版本。</p>`}</section></div>`, `${btn("关闭", "close-overlay")}${btn("创建本体", "open-create-draft", { primary: true, disabled: !currentScenarioContextReady() })}`, true);
    }
    if (ui.modal?.type === "revisionChoice") {
      const version = state.publishedVersions.find(item => item.id === ui.modal.versionId);
      const drafts = state.drafts.filter(draft => !draft.publishedVersionId && draft.basedOnVersionId === version?.id && sameScenarioEnvelope(draft, currentScenarioContext()));
      return modal("已有未发布的修订 Draft", `${version?.name || "所选本体"} · ${version?.semanticVersion || ""}`, `<div class="boundary-note warning"><b>原 Published 版本不会被改写</b><p>可以继续现有修订，也可以另建一个相互独立的修订 Draft。</p></div><div class="choice-list revision-choices">${drafts.map(draft => { const primary = draftPrimaryStatusMeta(draft); return `<button data-action="continue-revision:${draft.id}"><span>${networkIcon("module-network-icon")}</span><div><b>${esc(draft.draftName)}</b><p>基于 ${esc(draft.basedOn)} · 保存于 ${esc(draft.updatedAt)}</p></div>${status(primary.label, primary.tone)}</button>`; }).join("")}</div>`, `${btn("取消", "close-overlay")}${btn("另建修订 Draft", `create-revision:${version?.id}`, { primary: true })}`, true);
    }
    if (ui.modal?.type === "terms") {
      const ref = mutableDraftResource(activeDraft(), ui.modal.resourceId); const resource = ref?.resource; const terms = { ...defaultTerms(resource), ...(resource?.terms || {}) };
      return modal("配置业务术语", `${resource?.name || "语义资源"} · 术语随 Published 语义版本发布`, `<div class="form-grid"><label class="form-field full"><span>首选业务名称</span><input id="terms-preferred" value="${esc(terms.preferredName)}" /></label><label class="form-field full"><span>同义词</span><input id="terms-synonyms" value="${esc((terms.synonyms || []).join("、"))}" placeholder="使用顿号分隔" /></label><label class="form-field"><span>缩写</span><input id="terms-abbreviation" value="${esc(terms.abbreviation || "")}" placeholder="没有可留空" /></label><label class="form-field"><span>不推荐表达</span><input id="terms-discouraged" value="${esc(terms.discouraged || "")}" /></label><label class="form-field full"><span>不推荐原因</span><textarea id="terms-discouraged-reason" placeholder="说明可能产生的业务歧义">${esc(terms.discouragedReason || "")}</textarea></label></div><div class="boundary-note"><b>统一语义来源</b><p>智能问数、报告和其他消费者只引用已发布术语，不在提示词或报告定义中维护另一套词表。</p></div>`, `${btn("取消", "close-overlay")}${btn("保存术语", "confirm-terms", { primary: true })}`);
    }
    if (ui.modal?.type === "confirmDeleteObject") {
      const draft = activeDraft(); const object = draft?.objects.find(item => item.id === ui.modal.objectId);
      return modal("删除空白 Object Type", `${object?.name || "所选对象"} · 仅限未配置且无依赖的 Draft 资源`, `<div class="boundary-note warning"><b>只删除当前 Draft 中的空白对象</b><p>已有 Property、数据成员、Link、Metric、Rule 或 Action Type 依赖时会阻断删除；已发布语义版本不会受影响。</p></div><dl class="modal-facts"><dt>业务名称</dt><dd>${esc(object?.name || "未找到")}</dd><dt>稳定语义身份</dt><dd class="mono">${esc(object?.id || "未找到")}</dd><dt>当前属性</dt><dd>${object?.properties?.length || 0} 项</dd><dt>数据资产成员</dt><dd>${esc(object?.memberId || "尚未选择")}</dd></dl>`, `${btn("取消", "close-overlay")}${btn("确认删除空白对象", "confirm-delete-object", { danger: true, disabled: !object })}`);
    }
    if (ui.modal === "addObject") {
      const editing = editResource("object");
      return modal(editing ? "编辑 Object Type" : "创建 Object Type", editing ? "修改业务定义不会改变稳定语义身份、数据映射或画布位置。" : "先建立真实业务实体或事件骨架；数据资产与 Property 在对象详情中配置。", `<div class="form-grid"><label class="form-field"><span>业务名称</span><input id="object-name" value="${esc(editing?.name || "")}" placeholder="例如：融资主体" autocomplete="off" /></label><label class="form-field"><span>对象类型</span><select id="object-kind"><option ${selectedOption("业务实体", editing?.objectKind)}>业务实体</option><option ${selectedOption("业务事件", editing?.objectKind)}>业务事件</option></select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>OBJ-</b><input id="object-code" value="${esc(codePart(editing?.id, "OBJ"))}" placeholder="FINANCING-ENTITY" autocomplete="off" ${editing ? "readonly" : ""} /></div></label><label class="form-field full"><span>业务定义</span><textarea id="object-definition" placeholder="说明该对象在业务中代表什么，而不是对应哪张表">${esc(editing?.definition || "")}</textarea></label></div><div class="boundary-note"><b>${editing ? "稳定身份保持不变" : "创建后继续配置对象"}</b><p>${editing ? "名称和定义可以修订；既有 Property、Link、映射与节点布局继续保留。" : "先选择与对象粒度一致的已发布数据资产成员，再逐项创建 Property 和字段映射。"}</p></div>`, `${btn("取消", "close-overlay")}${editing ? btn("删除空白对象", `request-delete-object:${editing.id}`, { danger: true }) : ""}${btn(editing ? "保存修改" : "创建 Object Type", "confirm-add-object", { primary: true })}`);
    }
    if (ui.modal === "addResource") {
      const draft = activeDraft();
      const selectedObject = findDraftResource(draft, ui.selectedNode)?.kind === "object" ? ui.selectedNode : draft?.objects[0]?.id || "";
      return modal("添加语义资源", "选择一种资源并完成业务配置；所有稳定语义身份均需显式填写。", `<div class="resource-type-grid"><button class="resource-type-card object" data-action="open-add-object"><span class="type-object">O</span><div><b>Object Type</b><p>建立真实业务实体或事件骨架。</p></div></button><button class="resource-type-card property" data-action="open-add-property:${esc(selectedObject)}" ${draft?.objects.length ? "" : "disabled"}><span class="type-property">P</span><div><b>Property</b><p>在所属 Object 内创建有业务价值的属性。</p></div></button><button class="resource-type-card link" data-action="open-add-link"><span class="type-link">L</span><div><b>Link Type</b><p>配置两端对象、方向、基数和稳定端点。</p></div></button><button class="resource-type-card metric" data-action="open-add-metric"><span class="type-metric">M</span><div><b>Metric</b><p>定义业务事实、单位、范围、时间和依赖。</p></div></button><button class="resource-type-card rule" data-action="open-add-rule"><span class="type-rule">R</span><div><b>Rule</b><p>基于 Metric 配置问题判断与证据要求。</p></div></button><button class="resource-type-card action" data-action="open-add-action"><span class="type-action">A</span><div><b>Action Type</b><p>定义可请求行动、前置证据和人工确认。</p></div></button></div>`, btn("取消", "close-overlay"), true);
    }
    if (ui.modal?.type === "chooseMember") {
      const draft = activeDraft();
      const object = draft?.objects.find(o => o.id === ui.modal.objectId);
      const expectedBlueprint = OBJECT_BLUEPRINTS.find(item => item.id === object?.id);
      const receivedContracts = availableDataAssets().filter(contract => sameScenarioEnvelope(contract, draft || currentScenarioContext()));
      const eligibleContracts = draft?.sourceDataContract
        ? [draft.sourceDataContract, ...receivedContracts.filter(contract => contract.assetId === draft.sourceDataContract.assetId && contract.assetVersion !== draft.sourceDataContract.assetVersion)]
        : receivedContracts;
      const selectedContract = eligibleContracts.find(contract => contract.assetVersion === ui.assetContractVersion) || eligibleContracts[0] || null;
      const catalogMembers = selectedContract?.members || [];
      const memberContent = selectedContract
        ? `<label class="form-field full"><span>已发布数据资产版本</span><select id="asset-contract-version" data-input="asset-contract-version">${eligibleContracts.map(contract => `<option value="${esc(contract.assetVersion)}" ${contract.assetVersion === selectedContract.assetVersion ? "selected" : ""}>${esc(contract.assetName)} · ${esc(contract.assetVersion)} · 截至 ${esc(contract.asOf)}</option>`).join("")}</select></label><div class="asset-modal-head"><b>${esc(selectedContract.assetName)}</b><span>${esc(selectedContract.assetVersion)} · 数据截至 ${esc(selectedContract.asOf)}</span></div><div class="choice-list members">${catalogMembers.map(member => { const compatible = memberCompatibleWithObject(member, object); return `<button class="${ui.assetChoice === member.id ? "selected" : ""}" data-action="choose-asset-member:${member.id}" ${compatible ? "" : "disabled"}><span>D</span><div><b>${esc(member.name)}</b><p>${esc(member.grain)} · 稳定标识 ${esc(member.identity)}</p><small class="mono">${esc(member.id)}</small></div>${compatible ? `<em>${Number(member.rows || 0).toLocaleString("zh-CN")} 行</em>` : status("粒度不适配", "neutral")}</button>`; }).join("")}</div>${!expectedBlueprint ? `<label class="confirm-row"><input type="checkbox" id="member-grain-confirm" /><span>我已核对所选成员的“一行代表什么”与该 Object Type 的业务粒度一致。</span></label>` : ""}<div class="boundary-note"><b>这里只选择已发布成员</b><p>确认后锁定精确数据资产版本；字段语义映射仍在对象内逐项完成。</p></div>`
        : `<div class="empty compact"><span>D</span><h3>没有可选择的数据资产</h3><p>尚未收到数据工程通过 C003 交付、且具备本体映射资格的已发布数据资产。</p>${btn("刷新接收状态", "refresh-external-inputs", { primary: true })}</div>`;
      const content = `${memberContent}${renderDataAssetReceptionEvidence()}`;
      return modal("选择数据资产成员", `${object?.name || "Object Type"} · 只可选择数据工程已发布成员`, content, `${btn("取消", "close-overlay")}${selectedContract ? btn("确认选择", "confirm-asset-member", { primary: true, disabled: !ui.assetChoice }) : ""}`, true);
    }
    if (ui.modal === "addProperty") {
      const draft = activeDraft();
      const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "property" ? editingRef.resource : null;
      const object = editingRef?.parentObject || draft?.objects.find(item => item.id === ui.propertyObjectId) || draft?.objects[0];
      const fields = object?.memberId ? fieldRecordsFor(draft, object) : [];
      const selectedField = fields.find(field => field.id === ui.propertyFieldChoice) || null;
      const form = ui.propertyForm || { name: editing?.name || selectedField?.name || "", dataType: editing?.dataType || selectedField?.type || "文本", code: codePart(editing?.id, "PROP"), unit: editing?.unit || defaultPropertyUnit(selectedField?.name || "", selectedField?.type || "文本"), nullable: editing?.nullable || "是", definition: editing?.definition || "" };
      return modal(editing ? "编辑 Property" : "创建 Property", editing ? "修改业务定义或显式重选来源字段；稳定语义身份和所属对象保持不变。" : "定义具有业务价值的属性；来源字段可以现在选择，也可以稍后在映射工作区连接。", `<div class="form-grid"><label class="form-field full"><span>所属 Object Type</span><select id="property-object" ${editing ? "disabled" : ""}>${objectOptions(draft, object?.id)}</select></label><div class="form-field full"><span>可选来源字段</span>${object?.memberId ? `<div class="field-choice-list"><button class="field-choice ${!selectedField ? "selected" : ""}" data-action="clear-property-field"><span>—</span><div><b>暂不绑定字段</b><p>先维护业务 Property，稍后进入映射工作区。</p></div></button>${fields.map(field => {
        const used = object.properties.some(property => property.id !== editing?.id && property.sourceFieldId === field.id);
        return `<button class="field-choice ${selectedField?.id === field.id ? "selected" : ""}" data-action="choose-property-field:${field.id}" ${used ? "disabled" : ""}><span>${esc(field.type.slice(0, 1))}</span><div><b>${esc(field.name)}</b><p>${esc(field.type)} · 示例 ${esc(field.sample)}</p><small class="mono">${esc(field.id)}</small></div>${used ? status("已使用", "neutral") : ""}</button>`;
      }).join("")}</div>` : `<div class="dependency-empty">当前对象尚未选择数据资产成员。仍可先创建 Property，之后再完成字段映射。</div>`}</div><label class="form-field"><span>Property 业务名称</span><input id="property-name" value="${esc(form.name)}" placeholder="例如：单位编码" autocomplete="off" /></label><label class="form-field"><span>业务类型</span><select id="property-type"><option ${selectedOption("文本", form.dataType)}>文本</option><option ${selectedOption("数值", form.dataType)}>数值</option><option ${selectedOption("日期", form.dataType)}>日期</option><option ${selectedOption("枚举", form.dataType)}>枚举</option></select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>PROP-</b><input id="property-code" value="${esc(form.code)}" placeholder="FINANCING-ENTITY-UNIT-CODE" autocomplete="off" ${editing ? "readonly" : ""} /></div></label><label class="form-field"><span>业务单位</span><input id="property-unit" value="${esc(form.unit)}" placeholder="数值属性必须填写单位" /></label><label class="form-field"><span>允许为空</span><select id="property-nullable" ${editing?.id === object?.identity ? "disabled" : ""}><option ${selectedOption("是", form.nullable)}>是</option><option ${selectedOption("否", form.nullable)}>否</option></select></label><label class="form-field full"><span>业务定义</span><textarea id="property-definition" placeholder="说明该属性对业务识别、计算或判断的意义">${esc(form.definition)}</textarea></label></div>`, `${btn("取消", "close-overlay")}${btn(editing ? "保存修改" : selectedField ? "创建并映射" : "创建 Property", "confirm-add-property", { primary: true })}`, true);
    }
    if (ui.modal === "addLink") {
      const draft = activeDraft(); const objects = draft?.objects || [];
      const editing = editResource("link");
      const sourceId = ui.linkSourceObjectId || editing?.source || objects[0]?.id || "";
      const targetId = ui.linkTargetObjectId || editing?.target || objects.find(item => item.id !== sourceId)?.id || "";
      const source = draft?.objects.find(item => item.id === sourceId); const target = draft?.objects.find(item => item.id === targetId);
      const sourceToken = editing ? `${editing.sourceEndpoint?.kind}|${sourceId}|${editing.sourceEndpoint?.id}` : "";
      const targetToken = editing ? `${editing.targetEndpoint?.kind}|${targetId}|${editing.targetEndpoint?.id}` : "";
      return modal(editing ? "编辑 Link Type" : "创建 Link Type", editing ? "关系两端和稳定端点必须显式确认；不会按字段名称自动迁移。" : "明确关系两端、方向、基数和类型兼容的稳定端点。", `<div class="form-grid"><label class="form-field"><span>正向业务名称</span><input id="link-name" value="${esc(editing?.name || "")}" placeholder="例如：主体拥有融资" autocomplete="off" /></label><label class="form-field"><span>反向业务名称</span><input id="link-reverse-name" value="${esc(editing?.reverseName || "")}" placeholder="例如：融资归属主体" autocomplete="off" /></label><label class="form-field"><span>基数</span><select id="link-cardinality"><option ${selectedOption("一对多", editing?.cardinality)}>一对多</option><option ${selectedOption("多对一", editing?.cardinality)}>多对一</option><option ${selectedOption("一对一", editing?.cardinality)}>一对一</option><option ${selectedOption("多对多", editing?.cardinality)}>多对多</option></select></label><label class="form-field"><span>允许导航方向</span><select id="link-allowed-direction"><option value="">请选择</option>${ALLOWED_LINK_DIRECTIONS.map(direction => `<option ${selectedOption(direction, editing?.allowedDirection)}>${esc(direction)}</option>`).join("")}</select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>LINK-</b><input id="link-code" value="${esc(codePart(editing?.id, "LINK"))}" placeholder="ENTITY-FINANCING" autocomplete="off" ${editing ? "readonly" : ""} /></div></label><label class="form-field"><span>起点 Object</span><select id="link-source">${objectOptions(draft, sourceId)}</select></label><label class="form-field"><span>终点 Object</span><select id="link-target">${objectOptions(draft, targetId)}</select></label><label class="form-field"><span>起点稳定端点</span><select id="link-source-endpoint">${endpointOptionsForObject(draft, sourceId, sourceToken)}</select></label><label class="form-field"><span>终点稳定端点</span><select id="link-target-endpoint">${endpointOptionsForObject(draft, targetId, targetToken)}</select></label><label class="form-field full"><span>业务方向</span><input id="link-direction" value="${esc(source?.name || "起点")} → ${esc(target?.name || "终点")}" readonly /></label><label class="form-field full"><span>业务定义</span><textarea id="link-definition" placeholder="说明该关系在业务中表达什么">${esc(editing?.definition || "")}</textarea></label></div><div class="endpoint-readiness"><div><span>起点可用端点</span><b data-endpoint-count="source">${endpointCandidates(draft, source).length}</b></div><div><span>终点可用端点</span><b data-endpoint-count="target">${endpointCandidates(draft, target).length}</b></div><p>端点只来自已映射的身份 Property、显式 Link 端点 Property 或资产字段；允许导航范围会随 Published 版本冻结。</p></div><div class="endpoint-compatibility" id="link-endpoint-compatibility">选择两端端点后检查类型兼容性</div>`, `${btn("取消", "close-overlay")}${btn(editing ? "保存修改" : "创建 Link Type", "confirm-add-link", { primary: true, disabled: objects.length < 2 })}`, true);
    }
    if (ui.modal === "addMetric") {
      const draft = activeDraft(); const editing = editResource("metric"); const selectedObjectId = editing?.subjectObjectId || ui.resourceObjectId || draft?.objects[0]?.id || "";
      const dependencies = draftResourceList(draft).filter(item => ["property", "link", "metric"].includes(item.kind) && item.id !== editing?.id);
      return modal(editing ? "编辑 Metric" : "创建 Metric", "配置可复用业务事实的单位、范围、时间语义和精确依赖。", `<div class="form-grid"><label class="form-field"><span>业务名称</span><input id="metric-name" value="${esc(editing?.name || "")}" placeholder="例如：余额加权平均融资成本" autocomplete="off" /></label><label class="form-field"><span>业务单位</span><input id="metric-unit" value="${esc(editing?.unit || "")}" placeholder="例如：% 或 人民币元" /></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>MET-</b><input id="metric-code" value="${esc(codePart(editing?.id, "MET"))}" placeholder="WAVG-COST" autocomplete="off" ${editing ? "readonly" : ""} /></div></label><label class="form-field"><span>事实来源 Object</span><select id="metric-source-object">${objectOptions(draft, editing?.sourceObjectId || selectedObjectId)}</select></label><label class="form-field"><span>适用 Object</span><select id="metric-subject-object">${objectOptions(draft, selectedObjectId)}</select></label><label class="form-field"><span>时间语义</span><input id="metric-time" value="${esc(editing?.time || "数据截至时点")}" /></label><label class="form-field"><span>适用粒度与范围</span><input id="metric-scope" value="${esc(editing?.scope || "")}" placeholder="例如：集团、板块、主体及主体集合" /></label><label class="form-field full"><span>业务定义</span><textarea id="metric-definition" placeholder="说明该 Metric 表达什么业务事实">${esc(editing?.definition || "")}</textarea></label><label class="form-field full"><span>计算口径</span><textarea id="metric-calculation" placeholder="使用稳定 Property、Link 或既有 Metric 表达唯一计算口径">${esc(editing?.calculation || "")}</textarea></label><label class="form-field full"><span>零分母或无数据处理</span><input id="metric-zero" value="${esc(editing?.zeroHandling || "分母为零或没有有效数据时返回无法计算")}" /></label><fieldset class="form-field full"><legend>依赖 Property、Link 或既有 Metric</legend>${dependencyChoices(dependencies, "metric-dep", editing?.dependencyIds || [])}</fieldset></div>`, `${btn("取消", "close-overlay")}${btn(editing ? "保存修改" : "创建 Metric", "confirm-add-metric", { primary: true })}`, true);
    }
    if (ui.modal === "addRule") {
      const draft = activeDraft(); const editing = editResource("rule"); const selectedObjectId = editing?.objectId || ui.resourceObjectId || draft?.objects[0]?.id || "";
      return modal(editing ? "编辑 Rule" : "创建 Rule", "基于已配置 Metric 定义问题判断、结果解释和证据要求。", `<div class="form-grid"><label class="form-field"><span>规则名称</span><input id="rule-name" value="${esc(editing?.name || "")}" placeholder="例如：融资成本偏高" autocomplete="off" /></label><label class="form-field"><span>规则编号</span><input id="rule-code" value="${esc(editing?.code || `R${String((draft?.rules.length || 0) + 1).padStart(2, "0")}`)}" /></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>RULE-</b><input id="rule-business-code" value="${esc(codePart(editing?.id, "RULE"))}" placeholder="HIGH-COST" autocomplete="off" ${editing ? "readonly" : ""} /></div></label><label class="form-field"><span>业务口径状态</span><select id="rule-business-basis"><option value="recommended" ${selectedOption("recommended", editing?.businessBasis || "recommended")}>推荐基线（发布时确认）</option><option value="unknown" ${selectedOption("unknown", editing?.businessBasis)}>待确认（阻断发布）</option></select></label><label class="form-field"><span>适用 Object</span><select id="rule-object">${objectOptions(draft, selectedObjectId)}</select></label><label class="form-field full"><span>判断条件</span><textarea id="rule-condition" placeholder="例如：主体融资成本高于集团基准 0.25 个百分点">${esc(editing?.condition || "")}</textarea></label><label class="form-field"><span>有效期</span><input id="rule-validity" value="${esc(editing?.validity || "随当前 Published 语义版本生效")}" /></label><label class="form-field"><span>测试样例</span><input id="rule-test-sample" value="${esc(editing?.testSample || "")}" placeholder="代表性命中或不命中样例" /></label><label class="form-field full"><span>机构排序</span><input id="rule-bank-ranking" value="${esc(editing?.bankRanking || "按对应问题融资余额降序列出前三家银行")}" /></label><label class="form-field full"><span>证据要求</span><input id="rule-evidence" value="${esc(editing?.evidence || "")}" placeholder="例如：指标快照、贡献机构和关联借据" /></label><label class="form-field full"><span>业务定义</span><textarea id="rule-definition" placeholder="说明该规则识别什么业务问题">${esc(editing?.definition || "")}</textarea></label><fieldset class="form-field full"><legend>依赖 Metric</legend>${dependencyChoices((draft?.metrics || []).map(item => ({ ...item, kind: "metric" })), "rule-dep", editing?.metricIds || [])}</fieldset></div>`, `${btn("取消", "close-overlay")}${btn(editing ? "保存修改" : "创建 Rule", "confirm-add-rule", { primary: true })}`, true);
    }
    if (ui.modal === "addAction") {
      const draft = activeDraft(); const editing = editResource("action"); const selectedObjectId = editing?.targetObjectId || ui.resourceObjectId || draft?.objects[0]?.id || "";
      return modal(editing ? "编辑 Action Type" : "创建 Action Type", "定义允许请求的行动；提醒、确认和待办运行记录不在此处维护。", `<div class="form-grid"><label class="form-field"><span>行动名称</span><input id="action-name" value="${esc(editing?.name || "")}" placeholder="例如：发起融资优化建议" autocomplete="off" /></label><label class="form-field"><span>目标 Object</span><select id="action-object">${objectOptions(draft, selectedObjectId)}</select></label><label class="form-field full"><span>英文业务编码</span><div class="prefixed-input"><b>ACTION-</b><input id="action-code" value="${esc(codePart(editing?.id, "ACTION"))}" placeholder="FINANCING-OPTIMIZATION" autocomplete="off" ${editing ? "readonly" : ""} /></div></label><label class="form-field full"><span>必要参数</span><textarea id="action-parameters" placeholder="例如：融资主体、规则命中、指标证据、优先协商机构">${esc(editing?.parameters || editing?.inputs || "")}</textarea></label><label class="form-field full"><span>前置证据</span><input id="action-prerequisite" value="${esc(editing?.prerequisite || "")}" placeholder="说明请求行动前必须具备的对象、规则和证据" /></label><label class="form-field full"><span>预期结果</span><input id="action-result" value="${esc(editing?.result || "")}" placeholder="例如：形成行动申请，人工确认后形成负责人待办" /></label><label class="form-field full"><span>失败表现</span><input id="action-failure" value="${esc(editing?.failure || "")}" placeholder="说明缺少参数或证据时如何失败并恢复" /></label><label class="form-field"><span>默认办理期限</span><input id="action-default-due" value="${esc(editing?.defaultDue || "人工确认后 5 个工作日内完成")}" /></label><label class="form-field"><span>确认要求</span><select id="action-confirmation"><option selected>必须人工确认</option></select></label><label class="form-field full"><span>业务定义</span><textarea id="action-definition" placeholder="说明该行动允许业务用户请求什么">${esc(editing?.definition || "")}</textarea></label><fieldset class="form-field full"><legend>依赖 Rule</legend>${dependencyChoices((draft?.rules || []).map(item => ({ ...item, kind: "rule" })), "action-rule", editing?.ruleIds || [])}</fieldset><fieldset class="form-field full"><legend>证据导航 Link（可选）</legend>${dependencyChoices((draft?.links || []).map(item => ({ ...item, kind: "link" })), "action-link", editing?.linkIds || [])}</fieldset></div>`, `${btn("取消", "close-overlay")}${btn(editing ? "保存修改" : "创建 Action Type", "confirm-add-action", { primary: true })}`, true);
    }
    if (ui.modal === "releaseSettings") {
      const draft = activeDraft(); ensureDraftReleaseContract(draft);
      const baseVersion = state.publishedVersions.find(version => version.id === draft.basedOnVersionId) || null;
      const replacementCandidates = baseVersion ? publishedResources(baseVersion) : [];
      const replacementChoices = replacementCandidates.length
        ? `<fieldset class="form-field full replacement-resources"><legend>被替代资源（来自 ${esc(baseVersion.semanticVersion)}）</legend><p>逐项选择来源资源，再明确本 Draft 中使用新稳定身份创建的目标资源；同一稳定身份的正常修订不声明替代关系。</p>${replacementCandidates.map(resource => { const selectedTarget = draft.release.replacementMap?.[resource.id] || ""; const targets = draftResourceList(draft).filter(item => item.kind === resource.kind && item.id !== resource.id); return `<div class="replacement-resource-row"><label><input type="checkbox" name="replacement-resource" value="${esc(resource.id)}" ${draft.release.replacementResourceIds.includes(resource.id) ? "checked" : ""} /><span><b>${esc(resource.name)}</b><small>${esc(resource.type)} · <span class="mono">${esc(baseVersion.semanticVersion)} · ${esc(resource.id)}</span></small></span></label><select name="replacement-target" data-source-resource="${esc(resource.id)}" aria-label="替代目标"><option value="">${targets.length ? "选择当前 Draft 目标资源" : "先创建同类型的新资源"}</option>${targets.map(target => `<option value="${esc(target.id)}" ${target.id === selectedTarget ? "selected" : ""}>${esc(target.name)} · ${esc(target.id)}</option>`).join("")}</select></div>`; }).join("")}</fieldset>`
        : `<div class="form-field full dependency-empty">当前 Draft 没有来源 Published 版本，不能声明替代指定资源；请明确选择“无替代关系”。</div>`;
      return modal("配置发布信息", "这些信息随精确 Published 版本及其资源冻结；未确认前会阻断发布。", `<div class="form-grid"><label class="form-field"><span>定义责任位置</span><input value="${esc(ONTOLOGY_DEFINITION_OWNER)}" readonly /></label><label class="form-field"><span>发布后业务有效状态</span><input value="按生效与失效时间判定" readonly /></label><label class="form-field"><span>业务生效时间</span><input id="release-effective-from" type="datetime-local" value="${esc(draft.release.effectiveFrom || "")}" /></label><label class="form-field"><span>业务失效时间（可选）</span><input id="release-effective-to" type="datetime-local" value="${esc(draft.release.effectiveTo || "")}" /></label><label class="form-field full"><span>变更原因</span><textarea id="release-change-reason" placeholder="说明首次发布或本次修订解决了什么业务问题">${esc(draft.release.changeReason === "待确认" ? "" : draft.release.changeReason || "")}</textarea></label><label class="form-field full"><span>替代关系声明</span><select id="release-replacement"><option ${selectedOption("待确认", draft.release.replacementMode)}>待确认</option><option ${selectedOption("无替代关系", draft.release.replacementMode)}>无替代关系</option><option ${selectedOption("替代指定资源", draft.release.replacementMode)} ${replacementCandidates.length ? "" : "disabled"}>替代指定资源</option></select></label>${draft.release.replacementMode === "替代指定资源" ? replacementChoices : ""}</div><div class="publish-contract lifecycle"><div><span>稳定资源身份</span><b>${draftResourceList(draft).length} 项显式身份</b><small>显示名称不参与自动绑定</small></div><div><span>最近变更</span><b>${esc(draft.updatedAt)}</b><small>发布时按资源差异冻结</small></div><div><span>受控证据定位</span><b>尚未形成</b><small>实际发布成功后才形成记录与证据定位</small></div></div><div class="boundary-note"><b>责任位置、有效期与替代关系</b><p>一期只维护发布声明和只读包络，不建设弃用审批或消费者迁移工作流。替代指定资源必须同时锁定来源 Published 版本、来源资源身份和当前 Draft 目标资源，绝不按同名推断，也不会改写来源快照。</p></div>`, `${btn("取消", "close-overlay")}${btn("保存发布信息", "confirm-release-settings", { primary: true })}`);
    }
    if (ui.modal === "publish") {
      const draft = activeDraft();
      const recommended = recommendedBusinessResources(draft);
      const defaultSummary = draft.pendingUpdate
        ? `适配 ${draft.pendingUpdate.dataVersion} 的数据映射合同变化，完成显式端点与依赖修订。`
        : `完成 ${draft.objects.length} 个 Object、${draft.objects.reduce((n, object) => n + object.properties.length, 0)} 个 Property、${draft.links.length} 条 Link、${draft.metrics.length} 项 Metric、${draft.rules.length} 条 Rule 和 ${draft.actions.length} 个 Action Type。`;
      const businessConfirmation = recommended.length ? `<div class="boundary-note warning"><b>确认本次业务口径</b><p>${esc(recommended.map(resource => resource.code ? `${resource.code} ${resource.name}` : resource.name).join("、"))} 将随本语义版本冻结；后续变更必须创建修订 Draft 并重新验证。</p></div><label class="confirm-row"><input type="checkbox" id="publish-business-confirm" /><span>我已核对本次 Rule 阈值、短期债务口径、银行排序和行动默认期限。</span></label>` : "";
      const selectedMemberIds = new Set(draft.objects.map(object => object.memberId).filter(Boolean));
      const frozenMembers = draftMembers(draft).filter(member => selectedMemberIds.has(member.id));
      const frozenRelations = draftAssetRelations(draft).filter(relation => selectedMemberIds.has(relation.sourceMemberId) && selectedMemberIds.has(relation.targetMemberId));
      const lifecycleSnapshot = draft.validation?.snapshot?.resourceManifest || [];
      const replacementCount = lifecycleSnapshot.filter(resource => (resource.replaces || []).length || resource.expectedBusinessValidityState === "停用").length;
      const unknownChangeCount = lifecycleSnapshot.filter(resource => !resource.changeReason || resource.changeReason === "待确认" || !resource.lastChangedAt || resource.lastChangedAt === "待确认").length;
      return modal("发布语义版本", "发布后形成不可变快照；正式数据需要单独完成更新与切换。", `<div class="publish-summary"><div><b>${esc(draft.name)}</b><span>${draft.objects.length} Object · ${draft.objects.reduce((n, o) => n + o.properties.length, 0)} Property · ${draft.links.length} Link</span></div>${status("校验通过", "green")}</div><div class="publish-contract"><div><span>发布时数据资产</span><b>${esc(draft.sourceDataContract?.assetName || "未选择数据资产")}</b><small>${esc(draftDataVersion(draft))} · 截至 ${esc(draftDataAsOf(draft))}</small></div><div><span>业务有效期</span><b>${esc(humanDateTime(draft.release?.effectiveFrom))}</b><small>${draft.release?.effectiveTo ? `失效 ${esc(humanDateTime(draft.release.effectiveTo))}` : "未预设失效时间"}</small></div><div><span>Owner 与证据</span><b>${esc(draft.release?.owner || "待确认")}</b><small>受控证据定位将在发布成功后形成</small></div></div><div class="publish-contract lifecycle"><div><span>生命周期资源</span><b>${lifecycleSnapshot.length} 项</b><small>与本次统一校验使用同一快照</small></div><div><span>替代或停用</span><b>${replacementCount} 项</b><small>仅按稳定身份显式声明</small></div><div><span>待确认字段</span><b>${unknownChangeCount} 项</b><small>${unknownChangeCount ? "返回校验页复核" : "生命周期包络完整"}</small></div></div><details class="publish-manifest"><summary>查看资源生命周期清单</summary>${renderLifecycleManifestTable(lifecycleSnapshot)}</details><label class="form-field"><span>变更摘要</span><textarea id="change-summary">${esc(draft.release?.changeReason || defaultSummary)}</textarea></label>${businessConfirmation}<div class="boundary-note"><b>发布边界</b><p>本次发布冻结语义资源、生命周期和数据映射合同，但不会自动变成当前正式使用版本。</p></div>`, `${btn("取消", "close-overlay")}${btn("确认发布", "confirm-publish", { primary: true })}`);
    }
    if (ui.modal?.type === "refreshTarget") {
      const version = state.publishedVersions.find(item => item.id === ui.modal.versionId) || null;
      const contract = versionDataContract(version);
      const target = latestRefreshTarget(version);
      const assessment = refreshTargetAssessment(version, target, contract?.assetId || null);
      const evidenceRecord = target ? (state.recordsByVersion[version?.id] || []).find(record => record.evidenceCode === target.evidenceLocator) || null : null;
      const writeIssue = currentVersionWriteIssue(version);
      const canCreate = !!version && !writeIssue && publishedMappingContractAssessment(version).complete && publishedResourceAvailable(version);
      if (!target) return modal("建立数据刷新目标", "该操作只形成供数据工程只读发现的目标绑定，不会提交数据更新或切换正式数据。", `<dl class="modal-facts"><dt>精确 Published 版本</dt><dd>${esc(version?.semanticVersion || "不可定位")} · <span class="mono">${esc(version?.id || "不可定位")}</span></dd><dt>稳定数据资产</dt><dd class="mono">${esc(contract?.assetId || "不可定位")}</dd><dt>来源映射版本</dt><dd class="mono">${esc(contract?.mappingVersionId || "不可定位")}</dd><dt>成员与关系范围</dt><dd>${(contract?.members || []).length} 个成员 · ${(contract?.relations || []).length} 条关系</dd><dt>映射合同</dt><dd>${esc(publishedMappingContractAssessment(version).label)}</dd></dl>${canCreate ? `<div class="boundary-note"><b>建立后仍需重新读取</b><p>数据工程提交更新前必须重新读取发现结果，并锁定本次目标绑定和来源映射版本。</p></div>` : `<div class="result-banner error compact"><span>!</span><div><b>当前不能建立刷新目标</b><p>${esc(writeIssue || publishedMappingContractAssessment(version).detail)}；业务有效状态为 ${esc(businessValidityStateOf(version))}。</p></div></div>`}`, `${btn("取消", "close-overlay")}${btn("建立目标", "confirm-create-refresh-target", { primary: true, disabled: !canCreate })}`);
      const targetAction = assessment.key === "disabled"
        ? btn("重新启用", "confirm-create-refresh-target", { primary: true, disabled: !canCreate })
        : assessment.allowSubmit
          ? btn("停用目标", "request-stop-refresh-target", { danger: true, disabled: !!writeIssue })
          : btn("形成新绑定版本", "confirm-create-refresh-target", { primary: true, disabled: !canCreate });
      return modal("数据刷新目标", "数据工程仅能读取、选择并在提交前重新读取；本体管理维护目标绑定及来源映射版本。", `<dl class="modal-facts"><dt>目标名称</dt><dd>${esc(target.name)}</dd><dt>目标绑定</dt><dd class="mono">${esc(target.stableId)} · ${esc(target.bindingVersion)}</dd><dt>精确 Published 版本</dt><dd>${esc(target.semanticVersion)} · <span class="mono">${esc(target.semanticVersionId)}</span></dd><dt>稳定数据资产</dt><dd class="mono">${esc(target.dataAssetId || "不可定位")}</dd><dt>来源映射版本</dt><dd class="mono">${esc(target.sourceMappingVersionId || "不可定位")}</dd><dt>当前状态</dt><dd>${esc(assessment.label)}</dd><dt>是否允许提交刷新</dt><dd>${assessment.allowSubmit ? "允许；提交前必须重新读取" : "不允许"}</dd><dt>最近核验</dt><dd>${esc(target.lastCheckedAt || "待确认")}</dd><dt>受控证据</dt><dd><span class="mono">${esc(target.evidenceLocator || "待确认")}</span>${evidenceRecord ? btn("查看证据", `open-record:${version.id}:${evidenceRecord.id}`, { small: true }) : ""}</dd></dl>${writeIssue ? `<div class="result-banner warning compact"><span>!</span><div><b>历史版本只读</b><p>${esc(writeIssue)}。当前目标和证据保持不变。</p></div></div>` : assessment.allowSubmit ? `<div class="boundary-note"><b>可供发现，不代表已采用</b><p>数据更新、匹配检查、业务消费验证和正式切换仍是相互独立的步骤。</p></div>` : `<div class="result-banner error compact"><span>!</span><div><b>${esc(assessment.label)}</b><p>${esc(assessment.reason)} ${esc(assessment.recovery)}</p></div></div>`}`, `${btn("关闭", "close-overlay")}${targetAction}`);
    }
    if (ui.modal?.type === "confirmRefreshTargetStop") {
      const version = state.publishedVersions.find(item => item.id === ui.modal.versionId) || null;
      const target = latestRefreshTarget(version);
      const writeIssue = currentVersionWriteIssue(version);
      return modal("停用数据刷新目标", "停用后，数据工程再次发现或提交前重读时将收到不可提交状态。", `<div class="boundary-note warning"><b>当前正式数据不会改变</b><p>停用只影响后续数据更新请求，不会回退、停用或改写已经形成的正式数据组合。</p></div><dl class="modal-facts"><dt>目标绑定</dt><dd class="mono">${esc(target ? `${target.stableId} · ${target.bindingVersion}` : "不可定位")}</dd><dt>精确 Published 版本</dt><dd>${esc(version?.semanticVersion || "不可定位")}</dd></dl>${writeIssue ? `<div class="result-banner warning compact"><span>!</span><div><b>当前不能停用</b><p>${esc(writeIssue)}。</p></div></div>` : `<label class="form-field"><span>停用原因</span><textarea id="refresh-target-stop-reason">当前版本暂不接收新的数据更新</textarea></label>`}`, `${btn("取消", "close-overlay")}${btn("确认停用", "confirm-stop-refresh-target", { danger: true, disabled: !target || !!writeIssue })}`);
    }
    if (ui.modal === "fixUpdate") {
      const version = selectedVersion(); const update = updateFor(version);
      const detail = update?.breakingDetail || pendingRepairDetail(version, update);
      return modal("创建修正 Draft", "当前 Published 版本保持不变。", `<div class="result-banner error compact"><span>!</span><div><b>${esc(detail?.linkName || detail?.propertyName || "映射合同")}需要修正</b><p>${esc(update?.failure || detail?.detail || "候选资产与发布时映射合同不一致")}</p></div></div><div class="mapping-decision"><div><span>发布时映射</span><b>${esc(detail?.oldFieldName || "当前稳定身份")}</b></div><i>→</i><div><span>候选资产</span><b>${esc(detail?.newFieldName || "需要显式重新选择")}</b></div></div><dl class="modal-facts"><dt>修正位置</dt><dd>${esc(detail?.objectName || "相关对象")} · 数据与映射</dd><dt>来源请求</dt><dd class="mono">${esc(update?.requestId || "待确认")}</dd><dt>原版本状态</dt><dd>${esc(version?.semanticVersion)} 保持 Published</dd><dt>失败记录</dt><dd>继续归属于原版本</dd><dt>后续步骤</dt><dd>显式修正 Property 或 Link 端点、统一校验并发布新版本</dd></dl>`, `${btn("取消", "close-overlay")}${btn("创建并前往修正", "confirm-fix-update", { primary: true })}`);
    }
    if (ui.modal === "adopt") {
      const version = selectedVersion(); const update = updateFor(version); const current = bindingFor(version).current;
      const gate = candidateValidationGate(version, update); const reference = update?.validationReference;
      if (!gate.passed) return modal("无法切换为正式数据", "采用门禁已变化。", `<div class="result-banner error compact"><span>!</span><div><b>${gate.issues.length} 项门禁未通过</b><p>${esc(gate.issues.join("；"))}</p></div></div><div class="boundary-note"><b>当前正式数据保持不变</b><p>返回更新页面重新检查数据匹配、外部验证引用和 Published 资源状态。</p></div>`, `${btn("关闭", "close-overlay")}${btn("返回处理", "version-tab:updates", { primary: true })}`);
      return modal("切换为正式数据", "确认后进入受控切换；处理中或失败都不会提前改写当前正式版本。", `<div class="compare-bindings"><div><span>当前正式版本</span><b>${current ? `${esc(current.semanticVersion)} ＋ ${esc(current.dataVersion)}` : "尚未形成"}</b><small>${current ? `数据截至 ${esc(current.asOf)}` : "当前没有正式组合"}</small></div><i>→</i><div><span>待切换版本</span><b>${esc(version.semanticVersion)} ＋ ${esc(update?.dataVersion)}</b><small>数据截至 ${esc(update?.asOf)}</small></div></div><dl class="modal-facts"><dt>候选语义版本</dt><dd>${esc(version.semanticVersion)} · <span class="mono">${esc(version.id)}</span></dd><dt>候选数据版本</dt><dd class="mono">${esc(update?.dataVersion)}</dd><dt>题集版本</dt><dd class="mono">${esc(reference?.questionSetVersion || "待确认")}</dd><dt>验证状态</dt><dd>${esc(gate.passed ? "门禁通过" : validationReferenceState(reference, version, update).label)}</dd><dt>外部证据定位</dt><dd class="mono">${esc(reference?.evidenceLocator || "待确认")}</dd><dt>本体门禁</dt><dd>${gate.checks.length} 项已全部通过</dd></dl><label class="confirm-row"><input type="checkbox" id="adopt-confirm" /><span>我已核对目标双版本、外部验证引用和本体门禁，并确认切换为正式数据。</span></label>`, `${btn("取消", "close-overlay")}${btn(update?.phase === "switch_failed" ? "确认重试切换" : "确认切换", "confirm-adopt", { primary: true })}`);
    }
    if (ui.modal === "rollback") {
      const version = selectedVersion();
      if (!isCurrentFormalVersion(version)) return modal("无法回退历史版本", "数据回退只在当前正式使用的精确语义版本内提供。", `<div class="empty compact"><span>↺</span><h3>此版本仅供历史追溯</h3><p>返回已发布本体，进入当前正式使用版本处理数据更新或回退。</p></div>`, `${btn("关闭", "close-overlay")}${btn("返回版本目录", "nav-published", { primary: true })}`);
      const previous = bindingFor(version).previous;
      return modal("回退到上一可信数据", "回退只影响当前精确语义版本下的正式数据。", `<div class="compare-bindings"><div><span>当前正式数据</span><b>${esc(bindingFor(version).current?.dataVersion)}</b></div><i>→</i><div><span>回退目标</span><b>${esc(previous?.dataVersion)}</b><small>${esc(previous?.asOf)}</small></div></div><label class="form-field"><span>回退原因</span><textarea id="rollback-reason">新数据消费结果需要进一步核对</textarea></label>`, `${btn("取消", "close-overlay")}${btn("确认回退", "confirm-rollback", { danger: true })}`);
    }
    if (ui.modal === "combinationRollback") {
      const version = selectedVersion(); const prior = previousTrustedCombination(version);
      if (!prior) return modal("没有可回退版本", "当前没有仍兼容的上一可信版本。", `<div class="empty compact"><span>!</span><h3>保持不可消费</h3><p>需要形成新的合格数据版本并重新完成匹配、验证和正式切换。</p></div>`, btn("关闭", "close-overlay", { primary: true }));
      return modal("回退上一可信版本", "语义版本与数据版本将作为一个整体恢复。", `<div class="compare-bindings"><div><span>当前受阻断版本</span><b>${esc(version.semanticVersion)} ＋ ${esc(bindingFor(version).current?.dataVersion)}</b></div><i>→</i><div><span>上一可信版本</span><b>${esc(prior.semanticVersion)} ＋ ${esc(prior.dataVersion)}</b><small>${esc(prior.asOf)}</small></div></div><label class="confirm-row"><input type="checkbox" id="combination-rollback-confirm" /><span>我已确认回退完整的语义与数据版本组合，历史证据保持不变。</span></label>`, `${btn("取消", "close-overlay")}${btn("确认回退", "confirm-combination-rollback", { danger: true })}`);
    }
    if (ui.modal?.type === "record") {
      const records = state.recordsByVersion[ui.modal.versionId] || []; const record = records.find(r => r.id === ui.modal.recordId);
      const snapshot = record?.externalValidationSnapshot || null;
      const snapshotDetails = snapshot ? `<section class="record-external-snapshot"><h3>智能问数只读引用快照</h3><dl class="modal-facts"><dt>候选语义版本</dt><dd>${esc(snapshot.semanticVersion || "待确认")} · <span class="mono">${esc(snapshot.semanticVersionId || "待确认")}</span></dd><dt>候选数据版本</dt><dd class="mono">${esc(snapshot.dataVersion || "待确认")}</dd><dt>数据截至时间</dt><dd>${esc(snapshot.asOf || "待确认")}</dd><dt>题集版本</dt><dd class="mono">${esc(snapshot.questionSetVersion || "待确认")}</dd><dt>整体状态</dt><dd>${esc(snapshot.status || "待确认")}</dd><dt>完成时间</dt><dd>${esc(snapshot.completedAt || "待确认")}</dd><dt>有效期</dt><dd>${esc(externalExpiryLabel(snapshot.expiresAtEpoch))}</dd><dt>重试来源</dt><dd class="mono">${esc(snapshot.retryOf || "首次运行")}</dd></dl>${renderExternalValidationItems(snapshot.items || [])}</section>` : "";
      const isValidationRetryRequest = record?.requestedExternalValidationContractRef && record?.sourceModule === "本体管理";
      const externalSnapshotLabel = isValidationRetryRequest ? "关联的智能问数只读引用快照" : "智能问数只读引用快照";
      const labeledSnapshotDetails = snapshotDetails.replace("智能问数只读引用快照", externalSnapshotLabel);
      return modal(record?.title || "记录详情", "业务记录与追溯标识", `<dl class="modal-facts"><dt>业务状态</dt><dd>${esc(record?.status)}</dd><dt>发生时间</dt><dd>${esc(record?.time)}</dd><dt>说明</dt><dd>${esc(record?.detail)}</dd><dt>精确语义版本</dt><dd>${esc(record?.semanticVersion)}</dd><dt>数据版本</dt><dd>${esc(record?.dataVersion || "不适用")}</dd><dt>本体记录标识</dt><dd class="mono">${esc(record?.id || "未生成")}</dd><dt>本体受控证据</dt><dd class="mono">${esc(record?.evidenceCode || "未形成")}</dd><dt>本体合同或资格</dt><dd class="mono">${esc(record?.contractCode || "不适用")}</dd><dt>平台资源引用</dt><dd class="mono">${esc(record?.resourceRef || "不适用")}</dd><dt>已接收验证合同引用</dt><dd class="mono">${esc(record?.externalValidationContractRef || "不适用")}</dd><dt>请求目标合同</dt><dd class="mono">${esc(record?.requestedExternalValidationContractRef || "不适用")}</dd><dt>预期验证合同</dt><dd class="mono">${esc(record?.expectedExternalValidationContractRef || "不适用")}</dd><dt>来源模块</dt><dd>${esc(record?.sourceModule || "待确认")}</dd><dt>关联外部运行</dt><dd class="mono">${esc(record?.externalRunId || "不适用")}</dd><dt>关联外部证据</dt><dd class="mono">${esc(record?.externalEvidenceRef || "不适用")}</dd><dt>验证或操作依据</dt><dd class="mono">${esc(record?.decisionRef || "不适用")}${record?.decisionRef === "D064" ? " / CR024" : ""}</dd></dl>${labeledSnapshotDetails}`, btn("关闭", "close-overlay", { primary: true }));
    }
    if (ui.modal?.type === "evidence") return evidenceModal(ui.modal);
    if (ui.modal === "lineageDetail") { const chain = activeDraft()?.sourceDataContract?.sourceChain || []; return modal("完整数据来源链", "由数据工程提供的只读沿袭证据。", chain.length ? `<div class="vertical-lineage">${chain.map((item, i) => `<div><i>${i + 1}</i><span><b>${esc(item)}</b><small>${i < chain.length - 1 ? "数据工程拥有" : "本体只读引用"}</small></span></div>`).join("")}</div><div class="boundary-note"><b>模块边界</b><p>本体管理不能在此修改文件读取、处理步骤、质量检查或数据资产发布配置。</p></div>` : `<div class="empty compact"><span>D</span><h3>尚未取得来源链</h3><p>选择已发布数据资产成员后，可查看数据工程提供的完整只读沿袭。</p></div>`, `${btn("关闭", "close-overlay")}${chain.length ? btn("查看数据工程沿袭", "open-data-engineering-lineage") : ""}${btn("返回语义结构", "view-semantic", { primary: true })}`); }
    if (ui.modal === "reset") {
      const ready = currentScenarioContextReady();
      return modal("重置当前场景工作状态", "提交定向重置请求，等待平台公共层返回新的场景轮次。", `<div class="boundary-note warning"><b>历史证据不会删除</b><p>只清理当前场景轮次的 Draft 与未完成候选；已发布版本、正式采用、失败和回退证据以及其他场景均保留。</p></div>${ready ? "" : `<div class="result-banner error compact"><span>!</span><div><b>当前不能提交重置</b><p>尚未接收平台公共层提供的完整场景运行上下文。损坏状态请先使用权威投影恢复入口，不把占位轮次当作真实场景。</p></div></div>`}`, `${btn("取消", "close-overlay")}${btn("确认定向重置", "confirm-reset", { danger: true, disabled: !ready })}`);
    }
    if (ui.modal === "help") return modal("操作帮助", "空间画布的核心操作", `<ol class="help-list"><li>从“本体建模”选择 Draft，再进入空间画布。</li><li>Object Type 内选择已发布数据资产成员，并进入独立字段映射工作区。</li><li>统一校验通过后发布不可变语义版本。</li><li>在精确 Published 版本中处理待更新数据、业务验证、正式切换和回退。</li></ol>`, btn("知道了", "close-overlay", { primary: true }));
    if (ui.modal === "boundary") return modal("数据工程", "当前页面只提供跨模块只读跳转。", `<div class="empty compact"><span>D</span><h3>数据管道与资产发布由数据工程负责</h3><p>本体管理只选择已发布数据资产成员、完成语义映射并查看完整来源链。</p></div>`, btn("关闭", "close-overlay", { primary: true }));
    if (ui.modal === "s003") return modal("后续场景边界", "S003 场景可在未来创建新的本体 Draft。", `<div class="empty compact"><span>S</span><h3>债务风险监测</h3><p>当前特定数据资产版本不可消费，因此本轮不创建 S003 对象、指标、规则或业务流程；场景本身没有被永久禁用。</p></div>`, btn("关闭", "close-overlay", { primary: true }));
    if (ui.drawer?.type === "draftResource") {
      const resource = findDraftResource(activeDraft(), ui.drawer.id);
      return `<div class="drawer-layer" data-overlay="close"><aside class="drawer"><header><div><span>${esc(TYPE_LABEL[resource?.kind] || "语义资源")}</span><h2>${esc(resource?.name)}</h2><p class="mono">${esc(resource?.id)}</p></div><button data-action="close-overlay">×</button></header><div class="drawer-body"><p class="lead">${esc(resource?.definition || resource?.requirement || resource?.evidence || "Draft 语义资源")}</p>${renderInspector(activeDraft(), resource).replace(/<div class="inspector-head">[\s\S]*?<\/div><div class="inspector-body">/, "<div class=\"drawer-detail\">").replace(/<\/div><div class="inspector-foot">[\s\S]*$/, "</div>")}</div><footer>${btn("关闭", "close-overlay")}${resource ? btn("编辑配置", `edit-resource:${resource.id}`, { primary: true }) : ""}</footer></aside></div>`;
    }
    return "";
  }

  function draftContextChoice(draft, current) {
    return `<button class="${current ? "current" : ""}" data-action="${current ? "close-overlay" : `switch-draft:${draft.id}`}"><span class="context-symbol">${networkIcon("module-network-icon")}</span><div><b>${esc(draft.draftName || draft.name)}</b><small>${esc(draft.name)}${draft.basedOn ? ` · 基于 ${esc(draft.basedOn)}` : " · 全新创建"}</small></div><em>${current ? "正在编辑" : "切换"}</em></button>`;
  }

  function modal(title, subtitle, body, footer, wide = false) {
    return `<div class="modal-layer" data-overlay="close"><section class="modal ${wide ? "wide" : ""}"><header><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button data-action="close-overlay">×</button></header><div class="modal-body">${body}</div><footer>${footer}</footer></section></div>`;
  }

  function refreshLinkEndpointCompatibility() {
    const draft = activeDraft();
    const source = resolveEndpointSelection(draft, document.getElementById("link-source-endpoint")?.value);
    const target = resolveEndpointSelection(draft, document.getElementById("link-target-endpoint")?.value);
    const message = document.getElementById("link-endpoint-compatibility");
    if (!message) return;
    message.className = "endpoint-compatibility";
    if (!source || !target) { message.textContent = "选择两端端点后检查类型兼容性"; return; }
    if (compatibleTypes(source.type, target.type)) {
      message.classList.add("compatible");
      message.textContent = `类型兼容：${source.type} ↔ ${target.type}`;
    } else {
      message.classList.add("blocked");
      message.textContent = `类型不兼容：${source.type} ↔ ${target.type}`;
    }
  }

  function refreshLinkEndpointInputs() {
    const draft = activeDraft();
    const sourceId = document.getElementById("link-source")?.value;
    const targetId = document.getElementById("link-target")?.value;
    const source = draft?.objects.find(item => item.id === sourceId); const target = draft?.objects.find(item => item.id === targetId);
    ui.linkSourceObjectId = sourceId; ui.linkTargetObjectId = targetId;
    const sourceEndpoint = document.getElementById("link-source-endpoint"); const targetEndpoint = document.getElementById("link-target-endpoint");
    if (sourceEndpoint) sourceEndpoint.innerHTML = endpointOptionsForObject(draft, sourceId);
    if (targetEndpoint) targetEndpoint.innerHTML = endpointOptionsForObject(draft, targetId);
    const direction = document.getElementById("link-direction"); if (direction) direction.value = `${source?.name || "起点"} → ${target?.name || "终点"}`;
    const sourceCount = document.querySelector('[data-endpoint-count="source"]'); const targetCount = document.querySelector('[data-endpoint-count="target"]');
    if (sourceCount) sourceCount.textContent = endpointCandidates(draft, source).length;
    if (targetCount) targetCount.textContent = endpointCandidates(draft, target).length;
    refreshLinkEndpointCompatibility();
  }

  function evidenceModal(config) {
    const version = state.publishedVersions.find(v => v.id === config.versionId) || null;
    if (!version) return modal("无法查看证据", "请求的精确语义版本不存在或已无法访问。", `<div class="empty compact"><span>证</span><h3>未找到版本证据</h3><p>系统不会自动改用其他已发布版本的证据。</p></div>`, btn("关闭", "close-overlay", { primary: true }));
    const contract = versionDataContract(version); const records = state.recordsByVersion[version.id] || [];
    const binding = historicalBindingFor(version);
    const formalDataVersion = binding?.dataVersion || null;
    const recordFor = code => formalDataVersion
      ? code === "T019"
        ? records.slice().reverse().find(record => isSuccessfulT019Record(record) && record.dataVersion === formalDataVersion) || null
        : versionRecord(version, code, formalDataVersion)
      : null;
    const externalValidationRecord = formalDataVersion ? externalValidationReferenceRecord(version, formalDataVersion) : null;
    const recordValue = code => {
      if (!formalDataVersion) return "尚未形成正式数据";
      const record = recordFor(code);
      if (!record) return `未找到 ${formalDataVersion} 的对应证据`;
      return `${record.status} · ${record.time} · ${record.evidenceCode || "未形成本体证据"}`;
    };
    const externalValidationValue = () => {
      if (!formalDataVersion) return "尚未形成正式数据";
      if (!externalValidationRecord) return `未找到 ${formalDataVersion} 的智能问数验证引用`;
      return `${externalValidationRecord.status} · ${externalValidationRecord.time} · ${externalValidationRecord.externalRunId || "外部运行待确认"} · ${externalValidationRecord.externalEvidenceRef || "外部证据待确认"}`;
    };
    const publishRecord = records.find(record => record.title === "语义版本已发布") || null;
    const validationSnapshot = version.validationSnapshot || null;
    const resource = config.resourceId ? publishedResources(version).find(item => item.id === config.resourceId) : null;
    const relations = (contract?.relations || []).map(relation => relation.id).join("、") || "未冻结";
    const resourceEvidence = resource ? (() => {
      const dependencyIds = resource.kind === "property" ? [resource.sourceFieldId] : resource.kind === "link" ? [resource.sourceEndpoint?.id, resource.targetEndpoint?.id] : resource.kind === "metric" ? resource.dependencyIds : resource.kind === "rule" ? resource.metricIds : resource.kind === "action" ? [resource.targetObjectId, ...(resource.ruleIds || []), ...(resource.linkIds || [])] : [resource.memberId];
      const located = (dependencyIds || []).filter(Boolean);
      return `<dt>资源依赖定位</dt><dd class="mono">${esc(located.join("、") || "无直接依赖")}</dd><dt>定位状态</dt><dd>${located.length || resource.kind === "object" ? "可定位" : "证据定位缺失"}</dd><dt>责任位置</dt><dd>${located.length || resource.kind === "object" ? "本体管理 · Published 资源定义" : "本体管理 · 映射与依赖"}</dd><dt>恢复方式</dt><dd>${located.length || resource.kind === "object" ? "返回精确版本资源详情继续查看" : "从该版本创建修订 Draft，补齐映射或依赖后重新发布"}</dd>`;
    })() : "";
    const compatibility = consumerValidationFor(version, "智能问数");
    const manifestSnapshot = version.resourceManifestSnapshot || null;
    const body = `<dl class="modal-facts"><dt>精确语义版本</dt><dd>${esc(version?.semanticVersion)}</dd><dt>语义版本标识</dt><dd class="mono">${esc(version?.id)}</dd>${resource ? `<dt>语义资源</dt><dd class="mono">${esc(resource.id)}</dd>` : ""}${resourceEvidence}<dt>资源生命周期快照</dt><dd>${manifestSnapshot?.resources?.length ? `${manifestSnapshot.resources.length} 项 · ${esc(manifestSnapshot.capturedAt || "时间待确认")}` : "待确认；历史版本未形成完整包络"}</dd><dt>发布校验快照</dt><dd>${validationSnapshot?.status === "passed" ? `通过 · ${esc(validationSnapshot.checkedAt)} · ${esc(validationSnapshot.scopeSummary)}` : "待确认；不能根据当前页面反推历史校验结果"}</dd><dt>校验分组</dt><dd>${validationSnapshot?.groups ? `${validationSnapshot.groups.filter(group => group.status === "passed").length}/${validationSnapshot.groups.length} 个范围通过` : "待确认"}</dd><dt>发布时映射数据版本</dt><dd class="mono">${esc(contract?.assetVersion || "未冻结")}</dd><dt>发布时数据截至</dt><dd>${esc(contract?.asOf || "未冻结")}</dd><dt>${isCurrentFormalVersion(version) ? "当前正式数据版本" : binding ? "历史正式数据版本" : "正式数据版本"}</dt><dd class="mono">${esc(formalDataVersion || "尚未切换")}</dd><dt>正式数据截至</dt><dd>${esc(binding?.asOf || "尚未切换")}</dd><dt>成员范围</dt><dd>${esc(contract?.scope || "未冻结")}</dd><dt>资产成员关系</dt><dd class="mono">${esc(relations)}</dd><dt>完整来源链</dt><dd>${esc((contract?.sourceChain || []).join(" → ") || "未冻结")}</dd><dt>发布记录</dt><dd class="mono">${esc(publishRecord ? `${publishRecord.status} · ${publishRecord.time} · ${publishRecord.evidenceCode}` : "尚未生成")}</dd><dt>数据匹配检查</dt><dd class="mono">${esc(recordValue("C029"))}</dd><dt>消费验证条件</dt><dd class="mono">${esc(recordValue("T018"))}</dd><dt>智能问数验证引用</dt><dd class="mono">${esc(externalValidationValue())}</dd><dt>采用合同 / 验证依据</dt><dd class="mono">C008 / D064 · CR024</dd><dt>智能问数兼容状态</dt><dd class="mono">${esc(compatibility ? `${compatibility.status} · ${compatibility.checkedAt || "时间待确认"}` : "尚未收到 C009 只读状态")}</dd><dt>正式版本切换</dt><dd class="mono">${esc(recordValue("T019"))}</dd></dl>`;
    return modal("证据详情", "当前 Published 语义版本的追溯标识", body, btn("关闭", "close-overlay", { primary: true }));
  }

  function addRecord(versionId, title, detail, statusText, tone, dataVersion, contractCode = "", options = {}) {
    const version = state.publishedVersions.find(v => v.id === versionId);
    const formsContract = options.formsContract !== false;
    const record = { id: makeId("record"), title, detail, status: statusText, tone, time: fullNowText(), semanticVersionId: version?.id || null, semanticVersion: version?.semanticVersion, dataVersion, candidateKey: options.candidateKey || null, scenarioContext: clone(scenarioContextOf(options.scenarioContext || version)), evidenceCode: formsContract ? makeId("EV") : null, contractCode, resourceRef: options.resourceRef || null, sourceModule: options.sourceModule || "本体管理", externalRunId: options.externalRunId || null, externalEvidenceRef: options.externalEvidenceRef || null, externalValidationContractRef: options.externalValidationContractRef || null, requestedExternalValidationContractRef: options.requestedExternalValidationContractRef || null, expectedExternalValidationContractRef: options.expectedExternalValidationContractRef || null, externalValidationSnapshot: options.externalValidationSnapshot ? clone(options.externalValidationSnapshot) : null, decisionRef: options.decisionRef || null, formsContract };
    if (!state.recordsByVersion[versionId]) state.recordsByVersion[versionId] = [];
    state.recordsByVersion[versionId].push(record); return record;
  }

  function resetResourceLifecycleForDraft(draft) {
    const reset = resource => {
      ["publicationState", "businessValidityState", "bindability", "effectiveFrom", "effectiveTo", "replaces", "replacedBy", "changeType", "changeReason", "controlledEvidenceLocator", "publishRecordId", "discoverability", "discoveryScope", "applicableScenario", "semanticChangedAt"].forEach(key => delete resource[key]);
      resource.lifecycleState = "Draft";
      if (!resource.lastChangedAt) resource.lastChangedAt = "待确认";
    };
    draft.objects.forEach(object => { reset(object); object.properties.forEach(reset); });
    [...draft.links, ...draft.metrics, ...draft.rules, ...draft.actions].forEach(reset);
  }
  function semanticDefinitionSnapshot(value) {
    if (Array.isArray(value)) return value.map(semanticDefinitionSnapshot);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !PUBLISHED_METADATA_KEYS.has(key)).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, semanticDefinitionSnapshot(item)]));
  }
  function sameSemanticDefinition(left, right) { return !!left && JSON.stringify(semanticDefinitionSnapshot(left)) === JSON.stringify(semanticDefinitionSnapshot(right)); }
  function decoratePublishedResource(resource, kind, baseVersion, draft, publishedAt) {
    const base = baseVersion ? publishedResources(baseVersion).find(item => item.id === resource.id && item.kind === kind) : null;
    const unchanged = !!base && sameSemanticDefinition(resource, base);
    const retiredIds = replacementRetiredIds(draft);
    const retired = retiredIds.has(resource.id);
    const changeType = retired ? "停用" : !base ? "新增" : unchanged ? "沿用" : "修改";
    const replacedSourceIds = draft.release.replacementMode === "替代指定资源"
      ? draft.release.replacementResourceIds.filter(sourceId => draft.release.replacementMap?.[sourceId] === resource.id)
      : [];
    const explicitlyReplaced = replacedSourceIds.length > 0;
    return {
      ...resource,
      owner: resource.owner || draft.release.owner || ONTOLOGY_DEFINITION_OWNER,
      publicationState: "Published",
      businessValidityState: retired ? "停用" : undefined,
      lifecycleState: retired ? "停用" : "Published",
      bindability: retired || ["recommended", "unknown"].includes(resource.businessBasis) ? "不可新绑定" : "可新绑定",
      effectiveFrom: draft.release.effectiveFrom || null,
      effectiveTo: retired ? draft.release.effectiveFrom || null : draft.release.effectiveTo || null,
      replaces: explicitlyReplaced ? replacedSourceIds.map(sourceId => ({ versionId: baseVersion.id, semanticVersion: baseVersion.semanticVersion, resourceId: sourceId })) : [],
      replacedBy: [],
      changeType,
      changeReason: retired
        ? draft.release.replacementResourceIds.includes(resource.id)
          ? `已由本版本中的新稳定身份显式替代：${draft.release.changeReason}`
          : `随父 Object Type 停用；本资源无直接替代：${draft.release.changeReason}`
        : explicitlyReplaced ? draft.release.changeReason : unchanged ? `沿用自 ${baseVersion.semanticVersion}，定义未变` : draft.release.changeReason,
      lastChangedAt: unchanged ? (base.lastChangedAt || baseVersion.publishedAt) : publishedAt,
      controlledEvidenceLocator: "发布成功后形成",
      applicableScenario: draft.scenario || "待确认",
      ...(kind === "link" ? { discoverability: retired ? "不可用于新导航" : "获准发现", discoveryScope: resource.allowedDirection || "待确认" } : {})
    };
  }
  function applyPublishedEvidenceLocator(version, record) {
    const apply = resource => {
      resource.publishRecordId = record?.id || null;
      resource.controlledEvidenceLocator = record ? `${record.evidenceCode} / ${resource.id}` : "待确认";
    };
    version.objects.forEach(object => { apply(object); object.properties.forEach(apply); });
    version.properties.forEach(apply);
    [...version.links, ...version.metrics, ...version.rules, ...version.actions].forEach(apply);
    version.publishRecordId = record?.id || null;
    version.publishEvidenceRef = record?.evidenceCode || null;
    version.controlledEvidenceLocator = record?.evidenceCode || "待确认";
    if (version.resourceManifestSnapshot?.resources?.length) return;
    const capturedAt = record?.time || fullNowText();
    const manifest = publishedResources(version).map(resource => ({
      id: resource.id,
      name: resource.name,
      type: resource.type,
      kind: resource.kind,
      publicationState: resource.publicationState || "Published",
      declaredBusinessValidityState: resource.businessValidityState || null,
      businessValidityAtPublish: businessValidityStateOf(resource),
      owner: resource.owner,
      effectiveFrom: resource.effectiveFrom || null,
      effectiveTo: resource.effectiveTo || null,
      bindability: resource.bindability || "待确认",
      changeType: resource.changeType || "待确认",
      changeReason: resource.changeReason || "待确认",
      replaces: clone(resource.replaces || []),
      replacementDeclaredAtPublish: (resource.replaces || []).length ? `替代 ${(resource.replaces || []).map(replacementReferenceLabel).join("、")}` : "无",
      replacementDetail: (resource.replaces || []).length ? `替代 ${(resource.replaces || []).map(replacementReferenceLabel).join("、")}` : "无",
      lastChangedAt: resource.lastChangedAt || "待确认",
      applicableScenario: resource.applicableScenario || "待确认",
      controlledEvidenceLocator: resource.controlledEvidenceLocator || "待确认",
      capturedAt
    }));
    version.resourceManifestSnapshot = {
      versionId: version.id,
      semanticVersion: version.semanticVersion,
      capturedAt,
      resources: clone(manifest)
    };
  }

  function buildVersion(draft, summary, confirmBusinessBasis = false) {
    ensureDraftReleaseContract(draft); ensureDraftResourceOwners(draft);
    const relatedVersions = state.publishedVersions.filter(version => version.ontologyStableId === draft.ontologyStableId);
    const number = Math.max(0, ...relatedVersions.map(version => Number(String(version.semanticVersion).match(/\d+/)?.[0] || 0))) + 1;
    const id = makeId("semantic");
    const publishedAt = fullNowText();
    const baseVersion = state.publishedVersions.find(version => version.id === draft.basedOnVersionId) || null;
    const objects = clone(draft.objects).map(object => {
      const decoratedProperties = object.properties.map(property => decoratePublishedResource({ ...property, parentId: object.id, parentName: object.name, memberId: object.memberId, definition: property.definition || `${object.name}的${property.name}。` }, "property", baseVersion, draft, publishedAt));
      return decoratePublishedResource({ ...object, properties: decoratedProperties }, "object", baseVersion, draft, publishedAt);
    });
    const properties = objects.flatMap(object => object.properties.map(property => ({ ...property, parentId: object.id, parentName: object.name, memberId: object.memberId })));
    const links = clone(draft.links).map(link => {
      const endpoint = linkEndpointInfo(draft, link);
      return decoratePublishedResource({ ...link, sourceName: objectName(draft, link.source), targetName: objectName(draft, link.target), sourceEndpointLabel: endpoint.sourceLabel, targetEndpointLabel: endpoint.targetLabel, sourceEndpointType: endpoint.sourceType, targetEndpointType: endpoint.targetType, endpointCompatible: endpoint.compatible }, "link", baseVersion, draft, publishedAt);
    });
    const metrics = clone(draft.metrics).map(resource => decoratePublishedResource(resource, "metric", baseVersion, draft, publishedAt));
    const rules = clone(draft.rules).map(resource => decoratePublishedResource(confirmBusinessBasis && resource.businessBasis === "recommended" ? { ...resource, businessBasis: "confirmed" } : resource, "rule", baseVersion, draft, publishedAt));
    const actions = clone(draft.actions).map(resource => decoratePublishedResource(confirmBusinessBasis && resource.businessBasis === "recommended" ? { ...resource, businessBasis: "confirmed" } : resource, "action", baseVersion, draft, publishedAt));
    const activeResources = [...objects, ...properties, ...links, ...metrics, ...rules, ...actions].filter(resource => businessValidityStateOf(resource) !== "停用");
    const bindability = activeResources.length && activeResources.every(resource => resource.bindability === "可新绑定") ? "可新绑定" : "不可新绑定";
    const sourceDeliverySnapshot = clone(dataAssetDeliveryById(draft.sourceDeliveryId) || draft.sourceDataContract || null);
    const sourceDeliveryReceiptSnapshot = clone(draft.sourceDeliveryId ? state.dataAssetDeliveryReceipts?.[draft.sourceDeliveryId] || null : null);
    const sourceDeliveryFingerprint = draft.sourceDeliveryId ? state.dataAssetDeliveryFingerprints?.[draft.sourceDeliveryId] || null : null;
    return { id, ontologyStableId: draft.ontologyStableId, name: draft.name, definition: draft.definition, scenario: draft.scenario, scenarioContext: clone(scenarioContextOf(draft)), semanticVersion: `V${number}`, status: "Published", publicationState: "Published", lifecycleState: "Published", owner: draft.release.owner || ONTOLOGY_DEFINITION_OWNER, bindability, effectiveFrom: draft.release.effectiveFrom || null, effectiveTo: draft.release.effectiveTo || null, replacementDeclaration: draft.release.replacementDeclaration || "待确认", publishedAt, lastChangedAt: publishedAt, sourceDraftId: draft.id, sourceDraftName: draft.draftName || draft.name, sourceDeliveryId: draft.sourceDeliveryId || null, sourceDeliverySnapshot, sourceDeliveryReceiptSnapshot, sourceDeliveryFingerprint, draftRevision: draft.draftRevision || 1, basedOnVersion: draft.basedOn, basedOnVersionId: draft.basedOnVersionId, changeSummary: summary, validationSnapshot: clone(draft.validation?.snapshot || null), dataContract: freezeDataContract(draft, makeId("mapping")), positions: clone(draft.positions), objects, properties, links, metrics, rules, actions };
  }

  function finishPublish(draft, summary, confirmBusinessBasis) {
    if (!state.drafts.includes(draft) || draft.validation?.status !== "success" || draft.publishedVersionId) throw new Error("Draft 状态已变化，请重新校验后发布。");
    if (draft.validation?.snapshot?.status !== "passed" || draft.validation.snapshot.draftId !== draft.id || draft.validation.snapshot.fingerprint !== draftValidationFingerprint(draft)) throw new Error("校验快照已缺失或与当前 Draft 不一致，请重新运行统一校验。");
    const version = buildVersion(draft, summary, confirmBusinessBasis);
    const mapping = publishedMappingContractAssessment(version);
    if (!mapping.complete) throw new Error(`发布时数据映射合同不完整：${mapping.detail}。请返回原位置修正并重新校验。`);
    if (state.publishedVersions.some(item => item.id === version.id)) throw new Error("目标版本标识已存在，请重试发布。");
    draft.publishedVersionId = version.id; draft.status = "已发布"; draft.publishRun = { status: "success", finishedAt: nowText(), versionId: version.id }; touchDraft(draft);
    state.publishedVersions.unshift(version); state.selectedVersionId = version.id; state.recordsByVersion[version.id] = [];
    const publishRecord = addRecord(version.id, "语义版本已发布", "统一校验通过后形成不可变 Published 快照；尚未切换正式数据。", "成功", "green", null, "C007");
    applyPublishedEvidenceLocator(version, publishRecord);
    if (draft.pendingUpdate) addRecord(version.id, "等待重新提交数据更新", `原待更新数据 ${draft.pendingUpdate.dataVersion} 只保留为修订来源证据；新语义版本需要先建立数据刷新目标，再由数据工程重新读取并提交新的更新请求。`, "等待外部提交", "blue", draft.pendingUpdate.dataVersion, "", { sourceModule: "本体管理", externalRunId: draft.pendingUpdate.requestId, externalEvidenceRef: draft.pendingUpdate.requestEvidenceLocator, formsContract: false });
    state.activeDraftId = state.drafts.find(item => !item.publishedVersionId)?.id || null; persist();
    go(`published/version?id=${version.id}&tab=overview`); toast(`${version.semanticVersion} 已发布；正式数据仍保持不变`);
  }

  function createRevisionDraft(version) {
    const currentContext = currentScenarioContext();
    if (!currentScenarioContextReady()) throw new Error("当前尚未取得平台公共层提供的完整场景运行上下文，不能创建修订 Draft");
    if (!sameScenarioDefinition(version, currentContext)) throw new Error("来源 Published 版本不属于当前场景及版本，不能跨场景创建修订 Draft");
    const siblingCount = state.drafts.filter(draft => !draft.publishedVersionId && draft.basedOnVersionId === version.id && sameScenarioEnvelope(draft, currentContext)).length;
    const draft = {
      id: makeId("draft"), ontologyStableId: version.ontologyStableId, name: version.name, definition: version.definition, scenario: version.scenario,
      scenarioContext: clone(currentContext), sourceDeliveryId: version.sourceDeliveryId || null, draftRevision: (version.draftRevision || 1) + 1, replacesDraftId: null,
      draftName: `${version.semanticVersion} 修订 Draft${siblingCount ? ` ${siblingCount + 1}` : ""}`, status: "Draft", createdAt: nowText(), updatedAt: nowText(),
      basedOn: version.semanticVersion, basedOnVersionId: version.id, sourceDataContract: clone(receivedDataAsset(version.dataContract?.assetId, version.dataContract?.assetVersion) || version.dataContract),
      objects: clone(version.objects), links: clone(version.links), metrics: clone(version.metrics), rules: clone(version.rules), actions: clone(version.actions),
      positions: clone(version.positions || POSITION_PRESET), canvasView: { zoom: .64, pan: { x: 24, y: 28 } }, validation: { status: "idle", checkedAt: null, issues: [] }, publishedVersionId: null,
      release: { owner: version.owner || ONTOLOGY_DEFINITION_OWNER, effectiveFrom: "", effectiveTo: "", changeReason: "待确认", replacementMode: "待确认", replacementResourceIds: [], replacementMap: {}, replacementDeclaration: "待确认", evidenceState: "尚未形成", confirmed: false }
    };
    resetResourceLifecycleForDraft(draft);
    ensureDraftResourceOwners(draft);
    ensureDraftSemanticTracking(draft);
    state.drafts.unshift(draft); state.activeDraftId = draft.id; ui.selectedNode = null; ui.workspaceView = "semantic"; loadDraftCanvasView(draft); persist();
    return draft;
  }

  function confirmAddObject() {
    const draft = activeDraft();
    const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "object" ? editingRef.resource : null;
    const name = document.getElementById("object-name")?.value.trim();
    const id = editing?.id || stableSemanticId("OBJ", document.getElementById("object-code")?.value);
    const objectKind = document.getElementById("object-kind")?.value || "业务实体";
    const definition = document.getElementById("object-definition")?.value.trim();
    if (!draft || !name || !id || !definition) return toast("请填写业务名称、英文业务编码和业务定义", "error");
    if (draft.objects.some(item => item.id !== editing?.id && item.name === name)) return toast("当前 Draft 已有同名 Object Type", "error");
    if (!editing && stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    if (editing) {
      editing.name = name; editing.definition = definition; editing.objectKind = objectKind;
      draft.rules.filter(rule => rule.objectId === editing.id).forEach(rule => { rule.appliesTo = name; });
      draft.actions.filter(action => action.targetObjectId === editing.id).forEach(action => { action.target = name; });
      resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; persist(); render();
      return toast("Object Type 修改已保存，请重新运行统一校验");
    }
    const position = nextResourcePosition(draft, "object");
    draft.objects.push({ id, name, definition, objectKind, owner: draft.release?.owner || "", identity: null, title: null, memberId: null, count: 0, properties: [], linkEndpointFields: [], terms: defaultTerms({ id, name }), lastChangedAt: fullNowText() });
    draft.positions[id] = position; resetDraftValidation(draft); state.activeDraftId = draft.id; ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist();
    go(`modeling/object?draft=${draft.id}&id=${encodeURIComponent(id)}&tab=overview`);
    return toast("Object Type 已创建，请继续选择已发布数据资产成员");
  }

  function confirmAssetMember() {
    const draft = activeDraft(); const object = draft?.objects.find(item => item.id === ui.assetObjectId);
    const catalogContract = availableDataAssets().find(contract => contract.assetVersion === ui.assetContractVersion) || draft?.sourceDataContract || availableDataAssets()[0] || null;
    const member = catalogContract?.members?.find(item => item.id === ui.assetChoice);
    if (!draft || !object || !member) return toast("请选择数据资产成员", "error");
    if (draft.sourceDataContract && draft.sourceDataContract.assetVersion !== catalogContract.assetVersion) {
      if (draft.sourceDataContract.assetId !== catalogContract.assetId || !sameScenarioEnvelope(draft, catalogContract)) return toast("只能在同一数据资产和完整场景轮次内显式升级 Draft 数据合同", "error");
      const upgradeIssues = [];
      draft.objects.forEach(currentObject => {
        if (!currentObject.memberId) return;
        const candidateMember = catalogContract.members?.find(item => item.id === currentObject.memberId);
        if (!candidateMember) { upgradeIssues.push(`${currentObject.name}的成员在新版本中缺失`); return; }
        currentObject.properties.forEach(property => {
          if (!property.sourceFieldId) return;
          const candidateField = candidateMember.fields?.find(field => field[3] === property.sourceFieldId || field.fieldId === property.sourceFieldId);
          const candidateType = Array.isArray(candidateField) ? candidateField[1] : candidateField?.type;
          if (!candidateField || !compatibleTypes(candidateType, property.dataType)) upgradeIssues.push(`${currentObject.name}.${property.name}在新版本中缺失或类型不兼容`);
        });
      });
      if (upgradeIssues.length) return toast(`新数据合同不能直接应用：${upgradeIssues[0]}`, "error");
      draft.sourceDataContract = clone(catalogContract); draft.sourceDeliveryId = catalogContract.deliveryId || null; draft.sourceAssetVersion = catalogContract.assetVersion; draft.draftRevision = Number(draft.draftRevision || 1) + 1;
      const receipt = catalogContract.deliveryId ? state.dataAssetDeliveryReceipts?.[catalogContract.deliveryId] : null;
      if (receipt?.status === "accepted") { receipt.targetDraftId = draft.id; receipt.targetDraftRevision = draft.draftRevision; receipt.appliedAt = fullNowText(); receipt.reason = "合同校验通过，已由用户显式应用到当前 Draft。"; }
    } else if (!draft.sourceDataContract) {
      draft.sourceDataContract = clone(catalogContract);
      draft.sourceDeliveryId = catalogContract.deliveryId || null;
      draft.sourceAssetVersion = catalogContract.assetVersion || null;
    }
    const expectedBlueprint = OBJECT_BLUEPRINTS.find(item => item.id === object.id);
    if (expectedBlueprint && !memberCompatibleWithObject(member, object)) return toast(`${member.name}的业务粒度不适配${object.name}，请选择与对象粒度一致的成员`, "error");
    if (!expectedBlueprint && !document.getElementById("member-grain-confirm")?.checked) return toast("自建 Object 需要先确认数据成员粒度与业务对象一致", "error");
    object.memberId = member.id; object.count = member.rows;
    const fields = fieldRecordsFor(draft, object, member); const fieldIds = new Set(fields.map(field => field.id));
    let blocked = 0;
    object.properties.forEach(property => {
      const field = property.sourceFieldId ? fields.find(item => item.id === property.sourceFieldId) : null;
      if (!field || !compatibleTypes(field.type, property.dataType)) {
        if (property.sourceField || property.sourceFieldId) blocked += 1;
        property.sourceField = null; property.sourceFieldId = null; property.status = "阻断";
      } else {
        property.sourceField = field.name; property.sourceFieldId = field.id; property.status = "已映射";
      }
    });
    object.linkEndpointFields = (object.linkEndpointFields || []).filter(id => fieldIds.has(id));
    resetDraftValidation(draft); ui.modal = null; persist(); render();
    return toast(blocked ? `已选择 ${member.name}；${blocked} 项旧映射需重新配置` : `已选择 ${member.name}；尚未自动创建任何 Property`, blocked ? "error" : "");
  }

  function confirmAddProperty() {
    const draft = activeDraft(); const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "property" ? editingRef.resource : null;
    const objectId = editingRef?.parentObject?.id || document.getElementById("property-object")?.value || ui.propertyObjectId; const object = draft?.objects.find(item => item.id === objectId);
    const field = object ? fieldRecordsFor(draft, object).find(item => item.id === ui.propertyFieldChoice) : null;
    const name = document.getElementById("property-name")?.value.trim() || field?.name;
    const dataType = document.getElementById("property-type")?.value || field?.type || "文本";
    const unit = document.getElementById("property-unit")?.value.trim() || "—";
    const nullable = editing?.id === object?.identity ? "否" : document.getElementById("property-nullable")?.value || "是";
    const definition = document.getElementById("property-definition")?.value.trim();
    const id = editing?.id || stableSemanticId("PROP", document.getElementById("property-code")?.value);
    if (!draft || !object || !name || !id || !definition) return toast("请填写 Property 名称、英文业务编码和业务定义", "error");
    if (dataType === "数值" && (!unit || unit === "—")) return toast("数值 Property 必须填写业务单位", "error");
    if (field && !compatibleTypes(field.type, dataType)) return toast(`类型不兼容：${field.type} 不能映射到 ${dataType}`, "error");
    if (object.properties.some(item => item.id !== editing?.id && item.name === name)) return toast("当前 Object Type 已有同名 Property", "error");
    if (!editing && stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    if (field && object.properties.some(item => item.id !== editing?.id && item.sourceFieldId === field.id)) return toast("该字段已映射到其他 Property", "error");
    if (editing) {
      editing.name = name; editing.dataType = dataType; editing.unit = unit; editing.nullable = nullable; editing.definition = definition;
      editing.sourceFieldId = field?.id || null; editing.sourceField = field?.name || null; editing.status = field ? "已映射" : "阻断";
      resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.propertyForm = null; ui.mappingProperty = editing.id; ui.mappingSource = field?.id || null; persist(); render();
      return toast("Property 修改已保存，请重新运行统一校验");
    }
    const property = { id, name, dataType, unit, definition, owner: draft.release?.owner || "", nullable, role: "普通属性", linkEndpoint: false, sourceFieldId: field?.id || null, sourceField: field?.name || null, status: field ? "已映射" : "阻断", terms: defaultTerms({ id, name }), lastChangedAt: fullNowText() };
    object.properties.push(property); resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.propertyForm = null; ui.mappingProperty = property.id; ui.mappingSource = field?.id || null; persist();
    if (field) go(`modeling/mapping?draft=${draft.id}&object=${encodeURIComponent(object.id)}&property=${encodeURIComponent(property.id)}`);
    else go(`modeling/object?draft=${draft.id}&id=${encodeURIComponent(object.id)}&tab=properties`);
    return toast(field ? "Property 已创建并建立明确映射" : "Property 已创建，请继续配置字段映射");
  }

  function confirmAddLink() {
    const draft = activeDraft();
    const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "link" ? editingRef.resource : null;
    const name = document.getElementById("link-name")?.value.trim(); const reverseName = document.getElementById("link-reverse-name")?.value.trim(); const allowedDirection = document.getElementById("link-allowed-direction")?.value; const id = editing?.id || stableSemanticId("LINK", document.getElementById("link-code")?.value);
    const source = document.getElementById("link-source")?.value; const target = document.getElementById("link-target")?.value;
    const cardinality = document.getElementById("link-cardinality")?.value; const definition = document.getElementById("link-definition")?.value.trim();
    const sourceCandidate = resolveEndpointSelection(draft, document.getElementById("link-source-endpoint")?.value);
    const targetCandidate = resolveEndpointSelection(draft, document.getElementById("link-target-endpoint")?.value);
    if (!draft || !name || !reverseName || !ALLOWED_LINK_DIRECTIONS.includes(allowedDirection) || !id || !definition || !source || !target || source === target) return toast("请填写正反向名称、获准导航方向、英文业务编码和定义，并选择不同的起点和终点", "error");
    if (!sourceCandidate || !targetCandidate || sourceCandidate.objectId !== source || targetCandidate.objectId !== target) return toast("请为关系两端选择有效的稳定端点", "error");
    if (!compatibleTypes(sourceCandidate.type, targetCandidate.type)) return toast(`端点类型不兼容：${sourceCandidate.type} 与 ${targetCandidate.type}`, "error");
    if (draft.links.some(item => item.id !== editing?.id && item.name === name)) return toast("当前 Draft 已有同名 Link Type", "error");
    if (!editing && stableIdExists(draft, id)) return toast("稳定语义身份已被使用", "error");
    const endpoint = candidate => ({ kind: candidate.kind, id: candidate.id, ...(candidate.kind === "assetField" ? { memberId: candidate.memberId } : {}) });
    if (editing) {
      Object.assign(editing, { name, reverseName, allowedDirection, source, target, cardinality, definition, coverage: "等待关系覆盖检查", sourceEndpoint: endpoint(sourceCandidate), targetEndpoint: endpoint(targetCandidate) });
      if (draft.pendingFieldChange && [editing.sourceEndpoint?.id, editing.targetEndpoint?.id].includes(draft.pendingFieldChange.toId)) draft.pendingFieldChange.mapped = true;
      resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render();
      return toast("Link Type 修改已保存，请重新运行统一校验");
    }
    const position = nextResourcePosition(draft, "link");
    draft.links.push({ id, name, reverseName, allowedDirection, owner: draft.release?.owner || "", source, target, cardinality, definition, coverage: "等待关系覆盖检查", sourceEndpoint: endpoint(sourceCandidate), targetEndpoint: endpoint(targetCandidate), terms: defaultTerms({ id, name }), lastChangedAt: fullNowText() });
    draft.positions[id] = position; resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render();
    return toast("Link Type 已创建，关系端点类型已确认兼容");
  }

  function confirmAddMetric() {
    const draft = activeDraft(); const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "metric" ? editingRef.resource : null;
    const name = document.getElementById("metric-name")?.value.trim(); const id = editing?.id || stableSemanticId("MET", document.getElementById("metric-code")?.value);
    const unit = document.getElementById("metric-unit")?.value.trim(); const sourceObjectId = document.getElementById("metric-source-object")?.value; const subjectObjectId = document.getElementById("metric-subject-object")?.value;
    const time = document.getElementById("metric-time")?.value.trim(); const scope = document.getElementById("metric-scope")?.value.trim(); const definition = document.getElementById("metric-definition")?.value.trim(); const calculation = document.getElementById("metric-calculation")?.value.trim(); const zeroHandling = document.getElementById("metric-zero")?.value.trim(); const dependencyIds = checkedValues("metric-dep");
    if (!draft || !name || !id || !unit || !sourceObjectId || !subjectObjectId || !time || !scope || !definition || !calculation || !zeroHandling || !dependencyIds.length) return toast("请完整填写 Metric 口径并选择依赖资源", "error");
    if (draft.metrics.some(item => item.id !== editing?.id && item.name === name) || (!editing && stableIdExists(draft, id))) return toast("Metric 名称或稳定语义身份已被使用", "error");
    if (editing) {
      Object.assign(editing, { name, unit, sourceObjectId, subjectObjectId, time, scope, definition, calculation, zeroHandling, dependencyIds });
      draft.rules.forEach(rule => { rule.dependency = (rule.metricIds || []).map(metricId => draft.metrics.find(item => item.id === metricId)?.name || metricId).join("、"); });
      resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render(); return toast("Metric 修改已保存，请重新运行统一校验");
    }
    const position = nextResourcePosition(draft, "metric");
    draft.metrics.push({ id, name, type: "Metric", owner: draft.release?.owner || "", unit, sourceObjectId, subjectObjectId, time, scope, definition, calculation, zeroHandling, dependencyIds, terms: defaultTerms({ id, name }), lastChangedAt: fullNowText() });
    draft.positions[id] = position; resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render(); return toast("Metric 已创建");
  }

  function confirmAddRule() {
    const draft = activeDraft(); const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "rule" ? editingRef.resource : null;
    const name = document.getElementById("rule-name")?.value.trim(); const code = document.getElementById("rule-code")?.value.trim(); const id = editing?.id || stableSemanticId("RULE", document.getElementById("rule-business-code")?.value);
    const businessBasis = document.getElementById("rule-business-basis")?.value;
    const objectId = document.getElementById("rule-object")?.value; const condition = document.getElementById("rule-condition")?.value.trim(); const validity = document.getElementById("rule-validity")?.value.trim(); const testSample = document.getElementById("rule-test-sample")?.value.trim(); const bankRanking = document.getElementById("rule-bank-ranking")?.value.trim(); const evidence = document.getElementById("rule-evidence")?.value.trim(); const definition = document.getElementById("rule-definition")?.value.trim(); const metricIds = checkedValues("rule-dep");
    if (!draft || !name || !code || !id || !["recommended", "unknown"].includes(businessBasis) || !objectId || !condition || !validity || !testSample || !bankRanking || !evidence || !definition || !metricIds.length) return toast("请完整填写 Rule、业务口径状态、有效期、测试样例和机构排序，并选择依赖 Metric", "error");
    if (draft.rules.some(item => item.id !== editing?.id && (item.name === name || item.code === code)) || (!editing && stableIdExists(draft, id))) return toast("Rule 名称、编号或稳定语义身份已被使用", "error");
    const appliesTo = objectName(draft, objectId); const dependency = metricIds.map(metricId => draft.metrics.find(item => item.id === metricId)?.name || metricId).join("、"); const position = nextResourcePosition(draft, "rule");
    if (editing) {
      Object.assign(editing, { name, code, businessBasis, objectId, appliesTo, condition, validity, testSample, bankRanking, evidence, definition, metricIds, dependency });
      resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render(); return toast("Rule 修改已保存，请重新运行统一校验");
    }
    draft.rules.push({ id, name, code, type: "Rule", owner: draft.release?.owner || "", businessBasis, decisionRefs: [], objectId, appliesTo, condition, validity, testSample, bankRanking, evidence, definition, metricIds, dependency, terms: defaultTerms({ id, name }), lastChangedAt: fullNowText() });
    draft.positions[id] = position; resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render(); return toast("Rule 已创建");
  }

  function confirmAddAction() {
    const draft = activeDraft(); const editingRef = mutableDraftResource(draft, ui.editResourceId); const editing = editingRef?.kind === "action" ? editingRef.resource : null;
    const name = document.getElementById("action-name")?.value.trim(); const id = editing?.id || stableSemanticId("ACTION", document.getElementById("action-code")?.value); const targetObjectId = document.getElementById("action-object")?.value;
    const parameters = document.getElementById("action-parameters")?.value.trim(); const prerequisite = document.getElementById("action-prerequisite")?.value.trim(); const result = document.getElementById("action-result")?.value.trim(); const failure = document.getElementById("action-failure")?.value.trim(); const defaultDue = document.getElementById("action-default-due")?.value.trim(); const confirmation = document.getElementById("action-confirmation")?.value; const definition = document.getElementById("action-definition")?.value.trim(); const ruleIds = checkedValues("action-rule"); const linkIds = checkedValues("action-link");
    if (!draft || !name || !id || !targetObjectId || !parameters || !prerequisite || !result || !failure || !defaultDue || !confirmation || !definition || !ruleIds.length) return toast("请完整填写 Action Type、失败表现和办理期限，并选择依赖 Rule", "error");
    if (draft.actions.some(item => item.id !== editing?.id && item.name === name) || (!editing && stableIdExists(draft, id))) return toast("Action Type 名称或稳定语义身份已被使用", "error");
    const target = objectName(draft, targetObjectId); const requirement = `${confirmation}；${result}`; const position = nextResourcePosition(draft, "action");
    if (editing) {
      Object.assign(editing, { name, targetObjectId, target, inputs: parameters, parameters, prerequisite, result, failure, defaultDue, confirmation, definition, requirement, ruleIds, linkIds });
      resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render(); return toast("Action Type 修改已保存，请重新运行统一校验");
    }
    draft.actions.push({ id, name, type: "Action Type", owner: draft.release?.owner || "", targetObjectId, target, inputs: parameters, parameters, prerequisite, result, failure, defaultDue, confirmation, definition, requirement, ruleIds, linkIds, terms: defaultTerms({ id, name }), lastChangedAt: fullNowText() });
    draft.positions[id] = position; resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = id; persist(); render(); return toast("Action Type 已创建");
  }

  function connectMapping() {
    const draft = activeDraft(); const object = draft?.objects.find(item => item.id === routeParams().get("object")); const field = fieldRecordsFor(draft, object).find(item => item.id === ui.mappingSource); const property = object?.properties.find(item => item.id === (ui.mappingProperty || routeParams().get("property")));
    if (!field || !property) return toast("请先选择数据资产字段和本体 Property", "error");
    if (!compatibleTypes(field.type, property.dataType)) return toast(`类型不兼容：${field.type} 不能直接映射到 ${property.dataType}`, "error");
    const duplicate = object.properties.find(item => item.id !== property.id && item.sourceFieldId === field.id);
    if (duplicate) return toast(`${field.name} 已映射到 ${duplicate.name}，请先选择其他字段`, "error");
    property.sourceFieldId = field.id; property.sourceField = field.name; property.status = "已映射"; resetDraftValidation(draft); ui.mappingProperty = property.id; ui.mappingSource = field.id; persist(); render(); return toast("字段映射已保存；请重新运行统一校验");
  }

  function toggleFieldEndpoint(objectId, fieldId) {
    const draft = activeDraft(); const object = draft?.objects.find(item => item.id === objectId); const field = fieldRecordsFor(draft, object).find(item => item.id === fieldId);
    if (!draft || !object || !field) return toast("未找到可配置的数据资产字段", "error");
    object.linkEndpointFields = object.linkEndpointFields || []; const index = object.linkEndpointFields.indexOf(field.id);
    if (index >= 0) object.linkEndpointFields.splice(index, 1); else object.linkEndpointFields.push(field.id);
    resetDraftValidation(draft); persist(); render(); return toast(index >= 0 ? "已取消数据字段的 Link 端点用途" : "数据字段已可用于 Link 端点");
  }

  function handleAction(action) {
    if (!action || action === "noop") return;
    if (action === "return-data-engineering") {
      const context = handoffContext();
      const safeTarget = safeReturnTarget(context?.returnTo);
      if (!context || !safeTarget || !resolvedExternalValue(context.dataAssetId)) return toast("返回上下文缺少安全地址或稳定数据资产身份", "error");
      ui.handoffReturning = true; render();
      try {
        const discovery = discoverRefreshTargets({ dataAssetId: context.dataAssetId, readPurpose: "返回重读", returnTo: safeTarget, scenarioContext: context.scenarioContext });
        const target = returnTargetWithFreshRead(context, discovery);
        if (!target) throw new Error("无法形成安全返回地址");
        window.location.href = target;
      } catch (error) {
        ui.handoffReturning = false; render(); return toast(error?.message || "返回数据工程未完成，请重试", "error");
      }
      return;
    }
    if (action === "nav-modeling") { ui.resourceFilter = "all"; return go("modeling"); }
    if (action === "nav-published") return go("published");
    if (action.startsWith("filter-drafts:")) { ui.resourceFilter = action.split(":")[1] || "all"; return render(); }
    if (action.startsWith("validation-group:")) { ui.validationGroup = action.split(":")[1] || "all"; return render(); }
    if (action === "go-workbench") return go(`modeling/workbench?draft=${activeDraft()?.id || ""}`);
    if (action === "open-help") { ui.modal = "help"; return render(); }
    if (action === "open-reset") { ui.modal = "reset"; return render(); }
    if (action === "open-boundary") { ui.modal = "boundary"; return render(); }
    if (action === "open-s003") { ui.modal = "s003"; return render(); }
    if (action === "close-overlay") { ui.modal = null; ui.drawer = null; ui.editResourceId = null; ui.propertyForm = null; return render(); }
    if (action === "open-create-draft") { ui.editResourceId = null; ui.propertyForm = null; ui.modal = "createDraft"; return render(); }
    if (action === "confirm-create-draft") {
      const name = document.getElementById("draft-name")?.value.trim();
      const ontologyStableId = stableSemanticId("ONT", document.getElementById("draft-code")?.value);
      const definition = document.getElementById("draft-definition")?.value.trim();
      const scenario = document.getElementById("draft-scenario")?.value.trim() || "暂不指定";
      if (!name || !ontologyStableId || !definition) return toast("请填写本体业务名称、英文业务编码和业务定义", "error");
      if (!currentScenarioContextReady()) return toast(state.pendingScenarioReset ? "正在等待平台返回新的场景轮次，暂不能创建 Draft" : "尚未接收平台当前场景的完整运行上下文，暂不能创建 Draft", "error");
      if (!scenarioInputMatchesCurrent(scenario)) {
        state.scenarioActivationIntent = { requestedScenario: scenario, requestedAt: fullNowText(), status: "等待平台激活", currentScenarioContext: currentScenarioContext() };
        ui.modal = "scenarioActivation"; persist(); render(); return toast("已记录场景切换意图；平台激活前不会创建 Draft");
      }
      if (state.drafts.some(item => item.ontologyStableId === ontologyStableId) || state.publishedVersions.some(item => item.ontologyStableId === ontologyStableId)) return toast("稳定语义身份已被使用；请从已发布版本创建修订", "error");
      const current = currentScenarioContext();
      const draft = emptyDraft(name, ontologyStableId, definition, scenarioDisplayLabel(current));
      state.drafts.unshift(draft); state.activeDraftId = draft.id; ui.modal = null; ui.selectedNode = null; ui.workspaceView = "semantic"; loadDraftCanvasView(draft); ui.canvasDraftId = draft.id; persist(); go(`modeling/workbench?draft=${draft.id}`); return toast("本体 Draft 已创建，请先建立 Object Type 业务骨架");
    }
    if (action === "open-draft-switcher") { ui.modal = "draftSwitcher"; return render(); }
    if (action.startsWith("open-terms:")) { ui.modal = { type: "terms", resourceId: action.split(":")[1] }; return render(); }
    if (action === "confirm-terms") {
      const ref = mutableDraftResource(activeDraft(), ui.modal?.resourceId); if (!ref?.resource) return toast("未找到可编辑语义资源", "error");
      const preferredName = document.getElementById("terms-preferred")?.value.trim();
      const discouraged = document.getElementById("terms-discouraged")?.value.trim() || ""; const discouragedReason = document.getElementById("terms-discouraged-reason")?.value.trim() || "";
      if (!preferredName) return toast("请填写首选业务名称", "error");
      if (discouraged && !discouragedReason) return toast("配置不推荐表达时必须说明原因", "error");
      ref.resource.terms = { preferredName, synonyms: (document.getElementById("terms-synonyms")?.value || "").split(/[、,，]/).map(item => item.trim()).filter(Boolean), abbreviation: document.getElementById("terms-abbreviation")?.value.trim() || "", discouraged, discouragedReason };
      resetDraftValidation(); ui.modal = null; persist(); render(); return toast("业务术语已保存，请重新运行统一校验");
    }
    if (action.startsWith("open-draft:") || action.startsWith("switch-draft:") || action.startsWith("continue-revision:")) {
      const id = action.split(":")[1]; const draft = state.drafts.find(item => item.id === id && !item.publishedVersionId && sameScenarioEnvelope(item, currentScenarioContext())); if (!draft) return toast("未找到当前场景轮次可编辑的 Draft", "error");
      state.activeDraftId = id; ui.modal = null; ui.selectedNode = null; ui.workspaceView = "semantic"; loadDraftCanvasView(draft); ui.canvasDraftId = draft.id; persist(); return go(`modeling/workbench?draft=${draft.id}`);
    }
    if (action.startsWith("open-version-from-switcher:")) { const id = action.split(":")[1]; ui.modal = null; state.selectedVersionId = id; persist(); return go(`published/version?id=${id}&tab=overview`); }
    if (action.startsWith("open-refresh-target:")) {
      const version = state.publishedVersions.find(item => item.id === action.split(":")[1]);
      if (!version) return toast("未找到精确 Published 版本", "error");
      ui.modal = { type: "refreshTarget", versionId: version.id }; return render();
    }
    if (action === "confirm-create-refresh-target") {
      const version = ui.modal?.type === "refreshTarget" ? state.publishedVersions.find(item => item.id === ui.modal.versionId) : selectedVersion();
      if (!version) return toast("未找到精确 Published 版本", "error");
      const writeIssue = currentVersionWriteIssue(version);
      if (writeIssue) return toast(writeIssue, "error");
      const mapping = publishedMappingContractAssessment(version);
      if (!mapping.complete || !publishedResourceAvailable(version)) return toast("发布时映射或业务有效状态不满足建立刷新目标的条件", "error");
      const target = appendRefreshTargetVersion(version, "active");
      const context = handoffContext();
      if (context && context.dataAssetId && context.dataAssetId !== target.dataAssetId) { ui.modal = null; persist(); render(); return toast("已建立目标，但与返回的数据资产不匹配；返回后将被阻断", "error"); }
      ui.modal = null; persist(); render(); return toast(`已建立数据刷新目标 ${target.bindingVersion}；返回时将重新读取`);
    }
    if (action === "request-stop-refresh-target") {
      const versionId = ui.modal?.type === "refreshTarget" ? ui.modal.versionId : selectedVersion()?.id;
      const version = state.publishedVersions.find(item => item.id === versionId);
      if (!versionId || !latestRefreshTarget(version)) return toast("未找到可停用的数据刷新目标", "error");
      const writeIssue = currentVersionWriteIssue(version);
      if (writeIssue) return toast(writeIssue, "error");
      ui.modal = { type: "confirmRefreshTargetStop", versionId }; return render();
    }
    if (action === "confirm-stop-refresh-target") {
      const version = ui.modal?.type === "confirmRefreshTargetStop" ? state.publishedVersions.find(item => item.id === ui.modal.versionId) : null;
      const currentTarget = latestRefreshTarget(version);
      const reason = document.getElementById("refresh-target-stop-reason")?.value.trim();
      const writeIssue = currentVersionWriteIssue(version);
      if (writeIssue) return toast(writeIssue, "error");
      if (!version || !currentTarget || refreshTargetAssessment(version, currentTarget, versionDataContract(version)?.assetId).key === "disabled") return toast("目标状态已变化，请重新查看", "error");
      if (!reason) return toast("请填写停用原因", "error");
      const target = appendRefreshTargetVersion(version, "disabled", reason);
      ui.modal = null; persist(); render(); return toast(`已停用数据刷新目标 ${target.bindingVersion}`);
    }
    if (action.startsWith("clone-version:")) {
      const version = state.publishedVersions.find(v => v.id === action.split(":")[1]); if (!version) return;
      if (!currentScenarioContextReady()) return toast(state.pendingScenarioReset ? "正在等待平台返回新的场景轮次，暂不能创建修订 Draft" : "尚未接收平台当前场景的完整运行上下文，暂不能创建修订 Draft", "error");
      const existing = state.drafts.filter(draft => !draft.publishedVersionId && draft.basedOnVersionId === version.id && sameScenarioEnvelope(draft, currentScenarioContext()));
      if (existing.length) { ui.modal = { type: "revisionChoice", versionId: version.id }; return render(); }
      try { const draft = createRevisionDraft(version); ui.canvasDraftId = draft.id; return go(`modeling/workbench?draft=${draft.id}`); } catch (error) { return toast(error.message, "error"); }
    }
    if (action.startsWith("create-revision:")) {
      const version = state.publishedVersions.find(item => item.id === action.split(":")[1]); if (!version) return toast("未找到所选 Published 版本", "error");
      if (!currentScenarioContextReady()) return toast(state.pendingScenarioReset ? "正在等待平台返回新的场景轮次，暂不能创建修订 Draft" : "尚未接收平台当前场景的完整运行上下文，暂不能创建修订 Draft", "error");
      try { ui.modal = null; const draft = createRevisionDraft(version); ui.canvasDraftId = draft.id; go(`modeling/workbench?draft=${draft.id}`); return toast(`已基于 ${version.semanticVersion} 创建独立修订 Draft`); } catch (error) { return toast(error.message, "error"); }
    }
    if (action === "open-add-object") { ui.editResourceId = null; ui.modal = "addObject"; return render(); }
    if (action.startsWith("request-delete-object:")) {
      const objectId = action.slice("request-delete-object:".length); const draft = activeDraft(); const object = draft?.objects.find(item => item.id === objectId);
      if (!object) return toast("未找到所选 Object Type", "error");
      ui.modal = { type: "confirmDeleteObject", objectId }; return render();
    }
    if (action === "confirm-delete-object") {
      const draft = activeDraft(); const objectId = ui.modal?.type === "confirmDeleteObject" ? ui.modal.objectId : null; const object = draft?.objects.find(item => item.id === objectId);
      if (!draft || !object) return toast("所选 Object Type 已不存在，请刷新后重试", "error");
      const hasDependencies = !!object.memberId || !!object.properties?.length || draft.links.some(item => item.source === objectId || item.target === objectId) || draft.metrics.some(item => item.sourceObjectId === objectId || item.subjectObjectId === objectId) || draft.rules.some(item => item.objectId === objectId) || draft.actions.some(item => item.targetObjectId === objectId);
      if (hasDependencies) return toast("该 Object Type 已有数据成员、Property 或业务依赖，不能作为空白对象删除", "error");
      draft.objects = draft.objects.filter(item => item.id !== objectId); delete draft.positions[objectId]; resetDraftValidation(draft); ui.modal = null; ui.editResourceId = null; ui.selectedNode = null; touchDraft(draft); persist(); go(`modeling/workbench?draft=${draft.id}`); return toast("空白 Object Type 已删除；历史 Published 版本未受影响");
    }
    if (action === "confirm-add-object") return confirmAddObject();
    if (action === "open-add-resource") { ui.editResourceId = null; ui.modal = "addResource"; return render(); }
    if (action.startsWith("open-add-property")) {
      const parts = action.split(":"); const selected = parts[1] || (findDraftResource(activeDraft(), ui.selectedNode)?.kind === "object" ? ui.selectedNode : activeDraft()?.objects[0]?.id);
      if (!selected) return toast("请先创建 Object Type", "error");
      ui.editResourceId = null; ui.propertyForm = null; ui.propertyObjectId = selected; ui.propertyFieldChoice = parts[2] || null; ui.modal = "addProperty"; return render();
    }
    if (action.startsWith("choose-property-field:")) {
      capturePropertyForm(); ui.propertyFieldChoice = action.slice("choose-property-field:".length);
      const object = activeDraft()?.objects.find(item => item.id === ui.propertyObjectId); const field = fieldRecordsFor(activeDraft(), object).find(item => item.id === ui.propertyFieldChoice);
      if (field && ui.propertyForm && !ui.editResourceId) { if (!ui.propertyForm.name) ui.propertyForm.name = field.name; ui.propertyForm.dataType = field.type; ui.propertyForm.unit = defaultPropertyUnit(field.name, field.type); }
      return render();
    }
    if (action === "clear-property-field") { capturePropertyForm(); ui.propertyFieldChoice = null; return render(); }
    if (action === "confirm-add-property") return confirmAddProperty();
    if (action === "open-add-link") {
      const draft = activeDraft(); if ((draft?.objects.length || 0) < 2) return toast("至少需要两个 Object Type 才能创建 Link Type", "error");
      ui.editResourceId = null; ui.linkSourceObjectId = findDraftResource(draft, ui.selectedNode)?.kind === "object" ? ui.selectedNode : draft.objects[0].id; ui.linkTargetObjectId = draft.objects.find(item => item.id !== ui.linkSourceObjectId)?.id || null; ui.modal = "addLink"; return render();
    }
    if (action === "confirm-add-link") return confirmAddLink();
    if (action === "open-add-metric") { const draft = activeDraft(); if (!draft?.objects.length) return toast("请先创建 Object Type", "error"); ui.editResourceId = null; ui.resourceObjectId = findDraftResource(draft, ui.selectedNode)?.kind === "object" ? ui.selectedNode : draft.objects[0].id; ui.modal = "addMetric"; return render(); }
    if (action === "confirm-add-metric") return confirmAddMetric();
    if (action === "open-add-rule") { const draft = activeDraft(); if (!draft?.metrics.length) return toast("请先创建可供 Rule 依赖的 Metric", "error"); ui.editResourceId = null; ui.resourceObjectId = findDraftResource(draft, ui.selectedNode)?.kind === "object" ? ui.selectedNode : draft.objects[0]?.id; ui.modal = "addRule"; return render(); }
    if (action === "confirm-add-rule") return confirmAddRule();
    if (action === "open-add-action") { const draft = activeDraft(); if (!draft?.rules.length) return toast("请先创建可供 Action Type 依赖的 Rule", "error"); ui.editResourceId = null; ui.resourceObjectId = findDraftResource(draft, ui.selectedNode)?.kind === "object" ? ui.selectedNode : draft.objects[0]?.id; ui.modal = "addAction"; return render(); }
    if (action === "confirm-add-action") return confirmAddAction();
    if (action.startsWith("edit-resource:")) {
      const id = action.slice("edit-resource:".length); const found = mutableDraftResource(activeDraft(), id);
      if (!found) return toast("未找到可编辑的 Draft 资源", "error");
      ui.drawer = null; ui.editResourceId = id; ui.propertyForm = null;
      if (found.kind === "object") ui.modal = "addObject";
      if (found.kind === "property") { ui.propertyObjectId = found.parentObject.id; ui.propertyFieldChoice = found.resource.sourceFieldId || null; ui.modal = "addProperty"; }
      if (found.kind === "link") { ui.linkSourceObjectId = found.resource.source; ui.linkTargetObjectId = found.resource.target; ui.modal = "addLink"; }
      if (found.kind === "metric") { ui.resourceObjectId = found.resource.subjectObjectId; ui.modal = "addMetric"; }
      if (found.kind === "rule") { ui.resourceObjectId = found.resource.objectId; ui.modal = "addRule"; }
      if (found.kind === "action") { ui.resourceObjectId = found.resource.targetObjectId; ui.modal = "addAction"; }
      return render();
    }
    if (action.startsWith("open-object:")) {
      const parts = action.split(":"); const id = parts[1]; const tab = parts[2] || "overview"; return go(`modeling/object?draft=${activeDraft()?.id || ""}&id=${encodeURIComponent(id)}&tab=${tab}`);
    }
    if (action.startsWith("object-tab:")) { const object = routeParams().get("id"); return go(`modeling/object?draft=${activeDraft()?.id || ""}&id=${encodeURIComponent(object)}&tab=${action.split(":")[1]}`); }
    if (action.startsWith("choose-member:")) { const objectId = action.split(":")[1]; const draft = activeDraft(); const object = draft?.objects.find(item => item.id === objectId); const contract = draft?.sourceDataContract || availableDataAssets()[0] || null; ui.assetObjectId = objectId; ui.assetChoice = object?.memberId || null; ui.assetContractVersion = contract?.assetVersion || null; ui.modal = { type: "chooseMember", objectId }; return render(); }
    if (action.startsWith("choose-asset-member:")) { ui.assetChoice = action.slice("choose-asset-member:".length); return render(); }
    if (action === "confirm-asset-member") return confirmAssetMember();
    if (action.startsWith("set-identity:")) {
      const [, objectId, propId] = action.split(":"); const draft = activeDraft(); const object = draft?.objects.find(o => o.id === objectId); const target = object?.properties.find(p => p.id === propId); if (!object || !target) return; if (!fieldForProperty(draft, object, target)) return toast("身份 Property 必须先完成字段映射", "error"); object.properties.forEach(p => { if (p.role === "身份") p.role = "普通属性"; }); object.identity = propId; target.role = "身份"; target.nullable = "否"; resetDraftValidation(); persist(); render(); return toast("身份 Property 已更新");
    }
    if (action.startsWith("set-title:")) {
      const [, objectId, propId] = action.split(":"); const draft = activeDraft(); const object = draft?.objects.find(o => o.id === objectId); const target = object?.properties.find(p => p.id === propId); if (!object || !target) return; if (!fieldForProperty(draft, object, target)) return toast("标题 Property 必须先完成字段映射", "error"); object.properties.forEach(p => { if (p.role === "标题") p.role = "普通属性"; }); object.title = propId; target.role = target.id === object.identity ? "身份" : "标题"; resetDraftValidation(); persist(); render(); return toast("标题 Property 已更新");
    }
    if (action.startsWith("set-link-endpoint:")) {
      const [, objectId, propId] = action.split(":"); const draft = activeDraft(); const property = draft?.objects.find(o => o.id === objectId)?.properties.find(p => p.id === propId); if (!property) return;
      const object = draft.objects.find(o => o.id === objectId); if (!fieldForProperty(draft, object, property)) return toast("Link 端点 Property 必须先完成字段映射", "error"); property.linkEndpoint = true; resetDraftValidation(draft); persist(); render(); return toast("Property 已设为 Link 端点");
    }
    if (action.startsWith("toggle-field-endpoint:")) { const [, objectId, fieldId] = action.split(":"); return toggleFieldEndpoint(objectId, fieldId); }
    if (action.startsWith("open-mapping:")) { const objectId = action.split(":")[1]; ui.mappingSource = null; ui.mappingProperty = null; return go(`modeling/mapping?draft=${activeDraft().id}&object=${encodeURIComponent(objectId)}`); }
    if (action.startsWith("focus-mapping:")) { const [, objectId, propId] = action.split(":"); ui.mappingProperty = propId; return go(`modeling/mapping?draft=${activeDraft().id}&object=${encodeURIComponent(objectId)}&property=${encodeURIComponent(propId)}`); }
    if (action === "connect-mapping") return connectMapping();
    if (action.startsWith("unmap-property:")) {
      const [, objectId, propId] = action.split(":"); const draft = activeDraft(); const property = draft?.objects.find(o => o.id === objectId)?.properties.find(p => p.id === propId); if (!property) return; property.sourceField = null; property.sourceFieldId = null; property.status = "阻断"; resetDraftValidation(draft); persist(); render(); return toast("映射已解除，发布将被阻断", "error");
    }
    if (action === "save-mapping") { touchDraft(); persist(); toast("字段映射已保存"); return render(); }
    if (action === "go-validation") return go(`modeling/validation?draft=${activeDraft()?.id || ""}`);
    if (action === "open-release-settings") { const draft = activeDraft(); if (!draft) return; ensureDraftReleaseContract(draft); ui.modal = "releaseSettings"; return render(); }
    if (action === "confirm-release-settings") {
      const draft = activeDraft(); if (!draft) return;
      const effectiveFrom = document.getElementById("release-effective-from")?.value || "";
      const effectiveTo = document.getElementById("release-effective-to")?.value || "";
      const changeReason = document.getElementById("release-change-reason")?.value.trim() || "";
      const replacementMode = document.getElementById("release-replacement")?.value || "待确认";
      const replacementResourceIds = [...document.querySelectorAll("input[name='replacement-resource']:checked")].map(input => input.value);
      const baseVersion = state.publishedVersions.find(version => version.id === draft.basedOnVersionId) || null;
      const replacementMap = Object.fromEntries(replacementResourceIds.map(sourceId => [sourceId, document.querySelector(`select[name='replacement-target'][data-source-resource='${CSS.escape(sourceId)}']`)?.value || ""]));
      if (!effectiveFrom || !changeReason || changeReason === "待确认" || replacementMode === "待确认" || (replacementMode === "替代指定资源" && (!baseVersion || !replacementResourceIds.length || Object.values(replacementMap).some(targetId => !targetId)))) return toast("请确认业务生效时间、变更原因和完整替代关系", "error");
      if (effectiveTo && new Date(effectiveTo).getTime() <= new Date(effectiveFrom).getTime()) return toast("业务失效时间必须晚于生效时间", "error");
      const baseResources = new Map((baseVersion ? publishedResources(baseVersion) : []).map(resource => [resource.id, resource]));
      const draftResources = new Map(draftResourceList(draft).map(resource => [resource.id, resource]));
      if (replacementMode === "替代指定资源" && replacementResourceIds.some(sourceId => !baseResources.has(sourceId) || !draftResources.has(replacementMap[sourceId]) || replacementMap[sourceId] === sourceId || draftResources.get(replacementMap[sourceId]).kind !== baseResources.get(sourceId).kind)) return toast("替代目标必须是当前 Draft 中同类型、但使用新稳定身份的资源", "error");
      const replacementDeclaration = replacementMode === "替代指定资源" ? `替代 ${replacementResourceIds.map(sourceId => `${baseVersion.semanticVersion} · ${sourceId} → ${replacementMap[sourceId]}`).join("、")}` : replacementMode;
      draft.release = { owner: ONTOLOGY_DEFINITION_OWNER, effectiveFrom, effectiveTo, changeReason, replacementMode, replacementResourceIds, replacementMap, replacementDeclaration, evidenceState: "尚未形成", confirmed: true };
      ensureDraftResourceOwners(draft);
      resetDraftValidation(draft); ui.modal = null; persist(); render(); return toast("发布信息已保存，请运行统一校验");
    }
    if (action === "run-validation") {
      const draft = activeDraft(); const epoch = asyncEpoch; draft.validation = { status: "processing", checkedAt: null, issues: [] }; persist(); render();
      setTimeout(() => {
        if (epoch !== asyncEpoch || !state.drafts.includes(draft) || draft.validation?.status !== "processing") return;
        const issues = validationIssues(draft); const checkedAt = fullNowText();
        draft.validation = { status: issues.length ? "failed" : "success", checkedAt, issues, snapshot: buildValidationSnapshot(draft, issues, checkedAt) };
        persist(); render(); toast(issues.length ? `发现 ${issues.length} 项阻断问题` : "统一校验通过", issues.length ? "error" : "");
      }, 900); return;
    }
    if (action === "open-publish") { const draft = activeDraft(); if (draft?.validation.status !== "success") return toast("请先完成统一校验", "error"); ui.modal = "publish"; return render(); }
    if (action.startsWith("retry-publish:")) {
      const draft = state.drafts.find(item => item.id === action.split(":")[1] && !item.publishedVersionId); if (!draft) return toast("未找到可重试的 Draft", "error");
      state.activeDraftId = draft.id; ui.modal = "publish"; ui.drawer = null; persist(); return render();
    }
    if (action === "confirm-publish") {
      const draft = activeDraft(); const recommended = recommendedBusinessResources(draft); if (recommended.length && !document.getElementById("publish-business-confirm")?.checked) return toast("请先核对并确认本次业务口径", "error");
      const summary = document.getElementById("change-summary")?.value.trim() || ""; if (!summary) return toast("请填写具体变更原因", "error");
      ensureDraftReleaseContract(draft); if (!draft.release.confirmed || !draft.release.effectiveFrom || draft.release.replacementDeclaration === "待确认") return toast("发布信息已变化，请重新配置并校验", "error");
      if (summary !== draft.release.changeReason?.trim()) return toast("变更原因与校验快照不一致，请先保存发布信息并重新校验", "error");
      const epoch = asyncEpoch;
      draft.publishRun = { status: "processing", startedAt: nowText(), summary, confirmBusinessBasis: recommended.length > 0 }; ui.modal = null; persist(); render(); toast("正在发布语义版本");
      setTimeout(() => {
        if (epoch !== asyncEpoch || !state.drafts.includes(draft) || draft.publishRun?.status !== "processing") return;
        try { finishPublish(draft, summary, recommended.length > 0); }
        catch (error) { draft.publishRun = { status: "failed", failedAt: nowText(), reason: error.message || "发布未完成，请重试。" }; persist(); go("modeling"); toast(draft.publishRun.reason, "error"); }
      }, 850); return;
    }
    if (action === "view-semantic") { ui.workspaceView = "semantic"; ui.modal = null; ui.selectedNode = null; render(); return; }
    if (action === "view-lineage") { ui.workspaceView = "lineage"; ui.selectedNode = null; render(); return; }
    if (action.startsWith("edge-mode:")) { ui.semanticEdgeMode = action.split(":")[1] === "all" ? "all" : "main"; render(); return; }
    if (action === "open-lineage-detail") { ui.modal = "lineageDetail"; return render(); }
    if (action === "open-data-engineering-lineage") { clearTransientUi(); render(); window.location.href = "../../data-engineering-prototype-review/review-v3/方案B2.html#/resources/asset/finance-asset-target?tab=lineage"; return; }
    if (action.startsWith("open-draft-resource:")) { ui.drawer = { type: "draftResource", id: action.split(":")[1] }; return render(); }
    if (action === "zoom-in") { ui.zoom = Math.min(1.3, ui.zoom + .1); applyWorldTransform(); saveDraftCanvasView(); return; }
    if (action === "zoom-out") { ui.zoom = Math.max(.42, ui.zoom - .1); applyWorldTransform(); saveDraftCanvasView(); return; }
    if (action === "fit-canvas") { fitCanvasToContent(); return; }
    if (action === "reset-layout") {
      const draft = activeDraft(); if (!draft) return;
      [...draft.objects, ...draft.links, ...draft.metrics, ...draft.rules, ...draft.actions].forEach((resource, index) => { draft.positions[resource.id] = clone(POSITION_PRESET[resource.id] || [120 + (index % 5) * 260, 180 + Math.floor(index / 5) * 180]); });
      ui.zoom = .64; ui.pan = { x: 24, y: 28 }; draft.canvasView = { zoom: ui.zoom, pan: clone(ui.pan) }; markDraftSaved(draft); persist(); render(); return toast("已恢复默认布局");
    }
    if (action.startsWith("open-version:")) { const id = action.split(":")[1]; state.selectedVersionId = id; persist(); return go(`published/version?id=${id}&tab=overview`); }
    if (action.startsWith("open-ontology:")) return go(`published/ontology?id=${encodeURIComponent(action.slice("open-ontology:".length))}`);
    if (action.startsWith("version-tab:")) {
      const version = selectedVersion(); const tab = action.split(":")[1];
      if (tab === "canvas" && routeParams().get("tab") !== "canvas") { ui.publishedCanvasView = "semantic"; ui.publishedCanvasZoom = .72; }
      return go(`published/version?id=${version.id}&tab=${tab}`);
    }
    if (action.startsWith("open-version-tab:")) { const [, versionId, tab] = action.split(":"); return go(`published/version?id=${versionId}&tab=${tab}`); }
    if (action.startsWith("resource-view:")) { ui.versionResourceView = action.split(":")[1]; return render(); }
    if (action.startsWith("published-canvas-view:")) { ui.publishedCanvasView = action.split(":")[1] === "lineage" ? "lineage" : "semantic"; ui.selectedNode = null; return render(); }
    if (action.startsWith("published-canvas-zoom:")) {
      const direction = action.split(":")[1];
      ui.publishedCanvasZoom = direction === "in" ? Math.min(1, ui.publishedCanvasZoom + .1) : direction === "out" ? Math.max(.5, ui.publishedCanvasZoom - .1) : .72;
      return render();
    }
    if (action === "clear-resource-filter") { ui.versionResourceQuery = ""; ui.versionResourceType = "全部"; return render(); }
    if (action.startsWith("open-published-resource:")) { const [, versionId, ...idParts] = action.split(":"); const id = idParts.join(":"); return go(`published/resource?version=${versionId}&id=${encodeURIComponent(id)}&tab=overview`); }
    if (action.startsWith("published-resource-tab:")) { const version = selectedVersion(); const id = routeParams().get("id"); return go(`published/resource?version=${version.id}&id=${encodeURIComponent(id)}&tab=${action.split(":")[1]}`); }
    if (action === "refresh-external-inputs") {
      synchronizeStateFromStorage();
      const receivedCount = availableDataAssets().length;
      render();
      return toast(receivedCount ? `已读取 ${receivedCount} 个可供映射的已发布数据资产版本` : "尚未收到可供映射的数据资产；未收到的合同不会由本体管理生成");
    }
    if (action === "lookup-data-asset-delivery") {
      const deliveryId = document.getElementById("delivery-receipt-query")?.value.trim() || "";
      if (!deliveryId) return toast("请输入稳定交付标识", "error");
      synchronizeStateFromStorage();
      ui.deliveryLookupId = deliveryId;
      ui.deliveryLookupPerformed = true;
      render();
      const result = dataAssetDeliveryLookup(deliveryId);
      return toast(result.readStatus === "found" ? `已定位 ${deliveryId} 的持久化回执` : result.readStatus === "issue_only" ? `已定位 ${deliveryId} 的异常记录，但没有回执` : `未找到 ${deliveryId} 的接收或拒绝记录`);
    }
    if (action === "run-match" || action === "retry-match") {
      const version = selectedVersion(); const update = updateFor(version); const epoch = asyncEpoch; if (!update) return;
      if (action === "retry-match" && !["match_failed", "match_unknown"].includes(update.phase)) return toast("当前结果不支持重新检查", "error");
      const retryOf = action === "retry-match" ? update.matchResult?.resultId || null : null;
      update.priorPhase = update.phase;
      update.phase = "matching";
      update.failure = null;
      update.eligibility = null;
      const processingResult = formCandidateMatchResult(version, update, [], "processing");
      processingResult.retryOf = retryOf;
      storeCandidateMatchResult(update, processingResult);
      persist(); render();
      setTimeout(() => {
        if (epoch !== asyncEpoch || !state.publishedVersions.includes(version) || updateFor(version) !== update || update.phase !== "matching") return;
        const issues = candidateMappingIssues(version, update);
        const outcome = requestedMatchOutcome(update, issues);
        const presentation = candidateMatchRecordPresentation(outcome);
        const result = formCandidateMatchResult(version, update, issues, outcome);
        result.resultId = processingResult.resultId;
        result.formedAt = processingResult.formedAt;
        result.retryOf = retryOf;
        update.matchIssues = clone(issues);
        update.breaking = outcome === "incompatible";
        update.breakingDetail = outcome === "incompatible" ? pendingRepairDetail(version, update) : null;
        update.phase = candidateMatchPhase(outcome);
        update.failure = outcome === "passed" ? null : result.reason;
        update.eligibility = null;
        const matchRecord = addRecord(version.id, presentation.title, presentation.detail || `${result.reason}；${result.recoverySuggestion}`, presentation.status, presentation.tone, update.dataVersion, "C029", { resourceRef: "T051" });
        result.evidenceLocator = matchRecord.evidenceCode;
        replaceCandidateMatchResult(update, result);
        if (outcome === "passed") {
          const candidateKey = candidateKeyFor(version, update); update.breaking = false; update.breakingDetail = null; update.matchIssues = [];
          const eligibilityRecord = addRecord(version.id, "已具备消费验证条件", "匹配结果完整，候选数据可以进入隔离的业务消费验证。", "具备条件", "blue", update.dataVersion, "", { resourceRef: "T018" });
          update.eligibility = { resourceRef: "T018", eligibilityId: makeId("eligibility"), status: "eligible", candidateKey, formedAt: fullNowText(), checkedAt: fullNowText(), semanticVersionId: version.id, semanticVersion: version.semanticVersion, dataVersion: update.dataVersion, scenarioContext: clone(scenarioContextOf(update || version)), basedOnMatchResult: update.matchResult.resultId, matchEvidenceLocator: update.matchResult.evidenceLocator, evidenceLocator: eligibilityRecord.evidenceCode, currentFormalSnapshot: clone(currentFormalSnapshot(version)) };
        }
        persist(); render();
        const message = outcome === "passed" ? "已具备消费验证条件" : outcome === "incompatible" ? "待更新数据与本体不兼容，请创建修正 Draft" : outcome === "unknown" ? "匹配结果未知，当前正式数据保持不变" : "匹配检查失败，当前正式数据保持不变";
        toast(message, outcome === "passed" ? "" : "error");
      }, 950); return;
    }
    if (action === "open-fix-update") { ui.modal = "fixUpdate"; return render(); }
    if (action === "confirm-fix-update") {
      const version = selectedVersion(); const update = updateFor(version); if (!version || !update) return;
      if (!currentScenarioContextReady()) return toast(state.pendingScenarioReset ? "正在等待平台返回新的场景轮次，暂不能创建修正 Draft" : "尚未接收平台当前场景的完整运行上下文，暂不能创建修正 Draft", "error");
      const currentContext = currentScenarioContext();
      if (!sameScenarioEnvelope(update, currentContext) || !sameScenarioDefinition(version, currentContext)) return toast("当前候选、来源 Published 版本与当前场景轮次不一致，不能创建修正 Draft", "error");
      const detail = update.breakingDetail || pendingRepairDetail(version, update); if (!detail) return toast("未找到可定位的映射问题", "error");
      const draft = { id: makeId("draft"), ontologyStableId: version.ontologyStableId, name: version.name, definition: version.definition, scenario: scenarioDisplayLabel(currentContext), scenarioContext: clone(currentContext), sourceDeliveryId: update.sourceDataContract?.deliveryId || null, draftRevision: (version.draftRevision || 1) + 1, replacesDraftId: null, draftName: `${version.semanticVersion} 数据兼容修订`, status: "Draft", createdAt: nowText(), updatedAt: nowText(), basedOn: version.semanticVersion, basedOnVersionId: version.id, sourceDataContract: clone(version.dataContract), objects: clone(version.objects), links: clone(version.links), metrics: clone(version.metrics), rules: clone(version.rules), actions: clone(version.actions), positions: clone(version.positions || POSITION_PRESET), canvasView: { zoom: .64, pan: { x: 24, y: 28 } }, validation: { status: "idle", checkedAt: null, issues: [] }, publishedVersionId: null, release: { owner: version.owner || ONTOLOGY_DEFINITION_OWNER, effectiveFrom: "", effectiveTo: "", changeReason: "待确认", replacementMode: "待确认", replacementResourceIds: [], replacementMap: {}, replacementDeclaration: "待确认", evidenceState: "尚未形成", confirmed: false } };
      resetResourceLifecycleForDraft(draft); ensureDraftResourceOwners(draft);
      draft.sourceDataContract = clone(update.sourceDataContract);
      draft.pendingFieldChange = { objectId: detail.objectId, propertyId: detail.propertyId, linkId: detail.linkId, side: detail.side, fromId: detail.oldFieldId, oldFieldName: detail.oldFieldName, toId: null, to: "需要从候选资产中显式选择", sample: null, memberId: detail.memberId, mapped: false };
      if (detail.propertyId) {
        const object = draft.objects.find(item => item.id === detail.objectId); const property = object?.properties.find(item => item.id === detail.propertyId);
        if (property) { property.sourceFieldId = null; property.sourceField = null; property.status = "阻断"; }
      }
      if (detail.linkId) {
        const link = draft.links.find(item => item.id === detail.linkId);
        if (link) { if (detail.side === "target") link.targetEndpoint = null; else link.sourceEndpoint = null; }
      }
      draft.pendingUpdate = { sourceModule: update.sourceModule, contractCode: update.contractCode, requestId: update.requestId, requestEvidenceLocator: update.requestEvidenceLocator, requestedAt: update.requestedAt, scenarioContext: clone(currentContext), dataAssetId: update.dataAssetId, memberIds: clone(update.memberIds || []), relationIds: clone(update.relationIds || []), qualityStatus: update.qualityStatus, trigger: update.trigger, retryOf: update.retryOf, sourceDataContract: clone(update.sourceDataContract), dataVersion: update.dataVersion, asOf: update.asOf, sourceVersionId: version.id };
      state.drafts.unshift(draft); state.activeDraftId = draft.id; addRecord(version.id, "已创建修正 Draft", `${draft.draftName} 已建立；原 Published 版本和失败记录保持不变。`, "待修正", "blue", update.dataVersion, ""); ui.modal = null; ui.mappingProperty = null; ui.mappingSource = null; ui.canvasDraftId = draft.id; loadDraftCanvasView(draft); persist(); go(`modeling/object?draft=${draft.id}&id=${encodeURIComponent(detail.objectId)}&tab=mapping`); return toast("修正 Draft 已创建，请显式选择新的稳定端点");
    }
    if (action === "check-validation-reference") {
      const version = selectedVersion(); const update = updateFor(version);
      if (!version || !update || !["eligible", "verification_pending"].includes(update.phase)) return toast("当前待更新数据尚不能检查验证引用", "error");
      const expectedKey = candidateKeyFor(version, update);
      if (update.matchResult?.status !== "passed" || update.matchResult.candidateKey !== expectedKey || update.eligibility?.status !== "eligible" || update.eligibility.candidateKey !== expectedKey) return toast("候选数据已变化，请重新完成数据与本体匹配检查", "error");
      const reference = consumeExternalValidationReference(version, update);
      if (!reference) { update.phase = "eligible"; update.failure = null; persist(); render(); return toast("尚未收到智能问数验证引用；当前正式数据保持不变"); }
      const requirement = consumeExternalValidationRequirement(version, update);
      const referenceSnapshot = validationReferenceSnapshot(reference);
      update.validationReference = referenceSnapshot;
      update.validationReferenceFingerprint = validationReferenceFingerprint(referenceSnapshot);
      if (!update.validationRequirement) {
        update.validationRequirement = requirement ? validationRequirementSnapshot(requirement) : null;
        update.validationRequirementFingerprint = update.validationRequirement ? snapshotFingerprint(update.validationRequirement) : null;
      }
      const referenceState = validationReferenceState(update.validationReference, version, update); const gate = candidateValidationGate(version, update);
      const recordOptions = { sourceModule: reference.sourceModule || "待确认", externalRunId: reference.runId || null, externalEvidenceRef: reference.evidenceLocator || null, externalValidationContractRef: reference.contractCode || null, expectedExternalValidationContractRef: "C008", externalValidationSnapshot: referenceSnapshot, decisionRef: reference.decisionRef || null, formsContract: false };
      if (referenceState.key === "processing") {
        update.phase = "verification_pending"; update.failure = null;
        addRecord(version.id, "已读取智能问数验证状态", "外部验证仍在处理；尚未形成完整完成时间和证据定位。", "运行中", "blue", update.dataVersion, "", recordOptions);
        persist(); render(); return toast("外部验证仍在处理中；当前正式数据保持不变");
      }
      if (gate.passed) {
        update.phase = "verified"; update.failure = null;
        addRecord(version.id, "已接收业务消费验证引用", "外部引用已锁定同一候选版本，整体通过且证据可定位；等待人工确认切换。", "门禁通过", "green", update.dataVersion, "", recordOptions);
        persist(); render(); return toast("验证引用门禁通过；尚未切换正式数据");
      }
      update.phase = "verify_failed"; update.failure = `${referenceState.label}；${gate.issues[0] || "验证引用不满足切换门禁"}`;
      addRecord(version.id, "智能问数验证引用被阻断", update.failure, "阻断", "red", update.dataVersion, "", { ...recordOptions, formsContract: false });
      persist(); render(); return toast("验证引用未通过门禁；当前正式数据保持不变", "error");
    }
    if (action === "request-validation-retry") {
      const version = selectedVersion(); const update = updateFor(version); const reference = update?.validationReference;
      if (!version || !update || !reference) return toast("当前没有可关联重试的验证引用", "error");
      if (!reference.runId) return toast("原验证引用缺少运行标识，不能建立关联重试", "error");
      const expectedKey = candidateKeyFor(version, update);
      if (update.matchResult?.candidateKey !== expectedKey || update.eligibility?.candidateKey !== expectedKey) return toast("候选版本已变化，请重新完成数据与本体匹配检查", "error");
      const requestId = makeId("validation-retry");
      const retryRequest = {
        requestId,
        requestedAt: fullNowText(),
        scenarioContext: clone(scenarioContextOf(update || version)),
        candidateKey: expectedKey,
        semanticVersionId: version.id,
        semanticVersion: version.semanticVersion,
        dataVersion: update.dataVersion,
        asOf: update.asOf,
        retryOf: reference.runId,
        requestedContractCode: "C008",
        decisionRef: "D064",
        status: "等待智能问数接收"
      };
      state.validationRetryRequests = state.validationRetryRequests || {};
      state.validationRetryRequests[requestId] = retryRequest;
      update.validationReferenceHistory = [...(update.validationReferenceHistory || []), clone(reference)];
      update.validationRetryOf = reference.runId; update.validationRetryRequestId = requestId; update.validationReference = null; update.validationReferenceFingerprint = null; update.validationRetryRequested = true; update.phase = "eligible"; update.failure = null;
      delete state.externalValidationInbox?.[externalValidationInboxKey(version, update)];
      addRecord(version.id, "已请求智能问数重新验证", `请求 ${requestId} 已锁定当前候选并回指原运行 ${reference.runId}；本记录不代表外部运行或验证结果已经形成。`, "等待新引用", "blue", update.dataVersion, "", { sourceModule: "本体管理", externalRunId: reference.runId, externalEvidenceRef: reference.evidenceLocator, requestedExternalValidationContractRef: "C008", externalValidationSnapshot: validationReferenceSnapshot(reference), decisionRef: "D064", formsContract: false });
      persist(); render(); return toast("已请求关联重试；等待智能问数形成新的验证引用");
    }
    if (action === "open-adopt") {
      const version = selectedVersion(); const update = updateFor(version); const gate = candidateValidationGate(version, update);
      if (!version || !update || !["verified", "switch_failed"].includes(update.phase) || !gate.passed) {
        if (update) { update.phase = "verify_failed"; update.failure = gate.issues?.[0] || "采用门禁尚未通过"; persist(); }
        render(); return toast("采用门禁未通过，请重新检查验证引用", "error");
      }
      const requiredGates = [
        update.matchResult?.status === "passed" && update.matchResult.candidateKey === gate.expectedKey,
        update.eligibility?.status === "eligible" && update.eligibility.candidateKey === gate.expectedKey,
        gate.passed,
        publishedMappingContractAssessment(version).complete,
        publishedResourceAvailable(version) && newBindingStateOf(version) === "可新绑定"
      ];
      if (requiredGates.some(result => !result)) return toast("全部采用门禁尚未通过，当前正式数据保持不变", "error");
      ui.adoptSnapshot = { candidateKey: gate.expectedKey, runId: update.validationReference.runId, evidenceLocator: update.validationReference.evidenceLocator, referenceFingerprint: update.validationReferenceFingerprint }; ui.modal = "adopt"; return render();
    }
    if (action === "confirm-adopt") {
      if (!document.getElementById("adopt-confirm")?.checked) return toast("请先确认目标版本和门禁结果", "error");
      const version = selectedVersion(); const update = updateFor(version); const gate = candidateValidationGate(version, update); const reference = update?.validationReference; const snapshot = ui.adoptSnapshot;
      if (!version || !update || !["verified", "switch_failed"].includes(update.phase) || !gate.passed || !snapshot || snapshot.candidateKey !== gate.expectedKey || snapshot.runId !== reference?.runId || snapshot.evidenceLocator !== reference?.evidenceLocator || snapshot.referenceFingerprint !== update.validationReferenceFingerprint || update.validationReferenceFingerprint !== validationReferenceFingerprint(reference)) {
        if (update) { update.phase = "verify_failed"; update.failure = "确认期间候选版本或验证引用发生变化"; }
        ui.modal = null; ui.adoptSnapshot = null; persist(); render(); return toast("候选上下文已变化，请重新核对", "error");
      }
      const epoch = asyncEpoch; update.priorPhase = update.phase; update.phase = "switching"; update.adoptionAttempts = (update.adoptionAttempts || 0) + 1; update.adoptionRun = { id: makeId("adoption"), status: "processing", startedAt: fullNowText(), candidateKey: gate.expectedKey, validationRunId: reference.runId };
      ui.modal = null; ui.adoptSnapshot = null; persist(); render(); toast("正在受控切换正式数据");
      setTimeout(() => {
        if (epoch !== asyncEpoch || !state.publishedVersions.includes(version) || updateFor(version) !== update || update.phase !== "switching") return;
        const latestGate = candidateValidationGate(version, update);
        const fail = !latestGate.passed || (update.failFirstAdoption && update.adoptionAttempts === 1);
        if (fail) {
          update.phase = "switch_failed"; update.failure = latestGate.passed ? "受控提交未完成；未改写当前正式版本" : `提交前门禁变化：${latestGate.issues[0]}`; update.adoptionRun = { ...update.adoptionRun, status: "failed", failedAt: fullNowText(), reason: update.failure };
          addRecord(version.id, "正式切换未完成", `${update.failure}。${currentFormalSnapshot(version) ? "当前正式组合继续服务。" : "当前仍无正式组合。"}`, "失败", "red", update.dataVersion, "", { externalValidationContractRef: reference.contractCode || null, expectedExternalValidationContractRef: "C008", externalRunId: reference.runId, externalEvidenceRef: reference.evidenceLocator, externalValidationSnapshot: validationReferenceSnapshot(reference), decisionRef: "D034", formsContract: false });
          persist(); render(); return toast("正式切换失败；当前正式版本未改变", "error");
        }
        const priorFormal = currentFormalSnapshot(version); rememberFormalSnapshot(priorFormal);
        const slot = state.bindingsByVersion[version.id] || { current: null, previous: null };
        if (slot.current) { rememberFormalSnapshot({ versionId: version.id, ontologyStableId: version.ontologyStableId, ...clone(slot.current) }); slot.previous = isCombinationBlocked({ versionId: version.id, dataVersion: slot.current.dataVersion }) ? null : clone(slot.current); }
        slot.current = { semanticVersion: version.semanticVersion, dataVersion: update.dataVersion, asOf: update.asOf, switchedAt: nowText(), scenarioContext: clone(scenarioContextOf(update || version)), candidateKey: latestGate.expectedKey, candidateValidationReference: clone(reference), validationEvidenceRef: reference.evidenceLocator, questionSetVersion: reference.questionSetVersion };
        state.bindingsByVersion[version.id] = slot; state.currentFormalVersionIdsByOntology = state.currentFormalVersionIdsByOntology || {}; state.currentFormalVersionIdsByOntology[version.ontologyStableId] = version.id; state.currentFormalVersionId = version.id;
        update.phase = "adopted"; update.failure = null; update.adoptedGateSnapshot = freezeValidationGate(latestGate); update.adoptionRun = { ...update.adoptionRun, status: "success", finishedAt: fullNowText(), gateCheckedAt: update.adoptedGateSnapshot.checkedAt };
        const adoptionRecord = addRecord(version.id, "已切换为正式数据", `${update.dataVersion} 已与 ${version.semanticVersion} 形成当前正式使用版本；消费方兼容状态仍由各自模块确认。`, "成功", "green", update.dataVersion, "", { resourceRef: "T019", candidateKey: latestGate.expectedKey, scenarioContext: update, externalValidationContractRef: reference.contractCode || null, expectedExternalValidationContractRef: "C008", externalRunId: reference.runId, externalEvidenceRef: reference.evidenceLocator, externalValidationSnapshot: validationReferenceSnapshot(reference), decisionRef: "D034" });
        slot.current.adoptionRecordId = adoptionRecord.id;
        slot.current.adoptionEvidenceLocator = adoptionRecord.evidenceCode;
        persist(); render(); toast("正式数据已切换");
      }, 900); return;
    }
    if (action === "open-rollback") {
      const version = selectedVersion();
      if (!isCurrentFormalVersion(version)) return toast("只能在当前正式使用的语义版本内回退数据", "error");
      const previous = bindingFor(version).previous;
      if (!previous || isCombinationBlocked({ versionId: version.id, dataVersion: previous.dataVersion })) return toast("当前版本没有可安全回退的上一可信数据", "error");
      ui.modal = "rollback"; return render();
    }
    if (action === "open-combination-rollback") { ui.modal = "combinationRollback"; return render(); }
    if (action === "confirm-combination-rollback") {
      if (!document.getElementById("combination-rollback-confirm")?.checked) return toast("请先确认完整版本回退", "error");
      const outgoingVersion = selectedVersion(); const prior = previousTrustedCombination(outgoingVersion);
      if (!outgoingVersion || !prior || !isCurrentFormalBlocked(outgoingVersion)) return toast("上一可信版本或当前阻断状态已变化", "error");
      const targetVersion = state.publishedVersions.find(item => item.id === prior.versionId); if (!targetVersion) return toast("上一可信语义版本已无法定位", "error");
      const outgoingSnapshot = currentFormalSnapshot(outgoingVersion);
      const targetSlot = state.bindingsByVersion[targetVersion.id] || { current: null, previous: null };
      const restoredBinding = { ...clone(prior), semanticVersion: targetVersion.semanticVersion, switchedAt: nowText() }; delete restoredBinding.versionId;
      targetSlot.current = restoredBinding;
      targetSlot.previous = outgoingSnapshot && outgoingSnapshot.versionId === targetVersion.id && !isCombinationBlocked(outgoingSnapshot) ? (() => { const value = clone(outgoingSnapshot); delete value.versionId; return value; })() : null;
      state.bindingsByVersion[targetVersion.id] = targetSlot; state.currentFormalVersionIdsByOntology = state.currentFormalVersionIdsByOntology || {}; state.currentFormalVersionIdsByOntology[targetVersion.ontologyStableId] = targetVersion.id; state.currentFormalVersionId = targetVersion.id;
      const legacyIncident = state.qualityIncidentsByVersion?.[targetVersion.id];
      if (legacyIncident && legacyIncident.dataVersion !== restoredBinding.dataVersion) delete state.qualityIncidentsByVersion[targetVersion.id];
      if (outgoingSnapshot && isCombinationBlocked(outgoingSnapshot)) {
        const badIndex = (state.formalHistory || []).findIndex(item => item.versionId === outgoingSnapshot.versionId && item.dataVersion === outgoingSnapshot.dataVersion);
        if (badIndex >= 0) state.formalHistory.splice(badIndex, 1);
      }
      addRecord(outgoingVersion.id, "已回退上一可信版本", `已恢复 ${prior.semanticVersion} 与 ${prior.dataVersion}；原阻断记录保持不变。`, "成功", "green", prior.dataVersion, "", { resourceRef: "T019", candidateKey: prior.candidateKey || null, scenarioContext: prior, decisionRef: "D034" });
      const rollbackRecord = addRecord(targetVersion.id, "已恢复为当前正式版本", `由受阻断版本回退到 ${prior.semanticVersion} 与 ${prior.dataVersion}。`, "成功", "green", prior.dataVersion, "", { resourceRef: "T019", candidateKey: prior.candidateKey || null, scenarioContext: prior, decisionRef: "D034" });
      targetSlot.current.adoptionRecordId = rollbackRecord.id;
      targetSlot.current.adoptionEvidenceLocator = rollbackRecord.evidenceCode;
      ui.modal = null; persist(); go(`published/version?id=${targetVersion.id}&tab=updates`); return toast("已回退完整的上一可信版本");
    }
    if (action === "confirm-rollback") {
      const version = selectedVersion();
      if (!isCurrentFormalVersion(version)) { ui.modal = null; render(); return toast("历史语义版本不能执行数据回退", "error"); }
      const slot = bindingFor(version); if (!slot.previous || isCombinationBlocked({ versionId: version.id, dataVersion: slot.previous.dataVersion })) return toast("当前版本没有可安全回退的上一可信数据", "error"); const outgoing = clone(slot.current); const rollbackReason = document.getElementById("rollback-reason")?.value || "业务核验后回退"; slot.current = { ...clone(slot.previous), switchedAt: nowText(), rollbackReason, rollbackFromDataVersion: outgoing?.dataVersion || null }; slot.previous = isCombinationBlocked({ versionId: version.id, dataVersion: outgoing.dataVersion }) ? null : outgoing; state.currentFormalVersionIdsByOntology = state.currentFormalVersionIdsByOntology || {}; state.currentFormalVersionIdsByOntology[version.ontologyStableId] = version.id; state.currentFormalVersionId = version.id; const legacyIncident = state.qualityIncidentsByVersion?.[version.id]; if (legacyIncident && legacyIncident.dataVersion !== slot.current.dataVersion) delete state.qualityIncidentsByVersion[version.id]; const rollbackRecord = addRecord(version.id, "已回退上一可信数据", `${rollbackReason}；受控回退时间 ${slot.current.switchedAt}。`, "成功", "green", slot.current.dataVersion, "", { resourceRef: "T019", candidateKey: slot.current.candidateKey || null, scenarioContext: slot.current, decisionRef: "D034" }); slot.current.adoptionRecordId = rollbackRecord.id; slot.current.adoptionEvidenceLocator = rollbackRecord.evidenceCode; ui.modal = null; persist(); render(); return toast("已回退到上一可信数据");
    }
    if (action.startsWith("open-record:")) { const [, versionId, recordId] = action.split(":"); ui.modal = { type: "record", versionId, recordId }; return render(); }
    if (action.startsWith("open-evidence:")) { const parts = action.split(":"); ui.modal = { type: "evidence", evidenceType: parts[1], versionId: parts[2], resourceId: parts[3] }; return render(); }
    if (action === "confirm-reset") {
      try { asyncEpoch += 1; const request = resetCurrentScenarioProjection(); resetUiState(); persist(); go("modeling"); return toast(`重置请求 ${request.requestId} 已提交；等待平台返回新场景轮次`); }
      catch (error) { return toast(error?.message || "当前不能提交定向重置", "error"); }
    }
  }

  function updateMappingLines() {
    const svg = document.getElementById("mapping-svg"); if (!svg) return;
    const page = document.querySelector(".mapping-grid"); if (!page) return;
    const base = page.getBoundingClientRect(); const draft = activeDraft(); const object = draft?.objects.find(o => o.id === routeParams().get("object")); if (!object) return;
    svg.setAttribute("viewBox", `0 0 ${svg.clientWidth} ${svg.clientHeight}`);
    svg.innerHTML = object.properties.filter(property => fieldForProperty(draft, object, property)).map(property => {
      const field = fieldForProperty(draft, object, property);
      const source = [...document.querySelectorAll("[data-map-source]")].find(el => el.dataset.mapSource === property.sourceFieldId);
      const target = [...document.querySelectorAll("[data-map-property]")].find(el => el.dataset.mapProperty === property.id); if (!source || !target) return "";
      const a = source.getBoundingClientRect(); const b = target.getBoundingClientRect(); const x1 = a.right - base.left - document.querySelector(".mapping-column.source").offsetWidth; const y1 = a.top + a.height / 2 - base.top; const x2 = b.left - base.left - document.querySelector(".mapping-column.source").offsetWidth; const y2 = b.top + b.height / 2 - base.top;
      return `<path class="${routeParams().get("property") === property.id ? "focus" : ""}" d="M 4 ${y1} C ${svg.clientWidth * .38} ${y1}, ${svg.clientWidth * .62} ${y2}, ${svg.clientWidth - 4} ${y2}"></path>`;
    }).join("");
  }

  function applyWorldTransform() {
    const world = document.getElementById("world"); if (!world) return; world.style.transform = `translate(${ui.pan.x}px, ${ui.pan.y}px) scale(${ui.zoom})`;
    const value = document.querySelector(".canvas-toolbar b"); if (value) value.textContent = `${Math.round(ui.zoom * 100)}%`;
  }

  function zoomCanvasAt(clientX, clientY, nextZoom) {
    const viewport = document.getElementById("canvas-viewport");
    if (!viewport || route() !== "modeling/workbench") return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = clientX - rect.left; const pointerY = clientY - rect.top;
    const worldX = (pointerX - ui.pan.x) / ui.zoom; const worldY = (pointerY - ui.pan.y) / ui.zoom;
    const clamped = Math.max(.42, Math.min(1.3, nextZoom));
    ui.pan.x = pointerX - worldX * clamped; ui.pan.y = pointerY - worldY * clamped; ui.zoom = clamped;
    applyWorldTransform(); saveDraftCanvasView();
  }

  function fitCanvasToContent() {
    const draft = activeDraft(); const viewport = document.getElementById("canvas-viewport"); if (!draft || !viewport) return;
    const scene = ui.workspaceView === "semantic" ? semanticScene(draft) : lineageScene(draft);
    if (!scene.nodes.length) { ui.zoom = .72; ui.pan = { x: 34, y: 54 }; applyWorldTransform(); saveDraftCanvasView(); return; }
    const boxes = scene.nodes.map(node => {
      const [width, height] = nodeSize(node.kind);
      return { left: node.pos[0], top: node.pos[1], right: node.pos[0] + width, bottom: node.pos[1] + height };
    });
    const minX = Math.min(...boxes.map(box => box.left)); const minY = Math.min(...boxes.map(box => box.top));
    const maxX = Math.max(...boxes.map(box => box.right)); const maxY = Math.max(...boxes.map(box => box.bottom));
    const padding = 84; const availableWidth = Math.max(300, viewport.clientWidth - padding * 2); const availableHeight = Math.max(240, viewport.clientHeight - padding * 2 - 38);
    ui.zoom = Math.max(.42, Math.min(1.15, availableWidth / Math.max(1, maxX - minX), availableHeight / Math.max(1, maxY - minY)));
    ui.pan = { x: (viewport.clientWidth - (maxX - minX) * ui.zoom) / 2 - minX * ui.zoom, y: 52 + (availableHeight - (maxY - minY) * ui.zoom) / 2 - minY * ui.zoom };
    applyWorldTransform(); saveDraftCanvasView();
  }

  function updateEdges() {
    const worlds = [...document.querySelectorAll(".world, .readonly-world")];
    worlds.forEach(world => updateWorldEdges(world));
  }

  function updateWorldEdges(world) {
    const computedEdges = [];
    const edgeGroups = [...world.querySelectorAll(":scope > .edge-layer .edge")];
    const nodes = [...world.querySelectorAll(":scope > .canvas-node")];
    edgeGroups.forEach(group => {
      const path = group.querySelector(":scope > path");
      const from = nodes.find(node => node.dataset.node === group.dataset.from);
      const to = nodes.find(node => node.dataset.node === group.dataset.to);
      if (!from || !to || !path || from === to) { group.style.display = "none"; return; }
      const aw = from.offsetWidth; const ah = from.offsetHeight;
      const bw = to.offsetWidth; const bh = to.offsetHeight;
      const a = { left: parseFloat(from.style.left), top: parseFloat(from.style.top) }; const b = { left: parseFloat(to.style.left), top: parseFloat(to.style.top) };
      if (![a.left, a.top, b.left, b.top, aw, ah, bw, bh].every(Number.isFinite) || aw <= 0 || ah <= 0 || bw <= 0 || bh <= 0) { group.style.display = "none"; return; }
      group.style.display = "";
      a.cx = a.left + aw / 2; a.cy = a.top + ah / 2; b.cx = b.left + bw / 2; b.cy = b.top + bh / 2;
      const dx = b.cx - a.cx; const dy = b.cy - a.cy; let x1; let y1; let x2; let y2; let c1x; let c1y; let c2x; let c2y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const direction = dx >= 0 ? 1 : -1;
        x1 = direction > 0 ? a.left + aw : a.left; y1 = a.cy; x2 = direction > 0 ? b.left : b.left + bw; y2 = b.cy;
        const span = Math.max(1, Math.abs(x2 - x1) * .42); c1x = x1 + direction * span; c1y = y1; c2x = x2 - direction * span; c2y = y2;
      } else {
        const direction = dy >= 0 ? 1 : -1;
        x1 = a.cx; y1 = direction > 0 ? a.top + ah : a.top; x2 = b.cx; y2 = direction > 0 ? b.top : b.top + bh;
        const span = Math.max(1, Math.abs(y2 - y1) * .42); c1x = x1; c1y = y1 + direction * span; c2x = x2; c2y = y2 - direction * span;
      }
      const parallelEdges = edgeGroups.filter(edge => edge.dataset.from === group.dataset.from && edge.dataset.to === group.dataset.to);
      const parallelIndex = parallelEdges.indexOf(group); const parallelCount = parallelEdges.length;
      const laneOffset = parallelCount > 1 ? (parallelIndex - (parallelCount - 1) / 2) * 18 : 0;
      if (parallelCount > 1) {
        if (Math.abs(dx) >= Math.abs(dy)) { y1 += laneOffset; y2 += laneOffset; c1y += laneOffset; c2y += laneOffset; }
        else { x1 += laneOffset; x2 += laneOffset; c1x += laneOffset; c2x += laneOffset; }
      }
      path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
      computedEdges.push({ group, x1, y1, c1x, c1y, c2x, c2y, x2, y2 });
    });

    const occupied = nodes.map(node => {
      const left = parseFloat(node.style.left); const top = parseFloat(node.style.top);
      const width = node.offsetWidth; const height = node.offsetHeight;
      return { left: left - 5, top: top - 5, right: left + width + 5, bottom: top + height + 5 };
    }).filter(box => Object.values(box).every(Number.isFinite));
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const pointAt = (edge, t) => {
      const mt = 1 - t;
      const x = mt ** 3 * edge.x1 + 3 * mt ** 2 * t * edge.c1x + 3 * mt * t ** 2 * edge.c2x + t ** 3 * edge.x2;
      const y = mt ** 3 * edge.y1 + 3 * mt ** 2 * t * edge.c1y + 3 * mt * t ** 2 * edge.c2y + t ** 3 * edge.y2;
      const dx = 3 * mt ** 2 * (edge.c1x - edge.x1) + 6 * mt * t * (edge.c2x - edge.c1x) + 3 * t ** 2 * (edge.x2 - edge.c2x);
      const dy = 3 * mt ** 2 * (edge.c1y - edge.y1) + 6 * mt * t * (edge.c2y - edge.c1y) + 3 * t ** 2 * (edge.y2 - edge.c2y);
      const length = Math.max(1, Math.hypot(dx, dy));
      return { x, y, nx: -dy / length, ny: dx / length };
    };
    const labelBoxes = [];
    computedEdges.forEach(edge => {
      const label = edge.group.querySelector(".edge-label"); if (!label) return;
      const rect = label.querySelector("rect"); const width = parseFloat(rect?.getAttribute("width")) || 64; const height = parseFloat(rect?.getAttribute("height")) || 18;
      const baseT = Math.max(.18, Math.min(.82, Number(edge.group.dataset.labelT) || .5));
      const tCandidates = [...new Set([baseT, baseT - .08, baseT + .08, baseT - .16, baseT + .16, .24, .4, .6, .76].map(value => Math.max(.18, Math.min(.82, Number(value.toFixed(3))))))];
      const normalOffsets = [0, 13, -13, 26, -26, 39, -39];
      let chosen = null;
      for (const t of tCandidates) {
        const point = pointAt(edge, t);
        for (const offset of normalOffsets) {
          const x = point.x + point.nx * offset; const y = point.y + point.ny * offset;
          const box = { left: x - width / 2 - 3, top: y - height / 2 - 3, right: x + width / 2 + 3, bottom: y + height / 2 + 3 };
          if (![...occupied, ...labelBoxes].some(item => overlaps(box, item))) { chosen = { x, y, box }; break; }
        }
        if (chosen) break;
      }
      if (!chosen) {
        const point = pointAt(edge, baseT);
        chosen = { x: point.x, y: point.y, box: { left: point.x - width / 2, top: point.y - height / 2, right: point.x + width / 2, bottom: point.y + height / 2 } };
      }
      labelBoxes.push(chosen.box);
      label.setAttribute("transform", `translate(${chosen.x} ${chosen.y})`);
    });
  }

  document.addEventListener("click", event => {
    const overlay = event.target.closest("[data-overlay='close']"); if (overlay && event.target === overlay) { clearTransientUi(); render(); return; }
    const actionEl = event.target.closest("[data-action]"); if (actionEl && !actionEl.disabled) { event.preventDefault(); handleAction(actionEl.dataset.action); return; }
    const resourceEl = event.target.closest("[data-resource]"); if (resourceEl) { const id = resourceEl.dataset.resource; ui.selectedNode = id; render(); return; }
    const source = event.target.closest("[data-map-source]"); if (source) { ui.mappingSource = source.dataset.mapSource; render(); return; }
    const property = event.target.closest("[data-map-property]"); if (property) {
      const draft = activeDraft(); const object = draft?.objects.find(o => o.id === routeParams().get("object")); const target = object?.properties.find(p => p.id === property.dataset.mapProperty); if (!target) return;
      ui.mappingProperty = target.id; render(); return;
    }
    const viewport = event.target.closest(".canvas-viewport");
    if (viewport && !event.target.closest(".canvas-node, .canvas-toolbar, .canvas-legend") && !ui.suppressCanvasClick && ui.selectedNode) { ui.selectedNode = null; render(); }
  });

  document.addEventListener("change", event => {
    if (event.target.matches("[data-input='published-resource-type']")) { ui.versionResourceType = event.target.value; render(); }
    if (event.target.matches("[data-input='asset-contract-version']")) { ui.assetContractVersion = event.target.value; ui.assetChoice = null; render(); }
    if (event.target.id === "published-version-select") {
      const version = state.publishedVersions.find(item => item.id === event.target.value);
      if (!version || version.ontologyStableId !== event.target.dataset.ontology) return toast("未找到所选精确 Published 版本", "error");
      state.selectedVersionId = version.id; persist(); return go(`published/ontology?id=${encodeURIComponent(version.ontologyStableId)}&version=${encodeURIComponent(version.id)}`);
    }
    if (event.target.id === "property-object") { capturePropertyForm(); ui.propertyObjectId = event.target.value; ui.propertyFieldChoice = null; render(); }
    if (event.target.id === "link-source" || event.target.id === "link-target") refreshLinkEndpointInputs();
    if (event.target.id === "link-source-endpoint" || event.target.id === "link-target-endpoint") refreshLinkEndpointCompatibility();
    if (event.target.id === "release-replacement") {
      const draft = activeDraft(); if (!draft) return;
      const effectiveFrom = document.getElementById("release-effective-from")?.value || "";
      const effectiveTo = document.getElementById("release-effective-to")?.value || "";
      const changeReason = document.getElementById("release-change-reason")?.value || "";
      draft.release.replacementMode = event.target.value;
      if (event.target.value !== "替代指定资源") draft.release.replacementResourceIds = [];
      draft.release.replacementDeclaration = event.target.value;
      draft.release.effectiveFrom = effectiveFrom;
      draft.release.effectiveTo = effectiveTo;
      draft.release.changeReason = changeReason;
      return render();
    }
  });

  document.addEventListener("input", event => {
    if (event.target.matches("[data-input='published-resource-query']")) {
      ui.versionResourceQuery = event.target.value;
      const caret = event.target.selectionStart; render();
      requestAnimationFrame(() => { const input = document.querySelector("[data-input='published-resource-query']"); if (input) { input.focus(); input.setSelectionRange(caret, caret); } });
    }
  });

  document.addEventListener("scroll", event => {
    if (route() === "modeling/mapping" && event.target?.classList?.contains("mapping-list")) requestAnimationFrame(updateMappingLines);
  }, true);

  document.addEventListener("wheel", event => {
    const viewport = event.target.closest?.(".canvas-viewport");
    if (!viewport || route() !== "modeling/workbench" || ui.drag || ui.panDrag) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : .9;
    zoomCanvasAt(event.clientX, event.clientY, ui.zoom * factor);
  }, { passive: false });

  document.addEventListener("pointerdown", event => {
    const handle = event.target.closest("[data-drag-node]");
    if (handle && route() === "modeling/workbench" && ui.workspaceView === "semantic" && !event.target.closest("button, input, select, textarea")) {
      const node = handle.closest("[data-node]") || handle; const id = node.dataset.node; const left = parseFloat(node.style.left); const top = parseFloat(node.style.top);
      ui.drag = { id, node, startX: event.clientX, startY: event.clientY, left, top, pointerId: event.pointerId, moved: false }; node.setPointerCapture(event.pointerId); node.classList.add("dragging"); event.preventDefault(); return;
    }
    const viewport = event.target.closest(".canvas-viewport");
    if (viewport && (event.target === viewport || event.target.classList.contains("world") || event.target.classList.contains("edge-layer"))) {
      ui.panDrag = { startX: event.clientX, startY: event.clientY, x: ui.pan.x, y: ui.pan.y, pointerId: event.pointerId, moved: false }; viewport.setPointerCapture(event.pointerId); viewport.classList.add("panning");
    }
  });

  document.addEventListener("pointermove", event => {
    if (ui.drag) {
      const dx = event.clientX - ui.drag.startX; const dy = event.clientY - ui.drag.startY; if (Math.hypot(dx, dy) > 3) ui.drag.moved = true;
      const x = ui.drag.left + dx / ui.zoom; const y = ui.drag.top + dy / ui.zoom;
      ui.drag.node.style.left = `${Math.max(20, Math.min(WORLD.width - 240, x))}px`; ui.drag.node.style.top = `${Math.max(20, Math.min(WORLD.height - 130, y))}px`; updateEdges();
    } else if (ui.panDrag) { const dx = event.clientX - ui.panDrag.startX; const dy = event.clientY - ui.panDrag.startY; if (Math.hypot(dx, dy) > 3) ui.panDrag.moved = true; ui.pan.x = ui.panDrag.x + dx; ui.pan.y = ui.panDrag.y + dy; applyWorldTransform(); }
  });

  document.addEventListener("pointerup", event => {
    if (ui.drag) {
      const draft = activeDraft(); const moved = ui.drag.moved; if (moved && ui.workspaceView === "semantic" && draft) { draft.positions[ui.drag.id] = [parseFloat(ui.drag.node.style.left), parseFloat(ui.drag.node.style.top)]; markDraftSaved(draft); persist(); } ui.drag.node.classList.remove("dragging"); ui.drag = null;
    }
    if (ui.panDrag) { const moved = ui.panDrag.moved; document.querySelector(".canvas-viewport")?.classList.remove("panning"); ui.panDrag = null; saveDraftCanvasView(); if (moved) { ui.suppressCanvasClick = true; setTimeout(() => { ui.suppressCanvasClick = false; }, 0); } }
  });

  window.addEventListener("hashchange", () => { clearTransientUi(); render(); });
  window.addEventListener("pageshow", event => { if (event.persisted) { clearTransientUi(); render(); } });
  window.addEventListener("resize", () => { if (route() === "modeling/mapping") updateMappingLines(); });
  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && (ui.modal || ui.drawer)) { clearTransientUi(); render(); return; }
    if (event.key === "Escape" && route() === "modeling/workbench" && ui.selectedNode) { ui.selectedNode = null; render(); }
    if (route() === "modeling/workbench" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.target.matches("input, textarea, select")) {
      if (event.key === "+" || event.key === "=") handleAction("zoom-in");
      if (event.key === "-") handleAction("zoom-out");
      if (event.key.toLowerCase() === "f") handleAction("fit-canvas");
    }
  });
  writeAuthoritativeC008Projection();
  if (!location.hash) location.hash = "modeling"; else render();
})();
