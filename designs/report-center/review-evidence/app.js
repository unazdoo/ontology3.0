(function () {
  "use strict";

  const DATA = window.RC_EVIDENCE_DATA;
  const STORAGE_KEY = "ontology3.report-center.review-evidence.v1";
  const app = document.getElementById("app");
  const toastRoot = document.getElementById("toast-root");
  const timers = new Set();

  function freshState() {
    return {
      version: 1,
      nonce: Date.now(),
      navOpen: false,
      catalog: { query: "", status: "全部状态", scene: "全部场景", mode: "cards" },
      wizard: {
        step: 1,
        typeId: "RD-FIN-001",
        scope: "集团",
        subject: "集团",
        selectedResources: DATA.semanticResources.map((item) => item.id),
        contextId: "ctx-current",
        contextValidated: false,
        contextValidation: "idle",
        acknowledgeStale: false,
        includeRestrictedAttachment: false,
        baseReportNo: null
      },
      generation: {
        status: "idle",
        progress: 0,
        phase: "未开始",
        attempt: 0,
        requestId: null,
        evidencePackId: null,
        agentRunId: null,
        error: null,
        startedAt: null,
        targetRevision: 1
      },
      draft: null,
      draftHistory: [],
      published: [],
      selectedReportNo: null,
      selectedAnchor: "a-summary-01",
      selectedSection: "sec-summary",
      leftTab: "locations",
      rightTab: "evidence",
      bottomTab: "semantic",
      selectedCheckId: null,
      verificationFilter: "all",
      assistant: { status: "idle", question: "", messages: [], sessionId: null, runId: null, resultId: null },
      explanation: { status: "idle", checkId: null, runId: null, text: null },
      publishRun: { status: "idle", progress: 0, attempt: 0, runId: null, error: null },
      exportTasks: [],
      snapshotComparison: { status: "idle", recordId: null, comparedAt: null },
      historyResolution: {},
      ui: { modal: null, drawer: null }
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!parsed || parsed.version !== 1) return freshState();
      const defaults = freshState();
      return {
        ...defaults,
        ...parsed,
        catalog: { ...defaults.catalog, ...(parsed.catalog || {}) },
        wizard: { ...defaults.wizard, ...(parsed.wizard || {}) },
        generation: { ...defaults.generation, ...(parsed.generation || {}) },
        assistant: { ...defaults.assistant, ...(parsed.assistant || {}) },
        explanation: { ...defaults.explanation, ...(parsed.explanation || {}) },
        publishRun: { ...defaults.publishRun, ...(parsed.publishRun || {}) },
        snapshotComparison: { ...defaults.snapshotComparison, ...(parsed.snapshotComparison || {}) },
        ui: { ...defaults.ui, ...(parsed.ui || {}) },
        published: Array.isArray(parsed.published) ? parsed.published : [],
        draftHistory: Array.isArray(parsed.draftHistory) ? parsed.draftHistory : [],
        exportTasks: Array.isArray(parsed.exportTasks) ? parsed.exportTasks : [],
        historyResolution: parsed.historyResolution || {}
      };
    } catch (error) {
      return freshState();
    }
  }

  let state = loadState();

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function commit() { save(); renderApp(); }
  function esc(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
  function icon(name, cls = "") { return `<span class="icon ${cls}" aria-hidden="true"><i data-lucide="${name}"></i></span>`; }
  function nowText() { return new Intl.DateTimeFormat("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(new Date()).replaceAll("/", "-"); }
  function stamp() { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; }
  function makeId(prefix) { return `${prefix}-${stamp()}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function schedule(fn, delay) { const nonce = state.nonce; const timer = window.setTimeout(() => { timers.delete(timer); if (state.nonce === nonce) fn(); }, delay); timers.add(timer); }
  function clearTimers() { timers.forEach((timer) => window.clearTimeout(timer)); timers.clear(); }

  function toast(title, detail = "", tone = "") {
    const node = document.createElement("div");
    node.className = `toast ${tone}`.trim();
    node.innerHTML = `${icon(tone === "danger" ? "circle-alert" : tone === "success" ? "circle-check" : "info")}<div><strong>${esc(title)}</strong>${detail ? `<span>${esc(detail)}</span>` : ""}</div>`;
    toastRoot.appendChild(node);
    refreshIcons();
    window.setTimeout(() => node.remove(), 4200);
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }

  function route() {
    const raw = (window.location.hash || "#/catalog").replace(/^#/, "");
    const [path] = raw.split("?");
    return path || "/catalog";
  }

  function navigate(path) {
    state.navOpen = false;
    save();
    if (window.location.hash === `#${path}`) renderApp();
    else window.location.hash = path;
  }

  function context() { return DATA.dataContexts.find((item) => item.id === state.wizard.contextId) || DATA.dataContexts[0]; }
  function currentReport() {
    if (state.selectedReportNo) return state.published.find((item) => item.reportNo === state.selectedReportNo) || null;
    return state.draft || state.published[0] || null;
  }
  function isPublished(report) { return Boolean(report && report.reportNo); }

  function tone(status) {
    if (["已启用","Published","通过","兼容","可消费","已确认","已发布","成功","已完成","已解决"].includes(status)) return "success";
    if (["处理中","生成中","核验中","发布中","导出中","待复核","待人工检查","有提示","陈旧","警告","资料待补充","已撤回"].includes(status)) return "warning";
    if (["失败","阻断","不可消费","版本不兼容","证据缺失","核验失败"].includes(status)) return "danger";
    if (["无法核验","无法定位","历史资源不可定位"].includes(status)) return "purple";
    return "info";
  }
  function badge(status, explicit) { return `<span class="badge ${explicit || tone(status)}"><span class="dot"></span>${esc(status)}</span>`; }
  function checkStatusLabel(status) { return ({ pass:"通过", warning:"警告", fail:"失败", unverifiable:"无法核验" })[status] || "未开始"; }
  function checkStatusIcon(status) { return icon(({ pass:"check", warning:"triangle-alert", fail:"x", unverifiable:"circle-help" })[status] || "minus", "sm"); }

  function renderShell(content, options = {}) {
    const path = route();
    const active = (prefix) => path.startsWith(prefix) ? "active" : "";
    const reportCount = state.published.length + (state.draft ? 1 : 0);
    return `
      <div class="app-shell ${state.navOpen ? "nav-open" : ""}">
        <aside class="platform-rail" aria-label="平台模块">
          <a class="platform-logo" href="../../ontology3-homepage-review/index.html" aria-label="ontology3.0 平台首页" title="ontology3.0 平台首页">O3</a>
          <a class="rail-button" href="../../ontology3-homepage-review/index.html" aria-label="平台首页" title="平台首页">${icon("house")}</a>
          <a class="rail-button" href="../../data-engineering-prototype-review/review-v3/%E6%96%B9%E6%A1%88B2.html" aria-label="数据工程" title="数据工程">${icon("database")}</a>
          <a class="rail-button" href="../../ontology-management-prototype/index.html" aria-label="本体管理" title="本体管理">${icon("network")}</a>
          <a class="rail-button" href="../../intelligent-query-prototype/智能问数工作台.html" aria-label="智能问数" title="智能问数">${icon("message-square-text")}</a>
          <a class="rail-button" href="../../decision-center-prototype/index.html" aria-label="决策中心" title="决策中心">${icon("list-checks")}</a>
          <a class="rail-button" href="../../agent-application/Agent应用.html" aria-label="Agent 应用" title="Agent 应用">${icon("bot")}</a>
          <span class="rail-button active" title="报告中心">${icon("file-chart-column")}</span>
          <div class="rail-spacer"></div>
          <button class="rail-button" type="button" data-action="open-reset" title="重置状态">${icon("rotate-ccw")}</button>
        </aside>
        <nav class="product-nav" aria-label="报告中心导航">
          <div class="product-head"><span>${icon("file-chart-column", "sm")}</span><div><strong>报告中心</strong><small>正式报告与证据</small></div></div>
          <div class="nav-list">
            <div class="nav-label">报告工作区</div>
            <a class="nav-item ${active("/catalog")}" href="#/catalog">${icon("library", "sm")}<span>报告目录</span><em>${reportCount}</em></a>
            <a class="nav-item ${active("/create")}" href="#/create">${icon("file-plus-2", "sm")}<span>创建报告</span></a>
            <a class="nav-item ${active("/run")}" href="#/run">${icon("activity", "sm")}<span>生成进度</span></a>
            <div class="nav-label">证据与版本</div>
            <a class="nav-item ${active("/evidence")}" href="#/evidence">${icon("scan-search", "sm")}<span>证据核验台</span></a>
            <a class="nav-item ${active("/history")}" href="#/history">${icon("history", "sm")}<span>历史版本</span><em>${state.published.length + state.draftHistory.length}</em></a>
          </div>
          <div class="product-foot"><strong>当前工作区</strong><span>集团财务管理</span><span>报告与证据只读消费权威资源</span></div>
        </nav>
        <section class="workspace">
          <header class="topbar">
            <div class="crumb"><button class="icon-button mobile-toggle" type="button" data-action="toggle-nav">${icon("menu")}</button>${icon("file-chart-column", "sm")}<span>报告中心</span>${icon("chevron-right", "sm")}<strong>${esc(options.crumb || "报告目录")}</strong></div>
            <div class="top-actions"><span class="badge plain">${state.draft ? `草稿 ${state.draft.draftVersion}` : "暂无待复核草稿"}</span><button class="btn ghost" type="button" data-action="open-reset">${icon("rotate-ccw", "sm")}重置状态</button><div class="account"><span class="account-avatar">财</span><div><strong>财务分析员</strong><small>集团财务管理</small></div></div></div>
          </header>
          <main class="main ${options.mainClass || ""}">${content}</main>
        </section>
      </div>
      ${renderOverlay()}
    `;
  }

  function allCatalogItems() {
    const items = [];
    if (state.draft) items.push({ kind:"draft", id:state.draft.draftId, title:"集团融资经营分析报告", scene:"S001", status:state.draft.status, version:state.draft.draftVersion, updated:state.draft.generatedAt, semantic:state.draft.semanticVersion, data:state.draft.dataVersion, report:state.draft });
    state.published.forEach((report) => items.push({ kind:"published", id:report.reportNo, title:"集团融资经营分析报告", scene:"S001", status:report.withdrawnAt ? "已撤回" : "已发布", version:report.contentVersion, updated:report.publishedAt, semantic:report.semanticVersion, data:report.dataVersion, report }));
    return items;
  }

  function filteredItems() {
    const query = state.catalog.query.trim().toLowerCase();
    return allCatalogItems().filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.id} ${item.scene}`.toLowerCase().includes(query);
      const matchesStatus = state.catalog.status === "全部状态" || item.status === state.catalog.status;
      const matchesScene = state.catalog.scene === "全部场景" || item.scene === state.catalog.scene;
      return matchesQuery && matchesStatus && matchesScene;
    });
  }

  function renderCatalogItem(item, listMode) {
    const open = item.kind === "draft" ? "open-draft" : "open-published";
    if (listMode) return `<article class="report-row"><div><strong>${esc(item.title)}</strong><small>${esc(item.id)} · ${esc(item.scene)}</small></div><div><small>内容版本</small><strong>${esc(item.version)}</strong></div><div><small>语义 / 数据</small><strong>${esc(item.semantic)} / ${esc(item.data)}</strong></div><div><small>更新时间</small><strong>${esc(item.updated)}</strong></div><div class="button-row">${badge(item.status)}<button class="btn" type="button" data-action="${open}" data-id="${esc(item.id)}">查看详情</button></div></article>`;
    return `<article class="report-card"><div><div class="status-row"><span class="badge plain">${esc(item.scene)}</span>${badge(item.status)}</div><h2>${esc(item.title)}</h2></div><div class="meta-grid"><div class="mini-fact"><span>报告 / 草稿</span><strong>${esc(item.id)}</strong></div><div class="mini-fact"><span>内容版本</span><strong>${esc(item.version)}</strong></div><div class="mini-fact"><span>Published 语义</span><strong>${esc(item.semantic)}</strong></div><div class="mini-fact"><span>数据版本</span><strong>${esc(item.data)}</strong></div></div><div class="button-row"><button class="btn primary" type="button" data-action="${open}" data-id="${esc(item.id)}">${icon("arrow-right", "sm")}查看详情</button></div></article>`;
  }

  function renderCatalog() {
    const items = filteredItems();
    const total = allCatalogItems();
    const publishedCount = state.published.filter((item) => !item.withdrawnAt).length;
    const unresolved = state.draft?.verification?.results?.filter((item) => ["fail","unverifiable"].includes(item.status)).length || 0;
    return renderShell(`<div class="page" data-screen-label="报告目录">
      <div class="page-header"><div><h1>报告目录</h1><p>管理草稿、正式报告及其固定证据版本。</p></div><div class="header-actions"><button class="btn" type="button" data-action="open-definitions">${icon("file-cog", "sm")}报告定义</button><button class="btn primary" type="button" data-action="start-create">${icon("file-plus-2", "sm")}创建报告</button></div></div>
      <div class="catalog-summary"><div class="summary-card"><span>目录内报告</span><strong>${total.length}</strong><small>草稿与正式产物分开</small></div><div class="summary-card"><span>正式报告</span><strong>${publishedCount}</strong><small>HTML 与 PDF 同一内容版本</small></div><div class="summary-card"><span>待复核草稿</span><strong>${state.draft ? 1 : 0}</strong><small>${state.draft ? state.draft.draftVersion : "当前为空"}</small></div><div class="summary-card"><span>阻断核验项</span><strong>${unresolved}</strong><small>确定性核验结果</small></div></div>
      <div class="catalog-toolbar"><div class="search-box">${icon("search", "sm")}<input class="input" data-input="catalog-query" value="${esc(state.catalog.query)}" placeholder="搜索报告名称、编号或场景"></div><select class="select" data-change="catalog-status"><option>全部状态</option><option ${state.catalog.status === "待复核" ? "selected" : ""}>待复核</option><option ${state.catalog.status === "已确认" ? "selected" : ""}>已确认</option><option ${state.catalog.status === "已发布" ? "selected" : ""}>已发布</option><option ${state.catalog.status === "已撤回" ? "selected" : ""}>已撤回</option></select><select class="select" data-change="catalog-scene"><option>全部场景</option><option ${state.catalog.scene === "S001" ? "selected" : ""}>S001</option><option ${state.catalog.scene === "S004" ? "selected" : ""}>S004</option></select><div class="segmented"><button class="${state.catalog.mode === "cards" ? "active" : ""}" type="button" data-action="set-catalog-mode" data-mode="cards">${icon("layout-grid", "sm")}卡片</button><button class="${state.catalog.mode === "list" ? "active" : ""}" type="button" data-action="set-catalog-mode" data-mode="list">${icon("list", "sm")}列表</button></div></div>
      ${items.length ? `<div class="${state.catalog.mode === "cards" ? "report-grid" : "report-list"}">${items.map((item) => renderCatalogItem(item, state.catalog.mode === "list")).join("")}</div>` : `<section class="panel"><div class="empty"><div><div class="empty-icon">${icon("file-search")}</div><h2>${total.length ? "没有符合条件的报告" : "尚无报告产物"}</h2><p>${total.length ? "调整搜索或筛选条件后重新查看。" : "选择报告类型和正式数据上下文，生成第一份可复核草稿。"}</p><button class="btn primary" type="button" data-action="start-create">${icon("file-plus-2", "sm")}创建报告</button></div></div></section>`}
    </div>`, { crumb:"报告目录" });
  }

  function wizardStepClass(step) { return state.wizard.step === step ? "active" : state.wizard.step > step ? "done" : ""; }
  function renderWizardSteps() {
    const labels = [["报告类型","选择获准定义"],["业务范围","确定适用对象"],["语义证据","只读选择 Published"],["数据上下文","验证正式组合"],["生成设置","固定证据范围"],["确认生成","提交生成请求"]];
    return `<div class="wizard-steps">${labels.map((item,index) => `<div class="wizard-step ${wizardStepClass(index+1)}"><span class="step-no">${state.wizard.step > index+1 ? icon("check", "sm") : index+1}</span><div><strong>${item[0]}</strong><small>${item[1]}</small></div></div>`).join("")}</div>`;
  }

  function renderWizardBody() {
    const w = state.wizard;
    const selectedContext = context();
    if (w.step === 1) return `<div class="wizard-content"><h2>选择报告类型</h2><p>报告定义约束业务目的、适用对象、证据范围、复核与发布规则。</p><div class="choice-grid">${DATA.reportTypes.map((type) => `<label class="choice ${w.typeId === type.id ? "active" : ""}"><input type="radio" name="type" value="${type.id}" data-change="wizard-type" ${w.typeId === type.id ? "checked" : ""} ${type.status !== "已启用" ? "disabled" : ""}><div><div class="status-row"><span class="badge plain">${type.scene}</span>${badge(type.status)}</div><h3>${type.name}</h3><p>${type.purpose}</p><div class="context-facts"><span>定义 <strong>${type.id} · ${type.version}</strong></span><span>模板 <strong>${type.template}</strong></span></div></div></label>`).join("")}</div></div>`;
    if (w.step === 2) return `<div class="wizard-content"><h2>确定业务范围</h2><p>融资报告按报告定义允许的范围生成，业务对象只读引用 Published 语义。</p><div class="two-col"><section class="panel"><div class="panel-head"><div><div class="panel-title">适用范围</div><p>单一正式报告主体</p></div></div><div class="panel-body stack"><div class="form-field"><label>分析层级</label><select class="select" data-change="wizard-scope"><option ${w.scope === "集团" ? "selected" : ""}>集团</option><option ${w.scope === "板块" ? "selected" : ""}>板块</option><option ${w.scope === "单位" ? "selected" : ""}>单位</option></select></div><div class="form-field"><label>业务主体</label><select class="select" data-change="wizard-subject">${w.scope === "集团" ? `<option selected>集团</option>` : w.scope === "板块" ? `<option ${w.subject === "境内新能源" ? "selected" : ""}>境内新能源</option><option ${w.subject === "境外新能源" ? "selected" : ""}>境外新能源</option>` : `<option ${w.subject === "单位553" ? "selected" : ""}>单位553</option><option ${w.subject === "单位465" ? "selected" : ""}>单位465</option><option ${w.subject === "单位561" ? "selected" : ""}>单位561</option>`}</select></div><div class="notice">${icon("lock-keyhole")}<div><strong>对象定义不可在此修改</strong><span>报告中心和 Agent 只读引用 Object、Property、Link、Metric、Rule；如需调整定义，请在本体管理完成发布后重新选择。</span></div></div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">报告范围预览</div><p>由报告定义 1.0.0 约束</p></div></div><div class="panel-body stack"><div class="confirm-card"><span>场景</span><strong>S001 集团融资成本与债务结构优化</strong></div><div class="confirm-card"><span>章节</span><strong>6 个章节 · 31 个预期证据锚点</strong></div><div class="confirm-card"><span>正式格式</span><strong>系统内 HTML / PDF 固定版</strong></div></div></section></div></div>`;
    if (w.step === 3) return `<div class="wizard-content"><h2>选择获准 Published 语义资源</h2><p>资源来自报告定义允许范围。报告中心只能读取与引用，不能创建、修改或重新解释权威语义。</p><section class="panel"><div class="panel-head"><div><div class="panel-title">已获准资源</div><p>${w.selectedResources.length} 项 · 按稳定标识和精确版本绑定</p></div>${badge("只读引用", "info")}</div><div class="panel-body flush"><div style="overflow:auto"><table class="resource-table"><thead><tr><th></th><th>资源类型</th><th>名称</th><th>稳定标识</th><th>Published 版本</th><th>有效期</th><th>Owner</th></tr></thead><tbody>${DATA.semanticResources.map((item) => `<tr class="selected"><td>${icon("check", "sm")}</td><td>${item.type}</td><td><strong>${item.name}</strong></td><td class="mono">${item.id}</td><td>${badge(`${item.status} ${item.version}`, "success")}</td><td>${item.effective}</td><td>${item.owner}</td></tr>`).join("")}</tbody></table></div></div></section><div class="notice" style="margin-top:12px">${icon("shield-check")}<div><strong>Published 消费约束</strong><span>后续证据包记录生成时精确版本，不按名称匹配，也不以当前 Published 代替历史版本。</span></div></div></div>`;
    if (w.step === 4) return `<div class="wizard-content"><h2>选择正式数据上下文</h2><p>权威组合由本体管理维护；报告中心只读消费。数据工程仅提供版本、时点、质量、新鲜度、消费就绪与可复现性事实。</p><div class="context-cards">${DATA.dataContexts.map((item) => `<label class="context-card ${w.contextId === item.id ? "active" : ""}"><input type="radio" name="context" value="${item.id}" data-change="wizard-context" ${w.contextId === item.id ? "checked" : ""}><div><h3>${item.label}</h3><p>${item.note}</p><div class="context-facts"><span>语义 <strong>${item.semanticVersion}</strong></span><span>数据 <strong>${item.dataVersion}</strong></span><span>截至 <strong>${item.asOf}</strong></span><span>质量 <strong>${item.quality}</strong></span><span>新鲜度 <strong>${item.freshness}</strong></span></div></div><div class="stack" style="justify-items:end;gap:5px">${badge(item.readiness)}${badge(item.compatibility)}</div></label>`).join("")}</div><div class="button-row" style="margin-top:12px"><button class="btn ${w.contextValidation === "success" ? "success" : "soft"}" type="button" data-action="validate-context">${icon(w.contextValidation === "running" ? "loader-circle" : "shield-check", "sm")}${w.contextValidation === "running" ? "正在验证" : w.contextValidation === "success" ? "兼容性已验证" : "验证兼容性"}</button>${w.contextValidation === "failed" ? badge(selectedContext.compatibility) : ""}</div>${selectedContext.freshness === "陈旧" ? `<label class="review-check" style="margin-top:10px"><input type="checkbox" data-change="acknowledge-stale" ${w.acknowledgeStale ? "checked" : ""}><div><strong>确认使用陈旧快照</strong><span>正式报告将披露原数据截至时间与陈旧状态，不与当前数据静默混用。</span></div></label>` : ""}</div>`;
    if (w.step === 5) return `<div class="wizard-content"><h2>固定生成范围</h2><p>数值、日期、比例与 Rule 结论必须在生成阶段形成结构化证据绑定。</p><div class="two-col"><section class="panel"><div class="panel-head"><div><div class="panel-title">证据范围</div><p>来自报告定义与当前权限</p></div></div><div class="panel-body checklist"><div class="check-row">${icon("check", "sm")}<div><strong>集团融资指标结果</strong><span>${selectedContext.metricResultVersion}</span></div>${badge("必需")}</div><div class="check-row">${icon("check", "sm")}<div><strong>R01 / R02 / R03 命中结果</strong><span>${selectedContext.ruleResultVersion}</span></div>${badge("必需")}</div><div class="check-row">${icon("check", "sm")}<div><strong>数据可信度披露</strong><span>版本、截至时间、质量、新鲜度、消费就绪</span></div>${badge("必需")}</div><label class="check-row"><input type="checkbox" data-change="include-attachment" ${w.includeRestrictedAttachment ? "checked" : ""}><div><strong>机构授信附件 A-17</strong><span>当前权限尚未验证；选择后会在证据固定阶段检查。</span></div>${badge("可选", "plain")}</label></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">生成与核验职责</div><p>三类运行状态严格分开</p></div></div><div class="panel-body owner-list"><div class="owner-row"><strong>报告生成</strong><span>Agent 应用拥有生成 Run；报告中心拥有生成请求、证据包和草稿复核副本。</span></div><div class="owner-row"><strong>确定性核验</strong><span>报告中心独立执行 T049 四态检查，不由 LLM 替代。</span></div><div class="owner-row"><strong>差异解释</strong><span>Agent 应用拥有解释 Run；结果只解释差异，不改变核验状态。</span></div></div></section></div></div>`;
    return `<div class="wizard-content"><h2>确认并生成</h2><p>提交后先固定证据包，再发起独立的 Agent 报告生成运行。</p><div class="confirm-grid"><div class="confirm-card"><span>报告定义</span><strong>RD-FIN-001 · 1.0.0</strong></div><div class="confirm-card"><span>适用主体</span><strong>${esc(w.scope)} · ${esc(w.subject)}</strong></div><div class="confirm-card"><span>Published 语义</span><strong>${selectedContext.semanticVersion}</strong></div><div class="confirm-card"><span>数据版本 / 截至</span><strong>${selectedContext.dataVersion} · ${selectedContext.asOf}</strong></div><div class="confirm-card"><span>指标 / Rule 结果</span><strong>${selectedContext.metricResultVersion} / ${selectedContext.ruleResultVersion}</strong></div><div class="confirm-card"><span>证据范围</span><strong>必需证据${w.includeRestrictedAttachment ? " + 机构授信附件 A-17" : ""}</strong></div></div><div class="notice warning" style="margin-top:12px">${icon("lock-keyhole")}<div><strong>提交不会改变权威资源</strong><span>报告发布不会切换本体版本、修改正式数据绑定或回写 Agent 配置。生成后的草稿仍需确定性核验和人工确认。</span></div></div></div>`;
  }

  function canNextWizard() {
    const w = state.wizard;
    if (w.step === 4) {
      const ctx = context();
      if (w.contextValidation !== "success") return false;
      if (ctx.freshness === "陈旧" && !w.acknowledgeStale) return false;
    }
    return true;
  }

  function renderCreate() {
    return renderShell(`<div class="page" data-screen-label="创建报告"><div class="page-header"><div><h1>${state.wizard.baseReportNo ? "生成新内容版本" : "创建报告"}</h1><p>${state.wizard.baseReportNo ? `原正式报告 ${esc(state.wizard.baseReportNo)} 保持冻结。` : "按报告定义固定语义与数据上下文。"}</p></div><div class="header-actions"><button class="btn" type="button" data-action="cancel-create">取消</button></div></div><section class="wizard-shell">${renderWizardSteps()}<div class="wizard-body">${renderWizardBody()}</div><footer class="wizard-foot"><div class="help">第 ${state.wizard.step} / 6 步</div><div class="button-row">${state.wizard.step > 1 ? `<button class="btn" type="button" data-action="wizard-prev">${icon("arrow-left", "sm")}上一步</button>` : ""}${state.wizard.step < 6 ? `<button class="btn primary" type="button" data-action="wizard-next" ${canNextWizard() ? "" : "disabled"}>下一步${icon("arrow-right", "sm")}</button>` : `<button class="btn primary" type="button" data-action="submit-generation">${icon("wand-sparkles", "sm")}提交并生成</button>`}</div></footer></section></div>`, { crumb: state.wizard.baseReportNo ? "生成新内容版本" : "创建报告" });
  }

  function generationStepState(number) {
    const p = state.generation.progress;
    const thresholds = [8,32,56,86,100];
    if (state.generation.status === "failed" && number === (state.generation.error?.type === "evidence" ? 2 : 4)) return "error";
    if (p >= thresholds[number-1]) return "done";
    if (p >= (thresholds[number-2] || 0)) return "active";
    return "";
  }

  function renderRun() {
    const g = state.generation;
    if (g.status === "idle" && !state.draft) return renderShell(`<div class="page"><div class="page-header"><div><h1>生成进度</h1><p>这里展示证据固定和报告生成的当前运行。</p></div></div><section class="panel"><div class="empty"><div><div class="empty-icon">${icon("activity")}</div><h2>暂无运行</h2><p>创建报告后，运行状态和失败恢复会显示在这里。</p><button class="btn primary" type="button" data-action="start-create">创建报告</button></div></div></section></div>`, { crumb:"生成进度" });
    const failed = g.status === "failed";
    const completed = g.status === "completed";
    return renderShell(`<div class="page" data-screen-label="生成进度"><div class="page-header"><div><h1>报告生成</h1><p>生成请求、证据包与 Agent Run 分别记录。</p></div><div class="header-actions">${completed ? `<button class="btn primary" type="button" data-action="open-draft">打开草稿</button>` : ""}</div></div><div class="run-view"><section class="run-card"><div class="run-head"><div><div class="status-row">${badge(failed ? "失败" : completed ? "已完成" : "处理中")}</div><h2>${failed ? esc(g.error.title) : completed ? "草稿已返回报告中心" : esc(g.phase)}</h2><p>${failed ? esc(g.error.detail) : completed ? `草稿 ${state.draft?.draftVersion || ""} 等待确定性核验与人工复核。` : "请保持页面打开；离开后仍可从生成进度继续查看。"}</p></div><span class="mono">${esc(g.requestId || "")}</span></div><div class="progress-track"><div class="progress-bar" style="width:${g.progress}%"></div></div><div class="inline"><strong>${g.progress}%</strong><span class="help">${esc(g.phase)}</span></div>${failed ? `<div class="notice danger" style="margin-top:14px">${icon("circle-alert")}<div><strong>${esc(g.error.title)}</strong><span>${esc(g.error.recovery)}</span></div></div><div class="button-row" style="margin-top:12px"><button class="btn primary" type="button" data-action="retry-generation">${icon("refresh-cw", "sm")}${g.error.type === "evidence" ? "移除受限附件并重试" : "重试生成"}</button><button class="btn" type="button" data-action="open-run-detail">查看详情</button></div>` : ""}<div class="run-steps"><div class="run-step ${generationStepState(1)}"><span class="run-node">${icon("file-input", "sm")}</span><div><strong>接收生成请求</strong><small>报告中心 · ${esc(g.requestId || "等待创建")}</small></div><time>${esc(g.startedAt || "")}</time></div><div class="run-step ${generationStepState(2)}"><span class="run-node">${icon("package-check", "sm")}</span><div><strong>固定生成证据包</strong><small>报告中心 · ${esc(g.evidencePackId || "等待固定")}</small></div><time></time></div><div class="run-step ${generationStepState(3)}"><span class="run-node">${icon("shield-check", "sm")}</span><div><strong>验证精确版本与可复现性</strong><small>本体语义只读引用 · 数据可信度只读引用</small></div><time></time></div><div class="run-step ${generationStepState(4)}"><span class="run-node">${icon("bot", "sm")}</span><div><strong>生成报告内容</strong><small>Agent 应用 Run · ${esc(g.agentRunId || "等待发起")}</small></div><time></time></div><div class="run-step ${generationStepState(5)}"><span class="run-node">${icon("file-check-2", "sm")}</span><div><strong>形成草稿复核副本</strong><small>报告中心 · 不自动确认或发布</small></div><time></time></div></div></section><aside class="panel"><div class="panel-head"><div><div class="panel-title">资源与 Owner</div><p>运行状态不在模块间复制</p></div></div><div class="panel-body owner-list"><div class="owner-row"><strong>报告中心</strong><span>生成请求、证据包、草稿复核副本、人工复核与正式产物。</span></div><div class="owner-row"><strong>Agent 应用</strong><span>Agent 配置、Skill、工具权限、生成 Run 与不可变源草稿。</span></div><div class="owner-row"><strong>本体管理</strong><span>Published Object、Property、Link、Metric、Rule 及历史语义解析。</span></div><div class="owner-row"><strong>数据工程</strong><span>精确数据版本、截至时间、质量、新鲜度、就绪与可复现性事实。</span></div></div></aside></div></div>`, { crumb:"生成进度" });
  }

  function anchorStatus(report, id) {
    const issue = report?.verification?.results?.find((item) => item.anchor === id && ["fail","unverifiable"].includes(item.status));
    return issue ? "issue" : "";
  }

  function anchorClasses(report, id) {
    return `report-anchor ${state.selectedAnchor === id ? "selected" : ""} ${anchorStatus(report, id)}`.trim();
  }

  function anchorMarker(id) {
    return `<button class="anchor-marker" type="button" data-action="select-anchor" data-anchor="${id}" title="查看证据">${icon("link-2", "sm")}</button>`;
  }

  function reportDocument(report) {
    const clean = report.revision > 1 || isPublished(report);
    const titleId = report.reportNo || report.draftId;
    const contentVersion = report.contentVersion || report.draftVersion;
    return `<article class="report-paper" data-screen-label="报告正文">
      <header class="report-cover"><div class="eyebrow">S001 · 集团财务管理</div><h1>集团融资经营分析报告</h1><p>融资成本、债务结构与重点单位 Rule 发现</p><div class="report-meta"><div><span>${isPublished(report) ? "报告编号" : "草稿标识"}</span><strong>${esc(titleId)}</strong></div><div><span>内容版本</span><strong>${esc(contentVersion)}</strong></div><div><span>Published 语义</span><strong>${esc(report.semanticVersion)}</strong></div><div><span>数据版本</span><strong>${esc(report.dataVersion)}</strong></div><div><span>数据截至</span><strong>${esc(report.asOf)}</strong></div><div><span>证据包</span><strong>${esc(report.evidencePackId)}</strong></div></div></header>
      <section class="report-section" id="sec-summary"><h2>01 经营概览</h2><p class="${anchorClasses(report,"a-summary-01")}" data-clickable="true" data-action="select-anchor" data-anchor="a-summary-01">${anchorMarker("a-summary-01")}截至 ${esc(report.asOf)}，集团融资余额为 <strong>21,613.387 亿元</strong>，余额加权融资成本为 <strong>2.372231%</strong>。融资成本较近 12 个月初期下降，但浮动利率余额占比仍处于较高水平。</p><div class="metric-strip"><div class="paper-metric ${anchorClasses(report,"a-balance-value")}" data-clickable="true" data-action="select-anchor" data-anchor="a-balance-value">${anchorMarker("a-balance-value")}<span>融资余额</span><strong>21,613.387</strong><small>亿元 · MET-FIN-001</small></div><div class="paper-metric ${anchorClasses(report,"a-cost-value")}" data-clickable="true" data-action="select-anchor" data-anchor="a-cost-value">${anchorMarker("a-cost-value")}<span>余额加权融资成本</span><strong>2.372231%</strong><small>MET-FIN-008</small></div><div class="paper-metric"><span>浮动利率余额占比</span><strong>95.149492%</strong><small>MET-FIN-010</small></div></div></section>
      <section class="report-section" id="sec-cost"><h2>02 融资成本</h2><p>余额加权融资成本由 2025 年 9 月的 2.46% 下降至本期 2.372231%，近三个月降幅趋缓。趋势仅描述固定证据包内的历史序列，不预测后续利率走势。</p><div class="${anchorClasses(report,"a-cost-chart")}" data-clickable="true" data-action="select-anchor" data-anchor="a-cost-chart">${anchorMarker("a-cost-chart")}<div class="paper-chart" aria-label="最近十二个月融资成本趋势"><span style="height:96%"></span><span style="height:90%"></span><span style="height:75%"></span><span style="height:82%"></span><span style="height:68%"></span><span style="height:60%"></span><span style="height:53%"></span><span style="height:45%"></span><span style="height:43%"></span><span style="height:35%"></span><span style="height:34%"></span><span style="height:28%"></span></div></div><p class="footnote">图 2-1 · 指标 MET-FIN-008 · 单位 % · 最近 12 个完整月 · Published 3.8.1</p></section>
      <section class="report-section" id="sec-structure"><h2>03 债务结构</h2><p>集团融资余额以浮动利率和长期融资为主。未知担保类型保持单列，未并入信用或其他担保分类。</p><table class="paper-table"><thead><tr><th>结构维度</th><th>分类</th><th class="num">余额占比</th><th>证据</th></tr></thead><tbody><tr><td>利率结构</td><td>浮动利率</td><td class="num ${anchorClasses(report,"a-structure-cell")}" data-clickable="true" data-action="select-anchor" data-anchor="a-structure-cell">${anchorMarker("a-structure-cell")}95.149492%</td><td>MET-FIN-010</td></tr><tr><td>期限结构</td><td>短期</td><td class="num">0.911805%</td><td>MET-FIN-012</td></tr><tr><td>币种结构</td><td>外币</td><td class="num">4.224132%</td><td>MET-FIN-014</td></tr><tr><td>担保结构</td><td>未知</td><td class="num">27.436%</td><td>质量提示 Q-18</td></tr></tbody></table></section>
      <section class="report-section" id="sec-units"><h2>04 重点单位与机构</h2><p>单位553、单位465和单位561分别体现高成本、浮动利率暴露和短期债务集中问题。下表使用相同筛选范围和数据截至时间。</p><table class="paper-table"><thead><tr><th>单位</th><th>融资余额（亿元）</th><th>${clean ? "融资成本（%）" : "融资成本（亿元）"}</th><th>主要关注</th></tr></thead><tbody><tr><td>单位553</td><td class="num">393.134</td><td class="num ${anchorClasses(report,"a-unit553-cost")}" data-clickable="true" data-action="select-anchor" data-anchor="a-unit553-cost">${anchorMarker("a-unit553-cost")}2.880984</td><td>高成本融资</td></tr><tr><td>单位465</td><td class="num">770.000</td><td class="num">2.196617</td><td>浮动利率暴露</td></tr><tr><td>单位561</td><td class="num">20.016</td><td class="num">2.228380</td><td>短期债务集中</td></tr></tbody></table></section>
      <section class="report-section" id="sec-rules"><h2>05 Rule 发现</h2><div class="rule-box ${anchorClasses(report,"a-rule-r01")}" data-clickable="true" data-action="select-anchor" data-anchor="a-rule-r01">${anchorMarker("a-rule-r01")}<h4>R01 · 单位553 · 命中</h4><p>高成本融资余额占比为 77.337244%，高于 Published 条件 20%。评估时间 2026-08-09 09:18。</p></div><div class="rule-box ${anchorClasses(report,"a-rule-r02")}" data-clickable="true" data-action="select-anchor" data-anchor="a-rule-r02">${anchorMarker("a-rule-r02")}<h4>R02 · 单位465 · 命中</h4><p>浮动利率余额占比为 100%，高于 Published 条件 ${clean ? "80%" : "85%"}。评估时间 2026-08-09 09:18。</p></div><div class="rule-box"><h4>R03 · 单位561 · 命中</h4><p>短期债务余额占比为 93.545164%，高于 Published 条件 30%。评估时间 2026-08-09 09:18。</p></div></section>
      <section class="report-section" id="sec-limits"><h2>06 证据与限制</h2><p>本报告数值、比例、日期和 Rule 结论均应通过结构化锚点关联生成证据包。数据工程质量记录显示 18 条担保类型为空，因此担保结构中的“未知”分类不可合并。</p><p class="${anchorClasses(report,"a-unbound-note")}" data-clickable="true" data-action="select-anchor" data-anchor="a-unbound-note">${anchorMarker("a-unbound-note")}${clean ? "管理建议属于解释性内容，不作为确定性事实；后续利率窗口需在新的数据与证据上下文中另行判断。" : "建议关注后续利率窗口，并择机优化融资结构。"}</p><div class="footnote">报告生成时快照：Published 语义 ${esc(report.semanticVersion)} · 数据 ${esc(report.dataVersion)} · 截至 ${esc(report.asOf)}。正式发布后不随新数据、新模板或重新渲染原地变化。</div></section>
    </article>`;
  }

  function renderLocationPane(report) {
    if (state.leftTab === "checks") {
      const results = report.verification?.results || [];
      const filtered = results.filter((item) => state.verificationFilter === "all" || item.status === state.verificationFilter);
      return `<div class="pane-body"><div class="location-tabs"><button class="mini-tab ${state.verificationFilter === "all" ? "active" : ""}" type="button" data-action="filter-checks" data-filter="all">全部 ${results.length}</button><button class="mini-tab ${state.verificationFilter === "fail" ? "active" : ""}" type="button" data-action="filter-checks" data-filter="fail">失败</button><button class="mini-tab ${state.verificationFilter === "warning" ? "active" : ""}" type="button" data-action="filter-checks" data-filter="warning">警告</button></div>${results.length ? `<div class="location-list">${filtered.map((item) => `<button class="location-item ${state.selectedCheckId === item.id ? "active" : ""}" type="button" data-action="select-check" data-check="${item.id}"><span class="status-icon ${item.status}">${checkStatusIcon(item.status)}</span><span><strong>${item.name}</strong><small>${item.issue}</small></span>${badge(checkStatusLabel(item.status), tone(checkStatusLabel(item.status)))}</button>`).join("")}</div>` : `<div class="empty" style="min-height:220px;padding:18px"><div><div class="empty-icon">${icon("scan-search")}</div><h2>尚未核验</h2><p>确定性核验运行后，四态结果会定位到报告位置。</p><button class="btn primary" type="button" data-action="start-verification">开始自动核验</button></div></div>`}</div>`;
    }
    return `<div class="pane-body"><div class="location-list">${DATA.reportSections.map((section) => `<div><div class="location-group">${section.number} ${section.name} · ${section.count} 个锚点</div>${DATA.anchors.filter((anchor) => anchor.section === section.id).map((anchor) => `<button class="location-item ${state.selectedAnchor === anchor.id ? "active" : ""}" type="button" data-action="select-anchor" data-anchor="${anchor.id}"><span class="status-icon ${anchorStatus(report,anchor.id) || "idle"}">${icon(anchor.kind === "数值" ? "hash" : anchor.kind === "表格单元格" ? "table-cells-split" : anchor.kind === "Rule 结论" ? "git-branch" : anchor.kind === "图表" ? "chart-no-axes-combined" : "pilcrow", "sm")}</span><span><strong>${anchor.label}</strong><small>${anchor.kind} · ${anchor.evidence.length ? `${anchor.evidence.length} 项证据` : "无结构化绑定"}</small></span>${icon("chevron-right", "sm")}</button>`).join("")}</div>`).join("")}</div></div>`;
  }

  function selectedAnchorData() { return DATA.anchors.find((item) => item.id === state.selectedAnchor) || DATA.anchors[0]; }
  function selectedCheck(report) { return report?.verification?.results?.find((item) => item.id === state.selectedCheckId) || report?.verification?.results?.[0] || null; }

  function renderEvidenceChain(report) {
    const anchor = selectedAnchorData();
    const resources = anchor.evidence.map((id) => DATA.semanticResources.find((item) => item.id === id)).filter(Boolean);
    const metric = Object.values(DATA.metrics).find((item) => anchor.evidence.includes(item.id));
    return `<div class="evidence-detail"><div class="evidence-summary"><div class="status-row">${badge(anchor.kind,"plain")}${anchor.evidence.length ? badge("已绑定") : badge("无结构化证据","purple")}</div><h3>${anchor.label}</h3><p>${anchor.preview}</p></div>${anchor.evidence.length ? `<div class="chain"><div class="chain-node"><span class="node-icon">${icon("map-pin", "sm")}</span><strong>报告内容锚点</strong><span>${anchor.id} · ${anchor.kind}</span><small>Owner：报告中心</small></div><div class="chain-node"><span class="node-icon">${icon("package-check", "sm")}</span><strong>生成证据包固定引用</strong><span>${esc(report.evidencePackId)} · 不可原地修改</span><small>Owner：报告中心</small></div>${resources.map((resource) => `<div class="chain-node"><span class="node-icon">${icon(resource.type === "Rule" ? "git-branch" : resource.type === "Metric" ? "calculator" : resource.type === "Object" ? "box" : "tag", "sm")}</span><strong>${resource.type} · ${resource.name}</strong><span>${resource.id} · Published ${resource.version}</span><small>Owner：本体管理 · 只读引用</small></div>`).join("")}<div class="chain-node"><span class="node-icon">${icon("database", "sm")}</span><strong>数据可信度事实</strong><span>${esc(report.dataVersion)} · 截至 ${esc(report.asOf)}</span><small>Owner：数据工程 · 不直供业务明细</small></div></div>` : `<div class="notice purple">${icon("circle-help")}<div><strong>无法执行确定性核验</strong><span>生成时没有结构化证据绑定。报告助手不会猜测，也不会改用当前定义补齐。</span></div></div>`}${metric ? `<div class="check-detail"><h3>指标语义披露</h3><div class="meta-list"><div class="meta-row"><span>名称</span><strong>${metric.name}</strong></div><div class="meta-row"><span>定义</span><strong>${metric.definition}</strong></div><div class="meta-row"><span>单位</span><strong>${metric.unit}</strong></div><div class="meta-row"><span>适用对象</span><strong>${metric.appliesTo}</strong></div><div class="meta-row"><span>筛选范围</span><strong>${metric.filter}</strong></div><div class="meta-row"><span>时间范围</span><strong>${metric.range}</strong></div><div class="meta-row"><span>有效期</span><strong>${metric.effective}</strong></div><div class="meta-row"><span>Published 版本</span><strong>${metric.version}</strong></div></div></div>` : ""}</div>`;
  }

  function renderAssistant(report) {
    const messages = state.assistant.messages;
    return `<div class="assistant-wrap"><div class="assistant-body"><div class="notice">${icon("lock-keyhole")}<div><strong>默认基于报告固定快照</strong><span>回答引用 ${esc(report.evidencePackId)}。如需当前数据，必须显式执行快照比较。</span></div></div><div class="suggestions" style="margin-top:9px"><button class="suggestion" type="button" data-action="assistant-suggest" data-question="这份报告的融资成本是多少？">融资成本是多少</button><button class="suggestion" type="button" data-action="assistant-suggest" data-question="R02 为什么命中？">R02 为什么命中</button><button class="suggestion" type="button" data-action="assistant-suggest" data-question="预测下个月融资成本">预测下个月</button></div><div class="chat">${messages.map((message) => `<div class="message ${message.role}">${esc(message.text)}${message.meta ? `<small>${esc(message.meta)}</small>` : ""}</div>`).join("")}${state.assistant.status === "running" ? `<div class="message assistant">${icon("loader-circle", "sm")} 正在读取报告证据包并形成解释……</div>` : ""}</div></div><div class="assistant-compose"><div class="compose-row"><textarea class="textarea" data-input="assistant-question" placeholder="询问本报告内容、口径或 Rule 证据">${esc(state.assistant.question)}</textarea><button class="btn primary" type="button" data-action="send-question" ${state.assistant.status === "running" ? "disabled" : ""}>${icon("send", "sm")}发送</button></div></div></div>`;
  }

  function verificationCounts(report) {
    const results = report.verification?.results || [];
    return { pass:results.filter((x)=>x.status==="pass").length, warning:results.filter((x)=>x.status==="warning").length, fail:results.filter((x)=>x.status==="fail").length, unverifiable:results.filter((x)=>x.status==="unverifiable").length };
  }

  function renderVerification(report) {
    const v = report.verification;
    const counts = verificationCounts(report);
    const check = selectedCheck(report);
    if (v.status === "idle") return `<div class="evidence-detail"><div class="notice">${icon("scan-search")}<div><strong>确定性核验尚未运行</strong><span>优先比对结构化绑定，LLM 不参与通过、警告、失败或无法核验的判定。</span></div></div><div class="checklist"><div class="check-row">${icon("circle", "sm")}<div><strong>8 类检查</strong><span>证据、数值、语义、版本、时点、Rule、跨载体、无绑定内容</span></div>${badge("未开始")}</div></div><button class="btn primary full" type="button" data-action="start-verification">${icon("play", "sm")}开始自动核验</button></div>`;
    if (v.status === "running") return `<div class="evidence-detail"><div class="notice">${icon("loader-circle")}<div><strong>确定性核验运行中</strong><span>${esc(v.runId)} · 当前 ${v.progress}%</span></div></div><div class="progress-track"><div class="progress-bar" style="width:${v.progress}%"></div></div><p class="help">核验运行与报告生成 Run、LLM 差异解释 Run 分别记录。</p></div>`;
    if (v.status === "run_failed") return `<div class="evidence-detail"><div class="notice danger">${icon("circle-alert")}<div><strong>核验运行失败</strong><span>证据索引读取超时；没有产生四态业务结论，原草稿和证据绑定未改变。</span></div></div><div class="meta-list"><div class="meta-row"><span>运行</span><strong>${esc(v.runId)}</strong></div><div class="meta-row"><span>责任位置</span><strong>报告中心 · 自动核验运行</strong></div><div class="meta-row"><span>恢复方式</span><strong>重新读取证据索引并重试</strong></div></div><button class="btn primary full" type="button" data-action="retry-verification">${icon("refresh-cw", "sm")}重试自动核验</button></div>`;
    return `<div class="evidence-detail"><div class="bottom-grid"><div class="bottom-card"><span>通过</span><strong>${counts.pass}</strong></div><div class="bottom-card"><span>警告</span><strong>${counts.warning}</strong></div><div class="bottom-card"><span>失败</span><strong>${counts.fail}</strong></div><div class="bottom-card"><span>无法核验</span><strong>${counts.unverifiable}</strong></div></div>${check ? `<div class="check-detail"><div class="status-row">${badge(checkStatusLabel(check.status),tone(checkStatusLabel(check.status)))}<span class="mono">${check.id}</span></div><h3>${check.name}</h3><div class="meta-list"><div class="meta-row"><span>报告位置</span><strong>${DATA.anchors.find((a)=>a.id===check.anchor)?.label || check.anchor}</strong></div><div class="meta-row"><span>问题</span><strong>${check.issue}</strong></div><div class="meta-row"><span>权威证据</span><strong>${check.authority}</strong></div><div class="meta-row"><span>版本</span><strong>语义 ${report.semanticVersion} · 数据 ${report.dataVersion}</strong></div><div class="meta-row"><span>影响</span><strong>${check.impact}</strong></div><div class="meta-row"><span>责任位置</span><strong>${check.owner}</strong></div><div class="meta-row"><span>建议处理</span><strong>${check.action}</strong></div></div></div>${["fail","warning","unverifiable"].includes(check.status) ? `<button class="btn soft full" type="button" data-action="explain-check" data-check="${check.id}" ${state.explanation.status === "running" ? "disabled" : ""}>${icon("bot", "sm")}${state.explanation.status === "running" && state.explanation.checkId === check.id ? "正在解释" : "解释差异"}</button>` : ""}${state.explanation.text && state.explanation.checkId === check.id ? `<div class="notice purple">${icon("bot")}<div><strong>差异解释</strong><span>${esc(state.explanation.text)}</span><span>Agent Run ${esc(state.explanation.runId)} · 只解释，不改变确定性核验状态。</span></div></div>` : ""}` : ""}<div class="button-row">${isPublished(report) ? `<button class="btn" type="button" data-action="locate-history" data-id="${esc(report.reportNo)}">${icon("search-check", "sm")}核验历史定位</button>` : `<button class="btn" type="button" data-action="rerun-verification">${icon("refresh-cw", "sm")}重新核验</button>${counts.fail + counts.unverifiable > 0 ? `<button class="btn primary" type="button" data-action="create-review-issues">形成复核问题</button>` : ""}`}</div></div>`;
  }

  function renderHumanReview(report) {
    const v = report.verification;
    const counts = verificationCounts(report);
    const checks = report.reviewChecks || [];
    const allChecked = checks.length === 3 && checks.every((item) => item.done);
    const blocked = v.status !== "completed" || counts.fail + counts.unverifiable > 0;
    if (isPublished(report)) return `<div class="review-panel"><div class="notice success">${icon("user-check")}<div><strong>人工确认已完成</strong><span>${esc(report.confirmedAt)} · 确认人与自动核验结果分别追溯。</span></div></div>${checks.map((item) => `<div class="review-check">${icon("check", "sm")}<div><strong>${item.label}</strong><span>人工检查已记录</span></div></div>`).join("")}</div>`;
    return `<div class="review-panel"><div class="notice ${blocked ? "warning" : "success"}">${icon(blocked ? "triangle-alert" : "shield-check")}<div><strong>${blocked ? "尚不能人工确认" : "可以开始人工检查"}</strong><span>${blocked ? "必须先完成确定性核验并消除失败、无法核验项。" : `自动核验：通过 ${counts.pass}、警告 ${counts.warning}；人工确认不会覆盖自动结果。`}</span></div></div>${checks.map((item) => `<label class="review-check"><input type="checkbox" data-change="review-check" data-key="${item.key}" ${item.done ? "checked" : ""} ${blocked || report.status === "已确认" ? "disabled" : ""}><div><strong>${item.label}</strong><span>${item.hint}</span></div></label>`).join("")}<div class="form-field"><label>复核意见</label><textarea class="textarea" data-input="review-note" placeholder="记录警告项判断、限制披露与发布意见" ${blocked || report.status === "已确认" ? "disabled" : ""}>${esc(report.reviewNote || "")}</textarea></div><button class="btn primary full" type="button" data-action="confirm-review" ${blocked || !allChecked || report.status === "已确认" ? "disabled" : ""}>${icon("user-check", "sm")}${report.status === "已确认" ? "草稿已确认" : "确认草稿"}</button></div>`;
  }

  function renderRightPane(report) {
    let body = renderEvidenceChain(report);
    if (state.rightTab === "assistant") body = renderAssistant(report);
    if (state.rightTab === "verification") body = renderVerification(report);
    if (state.rightTab === "review") body = renderHumanReview(report);
    return `<section class="pane"><div class="pane-head"><div><h2>报告伴读与核验助手</h2><small>基于报告版本绑定的证据包</small></div></div><div class="pane-body"><div class="assistant-tabs"><button class="mini-tab ${state.rightTab === "evidence" ? "active" : ""}" type="button" data-action="set-right-tab" data-tab="evidence">证据链</button><button class="mini-tab ${state.rightTab === "assistant" ? "active" : ""}" type="button" data-action="set-right-tab" data-tab="assistant">报告问答</button><button class="mini-tab ${state.rightTab === "verification" ? "active" : ""}" type="button" data-action="set-right-tab" data-tab="verification">自动核验</button><button class="mini-tab ${state.rightTab === "review" ? "active" : ""}" type="button" data-action="set-right-tab" data-tab="review">人工检查</button></div>${body}</div></section>`;
  }

  function renderBottom(report) {
    let body = "";
    if (state.bottomTab === "semantic") body = `<div class="bottom-grid"><div class="bottom-card"><span>报告定义</span><strong>RD-FIN-001 · 1.0.0</strong><small>Owner：报告中心</small></div><div class="bottom-card"><span>模板</span><strong>RT-FIN-002 · 2.2.0</strong><small>Owner：报告中心</small></div><div class="bottom-card"><span>Published 本体</span><strong>${report.semanticVersion}</strong><small>Owner：本体管理</small></div><div class="bottom-card"><span>已选锚点</span><strong>${selectedAnchorData().label}</strong><small>${selectedAnchorData().evidence.join(" / ") || "无绑定"}</small></div></div>`;
    if (state.bottomTab === "data") body = `<div class="bottom-grid"><div class="bottom-card"><span>数据版本</span><strong>${report.dataVersion}</strong><small>精确固定，不随刷新变化</small></div><div class="bottom-card"><span>数据截至</span><strong>${report.asOf}</strong><small>新鲜度：${report.freshness || "当前"}</small></div><div class="bottom-card"><span>质量</span><strong>${report.quality || "有提示"}</strong><small>18 条担保类型为空</small></div><div class="bottom-card"><span>可复现性</span><strong>证据定位已固定</strong><small>Owner：数据工程可信度事实</small></div></div>`;
    if (state.bottomTab === "compatibility") body = `<div class="bottom-grid"><div class="bottom-card"><span>权威组合</span><strong>${report.semanticVersion} / ${report.dataVersion}</strong><small>生成时原子绑定</small></div><div class="bottom-card"><span>兼容状态</span><strong>兼容</strong><small>报告中心只读消费</small></div><div class="bottom-card"><span>历史替代规则</span><strong>禁止当前版本替代</strong><small>按稳定标识解析</small></div><div class="bottom-card"><span>发布影响</span><strong>不改变权威绑定</strong><small>产物冻结</small></div></div>`;
    if (state.bottomTab === "history") body = `<div class="history-log"><div class="history-item"><strong>生成证据包</strong><span>${report.evidencePackId}</span><span>${report.generatedAt}</span></div><div class="history-item"><strong>确定性核验</strong><span>${report.verification?.runId || "未运行"}</span><span>${report.verification?.completedAt || ""}</span></div><div class="history-item"><strong>人工确认</strong><span>${report.confirmedAt || "未确认"}</span><span>报告中心</span></div><div class="history-item"><strong>正式发布</strong><span>${report.reportNo || "未发布"}</span><span>${report.publishedAt || ""}</span></div></div>`;
    if (state.bottomTab === "runs") body = `<div class="history-log"><div class="history-item"><strong>报告生成 Run</strong><span>${report.agentRunId}</span><span>Owner：Agent 应用</span></div><div class="history-item"><strong>核验 Run</strong><span>${report.verification?.runId || "未运行"}</span><span>Owner：报告中心</span></div><div class="history-item"><strong>差异解释 Run</strong><span>${state.explanation.runId || "未运行"}</span><span>Owner：Agent 应用</span></div><div class="history-item"><strong>问答 Session</strong><span>${state.assistant.sessionId || "未开始"}</span><span>Owner：Agent 应用</span></div></div>`;
    return `<section class="evidence-bottom"><div class="bottom-tabs"><button class="bottom-tab ${state.bottomTab === "semantic" ? "active" : ""}" type="button" data-action="set-bottom-tab" data-tab="semantic">语义证据</button><button class="bottom-tab ${state.bottomTab === "data" ? "active" : ""}" type="button" data-action="set-bottom-tab" data-tab="data">数据可信度</button><button class="bottom-tab ${state.bottomTab === "compatibility" ? "active" : ""}" type="button" data-action="set-bottom-tab" data-tab="compatibility">版本兼容</button><button class="bottom-tab ${state.bottomTab === "history" ? "active" : ""}" type="button" data-action="set-bottom-tab" data-tab="history">内容追溯</button><button class="bottom-tab ${state.bottomTab === "runs" ? "active" : ""}" type="button" data-action="set-bottom-tab" data-tab="runs">运行记录</button></div><div class="bottom-body">${body}</div></section>`;
  }

  function reportTopActions(report) {
    const counts = verificationCounts(report);
    if (isPublished(report)) return `<button class="btn" type="button" data-action="compare-snapshot">${icon("columns-3", "sm")}与当前数据比较</button><button class="btn" type="button" data-action="export-pdf">${icon("download", "sm")}导出 PDF</button><button class="btn primary" type="button" data-action="new-content-version">${icon("copy-plus", "sm")}生成新内容版本</button>${report.withdrawnAt ? badge("已撤回") : `<button class="btn danger" type="button" data-action="open-withdraw">撤回</button>`}`;
    if (report.status === "已确认") return `<button class="btn" type="button" data-action="set-right-tab" data-tab="review">${icon("user-check", "sm")}查看确认</button><button class="btn primary" type="button" data-action="open-publish">${icon("upload", "sm")}发布报告</button>`;
    if (report.verification?.status !== "completed") return `<button class="btn primary" type="button" data-action="start-verification">${icon("scan-search", "sm")}自动核验</button>`;
    if (counts.fail + counts.unverifiable > 0) return `<button class="btn" type="button" data-action="create-review-issues">${icon("list-plus", "sm")}形成复核问题</button><button class="btn primary" type="button" data-action="request-regenerate">${icon("refresh-cw", "sm")}请求重新生成</button>`;
    return `<button class="btn primary" type="button" data-action="set-right-tab" data-tab="review">${icon("user-check", "sm")}人工检查</button>`;
  }

  function renderEvidence() {
    const report = currentReport();
    if (!report) return renderShell(`<div class="page"><div class="page-header"><div><h1>证据核验台</h1><p>报告内容、锚点与权威证据并列操作。</p></div></div><section class="panel"><div class="empty"><div><div class="empty-icon">${icon("scan-search")}</div><h2>暂无可核验报告</h2><p>先创建报告并完成证据固定与内容生成。</p><button class="btn primary" type="button" data-action="start-create">创建报告</button></div></div></section></div>`, { crumb:"证据核验台" });
    return renderShell(`<div class="evidence-shell" data-screen-label="证据核验台"><header class="evidence-top"><div class="evidence-title"><button class="icon-button" type="button" data-action="back-catalog" title="返回目录">${icon("arrow-left")}</button><div><h1>集团融资经营分析报告</h1><small>${esc(report.reportNo || report.draftId)} · ${esc(report.contentVersion || report.draftVersion)} · 语义 ${esc(report.semanticVersion)} / 数据 ${esc(report.dataVersion)}</small></div>${badge(report.withdrawnAt ? "已撤回" : report.status)}</div><div class="evidence-actions">${reportTopActions(report)}</div></header><div class="evidence-grid"><section class="pane"><div class="pane-head"><div><h2>报告位置与问题</h2><small>选择位置后联动正文与证据</small></div><div class="segmented"><button class="${state.leftTab === "locations" ? "active" : ""}" type="button" data-action="set-left-tab" data-tab="locations">位置</button><button class="${state.leftTab === "checks" ? "active" : ""}" type="button" data-action="set-left-tab" data-tab="checks">问题</button></div></div>${renderLocationPane(report)}</section><section class="pane"><div class="report-toolbar"><div class="inline">${badge(isPublished(report) ? "HTML 冻结版" : "HTML 草稿版",isPublished(report)?"success":"warning")}<span class="help">点击段落、数值、单元格、图表或 Rule 查看最小证据</span></div><button class="btn ghost" type="button" data-action="open-report-info">${icon("info", "sm")}报告信息</button></div><div class="report-scroll">${reportDocument(report)}</div></section>${renderRightPane(report)}</div>${renderBottom(report)}</div>`, { crumb:isPublished(report) ? "正式报告" : "草稿复核", mainClass:"evidence-main" });
  }

  function historyItems() {
    const published = state.published.map((report) => ({ ...report, historyType:"正式报告", historyId:report.reportNo }));
    const drafts = state.draftHistory.map((report) => ({ ...report, historyType:"旧草稿", historyId:report.draftId }));
    return [...published, ...drafts].sort((a,b) => String(b.publishedAt || b.generatedAt).localeCompare(String(a.publishedAt || a.generatedAt)));
  }

  function renderHistory() {
    const items = historyItems();
    return renderShell(`<div class="page" data-screen-label="历史版本"><div class="page-header"><div><h1>历史版本</h1><p>旧正式报告保持生成时内容、Published 语义版本、数据版本和证据链。</p></div></div>${items.length ? `<section class="panel"><div class="panel-body flush"><div class="report-list">${items.map((item) => `<article class="report-row"><div><strong>集团融资经营分析报告</strong><small>${esc(item.historyId)} · ${item.historyType}</small></div><div><small>内容版本</small><strong>${esc(item.contentVersion || item.draftVersion)}</strong></div><div><small>生成时组合</small><strong>${esc(item.semanticVersion)} / ${esc(item.dataVersion)}</strong></div><div><small>状态</small>${badge(item.withdrawnAt ? "已撤回" : item.reportNo ? "已发布" : "已替代草稿")}</div><div class="button-row"><button class="btn" type="button" data-action="open-history-item" data-id="${esc(item.historyId)}">查看详情</button>${item.reportNo ? `<button class="btn soft" type="button" data-action="locate-history" data-id="${esc(item.reportNo)}">${icon("search-check", "sm")}定位历史证据</button>` : ""}</div></article>`).join("")}</div></div></section>` : `<section class="panel"><div class="empty"><div><div class="empty-icon">${icon("history")}</div><h2>暂无历史版本</h2><p>草稿重新生成或正式报告发布后，旧版本会在此保留。</p><button class="btn primary" type="button" data-action="start-create">创建报告</button></div></div></section>`}<div class="notice warning" style="margin-top:12px">${icon("archive-x")}<div><strong>历史资源不可定位时不自动替代</strong><span>系统会返回“无法核验 / 历史资源不可定位”，不会用当前 Published 定义、当前权威组合或上一可信组合冒充原版本。</span></div></div></div>`, { crumb:"历史版本" });
  }

  function renderModal() {
    const modal = state.ui.modal;
    if (!modal) return "";
    let title = "";
    let subtitle = "";
    let body = "";
    let foot = "";
    let wide = false;
    if (modal.type === "reset") {
      title = "重置报告中心状态";
      subtitle = "清除本入口内操作产生的草稿、正式报告和运行记录。";
      body = `<div class="notice warning">${icon("rotate-ccw")}<div><strong>将回到初始空状态</strong><span>不会修改其他模块、Published 本体或正式数据绑定。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="confirm-reset">确认重置</button>`;
    } else if (modal.type === "confirm-review") {
      title = "确认草稿";
      subtitle = "人工确认与自动核验结果分别追溯。";
      const report = currentReport();
      body = `<div class="notice success">${icon("user-check")}<div><strong>人工检查已完成</strong><span>确认后草稿内容冻结，可进入正式发布；确认不会修改权威语义或数据绑定。</span></div></div><div class="meta-list" style="margin-top:10px"><div class="meta-row"><span>草稿</span><strong>${esc(report?.draftId)}</strong></div><div class="meta-row"><span>核验运行</span><strong>${esc(report?.verification?.runId)}</strong></div><div class="meta-row"><span>复核意见</span><strong>${esc(report?.reviewNote || "无补充意见")}</strong></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-confirm-review">确认草稿</button>`;
    } else if (modal.type === "publish") {
      title = "发布正式报告";
      subtitle = "系统内 HTML 与 PDF 固定版共享报告编号、内容版本和证据链。";
      const report = currentReport();
      body = `<div class="confirm-grid"><div class="confirm-card"><span>草稿</span><strong>${esc(report?.draftId)} · ${esc(report?.draftVersion)}</strong></div><div class="confirm-card"><span>固定组合</span><strong>${esc(report?.semanticVersion)} / ${esc(report?.dataVersion)}</strong></div><div class="confirm-card"><span>HTML</span><strong>受控组件渲染 · 发布后冻结</strong></div><div class="confirm-card"><span>PDF</span><strong>同内容版本固定呈现</strong></div></div><div class="notice warning" style="margin-top:10px">${icon("lock-keyhole")}<div><strong>发布不改变上游绑定</strong><span>不会创建或修改 Object、Metric、Rule、Property、Link、Action Type，也不会更新 Agent 配置。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-publish">${icon("upload", "sm")}确认发布</button>`;
    } else if (modal.type === "regenerate") {
      title = "请求重新生成";
      subtitle = "当前草稿和核验结果保留为历史，新草稿形成独立内容版本。";
      body = `<div class="form-field"><label>重新生成原因</label><textarea class="textarea" id="regenerate-reason">修正指标单位、R02 Published 条件与无绑定建议内容，保留原证据组合。</textarea></div><div class="notice warning" style="margin-top:10px">${icon("copy-plus")}<div><strong>不会原地修改当前草稿</strong><span>新草稿将重新建立锚点—证据绑定，并重新运行确定性核验。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-regenerate">创建新内容版本</button>`;
    } else if (modal.type === "new-content") {
      const report = currentReport();
      title = "生成新内容版本";
      subtitle = "原正式报告继续按当时语义和数据版本追溯。";
      body = `<div class="confirm-grid"><div class="confirm-card"><span>原报告快照</span><strong>${esc(report?.reportNo)} · ${esc(report?.semanticVersion)} / ${esc(report?.dataVersion)}</strong></div><div class="confirm-card"><span>新请求上下文</span><strong>重新选择 Published 语义与正式数据组合</strong></div></div><div class="notice success" style="margin-top:10px">${icon("lock-keyhole")}<div><strong>原报告保持冻结</strong><span>新请求不会回写原 HTML、PDF、内容版本或证据锚点。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn primary" type="button" data-action="submit-new-content">继续选择上下文</button>`;
    } else if (modal.type === "withdraw") {
      const report = currentReport();
      title = "撤回正式报告";
      subtitle = "撤回不会删除历史产物和证据链。";
      body = `<div class="form-field"><label>撤回原因</label><textarea class="textarea" id="withdraw-reason">需要形成新的内容版本后重新发布。</textarea></div><div class="notice warning" style="margin-top:10px">${icon("archive")}<div><strong>${esc(report?.reportNo)} 将停止作为当前正式呈现</strong><span>历史查看、证据定位和审计记录继续保留。</span></div></div>`;
      foot = `<button class="btn" type="button" data-action="close-modal">取消</button><button class="btn danger" type="button" data-action="submit-withdraw">确认撤回</button>`;
    }
    return `<div class="modal-backdrop"><section class="modal ${wide ? "wide" : ""}"><header class="modal-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-button" type="button" data-action="close-modal">${icon("x")}</button></header><div class="modal-body">${body}</div><footer class="modal-foot">${foot}</footer></section></div>`;
  }

  function renderDrawer() {
    const drawer = state.ui.drawer;
    if (!drawer) return "";
    let title = "";
    let subtitle = "";
    let body = "";
    let foot = `<button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    const report = currentReport();
    if (drawer.type === "definitions") {
      title = "报告定义与资源边界";
      subtitle = "定义约束内容，模板只负责章节骨架和版式。";
      body = `<div class="stack"><div class="check-detail"><h3>RD-FIN-001 · 集团融资经营分析报告</h3><div class="meta-list"><div class="meta-row"><span>业务目的</span><strong>固定呈现集团融资成本、结构与重点单位问题</strong></div><div class="meta-row"><span>适用对象</span><strong>集团财务管理者</strong></div><div class="meta-row"><span>模板引用</span><strong>RT-FIN-002 · 2.2.0</strong></div><div class="meta-row"><span>证据范围</span><strong>Published 指标、Rule、固定数据版本与可信度披露</strong></div><div class="meta-row"><span>Agent 引用</span><strong>融资报告生成助手 · 只读运行结果</strong></div><div class="meta-row"><span>复核规则</span><strong>T049 完成后人工确认</strong></div></div></div><div class="owner-list"><div class="owner-row"><strong>报告中心</strong><span>报告定义、模板、证据包、复核副本、人工结论和正式产物。</span></div><div class="owner-row"><strong>Agent 应用</strong><span>Agent 配置、Skill、工具权限、会话和运行记录。</span></div><div class="owner-row"><strong>本体管理</strong><span>Published 语义定义及精确历史版本解析。</span></div><div class="owner-row"><strong>数据工程</strong><span>数据可信度与可复现性事实，不直供业务明细。</span></div></div></div>`;
    } else if (drawer.type === "run-detail") {
      const g = state.generation;
      title = "生成运行详情";
      subtitle = "失败位置、Owner 与恢复方式";
      body = `<div class="meta-list"><div class="meta-row"><span>生成请求</span><strong>${esc(g.requestId)}</strong></div><div class="meta-row"><span>证据包</span><strong>${esc(g.evidencePackId || "未完成")}</strong></div><div class="meta-row"><span>Agent Run</span><strong>${esc(g.agentRunId || "未发起")}</strong></div><div class="meta-row"><span>当前状态</span><strong>${esc(g.status)}</strong></div><div class="meta-row"><span>失败位置</span><strong>${esc(g.error?.type === "evidence" ? "报告中心 · 证据固定" : "Agent 应用 · 报告生成 Run")}</strong></div><div class="meta-row"><span>恢复建议</span><strong>${esc(g.error?.recovery || "无需恢复")}</strong></div></div>`;
    } else if (drawer.type === "report-info") {
      title = "报告信息";
      subtitle = isPublished(report) ? "正式报告内容已冻结" : "草稿复核副本";
      body = `<div class="meta-list"><div class="meta-row"><span>${isPublished(report) ? "报告编号" : "草稿标识"}</span><strong>${esc(report?.reportNo || report?.draftId)}</strong></div><div class="meta-row"><span>报告定义</span><strong>RD-FIN-001 · 1.0.0</strong></div><div class="meta-row"><span>模板</span><strong>RT-FIN-002 · 2.2.0</strong></div><div class="meta-row"><span>证据包</span><strong>${esc(report?.evidencePackId)}</strong></div><div class="meta-row"><span>Published 语义</span><strong>${esc(report?.semanticVersion)}</strong></div><div class="meta-row"><span>数据版本</span><strong>${esc(report?.dataVersion)} · 截至 ${esc(report?.asOf)}</strong></div><div class="meta-row"><span>HTML / PDF</span><strong>${isPublished(report) ? "同一报告编号、内容版本和证据链" : "发布后同源形成"}</strong></div></div>`;
    } else if (drawer.type === "publish-run") {
      const p = state.publishRun;
      title = "正式报告发布";
      subtitle = p.runId || "等待创建";
      body = `<div class="status-row">${badge(p.status === "running" ? "发布中" : p.status === "failed" ? "失败" : "成功")}</div><div class="progress-track"><div class="progress-bar" style="width:${p.progress}%"></div></div>${p.status === "failed" ? `<div class="notice danger">${icon("file-warning")}<div><strong>PDF 固定版生成失败</strong><span>${esc(p.error)}。HTML 草稿和人工确认保持不变，尚未形成正式报告。</span></div></div>` : p.status === "completed" ? `<div class="notice success">${icon("circle-check")}<div><strong>正式报告已形成</strong><span>HTML 阅读版和 PDF 固定版共享报告编号、内容版本和证据链。</span></div></div>` : `<div class="notice">${icon("loader-circle")}<div><strong>正在形成受控 HTML 与 PDF</strong><span>发布成功前不会进入正式目录。</span></div></div>`}`;
      foot = p.status === "failed" ? `<button class="btn" type="button" data-action="close-drawer">稍后处理</button><button class="btn primary" type="button" data-action="retry-publish">${icon("refresh-cw", "sm")}重试发布</button>` : p.status === "completed" ? `<button class="btn primary" type="button" data-action="close-drawer">查看正式报告</button>` : "";
    } else if (drawer.type === "export") {
      const task = state.exportTasks[0];
      title = "PDF 导出任务";
      subtitle = task?.id || "等待创建";
      body = task ? `<div class="status-row">${badge(task.status === "running" ? "导出中" : task.status === "failed" ? "失败" : "成功")}</div><div class="progress-track"><div class="progress-bar" style="width:${task.progress}%"></div></div>${task.status === "failed" ? `<div class="notice danger">${icon("circle-alert")}<div><strong>固定版字体资源读取失败</strong><span>正式 HTML 报告未受影响。重新读取受控字体资源后可重试。</span></div></div>` : task.status === "completed" ? `<div class="notice success">${icon("file-down")}<div><strong>PDF 固定呈现已就绪</strong><span>与 HTML 共享 ${esc(task.reportNo)}、内容版本和证据链。</span></div></div>` : `<div class="notice">${icon("loader-circle")}<div><strong>正在准备固定呈现</strong><span>任务完成后可打开打印 / 保存 PDF 视图。</span></div></div>`}` : "";
      foot = task?.status === "failed" ? `<button class="btn" type="button" data-action="close-drawer">关闭</button><button class="btn primary" type="button" data-action="retry-export">${icon("refresh-cw", "sm")}重试导出</button>` : task?.status === "completed" ? `<button class="btn" type="button" data-action="close-drawer">关闭</button><button class="btn primary" type="button" data-action="open-print-view">${icon("printer", "sm")}打开固定版</button>` : "";
    } else if (drawer.type === "snapshot") {
      title = "报告快照与当前数据比较";
      subtitle = "显式比较，不改写原报告";
      const c = state.snapshotComparison;
      body = c.status === "running" ? `<div class="notice">${icon("loader-circle")}<div><strong>正在读取当前兼容组合</strong><span>原报告快照保持固定。</span></div></div>` : c.status === "completed" ? `<div class="stack"><div class="confirm-grid"><div class="confirm-card"><span>报告生成时快照</span><strong>${esc(report?.dataVersion)} · 截至 ${esc(report?.asOf)}</strong></div><div class="confirm-card"><span>当前兼容数据</span><strong>2026.08.09-01 · 截至 2026-08-09</strong></div></div><div class="notice success">${icon("columns-3")}<div><strong>当前没有更新版本</strong><span>报告快照与当前权威组合一致；比较记录 ${esc(c.recordId)} 已形成。原报告内容未改变。</span></div></div></div>` : `<div class="notice warning">${icon("columns-3")}<div><strong>尚未读取当前数据</strong><span>该操作会并列展示报告快照与当前兼容组合，不会静默替换报告证据。</span></div></div>`;
      foot = c.status === "idle" ? `<button class="btn" type="button" data-action="close-drawer">取消</button><button class="btn primary" type="button" data-action="run-snapshot-comparison">开始比较</button>` : `<button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    } else if (drawer.type === "history-resolution") {
      const id = drawer.id;
      const h = state.historyResolution[id] || { status:"idle" };
      title = "历史证据定位";
      subtitle = `${id} · 严格按生成时版本解析`;
      if (h.status === "running") body = `<div class="notice">${icon("loader-circle")}<div><strong>正在定位历史资源</strong><span>不会回退到当前 Published 或上一可信组合。</span></div></div>`;
      else if (h.status === "completed") body = `<div class="stack"><div class="check-row">${icon("check", "sm")}<div><strong>Published 语义 3.8.1</strong><span>Object、Metric、Rule 稳定标识均可定位</span></div>${badge("通过")}</div><div class="check-row">${icon("check", "sm")}<div><strong>数据 2026.08.09-01</strong><span>快照与可信度记录可复现</span></div>${badge("通过")}</div><div class="check-row">${icon("circle-help", "sm")}<div><strong>数据质量附件 Q-18</strong><span>原附件定位凭据已失效；未改用当前质量记录替代</span></div>${badge("历史资源不可定位","purple")}</div><div class="notice purple">${icon("archive-x")}<div><strong>附件相关内容无法核验</strong><span>报告原文保持不变，相关锚点返回限制，不由助手猜测或以当前定义冒充。</span></div></div></div>`;
      else body = `<div class="notice warning">${icon("history")}<div><strong>尚未执行历史定位</strong><span>定位结果会分别显示语义、数据和附件证据。</span></div></div>`;
      foot = h.status === "idle" ? `<button class="btn" type="button" data-action="close-drawer">取消</button><button class="btn primary" type="button" data-action="run-history-resolution" data-id="${esc(id)}">开始定位</button>` : `<button class="btn" type="button" data-action="close-drawer">关闭</button>`;
    } else if (drawer.type === "history-draft") {
      const oldDraft = state.draftHistory.find((item) => item.draftId === drawer.id);
      title = "旧草稿详情";
      subtitle = `${esc(oldDraft?.draftId || drawer.id)} · 已由新内容版本替代`;
      const counts = verificationCounts(oldDraft || {});
      body = oldDraft ? `<div class="stack"><div class="notice warning">${icon("copy-plus")}<div><strong>旧草稿保持只读</strong><span>重新生成形成了新的草稿版本；该版本及其核验结果没有被原地覆盖。</span></div></div><div class="meta-list"><div class="meta-row"><span>草稿版本</span><strong>${esc(oldDraft.draftVersion)}</strong></div><div class="meta-row"><span>证据包</span><strong>${esc(oldDraft.evidencePackId)}</strong></div><div class="meta-row"><span>生成 Run</span><strong>${esc(oldDraft.agentRunId)}</strong></div><div class="meta-row"><span>固定组合</span><strong>${esc(oldDraft.semanticVersion)} / ${esc(oldDraft.dataVersion)}</strong></div><div class="meta-row"><span>核验结果</span><strong>通过 ${counts.pass} · 警告 ${counts.warning} · 失败 ${counts.fail} · 无法核验 ${counts.unverifiable}</strong></div></div></div>` : `<div class="notice danger">旧草稿记录无法读取。</div>`;
    }
    return `<div class="drawer-backdrop"><aside class="drawer"><header class="drawer-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="icon-button" type="button" data-action="close-drawer">${icon("x")}</button></header><div class="drawer-body">${body}</div><footer class="drawer-foot">${foot}</footer></aside></div>`;
  }

  function renderOverlay() { return `${renderModal()}${renderDrawer()}`; }

  function makeDraft() {
    const ctx = context();
    const revision = state.generation.targetRevision || 1;
    return {
      draftId: makeId("DRF"),
      draftVersion: `0.${revision}`,
      revision,
      status: "待复核",
      generatedAt: nowText(),
      reportDefinition: "RD-FIN-001@1.0.0",
      template: "RT-FIN-002@2.2.0",
      evidencePackId: state.generation.evidencePackId,
      agentRunId: state.generation.agentRunId,
      semanticVersion: ctx.semanticVersion,
      dataVersion: ctx.dataVersion,
      metricResultVersion: ctx.metricResultVersion,
      ruleResultVersion: ctx.ruleResultVersion,
      asOf: ctx.asOf,
      quality: ctx.quality,
      freshness: ctx.freshness,
      baseReportNo: state.wizard.baseReportNo,
      issues: [],
      verification: { status:"idle", progress:0, runId:null, attempt:revision > 1 ? 1 : 0, results:[], completedAt:null },
      reviewChecks: [
        { key:"content", label:"正文与业务判断已检查", hint:"确认摘要、正文、表格、图表和附件之间没有未披露冲突。", done:false },
        { key:"warnings", label:"警告项与限制已检查", hint:"确认质量提示、未知分类和建议性内容已业务可读披露。", done:false },
        { key:"release", label:"发布范围与读者已检查", hint:"确认报告适用对象、HTML/PDF 和访问范围。", done:false }
      ],
      reviewNote: "",
      confirmedAt: null
    };
  }

  function runGenerationPipeline() {
    const g = state.generation;
    g.status = "running";
    g.progress = 8;
    g.phase = "已接收生成请求";
    g.error = null;
    g.startedAt = g.startedAt || nowText();
    commit();
    schedule(() => {
      g.progress = 32;
      g.phase = "正在固定生成证据包";
      g.evidencePackId = g.evidencePackId || makeId("EVP");
      commit();
    }, 600);
    schedule(() => {
      if (state.wizard.includeRestrictedAttachment && g.attempt === 0) {
        g.status = "failed";
        g.progress = 36;
        g.phase = "证据固定失败";
        g.error = { type:"evidence", title:"机构授信附件不可读取", detail:"A-17 的当前访问权限不足，证据包没有完成。", recovery:"移除可选附件后重试；相关章节不会由模型猜测补齐。" };
        commit();
        toast("证据固定失败", "受限附件不可读取，草稿尚未生成。", "danger");
        return;
      }
      g.progress = 56;
      g.phase = "精确版本与可复现性已验证";
      commit();
    }, 1200);
    schedule(() => {
      if (g.status !== "running") return;
      g.progress = 76;
      g.phase = "Agent 正在生成报告内容";
      g.agentRunId = makeId("AGR");
      commit();
    }, 1750);
    schedule(() => {
      if (g.status !== "running") return;
      if (g.attempt === 0) {
        g.status = "failed";
        g.progress = 78;
        g.phase = "报告生成失败";
        g.error = { type:"agent", title:"报告生成运行超时", detail:"Agent Run 在章节整合阶段超时，没有返回可复核草稿。", recovery:"保留已固定证据包，重新发起独立生成 Run。" };
        commit();
        toast("报告生成失败", "证据包已保留，可以直接重试生成。", "danger");
        return;
      }
      g.progress = 92;
      g.phase = "正在形成草稿复核副本";
      commit();
    }, 2450);
    schedule(() => {
      if (g.status !== "running") return;
      g.status = "completed";
      g.progress = 100;
      g.phase = "草稿已返回";
      state.draft = makeDraft();
      state.selectedReportNo = null;
      commit();
      toast("草稿已生成", `${state.draft.draftVersion} 已进入证据核验台，尚未自动核验或人工确认。`, "success");
    }, 3050);
  }

  function beginNewGeneration(options = {}) {
    const currentRevision = options.targetRevision || 1;
    state.generation = {
      status:"running",
      progress:0,
      phase:"正在创建生成请求",
      attempt:options.skipFirstFailure ? 1 : 0,
      requestId:makeId("RGR"),
      evidencePackId:null,
      agentRunId:null,
      error:null,
      startedAt:nowText(),
      targetRevision:currentRevision
    };
    navigate("/run");
    runGenerationPipeline();
  }

  function runVerification(report, isRetry = false) {
    if (!report || isPublished(report)) return;
    const v = report.verification;
    if (isRetry) v.attempt += 1;
    v.status = "running";
    v.progress = 8;
    v.runId = makeId("T049");
    v.results = [];
    v.completedAt = null;
    state.selectedCheckId = null;
    state.rightTab = "verification";
    commit();
    schedule(() => { if (v.status !== "running") return; v.progress = 46; commit(); }, 650);
    schedule(() => {
      if (v.status !== "running") return;
      if (v.attempt === 0) {
        v.status = "run_failed";
        v.progress = 58;
        commit();
        toast("自动核验运行失败", "没有产生四态结论，可从原证据包重试。", "danger");
        return;
      }
      v.progress = 82;
      commit();
    }, 1250);
    schedule(() => {
      if (v.status !== "running") return;
      v.status = "completed";
      v.progress = 100;
      v.results = clone(report.revision > 1 ? DATA.cleanChecks : DATA.baseChecks);
      v.completedAt = nowText();
      state.selectedCheckId = v.results.find((item) => item.status === "fail")?.id || v.results[0].id;
      state.leftTab = "checks";
      commit();
      const counts = verificationCounts(report);
      toast("自动核验已完成", `通过 ${counts.pass}、警告 ${counts.warning}、失败 ${counts.fail}、无法核验 ${counts.unverifiable}。`, counts.fail + counts.unverifiable ? "danger" : "success");
    }, 1900);
  }

  function startPublish() {
    state.publishRun = { status:"running", progress:12, attempt:state.publishRun.attempt || 0, runId:makeId("PUB"), error:null };
    state.ui.modal = null;
    state.ui.drawer = { type:"publish-run" };
    commit();
    schedule(() => { if (state.publishRun.status !== "running") return; state.publishRun.progress = 56; commit(); }, 700);
    schedule(() => {
      if (state.publishRun.status !== "running") return;
      if (state.publishRun.attempt === 0) {
        state.publishRun.status = "failed";
        state.publishRun.progress = 64;
        state.publishRun.error = "受控中文字体资源读取超时";
        commit();
        toast("发布失败", "尚未进入正式报告目录，可以直接重试。", "danger");
        return;
      }
      state.publishRun.progress = 88;
      commit();
    }, 1450);
    schedule(() => {
      if (state.publishRun.status !== "running") return;
      const source = state.draft;
      const reportNo = makeId("RPT");
      const formal = {
        ...clone(source),
        reportNo,
        contentVersion:`${state.published.length + 1}.0`,
        status:"已发布",
        publishedAt:nowText(),
        htmlFormat:"系统内 HTML",
        pdfFormat:"PDF 固定版",
        withdrawnAt:null,
        withdrawReason:null
      };
      state.published.unshift(formal);
      state.draft = null;
      state.selectedReportNo = reportNo;
      state.publishRun.status = "completed";
      state.publishRun.progress = 100;
      commit();
      toast("正式报告已发布", `${reportNo} 已进入目录；HTML 与 PDF 共享内容版本和证据链。`, "success");
    }, 2150);
  }

  function startExport(report, retry = false) {
    let task = state.exportTasks[0];
    if (!task || task.reportNo !== report.reportNo) {
      task = { id:makeId("EXP"), reportNo:report.reportNo, contentVersion:report.contentVersion, status:"running", progress:10, attempt:0, createdAt:nowText() };
      state.exportTasks.unshift(task);
    } else {
      if (retry) task.attempt += 1;
      task.status = "running";
      task.progress = 10;
    }
    state.ui.drawer = { type:"export" };
    commit();
    schedule(() => { if (task.status !== "running") return; task.progress = 58; commit(); }, 650);
    schedule(() => {
      if (task.status !== "running") return;
      if (task.attempt === 0) {
        task.status = "failed";
        task.progress = 66;
        task.failedAt = nowText();
        commit();
        toast("PDF 导出失败", "正式 HTML 报告不受影响，可重试导出。", "danger");
      } else {
        task.status = "completed";
        task.progress = 100;
        task.completedAt = nowText();
        commit();
        toast("PDF 固定呈现已就绪", "可打开打印 / 保存 PDF 视图。", "success");
      }
    }, 1350);
  }

  function openPrintView(report) {
    const win = window.open("", "_blank");
    if (!win) { toast("无法打开固定版", "浏览器阻止了新窗口，请允许弹出窗口后重试。", "danger"); return; }
    win.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(report.reportNo)} · PDF 固定呈现</title><style>body{margin:0;background:#e9edf2;font-family:-apple-system,"PingFang SC",sans-serif;color:#172234}.bar{padding:12px 20px;background:#172435;color:white;display:flex;justify-content:space-between}.page{width:794px;min-height:1123px;margin:24px auto;padding:62px;background:white;box-shadow:0 4px 20px #0002;box-sizing:border-box}h1{font-family:"Songti SC",serif;font-size:28px}h2{margin-top:32px;border-bottom:1px solid #ccd5df;padding-bottom:8px}p{line-height:1.9}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:#536175}.foot{margin-top:34px;padding-top:12px;border-top:1px solid #ccd5df;font-size:11px;color:#66758a}@media print{.bar{display:none}.page{margin:0;box-shadow:none;width:auto;min-height:auto}}</style></head><body><div class="bar"><strong>PDF 固定呈现</strong><button onclick="window.print()">打印 / 保存 PDF</button></div><article class="page"><h1>集团融资经营分析报告</h1><div class="meta"><span>报告编号：${esc(report.reportNo)}</span><span>内容版本：${esc(report.contentVersion)}</span><span>Published 语义：${esc(report.semanticVersion)}</span><span>数据版本：${esc(report.dataVersion)}</span><span>数据截至：${esc(report.asOf)}</span><span>证据包：${esc(report.evidencePackId)}</span></div><h2>经营概览</h2><p>截至 ${esc(report.asOf)}，集团融资余额为 21,613.387 亿元，余额加权融资成本为 2.372231%。</p><h2>Rule 发现</h2><p>R01、R02、R03 的命中结论均绑定生成时 Published Rule 版本与固定评估证据。</p><h2>证据与限制</h2><p>18 条担保类型为空，担保结构保留“未知”单列。本固定呈现与系统内 HTML 共享报告编号、内容版本和证据链。</p><div class="foot">${esc(report.reportNo)} · ${esc(report.contentVersion)} · 证据包 ${esc(report.evidencePackId)}</div></article></body></html>`);
    win.document.close();
  }

  function scrollToAnchor(anchorId) {
    window.requestAnimationFrame(() => {
      const node = document.querySelector(`.report-paper [data-anchor="${CSS.escape(anchorId)}"]`);
      if (node) node.scrollIntoView({ behavior:"smooth", block:"center" });
    });
  }

  function handleAction(element) {
    const action = element.dataset.action;
    if (!action) return;
    if (action === "toggle-nav") { state.navOpen = !state.navOpen; return commit(); }
    if (action === "open-reset") { state.ui.modal = { type:"reset" }; return commit(); }
    if (action === "close-modal") { state.ui.modal = null; return commit(); }
    if (action === "close-drawer") { state.ui.drawer = null; return commit(); }
    if (action === "confirm-reset") {
      clearTimers();
      const next = freshState();
      state = next;
      localStorage.removeItem(STORAGE_KEY);
      navigate("/catalog");
      toast("状态已重置", "已回到初始空状态。", "success");
      return;
    }
    if (action === "open-definitions") { state.ui.drawer = { type:"definitions" }; return commit(); }
    if (action === "set-catalog-mode") { state.catalog.mode = element.dataset.mode; return commit(); }
    if (action === "start-create") {
      const defaults = freshState().wizard;
      state.wizard = defaults;
      return navigate("/create");
    }
    if (action === "cancel-create" || action === "back-catalog") return navigate("/catalog");
    if (action === "wizard-prev") { state.wizard.step = Math.max(1,state.wizard.step-1); return commit(); }
    if (action === "wizard-next") {
      if (!canNextWizard()) { toast("当前步骤尚未完成", "请先验证数据上下文并处理披露要求。", "danger"); return; }
      state.wizard.step = Math.min(6,state.wizard.step+1);
      return commit();
    }
    if (action === "validate-context") {
      state.wizard.contextValidation = "running";
      commit();
      schedule(() => {
        const ctx = context();
        const valid = ctx.compatibility === "兼容" && ctx.readiness === "可消费";
        state.wizard.contextValidation = valid ? "success" : "failed";
        commit();
        toast(valid ? "兼容性已验证" : "当前组合不可用于生成", valid ? "可以继续固定报告证据。" : ctx.note, valid ? "success" : "danger");
      }, 780);
      return;
    }
    if (action === "submit-generation") {
      const ctx = context();
      if (state.wizard.contextValidation !== "success" || (ctx.freshness === "陈旧" && !state.wizard.acknowledgeStale)) {
        state.wizard.step = 4;
        commit();
        toast("数据上下文未就绪", "返回数据上下文步骤完成验证。", "danger");
        return;
      }
      beginNewGeneration({ targetRevision:1, skipFirstFailure:false });
      return;
    }
    if (action === "retry-generation") {
      if (state.generation.error?.type === "evidence") state.wizard.includeRestrictedAttachment = false;
      state.generation.attempt += 1;
      state.generation.agentRunId = null;
      return runGenerationPipeline();
    }
    if (action === "open-run-detail") { state.ui.drawer = { type:"run-detail" }; return commit(); }
    if (action === "open-draft") { state.selectedReportNo = null; return navigate("/evidence"); }
    if (action === "open-published") { state.selectedReportNo = element.dataset.id; state.rightTab = "evidence"; return navigate("/evidence"); }
    if (action === "select-anchor") {
      const anchorId = element.dataset.anchor;
      const anchor = DATA.anchors.find((item) => item.id === anchorId);
      state.selectedAnchor = anchorId;
      if (anchor) state.selectedSection = anchor.section;
      state.rightTab = "evidence";
      commit();
      scrollToAnchor(anchorId);
      return;
    }
    if (action === "set-left-tab") { state.leftTab = element.dataset.tab; return commit(); }
    if (action === "set-right-tab") { state.rightTab = element.dataset.tab; return commit(); }
    if (action === "set-bottom-tab") { state.bottomTab = element.dataset.tab; return commit(); }
    if (action === "filter-checks") { state.verificationFilter = element.dataset.filter; return commit(); }
    if (action === "select-check") {
      const report = currentReport();
      const check = report?.verification?.results?.find((item) => item.id === element.dataset.check);
      state.selectedCheckId = element.dataset.check;
      if (check && DATA.anchors.some((a) => a.id === check.anchor)) state.selectedAnchor = check.anchor;
      state.rightTab = "verification";
      commit();
      if (check) scrollToAnchor(check.anchor);
      return;
    }
    if (action === "start-verification") return runVerification(currentReport(), false);
    if (action === "retry-verification") return runVerification(currentReport(), true);
    if (action === "rerun-verification") { const report = currentReport(); if (report) report.verification.attempt = Math.max(1,report.verification.attempt); return runVerification(report,false); }
    if (action === "explain-check") {
      const report = currentReport();
      const check = report?.verification?.results?.find((item)=>item.id===element.dataset.check);
      if (!check) return;
      state.explanation = { status:"running", checkId:check.id, runId:makeId("VER-EX"), text:null };
      commit();
      schedule(() => {
        state.explanation.status = "completed";
        state.explanation.text = check.status === "unverifiable" ? "该句缺少生成时结构化绑定，现有证据无法区分事实与建议。应在新草稿中标记为建议或移除；不能用当前定义补齐。" : `报告位置“${DATA.anchors.find((a)=>a.id===check.anchor)?.label || check.anchor}”与权威证据“${check.authority}”不一致。建议按原证据组合重新生成该位置，不修改 Metric 或 Rule 定义。`;
        commit();
        toast("差异解释已返回", "确定性核验状态没有改变。", "success");
      }, 1100);
      return;
    }
    if (action === "create-review-issues") {
      const report = currentReport();
      if (!report || isPublished(report)) return;
      report.issues = report.verification.results.filter((item)=>["fail","unverifiable"].includes(item.status)).map((item)=>({ id:makeId("RI"), checkId:item.id, anchor:item.anchor, title:item.issue, status:"待处理", createdAt:nowText() }));
      state.leftTab = "checks";
      commit();
      toast("复核问题已形成", `${report.issues.length} 项问题已关联报告位置与核验证据。`, "success");
      return;
    }
    if (action === "request-regenerate") { state.ui.modal = { type:"regenerate" }; return commit(); }
    if (action === "submit-regenerate") {
      const report = state.draft;
      if (!report) return;
      state.draftHistory.unshift(clone(report));
      state.wizard.baseReportNo = report.baseReportNo;
      state.draft = null;
      state.ui.modal = null;
      beginNewGeneration({ targetRevision:report.revision + 1, skipFirstFailure:true });
      return;
    }
    if (action === "confirm-review") { state.ui.modal = { type:"confirm-review" }; return commit(); }
    if (action === "submit-confirm-review") {
      const report = state.draft;
      if (!report) return;
      report.status = "已确认";
      report.confirmedAt = nowText();
      state.ui.modal = null;
      commit();
      toast("草稿已确认", "人工确认已单独记录，可以发布正式报告。", "success");
      return;
    }
    if (action === "open-publish") { state.ui.modal = { type:"publish" }; return commit(); }
    if (action === "submit-publish") return startPublish();
    if (action === "retry-publish") { state.publishRun.attempt += 1; return startPublish(); }
    if (action === "open-report-info") { state.ui.drawer = { type:"report-info" }; return commit(); }
    if (action === "assistant-suggest") { state.assistant.question = element.dataset.question; state.rightTab = "assistant"; return commit(); }
    if (action === "send-question") {
      const question = state.assistant.question.trim();
      const report = currentReport();
      if (!question || !report) return;
      state.assistant.messages.push({ role:"user", text:question });
      state.assistant.question = "";
      state.assistant.status = "running";
      state.assistant.sessionId = state.assistant.sessionId || makeId("SES");
      state.assistant.runId = makeId("QAR");
      commit();
      schedule(() => {
        const lower = question.toLowerCase();
        let text = "当前结论基于报告生成时固定证据：集团融资余额 21,613.387 亿元，余额加权融资成本 2.372231%。";
        if (question.includes("R02")) text = "R02 在单位465命中：浮动利率余额占比为 100%，高于生成时绑定的 Published 条件 80%。";
        if (question.includes("预测") || question.includes("下个月")) text = "报告证据包不包含未来预测依据，无法回答下个月融资成本。助手不会根据缺失证据猜测；可发起新的分析流程后再引用正式结果。";
        if (question.includes("当前数据")) text = "默认只使用报告生成时快照。请使用“与当前数据比较”显式读取当前兼容组合，并列查看后再提问。";
        state.assistant.messages.push({ role:"assistant", text, meta:`证据包 ${report.evidencePackId} · 语义 ${report.semanticVersion} · 数据 ${report.dataVersion} · 生成 ${nowText()} · Agent Run ${state.assistant.runId}` });
        state.assistant.status = "completed";
        state.assistant.resultId = makeId("ANS");
        commit();
      }, 1050);
      return;
    }
    if (action === "compare-snapshot") { state.snapshotComparison = { status:"idle", recordId:null, comparedAt:null }; state.ui.drawer = { type:"snapshot" }; return commit(); }
    if (action === "run-snapshot-comparison") {
      state.snapshotComparison.status = "running";
      commit();
      schedule(() => { state.snapshotComparison = { status:"completed", recordId:makeId("CMP"), comparedAt:nowText() }; commit(); toast("快照比较已完成", "原报告内容和证据链没有改变。", "success"); }, 1050);
      return;
    }
    if (action === "export-pdf") { const report = currentReport(); if (report) startExport(report,false); return; }
    if (action === "retry-export") { const report = currentReport(); if (report) startExport(report,true); return; }
    if (action === "open-print-view") { const report = currentReport(); if (report) openPrintView(report); return; }
    if (action === "new-content-version") { state.ui.modal = { type:"new-content" }; return commit(); }
    if (action === "submit-new-content") {
      const report = currentReport();
      const defaults = freshState().wizard;
      state.wizard = { ...defaults, baseReportNo:report?.reportNo || null };
      state.ui.modal = null;
      return navigate("/create");
    }
    if (action === "open-withdraw") { state.ui.modal = { type:"withdraw" }; return commit(); }
    if (action === "submit-withdraw") {
      const report = currentReport();
      if (!report || !isPublished(report)) return;
      const input = document.getElementById("withdraw-reason");
      report.withdrawnAt = nowText();
      report.withdrawReason = input?.value.trim() || "未填写原因";
      state.ui.modal = null;
      commit();
      toast("正式报告已撤回", "历史产物与证据链继续保留。", "success");
      return;
    }
    if (action === "open-history-item") {
      const id = element.dataset.id;
      const published = state.published.find((item)=>item.reportNo===id);
      if (published) { state.selectedReportNo = id; return navigate("/evidence"); }
      const oldDraft = state.draftHistory.find((item)=>item.draftId===id);
      if (oldDraft) { state.ui.drawer = { type:"history-draft", id }; return commit(); }
      return;
    }
    if (action === "locate-history") { state.ui.drawer = { type:"history-resolution", id:element.dataset.id }; return commit(); }
    if (action === "run-history-resolution") {
      const id = element.dataset.id;
      state.historyResolution[id] = { status:"running", startedAt:nowText() };
      commit();
      schedule(() => { state.historyResolution[id] = { status:"completed", completedAt:nowText() }; commit(); toast("历史证据定位已完成", "一项附件证据返回历史资源不可定位，未使用当前版本替代。", "success"); }, 1200);
      return;
    }
  }

  function handleChange(element) {
    const kind = element.dataset.change;
    if (!kind) return;
    if (kind === "catalog-status") { state.catalog.status = element.value; return commit(); }
    if (kind === "catalog-scene") { state.catalog.scene = element.value; return commit(); }
    if (kind === "wizard-type") { state.wizard.typeId = element.value; return commit(); }
    if (kind === "wizard-scope") { state.wizard.scope = element.value; state.wizard.subject = element.value === "集团" ? "集团" : element.value === "板块" ? "境内新能源" : "单位553"; return commit(); }
    if (kind === "wizard-subject") { state.wizard.subject = element.value; return commit(); }
    if (kind === "wizard-context") { state.wizard.contextId = element.value; state.wizard.contextValidated = false; state.wizard.contextValidation = "idle"; state.wizard.acknowledgeStale = false; return commit(); }
    if (kind === "acknowledge-stale") { state.wizard.acknowledgeStale = element.checked; return commit(); }
    if (kind === "include-attachment") { state.wizard.includeRestrictedAttachment = element.checked; return commit(); }
    if (kind === "review-check") {
      const report = currentReport();
      const item = report?.reviewChecks?.find((check)=>check.key===element.dataset.key);
      if (item) item.done = element.checked;
      return commit();
    }
  }

  function handleInput(element) {
    const kind = element.dataset.input;
    if (!kind) return;
    if (kind === "catalog-query") {
      state.catalog.query = element.value;
      save();
      renderApp();
      window.requestAnimationFrame(() => {
        const next = document.querySelector('[data-input="catalog-query"]');
        if (next) { next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
      });
      return;
    }
    if (kind === "assistant-question") { state.assistant.question = element.value; return save(); }
    if (kind === "review-note") { const report = currentReport(); if (report) report.reviewNote = element.value; return save(); }
  }

  function renderApp() {
    const path = route();
    let html = "";
    if (path === "/catalog") html = renderCatalog();
    else if (path === "/create") html = renderCreate();
    else if (path === "/run") html = renderRun();
    else if (path === "/evidence") html = renderEvidence();
    else if (path === "/history") html = renderHistory();
    else html = renderCatalog();
    app.innerHTML = html;
    refreshIcons();
  }

  app.addEventListener("click", (event) => {
    const element = event.target.closest("[data-action]");
    if (!element) return;
    if (element.tagName === "A") event.preventDefault();
    handleAction(element);
  });
  app.addEventListener("change", (event) => handleChange(event.target));
  app.addEventListener("input", (event) => handleInput(event.target));
  window.addEventListener("hashchange", renderApp);
  renderApp();
})();
