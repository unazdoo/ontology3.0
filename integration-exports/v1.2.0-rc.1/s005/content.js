(function mountS005Content(root) {
  "use strict";

  const CONFIG_API = root.OFWS005ScenarioConfig;
  const ADAPTER = root.OFWS005ScenarioAdapter;
  const mount = document.getElementById("s005-root");
  const toast = document.getElementById("s005-toast");
  if (!CONFIG_API || !ADAPTER || !mount) throw new Error("S005 content dependencies are incomplete");

  const { config, workflow } = CONFIG_API;
  const state = {
    fixture: null,
    runtime: null,
    view: "overview",
    hostConnected: root.parent && root.parent !== root,
    toastTimer: null
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    root.clearTimeout(state.toastTimer);
    state.toastTimer = root.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function send(type, detail) {
    const message = { type, packageId: "S005-v1-minimal-prototype", detail };
    if (state.hostConnected) root.parent.postMessage(message, root.location.origin);
    root.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function createRuntime(context) {
    return ADAPTER.createRuntime({
      context,
      emit(type, detail) {
        send(type, detail);
        render();
      }
    });
  }

  function contextFromQuery() {
    const query = new URLSearchParams(root.location.search);
    const candidate = {
      scenarioId: query.get("scenarioId"),
      scenarioVersion: query.get("scenarioVersion"),
      scenarioRunId: query.get("scenarioRunId"),
      formedAt: query.get("formedAt"),
      status: query.get("status")
    };
    return ADAPTER.validateScenarioContext(candidate).ok ? candidate : null;
  }

  function badge(value, tone) {
    const normalized = tone === "green" || tone === "amber" || tone === "red" ? tone : "gray";
    return `<span class="badge ${normalized}">${esc(value)}</span>`;
  }

  function header(runtimeState) {
    return `<header class="content-head">
      <div class="content-head-main">
        <span class="scenario-mark">S005</span>
        <div><span class="eyebrow">POST-INVESTMENT EVALUATION · RESEARCH</span><h1>金融产品投后评价</h1><p>市场横评、持续合规、池内选择与交易风险共用同一 S005 研究轮次；结果只作证据化走查。</p></div>
      </div>
      <div class="head-actions">
        <span class="badge ${state.hostConnected ? "green" : "gray"}">${state.hostConnected ? "父 Shell 已连接" : "独立预览"}</span>
        <button class="btn" type="button" data-action="reset">新建研究轮次</button>
        <button class="btn primary" type="button" data-action="run-all" ${runtimeState.completed === runtimeState.total ? "disabled" : ""}>${runtimeState.completed === runtimeState.total ? "研究链路已完成" : "运行研究链路"}</button>
      </div>
    </header>`;
  }

  function contextStrip(runtimeState) {
    const context = runtimeState.scenarioContext;
    return `<section class="context-strip" aria-label="S005 场景上下文">
      <div class="context-main"><strong>${esc(context.scenarioRunId)}</strong><small>${esc(context.scenarioId)} · ${esc(context.scenarioVersion)} · ${esc(config.namespace)}</small></div>
      <div class="context-item"><span>父版本</span><strong>${esc(config.parentVersion)}</strong></div>
      <div class="context-item"><span>目标原型</span><strong>${esc(config.targetPrototypeVersion)}</strong></div>
      <div class="context-item"><span>数据截至</span><strong>${esc(state.fixture.asOf)}</strong></div>
      <div class="context-item"><span>运行进度</span><strong>${runtimeState.completed} / ${runtimeState.total}</strong></div>
    </section>`;
  }

  function tabs() {
    const items = [
      ["overview", "全周期总览"],
      ["market", "市场横评"],
      ["compliance", "准入合规"],
      ["selection", "池内选择"],
      ["risk", "交易与风险"]
    ];
    return `<nav class="tabs" aria-label="S005 视图">${items.map(([id, label]) => `<button type="button" class="tab ${state.view === id ? "active" : ""}" data-view="${id}">${label}</button>`).join("")}</nav>`;
  }

  function stageRail(runtimeState) {
    return `<section class="stage-rail" aria-label="S005 研究阶段">${workflow.map((step) => {
      const stage = runtimeState.stages[step.id];
      return `<button type="button" class="stage ${stage.status}" data-stage="${step.id}"><span class="stage-order">${String(step.order).padStart(2, "0")} · ${step.moduleId}</span><strong>${esc(step.title)}</strong><span class="stage-meta"><span>${stage.status === "complete" ? "已完成" : stage.status === "running" ? "运行中" : "待运行"}</span><i class="stage-dot"></i></span></button>`;
    }).join("")}</section>`;
  }

  function kpis() {
    return `<section class="kpi-grid">${state.fixture.kpis.map((item) => `<article class="kpi ${item.tone}"><span>${esc(item.label)}</span><strong>${esc(item.value)} <em>${esc(item.unit)}</em></strong><small>研究夹具 · 未发布</small></article>`).join("")}</section>`;
  }

  function chartPanel() {
    const series = state.view === "selection" ? state.fixture.selectionSeries : state.fixture.marketSeries;
    const labels = series.labels;
    const legend = state.view === "selection"
      ? [["已选交易", "#1d5d8b"], ["可执行未选", "#9aa8b3"]]
      : [["入池组合", "#1d5d8b"], ["同类中位数", "#4f8e8c"], ["同类前三分之一", "#9a651d"], ["合同基准", "#71559d"]];
    return `<section class="panel">
      <header class="panel-head"><div><h2>${state.view === "selection" ? "选中与可执行未选" : "入池组合与市场同类"}</h2><p>${state.view === "selection" ? "交易后窗口差异，不把不可交易对象当负例" : "归一化研究序列；正式数据待授权来源接入"}</p></div>${badge("研究夹具", "amber")}</header>
      <div class="panel-body chart-wrap"><canvas id="s005-chart" class="chart-canvas" aria-label="${esc(labels.join("、"))}"></canvas><div class="legend">${legend.map(([label, color]) => `<span><i style="--legend:${color}"></i>${label}</span>`).join("")}</div></div>
    </section>`;
  }

  function mountPanel(runtimeState) {
    const objectRef = state.fixture.products[0].objectRef;
    return `<aside class="panel">
      <header class="panel-head"><div><h2>跨模块挂载</h2><p>父 Shell 负责路由；S005 只发送精确上下文</p></div>${badge("只读", "green")}</header>
      <div class="panel-body mount-list">
        <article class="mount"><span class="mount-mark">M07</span><div class="mount-body"><strong>多视图探索</strong><small>对象、版本、评价日与 Lens 意图必须同时固定。</small><div class="mount-actions"><button class="btn compact" type="button" data-open-module="M07">打开对象探索</button></div></div></article>
        <article class="mount"><span class="mount-mark">M08</span><div class="mount-body"><strong>模型与模拟</strong><small>只接收 PREDICTED / SIMULATED，结果不得写回事实。</small><div class="mount-actions"><button class="btn compact" type="button" data-open-module="M08">打开研究模拟</button></div></div></article>
        <article class="mount"><span class="mount-mark">M01-06</span><div class="mount-body"><strong>基线模块</strong><small>当前阶段通过 scenarioContext 回到唯一事实 Owner。</small><div class="mount-actions"><button class="btn compact" type="button" data-open-module="${workflow[Math.min(runtimeState.completed, workflow.length - 1)].moduleId}">打开当前模块</button></div></div></article>
        <div class="boundary-note">当前对象：${esc(objectRef.title)} · ${esc(objectRef.id)}。所有跳转都保持 ${esc(runtimeState.scenarioContext.scenarioRunId)}，不复制模块状态。</div>
      </div>
    </aside>`;
  }

  function tablePanel() {
    return `<section class="panel">
      <header class="panel-head"><div><h2>评价对象与证据状态</h2><p>伪名对象、范围事实、选择状态与证据覆盖分开呈现</p></div>${badge("15 只候选", "gray")}</header>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>对象</th><th>产品分类</th><th>范围状态</th><th>选择状态</th><th>证据状态</th><th>证据入口</th></tr></thead><tbody>${state.fixture.products.map((item) => `<tr><td><strong>${esc(item.objectRef.title)}</strong><small>${esc(item.objectRef.id)}</small></td><td>${esc(item.category)}</td><td>${badge(item.scopeStatus, item.scopeStatus === "符合范围" ? "green" : item.scopeStatus === "需复核" ? "amber" : "gray")}</td><td>${esc(item.selectionStatus)}</td><td>${esc(item.evidenceStatus)}</td><td><button type="button" class="btn compact" data-open-module="M02">查看来源</button></td></tr>`).join("")}</tbody></table></div>
    </section>`;
  }

  function riskPanel() {
    return `<section class="panel">
      <header class="panel-head"><div><h2>风险与结论状态</h2><p>评分、风险灯和数据覆盖互不抵销</p></div>${badge("部分评价", "amber")}</header>
      <div class="panel-body risk-list">${state.fixture.riskLamps.map((item) => `<div class="risk-row"><strong>${esc(item.label)}</strong>${badge(item.state, item.tone)}<small>${esc(item.detail)}</small></div>`).join("")}</div>
    </section>`;
  }

  function render() {
    if (!state.fixture || !state.runtime) return;
    const runtimeState = state.runtime.getState();
    mount.innerHTML = `<div class="s005-workspace">${header(runtimeState)}${contextStrip(runtimeState)}${tabs()}${stageRail(runtimeState)}${kpis()}<div class="main-grid">${chartPanel()}${mountPanel(runtimeState)}</div><div class="main-grid">${tablePanel()}${riskPanel()}</div></div>`;
    setupEvents();
    root.requestAnimationFrame(drawChart);
  }

  function setupEvents() {
    mount.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    }));
    mount.querySelectorAll("[data-stage]").forEach((button) => button.addEventListener("click", () => openStage(button.dataset.stage)));
    mount.querySelectorAll("[data-open-module]").forEach((button) => button.addEventListener("click", () => openModule(button.dataset.openModule)));
    mount.querySelector("[data-action='run-all']")?.addEventListener("click", () => {
      state.runtime.completeAll();
      notify("七个研究阶段已在当前 S005 轮次完成");
    });
    mount.querySelector("[data-action='reset']")?.addEventListener("click", () => {
      const receipt = state.runtime.reset();
      send("OFW_S005_RESET_REQUEST", receipt);
      notify(`已创建新轮次：${receipt.scenarioRunId}`);
      render();
    });
  }

  function openStage(stageId) {
    const step = workflow.find((item) => item.id === stageId);
    if (step) openModule(step.moduleId);
  }

  function basePayload() {
    const fixture = state.fixture;
    return {
      scenarioContext: state.runtime.getContext(),
      objectRef: fixture.products[0].objectRef,
      dataVersionId: fixture.versionRefs.dataVersionId,
      ontologyVersionId: fixture.versionRefs.ontologyVersionId
    };
  }

  function openModule(moduleId) {
    const payload = basePayload();
    if (moduleId === "M07") Object.assign(payload, { asOf: state.fixture.asOf, lensIntent: "POST_INVESTMENT_OBJECT_360" });
    if (moduleId === "M08") Object.assign(payload, {
      modelingObjectiveRef: state.fixture.versionRefs.modelingObjectiveRef,
      evaluationInputRef: state.fixture.versionRefs.evaluationInputRef,
      resultKind: "SIMULATED"
    });
    try {
      const envelope = ADAPTER.createNavigationEnvelope(moduleId, payload);
      send(envelope.type, envelope);
      notify(state.hostConnected ? `已请求父 Shell 打开 ${moduleId}` : `${moduleId} 挂载请求已验证；独立预览不执行路由`);
    } catch (error) {
      notify(error.message);
    }
  }

  function drawChart() {
    const canvas = document.getElementById("s005-chart");
    if (!canvas) return;
    const ratio = Math.max(1, Math.min(2, root.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    const width = rect.width;
    const height = rect.height;
    const margin = { top: 18, right: 14, bottom: 30, left: 38 };
    const source = state.view === "selection" ? state.fixture.selectionSeries : state.fixture.marketSeries;
    const lines = state.view === "selection"
      ? [{ values: source.selected, color: "#1d5d8b" }, { values: source.eligibleUnselected, color: "#9aa8b3" }]
      : [{ values: source.pool, color: "#1d5d8b" }, { values: source.peerMedian, color: "#4f8e8c" }, { values: source.peerTopThird, color: "#9a651d" }, { values: source.benchmark, color: "#71559d" }];
    const values = lines.flatMap((line) => line.values);
    const low = Math.min(...values) - 0.2;
    const high = Math.max(...values) + 0.2;
    const x = (index) => margin.left + (index / Math.max(1, source.labels.length - 1)) * (width - margin.left - margin.right);
    const y = (value) => margin.top + ((high - value) / Math.max(.001, high - low)) * (height - margin.top - margin.bottom);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#e2e8ec";
    context.lineWidth = 1;
    for (let index = 0; index < 4; index += 1) {
      const gridY = margin.top + (index / 3) * (height - margin.top - margin.bottom);
      context.beginPath(); context.moveTo(margin.left, gridY); context.lineTo(width - margin.right, gridY); context.stroke();
    }
    context.fillStyle = "#68798a";
    context.font = "9px -apple-system, PingFang SC, sans-serif";
    context.textAlign = "center";
    source.labels.forEach((label, index) => context.fillText(label, x(index), height - 9));
    lines.forEach((line) => {
      context.strokeStyle = line.color;
      context.lineWidth = 2;
      context.beginPath();
      line.values.forEach((value, index) => index ? context.lineTo(x(index), y(value)) : context.moveTo(x(index), y(value)));
      context.stroke();
      context.fillStyle = line.color;
      line.values.forEach((value, index) => { context.beginPath(); context.arc(x(index), y(value), 2.3, 0, Math.PI * 2); context.fill(); });
    });
  }

  root.addEventListener("resize", () => root.requestAnimationFrame(drawChart));
  root.addEventListener("message", (event) => {
    if (event.origin !== root.location.origin || event.data?.type !== "OFW_S005_CONTEXT") return;
    const candidate = event.data.detail?.scenarioContext || event.data.detail;
    const validation = ADAPTER.validateScenarioContext(candidate);
    if (!validation.ok) return notify(validation.errors.join("; "));
    state.hostConnected = true;
    state.runtime = createRuntime(candidate);
    render();
  });

  async function start() {
    const response = await fetch("resources/s005-research-fixture.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load S005 fixture: ${response.status}`);
    state.fixture = await response.json();
    state.runtime = createRuntime(contextFromQuery() || undefined);
    render();
    send("OFW_S005_READY", {
      registration: CONFIG_API.createShellRegistration("."),
      scenarioContext: state.runtime.getContext(),
      requiredContextEvent: "OFW_S005_CONTEXT"
    });
  }

  root.S005_CONTENT_APP = Object.freeze({
    getState: () => state.runtime?.getState() || null,
    openModule,
    reset: () => state.runtime?.reset(),
    runAll: () => state.runtime?.completeAll()
  });

  start().catch((error) => {
    mount.innerHTML = `<div class="loading-state">S005 场景包加载失败：${esc(error.message)}</div>`;
    throw error;
  });
})(window);
