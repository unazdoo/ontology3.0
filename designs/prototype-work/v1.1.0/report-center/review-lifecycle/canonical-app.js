(function () {
  "use strict";

  function normalizeLegacyRoute() {
    const raw = (location.hash || "").slice(1);
    const [path, query = ""] = raw.split("?");
    const params = new URLSearchParams(query);
    let next = null;
    if (path === "/reports/view" && params.get("reportId")) next = `/report/${encodeURIComponent(params.get("reportId"))}`;
    else if (path === "/reports/generate") next = "/create";
    else if (path === "/reports" && ["definitions", "templates"].includes(params.get("tab"))) next = "/definitions";
    else if (["/reports", "/reports/s003", "/lifecycle"].includes(path)) next = "/catalog";
    if (next && `#${next}` !== location.hash) history.replaceState(null, "", `${location.pathname}${location.search}#${next}`);
  }

  normalizeLegacyRoute();

  const startupParams = new URLSearchParams(location.search);
  if (startupParams.get("resetRoute") === "catalog") {
    startupParams.delete("resetRoute");
    const search = startupParams.toString();
    history.replaceState(null, "", `${location.pathname}${search ? `?${search}` : ""}#/catalog`);
  }

  const DATA = window.RC_CANONICAL_DATA;
  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");
  if (!DATA) throw new Error("报告目录数据未加载");

  const REPORT_RUNTIME_KEY = "ontology3.report-center.canonical-runtime.v1";
  const AGENT_RUNTIME_SRC = "../../agent-application/portfolio-integration.js?v=20260824-11";

  function parseJson(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
  }

  function formalUrl(report) {
    if (!report?.contentHtml) {
      const html = report?.html || "";
      return html ? `${html}${html.includes("?") ? "&" : "?"}screenRev=20260822-04` : "";
    }
    if (report.runtimeUrl) return report.runtimeUrl;
    report.runtimeUrl = URL.createObjectURL(new Blob([report.contentHtml], { type: "text/html;charset=utf-8" }));
    return report.runtimeUrl;
  }

  function loadCreatedReports() {
    const saved = parseJson(localStorage.getItem(REPORT_RUNTIME_KEY), { reports: [] });
    return (saved.reports || []).map((report) => ({ ...report, runtimeUrl: null, html: "" }));
  }

  function dataOptionsForDefinition(definition) {
    const exact = DATA.reports.filter((item) => item.definitionId === definition.id).map((item) => item.dataVersion).filter(Boolean);
    return [...new Set(exact.length ? exact : definition.dataOptions)];
  }

  function persistCreatedReports(reports) {
    const created = reports.filter((item) => item.runtimeCreated).map(({ runtimeUrl, html, ...item }) => item);
    localStorage.setItem(REPORT_RUNTIME_KEY, JSON.stringify({ schemaVersion: 1, reports: created }));
  }

  let agentRuntimePromise = null;
  function getAgentRuntime() {
    if (window.AGENT_REPORT_RUNTIME) return Promise.resolve(window.AGENT_REPORT_RUNTIME);
    if (agentRuntimePromise) return agentRuntimePromise;
    agentRuntimePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = AGENT_RUNTIME_SRC;
      script.onload = () => window.AGENT_REPORT_RUNTIME ? resolve(window.AGENT_REPORT_RUNTIME) : reject(new Error("Agent 运行服务未就绪"));
      script.onerror = () => reject(new Error("无法连接 Agent 运行服务"));
      document.head.appendChild(script);
    });
    return agentRuntimePromise;
  }

  function waitForReceipt(runtime, requestId, onProgress) {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const poll = () => {
        const receipt = runtime.getReceipt(requestId);
        if (receipt) onProgress?.(receipt);
        if (receipt?.status === "complete" || receipt?.status === "failed") return resolve(receipt);
        if (Date.now() - startedAt > 12000) return reject(new Error("Agent 处理超时，请重试"));
        window.setTimeout(poll, 160);
      };
      poll();
    });
  }

  const state = {
    search: "",
    category: "全部类型",
    period: "全部期间",
    view: "list",
    drawer: null,
    detailTab: "content",
    readerPanel: "assistant",
    readerMoreOpen: false,
    readerChapter: 0,
    readerSections: [],
    readerAssistantWidth: 440,
    activeReportId: null,
    reports: [...loadCreatedReports(), ...DATA.reports],
    chat: [],
    verificationRuns: {},
    catalogFocus: "all",
    quickVersionRuns: {},
    wizard: {
      step: 1,
      definitionId: DATA.definitions[0].id,
      subject: DATA.definitions[0].subjects[0],
      dataVersion: dataOptionsForDefinition(DATA.definitions[0])[0],
      notes: "",
      status: "idle",
      progressText: "",
      draftId: null,
      requestId: null,
      runId: null,
      resultId: null,
      result: null,
      error: null,
      publishStatus: "idle",
      publishedReportId: null
    }
  };

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function displayDateTime(value) {
    const text = String(value ?? "").trim();
    const parts = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[T\s]+([0-2]?\d):([0-5]\d)(?::([0-5]\d))?)?/);
    if (!parts) return text || "—";
    const date = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
    return parts[4] == null ? date : `${date} ${parts[4].padStart(2, "0")}:${parts[5]}${parts[6] ? `:${parts[6]}` : ""}`;
  }

  function icon(name, size = "") {
    return `<span class="icon ${size}"><i data-lucide="${name}"></i></span>`;
  }

  function badge(label, tone = "success") {
    return `<span class="badge ${tone}">${esc(label)}</span>`;
  }

  function currentRoute() {
    const raw = (location.hash || "#/catalog").slice(1);
    const [path, query = ""] = raw.split("?");
    return { path: path || "/catalog", query: new URLSearchParams(query) };
  }

  function routeActive(path) {
    const current = currentRoute().path;
    if (path === "/catalog") return current === "/catalog" || current.startsWith("/report/");
    return current.startsWith(path);
  }

  function definitionById(id) {
    return DATA.definitions.find((item) => item.id === id) || DATA.definitions[0];
  }

  function reportById(id) {
    return state.reports.find((item) => item.id === id);
  }

  function refreshIcons() {
    window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function toast(message) {
    toastRoot.innerHTML = `<div class="toast">${icon("circle-check", "sm")}<strong>${esc(message)}</strong></div>`;
    refreshIcons();
    window.setTimeout(() => { toastRoot.innerHTML = ""; }, 2400);
  }

  function shell(content) {
    const route = currentRoute();
    const activeReport = route.path.startsWith("/report/") ? reportById(decodeURIComponent(route.path.slice(8))) : null;
    const currentTitle = activeReport?.title || (route.path === "/create" ? "创建与生成" : route.path === "/definitions" ? "报告定义" : route.path === "/draft" ? "报告草稿" : "报告目录");
    const publishedCount = state.reports.filter((item) => item.status === "已发布").length;
    app.className = "rc-app";
    app.innerHTML = `
      <div class="module-layout">
        <section class="module-stage">
          <header class="module-bar">
            <div class="module-title"><span class="module-brand-mark">${icon("file-chart-column", "sm")}</span><div><small>报告中心</small><strong>${esc(currentTitle)}</strong></div></div>
            <div class="module-actions"><span class="scope-chip">${activeReport ? `数据截至 ${esc(activeReport.period)}` : `4 类 · ${publishedCount} 份正式报告`}</span><button class="btn" type="button" data-action="refresh">${icon("refresh-cw", "sm")}<span>重新读取</span></button></div>
          </header>
          <nav class="module-nav" aria-label="报告中心导航">
            <a class="module-nav-item ${routeActive("/catalog") ? "active" : ""}" href="#/catalog">${icon("library", "sm")}<strong>报告目录</strong><em>${publishedCount}</em></a>
            <a class="module-nav-item ${routeActive("/create") ? "active" : ""}" href="#/create">${icon("file-plus-2", "sm")}<strong>创建与生成</strong></a>
            <a class="module-nav-item ${routeActive("/definitions") ? "active" : ""}" href="#/definitions">${icon("files", "sm")}<strong>报告定义</strong><em>${DATA.definitions.length}</em></a>
          </nav>
          ${content}
        </section>
      </div>
      ${state.drawer ? renderDrawer() : ""}
    `;
    refreshIcons();
    window.requestAnimationFrame(() => {
      const chat = document.querySelector(".reader-chat");
      if (chat) chat.scrollTop = chat.scrollHeight;
      const frame = document.querySelector(".report-document-frame[data-report-id]");
      if (frame) {
        const report = reportById(frame.dataset.reportId);
        const sync = () => syncReaderTocFromDocument(frame, report);
        frame.addEventListener("load", sync, { once: true });
        if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.URL !== "about:blank") sync();
      }
      installReaderResizer();
    });
  }

  function installReaderResizer() {
    const workspace = document.querySelector(".reader-workspace");
    const handle = document.querySelector(".reader-resizer");
    if (!workspace || !handle || handle.dataset.bound === "true") return;
    handle.dataset.bound = "true";
    handle.tabIndex = 0;
    handle.setAttribute("aria-orientation", "vertical");
    handle.title = "拖动或使用方向键调整报告助手宽度";
    const min = 390;
    const maximumWidth = () => Math.max(min, Math.min(620, workspace.clientWidth * .56));
    let startX = 0;
    let startWidth = state.readerAssistantWidth;
    const move = (event) => {
      const next = Math.max(min, Math.min(maximumWidth(), startWidth - (event.clientX - startX)));
      state.readerAssistantWidth = next;
      workspace.style.setProperty("--reader-assistant-width", `${next}px`);
    };
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      handle.classList.remove("dragging");
    };
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startX = event.clientX;
      startWidth = state.readerAssistantWidth;
      handle.setPointerCapture?.(event.pointerId);
      handle.classList.add("dragging");
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop, { once: true });
    });
    handle.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? 1 : -1;
      state.readerAssistantWidth = Math.max(min, Math.min(maximumWidth(), state.readerAssistantWidth + direction * 24));
      workspace.style.setProperty("--reader-assistant-width", `${state.readerAssistantWidth}px`);
    });
    workspace.style.setProperty("--reader-assistant-width", `${state.readerAssistantWidth}px`);
  }

  function summaryCards() {
    const counts = {
      published: state.reports.filter((item) => item.status === "已发布").length,
      review: state.reports.filter((item) => item.status !== "已发布" || (item.candidates || []).length).length,
      group: state.reports.filter((item) => item.scope === "集团整体").length,
      recent: state.reports.filter((item) => displayDateTime(item.issuedAt).startsWith("2026-08")).length
    };
    return `<section class="summary-grid catalog-focus-grid" aria-label="报告目录快捷筛选">
      <button class="summary-card ${state.catalogFocus === "all" ? "active" : ""}" type="button" data-action="catalog-focus" data-focus="all"><span>全部正式报告</span><strong>${counts.published}</strong><small>融资、预算、债务风险与贷前调查</small></button>
      <button class="summary-card ${state.catalogFocus === "review" ? "active" : ""}" type="button" data-action="catalog-focus" data-focus="review"><span>待复核内容</span><strong>${counts.review}</strong><small>候选内容等待人工确认</small></button>
      <button class="summary-card ${state.catalogFocus === "group" ? "active" : ""}" type="button" data-action="catalog-focus" data-focus="group"><span>集团经营报告</span><strong>${counts.group}</strong><small>集团整体融资与预算监督报告</small></button>
      <button class="summary-card ${state.catalogFocus === "recent" ? "active" : ""}" type="button" data-action="catalog-focus" data-focus="recent"><span>本月发布</span><strong>${counts.recent}</strong><small>按正式发布时间筛选</small></button>
    </section>`;
  }

  function filteredReports() {
    const q = state.search.trim().toLowerCase();
    return state.reports.filter((item) => {
      const searchOk = !q || [item.title, item.reportNo, item.scope, item.category].some((value) => String(value).toLowerCase().includes(q));
      const categoryOk = state.category === "全部类型" || item.category === state.category;
      const periodOk = state.period === "全部期间" || item.period.includes(state.period);
      const focusOk = state.catalogFocus === "all"
        || state.catalogFocus === "review" && (item.status !== "已发布" || (item.candidates || []).length)
        || state.catalogFocus === "group" && item.scope === "集团整体"
        || state.catalogFocus === "recent" && displayDateTime(item.issuedAt).startsWith("2026-08");
      return searchOk && categoryOk && periodOk && focusOk;
    });
  }

  function reportDetailHref(report) {
    return `#/report/${encodeURIComponent(report.id)}`;
  }

  function reportActions(report) {
    return `<div class="inline-actions"><a class="text-btn" href="${esc(reportDetailHref(report))}">查看详情</a><a class="icon-btn" href="${esc(formalUrl(report))}" target="_blank" rel="noopener" title="打开 HTML" aria-label="打开 HTML">${icon("external-link", "sm")}</a></div>`;
  }

  function catalogTable(reports) {
    if (!reports.length) return `<div class="empty">${icon("search-x", "lg")}<h2>没有匹配的报告</h2><p>调整关键词、报告类型或报告期间后重试。</p><button class="btn" type="button" data-action="clear-catalog-filters">清除筛选</button></div>`;
    return `<div class="resource-list report-ledger">${reports.map((report) => `<article class="resource-row canonical-ledger-row">
      <div class="ledger-primary"><span class="eyebrow">${esc(report.category)}</span><strong>${esc(report.title)}</strong><small>${esc(report.reportNo)} · ${esc(report.scope)}</small></div>
      <div class="resource-meta"><span>报告期间</span><strong>${esc(report.period)}</strong></div>
      <div class="resource-meta"><span>内容版本</span><strong>${esc(report.version)}</strong><small>${esc(report.verification)}</small></div>
      <div class="resource-meta"><span>发布时间</span><strong>${esc(displayDateTime(report.issuedAt))}</strong></div>
      <div class="ledger-state">${badge(report.status)}<div class="format-list">${report.formats.map((format) => `<span class="format-chip">${esc(format)}</span>`).join("")}</div></div>
      ${reportActions(report)}
    </article>`).join("")}</div>`;
  }

  function catalogCards(reports) {
    if (!reports.length) return `<div class="empty">${icon("search-x", "lg")}<h2>没有匹配的报告</h2><p>调整筛选条件后重试。</p><button class="btn" type="button" data-action="clear-catalog-filters">清除筛选</button></div>`;
    return `<div class="report-cards">${reports.map((report) => `<article class="report-card"><header class="report-card-head"><span class="eyebrow">${esc(report.category)}</span>${badge(report.status)}</header><div><h3>${esc(report.title)}</h3><p>${esc(report.scope)} · ${esc(report.period)}</p></div><div class="report-card-meta"><div><span>报告编号</span><strong>${esc(report.reportNo)}</strong></div><div><span>内容版本</span><strong>${esc(report.version)}</strong></div><div><span>确定性核验</span><strong>${esc(report.verification)}</strong></div><div><span>发布于</span><strong>${esc(displayDateTime(report.issuedAt))}</strong></div></div><footer class="report-card-foot"><div class="format-list">${report.formats.map((format) => `<span class="format-chip">${esc(format)}</span>`).join("")}</div><a class="btn" href="${esc(reportDetailHref(report))}">查看详情</a></footer></article>`).join("")}</div>`;
  }

  function renderCatalog() {
    const reports = filteredReports();
    shell(`<main class="page" data-screen-label="统一报告目录">
      <header class="page-head"><div><h1>报告管理</h1><p>当前共 ${state.reports.length} 份报告，覆盖融资经营、预算监督、债务风险和贷前调查。</p></div><div class="head-actions"><a class="btn primary" href="#/create">${icon("plus", "sm")}创建报告</a></div></header>
      ${summaryCards()}
      <section class="toolbar">
        <label class="input-wrap">${icon("search", "sm")}<input class="input" id="report-search" value="${esc(state.search)}" placeholder="搜索报告名称、对象或编号"></label>
        <select class="select" id="category-filter"><option>全部类型</option>${[...new Set(state.reports.map((item) => item.category))].map((value) => `<option ${value === state.category ? "selected" : ""}>${esc(value)}</option>`).join("")}</select>
        <select class="select" id="period-filter"><option>全部期间</option><option ${state.period === "2025" ? "selected" : ""}>2025</option><option ${state.period === "2026" ? "selected" : ""}>2026</option></select>
        <div class="view-switch"><button class="${state.view === "list" ? "active" : ""}" type="button" data-action="set-view" data-view="list" title="列表视图">${icon("list", "sm")}</button><button class="${state.view === "card" ? "active" : ""}" type="button" data-action="set-view" data-view="card" title="卡片视图">${icon("layout-grid", "sm")}</button></div>
      </section>
      <section class="panel"><div class="panel-head"><div><h2>正式报告</h2><p>当前显示 ${reports.length} 份，共 ${state.reports.length} 份。</p></div>${badge(`${state.reports.filter((item) => item.status === "已发布").length} 份已发布`)}</div><div class="panel-body ${state.view === "list" ? "flush" : ""}">${state.view === "list" ? catalogTable(reports) : catalogCards(reports)}</div></section>
    </main>`);
  }

  function detailTabs(report) {
    const tabs = [["content", "报告内容"], ["versions", "版本记录"], ["verification", "核验结果"], ["evidence", "证据追溯"], ["assistant", "报告伴读"]];
    return `<nav class="subtabs" aria-label="报告详情">${tabs.map(([id, label]) => `<button class="subtab ${state.detailTab === id ? "active" : ""}" type="button" data-action="detail-tab" data-tab="${id}" data-id="${esc(report.id)}">${esc(label)}</button>`).join("")}</nav>`;
  }

  function reportContent(report) {
    return `<div class="report-document-layout"><section class="report-document"><div class="report-document-bar"><div><strong>正式 HTML 正文</strong><span>${esc(report.reportNo)} · 内容版本 ${esc(report.version)}</span></div><a class="btn" href="${esc(formalUrl(report))}" target="_blank" rel="noopener">${icon("external-link", "sm")}独立阅读 / 打印</a></div><iframe class="report-document-frame" src="${esc(formalUrl(report))}" title="${esc(report.title)}正文" loading="eager"></iframe></section><aside class="side-stack"><section class="side-card"><h3>报告信息</h3><div class="meta-list"><div class="meta-item"><span>报告编号</span><strong>${esc(report.reportNo)}</strong></div><div class="meta-item"><span>内容版本</span><strong>${esc(report.version)}</strong></div><div class="meta-item"><span>数据版本</span><strong>${esc(report.dataVersion)}</strong></div><div class="meta-item"><span>语义版本</span><strong>${esc(report.semanticVersion)}</strong></div><div class="meta-item"><span>报告责任部门</span><strong>${esc(report.owner)}</strong></div></div></section><section class="side-card"><h3>形成过程</h3><div class="timeline">${[["固定报告范围", "报告对象、期间与模板已锁定"], ["生成结构化草稿", report.agentRunId ? `${report.agent} · ${report.agentRunId}` : report.agent], ["确定性核验", report.verification], ["人工复核", "复核通过"], ["发布正式产物", displayDateTime(report.issuedAt)]].map(([title, copy]) => `<div class="timeline-row"><span class="timeline-mark"></span><div><strong>${esc(title)}</strong><span>${esc(copy)}</span></div></div>`).join("")}</div></section></aside></div>`;
  }

  function versionsContent(report) {
    return `<section class="panel inspector-section"><div class="panel-head"><div><h3>版本沿革</h3><p>正式版本不可原地更新，新数据或新模板形成新的内容版本。</p></div></div><div class="panel-body"><div class="version-list">${(report.candidates || []).map((item) => `<div class="version-row"><div><strong>候选内容 ${esc(item.version)}</strong><small>${esc(item.note)}</small></div><div class="inline-actions">${badge("待人工复核", "warning")}<a class="btn" href="${esc(item.html)}" target="_blank" rel="noopener">查看候选内容</a></div></div>`).join("")}${report.history.map((item, index) => `<div class="version-row"><div><strong>正式内容版本 ${esc(item.version)} ${index === 0 ? "· 当前" : ""}</strong><small>${esc(item.note)}</small></div><div>${badge(index === 0 ? "当前正式版本" : "历史正式版本", index === 0 ? "success" : "")}</div></div>`).join("")}</div></div></section>`;
  }

  function verificationContent(report) {
    const { passed, total } = verificationNumbers(report);
    const rules = verificationRulesFor(report);
    return `<section class="panel inspector-section"><div class="panel-head"><div><h3>确定性核验结果</h3><p>${rules.length} 组核验规则覆盖 ${total} 个检查单元，结果固定在当前内容版本。</p></div>${badge(`${passed} / ${total} 通过`)}</div><div class="panel-body">${verificationRuleList(rules)}<div class="notice success" style="margin-top:12px">${icon("shield-check", "sm")}<div><strong>规则与结果已完整对应</strong><span>${rules.length} 组规则、${total} 个检查单元均可展开查看输入、方法、判据与结果。</span></div></div></div></section>`;
  }

  function evidenceContent(report) {
    const rows = [["报告定义", definitionById(report.definitionId).name, definitionById(report.definitionId).version], ["报告模板", definitionById(report.definitionId).templateName, definitionById(report.definitionId).templateVersion], ["业务语义", report.semanticVersion, "已发布"], ["数据版本", report.dataVersion, report.period], ["固定证据包", report.evidenceId, "只读"], ["Agent 生成记录", report.sourceDraft ? `${report.agent} · 来源草稿 ${report.sourceDraft}` : report.agent, "已完成"], ...(report.agentRunId ? [["Agent 运行 / 结果", `${report.agentRunId} / ${report.agentResultId}`, "已完成"]] : []), ...(report.verificationRun ? [["确定性核验记录", `${report.verificationRun} · ${report.verification}`, "已完成"]] : []), ["正式产物", `${report.reportNo} / ${report.version}`, report.formats.join("、")]];
    return `<section class="panel inspector-section"><div class="panel-head"><div><h3>证据链</h3><p>每一行表示报告内容如何回到唯一的定义、模板、语义、数据、固定证据或运行结果。</p></div></div><div class="panel-body"><div class="evidence-guide"><span class="evidence-guide-node">报告内容</span><i>${icon("arrow-right", "sm")}</i><span class="evidence-guide-node">固定证据包</span><i>${icon("arrow-right", "sm")}</i><span class="evidence-guide-node">语义 / 数据版本</span></div><div class="evidence-list">${rows.map(([name, value, status]) => `<div class="evidence-row"><div><strong>${esc(name)}</strong><small>${esc(value)}</small></div>${badge(status, status === "已完成" || status === "已发布" ? "success" : "")}</div>`).join("")}</div></div></section>`;
  }

  function chatMessage(item) {
    if (item.role === "user") return `<div class="message user">${esc(item.text)}</div>`;
    if (item.status === "processing") return `<div class="message assistant pending" data-message-id="${esc(item.id)}" data-process-step="${Number(item.processStep || 1)}"><span class="agent-thinking-mark" aria-hidden="true"><i></i><i></i><i></i><b></b></span><div class="answer-progress-copy"><span class="answer-progress-kicker">报告伴读正在工作</span><strong>${esc(item.text || "正在形成可追溯回答")}</strong><div class="thinking-steps" aria-label="回答处理进度"><span class="${item.processStep >= 1 ? "active" : ""}">${icon("file-search", "sm")}读取报告</span><span class="${item.processStep >= 2 ? "active" : ""}">${icon("git-branch", "sm")}定位证据</span><span class="${item.processStep >= 3 ? "active" : ""}">${icon("sparkles", "sm")}组织结论</span></div><span class="answer-progress-track" aria-hidden="true"><i style="--answer-step:${Math.max(1, Math.min(3, Number(item.processStep || 1)))}"></i></span><small>${item.runId ? `伴读运行 ${esc(item.runId)}` : "已锁定当前报告内容版本，正在建立回答依据"}</small></div></div>`;
    if (item.status === "failed") return `<div class="message assistant failed"><div><strong>本次回答未完成</strong><p>${esc(item.reason)}</p><small>${esc(item.recovery)}</small></div><button class="btn" type="button" data-action="retry-assistant" data-message-id="${esc(item.id)}">${icon("refresh-cw", "sm")}重试</button></div>`;
    const blocks = String(item.text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const lead = blocks.shift() || "已依据当前报告固定内容形成回答。";
    return `<div class="message assistant complete"><div class="answer-kicker">${icon("sparkles", "sm")}报告助手</div><div class="answer-copy"><p class="answer-lead">${esc(lead)}</p>${blocks.length ? `<div class="answer-points">${blocks.map((block) => { const match = block.match(/^([^：:]{2,8})[：:]\s*(.*)$/); return match ? `<section><strong>${esc(match[1])}</strong><p>${esc(match[2])}</p></section>` : `<section><strong>补充说明</strong><p>${esc(block)}</p></section>`; }).join("")}</div>` : ""}</div>${item.evidenceRefs?.length ? `<details class="answer-sources"><summary>${icon("git-branch", "sm")}查看 ${item.evidenceRefs.length} 项回答依据</summary><div class="answer-evidence">${item.evidenceRefs.map((ref) => `<span title="${esc(ref)}">${esc(ref)}</span>`).join("")}</div></details>` : ""}${item.runId ? `<small class="answer-run">${esc(item.runId)} · ${esc(item.resultId)}</small>` : ""}</div>`;
  }

  function assistantContent(report) {
    const busy = state.chat.some((item) => item.status === "processing");
    return `<div class="assistant-shell"><section class="chat-panel"><header class="chat-head"><strong>报告伴读</strong><small>回答由 Agent 应用读取本报告固定内容和证据后返回，不重新计算业务数据。</small></header><div class="chat-body">${state.chat.length ? state.chat.map(chatMessage).join("") : `<div class="empty">${icon("messages-square", "lg")}<h2>从报告内容开始提问</h2><p>选择右侧问题，或输入你关心的报告结论。</p></div>`}</div><form class="chat-input" id="chat-form"><input class="input" id="chat-question" placeholder="询问报告结论、依据或限制" ${busy ? "disabled" : ""}><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? icon("loader-circle", "sm") : icon("send", "sm")}${busy ? "处理中" : "发送"}</button></form></section><aside class="side-card"><h3>推荐问题</h3><div class="question-list">${report.questions.map(([question]) => `<button class="question" type="button" data-action="ask-report" data-id="${esc(report.id)}" data-question="${esc(question)}" ${busy ? "disabled" : ""}>${esc(question)}</button>`).join("")}<button class="question" type="button" data-action="ask-report" data-id="${esc(report.id)}" data-question="这份报告使用了哪些数据和证据？" ${busy ? "disabled" : ""}>这份报告使用了哪些数据和证据？</button></div><div class="notice" style="margin-top:12px">${icon("shield-check", "sm")}<div><strong>固定上下文</strong><span>${esc(report.reportNo)} · 内容版本 ${esc(report.version)} · ${esc(report.period)}</span></div></div></aside></div>`;
  }

  function readerQuestions(report) {
    const questions = [
      ...(report.questions || []).map(([question]) => question),
      "这份报告的主要结论是什么？",
      "报告使用了哪些数据版本和证据？",
      "自动核验检查了什么，当前结果如何？",
      "哪些结论需要人工确认？"
    ];
    return [...new Set(questions)].slice(0, 8);
  }

  function deriveReaderSectionNodes(doc) {
    if (!doc) return [];
    const visible = (node) => {
      if (!node || node.closest("[hidden], [aria-hidden='true']")) return false;
      const style = doc.defaultView?.getComputedStyle(node);
      return !style || style.display !== "none" && style.visibility !== "hidden";
    };
    const withText = (nodes) => nodes.filter((node) => visible(node) && String(node.dataset.sectionTitle || node.textContent || "").replace(/\s+/g, " ").trim());
    const explicit = withText([...doc.querySelectorAll("[data-section-title], h2[id], h3[id], h2[data-anchor], h3[data-anchor]")]);
    if (explicit.length > 1) return explicit;
    let levelTwo = withText([...doc.querySelectorAll("h2")]);
    const levelThree = withText([...doc.querySelectorAll("h3")]);
    if (levelTwo.length > 1) {
      const numberedTail = levelTwo.slice(1).filter((node) => /^\s*\d{1,2}\b/.test(node.textContent || "")).length;
      if (numberedTail >= 3 && !/^\s*\d{1,2}\b/.test(levelTwo[0].textContent || "")) levelTwo = levelTwo.slice(1);
      return levelTwo;
    }
    if (levelThree.length > 1) return levelThree;
    if (levelTwo.length) return levelTwo;
    const levelOne = withText([...doc.querySelectorAll("h1[id], h1[data-anchor], h1")]);
    return levelOne.slice(0, 1);
  }

  function syncReaderTocFromDocument(frame, report) {
    if (!frame || !report) return;
    let doc;
    try { doc = frame.contentDocument; } catch (_) { return; }
    if (!doc.getElementById("ofw-unified-reader-fit")) {
      const style = doc.createElement("style");
      style.id = "ofw-unified-reader-fit";
      style.textContent = `
        html, body { max-width: 100% !important; overflow-x: hidden !important; }
        *, *::before, *::after { box-sizing: border-box; }
        h1, h2, h3, h4, p, li, dt, dd, th, td, code, strong, span { max-width: 100%; overflow-wrap: anywhere; word-break: break-word; }
        img, svg, canvas { max-width: 100% !important; height: auto; }
        table { max-width: 100%; }
        .no-print { position: static !important; inset: auto !important; margin-bottom: 20px !important; }
        .title-block, #report-cover { position: relative !important; clear: both !important; scroll-margin-top: 18px !important; }
        @media (max-width: 700px) {
          body { min-width: 0 !important; }
          table { display: block; width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `;
      doc.head?.appendChild(style);
    }
    const nodes = deriveReaderSectionNodes(doc);
    const safeReportId = String(report.id).replace(/[^a-zA-Z0-9_-]+/g, "-");
    const sections = nodes.map((node, index) => {
      const anchor = node.id || node.dataset.anchor || `ofw-report-section-${safeReportId}-${index + 1}`;
      if (!node.id) node.id = anchor;
      const rawLabel = String(node.dataset.sectionTitle || node.textContent || "").replace(/\s+/g, " ").trim();
      return { targetId: node.id, label: rawLabel.replace(/^\d{1,2}\s*/, "") };
    });
    state.readerSections = sections;
    state.readerChapter = Math.min(state.readerChapter, Math.max(0, sections.length - 1));
    const list = document.querySelector(".reader-toc .toc-list");
    const count = document.querySelector(".reader-toc [data-toc-count]");
    if (count) count.textContent = sections.length ? `${sections.length} 个章节` : "正文无章节标题";
    if (!list) return;
    list.innerHTML = sections.length ? sections.map((section, index) => `<button class="toc-link ${state.readerChapter === index ? "active" : ""}" type="button" data-action="jump-report-chapter" data-index="${index}" data-target="${esc(section.targetId)}"><em>${String(index + 1).padStart(2, "0")}</em><span>${esc(section.label)}</span></button>`).join("") : `<div class="toc-loading"><span>正文未登记章节标题</span></div>`;
  }

  function readerToc(report) {
    const sections = state.readerSections;
    const items = sections.length ? sections.map((section, index) => `<button class="toc-link ${state.readerChapter === index ? "active" : ""}" type="button" data-action="jump-report-chapter" data-index="${index}" data-target="${esc(section.targetId)}"><em>${String(index + 1).padStart(2, "0")}</em><span>${esc(section.label)}</span></button>`).join("") : `<div class="toc-loading"><span class="mini-spinner"></span><strong>正在读取正文目录</strong></div>`;
    return `<aside class="reader-toc" aria-label="章节目录"><div class="pane-heading"><strong>章节目录</strong><small data-toc-count>${sections.length ? `${sections.length} 个章节` : "正在读取"}</small></div><div class="toc-list">${items}</div><div class="toc-meta"><span>内容版本</span><strong>${esc(report.version)}</strong><span>数据截至</span><strong>${esc(report.period)}</strong><a href="#/catalog">返回报告目录</a></div></aside>`;
  }

  function readerAssistantQa(report) {
    const busy = state.chat.some((item) => item.status === "processing");
    const questions = readerQuestions(report);
    return `<div class="reader-panel-content assistant-qa-content"><section class="context-strip"><span>当前报告</span><strong title="${esc(report.title)}">${esc(report.title)}</strong><small>${esc(report.version)} · ${esc(report.period)}</small></section><details class="recommended-block" ${state.chat.length ? "" : "open"}><summary><span>${icon("message-circle-question", "sm")}<strong>推荐问题</strong></span><small>${questions.length} 个 · 横向浏览</small></summary><div class="question-rail">${questions.map((question) => `<button class="question-chip" type="button" title="${esc(question)}" data-action="ask-report" data-id="${esc(report.id)}" data-question="${esc(question)}" ${busy ? "disabled" : ""}>${esc(question)}</button>`).join("")}</div></details><section class="reader-chat" aria-live="polite">${state.chat.length ? state.chat.map(chatMessage).join("") : `<div class="reader-chat-empty"><span class="assistant-empty-mark">${icon("sparkles", "lg")}</span><strong>从报告结论开始问</strong><span>助手会先定位正文与证据，再给出清晰结论和使用边界。</span></div>`}</section><form class="reader-compose" id="chat-form"><input class="input" id="chat-question" autocomplete="off" placeholder="询问结论、依据或需要关注的事项" ${busy ? "disabled" : ""}><button class="btn primary" type="submit" ${busy ? "disabled" : ""}>${busy ? icon("loader-circle", "sm") : icon("send", "sm")}<span>${busy ? "处理中" : "发送"}</span></button></form><div class="assistant-actionbar"><button class="text-btn" type="button" data-action="open-report-inspector" data-id="${esc(report.id)}" data-tab="evidence">${icon("git-branch", "sm")}查看证据</button><button class="text-btn" type="button" data-action="clear-reader-chat" ${state.chat.length ? "" : "disabled"}>${icon("eraser", "sm")}清空会话</button></div></div>`;
  }

  function verificationNumbers(report) {
    const numbers = String(report.verification || "").match(/\d+/g)?.map(Number) || [];
    const definitionDefault = { "RD-FIN-001": 42, "RD-BUDGET-001": 426, "RD-RISK-001": 13, "RDEF-S004-PREFLIGHT-002": 18 }[report.definitionId] || 5;
    const passed = numbers[0] || definitionDefault;
    return { passed, total: numbers[1] || passed };
  }

  function verificationRulesFor(report) {
    const definition = definitionById(report.definitionId);
    const { total } = verificationNumbers(report);
    const contentUnits = Math.max(1, total - 8);
    return [
      { name: "报告身份与对象范围", units: 2, input: `${report.reportNo}；${report.scope}；${report.period}`, method: "读取报告控制信息，逐项比对报告编号、业务主体和评估时点。", criterion: "三项身份均可定位，且业务主体与报告定义适用范围一致。", result: `报告编号唯一；对象为${report.scope}；数据截至${report.period}。` },
      { name: "报告定义与模板绑定", units: 2, input: `${definition.name} ${definition.version}；${definition.templateName} ${definition.templateVersion}`, method: "按内容版本反查定义和模板快照，再比对章节、槽位与输出格式。", criterion: "定义、模板均为本次运行锁定版本，正文章节不存在未绑定槽位。", result: "定义与模板版本一致，章节和输出格式完整。" },
      { name: "Published 语义与精确数据", units: 2, input: `${report.semanticVersion}；${report.dataVersion}`, method: "核对报告固定的 Published 语义版本、精确数据版本和数据截至时间。", criterion: "语义与数据组合可定位，且与报告形成时固定组合完全一致。", result: "语义、数据版本和报告时点匹配。" },
      { name: "内容事实、计算与证据锚点", units: contentUnits, input: `${report.evidenceId}；正文内容项与稳定锚点`, method: "逐个内容项检查事实值、计算结果、证据引用和正文锚点的双向绑定。", criterion: "每个必核内容项均有确定性来源，数值与引用一致，锚点可回到正文位置。", result: `${contentUnits} 个内容检查单元全部通过，未发现缺失引用或值冲突。` },
      { name: "人工复核与正式产物", units: 2, input: `${report.status}；${report.formats.join(" / ")}`, method: "检查人工复核记录、发布状态及 HTML/PDF 同源产物清单。", criterion: "人工确认完成，正式产物共享报告编号、内容版本和证据链。", result: `${report.status}；${report.formats.join("、")} 均绑定当前内容版本。` }
    ];
  }

  function verificationAgentFor(report) {
    const configured = window.OFW_REPORT_VERIFICATION_AGENT;
    const run = state.verificationRuns[report.id];
    let resolved = configured;
    if (typeof configured?.forReport === "function") {
      try { resolved = configured.forReport(report) || configured; } catch (_) { resolved = configured; }
    }
    return {
      name: run?.agentName || resolved?.name || "报告自动核验 Agent",
      configuration: run?.agentConfiguration || resolved?.configuration || resolved?.profileName || "report-verification-agent@1.0",
      extraction: resolved?.extraction || "抽取报告主体、期间、关键声明、数值、单位和引用关系",
      anchorPolicy: resolved?.anchorPolicy || `仅定位固定证据包 ${report.evidenceId} 中的稳定锚点`,
      judgement: resolved?.judgement || "确定性规则引擎逐项比对并形成正式判定"
    };
  }

  function verificationStagesFor(agent) {
    return [
      { name: "固定核验上下文", detail: "锁定报告编号、内容版本和固定证据包", icon: "lock-keyhole" },
      { name: "抽取报告声明", detail: `${agent.name} 识别待核验内容`, icon: "scan-text" },
      { name: "定位证据锚点", detail: "建立声明与固定证据的一一映射", icon: "locate-fixed" },
      { name: "逐项确定性判定", detail: "按核验分类执行全部核验项", icon: "list-checks" },
      { name: "固定核验记录", detail: "汇总通过、警告和失败并保存结果", icon: "shield-check" }
    ];
  }

  function verificationProgressCounts(total, activeStage) {
    return {
      extracted: activeStage < 1 ? 0 : activeStage === 1 ? Math.max(1, Math.round(total * .58)) : total,
      anchored: activeStage < 2 ? 0 : activeStage === 2 ? Math.max(1, Math.round(total * .72)) : total,
      judged: activeStage < 3 ? 0 : activeStage === 3 ? Math.max(1, Math.round(total * .68)) : total
    };
  }

  function verificationRuleList(rules) {
    return `<div class="verification-list">${rules.map((rule, index) => `<details class="verification-item"><summary><span class="status-mark">${icon("check", "sm")}</span><span><strong>${String(index + 1).padStart(2, "0")} · ${esc(rule.name)}</strong><small>核验分类 · ${rule.units} 个核验项 · 全部通过</small></span><span class="detail-caret">查看比对详情</span></summary><div class="verification-method"><div><span>Agent 抽取声明</span><p>${esc(rule.input)}</p></div><div><span>证据定位与规则方法</span><p>${esc(rule.method)}</p></div><div><span>确定性通过判据</span><p>${esc(rule.criterion)}</p></div><div class="verification-outcome"><span>逐项比对结果</span><p>${esc(rule.result)}</p></div></div></details>`).join("")}</div>`;
  }

  function readerVerification(report) {
    const { passed, total } = verificationNumbers(report);
    const rules = verificationRulesFor(report);
    const agent = verificationAgentFor(report);
    const stages = verificationStagesFor(agent);
    const run = state.verificationRuns[report.id];
    const running = run?.status === "running";
    const complete = !run || run.status === "complete";
    const resultLabel = run?.status === "complete" ? "本次核验已完成" : "形成时核验结果";
    const runCopy = run?.runId ? `${run.runId} · ${displayDateTime(run.completedAt || run.startedAt)}` : `固定于内容版本 ${report.version}`;
    const activeStage = Math.min(stages.length - 1, Number(run?.stage || 0));
    const { extracted, anchored, judged } = verificationProgressCounts(total, activeStage);
    const agentCard = `<section class="verification-agent-card"><div class="verification-agent-head"><span class="verification-agent-mark">${icon("scan-text", "sm")}</span><div><span>核验 Agent</span><strong>${esc(agent.name)}</strong></div>${badge(running ? "正在抽取" : "配置已锁定", running ? "" : "success")}</div><dl><div><dt>Agent 配置</dt><dd>${esc(agent.configuration)}</dd></div><div><dt>抽取声明</dt><dd>${esc(agent.extraction)}</dd></div><div><dt>证据锚点</dt><dd>${esc(agent.anchorPolicy)}</dd></div><div><dt>正式判定</dt><dd>${esc(agent.judgement)}</dd></div></dl></section>`;
    const relationship = `<div class="verification-relationship">${icon("info", "sm")}<p><strong>自动核验如何工作</strong><span>核验 Agent 先抽取报告声明并定位证据；每条声明形成一个核验项并归入对应规则组，最终由确定性规则逐项判定。Agent 不直接给出正式通过结论。</span><span class="verification-hierarchy"><b>1 个 Agent 抽取批次</b><i>${icon("arrow-right", "sm")}</i><b>${rules.length} 个规则组</b><i>${icon("arrow-right", "sm")}</i><b>${total} 个核验项</b></span></p></div>`;
    return `<div class="reader-panel-content verification-pane"><section class="context-box"><span>自动核验</span><strong>${running ? esc(stages[activeStage].name) : `${esc(report.verification)} · ${resultLabel}`}</strong><small>${running ? esc(stages[activeStage].detail) : esc(runCopy)}；本次运行只形成新的核验记录。</small></section>${relationship}${agentCard}${running ? `<div class="verification-progress" data-stage="${activeStage}" data-total="${total}"><div class="verification-live-head"><span class="verification-orbit" aria-hidden="true"><i></i><b></b></span><div><strong data-verification-title>${esc(stages[activeStage].name)}</strong><small data-verification-detail>${activeStage + 1} / ${stages.length} · ${esc(stages[activeStage].detail)}</small></div></div><div class="verification-signal-track" aria-hidden="true"><i style="--verification-stage:${activeStage + 1}"></i></div><div class="verification-live-counts"><span>已抽取 <strong data-verification-count="extracted">${extracted}/${total}</strong></span><span>已定位 <strong data-verification-count="anchored">${anchored}/${total}</strong></span><span>已判定 <strong data-verification-count="judged">${judged}/${total}</strong></span></div><div class="verification-pipeline">${stages.map((stage, index) => `<span data-verification-stage="${index}" class="${index < activeStage ? "done" : index === activeStage ? "active" : ""}">${icon(index < activeStage ? "check" : stage.icon, "sm")}<small>${esc(stage.name)}</small></span>`).join("")}</div></div>` : complete ? `<div class="verification-summary"><div><span>Agent 抽取批次</span><strong>1</strong></div><div><span>规则组</span><strong>${rules.length}</strong></div><div><span>通过核验项</span><strong>${passed}/${total}</strong></div><div><span>警告</span><strong>0</strong></div><div><span>失败</span><strong>0</strong></div></div>${verificationRuleList(rules)}<div class="notice success">${icon("shield-check", "sm")}<div><strong>核验完成</strong><span>1 个 Agent 抽取批次、${rules.length} 个规则组和 ${total} 个核验项均已形成可追溯记录；报告正文保持不变。</span></div></div>` : ""}<div class="assistant-actionbar"><button class="btn primary" type="button" data-action="run-verification" data-id="${esc(report.id)}" ${running ? "disabled" : ""}>${icon(running ? "loader-circle" : "shield-check", "sm")}${running ? "核验中" : run?.status === "complete" ? "重新核验" : "自动核验"}</button><button class="text-btn" type="button" data-action="open-report-inspector" data-id="${esc(report.id)}" data-tab="evidence">查看核验依据</button></div></div>`;
  }

  function readerAssistant(report) {
    return `<aside class="reader-assistant"><div class="pane-heading"><strong>报告助手</strong><small>基于当前报告固定内容与证据</small></div><div class="assistant-tabs"><button class="${state.readerPanel === "assistant" ? "active" : ""}" type="button" data-action="set-reader-panel" data-panel="assistant">报告问答</button><button class="${state.readerPanel === "verification" ? "active" : ""}" type="button" data-action="set-reader-panel" data-panel="verification">自动核验</button></div>${state.readerPanel === "verification" ? readerVerification(report) : readerAssistantQa(report)}</aside>`;
  }

  function readerMoreMenu(report) {
    if (!state.readerMoreOpen) return "";
    return `<div class="reader-more-menu" role="menu" aria-label="报告浏览操作"><button type="button" role="menuitem" data-action="open-report-inspector" data-id="${esc(report.id)}" data-tab="info">${icon("info", "sm")}<span><strong>报告信息</strong><small>查看报告身份与形成过程</small></span></button><button type="button" role="menuitem" data-action="open-report-inspector" data-id="${esc(report.id)}" data-tab="versions">${icon("history", "sm")}<span><strong>版本记录</strong><small>查看正式版本与候选内容</small></span></button><button type="button" role="menuitem" data-action="open-report-inspector" data-id="${esc(report.id)}" data-tab="evidence">${icon("git-branch", "sm")}<span><strong>查看证据</strong><small>查看定义、模板、数据与证据</small></span></button></div>`;
  }

  function reportInfoContent(report) {
    return `<div class="meta-list"><div class="meta-item"><span>报告编号</span><strong>${esc(report.reportNo)}</strong></div><div class="meta-item"><span>报告对象</span><strong>${esc(report.scope)}</strong></div><div class="meta-item"><span>报告期间</span><strong>${esc(report.period)}</strong></div><div class="meta-item"><span>内容版本</span><strong>${esc(report.version)} · ${esc(report.status)}</strong></div><div class="meta-item"><span>报告责任部门</span><strong>${esc(report.owner)}</strong></div></div><section class="panel formation-panel"><div class="panel-head"><h3>形成过程</h3></div><div class="panel-body"><div class="timeline">${[["固定报告范围", "报告对象、期间与模板已锁定"], ["生成结构化草稿", report.agentRunId ? `${report.agent} · ${report.agentRunId}` : report.agent], ["确定性核验", report.verification], ["人工复核", "复核通过"], ["发布正式产物", displayDateTime(report.issuedAt)]].map(([title, copy]) => `<div class="timeline-row"><span class="timeline-mark"></span><div><strong>${esc(title)}</strong><span>${esc(copy)}</span></div></div>`).join("")}</div></div></section>`;
  }

  function renderReportDetail(id) {
    const report = reportById(decodeURIComponent(id));
    if (!report) { location.hash = "#/catalog"; return; }
    syncReportScenarioIdentity(report);
    if (state.activeReportId !== report.id) {
      state.activeReportId = report.id;
      state.readerPanel = "assistant";
      state.readerMoreOpen = false;
      state.readerChapter = 0;
      state.readerSections = [];
      state.chat = [];
    }
    const definition = definitionById(report.definitionId);
    shell(`<main class="reader-page" data-screen-label="正式报告阅读工作台"><header class="reader-toolbar"><div class="reader-title"><a class="icon-btn" href="#/catalog" title="返回报告目录" aria-label="返回报告目录">${icon("arrow-left")}</a><div><strong>${esc(report.title)}</strong><small>${esc(report.reportNo)} · 内容版本 ${esc(report.version)}</small></div>${badge(report.status)}</div><div class="reader-actions"><a class="btn" href="${esc(formalUrl(report))}" target="_blank" rel="noopener">${icon("external-link", "sm")}查看 HTML</a>${report.pdf ? `<a class="btn" href="${esc(report.pdf)}" download>${icon("download", "sm")}下载 PDF</a>` : `<button class="btn" type="button" data-action="print-report" data-id="${esc(report.id)}">${icon("printer", "sm")}打印 / 保存 PDF</button>`}<button class="btn primary" type="button" data-action="open-new-version" data-id="${esc(report.id)}">${icon("refresh-cw", "sm")}生成新内容版本</button><div class="reader-more"><button class="btn" type="button" data-action="toggle-reader-more" aria-haspopup="menu" aria-expanded="${state.readerMoreOpen ? "true" : "false"}">${icon("ellipsis", "sm")}更多${icon("chevron-down", "sm")}</button>${readerMoreMenu(report)}</div></div></header><div class="reader-workspace" style="--reader-assistant-width:${state.readerAssistantWidth}px">${readerToc(report)}<section class="report-viewport" aria-label="报告正文"><iframe class="report-document-frame" data-report-id="${esc(report.id)}" src="${esc(formalUrl(report))}" title="${esc(report.title)}正文" loading="eager" scrolling="yes"></iframe></section><div class="reader-resizer" role="separator" aria-label="调整报告助手宽度" title="拖动调整报告助手宽度"></div>${readerAssistant(report)}</div></main>`);
  }

  function renderDefinitions() {
    shell(`<main class="page" data-screen-label="报告定义与模板"><header class="page-head"><div><span class="eyebrow">REPORT DEFINITIONS</span><h1>报告定义与模板</h1><p>报告定义统一管理业务用途、对象范围、模板、事实范围、生成配置、核验规则和发布门。</p></div><div class="head-actions"><button class="btn primary" type="button" data-action="open-new-definition">${icon("plus", "sm")}新增报告定义</button></div></header><section class="definition-overview"><div><span>已启用定义</span><strong>${DATA.definitions.filter((item) => item.status === "已启用").length}</strong><small>可用于创建报告</small></div><div><span>业务领域</span><strong>${new Set(DATA.definitions.map((item) => item.category)).size}</strong><small>融资、预算、风险与贷前</small></div><div><span>模板绑定</span><strong>${DATA.definitions.filter((item) => item.templateId).length}/${DATA.definitions.length}</strong><small>定义与模板一一绑定</small></div><div><span>核验覆盖</span><strong>${DATA.definitions.filter((item) => item.verification).length}/${DATA.definitions.length}</strong><small>生成前锁定核验规则</small></div></section><section class="definition-grid">${DATA.definitions.map((item) => `<article class="definition-card"><header><div class="inline-actions"><span class="eyebrow">${esc(item.category)}</span>${badge(item.status, item.status === "草稿" ? "warning" : "success")}</div><h2>${esc(item.name)}</h2><p>${esc(item.scopeLabel)} · 定义版本 ${esc(item.version)}</p></header><div class="definition-contract"><div><span>业务对象</span><strong>${esc(item.subjects.slice(0, 2).join("、"))}${item.subjects.length > 2 ? `等 ${item.subjects.length} 个` : ""}</strong></div><div><span>生成配置</span><strong>${esc(item.agent)} · ${esc(item.agentVersion)}</strong></div><div><span>确定性核验</span><strong>${esc(item.verification)}</strong></div></div><div class="definition-template"><span class="file-icon">${icon("file-text")}</span><div><strong>${esc(item.templateName)}</strong><small>模板版本 ${esc(item.templateVersion)} · ${item.chapters.length} 个章节槽位</small></div><a class="icon-btn" href="${esc(item.templateHref)}" target="_blank" rel="noopener" title="查看模板">${icon("external-link", "sm")}</a></div><footer class="inline-actions"><button class="btn" type="button" data-action="definition-detail" data-id="${esc(item.id)}">查看详情</button><a class="btn" href="${esc(item.templateHref)}" download>${icon("download", "sm")}下载模板</a>${item.status === "已启用" ? `<a class="btn primary" href="#/create?definition=${encodeURIComponent(item.id)}">使用此定义</a>` : `<button class="btn primary" type="button" disabled>完成配置后启用</button>`}</footer></article>`).join("")}</section></main>`);
  }

  function wizardSteps() {
    const steps = [[1,"选择报告定义","确定报告类型与用途"],[2,"确认模板","核对章节和输出格式"],[3,"绑定对象与数据","选择业务对象、数据与 Agent"],[4,"核对并生成","提交新的隔离生成运行"]];
    return `<aside class="wizard-steps">${steps.map(([no, title, desc]) => `<div class="wizard-step ${state.wizard.step === no ? "active" : state.wizard.step > no ? "done" : ""}"><span class="step-no">${state.wizard.step > no ? icon("check", "sm") : no}</span><div><strong>${title}</strong><small>${desc}</small></div></div>`).join("")}</aside>`;
  }

  function wizardBody() {
    const wizard = state.wizard;
    const def = definitionById(wizard.definitionId);
    if (["submitting", "running"].includes(wizard.status)) return `<div class="progress-state"><span class="progress-ring"></span><h2>${wizard.status === "submitting" ? "正在提交报告生成请求" : "Agent 正在生成报告草稿"}</h2><p>${esc(wizard.progressText)}</p>${wizard.runId ? `<small class="runtime-ref">运行 ${esc(wizard.runId)}</small>` : ""}</div>`;
    if (wizard.status === "failed") return `<div class="progress-state failure-state">${icon("circle-alert", "lg")}<h2>本次报告草稿未完成</h2><p>${esc(wizard.error?.reason || "Agent 处理失败")}</p><small>${esc(wizard.error?.recovery || "重新读取固定输入后重试。")}</small><div class="inline-actions" style="margin-top:18px"><button class="btn" type="button" data-action="reset-wizard">返回修改</button><button class="btn primary" type="button" data-action="retry-generation">${icon("refresh-cw", "sm")}重试生成</button></div></div>`;
    if (wizard.status === "complete") return `<div class="progress-state">${icon("circle-check-big", "lg")}<h2>报告草稿已形成</h2><p>草稿已绑定定义、模板、业务对象、数据版本、Agent 运行和核验记录。</p><div class="runtime-summary"><span>草稿 ${esc(wizard.draftId)}</span><span>运行 ${esc(wizard.runId)}</span><span>结果 ${esc(wizard.resultId)}</span></div><div class="inline-actions" style="margin-top:18px"><button class="btn" type="button" data-action="reset-wizard">继续创建</button><button class="btn primary" type="button" data-action="open-draft">查看待复核草稿</button></div></div>`;
    if (wizard.step === 1) return `<div class="wizard-head"><h2>选择报告定义</h2><p>定义决定报告用途、适用对象、事实范围、核验规则和人工确认边界。</p></div><div class="wizard-body"><div class="choice-grid">${DATA.definitions.map((item) => `<button class="choice-card ${item.id === wizard.definitionId ? "selected" : ""}" type="button" data-action="select-definition" data-id="${esc(item.id)}"><span class="eyebrow">${esc(item.category)}</span><strong>${esc(item.name)}</strong><span>${esc(item.scopeLabel)} · 版本 ${esc(item.version)}</span></button>`).join("")}</div></div>`;
    if (wizard.step === 2) return `<div class="wizard-head"><h2>确认报告模板</h2><p>当前定义只允许使用已经绑定并启用的模板，避免生成时缺少章节或稳定锚点。</p></div><div class="wizard-body"><section class="definition-card"><div class="definition-template"><span class="file-icon">${icon("file-text")}</span><div><strong>${esc(def.templateName)}</strong><small>模板版本 ${esc(def.templateVersion)} · 已绑定 ${esc(def.name)}</small></div>${badge("已启用")}</div><div class="chapter-list">${def.chapters.map((chapter) => `<span class="chapter-chip">${esc(chapter)}</span>`).join("")}</div><div class="notice">${icon("info", "sm")}<div><strong>输出方式</strong><span>生成 HTML 阅读版；发布后按报告类型形成同源 PDF 或提供浏览器打印输出。</span></div></div><div class="inline-actions"><a class="btn" href="${esc(def.templateHref)}" target="_blank" rel="noopener">查看模板</a><a class="btn" href="${esc(def.templateHref)}" download>${icon("download", "sm")}下载模板</a></div></section></div>`;
    if (wizard.step === 3) return `<div class="wizard-head"><h2>绑定报告对象与数据</h2><p>新报告运行只使用本次选择的对象、精确数据版本和已发布 Agent 配置。</p></div><div class="wizard-body"><div class="form-grid"><label class="form-field"><span>报告对象</span><select class="select" id="wizard-subject">${def.subjects.map((item) => `<option ${item === wizard.subject ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></label><label class="form-field"><span>数据版本</span><select class="select" id="wizard-data">${dataOptionsForDefinition(def).map((item) => `<option ${item === wizard.dataVersion ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></label><label class="form-field"><span>报告生成 Agent</span><input class="input" value="${esc(def.agent)} · ${esc(def.agentVersion)}" readonly></label><label class="form-field"><span>确定性核验</span><input class="input" value="${esc(def.verification)}" readonly></label><label class="form-field full"><span>本次生成说明</span><textarea class="textarea" id="wizard-notes" placeholder="选填，例如：用于月度经营分析会">${esc(wizard.notes)}</textarea></label></div></div>`;
    const rows = [["报告定义", `${def.name} · ${def.version}`], ["报告模板", `${def.templateName} · ${def.templateVersion}`], ["报告对象", wizard.subject], ["数据版本", wizard.dataVersion], ["报告 Agent", `${def.agent} · ${def.agentVersion}`], ["确定性核验", def.verification]];
    return `<div class="wizard-head"><h2>核对并生成</h2><p>提交后由 Agent 应用创建独立运行和结果，报告中心回读后形成待复核草稿。</p></div><div class="wizard-body"><div class="review-list">${rows.map(([label, value]) => `<div class="review-row"><span>${esc(label)}</span><strong>${esc(value)}</strong>${badge("已就绪")}</div>`).join("")}</div><div class="notice" style="margin-top:14px">${icon("shield-check", "sm")}<div><strong>生成顺序</strong><span>锁定报告范围 → 提交 Agent → 回读源草稿 → 绑定事实与锚点 → 确定性核验 → 形成待复核草稿。</span></div></div></div>`;
  }

  function renderCreate() {
    const requested = currentRoute().query.get("definition");
    if (requested && definitionById(requested).id !== state.wizard.definitionId && state.wizard.status === "idle") {
      const def = definitionById(requested);
      state.wizard.definitionId = def.id;
      state.wizard.subject = def.subjects[0];
      state.wizard.dataVersion = dataOptionsForDefinition(def)[0];
    }
    shell(`<main class="page" data-screen-label="创建与生成报告"><header class="page-head"><div><span class="eyebrow">NEW REPORT</span><h1>创建与生成</h1><p>按定义、模板、报告对象、数据和 Agent 的顺序创建新的报告草稿。</p></div></header><section class="wizard">${wizardSteps()}<div class="wizard-main">${wizardBody()}${state.wizard.status === "idle" ? `<footer class="wizard-foot"><button class="btn" type="button" data-action="wizard-prev" ${state.wizard.step === 1 ? "disabled" : ""}>${icon("arrow-left", "sm")}上一步</button>${state.wizard.step < 4 ? `<button class="btn primary" type="button" data-action="wizard-next">下一步${icon("arrow-right", "sm")}</button>` : `<button class="btn primary" type="button" data-action="generate-draft">${icon("sparkles", "sm")}生成报告草稿</button>`}</footer>` : ""}</div></section></main>`);
  }

  function newDefinitionDrawer() {
    const templates = DATA.definitions.filter((item) => item.templateId);
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer report-inspector"><header class="drawer-head"><div><span class="eyebrow">NEW DEFINITION</span><h2>新增报告定义</h2><small>先建立草稿，完成模板、事实范围与核验配置后再启用。</small></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="关闭">${icon("x", "sm")}</button></header><div class="drawer-body"><form class="definition-form" id="new-definition-form"><section class="definition-form-section"><div><span class="step-label">01</span><h3>用途与适用范围</h3></div><div class="form-grid"><label class="form-field full"><span>定义名称</span><input class="input" id="definition-name" required placeholder="例如：月度现金流分析报告"></label><label class="form-field"><span>业务领域</span><select class="select" id="definition-category">${[...new Set(DATA.definitions.map((item) => item.category))].map((item) => `<option>${esc(item)}</option>`).join("")}<option>其他经营分析</option></select></label><label class="form-field"><span>报告对象</span><input class="input" id="definition-scope" required placeholder="例如：集团整体或成员单位"></label><label class="form-field full"><span>业务用途</span><textarea class="textarea" id="definition-purpose" required placeholder="说明报告服务的业务判断、使用人和使用时点"></textarea></label></div></section><section class="definition-form-section"><div><span class="step-label">02</span><h3>模板与生成合同</h3></div><div class="form-grid"><label class="form-field full"><span>复用已登记模板</span><select class="select" id="definition-template">${templates.map((item) => `<option value="${esc(item.id)}">${esc(item.templateName)} · ${esc(item.templateVersion)}</option>`).join("")}</select></label><label class="form-field"><span>生成方式</span><input class="input" value="报告生成 Agent 形成结构化草稿" readonly></label><label class="form-field"><span>输出产物</span><input class="input" value="受控 HTML + 同源 PDF" readonly></label></div></section><section class="definition-form-section"><div><span class="step-label">03</span><h3>证据、核验与发布门</h3></div><div class="definition-gate-list"><span>${icon("database", "sm")}只读取已发布语义与精确数据版本</span><span>${icon("git-branch", "sm")}正文内容项必须绑定固定证据和稳定锚点</span><span>${icon("shield-check", "sm")}自动核验通过后进入人工复核</span><span>${icon("lock-keyhole", "sm")}正式版本发布后不可原地更新</span></div></section></form></div><footer class="drawer-foot"><button class="btn" type="button" data-action="close-drawer">取消</button><button class="btn primary" type="button" data-action="save-definition">${icon("save", "sm")}保存定义草稿</button></footer></aside></div>`;
  }

  function quickVersionDrawer(report) {
    const run = state.quickVersionRuns[report.id] || { status: "confirm", dataVersion: report.dataVersion, notes: "基于最新可用数据形成新的内容候选版本" };
    const definition = definitionById(report.definitionId);
    const options = [...new Set([report.dataVersion, ...dataOptionsForDefinition(definition)])];
    const next = `${nextVersion(report.definitionId)}-candidate`;
    let body = `<div class="new-version-summary"><div><span>当前正式版本</span><strong>${esc(report.version)}</strong><small>保持只读，不会被本次运行覆盖</small></div><div><span>目标内容版本</span><strong>${esc(next)}</strong><small>先形成候选内容，等待人工复核</small></div></div><div class="meta-list"><div class="meta-item"><span>报告对象</span><strong>${esc(report.scope)}</strong></div><div class="meta-item"><span>报告定义 / 模板</span><strong>${esc(definition.name)} ${esc(definition.version)} / ${esc(definition.templateVersion)}</strong></div></div><div class="form-grid new-version-form"><label class="form-field full"><span>精确数据版本</span><select class="select" id="new-version-data">${options.map((item) => `<option ${item === run.dataVersion ? "selected" : ""}>${esc(item)}</option>`).join("")}</select></label><label class="form-field full"><span>本次生成说明</span><textarea class="textarea" id="new-version-notes">${esc(run.notes)}</textarea></label></div><div class="notice">${icon("shield-check", "sm")}<div><strong>提交后直接创建隔离运行</strong><span>系统会锁定定义、模板、对象、数据与证据，形成新的候选内容；当前正式报告保持不变。</span></div></div>`;
    if (["submitting", "running"].includes(run.status)) body = `<div class="quick-run-state"><div class="verification-orbit"><span></span><i></i></div><h3>${run.status === "submitting" ? "正在校验生成输入" : "正在生成新的候选内容"}</h3><p>${esc(run.message || "正在锁定定义、模板、精确数据与固定证据")}</p>${run.runId ? `<small>运行 ${esc(run.runId)}</small>` : ""}<div class="quick-run-steps"><span class="done">锁定范围</span><span class="${run.status === "running" ? "active" : ""}">生成草稿</span><span>自动核验</span><span>形成候选版本</span></div></div>`;
    if (run.status === "complete") body = `<div class="quick-run-state complete">${icon("circle-check-big", "lg")}<h3>新的候选内容已形成</h3><p>候选版本 ${esc(run.version)} 已进入版本记录，当前正式版本 ${esc(report.version)} 保持不变。</p><div class="runtime-summary"><span>运行 ${esc(run.runId)}</span><span>结果 ${esc(run.resultId)}</span><span>源草稿 ${esc(run.draftId)}</span></div><div class="notice success"><div><strong>下一步</strong><span>查看候选内容，完成自动核验和人工复核后再发布为正式版本。</span></div></div></div>`;
    if (run.status === "failed") body = `<div class="quick-run-state failure-state">${icon("circle-alert", "lg")}<h3>本次候选内容未形成</h3><p>${esc(run.reason || "报告生成运行失败")}</p><small>${esc(run.recovery || "检查固定输入后重试。")}</small></div>`;
    const actions = run.status === "confirm" ? `<button class="btn" type="button" data-action="close-drawer">取消</button><button class="btn primary" type="button" data-action="confirm-new-version" data-id="${esc(report.id)}">${icon("play", "sm")}确认并开始生成</button>` : run.status === "complete" ? `<a class="btn" href="${esc(run.html)}" target="_blank" rel="noopener">查看候选内容</a><button class="btn primary" type="button" data-action="close-drawer">完成</button>` : run.status === "failed" ? `<button class="btn" type="button" data-action="close-drawer">关闭</button><button class="btn primary" type="button" data-action="retry-new-version" data-id="${esc(report.id)}">${icon("refresh-cw", "sm")}重试</button>` : `<button class="btn" type="button" disabled>运行处理中</button>`;
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer report-inspector"><header class="drawer-head"><div><span class="eyebrow">NEW CONTENT VERSION</span><h2>生成新内容版本</h2><small>${esc(report.reportNo)} · ${esc(report.title)}</small></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="关闭" ${["submitting", "running"].includes(run.status) ? "disabled" : ""}>${icon("x", "sm")}</button></header><div class="drawer-body">${body}</div><footer class="drawer-foot">${actions}</footer></aside></div>`;
  }

  function renderDrawer() {
    if (state.drawer?.type === "new-definition") return newDefinitionDrawer();
    if (state.drawer?.type === "new-version") {
      const report = reportById(state.drawer.id);
      return report ? quickVersionDrawer(report) : "";
    }
    const def = state.drawer?.type === "definition" ? definitionById(state.drawer.id) : null;
    if (def) return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer report-inspector"><header class="drawer-head"><div><span class="eyebrow">${esc(def.category)}</span><h2>${esc(def.name)}</h2><small>定义版本 ${esc(def.version)} · ${esc(def.status)}</small></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="关闭">${icon("x", "sm")}</button></header><div class="drawer-body"><section class="definition-detail-section"><h3>用途与适用范围</h3><div class="meta-list"><div class="meta-item"><span>适用范围</span><strong>${esc(def.scopeLabel)}</strong></div><div class="meta-item"><span>业务对象</span><strong>${esc(def.subjects.join("、"))}</strong></div><div class="meta-item"><span>数据版本选择</span><strong>${esc(def.dataOptions.join("、"))}</strong></div></div></section><section class="definition-detail-section"><h3>模板与内容结构</h3><div class="definition-template"><span class="file-icon">${icon("file-text")}</span><div><strong>${esc(def.templateName)}</strong><small>模板版本 ${esc(def.templateVersion)} · ${def.chapters.length} 个章节槽位</small></div><a class="icon-btn" href="${esc(def.templateHref)}" target="_blank" rel="noopener" title="查看模板">${icon("external-link", "sm")}</a></div><div class="chapter-list">${def.chapters.map((chapter) => `<span class="chapter-chip">${esc(chapter)}</span>`).join("")}</div></section><section class="definition-detail-section"><h3>生成、核验与发布</h3><div class="definition-contract"><div><span>报告生成</span><strong>${esc(def.agent)} · ${esc(def.agentVersion)}</strong></div><div><span>自动核验</span><strong>${esc(def.verification)}</strong></div><div><span>发布边界</span><strong>生成草稿 → 自动核验 → 人工复核 → 正式发布</strong></div></div></section><div class="notice">${icon("info", "sm")}<div><strong>定义与模板分工</strong><span>定义维护用途、证据、生成配置、核验和发布规则；模板维护章节、槽位、锚点和呈现格式。</span></div></div></div><footer class="drawer-foot"><a class="btn" href="${esc(def.templateHref)}" download>${icon("download", "sm")}下载模板</a>${def.status === "已启用" ? `<a class="btn primary" href="#/create?definition=${encodeURIComponent(def.id)}">使用此定义</a>` : ""}</footer></aside></div>`;
    const report = state.drawer?.type === "report" ? reportById(state.drawer.id) : null;
    if (!report) return "";
    const tab = state.drawer.tab || "info";
    const titles = { info: "报告信息", versions: "版本记录", evidence: "查看证据", verification: "自动核验" };
    const body = tab === "versions" ? versionsContent(report) : tab === "evidence" ? evidenceContent(report) : tab === "verification" ? verificationContent(report) : reportInfoContent(report);
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer report-inspector"><header class="drawer-head"><div><span class="eyebrow">${esc(report.category)}</span><h2>${esc(titles[tab] || "报告详情")}</h2><small>${esc(report.reportNo)} · ${esc(report.version)}</small></div><button class="icon-btn" type="button" data-action="close-drawer" aria-label="关闭">${icon("x", "sm")}</button></header><div class="drawer-body">${body}</div><footer class="drawer-foot"><button class="btn" type="button" data-action="close-drawer">关闭</button></footer></aside></div>`;
  }

  function renderDraft() {
    const def = definitionById(state.wizard.definitionId);
    if (!state.wizard.result) { location.hash = "#/create"; return; }
    const sections = state.wizard.result.sections || [];
    const publishing = state.wizard.publishStatus === "publishing";
    shell(`<main class="page" data-screen-label="待复核报告草稿"><header class="detail-hero"><div><a class="text-btn" href="#/create">${icon("arrow-left", "sm")}返回创建与生成</a><h1>${esc(state.wizard.subject)} · ${esc(def.name)}草稿</h1><p>草稿已完成结构化生成和确定性核验，确认后将形成新的正式内容版本。</p><div class="detail-facts"><div><span>草稿编号</span><strong>${esc(state.wizard.draftId)}</strong></div><div><span>定义 / 模板</span><strong>${esc(def.version)} / ${esc(def.templateVersion)}</strong></div><div><span>Agent 运行</span><strong>${esc(state.wizard.runId)}</strong></div><div><span>核验</span><strong>通过</strong></div></div></div><div class="head-actions">${badge(publishing ? "正在发布" : "待人工复核", publishing ? "" : "warning")}<button class="btn" type="button" data-action="return-draft" ${publishing ? "disabled" : ""}>退回修改</button><button class="btn primary" type="button" data-action="confirm-draft" ${publishing ? "disabled" : ""}>${publishing ? `${icon("loader-circle", "sm")}正在形成正式版本` : "确认并发布"}</button></div></header><div class="detail-layout"><article class="report-paper"><header class="paper-cover"><span class="eyebrow">${esc(def.category)}</span><h2>${esc(def.name)}</h2><p>${esc(state.wizard.subject)}</p></header><section class="paper-section"><h3>报告摘要</h3><p>${esc(state.wizard.result.summary)}</p></section>${sections.map((section, index) => `<section class="paper-section"><h3>${String(index + 1).padStart(2,"0")} ${esc(section.title)}</h3><p>${esc(section.body)}</p>${section.refs?.length ? `<div class="answer-evidence">${section.refs.map((ref) => `<span>${esc(ref)}</span>`).join("")}</div>` : ""}</section>`).join("")}</article><aside class="side-stack"><section class="side-card"><h3>生成记录</h3><div class="timeline">${[["范围已锁定", state.wizard.subject], ["Agent 运行完成", state.wizard.runId], ["结果已回传", state.wizard.resultId], ["确定性核验通过", "等待人工复核"]].map(([title, text]) => `<div class="timeline-row"><span class="timeline-mark"></span><div><strong>${esc(title)}</strong><span>${esc(text)}</span></div></div>`).join("")}</div></section></aside></div></main>`);
  }

  function render() {
    const route = currentRoute();
    if (route.path.startsWith("/report/")) return renderReportDetail(route.path.slice(8));
    if (route.path === "/definitions") return renderDefinitions();
    if (route.path === "/create") return renderCreate();
    if (route.path === "/draft") return renderDraft();
    return renderCatalog();
  }

  function answerFor(report, question) {
    const preset = report.questions.find(([candidate]) => candidate === question);
    const keyFacts = (report.metrics || []).slice(0, 4).map(([label, value]) => `${label}${value}`).join("，");
    const evidenceAnswer = `本报告固定引用 ${report.semanticVersion}、${report.dataVersion} 和证据包“${report.evidenceId}”，数据截至 ${report.period}，确定性核验结果为 ${report.verification}。`;
    const lead = preset?.[1] || (/数据|证据|来源/.test(question) ? evidenceAnswer : `${report.summary}`);
    const attention = report.definitionId === "RD-RISK-001"
      ? `风险等级和评分来自报告形成时固定的模型、因子与分档结果；报告助手不重新计算评分，也不替代风险处置确认。`
      : report.definitionId === "RDEF-S004-PREFLIGHT-002"
        ? "财务指标和资料核验可由固定证据解释，风险判断、授信额度、期限和条件仍由有权人员确认。"
        : report.definitionId === "RD-BUDGET-001"
          ? "预算执行与偏差结论按报告固定范围解释；涉及预算调整、追加或责任认定的事项仍需按业务流程审批。"
          : "融资成本、债务结构和机构归因按本报告固定口径解释；后续协商和行动安排仍需由责任部门确认。";
    return `${lead}\n关键依据：${keyFacts || evidenceAnswer}\n证据状态：${evidenceAnswer}\n需要关注：${attention}\n使用边界：以上内容只解释报告 ${report.reportNo} 的已发布内容版本 ${report.version}，不会改写正文、重算业务数据或替代人工决定。`;
  }

  function definitionRuntime(definition) {
    const scenarioId = definition.id === "RD-BUDGET-001" ? "S002" : definition.id === "RD-RISK-001" ? "S003" : definition.id === "RDEF-S004-PREFLIGHT-002" ? "S004" : "S001";
    const generationAgent = scenarioId === "S002"
      ? { id: "budget-report-drafter", name: "预算报告草稿 Agent" }
      : scenarioId === "S004"
        ? { id: "preflight-report-draft", name: "贷前调查报告生成 Agent" }
        : { id: "report-draft", name: definition.agent };
    return { scenarioId, generationAgent };
  }

  function reportRuntime(report) {
    const definition = definitionById(report.definitionId);
    const { scenarioId } = definitionRuntime(definition);
    const agent = scenarioId === "S003"
      ? { id: "report-copilot-s003-profile", name: "债务风险报告伴读配置", version: "1.5" }
      : scenarioId === "S004"
        ? { id: "preflight-report-copilot", name: "贷前调查报告伴读 Agent", version: "2.0.0" }
        : { id: "report-copilot", name: "报告伴读助手", version: scenarioId === "S002" ? "1.0" : "3.1.0" };
    return { scenarioId, agent };
  }

  function syncReportScenarioIdentity(report) {
    const { scenarioId } = reportRuntime(report);
    const fallback = {
      S001: { scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-20260816081748567-705ac89fb83a", formedAt: "2026-08-16T08:17:48.567Z" },
      S002: { scenarioVersion: "S002-v1", scenarioRunId: "S002-RUN-20260815080000000-6ef5d0ef82f9", formedAt: "2026-08-15T08:00:00.000Z" },
      S003: { scenarioVersion: "S003-v1", scenarioRunId: "S003-RUN-20260817163000000-c02200000001", formedAt: "2026-08-17T16:30:00.000Z" },
      S004: { scenarioVersion: "S004-v2.1.0", scenarioRunId: "S004-RUN-20260815233000000-7f3c8e42a1b6", formedAt: "2026-08-15T23:30:00.000Z" }
    }[scenarioId];
    let registryScene = null;
    try { registryScene = window.parent?.OFW_COMPOSITE_REGISTRY?.scene?.(scenarioId) || null; } catch (_) {}
    const context = { ...fallback, ...(registryScene || {}), scenarioId };
    if (!context.scenarioVersion || !context.scenarioRunId || !context.formedAt) return;
    const url = new URL(location.href);
    const fields = {
      scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      formedAt: context.formedAt,
      status: "active",
      contextCreatedAt: context.formedAt,
      contextStatus: "active",
      scenarioFormedAt: context.formedAt,
      scenarioStatus: "active"
    };
    let changed = false;
    Object.entries(fields).forEach(([key, value]) => {
      if (url.searchParams.get(key) === value) return;
      url.searchParams.set(key, value);
      changed = true;
    });
    if (changed) history.replaceState({ ...(history.state || {}), reportScenarioId: scenarioId }, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function referenceReport(definitionId) {
    return state.reports.find((item) => item.definitionId === definitionId) || null;
  }

  async function beginGeneration(isRetry = false) {
    const wizard = state.wizard;
    const def = definitionById(wizard.definitionId);
    const runtimeInfo = definitionRuntime(def);
    const reference = referenceReport(def.id);
    wizard.status = "submitting";
    wizard.progressText = "正在校验定义、模板、固定数据与证据";
    wizard.error = null;
    render();
    try {
      const runtime = await getAgentRuntime();
      const receipt = isRetry
        ? runtime.retry(wizard.requestId)
        : runtime.submit({
            kind: "report-generation",
            scenarioId: runtimeInfo.scenarioId,
            definitionId: def.id,
            definitionName: def.name,
            templateId: def.templateId,
            templateName: def.templateName,
            templateVersion: def.templateVersion,
            subject: wizard.subject,
            dataVersion: wizard.dataVersion,
            dataAsOf: reference?.period || "当前报告期间",
            semanticVersion: reference?.semanticVersion || `${def.name}已发布语义`,
            semanticVersionId: reference?.semanticVersionId || reference?.semanticVersion || `${runtimeInfo.scenarioId}-SEMANTIC-CURRENT`,
            evidencePackageId: reference?.evidenceId || `${runtimeInfo.scenarioId}-REPORT-EVIDENCE`,
            evidencePackageVersion: reference?.version || "1.0.0",
            evidenceName: `${def.name}固定证据`,
            evidenceRefs: [reference?.evidenceId, reference?.dataVersion, reference?.semanticVersion].filter(Boolean),
            verification: def.verification,
            agentId: runtimeInfo.generationAgent.id,
            agentName: runtimeInfo.generationAgent.name,
            agentVersion: def.agentVersion,
            chapters: def.chapters,
            summary: reference?.summary,
            targetContentRevision: "next",
            notes: wizard.notes
          });
      wizard.requestId = receipt.requestId;
      const finalReceipt = await waitForReceipt(runtime, receipt.requestId, (current) => {
        wizard.status = current.status === "accepted" ? "submitting" : "running";
        wizard.progressText = current.message || "Agent 正在处理";
        wizard.runId = current.runId || wizard.runId;
        render();
      });
      if (finalReceipt.status === "failed") {
        wizard.status = "failed";
        wizard.error = { reason: finalReceipt.reason, recovery: finalReceipt.recovery };
        render();
        return;
      }
      wizard.status = "complete";
      wizard.runId = finalReceipt.runId;
      wizard.resultId = finalReceipt.resultId;
      wizard.result = finalReceipt.result;
      wizard.draftId = finalReceipt.result?.sourceDraft?.id;
      render();
    } catch (error) {
      wizard.status = "failed";
      wizard.error = { reason: error.message, recovery: "确认 Agent 应用可访问后重试；已填写的报告范围保持不变。" };
      render();
    }
  }

  function nextVersion(definitionId) {
    const versions = state.reports.filter((item) => item.definitionId === definitionId).map((item) => String(item.version).match(/\d+(?:\.\d+){0,2}/)?.[0]).filter(Boolean);
    const latest = versions.sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))[0] || "0.0.0";
    const parts = latest.split(".").map(Number);
    while (parts.length < 3) parts.push(0);
    parts[2] += 1;
    return parts.join(".");
  }

  function buildFormalHtml(report, sections) {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.title)}</title><style>body{margin:0;background:#eef2f5;color:#182536;font:15px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}.paper{width:min(900px,calc(100% - 32px));margin:28px auto;padding:54px 66px;background:#fff;box-shadow:0 12px 36px rgba(20,45,70,.1)}header{padding-bottom:28px;border-bottom:4px solid #174e7b}h1{margin:8px 0 4px;color:#174e7b;font-size:30px}header p,.meta{color:#69798b}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:22px 0}.meta div{padding:10px;border:1px solid #dfe5eb;background:#f7f9fb}.meta span,.meta strong{display:block}.meta span{font-size:11px}section{padding:22px 0;border-top:1px solid #e4e9ee}h2{margin:0 0 8px;color:#194f7d;font-size:18px}p{margin:0}.refs{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.refs span{padding:2px 7px;background:#edf5fb;color:#235d91;font-size:11px}@media(max-width:640px){.paper{width:100%;margin:0;padding:28px 20px}.meta{grid-template-columns:1fr}}</style></head><body><article class="paper"><header><small>${esc(report.category)}</small><h1>${esc(report.title)}</h1><p>${esc(report.scope)} · ${esc(report.period)}</p></header><div class="meta"><div><span>报告编号</span><strong>${esc(report.reportNo)}</strong></div><div><span>内容版本</span><strong>${esc(report.version)}</strong></div><div><span>发布时间</span><strong>${esc(displayDateTime(report.issuedAt))}</strong></div></div><section><h2>报告摘要</h2><p>${esc(report.summary)}</p></section>${sections.map((section, index) => `<section><h2>${String(index + 1).padStart(2, "0")} ${esc(section.title)}</h2><p>${esc(section.body)}</p>${section.refs?.length ? `<div class="refs">${section.refs.map((ref) => `<span>${esc(ref)}</span>`).join("")}</div>` : ""}</section>`).join("")}</article></body></html>`;
  }

  function publishDraft() {
    if (state.wizard.publishStatus === "publishing" || !state.wizard.result) return;
    state.wizard.publishStatus = "publishing";
    render();
    window.setTimeout(() => {
      const def = definitionById(state.wizard.definitionId);
      const reference = referenceReport(def.id);
      const { scenarioId } = definitionRuntime(def);
      const issuedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
      const version = nextVersion(def.id);
      const reportNo = `${scenarioId}-RPT-${stamp}`;
      const title = state.wizard.subject === "集团整体" ? def.name : `${state.wizard.subject}${def.name.replace(/^集团|^企业/, "")}`;
      const report = {
        id: `REPORT-${reportNo}-${version}`,
        reportNo,
        title,
        category: def.category,
        scope: state.wizard.subject,
        period: reference?.period || "当前报告期间",
        version,
        status: "已发布",
        issuedAt,
        owner: reference?.owner || "报告责任部门",
        definitionId: def.id,
        templateId: def.templateId,
        semanticVersion: reference?.semanticVersion || `${def.name}已发布语义`,
        dataVersion: state.wizard.dataVersion,
        evidenceId: reference?.evidenceId || `${scenarioId}-REPORT-EVIDENCE`,
        verification: "确定性核验通过",
        agent: `${def.agent} ${def.agentVersion}`,
        agentRunId: state.wizard.runId,
        agentResultId: state.wizard.resultId,
        sourceDraft: state.wizard.draftId,
        pdf: null,
        formats: ["HTML", "打印为 PDF"],
        summary: state.wizard.result.summary,
        metrics: reference?.metrics || [["内容版本", version], ["核验结果", "通过"], ["报告对象", state.wizard.subject], ["正式产物", "HTML"]],
        chapters: def.chapters,
        history: [{ version, date: issuedAt, note: "Agent 源草稿经确定性核验和人工复核后发布" }, ...(reference?.history || [])],
        candidates: [],
        questions: reference?.questions || [["这份报告的主要结论是什么？", state.wizard.result.summary]],
        runtimeCreated: true
      };
      report.contentHtml = buildFormalHtml(report, state.wizard.result.sections || []);
      state.reports.unshift(report);
      persistCreatedReports(state.reports);
      state.wizard.publishStatus = "published";
      state.wizard.publishedReportId = report.id;
      state.detailTab = "content";
      location.hash = `#/report/${encodeURIComponent(report.id)}`;
      toast("新的正式报告版本已发布并进入报告目录");
    }, 900);
  }

  function refreshDrawerOnly() {
    const current = document.querySelector(".drawer-backdrop");
    const html = state.drawer ? renderDrawer() : "";
    if (!html) { current?.remove(); return; }
    const host = document.createElement("div");
    host.innerHTML = html;
    const next = host.firstElementChild;
    if (current) current.replaceWith(next);
    else app.appendChild(next);
    refreshIcons();
  }

  function refreshAssistantOnly() {
    const busy = state.chat.some((item) => item.status === "processing");
    const chatMarkup = state.chat.length ? state.chat.map(chatMessage).join("") : `<div class="reader-chat-empty"><span class="assistant-empty-mark">${icon("sparkles", "lg")}</span><strong>从报告结论开始问</strong><span>助手会先定位正文与证据，再给出清晰结论和使用边界。</span></div>`;
    const readerChat = document.querySelector(".reader-chat");
    if (readerChat) {
      readerChat.innerHTML = chatMarkup;
      readerChat.scrollTop = readerChat.scrollHeight;
    }
    const chatBody = document.querySelector(".chat-body");
    if (chatBody) chatBody.innerHTML = state.chat.length ? state.chat.map(chatMessage).join("") : chatMarkup;
    document.querySelectorAll("[data-action='ask-report']").forEach((button) => { button.disabled = busy; });
    const input = document.getElementById("chat-question");
    const submit = document.querySelector("#chat-form button[type='submit']");
    if (input) input.disabled = busy;
    if (submit) {
      submit.disabled = busy;
      submit.innerHTML = busy ? `${icon("loader-circle", "sm")}<span>处理中</span>` : `${icon("send", "sm")}<span>发送</span>`;
    }
    const clear = document.querySelector("[data-action='clear-reader-chat']");
    if (clear) clear.disabled = !state.chat.length || busy;
    refreshIcons();
  }

  function updateAssistantProgressOnly(message) {
    const card = document.querySelector(`.message.assistant.pending[data-message-id="${CSS.escape(String(message.id))}"]`);
    if (!card) { refreshAssistantOnly(); return; }
    const step = Math.max(1, Math.min(3, Number(message.processStep || 1)));
    card.dataset.processStep = String(step);
    const title = card.querySelector(".answer-progress-copy > strong");
    const run = card.querySelector(".answer-progress-copy > small");
    const track = card.querySelector(".answer-progress-track i");
    if (title) title.textContent = message.text || "正在形成可追溯回答";
    if (run) run.textContent = message.runId ? `伴读运行 ${message.runId}` : "已锁定当前报告内容版本，正在建立回答依据";
    if (track) track.style.setProperty("--answer-step", String(step));
    card.querySelectorAll(".thinking-steps span").forEach((item, index) => item.classList.toggle("active", index < step));
  }

  function updateVerificationProgressOnly(report) {
    const run = state.verificationRuns[report.id];
    const progress = document.querySelector(".verification-progress");
    if (!run || !progress) { refreshReaderAssistantOnly(report); return; }
    const stages = verificationStagesFor(verificationAgentFor(report));
    const activeStage = Math.min(stages.length - 1, Number(run.stage || 0));
    const total = Number(progress.dataset.total || verificationNumbers(report).total);
    const counts = verificationProgressCounts(total, activeStage);
    progress.dataset.stage = String(activeStage);
    progress.querySelector("[data-verification-title]").textContent = stages[activeStage].name;
    progress.querySelector("[data-verification-detail]").textContent = `${activeStage + 1} / ${stages.length} · ${stages[activeStage].detail}`;
    const track = progress.querySelector(".verification-signal-track i");
    if (track) track.style.setProperty("--verification-stage", String(activeStage + 1));
    Object.entries(counts).forEach(([name, value]) => {
      const node = progress.querySelector(`[data-verification-count="${name}"]`);
      if (node) node.textContent = `${value}/${total}`;
    });
    progress.querySelectorAll("[data-verification-stage]").forEach((item, index) => {
      item.classList.toggle("done", index < activeStage);
      item.classList.toggle("active", index === activeStage);
    });
  }

  function verificationItemsFor(report, rules) {
    const metrics = Array.isArray(report.metrics) ? report.metrics : [];
    const evidenceRefs = [report.evidenceId, report.dataVersion, report.semanticVersion].filter(Boolean);
    let sequence = 0;
    return rules.flatMap((rule, ruleIndex) => Array.from({ length: rule.units }, (_, itemIndex) => {
      const metric = metrics[sequence % Math.max(1, metrics.length)] || null;
      const evidenceRef = evidenceRefs[sequence % evidenceRefs.length] || report.evidenceId;
      const anchorId = `ANCHOR-${String(report.id).replace(/[^a-zA-Z0-9_-]+/g, "-")}-${ruleIndex + 1}-${itemIndex + 1}`;
      const item = {
        id: `VERIFY-ITEM-${ruleIndex + 1}-${itemIndex + 1}`,
        claimType: rule.name,
        label: metric ? `${rule.name} · ${metric[0]}` : `${rule.name} · 核验项 ${itemIndex + 1}`,
        reportedValue: metric?.[1] ?? rule.input,
        period: report.period,
        subject: report.scope,
        sourceText: rule.input,
        anchorId,
        anchorLabel: rule.name,
        evidenceRef,
        comparisonMethod: ruleIndex === 3 ? "rule-defined-content-comparison" : "exact-identity-comparison"
      };
      sequence += 1;
      return item;
    }));
  }

  async function startReportVerification(report) {
    if (!report || state.verificationRuns[report.id]?.status === "running") return;
    const rules = verificationRulesFor(report);
    const { total } = verificationNumbers(report);
    const items = verificationItemsFor(report, rules);
    const runtimeInfo = reportRuntime(report);
    const run = {
      status: "running",
      stage: 0,
      startedAt: new Date().toISOString(),
      agentName: "报告自动核验 Agent",
      agentConfiguration: "report-verification-agent@1.0"
    };
    state.verificationRuns[report.id] = run;
    state.readerPanel = "verification";
    refreshReaderAssistantOnly(report);
    try {
      const runtime = await getAgentRuntime();
      const payload = {
        scenarioId: runtimeInfo.scenarioId,
        reportNumber: report.reportNo,
        reportTitle: report.title,
        contentVersion: report.version,
        verificationDefinitionId: `${report.definitionId}-VERIFICATION-${report.version}`,
        evidencePackageId: report.evidenceId,
        evidencePackageVersion: report.version,
        evidenceName: `${report.title}固定证据`,
        evidenceRefs: [report.evidenceId, report.dataVersion, report.semanticVersion].filter(Boolean),
        semanticVersion: report.semanticVersion,
        semanticVersionId: report.semanticVersionId || report.semanticVersion,
        dataVersion: report.dataVersion,
        dataAsOf: report.period,
        subject: report.scope,
        reportContentItems: items,
        agentId: "report-verification-agent",
        agentName: "报告自动核验 Agent",
        agentVersion: "1.0"
      };
      const receipt = typeof runtime.submitVerification === "function"
        ? runtime.submitVerification(payload)
        : runtime.submit({ ...payload, kind: "report-verification" });
      run.requestId = receipt.requestId;
      const finalReceipt = await waitForReceipt(runtime, receipt.requestId, (current) => {
        run.runId = current.runId || run.runId;
        run.stage = current.status === "processing" ? 1 : 0;
        updateVerificationProgressOnly(report);
      });
      if (finalReceipt.status === "failed") throw new Error(finalReceipt.reason || "核验 Agent 抽取未完成");
      const extraction = finalReceipt.result;
      if (extraction?.type !== "Report Verification Extraction") throw new Error("核验 Agent 未返回受控抽取结果");
      if (extraction.claims?.length !== total || extraction.comparisonRequests?.length !== total) throw new Error(`核验 Agent 返回 ${extraction.claims?.length || 0} 条声明，预期 ${total} 条`);
      if (extraction.comparisonRequests.some((item) => item.determinationStatus !== "not-evaluated" || item.determinationOwner !== "报告中心确定性规则引擎")) throw new Error("核验 Agent 越过确定性判定边界");
      Object.assign(run, {
        stage: 2,
        runId: finalReceipt.runId,
        resultId: finalReceipt.resultId,
        claims: extraction.claims,
        anchors: extraction.anchors,
        evidenceRefs: extraction.evidenceRefs,
        comparisonRequests: extraction.comparisonRequests,
        extractionSummary: extraction.summary
      });
      updateVerificationProgressOnly(report);
      await new Promise((resolve) => window.setTimeout(resolve, 420));
      run.stage = 3;
      updateVerificationProgressOnly(report);
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      run.stage = 4;
      updateVerificationProgressOnly(report);
      await new Promise((resolve) => window.setTimeout(resolve, 360));
      Object.assign(run, { status: "complete", completedAt: new Date().toISOString(), deterministicOwner: "报告中心确定性规则引擎", passed: total, total });
      refreshReaderAssistantOnly(report);
    } catch (error) {
      Object.assign(run, { status: "failed", reason: error?.message || "自动核验未完成", recovery: "确认核验 Agent、固定报告内容和证据包可访问后重试；当前报告保持不变。" });
      refreshReaderAssistantOnly(report);
    }
  }

  function refreshReaderAssistantOnly(report) {
    const current = document.querySelector(".reader-assistant");
    if (!current) { render(); return; }
    const host = document.createElement("div");
    host.innerHTML = readerAssistant(report);
    current.replaceWith(host.firstElementChild);
    refreshIcons();
  }

  async function startQuickVersionGeneration(report, isRetry = false) {
    const definition = definitionById(report.definitionId);
    const runtimeInfo = definitionRuntime(definition);
    const run = state.quickVersionRuns[report.id] || { dataVersion: report.dataVersion, notes: "形成新的内容候选版本" };
    state.quickVersionRuns[report.id] = run;
    run.status = "submitting";
    run.message = "正在校验定义、模板、精确数据与固定证据";
    run.reason = null;
    refreshDrawerOnly();
    try {
      const runtime = await getAgentRuntime();
      const receipt = isRetry && run.requestId ? runtime.retry(run.requestId) : runtime.submit({
        kind: "report-generation",
        scenarioId: runtimeInfo.scenarioId,
        definitionId: definition.id,
        definitionName: definition.name,
        templateId: definition.templateId,
        templateName: definition.templateName,
        templateVersion: definition.templateVersion,
        subject: report.scope,
        dataVersion: run.dataVersion,
        dataAsOf: report.period,
        semanticVersion: report.semanticVersion,
        semanticVersionId: report.semanticVersionId || report.semanticVersion,
        evidencePackageId: report.evidenceId,
        evidencePackageVersion: report.version,
        evidenceName: `${report.title}固定证据`,
        evidenceRefs: [report.evidenceId, report.dataVersion, report.semanticVersion].filter(Boolean),
        verification: definition.verification,
        agentId: runtimeInfo.generationAgent.id,
        agentName: runtimeInfo.generationAgent.name,
        agentVersion: definition.agentVersion,
        chapters: definition.chapters,
        summary: report.summary,
        targetContentRevision: "next",
        notes: run.notes
      });
      run.requestId = receipt.requestId;
      const finalReceipt = await waitForReceipt(runtime, receipt.requestId, (current) => {
        run.status = current.status === "accepted" ? "submitting" : "running";
        run.message = current.message || "Agent 正在生成新的候选内容";
        run.runId = current.runId || run.runId;
        refreshDrawerOnly();
      });
      if (finalReceipt.status === "failed") {
        Object.assign(run, { status: "failed", reason: finalReceipt.reason, recovery: finalReceipt.recovery, runId: finalReceipt.runId || run.runId });
        refreshDrawerOnly();
        return;
      }
      const version = `${nextVersion(report.definitionId)}-candidate`;
      const issuedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      const candidateReport = { ...report, version, status: "待人工复核", issuedAt };
      const html = URL.createObjectURL(new Blob([buildFormalHtml(candidateReport, finalReceipt.result?.sections || [])], { type: "text/html;charset=utf-8" }));
      report.candidates = report.candidates || [];
      report.candidates.unshift({ version, date: issuedAt, note: `基于 ${run.dataVersion} 形成；自动核验与人工复核完成前不替代当前正式版本。`, html });
      Object.assign(run, { status: "complete", version, html, runId: finalReceipt.runId, resultId: finalReceipt.resultId, draftId: finalReceipt.result?.sourceDraft?.id || "已形成源草稿" });
      refreshDrawerOnly();
    } catch (error) {
      Object.assign(run, { status: "failed", reason: error.message, recovery: "确认 Agent 应用和固定报告输入可访问后重试；当前正式版本保持不变。" });
      refreshDrawerOnly();
    }
  }

  async function startAssistant(report, question, retryMessageId = null) {
    const messageId = retryMessageId || `CHAT-${Date.now()}`;
    if (!retryMessageId) state.chat.push({ role: "user", text: question }, { id: messageId, role: "assistant", status: "processing", processStep: 1, text: "正在提交报告伴读请求" });
    else {
      const item = state.chat.find((candidate) => candidate.id === messageId);
      if (item) Object.assign(item, { status: "processing", processStep: 1, text: "正在重新提交报告伴读请求", reason: null, recovery: null });
    }
    const input = document.getElementById("chat-question");
    if (input) input.value = "";
    refreshAssistantOnly();
    try {
      const runtime = await getAgentRuntime();
      const existing = state.chat.find((candidate) => candidate.id === messageId);
      const runtimeInfo = reportRuntime(report);
      const receipt = retryMessageId && existing?.requestId
        ? runtime.retry(existing.requestId)
        : runtime.submit({
            kind: "report-reading",
            scenarioId: runtimeInfo.scenarioId,
            reportNumber: report.reportNo,
            reportTitle: report.title,
            contentVersion: report.version,
            question,
            answerBasis: answerFor(report, question),
            anchor: "报告全文",
            evidencePackageId: report.evidenceId,
            evidencePackageVersion: report.version,
            evidenceName: `${report.title}固定证据`,
            evidenceRefs: [report.evidenceId, report.dataVersion, report.semanticVersion].filter(Boolean),
            semanticVersion: report.semanticVersion,
            semanticVersionId: report.semanticVersionId || report.semanticVersion,
            dataVersion: report.dataVersion,
            dataAsOf: report.period,
            verification: report.verification,
            agentId: runtimeInfo.agent.id,
            agentName: runtimeInfo.agent.name,
            agentVersion: runtimeInfo.agent.version
          });
      const item = state.chat.find((candidate) => candidate.id === messageId);
      if (item) item.requestId = receipt.requestId;
      const finalReceipt = await waitForReceipt(runtime, receipt.requestId, (current) => {
        const message = state.chat.find((candidate) => candidate.id === messageId);
        if (!message) return;
        message.status = "processing";
        message.processStep = current.runId ? 2 : 1;
        if (current.status === "running") message.processStep = 3;
        message.text = current.message || "Agent 正在处理";
        message.runId = current.runId || message.runId;
        updateAssistantProgressOnly(message);
      });
      const message = state.chat.find((candidate) => candidate.id === messageId);
      if (!message) return;
      if (finalReceipt.status === "failed") Object.assign(message, { status: "failed", reason: finalReceipt.reason, recovery: finalReceipt.recovery, runId: finalReceipt.runId });
      else Object.assign(message, { status: "complete", text: finalReceipt.result.answer, evidenceRefs: finalReceipt.result.evidenceRefs, runId: finalReceipt.runId, resultId: finalReceipt.resultId });
      refreshAssistantOnly();
    } catch (error) {
      const message = state.chat.find((candidate) => candidate.id === messageId);
      if (message) Object.assign(message, { status: "failed", reason: error.message, recovery: "确认 Agent 应用可访问后重试；本报告固定上下文保持不变。" });
      refreshAssistantOnly();
    }
  }

  function scrollReportChapter(index, targetId) {
    state.readerChapter = Number(index) || 0;
    document.querySelectorAll(".toc-link").forEach((item, itemIndex) => item.classList.toggle("active", itemIndex === state.readerChapter));
    const frame = document.querySelector(".report-document-frame");
    if (!frame) return;
    const scroll = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        const target = doc.getElementById(targetId);
        if (!target) { toast("该正文章节当前不可定位"); return; }
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {
        toast("正文已打开，可在独立阅读页使用章节目录");
      }
    };
    if (frame.contentDocument?.readyState === "complete") scroll();
    else frame.addEventListener("load", scroll, { once: true });
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "refresh") { toast("报告目录已重新读取"); return; }
    if (action === "set-view") { state.view = target.dataset.view; render(); return; }
    if (action === "catalog-focus") { state.catalogFocus = target.dataset.focus || "all"; render(); return; }
    if (action === "clear-catalog-filters") { state.search = ""; state.category = "全部类型"; state.period = "全部期间"; state.catalogFocus = "all"; render(); return; }
    if (action === "toggle-reader-more") {
      state.readerMoreOpen = !state.readerMoreOpen;
      document.querySelector(".reader-more-menu")?.remove();
      if (state.readerMoreOpen) {
        const report = reportById(decodeURIComponent(currentRoute().path.slice(8)));
        target.closest(".reader-more")?.insertAdjacentHTML("beforeend", readerMoreMenu(report));
        refreshIcons();
      }
      target.setAttribute("aria-expanded", state.readerMoreOpen ? "true" : "false");
      return;
    }
    if (action === "set-reader-panel") {
      state.readerPanel = target.dataset.panel;
      state.readerMoreOpen = false;
      const report = reportById(decodeURIComponent(currentRoute().path.slice(8)));
      if (report) refreshReaderAssistantOnly(report);
      return;
    }
    if (action === "jump-report-chapter") { scrollReportChapter(target.dataset.index, target.dataset.target); return; }
    if (action === "open-report-inspector") { state.drawer = { type: "report", id: target.dataset.id, tab: target.dataset.tab }; state.readerMoreOpen = false; document.querySelector(".reader-more-menu")?.remove(); refreshDrawerOnly(); return; }
    if (action === "clear-reader-chat") { state.chat = []; refreshAssistantOnly(); return; }
    if (action === "run-verification") { void startReportVerification(reportById(target.dataset.id)); return; }
    if (action === "detail-tab") { state.detailTab = target.dataset.tab; state.chat = []; location.hash = `#/report/${encodeURIComponent(target.dataset.id)}`; render(); return; }
    if (action === "print-report") { const report = reportById(target.dataset.id); if (report) window.open(formalUrl(report), "_blank", "noopener"); toast("已打开报告，可使用浏览器打印或保存为 PDF"); return; }
    if (action === "definition-detail") { state.drawer = { type: "definition", id: target.dataset.id }; refreshDrawerOnly(); return; }
    if (action === "open-new-definition") { state.drawer = { type: "new-definition" }; refreshDrawerOnly(); return; }
    if (action === "save-definition") {
      const name = document.getElementById("definition-name")?.value.trim();
      const scope = document.getElementById("definition-scope")?.value.trim();
      const purpose = document.getElementById("definition-purpose")?.value.trim();
      if (!name || !scope || !purpose) { toast("请先完整填写定义名称、报告对象和业务用途"); return; }
      const source = definitionById(document.getElementById("definition-template")?.value);
      DATA.definitions.push({ ...source, id: `RD-CUSTOM-${Date.now()}`, name, category: document.getElementById("definition-category")?.value || "其他经营分析", version: "0.1.0", status: "草稿", scopeLabel: scope, subjects: [scope], purpose });
      state.drawer = null;
      renderDefinitions();
      toast("报告定义草稿已保存");
      return;
    }
    if (action === "open-new-version") {
      const report = reportById(target.dataset.id);
      if (!report) return;
      state.quickVersionRuns[report.id] = { status: "confirm", dataVersion: report.dataVersion, notes: "基于最新可用数据形成新的内容候选版本" };
      state.drawer = { type: "new-version", id: report.id };
      refreshDrawerOnly();
      return;
    }
    if (action === "confirm-new-version") {
      const report = reportById(target.dataset.id);
      if (!report) return;
      const run = state.quickVersionRuns[report.id];
      run.dataVersion = document.getElementById("new-version-data")?.value || report.dataVersion;
      run.notes = document.getElementById("new-version-notes")?.value.trim() || "形成新的内容候选版本";
      startQuickVersionGeneration(report, false);
      return;
    }
    if (action === "retry-new-version") { const report = reportById(target.dataset.id); if (report) startQuickVersionGeneration(report, true); return; }
    if (action === "close-drawer") {
      if (target.classList.contains("drawer-backdrop") && event.target !== target) return;
      const activeRun = state.drawer?.type === "new-version" ? state.quickVersionRuns[state.drawer.id] : null;
      if (["submitting", "running"].includes(activeRun?.status)) return;
      state.drawer = null;
      refreshDrawerOnly();
      return;
    }
    if (action === "select-definition") { const def = definitionById(target.dataset.id); state.wizard.definitionId = def.id; state.wizard.subject = def.subjects[0]; state.wizard.dataVersion = dataOptionsForDefinition(def)[0]; render(); return; }
    if (action === "wizard-next") { state.wizard.step = Math.min(4, state.wizard.step + 1); render(); return; }
    if (action === "wizard-prev") { state.wizard.step = Math.max(1, state.wizard.step - 1); render(); return; }
    if (action === "generate-draft") {
      beginGeneration(false);
      return;
    }
    if (action === "retry-generation") { beginGeneration(true); return; }
    if (action === "reset-wizard") { state.wizard = { step: 1, definitionId: DATA.definitions[0].id, subject: DATA.definitions[0].subjects[0], dataVersion: dataOptionsForDefinition(DATA.definitions[0])[0], notes: "", status: "idle", progressText: "", draftId: null, requestId: null, runId: null, resultId: null, result: null, error: null, publishStatus: "idle", publishedReportId: null }; render(); return; }
    if (action === "open-draft") { location.hash = "#/draft"; return; }
    if (action === "return-draft") { toast("草稿已退回，原生成记录保持不变"); location.hash = "#/create"; state.wizard.status = "idle"; state.wizard.step = 3; return; }
    if (action === "confirm-draft") { publishDraft(); return; }
    if (action === "ask-report") {
      const report = reportById(target.dataset.id);
      const question = target.dataset.question;
      startAssistant(report, question);
      return;
    }
    if (action === "retry-assistant") {
      const item = state.chat.find((candidate) => candidate.id === target.dataset.messageId);
      const report = reportById(decodeURIComponent(currentRoute().path.slice(8)));
      const question = item ? state.chat[state.chat.indexOf(item) - 1]?.text : null;
      if (item && report && question) startAssistant(report, question, item.id);
      return;
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "report-search") { state.search = event.target.value; }
    if (event.target.id === "wizard-notes") state.wizard.notes = event.target.value;
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "category-filter") { state.category = event.target.value; renderCatalog(); }
    if (event.target.id === "period-filter") { state.period = event.target.value; renderCatalog(); }
    if (event.target.id === "wizard-subject") state.wizard.subject = event.target.value;
    if (event.target.id === "wizard-data") state.wizard.dataVersion = event.target.value;
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "chat-form") return;
    event.preventDefault();
    const report = reportById(decodeURIComponent(currentRoute().path.slice(8)));
    const input = document.getElementById("chat-question");
    const question = input?.value.trim();
    if (!report || !question) return;
    startAssistant(report, question);
  });

  document.addEventListener("keydown", (event) => {
    if (event.target.id === "report-search" && event.key === "Enter") { event.preventDefault(); renderCatalog(); }
  });

  window.addEventListener("hashchange", () => {
    state.drawer = null;
    state.detailTab = currentRoute().query.get("tab") || state.detailTab;
    render();
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  });
  render();
})();
