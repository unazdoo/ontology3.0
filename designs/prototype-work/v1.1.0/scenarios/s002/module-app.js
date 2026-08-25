(function () {
  "use strict";

  let HOST = window;
  try {
    if (window.parent && window.parent !== window && window.parent.S002_STORE) HOST = window.parent;
  } catch (_) {}
  const DATA = HOST.S002_DATA || window.S002_DATA;
  const STORE = HOST.S002_STORE;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");

  const iconPaths = {
    home: '<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"/>',
    sparkles: '<path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-1 .8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13Z"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
    bot: '<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4M8.5 12h.01m7 0h.01M8 16h8"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6m-6 4h6"/>',
    chart: '<path d="M4 20V10m6 10V4m6 16v-7m4 7H2"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4m0 3h.01"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 15v5h16v-5"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    publish: '<path d="M4 14v6h16v-6"/><path d="M12 3v12m-4-4 4 4 4-4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    eye: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    restore: '<path d="M4 10a8 8 0 1 1 2 8"/><path d="M4 4v6h6"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
    link: '<path d="M9 15 7 17a4 4 0 0 1-6-6l3-3a4 4 0 0 1 6 0"/><path d="m15 9 2-2a4 4 0 1 1 6 6l-3 3a4 4 0 0 1-6 0"/><path d="m8 12 8 0"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M18.5 10A7 7 0 0 0 6 6.5L4 9m2 5a7 7 0 0 0 12 3.5L20 15"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'
  };

  function icon(name, size) {
    return `<span class="icon ${size || ""}" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPaths[name] || iconPaths.info}</svg></span>`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
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

  function markerBadge(marker) {
    const value = marker || "SOURCE";
    const tone = value === "SOURCE" ? "success" : value === "CORRECTED" || value === "MIXED_SOURCE_AND_DEMO_MARKERS" ? "warning" : value === "IMPUTED_ZERO" ? "danger" : "info";
    return `<span class="status-badge ${tone}">${escapeHtml(value)}</span>`;
  }

  function recordYears(record) {
    if (!record) return [];
    if (Array.isArray(record.years)) return record.years.map(Number);
    if (record.year != null) return [Number(record.year)];
    const source = [record.version, record.subject, record.title, record.projectId, record.month, record.cohort].filter(Boolean).join("|");
    return [...new Set((source.match(/20(?:24|25|26)/g) || []).map(Number))];
  }

  function recordMatchesFilters(record, snapshot, options) {
    const settings = { year: true, department: true, subject: true, project: true, period: true, anomaly: true, ...(options || {}) };
    const filters = snapshot.filters;
    if (settings.year && !recordYears(record).includes(Number(filters.year))) return false;
    if (settings.department && filters.department !== "全部" && record.department !== filters.department) return false;
    if (settings.subject && filters.subject !== "全部" && !(record.subjectCategories || []).includes(filters.subject)) return false;
    if (settings.project && filters.project !== "全部" && record.projectId !== filters.project && !String(record.subject || "").includes(filters.project)) return false;
    if (settings.period && filters.period !== "全年" && !(record.periods || (record.period ? [record.period] : [])).includes(filters.period)) return false;
    if (settings.anomaly && filters.anomaly !== "全部" && record.actionTypeId !== filters.anomaly) return false;
    return true;
  }

  function filterApplicability(themeId) {
    const matrix = {
      execution: ["year", "department", "subject", "project", "period"],
      submission: ["year", "department"],
      balance: ["year", "department", "project", "period", "anomaly"],
      anomaly: ["year", "department", "subject", "project", "period", "anomaly"],
      trend: ["department"]
    };
    return new Set(matrix[themeId] || matrix.execution);
  }

  function confirmedStatus(request) {
    return request && ["confirmed", "simulated-confirmed"].includes(request.status);
  }

  function showToast(title, detail, tone) {
    const toast = document.createElement("div");
    toast.className = `toast ${tone || "success"}`;
    toast.innerHTML = `${icon(tone === "warning" ? "alert" : tone === "error" ? "close" : "check")}<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span></div>`;
    toastRegion.appendChild(toast);
    window.setTimeout(function () { toast.remove(); }, 3800);
  }

  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function openModal(options) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${options.large ? "large" : ""}" role="dialog" aria-modal="true" data-modal-panel>
      <header class="modal-head"><div class="modal-title"><span>${icon(options.icon || "info")}</span><div><h2>${escapeHtml(options.title)}</h2><p>${escapeHtml(options.subtitle || "")}</p></div></div><button class="btn icon-only" type="button" data-action="close-modal" aria-label="关闭">${icon("close", "sm")}</button></header>
      <div class="modal-body">${options.body || ""}</div>
      <footer class="modal-foot">${options.footer || '<button class="btn" type="button" data-action="close-modal">关闭</button>'}</footer>
    </section></div>`;
  }

  function boundaryNotice() {
    return `<div class="boundary-note">${icon("shield")}<div><strong>演示边界</strong><span>所有 Action 仅形成平台内草稿、人工确认和待办；外部预算系统派发、自动审批、过账和覆盖最终批准预算均关闭。</span></div></div>`;
  }

  function dataStatusCards(snapshot) {
    const cards = [
      ["权威来源", `${DATA.quality.sourceFiles}份`, `${DATA.quality.logicalMembers}个逻辑成员`, snapshot.progress.dataConnected],
      ["质量门", `${DATA.quality.checksPassed}/${DATA.quality.checksTotal}`, `${DATA.quality.formulaErrors}个公式错误`, snapshot.progress.qualityPassed],
      ["实际与预算", `${DATA.quality.actualRows + DATA.quality.budgetRows}行`, "2024/2025实际与最终批准预算", snapshot.progress.assetPublished],
      ["演示标识", DATA.scenario.syntheticMark, "补数和跨年可比数据保留标记", true]
    ];
    return `<div class="kpi-grid">${cards.map(function (card) { return `<article class="kpi-card ${card[3] ? "ready" : ""}"><span>${escapeHtml(card[0])}</span><strong>${escapeHtml(card[1])}</strong><small>${escapeHtml(card[2])}</small></article>`; }).join("")}</div>`;
  }

  function actionButton(label, action, enabled, iconName, tone) {
    return `<button class="btn ${tone || "primary"}" type="button" data-action="${action}" ${enabled ? "" : "disabled"}>${icon(iconName || "play", "sm")}${escapeHtml(label)}</button>`;
  }

  function sourceTable() {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>来源文件</th><th>逻辑成员</th><th>业务时点</th><th>范围</th><th>用途</th><th>敏感性</th><th>SHA256</th></tr></thead><tbody>${DATA.sourceManifest.map(function (source) { return `<tr><td><strong>${escapeHtml(source.file)}</strong><small>${escapeHtml(source.version)}</small></td><td>${escapeHtml(source.members.join(" / "))}</td><td>${escapeHtml(source.asOf)}</td><td>${source.rows}行</td><td>${escapeHtml(source.use)}</td><td><span class="status-badge warning">${escapeHtml(source.sensitivity)}</span></td><td><code>${escapeHtml(source.sha256.slice(0, 12))}…</code></td></tr>`; }).join("")}</tbody></table></div>`;
  }

  function renderM02(snapshot) {
    return `<div class="module-page"><header class="module-page-head"><div><span>M02 · Data Engineering</span><h1>预算数据接入与质量门</h1><p>只处理来源、快照、管道、质量与数据资产版本；指标公式和业务阈值不进入管道。</p></div><div class="module-actions">${actionButton("登记并接入数据", "connect-data", !snapshot.progress.dataConnected, "upload")}${actionButton("运行20项质量检查", "run-quality", snapshot.progress.dataConnected && !snapshot.progress.qualityPassed, "play", "")}${actionButton("发布数据资产版本", "publish-data", snapshot.progress.qualityPassed && !snapshot.progress.assetPublished, "publish", "")}</div></header>
      ${dataStatusCards(snapshot)}
      <section class="panel"><div class="panel-head"><div><h2>权威资料索引</h2><p>源文件不覆盖；派生包只作为S002演示加工来源。</p></div><span class="status-badge ${snapshot.progress.assetPublished ? "success" : "warning"}">${snapshot.progress.assetPublished ? "S002-DATA-v1" : "待发布"}</span></div>${sourceTable()}</section>
      <div class="two-col"><section class="panel"><div class="panel-head"><div><h2>质量与加工说明</h2><p>不把合法记录误判为脏数据。</p></div></div><div class="quality-list"><div><span>21组重复凭证</span><strong>保留</strong><small>同凭证不同科目合法行，以10/20行号区分</small></div><div><span>13条期间异常</span><strong>已映射</strong><small>源值和演示期间双留存</small></div><div><span>6条日期倒置</span><strong>已修复</strong><small>保留原日期与修复说明</small></div><div><span>2024差旅/交通补数</span><strong>42条</strong><small>SYNTHETIC_FOR_DEMO</small></div></div></section><section class="panel"><div class="panel-head"><div><h2>数据资产边界</h2><p>C001—C003 / C017</p></div></div><div class="boundary-list"><div><b>业务时点</b><span>2025-12-31；预算快照按各版本单独锁定。</span></div><div><b>占用覆盖</b><span>源仅覆盖3/21项目；其余18个占用零值均标记IMPUTED_ZERO，不代表来源确认的真实零。</span></div><div><b>项目累计</b><span>只证明2024-01-01至2025-12-31演示范围。</span></div><div><b>正式消费</b><span>必须等M01完成Published和T019绑定。</span></div></div></section></div>`;
  }

  function renderM01(snapshot) {
    const objects = ["BudgetVersion 预算版本", "BudgetLine 预算行", "ActualFact 实际事实", "Department 部门", "Subject 科目", "Project 项目", "CommitmentEvent 占用事件", "SubmissionEvent 申报事件"];
    return `<div class="module-page"><header class="module-page-head"><div><span>M01 · Ontology Management</span><h1>预算语义、指标、规则和行动类型</h1><p>不按工作簿页签建模；稳定对象和业务事件通过Published版本对外。</p></div><div class="module-actions">${actionButton("应用对象与关系映射", "apply-mapping", snapshot.progress.assetPublished && !snapshot.progress.mappingApplied, "network")}${actionButton("发布S002本体版本", "publish-ontology", snapshot.progress.mappingApplied && !snapshot.progress.ontologyPublished, "publish")}</div></header>
      <div class="semantic-grid"><section class="panel"><div class="panel-head"><div><h2>核心对象与关系</h2><p>真实业务对象，不是工作表名称。</p></div><span class="status-badge ${snapshot.progress.mappingApplied ? "success" : "warning"}">${snapshot.progress.mappingApplied ? "已映射" : "待映射"}</span></div><div class="chip-cloud">${objects.map(function (item) { return `<span>${escapeHtml(item)}</span>`; }).join("")}</div><div class="relation-map"><div>Department</div><i>提交 / 拥有</i><div>BudgetVersion</div><i>包含</i><div>BudgetLine</div><i>比较</i><div>ActualFact</div><i>触发 M03 Rule运行</i><div>RuleHit（M03运行事实）</div></div></section><section class="panel"><div class="panel-head"><div><h2>Published绑定</h2><p>C008 / T019权威指针</p></div><span class="status-badge ${snapshot.progress.ontologyPublished ? "success" : "warning"}">${snapshot.progress.ontologyPublished ? "S002-ONTO-v1" : "待发布"}</span></div><div class="binding-card"><span>Published Ontology</span><strong>${snapshot.progress.ontologyPublished ? "S002-ONTO-v1" : "—"}</strong><small>Data Asset：${snapshot.progress.assetPublished ? "S002-DATA-v1" : "待M02发布"}</small><code>scenarioId=S002 · scenarioVersion=S002-v1</code></div></section></div>
      <section class="panel"><div class="panel-head"><div><h2>Metric候选</h2><p>单位、版本、依赖和证据由M01定义。</p></div><span class="status-badge info">${DATA.metrics.length}项</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>名称</th><th>公式</th><th>单位</th><th>说明</th></tr></thead><tbody>${DATA.metrics.map(function (metric) { return `<tr><td><code>${metric.id}</code></td><td><strong>${escapeHtml(metric.name)}</strong></td><td>${escapeHtml(metric.formula)}</td><td>${escapeHtml(metric.unit)}</td><td>${escapeHtml(metric.note)}</td></tr>`; }).join("")}</tbody></table></div></section>
      <div class="two-col"><section class="panel"><div class="panel-head"><div><h2>Rule候选</h2><p>阈值不下沉至M02。</p></div></div><div class="rule-list">${DATA.rules.map(function (rule) { return `<article><span class="priority ${rule.priority === "高" ? "danger" : "warning"}">${rule.priority}</span><div><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(rule.threshold)} · ${escapeHtml(rule.actionType)}</small></div></article>`; }).join("")}</div></section><section class="panel"><div class="panel-head"><div><h2>Action Type</h2><p>只定义可请求的行动类型，不执行外部变更。</p></div></div><div class="action-type-list">${DATA.actionTypes.map(function (action) { return `<article><strong>${escapeHtml(action.name)}</strong><span>${escapeHtml(action.boundary)}</span></article>`; }).join("")}</div></section></div>`;
  }

  function queryResultMarkup(snapshot) {
    const run = snapshot.queryRuns[snapshot.queryRuns.length - 1];
    if (!run) return `<div class="empty-state">${icon("sparkles", "lg")}<h3>尚未运行预算问数</h3><p>发布S002本体版本后，从左侧选择一个获准问题。</p></div>`;
    let body = "";
    if (Array.isArray(run.result)) {
      const keys = Object.keys(run.result[0] || {});
      body = `<div class="table-wrap"><table class="data-table compact"><thead><tr>${keys.map(function (key) { return `<th>${escapeHtml(key)}</th>`; }).join("")}</tr></thead><tbody>${run.result.map(function (row) { return `<tr>${keys.map(function (key) { const value = row[key]; return `<td>${typeof value === "number" && Math.abs(value) < 4 ? pct(value, 2) : escapeHtml(typeof value === "number" ? fmt(value) : value)}</td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div>`;
    } else {
      body = `<div class="result-facts">${Object.entries(run.result).map(function (entry) { const value = typeof entry[1] === "number" ? (entry[0].toLowerCase().includes("share") ? pct(entry[1], 2) : fmt(entry[1])) : entry[1]; return `<div><span>${escapeHtml(entry[0])}</span><strong>${escapeHtml(value)}</strong></div>`; }).join("")}</div>`;
    }
    return `<div class="answer-card"><header><span>结构化结果</span><strong>${escapeHtml(run.label)}</strong></header><div class="answer-body">${body}</div><footer><span>${escapeHtml(run.runId)}</span><button class="btn" type="button" data-action="open-query-drill">${icon("search", "sm")}下钻证据</button></footer></div>`;
  }

  function renderM03(snapshot) {
    return `<div class="module-page"><header class="module-page-head"><div><span>M03 · Intelligent Query</span><h1>预算问数 Agent</h1><p>固定问题、Prompt与Skill只引用Published Metric/Rule，不在提示词中复制公式。</p></div><div class="module-actions">${actionButton("运行Rule检查", "run-rules", snapshot.progress.queryRun && !snapshot.progress.rulesRun, "target")}</div></header>
      <div class="query-layout"><section class="panel"><div class="panel-head"><div><h2>获准问题</h2><p>C009配置 / C018固定问数视图</p></div><span class="status-badge ${snapshot.progress.ontologyPublished ? "success" : "warning"}">${snapshot.progress.ontologyPublished ? "可运行" : "等待Published"}</span></div><div class="question-list">${DATA.questions.map(function (question) { return `<button type="button" data-action="ask-question" data-question-id="${question.id}" ${snapshot.progress.ontologyPublished ? "" : "disabled"}><span>${icon("sparkles")}</span><strong>${escapeHtml(question.label)}</strong>${icon("chevron", "sm")}</button>`; }).join("")}</div></section><section class="panel query-result"><div class="panel-head"><div><h2>问数运行与结果</h2><p>结果保留数据、本体和T019证据。</p></div><span class="status-badge ${snapshot.progress.queryRun ? "success" : ""}">${snapshot.queryRuns.length}次运行</span></div>${queryResultMarkup(snapshot)}</section></div>
      <section class="panel"><div class="panel-head"><div><h2>Rule运行结果</h2><p>Rule命中仍需转换为标准Action Request草稿；已评估无命中也保留结论。</p></div><span class="status-badge ${snapshot.progress.rulesRun ? "danger" : ""}">${snapshot.ruleHits.length || 0}条命中</span></div><div class="exception-grid">${snapshot.ruleHits.length ? snapshot.ruleHits.map(function (hit) { return `<article class="exception-card"><span class="priority ${hit.priority === "高" ? "danger" : "warning"}">${hit.priority}</span><strong>${escapeHtml(hit.title)}</strong><p>${escapeHtml(hit.subject)} · ${fmt(hit.value, hit.unit === "%" ? 2 : 2)}${escapeHtml(hit.unit)}</p><footer><code>${hit.ruleId}</code><span>${escapeHtml(hit.actionType)}</span></footer></article>`; }).join("") : `<div class="empty-state compact">${icon("target")}<p>运行标准问数后可执行Rule检查。</p></div>`}</div>${snapshot.ruleEvaluations.length ? `<div class="evaluation-list">${snapshot.ruleEvaluations.map(function (evaluation) { return `<article><span class="status-badge success">已评估无命中</span><div><strong>${escapeHtml(evaluation.ruleId)} · 计提差异检查</strong><small>${escapeHtml(evaluation.note)}</small></div><code>最大差异 ${fmt(evaluation.maxAbsoluteVariance)} / 阈值 ${fmt(evaluation.threshold)}${escapeHtml(evaluation.unit)}</code></article>`; }).join("")}</div>` : ""}</section>`;
  }

  function renderM04(snapshot) {
    function requestStatus(request) {
      if (request.status === "confirmed") return { label: "已人工确认", tone: "success", css: "confirmed" };
      if (request.status === "simulated-confirmed") return { label: "回归演练确认", tone: "info", css: "confirmed" };
      if (request.status === "rejected") return { label: "已拒绝", tone: "danger", css: "rejected" };
      return { label: "待确认草稿", tone: "warning", css: "" };
    }
    return `<div class="module-page"><header class="module-page-head"><div><span>M04 · Decision Center</span><h1>Action Request、人工确认与平台内待办</h1><p>Action草稿生成后出现在决策中心；每条请求独立执行接收、确认和待办三次C017读取门。</p></div><div class="module-actions">${actionButton("生成Action Request草稿", "submit-actions", snapshot.progress.rulesRun && !snapshot.progress.actionsDrafted, "target")}</div></header>
      ${boundaryNotice()}
      <section class="panel"><div class="panel-head"><div><h2>决策提醒与行动申请队列</h2><p>正式Rule命中和分析建议分源显示；六类预算行动均保持 not-dispatched。</p></div><span class="status-badge ${snapshot.actionRequests.length ? "warning" : ""}">${snapshot.actionRequests.length}条</span></div><div class="action-queue">${snapshot.actionRequests.length ? snapshot.actionRequests.map(function (request) { const status = requestStatus(request); const todo = snapshot.todos.find(function (item) { return item.requestId === request.requestId; }); return `<article class="action-request ${status.css}"><header><span class="status-badge ${status.tone}">${status.label}</span><code>${escapeHtml(request.requestId)}</code></header><div class="request-source"><span>${request.sourceType === "rule-hit" ? "Rule命中" : "分析建议"}</span><code>${escapeHtml(request.actionTypeId)}</code></div><h3>${escapeHtml(request.actionType)} · ${escapeHtml(request.title)}</h3><p>${escapeHtml(request.department)} · ${escapeHtml(request.subject)}</p><dl><div><dt>外部派发</dt><dd>${escapeHtml(request.externalStatus)}</dd></div><div><dt>负责人</dt><dd>${escapeHtml(request.owner)}</dd></div><div><dt>幂等键</dt><dd><code>${escapeHtml(request.idempotencyKey)}</code></dd></div><div><dt>C017门</dt><dd>${escapeHtml(request.gates.receive.status)} / ${escapeHtml(request.gates.confirm.status)} / ${escapeHtml(request.gates.todo.status)}</dd></div><div><dt>Published</dt><dd>${escapeHtml(request.semanticBinding.dataAssetVersion)} / ${escapeHtml(request.semanticBinding.ontologyVersion)}</dd></div></dl><footer>${request.status === "draft" ? `<button class="btn" type="button" data-action="reject-action" data-request-id="${request.requestId}">${icon("close", "sm")}拒绝</button><button class="btn primary" type="button" data-action="confirm-action" data-request-id="${request.requestId}">${icon("check", "sm")}平台管理员确认</button>` : request.status === "rejected" ? `<span class="rejected-note">${icon("close", "sm")}已拒绝，不生成待办</span>` : request.status === "simulated-confirmed" ? `<span>${icon("shield", "sm")}回归演练已确认，待办副作用被抑制</span>` : `<span>${icon("check", "sm")}${todo ? `待办 ${escapeHtml(todo.todoId)} 已生成` : "确认完成"}</span>`}</footer></article>`; }).join("") : `<div class="empty-state">${icon("target", "lg")}<h3>暂无Action Request</h3><p>先在智能问数中运行正式Rule，再生成平台内草稿与分析建议。</p></div>`}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>负责人待办</h2><p>每个已确认Request独立幂等生成；拒绝和回归演练均不形成真实待办。</p></div><span class="status-badge ${snapshot.todos.length ? "success" : ""}">${snapshot.todos.length}条</span></div><div class="todo-list">${snapshot.todos.length ? snapshot.todos.map(function (todo) { return `<article><span>${icon("check")}</span><div><strong>${escapeHtml(todo.title)}</strong><small>${escapeHtml(todo.todoId)} · ${escapeHtml(todo.owner)} · ${escapeHtml(todo.due)}</small></div><em>${escapeHtml(todo.status)}</em></article>`; }).join("") : `<div class="empty-state compact"><p>等待Action Request被人工确认。</p></div>`}</div></section>`;
  }

  function renderM05(snapshot) {
    const definitions = [
      { id: "budget-anomaly-analyst", name: "预算异常分析 Agent", purpose: "聚合Rule命中、证据和优先级，给出受约束的Action候选。", skills: ["预算差异解释", "异常证据聚合", "行动建议"] },
      { id: "budget-report-drafter", name: "预算报告草稿 Agent", purpose: "消费C018视图和C019决策摘要，形成五主题报告草稿。", skills: ["预算叙事", "主题摘要", "证据引用"] }
    ];
    return `<div class="module-page"><header class="module-page-head"><div><span>M05 · Agent Application</span><h1>受约束的双Agent编排</h1><p>只编排异常分析与报告草稿；不自动确认Action、不创建待办、不发布正式报告。</p></div><div class="module-actions">${actionButton("运行双Agent编排", "run-agents", snapshot.progress.actionsDrafted && !snapshot.progress.agentsRun, "play")}</div></header>
      <div class="agent-grid">${definitions.map(function (agent, index) { const run = snapshot.agentRuns.find(function (item) { return item.agentId === agent.id; }); return `<article class="panel agent-card"><header><span class="agent-number">0${index + 1}</span><span class="status-badge ${run ? "success" : ""}">${run ? "运行完成" : "待运行"}</span></header><h2>${escapeHtml(agent.name)}</h2><p>${escapeHtml(agent.purpose)}</p><div class="chip-cloud">${agent.skills.map(function (skill) { return `<span>${escapeHtml(skill)}</span>`; }).join("")}</div>${run ? `<div class="agent-output"><strong>输出摘要</strong><span>${escapeHtml(run.summary)}</span><code>${escapeHtml(run.runId)}</code></div>` : ""}</article>`; }).join("")}</div>
      <section class="panel"><div class="panel-head"><div><h2>编排边界</h2><p>轻量串联，不建设通用流程或审批引擎。</p></div><span class="status-badge info">C022 / C023</span></div><div class="orchestration"><div><span>Rule运行</span><small>M03提供命中和证据</small></div><i>${icon("arrow")}</i><div><span>异常分析Agent</span><small>M05聚合和解释</small></div><i>${icon("arrow")}</i><div><span>报告草稿Agent</span><small>M05生成草稿</small></div><i>${icon("arrow")}</i><div><span>报告中心</span><small>M06核验和发布</small></div></div></section>`;
  }

  function themeTabs(snapshot) {
    return `<div class="theme-tabs">${DATA.themes.map(function (theme) { return `<button class="${snapshot.activeTheme === theme.id ? "active" : ""}" type="button" data-action="set-theme" data-theme-id="${theme.id}"><span>${escapeHtml(theme.title)}</span><small>${escapeHtml(theme.subtitle)}</small></button>`; }).join("")}</div>`;
  }

  function dashboardData(snapshot, contentSnapshot) {
    const frozen = contentSnapshot && contentSnapshot.c018 && contentSnapshot.c019 ? contentSnapshot : null;
    const view = frozen ? frozen.c018.fixedView || {} : snapshot.queryView || {};
    return {
      annualFacts: view.annualFacts || [],
      submissionFacts: view.submissionFacts || [],
      projects: view.projects || [],
      occupancy: view.occupancy || {},
      expenseDetails: view.expenseDetails || [],
      travelFacts: view.travelFacts || [],
      accrualPairs: view.accrualPairs || [],
      supplierBenchmarks: view.supplierBenchmarks || [],
      legalRecordExplanations: view.legalRecordExplanations || [],
      ruleHits: frozen ? frozen.c018.ruleHits || [] : snapshot.ruleHits || [],
      ruleEvaluations: frozen ? frozen.c018.ruleEvaluations || [] : snapshot.ruleEvaluations || [],
      actionRequests: frozen ? frozen.c019.actionRequests || [] : snapshot.actionRequests || [],
      todos: frozen ? frozen.c019.todos || [] : snapshot.todos || [],
      actionSummary: frozen ? frozen.c019.decisionSummary || null : snapshot.decisionSummary || null
    };
  }

  function snapshotWithContent(snapshot, contentSnapshot) {
    if (!contentSnapshot || !contentSnapshot.c018 || !contentSnapshot.c019) return snapshot;
    return {
      ...snapshot,
      queryView: contentSnapshot.c018.fixedView,
      ruleHits: contentSnapshot.c018.ruleHits || [],
      ruleEvaluations: contentSnapshot.c018.ruleEvaluations || [],
      actionRequests: contentSnapshot.c019.actionRequests || [],
      todos: contentSnapshot.c019.todos || [],
      decisionSummary: contentSnapshot.c019.decisionSummary || null
    };
  }

  function executionTheme(snapshot) {
    const view = dashboardData(snapshot);
    const rows = view.annualFacts.filter(function (row) { return row.year === Number(snapshot.filters.year) && (snapshot.filters.department === "全部" || row.department === snapshot.filters.department); });
    if (!rows.length) return `<div class="empty-state dashboard-empty">${icon("chart", "lg")}<h2>${snapshot.filters.year}年度暂无最终批准预算执行事实</h2><p>本场景的正式执行事实只覆盖2024/2025；2026仅有部门最初申报，不会被静默映射成正式预算执行。</p></div>`;
    const revenueBudget = rows.reduce(function (sum, row) { return sum + row.approvedRevenueBudget; }, 0);
    const revenueActual = rows.reduce(function (sum, row) { return sum + row.actualRevenue; }, 0);
    const expenseBudget = rows.reduce(function (sum, row) { return sum + row.approvedExpenseBudget; }, 0);
    const expenseActual = rows.reduce(function (sum, row) { return sum + row.actualExpense; }, 0);
    const details = view.expenseDetails.filter(function (row) {
      return row.year === Number(snapshot.filters.year) &&
        (snapshot.filters.department === "全部" || row.department === snapshot.filters.department) &&
        (snapshot.filters.subject === "全部" || row.subject === snapshot.filters.subject) &&
        (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
        (snapshot.filters.period === "全年" || row.period === snapshot.filters.period);
    });
    return `<div class="theme-layout"><div class="kpi-grid"><article class="kpi-card ready"><span>费用预算执行率</span><strong>${pct(expenseActual / expenseBudget, 1)}</strong><small>年度/单位总体 · 费用不含税</small></article><article class="kpi-card ${expenseActual > expenseBudget ? "danger" : ""}"><span>实际－预算差异额</span><strong>${fmt(expenseActual - expenseBudget)}</strong><small>年度/单位总体 · MET-008</small></article><article class="kpi-card"><span>成本占收比</span><strong>${pct(expenseActual / revenueActual, 1)}</strong><small>年度/单位总体 · 总成本 / 收入净额</small></article><article class="kpi-card"><span>真正毛利率</span><strong>${pct(1 - expenseActual / revenueActual, 1)}</strong><small>年度/单位总体 · 1 - 成本占收比</small></article></div>
      <div class="boundary-note">${icon("filter")}<div><strong>筛选口径</strong><span>年度和单位影响KPI及汇总；科目、项目和期间继续收窄下方演示明细，避免把费用切片误当成完整收入利润口径。</span></div></div>
      <section class="panel"><div class="panel-head"><div><h2>${snapshot.filters.year}年度单位执行与差异</h2><p>单位汇总可下钻至科目、项目、期间及Published证据。</p></div><span class="status-badge info">${fmt(revenueActual)}收入 / ${fmt(expenseActual)}费用</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>单位/部门</th><th>收入预算</th><th>收入实际</th><th>收入差异</th><th>费用预算</th><th>费用实际</th><th>费用差异</th><th>执行率</th><th>真正毛利率</th><th>数据标识</th></tr></thead><tbody>${rows.map(function (row) { return `<tr class="drill-row" data-action="open-drill" data-drill-kind="department" data-drill-key="${escapeHtml(row.department)}"><td><strong>${escapeHtml(row.department)}</strong></td><td>${fmt(row.approvedRevenueBudget)}</td><td>${fmt(row.actualRevenue)}</td><td class="${row.actualRevenue - row.approvedRevenueBudget < 0 ? "danger-text" : ""}">${fmt(row.actualRevenue - row.approvedRevenueBudget)}</td><td>${fmt(row.approvedExpenseBudget)}</td><td>${fmt(row.actualExpense)}</td><td class="${row.actualExpense - row.approvedExpenseBudget > 0 ? "danger-text" : ""}">${fmt(row.actualExpense - row.approvedExpenseBudget)}</td><td>${pct(row.expenseRate, 1)}</td><td>${pct(row.grossMargin, 1)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section>
      <section class="panel"><div class="panel-head"><div><h2>科目 × 项目 × 期间下钻明细</h2><p>年度部门总额可回链；分摊明细逐行标识为演示补全，不冒充来源记录。</p></div><span class="status-badge ${details.length ? "success" : "warning"}">${details.length}行</span></div>${details.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>期间</th><th>单位/部门</th><th>科目</th><th>项目</th><th>批准预算</th><th>实际</th><th>差异额</th><th>执行率</th><th>数据标识</th></tr></thead><tbody>${details.map(function (row) { return `<tr><td>${escapeHtml(row.periodName)}</td><td>${escapeHtml(row.department)}</td><td>${escapeHtml(row.subject)}</td><td><code>${escapeHtml(row.projectId || "—")}</code></td><td>${fmt(row.approvedBudget)}</td><td>${fmt(row.actual)}</td><td class="${row.variance > 0 ? "danger-text" : ""}">${fmt(row.variance)}</td><td>${pct(row.executionRate, 1)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty-state compact"><p>当前科目、项目和期间组合没有演示明细。</p></div>`}</section></div>`;
  }

  function submissionTheme(snapshot) {
    const view = dashboardData(snapshot);
    const rows = view.submissionFacts.filter(function (row) { return row.year === Number(snapshot.filters.year) && (snapshot.filters.department === "全部" || row.department === snapshot.filters.department); });
    if (!rows.length) return `<div class="empty-state dashboard-empty">${icon("file", "lg")}<h2>${snapshot.filters.year}年度没有初始申报快照</h2><p>本场景仅覆盖2025/2026部门最初申报；不会把2024最终批准预算静默映射为申报。</p></div>`;
    return `<div class="theme-layout"><div class="submission-cards">${rows.map(function (row) { return `<article><header><strong>${escapeHtml(row.department)}</strong><span>${row.year}初始申报</span></header><div><span>申报收入净额</span><b>${fmt(row.revenue)}</b></div><div><span>项目成本</span><b>${fmt(row.projectCost)}</b></div><div><span>技术配置</span><b>${fmt(row.techCost)}</b></div><div><span>公共费用 ${row.fieldMarkers?.publicExpense ? markerBadge(row.fieldMarkers.publicExpense) : ""}</span><b>${fmt(row.publicExpense)}</b></div><div><span>申报总成本</span><b>${fmt(row.totalCost)}</b></div><div><span>成本占收比</span><b class="${row.costToRevenue > 1 ? "danger-text" : ""}">${pct(row.costToRevenue, 1)}</b></div><div><span>真正毛利率</span><b class="${row.grossMargin < 0 ? "danger-text" : ""}">${pct(row.grossMargin, 1)}</b></div><footer>${markerBadge(row.dataMarker)}${markerBadge(row.fieldMarkers?.calculatedMetrics || "DERIVED")}<code>${escapeHtml(row.version)}</code></footer><button class="btn" type="button" data-action="open-drill" data-drill-kind="submission" data-drill-key="${escapeHtml(row.department)}">查看项目与技术配置</button></article>`; }).join("")}</div><div class="boundary-note">${icon("info")}<div><strong>版本不可混用</strong><span>2025/2026申报属于部门最初申报，不能与2024/2025最终批准预算相加或替代；2026仅公共费用补全为演示值，来源字段和派生指标分别标识。</span></div></div></div>`;
  }

  function balanceTheme(snapshot) {
    const view = dashboardData(snapshot);
    const anomalyProjectIds = new Set((view.actionRequests || []).filter(function (request) {
      return snapshot.filters.anomaly === "全部" || request.actionTypeId === snapshot.filters.anomaly;
    }).map(function (request) {
      return (view.projects || []).find(function (project) { return String(request.subject || "").includes(project.projectId); })?.projectId;
    }).filter(Boolean));
    const rows = view.projects.filter(function (row) {
      return recordYears(row).includes(Number(snapshot.filters.year)) &&
        (snapshot.filters.department === "全部" || row.department === snapshot.filters.department) &&
        (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
        (snapshot.filters.anomaly === "全部" || anomalyProjectIds.has(row.projectId));
    }).sort(function (a, b) { return a.availableBalance - b.availableBalance; });
    if (!rows.length) return `<div class="empty-state dashboard-empty">${icon("layers", "lg")}<h2>当前筛选下没有项目余额事实</h2><p>项目余额统一锁定在2025-12-31快照，年度筛选按项目编号中的立项年度解释；2026没有项目级余额来源，本场景也不涉及项目级预算下达。</p></div>`;
    const launchTotal = rows.reduce(function (sum, row) { return sum + row.approvedAmount; }, 0);
    const recalculatedUsed = rows.reduce(function (sum, row) { return sum + row.recalculatedUsed; }, 0);
    const availableTotal = rows.reduce(function (sum, row) { return sum + row.availableBalance; }, 0);
    const negativeRows = rows.filter(function (row) { return row.availableBalance < 0; });
    const occupancyRows = (view.occupancy.byProject || []).filter(function (row) {
      return recordYears(row).includes(Number(snapshot.filters.year)) &&
        (snapshot.filters.department === "全部" || row.department === snapshot.filters.department) &&
        (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
        (snapshot.filters.anomaly === "全部" || anomalyProjectIds.has(row.projectId));
    });
    const occupancyEvents = (view.occupancy.examples || []).filter(function (row) {
      const month = Number(String(row.month || "").slice(-2));
      const periodMatch = snapshot.filters.period === "全年" ||
        (snapshot.filters.period === "Q1" && month <= 3) ||
        (snapshot.filters.period === "Q2" && month >= 4 && month <= 6) ||
        (snapshot.filters.period === "Q3" && month >= 7 && month <= 9) ||
        (snapshot.filters.period === "Q4" && month >= 10);
      return String(row.month || "").startsWith(String(snapshot.filters.year)) && periodMatch &&
        (snapshot.filters.department === "全部" || row.department === snapshot.filters.department) &&
        (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
        (snapshot.filters.anomaly === "全部" || anomalyProjectIds.has(row.projectId));
    });
    const fullOccupancyScope = Number(snapshot.filters.year) === 2025 && snapshot.filters.department === "全部" && snapshot.filters.project === "全部" && snapshot.filters.anomaly === "全部";
    const occupancyNet = fullOccupancyScope ? view.occupancy.netInTransit : occupancyRows.reduce(function (sum, row) { return sum + row.netInTransit; }, 0);
    const positivePr = fullOccupancyScope ? view.occupancy.totalPositivePr : occupancyRows.reduce(function (sum, row) { return sum + row.positivePr; }, 0);
    const decemberPositivePr = fullOccupancyScope ? view.occupancy.decemberPositivePr : occupancyRows.reduce(function (sum, row) { return sum + row.positivePr * row.decemberShare; }, 0);
    const decemberNet = fullOccupancyScope ? view.occupancy.budgetOccupancyDecemberAmount : occupancyRows.reduce(function (sum, row) { return sum + row.decemberNetInTransit; }, 0);
    return `<div class="theme-layout"><div class="kpi-grid"><article class="kpi-card ready"><span>立项金额合计</span><strong>${fmt(launchTotal)}</strong><small>${rows.length}个项目</small></article><article class="kpi-card"><span>重算已使用</span><strong>${fmt(recalculatedUsed)}</strong><small>实际+净在途+未结计提</small></article><article class="kpi-card"><span>可用余额合计</span><strong>${fmt(availableTotal)}</strong><small>2025-12-31</small></article><article class="kpi-card ${negativeRows.length ? "danger" : "ready"}"><span>超立项余额</span><strong>${negativeRows.length}</strong><small>${negativeRows.length ? `${fmt(negativeRows.reduce(function (sum, row) { return sum + row.availableBalance; }, 0))}万元` : "无负余额"}</small></article></div>
      <div class="boundary-note">${icon("filter")}<div><strong>固定快照筛选</strong><span>年度按项目立项年度筛选，余额仍是2025-12-31确认快照；期间只过滤采购/释放事件，异常事项只保留可回链到项目的Action。</span></div></div>
      <section class="panel"><div class="panel-head"><div><h2>项目可用立项余额</h2><p>点击项目下钻到实际、在途占用、计提、重算差异和来源证据。</p></div><span class="status-badge info">项目级下达不在本场景</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>项目编号</th><th>单位/部门</th><th>项目</th><th>立项金额</th><th>累计实际</th><th>净在途</th><th>未结计提</th><th>源已使用</th><th>重算差异</th><th>可用余额</th><th>占用标识</th></tr></thead><tbody>${rows.map(function (row) { return `<tr class="drill-row" data-action="open-drill" data-drill-kind="project" data-drill-key="${row.projectId}"><td><code>${escapeHtml(row.projectId)}</code></td><td>${escapeHtml(row.department)}</td><td>${escapeHtml(row.name)}</td><td>${fmt(row.approvedAmount)}</td><td>${fmt(row.actualUsed)}</td><td>${fmt(row.netInTransit)}</td><td>${fmt(row.accrual)}</td><td>${fmt(row.sourceUsedAmount)}</td><td class="${Math.abs(row.usedAmountVariance) > 0.0001 ? "warning-text" : ""}">${fmt(row.usedAmountVariance)}</td><td class="${row.availableBalance < 0 ? "danger-text" : ""}">${fmt(row.availableBalance)}</td><td>${markerBadge(row.netInTransitDataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section>
      <div class="kpi-grid occupancy-kpis"><article class="kpi-card ready"><span>正向采购发起量</span><strong>${fmt(positivePr)}</strong><small>MET-004 · 万元</small></article><article class="kpi-card"><span>12月正向采购发起占比</span><strong>${pct(positivePr ? decemberPositivePr / positivePr : null, 2)}</strong><small>12月正向PR / 全年正向PR</small></article><article class="kpi-card"><span>净在途占用</span><strong>${fmt(occupancyNet)}</strong><small>MET-003 · 源覆盖3/21项目</small></article><article class="kpi-card ${occupancyNet && decemberNet / occupancyNet >= .15 ? "danger" : ""}"><span>年末预算占用集中度</span><strong>${pct(occupancyNet ? decemberNet / occupancyNet : null, 2)}</strong><small>12月净在途 / 全年净在途</small></article></div>
      <div class="two-col dashboard-detail-columns"><section class="panel"><div class="panel-head"><div><h2>项目采购/占用双口径</h2><p>采购发起和预算占用分别使用同口径年度分母。</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>项目</th><th>正向PR</th><th>12月PR占比</th><th>净在途</th><th>12月净在途</th><th>占用集中度</th><th>标识</th></tr></thead><tbody>${occupancyRows.map(function (row) { return `<tr><td><code>${escapeHtml(row.projectId)}</code><small>${escapeHtml(row.department)}</small></td><td>${fmt(row.positivePr)}</td><td>${pct(row.decemberShare, 2)}</td><td>${fmt(row.netInTransit)}</td><td>${fmt(row.decemberNetInTransit)}</td><td class="${row.budgetOccupancyDecemberShare >= .15 ? "danger-text" : ""}">${pct(row.budgetOccupancyDecemberShare, 2)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h2>采购占用事件明细</h2><p>正向发起和负向释放均保留事件符号与演示标识。</p></div><span class="status-badge info">${occupancyEvents.length}条示例</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>期间</th><th>事件</th><th>项目</th><th>PR/PO</th><th>金额</th><th>标识</th></tr></thead><tbody>${occupancyEvents.map(function (row) { return `<tr><td>${escapeHtml(row.month)}</td><td>${escapeHtml(row.type)}</td><td><code>${escapeHtml(row.projectId)}</code></td><td>${escapeHtml(row.pr || "—")} / ${escapeHtml(row.po || "—")}</td><td class="${row.amount < 0 ? "success-text" : ""}">${fmt(row.amount)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section></div></div>`;
  }

  function anomalyTheme(snapshot) {
    const view = dashboardData(snapshot);
    const requests = (view.actionRequests || []).filter(function (request) {
      return recordMatchesFilters(request, snapshot);
    });
    const todos = view.todos || [];
    const filteredTodos = todos.filter(function (todo) { return requests.some(function (request) { return request.requestId === todo.requestId; }); });
    const confirmed = requests.filter(confirmedStatus).length;
    const rejected = requests.filter(function (item) { return item.status === "rejected"; }).length;
    const filteredRuleHits = (view.ruleHits || []).filter(function (hit) { return recordMatchesFilters(hit, snapshot); });
    const accrualPairs = view.accrualPairs.filter(function (row) {
      return [2024, 2025].includes(Number(snapshot.filters.year)) &&
        (snapshot.filters.department === "全部" || row.department === snapshot.filters.department) &&
        (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
        (snapshot.filters.subject === "全部" || snapshot.filters.subject === "项目实施成本") &&
        snapshot.filters.period === "全年" &&
        (snapshot.filters.anomaly === "全部" || snapshot.filters.anomaly === "ACT-RELEASE-COMMITMENT");
    });
    const supplierRows = view.supplierBenchmarks.filter(function (row) {
      return row.year === Number(snapshot.filters.year) &&
        (snapshot.filters.department === "全部" || row.department === snapshot.filters.department) &&
        (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
        (snapshot.filters.subject === "全部" || snapshot.filters.subject === "技术配置费") &&
        snapshot.filters.period === "全年" &&
        (snapshot.filters.anomaly === "全部" || snapshot.filters.anomaly === "ACT-PRICE-REVIEW");
    });
    return `<div class="theme-layout"><div class="kpi-grid"><article class="kpi-card ${filteredRuleHits.length ? "danger" : "ready"}"><span>Rule命中</span><strong>${filteredRuleHits.length}</strong><small>当前筛选 · D082正式Rule</small></article><article class="kpi-card ready"><span>已评估无命中</span><strong>${accrualPairs.length ? 1 : 0}</strong><small>RULE-003 · ${accrualPairs.length}对计提</small></article><article class="kpi-card"><span>Action申请</span><strong>${requests.length}</strong><small>${confirmed}确认 / ${rejected}拒绝</small></article><article class="kpi-card ready"><span>内部待办</span><strong>${filteredTodos.length}</strong><small>确认后幂等形成</small></article></div>
      <section class="panel"><div class="panel-head"><div><h2>异常识别 → Action草稿 → 人工决策</h2><p>M06按六维筛选只读展示Rule命中与分析建议；六类Action均不对外派发。</p></div><button class="btn" type="button" data-route="#module/decision">前往决策中心</button></div><div class="action-report-table">${requests.length ? requests.map(function (request) { const hit = view.ruleHits.find(function (item) { return item.id === request.sourceId; }); const todo = filteredTodos.find(function (item) { return item.requestId === request.requestId; }); const label = confirmedStatus(request) ? "已确认" : request.status === "rejected" ? "已拒绝" : "待确认草稿"; return `<article><header><span class="status-badge ${confirmedStatus(request) ? "success" : request.status === "rejected" ? "danger" : "warning"}">${label}</span><code>${escapeHtml(request.actionTypeId)}</code></header><h3>${escapeHtml(request.actionType)} · ${escapeHtml(request.title)}</h3><p>${escapeHtml(request.department)} · ${escapeHtml(request.subject)}</p><dl><div><dt>来源</dt><dd>${request.sourceType === "rule-hit" ? `Rule命中 ${escapeHtml(request.ruleId)}` : "分析建议"}</dd></div><div><dt>事实/基准</dt><dd>${hit ? `${fmt(hit.value, 2)}${escapeHtml(hit.unit)}${hit.denominator ? ` · ${fmt(hit.numerator)}/${fmt(hit.denominator)}` : ""}${hit.baselinePrice ? ` · 基准${fmt(hit.baselinePrice, 0)}` : ""}` : "建议项不登记为正式Rule命中"}</dd></div><div><dt>外部派发</dt><dd>${escapeHtml(request.externalStatus)}</dd></div><div><dt>待办</dt><dd>${todo ? escapeHtml(todo.todoId) : "未形成"}</dd></div></dl><footer>${markerBadge(request.dataMarker)}<span>${request.gates.receive.status} / ${request.gates.confirm.status} / ${request.gates.todo.status}</span><button class="btn" type="button" data-action="open-drill" data-drill-kind="action" data-drill-key="${escapeHtml(request.requestId)}">查看证据</button></footer></article>`; }).join("") : `<div class="empty-state compact"><p>当前六维筛选下没有Action申请。</p></div>`}</div></section>
      <div class="two-col dashboard-detail-columns"><section class="panel"><div class="panel-head"><div><h2>跨年计提配对</h2><p>${accrualPairs.length}组满足当前筛选，均完成计提与冲回/结算配对，最大差异0万元。</p></div><span class="status-badge success">RULE-003 ${accrualPairs.length ? "已评估无命中" : "当前筛选无配对"}</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>配对ID</th><th>单位/部门</th><th>项目</th><th>2024计提</th><th>2025结算</th><th>差异</th><th>结论</th><th>标识</th></tr></thead><tbody>${accrualPairs.map(function (row) { return `<tr><td><code>${escapeHtml(row.pairId)}</code></td><td>${escapeHtml(row.department)}</td><td><code>${escapeHtml(row.projectId)}</code></td><td>${fmt(row.accrualAmount)}</td><td>${fmt(row.settledAmount)}</td><td>${fmt(row.variance)}</td><td><span class="status-badge success">${escapeHtml(row.status)}</span></td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h2>全场景合法记录与授权修正解释</h2><p>质量解释不参与业务维度筛选，也不触发预算Action。</p></div></div><div class="quality-list">${view.legalRecordExplanations.map(function (row) { return `<div><span>${escapeHtml(row.issue)} · ${row.count}项</span><strong>${escapeHtml(row.classification)}</strong><small>${escapeHtml(row.handling)} ${markerBadge(row.dataMarker)}</small></div>`; }).join("")}</div></section></div>
      <section class="panel"><div class="panel-head"><div><h2>供应商单人月价格复核</h2><p>按年度、服务类别、级别、单位、税率和服务月数构造可比组；只生成复核待办。</p></div><span class="status-badge info">${supplierRows.length}条可比事实</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>年度</th><th>单位/部门</th><th>项目</th><th>供应商</th><th>类别/级别</th><th>服务月数</th><th>税率</th><th>单价</th><th>中位价</th><th>倍率</th><th>判定</th><th>标识</th></tr></thead><tbody>${supplierRows.map(function (row) { return `<tr><td>${row.year}</td><td>${escapeHtml(row.department)}</td><td><code>${escapeHtml(row.projectId)}</code></td><td>${escapeHtml(row.supplier)}</td><td>${escapeHtml(row.category)} / ${escapeHtml(row.level)}</td><td>${row.serviceMonths}</td><td>${escapeHtml(row.taxRate)}</td><td>${fmt(row.unitPrice, 0)}</td><td>${fmt(row.cohortMedian, 0)}</td><td class="${row.priceRatio >= 1.2 ? "danger-text" : ""}">${fmt(row.priceRatio, 2)}倍</td><td>${escapeHtml(row.status)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section></div>`;
  }

  function trendTheme(snapshot) {
    const view = dashboardData(snapshot);
    const departments = DATA.departments.filter(function (department) { return snapshot.filters.department === "全部" || department.name === snapshot.filters.department; });
    const travelRows = view.travelFacts.filter(function (row) { return snapshot.filters.department === "全部" || row.department === snapshot.filters.department; });
    return `<div class="theme-layout"><div class="boundary-note">${icon("lock")}<div><strong>固定跨年比较窗口</strong><span>本主题锁定2024→2025，年度、科目、项目、期间和异常筛选停用；只允许按单位查看可解释趋势。</span></div></div><div class="trend-grid">${departments.map(function (department) { const y24 = view.annualFacts.find(function (row) { return row.year === 2024 && row.department === department.name; }); const y25 = view.annualFacts.find(function (row) { return row.year === 2025 && row.department === department.name; }); return `<article><header><strong>${escapeHtml(department.name)}</strong><span>${escapeHtml(y25.trend)}</span></header><div class="trend-values"><div><span>收入</span><b>${fmt(y24.actualRevenue)} → ${fmt(y25.actualRevenue)}</b><em class="${y25.revenueYoY < 0 ? "down" : "up"}">${pct(y25.revenueYoY, 1)}</em></div><div><span>费用</span><b>${fmt(y24.actualExpense)} → ${fmt(y25.actualExpense)}</b><em class="${y25.expenseYoY < 0 ? "down" : "up"}">${pct(y25.expenseYoY, 1)}</em></div><div><span>成本占收比</span><b>${pct(y24.costToRevenue, 1)} → ${pct(y25.costToRevenue, 1)}</b><em class="${y25.costToRevenue > y24.costToRevenue ? "down" : "up"}">${pct(y25.costToRevenue - y24.costToRevenue, 1)}</em></div></div><p>${escapeHtml(y25.note)} ${markerBadge(y25.dataMarker)}</p><button class="btn" type="button" data-action="open-drill" data-drill-kind="trend" data-drill-key="${escapeHtml(department.name)}">查看跨年证据</button></article>`; }).join("")}</div>
      <section class="panel"><div class="panel-head"><div><h2>差旅与业务支持跨年对比</h2><p>2024差旅补全为演示数据；2025汇总为派生视图，均不得冒充来源原始明细。</p></div><span class="status-badge info">单位对比</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>年度</th><th>单位/部门</th><th>出差批次</th><th>人天</th><th>金额</th><th>单次均额</th><th>主要目的地/场景</th><th>同比</th><th>标识</th></tr></thead><tbody>${travelRows.map(function (row) { const prior = view.travelFacts.find(function (item) { return item.year === row.year - 1 && item.department === row.department; }); return `<tr><td>${row.year}</td><td>${escapeHtml(row.department)}</td><td>${row.tripCount}</td><td>${row.personDays}</td><td>${fmt(row.amount)}</td><td>${fmt(row.averagePerTrip)}</td><td>${escapeHtml(row.topDestination)}</td><td>${prior ? pct(row.amount / prior.amount - 1, 1) : "基期"}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section>
      <div class="boundary-note">${icon("info")}<div><strong>月度收入解释限制</strong><span>源数据收入确认集中于6月；收入主要按年度×部门展示，月度趋势优先用于费用、占用和采购发起。</span></div></div></div>`;
  }

  function dashboardTheme(snapshot, contentSnapshot) {
    const projected = snapshotWithContent(snapshot, contentSnapshot);
    if (projected.activeTheme === "submission") return submissionTheme(projected);
    if (projected.activeTheme === "balance") return balanceTheme(projected);
    if (projected.activeTheme === "anomaly") return anomalyTheme(projected);
    if (projected.activeTheme === "trend") return trendTheme(projected);
    return executionTheme(projected);
  }

  function filtersMarkup(snapshot) {
    const enabled = filterApplicability(snapshot.activeTheme);
    const disabled = function (key) { return enabled.has(key) ? "" : "disabled aria-disabled=\"true\""; };
    const notes = {
      execution: "年度/单位影响汇总；科目/项目/期间影响明细",
      submission: "初始申报仅按年度与单位筛选",
      balance: "余额按立项年度；期间只影响占用事件",
      anomaly: "六维筛选均生效",
      trend: "固定比较2024→2025，仅单位筛选生效"
    };
    return `<div class="dashboard-filters"><small class="filter-scope-note">${escapeHtml(notes[snapshot.activeTheme] || notes.execution)}</small><label><span>年度</span><select data-filter-key="year" ${disabled("year")}><option value="2024" ${snapshot.filters.year === 2024 ? "selected" : ""}>2024</option><option value="2025" ${snapshot.filters.year === 2025 ? "selected" : ""}>2025</option><option value="2026" ${snapshot.filters.year === 2026 ? "selected" : ""}>2026</option></select></label><label><span>单位/部门</span><select data-filter-key="department" ${disabled("department")}><option value="全部" ${snapshot.filters.department === "全部" ? "selected" : ""}>全部</option>${DATA.departments.map(function (department) { return `<option value="${department.name}" ${snapshot.filters.department === department.name ? "selected" : ""}>${department.name}</option>`; }).join("")}</select></label><label><span>科目</span><select data-filter-key="subject" ${disabled("subject")}><option value="全部" ${snapshot.filters.subject === "全部" ? "selected" : ""}>全部</option>${DATA.expenseSubjects.map(function (subject) { return `<option value="${subject}" ${snapshot.filters.subject === subject ? "selected" : ""}>${subject}</option>`; }).join("")}</select></label><label><span>项目</span><select data-filter-key="project" ${disabled("project")}><option value="全部" ${snapshot.filters.project === "全部" ? "selected" : ""}>全部</option>${DATA.projects.map(function (project) { return `<option value="${project.projectId}" ${snapshot.filters.project === project.projectId ? "selected" : ""}>${project.projectId}</option>`; }).join("")}</select></label><label><span>期间</span><select data-filter-key="period" ${disabled("period")}><option value="全年" ${snapshot.filters.period === "全年" ? "selected" : ""}>全年</option>${DATA.expensePeriods.map(function (period) { return `<option value="${period.id}" ${snapshot.filters.period === period.id ? "selected" : ""}>${period.name}</option>`; }).join("")}</select></label><label><span>异常事项</span><select data-filter-key="anomaly" ${disabled("anomaly")}><option value="全部" ${snapshot.filters.anomaly === "全部" ? "selected" : ""}>全部</option>${DATA.actionTypes.map(function (action) { return `<option value="${action.id}" ${snapshot.filters.anomaly === action.id ? "selected" : ""}>${action.name}</option>`; }).join("")}</select></label><span class="status-badge info">${DATA.scenario.currency} · ${DATA.scenario.unit}</span></div>`;
  }

  function reportDraftMarkup(snapshot) {
    const report = snapshot.reports[snapshot.reports.length - 1];
    if (!report) return `<section class="report-draft-shell"><div class="consume-gate">${icon("file", "lg")}<h2>预算报告草稿尚未形成</h2><p>完成双Agent编排后生成报告草稿；报告中心不会把驾驶舱发布冒充T049正式报告。</p></div></section>`;
    const view = dashboardData(snapshot, report.contentSnapshot);
    const sections = report.departmentSections || [];
    return `<section class="report-draft-shell"><header class="report-draft-head"><div><span>M06 · Report Draft</span><h2>${escapeHtml(report.title || "S002预算监督管理分析报告草稿")}</h2><p>${escapeHtml(report.disclaimer || "")}</p></div><div><span class="status-badge warning">DRAFT · 非T049</span><code>${escapeHtml(report.reportId)}</code></div></header>
      <div class="boundary-note">${icon("lock")}<div><strong>报告内容投影已锁定</strong><span>正文绑定 ${escapeHtml(report.contentSnapshot?.c018?.contractId || "C018-S002-v1")} / ${escapeHtml(report.contentSnapshot?.c019?.contractId || "C019-S002-v1")}；下方驾驶舱筛选和后续Action变化不会静默改写本报告ID。</span></div></div>
      <nav class="report-toc" aria-label="报告目录">${["集团预算执行", "初始申报", "项目余额与采购占用", "差旅与计提", "供应商价格", "异常与Action"].map(function (item, index) { return `<span><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(item)}</span>`; }).join("")}</nav>
      <section class="panel report-group-overview"><div class="panel-head"><div><h2>集团预算执行与申报总览</h2><p>正式下达与最初申报分版本展示，不合并替代。</p></div><span class="status-badge info">C018 / C019</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>年度</th><th>单位/部门</th><th>事实类型</th><th>收入</th><th>成本/费用</th><th>执行率/成本占收比</th><th>真正毛利率</th><th>版本</th><th>数据标识</th></tr></thead><tbody>${view.annualFacts.map(function (row) { return `<tr><td>${row.year}</td><td>${escapeHtml(row.department)}</td><td>最终批准预算执行</td><td>${fmt(row.actualRevenue)} / ${fmt(row.approvedRevenueBudget)}</td><td>${fmt(row.actualExpense)} / ${fmt(row.approvedExpenseBudget)}</td><td>${pct(row.expenseRate, 1)}</td><td>${pct(row.grossMargin, 1)}</td><td><code>FY${row.year}-APPROVED-FINAL-v1</code></td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}${view.submissionFacts.map(function (row) { return `<tr><td>${row.year}</td><td>${escapeHtml(row.department)}</td><td>部门最初申报</td><td>${fmt(row.revenue)}</td><td>${fmt(row.totalCost)}</td><td>${pct(row.costToRevenue, 1)}</td><td>${pct(row.grossMargin, 1)}</td><td><code>${escapeHtml(row.version)}</code></td><td>${markerBadge(row.dataMarker)} ${row.fieldMarkers?.publicExpense ? markerBadge(row.fieldMarkers.publicExpense) : ""}</td></tr>`; }).join("")}</tbody></table></div></section>
      <div class="department-report-list">${sections.map(function (section) {
        const y24 = view.annualFacts.find(function (row) { return row.year === 2024 && row.department === section.department; });
        const y25 = view.annualFacts.find(function (row) { return row.year === 2025 && row.department === section.department; });
        const s25 = view.submissionFacts.find(function (row) { return row.year === 2025 && row.department === section.department; });
        const s26 = view.submissionFacts.find(function (row) { return row.year === 2026 && row.department === section.department; });
        const projects = view.projects.filter(function (row) { return row.department === section.department; }).sort(function (a, b) { return a.availableBalance - b.availableBalance; });
        const travel = view.travelFacts.filter(function (row) { return row.department === section.department; });
        const occupancy = (view.occupancy.byProject || []).filter(function (row) { return row.department === section.department; });
        const supplier = view.supplierBenchmarks.filter(function (row) { return row.department === section.department; });
        const requests = view.actionRequests.filter(function (row) { return row.department === section.department; });
        const positivePr = occupancy.reduce(function (sum, row) { return sum + row.positivePr; }, 0);
        const decemberPositivePr = occupancy.reduce(function (sum, row) { return sum + row.positivePr * row.decemberShare; }, 0);
        const netInTransit = occupancy.reduce(function (sum, row) { return sum + row.netInTransit; }, 0);
        const decemberNetInTransit = occupancy.reduce(function (sum, row) { return sum + row.decemberNetInTransit; }, 0);
        return `<article class="department-report"><header><div><span>单位预算监督分析</span><h2>${escapeHtml(section.department)}</h2><p>预算执行、初始申报、项目余额、差旅、计提、年末占用、供应商价格与Action一体展示。</p></div><span class="status-badge info">${section.dataMarker}</span></header>
          <div class="report-metric-grid"><div><span>2025费用执行率</span><strong>${pct(y25.expenseRate, 1)}</strong><small>${fmt(y25.actualExpense)} / ${fmt(y25.approvedExpenseBudget)}</small></div><div><span>2025成本占收比</span><strong>${pct(y25.costToRevenue, 1)}</strong><small>真正毛利率 ${pct(y25.grossMargin, 1)}</small></div><div><span>2026初始申报</span><strong>${fmt(s26.totalCost)}</strong><small>成本占收比 ${pct(s26.costToRevenue, 1)}</small></div><div><span>项目可用余额</span><strong>${fmt(projects.reduce(function (sum, row) { return sum + row.availableBalance; }, 0))}</strong><small>${projects.filter(function (row) { return row.availableBalance < 0; }).length}个负余额</small></div><div><span>计提配对</span><strong>${section.accrualPairCount}</strong><small>异常0 · RULE-003无命中</small></div><div><span>Action</span><strong>${requests.length}</strong><small>${requests.filter(confirmedStatus).length}确认 / ${requests.filter(function (row) { return row.status === "rejected"; }).length}拒绝</small></div></div>
          <div class="report-section-grid"><section><h3>预算执行与跨年趋势</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>年度</th><th>收入实际/预算</th><th>费用实际/预算</th><th>费用差异</th><th>标识</th></tr></thead><tbody>${[y24, y25].map(function (row) { return `<tr><td>${row.year}</td><td>${fmt(row.actualRevenue)} / ${fmt(row.approvedRevenueBudget)}</td><td>${fmt(row.actualExpense)} / ${fmt(row.approvedExpenseBudget)}</td><td>${fmt(row.actualExpense - row.approvedExpenseBudget)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div><p>${escapeHtml(y25.note)} ${markerBadge(y25.fieldMarkers?.trendExplanation)}</p></section>
            <section><h3>初始申报与成本结构</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>年度</th><th>收入</th><th>项目成本</th><th>技术配置</th><th>公共费用</th><th>成本占收比</th><th>标识</th></tr></thead><tbody>${[s25, s26].map(function (row) { return `<tr><td>${row.year}</td><td>${fmt(row.revenue)}</td><td>${fmt(row.projectCost)}</td><td>${fmt(row.techCost)}</td><td>${fmt(row.publicExpense)} ${row.fieldMarkers?.publicExpense ? markerBadge(row.fieldMarkers.publicExpense) : ""}</td><td>${pct(row.costToRevenue, 1)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div></section>
            <section><h3>项目余额与采购占用</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>项目</th><th>立项</th><th>重算已用</th><th>可用余额</th><th>标识</th></tr></thead><tbody>${projects.map(function (row) { return `<tr><td><code>${escapeHtml(row.projectId)}</code></td><td>${fmt(row.approvedAmount)}</td><td>${fmt(row.recalculatedUsed)}</td><td class="${row.availableBalance < 0 ? "danger-text" : ""}">${fmt(row.availableBalance)}</td><td>${markerBadge(row.netInTransitDataMarker)}</td></tr>`; }).join("")}</tbody></table></div><p>正向PR ${fmt(positivePr)}万元；12月正向PR占比 ${pct(positivePr ? decemberPositivePr / positivePr : null, 2)}；净在途 ${fmt(netInTransit)}万元；年末预算占用集中度 ${pct(netInTransit ? decemberNetInTransit / netInTransit : null, 2)}。${occupancy.length ? markerBadge(occupancy[0].dataMarker) : ""}</p></section>
            <section><h3>差旅与计提</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>年度</th><th>差旅批次</th><th>人天</th><th>金额</th><th>标识</th></tr></thead><tbody>${travel.map(function (row) { return `<tr><td>${row.year}</td><td>${row.tripCount}</td><td>${row.personDays}</td><td>${fmt(row.amount)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div><p>${section.accrualPairCount}组计提均已配对，最大差异0万元。</p></section>
            <section><h3>供应商价格复核</h3>${supplier.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>供应商</th><th>级别</th><th>单价</th><th>中位价</th><th>倍率</th><th>状态</th><th>标识</th></tr></thead><tbody>${supplier.map(function (row) { return `<tr><td>${escapeHtml(row.supplier)}</td><td>${escapeHtml(row.level)}</td><td>${fmt(row.unitPrice, 0)}</td><td>${fmt(row.cohortMedian, 0)}</td><td>${fmt(row.priceRatio, 2)}倍</td><td>${escapeHtml(row.status)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div>` : `<p>当前单位无可比供应商价格事实。</p>`}</section>
            <section><h3>异常与Action状态</h3>${requests.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>Action</th><th>异常/建议</th><th>状态</th><th>外部派发</th><th>标识</th></tr></thead><tbody>${requests.map(function (row) { return `<tr><td>${escapeHtml(row.actionType)}</td><td>${escapeHtml(row.title)}</td><td>${confirmedStatus(row) ? "已确认" : row.status === "rejected" ? "已拒绝" : "草稿"}</td><td>${escapeHtml(row.externalStatus)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div>` : `<p>当前单位尚无Action申请。</p>`}</section></div></article>`;
      }).join("")}</div>
      <footer class="report-draft-foot"><span>数据：S002-DATA-v1</span><span>Published：S002-ONTO-v1 / T019-S002-v1</span><span>报告状态：draft</span><span>formalArtifactPublished=false</span><span>t049Ref=null</span></footer></section>`;
  }

  function renderM06(snapshot, dashboardOnly) {
    const ready = snapshot.progress.agentsRun;
    const latestDashboardVersion = snapshot.dashboardVersions[snapshot.dashboardVersions.length - 1];
    const latestReport = snapshot.reports[snapshot.reports.length - 1];
    const contentSnapshot = dashboardOnly ? latestDashboardVersion?.contentSnapshot || snapshot.dashboardView?.contentSnapshot : snapshot.dashboardView?.contentSnapshot || latestReport?.contentSnapshot;
    const projected = snapshotWithContent(snapshot, contentSnapshot);
    return `<div class="module-page report-page"><header class="module-page-head"><div><span>M06 · Report Center</span><h1>${dashboardOnly ? "预算管理驾驶舱" : "预算报告与驾驶舱"}</h1><p>五主题展示、单位对比、专题分析和下钻明细均归M06；数据只从Published/C018/C019消费。</p></div><div class="module-actions">${dashboardOnly ? "" : actionButton("生成五主题报告草稿", "build-report", ready && !snapshot.progress.reportBuilt, "file")}${dashboardOnly ? "" : actionButton("发布驾驶舱版本", "publish-dashboard", snapshot.progress.reportBuilt && !snapshot.progress.dashboardPublished, "publish")}</div></header>
      ${dashboardOnly ? "" : reportDraftMarkup(snapshot)}<section class="dashboard-shell"><header><div><span>S002预算管理驾驶舱</span><strong>${latestDashboardVersion?.dashboardVersionId || latestReport?.reportId || "等待驾驶舱版本"}</strong></div>${filtersMarkup(snapshot)}</header>${themeTabs(snapshot)}<div class="dashboard-canvas">${snapshot.dashboardView && (snapshot.progress.dashboardPublished || !dashboardOnly) ? dashboardTheme(snapshot, contentSnapshot) : `<div class="consume-gate">${icon("chart", "lg")}<h1>${snapshot.progress.ontologyPublished ? "驾驶舱消费视图尚未形成" : "等待Published绑定"}</h1><p>${snapshot.progress.ontologyPublished ? "请先完成Action草稿、双Agent编排和报告草稿，再形成M06只读消费视图。" : "M06不直接读取候选工作簿；请先完成M02数据版本和M01 Published/T019。"}</p>${dashboardOnly ? `<button class="btn primary" type="button" data-route="#module/report">前往报告中心</button>` : ""}</div>`}</div><footer><span>数据：${snapshot.progress.assetPublished ? "S002-DATA-v1" : "待发布"}</span><span>本体：${snapshot.progress.ontologyPublished ? "S002-ONTO-v1" : "待发布"}</span><span>Action：${projected.actionRequests.length}申请 / ${projected.todos.length}待办</span><span>报告：${latestReport?.status || "未形成"}</span><span>${contentSnapshot ? "CONTENT_SNAPSHOT_LOCKED" : DATA.scenario.syntheticMark}</span></footer></section>`;
  }

  const VIEW = new URLSearchParams(window.location.search).get("view") || "data";
  const VIEW_CONTEXT_KEY = `ofw:s002:ui:${new URLSearchParams(window.location.search).get("scenarioRunId") || "unknown"}:${VIEW}`;
  let viewContext = { scrollTop: 0, sectionIndex: 0 };
  try { viewContext = { ...viewContext, ...JSON.parse(window.sessionStorage.getItem(VIEW_CONTEXT_KEY) || "{}") }; } catch (_) {}

  function persistViewContext() {
    try { window.sessionStorage.setItem(VIEW_CONTEXT_KEY, JSON.stringify(viewContext)); } catch (_) {}
    HOST.postMessage?.({ channel: "ofw.s002", type: "view-context", view: VIEW, context: { ...viewContext } }, window.location.origin);
  }

  function captureViewContext() {
    const scroller = app.querySelector(".s002-module-view");
    if (scroller) viewContext.scrollTop = scroller.scrollTop;
    const active = app.querySelector(".product-nav nav button.active[data-section-index]");
    if (active) viewContext.sectionIndex = Number(active.dataset.sectionIndex || 0);
    persistViewContext();
  }

  function restoreViewContext() {
    const scroller = app.querySelector(".s002-module-view");
    if (scroller) scroller.scrollTop = Number(viewContext.scrollTop || 0);
  }

  function applyViewContext(context) {
    if (!context) return;
    viewContext = { ...viewContext, ...context };
    app.querySelectorAll(".product-nav nav button[data-section-index]").forEach(function (button) {
      button.classList.toggle("active", Number(button.dataset.sectionIndex) === Number(viewContext.sectionIndex || 0));
    });
    window.requestAnimationFrame(function () {
      restoreViewContext();
      window.setTimeout(restoreViewContext, 0);
      window.setTimeout(restoreViewContext, 80);
    });
  }

  const VIEW_SPECS = {
    data: { code: "M02", name: "数据工程", icon: "database", render: renderM02, route: "#module/data", sections: ["数据源", "质量门", "数据资产"] },
    ontology: { code: "M01", name: "本体管理", icon: "network", render: renderM01, route: "#module/ontology", sections: ["对象关系", "Metric", "Rule", "Action Type"] },
    query: { code: "M03", name: "智能问数", icon: "sparkles", render: renderM03, route: "#module/query", sections: ["预算问数", "结构化结果", "Rule 运行"] },
    decision: { code: "M04", name: "决策中心", icon: "target", render: renderM04, route: "#module/decision", sections: ["决策提醒", "Action 草稿", "人工确认", "平台内待办"] },
    agent: { code: "M05", name: "Agent 应用", icon: "bot", render: renderM05, route: "#module/agent", sections: ["Agent 目录", "编排运行", "固定证据"] },
    report: { code: "M06", name: "报告中心", icon: "file", render: function (snapshot) { return renderM06(snapshot, false); }, route: "#module/report", sections: ["报告生命周期", "预算驾驶舱", "专题分析", "证据包"] },
    dashboard: { code: "M06", name: "预算管理驾驶舱", icon: "chart", render: function (snapshot) { return renderM06(snapshot, true); }, route: "#dashboard", sections: ["预算执行", "项目余额", "采购占用", "异常事项", "跨年对比"] }
  };

  function productNavMarkup(spec, snapshot) {
    return `<aside class="product-nav"><header><span>${icon(spec.icon)}</span><div><small>${spec.code}</small><strong>${escapeHtml(spec.name)}</strong></div></header><div class="product-nav-context"><span>当前场景</span><strong>S002 · 预算监督管理</strong><small>${escapeHtml(snapshot.context.scenarioRunId)}</small></div><nav>${spec.sections.map(function (section, index) { return `<button class="${index === Number(viewContext.sectionIndex || 0) ? "active" : ""}" type="button" data-section-index="${index}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(section)}</strong></button>`; }).join("")}</nav><footer><span class="status-badge ${snapshot.mode === "historical" ? "warning" : "info"}">${snapshot.mode === "historical" ? "历史只读" : "预算监督运行中"}</span><small>外部预算系统未派发</small></footer></aside>`;
  }

  function render() {
    captureViewContext();
    const spec = VIEW_SPECS[VIEW] || VIEW_SPECS.data;
    if (!STORE) {
      app.innerHTML = `<div class="consume-gate">${icon("alert", "lg")}<h1>请从 S002 统一工作台进入</h1><p>模块页依赖同一场景上下文和运行命名空间，不能作为独立平台入口。</p></div>`;
      return;
    }
    const snapshot = STORE.get();
    const body = spec.render(snapshot);
    document.title = `${spec.name} · ${DATA.brand.zh}`;
    app.innerHTML = `<div class="app-shell s002-module-shell" data-module="${escapeHtml(VIEW)}" data-scenario-id="S002">${productNavMarkup(spec, snapshot)}<section class="app-workspace"><main class="main"><div class="module-view s002-module-view">${body}</div></main></section></div>`;
    applyViewContext(viewContext);
  }

  function drillModal(snapshot, kind, key) {
    const view = dashboardData(snapshot);
    let body = "";
    let title = "下钻明细";
    if (kind === "action") {
      const request = view.actionRequests.find(function (row) { return row.requestId === key; });
      const hit = request && view.ruleHits.find(function (row) { return row.id === request.sourceId; });
      const todo = request && view.todos.find(function (row) { return row.requestId === request.requestId; });
      title = request ? `${request.actionType}证据` : title;
      body = request ? `<div class="drill-path"><span>异常/建议</span>${icon("chevron", "sm")}<span>Action Request草稿</span>${icon("chevron", "sm")}<strong>${confirmedStatus(request) ? "人工已确认" : request.status === "rejected" ? "人工已拒绝" : "等待人工确认"}</strong></div><div class="result-facts"><div><span>Request</span><strong>${escapeHtml(request.requestId)}</strong></div><div><span>来源</span><strong>${request.sourceType === "rule-hit" ? escapeHtml(request.ruleId) : "分析建议"}</strong></div><div><span>Action Type</span><strong>${escapeHtml(request.actionTypeId)}</strong></div><div><span>外部派发</span><strong>${escapeHtml(request.externalStatus)}</strong></div><div><span>待办</span><strong>${todo ? escapeHtml(todo.todoId) : "未形成"}</strong></div></div>${hit ? `<div class="evidence-box"><strong>业务事实</strong><span>${escapeHtml(hit.title)} · ${fmt(hit.value, 2)}${escapeHtml(hit.unit)}</span><code>${escapeHtml((hit.evidence || []).join(" / "))}</code>${hit.dataMarker ? markerBadge(hit.dataMarker) : ""}</div>` : `<div class="evidence-box"><strong>分析建议</strong><span>建议项不登记为D082正式Rule命中；仍需人工确认。</span></div>`}<div class="table-wrap"><table class="data-table"><thead><tr><th>C011阶段</th><th>状态</th><th>决定/原因</th><th>C017摘要</th></tr></thead><tbody>${Object.values(request.gates).map(function (gate) { return `<tr><td>${escapeHtml(gate.stage)}</td><td>${escapeHtml(gate.status)}</td><td>${escapeHtml(gate.decision || gate.reason || "—")}</td><td>${escapeHtml(gate.c017SummaryId || "—")}</td></tr>`; }).join("")}</tbody></table></div><div class="evidence-box"><strong>Published绑定</strong><code>${escapeHtml(request.semanticBinding.dataAssetVersion)} / ${escapeHtml(request.semanticBinding.ontologyVersion)} / ${escapeHtml(request.semanticBinding.actionTypeVersion)} / ${escapeHtml(request.semanticBinding.publishedPointer)}</code><span>自动审批、过账、批准预算覆盖和外部预算系统调用均关闭。</span></div>` : "";
    } else if (kind === "project") {
      const project = view.projects.find(function (row) { return row.projectId === key; });
      const events = (view.occupancy.examples || []).filter(function (row) { return row.projectId === key; });
      title = project ? project.name : title;
      body = project ? `<div class="drill-path"><span>集团</span>${icon("chevron", "sm")}<span>${escapeHtml(project.department)}</span>${icon("chevron", "sm")}<span>${escapeHtml(project.projectId)}</span>${icon("chevron", "sm")}<strong>2025-12-31</strong></div><div class="result-facts"><div><span>立项金额</span><strong>${fmt(project.approvedAmount)}</strong></div><div><span>累计实际</span><strong>${fmt(project.actualUsed)}</strong></div><div><span>净在途占用</span><strong>${fmt(project.netInTransit)}</strong></div><div><span>未结计提</span><strong>${fmt(project.accrual)}</strong></div><div><span>源已使用</span><strong>${fmt(project.sourceUsedAmount)}</strong></div><div><span>重算已使用</span><strong>${fmt(project.recalculatedUsed)}</strong></div><div><span>重算差异</span><strong>${fmt(project.usedAmountVariance)}</strong></div><div><span>项目可用立项余额</span><strong class="${project.availableBalance < 0 ? "danger-text" : ""}">${fmt(project.availableBalance)}</strong></div></div><div class="evidence-box"><strong>Published证据</strong><code>S002-DATA-v1 / S002-ONTO-v1 / MET-006 / ${escapeHtml(project.projectId)}</code><span>${escapeHtml(project.usedAmountRecalculationBasis)}；占用覆盖 ${escapeHtml(project.commitmentSourceCoverage)}。</span>${markerBadge(project.dataMarker)} ${markerBadge(project.netInTransitDataMarker)}</div>${events.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>期间</th><th>事件</th><th>PR</th><th>PO</th><th>金额</th><th>标识</th></tr></thead><tbody>${events.map(function (event) { return `<tr><td>${escapeHtml(event.month)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(event.pr || "—")}</td><td>${escapeHtml(event.po || "—")}</td><td>${fmt(event.amount)}</td><td>${markerBadge(event.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="boundary-note">${icon("info")}<div><strong>无PR/PO来源覆盖</strong><span>该项目净在途按演示零值处理并标记IMPUTED_ZERO，不解释为来源确认的真实零。</span></div></div>`}` : "";
    } else if (kind === "submission") {
      const rows = view.submissionFacts.filter(function (row) { return row.department === key; });
      const projects = view.projects.filter(function (row) { return row.department === key; });
      const supplierRows = view.supplierBenchmarks.filter(function (row) { return row.department === key; });
      title = `${key}初始申报`;
      body = `<div class="drill-path"><span>集团</span>${icon("chevron", "sm")}<span>${escapeHtml(key)}</span>${icon("chevron", "sm")}<strong>项目/技术配置</strong></div><div class="table-wrap"><table class="data-table"><thead><tr><th>年度</th><th>收入净额</th><th>项目成本</th><th>技术配置</th><th>公共费用</th><th>总成本</th><th>成本占收比</th><th>标识</th></tr></thead><tbody>${rows.map(function (row) { return `<tr><td>${row.year}</td><td>${fmt(row.revenue)}</td><td>${fmt(row.projectCost)}</td><td>${fmt(row.techCost)}</td><td>${fmt(row.publicExpense)}</td><td>${fmt(row.totalCost)}</td><td>${pct(row.costToRevenue, 1)}</td><td>${markerBadge(row.year === 2026 ? "SYNTHETIC_FOR_DEMO" : "SOURCE")}</td></tr>`; }).join("")}</tbody></table></div><div class="two-col"><section><h3>项目明细</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>项目</th><th>立项金额</th><th>实际</th><th>可用余额</th></tr></thead><tbody>${projects.map(function (project) { return `<tr><td><code>${escapeHtml(project.projectId)}</code></td><td>${fmt(project.approvedAmount)}</td><td>${fmt(project.actualUsed)}</td><td>${fmt(project.availableBalance)}</td></tr>`; }).join("")}</tbody></table></div></section><section><h3>技术配置/供应商可比明细</h3>${supplierRows.length ? `<div class="table-wrap"><table class="data-table compact"><thead><tr><th>供应商</th><th>级别</th><th>单价</th><th>中位价</th><th>倍率</th></tr></thead><tbody>${supplierRows.map(function (row) { return `<tr><td>${escapeHtml(row.supplier)}</td><td>${escapeHtml(row.level)}</td><td>${fmt(row.unitPrice, 0)}</td><td>${fmt(row.cohortMedian, 0)}</td><td>${fmt(row.priceRatio, 2)}倍</td></tr>`; }).join("")}</tbody></table></div>` : `<p>当前单位无结构化可比供应商事实。</p>`}</section></div>`;
    } else if (kind === "trend") {
      const rows = view.annualFacts.filter(function (row) { return row.department === key; });
      title = `${key}跨年趋势`;
      body = `<div class="drill-path"><span>集团</span>${icon("chevron", "sm")}<span>${escapeHtml(key)}</span>${icon("chevron", "sm")}<strong>年度事实</strong></div><div class="table-wrap"><table class="data-table"><thead><tr><th>年度</th><th>实际收入</th><th>实际费用</th><th>收入执行率</th><th>费用执行率</th><th>真正毛利率</th></tr></thead><tbody>${rows.map(function (row) { return `<tr><td>${row.year}</td><td>${fmt(row.actualRevenue)}</td><td>${fmt(row.actualExpense)}</td><td>${pct(row.revenueRate, 1)}</td><td>${pct(row.expenseRate, 1)}</td><td>${pct(row.grossMargin, 1)}</td></tr>`; }).join("")}</tbody></table></div><div class="evidence-box"><strong>解释</strong><span>${escapeHtml(rows[rows.length - 1]?.note || "")}</span><code>SYNTHETIC_FOR_DEMO · annual_department_fact</code></div>`;
    } else {
      const rows = view.annualFacts.filter(function (row) { return row.department === key; });
      title = `${key}预算执行下钻`;
      const projects = view.projects.filter(function (project) { return project.department === key; });
      const details = view.expenseDetails.filter(function (row) {
        return row.year === Number(snapshot.filters.year) && row.department === key &&
          (snapshot.filters.subject === "全部" || row.subject === snapshot.filters.subject) &&
          (snapshot.filters.project === "全部" || row.projectId === snapshot.filters.project) &&
          (snapshot.filters.period === "全年" || row.period === snapshot.filters.period);
      });
      body = `<div class="drill-path"><span>集团</span>${icon("chevron", "sm")}<span>${escapeHtml(key)}</span>${icon("chevron", "sm")}<span>科目</span>${icon("chevron", "sm")}<span>项目</span>${icon("chevron", "sm")}<strong>期间/证据</strong></div><div class="table-wrap"><table class="data-table"><thead><tr><th>年度</th><th>收入实际/预算</th><th>收入差异</th><th>费用实际/预算</th><th>费用差异</th><th>费用执行率</th></tr></thead><tbody>${rows.map(function (row) { return `<tr><td>${row.year}</td><td>${fmt(row.actualRevenue)} / ${fmt(row.approvedRevenueBudget)}</td><td>${fmt(row.actualRevenue - row.approvedRevenueBudget)}</td><td>${fmt(row.actualExpense)} / ${fmt(row.approvedExpenseBudget)}</td><td>${fmt(row.actualExpense - row.approvedExpenseBudget)}</td><td>${pct(row.expenseRate, 1)}</td></tr>`; }).join("")}</tbody></table></div><div class="project-links">${projects.map(function (project) { return `<button type="button" data-action="open-drill" data-drill-kind="project" data-drill-key="${project.projectId}"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.projectId)} · 可用${fmt(project.availableBalance)} · ${escapeHtml(project.netInTransitDataMarker)}</small></button>`; }).join("")}</div><div class="table-wrap"><table class="data-table"><thead><tr><th>期间</th><th>科目</th><th>项目</th><th>批准预算</th><th>实际</th><th>差异</th><th>标识</th></tr></thead><tbody>${details.map(function (row) { return `<tr><td>${escapeHtml(row.periodName)}</td><td>${escapeHtml(row.subject)}</td><td><code>${escapeHtml(row.projectId || "—")}</code></td><td>${fmt(row.approvedBudget)}</td><td>${fmt(row.actual)}</td><td>${fmt(row.variance)}</td><td>${markerBadge(row.dataMarker)}</td></tr>`; }).join("")}</tbody></table></div>`;
    }
    openModal({ title: title, subtitle: "集团 → 部门 → 科目 → 项目 → 期间 → Published证据", icon: "search", large: true, body: body, footer: '<button class="btn" type="button" data-action="close-modal">关闭</button><button class="btn soft" type="button" data-route="#module/decision">异常转 Action</button>' });
  }

  function queryDrill(snapshot) {
    const run = snapshot.queryRuns[snapshot.queryRuns.length - 1];
    if (!run) return;
    openModal({ title: "问数证据链", subtitle: run.runId, icon: "link", large: true, body: `<div class="evidence-box"><strong>问题</strong><span>${escapeHtml(run.label)}</span></div><div class="snapshot-sections"><span>S002-DATA-v1</span><span>S002-ONTO-v1</span><span>T019-S002-v1</span><span>C018-S002-v1</span></div><div class="boundary-note">${icon("shield")}<div><strong>可复现边界</strong><span>回答不直读工作簿，证据由Published本体、可消费数据版本和固定问数视图共同锁定。</span></div></div>`, footer: '<button class="btn" type="button" data-action="close-modal">关闭</button>' });
  }

  function handleAction(target) {
    const action = target.closest("[data-action]")?.dataset.action;
    if (!action || !STORE) return;
    const snapshot = STORE.get();
    if (action === "close-modal") { closeModal(); return; }
    if (action === "notify-parent-refresh") { render(); HOST.postMessage?.({ channel: "ofw.s002", type: "state-changed" }, window.location.origin); return; }
    const actionMap = {
      "connect-data": [STORE.connectData, "数据接入完成", "8份来源已进入S002命名空间"],
      "run-quality": [STORE.runQuality, "质量门通过", "20/20检查通过，公式错误0"],
      "publish-data": [STORE.publishData, "数据资产版本已形成", "S002-DATA-v1"],
      "apply-mapping": [STORE.applyMapping, "对象关系映射完成", "稳定键和业务事件已映射"],
      "publish-ontology": [STORE.publishOntology, "Published本体已切换", "S002-ONTO-v1 / T019-S002-v1"],
      "run-rules": [STORE.runRules, "Rule检查完成", function (result) { return `${result.length}条正式Rule命中已形成，并保留已评估无命中结论。`; }],
      "submit-actions": [STORE.submitActions, "Action Request草稿已生成", function (result) { return `${result.length}条草稿覆盖六类Action；外部未派发。`; }],
      "run-agents": [STORE.runAgents, "双Agent编排完成", "异常分析和报告草稿结果已形成"],
      "build-report": [STORE.buildReport, "报告草稿已生成", "五主题内容与证据已绑定"],
      "publish-dashboard": [STORE.publishDashboard, "预算驾驶舱已发布", "M06可消费版本已形成"]
    };
    if (actionMap[action]) {
      const result = actionMap[action][0]();
      if (result === false) showToast("当前步骤尚不可执行", "请先完成前置模块步骤。", "warning");
      else showToast(actionMap[action][1], typeof actionMap[action][2] === "function" ? actionMap[action][2](result) : actionMap[action][2]);
      render();
      HOST.postMessage?.({ channel: "ofw.s002", type: "state-changed" }, window.location.origin);
      return;
    }
    if (action === "ask-question") {
      const run = STORE.executeQuestion(target.closest("[data-question-id]").dataset.questionId);
      if (!run) showToast("问数尚不可运行", "请先发布S002本体版本。", "warning");
      else showToast("预算问数完成", run.runId);
      render();
      HOST.postMessage?.({ channel: "ofw.s002", type: "state-changed" }, window.location.origin);
      return;
    }
    if (action === "confirm-action") {
      const requestId = target.closest("[data-request-id]").dataset.requestId;
      const result = STORE.confirmAction(requestId);
      if (result) showToast("行动已人工确认", "对应平台内待办已生成；外部系统仍未派发。");
      render();
      HOST.postMessage?.({ channel: "ofw.s002", type: "state-changed" }, window.location.origin);
      return;
    }
    if (action === "reject-action") {
      const requestId = target.closest("[data-request-id]").dataset.requestId;
      const result = STORE.rejectAction(requestId);
      if (result) showToast("行动申请已拒绝", "该Request不会生成负责人待办。", "warning");
      render();
      HOST.postMessage?.({ channel: "ofw.s002", type: "state-changed" }, window.location.origin);
      return;
    }
    if (action === "set-theme") { STORE.setTheme(target.closest("[data-theme-id]").dataset.themeId); render(); return; }
    if (action === "open-drill") { const node = target.closest("[data-drill-kind]"); drillModal(snapshot, node.dataset.drillKind, node.dataset.drillKey); return; }
    if (action === "open-query-drill") { queryDrill(snapshot); return; }
  }

  function normalizeShellRoute(route) {
    return {
      "#module/m02": "#module/data",
      "#module/m01": "#module/ontology",
      "#module/m03": "#module/query",
      "#module/m04": "#module/decision",
      "#module/m05": "#module/agent",
      "#module/m06": "#module/report"
    }[route] || route;
  }

  function navigateParent(route) {
    const normalized = normalizeShellRoute(route);
    if (HOST.S002_SHELL?.navigate) HOST.S002_SHELL.navigate(normalized);
    else HOST.postMessage?.({ channel: "ofw.s002", type: "navigate", route: normalized }, window.location.origin);
  }

  function focusProductSection(target) {
    const index = Number(target.closest("[data-section-index]").dataset.sectionIndex || 0);
    const candidates = app.querySelectorAll(".module-page > .panel, .module-page > .two-col, .module-page > .semantic-grid, .module-page > .query-layout, .module-page > .agent-grid, .module-page > .dashboard-shell, .module-page > .boundary-note");
    const section = candidates[Math.min(index, Math.max(0, candidates.length - 1))];
    app.querySelectorAll(".product-nav nav button").forEach(function (button) { button.classList.toggle("active", button === target.closest("button")); });
    viewContext.sectionIndex = index;
    persistViewContext();
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.addEventListener("click", function (event) {
    const sectionTarget = event.target.closest("[data-section-index]");
    if (sectionTarget) { focusProductSection(sectionTarget); return; }
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      event.preventDefault();
      closeModal();
      navigateParent(routeTarget.dataset.route);
      return;
    }
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) handleAction(actionTarget);
  });

  document.addEventListener("change", function (event) {
    if (event.target.matches("[data-filter-key]")) {
      const key = event.target.dataset.filterKey;
      const value = key === "year" ? Number(event.target.value) : event.target.value;
      STORE.setFilters({ [key]: value });
      render();
    }
  });

  document.addEventListener("scroll", function (event) {
    if (event.target instanceof Element && event.target.matches(".s002-module-view")) {
      viewContext.scrollTop = event.target.scrollTop;
      persistViewContext();
    }
  }, true);

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin || event.data?.channel !== "ofw.s002") return;
    if (event.data.type === "refresh") render();
    if (event.data.type === "restore-view-context" && event.data.view === VIEW) applyViewContext(event.data.context);
  });
  if (STORE) STORE.subscribe(function () { render(); });
  render();
})();
