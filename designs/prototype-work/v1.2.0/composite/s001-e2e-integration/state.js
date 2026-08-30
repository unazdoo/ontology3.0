(function installCompositeState(global) {
  "use strict";

  const DATA = global.OFW_V120_DATA;
  const STORAGE_KEY = "ofw.prototype.v1.2.0.composite.state.v1";
  const HANDOFF_KEY = "ofw.prototype.v1.2.0.composite.handoff.v1";
  const SCENARIO_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function readJson(storage, key) {
    try {
      const value = JSON.parse(storage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function requestedScenarioId() {
    try {
      const id = new URLSearchParams(global.location.search).get("scenarioId");
      return DATA.scenarioById[id] ? id : null;
    } catch (_) {
      return null;
    }
  }

  function createS005Context(previousFormedAt = null) {
    const adapter = global.OFWS005ScenarioAdapter;
    const candidate = adapter?.createScenarioContext?.({ now: new Date(Math.max(Date.now(), Date.parse(previousFormedAt || "") + 1 || 0)) });
    if (candidate) return clone(candidate);
    const formedAt = new Date(Math.max(Date.now(), Date.parse(previousFormedAt || "") + 1 || 0)).toISOString();
    const compact = formedAt.replace(/[-:.TZ]/g, "");
    const entropy = global.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12) || Math.random().toString(16).slice(2, 14).padEnd(12, "0");
    return { scenarioId: "S005", scenarioVersion: "S005-v1", scenarioRunId: `S005-RUN-${compact}-${entropy}`, formedAt, status: "active" };
  }

  function archivedContext(definition) {
    return {
      scenarioId: definition.id,
      scenarioVersion: definition.scenarioVersion,
      scenarioRunId: definition.scenarioRunId,
      formedAt: definition.formedAt,
      status: "completed"
    };
  }

  function initialStages() {
    const workflow = global.OFWS005ScenarioConfig?.workflow || [];
    return Object.fromEntries(workflow.map((step) => [step.id, {
      stageId: step.id,
      moduleId: step.moduleId,
      title: step.title,
      status: "pending",
      evidence: null,
      updatedAt: null
    }]));
  }

  function initialScenarioState(definition) {
    return {
      scenarioId: definition.id,
      archived: Boolean(definition.archived),
      scenarioContext: definition.id === "S005" ? createS005Context() : archivedContext(definition),
      runHistory: [],
      stages: definition.id === "S005" ? initialStages() : {},
      navigation: {
        lastRoute: "#home",
        returnRoute: null,
        framePositions: {},
        selectedResources: {},
        homeScrollTop: 0
      }
    };
  }

  function createInitialState() {
    return {
      schemaVersion: 1,
      revision: 0,
      activeScenarioId: requestedScenarioId() || DATA.scenarios.find((item) => item.default)?.id || "S005",
      navCollapsed: global.matchMedia?.("(max-width: 980px)")?.matches || false,
      scenarios: Object.fromEntries(DATA.scenarios.map((definition) => [definition.id, initialScenarioState(definition)]))
    };
  }

  function validContext(value, definition) {
    if (!value || typeof value !== "object") return false;
    if (!SCENARIO_FIELDS.every((field) => String(value[field] ?? "").trim())) return false;
    if (value.scenarioId !== definition.id || value.scenarioVersion !== definition.scenarioVersion) return false;
    if (Number.isNaN(Date.parse(value.formedAt))) return false;
    if (definition.id === "S005") return Boolean(global.OFWS005ScenarioAdapter?.validateScenarioContext?.(value)?.ok);
    return value.scenarioRunId === definition.scenarioRunId;
  }

  function hydrateScenario(definition, saved) {
    const initial = initialScenarioState(definition);
    if (!saved || typeof saved !== "object") return initial;
    const context = validContext(saved.scenarioContext, definition) ? clone(saved.scenarioContext) : initial.scenarioContext;
    return {
      ...initial,
      ...clone(saved),
      scenarioId: definition.id,
      archived: Boolean(definition.archived),
      scenarioContext: context,
      runHistory: Array.isArray(saved.runHistory) ? clone(saved.runHistory) : [],
      stages: definition.id === "S005" ? { ...initial.stages, ...(clone(saved.stages) || {}) } : {},
      navigation: {
        ...initial.navigation,
        ...(clone(saved.navigation) || {}),
        framePositions: { ...(clone(saved.navigation?.framePositions) || {}) },
        selectedResources: { ...(clone(saved.navigation?.selectedResources) || {}) }
      }
    };
  }

  function loadState() {
    const saved = readJson(global.localStorage, STORAGE_KEY);
    const initial = createInitialState();
    if (!saved || saved.schemaVersion !== 1) return initial;
    const requested = requestedScenarioId();
    const activeScenarioId = requested || (DATA.scenarioById[saved.activeScenarioId] ? saved.activeScenarioId : initial.activeScenarioId);
    return {
      ...initial,
      revision: Math.max(0, Number(saved.revision) || 0),
      activeScenarioId,
      navCollapsed: typeof saved.navCollapsed === "boolean" ? saved.navCollapsed : initial.navCollapsed,
      scenarios: Object.fromEntries(DATA.scenarios.map((definition) => [definition.id, hydrateScenario(definition, saved.scenarios?.[definition.id])]))
    };
  }

  let state = loadState();
  let handoffs = readJson(global.sessionStorage, HANDOFF_KEY) || {};

  function persist(notify = true, reason = "state") {
    state.revision += 1;
    writeJson(global.localStorage, STORAGE_KEY, state);
    if (notify) global.dispatchEvent(new CustomEvent("ofw:v120-state", { detail: { reason, state: snapshot() } }));
    return snapshot();
  }

  function persistHandoffs() {
    writeJson(global.sessionStorage, HANDOFF_KEY, handoffs);
  }

  function snapshot() {
    return clone(state);
  }

  function activeScenario() {
    return clone(state.scenarios[state.activeScenarioId]);
  }

  function scenario(scenarioId = state.activeScenarioId) {
    return clone(state.scenarios[scenarioId] || null);
  }

  function scenarioContext(scenarioId = state.activeScenarioId) {
    return clone(state.scenarios[scenarioId]?.scenarioContext || null);
  }

  function setActiveScenario(scenarioId, reason = "resource") {
    if (!DATA.scenarioById[scenarioId]) throw new Error(`场景 ${scenarioId || "未提供"} 未注册。`);
    if (state.activeScenarioId === scenarioId) return activeScenario();
    state.activeScenarioId = scenarioId;
    persist(true, reason);
    return activeScenario();
  }

  function toggleNavigation() {
    state.navCollapsed = !state.navCollapsed;
    return persist(true, "navigation");
  }

  function saveNavigation(patch, scenarioId = state.activeScenarioId) {
    const target = state.scenarios[scenarioId];
    if (!target) return null;
    target.navigation = { ...target.navigation, ...clone(patch) };
    persist(false, "navigation");
    return clone(target.navigation);
  }

  function saveFramePosition(moduleId, position, scenarioId = state.activeScenarioId) {
    const target = state.scenarios[scenarioId];
    if (!target) return null;
    target.navigation.framePositions[moduleId] = { ...clone(position), scenarioId };
    persist(false, "frame");
    return clone(target.navigation.framePositions[moduleId]);
  }

  function selectResource(moduleId, resourceId, scenarioId) {
    const targetScenarioId = scenarioId || state.activeScenarioId;
    if (!state.scenarios[targetScenarioId]) throw new Error(`场景 ${targetScenarioId} 未注册。`);
    state.activeScenarioId = targetScenarioId;
    state.scenarios[targetScenarioId].navigation.selectedResources[moduleId] = resourceId;
    persist(true, "resource");
    return activeScenario();
  }

  function selectedResource(moduleId, scenarioId = state.activeScenarioId) {
    return state.scenarios[scenarioId]?.navigation.selectedResources?.[moduleId] || null;
  }

  function resetBrowsingContext(scenarioId = state.activeScenarioId) {
    const target = state.scenarios[scenarioId];
    if (!target) return null;
    target.navigation = { ...target.navigation, lastRoute: "#home", returnRoute: null, framePositions: {}, homeScrollTop: 0 };
    persist(true, "browse-reset");
    return { scope: `current ${scenarioId} browsing context only`, scenarioId, preservedHistoricalRuns: target.runHistory.length };
  }

  function resetCurrentScenario(scenarioId = state.activeScenarioId) {
    const target = state.scenarios[scenarioId];
    const definition = DATA.scenarioById[scenarioId];
    if (!target || !definition) throw new Error(`场景 ${scenarioId || "未提供"} 未注册。`);
    if (definition.archived) {
      return { scope: "archived scenario protected", scenarioId, scenarioRunId: target.scenarioContext.scenarioRunId, changed: false, preservedHistoricalRuns: target.runHistory.length };
    }
    const previous = clone(target);
    const nextContext = createS005Context(previous.scenarioContext.formedAt);
    target.runHistory.push({
      scenarioContext: clone(previous.scenarioContext),
      stages: clone(previous.stages),
      archivedAt: nextContext.formedAt,
      reason: "当前场景运行重置前封存"
    });
    target.scenarioContext = nextContext;
    target.stages = initialStages();
    target.navigation = { ...target.navigation, lastRoute: "#home", returnRoute: null, framePositions: {}, selectedResources: {}, homeScrollTop: 0 };
    delete handoffs[previous.scenarioContext.scenarioRunId];
    persistHandoffs();
    persist(true, "scenario-reset");
    return {
      scope: "current S005 scenario run only",
      previousScenarioRunId: previous.scenarioContext.scenarioRunId,
      scenarioRunId: nextContext.scenarioRunId,
      preservedHistoricalRuns: target.runHistory.length,
      touchedScenarios: ["S005"],
      externalSideEffects: 0,
      changed: true
    };
  }

  function saveM07Handoff(value) {
    const context = scenarioContext();
    if (!context || value?.scenarioRunId !== context.scenarioRunId) throw new Error("M07 交接轮次与当前场景不一致。");
    handoffs[context.scenarioRunId] = {
      ...clone(handoffs[context.scenarioRunId] || {}),
      scenarioContext: context,
      m07: clone(value),
      savedAt: new Date().toISOString()
    };
    persistHandoffs();
    return clone(handoffs[context.scenarioRunId]);
  }

  function saveM08Return(value) {
    const context = scenarioContext();
    if (!context || value?.scenarioRunId !== context.scenarioRunId) throw new Error("M08 返回轮次与当前场景不一致。");
    const current = handoffs[context.scenarioRunId] || { scenarioContext: context };
    handoffs[context.scenarioRunId] = { ...clone(current), m08Return: clone(value), returnedAt: new Date().toISOString() };
    persistHandoffs();
    return clone(handoffs[context.scenarioRunId]);
  }

  function handoff(scenarioRunId = scenarioContext()?.scenarioRunId) {
    return clone(handoffs[scenarioRunId] || null);
  }

  function updateS005Stage(stageId, status, evidence = null) {
    const target = state.scenarios.S005;
    const stage = target?.stages?.[stageId];
    if (!stage) throw new Error(`未知 S005 阶段：${stageId}`);
    const allowed = new Set(["pending", "running", "complete", "verified", "not_applicable", "blocked"]);
    if (!allowed.has(status)) throw new Error(`不支持的阶段状态：${status}`);
    stage.status = status;
    stage.evidence = evidence ? clone(evidence) : null;
    stage.updatedAt = new Date().toISOString();
    persist(true, "stage");
    return clone(stage);
  }

  function s005Progress() {
    const stages = Object.values(state.scenarios.S005?.stages || {});
    const done = stages.filter((stage) => ["complete", "verified", "not_applicable"].includes(stage.status)).length;
    return { done, total: stages.length, active: stages.filter((stage) => stage.status === "running").length, blocked: stages.filter((stage) => stage.status === "blocked").length };
  }

  persist(false, "hydrate");

  global.OFW_V120_STORE = Object.freeze({
    STORAGE_KEY,
    HANDOFF_KEY,
    get: snapshot,
    activeScenario,
    scenario,
    scenarioContext,
    setActiveScenario,
    toggleNavigation,
    saveNavigation,
    saveFramePosition,
    selectResource,
    selectedResource,
    resetBrowsingContext,
    resetCurrentScenario,
    saveM07Handoff,
    saveM08Return,
    handoff,
    updateS005Stage,
    s005Progress
  });
})(window);
