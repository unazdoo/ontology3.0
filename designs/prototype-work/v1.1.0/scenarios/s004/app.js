(function () {
  "use strict";

  const DATA = window.S004_DATA;
  const STORE = window.S004_STORE;
  const BRIDGE = window.S004Bridge;
  const VIEWS = window.S004ModuleViews;
  const VALIDATORS = window.S004Validators;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");

  let modalState = null;

  const iconPaths = Object.freeze({
    home: '<path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path><path d="M9 21v-7h6v7"></path>',
    route: '<circle cx="6" cy="6" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="M8.5 6h4.2a3.3 3.3 0 0 1 0 6.6H11a3.3 3.3 0 0 0 0 6.6h4.5"></path>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"></ellipse><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"></path><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"></path>',
    network: '<circle cx="12" cy="5" r="2.5"></circle><circle cx="5" cy="18" r="2.5"></circle><circle cx="19" cy="18" r="2.5"></circle><path d="m10.6 7.1-4.2 8.7M13.4 7.1l4.2 8.7M7.5 18h9"></path>',
    sparkles: '<path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"></path><path d="m5 14 .9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14Zm14-2 .8 1.8 1.8.8-1.8.8L19 17l-.8-1.8-1.8-.8 1.8-.8L19 12Z"></path>',
    target: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1.5"></circle><path d="M12 3v3m9 6h-3M12 21v-3M3 12h3"></path>',
    bot: '<rect x="4" y="7" width="16" height="12" rx="3"></rect><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8"></path>',
    file: '<path d="M6 2h8l4 4v16H6z"></path><path d="M14 2v5h5M9 12h6M9 16h6"></path>',
    archive: '<path d="M4 7h16v14H4zM3 3h18v4H3z"></path><path d="M9 11h6"></path>',
    link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"></path>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
    refresh: '<path d="M20 7v5h-5"></path><path d="M4 17v-5h5"></path><path d="M6.1 8A7 7 0 0 1 18.8 6L20 8M4 16l1.2 2A7 7 0 0 0 17.9 16"></path>',
    check: '<path d="m5 12 4 4L19 6"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    alert: '<path d="M10.3 3.9 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4m0 4h.01"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6m0-10h.01"></path>',
    close: '<path d="m6 6 12 12M18 6 6 18"></path>',
    chevron: '<path d="m9 18 6-6-6-6"></path>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"></path>',
    publish: '<path d="M12 16V3m-5 5 5-5 5 5"></path><path d="M5 13v8h14v-8"></path>',
    key: '<circle cx="8" cy="15" r="4"></circle><path d="m11 12 8-8m-3 3 2 2m-5 1 2 2"></path>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.8 3.2 8 7.5 9.5 4.3-1.5 7.5-4.7 7.5-9.5V6L12 3Z"></path><path d="m9 12 2 2 4-4"></path>',
    building: '<path d="M4 21V8l8-5 8 5v13M8 10h2m4 0h2M8 14h2m4 0h2M8 18h8"></path>',
    metric: '<path d="M4 19V9m5 10V5m5 14v-7m5 7V3"></path>',
    ban: '<circle cx="12" cy="12" r="9"></circle><path d="m5.6 5.6 12.8 12.8"></path>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.5"></circle>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path>'
  });

  function e(value) {
    return VALIDATORS.escapeHtml(value);
  }

  function icon(name, size) {
    return '<span class="icon ' + e(size || "") + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + (iconPaths[name] || iconPaths.info) + '</svg></span>';
  }

  function statusMeta(status) {
    return {
      pending: { label: "待开始", icon: "clock" },
      running: { label: "处理中", icon: "refresh" },
      verified: { label: "已验证", icon: "check" },
      blocked: { label: "已阻断", icon: "alert" },
      not_applicable: { label: "不适用", icon: "ban" }
    }[status] || { label: "待开始", icon: "clock" };
  }

  function statusPill(status) {
    const meta = statusMeta(status);
    return '<span class="status-pill ' + e(status) + '">' + icon(meta.icon) + e(meta.label) + '</span>';
  }

  function sourceTag(tag) {
    const label = tag === "official-public" ? "公开权威" : tag === "synthetic-demo" ? "合成演示" : "人工确认";
    return '<span class="source-tag ' + e(tag) + '">' + e(label) + '</span>';
  }

  function currentState() {
    return STORE.get();
  }

  function currentProjection() {
    return STORE.getProjection();
  }

  function parseRoute() {
    const hash = window.location.hash || "#home";
    if (hash === "#home" || hash === "#" || hash === "#/") return { type: "home", active: "home", title: "场景首页" };
    if (hash === "#flow") return { type: "flow", active: "flow", title: "调查流程" };
    if (hash === "#checkpoints") return { type: "checkpoints", active: "checkpoints", title: "场景快照" };
    if (hash === "#evidence") return { type: "evidence", active: "evidence", title: "证据索引" };
    const match = hash.match(/^#module\/(data|ontology|query|decision|agent|report)$/);
    if (match) {
      const module = DATA.moduleByKey[match[1]];
      return { type: "module", active: match[1], moduleKey: match[1], moduleId: module.id, title: module.name };
    }
    return { type: "home", active: "home", title: "场景首页" };
  }

  function navigate(route, replace) {
    STORE.setUi({ lastRoute: route });
    const historyState = { s004Shell: true, scenarioId: "S004" };
    if (replace) history.replaceState(historyState, "", route);
    else history.pushState(historyState, "", route);
    closeModal();
    render();
  }

  function brandMark() {
    return '<span class="brand-mark"><span class="brain-node n1"></span><span class="brain-node n2"></span><span class="brain-node n3"></span><span class="brain-node n4"></span><span class="brain-node n5"></span><span class="brain-line l1"></span><span class="brain-line l2"></span><span class="brain-line l3"></span>' + icon("network", "lg") + '</span>';
  }

  function navMarkup(active) {
    const state = currentState();
    const items = DATA.nav.map(function (item) {
      const module = DATA.moduleByKey[item.id];
      const mode = module && module.mode !== "active" ? '<span class="nav-mode">' + (module.mode === "not-applicable" ? "N/A" : "条件") + '</span>' : "";
      return '<button class="nav-item ' + (active === item.id ? "active" : "") + '" type="button" data-route="' + e(item.route) + '" title="' + e(item.name) + '">'
        + icon(item.icon) + '<span class="nav-label">' + e(item.name) + '</span>' + mode + '</button>';
    }).join("");
    return '<nav class="global-nav" aria-label="S004 场景导航">'
      + '<button class="brand-lockup" type="button" data-route="#home">' + brandMark() + '<span class="brand-copy"><strong>' + e(DATA.brand.zh) + '</strong><small>' + e(DATA.brand.en) + '</small></span></button>'
      + '<div class="nav-context"><span>S004</span><strong>贷前调查</strong><small>' + e(DATA.scenario.borrower) + '</small></div>'
      + '<div class="nav-list">' + items + '</div>'
      + '<div class="nav-foot"><div><span>父基线</span><strong>v' + e(DATA.scenario.baselineVersion) + '</strong></div>'
      + '<button type="button" data-action="toggle-nav" aria-label="折叠或展开导航">' + icon("menu") + '</button></div>'
      + '</nav>';
  }

  function topbar(route) {
    const state = currentState();
    const projection = currentProjection();
    const next = projection.nextStepId ? DATA.stepById[projection.nextStepId] : null;
    return '<header class="global-topbar">'
      + '<div class="topbar-title"><span>' + e(route.title) + '</span><strong>' + e(DATA.scenario.name) + '</strong></div>'
      + '<div class="topbar-context"><span class="context-dot"></span><div><strong>' + e(state.scenarioContext.scenarioRunId) + '</strong><small>C033 · ' + e(state.scenarioContext.status) + '</small></div></div>'
      + '<div class="topbar-progress"><div><span>边界/步骤</span><strong>' + projection.satisfiedCount + '/' + projection.total + '</strong></div><span class="progress-track"><i style="width:' + Math.round(projection.satisfiedCount / projection.total * 100) + '%"></i></span></div>'
      + '<div class="topbar-actions"><button class="icon-button" type="button" data-action="refresh-external" title="重新读取模块导出与证据索引">' + icon("refresh") + '</button>'
      + (next ? '<button class="btn primary compact" type="button" data-action="next-step" data-step="' + e(next.id) + '">' + icon("arrow") + '<span>' + e(next.action) + '</span></button>' : '<span class="status-pill verified">' + icon("check") + '场景步骤已满足</span>')
      + '</div></header>';
  }

  function renderShell(content, route) {
    const state = currentState();
    app.innerHTML = '<div class="platform-shell ' + (state.ui.navCollapsed ? "nav-collapsed" : "") + '">'
      + navMarkup(route.active)
      + '<div class="workspace">' + topbar(route) + '<main class="workspace-main" data-screen-label="' + e(route.title) + '">' + content + '</main></div>'
      + '</div>';
    document.title = route.type === "home" ? "S004 财务公司贷款贷前调查 · 智财问策" : route.title + " · S004 · 智财问策";
  }

  function moduleIcon(moduleId) {
    const module = DATA.moduleById[moduleId];
    return '<span class="module-icon ' + e(module.color) + '">' + icon(module.icon, "lg") + '</span>';
  }

  function modulePage(options) {
    const module = DATA.moduleById[options.moduleId];
    const progress = currentProjection().modules[module.id];
    return '<div class="module-page">'
      + '<section class="module-hero"><div class="module-hero-main">' + moduleIcon(module.id) + '<div><span class="eyebrow">' + e(options.eyebrow) + '</span><h1>' + e(options.title) + '</h1><p>' + e(options.description) + '</p></div></div>'
      + '<div class="module-hero-status">' + statusPill(progress.status) + '<span>' + progress.satisfied + '/' + progress.total + ' 已满足</span></div></section>'
      + options.body + '</div>';
  }

  function ownerExport(moduleId) {
    const result = BRIDGE.validateModuleExport(moduleId);
    const tone = result.status === "verified-reference" ? "verified" : result.status === "rejected" ? "blocked" : "pending";
    const label = result.status === "verified-reference" ? "Owner 导出已定位" : result.status === "rejected" ? "Owner 导出被拒绝" : "等待 Owner 导出";
    return '<span class="owner-export ' + tone + '" title="' + e(result.errors ? result.errors.join("；") : "") + '">' + icon(result.status === "verified-reference" ? "check" : result.status === "rejected" ? "alert" : "archive") + e(label) + '</span>';
  }

  function canRunStep(step, projection, state) {
    const record = projection.steps[step.id];
    if (!record || ["verified", "running", "not_applicable"].includes(record.status)) return false;
    if (step.prerequisite && !projection.steps[step.prerequisite].satisfied) return false;
    if (step.id === "publishReport" && state.humanDecision.status !== "confirmed") return false;
    return true;
  }

  function stepAction(step, projection, state) {
    const record = projection.steps[step.id];
    if (record.status === "verified") return '<span class="step-result">' + icon("check") + '已形成当前轮次记录</span>';
    if (record.status === "not_applicable") return '<button class="btn subtle compact" type="button" data-action="inspect-step" data-step="' + e(step.id) + '">查看边界</button>';
    if (record.status === "running") return '<button class="btn compact" type="button" disabled>' + icon("refresh") + '处理中</button>';
    if (step.id === "humanReview") {
      return '<button class="btn primary compact" type="button" data-action="open-human-review" ' + (canRunStep(step, projection, state) ? "" : "disabled") + '>' + icon("eye") + e(step.action) + '</button>';
    }
    return '<button class="btn primary compact" type="button" data-action="run-step" data-step="' + e(step.id) + '" ' + (canRunStep(step, projection, state) ? "" : "disabled") + '>' + icon("arrow") + e(step.action) + '</button>';
  }

  function stepTable(moduleId) {
    const projection = currentProjection();
    const state = currentState();
    const module = DATA.moduleById[moduleId];
    return '<div class="step-table">' + module.steps.map(function (stepId) {
      const step = DATA.stepById[stepId];
      const record = projection.steps[stepId];
      return '<div class="step-row ' + e(record.status) + '"><span class="step-order">' + String(step.order).padStart(2, "0") + '</span>'
        + '<div class="step-copy"><div><strong>' + e(step.title) + '</strong>' + statusPill(record.status) + '</div><p>' + e(record.detail) + '</p></div>'
        + '<div class="step-action">' + stepAction(step, projection, state) + '</div></div>';
    }).join("") + '</div>';
  }

  function pipelineNode(number, title, detail, iconName) {
    return '<div class="pipeline-node"><span>' + number + '</span><div class="pipeline-node-icon">' + icon(iconName) + '</div><div><strong>' + e(title) + '</strong><small>' + e(detail) + '</small></div></div>';
  }

  function boundaryPrinciple(title, detail) {
    return '<div class="boundary-principle">' + icon("check") + '<div><strong>' + e(title) + '</strong><p>' + e(detail) + '</p></div></div>';
  }

  function gateNode(number, title, detail) {
    return '<div class="gate-node"><span>' + e(number) + '</span><strong>' + e(title) + '</strong><small>' + e(detail) + '</small></div>';
  }

  function gateArrow() {
    return '<span class="gate-arrow">' + icon("arrow") + '</span>';
  }

  function sideEffect(title, allowed) {
    return '<div class="side-effect"><span class="' + (allowed ? "on" : "off") + '">' + icon(allowed ? "check" : "ban") + '</span><div><strong>' + e(title) + '</strong><small>' + (allowed ? "允许" : "默认禁止") + '</small></div></div>';
  }

  function agentNode(title, status, detail) {
    return '<div class="agent-node ' + e(status) + '"><span>' + icon(status === "verified" ? "check" : status === "running" ? "refresh" : "clock") + '</span><strong>' + e(title) + '</strong><small>' + e(detail) + '</small></div>';
  }

  function agentArrow() {
    return '<span class="agent-arrow">' + icon("arrow") + '</span>';
  }

  function renderHome() {
    const state = currentState();
    const projection = currentProjection();
    const next = projection.nextStepId ? DATA.stepById[projection.nextStepId] : null;
    const modules = DATA.modules.map(function (module) {
      const progress = projection.modules[module.id];
      return '<button class="module-card" type="button" data-route="' + e(module.route) + '">'
        + '<div class="module-card-head">' + moduleIcon(module.id) + statusPill(progress.status) + '</div>'
        + '<strong>' + e(module.name) + '</strong><p>' + e(module.description) + '</p>'
        + '<div class="module-card-foot"><span>' + progress.satisfied + '/' + progress.total + ' 已满足</span>' + icon("chevron") + '</div></button>';
    }).join("");
    const flow = DATA.workflow.map(function (step) {
      const record = projection.steps[step.id];
      return '<button class="flow-dot ' + e(record.status) + '" type="button" data-action="inspect-step" data-step="' + e(step.id) + '" title="' + e(step.title) + '">'
        + '<span>' + String(step.order).padStart(2, "0") + '</span><small>' + e(step.title) + '</small></button>';
    }).join("");
    const reportSections = DATA.reportDefinition.map(function (section) {
      return '<div><span>' + e(section.id.replace("SEC-", "")) + '</span><strong>' + e(section.title.replace(/^.+、/, "")) + '</strong></div>';
    }).join("");

    const content = '<div class="home-view">'
      + '<section class="home-status-strip"><div class="scenario-heading"><span class="eyebrow">S004 · PRE-LOAN INVESTIGATION</span><h1>财务公司贷款贷前调查</h1><p>以中国广核电力股份有限公司为演示借款人，完整演练数据、Published 语义、固定证据、Agent 草稿、核验、人工复核与同源发布。</p></div>'
      + '<div class="status-stat"><span>当前轮次</span><strong>' + e(state.scenarioContext.scenarioRunId.slice(-12)) + '</strong><small>与分步 Checkpoint 使用同一 C033 身份</small></div>'
      + '<div class="status-stat"><span>父基线</span><strong>v1.0.3</strong><small>' + e(DATA.scenario.baselineSnapshotId) + '</small></div>'
      + '<div class="next-action"><span>下一步</span><strong>' + e(next ? next.title : "场景步骤已满足") + '</strong>'
      + (next ? '<button class="btn primary" type="button" data-action="next-step" data-step="' + e(next.id) + '">' + icon("arrow") + e(next.action) + '</button>' : '<button class="btn" type="button" data-route="#checkpoints">' + icon("archive") + '查看快照</button>')
      + '</div></section>'
      + '<section class="home-grid">'
      + '<div class="panel span-2"><div class="panel-head"><div><h2>六模块场景投影</h2><p>保持既有模块 Owner；场景壳只负责身份、导航和只读汇总。</p></div><button class="text-button" type="button" data-route="#flow">查看完整流程' + icon("arrow") + '</button></div><div class="module-card-grid">' + modules + '</div></div>'
      + '<div class="panel"><div class="panel-head"><div><h2>最小贷款方案</h2><p>一期只演示一笔人民币一年期流动资金信用贷款。</p></div></div>'
      + '<dl class="key-value-list compact"><div><dt>借款人</dt><dd>' + e(DATA.scenario.borrower) + '</dd></div><div><dt>申请编号</dt><dd>' + e(DATA.stableIdentities.applicationId) + '</dd></div><div><dt>币种 / 期限</dt><dd>' + e(DATA.loanPlan.currency + " / " + DATA.loanPlan.term) + '</dd></div><div><dt>用途</dt><dd>' + e(DATA.loanPlan.purpose) + '</dd></div><div><dt>担保</dt><dd>' + e(DATA.loanPlan.guarantee) + '</dd></div><div><dt>金额</dt><dd>' + e(state.humanDecision.status === "confirmed" ? (state.humanDecision.amount || DATA.loanPlan.approvedAmount) : DATA.loanPlan.amount) + '</dd></div></dl></div>'
      + '<div class="panel"><div class="panel-head"><div><h2>正式报告定义</h2><p>沿用用户提供输出报告的共同结构。</p></div><button class="text-button" type="button" data-route="#module/report">进入报告中心' + icon("chevron") + '</button></div><div class="report-section-mini">' + reportSections + '</div></div>'
      + '<div class="panel span-2"><div class="panel-head"><div><h2>全场景推进轨迹</h2><p>不适用边界单独记录；业务步骤必须由真实交互形成。</p></div><span class="mini-progress">' + projection.satisfiedCount + '/' + projection.total + '</span></div><div class="flow-dot-grid">' + flow + '</div></div>'
      + '<div class="governance-note span-2">' + icon("shield", "lg") + '<div><strong>场景壳不是第二套模块真值</strong><p>浏览器状态只是可丢弃的当前工作投影。正式数据资产、Published 本体、Agent Run、报告和 Checkpoint 均以对应 Owner 导出及不可变证据为准。</p></div><button class="btn subtle" type="button" data-route="#evidence">查看证据边界</button></div>'
      + '</section></div>';
    renderShell(content, { type: "home", active: "home", title: "场景首页" });
  }

  function renderFlow() {
    const projection = currentProjection();
    const state = currentState();
    const groups = [
      { title: "数据接入与质量", ids: ["configure", "registerSources", "qualityGate", "publishAsset"] },
      { title: "Published 语义", ids: ["mapOntology", "publishSemantics", "queryBoundary", "decisionBoundary"] },
      { title: "报告生成与发布", ids: ["freezeEvidence", "generateDraft", "bindAnchors", "verifyFacts", "humanReview", "publishReport", "companionRun"] }
    ];
    const groupMarkup = groups.map(function (group) {
      return '<section class="flow-group"><div class="flow-group-head"><span>' + e(group.title) + '</span><strong>' + group.ids.filter(function (id) { return projection.steps[id].satisfied; }).length + '/' + group.ids.length + '</strong></div>'
        + group.ids.map(function (id) {
          const step = DATA.stepById[id];
          const record = projection.steps[id];
          return '<article class="flow-step-card ' + e(record.status) + '"><div class="flow-step-line"><span>' + String(step.order).padStart(2, "0") + '</span><i></i></div>'
            + '<div class="flow-step-content"><div><span class="owner-label">' + e(step.moduleId) + '</span>' + statusPill(record.status) + '</div><h2>' + e(step.title) + '</h2><p>' + e(record.detail) + '</p>'
            + (step.checkpointNode ? '<small class="checkpoint-label">' + icon("archive") + e(step.checkpointNode) + '</small>' : "")
            + '</div><div class="flow-step-action">' + stepAction(step, projection, state) + '</div></article>';
        }).join("") + '</section>';
    }).join("");
    renderShell('<div class="flow-view"><section class="page-heading"><div><span class="eyebrow">CONTROLLED END-TO-END FLOW</span><h1>S004 最小完整闭环</h1><p>每一步读取上游稳定引用；没有资料证据的功能不进入一期。</p></div><button class="btn subtle" type="button" data-action="open-reset">' + icon("refresh") + '重置当前场景</button></section>' + groupMarkup + '</div>', { type: "flow", active: "flow", title: "调查流程" });
  }

  function renderModule(moduleKey) {
    const module = DATA.moduleByKey[moduleKey];
    const renderer = VIEWS && VIEWS.renderers && VIEWS.renderers[moduleKey];
    if (!module || typeof renderer !== "function") return renderHome();
    const context = {
      data: DATA,
      state: currentState(),
      projection: currentProjection(),
      e: e,
      icon: icon,
      statusPill: statusPill,
      sourceTag: sourceTag,
      modulePage: modulePage,
      ownerExport: ownerExport,
      stepTable: stepTable,
      pipelineNode: pipelineNode,
      boundaryPrinciple: boundaryPrinciple,
      gateNode: gateNode,
      gateArrow: gateArrow,
      sideEffect: sideEffect,
      agentNode: agentNode,
      agentArrow: agentArrow
    };
    renderShell(renderer(context), { type: "module", active: moduleKey, title: module.name });
  }

  function checkpointRecords() {
    const state = currentState();
    const external = state.external && state.external.checkpoints && state.external.checkpoints.value;
    if (external) {
      const candidates = external.checkpoints || external.items || external.manifests;
      if (Array.isArray(candidates)) return candidates;
    }
    return state.checkpointCandidates || [];
  }

  function renderCheckpoints() {
    const records = checkpointRecords();
    const nodes = DATA.checkpointNodes.map(function (node, index) {
      const record = records.find(function (item) {
        return item && (item.node === node || item.checkpointNode === node);
      });
      const status = record ? record.status || "available" : "not-formed";
      const formedAt = record && (record.formedAt || record.createdAt);
      return '<article class="checkpoint-card ' + (record ? "available" : "") + '"><div class="checkpoint-index">CP' + String(index).padStart(2, "0") + '</div>'
        + '<div><span class="eyebrow">' + e(node) + '</span><h2>' + e(checkpointTitle(node)) + '</h2><p>' + e(record && (record.note || record.description) || "等待真实步骤和模块 Owner 导出后形成不可变清单。") + '</p></div>'
        + '<div class="checkpoint-meta"><span>' + e(status) + '</span><strong>' + e(formedAt || "尚未形成") + '</strong></div></article>';
    }).join("");
    const operations = '<div class="operation-grid">'
      + operationCard("历史查看", "沿用原 scenarioRunId，只读展示当时状态与证据。", "eye")
      + operationCard("克隆恢复", "创建新 scenarioRunId 和隔离命名空间，不覆盖历史。", "copy")
      + operationCard("隔离回归", "默认演练模式，禁止重放历史 Action、通知和待办。", "shield")
      + operationCard("基线迁移", "形成新 scenarioVersion、runId 和迁移对照，禁止原地换父版本。", "route")
      + '</div>';
    renderShell('<div class="checkpoint-view"><section class="page-heading"><div><span class="eyebrow">C034 · IMMUTABLE CHECKPOINTS</span><h1>场景快照与恢复语义</h1><p>页面只展示清单引用，不将 localStorage、DOM 或临时 JSON 作为正式快照真源。</p></div><button class="btn" type="button" data-action="refresh-external">' + icon("refresh") + '重新读取清单</button></section>' + operations + '<section class="checkpoint-list">' + nodes + '</section></div>', { type: "checkpoints", active: "checkpoints", title: "场景快照" });
  }

  function checkpointTitle(node) {
    return {
      "initial-configured": "场景初始配置完成",
      "data-connected": "数据接入完成",
      "published-switched": "Published 切换完成",
      "query-integrated": "问数联调边界完成",
      "decision-chain-completed": "决策链条件门完成",
      "agent-report-dashboard-completed": "Agent 与报告完成",
      "e2e-integrated": "端到端联调完成",
      "pre-risk-change": "高风险修改前保护点"
    }[node] || node;
  }

  function operationCard(title, detail, iconName) {
    return '<article>' + icon(iconName, "lg") + '<div><strong>' + e(title) + '</strong><p>' + e(detail) + '</p></div></article>';
  }

  function renderEvidence() {
    const resources = BRIDGE.resourceSummary().map(function (resource) {
      return '<div class="resource-row"><span class="resource-icon">' + icon(resource.status === "available" ? "check" : resource.status.indexOf("rejected") === 0 ? "alert" : "archive") + '</span><div><strong>' + e(resource.key) + '</strong><code>' + e(resource.path) + '</code></div><span class="resource-status ' + e(resource.status) + '">' + e(resource.status) + '</span></div>';
    }).join("");
    const identities = Object.entries(DATA.stableIdentities).map(function (entry) {
      return '<div><dt>' + e(entry[0]) + '</dt><dd>' + e(entry[1]) + '</dd></div>';
    }).join("");
    const owners = DATA.modules.map(function (module) {
      const owner = window.S004Contracts.moduleOwners[module.id];
      return '<article class="owner-card">' + moduleIcon(module.id) + '<div><span>' + e(module.id + " · " + owner.owner) + '</span><strong>' + e(owner.owns.join("、")) + '</strong><small>' + e(owner.boundaries[0]) + '</small></div>' + ownerExport(module.id) + '</article>';
    }).join("");
    renderShell('<div class="evidence-view"><section class="page-heading"><div><span class="eyebrow">OWNER REFERENCES · EVIDENCE INDEX</span><h1>证据与稳定身份</h1><p>场景壳只定位外部证据和模块导出；无法定位时明确显示，不自行补造。</p></div><button class="btn" type="button" data-action="refresh-external">' + icon("refresh") + '读取索引</button></section>'
      + '<section class="evidence-grid"><div class="panel"><div class="panel-head"><div><h2>外部资源索引</h2><p>由 artifacts、module-exports、checkpoints 和 evidence 分别提供。</p></div></div><div class="resource-list">' + resources + '</div></div>'
      + '<div class="panel"><div class="panel-head"><div><h2>稳定身份</h2><p>申请、报告与证据链共享稳定键。</p></div></div><dl class="key-value-list">' + identities + '</dl></div>'
      + '<div class="panel span-2"><div class="panel-head"><div><h2>模块 Owner 定位</h2><p>场景开发不改变六模块既有资源 Owner。</p></div></div><div class="owner-grid">' + owners + '</div></div></section></div>', { type: "evidence", active: "evidence", title: "证据索引" });
  }

  function modalShell(title, subtitle, body, footer, iconName) {
    return '<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-card" role="dialog" aria-modal="true" aria-label="' + e(title) + '">'
      + '<header class="modal-head"><div><span>' + icon(iconName || "info") + '</span><div><strong>' + e(title) + '</strong><small>' + e(subtitle || "") + '</small></div></div><button class="icon-button" type="button" data-action="close-modal">' + icon("close") + '</button></header>'
      + '<div class="modal-body">' + body + '</div><footer class="modal-foot">' + footer + '</footer></section></div>';
  }

  function renderModal() {
    if (!modalState) {
      modalRoot.replaceChildren();
      return;
    }
    if (modalState.type === "reset") {
      modalRoot.innerHTML = modalShell(
        "重置当前 S004 场景",
        "将创建新的 scenarioRunId，不覆盖历史轮次",
        '<div class="warning-box">' + icon("alert", "lg") + '<div><strong>仅清理当前轮次的浏览器工作投影</strong><p>正式数据资产、Published 本体、报告、模块导出和 Checkpoint 不会被删除或回滚。</p></div></div>',
        '<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="confirm-reset">' + icon("refresh") + '确认重置</button>',
        "refresh"
      );
      return;
    }
    if (modalState.type === "human-review") {
      const human = currentState().humanDecision;
      modalRoot.innerHTML = modalShell(
        "人工复核授信结论",
        "有权审批人必须明确填写结论；Agent 不得代选",
        '<form id="human-review-form" class="review-form">'
        + '<label><span>复核人 *</span><input name="reviewer" value="' + e(human.reviewer) + '" placeholder="请输入演示复核人姓名或岗位" /></label>'
        + '<label><span>人工决定 *</span><select name="decision"><option value="">请选择</option><option value="confirm">确认按贷款方案形成授信结论</option><option value="return">退回补充调查资料</option></select></label>'
        + '<div class="form-grid"><label><span>确认金额</span><input name="amount" value="' + e(human.amount) + '" placeholder="例如：人民币 5 亿元" /></label><label><span>执行利率</span><input name="rate" value="' + e(human.rate) + '" placeholder="由人工复核确认" /></label></div>'
        + '<label><span>人工复核意见 *</span><textarea name="note" rows="4" placeholder="说明确认或退回理由"></textarea></label>'
        + '<div class="form-boundary">' + icon("shield") + '<span>本操作只形成 S004 演示人工确认记录，不代表生产职责分离、正式审批流或真实授信批复。</span></div></form>',
        '<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-human-review">' + icon("check") + '提交人工结论</button>',
        "eye"
      );
      return;
    }
    if (modalState.type === "step") {
      const step = DATA.stepById[modalState.stepId];
      const record = currentProjection().steps[modalState.stepId];
      modalRoot.innerHTML = modalShell(
        step.title,
        step.moduleId + " · 第 " + step.order + " 步",
        '<div class="step-detail-modal">' + statusPill(record.status) + '<p>' + e(record.detail) + '</p><dl><div><dt>前置步骤</dt><dd>' + e(step.prerequisite ? DATA.stepById[step.prerequisite].title : "无") + '</dd></div><div><dt>证据引用</dt><dd>' + e(record.evidenceRef || "尚未形成") + '</dd></div><div><dt>Checkpoint</dt><dd>' + e(step.checkpointNode || "本步骤不单独形成节点") + '</dd></div></dl></div>',
        '<button class="btn" type="button" data-action="close-modal">关闭</button>' + (record.status !== "not_applicable" && canRunStep(step, currentProjection(), currentState()) ? '<button class="btn primary" type="button" data-action="' + (step.id === "humanReview" ? "open-human-review" : "run-step") + '" data-step="' + e(step.id) + '">' + icon("arrow") + e(step.action) + '</button>' : ""),
        statusMeta(record.status).icon
      );
    }
  }

  function openModal(type, payload) {
    modalState = { type: type, ...(payload || {}) };
    renderModal();
    window.setTimeout(function () { modalRoot.querySelector("button, input, select")?.focus(); }, 0);
  }

  function closeModal() {
    modalState = null;
    renderModal();
  }

  function showToast(title, detail, tone) {
    const toast = document.createElement("div");
    toast.className = "toast " + (tone || "");
    toast.innerHTML = icon(tone === "success" ? "check" : tone === "error" ? "alert" : "info") + '<div><strong>' + e(title) + '</strong><span>' + e(detail || "") + '</span></div>';
    toastRegion.appendChild(toast);
    window.setTimeout(function () {
      toast.classList.add("out");
      window.setTimeout(function () { toast.remove(); }, 180);
    }, 3200);
  }

  async function runStep(stepId) {
    closeModal();
    try {
      const step = DATA.stepById[stepId];
      await STORE.runStep(stepId);
      showToast(step.title + "已记录", "当前轮次工作投影已更新；正式证据仍以模块 Owner 导出为准。", "success");
    } catch (error) {
      showToast("暂不能执行", error.message || "请检查前置步骤。", "error");
    }
  }

  function render() {
    const route = parseRoute();
    if (route.type === "home") return renderHome();
    if (route.type === "flow") return renderFlow();
    if (route.type === "module") return renderModule(route.moduleKey);
    if (route.type === "checkpoints") return renderCheckpoints();
    if (route.type === "evidence") return renderEvidence();
    return renderHome();
  }

  function ensureResponsiveNavigation() {
    const state = currentState();
    if (window.innerWidth <= 720 && !state.ui.mobileNavInitialized) {
      STORE.setUi({ navCollapsed: true, mobileNavInitialized: true });
      return true;
    }
    return false;
  }

  document.addEventListener("click", function (event) {
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      navigate(routeTarget.dataset.route);
      return;
    }
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget || actionTarget.disabled) return;
    const action = actionTarget.dataset.action;
    if (action === "toggle-nav") STORE.setUi({ navCollapsed: !currentState().ui.navCollapsed });
    if (action === "run-step") runStep(actionTarget.dataset.step);
    if (action === "next-step") {
      const step = DATA.stepById[actionTarget.dataset.step];
      if (step.id === "humanReview") openModal("human-review");
      else if (step.initialStatus === "not_applicable") openModal("step", { stepId: step.id });
      else navigate(DATA.moduleById[step.moduleId].route);
    }
    if (action === "inspect-step") openModal("step", { stepId: actionTarget.dataset.step });
    if (action === "open-human-review") openModal("human-review");
    if (action === "open-reset") openModal("reset");
    if (action === "close-modal") closeModal();
    if (action === "backdrop-close" && event.target === actionTarget) closeModal();
    if (action === "confirm-reset") {
      STORE.resetCurrentScenario();
      history.replaceState({ s004Shell: true, scenarioId: "S004" }, "", "#home");
      closeModal();
      showToast("已创建新的 S004 轮次", "历史轮次保持只读，当前浏览器投影已回到初始状态。", "success");
    }
    if (action === "submit-human-review") {
      const form = document.getElementById("human-review-form");
      const values = Object.fromEntries(new FormData(form).entries());
      try {
        const decision = STORE.confirmHumanDecision(values);
        closeModal();
        showToast(
          decision.status === "confirmed" ? "人工结论已确认" : "已退回补充调查",
          decision.status === "confirmed" ? "正式报告发布门已经打开。" : "发布门保持关闭。",
          decision.status === "confirmed" ? "success" : "warning"
        );
      } catch (error) {
        showToast("请完善人工复核信息", error.message || "表单校验未通过。", "error");
      }
    }
    if (action === "select-report-section") STORE.setUi({ selectedReportSection: actionTarget.dataset.section });
    if (action === "refresh-external") {
      BRIDGE.loadAll().then(function () {
        showToast("资源索引已重新读取", "缺失或场景不匹配的索引不会被场景壳补造。", "success");
      });
    }
  });

  window.addEventListener("popstate", render);
  window.addEventListener("hashchange", render);
  window.addEventListener(STORE.EVENT_NAME, render);
  window.addEventListener("resize", function () {
    if (!ensureResponsiveNavigation()) render();
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modalState) closeModal();
  });

  if (!window.location.hash) {
    history.replaceState({ s004Shell: true, scenarioId: "S004" }, "", "#home");
  }
  if (!ensureResponsiveNavigation()) render();
  BRIDGE.loadAll();
})();
