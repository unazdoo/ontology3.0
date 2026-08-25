(function () {
  "use strict";

  const R = window.COMPOSITE_RUNTIME;
  const app = document.getElementById("app");
  const modalRoot = document.getElementById("modal-root");
  const UI_KEY = "ofw.composite.ui.v3";
  const MODULES = R.modules.filter((item) => item.id !== "dashboard");
  const MODULE_LABELS = Object.fromEntries(MODULES.map((item) => [item.id, item.name]));
  const STEP_BY_MODULE = { data: 2, ontology: 4, query: 6, decision: 9, report: 12, agent: 13 };
  const SCENE_FILTERS = [{ id: "ALL", name: "全部场景" }, ...R.SCENARIOS.map((scene) => ({ id: scene.id, name: scene.name }))];
  const SAMPLE = {
    S001: {
      rows: "5,218 条贷款记录", pipeline: "融资工作簿标准化 v1", quality: "99.8%", members: "4 个成员 / 3 条关系",
      ontologyScope: "4 Object / 3 Link / 7 Metric / 3 Rule", queryAgent: "融资问数 Agent", owner: "融资负责人001",
      bank: "国家开发银行 · 工商银行", reportDefinition: "集团融资经营分析", chart: [62, 74, 54, 86, 68],
      answers: ["三家单位综合平均融资成本为 2.37%，其中境外新能源高于集团均值 31bp。", "建议优先与国家开发银行、工商银行协商 2026 年到期贷款的定价重检。"]
    },
    S002: {
      rows: "8 份预算工作簿", pipeline: "预算执行归集 v1", quality: "98.6%", members: "5 个逻辑源 / 2 条管道",
      ontologyScope: "7 Object / 9 Metric / 5 Rule / 6 Action Type", queryAgent: "预算问数 Agent", owner: "预算管理处",
      bank: "—", reportDefinition: "预算监督专题报告", chart: [81, 65, 74, 58, 90],
      answers: ["预算执行率 76.4%，三项重点项目的采购占用率超过 85%。", "本期适用预算监督规则，当前范围不形成 Action Request。"]
    },
    S003: {
      rows: "21 家企业", pipeline: "债务风险输入标准化 v1", quality: "待受控发布验证", members: "财务数据 / 调节因子",
      ontologyScope: "风险模型 / 15 指标 / 亮灯 Rule", queryAgent: "风险监测问数 Agent", owner: "成员单位接口人",
      bank: "—", reportDefinition: "企业债务风险评估报告", chart: [48, 72, 83, 39, 67],
      answers: ["21 家企业中 4 家进入红色风险区，主要弱项集中在流动性和短期债务覆盖。", "环保企业的电价波动率因业务不适用保持空值，不参与评分。"]
    },
    S004: {
      rows: "贷前资料包", pipeline: "贷前调查资料归集 v2", quality: "18 项核验", members: "财务公司主体 / 借款人关系",
      ontologyScope: "贷前调查 Published 资源", queryAgent: "报告伴读 Agent", owner: "财务公司授信负责人",
      bank: "—", reportDefinition: "财务公司贷款贷前调查报告", chart: [71, 62, 88, 76, 54],
      answers: ["借款人资格、成员关系和偿债材料均已进入固定事实包。", "本场景不适用标准智能问数，建议从报告伴读入口核对证据。"]
    }
  };
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  const icon = (name) => `<span class="ofw-icon" aria-hidden="true">${({ home: "⌂", database: "◫", network: "⌘", sparkles: "✦", target: "◎", bot: "◌", file: "▤", chart: "▥", arrow: "→", play: "▶", refresh: "↻", reset: "↺", close: "×", search: "⌕", download: "⇩", zoom: "+/−", layers: "◈", check: "✓", clock: "◷", alert: "!" })[name] || "·"}</span>`;
  const sceneById = (id) => R.getScenario(id) || R.SCENARIOS[0];
  const sample = (id) => SAMPLE[id] || SAMPLE.S001;
  const record = (id) => R.getState(id);
  const step = (id) => Number(record(id)?.stepIndex || 0);
  const statusTone = (id, target = null) => {
    const current = record(id);
    if (current?.runStatus === "running") return "info";
    if (current?.runStatus === "failed") return "danger";
    if (target !== null && step(id) >= target + 1) return "success";
    if (step(id) > 0) return "warning";
    return "muted";
  };
  const statusText = (id, target = null) => {
    const current = record(id);
    if (current?.runStatus === "running") return "处理中";
    if (current?.runStatus === "failed") return "失败";
    if (target !== null && step(id) >= target + 1) return "已完成";
    if (step(id) > 0) return "待继续";
    return "未开始";
  };
  const loadUi = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(UI_KEY) || "null");
      return { module: "home", scene: "ALL", search: "", drawer: null, query: { text: "", answer: null, running: false, history: [] }, reportTab: "artifacts", agentTab: "catalog", chart: "bar", ...(saved || {}) };
    } catch (_) { return { module: "home", scene: "ALL", search: "", drawer: null, query: { text: "", answer: null, running: false, history: [] }, reportTab: "artifacts", agentTab: "catalog", chart: "bar" }; }
  };
  let ui = loadUi();
  let route = (location.hash || "#home").replace(/^#/, "") || "home";
  function persistUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (_) {} }
  function navigate(next) { route = next; ui.module = next.split("/")[0] || "home"; R.setModule(ui.module); history.pushState({ composite: true }, "", `#${next}`); render(); }
  function filteredScenes() { return R.SCENARIOS.filter((scene) => ui.scene === "ALL" || scene.id === ui.scene); }
  function sceneFilter() { return `<label class="filter-field"><span>场景范围</span><select data-ui="scene"><option value="ALL" ${ui.scene === "ALL" ? "selected" : ""}>全部场景</option>${R.SCENARIOS.map((scene) => `<option value="${scene.id}" ${ui.scene === scene.id ? "selected" : ""}>${scene.id} · ${esc(scene.name)}</option>`).join("")}</select></label>`; }
  function progressLabel(id) { const total = sceneById(id).total || 15; const current = record(id); return current?.runStatus === "running" ? `${Math.min(step(id), total)}/${total}` : current?.runStatus === "completed" ? `${total}/${total}` : `${Math.min(step(id), total)}/${total}`; }
  function statusPill(text, tone = "muted") { return `<span class="status-pill ${tone}">${esc(text)}</span>`; }
  function actionButton(action, label, attrs = "", tone = "") { return `<button class="btn ${tone}" type="button" data-action="${action}" ${attrs}>${esc(label)}</button>`; }
  function nav() {
    const active = ui.module;
    return `<aside class="composite-nav"><div class="nav-brand"><span class="brand-mark">OF</span><div><strong>智财问策</strong><small>Ontology Financial World</small></div></div><div class="nav-caption">统一工作区 · 四场景汇总</div><button class="nav-item ${active === "home" ? "active" : ""}" data-route="home">${icon("home")}<span>总览</span></button>${MODULES.map((item) => `<button class="nav-item ${active === item.id ? "active" : ""}" data-route="${item.id}">${icon(item.icon)}<span>${item.name}</span><i class="nav-count">${R.SCENARIOS.length}</i></button>`).join("")}<div class="nav-foot"><span class="status-dot"></span><span>统一 Shell · 单层导航</span><small>场景作为业务维度汇总展示</small></div></aside>`;
  }
  function topbar() {
    const title = ui.module === "home" ? "统一业务工作区" : MODULE_LABELS[ui.module] || "统一业务工作区";
    return `<header class="composite-topbar"><div><span class="eyebrow">四场景组合总装 · ${ui.module === "home" ? "平台总览" : "模块工作台"}</span><h1>${esc(title)}</h1></div><div class="top-actions"><span class="version-chip">v1.1.0-rc.2</span><span class="baseline-chip">v1.0.7 功能基线</span><button class="icon-btn" data-action="refresh" title="重新读取">${icon("refresh")}</button></div></header>`;
  }
  function summaryStrip() {
    const completed = R.completedCount();
    const publishedAssets = R.SCENARIOS.filter((scene) => step(scene.id) >= 3).length;
    const ontologies = R.SCENARIOS.filter((scene) => step(scene.id) >= 5).length;
    const reports = R.SCENARIOS.filter((scene) => step(scene.id) >= 13).length;
    return `<section class="summary-strip"><div><span>场景运行</span><strong>${completed}/4</strong><small>完整链路已完成</small></div><div><span>数据资产</span><strong>${publishedAssets}/4</strong><small>已形成发布候选</small></div><div><span>Published 本体</span><strong>${ontologies}/4</strong><small>按业务域保留版本</small></div><div><span>报告产物</span><strong>${reports}/4</strong><small>HTML/PDF 同源发布</small></div></section>`;
  }
  function homeView() {
    const completed = R.completedCount();
    const running = R.SCENARIOS.find((scene) => record(scene.id)?.runStatus === "running");
    const activity = R.loadState().state.activity.slice(0, 6);
    return `<div class="page home-page"><section class="hero-band"><div><span class="eyebrow">ONTOLOGY FINANCIAL WORLD · 统一产品壳</span><h2>四个业务场景，共用一套数据—语义—决策—行动工作台</h2><p>数据工程、本体管理、智能问数、决策中心、Agent 应用和报告中心不再按场景拆成四套产品；每个模块直接汇总全部场景的资产、版本、运行事实和业务结果。</p></div><div class="hero-actions">${actionButton("run-all", running ? "四场景处理中" : "运行四场景完整链路", running ? "disabled" : "", "primary large")}<span class="hero-note">${completed}/4 场景已完成 · 每次运行都会形成新的场景运行轮次</span></div></section>${summaryStrip()}<section class="section-head"><div><span class="eyebrow">统一运行链路</span><h2>从数据接入到当前数据比较</h2><p>点击任一模块进入完整工作台，所有状态在同一套运行记录中同步更新。</p></div><div class="section-actions">${actionButton("reset-all", "重置全部场景", "", "ghost")}</div></section><section class="chain-strip">${R.STEP_LABELS.map((label, index) => `<div class="chain-step ${R.SCENARIOS.every((scene) => step(scene.id) > index) ? "done" : ""}"><b>${String(index + 1).padStart(2, "0")}</b><span>${esc(label)}</span></div>`).join("")}</section><section class="section-head"><div><span class="eyebrow">业务场景维度</span><h2>四个场景的运行结果</h2><p>场景只作为资源、结果和证据的业务维度，产品导航始终保持一层。</p></div><button class="btn ghost" data-route="report/dashboard">查看组合驾驶舱 ${icon("arrow")}</button></section><div class="scenario-grid">${R.SCENARIOS.map(sceneCard).join("")}</div><section class="activity-panel"><div class="section-head compact"><div><span class="eyebrow">最近活动</span><h2>运行记录</h2></div><span class="muted-copy">按 scenarioRunId 保留，不覆盖历史</span></div>${activity.length ? `<div class="activity-list">${activity.map((item) => `<div class="activity-row"><span class="activity-dot"></span><div><strong>${esc(item.text)}</strong><small>${esc(item.scenarioId)} · ${new Date(item.at).toLocaleString("zh-CN", { hour12: false })}</small></div></div>`).join("")}</div>` : `<div class="empty-state">${icon("layers")}<strong>尚未开始本轮运行</strong><span>从上方运行完整链路，或进入任一模块按步骤推进。</span></div>`}</section></div>`;
  }
  function sceneCard(scene) {
    const current = record(scene.id);
    const tone = current?.runStatus === "completed" ? "success" : current?.runStatus === "running" ? "info" : current?.runStatus === "paused" ? "warning" : "muted";
    const total = scene.total || 15;
    return `<article class="scenario-card tone-${scene.color}"><div class="scenario-card-head"><div><span class="scenario-kicker">${scene.id} · ${esc(scene.domain)}</span><h3>${esc(scene.name)}</h3></div>${statusPill(R.statusLabel(current), tone)}</div><p>${esc(scene.highlights[0])} · ${esc(scene.highlights[1])}</p><div class="scenario-progress"><div><strong>${progressLabel(scene.id)}</strong><span>${current?.currentStep ? esc(current.currentStep) : current?.runStatus === "completed" ? "全链路已完成" : "等待开始"}</span></div><i><b style="width:${Math.min(100, Math.round((step(scene.id) / total) * 100))}%"></b></i></div><dl class="scenario-facts"><div><dt>数据截至</dt><dd>${esc(scene.asOf)}</dd></div><div><dt>数据资产</dt><dd>${esc(scene.asset)}</dd></div><div><dt>运行轮次</dt><dd>${esc(current?.scenarioRunId || "尚未形成")}</dd></div></dl><footer class="scenario-card-actions"><button class="btn" data-action="open-scene" data-scene="${scene.id}">查看详情</button><button class="btn primary" data-action="run-scene" data-scene="${scene.id}" ${current?.runStatus === "running" ? "disabled" : ""}>${current?.runStatus === "completed" ? "重新运行" : "继续运行"}</button></footer></article>`;
  }
  function moduleHeader(moduleId, title, intro, extra = "") {
    return `<section class="module-header"><div><span class="eyebrow">${esc(MODULE_LABELS[moduleId] || "平台模块")} · 全场景资源</span><h2>${esc(title)}</h2><p>${esc(intro)}</p></div><div class="module-header-actions">${extra}${actionButton("refresh", "重新读取", "", "ghost")}</div></section>`;
  }
  function filterBar() {
    return `<section class="aggregate-toolbar"><div class="toolbar-left">${sceneFilter()}<label class="search-field"><span>搜索资源</span><input data-ui="search" value="${esc(ui.search)}" placeholder="名称、版本、负责人或状态" /></label></div><span class="toolbar-note">${filteredScenes().length} 个场景 · 统一目录</span></section>`;
  }
  function dataView() {
    const rows = filteredScenes();
    const uploadNote = ui.uploadedFile ? `<span class="file-note">已选数据文件：${esc(ui.uploadedFile)}</span>` : "";
    return `<div class="page module-page">${moduleHeader("data", "数据资产目录", "统一查看四个场景的数据源、管道、快照、已发布资产和质量状态；不复制场景内部的明细真值。", `<button class="btn primary" type="button" data-action="upload-source">${icon("database")}上传数据源</button>${actionButton("run-all", "运行未完成链路", "", "soft")}`)}${uploadNote}${filterBar()}<section class="kpi-row"><div><span>数据源登记</span><strong>16</strong><small>跨场景稳定身份</small></div><div><span>已发布资产</span><strong>${rows.filter((scene) => step(scene.id) >= 3).length}</strong><small>当前组合状态</small></div><div><span>质量门</span><strong>4</strong><small>按场景独立核验</small></div></section><section class="table-card"><table><thead><tr><th>场景</th><th>数据源 / 管道</th><th>资产版本</th><th>成员范围</th><th>截至时间</th><th>质量</th><th>状态</th><th></th></tr></thead><tbody>${rows.map((scene) => { const s = sample(scene.id); const ready = step(scene.id) >= 3; return `<tr data-row-text="${esc(`${scene.id} ${scene.name} ${scene.asset} ${s.pipeline} ${s.quality}`)}"><td><span class="scene-tag">${scene.id}</span><strong>${esc(scene.name)}</strong></td><td><strong>${esc(scene.source)}</strong><small>${esc(s.pipeline)}</small></td><td><code>${esc(scene.asset)}</code><small>${ready ? "可被本体管理引用" : "已登记 · 待运行"}</small></td><td>${esc(s.rows)}<small>${esc(s.members)}</small></td><td>${esc(scene.asOf)}</td><td>${esc(s.quality)}</td><td>${statusPill(statusText(scene.id, 2), statusTone(scene.id, 2))}</td><td class="row-actions">${actionButton("run-module", ready ? "重新运行管道" : "运行管道", `data-scene="${scene.id}" data-module="data" data-target="2"`, ready ? "" : "primary")}<button class="text-btn" data-action="open-drawer" data-module="data" data-scene="${scene.id}">查看详情 ${icon("arrow")}</button></td></tr>`; }).join("")}</tbody></table></section></div>`;
  }
  function ontologyView() {
    const rows = filteredScenes();
    return `<div class="page module-page">${moduleHeader("ontology", "Published 本体目录", "所有场景的对象、关系、指标、Rule 和 Action Type 统一登记；发布绑定和数据资产版本在同一资源上下文中可追溯。", `<button class="btn primary" type="button" data-action="open-drawer" data-module="ontology" data-scene="S001">新建本体草稿</button>${actionButton("run-all", "完成上游后刷新", "", "soft")}`)}${filterBar()}<section class="ontology-workspace"><div class="ontology-list"><div class="panel-head"><div><h3>Published 版本</h3><p>仅展示已登记的场景语义资源</p></div><span class="count-label">${rows.length} 个</span></div>${rows.map((scene) => { const s = sample(scene.id); return `<button class="ontology-row" data-action="open-drawer" data-module="ontology" data-scene="${scene.id}"><span class="scene-tag">${scene.id}</span><div><strong>${esc(scene.name)}</strong><small>${esc(scene.ontology)}</small></div><span>${statusPill(statusText(scene.id, 4), statusTone(scene.id, 4))}</span>${icon("arrow")}</button>`; }).join("")}</div><div class="canvas-panel"><div class="panel-head"><div><h3>统一语义画布</h3><p>对象、指标和规则按场景分组展示，可拖动和缩放查看结构。</p></div><div class="canvas-tools"><button class="icon-btn" data-canvas="zoom-in" title="放大">＋</button><button class="icon-btn" data-canvas="zoom-out" title="缩小">−</button><button class="icon-btn" data-canvas="reset" title="重置">${icon("reset")}</button></div></div><div class="ontology-canvas" data-canvas="surface"><div class="canvas-grid"></div><div class="canvas-node node-data" data-canvas-node="data"><b>数据资产</b><span>4 个场景 / 16 个版本</span></div><div class="canvas-node node-object" data-canvas-node="object"><b>业务对象</b><span>融资主体 · 项目 · 贷款</span></div><div class="canvas-node node-metric" data-canvas-node="metric"><b>Metric</b><span>成本 · 执行率 · 风险评分</span></div><div class="canvas-node node-rule" data-canvas-node="rule"><b>Rule / Action Type</b><span>规则命中后受控进入决策</span></div><div class="canvas-link link-a"></div><div class="canvas-link link-b"></div><div class="canvas-link link-c"></div></div><div class="canvas-status"><span>当前视图：全部场景</span><span data-canvas="scale-label">100%</span></div></div></section><section class="table-card compact-table"><table><thead><tr><th>场景</th><th>发布版本</th><th>资源范围</th><th>来源资产</th><th>刷新目标</th><th>状态</th><th></th></tr></thead><tbody>${rows.map((scene) => { const s = sample(scene.id); return `<tr><td><span class="scene-tag">${scene.id}</span></td><td><code>${esc(scene.ontology)}</code></td><td>${esc(s.ontologyScope)}</td><td>${esc(scene.asset)}</td><td>${scene.id === "S003" ? "兼容验证绑定" : "可提交刷新"}</td><td>${statusPill(statusText(scene.id, 4), statusTone(scene.id, 4))}</td><td><button class="text-btn" data-action="open-drawer" data-module="ontology" data-scene="${scene.id}">查看详情 ${icon("arrow")}</button></td></tr>`; }).join("")}</tbody></table></section></div>`;
  }
  function queryView() {
    const rows = filteredScenes();
    const suggestions = rows.flatMap((scene) => [
      { scene: scene.id, text: scene.id === "S001" ? "三家单位综合平均融资成本是多少？" : scene.id === "S002" ? "本月预算执行率最低的三个板块是什么？" : scene.id === "S003" ? "哪些企业进入红色债务风险区？" : "贷前调查中还有哪些材料需要补齐？" },
      { scene: scene.id, text: scene.id === "S001" ? "哪三家单位需要优先与哪些银行协商？" : scene.id === "S002" ? "项目采购占用率超过 85% 的清单" : scene.id === "S003" ? "环保企业的调节因子如何处理？" : "查看借款人偿债能力证据" }
    ]);
    const answer = ui.query.answer;
    return `<div class="page module-page query-page">${moduleHeader("query", "智能问数工作台", "同一问数入口覆盖融资、预算、风险和贷前资料。结果卡片只展示业务结论，详情页再展开图表、证据和 CSV。", `${actionButton("new-query", "新建会话", "", "primary")}${actionButton("clear-query", "清空历史", "", "ghost")}`)}<div class="query-layout"><section class="query-main"><div class="query-intro"><div><span class="eyebrow">可信问数 · 统一会话</span><h3>你想先了解什么？</h3><p>选择一个推荐问题，或直接输入业务问题。系统会记录场景、Agent 配置、本体版本和数据截至时间。</p></div><span class="context-chip">4 个场景 · 1 个工作台</span></div><div class="recommend-grid">${suggestions.map((item) => `<button class="recommend-card" data-action="ask" data-scene="${item.scene}" data-question="${esc(item.text)}"><span class="scene-tag">${item.scene}</span><strong>${esc(item.text)}</strong><span>查看可信结果 ${icon("arrow")}</span></button>`).join("")}</div><form class="query-form" data-form="query"><input name="question" value="${esc(ui.query.text)}" placeholder="例如：三家单位综合平均融资成本是多少？" aria-label="输入问题"/><button class="btn primary" type="submit">${icon("search")}提问</button></form>${ui.query.running ? `<div class="answer-card loading-card"><div class="loading-line"></div><div class="loading-line short"></div><p>正在读取场景上下文、Published 本体和数据可信度摘要…</p></div>` : answer ? answerCard(answer) : `<div class="answer-empty"><div class="answer-mark">✦</div><strong>回答会出现在这里</strong><span>先从推荐问题开始，系统会在处理中展示版本与证据回链。</span></div>`}</section><aside class="query-side"><div class="side-panel"><div class="panel-head"><div><h3>本轮上下文</h3><p>问数运行所需的最小上下文</p></div></div><dl class="context-list"><div><dt>Agent 配置</dt><dd>Query Agent / v1.4</dd></div><div><dt>Published 本体</dt><dd>按问题场景读取</dd></div><div><dt>数据可信度</dt><dd>C017 只读摘要</dd></div><div><dt>运行状态</dt><dd>${answer ? "已形成回答" : "等待提问"}</dd></div></dl></div><div class="side-panel"><div class="panel-head"><div><h3>语义证据</h3><p>结果详情页可继续展开</p></div></div><div class="evidence-mini"><span class="evidence-dot"></span><div><strong>固定结构化结果</strong><small>查询范围、计划和证据映射均可定位</small></div></div><div class="evidence-mini"><span class="evidence-dot"></span><div><strong>可复现摘要</strong><small>精确数据版本与截至时间随结果保存</small></div></div></div>${ui.query.history.length ? `<div class="side-panel history-panel"><div class="panel-head"><div><h3>历史会话</h3><p>${ui.query.history.length} 条本轮记录</p></div></div>${ui.query.history.slice(-4).reverse().map((item) => `<button class="history-item" data-action="restore-query" data-history="${esc(JSON.stringify(item))}"><span>${esc(item.scene)}</span><strong>${esc(item.question)}</strong></button>`).join("")}</div>` : ""}</aside></div></div>`;
  }
  function answerCard(answer) {
    return `<article class="answer-card"><header><div><span class="scene-tag">${answer.scene}</span><span class="answer-label">回答已形成</span><h3>${esc(answer.summary)}</h3></div><button class="text-btn" data-action="open-answer-detail">查看详情 ${icon("arrow")}</button></header><p class="answer-copy">${esc(answer.explanation)}</p><div class="answer-highlight"><strong>${esc(answer.value)}</strong><span>${esc(answer.unit)}</span></div><div class="answer-meta"><span>数据截至 ${esc(answer.asOf)}</span><span>本体 ${esc(answer.ontology)}</span><span>证据 ${esc(answer.evidence)}</span></div><div class="answer-actions"><button class="btn" data-action="toggle-chart">${ui.chart === "bar" ? "切换折线视图" : "切换柱状视图"}</button><button class="btn" data-action="export-csv">${icon("download")}导出 CSV</button></div><div class="answer-chart ${ui.chart}">${answer.chart.map((value, index) => `<div class="chart-col"><i style="height:${value}%"></i><span>${esc(answer.labels[index])}</span></div>`).join("")}</div></article>`;
  }
  function makeAnswer(sceneId, question) {
    const s = sceneById(sceneId); const d = sample(sceneId); const isCost = /融资|成本|银行|协商/.test(question); const answer = isCost && sceneId === "S001" ? { scene: "S001", summary: "集团与重点单位综合平均融资成本", explanation: d.answers[0], value: "2.372231%", unit: "加权平均融资成本", asOf: s.asOf, ontology: s.ontology, evidence: s.evidence, chart: d.chart, labels: ["集团", "产业金融", "境外新能源", "环保产业", "其他单位"] } : { scene: sceneId, summary: d.answers[0].split("。")[0], explanation: d.answers[1], value: sceneId === "S002" ? "76.4%" : sceneId === "S003" ? "4 家" : "18/18", unit: sceneId === "S002" ? "预算执行率" : sceneId === "S003" ? "红色风险企业" : "核验项", asOf: s.asOf, ontology: s.ontology, evidence: s.evidence, chart: d.chart, labels: sceneId === "S002" ? ["产业一", "产业二", "科技", "环保", "其他"] : sceneId === "S003" ? ["流动性", "杠杆", "偿债", "盈利", "治理"] : ["主体", "借款人", "关系", "偿债", "材料"] };
    return answer;
  }
  function decisionView() {
    const rows = filteredScenes();
    const totalRequests = rows.reduce((sum, scene) => sum + (scene.id === "S001" ? 3 : scene.id === "S003" ? 2 : 0), 0);
    const confirmed = rows.reduce((sum, scene) => sum + (step(scene.id) >= 9 && scene.id === "S001" ? 1 : 0), 0);
    return `<div class="page module-page">${moduleHeader("decision", "决策工作台", "所有场景共享 Action Request、人工确认和负责人待办的运行事实；场景专属字段只在对应记录中出现。", actionButton("run-all", "推进未完成链路", "", "soft"))}<section class="kpi-row"><div><span>待确认</span><strong>${Math.max(0, totalRequests - confirmed)}</strong><small>需要人工判断</small></div><div><span>已确认</span><strong>${confirmed}</strong><small>本轮决策运行</small></div><div><span>负责人待办</span><strong>${confirmed}</strong><small>仅确认后形成</small></div><div><span>逾期 / 失败</span><strong>0 / 0</strong><small>当前组合</small></div></section><section class="decision-grid">${rows.map((scene) => decisionCard(scene)).join("")}</section><section class="table-card"><table><thead><tr><th>场景</th><th>Action Request</th><th>业务主体</th><th>建议协商银行 / 负责人</th><th>状态</th><th></th></tr></thead><tbody>${rows.flatMap((scene) => decisionRows(scene)).join("")}</tbody></table></section></div>`;
  }
  function decisionCard(scene) {
    const applicable = ["S001", "S003"].includes(scene.id); const ready = step(scene.id) >= 7;
    return `<article class="decision-card tone-${scene.color}"><header><div><span class="scene-tag">${scene.id}</span><h3>${esc(scene.name)}</h3></div>${statusPill(applicable ? (step(scene.id) >= 9 ? "已确认 1 条" : ready ? "待人工确认" : "等待规则命中") : "当前范围无行动", applicable && step(scene.id) >= 9 ? "success" : applicable && ready ? "warning" : "muted")}</header><p>${esc(sample(scene.id).bank === "—" ? scene.actionSummary : `${scene.actionSummary} · 优先协商 ${sample(scene.id).bank}`)}</p><footer>${applicable ? actionButton("run-module", step(scene.id) >= 9 ? "查看待办" : ready ? "打开确认门" : "生成行动申请", `data-scene="${scene.id}" data-module="decision" data-target="${step(scene.id) >= 9 ? 9 : ready ? 8 : 7}"`, step(scene.id) >= 7 ? "" : "primary") : actionButton("open-drawer", "查看边界", `data-scene="${scene.id}" data-module="decision"`, "ghost")}</footer></article>`;
  }
  function decisionRows(scene) {
    if (!["S001", "S003"].includes(scene.id)) return [`<tr><td><span class="scene-tag">${scene.id}</span></td><td colspan="4" class="muted-cell">当前场景范围不产生 Action Request</td><td><button class="text-btn" data-action="open-drawer" data-module="decision" data-scene="${scene.id}">查看详情 ${icon("arrow")}</button></td></tr>`];
    const count = scene.id === "S001" ? 3 : 2; return Array.from({ length: count }, (_, index) => { const confirmed = step(scene.id) >= 9 && index === 0; const pending = step(scene.id) >= 7; return `<tr><td><span class="scene-tag">${scene.id}</span></td><td><code>AR-${scene.id}-${String(index + 1).padStart(3, "0")}</code><small>${index === 0 ? "融资成本优化" : "债务结构复核"}</small></td><td>${esc(scene.organization || "集团业务主体")}</td><td>${esc(index === 0 ? sample(scene.id).bank : sample(scene.id).owner)}</td><td>${statusPill(confirmed ? "已形成待办" : pending ? "待人工确认" : "尚未提交", confirmed ? "success" : pending ? "warning" : "muted")}</td><td><button class="text-btn" data-action="open-drawer" data-module="decision" data-scene="${scene.id}" data-index="${index}">查看详情 ${icon("arrow")}</button></td></tr>`; });
  }
  function agentView() {
    const rows = filteredScenes();
    const tab = ui.agentTab;
    return `<div class="page module-page">${moduleHeader("agent", "Agent 应用", "Agent 配置、会话和运行记录统一归 Agent 应用；报告伴读只解释报告中心提供的固定上下文和确定性核验结果。", actionButton("refresh", "刷新运行记录", "", "ghost"))}<div class="tabs"><button class="tab ${tab === "catalog" ? "active" : ""}" data-tab="agent" data-value="catalog">Agent 目录</button><button class="tab ${tab === "runs" ? "active" : ""}" data-tab="agent" data-value="runs">运行记录</button><button class="tab ${tab === "companion" ? "active" : ""}" data-tab="agent" data-value="companion">报告伴读</button></div>${tab === "catalog" ? `<section class="agent-grid">${rows.map(agentCard).join("")}</section>` : tab === "runs" ? `<section class="table-card"><table><thead><tr><th>场景</th><th>Agent</th><th>运行上下文</th><th>证据输入</th><th>状态</th><th></th></tr></thead><tbody>${rows.map((scene) => `<tr><td><span class="scene-tag">${scene.id}</span></td><td>${esc(sample(scene.id).queryAgent)}</td><td>scenarioRunId · ${esc(record(scene.id)?.scenarioRunId || "尚未形成")}</td><td>${esc(scene.evidence)}</td><td>${statusPill(step(scene.id) >= 14 ? "可运行" : "待报告发布", step(scene.id) >= 14 ? "success" : "muted")}</td><td><button class="text-btn" data-action="open-drawer" data-module="agent" data-scene="${scene.id}">查看详情 ${icon("arrow")}</button></td></tr>`).join("")}</tbody></table></section>` : `<section class="companion-grid">${rows.map(companionCard).join("")}</section>`}</div>`;
  }
  function agentCard(scene) {
    const s = sample(scene.id); const ready = step(scene.id) >= 13;
    return `<article class="agent-card"><header><div class="agent-avatar">${icon("bot")}</div><div><span class="scene-tag">${scene.id}</span><h3>${esc(s.queryAgent)}</h3><p>${esc(scene.name)}</p></div>${statusPill(ready ? "已配置" : "已登记", ready ? "success" : "muted")}</header><dl><div><dt>Prompt</dt><dd>报告核验解释 v2</dd></div><div><dt>Skill</dt><dd>证据解释 · 结果对比</dd></div><div><dt>资源白名单</dt><dd>${esc(scene.evidence)} · C017</dd></div></dl><footer>${actionButton("run-module", ready ? "查看运行" : "运行伴读", `data-scene="${scene.id}" data-module="agent" data-target="13"`, ready ? "" : "primary")}<button class="text-btn" data-action="open-drawer" data-module="agent" data-scene="${scene.id}">配置详情 ${icon("arrow")}</button></footer></article>`;
  }
  function companionCard(scene) { const ready = step(scene.id) >= 14; return `<article class="companion-card"><div class="companion-icon">${icon("file")}</div><div><span class="scene-tag">${scene.id}</span><h3>${esc(scene.name)}</h3><p>固定报告上下文 · ${esc(scene.evidence)}</p><strong>${ready ? "可以开始伴读" : "报告发布后可用"}</strong></div><button class="btn" data-action="open-drawer" data-module="agent" data-scene="${scene.id}">打开伴读</button></article>`; }
  function reportView() {
    const tab = ui.reportTab; const rows = filteredScenes();
    return `<div class="page module-page">${moduleHeader("report", "报告中心", "报告定义、通用仪表盘、确定性核验、HTML/PDF 发布和当前数据比较统一在这里管理；决策运行摘要只读引用。", actionButton("run-all", "推进报告链路", "", "soft"))}<div class="tabs"><button class="tab ${tab === "definitions" ? "active" : ""}" data-tab="report" data-value="definitions">报告定义</button><button class="tab ${tab === "artifacts" ? "active" : ""}" data-tab="report" data-value="artifacts">报告产物</button><button class="tab ${tab === "dashboard" ? "active" : ""}" data-tab="report" data-value="dashboard">仪表盘</button></div>${tab === "definitions" ? reportDefinitions(rows) : tab === "dashboard" ? reportDashboard(rows) : reportArtifacts(rows)}</div>`;
  }
  function reportDefinitions(rows) {
    return `<section class="definition-grid">${rows.map((scene) => `<article class="definition-card"><header><div><span class="scene-tag">${scene.id}</span><h3>${esc(sample(scene.id).reportDefinition)}</h3></div>${statusPill(step(scene.id) >= 10 ? "可生成" : "等待上游", step(scene.id) >= 10 ? "success" : "muted")}</header><p>源内容项、模板槽位和证据锚点按场景保留；模板可下载查看。</p><dl><div><dt>模板版本</dt><dd>${scene.id === "S001" ? "融资报告模板 v1.2" : scene.id === "S004" ? "贷前调查模板 v2.1" : "场景模板 v1"}</dd></div><div><dt>可用输出</dt><dd>受控 HTML · 同源 PDF</dd></div></dl><footer><a class="btn" href="../report-center/review-lifecycle/templates/s001-financing-report-template.html" target="_blank" rel="noopener">${icon("download")}下载模板</a><button class="text-btn" data-action="open-drawer" data-module="report" data-scene="${scene.id}">查看定义 ${icon("arrow")}</button></footer></article>`).join("")}</section>`;
  }
  function reportArtifacts(rows) {
    return `<section class="table-card"><table><thead><tr><th>场景</th><th>正式报告</th><th>报告版本</th><th>核验</th><th>HTML / PDF</th><th>当前比较</th><th>状态</th><th></th></tr></thead><tbody>${rows.map((scene) => { const generated = step(scene.id) >= 10; const verified = step(scene.id) >= 12; const published = step(scene.id) >= 13; const compared = step(scene.id) >= 15; return `<tr><td><span class="scene-tag">${scene.id}</span><strong>${esc(scene.name)}</strong></td><td><code>${generated ? esc(scene.report) : "尚未生成"}</code><small>${generated ? esc(scene.asOf) : "等待决策摘要和模板槽位"}</small></td><td>${generated ? "内容版本 1.0" : "—"}</td><td>${statusPill(verified ? "已核验" : generated ? "待核验" : "未开始", verified ? "success" : generated ? "warning" : "muted")}</td><td>${statusPill(published ? "HTML + PDF" : "待发布", published ? "success" : "muted")}</td><td>${statusPill(compared ? "已记录" : published ? "可比较" : "不可比较", compared ? "success" : published ? "warning" : "muted")}</td><td>${statusPill(published ? "已发布" : generated ? "草稿" : "未开始", published ? "success" : generated ? "warning" : "muted")}</td><td class="row-actions">${actionButton("run-module", published ? "记录当前比较" : generated ? "继续报告链路" : "生成报告", `data-scene="${scene.id}" data-module="report" data-target="${published ? 14 : generated ? 12 : 10}"`, published ? "" : "primary")}<button class="text-btn" data-action="open-drawer" data-module="report" data-scene="${scene.id}">查看详情 ${icon("arrow")}</button></td></tr>`; }).join("")}</tbody></table></section>`;
  }
  function reportDashboard(rows) {
    const totals = rows.map((scene) => ({ scene, value: scene.id === "S001" ? 2.37 : scene.id === "S002" ? 76.4 : scene.id === "S003" ? 4 : 18 }));
    return `<section class="dashboard-layout"><div class="dashboard-hero"><div><span class="eyebrow">报告中心 · 通用业务分析仪表盘</span><h3>四场景经营与风险总览</h3><p>仪表盘只消费已发布语义和数据摘要；需要决定什么、由谁执行，回到决策中心查看。</p></div><div class="dashboard-stamp">截至 ${esc(new Date().toISOString().slice(0, 10))}</div></div><div class="dashboard-metrics"><div><span>融资成本</span><strong>2.37%</strong><small>S001 加权平均</small></div><div><span>预算执行率</span><strong>76.4%</strong><small>S002 当前摘要</small></div><div><span>红色风险企业</span><strong>4 家</strong><small>S003 当前摘要</small></div><div><span>贷前核验</span><strong>18/18</strong><small>S004 固定事实包</small></div></div><div class="chart-card"><header><div><h3>场景关键结果</h3><p>同一图层展示不同业务域，不合并口径。</p></div><div class="chart-legend"><span><i class="dot blue"></i>S001</span><span><i class="dot violet"></i>S002</span><span><i class="dot amber"></i>S003</span><span><i class="dot green"></i>S004</span></div></header><div class="multi-bars">${totals.map((item) => `<div class="bar-group"><div class="bar-value">${esc(String(item.value))}${item.scene.id === "S001" ? "%" : item.scene.id === "S002" ? "%" : item.scene.id === "S003" ? " 家" : " 项"}</div><div class="bar-track"><b class="bar-fill tone-${item.scene.color}" style="height:${Math.min(100, item.value)}%"></b></div><span>${item.scene.id}<small>${esc(item.scene.name)}</small></span></div>`).join("")}</div></div><div class="dashboard-foot"><button class="btn" data-action="open-drawer" data-module="report" data-scene="S001">查看指标来源</button><button class="btn" data-route="decision">查看决策运营概览 ${icon("arrow")}</button></div></section>`;
  }
  function drawer() {
    if (!ui.drawer) return "";
    const scene = sceneById(ui.drawer.scene); const moduleId = ui.drawer.module; const d = sample(scene.id); const current = record(scene.id);
    const content = moduleId === "data" ? `<dl class="drawer-grid"><div><dt>来源文件</dt><dd>${esc(scene.source)}</dd></div><div><dt>数据资产</dt><dd>${esc(scene.asset)}</dd></div><div><dt>管道</dt><dd>${esc(d.pipeline)}</dd></div><div><dt>质量摘要</dt><dd>${esc(d.quality)}</dd></div><div><dt>数据截至</dt><dd>${esc(scene.asOf)}</dd></div><div><dt>运行轮次</dt><dd>${esc(current?.scenarioRunId || "尚未形成")}</dd></div></dl><div class="drawer-callout">${scene.id === "S003" ? "兼容性验证版本不可消费；正式建设时需重新形成正式候选。" : "发布资产后，本体管理只读引用精确版本，不会随上游新版本漂移。"}</div>` : moduleId === "ontology" ? `<dl class="drawer-grid"><div><dt>Published 本体</dt><dd>${esc(scene.ontology)}</dd></div><div><dt>资源范围</dt><dd>${esc(d.ontologyScope)}</dd></div><div><dt>来源资产</dt><dd>${esc(scene.asset)}</dd></div><div><dt>刷新状态</dt><dd>${step(scene.id) >= 4 ? "可提交刷新" : "等待目标绑定"}</dd></div><div><dt>指标 / Rule</dt><dd>${scene.id === "S001" ? "7 / 3" : "按场景登记"}</dd></div><div><dt>权威消费</dt><dd>C008 / T019</dd></div></dl>` : moduleId === "query" ? `<dl class="drawer-grid"><div><dt>原问题与理解</dt><dd>${esc(ui.query.answer?.summary || "等待提问")}</dd></div><div><dt>查询范围</dt><dd>${esc(scene.name)}</dd></div><div><dt>固定结果</dt><dd>${esc(ui.query.answer?.value || "尚未形成")}</dd></div><div><dt>Agent 配置</dt><dd>Query Agent / v1.4</dd></div><div><dt>Published 语义版本</dt><dd>${esc(scene.ontology)}</dd></div><div><dt>数据截至时间</dt><dd>${esc(scene.asOf)}</dd></div></dl><div class="drawer-callout">问数只读取 C017 可信度摘要和本体消费投影，不读取工作簿明细，也不维护决策运行状态。</div>` : moduleId === "decision" ? `<dl class="drawer-grid"><div><dt>Action Request</dt><dd>${["S001", "S003"].includes(scene.id) ? `${scene.id}-AR-001` : "不适用"}</dd></div><div><dt>优先协商银行</dt><dd>${esc(d.bank)}</dd></div><div><dt>负责人</dt><dd>${esc(d.owner)}</dd></div><div><dt>确认门</dt><dd>${step(scene.id) >= 9 ? "已确认" : "人工确认后形成待办"}</dd></div></dl><div class="drawer-callout">决策中心只维护运行事实。报告中心和问数只能受控提交 Action Request，不能直接创建待办。</div>` : moduleId === "agent" ? `<dl class="drawer-grid"><div><dt>配置版本</dt><dd>Agent Config / v1.4</dd></div><div><dt>Prompt 版本</dt><dd>报告核验解释 v2</dd></div><div><dt>Skill 集合</dt><dd>证据解释 · 结果比较</dd></div><div><dt>Published 本体</dt><dd>${esc(scene.ontology)}</dd></div><div><dt>可读上下文</dt><dd>${esc(scene.evidence)} · C017 摘要</dd></div><div><dt>运行状态</dt><dd>${step(scene.id) >= 14 ? "可运行" : "报告发布后可运行"}</dd></div></dl>` : `<dl class="drawer-grid"><div><dt>报告定义</dt><dd>${esc(d.reportDefinition)}</dd></div><div><dt>当前产物</dt><dd>${esc(scene.report)}</dd></div><div><dt>证据包</dt><dd>${esc(scene.evidence)}</dd></div><div><dt>HTML / PDF</dt><dd>同一报告编号与内容版本</dd></div><div><dt>当前比较</dt><dd>${step(scene.id) >= 15 ? "已记录" : "显式发起后形成独立记录"}</dd></div><div><dt>伴读</dt><dd>报告固定上下文，只读</dd></div></dl>`;
    return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="detail-drawer" data-detail-drawer><header><div><span class="eyebrow">${esc(MODULE_LABELS[moduleId])} · ${scene.id}</span><h2>${esc(scene.name)}</h2></div><button class="icon-btn" data-action="close-drawer" aria-label="关闭">${icon("close")}</button></header><div class="drawer-body">${content}</div><footer>${moduleId !== "report" ? actionButton("run-module", "推进本模块", `data-scene="${scene.id}" data-module="${moduleId}" data-target="${STEP_BY_MODULE[moduleId] ?? 0}"`, "primary") : actionButton("run-module", "继续报告链路", `data-scene="${scene.id}" data-module="report" data-target="14"`, "primary")}<button class="btn" data-action="close-drawer">关闭</button></footer></aside></div>`;
  }
  function moduleView(moduleId) {
    if (moduleId === "data") return dataView();
    if (moduleId === "ontology") return ontologyView();
    if (moduleId === "query") return queryView();
    if (moduleId === "decision") return decisionView();
    if (moduleId === "agent") return agentView();
    if (moduleId === "report") return reportView();
    return homeView();
  }
  function render() {
    ui.module = route.split("/")[0] || "home";
    if (route.startsWith("report/")) ui.reportTab = route.split("/")[1] || ui.reportTab;
    persistUi();
    app.innerHTML = `<div class="composite-shell composite-x">${nav()}<section class="composite-workspace">${topbar()}<main class="composite-main">${route === "home" ? homeView() : moduleView(ui.module)}</main></section></div>${drawer()}`;
    bindCanvas();
  }
  function bindCanvas() {
    const surface = document.querySelector("[data-canvas='surface']"); if (!surface || surface.dataset.bound) return;
    surface.dataset.bound = "1"; let scale = 1; let x = 0; let y = 0; let dragging = false; let startX = 0; let startY = 0;
    const content = surface.querySelector(".canvas-grid");
    const apply = () => { surface.querySelectorAll(".canvas-node,.canvas-link,.canvas-grid").forEach((el) => { el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`; }); const label = surface.closest(".canvas-panel")?.querySelector("[data-canvas='scale-label']"); if (label) label.textContent = `${Math.round(scale * 100)}%`; };
    surface.addEventListener("wheel", (event) => { event.preventDefault(); scale = Math.max(.65, Math.min(1.5, scale + (event.deltaY < 0 ? .08 : -.08))); apply(); }, { passive: false });
    surface.addEventListener("pointerdown", (event) => { if (event.target.closest(".canvas-node")) return; dragging = true; startX = event.clientX - x; startY = event.clientY - y; surface.setPointerCapture(event.pointerId); });
    surface.addEventListener("pointermove", (event) => { if (!dragging) return; x = event.clientX - startX; y = event.clientY - startY; apply(); });
    surface.addEventListener("pointerup", () => { dragging = false; });
    document.querySelectorAll("[data-canvas='zoom-in']").forEach((button) => button.addEventListener("click", () => { scale = Math.min(1.5, scale + .1); apply(); }));
    document.querySelectorAll("[data-canvas='zoom-out']").forEach((button) => button.addEventListener("click", () => { scale = Math.max(.65, scale - .1); apply(); }));
    document.querySelectorAll("[data-canvas='reset']").forEach((button) => button.addEventListener("click", () => { scale = 1; x = 0; y = 0; apply(); }));
    apply();
  }
  function toast(message) { const node = document.createElement("div"); node.className = "toast-message"; node.textContent = message; document.getElementById("toast-region")?.appendChild(node); setTimeout(() => node.remove(), 2600); }
  async function runModule(sceneId, moduleId, target) { ui.drawer = null; persistUi(); toast(`${sceneId} 正在处理${R.STEP_LABELS[target] || "当前步骤"}`); await R.runToStep(sceneId, Number(target)); toast(`${sceneId} 已更新，可以继续下一步`); render(); }
  function submitQuestion(sceneId, question) { ui.query.text = question; ui.query.running = true; ui.query.answer = null; const resolvedScene = sceneId || (/预算/.test(question) ? "S002" : /风险|企业|环保/.test(question) ? "S003" : /贷前|借款人|材料/.test(question) ? "S004" : "S001"); ui.query.history = [...ui.query.history, { scene: resolvedScene, question }].slice(-12); persistUi(); render(); setTimeout(async () => { if (step(resolvedScene) < 6) await R.runToStep(resolvedScene, 5); const answer = makeAnswer(resolvedScene, question); ui.query.running = false; ui.query.answer = answer; persistUi(); render(); }, 720); }
  document.addEventListener("click", async (event) => {
    const routeTarget = event.target.closest("[data-route]"); if (routeTarget) { navigate(routeTarget.dataset.route); return; }
    const tab = event.target.closest("[data-tab]"); if (tab) { const type = tab.dataset.tab; if (type === "report") { ui.reportTab = tab.dataset.value; navigate(`report/${ui.reportTab}`); } else { ui.agentTab = tab.dataset.value; render(); } return; }
    const sceneSelect = event.target.closest("[data-ui='scene']"); if (sceneSelect) return;
    const action = event.target.closest("[data-action]"); if (!action) return;
    const type = action.dataset.action;
    if (type === "refresh") { render(); return; }
    if (type === "run-all") { toast("四个场景正在按顺序运行"); await R.runAll(); toast("四个场景已完成本轮运行"); render(); return; }
    if (type === "upload-source") { const input = document.createElement("input"); input.type = "file"; input.accept = ".xlsx,.xls,.csv"; input.addEventListener("change", () => { const file = input.files?.[0]; if (!file) return; ui.uploadedFile = file.name; persistUi(); toast(`已读取 ${file.name}`); render(); }); input.click(); return; }
    if (type === "reset-all") { R.SCENARIOS.forEach((scene) => R.resetScenario(scene.id)); ui.query.answer = null; ui.query.history = []; persistUi(); render(); return; }
    if (type === "run-scene") { await R.runScenario(action.dataset.scene); render(); return; }
    if (type === "run-module") { await runModule(action.dataset.scene, action.dataset.module, action.dataset.target); return; }
    if (type === "open-drawer") { ui.drawer = { module: action.dataset.module, scene: action.dataset.scene, index: action.dataset.index }; persistUi(); render(); return; }
    if (type === "close-drawer") { ui.drawer = null; persistUi(); render(); return; }
    if (type === "open-scene") { ui.drawer = { module: "report", scene: action.dataset.scene }; persistUi(); render(); return; }
    if (type === "ask") { submitQuestion(action.dataset.scene, action.dataset.question); return; }
    if (type === "new-query") { ui.query = { text: "", answer: null, running: false, history: ui.query.history || [] }; persistUi(); toast("已新建问数会话"); render(); return; }
    if (type === "clear-query") { ui.query = { text: "", answer: null, running: false, history: [] }; persistUi(); render(); return; }
    if (type === "restore-query") { try { const item = JSON.parse(action.dataset.history); submitQuestion(item.scene, item.question); } catch (_) {} return; }
    if (type === "toggle-chart") { ui.chart = ui.chart === "bar" ? "line" : "bar"; persistUi(); render(); return; }
    if (type === "export-csv") { const answer = ui.query.answer; if (!answer) return; const csv = `场景,指标,结果,截至时间\n${answer.scene},${answer.summary},${answer.value},${answer.asOf}\n`; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })); link.download = `${answer.scene}-问数结果.csv`; link.click(); URL.revokeObjectURL(link.href); toast("CSV 已下载"); return; }
    if (type === "open-answer-detail") { ui.drawer = { module: "query", scene: ui.query.answer?.scene || "S001" }; persistUi(); render(); return; }
  });
  document.addEventListener("submit", (event) => { if (event.target.dataset.form !== "query") return; event.preventDefault(); const value = new FormData(event.target).get("question"); if (String(value).trim()) submitQuestion(null, String(value).trim()); });
  document.addEventListener("change", (event) => { if (event.target.dataset.ui === "scene") { ui.scene = event.target.value; persistUi(); render(); } });
  document.addEventListener("input", (event) => { if (event.target.dataset.ui === "search") { ui.search = event.target.value; const query = ui.search.trim().toLowerCase(); document.querySelectorAll("tbody tr[data-row-text]").forEach((row) => { row.hidden = query && !row.dataset.rowText.toLowerCase().includes(query); }); } });
  window.addEventListener("hashchange", () => { route = (location.hash || "#home").replace(/^#/, "") || "home"; render(); });
  window.addEventListener("popstate", () => { route = (location.hash || "#home").replace(/^#/, "") || "home"; render(); });
  R.subscribe(render);
  render();
})();
