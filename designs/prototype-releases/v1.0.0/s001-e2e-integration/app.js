(function () {
  "use strict";

  const DATA = window.S001_DATA;
  const STORE = window.S001_STORE;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");

  let modalState = null;
  let renderedModuleId = null;
  let frameObserver = null;
  let frameSaveTimer = null;
  let homeScrollSaveTimer = null;
  let storageRefreshTimer = null;
  let homeDomain = "foundation";
  let homeOrbitTurn = 0;
  let suppressHomeDomainStateRender = false;

  const HOME_DOMAIN_ORDER = ["foundation", "intelligence", "action"];
  const HOME_DOMAINS = {
    foundation: {
      order: "01", en: "可信数据", name: "数据治理", icon: "database", modules: ["data", "ontology"],
      kicker: "数据治理 · 可信底座", title: "把持续变化的数据，治理成稳定、可追溯的业务基础",
      lead: "数据工程负责来源、管道、数据资产与质量；本体管理负责业务对象、关系、指标、规则和行动类型。两者共同形成可被后续环节稳定引用的业务基础。",
      core: "数据治理 · 语义问数 · 行动智能"
    },
    intelligence: {
      order: "02", en: "可信理解", name: "语义问数", icon: "insight", modules: ["query", "report"],
      kicker: "语义问数 · 可信理解", title: "让每次问数与报告都能回到明确的数据和业务定义",
      lead: "智能问数在固定上下文中回答问题；报告中心负责确定性核验、正式发布和当前数据比较。答案与报告始终保留版本与来源。",
      core: "数据治理 · 语义问数 · 行动智能"
    },
    action: {
      order: "03", en: "受控协作", name: "行动智能", icon: "action", modules: ["decision", "agent"],
      kicker: "行动智能 · 受控闭环", title: "让洞察进入人的判断，再形成清晰、可追溯的行动",
      lead: "Agent 应用解释固定证据；决策中心承接行动申请、人工确认和负责人待办。任何环节都不能绕过人工确认直接形成待办。",
      core: "数据治理 · 语义问数 · 行动智能"
    }
  };

  const icons = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"/>',
    sparkles: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm14-2 .7 1.8 1.8.7-1.8.7L19 16l-.7-1.8-1.8-.7 1.8-.7L19 12Z"/>',
    insight: '<path d="M4 19V9m5 10V5m6 14v-7m5 7V3"/><path d="m3 13 6-5 6 2 6-6"/>',
    action: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="7" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="20" cy="19" r="2"/><circle cx="4" cy="19" r="2"/><path d="m6 8 3.5 2m5 0 3.5-4m-3.5 8 3.5 4m-8.5-4L6 18"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15.5 8.5 5-5M17 3h3.5v3.5"/>',
    bot: '<rect x="5" y="7" width="14" height="11" rx="2"/><path d="M12 3v4M8.5 12h.01M15.5 12h.01M9 15h6M3 11v4M21 11v4"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    reset: '<path d="M4.9 5.9A9 9 0 1 1 3 12"/><path d="M3 4v6h6"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 9h.01M18 13h.01"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
    building: '<path d="M4 21V6l8-3v18M12 9h8v12M2 21h20M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
  };

  function icon(name, className = "") {
    return `<span class="icon ${className}" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.dots}</svg></span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function htmlElement(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function parseRoute() {
    const hash = window.location.hash || "#home";
    if (hash === "#home" || hash === "#/" || hash === "#") return { type: "home", active: "home", key: "home" };
    if (hash === "#dashboard") return { type: "dashboard", active: "dashboard", key: "dashboard" };
    const moduleMatch = hash.match(/^#module\/(data|ontology|query|decision|agent|report)$/);
    if (moduleMatch) return { type: "module", moduleId: moduleMatch[1], active: moduleMatch[1], key: `module-${moduleMatch[1]}` };
    return { type: "home", active: "home", key: "home" };
  }

  function projection() {
    try {
      return STORE.getProjection?.() || { steps: {} };
    } catch (_) {
      return { steps: {} };
    }
  }

  function rawStep(stepId) {
    const current = projection();
    return current.steps?.[stepId] || current[stepId] || {};
  }

  function stepState(stepId) {
    const record = rawStep(stepId);
    if (record.complete === true) return "complete";
    const value = String(record.state || record.status || "pending").toLowerCase();
    if (["complete", "completed", "verified", "success", "done"].includes(value)) return "complete";
    if (["observed", "unlinked", "detected"].includes(value)) return "observed";
    if (["running", "processing", "checking", "queued"].includes(value)) return "running";
    if (["failed", "failure", "error"].includes(value)) return "failed";
    if (["blocked", "unverifiable", "unknown", "stale"].includes(value)) return "blocked";
    return "pending";
  }

  function isComplete(stepId) {
    return typeof STORE.isComplete === "function" ? Boolean(STORE.isComplete(stepId)) : stepState(stepId) === "complete";
  }

  function completedCount() {
    return DATA.workflow.filter((step) => isComplete(step.id)).length;
  }

  function firstIncomplete() {
    const candidate = STORE.firstIncomplete?.();
    if (typeof candidate === "string") return DATA.stepById[candidate] || null;
    if (candidate?.id) return DATA.stepById[candidate.id] || candidate;
    return DATA.workflow.find((step) => !isComplete(step.id)) || null;
  }

  function moduleProgress(module) {
    const reported = STORE.moduleProgress?.(module.id) || STORE.moduleProgress?.(module);
    if (reported && Number.isFinite(reported.done) && Number.isFinite(reported.total)) return reported;
    const done = module.steps.filter(isComplete).length;
    const observed = module.steps.filter((id) => stepState(id) === "observed").length;
    return { done, observed, total: module.steps.length, complete: done === module.steps.length };
  }

  function statusMeta(state) {
    return {
      complete: { label: "已确认", tone: "success", icon: "check" },
      observed: { label: "待关联", tone: "warning", icon: "link" },
      running: { label: "处理中", tone: "info", icon: "refresh" },
      failed: { label: "未通过", tone: "danger", icon: "alert" },
      blocked: { label: "暂不可继续", tone: "warning", icon: "alert" },
      pending: { label: "待开始", tone: "", icon: "clock" }
    }[state] || { label: "待开始", tone: "", icon: "clock" };
  }

  function recordDetail(stepId) {
    const step = DATA.stepById[stepId];
    const record = rawStep(stepId);
    return record.detail || record.reason || record.message || record.summary || step?.summary || "等待在相应模块中完成。";
  }

  function recordAt(stepId) {
    const record = rawStep(stepId);
    return record.at || record.observedAt || record.updatedAt || record.completedAt || "";
  }

  function stateDataAsOf() {
    const current = projection();
    return current.meta?.dataAsOf || current.dataAsOf || STORE.get().context.dataAsOf || activeScenario().dataAsOf;
  }

  function enabledScenarios() {
    const registry = Array.isArray(DATA.scenarioRegistry) ? DATA.scenarioRegistry : [DATA.scenario];
    return registry.filter((scenario) => scenario?.id && scenario.enabled !== false);
  }

  function activeScenario() {
    const scenarioId = STORE.get().activeScenarioId || STORE.getScenario?.()?.scenarioId || DATA.scenario.id;
    return DATA.scenarioById?.[scenarioId] || enabledScenarios().find((scenario) => scenario.id === scenarioId) || DATA.scenario;
  }

  function activeScenarioContext() {
    return STORE.getScenarioContext?.(activeScenario().id) || STORE.getScenario?.(activeScenario().id)?.scenarioContext || null;
  }

  function sourceWithScenarioContext(source) {
    const context = activeScenarioContext();
    if (!context) return source;
    try {
      const url = new URL(source, window.location.href);
      if (url.pathname.endsWith("/agent-application/Agent%E5%BA%94%E7%94%A8.html") || url.pathname.endsWith("/agent-application/Agent应用.html")) {
        url.searchParams.set("prototypeBuild", "20260814-17");
      }
      const fields = {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        formedAt: context.formedAt,
        status: context.status,
        contextCreatedAt: context.formedAt,
        contextStatus: context.status,
        scenarioFormedAt: context.formedAt,
        scenarioStatus: context.status
      };
      Object.entries(fields).forEach(([key, value]) => url.searchParams.set(key, value));
      return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
    } catch (_) {
      return source;
    }
  }

  function deliverScenarioContextToFrame(frame, module) {
    const context = STORE.publishScenarioContext?.(activeScenario().id, false) || activeScenarioContext();
    if (!frame?.contentWindow || !context || !["data", "ontology"].includes(module.id)) return;
    const targetModule = module.id === "data" ? "数据工程" : "本体管理";
    const payload = module.id === "ontology" ? STORE.getScenarioContextEnvelope?.(context.scenarioId) : context;
    if (!payload) return;
    frame.contentWindow.postMessage({
      channel: STORE.HANDOFF_CHANNEL || "ontology3.0-s001-handoff-v1",
      targetModule,
      operation: "deliverScenarioContext",
      requestId: `C033-${context.scenarioRunId}-${module.id}`,
      payload
    }, window.location.origin);
  }

  function scenarioWorkspaceMarkup() {
    const scenarios = enabledScenarios();
    const current = activeScenario();
    if (scenarios.length < 2) {
      return `<div class="scenario-workspace" aria-label="当前场景"><span>当前场景 · ${escapeHtml(current.id)}</span><strong>${escapeHtml(current.name)}</strong></div>`;
    }
    return `<label class="scenario-workspace scenario-select"><span>当前场景</span><select data-action="switch-scenario" aria-label="切换当前场景">${scenarios.map((scenario) => `<option value="${escapeHtml(scenario.id)}" ${scenario.id === current.id ? "selected" : ""}>${escapeHtml(scenario.id)} · ${escapeHtml(scenario.name)}</option>`).join("")}</select></label>`;
  }

  function setDocumentTitle(route) {
    const page = route.type === "module" ? DATA.moduleById[route.moduleId].name : route.type === "dashboard" ? "仪表盘" : "首页";
    document.title = route.type === "home" ? DATA.brand.full : `${page} · ${DATA.brand.zh}`;
  }

  function navigate(route, options = {}) {
    captureFramePosition();
    captureHomePosition();
    closeModal();
    const scenario = activeScenario();
    const currentDepth = Number(history.state?.s001Depth || 0);
    STORE.saveNavigationContext?.({
      lastRoute: route,
      returnRoute: window.location.hash || "#home",
      moduleId: route.match?.(/^#module\/(.+)$/)?.[1] || null,
      scenarioId: scenario.id
    });
    const nextState = { ...(history.state || {}), s001Shell: true, scenarioId: scenario.id, s001Depth: options.replace ? currentDepth : currentDepth + 1 };
    if (options.replace) history.replaceState(nextState, "", route);
    else history.pushState(nextState, "", route);
    render();
  }

  function returnToPrevious() {
    const depth = Number(history.state?.s001Depth || 0);
    if (depth > 0) history.back();
    else navigate("#home", { replace: true });
  }

  function topbar(route) {
    const done = completedCount();
    const next = firstIncomplete();
    const scenario = activeScenario();
    const currentName = route.type === "module" ? DATA.moduleById[route.moduleId].name : route.type === "dashboard" ? "仪表盘" : "首页";
    return `<header class="global-topbar">
      <div class="top-title">${route.type === "home" ? "" : `<button class="top-icon-button" type="button" data-action="return-context" title="返回上一位置" aria-label="返回上一位置">${icon("back", "sm")}</button>`}${icon(route.type === "dashboard" ? "chart" : route.type === "module" ? DATA.moduleById[route.moduleId].icon : "home")}
        <div class="top-title-copy"><span>统一工作台</span><strong>${currentName}</strong></div>
      </div>
      ${scenarioWorkspaceMarkup()}
      <div class="top-actions">
        <button class="flow-trigger" type="button" data-action="open-flow" aria-label="打开 ${escapeHtml(scenario.id)} 链路进度">
          ${icon("layers", "sm")}<span><b>链路进度 · ${done}/${DATA.workflow.length}</b><small>${next ? `下一步：${next.title}` : "全部来源状态已确认"}</small></span><i><i style="width:${Math.round((done / DATA.workflow.length) * 100)}%"></i></i>
        </button>
        <button class="top-action" type="button" data-action="open-reset" aria-label="重置当前场景" title="重置当前场景">${icon("reset", "sm")}<span>重置当前场景</span></button>
        <div class="user-account" title="当前账号"><span class="user-avatar">管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function navigation(route) {
    const state = STORE.get();
    const scenario = activeScenario();
    const done = completedCount();
    const next = firstIncomplete();
    return `<aside class="global-nav">
      <button class="brand-lockup" type="button" data-action="toggle-navigation" aria-label="${state.navCollapsed ? "展开主菜单" : "收起主菜单"}" title="${state.navCollapsed ? "展开主菜单" : "收起主菜单"}">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><div><strong>${DATA.brand.zh}</strong><small>${DATA.brand.en}</small></div>
      </button>
      <div class="nav-context"><span>当前场景</span><strong>${escapeHtml(scenario.id)} · ${escapeHtml(scenario.name)}</strong></div>
      <nav class="primary-nav" aria-label="一级导航">
        ${DATA.nav.map((item) => {
          const module = DATA.moduleById[item.id];
          const progress = module ? moduleProgress(module) : null;
          const itemDone = module ? progress.complete : item.id === "dashboard" ? isComplete("publish") : false;
          const itemObserved = module ? !itemDone && (progress.observed || 0) > 0 : false;
          return `<button class="nav-item ${route.active === item.id ? "active" : ""}" type="button" data-route="${item.route}" title="${item.name}">
            ${icon(item.icon)}<span>${item.name}</span>${item.id === "home" ? "" : `<i class="nav-state ${itemDone ? "done" : itemObserved ? "observed" : ""}" aria-hidden="true"></i>`}
          </button>`;
        }).join("")}
      </nav>
      <div class="nav-foot"><div><i class="connection-dot ${done ? "active" : ""}"></i><strong>${done}/${DATA.workflow.length} 项来源状态已确认</strong></div><p>${next ? `下一步：${next.title}` : "本次链路状态已全部确认"}</p></div>
    </aside>`;
  }

  function patchStableShell(route) {
    const nav = app.querySelector(".global-nav");
    const top = app.querySelector(".global-topbar");
    const view = app.querySelector(".module-view");
    const shell = app.querySelector(".platform-shell");
    if (!nav || !top || !view || !shell) return false;
    nav.replaceWith(htmlElement(navigation(route)));
    top.replaceWith(htmlElement(topbar(route)));
    shell.className = `platform-shell ${STORE.get().navCollapsed ? "nav-collapsed" : ""}`.trim();
    shell.dataset.scenarioId = activeScenario().id;
    setDocumentTitle(route);
    return true;
  }

  function renderShell(content, route, options = {}) {
    setDocumentTitle(route);
    const sameRoute = app.dataset.routeKey === route.key;
    const sameFrameMode = app.dataset.frameMode === (options.frameMode || "");
    if (options.preserveFrame && sameRoute && sameFrameMode && patchStableShell(route)) return false;
    if (frameObserver) { frameObserver.disconnect(); frameObserver = null; }
    app.innerHTML = `<div class="platform-shell ${STORE.get().navCollapsed ? "nav-collapsed" : ""}" data-scenario-id="${escapeHtml(activeScenario().id)}">${navigation(route)}<section class="shell-main">${topbar(route)}<main class="route-stage">${content}</main></section></div>`;
    app.dataset.routeKey = route.key;
    app.dataset.frameMode = options.frameMode || "";
    return true;
  }

  function syncHomeDomainFromScenario() {
    if (typeof STORE.getScenario !== "function") return;
    const scenario = STORE.getScenario() || {};
    const home = scenario.home || scenario.homepage || scenario.homeSummary || {};
    const savedDomain = home.selectedDomain
      || home.activeDomain
      || home.selectedCapabilityDomain
      || scenario.homeDomain;
    const nextDomain = HOME_DOMAINS[savedDomain] ? savedDomain : "foundation";
    const nextIndex = HOME_DOMAIN_ORDER.indexOf(nextDomain);
    const savedTurn = home.orbitTurn ?? home.turn ?? scenario.homeOrbitTurn;
    let nextTurn = Number.isFinite(Number(savedTurn)) ? Math.max(0, Math.trunc(Number(savedTurn))) : nextIndex;
    const remainder = ((nextTurn % HOME_DOMAIN_ORDER.length) + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    if (remainder !== nextIndex) nextTurn += (nextIndex - remainder + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    homeDomain = nextDomain;
    homeOrbitTurn = nextTurn;
  }

  function homeDomainCardsMarkup(domain) {
    return domain.modules.map((id) => {
      const module = DATA.moduleById[id];
      const progress = moduleProgress(module);
      const label = progress.complete ? "已确认" : progress.observed ? "待关联" : progress.done ? `${progress.done}/${progress.total} 已确认` : "待开始";
      const tone = progress.complete ? "success" : progress.observed ? "warning" : progress.done ? "info" : "";
      return `<article class="classic-module-card"><div class="classic-card-title"><span>${icon(module.icon)}</span><div><small>${module.short}</small><strong>${module.name}</strong></div><em class="status-badge ${tone}">${label}</em></div><p>${module.description}</p><footer><span>${progress.done}/${progress.total} 项来源状态已确认</span><button type="button" data-route="#module/${module.id}">进入模块 ${icon("arrow", "sm")}</button></footer></article>`;
    }).join("");
  }

  function homeDomainPagerMarkup() {
    return Object.entries(HOME_DOMAINS).map(([key, item]) => `<button type="button" class="${homeDomain === key ? "active" : ""}" data-action="home-domain" data-domain="${key}" aria-label="切换到${item.name}" aria-pressed="${homeDomain === key}">${item.order}</button>`).join("");
  }

  function homeArchitecturePathMarkup() {
    const activeSegment = HOME_DOMAIN_ORDER.indexOf(homeDomain) + 1;
    return `<svg class="architecture-path" viewBox="0 0 640 520" style="--orbit-angle:${homeOrbitTurn * 120}deg" aria-hidden="true">
      <defs><marker id="home-architecture-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 1.5 10.5 6 2 10.5"/></marker></defs>
      <g class="path-segment segment-1${activeSegment === 1 ? " active" : ""}"><path class="path-track" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2" marker-end="url(#home-architecture-arrow)"/><path class="path-flow" pathLength="1" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2"/></g>
      <g class="path-segment segment-2${activeSegment === 2 ? " active" : ""}"><path class="path-track" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2" marker-end="url(#home-architecture-arrow)"/><path class="path-flow" pathLength="1" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2"/></g>
      <g class="path-segment segment-3${activeSegment === 3 ? " active" : ""}"><path class="path-track" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1" marker-end="url(#home-architecture-arrow)"/><path class="path-flow" pathLength="1" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1"/></g>
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
      <b>${DATA.brand.zh}</b><span class="core-label">${domain.core}</span>
    </div>`;
  }

  function animateHomeDomainDetail(detail) {
    if (!detail || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof detail.animate !== "function") return;
    detail.getAnimations().forEach((animation) => animation.cancel());
    detail.animate(
      [{ opacity: 0.72, transform: "translateX(5px)" }, { opacity: 1, transform: "translateX(0)" }],
      { duration: 480, easing: "cubic-bezier(.2,.85,.25,1)" }
    );
  }

  function selectHomeDomain(nextDomain) {
    if (!HOME_DOMAINS[nextDomain] || nextDomain === homeDomain) return;
    const currentIndex = HOME_DOMAIN_ORDER.indexOf(homeDomain);
    const nextIndex = HOME_DOMAIN_ORDER.indexOf(nextDomain);
    homeOrbitTurn += (nextIndex - currentIndex + HOME_DOMAIN_ORDER.length) % HOME_DOMAIN_ORDER.length;
    homeDomain = nextDomain;

    const frame = app.querySelector(".classic-home-frame");
    if (frame) {
      frame.dataset.homeDomain = homeDomain;
      const path = frame.querySelector(".architecture-path");
      path?.style.setProperty("--orbit-angle", `${homeOrbitTurn * 120}deg`);
      path?.querySelectorAll(".path-segment").forEach((segment, index) => segment.classList.toggle("active", index === nextIndex));
      frame.querySelectorAll(".architecture-node").forEach((node) => {
        const selected = node.dataset.domain === homeDomain;
        node.classList.toggle("active", selected);
        node.setAttribute("aria-pressed", String(selected));
      });
      const core = frame.querySelector(".classic-core");
      if (core) {
        core.dataset.coreState = homeDomain;
        const coreLabel = core.querySelector(".core-label");
        if (coreLabel) coreLabel.textContent = HOME_DOMAINS[homeDomain].core;
      }

      const domain = HOME_DOMAINS[homeDomain];
      const detail = frame.querySelector(".classic-domain-detail");
      if (detail) {
        detail.querySelector(".detail-kicker").textContent = domain.kicker;
        detail.querySelector("h2").textContent = domain.title;
        detail.querySelector(":scope > p").textContent = domain.lead;
        detail.querySelector(".classic-domain-cards").innerHTML = homeDomainCardsMarkup(domain);
        detail.querySelector(".domain-pager").innerHTML = homeDomainPagerMarkup();
        animateHomeDomainDetail(detail);
      }
    }

    if (typeof STORE.saveHomeDomain === "function") {
      suppressHomeDomainStateRender = true;
      const release = () => { suppressHomeDomainStateRender = false; };
      try {
        STORE.saveHomeDomain(homeDomain, homeOrbitTurn);
      } catch (_) {
        release();
        return;
      }
      if (typeof window.queueMicrotask === "function") window.queueMicrotask(release);
      else window.setTimeout(release, 0);
    }
  }

  function renderHome() {
    renderedModuleId = null;
    syncHomeDomainFromScenario();
    const state = STORE.get();
    const scenario = activeScenario();
    const next = firstIncomplete();
    const done = completedCount();
    const percent = Math.round((done / DATA.workflow.length) * 100);
    const nextState = next ? stepState(next.id) : "complete";
    const nextStatus = statusMeta(nextState);
    const currentModule = next ? DATA.moduleById[next.module] : DATA.moduleById.report;
    const domain = HOME_DOMAINS[homeDomain] || HOME_DOMAINS.foundation;

    const chain = DATA.modules.map((module) => {
      const progress = moduleProgress(module);
      const active = next?.module === module.id;
      const chainStatus = progress.complete ? "已确认" : active ? "当前处理" : progress.observed ? "待关联" : progress.done ? "进行中" : "待开始";
      return `<button class="home-chain-node ${progress.complete ? "done" : active ? "active" : progress.observed ? "observed" : ""}" type="button" data-route="#module/${module.id}" title="进入${module.name}" aria-label="进入${module.name}，${chainStatus}，${progress.done}/${progress.total} 项来源状态已确认">
        <span>${icon(progress.complete ? "check" : progress.observed ? "link" : module.icon, "sm")}</span><strong>${module.name}</strong><small>${chainStatus} · ${progress.done}/${progress.total}</small>
      </button>`;
    }).join("");

    const domainCards = homeDomainCardsMarkup(domain);
    const blockerCopy = next ? recordDetail(next.id) : "全部来源状态已按同一链路确认。";
    const activities = DATA.workflow
      .map((step) => ({ step, record: rawStep(step.id), state: stepState(step.id), at: recordAt(step.id) }))
      .filter((item) => item.state !== "pending" && (item.at || item.state === "running" || item.state === "failed"))
      .slice(0, 4);
    const activity = activities.length
      ? activities.map((item) => {
          const meta = statusMeta(item.state);
          return `<article class="activity-item"><i class="activity-dot ${meta.tone}"></i><div><strong>${item.step.title} · ${meta.label}</strong><span>${escapeHtml(recordDetail(item.step.id))}</span></div><time>${escapeHtml(item.at)}</time></article>`;
        }).join("")
      : `<div class="empty-state">${icon("clock", "lg")}<strong>暂无最近任务或结果</strong><span>在相应模块完成操作后，这里会读取并汇总来源状态。</span></div>`;
    const selectedNames = state.context.selectedEntities.map((id) => DATA.entities.find((entity) => entity.id === id)?.name).filter(Boolean);
    const content = `<div class="home-view scheme-a-home"><div class="home-container">
      <section class="home-status-strip">
        <div class="scenario-identity"><span>当前场景 · ${escapeHtml(scenario.id)}</span><strong>${escapeHtml(scenario.name)}</strong><small>${escapeHtml(state.context.organization)} · ${escapeHtml(selectedNames.join("、"))} · 数据时点 ${escapeHtml(stateDataAsOf())}</small></div>
        <div class="scenario-progress"><div><span>${escapeHtml(scenario.id)} 链路进度</span><b>${done}/${DATA.workflow.length}</b></div><i><i style="width:${percent}%"></i></i><small>${percent}% 来源状态已确认</small></div>
        <div class="scenario-next"><span>${next ? "下一步操作" : "当前状态"}</span><strong>${next ? next.title : "全链路状态已确认"}</strong><small>${escapeHtml(blockerCopy)}</small></div>
        <button class="btn primary" type="button" data-route="${next ? `#module/${next.module}` : "#dashboard"}">${next ? `前往${currentModule.name}` : "查看仪表盘"}${icon("arrow", "sm")}</button>
      </section>

      <section class="classic-home-frame" data-home-domain="${homeDomain}">
        <div class="classic-architecture">
          <div class="architecture-intro"><div><span>${DATA.brand.en} · 平台能力架构</span><h1>从可信数据到可追溯行动</h1></div><p>数据、语义与行动沿同一证据链协作；首页只汇总进度并把工作带回对应业务模块。</p></div>
          <div class="architecture-cycle" aria-label="平台三大能力域">
            ${homeArchitecturePathMarkup()}
            ${Object.entries(HOME_DOMAINS).map(([key, item]) => `<button class="architecture-node ${key}${homeDomain === key ? " active" : ""}" type="button" data-action="home-domain" data-domain="${key}" aria-pressed="${homeDomain === key}"><span class="node-en">${item.en}</span>${icon(item.icon, "architecture-node-icon")}<span class="node-zh">${item.name}</span></button>`).join("")}
            ${homeCoreGraphicMarkup()}
          </div>
          <div class="architecture-foot">
            <span><b>01 数据治理</b>数据源、数据管道、资产版本与质量。</span>
            <span><b>02 语义问数</b>已发布业务定义、可信问数、报告与证据。</span>
            <span><b>03 行动智能</b>行动请求、人工确认与受控协作。</span>
          </div>
        </div>
        <div class="classic-domain-detail" aria-live="polite">
          <div class="detail-kicker">${domain.kicker}</div><h2>${domain.title}</h2><p>${domain.lead}</p>
          <div class="classic-domain-cards">${domainCards}</div>
          <div class="domain-pager" aria-label="切换能力域">${homeDomainPagerMarkup()}</div>
        </div>
        <nav class="home-chain-track" aria-label="六模块链路入口">${chain}</nav>
      </section>

      <div class="home-summary-grid">
        <section class="panel"><div class="panel-head"><div><h2>当前阻断</h2><p>只显示下一项需要处理的来源状态。</p></div><span class="status-badge ${next ? nextStatus.tone : "success"}">${next ? nextStatus.label : "当前无阻断"}</span></div><div class="home-blocker"><span class="blocker-icon ${next ? "" : "clear"}">${icon(next ? nextStatus.icon : "shield")}</span><div><strong>${next ? next.title : "当前无待处理事项"}</strong><p>${escapeHtml(blockerCopy)}</p></div><div><button class="btn" type="button" data-action="refresh-source">重新读取</button>${next ? `<button class="btn primary" type="button" data-route="#module/${next.module}">前往处理</button>` : ""}</div></div></section>
        <section class="panel"><div class="panel-head"><div><h2>最近任务与结果</h2><p>读取各模块最近保存的业务状态。</p></div></div><div class="activity-list compact">${activity}</div></section>
      </div>
      <div class="workspace-note">首页只汇总各业务模块已保存的状态；发布、确认、交办与报告操作均在相应模块内完成。</div>
    </div></div>`;
    renderShell(content, { type: "home", active: "home", key: "home" });
    const homeView = app.querySelector(".home-view");
    const savedScrollTop = Math.max(0, Number(STORE.getScenario?.()?.navigation?.homeScrollTop) || 0);
    if (homeView) {
      window.requestAnimationFrame(() => { homeView.scrollTop = savedScrollTop; });
      homeView.addEventListener("scroll", () => {
        window.clearTimeout(homeScrollSaveTimer);
        homeScrollSaveTimer = window.setTimeout(captureHomePosition, 120);
      }, { passive: true });
    }
  }

  function initialHash(moduleId) {
    return { data: "#/resources", ontology: "#modeling", query: "#/ask", decision: "#workbench", agent: "#/agents", report: "#/lifecycle", dashboard: "#/dashboard/s001" }[moduleId] || "";
  }

  function frameSource(module) {
    const saved = STORE.get().framePositions[module.id];
    const fallback = `${module.source}${initialHash(module.id)}`;
    if (!saved?.href) return sourceWithScenarioContext(fallback);
    try {
      const approvedUrl = new URL(module.source, window.location.href);
      const savedUrl = new URL(saved.href, window.location.href);
      const approvedDirectory = new URL("./", approvedUrl).pathname;
      const pathnameAllowed = module.id === "decision"
        ? savedUrl.pathname.startsWith(approvedDirectory)
        : savedUrl.pathname === approvedUrl.pathname;
      return sourceWithScenarioContext(pathnameAllowed ? `${savedUrl.pathname}${savedUrl.search}${savedUrl.hash}` : fallback);
    } catch (_) {
      return sourceWithScenarioContext(fallback);
    }
  }

  function renderModule(moduleId) {
    const module = DATA.moduleById[moduleId];
    if (!module) return renderHome();
    const content = `<div class="module-view"><section class="frame-stage"><iframe id="module-frame" class="module-frame" data-scenario-id="${escapeHtml(activeScenario().id)}" title="${module.name}" src="${escapeHtml(frameSource(module))}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe></section></div>`;
    const route = { type: "module", moduleId, active: moduleId, key: `module-${moduleId}` };
    const rebuilt = renderShell(content, route, { preserveFrame: true, frameMode: "module" });
    renderedModuleId = moduleId;
    if (rebuilt) {
      const frame = document.getElementById("module-frame");
      if (frame) frame.addEventListener("load", () => adaptFrame(frame, module));
    }
  }

  function renderDashboard() {
    const reportModule = DATA.moduleById.report;
    const dashboardModule = { ...reportModule, id: "dashboard", name: "仪表盘" };
    const published = isComplete("publish");
    const source = frameSource(dashboardModule);
    const frameBody = published
      ? `<iframe id="module-frame" class="module-frame" data-scenario-id="${escapeHtml(activeScenario().id)}" title="仪表盘" src="${escapeHtml(source)}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>`
      : `<div class="consume-gate">${icon("chart", "lg")}<h1>暂无可消费的本次报告</h1><p>请先在报告中心完成报告生成、确定性核验以及 HTML/PDF 发布。</p><button class="btn primary" type="button" data-route="#module/report">前往报告中心</button></div>`;
    const content = `<div class="module-view"><section class="frame-stage">${frameBody}</section></div>`;
    const route = { type: "dashboard", active: "dashboard", key: "dashboard" };
    const rebuilt = renderShell(content, route, { preserveFrame: published, frameMode: published ? "dashboard-frame" : "dashboard-gate" });
    renderedModuleId = published ? "dashboard" : null;
    if (rebuilt && published) {
      const frame = document.getElementById("module-frame");
      if (frame) frame.addEventListener("load", () => adaptFrame(frame, dashboardModule));
    }
  }

  function render() {
    const route = parseRoute();
    if (route.type === "module") renderModule(route.moduleId);
    else if (route.type === "dashboard") renderDashboard();
    else renderHome();
  }

  function showToast(title, detail, tone = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${tone}`;
    toast.innerHTML = `${icon(tone === "success" ? "check" : tone === "warning" ? "alert" : "close")}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
    toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function modalShell({ title, subtitle, iconName, body, footer, large = false }) {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal ${large ? "large" : ""}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
      <header class="modal-head"><div class="modal-title"><span>${icon(iconName)}</span><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div></div><button class="btn icon-only" type="button" data-action="close-modal" aria-label="关闭">${icon("close", "sm")}</button></header>
      <div class="modal-body">${body}</div><footer class="modal-foot">${footer}</footer></section></div>`;
  }

  function flowModal() {
    const next = firstIncomplete();
    const scenario = activeScenario();
    return modalShell({
      title: `${scenario.id} 链路进度`,
      subtitle: `${completedCount()}/${DATA.workflow.length} 项来源状态已确认`,
      iconName: "layers",
      large: true,
      body: `<div class="step-list">${DATA.workflow.map((step, index) => {
        const currentState = stepState(step.id);
        const meta = statusMeta(currentState);
        return `<button class="step-row ${currentState === "complete" ? "done" : currentState === "observed" ? "observed" : currentState === "failed" ? "failed" : next?.id === step.id ? "active" : ""}" type="button" data-action="go-flow-step" data-step="${step.id}"><span class="step-index">${currentState === "complete" ? icon("check", "sm") : currentState === "observed" ? icon("link", "sm") : index + 1}</span><span><strong>${step.title}</strong><small>${DATA.moduleById[step.module].name} · ${escapeHtml(recordDetail(step.id))}</small></span><em>${meta.label}</em></button>`;
      }).join("")}</div>`,
      footer: `<button class="btn" type="button" data-action="refresh-source">重新读取</button><button class="btn" type="button" data-action="close-modal">关闭</button>${next ? `<button class="btn primary" type="button" data-action="go-flow-step" data-step="${next.id}">前往下一步</button>` : `<button class="btn primary" type="button" data-route="#dashboard">查看仪表盘</button>`}`
    });
  }

  function resetModal() {
    const scenario = activeScenario();
    return modalShell({
      title: "重置当前场景",
      subtitle: `${scenario.id} · ${scenario.name}`,
      iconName: "reset",
      body: `<div class="reset-warning">${icon("alert")}<div><strong>只清除当前场景的本地工作记录</strong><span>不会影响其他场景，也不会删除源文件、业务文档和既有归档。完成后将返回当前场景首页，并从数据上传开始重新读取状态。</span></div></div>`,
      footer: `<button class="btn" type="button" data-action="close-modal">保留当前状态</button><button class="btn danger" type="button" data-action="confirm-reset">确认重置 ${escapeHtml(scenario.id)}</button>`
    });
  }

  function stepModal(stepId) {
    const step = DATA.stepById[stepId];
    const record = rawStep(stepId);
    const currentState = stepState(stepId);
    const meta = statusMeta(currentState);
    const sourceRef = record.sourceRecordId || record.recordId || record.sourceRef || record.runId || record.version || "";
    const recovery = record.recovery || record.next || (currentState === "complete" ? "可继续下一步。" : `请在${DATA.moduleById[step.module].name}中处理后重新读取状态。`);
    return modalShell({
      title: step.title,
      subtitle: `${DATA.moduleById[step.module].name} · ${meta.label}`,
      iconName: meta.icon,
      body: `<div class="task-card ${currentState === "complete" ? "success" : currentState === "failed" || currentState === "blocked" || currentState === "observed" ? "warning" : ""}"><div class="task-card-head"><span>当前状态</span><span class="status-badge ${meta.tone}">${meta.label}</span></div><h3>${step.title}</h3><p>${escapeHtml(recordDetail(stepId))}</p><div class="fact-grid"><div><span>所属模块</span><strong>${DATA.moduleById[step.module].name}</strong></div><div><span>状态时间</span><strong>${escapeHtml(recordAt(stepId) || "尚未形成")}</strong></div></div><div class="recovery-copy"><strong>下一步</strong><span>${escapeHtml(recovery)}</span></div>${sourceRef ? `<details class="source-reference"><summary>查看来源定位</summary><code>${escapeHtml(sourceRef)}</code></details>` : ""}</div>`,
      footer: `<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn primary" type="button" data-action="go-flow-step" data-step="${stepId}">前往${DATA.moduleById[step.module].name}</button>`
    });
  }

  function modalMarkup() {
    if (!modalState) return "";
    if (modalState.kind === "flow") return flowModal();
    if (modalState.kind === "reset") return resetModal();
    if (modalState.kind === "step") return stepModal(modalState.stepId);
    return "";
  }

  function renderModal() {
    modalRoot.innerHTML = modalMarkup();
  }

  function openModal(kind, payload = {}) {
    modalState = { kind, ...payload };
    renderModal();
    window.setTimeout(() => modalRoot.querySelector("button")?.focus(), 0);
  }

  function closeModal(clear = true) {
    modalState = null;
    if (clear) modalRoot.replaceChildren();
  }

  function refreshSourceState(withToast = true) {
    STORE.refreshProjection?.();
    render();
    if (modalState) renderModal();
    if (withToast) showToast("状态已更新", "已重新读取六个模块当前保存的状态。", "success");
  }

  function focusModule() {
    const frame = document.getElementById("module-frame");
    if (!frame) return;
    frame.focus();
    try { frame.contentWindow.focus(); } catch (_) {}
    showToast("已进入模块", "请在模块页面完成当前业务操作，完成后点击“重新读取状态”。", "success");
  }

  function captureFramePosition() {
    const moduleId = renderedModuleId;
    if (!moduleId) return;
    const frame = document.getElementById("module-frame");
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const scroller = doc?.querySelector(".main, .screen-stage, .page-shell, .workspace-main, [data-scroll-container]");
      const href = frame.contentWindow.location.pathname + frame.contentWindow.location.search + frame.contentWindow.location.hash;
      STORE.saveFramePosition(moduleId, { scenarioId: activeScenario().id, href, windowY: frame.contentWindow.scrollY || 0, containerY: scroller?.scrollTop || 0, savedAt: Date.now() });
    } catch (_) {}
  }

  function captureHomePosition() {
    const homeView = app.querySelector(".home-view");
    if (!homeView) return;
    STORE.saveNavigationContext?.({
      scenarioId: activeScenario().id,
      homeScrollTop: Math.max(0, Math.round(homeView.scrollTop || 0))
    });
  }

  function shellRouteForUrl(url) {
    const routeMap = [
      ["ontology3-homepage-review", "#home", "home"],
      ["data-engineering-prototype-review", "#module/data", "data"],
      ["ontology-management-review", "#module/ontology", "ontology"],
      ["ontology-management-prototype", "#module/ontology", "ontology"],
      ["intelligent-query-prototype", "#module/query", "query"],
      ["decision-center-prototype", "#module/decision", "decision"],
      ["agent-application", "#module/agent", "agent"],
      ["report-center", "#module/report", "report"]
    ];
    return routeMap.find(([needle]) => url.includes(needle)) || null;
  }

  function frameAdapterCss(moduleId) {
    const kind = moduleId === "dashboard" ? "report" : moduleId;
    const common = `
      html, body { width:100%!important; height:100%!important; }
      body { overflow:hidden!important; }
    `;
    const adapters = {
      data: `
        .app-shell { grid-template-columns:184px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { display:none!important; }
        @media (max-width:960px) {
          .app-shell { grid-template-columns:58px minmax(0,1fr)!important; }
        }
      `,
      ontology: `
        .app-shell { grid-template-columns:184px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { display:none!important; }
        @media (max-width:960px) {
          .app-shell { grid-template-columns:58px minmax(0,1fr)!important; }
        }
      `,
      query: `
        .app-shell { grid-template-columns:184px minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { width:168px!important; min-height:0!important; height:auto!important; padding:0!important; position:fixed!important; left:8px!important; right:auto!important; top:auto!important; bottom:70px!important; z-index:85!important; display:block!important; overflow:visible!important; background:transparent!important; border:0!important; }
        .app-workspace > .topbar > .breadcrumb,
        .app-workspace > .topbar .top-actions > :not(.data-context) { display:none!important; }
        .app-workspace > .topbar .top-actions { display:block!important; }
        .app-workspace > .topbar .data-context { width:168px!important; min-height:34px!important; display:flex!important; justify-content:flex-start!important; box-shadow:0 5px 16px rgba(22,36,54,.13)!important; }
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr) 58px!important; }
          .app-shell > .product-nav { grid-column:1!important; grid-row:2!important; }
          .app-shell > .app-workspace { grid-column:1!important; grid-row:1!important; }
          .app-workspace > .topbar { left:8px!important; bottom:66px!important; }
        }
      `,
      decision: `
        .decision-app { grid-template-columns:184px minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .decision-app > .app-rail { display:none!important; }
        .decision-app > .product-nav { grid-column:1!important; grid-row:1!important; }
        .decision-app > .product-nav > .product-nav-foot { display:none!important; }
        .decision-app > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .decision-app > .app-workspace > .app-topbar { display:none!important; }
        @media (max-width:760px) {
          .decision-app { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:60px minmax(0,1fr)!important; }
          .decision-app > .product-nav { grid-column:1!important; grid-row:1!important; }
          .decision-app > .app-workspace { grid-column:1!important; grid-row:2!important; }
        }
      `,
      agent: `
        .app-shell { grid-template-columns:188px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .workspace > .topbar { display:none!important; }
        @media (max-width:820px) {
          .app-shell { grid-template-columns:58px minmax(0,1fr)!important; }
        }
      `,
      report: `
        .app-shell { grid-template-columns:190px minmax(0,1fr)!important; }
        .app-shell > .platform-rail { display:none!important; }
        .app-shell > .product-nav { grid-column:1!important; grid-row:1!important; }
        .app-shell > .app-workspace { grid-column:2!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { min-height:0!important; height:0!important; padding:0!important; position:absolute!important; inset:0!important; z-index:90!important; overflow:visible!important; background:transparent!important; border:0!important; }
        .app-workspace > .topbar .breadcrumb,
        .app-workspace > .topbar .topbar-actions { display:none!important; }
        .app-workspace > .topbar .mobile-nav-toggle { display:none!important; }
        .app-workspace > .topbar .persistence-banner { top:8px!important; right:16px!important; display:flex!important; }
        @media (max-width:980px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .app-workspace { grid-column:1!important; }
          .app-shell > .product-nav { grid-column:auto!important; grid-row:auto!important; position:fixed!important; left:0!important; top:0!important; bottom:0!important; width:220px!important; transform:translateX(-110%)!important; }
          .app-shell.nav-open > .product-nav { transform:translateX(0)!important; }
          .app-workspace > .topbar .topbar-left { display:block!important; }
          .app-workspace > .topbar .mobile-nav-toggle { width:38px!important; height:38px!important; position:fixed!important; left:8px!important; top:8px!important; z-index:95!important; display:grid!important; background:#fff!important; border:1px solid #c6d0dc!important; box-shadow:0 5px 16px rgba(22,36,54,.14)!important; }
          .app-workspace > .main:not(.reader-main):not(.external-main) { padding-left:58px!important; }
          .app-workspace .reader-toolbar,
          .app-workspace .external-head { padding-left:58px!important; }
        }
        @media (max-width:700px) {
          .app-shell > .product-nav { width:min(280px,85vw)!important; }
          .app-workspace > .topbar .persistence-banner { right:8px!important; width:calc(100vw - 62px)!important; }
        }
      `
    };
    return `${common}${adapters[kind] || ""}`;
  }

  function installFrameAdapter(doc, moduleId) {
    let style = doc.getElementById("s001-shell-adapter");
    if (!style) {
      style = doc.createElement("style");
      style.id = "s001-shell-adapter";
      doc.head.appendChild(style);
    }
    style.textContent = frameAdapterCss(moduleId);
  }

  function adaptFrame(frame, module) {
    if (frameObserver) frameObserver.disconnect();
    try {
      const href = frame.contentWindow.location.href;
      const mapped = shellRouteForUrl(href);
      if (mapped && mapped[2] !== module.id && !(module.id === "dashboard" && mapped[2] === "report")) {
        navigate(mapped[1]);
        return;
      }
      deliverScenarioContextToFrame(frame, module);
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      doc.title = `${module.name} · ${DATA.brand.zh}`;
      installFrameAdapter(doc, module.id);
      const saved = STORE.get().framePositions[module.id];
      if (saved) {
        window.setTimeout(() => {
          try {
            frame.contentWindow.scrollTo(0, saved.windowY || 0);
            const scroller = doc.querySelector(".main, .screen-stage, .page-shell, .workspace-main, [data-scroll-container]");
            if (scroller) scroller.scrollTop = saved.containerY || 0;
          } catch (_) {}
        }, 80);
      }

      const phrases = [
        ["这是评审环境辅助能力，不属于正式产品。重置只清理本轮新增状态并恢复可信基线；正式产品中的运行历史、失败证据和不可变资产版本不得通过此操作删除或回滚。", "重置只清理当前浏览器内的工作记录并恢复初始状态；源文件、业务文档和既有归档不会被删除。"],
        ["仅用于重新评审完整交互流程", "清除本地工作记录并恢复初始状态"],
        ["重置评审工作区状态", "重置工作区状态"],
        ["评审工作区", "当前工作区"],
        ["Action Request", "行动申请"],
        ["Rule 命中", "规则触发"],
        ["规则自动命中", "规则触发"],
        ["规则命中", "规则触发"],
        ["Rule 自动命中", "规则触发"],
        ["Rule 条件", "规则条件"],
        ["Rule 与主体", "规则与主体"],
        ["Rule 与行动", "规则与行动"],
        ["Rule 事实", "规则事实"],
        ["Rule 评估", "规则评估"],
        ["Rule 结果", "规则结果"],
        ["Rule 结论", "规则结论"],
        ["Metric 快照", "指标快照"],
        ["Action Type", "行动类型"],
        ["行动请求", "行动申请"],
        ["C027 当前比较", "与当前数据比较"],
        ["演示数据", "业务数据"],
        ["测试数据", "业务数据"],
        ["演示环境", "业务工作区"],
        ["评审环境", "业务工作区"],
        ["交互原型", "业务工作台"],
        ["原型夹具", "预置配置"],
        ["非真实结果", "待发布结果"],
        ["设计说明", "业务说明"],
        ["设计目标", "业务目标"],
        ["一期方案", "当前范围"],
        ["内部建议", "操作建议"]
      ];
      const replaceKnownText = (value) => {
        let next = String(value || "").replace(/Ontology\s*3\.0/gi, DATA.brand.zh).replace(/ontology3\.0/gi, DATA.brand.zh);
        if (next.trim() === "O3") next = next.replace("O3", "OF");
        phrases.forEach(([from, to]) => { next = next.replaceAll(from, to); });
        return next;
      };
      const scrubNode = (root) => {
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
          const parent = node.parentElement;
          if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"].includes(parent.tagName)) return;
          const next = replaceKnownText(node.nodeValue);
          if (next !== node.nodeValue) node.nodeValue = next;
        });
        if (root.nodeType === Node.ELEMENT_NODE) {
          [root, ...root.querySelectorAll("[aria-label], [title], [placeholder]")].forEach((element) => {
            ["aria-label", "title", "placeholder"].forEach((name) => {
              if (!element.hasAttribute?.(name)) return;
              const current = element.getAttribute(name);
              const next = replaceKnownText(current);
              if (next !== current) element.setAttribute(name, next);
            });
          });
        }
      };
      scrubNode(doc.body);
      const FrameMutationObserver = frame.contentWindow.MutationObserver;
      frameObserver = new FrameMutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === "characterData" && mutation.target.parentElement) scrubNode(mutation.target.parentElement);
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) scrubNode(node);
            if (node.nodeType === Node.TEXT_NODE && node.parentElement) scrubNode(node.parentElement);
          });
        });
      });
      frameObserver.observe(doc.body, { childList: true, subtree: true, characterData: true });

      doc.addEventListener("click", (event) => {
        const anchor = event.target.closest?.("a[href]");
        if (anchor) {
          const target = shellRouteForUrl(anchor.href);
          if (target && target[2] !== module.id && !(module.id === "dashboard" && target[2] === "report")) {
            event.preventDefault();
            navigate(target[1]);
            return;
          }
        }
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(() => { captureFramePosition(); refreshSourceState(false); }, 220);
      }, true);
      doc.addEventListener("scroll", () => {
        window.clearTimeout(frameSaveTimer);
        frameSaveTimer = window.setTimeout(captureFramePosition, 180);
      }, true);
      refreshSourceState(false);
    } catch (_) {
      showToast("模块页面已打开", "当前页面仍可使用统一导航和返回。", "warning");
    }
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) { navigate(routeButton.dataset.route); return; }
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    const stepId = actionButton.dataset.step;
    if (action === "open-flow") openModal("flow");
    if (action === "open-reset") openModal("reset");
    if (action === "close-modal") closeModal();
    if (action === "backdrop-close" && event.target === actionButton) closeModal();
    if (action === "confirm-reset") {
      const scenario = activeScenario();
      captureFramePosition();
      closeModal();
      history.replaceState({ s001Shell: true, scenarioId: scenario.id, s001Depth: 0 }, "", "#home");
      renderedModuleId = null;
      if (typeof STORE.resetCurrentScenario === "function") STORE.resetCurrentScenario();
      else STORE.resetAll?.();
      render();
      showToast(`${scenario.id} 已重置`, "已返回当前场景首页，可以从数据上传重新开始。", "success");
    }
    if (action === "refresh-source") refreshSourceState(true);
    if (action === "focus-module") focusModule();
    if (action === "inspect-step") openModal("step", { stepId });
    if (action === "go-flow-step") { closeModal(); navigate(`#module/${DATA.stepById[stepId].module}`); }
    if (action === "return-context") returnToPrevious();
    if (action === "toggle-navigation") STORE.toggleNavigation();
    if (action === "home-domain") selectHomeDomain(actionButton.dataset.domain || "foundation");
    if (action === "reload-frame") {
      const frame = document.getElementById("module-frame");
      if (frame) frame.contentWindow.location.reload();
    }
  });

  document.addEventListener("change", (event) => {
    const selector = event.target.closest?.('[data-action="switch-scenario"]');
    if (!selector || typeof STORE.setActiveScenario !== "function") return;
    captureFramePosition();
    const nextScenario = DATA.scenarioById?.[selector.value];
    if (!nextScenario?.enabled) return;
    STORE.setActiveScenario(nextScenario.id);
    history.replaceState({ s001Shell: true, scenarioId: nextScenario.id, s001Depth: 0 }, "", "#home");
    closeModal();
    render();
  });

  window.addEventListener("popstate", (event) => {
    captureFramePosition();
    const targetScenarioId = event.state?.scenarioId;
    if (targetScenarioId && targetScenarioId !== STORE.get().activeScenarioId) STORE.setActiveScenario?.(targetScenarioId);
    closeModal();
    render();
  });
  window.addEventListener("hashchange", () => { closeModal(); render(); });
  window.addEventListener("beforeunload", () => {
    captureFramePosition();
    captureHomePosition();
  });
  window.addEventListener("storage", (event) => {
    if (!STORE.MODULE_STORAGE_KEYS?.includes(event.key)) return;
    window.clearTimeout(storageRefreshTimer);
    storageRefreshTimer = window.setTimeout(() => refreshSourceState(false), 120);
  });
  window.addEventListener("s001:state", () => {
    if (suppressHomeDomainStateRender && parseRoute().type === "home") return;
    render();
    if (modalState && ["flow", "step"].includes(modalState.kind)) renderModal();
  });
  window.addEventListener("s001:scenario-context", () => {
    const frame = document.getElementById("module-frame");
    const module = renderedModuleId === "dashboard"
      ? { ...DATA.moduleById.report, id: "dashboard" }
      : DATA.moduleById[renderedModuleId];
    if (frame && module) deliverScenarioContextToFrame(frame, module);
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modalState) closeModal(); });

  if (!window.location.hash) history.replaceState({ s001Shell: true, scenarioId: activeScenario().id, s001Depth: 0 }, "", "#home");
  else if (!history.state?.s001Shell) history.replaceState({ ...(history.state || {}), s001Shell: true, scenarioId: activeScenario().id, s001Depth: 0 }, "", window.location.href);
  STORE.refreshProjection?.();
  render();
})();
