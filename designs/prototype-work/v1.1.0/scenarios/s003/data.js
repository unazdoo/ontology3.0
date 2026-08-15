(function () {
  "use strict";

  const RESOURCE_PATHS = Object.freeze({
    manifest: "./resources/scenario-manifest.json",
    fixture: "./fixtures/enterprise-fixture.v1.json",
    model: "./resources/m01/model-package.v1.json",
    publishedPointer: "./resources/m01/published-pointer.v1.json",
    c035Results: "./resources/m01/c035-risk-results.v1.json",
    publishedFacts: "./resources/m01/published-risk-facts.v1.json",
    dataContract: "./resources/m02/data-contract.v1.1.json",
    sourceAsset: "./resources/m02/source-asset.v1.json",
    pipelineRun: "./resources/m02/pipeline-run.v1.json",
    formalDataAsset: "./resources/m02/formal-candidate-data-asset.v1.json",
    humanInputSnapshot: "./resources/m02/human-input-snapshot.v1.json",
    qualityResult: "./resources/m02/quality-result.v1.json",
    queryCatalog: "./resources/m03/query-runtime.v1.json",
    decisionBinding: "./resources/m04/decision-binding.v1.json",
    decisionResults: "./resources/m04/decision-results.v1.json",
    agentPosition: "./resources/m05/agent-position.v1.json",
    reportContract: "./resources/m06/report-contract.v1.json",
    reportManifest: "./resources/m06/report-manifest.v1.json",
    reportContents: "./resources/m06/report-contents.v1.json",
    reportArtifacts: "./resources/m06/report-artifacts.v1.json"
  });

  const CHECKPOINT_FILES = Object.freeze([
    ["CP01", "./checkpoints/CP01-initial-configured.json"],
    ["CP02", "./checkpoints/CP02-data-connected.json"],
    ["CP03", "./checkpoints/CP03-published-switched.json"],
    ["CP04", "./checkpoints/CP04-query-integrated.json"],
    ["CP05", "./checkpoints/CP05-decision-chain-completed.json"],
    ["CP06", "./checkpoints/CP06-agent-report-dashboard-completed.json"],
    ["CP07", "./checkpoints/CP07-e2e-integrated.json"],
    ["CP08", "./checkpoints/CP08-unified-scene-shell-completed.json"]
  ]);

  const MODULES = Object.freeze([
    { id: "M02", name: "数据工程", icon: "database", view: "data-quality", note: "数据、人工输入与质量" },
    { id: "M01", name: "本体管理", icon: "network", view: "configuration", note: "模型包与 Published 生命周期" },
    { id: "M03", name: "智能问数", icon: "sparkles", view: "query-decision", anchor: "m03-query", note: "只读消费 Published 事实" },
    { id: "M04", name: "决策中心", icon: "target", view: "query-decision", anchor: "m04-decision", note: "通用 Action Request 与待办" },
    { id: "M05", name: "Agent 应用", icon: "bot", view: "agent-boundary", note: "一期无 S003 专属 Agent" },
    { id: "M06", name: "报告中心", icon: "file", view: "overview", note: "工作台、报告与穿透" }
  ]);

  const VIEWS = Object.freeze([
    { id: "data-quality", label: "数据与质量", short: "数据", icon: "database", inTabs: false },
    { id: "overview", label: "风险总览", short: "总览", icon: "chart" },
    { id: "enterprises", label: "企业明细", short: "企业", icon: "building" },
    { id: "factor-entry", label: "企业因子填报", short: "填报", icon: "edit" },
    { id: "configuration", label: "风险模型配置", short: "配置", icon: "sliders" },
    { id: "runs", label: "运行与报告", short: "运行", icon: "refresh" },
    { id: "query-decision", label: "问数与决策", short: "决策", icon: "message" },
    { id: "checkpoints", label: "场景快照", short: "快照", icon: "layers" },
    { id: "agent-boundary", label: "Agent 能力边界", short: "Agent", icon: "bot", inTabs: false }
  ]);

  const RISK_META = Object.freeze({
    GREEN: { name: "绿灯", className: "risk-green", color: "#3f8f73", description: "风险可控，保持监测" },
    YELLOW: { name: "黄灯", className: "risk-yellow", color: "#c8902f", description: "出现弱化信号，需跟踪" },
    RED: { name: "红灯", className: "risk-red", color: "#c95d54", description: "债务压力显著，需处置" },
    BLACK: { name: "黑灯", className: "risk-black", color: "#28323d", description: "严重风险，需紧急响应" },
    UNKNOWN: { name: "待评估", className: "risk-unknown", color: "#8994a3", description: "等待 M01 权威结果" }
  });

  const FACTOR_INPUT_CHOICES = Object.freeze({
    "融资能力（已用授信余额/授信总额）": ["良好", "一般", "较差"],
    "担保情况": ["未涉及担保", "仅提供担保", "仅获得担保"],
    "总部支持程度": ["高", "较高", "中", "较低", "低"],
    "电价波动率": ["电价变化率大于0", "电价变化率小于等于0且大于-15%", "电价变化率小于等于-15%"],
    "是否存在重大诉讼": ["无重大诉讼", "一般性诉讼", "重大诉讼"],
    "资金余缺预警": ["无资金缺口", "未来第三个月资金余缺预警", "未来第二个月资金余缺预警", "未来第一个月资金余缺预警", "当月资金余缺预警"]
  });

  const FACTOR_IDS_BY_NAME = Object.freeze({
    "融资能力（已用授信余额/授信总额）": "credit-utilization",
    "担保情况": "guarantee",
    "总部支持程度": "headquarters-support",
    "电价波动率": "electricity-price",
    "是否存在重大诉讼": "litigation",
    "资金余缺预警": "fund-gap"
  });

  const BRAND = Object.freeze({
    zh: "智财问策",
    en: "Ontology Financial World",
    scene: "S003 · 债务风险监测"
  });

  const ICONS = Object.freeze({
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.2-4.5 8.4M13.2 7.2l4.5 8.4M7.5 18h9"/>',
    database: '<ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"/><path d="M4.5 11v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    sparkles: '<path d="m12 3 1.15 3.3L16.5 7.5l-3.35 1.2L12 12l-1.15-3.3L7.5 7.5l3.35-1.2L12 3Z"/><path d="m18.5 12 .75 2.25L21.5 15l-2.25.75L18.5 18l-.75-2.25L15.5 15l2.25-.75.75-2.25ZM5.5 13l.6 1.9L8 15.5l-1.9.6L5.5 18l-.6-1.9-1.9-.6 1.9-.6.6-1.9Z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3M12 22v-3M2 12h3"/>',
    bot: '<rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 15h6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    chart: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
    building: '<path d="M5 21V4h10v17M15 9h4v12M8 8h4M8 12h4M8 16h4M3 21h18"/>',
    edit: '<path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
    refresh: '<path d="M20 7v5h-5"/><path d="M18.2 16.5a7 7 0 1 1 .8-8.2L20 12"/>',
    message: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    chevronDown: '<path d="m7 10 5 5 5-5"/>',
    chevronRight: '<path d="m10 7 5 5-5 5"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v7H4V6h7"/>',
    print: '<path d="M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.8 8.2 7 10 4.2-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    save: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M16 10V7a4 4 0 0 0-7.4-2.1"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/>',
    arrowUp: '<path d="m7 11 5-5 5 5M12 6v12"/>',
    arrowDown: '<path d="m7 13 5 5 5-5M12 18V6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11M15 9v11"/>',
    wallet: '<path d="M4 6h14a2 2 0 0 1 2 2v10H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 11h5v4h-5a2 2 0 0 1 0-4Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  });

  function icon(name, className) {
    const body = ICONS[name] || ICONS.info;
    return `<span class="icon ${className || ""}" aria-hidden="true"><svg viewBox="0 0 24 24">${body}</svg></span>`;
  }

  async function fetchJson(path, required) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (required) throw new Error(`无法读取 ${path}：${error.message}`);
      return null;
    }
  }

  async function loadClassicScript(path, globalName) {
    return new Promise(function (resolve) {
      const script = document.createElement("script");
      script.src = `${path}?v=20260815-01`;
      script.async = false;
      script.addEventListener("load", function () { resolve(Boolean(window[globalName])); }, { once: true });
      script.addEventListener("error", function () { script.remove(); resolve(false); }, { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureDomainGlobal(globalName, candidates) {
    if (window[globalName]) return window[globalName];
    for (const candidate of candidates) {
      const loaded = await loadClassicScript(candidate, globalName);
      if (loaded) return window[globalName];
    }
    return null;
  }

  async function load() {
    const entries = await Promise.all(Object.entries(RESOURCE_PATHS).map(async function ([key, path]) {
      return [key, await fetchJson(path, true)];
    }));
    const checkpointEntries = await Promise.all(CHECKPOINT_FILES.map(async function ([code, path]) {
      return { code, path, manifest: await fetchJson(path, false) };
    }));
    const [engine, configService, queryService, decisionService, reportService, checkpointService] = await Promise.all([
      ensureDomainGlobal("S003ScoreEngine", ["./domain/score-engine.js", "./score-engine.js", "./domain.js"]),
      ensureDomainGlobal("S003ConfigService", ["./domain/config-service.js"]),
      ensureDomainGlobal("S003QueryService", ["./domain/query-service.js"]),
      ensureDomainGlobal("S003DecisionService", ["./domain/decision-service.js"]),
      ensureDomainGlobal("S003ReportService", ["./domain/report-service.js"]),
      ensureDomainGlobal("S003CheckpointService", ["./domain/checkpoint-service.js"])
    ]);
    const resources = Object.fromEntries(entries);
    const publishedModel = resources.publishedPointer?.activeTarget?.publishedSnapshot || resources.model;
    return {
      ...resources,
      baseModel: resources.model,
      model: publishedModel,
      checkpoints: checkpointEntries,
      engine,
      configService,
      queryService,
      decisionService,
      reportService,
      checkpointService
    };
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(date).replaceAll("/", "-");
  }

  function formatAmount(value, unit) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    if (Math.abs(number) >= 100000000) return `${(number / 100000000).toFixed(2)} 亿元`;
    if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(2)} 万元`;
    return `${number.toLocaleString("zh-CN", { maximumFractionDigits: 2 })} ${unit || "元"}`;
  }

  function formatScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : "—";
  }

  function shortId(value, head, tail) {
    const text = String(value || "—");
    const left = head || 15;
    const right = tail || 6;
    return text.length > left + right + 1 ? `${text.slice(0, left)}…${text.slice(-right)}` : text;
  }

  function riskKey(value) {
    const key = String(value?.tierId || value?.riskTier || value?.riskLevel || value?.riskLevelId || value || "").toUpperCase();
    if (RISK_META[key]) return key;
    if (key.includes("绿") || key.includes("GREEN")) return "GREEN";
    if (key.includes("黄") || key.includes("YELLOW")) return "YELLOW";
    if (key.includes("红") || key.includes("RED")) return "RED";
    if (key.includes("黑") || key.includes("BLACK")) return "BLACK";
    return "UNKNOWN";
  }

  function riskRank(value) {
    return { BLACK: 0, RED: 1, YELLOW: 2, GREEN: 3, UNKNOWN: 4 }[riskKey(value)] ?? 4;
  }

  function isNotApplicable(enterprise, factorName) {
    return ["环保", "在建企业"].includes(enterprise?.category) && factorName === "电价波动率";
  }

  window.S003Data = Object.freeze({
    BRAND,
    MODULES,
    VIEWS,
    RISK_META,
    FACTOR_INPUT_CHOICES,
    FACTOR_IDS_BY_NAME,
    RESOURCE_PATHS,
    CHECKPOINT_FILES,
    icon,
    load,
    fetchJson,
    formatDateTime,
    formatAmount,
    formatScore,
    shortId,
    riskKey,
    riskRank,
    isNotApplicable
  });
})();
