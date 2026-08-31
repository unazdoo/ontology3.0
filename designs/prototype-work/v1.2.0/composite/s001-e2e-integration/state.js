(function installCompositeState(global) {
  "use strict";

  const DATA = global.OFW_V120_DATA;
  const EVALUATION = global.OFWS005EvaluationEngine;
  const STORAGE_KEY = "ofw.prototype.v1.2.0.composite.state.v2";
  const HANDOFF_KEY = "ofw.prototype.v1.2.0.composite.handoff.v2";
  const MODELING_RESEARCH_KEY = "ofw.prototype.v1.2.0.modeling-research.v1";
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
    const scenarioContext = definition.id === "S005" ? createS005Context() : archivedContext(definition);
    return {
      scenarioId: definition.id,
      archived: Boolean(definition.archived),
      scenarioContext,
      runHistory: [],
      stages: definition.id === "S005" ? initialStages() : {},
      evaluationState: definition.id === "S005" && EVALUATION ? EVALUATION.createEvaluationState(scenarioContext) : null,
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
      schemaVersion: 2,
      revision: 0,
      activeScenarioId: requestedScenarioId() || DATA.scenarios.find((item) => item.default)?.id || "S005",
      navCollapsed: global.matchMedia?.("(max-width: 980px)")?.matches || false,
      scenarios: Object.fromEntries(DATA.scenarios.map((definition) => [definition.id, initialScenarioState(definition)]))
    };
  }

  function createInitialModelingResearch() {
    return {
      schemaVersion: "ofw.prototype.modeling-research.v1",
      revision: 0,
      workspaces: {},
      results: {},
      returnContexts: {}
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
    let evaluationState = initial.evaluationState;
    if (definition.id === "S005" && EVALUATION) {
      try {
        evaluationState = saved.evaluationState
          ? EVALUATION.createEngine({ scenarioContext: context, restoredState: saved.evaluationState }).serialize()
          : EVALUATION.createEvaluationState(context);
      } catch (_) {
        evaluationState = EVALUATION.createEvaluationState(context);
      }
    }
    return {
      ...initial,
      ...clone(saved),
      scenarioId: definition.id,
      archived: Boolean(definition.archived),
      scenarioContext: context,
      runHistory: Array.isArray(saved.runHistory) ? clone(saved.runHistory) : [],
      stages: definition.id === "S005" ? mergeEvaluationStages(initial.stages, evaluationState?.current?.stages) : {},
      evaluationState,
      navigation: {
        ...initial.navigation,
        ...(clone(saved.navigation) || {}),
        framePositions: { ...(clone(saved.navigation?.framePositions) || {}) },
        selectedResources: { ...(clone(saved.navigation?.selectedResources) || {}) }
      }
    };
  }

  function mergeEvaluationStages(base, engineStages) {
    return Object.fromEntries(Object.entries(base).map(([stageId, stage]) => [stageId, {
      ...stage,
      ...(clone(engineStages?.[stageId]) || {}),
      title: stage.title
    }]));
  }

  function loadState() {
    const saved = readJson(global.localStorage, STORAGE_KEY);
    const initial = createInitialState();
    if (!saved || saved.schemaVersion !== 2) return initial;
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
  let modelingResearch = readJson(global.localStorage, MODELING_RESEARCH_KEY);
  if (modelingResearch?.schemaVersion !== "ofw.prototype.modeling-research.v1") modelingResearch = createInitialModelingResearch();

  function persist(notify = true, reason = "state") {
    state.revision += 1;
    writeJson(global.localStorage, STORAGE_KEY, state);
    if (notify) global.dispatchEvent(new CustomEvent("ofw:v120-state", { detail: { reason, state: snapshot() } }));
    return snapshot();
  }

  function persistHandoffs() {
    writeJson(global.sessionStorage, HANDOFF_KEY, handoffs);
  }

  function persistModelingResearch() {
    modelingResearch.revision += 1;
    writeJson(global.localStorage, MODELING_RESEARCH_KEY, modelingResearch);
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
      evaluationRun: clone(previous.evaluationState?.current?.evaluationRun || null),
      evaluationResult: clone(previous.evaluationState?.current?.evaluationResult || null),
      moduleOutputs: clone(previous.evaluationState?.current?.moduleOutputs || []),
      archivedAt: nextContext.formedAt,
      reason: "当前场景运行重置前封存"
    });
    target.scenarioContext = nextContext;
    target.stages = initialStages();
    if (EVALUATION) {
      const reset = previous.evaluationState
        ? EVALUATION.resetEvaluationState(previous.evaluationState, nextContext)
        : { state: EVALUATION.createEvaluationState(nextContext) };
      target.evaluationState = reset.state;
    }
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

  function sameScenarioContext(left, right) {
    return SCENARIO_FIELDS.every((field) => left?.[field] === right?.[field]);
  }

  function assertModelingScenarioContext(value) {
    const current = state.scenarios[value?.scenarioId]?.scenarioContext;
    if (!current || !sameScenarioContext(value, current)) throw new Error("M08 研究状态未绑定已登记的五字段场景身份。");
    return clone(current);
  }

  function modelingResearchSnapshot() {
    return clone(modelingResearch);
  }

  function modelingWorkspace(scenarioId = state.activeScenarioId) {
    return clone(modelingResearch.workspaces[scenarioId] || null);
  }

  function saveModelingWorkspace(scenarioContextValue, workspace) {
    const context = assertModelingScenarioContext(scenarioContextValue);
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) throw new Error("M08 workspace 必须是结构化对象。");
    modelingResearch.workspaces[context.scenarioId] = {
      scenarioContext: context,
      workspace: clone(workspace),
      updatedAt: new Date().toISOString()
    };
    persistModelingResearch();
    return modelingWorkspace(context.scenarioId);
  }

  function saveModelingReturnContext(scenarioContextValue, value) {
    const context = assertModelingScenarioContext(scenarioContextValue);
    modelingResearch.returnContexts[context.scenarioId] = { scenarioContext: context, ...clone(value), savedAt: new Date().toISOString() };
    persistModelingResearch();
    return clone(modelingResearch.returnContexts[context.scenarioId]);
  }

  function modelingReturnContext(scenarioId = state.activeScenarioId) {
    return clone(modelingResearch.returnContexts[scenarioId] || null);
  }

  function saveModelingResult(scenarioContextValue, resultEnvelope, workspace = null) {
    const context = assertModelingScenarioContext(scenarioContextValue);
    if (!resultEnvelope?.resultId || !resultEnvelope?.resultKind || !resultEnvelope?.runId) throw new Error("M08 Result Envelope 缺少 resultId、resultKind 或研究 runId。");
    if (!new Set(["FACT", "PREDICTION", "SIMULATION"]).has(resultEnvelope.resultKind)) throw new Error("M08 Result Envelope 的 resultKind 无效。");
    if (resultEnvelope.runId === context.scenarioRunId || (context.scenarioId === "S003" && String(resultEnvelope.runId).startsWith("S003-RUN-"))) {
      throw new Error("M08 研究运行不得复用归档场景 scenarioRunId。");
    }
    if (resultEnvelope.resultKind !== "FACT") {
      if (resultEnvelope.factWriteAllowed !== false || resultEnvelope.actionWriteAllowed !== false || resultEnvelope.actionSourceAllowed !== false) {
        throw new Error("非 FACT 结果必须显式禁止事实写入和行动来源。");
      }
    }
    if (context.scenarioId === "S003") {
      if (resultEnvelope.objectiveId !== "MO-S003-DEBT-RISK-EARLY-WARNING-v1") throw new Error("S003 Result Envelope 的 Objective 不一致。");
      const snapshotContext = resultEnvelope.inputSnapshot?.scenarioContext || resultEnvelope.inputSnapshot;
      if (!sameScenarioContext(snapshotContext, context)) throw new Error("S003 Result Envelope 的输入快照未绑定归档五字段身份。");
      if (!/^(BENCHRUN|EXPRUN|SHADOWRUN|M08-S003-)/.test(String(resultEnvelope.runId))) throw new Error("S003 M08 研究运行身份无效。");
    }
    const bucket = modelingResearch.results[context.scenarioId] || [];
    const existing = bucket.find((item) => item.resultEnvelope.resultId === resultEnvelope.resultId);
    if (existing && JSON.stringify(existing.resultEnvelope) !== JSON.stringify(resultEnvelope)) throw new Error("不可变 Result ID 不能对应不同内容。");
    if (!existing) bucket.unshift({ scenarioContext: context, resultEnvelope: clone(resultEnvelope), savedAt: new Date().toISOString() });
    modelingResearch.results[context.scenarioId] = bucket.slice(0, 24);
    if (workspace) modelingResearch.workspaces[context.scenarioId] = { scenarioContext: context, workspace: clone(workspace), updatedAt: new Date().toISOString() };
    persistModelingResearch();
    return clone(modelingResearch.results[context.scenarioId][0]);
  }

  function modelingProjection(scenarioId = state.activeScenarioId, consumerId = "Dashboard") {
    const context = state.scenarios[scenarioId]?.scenarioContext;
    if (!context) return null;
    const latest = modelingResearch.results[scenarioId]?.[0] || null;
    const workspace = modelingResearch.workspaces[scenarioId] || null;
    if (consumerId === "M04_DECISION" && latest?.resultEnvelope?.resultKind !== "FACT") {
      return clone({ scenarioContext: context, consumerId, status: "BLOCKED", code: "NON_FACT_SOURCE_REJECTED", reason: "预测、候选试算和模拟结果不能直接形成 Action Request、审批、待办、通知或交易。", resultEnvelope: latest.resultEnvelope });
    }
    return clone({
      scenarioContext: context,
      consumerId,
      status: latest ? "AVAILABLE" : "EMPTY",
      permissionScope: latest?.resultEnvelope?.permissionScope || null,
      workspace: workspace?.workspace || null,
      resultEnvelope: latest?.resultEnvelope || null,
      updatedAt: latest?.savedAt || workspace?.updatedAt || null
    });
  }

  function sameReferenceFields(left, right, fields) {
    return fields.every((field) => (left?.[field] ?? null) === (right?.[field] ?? null));
  }

  function validateM08Return(value, scenarioId = state.activeScenarioId) {
    const payload = clone(value);
    const context = state.scenarios[scenarioId]?.scenarioContext;
    if (!context || !sameScenarioContext(payload, context)) throw new Error("M08 返回未绑定当前五字段场景身份。");
    const inputManifest = payload?.inputManifest;
    const resultEnvelope = payload?.resultEnvelope;
    const inputSnapshot = resultEnvelope?.inputSnapshot;
    if (!inputManifest || !resultEnvelope || !inputSnapshot) throw new Error("M08 返回缺少输入清单、结果包络或输入快照。");
    if (!sameScenarioContext(inputManifest, context) || !sameScenarioContext(inputSnapshot, context)) throw new Error("M08 输入清单或结果快照的五字段身份不一致。");
    if (resultEnvelope.factWriteAllowed !== false || resultEnvelope.actionWriteAllowed !== false || resultEnvelope.actionSourceAllowed !== false) throw new Error("M08 非事实结果必须声明事实、行动和行动来源三重禁写。");
    if (resultEnvelope.sideEffectsEmitted !== 0 || payload.sideEffectsEmitted !== 0) throw new Error("M08 非事实结果不得产生外部副作用。");

    const handoff = handoffs[context.scenarioRunId]?.m07?.context;
    if (!handoff || !sameScenarioContext(handoff, context)) throw new Error("M08 返回缺少当前轮次已固定的 M07 交接上下文。");
    if (!sameReferenceFields(inputManifest.objectRef, handoff.objectRef, ["id", "objectTypeRef"])) throw new Error("M08 返回对象与 M07 交接对象不一致。");
    if (!sameReferenceFields(inputManifest.lensRef, handoff.lensRef, ["moduleId", "lensId", "route"])) throw new Error("M08 返回 Lens 与 M07 交接 Lens 不一致。");
    if (!sameReferenceFields(inputManifest.timeRange, handoff.timeRange, ["start", "end"])) throw new Error("M08 返回时间范围与 M07 交接时间范围不一致。");
    if (!sameReferenceFields(inputManifest, handoff, ["dataVersionId", "ontologyVersionId", "bindingId"])) throw new Error("M08 返回数据、语义或 Binding 版本与 M07 交接不一致。");
    if (!sameReferenceFields(inputManifest.seriesRef, handoff.seriesRef, ["id", "ownerObjectId"])) throw new Error("M08 返回系列与 M07 交接系列不一致。");

    const subject = Array.isArray(resultEnvelope.subjectRefs)
      ? resultEnvelope.subjectRefs.find((item) => item?.id === inputManifest.objectRef?.id)
      : Array.isArray(resultEnvelope.subjects)
        ? resultEnvelope.subjects.map((item) => ({ id: item?.objectId || item?.enterpriseId, objectTypeRef: item?.objectTypeRef || "Enterprise" })).find((item) => item.id === inputManifest.objectRef?.id)
        : null;
    if (!subject || !sameReferenceFields(subject, inputManifest.objectRef, ["id", "objectTypeRef"])) throw new Error("M08 结果主体与输入对象不一致。");
    if (!sameReferenceFields(resultEnvelope, inputManifest, ["objectiveId", "objectiveRevisionId", "bindingRevisionId", "releaseId", "modelVersionId"])) throw new Error("M08 结果模型、Objective、Release 或 Binding 谱系与输入清单不一致。");
    if (!sameReferenceFields(inputSnapshot, inputManifest, ["dataVersionId", "ontologyVersionId"])) throw new Error("M08 结果快照版本与输入清单不一致。");
    if (!sameReferenceFields(inputSnapshot.timeRange, inputManifest.timeRange, ["start", "end"])) throw new Error("M08 结果快照时间范围与输入清单不一致。");
    if (resultEnvelope.resultKind === "SIMULATION") {
      if (!payload.simulationRunId || payload.simulationRunId !== resultEnvelope.runId) throw new Error("M08 Simulation Run 标识不一致。");
      if (!payload.simulationResultId || payload.simulationResultId !== resultEnvelope.resultId) throw new Error("M08 Simulation Result 标识不一致。");
    } else if (resultEnvelope.resultKind === "PREDICTION") {
      if (!payload.modelingRunId || payload.modelingRunId !== resultEnvelope.runId) throw new Error("M08 Prediction Run 标识不一致。");
      if (!payload.modelingResultId || payload.modelingResultId !== resultEnvelope.resultId) throw new Error("M08 Prediction Result 标识不一致。");
    } else {
      throw new Error("M08 返回结果类型必须为 PREDICTION 或 SIMULATION。");
    }

    return clone({ scenarioContext: context, inputManifest, resultEnvelope, handoff });
  }

  function updateS005Stage(stageUpdate, scenarioContextValue, moduleOutput) {
    const target = state.scenarios.S005;
    if (!sameScenarioContext(scenarioContextValue, target?.scenarioContext)) throw new Error("阶段更新场景身份与当前 S005 轮次不一致。");
    if (!sameScenarioContext(stageUpdate?.scenarioContext, target?.scenarioContext) || !sameScenarioContext(moduleOutput?.scenarioContext, target?.scenarioContext)) throw new Error("阶段证据或模块输出未绑定当前五字段身份。");
    const stageId = stageUpdate?.stageId;
    const stage = target?.stages?.[stageId];
    if (!stage || !moduleOutput?.outputId) throw new Error(`未知或不可验证的 S005 阶段：${stageId || "未提供"}`);
    if (stageUpdate.evidence?.moduleOutputId !== moduleOutput.outputId) throw new Error("阶段证据未引用当前模块输出。");
    if (stageUpdate.evidence?.moduleId !== moduleOutput.moduleId || stageUpdate.evidence?.eventType !== moduleOutput.eventType) throw new Error("阶段证据的模块或事件类型不一致。");
    if (moduleOutput.boundary?.researchOnly !== true || moduleOutput.boundary?.factWriteAllowed !== false || moduleOutput.boundary?.actionWriteAllowed !== false || moduleOutput.boundary?.externalSideEffects !== 0) throw new Error("模块输出越过候选评价边界。");
    const status = stageUpdate.status;
    const allowed = new Set(["pending", "running", "complete", "verified", "not_applicable", "blocked"]);
    if (!allowed.has(status)) throw new Error(`不支持的阶段状态：${status}`);
    stage.status = status;
    stage.evidence = clone(stageUpdate.evidence);
    stage.updatedAt = moduleOutput.occurredAt;
    return clone(stage);
  }

  function recordS005ModuleEvent(event) {
    if (!EVALUATION) throw new Error("S005 evaluation engine is unavailable.");
    const target = state.scenarios.S005;
    if (!sameScenarioContext(event?.scenarioContext, target.scenarioContext)) throw new Error("模块结果场景身份与当前 S005 轮次不一致。");
    const applied = EVALUATION.applyModuleEvent(target.evaluationState, clone(event));
    target.evaluationState = applied.state;
    updateS005Stage(applied.stageUpdate, event.scenarioContext, applied.moduleOutput);
    persist(true, "s005-module-result");
    return clone({
      moduleOutput: applied.moduleOutput,
      stage: target.stages[applied.stageUpdate.stageId],
      evaluationRun: target.evaluationState.current.evaluationRun,
      evaluationResult: target.evaluationState.current.evaluationResult,
      progress: s005Progress()
    });
  }

  function s005EvaluationProjection() {
    const evaluationState = state.scenarios.S005?.evaluationState;
    return EVALUATION && evaluationState ? EVALUATION.dashboardProjection(evaluationState) : null;
  }

  function s005ModuleProjection(moduleId) {
    const target = state.scenarios.S005;
    if (!EVALUATION || !target?.evaluationState) return null;
    const projection = EVALUATION.moduleProjection(target.evaluationState, moduleId);
    const operationsByModule = {
      M02: [EVALUATION.OPERATIONS.SOURCE_DELIVERY],
      M01: [EVALUATION.OPERATIONS.SEMANTIC_CANDIDATE],
      M03: [EVALUATION.OPERATIONS.COMPLIANCE_EVALUATION, EVALUATION.OPERATIONS.MARKET_PEER_EVALUATION],
      M04: [EVALUATION.OPERATIONS.SELECTION_READ_ONLY],
      M05: [EVALUATION.OPERATIONS.RISK_EXPLANATION],
      M06: [EVALUATION.OPERATIONS.REPORT_DRAFT]
    };
    const outputEventTypes = new Set(projection.outputs.map((output) => output.eventType));
    const actions = (operationsByModule[moduleId] || []).map((operation) => {
      const eventType = EVALUATION.eventTypeForOperation(operation);
      const complete = outputEventTypes.has(eventType);
      const enabled = !complete && projection.expectedEvent?.moduleId === moduleId && projection.expectedEvent?.eventType === eventType;
      return { operation, status: complete ? "complete" : enabled ? "ready" : "pending", enabled, reason: complete ? "当前轮次结果已形成。" : enabled ? "前置模块结果已验证，可以形成当前输出。" : `等待 ${projection.expectedEvent?.moduleId || "前置模块"} 实际结果。` };
    });
    const stages = Object.values(projection.stages);
    const stage = stages.find((item) => item.stageId === projection.expectedEvent?.stageId) || stages.at(-1) || null;
    const previousRun = target.runHistory.at(-1) || null;
    const historyComparison = previousRun?.evaluationResult
      ? {
          status: "available",
          currentScenarioRunId: target.scenarioContext.scenarioRunId,
          currentEvaluationResultId: target.evaluationState.current.evaluationResult?.evaluationResultId || null,
          previousScenarioRunId: previousRun.scenarioContext?.scenarioRunId || null,
          previousEvaluationResultId: previousRun.evaluationResult.evaluationResultId,
          missingReason: null
        }
      : {
          status: "not_applicable",
          currentScenarioRunId: target.scenarioContext.scenarioRunId,
          currentEvaluationResultId: target.evaluationState.current.evaluationResult?.evaluationResultId || null,
          previousScenarioRunId: null,
          previousEvaluationResultId: null,
          missingReason: "当前为首个可比较评价运行，暂无上一轮结果。"
        };
    return clone({
      scenarioContext: target.scenarioContext,
      stage: stage ? { ...stage, title: target.stages[stage.stageId]?.title || stage.stageId } : null,
      actions,
      moduleOutputs: projection.outputs.map((output) => ({ ...output, label: output.eventType, summary: `${output.moduleId} 已回传可验证结果。` })),
      evaluationRun: target.evaluationState.current.evaluationRun,
      evaluationResult: target.evaluationState.current.evaluationResult,
      historyComparison
    });
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
    MODELING_RESEARCH_KEY,
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
    modelingResearchSnapshot,
    modelingWorkspace,
    saveModelingWorkspace,
    saveModelingReturnContext,
    modelingReturnContext,
    saveModelingResult,
    modelingProjection,
    validateM08Return,
    recordS005ModuleEvent,
    s005EvaluationProjection,
    s005ModuleProjection,
    s005Progress
  });
})(window);
