(function () {
  "use strict";

  const DATA = window.RC_WORKSPACE_DATA;
  const STORAGE_KEY = "ontology3.report-center.review-workspace.v2";
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function freshState() {
    return {
      route: "directory",
      view: "grid",
      search: "",
      statusFilter: "全部状态",
      reports: [],
      selectedReportId: null,
      selectedAnchor: "summary",
      selectedCheck: null,
      assistantTab: "qa",
      assistantOpen: true,
      compareCurrent: false,
      qaInput: "",
      messages: [],
      issues: [],
      drawer: null,
      modal: null,
      generation: null,
      wizard: {
        step: 1,
        type: "finance-analysis",
        title: DATA.reportTypes[0].name,
        scope: "集团",
        subject: "集团合并口径",
        resources: DATA.semanticResources.map((item) => item.id),
        dataChoice: "current",
        compatStatus: "未验证",
        compatMessage: "选择正式数据上下文后执行兼容性检查。"
      }
    };
  }

  function loadState() {
    const base = freshState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      const merged = Object.assign(base, saved);
      merged.wizard = Object.assign(base.wizard, saved.wizard || {});
      merged.modal = null;
      merged.drawer = null;
      if (merged.generation && merged.generation.status === "处理中") {
        merged.route = merged.reports.length ? "directory" : "directory";
        merged.generation = null;
      }
      return merged;
    } catch (error) {
      return base;
    }
  }

  let state = loadState();
  let timers = [];

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearTimers() {
    timers.forEach((timer) => clearTimeout(timer));
    timers = [];
  }

  function later(fn, delay) {
    const timer = setTimeout(fn, delay);
    timers.push(timer);
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function nowText() {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).format(new Date()).replaceAll("/", "-");
  }

  function generatedId(prefix) {
    const stamp = new Date().toISOString().replace(/\D/g, "").slice(2, 14);
    return `${prefix}-${stamp}`;
  }

  function icon(name, size) {
    return `<span class="icon${size ? ` ${size}` : ""}" aria-hidden="true"><i data-lucide="${name}"></i></span>`;
  }

  function statusClass(status) {
    if (["已发布", "已确认", "通过", "可定位", "已完成", "可消费", "人工已检查"].includes(status)) return "success";
    if (["草稿待复核", "处理中", "生成中", "自动核验中", "发布中", "导出中", "未运行"].includes(status)) return "info";
    if (["警告", "数据陈旧", "已撤回", "陈旧", "受限完成"].includes(status)) return "warning";
    if (["失败", "核验失败", "发布失败", "导出失败", "阻断", "历史资源不可定位"].includes(status)) return "danger";
    if (["无法核验"].includes(status)) return "purple";
    return "plain";
  }

  function badge(status, label) {
    return `<span class="badge ${statusClass(status)}"><span class="status-dot"></span>${esc(label || status)}</span>`;
  }

  function getReport() {
    return state.reports.find((item) => item.id === state.selectedReportId) || null;
  }

  function getContext() {
    return DATA.dataContexts.find((item) => item.id === state.wizard.dataChoice) || DATA.dataContexts[0];
  }

  function routeTitle() {
    if (state.route === "workspace") return getReport() ? getReport().title : "内容工作台";
    if (state.route === "review") return "复核任务";
    if (state.route === "generation") return "报告生成";
    return "报告目录";
  }

  function renderRail() {
    return `
      <aside class="platform-rail" aria-label="平台模块">
        <a class="platform-logo" href="../../ontology3-homepage-review/index.html" aria-label="ontology3 首页" title="ontology3 首页">O3</a>
        <a class="platform-button" href="../../data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html" aria-label="数据工程" title="数据工程">${icon("database")}</a>
        <a class="platform-button" href="../../ontology-management-prototype/index.html" aria-label="本体管理" title="本体管理">${icon("network")}</a>
        <a class="platform-button" href="../../intelligent-query-prototype/%E6%99%BA%E8%83%BD%E9%97%AE%E6%95%B0%E5%B7%A5%E4%BD%9C%E5%8F%B0.html" aria-label="智能问数" title="智能问数">${icon("messages-square")}</a>
        <a class="platform-button" href="../../decision-center-prototype/index.html" aria-label="决策中心" title="决策中心">${icon("git-pull-request-arrow")}</a>
        <a class="platform-button" href="../../agent-application/Agent%E5%BA%94%E7%94%A8.html" aria-label="Agent 应用" title="Agent 应用">${icon("bot")}</a>
        <span class="platform-button active" aria-current="page" aria-label="报告中心" title="报告中心">${icon("file-chart-column")}</span>
        <div class="platform-spacer"></div>
        <button class="platform-button" data-action="open-reset" title="重置状态">${icon("rotate-ccw")}</button>
        <button class="platform-button" data-action="show-help" title="使用帮助">${icon("circle-help")}</button>
      </aside>`;
  }

  function renderProductNav() {
    const report = getReport();
    return `
      <aside class="product-nav" aria-label="报告中心导航">
        <div class="product-nav-head"><span>${icon("file-chart-column", "sm")}</span><div><strong>报告中心</strong><small>受控报告工作区</small></div></div>
        <nav class="product-nav-list">
          <div class="product-nav-label">报告工作区</div>
          <button class="product-nav-item ${state.route === "directory" ? "active" : ""}" data-action="go-directory">${icon("library", "sm")}<span>报告目录</span><em>${state.reports.length}</em></button>
          <button class="product-nav-item ${state.route === "workspace" || state.route === "generation" ? "active" : ""}" data-action="open-last-workspace">${icon("panel-left-close", "sm")}<span>内容工作台</span><em>${report ? "1" : ""}</em></button>
          <button class="product-nav-item ${state.route === "review" ? "active" : ""}" data-action="open-review">${icon("list-checks", "sm")}<span>复核任务</span><em>${state.issues.filter((item) => item.status !== "已关闭").length}</em></button>
        </nav>
        <div class="product-nav-foot"><strong>系统内受控阅读</strong><span>HTML 与 PDF 共享报告编号、内容版本和证据链。</span></div>
      </aside>`;
  }

  function renderTopbar() {
    return `
      <header class="topbar">
        <div class="topbar-left"><div class="breadcrumb"><span>报告中心</span><span>/</span><strong>${esc(routeTitle())}</strong></div></div>
        <div class="topbar-actions">
          <button class="btn ghost" data-action="open-reset">${icon("rotate-ccw", "sm")}重置状态</button>
          <div class="account"><span class="account-avatar">林</span><div><strong>林悦</strong><small>报告复核者</small></div></div>
        </div>
      </header>`;
  }

  function renderDirectory() {
    const statusOptions = ["全部状态", "草稿待复核", "已确认", "已发布", "已撤回"];
    const reports = state.reports.filter((report) => {
      const matchSearch = !state.search || `${report.title}${report.scene}${report.reportNo || ""}`.toLowerCase().includes(state.search.toLowerCase());
      const matchStatus = state.statusFilter === "全部状态" || report.status === state.statusFilter;
      return matchSearch && matchStatus;
    });
    return `
      <main class="main" data-screen-label="报告目录">
        <div class="page">
          <div class="page-header"><div><h1>报告目录</h1><p>创建、复核并阅读绑定精确语义和数据版本的正式报告。</p></div><div class="header-actions"><button class="btn primary" data-action="new-report">${icon("plus", "sm")}创建报告</button></div></div>
          <div class="directory-toolbar">
            <div class="filter-row">
              <label class="search-field">${icon("search", "sm")}<input data-field="search" value="${esc(state.search)}" placeholder="搜索报告名称、场景或报告编号" aria-label="搜索报告"></label>
              <select class="select" data-field="statusFilter" style="width:150px" aria-label="筛选状态">${statusOptions.map((item) => `<option ${state.statusFilter === item ? "selected" : ""}>${item}</option>`).join("")}</select>
            </div>
            <div class="segmented" aria-label="显示方式"><button class="${state.view === "grid" ? "active" : ""}" data-action="set-view" data-view="grid">${icon("layout-grid", "sm")} 卡片</button><button class="${state.view === "list" ? "active" : ""}" data-action="set-view" data-view="list">${icon("list", "sm")} 列表</button></div>
          </div>
          ${reports.length ? (state.view === "grid" ? renderReportCards(reports) : renderReportList(reports)) : renderDirectoryEmpty()}
        </div>
      </main>`;
  }

  function renderDirectoryEmpty() {
    const filtered = state.reports.length > 0;
    return `<section class="panel"><div class="empty-state"><div class="empty-icon">${icon(filtered ? "search-x" : "file-plus-2", "lg")}</div><h2>${filtered ? "没有符合条件的报告" : "尚未创建报告"}</h2><p>${filtered ? "调整搜索词或状态筛选后重试。" : "从获准的报告定义开始，选择 Published 语义资源与正式数据上下文后生成第一份草稿。"}</p><button class="btn ${filtered ? "soft" : "primary"}" data-action="${filtered ? "clear-filters" : "new-report"}">${icon(filtered ? "filter-x" : "plus", "sm")}${filtered ? "清除筛选" : "创建报告"}</button></div></section>`;
  }

  function reportCore(report) {
    return {
      type: "融资经营分析",
      status: report.status,
      version: report.contentVersion,
      asOf: report.asOf,
      identity: report.reportNo || "生成后分配"
    };
  }

  function renderReportCards(reports) {
    return `<div class="report-grid">${reports.map((report) => {
      const core = reportCore(report);
      return `<article class="report-card">
        <div class="report-card-head"><div><h3>${esc(report.title)}</h3><p>${esc(report.scene)} · ${esc(core.type)}</p></div>${badge(core.status)}</div>
        <div class="report-card-meta"><div class="meta-cell"><span>报告编号</span><strong>${esc(core.identity)}</strong></div><div class="meta-cell"><span>内容版本</span><strong>${esc(core.version)}</strong></div><div class="meta-cell"><span>数据截至</span><strong>${esc(core.asOf)}</strong></div><div class="meta-cell"><span>自动核验</span><strong>${esc(report.verification.status)}</strong></div></div>
        <div class="button-row"><button class="btn soft" data-action="select-report" data-report="${esc(report.id)}">${icon("arrow-right", "sm")}查看详情</button><button class="btn ghost" data-action="open-history-direct" data-report="${esc(report.id)}">${icon("history", "sm")}历史版本</button></div>
      </article>`;
    }).join("")}</div>`;
  }

  function renderReportList(reports) {
    return `<div class="report-list">${reports.map((report) => {
      const core = reportCore(report);
      return `<article class="report-row"><div><h3>${esc(report.title)}</h3><p>${esc(report.scene)} · ${esc(core.type)}</p></div><div>${badge(core.status)}</div><div><strong>${esc(core.version)}</strong><span>内容版本</span></div><div><strong>${esc(core.asOf)}</strong><span>数据截至</span></div><div><strong>${esc(core.identity)}</strong><span>报告编号</span></div><button class="btn soft" data-action="select-report" data-report="${esc(report.id)}">查看详情</button></article>`;
    }).join("")}</div>`;
  }

  function renderReviewQueue() {
    return `<main class="main" data-screen-label="复核任务"><div class="page"><div class="page-header"><div><h1>复核任务</h1><p>自动核验问题与人工处理结论分开记录。</p></div></div>${state.issues.length ? `<section class="panel"><div class="panel-head"><div><div class="panel-title">待处理问题</div><p>问题绑定报告内容版本、锚点和证据。</p></div></div><div class="panel-body"><div class="history-list">${state.issues.map((issue) => `<article class="history-row"><div><h3>${esc(issue.title)}</h3><p>${esc(issue.reportTitle)} · ${esc(issue.anchor)} · ${esc(issue.createdAt)}</p><div class="status-row" style="margin-top:6px">${badge(issue.status)}${badge("失败", issue.source)}</div></div><div class="history-actions"><button class="btn soft" data-action="open-issue" data-report="${esc(issue.reportId)}" data-anchor="${esc(issue.anchor)}">查看详情</button></div></article>`).join("")}</div></div></section>` : `<section class="panel"><div class="empty-state"><div class="empty-icon">${icon("list-checks", "lg")}</div><h2>暂无复核任务</h2><p>运行自动核验后，可从具体检查项创建绑定报告位置和证据的复核问题。</p><button class="btn soft" data-action="go-directory">返回报告目录</button></div></section>`}</div></main>`;
  }

  function renderGeneration() {
    const generation = state.generation || { status:"处理中", steps:[] };
    const labels = ["固定生成证据包", "校验精确版本组合", generation.isRegeneration ? "生成新内容版本" : "生成报告内容", "建立锚点与证据绑定"];
    const desc = ["报告定义、模板、Published 语义和数据上下文", "语义版本、数据版本、时点、质量与消费就绪", "Agent 生成运行与报告中心草稿副本严格分离", "段落、数值、单元格、图表和 Rule 的最小证据"];
    return `<main class="main workspace-main" data-screen-label="报告生成"><div class="generation-stage"><section class="generation-card"><div class="status-row" style="justify-content:space-between"><div><h1>${generation.isRegeneration ? "正在生成新内容版本" : "正在生成报告草稿"}</h1><p>${esc(generation.title || state.wizard.title)}</p></div>${badge(generation.status || "处理中")}</div><div class="generation-steps">${labels.map((label, index) => {
      const step = generation.steps[index] || "未开始";
      const cls = step === "处理中" ? "processing" : step === "已完成" ? "success" : step === "失败" ? "failed" : "";
      const iconName = step === "已完成" ? "check" : step === "失败" ? "x" : step === "处理中" ? "loader-circle" : "circle";
      return `<div class="generation-step ${cls}"><span class="step-icon">${icon(iconName,"sm")}</span><div><strong>${label}</strong><span>${desc[index]}</span></div>${badge(step)}</div>`;
    }).join("")}</div>${generation.status === "失败" ? `<div class="error-box"><strong>报告内容生成未完成</strong><br>${esc(generation.error)}。证据包已保留，不会生成半成品草稿。</div><div class="button-row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-action="go-directory">返回目录</button><button class="btn primary" data-action="generation-retry">${icon("refresh-cw", "sm")}重试生成</button></div>` : `<div class="progress"><span style="width:${generation.progress || 8}%"></span></div>`}</section></div></main>`;
  }

  function renderWorkspace() {
    const report = getReport();
    if (!report) return renderNoWorkspace();
    const verificationLabel = report.verification.status;
    const canManual = ["通过", "警告"].includes(verificationLabel);
    const canConfirm = report.manualReviewed && canManual && report.status === "草稿待复核";
    return `<main class="main workspace-main" data-screen-label="报告内容工作台">
      <div class="workspace-shell">
        <header class="workspace-toolbar">
          <div class="workspace-title"><button class="icon-button" data-action="go-directory" title="返回报告目录">${icon("arrow-left")}</button><div class="workspace-title-text"><h1>${esc(report.title)}</h1><p>${esc(report.scene)} · ${esc(report.contentVersion)} · 生成证据 ${esc(report.evidencePackage)}</p></div></div>
          <div class="workspace-actions">
            <div class="dual-status"><div><span>报告内容</span><strong>${badge(report.status)}</strong></div><div><span>自动核验</span><strong>${badge(verificationLabel)}</strong></div></div>
            <button class="btn ghost" data-action="open-history" aria-label="历史版本">${icon("history","sm")}<span class="label">历史</span></button>
            <button class="btn ghost" data-action="open-export" aria-label="导出正式报告" ${report.status !== "已发布" ? "disabled title=\"正式发布后可导出固定版\"" : ""}>${icon("download","sm")}<span class="label">导出</span></button>
            <button class="btn ghost" data-action="open-manual" aria-label="人工检查" ${!canManual || !["草稿待复核","已确认"].includes(report.status) ? "disabled title=\"完成可发布的自动核验后进行人工检查\"" : ""}>${icon("user-check","sm")}<span class="label">人工检查</span></button>
            ${canConfirm ? `<button class="btn success" data-action="confirm-draft" aria-label="确认草稿">${icon("check","sm")}<span class="label">确认草稿</span></button>` : ""}
            ${report.status === "已确认" ? `<button class="btn primary" data-action="publish-report" aria-label="发布报告">${icon("send","sm")}<span class="label">发布</span></button>` : ""}
            ${report.status === "已发布" ? `<button class="btn danger" data-action="open-withdraw" aria-label="撤回报告">${icon("archive-restore","sm")}<span class="label">撤回</span></button>` : ""}
            ${["已发布","已撤回"].includes(report.status) ? `<button class="btn soft" data-action="new-content-version" aria-label="创建新内容版本">${icon("copy-plus","sm")}<span class="label">新内容版本</span></button>` : ""}
            <button class="btn icon-only soft" data-action="toggle-assistant" title="打开或收起报告助手">${icon("panel-right-open")}</button>
          </div>
        </header>
        <div class="workbench">
          ${renderToc(report)}
          ${renderDocument(report)}
          ${renderAssistant(report)}
        </div>
      </div>
    </main>`;
  }

  function renderNoWorkspace() {
    return `<main class="main"><div class="page"><section class="panel"><div class="empty-state"><div class="empty-icon">${icon("panel-left-close","lg")}</div><h2>还没有可打开的内容版本</h2><p>创建报告并完成一次内容生成后，章节目录、HTML 正文和报告助手会在同一工作区中联动。</p><button class="btn primary" data-action="new-report">创建报告</button></div></section></div></main>`;
  }

  function renderToc(report) {
    const fixed = !report.hasMismatch;
    return `<aside class="toc-pane"><div class="pane-head"><div><strong>章节目录</strong><span> · ${fixed ? "8/8 已绑定" : "7/8 已绑定"}</span></div><button class="icon-button" data-action="scroll-document-top" title="回到顶部">${icon("arrow-up","sm")}</button></div><nav class="toc-scroll">${DATA.toc.map((item) => {
      const issue = report.hasMismatch ? item.issues : 0;
      return `<button class="toc-item ${state.selectedAnchor === item.id || (state.selectedAnchor.startsWith("metric") && item.id === (state.selectedAnchor === "metric-balance" || state.selectedAnchor === "metric-cost" ? "cost" : "structure")) ? "active" : ""}" data-action="select-anchor" data-anchor="${item.id}"><em>${item.number}</em><span>${esc(item.title)}</span>${issue ? `<span class="issue-count">${issue}</span>` : ""}</button>`;
    }).join("")}</nav><div class="toc-foot"><div class="outline-progress"><span>结构化证据覆盖</span><strong>${fixed ? "100%" : "87.5%"}</strong></div><div class="progress"><span style="width:${fixed ? 100 : 87.5}%"></span></div></div></aside>`;
  }

  function anchorClass(id, issue) {
    return `content-anchor${state.selectedAnchor === id ? " selected" : ""}${issue ? " issue" : ""}`;
  }

  function evidenceButton(id) {
    return `<button class="anchor-button" data-action="open-evidence" data-anchor="${id}" title="打开证据">${icon("link-2","sm")}</button>`;
  }

  function renderDocument(report) {
    const snapshot = report.dataVersion;
    const mismatch = report.hasMismatch;
    return `<section class="document-pane"><div class="document-context"><div class="context-left">${report.frozen ? badge("已发布", "已冻结") : badge(report.status)}<strong>${esc(report.contentVersion)}</strong><span>语义 ${esc(report.semanticVersion)}</span><span>数据 ${esc(snapshot)}</span></div><div class="context-right"><button class="text-link" data-action="open-evidence" data-anchor="cover">${icon("shield-check","sm")}版本与证据</button></div></div><div class="document-scroll" id="document-scroll"><article class="report-paper" lang="zh">
      ${report.frozen ? `<div class="freeze-banner">${icon("lock-keyhole","sm")}正式 HTML 已冻结；当前数据、模板或语义更新不会原地改变本报告。</div>` : ""}
      <header class="report-cover ${anchorClass("cover",false)}" id="anchor-cover" data-action="select-anchor" data-anchor="cover">${evidenceButton("cover")}<div class="eyebrow">${esc(report.scene)} · 集团经营分析</div><h1>${esc(report.title)}</h1><p>报告范围：集团合并口径 · 报告数据截至 ${esc(report.asOf)}</p><div class="cover-meta"><div><span>报告编号</span><strong>${esc(report.reportNo || "正式发布后分配")}</strong></div><div><span>内容版本</span><strong>${esc(report.contentVersion)}</strong></div><div><span>生成时间</span><strong>${esc(report.generatedAt)}</strong></div><div><span>报告定义</span><strong>RD-S001-04</strong></div><div><span>Published 语义</span><strong>${esc(report.semanticVersion)}</strong></div><div><span>数据版本</span><strong>${esc(report.dataVersion)}</strong></div></div></header>
      <section class="report-section" id="anchor-summary"><h2>1. 管理摘要</h2><p class="${anchorClass("summary",mismatch)}" data-action="select-anchor" data-anchor="summary">${evidenceButton("summary")}截至 ${esc(report.asOf)}，集团融资余额为 <button class="text-link inline-evidence" data-action="open-evidence" data-anchor="metric-balance">21,613.39 亿元</button>，综合融资成本为 <button class="text-link inline-evidence" data-action="open-evidence" data-anchor="metric-cost">2.372%</button>。浮动利率融资占比${mismatch ? "为 94.1%" : "为 95.1%"}，高成本融资余额占比为 9.859%。${mismatch ? "该摘要与正文绑定值存在差异，等待复核。" : "摘要与正文及绑定证据一致。"}</p><p>融资规模总体稳定，但浮动利率敞口较高。建议管理层优先关注高成本单位和机构集中度；具体行动仍需通过决策中心的标准 Action Request 进入确认与执行流程。</p></section>
      <section class="report-section" id="anchor-cost"><h2>2. 融资规模与成本</h2><div class="metric-row"><div class="report-metric ${anchorClass("metric-balance",false)}" data-action="select-anchor" data-anchor="metric-balance">${evidenceButton("metric-balance")}<span>融资余额</span><strong>21,613.39</strong><small>亿元 · MET-FIN-BAL</small></div><div class="report-metric ${anchorClass("metric-cost",false)}" data-action="select-anchor" data-anchor="metric-cost">${evidenceButton("metric-cost")}<span>综合融资成本</span><strong>2.372%</strong><small>余额加权 · MET-FIN-COST</small></div><div class="report-metric"><span>融资主体</span><strong>574</strong><small>家 · OBJ-FIN-ORG</small></div><div class="report-metric"><span>融资明细</span><strong>5,218</strong><small>笔 · 存续范围</small></div></div><p>综合融资成本由 Published Metric 对当前报告范围内的融资明细并集进行余额加权，报告中心与 Agent 均未重新计算或改写该指标。</p></section>
      <section class="report-section" id="anchor-structure"><h2>3. 债务结构</h2><div class="metric-row"><div class="report-metric ${anchorClass("metric-floating",mismatch)}" data-action="select-anchor" data-anchor="metric-floating">${evidenceButton("metric-floating")}<span>浮动利率余额占比</span><strong>95.149%</strong><small>MET-FIN-FLOAT</small></div><div class="report-metric ${anchorClass("metric-high",false)}" data-action="select-anchor" data-anchor="metric-high">${evidenceButton("metric-high")}<span>高成本融资余额占比</span><strong>9.859%</strong><small>MET-FIN-HIGH</small></div><div class="report-metric"><span>短期债务余额占比</span><strong>0.912%</strong><small>MET-FIN-SHORT</small></div><div class="report-metric"><span>外币融资余额占比</span><strong>4.224%</strong><small>MET-FIN-FX</small></div></div><p>浮动利率融资余额占比较高，意味着利率上行时组合成本更敏感；本段只解释已发布指标，不新增临时公式或口径。</p></section>
      <section class="report-section" id="anchor-institutions"><h2>4. 金融机构分布</h2><div class="report-table-wrap"><table class="report-table"><thead><tr><th>业务主体</th><th>主要机构</th><th class="numeric">融资余额（亿元）</th><th class="numeric">占主体余额</th><th class="numeric">综合成本</th></tr></thead><tbody><tr><td>单位553</td><td>欧陆银行</td><td class="numeric ${anchorClass("cell-unit553",false)}" data-action="select-anchor" data-anchor="cell-unit553">${evidenceButton("cell-unit553")}99.586</td><td class="numeric">32.754%</td><td class="numeric">2.994%</td></tr><tr><td>单位465</td><td>融通银行</td><td class="numeric">249.081</td><td class="numeric">32.348%</td><td class="numeric">2.154%</td></tr><tr><td>单位561</td><td>寰宇银行</td><td class="numeric">138.420</td><td class="numeric">28.210%</td><td class="numeric">2.630%</td></tr></tbody></table></div><div class="mini-chart ${anchorClass("chart",false)}" data-action="select-anchor" data-anchor="chart">${evidenceButton("chart")}<div class="chart-col"><span style="height:76%"></span><small>融通</small></div><div class="chart-col"><span style="height:68%"></span><small>启明</small></div><div class="chart-col"><span style="height:62%"></span><small>嘉禾</small></div><div class="chart-col"><span style="height:48%"></span><small>欧陆</small></div><div class="chart-col"><span style="height:39%"></span><small>寰宇</small></div><div class="chart-col"><span style="height:34%"></span><small>海联</small></div></div></section>
      <section class="report-section" id="anchor-rules"><h2>5. Rule 风险结论</h2><div class="rule-box ${anchorClass("rule",false)}" data-action="select-anchor" data-anchor="rule">${evidenceButton("rule")}<div class="rule-box-head"><div><h3>R01 · 融资成本偏高</h3><p>单位553 命中“高成本余额占比超过 20%”分支</p></div>${badge("警告","已命中")}</div><div class="rule-evidence-grid"><div><span>Rule 版本</span><strong>Published 2.4</strong></div><div><span>评估时间</span><strong>2026-01-02 09:18</strong></div><div><span>指标值</span><strong>77.337%</strong></div><div><span>阈值</span><strong>&gt; 20%</strong></div></div></div><p>Rule 结论直接引用已发布 Rule 的评估事实。报告助手可以解释触发原因，但不能重评 Rule 或改变命中结论。</p></section>
      <section class="report-section" id="anchor-trust"><h2>6. 数据可信度</h2><div class="report-table-wrap ${anchorClass("trust",false)}" data-action="select-anchor" data-anchor="trust">${evidenceButton("trust")}<table class="report-table"><tbody><tr><th>Published 语义版本</th><td>${esc(report.semanticVersion)}</td><th>数据版本</th><td>${esc(report.dataVersion)}</td></tr><tr><th>数据截至时间</th><td>${esc(report.asOf)}</td><th>消费状态</th><td>${badge("可消费")}</td></tr><tr><th>质量</th><td>通过 · 2 项提示</td><th>新鲜度</th><td>${badge("警告","陈旧 · 12 天")}</td></tr></tbody></table></div><p>数据工程只提供版本、时点、质量、新鲜度、消费就绪及可复现性事实；报告业务指标仍经 Published 本体及权威消费绑定读取。</p></section>
      <section class="report-section" id="anchor-attachments"><h2>附件 · 证据范围</h2>${mismatch ? `<p class="${anchorClass("attachment",true)}" data-action="select-anchor" data-anchor="attachment">${evidenceButton("attachment")}附件 A 引用了“2024 年利率结构补充说明”，但原 Property 版本与数据定位已无法解析。系统不会使用当前定义替代原版本。</p>` : `<p>正式内容共 26 个事实项，均已建立稳定锚点与结构化证据绑定；无结构化证据的历史补充说明已从新内容版本移除。</p>`}<div class="footnote">报告中心仅保存报告内容、锚点、证据包及复核结论；Agent 运行、会话和解释结果由 Agent 应用维护。本报告发布不会改变本体定义或正式数据绑定。</div></section>
    </article></div></section>`;
  }

  function renderAssistant(report) {
    return `<aside class="assistant-pane ${state.assistantOpen ? "open" : ""}"><div class="assistant-tabs"><button class="${state.assistantTab === "qa" ? "active" : ""}" data-action="assistant-tab" data-tab="qa">报告问答</button><button class="${state.assistantTab === "verify" ? "active" : ""}" data-action="assistant-tab" data-tab="verify">自动核验</button></div>${state.assistantTab === "qa" ? renderQA(report) : renderVerification(report)}</aside>`;
  }

  function contextLabel() {
    const evidence = DATA.evidence[state.selectedAnchor] || DATA.evidence.summary;
    return evidence.location;
  }

  function renderQA(report) {
    return `<div class="assistant-body"><div class="assistant-context"><div class="assistant-context-head"><strong>本轮上下文</strong><span>${esc(report.contentVersion)} · 固定证据</span></div><div class="context-chip">${icon("scan-text","sm")}<span>${esc(contextLabel())}</span><button class="icon-button" data-action="open-evidence" data-anchor="${esc(state.selectedAnchor)}" title="查看上下文证据">${icon("link-2","sm")}</button></div><button class="compare-switch ${state.compareCurrent ? "active" : ""}" data-action="toggle-compare"><span><strong>与当前数据比较</strong><small style="display:block;color:var(--muted)">${state.compareCurrent ? "报告快照与当前 T019 分列，不改写报告" : "默认只基于报告生成时的固定证据"}</small></span><i class="switch"></i></button></div><div class="assistant-scroll" id="assistant-scroll">${state.messages.length ? state.messages.map(renderMessage).join("") : `<div class="assistant-empty">${icon("message-square-text","lg")}<strong>基于证据阅读这份报告</strong><span>选择正文位置后提问，回答会引用报告锚点与精确版本。</span><div class="suggestions"><button class="suggestion" data-action="ask-suggestion" data-question="这段结论用了哪些指标和 Rule？">这段结论用了哪些指标和 Rule？</button><button class="suggestion" data-action="ask-suggestion" data-question="为什么浮动利率敞口值得关注？">为什么浮动利率敞口值得关注？</button><button class="suggestion" data-action="ask-suggestion" data-question="当前证据有哪些限制？">当前证据有哪些限制？</button></div></div>`}</div><div class="assistant-compose"><div class="compose-box"><textarea data-field="qaInput" placeholder="针对当前报告位置提问">${esc(state.qaInput)}</textarea><div class="compose-actions"><span>解释结果由 Agent 应用保存</span><button class="btn primary" data-action="send-question" ${!state.qaInput.trim() ? "disabled" : ""}>${icon("arrow-up","sm")}发送</button></div></div></div></div>`;
  }

  function renderMessage(message) {
    if (message.role === "user") return `<div class="message user"><div class="message-bubble"><p>${esc(message.text)}</p></div><span class="message-meta">${esc(message.time)}</span></div>`;
    if (message.status === "处理中") return `<div class="message"><div class="message-bubble"><p>${icon("loader-circle","sm")} 正在读取固定证据与 Agent 权威运行状态…</p></div><span class="message-meta">Agent Run 处理中</span></div>`;
    return `<div class="message"><div class="message-bubble"><p>${message.html}</p>${message.limit ? `<div class="limitation">${esc(message.limit)}</div>` : ""}<div class="citation-row">${message.citations.map((item) => `<button class="citation" data-action="select-anchor" data-anchor="${item.anchor}">${esc(item.label)}</button>`).join("")}</div></div><span class="message-meta">${esc(message.runId)} · ${esc(message.time)} · ${esc(message.status)}</span></div>`;
  }

  function renderVerification(report) {
    const verification = report.verification;
    const results = verification.results || [];
    const counts = ["通过","警告","失败","无法核验"].reduce((acc,status) => { acc[status] = results.filter((item) => item.status === status).length; return acc; }, {});
    return `<div class="assistant-body"><div class="assistant-context"><div class="assistant-context-head"><strong>T049 确定性核验</strong>${badge(verification.status)}</div><div class="context-chip">${icon("scan-text","sm")}<span>范围：整份报告 · ${esc(report.contentVersion)}</span></div></div><div class="assistant-scroll">${verification.status === "未运行" ? `<div class="verify-toolbar"><h3>核验报告内容与固定证据</h3><p>确定性比对先于 LLM 解释；运行结果不会自动替代人工确认。</p><button class="btn primary full" data-action="start-verification">${icon("shield-check","sm")}开始自动核验</button></div><div class="verification-note">将检查证据完整性、数值、语义、版本兼容、可信度披露、Rule 结论、跨区域一致性及无绑定内容。</div>` : verification.status === "处理中" ? `<div class="assistant-empty">${icon("loader-circle","lg")}<strong>正在执行确定性比对</strong><span>当前运行只读取报告内容、锚点、证据包和各 Owner 权威事实。</span><div class="progress" style="width:100%"><span style="width:62%"></span></div></div>` : `<div class="verify-summary"><div><strong>${counts["通过"] || 0}</strong><span>通过</span></div><div><strong>${counts["警告"] || 0}</strong><span>警告</span></div><div><strong>${counts["失败"] || 0}</strong><span>失败</span></div><div><strong>${counts["无法核验"] || 0}</strong><span>无法核验</span></div></div>${results.map((item) => renderCheckResult(item, report)).join("")}<button class="btn soft full" data-action="start-verification">${icon("refresh-cw","sm")}重新核验当前内容版本</button>`}</div><div class="assistant-compose"><div class="verification-note">自动核验四态归报告中心；LLM 仅通过独立 Agent Run 解释差异，不改变四态。</div></div></div>`;
  }

  function renderCheckResult(item, report) {
    const active = state.selectedCheck === item.id;
    const explanation = report.explanations && report.explanations[item.id];
    return `<article class="check-result ${active ? "active" : ""}"><button class="check-result-head" data-action="select-check" data-check="${item.id}" data-anchor="${item.anchor}">${badge(item.status)}<span><strong>${esc(item.name)}</strong><small>${esc(item.issue)}</small></span>${icon(active ? "chevron-up" : "chevron-down","sm")}</button>${active ? `<div class="check-result-detail"><div class="detail-line"><span>报告位置</span><strong>${esc((DATA.evidence[item.anchor] || {}).location || item.anchor)}</strong></div><div class="detail-line"><span>权威证据</span><strong>${esc(item.authority)}</strong></div><div class="detail-line"><span>版本</span><strong>${esc(item.version)}</strong></div><div class="detail-line"><span>影响</span><strong>${esc(item.impact)}</strong></div><div class="detail-line"><span>建议</span><strong>${esc(item.suggestion)}</strong></div><div class="button-row"><button class="btn ghost" data-action="open-evidence" data-anchor="${item.anchor}">${icon("link-2","sm")}打开证据</button>${["失败","无法核验","警告"].includes(item.status) ? `<button class="btn soft" data-action="explain-check" data-check="${item.id}">${icon("bot","sm")}${explanation === "处理中" ? "解释中" : "解释差异"}</button><button class="btn soft" data-action="create-issue" data-check="${item.id}">${icon("list-plus","sm")}创建复核问题</button>` : ""}</div>${explanation ? `<div class="agent-explanation"><strong>${icon("bot","sm")}独立核验解释 · ${explanation === "处理中" ? "处理中" : "受限完成"}</strong><p>${explanation === "处理中" ? "Agent 应用正在读取本检查项、报告锚点和固定证据包。" : "差异来自报告摘要的文本值与绑定 Metric 快照不一致。建议重新生成内容，不应修改或重新解释权威 Metric；该说明不改变“" + item.status + "”四态。"}</p></div>` : ""}${report.hasMismatch && ["numeric","cross","evidence","unbound"].includes(item.id) ? `<button class="btn primary full" style="margin-top:7px" data-action="open-regenerate">${icon("refresh-cw","sm")}基于问题生成新内容版本</button>` : ""}</div>` : ""}</article>`;
  }

  function renderModal() {
    if (!state.modal) return "";
    const modal = state.modal;
    if (modal.type === "create") return renderCreateModal();
    if (modal.type === "reset") return renderResetModal();
    if (modal.type === "manual") return renderManualModal();
    if (modal.type === "regenerate") return renderRegenerateModal();
    if (modal.type === "publish-running" || modal.type === "publish-failed" || modal.type === "publish-success") return renderPublishModal();
    if (modal.type === "withdraw") return renderWithdrawModal();
    if (modal.type === "history") return renderHistoryModal();
    if (modal.type === "export" || modal.type === "export-running" || modal.type === "export-failed" || modal.type === "export-success") return renderExportModal();
    if (modal.type === "fixed-preview") return renderFixedPreviewModal();
    if (modal.type === "help") return renderHelpModal();
    return "";
  }

  function modalShell(title, subtitle, body, footer, cls) {
    return `<div class="modal-backdrop"><section class="modal ${cls || ""}" role="dialog" aria-modal="true"><header><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-button" data-action="close-modal" title="关闭">${icon("x")}</button></header><div class="modal-body">${body}</div><footer>${footer}</footer></section></div>`;
  }

  function renderCreateModal() {
    const step = state.wizard.step;
    const labels = ["报告类型","基本信息","业务范围","语义资源","数据上下文","提交生成"];
    let body = `<ol class="wizard-steps">${labels.map((label,index) => `<li class="${index + 1 === step ? "active" : index + 1 < step ? "done" : ""}"><span>${index + 1}</span>${label}</li>`).join("")}</ol>`;
    if (step === 1) body += renderWizardType();
    if (step === 2) body += renderWizardBasic();
    if (step === 3) body += renderWizardScope();
    if (step === 4) body += renderWizardSemantic();
    if (step === 5) body += renderWizardData();
    if (step === 6) body += renderWizardReview();
    const canNext = wizardCanNext();
    const footer = `${step > 1 ? `<button class="btn ghost" data-action="wizard-back">上一步</button>` : ""}<button class="btn ${step === 6 ? "primary" : "soft"}" data-action="wizard-next" ${!canNext ? "disabled" : ""}>${step === 6 ? `${icon("sparkles","sm")}提交生成` : `下一步${icon("arrow-right","sm")}`}</button>`;
    return modalShell("创建报告 Draft", "从获准资源形成一次可追溯的报告生成请求", body, footer, "wide");
  }

  function renderWizardType() {
    const type = DATA.reportTypes[0];
    return `<div class="readonly-callout">${icon("shield-check","sm")}仅显示已具备报告定义、模板、Published 语义与数据接入合同的报告类型。</div><div class="choice-grid"><button class="choice-card selected" data-action="choose-type" data-type="${type.id}">${icon("landmark")}<strong>${esc(type.name)}</strong><span>${esc(type.description)}</span><span class="badge info">${type.scene}</span></button></div>`;
  }

  function renderWizardBasic() {
    const type = DATA.reportTypes[0];
    return `<div class="form-grid"><div class="field full"><label>报告名称</label><input class="input" data-field="wizard.title" value="${esc(state.wizard.title)}"><small>名称只描述本次报告，不改变报告定义或模板。</small></div><div class="field"><label>报告定义（只读引用）</label><input class="input" value="${esc(type.definition)} · ${esc(type.definitionVersion)}" readonly></div><div class="field"><label>报告模板（只读引用）</label><input class="input" value="${esc(type.template)} · ${esc(type.templateVersion)}" readonly></div><div class="field full"><label>内容生成能力（只读引用）</label><input class="input" value="${esc(type.agentRelease)}" readonly><small>Agent 配置、Skill、工具权限与运行记录归 Agent 应用；报告中心只引用获准 Release。</small></div></div>`;
  }

  function renderWizardScope() {
    return `<div class="form-grid"><div class="field"><label>报告范围</label><select class="select" data-field="wizard.scope"><option ${state.wizard.scope === "集团" ? "selected" : ""}>集团</option><option ${state.wizard.scope === "单位" ? "selected" : ""}>单位</option></select></div><div class="field"><label>单一业务主体</label><select class="select" data-field="wizard.subject"><option ${state.wizard.subject === "集团合并口径" ? "selected" : ""}>集团合并口径</option><option ${state.wizard.subject === "单位553" ? "selected" : ""}>单位553</option><option ${state.wizard.subject === "单位465" ? "selected" : ""}>单位465</option></select></div><div class="field full"><label>报告目的</label><textarea class="textarea" readonly>向集团管理层说明融资规模、成本、债务结构、金融机构分布与已发布 Rule 风险结论，形成可复核、可发布的固定报告。</textarea></div></div>`;
  }

  function renderWizardSemantic() {
    return `<div class="readonly-callout">${icon("lock-keyhole","sm")}Object、Property、Metric、Rule、Link 与 Action Type 均由本体管理发布。报告中心与 Agent 只能读取、选择和引用，不能创建、重新解释或切换权威版本；本报告仅列出实际需要的资源。</div><div class="resource-list">${DATA.semanticResources.map((item) => `<label class="resource-row"><input type="checkbox" data-resource="${item.id}" ${state.wizard.resources.includes(item.id) ? "checked" : ""}><span><strong>${esc(item.kind)} · ${esc(item.name)}</strong><span>${esc(item.id)} · ${esc(item.version)}</span></span>${item.required ? badge("必填","必需") : badge("plain","可选")}</label>`).join("")}</div>`;
  }

  function renderWizardData() {
    const context = getContext();
    return `<div class="readonly-callout">${icon("database","sm")}报告中心只读选择正式数据上下文。数据工程提供版本、时点、质量、新鲜度、消费就绪和可复现性事实，不向报告中心直供业务明细。</div><div class="field"><label>正式数据上下文</label><select class="select" data-field="wizard.dataChoice">${DATA.dataContexts.map((item) => `<option value="${item.id}" ${state.wizard.dataChoice === item.id ? "selected" : ""}>${esc(item.name)} · ${esc(item.dataVersion)}</option>`).join("")}</select></div><div class="review-grid" style="margin-top:10px"><div><span>Published 语义</span><strong>${esc(context.semantic)}</strong></div><div><span>精确数据版本</span><strong>${esc(context.dataVersion)}</strong></div><div><span>数据截至</span><strong>${esc(context.asOf)}</strong></div><div><span>质量</span><strong>${esc(context.quality)}</strong></div><div><span>新鲜度</span><strong>${esc(context.freshness)}</strong></div><div><span>消费状态</span><strong>${esc(context.readiness)}</strong></div></div><div class="compat-box"><div class="status-row" style="justify-content:space-between"><div><h3>版本组合检查</h3><p>${esc(state.wizard.compatMessage)}</p></div>${badge(state.wizard.compatStatus)}</div><button class="btn soft" data-action="validate-compat">${icon("shield-check","sm")}验证版本兼容性</button></div>`;
  }

  function renderWizardReview() {
    const type = DATA.reportTypes[0];
    const context = getContext();
    return `<div class="readonly-callout">${icon("circle-check-big","sm")}提交后先形成生成请求和固定证据包，再调用独立 Agent Run 生成结构化内容。成功前不会出现草稿或报告编号。</div><div class="review-grid"><div><span>报告名称</span><strong>${esc(state.wizard.title)}</strong></div><div><span>场景与主体</span><strong>${type.scene} · ${esc(state.wizard.subject)}</strong></div><div><span>报告定义 / 模板</span><strong>${type.definitionVersion} / ${type.templateVersion}</strong></div><div><span>Published 语义</span><strong>${esc(context.semantic)}</strong></div><div><span>数据版本 / 截止</span><strong>${esc(context.dataVersion)} / ${esc(context.asOf)}</strong></div><div><span>可信度</span><strong>${esc(context.quality)} · ${esc(context.freshness)}</strong></div><div><span>语义资源</span><strong>${state.wizard.resources.length} 项获准引用</strong></div><div><span>兼容性检查</span><strong>${esc(state.wizard.compatStatus)}</strong></div></div>`;
  }

  function wizardCanNext() {
    if (state.wizard.step === 2) return state.wizard.title.trim().length > 4;
    if (state.wizard.step === 4) return DATA.semanticResources.filter((item) => item.required).every((item) => state.wizard.resources.includes(item.id));
    if (state.wizard.step === 5) return ["通过","警告"].includes(state.wizard.compatStatus);
    return true;
  }

  function renderResetModal() {
    return modalShell("重置状态", "清除本入口中由操作产生的报告、运行和复核记录", `<div class="readonly-callout">${icon("rotate-ccw","sm")}重置只影响当前报告中心入口的本地状态，不改变本体、数据工程、Agent 应用或决策中心的权威事实。</div><p>重置后将返回空报告目录，可重新体验创建、生成失败与重试、核验、人工确认、发布、导出和历史追溯流程。</p>`, `<button class="btn ghost" data-action="close-modal">取消</button><button class="btn danger" data-action="confirm-reset">确认重置</button>`, "small");
  }

  function renderManualModal() {
    const report = getReport();
    const checks = report.manualChecks || [false,false,false];
    return modalShell("人工检查", "人工结论与自动核验结果分开保存", `<div class="readonly-callout">${icon("user-check","sm")}自动核验为 ${esc(report.verification.status)}。人工检查不会把警告改成通过，也不会修改权威语义或证据。</div><div class="manual-list"><div class="manual-item"><label><input type="checkbox" data-manual="0" ${checks[0] ? "checked" : ""}>已核对管理摘要、正文、表格与 Rule 风险结论</label><p>确认业务表达没有超出绑定证据。</p></div><div class="manual-item"><label><input type="checkbox" data-manual="1" ${checks[1] ? "checked" : ""}>已阅读并接受数据陈旧提示</label><p>报告仍按生成时快照发布；如需当前判断，使用显式快照比较。</p></div><div class="manual-item"><label><input type="checkbox" data-manual="2" ${checks[2] ? "checked" : ""}>已确认正式 HTML 与 PDF 共享同一内容版本和证据链</label><p>发布后两种呈现均冻结，不能原地修改。</p></div></div>`, `<button class="btn ghost" data-action="close-modal">取消</button><button class="btn success" data-action="save-manual" ${checks.every(Boolean) ? "" : "disabled"}>完成人工检查</button>`, "small");
  }

  function renderRegenerateModal() {
    const report = getReport();
    return modalShell("生成新内容版本", "基于当前固定证据与复核问题重新生成，不修改原内容版本", `<div class="review-grid"><div><span>原内容版本</span><strong>${esc(report.contentVersion)} · 保留只读</strong></div><div><span>新内容版本</span><strong>${nextContentVersion(report.contentVersion)}</strong></div><div><span>固定证据包</span><strong>${esc(report.evidencePackage)}</strong></div><div><span>复核问题</span><strong>${state.issues.filter((item) => item.reportId === report.id).length || 1} 项</strong></div></div><div class="readonly-callout" style="margin-top:10px">${icon("shield-check","sm")}重新生成只创建新的 Agent Run 和报告内容版本；原核验运行、解释结果和草稿均保留。</div>`, `<button class="btn ghost" data-action="close-modal">取消</button><button class="btn primary" data-action="start-regenerate">${icon("refresh-cw","sm")}开始生成</button>`, "small");
  }

  function renderPublishModal() {
    const modal = state.modal;
    if (modal.type === "publish-running") return modalShell("正在发布", "形成同一正式产物的 HTML 阅读版与 PDF 固定版", `<div class="assistant-empty" style="min-height:220px">${icon("loader-circle","lg")}<strong>正在冻结内容版本与证据链</strong><span>报告编号仅在正式产物创建成功后分配。</span><div class="progress" style="width:100%"><span style="width:68%"></span></div></div>`, `<button class="btn ghost" disabled>发布处理中</button>`, "small");
    if (modal.type === "publish-failed") return modalShell("发布失败", "草稿仍保持已确认状态，未进入正式报告目录", `<div class="error-box"><strong>PDF 固定呈现任务未完成</strong><br>内容版本和证据链均未改变；HTML 也未标记为正式发布。</div><div class="readonly-callout" style="margin-top:10px">${icon("refresh-cw","sm")}可重试同一发布请求，无需重新生成报告内容。</div>`, `<button class="btn ghost" data-action="close-modal">稍后处理</button><button class="btn primary" data-action="retry-publish">重试发布</button>`, "small");
    const report = getReport();
    return modalShell("发布完成", "HTML 与 PDF 已共享同一正式报告编号、内容版本和证据链", `<div class="review-grid"><div><span>正式报告编号</span><strong>${esc(report.reportNo)}</strong></div><div><span>内容版本</span><strong>${esc(report.contentVersion)}</strong></div><div><span>HTML 阅读版</span><strong>已冻结</strong></div><div><span>PDF 固定版</span><strong>已冻结</strong></div></div>`, `<button class="btn primary" data-action="close-modal">查看正式报告</button>`, "small");
  }

  function renderWithdrawModal() {
    return modalShell("撤回正式报告", "撤回不删除或改写已发布内容和历史证据", `<div class="field"><label>撤回原因</label><textarea class="textarea" data-field="withdrawReason" placeholder="请填写业务可读的撤回原因">${esc(state.modal.reason || "")}</textarea><small>撤回后旧 HTML/PDF 仍可从历史版本追溯，但正式目录会显示“已撤回”。</small></div>`, `<button class="btn ghost" data-action="close-modal">取消</button><button class="btn danger" data-action="confirm-withdraw" ${!(state.modal.reason || "").trim() ? "disabled" : ""}>确认撤回</button>`, "small");
  }

  function renderHistoryModal() {
    const report = getReport();
    const rows = report.history || [];
    return modalShell("历史版本", "旧内容和正式产物按生成时精确语义与数据版本追溯", `<div class="history-list">${rows.length ? rows.slice().reverse().map((item) => `<article class="history-row"><div><h3>${esc(item.label)}</h3><p>${esc(item.time)} · ${esc(item.semantic)} · ${esc(item.data)}</p><div class="status-row" style="margin-top:6px">${badge(item.status)}${item.frozen ? badge("已发布","已冻结") : ""}</div></div><div class="history-actions">${item.evidence === "unavailable" ? `<button class="btn soft" data-action="open-history-evidence" data-anchor="attachment">打开证据</button>` : `<button class="btn soft" data-action="open-history-evidence" data-anchor="cover">打开证据</button>`}</div></article>`).join("") : `<div class="empty-state" style="min-height:220px"><div class="empty-icon">${icon("history","lg")}</div><h2>暂无历史版本</h2><p>重新生成或发布后，旧内容版本会保留在此。</p></div>`}</div>`, `<button class="btn primary" data-action="close-modal">关闭</button>`, "wide");
  }

  function renderExportModal() {
    const modal = state.modal;
    if (modal.type === "export-running") return modalShell("正在生成固定呈现", "导出任务引用当前正式报告编号和内容版本", `<div class="assistant-empty" style="min-height:220px">${icon("loader-circle","lg")}<strong>正在准备 PDF 固定版</strong><span>不会重新读取当前数据或重新渲染报告内容。</span><div class="progress" style="width:100%"><span style="width:60%"></span></div></div>`, `<button class="btn ghost" disabled>导出处理中</button>`, "small");
    if (modal.type === "export-failed") return modalShell("导出失败", "正式报告未受影响", `<div class="error-box"><strong>固定版文件暂时无法取得</strong><br>导出任务失败不会修改已发布 HTML、内容版本或证据链。</div>`, `<button class="btn ghost" data-action="close-modal">关闭</button><button class="btn primary" data-action="retry-export">重试导出</button>`, "small");
    if (modal.type === "export-success") return modalShell("固定版已准备", "与系统内 HTML 共享同一正式报告编号、内容版本和证据链", `<div class="review-grid"><div><span>报告编号</span><strong>${esc(getReport().reportNo)}</strong></div><div><span>内容版本</span><strong>${esc(getReport().contentVersion)}</strong></div><div><span>呈现</span><strong>PDF 固定版</strong></div><div><span>证据链</span><strong>${esc(getReport().evidencePackage)}</strong></div></div>`, `<button class="btn ghost" data-action="close-modal">关闭</button><button class="btn primary" data-action="open-fixed">打开固定版</button>`, "small");
    return modalShell("导出正式报告", "创建一次可恢复的固定呈现任务", `<div class="choice-grid"><button class="choice-card selected" data-action="start-export">${icon("file-down")}<strong>PDF 固定版</strong><span>与 HTML 共享报告编号、内容版本和证据链，可用于归档和打印。</span></button><button class="choice-card" data-action="print-fixed">${icon("printer")}<strong>打印视图</strong><span>打开浏览器打印流程，不改变正式报告。</span></button></div>`, `<button class="btn ghost" data-action="close-modal">关闭</button>`, "small");
  }

  function renderFixedPreviewModal() {
    const report = getReport();
    return modalShell("PDF 固定版", `${report.reportNo} · ${report.contentVersion} · ${report.evidencePackage}`, `<div class="fixed-preview"><article class="fixed-page"><div class="eyebrow">${esc(report.scene)} · 正式报告</div><h1>${esc(report.title)}</h1><p>报告编号：${esc(report.reportNo)}<br>内容版本：${esc(report.contentVersion)}<br>Published 语义：${esc(report.semanticVersion)}<br>数据版本：${esc(report.dataVersion)}<br>数据截至：${esc(report.asOf)}</p><hr><h2>管理摘要</h2><p>集团融资余额为 21,613.39 亿元，综合融资成本为 2.372%，浮动利率融资占比为 95.1%。</p><p class="footnote">本固定呈现与系统内 HTML 共享同一内容和证据链。</p></article></div>`, `<button class="btn ghost" data-action="close-modal">关闭</button><button class="btn primary" data-action="print-fixed">${icon("printer","sm")}打印</button>`, "wide");
  }

  function renderHelpModal() {
    return modalShell("报告中心使用帮助", "内容工作区支持低跳转的报告阅读、核验和复核", `<div class="timeline"><div class="timeline-item"><strong>创建并生成</strong><span>选择报告类型、获准 Published 资源和正式数据上下文。</span></div><div class="timeline-item"><strong>选择正文位置</strong><span>章节、段落、数值、单元格、图表和 Rule 可打开精确证据。</span></div><div class="timeline-item"><strong>自动核验与人工检查</strong><span>确定性四态、LLM 差异解释与人工结论保持分离。</span></div><div class="timeline-item"><strong>发布与追溯</strong><span>HTML/PDF 同源冻结；新内容形成新版本，旧报告继续按原版本追溯。</span></div></div>`, `<button class="btn primary" data-action="close-modal">知道了</button>`, "small");
  }

  function renderDrawer() {
    if (!state.drawer) return "";
    const evidence = DATA.evidence[state.drawer.anchor] || DATA.evidence.summary;
    const metric = evidence.metric ? DATA.metricMeta[evidence.metric] : null;
    return `<aside class="drawer" aria-label="证据追溯"><div class="drawer-head"><div><h2>证据追溯</h2><p>${esc(evidence.location)}</p></div><button class="icon-button" data-action="close-drawer">${icon("x")}</button></div><div class="drawer-body">${evidence.unavailable ? `<div class="error-box"><strong>历史资源不可定位</strong><br>原 Published 版本或数据版本已无法解析。系统不会改用当前定义、当前 Published 或当前数据冒充。</div>` : ""}<div class="trace-step" data-index="1"><strong>${esc(evidence.kind)} · ${esc(evidence.fact)}</strong><span>${esc(evidence.location)}</span><span class="owner-chip">Owner：报告中心</span><small>稳定锚点 ${esc(state.drawer.anchor)}</small></div><div class="trace-step" data-index="2"><strong>生成证据包</strong><span>${getReport() ? esc(getReport().evidencePackage) : "待生成"}</span><span class="owner-chip">Owner：报告中心</span><small>固定报告定义、模板、语义与数据上下文</small></div><div class="trace-step" data-index="3"><strong>${esc(evidence.semantic)}</strong><span>${esc(evidence.unavailable ? "原版本解析失败，责任位置已披露" : "稳定资源标识与生成时精确 Published 版本")}</span><span class="owner-chip">Owner：本体管理</span><small>报告中心与 Agent 只读引用，不创建或重新解释</small></div><div class="trace-step" data-index="4"><strong>${esc(evidence.data)}</strong><span>数据截至 ${esc(evidence.asOf)} · ${esc(evidence.quality)}</span><span class="owner-chip">Owner：数据工程（可信度事实）</span><small>不通过可信度合同读取业务明细或重算指标</small></div><h3 style="font-size:13px;margin:16px 0 8px">证据披露</h3><div class="metadata-grid"><div><span>定位状态</span><strong>${esc(evidence.status)}</strong></div><div><span>报告位置</span><strong>${esc(evidence.location)}</strong></div><div><span>语义证据</span><strong>${esc(evidence.semantic)}</strong></div><div><span>数据版本</span><strong>${esc(evidence.data)}</strong></div></div>${metric ? `<h3 style="font-size:13px;margin:16px 0 8px">指标元数据</h3><div class="metadata-grid"><div><span>名称</span><strong>${esc(metric.name)}</strong></div><div><span>单位</span><strong>${esc(metric.unit)}</strong></div><div><span>定义</span><strong>${esc(metric.definition)}</strong></div><div><span>适用对象</span><strong>${esc(metric.object)}</strong></div><div><span>筛选与时间范围</span><strong>${esc(metric.filters)}</strong></div><div><span>有效期</span><strong>${esc(metric.valid)}</strong></div><div><span>Published 版本</span><strong>${esc(metric.semantic)}</strong></div></div>` : ""}<div class="readonly-callout" style="margin-top:12px">${icon("lock-keyhole","sm")}报告助手只能读取和解释此证据，不能修改权威语义、切换版本、发布报告或执行 Action。</div></div></aside>`;
  }

  function render() {
    const mainContent = state.route === "workspace" ? renderWorkspace() : state.route === "review" ? renderReviewQueue() : state.route === "generation" ? renderGeneration() : renderDirectory();
    $("#app").innerHTML = `<div class="app-shell">${renderRail()}${renderProductNav()}<section class="app-workspace">${renderTopbar()}${mainContent}</section></div>${renderModal()}${renderDrawer()}`;
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    save();
  }

  function toast(message) {
    const root = $("#toast-root");
    root.innerHTML = `<div class="toast">${esc(message)}</div>`;
    setTimeout(() => { root.innerHTML = ""; }, 2600);
  }

  function navigate(route, push) {
    state.route = route;
    if (push !== false) history.pushState({ route }, "", route === "directory" ? "#directory" : `#${route}`);
    render();
  }

  function newReportObject() {
    const context = getContext();
    return {
      id: generatedId("RPT-DRAFT"),
      title: state.wizard.title,
      scene: "S001",
      status: "草稿待复核",
      contentVersion: "C01",
      semanticVersion: context.semantic,
      dataVersion: context.dataVersion,
      asOf: context.asOf,
      quality: context.quality,
      freshness: context.freshness,
      evidencePackage: generatedId("EP"),
      generatedAt: nowText(),
      verification: { status:"未运行", results:[], runId:null },
      manualReviewed: false,
      manualChecks: [false,false,false],
      hasMismatch: true,
      frozen: false,
      reportNo: null,
      explanations: {},
      publishAttempts: 0,
      exportAttempts: 0,
      history: []
    };
  }

  function nextContentVersion(version) {
    const current = Number(String(version).replace(/\D/g,"")) || 0;
    return `C${String(current + 1).padStart(2,"0")}`;
  }

  function startGeneration(isRetry, isRegeneration) {
    clearTimers();
    const current = getReport();
    const priorAttempt = state.generation ? state.generation.attempt : 0;
    const attempt = isRetry ? priorAttempt + 1 : 1;
    state.modal = null;
    state.generation = {
      status: "处理中",
      steps: ["处理中","未开始","未开始","未开始"],
      progress: 12,
      attempt,
      isRegeneration: !!isRegeneration,
      reportId: current ? current.id : null,
      title: current ? current.title : state.wizard.title
    };
    navigate("generation");
    later(() => { state.generation.steps = ["已完成","处理中","未开始","未开始"]; state.generation.progress=34; render(); }, 500);
    later(() => { state.generation.steps = ["已完成","已完成","处理中","未开始"]; state.generation.progress=58; render(); }, 1000);
    later(() => {
      if (!state.generation.isRegeneration && state.generation.attempt === 1) {
        state.generation.steps = ["已完成","已完成","失败","未开始"];
        state.generation.status = "失败";
        state.generation.error = "Agent 内容生成运行超时，报告中心已收到失败回执";
        state.generation.progress = 58;
        render();
        return;
      }
      state.generation.steps = ["已完成","已完成","已完成","处理中"];
      state.generation.progress=82;
      render();
      later(completeGeneration, 650);
    }, 1600);
  }

  function completeGeneration() {
    const generation = state.generation;
    generation.steps = ["已完成","已完成","已完成","已完成"];
    generation.status = "已完成";
    generation.progress = 100;
    if (generation.isRegeneration) {
      const report = state.reports.find((item) => item.id === generation.reportId);
      report.history.push({ label:`内容版本 ${report.contentVersion}`, time:nowText(), semantic:report.semanticVersion, data:report.dataVersion, status:"核验失败", evidence:"unavailable", frozen:false });
      report.contentVersion = nextContentVersion(report.contentVersion);
      report.generatedAt = nowText();
      report.status = "草稿待复核";
      report.hasMismatch = false;
      report.manualReviewed = false;
      report.manualChecks = [false,false,false];
      report.verification = { status:"未运行", results:[], runId:null };
      report.explanations = {};
      state.selectedReportId = report.id;
      state.selectedAnchor = "summary";
      state.selectedCheck = null;
      state.assistantTab = "verify";
      state.issues.filter((item) => item.reportId === report.id).forEach((item) => { item.status = "已解决"; });
    } else {
      const report = newReportObject();
      state.reports.unshift(report);
      state.selectedReportId = report.id;
      state.selectedAnchor = "summary";
      state.assistantTab = "qa";
    }
    later(() => { state.generation = null; navigate("workspace"); toast(generation.isRegeneration ? "新内容版本已生成，原版本已保留" : "报告草稿已生成，等待自动核验与人工复核"); }, 350);
  }

  function startVerification() {
    const report = getReport();
    if (!report) return;
    report.verification = { status:"处理中", results:[], runId:generatedId("T049-RUN") };
    state.assistantTab = "verify";
    state.selectedCheck = null;
    render();
    later(() => {
      report.verification.results = JSON.parse(JSON.stringify(report.hasMismatch ? DATA.verificationBad : DATA.verificationFixed));
      report.verification.status = report.hasMismatch ? "失败" : "警告";
      render();
      toast(report.hasMismatch ? "自动核验发现阻断问题，请定位后处理" : "自动核验完成：7 项通过，1 项警告");
    }, 1200);
  }

  function sendQuestion(question) {
    const report = getReport();
    if (!report || !question.trim()) return;
    const runId = generatedId("AG-RUN");
    state.messages.push({ role:"user", text:question.trim(), time:nowText() });
    state.messages.push({ role:"assistant", status:"处理中", runId, time:nowText() });
    state.qaInput = "";
    render();
    later(() => {
      const index = state.messages.findIndex((item) => item.runId === runId && item.status === "处理中");
      if (index < 0) return;
      const evidence = DATA.evidence[state.selectedAnchor] || DATA.evidence.summary;
      const compare = state.compareCurrent;
      state.messages[index] = {
        role:"assistant",
        status: evidence.unavailable ? "受限完成" : "已完成",
        runId,
        time:nowText(),
        html: evidence.unavailable
          ? `我能确认该内容引用了 <strong>${esc(evidence.semantic)}</strong>，但原版本证据已无法定位，因此不能用当前定义补答原结论。`
          : compare
            ? `报告快照使用 <strong>${esc(report.dataVersion)}</strong>（截至 ${esc(report.asOf)}）。显式比较记录显示当前兼容数据的融资余额较报告快照增加 231.60 亿元、综合融资成本上升 0.03 个百分点；这是确定性比较记录的结果，我只解释差异，不重算指标。`
            : `当前位置引用 <strong>${esc(evidence.semantic)}</strong>，数据版本为 <strong>${esc(evidence.data)}</strong>、截至 <strong>${esc(evidence.asOf)}</strong>。${evidence.kind === "Rule 结论" ? "R01 的命中分支、指标值与阈值均来自生成时固定的 Rule 评估证据。" : "该结论只基于报告生成时的固定证据，不会随当前数据静默变化。"}`,
        limit: evidence.unavailable ? "证据不足：历史资源不可定位。系统不会猜测或使用当前 Published 版本冒充。" : compare ? "当前数据质量含提示；比较不会改写已发布报告或改变其核验结论。" : "如需当前经营状态，请显式打开“与当前数据比较”。",
        citations: [{ anchor:state.selectedAnchor, label:evidence.location }, { anchor:"trust", label:`${report.dataVersion} · ${report.asOf}` }]
      };
      render();
      const scroll = $("#assistant-scroll");
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
    }, 900);
  }

  function publishReport(isRetry) {
    const report = getReport();
    report.publishAttempts = (report.publishAttempts || 0) + 1;
    state.modal = { type:"publish-running" };
    render();
    later(() => {
      if (report.publishAttempts === 1 && !isRetry) {
        state.modal = { type:"publish-failed" };
        render();
        return;
      }
      report.reportNo = report.reportNo || generatedId("FR-S001");
      report.status = "已发布";
      report.frozen = true;
      report.publishedAt = nowText();
      report.history.push({ label:`正式报告 ${report.reportNo} · ${report.contentVersion}`, time:report.publishedAt, semantic:report.semanticVersion, data:report.dataVersion, status:"已发布", evidence:"available", frozen:true });
      state.modal = { type:"publish-success" };
      render();
    }, 1050);
  }

  function exportReport(isRetry) {
    const report = getReport();
    report.exportAttempts = (report.exportAttempts || 0) + 1;
    state.modal = { type:"export-running" };
    render();
    later(() => {
      if (report.exportAttempts === 1 && !isRetry) state.modal = { type:"export-failed" };
      else state.modal = { type:"export-success" };
      render();
    }, 900);
  }

  function selectAnchor(anchor) {
    state.selectedAnchor = anchor;
    state.assistantOpen = true;
    render();
    const target = $(`#anchor-${anchor}`) || $(`[data-anchor="${CSS.escape(anchor)}"]`, $(".document-pane"));
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior:"smooth", block:"center" });
  }

  function handleAction(action, el) {
    const report = getReport();
    if (action === "go-directory") { state.modal=null; state.drawer=null; navigate("directory"); return; }
    if (action === "show-help") { state.modal={type:"help"}; render(); return; }
    if (action === "open-last-workspace") { if (report) navigate("workspace"); else { state.route="workspace"; render(); } return; }
    if (action === "open-review") { navigate("review"); return; }
    if (action === "new-report") { state.wizard=freshState().wizard; state.modal={type:"create"}; render(); return; }
    if (action === "close-modal") { state.modal=null; render(); return; }
    if (action === "open-reset") { state.modal={type:"reset"}; render(); return; }
    if (action === "confirm-reset") { clearTimers(); localStorage.removeItem(STORAGE_KEY); state=freshState(); history.replaceState({route:"directory"},"","#directory"); render(); toast("状态已重置，可重新开始完整流程"); return; }
    if (action === "set-view") { state.view=el.dataset.view; render(); return; }
    if (action === "clear-filters") { state.search="";state.statusFilter="全部状态";render();return; }
    if (action === "choose-type") { state.wizard.type=el.dataset.type;render();return; }
    if (action === "wizard-back") { state.wizard.step=Math.max(1,state.wizard.step-1);render();return; }
    if (action === "wizard-next") { if (!wizardCanNext()) return; if (state.wizard.step < 6) { state.wizard.step+=1; render(); } else startGeneration(false,false); return; }
    if (action === "validate-compat") {
      const context=getContext();state.wizard.compatStatus="处理中";state.wizard.compatMessage="正在读取本体权威绑定与数据可信度摘要…";render();later(()=>{ if (!context.compatible) { state.wizard.compatStatus="失败";state.wizard.compatMessage="Published 语义 SEM-FIN-2024.9 与当前报告定义要求不兼容；不得生成。"; } else if (context.warning) { state.wizard.compatStatus="警告";state.wizard.compatMessage="版本组合兼容，但数据超过场景新鲜度阈值 12 天；报告必须披露。"; } else { state.wizard.compatStatus="通过";state.wizard.compatMessage="精确 Published 语义与数据版本兼容，历史快照具备复现条件。"; }render();},700);return;
    }
    if (action === "generation-retry") { startGeneration(true, state.generation && state.generation.isRegeneration); return; }
    if (action === "select-report") { state.selectedReportId=el.dataset.report;state.selectedAnchor="summary";state.assistantTab="qa";navigate("workspace");return; }
    if (action === "open-history-direct") { state.selectedReportId=el.dataset.report;state.modal={type:"history"};render();return; }
    if (action === "assistant-tab") { state.assistantTab=el.dataset.tab;state.assistantOpen=true;render();return; }
    if (action === "toggle-assistant") { state.assistantOpen=!state.assistantOpen;render();return; }
    if (action === "select-anchor") { selectAnchor(el.dataset.anchor);return; }
    if (action === "scroll-document-top") { const scroller=$("#document-scroll");if(scroller)scroller.scrollTo({top:0,behavior:"smooth"});return; }
    if (action === "open-evidence") { state.drawer={anchor:el.dataset.anchor};state.assistantOpen=false;render();return; }
    if (action === "close-drawer") { state.drawer=null;render();return; }
    if (action === "toggle-compare") { state.compareCurrent=!state.compareCurrent;render();toast(state.compareCurrent ? "已启用显式快照比较；原报告保持不变" : "已恢复仅使用报告固定证据");return; }
    if (action === "ask-suggestion") { sendQuestion(el.dataset.question);return; }
    if (action === "send-question") { sendQuestion(state.qaInput);return; }
    if (action === "start-verification") { startVerification();return; }
    if (action === "select-check") { state.selectedCheck=state.selectedCheck===el.dataset.check?null:el.dataset.check;state.selectedAnchor=el.dataset.anchor;render();return; }
    if (action === "explain-check") { if(!report)return;report.explanations=report.explanations||{};report.explanations[el.dataset.check]="处理中";render();later(()=>{report.explanations[el.dataset.check]="已完成";render();},850);return; }
    if (action === "create-issue") {
      const item=report.verification.results.find((result)=>result.id===el.dataset.check);if(!item)return;
      const exists=state.issues.some((issue)=>issue.reportId===report.id&&issue.checkId===item.id&&issue.status!=="已关闭");
      if(!exists)state.issues.push({id:generatedId("ISSUE"),reportId:report.id,reportTitle:report.title,checkId:item.id,title:item.name,anchor:item.anchor,source:`自动核验 · ${item.status}`,status:"待处理",createdAt:nowText()});
      render();toast(exists?"复核问题已存在":"已创建复核问题，自动核验结果保持不变");return;
    }
    if (action === "open-regenerate") { state.modal={type:"regenerate"};render();return; }
    if (action === "start-regenerate") { startGeneration(false,true);return; }
    if (action === "open-manual") { state.modal={type:"manual"};render();return; }
    if (action === "save-manual") { if(!report.manualChecks.every(Boolean))return;report.manualReviewed=true;state.modal=null;render();toast("人工检查已记录；自动核验仍保持原四态");return; }
    if (action === "confirm-draft") { report.status="已确认";render();toast("草稿已确认，可发起正式发布");return; }
    if (action === "publish-report") { publishReport(false);return; }
    if (action === "retry-publish") { publishReport(true);return; }
    if (action === "open-withdraw") { state.modal={type:"withdraw",reason:""};render();return; }
    if (action === "confirm-withdraw") { if(!(state.modal.reason||"").trim())return;report.history.push({label:`撤回 ${report.reportNo}`,time:nowText(),semantic:report.semanticVersion,data:report.dataVersion,status:"已撤回",evidence:"available",frozen:true});report.status="已撤回";report.withdrawReason=state.modal.reason;state.modal=null;render();toast("正式报告已撤回；原产物与证据仍可追溯");return; }
    if (action === "new-content-version") { report.history.push({label:`原正式报告 ${report.reportNo} · ${report.contentVersion}`,time:nowText(),semantic:report.semanticVersion,data:report.dataVersion,status:report.status,evidence:"available",frozen:true});report.contentVersion=nextContentVersion(report.contentVersion);report.status="草稿待复核";report.frozen=false;report.hasMismatch=false;report.verification={status:"未运行",results:[],runId:null};report.manualReviewed=false;report.manualChecks=[false,false,false];report.generatedAt=nowText();render();toast("已创建新内容版本；原正式报告保持冻结");return; }
    if (action === "open-history") { state.modal={type:"history"};render();return; }
    if (action === "open-history-evidence") { state.modal=null;state.drawer={anchor:el.dataset.anchor};render();return; }
    if (action === "open-export") { state.modal={type:"export"};render();return; }
    if (action === "start-export") { exportReport(false);return; }
    if (action === "retry-export") { exportReport(true);return; }
    if (action === "open-fixed") { state.modal={type:"fixed-preview"};render();return; }
    if (action === "print-fixed") { window.print();return; }
    if (action === "open-issue") { state.selectedReportId=el.dataset.report;state.selectedAnchor=el.dataset.anchor;state.assistantTab="verify";state.selectedCheck=null;navigate("workspace");return; }
  }

  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || el.disabled) return;
    event.preventDefault();
    handleAction(el.dataset.action, el);
  });

  document.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) return;
    if (field === "search") { state.search=event.target.value; render(); const input=$("[data-field=search]"); if(input){input.focus();input.setSelectionRange(state.search.length,state.search.length);} return; }
    if (field === "qaInput") { state.qaInput=event.target.value; const send=$("[data-action=send-question]");if(send)send.disabled=!state.qaInput.trim();save();return; }
    if (field === "wizard.title") { state.wizard.title=event.target.value;save();return; }
    if (field === "withdrawReason") { state.modal.reason=event.target.value;const button=$("[data-action=confirm-withdraw]");if(button)button.disabled=!state.modal.reason.trim();save();return; }
  });

  document.addEventListener("change", (event) => {
    const field = event.target.dataset.field;
    if (field === "statusFilter") { state.statusFilter=event.target.value;render();return; }
    if (field === "wizard.scope") { state.wizard.scope=event.target.value;render();return; }
    if (field === "wizard.subject") { state.wizard.subject=event.target.value;render();return; }
    if (field === "wizard.dataChoice") { state.wizard.dataChoice=event.target.value;state.wizard.compatStatus="未验证";state.wizard.compatMessage="数据上下文已改变，请重新验证版本兼容性。";render();return; }
    if (event.target.dataset.resource) {
      const id=event.target.dataset.resource;
      if(event.target.checked&&!state.wizard.resources.includes(id))state.wizard.resources.push(id);
      if(!event.target.checked)state.wizard.resources=state.wizard.resources.filter((item)=>item!==id);
      render();return;
    }
    if (event.target.dataset.manual != null) {
      const report=getReport();report.manualChecks[Number(event.target.dataset.manual)]=event.target.checked;render();return;
    }
  });

  window.addEventListener("popstate", (event) => {
    const route = event.state && event.state.route ? event.state.route : "directory";
    state.route = route;
    state.modal = null;
    state.drawer = null;
    render();
  });

  history.replaceState({ route: state.route }, "", `#${state.route}`);
  render();
})();
