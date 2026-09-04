(function mountModelingObjectives(global) {
  "use strict";

  const root = document.getElementById("model-center");
  const modalRoot = document.getElementById("model-center-modal");
  const toastRoot = document.getElementById("model-center-toast");
  const params = new URLSearchParams(global.location.search);
  const apiBase = params.get("apiBase") || "http://127.0.0.1:4373";
  const hostScenarioId = params.get("scenarioId") || "";
  let scenarioId = hostScenarioId;
  if (params.get("embedded") === "1") document.documentElement.dataset.embedded = "true";

  const scenarioContext = Object.fromEntries(
    ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].map((field) => [field, params.get(field)])
  );
  const VIEWS = Object.freeze([
    ["objectives", "目标目录", "layout-list"],
    ["models", "模型与代码", "blocks"],
    ["compare", "评测对比", "chart-no-axes-combined"],
    ["observe", "候选观察", "scan-eye"],
    ["release", "发布与消费", "share-2"]
  ]);
  const VIEW_ALIASES = Object.freeze({
    overview: "objectives",
    portfolio: "models",
    benchmark: "compare",
    shadow: "observe",
    repository: "models",
    monitor: "release",
    insights: "compare",
    candidates: "observe"
  });
  const ACTION_VIEW = Object.freeze({
    "benchmark-baseline": "compare",
    "run-models": "compare",
    "generate-insights": "compare",
    "review-insights": "compare",
    "create-candidate": "observe",
    "start-shadow": "observe",
    "advance-shadow": "observe",
    rebenchmark: "observe",
    "form-release": "release",
    "validate-binding": "release",
    "apply-binding": "release",
    "run-stress": "release",
    "rollback-binding": "release",
    "start-next-cycle": "release"
  });
  const PROGRAM_IDS = Object.freeze(
    (params.get("programIds") || hostScenarioId).split(",").map((item) => item.trim()).filter(Boolean)
  );
  const PROGRAM_ICONS = Object.freeze(["landmark", "calculator", "activity", "clipboard-check", "chart-candlestick"]);
  const ROUTES = Object.freeze({ M01: "#module/ontology", M02: "#module/data" });
  const CONSUMERS = Object.freeze([
    { id: "dashboard", label: "经营驾驶舱", icon: "layout-dashboard", route: "#dashboard", views: "正式 / 候选 / 影子 / 模拟 / 差异" },
    { id: "exploration", label: "业务对象探索", icon: "waypoints", route: "#module/m07", views: "对象 / 关系 / 时序" },
    { id: "query", label: "智能问数", icon: "message-square-text", route: "#module/query", views: "问答 / 横向比较" },
    { id: "explanation", label: "智能解释", icon: "sparkles", route: "#module/agent", views: "贡献 / 异常 / 分歧" },
    { id: "report", label: "报告中心", icon: "file-chart-column", route: "#module/report", views: "版本 / 证据 / 对比" }
  ]);
  const RESULT_VIEWS = Object.freeze([
    ["formal", "正式结果"],
    ["candidate", "候选试算"],
    ["shadow", "影子观察"],
    ["simulation", "压力模拟"],
    ["diff", "正式与候选差异"]
  ]);
  const METRIC_LABELS = Object.freeze({
    primaryMetric: "核心指标",
    recallAtFixedCapacity: "固定复核量召回率",
    precisionAtFixedCapacity: "固定复核量准确率",
    prAuc: "高风险识别效果",
    brierScore: "概率误差",
    calibrationError: "校准误差",
    coverage: "数据覆盖率",
    stability: "结果稳定性",
    drift: "数据漂移",
    missingRate: "缺失率"
  });
  const LOWER_IS_BETTER = new Set(["brierScore", "calibrationError", "drift", "missingRate", "error", "mae", "rmse"]);

  const requestedInitialView = global.location.hash.slice(1) || "objectives";
  const canonicalInitialView = VIEW_ALIASES[requestedInitialView] || requestedInitialView;
  let activeView = VIEWS.some(([id]) => id === canonicalInitialView) ? canonicalInitialView : "objectives";
  let repositoryMode = requestedInitialView === "repository";
  if (global.location.hash !== `#${activeView}`) history.replaceState(null, "", `#${activeView}`);

  let context = null;
  let state = null;
  let objectives = [];
  let portfolioContexts = new Map();
  let ui = { moduleName: "模型目标与优化", domain: "业务模型", businessName: "当前目标", subjectLabel: "业务对象", consumerLabel: "业务驾驶舱" };
  let busy = "";
  let error = "";
  let hostContext = null;
  let toastTimer = null;
  let modal = null;
  let repositoryCatalog = [];
  let repositoryRegistered = false;
  let repository = null;
  let selectedRepositoryFile = "README.md";
  let repositoryDrafts = {};
  let repositoryBusy = "";
  let repositoryConsole = null;
  let repositoryError = "";
  let repositoryForm = { branchName: "", commitMessage: "", tagName: "" };
  let workspaceContext = null;
  let selectedResultView = "formal";
  const compareSelections = new Map();

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
  const icon = (name) => `<span class="icon" aria-hidden="true"><i data-lucide="${esc(name)}"></i></span>`;
  const short = (value, size = 30) => String(value || "—").length > size
    ? `${String(value).slice(0, size - 8)}...${String(value).slice(-5)}`
    : String(value || "—");
  const finite = (value) => Number.isFinite(Number(value));
  const percent = (value, digits = 1) => finite(value) ? `${(Number(value) * 100).toFixed(digits).replace(/\.0$/, "")}%` : "无法评价";
  const canonicalView = (view) => VIEW_ALIASES[view] || view;

  function statusLabel(status) {
    return ({
      DATA_PREPARATION: "准备数据",
      DATA_BUILT: "数据已形成",
      DATA_VALIDATED: "质量已校验",
      DATA_FROZEN: "数据版本已冻结",
      CONTRACT_READY: "语义合同已就绪",
      BASELINE_BENCHMARKED: "正式模型已评测",
      MODEL_PORTFOLIO_EVALUATED: "模型组合已评测",
      INSIGHT_REVIEW_REQUIRED: "洞察待审查",
      INSIGHTS_APPROVED: "洞察审查已批准",
      INSIGHTS_REJECTED: "洞察审查已驳回",
      CANDIDATE_READY: "候选版本已形成",
      SHADOW_ACTIVE: "影子观察中",
      SHADOW_MATURED: "影子观察已成熟",
      REBENCHMARKED: "成熟标签已复评",
      RELEASE_CANDIDATE_READY: "发布候选已形成",
      BINDING_VALIDATED: "消费绑定已校验",
      BINDING_APPLIED: "持续监测中",
      BINDING_ROLLED_BACK: "候选应用已回退",
      CLOSED_FOR_NEXT_CYCLE: "已进入下一周期"
    })[status] || status || "正在读取";
  }

  function businessStatus(status) {
    return ({
      EVALUATED: "已完成评测",
      SUCCEEDED: "运行成功",
      PASSED: "测试通过",
      ACTIVE: "观察中",
      MATURED: "观察已成熟",
      VALIDATED: "已校验",
      VALID: "校验通过",
      APPLIED: "已应用",
      ROLLED_BACK: "已回退",
      RESEARCH_EVALUATED: "已完成评测",
      RESEARCH_BENCHMARK_READY: "可运行评测",
      CONTRACT_READY: "业务合同已就绪",
      MODEL_PORTFOLIO_RUNTIME_READY: "模型组合可运行",
      DETERMINISTIC_LONGITUDINAL_RUNTIME_READY: "纵向评测可运行",
      SYNTHETIC_PREVIEW_READY: "评测数据可用",
      SYNTHETIC_PREVIEW_ONLY: "评测合同已形成",
      ISOLATED_RUN_READY: "隔离运行可用",
      EVALUATED_AWAITING_SHADOW: "已评测，待影子观察"
    })[status] || status || "尚未形成";
  }

  function roleLabel(role) {
    return ({ FORMAL_BASELINE: "当前正式模型", CORE_CHALLENGER: "Challenger", SUPPLEMENTAL: "补充模型" })[role] || role || "模型";
  }

  function objectiveKindLabel(kind) {
    return ({ FORECAST: "预测", CLASSIFICATION: "分类", SCORING: "评分", OPTIMIZATION: "优化" })[kind] || kind || "建模";
  }

  function resultKindLabel(kind) {
    return ({ FACT: "正式结果", PREDICTION: "候选预测", SHADOW: "影子观察", SIMULATION: "压力模拟" })[kind] || kind || "结果";
  }

  function metricLabel(key) {
    return METRIC_LABELS[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  function metricValue(key, value) {
    if (!finite(value)) return "无法评价";
    if (Math.abs(Number(value)) <= 1) return percent(value);
    return Number(value).toFixed(2).replace(/\.00$/, "");
  }

  function metricWidth(value, max) {
    if (!finite(value)) return 0;
    return Math.max(3, Math.min(100, Math.abs(Number(value)) / Math.max(max, 0.01) * 100));
  }

  function formatMetricCard(card) {
    if (!finite(card?.value)) return "无法评价";
    if (card.format === "percent") return percent(card.value);
    return Number(card.value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["content-type"] = "application/json";
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || `服务返回 ${response.status}`), { code: body.code || "REQUEST_FAILED" });
    return body;
  }

  function programContext(targetScenarioId = scenarioId) {
    return portfolioContexts.get(targetScenarioId) || null;
  }

  function programName(targetScenarioId = scenarioId, payload = programContext(targetScenarioId)) {
    return payload?.ui?.businessName || payload?.scenario?.businessName || "业务建模目标";
  }

  function versionOptions(sourceState = state) {
    const options = [];
    const seen = new Set();
    for (const model of sourceState?.modelDefinitions || []) {
      if (seen.has(model.modelVersionId)) continue;
      seen.add(model.modelVersionId);
      options.push({
        modelId: model.modelId,
        versionId: model.modelVersionId,
        name: model.name,
        role: model.modelRole,
        objectiveId: model.objectiveId
      });
    }
    for (const candidate of sourceState?.candidates || []) {
      if (seen.has(candidate.modelVersionId)) continue;
      seen.add(candidate.modelVersionId);
      options.push({
        modelId: candidate.modelId,
        versionId: candidate.modelVersionId,
        name: candidate.name,
        role: candidate.modelRole || "CORE_CHALLENGER",
        objectiveId: candidate.objectiveId,
        candidate: true
      });
    }
    return options;
  }

  function ensureCompareSelection() {
    const options = versionOptions();
    if (!options.length) return;
    const current = compareSelections.get(scenarioId) || {};
    const baseline = options.find((item) => item.role === "FORMAL_BASELINE") || options[0];
    const candidate = [...options].reverse().find((item) => item.versionId !== baseline.versionId && (item.candidate || item.role === "CORE_CHALLENGER"))
      || options.find((item) => item.versionId !== baseline.versionId)
      || baseline;
    const left = options.some((item) => item.versionId === current.left) ? current.left : baseline.versionId;
    let right = options.some((item) => item.versionId === current.right) ? current.right : candidate.versionId;
    if (right === left && options.length > 1) right = options.find((item) => item.versionId !== left).versionId;
    compareSelections.set(scenarioId, { left, right });
  }

  function accept(payload, targetScenarioId = scenarioId) {
    portfolioContexts.set(targetScenarioId, payload);
    if (targetScenarioId !== scenarioId) return;
    context = payload;
    state = payload.state || null;
    objectives = payload.objectives || [];
    ui = { ...ui, ...(payload.ui || {}) };
    ensureCompareSelection();
    publishWorkspaceBridge();
  }

  function publishWorkspaceBridge() {
    const bridge = context?.bridge;
    const hasIdentity = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => scenarioContext[field]);
    if (scenarioId !== hostScenarioId || !bridge?.workspaceMessageEnabled || !hasIdentity || global.parent === global) return;
    global.parent.postMessage({
      type: bridge.workspaceMessageType,
      scenarioContext,
      objectiveId: bridge.objectiveId,
      workspace: bridge.workspace,
      factWriteAllowed: bridge.factWriteAllowed,
      actionWriteAllowed: bridge.actionWriteAllowed,
      actionSourceAllowed: bridge.actionSourceAllowed
    }, global.location.origin);
  }

  function notify(message) {
    toastRoot.innerHTML = `<div class="toast">${esc(message)}</div>`;
    global.clearTimeout(toastTimer);
    toastTimer = global.setTimeout(() => { toastRoot.innerHTML = ""; }, 2600);
  }

  function workspaceLabel(ref, fallback = "未限定") {
    if (!ref) return fallback;
    return ref.label || ref.name || ref.title || ref.id || fallback;
  }

  function selectedComparisonRef() {
    const options = versionOptions();
    const selection = compareSelections.get(scenarioId) || {};
    const selected = [selection.left, selection.right]
      .map((versionId) => options.find((item) => item.versionId === versionId))
      .filter(Boolean);
    return {
      id: objectives[0]?.objectiveId || scenarioId,
      type: "modeling-objective-comparison",
      label: programName(),
      objectiveId: objectives[0]?.objectiveId || null,
      modelVersionRefs: selected.map((item) => ({ id: item.versionId, label: item.name, modelId: item.modelId }))
    };
  }

  function currentDataVersionRef() {
    const benchmark = [...(state?.benchmarks || [])].reverse().find((item) => item.fixedContext);
    const id = state?.data?.dataVersionId || benchmark?.fixedContext?.dataVersionId || workspaceContext?.dataVersionRef?.id;
    return id ? { id, label: short(id, 32) } : null;
  }

  function currentOntologyVersionRef() {
    const benchmark = [...(state?.benchmarks || [])].reverse().find((item) => item.fixedContext);
    const id = state?.semanticContract?.semanticContractVersionId || benchmark?.fixedContext?.semanticContractVersionId || workspaceContext?.ontologyVersionRef?.id;
    return id ? { id, label: short(id, 32) } : null;
  }

  function emitWorkspaceContextUpdate(extraPatch = {}) {
    if (global.parent === global) return;
    global.parent.postMessage({
      type: "OFW_WORKSPACE_CONTEXT_UPDATE",
      patch: {
        comparisonRef: selectedComparisonRef(),
        resultView: selectedResultView,
        dataVersionRef: currentDataVersionRef(),
        ontologyVersionRef: currentOntologyVersionRef(),
        sourceModuleId: "modeling",
        ...extraPatch
      }
    }, global.location.origin);
  }

  function currentAction(sourceState = state) {
    const next = sourceState?.nextAction;
    if (!next) return null;
    if (ROUTES[next.moduleId]) return { kind: "route", id: ROUTES[next.moduleId], label: next.label, reason: next.reason };
    if (next.id === "review-insights") return { kind: "view", id: "compare", label: "审查优化洞察", reason: next.reason };
    return { kind: "action", id: next.id, label: next.label, reason: next.reason };
  }

  function actionButton(action, tone = "primary", targetScenarioId = scenarioId) {
    if (!action) return "";
    if (action.kind === "route") return `<button class="btn ${tone}" type="button" data-route="${esc(action.id)}" data-scenario-id="${esc(targetScenarioId)}">${esc(action.label)}</button>`;
    if (action.kind === "view") return `<button class="btn ${tone}" type="button" data-view="${esc(action.id)}" data-scenario-id="${esc(targetScenarioId)}">${esc(action.label)}</button>`;
    return `<button class="btn ${tone}" type="button" data-action="${esc(action.id)}" data-scenario-id="${esc(targetScenarioId)}" ${busy ? "disabled" : ""}>${busy === action.id ? `${icon("loader-circle")}处理中` : esc(action.label)}</button>`;
  }

  function navMarkup() {
    const currentStatus = state?.cycle?.status ? statusLabel(state.cycle.status) : "正在读取";
    return `<aside class="center-nav"><header class="center-nav-head"><span>MODELING OBJECTIVES</span><strong>模型目标与优化</strong></header><nav class="center-nav-list" aria-label="模型目标与优化任务">${VIEWS.map(([id, label, iconName]) => `<button type="button" class="center-nav-btn ${activeView === id ? "active" : ""}" data-view="${id}">${icon(iconName)}<span>${label}</span></button>`).join("")}</nav><footer class="center-nav-context"><span>当前目标</span><strong>${esc(programName())}</strong><small>${esc(currentStatus)}</small></footer></aside>`;
  }

  function mobileSelect() {
    return `<select class="center-mobile-select" aria-label="选择模型目标与优化任务" data-mobile-view>${VIEWS.map(([id, label]) => `<option value="${id}" ${activeView === id ? "selected" : ""}>${label}</option>`).join("")}</select>`;
  }

  function targetSelector() {
    if (activeView === "objectives" || portfolioContexts.size < 2) return "";
    return `<label class="target-select"><span>当前目标</span><select data-target-selector>${[...portfolioContexts.entries()].map(([targetScenarioId, payload]) => `<option value="${esc(targetScenarioId)}" ${targetScenarioId === scenarioId ? "selected" : ""}>${esc(programName(targetScenarioId, payload))}</option>`).join("")}</select></label>`;
  }

  function headMarkup() {
    const returnRoute = hostContext?.modelingReturnContext?.returnRoute || (hostContext?.explorationHandoff ? "#module/m07" : null);
    const resultReady = Boolean(state?.results?.candidateEnvelope || state?.results?.simulationEnvelope);
    const modelCount = [...portfolioContexts.values()].reduce((sum, item) => sum + Number(item.state?.modelDefinitions?.length || 0), 0);
    const monitoringCount = [...portfolioContexts.values()].filter((item) => item.state?.consumerBinding?.status === "APPLIED").length;
    const title = activeView === "objectives" ? "模型目标与优化" : programName();
    const subtitle = activeView === "objectives"
      ? `${portfolioContexts.size || PROGRAM_IDS.length} 个业务目标 · ${modelCount} 个模型版本 · ${monitoringCount} 个目标持续监测`
      : (objectives[0]?.businessQuestion || `${ui.subjectLabel}建模目标`);
    return `<header class="center-head"><div class="center-head-copy"><span class="eyebrow">${activeView === "objectives" ? "MODELING OBJECTIVES" : esc(ui.domain)}</span><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="center-head-actions">${targetSelector()}${returnRoute ? `<button class="btn" type="button" data-return-route="${esc(returnRoute)}">${icon("corner-up-left")}返回原工作位置</button>` : ""}${resultReady && hostContext?.explorationHandoff ? `<button class="btn primary" type="button" data-action="return-result">${icon("send")}带回当前结果</button>` : ""}<button class="icon-btn" type="button" data-action="refresh" title="重新读取" aria-label="重新读取">${icon("refresh-cw")}</button></div></header>`;
  }

  function explorationContextMarkup() {
    const handoff = hostContext?.explorationHandoff;
    if (!handoff) return "";
    return `<section class="handoff-bar"><span class="handoff-icon">${icon("waypoints")}</span><div><span>来自业务对象探索</span><strong>${esc(handoff.objectRef?.title || handoff.objectRef?.id || "当前对象")}</strong></div><div><span>时间范围</span><strong>${esc(handoff.timeRange?.label || `${handoff.timeRange?.start || "—"} 至 ${handoff.timeRange?.end || "—"}`)}</strong></div><div><span>原视图</span><strong>${esc(handoff.lensRef?.lensId || "对象目录")}</strong></div><button class="btn compact" type="button" data-return-route="#module/m07">返回探索</button></section>`;
  }

  function workspaceInputMarkup() {
    if (activeView === "objectives" || !state) return "";
    const objectSet = workspaceContext?.objectSetRef;
    const activeObject = workspaceContext?.activeObjectRef;
    const timeRange = workspaceContext?.timeRange;
    const objectCount = objectSet?.count ?? objectSet?.objectRefs?.length ?? objectSet?.objectIds?.length;
    return `<section class="workspace-input"><div class="workspace-input-title"><span>${icon("panel-top")}</span><div><small>目标输入</small><strong>${esc(workspaceLabel(objectSet, objectCount ? `${objectCount} 个业务对象` : ui.subjectLabel))}</strong></div></div><div><span>当前对象</span><strong>${esc(workspaceLabel(activeObject, "未聚焦单个对象"))}</strong></div><div><span>时间范围</span><strong>${esc(timeRange?.label || (timeRange?.start && timeRange?.end ? `${timeRange.start} 至 ${timeRange.end}` : `截至 ${state.scenario?.dataAsOf || "—"}`))}</strong></div><div><span>数据版本</span><strong>${esc(workspaceLabel(currentDataVersionRef(), "沿用目标版本"))}</strong></div><div><span>语义版本</span><strong>${esc(workspaceLabel(currentOntologyVersionRef(), "沿用目标合同"))}</strong></div><label class="result-view-select"><span>结果模式</span><select data-result-view>${RESULT_VIEWS.map(([id, label]) => `<option value="${id}" ${selectedResultView === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></section>`;
  }

  function targetContextMarkup() {
    if (activeView === "objectives" || !state) return "";
    const formal = state.modelDefinitions?.find((item) => item.modelRole === "FORMAL_BASELINE");
    const candidate = state.candidates?.at(-1) || state.modelDefinitions?.find((item) => item.modelRole === "CORE_CHALLENGER");
    const evaluated = state.benchmarks?.length || 0;
    return `<section class="target-context"><div><span>当前正式模型</span><strong>${esc(formal?.name || "尚未登记")}</strong><small>${esc(formal?.version || formal?.modelVersion || short(formal?.modelVersionId, 22))}</small></div><div><span>最新候选</span><strong>${esc(candidate?.name || "尚未形成")}</strong><small>${candidate ? esc(candidate.modelVersion || candidate.version || short(candidate.modelVersionId, 22)) : "等待评测与审查"}</small></div><div><span>数据截至</span><strong>${esc(state.scenario?.dataAsOf || "—")}</strong><small>${state.data?.immutable ? "冻结版本" : "沿用已登记版本"}</small></div><div><span>评测记录</span><strong>${evaluated} 次</strong><small>${state.modelRuns?.length || 0} 个模型运行</small></div><div><span>当前周期</span><strong>第 ${state.cycle?.cycleNumber || 1} 期</strong><small>${esc(statusLabel(state.cycle?.status))}</small></div></section>`;
  }

  function nextActionMarkup() {
    if (activeView === "objectives" || repositoryMode) return "";
    const action = currentAction();
    if (!action) return "";
    const expectedView = action.kind === "action" ? ACTION_VIEW[action.id] : action.id;
    return `<section class="next-action"><span class="next-action-mark">${icon("arrow-up-right")}</span><div><span>下一步</span><strong>${esc(action.label)}</strong><small>${esc(action.reason || "完成当前目标的下一项工作。")}</small></div>${expectedView && expectedView !== activeView && action.kind === "action" ? `<button class="btn" type="button" data-view="${esc(expectedView)}">先查看相关页面</button>` : ""}${actionButton(action, "primary")}</section>`;
  }

  function targetProgress(payload) {
    const lifecycle = payload?.lifecycle || [];
    const complete = lifecycle.filter((item) => item.complete).length;
    return { complete, total: lifecycle.length || 6, percent: Math.round(complete / (lifecycle.length || 6) * 100) };
  }

  function targetDirectoryCard(targetScenarioId, payload) {
    const sourceState = payload?.state || {};
    const progress = targetProgress(payload);
    const baseline = sourceState.modelDefinitions?.find((item) => item.modelRole === "FORMAL_BASELINE");
    const candidate = sourceState.candidates?.at(-1);
    const next = currentAction(sourceState);
    const active = targetScenarioId === scenarioId;
    const iconName = PROGRAM_ICONS[PROGRAM_IDS.indexOf(targetScenarioId) % PROGRAM_ICONS.length] || "target";
    return `<article class="target-card ${active ? "active" : ""}" data-directory-card><button class="target-card-main" type="button" data-select-target="${esc(targetScenarioId)}"><span class="target-symbol">${icon(iconName)}</span><span class="target-card-copy"><small>${esc(payload?.ui?.domain || "业务模型")}</small><strong>${esc(programName(targetScenarioId, payload))}</strong><em>${esc(payload?.objectives?.[0]?.businessQuestion || "业务建模目标")}</em></span><span class="state-dot ${sourceState.consumerBinding?.status === "APPLIED" ? "success" : "active"}">${esc(statusLabel(sourceState.cycle?.status))}</span></button><div class="target-card-metrics"><span><b>${payload?.objectives?.length || 0}</b> 子目标</span><span><b>${sourceState.modelDefinitions?.length || 0}</b> 模型</span><span><b>${sourceState.benchmarks?.length || 0}</b> 评测</span></div><div class="target-progress"><span style="width:${progress.percent}%"></span></div><footer><span>${candidate ? `最新候选 ${esc(candidate.modelVersion || short(candidate.modelVersionId, 18))}` : `正式版本 ${esc(baseline?.version || baseline?.modelVersion || "已登记")}`}</span><button class="btn compact primary" type="button" data-enter-target="${esc(targetScenarioId)}">进入目标</button></footer>${next ? `<div class="target-next"><span>下一步</span><strong>${esc(next.label)}</strong></div>` : ""}</article>`;
  }

  function targetPreviewMarkup() {
    if (!context || !state) return `<div class="empty"><strong>正在读取目标</strong><span>正在同步模型、评测与消费状态。</span></div>`;
    const formal = state.modelDefinitions?.find((item) => item.modelRole === "FORMAL_BASELINE");
    const candidate = state.candidates?.at(-1) || state.modelDefinitions?.find((item) => item.modelRole === "CORE_CHALLENGER");
    const next = currentAction();
    return `<section class="target-preview"><header><div><span>${esc(ui.domain)}</span><h2>${esc(programName())}</h2><p>${esc(objectives[0]?.businessQuestion || "业务建模目标")}</p></div><span class="state-dot ${state.consumerBinding?.status === "APPLIED" ? "success" : "active"}">${esc(statusLabel(state.cycle?.status))}</span></header><div class="target-preview-stats"><div><span>当前正式模型</span><strong>${esc(formal?.name || "尚未登记")}</strong><small>${esc(formal?.version || formal?.modelVersion || short(formal?.modelVersionId, 22))}</small></div><div><span>最新候选</span><strong>${esc(candidate?.name || "尚未形成")}</strong><small>${candidate ? esc(candidate.modelVersion || candidate.version || short(candidate.modelVersionId, 22)) : "等待优化洞察"}</small></div><div><span>数据截至</span><strong>${esc(state.scenario?.dataAsOf || "—")}</strong><small>${state.data?.immutable ? "当前周期输入已冻结" : "使用已登记数据"}</small></div></div><div class="objective-contract-list">${objectives.map((item) => `<article><span class="objective-kind">${esc(objectiveKindLabel(item.kind))}</span><div><strong>${esc(item.name)}</strong><p>${esc(item.businessQuestion || "业务目标")}</p></div><div class="objective-contract-meta"><span>${item.inputCount ?? "—"} 项输入</span><span>${item.outputCount ?? "—"} 项输出</span><span>${esc((item.resultKinds || []).map(resultKindLabel).join(" / ") || "结果待登记")}</span></div><details class="evidence"><summary>目标合同</summary><pre>${esc(JSON.stringify({ objectiveId: item.objectiveId, revisionId: item.revisionId, targetObjectTypes: item.targetObjectTypes, bindingStatus: item.bindingStatus, releaseStatus: item.releaseStatus }, null, 2))}</pre></details></article>`).join("")}</div><div class="target-lifecycle">${(context.lifecycle || []).map((item, index) => `<div class="${item.complete ? "complete" : ""}"><span>${item.complete ? icon("check") : index + 1}</span><strong>${esc(item.label)}</strong></div>`).join("")}</div><footer><div>${next ? `<span>下一步</span><strong>${esc(next.label)}</strong>` : `<span>当前状态</span><strong>持续监测</strong>`}</div><div class="button-row"><button class="btn" type="button" data-view="compare">查看评测</button><button class="btn primary" type="button" data-view="models">进入目标工作台</button></div></footer></section>`;
  }

  function objectivesView() {
    const entries = [...portfolioContexts.entries()];
    return `<section class="directory-layout"><div class="target-directory"><header><div><h2>业务建模目标</h2><p>选择目标后进入模型、评测、候选与发布工作台。</p></div><span>${entries.length} 个目标</span></header><div class="target-directory-list">${entries.map(([targetScenarioId, payload]) => targetDirectoryCard(targetScenarioId, payload)).join("") || `<div class="empty"><strong>暂无可用目标</strong><span>目标状态暂时无法读取。</span></div>`}</div></div>${targetPreviewMarkup()}</section>`;
  }

  function modelStatus(model) {
    if (model.modelRole === "FORMAL_BASELINE") return { label: "正式使用", tone: "success" };
    const run = state?.modelRuns?.find((item) => item.modelId === model.modelId || item.modelVersionId === model.modelVersionId);
    if (run) return { label: businessStatus(run.status), tone: "success" };
    return { label: "待运行", tone: "warning" };
  }

  function objectiveQuestion(model) {
    return model.businessQuestion
      || objectives.find((item) => item.objectiveId === model.objectiveId)?.businessQuestion
      || objectives[0]?.businessQuestion
      || model.outputIdentity
      || "业务建模问题";
  }

  function modelRow(model) {
    const repo = repositoryCatalog.find((item) => item.modelId === model.modelId);
    const status = modelStatus(model);
    return `<article class="model-row ${model.modelRole === "FORMAL_BASELINE" ? "formal" : ""}"><div class="model-identity"><span class="role-tag ${model.modelRole === "SUPPLEMENTAL" ? "supplemental" : model.modelRole === "FORMAL_BASELINE" ? "formal" : "challenger"}">${esc(roleLabel(model.modelRole))}</span><strong>${esc(model.name)}</strong><small>${esc(model.version || model.modelVersion || short(model.modelVersionId, 24))}</small></div><div class="model-purpose"><span>业务问题</span><p>${esc(objectiveQuestion(model))}</p></div><div class="model-output"><span>输出</span><p>${esc(model.outputIdentity || "按目标合同输出")}</p></div><div class="model-state"><span class="pill ${status.tone}">${esc(status.label)}</span>${repo?.latestRun ? `<small>Python ${esc(businessStatus(repo.latestRun.status))}</small>` : repo?.latestTest ? `<small>${esc(businessStatus(repo.latestTest.status))}</small>` : ""}</div><div class="model-actions">${repo ? `<button class="icon-btn" type="button" data-repository-model-id="${esc(model.modelId)}" title="打开模型代码仓" aria-label="打开 ${esc(model.name)} 代码仓">${icon("code-2")}</button>` : `<span class="repository-state" title="当前模型通过版本与评测合同维护">${icon("fingerprint")}</span>`}<details class="cell-evidence"><summary>版本证据</summary><code>${esc(model.modelVersionId)}</code></details></div></article>`;
  }

  function modelGroup(title, description, models, tone) {
    return `<section class="model-group ${tone}"><header><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><span>${models.length} 个模型</span></header><div class="model-list">${models.map(modelRow).join("") || `<div class="empty compact"><strong>当前目标未登记该类模型</strong></div>`}</div></section>`;
  }

  function modelsView() {
    if (repositoryMode) return repositoryView();
    const models = state?.modelDefinitions || [];
    const comparable = models.filter((item) => item.modelRole !== "SUPPLEMENTAL");
    const supplemental = models.filter((item) => item.modelRole === "SUPPLEMENTAL");
    return `<section class="models-summary"><div><span>同题模型组</span><strong>${comparable.length}</strong><small>正式基线与 Challenger 使用同一问题和评测口径</small></div><div><span>补充模型组</span><strong>${supplemental.length}</strong><small>各自回答独立风险维度，不合并为总分</small></div><div><span>Python 代码仓</span><strong>${repositoryCatalog.length}</strong><small>${repositoryRegistered ? "代码、README、测试与版本记录可下钻" : "模型版本通过统一运行合同维护"}</small></div></section>${modelGroup("同题模型组", "正式模型保持稳定，Challenger 在固定口径下进行版本比较。", comparable, "comparable")}${modelGroup("补充能力组", "每个模型保留独立业务问题、输出身份、置信度和证据。", supplemental, "supplemental")}`;
  }

  function metricsForOption(option) {
    if (!option) return {};
    const benchmarks = state?.benchmarks || [];
    const comparison = [...benchmarks].reverse().find((item) => item.comparableModels?.length);
    const comparable = comparison?.comparableModels?.find((item) => item.modelId === option.modelId || item.modelVersionId === option.versionId);
    if (comparable?.metrics) return comparable.metrics;
    const candidate = state?.candidates?.find((item) => item.modelVersionId === option.versionId || item.modelId === option.modelId);
    if (candidate?.metrics) return candidate.metrics;
    const benchmark = [...benchmarks].reverse().find((item) => item.modelId === option.modelId || item.modelVersionId === option.versionId);
    return benchmark?.metrics || {};
  }

  function numericMetricEntries(metrics) {
    return Object.entries(metrics || {}).filter(([, value]) => finite(value));
  }

  function preferredMetric(metrics) {
    const preferredKey = ["primaryMetric", "recallAtFixedCapacity", "prAuc", "precisionAtFixedCapacity", "coverage", "stability"]
      .find((key) => finite(metrics?.[key]));
    const fallback = numericMetricEntries(metrics)[0];
    const key = preferredKey || fallback?.[0] || "primaryMetric";
    return { key, value: metrics?.[key] ?? fallback?.[1] ?? null };
  }

  function compareBoardMarkup() {
    const options = versionOptions();
    if (options.length < 2) return `<div class="empty"><strong>至少需要两个模型版本</strong><span>运行当前正式模型和 Challenger 后可进行固定双版本对比。</span></div>`;
    ensureCompareSelection();
    const selection = compareSelections.get(scenarioId);
    const left = options.find((item) => item.versionId === selection.left) || options[0];
    const right = options.find((item) => item.versionId === selection.right) || options[1];
    const leftMetrics = metricsForOption(left);
    const rightMetrics = metricsForOption(right);
    const keys = [...new Set([...numericMetricEntries(leftMetrics).map(([key]) => key), ...numericMetricEntries(rightMetrics).map(([key]) => key)])].slice(0, 8);
    const optionMarkup = (selected) => options.map((item) => `<option value="${esc(item.versionId)}" ${item.versionId === selected ? "selected" : ""}>${esc(item.name)} · ${esc(item.versionId)}</option>`).join("");
    return `<div class="compare-controls"><label class="compare-version version-a"><span>版本 A</span><select data-compare-side="left">${optionMarkup(left.versionId)}</select><small>${esc(roleLabel(left.role))}</small></label><button class="compare-swap" type="button" data-compare-swap title="交换版本" aria-label="交换对比版本">${icon("arrow-left-right")}</button><label class="compare-version version-b"><span>版本 B</span><select data-compare-side="right">${optionMarkup(right.versionId)}</select><small>${esc(roleLabel(right.role))}</small></label></div><div class="comparison-board"><header><div class="version-legend a"><span></span><strong>${esc(left.name)}</strong><small>${esc(short(left.versionId, 28))}</small></div><div class="comparison-title"><strong>固定双版本对比</strong><span>同一数据、语义与 Evaluator</span></div><div class="version-legend b"><span></span><strong>${esc(right.name)}</strong><small>${esc(short(right.versionId, 28))}</small></div></header><div class="comparison-metrics">${keys.map((key) => {
      const a = Number(leftMetrics[key]);
      const b = Number(rightMetrics[key]);
      const max = Math.max(Math.abs(a) || 0, Math.abs(b) || 0, 0.01);
      const delta = finite(a) && finite(b) ? b - a : null;
      const lower = LOWER_IS_BETTER.has(key);
      return `<article><div class="metric-name"><strong>${esc(metricLabel(key))}</strong><span>${lower ? "越低越好" : "越高越好"}</span></div><div class="metric-pair"><div class="metric-track"><span class="bar-a" style="width:${metricWidth(a, max)}%"></span><b>${esc(metricValue(key, a))}</b></div><div class="metric-track"><span class="bar-b" style="width:${metricWidth(b, max)}%"></span><b>${esc(metricValue(key, b))}</b></div></div><div class="metric-delta ${delta === null ? "" : (lower ? delta < 0 : delta > 0) ? "positive" : delta === 0 ? "neutral" : "negative"}">${delta === null ? "—" : `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}pp`}</div></article>`;
    }).join("") || `<div class="empty compact"><strong>当前两个版本没有可比指标</strong></div>`}</div></div>`;
  }

  function benchmarkContextMarkup() {
    const benchmark = [...(state?.benchmarks || [])].reverse().find((item) => item.fixedContext) || state?.benchmarks?.at(-1);
    const fixed = benchmark?.fixedContext || {};
    return `<section class="benchmark-context"><div><span>数据版本</span><strong>${esc(short(fixed.dataVersionId || state?.data?.dataVersionId, 30))}</strong></div><div><span>语义合同</span><strong>${esc(short(fixed.semanticContractVersionId || state?.semanticContract?.semanticContractVersionId, 30))}</strong></div><div><span>Evaluator</span><strong>${esc(short(fixed.evaluatorVersion, 30))}</strong></div><div><span>指标口径</span><strong>${esc(short(fixed.metricSchemaVersion, 30))}</strong></div><div><span>Holdout</span><strong>${fixed.holdoutUsed ? "已使用" : "未使用"}</strong></div></section>`;
  }

  function diagnosticMarkup() {
    const options = versionOptions();
    const selection = compareSelections.get(scenarioId) || {};
    const selected = options.filter((item) => item.versionId === selection.left || item.versionId === selection.right);
    const slices = selected.flatMap((item) => (metricsForOption(item).worstSlices || []).slice(0, 4).map((slice) => ({ ...slice, model: item.name })));
    const missing = state?.data?.missingSummary || [];
    return `<section class="diagnostic-grid"><div class="diagnostic-panel"><header><h3>最弱业务切片</h3><span>${slices.length} 条</span></header>${slices.length ? `<div class="slice-table">${slices.map((item) => `<div><strong>${esc(item.value || item.dimension || "未命名切片")}</strong><span>${esc(item.model)}</span><b>${finite(item.recall) ? percent(item.recall) : "无法评价"}</b><small>${item.sampleCount ?? "—"} 个样本</small></div>`).join("")}</div>` : `<div class="empty compact"><strong>当前评测未返回切片指标</strong></div>`}</div><div class="diagnostic-panel"><header><h3>覆盖与缺失</h3><span>${missing.length} 项</span></header>${missing.length ? `<div class="missing-list">${missing.map((item) => `<article><strong>${esc(item.field || "缺失项")}</strong><span>${esc(item.reason || "原因待记录")}</span><b>${item.affectedCount ?? "—"}</b></article>`).join("")}</div>` : `<div class="quality-ok">${icon("circle-check-big")}<div><strong>缺失原因已纳入评测口径</strong><span>覆盖率与无法评价状态保留在结果中。</span></div></div>`}</div></section>`;
  }

  function reviewPanel() {
    const review = state?.insightReview;
    if (!state?.insights?.length) return "";
    if (!review) return `<section class="review-panel"><div class="review-state">${icon("user-check")}<div><span>人工洞察审查</span><strong>等待业务判断</strong><p>核对证据、收益、风险和验证方式后，决定是否允许创建新候选版本。</p></div></div><div class="button-row"><button class="btn danger" type="button" data-action="review-reject">驳回并记录</button><button class="btn primary" type="button" data-action="review-approve">批准并记录</button></div></section>`;
    return `<section class="review-panel ${review.decision === "APPROVED" ? "approved" : "rejected"}"><div class="review-state">${icon(review.decision === "APPROVED" ? "badge-check" : "circle-x")}<div><span>人工洞察审查</span><strong>${review.decision === "APPROVED" ? "已批准创建候选" : "已驳回本批洞察"}</strong><p>${esc(review.reviewComment || "审查意见已记录。")}</p></div></div><dl><div><dt>评审人</dt><dd>${esc(review.reviewedBy)}</dd></div><div><dt>审查凭证</dt><dd>${esc(short(review.reviewReceiptId, 24))}</dd></div><div><dt>不可变摘要</dt><dd>${esc(short(review.receiptDigest, 24))}</dd></div></dl></section>`;
  }

  function insightsMarkup() {
    const insights = state?.insights || [];
    return `<section class="section insights-section"><header class="section-head"><div><h2>优化洞察</h2><p>洞察只提出有证据的版本改进方向，是否创建候选由人工审查决定。</p></div><span class="section-count">${insights.length} 条</span></header><div class="section-body">${reviewPanel()}<div class="insight-grid">${insights.map((item) => `<article class="insight-row"><span class="insight-icon">${icon("sparkles")}</span><div><header><strong>${esc(item.title || item.name || "优化洞察")}</strong><span class="pill">证据洞察</span></header><p>${esc(item.businessInterpretation || item.problem || item.summary || item.description || "")}</p><dl><div><dt>预期改善</dt><dd>${esc(item.expectedImprovement || "待验证")}</dd></div><div><dt>主要风险</dt><dd>${esc(item.possibleRisk || "待验证")}</dd></div><div><dt>验证方式</dt><dd>${esc(item.validationMethod || "同口径重新评测")}</dd></div></dl><details class="evidence"><summary>依据与变更建议</summary><pre>${esc(JSON.stringify({ insightId: item.insightId, evidenceRefs: item.evidenceRefs, suggestedDiff: item.suggestedDiff }, null, 2))}</pre></details></div></article>`).join("") || `<div class="empty"><strong>尚未形成优化洞察</strong><span>完成模型组合评测后可生成洞察。</span></div>`}</div></div></section>`;
  }

  function compareView() {
    const benchmark = state?.benchmarks?.at(-1);
    return `<section class="section compare-section"><header class="section-head"><div><h2>评测对比</h2><p>固定两个模型版本，在同一数据、语义、指标与 Evaluator 下比较。</p></div><span class="pill ${benchmark ? "success" : "warning"}">${benchmark ? "评测口径已固定" : "等待首次评测"}</span></header><div class="section-body">${benchmarkContextMarkup()}${compareBoardMarkup()}${diagnosticMarkup()}<details class="evidence benchmark-evidence"><summary>查看评测运行证据</summary><pre>${esc(JSON.stringify(benchmark || { status: "PENDING" }, null, 2))}</pre></details></div></section>${insightsMarkup()}`;
  }

  function candidatesMarkup() {
    const candidates = state?.candidates || [];
    return `<section class="section"><header class="section-head"><div><h2>候选版本</h2><p>每次改动形成新的不可变模型版本，并关联洞察审查凭证。</p></div><span class="section-count">${candidates.length} 个</span></header><div class="section-body candidate-list">${candidates.map((item) => { const primary = preferredMetric(item.metrics); return `<article class="candidate-row"><span class="candidate-mark">${icon("git-branch")}</span><div><header><strong>${esc(item.name)}</strong><span class="pill success">${esc(businessStatus(item.status))}</span></header><p>${esc(item.businessSummary || "候选版本已完成隔离评测，等待或正在进行影子观察。")}</p><div class="candidate-metrics"><span><b>${metricValue(primary.key, primary.value)}</b> ${esc(metricLabel(primary.key))}</span><span><b>${metricValue("coverage", item.metrics?.coverage)}</b> 覆盖率</span><span><b>${item.immutable ? "不可变" : "草稿"}</b> 版本状态</span></div></div><details class="evidence"><summary>版本证据</summary><pre>${esc(JSON.stringify({ candidateId: item.candidateId, modelVersionId: item.modelVersionId, parentModelVersionIds: item.parentModelVersionIds, dataVersionId: item.dataVersionId, semanticContractVersionId: item.semanticContractVersionId, insightReviewReceiptId: item.insightReviewReceiptId, versionDigest: item.versionDigest }, null, 2))}</pre></details></article>`; }).join("") || `<div class="empty"><strong>尚未形成候选版本</strong><span>优化洞察通过人工审查后可创建新候选。</span></div>`}</div></section>`;
  }

  function shadowWindowMetric(metrics) {
    const preferred = ["primaryMetric", "recallAtFixedCapacity", "prAuc", "coverage"].find((key) => finite(metrics?.[key]));
    return preferred ? { key: preferred, value: Number(metrics[preferred]) } : { key: "primaryMetric", value: null };
  }

  function shadowMarkup() {
    const shadow = state?.shadowTrial;
    if (!shadow) return `<section class="section"><header class="section-head"><div><h2>Shadow Trial</h2><p>候选与正式模型并行运行，等待真实标签窗口成熟后再比较。</p></div><span class="pill warning">尚未开始</span></header><div class="section-body"><div class="empty"><strong>候选尚未进入影子观察</strong><span>选择已评测候选后，将按配置的标签成熟窗口持续复评。</span></div></div></section>`;
    const configured = shadow.maturityWindows || [];
    const matured = shadow.maturedWindows || [];
    const shadowEvidence = {
      shadowTrialId: shadow.shadowTrialId,
      shadowRunId: shadow.shadowRunId,
      status: shadow.status,
      modelVersionId: shadow.modelVersionId,
      maturityWindows: configured,
      maturedWindows: matured.map((item) => ({
        maturityWindowId: item.maturityWindowId,
        windowResultId: item.windowResultId,
        maturedAt: item.maturedAt,
        newMaturedLabelCount: item.newMaturedLabelCount,
        baselineReportId: item.baselineReportId,
        candidateReportId: item.candidateReportId,
        baselineMetrics: item.baselineMetrics,
        candidateMetrics: item.candidateMetrics
      }))
    };
    return `<section class="section shadow-section"><header class="section-head"><div><h2>Shadow Trial</h2><p>候选与正式模型并行观察，结果不覆盖正式模型和历史事实。</p></div><span class="pill ${shadow.status === "MATURED" ? "success" : "warning"}">${esc(businessStatus(shadow.status))}</span></header><div class="section-body"><div class="shadow-overview"><div><span>成熟窗口</span><strong>${matured.length} / ${configured.length || 3}</strong></div><div><span>新增标签</span><strong>${matured.reduce((sum, item) => sum + Number(item.newMaturedLabelCount || 0), 0)}</strong></div><div><span>候选版本</span><strong>${esc(short(shadow.modelVersionId || state.candidates?.at(-1)?.modelVersionId, 28))}</strong></div><div><span>当前状态</span><strong>${esc(businessStatus(shadow.status))}</strong></div></div><div class="shadow-timeline">${configured.map((windowItem, index) => {
      const result = matured.find((item) => item.maturityWindowId === windowItem.maturityWindowId);
      const baseline = shadowWindowMetric(result?.baselineMetrics);
      const candidate = shadowWindowMetric(result?.candidateMetrics);
      const status = result ? "matured" : index === matured.length && shadow.status === "ACTIVE" ? "current" : "pending";
      const max = Math.max(Math.abs(baseline.value || 0), Math.abs(candidate.value || 0), 0.01);
      return `<article class="${status}"><span class="timeline-node">${result ? icon("check") : index + 1}</span><div class="window-copy"><strong>${esc(windowItem.label || `观察窗口 ${index + 1}`)}</strong><span>${esc(windowItem.maturedAt || "等待标签成熟")}</span><small>${result ? `${result.newMaturedLabelCount || 0} 条新增标签` : status === "current" ? "正在等待标签" : "尚未开始"}</small></div><div class="window-compare">${result ? `<div><span>正式</span><i><b style="width:${Math.max(4, Math.abs(baseline.value || 0) / max * 100)}%"></b></i><strong>${metricValue(baseline.key, baseline.value)}</strong></div><div><span>候选</span><i><b style="width:${Math.max(4, Math.abs(candidate.value || 0) / max * 100)}%"></b></i><strong>${metricValue(candidate.key, candidate.value)}</strong></div>` : `<span class="window-wait">${status === "current" ? "观察中" : "待进入"}</span>`}</div></article>`;
    }).join("")}</div><details class="evidence"><summary>查看 Shadow 运行证据</summary><pre>${esc(JSON.stringify(shadowEvidence, null, 2))}</pre></details></div></section>`;
  }

  function rebenchmarkMarkup() {
    const benchmark = [...(state?.benchmarks || [])].reverse().find((item) => item.scope === "MATURED_SHADOW_LABELS");
    if (!benchmark) return "";
    return `<section class="section"><header class="section-head"><div><h2>成熟标签复评</h2><p>候选与正式模型继续使用同一 Evaluator 和指标口径。</p></div><span class="pill success">复评完成</span></header><div class="section-body"><div class="metric-grid">${(benchmark.metricCards || context?.benchmarkCards || []).map((card) => `<div class="metric"><span>${esc(card.label)}</span><strong>${esc(formatMetricCard(card))}</strong><small>${esc(card.note || (card.direction === "lower" ? "越低越好" : "越高越好"))}</small></div>`).join("")}</div><details class="evidence"><summary>复评证据</summary><pre>${esc(JSON.stringify(benchmark, null, 2))}</pre></details></div></section>`;
  }

  function observeView() {
    return `${candidatesMarkup()}${shadowMarkup()}${rebenchmarkMarkup()}`;
  }

  function releaseStageMarkup() {
    const release = state?.releaseCandidate;
    const binding = state?.consumerBinding;
    const stages = [
      { label: "Release Candidate", complete: Boolean(release), current: !release },
      { label: "消费绑定校验", complete: binding?.validationStatus === "VALID", current: Boolean(release) && binding?.validationStatus !== "VALID" },
      { label: "人工应用", complete: binding?.status === "APPLIED", current: binding?.validationStatus === "VALID" && binding?.status !== "APPLIED" },
      { label: "持续监测", complete: binding?.status === "APPLIED", current: binding?.status === "APPLIED" }
    ];
    return `<section class="release-rail">${stages.map((item, index) => `<div class="${item.complete ? "complete" : ""} ${item.current ? "current" : ""}"><span>${item.complete ? icon("check") : index + 1}</span><strong>${esc(item.label)}</strong></div>`).join("")}</section>`;
  }

  function consumerMapMarkup() {
    const binding = state?.consumerBinding;
    const packageId = state?.results?.resultPackage?.resultPackageId;
    const status = binding?.status === "APPLIED" ? "已连接" : binding?.validationStatus === "VALID" ? "待应用" : "等待绑定";
    return `<section class="section consumer-section"><header class="section-head"><div><h2>消费者地图</h2><p>同一结果包按视图身份进入驾驶舱、探索、问数、解释和报告。</p></div><span class="pill ${binding?.status === "APPLIED" ? "success" : "warning"}">${esc(status)}</span></header><div class="section-body"><div class="consumer-map"><div class="consumer-hub"><span>${icon("package-open")}</span><strong>模型结果包</strong><small>${esc(short(packageId, 30))}</small><b>${esc(programName())}</b></div><div class="consumer-nodes">${CONSUMERS.map((item) => `<button type="button" data-route="${esc(item.route)}"><span>${icon(item.icon)}</span><div><strong>${esc(item.label)}</strong><small>${esc(item.views)}</small></div><b>${esc(status)}</b>${icon("arrow-up-right")}</button>`).join("")}</div></div></div></section>`;
  }

  function bindingMappingsMarkup() {
    const binding = state?.consumerBinding;
    const mappings = binding?.viewMappings || ["FORMAL", "CANDIDATE", "SHADOW", "SIMULATION", "DIFF"].map((view) => ({ view, status: "PENDING" }));
    const labels = { FORMAL: "正式结果", CANDIDATE: "候选试算", SHADOW: "影子观察", SIMULATION: "压力模拟", DIFF: "正式与候选差异" };
    return `<section class="binding-map"><header><div><h3>消费视图绑定</h3><p>每个视图保留独立结果身份和模型版本。</p></div><span>${mappings.length} 个视图</span></header><div>${mappings.map((item) => `<article><span class="binding-view-icon">${icon(item.view === "FORMAL" ? "badge-check" : item.view === "CANDIDATE" ? "flask-conical" : item.view === "SHADOW" ? "scan-eye" : item.view === "SIMULATION" ? "gauge" : "git-compare-arrows")}</span><div><strong>${esc(labels[item.view] || item.view)}</strong><small>${esc(short(item.modelVersionId || item.sources?.join(" ↔ ") || binding?.activeCandidateModelVersionId || "等待版本", 38))}</small></div><span class="pill ${item.status === "VALID" || binding?.status === "APPLIED" ? "success" : "warning"}">${item.status === "VALID" || binding?.status === "APPLIED" ? "可消费" : "待校验"}</span></article>`).join("")}</div></section>`;
  }

  function releaseSummaryMarkup() {
    const release = state?.releaseCandidate;
    const binding = state?.consumerBinding;
    const primary = preferredMetric(release?.holdoutMetrics);
    return `<section class="release-summary"><article><header><span>${icon("package-check")}</span><div><small>发布候选</small><strong>${release ? "已形成" : "尚未形成"}</strong></div><span class="pill ${release ? "success" : "warning"}">${release ? "RC" : "等待"}</span></header><p>${release ? esc(short(release.modelVersionId, 42)) : "影子观察成熟并完成同口径复评后形成。"}</p><dl><div><dt>${esc(metricLabel(primary.key))}</dt><dd>${metricValue(primary.key, primary.value)}</dd></div><div><dt>覆盖率</dt><dd>${metricValue("coverage", release?.holdoutMetrics?.coverage)}</dd></div><div><dt>形成时间</dt><dd>${esc(release?.formedAt?.replace("T", " ").slice(0, 16) || "—")}</dd></div></dl></article><article><header><span>${icon("plug-zap")}</span><div><small>消费绑定</small><strong>${esc(binding ? businessStatus(binding.status) : "尚未校验")}</strong></div><span class="pill ${binding?.status === "APPLIED" ? "success" : "warning"}">${binding?.validationStatus === "VALID" ? "校验通过" : "等待校验"}</span></header><p>${binding ? esc(short(binding.bindingRevisionId, 42)) : "发布候选形成后校验消费者字段、单位、时间和结果身份。"}</p><dl><div><dt>正式模型</dt><dd>${esc(short(binding?.formalModelVersionId, 25))}</dd></div><div><dt>候选模型</dt><dd>${esc(short(binding?.activeCandidateModelVersionId, 25))}</dd></div><div><dt>结果包</dt><dd>${state?.results?.resultPackage ? "已形成" : "等待形成"}</dd></div></dl></article></section>`;
  }

  function releaseOperationsMarkup() {
    const capabilities = context?.capabilities || {};
    const simulation = state?.results?.simulationEnvelope;
    const canStress = capabilities.pressureSimulation && state?.modelRuns?.length;
    const canRollback = capabilities.rollback && state?.consumerBinding?.status === "APPLIED";
    const canNext = capabilities.nextCycleStart && state?.consumerBinding?.status === "APPLIED";
    const simulationEvidence = simulation ? {
      resultId: simulation.resultId,
      runId: simulation.runId,
      resultKind: simulation.resultKind,
      modelVersionId: simulation.modelVersionId,
      dataVersionId: simulation.dataVersionId,
      semanticContractVersionId: simulation.semanticContractVersionId,
      subjectCount: simulation.subjects?.length || 0,
      parameters: simulation.parameters,
      evidenceRefs: simulation.evidenceRefs,
      digest: simulation.digest
    } : null;
    const resultPackage = state?.results?.resultPackage;
    const versionEvidence = {
      cycle: state?.cycle,
      cycleHistory: state?.cycleHistory,
      bindingHistory: state?.bindingHistory,
      resultPackage: resultPackage ? {
        resultPackageId: resultPackage.resultPackageId,
        cycleId: resultPackage.cycleId,
        dataVersionId: resultPackage.dataVersionId,
        semanticContractVersionId: resultPackage.semanticContractVersionId,
        consumerBindingRevisionId: resultPackage.consumerBindingRevisionId,
        viewBindings: resultPackage.viewBindings,
        truthBoundary: resultPackage.truthBoundary,
        digest: resultPackage.digest
      } : null
    };
    return `<section class="section operations-section"><header class="section-head"><div><h2>运行与版本控制</h2><p>压力模拟、候选回退和下一周期均保留独立运行证据。</p></div><div class="button-row">${canStress ? `<button class="btn" type="button" data-action="run-stress">${icon("gauge")}运行压力模拟</button>` : ""}${canRollback ? `<button class="btn danger" type="button" data-action="rollback-binding">${icon("undo-2")}回退候选应用</button>` : ""}${canNext ? `<button class="btn primary" type="button" data-action="start-next-cycle">${icon("refresh-ccw-dot")}启动下一周期</button>` : ""}</div></header><div class="section-body"><div class="operation-status"><article><span>${icon("gauge")}</span><div><small>最近压力模拟</small><strong>${simulation ? "运行成功" : "尚未运行"}</strong><p>${simulation ? `${simulation.subjects?.length || 0} 个对象 · ${esc(short(simulation.modelVersionId, 32))}` : "使用当前数据、语义和候选版本形成独立模拟结果。"}</p></div></article><article><span>${icon("history")}</span><div><small>历史周期</small><strong>${state?.cycleHistory?.length || 0} 个</strong><p>历史模型版本、评测、Binding 与回退路径保持可追溯。</p></div></article><article><span>${icon("database-zap")}</span><div><small>下一周期触发</small><strong>${canNext ? "可启动" : "等待当前周期闭合"}</strong><p>新数据或成熟标签进入新周期，不覆盖当前周期历史。</p></div></article></div>${simulationEvidence ? `<details class="evidence"><summary>查看压力模拟结果</summary><pre>${esc(JSON.stringify(simulationEvidence, null, 2))}</pre></details>` : ""}<details class="evidence"><summary>查看版本与回退证据</summary><pre>${esc(JSON.stringify(versionEvidence, null, 2))}</pre></details></div></section>`;
  }

  function releaseView() {
    return `${releaseStageMarkup()}${releaseSummaryMarkup()}${bindingMappingsMarkup()}${consumerMapMarkup()}${releaseOperationsMarkup()}`;
  }

  function repositoryView() {
    if (!repositoryRegistered) return `<section class="section repository-empty"><header class="section-head"><div><h2>模型代码仓</h2><p>当前目标的模型版本、运行和评测合同已登记。</p></div><button class="btn" type="button" data-close-repository>${icon("arrow-left")}返回模型组合</button></header><div class="section-body"><div class="empty"><strong>当前目标未登记可浏览代码仓</strong><span>模型版本仍可通过统一评测、候选、Shadow 和发布链路管理。</span></div></div></section>`;
    if (!repository) return `<section class="section"><header class="section-head"><div><h2>模型代码仓</h2><p>正在读取文件、分支、提交、标签和运行记录。</p></div><button class="btn" type="button" data-close-repository>${icon("arrow-left")}返回模型组合</button></header><div class="section-body"><div class="empty"><strong>正在打开代码仓</strong><span>读取当前提交快照。</span></div></div></section>`;
    const selectedFile = repository.files.find((item) => item.path === selectedRepositoryFile) || repository.files[0];
    const content = repositoryDrafts[selectedFile?.path] ?? selectedFile?.content ?? "";
    const changed = selectedFile && content !== selectedFile.content;
    const selectedBranchRecord = repository.branches.find((item) => item.name === repository.selectedBranch);
    const branchProtected = repository.readOnly || selectedBranchRecord?.protected;
    const dataReady = Boolean(state?.data?.immutable && state?.semanticContract?.semanticContractVersionId);
    const readme = repository.files.find((item) => item.path === "README.md")?.content || "";
    const consoleTitle = repositoryConsole?.modelRunId ? "Python 模型运行" : repositoryConsole?.testRunId ? "Python 单元测试" : "运行控制台";
    const consoleText = repositoryError
      ? repositoryError
      : repositoryConsole
        ? [
            repositoryConsole.status,
            repositoryConsole.command,
            repositoryConsole.stdout,
            repositoryConsole.stderr,
            repositoryConsole.resultEnvelope ? JSON.stringify({
              modelId: repositoryConsole.resultEnvelope.modelId,
              resultKind: repositoryConsole.resultEnvelope.resultKind,
              resultCount: repositoryConsole.resultEnvelope.resultCount,
              dataVersionId: repositoryConsole.resultEnvelope.dataVersionId,
              semanticContractVersionId: repositoryConsole.resultEnvelope.semanticContractVersionId,
              sample: repositoryConsole.resultEnvelope.results?.slice(0, 2)
            }, null, 2) : ""
          ].filter(Boolean).join("\n\n")
        : "运行模型或单元测试后，这里显示 Python 进程输出、结果摘要和证据身份。";
    return `<section class="section repository-section"><header class="section-head"><div><span class="repository-breadcrumb">模型与代码 / ${esc(repository.name)}</span><h2>Python 模型代码仓</h2><p>README、代码、测试、运行和 Git 式版本记录共享同一模型身份。</p></div><div class="button-row"><button class="btn" type="button" data-close-repository>${icon("arrow-left")}返回模型组合</button><button class="btn" type="button" data-repository-action="test" ${repositoryBusy ? "disabled" : ""}>${icon("test-tube-2")}运行测试</button><button class="btn primary" type="button" data-repository-action="run" ${repositoryBusy || !dataReady ? "disabled" : ""} title="${dataReady ? "使用当前冻结数据运行" : "数据与语义合同尚未就绪"}">${icon("play")}运行模型</button></div></header><div class="repository-identity"><div><span>模型</span><strong>${esc(repository.name)}</strong><small>${esc(repository.modelId)}</small></div><div><span>角色</span><strong>${esc(roleLabel(repository.role))}</strong><small>${repository.readOnly ? "正式版本只读" : "候选仓可维护"}</small></div><div><span>当前分支</span><select data-repository-branch>${repository.branches.map((item) => `<option value="${esc(item.name)}" ${item.name === repository.selectedBranch ? "selected" : ""}>${esc(item.name)} · ${esc(short(item.headCommitId, 18))}${item.protected ? " · 只读" : ""}</option>`).join("")}</select></div><div><span>运行输入</span><strong>${dataReady ? esc(short(state.data.dataVersionId, 28)) : "数据合同未就绪"}</strong><small>${dataReady ? esc(short(state.semanticContract.semanticContractVersionId, 28)) : "运行保持不可用"}</small></div></div><div class="repository-layout"><aside class="repository-browser"><header><strong>模型仓</strong><span>${repositoryCatalog.length}</span></header><div class="repository-list">${repositoryCatalog.map((item) => `<button type="button" class="${item.modelId === repository.modelId ? "active" : ""}" data-repository-model-id="${esc(item.modelId)}"><span>${esc(roleLabel(item.role))}</span><strong>${esc(item.name)}</strong><small>${esc(short(item.headCommitId, 18))}</small></button>`).join("")}</div><header class="file-head"><strong>文件</strong><span>${repository.files.length}</span></header><div class="file-tree">${repository.files.map((item) => `<button type="button" class="${item.path === selectedFile?.path ? "active" : ""}" data-repository-file="${esc(item.path)}">${icon(item.language === "python" ? "file-code-2" : item.language === "markdown" ? "file-text" : item.language === "json" ? "braces" : "file")}<span>${esc(item.path)}</span></button>`).join("")}</div></aside><main class="repository-editor"><header><div><strong>${esc(selectedFile?.path || "未选择文件")}</strong><span>${esc(selectedFile?.language || "text")} · ${changed ? "有未提交修改" : `提交 ${esc(repository.selectedCommitId)}`}</span></div><span class="pill ${branchProtected || changed ? "warning" : "success"}">${branchProtected ? "只读" : changed ? "未提交" : "已同步"}</span></header><textarea data-repository-editor data-file-path="${esc(selectedFile?.path || "")}" spellcheck="false" ${branchProtected ? "readonly" : ""}>${esc(content)}</textarea><section class="repository-console"><header><strong>${esc(consoleTitle)}</strong><span>${repositoryBusy ? "运行中" : repositoryConsole?.status ? esc(businessStatus(repositoryConsole.status)) : "等待命令"}</span></header><pre>${esc(consoleText)}</pre></section></main><aside class="repository-git"><section><header><div><span>Git 状态</span><strong>${esc(repository.selectedBranch)} @ ${esc(repository.selectedCommitId)}</strong></div><span class="pill ${branchProtected ? "warning" : "success"}">${branchProtected ? "只读" : "可维护"}</span></header><dl><div><dt>分支</dt><dd>${repository.branchCount}</dd></div><div><dt>提交</dt><dd>${repository.commitCount}</dd></div><div><dt>标签</dt><dd>${repository.tagCount}</dd></div><div><dt>发布候选</dt><dd>${repository.releaseCandidateCount}</dd></div></dl></section><section class="git-form"><label><span>新分支</span><input data-repository-form="branchName" value="${esc(repositoryForm.branchName)}" placeholder="feature/优化说明" ${repository.readOnly ? "disabled" : ""}></label><button class="btn" type="button" data-repository-action="branch" ${repositoryBusy || repository.readOnly || !repositoryForm.branchName.trim() ? "disabled" : ""}>${icon("git-branch")}创建分支</button><label><span>提交说明</span><input data-repository-form="commitMessage" value="${esc(repositoryForm.commitMessage)}" placeholder="说明本次模型修改" ${branchProtected ? "disabled" : ""}></label><button class="btn" type="button" data-repository-action="commit" ${repositoryBusy || branchProtected || !changed || !repositoryForm.commitMessage.trim() ? "disabled" : ""}>${icon("git-commit-horizontal")}提交当前文件</button><label><span>版本标签</span><input data-repository-form="tagName" value="${esc(repositoryForm.tagName)}" placeholder="v0.2.0-rc.1" ${repository.readOnly ? "disabled" : ""}></label><div class="git-form-actions"><button class="btn" type="button" data-repository-action="tag" ${repositoryBusy || repository.readOnly || !repositoryForm.tagName.trim() ? "disabled" : ""}>创建标签</button><button class="btn primary" type="button" data-repository-action="release" ${repositoryBusy || repository.readOnly || !repositoryForm.tagName.trim() ? "disabled" : ""}>形成代码候选</button></div></section><section class="repository-readme"><header><span>README</span><strong>业务与维护说明</strong></header><pre>${esc(readme.slice(0, 1800))}</pre></section><section class="commit-history"><header><span>提交历史</span><strong>${repository.commits.length} 条</strong></header>${repository.commits.slice(0, 6).map((item) => `<article><strong>${esc(item.message)}</strong><span>${esc(item.commitId)} · ${esc(item.author)}</span><small>${esc(item.committedAt.replace("T", " ").slice(0, 16))}</small></article>`).join("")}</section></aside></div></section>`;
  }

  function explorationReturnPayload() {
    const handoff = hostContext?.explorationHandoff;
    const source = state?.results?.simulationEnvelope || state?.results?.candidateEnvelope;
    if (!handoff?.objectRef || !source) throw new Error("请先形成当前对象可使用的候选或模拟结果。");
    const formedAt = new Date().toISOString();
    const runToken = `${state.cycle?.cycleId || scenarioId}-${String(state.operationLog?.length || 0).padStart(2, "0")}-${String(handoff.objectRef.id).replace(/[^A-Za-z0-9]/g, "").slice(-10)}`;
    const resultKind = source.resultKind === "SIMULATION" ? "SIMULATION" : "PREDICTION";
    const resultId = `M08-${scenarioId}-${resultKind}-RESULT-${runToken}`;
    const runId = `M08-${scenarioId}-${resultKind}-RUN-${runToken}`;
    const objectiveId = source.objectiveId || state.objectives?.[0]?.objectiveId;
    const objectiveRevisionId = source.objectiveRevisionId || `${objectiveId}-REV-1`;
    const bindingRevisionId = source.bindingRevisionId || `${handoff.bindingId || `MB-${scenarioId}-MODEL`}-R1`;
    const releaseId = source.releaseId || state.releaseCandidate?.releaseCandidateId || `MREL-${scenarioId}-CANDIDATE-REFERENCE`;
    const modelVersionId = source.modelVersionId || state.candidates?.at(-1)?.modelVersionId || state.modelDefinitions?.find((item) => item.modelRole !== "FORMAL_BASELINE")?.modelVersionId;
    const subjectSource = source.subjects?.find((item) => item.subjectId === handoff.objectRef.id || item.enterpriseId === handoff.objectRef.id) || source.subjects?.[0] || {};
    const inputManifest = {
      ...scenarioContext,
      scenarioContext: { ...scenarioContext },
      sourceKind: "SYNTHETIC_CANDIDATE_SIMULATION",
      usageIntent: resultKind === "SIMULATION" ? "STRESS" : "WHAT_IF",
      objectRef: { ...handoff.objectRef },
      lensRef: { ...handoff.lensRef },
      seriesRef: handoff.seriesRef ? { ...handoff.seriesRef } : null,
      timeRange: { ...handoff.timeRange },
      dataVersionId: handoff.dataVersionId,
      ontologyVersionId: handoff.ontologyVersionId,
      bindingId: handoff.bindingId,
      objectiveId,
      objectiveRevisionId,
      bindingRevisionId,
      releaseId,
      modelVersionId
    };
    const resultEnvelope = {
      schemaVersion: "ofw.modeling.result-envelope.v2",
      resultId,
      runId,
      resultKind,
      useKind: inputManifest.usageIntent,
      scenario: { ...state.scenario },
      objectiveId,
      objectiveRevisionId,
      bindingRevisionId,
      releaseId,
      modelVersionId,
      dataVersionId: handoff.dataVersionId,
      semanticContractVersionId: handoff.ontologyVersionId,
      formedAt,
      subjectRefs: [{ ...handoff.objectRef }],
      subjects: [{
        subjectId: handoff.objectRef.id,
        subjectName: handoff.objectRef.title || subjectSource.subjectName || handoff.objectRef.id,
        subjectType: handoff.objectRef.objectTypeRef,
        score: subjectSource.score ?? null,
        confidence: subjectSource.confidence ?? null,
        missingReasons: subjectSource.missingReasons || [],
        modelVersionId,
        evidenceRefs: [source.resultId, handoff.dataVersionId, handoff.ontologyVersionId].filter(Boolean)
      }],
      inputSnapshot: {
        ...scenarioContext,
        scenarioContext: { ...scenarioContext },
        dataVersionId: handoff.dataVersionId,
        ontologyVersionId: handoff.ontologyVersionId,
        timeRange: { ...handoff.timeRange }
      },
      fixtureId: `${scenarioId}-SYNTHETIC-RESEARCH-v1`,
      inputClassification: "SYNTHETIC_RESEARCH_ONLY",
      containsSourceBusinessValues: false,
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false,
      sideEffectsEmitted: 0
    };
    return {
      ...scenarioContext,
      inputManifest,
      resultEnvelope,
      ...(resultKind === "SIMULATION" ? { simulationRunId: runId, simulationResultId: resultId, simulationStatus: "SUCCEEDED" } : { modelingRunId: runId, modelingResultId: resultId }),
      simulationStatus: "SUCCEEDED",
      sideEffectsEmitted: 0,
      completedAt: formedAt
    };
  }

  function returnResultToExploration() {
    const payload = explorationReturnPayload();
    global.parent.postMessage({ type: "OFW_M08_RETURN_TO_M07", targetModuleId: "m07", payload }, global.location.origin);
  }

  function viewMarkup() {
    if (!state) return `<section class="section"><div class="section-body"><div class="empty"><strong>正在读取模型目标</strong><span>同步目标、模型、评测和消费状态。</span></div></div></section>`;
    if (activeView === "objectives") return objectivesView();
    if (activeView === "models") return modelsView();
    if (activeView === "compare") return compareView();
    if (activeView === "observe") return observeView();
    return releaseView();
  }

  function render() {
    root.innerHTML = `<div class="center-layout">${navMarkup()}<section class="center-main">${mobileSelect()}${headMarkup()}${explorationContextMarkup()}${workspaceInputMarkup()}${targetContextMarkup()}${nextActionMarkup()}${error ? `<div class="action-error">${esc(error)}</div>` : ""}${viewMarkup()}</section></div>`;
    bindEvents();
    global.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
  }

  function bindEvents() {
    root.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view, button.dataset.scenarioId)));
    root.querySelector("[data-mobile-view]")?.addEventListener("change", (event) => switchView(event.target.value));
    root.querySelector("[data-target-selector]")?.addEventListener("change", (event) => void selectProgram(event.target.value, activeView));
    root.querySelector("[data-result-view]")?.addEventListener("change", (event) => {
      selectedResultView = event.target.value;
      emitWorkspaceContextUpdate({ resultView: selectedResultView });
      render();
    });
    root.querySelectorAll("[data-select-target]").forEach((button) => button.addEventListener("click", () => void selectProgram(button.dataset.selectTarget, "objectives")));
    root.querySelectorAll("[data-enter-target]").forEach((button) => button.addEventListener("click", () => void selectProgram(button.dataset.enterTarget, "models")));
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => void runAction(button.dataset.action, button.dataset.scenarioId)));
    root.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => global.parent.postMessage({ type: "OFW_M08_NAVIGATE", route: button.dataset.route, scenarioId: button.dataset.scenarioId || scenarioId }, global.location.origin)));
    root.querySelectorAll("[data-return-route]").forEach((button) => button.addEventListener("click", () => global.parent.postMessage({ type: "OFW_M08_NAVIGATE", route: button.dataset.returnRoute }, global.location.origin)));
    root.querySelectorAll("[data-repository-model-id]").forEach((button) => button.addEventListener("click", () => {
      repositoryMode = true;
      activeView = "models";
      history.replaceState(null, "", "#models");
      render();
      void openRepository(button.dataset.repositoryModelId);
    }));
    root.querySelectorAll("[data-close-repository]").forEach((button) => button.addEventListener("click", () => {
      repositoryMode = false;
      repositoryError = "";
      history.replaceState(null, "", "#models");
      render();
    }));
    root.querySelectorAll("[data-repository-file]").forEach((button) => button.addEventListener("click", () => {
      selectedRepositoryFile = button.dataset.repositoryFile;
      render();
    }));
    root.querySelector("[data-repository-branch]")?.addEventListener("change", (event) => void openRepository(repository?.modelId, { branch: event.target.value }));
    root.querySelector("[data-repository-editor]")?.addEventListener("input", (event) => {
      repositoryDrafts[event.target.dataset.filePath] = event.target.value;
      const commitButton = root.querySelector('[data-repository-action="commit"]');
      const original = repository?.files.find((item) => item.path === event.target.dataset.filePath)?.content ?? "";
      if (commitButton) commitButton.disabled = repository?.readOnly || event.target.value === original || !repositoryForm.commitMessage.trim();
      root.querySelector(".repository-editor > header .pill")?.classList.toggle("warning", event.target.value !== original);
    });
    root.querySelectorAll("[data-repository-form]").forEach((input) => input.addEventListener("input", () => {
      repositoryForm = { ...repositoryForm, [input.dataset.repositoryForm]: input.value };
      if (input.dataset.repositoryForm === "commitMessage") {
        const currentFile = repository?.files.find((item) => item.path === selectedRepositoryFile);
        const currentContent = repositoryDrafts[selectedRepositoryFile] ?? currentFile?.content ?? "";
        const commitButton = root.querySelector('[data-repository-action="commit"]');
        if (commitButton) commitButton.disabled = repository?.readOnly || currentContent === currentFile?.content || !input.value.trim();
      }
      if (input.dataset.repositoryForm === "branchName") {
        const branchButton = root.querySelector('[data-repository-action="branch"]');
        if (branchButton) branchButton.disabled = repository?.readOnly || !input.value.trim();
      }
      if (input.dataset.repositoryForm === "tagName") {
        root.querySelectorAll('[data-repository-action="tag"], [data-repository-action="release"]').forEach((button) => { button.disabled = repository?.readOnly || !input.value.trim(); });
      }
    }));
    root.querySelectorAll("[data-repository-action]").forEach((button) => button.addEventListener("click", () => void runRepositoryCommand(button.dataset.repositoryAction)));
    root.querySelectorAll("[data-compare-side]").forEach((select) => select.addEventListener("change", () => updateComparison(select.dataset.compareSide, select.value)));
    root.querySelector("[data-compare-swap]")?.addEventListener("click", () => {
      const selection = compareSelections.get(scenarioId);
      if (!selection) return;
      compareSelections.set(scenarioId, { left: selection.right, right: selection.left });
      emitWorkspaceContextUpdate({ comparisonRef: selectedComparisonRef() });
      render();
    });
  }

  function updateComparison(side, versionId) {
    const options = versionOptions();
    const current = compareSelections.get(scenarioId) || {};
    const otherSide = side === "left" ? "right" : "left";
    const next = { ...current, [side]: versionId };
    if (next[side] === next[otherSide] && options.length > 1) next[otherSide] = options.find((item) => item.versionId !== versionId)?.versionId || next[otherSide];
    compareSelections.set(scenarioId, next);
    emitWorkspaceContextUpdate({ comparisonRef: selectedComparisonRef() });
    render();
  }

  function switchView(view, targetScenarioId = null) {
    const normalized = canonicalView(view);
    if (!VIEWS.some(([id]) => id === normalized)) return;
    if (targetScenarioId && targetScenarioId !== scenarioId) {
      void selectProgram(targetScenarioId, normalized);
      return;
    }
    repositoryMode = false;
    activeView = normalized;
    history.replaceState(null, "", `#${normalized}`);
    render();
  }

  async function selectProgram(targetScenarioId, targetView = activeView) {
    if (!PROGRAM_IDS.includes(targetScenarioId)) return;
    scenarioId = targetScenarioId;
    repositoryMode = false;
    repository = null;
    repositoryConsole = null;
    repositoryError = "";
    const payload = portfolioContexts.get(targetScenarioId) || await request(`/v1/model-management/context?scenarioId=${encodeURIComponent(targetScenarioId)}`);
    accept(payload, targetScenarioId);
    await loadRepositoryCatalog();
    activeView = VIEWS.some(([id]) => id === canonicalView(targetView)) ? canonicalView(targetView) : "models";
    history.replaceState(null, "", `#${activeView}`);
    emitWorkspaceContextUpdate();
    render();
  }

  async function loadRepositoryCatalog() {
    const catalog = await request(`/v1/model-management/repositories?scenarioId=${encodeURIComponent(scenarioId)}`);
    repositoryCatalog = catalog.repositories || [];
    repositoryRegistered = catalog.registered === true;
    return catalog;
  }

  async function openRepository(modelId, options = {}) {
    if (!modelId || repositoryBusy) return;
    repositoryBusy = "load";
    repositoryError = "";
    if (repositoryMode) render();
    try {
      const query = new URLSearchParams({ scenarioId });
      if (options.branch) query.set("branch", options.branch);
      repository = await request(`/v1/model-management/repositories/${encodeURIComponent(modelId)}?${query}`);
      if (!repository.files.some((item) => item.path === selectedRepositoryFile)) {
        selectedRepositoryFile = repository.files.some((item) => item.path === "README.md") ? "README.md" : repository.files[0]?.path || "";
      }
      repositoryDrafts = {};
      repositoryForm = { branchName: "", commitMessage: "", tagName: "" };
    } catch (caught) {
      repositoryError = `${caught.code || "REPOSITORY_LOAD_FAILED"} · ${caught.message}`;
    } finally {
      repositoryBusy = "";
      render();
    }
  }

  async function refreshRepositorySummary() {
    await loadRepositoryCatalog();
    if (!repository) return;
    const query = new URLSearchParams({ scenarioId, branch: repository.selectedBranch });
    repository = await request(`/v1/model-management/repositories/${encodeURIComponent(repository.modelId)}?${query}`);
  }

  async function runRepositoryCommand(action) {
    if (!repository || repositoryBusy) return;
    const branchName = repositoryForm.branchName.trim();
    const commitMessage = repositoryForm.commitMessage.trim();
    const tagName = repositoryForm.tagName.trim();
    const currentFile = repository.files.find((item) => item.path === selectedRepositoryFile);
    const currentContent = repositoryDrafts[selectedRepositoryFile] ?? currentFile?.content ?? "";
    repositoryBusy = action;
    repositoryError = "";
    repositoryConsole = null;
    render();
    try {
      const base = { scenarioId, branch: repository.selectedBranch, commitId: repository.selectedCommitId };
      if (action === "run" || action === "test") {
        repositoryConsole = await request(`/v1/model-management/repositories/${encodeURIComponent(repository.modelId)}/${action}`, { method: "POST", body: JSON.stringify({ ...base }) });
        await refreshRepositorySummary();
      } else if (action === "branch") {
        repository = await request(`/v1/model-management/repositories/${encodeURIComponent(repository.modelId)}/branches`, { method: "POST", body: JSON.stringify({ ...base, name: branchName }) });
        repositoryDrafts = {};
        repositoryForm = { ...repositoryForm, branchName: "" };
        await loadRepositoryCatalog();
      } else if (action === "commit") {
        repository = await request(`/v1/model-management/repositories/${encodeURIComponent(repository.modelId)}/commits`, { method: "POST", body: JSON.stringify({ ...base, message: commitMessage, author: "当前模型维护人", files: { [selectedRepositoryFile]: currentContent } }) });
        repositoryDrafts = {};
        repositoryForm = { ...repositoryForm, commitMessage: "" };
        await loadRepositoryCatalog();
      } else if (action === "tag") {
        repository = await request(`/v1/model-management/repositories/${encodeURIComponent(repository.modelId)}/tags`, { method: "POST", body: JSON.stringify({ ...base, name: tagName }) });
        await loadRepositoryCatalog();
      } else if (action === "release") {
        repository = await request(`/v1/model-management/repositories/${encodeURIComponent(repository.modelId)}/release-candidates`, { method: "POST", body: JSON.stringify({ ...base, tag: tagName }) });
        repositoryForm = { ...repositoryForm, tagName: "" };
        await loadRepositoryCatalog();
      }
      notify(action === "run" ? "Python 模型运行完成并固定证据" : action === "test" ? "Python 单元测试已完成" : "模型仓版本操作已记录");
    } catch (caught) {
      repositoryError = `${caught.code || "REPOSITORY_ACTION_FAILED"} · ${caught.message}`;
    } finally {
      repositoryBusy = "";
      render();
    }
  }

  function closeModal() {
    modal = null;
    modalRoot.innerHTML = "";
  }

  function openConfirmation({ action, title, message, confirmLabel, reviewer = false, comment = false, decision = null }) {
    modal = { action, decision };
    modalRoot.innerHTML = `<div class="modal-backdrop"><section class="modal"><header><h2>${esc(title)}</h2><p>${esc(message)}</p></header>${reviewer || comment ? `<div class="modal-fields">${reviewer ? `<label><span>业务评审人</span><input type="text" data-modal-reviewer value="当前业务评审人" maxlength="40"></label>` : ""}${comment ? `<label><span>审查意见</span><textarea data-modal-comment rows="3" maxlength="240" placeholder="记录批准条件或驳回原因"></textarea></label>` : ""}</div>` : ""}<footer><button class="btn" type="button" data-modal-cancel>取消</button><button class="btn primary" type="button" data-modal-confirm>${esc(confirmLabel)}</button></footer></section></div>`;
    modalRoot.querySelector("[data-modal-cancel]").addEventListener("click", closeModal);
    modalRoot.querySelector("[data-modal-confirm]").addEventListener("click", () => {
      const reviewerName = modalRoot.querySelector("[data-modal-reviewer]")?.value.trim() || "";
      const reviewComment = modalRoot.querySelector("[data-modal-comment]")?.value.trim() || "";
      if (reviewer && !reviewerName) return;
      const pending = { ...modal, reviewerName, reviewComment };
      closeModal();
      void execute(pending.action, pending);
    });
  }

  async function runAction(action, targetScenarioId = null) {
    if (targetScenarioId && targetScenarioId !== scenarioId && PROGRAM_IDS.includes(targetScenarioId)) {
      scenarioId = targetScenarioId;
      const payload = portfolioContexts.get(targetScenarioId) || await request(`/v1/model-management/context?scenarioId=${encodeURIComponent(targetScenarioId)}`);
      accept(payload, targetScenarioId);
      await loadRepositoryCatalog();
    }
    if (action === "return-result") {
      try {
        returnResultToExploration();
      } catch (caught) {
        error = `${caught.code || "RESULT_RETURN_FAILED"} · ${caught.message}`;
        render();
      }
      return;
    }
    if (action === "review-approve" || action === "review-reject") {
      const approved = action === "review-approve";
      openConfirmation({
        action: "review-insights",
        decision: approved ? "APPROVED" : "REJECTED",
        title: approved ? "批准优化洞察" : "驳回优化洞察",
        message: approved ? "批准后只允许创建新的不可变候选版本，不会自动选择冠军或发布。" : "驳回后本批洞察与审查凭证进入历史，可依据意见生成新洞察。",
        confirmLabel: approved ? "批准并记录" : "驳回并记录",
        reviewer: true,
        comment: true
      });
      return;
    }
    if (["apply-binding", "rollback-binding", "start-next-cycle"].includes(action)) {
      const copy = {
        "apply-binding": ["应用候选结果", `应用后${ui.consumerLabel}可读取候选结果，当前正式模型指针不变。`, "确认应用"],
        "rollback-binding": ["回退候选应用", "回退只改变候选消费绑定，历史版本和当前正式模型继续保留。", "确认回退"],
        "start-next-cycle": ["启动下一优化周期", "当前周期进入历史，新周期从新数据或成熟标签开始。", "启动新周期"]
      }[action];
      openConfirmation({ action, title: copy[0], message: copy[1], confirmLabel: copy[2], reviewer: action === "apply-binding", comment: action === "rollback-binding" });
      return;
    }
    await execute(action, {});
  }

  async function execute(action, form) {
    if (busy) return;
    busy = action;
    error = "";
    render();
    try {
      if (action === "refresh") {
        await load();
        return;
      }
      const payload = {};
      if (action === "review-insights") Object.assign(payload, { decision: form.decision, reviewedBy: form.reviewerName, comment: form.reviewComment });
      if (action === "start-shadow") Object.assign(payload, { candidateId: state?.candidates?.at(-1)?.candidateId });
      if (action === "apply-binding") Object.assign(payload, { confirmed: true, confirmedBy: form.reviewerName || "当前业务评审人" });
      if (action === "run-stress") Object.assign(payload, { parameters: { interestRateBps: 150, creditSpreadBps: 200, liquidityHaircutPct: 12, demandShockPct: 10 } });
      if (action === "rollback-binding") Object.assign(payload, { reason: form.reviewComment || "业务评审选择回到上一候选消费绑定" });
      const response = await request(`/v1/model-management/actions/${encodeURIComponent(action)}`, {
        method: "POST",
        body: JSON.stringify({ scenarioId: state?.scenario?.scenarioId || scenarioId, payload })
      });
      accept(response);
      notify("操作已完成并记录运行证据");
    } catch (caught) {
      error = `${caught.code || "ACTION_FAILED"} · ${caught.message}`;
    } finally {
      busy = "";
      render();
    }
  }

  async function load() {
    try {
      const results = await Promise.allSettled(PROGRAM_IDS.map((targetScenarioId) => request(`/v1/model-management/context?scenarioId=${encodeURIComponent(targetScenarioId)}`)));
      portfolioContexts = new Map();
      results.forEach((result, index) => {
        if (result.status === "fulfilled") portfolioContexts.set(PROGRAM_IDS[index], result.value);
      });
      const payload = portfolioContexts.get(scenarioId) || portfolioContexts.get(hostScenarioId) || [...portfolioContexts.values()][0];
      if (!payload) throw new Error("业务目标与模型状态暂时不可读取");
      scenarioId = payload.scenario?.scenarioId || hostScenarioId;
      accept(payload, scenarioId);
      await loadRepositoryCatalog();
      if (repositoryMode && repositoryRegistered) {
        const modelId = repository?.modelId || repositoryCatalog[0]?.modelId;
        if (modelId) {
          const query = new URLSearchParams({ scenarioId });
          if (repository?.selectedBranch) query.set("branch", repository.selectedBranch);
          repository = await request(`/v1/model-management/repositories/${encodeURIComponent(modelId)}?${query}`);
          if (!repository.files.some((item) => item.path === selectedRepositoryFile)) {
            selectedRepositoryFile = repository.files.some((item) => item.path === "README.md") ? "README.md" : repository.files[0]?.path || "";
          }
          repositoryDrafts = {};
        }
      }
      error = "";
    } catch (caught) {
      error = `${caught.code || "LOAD_FAILED"} · ${caught.message}`;
    }
    render();
  }

  global.addEventListener("hashchange", () => {
    const requested = global.location.hash.slice(1) || "objectives";
    const next = canonicalView(requested);
    if (!VIEWS.some(([id]) => id === next)) return;
    repositoryMode = requested === "repository";
    activeView = next;
    if (requested !== next) history.replaceState(null, "", `#${next}`);
    render();
    if (repositoryMode && repositoryRegistered && !repository && repositoryCatalog[0]) void openRepository(repositoryCatalog[0].modelId);
  });

  global.addEventListener("message", (event) => {
    if (event.origin !== global.location.origin || event.source !== global.parent) return;
    if (event.data?.type === "OFW_M08_DELIVER_CONTEXT") {
      hostContext = event.data.payload || null;
      render();
      return;
    }
    if (event.data?.type === "OFW_WORKSPACE_CONTEXT") {
      workspaceContext = event.data.context && typeof event.data.context === "object" ? event.data.context : null;
      const incomingResultView = String(workspaceContext?.resultView || "").toLowerCase();
      if (RESULT_VIEWS.some(([id]) => id === incomingResultView)) selectedResultView = incomingResultView;
      render();
    }
  });

  render();
  void load();
})(window);
