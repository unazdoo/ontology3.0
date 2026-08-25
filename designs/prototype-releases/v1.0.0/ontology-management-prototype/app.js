(() => {
  "use strict";

  const STORAGE_KEY = "ontology-management-product-state-v1";

  const objectTypes = [
    { id: "obj.financing_subject", name: "融资主体", definition: "独立承担融资余额、成本、结构判断和优化行动的单位。", identity: "单位编码", title: "单位名称", properties: 4, links: 2 },
    { id: "obj.financing_detail", name: "融资明细", definition: "一笔具有独立借据身份、余额、利率、期限与币种的融资事实。", identity: "借据编号", title: "借据编号", properties: 12, links: 2 },
    { id: "obj.financing_institution", name: "融资机构", definition: "向融资主体提供具体融资的金融机构。", identity: "机构编码", title: "机构名称", properties: 3, links: 1 },
    { id: "obj.financing_owner", name: "融资负责人", definition: "承接融资主体优化待办的责任人。", identity: "负责人标识", title: "负责人名称", properties: 3, links: 1 }
  ];

  const links = [
    { id: "link.subject_has_detail", name: "主体拥有融资", source: "融资主体", target: "融资明细", cardinality: "一对多", endpoint: "单位编码" },
    { id: "link.detail_provided_by_institution", name: "融资由机构提供", source: "融资明细", target: "融资机构", cardinality: "多对一", endpoint: "机构编码" },
    { id: "link.subject_owned_by_owner", name: "主体由负责人承接", source: "融资主体", target: "融资负责人", cardinality: "多对一", endpoint: "单位编码 / 负责人标识" }
  ];

  const metrics = [
    { id: "metric.financing_balance", name: "融资余额", unit: "人民币元", scope: "集团、单一主体、主体集合", definition: "所选融资明细折合人民币余额之和。" },
    { id: "metric.weighted_financing_cost", name: "余额加权平均融资成本", unit: "%", scope: "集团、单一主体、主体集合", definition: "以折合人民币余额为权重计算融资成本。" },
    { id: "metric.floating_rate_ratio", name: "浮动利率余额占比", unit: "%", scope: "集团、单一主体", definition: "浮动利率融资余额占融资余额的比例。" },
    { id: "metric.short_term_debt_ratio", name: "短期债务余额占比", unit: "%", scope: "集团、单一主体", definition: "短期融资余额占融资余额的比例。" },
    { id: "metric.foreign_currency_ratio", name: "外币融资余额占比", unit: "%", scope: "集团、单一主体", definition: "非人民币融资的折合人民币余额占比。" },
    { id: "metric.high_cost_ratio", name: "高成本融资余额占比", unit: "%", scope: "集团、单一主体", definition: "高于当前有效成本界限的融资余额占比。" },
    { id: "metric.credit_financing_ratio", name: "信用融资余额占比", unit: "%", scope: "集团、单一主体", definition: "担保方式明确为信用的融资余额占比。" }
  ];

  const rules = [
    { id: "rule.R01", name: "R01 融资成本偏高", condition: "主体成本高于集团基准 0.25 个百分点，或高成本余额占比大于 20%", depends: "余额加权平均融资成本、高成本融资余额占比" },
    { id: "rule.R02", name: "R02 浮动利率暴露", condition: "浮动利率余额占比大于 80%", depends: "浮动利率余额占比" },
    { id: "rule.R03", name: "R03 短期债务集中", condition: "短期债务余额占比大于 30%", depends: "短期债务余额占比" }
  ];

  const actionType = {
    id: "action.request_financing_optimization",
    name: "发起融资优化建议",
    target: "融资主体",
    result: "请求决策中心创建待确认提醒",
    inputs: "主体、命中规则、指标快照、优先协商银行、关联借据、数据截至时间"
  };

  const fixedCases = [
    { id: "Q01", name: "四类对象与三条关系可发现", point: "稳定身份、端点与方向" },
    { id: "Q02", name: "集团融资成本与债务结构", point: "2.16 万亿元、2.37%、95.15%" },
    { id: "Q03", name: "单位553命中 R01", point: "2.881%、欧陆银行等三家机构" },
    { id: "Q04", name: "单位465命中 R02", point: "100%、融通银行等三家机构" },
    { id: "Q05", name: "单位561命中 R03", point: "93.545%、同州银行等三家机构" },
    { id: "Q06", name: "三家组合融资成本", point: "1,183.15 亿元、2.4246%" },
    { id: "Q07", name: "两家组合融资成本", point: "按明细余额加权" },
    { id: "Q08", name: "行动类型同版可发现", point: "目标、参数与前置证据" }
  ];

  const scenarioUnits = [
    { unit: "单位553", rule: "R01", balance: "393.13 亿元", cost: "2.881%", ratio: "77.337%", owner: "负责人001", banks: "欧陆银行、寰宇银行、海联银行" },
    { unit: "单位465", rule: "R02", balance: "770.00 亿元", cost: "2.197%", ratio: "100.000%", owner: "负责人009", banks: "融通银行、启明银行、嘉禾银行" },
    { unit: "单位561", rule: "R03", balance: "20.02 亿元", cost: "2.228%", ratio: "93.545%", owner: "负责人009", banks: "同州银行、星河银行、恒信银行" }
  ];

  const defaultState = () => ({
    ontology: null,
    structureAdded: false,
    draftSaved: false,
    selectedModelResource: "obj.financing_subject",
    actionConfirm: false,
    mappingSelected: false,
    institutionMapping: "",
    mappingPreview: "idle",
    validation: "idle",
    publish: "idle",
    semanticVersion: null,
    publishedAt: null,
    cycle: 1,
    refresh: "idle",
    refreshRequestId: null,
    refreshResultId: null,
    evidence: "idle",
    evidenceAttempts: 0,
    binding: "none",
    currentBinding: null,
    previousBinding: null,
    compatibilityFixed: false,
    events: []
  });

  let state = loadState();
  const ui = {
    modal: null,
    drawer: null,
    catalogView: "cards",
    catalogType: "全部类型",
    catalogQuery: "",
    modelSection: "overview",
    objectTab: "overview",
    consumptionMode: "formal",
    consumer: "qa"
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...defaultState(), ...saved } : defaultState();
    } catch (error) {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function update(patch, event) {
    state = { ...state, ...patch };
    if (event) {
      state.events = [{ time: nowText(), ...event }, ...state.events].slice(0, 18);
    }
    saveState();
    render();
  }

  function nowText() {
    return new Date().toLocaleString("zh-CN", { hour12: false }).replaceAll("/", "-");
  }

  function compactStamp() {
    const date = new Date();
    const pad = value => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  function uid(prefix) {
    return `${prefix}-${compactStamp()}`;
  }

  function dataVersion() {
    return state.cycle === 1 ? "DATA-FIN-20260731-01" : "DATA-FIN-20260810-02";
  }

  function dataAsOf() {
    return state.cycle === 1 ? "2026-07-31 23:59:59" : "2026-08-10 23:59:59";
  }

  function bindingForPublished() {
    return state.currentBinding?.semanticVersion === state.semanticVersion ? state.currentBinding : null;
  }

  function route() {
    const raw = location.hash.replace(/^#/, "") || "overview";
    return raw.split("?")[0];
  }

  function routeParam(name) {
    const query = location.hash.split("?")[1] || "";
    return new URLSearchParams(query).get(name);
  }

  function navigate(target) {
    if (location.hash === `#${target}`) render();
    else location.hash = target;
  }

  function icon(name, size = 16) {
    return `<i data-lucide="${name}" style="width:${size}px;height:${size}px" aria-hidden="true"></i>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function status(text, tone = "", processing = false) {
    return `<span class="status ${tone} ${processing ? "processing" : ""}"><span class="dot"></span>${escapeHtml(text)}</span>`;
  }

  function button(label, action, options = {}) {
    const { primary = false, danger = false, ghost = false, small = false, disabled = false, iconName = null, title = "" } = options;
    const classes = ["btn", primary && "primary", danger && "danger", ghost && "ghost", small && "small"].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" data-action="${action}" ${disabled ? "disabled" : ""} ${title ? `title="${escapeHtml(title)}"` : ""}>${iconName ? icon(iconName) : ""}${escapeHtml(label)}</button>`;
  }

  function toast(message, tone = "") {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const item = document.createElement("div");
    item.className = `toast ${tone}`;
    item.innerHTML = `${icon(tone === "success" ? "check-circle-2" : tone === "error" ? "circle-alert" : "info")}<span>${escapeHtml(message)}</span>`;
    region.appendChild(item);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    setTimeout(() => item.remove(), 3200);
  }

  function pageTitle(currentRoute) {
    const names = {
      overview: "本体总览",
      catalog: "资源目录",
      model: "建模工作区",
      mapping: "映射与预览",
      graph: "关系图",
      versions: "版本与消费",
      object: "资源详情",
      resource: "资源详情"
    };
    return names[currentRoute] || "本体管理";
  }

  function navItem(target, label, iconName, code, activeRoutes = [target]) {
    const active = activeRoutes.includes(route());
    return `<button class="nav-item ${active ? "active" : ""}" type="button" data-nav="${target}">${icon(iconName)}<span>${label}</span></button>`;
  }

  function shell(content) {
    const currentRoute = route();
    const ontologyLabel = state.ontology ? state.ontology.name : "尚未创建本体";
    return `
      <div class="app-shell">
        <aside class="rail" aria-label="平台导航">
          <div class="rail-brand" title="Ontology 3.0">${icon("boxes", 19)}</div>
          <button class="rail-button active" type="button" title="本体管理">${icon("waypoints", 18)}</button>
          <button class="rail-button" type="button" data-action="open-help" title="帮助">${icon("circle-help", 17)}</button>
          <div class="rail-spacer"></div>
          <button class="rail-button" type="button" data-action="open-reset" title="重置状态">${icon("rotate-ccw", 17)}</button>
        </aside>
        <header class="topbar">
          <div class="crumbs"><span>Ontology 3.0</span><i>/</i><span>本体管理</span><i>/</i><b>${escapeHtml(pageTitle(currentRoute))}</b></div>
          <div class="topbar-spacer"></div>
          <div class="account"><span class="account-avatar">本</span><div class="account-copy"><b>本体管理账号</b><span>${escapeHtml(ontologyLabel)}</span></div></div>
        </header>
        <aside class="sidebar">
          <div class="module-title"><h1>${icon("waypoints")}本体管理</h1><p>对象 · 关系 · 逻辑 · 发布 · 消费</p></div>
          <div class="nav-group-label">工作区</div>
          <nav class="module-nav">
            ${navItem("overview", "总览", "layout-dashboard", "P1")}
            ${navItem("catalog", "资源目录", "library", "P2", ["catalog", "object", "resource"])}
            ${navItem("model", "建模工作区", "square-pen", "P3")}
            ${navItem("mapping", "映射与预览", "git-compare-arrows", "P5")}
            ${navItem("graph", "关系图", "share-2", "P6")}
            ${navItem("versions", "版本与消费", "package-check", "P11")}
          </nav>
          <div class="sidebar-foot">集团融资成本与债务结构优化<br />单账号工作区</div>
        </aside>
        <main class="main"><div class="content">${content}</div></main>
      </div>
      ${renderOverlay()}
    `;
  }

  function render() {
    const currentRoute = route();
    const renderers = {
      overview: renderOverview,
      catalog: renderCatalog,
      model: renderModel,
      mapping: renderMapping,
      graph: renderGraph,
      versions: renderVersions,
      object: renderObject,
      resource: renderResource
    };
    const content = (renderers[currentRoute] || renderOverview)();
    document.getElementById("app").innerHTML = shell(content);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function pageHead(eyebrow, title, description, actions = "") {
    return `<header class="page-head"><div class="page-head-copy"><div class="eyebrow">${escapeHtml(eyebrow)}</div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ""}</header>`;
  }

  function stageIndex() {
    if (!state.ontology) return 0;
    if (!state.structureAdded || state.mappingPreview !== "success") return 1;
    if (state.publish !== "published") return 2;
    if (state.binding !== "ready") return 3;
    return 4;
  }

  function progressSteps() {
    const current = stageIndex();
    const steps = [
      ["创建本体", "定义业务范围"],
      ["构建语义", "对象、关系与映射"],
      ["校验发布", "形成 Published 版本"],
      ["候选验证", "刷新结果与固定问题"],
      ["投入消费", "采用权威双版本"]
    ];
    return `<div class="progress-steps">${steps.map((item, index) => `<div class="progress-step ${index < current ? "done" : index === current ? "current" : ""}"><div class="step-top"><span class="step-index">${index < current ? icon("check", 11) : index + 1}</span><b>${item[0]}</b></div><small>${item[1]}</small></div>`).join("")}</div>`;
  }

  function renderOverview() {
    const createAction = state.ontology
      ? `${button("继续配置", stageIndex() < 2 ? "go-model" : stageIndex() === 2 ? "open-publish" : "go-versions", { primary: true, iconName: "arrow-right" })}${button("查看资源目录", "go-catalog", { iconName: "library" })}`
      : button("创建本体", "open-create", { primary: true, iconName: "plus" });

    if (!state.ontology) {
      return `${pageHead("ONTOLOGY MANAGEMENT", "本体管理总览", "把业务对象、关系、指标、规则和行动定义组织成可发布、可验证、可追溯的语义资源。", createAction)}
        <section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("waypoints")}</div><h3>还没有本体</h3><p>先创建本体并选择业务场景。资源在发布前只保留在建模工作区，不会进入正式目录。</p>${button("创建本体", "open-create", { primary: true, iconName: "plus" })}</div></section>
        <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>可用数据资产</h3><p>来自数据工程的只读目录，不在本模块上传或加工。</p></div></div><div class="panel-body"><article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("database")}</div><div class="work-card-copy"><h4>融资标准化数据资产</h4><p>4 个成员、3 条关系；5,218 条融资明细，574 家融资主体，24 家融资机构。</p></div>${status("可选择", "green")}</div></article></div></section>`;
    }

    const dataStatus = state.binding === "ready" ? status("消费就绪", "green") : state.refresh === "failed" ? status("刷新失败", "red") : state.refresh === "processing" ? status("刷新处理中", "blue", true) : state.publish === "published" ? status("等待候选验证", "amber") : status("尚未发布", "");
    const semanticStatus = state.publish === "published" ? status("已发布", "green") : state.validation === "success" ? status("可发布", "blue") : status("编辑中", "amber");
    const validationStatus = state.evidence === "success" ? status("候选验证通过", "green") : state.evidence === "partial" ? status("候选验证未通过", "red") : status("未完成", "");
    return `${pageHead("ONTOLOGY MANAGEMENT", state.ontology.name, state.ontology.definition, createAction)}
      ${progressSteps()}
      ${state.refresh === "failed" && state.currentBinding ? `<div class="notice error">${icon("circle-alert")}<div class="notice-content"><b>新数据版本刷新失败，当前服务未切换</b><span>${state.refreshFailure || "机构关系端点无法完整匹配"}。上一可信组合 ${state.currentBinding.semanticVersion} + ${state.currentBinding.dataVersion} 继续服务。</span></div>${button("查看并恢复", "go-versions", { small: true })}</div>` : ""}
      <section class="metric-strip">
        <div class="metric-tile blue"><span class="metric-label">对象类型 ${icon("box", 13)}</span><strong class="metric-value">${state.structureAdded ? 4 : 0}</strong><span class="metric-note">融资主体、明细、机构、负责人</span></div>
        <div class="metric-tile"><span class="metric-label">业务关系 ${icon("share-2", 13)}</span><strong class="metric-value">${state.structureAdded ? 3 : 0}</strong><span class="metric-note">全部使用稳定端点身份</span></div>
        <div class="metric-tile"><span class="metric-label">业务逻辑 ${icon("sigma", 13)}</span><strong class="metric-value">${state.structureAdded ? 11 : 0}</strong><span class="metric-note">7 Metric · 3 Rule · 1 Action Type</span></div>
        <div class="metric-tile ${state.binding === "ready" ? "green" : "amber"}"><span class="metric-label">当前消费组合 ${icon("package-check", 13)}</span><strong class="metric-value" style="font-size:15px">${state.currentBinding ? escapeHtml(state.currentBinding.dataVersion) : "尚未采用"}</strong><span class="metric-note">${state.currentBinding ? `数据截至 ${state.currentBinding.asOf.slice(0, 10)}` : "完成候选验证后才能采用"}</span></div>
      </section>
      <section class="grid-2">
        <div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>当前进度</h3><p>语义定义、数据消费和消费者验证分别显示。</p></div></div><div class="panel-body"><table><tbody>
          <tr><td class="cell-title">语义定义</td><td>${semanticStatus}</td><td>${state.semanticVersion ? `<span class="mono">${state.semanticVersion}</span>` : "尚未生成 Published 版本"}</td></tr>
          <tr><td class="cell-title">数据消费</td><td>${dataStatus}</td><td>${state.currentBinding ? `${state.currentBinding.dataVersion} · ${state.currentBinding.asOf}` : "当前没有可供正式消费的双版本组合"}</td></tr>
          <tr><td class="cell-title">候选验证</td><td>${validationStatus}</td><td>${state.evidenceAttempts ? `已读取 ${state.evidenceAttempts} 次验证证据` : "尚未读取固定问题验证证据"}</td></tr>
        </tbody></table></div></div>
        <div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>下一步</h3><p>只显示当前阶段可以实际执行的操作。</p></div></div><div class="panel-body">${nextStepCard()}</div></div>
      </section>
      <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>最近活动</h3><p>记录本体管理内的保存、校验、发布、刷新与消费绑定操作。</p></div></div><div class="panel-body">${renderActivity()}</div></section>`;
  }

  function nextStepCard() {
    if (!state.structureAdded) return `<article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("boxes")}</div><div class="work-card-copy"><h4>添加 S001 业务结构</h4><p>创建四类对象、三条关系以及融资指标、规则和行动类型。</p></div></div><div class="work-card-actions">${button("进入建模", "go-model", { primary: true, small: true })}</div></article>`;
    if (state.mappingPreview !== "success") return `<article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("git-compare-arrows")}</div><div class="work-card-copy"><h4>完成数据映射与真实预览</h4><p>选择四成员三关系资产包，并修正身份或端点问题。</p></div></div><div class="work-card-actions">${button("继续映射", "go-mapping", { primary: true, small: true })}</div></article>`;
    if (state.publish !== "published") return `<article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("badge-check")}</div><div class="work-card-copy"><h4>运行统一校验并发布</h4><p>通过身份、关系、指标、规则与行动合同检查后形成 Published 版本。</p></div></div><div class="work-card-actions">${button("检查并发布", "open-publish", { primary: true, small: true })}</div></article>`;
    if (state.binding !== "ready") return `<article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("package-search")}</div><div class="work-card-copy"><h4>处理候选数据版本</h4><p>核对刷新结果与固定问题证据，再决定是否采用为当前消费组合。</p></div></div><div class="work-card-actions">${button("进入版本与消费", "go-versions", { primary: true, small: true })}</div></article>`;
    return `<article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("circle-check-big")}</div><div class="work-card-copy"><h4>当前消费组合已采用</h4><p>可在对象详情和版本级消费预览中核对下游获准资源与证据。</p></div></div><div class="work-card-actions">${button("查看融资主体", "open-financing-subject", { primary: true, small: true })}</div></article>`;
  }

  function renderActivity() {
    if (!state.events.length) return `<div class="empty" style="min-height:150px"><div class="empty-inner"><div class="empty-icon">${icon("history")}</div><h3>还没有活动记录</h3><p>完成一次保存、校验或发布后，记录会出现在这里。</p></div></div>`;
    return `<div class="timeline">${state.events.slice(0, 6).map((event, index) => `<div class="timeline-item ${event.tone === "error" ? "error" : "done"}"><span class="timeline-dot">${icon(event.tone === "error" ? "x" : "check", 11)}</span><div class="timeline-copy"><b>${escapeHtml(event.title)}</b><span>${escapeHtml(event.detail)} · ${escapeHtml(event.time)}</span></div></div>`).join("")}</div>`;
  }

  function allResources() {
    const list = [
      ...objectTypes.map(item => ({ ...item, type: "Object Type", icon: "box" })),
      ...links.map(item => ({ ...item, definition: `${item.source} → ${item.target}，${item.cardinality}`, type: "Link", icon: "share-2" })),
      ...metrics.map(item => ({ ...item, type: "Metric", icon: "sigma" })),
      ...rules.map(item => ({ ...item, definition: item.condition, type: "Rule", icon: "list-checks" })),
      { ...actionType, definition: actionType.result, type: "Action Type", icon: "zap" }
    ];
    return list;
  }

  function renderCatalog() {
    if (state.publish !== "published") {
      return `${pageHead("RESOURCE CATALOG", "资源目录", "目录只展示已发布资源。草稿与候选资源保留在各自工作区。", state.ontology ? button("进入建模工作区", "go-model", { primary: true, iconName: "square-pen" }) : button("创建本体", "open-create", { primary: true, iconName: "plus" }))}
        <section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("library")}</div><h3>目录中还没有资源</h3><p>${state.ontology ? "当前资源仍在编辑中。完成统一校验并发布后，Published 资源才会进入目录。" : "创建并发布本体后，可在这里按名称、定义和资源类型查找资源。"}</p>${state.ontology ? button("继续配置", "go-model", { primary: true }) : button("创建本体", "open-create", { primary: true })}</div></section>`;
    }

    const query = ui.catalogQuery.trim().toLowerCase();
    const visible = allResources().filter(resource => (ui.catalogType === "全部类型" || resource.type === ui.catalogType) && (!query || `${resource.name} ${resource.id} ${resource.definition}`.toLowerCase().includes(query)));
    const toolbar = `<div class="catalog-toolbar"><div class="search">${icon("search")}<label class="sr-only" for="catalog-search">搜索资源</label><input id="catalog-search" data-input="catalog-query" value="${escapeHtml(ui.catalogQuery)}" placeholder="搜索业务名称、定义或稳定标识" /></div><select class="select" data-input="catalog-type" aria-label="资源类型"><option>全部类型</option>${["Object Type", "Link", "Metric", "Rule", "Action Type"].map(type => `<option ${ui.catalogType === type ? "selected" : ""}>${type}</option>`).join("")}</select><div class="segmented"><button type="button" class="${ui.catalogView === "cards" ? "active" : ""}" data-action="catalog-cards" title="卡片视图">${icon("layout-grid")}</button><button type="button" class="${ui.catalogView === "list" ? "active" : ""}" data-action="catalog-list" title="列表视图">${icon("list")}</button></div></div>`;
    return `${pageHead("RESOURCE CATALOG", "资源目录", `${state.semanticVersion} 中已发布的对象、关系、指标、规则与行动定义。`, button("查看消费包", "go-versions", { iconName: "package-check" }))}
      <section class="panel">${toolbar}${ui.catalogView === "cards" ? renderCatalogCards(visible) : renderCatalogList(visible)}</section>`;
  }

  function renderCatalogCards(resources) {
    if (!resources.length) return `<div class="empty"><div class="empty-inner"><div class="empty-icon">${icon("search-x")}</div><h3>没有匹配的资源</h3><p>调整搜索词或资源类型后再试。</p></div></div>`;
    return `<div class="catalog-cards">${resources.map(resource => `<article class="resource-card"><div class="resource-card-head"><div class="resource-type-icon">${icon(resource.icon)}</div><div style="min-width:0;flex:1"><h4>${escapeHtml(resource.name)}</h4><span class="cell-sub mono">${escapeHtml(resource.id)}</span></div>${status("已发布", "green")}</div><p>${escapeHtml(resource.definition)}</p><div class="resource-meta"><span>${escapeHtml(resource.type)}</span><span>·</span><span>${escapeHtml(state.semanticVersion)}</span></div><div class="resource-card-foot"><span class="cell-sub">稳定身份 + 精确版本</span>${button("查看详情", `open-resource:${resource.id}`, { ghost: true, small: true })}</div></article>`).join("")}</div>`;
  }

  function renderCatalogList(resources) {
    if (!resources.length) return renderCatalogCards(resources);
    return `<div class="table-wrap"><table><thead><tr><th>业务名称</th><th>资源类型</th><th>稳定标识</th><th>Published 版本</th><th>状态</th><th></th></tr></thead><tbody>${resources.map(resource => `<tr><td><b class="cell-title">${escapeHtml(resource.name)}</b><span class="cell-sub">${escapeHtml(resource.definition)}</span></td><td>${escapeHtml(resource.type)}</td><td class="mono">${escapeHtml(resource.id)}</td><td class="mono">${escapeHtml(state.semanticVersion)}</td><td>${status("已发布", "green")}</td><td>${button("查看详情", `open-resource:${resource.id}`, { ghost: true, small: true })}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderModel() {
    if (!state.ontology) {
      return `${pageHead("MODELING WORKSPACE", "建模工作区", "从业务目标出发定义对象、关系、指标、规则与行动类型。", button("创建本体", "open-create", { primary: true, iconName: "plus" }))}<section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("square-pen")}</div><h3>先创建本体</h3><p>创建后将在独立草稿中配置资源，未发布内容不会出现在正式目录。</p>${button("创建本体", "open-create", { primary: true })}</div></section>`;
    }

    if (!state.structureAdded) {
      return `${pageHead("MODELING WORKSPACE", state.ontology.name, "当前草稿尚未定义业务结构。添加融资业务结构后仍可逐项查看和编辑。", button("返回总览", "go-overview", { iconName: "arrow-left" }))}
        <section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("boxes")}</div><h3>草稿中还没有资源</h3><p>添加四类业务对象、三条关系、七个融资 Metric、三条 Rule 和“发起融资优化建议”Action Type。</p>${button("添加业务结构", "add-structure", { primary: true, iconName: "plus" })}</div></section>`;
    }

    const selected = getModelSelected();
    return `${pageHead("MODELING WORKSPACE", state.ontology.name, "在同一草稿中维护语义资源；保存草稿不会进入正式目录。", `${button("保存草稿", "save-draft", { iconName: "save" })}${button("检查并发布", "open-publish", { primary: true, iconName: "badge-check" })}`)}
      <div class="workspace-layout">
        <aside class="workspace-tree"><div class="workspace-col-head"><b>资源</b><span class="status">编辑中</span></div>${renderModelTree()}</aside>
        <section class="workspace-main"><div class="workspace-col-head"><b>${escapeHtml(selected.name)}</b><span class="mono">${escapeHtml(selected.id)}</span></div>${renderModelEditor(selected)}</section>
        <aside class="workspace-inspector"><div class="workspace-col-head"><b>定义摘要</b></div>${renderInspector(selected)}</aside>
      </div>`;
  }

  function renderModelTree() {
    return `<div class="tree-section"><div class="tree-section-label"><span>对象类型</span><span>4</span></div>${objectTypes.map(item => treeItem(item, "box")).join("")}</div>
      <div class="tree-section"><div class="tree-section-label"><span>关系</span><span>3</span></div>${links.map(item => treeItem(item, "share-2")).join("")}</div>
      <div class="tree-section"><div class="tree-section-label"><span>业务逻辑与行动</span><span>11</span></div>
        ${treeItem({ id: "logic.metrics", name: "融资指标", count: 7 }, "sigma")}
        ${treeItem({ id: "logic.rules", name: "融资规则", count: 3 }, "list-checks")}
        ${treeItem({ id: "logic.action", name: "发起融资优化建议", count: 1 }, "zap")}
      </div>`;
  }

  function treeItem(item, iconName) {
    const active = state.selectedModelResource === item.id;
    return `<button type="button" class="tree-item ${active ? "active" : ""}" data-action="select-model:${item.id}">${icon(iconName, 13)}<span>${escapeHtml(item.name)}</span><small>${item.count || ""}</small></button>`;
  }

  function getModelSelected() {
    return [...objectTypes, ...links, { id: "logic.metrics", name: "融资指标", type: "Metric" }, { id: "logic.rules", name: "融资规则", type: "Rule" }, { id: "logic.action", name: actionType.name, type: "Action Type" }].find(item => item.id === state.selectedModelResource) || objectTypes[0];
  }

  function renderModelEditor(selected) {
    if (selected.id === "logic.metrics") return `<div class="editor"><div class="editor-section"><h3>融资指标</h3><div class="logic-list">${metrics.map(metric => logicRow("M", metric.name, metric.id, `${metric.unit} · ${metric.scope}`, "已定义")).join("")}</div></div></div>`;
    if (selected.id === "logic.rules") return `<div class="editor"><div class="editor-section"><h3>融资规则</h3><div class="logic-list">${rules.map(rule => logicRow("R", rule.name, rule.id, rule.depends, "已定义")).join("")}</div></div></div>`;
    if (selected.id === "logic.action") {
      return `<div class="editor"><div class="editor-section"><h3>行动定义</h3><div class="form-grid"><div class="form-field"><label>业务名称</label><input value="${escapeHtml(actionType.name)}" /></div><div class="form-field"><label>目标对象</label><select><option>融资主体</option></select></div><div class="form-field full"><label>必要输入</label><textarea>${escapeHtml(actionType.inputs)}</textarea></div><div class="form-field full"><label>结果</label><input value="${escapeHtml(actionType.result)}" /></div></div></div><div class="editor-section"><h3>确认要求</h3><div class="switch-row"><div class="switch-copy"><b>必须人工确认</b><span>Rule 命中只形成行动候选；确认后才由决策中心创建负责人待办。</span></div><button type="button" class="switch ${state.actionConfirm ? "on" : ""}" data-action="toggle-action-confirm" aria-pressed="${state.actionConfirm}"><span class="sr-only">切换人工确认</span></button></div>${!state.actionConfirm ? `<div class="notice error" style="margin-top:9px">${icon("circle-alert")}<div class="notice-content"><b>确认要求未完成</b><span>发布校验会阻断未要求人工确认的行动类型。</span></div></div>` : ""}</div></div>`;
    }
    if (links.some(item => item.id === selected.id)) {
      return `<div class="editor"><div class="editor-section"><h3>关系定义</h3><div class="form-grid"><div class="form-field"><label>业务名称</label><input value="${escapeHtml(selected.name)}" /></div><div class="form-field"><label>基数</label><select><option>${escapeHtml(selected.cardinality)}</option></select></div><div class="form-field"><label>起点</label><input value="${escapeHtml(selected.source)}" readonly /></div><div class="form-field"><label>终点</label><input value="${escapeHtml(selected.target)}" readonly /></div><div class="form-field full"><label>稳定端点</label><input value="${escapeHtml(selected.endpoint)}" /></div></div></div></div>`;
    }
    return `<div class="editor"><div class="editor-section"><h3>对象定义</h3><div class="form-grid"><div class="form-field"><label>业务名称</label><input value="${escapeHtml(selected.name)}" /></div><div class="form-field"><label>稳定资源标识</label><input value="${escapeHtml(selected.id)}" readonly /></div><div class="form-field full"><label>业务定义</label><textarea>${escapeHtml(selected.definition)}</textarea></div><div class="form-field"><label>身份 Property</label><select><option>${escapeHtml(selected.identity)}</option></select></div><div class="form-field"><label>标题 Property</label><select><option>${escapeHtml(selected.title)}</option></select></div></div></div><div class="editor-section"><h3>最小术语</h3><div class="form-grid"><div class="form-field"><label>首选名称</label><input value="${escapeHtml(selected.name)}" /></div><div class="form-field"><label>同义词</label><input value="${selected.id === "obj.financing_subject" ? "融资单位、借款单位" : ""}" /></div><div class="form-field"><label>不推荐表达</label><input value="${selected.id === "obj.financing_subject" ? "公司" : ""}" /></div><div class="form-field"><label>原因</label><input value="${selected.id === "obj.financing_subject" ? "无法稳定区分承担融资责任的主体" : ""}" /></div></div></div></div>`;
  }

  function logicRow(kind, name, id, deps, stateText) {
    return `<div class="logic-row"><div class="logic-kind">${kind}</div><div class="logic-copy"><b>${escapeHtml(name)}</b><span class="mono">${escapeHtml(id)}</span></div><div class="logic-deps"><b>${escapeHtml(deps)}</b><span>随同一语义版本发布</span></div>${status(stateText, "blue")}</div>`;
  }

  function renderInspector(selected) {
    const type = selected.id.startsWith("obj.") ? "Object Type" : selected.id.startsWith("link.") ? "Link" : selected.type || "资源";
    const dependencies = selected.id === "logic.action" ? "融资主体、R01—R03、指标证据" : selected.id === "logic.rules" ? "已定义 Metric" : selected.id === "logic.metrics" ? "融资明细 Property 与 Published Link" : "当前草稿";
    return `<div class="inspector-body"><div class="inspector-block"><h4>资源身份</h4><dl class="fact-list"><dt>资源类型</dt><dd>${escapeHtml(type)}</dd><dt>稳定标识</dt><dd class="mono">${escapeHtml(selected.id)}</dd><dt>当前状态</dt><dd>${status("编辑中", "amber")}</dd><dt>所属本体</dt><dd>${escapeHtml(state.ontology.name)}</dd></dl></div><div class="inspector-block"><h4>发布影响</h4><dl class="fact-list"><dt>依赖</dt><dd>${escapeHtml(dependencies)}</dd><dt>正式目录</dt><dd>保存草稿不会进入</dd><dt>下游消费</dt><dd>只读取 Published 资源</dd></dl></div>${state.draftSaved ? `<div class="notice success">${icon("check-circle-2")}<div class="notice-content"><b>草稿已保存</b><span>保存时间 ${escapeHtml(state.draftSavedAt || "")}</span></div></div>` : ""}</div>`;
  }

  function renderMapping() {
    if (!state.ontology || !state.structureAdded) {
      return `${pageHead("DATA MAPPING", "映射与预览", "选择数据工程发布的数据资产成员，并映射对象身份、属性和关系端点。", button(state.ontology ? "进入建模" : "创建本体", state.ontology ? "go-model" : "open-create", { primary: true }))}<section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("git-compare-arrows")}</div><h3>还没有可映射的对象结构</h3><p>先在建模工作区定义对象、属性和关系，再选择数据资产。</p></div></section>`;
    }

    const compatibilityMode = state.cycle === 2 && state.refresh === "failed" && !state.compatibilityFixed;
    return `${pageHead("DATA MAPPING", "映射与预览", "本体只选择、映射和消费数据资产；来源、快照、质量与刷新由数据工程管理。", `${button("查看关系图", "go-graph", { iconName: "share-2" })}${button("检查并发布", "open-publish", { primary: true, iconName: "badge-check", disabled: state.mappingPreview !== "success" })}`)}
      ${compatibilityMode ? `<div class="notice error">${icon("circle-alert")}<div class="notice-content"><b>新版本的机构端点字段发生变化</b><span>3 条融资明细无法连接到融资机构。当前消费组合未切换，请为新候选选择兼容字段后创建关联重试。</span></div></div>` : ""}
      <section class="grid-2" style="margin-top:${compatibilityMode ? "12px" : "0"}">
        <div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>数据资产版本包</h3><p>四个不同粒度的成员，共享一次数据截至时间和质量证据。</p></div>${state.mappingSelected ? status("已选择", "blue") : ""}</div><div class="panel-body">
          <article class="work-card"><div class="work-card-top"><div class="work-card-icon">${icon("database")}</div><div class="work-card-copy"><h4>融资标准化数据资产</h4><p>数据截至 2026-07-31 23:59:59 · 质量检查通过 · 来自数据工程</p><div class="resource-meta"><span>融资主体参考 574</span><span>融资明细 5,218</span><span>金融机构参考 24</span><span>融资负责人参考 574</span></div></div>${state.mappingSelected ? status("当前选择", "green") : button("选择", "select-asset", { small: true, primary: true })}</div></article>
        </div></div>
        <div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>预览状态</h3><p>对象和关系预览结果会进入发布前统一校验。</p></div></div><div class="panel-body">${mappingPreviewSummary()}</div></div>
      </section>
      ${state.mappingSelected ? `<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>${compatibilityMode ? "兼容映射" : "对象与关系映射"}</h3><p>${compatibilityMode ? "仅调整发生变化的候选字段，不改写已发布语义资源。" : "身份使用稳定编码；名称只作为可读标题。"}</p></div>${compatibilityMode ? "" : button(state.mappingPreview === "processing" ? "预览处理中" : state.mappingPreview === "failed" ? "重新运行预览" : "运行对象与关系预览", "run-mapping-preview", { primary: true, iconName: "play", disabled: state.mappingPreview === "processing" })}</div><div class="panel-body">
        ${compatibilityMode ? renderCompatibilityMapping() : renderMappingFlow()}
      </div></section>` : ""}`;
  }

  function mappingPreviewSummary() {
    if (state.mappingPreview === "idle") return `<div class="empty" style="min-height:180px"><div class="empty-inner"><div class="empty-icon">${icon("scan-search")}</div><h3>尚未运行预览</h3><p>选择数据资产并完成身份与端点映射后运行。</p></div></div>`;
    if (state.mappingPreview === "processing") return `<div class="stack"><div class="skeleton" style="height:18px"></div><div class="skeleton" style="height:42px"></div><div class="skeleton" style="height:42px"></div></div>`;
    if (state.mappingPreview === "failed") return `<div class="notice error">${icon("circle-alert")}<div class="notice-content"><b>关系预览失败</b><span>“融资由机构提供”的终点字段尚未选择，5,218 条融资明细无法形成机构关系。</span></div></div><div class="work-card-actions">${button("选择机构编码", "focus-institution-mapping", { small: true, primary: true })}</div>`;
    return `<div class="notice success">${icon("check-circle-2")}<div class="notice-content"><b>对象与关系可以预览</b><span>身份缺失 0 · 身份重复 0 · 关系端点未匹配 0</span></div></div><table style="margin-top:9px"><tbody><tr><td>融资主体</td><td class="number">574</td><td>${status("可预览", "green")}</td></tr><tr><td>融资明细</td><td class="number">5,218</td><td>${status("可预览", "green")}</td></tr><tr><td>融资机构</td><td class="number">24</td><td>${status("可预览", "green")}</td></tr><tr><td>融资负责人</td><td class="number">574</td><td>${status("可预览", "green")}</td></tr></tbody></table>`;
  }

  function renderMappingFlow() {
    const institutionOptions = `<option value="">请选择来源字段</option><option ${state.institutionMapping === "机构编码" ? "selected" : ""}>机构编码</option>`;
    return `<div class="mapping-flow"><div class="mapping-side"><div class="panel-head"><div class="panel-head-copy"><h3>资产成员与字段</h3><p>${escapeHtml(dataVersion())}</p></div></div><div class="mapping-list">
      ${mappingSource("融资主体参考", "单位编码 · 单位名称 · 所属板块")}
      ${mappingSource("融资明细", "借据编号 · 单位编码 · 余额 · 当前利率")}
      ${mappingSource("金融机构参考", "机构编码 · 机构名称")}
      ${mappingSource("融资负责人参考", "负责人标识 · 负责人名称 · 单位编码")}
    </div></div><div class="mapping-arrow">${icon("arrow-right")}</div><div class="mapping-side"><div class="panel-head"><div class="panel-head-copy"><h3>本体身份与端点</h3><p>目标资源使用稳定身份</p></div></div><div class="mapping-list">
      ${mappingTarget("融资主体", "身份：单位编码；标题：单位名称", "单位编码")}
      ${mappingTarget("融资明细", "身份：借据编号；主体端点：单位编码", "借据编号")}
      <div class="mapping-item"><div><b>融资机构</b><span>身份与融资明细机构端点</span></div><select id="institution-mapping" data-input="institution-mapping">${institutionOptions}</select></div>
      ${mappingTarget("融资负责人", "身份：负责人标识；主体端点：单位编码", "负责人标识")}
    </div></div></div>
    <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>关系</th><th>起点字段</th><th>终点字段</th><th>方向 / 基数</th><th>映射状态</th></tr></thead><tbody>
      <tr><td class="cell-title">主体拥有融资</td><td>融资主体.单位编码</td><td>融资明细.单位编码</td><td>主体 → 明细 · 一对多</td><td>${status("已映射", "green")}</td></tr>
      <tr><td class="cell-title">融资由机构提供</td><td>融资明细.机构编码</td><td>${state.institutionMapping ? "融资机构.机构编码" : "尚未选择"}</td><td>明细 → 机构 · 多对一</td><td>${state.institutionMapping ? status("已映射", "green") : status("待完成", "amber")}</td></tr>
      <tr><td class="cell-title">主体由负责人承接</td><td>融资主体.单位编码</td><td>负责人参考.单位编码 / 负责人标识</td><td>主体 → 负责人 · 多对一</td><td>${status("已映射", "green")}</td></tr>
    </tbody></table></div>`;
  }

  function mappingSource(name, fields) {
    return `<div class="mapping-item"><div><b>${escapeHtml(name)}</b><span>${escapeHtml(fields)}</span></div>${status("可选择", "blue")}</div>`;
  }

  function mappingTarget(name, description, field) {
    return `<div class="mapping-item"><div><b>${escapeHtml(name)}</b><span>${escapeHtml(description)}</span></div><select><option>${escapeHtml(field)}</option></select></div>`;
  }

  function renderCompatibilityMapping() {
    return `<div class="form-grid"><div class="form-field"><label>受影响关系</label><input value="融资由机构提供" readonly /></div><div class="form-field"><label>新候选中的机构端点字段</label><select id="compatibility-field"><option>机构代码</option><option>统一机构编码</option></select><span class="form-hint">新版本不再提供原“机构编码”字段，需明确选择语义等价字段。</span></div><div class="form-field full"><label>影响摘要</label><textarea readonly>3 条融资明细端点无法匹配；融资主体、融资明细、融资负责人及另外两条关系不受影响。当前消费组合继续服务。</textarea></div></div><div class="work-card-actions">${button("保存兼容映射", "save-compatibility", { primary: true, iconName: "save" })}</div>`;
  }

  function renderGraph() {
    if (!state.structureAdded) {
      return `${pageHead("RELATIONSHIP GRAPH", "关系图", "以业务关系查看对象类型，点击节点可打开资源详情。", button("进入建模", "go-model", { primary: true }))}<section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("share-2")}</div><h3>还没有对象关系</h3><p>在建模工作区添加对象和 Link 后，关系图会在这里出现。</p></div></section>`;
    }
    return `${pageHead("RELATIONSHIP GRAPH", "融资业务关系图", "关系方向与基数来自当前语义定义；未发布草稿不会进入正式消费。", button("返回建模", "go-model", { iconName: "arrow-left" }))}<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>${escapeHtml(state.ontology.name)}</h3><p>4 个 Object Type · 3 条 Link</p></div>${state.publish === "published" ? status(`已发布 ${state.semanticVersion}`, "green") : status("编辑中", "amber")}</div><div class="graph-stage"><div class="graph-canvas">
      ${graphLine(320, 166, 255, 0, "拥有融资", 410, 145)}
      ${graphLine(575, 166, 245, 115, "由机构提供", 650, 218)}
      ${graphLine(320, 166, 245, 245, "由负责人承接", 400, 287)}
      ${graphNode("obj.financing_subject", "融资主体", "单位编码", ["单位名称", "所属板块"], 130, 120)}
      ${graphNode("obj.financing_detail", "融资明细", "借据编号", ["人民币余额", "当前利率", "期限种类"], 575, 120)}
      ${graphNode("obj.financing_institution", "融资机构", "机构编码", ["机构名称", "机构类别"], 765, 335)}
      ${graphNode("obj.financing_owner", "融资负责人", "负责人标识", ["负责人名称"], 320, 365)}
    </div></div></section>`;
  }

  function graphLine(x, y, length, angle, label, labelX, labelY) {
    return `<div class="graph-line" style="left:${x}px;top:${y}px;width:${length}px;transform:rotate(${angle}deg)"></div><span class="graph-label" style="left:${labelX}px;top:${labelY}px">${escapeHtml(label)}</span>`;
  }

  function graphNode(id, name, identity, properties, x, y) {
    return `<button type="button" class="graph-node" style="left:${x}px;top:${y}px;text-align:left;padding:0" data-action="open-resource:${id}"><div class="graph-node-head"><i>${icon("box", 14)}</i><div><b>${escapeHtml(name)}</b><small>身份：${escapeHtml(identity)}</small></div></div><div class="graph-node-body">${properties.map(item => `<span class="property-chip">${escapeHtml(item)}</span>`).join("")}</div></button>`;
  }

  function semanticAxis() {
    if (state.publish === "published") return ["已发布", "green", state.semanticVersion];
    if (state.validation === "success") return ["可发布", "blue", "统一校验已通过"];
    if (state.publish === "failed") return ["发布失败", "red", "可修复后重试"];
    return ["编辑中", "amber", "草稿未进入目录"];
  }

  function dataAxis() {
    if (state.binding === "ready" && bindingForPublished()) return ["消费就绪", "green", state.currentBinding?.dataVersion || ""];
    if (state.refresh === "failed") return ["刷新失败", "red", state.currentBinding ? "上一可信组合继续服务" : "尚无可消费组合"];
    if (state.evidence === "success") return ["等待权威绑定", "amber", dataVersion()];
    if (state.refresh === "success") return ["候选可预览", "blue", dataVersion()];
    if (state.refresh === "processing") return ["刷新处理中", "blue", dataVersion()];
    if (state.publish === "published") return ["等待刷新请求", "amber", "尚未形成刷新结果"];
    return ["未发布", "", "没有 Published 语义版本"];
  }

  function consumerAxis() {
    if (state.binding !== "ready" || !bindingForPublished()) return ["无法判定", "", "数据消费尚未就绪"];
    return ["未验证", "amber", "等待下游回传联通证据"];
  }

  function renderObject() {
    const tab = routeParam("tab") || ui.objectTab || "overview";
    ui.objectTab = tab;
    if (state.publish !== "published") return renderResourceUnavailable();
    const sem = semanticAxis();
    const dat = dataAxis();
    const con = consumerAxis();
    const tabs = [
      ["overview", "概览"], ["relations", "属性与关系"], ["logic", "业务逻辑与行动"], ["mapping", "数据与映射"], ["consumers", "下游消费预览"]
    ];
    return `${pageHead("OBJECT TYPE", "资源详情", "从一个页面理解对象定义、来源、关系、业务逻辑与下游消费状态。", button("返回资源目录", "go-catalog", { iconName: "arrow-left" }))}
      <section class="object-summary"><div class="object-title"><div class="object-glyph">${icon("building-2")}</div><div class="object-copy"><h2>融资主体</h2><p>独立承担融资余额、成本、结构判断和优化行动的单位。</p><span class="cell-sub mono">obj.financing_subject · ${escapeHtml(state.semanticVersion)}</span></div><div class="page-actions">${button("编辑定义", "edit-financing-subject", { iconName: "square-pen" })}</div></div><div class="axis-strip">
        <div class="axis"><label>语义定义</label><div class="axis-row">${status(sem[0], sem[1])}<span>${escapeHtml(sem[2])}</span></div></div>
        <div class="axis"><label>数据消费</label><div class="axis-row">${status(dat[0], dat[1], state.refresh === "processing")}<span>${escapeHtml(dat[2])}</span></div></div>
        <div class="axis"><label>智能问数验证</label><div class="axis-row">${status(con[0], con[1])}<span>${escapeHtml(con[2])}</span></div></div>
      </div><nav class="tabs">${tabs.map(item => `<button type="button" class="tab ${tab === item[0] ? "active" : ""}" data-action="object-tab:${item[0]}">${item[1]}</button>`).join("")}</nav></section>
      <div class="tab-content">${renderObjectTab(tab)}</div>`;
  }

  function renderResourceUnavailable() {
    return `${pageHead("RESOURCE DETAIL", "资源详情", "只有已发布资源会进入正式目录。", button("返回资源目录", "go-catalog", { iconName: "arrow-left" }))}<section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("file-lock-2")}</div><h3>资源尚未发布</h3><p>请在建模工作区继续编辑，并通过统一校验与发布。</p>${button("进入建模", "go-model", { primary: true })}</div></section>`;
  }

  function renderObjectTab(tab) {
    if (tab === "relations") return renderObjectRelations();
    if (tab === "logic") return renderObjectLogic();
    if (tab === "mapping") return renderObjectMapping();
    if (tab === "consumers") return renderObjectConsumers();
    return renderObjectOverview();
  }

  function renderObjectOverview() {
    const binding = bindingForPublished();
    return `<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>业务定义与身份</h3><p>显示名称可调整，稳定资源标识和对象实例身份不能混用。</p></div></div><div class="panel-body"><div class="definition-grid">
      ${definitionItem("业务名称", "融资主体", "首选业务名称")}
      ${definitionItem("稳定资源标识", "obj.financing_subject", "不随改名或版本变化", true)}
      ${definitionItem("身份 Property", "单位编码", "对象实例稳定身份")}
      ${definitionItem("标题 Property", "单位名称", "用于界面可读显示")}
      ${definitionItem("Published 版本", state.semanticVersion, state.publishedAt || "")}
      ${definitionItem("主要来源", "融资主体参考", "融资标准化数据资产")}
      ${definitionItem("当前数据版本", binding ? binding.dataVersion : "尚未采用", binding ? binding.asOf : "候选不会进入正式消费")}
      ${definitionItem("业务场景", "集团融资成本与债务结构优化", "S001")}
    </div></div></section>
    <section class="grid-equal"><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>业务术语</h3><p>随 Published 语义版本发布。</p></div></div><div class="panel-body"><dl class="fact-list"><dt>首选名称</dt><dd>融资主体</dd><dt>同义词</dt><dd>融资单位、借款单位</dd><dt>缩写</dt><dd>无</dd><dt>不推荐表达</dt><dd>公司</dd><dt>原因</dt><dd>无法稳定区分承担融资责任的主体</dd></dl></div></div><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>代表性对象</h3><p>来自当前${binding ? "消费组合" : "候选预览"}。</p></div></div><div class="panel-body"><table><thead><tr><th>单位编码</th><th>单位名称</th><th>所属板块</th></tr></thead><tbody><tr><td class="mono">UNIT-553</td><td>单位553</td><td>境内新能源</td></tr><tr><td class="mono">UNIT-465</td><td>单位465</td><td>产业金融</td></tr><tr><td class="mono">UNIT-561</td><td>单位561</td><td>产业服务</td></tr></tbody></table></div></div></section>`;
  }

  function definitionItem(label, value, note, mono = false) {
    return `<div class="definition-item"><label>${escapeHtml(label)}</label><b class="${mono ? "mono" : ""}">${escapeHtml(value || "未提供")}</b><small>${escapeHtml(note || "")}</small></div>`;
  }

  function renderObjectRelations() {
    return `<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>属性</h3><p>不只是字段名，还包括业务定义、来源、空值和逻辑引用。</p></div>${button("编辑定义", "edit-financing-subject", { small: true, iconName: "square-pen" })}</div><div class="table-wrap"><table><thead><tr><th>Property</th><th>业务定义</th><th>类型 / 单位</th><th>允许为空</th><th>来源</th><th>逻辑引用</th></tr></thead><tbody>
      <tr><td><b>单位编码</b><span class="cell-sub mono">prop.subject.unit_code</span></td><td>融资主体的稳定身份</td><td>文本</td><td>否</td><td>融资主体参考.单位编码</td><td>3 Link · 全部 Metric</td></tr>
      <tr><td><b>单位名称</b><span class="cell-sub mono">prop.subject.unit_name</span></td><td>融资主体的可读标题</td><td>文本</td><td>否</td><td>融资主体参考.单位名称</td><td>问数展示</td></tr>
      <tr><td><b>所属板块</b><span class="cell-sub mono">prop.subject.sector</span></td><td>主体当前归属的产业板块标签</td><td>枚举</td><td>否</td><td>融资主体参考.所属板块</td><td>筛选范围</td></tr>
      <tr><td><b>境内外</b><span class="cell-sub mono">prop.subject.region_type</span></td><td>主体融资业务的境内外分类</td><td>枚举</td><td>是</td><td>融资主体参考.境内外</td><td>范围解释</td></tr>
    </tbody></table></div></section>
    <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>关系</h3><p>方向、基数与端点均来自 Published Link。</p></div>${button("查看关系图", "go-graph", { small: true, iconName: "share-2" })}</div><div class="table-wrap"><table><thead><tr><th>业务关系</th><th>方向</th><th>基数</th><th>稳定端点</th><th>覆盖</th><th></th></tr></thead><tbody>
      <tr><td><b>主体拥有融资</b><span class="cell-sub mono">link.subject_has_detail</span></td><td>融资主体 → 融资明细</td><td>一对多</td><td>单位编码</td><td>5,218 / 5,218</td><td>${status("完整", "green")}</td></tr>
      <tr><td><b>主体由负责人承接</b><span class="cell-sub mono">link.subject_owned_by_owner</span></td><td>融资主体 → 融资负责人</td><td>多对一</td><td>单位编码 / 负责人标识</td><td>574 / 574</td><td>${status("完整", "green")}</td></tr>
    </tbody></table></div></section>`;
  }

  function renderObjectLogic() {
    return `<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>Metric</h3><p>依赖融资主体及其融资明细；组合范围按明细余额加权。</p></div>${button("在建模工作区查看", "edit-logic-metrics", { small: true, iconName: "square-pen" })}</div><div class="panel-body"><div class="logic-list">${metrics.map(metric => logicRow("M", metric.name, metric.id, `${metric.unit} · ${metric.scope}`, "已发布")).join("")}</div></div></section>
    <section class="grid-equal"><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>Rule</h3><p>命中只形成行动候选。</p></div></div><div class="panel-body"><div class="logic-list">${rules.map(rule => logicRow("R", rule.name, rule.id, rule.depends, "已发布")).join("")}</div></div></div><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>Action Type</h3><p>定义允许请求的行动，不保存提醒或待办记录。</p></div></div><div class="panel-body"><div class="logic-list">${logicRow("A", actionType.name, actionType.id, "目标：融资主体 · 必须人工确认", "已发布")}</div><dl class="fact-list" style="margin-top:9px"><dt>必要输入</dt><dd>${escapeHtml(actionType.inputs)}</dd><dt>结果</dt><dd>${escapeHtml(actionType.result)}</dd><dt>运行记录</dt><dd>由决策中心拥有</dd></dl></div></div></section>
    <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>规则证据样例</h3><p>用于核对定义和关系，不在对象详情创建行动请求。</p></div></div><div class="table-wrap"><table><thead><tr><th>融资主体</th><th>主规则</th><th>关键指标</th><th>优先协商机构</th><th>负责人</th></tr></thead><tbody>${scenarioUnits.map(item => `<tr><td class="cell-title">${item.unit}</td><td>${status(item.rule, item.rule === "R01" ? "red" : "amber")}</td><td>${item.cost} · ${item.ratio}</td><td>${item.banks}</td><td>${item.owner}</td></tr>`).join("")}</tbody></table></div></section>`;
  }

  function renderObjectMapping() {
    const dat = dataAxis();
    const publishedBinding = bindingForPublished();
    return `<section class="grid-2"><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>融资标准化数据资产</h3><p>当前对象使用融资主体参考，并通过融资明细、机构和负责人参考形成关系。</p></div>${status(dat[0], dat[1])}</div><div class="panel-body"><dl class="fact-list"><dt>候选数据版本</dt><dd class="mono">${dataVersion()}</dd><dt>获准数据版本</dt><dd class="mono">${publishedBinding?.dataVersion || "尚未采用"}</dd><dt>数据截至时间</dt><dd>${publishedBinding?.asOf || dataAsOf()}</dd><dt>融资主体</dt><dd>574 个；身份缺失 0，重复 0</dd><dt>关系端点</dt><dd>未匹配 0</dd><dt>质量摘要</dt><dd>通过；10 个产业板块值</dd></dl></div></div><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>刷新与采用</h3><p>刷新结果与当前消费组合分开记录。</p></div></div><div class="panel-body">${renderRefreshTimeline()}</div></div></section>
    <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>成员与映射</h3><p>来源成员与 Object Type 不要求一一对应。</p></div>${button("编辑映射", "go-mapping", { small: true, iconName: "git-compare-arrows" })}</div><div class="table-wrap"><table><thead><tr><th>资产成员</th><th>粒度</th><th>支持资源</th><th>稳定身份 / 端点</th><th>状态</th></tr></thead><tbody>
      <tr><td class="cell-title">融资主体参考</td><td>每个融资主体一行</td><td>融资主体</td><td>单位编码</td><td>${status("已映射", "green")}</td></tr>
      <tr><td class="cell-title">融资明细</td><td>每笔借据一行</td><td>融资明细、主体拥有融资</td><td>借据编号、单位编码</td><td>${status("已映射", "green")}</td></tr>
      <tr><td class="cell-title">金融机构参考</td><td>每家机构一行</td><td>融资机构、融资由机构提供</td><td>机构编码</td><td>${status("已映射", "green")}</td></tr>
      <tr><td class="cell-title">融资负责人参考</td><td>每个单位负责人一行</td><td>融资负责人、主体由负责人承接</td><td>负责人标识、单位编码</td><td>${status("已映射", "green")}</td></tr>
    </tbody></table></div></section>`;
  }

  function renderRefreshTimeline() {
    const publishedBinding = bindingForPublished();
    const items = [
      ["收到刷新请求", !!state.refreshRequestId, state.refreshRequestId || "尚未收到"],
      ["形成本体刷新结果", ["success", "failed"].includes(state.refresh), state.refreshResultId || (state.refresh === "processing" ? "处理中" : "尚未形成")],
      ["固定问题证据完整", state.evidence === "success", state.evidence === "partial" ? "存在超时项" : state.evidence === "success" ? "全部硬项通过" : "尚未完成"],
      ["采用当前消费组合", state.binding === "ready" && !!publishedBinding, publishedBinding ? `${publishedBinding.semanticVersion} + ${publishedBinding.dataVersion}` : "尚未采用"]
    ];
    return `<div class="timeline">${items.map(item => `<div class="timeline-item ${item[1] ? "done" : ""}"><span class="timeline-dot">${icon(item[1] ? "check" : "circle", 10)}</span><div class="timeline-copy"><b>${item[0]}</b><span>${escapeHtml(item[2])}</span></div></div>`).join("")}</div>`;
  }

  function renderObjectConsumers() {
    const current = bindingForPublished();
    const rows = [
      ["智能问数", "融资主体、属性、3 条 Link、7 Metric、R01—R03、Action Type", current ? "未验证" : "数据未就绪", current ? "amber" : ""],
      ["决策中心", "融资主体身份、负责人关系、Rule 证据、Action Type", current ? "可读取" : "数据未就绪", current ? "blue" : ""],
      ["Agent 应用", "Published 对象、关系、Metric 与 Rule 的只读引用", current ? "可读取" : "数据未就绪", current ? "blue" : ""],
      ["报告中心", "稳定资源标识、精确版本、历史定义与证据定位", current ? "可读取" : "数据未就绪", current ? "blue" : ""]
    ];
    return `<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>资源级消费预览</h3><p>回答“融资主体向下游提供什么”；完整版本级消费包在版本与消费中查看。</p></div>${button("查看完整语义消费包", "go-versions", { primary: true, small: true, iconName: "package-check" })}</div><div class="table-wrap"><table><thead><tr><th>消费模块</th><th>获准资源</th><th>语义版本</th><th>数据版本 / 截至时间</th><th>状态</th></tr></thead><tbody>${rows.map(row => `<tr><td class="cell-title">${row[0]}</td><td>${row[1]}</td><td class="mono">${state.semanticVersion}</td><td>${current ? `<span class="mono">${current.dataVersion}</span><span class="cell-sub">${current.asOf}</span>` : "尚未采用"}</td><td>${status(row[2], row[3])}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>最小证据链</h3><p>可从稳定语义资源定位到获准数据版本、成员、映射和质量摘要。</p></div></div><div class="panel-body"><div class="notice ${current ? "success" : "info"}">${icon(current ? "link" : "info")}<div class="notice-content"><b>${current ? "证据定位完整" : "等待当前消费组合"}</b><span>${current ? `${current.dataVersion} → 融资主体参考 / 融资明细 → 映射 → obj.financing_subject → Metric / Rule / Action Type` : "候选证据不会进入正式消费预览。"}</span></div></div></div></section>`;
  }

  function renderResource() {
    if (state.publish !== "published") return renderResourceUnavailable();
    const id = routeParam("id") || "";
    if (id === "obj.financing_subject") {
      setTimeout(() => navigate("object?tab=overview"), 0);
      return "";
    }
    const resource = allResources().find(item => item.id === id);
    if (!resource) return `${pageHead("RESOURCE DETAIL", "资源未找到", "稳定标识没有匹配当前 Published 版本中的资源。", button("返回资源目录", "go-catalog", { iconName: "arrow-left" }))}<section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("file-question")}</div><h3>无法定位资源</h3><p>返回目录并从当前 Published 版本重新打开。</p></div></section>`;
    const dependencies = resource.type === "Link" ? `${resource.source} → ${resource.target}` : resource.type === "Metric" ? "融资明细 Property 与 Published Link" : resource.type === "Rule" ? resource.depends : resource.type === "Action Type" ? "融资主体、Rule 与指标证据" : "融资标准化数据资产";
    const publishedBinding = bindingForPublished();
    return `${pageHead(resource.type.toUpperCase(), resource.name, resource.definition, `${button("返回资源目录", "go-catalog", { iconName: "arrow-left" })}${resource.type === "Object Type" ? button("查看关系图", "go-graph", { iconName: "share-2" }) : ""}`)}
      <section class="grid-2"><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>资源定义</h3><p>当前 Published 版本中的只读定义。</p></div>${status("已发布", "green")}</div><div class="panel-body"><dl class="fact-list"><dt>业务名称</dt><dd>${escapeHtml(resource.name)}</dd><dt>资源类型</dt><dd>${escapeHtml(resource.type)}</dd><dt>稳定标识</dt><dd class="mono">${escapeHtml(resource.id)}</dd><dt>Published 版本</dt><dd class="mono">${escapeHtml(state.semanticVersion)}</dd><dt>定义</dt><dd>${escapeHtml(resource.definition)}</dd><dt>Owner</dt><dd>本体管理</dd></dl></div></div><div class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>依赖与消费</h3><p>显示定义依赖，不复制下游运行记录。</p></div></div><div class="panel-body"><dl class="fact-list"><dt>依赖</dt><dd>${escapeHtml(dependencies)}</dd><dt>当前数据版本</dt><dd class="mono">${publishedBinding?.dataVersion || "尚未采用"}</dd><dt>数据截至时间</dt><dd>${publishedBinding?.asOf || "尚未采用"}</dd><dt>消费状态</dt><dd>${publishedBinding ? status("可读取", "green") : status("数据未就绪", "amber")}</dd><dt>证据定位</dt><dd>${publishedBinding ? "可从当前双版本重新定位" : "等待权威消费组合"}</dd></dl></div></div></section>`;
  }

  function renderVersions() {
    if (state.publish !== "published") {
      return `${pageHead("PUBLISHED CONSUMPTION", "版本与消费", "Published 版本形成后，才可处理候选数据、读取验证证据并采用当前消费组合。", button(state.ontology ? "检查并发布" : "创建本体", state.ontology ? "open-publish" : "open-create", { primary: true, iconName: state.ontology ? "badge-check" : "plus" }))}<section class="panel empty"><div class="empty-inner"><div class="empty-icon">${icon("package-check")}</div><h3>还没有 Published 语义版本</h3><p>草稿和映射预览不会进入正式消费；请先完成统一校验并发布。</p></div></section>`;
    }

    const mode = ui.consumptionMode;
    const actions = state.binding === "ready" ? button("检查数据更新", "check-data-update", { iconName: "refresh-cw" }) : "";
    return `${pageHead("PUBLISHED CONSUMPTION", "版本与消费", "按精确语义版本和数据版本检查消费上下文；正式消费与候选验证严格分开。", actions)}
      ${state.refresh === "failed" ? `<div class="notice error">${icon("circle-alert")}<div class="notice-content"><b>候选刷新失败，未切换当前消费组合</b><span>${escapeHtml(state.refreshFailure || "机构端点不兼容")}。${state.currentBinding ? `${state.currentBinding.semanticVersion} + ${state.currentBinding.dataVersion} 继续服务。` : "当前尚无可消费组合。"}</span></div><div class="notice-actions">${state.compatibilityFixed ? button("创建关联重试", "retry-refresh", { primary: true, small: true }) : button("修正映射", "go-mapping", { primary: true, small: true })}</div></div>` : ""}
      <section class="version-hero"><div class="version-hero-copy"><h3>${escapeHtml(state.semanticVersion)}</h3><p>Published 语义版本 · ${escapeHtml(state.publishedAt)} · 4 Object Type · 3 Link · 7 Metric · 3 Rule · 1 Action Type</p></div>${status("已发布", "green")}</section>
      <section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>消费上下文</h3><p>同一视图中不会混用候选与正式结果。</p></div><div class="context-switch"><button type="button" class="${mode === "formal" ? "active" : ""}" data-action="mode-formal">正式消费</button><button type="button" class="${mode === "candidate" ? "active" : ""}" data-action="mode-candidate">候选验证</button></div></div><div class="panel-body">${mode === "formal" ? renderFormalContext() : renderCandidateContext()}</div></section>`;
  }

  function renderFormalContext() {
    if (!state.currentBinding) {
      return `<div class="empty"><div class="empty-inner"><div class="empty-icon">${icon("package-open")}</div><h3>没有正式消费组合</h3><p>Published 语义版本已存在，但候选数据尚未通过全部门禁并被采用。正式目录不会读取候选结果。</p>${button("查看候选验证", "mode-candidate", { primary: true })}</div></div>`;
    }
    return `<div class="grid-3">
      <div class="context-card"><h4>语义版本 ${status("Published", "green")}</h4><b class="mono">${escapeHtml(state.currentBinding.semanticVersion)}</b><span class="cell-sub">Object、Link、Metric、Rule、Action Type</span></div>
      <div class="context-card"><h4>获准数据版本 ${status("消费就绪", "green")}</h4><b class="mono">${escapeHtml(state.currentBinding.dataVersion)}</b><span class="cell-sub">数据截至 ${escapeHtml(state.currentBinding.asOf)}</span></div>
      <div class="context-card"><h4>当前消费组合 ${status("已采用", "green")}</h4><b class="mono">${escapeHtml(state.currentBinding.bindingId)}</b><span class="cell-sub">采用时间 ${escapeHtml(state.currentBinding.adoptedAt)}</span></div>
    </div>
    ${state.previousBinding ? `<div class="notice info" style="margin-top:10px">${icon("history")}<div class="notice-content"><b>上一可信组合</b><span>${escapeHtml(state.previousBinding.semanticVersion)} + ${escapeHtml(state.previousBinding.dataVersion)} · 仅用于失败恢复和历史证据。</span></div></div>` : ""}
    <div class="panel" style="margin-top:10px"><div class="consumer-tabs">${consumerTab("qa", "智能问数")}${consumerTab("decision", "决策中心")}${consumerTab("agent", "Agent 应用")}${consumerTab("report", "报告中心")}</div><div class="consumer-content">${renderConsumerContent()}</div></div>`;
  }

  function consumerTab(id, label) {
    return `<button type="button" class="${ui.consumer === id ? "active" : ""}" data-action="consumer:${id}">${escapeHtml(label)}</button>`;
  }

  function renderConsumerContent() {
    const binding = state.currentBinding;
    if (ui.consumer === "decision") return `<div class="context-grid"><div class="context-card"><h4>获准语义资源 ${status("只读", "blue")}</h4><div class="resource-chips"><span class="resource-chip">融资主体</span><span class="resource-chip">主体—负责人</span><span class="resource-chip">R01—R03</span><span class="resource-chip">发起融资优化建议</span></div></div><div class="context-card"><h4>行动边界</h4><dl class="fact-list"><dt>目标</dt><dd>单一融资主体</dd><dt>前置证据</dt><dd>同一双版本的 Rule、指标、银行与借据</dd><dt>运行记录</dt><dd>由决策中心创建和管理</dd></dl></div></div>`;
    if (ui.consumer === "agent") return `<div class="context-grid"><div class="context-card"><h4>可读取资源 ${status("只读", "blue")}</h4><div class="resource-chips"><span class="resource-chip">4 Object Type</span><span class="resource-chip">3 Published Link</span><span class="resource-chip">7 Metric</span><span class="resource-chip">3 Rule</span></div></div><div class="context-card"><h4>边界</h4><p class="cell-sub" style="font-size:10px;line-height:1.7">只能按稳定资源标识和精确版本读取与引用，不创建、修改或重新解释语义资源。</p></div></div>`;
    if (ui.consumer === "report") return `<div class="context-grid"><div class="context-card"><h4>历史语义定位 ${status("可定位", "green")}</h4><dl class="fact-list"><dt>语义版本</dt><dd class="mono">${binding.semanticVersion}</dd><dt>稳定资源</dt><dd>Object、Property、Link、Metric、Rule</dd><dt>数据版本</dt><dd class="mono">${binding.dataVersion}</dd><dt>数据截至</dt><dd>${binding.asOf}</dd></dl></div><div class="context-card"><h4>核验边界</h4><p class="cell-sub" style="font-size:10px;line-height:1.7">本体只返回精确 Published 定义与责任位置，不读取报告内容、不比对数值、不生成报告核验结论。</p></div></div>`;
    return `<div class="context-grid"><div class="context-card"><h4>智能问数语义消费清单 ${status("上下文完整", "green")}</h4><div class="resource-chips"><span class="resource-chip">4 Object Type</span><span class="resource-chip">16 Property</span><span class="resource-chip">3 Published Link</span><span class="resource-chip">7 Metric</span><span class="resource-chip">3 Rule</span><span class="resource-chip">1 Action Type</span></div><dl class="fact-list" style="margin-top:9px"><dt>绑定方式</dt><dd>稳定资源标识 + 精确 Published 版本</dd><dt>关系导航</dt><dd>仅沿 3 条 Published Link</dd><dt>消费者验证</dt><dd>${status("未验证", "amber")}</dd></dl></div><div class="context-card"><h4>双版本快照</h4><dl class="fact-list"><dt>语义版本</dt><dd class="mono">${binding.semanticVersion}</dd><dt>数据版本</dt><dd class="mono">${binding.dataVersion}</dd><dt>数据截至</dt><dd>${binding.asOf}</dd><dt>采用时间</dt><dd>${binding.adoptedAt}</dd><dt>混版检查</dt><dd>${status("通过", "green")}</dd><dt>证据定位</dt><dd>${status("完整", "green")}</dd></dl></div></div>`;
  }

  function renderCandidateContext() {
    if (!state.refreshRequestId) {
      return `<div class="empty"><div class="empty-inner"><div class="empty-icon">${icon("inbox")}</div><h3>等待数据刷新请求</h3><p>Published 语义版本已就绪。数据工程提交刷新请求后，本体管理才会校验映射兼容并形成刷新结果。</p>${button("检查刷新请求", "receive-refresh", { primary: true, iconName: "refresh-cw" })}</div></div>`;
    }
    if (state.refresh === "idle") {
      return `<div class="notice info">${icon("inbox")}<div class="notice-content"><b>收到数据刷新请求</b><span>${escapeHtml(state.refreshRequestId)} · 候选 ${escapeHtml(dataVersion())} · 数据截至 ${escapeHtml(dataAsOf())}</span></div>${button("处理刷新请求", "process-refresh", { primary: true, small: true, iconName: "play" })}</div>${candidateIdentityCards()}`;
    }
    if (state.refresh === "processing") {
      return `<div class="notice info">${icon("loader-circle")}<div class="notice-content"><b>正在形成刷新结果</b><span>校验映射兼容、对象身份、关系端点、Metric 与 Rule 依赖。当前消费组合不会在处理中切换。</span></div></div><div class="stack" style="margin-top:10px"><div class="skeleton" style="height:46px"></div><div class="skeleton" style="height:46px"></div><div class="skeleton" style="height:46px"></div></div>`;
    }
    if (state.refresh === "failed") {
      return `${candidateIdentityCards()}<div class="notice error" style="margin-top:10px">${icon("circle-alert")}<div class="notice-content"><b>刷新结果失败</b><span>${escapeHtml(state.refreshFailure || "机构关系端点无法完整匹配")}。失败候选未进入正式消费。</span></div>${state.compatibilityFixed ? button("创建关联重试", "retry-refresh", { primary: true, small: true }) : button("修正映射", "go-mapping", { primary: true, small: true })}</div>`;
    }
    const evidenceBlock = renderCandidateEvidence();
    return `${candidateIdentityCards()}<div class="notice success" style="margin-top:10px">${icon("check-circle-2")}<div class="notice-content"><b>刷新结果已形成</b><span>${escapeHtml(state.refreshResultId)} · 对象身份、关系端点和逻辑依赖检查通过；这不等于当前消费组合已采用。</span></div></div>${evidenceBlock}`;
  }

  function candidateIdentityCards() {
    return `<div class="grid-3" style="margin-top:10px"><div class="context-card"><h4>Published 语义版本</h4><b class="mono">${escapeHtml(state.semanticVersion)}</b><span class="cell-sub">固定不变</span></div><div class="context-card"><h4>候选数据版本 ${status("未采用", "amber")}</h4><b class="mono">${escapeHtml(dataVersion())}</b><span class="cell-sub">数据截至 ${escapeHtml(dataAsOf())}</span></div><div class="context-card"><h4>当前服务</h4><b class="mono">${state.currentBinding ? escapeHtml(state.currentBinding.dataVersion) : "尚无消费组合"}</b><span class="cell-sub">${state.currentBinding ? "候选失败时继续服务" : "候选通过前不可正式消费"}</span></div></div>`;
  }

  function renderCandidateEvidence() {
    if (state.evidence === "idle") return `<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>固定问题验证证据</h3><p>只读取智能问数返回的隔离候选证据，不在本体管理创建验证任务。</p></div>${button("刷新验证证据", "fetch-evidence", { primary: true, iconName: "refresh-cw" })}</div><div class="panel-body"><div class="empty" style="min-height:170px"><div class="empty-inner"><div class="empty-icon">${icon("file-search-2")}</div><h3>尚未收到验证证据</h3><p>刷新后逐题显示通过、失败、超时、未知或版本不一致；单题通过不会放行整个候选。</p></div></div></div></section>`;
    if (state.evidence === "processing") return `<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>正在读取固定问题证据</h3><p>保持候选双版本不变。</p></div>${status("处理中", "blue", true)}</div><div class="panel-body"><div class="stack"><div class="skeleton" style="height:40px"></div><div class="skeleton" style="height:40px"></div><div class="skeleton" style="height:40px"></div></div></div></section>`;
    const failedCase = state.evidence === "partial" ? "Q05" : null;
    return `<section class="panel" style="margin-top:10px"><div class="panel-head"><div class="panel-head-copy"><h3>固定问题验证证据</h3><p>题集 FIN-QA-CORE-01 · 精确候选双版本 · 第 ${state.evidenceAttempts} 次读取</p></div>${state.evidence === "success" ? status("整体通过", "green") : status("整体未通过", "red")}</div><div class="panel-body flush">${fixedCases.map(item => {
      const isFailed = item.id === failedCase;
      return `<div class="test-row"><span class="test-icon">${icon(isFailed ? "clock-alert" : "check", 11)}</span><div><b>${item.id} · ${item.name}</b><span>${item.point}</span></div><span>${isFailed ? "验证超时，未返回证据" : "同一候选双版本"}</span>${status(isFailed ? "超时" : "通过", isFailed ? "red" : "green")}</div>`;
    }).join("")}</div><div class="panel-body" style="border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px">${state.evidence === "partial" ? button("重新读取完整证据", "fetch-evidence", { primary: true, iconName: "refresh-cw" }) : button("采用为当前消费组合", "open-bind", { primary: true, iconName: "package-check" })}</div></section>
    ${state.evidence === "partial" ? `<div class="notice error" style="margin-top:10px">${icon("circle-alert")}<div class="notice-content"><b>单题超时，候选整体不通过</b><span>不会创建当前消费组合；${state.currentBinding ? "上一可信组合继续服务。" : "当前尚无正式消费组合。"}</span></div></div>` : ""}`;
  }

  function renderOverlay() {
    if (ui.modal === "create") return renderCreateModal();
    if (ui.modal === "reset") return renderResetModal();
    if (ui.modal === "help") return renderHelpModal();
    if (ui.modal === "bind") return renderBindModal();
    if (ui.drawer === "publish") return renderPublishDrawer();
    return "";
  }

  function renderCreateModal() {
    return `<div class="modal-layer" data-overlay="close"><form class="modal" id="create-form"><div class="modal-head"><div class="modal-head-copy"><h3>创建本体</h3><p>创建后进入独立草稿，发布前不会出现在资源目录。</p></div><button type="button" class="icon-btn" data-action="close-overlay" title="关闭">${icon("x")}</button></div><div class="modal-body"><div class="form-grid"><div class="form-field full"><label for="ontology-name">本体名称</label><input id="ontology-name" name="name" value="集团融资优化本体" required /></div><div class="form-field full"><label for="ontology-definition">业务定义</label><textarea id="ontology-definition" name="definition" required>围绕集团融资主体、融资明细、金融机构和融资负责人，统一融资成本与债务结构的业务语义和行动定义。</textarea></div><div class="form-field"><label>适用场景</label><select name="scenario"><option>集团融资成本与债务结构优化</option></select></div><div class="form-field"><label>工作方式</label><input value="单账号配置与发布" readonly /></div></div></div><div class="modal-foot">${button("取消", "close-overlay")}${button("创建并进入建模", "submit-create", { primary: true, iconName: "arrow-right" })}</div></form></div>`;
  }

  function renderResetModal() {
    return `<div class="modal-layer" data-overlay="close"><div class="modal"><div class="modal-head"><div class="modal-head-copy"><h3>重置状态</h3><p>回到尚未创建本体的初始状态。</p></div><button type="button" class="icon-btn" data-action="close-overlay" title="关闭">${icon("x")}</button></div><div class="modal-body"><div class="notice error">${icon("triangle-alert")}<div class="notice-content"><b>将清除本次操作产生的全部状态</b><span>包括草稿、映射结果、Published 版本、刷新证据和当前消费组合。该操作仅影响当前浏览器中的本体管理工作区。</span></div></div></div><div class="modal-foot">${button("取消", "close-overlay")}${button("确认重置", "confirm-reset", { danger: true, iconName: "rotate-ccw" })}</div></div></div>`;
  }

  function renderHelpModal() {
    return `<div class="modal-layer" data-overlay="close"><div class="modal"><div class="modal-head"><div class="modal-head-copy"><h3>本体管理帮助</h3><p>当前工作区的关键状态含义。</p></div><button type="button" class="icon-btn" data-action="close-overlay" title="关闭">${icon("x")}</button></div><div class="modal-body"><dl class="fact-list"><dt>编辑中</dt><dd>资源只存在于草稿，不进入正式目录。</dd><dt>已发布</dt><dd>语义定义已形成精确 Published 版本，不代表数据已就绪。</dd><dt>候选可预览</dt><dd>刷新结果可检查，但尚未进入正式消费。</dd><dt>等待权威绑定</dt><dd>刷新和固定问题证据通过，可由本体管理采用。</dd><dt>消费就绪</dt><dd>精确语义版本与数据版本已成为当前消费组合。</dd><dt>上一可信组合</dt><dd>新候选失败时继续服务的已采用组合。</dd></dl></div><div class="modal-foot">${button("关闭", "close-overlay", { primary: true })}</div></div></div>`;
  }

  function validationItems() {
    return [
      { name: "Object Type 名称、定义、身份与标题", ok: state.structureAdded, location: "建模工作区" },
      { name: "身份非空、唯一且稳定", ok: state.mappingPreview === "success", location: "映射与预览" },
      { name: "Link 端点存在且可以匹配", ok: state.mappingPreview === "success" && !!state.institutionMapping, location: "映射与预览" },
      { name: "Metric 范围、单位、时间与零分母处理", ok: state.structureAdded, location: "融资指标" },
      { name: "Rule 依赖、条件、阈值与测试样例", ok: state.structureAdded, location: "融资规则" },
      { name: "Action Type 目标、输入与人工确认", ok: state.actionConfirm, location: "发起融资优化建议" }
    ];
  }

  function renderPublishDrawer() {
    const items = validationItems();
    const allPassed = items.every(item => item.ok);
    const processing = state.validation === "processing" || state.publish === "processing";
    return `<div class="drawer-layer" data-overlay="close"><aside class="drawer"><div class="modal-head"><div class="modal-head-copy"><h3>检查并发布</h3><p>统一校验对象、关系、Metric、Rule 与 Action Type 合同。</p></div><button type="button" class="icon-btn" data-action="close-overlay" title="关闭">${icon("x")}</button></div><div class="modal-body">
      <div class="notice ${state.validation === "success" ? "success" : state.validation === "failed" ? "error" : "info"}">${icon(state.validation === "success" ? "check-circle-2" : state.validation === "failed" ? "circle-alert" : "info")}<div class="notice-content"><b>${state.validation === "success" ? "全部发布门禁通过" : state.validation === "failed" ? "发布被 1 项问题阻断" : state.validation === "processing" ? "正在运行统一校验" : "尚未运行统一校验"}</b><span>${state.validation === "success" ? "可以形成新的 Published 语义版本。" : state.validation === "failed" ? "修正失败项后重新运行；不会生成失败版本。" : "校验结果会显示修正位置和下一步。"}</span></div></div>
      <section class="panel" style="margin-top:12px"><div class="panel-head"><div class="panel-head-copy"><h3>发布门禁</h3><p>${items.filter(item => item.ok).length} / ${items.length} 项已满足</p></div></div><div class="table-wrap"><table><thead><tr><th>检查项</th><th>状态</th><th>责任位置</th><th></th></tr></thead><tbody>${items.map((item, index) => `<tr><td class="cell-title">${escapeHtml(item.name)}</td><td>${state.validation === "idle" || state.validation === "processing" ? status("待检查", "") : item.ok ? status("通过", "green") : status("失败", "red")}</td><td>${escapeHtml(item.location)}</td><td>${!item.ok && state.validation === "failed" ? button("去修正", index === 5 ? "fix-action-confirm" : "go-mapping", { ghost: true, small: true }) : ""}</td></tr>`).join("")}</tbody></table></div></section>
      ${state.validation === "success" ? `<section class="panel"><div class="panel-head"><div class="panel-head-copy"><h3>发布内容</h3><p>发布后全部资源共享一个精确语义版本。</p></div></div><div class="panel-body"><div class="resource-chips"><span class="resource-chip">4 Object Type</span><span class="resource-chip">16 Property</span><span class="resource-chip">3 Link</span><span class="resource-chip">7 Metric</span><span class="resource-chip">3 Rule</span><span class="resource-chip">1 Action Type</span></div></div></section>` : ""}
    </div><div class="modal-foot">${button("关闭", "close-overlay")}${state.validation !== "success" ? button(state.validation === "processing" ? "校验中" : "运行统一校验", "run-validation", { primary: true, iconName: "scan-search", disabled: processing || !state.structureAdded }) : button(state.publish === "processing" ? "发布中" : "发布", "publish", { primary: true, iconName: "upload", disabled: processing })}</div></aside></div>`;
  }

  function renderBindModal() {
    return `<div class="modal-layer" data-overlay="close"><div class="modal wide"><div class="modal-head"><div class="modal-head-copy"><h3>采用为当前消费组合</h3><p>原子提交精确 Published 语义版本与候选数据版本。</p></div><button type="button" class="icon-btn" data-action="close-overlay" title="关闭">${icon("x")}</button></div><div class="modal-body"><div class="notice success">${icon("check-circle-2")}<div class="notice-content"><b>全部必要门禁已通过</b><span>刷新结果、上下文完整性和 8 道固定问题证据属于同一候选双版本。</span></div></div><div class="grid-equal" style="margin-top:12px"><div class="context-card"><h4>Published 语义版本</h4><b class="mono">${escapeHtml(state.semanticVersion)}</b></div><div class="context-card"><h4>候选数据版本</h4><b class="mono">${escapeHtml(dataVersion())}</b><span class="cell-sub">数据截至 ${escapeHtml(dataAsOf())}</span></div></div>${state.currentBinding ? `<div class="notice info" style="margin-top:12px">${icon("history")}<div class="notice-content"><b>当前组合将成为上一可信组合</b><span>${escapeHtml(state.currentBinding.semanticVersion)} + ${escapeHtml(state.currentBinding.dataVersion)}；保留用于失败恢复与历史证据。</span></div></div>` : ""}</div><div class="modal-foot">${button("取消", "close-overlay")}${button(state.binding === "processing" ? "提交中" : "确认采用", "bind-current", { primary: true, iconName: "package-check", disabled: state.binding === "processing" })}</div></div></div>`;
  }

  function closeOverlay() {
    ui.modal = null;
    ui.drawer = null;
    render();
  }

  function asyncUpdate(startPatch, endPatch, delay, event) {
    update(startPatch);
    setTimeout(() => update(endPatch, event), delay);
  }

  function handleAction(action, event) {
    if (!action) return;
    if (action.startsWith("open-resource:")) {
      const id = action.slice("open-resource:".length);
      navigate(id === "obj.financing_subject" ? "object?tab=overview" : `resource?id=${encodeURIComponent(id)}`);
      return;
    }
    if (action.startsWith("select-model:")) {
      update({ selectedModelResource: action.slice("select-model:".length) });
      return;
    }
    if (action.startsWith("object-tab:")) {
      navigate(`object?tab=${action.slice("object-tab:".length)}`);
      return;
    }
    if (action.startsWith("consumer:")) {
      ui.consumer = action.slice("consumer:".length);
      render();
      return;
    }

    const actions = {
      "open-create": () => { ui.modal = "create"; render(); },
      "open-reset": () => { ui.modal = "reset"; render(); },
      "open-help": () => { ui.modal = "help"; render(); },
      "close-overlay": closeOverlay,
      "go-overview": () => navigate("overview"),
      "go-catalog": () => navigate("catalog"),
      "go-model": () => navigate("model"),
      "go-mapping": () => navigate("mapping"),
      "go-graph": () => navigate("graph"),
      "go-versions": () => navigate("versions"),
      "open-financing-subject": () => navigate("object?tab=overview"),
      "submit-create": () => document.getElementById("create-form")?.requestSubmit(),
      "add-structure": () => {
        update({ structureAdded: true, selectedModelResource: "obj.financing_subject", draftSaved: false }, { title: "添加业务结构", detail: "创建 4 个对象类型、3 条关系、7 个 Metric、3 条 Rule 和 1 个 Action Type" });
        toast("业务结构已加入当前草稿", "success");
      },
      "save-draft": () => {
        update({ draftSaved: true, draftSavedAt: nowText() }, { title: "保存草稿", detail: "当前语义资源已保存，正式目录未变化" });
        toast("草稿已保存", "success");
      },
      "toggle-action-confirm": () => update({ actionConfirm: !state.actionConfirm, validation: "idle" }),
      "select-asset": () => {
        update({ mappingSelected: true, mappingPreview: "idle" }, { title: "选择数据资产", detail: "融资标准化数据资产已加入当前映射" });
        toast("已选择融资标准化数据资产", "success");
      },
      "run-mapping-preview": () => {
        asyncUpdate({ mappingPreview: "processing" }, { mappingPreview: state.institutionMapping ? "success" : "failed" }, 850, { title: state.institutionMapping ? "对象与关系预览通过" : "关系预览失败", detail: state.institutionMapping ? "574 个主体、5,218 条融资明细、24 家机构，端点未匹配 0" : "融资机构终点字段尚未选择", tone: state.institutionMapping ? "success" : "error" });
      },
      "focus-institution-mapping": () => {
        setTimeout(() => document.getElementById("institution-mapping")?.focus(), 0);
      },
      "open-publish": () => { ui.drawer = "publish"; render(); },
      "run-validation": () => {
        const pass = validationItems().every(item => item.ok);
        asyncUpdate({ validation: "processing" }, { validation: pass ? "success" : "failed" }, 850, { title: pass ? "统一校验通过" : "统一校验未通过", detail: pass ? "6 项发布门禁全部通过" : "Action Type 尚未要求人工确认", tone: pass ? "success" : "error" });
      },
      "fix-action-confirm": () => {
        closeOverlay();
        state.selectedModelResource = "logic.action";
        saveState();
        navigate("model");
      },
      "publish": () => {
        const version = uid("SEM-FIN");
        update({ publish: "processing" });
        setTimeout(() => {
          ui.drawer = null;
          update({ publish: "published", semanticVersion: version, publishedAt: nowText(), validation: "success", refresh: "idle", refreshRequestId: null, refreshResultId: null, evidence: "idle", evidenceAttempts: 0, binding: "none" }, { title: "发布语义版本", detail: `${version} 已进入正式资源目录` });
          toast("Published 语义版本已形成", "success");
          navigate("versions");
        }, 1100);
      },
      "catalog-cards": () => { ui.catalogView = "cards"; render(); },
      "catalog-list": () => { ui.catalogView = "list"; render(); },
      "edit-financing-subject": () => { state.selectedModelResource = "obj.financing_subject"; saveState(); navigate("model"); },
      "edit-logic-metrics": () => { state.selectedModelResource = "logic.metrics"; saveState(); navigate("model"); },
      "mode-formal": () => { ui.consumptionMode = "formal"; render(); },
      "mode-candidate": () => { ui.consumptionMode = "candidate"; render(); },
      "receive-refresh": () => {
        const id = uid("REFRESH-REQ");
        update({ refreshRequestId: id, refresh: "idle", evidence: "idle", evidenceAttempts: 0, refreshResultId: null }, { title: "接收刷新请求", detail: `${id} 指向 ${dataVersion()}` });
        toast("已读取新的数据刷新请求");
      },
      "process-refresh": () => processRefresh(false),
      "retry-refresh": () => processRefresh(true),
      "fetch-evidence": () => {
        const nextAttempt = state.evidenceAttempts + 1;
        const partial = state.cycle === 1 && nextAttempt === 1;
        asyncUpdate({ evidence: "processing", evidenceAttempts: nextAttempt }, { evidence: partial ? "partial" : "success" }, 1100, { title: partial ? "候选验证证据不完整" : "候选验证证据完整", detail: partial ? "Q05 超时，整体保持未通过" : "8 道固定问题全部通过，候选双版本一致", tone: partial ? "error" : "success" });
      },
      "open-bind": () => { ui.modal = "bind"; render(); },
      "bind-current": () => {
        const newBinding = { bindingId: uid("BIND-FIN"), semanticVersion: state.semanticVersion, dataVersion: dataVersion(), asOf: dataAsOf(), adoptedAt: nowText() };
        update({ binding: "processing" });
        setTimeout(() => {
          ui.modal = null;
          ui.consumptionMode = "formal";
          update({ binding: "ready", previousBinding: state.currentBinding, currentBinding: newBinding }, { title: "采用当前消费组合", detail: `${newBinding.semanticVersion} + ${newBinding.dataVersion} 已成为当前权威组合` });
          toast("当前消费组合已采用", "success");
        }, 900);
      },
      "check-data-update": () => {
        if (state.cycle === 1 && state.currentBinding) {
          const id = uid("REFRESH-REQ");
          ui.consumptionMode = "candidate";
          update({ cycle: 2, refreshRequestId: id, refreshResultId: null, refresh: "idle", evidence: "idle", evidenceAttempts: 0, compatibilityFixed: false }, { title: "发现数据更新", detail: `${id} 指向 DATA-FIN-20260810-02` });
          toast("发现一个新的数据刷新请求");
        } else {
          ui.consumptionMode = "candidate";
          render();
          toast("当前没有更新的数据版本");
        }
      },
      "save-compatibility": () => {
        update({ compatibilityFixed: true }, { title: "保存兼容映射", detail: "新候选的机构代码已映射为融资机构稳定端点" });
        toast("兼容映射已保存，可创建关联重试", "success");
        navigate("versions");
      },
      "confirm-reset": () => {
        localStorage.removeItem(STORAGE_KEY);
        state = defaultState();
        ui.modal = null;
        ui.drawer = null;
        ui.consumptionMode = "formal";
        ui.consumer = "qa";
        navigate("overview");
        render();
        toast("已回到初始状态", "success");
      }
    };
    actions[action]?.(event);
  }

  function processRefresh(isRetry) {
    if (state.cycle === 2 && isRetry && !state.compatibilityFixed) {
      toast("请先修正机构端点映射", "error");
      navigate("mapping");
      return;
    }
    const resultId = uid(isRetry ? "REFRESH-RESULT-RETRY" : "REFRESH-RESULT");
    const shouldFail = state.cycle === 2 && !isRetry;
    asyncUpdate({ refresh: "processing", refreshResultId: resultId }, {
      refresh: shouldFail ? "failed" : "success",
      refreshResultId: resultId,
      refreshFailure: shouldFail ? "新候选中的机构端点字段已变化，3 条融资明细无法连接到融资机构" : null,
      evidence: "idle",
      evidenceAttempts: 0
    }, 1100, {
      title: shouldFail ? "候选刷新失败" : isRetry ? "关联重试成功" : "候选刷新成功",
      detail: shouldFail ? "3 条机构关系端点不兼容，当前消费组合未切换" : `${resultId} 已形成候选对象、关系与逻辑结果`,
      tone: shouldFail ? "error" : "success"
    });
  }

  document.addEventListener("click", event => {
    const overlay = event.target.closest("[data-overlay='close']");
    if (overlay && event.target === overlay) {
      closeOverlay();
      return;
    }
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      navigate(nav.dataset.nav);
      return;
    }
    const target = event.target.closest("[data-action]");
    if (target && !target.disabled) handleAction(target.dataset.action, event);
  });

  document.addEventListener("change", event => {
    const input = event.target.dataset.input;
    if (input === "catalog-type") {
      ui.catalogType = event.target.value;
      render();
    }
    if (input === "institution-mapping") {
      update({ institutionMapping: event.target.value, mappingPreview: "idle", validation: "idle" });
    }
  });

  document.addEventListener("input", event => {
    if (event.target.dataset.input === "catalog-query") {
      ui.catalogQuery = event.target.value;
      const panel = event.target.closest(".panel");
      const resources = allResources().filter(resource => (ui.catalogType === "全部类型" || resource.type === ui.catalogType) && (!ui.catalogQuery.trim() || `${resource.name} ${resource.id} ${resource.definition}`.toLowerCase().includes(ui.catalogQuery.trim().toLowerCase())));
      const existing = panel?.querySelector(ui.catalogView === "cards" ? ".catalog-cards, .empty" : ".table-wrap, .empty");
      if (existing) existing.outerHTML = ui.catalogView === "cards" ? renderCatalogCards(resources) : renderCatalogList(resources);
      if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    }
  });

  document.addEventListener("submit", event => {
    if (event.target.id !== "create-form") return;
    event.preventDefault();
    const form = new FormData(event.target);
    const ontology = { name: String(form.get("name") || "").trim(), definition: String(form.get("definition") || "").trim(), scenario: String(form.get("scenario") || "") };
    if (!ontology.name || !ontology.definition) return;
    ui.modal = null;
    update({ ontology }, { title: "创建本体", detail: `${ontology.name} 已创建为独立草稿` });
    toast("本体草稿已创建", "success");
    navigate("model");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && (ui.modal || ui.drawer)) closeOverlay();
  });

  window.addEventListener("hashchange", render);
  if (!location.hash) location.replace("#overview");
  render();
})();
