(function () {
  "use strict";

  const currentScriptSrc = typeof document !== "undefined" ? document.currentScript?.src || "" : "";
  const currentScriptVersion = currentScriptSrc.match(/[?&]v=([^&#]+)/)?.[1];
  const ASSET_VERSION = currentScriptVersion || "20260819-40-performance";
  const SCENARIO_BASE_URL = currentScriptSrc && typeof URL === "function"
    ? new URL("./", currentScriptSrc).href
    : "./";

  function scenarioAssetUrl(path) {
    const relative = String(path || "").startsWith(".") ? String(path) : `./${path}`;
    return typeof URL === "function" ? new URL(relative, SCENARIO_BASE_URL).href : relative;
  }

  const RESOURCE_PATHS = Object.freeze({
    manifest: "./resources/scenario-manifest.json",
    fixture: "./fixtures/enterprise-fixture.v1.json",
    model: "./resources/m01/model-package.v2.json",
    publishedPointer: "./resources/m01/published-pointer.v2.json",
    modelConfiguration: "./resources/m01/model-configuration.v3.json",
    actionTypeCatalog: "./resources/m01/action-type-catalog.v2.json",
    c035Results: "./resources/m01/c035-risk-results.v2.json",
    publishedFacts: "./resources/m01/published-risk-facts.v2.json",
    dataContract: "./resources/m02/data-contract.v1.1.json",
    sourceAsset: "./resources/m02/source-asset.v1.json",
    pipelineRun: "./resources/m02/pipeline-run.v2.json",
    sourceRegistry: "./resources/m02/source-registry.v4.json",
    pipelineProjection: "./resources/m02/pipeline-current-projection.v4.json",
    formalDataAsset: "./resources/m02/formal-candidate-data-asset.v1.json",
    humanInputSnapshot: "./resources/m02/human-input-snapshot.v1.json",
    qualityResult: "./resources/m02/quality-result.v1.json",
    c017DecisionProjection: "./resources/m02/c017-decision-projection.v2.json",
    queryCatalog: "./resources/m03/query-catalog.v3.json",
    queryRuntime: "./resources/m03/query-runtime.v2.json",
    queryResults: "./resources/m03/query-results.v2.json",
    decisionBinding: "./resources/m04/decision-binding.v2.json",
    decisionRuntime: "./resources/m04/decision-runtime.v2.json",
    decisionInbox: "./resources/m04/decision-inbox.v3.json",
    decisionResults: "./resources/m04/decision-results.v3.json",
    enterpriseContactRouting: "./resources/m04/enterprise-contact-routing.v1.json",
    agentPosition: "./resources/m05/agent-position.v7.json",
    reportContract: "./resources/m06/report-contract.v2.json",
    reportManifest: "./resources/m06/report-manifest.v9.json",
    reportContents: "./resources/m06/report-contents.v9.json",
    reportArtifacts: "./resources/m06/report-artifacts.v9.json",
    reportHistory: "./resources/m06/report-history-index.v4.json"
  });

  const CHECKPOINT_FILES = Object.freeze([
    ["CP01", "./checkpoints/CP01-initial-configured.json"],
    ["CP02", "./checkpoints/CP02-data-connected.json"],
    ["CP03", "./checkpoints/CP03-published-switched.json"],
    ["CP04", "./checkpoints/CP04-query-integrated.json"],
    ["CP05", "./checkpoints/CP05-decision-chain-completed.json"],
    ["CP06", "./checkpoints/CP06-agent-report-dashboard-completed.json"],
    ["CP07", "./checkpoints/CP07-e2e-integrated.json"],
    ["CP08", "./checkpoints/CP08-unified-scene-shell-completed.json"],
    ["CP09", "./checkpoints/CP09-runtime-operations-completed.json"],
    ["CP10", "./checkpoints/CP10-v103-baseline-module-integration-completed.json"],
    ["CP11", "./checkpoints/CP11-adapter-isolation-hardening-completed.json"],
    ["CP12", "./checkpoints/CP12-v103-native-integration-corrected.json"],
    ["CP13", "./checkpoints/CP13-v103-native-conditional-integration-completed.json"],
    ["CP14", "./checkpoints/CP14-v103-full-scene-regression-completed.json"],
    ["CP15", "./checkpoints/CP15-v103-full-scene-correction-completed.json"],
    ["CP16", "./checkpoints/CP16-v103-post-seal-regression-completed.json"],
    ["CP17", "./checkpoints/CP17-v103-browser-regression-completed.json"],
    ["CP18", "./checkpoints/CP18-v103-final-validation-completed.json"],
    ["CP19", "./checkpoints/CP19-v103-native-full-scene-browser-validated.json"],
    ["CP20", "./checkpoints/CP20-file-protocol-entry-fixed.json"],
    ["CP21", "./checkpoints/CP21-v103-v7-report-browser-regression-completed.json"],
    ["CP22", "./checkpoints/CP22-member-unit-routing-validated.json"],
    ["CP23", "./checkpoints/CP23-talk-track-and-member-routing-validated.json"],
    ["CP24", "./checkpoints/CP24-inventory-deduplication-validated.json"],
    ["CP25", "./checkpoints/CP25-pointer-sync-validated.json"],
    ["CP26", "./checkpoints/CP26-talk-track-and-full-validation.json"],
    ["CP27", "./checkpoints/CP27-runtime-chain-and-presentation-corrected.json"],
    ["CP28", "./checkpoints/CP28-health-chrome-and-final-regression.json"],
    ["CP29", "./checkpoints/CP29-cache-pinned-final-delivery.json"],
    ["CP30", "./checkpoints/CP30-fixed-score-no-lowest-indicator.json"],
    ["CP31", "./checkpoints/CP31-windows-demo-delivery-ready.json"],
    ["CP32", "./checkpoints/CP32-windows-demo-final-package.json"],
    ["CP33", "./checkpoints/CP33-m04-decision-workbench-ux.json"],
    ["CP34", "./checkpoints/CP34-m04-pointer-sync.json"],
    ["CP35", "./checkpoints/CP35-final-pointer-sync.json"],
    ["CP36", "./checkpoints/CP36-risk-visuals.json"],
    ["CP37", "./checkpoints/CP37-config-consistency.json"],
    ["CP38", "./checkpoints/CP38-performance-and-m04-ux.json"]
  ]);

  // M01—M06 的主路径继承 v1.0.3 的模块原型；S003 只在统一壳和
  // M06 仪表盘上增加场景适配，不以自定义单页替换模块内部工作区。
  // source 是从 S003 场景目录指向冻结基线的适配路径；baselinePath 保留
  // v1.0.3 公共壳原有的模块内部路径，供宿主映射或 postMessage 适配使用。
  // S003 服务根目录是 prototype-work/v1.1.0；该目录中的模块原型与
  // S001 v1.0.3 冻结模块保持基线兼容，因此通过同一服务根目录复用。
  // 不把未暴露的 prototype-releases 路径写进浏览器入口。
  const BASELINE_MODULE_ROOT = "../..";
  const MODULES = Object.freeze([
    { id: "M02", name: "数据工程", icon: "database", view: "data-quality", frameView: "module-M02", source: `${BASELINE_MODULE_ROOT}/data-engineering-prototype-review/review-v3/方案B2.html`, baselinePath: "../data-engineering-prototype-review/review-v3/方案B2.html", entryHash: "#/resources", note: "财务来源、输入快照、管道、质量与资产版本", baselineCompatibility: {
      version: "v1.0.3",
      source: `${BASELINE_MODULE_ROOT}/data-engineering-prototype-review/review-v3/方案B2.html`,
      entryHash: "#/resources",
      nav: [
        { label: "数据资源", hash: "#/resources" },
        { label: "数据管道", hash: "#/pipelines?tab=definitions" }
      ],
      routes: [
        "#/resources",
        "#/resources/source/s003-workbook?tab=overview",
        "#/resources/source/s003-workbook?tab=content",
        "#/resources/source/s003-workbook?tab=snapshots",
        "#/resources/source/s003-workbook?tab=references",
        "#/pipelines?tab=definitions",
        "#/pipelines?tab=runs"
      ],
      resourceKeys: ["sourceAsset", "dataContract", "pipelineRun", "formalDataAsset", "qualityResult", "humanInputSnapshot"]
    } },
    { id: "M01", name: "本体管理", icon: "network", view: "configuration", frameView: "module-M01", source: `${BASELINE_MODULE_ROOT}/ontology-management-review/canvas-first/index.html`, baselinePath: "../ontology-management-review/canvas-first/index.html", entryHash: "#modeling", note: "对象、关系、Metric、Rule、Action Type 与 Published 生命周期", baselineCompatibility: {
      version: "v1.0.3",
      source: `${BASELINE_MODULE_ROOT}/ontology-management-review/canvas-first/index.html`,
      entryHash: "#modeling",
      nav: [
        { label: "语义资产", hash: "#modeling" },
        { label: "已发布", hash: "#published" }
      ],
      routes: ["#modeling", "#published", "#published/resource", "#published/version"],
      resourceKeys: ["model", "publishedPointer", "dataContract", "formalDataAsset", "publishedFacts"]
    } },
    { id: "M03", name: "智能问数", icon: "sparkles", view: "query-decision", frameView: "module-M03", anchor: "m03-query", source: `${BASELINE_MODULE_ROOT}/intelligent-query-prototype/review-next/conversation-workspace/index.html`, baselinePath: "../intelligent-query-prototype/review-next/conversation-workspace/index.html", entryHash: "#/ask", note: "对话工作区、语义导航、问数运行与证据回链" },
    { id: "M04", name: "决策中心", icon: "target", view: "query-decision", frameView: "module-M04", anchor: "m04-decision", source: `${BASELINE_MODULE_ROOT}/decision-center-prototype/index.html?prototypeBuild=20260819-40-performance`, baselinePath: "../decision-center-prototype/index.html?prototypeBuild=20260819-40-performance", entryHash: "#workbench", note: "待决策队列、Action Request、人工确认与负责人待办" },
    { id: "M05", name: "Agent 应用", icon: "bot", view: "agent-boundary", frameView: "module-M05", source: `${BASELINE_MODULE_ROOT}/agent-application/Agent应用.html`, baselinePath: "../agent-application/Agent应用.html", entryHash: "#/agents", note: "Agent 目录、运行、协作与报告伴读边界" },
    { id: "M06", name: "报告中心", icon: "file", view: "overview", frameView: "module-M06", source: `${BASELINE_MODULE_ROOT}/report-center/review-lifecycle/index.html`, baselinePath: "../report-center/review-lifecycle/index.html", entryHash: "#/lifecycle", note: "报告目录、生成、核验、HTML/PDF 发布与比较" }
  ]);

  const MODULE_SOURCE_BY_ID = Object.freeze(Object.fromEntries(MODULES.map(function (module) {
    return [module.id, module];
  })));

  // 以 v1.0.3 壳为主体：M01—M06 一级入口直接装载 v1.0.3 基线模块原型
  // （保留模块内部完整导航与外壳，不做裁剪）；S003 自定义风险工作台只作为
  // M06 仪表盘的场景扩展入口，不替换任何模块主路径。
  const PLATFORM_NAV = Object.freeze([
    { id: "home", name: "首页", icon: "home", action: "view-platform-home", note: "平台能力架构与当前场景进度" },
    { id: "M02", name: "数据工程", icon: "database", action: "open-module-adapter", baselineModuleId: "M02", note: "财务来源、快照、管道、质量与资产版本" },
    { id: "M01", name: "本体管理", icon: "network", action: "open-module-adapter", baselineModuleId: "M01", note: "模型、指标、规则与 Published 生命周期" },
    { id: "M03", name: "智能问数", icon: "sparkles", action: "open-module-adapter", baselineModuleId: "M03", note: "只读消费 Published 风险事实" },
    { id: "M04", name: "决策中心", icon: "target", action: "open-module-adapter", baselineModuleId: "M04", note: "通用 Action Request 与负责人待办" },
    { id: "M05", name: "Agent 应用", icon: "bot", action: "open-module-adapter", baselineModuleId: "M05", note: "能力边界与公共 Agent 位置" },
    { id: "M06", name: "报告中心", icon: "file", action: "open-module-adapter", baselineModuleId: "M06", note: "报告生命周期、运行与穿透" },
    { id: "dashboard", name: "仪表盘", icon: "chart", action: "view-overview", note: "M06 场景风险工作台" }
  ]);

  // v1.0.3 基线模块页面监听的公共交接频道；S003 复用同一频道投递场景身份，
  // 不再使用模块侧无法接收的私有频道。
  const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1";

  // 与 v1.0.3 链路进度的交互语义保持一致，但步骤改用 S003 已确认的
  // 资源和合同，不复制 S001 的融资业务事实或完成状态。
  const PLATFORM_WORKFLOW = Object.freeze([
    { id: "source", module: "M02", title: "接入 S003 财务来源", summary: "财务工作簿作为唯一数据源登记，调节因子 Sheet 只保留为附件历史证据。" },
    { id: "quality", module: "M02", title: "完成数据质量检查", summary: "质量结果与 I/AA、评估时点、币种口径一致。" },
    { id: "input", module: "M02", title: "锁定 T053 企业因子输入", summary: "企业当期取值形成独立人工输入快照；与 M01 模型定义分离并随运行精确绑定。" },
    { id: "model", module: "M01", title: "发布债务风险模型", summary: "Metric、Rule、Action Type 与权威指针统一发布。" },
    { id: "evaluate", module: "M01", title: "形成 C035 权威评估", summary: "21 家企业结果绑定同一 scenarioRunId。" },
    { id: "query", module: "M03", title: "只读问数联调", summary: "问数仅消费 Published 风险事实。" },
    { id: "decision", module: "M04", title: "通用决策交接", summary: "人工确认后才进入 Action Request。" },
    { id: "report", module: "M06", title: "企业报告与仪表盘", summary: "报告、明细和穿透沿同一运行身份追溯。" },
    { id: "checkpoint", module: "M06", title: "场景快照与恢复", summary: "CP01—CP37 保持不可变；CP38 追加锁定 AI 摘要、详情抽屉和首屏性能优化。" }
  ]);

  const VIEWS = Object.freeze([
    { id: "platform-home", label: "平台首页", short: "首页", icon: "home", inTabs: false },
    { id: "module-M01", label: "本体管理 · 基线适配", short: "本体", icon: "network", inTabs: false },
    { id: "module-M02", label: "数据工程 · 基线适配", short: "数据", icon: "database", inTabs: false },
    { id: "module-M03", label: "智能问数 · 基线适配", short: "问数", icon: "sparkles", inTabs: false },
    { id: "module-M04", label: "决策中心 · 基线适配", short: "决策", icon: "target", inTabs: false },
    { id: "module-M05", label: "Agent 应用 · 基线适配", short: "Agent", icon: "bot", inTabs: false },
    { id: "module-M06", label: "报告中心 · 基线适配", short: "报告", icon: "file", inTabs: false },
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
      const response = await fetch(scenarioAssetUrl(path), { cache: "no-cache" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (required) throw new Error(`无法读取 ${path}：${error.message}`);
      return null;
    }
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, function (value) { return value.toString(16).padStart(2, "0"); }).join("");
  }

  async function fetchCheckpointArtifact(path) {
    try {
      // Checkpoint 工件由 manifest SHA-256 锁定。允许浏览器复用响应缓存，
      // 读取后仍会按原始字节重新计算哈希，不以 HTTP 缓存替代完整性校验。
      const response = await fetch(scenarioAssetUrl(path), { cache: "force-cache" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const bytes = await response.arrayBuffer();
      if (!window.crypto?.subtle) throw new Error("浏览器不支持 SHA-256 工件校验");
      const sha256 = bytesToHex(new Uint8Array(await window.crypto.subtle.digest("SHA-256", bytes)));
      let document = null;
      if (/\.json$/i.test(path)) {
        document = JSON.parse(new TextDecoder("utf-8").decode(bytes));
      }
      return { ref: path, sha256, document, error: null };
    } catch (error) {
      return { ref: path, sha256: null, document: null, error: error.message || String(error) };
    }
  }

  function checkpointArtifactReferences(checkpointEntries) {
    const references = new Set();
    checkpointEntries.forEach(function (entry) {
      const manifest = entry.manifest;
      Object.values(manifest?.stateSections || {}).forEach(function (section) {
        (section?.items || []).forEach(function (item) {
          if (item?.ref && item?.sha256) references.add(item.ref);
        });
      });
      Object.values(manifest?.modules || {}).forEach(function (module) {
        if (module?.exportRef && module?.exportSha256) references.add(module.exportRef);
      });
    });
    return references;
  }

  async function loadCheckpointArtifacts(checkpointEntries, existingArtifacts) {
    const artifacts = existingArtifacts || {};
    const references = checkpointArtifactReferences(checkpointEntries);
    const entries = await Promise.all(Array.from(references).filter(function (ref) {
      return !artifacts[ref] || artifacts[ref].error;
    }).map(async function (ref) {
      return [ref, await fetchCheckpointArtifact(ref)];
    }));
    Object.assign(artifacts, Object.fromEntries(entries));
    return artifacts;
  }

  async function loadClassicScript(path, globalName) {
    return new Promise(function (resolve) {
      const script = document.createElement("script");
      const resolved = scenarioAssetUrl(path);
      script.src = `${resolved}${resolved.includes("?") ? "&" : "?"}v=${ASSET_VERSION}`;
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
    const resourcesRequest = Promise.all(Object.entries(RESOURCE_PATHS).map(async function ([key, path]) {
      return [key, await fetchJson(path, true)];
    }));
    const checkpointsRequest = Promise.all(CHECKPOINT_FILES.map(async function ([code, path]) {
      return { code, path, manifest: await fetchJson(path, false) };
    }));
    const servicesRequest = Promise.all([
      ensureDomainGlobal("S003ScoreEngine", ["./domain/score-engine.js", "./score-engine.js", "./domain.js"]),
      ensureDomainGlobal("S003ConfigService", ["./domain/config-service.js"]),
      ensureDomainGlobal("S003QueryService", ["./domain/query-service.js"]),
      ensureDomainGlobal("S003DecisionService", ["./domain/decision-service.js"]),
      ensureDomainGlobal("S003ReportService", ["./domain/report-service.js"]),
      ensureDomainGlobal("S003CheckpointService", ["./domain/checkpoint-service.js"]),
      ensureDomainGlobal("S003CheckpointProjection", ["./domain/checkpoint-projection.js"])
    ]);
    const [entries, checkpointEntries, services] = await Promise.all([resourcesRequest, checkpointsRequest, servicesRequest]);
    const [engine, configService, queryService, decisionService, reportService, checkpointService, checkpointProjection] = services;
    const resources = Object.fromEntries(entries);
    const publishedModel = resources.publishedPointer?.activeTarget?.publishedSnapshot || resources.model;
    const checkpointArtifacts = {};
    const checkpoints = checkpointEntries.map(function (entry) { return { ...entry, integrity: null }; });
    const checkpointLoads = new Map();
    let checkpointLoadQueue = Promise.resolve();
    const runtimeBundle = {
      ...resources,
      baseModel: resources.model,
      model: publishedModel,
      checkpoints,
      checkpointArtifacts,
      engine,
      configService,
      queryService,
      decisionService,
      reportService,
      checkpointService,
      checkpointProjection
    };
    runtimeBundle.ensureCheckpointArtifacts = function (code) {
      const key = code || "*";
      if (checkpointLoads.has(key)) return checkpointLoads.get(key);
      const selected = key === "*"
        ? checkpoints.filter(function (entry) { return Boolean(entry.manifest); })
        : checkpoints.filter(function (entry) { return entry.code === key && entry.manifest; });
      if (!selected.length) return Promise.reject(new Error(`${key} 尚未形成正式不可变快照。`));
      const task = checkpointLoadQueue.then(async function () {
        await loadCheckpointArtifacts(selected, checkpointArtifacts);
        selected.forEach(function (entry) {
          if (!checkpointProjection?.resolveCheckpointProjection) {
            entry.integrity = null;
            return;
          }
          const projection = checkpointProjection.resolveCheckpointProjection({
            code: entry.code,
            manifest: entry.manifest,
            artifacts: checkpointArtifacts
          });
          entry.integrity = {
            exact: projection.exact,
            restorable: projection.restorable,
            runnable: projection.runnable,
            restoreMode: projection.restoreMode,
            issues: projection.issues
          };
        });
        return { code: key, artifacts: checkpointArtifacts, checkpoints: selected };
      }).finally(function () {
        checkpointLoads.delete(key);
      });
      checkpointLoadQueue = task.catch(function () {});
      checkpointLoads.set(key, task);
      return task;
    };
    return runtimeBundle;
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
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
    PLATFORM_NAV,
    HANDOFF_CHANNEL,
    MODULE_SOURCE_BY_ID,
    PLATFORM_WORKFLOW,
    VIEWS,
    RISK_META,
    FACTOR_INPUT_CHOICES,
    FACTOR_IDS_BY_NAME,
    RESOURCE_PATHS,
    CHECKPOINT_FILES,
    icon,
    load,
    fetchJson,
    fetchCheckpointArtifact,
    checkpointArtifactReferences,
    loadCheckpointArtifacts,
    formatDateTime,
    formatAmount,
    formatScore,
    shortId,
    riskKey,
    riskRank,
    isNotApplicable
  });
})();
