(function () {
  "use strict";

  const DATA = window.RC_DATA;
  const STORAGE_KEY = "ontology3.report-center.state.v1";
  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");
  const pendingTimers = new Set();

  function newState() {
    return {
      stateVersion: 1,
      nonce: Date.now(),
      navOpen: false,
      dashboard: {
        tab: "overview",
        scopeType: "group",
        scopeId: "集团",
        compareUnits: ["单位553", "单位465", "单位561"],
      },
      actionRequests: [],
      insight: {
        status: "idle",
        resultId: null,
        runId: null,
        generatedAt: null,
        contentStatus: "未生成",
        referenced: false,
      },
      publishedReports: [],
      regenerationRequest: null,
      report: {
        stage: "idle",
        definitionId: "RD-FIN-001",
        generationMode: "standard",
        progress: 0,
        requestId: null,
        evidencePackId: null,
        generationRunId: null,
        draftId: null,
        draftVersion: null,
        contentVersion: null,
        revisionNumber: 0,
        generatedAt: null,
        returnedAt: null,
        confirmedAt: null,
        publishedAt: null,
        reportNo: null,
        publicationId: null,
        issues: [],
        verification: {
          status: "idle",
          progress: 0,
          runId: null,
          scope: "整份报告",
          filter: "all",
          results: [],
          completedAt: null,
          explanationStatus: "idle",
          explanationRunId: null,
          explanationText: null,
        },
        comparison: {
          status: "idle",
          recordId: null,
          comparedAt: null,
        },
      },
      customDefinitions: [],
      assistant: {
        tab: "qa",
        selectedAnchor: "metric-cost",
        selectedSection: "sec-overview",
        qaDraft: "",
        qaStatus: "idle",
        sessionId: null,
        bindingId: null,
        runId: null,
        resultId: null,
        messages: [],
      },
      ui: {
        modal: null,
        drawer: null,
        actionUnit: "单位553",
        tempDefinitionName: "",
        tempDefinitionPurpose: "",
        pendingScrollAnchor: null,
        viewingReportNo: null,
      },
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return newState();
      const parsed = JSON.parse(raw);
      if (parsed.stateVersion !== 1) return newState();
      const defaults = newState();
      parsed.publishedReports = Array.isArray(parsed.publishedReports) ? parsed.publishedReports : [];
      parsed.regenerationRequest = parsed.regenerationRequest || null;
      parsed.ui = { ...defaults.ui, ...(parsed.ui || {}) };
      if (parsed.report?.stage === "published" && parsed.report.reportNo && !parsed.publishedReports.some((item) => item.reportNo === parsed.report.reportNo)) {
        parsed.publishedReports.push(JSON.parse(JSON.stringify(parsed.report)));
      }
      return parsed;
    } catch (error) {
      return newState();
    }
  }

  let state = loadState();

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function commit(renderNow = true) {
    saveState();
    if (renderNow) renderApp();
  }

  function readingReport() {
    if (state.ui.viewingReportNo) {
      return state.publishedReports.find((item) => item.reportNo === state.ui.viewingReportNo) || state.report;
    }
    return state.report;
  }

  function storePublishedReport() {
    const snapshot = JSON.parse(JSON.stringify(state.report));
    const index = state.publishedReports.findIndex((item) => item.reportNo === snapshot.reportNo);
    if (index >= 0) state.publishedReports[index] = snapshot;
    else state.publishedReports.unshift(snapshot);
  }

  function schedule(callback, delay) {
    const nonce = state.nonce;
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      if (state.nonce !== nonce) return;
      callback();
    }, delay);
    pendingTimers.add(timer);
  }

  function clearTimers() {
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
    pendingTimers.clear();
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function icon(name, className = "") {
    return `<span class="icon ${className}" aria-hidden="true"><i data-lucide="${name}"></i></span>`;
  }

  function nowText() {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()).replaceAll("/", "-");
  }

  function compactStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  }

  function makeId(prefix) {
    return `${prefix}-${compactStamp()}`;
  }

  function formatNumber(value, digits = 3) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(value);
  }

  function formatPercent(value, digits = 2) {
    return `${formatNumber(value, digits)}%`;
  }

  function toneForStatus(status) {
    if (["可使用", "已启用", "已发布", "已完成", "通过", "请求已接收", "已确认"].includes(status)) return "success";
    if (["资料待补充", "警告", "有提示", "待复核", "待确认", "处理中", "生成中", "固定证据中"].includes(status)) return "warning";
    if (["失败", "证据缺失", "核验阻断"].includes(status)) return "danger";
    if (["无法核验", "受限"].includes(status)) return "purple";
    return "info";
  }

  function badge(status, tone = toneForStatus(status)) {
    return `<span class="badge ${tone}"><span class="status-dot"></span>${esc(status)}</span>`;
  }

  function toast(title, detail = "", tone = "") {
    const node = document.createElement("div");
    node.className = `toast ${tone}`.trim();
    node.innerHTML = `${icon(tone === "danger" ? "circle-alert" : tone === "success" ? "circle-check" : "info")}<div><strong>${esc(title)}</strong>${detail ? `<span>${esc(detail)}</span>` : ""}</div>`;
    toastRoot.appendChild(node);
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    window.setTimeout(() => node.remove(), 3800);
  }

  function routeInfo() {
    const hash = window.location.hash || "#/dashboard/s001";
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    const [path, queryString = ""] = raw.split("?");
    return { path: path || "/dashboard/s001", query: new URLSearchParams(queryString) };
  }

  function navigate(path) {
    state.navOpen = false;
    saveState();
    if (`#${path}` === window.location.hash) renderApp();
    else window.location.hash = path;
  }

  function renderShell(content, options = {}) {
    const currentPath = routeInfo().path;
    const active = (prefix) => currentPath.startsWith(prefix) ? "active" : "";
    const crumb = options.crumb || "报告中心";
    return `
      <div class="app-shell ${state.navOpen ? "nav-open" : ""}">
        <aside class="platform-rail" aria-label="平台模块">
          <div class="platform-logo" title="ontology3.0">O3</div>
          <span class="platform-button muted" title="平台首页">${icon("house")}</span>
          <a class="platform-button" href="../data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html" aria-label="数据工程" title="数据工程">${icon("database")}</a>
          <a class="platform-button" href="../ontology-management-prototype/index.html" aria-label="本体管理" title="本体管理">${icon("network")}</a>
          <a class="platform-button" href="../intelligent-query-prototype/智能问数工作台.html" aria-label="智能问数" title="智能问数">${icon("message-square-text")}</a>
          <a class="platform-button" href="../decision-center-prototype/index.html" aria-label="决策中心" title="决策中心">${icon("list-checks")}</a>
          <a class="platform-button" href="../agent-application/Agent应用.html" aria-label="Agent 应用" title="Agent 应用">${icon("bot")}</a>
          <span class="platform-button active" title="报告中心">${icon("chart-no-axes-combined")}</span>
          <div class="platform-spacer"></div>
          <button class="platform-button" type="button" data-action="open-reset" title="重置状态">${icon("rotate-ccw")}</button>
        </aside>
        ${state.navOpen ? `<button class="mobile-nav-backdrop" type="button" data-action="toggle-nav" aria-label="关闭导航"></button>` : ""}
        <nav class="product-nav" aria-label="报告中心导航">
          <div class="product-nav-head">
            <span>${icon("chart-no-axes-combined", "sm")}</span>
            <div><strong>报告中心</strong><small>分析与正式报告</small></div>
          </div>
          <div class="product-nav-list">
            <div class="product-nav-label">业务分析</div>
            <a class="product-nav-item ${active("/scenes")}" href="#/scenes">${icon("layout-dashboard", "sm")}<span>仪表盘目录</span><em>4</em></a>
            <a class="product-nav-item ${active("/dashboard/s001")}" href="#/dashboard/s001">${icon("landmark", "sm")}<span>融资驾驶舱</span><em>S001</em></a>
            <div class="product-nav-label">报告管理</div>
            <a class="product-nav-item ${currentPath === "/reports" ? "active" : ""}" href="#/reports?tab=definitions">${icon("file-cog", "sm")}<span>报告定义</span></a>
            <a class="product-nav-item ${active("/reports/generate") || active("/reports/draft") ? "active" : ""}" href="#/reports/generate">${icon("wand-sparkles", "sm")}<span>报告生成</span></a>
            <a class="product-nav-item ${active("/reports/view") || active("/reports/pdf") ? "active" : ""}" href="#/reports?tab=products">${icon("library", "sm")}<span>报告产物</span><em>${state.publishedReports.length}</em></a>
          </div>
          <div class="product-nav-foot">
            <strong>当前工作区</strong>
            <span>集团财务管理</span>
            <span>单账号业务流程</span>
          </div>
        </nav>
        <section class="app-workspace">
          <header class="topbar">
            <div class="topbar-left">
              <button class="icon-button mobile-nav-toggle" type="button" data-action="toggle-nav" title="打开导航">${icon("menu")}</button>
              <div class="breadcrumb">${icon("chart-no-axes-combined", "sm")}<span>报告中心</span>${icon("chevron-right", "sm")}<strong>${esc(crumb)}</strong></div>
            </div>
            <div class="topbar-actions">
              <span class="badge plain trust-top-badge">数据截至 ${DATA.product.asOf}</span>
              <button class="btn ghost" type="button" data-action="open-reset" title="清除本次操作产生的内容">${icon("rotate-ccw", "sm")}重置状态</button>
              <div class="account"><span class="account-avatar">财</span><div><strong>财务分析员</strong><small>集团财务管理</small></div></div>
            </div>
          </header>
          <main class="main ${options.mainClass || ""}">${content}</main>
        </section>
      </div>
    `;
  }

  function trustStrip() {
    return `
      <div class="trust-strip">
        <div class="trust-summary">
          <div>${icon("database", "sm")}<span>数据版本</span><strong>${DATA.product.dataVersion}</strong></div>
          <div>${icon("network", "sm")}<span>语义版本</span><strong>${DATA.product.semanticVersion}</strong></div>
          <div>${icon("calendar-clock", "sm")}<span>数据截至</span><strong>${DATA.product.asOf}</strong></div>
          <div>${icon("shield-alert", "sm")}<span>质量</span><strong>有提示</strong></div>
          <div>${icon("circle-check-big", "sm")}<span>当前组合</span><strong>可消费</strong></div>
        </div>
        <button class="btn soft" type="button" data-action="open-trust">${icon("shield-check", "sm")}查看数据状态</button>
      </div>
    `;
  }

  function renderScenes() {
    const cards = DATA.scenes.map((scene) => `
      <article class="scene-card">
        <div class="scene-card-head">
          <div><span class="scene-code">${scene.id}</span><h2>${esc(scene.name)}</h2></div>
          ${badge(scene.status)}
        </div>
        <p>${esc(scene.description)}</p>
        <div class="button-row">
          ${scene.id === "S001"
            ? `<button class="btn primary" type="button" data-action="navigate" data-route="/dashboard/s001">${icon("arrow-right", "sm")}打开驾驶舱</button>`
            : `<button class="btn" type="button" data-action="open-scene-readiness" data-scene="${scene.id}">${icon("list-tree", "sm")}查看详情</button>`}
        </div>
      </article>
    `).join("");
    return renderShell(`
      <div class="page" data-screen-label="仪表盘目录">
        <div class="page-header">
          <div><h1>仪表盘目录</h1><p>进入业务分析驾驶舱或查看场景接入状态。</p></div>
        </div>
        ${trustStrip()}
        <div class="scene-grid">${cards}</div>
      </div>
    `, { crumb: "仪表盘目录" });
  }

  function scopeMetrics() {
    if (state.dashboard.scopeType === "unit") return DATA.units[state.dashboard.scopeId] || DATA.groupMetrics;
    if (state.dashboard.scopeType === "board") {
      const board = DATA.boards.find((item) => item.name === state.dashboard.scopeId) || DATA.boards[0];
      const index = DATA.boards.indexOf(board);
      return {
        ...DATA.groupMetrics,
        balance: board.balance,
        cost: board.cost,
        floating: Math.max(12, DATA.groupMetrics.floating - index * 4.8),
        shortTerm: Math.min(18, DATA.groupMetrics.shortTerm + index * 1.35),
        foreign: board.name === "境外新能源" ? 100 : Math.max(0, DATA.groupMetrics.foreign - index * 0.45),
        highCost: Math.max(1, DATA.groupMetrics.highCost + (board.cost - DATA.groupMetrics.cost) * 8),
        credit: Math.max(6, DATA.groupMetrics.credit - index * 2.2),
      };
    }
    return DATA.groupMetrics;
  }

  function metricCards() {
    const m = scopeMetrics();
    const items = [
      ["balance", "融资余额", formatNumber(m.balance, 3), "亿元"],
      ["cost", "余额加权融资成本", formatNumber(m.cost, 6), "%"],
      ["floating", "浮动利率余额占比", formatNumber(m.floating, 2), "%"],
      ["shortTerm", "短期债务余额占比", formatNumber(m.shortTerm, 2), "%"],
      ["foreign", "外币融资余额占比", formatNumber(m.foreign, 2), "%"],
      ["highCost", "高成本融资余额占比", formatNumber(m.highCost, 2), "%"],
      ["credit", "信用融资余额占比", formatNumber(m.credit, 2), "%"],
    ];
    return `<div class="metric-grid">${items.map(([key, label, value, unit]) => `
      <button class="metric-card" type="button" data-action="open-metric" data-metric="${key}">
        <span>${label}</span>
        <strong class="metric-value">${value}<small>${unit}</small></strong>
        <div class="metric-foot"><span>${state.dashboard.scopeId}</span><span>口径与证据 ${icon("chevron-right", "sm")}</span></div>
      </button>
    `).join("")}</div>`;
  }

  function trendPanel() {
    const costs = DATA.trend.map((item) => item.cost);
    const min = Math.min(...costs) - 0.02;
    const max = Math.max(...costs) + 0.02;
    return `
      <section class="panel">
        <div class="panel-head"><div><div class="panel-title">融资成本趋势</div><p>月末余额加权融资成本 · %</p></div><button class="text-link" type="button" data-action="open-metric" data-metric="cost">口径与证据 ${icon("chevron-right", "sm")}</button></div>
        <div class="panel-body">
          <div class="chart-frame">
            <div class="trend-chart">${DATA.trend.map((item) => {
              const height = 28 + ((item.cost - min) / (max - min)) * 132;
              return `<div class="trend-column"><div class="trend-bar" style="height:${height}px" data-value="${formatNumber(item.cost, 3)}%"></div><small>${item.month.slice(5)}</small></div>`;
            }).join("")}</div>
            <div class="chart-legend"><span class="legend-key"><i></i>融资成本</span><span>最近 12 个完整月</span><span>当前 ${formatPercent(DATA.groupMetrics.cost, 6)}</span></div>
          </div>
        </div>
      </section>
    `;
  }

  function structureGrid() {
    const groups = [
      ["利率结构", DATA.structures.rate], ["期限结构", DATA.structures.term], ["币种结构", DATA.structures.currency],
      ["担保结构", DATA.structures.guarantee], ["融资类型", DATA.structures.finance], ["境内外结构", DATA.structures.region],
    ];
    return `<div class="structure-grid">${groups.map(([name, values]) => `
      <button class="structure-item" type="button" data-action="open-structure" data-structure="${name}">
        <div class="structure-item-head"><strong>${name}</strong>${icon("chevron-right", "sm")}</div>
        <div class="stacked-bar">${values.map((item) => `<span style="width:${item.value}%" title="${item.name} ${formatPercent(item.value, 2)}"></span>`).join("")}</div>
        <div class="structure-legend">${values.map((item) => `<div><span>${item.name}</span><strong>${formatPercent(item.value, 2)}</strong></div>`).join("")}</div>
      </button>
    `).join("")}</div>`;
  }

  function institutionTable(list = DATA.institutions) {
    const maxShare = Math.max(...list.map((item) => item.share));
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>融资机构</th><th class="num">融资余额（亿元）</th><th>余额占比</th><th class="num">加权成本</th><th class="num">借据数</th><th></th></tr></thead>
          <tbody>${list.map((item) => `
            <tr><td><div class="row-main"><strong>${item.name}</strong><small>银行</small></div></td><td class="num">${formatNumber(item.balance, 3)}</td><td><div class="status-inline"><div class="mini-bar"><span style="width:${item.share / maxShare * 100}%"></span></div><span>${formatPercent(item.share, 2)}</span></div></td><td class="num">${formatPercent(item.cost, 4)}</td><td class="num">${item.count}</td><td><button class="text-link" type="button" data-action="open-institution" data-institution="${item.name}">查看详情</button></td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function comparisonSection() {
    const selected = state.dashboard.compareUnits;
    const key = [...selected].sort().join("|");
    const result = DATA.comparisons[key];
    const unitButtons = Object.keys(DATA.units).map((unit) => `<button class="unit-chip ${selected.includes(unit) ? "active" : ""}" type="button" data-action="toggle-compare-unit" data-unit="${unit}">${selected.includes(unit) ? icon("check", "sm") : icon("plus", "sm")}${unit}</button>`).join("");
    const rows = selected.map((unit) => DATA.units[unit]).filter(Boolean);
    return `
      <section class="panel">
        <div class="panel-head"><div><div class="panel-title">单位比较</div><p>选择 2 家或 3 家，组合指标按所选单位融资明细并集的受治理结果展示。</p></div><button class="btn" type="button" data-action="open-ask" data-context="单位比较">${icon("message-square-text", "sm")}继续问数</button></div>
        <div class="panel-body">
          <div class="comparison-picker"><div class="unit-chips">${unitButtons}</div><span class="badge plain">已选 ${selected.length} 家</span></div>
          ${result ? `
            <div class="comparison-summary"><div class="fact"><span>组合融资余额</span><strong>${formatNumber(result.balance, 3)} 亿元</strong></div><div class="fact"><span>组合加权融资成本</span><strong>${formatPercent(result.cost, 6)}</strong></div><div class="fact"><span>与集团基准差异</span><strong>${result.cost >= DATA.groupMetrics.cost ? "+" : ""}${formatNumber(result.cost - DATA.groupMetrics.cost, 6)} 个百分点</strong></div></div>
            <div class="data-table-wrap" style="margin-top:10px"><table class="data-table"><thead><tr><th>单位</th><th class="num">余额（亿元）</th><th class="num">加权成本</th><th class="num">浮动利率</th><th class="num">短期债务</th><th>Rule</th></tr></thead><tbody>${rows.map((item, index) => `<tr><td><strong>${selected[index]}</strong></td><td class="num">${formatNumber(item.balance, 3)}</td><td class="num">${formatPercent(item.cost, 6)}</td><td class="num">${formatPercent(item.floating, 2)}</td><td class="num">${formatPercent(item.shortTerm, 2)}</td><td>${badge(item.rule.code + " 命中", "warning")}</td></tr>`).join("")}</tbody></table></div>
          ` : `<div class="notice warning" style="margin-top:12px">${icon("circle-alert")}<div><strong>还需选择 ${selected.length === 0 ? "2—3" : "1—2"} 家单位</strong><span>只有明确选择 2 家或 3 家后才展示组合结果。</span></div></div>`}
        </div>
      </section>
    `;
  }

  function ruleAndActionSection() {
    const unitNames = state.dashboard.scopeType === "unit" ? [state.dashboard.scopeId] : Object.keys(DATA.units);
    const cards = unitNames.map((unitName) => {
      const item = DATA.units[unitName];
      return `<div class="rule-card"><div><div class="status-inline">${badge(item.rule.status, "warning")}<span class="scene-code">${item.rule.code}</span></div><h3>${unitName} · ${item.rule.name}</h3><p>${item.rule.branch}</p><div class="rule-evidence"><div class="fact"><span>指标快照</span><strong>${item.rule.metricValue}</strong></div><div class="fact"><span>阈值</span><strong>${item.rule.threshold}</strong></div><div class="fact"><span>评估时间</span><strong>${item.rule.evaluatedAt}</strong></div><div class="fact"><span>优先机构</span><strong>${item.institutions[0].name}</strong></div></div></div><button class="btn" type="button" data-action="open-rule" data-unit="${unitName}">${icon("search", "sm")}查看证据</button></div>`;
    }).join("");
    return `
      <div class="two-col">
        <section class="panel"><div class="panel-head"><div><div class="panel-title">Rule 命中摘要</div><p>结论、阈值、分支和机构归因均来自已发布语义结果。</p></div></div><div class="panel-body section-stack">${cards}</div></section>
        <section class="panel">
          <div class="panel-head"><div><div class="panel-title">行动协同</div><p>只提交标准 Action Request；后续状态从决策中心读取。</p></div><button class="btn primary" type="button" data-action="open-action">${icon("send", "sm")}发起行动</button></div>
          <div class="panel-body">
            ${state.actionRequests.length === 0 ? `<div class="empty-state" style="min-height:180px;padding:20px"><div><div class="empty-icon">${icon("inbox")}</div><h2>暂无关联请求</h2><p>从单一单位的 Rule 证据发起行动后，请求标识会显示在这里。</p><button class="btn" type="button" data-action="reread-decision">${icon("refresh-cw", "sm")}重新读取</button></div></div>` : `
              <div class="resource-list">${state.actionRequests.map((request) => `<div class="resource-row" style="grid-template-columns:minmax(0,1fr) auto"><div><strong>${request.unit} · ${request.ruleCode}</strong><small>${request.id} · ${request.createdAt}</small></div><div class="inline-actions">${badge(request.status)}<button class="text-link" type="button" data-action="open-external-decision" data-id="${request.id}">查看详情</button></div></div>`).join("")}</div>
              <div class="notice" style="margin-top:10px">${icon("info")}<div><strong>决策状态只读</strong><span>请求成功不表示提醒已确认、待办已创建或行动已执行。</span></div></div>
            `}
          </div>
        </section>
      </div>
    `;
  }

  function insightSection() {
    const insight = state.insight;
    let body = "";
    if (insight.status === "idle") {
      body = `<div class="empty-state" style="min-height:210px"><div><div class="empty-icon">${icon("sparkles")}</div><h2>尚未生成洞察</h2><p>生成时会固定当前范围、指标、Rule 证据、数据版本与时点。</p><button class="btn primary" type="button" data-action="generate-insight">${icon("sparkles", "sm")}生成洞察</button></div></div>`;
    } else if (insight.status === "running" || insight.status === "confirming") {
      body = `<div class="progress-card"><div class="progress-head"><div><h2>${insight.status === "running" ? "正在形成洞察" : "正在读取确认结果"}</h2><p>当前范围：${state.dashboard.scopeId}</p></div>${badge("处理中")}</div><div class="progress-track"><span style="width:${insight.status === "running" ? 58 : 82}%"></span></div><div class="detail-row"><span>Agent 运行</span><strong>${esc(insight.runId)}</strong></div><div class="detail-row"><span>固定数据版本</span><strong>${DATA.product.dataVersion}</strong></div></div>`;
    } else {
      body = `<div class="section-stack"><div class="notice ${insight.contentStatus === "已确认" ? "success" : "warning"}">${icon(insight.contentStatus === "已确认" ? "circle-check" : "clock")}<div><strong>内容状态：${insight.contentStatus}</strong><span>Agent 运行、内容确认、数据新鲜度与当前驾驶舱引用分别显示。</span></div></div><div><h3 style="margin:0 0 6px">融资成本延续下降，浮动利率暴露仍是主要结构关注点</h3><p style="margin:0;color:var(--muted)">集团加权融资成本为 ${formatPercent(DATA.groupMetrics.cost, 6)}，近三个月变化趋缓。单位465的浮动利率余额占比为 100%，单位553的高成本融资余额主要集中于欧陆银行、寰宇银行和海联银行。</p></div><div class="detail-list"><div class="detail-row"><span>证据</span><strong>集团融资成本、R01/R02、三家机构贡献</strong></div><div class="detail-row"><span>版本与时点</span><strong>语义 ${DATA.product.semanticVersion} · 数据 ${DATA.product.dataVersion} · 截至 ${DATA.product.asOf}</strong></div><div class="detail-row"><span>生成时间</span><strong>${esc(insight.generatedAt)}</strong></div><div class="detail-row"><span>场景引用</span><strong>${insight.referenced ? "已引用到 S001 洞察区" : "未引用"}</strong></div></div><div class="button-row"><button class="btn" type="button" data-action="open-external-agent" data-id="${insight.runId}">${icon("external-link", "sm")}查看 Agent 记录</button>${insight.contentStatus !== "已确认" ? `<button class="btn soft" type="button" data-action="request-insight-confirm">${icon("send", "sm")}请求内容确认</button>` : `<button class="btn ${insight.referenced ? "" : "primary"}" type="button" data-action="toggle-insight-reference">${icon(insight.referenced ? "unlink" : "link", "sm")}${insight.referenced ? "停止引用" : "引用到驾驶舱"}</button>`}<button class="btn ghost" type="button" data-action="generate-insight">${icon("refresh-cw", "sm")}重新生成</button></div></div>`;
    }
    return `<section class="panel"><div class="panel-head"><div><div class="panel-title">AI 洞察</div><p>解释与建议，不作为数据源、正式指标或 Rule 计算层。</p></div></div><div class="panel-body">${body}</div></section>`;
  }

  function dashboardOverview() {
    return `
      <div class="section-stack">
        <section class="panel"><div class="panel-head"><div><div class="panel-title">核心指标</div><p>${state.dashboard.scopeId} · 数据截至 ${DATA.product.asOf}</p></div></div><div class="panel-body">${metricCards()}</div></section>
        <div class="two-col">${trendPanel()}<section class="panel overview-structure-panel"><div class="panel-head"><div><div class="panel-title">债务结构</div><p>未知分类保持单列。</p></div><button class="text-link" type="button" data-action="set-dashboard-tab" data-tab="structure">查看详情 ${icon("chevron-right", "sm")}</button></div><div class="panel-body">${structureGrid()}</div></section></div>
        <section class="panel"><div class="panel-head"><div><div class="panel-title">金融机构分布</div><p>总体余额分布，不等同于 Rule 优先协商机构。</p></div></div><div class="panel-body flush">${institutionTable()}</div></section>
        ${comparisonSection()}
        ${ruleAndActionSection()}
        <div class="equal-col">${insightSection()}<section class="panel"><div class="panel-head"><div><div class="panel-title">智能问数</div><p>带入当前场景、范围、单位与指标上下文。</p></div></div><div class="panel-body section-stack"><button class="btn full" type="button" data-action="open-ask" data-context="集团融资成本与结构">${icon("message-square-text", "sm")}集团融资成本与结构</button><button class="btn full" type="button" data-action="open-ask" data-context="单位风险原因">${icon("message-square-text", "sm")}单位风险原因</button><button class="btn full" type="button" data-action="open-ask" data-context="优先协商机构">${icon("message-square-text", "sm")}优先协商机构</button><div class="notice">${icon("info")}<div><strong>当前上下文</strong><span>${state.dashboard.scopeId} · ${state.dashboard.compareUnits.join("、")} · 语义 ${DATA.product.semanticVersion}</span></div></div></div></section></div>
      </div>
    `;
  }

  function dashboardTabContent() {
    if (state.dashboard.tab === "compare") return comparisonSection();
    if (state.dashboard.tab === "structure") return `<div class="section-stack"><section class="panel"><div class="panel-head"><div><div class="panel-title">债务结构</div><p>按受治理属性和指标结果展示。</p></div></div><div class="panel-body">${structureGrid()}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">金融机构分布</div><p>当前范围总体融资分布。</p></div></div><div class="panel-body flush">${institutionTable()}</div></section></div>`;
    if (state.dashboard.tab === "evidence") return `<div class="section-stack">${ruleAndActionSection()}${insightSection()}</div>`;
    return dashboardOverview();
  }

  function renderDashboard() {
    const scopeOptions = state.dashboard.scopeType === "board"
      ? DATA.boards.map((item) => `<option value="${item.name}" ${item.name === state.dashboard.scopeId ? "selected" : ""}>${item.name}</option>`).join("")
      : Object.keys(DATA.units).map((unit) => `<option value="${unit}" ${unit === state.dashboard.scopeId ? "selected" : ""}>${unit}</option>`).join("");
    return renderShell(`
      <div class="page" data-screen-label="S001 集团融资成本与债务结构优化驾驶舱">
        <div class="page-header"><div><div class="status-inline"><span class="scene-code">S001</span>${badge("可使用")}</div><h1>集团融资成本与债务结构优化</h1><p>仪表盘版本 ${DATA.product.dashboardVersion} · 回答发生了什么、经营情况怎样。</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports/generate">${icon("file-plus-2", "sm")}生成报告</button><button class="btn primary" type="button" data-action="open-action">${icon("send", "sm")}发起行动</button></div></div>
        ${trustStrip()}
        <div class="scope-toolbar">
          <div class="segmented" aria-label="分析范围"><button type="button" class="${state.dashboard.scopeType === "group" ? "active" : ""}" data-action="set-scope-type" data-type="group">集团</button><button type="button" class="${state.dashboard.scopeType === "board" ? "active" : ""}" data-action="set-scope-type" data-type="board">板块</button><button type="button" class="${state.dashboard.scopeType === "unit" ? "active" : ""}" data-action="set-scope-type" data-type="unit">单位</button></div>
          ${state.dashboard.scopeType === "group" ? `<div class="field-inline"><label>当前范围</label><strong>集团</strong></div>` : `<div class="field-inline"><label for="scope-select">当前范围</label><select class="select" id="scope-select" data-change="scope-id">${scopeOptions}</select></div>`}
          <div class="scope-note help-text">切换范围会更新指标、结构、机构和 Rule；AI 洞察保留自身新鲜度状态。</div>
          <button class="btn" type="button" data-action="open-ask" data-context="${state.dashboard.scopeId}">${icon("message-square-text", "sm")}智能问数</button>
        </div>
        <div class="tabs"><button class="tab ${state.dashboard.tab === "overview" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="overview">经营概览</button><button class="tab ${state.dashboard.tab === "compare" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="compare">单位比较</button><button class="tab ${state.dashboard.tab === "structure" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="structure">结构与机构</button><button class="tab ${state.dashboard.tab === "evidence" ? "active" : ""}" type="button" data-action="set-dashboard-tab" data-tab="evidence">Rule 与行动</button></div>
        ${dashboardTabContent()}
      </div>
    `, { crumb: "S001 融资驾驶舱" });
  }

  function reportWorkflowIndex() {
    const map = { idle: 0, evidence: 1, evidence_missing: 1, generating: 2, draft: 3, returned: 3, confirmed: 4, publishing: 4, published: 5 };
    return map[state.report.stage] ?? 0;
  }

  function workflowStrip() {
    const current = reportWorkflowIndex();
    const steps = ["选择定义", "固定证据", "Agent 生成", "核验复核", "形成产物", "已发布"];
    return `<div class="workflow-strip">${steps.map((step, index) => `<div class="workflow-step ${index < current ? "done" : index === current ? "active" : ""}"><span>0${index + 1}</span><strong>${step}</strong></div>`).join("")}</div>`;
  }

  function renderReports() {
    const tab = routeInfo().query.get("tab") || "definitions";
    const definitions = [...DATA.definitions, ...state.customDefinitions];
    let content = "";
    if (tab === "definitions") {
      content = `<div class="resource-list">${definitions.map((item) => `<div class="resource-row"><div><strong>${esc(item.name)}</strong><small>${esc(item.id)} · ${esc(item.purpose)}</small></div><div class="resource-meta"><span>版本</span><strong>${esc(item.version)}</strong></div><div>${badge(item.status)}</div><button class="btn" type="button" data-action="open-definition" data-id="${item.id}">查看详情</button></div>`).join("")}</div>`;
    } else if (tab === "templates") {
      content = `<div class="resource-list">${DATA.templates.map((item) => `<div class="resource-row"><div><strong>${item.name}</strong><small>${item.id} · ${item.chapters.length} 个章节 · ${item.formats.join(" / ")}</small></div><div class="resource-meta"><span>版本</span><strong>${item.version}</strong></div><div>${badge(item.status)}</div><button class="btn" type="button" data-action="open-template" data-id="${item.id}">查看详情</button></div>`).join("")}</div>`;
    } else {
      content = state.publishedReports.length ? `<div class="resource-list">${state.publishedReports.map((report) => `<div class="resource-row"><div><strong>集团融资经营分析报告</strong><small>${esc(report.reportNo)} · 内容版本 ${esc(report.contentVersion)}</small></div><div class="resource-meta"><span>发布时间</span><strong>${esc(report.publishedAt)}</strong></div><div>${badge("已发布")}</div><button class="btn primary" type="button" data-action="open-published-report" data-report="${esc(report.reportNo)}">${icon("book-open", "sm")}查看详情</button></div>`).join("")}</div>` : `<div class="panel"><div class="empty-state"><div><div class="empty-icon">${icon("library")}</div><h2>尚无正式报告</h2><p>从已启用的报告定义发起生成，经证据固定、自动核验和人工复核后发布。</p><button class="btn primary" type="button" data-action="navigate" data-route="/reports/generate">${icon("file-plus-2", "sm")}生成报告</button></div></div></div>`;
    }
    return renderShell(`
      <div class="page" data-screen-label="报告资源管理">
        <div class="page-header"><div><h1>报告管理</h1><p>报告定义约束业务目的与证据，模板只负责章节骨架和版式。</p></div><div class="header-actions">${tab === "definitions" ? `<button class="btn" type="button" data-action="open-new-definition">${icon("plus", "sm")}新建报告定义</button>` : ""}<button class="btn primary" type="button" data-action="navigate" data-route="/reports/generate">${icon("wand-sparkles", "sm")}生成报告</button></div></div>
        <div class="tabs"><a class="tab ${tab === "definitions" ? "active" : ""}" href="#/reports?tab=definitions">报告定义 <span>${definitions.length}</span></a><a class="tab ${tab === "templates" ? "active" : ""}" href="#/reports?tab=templates">报告模板 <span>${DATA.templates.length}</span></a><a class="tab ${tab === "products" ? "active" : ""}" href="#/reports?tab=products">正式报告 <span>${state.publishedReports.length}</span></a></div>
        ${content}
      </div>
    `, { crumb: tab === "products" ? "正式报告" : tab === "templates" ? "报告模板" : "报告定义" });
  }

  function generationProgress() {
    const report = state.report;
    if (report.stage === "evidence_missing") {
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>证据固定未完成</h2><p>机构授信附件当前不可读，无法进入 Agent 生成。</p></div>${badge("证据缺失")}</div><div class="notice danger">${icon("file-warning")}<div><strong>受限附件缺少访问权限</strong><span>影响“重点机构授信情况”章节。报告正文不能用推测补齐。</span></div></div><div class="button-row"><button class="btn primary" type="button" data-action="retry-standard-generation">${icon("refresh-cw", "sm")}改用标准证据范围并重试</button><button class="btn" type="button" data-action="open-generation-modal">调整生成范围</button></div></div></section>`;
    }
    if (["evidence", "generating", "publishing"].includes(report.stage)) {
      const title = report.stage === "evidence" ? "正在固定生成证据" : report.stage === "generating" ? "正在生成结构化草稿" : "正在形成 HTML 与 PDF";
      const copy = report.stage === "evidence" ? "正在锁定定义、模板、语义、数据版本与证据槽位。" : report.stage === "generating" ? "Agent 应用正在返回结构化章节与包内证据引用。" : "两种阅读形态来自同一已确认内容版本。";
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>${title}</h2><p>${copy}</p></div>${badge("处理中")}</div><div class="progress-track"><span style="width:${report.progress}%"></span></div><div class="progress-facts"><div class="fact"><span>报告请求</span><strong>${esc(report.requestId)}</strong></div><div class="fact"><span>证据包</span><strong>${esc(report.evidencePackId || "固定中")}</strong></div><div class="fact"><span>Agent 运行</span><strong>${esc(report.generationRunId || "未发起")}</strong></div><div class="fact"><span>当前进度</span><strong>${report.progress}%</strong></div></div><div class="help-text">可以离开当前页面；返回后会按资源标识重新读取状态。</div></div></section>`;
    }
    if (["draft", "returned", "confirmed", "published"].includes(report.stage)) {
      const status = report.stage === "draft" ? "草稿待复核" : report.stage === "returned" ? "已退回" : report.stage === "confirmed" ? "已确认待发布" : "已发布";
      return `<section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>${report.stage === "published" ? "正式报告已形成" : report.stage === "returned" ? "草稿已退回修订" : "草稿已返回"}</h2><p>${report.stage === "published" ? "HTML 阅读版与 PDF 固定版共享编号、内容版本和证据链。" : `草稿版本 ${report.draftVersion} · 证据包 ${report.evidencePackId}`}</p></div>${badge(status)}</div>${report.stage === "returned" ? `<div class="notice warning">${icon("undo-2")}<div><strong>复核问题已关联</strong><span>原草稿和核验结果保持只读；重新生成会形成新的草稿版本。</span></div></div>` : ""}<div class="button-row">${report.stage === "returned" ? `<button class="btn primary" type="button" data-action="regenerate-report">${icon("refresh-cw", "sm")}重新生成</button>` : report.stage === "published" ? `<button class="btn primary" type="button" data-action="navigate" data-route="/reports/view">${icon("book-open", "sm")}阅读报告</button>` : `<button class="btn primary" type="button" data-action="navigate" data-route="/reports/draft">${icon("scan-text", "sm")}打开草稿</button>`}<button class="btn" type="button" data-action="open-trace">${icon("git-branch", "sm")}查看追溯</button></div></div></section>`;
    }
    return "";
  }

  function renderGenerate() {
    const def = DATA.definitions[0];
    const report = state.report;
    const pendingRegeneration = report.stage === "published" && state.regenerationRequest ? `
      <section class="panel"><div class="progress-card"><div class="progress-head"><div><h2>新生成请求已创建</h2><p>原正式报告继续可读；开始后将形成独立证据包和新内容版本。</p></div>${badge("未开始")}</div><div class="progress-facts"><div class="fact"><span>生成请求</span><strong>${esc(state.regenerationRequest.id)}</strong></div><div class="fact"><span>来源报告</span><strong>${esc(state.regenerationRequest.sourceReportNo)}</strong></div><div class="fact"><span>请求时间</span><strong>${esc(state.regenerationRequest.createdAt)}</strong></div><div class="fact"><span>当前状态</span><strong>未开始</strong></div></div><div class="button-row"><button class="btn primary" type="button" data-action="start-pending-regeneration">${icon("play", "sm")}开始固定证据</button><button class="btn" type="button" data-action="open-published-report" data-report="${esc(state.regenerationRequest.sourceReportNo)}">查看原报告</button></div></div></section>` : "";
    return renderShell(`
      <div class="page" data-screen-label="报告生成工作区">
        <div class="page-header"><div><h1>报告生成</h1><p>从已启用定义固定证据，生成结构化草稿并进入复核。</p></div><div class="header-actions"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">查看报告定义</button></div></div>
        ${trustStrip()}
        ${workflowStrip()}
        <div style="height:12px"></div>
        ${pendingRegeneration || (report.stage === "idle" ? `<div class="two-col"><section class="panel"><div class="panel-head"><div><div class="panel-title">生成范围</div><p>当前只选择报告定义允许的对象与证据。</p></div></div><div class="panel-body detail-list"><div class="detail-row"><span>报告定义</span><strong>${def.name} · ${def.version}</strong></div><div class="detail-row"><span>适用对象</span><strong>集团融资经营分析 · 集团范围</strong></div><div class="detail-row"><span>模板</span><strong>${def.template}</strong></div><div class="detail-row"><span>证据范围</span><strong>${def.evidence}</strong></div><div class="detail-row"><span>Agent</span><strong>${def.agent}</strong></div><div class="detail-row"><span>发布规则</span><strong>${def.publish}</strong></div><div class="button-row" style="margin-top:12px"><button class="btn primary" type="button" data-action="open-generation-modal">${icon("wand-sparkles", "sm")}开始生成</button></div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">版本与证据准备</div><p>正式生成前固定当前组合。</p></div></div><div class="panel-body checklist"><div class="check-row">${icon("circle-check", "sm")}<div><strong>报告定义与模板</strong><span>${def.version} / 2.2.0</span></div></div><div class="check-row">${icon("circle-check", "sm")}<div><strong>Published 语义</strong><span>${DATA.product.semanticVersion}</span></div></div><div class="check-row">${icon("circle-check", "sm")}<div><strong>精确数据版本</strong><span>${DATA.product.dataVersion} · 截至 ${DATA.product.asOf}</span></div></div><div class="check-row">${icon("circle-alert", "sm")}<div><strong>质量提示</strong><span>担保方式存在未知值，报告中必须披露且不能解释为信用。</span></div></div></div></section></div>` : generationProgress())}
      </div>
    `, { crumb: "报告生成" });
  }

  function reportChapters() {
    return [
      ["sec-overview", "01", "经营概览"],
      ["sec-cost", "02", "融资成本"],
      ["sec-structure", "03", "债务结构"],
      ["sec-units", "04", "重点单位与机构"],
      ["sec-rules", "05", "规则发现"],
      ["sec-evidence", "06", "证据与限制"],
    ];
  }

  function evidenceSpan(id, content, ref, extraClass = "") {
    const selected = state.assistant.selectedAnchor === id ? "selected" : "";
    return `<span id="${id}" class="evidence-anchor ${selected} ${extraClass}" tabindex="0" data-clickable="true" data-action="select-anchor" data-anchor="${id}">${content}<sup class="evidence-ref">${ref}</sup></span>`;
  }

  function reportPaper() {
    const report = readingReport();
    const firstRevision = report.revisionNumber <= 1;
    const highCostValue = firstRevision ? "10.900%" : "9.859389%";
    const reportLabel = report.stage === "published" ? report.reportNo : report.draftId;
    const contentVersion = report.contentVersion || report.draftVersion || "0.1";
    return `
      <article class="report-paper" aria-label="集团融资经营分析报告正文">
        <header class="report-cover" id="report-cover">
          <span class="kicker">集团融资经营分析</span>
          <h1>集团融资成本与债务结构分析报告</h1>
          <p>围绕融资余额、加权融资成本、债务结构、重点单位与机构贡献，形成可追溯的经营情况分析。</p>
          <div class="report-cover-meta"><span>报告标识：${esc(reportLabel)}</span><span>内容版本：${esc(contentVersion)}</span><span>数据截至：${DATA.product.asOf}</span><span>证据包：${esc(report.evidencePackId)}</span></div>
        </header>
        <section class="report-section" id="sec-overview">
          <h2>一、经营概览</h2>
          <p class="report-lead">截至 ${evidenceSpan("date-asof", DATA.product.asOf, "E01")}，集团融资余额为 ${evidenceSpan("metric-balance", "21,613.387 亿元", "E02")}，余额加权融资成本为 ${evidenceSpan("metric-cost", "2.372231%", "E03")}。</p>
          <div class="report-kpis"><div class="report-kpi"><span>融资余额</span><strong>${evidenceSpan("kpi-balance", "21,613.387 亿元", "E02")}</strong></div><div class="report-kpi"><span>加权融资成本</span><strong>${evidenceSpan("kpi-cost", "2.372231%", "E03")}</strong></div><div class="report-kpi"><span>浮动利率余额占比</span><strong>${evidenceSpan("kpi-floating", "95.149492%", "E04")}</strong></div></div>
          <p>融资成本较年初保持下降，但降幅逐步收窄。结构上，浮动利率融资仍占主要部分，需结合利率环境持续观察重定价风险。</p>
        </section>
        <section class="report-section" id="sec-cost">
          <h2>二、融资成本</h2>
          <p>集团当前融资成本处于近十二个月低位。高成本融资余额占比为 ${evidenceSpan("metric-high-cost", highCostValue, "E05", firstRevision ? "has-review" : "")}${firstRevision ? `<sup class="review-marker">!</sup>` : ""}，重点高成本融资集中在单位553。</p>
          <div class="report-chart" id="chart-cost"><h4>近六个月融资成本（%）</h4><div class="report-bars">${DATA.trend.slice(-6).map((item) => `<div class="report-bar"><i style="height:${48 + (item.cost - 2.34) * 820}px"></i><span>${item.month.slice(5)}<br>${formatNumber(item.cost, 3)}</span></div>`).join("")}</div></div>
          <p>余额加权方法避免了小额融资与大额融资等权。报告中的比例和数值均引用生成时固定结果，不在正文渲染时重新计算。</p>
        </section>
        <section class="report-section" id="sec-structure">
          <h2>三、债务结构</h2>
          <p>浮动利率余额占比为 ${evidenceSpan("structure-floating", "95.149492%", "E04")}；短期债务余额占比为 ${evidenceSpan("structure-short", "0.911805%", "E06")}；外币融资余额占比为 ${evidenceSpan("structure-foreign", "4.224132%", "E07")}。</p>
          <table class="report-table"><thead><tr><th>结构维度</th><th class="num">主要类别</th><th class="num">占比</th><th>说明</th></tr></thead><tbody><tr><td>利率结构</td><td class="num">浮动利率</td><td class="num">${evidenceSpan("cell-floating", "95.149492%", "E04")}</td><td>重定价暴露较高</td></tr><tr><td>期限结构</td><td class="num">短期</td><td class="num">${evidenceSpan("cell-short", "0.911805%", "E06")}</td><td>集团总体短债占比较低</td></tr><tr><td>币种结构</td><td class="num">外币</td><td class="num">${evidenceSpan("cell-foreign", "4.224132%", "E07")}</td><td>单位553主要为英镑融资</td></tr><tr><td>担保结构</td><td class="num">信用</td><td class="num">${evidenceSpan("cell-credit", "34.680039%", "E08")}</td><td>未知担保方式单列披露</td></tr></tbody></table>
          <p>担保方式未知余额占比为 ${evidenceSpan("structure-unknown", "27.436%", "E09")}。未知值未被归入信用融资，相关披露构成质量提示。</p>
        </section>
        <section class="report-section" id="sec-units">
          <h2>四、重点单位与机构</h2>
          <p>单位553、单位465和单位561的组合融资余额为 ${evidenceSpan("compare-balance", "1,183.150 亿元", "E10")}，组合加权融资成本为 ${evidenceSpan("compare-cost", "2.424554%", "E11")}。</p>
          <table class="report-table"><thead><tr><th>单位</th><th class="num">融资余额（亿元）</th><th class="num">加权成本</th><th>主要关注</th></tr></thead><tbody><tr><td>单位553</td><td class="num">393.134</td><td class="num">2.880984%</td><td>高成本融资</td></tr><tr><td>单位465</td><td class="num">770.000</td><td class="num">2.196617%</td><td>浮动利率暴露</td></tr><tr><td>单位561</td><td class="num">20.016</td><td class="num">2.228380%</td><td>短期债务集中</td></tr></tbody></table>
          <p>单位553的高成本问题融资主要集中于 ${evidenceSpan("institution-priority", "欧陆银行、寰宇银行和海联银行", "E12")}；该排序来自 R01 命中证据，不等同于集团总体融资余额最大的机构。</p>
        </section>
        <section class="report-section" id="sec-rules">
          <h2>五、规则发现</h2>
          <div class="report-rule" id="rule-r01"><strong>${evidenceSpan("rule-r01-result", "R01 · 单位553命中融资成本偏高", "E13")}</strong><span>触发分支：高成本融资余额占比超过 20%；评估时间 2026-08-09 09:18。</span></div>
          <div class="report-rule" id="rule-r02"><strong>${evidenceSpan("rule-r02-result", "R02 · 单位465命中浮动利率暴露", "E14")}</strong><span>触发分支：浮动利率余额占比超过 80%；评估时间 2026-08-09 09:18。</span></div>
          <div class="report-rule" id="rule-r03"><strong>${evidenceSpan("rule-r03-result", "R03 · 单位561命中短期债务集中", "E15")}</strong><span>触发分支：短期债务余额占比超过 30%；评估时间 2026-08-09 09:18。</span></div>
          <p id="narrative-suggestion" class="evidence-anchor ${state.assistant.selectedAnchor === "narrative-suggestion" ? "selected" : ""}" tabindex="0" data-clickable="true" data-action="select-anchor" data-anchor="narrative-suggestion">${firstRevision ? "建议优先与主要合作机构协商优化融资结构。" : "建议方向仅用于复核参考：对单位553优先核对高成本借据置换空间，对单位465核对固定利率或利率上限条件，对单位561核对展期与中长期置换条件。"}${firstRevision ? `<sup class="review-marker">!</sup>` : `<sup class="evidence-ref">E16</sup>`}</p>
        </section>
        <section class="report-section" id="sec-evidence">
          <h2>六、证据与限制</h2>
          <p>本报告固定引用报告定义 1.0.0、模板 2.2.0、Published 语义版本 ${DATA.product.semanticVersion}、数据版本 ${DATA.product.dataVersion} 和证据包 ${esc(report.evidencePackId)}。LLM 仅负责组织文字，不生成正式指标、比例或 Rule 结论。</p>
          <p>发布时质量检查已完成；核验时担保方式未知值仍需披露。报告快照不会随当前数据、模板或重新渲染发生原地变化。</p>
          <div class="report-footnotes">E01—E16 均可从报告助手或追溯详情打开。HTML 阅读版与 PDF 固定版共享报告标识、内容版本和证据链。</div>
        </section>
      </article>
    `;
  }

  function tocPane() {
    const report = readingReport();
    return `<aside class="reader-toc"><div class="pane-heading"><strong>章节目录</strong><small>点击章节定位正文</small></div><div class="toc-list">${reportChapters().map(([id, no, name]) => `<button class="toc-link ${state.assistant.selectedSection === id ? "active" : ""}" type="button" data-action="jump-section" data-section="${id}"><em>${no}</em><span>${name}</span></button>`).join("")}</div><div class="toc-meta"><span class="badge plain">内容版本 ${report.contentVersion || report.draftVersion}</span><span class="badge plain">证据包 ${report.evidencePackId}</span><button class="text-link" type="button" data-action="open-trace">查看完整追溯</button></div></aside>`;
  }

  function verificationResults() {
    const firstRevision = readingReport().revisionNumber <= 1;
    const common = [
      { id: "evidence", name: "证据完整性", status: "pass", anchor: "metric-balance", issue: "必需证据、结构化绑定和正文锚点齐全。", evidence: "证据包与内容绑定" },
      { id: "numbers", name: "报告数值与绑定证据一致性", status: firstRevision ? "fail" : "pass", anchor: "metric-high-cost", issue: firstRevision ? "正文高成本融资余额占比 10.900%，绑定证据为 9.859389%。" : "数值、单位、精度和对象范围与固定证据一致。", evidence: "高成本融资余额占比" },
      { id: "semantic", name: "语义一致性", status: "pass", anchor: "structure-floating", issue: "指标名称、单位、筛选范围和时间范围一致。", evidence: "Published Metric 定义" },
      { id: "version", name: "版本兼容性", status: "pass", anchor: "date-asof", issue: `语义 ${DATA.product.semanticVersion} 与数据 ${DATA.product.dataVersion} 属于生成时获准组合。`, evidence: "版本绑定摘要" },
      { id: "trust", name: "可信度披露", status: "warn", anchor: "structure-unknown", issue: "担保方式未知余额已披露；该质量提示不影响其他指标核对。", evidence: "发布时质量与核验时摘要" },
      { id: "rule", name: "Rule 命中结论一致性", status: "pass", anchor: "rule-r01-result", issue: "R01/R02/R03 结论、版本、评估时间和触发分支一致。", evidence: "Rule 固定评估结果" },
      { id: "internal", name: "报告内部一致性", status: firstRevision ? "fail" : "pass", anchor: "metric-high-cost", issue: firstRevision ? "经营概览与证据表中的高成本融资占比不一致。" : "摘要、正文、表格和图表中的同一事实一致。", evidence: "事实项跨位置对账" },
      { id: "binding", name: "无结构化证据绑定识别", status: firstRevision ? "unverifiable" : "pass", anchor: "narrative-suggestion", issue: firstRevision ? "行动建议未关联结构化事实范围，无法判断建议边界。" : "数值、日期、Rule 结论和建议引用均有结构化绑定。", evidence: firstRevision ? "缺少建议来源绑定" : "内容项—锚点—证据绑定" },
    ];
    return common;
  }

  function statusLabel(status) {
    return { pass: "通过", warn: "警告", fail: "失败", unverifiable: "无法核验" }[status] || status;
  }

  function statusIcon(status) {
    const name = status === "pass" ? "check" : status === "warn" ? "triangle-alert" : status === "fail" ? "x" : "help-circle";
    return `<span class="status-icon ${status}">${icon(name, "sm")}</span>`;
  }

  function assistantQA() {
    const a = state.assistant;
    const report = readingReport();
    const messages = a.messages.map((message) => `<div class="message ${message.role}"><p>${esc(message.text)}</p>${message.role === "assistant" ? `<div class="message-meta"><span>报告快照 · ${DATA.product.asOf}</span><button class="citation-link" type="button" data-action="jump-anchor" data-anchor="${message.anchor}">定位证据</button><button class="citation-link" type="button" data-action="open-anchor-evidence" data-anchor="${message.anchor}">打开证据</button></div>` : ""}</div>`).join("");
    return `
      <div class="assistant-content">
        <div class="context-box"><span>当前上下文</span><strong>${esc(a.selectedAnchor)} · 证据包 ${esc(report.evidencePackId)}</strong></div>
        ${a.messages.length === 0 ? `<div class="suggestion-list"><button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="集团融资成本为什么下降？">集团融资成本为什么下降？</button><button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="单位553为什么命中 R01？">单位553为什么命中 R01？</button><button class="suggestion-chip" type="button" data-action="ask-suggestion" data-question="报告中的数据和当前数据相比有什么变化？">与当前数据相比有什么变化？</button></div>` : ""}
        ${messages}
        ${a.qaStatus === "running" ? `<div class="message assistant"><p>正在读取报告证据与历史语义定义…</p><div class="message-meta"><span>状态来自 Agent 应用</span><span>${esc(a.runId)}</span></div></div>` : ""}
        ${a.qaStatus === "completed" ? `<div class="notice">${icon("bot")}<div><strong>Agent 资源</strong><span>Session ${esc(a.sessionId)} · Binding ${esc(a.bindingId)} · Result ${esc(a.resultId)}</span></div></div>` : ""}
      </div>
      <div class="assistant-compose">
        <div class="compose-row"><input class="input" type="text" value="${esc(a.qaDraft)}" data-input="qa-draft" placeholder="询问当前报告或所选内容"><button class="btn primary icon-only" type="button" data-action="ask-report" title="发送" ${a.qaStatus === "running" ? "disabled" : ""}>${icon("send", "sm")}</button></div>
        <div class="inline-actions"><button class="text-link" type="button" data-action="start-current-comparison">与当前数据比较</button><button class="text-link" type="button" data-action="open-trace">查看追溯</button></div>
      </div>
    `;
  }

  function currentComparisonBlock() {
    const comparison = readingReport().comparison;
    if (comparison.status === "idle") return "";
    if (comparison.status === "running") return `<div class="notice">${icon("loader-circle")}<div><strong>正在固定比较上下文</strong><span>报告快照保持不变；处理中候选不会参与数值比较。</span></div></div>`;
    return `<div class="context-box"><span>比较记录 ${esc(comparison.recordId)}</span><strong>报告快照与当前权威数据</strong></div><div class="compare-grid"><div class="compare-card"><span>报告快照 · ${DATA.product.dataVersion}</span><strong>余额 21,613.387 亿元</strong><small>成本 2.372231%</small></div><div class="compare-card"><span>当前权威 · 2026.08.11-02</span><strong>余额 21,704.620 亿元</strong><small>成本 2.361480%</small></div></div><div class="verification-list"><div class="verification-item">${statusIcon("pass")}<div><h4>融资余额：可以比较</h4><p>增加 91.233 亿元（+0.42%）。</p></div><button class="text-link" type="button" data-action="open-anchor-evidence" data-anchor="metric-balance">证据</button></div><div class="verification-item">${statusIcon("warn")}<div><h4>担保结构：可以比较但有警告</h4><p>当前质量摘要仍包含未知担保方式，差异只覆盖可确认类别。</p></div><button class="text-link" type="button" data-action="open-anchor-evidence" data-anchor="structure-unknown">证据</button></div><div class="verification-item">${statusIcon("unverifiable")}<div><h4>叙述性建议：无法比较</h4><p>非结构化叙述不形成正式数值差异。</p></div></div></div><div class="notice warning">${icon("layers")}<div><strong>候选 2026.08.12-01 正在处理</strong><span>候选值未进入本次比较；报告正文和原比较记录均未修改。</span></div></div>`;
  }

  function assistantVerification() {
    const report = readingReport();
    const v = report.verification;
    const results = v.results.length ? v.results : verificationResults();
    const filtered = v.filter === "issues" ? results.filter((item) => item.status !== "pass") : results;
    if (report.comparison.status !== "idle") {
      return `<div class="assistant-content">${currentComparisonBlock()}</div><div class="assistant-compose"><div class="button-row"><button class="btn" type="button" data-action="close-comparison">返回自动核验</button><button class="btn primary" type="button" data-action="create-comparison-issue">${icon("message-square-warning", "sm")}创建复核问题</button></div></div>`;
    }
    if (v.status === "idle") {
      return `<div class="assistant-content"><div class="context-box"><span>核验范围</span><strong>${v.scope}</strong></div><div class="segmented"><button type="button" class="${v.scope === "整份报告" ? "active" : ""}" data-action="set-verification-scope" data-scope="整份报告">整份</button><button type="button" class="${v.scope === "当前章节" ? "active" : ""}" data-action="set-verification-scope" data-scope="当前章节">章节</button><button type="button" class="${v.scope === "当前锚点" ? "active" : ""}" data-action="set-verification-scope" data-scope="当前锚点">锚点</button></div><div class="notice">${icon("shield-check")}<div><strong>确定性核验</strong><span>先比对结构化证据并形成四态；无需等待 LLM。</span></div></div><div class="detail-list"><div class="detail-row"><span>事实项</span><strong>38 项</strong></div><div class="detail-row"><span>核验规则</span><strong>8 类检查 · 规则版本 1.4.0</strong></div><div class="detail-row"><span>固定版本</span><strong>${DATA.product.semanticVersion} / ${DATA.product.dataVersion}</strong></div></div></div><div class="assistant-compose"><button class="btn primary full" type="button" data-action="start-verification">${icon("shield-check", "sm")}开始核验</button></div>`;
    }
    if (["queued", "running"].includes(v.status)) {
      return `<div class="assistant-content"><div class="context-box"><span>核验运行 ${esc(v.runId)}</span><strong>${v.scope} · ${v.status === "queued" ? "排队中" : "运行中"}</strong></div><div class="progress-track"><span style="width:${v.progress}%"></span></div><div class="verification-summary"><div><span>计划</span><strong>38</strong></div><div><span>已完成</span><strong>${Math.floor(38 * v.progress / 100)}</strong></div><div><span>待处理</span><strong>${38 - Math.floor(38 * v.progress / 100)}</strong></div><div><span>执行异常</span><strong>0</strong></div></div><div class="notice">${icon("info")}<div><strong>核验尚未完整</strong><span>当前不会显示整份报告通过，也不会提前允许确认。</span></div></div></div><div class="assistant-compose"><button class="btn" type="button" data-action="navigate" data-route="/reports?tab=definitions">离开后返回</button></div>`;
    }
    const counts = results.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
    return `<div class="assistant-content"><div class="context-box"><span>核验运行 ${esc(v.runId)}</span><strong>已完成 · 覆盖完整 · 38 / 38</strong></div><div class="verification-summary"><div><span>通过</span><strong>${counts.pass || 0}</strong></div><div><span>警告</span><strong>${counts.warn || 0}</strong></div><div><span>失败</span><strong>${counts.fail || 0}</strong></div><div><span>无法核验</span><strong>${counts.unverifiable || 0}</strong></div></div><div class="segmented"><button type="button" class="${v.filter === "all" ? "active" : ""}" data-action="set-verification-filter" data-filter="all">全部</button><button type="button" class="${v.filter === "issues" ? "active" : ""}" data-action="set-verification-filter" data-filter="issues">仅看问题</button></div><div class="verification-list">${filtered.map((item) => `<div class="verification-item">${statusIcon(item.status)}<div><h4>${item.name}</h4><p>${item.issue}</p></div><button class="text-link" type="button" data-action="jump-anchor" data-anchor="${item.anchor}">定位</button></div>`).join("")}</div>${v.explanationStatus === "running" ? `<div class="notice">${icon("bot")}<div><strong>正在解释差异</strong><span>独立 Agent 运行 ${esc(v.explanationRunId)}；确定性四态保持不变。</span></div></div>` : v.explanationStatus === "completed" ? `<div class="notice success">${icon("bot")}<div><strong>差异解释已返回</strong><span>${esc(v.explanationText)}</span></div></div>` : ""}</div><div class="assistant-compose"><div class="button-row"><button class="btn" type="button" data-action="start-explanation" ${v.explanationStatus === "running" ? "disabled" : ""}>${icon("sparkles", "sm")}解释差异</button>${(counts.fail || counts.unverifiable) ? `<button class="btn primary" type="button" data-action="create-verification-issues">${icon("message-square-warning", "sm")}创建复核问题</button>` : `<button class="btn primary" type="button" data-action="confirm-draft">${icon("circle-check", "sm")}确认草稿</button>`}</div><button class="text-link" type="button" data-action="start-current-comparison">与当前数据比较</button></div>`;
  }

  function assistantPane() {
    return `<aside class="assistant-pane"><div class="pane-heading"><strong>报告助手</strong><small>以当前报告版本绑定的证据包为根</small></div><div class="assistant-tabs"><button class="${state.assistant.tab === "qa" ? "active" : ""}" type="button" data-action="set-assistant-tab" data-tab="qa">报告问答</button><button class="${state.assistant.tab === "verification" ? "active" : ""}" type="button" data-action="set-assistant-tab" data-tab="verification">自动核验</button></div>${state.assistant.tab === "qa" ? assistantQA() : assistantVerification()}</aside>`;
  }

  function canConfirmDraft() {
    const v = state.report.verification;
    if (v.status !== "completed" || !v.results.length) return false;
    return !v.results.some((item) => item.status === "fail" || item.status === "unverifiable");
  }

  function readerToolbar(isPublished) {
    const report = readingReport();
    const status = isPublished ? "已发布" : report.stage === "confirmed" ? "已确认待发布" : report.stage === "returned" ? "已退回" : "草稿待复核";
    let actions = "";
    if (isPublished) {
      actions = `<button class="btn" type="button" data-action="open-pdf">${icon("file-text", "sm")}PDF 固定版</button><button class="btn" type="button" data-action="open-trace">${icon("git-branch", "sm")}查看追溯</button><button class="btn primary" type="button" data-action="request-regeneration">${icon("refresh-cw", "sm")}请求重新生成</button>`;
    } else if (report.stage === "confirmed") {
      actions = `<button class="btn" type="button" data-action="cancel-confirmation">取消确认</button><button class="btn primary" type="button" data-action="open-publish">${icon("upload", "sm")}发布报告</button>`;
    } else if (report.stage === "returned") {
      actions = `<button class="btn primary" type="button" data-action="regenerate-report">${icon("refresh-cw", "sm")}重新生成</button>`;
    } else {
      actions = `<button class="btn" type="button" data-action="open-return">${icon("undo-2", "sm")}退回修订</button><button class="btn primary" type="button" data-action="confirm-draft">${icon("circle-check", "sm")}确认草稿</button>`;
    }
    return `<header class="reader-toolbar"><div class="reader-title"><button class="icon-button" type="button" data-action="navigate" data-route="${isPublished ? "/reports?tab=products" : "/reports/generate"}" title="返回">${icon("arrow-left")}</button><div><strong>集团融资成本与债务结构分析报告</strong><small>${isPublished ? report.reportNo : report.draftId} · 内容版本 ${report.contentVersion || report.draftVersion}</small></div>${badge(status)}</div><div class="header-actions">${actions}</div></header>`;
  }

  function renderReader(isPublished) {
    if (!readingReport().draftId) return renderGenerate();
    return renderShell(`<div class="reader-shell" data-screen-label="${isPublished ? "正式报告阅读页" : "草稿复核页"}">${readerToolbar(isPublished)}<div class="reader-grid">${tocPane()}<section class="report-viewport" id="report-viewport">${reportPaper()}</section>${assistantPane()}</div></div>`, { crumb: isPublished ? "正式报告阅读" : "草稿复核", mainClass: "reader-main" });
  }

  function renderPdf() {
    const report = readingReport();
    if (report.stage !== "published") return renderReports();
    return renderShell(`<div class="reader-shell" data-screen-label="PDF 固定版"><header class="reader-toolbar"><div class="reader-title"><button class="icon-button" type="button" data-action="navigate" data-route="/reports/view" title="返回">${icon("arrow-left")}</button><div><strong>PDF 固定版</strong><small>${report.reportNo} · 内容版本 ${report.contentVersion}</small></div>${badge("已发布")}</div><div class="header-actions"><button class="btn" type="button" data-action="print-report">${icon("printer", "sm")}打印或保存 PDF</button></div></header><div class="reader-grid" style="grid-template-columns:minmax(0,1fr)"><section class="report-viewport">${reportPaper()}</section></div></div>`, { crumb: "PDF 固定版", mainClass: "reader-main" });
  }

  function externalRecord(type, id) {
    const isDecision = type === "decision";
    const request = state.actionRequests.find((item) => item.id === id);
    const title = isDecision ? "Action Request 详情" : type === "agent" ? "Agent 运行记录" : "智能问数工作区";
    const owner = isDecision ? "决策中心" : type === "agent" ? "Agent 应用" : "智能问数";
    const returnRoute = isDecision ? "/dashboard/s001?tab=evidence" : type === "agent" ? "/dashboard/s001" : "/dashboard/s001";
    const body = isDecision && request ? `<div class="detail-list"><div class="detail-row"><span>Action Request</span><strong>${request.id}</strong></div><div class="detail-row"><span>来源</span><strong>报告中心仪表盘 · S001 · ${request.unit}</strong></div><div class="detail-row"><span>Action Type</span><strong>${DATA.product.actionType} · ${DATA.product.actionTypeVersion}</strong></div><div class="detail-row"><span>Rule 条件</span><strong>${request.ruleCode} · ${request.ruleVersion} · ${request.ruleBranch}</strong></div><div class="detail-row"><span>当前状态</span><strong>${request.status}</strong></div><div class="detail-row"><span>状态时点</span><strong>${request.createdAt}</strong></div></div>` : type === "agent" ? `<div class="detail-list"><div class="detail-row"><span>运行标识</span><strong>${esc(id)}</strong></div><div class="detail-row"><span>Agent Release</span><strong>3.1.0</strong></div><div class="detail-row"><span>固定上下文</span><strong>${state.report.evidencePackId || DATA.product.dataVersion}</strong></div><div class="detail-row"><span>权威状态</span><strong>已完成</strong></div></div>` : `<div class="detail-list"><div class="detail-row"><span>场景</span><strong>S001 集团融资成本与债务结构优化</strong></div><div class="detail-row"><span>范围</span><strong>${state.dashboard.scopeId}</strong></div><div class="detail-row"><span>所选单位</span><strong>${state.dashboard.compareUnits.join("、")}</strong></div><div class="detail-row"><span>版本</span><strong>${DATA.product.semanticVersion} / ${DATA.product.dataVersion}</strong></div></div>`;
    return `<div class="external-shell" data-screen-label="${title}"><header class="external-head"><div class="status-inline">${icon(isDecision ? "list-checks" : type === "agent" ? "bot" : "message-square-text")}<strong>${owner}</strong></div><button class="btn" type="button" data-action="external-return" data-route="${returnRoute}">${icon("arrow-left", "sm")}返回报告中心</button></header><main class="external-body"><article class="external-card"><header class="external-card-head"><h1>${title}</h1><p>通过稳定详情入口打开；返回后报告中心将重新读取权威状态。</p></header><div class="external-card-body">${body}<div class="notice" style="margin-top:14px">${icon("shield-check")}<div><strong>状态归 ${owner} 维护</strong><span>此处只展示跳转目标和传入上下文，不提供跨模块状态写入操作。</span></div></div></div></article></main></div>`;
  }

  function renderExternal(path) {
    const parts = path.split("/").filter(Boolean);
    return externalRecord(parts[1] || "decision", decodeURIComponent(parts.slice(2).join("/")));
  }

  function metricMeta(key) {
    const map = {
      balance: ["融资余额", "21,613.387 亿元", "全部融资明细折合人民币余额的受治理合计结果"],
      cost: ["余额加权融资成本", "2.372231%", "按折合人民币余额加权，不对单位成本做简单平均"],
      floating: ["浮动利率余额占比", "95.149492%", "浮动利率融资余额占当前范围融资余额的比例"],
      shortTerm: ["短期债务余额占比", "0.911805%", "短期分类余额占当前范围融资余额的比例"],
      foreign: ["外币融资余额占比", "4.224132%", "非人民币融资折合余额占当前范围融资余额的比例"],
      highCost: ["高成本融资余额占比", "9.859389%", "高于受治理高成本界限的融资余额占比"],
      credit: ["信用融资余额占比", "34.680039%", "信用分类余额占比，未知担保方式不计入信用"],
    };
    return map[key] || map.balance;
  }

  function renderDrawer() {
    const drawer = state.ui.drawer;
    if (!drawer) return "";
    const report = readingReport();
    let title = "详情";
    let body = "";
    let foot = `<button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    if (drawer.type === "trust") {
      title = "数据状态与版本";
      body = `<div class="section-stack"><div class="notice warning">${icon("shield-alert")}<div><strong>质量有提示</strong><span>1,868 笔融资明细的担保方式为空；未知值保持单列，不计入信用融资。</span></div></div><div class="detail-list"><div class="detail-row"><span>当前权威组合</span><strong>语义 ${DATA.product.semanticVersion} + 数据 ${DATA.product.dataVersion}</strong></div><div class="detail-row"><span>数据截至</span><strong>${DATA.product.asOf}</strong></div><div class="detail-row"><span>发布时质量</span><strong>通过 · 5,218 笔融资明细身份与余额完整</strong></div><div class="detail-row"><span>核验时质量</span><strong>有提示 · 担保方式未知不影响其他结构事实</strong></div><div class="detail-row"><span>处理中候选</span><strong>无</strong></div><div class="detail-row"><span>数据侧上一已通过版本</span><strong>2026.08.08-01</strong></div><div class="detail-row"><span>本体上一权威组合</span><strong>语义 3.8.0 + 数据 2026.08.08-01</strong></div></div><div class="notice">${icon("info")}<div><strong>只读可信度摘要</strong><span>报告中心不切换权威版本，也不读取数据工程业务明细。</span></div></div></div>`;
      foot = `<button class="btn" type="button" data-action="reread-trust">${icon("refresh-cw", "sm")}重新读取</button><button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    } else if (drawer.type === "metric") {
      const [name, value, definition] = metricMeta(drawer.metric);
      title = "口径与证据";
      body = `<div class="detail-list"><div class="detail-row"><span>指标</span><strong>${name}</strong></div><div class="detail-row"><span>当前结果</span><strong>${value} · ${state.dashboard.scopeId}</strong></div><div class="detail-row"><span>业务口径</span><strong>${definition}</strong></div><div class="detail-row"><span>Published 语义版本</span><strong>${DATA.product.semanticVersion}</strong></div><div class="detail-row"><span>结果版本</span><strong>${DATA.product.metricResultVersion}</strong></div><div class="detail-row"><span>数据版本</span><strong>${DATA.product.dataVersion}</strong></div><div class="detail-row"><span>数据截至</span><strong>${DATA.product.asOf}</strong></div></div>`;
    } else if (drawer.type === "structure") {
      title = drawer.name;
      body = `<div class="notice">${icon("layers")}<div><strong>受治理结构视图</strong><span>余额、占比和笔数来自已发布语义结果；报告中心只负责筛选、展示和下钻。</span></div></div>${structureGrid()}`;
    } else if (drawer.type === "rule") {
      const unit = DATA.units[drawer.unit];
      title = `${unit.rule.code} · ${unit.rule.name}`;
      body = `<div class="detail-list"><div class="detail-row"><span>业务主体</span><strong>${drawer.unit}</strong></div><div class="detail-row"><span>命中状态</span><strong>${unit.rule.status}</strong></div><div class="detail-row"><span>指标快照</span><strong>${unit.rule.metric} ${unit.rule.metricValue}</strong></div><div class="detail-row"><span>阈值</span><strong>${unit.rule.threshold}</strong></div><div class="detail-row"><span>触发分支</span><strong>${unit.rule.branch}</strong></div><div class="detail-row"><span>评估时间</span><strong>${unit.rule.evaluatedAt}</strong></div><div class="detail-row"><span>Rule 版本</span><strong>${DATA.product.semanticVersion} / ${DATA.product.ruleResultVersion}</strong></div></div><h3>优先协商机构</h3>${institutionTable(unit.institutions)}`;
      foot = `<button class="btn primary" type="button" data-action="open-action" data-unit="${drawer.unit}">${icon("send", "sm")}发起行动</button><button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    } else if (drawer.type === "definition") {
      const def = [...DATA.definitions, ...state.customDefinitions].find((item) => item.id === drawer.id);
      title = "报告定义详情";
      body = `<div class="detail-list"><div class="detail-row"><span>名称</span><strong>${esc(def.name)}</strong></div><div class="detail-row"><span>业务目的</span><strong>${esc(def.purpose)}</strong></div><div class="detail-row"><span>适用对象</span><strong>${esc(def.audience)}</strong></div><div class="detail-row"><span>模板引用</span><strong>${esc(def.template || "待选择")}</strong></div><div class="detail-row"><span>证据范围</span><strong>${esc(def.evidence || "待补充")}</strong></div><div class="detail-row"><span>Agent / Skill</span><strong>${esc(def.agent || "待选择")}</strong></div><div class="detail-row"><span>校验规则</span><strong>${esc(def.validation || "待补充")}</strong></div><div class="detail-row"><span>复核规则</span><strong>${esc(def.review || "待补充")}</strong></div><div class="detail-row"><span>发布规则</span><strong>${esc(def.publish || "待补充")}</strong></div></div><div class="notice">${icon("info")}<div><strong>定义与模板分离</strong><span>业务目的、证据、Agent、校验和发布规则不写入模板。</span></div></div>`;
    } else if (drawer.type === "template") {
      const item = DATA.templates[0];
      title = "报告模板详情";
      body = `<div class="detail-list"><div class="detail-row"><span>模板</span><strong>${item.name} · ${item.version}</strong></div><div class="detail-row"><span>章节骨架</span><strong>${item.chapters.join(" → ")}</strong></div><div class="detail-row"><span>受控内容组件</span><strong>章节、指标卡、数据表、图表、Rule 摘要、脚注、附件</strong></div><div class="detail-row"><span>固定呈现</span><strong>${item.formats.join(" / ")}</strong></div></div><div class="notice">${icon("shield-check")}<div><strong>模板只负责骨架与版式</strong><span>不维护业务口径、证据范围、Agent 配置、复核或发布规则。</span></div></div>`;
    } else if (drawer.type === "trace") {
      title = "报告追溯";
      body = `<div class="timeline"><div class="timeline-row done"><span class="timeline-node"></span><div><strong>报告定义与模板</strong><small>RD-FIN-001 1.0.0 · RT-FIN-002 2.2.0</small></div><time>固定</time></div><div class="timeline-row done"><span class="timeline-node"></span><div><strong>生成证据包</strong><small>${esc(report.evidencePackId)} · 语义 ${DATA.product.semanticVersion} · 数据 ${DATA.product.dataVersion}</small></div><time>${DATA.product.asOf}</time></div><div class="timeline-row done"><span class="timeline-node"></span><div><strong>Agent 源草稿</strong><small>${esc(report.generationRunId)} · 结构化内容项与包内引用</small></div><time>${esc(report.generatedAt || "未形成")}</time></div><div class="timeline-row ${report.verification.status === "completed" ? "done" : "active"}"><span class="timeline-node"></span><div><strong>确定性自动核验</strong><small>${esc(report.verification.runId || "未发起")} · ${report.verification.status}</small></div><time>${esc(report.verification.completedAt || "")}</time></div><div class="timeline-row ${report.confirmedAt ? "done" : "active"}"><span class="timeline-node"></span><div><strong>人工复核</strong><small>${report.confirmedAt ? "已确认" : report.stage === "returned" ? "已退回" : "待处理"}</small></div><time>${esc(report.confirmedAt || report.returnedAt || "")}</time></div><div class="timeline-row ${report.stage === "published" ? "done" : ""}"><span class="timeline-node"></span><div><strong>正式报告产物</strong><small>${report.stage === "published" ? `${report.reportNo} · HTML / PDF · ${report.contentVersion}` : "尚未发布"}</small></div><time>${esc(report.publishedAt || "")}</time></div></div>`;
    } else if (drawer.type === "anchor-evidence") {
      title = "报告位置与权威证据";
      body = `<div class="detail-list"><div class="detail-row"><span>报告位置</span><strong>${esc(drawer.anchor)}</strong></div><div class="detail-row"><span>内容版本</span><strong>${esc(report.contentVersion || report.draftVersion)}</strong></div><div class="detail-row"><span>证据包</span><strong>${esc(report.evidencePackId)}</strong></div><div class="detail-row"><span>Published 语义</span><strong>${DATA.product.semanticVersion}</strong></div><div class="detail-row"><span>数据版本</span><strong>${DATA.product.dataVersion} · 截至 ${DATA.product.asOf}</strong></div><div class="detail-row"><span>质量与新鲜度</span><strong>发布时质量通过 · 核验时有提示 · 生成时新鲜</strong></div><div class="detail-row"><span>责任位置</span><strong>语义定义：本体管理 · 数据可信度：数据工程 · 内容绑定：报告中心</strong></div></div>`;
    } else if (drawer.type === "scene") {
      const scene = DATA.scenes.find((item) => item.id === drawer.sceneId);
      title = `${scene.id} · ${scene.name}`;
      const missing = scene.id === "S002" ? ["预算业务目标与周期", "预算版本与口径清单", "差异分析与验收样例"] : scene.id === "S003" ? ["风险类别与监测周期", "指标、Rule 与阈值", "责任人与行动需求"] : ["正式报告样例与读者", "章节、证据与判断规则", "复核、发布与交付要求"];
      body = `<div class="notice warning">${icon("clock")}<div><strong>资料待补充</strong><span>当前只保留稳定入口、资源清单和接入门，不生成业务图表或结论。</span></div></div><h3>所需资料</h3><div class="checklist">${missing.map((item) => `<div class="check-row">${icon("circle-dashed", "sm")}<div><strong>${item}</strong><span>由场景业务 Owner 补充并确认</span></div></div>`).join("")}</div><h3>下一步</h3><p class="help-text">资料补齐后，按对象、指标、Rule、证据、数据就绪和验收样例逐项接入。</p>`;
    }
    return `<div class="drawer-backdrop"><aside class="drawer"><header class="drawer-head"><h2>${title}</h2><button class="icon-button" type="button" data-action="close-drawer" title="关闭">${icon("x")}</button></header><div class="drawer-body">${body}</div><footer class="drawer-foot">${foot}</footer></aside></div>`;
  }

  function renderModal() {
    const modal = state.ui.modal;
    if (!modal) return "";
    const report = readingReport();
    let title = "";
    let subtitle = "";
    let body = "";
    let foot = "";
    let wide = false;
    if (modal.type === "reset") {
      title = "重置状态";
      subtitle = "清除本次操作产生的请求、草稿、核验、报告和助手记录。";
      body = `<div class="notice warning">${icon("rotate-ccw")}<div><strong>将恢复到初始工作区</strong><span>S001 基础数据与已启用定义保留；所有操作过程和结果清空。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="confirm-reset">重置状态</button>`;
    } else if (modal.type === "generation") {
      title = "生成集团融资经营分析报告";
      subtitle = "固定定义、模板、对象和证据范围后再发起 Agent 生成。";
      body = `<div class="form-grid"><div class="form-field full"><label>报告定义</label><input class="input" value="集团融资经营分析报告 · 1.0.0" readonly></div><div class="form-field"><label>适用对象</label><input class="input" value="集团融资经营分析" readonly></div><div class="form-field"><label>数据截至</label><input class="input" value="${DATA.product.asOf}" readonly></div><div class="form-field full"><label>证据范围</label><label class="radio-card"><input type="radio" name="generation-mode" value="standard" data-change="generation-mode" ${state.report.generationMode === "standard" ? "checked" : ""}><span><strong>标准集团证据</strong><span>集团指标、三家重点单位、R01/R02/R03、机构贡献与可信度摘要。</span></span></label><label class="radio-card"><input type="radio" name="generation-mode" value="restricted" data-change="generation-mode" ${state.report.generationMode === "restricted" ? "checked" : ""}><span><strong>增加机构授信附件</strong><span>附件权限会在固定证据时重新校验；不可读时停在证据缺失。</span></span></label></div><div class="form-field full"><div class="notice">${icon("shield-check")}<div><strong>生成门</strong><span>证据固定完成后才发起 Agent；Agent 只接收受控结构化证据，不生成任意 HTML。</span></div></div></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-generation">固定证据并生成</button>`;
    } else if (modal.type === "action") {
      const unitName = state.ui.actionUnit;
      const unit = DATA.units[unitName];
      wide = true;
      title = "发起融资优化建议";
      subtitle = "只向决策中心提交标准 Action Request。";
      body = `<div class="form-grid"><div class="form-field full"><label for="action-unit">单一业务主体</label><select class="select" id="action-unit" data-change="action-unit">${Object.keys(DATA.units).map((name) => `<option value="${name}" ${name === unitName ? "selected" : ""}>${name}</option>`).join("")}</select></div><div class="form-field"><label>来源类型</label><input class="input" value="报告中心仪表盘" readonly></div><div class="form-field"><label>来源记录</label><input class="input" value="S001 / 仪表盘 ${DATA.product.dashboardVersion} / Rule 与行动" readonly></div><div class="form-field"><label>发起者</label><input class="input" value="财务分析员" readonly></div><div class="form-field"><label>请求时间</label><input class="input" value="提交时生成" readonly></div><div class="form-field"><label>已发布 Action Type</label><input class="input" value="${DATA.product.actionType} · ${DATA.product.actionTypeVersion}" readonly></div><div class="form-field"><label>Rule 条件</label><input class="input" value="${unit.rule.code} · ${unit.rule.name}" readonly></div><div class="form-field"><label>触发分支</label><input class="input" value="${unit.rule.branch}" readonly></div><div class="form-field"><label>评估时间</label><input class="input" value="${unit.rule.evaluatedAt}" readonly></div><div class="form-field"><label>Metric 快照</label><input class="input" value="${unit.rule.metric} ${unit.rule.metricValue}" readonly></div><div class="form-field"><label>语义 / 数据版本</label><input class="input" value="${DATA.product.semanticVersion} / ${DATA.product.dataVersion}" readonly></div><div class="form-field full"><label>行动建议上下文</label><textarea class="textarea" readonly>优先协商机构：${unit.institutions.map((item) => item.name).join("、")}；候选借据：${unit.loans.map((item) => item.id).join("、")}；建议方向：${unit.rule.code === "R01" ? "降息或置换高成本借据" : unit.rule.code === "R02" ? "固定利率、利率上限或重定价条款" : "展期或置换中长期融资"}</textarea></div></div><div class="notice" style="margin-top:12px">${icon("info")}<div><strong>提交结果边界</strong><span>取得 Action Request ID 只表示请求已进入决策中心，不表示提醒已确认、待办已创建或行动已执行。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-action">${icon("send", "sm")}提交请求</button>`;
    } else if (modal.type === "action-submitting") {
      title = "正在提交 Action Request";
      body = `<div class="progress-card"><div class="progress-head"><div><h2>正在等待决策中心接收</h2><p>${esc(modal.unit)} · ${esc(modal.ruleCode)}</p></div>${badge("处理中")}</div><div class="progress-track"><span style="width:68%"></span></div></div>`;
      foot = `<button class="btn" type="button" disabled>请稍候</button>`;
    } else if (modal.type === "action-result") {
      const request = state.actionRequests.find((item) => item.id === modal.id);
      title = "Action Request 已接收";
      body = `<div class="notice success">${icon("circle-check")}<div><strong>${esc(request.id)}</strong><span>决策中心已返回请求标识。</span></div></div><div class="detail-list" style="margin-top:12px"><div class="detail-row"><span>业务主体</span><strong>${request.unit}</strong></div><div class="detail-row"><span>Rule</span><strong>${request.ruleCode} · ${request.ruleName}</strong></div><div class="detail-row"><span>请求时间</span><strong>${request.createdAt}</strong></div><div class="detail-row"><span>当前含义</span><strong>请求已进入决策中心</strong></div></div><div class="notice warning">${icon("shield-alert")}<div><strong>尚不代表后续决策状态</strong><span>提醒确认、负责人待办与行动执行状态只能在决策中心查看。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">留在驾驶舱</button><button class="btn primary" type="button" data-action="open-external-decision" data-id="${request.id}">查看详情</button>`;
    } else if (modal.type === "return") {
      title = "退回草稿修订";
      subtitle = "原草稿、核验结果和复核问题保持只读。";
      const issueCount = report.verification.results.filter((item) => item.status === "fail" || item.status === "unverifiable").length;
      body = `<div class="notice warning">${icon("message-square-warning")}<div><strong>${issueCount || 1} 项问题需要处理</strong><span>重新生成后形成新的草稿版本和内容证据绑定。</span></div></div><div class="form-field" style="margin-top:12px"><label>退回意见</label><textarea class="textarea" id="return-note">修正高成本融资余额占比，并为行动建议补充结构化证据绑定。</textarea></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-return">确认退回</button>`;
    } else if (modal.type === "publish") {
      title = "发布正式报告";
      subtitle = "从同一已确认内容版本形成两种固定呈现。";
      body = `<div class="detail-list"><div class="detail-row"><span>内容版本</span><strong>${report.contentVersion}</strong></div><div class="detail-row"><span>HTML 阅读版</span><strong>章节目录、稳定锚点、证据入口与报告助手</strong></div><div class="detail-row"><span>PDF 固定版</span><strong>同内容、同报告编号、同证据链</strong></div><div class="detail-row"><span>发布后</span><strong>冻结，不随新数据或模板原地变化</strong></div></div><div class="notice">${icon("shield-check")}<div><strong>发布完成门</strong><span>HTML 与 PDF 均形成后，正式报告才进入产物库。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-publish">${icon("upload", "sm")}确认发布</button>`;
    } else if (modal.type === "new-definition") {
      title = "新建报告定义";
      subtitle = "先形成可校验业务合同，再启用生成。";
      body = `<div class="form-grid"><div class="form-field full"><label>名称</label><input class="input" data-input="definition-name" value="${esc(state.ui.tempDefinitionName)}" placeholder="例如：月度融资机构集中度报告"></div><div class="form-field full"><label>业务目的</label><textarea class="textarea" data-input="definition-purpose" placeholder="说明报告要回答的业务问题">${esc(state.ui.tempDefinitionPurpose)}</textarea></div><div class="form-field"><label>适用对象</label><select class="select"><option>集团财务管理者</option><option>融资分析人员</option></select></div><div class="form-field"><label>模板引用</label><select class="select"><option>融资经营分析模板 2.2.0</option></select></div></div><div class="notice" style="margin-top:12px">${icon("info")}<div><strong>保存为编辑中</strong><span>证据范围、Agent、校验、复核和发布规则补齐并校验后才能启用。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="save-new-definition">保存定义</button>`;
    } else if (modal.type === "regenerate") {
      title = "请求重新生成";
      subtitle = "正式报告保持冻结，新请求将形成新的证据包和产物。";
      body = `<div class="form-field"><label>重新生成原因</label><textarea class="textarea" id="regenerate-note">根据当前数据形成新的融资经营分析报告，并保留与原报告的替代关系。</textarea></div><div class="notice warning" style="margin-top:12px">${icon("layers")}<div><strong>原报告不会变化</strong><span>${report.reportNo}、内容版本 ${report.contentVersion} 和全部锚点继续可读。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="start-regeneration-from-published">创建新请求</button>`;
    }
    return `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}"><header class="modal-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div>${modal.type !== "action-submitting" ? `<button class="icon-button" type="button" data-action="close-modal" title="关闭">${icon("x")}</button>` : ""}</header><div class="modal-body">${body}</div><footer class="modal-foot">${foot}</footer></section></div>`;
  }

  function restoreScroll() {
    if (!state.ui.pendingScrollAnchor) return;
    const anchor = state.ui.pendingScrollAnchor;
    state.ui.pendingScrollAnchor = null;
    saveState();
    window.requestAnimationFrame(() => {
      const element = document.getElementById(anchor);
      if (element) element.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function renderApp() {
    const { path } = routeInfo();
    let html = "";
    if (path === "/scenes") html = renderScenes();
    else if (path === "/dashboard/s001") html = renderDashboard();
    else if (path === "/reports") html = renderReports();
    else if (path === "/reports/generate") html = renderGenerate();
    else if (path === "/reports/draft") html = renderReader(false);
    else if (path === "/reports/view") html = readingReport().stage === "published" ? renderReader(true) : renderGenerate();
    else if (path === "/reports/pdf") html = renderPdf();
    else if (path.startsWith("/external/")) html = renderExternal(path);
    else html = renderDashboard();
    if (!path.startsWith("/external/")) html += renderDrawer() + renderModal();
    app.innerHTML = html;
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
    restoreScroll();
  }

  function beginGeneration(mode = state.report.generationMode, isRevision = false, requestIdOverride = null) {
    const oldRevision = state.report.revisionNumber;
    const requestId = requestIdOverride || makeId(isRevision ? "RGR" : "RGEN");
    state.report.stage = "evidence";
    state.report.progress = 18;
    state.report.requestId = requestId;
    state.report.evidencePackId = makeId("EP");
    state.report.generationRunId = null;
    state.report.generationMode = mode;
    state.ui.modal = null;
    commit();
    schedule(() => {
      state.report.progress = 48;
      if (mode === "restricted") {
        state.report.stage = "evidence_missing";
        commit();
        toast("证据固定未完成", "机构授信附件不可读；未发起 Agent 生成。", "danger");
        return;
      }
      state.report.stage = "generating";
      state.report.generationRunId = makeId("AGR");
      commit();
      schedule(() => {
        state.report.progress = 86;
        commit();
      }, 700);
      schedule(() => {
        state.report.stage = "draft";
        state.report.progress = 100;
        state.report.revisionNumber = isRevision ? Math.max(2, oldRevision + 1) : 1;
        state.report.draftId = state.report.draftId || makeId("DRAFT");
        state.report.draftVersion = isRevision ? `0.${state.report.revisionNumber}` : "0.1";
        state.report.contentVersion = state.report.draftVersion;
        state.report.generatedAt = nowText();
        state.report.returnedAt = null;
        state.report.confirmedAt = null;
        state.report.verification = { status: "idle", progress: 0, runId: null, scope: "整份报告", filter: "all", results: [], completedAt: null, explanationStatus: "idle", explanationRunId: null, explanationText: null };
        state.report.comparison = { status: "idle", recordId: null, comparedAt: null };
        state.assistant = { tab: "qa", selectedAnchor: "metric-cost", selectedSection: "sec-overview", qaDraft: "", qaStatus: "idle", sessionId: null, bindingId: null, runId: null, resultId: null, messages: [] };
        commit();
        toast("草稿已返回", `内容版本 ${state.report.draftVersion}，可进入核验与人工复核。`, "success");
      }, 1600);
    }, 850);
  }

  function answerForQuestion(question) {
    if (question.includes("当前") || question.includes("变化")) return { text: "默认回答只依据报告生成时快照。要比较当前权威数据，请显式选择“与当前数据比较”；原报告内容不会变化。", anchor: "metric-cost" };
    if (question.includes("553") || question.includes("R01")) return { text: "单位553命中 R01 的原因是高成本融资余额占比为 77.337244%，超过 20% 阈值。问题融资优先集中在欧陆银行、寰宇银行和海联银行。", anchor: "rule-r01-result" };
    if (question.includes("下降") || question.includes("成本")) return { text: "报告快照显示集团加权融资成本为 2.372231%，近十二个月由 2.46% 逐步下降。该结论引用月末受治理指标结果，不对单位成本做简单平均。", anchor: "metric-cost" };
    return { text: "当前结论基于报告生成时证据包。集团融资余额为 21,613.387 亿元，加权融资成本为 2.372231%；相关版本、时点与质量提示可从证据详情查看。", anchor: state.assistant.selectedAnchor };
  }

  function handleAction(element) {
    const action = element.dataset.action;
    if (action === "navigate") {
      const route = element.dataset.route;
      if (route === "/reports/draft" || route === "/reports/generate") state.ui.viewingReportNo = null;
      if (route === "/reports/view" && !state.ui.viewingReportNo && state.report.stage === "published") state.ui.viewingReportNo = state.report.reportNo;
      saveState();
      return navigate(route);
    }
    if (action === "open-published-report") {
      state.ui.viewingReportNo = element.dataset.report;
      state.assistant = newState().assistant;
      saveState();
      return navigate("/reports/view");
    }
    if (action === "toggle-nav") { state.navOpen = !state.navOpen; return commit(); }
    if (action === "open-reset") { state.ui.modal = { type: "reset" }; return commit(); }
    if (action === "confirm-reset") {
      clearTimers();
      localStorage.removeItem(STORAGE_KEY);
      state = newState();
      saveState();
      window.location.hash = "/dashboard/s001";
      renderApp();
      return toast("状态已重置", "操作产生的请求、草稿、报告和助手记录已清除。", "success");
    }
    if (action === "close-modal") { state.ui.modal = null; return commit(); }
    if (action === "close-drawer") { state.ui.drawer = null; return commit(); }
    if (action === "open-trust") { state.ui.drawer = { type: "trust" }; return commit(); }
    if (action === "reread-trust") { toast("数据状态已重新读取", `当前权威组合仍为 ${DATA.product.semanticVersion} / ${DATA.product.dataVersion}。`, "success"); return; }
    if (action === "open-metric") { state.ui.drawer = { type: "metric", metric: element.dataset.metric }; return commit(); }
    if (action === "open-structure") { state.ui.drawer = { type: "structure", name: element.dataset.structure }; return commit(); }
    if (action === "open-institution") { toast("已打开机构明细", `${element.dataset.institution} · 当前范围 ${state.dashboard.scopeId}`); return; }
    if (action === "open-scene-readiness") { state.ui.drawer = { type: "scene", sceneId: element.dataset.scene }; return commit(); }
    if (action === "set-scope-type") {
      state.dashboard.scopeType = element.dataset.type;
      state.dashboard.scopeId = element.dataset.type === "group" ? "集团" : element.dataset.type === "board" ? DATA.boards[0].name : Object.keys(DATA.units)[0];
      return commit();
    }
    if (action === "set-dashboard-tab") { state.dashboard.tab = element.dataset.tab; return commit(); }
    if (action === "toggle-compare-unit") {
      const unit = element.dataset.unit;
      const selected = state.dashboard.compareUnits;
      if (selected.includes(unit)) state.dashboard.compareUnits = selected.filter((item) => item !== unit);
      else if (selected.length < 3) state.dashboard.compareUnits = [...selected, unit];
      else return toast("最多选择 3 家单位", "先移除一项，再选择其他单位。", "danger");
      return commit();
    }
    if (action === "open-rule") { state.ui.drawer = { type: "rule", unit: element.dataset.unit }; return commit(); }
    if (action === "open-action") {
      state.ui.drawer = null;
      state.ui.actionUnit = element.dataset.unit || (state.dashboard.scopeType === "unit" ? state.dashboard.scopeId : state.dashboard.compareUnits[0] || "单位553");
      state.ui.modal = { type: "action" };
      return commit();
    }
    if (action === "submit-action") {
      const unitName = state.ui.actionUnit;
      const unit = DATA.units[unitName];
      state.ui.modal = { type: "action-submitting", unit: unitName, ruleCode: unit.rule.code };
      commit();
      schedule(() => {
        const request = {
          id: makeId("AR"),
          unit: unitName,
          status: "请求已接收",
          createdAt: nowText(),
          sourceType: "报告中心仪表盘",
          sourceRecord: `S001 / ${DATA.product.dashboardVersion} / Rule 与行动`,
          initiator: "财务分析员",
          actionType: DATA.product.actionType,
          actionTypeVersion: DATA.product.actionTypeVersion,
          ruleCode: unit.rule.code,
          ruleName: unit.rule.name,
          ruleVersion: DATA.product.semanticVersion,
          ruleBranch: unit.rule.branch,
          metricSnapshot: `${unit.rule.metric} ${unit.rule.metricValue}`,
          semanticVersion: DATA.product.semanticVersion,
          dataVersion: DATA.product.dataVersion,
          asOf: DATA.product.asOf,
        };
        state.actionRequests.unshift(request);
        state.ui.modal = { type: "action-result", id: request.id };
        commit();
      }, 1000);
      return;
    }
    if (action === "reread-decision") { toast("决策摘要已重新读取", state.actionRequests.length ? "已按 Action Request 标识取得当前摘要。" : "当前场景没有关联决策记录。", "success"); return; }
    if (action === "open-external-decision") { state.ui.modal = null; state.ui.drawer = null; saveState(); return navigate(`/external/decision/${encodeURIComponent(element.dataset.id)}`); }
    if (action === "open-external-agent") { state.ui.modal = null; return navigate(`/external/agent/${encodeURIComponent(element.dataset.id)}`); }
    if (action === "open-ask") return navigate(`/external/ask/${encodeURIComponent(element.dataset.context || state.dashboard.scopeId)}`);
    if (action === "external-return") {
      navigate(element.dataset.route);
      schedule(() => toast("已返回报告中心", "当前页面已重新读取外部权威状态。", "success"), 60);
      return;
    }
    if (action === "generate-insight") {
      state.insight = { status: "running", resultId: null, runId: makeId("AIR"), generatedAt: null, contentStatus: "待确认", referenced: state.insight.referenced };
      commit();
      schedule(() => { state.insight.status = "ready"; state.insight.resultId = makeId("AIO"); state.insight.generatedAt = nowText(); commit(); toast("洞察已生成", "内容状态来自 Agent 应用，尚未自动引用到驾驶舱。", "success"); }, 1400);
      return;
    }
    if (action === "request-insight-confirm") {
      state.insight.status = "confirming";
      commit();
      schedule(() => { state.insight.status = "ready"; state.insight.contentStatus = "已确认"; commit(); toast("已读取内容确认结果", "结果由 Agent 应用维护，驾驶舱引用仍需单独操作。", "success"); }, 1000);
      return;
    }
    if (action === "toggle-insight-reference") { state.insight.referenced = !state.insight.referenced; commit(); toast(state.insight.referenced ? "已引用到驾驶舱" : "已停止引用", "Agent 内容确认与新鲜度状态未改变。", "success"); return; }
    if (action === "open-definition") { state.ui.drawer = { type: "definition", id: element.dataset.id }; return commit(); }
    if (action === "open-template") { state.ui.drawer = { type: "template", id: element.dataset.id }; return commit(); }
    if (action === "open-new-definition") { state.ui.tempDefinitionName = ""; state.ui.tempDefinitionPurpose = ""; state.ui.modal = { type: "new-definition" }; return commit(); }
    if (action === "save-new-definition") {
      if (!state.ui.tempDefinitionName.trim() || !state.ui.tempDefinitionPurpose.trim()) return toast("请补齐名称和业务目的", "缺少必填内容时不能保存报告定义。", "danger");
      state.customDefinitions.push({ id: makeId("RD"), name: state.ui.tempDefinitionName.trim(), purpose: state.ui.tempDefinitionPurpose.trim(), audience: "集团财务管理者", version: "0.1.0", template: "融资经营分析模板 2.2.0", evidence: "待补充", agent: "待选择", validation: "待补充", review: "待补充", publish: "待补充", status: "编辑中" });
      state.ui.modal = null;
      commit();
      toast("报告定义已保存", "当前状态为编辑中，完成校验前不会进入可生成目录。", "success");
      return;
    }
    if (action === "open-generation-modal") { state.ui.modal = { type: "generation" }; return commit(); }
    if (action === "submit-generation") return beginGeneration();
    if (action === "retry-standard-generation") { state.report.generationMode = "standard"; return beginGeneration("standard"); }
    if (action === "open-trace") { state.ui.drawer = { type: "trace" }; return commit(); }
    if (action === "jump-section") {
      state.assistant.selectedSection = element.dataset.section;
      state.ui.pendingScrollAnchor = element.dataset.section;
      return commit();
    }
    if (action === "select-anchor" || action === "jump-anchor") {
      const anchor = element.dataset.anchor;
      state.assistant.selectedAnchor = anchor;
      state.ui.pendingScrollAnchor = anchor;
      return commit();
    }
    if (action === "open-anchor-evidence") { state.ui.drawer = { type: "anchor-evidence", anchor: element.dataset.anchor }; return commit(); }
    if (action === "set-assistant-tab") { state.assistant.tab = element.dataset.tab; return commit(); }
    if (action === "ask-suggestion") { state.assistant.qaDraft = element.dataset.question; return commit(); }
    if (action === "ask-report") {
      const question = state.assistant.qaDraft.trim();
      if (!question) return toast("请输入问题", "助手只会基于当前报告版本和证据包回答。", "danger");
      state.assistant.messages.push({ role: "user", text: question });
      state.assistant.qaDraft = "";
      state.assistant.qaStatus = "running";
      state.assistant.sessionId = state.assistant.sessionId || makeId("SES");
      state.assistant.bindingId = state.assistant.bindingId || makeId("BIND");
      state.assistant.runId = makeId("QAR");
      commit();
      schedule(() => {
        const answer = answerForQuestion(question);
        state.assistant.messages.push({ role: "assistant", text: answer.text, anchor: answer.anchor });
        state.assistant.qaStatus = "completed";
        state.assistant.resultId = makeId("ANS");
        commit();
      }, 1250);
      return;
    }
    if (action === "set-verification-scope") { readingReport().verification.scope = element.dataset.scope; return commit(); }
    if (action === "start-verification") {
      const report = readingReport();
      const v = report.verification;
      v.status = "queued"; v.progress = 4; v.runId = makeId("VRF"); v.results = []; v.completedAt = null; v.explanationStatus = "idle";
      commit();
      schedule(() => { v.status = "running"; v.progress = 36; commit(); }, 500);
      schedule(() => { v.progress = 74; commit(); }, 1100);
      schedule(() => { v.status = "completed"; v.progress = 100; v.results = verificationResults(); v.completedAt = nowText(); commit(); toast("自动核验已完成", report.revisionNumber <= 1 ? "发现阻断项，不能确认草稿。" : "覆盖完整，必需检查项没有阻断。", report.revisionNumber <= 1 ? "danger" : "success"); }, 1800);
      return;
    }
    if (action === "set-verification-filter") { readingReport().verification.filter = element.dataset.filter; return commit(); }
    if (action === "start-explanation") {
      const report = readingReport();
      const v = report.verification;
      v.explanationStatus = "running"; v.explanationRunId = makeId("VEX"); v.explanationText = null;
      commit();
      schedule(() => { v.explanationStatus = "completed"; v.explanationText = report.revisionNumber <= 1 ? "高成本余额占比在摘要中被错误转写，且行动建议缺少来源范围。建议退回并重新生成，不应在正式报告中原地修改。" : "当前仅有担保方式未知值的披露警告；其他必需事实与固定证据一致。"; commit(); }, 1300);
      return;
    }
    if (action === "create-verification-issues") {
      const report = readingReport();
      const blocking = report.verification.results.filter((item) => item.status === "fail" || item.status === "unverifiable");
      blocking.forEach((item) => {
        if (!report.issues.some((issue) => issue.sourceId === item.id && issue.status !== "已解决")) report.issues.push({ id: makeId("RI"), sourceId: item.id, anchor: item.anchor, title: item.name, status: "待处理", createdAt: nowText() });
      });
      commit();
      toast("复核问题已创建", `${blocking.length} 项问题已关联核验结果和报告位置。`, "success");
      return;
    }
    if (action === "create-comparison-issue") {
      const report = readingReport();
      report.issues.push({ id: makeId("RI"), sourceId: report.comparison.recordId, anchor: "metric-balance", title: "报告快照与当前数据差异", status: "待处理", createdAt: nowText() });
      commit(); toast("复核问题已创建", "原报告和比较记录均保持不变。", "success"); return;
    }
    if (action === "open-return") { state.ui.modal = { type: "return" }; return commit(); }
    if (action === "submit-return") {
      if (!state.report.issues.length) state.report.issues.push({ id: makeId("RI"), sourceId: "manual-review", anchor: state.assistant.selectedAnchor, title: "人工复核退回", status: "待处理", createdAt: nowText() });
      state.report.stage = "returned"; state.report.returnedAt = nowText(); state.ui.modal = null;
      commit(); toast("草稿已退回", "原草稿与核验结果已保留，可重新生成新版本。", "success"); return;
    }
    if (action === "regenerate-report") { navigate("/reports/generate"); return beginGeneration("standard", true); }
    if (action === "confirm-draft") {
      if (!canConfirmDraft()) {
        state.assistant.tab = "verification";
        commit();
        return toast("当前不能确认草稿", "需先完成确定性核验，并处理失败或无法核验的必需项。", "danger");
      }
      state.report.stage = "confirmed"; state.report.confirmedAt = nowText();
      commit(); toast("草稿已确认", "确认只作用于当前内容版本，尚未发布正式报告。", "success"); return;
    }
    if (action === "cancel-confirmation") { state.report.stage = "draft"; state.report.confirmedAt = null; commit(); toast("已取消确认", "草稿内容与核验记录保持不变。", "success"); return; }
    if (action === "open-publish") { state.ui.modal = { type: "publish" }; return commit(); }
    if (action === "submit-publish") {
      state.report.stage = "publishing"; state.report.progress = 24; state.report.publicationId = makeId("PUB"); state.ui.modal = null;
      navigate("/reports/generate"); commit();
      schedule(() => { state.report.progress = 62; commit(); }, 650);
      schedule(() => { state.report.progress = 88; commit(); }, 1200);
      schedule(() => { state.report.stage = "published"; state.report.progress = 100; state.report.reportNo = state.report.reportNo || makeId("RPT"); state.report.contentVersion = state.report.replacedReportNo ? "2.0" : "1.0"; state.report.publishedAt = nowText(); state.report.issues = state.report.issues.map((issue) => ({ ...issue, status: "已解决" })); storePublishedReport(); state.ui.viewingReportNo = state.report.reportNo; commit(); toast("正式报告已发布", "HTML 阅读版与 PDF 固定版已进入报告产物库。", "success"); }, 1900);
      return;
    }
    if (action === "open-pdf") return navigate("/reports/pdf");
    if (action === "print-report") { window.print(); return; }
    if (action === "request-regeneration") { state.ui.modal = { type: "regenerate" }; return commit(); }
    if (action === "start-regeneration-from-published") {
      state.ui.modal = null;
      const oldReportNo = readingReport().reportNo;
      state.regenerationRequest = { id: makeId("RGEN"), sourceReportNo: oldReportNo, createdAt: nowText(), status: "未开始" };
      state.ui.viewingReportNo = null;
      commit(); navigate("/reports/generate"); toast("新生成请求已创建", `原报告 ${oldReportNo} 保持冻结。`, "success"); return;
    }
    if (action === "start-pending-regeneration") {
      const pending = state.regenerationRequest;
      if (!pending) return;
      const fresh = newState().report;
      state.report = { ...fresh, stage: "idle", definitionId: "RD-FIN-001", replacedReportNo: pending.sourceReportNo };
      state.assistant = newState().assistant;
      state.regenerationRequest = null;
      state.ui.viewingReportNo = null;
      return beginGeneration("standard", false, pending.id);
    }
    if (action === "start-current-comparison") {
      state.assistant.tab = "verification";
      const report = readingReport();
      report.comparison = { status: "running", recordId: makeId("CMP"), comparedAt: null };
      commit();
      schedule(() => { report.comparison.status = "completed"; report.comparison.comparedAt = nowText(); commit(); }, 1300);
      return;
    }
    if (action === "close-comparison") { readingReport().comparison.status = "idle"; return commit(); }
  }

  document.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element) return;
    event.preventDefault();
    handleAction(element);
  });

  document.addEventListener("change", (event) => {
    const element = event.target.closest("[data-change]");
    if (!element) return;
    const type = element.dataset.change;
    if (type === "scope-id") { state.dashboard.scopeId = element.value; commit(); }
    else if (type === "generation-mode") { state.report.generationMode = element.value; commit(); }
    else if (type === "action-unit") { state.ui.actionUnit = element.value; commit(); }
  });

  document.addEventListener("input", (event) => {
    const element = event.target.closest("[data-input]");
    if (!element) return;
    const type = element.dataset.input;
    if (type === "qa-draft") state.assistant.qaDraft = element.value;
    else if (type === "definition-name") state.ui.tempDefinitionName = element.value;
    else if (type === "definition-purpose") state.ui.tempDefinitionPurpose = element.value;
    saveState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.ui.modal) { state.ui.modal = null; commit(); }
      else if (state.ui.drawer) { state.ui.drawer = null; commit(); }
      else if (state.navOpen) { state.navOpen = false; commit(); }
    }
    if (event.key === "Enter" && event.target.matches('[data-input="qa-draft"]')) {
      event.preventDefault();
      handleAction({ dataset: { action: "ask-report" } });
    }
  });

  window.addEventListener("hashchange", renderApp);
  if (!window.location.hash) window.location.hash = "/dashboard/s001";
  else renderApp();
})();
