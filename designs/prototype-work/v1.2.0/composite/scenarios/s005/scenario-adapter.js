(function initS005ScenarioAdapter(root, factory) {
  const configApi = root && root.OFWS005ScenarioConfig
    ? root.OFWS005ScenarioConfig
    : (typeof require === "function" ? require("./scenario-config.js") : null);
  const api = factory(configApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.OFWS005ScenarioAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createS005ScenarioAdapter(configApi) {
  "use strict";

  if (!configApi || !configApi.config) throw new Error("S005 scenario config is required");

  const { config, workflow } = configApi;
  const RUN_ID_RE = /^S005-RUN-[0-9]{17}-[a-f0-9]{12}$/;
  const VERSION_RE = /^S005-v(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*))*$/;
  const TERMINAL_STAGE_STATES = new Set(["complete", "verified", "not_applicable"]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function timestamp17(input) {
    const date = input instanceof Date ? input : new Date(input || Date.now());
    if (Number.isNaN(date.getTime())) throw new Error("Invalid context timestamp");
    const iso = date.toISOString();
    return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}${iso.slice(20, 23)}`;
  }

  function randomHex12(randomBytes) {
    const bytes = typeof randomBytes === "function" ? randomBytes(6) : defaultRandomBytes(6);
    if (!bytes || bytes.length !== 6) throw new Error("randomBytes must return six bytes");
    return Array.from(bytes, (value) => Number(value).toString(16).padStart(2, "0")).join("");
  }

  function defaultRandomBytes(size) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    }
    try {
      return require("node:crypto").randomBytes(size);
    } catch (_error) {
      return Uint8Array.from({ length: size }, (_unused, index) => (index * 53 + 17) % 256);
    }
  }

  function createScenarioRunId(options) {
    const input = options || {};
    return `S005-RUN-${timestamp17(input.now)}-${randomHex12(input.randomBytes)}`;
  }

  function validateScenarioContext(input) {
    const errors = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["scenarioContext must be an object"] };
    const keys = Object.keys(input).sort();
    const expected = ["formedAt", "scenarioId", "scenarioRunId", "scenarioVersion", "status"].sort();
    if (keys.join("|") !== expected.join("|")) errors.push("scenarioContext must contain exactly five fields");
    if (input.scenarioId !== config.scenarioId) errors.push("scenarioId must be S005");
    if (!VERSION_RE.test(input.scenarioVersion || "") || input.scenarioVersion !== config.scenarioVersion) errors.push("scenarioVersion must be S005-v1");
    if (!RUN_ID_RE.test(input.scenarioRunId || "")) errors.push("scenarioRunId format is invalid");
    if (typeof input.formedAt !== "string" || Number.isNaN(Date.parse(input.formedAt))) errors.push("formedAt must be an ISO timestamp");
    if (input.status !== "active") errors.push("status must be active");
    return { ok: errors.length === 0, errors };
  }

  function assertScenarioContext(input) {
    const result = validateScenarioContext(input);
    if (!result.ok) throw new Error(result.errors.join("; "));
    return clone(input);
  }

  function createScenarioContext(options) {
    const input = options || {};
    const now = input.now instanceof Date ? input.now : new Date(input.now || Date.now());
    return Object.freeze({
      scenarioId: config.scenarioId,
      scenarioVersion: config.scenarioVersion,
      scenarioRunId: createScenarioRunId({ now, randomBytes: input.randomBytes }),
      formedAt: now.toISOString(),
      status: "active"
    });
  }

  function initialStages() {
    return Object.fromEntries(workflow.map((step) => [step.id, {
      stageId: step.id,
      moduleId: step.moduleId,
      status: "pending",
      evidence: null,
      updatedAt: null
    }]));
  }

  function restoredStages(input) {
    const next = initialStages();
    if (!input) return next;
    if (typeof input !== "object" || Array.isArray(input)) throw new Error("restored stages must be an object");
    workflow.forEach((step) => {
      const stage = input[step.id];
      if (!stage) return;
      const allowed = new Set(["pending", "running", "complete", "verified", "not_applicable"]);
      if (!allowed.has(stage.status)) throw new Error(`Unsupported restored stage status: ${stage.status}`);
      next[step.id] = {
        stageId: step.id,
        moduleId: step.moduleId,
        status: stage.status,
        evidence: stage.evidence || null,
        updatedAt: stage.updatedAt || null
      };
    });
    return next;
  }

  function restoredHistory(input) {
    if (input == null) return [];
    if (!Array.isArray(input)) throw new Error("restored history must be an array");
    input.forEach((entry) => assertScenarioContext(entry && entry.scenarioContext));
    return clone(input);
  }

  function createRuntime(options) {
    const input = options || {};
    const restored = input.restoredState && typeof input.restoredState === "object" ? input.restoredState : null;
    let context = input.context || restored?.scenarioContext
      ? Object.freeze(assertScenarioContext(input.context || restored.scenarioContext))
      : createScenarioContext(input);
    let stages = restoredStages(restored?.stages);
    const history = restoredHistory(input.history || restored?.history);
    const emit = typeof input.emit === "function" ? input.emit : function noOp() {};
    const persist = typeof input.persist === "function" ? input.persist : function noOp() {};

    function snapshot() {
      const completed = Object.values(stages).filter((stage) => TERMINAL_STAGE_STATES.has(stage.status)).length;
      return Object.freeze({
        scenarioContext: clone(context),
        completed,
        total: workflow.length,
        status: completed === workflow.length ? "research-draft" : completed ? "in-progress" : "pending",
        stages: clone(stages),
        historyCount: history.length
      });
    }

    function serialize() {
      return Object.freeze({
        scenarioContext: clone(context),
        stages: clone(stages),
        history: clone(history)
      });
    }

    function publish() {
      const next = snapshot();
      emit("OFW_S005_STATE_CHANGED", next);
      persist(serialize());
      return next;
    }

    function updateStage(stageId, status, evidence, at) {
      const step = workflow.find((candidate) => candidate.id === stageId);
      if (!step) throw new Error(`Unknown S005 stage: ${stageId}`);
      if (step.prerequisite && !TERMINAL_STAGE_STATES.has(stages[step.prerequisite].status)) {
        throw new Error(`Stage ${stageId} requires ${step.prerequisite}`);
      }
      const allowed = new Set(["running", "complete", "verified", "not_applicable"]);
      if (!allowed.has(status)) throw new Error(`Unsupported stage status: ${status}`);
      stages[stageId] = {
        ...stages[stageId],
        status,
        evidence: evidence || null,
        updatedAt: (at instanceof Date ? at : new Date(at || Date.now())).toISOString()
      };
      return publish();
    }

    function reset(optionsForReset) {
      const previous = snapshot();
      history.push(previous);
      context = createScenarioContext(optionsForReset || {});
      stages = initialStages();
      const receipt = Object.freeze({
        scope: "current S005 scenario run only",
        previousScenarioRunId: previous.scenarioContext.scenarioRunId,
        scenarioRunId: context.scenarioRunId,
        preservedHistoricalRuns: history.length,
        touchedModules: [],
        externalSideEffects: 0
      });
      publish();
      return receipt;
    }

    return Object.freeze({
      getContext: () => clone(context),
      getState: snapshot,
      getHistory: () => clone(history),
      serialize,
      updateStage,
      reset
    });
  }

  function validateMountInput(moduleId, input) {
    const mount = config.optionalMounts[moduleId];
    if (!mount) return { ok: false, errors: [`Unsupported optional mount: ${moduleId}`] };
    const errors = [];
    const value = input && typeof input === "object" ? input : {};
    mount.requiredInput.forEach((field) => {
      if (!(field in value) || value[field] === null || value[field] === "") errors.push(`Missing ${moduleId} input: ${field}`);
    });
    const contextValidation = validateScenarioContext(value.scenarioContext);
    if (!contextValidation.ok) errors.push(...contextValidation.errors.map((error) => `${moduleId}: ${error}`));
    if (moduleId === "M08" && !mount.allowedResultKinds.includes(value.resultKind)) errors.push("M08 resultKind must be PREDICTION or SIMULATION");
    return { ok: errors.length === 0, errors };
  }

  function createNavigationEnvelope(moduleId, payload) {
    const allowed = new Set([...config.modules, ...Object.keys(config.optionalMounts)]);
    if (!allowed.has(moduleId)) throw new Error(`Unknown target module: ${moduleId}`);
    if (config.optionalMounts[moduleId]) {
      const validation = validateMountInput(moduleId, payload);
      if (!validation.ok) throw new Error(validation.errors.join("; "));
    } else {
      assertScenarioContext(payload && payload.scenarioContext);
    }
    return Object.freeze({
      type: "OFW_S005_OPEN_MODULE",
      moduleId,
      routeId: config.optionalMounts[moduleId] ? config.optionalMounts[moduleId].routeId : `module/${moduleId.toLowerCase()}`,
      payload: clone(payload)
    });
  }

  return Object.freeze({
    RUN_ID_RE,
    createScenarioRunId,
    createScenarioContext,
    validateScenarioContext,
    assertScenarioContext,
    createRuntime,
    validateMountInput,
    createNavigationEnvelope
  });
});
