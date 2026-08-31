(function mountCompositeShell(global) {
  "use strict";

  const DATA = global.OFW_V120_DATA;
  const STORE = global.OFW_V120_STORE;
  const app = document.getElementById("app");
  const drawerRoot = document.getElementById("drawer-root");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  const API_BASE = new URLSearchParams(global.location.search).get("m08ApiBase") || "http://127.0.0.1:4359";
  const ALLOWED_MODULES = new Set(DATA.modules.map((module) => module.id));
  const ARCHIVED_IDS = new Set(DATA.scenarios.filter((scenario) => scenario.archived).map((scenario) => scenario.id));
  const S005_WORKBENCH_MODULES = new Map([["data", "M02"], ["ontology", "M01"], ["query", "M03"], ["decision", "M04"], ["agent", "M05"], ["report", "M06"]]);
  const S003_MODEL_CONSUMERS = new Map([
    ["query", { moduleId: "M03", consumerId: "M03_QUERY" }],
    ["agent", { moduleId: "M05", consumerId: "M05_AGENT" }],
    ["report", { moduleId: "M06", consumerId: "M06_REPORT" }]
  ]);
  const S003_OBJECTIVE_ID = "MO-S003-DEBT-RISK-EARLY-WARNING-v1";
  const HOME_DOMAIN_ORDER = ["foundation", "intelligence", "action"];
  const HOME_DOMAINS = Object.freeze({
    foundation: Object.freeze({
      order: "01", en: "可信数据", name: "数据治理", icon: "database", modules: ["data", "ontology"],
      kicker: "数据治理 · 可信底座", title: "把持续变化的数据，治理成稳定、可追溯的业务基础",
      lead: "数据工程负责来源、管道、数据资产与质量；本体管理负责业务对象、关系、指标、规则和行动类型。两者共同形成可被后续环节稳定引用的业务基础。",
      scope: "资产与定义", flow: "数据治理 → 语义问数", flowDetail: "可信数据资产与已发布业务定义进入问数、报告和核验。",
      core: "数据治理 · 语义问数 · 行动智能"
    }),
    intelligence: Object.freeze({
      order: "02", en: "可信理解", name: "语义问数", icon: "sparkles", modules: ["query", "report", "m07", "modeling"],
      kicker: "语义问数 · 可信理解", title: "让每次问数与报告都能回到明确的数据和业务定义",
      lead: "智能问数在固定上下文中回答问题；报告中心负责确定性核验、正式发布和报告伴读。答案与报告始终保留版本与来源。",
      scope: "问数与报告", flow: "语义问数 → 行动智能", flowDetail: "带证据的答案、报告和规则结果形成受控行动申请。",
      core: "数据治理 · 语义问数 · 行动智能"
    }),
    action: Object.freeze({
      order: "03", en: "受控协作", name: "行动智能", icon: "circle-dot-dashed", modules: ["decision", "agent"],
      kicker: "行动智能 · 受控闭环", title: "让洞察进入人的判断，再形成清晰、可追溯的行动",
      lead: "Agent 应用解释固定证据；决策中心承接行动申请、人工确认和负责人待办。任何环节都不能绕过人工确认直接形成待办。",
      scope: "决策与协作", flow: "行动智能 → 数据治理", flowDetail: "确认、待办与执行结果作为只读证据回流，不改写历史事实。",
      core: "数据治理 · 语义问数 · 行动智能"
    })
  });
  const BRAND_BRAIN_SVG = '<path class="brain-mesh-outline" d="M12 4.35C10.92 2.72 8.42 2.35 6.92 3.78 4.76 3.6 3.14 5.67 3.82 7.7 2.18 8.78 2.28 11.18 3.72 12.5 2.62 14.5 3.8 16.96 5.93 17.52 6.22 20.2 9.42 21.38 11.28 19.72c.45-.4.72-.9.72-1.5 0 .6.27 1.1.72 1.5 1.86 1.66 5.06.48 5.35-2.2 2.13-.56 3.31-3.02 2.21-5.02 1.44-1.32 1.54-3.72-.1-4.8.68-2.03-.94-4.1-3.1-3.92-1.5-1.43-4-1.06-5.08.57Z"/><path class="brain-mesh-edge" d="M12 4.35 8.65 4.6 6.05 6.15 9.4 7.3 12 8.95 14.6 7.3 17.95 6.15 15.35 4.6 12 4.35M6.05 6.15 4.78 9.05 7.35 10.35 9.4 7.3M4.78 9.05 5.55 13.55 7.35 10.35 9.95 11.7 12 8.95M5.55 13.55 8.65 15.55 9.95 11.7 12 14.05 10.25 17.55 8.65 15.55M5.55 13.55 6.02 16.35 8.65 15.55M10.25 17.55 12 19.25 13.75 17.55 12 14.05M12 8.95 12 14.05M17.95 6.15 19.22 9.05 16.65 10.35 14.6 7.3M19.22 9.05 18.45 13.55 16.65 10.35 14.05 11.7 12 8.95M18.45 13.55 15.35 15.55 14.05 11.7 12 14.05 13.75 17.55 15.35 15.55M18.45 13.55 17.98 16.35 15.35 15.55M7.35 10.35 12 8.95 16.65 10.35M8.65 15.55 12 14.05 15.35 15.55"/><path class="brain-mesh-seam" d="M12 4.35v15"/><path class="brain-mesh-signal signal-a" pathLength="1" d="M4.78 9.05 7.35 10.35 9.95 11.7 12 14.05 13.75 17.55"/><path class="brain-mesh-signal signal-b" pathLength="1" d="M17.95 6.15 14.6 7.3 12 8.95 9.95 11.7 8.65 15.55"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="4.35" r=".48"/><circle class="brain-mesh-node phase-b" cx="8.65" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-c" cx="6.05" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="9.4" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-b" cx="4.78" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-a" cx="7.35" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-c" cx="9.95" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-d" cx="5.55" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-b" cx="6.02" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-a" cx="8.65" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-c" cx="10.25" cy="17.55" r=".34"/><circle class="brain-mesh-node phase-d node-key" cx="12" cy="8.95" r=".46"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="14.05" r=".46"/><circle class="brain-mesh-node phase-c node-key" cx="12" cy="19.25" r=".48"/><circle class="brain-mesh-node phase-b" cx="15.35" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-a" cx="17.95" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="14.6" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-c" cx="19.22" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-b" cx="16.65" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="14.05" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-a" cx="18.45" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-c" cx="17.98" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="15.35" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-b" cx="13.75" cy="17.55" r=".34"/>';

  let renderedModuleId = null;
  let drawerResourceId = null;
  let modalKind = null;
  let frameSaveTimer = null;
  let homeScrollTimer = null;
  let homeDomain = "foundation";
  let homeOrbitTurn = 0;
  let homeFilters = { query: "", scenarioId: "ALL", moduleId: "ALL" };

  function catalog() {
    return global.OFW_V120_CATALOG || {
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

  function scenarioTone(scenario) {
    if (scenario.archived || scenario.status === "completed") return { label: "已归档", tone: "success" };
    if (scenario.status === "active") return { label: "进行中", tone: "info" };
    if (scenario.status === "blocked") return { label: "有阻断", tone: "warning" };
    return { label: "待开始", tone: "neutral" };
  }

  function resourceStatus(value) {
    const key = String(value || "available").toLowerCase();
    if (["completed", "published", "verified", "archived"].includes(key)) return { label: key === "archived" ? "已归档" : key === "published" ? "已发布" : "已形成", tone: "success" };
    if (["active", "running", "available", "ready"].includes(key)) return { label: key === "active" || key === "running" ? "进行中" : "可读取", tone: "info" };
    if (["candidate"].includes(key)) return { label: "待确认", tone: "warning" };
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
    captureFramePosition();
    captureHomePosition();
    closeDrawer();
    closeModal();
    const currentDepth = Number(history.state?.ofwDepth || 0);
    const state = { ...(history.state || {}), ofwShell: true, scenarioId: STORE.get().activeScenarioId, ofwDepth: options.replace ? currentDepth : currentDepth + 1 };
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
      <div class="nav-context"><span>业务范围</span><strong>S001—S005 · 统一资源目录</strong></div>
      <nav class="primary-nav" aria-label="一级模块">
        ${DATA.nav.map((item) => {
          const count = item.id === "home" ? 0 : catalog().resourcesFor?.(item.id)?.length || 0;
          return `<button class="nav-item ${route.active === item.id ? "active" : ""}" type="button" data-route="${item.route}" data-primary-nav="true" title="${esc(item.name)}">
            ${icon(item.icon)}<span>${esc(item.name)}</span>${item.id === "home" ? "" : `<i class="nav-state ${count ? "ready" : ""}" aria-label="${count} 项资源"></i>`}
          </button>`;
        }).join("")}
      </nav>
      <footer class="nav-foot"><div><i class="connection-dot"></i><strong>5 场景 · 9 工作区</strong></div><p>资源按场景身份隔离读取</p></footer>
    </aside>`;
  }

  function topbarMarkup(route) {
    const module = moduleForRoute(route);
    const scenario = activeDefinition();
    const context = activeContext();
    const meta = scenarioTone(scenario);
    const currentName = module?.name || "首页";
    return `<header class="global-topbar">
      <div class="top-title">
        ${route.type === "home" ? "" : `<button class="icon-button mobile-back" type="button" data-action="return" title="返回" aria-label="返回">${icon("arrow-left", "sm")}</button>`}
        ${icon(module?.icon || "house")}
        <div><span>${module?.ownerId || "统一工作台"}</span><strong>${esc(currentName)}</strong></div>
      </div>
      <button class="active-context" type="button" data-action="open-context" title="查看当前场景上下文">
        <span><i class="context-dot ${meta.tone}"></i>${esc(scenario.id)} · ${esc(scenario.businessDomain)}</span>
        <strong>${esc(scenario.name)}</strong>
        <small>${esc(shortRunId(context?.scenarioRunId))}</small>
      </button>
      <div class="top-actions">
        ${module ? `<button class="top-action" type="button" data-action="reload-frame" title="重新读取当前模块" aria-label="重新读取当前模块">${icon("refresh-cw", "sm")}</button>` : ""}
        <button class="top-action" type="button" data-action="open-reset" title="重置当前场景" aria-label="重置当前场景">${icon("rotate-ccw", "sm")}<span>重置</span></button>
        <div class="user-account" title="当前账号"><span>管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function scenarioStrip() {
    return `<section class="scenario-strip" aria-label="场景运行档案">
      ${DATA.scenarios.map((scenario) => {
        const meta = scenarioTone(scenario);
        const count = catalog().resources.filter?.((resource) => resource.scenarioId === scenario.id).length || 0;
        return `<button type="button" class="scenario-record ${scenario.id === STORE.get().activeScenarioId ? "active" : ""}" data-action="focus-scenario" data-scenario-id="${scenario.id}">
          <span><b>${scenario.id}</b><i class="status-pill ${meta.tone}">${meta.label}</i></span>
          <strong>${esc(scenario.name)}</strong>
          <small>${esc(scenario.dataAsOf)} · ${count} 项资源</small>
        </button>`;
      }).join("")}
    </section>`;
  }

  function s005StageMarkup() {
    const progress = STORE.s005Progress();
    const context = STORE.scenarioContext("S005");
    const stages = Object.values(STORE.scenario("S005")?.stages || {});
    const percentage = progress.total ? Math.round(progress.done / progress.total * 100) : 0;
    return `<section class="active-run-band">
      <div class="run-identity"><span>当前场景</span><strong>S005 · 投后评价与池内选择分析</strong><small>${esc(shortRunId(context?.scenarioRunId))} · 数据截至 2026-07-17</small></div>
      <div class="run-progress"><span><b>${progress.done}/${progress.total}</b> 阶段已形成</span><i><i style="width:${percentage}%"></i></i><small>${progress.blocked ? `${progress.blocked} 项阻断` : progress.active ? `${progress.active} 项处理中` : "等待业务操作"}</small></div>
      <div class="run-stages" aria-label="S005 流程状态">${stages.map((stage, index) => `<span class="${stage.status}"><i>${index + 1}</i>${esc(stage.title)}</span>`).join("")}</div>
      <div class="run-actions"><button type="button" class="btn" data-route="#module/m07">${icon("scan-search", "sm")}多视图探索</button><button type="button" class="btn primary" data-route="#module/modeling">${icon("activity", "sm")}模型与模拟</button></div>
    </section>`;
  }

  function moduleDirectory() {
    return `<section class="home-panel"><header class="section-head"><div><span>模块工作区</span><h2>从业务资源进入处理位置</h2></div><small>M01—M08 · Dashboard</small></header>
      <div class="module-directory">${[...DATA.modules, DATA.dashboard].map((module) => {
        const count = catalog().resourcesFor?.(module.id)?.length || 0;
        return `<button type="button" class="module-entry" data-route="${module.route}"><span class="module-symbol">${icon(module.icon)}</span><span><small>${esc(module.ownerId)}</small><strong>${esc(module.name)}</strong><em>${count} 项资源</em></span>${icon("chevron-right", "sm")}</button>`;
      }).join("")}</div>
    </section>`;
  }

  function filteredHomeResources() {
    const query = homeFilters.query.trim().toLowerCase();
    return catalog().resources.filter((resource) => {
      if (homeFilters.scenarioId !== "ALL" && resource.scenarioId !== homeFilters.scenarioId) return false;
      if (homeFilters.moduleId !== "ALL" && resource.moduleId !== homeFilters.moduleId) return false;
      if (!query) return true;
      return [resource.name, resource.type, resource.businessDomain, resource.owner, resource.summary, ...(resource.refs || [])].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }

  function homeResourceRows() {
    const resources = filteredHomeResources();
    if (!resources.length) return `<div class="empty-state">${icon("search-x")}<strong>没有匹配的业务资源</strong><span>调整场景、模块或搜索条件。</span></div>`;
    return `<div class="resource-table"><div class="resource-row head"><span>资源</span><span>场景 / 业务域</span><span>模块</span><span>状态</span><span>数据截至</span><span></span></div>${resources.slice(0, 20).map((resource) => {
      const status = resourceStatus(resource.status);
      const module = resource.moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[resource.moduleId];
      return `<button type="button" class="resource-row" data-resource-id="${esc(resource.id)}"><span><strong>${esc(resource.name)}</strong><small>${esc(resource.type)}</small></span><span><strong>${esc(resource.scenarioId)}</strong><small>${esc(resource.businessDomain)}</small></span><span>${esc(module?.name || resource.moduleId)}</span><span><i class="status-pill ${status.tone}">${esc(status.label)}</i></span><span>${esc(resource.asOf || "—")}</span><span>${icon("chevron-right", "sm")}</span></button>`;
    }).join("")}</div>`;
  }

  function unifiedResourcePanel() {
    return `<section class="home-panel resource-home"><header class="section-head"><div><span>统一资源目录</span><h2>按业务属性筛选 S001—S005</h2></div><small>${catalog().resources.length} 项登记资源</small></header>
      <div class="home-resource-filters">
        <label>${icon("search", "sm")}<input type="search" data-home-query placeholder="搜索名称、类型、责任方或引用" value="${esc(homeFilters.query)}" /></label>
        <select data-home-scenario aria-label="筛选场景"><option value="ALL">全部场景</option>${DATA.scenarios.map((scenario) => `<option value="${scenario.id}" ${homeFilters.scenarioId === scenario.id ? "selected" : ""}>${scenario.id} · ${esc(scenario.businessDomain)}</option>`).join("")}</select>
        <select data-home-module aria-label="筛选模块"><option value="ALL">全部模块</option>${[...DATA.modules, DATA.dashboard].map((module) => `<option value="${module.id}" ${homeFilters.moduleId === module.id ? "selected" : ""}>${esc(module.ownerId)} · ${esc(module.name)}</option>`).join("")}</select>
      </div>
      <div id="home-resource-results">${homeResourceRows()}</div>
    </section>`;
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

  function homeDomainCardsMarkup(domain) {
    return domain.modules.map((moduleId) => {
      const module = DATA.moduleById[moduleId];
      const resources = catalog().resourcesFor(module.id);
      const activeResource = resources.find((resource) => resource.scenarioId === STORE.get().activeScenarioId) || null;
      const status = resourceStatus(activeResource?.status || "not_registered");
      return `<article class="classic-module-card"><div class="classic-card-title"><span>${icon(module.icon)}</span><div><small>${esc(module.ownerId)} · ${esc(module.short)}</small><strong>${esc(module.name)}</strong></div><em class="status-badge ${status.tone}">${esc(activeResource?.scenarioId || "当前场景")} · ${esc(status.label)}</em></div><p>${esc(module.description)}</p><footer><span>${resources.length} 个场景资源统一登记</span><button type="button" data-route="${module.route}">进入模块 ${icon("arrow-right", "sm")}</button></footer></article>`;
    }).join("");
  }

  function homeDomainPagerMarkup() {
    return Object.entries(HOME_DOMAINS).map(([key, item]) => `<button type="button" class="${homeDomain === key ? "active" : ""}" data-action="home-domain" data-domain="${key}" aria-label="切换到${item.name}" aria-pressed="${homeDomain === key}">${item.order}</button>`).join("");
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

  function animateHomeDomainDetail(detail) {
    if (!detail || global.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof detail.animate !== "function") return;
    detail.getAnimations().forEach((animation) => animation.cancel());
    detail.animate([{ opacity: 0.72, transform: "translateX(5px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: 480, easing: "cubic-bezier(.2,.85,.25,1)" });
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
    const domain = HOME_DOMAINS[homeDomain];
    const flowSummary = frame.querySelector(".architecture-flow-summary");
    if (flowSummary) {
      flowSummary.querySelector("strong").textContent = domain.flow;
      flowSummary.querySelector("small").textContent = domain.flowDetail;
    }
    frame.querySelectorAll(".architecture-foot [data-domain]").forEach((button) => button.classList.toggle("active", button.dataset.domain === homeDomain));
    const detail = frame.querySelector(".classic-domain-detail");
    if (detail) {
      detail.querySelector(".detail-kicker").textContent = domain.kicker;
      detail.querySelector("h2").textContent = domain.title;
      detail.querySelector(":scope > p").textContent = domain.lead;
      detail.querySelector(".classic-domain-cards").innerHTML = homeDomainCardsMarkup(domain);
      detail.querySelector(".domain-pager").innerHTML = homeDomainPagerMarkup();
      refreshIcons(detail);
      animateHomeDomainDetail(detail);
    }
    STORE.saveNavigation({ homeDomain, homeOrbitTurn });
  }

  function homeStatusStripMarkup() {
    const archivedCount = DATA.scenarios.filter((scenario) => scenario.archived).length;
    const progress = STORE.s005Progress();
    const stages = Object.values(STORE.scenario("S005")?.stages || {});
    const next = stages.find((stage) => !["complete", "verified", "not_applicable"].includes(stage.status));
    const archivedPercent = Math.round(archivedCount / DATA.scenarios.length * 100);
    return `<section class="home-status-strip">
      <div class="scenario-identity"><span>五场景运行档案</span><strong>融资、预算、债务风险、贷前调查与投后评价</strong><small>S001—S004 已归档只读 · S005 数据截至 2026-07-17</small></div>
      <div class="scenario-progress"><div><span>归档状态</span><b>${archivedCount}/${DATA.scenarios.length}</b></div><i><i style="width:${archivedPercent}%"></i></i><small>S005 当前 ${progress.done}/${progress.total} 阶段</small></div>
      <div class="scenario-next"><span>当前状态</span><strong>S005 · ${progress.done}/${progress.total} 阶段已形成</strong><small>${next ? `下一项：${esc(next.title)}` : "当前轮次流程状态已全部形成"}</small></div>
      <button class="btn primary" type="button" data-route="#dashboard">查看仪表盘${icon("arrow-right", "sm")}</button>
    </section>`;
  }

  function homeSummaryMarkup() {
    const stages = Object.values(STORE.scenario("S005")?.stages || {});
    const next = stages.find((stage) => !["complete", "verified", "not_applicable"].includes(stage.status));
    const nextModule = DATA.modules.find((module) => module.ownerId === next?.moduleId) || DATA.moduleById.data;
    const progress = STORE.s005Progress();
    const activity = DATA.scenarios.map((scenario) => {
      const context = STORE.scenarioContext(scenario.id);
      const isArchived = Boolean(scenario.archived);
      const detail = isArchived
        ? `${scenario.id} 归档运行 · 数据截至 ${scenario.dataAsOf}`
        : `${scenario.id} 当前轮次 ${progress.done}/${progress.total} · ${shortRunId(context?.scenarioRunId)}`;
      return `<article class="activity-item"><i class="activity-dot ${isArchived ? "success" : "info"}"></i><div><strong>${esc(scenario.name)} · ${isArchived ? "已归档" : "进行中"}</strong><span>${esc(detail)}</span></div><time>${isArchived ? "只读" : "当前"}</time></article>`;
    }).join("");
    const blocked = next?.status === "blocked";
    return `<div class="home-summary-grid">
      <section class="panel"><div class="panel-head"><div><h2>当前事项</h2><p>只显示 S005 当前轮次下一项需要处理的状态。</p></div><span class="status-badge ${blocked ? "danger" : next ? "warning" : "success"}">${blocked ? "存在阻断" : next ? "待处理" : "当前无待处理"}</span></div><div class="home-blocker"><span class="blocker-icon ${next ? "" : "clear"}">${icon(next ? blocked ? "triangle-alert" : "clock-3" : "shield-check")}</span><div><strong>${esc(next?.title || "当前无待处理事项")}</strong><p>${next ? `${esc(next.moduleId)} · ${esc(next.status === "running" ? "处理中" : next.status === "blocked" ? "需处理阻断" : "等待业务操作")}` : "当前轮次七个业务阶段均已形成。"}</p></div><div><button class="btn" type="button" data-action="refresh-home">重新读取</button>${next ? `<button class="btn primary" type="button" data-route="${nextModule.route}">前往处理</button>` : ""}</div></div></section>
      <section class="panel"><div class="panel-head"><div><h2>场景运行记录</h2><p>五个场景分别保留自己的运行轮次和数据时点。</p></div></div><div class="activity-list compact">${activity}</div></section>
    </div>`;
  }

  function renderHome() {
    syncHomeDomainFromScenario();
    const domain = HOME_DOMAINS[homeDomain] || HOME_DOMAINS.foundation;
    const chain = DATA.modules.map((module) => {
      const resource = catalog().resourcesFor(module.id).find((item) => item.scenarioId === "S005") || null;
      const status = resourceStatus(resource?.status || "not_registered");
      const tone = status.tone === "success" ? "done" : status.tone === "warning" ? "observed" : status.tone === "info" ? "active" : "";
      return `<button class="home-chain-node ${tone}" type="button" data-route="${module.route}" title="进入${esc(module.name)}" aria-label="进入${esc(module.name)}，S005 ${esc(status.label)}"><span>${icon(module.icon, "sm")}</span><strong>${esc(module.name)}</strong><small>S005 · ${esc(status.label)}</small></button>`;
    }).join("");
    const content = `<div class="home-view scheme-a-home" data-screen-label="智财问策统一业务工作台"><div class="home-container">
      ${homeStatusStripMarkup()}
      <section class="classic-home-frame" data-home-domain="${homeDomain}">
        <div class="classic-architecture">
          <div class="architecture-intro"><div><span>${esc(DATA.brand.en)} · 平台能力架构</span><h1>从可信数据到可追溯行动</h1></div><p>数据、语义与行动沿同一证据链协作；首页只汇总进度并把工作带回对应业务模块。</p></div>
          <div class="architecture-cycle" aria-label="平台三大能力域">
            ${homeArchitecturePathMarkup()}
            ${Object.entries(HOME_DOMAINS).map(([key, item]) => `<button class="architecture-node ${key}${homeDomain === key ? " active" : ""}" type="button" data-action="home-domain" data-domain="${key}" aria-pressed="${homeDomain === key}"><span class="node-en">${esc(item.en)}</span>${icon(item.icon, "architecture-node-icon")}<span class="node-zh">${esc(item.name)}</span><small class="node-scope">${esc(item.scope)}</small></button>`).join("")}
            ${homeCoreGraphicMarkup()}
          </div>
          <div class="architecture-flow-summary" aria-live="polite"><span>当前关系</span><strong>${esc(domain.flow)}</strong><small>${esc(domain.flowDetail)}</small></div>
          <div class="architecture-foot" aria-label="能力域说明">
            <button class="${homeDomain === "foundation" ? "active" : ""}" type="button" data-action="home-domain" data-domain="foundation"><b>01 数据治理</b>数据源、数据管道、资产版本与质量。</button>
            <button class="${homeDomain === "intelligence" ? "active" : ""}" type="button" data-action="home-domain" data-domain="intelligence"><b>02 语义问数</b>业务定义、可信问数、报告、探索与建模。</button>
            <button class="${homeDomain === "action" ? "active" : ""}" type="button" data-action="home-domain" data-domain="action"><b>03 行动智能</b>行动申请、人工确认与受控协作。</button>
          </div>
        </div>
        <div class="classic-domain-detail" aria-live="polite"><div class="detail-kicker">${esc(domain.kicker)}</div><h2>${esc(domain.title)}</h2><p>${esc(domain.lead)}</p><div class="classic-domain-cards">${homeDomainCardsMarkup(domain)}</div><div class="domain-pager" aria-label="切换能力域">${homeDomainPagerMarkup()}</div></div>
        <nav class="home-chain-track" aria-label="八模块链路入口">${chain}</nav>
      </section>
      ${homeSummaryMarkup()}
      ${s005StageMarkup()}
      ${moduleDirectory()}
      ${unifiedResourcePanel()}
      <div class="workspace-note">首页只汇总各业务模块已保存的状态；配置、运行结果和正式结果分别保存，业务操作在相应模块内完成。</div>
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

  function breadcrumb(module) {
    return `<nav class="module-breadcrumb" aria-label="当前位置"><button type="button" data-route="#home">首页</button>${icon("chevron-right", "xs")}<button type="button" data-action="module-root" data-module-id="${module.id}">${esc(module.name)}</button>${icon("chevron-right", "xs")}<strong id="frame-breadcrumb-current">${esc(module.name)}首页</strong></nav>`;
  }

  function resourcePathForM07(scenarioId) {
    return `../resources/${String(scenarioId || "S005").toLowerCase()}.json`;
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
      applyContext(candidate, context);
      candidate.searchParams.set("v", "20260831-05");
      candidate.searchParams.set("embedded", "1");
      candidate.searchParams.set("resource", resourcePathForM07(context.scenarioId));
      return candidate;
    } catch (_) {
      return null;
    }
  }

  function frameSource(module) {
    const context = activeContext();
    const saved = STORE.activeScenario()?.navigation?.framePositions?.[module.id];
    const handoff = STORE.handoff(context?.scenarioRunId);
    if (context?.scenarioId === "S003" && S003_MODEL_CONSUMERS.has(module.id)) {
      const consumer = S003_MODEL_CONSUMERS.get(module.id);
      const url = applyContext(new URL("../modules/modeling/consumer/result-projection.html", global.location.href), context);
      url.searchParams.set("moduleId", consumer.moduleId);
      url.searchParams.set("consumerId", consumer.consumerId);
      url.searchParams.set("objectiveId", S003_OBJECTIVE_ID);
      url.searchParams.set("routeModuleId", module.id);
      url.searchParams.set("candidateBuild", "20260831-01");
      return `${url.pathname}${url.search}`;
    }
    if (context?.scenarioId === "S005" && S005_WORKBENCH_MODULES.has(module.id)) {
      const url = applyContext(new URL("../scenarios/s005/module-workbench.html", global.location.href), context);
      url.searchParams.set("moduleId", S005_WORKBENCH_MODULES.get(module.id));
      url.searchParams.set("candidateBuild", "20260831-05");
      return `${url.pathname}${url.search}`;
    }
    if (module.id === "m07") {
      const registration = catalog().resourcesFor("m07").find((item) => item.scenarioId === context.scenarioId);
      if (registration?.status === "not_registered") {
        const unavailable = applyContext(new URL("../modules/m07/module/unavailable.html", global.location.href), context);
        return `${unavailable.pathname}${unavailable.search}`;
      }
      const restored = handoff?.m07?.returnUrl ? safeM07ReturnUrl(handoff.m07.returnUrl, context) : null;
      const url = restored || applyContext(new URL(module.source, global.location.href), context);
      url.searchParams.set("embedded", "1");
      url.searchParams.set("resource", resourcePathForM07(context.scenarioId));
      if (!restored) url.searchParams.set("lens", "catalog");
      return `${url.pathname}${url.search}${url.hash}`;
    }
    if (module.id === "modeling") {
      const url = applyContext(new URL(module.source, global.location.href), context);
      url.searchParams.set("apiBase", API_BASE);
      url.hash = saved?.hash || module.rootHash || "#catalog";
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
    if (!url.hash) url.hash = module.rootHash || "";
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function renderModule(module) {
    const source = frameSource(module);
    const content = `<div class="module-view" data-screen-label="${esc(module.ownerId)} ${esc(module.name)}工作区">${breadcrumb(module)}<section class="frame-stage"><iframe id="module-frame" class="module-frame" data-module-id="${module.id}" data-scenario-id="${esc(activeContext()?.scenarioId)}" title="${esc(module.name)}" src="${esc(source)}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe></section></div>`;
    renderShell(content, { type: module.id === "dashboard" ? "dashboard" : "module", moduleId: module.id, active: module.id, key: module.id === "dashboard" ? "dashboard" : `module-${module.id}` });
    renderedModuleId = module.id;
    const frame = document.getElementById("module-frame");
    frame?.addEventListener("load", () => adaptFrame(frame, module));
  }

  function renderShell(content, route) {
    setTitle(route);
    const state = STORE.get();
    app.innerHTML = `<div class="platform-shell ${state.navCollapsed ? "nav-collapsed" : ""}" data-scenario-id="${esc(state.activeScenarioId)}">${navMarkup(route)}<section class="shell-main">${topbarMarkup(route)}<main class="route-stage">${content}</main></section></div>`;
    refreshIcons(app);
  }

  function render() {
    const route = parseRoute();
    if (route.type === "module") renderModule(DATA.moduleById[route.moduleId]);
    else if (route.type === "dashboard") renderModule(DATA.dashboard);
    else { renderedModuleId = null; renderHome(); }
    renderDrawer();
    renderModal();
  }

  function frameAdapterCss(moduleId) {
    const documentScroll = ["report", "dashboard"].includes(moduleId);
    const common = documentScroll
      ? "html,body{width:100%!important;min-height:100%!important;height:auto!important}html{overflow-y:auto!important;overflow-x:hidden!important}body{overflow:visible!important}"
      : "html,body{width:100%!important;height:100%!important}body{overflow:hidden!important}";
    const adapters = {
      data: ".app-shell{grid-template-columns:184px minmax(0,1fr)!important}.app-shell>.platform-rail{display:none!important}.app-shell>.product-nav{grid-column:1!important;grid-row:1!important}.app-shell>.app-workspace{grid-column:2!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important}.app-workspace>.topbar{display:none!important}@media(max-width:700px){.app-shell{grid-template-columns:minmax(0,1fr)!important}.app-shell>.product-nav{display:none!important}.app-shell>.app-workspace{grid-column:1!important}}",
      ontology: ".app-shell{grid-template-columns:184px minmax(0,1fr)!important}.app-shell>.platform-rail{display:none!important}.app-shell>.product-nav{grid-column:1!important;grid-row:1!important}.app-shell>.app-workspace{grid-column:2!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important}.app-workspace>.topbar{display:none!important}@media(max-width:700px){.app-shell{grid-template-columns:minmax(0,1fr)!important}.app-shell>.product-nav{display:none!important}.app-shell>.app-workspace{grid-column:1!important}}",
      query: ".app-shell{grid-template-columns:184px minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important}.app-shell>.platform-rail{display:none!important}.app-shell>.product-nav{grid-column:1!important;grid-row:1!important}.app-shell>.app-workspace{grid-column:2!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important}.app-workspace>.topbar{display:none!important}@media(max-width:700px){.app-shell{grid-template-columns:minmax(0,1fr)!important}.app-shell>.product-nav{display:none!important}.app-shell>.app-workspace{grid-column:1!important}}",
      decision: ".decision-app{grid-template-columns:184px minmax(0,1fr)!important;grid-template-rows:minmax(0,1fr)!important}.decision-app>.app-rail{display:none!important}.decision-app>.product-nav{grid-column:1!important;grid-row:1!important}.decision-app>.app-workspace{grid-column:2!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important}.decision-app>.app-workspace>.app-topbar{display:none!important}@media(max-width:760px){.decision-app{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:60px minmax(0,1fr)!important}.decision-app>.product-nav{grid-column:1!important;grid-row:1!important}.decision-app>.app-workspace{grid-column:1!important;grid-row:2!important}}",
      agent: ".app-shell{grid-template-columns:188px minmax(0,1fr)!important}.app-shell>.platform-rail{display:none!important}.app-shell>.product-nav{grid-column:1!important;grid-row:1!important}.app-shell>.workspace{grid-column:2!important;grid-row:1!important;grid-template-rows:minmax(0,1fr)!important}.app-shell>.workspace>.topbar{display:none!important}@media(max-width:700px){.app-shell{grid-template-columns:minmax(0,1fr)!important}.app-shell>.product-nav{display:none!important}.app-shell>.workspace{grid-column:1!important}}",
      report: ".app-shell{grid-template-columns:190px minmax(0,1fr)!important}.app-shell>.platform-rail{display:none!important}.app-shell>.product-nav{grid-column:1!important;grid-row:1!important}.app-shell>.app-workspace{grid-column:2!important;grid-row:1!important}.app-workspace>.topbar{display:none!important}@media(max-width:700px){.app-shell{grid-template-columns:minmax(0,1fr)!important}.app-shell>.product-nav{display:none!important}.app-shell>.app-workspace{grid-column:1!important}}",
      dashboard: ".app-shell>.platform-rail,.dashboard-shell>.platform-rail,.dashboard-shell>.global-nav{display:none!important}.app-shell>.topbar,.dashboard-shell>.topbar{display:none!important}"
    };
    return `${common}${adapters[moduleId] || ""}`;
  }

  function scrubInternalCopy(doc) {
    if (!doc?.body || !doc.body.isConnected) return;
    const replacements = [
      ["\u4ea4\u4e92\u539f\u578b", "\u4e1a\u52a1\u5de5\u4f5c\u53f0"], ["\u539f\u578b", "\u5de5\u4f5c\u53f0"],
      ["\u6f14\u793a\u73af\u5883", "\u4e1a\u52a1\u5de5\u4f5c\u533a"], ["\u6f14\u793a\u6570\u636e", "\u4e1a\u52a1\u6570\u636e"],
      ["\u7814\u7a76\u5939\u5177", "\u53c2\u8003\u6570\u636e"], ["\u5408\u6210\u9884\u89c8", "\u7ed3\u679c\u9884\u89c8"],
      ["\u7814\u7a76\u670d\u52a1", "\u6a21\u578b\u670d\u52a1"], ["\u7814\u7a76\u89d2\u8272\u6a21\u62df", "\u89d2\u8272\u89c6\u56fe"],
      ["\u7edf\u4e00\u539f\u578b\u5165\u53e3", "\u7edf\u4e00\u5de5\u4f5c\u53f0"], ["\u65b9\u6848\u8bf4\u660e", "\u4e1a\u52a1\u8bf4\u660e"],
      ["\u8bc4\u5ba1\u73af\u5883", "\u4e1a\u52a1\u5de5\u4f5c\u533a"]
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
    if (!node) return;
    try {
      const doc = frame.contentDocument;
      const heading = [...doc.querySelectorAll("main h1,.page-header h1,.page-heading h1,.m07-workspace h1,.m08-content h1")].map((item) => item.textContent.trim()).find(Boolean);
      node.textContent = heading || module.name;
    } catch (_) { node.textContent = module.name; }
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
        projection: activeResourceProjection("modeling"),
        explorationHandoff: handoff?.m07?.context || null,
        modelingWorkspace: STORE.modelingWorkspace(context.scenarioId),
        modelingReturnContext: STORE.modelingReturnContext(context.scenarioId)
      }
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
    const focused = subjects.find((subject) => (subject.objectId || subject.enterpriseId) === exploration.objectRef.id);
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
    frame.contentWindow.postMessage({ type: "OFW_M08_RETURN_TO_M07", targetModuleId: "m07", payload: handoff?.m08Return || payload }, global.location.origin);
  }

  function isS005Workbench(module) {
    return activeContext()?.scenarioId === "S005" && S005_WORKBENCH_MODULES.has(module?.id);
  }

  function isS003ModelConsumer(module) {
    return activeContext()?.scenarioId === "S003" && S003_MODEL_CONSUMERS.has(module?.id);
  }

  function deliverModelingConsumerContext(frame, module) {
    const consumer = S003_MODEL_CONSUMERS.get(module?.id);
    const context = activeContext();
    if (!consumer || context?.scenarioId !== "S003" || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({
      type: "OFW_MODELING_CONSUMER_CONTEXT",
      consumerId: consumer.consumerId,
      scenarioContext: context,
      projection: STORE.modelingProjection("S003", consumer.consumerId)
    }, global.location.origin);
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

  function deliverS005ModuleContext(frame, module) {
    const ownerId = S005_WORKBENCH_MODULES.get(module?.id);
    const context = activeContext();
    if (!ownerId || context?.scenarioId !== "S005" || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({
      type: "OFW_S005_MODULE_CONTEXT",
      moduleId: ownerId,
      scenarioContext: context,
      payload: STORE.s005ModuleProjection(ownerId)
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
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      doc.title = `${module.name} · ${DATA.brand.zh}`;
      if (!["m07", "modeling"].includes(module.id) && !isS005Workbench(module) && !isS003ModelConsumer(module)) {
        let style = doc.getElementById("ofw-v120-shell-adapter");
        if (!style) { style = doc.createElement("style"); style.id = "ofw-v120-shell-adapter"; doc.head.appendChild(style); }
        style.textContent = frameAdapterCss(module.id);
      }
      scrubInternalCopy(doc);
      syncFrameBreadcrumb(frame, module);
      const saved = STORE.activeScenario()?.navigation?.framePositions?.[module.id];
      if (saved) requestAnimationFrame(() => {
        try {
          frame.contentWindow.scrollTo(0, saved.windowY || 0);
          const scroller = doc.querySelector(".main,.screen-stage,.page-shell,.workspace-main,.primary-pane,[data-scroll-container]");
          if (scroller) scroller.scrollTop = saved.containerY || 0;
        } catch (_) {}
      });
      doc.addEventListener("click", () => {
        clearTimeout(frameSaveTimer);
        frameSaveTimer = setTimeout(() => { captureFramePosition(); syncFrameBreadcrumb(frame, module); scrubInternalCopy(doc); }, 180);
      }, true);
      doc.addEventListener("scroll", () => {
        clearTimeout(frameSaveTimer);
        frameSaveTimer = setTimeout(captureFramePosition, 160);
      }, true);
      frame.contentWindow.addEventListener("hashchange", () => setTimeout(() => syncFrameBreadcrumb(frame, module), 60));
      if (module.id === "modeling") deliverM08Context(frame);
      if (module.id === "m07") deliverM08Return(frame);
      if (isS005Workbench(module)) deliverS005ModuleContext(frame, module);
      if (isS003ModelConsumer(module)) deliverModelingConsumerContext(frame, module);
      if (module.id === "dashboard") deliverS005DashboardContext(frame);
      if (module.id === "dashboard") deliverS003DashboardContext(frame);
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
        hash: frame.contentWindow.location.hash,
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
    const context = activeContext();
    const raw = message.context || message.payload || {};
    if (!context || message.scenarioId && message.scenarioId !== context.scenarioId) throw new Error("M07 交接场景与当前场景不一致。");
    let objectRef = raw.objectRef || null;
    if (context.scenarioId === "S005" && objectRef) {
      const matching = catalog().resources.find((resource) => resource.scenarioId === "S005" && resource.objectRef && (resource.objectRef.id === objectRef.id || resource.objectRef.title === objectRef.title));
      if (matching?.objectRef) objectRef = clonePlain(matching.objectRef);
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
    return STORE.recordS005ModuleEvent({
      moduleId: "M07",
      operation: "exploration_result",
      scenarioContext: message.scenarioContext,
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
    if (context.scenarioId === "S005") {
      if (!message.explorationResultEnvelope) throw new Error("S005 打开 M08 必须携带可验证的 M07 探索结果包络。");
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
    navigate("#module/modeling");
  }

  function handleM08Return(message) {
    const context = activeContext();
    const payload = clonePlain(message.payload || {});
    if (!context) throw new Error("M08 返回时没有当前场景身份。");
    const validated = STORE.validateM08Return(payload);
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
    showToast("上下文已返回", "已恢复多视图探索的对象、视图和读取位置。", "success");
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
    if (event.origin !== global.location.origin) return;
    const frame = document.getElementById("module-frame");
    if (!frame || event.source !== frame.contentWindow) return;
    const message = event.data || {};
    try {
      if (renderedModuleId === "m07" && message.type === "OFW_S005_M07_EXPLORATION_RESULT") {
        recordS005M07Exploration(message);
        showToast("探索结果已固定", "M07 当前对象、Lens、版本和证据已回传。", "success");
        return;
      }
      if (message.type === "OFW_S005_MODULE_READY" && isS005Workbench(DATA.moduleById[renderedModuleId])) {
        deliverS005ModuleContext(frame, DATA.moduleById[renderedModuleId]);
        return;
      }
      if (message.type === "OFW_M07_READY" && renderedModuleId === "m07") {
        const context = activeContext();
        if (!message.scenarioContext || !["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => message.scenarioContext[field] === context?.[field])) throw new Error("M07 ready 回传场景身份不一致。");
        deliverM08Return(frame);
        return;
      }
      if (message.type === "OFW_MODELING_CONSUMER_READY" && isS003ModelConsumer(DATA.moduleById[renderedModuleId])) {
        deliverModelingConsumerContext(frame, DATA.moduleById[renderedModuleId]);
        return;
      }
      if (message.type === "OFW_S003_MODELING_CONTEXT_REQUEST" && renderedModuleId === "dashboard" && activeContext()?.scenarioId === "S003") {
        deliverS003DashboardContext(frame);
        return;
      }
      if (message.type === "OFW_DASHBOARD_SCENARIO_FOCUS" && renderedModuleId === "dashboard" && DATA.scenarioById[message.scenarioId]) {
        if (STORE.get().activeScenarioId === message.scenarioId) {
          if (message.scenarioId === "S003") deliverS003DashboardContext(frame);
          return;
        }
        const hash = frame.contentWindow?.location?.hash || "#/dashboards";
        STORE.saveFramePosition("dashboard", { hash, windowY: 0, containerY: 0 }, message.scenarioId);
        STORE.setActiveScenario(message.scenarioId, "dashboard-focus");
        history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId: message.scenarioId }, "", "#dashboard");
        render();
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
      if (message.type === "OFW_S005_MODULE_RESULT" && isS005Workbench(DATA.moduleById[renderedModuleId])) {
        const expectedOwnerId = S005_WORKBENCH_MODULES.get(renderedModuleId);
        if (message.schemaVersion !== "ofw.s005.module-result.v1" || message.moduleId !== expectedOwnerId) throw new Error("模块结果包络与当前模块不一致。");
        if (!message.result?.clientResultId || !message.result?.outputKind || !message.result?.status || !message.result?.producedAt || !message.result?.evidenceRefs?.length) throw new Error("模块结果缺少可验证标识、状态、时间或证据。");
        const receipt = STORE.recordS005ModuleEvent({
          moduleId: message.moduleId,
          operation: message.operation,
          scenarioContext: message.scenarioContext,
          occurredAt: message.result.producedAt,
          payload: message.result
        });
        deliverS005ModuleContext(frame, DATA.moduleById[renderedModuleId]);
        showToast("模块结果已形成", `${message.moduleId} · ${receipt.progress.done}/${receipt.progress.total}`, "success");
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
        if (message.scenarioId && message.scenarioId !== STORE.get().activeScenarioId) throw new Error("模块跳转场景不一致。");
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
        if (route === "#dashboard" || /^#module\/[a-z0-9-]+$/.test(route || "")) navigate(route);
      }
    } catch (error) {
      if (message.type === "OFW_S005_MODULE_RESULT") {
        frame.contentWindow.postMessage({ type: "OFW_S005_MODULE_ERROR", moduleId: message.moduleId, message: error.message }, global.location.origin);
      }
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
    const scenario = activeDefinition();
    const context = activeContext();
    const state = STORE.activeScenario();
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="resource-drawer context-drawer" role="dialog" aria-modal="true" aria-labelledby="context-title"><header><div><span>当前场景上下文</span><h2 id="context-title">${esc(scenario.id)} · ${esc(scenario.name)}</h2><p>${esc(scenario.businessDomain)}</p></div><button class="icon-button" type="button" data-action="close-drawer" aria-label="关闭">${icon("x")}</button></header><div class="drawer-body"><dl class="resource-facts"><div><dt>scenarioVersion</dt><dd>${esc(context?.scenarioVersion)}</dd></div><div><dt>scenarioRunId</dt><dd class="mono-wrap">${esc(context?.scenarioRunId)}</dd></div><div><dt>formedAt</dt><dd>${esc(context?.formedAt)}</dd></div><div><dt>status</dt><dd>${esc(context?.status)}</dd></div><div><dt>历史轮次</dt><dd>${state?.runHistory?.length || 0}</dd></div></dl><p class="context-note">模块只读取当前场景身份；配置、运行输入和结果分别保存。归档场景不会被当前运行重置覆盖。</p></div><footer><button class="btn primary" type="button" data-action="close-drawer">完成</button></footer></aside></div>`;
  }

  function renderDrawer() {
    if (drawerResourceId === "__context__") drawerRoot.innerHTML = contextDrawerMarkup();
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
  }

  function resetModalMarkup() {
    if (modalKind !== "reset") return "";
    const scenario = activeDefinition();
    const context = activeContext();
    const archived = scenario.archived;
    return `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><span>${icon(archived ? "archive" : "rotate-ccw")}</span><div><h2 id="modal-title">${archived ? "归档场景受保护" : "重置当前场景运行"}</h2><p>${esc(scenario.id)} · ${esc(scenario.name)}</p></div><button class="icon-button" type="button" data-action="close-modal" aria-label="关闭">${icon("x")}</button></header><div class="modal-body"><div class="reset-notice ${archived ? "protected" : ""}">${icon(archived ? "shield-check" : "triangle-alert")}<div><strong>${archived ? "不会改写已归档状态" : "只重置当前 S005 轮次"}</strong><span>${archived ? "可以清除当前场景的导航、筛选和滚动位置；归档运行、资产和证据保持不变。" : `当前轮次 ${esc(shortRunId(context?.scenarioRunId))} 将封存，新轮次从待开始状态建立；S001—S004 和其他模块记录不会被修改。`}</span></div></div></div><footer><button class="btn" type="button" data-action="close-modal">取消</button><button class="btn" type="button" data-action="reset-browsing">重置浏览位置</button>${archived ? "" : `<button class="btn danger" type="button" data-action="confirm-reset">重置当前运行</button>`}</footer></section></div>`;
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
    toastRegion.appendChild(toast);
    refreshIcons(toast);
    setTimeout(() => toast.remove(), 3800);
  }

  function applyResource(resourceId) {
    const resource = catalog().resource(resourceId);
    if (!resource) return;
    const previousScenario = STORE.get().activeScenarioId;
    STORE.selectResource(resource.moduleId, resource.id, resource.scenarioId);
    closeDrawer();
    history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId: resource.scenarioId }, "", resource.moduleId === "dashboard" ? "#dashboard" : `#module/${resource.moduleId}`);
    render();
    showToast("资源已带入", `${resource.scenarioId} · ${resource.name}${previousScenario === resource.scenarioId ? "" : "，场景上下文已同步"}`, "success");
  }

  function refreshHomeResourceRows() {
    const container = document.getElementById("home-resource-results");
    if (container) { container.innerHTML = homeResourceRows(); refreshIcons(container); }
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) { navigate(routeButton.dataset.route); return; }
    const resourceButton = event.target.closest("[data-resource-id]");
    if (resourceButton && !resourceButton.closest("[data-action='use-resource']")) { openResource(resourceButton.dataset.resourceId); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === "toggle-navigation") { STORE.toggleNavigation(); render(); }
    if (action === "return") returnToPrevious();
    if (action === "home-domain") selectHomeDomain(actionButton.dataset.domain);
    if (action === "refresh-home") renderHome();
    if (action === "open-context") { drawerResourceId = "__context__"; renderDrawer(); }
    if (action === "close-drawer" && (event.target === actionButton || actionButton.closest(".resource-drawer"))) closeDrawer();
    if (action === "reload-frame") document.getElementById("module-frame")?.contentWindow?.location.reload();
    if (action === "module-root") {
      const module = actionButton.dataset.moduleId === "dashboard" ? DATA.dashboard : DATA.moduleById[actionButton.dataset.moduleId];
      const frame = document.getElementById("module-frame");
      if (frame && module) {
        if (["m07", "modeling"].includes(module.id)) frame.src = frameSource(module);
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
    if (action === "confirm-reset") {
      const receipt = STORE.resetCurrentScenario();
      closeModal();
      history.replaceState({ ofwShell: true, scenarioId: "S005", ofwDepth: 0 }, "", "#home");
      render();
      showToast("当前运行已重置", `新轮次 ${shortRunId(receipt.scenarioRunId)}；已保留 ${receipt.preservedHistoricalRuns} 个历史轮次。`, "success");
    }
    if (action === "use-resource") applyResource(actionButton.dataset.resourceId);
    if (action === "focus-scenario") {
      homeFilters.scenarioId = actionButton.dataset.scenarioId;
      refreshHomeResourceRows();
      document.querySelector("[data-home-scenario]")?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      const select = document.querySelector("[data-home-scenario]");
      if (select) select.value = homeFilters.scenarioId;
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-home-query]")) { homeFilters.query = event.target.value; refreshHomeResourceRows(); }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-home-scenario]")) { homeFilters.scenarioId = event.target.value; refreshHomeResourceRows(); }
    if (event.target.matches("[data-home-module]")) { homeFilters.moduleId = event.target.value; refreshHomeResourceRows(); }
  });

  global.addEventListener("message", handleFrameMessage);
  global.addEventListener("popstate", (event) => {
    captureFramePosition();
    if (event.state?.scenarioId && event.state.scenarioId !== STORE.get().activeScenarioId && DATA.scenarioById[event.state.scenarioId]) STORE.setActiveScenario(event.state.scenarioId, "history");
    closeDrawer(); closeModal(); render();
  });
  global.addEventListener("hashchange", () => { closeDrawer(); closeModal(); render(); });
  global.addEventListener("beforeunload", () => { captureFramePosition(); captureHomePosition(); });
  global.addEventListener("storage", (event) => { if (event.key === STORE.STORAGE_KEY) global.location.reload(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDrawer(); closeModal(); } });

  if (!global.location.hash) history.replaceState({ ofwShell: true, scenarioId: STORE.get().activeScenarioId, ofwDepth: 0 }, "", "#home");
  else if (!history.state?.ofwShell) history.replaceState({ ...(history.state || {}), ofwShell: true, scenarioId: STORE.get().activeScenarioId, ofwDepth: 0 }, "", global.location.href);
  render();
})(window);
