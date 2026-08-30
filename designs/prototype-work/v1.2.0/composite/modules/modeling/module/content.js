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
  const SECTIONS = ["catalog", "objective", "contracts", "candidates", "binding", "consumption", "simulation"];
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
    DRAFT_REQUIRES_M01_CR: "Binding 草案，待 M01 CR"
  };
  const consumerIcons = { M07_EXPLORATION: "eye", M06_REPORT: "report", M03_QUERY: "query", M05_AGENT: "bot", M04_DECISION: "decision" };

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") || {}; } catch (_) { return {}; }
  }

  const persisted = readSession();
  const initialSection = (location.hash || "#catalog").replace(/^#/, "");
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
    caseLoading: false
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
        caseResult: state.caseResult
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

  const badge = (text, tone = "neutral") => `<span class="m08-badge ${tone}">${esc(text)}</span>`;
  const kindBadge = (kind) => badge(kindLabels[kind] || kind, String(kind || "").toLowerCase());

  function route(moduleId) {
    const route = moduleId === BRIDGE.CONTRACT.sourceModuleId
      ? BRIDGE.CONTRACT.sourceRoute
      : `#module/${moduleId}`;
    global.parent?.postMessage?.({ type: "OFW_M08_NAVIGATE", moduleId, route }, location.origin);
  }

  function setSection(section) {
    if (!SECTIONS.includes(section)) return;
    state.section = section;
    history.replaceState({}, "", `#${section}`);
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
      history.replaceState({}, "", `#${section}`);
      if (section === "consumption") await loadConsumerProjection(state.consumerId);
      state.error = null;
    } catch (error) {
      state.error = { code: error.code || "OBJECTIVE_LOAD_FAILED", message: error.message };
    } finally {
      state.loading = false;
      render();
    }
  }

  async function validateCurrentBinding() {
    if (!state.objective || state.bindingLoading) return;
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
      const query = new URLSearchParams({ objectTypeRef: handoff.objectRef.objectTypeRef, useKind: handoff.requestedUseKind || "SIMULATION", scenarioId: scenario.scenarioId });
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
    return `<header class="m08-top"><div class="m08-title"><span class="m08-mark">${icon("activity")}</span><div><span class="m08-kicker">M08 · MODELING OBJECTIVES</span><h1>模型与模拟</h1><p>目标、模型、Binding 和使用方共享同一条可追溯链路</p></div></div><div class="m08-meta">${badge(state.apiHealth === "ok" ? "计算服务已连接" : "计算服务未验证", state.apiHealth === "ok" ? "success" : "warning")}<div class="m08-meta-item"><span>当前目标</span><strong>${esc(objective?.shortName || "加载中")}</strong></div><div class="m08-meta-item"><span>Revision</span><strong>${esc(objective?.revisionId || "—")}</strong></div></div></header>`;
  }

  function workspaceNav() {
    const items = [["catalog", "目标目录"], ["objective", "目标概览"], ["contracts", "输入输出"], ["candidates", "候选评估"], ["binding", "发布绑定"], ["consumption", "使用与结果"], ["simulation", "隔离模拟"]];
    return `<nav class="m08-tabs" aria-label="Modeling Objective 工作区">${items.map(([section, label]) => `<button class="${state.section === section ? "active" : ""}" data-section="${section}">${esc(label)}</button>`).join("")}</nav><label class="m08-mobile-nav"><span>当前任务</span><select data-mobile-section>${items.map(([section, label], index) => `<option value="${section}" ${state.section === section ? "selected" : ""}>${index + 1}/7 · ${esc(label)}</option>`).join("")}</select></label>`;
  }

  function objectiveSummary() {
    const objective = state.objective;
    if (!objective) return "";
    return `<section class="m08-objective-bar"><div><span>${kindBadge(objective.kind)}${badge(objective.domain)}${badge((objective.scenarioIds || []).join(" / "))}</span><strong>${esc(objective.name)}</strong><small>${esc(objective.businessQuestion)}</small></div><div class="m08-objective-stats"><div><span>输入</span><strong>${objective.inputContract.length} 项</strong></div><div><span>输出</span><strong>${objective.outputContract.length} 项</strong></div><div><span>候选</span><strong>${objective.candidates.length} 个</strong></div><div><span>消费者</span><strong>${objective.consumers.filter((item) => item.allowed).length} 个</strong></div></div></section>`;
  }

  function filteredCatalog() {
    const query = state.catalogSearch.trim().toLowerCase();
    const scenarioId = activeScenarioId();
    return state.catalog.filter((item) => (!scenarioId || item.scenarioIds?.includes(scenarioId)) && (state.kindFilter === "ALL" || item.kind === state.kindFilter) && (!query || [item.name, item.objectiveId, item.domain, item.businessQuestion, ...(item.scenarioIds || [])].some((value) => String(value).toLowerCase().includes(query))));
  }

  function catalogView() {
    const objectives = filteredCatalog();
    const scenarioId = activeScenarioId();
    const scenarioObjectiveCount = state.catalog.filter((item) => !scenarioId || item.scenarioIds?.includes(scenarioId)).length;
    const emptyLabel = scenarioObjectiveCount ? "没有匹配的建模目标" : `${scenarioId || "当前场景"} 暂无可用建模目标`;
    return `<section class="m08-panel m08-catalog" data-screen-label="Modeling Objective 目录"><header class="m08-panel-head"><div><span class="m08-kicker">OBJECTIVE CATALOG</span><h2>从业务问题选择建模目标</h2><p>目录仅显示当前场景可用的预测、分类、评分和优化目标。</p></div><div class="m08-catalog-count">${objectives.length} / ${scenarioObjectiveCount}</div></header><div class="m08-catalog-toolbar"><label>${icon("search")}<input type="search" placeholder="搜索目标或业务问题" value="${esc(state.catalogSearch)}" data-objective-search /></label><select data-kind-filter><option value="ALL">全部类型</option>${Object.entries(kindLabels).map(([value, label]) => `<option value="${value}" ${state.kindFilter === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="m08-objective-list"><div class="m08-objective-row head"><span>业务目标</span><span>类型 / 场景</span><span>合同</span><span>发布与 Binding</span><span>使用方</span><span></span></div>${objectives.map((item) => `<button type="button" class="m08-objective-row ${item.objectiveId === state.objectiveId ? "selected" : ""}" data-objective-id="${esc(item.objectiveId)}"><span><strong>${esc(item.name)}</strong><small>${esc(item.businessQuestion)}</small></span><span>${kindBadge(item.kind)}<small>${esc(item.domain)} · ${esc(item.scenarioIds.join(" / "))}</small></span><span><strong>${item.inputCount} 输入 · ${item.outputCount} 输出</strong><small>${esc(item.targetObjectTypes.join(" / "))}</small></span><span><strong>${esc(statusLabels[item.releaseStatus] || item.releaseStatus)}</strong><small>${esc(statusLabels[item.bindingStatus] || item.bindingStatus)}</small></span><span><strong>${item.consumerCount} 个兼容模块</strong><small>${item.executionStatus === "SYNTHETIC_PREVIEW_READY" || item.executionStatus === "ISOLATED_RUN_READY" ? "可运行结果预览" : "合同预览"}</small></span><span>${icon("chevron")}</span></button>`).join("")}${objectives.length ? "" : `<div class="m08-empty"><strong>${esc(emptyLabel)}</strong><small>当前场景未注册 Modeling Objective。</small></div>`}</div></section>`;
  }

  function lifecycle(objective) {
    const releaseReady = objective.release.status === "RESEARCH_RELEASE_CANDIDATE";
    const steps = [["目标定义", true, objective.revisionId, "objective"], ["输入输出合同", objective.inputContract.length && objective.outputContract.length, `${objective.inputContract.length}+${objective.outputContract.length} 项`, "contracts"], ["候选评估", objective.candidates.some((item) => /EVALUATED|VALIDATED/.test(item.status)), `${objective.candidates.length} 个候选`, "candidates"], ["人工评审", releaseReady, releaseReady ? "发布候选已形成" : "待评审", "candidates"], ["Release / Binding", releaseReady, statusLabels[objective.binding.status] || objective.binding.status, "binding"], ["消费适配", objective.consumers.some((item) => item.allowed), `${objective.consumers.filter((item) => item.allowed).length} 个模块`, "consumption"]];
    const active = steps.findIndex((item) => !item[1]);
    return `<div class="m08-lifecycle">${steps.map(([label, done, detail, section], index) => `<button type="button" class="${done ? "done" : index === active ? "active" : "pending"}" data-section="${section}"><span>${done ? icon("check") : index + 1}</span><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`).join("")}</div>`;
  }

  function objectiveView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    const compatible = state.compatibleObjectiveIds.includes(objective.objectiveId);
    return `<section data-screen-label="Modeling Objective 概览">${state.explorationContext ? `<div class="m08-handoff-banner ${compatible ? "compatible" : "warning"}">${icon(compatible ? "check" : "alert")}<div><strong>${compatible ? "与探索上下文兼容" : "当前目标与探索对象不兼容"}</strong><span>${esc(state.explorationContext.objectRef?.title)} · ${esc(state.explorationContext.objectRef?.objectTypeRef)} · ${esc(state.explorationContext.timeRange?.label)}</span></div><button class="m08-btn secondary" data-route-module="m07">返回探索分析</button></div>` : ""}<section class="m08-objective-hero"><div><span class="m08-kicker">${esc(objective.objectiveId)} · ${esc(objective.revisionId)}</span><div class="m08-heading-line"><h2>${esc(objective.name)}</h2>${kindBadge(objective.kind)}${badge(statusLabels[objective.status] || objective.status, objective.status === "RESEARCH_EVALUATED" ? "success" : "warning")}</div><p>${esc(objective.businessQuestion)}</p><div class="m08-objective-meta"><span>业务 Owner · ${esc(objective.owner)}</span><span>目标对象 · ${esc(objective.acceptedObjectTypes.join(" / "))}</span><span>场景 · ${esc(objective.scenarioIds.join(" / "))}</span></div></div><div class="m08-objective-actions"><button class="m08-btn secondary" data-section="contracts">查看输入输出</button><button class="m08-btn primary" data-section="consumption">查看使用方式${icon("arrow")}</button></div></section>${lifecycle(objective)}<div class="m08-overview-grid"><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">OBJECTIVE CONTRACT</span><h3>业务用途与边界</h3></div></header><dl class="m08-kv-list"><div><dt>预期用途</dt><dd>${esc(objective.intendedUse)}</dd></div><div><dt>成功标准</dt><dd>${objective.successCriteria.map((item) => `<span>${icon("check")}${esc(item)}</span>`).join("")}</dd></div><div><dt>明确禁止</dt><dd>${objective.prohibitedUses.map((item) => `<span class="danger">${icon("shield")}${esc(item)}</span>`).join("")}</dd></div></dl></section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">CURRENT GOVERNANCE</span><h3>当前版本与门禁</h3></div></header><dl class="m08-kv-list compact"><div><dt>数据产品</dt><dd class="mono">${esc(objective.dataProductRef)}</dd></div><div><dt>Ontology</dt><dd class="mono">${esc(objective.ontologyVersionId)}</dd></div><div><dt>Evaluation</dt><dd class="mono">${esc(objective.evaluationTransactionId)}</dd></div><div><dt>Release</dt><dd>${esc(statusLabels[objective.release.status] || objective.release.status)}</dd></div><div><dt>Binding</dt><dd>${esc(statusLabels[objective.binding.status] || objective.binding.status)}</dd></div></dl></section></div></section>`;
  }

  function portBadges(port) {
    return `<span class="m08-port-badges">${badge(port.type)}${badge(port.unit)}${badge(port.timeGrain)}${badge(port.shape)}${port.required ? badge("必需", "warning") : badge("可选")}</span>`;
  }

  function portRow(port, direction) {
    return `<article class="m08-port-row"><span class="m08-port-icon ${direction}">${icon(direction === "input" ? "database" : "activity")}</span><div><strong>${esc(port.label)}</strong><small>${esc(port.objectTypeRef)}.${esc(port.propertyRef)}</small>${portBadges(port)}<details><summary>查看技术映射</summary><dl><div><dt>模型端口</dt><dd>${esc(port.modelPort)}</dd></div><div><dt>语义形态</dt><dd>${esc(port.semanticKind)} · ${esc(port.cardinality)}</dd></div><div><dt>空值</dt><dd>${port.nullable ? "允许" : "不允许"}</dd></div>${direction === "output" ? `<div><dt>结果身份</dt><dd>${esc(port.resultKind)}${port.outputKind ? ` · ${esc(port.outputKind)}` : ""}</dd></div>` : `<div><dt>来源 Owner</dt><dd>${esc(port.sourceOwner)}</dd></div>`}</dl></details></div><span class="m08-ready">${icon("check")}兼容</span></article>`;
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
    return `<section class="m08-panel" data-screen-label="Objective 输入输出合同"><header class="m08-panel-head"><div><span class="m08-kicker">INPUT / OUTPUT CONTRACT</span><h2>${esc(objective.name)}的模型接口</h2><p>业务字段驱动页面；类型、单位、时间、基数和结果身份由同一 schema 校验。</p></div><div class="m08-contract-summary">${badge(`${objective.inputContract.length} 项输入可用`, "success")}${badge(`${objective.outputContract.length} 项输出受保护`, "success")}${badge(`${objective.consumers.filter((item) => item.allowed).length} 个消费者`, "info")}</div></header><div class="m08-binding-canvas"><section><header><span class="m08-kicker">模型需要什么</span><h3>输入合同</h3><p>数据由 M02 提供，语义由 M01 定义。</p></header><div class="m08-port-list">${objective.inputContract.map((port) => portRow(port, "input")).join("")}</div></section><section class="m08-interface-check"><span class="m08-interface-icon">${icon("link")}</span><h3>稳定模型接口</h3><p>消费者只引用 Binding 与 Release，不接触具体端点。</p><div><span>${icon("check")}类型</span><span>${icon("check")}单位</span><span>${icon("check")}时间</span><span>${icon("check")}基数</span><span>${icon("check")}空值</span><span>${icon("check")}结果身份</span></div><button class="m08-btn primary" data-action="validate-binding" ${state.bindingLoading ? "disabled" : ""}>${icon(state.bindingLoading ? "clock" : "shield")}${state.bindingLoading ? "正在校验" : "校验当前 Binding"}</button></section><section><header><span class="m08-kicker">模型会产生什么</span><h3>输出合同</h3><p>输出进入独立 Result，不覆盖真实 Property。</p></header><div class="m08-port-list">${objective.outputContract.map((port) => portRow(port, "output")).join("")}</div></section></div>${bindingValidationMarkup()}</section>`;
  }

  function candidatesView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    return `<section class="m08-panel" data-screen-label="Objective 候选评估"><header class="m08-panel-head"><div><span class="m08-kicker">CANDIDATE / EVALUATION</span><h2>${esc(objective.name)}的候选模型</h2><p>每个候选固定 Objective Revision、数据 transaction、Evaluator 和指标 schema。</p></div>${badge(objective.evaluationTransactionId)}</header><div class="m08-evaluation-layout"><section><div class="m08-candidate-list">${objective.candidates.map((candidate, index) => `<article class="m08-candidate-row"><span class="m08-rank">${index + 1}</span><div><strong>${esc(candidate.name)}</strong><small>${esc(candidate.candidateId)} · ${esc(candidate.modelVersionId)}</small></div><span>${badge(candidate.status, /EVALUATED|VALIDATED/.test(candidate.status) ? "success" : "warning")}</span><b>${esc(candidate.primaryMetric)}</b></article>`).join("")}</div></section><aside><span class="m08-kicker">固定评估协议</span><dl><div><dt>数据 transaction</dt><dd>${esc(objective.evaluationTransactionId)}</dd></div><div><dt>Evaluator</dt><dd>${esc(objective.evaluatorVersion)}</dd></div><div><dt>Metric schema</dt><dd>${esc(objective.metricSchemaVersion)}</dd></div></dl><h3>通过标准</h3>${objective.successCriteria.map((item) => `<p>${icon("check")}${esc(item)}</p>`).join("")}<div class="m08-boundary-note">${icon("alert")}目录中的其他 Objective 仅提供合同预览，不能宣称模型已正式发布。</div></aside></div></section>`;
  }

  function bindingView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    const releaseReady = objective.release.status === "RESEARCH_RELEASE_CANDIDATE";
    return `<section data-screen-label="Objective 发布与绑定"><div class="m08-binding-governance"><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">RELEASE SELECTOR</span><h3>人工评审后的稳定模型选择</h3></div>${badge(statusLabels[objective.release.status] || objective.release.status, releaseReady ? "success" : "warning")}</header><dl class="m08-kv-list compact"><div><dt>Release</dt><dd class="mono">${esc(objective.release.releaseId)}</dd></div><div><dt>Model Version</dt><dd class="mono">${esc(objective.release.modelVersionId)}</dd></div><div><dt>Published</dt><dd>${objective.release.published ? "是" : "否，发布候选"}</dd></div><div><dt>人工门</dt><dd>${releaseReady ? "已形成 Release Candidate" : "尚未批准，不能激活 Binding"}</dd></div></dl></section><section class="m08-panel"><header class="m08-section-head"><div><span class="m08-kicker">MODEL BINDING</span><h3>稳定语义接口</h3></div>${badge(statusLabels[objective.binding.status] || objective.binding.status, /VALIDATED/.test(objective.binding.status) ? "success" : "warning")}</header><dl class="m08-kv-list compact"><div><dt>Binding ID</dt><dd class="mono">${esc(objective.binding.bindingId)}</dd></div><div><dt>Revision</dt><dd>R${objective.binding.revision}</dd></div><div><dt>Ontology</dt><dd class="mono">${esc(objective.ontologyVersionId)}</dd></div><div><dt>Endpoint</dt><dd>消费者不可见</dd></div><div><dt>事实写入</dt><dd>禁止</dd></div></dl><button class="m08-btn primary m08-binding-action" data-action="validate-binding" ${state.bindingLoading ? "disabled" : ""}>${icon("shield")}${state.bindingLoading ? "正在校验" : "重新校验 Binding"}</button></section></div>${bindingValidationMarkup()}<section class="m08-panel m08-release-flow"><header class="m08-section-head"><div><span class="m08-kicker">GOVERNED CHANGE</span><h3>模型切换不改变消费者接口</h3></div></header><div><span><b>1</b><strong>新 Model Version</strong><small>不可变版本</small></span>${icon("arrow")}<span><b>2</b><strong>重新评估</strong><small>固定 transaction</small></span>${icon("arrow")}<span><b>3</b><strong>人工评审</strong><small>批准或驳回</small></span>${icon("arrow")}<span><b>4</b><strong>新 Release</strong><small>Selector 更新</small></span>${icon("arrow")}<span><b>5</b><strong>Binding Revision</strong><small>消费者兼容</small></span></div></section></section>`;
  }

  function formatValue(port, value) {
    if (value == null) return "—";
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
    const points = [...observed.slice(-6), outputs.predictedCost];
    const labels = [...(activeCaseStudy()?.quiver?.labels || []).slice(-6), "+6月"];
    const width = 640, height = 190, left = 38, right = 20, top = 18, bottom = 30;
    const min = Math.min(...points, outputs.lowerBound) - 0.08;
    const max = Math.max(...points, outputs.upperBound) + 0.08;
    const x = (index) => left + index * ((width - left - right) / Math.max(1, points.length - 1));
    const y = (value) => top + (1 - (value - min) / (max - min)) * (height - top - bottom);
    const observedPoints = points.slice(0, -1).map((value, index) => `${x(index)},${y(value)}`).join(" ");
    const predictedPoints = `${x(points.length - 2)},${y(points.at(-2))} ${x(points.length - 1)},${y(points.at(-1))}`;
    return `<div class="m08-consumer-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="真实融资成本和预测融资成本"><line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}"/><polyline class="fact" points="${observedPoints}"/><polyline class="prediction" points="${predictedPoints}"/><line class="range" x1="${x(points.length - 1)}" y1="${y(outputs.lowerBound)}" x2="${x(points.length - 1)}" y2="${y(outputs.upperBound)}"/>${points.map((value, index) => `<circle class="${index === points.length - 1 ? "prediction" : "fact"}" cx="${x(index)}" cy="${y(value)}" r="3"/><text x="${x(index)}" y="${height - 10}" text-anchor="middle">${esc(labels[index])}</text>`).join("")}</svg><div><span><i class="fact"></i>真实事实</span><span><i class="prediction"></i>模型预测</span><span>预测区间 ${outputs.lowerBound.toFixed(2)}%–${outputs.upperBound.toFixed(2)}%</span></div></div>`;
  }

  function consumerPreview() {
    const projection = state.consumerProjection;
    const objective = state.objective;
    if (state.consumerLoading) return loadingView("正在生成消费者安全投影");
    if (!projection) return `<div class="m08-consumer-empty"><strong>选择一个消费位置</strong><span>系统将按模块能力裁剪同一结果包络。</span></div>`;
    if (projection.status === "BLOCKED") return `<section class="m08-consumer-blocked">${icon("shield")}<h3>该结果不能进入${esc(projection.consumerName)}</h3><p>${esc(projection.reason)}</p><dl><div><dt>拒绝代码</dt><dd>${esc(projection.code)}</dd></div><div><dt>事实写入</dt><dd>禁止</dd></div><div><dt>行动来源</dt><dd>禁止</dd></div></dl></section>`;
    let body = "";
    if (projection.displayMode === "TIMELINE_OVERLAY") body = forecastPreview(projection);
    else if (projection.displayMode === "OBJECT_BADGE") body = `<div class="m08-object-preview"><span>预算单元 · 结果预览</span><strong>${esc(formatValue(projection.outputContract.find((item) => item.modelPort === "riskLevel"), projection.result.outputs.riskLevel))}</strong><div><span>超支概率</span><b>${esc(formatValue(projection.outputContract.find((item) => item.modelPort === "overrunProbability"), projection.result.outputs.overrunProbability))}</b></div></div>`;
    else if (projection.displayMode === "OBJECT_SCORE") {
      const scorePort = projection.outputContract.find((item) => item.unit === "score_0_100") || projection.outputContract[0];
      const coveragePort = projection.outputContract.find((item) => item.modelPort === "coverage");
      const score = Number(projection.result.outputs[scorePort?.modelPort]);
      const detail = coveragePort
        ? `覆盖率 ${esc(formatValue(coveragePort, projection.result.outputs[coveragePort.modelPort]))}`
        : projection.result.outputs.riskGrade ? `等级 ${esc(projection.result.outputs.riskGrade)}` : "保持独立结果身份";
      body = `<div class="m08-score-preview"><div><span>${esc(scorePort?.label || "预测评分")}</span><strong>${Number.isFinite(score) ? score.toFixed(1) : "—"}</strong><small>${detail}</small></div><i><i style="width:${Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0}%"></i></i><p>${projection.result.outputs.reviewRequired ? "建议进入人工复核" : "结果可供受控读取"}</p></div>`;
    }
    else if (projection.displayMode === "OPTION_COMPARISON") body = `<div class="m08-option-preview"><span>可行方案集</span><strong>${esc(projection.result.outputs.optionSet)} 个</strong><div><span>首选方案预期成本</span><b>${Number(projection.result.outputs.expectedCost).toFixed(2)}%</b></div><small>全部硬约束满足 · 仅限隔离模拟比较</small></div>`;
    else if (projection.displayMode === "ANSWER_EVIDENCE_CARD") body = `<div class="m08-answer-preview"><span>${icon("query")}只读结果引用</span><h3>${esc(objective.businessQuestion)}</h3><p>基于 ${esc(projection.bindingRef.bindingId)} 的固定评估结果，当前可读取：</p><div>${previewOutputRows(projection)}</div></div>`;
    else if (projection.displayMode === "EXPLANATION_PANEL") body = `<div class="m08-explanation-preview"><span>${icon("bot")}解释固定结果，不重新计算</span><h3>${esc(objective.name)}结果摘要</h3><div>${previewOutputRows(projection)}</div><p>Agent 只能引用 Objective、Binding、Model Version、覆盖率和证据，不得改变结果。</p></div>`;
    else body = `<div class="m08-report-preview"><header><span>${icon("file")}报告结果块 · 结果预览</span><strong>${esc(objective.name)}</strong></header><div>${previewOutputRows(projection)}</div><footer>Result ${esc(projection.result.resultId)} · ${esc(projection.result.evidenceClass)}</footer></div>`;
    return `<section class="m08-consumer-preview"><header><div><span class="m08-kicker">${esc(projection.displayMode)}</span><h3>${esc(projection.consumerName)}中的安全预览</h3><p>同一 Result ID，按消费者意图裁剪字段和交互能力。</p></div>${badge(projection.status, "success")}</header>${body}<details class="m08-result-envelope"><summary>${icon("file")}查看统一 Result Envelope</summary><dl><div><dt>Result</dt><dd>${esc(projection.result.resultId)}</dd></div><div><dt>Result Kind</dt><dd>${esc(projection.result.resultKind)}</dd></div><div><dt>Objective Revision</dt><dd>${esc(projection.objectiveRevisionId)}</dd></div><div><dt>Binding Revision</dt><dd>${esc(projection.bindingRef.bindingId)} · R${projection.bindingRef.revision}</dd></div><div><dt>Model Version</dt><dd>${esc(projection.releaseSelector.modelVersionId)}</dd></div><div><dt>权限</dt><dd>${esc(projection.permissionScope)}</dd></div><div><dt>事实写入</dt><dd>禁止</dd></div><div><dt>行动来源</dt><dd>禁止</dd></div></dl></details></section>`;
  }

  function consumptionView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    return `<section class="m08-panel" data-screen-label="Objective 使用与结果"><header class="m08-panel-head"><div><span class="m08-kicker">CONSUMER PROJECTIONS</span><h2>一个结果，适配不同使用位置</h2><p>消费者共享 Result ID 和证据，不复制模型端点或结果真值。</p></div>${badge(`${objective.consumers.filter((item) => item.allowed).length} 兼容 · ${objective.consumers.filter((item) => !item.allowed).length} 阻断`, "info")}</header><div class="m08-consumption-layout"><aside class="m08-consumer-list">${objective.consumers.map((consumer) => `<button type="button" class="${consumer.consumerId === state.consumerId ? "active" : ""} ${consumer.allowed ? "" : "blocked"}" data-consumer-id="${esc(consumer.consumerId)}"><span>${icon(consumerIcons[consumer.consumerId])}</span><span><strong>${esc(consumer.name)}</strong><small>${consumer.allowed ? esc(consumer.displayMode) : "默认拒绝非事实来源"}</small></span>${consumer.allowed ? badge("兼容", "success") : badge("阻断", "danger")}</button>`).join("")}</aside><main>${consumerPreview()}</main></div></section>`;
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
    if (scenario.scenarioId === "S005") {
      const handoff = state.explorationContext;
      if (!handoff) return { ready: false, code: "EXPLORATION_HANDOFF_REQUIRED", message: "请先从多视图探索选择一个金融产品并带上下文进入。" };
      try {
        if (!BRIDGE.sameScenario(handoff, scenario)) return { ready: false, code: "SCENARIO_CONTEXT_MISMATCH", message: "探索上下文与活动场景不一致。" };
      } catch (error) {
        return { ready: false, code: "SCENARIO_CONTEXT_INVALID", message: error.message };
      }
      if (String(handoff.objectRef?.objectTypeRef || "").split("@")[0] !== "InvestmentProduct") {
        return { ready: false, code: "OBJECT_TYPE_INCOMPATIBLE", message: "当前探索对象不是可用于投后评价的金融产品。" };
      }
      if (!handoff.dataVersionId || !handoff.ontologyVersionId || !handoff.timeRange) {
        return { ready: false, code: "EXPLORATION_INPUT_INCOMPLETE", message: "当前探索上下文缺少数据版本、语义版本或时间范围。" };
      }
      if (!handoff.seriesRef) {
        return { ready: false, code: "SERIES_INPUT_UNAVAILABLE", message: "当前探索对象未提供可用时序系列；模型与模拟不会替换为其他对象的系列。" };
      }
      if (!object || object.id !== handoff.objectRef.id) {
        return { ready: false, code: "OBJECT_INPUT_UNAVAILABLE", message: "当前金融产品没有对应的模型输入。" };
      }
      if (!state.compatibleObjectiveIds.includes(state.objective.objectiveId)) {
        return { ready: false, code: "OBJECTIVE_INPUT_INCOMPATIBLE", message: "当前金融产品与所选建模目标不兼容。" };
      }
    } else if (!object) {
      return { ready: false, code: "OBJECT_INPUT_UNAVAILABLE", message: "当前场景没有可运行的业务对象。" };
    }
    const selectedCase = study.m08?.cases?.find((item) => item.id === state.caseCaseId);
    if (!selectedCase) return { ready: false, code: "SIMULATION_CASE_UNAVAILABLE", message: "当前场景没有可运行的压力情景。" };
    return { ready: true, scenario, study, object, selectedCase };
  }

  function caseInputManifest() {
    const availability = caseAvailability();
    if (!availability.ready) return null;
    const objective = state.objective;
    const { study, object, scenario } = availability;
    const handoff = state.explorationContext;
    const months = Number(state.caseRange) || 6;
    const matches = handoff?.objectRef?.id === object.id;
    const configuredCaseId = state.caseCaseId || study.m08.defaultCaseId;
    return {
      schemaVersion: "ofw.m08.case-input.v2",
      sourceKind: handoff?.sourceKind || study.classification,
      ...scenario,
      objectiveId: objective?.objectiveId,
      objectiveRevisionId: objective?.revisionId,
      bindingRevisionId: objective ? `${objective.binding.bindingId}-R${objective.binding.revision}` : null,
      releaseId: objective?.release.releaseId,
      modelVersionId: objective?.release.modelVersionId,
      objectRef: matches ? structuredClone(handoff.objectRef) : { id: object.id, title: object.name, objectTypeRef: `${object.objectTypeRef || object.type}@${study.context.ontologyVersionId}` },
      focusBaselineMemberRef: matches ? handoff.focusBaselineMemberRef || object.simulationBaselineMemberRef : object.simulationBaselineMemberRef,
      seriesRef: matches ? handoff.seriesRef || null : { id: `TS-FIN-COST-${object.id}-v1`, name: "加权平均融资成本", unit: "%", scopeObjectRef: object.id },
      lensRef: matches ? structuredClone(handoff.lensRef || null) : null,
      returnUrl: matches ? handoff.returnUrl || null : null,
      timeRange: matches ? handoff.timeRange : { start: months === 12 ? "2025-01-01" : "2025-07-01", end: "2025-12-31", months, label: months === 12 ? "2025 年完整 12 个月" : "最近 6 个月" },
      observation: matches ? handoff.observation : null,
      dataVersionId: matches ? handoff.dataVersionId : objective?.dataProductRef || study.context.dataVersionId,
      ontologyVersionId: matches ? handoff.ontologyVersionId : objective?.ontologyVersionId || study.context.ontologyVersionId,
      bindingId: matches ? handoff.bindingId || objective?.binding.bindingId : objective?.binding.bindingId || study.context.bindingId,
      asOf: handoff?.asOf || (scenario.scenarioId === "S005" ? "2026-07-17" : "2025-12-31"),
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
      permissionScope: "simulation.read",
      factWriteAllowed: false,
      actionSourceAllowed: false
    };
    const payload = { schemaVersion: "ofw.m08.m07-return.v2", inputManifest: input, resultEnvelope, caseId: input.caseId, caseName: activeCaseStudy()?.m08?.cases?.find((item) => item.id === input.caseId)?.name || input.caseId, simulationRunId: simulation?.simulationRunId, simulationResultId: simulation?.result?.simulationResultId, status: simulation?.status, score: output?.score ?? null, focusedValueImpactCny: focused?.valueImpactCny ?? null, valueImpactCny: totalImpact, valueImpactLabel: `${(totalImpact / 1000000).toFixed(2)} 百万元`, sideEffectsEmitted: simulation?.sideEffectAudit?.emitted ?? 0, completedAt: state.caseResult.completedAt };
    global.parent?.postMessage?.(BRIDGE.returnMessage(payload, input), location.origin);
  }

  function simulationCaseView() {
    const objective = state.objective;
    if (!objective) return loadingView();
    const availability = caseAvailability();
    if (!availability.ready) {
      return `<section class="m08-panel" data-screen-label="Objective 输入不可用"><div class="m08-use-mode-empty"><span>${icon("alert")}</span><h3>当前输入不可用</h3><p>${esc(availability.message)}</p>${badge(availability.code, "warning")}<button class="m08-btn primary" data-route-module="m07">返回多视图探索${icon("arrow")}</button></div></section>`;
    }
    const { study, object, scenario, selectedCase: caseDef } = availability;
    const input = caseInputManifest();
    const result = state.caseResult;
    const simulation = result?.simulation;
    const output = simulation?.result?.outputs?.simulatedEvaluation;
    const holdings = simulation?.result?.outputs?.shockedPortfolio?.holdings || [];
    const focused = holdings.find((item) => item.holdingId === result?.inputManifest?.focusBaselineMemberRef) || null;
    const totalImpact = holdings.reduce((sum, item) => sum + Number(item.valueImpactCny || 0), 0);
    const stale = caseResultStale();
    const lockedToHandoff = scenario.scenarioId === "S005";
    const rangeLabel = input.timeRange?.label || [input.timeRange?.start, input.timeRange?.end].filter(Boolean).join(" 至 ") || "当前探索时间范围";
    const rangeOptions = lockedToHandoff
      ? `<option value="handoff" selected>${esc(rangeLabel)}</option>`
      : `<option value="6" ${state.caseRange === "6" ? "selected" : ""}>最近 6 个月</option><option value="12" ${state.caseRange === "12" ? "selected" : ""}>2025 年完整 12 个月</option>`;
    const objectDetail = object.balance || object.category || object.scopeStatus || "当前场景对象";
    return `<section data-screen-label="Objective 隔离模拟"><section class="m08-simulation-question"><div><span class="m08-kicker">SIMULATION USE CASE · ${esc(objective.objectiveId)}</span><h2>验证一个明确的压力问题</h2><p>如果利率、信用利差和流动性同时承压，${esc(input.objectRef?.title)}所在组合会怎样？</p></div><button class="m08-btn primary" data-action="run-simulation" ${state.caseLoading ? "disabled" : ""}>${icon(state.caseLoading ? "clock" : "play")}${state.caseLoading ? "正在运行" : result && !stale ? "重新运行" : "运行当前情景"}</button></section><div class="m08-case-workspace"><aside class="m08-input-rail"><header><span class="m08-kicker">固定输入</span><h3>本次 Run 对应什么</h3></header><label><span>业务对象</span><select data-case-object ${lockedToHandoff ? "disabled" : ""}>${study.m07.objects.map((item) => `<option value="${esc(item.id)}" ${item.id === state.caseObjectId ? "selected" : ""}>${esc(item.name)} · ${esc(item.relation)}</option>`).join("")}</select></label><label><span>观察窗口</span><select data-case-range ${lockedToHandoff ? "disabled" : ""}>${rangeOptions}</select></label><section><span>ObjectRef</span><strong>${esc(input.objectRef?.title)}</strong><small>${esc(input.objectRef?.id)} · ${esc(objectDetail)}</small></section><dl><div><dt>Objective</dt><dd>${esc(input.objectiveRevisionId)}</dd></div><div><dt>Binding</dt><dd>${esc(input.bindingRevisionId)}</dd></div><div><dt>Model</dt><dd>${esc(input.modelVersionId)}</dd></div><div><dt>数据</dt><dd>${esc(input.dataVersionId)}</dd></div><div><dt>Ontology</dt><dd>${esc(input.ontologyVersionId)}</dd></div></dl><button class="m08-btn secondary m08-wide" data-route-module="m07">调整探索上下文</button></aside><main class="m08-simulation-main"><header><div><span class="m08-kicker">CASE / PARAMETER / GRAPH</span><h3>配置并运行隔离模拟</h3></div>${result ? badge(stale ? "输入已变化" : "运行完成", stale ? "warning" : "success") : badge("等待运行", "info")}</header><div class="m08-case-select"><label>压力情景<select data-case-id>${study.m08.cases.map((item) => `<option value="${esc(item.id)}" ${item.id === state.caseCaseId ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label><div><span>本次参数</span><strong>${esc(caseDef.params)}</strong></div></div><div class="m08-model-graph"><span><b>固定基线</b><small>${esc(input.asOf)}</small></span>${icon("arrow")}<span><b>市场冲击</b><small>利率 / 利差 / 流动性</small></span>${icon("arrow")}<span><b>评价模型</b><small>${esc(input.modelVersionId)}</small></span></div>${result ? `${stale ? `<div class="m08-stale">${icon("alert")}当前输入已变化；以下结果仍对应上一次 Run，重新运行后才会更新。</div>` : ""}<div class="m08-sim-metrics"><div><span>模拟评价分数</span><strong>${output?.score?.toFixed?.(4) || "—"}</strong><small>覆盖率 ${((output?.coverage || 0) * 100).toFixed(0)}%</small></div><div><span>当前对象影响</span><strong class="negative">${focused ? `${(focused.valueImpactCny / 1000000).toFixed(2)} 百万元` : "—"}</strong><small>${esc(result.inputManifest.objectRef?.title)}</small></div><div><span>组合价值影响</span><strong class="negative">${(totalImpact / 1000000).toFixed(2)} 百万元</strong><small>模拟结果，不写事实</small></div><div><span>运行状态</span><strong>${esc(simulation.status)}</strong><small>外部副作用 0 次</small></div></div><details class="m08-result-envelope"><summary>${icon("file")}查看完整运行证据</summary><dl><div><dt>Simulation Run</dt><dd>${esc(simulation.simulationRunId)}</dd></div><div><dt>Result</dt><dd>${esc(simulation.result?.simulationResultId)}</dd></div><div><dt>Baseline</dt><dd>${esc(simulation.baselineId)}</dd></div><div><dt>Parameter Set</dt><dd>${esc(simulation.parameterSetId)}</dd></div><div><dt>Graph</dt><dd>${esc(simulation.graphId)}</dd></div><div><dt>Result Kind</dt><dd>SIMULATION</dd></div></dl></details><div class="m08-result-actions"><button class="m08-btn secondary" data-action="run-simulation">${icon("refresh")}重新运行</button><button class="m08-btn primary" data-action="return-exploration" ${stale ? "disabled" : ""}>返回探索分析${icon("arrow")}</button></div>` : `<div class="m08-run-ready"><span>${icon("flask")}</span><h3>输入和情景已准备</h3><p>运行后形成独立 Simulation Result，并保留 Objective、Binding、Model、数据和证据。</p><button class="m08-btn primary" data-action="run-simulation">${icon("play")}运行当前情景</button></div>`}</main></div></section>`;
  }

  function loadingView(label = "正在加载 Modeling Objectives") {
    return `<div class="m08-loading">${icon("refresh")}<strong>${esc(label)}</strong></div>`;
  }

  function noObjectiveView() {
    const scenarioId = activeScenarioId() || "当前场景";
    return `<section class="m08-panel" data-screen-label="Objective 不可用"><div class="m08-use-mode-empty"><span>${icon("alert")}</span><h3>${esc(scenarioId)} 暂无可用建模目标</h3><p>当前场景未注册兼容的 Modeling Objective。</p><button class="m08-btn primary" data-section="catalog">返回目标目录</button></div></section>`;
  }

  function render() {
    const body = state.loading && !state.catalog.length ? loadingView() : state.section === "catalog" ? catalogView() : !state.objective ? noObjectiveView() : state.section === "objective" ? objectiveView() : state.section === "contracts" ? contractsView() : state.section === "candidates" ? candidatesView() : state.section === "binding" ? bindingView() : state.section === "consumption" ? consumptionView() : simulationCaseView();
    root.innerHTML = `<div class="m08-content" data-screen-label="M08 Objective-first 模型与模拟">${shellHead()}${workspaceNav()}${state.section === "catalog" ? "" : objectiveSummary()}${body}${state.error ? `<div class="m08-error">${esc(state.error.code)} · ${esc(state.error.message)}</div>` : ""}</div>`;
  }

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest?.("[data-route-module]");
    if (routeButton) { route(routeButton.dataset.routeModule); return; }
    const sectionButton = event.target.closest?.("[data-section]");
    if (sectionButton) { setSection(sectionButton.dataset.section); if (sectionButton.dataset.section === "consumption" && !state.consumerProjection) loadConsumerProjection(state.consumerId); return; }
    const objectiveButton = event.target.closest?.("[data-objective-id]");
    if (objectiveButton) { selectObjective(objectiveButton.dataset.objectiveId); return; }
    const consumerButton = event.target.closest?.("[data-consumer-id]");
    if (consumerButton) { loadConsumerProjection(consumerButton.dataset.consumerId); return; }
    const action = event.target.closest?.("[data-action]")?.dataset.action;
    if (action === "validate-binding") validateCurrentBinding();
    if (action === "run-simulation") runCaseStudy();
    if (action === "return-exploration") returnToExploration();
  });

  document.addEventListener("input", (event) => {
    if (!event.target.matches?.("[data-objective-search]")) return;
    state.catalogSearch = event.target.value;
    render();
    requestAnimationFrame(() => root.querySelector("[data-objective-search]")?.focus());
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches?.("[data-mobile-section]")) { setSection(event.target.value); if (event.target.value === "consumption") loadConsumerProjection(state.consumerId); return; }
    if (event.target.matches?.("[data-kind-filter]")) { state.kindFilter = event.target.value; render(); return; }
    if (event.target.matches?.("[data-case-object]")) { state.caseObjectId = event.target.value; saveSession(); render(); return; }
    if (event.target.matches?.("[data-case-range]")) { state.caseRange = event.target.value; saveSession(); render(); return; }
    if (event.target.matches?.("[data-case-id]")) { state.caseCaseId = event.target.value; saveSession(); render(); }
  });

  window.addEventListener("hashchange", () => {
    const next = location.hash.replace(/^#/, "");
    if (SECTIONS.includes(next) && next !== state.section) { state.section = next; render(); }
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || event.source !== global.parent) return;
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
    resolveExplorationHandoff(state.context?.explorationHandoff);
    render();
  });

  render();
  health();
  loadCatalog();
})(window);
