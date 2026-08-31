(function mountM08ObjectiveWorkspace(global) {
  "use strict";

  const root = document.getElementById("m08-module-content");
  const DATA = global.M08_MODELING_DATA || {};
  const BRIDGE = global.OFW_M07_M08_BRIDGE;
  if (!BRIDGE) throw new Error("OFW_M07_M08_BRIDGE is required before content.js");
  const queryParameters = new URLSearchParams(location.search);
  const API_BASE = queryParameters.get("apiBase") || "http://127.0.0.1:4357";
  let urlScenario = null;
  try { urlScenario = BRIDGE.scenarioIdentity(Object.fromEntries(queryParameters)); } catch (_) {}
  const SESSION_KEY = `ofw.m08.research.v1.objective-workspace.v2.${urlScenario?.scenarioRunId || "unbound"}`;
  const mountedStudy = urlScenario ? DATA.caseStudies?.[urlScenario.scenarioId] || null : null;
  const S003_OBJECTIVE_ID = "MO-S003-DEBT-RISK-EARLY-WARNING-v1";
  const SECTIONS = ["catalog", "objective", "contracts", "benchmark", "insights", "candidates", "binding", "consumption", "simulation"];
  const SECTION_ALIASES = Object.freeze({
    objectives: "catalog",
    overview: "objective",
    input: "contracts",
    output: "contracts",
    evaluation: "benchmark",
    review: "candidates",
    release: "binding",
    tracking: "consumption",
    usage: "simulation",
    simulation: "objective",
    case: "objective",
    isolation: "objective"
  });
  const icons = {
    activity: '<path d="M3 12h4l2-8 4 16 2-8h6"/>',
    catalog: '<rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m10.7 7.2-3.4 8.6M13.3 7.2l3.4 8.6M8.5 18h7"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M10.3 3.8 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    shield: '<path d="M12 3 5 6v5c0 4.8 2.8 7.9 7 10 4.2-2.1 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    flask: '<path d="M9 3h6M10 3v5l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3.5L14 8V3"/><path d="M8 14h8"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    report: '<path d="M4 19V5m5 14V9m5 10V3m5 16v-6"/>',
    query: '<path d="M4 5h16v11H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>',
    bot: '<rect x="5" y="7" width="14" height="11" rx="2"/><path d="M12 3v4M8.5 12h.01M15.5 12h.01M9 15h6"/>',
    decision: '<path d="M12 3v18M5 7h14M5 17h14"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="17" r="2"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>'
  };
  const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.activity}</svg>`;
  const kindLabels = { FORECAST: "预测", CLASSIFICATION: "分类", SCORING: "评分", OPTIMIZATION: "优化" };
  const statusLabels = {
    RESEARCH_EVALUATED: "已完成评估",
    CONTRACT_READY: "合同已定义",
    RESEARCH_RELEASE_CANDIDATE: "发布候选",
    DRAFT_RESEARCH_RELEASE: "发布草案",
    VALIDATED_RESEARCH_BINDING_REQUIRES_M01_CR: "Binding 已校验，待 M01 CR",
    DRAFT_REQUIRES_M01_CR: "Binding 草案，待 M01 CR",
    RESEARCH_BENCHMARK_READY: "基准评测可运行",
    READY_TO_BENCHMARK: "等待基准评测",
    BENCHMARK_READY: "基准评测已完成",
    EVALUATED: "已完成评测",
    PENDING_EVALUATION: "等待评测",
    DATA_REQUIRED: "待补数据或语义",
    ACTIVE: "持续观察中",
    MATURED: "三个窗口已成熟",
    RESEARCH_RELEASE_CANDIDATE: "发布候选已形成",
    VALIDATED_RESEARCH_BINDING: "动态合同已通过",
    VALID: "校验通过",
    REJECTED: "校验拒绝",
    DEFAULT_CANDIDATE_APPLIED: "默认候选已应用",
    BLOCKED: "已阻断",
    ALLOWED: "可只读消费",
    SUCCEEDED: "运行完成",
    INSUFFICIENT_LABELS: "成熟标签不足"
  };
  const consumerIcons = { M07_EXPLORATION: "eye", M06_REPORT: "report", M03_QUERY: "query", M05_AGENT: "bot", M04_DECISION: "decision" };

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") || {}; } catch (_) { return {}; }
  }

  const persisted = readSession();
  const requestedView = queryParameters.get("view");
  const initialHash = (location.hash || "#catalog").replace(/^#\/?/, "");
  const initialSection = requestedView && SECTIONS.includes(requestedView)
    ? requestedView
    : SECTION_ALIASES[initialHash] || initialHash;
  const canonicalInitialHash = initialSection === "simulation" ? "usage" : initialSection;
  if (initialHash !== canonicalInitialHash) history.replaceState({}, "", `#${canonicalInitialHash}`);
  const state = {
    section: SECTIONS.includes(initialSection) ? initialSection : "catalog",
    apiHealth: "pending",
    context: urlScenario ? { scenarioContext: urlScenario } : null,
    projection: null,
    catalog: [],
    objectiveCache: new Map(),
    objectiveId: persisted.objectiveId || DATA.defaultObjectiveByScenario?.[urlScenario?.scenarioId] || null,
    objective: null,
    catalogSearch: "",
    kindFilter: "ALL",
    catalogScope: persisted.catalogScope || "SCENARIO",
    loading: true,
    error: null,
    bindingValidation: null,
    bindingLoading: false,
    consumerId: persisted.consumerId || "M07_EXPLORATION",
    consumerProjection: null,
    consumerLoading: false,
    explorationContext: persisted.explorationContext || null,
    appliedHandoffAt: persisted.appliedHandoffAt || null,
    compatibleObjectiveIds: persisted.compatibleObjectiveIds || [],
    caseObjectId: persisted.caseObjectId || mountedStudy?.m07?.selectedObjectId || null,
    caseRange: persisted.caseRange || "6",
    caseCaseId: persisted.caseCaseId || mountedStudy?.m08?.defaultCaseId || null,
    caseResult: persisted.caseResult || null,
    caseLoading: false,
    objectiveWorkspace: null,
    workspaceLoading: false,
    workspaceAction: null,
    workspaceError: null,
    selectedCandidateId: persisted.selectedCandidateId || null,
    defaultApplyConfirmation: false
  };

  function activeScenarioIdentity() {
    return BRIDGE.scenarioIdentity(state.context?.scenarioContext || urlScenario);
  }

  function activeCaseStudy() {
    try {
      return DATA.caseStudies?.[activeScenarioIdentity().scenarioId] || null;
    } catch (_) {
      return null;
    }
  }

  function activeScenarioId() {
    try { return activeScenarioIdentity().scenarioId; } catch (_) { return null; }
  }

  function saveSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        objectiveId: state.objectiveId,
        consumerId: state.consumerId,
        explorationContext: state.explorationContext,
        appliedHandoffAt: state.appliedHandoffAt,
        compatibleObjectiveIds: state.compatibleObjectiveIds,
        caseObjectId: state.caseObjectId,
        caseRange: state.caseRange,
        caseCaseId: state.caseCaseId,
        caseResult: state.caseResult,
        catalogScope: state.catalogScope,
        selectedCandidateId: state.selectedCandidateId
      }));
    } catch (_) {}
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers["content-type"] = "application/json";
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.message || `M08 API ${response.status}`);
      error.code = body.code || "M08_API_ERROR";
      error.details = body.details || {};
      throw error;
    }
    return body;
  }

  function workspacePayload(response) {
    return response?.workspace || response?.state || response;
  }

  function emitS003Workspace() {
    if (!state.objectiveWorkspace) return;
    let scenario = null;
    try { scenario = activeScenarioIdentity(); } catch (_) { return; }
    const workspace = structuredClone(state.objectiveWorkspace);
    global.parent?.postMessage?.({
      type: "OFW_S003_MODELING_WORKSPACE",
      sourceModuleId: "modeling",
      objectiveId: S003_OBJECTIVE_ID,
      scenarioContext: structuredClone(scenario),
      ...scenario,
      workspace,
      workspaceSnapshot: structuredClone(workspace),
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false
    }, location.origin);
  }

  function isS003Objective(objective = state.objective) {
    return objective?.objectiveId === S003_OBJECTIVE_ID;
  }

  async function loadObjectiveWorkspace() {
    if (!isS003Objective()) {
      state.objectiveWorkspace = null;
      return;
    }
    state.workspaceLoading = true;
    render();
    try {
      state.objectiveWorkspace = workspacePayload(await api("/v1/s003/workspace"));
      const candidates = state.objectiveWorkspace?.candidates || [];
      if (!candidates.some((candidate) => (candidate.candidateId || candidate.id) === state.selectedCandidateId)) {
        const preferred = candidates.find((candidate) => /EVALUATED|READY|SHADOW|SELECTED/.test(candidate.status || "")) || candidates[0];
        state.selectedCandidateId = preferred?.candidateId || preferred?.id || null;
      }
      state.workspaceError = null;
      saveSession();
      emitS003Workspace();
    } catch (error) {
      state.workspaceError = { code: error.code || "S003_WORKSPACE_UNAVAILABLE", message: error.message };
    } finally {
      state.workspaceLoading = false;
      render();
    }
  }

  const badge = (text, tone = "neutral") => `<span class="m08-badge ${tone}">${esc(text)}</span>`;
  const kindBadge = (kind) => badge(kindLabels[kind] || kind, String(kind || "").toLowerCase());
  const businessStatus = (value, fallback = "状态已记录") => statusLabels[statusValue(value)] || statusLabels[value] || fallback;

  function route(moduleId) {
    const route = moduleId === BRIDGE.CONTRACT.sourceModuleId
      ? BRIDGE.CONTRACT.sourceRoute
      : moduleId === "dashboard"
        ? "#dashboard"
      : `#module/${moduleId}`;
    global.parent?.postMessage?.({ type: "OFW_M08_NAVIGATE", moduleId, route }, location.origin);
  }

  function savedReturnContext() {
    return state.context?.modelingReturnContext || null;
  }

  function savedReturnLabel() {
    const route = savedReturnContext()?.returnRoute;
    const labels = { "#dashboard": "返回仪表盘", "#module/m07": "返回多视图探索", "#module/query": "返回智能问数", "#module/agent": "返回 Agent 应用", "#module/report": "返回报告中心" };
    return labels[route] || "返回上一步";
  }

  function navigateSavedReturn() {
    const context = savedReturnContext();
    if (!context?.returnRoute) return;
    const match = context.returnRoute.match(/^#module\/([a-z0-9-]+)$/);
    global.parent?.postMessage?.({ type: "OFW_M08_NAVIGATE", moduleId: match?.[1] || (context.returnRoute === "#dashboard" ? "dashboard" : null), route: context.returnRoute }, location.origin);
  }

  function setSection(section) {
    if (!SECTIONS.includes(section)) return;
    state.section = section;
    history.replaceState({}, "", `#${section === "simulation" ? "usage" : section}`);
    render();
    requestAnimationFrame(() => global.scrollTo(0, 0));
  }

  async function health() {
    try {
      const response = await api("/health");
      state.apiHealth = response.namespace === "ofw.m08.research.v1" && response.factWriteAllowed === false ? "ok" : "error";
    } catch (error) {
      state.apiHealth = "error";
      state.error = { code: error.code || "HEALTH_FAILED", message: error.message };
    }
    render();
  }

  async function loadCatalog() {
    state.loading = true;
    render();
    try {
      const response = await api("/v1/objectives");
      state.catalog = response.objectives || [];
      if (!state.catalog.some((item) => item.objectiveId === state.objectiveId)) {
        let scenarioId = null;
        try { scenarioId = activeScenarioIdentity().scenarioId; } catch (_) {}
        state.objectiveId = state.catalog.find((item) => item.scenarioIds?.includes(scenarioId))?.objectiveId || null;
      }
      if (state.objectiveId) await loadObjective(state.objectiveId, { preserveSection: true });
      state.error = null;
    } catch (error) {
      state.error = { code: error.code || "OBJECTIVE_CATALOG_FAILED", message: error.message };
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadObjective(objectiveId, { preserveSection = false } = {}) {
    state.objectiveId = objectiveId;
    state.bindingValidation = null;
    state.consumerProjection = null;
    let objective = state.objectiveCache.get(objectiveId);
    if (!objective) {
      objective = await api(`/v1/objectives/${encodeURIComponent(objectiveId)}`);
      state.objectiveCache.set(objectiveId, objective);
    }
    state.objective = structuredClone(objective);
    if (isS003Objective()) await loadObjectiveWorkspace();
    else state.objectiveWorkspace = null;
    saveSession();
    if (!preserveSection) setSection("objective");
    else render();
  }

  async function selectObjective(objectiveId, section = "objective") {
    state.loading = true;
    render();
    try {
      await loadObjective(objectiveId, { preserveSection: true });
      state.section = section;
      history.replaceState({}, "", `#${section === "simulation" ? "usage" : section}`);
      if (section === "consumption") await loadConsumerProjection(state.consumerId);
      state.error = null;
    } catch (error) {
      state.error = { code: error.code || "OBJECTIVE_LOAD_FAILED", message: error.message };
    } finally {
      state.loading = false;
      render();
    }
  }

  const WORKSPACE_ACTIONS = Object.freeze({
    "run-benchmark": ["/v1/s003/benchmark/run", {}],
    "generate-insights": ["/v1/s003/insights/generate", {}],
    "generate-candidates": ["/v1/s003/candidates/generate", {}],
    "evaluate-candidates": ["/v1/s003/candidates/evaluate", {}],
    "start-shadow": ["/v1/s003/shadow/start", () => ({ candidateId: state.selectedCandidateId })],
    "advance-shadow": ["/v1/s003/shadow/advance", {}],
    "form-release-candidate": ["/v1/s003/release-candidates/form", () => ({ candidateId: state.selectedCandidateId })],
    "validate-s003-binding": ["/v1/s003/bindings/validate", () => ({ candidateId: state.selectedCandidateId, binding: state.objective?.bindingDraft })],
    "apply-default": ["/v1/s003/bindings/apply-default", () => ({ candidateId: state.selectedCandidateId, confirmed: true, confirmedBy: "当前业务评审人" })]
  });

  function emitS003Result(response) {
    const sourceEnvelope = response?.resultEnvelope || response?.result || state.objectiveWorkspace?.currentResultEnvelope || state.objectiveWorkspace?.latestResultEnvelope || state.objectiveWorkspace?.resultEnvelope;
    if (!sourceEnvelope) return;
    let scenario = null;
    try { scenario = activeScenarioIdentity(); } catch (_) { return; }
    const workspace = state.objectiveWorkspace || {};
    const benchmarkRunId = sourceEnvelope.benchmarkRunId || workspace.researchRunRefs?.benchmarkRunId || workspace.benchmarkRunId || workspace.lastBenchmark?.benchmarkRunId || workspace.benchmarkRun?.benchmarkRunId || null;
    const experimentRunId = sourceEnvelope.experimentRunId || workspace.researchRunRefs?.experimentRunIds?.find(Boolean) || workspace.experimentRunId || workspace.latestExperiment?.experimentRunId || workspace.experimentRun?.experimentRunId || null;
    const shadowRunId = sourceEnvelope.shadowRunId || workspace.researchRunRefs?.shadowRunId || workspace.shadowRunId || workspace.shadowTrial?.shadowRunId || workspace.activeShadowTrial?.shadowRunId || null;
    const researchRunIds = [benchmarkRunId, experimentRunId, shadowRunId].filter(Boolean);
    if (researchRunIds.some((runId) => runId === scenario.scenarioRunId || /^S003-RUN/.test(runId))) {
      throw Object.assign(new Error("S003 归档 scenarioRunId 不能用作 M08 研究运行身份。"), { code: "ARCHIVED_SCENARIO_RUN_REUSE_REJECTED" });
    }
    const handoff = state.explorationContext?.objectRef ? structuredClone(state.explorationContext) : null;
    const objectiveRevisionId = sourceEnvelope.objectiveRevisionId || state.objective?.revisionId || null;
    const bindingRevisionId = sourceEnvelope.bindingRevisionId || workspace.binding?.bindingRevisionId || state.objective?.bindingDraft?.bindingRevisionId || null;
    const releaseId = sourceEnvelope.releaseId || workspace.releaseCandidate?.releaseCandidateId || state.objective?.release?.releaseId || null;
    const inputManifest = handoff ? {
      ...scenario,
      scenarioContext: structuredClone(scenario),
      sourceKind: "S003_FIXED_DATA_PREDICTION",
      usageIntent: sourceEnvelope.usageIntent || "WHAT_IF",
      objectRef: structuredClone(handoff.objectRef),
      lensRef: structuredClone(handoff.lensRef),
      seriesRef: structuredClone(handoff.seriesRef),
      timeRange: structuredClone(handoff.timeRange),
      dataVersionId: handoff.dataVersionId,
      ontologyVersionId: handoff.ontologyVersionId,
      bindingId: handoff.bindingId,
      objectiveId: S003_OBJECTIVE_ID,
      objectiveRevisionId,
      bindingRevisionId,
      releaseId,
      modelVersionId: sourceEnvelope.modelVersionId
    } : null;
    const sourceSubjects = Array.isArray(sourceEnvelope.subjects) ? sourceEnvelope.subjects : [];
    const subjectRefs = sourceSubjects.map((subject) => ({ id: subject.objectId || subject.enterpriseId, title: subject.objectName || subject.enterpriseName, objectTypeRef: "Enterprise" })).filter((subject) => subject.id);
    if (inputManifest?.objectRef && !subjectRefs.some((subject) => subject.id === inputManifest.objectRef.id)) subjectRefs.unshift(structuredClone(inputManifest.objectRef));
    const focused = inputManifest?.objectRef ? sourceSubjects.find((subject) => (subject.objectId || subject.enterpriseId) === inputManifest.objectRef.id) : null;
    const distribution = sourceEnvelope.summaries?.riskDistribution || null;
    const averageCoverage = sourceSubjects.length ? sourceSubjects.reduce((sum, subject) => sum + Number(subject.coverage || 0), 0) / sourceSubjects.length : null;
    const resultItems = focused ? [
      { outputId: "riskScore", label: "预测风险评分", shape: "SCALAR", resultKind: "PREDICTION", value: focused.riskScore, unit: "score_0_100" },
      { outputId: "riskIndex", label: "预测风险指数", shape: "SCALAR", resultKind: "PREDICTION", value: focused.riskIndex, unit: "index_0_100" },
      { outputId: "predictedRiskTier", label: "预测风险分档", shape: "SCALAR", resultKind: "PREDICTION", value: focused.predictedRiskTierName || focused.predictedRiskTier, unit: "risk_tier" },
      { outputId: "coverage", label: "结果覆盖率", shape: "SCALAR", resultKind: "PREDICTION", value: focused.coverage, unit: "ratio" },
      { outputId: "topContributors", label: "主要贡献项", shape: "OBJECT_SET", resultKind: "PREDICTION", value: structuredClone(focused.topContributors || []), unit: "risk_contribution" }
    ] : [
      { outputId: "enterpriseCount", label: "企业范围", shape: "SCALAR", resultKind: "PREDICTION", value: sourceSubjects.length, unit: "enterprise" },
      { outputId: "riskDistribution", label: "预测风险分布", shape: "OBJECT", resultKind: "PREDICTION", value: structuredClone(distribution), unit: "enterprise_distribution" },
      { outputId: "coverage", label: "平均结果覆盖率", shape: "SCALAR", resultKind: "PREDICTION", value: averageCoverage, unit: "ratio" }
    ];
    const resultEnvelope = {
      ...structuredClone(sourceEnvelope),
      objectiveRevisionId,
      bindingRevisionId,
      releaseId,
      subjectRefs,
      resultItems,
      inputSnapshot: {
        ...(sourceEnvelope.inputSnapshot || {}),
        ...scenario,
        scenarioContext: structuredClone(scenario),
        dataVersionId: inputManifest?.dataVersionId || sourceEnvelope.dataVersion || sourceEnvelope.inputSnapshot?.dataVersionId || sourceEnvelope.inputSnapshot?.dataVersion,
        ontologyVersionId: inputManifest?.ontologyVersionId || state.objective?.ontologyVersionId || sourceEnvelope.inputSnapshot?.ontologyVersionId,
        timeRange: structuredClone(inputManifest?.timeRange || sourceEnvelope.inputSnapshot?.timeRange || null)
      },
      benchmarkRunId,
      experimentRunId,
      shadowRunId,
      factWriteAllowed: false,
      actionWriteAllowed: false,
      actionSourceAllowed: false,
      sideEffectsEmitted: 0
    };
    global.parent?.postMessage?.({
      type: "OFW_S003_MODELING_RESULT",
      sourceModuleId: "modeling",
      objectiveId: S003_OBJECTIVE_ID,
      scenarioContext: structuredClone(scenario),
      ...scenario,
      workspace: structuredClone(workspace),
      workspaceSnapshot: structuredClone(workspace),
      inputManifest,
      resultEnvelope,
      modelingRunId: resultEnvelope.runId,
      modelingResultId: resultEnvelope.resultId,
      sideEffectsEmitted: 0,
      completedAt: resultEnvelope.formedAt || new Date().toISOString()
    }, location.origin);
  }

  async function runWorkspaceAction(action, payloadOverride) {
    const contract = WORKSPACE_ACTIONS[action];
    if (!contract || state.workspaceAction) return;
    const [path, bodyFactory] = contract;
    const baseBody = typeof bodyFactory === "function" ? bodyFactory() : bodyFactory;
    if (["start-shadow", "form-release-candidate", "validate-s003-binding", "apply-default"].includes(action) && !state.selectedCandidateId) {
      state.workspaceError = { code: "CANDIDATE_REQUIRED", message: "请先选择一个可用候选。" };
      render();
      return;
    }
    state.workspaceAction = action;
    state.workspaceError = null;
    render();
    try {
      const response = await api(path, { method: "POST", body: JSON.stringify({ ...baseBody, ...(payloadOverride || {}) }) });
      state.objectiveWorkspace = workspacePayload(response);
      state.defaultApplyConfirmation = false;
      saveSession();
      emitS003Workspace();
      emitS003Result(response);
    } catch (error) {
      state.workspaceError = { code: error.code || "S003_WORKSPACE_ACTION_FAILED", message: error.message };
    } finally {
      state.workspaceAction = null;
      render();
    }
  }

  async function recalculateS003Result(request = {}) {
    if (state.workspaceAction) return;
    state.workspaceAction = "recalculate";
    render();
    try {
      const response = await api("/v1/s003/results/recalculate", { method: "POST", body: JSON.stringify(request) });
      state.objectiveWorkspace = workspacePayload(response);
      state.workspaceError = null;
      emitS003Workspace();
      emitS003Result(response);
    } catch (error) {
      state.workspaceError = { code: error.code || "S003_RECALCULATION_FAILED", message: error.message };
    } finally {
      state.workspaceAction = null;
      render();
    }
  }

  async function validateCurrentBinding() {
    if (!state.objective || state.bindingLoading) return;
    if (isS003Objective()) {
      await runWorkspaceAction("validate-s003-binding");
      return;
    }
    state.bindingLoading = true;
    render();
    try {
      state.bindingValidation = await api(`/v1/objectives/${encodeURIComponent(state.objective.objectiveId)}/binding/validate`, {
        method: "POST",
        body: JSON.stringify({ binding: state.objective.bindingDraft })
      });
      state.error = null;
    } catch (error) {
      state.error = { code: error.code || "BINDING_VALIDATION_FAILED", message: error.message };
    } finally {
      state.bindingLoading = false;
      render();
    }
  }

  async function loadConsumerProjection(consumerId) {
    if (!state.objective || state.consumerLoading) return;
    state.consumerId = consumerId;
    state.consumerLoading = true;
    saveSession();
    render();
    try {
      state.consumerProjection = await api(`/v1/objectives/${encodeURIComponent(state.objective.objectiveId)}/consumer-projection?consumerId=${encodeURIComponent(consumerId)}`);
      state.error = null;
    } catch (error) {
      state.error = { code: error.code || "CONSUMER_PROJECTION_FAILED", message: error.message };
    } finally {
      state.consumerLoading = false;
      render();
    }
  }

  function handoffSignature(handoff) {
    return JSON.stringify({
      scenarioContext: BRIDGE.scenarioIdentity(handoff),
      objectRef: handoff.objectRef,
      lensRef: handoff.lensRef,
      seriesRef: handoff.seriesRef,
      timeRange: handoff.timeRange,
      dataVersionId: handoff.dataVersionId,
      ontologyVersionId: handoff.ontologyVersionId,
      returnUrl: handoff.returnUrl
    });
  }

  async function resolveExplorationHandoff(handoff) {
    if (!handoff || !handoff.objectRef?.objectTypeRef) return;
    let signature = null;
    try {
      if (!BRIDGE.sameScenario(handoff, activeScenarioIdentity())) {
        state.error = { code: "SCENARIO_CONTEXT_MISMATCH", message: "M07 handoff does not match the active scenario identity." };
        render();
        return;
      }
      signature = handoffSignature(handoff);
      if (signature === state.appliedHandoffAt) return;
    } catch (error) {
      state.error = { code: "SCENARIO_CONTEXT_REQUIRED", message: error.message };
      render();
      return;
    }
    state.explorationContext = structuredClone(handoff);
    state.appliedHandoffAt = signature;
    state.caseObjectId = handoff.objectRef.id;
    if (handoff.timeRange?.months) state.caseRange = String(handoff.timeRange.months);
    state.caseCaseId = handoff.recommendedCaseId || activeCaseStudy()?.m08?.defaultCaseId || null;
    try {
      const scenario = activeScenarioIdentity();
      const query = new URLSearchParams({ objectTypeRef: handoff.objectRef.objectTypeRef, useKind: handoff.usageIntent || handoff.requestedUseKind || "SIMULATION", scenarioId: scenario.scenarioId });
      const compatible = await api(`/v1/objectives/compatible?${query.toString()}`);
      state.compatibleObjectiveIds = (compatible.objectives || []).map((item) => item.objectiveId);
      if (state.compatibleObjectiveIds.length) {
        await loadObjective(state.compatibleObjectiveIds[0], { preserveSection: true });
        state.section = "objective";
        history.replaceState({}, "", "#objective");
        state.error = null;
      } else {
        state.error = { code: "OBJECTIVE_INPUT_UNAVAILABLE", message: "当前探索对象没有兼容的建模目标。" };
      }
      saveSession();
      render();
    } catch (error) {
      state.error = { code: error.code || "OBJECTIVE_COMPATIBILITY_FAILED", message: error.message };
      render();
    }
  }

  function shellHead() {
    const objective = state.objective;
    const returnAction = savedReturnContext()?.returnRoute ? `<button class="m08-btn secondary" data-action="return-saved-context">${savedReturnLabel()}</button>` : "";
    return `<header class="m08-top"><div class="m08-title"><span class="m08-mark">${icon("activity")}</span><div><span class="m08-kicker">M08 · 模型目标</span><h1>模型与模拟</h1><p>围绕业务问题管理模型目标、候选版本、发布绑定和持续表现</p></div></div><div class="m08-meta">${returnAction}${badge(state.apiHealth === "ok" ? "计算服务已连接" : "计算服务未验证", state.apiHealth === "ok" ? "success" : "warning")}<div class="m08-meta-item"><span>当前目标</span><strong>${esc(objective?.shortName || "目标目录")}</strong></div></div></header>`;
  }

  function workspaceNav() {
    const items = [["catalog", "目标目录"], ["objective", "目标总览"], ["contracts", "输入输出"], ["benchmark", "基准评测"], ["insights", "AI 优化洞察"], ["candidates", "候选版本"], ["binding", "发布绑定"], ["consumption", "应用与跟踪"], ["simulation", "模拟使用"]];
    return `<nav class="m08-tabs" aria-label="模型目标工作区">${items.map(([section, label]) => `<button class="${state.section === section ? "active" : ""}" data-section="${section}">${esc(label)}</button>`).join("")}</nav><label class="m08-mobile-nav"><span>当前任务</span><select data-mobile-section>${items.map(([section, label], index) => `<option value="${section}" ${state.section === section ? "selected" : ""}>${index + 1}/${items.length} · ${esc(label)}</option>`).join("")}</select></label>`;
  }

  const list = (value) => Array.isArray(value) ? value : [];
  const candidateKey = (candidate) => candidate?.candidateId || candidate?.id || candidate?.modelVersionId || "";
  const statusValue = (value) => typeof value === "string" ? value : value?.status || "";
  const isDone = (value) => /SUCCEEDED|COMPLETED|READY|GENERATED|EVALUATED|VALIDATED|ACTIVE|FORMED|APPLIED|APPROVED/.test(statusValue(value));

  function s003WorkspaceFacts() {
    const workspace = state.objectiveWorkspace || {};
    const benchmark = workspace.lastBenchmark || workspace.benchmarkRun || workspace.benchmark || null;
    const insights = list(workspace.insights || workspace.modelInsights);
    const candidates = list(workspace.candidates || workspace.candidateBranches);
    const shadow = workspace.shadowTrial || workspace.activeShadowTrial || workspace.shadow || null;
    const releaseCandidate = workspace.releaseCandidate || workspace.activeReleaseCandidate || null;
    const binding = workspace.binding || workspace.consumerBinding || null;
    return { workspace, benchmark, insights, candidates, shadow, releaseCandidate, binding };
  }

  function objectiveSummary() {
    const objective = state.objective;
    if (!objective) return "";
    const counts = `<div class="m08-objective-stats"><div><span>输入</span><strong>${list(objective.inputContract).length} 项</strong></div><div><span>输出</span><strong>${list(objective.outputContract).length} 项</strong></div><div><span>候选</span><strong>${isS003Objective() ? s003WorkspaceFacts().candidates.length : list(objective.candidates).length} 个</strong></div><div><span>消费者</span><strong>${list(objective.consumers).filter((item) => item.allowed).length} 个</strong></div></div>`;
    const bar = `<section class="m08-objective-bar"><div><span>${kindBadge(objective.kind)}${badge(objective.domain)}${badge(list(objective.scenarioIds).join(" / "))}</span><strong>${esc(objective.name)}</strong><small>${esc(objective.businessQuestion)}</small></div>${counts}</section>`;
    if (!isS003Objective()) return bar;
    const { workspace, benchmark, candidates, shadow } = s003WorkspaceFacts();
    const baseline = workspace.baselineModelVersion?.modelVersion || workspace.baselineModelVersion?.version || workspace.baselineModelVersion?.modelVersionId || workspace.baselineModelVersionId || objective.release?.modelVersionId || "尚未登记";
    const benchmarkLabel = benchmark?.label || benchmark?.statusLabel || businessStatus(benchmark, "尚未运行");
    const matured = workspace.newlyMaturedLabelCount ?? workspace.maturedLabelCount ?? workspace.labelSummary?.maturedCount ?? 0;
    const next = workspace.nextAction?.label || workspace.nextActionLabel || "按当前状态继续";
    return `${bar}<section class="m08-workspace-strip" aria-label="当前模型持续优化状态"><div><span>当前基线</span><strong>${esc(baseline)}</strong></div><div><span>最近基准评测</span><strong>${esc(benchmarkLabel)}</strong></div><div><span>新增成熟标签</span><strong>${esc(matured)} 条</strong></div><div><span>活动候选</span><strong>${list(workspace.activeCandidates).length || candidates.filter((candidate) => candidate.status !== "DATA_REQUIRED").length} 个</strong></div><div><span>影子试用</span><strong>${esc(shadow?.statusLabel || statusValue(shadow) || "未开始")}</strong></div><div class="next"><span>唯一下一步</span><strong>${esc(next)}</strong></div></section>`;
  }

  function filteredCatalog() {
    const query = state.catalogSearch.trim().toLowerCase();
    const scenarioId = activeScenarioId();
    return state.catalog.filter((item) => (state.catalogScope === "ALL" || !scenarioId || item.scenarioIds?.includes(scenarioId)) && (state.kindFilter === "ALL" || item.kind === state.kindFilter) && (!query || [item.name, item.objectiveId, item.domain, item.businessQuestion, ...(item.scenarioIds || [])].some((value) => String(value).toLowerCase().includes(query))));
  }

  function catalogView() {
    const objectives = filteredCatalog();
    const scenarioId = activeScenarioId();
    const scenarioObjectiveCount = state.catalog.filter((item) => !scenarioId || item.scenarioIds?.includes(scenarioId)).length;
    const emptyLabel = state.catalogScope === "SCENARIO" && !scenarioObjectiveCount ? `${scenarioId || "当前场景"} 暂无可用建模目标` : "没有匹配的建模目标";
    const typeCounts = Object.fromEntries(Object.keys(kindLabels).map((kind) => [kind, state.catalog.filter((item) => item.kind === kind).length]));
    return `<section class="m08-panel m08-catalog" data-screen-label="模型目标目录"><header class="m08-panel-head"><div><span class="m08-kicker">目标目录</span><h2>从业务问题选择建模目标</h2><p>当前场景是默认视图；切换到全部目标即可发现跨场景可复用能力。</p></div><div class="m08-catalog-count">${objectives.length} / ${state.catalogScope === "ALL" ? state.catalog.length : scenarioObjectiveCount}</div></header><div class="m08-scope-switch" role="group" aria-label="目标范围"><button class="${state.catalogScope === "ALL" ? "active" : ""}" data-catalog-scope="ALL">全部目标</button><button class="${state.catalogScope === "SCENARIO" ? "active" : ""}" data-catalog-scope="SCENARIO">当前场景${scenarioId ? ` · ${esc(scenarioId)}` : ""}</button></div><div class="m08-kind-discovery" role="group" aria-label="目标类型"><button class="${state.kindFilter === "ALL" ? "active" : ""}" data-kind="ALL"><strong>全部</strong><small>${state.catalog.length}</small></button>${Object.entries(kindLabels).map(([kind, label]) => `<button class="${state.kindFilter === kind ? "active" : ""}" data-kind="${kind}"><strong>${esc(label)}</strong><small>${typeCounts[kind]} 个</small></button>`).join("")}</div><div class="m08-catalog-toolbar"><label>${icon("search")}<input type="search" placeholder="搜索业务问题、目标或场景" value="${esc(state.catalogSearch)}" data-objective-search /></label></div><div class="m08-objective-list"><div class="m08-objective-row head"><span>业务目标</span><span>类型 / 场景</span><span>动态合同</span><span>发布与绑定</span><span>使用方</span><span></span></div>${objectives.map((item) => `<button type="button" class="m08-objective-row ${item.objectiveId === state.objectiveId ? "selected" : ""}" data-objective-id="${esc(item.objectiveId)}"><span><strong>${esc(item.name)}</strong><small>${esc(item.businessQuestion)}</small></span><span>${kindBadge(item.kind)}<small>${esc(item.domain)} · ${esc(list(item.scenarioIds).join(" / "))}</small></span><span><strong>${item.inputCount} 项输入 · ${item.outputCount} 项输出</strong><small>${esc(list(item.targetObjectTypes).join(" / "))}</small></span><span><strong>${esc(businessStatus(item.releaseStatus, "尚未形成"))}</strong><small>${esc(businessStatus(item.bindingStatus, "尚未校验"))}</small></span><span><strong>${item.consumerCount || 0} 个兼容模块</strong><small>${/READY/.test(item.executionStatus || "") ? "可进入下一步" : "合同可查看"}</small></span><span>${icon("chevron")}</span></button>`).join("")}${objectives.length ? "" : `<div class="m08-empty"><strong>${esc(emptyLabel)}</strong><small>${state.catalogScope === "SCENARIO" ? "可切换到“全部目标”继续浏览。" : "请调整搜索条件。"}</small></div>`}</div></section>`;
  }

  function lifecycle(objective) {
    const facts = isS003Objective() ? s003WorkspaceFacts() : null;
    const candidates = facts?.candidates || list(objective.candidates);
    const releaseReady = facts ? Boolean(facts.releaseCandidate) : objective.release?.status === "RESEARCH_RELEASE_CANDIDATE";
    const bindingReady = facts ? isDone(facts.binding) : /VALIDATED/.test(objective.binding?.status || "");
    const steps = [
      ["目标定义", true, "业务问题与边界清晰", "objective"],
      ["动态合同", list(objective.inputContract).length > 0 && list(objective.outputContract).length > 0, `${list(objective.inputContract).length}+${list(objective.outputContract).length} 项`, "contracts"],
      ["基准评测", facts ? Boolean(facts.benchmark) : candidates.some((item) => /EVALUATED/.test(item.status || "")), facts?.benchmark ? "已固定评测口径" : "等待同口径评测", "benchmark"],
      ["AI 洞察", facts ? facts.insights.length > 0 : list(objective.insights).length > 0, facts?.insights.length ? `${facts.insights.length} 条有证据洞察` : "尚未生成", "insights"],
      ["候选版本", candidates.length > 0, candidates.length ? `${candidates.length} 个不可变候选` : "尚未形成", "candidates"],
      ["人工评审", releaseReady, releaseReady ? "已选择发布候选" : "待业务评审", "candidates"],
      ["Release", releaseReady, releaseReady ? "候选已封存" : "尚未形成", "binding"],
      ["Binding", bindingReady, bindingReady ? "动态合同兼容" : "等待校验", "binding"],
      ["消费跟踪", facts ? Boolean(facts.shadow) : list(objective.consumers).some((item) => item.allowed), facts?.shadow ? "影子窗口持续观察" : `${list(objective.consumers).filter((item) => item.allowed).length} 个只读消费者`, "consumption"]
    ];
    const active = steps.findIndex((item) => !item[1]);
    return `<div class="m08-lifecycle">${steps.map(([label, done, detail, section], index) => `<button type="button" class="${done ? "done" : index === active ? "active" : "pending"}" data-section="${section}"><span>${done ? icon("check") : index + 1}</span><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`).join("")}</div>`;
  }

  function nextWorkspaceSection() {
    const { benchmark, insights, candidates, shadow, releaseCandidate, binding } = s003WorkspaceFacts();
    if (!benchmark) return ["benchmark", "运行首次基准评测"];
    if (!insights.length) return ["insights", "查看并生成优化洞察"];
    if (!candidates.length || !candidates.some((candidate) => /EVALUATED|READY/.test(candidate.status || ""))) return ["candidates", "形成并公平比较候选"];
    if (!shadow) return ["candidates", "选择影子试用候选"];
    if (!releaseCandidate) return ["consumption", "继续观察成熟标签"];
    if (!isDone(binding)) return ["binding", "校验发布绑定"];
    return ["consumption", "查看应用表现"];
  }

  function objectiveView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    const compatible = state.compatibleObjectiveIds.includes(objective.objectiveId);
    const [nextSection, nextLabel] = isS003Objective() ? nextWorkspaceSection() : ["contracts", "查看动态输入输出"];
    return `<section data-screen-label="模型目标总览">${state.explorationContext ? `<div class="m08-handoff-banner ${compatible ? "compatible" : "warning"}">${icon(compatible ? "check" : "alert")}<div><strong>${compatible ? "与探索上下文兼容" : "当前目标与探索对象不兼容"}</strong><span>${esc(state.explorationContext.objectRef?.title)} · ${esc(state.explorationContext.timeRange?.label)}</span></div><button class="m08-btn secondary" data-route-module="m07">返回多视图探索</button></div>` : ""}<section class="m08-objective-hero"><div><span class="m08-kicker">业务问题</span><div class="m08-heading-line"><h2>${esc(objective.name)}</h2>${kindBadge(objective.kind)}${badge(businessStatus(objective.status), objective.status === "RESEARCH_EVALUATED" ? "success" : "warning")}</div><p>${esc(objective.businessQuestion)}</p><div class="m08-objective-meta"><span>业务 Owner · ${esc(objective.owner)}</span><span>适用对象 · ${esc(list(objective.acceptedObjectTypes).join(" / "))}</span><span>场景 · ${esc(list(objective.scenarioIds).join(" / "))}</span></div><details class="m08-technical-evidence"><summary>查看目标技术证据</summary><dl><div><dt>Objective</dt><dd>${esc(objective.objectiveId)}</dd></div><div><dt>Revision</dt><dd>${esc(objective.revisionId)}</dd></div><div><dt>状态枚举</dt><dd>${esc(objective.status)}</dd></div><div><dt>数据版本</dt><dd>${esc(objective.dataProductRef)}</dd></div><div><dt>Ontology</dt><dd>${esc(objective.ontologyVersionId)}</dd></div></dl></details></div><div class="m08-objective-actions"><button class="m08-btn primary" data-section="${nextSection}">${esc(nextLabel)}${icon("arrow")}</button></div></section>${lifecycle(objective)}<div class="m08-overview-grid"><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">业务边界</span><h3>预期用途与成功标准</h3></div></header><dl class="m08-kv-list"><div><dt>预期用途</dt><dd>${esc(objective.intendedUse)}</dd></div><div><dt>成功标准</dt><dd>${list(objective.successCriteria).map((item) => `<span>${icon("check")}${esc(item)}</span>`).join("")}</dd></div><div><dt>明确禁止</dt><dd>${list(objective.prohibitedUses).map((item) => `<span class="danger">${icon("shield")}${esc(item)}</span>`).join("")}</dd></div></dl></section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">职责边界</span><h3>平台级模型链路</h3></div></header><dl class="m08-kv-list compact"><div><dt>M02</dt><dd>数据产品与精确版本</dd></div><div><dt>M01</dt><dd>Published Ontology 对象、属性和语义</dd></div><div><dt>M08</dt><dd>目标、模型版本、评测、Release 与 Binding</dd></div><div><dt>使用方</dt><dd>M07、Dashboard、M03、M05、M06 只读消费</dd></div><div><dt>M04</dt><dd>非事实结果硬拒绝</dd></div></dl></section></div></section>`;
  }

  function portBadges(port) {
    return `<span class="m08-port-badges">${port.required ? badge("必需", "warning") : badge("可选")}${badge(port.timeGrain || "未指定时间粒度")}${port.unit ? badge(port.unit) : ""}</span>`;
  }

  function portRow(port, direction) {
    const shape = port.shape || port.semanticKind || "SCALAR";
    const cardinality = port.cardinality || (shape === "SCALAR" ? "ONE" : "MANY");
    return `<article class="m08-port-row"><span class="m08-port-icon ${direction}">${icon(direction === "input" ? "database" : "activity")}</span><div><strong>${esc(port.label || port.modelPort)}</strong><small>${direction === "input" ? `由 ${esc(port.sourceOwner || "已登记来源")} 提供` : `${esc(port.displayRole || "结果字段")} · ${esc(port.resultKind || "独立结果")}`}</small>${portBadges(port)}<details><summary>查看字段、类型与映射证据</summary><dl><div><dt>Object Type</dt><dd>${esc(port.objectTypeRef)}</dd></div><div><dt>Property</dt><dd>${esc(port.propertyRef)}</dd></div><div><dt>模型端口</dt><dd>${esc(port.modelPort)}</dd></div><div><dt>数据类型</dt><dd>${esc(port.type || port.dataType)}</dd></div><div><dt>单位 / 时间粒度</dt><dd>${esc(port.unit)} · ${esc(port.timeGrain)}</dd></div><div><dt>shape / cardinality</dt><dd>${esc(shape)} · ${esc(cardinality)}</dd></div><div><dt>nullable / required</dt><dd>${port.nullable ? "true" : "false"} · ${port.required ? "true" : "false"}</dd></div>${direction === "output" ? `<div><dt>结果 / 显示角色</dt><dd>${esc(port.resultKind)} · ${esc(port.displayRole)}</dd></div><div><dt>权限 / 消费者</dt><dd>${esc(port.permissionScope || "由 Consumer Binding 裁剪")} · ${esc(list(port.consumers).join(" / ") || "见消费合同")}</dd></div>` : `<div><dt>来源 Owner</dt><dd>${esc(port.sourceOwner)}</dd></div>`}</dl></details></div><span class="m08-ready">${icon("check")}合同已登记</span></article>`;
  }

  function bindingValidationMarkup() {
    const result = state.bindingValidation;
    if (!result) return "";
    const ready = result.activationStatus === "READY_FOR_RESEARCH_CONSUMPTION";
    return `<section class="m08-validation-result ${ready ? "success" : "warning"}">${icon(ready ? "check" : "alert")}<div><strong>${ready ? "Binding schema 与 Release 均可用于受控消费" : "Binding schema 兼容，但 Release 尚未批准"}</strong><span>${esc(result.bindingRevisionId)} · ${esc(result.validationFingerprint)}</span></div>${badge(result.compatibility, ready ? "success" : "warning")}</section>`;
  }

  function contractsView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    return `<section class="m08-panel" data-screen-label="模型动态输入输出合同"><header class="m08-panel-head"><div><span class="m08-kicker">动态输入输出合同</span><h2>${esc(objective.name)}需要什么、产生什么</h2><p>页面直接读取 Objective schema；对象、属性、类型、单位、粒度和结果身份不由界面写死。</p></div><button class="m08-btn primary" data-section="benchmark">进入基准评测${icon("arrow")}</button></header><div class="m08-binding-canvas"><section><header><span class="m08-kicker">模型需要什么</span><h3>输入合同</h3><p>精确数据版本由 M02 提供，语义由 M01 Published Ontology 定义。</p></header><div class="m08-port-list">${list(objective.inputContract).map((port) => portRow(port, "input")).join("")}</div></section><section class="m08-interface-check"><span class="m08-interface-icon">${icon("link")}</span><h3>动态合同检查</h3><p>消费者只引用 Binding 与 Release，不接触实现端点。</p><div><span>${icon("check")}类型</span><span>${icon("check")}单位</span><span>${icon("check")}时间</span><span>${icon("check")}基数</span><span>${icon("check")}空值</span><span>${icon("check")}结果身份</span></div><small>单位或时间粒度漂移会在 Binding 阶段拒绝。</small></section><section><header><span class="m08-kicker">模型会产生什么</span><h3>输出合同</h3><p>结果进入独立 Result Envelope，不覆盖 Published FACT。</p></header><div class="m08-port-list">${list(objective.outputContract).map((port) => portRow(port, "output")).join("")}</div></section></div></section>`;
  }

  const fieldLabels = Object.freeze({
    majorEventRecallAtCapacity: "固定处置容量下重大事件召回率",
    recallAtFixedCapacity: "固定处置容量下重大事件召回率",
    prAuc: "PR-AUC",
    precisionAtTop20Pct: "Precision@Top20%",
    precisionAtTop20Percent: "Precision@Top20%",
    missedOutcomeCount: "漏报数量",
    missedAdverseOutcomeCount: "漏报数量",
    medianLeadTimeDays: "中位提前预警时间",
    coverage: "覆盖率",
    worstIndustrySlice: "行业最差切片",
    worstOperatingStageSlice: "经营阶段最差切片",
    stability: "稳定性",
    missingRate: "缺失率",
    distributionDrift: "分布漂移",
    drift: "分布漂移",
    worstSlices: "行业与经营阶段最差切片",
    benchmarkVersion: "Benchmark 版本",
    datasetSplit: "数据集划分",
    evaluator: "Evaluator",
    metricSchema: "指标口径",
    expectedImprovement: "预期改善",
    affectedScope: "影响范围",
    risk: "可能风险",
    validationMethod: "验证方法",
    dependency: "数据或本体依赖"
  });

  function readableField(key) {
    return fieldLabels[key] || String(key || "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  }

  function displayValue(value, fallback = "尚未生成") {
    if (value == null || value === "") return fallback;
    if (typeof value === "boolean") return value ? "是" : "否";
    if (Array.isArray(value)) return value.length ? value.map((item) => typeof item === "object" ? item.label || item.name || item.id || JSON.stringify(item) : item).join("、") : fallback;
    if (typeof value === "object") return value.label || value.valueLabel || value.statusLabel || value.name || value.id || value.status || JSON.stringify(value);
    return String(value);
  }

  function metricItems(source) {
    const metrics = source?.metrics || source?.metricResults || source?.benchmarkMetrics || [];
    if (Array.isArray(metrics)) return metrics.map((metric) => ({ key: metric.metricId || metric.key || metric.name, label: metric.label || readableField(metric.metricId || metric.key || metric.name), value: metric.displayValue ?? metric.value ?? metric.status, detail: metric.reason || metric.detail || metric.unit }));
    return Object.entries(metrics).map(([key, value]) => ({ key, label: readableField(key), value: typeof value === "object" ? value.displayValue ?? value.value ?? value.status : value, detail: typeof value === "object" ? value.reason || value.unit : null }));
  }

  function technicalEvidence(title, rows) {
    const normalized = rows.filter((row) => row[1] != null && row[1] !== "");
    if (!normalized.length) return "";
    return `<details class="m08-technical-evidence"><summary>${icon("file")}${esc(title)}</summary><dl>${normalized.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(displayValue(value))}</dd></div>`).join("")}</dl></details>`;
  }

  function benchmarkView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    if (!isS003Objective()) return `<section class="m08-panel" data-screen-label="基准评测"><header class="m08-panel-head"><div><span class="m08-kicker">基准评测</span><h2>${esc(objective.name)}的候选公平比较</h2><p>该目标当前仅登记合同和候选摘要，尚未接入可运行的监督式 Benchmark。</p></div><button class="m08-btn primary" data-section="candidates">查看现有候选${icon("arrow")}</button></header><div class="m08-empty"><strong>当前没有独立标签评测运行</strong><small>不能使用旧评分、风险灯或处置状态充当监督真值。</small></div></section>`;
    const { workspace, benchmark } = s003WorkspaceFacts();
    const report = workspace.report || workspace.benchmarkReport || workspace.benchmark?.report || benchmark?.report || benchmark || null;
    const metrics = metricItems(report);
    const status = statusValue(benchmark || report) || "NOT_RUN";
    const insufficient = status === "INSUFFICIENT_LABELS" || report?.conclusion === "INSUFFICIENT_LABELS";
    const actionLabel = state.workspaceAction === "run-benchmark" ? "正在评测" : benchmark ? "使用新增成熟标签重新评测" : "运行首次基准评测";
    return `<section class="m08-panel" data-screen-label="S003 基准评测"><header class="m08-panel-head"><div><span class="m08-kicker">监督式基准评测</span><h2>用独立实际结果检验 180 天债务风险识别能力</h2><p>按时间切分训练、验证和封存测试集；预测时点之后才可得的信息不得进入输入。</p></div><button class="m08-btn primary" data-action="run-benchmark" ${state.workspaceAction ? "disabled" : ""}>${icon(state.workspaceAction === "run-benchmark" ? "clock" : "play")}${actionLabel}</button></header><div class="m08-benchmark-notice ${insufficient ? "warning" : ""}">${icon(insufficient ? "alert" : "shield")}<div><strong>${insufficient ? "成熟标签不足，当前不能评价模型有效性" : "脱敏纵向 Benchmark · synthetic"}</strong><span>${insufficient ? "状态保持 INSUFFICIENT_LABELS，不补标签、不复用旧模型结论。" : "企业 × 观察时点只读取当时可用特征，Outcome 独立记录并经过 180 天成熟窗口。"}</span></div>${badge(status, insufficient ? "warning" : benchmark ? "success" : "neutral")}</div>${report ? `<div class="m08-benchmark-grid"><section><span>主要判断</span><strong>${esc(displayValue(report.conclusion || report.primaryConclusion, "等待评测结论"))}</strong><small>固定处置容量下重大事件召回率</small></section><section><span>时间切分</span><strong>${esc(displayValue(report.fixedContext?.datasetSplits || report.datasetSplit?.label || report.datasetSplitLabel, "按时间隔离"))}</strong><small>封存测试集仅供最终候选使用</small></section><section><span>可用时间约束</span><strong>${report.temporalIntegrity?.futureLeakageRows > 0 || report.leakageCheck?.passed === false ? "未通过" : "已检查"}</strong><small>availableAt ≤ predictionAsOf</small></section></div><div class="m08-metric-grid">${metrics.map((metric) => `<article><span>${esc(metric.label)}</span><strong>${esc(displayValue(metric.value, "无法评价"))}</strong><small>${esc(displayValue(metric.detail, "按固定指标口径计算"))}</small></article>`).join("") || `<div class="m08-empty"><strong>评测运行未返回指标</strong><small>页面不会以 0 填补缺失指标。</small></div>`}</div>${technicalEvidence("查看 Benchmark 版本与数据证据", [["BenchmarkRun", report.benchmarkRunId || workspace.researchRunRefs?.benchmarkRunId], ["BenchmarkVersion", report.fixedContext?.benchmarkVersion], ["Dataset Split", report.fixedContext?.datasetSplits], ["Evaluator", report.fixedContext?.evaluatorVersion], ["MetricSchema", report.fixedContext?.metricSchemaVersion], ["OutcomeDataVersion", report.fixedContext?.outcomeDataVersion], ["Holdout Used", report.fixedContext?.holdoutUsed], ["Evidence", report.evidenceRefs]])}` : `<div class="m08-empty"><strong>尚未运行监督式基准评测</strong><small>运行后才会形成指标、最差切片、缺失率和漂移证据。</small></div>`}</section>`;
  }

  function insightsView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    if (!isS003Objective()) return `<section class="m08-panel"><header class="m08-panel-head"><div><span class="m08-kicker">AI 优化洞察</span><h2>${esc(objective.name)}尚未生成结构化洞察</h2><p>AI 只能读取固定评测报告并提出有证据的差异建议，不能计算分数或自动选择冠军。</p></div><button class="m08-btn primary" data-section="candidates">查看候选版本${icon("arrow")}</button></header></section>`;
    const { benchmark, insights } = s003WorkspaceFacts();
    return `<section class="m08-panel" data-screen-label="S003 AI 优化洞察"><header class="m08-panel-head"><div><span class="m08-kicker">AI 辅助优化</span><h2>从误判、缺失、漂移和贡献证据形成可验证建议</h2><p>洞察不改标签、本体、数据、评测口径，也不直接生成风险分数。</p></div><button class="m08-btn primary" data-action="generate-insights" ${!benchmark || state.workspaceAction ? "disabled" : ""}>${icon(state.workspaceAction === "generate-insights" ? "clock" : "bot")}${state.workspaceAction === "generate-insights" ? "正在生成" : insights.length ? "用最新评测刷新洞察" : "生成有证据的洞察"}</button></header>${insights.length ? `<div class="m08-insight-list">${insights.map((insight, index) => `<article><header><span class="m08-rank">${index + 1}</span><div><strong>${esc(insight.title || insight.problem || insight.finding || `优化洞察 ${index + 1}`)}</strong><small>${esc(insight.suggestionType || insight.type || "结构化优化建议")}</small></div>${badge(insight.statusLabel || insight.status || "待验证", /READY|VALIDATED/.test(insight.status || "") ? "success" : "warning")}</header><p>${esc(insight.problem || insight.finding || insight.description || "")}</p><dl><div><dt>建议差异</dt><dd>${esc(displayValue(insight.suggestedDiff || insight.diff))}</dd></div><div><dt>预期改善</dt><dd>${esc(displayValue(insight.expectedImprovement))}</dd></div><div><dt>可能风险</dt><dd>${esc(displayValue(insight.risk || insight.possibleRisk))}</dd></div><div><dt>验证方法</dt><dd>${esc(displayValue(insight.validationMethod))}</dd></div></dl>${technicalEvidence("查看洞察证据与依赖", [["Insight", insight.insightId || insight.id], ["证据引用", insight.evidenceRefs || insight.evidenceRef], ["影响范围", insight.affectedScope || insight.impactScope], ["数据或本体依赖", insight.dataOntologyDependencies || insight.dependencies || insight.dependency]])}</article>`).join("")}</div>` : `<div class="m08-empty"><strong>${benchmark ? "尚未生成 AI 优化洞察" : "需要先完成基准评测"}</strong><small>每条洞察必须包含证据、建议 diff、影响、风险、依赖和验证方法。</small></div>`}</section>`;
  }

  function candidatesView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    if (!isS003Objective()) return `<section class="m08-panel" data-screen-label="候选版本"><header class="m08-panel-head"><div><span class="m08-kicker">候选版本</span><h2>${esc(objective.name)}的不可变模型候选</h2><p>候选必须锁定同一数据版本、Evaluator 和指标口径后才可比较。</p></div><button class="m08-btn primary" data-section="binding">查看发布绑定${icon("arrow")}</button></header><div class="m08-evaluation-layout"><section><div class="m08-candidate-list">${list(objective.candidates).map((candidate, index) => `<article class="m08-candidate-row"><span class="m08-rank">${index + 1}</span><div><strong>${esc(candidate.name)}</strong><small>不可变 Model Version</small></div><span>${badge(candidate.status, /EVALUATED|VALIDATED/.test(candidate.status) ? "success" : "warning")}</span><b>${esc(candidate.primaryMetric)}</b>${technicalEvidence("查看候选证据", [["Candidate", candidate.candidateId], ["Model Version", candidate.modelVersionId]])}</article>`).join("")}</div></section><aside><span class="m08-kicker">固定评估协议</span><dl><div><dt>数据版本</dt><dd>${esc(objective.evaluationTransactionId)}</dd></div><div><dt>Evaluator</dt><dd>${esc(objective.evaluatorVersion)}</dd></div><div><dt>指标口径</dt><dd>${esc(objective.metricSchemaVersion)}</dd></div></dl></aside></div></section>`;
    const { workspace, benchmark, insights, candidates, shadow } = s003WorkspaceFacts();
    const fairness = workspace.report?.fixedContext || candidates.find((candidate) => candidate.fairnessContext)?.fairnessContext || {};
    const evaluated = candidates.some((candidate) => /EVALUATED|READY|SHADOW|SELECTED/.test(candidate.status || ""));
    const action = !candidates.length ? "generate-candidates" : !evaluated ? "evaluate-candidates" : "start-shadow";
    const actionLabel = state.workspaceAction === action ? "正在处理" : !candidates.length ? "形成三个受约束候选" : !evaluated ? "按同一口径确定性评测" : shadow ? "切换影子候选" : "选择并开始影子试用";
    return `<section class="m08-panel" data-screen-label="S003 候选版本"><header class="m08-panel-head"><div><span class="m08-kicker">候选版本与人工选择</span><h2>比较可复算、不可变的 Scorecard 候选</h2><p>候选搜索满足权重合计、单位、时间粒度和固定语义约束；AI 不计算分数、不自动选冠军。</p></div><button class="m08-btn primary" data-action="${action}" ${(!insights.length && !candidates.length) || !state.selectedCandidateId && action === "start-shadow" || state.workspaceAction ? "disabled" : ""}>${icon(state.workspaceAction === action ? "clock" : action === "start-shadow" ? "play" : "activity")}${actionLabel}</button></header><div class="m08-fairness-bar"><span>${icon("shield")}所有候选必须锁定同一评测协议</span><strong>${esc(displayValue(fairness.benchmarkVersion || benchmark?.benchmarkVersion, "尚未固定 Benchmark"))}</strong><strong>${esc(displayValue(fairness.datasetSplits || benchmark?.datasetSplits, "尚未固定 Split"))}</strong><strong>${esc(displayValue(fairness.evaluatorVersion, "尚未固定 Evaluator"))}</strong><strong>${esc(displayValue(fairness.metricSchemaVersion, "尚未固定 MetricSchema"))}</strong></div>${candidates.length ? `<div class="m08-candidate-cards">${candidates.map((candidate, index) => { const key = candidateKey(candidate); const blocked = /DATA_REQUIRED|BLOCKED|INSUFFICIENT/.test(candidate.status || ""); return `<article class="${key === state.selectedCandidateId ? "selected" : ""} ${blocked ? "blocked" : ""}"><button type="button" class="m08-candidate-select" data-s003-candidate-id="${esc(key)}" aria-pressed="${key === state.selectedCandidateId}"><header><span class="m08-rank">${index + 1}</span><div><strong>${esc(candidate.name || candidate.label || `候选 ${index + 1}`)}</strong><small>${esc(candidate.strategyLabel || candidate.suggestionType || candidate.type || "受约束候选")}</small></div>${badge(candidate.statusLabel || candidate.status || "待评测", blocked ? "warning" : evaluated ? "success" : "neutral")}</header><p>${esc(candidate.businessSummary || candidate.description || candidate.rationale || "")}</p><div class="m08-candidate-metrics">${metricItems(candidate).slice(0, 4).map((metric) => `<span><small>${esc(metric.label)}</small><strong>${esc(displayValue(metric.value, "无法评价"))}</strong></span>`).join("") || `<span><small>评测状态</small><strong>${esc(candidate.primaryMetric || "等待确定性评测")}</strong></span>`}</div>${blocked ? `<div class="m08-block-reason">${icon("alert")}${esc(candidate.blockedReason || candidate.reason || "所需数据或本体语义尚未就绪，不能伪造运行成功。")}</div>` : ""}</button>${technicalEvidence("查看候选 diff 与版本证据", [["Candidate", key], ["Model Version", candidate.modelVersion?.modelVersionId || candidate.modelVersionId], ["建议 diff", candidate.diff || candidate.suggestedDiff], ["来源洞察", candidate.insightRefs || candidate.evidenceRefs], ["Experiment Run", candidate.experimentRunId]])}</article>`; }).join("")}</div><section class="m08-human-review"><div><span class="m08-kicker">人工评审</span><h3>${state.selectedCandidateId ? "已选中一个候选用于下一步" : "请选择一个候选"}</h3><p>选择影子试用不改变正式 Binding；模型版本本身保持不可变。</p></div>${badge(shadow ? "影子试用已开始" : "尚未应用", shadow ? "success" : "warning")}</section>` : `<div class="m08-empty"><strong>${insights.length ? "尚未形成候选版本" : "需要先生成有证据的优化洞察"}</strong><small>候选不会修改标签、本体、数据或 Benchmark 口径。</small></div>`}</section>`;
  }

  function bindingView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    if (!isS003Objective()) {
      const releaseReady = objective.release?.status === "RESEARCH_RELEASE_CANDIDATE";
      return `<section data-screen-label="发布与绑定"><div class="m08-binding-governance"><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">Release Selector</span><h3>人工评审后的稳定模型选择</h3></div>${badge(statusLabels[objective.release?.status] || objective.release?.status, releaseReady ? "success" : "warning")}</header><dl class="m08-kv-list compact"><div><dt>Model Version</dt><dd>${esc(objective.release?.modelVersionId)}</dd></div><div><dt>当前角色</dt><dd>${objective.release?.published ? "已应用版本" : "发布候选"}</dd></div></dl>${technicalEvidence("查看 Release 证据", [["Release", objective.release?.releaseId]])}</section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">Consumer Binding</span><h3>稳定语义接口</h3></div>${badge(statusLabels[objective.binding?.status] || objective.binding?.status, /VALIDATED/.test(objective.binding?.status || "") ? "success" : "warning")}</header><dl class="m08-kv-list compact"><div><dt>语义版本</dt><dd>${esc(objective.ontologyVersionId)}</dd></div><div><dt>事实写入</dt><dd>禁止</dd></div></dl><button class="m08-btn primary m08-binding-action" data-action="validate-binding" ${state.bindingLoading ? "disabled" : ""}>${icon("shield")}${state.bindingLoading ? "正在校验" : "校验当前 Binding"}</button>${technicalEvidence("查看 Binding 证据", [["Binding", objective.binding?.bindingId], ["Revision", objective.binding?.revision]])}</section></div>${bindingValidationMarkup()}</section>`;
    }
    const { workspace, shadow, releaseCandidate, binding, candidates } = s003WorkspaceFacts();
    const selected = candidates.find((candidate) => candidateKey(candidate) === state.selectedCandidateId);
    const bindingReady = binding?.validationStatus === "VALID" || isDone(binding);
    const applied = Boolean(binding?.appliedAsDashboardDefaultCandidate || binding?.appliedToDashboard || binding?.defaultApplied || workspace.defaultCandidateId || workspace.defaultBinding?.candidateId);
    let primary = "";
    if (!shadow) primary = `<button class="m08-btn primary" data-section="candidates">先选择影子试用${icon("arrow")}</button>`;
    else if (!releaseCandidate && shadow?.status !== "MATURED") primary = `<button class="m08-btn primary" data-section="consumption">先完成三个影子窗口${icon("arrow")}</button>`;
    else if (!releaseCandidate) primary = `<button class="m08-btn primary" data-action="form-release-candidate" ${!state.selectedCandidateId || state.workspaceAction ? "disabled" : ""}>${icon(state.workspaceAction === "form-release-candidate" ? "clock" : "file")}${state.workspaceAction === "form-release-candidate" ? "正在封存" : "形成发布候选"}</button>`;
    else if (!bindingReady) primary = `<button class="m08-btn primary" data-action="validate-s003-binding" ${state.workspaceAction ? "disabled" : ""}>${icon(state.workspaceAction === "validate-s003-binding" ? "clock" : "shield")}${state.workspaceAction === "validate-s003-binding" ? "正在校验" : "校验动态 Binding"}</button>`;
    else if (!applied && !state.defaultApplyConfirmation) primary = `<button class="m08-btn primary" data-action="request-default-confirm">准备应用为仪表盘默认候选${icon("arrow")}</button>`;
    else if (!applied) primary = `<button class="m08-btn primary danger" data-action="confirm-default" ${state.workspaceAction ? "disabled" : ""}>${icon("check")}确认应用为仪表盘默认候选</button>`;
    else primary = `<button class="m08-btn primary" data-section="consumption">查看应用表现${icon("arrow")}</button>`;
    return `<section data-screen-label="S003 发布与绑定"><section class="m08-panel"><header class="m08-panel-head"><div><span class="m08-kicker">发布与绑定</span><h2>不可变模型版本通过 Release 与 Binding 承担应用角色</h2><p>形成发布候选会一次性使用封存测试集；只有应用为仪表盘默认候选需要一次明确人工确认。</p></div>${primary}</header>${state.defaultApplyConfirmation && !applied ? `<div class="m08-confirmation">${icon("alert")}<div><strong>这会更新仪表盘默认候选 Binding，不会修改 Model Version 或正式事实。</strong><span>候选：${esc(selected?.name || state.selectedCandidateId)}。确认前请核对版本、评测和影子窗口证据。</span></div><button class="m08-btn secondary" data-action="cancel-default-confirm">取消</button></div>` : ""}<div class="m08-binding-governance"><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">Release Candidate</span><h3>${esc(releaseCandidate?.name || selected?.name || "尚未形成发布候选")}</h3></div>${badge(statusValue(releaseCandidate) || "等待形成", releaseCandidate ? "success" : "warning")}</header><dl class="m08-kv-list compact"><div><dt>模型版本角色</dt><dd>${releaseCandidate ? "发布候选，版本本身不可变" : "当前仍是评测或影子候选"}</dd></div><div><dt>封存测试集</dt><dd>${releaseCandidate ? "已一次性用于最终候选" : "未使用"}</dd></div><div><dt>正式发布</dt><dd>否</dd></div></dl>${technicalEvidence("查看 Release 证据", [["Release Candidate", releaseCandidate?.releaseCandidateId || releaseCandidate?.releaseId], ["Model Version", releaseCandidate?.modelVersionId || selected?.modelVersion?.modelVersionId || selected?.modelVersionId], ["Holdout Report", releaseCandidate?.holdoutReport?.reportId]])}</section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">Consumer Binding</span><h3>${applied ? "仪表盘默认候选已应用" : bindingReady ? "动态合同已通过" : "等待动态合同校验"}</h3></div>${badge(statusValue(binding) || (bindingReady ? "VALIDATED" : "等待校验"), bindingReady ? "success" : "warning")}</header><dl class="m08-kv-list compact"><div><dt>单位 / 时间粒度</dt><dd>${bindingReady ? "兼容" : "待校验，漂移将拒绝"}</dd></div><div><dt>结果身份</dt><dd>PREDICTION · 与 FACT / SIMULATION 隔离</dd></div><div><dt>事实与行动写入</dt><dd>禁止</dd></div></dl>${technicalEvidence("查看 Binding Revision 与拒绝证据", [["Binding Revision", binding?.bindingRevisionId], ["Fingerprint", binding?.validationFingerprint], ["应用角色", binding?.applicationRole], ["确认次数", binding?.humanConfirmation?.confirmationCount], ["拒绝代码", binding?.code], ["拒绝原因", binding?.reasons]])}</section></div><section class="m08-panel m08-release-flow"><header class="m08-section-head"><div><span class="m08-kicker">受控应用链</span><h3>角色变化不修改 Model Version</h3></div></header><div><span><b>1</b><strong>不可变候选</strong><small>同一协议评测</small></span>${icon("arrow")}<span><b>2</b><strong>人工选择</strong><small>不自动选冠军</small></span>${icon("arrow")}<span><b>3</b><strong>Release Candidate</strong><small>封存最终评测</small></span>${icon("arrow")}<span><b>4</b><strong>Binding 校验</strong><small>漂移硬拒绝</small></span>${icon("arrow")}<span><b>5</b><strong>默认候选</strong><small>一次人工确认</small></span></div></section></section>`;
  }

  function formatValue(port, value) {
    if (value == null) return "—";
    port = port || {};
    if (port.type === "boolean") return value ? "需要" : "不需要";
    if (port.type === "object_set") return `${value} 个候选方案`;
    if (port.unit === "ratio") return `${(Number(value) * 100).toFixed(0)}%`;
    if (port.unit === "percent") return `${Number(value).toFixed(2)}%`;
    if (port.unit === "score_0_100") return Number(value).toFixed(1);
    if (port.unit === "constraint_status") return value === "ALL_HARD_CONSTRAINTS_SATISFIED" ? "全部硬约束满足" : String(value);
    if (port.unit === "risk_level") return value === "HIGH" ? "高风险" : String(value);
    return String(value);
  }

  function previewOutputRows(projection) {
    return (projection.outputContract || []).map((port) => `<div class="m08-preview-output"><span>${esc(port.label)}</span><strong>${esc(formatValue(port, projection.result?.outputs?.[port.modelPort]))}</strong><small>${esc(port.resultKind)} · ${esc(port.shape)} · ${esc(port.unit)}</small></div>`).join("");
  }

  function forecastPreview(projection) {
    const outputs = projection.result.outputs;
    const observed = activeCaseStudy()?.quiver?.observed || [];
    const primaryPort = list(projection.outputContract).find((port) => port.displayRole === "PRIMARY" && Number.isFinite(Number(outputs[port.modelPort]))) || projection.outputContract?.[0];
    const rangePorts = list(projection.outputContract).filter((port) => port.displayRole === "RANGE" && Number.isFinite(Number(outputs[port.modelPort])));
    const predictedValue = Number(outputs[primaryPort?.modelPort]);
    if (!Number.isFinite(predictedValue) || !observed.length) return `<div class="m08-answer-preview"><span>${icon("activity")}预测结果</span><h3>${esc(state.objective?.businessQuestion)}</h3><div>${previewOutputRows(projection)}</div></div>`;
    const points = [...observed.slice(-6), predictedValue];
    const labels = [...(activeCaseStudy()?.quiver?.labels || []).slice(-6), "+6月"];
    const width = 640, height = 190, left = 38, right = 20, top = 18, bottom = 30;
    const rangeValues = rangePorts.map((port) => Number(outputs[port.modelPort]));
    const min = Math.min(...points, ...rangeValues) - 0.08;
    const max = Math.max(...points, ...rangeValues) + 0.08;
    const x = (index) => left + index * ((width - left - right) / Math.max(1, points.length - 1));
    const y = (value) => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
    const observedPoints = points.slice(0, -1).map((value, index) => `${x(index)},${y(value)}`).join(" ");
    const predictedPoints = `${x(points.length - 2)},${y(points.at(-2))} ${x(points.length - 1)},${y(points.at(-1))}`;
    const rangeLine = rangeValues.length >= 2 ? `<line class="range" x1="${x(points.length - 1)}" y1="${y(Math.min(...rangeValues))}" x2="${x(points.length - 1)}" y2="${y(Math.max(...rangeValues))}"/>` : "";
    const rangeLabel = rangeValues.length >= 2 ? `${Math.min(...rangeValues).toFixed(2)}–${Math.max(...rangeValues).toFixed(2)} ${primaryPort?.unit || ""}` : "未提供区间";
    return `<div class="m08-consumer-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="真实观察与模型预测"><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"/><polyline class="fact" points="${observedPoints}"/><polyline class="prediction" points="${predictedPoints}"/>${rangeLine}${points.map((value, index) => `<circle class="${index === points.length - 1 ? "prediction" : "fact"}" cx="${x(index)}" cy="${y(value)}" r="3"/><text x="${x(index)}" y="${height - 10}" text-anchor="middle">${esc(labels[index])}</text>`).join("")}</svg><div><span><i class="fact"></i>真实事实</span><span><i class="prediction"></i>模型预测</span><span>预测区间 ${esc(rangeLabel)}</span></div></div>`;
  }

  function consumerPreview() {
    const projection = state.consumerProjection;
    const objective = state.objective;
    if (state.consumerLoading) return loadingView("正在生成消费者安全投影");
    if (!projection) return `<div class="m08-consumer-empty"><strong>选择一个消费位置</strong><span>系统将按模块能力裁剪同一结果包络。</span></div>`;
    if (projection.status === "BLOCKED") return `<section class="m08-consumer-blocked">${icon("shield")}<h3>该结果不能进入${esc(projection.consumerName)}</h3><p>${esc(projection.reason)}</p><dl><div><dt>拒绝代码</dt><dd>${esc(projection.code)}</dd></div><div><dt>事实写入</dt><dd>禁止</dd></div><div><dt>行动来源</dt><dd>禁止</dd></div></dl></section>`;
    let body = "";
    if (projection.displayMode === "TIMELINE_OVERLAY") body = forecastPreview(projection);
    else if (projection.displayMode === "OBJECT_BADGE") {
      const primaryPorts = list(projection.outputContract).filter((port) => port.displayRole === "PRIMARY");
      const primary = primaryPorts[0] || projection.outputContract?.[0];
      const secondary = primaryPorts[1] || projection.outputContract?.[1];
      body = `<div class="m08-object-preview"><span>${esc(objective.name)} · 结果预览</span><strong>${esc(formatValue(primary, projection.result.outputs[primary?.modelPort]))}</strong>${secondary ? `<div><span>${esc(secondary.label)}</span><b>${esc(formatValue(secondary, projection.result.outputs[secondary.modelPort]))}</b></div>` : ""}</div>`;
    }
    else if (projection.displayMode === "OBJECT_SCORE") {
      const scorePort = projection.outputContract.find((item) => item.unit === "score_0_100") || projection.outputContract[0];
      const coveragePort = projection.outputContract.find((item) => item.unit === "ratio" && item.displayRole === "EVIDENCE");
      const secondaryPort = projection.outputContract.find((item) => item !== scorePort && item.displayRole === "PRIMARY");
      const reviewPort = projection.outputContract.find((item) => item.type === "boolean" && item.displayRole === "EVIDENCE");
      const score = Number(projection.result.outputs[scorePort?.modelPort]);
      const detail = coveragePort
        ? `覆盖率 ${esc(formatValue(coveragePort, projection.result.outputs[coveragePort.modelPort]))}`
        : secondaryPort ? `${esc(secondaryPort.label)} ${esc(formatValue(secondaryPort, projection.result.outputs[secondaryPort.modelPort]))}` : "保持独立结果身份";
      body = `<div class="m08-score-preview"><div><span>${esc(scorePort?.label || "预测评分")}</span><strong>${Number.isFinite(score) ? score.toFixed(1) : "—"}</strong><small>${detail}</small></div><i><i style="width:${Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0}%"></i></i><p>${reviewPort && projection.result.outputs[reviewPort.modelPort] ? "建议进入人工复核" : "结果可供受控读取"}</p></div>`;
    }
    else if (projection.displayMode === "OPTION_COMPARISON") body = `<div class="m08-option-preview"><span>${esc(objective.name)} · 候选比较</span><div>${previewOutputRows(projection)}</div><small>只读候选结果，不自动执行应用动作</small></div>`;
    else if (projection.displayMode === "ANSWER_EVIDENCE_CARD") body = `<div class="m08-answer-preview"><span>${icon("query")}只读结果引用</span><h3>${esc(objective.businessQuestion)}</h3><p>基于 ${esc(projection.bindingRef.bindingId)} 的固定评估结果，当前可读取：</p><div>${previewOutputRows(projection)}</div></div>`;
    else if (projection.displayMode === "EXPLANATION_PANEL") body = `<div class="m08-explanation-preview"><span>${icon("bot")}解释固定结果，不重新计算</span><h3>${esc(objective.name)}结果摘要</h3><div>${previewOutputRows(projection)}</div><p>Agent 只能引用 Objective、Binding、Model Version、覆盖率和证据，不得改变结果。</p></div>`;
    else body = `<div class="m08-report-preview"><header><span>${icon("file")}报告结果块 · 结果预览</span><strong>${esc(objective.name)}</strong></header><div>${previewOutputRows(projection)}</div><footer>Result ${esc(projection.result.resultId)} · ${esc(projection.result.evidenceClass)}</footer></div>`;
    return `<section class="m08-consumer-preview"><header><div><span class="m08-kicker">${esc(projection.displayMode)}</span><h3>${esc(projection.consumerName)}中的安全预览</h3><p>同一 Result ID，按消费者意图裁剪字段和交互能力。</p></div>${badge(projection.status, "success")}</header>${body}<details class="m08-result-envelope"><summary>${icon("file")}查看统一 Result Envelope</summary><dl><div><dt>Result</dt><dd>${esc(projection.result.resultId)}</dd></div><div><dt>Result Kind</dt><dd>${esc(projection.result.resultKind)}</dd></div><div><dt>Objective Revision</dt><dd>${esc(projection.objectiveRevisionId)}</dd></div><div><dt>Binding Revision</dt><dd>${esc(projection.bindingRef.bindingId)} · R${projection.bindingRef.revision}</dd></div><div><dt>Model Version</dt><dd>${esc(projection.releaseSelector.modelVersionId)}</dd></div><div><dt>权限</dt><dd>${esc(projection.permissionScope)}</dd></div><div><dt>事实写入</dt><dd>禁止</dd></div><div><dt>行动来源</dt><dd>禁止</dd></div></dl></details></section>`;
  }

  function consumptionView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    if (!isS003Objective()) return `<section class="m08-panel" data-screen-label="应用与结果"><header class="m08-panel-head"><div><span class="m08-kicker">应用与跟踪</span><h2>一个 Result Envelope，按权限适配不同模块</h2><p>消费者共享 Result ID 和证据，不复制模型端点或结果真值。</p></div>${badge(`${list(objective.consumers).filter((item) => item.allowed).length} 兼容 · ${list(objective.consumers).filter((item) => !item.allowed).length} 阻断`, "info")}</header><div class="m08-consumption-layout"><aside class="m08-consumer-list">${list(objective.consumers).map((consumer) => `<button type="button" class="${consumer.consumerId === state.consumerId ? "active" : ""} ${consumer.allowed ? "" : "blocked"}" data-consumer-id="${esc(consumer.consumerId)}"><span>${icon(consumerIcons[consumer.consumerId])}</span><span><strong>${esc(consumer.name)}</strong><small>${consumer.allowed ? esc(consumer.displayMode) : "默认拒绝非事实来源"}</small></span>${consumer.allowed ? badge("兼容", "success") : badge("阻断", "danger")}</button>`).join("")}</aside><main>${consumerPreview()}</main></div></section>`;
    const { workspace, shadow } = s003WorkspaceFacts();
    const windows = list(workspace.trend || shadow?.maturedWindows || shadow?.windows || shadow?.performanceWindows);
    const consumers = list(objective.consumers);
    const moduleByConsumer = { M07_EXPLORATION: "m07", M06_REPORT: "report", M03_QUERY: "query", M05_AGENT: "agent", M04_DECISION: "decision", DASHBOARD: "dashboard", S003_DASHBOARD: "dashboard" };
    const canAdvance = shadow?.status === "ACTIVE";
    const primary = !shadow ? `<button class="m08-btn primary" data-section="candidates">选择影子试用${icon("arrow")}</button>` : `<button class="m08-btn primary" data-action="advance-shadow" ${!canAdvance || state.workspaceAction ? "disabled" : ""}>${icon(state.workspaceAction === "advance-shadow" ? "clock" : "refresh")}${state.workspaceAction === "advance-shadow" ? "正在读取新窗口" : "读取下一个成熟标签窗口"}</button>`;
    return `<section data-screen-label="S003 应用与持续跟踪"><section class="m08-panel"><header class="m08-panel-head"><div><span class="m08-kicker">应用与持续跟踪</span><h2>让同一预测结果在受控消费者中持续接受新标签检验</h2><p>正式事实、候选预测和模拟结果保持三种身份；影子表现不会覆盖 S003 归档运行。</p></div>${primary}</header><div class="m08-tristate m08-s003-tristate"><div class="fact"><span>正式结果</span><strong>FACT</strong><small>历史 S003-RUN 只读，不由 M08 覆盖</small></div><div class="prediction"><span>候选试算 / 影子</span><strong>PREDICTION</strong><small>WHAT_IF / SHADOW · 禁止事实和行动写入</small></div><div class="simulation"><span>模拟使用</span><strong>SIMULATION</strong><small>不能替代事实或预测评测</small></div></div></section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">影子窗口</span><h3>${shadow ? "候选相对基线的后续表现" : "尚未开始影子试用"}</h3></div>${badge(statusValue(shadow) || "未开始", shadow ? "success" : "warning")}</header>${windows.length ? `<div class="m08-window-list">${windows.map((window, index) => { const comparisons = metricItems(window.candidate).map((metric) => ({ ...metric, baselineValue: window.baseline?.metrics?.[metric.key] })); return `<article><header><span class="m08-rank">${index + 1}</span><div><strong>${esc(window.label || window.windowLabel || window.maturityWindowId || `成熟窗口 ${index + 1}`)}</strong><small>${esc(window.observedAt || window.maturedAt || "")}</small></div>${badge(window.statusLabel || window.status || window.candidate?.status || "已读取", "success")}</header><div>${comparisons.slice(0, 6).map((metric) => `<span><small>${esc(metric.label)}</small><strong>候选 ${esc(displayValue(metric.value, "无法评价"))}</strong><small>基线 ${esc(displayValue(metric.baselineValue, "无法评价"))}</small></span>`).join("")}</div>${technicalEvidence("查看窗口运行身份", [["ShadowRun", shadow?.shadowRunId], ["窗口", window.maturityWindowId], ["新增成熟标签", window.newMaturedLabelCount], ["累计成熟标签", window.cumulativeMaturedLabelCount], ["Baseline Report", window.baseline?.reportId], ["Candidate Report", window.candidate?.reportId]])}</article>`; }).join("")}</div>` : `<div class="m08-empty"><strong>${shadow ? "等待第一个成熟标签窗口" : "选择候选后才会形成独立 ShadowRun"}</strong><small>不会复用或覆盖历史 scenarioRunId。</small></div>`}</section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">只读消费投影</span><h3>按模块权限读取统一 Result Envelope</h3></div></header><div class="m08-consumer-routes">${consumers.map((consumer) => { const moduleId = moduleByConsumer[consumer.consumerId] || consumer.moduleId; const returnWithResult = consumer.consumerId === "M07_EXPLORATION" && state.explorationContext && workspace.currentResultEnvelope; return `<article class="${consumer.allowed ? "" : "blocked"}"><span>${icon(consumerIcons[consumer.consumerId] || "eye")}</span><div><strong>${esc(consumer.name)}</strong><small>${consumer.allowed ? esc(consumer.displayMode || "只读结果投影") : "NON_FACT_SOURCE_REJECTED · 零 Action / 提醒 / 审批 / 待办 / 交易"}</small></div>${consumer.allowed && moduleId ? returnWithResult ? `<button class="m08-btn secondary" data-action="return-s003-result">带当前结果返回${icon("arrow")}</button>` : `<button class="m08-btn secondary" data-route-module="${esc(moduleId)}">进入模块${icon("arrow")}</button>` : badge("硬拒绝", "danger")}</article>`; }).join("")}</div>${technicalEvidence("查看当前 Result Envelope", [["Result", workspace.currentResultEnvelope?.resultId], ["Result Kind", workspace.currentResultEnvelope?.resultKind], ["Model Version", workspace.currentResultEnvelope?.modelVersionId], ["Binding Revision", workspace.currentResultEnvelope?.bindingRevision], ["事实写入", "false"], ["行动写入", "false"]])}</section></section>`;
  }

  function caseSelectedObject(study = activeCaseStudy()) {
    if (!study || !state.caseObjectId) return null;
    return study.m07?.objects?.find((item) => item.id === state.caseObjectId) || null;
  }

  function caseAvailability() {
    let scenario = null;
    try { scenario = activeScenarioIdentity(); } catch (error) {
      return { ready: false, code: "SCENARIO_CONTEXT_REQUIRED", message: error.message };
    }
    const study = activeCaseStudy();
    if (!study) return { ready: false, code: "SCENARIO_INPUT_UNAVAILABLE", message: `${scenario.scenarioId} 尚未提供可运行的模型输入。` };
    if (!state.objective || !state.objective.scenarioIds?.includes(scenario.scenarioId)) {
      return { ready: false, code: "OBJECTIVE_SCENARIO_MISMATCH", message: "当前建模目标不属于活动场景。" };
    }
    const object = caseSelectedObject(study);
    if (study.m08?.requiresM07Handoff) {
      const handoff = state.explorationContext;
      if (!handoff) return { ready: false, code: "EXPLORATION_HANDOFF_REQUIRED", message: "请先从多视图探索选择一个业务对象并带上下文进入。" };
      try {
        if (!BRIDGE.sameScenario(handoff, scenario)) return { ready: false, code: "SCENARIO_CONTEXT_MISMATCH", message: "探索上下文与活动场景不一致。" };
      } catch (error) {
        return { ready: false, code: "SCENARIO_CONTEXT_INVALID", message: error.message };
      }
      const acceptedTypes = list(state.objective?.acceptedObjectTypes);
      if (!acceptedTypes.includes(String(handoff.objectRef?.objectTypeRef || "").split("@")[0])) {
        return { ready: false, code: "OBJECT_TYPE_INCOMPATIBLE", message: "当前探索对象类型不在所选目标的输入合同中。" };
      }
      if (!handoff.dataVersionId || !handoff.ontologyVersionId || !handoff.timeRange) {
        return { ready: false, code: "EXPLORATION_INPUT_INCOMPLETE", message: "当前探索上下文缺少数据版本、语义版本或时间范围。" };
      }
      if (!object || object.id !== handoff.objectRef.id) {
        return { ready: false, code: "OBJECT_INPUT_UNAVAILABLE", message: "当前业务对象没有对应的模型输入。" };
      }
      if (!state.compatibleObjectiveIds.includes(state.objective.objectiveId)) {
        return { ready: false, code: "OBJECTIVE_INPUT_INCOMPATIBLE", message: "当前业务对象与所选建模目标不兼容。" };
      }
    } else if (!object) {
      return { ready: false, code: "OBJECT_INPUT_UNAVAILABLE", message: "当前场景没有可运行的业务对象。" };
    }
    const selectedCase = study.m08?.cases?.find((item) => item.id === state.caseCaseId);
    if (!selectedCase) return { ready: false, code: "SIMULATION_CASE_UNAVAILABLE", message: "当前场景没有可运行的压力情景。" };
    const inputMode = study.m08?.inputMode || "OBSERVED_SERIES_SIMULATION";
    return { ready: true, scenario, study, object, selectedCase, inputMode };
  }

  function caseInputManifest() {
    const availability = caseAvailability();
    if (!availability.ready) return null;
    const objective = state.objective;
    const { study, object, scenario, inputMode } = availability;
    const handoff = state.explorationContext;
    const months = Number(state.caseRange) || 6;
    const matches = handoff?.objectRef?.id === object.id;
    const configuredCaseId = state.caseCaseId || study.m08.defaultCaseId;
    return {
      schemaVersion: "ofw.m08.case-input.v2",
      sourceKind: inputMode,
      ...scenario,
      objectiveId: objective?.objectiveId,
      objectiveRevisionId: objective?.revisionId,
      bindingRevisionId: objective ? `${objective.binding.bindingId}-R${objective.binding.revision}` : null,
      releaseId: objective?.release.releaseId,
      modelVersionId: objective?.release.modelVersionId,
      objectRef: matches ? structuredClone(handoff.objectRef) : { id: object.id, title: object.name, objectTypeRef: `${object.objectTypeRef || object.type}@${study.context.ontologyVersionId}` },
      focusBaselineMemberRef: matches ? handoff.focusBaselineMemberRef || object.simulationBaselineMemberRef : object.simulationBaselineMemberRef,
      seriesRef: matches ? handoff.seriesRef || null : { id: `TS-${object.id}-v1`, name: study.quiver?.seriesName || "观察序列", unit: study.quiver?.unit || null, scopeObjectRef: object.id },
      factualEvaluationCoverageAllowed: inputMode !== "SYNTHETIC_CANDIDATE_SIMULATION",
      inputLimitations: inputMode === "SYNTHETIC_CANDIDATE_SIMULATION" ? ["SERIES_INPUT_UNAVAILABLE", "SYNTHETIC_BASELINE_ONLY", "NO_FACT_COVERAGE"] : [],
      lensRef: matches ? structuredClone(handoff.lensRef || null) : null,
      returnUrl: matches ? handoff.returnUrl || null : null,
      timeRange: matches ? handoff.timeRange : study.m08?.defaultTimeRanges?.[String(months)] || { months, label: `${months} 个月观察窗口` },
      observation: matches ? handoff.observation : null,
      dataVersionId: matches ? handoff.dataVersionId : objective?.dataProductRef || study.context.dataVersionId,
      ontologyVersionId: matches ? handoff.ontologyVersionId : objective?.ontologyVersionId || study.context.ontologyVersionId,
      bindingId: matches ? handoff.bindingId || objective?.binding.bindingId : objective?.binding.bindingId || study.context.bindingId,
      asOf: handoff?.asOf || study.context?.asOf || null,
      caseId: configuredCaseId
    };
  }

  function caseSignature(input = caseInputManifest()) {
    if (!input) return "UNAVAILABLE";
    return JSON.stringify({ objectiveRevisionId: input.objectiveRevisionId, bindingRevisionId: input.bindingRevisionId, modelVersionId: input.modelVersionId, objectRef: input.objectRef?.id, lensRef: input.lensRef, returnUrl: input.returnUrl, timeRange: input.timeRange, dataVersionId: input.dataVersionId, ontologyVersionId: input.ontologyVersionId, caseId: input.caseId });
  }

  function caseResultStale() {
    if (!state.caseResult?.inputManifest) return Boolean(state.caseResult);
    return caseSignature(state.caseResult.inputManifest) !== caseSignature();
  }

  async function runCaseStudy() {
    const availability = caseAvailability();
    if (state.caseLoading || !availability.ready) {
      if (!availability.ready) state.error = { code: availability.code, message: availability.message };
      render();
      return;
    }
    state.caseLoading = true;
    render();
    try {
      const input = caseInputManifest();
      const query = new URLSearchParams({ scenarioId: input.scenarioId, scenarioVersion: input.scenarioVersion, scenarioRunId: input.scenarioRunId, formedAt: input.formedAt, status: input.status, dataVersionId: input.dataVersionId, ontologyVersionId: input.ontologyVersionId, semanticVersionId: input.ontologyVersionId, bindingId: input.bindingId, projectionDigest: `OBJECTIVE-FIRST-${input.scenarioId}-v1` });
      const demo = await api(`/v1/demo?${query.toString()}`);
      const simulation = await api("/v1/simulations/run", { method: "POST", body: JSON.stringify({ ...input, runNonce: `M08OBJ-${Date.now().toString(36).toUpperCase()}`, projectionDigest: `OBJECTIVE-FIRST-${input.scenarioId}-v1` }) });
      state.caseResult = { demo, simulation, inputManifest: input, completedAt: new Date().toISOString() };
      state.error = null;
      saveSession();
    } catch (error) {
      state.error = { code: error.code || "SIMULATION_FAILED", message: error.message };
    } finally {
      state.caseLoading = false;
      render();
    }
  }

  function returnToExploration() {
    if (!state.caseResult || caseResultStale()) return;
    const simulation = state.caseResult.simulation;
    const output = simulation?.result?.outputs?.simulatedEvaluation;
    const holdings = simulation?.result?.outputs?.shockedPortfolio?.holdings || [];
    const focused = holdings.find((item) => item.holdingId === state.caseResult.inputManifest.focusBaselineMemberRef) || null;
    const totalImpact = holdings.reduce((sum, item) => sum + Number(item.valueImpactCny || 0), 0);
    const input = state.caseResult.inputManifest;
    const resultEnvelope = {
      schemaVersion: "ofw.m08.result-envelope.v1",
      resultId: simulation?.result?.simulationResultId,
      resultKind: "SIMULATION",
      outputKind: "STRESS_EVALUATION",
      objectiveId: input.objectiveId,
      objectiveRevisionId: input.objectiveRevisionId,
      bindingRevisionId: input.bindingRevisionId,
      releaseId: input.releaseId,
      modelVersionId: input.modelVersionId,
      runId: simulation?.simulationRunId,
      subjectRefs: [input.objectRef],
      inputSnapshot: { scenarioId: input.scenarioId, scenarioVersion: input.scenarioVersion, scenarioRunId: input.scenarioRunId, formedAt: input.formedAt, status: input.status, dataVersionId: input.dataVersionId, ontologyVersionId: input.ontologyVersionId, asOf: input.asOf, timeRange: input.timeRange },
      resultItems: [
        { outputId: "simulatedEvaluationScore", label: "模拟评价分数", shape: "SCALAR", resultKind: "SIMULATION", value: output?.score ?? null, unit: "score_0_100", coverage: output?.coverage ?? null, displayHint: "OBJECT_SCORE" },
        { outputId: "focusedValueImpact", label: "当前对象价值影响", shape: "SCALAR", resultKind: "SIMULATION", value: focused?.valueImpactCny ?? null, unit: "cny", displayHint: "VALUE_DELTA" },
        { outputId: "portfolioValueImpact", label: "组合价值影响", shape: "SCALAR", resultKind: "SIMULATION", value: totalImpact, unit: "cny", displayHint: "VALUE_DELTA" }
      ],
      evidenceRef: simulation?.simulationRunId,
      fixtureId: simulation?.fixture?.fixtureId || null,
      inputClassification: simulation?.fixture?.classification || "UNKNOWN_INPUT_CLASSIFICATION",
      containsSourceBusinessValues: simulation?.fixture?.containsSourceBusinessValues,
      permissionScope: simulation?.result?.permissionScope,
      factWriteAllowed: simulation?.result?.factWriteAllowed,
      actionWriteAllowed: simulation?.result?.actionWriteAllowed,
      actionSourceAllowed: false,
      sideEffectsEmitted: simulation?.sideEffectAudit?.emitted
    };
    const payload = { schemaVersion: "ofw.m08.m07-return.v2", inputManifest: input, resultEnvelope, caseId: input.caseId, caseName: activeCaseStudy()?.m08?.cases?.find((item) => item.id === input.caseId)?.name || input.caseId, simulationRunId: simulation?.simulationRunId, simulationResultId: simulation?.result?.simulationResultId, simulationStatus: simulation?.status, score: output?.score ?? null, focusedValueImpactCny: focused?.valueImpactCny ?? null, valueImpactCny: totalImpact, valueImpactLabel: `${(totalImpact / 1000000).toFixed(2)} 百万元`, sideEffectsEmitted: simulation?.sideEffectAudit?.emitted, completedAt: state.caseResult.completedAt };
    global.parent?.postMessage?.(BRIDGE.returnMessage(payload, input), location.origin);
  }

  function simulationCaseView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    if (isS003Objective()) {
      const { candidates, shadow } = s003WorkspaceFacts();
      return `<section class="m08-panel" data-screen-label="S003 模拟使用方式"><header class="m08-panel-head"><div><span class="m08-kicker">模拟是一种使用方式</span><h2>在固定数据版本上比较候选影响</h2><p>模拟不属于 Objective 生命周期，也不能替代监督式 Benchmark、正式事实或影子结果。</p></div><button class="m08-btn primary" data-route-module="dashboard">返回 S003 候选试算${icon("arrow")}</button></header><div class="m08-use-mode-empty"><span>${icon("flask")}</span><h3>${shadow ? "影子候选可供 S003 固定数据试算" : "需要先选择影子候选"}</h3><p>Dashboard 发起 WHAT_IF 或 SHADOW 请求；M08 返回 PREDICTION Result Envelope，并保留模型版本、Binding、数据版本、对象范围和差异证据。</p><div><div class="m08-preview-output"><span>可用候选</span><strong>${candidates.length} 个</strong><small>Model Version 不可变</small></div><div class="m08-preview-output"><span>正式事实</span><strong>不修改</strong><small>历史 S003-RUN 保持只读</small></div><div class="m08-preview-output"><span>行动写入</span><strong>禁止</strong><small>M04 非事实硬拒绝</small></div></div>${technicalEvidence("查看使用合同", [["Result Kind", "PREDICTION"], ["Use Kind", "WHAT_IF / SHADOW"], ["Objective", objective.objectiveId], ["事实写入", "false"], ["行动写入", "false"]])}</div></section>`;
    }
    const availability = caseAvailability();
    if (!availability.ready) {
      return `<section class="m08-panel" data-screen-label="Objective 输入不可用"><div class="m08-use-mode-empty"><span>${icon("alert")}</span><h3>当前输入不可用</h3><p>${esc(availability.message)}</p>${badge(availability.code, "warning")}<button class="m08-btn primary" data-route-module="m07">返回多视图探索${icon("arrow")}</button></div></section>`;
    }
    const { study, object, scenario, selectedCase: caseDef, inputMode } = availability;
    const input = caseInputManifest();
    const result = state.caseResult;
    const simulation = result?.simulation;
    const output = simulation?.result?.outputs?.simulatedEvaluation;
    const holdings = simulation?.result?.outputs?.shockedPortfolio?.holdings || [];
    const focused = holdings.find((item) => item.holdingId === result?.inputManifest?.focusBaselineMemberRef) || null;
    const totalImpact = holdings.reduce((sum, item) => sum + Number(item.valueImpactCny || 0), 0);
    const stale = caseResultStale();
    const lockedToHandoff = Boolean(study.m08?.requiresM07Handoff);
    const rangeLabel = input.timeRange?.label || [input.timeRange?.start, input.timeRange?.end].filter(Boolean).join(" 至 ") || "当前探索时间范围";
    const rangeOptions = lockedToHandoff
      ? `<option value="handoff" selected>${esc(rangeLabel)}</option>`
      : `<option value="6" ${state.caseRange === "6" ? "selected" : ""}>最近 6 个月</option><option value="12" ${state.caseRange === "12" ? "selected" : ""}>2025 年完整 12 个月</option>`;
    const objectDetail = object.balance || object.category || object.scopeStatus || "当前场景对象";
    const graphSteps = list(study.m08?.graphSteps);
    return `<section data-screen-label="Objective 隔离模拟"><section class="m08-simulation-question"><div><span class="m08-kicker">模拟使用方式</span><h2>验证一个明确的压力问题</h2><p>${esc(caseDef.businessQuestion || study.m08?.businessQuestion || objective.businessQuestion)}</p></div><button class="m08-btn primary" data-action="run-simulation" ${state.caseLoading ? "disabled" : ""}>${icon(state.caseLoading ? "clock" : "play")}${state.caseLoading ? "正在运行" : result && !stale ? "重新运行" : "运行当前情景"}</button></section>${inputMode === "SYNTHETIC_CANDIDATE_SIMULATION" ? `<div class="m08-stale">${icon("alert")}真实业务时序尚未接入；本次仅使用隔离候选基线产生 SIMULATION 结果，不计入事实评价覆盖率，也不得替代实际业务指标。</div>` : ""}<div class="m08-case-workspace"><aside class="m08-input-rail"><header><span class="m08-kicker">固定输入</span><h3>本次 Run 对应什么</h3></header><label><span>业务对象</span><select data-case-object ${lockedToHandoff ? "disabled" : ""}>${study.m07.objects.map((item) => `<option value="${esc(item.id)}" ${item.id === state.caseObjectId ? "selected" : ""}>${esc(item.name)} · ${esc(item.relation)}</option>`).join("")}</select></label><label><span>观察窗口</span><select data-case-range ${lockedToHandoff ? "disabled" : ""}>${rangeOptions}</select></label><section><span>当前对象</span><strong>${esc(input.objectRef?.title)}</strong><small>${esc(objectDetail)}</small></section>${technicalEvidence("查看固定输入证据", [["Input Mode", inputMode], ["Objective", input.objectiveRevisionId], ["Binding", input.bindingRevisionId], ["Model", input.modelVersionId], ["数据", input.dataVersionId], ["Ontology", input.ontologyVersionId]])}<button class="m08-btn secondary m08-wide" data-route-module="m07">调整探索上下文</button></aside><main class="m08-simulation-main"><header><div><span class="m08-kicker">情景与参数</span><h3>配置并运行隔离模拟</h3></div>${result ? badge(stale ? "输入已变化" : "运行完成", stale ? "warning" : "success") : badge("等待运行", "info")}</header><div class="m08-case-select"><label>压力情景<select data-case-id>${study.m08.cases.map((item) => `<option value="${esc(item.id)}" ${item.id === state.caseCaseId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label><div><span>本次参数</span><strong>${esc(caseDef.params)}</strong></div></div><div class="m08-model-graph">${(graphSteps.length ? graphSteps : ["固定基线", "参数冲击", "模型计算"]).map((step, index, steps) => `<span><b>${esc(step)}</b><small>${index === 0 ? esc(input.asOf) : index === steps.length - 1 ? esc(input.modelVersionId) : esc(caseDef.params)}</small></span>${index < steps.length - 1 ? icon("arrow") : ""}`).join("")}</div>${result ? `${stale ? `<div class="m08-stale">${icon("alert")}当前输入已变化；以下结果仍对应上一次 Run，重新运行后才会更新。</div>` : ""}<div class="m08-sim-metrics"><div><span>模拟评价分数</span><strong>${output?.score?.toFixed?.(4) || "—"}</strong><small>候选覆盖率 ${output?.coverage == null ? "—" : `${(output.coverage * 100).toFixed(0)}%`}</small></div><div><span>当前对象影响</span><strong class="negative">${focused ? `${(focused.valueImpactCny / 1000000).toFixed(2)} 百万元` : "—"}</strong><small>${esc(result.inputManifest.objectRef?.title)}</small></div><div><span>组合价值影响</span><strong class="negative">${Number.isFinite(totalImpact) ? `${(totalImpact / 1000000).toFixed(2)} 百万元` : "—"}</strong><small>模拟结果，不写事实</small></div><div><span>运行状态</span><strong>${esc(simulation.status)}</strong><small>事实覆盖增量 0 · 外部副作用 0</small></div></div><details class="m08-result-envelope"><summary>${icon("file")}查看完整运行证据</summary><dl><div><dt>Simulation Run</dt><dd>${esc(simulation.simulationRunId)}</dd></div><div><dt>Result</dt><dd>${esc(simulation.result?.simulationResultId)}</dd></div><div><dt>Input Mode</dt><dd>${esc(inputMode)}</dd></div><div><dt>Baseline</dt><dd>${esc(simulation.baselineId)}</dd></div><div><dt>Parameter Set</dt><dd>${esc(simulation.parameterSetId)}</dd></div><div><dt>Graph</dt><dd>${esc(simulation.graphId)}</dd></div><div><dt>Result Kind</dt><dd>SIMULATION</dd></div></dl></details><div class="m08-result-actions"><button class="m08-btn secondary" data-action="run-simulation">${icon("refresh")}重新运行</button><button class="m08-btn primary" data-action="return-exploration" ${stale ? "disabled" : ""}>返回探索分析${icon("arrow")}</button></div>` : `<div class="m08-run-ready"><span>${icon("flask")}</span><h3>隔离候选输入和情景已准备</h3><p>运行后形成独立 Simulation Result；真实业务序列缺失仍保留为缺失，不进入事实评价覆盖率。</p><button class="m08-btn primary" data-action="run-simulation">${icon("play")}运行当前情景</button></div>`}</main></div></section>`;
  }

  function loadingView(label = "正在加载模型目标") {
    return `<div class="m08-loading">${icon("refresh")}<strong>${esc(label)}</strong></div>`;
  }

  function noObjectiveView() {
    const scenarioId = activeScenarioId() || "当前场景";
    return `<section class="m08-panel" data-screen-label="Objective 不可用"><div class="m08-use-mode-empty"><span>${icon("alert")}</span><h3>${esc(scenarioId)} 暂无可用建模目标</h3><p>当前场景未注册兼容的 Modeling Objective。</p><button class="m08-btn primary" data-section="catalog">返回目标目录</button></div></section>`;
  }

  function render() {
    const body = state.loading && !state.catalog.length ? loadingView()
      : state.section === "catalog" ? catalogView()
        : !state.objective ? noObjectiveView()
          : state.section === "objective" ? objectiveView()
            : state.section === "contracts" ? contractsView()
              : state.section === "benchmark" ? benchmarkView()
                : state.section === "insights" ? insightsView()
                  : state.section === "candidates" ? candidatesView()
                    : state.section === "binding" ? bindingView()
                      : state.section === "consumption" ? consumptionView()
                        : simulationCaseView();
    const currentError = state.workspaceError || state.error;
    root.innerHTML = `<div class="m08-content" data-screen-label="M08 模型目标工作区">${shellHead()}${workspaceNav()}${state.section === "catalog" ? "" : objectiveSummary()}${state.workspaceLoading && isS003Objective() ? loadingView("正在同步当前模型运行状态") : body}${currentError ? `<div class="m08-error">${esc(currentError.code)} · ${esc(currentError.message)}</div>` : ""}</div>`;
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest?.("[data-route-module]");
    if (routeButton) { route(routeButton.dataset.routeModule); return; }
    const sectionButton = event.target.closest?.("[data-section]");
    if (sectionButton) { setSection(sectionButton.dataset.section); if (sectionButton.dataset.section === "consumption" && !state.consumerProjection) loadConsumerProjection(state.consumerId); return; }
    const objectiveButton = event.target.closest?.("[data-objective-id]");
    if (objectiveButton) { selectObjective(objectiveButton.dataset.objectiveId); return; }
    const scopeButton = event.target.closest?.("[data-catalog-scope]");
    if (scopeButton) { state.catalogScope = scopeButton.dataset.catalogScope; saveSession(); render(); return; }
    const kindButton = event.target.closest?.("[data-kind]");
    if (kindButton) { state.kindFilter = kindButton.dataset.kind; render(); return; }
    const candidateButton = event.target.closest?.("[data-s003-candidate-id]");
    if (candidateButton) { state.selectedCandidateId = candidateButton.dataset.s003CandidateId; saveSession(); render(); return; }
    const consumerButton = event.target.closest?.("[data-consumer-id]");
    if (consumerButton) { loadConsumerProjection(consumerButton.dataset.consumerId); return; }
    const action = event.target.closest?.("[data-action]")?.dataset.action;
    if (action === "validate-binding") validateCurrentBinding();
    if (action === "run-simulation") runCaseStudy();
    if (action === "return-exploration") returnToExploration();
    if (action === "return-s003-result") emitS003Result({ resultEnvelope: state.objectiveWorkspace?.currentResultEnvelope });
    if (action === "return-saved-context") navigateSavedReturn();
    if (WORKSPACE_ACTIONS[action]) runWorkspaceAction(action, action === "advance-shadow" ? { decision: "CONTINUE" } : null);
    if (action === "request-default-confirm") { state.defaultApplyConfirmation = true; render(); }
    if (action === "cancel-default-confirm") { state.defaultApplyConfirmation = false; render(); }
    if (action === "confirm-default") runWorkspaceAction("apply-default");
  });

  document.addEventListener("input", (event) => {
    if (!event.target.matches?.("[data-objective-search]")) return;
    state.catalogSearch = event.target.value;
    render();
    requestAnimationFrame(() => root.querySelector("[data-objective-search]")?.focus());
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches?.("[data-mobile-section]")) { setSection(event.target.value); if (event.target.value === "consumption") loadConsumerProjection(state.consumerId); return; }
    if (event.target.matches?.("[data-case-object]")) { state.caseObjectId = event.target.value; saveSession(); render(); return; }
    if (event.target.matches?.("[data-case-range]")) { state.caseRange = event.target.value; saveSession(); render(); return; }
    if (event.target.matches?.("[data-case-id]")) { state.caseCaseId = event.target.value; saveSession(); render(); }
  });

  window.addEventListener("hashchange", () => {
    const raw = location.hash.replace(/^#\/?/, "");
    const next = SECTION_ALIASES[raw] || raw;
    if (SECTIONS.includes(next) && next !== state.section) { state.section = next; render(); }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== global.parent) return;
    if (event.data?.type === "OFW_S003_MODELING_RECALCULATE_REQUEST") {
      try {
        const source = event.data.scenarioContext
          || event.data.payload?.scenarioContext
          || (event.data.payload?.scenarioId ? event.data.payload : Object.fromEntries(BRIDGE.IDENTITY_FIELDS.map((field) => [field, event.data[field]])));
        if (!BRIDGE.sameScenario(source, activeScenarioIdentity())) throw new TypeError("Recalculation scenario does not match the active scenario");
        recalculateS003Result(event.data.payload || {});
      } catch (error) {
        state.workspaceError = { code: "S003_RECALCULATION_CONTEXT_INVALID", message: error.message };
        render();
      }
      return;
    }
    if (event.data?.type === "OFW_S003_OPEN_MODELING_OBJECTIVE") {
      try {
        const payload = event.data.payload || event.data;
        if (payload.scenarioId && !BRIDGE.sameScenario(payload, activeScenarioIdentity())) throw new TypeError("Objective request scenario does not match the active scenario");
        selectObjective(event.data.objectiveId || payload.objectiveId || S003_OBJECTIVE_ID, event.data.view || payload.view || "objective");
      } catch (error) {
        state.workspaceError = { code: "S003_OBJECTIVE_CONTEXT_INVALID", message: error.message };
        render();
      }
      return;
    }
    if (event.data?.type !== BRIDGE.CONTRACT.deliverEvent || event.data?.targetModuleId !== BRIDGE.CONTRACT.targetModuleId) return;
    try {
      const incomingScenario = BRIDGE.scenarioIdentity(event.data.payload);
      if (urlScenario && !BRIDGE.sameScenario(incomingScenario, urlScenario)) throw new TypeError("Delivered scenario does not match the mounted module URL");
    } catch (error) {
      state.error = { code: "SCENARIO_CONTEXT_INVALID", message: error.message };
      render();
      return;
    }
    state.context = event.data.payload;
    state.projection = state.context?.projection || null;
    const objectiveRequest = state.context?.modelingObjectiveRequest || state.context?.objectiveRequest || state.context?.modelingReturnContext;
    if (objectiveRequest?.objectiveId) selectObjective(objectiveRequest.objectiveId, objectiveRequest.view || "objective");
    resolveExplorationHandoff(state.context?.explorationHandoff);
    render();
  });

  render();
  health();
  loadCatalog();
})(window);
