(function mountModelManagement(global) {
  "use strict";

  const root = document.getElementById("model-center");
  const modalRoot = document.getElementById("model-center-modal");
  const toastRoot = document.getElementById("model-center-toast");
  const params = new URLSearchParams(global.location.search);
  const apiBase = params.get("apiBase") || "http://127.0.0.1:4363";
  const hostScenarioId = params.get("scenarioId") || "";
  let scenarioId = hostScenarioId;
  if (params.get("embedded") === "1") document.documentElement.dataset.embedded = "true";
  const scenarioContext = Object.fromEntries(["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].map((field) => [field, params.get(field)]));
  const views = Object.freeze([
    ["overview", "优化工作台", "layout-dashboard"],
    ["portfolio", "业务目标与模型", "layers-3"],
    ["benchmark", "统一评测", "chart-no-axes-combined"],
    ["shadow", "候选观察", "scan-eye"],
    ["release", "发布与监测", "package-check"]
  ]);
  const VIEW_ALIASES = Object.freeze({ objectives: "portfolio", repository: "portfolio", insights: "benchmark", candidates: "shadow", monitor: "release" });
  const PROGRAM_IDS = Object.freeze((params.get("programIds") || hostScenarioId).split(",").map((item) => item.trim()).filter(Boolean));
  const PROGRAM_ICONS = Object.freeze(["landmark", "calculator", "shield-alert", "clipboard-check", "chart-candlestick", "chart-no-axes-combined"]);
  const routes = Object.freeze({ M01: "#module/ontology", M02: "#module/data" });
  let context = null;
  let state = null;
  let objectives = [];
  let portfolioContexts = new Map();
  let ui = { moduleName: "模型优化中心", domain: "业务模型", businessName: "当前场景", subjectLabel: "业务对象", consumerLabel: "业务驾驶舱" };
  const initialRoute = global.location.hash.slice(1);
  const initialView = VIEW_ALIASES[initialRoute] || initialRoute;
  let activeView = views.some(([id]) => id === initialView) ? initialView : "overview";
  let repositoryMode = initialRoute === "repository";
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

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const icon = (name) => `<span class="icon" aria-hidden="true"><i data-lucide="${esc(name)}"></i></span>`;
  const short = (value, size = 30) => String(value || "—").length > size ? `${String(value).slice(0, size - 8)}...${String(value).slice(-5)}` : String(value || "—");
  const number = (value, digits = 3) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits).replace(/0+$/, "").replace(/\.$/, "") : "无法评价";

  function statusLabel(status) {
    return ({
      DATA_PREPARATION: "准备数据",
      DATA_BUILT: "数据已形成",
      DATA_VALIDATED: "质量已校验",
      DATA_FROZEN: "数据版本已冻结",
      CONTRACT_READY: "语义版本已就绪",
      BASELINE_BENCHMARKED: "当前正式模型已评测",
      MODEL_PORTFOLIO_EVALUATED: "模型组合已评测",
      INSIGHT_REVIEW_REQUIRED: "洞察需要人工审查",
      INSIGHTS_APPROVED: "洞察审查已批准",
      INSIGHTS_REJECTED: "洞察审查已驳回",
      CANDIDATE_READY: "候选版本已形成",
      SHADOW_ACTIVE: "影子试运行中",
      SHADOW_MATURED: "影子观察已成熟",
      REBENCHMARKED: "成熟标签已复评",
      RELEASE_CANDIDATE_READY: "发布候选已形成",
      BINDING_VALIDATED: "应用配置已校验",
      BINDING_APPLIED: "已应用并持续监测",
      BINDING_ROLLED_BACK: "候选应用已回退"
    })[status] || status || "正在读取";
  }

  function roleLabel(role) {
    return ({ FORMAL_BASELINE: "当前正式模型", CORE_CHALLENGER: "核心挑战者", SUPPLEMENTAL: "补充模型" })[role] || role || "模型";
  }

  function businessStatus(status) {
    return ({
      EVALUATED: "已完成评测",
      SUCCEEDED: "运行成功",
      ACTIVE: "运行中",
      MATURED: "观察窗口已成熟",
      VALIDATED: "已校验",
      VALID: "校验通过",
      APPLIED: "已应用",
      ROLLED_BACK: "已回退",
      RESEARCH_EVALUATED: "已完成研究评测",
      RESEARCH_BENCHMARK_READY: "统一评测可运行",
      CONTRACT_READY: "业务合同已就绪",
      MODEL_PORTFOLIO_RUNTIME_READY: "模型组合可运行",
      DETERMINISTIC_LONGITUDINAL_RUNTIME_READY: "纵向评测可运行",
      SYNTHETIC_PREVIEW_READY: "脱敏数据评测可运行",
      SYNTHETIC_PREVIEW_ONLY: "脱敏数据合同已形成",
      ISOLATED_RUN_READY: "隔离运行可用",
      EVALUATED_AWAITING_SHADOW: "已评测，可进入影子试运行"
    })[status] || status || "尚未形成";
  }

  function objectiveKindLabel(kind) {
    return ({ FORECAST: "预测", CLASSIFICATION: "分类", SCORING: "评分", OPTIMIZATION: "优化" })[kind] || kind || "建模";
  }

  function resultKindLabel(kind) {
    return ({ FACT: "正式事实", PREDICTION: "候选预测", SHADOW: "影子观察", SIMULATION: "压力模拟" })[kind] || kind;
  }

  function formatMetric(card) {
    const value = Number(card?.value);
    if (!Number.isFinite(value)) return "无法评价";
    if (card.format === "percent") return `${number(value * 100, 1)}%`;
    return number(value, 3);
  }

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["content-type"] = "application/json";
    const response = await fetch(`${apiBase}${path}`, { ...options, headers, cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.message || `服务返回 ${response.status}`), { code: body.code || "REQUEST_FAILED" });
    return body;
  }

  function accept(payload, targetScenarioId = scenarioId) {
    portfolioContexts.set(targetScenarioId, payload);
    if (targetScenarioId !== scenarioId) return;
    context = payload;
    state = payload.state || null;
    objectives = payload.objectives || [];
    ui = { ...ui, ...(payload.ui || {}) };
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

  function navMarkup() {
    return `<aside class="center-nav"><header class="center-nav-head"><span>模型管理</span><strong>模型优化中心</strong></header><nav class="center-nav-list" aria-label="模型优化中心任务">${views.map(([id, label, iconName]) => `<button type="button" class="center-nav-btn ${activeView === id ? "active" : ""}" data-view="${id}">${icon(iconName)}<span>${label}</span></button>`).join("")}</nav></aside>`;
  }

  function mobileSelect() {
    return `<select class="center-mobile-select" aria-label="选择模型优化中心任务" data-mobile-view>${views.map(([id, label]) => `<option value="${id}" ${activeView === id ? "selected" : ""}>${label}</option>`).join("")}</select>`;
  }

  function programContext(targetScenarioId) {
    return portfolioContexts.get(targetScenarioId) || null;
  }

  function programName(targetScenarioId, payload = programContext(targetScenarioId)) {
    return payload?.ui?.businessName || "业务模型";
  }

  function currentAction(sourceState = state) {
    const next = sourceState?.nextAction;
    if (!next) return null;
    if (routes[next.moduleId]) return { kind: "route", id: routes[next.moduleId], label: next.label, reason: next.reason };
    if (next.id === "review-insights") return { kind: "view", id: "benchmark", label: "进入人工审查", reason: next.reason };
    return { kind: "action", id: next.id, label: next.label, reason: next.reason };
  }

  function actionButton(action, tone = "primary", targetScenarioId = scenarioId) {
    if (!action) return "";
    if (action.kind === "route") return `<button class="btn ${tone}" type="button" data-route="${esc(action.id)}" data-scenario-id="${esc(targetScenarioId)}">${esc(action.label)}</button>`;
    if (action.kind === "view") return `<button class="btn ${tone}" type="button" data-view="${esc(action.id)}" data-scenario-id="${esc(targetScenarioId)}">${esc(action.label)}</button>`;
    return `<button class="btn ${tone}" type="button" data-action="${esc(action.id)}" data-scenario-id="${esc(targetScenarioId)}" ${busy ? "disabled" : ""}>${busy === action.id ? "处理中" : esc(action.label)}</button>`;
  }

  function programDirectoryMarkup() {
    return `<section class="program-directory"><header><div><h2>业务目标</h2><p>选择一个目标进入模型、评测、候选和发布详情。</p></div><span>${PROGRAM_IDS.length} 个目标</span></header><div>${PROGRAM_IDS.map((targetScenarioId) => {
      const payload = programContext(targetScenarioId);
      const sourceState = payload?.state || {};
      const next = currentAction(sourceState);
      const complete = sourceState?.consumerBinding?.status === "APPLIED";
      const active = targetScenarioId === scenarioId;
      const iconName = PROGRAM_ICONS[PROGRAM_IDS.indexOf(targetScenarioId) % PROGRAM_ICONS.length];
      return `<article class="program-card ${active ? "active" : ""}"><button class="program-card-main" type="button" data-program-scenario="${targetScenarioId}" data-program-view="${activeView === "overview" ? "portfolio" : activeView}"><span class="program-symbol">${icon(iconName)}</span><span><small>${esc(payload?.ui?.domain || "业务模型")}</small><strong>${esc(programName(targetScenarioId, payload))}</strong><em>${esc(statusLabel(sourceState?.cycle?.status))}</em></span><b class="pill ${complete ? "success" : "warning"}">${complete ? "持续监测" : next ? "可继续" : "已登记"}</b></button><footer><span>${sourceState?.modelDefinitions?.length || 0} 个模型 · ${sourceState?.benchmarks?.length || 0} 次评测</span>${next ? actionButton(next, "compact", targetScenarioId) : `<button class="btn compact" type="button" data-program-scenario="${targetScenarioId}" data-program-view="portfolio">查看详情</button>`}</footer></article>`;
    }).join("")}</div></section>`;
  }

  function headMarkup() {
    const returnRoute = hostContext?.modelingReturnContext?.returnRoute || (hostContext?.explorationHandoff ? "#module/m07" : null);
    const modelCount = [...portfolioContexts.values()].reduce((sum, item) => sum + Number(item.state?.modelDefinitions?.length || 0), 0);
    const monitoringCount = [...portfolioContexts.values()].filter((item) => item.state?.consumerBinding?.status === "APPLIED").length;
    return `${mobileSelect()}<header class="center-head"><div><span class="eyebrow">模型管理</span><h1>模型优化中心</h1><p>${PROGRAM_IDS.length} 个业务目标 · ${modelCount} 个模型 · ${monitoringCount} 个目标持续监测</p></div><div class="center-head-actions">${returnRoute ? `<button class="btn" type="button" data-return-route="${esc(returnRoute)}">返回原工作位置</button>` : ""}<button class="btn" type="button" data-action="refresh">${icon("refresh-cw")}重新读取</button></div></header>`;
  }

  function nextMarkup() {
    const action = currentAction();
    if (!action) return "";
    return `<section class="next-action"><div><strong>${esc(programName(scenarioId))} · ${esc(action.label)}</strong><span>${esc(action.reason || "完成当前操作后进入下一阶段。")}</span></div>${actionButton(action, "primary", scenarioId)}</section>`;
  }

  function explorationContextMarkup() {
    const handoff = hostContext?.explorationHandoff;
    if (!handoff) return "";
    const resultReady = Boolean(state?.results?.candidateEnvelope || state?.results?.simulationEnvelope);
    return `<section class="section"><header class="section-head"><div><h2>当前探索上下文</h2><p>后续运行沿用已选择的对象、时间范围和版本。</p></div><div class="center-head-actions"><button class="btn" type="button" data-return-route="#module/m07">返回多视图探索</button>${resultReady ? `<button class="btn primary" type="button" data-action="return-result">带回当前模型结果</button>` : ""}</div></header><div class="section-body"><div class="status-strip"><div><span>业务对象</span><strong>${esc(handoff.objectRef?.title || handoff.objectRef?.id || "未提供")}</strong><small>${esc(handoff.objectRef?.objectTypeRef || ui.subjectLabel)}</small></div><div><span>时间范围</span><strong>${esc(handoff.timeRange?.label || `${handoff.timeRange?.start || "—"} 至 ${handoff.timeRange?.end || "—"}`)}</strong><small>保持原选择</small></div><div><span>数据版本</span><strong>${esc(short(handoff.dataVersionId))}</strong><small>输入版本固定</small></div><div><span>语义版本</span><strong>${esc(short(handoff.ontologyVersionId))}</strong><small>合同不漂移</small></div><div><span>当前视图</span><strong>${esc(handoff.lensRef?.lensId || "对象目录")}</strong><small>${esc(handoff.lensRef?.moduleId || "多视图探索")}</small></div></div></div></section>`;
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

  function overviewView() {
    const stages = [
      ["database", "数据与语义", "冻结可复算数据和模型合同"],
      ["scale", "统一评测", "正式模型与候选使用同一口径"],
      ["sparkles", "优化洞察", "AI 提建议，业务人员审查"],
      ["git-branch", "候选版本", "每次变化形成不可变版本"],
      ["scan-eye", "影子观察", "随新标签成熟持续复评"],
      ["package-check", "发布监测", "人工应用、持续跟踪与回退"]
    ];
    return `${explorationContextMarkup()}${programDirectoryMarkup()}<section class="section optimization-map"><header class="section-head"><div><h2>持续优化流程</h2><p>所有业务目标使用同一套受控流程。</p></div></header><div class="section-body"><div class="optimization-map-grid">${stages.map(([iconName, label, detail], index) => `<article><span>${icon(iconName)}</span><b>${index + 1}</b><strong>${label}</strong><small>${detail}</small></article>`).join("")}</div></div></section>`;
  }

  function objectivesSection() {
    return `<section class="section"><header class="section-head"><div><h2>业务目标</h2><p>每个目标对应独立问题、输入、输出和结果身份。</p></div></header><div class="section-body"><div class="objective-grid">${objectives.map((item) => `<article class="objective-card"><header><div><h3>${esc(item.name)}</h3><span class="pill">${esc(objectiveKindLabel(item.kind))}</span></div><span class="pill ${/READY|ACTIVE|EVALUATED/.test(item.status || item.executionStatus || "") ? "success" : "warning"}">${esc(businessStatus(item.executionStatus || item.status || "已登记"))}</span></header><p>${esc(item.businessQuestion || "未提供业务问题")}</p><dl><div><dt>输入</dt><dd>${item.inputCount ?? "—"} 项</dd></div><div><dt>输出</dt><dd>${item.outputCount ?? "—"} 项</dd></div><div><dt>结果身份</dt><dd>${esc((item.resultKinds || []).map(resultKindLabel).join(" / ") || "—")}</dd></div></dl><details class="evidence"><summary>查看目标合同</summary><pre>${esc(JSON.stringify({ objectiveId: item.objectiveId, revisionId: item.revisionId, kind: item.kind, resultKinds: item.resultKinds, bindingStatus: item.bindingStatus, releaseStatus: item.releaseStatus }, null, 2))}</pre></details></article>`).join("") || `<div class="empty"><strong>当前场景没有登记模型目标</strong><span>请先在本体管理和数据工程中形成可用合同。</span></div>`}</div></div></section>`;
  }

  function portfolioView() {
    const models = state?.modelDefinitions || [];
    const repositories = new Map(repositoryCatalog.map((item) => [item.modelId, item]));
    return `${programDirectoryMarkup()}${objectivesSection()}<section class="section"><header class="section-head"><div><h2>${esc(programName(scenarioId))} · 模型组合</h2><p>同一业务问题公平比较，补充模型保持独立结果。</p></div></header><div class="section-body table-wrap"><table class="data-table model-portfolio-table"><thead><tr><th>模型</th><th>角色</th><th>解决的问题</th><th>版本</th><th>运行状态</th><th></th></tr></thead><tbody>${models.map((item) => { const run = state?.modelRuns?.find((entry) => entry.modelId === item.modelId); const repo = repositories.get(item.modelId); return `<tr><td data-label="模型"><strong>${esc(item.name)}</strong><details class="cell-evidence"><summary>技术身份</summary><code>${esc(item.modelId)}</code></details></td><td data-label="角色">${esc(roleLabel(item.modelRole))}</td><td data-label="解决的问题">${esc(item.businessQuestion || item.outputIdentity || "")}</td><td data-label="版本"><strong>${esc(item.version || item.modelVersion || "当前版本")}</strong><details class="cell-evidence"><summary>版本标识</summary><code>${esc(item.modelVersionId)}</code></details></td><td data-label="运行状态"><span class="pill ${item.modelRole === "FORMAL_BASELINE" || run ? "success" : "warning"}">${item.modelRole === "FORMAL_BASELINE" ? "正式使用" : run ? "已评测" : "尚未运行"}</span>${repo?.latestRun ? `<small>Python ${esc(businessStatus(repo.latestRun.status))}</small>` : ""}</td><td data-label="维护"><button class="btn compact" type="button" data-repository-model-id="${esc(item.modelId)}" ${repo ? "" : "disabled"}>${icon("code-2")}打开代码</button></td></tr>`; }).join("")}</tbody></table></div></section>`;
  }

  function repositoryView() {
    if (!repositoryRegistered) return `<section class="section"><header class="section-head"><div><h2>模型代码仓</h2><p>业务场景可按统一合同登记 Python 模型仓。</p></div></header><div class="section-body"><div class="empty"><strong>当前业务场景未登记 Python 模型仓</strong><span>模型评测与结果消费仍按现有业务合同运行；代码仓能力可在后续版本注册。</span></div></div></section>`;
    if (!repository) return `<section class="section"><header class="section-head"><div><h2>模型代码仓</h2><p>正在读取模型文件、分支、提交、标签和运行记录。</p></div></header><div class="section-body"><div class="empty"><strong>正在打开代码仓</strong><span>读取不可变提交快照。</span></div></div></section>`;
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
        ? [repositoryConsole.status, repositoryConsole.command, repositoryConsole.stdout, repositoryConsole.stderr, repositoryConsole.resultEnvelope ? JSON.stringify({ modelId: repositoryConsole.resultEnvelope.modelId, resultKind: repositoryConsole.resultEnvelope.resultKind, resultCount: repositoryConsole.resultEnvelope.resultCount, dataVersionId: repositoryConsole.resultEnvelope.dataVersionId, semanticContractVersionId: repositoryConsole.resultEnvelope.semanticContractVersionId, sample: repositoryConsole.resultEnvelope.results?.slice(0, 2) }, null, 2) : ""].filter(Boolean).join("\n\n")
        : "选择“运行模型”或“运行测试”后，这里显示真实 Python 进程输出、结果摘要和证据身份。";
    return `<section class="section repository-section"><header class="section-head"><div><h2>模型代码仓</h2><p>代码、README、运行结果和版本历史使用同一模型身份。</p></div><div class="center-head-actions"><button class="btn" type="button" data-repository-action="test" ${repositoryBusy ? "disabled" : ""}>${icon("test-tube-2")}运行测试</button><button class="btn primary" type="button" data-repository-action="run" ${repositoryBusy || !dataReady ? "disabled" : ""} title="${dataReady ? "使用当前冻结数据运行" : "请先在 M02 冻结数据并在 M01 形成语义合同"}">${icon("play")}运行模型</button></div></header><div class="repository-identity"><div><span>模型</span><strong>${esc(repository.name)}</strong><small>${esc(repository.modelId)}</small></div><div><span>角色</span><strong>${esc(roleLabel(repository.role))}</strong><small>${repository.readOnly ? "当前正式模型只读" : "候选研发可提交"}</small></div><div><span>当前分支</span><select data-repository-branch>${repository.branches.map((item) => `<option value="${esc(item.name)}" ${item.name === repository.selectedBranch ? "selected" : ""}>${esc(item.name)} · ${esc(short(item.headCommitId, 18))}${item.protected ? " · 受保护" : ""}</option>`).join("")}</select></div><div><span>运行输入</span><strong>${dataReady ? esc(short(state.data.dataVersionId, 26)) : "数据合同未就绪"}</strong><small>${dataReady ? esc(short(state.semanticContract.semanticContractVersionId, 26)) : "运行按钮保持阻断"}</small></div></div><div class="repository-layout"><aside class="repository-browser"><header><strong>模型仓库</strong><span>${repositoryCatalog.length}</span></header><div class="repository-list">${repositoryCatalog.map((item) => `<button type="button" class="${item.modelId === repository.modelId ? "active" : ""}" data-repository-model-id="${esc(item.modelId)}"><span>${esc(roleLabel(item.role))}</span><strong>${esc(item.name)}</strong><small>${esc(short(item.headCommitId, 18))}</small></button>`).join("")}</div><header class="file-head"><strong>文件</strong><span>${repository.files.length}</span></header><div class="file-tree">${repository.files.map((item) => `<button type="button" class="${item.path === selectedFile?.path ? "active" : ""}" data-repository-file="${esc(item.path)}">${icon(item.language === "python" ? "file-code-2" : item.language === "markdown" ? "file-text" : item.language === "json" ? "braces" : "file")}<span>${esc(item.path)}</span></button>`).join("")}</div></aside><main class="repository-editor"><header><div><strong>${esc(selectedFile?.path || "未选择文件")}</strong><span>${esc(selectedFile?.language || "text")} · ${changed ? "有未提交修改" : `提交 ${esc(repository.selectedCommitId)}`}</span></div><span class="pill ${branchProtected ? "warning" : changed ? "warning" : "success"}">${branchProtected ? "受保护" : changed ? "未提交" : "已同步"}</span></header><textarea data-repository-editor data-file-path="${esc(selectedFile?.path || "")}" spellcheck="false" ${branchProtected ? "readonly" : ""}>${esc(content)}</textarea><section class="repository-console"><header><strong>${esc(consoleTitle)}</strong><span>${repositoryBusy ? "运行中" : repositoryConsole?.status ? esc(businessStatus(repositoryConsole.status)) : "等待命令"}</span></header><pre>${esc(consoleText)}</pre></section></main><aside class="repository-git"><section><header><div><span>Git 状态</span><strong>${esc(repository.selectedBranch)} @ ${esc(repository.selectedCommitId)}</strong></div><span class="pill ${branchProtected ? "warning" : "success"}">${branchProtected ? "受保护" : "可维护"}</span></header><dl><div><dt>分支</dt><dd>${repository.branchCount}</dd></div><div><dt>提交</dt><dd>${repository.commitCount}</dd></div><div><dt>标签</dt><dd>${repository.tagCount}</dd></div><div><dt>发布候选</dt><dd>${repository.releaseCandidateCount}</dd></div></dl></section><section class="git-form"><label><span>新分支</span><input data-repository-form="branchName" data-repository-branch-name value="${esc(repositoryForm.branchName)}" placeholder="feature/优化说明" ${repository.readOnly ? "disabled" : ""}></label><button class="btn" type="button" data-repository-action="branch" ${repositoryBusy || repository.readOnly ? "disabled" : ""}>${icon("git-branch")}创建分支</button><label><span>提交说明</span><input data-repository-form="commitMessage" data-repository-commit-message value="${esc(repositoryForm.commitMessage)}" placeholder="说明本次模型修改" ${branchProtected ? "disabled" : ""}></label><button class="btn" type="button" data-repository-action="commit" ${repositoryBusy || branchProtected || !changed ? "disabled" : ""}>${icon("git-commit-horizontal")}提交当前文件</button><label><span>版本标签</span><input data-repository-form="tagName" data-repository-tag-name value="${esc(repositoryForm.tagName)}" placeholder="v0.2.0-rc.1" ${repository.readOnly ? "disabled" : ""}></label><div class="git-form-actions"><button class="btn" type="button" data-repository-action="tag" ${repositoryBusy || repository.readOnly ? "disabled" : ""}>创建标签</button><button class="btn primary" type="button" data-repository-action="release" ${repositoryBusy || repository.readOnly ? "disabled" : ""}>形成发布候选</button></div></section><section class="repository-readme"><header><span>README</span><strong>业务与维护说明</strong></header><pre>${esc(readme.slice(0, 1400))}</pre></section><section class="commit-history"><header><span>提交历史</span><strong>${repository.commits.length} 条</strong></header>${repository.commits.slice(0, 5).map((item) => `<article><strong>${esc(item.message)}</strong><span>${esc(item.commitId)} · ${esc(item.author)}</span><small>${esc(item.committedAt.replace("T", " ").slice(0, 16))}</small></article>`).join("")}</section></aside></div></section>`;
  }

  function benchmarkView() {
    const benchmark = state?.benchmarks?.at(-1);
    const cards = context?.benchmarkCards || [];
    return `${programDirectoryMarkup()}<section class="section"><header class="section-head"><div><h2>${esc(programName(scenarioId))} · 统一评测</h2><p>效果、覆盖率、校准、漂移、最弱业务切片和缺失原因使用同一口径。</p></div></header><div class="section-body">${benchmark ? `<div class="metric-grid">${cards.map((card) => `<div class="metric"><span>${esc(card.label)}</span><strong>${esc(formatMetric(card))}</strong><small>${esc(card.note || (card.direction === "lower" ? "越低越好" : "越高越好"))}</small></div>`).join("")}</div><details class="evidence"><summary>查看评测证据</summary><pre>${esc(JSON.stringify(benchmark, null, 2))}</pre></details>` : `<div class="empty"><strong>尚未形成评测</strong><span>使用当前目标的下一步操作运行正式模型评测。</span></div>`}</div></section>${insightsView()}`;
  }

  function reviewPanel() {
    const review = state?.insightReview;
    if (!state?.insights?.length) return "";
    if (!review) return `<section class="review-panel"><div><strong>需要业务评审</strong><p>请核对每条洞察的证据、预期收益、潜在风险和验证方式。批准只允许创建新候选版本，不会选择冠军或发布。</p></div><div class="center-head-actions"><button class="btn danger" type="button" data-action="review-reject">驳回并记录</button><button class="btn primary" type="button" data-action="review-approve">批准并记录</button></div></section>`;
    return `<section class="review-panel ${review.decision === "APPROVED" ? "approved" : "rejected"}"><div><strong>${review.decision === "APPROVED" ? "人工审查已批准" : "人工审查已驳回"}</strong><p>${esc(review.reviewComment || (review.decision === "APPROVED" ? "允许基于当前变更建议创建一个新的不可变候选版本。" : "当前洞察不得用于创建候选版本。"))}</p></div><dl><div><dt>评审人</dt><dd>${esc(review.reviewedBy)}</dd></div><div><dt>审查凭证</dt><dd>${esc(review.reviewReceiptId)}</dd></div><div><dt>不可变摘要</dt><dd>${esc(short(review.receiptDigest))}</dd></div></dl></section>`;
  }

  function insightsView() {
    const insights = state?.insights || [];
    return `<section class="section"><header class="section-head"><div><h2>优化洞察与人工审查</h2><p>AI 提出有证据的改进建议，业务评审决定是否允许创建候选版本。</p></div></header><div class="section-body">${reviewPanel()}<div class="card-list">${insights.map((item) => `<article class="info-card"><header><h3>${esc(item.title || item.name || item.insightId)}</h3><span class="pill">证据洞察</span></header><p>${esc(item.businessInterpretation || item.problem || item.summary || item.description || "")}</p><dl><div><dt>预期收益</dt><dd>${esc(item.expectedImprovement || "未提供")}</dd></div><div><dt>潜在风险</dt><dd>${esc(item.possibleRisk || "未提供")}</dd></div><div><dt>验证方式</dt><dd>${esc(item.validationMethod || "未提供")}</dd></div></dl><details class="evidence"><summary>查看依据与变更建议</summary><pre>${esc(JSON.stringify(item, null, 2))}</pre></details></article>`).join("") || `<div class="empty"><strong>尚未形成优化洞察</strong><span>完成模型组合评测后，从上方“下一步”生成。</span></div>`}</div></div></section>`;
  }

  function candidatesView() {
    const candidates = state?.candidates || [];
    return `<section class="section"><header class="section-head"><div><h2>候选版本</h2><p>每次优化形成新的不可变 Model Version，并绑定人工审查凭证。</p></div></header><div class="section-body"><div class="card-list">${candidates.map((item) => `<article class="info-card"><header><h3>${esc(item.name)}</h3><span class="pill success">${esc(businessStatus(item.status || "已评测"))}</span></header><p>${esc(item.businessSummary || "用于影子试运行，不覆盖当前正式模型。")}</p><details class="evidence"><summary>查看版本与审查证据</summary><dl><div><dt>Model Version</dt><dd>${esc(item.modelVersionId)}</dd></div><div><dt>数据版本</dt><dd>${esc(item.dataVersionId)}</dd></div><div><dt>审查凭证</dt><dd>${esc(item.insightReviewReceiptId || "未提供")}</dd></div><div><dt>不可变</dt><dd>${item.immutable ? "是" : "否"}</dd></div></dl></details></article>`).join("") || `<div class="empty"><strong>尚未形成候选版本</strong><span>优化洞察通过人工审查后，从上方“下一步”创建。</span></div>`}</div></div></section>`;
  }

  function shadowView() {
    const shadow = state?.shadowTrial;
    return `${programDirectoryMarkup()}${candidatesView()}<section class="section"><header class="section-head"><div><h2>${esc(programName(scenarioId))} · 影子试运行</h2><p>候选与当前正式模型并行观察，不改变默认结果或业务事实。</p></div></header><div class="section-body">${shadow ? `<div class="metric-grid"><div class="metric"><span>当前状态</span><strong>${esc(businessStatus(shadow.status))}</strong><small>${esc(shadow.shadowTrialId)}</small></div><div class="metric"><span>成熟窗口</span><strong>${shadow.maturedWindows?.length || 0}</strong><small>共 ${shadow.maturityWindows?.length || 3} 个窗口</small></div><div class="metric"><span>新增标签</span><strong>${shadow.maturedWindows?.reduce((sum, item) => sum + Number(item.newMaturedLabelCount || 0), 0) || 0}</strong><small>独立结果标签</small></div><div class="metric"><span>自动发布</span><strong>禁止</strong><small>必须人工应用</small></div></div><div class="card-list" style="margin-top:10px">${(shadow.maturedWindows || []).map((item) => `<article class="info-card"><header><h3>${esc(item.label || item.maturityWindowId)}</h3><span class="pill success">已成熟</span></header><p>新增 ${item.newMaturedLabelCount} 条标签，候选与当前正式模型使用同一口径复评。</p></article>`).join("")}</div>` : `<div class="empty"><strong>尚未开始影子试运行</strong><span>形成候选版本后，使用当前目标的下一步操作开始观察。</span></div>`}</div></section>`;
  }

  function releaseView() {
    const release = state?.releaseCandidate;
    const binding = state?.consumerBinding;
    return `${programDirectoryMarkup()}<section class="section"><header class="section-head"><div><h2>${esc(programName(scenarioId))} · 发布与应用</h2><p>发布候选、消费绑定和当前正式模型身份严格分离。</p></div></header><div class="section-body"><div class="objective-grid"><article class="info-card"><header><h3>发布候选</h3><span class="pill ${release ? "success" : "warning"}">${release ? "已形成" : "尚未形成"}</span></header><p>${release ? "封存测试集只使用一次，仍不代表生产资格或正式有效性。" : "影子观察成熟并使用相同口径复评后形成。"}</p>${release ? `<dl><div><dt>Release Candidate</dt><dd>${esc(release.releaseCandidateId)}</dd></div><div><dt>Model Version</dt><dd>${esc(release.modelVersionId)}</dd></div><div><dt>生产资格</dt><dd>否</dd></div></dl>` : ""}</article><article class="info-card"><header><h3>${esc(ui.consumerLabel)}应用</h3><span class="pill ${binding?.status === "APPLIED" ? "success" : "warning"}">${esc(businessStatus(binding?.status || "尚未应用"))}</span></header><p>只更新候选结果消费绑定，不改变当前正式模型和业务事实。</p>${binding ? `<dl><div><dt>Binding</dt><dd>${esc(binding.bindingRevisionId)}</dd></div><div><dt>正式指针变化</dt><dd>否</dd></div><div><dt>外部副作用</dt><dd>0</dd></div></dl>` : ""}</article></div></div></section>${monitorView()}`;
  }

  function monitorView() {
    const packageId = state?.results?.resultPackage?.resultPackageId;
    const capabilities = context?.capabilities || {};
    return `<section class="section"><header class="section-head"><div><h2>监测、历史与回退</h2><p>持续查看运行状态、消费者一致性、压力模拟、历史版本和回退路径。</p></div><div class="center-head-actions">${capabilities.pressureSimulation && state?.modelRuns?.length ? `<button class="btn" type="button" data-action="run-stress">运行压力模拟</button>` : ""}${capabilities.rollback && state?.consumerBinding?.status === "APPLIED" ? `<button class="btn danger" type="button" data-action="rollback-binding">回退候选应用</button>` : ""}</div></header><div class="section-body"><div class="metric-grid"><div class="metric"><span>Result Package</span><strong>${packageId ? "已形成" : "未形成"}</strong><small>${esc(short(packageId))}</small></div><div class="metric"><span>统一消费者</span><strong>5</strong><small>驾驶舱 / 探索 / 问数 / 解释 / 报告</small></div><div class="metric"><span>非事实行动</span><strong>0</strong><small>决策中心硬拒绝</small></div><div class="metric"><span>历史周期</span><strong>${state?.cycleHistory?.length || 0}</strong><small>历史版本保持只读</small></div></div><details class="evidence"><summary>查看当前运行证据</summary><pre>${esc(JSON.stringify({ cycle: state?.cycle, resultPackage: state?.results?.resultPackage, bindingHistory: state?.bindingHistory, cycleHistory: state?.cycleHistory }, null, 2))}</pre></details></div></section>`;
  }

  function viewMarkup() {
    if (!state) return `<section class="section"><div class="section-body"><div class="empty"><strong>正在读取模型运行状态</strong><span>读取当前场景注册、版本和运行证据。</span></div></div></section>`;
    if (repositoryMode) return repositoryView();
    if (activeView === "portfolio") return portfolioView();
    if (activeView === "benchmark") return benchmarkView();
    if (activeView === "shadow") return shadowView();
    if (activeView === "release") return releaseView();
    return overviewView();
  }

  function render() {
    root.innerHTML = `<div class="center-layout">${navMarkup()}<section class="center-main">${headMarkup()}${activeView === "overview" || repositoryMode ? "" : nextMarkup()}${error ? `<div class="action-error">${esc(error)}</div>` : ""}${viewMarkup()}</section></div>`;
    root.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view, button.dataset.scenarioId)));
    root.querySelector("[data-mobile-view]")?.addEventListener("change", (event) => switchView(event.target.value));
    root.querySelectorAll("[data-program-scenario]").forEach((button) => button.addEventListener("click", () => void selectProgram(button.dataset.programScenario, button.dataset.programView || activeView)));
    root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => void runAction(button.dataset.action, button.dataset.scenarioId)));
    root.querySelectorAll("[data-route]").forEach((button) => button.addEventListener("click", () => global.parent.postMessage({ type: "OFW_M08_NAVIGATE", route: button.dataset.route, scenarioId: button.dataset.scenarioId || scenarioId }, global.location.origin)));
    root.querySelectorAll("[data-return-route]").forEach((button) => button.addEventListener("click", () => global.parent.postMessage({ type: "OFW_M08_NAVIGATE", route: button.dataset.returnRoute }, global.location.origin)));
    root.querySelectorAll("[data-repository-model-id]").forEach((button) => button.addEventListener("click", () => {
      repositoryMode = true;
      activeView = "portfolio";
      history.replaceState(null, "", "#repository");
      render();
      void openRepository(button.dataset.repositoryModelId);
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
      if (commitButton) commitButton.disabled = repository?.readOnly || event.target.value === original;
      root.querySelector(".repository-editor > header .pill")?.classList.toggle("warning", event.target.value !== original);
    });
    root.querySelectorAll("[data-repository-form]").forEach((input) => input.addEventListener("input", () => {
      repositoryForm = { ...repositoryForm, [input.dataset.repositoryForm]: input.value };
    }));
    root.querySelectorAll("[data-repository-action]").forEach((button) => button.addEventListener("click", () => void runRepositoryCommand(button.dataset.repositoryAction)));
    global.lucide?.createIcons?.({ attrs: { "stroke-width": 1.8 } });
  }

  function switchView(view, targetScenarioId = null) {
    const normalized = VIEW_ALIASES[view] || view;
    if (!views.some(([id]) => id === normalized)) return;
    if (targetScenarioId && portfolioContexts.has(targetScenarioId)) {
      scenarioId = targetScenarioId;
      accept(portfolioContexts.get(targetScenarioId), targetScenarioId);
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
    const payload = portfolioContexts.get(targetScenarioId) || await request(`/v1/model-management/context?scenarioId=${encodeURIComponent(targetScenarioId)}`);
    accept(payload, targetScenarioId);
    await loadRepositoryCatalog();
    activeView = views.some(([id]) => id === targetView) ? targetView : "portfolio";
    history.replaceState(null, "", `#${activeView}`);
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
      if (!repository.files.some((item) => item.path === selectedRepositoryFile)) selectedRepositoryFile = repository.files.some((item) => item.path === "README.md") ? "README.md" : repository.files[0]?.path || "";
      repositoryDrafts = {};
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
        message: approved ? "批准后只能创建新的不可变候选版本，不会自动选择冠军或发布。" : "驳回后当前洞察和审查凭证进入历史，可根据意见生成新一批洞察。",
        confirmLabel: approved ? "批准并记录" : "驳回并记录",
        reviewer: true,
        comment: true
      });
      return;
    }
    if (["apply-binding", "rollback-binding", "start-next-cycle"].includes(action)) {
      const copy = {
        "apply-binding": ["应用候选结果", `应用后${ui.consumerLabel}可消费该候选结果，当前正式模型和业务事实不会变化。`, "确认应用"],
        "rollback-binding": ["回退候选应用", "回退只改变候选消费绑定，历史版本和当前正式模型继续保留。", "确认回退"],
        "start-next-cycle": ["启动下一优化周期", "当前周期进入历史，新周期从数据准备开始。", "启动新周期"]
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
      const response = await request(`/v1/model-management/actions/${encodeURIComponent(action)}`, { method: "POST", body: JSON.stringify({ scenarioId: state?.scenario?.scenarioId || scenarioId, payload }) });
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
      if (repositoryRegistered && repositoryMode) {
        const modelId = repository?.modelId || repositoryCatalog[0]?.modelId;
        if (modelId) {
          const query = new URLSearchParams({ scenarioId });
          if (repository?.selectedBranch) query.set("branch", repository.selectedBranch);
          repository = await request(`/v1/model-management/repositories/${encodeURIComponent(modelId)}?${query}`);
          if (!repository.files.some((item) => item.path === selectedRepositoryFile)) selectedRepositoryFile = repository.files.some((item) => item.path === "README.md") ? "README.md" : repository.files[0]?.path || "";
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
    const requested = global.location.hash.slice(1);
    if (requested === "repository") {
      repositoryMode = true;
      activeView = "portfolio";
      render();
      if (repositoryRegistered && !repository && repositoryCatalog[0]) void openRepository(repositoryCatalog[0].modelId);
      return;
    }
    const next = VIEW_ALIASES[requested] || requested;
    if (views.some(([id]) => id === next)) {
      if (requested !== next) history.replaceState(null, "", `#${next}`);
      repositoryMode = false;
      activeView = next;
      render();
    }
  });
  global.addEventListener("message", (event) => {
    if (event.origin !== global.location.origin || event.source !== global.parent || event.data?.type !== "OFW_M08_DELIVER_CONTEXT") return;
    hostContext = event.data.payload || null;
    render();
  });
  render();
  void load();
})(window);
