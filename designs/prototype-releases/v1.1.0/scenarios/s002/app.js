(function () {
  "use strict";

  const DATA = window.S002_DATA;
  const STORE = window.S002_STORE;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  const entryParams = new URLSearchParams(window.location.search);
  // Portable delivery keeps the walkthrough-ready completed run separate from
  // immutable evidence viewing. "complete" clones CP07 into a new isolated
  // runnable namespace; "cp07" remains the original historical read-only view.
  const deliveryMode = entryParams.get("delivery");
  const deliveryEntryRequested = ["complete", "cp07"].includes(deliveryMode) || entryParams.get("final") === "202608170930";
  const deliveryEntryMode = deliveryMode === "cp07" ? "historical" : "complete";
  const freshEntryRequested = deliveryMode === "fresh";
  const deliveryCheckpoint = deliveryEntryRequested ? DATA.checkpoints.find(function (checkpoint) { return checkpoint.id === "CP07"; }) : null;
  let deliveryEntryBooting = Boolean(deliveryCheckpoint);

  const SHELL_NAV_KEY = "ontology3.0:s002:shell:nav-collapsed";
  const HOME_POSITION_KEY = "ofw:s002:ui:home-scroll";
  const MODULES = [
    { id: "data", legacyId: "m02", code: "M02", name: "数据工程", short: "数据", icon: "database", description: "接入预算资料、运行质量门并发布可引用的数据资产。", steps: ["dataConnected", "qualityPassed", "assetPublished"] },
    { id: "ontology", legacyId: "m01", code: "M01", name: "本体管理", short: "本体", icon: "network", description: "维护预算对象、Metric、Rule 与 Action Type，并切换 Published。", steps: ["mappingApplied", "ontologyPublished"] },
    { id: "query", legacyId: "m03", code: "M03", name: "智能问数", short: "问数", icon: "sparkles", description: "基于 Published 口径运行预算问数和异常规则。", steps: ["queryRun", "rulesRun"] },
    { id: "decision", legacyId: "m04", code: "M04", name: "决策中心", short: "决策", icon: "target", description: "沿用基线决策工作台；S002 当前范围不生成行动申请示例。", steps: ["actionsDrafted", "actionConfirmed", "todoCreated"] },
    { id: "agent", legacyId: "m05", code: "M05", name: "Agent 应用", short: "Agent", icon: "bot", description: "按固定证据运行异常分析和预算报告草稿编排。", steps: ["agentsRun"] },
    { id: "report", legacyId: "m06", code: "M06", name: "报告中心", short: "报告", icon: "file", description: "形成预算驾驶舱、报告草稿、专题分析和下钻明细。", steps: ["reportBuilt", "dashboardPublished"] }
  ];
  const MODULE_BY_ID = Object.fromEntries(MODULES.map(function (module) { return [module.id, module]; }));
  // Each module runs from its own v1.0.3-derived scenario adapter.  The legacy
  // module.html remains in the package as historical evidence only.
  const BASELINE_SCENARIO_ENTRIES = Object.freeze({
    data: "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html",
    ontology: "baseline-adapters/ontology-management-review/canvas-first/index.html",
    query: "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    decision: "baseline-adapters/m04/decision-center-prototype/index.html",
    agent: "baseline-adapters/m05/agent-application/Agent应用.html",
    report: "baseline-adapters/m06/report-center/review-lifecycle/index.html",
    dashboard: "baseline-adapters/m06/report-center/review-lifecycle/index.html"
  });
  const STEP_META = {
    dataConnected: ["登记预算数据", "将 5 个逻辑数据源及其 8 个年度/确认快照登记到 S002 独立命名空间。"],
    qualityPassed: ["运行质量检查", "保留合法重复并对演示日期、期间问题形成可追溯修正。"],
    assetPublished: ["发布数据资产", "分别发布预算编制与执行、项目预算占用与余额两个业务数据资产；S002-DATA-v1 仅作为 C003 兼容组合指针。"],
    mappingApplied: ["应用本体映射", "映射预算对象、事件、关系和稳定键。"],
    ontologyPublished: ["切换 Published", "形成 S002-ONTO-v1 与 T019-S002-v1。"],
    queryRun: ["运行预算问数", "形成绑定双版本的 C018 结构化结果。"],
    rulesRun: ["识别异常事项", "运行五项正式 Rule 并保留已评估无命中结论。"],
    actionsDrafted: ["核对决策触发范围", "本轮仅展示异常与关注事项，不生成行动申请。"],
    actionConfirmed: ["确认无运行时决策事项", "当前 S002 范围不进入人工确认或拒绝。"],
    todoCreated: ["确认无行动待办", "当前 S002 范围不创建平台内行动待办。"],
    agentsRun: ["运行双 Agent", "异常分析与报告草稿 Agent 只读固定证据。"],
    reportBuilt: ["生成报告草稿", "形成六专题预算分析报告草稿，保持未正式发布。"],
    dashboardPublished: ["发布驾驶舱版本", "发布只读预算驾驶舱版本，不改变报告草稿状态。"]
  };
  const WORKFLOW = MODULES.flatMap(function (module) {
    return module.steps.map(function (step) { return { id: step, module: module.id, title: STEP_META[step][0], summary: STEP_META[step][1] }; });
  });
  const NAV = [
    { id: "home", name: "首页", icon: "home", route: "#home" },
    ...MODULES.map(function (module) { return { id: module.id, name: module.name, icon: module.icon, route: `#module/${module.id}` }; }),
    { id: "dashboard", name: "仪表盘", icon: "chart", route: "#dashboard" }
  ];

  const icons = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"/>',
    brainCircuit: '<path class="brain-mesh-outline" d="M12 4.35C10.92 2.72 8.42 2.35 6.92 3.78 4.76 3.6 3.14 5.67 3.82 7.7 2.18 8.78 2.28 11.18 3.72 12.5 2.62 14.5 3.8 16.96 5.93 17.52 6.22 20.2 9.42 21.38 11.28 19.72c.45-.4.72-.9.72-1.5 0 .6.27 1.1.72 1.5 1.86 1.66 5.06.48 5.35-2.2 2.13-.56 3.31-3.02 2.21-5.02 1.44-1.32 1.54-3.72-.1-4.8.68-2.03-.94-4.1-3.1-3.92-1.5-1.43-4-1.06-5.08.57Z"/><path class="brain-mesh-edge" d="M12 4.35 8.65 4.6 6.05 6.15 9.4 7.3 12 8.95 14.6 7.3 17.95 6.15 15.35 4.6 12 4.35M6.05 6.15 4.78 9.05 7.35 10.35 9.4 7.3M4.78 9.05 5.55 13.55 7.35 10.35 9.95 11.7 12 8.95M5.55 13.55 8.65 15.55 9.95 11.7 12 14.05 10.25 17.55 8.65 15.55M5.55 13.55 6.02 16.35 8.65 15.55M10.25 17.55 12 19.25 13.75 17.55 12 14.05M12 8.95 12 14.05M17.95 6.15 19.22 9.05 16.65 10.35 14.6 7.3M19.22 9.05 18.45 13.55 16.65 10.35 14.05 11.7 12 8.95M18.45 13.55 15.35 15.55 14.05 11.7 12 14.05 13.75 17.55 15.35 15.55M18.45 13.55 17.98 16.35 15.35 15.55M7.35 10.35 12 8.95 16.65 10.35M8.65 15.55 12 14.05 15.35 15.55"/><path class="brain-mesh-seam" d="M12 4.35v15"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="4.35" r=".48"/><circle class="brain-mesh-node phase-b" cx="8.65" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-c" cx="6.05" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="9.4" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-b" cx="4.78" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-a" cx="7.35" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-c" cx="9.95" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-d" cx="5.55" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-b" cx="6.02" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-a" cx="8.65" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-c" cx="10.25" cy="17.55" r=".34"/><circle class="brain-mesh-node phase-d node-key" cx="12" cy="8.95" r=".46"/><circle class="brain-mesh-node phase-a node-key" cx="12" cy="14.05" r=".46"/><circle class="brain-mesh-node phase-c node-key" cx="12" cy="19.25" r=".48"/><circle class="brain-mesh-node phase-b" cx="15.35" cy="4.6" r=".34"/><circle class="brain-mesh-node phase-a" cx="17.95" cy="6.15" r=".38"/><circle class="brain-mesh-node phase-d" cx="14.6" cy="7.3" r=".34"/><circle class="brain-mesh-node phase-c" cx="19.22" cy="9.05" r=".4"/><circle class="brain-mesh-node phase-b" cx="16.65" cy="10.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="14.05" cy="11.7" r=".38"/><circle class="brain-mesh-node phase-a" cx="18.45" cy="13.55" r=".38"/><circle class="brain-mesh-node phase-c" cx="17.98" cy="16.35" r=".34"/><circle class="brain-mesh-node phase-d" cx="15.35" cy="15.55" r=".4"/><circle class="brain-mesh-node phase-b" cx="13.75" cy="17.55" r=".34"/>',
    sparkles: '<path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-1 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m15.5 8.5 5-5M17 3h3.5v3.5"/>',
    bot: '<rect x="5" y="7" width="14" height="11" rx="2"/><path d="M12 3v4M8.5 12h.01M15.5 12h.01M9 15h6M3 11v4M21 11v4"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.8 8 7 10 4.2-2 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    reset: '<path d="M4.9 5.9A9 9 0 1 1 3 12"/><path d="M3 4v6h6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    restore: '<path d="M4 10a8 8 0 1 1 2 8"/><path d="M4 4v6h6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>'
  };

  let modalState = null;
  let renderedFrameId = null;
  const frameViewContexts = {};
  const FILE_PROTOCOL = window.location.protocol === "file:";
  const HTTP_PREVIEW_URL = "http://127.0.0.1:4332/scenarios/s002/index.html?delivery=complete#home";
  let homeDomain = "foundation";
  let navCollapsed = false;
  let homeScrollTop = 0;
  try {
    const storedNav = window.localStorage.getItem(SHELL_NAV_KEY);
    const narrowViewport = window.matchMedia("(max-width: 1024px)").matches;
    navCollapsed = narrowViewport ? true : storedNav == null ? false : storedNav === "true";
    homeScrollTop = Number(window.sessionStorage.getItem(HOME_POSITION_KEY) || 0);
  } catch (_) { navCollapsed = window.matchMedia("(max-width: 1024px)").matches; }
  try {
    const narrowViewportQuery = window.matchMedia("(max-width: 1024px)");
    const collapseOnNarrowViewport = function (event) {
      if (!event.matches || navCollapsed) return;
      navCollapsed = true;
      try { window.localStorage.setItem(SHELL_NAV_KEY, "true"); } catch (_) {}
      render();
    };
    if (typeof narrowViewportQuery.addEventListener === "function") narrowViewportQuery.addEventListener("change", collapseOnNarrowViewport);
    else if (typeof narrowViewportQuery.addListener === "function") narrowViewportQuery.addListener(collapseOnNarrowViewport);
  } catch (_) {}

  function icon(name, className) {
    return `<span class="icon ${className || ""}" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.info}</svg></span>`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function fmt(value, digits) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return Number(value).toLocaleString("zh-CN", { minimumFractionDigits: digits == null ? 2 : digits, maximumFractionDigits: digits == null ? 2 : digits });
  }

  function pct(value, digits) {
    if (value == null || Number.isNaN(Number(value))) return "—";
    return `${(Number(value) * 100).toFixed(digits == null ? 1 : digits)}%`;
  }

  function parseRoute() {
    const hash = window.location.hash || "#home";
    if (hash === "#home" || hash === "#/" || hash === "#") return { type: "home", active: "home", key: "home" };
    if (hash === "#dashboard") return { type: "dashboard", active: "dashboard", key: "dashboard" };
    const match = hash.match(/^#module\/(data|ontology|query|decision|agent|report)$/);
    if (match) return { type: "module", moduleId: match[1], active: match[1], key: `module-${match[1]}` };
    return { type: "home", active: "home", key: "home" };
  }

  function progressInfo(snapshot) {
    const done = WORKFLOW.filter(function (step) { return snapshot.progress[step.id]; }).length;
    const next = WORKFLOW.find(function (step) { return !snapshot.progress[step.id]; }) || null;
    return { done: done, total: WORKFLOW.length, percent: Math.round(done / WORKFLOW.length * 100), next: next };
  }

  function moduleProgress(snapshot, module) {
    const done = module.steps.filter(function (step) { return snapshot.progress[step]; }).length;
    return { done: done, total: module.steps.length, complete: done === module.steps.length, active: done > 0 && done < module.steps.length };
  }

  function activeModuleForStep(step) {
    return step ? MODULE_BY_ID[step.module] : MODULE_BY_ID.report;
  }

  function setDocumentTitle(route) {
    const page = route.type === "module" ? MODULE_BY_ID[route.moduleId].name : route.type === "dashboard" ? "仪表盘" : "首页";
    document.title = route.type === "home" ? `${DATA.brand.zh}（${DATA.brand.en}）` : `${page} · ${DATA.brand.zh}`;
  }

  function captureShellPosition() {
    const home = app.querySelector(".home-view");
    if (home) {
      homeScrollTop = home.scrollTop;
      try { window.sessionStorage.setItem(HOME_POSITION_KEY, String(homeScrollTop)); } catch (_) {}
    }
  }

  function restoreHomePosition() {
    const home = app.querySelector(".home-view");
    if (home) home.scrollTop = Number(homeScrollTop || 0);
  }

  function navigate(route, options) {
    captureShellPosition();
    closeModal();
    const currentDepth = Number(history.state?.s002Depth || 0);
    const nextState = { ...(history.state || {}), s002Shell: true, scenarioId: DATA.scenario.id, s002Depth: options?.replace ? currentDepth : currentDepth + 1 };
    if (options?.replace) history.replaceState(nextState, "", route);
    else history.pushState(nextState, "", route);
    render();
  }

  function returnToPrevious() {
    const depth = Number(history.state?.s002Depth || 0);
    if (depth > 0) history.back();
    else navigate("#home", { replace: true });
  }

  function scenarioWorkspaceMarkup() {
    return `<div class="scenario-workspace" aria-label="当前场景"><span>当前场景 · S002</span><strong>${escapeHtml(DATA.scenario.name)}</strong></div>`;
  }

  function navigation(route, snapshot) {
    const progress = progressInfo(snapshot);
    return `<aside class="global-nav">
      <button class="brand-lockup" type="button" data-action="toggle-navigation" aria-label="${navCollapsed ? "展开主菜单" : "收起主菜单"}" title="${navCollapsed ? "展开主菜单" : "收起主菜单"}">
        <span class="brand-mark brand-mark-ai" aria-hidden="true">${icon("brainCircuit", "brand-brain")}</span><div><strong>${DATA.brand.zh}</strong><small>${DATA.brand.en}</small></div>
      </button>
      <div class="nav-context"><span>当前场景</span><strong>S002 · ${escapeHtml(DATA.scenario.name)}</strong></div>
      <nav class="primary-nav" aria-label="一级导航">${NAV.map(function (item) {
        const module = MODULE_BY_ID[item.id];
        const moduleState = module ? moduleProgress(snapshot, module) : null;
        const done = module ? moduleState.complete : item.id === "dashboard" ? snapshot.progress.dashboardPublished : false;
        const observed = module ? moduleState.active : false;
        return `<button class="nav-item ${route.active === item.id ? "active" : ""}" type="button" data-route="${item.route}" title="${escapeHtml(item.name)}">${icon(item.icon)}<span>${escapeHtml(item.name)}</span>${item.id === "home" ? "" : `<i class="nav-state ${done ? "done" : observed ? "observed" : ""}"></i>`}</button>`;
      }).join("")}</nav>
      <div class="nav-foot"><div><i class="connection-dot ${progress.done ? "active" : ""}"></i><strong>${progress.done}/${progress.total} 项来源状态已确认</strong></div><p>${progress.next ? `下一步：${escapeHtml(progress.next.title)}` : "本次链路状态已全部确认"}</p></div>
    </aside>`;
  }

  function topbar(route, snapshot) {
    const progress = progressInfo(snapshot);
    const currentName = route.type === "module" ? MODULE_BY_ID[route.moduleId].name : route.type === "dashboard" ? "仪表盘" : "首页";
    const statusLabel = snapshot.mode === "historical" ? "历史只读" : snapshot.mode === "regression" ? "隔离回归" : snapshot.mode === "restored" ? "克隆恢复" : "独立运行";
    return `<header class="global-topbar">
      <div class="top-title">${route.type === "home" ? "" : `<button class="top-icon-button" type="button" data-action="return-context" title="返回上一位置" aria-label="返回上一位置">${icon("back", "sm")}</button>`}${icon(route.type === "dashboard" ? "chart" : route.type === "module" ? MODULE_BY_ID[route.moduleId].icon : "home")}<div class="top-title-copy"><span>统一工作台</span><strong>${escapeHtml(currentName)}</strong></div></div>
      ${scenarioWorkspaceMarkup()}
      <div class="top-actions">
        <button class="flow-trigger" type="button" data-action="open-flow" aria-label="打开 S002 链路进度">${icon("layers", "sm")}<span><b>链路进度 · ${progress.done}/${progress.total}</b><small>${progress.next ? `下一步：${escapeHtml(progress.next.title)}` : "全部来源状态已确认"}</small></span><i><i style="width:${progress.percent}%"></i></i></button>
        ${route.type === "module" || route.type === "dashboard" ? `<button class="top-action" type="button" data-action="refresh-source" title="重新读取">${icon("refresh", "sm")}<span>重新读取</span></button>` : ""}
        ${snapshot.mode === "historical" ? `<span class="top-action readonly">${icon("shield", "sm")}<span>${statusLabel}</span></span>` : `<button class="top-action" type="button" data-action="open-reset" title="重置当前场景">${icon("reset", "sm")}<span>重置当前场景</span></button>`}
        <div class="user-account" title="当前账号"><span class="user-avatar">管</span><strong>平台管理员</strong></div>
      </div>
    </header>`;
  }

  function htmlElement(markup) {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function patchStableShell(route, snapshot) {
    const nav = app.querySelector(".global-nav");
    const top = app.querySelector(".global-topbar");
    const view = app.querySelector(".module-view");
    const shell = app.querySelector(".platform-shell");
    if (!nav || !top || !view || !shell) return false;
    nav.replaceWith(htmlElement(navigation(route, snapshot)));
    top.replaceWith(htmlElement(topbar(route, snapshot)));
    shell.className = `platform-shell ${navCollapsed ? "nav-collapsed" : ""}`.trim();
    shell.dataset.scenarioId = DATA.scenario.id;
    setDocumentTitle(route);
    return true;
  }

  function renderShell(content, route, snapshot, options) {
    setDocumentTitle(route);
    const frameMode = options?.frameMode || "";
    const sameRoute = app.dataset.routeKey === route.key;
    if (options?.preserveFrame && sameRoute && app.dataset.frameMode === frameMode && patchStableShell(route, snapshot)) return false;
    const shellClass = ["platform-shell", navCollapsed ? "nav-collapsed" : ""].filter(Boolean).join(" ");
    app.innerHTML = `<div class="${shellClass}" data-scenario-id="S002">${navigation(route, snapshot)}<section class="shell-main">${topbar(route, snapshot)}<main class="route-stage">${content}</main></section></div>`;
    app.dataset.routeKey = route.key;
    app.dataset.frameMode = frameMode;
    return true;
  }

  function homeDomainConfig() {
    return {
      foundation: { order: "01", name: "数据治理", en: "可信数据", icon: "database", modules: ["data", "ontology"], kicker: "数据治理 · 可信底座", title: "把预算来源治理为稳定、可追溯的经营事实", lead: "数据工程维护来源、管道、质量和数据版本；本体管理维护业务对象、指标、规则和行动类型。预算阈值与公式不进入数据管道。" },
      intelligence: { order: "02", name: "语义问数", en: "可信理解", icon: "sparkles", modules: ["query", "report"], kicker: "语义问数 · 可信理解", title: "让问数与驾驶舱回到同一 Published 口径", lead: "智能问数形成结构化 C018 结果，报告中心只读消费 Published、问数结果和决策摘要，保留跨年趋势、单位对比和明细证据。" },
      action: { order: "03", name: "行动智能", en: "受控协作", icon: "target", modules: ["decision", "agent"], kicker: "行动智能 · 受控闭环", title: "让异常先进入人的判断，再形成平台内待办", lead: "不同异常映射到六类 Action 草稿。平台管理员人工确认或拒绝，演示系统不审批、不过账、不派发外部预算系统。" }
    };
  }

  function homeModuleCards(snapshot, domain) {
    return domain.modules.map(function (moduleId) {
      const module = MODULE_BY_ID[moduleId];
      const state = moduleProgress(snapshot, module);
      const label = state.complete ? "已确认" : state.active ? `${state.done}/${state.total} 已确认` : "待开始";
      return `<article class="classic-module-card"><div class="classic-card-title"><span>${icon(module.icon)}</span><div><small>${module.short}</small><strong>${module.name}</strong></div><em class="status-badge ${state.complete ? "success" : state.active ? "info" : ""}">${label}</em></div><p>${escapeHtml(module.description)}</p><footer><span>${state.done}/${state.total} 项来源状态已确认</span><button type="button" data-route="#module/${module.id}">进入模块 ${icon("arrow", "sm")}</button></footer></article>`;
    }).join("");
  }

  function architectureGraphic(domains) {
    return `<div class="architecture-cycle" aria-label="平台三大能力域">
      <svg class="architecture-path" viewBox="0 0 640 520" style="--orbit-angle:0deg" aria-hidden="true"><defs><marker id="s002-arrow" viewBox="0 0 12 12" refX="10.5" refY="6" markerWidth="10" markerHeight="10" orient="auto"><path d="M2 1.5 10.5 6 2 10.5"></path></marker></defs><g class="path-segment segment-1 ${homeDomain === "foundation" ? "active" : ""}"><path class="path-track" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2" marker-end="url(#s002-arrow)"></path><path class="path-flow" pathLength="1" d="M373.3 29.1 A237 237 0 0 1 534.8 360.2"></path></g><g class="path-segment segment-2 ${homeDomain === "intelligence" ? "active" : ""}"><path class="path-track" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2" marker-end="url(#s002-arrow)"></path><path class="path-flow" pathLength="1" d="M475.5 438.9 A237 237 0 0 1 170.9 444.2"></path></g><g class="path-segment segment-3 ${homeDomain === "action" ? "active" : ""}"><path class="path-track" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1" marker-end="url(#s002-arrow)"></path><path class="path-flow" pathLength="1" d="M108.8 367.6 A237 237 0 0 1 258.7 31.1"></path></g></svg>
      ${Object.entries(domains).map(function (entry) { const key = entry[0]; const domain = entry[1]; return `<button class="architecture-node ${key} ${homeDomain === key ? "active" : ""}" type="button" data-action="home-domain" data-domain="${key}" aria-pressed="${homeDomain === key}"><span class="node-en">${domain.en}</span>${icon(domain.icon, "architecture-node-icon")}<span class="node-zh">${domain.name}</span></button>`; }).join("")}
      <div class="classic-core" data-core-state="${homeDomain}" aria-hidden="true"><svg viewBox="0 0 220 150"><g class="core-grid"><path d="M34 112 110 137l76-25-76-25-76 25Zm19-6 57 19 57-19M72 100l38 13 38-13M34 112v8l76 25 76-25v-8M72 100v26m38-39v58m38-45v26"></path></g><polygon class="core-piece core-a" points="110,18 166,48 110,78 54,48"></polygon><polygon class="core-piece core-b" points="110,29 153,52 110,75 67,52"></polygon><polygon class="core-piece core-c" points="110,40 143,58 110,76 77,58"></polygon><rect class="core-piece core-d" x="83" y="31" width="54" height="54"></rect><rect class="core-piece core-e" x="105" y="53" width="10" height="10"></rect><path class="core-trace core-trace-foundation" d="M72 34H48v10H36m112-10h24v10h12M65 60H43v20H31m124-20h22v20h12M70 86H50v18H38m112-18h20v18h12M110 18v98"></path><path class="core-trace core-trace-intelligence" d="M46 42 76 26l30 16-30 16-30-16Zm0 0v34l30 17 30-17V42M114 46l30-16 30 16-30 16-30-16Zm0 0v34l30 17 30-17V46"></path><path class="core-trace core-trace-action" d="M92 27h36l30 22M161 60v23l-36 26M110 111H91L59 88V57m51-11 25 16-25 16-25-16 25-16Z"></path></svg><b>${DATA.brand.zh}</b><span>数据治理 · 语义问数 · 行动智能</span></div>
    </div>`;
  }

  function boundaryNotice() {
    return `<div class="boundary-note">${icon("shield")}<div><strong>演示边界</strong><span>Action 仅形成平台内草稿、人工确认和待办；外部预算系统派发、自动审批、过账及覆盖最终批准预算全部关闭。</span></div></div>`;
  }

  function renderHome(snapshot) {
    renderedFrameId = null;
    const progress = progressInfo(snapshot);
    const nextModule = activeModuleForStep(progress.next);
    const domains = homeDomainConfig();
    const domain = domains[homeDomain] || domains.foundation;
    const chain = MODULES.map(function (module) {
      const state = moduleProgress(snapshot, module);
      return `<button class="home-chain-node ${state.complete ? "done" : state.active ? "active" : ""}" type="button" data-route="#module/${module.id}">${icon(state.complete ? "check" : module.icon, "sm")}<strong>${module.name}</strong><small>${state.done}/${state.total} 已确认</small></button>`;
    }).join("");
    const content = `<div class="home-view scheme-a-home"><div class="home-container">
      <section class="home-status-strip"><div class="scenario-identity"><span>当前场景 · S002</span><strong>${escapeHtml(DATA.scenario.name)}</strong><small>人民币 · 万元 · 费用不含税 · 数据时点 ${escapeHtml(DATA.scenario.dataAsOf)}</small></div><div class="scenario-progress"><div><span>S002 链路进度</span><b>${progress.done}/${progress.total}</b></div><i><i style="width:${progress.percent}%"></i></i><small>${progress.percent}% 来源状态已确认</small></div><div class="scenario-next"><span>${progress.next ? "下一步操作" : "当前状态"}</span><strong>${progress.next ? escapeHtml(progress.next.title) : "全链路状态已确认"}</strong><small>${progress.next ? escapeHtml(progress.next.summary) : "可查看预算驾驶舱和分步快照证据。"}</small></div><button class="btn primary" type="button" data-route="${progress.next ? `#module/${nextModule.id}` : "#dashboard"}">${progress.next ? `前往${nextModule.name}` : "查看仪表盘"}${icon("arrow", "sm")}</button></section>
      <section class="classic-home-frame"><div class="classic-architecture"><div class="architecture-intro"><div><span>${DATA.brand.en} · 预算监督管理</span><h1>从预算申报、执行到监督分析的完整链路</h1></div><p>统一监督最终批准预算、部门初始申报、实际执行、项目余额和采购占用，异常与关注事项保留指标、Rule 和证据下钻。</p></div>${architectureGraphic(domains)}<div class="architecture-foot"><span><b>预算口径</b>2024/2025 最终批准预算与 2025/2026 部门初始申报分开管理。</span><span><b>数据范围</b>人民币、万元、费用不含税；修正和演示补全均保留标识。</span><span><b>当前范围</b>暂不生成行动申请、决策事项或平台内待办；决策中心仅保留基线空态能力。</span></div></div><div class="classic-domain-detail"><span class="detail-kicker">${domain.kicker}</span><h2>${domain.title}</h2><p>${domain.lead}</p><div class="classic-domain-cards">${homeModuleCards(snapshot, domain)}</div><div class="domain-pager">${Object.entries(domains).map(function (entry) { return `<button type="button" class="${homeDomain === entry[0] ? "active" : ""}" data-action="home-domain" data-domain="${entry[0]}">${entry[1].order}</button>`; }).join("")}</div></div><div class="home-chain-track">${chain}</div></section>
      <div class="home-summary-grid"><section class="panel"><div class="panel-head"><div><h2>预算经营事实</h2><p>仅在数据资产形成后展示；补数不冒充生产事实。</p></div><button class="btn" type="button" data-route="#dashboard">进入驾驶舱</button></div><div class="fact-strip"><div><span>2025最终批准总成本预算</span><strong>${snapshot.progress.assetPublished ? "1,097.70" : "—"}</strong><small>其中变动成本预算 879.40</small></div><div><span>净在途占用</span><strong>${snapshot.progress.assetPublished ? fmt(DATA.occupancy.netInTransit) : "—"}</strong><small>源覆盖 3/21 项目</small></div><div><span>Rule 运行记录</span><strong>${snapshot.progress.rulesRun ? snapshot.ruleHits.length : "—"}</strong><small>另保留供应商人月成本等无命中评估</small></div><div><span>预算占用集中度</span><strong>${snapshot.progress.assetPublished ? pct(DATA.occupancy.budgetOccupancyDecemberShare, 2) : "—"}</strong><small>12 月净在途 / 全年净在途</small></div></div></section><section class="panel"><div class="panel-head"><div><h2>运行与证据边界</h2><p>${escapeHtml(snapshot.context.scenarioRunId)}</p></div><button class="btn" type="button" data-action="open-checkpoints">查看 Checkpoint</button></div><div class="boundary-list"><div><b>父基线</b><span>v1.0.3 / ${escapeHtml(DATA.scenario.baselineSnapshotId)}</span></div><div><b>Action</b><span>${snapshot.actionRequests.length} 申请 / ${snapshot.todos.length} 平台内待办 / 外部未派发</span></div><div><b>报告</b><span>驾驶舱版本与报告草稿生命周期分离。</span></div><div><b>恢复</b><span>历史只读；恢复克隆新 runId；隔离回归零重放。</span></div></div></section></div>
      ${boundaryNotice()}
    </div></div>`;
    renderShell(content, { type: "home", active: "home", key: "home" }, snapshot, { frameMode: "home" });
    window.requestAnimationFrame(restoreHomePosition);
  }

  function frameSource(moduleId) {
    const snapshot = STORE.get();
    const params = new URLSearchParams({
      view: moduleId,
      build: "S002-20260815-baseline-adapters-r23-supplier-monthly-cost",
      adapter: "v1.0.3-s002",
      scenarioId: snapshot.context.scenarioId,
      scenarioVersion: snapshot.context.scenarioVersion,
      scenarioRunId: snapshot.context.scenarioRunId,
      formedAt: snapshot.context.formedAt,
      status: snapshot.context.status,
      scenarioStatus: snapshot.context.status,
      scenarioContextFormedAt: snapshot.context.formedAt,
      baselineVersion: DATA.scenario.baselineVersion,
      baselineSnapshotId: DATA.scenario.baselineSnapshotId,
      m02AssetPublished: snapshot.progress.assetPublished ? "1" : "0",
      m01MappingApplied: snapshot.progress.mappingApplied ? "1" : "0",
      m01OntologyPublished: snapshot.progress.ontologyPublished ? "1" : "0",
      m01Ready: snapshot.progress.assetPublished && snapshot.progress.mappingApplied && snapshot.progress.ontologyPublished ? "1" : "0"
    });
    const entry = BASELINE_SCENARIO_ENTRIES[moduleId] || BASELINE_SCENARIO_ENTRIES.report;
    const hash = moduleId === "dashboard" ? "#/dashboard/s002?tab=overview" : initialHash(moduleId);
    return `${entry}?${params.toString()}${hash}`;
  }

  function initialHash(moduleId) {
    return {
      data: "#/resources",
      ontology: "#published/version?id=SEM-S002-BUDGET-v1&tab=canvas",
      query: "#/ask",
      decision: "#workbench",
      agent: "#/runs",
      report: "#/lifecycle"
    }[moduleId] || "";
  }

  function httpLaunchGateMarkup(viewName) {
    return `<div class="consume-gate protocol-gate" data-protocol-gate="http-required">${icon("alert", "lg")}<h1>${escapeHtml(viewName)}需要通过本地 HTTP 服务打开</h1><p>v1.0.3 六模块包含 iframe、外部 JSX 与场景上下文通信；直接使用 file:// 会导致模块内容无法可靠加载。</p><code class="http-launch-command">python3 -m http.server 4332 --directory designs/prototype-work/v1.1.0</code><a class="btn primary" href="${HTTP_PREVIEW_URL}">打开 S002 HTTP 入口</a></div>`;
  }

  function mobileProductNavFixCss(moduleId) {
    if (!["data", "ontology", "agent"].includes(moduleId)) return "";
    const workspace = moduleId === "agent" ? ".workspace" : ".app-workspace";
    return `
      @media (max-width:700px) {
        .app-shell { grid-template-columns:58px minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .product-nav { width:auto!important; min-width:0!important; display:flex!important; grid-column:1!important; grid-row:1!important; position:relative!important; inset:auto!important; transform:none!important; }
        .app-shell > ${workspace} { min-width:0!important; grid-column:2!important; grid-row:1!important; }
        .product-nav-head { justify-content:center!important; padding:0!important; }
        .product-nav-head > div,
        .product-nav-label,
        .product-nav-item > span,
        .product-nav-item > em,
        .product-nav-item > .nav-count,
        .product-nav-foot { display:none!important; }
        .product-nav-list { padding:8px 7px!important; align-items:center!important; }
        .product-nav-item { width:44px!important; min-width:44px!important; min-height:44px!important; padding:0!important; grid-template-columns:1fr!important; justify-items:center!important; }
      }
    `;
  }

  function frameAdapterCss(moduleId) {
    const kind = moduleId;
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
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .product-nav { display:none!important; }
          .app-shell > .app-workspace { grid-column:1!important; }
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
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .product-nav { display:none!important; }
          .app-shell > .app-workspace { grid-column:1!important; }
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
        @media (max-width:700px) {
          .app-shell { grid-template-columns:minmax(0,1fr)!important; }
          .app-shell > .product-nav { display:none!important; }
          .app-shell > .workspace { grid-column:1!important; }
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
      `,
      dashboard: `
        .app-shell { grid-template-columns:minmax(0,1fr)!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-shell > .platform-rail,
        .app-shell > .product-nav { display:none!important; }
        .app-shell > .app-workspace { grid-column:1!important; grid-row:1!important; grid-template-rows:minmax(0,1fr)!important; }
        .app-workspace > .topbar { display:none!important; }
        .app-workspace > .main,
        .app-workspace .reader-toolbar,
        .app-workspace .external-head { padding-left:initial!important; }
        .app-workspace > .main { min-width:0!important; }
      `
    };
    return `${common}${adapters[kind] || ""}`;
  }

  function adaptFrame(frame, moduleId) {
    try {
      const snapshot = STORE.get();
      const exported = STORE.exportOwnedState?.() || {};
      const ownerStates = Object.fromEntries(Object.entries(exported.modules || {}).map(function (entry) {
        return [entry[0], {
          schemaVersion: "ofw.namespaced-storage.v1",
          scenarioContext: exported.scenarioContext || snapshot.context,
          payload: entry[1]
        }];
      }));
      const doc = frame.contentDocument;
      if (!doc?.head) return;
      let style = doc.getElementById("s002-v103-shell-adapter");
      if (!style) { style = doc.createElement("style"); style.id = "s002-v103-shell-adapter"; doc.head.appendChild(style); }
      style.textContent = `${frameAdapterCss(moduleId)}${mobileProductNavFixCss(moduleId)}`;
      doc.documentElement.dataset.parentBaseline = "v1.0.3";
      doc.documentElement.dataset.s002Adapter = "v1.0.3-s002";
      doc.documentElement.dataset.scenarioId = DATA.scenario.id;
      doc.documentElement.dataset.scenarioVersion = DATA.scenario.scenarioVersion;
      doc.documentElement.dataset.scenarioRunId = snapshot.context.scenarioRunId;
      frame.contentWindow?.postMessage({
        channel: "ofw.s002",
        type: "restore-view-context",
        view: moduleId,
        context: frameViewContexts[moduleId] || snapshot.context || null,
        ownerStates: ownerStates,
        snapshot: snapshot,
        mode: snapshot.mode
      }, window.location.origin);
    } catch (_) {}
  }

  function renderModule(moduleId) {
    const module = MODULE_BY_ID[moduleId];
    if (!module) return renderHome(STORE.get());
    const snapshot = STORE.get();
    const frameBody = FILE_PROTOCOL ? httpLaunchGateMarkup(module.name) : `<iframe id="module-frame" class="module-frame" data-scenario-id="S002" title="${escapeHtml(module.name)}" src="${escapeHtml(frameSource(moduleId))}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>`;
    const content = `<div class="module-view"><section class="frame-stage">${frameBody}</section></div>`;
    const route = { type: "module", moduleId: moduleId, active: moduleId, key: `module-${moduleId}` };
    const rebuilt = renderShell(content, route, snapshot, { preserveFrame: !FILE_PROTOCOL, frameMode: FILE_PROTOCOL ? "protocol-gate" : "module" });
    renderedFrameId = FILE_PROTOCOL ? null : moduleId;
    if (rebuilt && !FILE_PROTOCOL) {
      const frame = document.getElementById("module-frame");
      frame?.addEventListener("load", function (event) { adaptFrame(event.currentTarget, moduleId); });
      if (frame) {
        adaptFrame(frame, moduleId);
        [80, 260, 900].forEach(function (delay) { window.setTimeout(function () { adaptFrame(frame, moduleId); }, delay); });
      }
    }
  }

  function renderDashboard() {
    const snapshot = STORE.get();
    const published = snapshot.progress.dashboardPublished;
    const frameBody = FILE_PROTOCOL ? httpLaunchGateMarkup("预算管理驾驶舱") : published ? `<iframe id="module-frame" class="module-frame" data-scenario-id="S002" title="预算管理驾驶舱" src="${escapeHtml(frameSource("dashboard"))}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"></iframe>` : `<div class="consume-gate">${icon("chart", "lg")}<h1>暂无可消费的预算驾驶舱版本</h1><p>请先在报告中心完成报告草稿和驾驶舱版本发布；报告草稿不会因此变成正式报告。</p><button class="btn primary" type="button" data-route="#module/report">前往报告中心</button></div>`;
    const route = { type: "dashboard", active: "dashboard", key: "dashboard" };
    const frameMode = FILE_PROTOCOL ? "protocol-gate" : published ? "dashboard-frame" : "dashboard-gate";
    const rebuilt = renderShell(`<div class="module-view"><section class="frame-stage">${frameBody}</section></div>`, route, snapshot, { preserveFrame: !FILE_PROTOCOL && published, frameMode: frameMode });
    renderedFrameId = !FILE_PROTOCOL && published ? "dashboard" : null;
    if (rebuilt && !FILE_PROTOCOL && published) {
      const frame = document.getElementById("module-frame");
      frame?.addEventListener("load", function (event) { adaptFrame(event.currentTarget, "dashboard"); });
      if (frame) {
        adaptFrame(frame, "dashboard");
        [80, 260, 900].forEach(function (delay) { window.setTimeout(function () { adaptFrame(frame, "dashboard"); }, delay); });
      }
    }
  }

  function render() {
    if (deliveryEntryBooting) return;
    captureShellPosition();
    const route = parseRoute();
    if (route.type === "module") renderModule(route.moduleId);
    else if (route.type === "dashboard") renderDashboard();
    else renderHome(STORE.get());
    renderModal();
  }

  function showToast(title, detail, tone) {
    const toast = document.createElement("div");
    toast.className = `toast ${tone || "success"}`;
    toast.innerHTML = `${icon(tone === "warning" ? "alert" : tone === "error" ? "close" : "check")}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
    toastRegion.appendChild(toast);
    window.setTimeout(function () { toast.remove(); }, 3600);
  }

  function modalShell(options) {
    return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal ${options.large ? "large" : ""}" role="dialog" aria-modal="true" data-modal-panel><header class="modal-head"><div class="modal-title"><span>${icon(options.iconName || "info")}</span><div><h2>${escapeHtml(options.title)}</h2><p>${escapeHtml(options.subtitle || "")}</p></div></div><button class="btn icon-only" type="button" data-action="close-modal" aria-label="关闭">${icon("close", "sm")}</button></header><div class="modal-body">${options.body || ""}</div><footer class="modal-foot">${options.footer || '<button class="btn" type="button" data-action="close-modal">关闭</button>'}</footer></section></div>`;
  }

  function flowModal(snapshot) {
    const progress = progressInfo(snapshot);
    const executeButton = progress.next
      ? `<button class="btn primary" type="button" data-action="execute-step" data-step-id="${escapeHtml(progress.next.id)}">执行下一步 · ${escapeHtml(progress.next.title)}</button>`
      : "";
    return modalShell({ title: "S002 链路进度", subtitle: `${progress.done}/${progress.total} 项来源状态已确认`, iconName: "layers", large: true, body: `<div class="step-list">${WORKFLOW.map(function (step, index) { const done = snapshot.progress[step.id]; const active = progress.next?.id === step.id; return `<button class="step-row ${done ? "done" : active ? "active" : ""}" type="button" data-route="#module/${step.module}"><span class="step-index">${done ? icon("check", "sm") : index + 1}</span><span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(MODULE_BY_ID[step.module].name)} · ${escapeHtml(step.summary)}</small></span><em>${done ? "已确认" : active ? "下一步" : "待开始"}</em></button>`; }).join("")}</div>`, footer: `<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn" type="button" data-action="open-checkpoints">查看 Checkpoint</button>${executeButton}` });
  }

  function applyActionReviewEvidencePlan(requests) {
    const plan = new Map((DATA.actionReviewPlan || []).map(function (item) { return [item.sourceId, item]; }));
    const planned = requests.filter(function (request) { return plan.has(request.sourceId); });
    if (planned.length !== plan.size) return false;
    for (const request of planned) {
      const evidence = plan.get(request.sourceId);
      // Some records intentionally remain in “待我决策” for the completed
      // demonstration.  The review plan still declares the eventual decision
      // branch for reproducible checkpoint tests, while the live workbench
      // leaves pending=true records untouched until the administrator opens
      // the baseline M04 decision interaction.
      if (evidence.pending === true) continue;
      const metadata = { reason: evidence.reason, owner: evidence.owner, ownerId: evidence.ownerId, due: evidence.due, instructions: evidence.instructions };
      // `await` is an intentional terminal presentation state for this
      // demonstration: the request remains a draft in “待我决策” and is not
      // auto-confirmed. Only explicit confirm/reject calls may create a
      // platform todo or close the decision item.
      const result = evidence.decision === "confirm"
        ? STORE.confirmAction(request.requestId, metadata)
        : evidence.decision === "reject"
          ? STORE.rejectAction(request.requestId, metadata)
          : evidence.decision === "await"
            ? true
            : false;
      if (!result) return false;
    }
    return true;
  }

  function executeWorkflowStep(stepId) {
    const snapshot = STORE.get();
    const progress = progressInfo(snapshot);
    const step = WORKFLOW.find(function (item) { return item.id === stepId; });
    if (!step || progress.next?.id !== stepId) {
      showToast("当前步骤不可执行", progress.next ? `请先完成：${progress.next.title}` : "本次链路状态已全部确认。", "warning");
      return;
    }
    let result = false;
    if (stepId === "dataConnected") result = STORE.connectData();
    else if (stepId === "qualityPassed") result = STORE.runQuality();
    else if (stepId === "assetPublished") result = STORE.publishData();
    else if (stepId === "mappingApplied") result = STORE.applyMapping();
    else if (stepId === "ontologyPublished") result = STORE.publishOntology();
    else if (stepId === "queryRun") {
      const runs = DATA.questions.map(function (question) { return STORE.executeQuestion(question.id); }).filter(Boolean);
      result = runs.length === DATA.questions.length;
    } else if (stepId === "rulesRun") result = STORE.runRules();
    else if (stepId === "actionsDrafted") result = STORE.submitActions();
    else if (stepId === "actionConfirmed") {
      const current = STORE.get();
      if (current.decisionSummary?.status === "no-runtime-actions") result = true;
      else {
        const requests = current.actionRequests;
        const planApplied = applyActionReviewEvidencePlan(requests);
        const reviewed = STORE.get();
        const reviewPlanBySource = new Map((DATA.actionReviewPlan || []).map(function (item) { return [item.sourceId, item]; }));
        result = planApplied
          && reviewed.actionRequests.some(function (request) { return request.status === "confirmed"; })
          && reviewed.actionRequests.some(function (request) { return request.status === "rejected"; })
          && reviewed.actionRequests.every(function (request) {
            return ["confirmed", "rejected", "simulated-confirmed"].includes(request.status)
              || (request.status === "draft" && reviewPlanBySource.get(request.sourceId)?.pending === true);
          })
          && reviewed.todos.length === reviewed.actionRequests.filter(function (request) { return ["confirmed", "simulated-confirmed"].includes(request.status); }).length;
      }
    } else if (stepId === "todoCreated") result = STORE.get().progress.todoCreated;
    else if (stepId === "agentsRun") result = STORE.runAgents();
    else if (stepId === "reportBuilt") result = STORE.buildReport();
    else if (stepId === "dashboardPublished") result = STORE.publishDashboard();
    if (!result) {
      showToast("步骤未完成", `${step.title}未满足现有前置条件。`, "warning");
      return;
    }
    closeModal();
    navigate(`#module/${step.module}`);
    showToast("步骤已完成", `${step.title}已写入当前 S002 运行轮次。`, "success");
  }

  function checkpointCatalogModal() {
    return modalShell({ title: "S002 分步不可变快照", subtitle: "C034 · 历史只读 / 克隆恢复 / 隔离回归", iconName: "layers", large: true, body: `<div class="checkpoint-grid">${DATA.checkpoints.map(function (checkpoint, index) { return `<article class="checkpoint-card"><header><span>${String(index + 1).padStart(2, "0")}</span><code>${checkpoint.id}</code></header><h2>${escapeHtml(checkpoint.label)}</h2><p>${escapeHtml(checkpoint.node)}</p><div><button class="btn" type="button" data-action="view-checkpoint" data-checkpoint-id="${checkpoint.id}">${icon("eye", "sm")}查看清单</button>${checkpoint.id === "CP07" ? `<button class="btn soft" type="button" data-action="restore-checkpoint" data-checkpoint-id="CP07">${icon("restore", "sm")}克隆恢复</button><button class="btn" type="button" data-action="regress-checkpoint" data-checkpoint-id="CP07">${icon("shield", "sm")}隔离回归</button>` : ""}</div></article>`; }).join("")}</div>${boundaryNotice()}`, footer: '<button class="btn" type="button" data-action="close-modal">关闭</button>' });
  }

  function resetModal(snapshot) {
    return modalShell({ title: "重置当前场景", subtitle: `S002 · ${DATA.scenario.name}`, iconName: "reset", body: `<div class="reset-warning">${icon("alert")}<div><strong>只重置当前 S002 工作投影</strong><span>重置将创建新的 scenarioRunId，不删除其他场景、历史 Checkpoint、源文件或冻结基线。</span><code>${escapeHtml(snapshot.context.scenarioRunId)}</code></div></div>`, footer: '<button class="btn" type="button" data-action="close-modal">保留当前状态</button><button class="btn danger" type="button" data-action="confirm-reset">确认重置 S002</button>' });
  }

  function renderModal() {
    if (!modalState) { modalRoot.innerHTML = ""; return; }
    if (modalState.kind === "flow") modalRoot.innerHTML = flowModal(STORE.get());
    else if (modalState.kind === "checkpoints") modalRoot.innerHTML = checkpointCatalogModal();
    else if (modalState.kind === "reset") modalRoot.innerHTML = resetModal(STORE.get());
  }

  function closeModal() { modalState = null; modalRoot.innerHTML = ""; }

  function checkpointById(id) {
    return DATA.checkpoints.find(function (checkpoint) { return checkpoint.id === id; });
  }

  function openCheckpointDetail(checkpoint) {
    STORE.loadCheckpoint(checkpoint).then(function (manifest) {
      modalRoot.innerHTML = modalShell({ title: `${checkpoint.id} ${checkpoint.label}`, subtitle: manifest.checkpointId, iconName: "layers", large: true, body: `<div class="result-facts"><div><span>节点</span><strong>${escapeHtml(manifest.checkpointNode)}</strong></div><div><span>父基线</span><strong>${escapeHtml(manifest.baselineVersion)}</strong></div><div><span>场景 runId</span><strong>${escapeHtml(manifest.scenarioContext.scenarioRunId)}</strong></div><div><span>恢复校验</span><strong>${escapeHtml(manifest.restoreReadiness.status)}</strong></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>模块</th><th>版本</th><th>导出 ID</th><th>Owner 校验</th></tr></thead><tbody>${Object.values(manifest.modules).map(function (module) { return `<tr><td>${escapeHtml(module.moduleId)}</td><td>${escapeHtml(module.moduleVersion)}</td><td><code>${escapeHtml(module.exportId)}</code></td><td><span class="status-badge success">${escapeHtml(module.validation.status)}</span></td></tr>`; }).join("")}</tbody></table></div><div class="evidence-box"><strong>副作用策略</strong><code>Action Request / 通知 / 审批 / 待办 / 外部派发 = false</code></div>`, footer: `<button class="btn" type="button" data-action="open-checkpoints">返回快照目录</button><button class="btn soft" type="button" data-action="historical-checkpoint" data-checkpoint-id="${checkpoint.id}">${icon("eye", "sm")}历史只读查看</button>` });
    }).catch(function (error) { showToast("读取 Checkpoint 失败", error.message, "error"); });
  }

  function refreshFrame() {
    const frame = document.getElementById("module-frame");
    if (frame?.contentWindow) frame.contentWindow.postMessage({ channel: "ofw.s002", type: "refresh" }, window.location.origin);
    render();
    showToast("状态已更新", "已重新读取 S002 六模块当前状态。", "success");
  }

  function handleAction(target) {
    const action = target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "toggle-navigation") { navCollapsed = !navCollapsed; try { localStorage.setItem(SHELL_NAV_KEY, String(navCollapsed)); } catch (_) {} render(); return; }
    if (action === "return-context") { returnToPrevious(); return; }
    if (action === "open-flow") { modalState = { kind: "flow" }; renderModal(); return; }
    if (action === "open-checkpoints") { modalState = { kind: "checkpoints" }; renderModal(); return; }
    if (action === "open-reset") { modalState = { kind: "reset" }; renderModal(); return; }
    if (action === "close-modal") { closeModal(); return; }
    if (action === "execute-step") { executeWorkflowStep(target.closest("[data-step-id]").dataset.stepId); return; }
    if (action === "backdrop-close" && target === target.closest(".modal-backdrop")) { closeModal(); return; }
    if (action === "refresh-source") { refreshFrame(); return; }
    if (action === "home-domain") { homeDomain = target.closest("[data-domain]").dataset.domain; render(); return; }
    if (action === "confirm-reset") {
      try {
        const result = STORE.reset();
        closeModal();
        showToast("S002 已定向重置", `新运行轮次：${result.context.scenarioRunId}`);
        navigate("#home", { replace: true });
      } catch (error) { showToast("当前运行不可重置", error.message, "warning"); }
      return;
    }
    if (action === "view-checkpoint") { openCheckpointDetail(checkpointById(target.closest("[data-checkpoint-id]").dataset.checkpointId)); return; }
    if (["historical-checkpoint", "restore-checkpoint", "regress-checkpoint"].includes(action)) {
      const checkpoint = checkpointById(target.closest("[data-checkpoint-id]").dataset.checkpointId);
      const operation = action === "historical-checkpoint" ? STORE.historicalView : action === "restore-checkpoint" ? STORE.cloneRestore : STORE.isolatedRegression;
      operation(checkpoint).then(function (result) {
        closeModal();
        const detail = action === "historical-checkpoint" ? "保留原 scenarioRunId，仅只读展示。" : action === "restore-checkpoint" ? `新运行轮次：${result.context.scenarioRunId}` : `隔离回归轮次：${result.context.scenarioRunId}`;
        showToast(action === "historical-checkpoint" ? "已进入历史只读查看" : action === "restore-checkpoint" ? "已克隆恢复" : "已创建隔离回归", detail, action === "historical-checkpoint" ? "warning" : "success");
        navigate("#home", { replace: true });
      }).catch(function (error) { showToast("快照操作失败", error.message, "error"); });
    }
  }

  function reviewM04OwnerAction(message) {
    const snapshot = STORE.get();
    const suppliedContext = message && message.context;
    if (!suppliedContext
      || suppliedContext.scenarioId !== snapshot.context.scenarioId
      || suppliedContext.scenarioVersion !== snapshot.context.scenarioVersion
      || suppliedContext.scenarioRunId !== snapshot.context.scenarioRunId) {
      return { outcome: "rejected", reason: "M04人工决定与当前S002运行轮次不匹配。" };
    }
    if (!["confirm", "reject"].includes(message.decision)) return { outcome: "rejected", reason: "M04人工决定类型无效。" };
    const metadata = message.metadata && typeof message.metadata === "object" ? {
      reason: message.metadata.reason,
      owner: message.metadata.owner,
      ownerId: message.metadata.ownerId,
      due: message.metadata.due || message.metadata.dueDate,
      instructions: message.metadata.instructions
    } : {};
    const reviewed = message.decision === "confirm"
      ? STORE.confirmAction(message.requestId, metadata)
      : STORE.rejectAction(message.requestId, metadata);
    if (!reviewed) return { outcome: "rejected", reason: snapshot.mode === "historical" ? "历史快照只读，禁止提交人工决定。" : "该Action Request状态已变化或不可评审。" };
    const current = STORE.get();
    return { outcome: "accepted", request: reviewed, decisionSummary: current.decisionSummary, todoCount: current.todos.length };
  }

  document.addEventListener("click", function (event) {
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) { event.preventDefault(); navigate(routeTarget.dataset.route); return; }
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) handleAction(actionTarget);
  });
  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin || event.data?.channel !== "ofw.s002") return;
    if (event.data.type === "request-view-context") {
      const frame = document.getElementById("module-frame");
      const requestedView = event.data.view || renderedFrameId;
      if (!frame?.contentWindow || event.source !== frame.contentWindow || requestedView !== renderedFrameId) return;
      adaptFrame(frame, requestedView);
      return;
    }
    if (event.data.type === "view-context" && event.data.view && event.data.context) { frameViewContexts[event.data.view] = event.data.context; return; }
    if (event.data.type === "navigate" && event.data.route) navigate(event.data.route);
    if (event.data.type === "submit-dashboard-action") {
      const request = STORE.submitDashboardAction(event.data.sourceId);
      const result = request ? { outcome: "accepted", request: request } : { outcome: "rejected", reason: "该预警尚未满足驾驶舱发布、决策草稿或场景候选校验条件。" };
      event.source?.postMessage({ channel: "ofw.s002", type: "dashboard-action-result", correlationId: event.data.correlationId || null, ...result }, event.origin);
      if (request) {
        render();
        showToast("已形成待我决策事项", `${request.actionType} · ${request.businessOwner}；仅生成平台内草稿，未向外部预算系统派发。`, "success");
      }
      return;
    }
    if (event.data.type === "m04-review-action") {
      const result = reviewM04OwnerAction(event.data);
      event.source?.postMessage({ channel: "ofw.s002", type: "m04-review-action-result", correlationId: event.data.correlationId || null, ...result }, event.origin);
      if (result.outcome === "accepted") {
        const label = result.request?.status === "simulated-confirmed"
          ? "隔离回归确认已记录，待办副作用已抑制"
          : event.data.decision === "confirm"
            ? "已人工确认并形成平台内待办"
            : "已人工拒绝且未形成待办";
        showToast("M04 决策已写入当前运行", `${label}；外部预算系统未派发。`, "success");
      }
      return;
    }
    if (event.data.type === "state-changed") render();
  });
  STORE.subscribe(function () { render(); });
  window.S002_SHELL = Object.freeze({ navigate: navigate, refresh: refreshFrame, reviewM04Action: reviewM04OwnerAction, currentFrame: function () { return renderedFrameId; } });
  history.replaceState({ ...(history.state || {}), s002Shell: true, scenarioId: "S002", s002Depth: Number(history.state?.s002Depth || 0) }, "", window.location.href);
  if (!deliveryCheckpoint) {
    if (freshEntryRequested) {
      try { STORE.reset(); } catch (error) { /* A new empty context is already usable. */ }
    }
    render();
  } else {
    const completedRun = deliveryEntryMode === "complete";
    const existing = STORE.get();
    const existingCompletedRun = completedRun
      && existing.mode !== "historical"
      && WORKFLOW.every(function (step) { return Boolean(existing.progress[step.id]); });
    if (existingCompletedRun) {
      deliveryEntryBooting = false;
      render();
    } else {
      app.innerHTML = completedRun
        ? '<section class="consume-gate" aria-live="polite"><h1>正在创建 S002 全链路演示运行</h1><p>从 CP07 完成快照克隆新的隔离运行；保留全部模块状态，不覆盖历史证据，也不会重放 Action、待办或外部派发。</p></section>'
        : '<section class="consume-gate" aria-live="polite"><h1>正在装载 S002 历史快照</h1><p>仅查看 CP07 端到端联调证据；不会创建新的场景运行，也不会重放 Action、待办或外部派发。</p></section>';
      const operation = completedRun ? STORE.cloneRestore : STORE.historicalView;
      operation(deliveryCheckpoint).then(function () {
        deliveryEntryBooting = false;
        render();
      }).catch(function (error) {
        deliveryEntryBooting = false;
        render();
        showToast(completedRun ? "全链路演示运行创建失败" : "历史快照装载失败", error.message, "error");
      });
    }
  }
})();
