(function mountCompositeShell(global) {
  "use strict";

  const DATA = global.OFW_V131_DATA || global.OFW_V120_DATA;
  const STORE = global.OFW_V131_STORE || global.OFW_V120_STORE;
  const app = document.getElementById("app");
  const drawerRoot = document.getElementById("drawer-root");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  const API_BASE = new URLSearchParams(global.location.search).get("m08ApiBase") || new URL('/model-api',global.location.origin).href;
  const JOINT=global.OFW_V14_JOINT;
  global.__OFW_PAGE_INSTANCE__ = global.crypto?.randomUUID?.() || `PAGE-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  global.__OFW_FRAME_LOAD_COUNT__ = 0;
  document.documentElement.dataset.pageInstance = global.__OFW_PAGE_INSTANCE__;
  document.documentElement.dataset.frameLoadCount = "0";
  const ALLOWED_MODULES = new Set(DATA.modules.map((module) => module.id));
  const S005_WORKBENCH_MODULES = new Map([["data", "M02"], ["ontology", "M01"], ["query", "M03"], ["decision", "M04"], ["agent", "M05"], ["report", "M06"]]);
  const S003_OBJECTIVE_ID = "MO-S003-DEBT-RISK-EARLY-WARNING-v1";
  const modelContexts = new Map();
  const modelLoading = new Set();
  const HOME_DOMAIN_ORDER = ["foundation", "intelligence", "action"];
  const HOME_DOMAINS = Object.freeze({
    foundation: Object.freeze({
      order: "01", en: "DATA & ONTOLOGY", name: "数据与本体", icon: "database", modules: ["data", "ontology"],
      title: "把持续变化的数据转化为可复用的业务对象",
      lead: "从数据源和快照进入管道、数据资产、对象类型与语义定义。",
      scope: "数据连接 · 语义对象",
      core: "数据 · 对象 · 关系",
      entries: Object.freeze([
        Object.freeze({ label: "数据源与快照", detail: "查看来源、观察时点和历史快照", moduleId: "data", taskId: "resources", icon: "database" }),
        Object.freeze({ label: "数据管道", detail: "构建、预览和维护数据处理逻辑", moduleId: "data", taskId: "pipelines", icon: "workflow" }),
        Object.freeze({ label: "运行记录", detail: "查看构建结果、耗时和异常", moduleId: "data", taskId: "runs", icon: "history" }),
        Object.freeze({ label: "本体建模", detail: "维护对象、关系、指标和业务定义", moduleId: "ontology", taskId: "modeling", icon: "waypoints" }),
        Object.freeze({ label: "语义资产", detail: "查找已发布对象模型和下游使用", moduleId: "ontology", taskId: "published", icon: "library-big" })
      ])
    }),
    intelligence: Object.freeze({
      order: "02", en: "ANALYZE & MODEL", name: "探索与建模", icon: "sparkles", modules: ["m07", "query", "modeling"],
      title: "从对象探索到问数、模型比较和模拟",
      lead: "围绕同一对象集、时间范围和结果身份持续分析，不重复选择上下文。",
      scope: "对象探索 · 模型目标",
      core: "探索 · 问数 · 模型",
      entries: Object.freeze([
        Object.freeze({ label: "发现业务对象", detail: "搜索对象类型、对象集和已保存探索", moduleId: "m07", taskId: "discover", icon: "search" }),
        Object.freeze({ label: "探索工作台", detail: "联动关系、时序、地图和对比", moduleId: "m07", taskId: "explore", icon: "scan-search" }),
        Object.freeze({ label: "智能问数", detail: "获得结论、证据和可继续处理的对象", moduleId: "query", taskId: "ask", icon: "message-square-text" }),
        Object.freeze({ label: "模型目标", detail: "查看业务问题、模型组合与当前状态", moduleId: "modeling", taskId: "objectives", icon: "target" }),
        Object.freeze({ label: "评测与差异", detail: "固定两个版本进行同口径比较", moduleId: "modeling", taskId: "compare", icon: "chart-no-axes-combined" })
      ])
    }),
    action: Object.freeze({
      order: "03", en: "OPERATE & DELIVER", name: "运营与智能", icon: "circle-dot-dashed", modules: ["dashboard", "decision", "agent", "report"],
      title: "把态势、重点事项、智能任务和报告放在一个闭环中",
      lead: "从经营驾驶舱进入判断、协作和交付，并能返回原对象与证据。",
      scope: "经营态势 · 协作交付",
      core: "态势 · 决策 · 交付",
      entries: Object.freeze([
        Object.freeze({ label: "经营驾驶舱", detail: "查看整体态势、重点对象和变化", moduleId: "dashboard", taskId: "directory", icon: "layout-dashboard" }),
        Object.freeze({ label: "融资与风险态势", detail: "全球地图、债务风险与融资问数", moduleId: "dashboard", taskId: "situation", icon: "globe-2" }),
        Object.freeze({ label: "决策工作台", detail: "处理需要判断、确认和分办的事项", moduleId: "decision", taskId: "workbench", icon: "circle-dot-dashed" }),
        Object.freeze({ label: "决策运营", detail: "跟踪接收、判断、执行和完成进展", moduleId: "decision", taskId: "todos", icon: "list-checks" }),
        Object.freeze({ label: "Agent 应用", detail: "运行解释、比较和业务辅助任务", moduleId: "agent", taskId: "agents", icon: "bot" }),
        Object.freeze({ label: "报告中心", detail: "把对象、图表、答案和证据形成报告", moduleId: "report", taskId: "catalog", icon: "files" })
      ])
    })
  });
  const MODULE_TASKS = Object.freeze({
    data: Object.freeze([
      Object.freeze({ id: "resources", label: "数据资产", icon: "database", hash: "#/resources" }),
      Object.freeze({ id: "pipelines", label: "数据管道", icon: "workflow", hash: "#/pipelines?tab=definitions" }),
      Object.freeze({ id: "runs", label: "运行记录", icon: "history", hash: "#/pipelines?tab=runs" })
    ]),
    ontology: Object.freeze([
      Object.freeze({ id: "modeling", label: "本体建模", icon: "waypoints", hash: "#modeling" }),
      Object.freeze({ id: "published", label: "语义资产", icon: "library-big", hash: "#published" })
    ]),
    query: Object.freeze([
      Object.freeze({ id: "ask", label: "问数工作台", icon: "message-square-text", hash: "#/ask" }),
      Object.freeze({ id: "semantics", label: "语义资源", icon: "library-big", hash: "#/semantics" }),
      Object.freeze({ id: "views", label: "问数视图", icon: "panels-top-left", hash: "#/views" }),
      Object.freeze({ id: "history", label: "历史会话", icon: "history", hash: "#/history" }),
      Object.freeze({ id: "settings", label: "问数设置", icon: "settings-2", hash: "#/agent" })
    ]),
    decision: Object.freeze([
      Object.freeze({ id: "workbench", label: "决策工作台", icon: "circle-dot-dashed", hash: "#workbench" }),
      Object.freeze({ id: "todos", label: "追踪待办", icon: "list-checks", hash: "#overview" })
    ]),
    agent: Object.freeze([
      Object.freeze({ id: "agents", label: "Agent 目录", icon: "bot", hash: "#/agents" }),
      Object.freeze({ id: "resources", label: "配置资源", icon: "blocks", hash: "#/resources" }),
      Object.freeze({ id: "runs", label: "运行中心", icon: "play", hash: "#/runs" }),
      Object.freeze({ id: "evidence", label: "结果与证据", icon: "folder-search-2", hash: "#/evidence" }),
      Object.freeze({ id: "orchestrations", label: "协作编排", icon: "workflow", hash: "#/orchestrations" })
    ]),
    report: Object.freeze([
      Object.freeze({ id: "catalog", label: "报告目录", icon: "files", hash: "#/catalog" }),
      Object.freeze({ id: "create", label: "创建与生成", icon: "file-plus-2", hash: "#/create" }),
      Object.freeze({ id: "definitions", label: "报告定义", icon: "file-cog", hash: "#/definitions" })
    ]),
    m07: Object.freeze([
      Object.freeze({ id: "discover", label: "对象发现", icon: "search", hash: "#discover" }),
      Object.freeze({ id: "explore", label: "探索工作台", icon: "scan-search", hash: "#explore" })
    ]),
    modeling: Object.freeze([
      Object.freeze({ id: "objectives", label: "目标目录", icon: "target", hash: "#objectives" }),
      Object.freeze({ id: "models", label: "模型与代码", icon: "blocks", hash: "#models" }),
      Object.freeze({ id: "compare", label: "评测对比", icon: "chart-no-axes-combined", hash: "#compare" }),
      Object.freeze({ id: "observe", label: "候选观察", icon: "scan-eye", hash: "#observe" }),
      Object.freeze({ id: "release", label: "发布与消费", icon: "package-check", hash: "#release" })
    ]),
    dashboard: Object.freeze([
      Object.freeze({ id: "directory", label: "驾驶舱目录", icon: "layout-grid", hash: "#/dashboards" }),
      Object.freeze({ id: "financing", label: "融资管理", icon: "landmark", hash: "#/view/financing/overview" }),
      Object.freeze({ id: "budget", label: "预算监督", icon: "calculator", hash: "#/view/budget/cost" }),
      Object.freeze({ id: "risk", label: "债务风险", icon: "shield-alert", hash: "#/view/risk/overview" }),
      Object.freeze({ id: "preloan", label: "贷前评估", icon: "clipboard-check", hash: "#/view/preloan/overview" }),
      Object.freeze({ id: "post-investment", label: "投后评价", icon: "chart-candlestick", hash: "#/view/post-investment/overview" })
    ])
  });
  const M07_PORTFOLIO_CONTEXT = Object.freeze({
    scenarioId: "PORTFOLIO",
    scenarioVersion: "M07-PORTFOLIO-v1",
    scenarioRunId: "M07-PORTFOLIO-20260904-0001",
    formedAt: "2026-09-04T00:00:00.000+08:00",
    status: "active"
  });
  const BRAND_BRAIN_SVG = '<path class="brain-mesh-outline" d="M12 4.35C10.92 2.72 8.42 2.35 6.92 3.78 4.76 3.6 3.14 5.67 3.82 7.7 2.18 8.78 2.28 11.18 3.72 12.5 2.62 14.5 3.8 16.96 5.93 17.52 6.22 20.2 9.42 21.38 11.28 19.72c.45-.4.72-.9.72-1.5 0 .6.27 1.1.72 1.5 1.86 1.66 5.06.48 5.35-2.2 2.13-.56 3.31-3.02 2.21-5.02 1.44-1.32 1.54-3.72-.1-4.8.68-2.03-.94-4.1-3.1-3.92-1.5-1.43-4-1.06-5.08.57Z"/><path class="brain-mesh-edge" d="M12 4.35 8.65 4.6 6.05 6.15 9.4 7.3 12 8.95 14.6 7.3 17.95 6.15 15.35 4.6 12 4.35M6.05 6.15 4.78 9.05 7.35 10.35 9.4 7.3M4.78 9.05 5.55 13.55 7.35 10.35 9.95 11.7 12 8.95M5.55 13.55 8.65 15.55 9.95 11.7 12 14.05 10.25 17.55 8.65 15.55M5.55 13.55 6.02 16.35 8.65 15.55M10.25 17.55 12 19.25 13.75 17.55 12 14.05M12 8.95 12 14.05M17.95 6.15 19.22 9.05 16.65 10.35 14.6 7.3M19.22 9.05 18.45 13.55 16.65 10.35 14.05 11.7 12 8.95M18.45 13.55 15.35 15.55 14.05 11.7 12 14.05 13.75 17.55 15.35 15.55M18.45 13.55 17.98 16.35 15.35 15.55M7.35 10.35 12 8.95 16.65 10.35M8.65 15.55 12 14.05 15.35 15.55"/><path class="brain-mesh-seam" d="M12 4.35v15"/><path class="brain-mesh-signal signal-a" pathLength="1" d="M4.78 9.05 7.35 10.35 9.95 11.7 12 14.05 13.75 17.55"/><path class="brain-mesh-signal signal-b" pathLength="1" d="M17.95 6.15 14.6 7.3 12 8.95 9.95 11.7 8.65 15.55"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="4.35" r=".48"/><circle class="brain-mesh-node phase-b" cx="8.65" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-c" cx="6.05" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="9.4" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-b" cx="4.78" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-a" cx="7.35" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-c" cx="9.95" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-d" cx="5.55" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-b" cx="6.02" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-a" cx="8.65" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-c" cx="10.25" cy="17.55" r=".34"/><circle class="brain-mesh-node phase-d node-key" cx="12" cy="8.95" r=".46"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="14.05" r=".46"/><circle class="brain-mesh-node phase-c node-key" cx="12" cy="19.25" r=".48"/><circle class="brain-mesh-node phase-b" cx="15.35" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-a" cx="17.95" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="14.6" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-c" cx="19.22" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-b" cx="16.65" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="14.05" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-a" cx="18.45" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-c" cx="17.98" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="15.35" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-b" cx="13.75" cy="17.55" r=".34"/>';

  let renderedModuleId = null;
  let drawerResourceId = null;
  let modalKind = null;
  let frameSaveTimer = null;
  let homeScrollTimer = null;
  let navigationRenderScheduled = false;
  let homeDomain = "foundation";
  let homeOrbitTurn = 0;
  let serviceState = "checking";
  let catalogQuery = "";
  let catalogDomain = "all";
  let drawerFocus = null;
  let restoringLinkedExploration = false;

  async function refreshModelContext({ scenarioId = STORE.get().activeScenarioId, rerender = false } = {}) {
    if (modelLoading.has(scenarioId)) return modelContexts.get(scenarioId) || null;
    modelLoading.add(scenarioId);
    try {
      const response = await fetch(`${API_BASE}/v1/model-management/context?scenarioId=${encodeURIComponent(scenarioId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`模型优化服务返回 ${response.status}`);
      const payload = await response.json();
      modelContexts.set(scenarioId, payload);
      serviceState = "ready";
      syncServiceStatus();
      if (rerender && parseRoute().type === "home" && STORE.get().activeScenarioId === scenarioId) renderHome();
      return payload;
    } catch (error) {
      const payload = { state: null, loadError: error.message };
      modelContexts.set(scenarioId, payload);
      serviceState = "error";
      syncServiceStatus();
      if (rerender && parseRoute().type === "home" && STORE.get().activeScenarioId === scenarioId) renderHome();
      return payload;
    } finally {
      modelLoading.delete(scenarioId);
    }
  }

  function catalog() {
    return global.OFW_V131_CATALOG || global.OFW_V120_CATALOG || {
      scenarios: DATA.scenarios,
      resources: [],
      resourcesFor: () => [],
      scenario: (id) => DATA.scenarioById[id] || null,
      resource: () => null
    };
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function icon(name, size = "") {
    return `<span class="icon ${size}" aria-hidden="true"><i data-lucide="${esc(name)}"></i></span>`;
  }

  function brandBrainIcon() {
    return `<span class="icon brand-brain" aria-hidden="true"><svg viewBox="0 0 24 24">${BRAND_BRAIN_SVG}</svg></span>`;
  }

  function refreshIcons(root = document) {
    if (global.lucide?.createIcons) global.lucide.createIcons({ root, attrs: { "stroke-width": 1.8 } });
  }

  function parseRoute() {
    const hash = global.location.hash || "#home";
    if (["#", "#/", "#home"].includes(hash)) return { type: "home", active: "home", key: "home" };
    if (hash === "#dashboard") return { type: "dashboard", active: "dashboard", key: "dashboard" };
    const match = hash.match(/^#module\/([a-z0-9-]+)$/);
    if (match && ALLOWED_MODULES.has(match[1])) return { type: "module", moduleId: match[1], active: match[1], key: `module-${match[1]}` };
    return { type: "home", active: "home", key: "home" };
  }

  function activeDefinition() {
    return DATA.scenarioById[STORE.get().activeScenarioId] || DATA.scenarioById.S005;
  }

  function activeContext() {
    return STORE.scenarioContext();
  }

  function moduleForRoute(route = parseRoute()) {
    if (route.type === "module") return DATA.moduleById[route.moduleId];
    if (route.type === "dashboard") return DATA.dashboard;
    return null;
  }

  function resourceStatus(value) {
    const key = String(value || "available").toLowerCase();
    if (["completed", "published", "verified", "archived"].includes(key)) return { label: key === "archived" ? "已归档" : key === "published" ? "已发布" : "已形成", tone: "success" };
    if (["active", "running", "available", "ready"].includes(key)) return { label: key === "active" || key === "running" ? "进行中" : "可读取", tone: "info" };
    if (["candidate"].includes(key)) return { label: "可运行", tone: "info" };
    if (["confirmed"].includes(key)) return { label: "已确认", tone: "success" };
    if (["read_only"].includes(key)) return { label: "只读", tone: "info" };
    if (["not_registered"].includes(key)) return { label: "未登记", tone: "neutral" };
    if (["partial", "warning", "review_required"].includes(key)) return { label: "需复核", tone: "warning" };
    if (["not_applicable"].includes(key)) return { label: "不适用", tone: "neutral" };
    if (["blocked", "unavailable", "insufficient"].includes(key)) return { label: "暂不可用", tone: "danger" };
    if (["draft", "pending"].includes(key)) return { label: "待形成", tone: "neutral" };
    return { label: String(value || "可读取"), tone: "neutral" };
  }

  function shortRunId(value) {
    const text = String(value || "");
    return text.length > 30 ? `${text.slice(0, 18)}...${text.slice(-8)}` : text;
  }

  function setTitle(route) {
    const module = moduleForRoute(route);
    document.title = module ? `${module.name} · ${DATA.brand.zh}` : `${DATA.brand.zh}（${DATA.brand.en}）`;
  }

  function navigate(route, options = {}) {
    if(!options.skipCapture)captureFramePosition();
    captureHomePosition();
    const previousModule = moduleForRoute();
    if (previousModule) STORE.rememberWork(global.location.hash, previousModule.name);
    history.replaceState({ ...(history.state || {}), workspaceContext: STORE.workspaceContext() }, "", global.location.href);
    closeDrawer();
    closeModal();
    const currentDepth = Number(history.state?.ofwDepth || 0);
    const state = { ofwShell: true, scenarioId: STORE.get().activeScenarioId, workspaceContext: STORE.workspaceContext(), ofwDepth: options.replace ? currentDepth : currentDepth + 1 };
    STORE.saveNavigation({ lastRoute: route, returnRoute: global.location.hash || "#home" });
    if (options.replace) history.replaceState(state, "", route);
    else history.pushState(state, "", route);
    render();
  }

  function returnToPrevious() {
    if (Number(history.state?.ofwDepth || 0) > 0) history.back();
    else navigate("#home", { replace: true });
  }

  function navMarkup(route) {
    const state = STORE.get();
    return `<aside class="global-nav" aria-label="平台导航">
      <button class="brand-lockup" type="button" data-action="toggle-navigation" aria-label="${state.navCollapsed ? "展开主导航" : "收起主导航"}" title="${state.navCollapsed ? "展开主导航" : "收起主导航"}">
        <span class="brand-mark brand-mark-ai" aria-hidden="true">${brandBrainIcon()}</span>
        <span class="brand-copy"><strong>${esc(DATA.brand.zh)}</strong><small>${esc(DATA.brand.en)}</small></span>
      </button>
      <nav class="primary-nav" aria-label="一级模块">
        ${DATA.nav.map((item) => {
          const count = item.id === "home" ? 0 : catalog().resourcesFor?.(item.id)?.length || 0;
          const shortLabel = item.id === "dashboard" ? DATA.dashboard.short : DATA.moduleById[item.id]?.short || item.name;
          return `<button class="nav-item ${route.active === item.id ? "active" : ""}" type="button" data-route="${item.route}" data-primary-nav="true" title="${esc(item.name)}" aria-label="${esc(item.name)}">
            ${icon(item.icon)}<span class="nav-label">${esc(item.name)}</span><span class="nav-label-short" aria-hidden="true">${esc(shortLabel)}</span>${item.id === "home" ? "" : `<i class="nav-state ${count ? "ready" : ""}" aria-label="${count} 项资源"></i>`}
          </button>`;
        }).join("")}
      </nav>
      <footer class="nav-foot"><button type="button" data-action="retry-service" id="service-status" title="重新检查模型服务">${serviceMarkup()}</button><span class="version-label">v1.4 · 本地原型</span></footer>
    </aside>`;
  }

  function workspaceContextChipMarkup() {
    const context = STORE.workspaceContext?.() || {};
    const object = context.activeObjectRef || context.objectSetRef;
    const objectLabel = object?.title || object?.name || object?.label || object?.id || "全部业务对象";
    const timeLabel = context.timeRange?.label
      || (context.timeRange?.start && context.timeRange?.end ? `${context.timeRange.start} 至 ${context.timeRange.end}` : "全部观察期");
    const viewLabels = { formal: "正式结果", demo: "演示基准", candidate: "候选试算", shadow: "影子观察", simulation: "压力模拟", difference: "版本差异" };
    return `<button id="workspace-context-chip" class="workspace-context-chip" type="button" data-action="open-workspace-context" title="查看当前工作上下文">
      <span>${icon(object ? "focus" : "layers-3", "sm")}<b>${esc(objectLabel)}</b></span>
      <small>${esc(timeLabel)} · ${esc(viewLabels[context.resultView] || "正式结果")}</small>
      ${icon("chevron-down", "xs")}
    </button>`;
  }

  function topbarMarkup(route) {
    const module = moduleForRoute(route);
    const currentName = module?.name || "首页";
    const currentTask = module ? moduleTasks(module.id)[0]?.label || currentName : "首页";
    return `<header class="global-topbar">
      <div class="top-title">
        ${route.type === "home" ? "" : `<button class="icon-button mobile-back" type="button" data-action="return" title="返回" aria-label="返回">${icon("arrow-left", "sm")}</button>`}
        ${icon(module?.icon || "house")}
        ${module ? `<nav class="top-breadcrumb" aria-label="当前位置"><button type="button" data-route="#home">首页</button>${icon("chevron-right", "xs")}<button type="button" data-action="module-root" data-module-id="${module.id}">${esc(currentName)}</button>${icon("chevron-right", "xs")}<strong id="frame-breadcrumb-current">${esc(currentTask)}</strong></nav>` : `<div><span>工作台</span><strong>首页</strong></div>`}
      </div>
      <div class="top-actions">
        <button class="top-action" type="button" data-action="open-catalog" title="搜索业务资源" aria-label="搜索业务资源">${icon("search", "sm")}</button>
        <button class="top-action" type="button" data-action="open-recent" title="最近工作" aria-label="最近工作">${icon("history", "sm")}</button>
        ${module ? `<button class="top-action" type="button" data-action="reload-frame" title="重新读取当前模块" aria-label="重新读取当前模块">${icon("refresh-cw", "sm")}</button>` : ""}
        <div class="user-account" title="当前账号"><span>管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function syncWorkspaceContextChrome() {
    const slot = document.getElementById("workspace-context-slot");
    if (!slot) return;
    slot.innerHTML = workspaceContextChipMarkup();
    refreshIcons(slot);
  }

  function serviceMarkup() {
    return `<i class="connection-dot ${serviceState}"></i><strong>${serviceState === "ready" ? "模型服务已连接" : serviceState === "error" ? "模型服务未连接" : "检查服务中"}</strong>`;
  }

  function syncServiceStatus() {
    const status = document.getElementById("service-status");
    if (status) status.innerHTML = serviceMarkup();
  }

  function normalizeWorkspaceContextPatch(patch = {}) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) return {};
    const normalized = { ...clonePlain(patch) };
    const objectSet = patch.objectSetRef ?? patch.objectSet ?? patch.scope;
    const activeObject = patch.activeObjectRef ?? patch.object ?? patch.selectedObject;
    const rawResultView = patch.resultView ?? patch.resultMode?.id ?? patch.resultMode?.kind ?? patch.resultMode ?? patch.resultKind;
    if (!normalized.scenarioId && patch.comparisonRef?.scenarioId) normalized.scenarioId = patch.comparisonRef.scenarioId;
    const resultView = ({ fact: "formal", prediction: "candidate", diff: "difference" })[String(rawResultView || "").toLowerCase()] || String(rawResultView || "").toLowerCase();
    if (objectSet !== undefined) normalized.objectSetRef = objectSet == null ? null : {
      ...clonePlain(objectSet),
      title: objectSet.title || objectSet.label || objectSet.name || objectSet.id,
      objectIds: clonePlain(objectSet.objectIds || objectSet.ids || [])
    };
    if (activeObject !== undefined) normalized.activeObjectRef = activeObject == null ? null : {
      ...clonePlain(activeObject),
      title: activeObject.title || activeObject.label || activeObject.name || activeObject.id,
      objectTypeRef: activeObject.objectTypeRef || activeObject.type || activeObject.objectType || "BusinessObject"
    };
    if (rawResultView !== undefined) normalized.resultView = ["formal", "demo", "candidate", "shadow", "simulation", "difference"].includes(resultView) ? resultView : "formal";
    if (patch.source?.moduleId && !patch.sourceModuleId) normalized.sourceModuleId = patch.source.moduleId;
    if (patch.dataVersionId && !patch.dataVersionRef) normalized.dataVersionRef = { id: patch.dataVersionId };
    if (patch.ontologyVersionId && !patch.ontologyVersionRef) normalized.ontologyVersionRef = { id: patch.ontologyVersionId };
    delete normalized.objectSet;
    delete normalized.object;
    delete normalized.selectedObject;
    delete normalized.scope;
    delete normalized.resultMode;
    delete normalized.resultKind;
    delete normalized.source;
    return normalized;
  }

  function workspaceContextForFrame(context = STORE.workspaceContext?.() || {}, moduleId = null) {
    const resultLabels = { formal: "正式结果", demo: "演示基准", candidate: "候选试算", shadow: "影子观察", simulation: "压力模拟", difference: "正式与候选差异" };
    const objectSetRef = context.objectSetRef;
    const objectSet = objectSetRef ? {
      ...clonePlain(objectSetRef),
      label: objectSetRef.title || objectSetRef.label || objectSetRef.name || objectSetRef.id
    } : null;
    const object = context.activeObjectRef ? {
      ...clonePlain(context.activeObjectRef),
      label: context.activeObjectRef.title || context.activeObjectRef.label || context.activeObjectRef.name || context.activeObjectRef.id,
      type: context.activeObjectRef.objectTypeRef || context.activeObjectRef.type || "业务对象"
    } : null;
    const effectiveScenarioId = context.scenarioId || context.comparisonRef?.scenarioId || context.objectiveRef?.scenarioId || STORE.get().activeScenarioId;
    return {
      ...clonePlain(context),
      scenarioId: effectiveScenarioId,
      objectSet,
      object,
      resultMode: { id: context.resultView || "formal", label: resultLabels[context.resultView] || "正式结果" },
      source: { moduleId: context.sourceModuleId || null }
    };
  }

  function updateWorkspaceContext(patch, reason = "module") {
    const normalized = normalizeWorkspaceContextPatch(patch);
    const next = STORE.updateWorkspaceContext?.(normalized, reason) || null;
    syncWorkspaceContextChrome();
    const frame = document.getElementById("module-frame");
    const module = frame && renderedModuleId ? (renderedModuleId === "dashboard" ? DATA.dashboard : DATA.moduleById[renderedModuleId]) : null;
    const sourceModuleId = String(normalized.sourceModuleId || reason || "").toLowerCase();
    if (frame && module && sourceModuleId !== module.id.toLowerCase() && sourceModuleId !== String(module.ownerId || "").toLowerCase()) deliverWorkspaceContext(frame, module, next);
    return next;
  }

  function syncHomeDomainFromScenario() {
    const navigation = STORE.activeScenario()?.navigation || {};
    const savedDomain = navigation.homeDomain;
    const nextDomain = HOME_DOMAINS[savedDomain] ? savedDomain : "foundation";
    const nextIndex = HOME_DOMAIN_ORDER.indexOf(nextDomain);
    let nextTurn = Number.isFinite(Number(navigation.homeOrbitTurn)) ? Math.max(0, Math.trunc(Number(navigation.homeOrbitTurn))) : nextIndex;
    const remainder = ((nextTurn % HOME_DOMAIN_ORDER.length) + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    if (remainder !== nextIndex) nextTurn += (nextIndex - remainder + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    homeDomain = nextDomain;
    homeOrbitTurn = nextTurn;
  }

  function homeArchitecturePathMarkup() {
    const activeSegment = HOME_DOMAIN_ORDER.indexOf(homeDomain) + 1;
    return `<svg class="architecture-path" viewBox="0 0 640 520" aria-hidden="true">
      <defs><marker id="home-architecture-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto" overflow="visible"><path d="M2 1.5 10.5 6 2 10.5"/></marker><marker id="home-architecture-arrow-active" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto" overflow="visible"><path d="M2 1.5 10.5 6 2 10.5"/></marker></defs>
      <g class="path-segment segment-1${activeSegment === 1 ? " active" : ""}"><path class="path-track" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2" marker-end="url(#home-architecture-arrow${activeSegment === 1 ? "-active" : ""})"/><path class="path-flow" pathLength="1" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2"/></g>
      <g class="path-segment segment-2${activeSegment === 2 ? " active" : ""}"><path class="path-track" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2" marker-end="url(#home-architecture-arrow${activeSegment === 2 ? "-active" : ""})"/><path class="path-flow" pathLength="1" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2"/></g>
      <g class="path-segment segment-3${activeSegment === 3 ? " active" : ""}"><path class="path-track" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1" marker-end="url(#home-architecture-arrow${activeSegment === 3 ? "-active" : ""})"/><path class="path-flow" pathLength="1" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1"/></g>
    </svg>`;
  }

  function homeCoreGraphicMarkup() {
    const domain = HOME_DOMAINS[homeDomain] || HOME_DOMAINS.foundation;
    return `<div class="classic-core" data-core-state="${homeDomain}" aria-hidden="true">
      <svg viewBox="0 0 220 150">
        <g class="core-grid"><path d="M34 112 110 137l76-25-76-25-76 25Zm19-6 57 19 57-19M72 100l38 13 38-13M34 112v8l76 25 76-25v-8M72 100v26m38-39v58m38-45v26"/></g>
        <path class="core-hud" d="M31 30v-8h9m140 0h9v8M31 104v8h9m140 0h9v-8M110 13v8m0 91v12M28 67h12m140 0h12"/>
        <polygon class="core-piece core-a" points="110,18 166,48 110,78 54,48"/>
        <polygon class="core-piece core-b" points="110,29 153,52 110,75 67,52"/>
        <polygon class="core-piece core-c" points="110,40 143,58 110,76 77,58"/>
        <rect class="core-piece core-d" x="83" y="31" width="54" height="54"/>
        <rect class="core-piece core-e" x="105" y="53" width="10" height="10"/>
        <path class="core-trace core-trace-foundation" d="M72 34H48v10H36m112-10h24v10h12M65 60H43v20H31m124-20h22v20h12M70 86H50v18H38m112-18h20v18h12M110 18v98"/>
        <path class="core-trace core-trace-intelligence" d="M46 42 76 26l30 16-30 16-30-16Zm0 0v34l30 17 30-17V42M76 58v35M114 46l30-16 30 16-30 16-30-16Zm0 0v34l30 17 30-17V46M144 62v35M106 58h8m-8 14h8"/>
        <path class="core-trace core-trace-action" d="M92 27h36l30 22M161 60v23l-36 26M110 111H91L59 88V57m51-11 25 16-25 16-25-16 25-16Z"/>
        <path class="core-scan" d="M45 29h130"/>
        <rect class="core-pulse" x="103" y="51" width="14" height="14"/>
      </svg>
      <b>${esc(DATA.brand.zh)}</b><span class="core-label">${esc(domain.core)}</span>
    </div>`;
  }

  function homeCapabilityPanelMarkup(domainId, { entering = false } = {}) {
    const domain = HOME_DOMAINS[domainId] || HOME_DOMAINS.foundation;
    return `<aside class="home-capability-panel${entering ? " is-entering" : ""}" data-home-capability-panel data-domain="${esc(domainId)}">
      <header><span>${esc(domain.en)}</span><h2>${esc(domain.title)}</h2><p>${esc(domain.lead)}</p></header>
      <div class="home-capability-list">${domain.entries.map((entry) => {
        const module = entry.moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[entry.moduleId];
        return `<button type="button" class="home-capability-entry" data-action="home-entry" data-entry-route="${esc(module?.route || "#home")}" data-entry-module="${esc(entry.moduleId)}" data-entry-task="${esc(entry.taskId || "")}">
          <span class="home-capability-icon">${icon(entry.icon, "sm")}</span><span><strong>${esc(entry.label)}</strong><small>${esc(entry.detail)}</small></span>${icon("arrow-up-right", "sm")}
        </button>`;
      }).join("")}</div>
      <footer><span>${esc(domain.scope)}</span><strong>${domain.entries.length} 个功能入口</strong></footer>
    </aside>`;
  }

  function openHomeEntry(button) {
    const moduleId = button.dataset.entryModule;
    const taskId = button.dataset.entryTask;
    const module = moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[moduleId];
    const task = moduleTasks(moduleId).find((item) => item.id === taskId);
    if (!module) return;
    if (task?.hash) STORE.saveFramePosition(module.id, { hash: task.hash, windowY: 0, containerY: 0 }, STORE.get().activeScenarioId);
    navigate(button.dataset.entryRoute || module.route || "#home");
  }

  function selectHomeDomain(nextDomain) {
    if (!HOME_DOMAINS[nextDomain] || nextDomain === homeDomain) return;
    const currentIndex = HOME_DOMAIN_ORDER.indexOf(homeDomain);
    const nextIndex = HOME_DOMAIN_ORDER.indexOf(nextDomain);
    homeOrbitTurn += (nextIndex - currentIndex + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    homeDomain = nextDomain;
    const frame = app.querySelector(".classic-home-frame");
    if (!frame) return;
    frame.dataset.homeDomain = homeDomain;
    frame.querySelectorAll(".path-segment").forEach((segment, index) => {
      const selected = index === nextIndex;
      segment.classList.toggle("active", selected);
      segment.querySelector(".path-track")?.setAttribute("marker-end", `url(#home-architecture-arrow${selected ? "-active" : ""})`);
    });
    frame.querySelectorAll(".architecture-node").forEach((node) => {
      const selected = node.dataset.domain === homeDomain;
      node.classList.toggle("active", selected);
      node.setAttribute("aria-pressed", String(selected));
    });
    const core = frame.querySelector(".classic-core");
    if (core) {
      core.dataset.coreState = homeDomain;
      const label = core.querySelector(".core-label");
      if (label) label.textContent = HOME_DOMAINS[homeDomain].core;
    }
    const panel = frame.querySelector("[data-home-capability-panel]");
    if (panel) {
      const replacement = document.createElement("div");
      replacement.innerHTML = homeCapabilityPanelMarkup(homeDomain, { entering: true });
      const nextPanel = replacement.firstElementChild;
      panel.replaceWith(nextPanel);
      refreshIcons(nextPanel);
      requestAnimationFrame(() => nextPanel.classList.remove("is-entering"));
    }
    STORE.saveNavigation({ homeDomain, homeOrbitTurn });
  }

  function renderHome() {
    syncHomeDomainFromScenario();
    const content = `<div class="home-view scheme-a-home" data-screen-label="智财问策统一业务工作台"><div class="home-container">
      <section class="classic-home-frame" data-home-domain="${homeDomain}">
        <div class="classic-architecture">
          <div class="architecture-intro"><div><span>${esc(DATA.brand.en)} · 平台能力架构</span><h1>从可信数据到可追溯决策</h1></div></div>
          <div class="architecture-cycle" aria-label="平台三大能力域">
            ${homeArchitecturePathMarkup()}
            ${Object.entries(HOME_DOMAINS).map(([key, item]) => `<button class="architecture-node ${key}${homeDomain === key ? " active" : ""}" type="button" data-action="home-domain" data-domain="${key}" aria-pressed="${homeDomain === key}"><span class="node-en">${item.en.split(" & ").map(esc).join(" &<br>")}</span>${icon(item.icon, "architecture-node-icon")}<span class="node-zh">${esc(item.name)}</span><small class="node-scope">${item.scope.split(" · ").map(esc).join("<br>")}</small></button>`).join("")}
            ${homeCoreGraphicMarkup()}
          </div>
        </div>
        ${homeCapabilityPanelMarkup(homeDomain)}
      </section>
    </div></div>`;
    renderShell(content, { type: "home", active: "home", key: "home" });
    const home = app.querySelector(".home-view");
    const saved = Number(STORE.activeScenario()?.navigation?.homeScrollTop) || 0;
    if (home) {
      requestAnimationFrame(() => { home.scrollTop = saved; });
      home.addEventListener("scroll", () => {
        clearTimeout(homeScrollTimer);
        homeScrollTimer = setTimeout(captureHomePosition, 140);
      }, { passive: true });
    }
  }

  function moduleTasks(moduleId) {
    return [...(MODULE_TASKS[moduleId] || []),...(JOINT?.tasks[moduleId]||[])];
  }

  function taskFromFrame(frame, module) {
    const jointTask=JOINT?.taskForFrame(frame,module.id);if(jointTask)return jointTask;
    const tasks = moduleTasks(module.id);
    if (!tasks.length) return null;
    try {
      const rawHash = frame?.contentWindow?.location?.hash || "";
      const aliases = module.id === "modeling"
        ? { "#overview": "#objectives", "#portfolio": "#models", "#repository": "#models", "#benchmark": "#compare", "#shadow": "#observe", "#monitor": "#release" }
        : module.id === "m07" ? { "": "#discover", "#catalog": "#discover" } : {};
      const hash = aliases[rawHash] || rawHash;
      if (module.id === "dashboard") {
        const viewId = hash.match(/^#\/view\/([^/]+)/)?.[1];
        return tasks.find((task) => task.id === (viewId || "directory")) || tasks[0];
      }
      return tasks.find((task) => task.hash === hash)
        || tasks.find((task) => hash.startsWith(task.hash?.split("?")[0] || "__missing__"))
        || tasks[0];
    } catch (_) {
      return tasks[0];
    }
  }

  function secondaryNavMarkup(module) {
    const tasks = moduleTasks(module.id);
    if (!tasks.length) return "";
    const saved = STORE.activeScenario()?.navigation?.framePositions?.[module.id];
    const rawGuessedHash = saved?.hash || module.rootHash || tasks[0]?.hash || "";
    const aliases = module.id === "modeling"
      ? { "#overview": "#objectives", "#portfolio": "#models", "#repository": "#models", "#benchmark": "#compare", "#shadow": "#observe", "#monitor": "#release" }
      : module.id === "m07" ? { "": "#discover", "#catalog": "#discover" } : {};
    const guessedHash = aliases[rawGuessedHash] || rawGuessedHash;
    const active = module.id === "dashboard"
      ? tasks.find((task) => guessedHash.includes(`/view/${task.id}/`)) || tasks[0]
      : tasks.find((task) => task.hash === guessedHash) || tasks.find((task) => guessedHash.startsWith(task.hash?.split("?")[0] || "__missing__")) || tasks[0];
    return `<aside class="module-subnav" data-module-id="${esc(module.id)}" aria-label="${esc(module.name)}任务导航"><header><span>${esc(module.ownerId)}</span><strong>${esc(module.name)}</strong></header><select class="module-subnav-select" data-module-task-select="${esc(module.id)}" aria-label="选择${esc(module.name)}任务">${tasks.map((task) => `<option value="${esc(task.id)}" ${task.id === active?.id ? "selected" : ""}>${esc(task.label)}</option>`).join("")}</select><nav>${tasks.map((task) => `<button type="button" class="module-subnav-item ${task.id === active?.id ? "active" : ""}" data-module-task="${esc(task.id)}" data-module-id="${esc(module.id)}">${icon(task.icon, "sm")}<span>${esc(task.label)}</span></button>`).join("")}</nav></aside>`;
  }

  function resourcePathForM07() {
    return "/designs/prototype-work/v1.4/composite/modules/m07/resources/portfolio.json";
  }

  function applyContext(url, context) {
    if (!context) return url;
    Object.entries({
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      formedAt: context.formedAt,
      status: context.status,
      contextCreatedAt: context.formedAt,
      contextStatus: context.status,
      scenarioFormedAt: context.formedAt,
      scenarioStatus: context.status
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    return url;
  }

  function safeM07ReturnUrl(saved, context) {
    try {
      const candidate = new URL(saved, global.location.href);
      const canonical = new URL(DATA.moduleById.m07.source, global.location.href);
      if (candidate.origin !== global.location.origin || candidate.pathname !== canonical.pathname) return null;
      ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status", "contextCreatedAt", "contextStatus", "scenarioFormedAt", "scenarioStatus"].forEach((key) => candidate.searchParams.delete(key));
      candidate.searchParams.set("v", "20260904-02");
      candidate.searchParams.set("embedded", "1");
      candidate.searchParams.set("resource", resourcePathForM07());
      return candidate;
    } catch (_) {
      return null;
    }
  }

  function frameSource(module) {
    const context = activeContext();
    const saved = STORE.activeScenario()?.navigation?.framePositions?.[module.id];
    const jointTask=moduleTasks(module.id).find(task=>task.view&&task.hash===saved?.hash);if(jointTask)return JOINT.source(jointTask);
    const handoff = STORE.handoff(context?.scenarioRunId);
    if (module.id === "m07") {
      const requested = new URLSearchParams(global.location.search).get("exploration");
      if (requested) {
        const linked = safeM07ReturnUrl(requested, context);
        const shellUrl = new URL(global.location.href);
        shellUrl.searchParams.delete("exploration");
        history.replaceState(history.state, "", shellUrl);
        if (linked) { restoringLinkedExploration = true; linked.searchParams.set("restore", "1"); return `${linked.pathname}${linked.search}${linked.hash}`; }
      }
      const restored = handoff?.m07?.returnUrl ? safeM07ReturnUrl(handoff.m07.returnUrl, context) : null;
      const url = restored || (saved?.href && safeM07ReturnUrl(saved.href, context)) || new URL(module.source, global.location.href);
      ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status", "contextCreatedAt", "contextStatus", "scenarioFormedAt", "scenarioStatus"].forEach((key) => url.searchParams.delete(key));
      url.searchParams.set("embedded", "1");
      url.searchParams.set("resource", resourcePathForM07());
      if (!restored) url.hash = saved?.hash || module.rootHash || "#discover";
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (module.id === "modeling") {
      const url = applyContext(new URL(module.source, global.location.href), context);
      url.searchParams.set("apiBase", API_BASE);
      url.searchParams.set("programIds", DATA.scenarios.map((item) => item.id).join(","));
      url.searchParams.set("embedded", "1");
      url.hash = saved?.hash || module.rootHash || "#objectives";
      return `${url.pathname}${url.search}${url.hash}`;
    }
    let url;
    try {
      const source = new URL(module.source, global.location.href);
      const savedUrl = saved?.href ? new URL(saved.href, global.location.href) : null;
      url = savedUrl && savedUrl.origin === global.location.origin && savedUrl.pathname === source.pathname ? savedUrl : source;
      source.searchParams.forEach((value, key) => url.searchParams.set(key, value));
    } catch (_) {
      url = new URL(module.source, global.location.href);
    }
    applyContext(url, context);
    if (saved?.hash) url.hash = saved.hash;
    else if (!url.hash) url.hash = module.rootHash || "";
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function renderModule(module) {
    const source = frameSource(module);
    const content = `<div class="module-view" data-screen-label="${esc(module.ownerId)} ${esc(module.name)}工作区"><section class="module-workspace-layout${module.id === 'dashboard' ? ' cockpit-layout' : ''}">${secondaryNavMarkup(module)}<section class="frame-stage"><iframe id="module-frame" class="module-frame" data-module-id="${module.id}" data-scenario-id="${esc(activeContext()?.scenarioId)}" title="${esc(module.name)}" src="${esc(source)}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe></section></section></div>`;
    renderShell(content, { type: module.id === "dashboard" ? "dashboard" : "module", moduleId: module.id, active: module.id, key: module.id === "dashboard" ? "dashboard" : `module-${module.id}` });
    renderedModuleId = module.id;
    const frame = document.getElementById("module-frame");
    frame?.addEventListener("load", () => {
      global.__OFW_FRAME_LOAD_COUNT__ += 1;
      document.documentElement.dataset.frameLoadCount = String(global.__OFW_FRAME_LOAD_COUNT__);
      adaptFrame(frame, module);
    });
  }

  function renderShell(content, route) {
    const previousFrame = document.getElementById("module-frame");
    try { previousFrame?.contentWindow?.__OFW_NATIVE_MODULE_INTEGRATION__?.destroy?.(); } catch (_) {}
    setTitle(route);
    const state = STORE.get();
    app.innerHTML = `<div class="platform-shell ${state.navCollapsed ? "nav-collapsed" : ""}" data-scenario-id="${esc(state.activeScenarioId)}">${navMarkup(route)}<section class="shell-main">${topbarMarkup(route)}<main class="route-stage">${content}</main></section></div>`;
    refreshIcons(app);
    global.OFW_READABILITY?.refresh(document);
  }

  function render() {
    const route = parseRoute();
    if (route.type === "module") renderModule(DATA.moduleById[route.moduleId]);
    else if (route.type === "dashboard") renderModule(DATA.dashboard);
    else { renderedModuleId = null; renderHome(); }
    renderDrawer();
    renderModal();
  }

  function scheduleNavigationRender() {
    if (navigationRenderScheduled) return;
    navigationRenderScheduled = true;
    global.requestAnimationFrame(() => {
      navigationRenderScheduled = false;
      closeDrawer();
      closeModal();
      render();
    });
  }


  function syncSecondaryNavigation(frame, module) {
    if (frame !== document.getElementById("module-frame") || renderedModuleId !== module.id) return;
    const active = taskFromFrame(frame, module);
    if (!active) return;
    app.querySelectorAll(`.module-subnav-item[data-module-id="${module.id}"]`).forEach((button) => button.classList.toggle("active", button.dataset.moduleTask === active.id));
    if(module.id==='dashboard'){
      const selected=app.querySelector('.cockpit-layout .module-subnav-item.active'),nav=selected?.parentElement;
      if(selected&&nav){const item=selected.getBoundingClientRect(),bounds=nav.getBoundingClientRect();if(item.left<bounds.left)nav.scrollLeft+=item.left-bounds.left;else if(item.right>bounds.right)nav.scrollLeft+=item.right-bounds.right;}
    }
    const select = app.querySelector(`[data-module-task-select="${module.id}"]`);
    if (select) select.value = active.id;
  }

  function activateModuleTask(moduleId, taskId) {
    const module = moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[moduleId];
    const task = moduleTasks(moduleId).find((item) => item.id === taskId);
    const frame = document.getElementById("module-frame");
    if (!module || !task || !frame || renderedModuleId !== module.id) return;
    if(JOINT?.activate(frame,module,task))return;
    if (task.scenarioId && STORE.get().activeScenarioId !== task.scenarioId) {
      captureFramePosition();
      STORE.setActiveScenario(task.scenarioId, "dashboard-workspace");
      STORE.saveFramePosition(module.id, { hash: task.hash, windowY: 0, containerY: 0 }, task.scenarioId);
      frame.dataset.scenarioId = task.scenarioId;
      frame.src = frameSource(module);
      return;
    }
    try {
      if (task.hash) frame.contentWindow.location.hash = task.hash;
      global.setTimeout(() => syncSecondaryNavigation(frame, module), 80);
    } catch (_) {
      showToast("任务入口未打开", "当前工作区尚未就绪，请重新读取后再试。", "warning");
    }
  }

  function scrubInternalCopy(doc) {
    if (!doc?.body || !doc.body.isConnected) return;
    if (doc.querySelector(".portfolio-decision-table")) {
      const style = doc.createElement("style");
      style.dataset.ofwResponsiveDecision = "true";
      style.textContent = "@media (max-width: 620px){.portfolio-decision-table{overflow:visible!important}.portfolio-decision-table .record-table{min-width:0!important;width:100%!important;table-layout:fixed}.portfolio-decision-table .record-table th:nth-child(n+3):not(:last-child),.portfolio-decision-table .record-table td:nth-child(n+3):not(:last-child){display:none}.portfolio-decision-table .record-table th:last-child,.portfolio-decision-table .record-table td:last-child{width:92px!important;position:sticky;right:0;background:#fff}.portfolio-decision-table .record-table td,.portfolio-decision-table .record-table th{white-space:normal!important;overflow-wrap:anywhere}.portfolio-decision-table .record-table-wrap{width:100%!important;max-height:420px!important;overflow-y:auto!important}}";
      if (!doc.head.querySelector("[data-ofw-responsive-decision]")) doc.head.appendChild(style);
    }
    const conceal = (item) => {
      item.hidden = true;
      item.setAttribute("aria-hidden", "true");
      item.style.setProperty("display", "none", "important");
    };
    doc.querySelectorAll("[data-portfolio-filter]").forEach(conceal);
    doc.querySelectorAll("button,a").forEach((item) => {
      if (item.textContent.trim() === "新建评测数据版本") conceal(item);
    });
    const draftDefinition = doc.querySelector('.version-popover [data-action="select-definition"][data-value="draft"]');
    if (draftDefinition?.querySelector("strong") && /新建|编辑草稿/.test(draftDefinition.querySelector("strong").textContent)) {
      draftDefinition.querySelector("strong").textContent = "新建草稿（可编辑副本）";
      const note = draftDefinition.querySelector("span");
      if (note) note.textContent = "从当前已发布定义复制，原版本保持只读";
    }
    doc.querySelectorAll("label").forEach((label) => {
      const directLabel = label.querySelector(":scope > span")?.textContent.trim();
      if (label.querySelector("select") && ["业务范围", "业务场景"].includes(directLabel)) conceal(label);
    });
    doc.querySelectorAll(".published-ontology-card span,.published-ontology-card small,.published-ontology-card em").forEach((item) => {
      if (/^S00[1-5]$/.test(item.textContent.trim()) && !item.closest("details,code,pre")) conceal(item);
    });
    const replacements = [
      ["\u4ea4\u4e92\u539f\u578b", "\u4e1a\u52a1\u5de5\u4f5c\u53f0"], ["\u539f\u578b", "\u5de5\u4f5c\u53f0"],
      ["\u6f14\u793a\u73af\u5883", "\u4e1a\u52a1\u5de5\u4f5c\u533a"], ["\u6f14\u793a\u6570\u636e", "\u793a\u4f8b\u6570\u636e"],
      ["\u7814\u7a76\u5939\u5177", "\u53c2\u8003\u6570\u636e"], ["\u5408\u6210\u9884\u89c8", "\u5408\u6210\u6570\u636e\u9884\u89c8"],
      ["\u7814\u7a76\u670d\u52a1", "\u6a21\u578b\u670d\u52a1"], ["\u7814\u7a76\u89d2\u8272\u6a21\u62df", "\u89d2\u8272\u89c6\u56fe"],
      ["\u7edf\u4e00\u539f\u578b\u5165\u53e3", "\u7edf\u4e00\u5de5\u4f5c\u53f0"], ["\u65b9\u6848\u8bf4\u660e", "\u4e1a\u52a1\u8bf4\u660e"],
      ["\u8bc4\u5ba1\u73af\u5883", "\u4e1a\u52a1\u5de5\u4f5c\u533a"],
      ["\u6a21\u578b\u4e0e\u6a21\u62df", "\u6a21\u578b\u4f18\u5316\u4e2d\u5fc3"],
      ["\u4ea4\u7ed9 M08", "\u4ea4\u7ed9\u6a21\u578b\u4f18\u5316\u4e2d\u5fc3"],
      ["\u6253\u5f00 M08", "\u6253\u5f00\u6a21\u578b\u4f18\u5316\u4e2d\u5fc3"],
      ["3 \u4e2a\u4e1a\u52a1\u57df\u53ef\u6b63\u5f0f\u95ee\u6570", "5 \u4e2a\u4e1a\u52a1\u573a\u666f\u53ef\u67e5\u8be2"],
      ["\u878d\u8d44\u3001\u9884\u7b97\u548c\u503a\u52a1\u98ce\u9669\u5747\u5df2\u7ed1\u5b9a\u53ef\u7528\u7684\u95ee\u6570\u914d\u7f6e\u4e0e\u5df2\u53d1\u5e03\u8d44\u6e90", "\u4e94\u4e2a\u4e1a\u52a1\u573a\u666f\u7684\u67e5\u8be2\u80fd\u529b\u5df2\u5c31\u7eea"],
      ["\u53ea\u8bfb\u63a2\u7d22", "\u591a\u89c6\u56fe\u63a2\u7d22"],
      ["\u573a\u666f\u5bb9\u5668", "\u4e1a\u52a1\u5bf9\u8c61"]
    ];
    const replace = (value) => {
      let next = String(value || "");
      replacements.forEach(([from, to]) => { next = next.replaceAll(from, to); });
      return next;
    };
    const walker = doc.createTreeWalker(doc.body, doc.defaultView?.NodeFilter?.SHOW_TEXT || 4);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"].includes(node.parentElement?.tagName)) return;
      const next = replace(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
    doc.querySelectorAll("[title],[aria-label],[placeholder]").forEach((element) => {
      ["title", "aria-label", "placeholder"].forEach((name) => {
        if (!element.hasAttribute(name)) return;
        const current = element.getAttribute(name);
        const next = replace(current);
        if (next !== current) element.setAttribute(name, next);
      });
    });
  }

  function syncFrameBreadcrumb(frame, module) {
    const node = document.getElementById("frame-breadcrumb-current");
    if (!node || frame !== document.getElementById("module-frame") || renderedModuleId !== module.id) return;
    try {
      const activeTask = taskFromFrame(frame, module);
      const doc = frame.contentDocument;
      const heading = [...doc.querySelectorAll(".ui-page-header h1,.page-header h1,.page-head h1,.reader-title h1,.reader-title strong,.page-heading h1,.center-head h1,.canvas-header h2,main h1")]
        .filter((item) => item.getClientRects().length)
        .map((item) => item.textContent.trim())
        .find((text) => text && text !== module.name && text.length <= 80);
      const isTaskRoot = moduleTasks(module.id).some((task) => task.hash === frame.contentWindow.location.hash);
      node.textContent = isTaskRoot ? activeTask?.label || module.name : heading || activeTask?.label || module.name;
      node.title = node.textContent;
    } catch (_) { node.textContent = module.name; }
  }

  function syncM07ScenarioHeader(frame, module) {
    if (module.id !== "m07" || frame !== document.getElementById("module-frame") || renderedModuleId !== module.id) return;
    try {
      const doc = frame.contentDocument;
      const kicker = doc.getElementById("scenario-kicker");
      const name = doc.getElementById("scenario-name");
      if (kicker) kicker.textContent = "业务对象探索";
      if (name) name.textContent = "对象、关系与时序探索";
      doc.querySelectorAll(".selection-meta .identity-token").forEach((item) => {
        if (["场景轮次", "ObjectRef"].includes(item.querySelector("span")?.textContent.trim())) {
          item.hidden = true;
          item.setAttribute("aria-hidden", "true");
          item.style.setProperty("display", "none", "important");
        }
      });
    } catch (_) {}
  }

  function deliverM08Context(frame) {
    const context = activeContext();
    const handoff = STORE.handoff(context?.scenarioRunId);
    if (!frame?.contentWindow || !context) return;
    frame.contentWindow.postMessage({
      type: "OFW_M08_DELIVER_CONTEXT",
      targetModuleId: "modeling",
      payload: {
        scenarioContext: context,
        workspaceContext: STORE.workspaceContext?.() || null,
        projection: activeResourceProjection("modeling"),
        explorationHandoff: handoff?.m07?.context || null,
        modelingWorkspace: STORE.modelingWorkspace(context.scenarioId),
        modelingReturnContext: STORE.modelingReturnContext(context.scenarioId)
      }
    }, global.location.origin);
  }

  function deliverWorkspaceContext(frame, module, suppliedContext = null) {
    if (!frame?.contentWindow || !module) return;
    const context = workspaceContextForFrame(suppliedContext || STORE.workspaceContext?.() || {}, module.id);
    frame.contentWindow.postMessage({
      type: "OFW_WORKSPACE_CONTEXT",
      targetModuleId: module.id,
      context,
      workspaceContext: context,
      payload: context
    }, global.location.origin);
  }

  function buildS003M07ReturnPayload(context, handoff, projection) {
    const exploration = handoff?.m07?.context;
    const sourceEnvelope = projection?.resultEnvelope;
    if (context?.scenarioId !== "S003" || !exploration?.objectRef || sourceEnvelope?.resultKind !== "PREDICTION") return null;
    const workspace = projection?.workspace || {};
    const objectiveRevisionId = sourceEnvelope.objectiveRevisionId || "MOR-S003-DEBT-RISK-EARLY-WARNING-0001";
    const bindingRevisionId = sourceEnvelope.bindingRevisionId || workspace.binding?.bindingRevisionId || "MB-S003-DEBT-RISK-v1-R1";
    const releaseId = sourceEnvelope.releaseId || workspace.releaseCandidate?.releaseCandidateId || "MREL-S003-DEBT-RISK-BASELINE-REFERENCE";
    const inputManifest = {
      ...context,
      scenarioContext: clonePlain(context),
      sourceKind: "S003_FIXED_DATA_PREDICTION",
      usageIntent: sourceEnvelope.usageIntent || exploration.usageIntent || "SCORING",
      objectRef: clonePlain(exploration.objectRef),
      lensRef: clonePlain(exploration.lensRef),
      seriesRef: clonePlain(exploration.seriesRef),
      timeRange: clonePlain(exploration.timeRange),
      dataVersionId: exploration.dataVersionId,
      ontologyVersionId: exploration.ontologyVersionId,
      bindingId: exploration.bindingId,
      objectiveId: S003_OBJECTIVE_ID,
      objectiveRevisionId,
      bindingRevisionId,
      releaseId,
      modelVersionId: sourceEnvelope.modelVersionId
    };
    const subjects = Array.isArray(sourceEnvelope.subjects) ? sourceEnvelope.subjects : [];
    const subjectRefs = subjects.map((subject) => ({ id: subject.objectId || subject.enterpriseId, title: subject.objectName || subject.enterpriseName, objectTypeRef: "Enterprise" })).filter((subject) => subject.id);
    if (!subjectRefs.some((subject) => subject.id === exploration.objectRef.id)) subjectRefs.unshift(clonePlain(exploration.objectRef));
    const focused = subjects.find((subject) => global.OFW_WORKFLOW.subjectId(subject) === global.OFW_WORKFLOW.canonicalId(exploration.objectRef.id));
    const resultItems = focused ? [
      { outputId: "riskScore", label: "预测风险评分", shape: "SCALAR", resultKind: "PREDICTION", value: focused.riskScore, unit: "score_0_100" },
      { outputId: "predictedRiskTier", label: "预测风险分档", shape: "SCALAR", resultKind: "PREDICTION", value: focused.predictedRiskTierName || focused.predictedRiskTier, unit: "risk_tier" },
      { outputId: "coverage", label: "结果覆盖率", shape: "SCALAR", resultKind: "PREDICTION", value: focused.coverage, unit: "ratio" },
      { outputId: "topContributors", label: "主要贡献项", shape: "OBJECT_SET", resultKind: "PREDICTION", value: clonePlain(focused.topContributors || []), unit: "risk_contribution" }
    ] : [
      { outputId: "enterpriseCount", label: "企业范围", shape: "SCALAR", resultKind: "PREDICTION", value: subjects.length, unit: "enterprise" },
      { outputId: "riskDistribution", label: "预测风险分布", shape: "OBJECT", resultKind: "PREDICTION", value: clonePlain(sourceEnvelope.summaries?.riskDistribution || null), unit: "enterprise_distribution" }
    ];
    const resultEnvelope = {
      ...clonePlain(sourceEnvelope),
      objectiveRevisionId,
      bindingRevisionId,
      releaseId,
      subjectRefs,
      resultItems,
      inputSnapshot: {
        ...(clonePlain(sourceEnvelope.inputSnapshot) || {}),
        ...context,
        scenarioContext: clonePlain(context),
        dataVersionId: exploration.dataVersionId,
        ontologyVersionId: exploration.ontologyVersionId,
        timeRange: clonePlain(exploration.timeRange)
      },
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false,
      sideEffectsEmitted: 0
    };
    return {
      ...context,
      inputManifest,
      resultEnvelope,
      modelingRunId: resultEnvelope.runId,
      modelingResultId: resultEnvelope.resultId,
      sideEffectsEmitted: 0,
      completedAt: resultEnvelope.formedAt || new Date().toISOString()
    };
  }

  function deliverM08Return(frame) {
    const context = activeContext();
    let handoff = STORE.handoff(context?.scenarioRunId);
    if (!frame?.contentWindow || !handoff) return;
    let payload = handoff.m08Return;
    if (!payload && context?.scenarioId === "S003") {
      payload = buildS003M07ReturnPayload(context, handoff, STORE.modelingProjection("S003", "M07_EXPLORATION"));
      if (payload) {
        STORE.validateM08Return(payload, "S003");
        STORE.saveM08Return(payload);
        handoff = STORE.handoff(context.scenarioRunId);
      }
    }
    if (!payload) return;
    const delivered = clonePlain(handoff?.m08Return || payload);
    Object.assign(delivered, M07_PORTFOLIO_CONTEXT);
    frame.contentWindow.postMessage({ type: "OFW_M08_RETURN_TO_M07", targetModuleId: "m07", payload: delivered }, global.location.origin);
  }

  function buildS005NativeModuleResult(moduleId, operation, projection, context) {
    const producedAt = new Date().toISOString();
    const evaluationResultId = projection?.evaluationResult?.evaluationResultId || null;
    const base = {
      clientResultId: `S005-MODULE-RESULT-${moduleId}-${operation}-${context.scenarioRunId}`,
      outputKind: `${moduleId}_${operation}`,
      status: moduleId === "M04" ? "not_applicable" : "complete",
      producedAt,
      evaluationRunId: projection?.evaluationRun?.evaluationRunId || null,
      evaluationResultId,
      consumerResultRef: evaluationResultId,
      evidenceRefs: [`module://${context.scenarioRunId}/${moduleId}/${operation}`],
      missingReasons: [],
      publishedOntology: false,
      publishedMetric: false,
      publishedRule: false,
      publishedT019: false
    };
    if (operation === "source_delivery") return {
      ...base,
      evaluationDate: "2026-07-17",
      eventReadAt: producedAt,
      sourceAudit: { snapshotCount: 79, sheetInstanceCount: 393, candidateCount: 15, asOf: "2026-07-17", windBatchId: null, windBatchMissingReason: "Wind 批次尚未交付。", dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS", qualityStatus: "partial" },
      missingReasons: ["Wind 批次尚未交付。", "实际 NAV、现金流和费用明细尚未交付。"]
    };
    if (operation === "semantic_candidate") return {
      ...base,
      classificationStatus: "candidate",
      windFundType: null,
      windFundTypeMissingReason: "Wind fund_type 尚未交付。",
      ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
      metricUpdates: {
        continuingEligibilityCompliance: {
          continuingEligibility: { status: "partial", value: { eligible: 3, reviewRequired: 1, unknown: 1, displayedProducts: 5, candidateCount: 15 }, missingReason: "仅 5 只代表性产品具备范围状态，10 只候选尚未逐项列示。", evidenceRefs: [`module://${context.scenarioRunId}/M02/source_delivery`, `module://${context.scenarioRunId}/M01/semantic_candidate`] },
          classificationConfidence: { value: null, status: "not_evaluable", missingReason: "Wind fund_type 与候选分类尚未完成复核。" }
        },
        selectionExecution: { selectionAttribution: { status: "partial", value: 0.42, unit: "pct", missingReason: "该值仅为 T+60 归一化选择差异，不等同于完整选择归因。", evidenceRefs: [`module://${context.scenarioRunId}/M02/source_delivery`, `module://${context.scenarioRunId}/M01/semantic_candidate`] } }
      },
      missingReasons: ["Wind fund_type 尚未交付。", "分类和评价口径仍为候选。"]
    };
    if (operation === "compliance_evaluation") return { ...base, accessMode: "read_only", complianceResultRef: `evaluation://${context.scenarioRunId}/M03/compliance-read-only`, conclusionStatus: "partial", missingReasons: ["完整合规事件与处置证据尚未交付。"] };
    if (operation === "market_peer_evaluation") return { ...base, accessMode: "read_only", marketPeerResultRef: `evaluation://${context.scenarioRunId}/M03/market-peer-read-only`, conclusionStatus: "not_evaluable", missingReasons: ["现有序列为月度归一化组合比较，不是产品实际 NAV，不能计算产品 TWR 或日频风险指标。"] };
    if (operation === "selection_read_only") return { ...base, accessMode: "read_only", applicability: "not_applicable", actions: [], reminders: [], approvals: [], todos: [], trades: [], missingReasons: ["实际成交、下一可得 NAV、确认 NAV、滑点和结算流水均未交付。"] };
    if (operation === "risk_explanation") return { ...base, accessMode: "read_only", explanationRef: `evaluation://${context.scenarioRunId}/M05/trading-risk-explanation`, missingReasons: ["久期、评级迁移、穿透集中度、流动性和债券收益归因证据尚未交付。"] };
    if (operation === "report_draft") return { ...base, reportRef: `report://${context.scenarioRunId}/S005-evaluation-draft`, reportStatus: "draft", reviewStatus: "pending", reviewEvidenceRefs: [`module://${context.scenarioRunId}/M06/review-pending`], historyComparisonStatus: projection?.historyComparison?.status || "not_applicable", previousScenarioRunId: projection?.historyComparison?.previousScenarioRunId || null, previousEvaluationResultId: projection?.historyComparison?.previousEvaluationResultId || null, historyComparisonMissingReason: projection?.historyComparison?.missingReason || null, missingReasons: ["评价仍为部分状态，报告不得正式发布。"] };
    return base;
  }

  function runS005NativeOperation(module, operation) {
    const context = activeContext();
    const ownerId = S005_WORKBENCH_MODULES.get(module?.id);
    if (context?.scenarioId !== "S005" || !ownerId) throw new Error("当前模块没有 S005 原生操作。");
    const projection = STORE.s005ModuleProjection(ownerId);
    const action = projection?.actions?.find((item) => item.operation === operation);
    if (!action?.enabled && action?.status !== "complete") throw new Error(action?.reason || "前置模块结果尚未形成。");
    if (action.status !== "complete") STORE.recordS005ModuleEvent({
      moduleId: ownerId,
      operation,
      scenarioContext: context,
      occurredAt: new Date().toISOString(),
      payload: buildS005NativeModuleResult(ownerId, operation, projection, context)
    });
    return STORE.s005ModuleProjection(ownerId);
  }

  function mountNativeIntegration(frame, module) {
    if (!frame || !module || ["modeling", "m07"].includes(module.id)) return null;
    const s005OwnerId = S005_WORKBENCH_MODULES.get(module.id);
    return global.OFW_NATIVE_MODULE_INTEGRATIONS?.mount?.({
      frame,
      module,
      scenarioContext: activeContext(),
      workspaceContext: STORE.workspaceContext?.() || null,
      apiBase: API_BASE,
      navigate,
      onViewReady() { global.OFW_READABILITY?.refresh(frame.contentDocument); syncFrameBreadcrumb(frame, module); syncSecondaryNavigation(frame, module); },
      updateWorkspaceContext(patch, reason = module.id) { return updateWorkspaceContext(patch, reason); },
      focusScenario(scenarioId) {
        if (!DATA.scenarioById[scenarioId]) return;
        STORE.setActiveScenario(scenarioId, "dashboard-directory");
        history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId }, "", "#dashboard");
        render();
        void refreshModelContext({ scenarioId });
      },
      scenarioProjection: activeContext()?.scenarioId === "S005" && s005OwnerId ? STORE.s005ModuleProjection(s005OwnerId) : null,
      runScenarioOperation(operation) { return runS005NativeOperation(module, operation); },
      onState(nextState) {
        const scenarioId = activeContext()?.scenarioId;
        if (scenarioId && nextState) modelContexts.set(scenarioId, { ...(modelContexts.get(scenarioId) || {}), state: nextState });
      }
    }) || null;
  }

  function deliverS003DashboardContext(frame) {
    const context = activeContext();
    if (context?.scenarioId !== "S003" || !frame?.contentWindow) return;
    const projection = STORE.modelingProjection("S003", "Dashboard");
    frame.contentWindow.postMessage({
      type: "OFW_S003_MODELING_CONTEXT",
      scenarioContext: context,
      objectiveId: S003_OBJECTIVE_ID,
      workspace: projection?.workspace || null,
      candidateResult: projection?.resultEnvelope || null,
      resultEnvelope: projection?.resultEnvelope || null
    }, global.location.origin);
  }

  function deliverS005DashboardContext(frame) {
    const context = activeContext();
    if (context?.scenarioId !== "S005" || !frame?.contentWindow) return;
    const projection = STORE.s005EvaluationProjection();
    frame.contentWindow.postMessage({
      type: "OFW_S005_EVALUATION_CONTEXT",
      scenarioContext: context,
      evaluationRun: projection?.evaluationRun || null,
      evaluationResult: projection?.evaluationResult || null,
      stages: projection?.stages || {},
      progress: projection?.progress || STORE.s005Progress(),
      historyCount: STORE.scenario("S005")?.runHistory?.length || 0
    }, global.location.origin);
  }

  function adaptFrame(frame, module) {
    if (frame !== document.getElementById("module-frame") || renderedModuleId !== module.id) return;
    if(JOINT?.adapt(frame,module))return;
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      doc.title = `${module.name} · ${DATA.brand.zh}`;
      doc.documentElement.dataset.ofwEmbeddedModule = module.id;
      if (!doc.getElementById("ofw-v14-frame-presentation")) {
        const presentation = doc.createElement("link");
        presentation.id = "ofw-v14-frame-presentation";
        presentation.rel = "stylesheet";
        presentation.href = new URL("../shared/frame-presentation.css", global.location.href).href;
        doc.head.appendChild(presentation);
      }
      global.OFW_READABILITY?.install(doc, module.id);
      if (!doc.getElementById("ofw-v132-experience")) {
        const finish = doc.createElement("link");
        finish.id = "ofw-v132-experience";
        finish.rel = "stylesheet";
        finish.href = new URL("../shared/experience.css?v=20260906-01", global.location.href).href;
        doc.head.appendChild(finish);
      }
      scrubInternalCopy(doc);
      syncM07ScenarioHeader(frame, module);
      syncFrameBreadcrumb(frame, module);
      syncSecondaryNavigation(frame, module);
      global.setTimeout(() => { scrubInternalCopy(doc); syncM07ScenarioHeader(frame, module); syncFrameBreadcrumb(frame, module); }, 80);
      global.setTimeout(() => { scrubInternalCopy(doc); syncM07ScenarioHeader(frame, module); syncFrameBreadcrumb(frame, module); }, 320);
      global.setTimeout(() => { scrubInternalCopy(doc); syncM07ScenarioHeader(frame, module); syncFrameBreadcrumb(frame, module); }, 900);
      global.setTimeout(() => syncSecondaryNavigation(frame, module), 120);
      const saved = STORE.activeScenario()?.navigation?.framePositions?.[module.id];
      if (saved) requestAnimationFrame(() => {
        try {
          frame.contentWindow.scrollTo(0, saved.windowY || 0);
          const scroller = doc.querySelector(".main,.screen-stage,.page-shell,.workspace-main,.primary-pane,[data-scroll-container]");
          if (scroller) scroller.scrollTop = saved.containerY || 0;
        } catch (_) {}
      });
      doc.addEventListener("click", () => {
        global.setTimeout(() => {
          if (frame !== document.getElementById("module-frame") || renderedModuleId !== module.id) return;
          scrubInternalCopy(doc);
          global.OFW_READABILITY?.refresh(doc);
        }, 0);
        clearTimeout(frameSaveTimer);
        frameSaveTimer = setTimeout(() => { captureFramePosition(); syncFrameBreadcrumb(frame, module); syncSecondaryNavigation(frame, module); scrubInternalCopy(doc); syncM07ScenarioHeader(frame, module); global.OFW_READABILITY?.refresh(doc); }, 180);
      }, true);
      doc.addEventListener("scroll", () => {
        clearTimeout(frameSaveTimer);
        frameSaveTimer = setTimeout(captureFramePosition, 160);
      }, true);
      frame.contentWindow.addEventListener("hashchange", () => setTimeout(() => { syncFrameBreadcrumb(frame, module); syncSecondaryNavigation(frame, module); }, 60));
      if (module.id === "modeling") deliverM08Context(frame);
      if (module.id === "m07") deliverM08Return(frame);
      mountNativeIntegration(frame, module);
      if (module.id === "dashboard") deliverS005DashboardContext(frame);
      if (module.id === "dashboard") deliverS003DashboardContext(frame);
      if (module.id !== "m07") deliverWorkspaceContext(frame, module);
    } catch (_) {
      showToast("模块已打开", "当前内容仍可通过统一导航返回。", "warning");
    }
  }

  function captureFramePosition() {
    if (!renderedModuleId) return;
    const frame = document.getElementById("module-frame");
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const scroller = doc?.querySelector(".main,.screen-stage,.page-shell,.workspace-main,.primary-pane,[data-scroll-container]");
      STORE.saveFramePosition(renderedModuleId, {
        href: frame.contentWindow.location.href,
        hash: JOINT?.taskForFrame(frame,renderedModuleId)?.hash || frame.contentWindow.location.hash,
        windowY: frame.contentWindow.scrollY || 0,
        containerY: scroller?.scrollTop || 0,
        savedAt: Date.now()
      });
    } catch (_) {}
  }

  function captureHomePosition() {
    const home = app.querySelector(".home-view");
    if (home) STORE.saveNavigation({ homeScrollTop: Math.max(0, Math.round(home.scrollTop || 0)) });
  }

  function activeResourceProjection(moduleId) {
    const selectedId = STORE.selectedResource(moduleId);
    const resource = selectedId ? catalog().resource(selectedId) : catalog().resourcesFor(moduleId).find((item) => item.scenarioId === STORE.get().activeScenarioId) || null;
    return resource ? { resourceId: resource.id, scenarioId: resource.scenarioId, type: resource.type, refs: resource.refs || [], objectRef: resource.objectRef || null, dataVersionId: resource.dataVersionId || null, ontologyVersionId: resource.ontologyVersionId || null } : null;
  }

  function normalizeM07Handoff(message) {
    const raw = message.context || message.payload || {};
    let objectRef = raw.objectRef || null;
    const objectMetadata = clonePlain(objectRef || {});
    const targetScenarioId = objectRef?.scenarioId || objectRef?.sourceScenarioId || message.objectScenarioId || STORE.get().activeScenarioId;
    const context = STORE.scenarioContext(targetScenarioId);
    if (!context) throw new Error("所选对象没有可定位的业务运行身份。");
    if (context.scenarioId === "S005" && objectRef) {
      const matching = catalog().resources.find((resource) => resource.scenarioId === "S005" && resource.objectRef && (resource.objectRef.id === objectRef.id || resource.objectRef.title === objectRef.title));
      if (matching?.objectRef) objectRef = { ...clonePlain(matching.objectRef), scenarioId: targetScenarioId, dataVersionId: objectMetadata.dataVersionId, ontologyVersionId: objectMetadata.ontologyVersionId, bindingId: objectMetadata.bindingId };
    }
    if (!objectRef?.id || !objectRef?.objectTypeRef) throw new Error("M07 未提供可交接的 ObjectRef。");
    const start = raw.timeRange?.start || raw.timeRange?.from || null;
    const end = raw.timeRange?.end || raw.timeRange?.to || null;
    const months = start && end ? Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 2629800000)) : null;
    return {
      ...clonePlain(raw),
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      formedAt: context.formedAt,
      status: context.status,
      handoffId: `M07-M08-${context.scenarioRunId}-${Date.now().toString(36).toUpperCase()}`,
      objectRef,
      seriesRef: raw.seriesRef || null,
      dataVersionId: objectMetadata.dataVersionId || objectRef.dataVersionId || raw.dataVersionId || null,
      ontologyVersionId: objectMetadata.ontologyVersionId || objectRef.ontologyVersionId || raw.ontologyVersionId || null,
      bindingId: objectMetadata.bindingId || objectRef.bindingId || raw.bindingId || null,
      timeRange: { ...clonePlain(raw.timeRange || {}), start, end, months, label: raw.timeRange?.label || (start && end ? `${start} 至 ${end}` : "未提供") }
    };
  }

  function clonePlain(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function recordS005M07Exploration(message) {
    if (message?.schemaVersion !== "ofw.s005.m07-exploration-result.v1" || message?.moduleId !== "M07") throw new Error("M07 探索结果包络无效。");
    const result = message.result;
    if (!result?.clientResultId || !result?.explorationResultRef || !result?.producedAt || !result?.evidenceRefs?.length) throw new Error("M07 探索结果缺少标识、结果引用、时间或证据。");
    if (!result.objectRef?.id || !result.objectRef?.objectTypeRef || !result.lensRef?.lensId || !result.timeRange?.start || !result.timeRange?.end) throw new Error("M07 探索结果缺少对象、Lens 或时间范围。");
    if (!result.dataVersionId || !result.ontologyVersionId || !result.bindingId) throw new Error("M07 探索结果缺少数据、语义或 Binding 版本。");
    const objectScenarioId = result.objectRef.scenarioId || result.objectRef.sourceScenarioId;
    if (objectScenarioId !== "S005") throw new Error("M07 探索结果不属于投后评价业务。");
    const scenarioContext = STORE.scenarioContext("S005");
    if (!scenarioContext) throw new Error("当前投后评价运行身份不可用。");
    return STORE.recordS005ModuleEvent({
      moduleId: "M07",
      operation: "exploration_result",
      scenarioContext,
      occurredAt: result.producedAt,
      payload: {
        consumerResultRef: STORE.s005EvaluationProjection()?.evaluationResult?.evaluationResultId || null,
        explorationResultRef: result.explorationResultRef,
        objectRef: result.objectRef,
        lensRef: result.lensRef,
        seriesRef: result.seriesRef,
        timeRange: result.timeRange,
        dataVersionId: result.dataVersionId,
        ontologyVersionId: result.ontologyVersionId,
        bindingId: result.bindingId,
        evidenceRefs: result.evidenceRefs,
        missingReasons: result.missingReasons || []
      }
    });
  }

  function sameM07ExplorationResult(output, envelope) {
    const saved = output?.payload;
    const incoming = envelope?.result;
    if (!saved || !incoming || saved.explorationResultRef !== incoming.explorationResultRef) return false;
    const same = (left, right, fields) => fields.every((field) => (left?.[field] ?? null) === (right?.[field] ?? null));
    return same(saved.objectRef, incoming.objectRef, ["id", "objectTypeRef"])
      && same(saved.lensRef, incoming.lensRef, ["moduleId", "lensId", "route"])
      && same(saved.seriesRef, incoming.seriesRef, ["id", "ownerObjectId"])
      && same(saved.timeRange, incoming.timeRange, ["start", "end"])
      && same(saved, incoming, ["dataVersionId", "ontologyVersionId", "bindingId"]);
  }

  function handleM07Open(message) {
    const context = normalizeM07Handoff(message);
    updateWorkspaceContext({
      objectSetRef: context.objectSetRef || STORE.workspaceContext?.()?.objectSetRef || null,
      activeObjectRef: context.objectRef,
      timeRange: context.timeRange,
      dataVersionRef: context.dataVersionId ? { id: context.dataVersionId } : null,
      ontologyVersionRef: context.ontologyVersionId ? { id: context.ontologyVersionId } : null,
      evidenceRefs: [context.dataVersionId, context.ontologyVersionId, context.bindingId].filter(Boolean),
      sourceModuleId: "m07"
    }, "m07-handoff");
    if (STORE.get().activeScenarioId !== context.scenarioId) STORE.setActiveScenario(context.scenarioId, "m07-object-handoff");
    if (context.scenarioId === "S005") {
      const scenarioContext = STORE.scenarioContext("S005");
      if (!message.explorationResultEnvelope) {
        message.explorationResultEnvelope = {
          schemaVersion: "ofw.s005.m07-exploration-result.v1",
          moduleId: "M07",
          scenarioContext,
          result: {
            clientResultId: `S005-M07-EXPLORATION-${context.scenarioRunId}-${context.objectRef.id}`,
            outputKind: "M07_EXPLORATION_RESULT",
            status: "complete",
            producedAt: new Date().toISOString(),
            explorationResultRef: `exploration://${context.scenarioRunId}/${context.objectRef.id}/${context.lensRef?.lensId || "catalog"}`,
            objectRef: context.objectRef,
            lensRef: context.lensRef,
            seriesRef: context.seriesRef,
            timeRange: context.timeRange,
            dataVersionId: context.dataVersionId,
            ontologyVersionId: context.ontologyVersionId,
            bindingId: context.bindingId,
            evidenceRefs: [context.objectRef.id, context.dataVersionId, context.ontologyVersionId].filter(Boolean),
            missingReasons: context.seriesRef ? [] : ["当前对象没有可读取的时序系列。"]
          }
        };
      } else {
        message.explorationResultEnvelope = { ...clonePlain(message.explorationResultEnvelope), scenarioContext };
      }
      let output = STORE.s005ModuleProjection("M07")?.moduleOutputs?.at(-1);
      if (!output && message.explorationResultEnvelope) {
        recordS005M07Exploration(message.explorationResultEnvelope);
        output = STORE.s005ModuleProjection("M07")?.moduleOutputs?.at(-1);
        showToast("探索结果已固定", "M07 当前对象、Lens、版本和证据已回传。", "success");
      }
      if (!output || output.scenarioContext?.scenarioRunId !== context.scenarioRunId) throw new Error("M07 尚未形成当前轮次的可验证探索结果。");
      if (message.explorationResultEnvelope && !sameM07ExplorationResult(output, message.explorationResultEnvelope)) throw new Error("M07 交接对象、Lens、系列、时间或版本与已固定探索结果不一致。");
    }
    if (context.scenarioId === "S003") {
      STORE.saveModelingReturnContext(activeContext(), {
        objectiveId: S003_OBJECTIVE_ID,
        returnRoute: "#module/m07",
        returnUrl: message.returnUrl || null,
        view: "objective",
        usageIntent: context.usageIntent || "SCORING"
      });
    }
    STORE.saveM07Handoff({
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      formedAt: context.formedAt,
      status: context.status,
      context,
      returnUrl: message.returnUrl || null,
      sourceModuleId: "m07",
      sourceRoute: "#module/m07"
    });
    STORE.saveFramePosition("modeling", { hash: "#models", windowY: 0, containerY: 0 }, context.scenarioId);
    navigate("#module/modeling");
  }

  function handleM08Return(message) {
    const context = activeContext();
    const payload = clonePlain(message.payload || {});
    if (!context) throw new Error("M08 返回时没有当前场景身份。");
    const validated = STORE.validateM08Return(payload);
    const resultKind = String(payload.resultEnvelope?.resultKind || "").toUpperCase();
    updateWorkspaceContext({
      activeObjectRef: validated.inputManifest?.objectRef || STORE.workspaceContext?.()?.activeObjectRef || null,
      timeRange: validated.inputManifest?.timeRange || STORE.workspaceContext?.()?.timeRange || null,
      dataVersionRef: validated.inputManifest?.dataVersionId ? { id: validated.inputManifest.dataVersionId } : STORE.workspaceContext?.()?.dataVersionRef || null,
      ontologyVersionRef: validated.inputManifest?.ontologyVersionId ? { id: validated.inputManifest.ontologyVersionId } : STORE.workspaceContext?.()?.ontologyVersionRef || null,
      resultView: resultKind === "SIMULATION" ? "simulation" : validated.inputManifest?.usageIntent === "SHADOW" ? "shadow" : "candidate",
      evidenceRefs: [...(STORE.workspaceContext?.()?.evidenceRefs || []), payload.resultEnvelope?.resultId, payload.simulationResultId].filter(Boolean),
      sourceModuleId: "modeling"
    }, "m08-return");
    if (context.scenarioId === "S005") {
      STORE.recordS005ModuleEvent({
        moduleId: "M08",
        operation: "model_result",
        scenarioContext: context,
        occurredAt: payload.completedAt || new Date().toISOString(),
        payload: {
          consumerResultRef: STORE.s005EvaluationProjection()?.evaluationResult?.evaluationResultId || null,
          outputRef: payload.resultEnvelope.resultId || payload.simulationResultId,
          inputMode: validated.inputManifest.sourceKind,
          objectiveId: validated.inputManifest.objectiveId,
          objectiveRevisionId: validated.inputManifest.objectiveRevisionId,
          bindingRevisionId: validated.inputManifest.bindingRevisionId,
          releaseId: validated.inputManifest.releaseId,
          modelVersionId: validated.inputManifest.modelVersionId,
          objectRef: validated.inputManifest.objectRef,
          lensRef: validated.inputManifest.lensRef,
          seriesRef: validated.inputManifest.seriesRef,
          timeRange: validated.inputManifest.timeRange,
          dataVersionId: validated.inputManifest.dataVersionId,
          ontologyVersionId: validated.inputManifest.ontologyVersionId,
          bindingId: validated.inputManifest.bindingId,
          resultKind: payload.resultEnvelope.resultKind,
          resultStatus: payload.simulationStatus === "SUCCEEDED" ? "available" : "unavailable",
          truthClass: "candidate",
          replacesFact: false,
          fixtureId: payload.resultEnvelope.fixtureId,
          inputClassification: payload.resultEnvelope.inputClassification,
          containsSourceBusinessValues: payload.resultEnvelope.containsSourceBusinessValues,
          factWriteAllowed: payload.resultEnvelope.factWriteAllowed,
          actionWriteAllowed: payload.resultEnvelope.actionWriteAllowed,
          sideEffectsEmitted: payload.sideEffectsEmitted,
          evidenceRefs: [payload.simulationRunId, payload.simulationResultId, payload.resultEnvelope.fixtureId].filter(Boolean)
        }
      });
    }
    STORE.saveM08Return(payload);
    navigate("#module/m07");
    showToast("上下文已返回", "已恢复业务对象探索的对象、视图和读取位置。", "success");
  }

  async function runS003DashboardRecalculation(message, frame) {
    const context = activeContext();
    try {
      if (context?.scenarioId !== "S003" || !message.scenarioContext || !["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => message.scenarioContext[field] === context[field])) throw new Error("S003 候选试算身份不一致。");
      const response = await fetch(`${API_BASE}/v1/s003/results/recalculate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenarioContext: context,
          candidateId: message.candidateId || message.modelVersionId || null,
          modelVersionId: message.modelVersionId || null,
          usageIntent: (message.usageIntent || message.useKind) === "SHADOW" ? "SHADOW" : "WHAT_IF",
          asOf: message.asOf || "2025-12-31",
          dataVersion: message.dataVersionId || message.dataVersion || "S003-T007-FORMAL-CANDIDATE-20251231-v1",
          enterpriseScope: message.enterpriseScope || "ALL"
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.resultEnvelope) throw new Error(body.message || body.error || `候选试算服务返回 ${response.status}`);
      const resultEnvelope = {
        ...body.resultEnvelope,
        inputSnapshot: { ...(body.resultEnvelope.inputSnapshot || {}), ...context, scenarioContext: context }
      };
      STORE.saveModelingResult(context, resultEnvelope, body.workspace || null);
      deliverS003DashboardContext(frame);
      frame.contentWindow.postMessage({ type: "OFW_S003_MODELING_RESULT", scenarioContext: context, objectiveId: S003_OBJECTIVE_ID, workspace: body.workspace || null, resultEnvelope }, global.location.origin);
      showToast("候选试算已形成", "正式 C035、报告和处置状态保持不变。", "success");
    } catch (error) {
      frame?.contentWindow?.postMessage({ type: "OFW_S003_MODELING_ERROR", scenarioContext: context, objectiveId: S003_OBJECTIVE_ID, message: error.message }, global.location.origin);
      showToast("候选试算未完成", error.message, "danger");
    }
  }

  function handleFrameMessage(event) {
    if(JOINT?.handle(event,document.getElementById('module-frame')))return;
    if (event.origin !== global.location.origin) return;
    const frame = document.getElementById("module-frame");
    if (!frame || event.source !== frame.contentWindow) return;
    const message = event.data || {};
    try {
      if (message.type === "OFW_WORKSPACE_CONTEXT_UPDATE") {
        updateWorkspaceContext(message.patch || message.payload || message.context || message.workspaceContext || {}, renderedModuleId || "module");
        return;
      }
      if (message.type === "OFW_WORKSPACE_NAVIGATE" && (message.route === "#dashboard" || /^#module\/[a-z0-9-]+$/.test(message.route || ""))) { navigate(message.route); return; }
      if (message.type === "OFW_OPEN_REPORT") {
        const href = new URL(message.href, global.location.href);
        const canonical = new URL(DATA.moduleById.report.source, global.location.href);
        if (href.origin !== canonical.origin || href.pathname !== canonical.pathname) return;
        STORE.saveFramePosition("report", { href: href.href, hash: href.hash, windowY: 0, containerY: 0 });
        navigate("#module/report"); return;
      }
      if (renderedModuleId === "m07" && message.type === "OFW_S005_M07_EXPLORATION_RESULT") {
        recordS005M07Exploration(message);
        showToast("探索结果已固定", "M07 当前对象、Lens、版本和证据已回传。", "success");
        return;
      }
      if (message.type === "OFW_M07_READY" && renderedModuleId === "m07") {
        if (!message.scenarioContext || message.scenarioContext.scenarioId !== "PORTFOLIO" || message.scenarioContext.status !== "active" || !["scenarioVersion", "scenarioRunId", "formedAt"].every((field) => String(message.scenarioContext[field] || "").trim())) throw new Error("M07 资源目录身份不一致。");
        if (restoringLinkedExploration) { restoringLinkedExploration = false; return; }
        deliverWorkspaceContext(frame, DATA.moduleById.m07);
        deliverM08Return(frame);
        return;
      }
      if (message.type === "OFW_S003_CYCLE_UPDATED" && activeContext()?.scenarioId === "S003") {
        if (message.state) modelContexts.set("S003", { ...(modelContexts.get("S003") || {}), state: message.state });
        if (parseRoute().type === "home") renderHome();
        return;
      }
      if (message.type === "OFW_S003_CYCLE_NAVIGATE" && activeContext()?.scenarioId === "S003") {
        if (message.route === "#dashboard" || /^#module\/[a-z0-9-]+$/.test(message.route || "")) navigate(message.route);
        return;
      }
      if (message.type === "OFW_S003_CENTER_NAVIGATE" && renderedModuleId === "modeling" && activeContext()?.scenarioId === "S003") {
        if (message.route === "#dashboard" || /^#module\/[a-z0-9-]+$/.test(message.route || "")) navigate(message.route);
        return;
      }
      if (message.type === "OFW_S003_MODELING_CONTEXT_REQUEST" && renderedModuleId === "dashboard" && activeContext()?.scenarioId === "S003") {
        deliverS003DashboardContext(frame);
        return;
      }
      if (message.type === "OFW_DASHBOARD_SCENARIO_FOCUS" && renderedModuleId === "dashboard" && DATA.scenarioById[message.scenarioId]) {
        if (STORE.get().activeScenarioId === message.scenarioId) {
          if (message.scenarioId === "S003") deliverS003DashboardContext(frame);
          if (message.scenarioId === "S005") deliverS005DashboardContext(frame);
          return;
        }
        const hash = frame.contentWindow?.location?.hash || "#/dashboards";
        STORE.saveFramePosition("dashboard", { hash, windowY: 0, containerY: 0 }, message.scenarioId);
        STORE.setActiveScenario(message.scenarioId, "dashboard-focus");
        history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId: message.scenarioId }, "", "#dashboard");
        frame.dataset.scenarioId = message.scenarioId;
        try { frame.contentWindow?.__OFW_NATIVE_MODULE_INTEGRATION__?.destroy?.(); } catch (_) {}
        mountNativeIntegration(frame, DATA.dashboard);
        if (message.scenarioId === "S003") deliverS003DashboardContext(frame);
        if (message.scenarioId === "S005") deliverS005DashboardContext(frame);
        deliverWorkspaceContext(frame, DATA.dashboard);
        return;
      }
      if (message.type === "OFW_S003_MODELING_RECALCULATE_REQUEST" && renderedModuleId === "dashboard" && activeContext()?.scenarioId === "S003") {
        void runS003DashboardRecalculation(message, frame);
        return;
      }
      if (message.type === "OFW_S003_OPEN_MODELING_OBJECTIVE" && ["dashboard", "query", "agent", "report"].includes(renderedModuleId)) {
        const context = activeContext();
        if (context?.scenarioId !== "S003" || !message.scenarioContext || !["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => message.scenarioContext[field] === context[field])) throw new Error("S003 M08 入口身份不一致。");
        STORE.saveModelingReturnContext(context, {
          objectiveId: message.objectiveId || S003_OBJECTIVE_ID,
          returnRoute: message.returnRoute || (renderedModuleId === "dashboard" ? "#dashboard" : `#module/${renderedModuleId}`),
          returnDashboardRoute: message.returnDashboardRoute || "#/view/risk/operations",
          view: message.view || "objective"
        });
        navigate("#module/modeling");
        return;
      }
      if (renderedModuleId === "modeling" && ["OFW_M08_WORKSPACE_STATE", "OFW_S003_MODELING_WORKSPACE"].includes(message.type)) {
        const context = activeContext();
        if (context?.scenarioId !== "S003" || !message.scenarioContext || !["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => message.scenarioContext[field] === context[field])) throw new Error("S003 workspace 回传场景不一致。");
        if (message.objectiveId && message.objectiveId !== S003_OBJECTIVE_ID) throw new Error("S003 workspace 回传 Objective 不一致。");
        if (message.factWriteAllowed !== false || message.actionWriteAllowed !== false || message.actionSourceAllowed !== false) throw new Error("S003 workspace 未声明事实与行动三重禁写。");
        STORE.saveModelingWorkspace(context, message.workspace || message.payload);
        return;
      }
      if (renderedModuleId === "modeling" && message.type === "OFW_S003_MODELING_RESULT") {
        const context = activeContext();
        if (context?.scenarioId !== "S003" || !message.scenarioContext || !["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => message.scenarioContext[field] === context[field])) throw new Error("S003 Result Envelope 身份不一致。");
        const resultEnvelope = {
          ...message.resultEnvelope,
          inputSnapshot: { ...(message.resultEnvelope?.inputSnapshot || {}), ...context, scenarioContext: context }
        };
        const existingProjection = STORE.modelingProjection("S003", "M07_EXPLORATION");
        if (existingProjection?.resultEnvelope?.resultId !== resultEnvelope.resultId) STORE.saveModelingResult(context, resultEnvelope, message.workspace || null);
        else if (message.workspace) STORE.saveModelingWorkspace(context, message.workspace);
        const returnContext = STORE.modelingReturnContext("S003");
        const returnRoute = returnContext?.returnRoute || "#dashboard";
        if (returnRoute === "#module/m07") {
          const returnPayload = buildS003M07ReturnPayload(context, STORE.handoff(context.scenarioRunId), STORE.modelingProjection("S003", "M07_EXPLORATION"));
          if (!returnPayload) throw new Error("S003 M07 返回缺少已保存的探索上下文或候选结果。");
          STORE.validateM08Return(returnPayload, "S003");
          STORE.saveM08Return(returnPayload);
        }
        if (returnRoute === "#dashboard") STORE.saveFramePosition("dashboard", { hash: returnContext?.returnDashboardRoute || "#/view/risk/operations", windowY: 0, containerY: 0 }, "S003");
        navigate(returnRoute);
        showToast("候选结果已返回", "S003 正式结果保持不变；可切换查看候选试算和差异。", "success");
        return;
      }
      if (message.type === "OFW_S005_EVALUATION_REQUEST" && renderedModuleId === "dashboard") {
        deliverS005DashboardContext(frame);
        return;
      }
      if (renderedModuleId === "m07" && (message.type === "OFW_M07_OPEN_M08" || message.operation === "open-m08")) {
        handleM07Open(message);
        return;
      }
      if (renderedModuleId === "m07" && message.operation === "navigate-parent-module") {
        const normalized = normalizeM07Handoff(message);
        if (STORE.get().activeScenarioId !== normalized.scenarioId) STORE.setActiveScenario(normalized.scenarioId, "m07-object-navigation");
        updateWorkspaceContext({ ...message.context, activeObjectRef: normalized.objectRef, scenarioId: normalized.scenarioId, sourceModuleId: "m07" }, "m07-navigation");
        if (message.route === "#module/report" && message.contentBlock) {
          global.OFW_WORKFLOW.appendBlock(normalized.scenarioId, message.contentBlock);
          if (message.additionalContentBlock) global.OFW_WORKFLOW.appendBlock(normalized.scenarioId, message.additionalContentBlock);
          showToast("已加入报告草稿", message.contentBlock.title, "success");
        }
        if (message.route === "#dashboard" || /^#module\/[a-z0-9-]+$/.test(message.route || "")) navigate(message.route);
        return;
      }
      if (renderedModuleId === "m07" && message.operation === "sync-breadcrumb") {
        const breadcrumb = document.getElementById("frame-breadcrumb-current");
        if (breadcrumb && message.label) breadcrumb.textContent = message.label;
        return;
      }
      if (renderedModuleId === "modeling" && message.type === "OFW_M08_RETURN_TO_M07") {
        handleM08Return(message);
        return;
      }
      if (renderedModuleId === "modeling" && message.type === "OFW_M08_NAVIGATE") {
        const route = message.moduleId === "m07" ? "#module/m07" : message.route;
        if (message.scenarioId && DATA.scenarioById[message.scenarioId] && STORE.get().activeScenarioId !== message.scenarioId) STORE.setActiveScenario(message.scenarioId, "modeling-target-navigation");
        if (route === "#module/report" && message.contentBlock) global.OFW_WORKFLOW.appendBlock(STORE.get().activeScenarioId, message.contentBlock);
        if (route === "#dashboard" || /^#module\/[a-z0-9-]+$/.test(route || "")) navigate(route);
      }
    } catch (error) {
      showToast("上下文未交接", error.message, "danger");
    }
  }

  function resourceDrawerMarkup(resource) {
    if (!resource) return "";
    const module = resource.moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[resource.moduleId];
    const status = resourceStatus(resource.status);
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="resource-drawer" role="dialog" aria-modal="true" aria-labelledby="resource-title">
      <header><div><span>${esc(resource.scenarioId)} · ${esc(resource.businessDomain)}</span><h2 id="resource-title">${esc(resource.name)}</h2><p>${esc(resource.type)}</p></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="关闭">${icon("x")}</button></header>
      <div class="drawer-body"><section class="resource-summary"><div><span>当前状态</span><i class="status-pill ${status.tone}">${esc(status.label)}</i></div><p>${esc(resource.summary)}</p></section>
        <dl class="resource-facts"><div><dt>所属模块</dt><dd>${esc(module?.ownerId)} · ${esc(module?.name)}</dd></div><div><dt>责任方</dt><dd>${esc(resource.owner || "—")}</dd></div><div><dt>数据截至</dt><dd>${esc(resource.asOf || "—")}</dd></div><div><dt>场景身份</dt><dd>${esc(resource.scenarioId)} · ${esc(DATA.scenarioById[resource.scenarioId]?.scenarioVersion || "—")}</dd></div></dl>
        <section class="resource-refs"><h3>稳定引用</h3>${(resource.refs || []).length ? resource.refs.map((ref) => `<code>${esc(ref)}</code>`).join("") : "<span>当前资源没有额外引用。</span>"}</section>
      </div>
      <footer><button class="btn" type="button" data-action="close-drawer">关闭</button><button class="btn primary" type="button" data-action="use-resource" data-resource-id="${esc(resource.id)}">在${esc(module?.name || "模块")}中查看${icon("arrow-right", "sm")}</button></footer>
    </aside></div>`;
  }

  function contextDrawerMarkup() {
    const context = STORE.workspaceContext?.() || {};
    const objectSet = context.objectSetRef?.title || context.objectSetRef?.name || context.objectSetRef?.id || "全部业务对象";
    const object = context.activeObjectRef?.title || context.activeObjectRef?.name || context.activeObjectRef?.id || "未聚焦单个对象";
    const range = context.timeRange?.label || (context.timeRange?.start && context.timeRange?.end ? `${context.timeRange.start} 至 ${context.timeRange.end}` : "全部观察期");
    const resultLabels = { formal: "正式结果", demo: "演示基准", candidate: "候选试算", shadow: "影子观察", simulation: "压力模拟", difference: "版本差异" };
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="resource-drawer context-drawer" role="dialog" aria-modal="true" aria-labelledby="context-title"><header><div><span>当前工作上下文</span><h2 id="context-title">${esc(object)}</h2><p>${esc(objectSet)}</p></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="关闭">${icon("x")}</button></header><div class="drawer-body"><dl class="resource-facts"><div><dt>对象范围</dt><dd>${esc(objectSet)}<select data-workspace-scope aria-label="分析范围">${[["object","当前对象优先"],["set","当前对象集"],["all","全域结果"]].map(([id,label]) => `<option value="${id}" ${(context.analysisScope || "object") === id ? "selected" : ""}>${label}</option>`).join("")}</select></dd></div><div><dt>当前对象</dt><dd>${esc(object)}</dd></div><div><dt>观察时间</dt><dd>${esc(range)}</dd></div><div><dt>结果视图</dt><dd><select data-workspace-result aria-label="结果视图">${Object.entries(resultLabels).map(([id,label]) => `<option value="${id}" ${context.resultView === id ? "selected" : ""}>${label}</option>`).join("")}</select></dd></div><div><dt>数据版本</dt><dd class="mono-wrap">${esc(context.dataVersionRef?.id || "随模块当前版本")}</dd></div><div><dt>语义版本</dt><dd class="mono-wrap">${esc(context.ontologyVersionRef?.id || "随模块当前版本")}</dd></div><div><dt>证据引用</dt><dd>${context.evidenceRefs?.length || 0} 项</dd></div></dl></div><footer><button class="btn" type="button" data-action="clear-workspace-context">清除聚焦</button><button class="btn primary" type="button" data-action="close-drawer">完成</button></footer></aside></div>`;
  }

  function renderDrawer() {
    if (drawerResourceId === "__catalog__") drawerRoot.innerHTML = catalogDrawerMarkup();
    else if (drawerResourceId === "__recent__") drawerRoot.innerHTML = recentDrawerMarkup();
    else if (drawerResourceId === "__context__" || drawerResourceId === "__workspace__") drawerRoot.innerHTML = contextDrawerMarkup();
    else drawerRoot.innerHTML = resourceDrawerMarkup(drawerResourceId ? catalog().resource(drawerResourceId) : null);
    refreshIcons(drawerRoot);
  }

  function openResource(resourceId) {
    drawerResourceId = resourceId;
    renderDrawer();
    setTimeout(() => drawerRoot.querySelector("button")?.focus(), 0);
  }

  function closeDrawer() {
    drawerResourceId = null;
    drawerRoot.replaceChildren();
    if (drawerFocus?.isConnected) drawerFocus.focus();
    drawerFocus = null;
  }

  function catalogResultsMarkup() {
    const query = catalogQuery.trim().toLocaleLowerCase();
    const results = catalog().resources.filter((item) => (catalogDomain === "all" || item.scenarioId === catalogDomain) && (!query || [item.name, item.businessDomain, item.summary, item.type].join(" ").toLocaleLowerCase().includes(query)));
    return `<p class="finder-count" role="status">${results.length} 项资源</p>${results.map((item) => `<button class="finder-result" type="button" data-resource-id="${esc(item.id)}"><span class="home-capability-icon">${icon(DATA.moduleById[item.moduleId]?.icon || "layout-dashboard", "sm")}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.businessDomain)} · ${esc(item.type)}</small></span>${icon("chevron-right", "sm")}</button>`).join("") || `<div class="finder-empty">没有匹配的资源</div>`}`;
  }

  function catalogDrawerMarkup() {
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="resource-drawer resource-finder" role="dialog" aria-modal="true" aria-labelledby="finder-title"><header><div><span>资源检索</span><h2 id="finder-title">查找业务资源</h2></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="关闭">${icon("x")}</button></header><div class="finder-filters"><label>${icon("search", "sm")}<input type="search" data-catalog-search value="${esc(catalogQuery)}" placeholder="搜索名称、业务或类型" aria-label="搜索业务资源"></label><select data-catalog-domain aria-label="资源业务域"><option value="all">全部业务域</option>${DATA.scenarios.map((item) => `<option value="${item.id}" ${catalogDomain === item.id ? "selected" : ""}>${esc(item.businessDomain)}</option>`).join("")}</select></div><div id="finder-results" class="drawer-body">${catalogResultsMarkup()}</div></aside></div>`;
  }

  function recentDrawerMarkup() {
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="resource-drawer" role="dialog" aria-modal="true" aria-labelledby="recent-title"><header><div><span>工作记录</span><h2 id="recent-title">最近工作</h2></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="关闭">${icon("x")}</button></header><div class="drawer-body">${(STORE.get().recentWork || []).map((item, index) => `<button class="finder-result" type="button" data-action="resume-work" data-index="${index}">${icon("history")}<span><strong>${esc(item.label)}</strong><small>${esc(item.workspaceContext?.activeObjectRef?.title || DATA.scenarioById[item.scenarioId]?.businessDomain)} · ${esc(item.visitedAt.slice(0, 16).replace("T", " "))}</small></span>${icon("arrow-up-right")}</button>`).join("") || `<div class="finder-empty">暂无最近工作</div>`}</div></aside></div>`;
  }

  function resetModalMarkup() {
    if (modalKind !== "reset") return "";
    const scenario = activeDefinition();
    const context = activeContext();
    const archived = scenario.archived;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><span>${icon("rotate-ccw")}</span><div><h2 id="modal-title">重置当前场景</h2><p>${esc(scenario.id)} · ${esc(scenario.name)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">${icon("x")}</button></header><div class="modal-body"><div class="reset-notice protected">${icon("shield-check")}<div><strong>正式运行与历史结果保持只读</strong><span>${archived ? "归档场景身份、正式资产和证据不会被修改；模型优化周期单独封存后重新开始。" : `业务轮次 ${esc(shortRunId(context?.scenarioRunId))} 与模型优化周期分别管理，重置不会影响其他场景。`}</span></div></div></div><footer><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn" type="button" data-action="reset-browsing">重置浏览位置</button><button class="btn danger" type="button" data-action="confirm-model-reset">重置模型周期</button>${archived ? "" : `<button class="btn danger" type="button" data-action="confirm-reset">重置业务运行</button>`}</footer></section></div>`;
  }

  async function resetModelCycle() {
    const scenarioId = STORE.get().activeScenarioId;
    try {
      const response = await fetch(`${API_BASE}/v1/model-management/actions/reset-current-cycle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioId, payload: {} }),
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || `模型优化服务返回 ${response.status}`);
      modelContexts.set(scenarioId, body);
      closeModal();
      render();
      showToast("模型周期已重置", `${scenarioId} 已建立新的独立周期；历史周期和正式结果保持不变。`, "success");
    } catch (error) {
      showToast("模型周期未重置", error.message, "danger");
    }
  }

  function renderModal() {
    modalRoot.innerHTML = resetModalMarkup();
    refreshIcons(modalRoot);
  }

  function closeModal() {
    modalKind = null;
    modalRoot.replaceChildren();
  }

  function showToast(title, detail, tone = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `${icon(tone === "success" ? "circle-check" : tone === "danger" ? "circle-x" : "triangle-alert")}<div><strong>${esc(title)}</strong><span>${esc(detail)}</span></div>`;
    toastRegion.replaceChildren(toast);
    refreshIcons(toast);
    setTimeout(() => toast.remove(), 3800);
  }

  function applyResource(resourceId) {
    const resource = catalog().resource(resourceId);
    if (!resource) return;
    if(resource.ontologyRuleOwner){JOINT.openOntology(resource.ontologyRuleOwner);return;}
    if(resource.taskId){STORE.setActiveScenario(resource.scenarioId,'resource');JOINT.open(resource.moduleId,resource.taskId);if(resource.assetId){const frame=document.getElementById('module-frame');frame.addEventListener('load',()=>{frame.contentWindow.location.hash=`#/resources?snapshotAsset=${encodeURIComponent(resource.assetId)}`;},{once:true});}return;}
    const previousScenario = STORE.get().activeScenarioId;
    STORE.selectResource(resource.moduleId, resource.id, resource.scenarioId);
    updateWorkspaceContext({ scenarioId: resource.scenarioId, activeObjectRef: resource.objectRef || null, objectSetRef: null, sourceModuleId: "resource-finder" }, "resource");
    if (resource.moduleId === "dashboard") {
      const id = { S001: "financing", S002: "budget", S003: "risk", S004: "preloan", S005: "post-investment" }[resource.scenarioId];
      STORE.saveFramePosition("dashboard", { hash: `#/view/${id}/overview` });
    }
    closeDrawer();
    history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId: resource.scenarioId }, "", resource.moduleId === "dashboard" ? "#dashboard" : `#module/${resource.moduleId}`);
    render();
    void refreshModelContext({ scenarioId: resource.scenarioId });
    showToast("资源已带入", `${resource.scenarioId} · ${resource.name}${previousScenario === resource.scenarioId ? "" : "，场景上下文已同步"}`, "success");
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) { navigate(routeButton.dataset.route); return; }
    const resourceButton = event.target.closest("[data-resource-id]");
    if (resourceButton && !resourceButton.closest("[data-action='use-resource']")) { openResource(resourceButton.dataset.resourceId); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === "toggle-navigation") { STORE.toggleNavigation(); app.querySelector(".platform-shell")?.classList.toggle("nav-collapsed", STORE.get().navCollapsed); }
    if (action === "retry-service") { serviceState = "checking"; syncServiceStatus(); void refreshModelContext(); }
    if (action === "open-catalog" || action === "open-recent") {
      drawerFocus = actionButton;
      drawerResourceId = action === "open-catalog" ? "__catalog__" : "__recent__";
      renderDrawer();
      drawerRoot.querySelector("input,button")?.focus();
    }
    if (action === "resume-work") {
      const entry = STORE.get().recentWork[Number(actionButton.dataset.index)];
      if (entry) {
        captureFramePosition();
        STORE.setActiveScenario(entry.scenarioId, "resume");
        STORE.updateWorkspaceContext(entry.workspaceContext, "resume");
        if (entry.position) STORE.saveFramePosition(entry.route === "#dashboard" ? "dashboard" : entry.route.split("/").at(-1), entry.position);
        navigate(entry.route);
      }
    }
    if (action === "return") returnToPrevious();
    if (action === "home-domain") selectHomeDomain(actionButton.dataset.domain);
    if (action === "home-entry") openHomeEntry(actionButton);
    if (action === "open-workspace-context") { drawerResourceId = "__workspace__"; renderDrawer(); }
    if (action === "clear-workspace-context") {
      STORE.clearWorkspaceContext?.("user");
      closeDrawer();
      syncWorkspaceContextChrome();
      const frame = document.getElementById("module-frame");
      const module = frame && renderedModuleId ? (renderedModuleId === "dashboard" ? DATA.dashboard : DATA.moduleById[renderedModuleId]) : null;
      if (frame && module) deliverWorkspaceContext(frame, module);
      showToast("已清除当前聚焦", "对象范围恢复为全部业务对象。", "success");
    }
    if (action === "refresh-home") renderHome();
    if (action === "refresh-cycle") void refreshModelContext({ rerender: true });
    if (action === "open-scenario-task") {
      const scenarioId = actionButton.dataset.scenarioId;
      if (!DATA.scenarioById[scenarioId]) return;
      STORE.setActiveScenario(scenarioId, "scenario-workflow-entry");
      navigate(actionButton.dataset.route || "#home");
      void refreshModelContext({ scenarioId });
    }
    if (action === "close-drawer" && (event.target === actionButton || actionButton.closest(".resource-drawer"))) closeDrawer();
    if (action === "reload-frame") document.getElementById("module-frame")?.contentWindow?.location.reload();
    if (action === "module-root") {
      const module = actionButton.dataset.moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[actionButton.dataset.moduleId];
      const frame = document.getElementById("module-frame");
      if (frame && module) {
        const firstTask = moduleTasks(module.id)[0];
        if (firstTask) activateModuleTask(module.id, firstTask.id);
        else frame.contentWindow.location.hash = module.rootHash || "";
      }
    }
    if (action === "open-reset") { modalKind = "reset"; renderModal(); }
    if (action === "close-modal" && (event.target === actionButton || actionButton.closest(".modal"))) closeModal();
    if (action === "reset-browsing") {
      const receipt = STORE.resetBrowsingContext();
      closeModal();
      history.replaceState({ ofwShell: true, scenarioId: STORE.get().activeScenarioId, ofwDepth: 0 }, "", "#home");
      render();
      showToast("浏览位置已重置", `${receipt.scenarioId} 的运行身份和历史保持不变。`, "success");
    }
    if (action === "confirm-model-reset") void resetModelCycle();
    if (action === "confirm-reset") {
      const receipt = STORE.resetCurrentScenario();
      closeModal();
      history.replaceState({ ofwShell: true, scenarioId: "S005", ofwDepth: 0 }, "", "#home");
      render();
      showToast("当前运行已重置", `新轮次 ${shortRunId(receipt.scenarioRunId)}；已保留 ${receipt.preservedHistoricalRuns} 个历史轮次。`, "success");
    }
    if (action === "use-resource") applyResource(actionButton.dataset.resourceId);
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-workspace-result]")) updateWorkspaceContext({ resultView: event.target.value, sourceModuleId: "shell" }, "user-result-view");
    if (event.target.matches("[data-workspace-scope]")) updateWorkspaceContext({ analysisScope: event.target.value, sourceModuleId: "shell" }, "user-analysis-scope");
    if (event.target.matches("[data-catalog-domain]")) { catalogDomain = event.target.value; document.getElementById("finder-results").innerHTML = catalogResultsMarkup(); refreshIcons(drawerRoot); }
    if (event.target.matches("[data-module-task-select]")) activateModuleTask(event.target.dataset.moduleTaskSelect, event.target.value);
  });
  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-catalog-search]")) { catalogQuery = event.target.value; document.getElementById("finder-results").innerHTML = catalogResultsMarkup(); refreshIcons(drawerRoot); }
  });

  document.addEventListener("click", (event) => {
    const task = event.target.closest("[data-module-task]");
    if (task) activateModuleTask(task.dataset.moduleId, task.dataset.moduleTask);
  });

  global.addEventListener("message", handleFrameMessage);
  global.addEventListener("popstate", (event) => {
    captureFramePosition();
    if (event.state?.scenarioId && event.state.scenarioId !== STORE.get().activeScenarioId && DATA.scenarioById[event.state.scenarioId]) STORE.setActiveScenario(event.state.scenarioId, "history");
    if (event.state?.workspaceContext) STORE.updateWorkspaceContext(event.state.workspaceContext, "history");
    scheduleNavigationRender();
  });
  global.addEventListener("hashchange", scheduleNavigationRender);
  global.addEventListener("beforeunload", () => { captureFramePosition(); captureHomePosition(); });
  global.addEventListener("storage", (event) => {
    if (event.key !== STORE.STORAGE_KEY) return;
    const identity = (raw) => {
      try {
        const value = JSON.parse(raw || "{}");
        return JSON.stringify([value.activeScenarioId, value.workspaceContext?.activeObjectRef?.id, value.workspaceContext?.objectSetRef?.objectIds, value.workspaceContext?.resultView]);
      } catch (_) { return raw; }
    };
    if (identity(event.oldValue) !== identity(event.newValue)) showToast("其他窗口状态已变化", "本窗口保留当前分析；重新读取可同步最新状态。", "warning");
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDrawer(); closeModal(); } });

  if (!global.location.hash) history.replaceState({ ofwShell: true, scenarioId: STORE.get().activeScenarioId, ofwDepth: 0 }, "", "#home");
  else if (!history.state?.ofwShell) history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId: STORE.get().activeScenarioId, ofwDepth: 0 }, "", global.location.href);
  JOINT?.attach({store:STORE,tasks:moduleTasks,navigate,frameSource,capture:captureFramePosition,updateWorkspaceContext,syncNavigation:syncSecondaryNavigation,toast:showToast,moduleForRoute});
  let requestedTask=new URLSearchParams(global.location.search).get('task');
  if(requestedTask==='situation'&&location.hash==='#module/m07')history.replaceState(history.state,'',location.pathname+location.search+'#dashboard');
  if(requestedTask==='joint-data'){requestedTask='resources';history.replaceState(history.state,'',location.pathname+location.search+'#module/data');}
  const legacyRule=requestedTask==='rule-sandbox',requestedRuleOwner=new URLSearchParams(global.location.search).get('ruleOwner');
  if(legacyRule)requestedTask='modeling';
  if(requestedTask){const module=moduleForRoute(),task=module&&moduleTasks(module.id).find(item=>item.id===requestedTask);if(task)STORE.saveFramePosition(module.id,{hash:task.hash,windowY:0,containerY:0});const url=new URL(global.location.href);url.searchParams.delete('task');history.replaceState(history.state,'',url);}
  render();
  if(legacyRule||requestedRuleOwner){const url=new URL(location.href);url.searchParams.delete('ruleOwner');history.replaceState(history.state,'',url);JOINT.openOntology(requestedRuleOwner==='S003'?'S003':'S001');}
  global.OFW_READABILITY?.install(document);
  global.addEventListener("resize", () => {
    global.OFW_READABILITY?.refresh(document);
    global.OFW_READABILITY?.refresh(document.getElementById("module-frame")?.contentDocument);
  });
  void refreshModelContext();
})(window);
