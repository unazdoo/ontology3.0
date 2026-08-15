(function () {
  "use strict";

  const STORAGE_KEY = "ontology.financial-world.s001.integration.v2";
  const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1";
  const SCENARIO_CONTEXT_KEY = `${HANDOFF_CHANNEL}:scenario-context`;
  const SCENARIO_RESET_REQUEST_KEY = `${HANDOFF_CHANNEL}:scenario-reset-request`;
  const SCENARIO_CONTEXT_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
  const MODULE_STORAGE_KEYS = [
    "ontology-management-product-state-v1",
    "ontology3-canvas-first-review-v16",
    "ontology3-canvas-first-review-v17",
    "ontology3.data-engineering.workspace.v5-handoff",
    "ontology3.intelligent-query.workspace.v1",
    "ontology3.iq.review.conversation.v1",
    "ontology3.c017.intelligent-query.projection.v1",
    "ontology3.c017.decision-center.projection.v1",
    "ontology3.iq.review.identity-counter.v1",
    "ontology3-decision-center-state-v1",
    "ontology3-decision-center-review-v2-portfolio-state-v6",
    "ontology3.agent-application.catalog.v7",
    "ontology3.agent-application.catalog.v8",
    "ontology3.report-center.lifecycle-review.v1",
    "ontology3.agent-application.owner-records.v1",
    "ontology3.decision-center.owner-records.v1"
  ];

  const SOURCE_KEYS = {
    data: "ontology3.data-engineering.workspace.v5-handoff",
    ontology: "ontology3-canvas-first-review-v17",
    query: "ontology3.iq.review.conversation.v1",
    decision: "ontology3-decision-center-review-v2-portfolio-state-v6",
    agentV7: "ontology3.agent-application.catalog.v7",
    agentV8: "ontology3.agent-application.catalog.v8",
    agentOwner: "ontology3.agent-application.owner-records.v1",
    report: "ontology3.report-center.lifecycle-review.v1"
  };

  function nowLabel() {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(new Date()).replaceAll("/", "-");
  }

  function nextIsoTimestamp(previous = null) {
    const previousTime = Date.parse(previous || "");
    const nextTime = Number.isFinite(previousTime) ? Math.max(Date.now(), previousTime + 1) : Date.now();
    return new Date(nextTime).toISOString();
  }

  function scenarioRunId(scenarioId, formedAt) {
    const compactTime = formedAt.replace(/[-:.TZ]/g, "");
    const entropy = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12)
      || `${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 8)}`;
    return `${scenarioId}-RUN-${compactTime}-${entropy}`;
  }

  function createScenarioContext(scenario, previousFormedAt = null) {
    const formedAt = nextIsoTimestamp(previousFormedAt);
    return {
      scenarioId: scenario.id,
      scenarioVersion: scenario.scenarioVersion || scenario.version || `${scenario.id}-v1`,
      scenarioRunId: scenarioRunId(scenario.id, formedAt),
      formedAt,
      status: scenario.status || "active"
    };
  }

  function normalizedScenarioContext(value, scenario) {
    if (!value || typeof value !== "object") return null;
    const context = Object.fromEntries(SCENARIO_CONTEXT_FIELDS.map((field) => [field, String(value[field] ?? "").trim()]));
    if (SCENARIO_CONTEXT_FIELDS.some((field) => !context[field])) return null;
    if (context.scenarioId !== scenario.id) return null;
    if (context.scenarioVersion !== (scenario.scenarioVersion || scenario.version || `${scenario.id}-v1`)) return null;
    if (Number.isNaN(Date.parse(context.formedAt))) return null;
    if (/\u6210\u529f|\u5b8c\u6210|\u5c31\u7eea|\u91c7\u7528/.test(context.status)) return null;
    if (/(?:\u505c\u7528|\u672a\u77e5|\u65e0\u6548|\u5df2\u7ed3\u675f|inactive|unknown|disabled)/i.test(context.status)) return null;
    return context;
  }

  function sameScenarioContext(left, right) {
    return Boolean(left && right && SCENARIO_CONTEXT_FIELDS.every((field) => String(left[field] ?? "") === String(right[field] ?? "")));
  }

  function enabledScenarios() {
    const registry = Array.isArray(window.S001_DATA.scenarioRegistry)
      ? window.S001_DATA.scenarioRegistry
      : [window.S001_DATA.scenario];
    return registry.filter((scenario) => scenario?.id && scenario.enabled !== false);
  }

  function defaultScenarioId() {
    return enabledScenarios()[0]?.id || window.S001_DATA.scenario.id;
  }

  function scenarioDefinition(scenarioId) {
    return window.S001_DATA.scenarioById?.[scenarioId]
      || enabledScenarios().find((scenario) => scenario.id === scenarioId)
      || null;
  }

  function createScenarioState(scenarioId, options = {}) {
    const scenario = scenarioDefinition(scenarioId) || window.S001_DATA.scenario;
    const scenarioContext = createScenarioContext(scenario, options.previousFormedAt || null);
    return {
      scenarioId: scenario.id,
      scenarioContext,
      scenarioRunHistory: [],
      context: {
        organization: scenario.organization || "集团融资板块",
        selectedEntities: [...(scenario.selectedEntities || ["553", "465", "561"])],
        dataAsOf: scenario.dataAsOf
      },
      homeDomain: "foundation",
      homeOrbitTurn: 0,
      framePositions: {},
      navigation: {
        lastRoute: "#home",
        returnRoute: null,
        homeScrollTop: 0,
        moduleContexts: {}
      },
      resetAt: scenarioContext.formedAt,
      lastReadAt: null
    };
  }

  function createInitialState() {
    const activeScenarioId = defaultScenarioId();
    return {
      schemaVersion: 3,
      revision: 0,
      activeScenarioId,
      navCollapsed: false,
      scenarios: Object.fromEntries(enabledScenarios().map((scenario) => [scenario.id, createScenarioState(scenario.id)]))
    };
  }

  function hydrateScenarioState(scenarioId, saved = {}) {
    const initial = createScenarioState(scenarioId);
    const definition = scenarioDefinition(scenarioId) || window.S001_DATA.scenario;
    const scenarioContext = normalizedScenarioContext(saved.scenarioContext, definition) || initial.scenarioContext;
    return {
      ...initial,
      ...saved,
      scenarioId,
      scenarioContext,
      scenarioRunHistory: list(saved.scenarioRunHistory).map((record) => ({ ...record })),
      context: {
        ...initial.context,
        dataAsOf: saved.context?.dataAsOf || initial.context.dataAsOf
      },
      homeDomain: ["foundation", "intelligence", "action"].includes(saved.homeDomain) ? saved.homeDomain : initial.homeDomain,
      homeOrbitTurn: Number.isFinite(Number(saved.homeOrbitTurn)) ? Math.max(0, Math.trunc(Number(saved.homeOrbitTurn))) : initial.homeOrbitTurn,
      framePositions: { ...(saved.framePositions || {}) },
      navigation: {
        ...initial.navigation,
        ...(saved.navigation || {}),
        moduleContexts: { ...(saved.navigation?.moduleContexts || {}) }
      }
    };
  }

  function readStoredNavigationState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && typeof saved === "object" ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function loadNavigationState(saved = readStoredNavigationState()) {
    try {
      if (!saved || ![2, 3].includes(saved.schemaVersion)) {
        const initial = createInitialState();
        initial.navCollapsed = localStorage.getItem("ontology3-home-sidebar") === "collapsed";
        return initial;
      }
      const initial = createInitialState();
      if (saved.schemaVersion === 2) {
        const scenarioId = defaultScenarioId();
        initial.navCollapsed = typeof saved.navCollapsed === "boolean"
          ? saved.navCollapsed
          : localStorage.getItem("ontology3-home-sidebar") === "collapsed";
        initial.scenarios[scenarioId] = hydrateScenarioState(scenarioId, {
          context: saved.context,
          homeDomain: saved.homeDomain,
          framePositions: saved.framePositions,
          navigation: saved.navigation,
          resetAt: saved.resetAt,
          lastReadAt: saved.lastReadAt
        });
        return initial;
      }
      const allowedIds = new Set(enabledScenarios().map((scenario) => scenario.id));
      const requestedActive = allowedIds.has(saved.activeScenarioId) ? saved.activeScenarioId : initial.activeScenarioId;
      return {
        schemaVersion: 3,
        revision: Math.max(0, Math.trunc(Number(saved.revision) || 0)),
        activeScenarioId: requestedActive,
        navCollapsed: typeof saved.navCollapsed === "boolean"
          ? saved.navCollapsed
          : localStorage.getItem("ontology3-home-sidebar") === "collapsed",
        scenarios: Object.fromEntries(enabledScenarios().map((scenario) => [
          scenario.id,
          hydrateScenarioState(scenario.id, saved.scenarios?.[scenario.id] || {})
        ]))
      };
    } catch (_) {
      const initial = createInitialState();
      try { initial.navCollapsed = localStorage.getItem("ontology3-home-sidebar") === "collapsed"; } catch (_) {}
      return initial;
    }
  }

  let state = loadNavigationState();
  const projectionByScenario = new Map();

  function scenarioContextTime(context) {
    const normalized = context && typeof context === "object" ? Date.parse(context.formedAt || "") : Number.NaN;
    return Number.isFinite(normalized) ? normalized : Number.NEGATIVE_INFINITY;
  }

  function newestScenarioContext(...candidates) {
    return candidates.filter(Boolean).reduce((newest, candidate) => {
      if (!newest) return candidate;
      const candidateTime = scenarioContextTime(candidate);
      const newestTime = scenarioContextTime(newest);
      if (candidateTime > newestTime) return candidate;
      if (candidateTime < newestTime) return newest;
      return sameScenarioContext(candidate, newest) ? newest : newest;
    }, null);
  }

  function readSharedScenarioContext(scenarioId) {
    try {
      const value = JSON.parse(localStorage.getItem(SCENARIO_CONTEXT_KEY));
      const definition = scenarioDefinition(scenarioId);
      const normalized = definition ? normalizedScenarioContext(value, definition) : null;
      return normalized?.scenarioId === scenarioId ? normalized : null;
    } catch (_) {
      return null;
    }
  }

  function refreshStateFromStorage() {
    const saved = readStoredNavigationState();
    if (!saved || ![2, 3].includes(saved.schemaVersion)) return false;
    const storedRevision = Math.max(0, Math.trunc(Number(saved.revision) || 0));
    const localRevision = Math.max(0, Math.trunc(Number(state.revision) || 0));
    const storedContexts = saved.schemaVersion === 3 ? saved.scenarios || {} : {};
    const hasNewerContext = enabledScenarios().some((scenario) => {
      const storedContext = normalizedScenarioContext(storedContexts[scenario.id]?.scenarioContext, scenario);
      return scenarioContextTime(storedContext) > scenarioContextTime(state.scenarios?.[scenario.id]?.scenarioContext);
    });
    if (storedRevision <= localRevision && !hasNewerContext) return false;
    const previousState = state;
    const hydrated = loadNavigationState(saved);
    enabledScenarios().forEach((scenario) => {
      const localContext = normalizedScenarioContext(previousState.scenarios?.[scenario.id]?.scenarioContext, scenario);
      const storedContext = normalizedScenarioContext(hydrated.scenarios?.[scenario.id]?.scenarioContext, scenario);
      const sharedContext = readSharedScenarioContext(scenario.id);
      const authoritative = newestScenarioContext(localContext, storedContext, sharedContext);
      const localIsNewer = scenarioContextTime(localContext) > scenarioContextTime(storedContext);
      if (localIsNewer && previousState.scenarios?.[scenario.id]) {
        hydrated.scenarios[scenario.id] = { ...previousState.scenarios[scenario.id] };
      }
      if (authoritative && hydrated.scenarios?.[scenario.id]) hydrated.scenarios[scenario.id].scenarioContext = { ...authoritative };
    });
    hydrated.revision = Math.max(localRevision, storedRevision);
    state = hydrated;
    projectionByScenario.clear();
    return true;
  }

  function activeScenarioState() {
    return state.scenarios[state.activeScenarioId] || state.scenarios[defaultScenarioId()];
  }

  function compatibleStateView() {
    return {
      ...activeScenarioState(),
      schemaVersion: state.schemaVersion,
      revision: state.revision,
      activeScenarioId: state.activeScenarioId,
      navCollapsed: state.navCollapsed,
      scenarios: state.scenarios
    };
  }

  function scenarioContextFor(scenarioId = state.activeScenarioId) {
    const scenarioState = state.scenarios[scenarioId];
    const definition = scenarioDefinition(scenarioId);
    if (!scenarioState || !definition) return null;
    const current = normalizedScenarioContext(scenarioState.scenarioContext, definition);
    if (current) return current;
    scenarioState.scenarioContext = createScenarioContext(definition, scenarioState.scenarioContext?.formedAt || null);
    return { ...scenarioState.scenarioContext };
  }

  function scenarioContextEnvelope(scenarioId = state.activeScenarioId) {
    const scenarioContext = scenarioContextFor(scenarioId);
    if (!scenarioContext) return null;
    return {
      sourceModule: "平台公共层",
      contractCode: "C033",
      contextId: `C033-${scenarioContext.scenarioId}-${scenarioContext.scenarioRunId}`,
      deliveredAt: scenarioContext.formedAt,
      evidenceLocator: `统一平台 / 场景工作区 / ${scenarioContext.scenarioId} / ${scenarioContext.scenarioRunId}`,
      scenarioContext: { ...scenarioContext }
    };
  }

  function publishScenarioContext(scenarioId = state.activeScenarioId, notify = true) {
    refreshStateFromStorage();
    const localContext = scenarioContextFor(scenarioId);
    const sharedContext = readSharedScenarioContext(scenarioId);
    const scenarioContext = newestScenarioContext(localContext, sharedContext);
    if (!scenarioContext) return null;
    if (!sameScenarioContext(localContext, scenarioContext) && state.scenarios[scenarioId]) {
      state.scenarios[scenarioId].scenarioContext = { ...scenarioContext };
    }
    const serialized = JSON.stringify(scenarioContext);
    try {
      if (localStorage.getItem(SCENARIO_CONTEXT_KEY) !== serialized) localStorage.setItem(SCENARIO_CONTEXT_KEY, serialized);
    } catch (_) {}
    if (notify) window.dispatchEvent(new CustomEvent("s001:scenario-context", { detail: { ...scenarioContext } }));
    return { ...scenarioContext };
  }

  function readScenarioContext(scenarioId = state.activeScenarioId) {
    return publishScenarioContext(scenarioId, false);
  }

  function persist(notify = true) {
    const saved = readStoredNavigationState();
    const storedRevision = Math.max(0, Math.trunc(Number(saved?.revision) || 0));
    enabledScenarios().forEach((scenario) => {
      const localContext = normalizedScenarioContext(state.scenarios?.[scenario.id]?.scenarioContext, scenario);
      const sharedContext = readSharedScenarioContext(scenario.id);
      const authoritative = newestScenarioContext(localContext, sharedContext);
      if (authoritative && state.scenarios?.[scenario.id]) state.scenarios[scenario.id].scenarioContext = { ...authoritative };
    });
    state.revision = Math.max(Math.max(0, Math.trunc(Number(state.revision) || 0)), storedRevision) + 1;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    if (notify) window.dispatchEvent(new CustomEvent("s001:state", { detail: compatibleStateView() }));
    return state;
  }

  function readJson(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function readNewestJson(localKey, sessionKey = localKey) {
    const localValue = readJson(localKey);
    let sessionValue = null;
    try {
      const parsed = JSON.parse(sessionStorage.getItem(sessionKey));
      sessionValue = parsed && typeof parsed === "object" ? parsed : null;
    } catch (_) {}
    return [localValue, sessionValue]
      .filter(Boolean)
      .sort((left, right) => Number(right.savedAtMs || 0) - Number(left.savedAtMs || 0))[0] || null;
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function idList(values) {
    return values.filter(Boolean).map(String);
  }

  function canonicalScenarioId(record) {
    if (!record || typeof record !== "object") return null;
    const candidates = [
      record.scenarioId,
      record.sceneId,
      record.sourceScene,
      record.currentScenario,
      record.scenarioContext?.scenarioId,
      record.scenarioContext?.id,
      record.context?.scenarioId,
      record.contextIdentity?.scenarioId,
      record.snapshot?.scenarioId,
      record.snapshot?.requestContext?.scenarioId,
      record.requestContext?.scenarioId,
      record.fixedContextRef?.scenarioId,
      record.payload?.scenarioId,
      record.payload?.sceneId,
      record.payload?.sourceScene
    ];
    const value = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
    return value ? value.trim() : null;
  }

  function sourceScopeMeta(moduleId, scenarioId, raw, options = {}) {
    if (!raw) {
      return {
        moduleId,
        scenarioId,
        status: "absent",
        rootScenarioId: null,
        totalRecords: 0,
        matchedRecords: 0,
        unscopedRecords: 0,
        mismatchedRecords: 0,
        reason: "当前未读取到模块保存状态。"
      };
    }
    const rootScenarioId = options.rootScenarioId ?? canonicalScenarioId(raw);
    const matchedRecords = Number(options.matchedRecords || 0);
    const unscopedRecords = Number(options.unscopedRecords || 0);
    const mismatchedRecords = Number(options.mismatchedRecords || 0);
    const totalRecords = Number(options.totalRecords ?? matchedRecords + unscopedRecords + mismatchedRecords);
    const scoped = Object.prototype.hasOwnProperty.call(options, "scoped")
      ? options.scoped === true
      : rootScenarioId === scenarioId || matchedRecords > 0;
    const status = scoped ? "scoped" : rootScenarioId && rootScenarioId !== scenarioId || mismatchedRecords > 0 ? "mismatch" : "unscoped";
    const reason = status === "scoped"
      ? options.reason || "仅纳入场景身份与当前工作区一致的模块记录。"
      : status === "mismatch"
        ? "模块状态属于其他场景，未进入当前首页摘要和链路进度。"
        : "模块状态缺少规范场景身份，未进入当前首页摘要和链路进度。";
    return {
      moduleId,
      scenarioId,
      status,
      rootScenarioId,
      totalRecords,
      matchedRecords,
      unscopedRecords,
      mismatchedRecords,
      excludedRecords: unscopedRecords + mismatchedRecords,
      reason
    };
  }

  function recordScopeCounts(records, scenarioId, identity = canonicalScenarioId) {
    return list(records).reduce((summary, record) => {
      const recordScenarioId = identity(record);
      if (recordScenarioId === scenarioId) summary.matched.push(record);
      else if (recordScenarioId) summary.mismatched.push(record);
      else summary.unscoped.push(record);
      return summary;
    }, { matched: [], unscoped: [], mismatched: [] });
  }

  function scopeRootState(moduleId, raw, scenarioId, recordCollections = []) {
    if (!raw) return { value: null, meta: sourceScopeMeta(moduleId, scenarioId, raw) };
    const rootScenarioId = canonicalScenarioId(raw);
    const records = recordCollections.flatMap((items) => list(items));
    const counts = recordScopeCounts(records, scenarioId);
    const scoped = rootScenarioId === scenarioId;
    return {
      value: scoped ? raw : null,
      meta: sourceScopeMeta(moduleId, scenarioId, raw, {
        rootScenarioId,
        scoped,
        totalRecords: records.length,
        matchedRecords: counts.matched.length,
        unscopedRecords: counts.unscoped.length,
        mismatchedRecords: counts.mismatched.length,
        reason: scoped ? "模块工作区根状态已固定到当前场景。" : undefined
      })
    };
  }

  function scopeDataState(raw, scenarioId, expectedContext) {
    if (!raw) return { value: null, meta: sourceScopeMeta("data", scenarioId, raw) };
    const rootScenarioId = canonicalScenarioId(raw);
    const records = [raw.uploadedSnapshots, raw.runs, raw.assetVersions].flatMap((items) => list(items));
    const counts = recordScopeCounts(records, scenarioId);
    const exactRound = sameScenarioContext(raw.scenarioContext, expectedContext);
    return {
      value: exactRound ? raw : null,
      meta: sourceScopeMeta("data", scenarioId, raw, {
        rootScenarioId,
        scoped: exactRound,
        totalRecords: records.length,
        matchedRecords: exactRound ? counts.matched.length : 0,
        unscopedRecords: counts.unscoped.length,
        mismatchedRecords: exactRound ? counts.mismatched.length : Math.max(1, records.length),
        reason: exactRound
          ? "数据工程工作区根状态与平台当前完整 C033 一致。"
          : "数据工程工作区属于同一场景的其他工作轮次，未进入当前首页摘要和链路进度。"
      })
    };
  }

  function scopeOntologyState(raw, scenarioId) {
    if (!raw) return { value: null, meta: sourceScopeMeta("ontology", scenarioId, raw) };
    const rootScenarioId = canonicalScenarioId(raw);
    if (rootScenarioId) return scopeRootState("ontology", raw, scenarioId, [raw.drafts, raw.publishedVersions]);
    const drafts = recordScopeCounts(raw.drafts, scenarioId);
    const versions = recordScopeCounts(raw.publishedVersions, scenarioId);
    const matchedIds = new Set(versions.matched.map((version) => version.id).filter(Boolean));
    const matchedRecords = drafts.matched.length + versions.matched.length;
    const unscopedRecords = drafts.unscoped.length + versions.unscoped.length;
    const mismatchedRecords = drafts.mismatched.length + versions.mismatched.length;
    if (!matchedRecords) {
      return {
        value: null,
        meta: sourceScopeMeta("ontology", scenarioId, raw, {
          totalRecords: matchedRecords + unscopedRecords + mismatchedRecords,
          matchedRecords,
          unscopedRecords,
          mismatchedRecords
        })
      };
    }
    const filterByVersion = (container) => Object.fromEntries(Object.entries(container || {}).filter(([versionId]) => matchedIds.has(versionId)));
    const currentByOntology = Object.fromEntries(Object.entries(raw.currentFormalVersionIdsByOntology || {}).filter(([, versionId]) => matchedIds.has(versionId)));
    return {
      value: {
        ...raw,
        drafts: drafts.matched,
        publishedVersions: versions.matched,
        updatesByVersion: filterByVersion(raw.updatesByVersion),
        bindingsByVersion: filterByVersion(raw.bindingsByVersion),
        recordsByVersion: filterByVersion(raw.recordsByVersion),
        currentFormalVersionIdsByOntology: currentByOntology,
        currentFormalVersionId: matchedIds.has(raw.currentFormalVersionId) ? raw.currentFormalVersionId : null
      },
      meta: sourceScopeMeta("ontology", scenarioId, raw, {
        scoped: true,
        totalRecords: matchedRecords + unscopedRecords + mismatchedRecords,
        matchedRecords,
        unscopedRecords,
        mismatchedRecords
      })
    };
  }

  function scopeQueryState(raw, scenarioId) {
    if (!raw) return { value: null, meta: sourceScopeMeta("query", scenarioId, raw) };
    const liveRuns = recordScopeCounts(raw.liveRuns, scenarioId);
    const historyRuns = recordScopeCounts(raw.historyRuns, scenarioId);
    const runs = recordScopeCounts(raw.runs, scenarioId);
    const matchedRuns = [...liveRuns.matched, ...historyRuns.matched, ...runs.matched];
    const matchedRunIds = new Set(matchedRuns.map((run) => run.id).filter(Boolean));
    const requests = recordScopeCounts(raw.actionRequests, scenarioId, (request) => canonicalScenarioId(request) || (matchedRunIds.has(request?.runId) ? scenarioId : null));
    const matchedRecords = matchedRuns.length + requests.matched.length;
    const unscopedRecords = liveRuns.unscoped.length + historyRuns.unscoped.length + runs.unscoped.length + requests.unscoped.length;
    const mismatchedRecords = liveRuns.mismatched.length + historyRuns.mismatched.length + runs.mismatched.length + requests.mismatched.length;
    const rootScenarioId = raw.scenarioContext?.id || raw.currentScenario || null;
    const scoped = rootScenarioId === scenarioId || matchedRecords > 0;
    return {
      value: scoped ? {
        ...raw,
        liveRuns: liveRuns.matched,
        historyRuns: historyRuns.matched,
        runs: runs.matched,
        actionRequests: requests.matched
      } : null,
      meta: sourceScopeMeta("query", scenarioId, raw, {
        rootScenarioId,
        scoped,
        totalRecords: matchedRecords + unscopedRecords + mismatchedRecords,
        matchedRecords,
        unscopedRecords,
        mismatchedRecords
      })
    };
  }

  function scopeDecisionState(raw, scenarioId) {
    if (!raw) return { value: null, meta: sourceScopeMeta("decision", scenarioId, raw) };
    const rootScenarioId = canonicalScenarioId(raw);
    if (rootScenarioId) return scopeRootState("decision", raw, scenarioId, [raw.requests, raw.tasks]);
    const requests = recordScopeCounts(raw.requests, scenarioId);
    const requestIds = new Set(requests.matched.map((request) => request.id).filter(Boolean));
    const tasks = recordScopeCounts(raw.tasks, scenarioId, (task) => canonicalScenarioId(task) || (requestIds.has(task?.requestId) ? scenarioId : null));
    const matchedRecords = requests.matched.length + tasks.matched.length;
    const unscopedRecords = requests.unscoped.length + tasks.unscoped.length;
    const mismatchedRecords = requests.mismatched.length + tasks.mismatched.length;
    return {
      value: matchedRecords ? { ...raw, requests: requests.matched, tasks: tasks.matched } : null,
      meta: sourceScopeMeta("decision", scenarioId, raw, {
        scoped: matchedRecords > 0,
        totalRecords: matchedRecords + unscopedRecords + mismatchedRecords,
        matchedRecords,
        unscopedRecords,
        mismatchedRecords
      })
    };
  }

  function scopeAgentState(raw, scenarioId) {
    if (!raw) return { value: null, meta: sourceScopeMeta("agent", scenarioId, raw) };
    const runs = recordScopeCounts(raw.runs, scenarioId);
    const runIds = new Set(runs.matched.map((run) => run.id).filter(Boolean));
    const sessions = recordScopeCounts(raw.sessions, scenarioId, (session) => canonicalScenarioId(session) || (runIds.has(session?.latestRunId) ? scenarioId : null));
    const matchedRecords = runs.matched.length + sessions.matched.length;
    const unscopedRecords = runs.unscoped.length + sessions.unscoped.length;
    const mismatchedRecords = runs.mismatched.length + sessions.mismatched.length;
    return {
      value: matchedRecords ? { ...raw, runs: runs.matched, sessions: sessions.matched } : null,
      meta: sourceScopeMeta("agent", scenarioId, raw, {
        scoped: matchedRecords > 0,
        totalRecords: matchedRecords + unscopedRecords + mismatchedRecords,
        matchedRecords,
        unscopedRecords,
        mismatchedRecords
      })
    };
  }

  function scopeAgentOwnerState(raw, scenarioId) {
    if (!raw) return { value: null, meta: sourceScopeMeta("agentOwner", scenarioId, raw) };
    const collections = ["generations", "questions", "explanations", "insights"];
    const scopedCollections = {};
    let matchedRecords = 0;
    let unscopedRecords = 0;
    let mismatchedRecords = 0;
    collections.forEach((key) => {
      const counts = recordScopeCounts(raw[key], scenarioId);
      scopedCollections[key] = counts.matched;
      matchedRecords += counts.matched.length;
      unscopedRecords += counts.unscoped.length;
      mismatchedRecords += counts.mismatched.length;
    });
    return {
      value: matchedRecords ? { ...raw, ...scopedCollections } : null,
      meta: sourceScopeMeta("agentOwner", scenarioId, raw, {
        scoped: matchedRecords > 0,
        totalRecords: matchedRecords + unscopedRecords + mismatchedRecords,
        matchedRecords,
        unscopedRecords,
        mismatchedRecords
      })
    };
  }

  function scopeReportState(raw, scenarioId) {
    if (!raw) return { value: null, meta: sourceScopeMeta("report", scenarioId, raw) };
    const rootScenarioId = canonicalScenarioId(raw);
    if (rootScenarioId) return scopeRootState("report", raw, scenarioId, [raw.report, raw.publishedReports]);
    const reports = recordScopeCounts([raw.report, ...list(raw.publishedReports)].filter(Boolean), scenarioId);
    const activeReport = reports.matched.find((report) => report === raw.report) || null;
    return {
      value: reports.matched.length ? {
        ...raw,
        report: activeReport,
        publishedReports: reports.matched.filter((report) => report !== activeReport)
      } : null,
      meta: sourceScopeMeta("report", scenarioId, raw, {
        scoped: reports.matched.length > 0,
        totalRecords: reports.matched.length + reports.unscoped.length + reports.mismatched.length,
        matchedRecords: reports.matched.length,
        unscopedRecords: reports.unscoped.length,
        mismatchedRecords: reports.mismatched.length
      })
    };
  }

  function scopeSources(rawSources, scenarioId, expectedContext) {
    const data = scopeDataState(rawSources.data, scenarioId, expectedContext);
    const ontology = scopeOntologyState(rawSources.ontology, scenarioId);
    const query = scopeQueryState(rawSources.query, scenarioId);
    const decision = scopeDecisionState(rawSources.decision, scenarioId);
    const agent = scopeAgentState(rawSources.agent, scenarioId);
    const agentOwner = scopeAgentOwnerState(rawSources.agentOwner, scenarioId);
    const report = scopeReportState(rawSources.report, scenarioId);
    const scoped = { data, ontology, query, decision, agent, agentOwner, report };
    return {
      sources: Object.fromEntries(Object.entries(scoped).map(([key, result]) => [key, result.value])),
      sourceScope: Object.fromEntries(Object.entries(scoped).map(([key, result]) => [key, result.meta]))
    };
  }

  function containsExactValue(value, target) {
    if (value == null) return false;
    if (typeof value !== "object") return String(value) === String(target);
    if (Array.isArray(value)) return value.some((item) => containsExactValue(item, target));
    return Object.values(value).some((item) => containsExactValue(item, target));
  }

  function includesEveryExact(haystack, needles) {
    return needles.filter(Boolean).every((value) => containsExactValue(haystack, value));
  }

  function stepRecord(id, patch = {}) {
    const step = window.S001_DATA.stepById[id];
    const status = patch.status || "pending";
    return {
      id,
      module: step.module,
      title: step.title,
      status,
      complete: status === "complete",
      source: patch.source || window.S001_DATA.moduleById[step.module].name,
      sourceKey: patch.sourceKey || null,
      sourceRecordId: patch.sourceRecordId || null,
      recordIds: idList(patch.recordIds || [patch.sourceRecordId]),
      detail: patch.detail || step.summary,
      reason: patch.reason || patch.detail || step.summary,
      recovery: patch.recovery || `请在${window.S001_DATA.moduleById[step.module].name}中处理后重新读取状态。`,
      at: patch.at || null,
      evidence: patch.evidence || null
    };
  }

  function dataProjection(dataState) {
    const empty = {
      upload: stepRecord("upload", { sourceKey: SOURCE_KEYS.data }),
      pipeline: stepRecord("pipeline", { sourceKey: SOURCE_KEYS.data }),
      dataPublish: stepRecord("dataPublish", { sourceKey: SOURCE_KEYS.data })
    };
    if (!dataState) return { steps: empty, assetVersion: null, run: null, asOf: null };

    const uploadedEntries = list(dataState.uploadedSnapshots).filter(Boolean);
    const uploaded = uploadedEntries.map((item) => item?.snapshot || item).filter(Boolean);
    const rootContext = dataState.scenarioContext || null;
    const selectedSnapshotId = dataState.currentSnapshotSelections?.["finance-workbook"] || null;
    const selectedReadEventId = dataState.currentSnapshotReadEvents?.["finance-workbook"] || null;
    const uploadEntry = selectedSnapshotId
      ? [...uploadedEntries].reverse().find((entry) => (entry?.snapshot || entry)?.snapshotId === selectedSnapshotId) || null
      : null;
    const stableSnapshot = uploadEntry?.snapshot || uploadEntry || null;
    const currentReadEvent = selectedReadEventId
      ? list(dataState.snapshotReadEvents).find((event) => event?.eventId === selectedReadEventId && event?.snapshotId === selectedSnapshotId && event?.sourceId === "finance-workbook" && sameScenarioContext(event?.scenarioContext, rootContext)) || null
      : null;
    const uploadEvidence = stableSnapshot && currentReadEvent
      ? { ...stableSnapshot, fileName: currentReadEvent.fileName || stableSnapshot.fileName, acquiredAt: currentReadEvent.readCompletedAt || stableSnapshot.acquiredAt, readStartedAt: currentReadEvent.readStartedAt, readCompletedAt: currentReadEvent.readCompletedAt, readDurationMs: currentReadEvent.readDurationMs, readEventId: currentReadEvent.eventId, scenarioContext: { ...currentReadEvent.scenarioContext }, asOf: dataState.asOfDate }
      : null;
    const t008 = dataState.t008Confirmation || uploadEvidence?.t008Confirmation || null;
    const t008Complete = Boolean(
      t008?.snapshotId === uploadEvidence?.snapshotId && t008?.asOf === dataState.asOfDate &&
      t008?.confirmedBy && t008?.confirmedAt && !Number.isNaN(Date.parse(String(t008.confirmedAt).replace(" ", "T"))) &&
      t008?.basis && t008?.evidenceId && t008?.evidenceLocator && t008?.sourceReadEventId === currentReadEvent?.eventId &&
      sameScenarioContext(t008?.scenarioContext, rootContext) && sameScenarioContext(t008?.sourceReadScenarioContext, rootContext)
    );
    const confirmed = Boolean(
      dataState.snapshotConfirmed && dataState.asOfDate && !/待确认|未知/.test(dataState.asOfDate) && uploadEvidence && t008Complete
    );
    const upload = confirmed
      ? stepRecord("upload", {
          status: "complete",
          sourceKey: SOURCE_KEYS.data,
          sourceRecordId: uploadEvidence?.snapshotId || uploadEvidence?.fileName || `快照 · ${dataState.asOfDate}`,
          detail: `融资快照已确认，数据截至 ${dataState.asOfDate}。`,
          at: uploadEvidence?.acquiredAt || null,
          evidence: { asOf: dataState.asOfDate, snapshot: uploadEvidence || null, readEventId: currentReadEvent.eventId, t008EvidenceId: t008.evidenceId, scenarioRunId: rootContext?.scenarioRunId || null }
        })
      : stepRecord("upload", {
          status: uploaded.length ? "observed" : "pending",
          sourceKey: SOURCE_KEYS.data,
          detail: uploaded.length ? "已发现上传记录，但未取得与当前场景轮次一致的快照读取和数据截至确认证据。" : "请在数据工程登记融资工作簿并确认数据截至时间。",
          recovery: "进入数据资源，登记工作簿并确认数据截至时间。"
        });

    const runs = list(dataState.runs);
    const activeRun = dataState.currentRunId
      ? runs.find((run) => run?.id === dataState.currentRunId) || null
      : runs[0] || null;
    const successfulRun = activeRun && (() => {
      const run = activeRun;
      const executionOk = run?.executionStatus === "成功" || ["待发布", "已发布 · 待刷新", "成功", "成功 · 无数据变化"].some((value) => String(run?.status || "").includes(value));
      const qualityOk = /通过|有警告 · 已说明/.test(String(run?.quality || "")) && Boolean(run?.qualityId);
      const sameAsOf = confirmed && run?.asOf === dataState.asOfDate;
      const sameRound = sameScenarioContext(run?.scenarioContext, rootContext) && sameScenarioContext(run?.t008Confirmation?.scenarioContext, rootContext);
      const sameT008 = run?.t008Confirmation?.evidenceId === t008?.evidenceId && run?.t008Confirmation?.snapshotId === uploadEvidence?.snapshotId;
      const hasExactUploadedInput = list(run?.inputs).some((input) => {
        const sameVersion = input?.version === uploadEvidence?.snapshotId || input?.version === uploadEvidence?.fileName || input?.snapshot === uploadEvidence?.fileName;
        return sameVersion && input?.fingerprint === uploadEvidence?.hash && input?.asOf === uploadEvidence?.asOf && input?.sourceReadEventId === uploadEvidence?.readEventId && sameScenarioContext(input?.scenarioContext, rootContext);
      });
      return executionOk && qualityOk && sameAsOf && sameRound && sameT008 && hasExactUploadedInput;
    })() ? activeRun : null;
    let pipeline;
    if (dataState.runStatus === "running" || activeRun?.executionStatus === "运行中") {
      pipeline = stepRecord("pipeline", {
        status: "running",
        sourceKey: SOURCE_KEYS.data,
        sourceRecordId: activeRun?.id || dataState.currentRunId,
        detail: "数据管道正在运行，请等待来源模块形成明确结果。",
        at: activeRun?.startedAt || null,
        recovery: "留在数据工程查看运行进度；完成后重新读取状态。"
      });
    } else if (successfulRun && upload.complete) {
      pipeline = stepRecord("pipeline", {
        status: "complete",
        sourceKey: SOURCE_KEYS.data,
        sourceRecordId: successfulRun.id,
        detail: `正式运行与质量检查已完成，质量结果为“${successfulRun.quality}”。`,
        at: successfulRun.executionEndedAt || successfulRun.endedAt || successfulRun.startedAt,
        evidence: { runId: successfulRun.id, qualityId: successfulRun.qualityId, asOf: successfulRun.asOf }
      });
    } else if (activeRun && /失败|无法判断/.test(`${activeRun.status || ""}${activeRun.executionStatus || ""}`)) {
      pipeline = stepRecord("pipeline", {
        status: "failed",
        sourceKey: SOURCE_KEYS.data,
        sourceRecordId: activeRun.id,
        detail: activeRun.failureReason || "数据管道未形成成功结果。",
        at: activeRun.executionEndedAt || activeRun.endedAt || activeRun.startedAt,
        recovery: activeRun.recovery || "按原输入和已发布定义在数据工程中重试。"
      });
    } else {
      pipeline = stepRecord("pipeline", {
        status: runs.length ? "observed" : "pending",
        sourceKey: SOURCE_KEYS.data,
        detail: runs.length ? "已发现运行记录，但尚未取得同一快照的成功质量结果。" : "确认快照后，在数据工程发布管道定义并发起正式运行。",
        recovery: "在数据工程完成正式运行和质量检查。"
      });
    }

    const versions = list(dataState.assetVersions);
    const assetVersion = successfulRun?.assetVersion
      ? versions.find((version) => version?.id === successfulRun.assetVersion && version?.runId === successfulRun.id) || null
      : null;
    const assetComplete = Boolean(
      pipeline.complete && assetVersion?.id && assetVersion?.evidenceIntegrity === "完整" &&
      assetVersion?.dataQualification !== "不合格" && assetVersion?.asOf === successfulRun?.asOf &&
      assetVersion?.sourceSnapshotId === uploadEvidence?.snapshotId && assetVersion?.sourceReadEventId === uploadEvidence?.readEventId &&
      assetVersion?.t008Confirmation?.evidenceId === t008?.evidenceId && sameScenarioContext(assetVersion?.scenarioContext, rootContext) && sameScenarioContext(assetVersion?.t008Confirmation?.scenarioContext, rootContext)
    );
    const dataPublish = assetComplete
      ? stepRecord("dataPublish", {
          status: "complete",
          sourceKey: SOURCE_KEYS.data,
          sourceRecordId: assetVersion.id,
          recordIds: [successfulRun.id, successfulRun.qualityId, assetVersion.id],
          detail: `${assetVersion.id} 已进入数据资产目录，质量与成员关系证据完整。`,
          at: assetVersion.publishedAt,
          evidence: { versionId: assetVersion.id, runId: successfulRun.id, qualityId: successfulRun.qualityId, asOf: assetVersion.asOf }
        })
      : stepRecord("dataPublish", {
          status: versions.length ? "observed" : "pending",
          sourceKey: SOURCE_KEYS.data,
          detail: versions.length ? "已发现数据资产版本，但未能与本次成功运行及完整证据同时对应。" : "正式运行和质量检查完成后，在发布节点确认数据资产版本。",
          recovery: "回到本次运行绑定的已发布管道定义，核对质量结果并发布资产。"
        });

    return { steps: { upload, pipeline, dataPublish }, assetVersion: assetComplete ? assetVersion : null, run: successfulRun, asOf: confirmed ? dataState.asOfDate : null };
  }

  function ontologyProjection(ontologyState, dataResult) {
    const expectedDataVersion = dataResult.assetVersion?.id || null;
    const drafts = list(ontologyState?.drafts);
    const versions = list(ontologyState?.publishedVersions);
    const contractMatches = (contract) => Boolean(
      expectedDataVersion && contract?.assetVersion === expectedDataVersion &&
      list(contract?.members).length >= 4 && list(contract?.relations).length >= 3
    );
    const mappingComplete = (container, contract) => Boolean(
      contractMatches(contract) && list(container?.objects).length >= 4 && list(container?.links).length >= 3 &&
      list(container?.objects).every((object) => object?.memberId && list(object?.properties).length && list(object.properties).every((property) => property?.sourceFieldId))
    );
    const validatedDraft = drafts.find((draft) =>
      !draft?.publishedVersionId && draft?.validation?.status === "success" && mappingComplete(draft, draft?.sourceDataContract)
    ) || null;
    const mappedVersion = versions.find((version) => mappingComplete(version, version?.dataContract)) || null;
    const mappingFailure = drafts.find((draft) => ["failed", "stale"].includes(draft?.validation?.status)) || null;
    const mappingRunning = drafts.find((draft) => draft?.validation?.status === "processing") || null;
    let mapping;
    if (dataResult.steps.dataPublish.complete && (validatedDraft || mappedVersion)) {
      const source = validatedDraft || mappedVersion;
      const contract = validatedDraft?.sourceDataContract || mappedVersion?.dataContract;
      mapping = stepRecord("mapping", {
        status: "complete",
        sourceKey: SOURCE_KEYS.ontology,
        sourceRecordId: source.id,
        recordIds: [source.id, contract?.mappingVersionId, expectedDataVersion],
        detail: `四类业务对象、三条关系及字段映射已与 ${expectedDataVersion} 精确对应。`,
        at: source.validation?.checkedAt || source.publishedAt || source.updatedAt,
        evidence: { dataVersion: expectedDataVersion, draftId: validatedDraft?.id || null, semanticVersionId: mappedVersion?.id || null }
      });
    } else if (mappingRunning) {
      mapping = stepRecord("mapping", {
        status: "running", sourceKey: SOURCE_KEYS.ontology, sourceRecordId: mappingRunning.id,
        detail: "本体映射正在执行统一校验。", recovery: "等待校验形成明确结果后重新读取。"
      });
    } else if (mappingFailure) {
      mapping = stepRecord("mapping", {
        status: "failed", sourceKey: SOURCE_KEYS.ontology, sourceRecordId: mappingFailure.id,
        detail: mappingFailure.validation?.issues?.[0]?.detail || "本体映射校验未通过。",
        recovery: "按问题定位修正对象、关系或字段映射后重新校验。"
      });
    } else {
      mapping = stepRecord("mapping", {
        status: expectedDataVersion && drafts.length ? "observed" : "pending", sourceKey: SOURCE_KEYS.ontology,
        detail: expectedDataVersion ? "已发现本体草稿；请确认它精确引用本次数据资产并完成统一校验。" : "请先发布本次数据资产，再在本体管理完成对象、关系和字段映射。",
        recovery: expectedDataVersion ? "进入本体管理的草稿，核对数据版本并运行统一校验。" : "先在数据工程发布可引用的数据资产。"
      });
    }

    const currentByOntology = ontologyState?.currentFormalVersionIdsByOntology || {};
    const currentVersionId = Object.values(currentByOntology)[0] || ontologyState?.currentFormalVersionId || null;
    const currentVersion = versions.find((version) => version?.id === currentVersionId) || null;
    const currentSlot = currentVersion ? ontologyState?.bindingsByVersion?.[currentVersion.id] : null;
    const currentBinding = currentSlot?.current || null;
    const bindingId = currentVersion && currentBinding ? `T019:${currentVersion.id}:${currentBinding.dataVersion}` : null;
    const binding = currentVersion && currentBinding ? {
      ...currentBinding,
      versionId: currentVersion.id,
      semanticVersion: currentVersion.semanticVersion,
      bindingId,
      adoptedAt: currentBinding.switchedAt
    } : null;
    const exactBinding = Boolean(
      mapping.complete && currentVersion?.publicationState === "Published" && binding?.bindingId &&
      binding.dataVersion === expectedDataVersion && contractMatches(currentVersion.dataContract)
    );
    const publishRunning = drafts.find((draft) => draft?.publishRun?.status === "processing") || null;
    const switching = Object.values(ontologyState?.updatesByVersion || {}).find((update) => ["matching", "verifying", "switching"].includes(update?.phase)) || null;
    const failedUpdate = Object.values(ontologyState?.updatesByVersion || {}).find((update) => /failed|incompatible|unknown/.test(String(update?.phase || ""))) || null;
    let ontologyPublish;
    if (publishRunning || switching) {
      ontologyPublish = stepRecord("ontologyPublish", {
        status: "running", sourceKey: SOURCE_KEYS.ontology,
        sourceRecordId: publishRunning?.id || currentVersion?.id,
        detail: publishRunning ? "本体版本正在发布。" : "候选数据与已发布本体正在完成验证或正式切换。",
        recovery: "等待本体管理形成明确结果后重新读取。"
      });
    } else if (exactBinding) {
      ontologyPublish = stepRecord("ontologyPublish", {
        status: "complete", sourceKey: SOURCE_KEYS.ontology, sourceRecordId: bindingId,
        recordIds: [currentVersion.id, currentVersion.semanticVersion, expectedDataVersion, bindingId],
        detail: `${currentVersion.semanticVersion} 与 ${expectedDataVersion} 已组成当前正式消费组合。`,
        at: binding.adoptedAt,
        evidence: { versionId: currentVersion.id, semanticVersion: currentVersion.semanticVersion, dataVersion: expectedDataVersion, bindingId }
      });
    } else if (versions.length || binding) {
      ontologyPublish = stepRecord("ontologyPublish", {
        status: failedUpdate ? "failed" : "observed", sourceKey: SOURCE_KEYS.ontology,
        sourceRecordId: bindingId || versions[0]?.id,
        recordIds: [versions[0]?.id, binding?.dataVersion, bindingId],
        detail: failedUpdate ? (failedUpdate.failure || "候选验证或正式切换未完成，上一可信版本继续服务。") : binding ? "已发现正式组合，但其数据版本与本次数据工程发布版本不一致。" : "已发布本体版本，尚未形成与本次数据对应的正式消费组合。",
        at: binding?.adoptedAt || versions[0]?.publishedAt,
        recovery: "按本次数据资产完成候选匹配、固定问题验证和人工确认切换。"
      });
    } else {
      ontologyPublish = stepRecord("ontologyPublish", {
        sourceKey: SOURCE_KEYS.ontology,
        detail: "映射校验完成后发布本体，再按本次数据版本形成正式消费组合。",
        recovery: "在本体管理完成发布、候选验证和人工确认切换。"
      });
    }

    return { steps: { mapping, ontologyPublish }, binding: exactBinding ? binding : null, observedBinding: binding };
  }

  function queryProjection(queryState, ontologyResult) {
    const runs = [
      ...list(queryState?.liveRuns),
      ...list(queryState?.historyRuns),
      ...list(queryState?.runs)
    ].filter((run, index, items) => run?.id && items.findIndex((item) => item?.id === run.id) === index);
    const successful = runs.filter((run) => run?.status === "成功" && run?.result && run?.context);
    const running = runs.find((run) => run?.status === "处理中") || null;
    const failed = runs.find((run) => ["失败", "阻断"].includes(run?.status)) || null;
    const binding = ontologyResult.binding;
    const contextMatches = (run) => Boolean(
      binding && run?.context?.semanticVersion === binding.semanticVersion &&
      run?.context?.dataVersion === binding.dataVersion &&
      (run?.context?.versionId === binding.versionId || run?.context?.bindingRef === binding.bindingId)
    );
    const matched = successful.filter(contextMatches);
    const scopeKey = (run) => list(run?.result?.scope).map((name) => String(name).replace("单位", "")).sort().join("+");
    const pairScopes = new Set(matched.filter((run) => run.templateId === "pair-cost").map(scopeKey));
    const triple = matched.find((run) => run.templateId === "triple-cost" && scopeKey(run) === "465+553+561");
    const group = matched.find((run) => run.templateId === "group-overview");
    const allPairScopes = ["465+553", "553+561", "465+561"].every((key) => pairScopes.has(key));
    const queryComplete = Boolean(ontologyResult.steps.ontologyPublish.complete && group && triple && allPairScopes);
    let query;
    if (queryComplete) {
      const ids = matched.filter((run) => ["pair-cost", "triple-cost", "group-overview"].includes(run.templateId)).map((run) => run.id);
      query = stepRecord("query", {
        status: "complete",
        sourceKey: SOURCE_KEYS.query,
        sourceRecordId: ids[0],
        recordIds: ids,
        detail: "集团、三种两家组合和三家组合均已在同一权威消费上下文中返回。",
        at: matched.map((run) => run.completedAt).filter(Boolean).sort().at(-1),
        evidence: { runIds: ids, bindingId: binding.bindingId }
      });
    } else if (running) {
      query = stepRecord("query", {
        status: "running", sourceKey: SOURCE_KEYS.query, sourceRecordId: running.id,
        detail: "智能问数正在处理问题。", at: running.createdAt,
        recovery: "等待当前问数运行形成明确结果后重新读取。"
      });
    } else if (successful.length) {
      query = stepRecord("query", {
        status: "observed", sourceKey: SOURCE_KEYS.query, sourceRecordId: successful[0].id,
        recordIds: successful.map((run) => run.id),
        detail: binding
          ? "已发现问数成功记录，但三种两家组合、三家组合或集团结果尚未在同一消费上下文中全部形成。"
          : "已发现问数成功记录，但当前没有与本次上游对应的权威消费组合，不能作为本次链路结果。",
        at: successful[0].completedAt || successful[0].createdAt,
        recovery: "先确认权威消费组合，再逐一运行集团、三种两家组合和三家组合问数。"
      });
    } else if (failed) {
      query = stepRecord("query", {
        status: failed.status === "阻断" ? "blocked" : "failed", sourceKey: SOURCE_KEYS.query, sourceRecordId: failed.id,
        detail: failed.failure || "问数运行未形成成功结果。", at: failed.completedAt || failed.createdAt,
        recovery: failed.recovery || "按页面提示恢复消费上下文后重新查询。"
      });
    } else {
      query = stepRecord("query", {
        sourceKey: SOURCE_KEYS.query,
        detail: "请在智能问数中使用已采用的消费组合运行集团、任意两家和三家单位融资成本问题。",
        recovery: "先确认本体与数据消费组合，再进入问数工作台。"
      });
    }

    const ruleRun = matched.find((run) => run.templateId === "rule-explain");
    const institutionRuns = matched.filter((run) => run.templateId === "institution-priority");
    const institutionScopes = new Set(institutionRuns.flatMap((run) => list(run?.result?.scope).map((name) => String(name).replace("单位", ""))));
    const ruleTargets = new Set(list(ruleRun?.result?.actionContexts).map((context) => String(context?.singleTargetStableId || "").replace("UNIT-", "")));
    const institutionEvidenceComplete = institutionRuns.some((run) =>
      institutionScopes.has("553") && list(run?.result?.actionContext?.institutionBindings).length >= 3
    );
    const rulesComplete = Boolean(
      query.complete && ruleRun && ["553", "465", "561"].every((id) => ruleTargets.has(id)) && institutionEvidenceComplete
    );
    const relevantRuleRuns = successful.filter((run) => ["rule-explain", "institution-priority"].includes(run.templateId));
    const rules = rulesComplete
      ? stepRecord("rules", {
          status: "complete", sourceKey: SOURCE_KEYS.query, sourceRecordId: ruleRun.id,
          recordIds: [ruleRun.id, ...institutionRuns.map((run) => run.id)],
          detail: "三家单位的三条规则触发均已形成，单位553的优先协商银行已在同一消费上下文中返回。",
          at: ruleRun.completedAt,
          evidence: { ruleRunId: ruleRun.id, institutionRunIds: institutionRuns.map((run) => run.id) }
        })
      : stepRecord("rules", {
          status: relevantRuleRuns.length ? "observed" : "pending", sourceKey: SOURCE_KEYS.query,
          sourceRecordId: relevantRuleRuns[0]?.id,
          recordIds: relevantRuleRuns.map((run) => run.id),
          detail: relevantRuleRuns.length
            ? "已发现规则或机构归因结果，但三家单位规则行动上下文或单位553银行归因尚未完整形成。"
            : "完成融资成本问数后，运行三家单位规则解释和单位553优先协商银行查询。",
          recovery: "核对三家单位的规则指标、触发分支和行动上下文，并核对单位553的优先协商银行。"
        });

    return { steps: { query, rules }, successfulRuns: successful, matchedRuns: matched, actionRequests: list(queryState?.actionRequests) };
  }

  function decisionProjection(decisionState, queryResult) {
    const sourceRequests = queryResult.actionRequests.filter((request) => ["已提交", "待接收"].includes(request?.status) && request?.id && request?.runId);
    const decisionRequests = list(decisionState?.requests);
    const tasks = list(decisionState?.tasks);
    const matched = sourceRequests.map((source) => {
      const queryRun = queryResult.successfulRuns.find((run) => run.id === source.runId);
      const request = decisionRequests.find((item) => item?.id === source.id && item?.subjectName === source.target);
      const contextMatches = Boolean(
        request && queryRun?.context && request?.evidence?.dataVersion === queryRun.context.dataVersion &&
        request?.evidence?.semanticVersion === queryRun.context.semanticVersion
      );
      const task = contextMatches && request?.taskId
        ? tasks.find((item) => item?.id === request.taskId && item?.requestId === request.id && item?.subjectId === request.subjectId)
        : null;
      return { source, queryRun, request: contextMatches ? request : null, task };
    });
    const expectedTargets = ["单位553", "单位465", "单位561"];
    const batches = new Map();
    matched.forEach((item) => {
      if (!item.source?.runId) return;
      if (!batches.has(item.source.runId)) batches.set(item.source.runId, []);
      batches.get(item.source.runId).push(item);
    });
    const completeBatches = [...batches.entries()]
      .map(([runId, items]) => {
        const byTarget = new Map();
        items.forEach((item) => {
          if (item.request?.subjectName && !byTarget.has(item.request.subjectName)) byTarget.set(item.request.subjectName, item);
        });
        const canonical = expectedTargets.map((target) => byTarget.get(target)).filter(Boolean);
        const at = canonical.map((item) => item.queryRun?.completedAt || item.queryRun?.createdAt || item.request?.requestTime || "").sort().at(-1) || "";
        return { runId, items: canonical, complete: canonical.length === expectedTargets.length, at };
      })
      .filter((batch) => batch.complete)
      .sort((left, right) => String(left.at).localeCompare(String(right.at)));
    const activeBatch = completeBatches.at(-1) || null;
    const activeMatched = activeBatch?.items || [];
    const actionsComplete = Boolean(queryResult.steps.rules.complete && activeMatched.length === expectedTargets.length);
    const actions = actionsComplete
      ? stepRecord("actions", {
          status: "complete", sourceKey: SOURCE_KEYS.decision, sourceRecordId: activeMatched[0]?.request?.id,
          recordIds: activeMatched.map((item) => item.request?.id), detail: `三家单位的行动申请均已由决策中心按原请求标识接收，来源运行 ${activeBatch.runId}。`,
          at: activeMatched.map((item) => item.request?.requestTime).filter(Boolean).sort().at(-1),
          evidence: { sourceRunId: activeBatch.runId, requestIds: activeMatched.map((item) => item.request?.id) }
        })
      : stepRecord("actions", {
          status: sourceRequests.length || matched.some((item) => item.request) ? "observed" : "pending", sourceKey: SOURCE_KEYS.decision,
          sourceRecordId: sourceRequests[0]?.id, recordIds: sourceRequests.map((item) => item.id),
          detail: sourceRequests.length
            ? "智能问数已保存行动申请记录，但决策中心没有在同一来源运行中返回覆盖三家单位的完整请求批次。"
            : "请从三家单位的固定问数证据分别提交行动申请，并在决策中心核对接收结果。",
          recovery: "按原提交标识核对接收结果；未确认原请求不存在前不要重复提交。"
        });

    const confirmed = activeMatched.filter((item) => item.request?.decision?.type === "confirm");
    const confirmComplete = Boolean(actions.complete && confirmed.length >= 1);
    const confirm = confirmComplete
      ? stepRecord("confirm", {
          status: "complete", sourceKey: SOURCE_KEYS.decision, sourceRecordId: confirmed[0].request.id,
          recordIds: confirmed.map((item) => item.request.id), detail: "已完成一条代表性行动申请的人工确认，其余申请继续保留在待决策队列。",
          at: confirmed.map((item) => item.request.decision.time).filter(Boolean).sort().at(-1)
        })
      : stepRecord("confirm", {
          status: confirmed.length ? "observed" : "pending", sourceKey: SOURCE_KEYS.decision,
          sourceRecordId: confirmed[0]?.request?.id, recordIds: confirmed.map((item) => item.request.id),
          detail: confirmed.length ? `已发现 ${confirmed.length} 条人工确认记录，但尚未形成一条完整的代表性确认闭环。` : "行动申请接收后，由业务人员选择一条完成负责人、银行和行动方向确认，其余可继续待决策。",
          recovery: "在决策中心逐条确认；确认前不创建负责人待办。"
        });

    const formedTasks = activeMatched.filter((item) => item.request?.status === "confirmed" && item.task);
    const todoComplete = Boolean(confirm.complete && formedTasks.length >= 1);
    const todo = todoComplete
      ? stepRecord("todo", {
          status: "complete", sourceKey: SOURCE_KEYS.decision, sourceRecordId: formedTasks[0].task.id,
          recordIds: formedTasks.map((item) => item.task.id), detail: "一条负责人待办已由对应的人工确认结果形成，其余申请未越过确认门。",
          at: formedTasks.map((item) => item.task.createdAt).filter(Boolean).sort().at(-1),
          evidence: { taskIds: formedTasks.map((item) => item.task.id), requestIds: formedTasks.map((item) => item.request.id) }
        })
      : stepRecord("todo", {
          status: formedTasks.length ? "observed" : "pending", sourceKey: SOURCE_KEYS.decision,
          sourceRecordId: formedTasks[0]?.task?.id, recordIds: formedTasks.map((item) => item.task.id),
          detail: formedTasks.length ? `已发现 ${formedTasks.length} 条待办，但尚未定位到可与代表性人工确认闭合的记录。` : "只有人工确认成功后，决策中心才会创建负责人待办。",
          recovery: "完成一条代表性人工确认，并核对待办与原请求、主体、负责人和版本一致。"
        });

    return { steps: { actions, confirm, todo }, matched: activeMatched, sourceRunId: activeBatch?.runId || null, tasks: formedTasks.map((item) => item.task) };
  }

  function verificationPassed(report) {
    const verification = report?.verification;
    const coverage = verification?.coverage;
    const content = list(report?.contentVersions).find((item) => item?.reviewCopyId === report.reviewCopyId);
    return Boolean(
      verification?.status === "completed" && verification?.runScope === "整份报告" && verification?.runId &&
      verification?.evidencePackId === report.evidencePackId && verification?.completedAt &&
      coverage?.status === "complete" && coverage?.planned > 0 && coverage.planned === coverage.applicable &&
      coverage.applicable === coverage.completed && coverage.pending === 0 && coverage.error === 0 && coverage.skipped === 0 &&
      coverage.factTotal > 0 && coverage.factCovered === coverage.factTotal && coverage.anchorTotal > 0 && coverage.anchorCovered === coverage.anchorTotal &&
      list(verification.results).length > 0 && !list(verification.results).some((item) => ["fail", "unverifiable"].includes(item?.status)) &&
      list(content?.verificationRunIds).includes(verification.runId)
    );
  }

  function reportProjection(reportState, decisionResult) {
    const report = reportState?.report;
    const stages = ["draft", "returned", "confirmed", "publishing", "publish_failed", "published", "withdrawn"];
    const draftFormed = Boolean(
      report && stages.includes(report.stage) && report.aggregateId && report.requestId && report.evidencePackId &&
      report.generationRunId && report.generationResultId && report.draftId && report.reviewCopyId && report.draftVersion && report.generatedAt &&
      list(report.contentVersions).some((content) => content?.draftId === report.draftId && content?.reviewCopyId === report.reviewCopyId && content?.evidencePackId === report.evidencePackId && content?.generationRunId === report.generationRunId)
    );
    const taskIds = decisionResult.tasks.map((task) => task.id);
    const linkedTasks = taskIds.length >= 1 && includesEveryExact(report?.evidencePacks, taskIds);
    const reportComplete = Boolean(draftFormed && decisionResult.steps.todo.complete && linkedTasks);
    const reportStep = !report
      ? stepRecord("report", { sourceKey: SOURCE_KEYS.report })
      : draftFormed
        ? stepRecord("report", {
            status: reportComplete ? "complete" : "observed", sourceKey: SOURCE_KEYS.report,
            sourceRecordId: report.aggregateId || report.draftId,
            recordIds: [report.aggregateId, report.requestId, report.generationRunId, report.generationResultId, report.draftId],
            detail: reportComplete
              ? "报告草稿已固定引用本次代表性确认闭环的待办摘要。"
              : "报告中心已形成报告草稿，但证据包中未能定位本次代表性待办，暂不能确认属于同一链路。",
            at: report.generatedAt,
            recovery: "从决策中心本次运行摘要创建报告请求，并保留代表性待办的精确引用。"
          })
        : stepRecord("report", {
            status: ["preparing", "generating"].includes(report.stage) ? "running" : "pending", sourceKey: SOURCE_KEYS.report,
            detail: "请在报告中心从本次决策运行摘要生成报告草稿。",
            recovery: "确认报告请求、证据包和生成结果属于同一内容版本。"
          });

    const verified = verificationPassed(report);
    const verify = verified
      ? stepRecord("verify", {
          status: reportStep.complete ? "complete" : "observed", sourceKey: SOURCE_KEYS.report,
          sourceRecordId: report.verification.runId, recordIds: [report.verification.runId, report.evidencePackId],
          detail: reportStep.complete ? "整份报告的确定性核验覆盖完整且无失败项。" : "确定性核验已完成，但上游报告尚未能与本次决策摘要关联。",
          at: report.verification.completedAt,
          recovery: reportStep.complete ? "可进入人工复核和发布。" : "先修复报告与本次决策运行摘要的来源关联。"
        })
      : stepRecord("verify", {
          status: ["queued", "running"].includes(report?.verification?.status) ? "running" : report?.verification?.status === "run_failed" ? "failed" : "pending",
          sourceKey: SOURCE_KEYS.report, sourceRecordId: report?.verification?.runId,
          detail: report?.verification?.status === "run_failed" ? "确定性核验运行失败或中断。" : "报告草稿形成后，对整份报告执行确定性核验。",
          recovery: report?.verification?.status === "run_failed" ? "按同一报告内容版本和范围重新发起核验。" : "在报告中心选择整份报告并开始核验。"
        });

    const manifest = report?.artifactManifest;
    const published = Boolean(
      report?.stage === "published" && report.reportNo && report.contentVersion && report.publishedAt && report.frozenHtml &&
      manifest?.reportNo === report.reportNo && manifest?.contentVersion === report.contentVersion && manifest?.evidencePackId === report.evidencePackId &&
      manifest?.html?.status === "已形成" && manifest?.pdf?.status === "已形成" &&
      report.publicationVerificationRef?.runId === report.verification?.runId &&
      list(report.publicationRuns).some((run) => run?.status === "成功" && run?.publicationId === report.publicationId)
    );
    const publish = published
      ? stepRecord("publish", {
          status: verify.complete ? "complete" : "observed", sourceKey: SOURCE_KEYS.report,
          sourceRecordId: report.reportNo, recordIds: [report.reportNo, report.contentVersion, report.publicationId],
          detail: verify.complete
            ? "HTML 与 PDF 发布状态引用同一报告编号、内容版本和证据包。"
            : "报告中心已保存双格式发布状态，但上游报告链路尚未完整确认。",
          at: report.publishedAt,
          recovery: "在发布记录中核对同一报告编号、内容版本、证据包和核验运行。",
          evidence: { reportNo: report.reportNo, contentVersion: report.contentVersion, evidencePackId: report.evidencePackId, actualPdfFile: false }
        })
      : stepRecord("publish", {
          status: report?.stage === "publishing" ? "running" : report?.stage === "publish_failed" ? "failed" : "pending",
          sourceKey: SOURCE_KEYS.report,
          detail: report?.stage === "publish_failed" ? "报告发布未成功，正式内容未开放消费。" : "完成整份报告核验和人工复核后发布 HTML/PDF。",
          recovery: report?.stage === "publish_failed" ? "按原报告内容版本重试发布，不重新生成正文。" : "在报告中心完成复核和双格式发布。"
        });

    return { steps: { report: reportStep, verify, publish }, report: published ? report : null, observedReport: draftFormed ? report : null };
  }

  function agentProjection(agentState, agentOwnerState, reportResult) {
    const runs = list(agentState?.runs);
    const sessions = list(agentState?.sessions);
    const report = reportResult.report;
    const adapterRecords = list(agentOwnerState?.questions);
    const adapterRecord = report ? adapterRecords.find((record) =>
      record?.fixedContextRef?.reportId === report.reportNo &&
      record?.fixedContextRef?.contentVersion === report.contentVersion &&
      record?.resultId && record?.status === "已完成"
    ) || null : null;
    const companionRun = runs.find((run) => {
      if (!report || !["complete", "partial"].includes(run?.status) || !run?.result || run?.snapshot?.agentId !== "report-copilot") return false;
      const session = sessions.find((item) => item?.id === run.sessionId && item?.latestRunId === run.id);
      if (!session || session.evidenceId !== run.snapshot.evidenceId) return false;
      const reportReference = `${session.reportVersion || ""} ${run.snapshot?.reportVersion || ""}`;
      return reportReference.includes(report.reportNo) && reportReference.includes(report.contentVersion);
    }) || null;
    const observed = runs.find((run) => ["complete", "partial"].includes(run?.status) && run?.result && run?.snapshot?.agentId === "report-copilot") || null;
    const running = runs.find((run) => ["waiting", "running"].includes(run?.status) && run?.snapshot?.agentId === "report-copilot") || null;
    const companion = companionRun && reportResult.steps.publish.complete
      ? stepRecord("companion", {
          status: "complete", sourceKey: SOURCE_KEYS.agentV7, sourceRecordId: companionRun.id,
          recordIds: [companionRun.requestId, companionRun.sessionId, companionRun.id, companionRun.result.id],
          detail: "报告伴读已在本次报告内容版本和固定证据范围内形成回答。",
          at: companionRun.completedAt || companionRun.result?.generatedAt,
          evidence: { runId: companionRun.id, sessionId: companionRun.sessionId, resultId: companionRun.result.id }
        })
      : stepRecord("companion", {
          status: running ? "running" : observed || adapterRecord ? "observed" : "pending",
          sourceKey: adapterRecord && !observed ? SOURCE_KEYS.agentOwner : SOURCE_KEYS.agentV7,
          sourceRecordId: (running || observed)?.id || adapterRecord?.runId,
          detail: running
            ? "报告伴读正在处理。"
            : observed
              ? "已发现报告伴读结果，但其报告编号、内容版本或会话绑定与本次已发布报告不一致。"
              : adapterRecord
                ? "报告中心的外部责任方适配记录已保存本次伴读回执，但 Agent 应用当前工作记录中没有同一运行与会话记录，暂不能确认跨模块接收。"
              : "报告发布后，从报告中心发起伴读，并在 Agent 应用中使用固定报告上下文回答。",
          recovery: adapterRecord
            ? "由 Agent 应用接收同一报告上下文，并返回可由双方精确定位的运行、会话和结果标识。"
            : "使用本次报告编号、内容版本、稳定锚点和证据包创建新的伴读会话。"
        });
    return { steps: { companion }, run: companionRun };
  }

  function comparisonProjection(reportResult, agentResult) {
    const report = reportResult.observedReport;
    const activeComparison = report?.comparison;
    const latestCurrentRecord = list(report?.comparisonRecords).find((record) =>
      record?.status === "completed" && record.recordStatus !== "已陈旧"
    );
    const comparison = activeComparison?.status && activeComparison.status !== "idle"
      ? activeComparison
      : latestCurrentRecord || activeComparison;
    const completeRecord = Boolean(
      comparison?.status === "completed" && comparison.recordId && comparison.comparedAt && comparison.currentStatusReadAt &&
      comparison.reportSnapshot?.dataVersion === report?.bindingSnapshot?.dataVersion &&
      ["可以比较", "可以比较但有警告", "仅可做固定结果比较"].includes(comparison.comparisonOutcome) &&
      comparison.gate === "允许结构化事实比较" && list(comparison.results).length > 0
    );
    const stale = comparison?.recordStatus === "已陈旧" && comparison.staleReason && comparison.staleDetectedAt;
    if (completeRecord && agentResult.steps.companion.complete && reportResult.steps.publish.complete && !stale) {
      return stepRecord("compare", {
        status: "complete", sourceKey: SOURCE_KEYS.report, sourceRecordId: comparison.recordId,
        recordIds: [comparison.recordId, comparison.currentVersion],
        detail: "已使用当前权威数据形成独立比较记录，原报告内容保持不变。",
        at: comparison.comparedAt,
        evidence: { recordId: comparison.recordId, outcome: comparison.comparisonOutcome }
      });
    }
    if (completeRecord || stale) {
      return stepRecord("compare", {
        status: stale ? "blocked" : "observed", sourceKey: SOURCE_KEYS.report, sourceRecordId: comparison.recordId,
        detail: stale
          ? `比较记录已陈旧：${comparison.staleReason}`
          : "已发现当前数据比较记录，但报告伴读或上游发布链路尚未完整关联。",
        at: stale ? comparison.staleDetectedAt : comparison.comparedAt,
        recovery: stale ? "在报告中心重新读取当前数据并形成新的独立比较记录。" : "先确认本次报告发布与伴读会话，再重新比较。"
      });
    }
    return stepRecord("compare", {
      status: comparison?.status === "running" ? "running" : "pending", sourceKey: SOURCE_KEYS.report,
      detail: "完成报告伴读后，在报告中心显式发起与当前数据比较。",
      recovery: "比较结果单独保存，不改写已发布报告编号、内容版本和证据包。"
    });
  }

  function buildProjection(scenarioId = state.activeScenarioId) {
    const scenarioState = state.scenarios[scenarioId] || activeScenarioState();
    const rawSources = {
      data: readJson(SOURCE_KEYS.data),
      ontology: readJson(SOURCE_KEYS.ontology),
      query: readJson(SOURCE_KEYS.query),
      decision: readJson(SOURCE_KEYS.decision),
      agent: readJson(SOURCE_KEYS.agentV7) || readJson(SOURCE_KEYS.agentV8),
      agentOwner: readJson(SOURCE_KEYS.agentOwner),
      report: readNewestJson(SOURCE_KEYS.report, `${SOURCE_KEYS.report}.active-tab`)
    };
    const scoped = scopeSources(rawSources, scenarioId, scenarioContextFor(scenarioId));
    const sources = scoped.sources;

    const dataResult = dataProjection(sources.data);
    const ontologyResult = ontologyProjection(sources.ontology, dataResult);
    const queryResult = queryProjection(sources.query, ontologyResult);
    const decisionResult = decisionProjection(sources.decision, queryResult);
    const reportResult = reportProjection(sources.report, decisionResult);
    const agentResult = agentProjection(sources.agent, sources.agentOwner, reportResult);
    const compare = comparisonProjection(reportResult, agentResult);

    const raw = {
      ...dataResult.steps,
      ...ontologyResult.steps,
      ...queryResult.steps,
      ...decisionResult.steps,
      ...reportResult.steps,
      ...agentResult.steps,
      compare
    };

    const steps = {};
    window.S001_DATA.workflow.forEach((step) => {
      const record = raw[step.id] || stepRecord(step.id);
      const prerequisiteComplete = !step.prerequisite || steps[step.prerequisite]?.complete;
      if (record.complete && !prerequisiteComplete) {
        steps[step.id] = {
          ...record,
          status: "observed",
          complete: false,
          detail: `已发现“${step.title}”来源记录，但上游“${window.S001_DATA.stepById[step.prerequisite].title}”尚未按同一链路确认。`,
          recovery: "先修复上游关联，再重新读取来源状态。"
        };
      } else {
        steps[step.id] = record;
      }
    });

    const modules = {};
    window.S001_DATA.modules.forEach((module) => {
      const records = module.steps.map((id) => steps[id]);
      const done = records.filter((record) => record.complete).length;
      const observed = records.filter((record) => record.status === "observed").length;
      modules[module.id] = {
        id: module.id,
        done,
        observed,
        running: records.filter((record) => record.status === "running").length,
        failed: records.filter((record) => ["failed", "blocked"].includes(record.status)).length,
        total: records.length,
        complete: done === records.length
      };
    });

    const order = window.S001_DATA.workflow.map((step) => step.id);
    const completeCount = order.filter((id) => steps[id].complete).length;
    const firstIncompleteId = order.find((id) => !steps[id].complete) || null;
    return {
      scenarioId,
      readAt: nowLabel(),
      steps,
      byId: steps,
      order,
      modules,
      completeCount,
      total: order.length,
      firstIncompleteId,
      sources: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, Boolean(value)])),
      rawSources: Object.fromEntries(Object.entries(rawSources).map(([key, value]) => [key, Boolean(value)])),
      sourceScope: scoped.sourceScope,
      meta: {
        dataAsOf: dataResult.asOf || scenarioState.context.dataAsOf,
        dataVersion: dataResult.assetVersion?.id || null,
        semanticVersion: ontologyResult.binding?.semanticVersion || null,
        bindingId: ontologyResult.binding?.bindingId || null,
        reportNo: reportResult.report?.reportNo || null,
        actualPdfFile: false
      },
      chain: {
        dataAssetVersionId: dataResult.assetVersion?.id || null,
        ontologyBindingId: ontologyResult.binding?.bindingId || null,
        queryRunIds: queryResult.matchedRuns.map((run) => run.id),
        decisionTaskIds: decisionResult.tasks.map((task) => task.id),
        reportNo: reportResult.report?.reportNo || null,
        companionRunId: agentResult.run?.id || null,
        comparisonRecordId: compare.sourceRecordId || null
      }
    };
  }

  function refreshProjection(notify = true, scenarioId = state.activeScenarioId) {
    refreshStateFromStorage();
    scenarioId = state.scenarios[scenarioId] ? scenarioId : state.activeScenarioId;
    publishScenarioContext(scenarioId, false);
    const currentProjection = buildProjection(scenarioId);
    projectionByScenario.set(scenarioId, currentProjection);
    if (state.scenarios[scenarioId]) state.scenarios[scenarioId].lastReadAt = currentProjection.readAt;
    persist(false);
    if (notify) window.dispatchEvent(new CustomEvent("s001:state", { detail: compatibleStateView() }));
    return currentProjection;
  }

  function getProjection(scenarioId = state.activeScenarioId) {
    return projectionByScenario.get(scenarioId) || refreshProjection(false, scenarioId);
  }

  function firstIncomplete() {
    const current = getProjection();
    const id = current.firstIncompleteId;
    if (!id) return null;
    return { ...window.S001_DATA.stepById[id], ...current.steps[id] };
  }

  function isComplete(stepId) {
    return Boolean(getProjection().steps[stepId]?.complete);
  }

  function moduleProgress(moduleId) {
    const id = typeof moduleId === "string" ? moduleId : moduleId?.id;
    return getProjection().modules[id] || { done: 0, observed: 0, running: 0, failed: 0, total: 0, complete: false };
  }

  function saveFramePosition(moduleId, position) {
    const scenario = activeScenarioState();
    scenario.framePositions[moduleId] = { ...position, scenarioId: scenario.scenarioId };
    persist(false);
  }

  function saveHomeDomain(homeDomain, homeOrbitTurn = null) {
    const scenario = activeScenarioState();
    if (!["foundation", "intelligence", "action"].includes(homeDomain)) return scenario;
    scenario.homeDomain = homeDomain;
    if (Number.isFinite(Number(homeOrbitTurn))) scenario.homeOrbitTurn = Math.max(0, Math.trunc(Number(homeOrbitTurn)));
    persist(true);
    return scenario;
  }

  function saveNavigationContext(patch = {}) {
    const scenario = activeScenarioState();
    scenario.navigation = {
      ...scenario.navigation,
      ...patch,
      moduleContexts: {
        ...(scenario.navigation?.moduleContexts || {}),
        ...(patch.moduleContexts || {})
      }
    };
    persist(false);
    return scenario.navigation;
  }

  function saveContext(patch = {}) {
    const scenario = activeScenarioState();
    const definition = scenarioDefinition(scenario.scenarioId) || window.S001_DATA.scenario;
    scenario.context = {
      organization: definition.organization || scenario.context.organization,
      selectedEntities: [...(definition.selectedEntities || scenario.context.selectedEntities)],
      dataAsOf: patch.dataAsOf || scenario.context.dataAsOf || definition.dataAsOf
    };
    persist(false);
    return scenario.context;
  }

  function setActiveScenario(scenarioId) {
    const definition = enabledScenarios().find((scenario) => scenario.id === scenarioId);
    if (!definition) throw new Error(`场景 ${scenarioId || "未提供"} 未注册或未启用。`);
    if (!state.scenarios[scenarioId]) state.scenarios[scenarioId] = createScenarioState(scenarioId);
    state.activeScenarioId = scenarioId;
    publishScenarioContext(scenarioId, true);
    const currentProjection = buildProjection(scenarioId);
    projectionByScenario.set(scenarioId, currentProjection);
    state.scenarios[scenarioId].lastReadAt = currentProjection.readAt;
    persist(true);
    return state.scenarios[scenarioId];
  }

  function toggleNavigation() {
    state.navCollapsed = !state.navCollapsed;
    try { localStorage.setItem("ontology3-home-sidebar", state.navCollapsed ? "collapsed" : "expanded"); } catch (_) {}
    persist(true);
  }

  function resetCurrentScenario(scenarioId = state.activeScenarioId) {
    const definition = enabledScenarios().find((scenario) => scenario.id === scenarioId);
    if (!definition) throw new Error(`场景 ${scenarioId || "未提供"} 未注册或未启用。`);
    if (enabledScenarios().length > 1) {
      throw new Error("模块状态合同尚不支持按场景定向清理；未清除任何模块工作记录。");
    }
    const previousScenario = state.scenarios[scenarioId] || createScenarioState(scenarioId);
    const previousContext = scenarioContextFor(scenarioId);
    const archivedAt = nextIsoTimestamp(previousContext?.formedAt || null);
    previousScenario.scenarioRunHistory = [
      ...list(previousScenario.scenarioRunHistory),
      {
        scenarioContext: { ...previousContext },
        archivedAt,
        resetAt: archivedAt,
        lastReadAt: previousScenario.lastReadAt || null,
        reason: "重置当前场景前封存旧轮次根上下文"
      }
    ];
    persist(false);
    const resetRequest = {
      sourceModule: "平台公共层",
      operation: "resetScenarioProjection",
      requestId: `RESET-${previousContext.scenarioRunId}-${Date.now()}`,
      requestedAt: archivedAt,
      scenarioContext: { ...previousContext },
      preserveHistory: true
    };
    localStorage.setItem(SCENARIO_RESET_REQUEST_KEY, JSON.stringify(resetRequest));
    const nextScenario = createScenarioState(scenarioId, { previousFormedAt: archivedAt });
    nextScenario.scenarioRunHistory = previousScenario.scenarioRunHistory.map((record) => ({ ...record }));
    state.scenarios[scenarioId] = nextScenario;
    state.activeScenarioId = scenarioId;
    projectionByScenario.delete(scenarioId);
    const currentProjection = buildProjection(scenarioId);
    projectionByScenario.set(scenarioId, currentProjection);
    state.scenarios[scenarioId].lastReadAt = currentProjection.readAt;
    persist(false);
    publishScenarioContext(scenarioId, true);
    window.dispatchEvent(new CustomEvent("s001:state", { detail: compatibleStateView() }));
    return state.scenarios[scenarioId];
  }

  const resetAll = resetCurrentScenario;

  enabledScenarios().forEach((scenario) => scenarioContextFor(scenario.id));
  persist(false);
  publishScenarioContext(state.activeScenarioId, false);

  window.S001_STORE = {
    STORAGE_KEY,
    HANDOFF_CHANNEL,
    SCENARIO_CONTEXT_KEY,
    SCENARIO_RESET_REQUEST_KEY,
    MODULE_STORAGE_KEYS,
    get: compatibleStateView,
    getRoot: () => state,
    getScenario: (scenarioId = state.activeScenarioId) => state.scenarios[scenarioId] || null,
    getScenarioContext: readScenarioContext,
    getScenarioContextEnvelope: scenarioContextEnvelope,
    publishScenarioContext,
    setActiveScenario,
    getProjection,
    refreshProjection,
    firstIncomplete,
    isComplete,
    moduleProgress,
    saveFramePosition,
    saveHomeDomain,
    saveNavigationContext,
    saveContext,
    toggleNavigation,
    resetCurrentScenario,
    resetAll
  };
})();
