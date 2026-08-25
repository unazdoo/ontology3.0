(function () {
  "use strict";

  const DATA = window.DASHBOARD_DATA;
  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");
  if (!DATA) throw new Error("仪表盘数据未加载");

  const DEFAULT_STATE = {
    financeScopeType: "group",
    financeScopeId: "集团",
    financeCompare: ["单位553", "单位465", "单位561"],
    budgetScope: "全部单位",
    budgetExpanded: "",
    riskTier: "全部",
    riskSector: "全部产业",
    riskSort: "risk",
    riskSearch: "",
    riskModelSection: "overview",
    riskActionStates: {},
    riskModelDraft: null,
    riskPublishedConfig: null,
    riskModelStatus: "published",
    riskModelValidation: null,
    riskModelSavedAt: "",
    riskModelPublishedVersion: "",
    riskModelPublishedAt: "",
    riskModelPublishReceipt: "",
    riskModelPublishError: "",
    riskDataCheckedAt: "",
    riskRerunState: "idle",
    riskRerunRunId: "",
    riskRerunAt: "",
    riskRerunError: "",
    riskRerunResult: null,
    riskRerunAttempts: 0,
    drawer: null,
  };
  const state = { ...DEFAULT_STATE };
  try {
    const current = localStorage.getItem("ofw.dashboard.workspace.v7");
    Object.assign(state, JSON.parse(current || "{}"));
    if (!current) Object.assign(state, {
      riskActionStates: {},
      riskModelDraft: null,
      riskPublishedConfig: null,
      riskModelStatus: "published",
      riskModelValidation: null,
      riskModelSavedAt: "",
      riskModelPublishedVersion: "",
      riskModelPublishedAt: "",
      riskModelPublishReceipt: "",
      riskModelPublishError: "",
      riskRerunState: "idle",
      riskRerunRunId: "",
      riskRerunAt: "",
      riskRerunError: "",
      riskRerunResult: null,
      riskRerunAttempts: 0,
    });
    state.drawer = null;
  } catch (_) {}

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  const initialRiskConfig = byId("risk").modelConfig;
  if (!state.riskModelDraft) {
    state.riskModelDraft = {
      weights: clone(initialRiskConfig.weights),
      factors: clone(initialRiskConfig.factors),
      tiers: clone(initialRiskConfig.tiers),
    };
  }
  if (!state.riskPublishedConfig) state.riskPublishedConfig = clone(state.riskModelDraft);
  if (!state.riskModelPublishedVersion) state.riskModelPublishedVersion = initialRiskConfig.publishedVersion;
  if (!state.riskActionStates || typeof state.riskActionStates !== "object") state.riskActionStates = {};

  function persist() {
    const copy = { ...state, drawer: null };
    localStorage.setItem("ofw.dashboard.workspace.v7", JSON.stringify(copy));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function attr(value) { return esc(value); }
  function fmt(value, digits = 2) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—";
  }
  function icon(name, size = "") { return `<span class="icon ${size}"><i data-lucide="${name}"></i></span>`; }
  function badge(label, tone = "plain") { return `<span class="badge ${tone}">${esc(label)}</span>`; }
  function refreshIcons() { window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } }); }
  function toneFor(value) {
    if (/红灯|异常|高关注|超支|负余额/.test(value)) return "danger";
    if (/黄灯|关注|接近|偏低|偏慢|执行中|待人工确认|跟踪中/.test(value)) return "warning";
    if (/已完成|已形成|正常|绿灯|通过/.test(value)) return "success";
    return "plain";
  }
  function toast(message) {
    toastRoot.innerHTML = `<div class="toast">${icon("circle-check", "sm")}<strong>${esc(message)}</strong></div>`;
    refreshIcons();
    window.setTimeout(() => { toastRoot.innerHTML = ""; }, 2200);
  }
  function byId(id) { return DATA.dashboards.find((item) => item.id === id); }
  function route() {
    const raw = (location.hash || "#/dashboards").replace(/^#/, "");
    const clean = raw.split("?")[0];
    const parts = clean.split("/").filter(Boolean);
    return parts[0] === "view" ? { type: "view", id: parts[1], tab: parts[2] || "overview" } : { type: "directory" };
  }
  function dashboardHref(id, tab = "overview") { return `#/view/${id}/${tab}`; }
  function displayAsOf(value) {
    const text = String(value ?? "");
    const year = text.match(/^(\d{4})\s*年度$/);
    return year ? `${year[1]}-12-31（年度）` : text;
  }

  function localDateTime(date = new Date()) {
    const part = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())} ${part(date.getHours())}:${part(date.getMinutes())}:${part(date.getSeconds())}`;
  }

  function shell(content) {
    app.className = "dash-app";
    app.innerHTML = `
      <header class="module-bar">
        <div class="module-title"><span class="mark">${icon("chart-no-axes-combined", "sm")}</span><div><strong>仪表盘</strong><small>经营分析与管理驾驶舱</small></div></div>
        <div class="module-actions"><a class="btn" href="#/dashboards">${icon("layout-dashboard", "sm")}<span>仪表盘目录</span></a><button class="btn" type="button" data-action="refresh">${icon("refresh-cw", "sm")}<span>重新读取</span></button></div>
      </header>
      ${content}
      ${state.drawer ? renderDrawer() : ""}
    `;
    refreshIcons();
  }

  function renderDirectory() {
    const previews = {
      financing: `<div class="directory-capability"><strong>7 项核心指标</strong><span>单位比较 · 六类结构 · 三条规则</span></div>`,
      budget: `<div class="directory-capability"><strong>6 个监督专题</strong><span>预算执行 · 项目 · 差旅 · 计提 · 占用 · 供应商</span></div>`,
      risk: `<div class="mini-risk-bars"><i style="--w:76%;--c:#16806a"></i><i style="--w:19%;--c:#d39a2c"></i><i style="--w:5%;--c:#c84a43"></i></div>`,
    };
    shell(`
      <main class="page directory-page" data-screen-label="仪表盘目录">
        <header class="page-head directory-head"><div><span class="eyebrow">经营分析</span><h1>仪表盘</h1><p>从统一目录进入三套业务驾驶舱，按业务口径查看指标、趋势、专题和下钻明细。</p></div>${badge("3 个驾驶舱可用", "success")}</header>
        <section class="directory-grid">
          ${DATA.dashboards.map((dash) => `
            <article class="directory-card ${dash.id}">
              <header class="directory-card-head"><span class="dash-symbol">${icon(dash.id === "financing" ? "landmark" : dash.id === "budget" ? "circle-dollar-sign" : "shield-alert", "lg")}</span><div>${badge(dash.scenarioId, "plain")}${badge("当前正式使用", "success")}</div></header>
              <div><h2>${esc(dash.name)}</h2><p>${esc(dash.description)}</p></div>
              <div class="directory-visual">${previews[dash.id]}</div>
              <div class="directory-metrics">${dash.metrics.slice(0, 4).map((item) => `<div><span>${esc(item.label)}</span><strong>${esc(item.display)} <small>${esc(item.unit)}</small></strong></div>`).join("")}</div>
              <footer class="directory-foot"><div><small>数据截至</small><strong>${esc(displayAsOf(dash.period))}</strong></div><a class="btn primary" href="${dashboardHref(dash.id)}">打开驾驶舱${icon("arrow-right", "sm")}</a></footer>
            </article>
          `).join("")}
        </section>
      </main>
    `);
  }

  function metricsGrid(metrics, options = {}) {
    return `<section class="metrics-grid ${options.compact ? "compact" : ""}">${metrics.map((item) => `
      <button class="metric" type="button" data-action="metric-detail" data-dashboard="${attr(options.dashboard || "")}" data-key="${attr(item.key)}">
        <span>${esc(item.label)}</span><div class="metric-value"><strong>${esc(item.display)}</strong><em>${esc(item.unit)}</em></div>
        <div class="metric-footline"><span class="metric-change ${esc(item.trend || "flat")}">${icon(item.trend === "up" ? "trending-up" : item.trend === "down" ? "trending-down" : "minus", "sm")}${esc(item.change || "")}</span><span class="metric-evidence">查看口径 ${icon("chevron-right", "sm")}</span></div>
      </button>
    `).join("")}</section>`;
  }

  function lineChart(points, unit = "%", currentLabel = "当前值") {
    const width = 820;
    const height = 250;
    const padX = 48;
    const padY = 34;
    const values = points.map((item) => Number(item[1]));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    const plotted = points.map((item, index) => ({
      label: item[0], value: Number(item[1]),
      x: padX + index * ((width - padX * 2) / Math.max(1, points.length - 1)),
      y: height - padY - ((Number(item[1]) - min) / spread) * (height - padY * 2),
    }));
    const path = plotted.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const area = `${path} L${width - padX} ${height - padY} L${padX} ${height - padY} Z`;
    const gradientId = `area-${Math.random().toString(36).slice(2, 8)}`;
    return `<div class="chart"><div class="chart-summary"><strong>${fmt(values.at(-1), unit === "%" ? 3 : 2)}${unit}</strong><span>${esc(currentLabel)}</span></div><svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="趋势图"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d7aa6" stop-opacity=".32"></stop><stop offset="1" stop-color="#3d7aa6" stop-opacity=".02"></stop></linearGradient></defs>${[0, 1, 2, 3].map((index) => `<line class="grid-line" x1="${padX}" y1="${padY + index * ((height - padY * 2) / 3)}" x2="${width - padX}" y2="${padY + index * ((height - padY * 2) / 3)}"></line>`).join("")}<path class="trend-area" d="${area}" fill="url(#${gradientId})"></path><path class="trend-line" d="${path}"></path>${plotted.map((point, index) => `<g class="chart-point"><circle cx="${point.x}" cy="${point.y}" r="4"><title>${esc(point.label)} ${fmt(point.value, 3)}${esc(unit)}</title></circle>${index % Math.ceil(points.length / 6) === 0 || index === points.length - 1 ? `<text class="axis-label" x="${point.x}" y="${height - 8}" text-anchor="middle">${esc(point.label.replace(/^\d{4}-/, ""))}</text>` : ""}</g>`).join("")}</svg></div>`;
  }

  function panel(title, subtitle, body, tools = "", className = "") {
    return `<section class="panel ${className}"><header class="panel-head"><div><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>${tools}</header><div class="panel-body">${body}</div></section>`;
  }

  function dashboardHeader(dash, options = {}) {
    return `<header class="page-head dashboard-page-head"><div class="dashboard-title"><a class="icon-btn" href="#/dashboards" aria-label="返回仪表盘目录">${icon("arrow-left", "sm")}</a><div><span class="eyebrow">${esc(dash.scenarioId)} · 管理驾驶舱</span><h1>${esc(dash.name)}</h1><p>${esc(dash.description)}</p></div></div><div class="head-actions">${options.actions || ""}</div></header>`;
  }

  function infoStrip(dash) {
    return `<section class="authority-strip"><div>${icon("database", "sm")}<span>数据范围</span><strong>${esc(dash.dataLabel)}</strong></div><div>${icon("network", "sm")}<span>业务定义</span><strong>${esc(dash.semanticLabel)}</strong></div><div>${icon("calendar-clock", "sm")}<span>数据截至</span><strong>${esc(displayAsOf(dash.period))}</strong></div><div>${icon("shield-check", "sm")}<span>业务状态</span><strong>当前正式使用</strong></div></section>`;
  }

  function tabs(items, active, dashboard) {
    return `<nav class="tabs" aria-label="驾驶舱视图">${items.map((item) => `<a class="tab ${item.id === active ? "active" : ""}" href="${dashboardHref(dashboard, item.id)}">${item.icon ? icon(item.icon, "sm") : ""}<span>${esc(item.label)}</span></a>`).join("")}</nav>`;
  }

  function financeScopedMetrics(dash) {
    if (state.financeScopeType === "group") return dash.metrics;
    const source = state.financeScopeType === "board" ? dash.boards.find((item) => item.name === state.financeScopeId) : dash.units.find((item) => item.name === state.financeScopeId);
    if (!source) return dash.metrics;
    const digits = { balance: 3, cost: 6, floating: 2, shortTerm: 2, foreign: 2, highCost: 2, credit: 2 };
    return dash.metrics.map((metric) => {
      const value = Number(source[metric.key]);
      return { ...metric, value, display: fmt(value, digits[metric.key] ?? 2), change: state.financeScopeId, trend: "flat" };
    });
  }

  function financeToolbar(dash) {
    const options = state.financeScopeType === "board" ? dash.boards : state.financeScopeType === "unit" ? dash.units : [];
    return `<section class="dashboard-toolbar"><div class="toolbar-group"><span class="toolbar-label">分析范围</span><div class="segmented"><button class="${state.financeScopeType === "group" ? "active" : ""}" type="button" data-action="finance-scope" data-type="group">集团</button><button class="${state.financeScopeType === "board" ? "active" : ""}" type="button" data-action="finance-scope" data-type="board">板块</button><button class="${state.financeScopeType === "unit" ? "active" : ""}" type="button" data-action="finance-scope" data-type="unit">单位</button></div>${options.length ? `<select class="select" data-change="finance-scope-id">${options.map((item) => `<option ${item.name === state.financeScopeId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>` : `<strong class="current-scope">集团</strong>`}</div><div class="inline-actions"><span>更新时间 ${esc(dash.updatedAt)}</span>${badge("数据已更新", "success")}</div></section>`;
  }

  function structureCard(item, compact = false) {
    const colors = ["#24618f", "#7fa7c3", "#d4a347", "#8794a2"];
    return `<button class="structure-card ${compact ? "compact" : ""}" type="button" data-action="structure-detail" data-id="${attr(item.id)}"><header><strong>${esc(item.name)}</strong>${icon("chevron-right", "sm")}</header><div class="stacked-bar">${item.items.map((part, index) => `<i style="width:${part[1]}%;background:${colors[index % colors.length]}" title="${attr(part[0])} ${fmt(part[1], 2)}%"></i>`).join("")}</div><div class="structure-legend">${item.items.map((part, index) => `<span><i style="background:${colors[index % colors.length]}"></i>${esc(part[0])}<strong>${fmt(part[1], 2)}%</strong></span>`).join("")}</div></button>`;
  }

  function financeOverview(dash) {
    const scopedMetrics = financeScopedMetrics(dash);
    const cost = scopedMetrics.find((item) => item.key === "cost");
    const unitRows = dash.units.map((item, index) => `<tr><td><button class="table-link" type="button" data-action="finance-unit-detail" data-index="${index}">${esc(item.name)}</button><small class="cell-note">${esc(item.board)}</small></td><td class="num">${fmt(item.balance, 3)}</td><td class="num">${fmt(item.cost, 6)}%</td><td class="num">${fmt(item.floating, 2)}%</td><td>${badge(item.finding, item.tone)}</td><td><button class="text-btn" type="button" data-action="finance-unit-detail" data-index="${index}">查看详情</button></td></tr>`).join("");
    return `${metricsGrid(scopedMetrics, { dashboard: "financing" })}<section class="grid-main wide">${panel("融资成本快照", "当前已发布数据只提供本期结果，不展示无历史依据的趋势序列", `<div class="snapshot-hero"><strong>${fmt(cost?.value, 6)}%</strong><span>余额加权融资成本 · 数据截至 ${esc(displayAsOf(dash.period))}</span><p>趋势分析需要连续历史版本；当前工作台仅呈现本期确定性结果。</p></div>`, `<button class="text-btn" type="button" data-action="metric-detail" data-dashboard="financing" data-key="cost">查看口径 ${icon("chevron-right", "sm")}</button>`, "snapshot-panel")}${panel("债务结构", "当前融资余额结构", `<div class="structure-preview">${dash.structures.slice(0, 2).map((item) => structureCard(item, true)).join("")}</div>`, `<a class="text-btn" href="${dashboardHref("financing", "structure")}">查看全部 ${icon("chevron-right", "sm")}</a>`)}</section><section class="grid-main">${panel("重点单位", "成本、结构和规则发现使用同一业务范围", `<div class="table-wrap"><table class="data-table"><thead><tr><th>单位 / 板块</th><th class="num">余额（亿元）</th><th class="num">加权成本</th><th class="num">浮动利率</th><th>主要发现</th><th></th></tr></thead><tbody>${unitRows}</tbody></table></div>`, "", "flush-body")}${panel("经营解读", "基于当前业务事实形成", `<div class="brief-list"><article><span class="brief-index">01</span><div><strong>本期融资成本</strong><p>当前余额加权融资成本为 ${fmt(cost?.value, 6)}%，只引用本期正式结果。</p></div></article><article><span class="brief-index warning">02</span><div><strong>浮动利率暴露较高</strong><p>浮动利率余额占比 95.15%，需持续关注市场利率变化。</p></div></article><article><span class="brief-index danger">03</span><div><strong>单位差异需要分层处理</strong><p>单位553、单位465、单位561分别命中成本、利率和期限规则。</p></div></article></div><div class="query-links"><a class="btn" href="../intelligent-query-prototype/review-next/conversation-workspace/index.html#/ask">${icon("message-square-text", "sm")}继续问数</a><a class="btn" href="${dashboardHref("financing", "rules")}">${icon("list-checks", "sm")}查看规则与行动</a></div>`)} </section>`;
  }

  function financeCompare(dash) {
    const selected = state.financeCompare;
    const rows = dash.units.filter((item) => selected.includes(item.name));
    const balance = rows.reduce((sum, item) => sum + item.balance, 0);
    const weightedCost = balance ? rows.reduce((sum, item) => sum + item.balance * item.cost, 0) / balance : 0;
    const chartMax = Math.max(...dash.units.map((item) => item.cost), 1);
    return `<section class="panel"><header class="panel-head"><div><h2>单位比较</h2><p>选择 2—3 家单位，组合值按所选单位融资余额加权。</p></div>${badge(`已选 ${selected.length} 家`, selected.length >= 2 ? "success" : "warning")}</header><div class="panel-body"><div class="unit-chips">${dash.units.map((item) => `<button class="unit-chip ${selected.includes(item.name) ? "active" : ""}" type="button" data-action="toggle-finance-unit" data-unit="${attr(item.name)}">${icon(selected.includes(item.name) ? "check" : "plus", "sm")}${esc(item.name)}</button>`).join("")}</div>${selected.length < 2 ? `<div class="empty-inline">至少选择 2 家单位后查看组合指标。</div>` : `<div class="comparison-summary"><div><span>组合融资余额</span><strong>${fmt(balance, 3)} 亿元</strong></div><div><span>组合加权融资成本</span><strong>${fmt(weightedCost, 6)}%</strong></div><div><span>与集团基准差异</span><strong class="${weightedCost > dash.metrics[1].value ? "text-danger" : "text-success"}">${weightedCost > dash.metrics[1].value ? "+" : ""}${fmt(weightedCost - dash.metrics[1].value, 6)} 个百分点</strong></div></div><div class="compare-layout"><div class="compare-bars">${rows.map((item) => `<div class="compare-bar-row"><span>${esc(item.name)}</span><div><i style="width:${item.cost / chartMax * 100}%"></i></div><strong>${fmt(item.cost, 4)}%</strong></div>`).join("")}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>单位</th><th class="num">余额</th><th class="num">加权成本</th><th class="num">浮动利率</th><th class="num">短期债务</th><th>主要发现</th></tr></thead><tbody>${rows.map((item) => `<tr><td><strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.board)}</small></td><td class="num">${fmt(item.balance, 3)}</td><td class="num">${fmt(item.cost, 6)}%</td><td class="num">${fmt(item.floating, 2)}%</td><td class="num">${fmt(item.shortTerm, 2)}%</td><td>${badge(item.finding, item.tone)}</td></tr>`).join("")}</tbody></table></div></div>`}</div></section>`;
  }

  function financeStructure(dash) {
    const maxShare = Math.max(...dash.institutions.map((item) => item.share));
    const institutionRows = dash.institutions.map((item, index) => `<tr><td><strong>${esc(item.name)}</strong><small class="cell-note">银行</small></td><td class="num">${fmt(item.balance, 3)}</td><td><div class="table-bar"><i style="width:${item.share / maxShare * 100}%"></i><span>${fmt(item.share, 2)}%</span></div></td><td class="num">${fmt(item.cost, 6)}%</td><td class="num">${item.count}</td><td><button class="text-btn" type="button" data-action="institution-detail" data-index="${index}">查看详情</button></td></tr>`).join("");
    return `<section class="structure-grid">${dash.structures.map((item) => structureCard(item)).join("")}</section>${panel("主要融资机构", "按集团融资余额排序，查看机构贡献与成本", `<div class="table-wrap"><table class="data-table"><thead><tr><th>融资机构</th><th class="num">融资余额（亿元）</th><th>余额占比</th><th class="num">加权成本</th><th class="num">借据数</th><th></th></tr></thead><tbody>${institutionRows}</tbody></table></div>`, "", "flush-body")}`;
  }

  function financeRules(dash) {
    return `<section class="rule-grid">${dash.rules.map((rule, index) => `<article class="rule-card"><header><div>${badge(rule.result, "warning")}<span class="rule-code">${esc(rule.code)}</span></div><button class="icon-btn" type="button" data-action="rule-detail" data-index="${index}" aria-label="查看规则详情">${icon("search", "sm")}</button></header><h2>${esc(rule.unit)} · ${esc(rule.title)}</h2><p>${esc(rule.branch)}</p><dl><div><dt>当前值</dt><dd>${esc(rule.observed)}</dd></div><div><dt>阈值</dt><dd>${esc(rule.threshold)}</dd></div><div><dt>优先机构</dt><dd>${esc(rule.institution)}</dd></div><div><dt>评估时间</dt><dd>${esc(rule.evaluatedAt)}</dd></div></dl></article>`).join("")}</section>${panel("行动协同", "行动状态由决策中心维护，仪表盘只读展示进展", `<div class="action-table">${dash.actions.map((item, index) => `<article><div><strong>${esc(item.title)}</strong><p>${esc(item.owner)} · ${esc(item.basis)}</p></div><div>${badge(item.status, toneFor(item.status))}<button class="text-btn" type="button" data-action="finance-action-detail" data-index="${index}">查看详情</button></div></article>`).join("")}</div>`, `<a class="btn" href="../decision-center-prototype/index.html#/workbench">${icon("external-link", "sm")}查看决策进展</a>`, "flush-body")}`;
  }

  function renderFinancing(tab) {
    const dash = byId("financing");
    const valid = ["overview", "compare", "structure", "rules"].includes(tab) ? tab : "overview";
    const tabItems = [{ id: "overview", label: "经营概览", icon: "layout-dashboard" }, { id: "compare", label: "单位比较", icon: "git-compare-arrows" }, { id: "structure", label: "结构与机构", icon: "chart-pie" }, { id: "rules", label: "规则与行动", icon: "list-checks" }];
    const content = valid === "overview" ? financeOverview(dash) : valid === "compare" ? financeCompare(dash) : valid === "structure" ? financeStructure(dash) : financeRules(dash);
    shell(`<main class="page dashboard-page financing-page" data-screen-label="集团融资驾驶舱">${dashboardHeader(dash, { actions: `<a class="btn" href="../report-center/review-lifecycle/index.html#/report/RPT-FIN-20260814-001">${icon("file-text", "sm")}查看融资报告</a><button class="btn primary" type="button" data-action="save-view">${icon("bookmark", "sm")}保存当前视图</button>` })}${infoStrip(dash)}${financeToolbar(dash)}${tabs(tabItems, valid, "financing")}<div class="dashboard-content">${content}</div></main>`);
  }

  function budgetScopedMetrics(dash) {
    if (state.budgetScope === "全部单位") return dash.metrics;
    const unit = dash.units.find((item) => item.name === state.budgetScope);
    if (!unit) return dash.metrics;
    const map = { approved: unit.budget, actual: unit.actual, execution: unit.execution, available: unit.available, inTransit: unit.inTransit };
    return dash.metrics.map((metric) => map[metric.key] == null ? metric : { ...metric, value: map[metric.key], display: fmt(map[metric.key], metric.key === "execution" ? 2 : 2), change: unit.name, trend: "flat" });
  }

  function budgetToolbar(dash) {
    return `<section class="dashboard-toolbar"><div class="toolbar-group"><span class="toolbar-label">分析范围</span><select class="select" data-change="budget-scope"><option>全部单位</option>${dash.units.map((item) => `<option ${item.name === state.budgetScope ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><span class="toolbar-note">筛选只改变当前专题的指标和明细</span></div><div class="inline-actions"><span>更新时间 ${esc(dash.updatedAt)}</span>${badge("专题数据已更新", "success")}</div></section>`;
  }

  function sum(rows, key) { return rows.reduce((total, item) => total + Number(item[key] || 0), 0); }
  function max(rows, key) { return Math.max(0, ...rows.map((item) => Number(item[key] || 0))); }
  function filteredBudgetRows(dash, tab) {
    const rows = dash.details[tab] || [];
    if (state.budgetScope === "全部单位") return rows;
    return rows.filter((item) => item.group === state.budgetScope || item.department === state.budgetScope);
  }
  function stat(label, value, note, tone = "plain") { return `<div class="topic-stat ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></div>`; }

  function budgetTopicStats(tab, rows) {
    if (tab === "cost") return `${stat("最终批准费用预算", `${fmt(sum(rows, "budget"), 2)} 万元`, "当前范围")}${stat("实际费用", `${fmt(sum(rows, "actual"), 2)} 万元`, "不含税")}${stat("加权执行率", `${fmt(sum(rows, "actual") / Math.max(.01, sum(rows, "budget")) * 100, 2)}%`, "实际 ÷ 最终批准")}${stat("关注单位", `${rows.filter((item) => item.status !== "正常").length} 个`, "执行偏低或接近上限", "warning")}`;
    if (tab === "project") return `${stat("项目明细", `${rows.length} 项`, "立项与占用同口径")}${stat("批准金额", `${fmt(sum(rows, "approved"), 2)} 万元`, "当前筛选范围")}${stat("可用余额", `${fmt(sum(rows, "available"), 2)} 万元`, "扣除实际、占用与计划")}${stat("高关注项目", `${rows.filter((item) => item.status === "高关注").length} 项`, "可用余额为负", "danger")}`;
    if (tab === "travel") return `${stat("2025 实际差旅", `${fmt(sum(rows, "actual2025"), 2)} 万元`, "当前范围")}${stat("2026 初始申报", `${fmt(sum(rows, "application2026"), 2)} 万元`, "不代表最终批准")}${stat("申报增量", `${fmt(sum(rows, "delta"), 2)} 万元`, "同口径比较")}${stat("关注事项", `${rows.filter((item) => item.status !== "正常").length} 项`, "同比增幅达到关注线", "warning")}`;
    if (tab === "accrual") return `${stat("配对记录", `${rows.length} 笔`, "预估与结算已配对")}${stat("差异记录", `${rows.filter((item) => Math.abs(item.delta) > 0).length} 笔`, "结算不等于预估")}${stat("差异金额", `${fmt(rows.reduce((total, item) => total + Math.abs(item.delta), 0), 2)} 万元`, "绝对差异合计")}${stat("最高差异率", `${fmt(max(rows, "rate"), 2)}%`, "逐项目比较", "warning")}`;
    if (tab === "concentration") return `${stat("全年正向采购发起", `${fmt(sum(rows, "annualPr"), 2)} 万元`, "全年正向采购")}${stat("最高 12 月采购占比", `${fmt(max(rows, "prRate"), 2)}%`, "分量一", "warning")}${stat("最高 12 月在途占比", `${fmt(max(rows, "transitRate"), 2)}%`, "分量二", "warning")}${stat("高关注项目", `${rows.filter((item) => item.status === "高关注").length} 项`, "任一分量达到 15%", "danger")}`;
    return `${stat("供应商可比组", `${new Set(rows.map((item) => item.group)).size} 组`, "同供应商同级别")}${stat("明细记录", `${rows.length} 条`, "部门与项目明细")}${stat("最高倍率", `${fmt(max(rows, "ratio"), 2)} 倍`, "最高人月成本 ÷ 最低人月成本", "warning")}${stat("异常组", `${new Set(rows.filter((item) => item.status === "异常").map((item) => item.group)).size} 组`, "倍率严格大于 1.20", "danger")}`;
  }

  function budgetDetailTable(tab, rows) {
    const configs = {
      project: { headers: ["项目", "批准金额", "实际", "采购占用", "计提", "剩余计划", "可用余额", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.approved), fmt(item.actual), fmt(item.occupied), fmt(item.accrual), fmt(item.remaining), fmt(item.available), badge(item.status, toneFor(item.status))] },
      travel: { headers: ["费用事项", "2025 实际", "2026 初始申报", "变动", "同比", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.actual2025), fmt(item.application2026), fmt(item.delta), `${fmt(item.rate)}%`, badge(item.status, toneFor(item.status))] },
      accrual: { headers: ["项目", "预估计提", "结算金额", "差异", "差异率", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.estimated), fmt(item.settled), fmt(item.delta), `${fmt(item.rate)}%`, badge(item.status, toneFor(item.status))] },
      concentration: { headers: ["项目", "全年正向采购", "12 月采购", "采购占比", "全年净在途", "12 月净在途", "在途占比", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, fmt(item.annualPr), fmt(item.decemberPr), `${fmt(item.prRate)}%`, fmt(item.annualTransit), fmt(item.decemberTransit), `${fmt(item.transitRate)}%`, badge(item.status, toneFor(item.status))] },
      supplier: { headers: ["供应商 / 级别", "部门", "净额", "服务人月", "人月成本", "组内倍率", "判定"], cells: (item) => [`<strong>${esc(item.name)}</strong><small class="cell-note">${esc(item.code)}</small>`, esc(item.department), fmt(item.net), fmt(item.months, 0), `${fmt(item.monthly, 0)} 元`, `${fmt(item.ratio)} 倍`, badge(item.status, toneFor(item.status))] },
    };
    const config = configs[tab];
    return `<div class="table-wrap"><table class="data-table compact"><thead><tr>${config.headers.map((item, index) => `<th class="${index ? "num" : ""}">${esc(item)}</th>`).join("")}</tr></thead><tbody>${rows.map((item) => `<tr>${config.cells(item).map((cell, index) => `<td class="${index ? "num" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function budgetGroupedTable(tab, rows) {
    if (tab === "cost") return `<div class="table-wrap"><table class="data-table"><thead><tr><th>单位 / 板块</th><th class="num">最终批准预算</th><th class="num">实际费用</th><th class="num">执行率</th><th class="num">成本占收比</th><th class="num">预算差异</th><th>判定</th><th></th></tr></thead><tbody>${rows.map((item, index) => `<tr><td><strong>${esc(item.name)}</strong></td><td class="num">${fmt(item.budget)}</td><td class="num">${fmt(item.actual)}</td><td class="num">${fmt(item.execution)}%</td><td class="num">${fmt(item.costToRevenue)}%</td><td class="num">${fmt(item.delta)}</td><td>${badge(item.status, toneFor(item.status))}</td><td><button class="text-btn" type="button" data-action="budget-record-detail" data-tab="cost" data-index="${index}">查看详情</button></td></tr>`).join("")}</tbody></table></div>`;
    const groups = rows.reduce((result, item) => { (result[item.group] ||= []).push(item); return result; }, {});
    return `<div class="group-list">${Object.entries(groups).map(([group, items]) => {
      const open = state.budgetExpanded === `${tab}:${group}`;
      const attention = items.filter((item) => item.status !== "正常").length;
      const summary = tab === "project" ? `${items.length} 个项目 · 可用余额 ${fmt(sum(items, "available"))} 万元` : tab === "travel" ? `${items.length} 项费用 · 申报变动 ${fmt(sum(items, "delta"))} 万元` : tab === "accrual" ? `${items.length} 笔配对 · 差异 ${fmt(items.reduce((total, item) => total + Math.abs(item.delta), 0))} 万元` : tab === "concentration" ? `${items.length} 个项目 · 最高占比 ${fmt(Math.max(max(items, "prRate"), max(items, "transitRate")))}%` : `${items.length} 条记录 · 最高倍率 ${fmt(max(items, "ratio"))} 倍`;
      return `<article class="group-row ${open ? "open" : ""}"><button class="group-summary" type="button" data-action="budget-expand" data-key="${attr(tab)}:${attr(group)}"><span class="expand-icon">${icon(open ? "chevron-down" : "chevron-right", "sm")}</span><span><strong>${esc(group)}</strong><small>${esc(summary)}</small></span>${badge(attention ? `${attention} 项关注` : "状态正常", attention ? "warning" : "success")}</button>${open ? `<div class="group-details">${budgetDetailTable(tab, items)}</div>` : ""}</article>`;
    }).join("")}</div>`;
  }

  function budgetTopicContent(dash, tab) {
    const topic = dash.topics.find((item) => item.id === tab) || dash.topics[0];
    const rows = filteredBudgetRows(dash, topic.id);
    const chart = topic.id === "cost" ? `<section class="grid-main wide">${panel("跨年预算执行", "实际费用 ÷ 当年最终批准费用预算", lineChart(dash.annualTrend, "%", "2025 年执行率"), "", "trend-panel")}${panel("部门执行情况", "按当前批准预算口径", `<div class="compare-bars">${dash.units.map((item) => `<div class="compare-bar-row"><span>${esc(item.name)}</span><div><i style="width:${Math.min(100, item.execution)}%"></i></div><strong>${fmt(item.execution)}%</strong></div>`).join("")}</div>`)}</section>` : "";
    const supervision = topic.id === "cost" ? `<section class="supervision-list">${dash.supervision.map((item) => `<article><div>${icon("clipboard-check", "sm")}<span><strong>${esc(item.title)}</strong><small>${esc(item.owner)} · ${esc(item.basis)}</small></span></div>${badge(item.status, toneFor(item.status))}</article>`).join("")}</section>` : "";
    return `${topic.id === "cost" ? metricsGrid(budgetScopedMetrics(dash), { dashboard: "budget" }) : ""}<section class="topic-intro"><div><span class="topic-icon">${icon(topic.icon, "lg")}</span><div><span class="eyebrow">预算监督专题</span><h2>${esc(topic.label)}</h2><p>${esc(topic.description)}</p></div></div><div class="rule-legend"><span>判定口径</span><strong>${esc(topic.rule)}</strong></div></section><section class="topic-stats">${budgetTopicStats(topic.id, rows)}</section>${chart}${panel(`${topic.label}明细`, "先看汇总，再展开到部门、项目或供应商记录", budgetGroupedTable(topic.id, rows), "", "flush-body")}${supervision}`;
  }

  function renderBudget(tab) {
    const dash = byId("budget");
    const valid = dash.topics.some((item) => item.id === tab) ? tab : "cost";
    shell(`<main class="page dashboard-page budget-page" data-screen-label="预算监督管理驾驶舱">${dashboardHeader(dash, { actions: `<a class="btn" href="../report-center/review-lifecycle/index.html#/report/RPT-S002-BUDGET-20260815-001">${icon("file-text", "sm")}查看预算报告</a><a class="btn primary" href="../report-center/review-lifecycle/index.html#/create?definition=RD-BUDGET-001">${icon("file-plus-2", "sm")}生成新内容版本</a>` })}${infoStrip(dash)}${budgetToolbar(dash)}${tabs(dash.topics, valid, "budget")}<div class="dashboard-content">${budgetTopicContent(dash, valid)}</div></main>`);
  }

  function riskSectors(dash) {
    const groups = dash.companies.reduce((result, item) => {
      const key = riskIndustry(item);
      result[key] ||= { name: key, companies: [], counts: { "绿灯": 0, "黄灯": 0, "红灯": 0, "黑灯": 0 } };
      result[key].companies.push(item);
      result[key].counts[item.riskTier] += 1;
      return result;
    }, {});
    return Object.values(groups).map((item) => ({ ...item, average: item.companies.reduce((sumValue, company) => sumValue + company.finalScore, 0) / item.companies.length }));
  }

  function riskIndustry(item) {
    return item.category === "在建企业" ? "新能源产业-风电" : item.category;
  }

  function riskOperatingStage(item) {
    return item.category === "在建企业" ? "建设阶段" : "运营阶段";
  }

  function riskDonut(dash) {
    const total = dash.thresholds.reduce((totalValue, item) => totalValue + item.count, 0) || 1;
    let angle = 0;
    const stops = dash.thresholds.map((item) => { const start = angle; angle += item.count / total * 360; return `${item.color} ${start}deg ${angle}deg`; }).join(",");
    return `<div class="risk-distribution"><div class="risk-donut" style="background:conic-gradient(${stops})"><div><strong>${total}</strong><span>家企业</span></div></div><div class="risk-legend">${dash.thresholds.map((item) => `<button type="button" data-action="risk-tier-jump" data-tier="${attr(item.name)}"><i style="background:${item.color}"></i><span><strong>${esc(item.name)}</strong><small>${esc(item.range)}</small></span><b>${item.count} 家</b></button>`).join("")}</div></div>`;
  }

  function sectorCards(dash) {
    const colors = { "绿灯": "#16806a", "黄灯": "#d39a2c", "红灯": "#c84a43", "黑灯": "#344256" };
    return `<div class="sector-grid">${riskSectors(dash).map((sector) => `<button class="sector-card" type="button" data-action="risk-sector-detail" data-sector="${attr(sector.name)}"><header><span><strong>${esc(sector.name)}</strong><small>${sector.companies.length} 家企业</small></span><b>${fmt(sector.average, 2)} 分均值</b></header><div class="sector-bars">${["绿灯", "黄灯", "红灯", "黑灯"].map((tier) => `<i style="width:${Math.max(sector.counts[tier] ? 3 : 0, sector.counts[tier] / sector.companies.length * 100)}%;background:${colors[tier]}" title="${tier} ${sector.counts[tier]} 家"></i>`).join("")}</div><footer><span>绿 ${sector.counts["绿灯"]}</span><span>黄 ${sector.counts["黄灯"]}</span><span>红 ${sector.counts["红灯"]}</span><span>黑 ${sector.counts["黑灯"]}</span><strong>查看构成 ${icon("chevron-right", "sm")}</strong></footer></button>`).join("")}</div>`;
  }

  function filteredRiskCompanies(dash) {
    const search = state.riskSearch.trim().toLowerCase();
    const list = dash.companies.filter((item) => {
      if (state.riskTier !== "全部" && item.riskTier !== state.riskTier) return false;
      if (state.riskSector !== "全部产业" && riskIndustry(item) !== state.riskSector) return false;
      if (search && !`${item.enterpriseName} ${item.enterpriseId} ${item.category} ${item.focus}`.toLowerCase().includes(search)) return false;
      return true;
    });
    return list.sort((left, right) => state.riskSort === "score-desc" ? right.finalScore - left.finalScore : state.riskSort === "name" ? left.enterpriseName.localeCompare(right.enterpriseName, "zh-CN") : left.finalScore - right.finalScore);
  }

  function riskReportHref(item) {
    return `../report-center/review-lifecycle/index.html?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=S003-RUN-20260817163000000-c02200000001&formedAt=2026-08-17T16:30:00.000Z&status=active#/reports/view?reportId=${encodeURIComponent(item.reportId || item.enterpriseId)}`;
  }

  function riskTable(rows, limit = 0) {
    const visible = limit ? rows.slice(0, limit) : rows;
    return `<div class="table-wrap"><table class="data-table risk-table"><thead><tr><th>企业</th><th>产业 / 经营阶段</th><th>重点关注</th><th class="num">综合评分</th><th>风险等级</th><th>报告</th></tr></thead><tbody>${visible.map((item) => `<tr><td><strong>${esc(item.enterpriseName)}</strong><small class="cell-note">${esc(item.enterpriseId)}</small></td><td><strong>${esc(riskIndustry(item))}</strong><small class="cell-note">${esc(riskOperatingStage(item))}</small></td><td>${esc(item.focus)}</td><td class="num"><strong class="risk-score ${toneFor(item.riskTier)}">${fmt(item.finalScore, 2)}</strong></td><td>${badge(item.riskTier, toneFor(item.riskTier))}</td><td><a class="text-btn" href="${attr(riskReportHref(item))}">查看报告</a></td></tr>`).join("")}</tbody></table></div>`;
  }

  function riskOverview(dash) {
    const topRisk = [...dash.companies].sort((left, right) => left.finalScore - right.finalScore).slice(0, 5);
    return `<section class="risk-hero"><div><span class="eyebrow">集团债务风险监测</span><h2>风险结果可解释、可穿透</h2><p>覆盖 ${dash.companies.length} 家企业，全部评分、分档、企业报告和处置状态来自同一正式评估轮次。</p><div class="hero-meta"><span>${icon("calendar-check", "sm")}评估时点 ${esc(displayAsOf(dash.period))}</span><span>${icon("shield-check", "sm")}数据质量通过</span><span>${icon("file-check-2", "sm")}21 份企业报告</span></div></div><div class="hero-score"><span>本轮评估</span><strong>已完成</strong><small>${esc(dash.updatedAt)}</small></div></section>${metricsGrid(dash.metrics, { dashboard: "risk" })}<section class="grid-main risk-overview-grid">${panel("四档风险分布", "当前正式评分结果", riskDonut(dash))}${panel("产业板块监测", "在建状态单独按经营阶段分析，不作为产业板块", sectorCards(dash), `<a class="text-btn" href="${dashboardHref("risk", "analysis")}">产业与薄弱项 ${icon("chevron-right", "sm")}</a>`)}</section><section class="grid-main">${panel("需要优先关注", "按综合评分从低到高排序", `<div class="risk-list">${topRisk.map((item) => `<article><span>${badge(item.riskTier, toneFor(item.riskTier))}</span><div><strong>${esc(item.enterpriseName)}</strong><small>${esc(riskIndustry(item))} · ${esc(item.focus)}</small></div><b>${fmt(item.finalScore, 2)}<small>综合分</small></b><a class="icon-btn" href="${attr(riskReportHref(item))}" aria-label="查看${attr(item.enterpriseName)}报告">${icon("chevron-right", "sm")}</a></article>`).join("")}</div>`, `<a class="text-btn" href="${dashboardHref("risk", "analysis")}">查看风险分布 ${icon("chevron-right", "sm")}</a>`, "flush-body")}${panel("风险触发与行动", "五条亮灯预警逐项核对后提交决策中心", `<div class="risk-action-list">${dash.actions.map((item) => `<article><div><strong>${esc(item.enterprise)}</strong><small>${esc(item.focus)} · ${esc(item.recipient)}</small></div><span><b>${fmt(item.score, 2)}</b>${badge(riskActionStageMeta(riskActionRecord(item)).label, riskActionStageMeta(riskActionRecord(item)).tone)}</span></article>`).join("")}</div>`, `<a class="text-btn" href="${dashboardHref("risk", "actions")}">进入风险处置 ${icon("chevron-right", "sm")}</a>`, "flush-body")}</section>${panel("企业评分明细", `全部 ${dash.companies.length} 家企业`, riskTable([...dash.companies].sort((left, right) => left.finalScore - right.finalScore), 8), `<a class="text-btn" href="${dashboardHref("risk", "analysis")}">查看产业分析 ${icon("chevron-right", "sm")}</a>`, "flush-body")}`;
  }

  function riskStageSummary(dash) {
    const stages = ["运营阶段", "建设阶段"].map((name) => {
      const companies = dash.companies.filter((item) => riskOperatingStage(item) === name);
      return {
        name,
        companies,
        alertCount: companies.filter((item) => item.riskTier !== "绿灯").length,
        average: companies.reduce((sum, item) => sum + item.finalScore, 0) / Math.max(companies.length, 1),
      };
    });
    return `<div class="stage-topic-grid">${stages.map((stage) => `<article class="stage-topic-card"><span class="stage-icon">${icon(stage.name === "建设阶段" ? "hard-hat" : "factory", "lg")}</span><div><strong>${esc(stage.name)}</strong><p>${stage.name === "建设阶段" ? "3 家在建企业作为经营阶段专题观察，产业归属仍为新能源产业-风电。" : "按正式经营企业口径观察财务指标、调节因子与风险分档。"}</p></div><dl><div><dt>企业</dt><dd>${stage.companies.length} 家</dd></div><div><dt>平均分</dt><dd>${fmt(stage.average, 2)}</dd></div><div><dt>需处置</dt><dd>${stage.alertCount} 家</dd></div></dl></article>`).join("")}</div>`;
  }

  function riskAnalysis(dash) {
    const weak = Object.entries(dash.companies.reduce((map, item) => { map[item.focus] = (map[item.focus] || 0) + 1; return map; }, {})).sort((a, b) => b[1] - a[1]);
    return `<section class="panel analysis-sector-panel"><div class="panel-head"><div><h2>产业板块监测</h2><p>仅按真实产业归属汇总；建设状态不再单列为产业。</p></div>${badge("3 个产业板块", "plain")}</div><div class="panel-body">${sectorCards(dash)}</div></section><section class="analysis-insight-grid">${panel("经营阶段专题", "在建与运营是经营阶段，不是产业分类", riskStageSummary(dash), "", "stage-topic-panel")}${panel("薄弱项分布", "当前正式结果中出现频次最高的重点关注指标", `<div class="weak-item-list">${weak.slice(0, 8).map(([name, count], index) => `<article><span class="weak-rank">${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(name)}</strong><small>${count} 家企业列为重点关注</small></div><b>${count} 家</b></article>`).join("")}</div>`, "", "weak-topic-panel")}</section>`;
  }

  const RISK_CONTEXT = Object.freeze({
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
    formedAt: "2026-08-17T16:30:00.000Z",
    status: "active",
  });
  const C011_LEGACY_KEY = "ontology3.decision-center.c011.inbox.v1";
  const C011_LOGICAL_KEY = "decision-center.c011.inbox.v3";

  function riskActionRecord(item) {
    const current = state.riskActionStates[item.enterpriseId];
    if (current) return current;
    if (item.decisionStatus === "已形成负责人待办") return { stage: "handled", evidenceViewed: true, confirmedAt: "", submittedAt: "2026-08-17 16:36:00", requestId: riskActionRequestId(item), error: "", attempts: 1 };
    if (item.decisionStatus === "待接口人确认") return { stage: "submitted", evidenceViewed: true, confirmedAt: "", submittedAt: "2026-08-17 16:36:00", requestId: riskActionRequestId(item), error: "", attempts: 1 };
    return { stage: "pending", evidenceViewed: false, confirmedAt: "", submittedAt: "", requestId: "", error: "", attempts: 0 };
  }

  function setRiskActionRecord(item, patch) {
    state.riskActionStates = {
      ...state.riskActionStates,
      [item.enterpriseId]: { ...riskActionRecord(item), ...patch },
    };
    persist();
  }

  function riskActionStageMeta(record) {
    return {
      pending: { label: "待确认", tone: "plain", icon: "circle-dashed" },
      confirmed: { label: "已确认待提交", tone: "warning", icon: "badge-check" },
      submitting: { label: "提交中", tone: "warning", icon: "loader-circle" },
      submitted: { label: "已提交", tone: "success", icon: "circle-check" },
      handled: { label: "已形成待办", tone: "success", icon: "circle-check" },
      failed: { label: "提交失败", tone: "danger", icon: "circle-alert" },
    }[record.stage] || { label: "待确认", tone: "plain", icon: "circle-dashed" };
  }

  function riskActionRequestId(item) {
    return `AR-S003-CAND-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}-${item.actionTypeId}-2025-12-31-1.1.0`;
  }

  function buildRiskActionRequest(item, now = new Date()) {
    const iso = now.toISOString();
    const displayTime = localDateTime(now);
    const requestId = riskActionRequestId(item);
    const snapshotId = `S003-C035-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}`;
    return {
      schemaVersion: "ofw.s003.c011.action-request.v2",
      id: requestId,
      requestId,
      candidateId: requestId.replace(/^AR-/, ""),
      sourceCandidateId: requestId.replace(/^AR-/, ""),
      scenarioContext: clone(RISK_CONTEXT),
      scenarioIdentity: clone(RISK_CONTEXT),
      scenario: "债务风险监测",
      sourceType: "report",
      sourceRef: `债务风险驾驶舱 · ${snapshotId}`,
      requester: "集团债务风险管理人员",
      submittedBy: "集团债务风险管理人员",
      requestTime: displayTime,
      generatedTime: displayTime,
      subjectId: item.enterpriseId,
      subjectName: item.enterprise,
      singleBusinessSubjectId: item.enterpriseId,
      singleBusinessSubjectName: item.enterprise,
      actionType: {
        id: item.actionTypeId,
        name: item.actionTypeName,
        description: `${item.tier}企业按当前亮灯形成一条风险行动申请，由成员单位接口人确认后再分办。`,
        version: item.actionTypeVersion,
        status: "已发布",
      },
      rule: null,
      ruleApplicability: `不适用；本次为驾驶舱人工确认后提交的${item.tier}风险行动`,
      metric: {
        id: "MET-S003-FINAL-RISK-SCORE",
        name: "企业最终风险评分",
        value: `${fmt(item.score, 2)} 分`,
        explanation: item.basis,
        evaluatedAt: "2025-12-31",
        scope: `${item.enterprise} · ${item.category}`,
      },
      owner: null,
      ownerId: null,
      recommendedTaskOwner: item.recommendedOwner,
      recommendation: item.recommendation,
      decisionRecipient: {
        enterpriseId: item.enterpriseId,
        memberUnitId: item.memberUnitId,
        memberUnitName: item.enterprise,
        recipientId: item.recipientId,
        recipientName: item.recipient,
        role: "成员单位债务风险接口人",
      },
      routingTarget: { type: "member-unit-decision-center", organizationId: item.memberUnitId, organizationName: item.enterprise },
      recipientRole: "成员单位债务风险接口人",
      evidence: {
        semanticVersion: `S003-M01-DEBT-RISK-PKG ${initialRiskConfig.publishedVersion}`,
        dataVersion: "S003-T007-DEBT-RISK-20251231-v1",
        dataAssetId: "S003-T007-DEBT-RISK-20251231-v1",
        resultVersion: "1.1.0",
        cutoff: "2025-12-31",
        quality: "允许推进",
        availability: "完整可用",
        ready: "C017 接收安全门待决策中心重读",
        snapshotId,
        freshness: "固定运行证据",
        reportId: `S003-RPT-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}`,
        reportRoute: `#/reports/view?enterpriseId=${encodeURIComponent(item.enterpriseId)}&runId=${encodeURIComponent(RISK_CONTEXT.scenarioRunId)}`,
      },
      sourceEvents: [{ type: "驾驶舱人工提交", time: displayTime, reason: "集团债务风险管理人员逐户核对固定证据后提交标准 Action Request" }],
      automatic: false,
      clientWorkspaceVersion: "ofw.dashboard.workspace.v7",
      actionRequestImmutable: false,
      taskId: null,
      decision: null,
      idempotencyKey: `${RISK_CONTEXT.scenarioRunId}|${item.enterpriseId}|${item.actionTypeId}|2025-12-31|1.1.0`,
      submittedAt: iso,
    };
  }

  function parseStoredJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (_) { return null; }
  }

  function writeRiskActionRequest(request) {
    const physicalKey = `ofw:v1.1.0:${RISK_CONTEXT.scenarioId}:${RISK_CONTEXT.scenarioVersion}:${RISK_CONTEXT.scenarioRunId}:m04:${encodeURIComponent(C011_LOGICAL_KEY)}`;
    const existingEnvelope = parseStoredJson(physicalKey);
    const currentPayload = existingEnvelope?.payload?.contractCode === "C011" ? existingEnvelope.payload : null;
    const requests = new Map((currentPayload?.requests || []).map((item) => [item.id || item.requestId, item]));
    requests.set(request.id, request);
    const payload = {
      schemaVersion: "ofw.s003.c011.dashboard-inbox.v2",
      contractCode: "C011",
      sourceModule: "报告中心仪表盘",
      consumer: "决策中心",
      scenarioContext: clone(RISK_CONTEXT),
      formedAt: request.submittedAt,
      requests: [...requests.values()],
    };
    localStorage.setItem(physicalKey, JSON.stringify({ schemaVersion: "ofw.namespaced-storage.v1", scenarioContext: clone(RISK_CONTEXT), savedAt: request.submittedAt, payload }));
    return request.id;
  }

  async function submitRiskAction(item) {
    const current = riskActionRecord(item);
    if (current.stage === "submitting") return;
    if (current.stage === "submitted") return toast("该风险已按同一行动申请标识提交，未重复创建");
    if (current.stage !== "confirmed" && current.stage !== "failed") return toast("请先查看依据并确认风险");
    setRiskActionRecord(item, { stage: "submitting", error: "", attempts: Number(current.attempts || 0) + 1 });
    render();
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 720));
      const request = buildRiskActionRequest(item);
      const requestId = writeRiskActionRequest(request);
      setRiskActionRecord(item, { stage: "submitted", requestId, submittedAt: localDateTime(), error: "" });
      render(); toast(`${item.enterprise}的行动申请已提交，等待决策中心人工确认`);
    } catch (error) {
      setRiskActionRecord(item, { stage: "failed", error: error?.message || "行动申请未送达，确认结果和固定证据均已保留" });
      render(); toast("行动申请未送达，可重新提交");
    }
  }

  function riskActionCard(item) {
    const record = riskActionRecord(item);
    const stage = riskActionStageMeta(record);
    const submitted = record.stage === "submitted";
    const failed = record.stage === "failed";
    return `<article class="risk-candidate-card ${attr(record.stage)}" data-enterprise-id="${attr(item.enterpriseId)}">
      <header class="risk-candidate-heading"><div class="risk-candidate-score">${badge(item.tier, toneFor(item.tier))}<strong>${fmt(item.score, 2)}</strong><span>综合分</span></div><div><h3>${esc(item.enterprise)}</h3><p>${esc(riskIndustry(item))} · ${esc(item.enterpriseId)}</p></div>${badge(stage.label, stage.tone)}</header>
      <div class="risk-candidate-main"><section class="risk-disposal-reason"><span class="candidate-label">为何需要处置</span><strong>${esc(item.focus)}</strong><p>${esc(item.basis)}</p></section><section class="risk-disposal-plan"><span class="candidate-label">建议处置安排</span><p>${esc(item.recommendation)}</p></section><div class="candidate-facts"><span><b>行动类型</b>${esc(item.actionTypeName)}</span><span><b>接收接口人</b>${esc(item.recipient)}</span><span><b>建议负责人</b>${esc(item.recommendedOwner)}</span><span><b>决策进展</b>${esc(item.decisionStatus)}</span></div>${record.error ? `<div class="inline-failure">${icon("circle-alert", "sm")}<span>${esc(record.error)}</span></div>` : ""}${submitted ? `<div class="inline-success">${icon("circle-check", "sm")}<span>行动申请已进入决策中心收件，等待接口人复核；尚未形成负责人待办。</span></div>` : ""}</div>
      <div class="risk-candidate-actions"><button class="btn" type="button" data-action="risk-action-evidence" data-enterprise-id="${attr(item.enterpriseId)}">${icon("file-search", "sm")}查看处置依据</button>${record.stage === "pending" ? `<button class="btn primary" type="button" data-action="risk-action-confirm" data-enterprise-id="${attr(item.enterpriseId)}" ${record.evidenceViewed ? "" : "disabled"}>${icon("badge-check", "sm")}确认需要处置</button>` : record.stage === "confirmed" ? `<button class="btn" type="button" data-action="risk-action-unconfirm" data-enterprise-id="${attr(item.enterpriseId)}">${icon("undo-2", "sm")}撤销确认</button><button class="btn primary" type="button" data-action="risk-action-submit" data-enterprise-id="${attr(item.enterpriseId)}">${icon("send", "sm")}发起处置行动</button>` : record.stage === "submitting" ? `<button class="btn primary" type="button" disabled>${icon("loader-circle", "sm")}正在提交</button>` : failed ? `<button class="btn primary" type="button" data-action="risk-action-submit" data-enterprise-id="${attr(item.enterpriseId)}">${icon("refresh-cw", "sm")}重新提交</button>` : `<a class="btn primary" href="../decision-center-prototype/index.html#/operations/intake">${icon("external-link", "sm")}查看决策进展</a>`}<small>${record.stage === "pending" && !record.evidenceViewed ? "核对评分、数据版本与处置建议后方可确认" : record.stage === "handled" ? "负责人待办及后续状态由决策中心维护" : submitted ? "重复提交会沿用同一行动申请，不会新增待办" : "确认只针对本条预警，不影响其他企业"}</small></div>
    </article>`;
  }

  function riskActions(dash) {
    const counts = dash.actions.reduce((result, item) => {
      const stage = riskActionRecord(item).stage;
      result[stage] = (result[stage] || 0) + 1;
      return result;
    }, {});
    return `<section class="risk-action-workspace"><header class="risk-action-summary"><div><span class="eyebrow">风险处置工作区</span><h2>风险处置行动</h2><p>这里只呈现五条已触发预警、需要人工判断的事项，不混入正常企业明细。</p></div><div class="action-summary-counts"><span><b>${dash.actions.length}</b>预警事项</span><span><b>${counts.pending || 0}</b>待确认</span><span><b>${counts.confirmed || 0}</b>待发起</span><span><b>${(counts.submitted || 0) + (counts.handled || 0)}</b>已送达</span></div></header><div class="disposal-guidance"><span>${icon("route", "sm")}</span><div><strong>每条事项按同一顺序处理</strong><p>查看处置依据 → 确认需要处置 → 发起标准行动申请 → 到决策中心跟踪确认与负责人待办。</p></div></div><div class="risk-candidate-list">${dash.actions.map(riskActionCard).join("")}</div><footer class="risk-action-boundary">${icon("shield-check", "sm")}发起成功只表示行动申请已送达决策中心；接口人确认后才可形成负责人待办，本页不直接执行处置。</footer></section>`;
  }

  function modelDraft() { return state.riskModelDraft; }

  function modelHasChanges() {
    return JSON.stringify(modelDraft()) !== JSON.stringify(state.riskPublishedConfig);
  }

  function syncModelEditControls() {
    const bar = document.querySelector(".model-action-bar");
    if (!bar) return;
    const changed = modelHasChanges();
    const candidateVersion = nextPatchVersion(state.riskModelPublishedVersion);
    const title = bar.querySelector(":scope > div > strong");
    const copy = bar.querySelector(":scope > div > span");
    if (title) title.textContent = changed ? `准备形成模型 ${candidateVersion}` : "当前配置未修改";
    if (copy) copy.textContent = changed ? "提交后将自动校验、发布并创建新的隔离评估。" : "修改任一参数后即可提交新的模型评估轮次。";
    bar.querySelectorAll('[data-action="risk-model-save"], [data-action="risk-model-reset"], [data-action="risk-model-apply-run"]').forEach((button) => {
      button.disabled = !changed || state.riskModelStatus === "publishing";
    });
  }

  function modelWeightTotal(category) {
    return (modelDraft().weights[category] || []).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function validateRiskModelDraft() {
    const draft = modelDraft();
    const errors = [];
    Object.entries(draft.weights || {}).forEach(([category, weights]) => {
      weights.forEach((value, index) => {
        if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) errors.push(`${category}的“${initialRiskConfig.indicators[index]}”权重必须在 0—100 之间`);
      });
      const total = weights.reduce((sum, value) => sum + Number(value || 0), 0);
      if (Math.abs(total - 100) > 0.001) errors.push(`${category}权重合计为 ${fmt(total, 2)}%，必须等于 100%`);
    });
    (draft.factors || []).forEach((factor) => (factor.tiers || []).forEach((tier) => {
      const value = Number(tier.coefficient);
      if (!Number.isFinite(value) || value < -1 || value > 1) errors.push(`${factor.name}的“${tier.label}”系数必须在 -1—1 之间`);
    }));
    const tiers = draft.tiers || [];
    tiers.forEach((tier) => {
      const value = Number(tier.minInclusive);
      if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${tier.name}分数下限必须在 0—100 之间`);
    });
    if (Number(tiers.find((item) => item.tierId === "BLACK")?.minInclusive) !== 0) errors.push("黑灯分数下限必须固定为 0");
    for (let index = 1; index < tiers.length; index += 1) {
      if (Number(tiers[index - 1].minInclusive) <= Number(tiers[index].minInclusive)) errors.push(`${tiers[index - 1].name}与${tiers[index].name}阈值顺序不连续`);
    }
    return { ok: errors.length === 0, errors, checkedAt: localDateTime() };
  }

  function nextPatchVersion(value) {
    const parts = String(value || "1.0.0").split(".").map(Number);
    while (parts.length < 3) parts.push(0);
    parts[2] = (Number.isFinite(parts[2]) ? parts[2] : 0) + 1;
    return parts.slice(0, 3).join(".");
  }

  function tierRangeLabel(tiers, index) {
    const tier = tiers[index];
    const min = Number(tier.minInclusive);
    return index === 0 ? `≥ ${min} 分` : `${min} ≤ 分值 < ${Number(tiers[index - 1].minInclusive)} 分`;
  }

  function modelStatusMeta() {
    if (state.riskModelStatus === "publishing") return { label: "发布中", tone: "warning" };
    if (state.riskModelStatus === "validated") return { label: "检查通过，待发布", tone: "warning" };
    if (state.riskModelStatus === "draft" || state.riskModelStatus === "saved") return { label: state.riskModelStatus === "saved" ? "修改已暂存" : "存在未发布修改", tone: "warning" };
    if (state.riskModelStatus === "invalid") return { label: "校验未通过", tone: "danger" };
    return { label: "当前生效版本", tone: "success" };
  }

  function riskModelConfig(dash) {
    const config = dash.modelConfig;
    const draft = modelDraft();
    const section = config.sections.find((item) => item.id === state.riskModelSection) || config.sections[0];
    const status = modelStatusMeta();
    const candidateVersion = nextPatchVersion(state.riskModelPublishedVersion);
    const sectionTabs = config.sections.map((item) => `<button class="model-section-tab ${item.id === section.id ? "active" : ""}" type="button" data-action="risk-model-section" data-section="${attr(item.id)}">${icon(item.id === "weights" ? "scale" : item.id === "factors" ? "sliders-horizontal" : item.id === "tiers" ? "layers-3" : "file-check-2", "sm")}${esc(item.label)}</button>`).join("");
    let body = "";
    if (section.id === "overview") {
      const nextVersion = nextPatchVersion(state.riskModelPublishedVersion);
      body = `<section class="model-current-combination"><div><span class="eyebrow">当前正式评估组合</span><h3>模型 ${esc(state.riskModelPublishedVersion)} × 数据截至 2025-12-31</h3><p>最近正式评估覆盖 21 家企业。没有数据或模型变化时，无需重复运行。</p></div><dl><div><dt>模型生命周期</dt><dd>${esc(config.owner)}维护</dd></div><div><dt>业务参数</dt><dd>${esc(config.businessOwner)}维护</dd></div><div><dt>权威指针</dt><dd>${esc(config.pointerId)}</dd></div><div><dt>最近回执</dt><dd>${esc(state.riskModelPublishReceipt || "当前版本已生效")}</dd></div></dl></section><section class="rerun-path-grid"><article class="rerun-path-card data-path"><header><span class="path-number">01</span><div><strong>数据更新后重评</strong><p>模型不变，仅在新的正式数据资产或人工输入快照就绪后启动。</p></div>${badge("当前无新数据", "plain")}</header><div class="path-combination"><span>${icon("database", "sm")}当前数据 S003-T007-DEBT-RISK-20251231-v1</span><span>${icon("boxes", "sm")}当前模型 ${esc(state.riskModelPublishedVersion)}</span></div><footer><p>${state.riskDataCheckedAt ? `最近检查 ${esc(state.riskDataCheckedAt)}，未发现晚于当前评估时点的正式数据。` : "系统会先检查新的正式数据版本；版本未变化时不会产生重复评估。"}</p><button class="btn" type="button" data-action="risk-data-check">${icon("refresh-cw", "sm")}检查最新数据</button></footer></article><article class="rerun-path-card model-path"><header><span class="path-number">02</span><div><strong>模型调整后重评</strong><p>调整权重、因子或分档后，一次完成检查、发布和新一轮评估。</p></div>${badge(modelHasChanges() ? "有待发布修改" : `下一版本 ${nextVersion}`, modelHasChanges() ? "warning" : "plain")}</header><ol class="path-steps"><li><span>1</span>调整业务参数</li><li><span>2</span>系统校验并由本体管理发布</li><li><span>3</span>锁定新版本启动重评</li></ol><footer><p>原有模型版本、历史运行和报告保持只读，不会被覆盖。</p><button class="btn primary" type="button" data-action="risk-model-section" data-section="weights">${icon("sliders-horizontal", "sm")}${modelHasChanges() ? "继续调整" : "调整模型配置"}</button></footer></article></section><div class="model-owner-note">${icon("shield-check", "sm")}本页是模型配置的业务操作入口；权威版本、发布校验和生命周期仍由本体管理服务唯一维护。</div>`;
    } else if (section.id === "weights") {
      const categories = Object.keys(draft.weights || {});
      body = `<div class="model-section-copy"><strong>${esc(section.description)}</strong><span>固定十五项指标；每类权重合计必须为 100%。</span></div><div class="table-wrap"><table class="data-table model-table editable-model-table"><thead><tr><th>指标</th>${categories.map((category) => `<th class="num">${esc(category)}</th>`).join("")}</tr></thead><tbody>${config.indicators.map((metric, index) => `<tr><td><strong>${esc(metric)}</strong></td>${categories.map((category) => `<td class="num"><label class="model-number-input"><input type="number" min="0" max="100" step="1" value="${attr(draft.weights[category][index])}" data-model-weight="${attr(category)}" data-model-index="${index}"><span>%</span></label></td>`).join("")}</tr>`).join("")}<tr class="total-row"><td><strong>权重合计</strong></td>${categories.map((category) => { const total = modelWeightTotal(category); return `<td class="num"><strong class="${Math.abs(total - 100) < .001 ? "text-success" : "text-danger"}">${fmt(total, 0)}%</strong></td>`; }).join("")}</tr></tbody></table></div>`;
    } else if (section.id === "factors") {
      body = `<div class="model-section-copy"><strong>${esc(section.description)}</strong><span>固定六项因子和分档，只允许调整已确认档位系数。</span></div><div class="model-factor-grid editable">${draft.factors.map((factor, factorIndex) => `<article class="model-factor-card"><header><span class="factor-index">F${String(factorIndex + 1).padStart(2, "0")}</span><div><strong>${esc(factor.name)}</strong><small>适用：${esc(factor.range)}</small></div></header><div class="factor-tier-editor">${factor.tiers.map((tier) => `<label><span><strong>${esc(tier.label)}</strong><small>${esc(tier.tierId)}</small></span><span class="model-number-input coefficient"><input type="number" min="-1" max="1" step="0.01" value="${attr(tier.coefficient)}" data-model-factor="${attr(factor.factorId)}" data-model-tier="${attr(tier.tierId)}"><em>${Number(tier.coefficient) > 0 ? "加分" : Number(tier.coefficient) < 0 ? "减分" : "中性"}</em></span></label>`).join("")}</div><footer><span>适用缺失：缺失套零档</span><span>业务不适用：不参与计算</span></footer></article>`).join("")}</div>`;
    } else {
      body = `<div class="model-section-copy"><strong>${esc(section.description)}</strong><span>固定绿、黄、红、黑四档；阈值必须连续且不重叠。</span></div><div class="tier-grid editable">${draft.tiers.map((tier, index) => `<article class="tier-card ${attr(tier.tone)}"><span>${esc(tier.name)}</span><label class="model-threshold-input"><input type="number" min="0" max="100" step="1" value="${attr(tier.minInclusive)}" data-model-risk-tier="${attr(tier.tierId)}" ${tier.tierId === "BLACK" ? "disabled" : ""}><em>分起</em></label><strong>${esc(tierRangeLabel(draft.tiers, index))}</strong><small>综合分按连续区间唯一归档</small></article>`).join("")}</div><div class="model-semantics">${config.semantics.map((item) => `<span>${icon("check", "sm")}${esc(item.replace("DEFAULTED_ZERO", "缺失套零档").replace("NOT_APPLICABLE", "业务不适用"))}</span>`).join("")}</div>`;
    }
    const validation = state.riskModelValidation;
    const changed = modelHasChanges();
    const persistentActions = section.id === "overview" ? "" : `<div class="model-action-bar"><div><strong>${changed ? `准备形成模型 ${esc(candidateVersion)}` : "当前配置未修改"}</strong><span>${changed ? "提交后将自动校验、发布并创建新的隔离评估。" : "修改任一参数后即可提交新的模型评估轮次。"}</span></div><div class="model-actions persistent"><button class="btn" type="button" data-action="risk-model-save" ${!changed || state.riskModelStatus === "publishing" ? "disabled" : ""}>${icon("save", "sm")}暂存修改</button><button class="btn ghost" type="button" data-action="risk-model-reset" ${!changed || state.riskModelStatus === "publishing" ? "disabled" : ""}>${icon("undo-2", "sm")}放弃修改</button><button class="btn primary" type="button" data-action="risk-model-apply-run" ${!changed || state.riskModelStatus === "publishing" ? "disabled" : ""}>${icon(state.riskModelStatus === "publishing" ? "loader-circle" : "play", "sm")}${state.riskModelStatus === "publishing" ? "正在发布" : "校验、发布并重评"}</button></div></div>`;
    return `<section class="model-config-panel"><div class="model-config-head"><div><span class="eyebrow">债务风险评估</span><h2>模型配置与重评</h2><p>${esc(section.description)}</p></div>${badge(status.label, status.tone)}</div><nav class="model-section-tabs" aria-label="风险模型配置分区">${sectionTabs}</nav><div class="model-config-body">${body}${validation ? `<div class="model-validation ${validation.ok ? "success" : "danger"}">${icon(validation.ok ? "circle-check" : "circle-alert", "sm")}<div><strong>${validation.ok ? "参数检查通过，正在进入发布流程" : `发现 ${validation.errors.length} 项配置问题`}</strong><p>${validation.ok ? `已检查权重合计、因子系数、阈值顺序和固定语义。${validation.checkedAt}` : esc(validation.errors.slice(0, 4).join("；"))}</p></div></div>` : ""}${state.riskModelPublishError ? `<div class="model-validation danger">${icon("circle-alert", "sm")}<div><strong>发布没有完成</strong><p>${esc(state.riskModelPublishError)}</p></div></div>` : ""}${persistentActions}</div></section>`;
  }

  function riskRunResultSummary(dash) {
    const counts = dash.companies.reduce((result, company) => {
      const tiers = state.riskPublishedConfig?.tiers || dash.modelConfig.tiers;
      const sorted = [...tiers].sort((a, b) => Number(b.minInclusive) - Number(a.minInclusive));
      const tier = sorted.find((item) => company.finalScore >= Number(item.minInclusive)) || sorted.at(-1);
      result[tier.tierId] = (result[tier.tierId] || 0) + 1;
      return result;
    }, { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 });
    return { counts, text: `21 家 · 绿 ${counts.GREEN} / 黄 ${counts.YELLOW} / 红 ${counts.RED} / 黑 ${counts.BLACK}` };
  }

  function riskRuns(dash) {
    const history = [...dash.runHistory];
    const modelVersion = state.riskModelPublishedVersion || dash.modelConfig.publishedVersion;
    if (state.riskRerunRunId) history.unshift({ runId: state.riskRerunRunId, status: state.riskRerunState === "running" ? "评估中" : state.riskRerunState === "failed" ? "运行失败" : "隔离评估完成", model: modelVersion, data: "S003-T007-DEBT-RISK-20251231-v1", result: state.riskRerunState === "running" ? "正在计算 21 家企业" : state.riskRerunState === "failed" ? state.riskRerunError : state.riskRerunResult?.text || "21 家结果已形成", at: state.riskRerunAt });
    const running = state.riskRerunState === "running";
    const failed = state.riskRerunState === "failed";
    return `<section class="run-history-section">${running ? `<article class="run-progress live-run"><span class="mini-spinner"></span><div><strong>正在执行新一轮确定性评估</strong><p>已锁定模型 ${esc(modelVersion)}、正式数据资产和人工输入快照；正在依次形成评分、分档与运行回执。</p><div class="run-stage-list"><span class="active">锁定输入</span><span class="active">评估企业</span><span>汇总结果</span><span>保存回执</span></div><div class="progress-bar"><i></i></div></div></article>` : failed ? `<article class="run-recovery"><span>${icon("circle-alert", "lg")}</span><div><strong>最近一次重评未完成</strong><p>${esc(state.riskRerunError)}。已锁定输入和上一正式结果均保留，可按原组合恢复。</p></div><button class="btn primary" type="button" data-action="risk-rerun">${icon("rotate-ccw", "sm")}按原组合重试</button></article>` : state.riskRerunRunId && state.riskRerunState === "complete" ? `<article class="run-result-note">${icon("shield-check", "sm")}新轮次 ${esc(state.riskRerunRunId)} 已完成，绑定模型 ${esc(modelVersion)}。结果独立保存，原正式轮次和历史行动状态未覆盖。</article>` : ""}<article class="panel run-history-panel"><div class="panel-head"><div><span class="eyebrow">不可变运行记录</span><h2>评估运行历史</h2><p>新评估只能由“新数据就绪”或“模型调整发布”触发。</p></div><span class="panel-note">历史轮次只读</span></div><div class="table-wrap"><table class="data-table run-table"><thead><tr><th>运行标识</th><th>状态</th><th>触发原因</th><th>模型</th><th>数据资产</th><th>结果</th><th>形成时间</th></tr></thead><tbody>${history.map((item, index) => `<tr><td><code>${esc(item.runId)}</code></td><td>${badge(item.status, item.status === "正式评估" || item.status === "上一正式运行" || item.status === "隔离评估完成" ? "success" : item.status === "运行失败" ? "danger" : "warning")}</td><td>${index === 0 && state.riskRerunRunId ? "模型调整后重评" : item.status === "正式评估" ? "年度正式数据就绪" : "历史评估归档"}</td><td>${esc(item.model)}</td><td>${esc(item.data)}</td><td>${esc(item.result)}</td><td>${esc(item.at)}</td></tr>`).join("")}</tbody></table></div></article></section>`;
  }

  async function publishRiskModel(startRun = false) {
    const validation = validateRiskModelDraft();
    state.riskModelValidation = validation;
    if (!validation.ok) {
      state.riskModelStatus = "invalid";
      persist(); render(); toast("配置校验未通过，请先修正问题"); return;
    }
    state.riskModelStatus = "publishing";
    state.riskModelPublishError = "";
    persist(); render();
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const now = new Date();
      const version = nextPatchVersion(state.riskModelPublishedVersion);
      const receiptId = `M01-PUBLISH-${now.getTime().toString(36).toUpperCase()}`;
      state.riskPublishedConfig = clone(modelDraft());
      state.riskModelPublishedVersion = version;
      state.riskModelPublishedAt = localDateTime(now);
      state.riskModelPublishReceipt = receiptId;
      state.riskModelDraft = clone(state.riskPublishedConfig);
      state.riskModelStatus = "published";
      state.riskModelValidation = null;
      state.riskModelSavedAt = "";
      persist(); render(); toast(startRun ? `模型 ${version} 已取得发布回执，正在创建新评估` : `模型 ${version} 已取得发布回执，请启动新评估`);
      if (startRun) await runRiskAssessment(byId("risk"));
      return true;
    } catch (error) {
      state.riskModelStatus = "validated";
      state.riskModelPublishError = error?.message || "权威发布服务暂时不可用，候选配置已保留";
      persist(); render();
      return false;
    }
  }

  function publishedModelForRun(base) {
    const config = state.riskPublishedConfig || modelDraft();
    const tiers = config.tiers.map((tier, index, list) => ({
      ...tier,
      minInclusive: Number(tier.minInclusive),
      maxExclusive: index === 0 ? null : Number(list[index - 1].minInclusive),
    }));
    return {
      ...base,
      packageVersion: state.riskModelPublishedVersion,
      lifecycleStatus: "published",
      weights: clone(config.weights),
      factors: clone(config.factors),
      riskTiers: tiers,
    };
  }

  async function runRiskAssessment(dash) {
    if (state.riskRerunState === "running" || state.riskModelStatus !== "published") return;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    state.riskRerunRunId = `S003-RUN-${stamp}-${now.getMilliseconds().toString().padStart(3, "0")}`;
    state.riskRerunAt = localDateTime(now);
    state.riskRerunState = "running";
    state.riskRerunError = "";
    state.riskRerunResult = null;
    state.riskRerunAttempts = Number(state.riskRerunAttempts || 0) + 1;
    persist(); render();
    const startedAt = Date.now();
    try {
      if (!window.S003ScoreEngine?.scorePortfolio) throw new Error("评分服务尚未就绪，请重新读取后重试");
      const [baseResponse, fixtureResponse] = await Promise.all([
        fetch("../scenarios/s003/resources/m01/model-package.v2.json", { cache: "no-store" }),
        fetch("../scenarios/s003/fixtures/enterprise-fixture.v1.json", { cache: "no-store" }),
      ]);
      if (!baseResponse.ok || !fixtureResponse.ok) throw new Error("无法读取当前模型或企业输入，请检查服务后重试");
      const baseModel = await baseResponse.json();
      const fixture = await fixtureResponse.json();
      const result = window.S003ScoreEngine.scorePortfolio({
        fixture,
        modelPackage: publishedModelForRun(baseModel),
        context: {
          ...clone(RISK_CONTEXT),
          scenarioRunId: state.riskRerunRunId,
          publishedVersion: state.riskModelPublishedVersion,
          dataVersion: "S003-T007-DEBT-RISK-20251231-v1",
          manualInputVersion: "S003-T053-INPUT-20251231-v1",
          assessmentAt: "2025-12-31",
        },
      });
      const wait = Math.max(0, 1600 - (Date.now() - startedAt));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      const counts = result.summary.riskTierCounts;
      state.riskRerunResult = {
        enterpriseCount: result.enterpriseCount,
        averageFinalScore: result.summary.averageFinalScore,
        counts,
        text: `${result.enterpriseCount} 家 · 绿 ${counts.GREEN || 0} / 黄 ${counts.YELLOW || 0} / 红 ${counts.RED || 0} / 黑 ${counts.BLACK || 0}`,
        modelVersion: result.modelIdentity.packageVersion,
      };
      state.riskRerunState = "complete";
      persist(); render(); toast("新一轮隔离评估已完成，历史结果未覆盖");
    } catch (error) {
      state.riskRerunState = "failed";
      state.riskRerunError = error?.message || "本次评估未完成；锁定输入和上一成功运行均已保留";
      persist(); render(); toast("本次评估未完成，可按原输入重试");
    }
  }

  function renderRisk(tab) {
    const dash = byId("risk");
    const normalizedTab = tab === "enterprises" ? "actions" : tab;
    const valid = ["overview", "analysis", "actions", "operations"].includes(normalizedTab) ? normalizedTab : "overview";
    const tabItems = [
      { id: "overview", label: "风险总览", icon: "layout-dashboard" },
      { id: "analysis", label: "产业与薄弱项", icon: "chart-no-axes-combined" },
      { id: "actions", label: "风险处置行动", icon: "shield-check" },
      { id: "operations", label: "模型与运行", icon: "sliders-horizontal" }
    ];
    const actions = valid === "operations"
      ? `<button class="btn" type="button" data-action="risk-read-model">${icon("refresh-cw", "sm")}重新读取当前模型</button>`
      : `<a class="btn" href="${dashboardHref("risk", "operations")}">${icon("sliders-horizontal", "sm")}模型与重跑</a><a class="btn" href="../report-center/review-lifecycle/index.html?scenarioId=S003#/reports?tab=products">${icon("library", "sm")}报告目录</a>`;
    const content = valid === "overview"
      ? riskOverview(dash)
      : valid === "analysis"
        ? riskAnalysis(dash)
      : valid === "actions"
        ? riskActions(dash)
        : `${riskModelConfig(dash)}${riskRuns(dash)}`;
    shell(`<main class="page dashboard-page risk-page" data-screen-label="债务风险监测驾驶舱">${dashboardHeader(dash, { actions })}${infoStrip(dash)}${tabs(tabItems, valid, "risk")}<div class="dashboard-content">${content}</div></main>`);
  }

  function riskActionByEnterpriseId(enterpriseId) {
    return byId("risk").actions.find((item) => item.enterpriseId === enterpriseId) || null;
  }

  function openRiskActionEvidence(item) {
    if (!item) return;
    const current = riskActionRecord(item);
    if (!current.evidenceViewed) setRiskActionRecord(item, { evidenceViewed: true });
    const record = riskActionRecord(item);
    const stage = riskActionStageMeta(record);
    state.drawer = {
      eyebrow: "风险固定依据",
      title: item.enterprise,
      subtitle: `${item.category} · ${item.tier} · ${fmt(item.score, 2)} 分`,
      rows: [
        ["评估时点", "2025-12-31"],
        ["风险等级", item.tier],
        ["综合评分", `${fmt(item.score, 2)} 分`],
        ["重点关注", item.focus],
        ["识别依据", item.basis],
        ["已发布行动类型", `${item.actionTypeName} · ${item.actionTypeVersion}`],
        ["接收接口人", item.recipient],
        ["建议负责人", item.recommendedOwner],
        ["固定结果", `S003-C035-${RISK_CONTEXT.scenarioRunId}-${item.enterpriseId}`],
        ["正式数据", "S003-T007-DEBT-RISK-20251231-v1"],
        ["当前处理", stage.label],
      ],
      html: `<section class="evidence-explanation"><h3>为什么识别为风险</h3><p>${esc(item.basis)}</p><h3>建议如何处理</h3><p>${esc(item.recommendation)}</p><div class="decision-boundary-note">${icon("shield-check", "sm")}本页确认的是风险事实和提交意愿，不是决策中心的人工决定。提交后仍需成员单位接口人核实，才可能形成负责人待办。</div></section>`,
      footerHtml: record.stage === "pending"
        ? `<button class="btn primary" type="button" data-action="risk-action-confirm" data-enterprise-id="${attr(item.enterpriseId)}">${icon("badge-check", "sm")}确认风险事实</button>`
        : record.stage === "confirmed" || record.stage === "failed"
          ? `<button class="btn primary" type="button" data-action="risk-action-submit" data-enterprise-id="${attr(item.enterpriseId)}">${icon(record.stage === "failed" ? "rotate-ccw" : "send", "sm")}${record.stage === "failed" ? "重新提交" : "提交行动申请"}</button>`
          : ["submitted", "handled"].includes(record.stage)
            ? `<a class="btn primary" href="../decision-center-prototype/index.html#/operations/intake">${icon("external-link", "sm")}前往决策中心</a>`
            : `<button class="btn primary" type="button" disabled>${icon("loader-circle", "sm")}提交中</button>`,
    };
    render();
  }

  function openRiskSectorDetail(sectorName) {
    const companies = byId("risk").companies.filter((item) => riskIndustry(item) === sectorName);
    const alerts = companies.filter((item) => item.riskTier !== "绿灯");
    state.drawer = {
      eyebrow: "产业构成",
      title: sectorName,
      subtitle: `${companies.length} 家企业 · ${alerts.length} 家触发预警`,
      rows: [
        ["产业企业数", `${companies.length} 家`],
        ["运营阶段", `${companies.filter((item) => riskOperatingStage(item) === "运营阶段").length} 家`],
        ["建设阶段", `${companies.filter((item) => riskOperatingStage(item) === "建设阶段").length} 家`],
        ["平均评分", `${fmt(companies.reduce((sum, item) => sum + item.finalScore, 0) / Math.max(companies.length, 1), 2)} 分`],
        ["风险分布", `绿 ${companies.filter((item) => item.riskTier === "绿灯").length} / 黄 ${companies.filter((item) => item.riskTier === "黄灯").length} / 红 ${companies.filter((item) => item.riskTier === "红灯").length} / 黑 ${companies.filter((item) => item.riskTier === "黑灯").length}`],
      ],
      html: alerts.length ? `<section class="evidence-explanation"><h3>需要处置的企业</h3>${alerts.map((item) => `<p><strong>${esc(item.enterpriseName)}</strong> · ${esc(item.riskTier)} · ${esc(item.focus)} · ${fmt(item.finalScore, 2)} 分</p>`).join("")}</section>` : `<div class="drawer-note">${icon("circle-check", "sm")}<div><strong>当前无亮灯预警</strong><p>该产业企业仍按正式评估轮次持续监测。</p></div></div>`,
    };
    render();
  }

  function openRiskTierDetail(tierName) {
    const companies = byId("risk").companies.filter((item) => item.riskTier === tierName);
    state.drawer = {
      eyebrow: "风险分档",
      title: `${tierName}企业`,
      subtitle: `${companies.length} 家 · 当前正式评估轮次`,
      rows: companies.map((item) => [item.enterpriseName, `${fmt(item.finalScore, 2)} 分 · ${riskIndustry(item)} · ${item.focus}`]),
      note: tierName === "绿灯" ? "绿灯企业不进入风险处置行动页，继续按正式评估周期监测。" : "亮灯企业是否需要发起处置，仍须在风险处置行动页逐条核对固定依据。",
      link: tierName === "绿灯" ? null : { href: dashboardHref("risk", "actions"), label: "进入风险处置" },
    };
    render();
  }

  function renderDrawer() {
    const item = state.drawer;
    const rows = item.rows || [];
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer" role="dialog" aria-modal="true" aria-label="${attr(item.title)}"><header class="drawer-head"><div><span class="eyebrow">${esc(item.eyebrow || "查看详情")}</span><h2>${esc(item.title)}</h2><p>${esc(item.subtitle || "")}</p></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="关闭">${icon("x", "sm")}</button></header><div class="drawer-body">${rows.length ? `<dl class="detail-list">${rows.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>` : ""}${item.html || ""}${item.note ? `<div class="drawer-note">${icon("info", "sm")}<div><strong>业务说明</strong><p>${esc(item.note)}</p></div></div>` : ""}</div><footer class="drawer-foot"><button class="btn" type="button" data-action="close-drawer">关闭</button>${item.link ? `<a class="btn primary" href="${attr(item.link.href)}">${esc(item.link.label)}${icon("arrow-right", "sm")}</a>` : ""}${item.footerHtml || ""}</footer></aside></div>`;
  }

  function openMetric(dashboardId, key) {
    const dash = byId(dashboardId);
    const metric = (dashboardId === "financing" ? financeScopedMetrics(dash) : dashboardId === "budget" ? budgetScopedMetrics(dash) : dash.metrics).find((item) => item.key === key);
    if (!metric) return;
    state.drawer = { eyebrow: "指标口径", title: metric.label, subtitle: `${metric.display} ${metric.unit}`, rows: [["当前范围", dashboardId === "financing" ? state.financeScopeId : dashboardId === "budget" ? state.budgetScope : "全部企业"], ["数据截至", dash.period], ["业务定义", dash.semanticLabel], ["更新时间", dash.updatedAt]], note: metric.note };
    render();
  }

  function render() {
    const current = route();
    if (current.type === "directory") return renderDirectory();
    if (current.id === "financing") return renderFinancing(current.tab);
    if (current.id === "budget") return renderBudget(current.tab);
    if (current.id === "risk") return renderRisk(current.tab);
    location.hash = "#/dashboards";
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "refresh") {
      target.classList.add("is-reading");
      window.setTimeout(() => { target.classList.remove("is-reading"); toast("指标、专题和业务状态已重新读取"); }, 520);
      return;
    }
    if (action === "save-view") { persist(); toast("当前分析范围和视图已保存"); return; }
    if (action === "finance-scope") {
      state.financeScopeType = target.dataset.type;
      const dash = byId("financing");
      state.financeScopeId = state.financeScopeType === "group" ? "集团" : state.financeScopeType === "board" ? dash.boards[0].name : dash.units[0].name;
      persist(); render(); return;
    }
    if (action === "toggle-finance-unit") {
      const unit = target.dataset.unit;
      if (state.financeCompare.includes(unit)) {
        if (state.financeCompare.length === 1) return toast("至少保留 1 家单位");
        state.financeCompare = state.financeCompare.filter((item) => item !== unit);
      } else if (state.financeCompare.length < 3) state.financeCompare.push(unit);
      else return toast("最多同时比较 3 家单位");
      persist(); render(); return;
    }
    if (action === "metric-detail") { openMetric(target.dataset.dashboard, target.dataset.key); return; }
    if (action === "structure-detail") {
      const dash = byId("financing");
      const item = dash.structures.find((structure) => structure.id === target.dataset.id);
      state.drawer = { eyebrow: "结构分析", title: item.name, subtitle: "当前融资余额占比", rows: item.items.map((part) => [part[0], `${fmt(part[1], 2)}%`]), note: "结构项使用当前驾驶舱相同的数据范围和数据截至时间。" };
      render(); return;
    }
    if (action === "finance-unit-detail") {
      const item = byId("financing").units[Number(target.dataset.index)];
      state.drawer = { eyebrow: "单位分析", title: item.name, subtitle: item.board, rows: [["融资余额", `${fmt(item.balance, 3)} 亿元`], ["余额加权融资成本", `${fmt(item.cost, 6)}%`], ["浮动利率余额占比", `${fmt(item.floating, 2)}%`], ["短期债务余额占比", `${fmt(item.shortTerm, 2)}%`], ["高成本融资余额占比", `${fmt(item.highCost, 2)}%`], ["主要发现", item.finding]], note: "查看详情不会改变当前单位结果或行动状态。" };
      render(); return;
    }
    if (action === "institution-detail") {
      const item = byId("financing").institutions[Number(target.dataset.index)];
      state.drawer = { eyebrow: "融资机构", title: item.name, rows: [["集团融资余额", `${fmt(item.balance, 3)} 亿元`], ["余额占比", `${fmt(item.share, 3)}%`], ["加权融资成本", `${fmt(item.cost, 6)}%`], ["存续借据", `${item.count} 笔`], ["数据截至", byId("financing").period]], note: "机构分析用于协商准备，具体行动仍通过决策中心受控推进。" };
      render(); return;
    }
    if (action === "rule-detail") {
      const item = byId("financing").rules[Number(target.dataset.index)];
      state.drawer = { eyebrow: "规则结果", title: `${item.unit} · ${item.title}`, rows: [["结果", item.result], ["当前值", item.observed], ["命中阈值", item.threshold], ["触发分支", item.branch], ["优先机构", item.institution], ["评估时间", item.evaluatedAt]], note: "规则结果只作为行动申请的业务证据，不能绕过人工确认直接创建待办。" };
      render(); return;
    }
    if (action === "finance-action-detail") {
      const item = byId("financing").actions[Number(target.dataset.index)];
      state.drawer = { eyebrow: "行动进展", title: item.title, rows: [["负责人", item.owner], ["当前状态", item.status], ["业务依据", item.basis], ["最近更新", item.updatedAt]], note: "仪表盘只读展示决策运行摘要，确认、分配和待办更新在决策中心完成。", link: { href: "../decision-center-prototype/index.html#/workbench", label: "查看决策进展" } };
      render(); return;
    }
    if (action === "budget-expand") { state.budgetExpanded = state.budgetExpanded === target.dataset.key ? "" : target.dataset.key; persist(); render(); return; }
    if (action === "budget-record-detail") {
      const item = filteredBudgetRows(byId("budget"), "cost")[Number(target.dataset.index)];
      state.drawer = { eyebrow: "预算执行", title: item.name, rows: [["最终批准费用预算", `${fmt(item.budget)} 万元`], ["实际费用", `${fmt(item.actual)} 万元`], ["预算执行率", `${fmt(item.execution)}%`], ["成本占收比", `${fmt(item.costToRevenue)}%`], ["预算差异", `${fmt(item.delta)} 万元`], ["当前判定", item.status]], note: "预算专题只用于监督分析和业务复核，不自动形成决策中心行动或待办。" };
      render(); return;
    }
    if (action === "risk-tier-jump") { openRiskTierDetail(target.dataset.tier); return; }
    if (action === "risk-sector-detail") { openRiskSectorDetail(target.dataset.sector); return; }
    if (action === "risk-search") { state.riskSearch = document.getElementById("risk-search")?.value || ""; persist(); render(); return; }
    if (action === "risk-filter-reset") { state.riskTier = "全部"; state.riskSector = "全部产业"; state.riskSort = "risk"; state.riskSearch = ""; persist(); render(); return; }
    if (action === "risk-model-section") { state.riskModelSection = target.dataset.section || "overview"; persist(); render(); return; }
    if (action === "risk-open-decision") { if (window.parent !== window) window.parent.location.hash = "#module/decision"; else location.href = "../decision-center-prototype/index.html#workbench"; return; }
    if (action === "risk-action-evidence") { openRiskActionEvidence(riskActionByEnterpriseId(target.dataset.enterpriseId)); return; }
    if (action === "risk-action-confirm") {
      const item = riskActionByEnterpriseId(target.dataset.enterpriseId);
      if (!item) return;
      const current = riskActionRecord(item);
      if (!current.evidenceViewed) return toast("请先查看并核对固定依据");
      if (current.stage !== "pending") return;
      setRiskActionRecord(item, { stage: "confirmed", confirmedAt: localDateTime(), error: "" });
      state.drawer = null; render(); toast(`${item.enterprise}的风险事实已确认，尚未提交行动申请`); return;
    }
    if (action === "risk-action-unconfirm") {
      const item = riskActionByEnterpriseId(target.dataset.enterpriseId);
      if (!item) return;
      const current = riskActionRecord(item);
      if (current.stage !== "confirmed") return;
      setRiskActionRecord(item, { stage: "pending", evidenceViewed: false, confirmedAt: "", error: "" });
      render(); toast(`${item.enterprise}已撤销提交前确认，可重新核对固定依据`); return;
    }
    if (action === "risk-action-submit") {
      const item = riskActionByEnterpriseId(target.dataset.enterpriseId);
      if (!item) return;
      state.drawer = null;
      void submitRiskAction(item);
      return;
    }
    if (action === "risk-model-save") {
      state.riskModelSavedAt = localDateTime();
      if (!["invalid", "validated"].includes(state.riskModelStatus)) state.riskModelStatus = "saved";
      persist(); render(); toast("修改已暂存，当前生效模型没有改变"); return;
    }
    if (action === "risk-model-validate") {
      const validation = validateRiskModelDraft();
      state.riskModelValidation = validation;
      state.riskModelStatus = validation.ok ? "validated" : "invalid";
      state.riskModelPublishError = "";
      persist(); render(); toast(validation.ok ? "配置校验通过，可以提交发布" : "配置校验未通过，请查看问题"); return;
    }
    if (action === "risk-model-publish") { void publishRiskModel(false); return; }
    if (action === "risk-model-publish-run") { void publishRiskModel(true); return; }
    if (action === "risk-model-apply-run") { void publishRiskModel(true); return; }
    if (action === "risk-model-reset") {
      state.riskModelDraft = clone(state.riskPublishedConfig);
      state.riskModelStatus = "published";
      state.riskModelValidation = null;
      state.riskModelPublishError = "";
      state.riskModelSavedAt = "";
      persist(); render(); toast("未发布修改已放弃，已恢复当前生效配置"); return;
    }
    if (action === "risk-read-model") { target.classList.add("is-reading"); window.setTimeout(() => { target.classList.remove("is-reading"); toast("已重新读取当前生效模型"); }, 650); return; }
    if (action === "risk-data-check") {
      target.classList.add("is-reading");
      window.setTimeout(() => {
        state.riskDataCheckedAt = localDateTime();
        persist(); render(); toast("已检查正式数据，当前没有需要重评的新版本");
      }, 720);
      return;
    }
    if (action === "risk-rerun") {
      void runRiskAssessment(byId("risk")); return;
    }
    if (action === "close-drawer") {
      if (target.classList.contains("drawer-backdrop") && event.target !== target) return;
      state.drawer = null;
      render();
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    let changed = false;
    if (target.dataset.modelWeight) {
      const category = target.dataset.modelWeight;
      state.riskModelDraft.weights[category][Number(target.dataset.modelIndex)] = target.value === "" ? "" : Number(target.value);
      changed = true;
    }
    if (target.dataset.modelFactor) {
      const factor = state.riskModelDraft.factors.find((item) => item.factorId === target.dataset.modelFactor);
      const tier = factor?.tiers.find((item) => item.tierId === target.dataset.modelTier);
      if (tier) { tier.coefficient = target.value === "" ? "" : Number(target.value); changed = true; }
    }
    if (target.dataset.modelRiskTier) {
      const tier = state.riskModelDraft.tiers.find((item) => item.tierId === target.dataset.modelRiskTier);
      if (tier && tier.tierId !== "BLACK") { tier.minInclusive = target.value === "" ? "" : Number(target.value); changed = true; }
    }
    if (changed) {
      state.riskModelStatus = "draft";
      state.riskModelValidation = null;
      state.riskModelPublishError = "";
      persist();
      syncModelEditControls();
    }
  });

  document.addEventListener("change", (event) => {
    const change = event.target.dataset.change;
    if (event.target.dataset.modelWeight) {
      const category = event.target.dataset.modelWeight;
      const index = Number(event.target.dataset.modelIndex);
      state.riskModelDraft.weights[category][index] = event.target.value === "" ? "" : Number(event.target.value);
      state.riskModelStatus = "draft";
      state.riskModelValidation = null;
      state.riskModelPublishError = "";
      persist(); render(); return;
    }
    if (event.target.dataset.modelFactor) {
      const factor = state.riskModelDraft.factors.find((item) => item.factorId === event.target.dataset.modelFactor);
      const tier = factor?.tiers.find((item) => item.tierId === event.target.dataset.modelTier);
      if (tier) tier.coefficient = event.target.value === "" ? "" : Number(event.target.value);
      state.riskModelStatus = "draft";
      state.riskModelValidation = null;
      state.riskModelPublishError = "";
      persist(); render(); return;
    }
    if (event.target.dataset.modelRiskTier) {
      const tier = state.riskModelDraft.tiers.find((item) => item.tierId === event.target.dataset.modelRiskTier);
      if (tier && tier.tierId !== "BLACK") tier.minInclusive = event.target.value === "" ? "" : Number(event.target.value);
      state.riskModelStatus = "draft";
      state.riskModelValidation = null;
      state.riskModelPublishError = "";
      persist(); render(); return;
    }
    if (!change) return;
    if (change === "finance-scope-id") state.financeScopeId = event.target.value;
    if (change === "budget-scope") { state.budgetScope = event.target.value; state.budgetExpanded = ""; }
    if (change === "risk-tier") state.riskTier = event.target.value;
    if (change === "risk-sector") state.riskSector = event.target.value;
    if (change === "risk-sort") state.riskSort = event.target.value;
    persist(); render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.drawer) { state.drawer = null; render(); }
    if (event.key === "Enter" && event.target.id === "risk-search") { state.riskSearch = event.target.value; persist(); render(); }
  });

  addEventListener("hashchange", () => { state.drawer = null; window.scrollTo({ top: 0, behavior: "instant" }); render(); });
  window.OFW_RISK_DASHBOARD_TEST_API = Object.freeze({
    context: RISK_CONTEXT,
    state,
    riskActionRequestId,
    buildRiskActionRequest,
    writeRiskActionRequest,
    riskActionRecord,
    setRiskActionRecord,
    validateRiskModelDraft,
    nextPatchVersion,
    publishedModelForRun,
    modelHasChanges,
    riskIndustry,
  });
  if (!window.__OFW_DASHBOARD_SKIP_RENDER__) render();
})();
