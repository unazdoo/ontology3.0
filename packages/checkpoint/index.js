"use strict";

/*
 * C034 is intentionally a small, storage-agnostic boundary.  The package
 * validates checkpoint references and builds immutable operation receipts; it
 * does not persist a snapshot or own any module state.
 */

const crypto = require("node:crypto");

const CHECKPOINT_SCHEMA_VERSION = "ofw.c034.checkpoint.v1";
const PROVIDER_SPI_VERSION = "c034.provider.v1";

const SIDE_EFFECT_POLICY = Object.freeze({
  allowHistoricalActionRequestReplay: false,
  allowHistoricalNotificationReplay: false,
  allowHistoricalApprovalReplay: false,
  allowHistoricalTodoReplay: false,
  allowExternalDispatch: false
});

const REQUIRED_PROVIDER_METHODS = Object.freeze([
  "export",
  "validate",
  "cloneRestore",
  "isolatedReplay",
  "migrationCompare"
]);

const BLOCKED_REPLAY_KINDS = Object.freeze([
  "actionRequest",
  "notification",
  "approval",
  "todo"
]);

const BLOCKED_COLLECTION_RE = /^(?:(?:historical|pending|replayed|queued)?(?:actionrequests?|notifications?|approvals?|todos?|tasks?)(?:history|records|items|queue)?)$/i;
const BLOCKED_OUTPUT_RE = /^(?:replayed?|replay|dispatched?|dispatch|sent|created).*(?:action|notification|approval|todo|task)/i;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

class CheckpointError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "CheckpointError";
    this.code = code;
    this.details = details || null;
  }
}

function fail(code, message, details) {
  throw new CheckpointError(code, message, details);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value, label) {
  if (value === undefined) fail("INVALID_JSON_VALUE", `${label || "value"} is undefined`);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail("INVALID_JSON_VALUE", `${label || "value"} must be JSON serializable`, {
      cause: error && error.message
    });
  }
}

function deepFreeze(value, seen) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  const visited = seen || new Set();
  if (visited.has(value)) return value;
  visited.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], visited));
  return Object.freeze(value);
}

function immutableJson(value, label) {
  return deepFreeze(cloneJson(value, label));
}

function errorRecord(code, path, message, details) {
  return { code, path, message, ...(details ? { details } : {}) };
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getContext(value) {
  if (!isPlainObject(value)) return null;
  return value.scenarioContext || value.context || value;
}

function validateScenarioContext(value, options) {
  const config = options || {};
  const errors = [];
  if (!isPlainObject(value)) {
    return {
      ok: false,
      errors: [errorRecord("INVALID_SCENARIO_CONTEXT", "$", "scenarioContext must be an object")]
    };
  }

  ["scenarioId", "scenarioVersion", "scenarioRunId"].forEach((field) => {
    if (!nonEmptyString(value[field])) {
      errors.push(errorRecord("MISSING_SCENARIO_CONTEXT_FIELD", field, `${field} is required`));
    }
  });

  if (value.formedAt !== undefined &&
      (!nonEmptyString(value.formedAt) || !ISO_UTC_RE.test(value.formedAt) || Number.isNaN(Date.parse(value.formedAt)))) {
    errors.push(errorRecord("INVALID_FORMED_AT", "formedAt", "formedAt must be a UTC ISO timestamp with milliseconds"));
  }
  if (config.requireFormedAt && value.formedAt === undefined) {
    errors.push(errorRecord("MISSING_SCENARIO_CONTEXT_FIELD", "formedAt", "formedAt is required"));
  }
  if (value.status !== undefined && !nonEmptyString(value.status)) {
    errors.push(errorRecord("INVALID_CONTEXT_STATUS", "status", "status must be a non-empty string"));
  }
  if (config.requireStatus && value.status === undefined) {
    errors.push(errorRecord("MISSING_SCENARIO_CONTEXT_FIELD", "status", "status is required"));
  }

  /* Enforce prefix consistency for the canonical Sxxx forms while retaining
   * compatibility with module-owned identifiers that use another format. */
  if (nonEmptyString(value.scenarioId) && nonEmptyString(value.scenarioVersion)) {
    const scenarioVersionMatch = /^([A-Za-z][A-Za-z0-9_-]*)-v/.exec(value.scenarioVersion);
    if (scenarioVersionMatch && scenarioVersionMatch[1].startsWith("S") && scenarioVersionMatch[1] !== value.scenarioId) {
      errors.push(errorRecord("SCENARIO_VERSION_MISMATCH", "scenarioVersion", "scenarioVersion must belong to scenarioId"));
    }
  }
  if (nonEmptyString(value.scenarioId) && nonEmptyString(value.scenarioRunId)) {
    const runPrefixMatch = /^([A-Za-z][A-Za-z0-9_-]*)-RUN-/.exec(value.scenarioRunId);
    if (runPrefixMatch && runPrefixMatch[1].startsWith("S") && runPrefixMatch[1] !== value.scenarioId) {
      errors.push(errorRecord("SCENARIO_RUN_MISMATCH", "scenarioRunId", "scenarioRunId must belong to scenarioId"));
    }
  }
  return { ok: errors.length === 0, errors };
}

function assertScenarioContext(value, options) {
  const result = validateScenarioContext(value, options);
  if (!result.ok) fail("INVALID_SCENARIO_CONTEXT", "scenarioContext validation failed", result.errors);
  return immutableJson(value, "scenarioContext");
}

function toDate(value, label) {
  const date = value === undefined ? new Date() : value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) fail("INVALID_TIME", `${label || "time"} is invalid`);
  return date;
}

function formatTimestamp17(value) {
  const date = toDate(value, "run formation time");
  const pad = (number, width) => String(number).padStart(width, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1, 2),
    pad(date.getUTCDate(), 2),
    pad(date.getUTCHours(), 2),
    pad(date.getUTCMinutes(), 2),
    pad(date.getUTCSeconds(), 2),
    pad(date.getUTCMilliseconds(), 3)
  ].join("");
}

function toHex(randomValue) {
  if (typeof randomValue === "string") {
    const value = randomValue.toLowerCase();
    if (/^[a-f0-9]{12,}$/.test(value)) return value.slice(0, 12);
  }
  if (randomValue && typeof randomValue.length === "number") {
    const bytes = Array.from(randomValue);
    if (bytes.length >= 6) return bytes.slice(0, 6).map((byte) => Number(byte).toString(16).padStart(2, "0")).join("");
  }
  fail("INVALID_RANDOM_BYTES", "random source must return at least six bytes or twelve hex characters");
}

function createScenarioRunId(scenarioId, options) {
  if (!nonEmptyString(scenarioId)) fail("INVALID_SCENARIO_ID", "scenarioId is required to create a run id");
  const config = options || {};
  const factory = config.runIdFactory || config.scenarioRunIdFactory || config.createScenarioRunId ||
    config.scenarioRunIdGenerator || config.generateRunId || config.idGenerator;
  if (typeof factory === "function") {
    const generated = factory(scenarioId, {
      scenarioId,
      scenarioVersion: config.scenarioVersion,
      sourceScenarioRunId: config.sourceScenarioRunId,
      operation: config.operation
    });
    const value = isPlainObject(generated) ? generated.scenarioRunId : generated;
    if (!nonEmptyString(value)) fail("INVALID_SCENARIO_RUN_ID", "runIdFactory must return a non-empty scenarioRunId");
    return value;
  }
  const randomSource = config.randomBytes || ((size) => crypto.randomBytes(size));
  const suffix = toHex(randomSource(6));
  return `${scenarioId}-RUN-${formatTimestamp17(config.now)}-${suffix}`;
}

function nowIso(value) {
  return toDate(value, "formedAt").toISOString();
}

function validateSideEffectPolicy(value, path) {
  const errors = [];
  if (value === undefined) return errors;
  if (!isPlainObject(value)) {
    return [errorRecord("INVALID_SIDE_EFFECT_POLICY", path, "sideEffectPolicy must be an object")];
  }
  Object.keys(SIDE_EFFECT_POLICY).forEach((key) => {
    if (value[key] !== false) {
      errors.push(errorRecord("HISTORICAL_SIDE_EFFECT_ENABLED", `${path}.${key}`, `${key} must remain false`));
    }
  });
  Object.keys(value).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(SIDE_EFFECT_POLICY, key)) {
      errors.push(errorRecord("UNKNOWN_SIDE_EFFECT_POLICY_FIELD", `${path}.${key}`, "unknown sideEffectPolicy field"));
    }
  });
  return errors;
}

function validateCheckpoint(value, options) {
  const config = options || {};
  const errors = [];
  if (!isPlainObject(value)) {
    return { ok: false, errors: [errorRecord("INVALID_CHECKPOINT", "$", "checkpoint must be an object")] };
  }
  if (config.requireSchemaVersion && value.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    errors.push(errorRecord("INVALID_CHECKPOINT_SCHEMA", "schemaVersion", `schemaVersion must be ${CHECKPOINT_SCHEMA_VERSION}`));
  } else if (value.schemaVersion !== undefined && value.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    errors.push(errorRecord("INVALID_CHECKPOINT_SCHEMA", "schemaVersion", `schemaVersion must be ${CHECKPOINT_SCHEMA_VERSION}`));
  }
  if (value.checkpointId !== undefined && !nonEmptyString(value.checkpointId)) {
    errors.push(errorRecord("INVALID_CHECKPOINT_ID", "checkpointId", "checkpointId must be a non-empty string"));
  }
  const context = getContext(value);
  const contextResult = validateScenarioContext(context, config.contextOptions);
  if (!contextResult.ok) {
    contextResult.errors.forEach((error) => errors.push({ ...error, path: `scenarioContext.${error.path}` }));
  }
  if (value.sourceScenarioRunId !== undefined && value.sourceScenarioRunId !== context?.scenarioRunId) {
    errors.push(errorRecord("SOURCE_RUN_MISMATCH", "sourceScenarioRunId", "sourceScenarioRunId must equal scenarioContext.scenarioRunId"));
  }
  if (value.immutable !== undefined && value.immutable !== true) {
    errors.push(errorRecord("CHECKPOINT_NOT_IMMUTABLE", "immutable", "checkpoint immutable must be true"));
  }
  if (value.restoreReadiness !== undefined) {
    if (!isPlainObject(value.restoreReadiness) || !["verified", "not-verified"].includes(value.restoreReadiness.status)) {
      errors.push(errorRecord("INVALID_RESTORE_READINESS", "restoreReadiness.status", "restoreReadiness.status must be verified or not-verified"));
    }
  }
  errors.push(...validateSideEffectPolicy(value.sideEffectPolicy, "sideEffectPolicy"));
  if (value.overwritesHistory === true || value.overwritesSource === true) {
    errors.push(errorRecord("HISTORY_OVERWRITE", "overwritesHistory", "checkpoint operations may not overwrite historical state"));
  }
  return { ok: errors.length === 0, errors };
}

function assertCheckpoint(value, options) {
  const result = validateCheckpoint(value, options);
  if (!result.ok) fail("INVALID_CHECKPOINT", "checkpoint validation failed", result.errors);
  return immutableJson(value, "checkpoint");
}

function assertRestorableCheckpoint(value, options) {
  const checkpoint = assertCheckpoint(value, options);
  if (checkpoint.restoreReadiness && checkpoint.restoreReadiness.status !== "verified") {
    fail("CHECKPOINT_NOT_RESTORABLE", "checkpoint is not verified for restore", {
      checkpointId: checkpoint.checkpointId || null
    });
  }
  return checkpoint;
}

function isBlockedCollectionKey(key) {
  const normalized = String(key).replace(/[ _-]/g, "");
  return BLOCKED_COLLECTION_RE.test(normalized) || BLOCKED_OUTPUT_RE.test(String(key));
}

function sanitizeHistoricalSideEffects(value, options, path, seen) {
  const config = options || {};
  const currentPath = path || "$";
  const removedPaths = config.removedPaths || [];
  const visited = seen || new WeakMap();
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeHistoricalSideEffects(item, config, `${currentPath}[${index}]`, visited));
  }
  if (!value || typeof value !== "object") return value;
  if (visited.has(value)) return visited.get(value);
  const result = {};
  visited.set(value, result);
  Object.keys(value).forEach((key) => {
    if (isBlockedCollectionKey(key)) {
      removedPaths.push(`${currentPath}.${key}`);
      return;
    }
    result[key] = sanitizeHistoricalSideEffects(value[key], config, `${currentPath}.${key}`, visited);
  });
  return result;
}

function findUnsafeSideEffects(value, path, seen, findings) {
  const currentPath = path || "$";
  const visited = seen || new WeakSet();
  const result = findings || [];
  if (!value || typeof value !== "object") return result;
  if (visited.has(value)) return result;
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => findUnsafeSideEffects(item, `${currentPath}[${index}]`, visited, result));
    return result;
  }
  Object.keys(value).forEach((key) => {
    const child = value[key];
    const normalized = key.toLowerCase().replace(/[ _-]/g, "");
    const isReplayFlag = ["replayhistoricalsideeffects", "replayedsideeffects", "sideeffectsreplayed"].includes(normalized);
    const isOverwriteFlag = ["overwriteshistory", "overwritessource"].includes(normalized);
    const isPolicyFlag = /^allow.*(?:replay|dispatch)$/.test(normalized);
    const isGenericDispatchOutput = ["dispatches", "externaldispatches", "outboundevents", "sideeffects", "emittednotifications", "sentnotifications"].includes(normalized);
    if (isReplayFlag && (child === true || (Array.isArray(child) && child.length > 0) || (isPlainObject(child) && Object.keys(child).length > 0))) {
      result.push({ path: `${currentPath}.${key}`, reason: "historical side effect replay" });
    }
    if (isOverwriteFlag && child === true) {
      result.push({ path: `${currentPath}.${key}`, reason: "history overwrite" });
    }
    if (isPolicyFlag && child === true) {
      result.push({ path: `${currentPath}.${key}`, reason: "forbidden side-effect policy" });
    }
    if (isGenericDispatchOutput && (child === true || (Array.isArray(child) && child.length > 0) || (isPlainObject(child) && Object.keys(child).length > 0))) {
      result.push({ path: `${currentPath}.${key}`, reason: "blocked dispatch output" });
    }
    if (BLOCKED_OUTPUT_RE.test(key) && (child === true || (Array.isArray(child) && child.length > 0) || (isPlainObject(child) && Object.keys(child).length > 0))) {
      result.push({ path: `${currentPath}.${key}`, reason: "blocked dispatch/replay output" });
    }
    findUnsafeSideEffects(child, `${currentPath}.${key}`, visited, result);
  });
  return result;
}

function assertNoHistoricalSideEffects(value) {
  const findings = findUnsafeSideEffects(value);
  if (findings.length) {
    fail("HISTORICAL_SIDE_EFFECT_REPLAY", "historical Action Request, notification, approval or todo replay is forbidden", findings);
  }
  return true;
}

function createSideEffectGuard(metadata) {
  const info = metadata || {};
  const blocked = (kind) => {
    fail("HISTORICAL_SIDE_EFFECT_REPLAY", `${kind || "historical"} side effect is disabled during checkpoint recovery`);
  };
  return Object.freeze({
    mode: info.mode || "checkpoint-operation",
    sourceScenarioRunId: info.sourceScenarioRunId || null,
    targetScenarioRunId: info.targetScenarioRunId || null,
    policy: SIDE_EFFECT_POLICY,
    sideEffectPolicy: SIDE_EFFECT_POLICY,
    assertNoReplay: assertNoHistoricalSideEffects,
    assertAllowed: blocked,
    replay: blocked,
    dispatch: blocked,
    emit: blocked,
    sendNotification: () => blocked("notification"),
    createActionRequest: () => blocked("Action Request"),
    createApproval: () => blocked("approval"),
    createTodo: () => blocked("todo")
  });
}

function deriveContext(sourceContext, status, options) {
  const config = options || {};
  const source = assertScenarioContext(sourceContext);
  const requestedRunId = config.targetScenarioRunId || config.newScenarioRunId || config.scenarioRunId;
  let runId = requestedRunId || createScenarioRunId(source.scenarioId, {
      ...config,
      scenarioVersion: config.scenarioVersion || source.scenarioVersion,
      sourceScenarioRunId: source.scenarioRunId,
      operation: config.operation || status
    });
  if (!nonEmptyString(runId)) fail("INVALID_SCENARIO_RUN_ID", "target scenarioRunId must be non-empty");
  if (runId === source.scenarioRunId) {
    fail("SCENARIO_RUN_REUSED", "recovery must create a new scenarioRunId", {
      sourceScenarioRunId: source.scenarioRunId
    });
  }
  const context = {
    ...source,
    scenarioRunId: runId,
    status: status || source.status || "restored"
  };
  if (config.scenarioVersion) context.scenarioVersion = config.scenarioVersion;
  if (config.now !== undefined || source.formedAt !== undefined) context.formedAt = nowIso(config.now);
  return assertScenarioContext(context);
}

function parseRestoreArgs(input, options) {
  const isRequest = isPlainObject(input) && (
    Object.prototype.hasOwnProperty.call(input, "checkpoint") ||
    Object.prototype.hasOwnProperty.call(input, "sourceCheckpoint")
  );
  const request = isRequest ? input : {};
  const checkpoint = isRequest ? (input.checkpoint || input.sourceCheckpoint) : input;
  const mergedOptions = {
    ...(isRequest ? {
      now: input.now,
      randomBytes: input.randomBytes,
      runIdFactory: input.runIdFactory,
      scenarioRunIdFactory: input.scenarioRunIdFactory,
      createScenarioRunId: input.createScenarioRunId,
      scenarioRunIdGenerator: input.scenarioRunIdGenerator,
      generateRunId: input.generateRunId,
      idGenerator: input.idGenerator,
      targetScenarioRunId: input.targetScenarioRunId,
      newScenarioRunId: input.newScenarioRunId,
      scenarioRunId: input.scenarioRunId,
      scenarioVersion: input.scenarioVersion,
      requireSchemaVersion: input.requireSchemaVersion,
      validationOptions: input.validationOptions
    } : {}),
    ...(isRequest && isPlainObject(input.options) ? input.options : {}),
    ...(options || {})
  };
  Object.keys(mergedOptions).forEach((key) => {
    if (mergedOptions[key] === undefined) delete mergedOptions[key];
  });
  return { request, checkpoint, options: mergedOptions };
}

function createRestorePlan(checkpointValue, mode, status, options) {
  const config = options || {};
  const checkpoint = assertRestorableCheckpoint(checkpointValue, {
    ...(config.validationOptions || {}),
    ...(config.requireSchemaVersion !== undefined ? { requireSchemaVersion: config.requireSchemaVersion } : {})
  });
  const sourceContext = getContext(checkpoint);
  const context = deriveContext(sourceContext, status, {
    ...config,
    operation: mode,
    scenarioVersion: config.scenarioVersion || sourceContext.scenarioVersion
  });
  const removedPaths = [];
  const sanitizedCheckpoint = immutableJson(
    sanitizeHistoricalSideEffects(checkpoint, { removedPaths }),
    "sanitized checkpoint"
  );
  const guard = createSideEffectGuard({
    mode,
    sourceScenarioRunId: sourceContext.scenarioRunId,
    targetScenarioRunId: context.scenarioRunId
  });
  const operationId = `${mode}-${context.scenarioRunId}`;
  return deepFreeze({
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    mode,
    operationId,
    sourceCheckpointId: checkpoint.checkpointId || null,
    sourceScenarioRunId: sourceContext.scenarioRunId,
    targetScenarioRunId: context.scenarioRunId,
    scenarioRunId: context.scenarioRunId,
    newScenarioRunId: context.scenarioRunId,
    scenarioContext: context,
    context,
    overwritesHistory: false,
    overwritesSource: false,
    writesHistoricalProjection: false,
    requiresEmptyIsolatedNamespace: true,
    externalCapabilitiesDefault: "disabled",
    replayHistoricalSideEffects: false,
    replayedSideEffects: [],
    sideEffectsSuppressed: true,
    sideEffectPolicy: SIDE_EFFECT_POLICY,
    removedHistoricalSideEffectPaths: removedPaths,
    restoreInput: sanitizedCheckpoint,
    guard,
    restoreMode: mode === "clone-restore" ? "isolated-clone" : "isolated-replay"
  });
}

function unsafePolicy(value) {
  const errors = validateSideEffectPolicy(value, "sideEffectPolicy");
  return errors.length > 0;
}

function finalizeProtectedResult(delegateResult, plan) {
  if (delegateResult !== undefined) {
    assertNoHistoricalSideEffects(delegateResult);
    if (isPlainObject(delegateResult) && unsafePolicy(delegateResult.sideEffectPolicy)) {
      fail("HISTORICAL_SIDE_EFFECT_REPLAY", "delegate enabled a forbidden side effect", {
        sideEffectPolicy: delegateResult.sideEffectPolicy
      });
    }
  }
  const extra = isPlainObject(delegateResult)
    ? immutableJson(delegateResult, "provider result")
    : delegateResult === undefined
      ? {}
      : { providerResult: delegateResult };
  const result = {
    ...extra,
    ...plan,
    delegateResult: delegateResult === undefined ? null : extra,
    /* Canonical safety fields are written last and cannot be overridden by an
     * adapter response. */
    overwritesHistory: false,
    overwritesSource: false,
    replayHistoricalSideEffects: false,
    replayedSideEffects: [],
    sideEffectsSuppressed: true,
    sideEffectPolicy: SIDE_EFFECT_POLICY
  };
  return deepFreeze(result);
}

function mapMaybe(value, mapper) {
  if (value && typeof value.then === "function") return Promise.resolve(value).then(mapper);
  return mapper(value);
}

function invokeProtectedRestore(implementation, methodName, parsed, mode, status, providerOptions) {
  const config = { ...(providerOptions || {}), ...(parsed.options || {}) };
  const plan = createRestorePlan(parsed.checkpoint, mode, status, config);
  const method = implementation && implementation[methodName];
  if (typeof method !== "function") return deepFreeze(plan);
  const delegateRequest = {
    ...parsed.request,
    checkpoint: plan.restoreInput,
    sourceCheckpoint: plan.restoreInput,
    sourceScenarioRunId: plan.sourceScenarioRunId,
    targetScenarioRunId: plan.targetScenarioRunId,
    scenarioContext: plan.scenarioContext,
    targetScenarioContext: plan.scenarioContext,
    sideEffectPolicy: SIDE_EFFECT_POLICY,
    replayHistoricalSideEffects: false,
    allowHistoricalReplay: false,
    allowExternalDispatch: false,
    guard: plan.guard
  };
  return mapMaybe(method.call(implementation, delegateRequest), (delegateResult) => finalizeProtectedResult(delegateResult, plan));
}

function cloneRestore(input, options) {
  const parsed = parseRestoreArgs(input, options);
  return invokeProtectedRestore({}, "cloneRestore", parsed, "clone-restore", "restored", {});
}

function isolatedReplay(input, options) {
  const parsed = parseRestoreArgs(input, options);
  return invokeProtectedRestore({}, "isolatedReplay", parsed, "isolated-replay", "regression", {});
}

function createIsolatedRegression(input, options) {
  return isolatedReplay(input, options);
}

function extractMigrationSide(value, role) {
  if (!isPlainObject(value)) fail("INVALID_MIGRATION_INPUT", `${role} migration side must be an object`);
  const context = getContext(value) || {};
  const side = {
    checkpointId: value.checkpointId,
    scenarioId: value.scenarioId || context.scenarioId,
    scenarioVersion: value.scenarioVersion || context.scenarioVersion,
    scenarioRunId: value.scenarioRunId || context.scenarioRunId,
    baselineVersion: value.baselineVersion || value.targetBaselineVersion,
    baselineSnapshotId: value.baselineSnapshotId || value.targetBaselineSnapshotId
  };
  ["scenarioId", "scenarioVersion", "baselineVersion", "baselineSnapshotId"].forEach((field) => {
    if (!nonEmptyString(side[field])) fail("INVALID_MIGRATION_INPUT", `${role}.${field} is required`, { field, role });
  });
  if (side.scenarioRunId !== undefined && !nonEmptyString(side.scenarioRunId)) {
    fail("INVALID_MIGRATION_INPUT", `${role}.scenarioRunId must be a non-empty string`);
  }
  return side;
}

function compareNumericVersion(left, right) {
  const parse = (value) => {
    const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value);
    return match ? [Number(match[1]), Number(match[2] || 0), Number(match[3] || 0)] : null;
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return b[index] > a[index] ? 1 : -1;
  }
  return 0;
}

function parseMigrationArgs(sourceOrRequest, targetOrOptions, maybeOptions) {
  if (arguments.length >= 2 && isPlainObject(targetOrOptions) && isPlainObject(targetOrOptions.target)) {
    return {
      source: sourceOrRequest,
      target: targetOrOptions.target,
      options: {
        ...targetOrOptions,
        ...(isPlainObject(targetOrOptions.options) ? targetOrOptions.options : {}),
        ...(maybeOptions || {})
      }
    };
  }
  if (arguments.length >= 2 && isPlainObject(targetOrOptions) && (
    Object.prototype.hasOwnProperty.call(targetOrOptions, "scenarioVersion") ||
    Object.prototype.hasOwnProperty.call(targetOrOptions, "scenarioContext") ||
    Object.prototype.hasOwnProperty.call(targetOrOptions, "baselineVersion") ||
    Object.prototype.hasOwnProperty.call(targetOrOptions, "targetScenarioVersion") ||
    Object.prototype.hasOwnProperty.call(targetOrOptions, "targetBaselineVersion") ||
    Object.prototype.hasOwnProperty.call(targetOrOptions, "targetBaselineSnapshotId")
  )) {
    const target = Object.prototype.hasOwnProperty.call(targetOrOptions, "targetScenarioVersion")
      ? {
          ...targetOrOptions,
          scenarioId: targetOrOptions.scenarioId || getContext(sourceOrRequest)?.scenarioId,
          scenarioVersion: targetOrOptions.scenarioVersion || targetOrOptions.targetScenarioVersion,
          baselineVersion: targetOrOptions.baselineVersion || targetOrOptions.targetBaselineVersion,
          baselineSnapshotId: targetOrOptions.baselineSnapshotId || targetOrOptions.targetBaselineSnapshotId
        }
      : targetOrOptions;
    return {
      source: sourceOrRequest,
      target,
      options: {
        ...targetOrOptions,
        ...(isPlainObject(targetOrOptions.options) ? targetOrOptions.options : {}),
        ...(maybeOptions || {})
      }
    };
  }
  const request = isPlainObject(sourceOrRequest) ? sourceOrRequest : {};
  const requestTarget = request.target || request.to || request.targetCheckpoint || (
    request.targetScenarioVersion || request.targetBaselineVersion || request.targetBaselineSnapshotId
      ? {
          ...request,
          scenarioId: request.scenarioId || getContext(request.source || request.from || request.checkpoint)?.scenarioId,
          scenarioVersion: request.targetScenarioVersion,
          baselineVersion: request.targetBaselineVersion,
          baselineSnapshotId: request.targetBaselineSnapshotId
        }
      : undefined
  );
  return {
    source: request.source || request.from || request.sourceCheckpoint || request.checkpoint,
    target: requestTarget,
    options: {
      ...request,
      ...(isPlainObject(request.options) ? request.options : {}),
      ...(isPlainObject(targetOrOptions) ? targetOrOptions : {})
    }
  };
}

function migrationCompare(sourceOrRequest, targetOrOptions, maybeOptions) {
  const parsed = parseMigrationArgs(sourceOrRequest, targetOrOptions, maybeOptions);
  const source = extractMigrationSide(parsed.source, "source");
  const target = extractMigrationSide(parsed.target, "target");
  if (source.scenarioId !== target.scenarioId) {
    fail("SCENARIO_ID_MISMATCH", "migration source and target must belong to the same scenarioId", {
      sourceScenarioId: source.scenarioId,
      targetScenarioId: target.scenarioId
    });
  }
  if (source.scenarioVersion === target.scenarioVersion) {
    fail("IN_PLACE_SCENARIO_VERSION_MIGRATION", "migration must create a new scenarioVersion");
  }
  if (source.baselineVersion === target.baselineVersion && source.baselineSnapshotId === target.baselineSnapshotId) {
    fail("UNCHANGED_BASELINE", "migration target must change baselineVersion or baselineSnapshotId");
  }
  const baselineDirection = compareNumericVersion(source.baselineVersion, target.baselineVersion);
  if (baselineDirection === -1 && !parsed.options.allowDowngrade) {
    fail("MIGRATION_VERSION_REGRESSION", "target baselineVersion cannot be older than source baselineVersion");
  }
  const sourceScenarioNumber = /-v(\d+(?:\.\d+)*)$/.exec(source.scenarioVersion);
  const targetScenarioNumber = /-v(\d+(?:\.\d+)*)$/.exec(target.scenarioVersion);
  if (sourceScenarioNumber && targetScenarioNumber && compareNumericVersion(sourceScenarioNumber[1], targetScenarioNumber[1]) === -1 && !parsed.options.allowDowngrade) {
    fail("MIGRATION_VERSION_REGRESSION", "target scenarioVersion cannot be older than source scenarioVersion");
  }
  let targetScenarioRunId = target.scenarioRunId;
  if (!targetScenarioRunId) {
    targetScenarioRunId = createScenarioRunId(target.scenarioId, {
      ...parsed.options,
      scenarioVersion: target.scenarioVersion,
      sourceScenarioRunId: source.scenarioRunId,
      operation: "migration-compare"
    });
  }
  if (source.scenarioRunId && targetScenarioRunId === source.scenarioRunId) {
    fail("SCENARIO_RUN_REUSED", "migration must create a new scenarioRunId");
  }
  const differences = ["baselineVersion", "baselineSnapshotId", "scenarioVersion", "scenarioRunId"].filter((field) => {
    const targetValue = field === "scenarioRunId" ? targetScenarioRunId : target[field];
    return source[field] !== targetValue;
  });
  const result = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    mode: "migration-compare",
    allowed: true,
    compatible: true,
    differences,
    source: { ...source },
    target: { ...target, scenarioRunId: targetScenarioRunId },
    sourceScenarioRunId: source.scenarioRunId || null,
    targetScenarioRunId,
    scenarioRunId: targetScenarioRunId,
    newScenarioRunId: targetScenarioRunId,
    overwritesSource: false,
    requiresNewCheckpoint: true,
    sideEffectsSuppressed: true,
    sideEffectPolicy: SIDE_EFFECT_POLICY
  };
  return deepFreeze(result);
}

function normalizeValidationResult(value) {
  if (typeof value === "boolean") return { ok: value, errors: value ? [] : [errorRecord("PROVIDER_VALIDATION_FAILED", "$", "provider validation failed")] };
  if (isPlainObject(value) && typeof value.ok === "boolean") {
    return { ok: value.ok, errors: Array.isArray(value.errors) ? value.errors : [] };
  }
  fail("INVALID_PROVIDER_VALIDATION_RESULT", "provider validate() must return a boolean or { ok, errors }");
}

function createCheckpointProvider(implementation, options) {
  const impl = implementation && typeof implementation === "object" ? implementation : {};
  const providerOptions = options || {};
  if (providerOptions.requireAllMethods) assertProvider(impl);

  const provider = {
    spiVersion: PROVIDER_SPI_VERSION,
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    export(request) {
      if (typeof impl.export !== "function") fail("NOT_IMPLEMENTED", "C034 export is not implemented");
      const input = isPlainObject(request) ? { ...request, sideEffectPolicy: SIDE_EFFECT_POLICY } : request;
      return mapMaybe(impl.export.call(impl, input), (result) => {
        const checkpoint = isPlainObject(result) && Object.prototype.hasOwnProperty.call(result, "checkpoint")
          ? result.checkpoint
          : result;
        const validation = validateCheckpoint(checkpoint, { requireSchemaVersion: providerOptions.requireSchemaVersion });
        if (!validation.ok) fail("INVALID_EXPORT", "provider export returned an invalid checkpoint", validation.errors);
        if (isPlainObject(result) && Object.prototype.hasOwnProperty.call(result, "checkpoint")) {
          return deepFreeze({ ...immutableJson(result, "export result"), checkpoint: immutableJson(checkpoint, "checkpoint") });
        }
        return immutableJson(checkpoint, "checkpoint");
      });
    },
    validate(checkpoint, validationOptions) {
      const structural = validateCheckpoint(checkpoint, {
        ...validationOptions,
        requireSchemaVersion: validationOptions && Object.prototype.hasOwnProperty.call(validationOptions, "requireSchemaVersion")
          ? validationOptions.requireSchemaVersion
          : providerOptions.requireSchemaVersion
      });
      if (!structural.ok) return structural;
      if (typeof impl.validate !== "function") return structural;
      return mapMaybe(impl.validate.call(impl, checkpoint, validationOptions || {}), (value) => {
        const normalized = normalizeValidationResult(value);
        return {
          ok: structural.ok && normalized.ok,
          errors: [...structural.errors, ...normalized.errors]
        };
      });
    },
    cloneRestore(input, restoreOptions) {
      const parsed = parseRestoreArgs(input, restoreOptions);
      return invokeProtectedRestore(impl, "cloneRestore", parsed, "clone-restore", "restored", providerOptions);
    },
    isolatedReplay(input, replayOptions) {
      const parsed = parseRestoreArgs(input, replayOptions);
      return invokeProtectedRestore(impl, "isolatedReplay", parsed, "isolated-replay", "regression", providerOptions);
    },
    migrationCompare(sourceOrRequest, targetOrOptions, maybeOptions) {
      const baseline = migrationCompare(sourceOrRequest, targetOrOptions, maybeOptions);
      if (typeof impl.migrationCompare !== "function") return baseline;
      const guard = createSideEffectGuard({
        mode: "migration-compare",
        sourceScenarioRunId: baseline.sourceScenarioRunId,
        targetScenarioRunId: baseline.targetScenarioRunId
      });
      const request = {
        source: baseline.source,
        target: baseline.target,
        comparison: baseline,
        sideEffectPolicy: SIDE_EFFECT_POLICY,
        guard
      };
      return mapMaybe(impl.migrationCompare.call(impl, request), (delegateResult) => {
        assertNoHistoricalSideEffects(delegateResult);
        return deepFreeze({
          ...(isPlainObject(delegateResult) ? immutableJson(delegateResult, "migration comparison") : { providerResult: delegateResult }),
          ...baseline,
          sideEffectPolicy: SIDE_EFFECT_POLICY,
          overwritesSource: false,
          sideEffectsSuppressed: true
        });
      });
    }
  };
  return Object.freeze(provider);
}

function assertProvider(provider) {
  if (!provider || typeof provider !== "object") fail("PROVIDER_INTERFACE_INVALID", "provider must be an object");
  const missing = REQUIRED_PROVIDER_METHODS.filter((method) => typeof provider[method] !== "function");
  if (missing.length) fail("PROVIDER_INTERFACE_INVALID", "provider is missing required C034 methods", { missing });
  return true;
}

function exportCheckpoint(providerOrImplementation, request) {
  const provider = providerOrImplementation && providerOrImplementation.spiVersion === PROVIDER_SPI_VERSION &&
    typeof providerOrImplementation.export === "function"
    ? providerOrImplementation
    : createCheckpointProvider(providerOrImplementation);
  return provider.export(request);
}

const api = {
  CHECKPOINT_SCHEMA_VERSION,
  PROVIDER_SPI_VERSION,
  C034_PROVIDER_VERSION: PROVIDER_SPI_VERSION,
  SIDE_EFFECT_POLICY,
  REQUIRED_PROVIDER_METHODS,
  BLOCKED_REPLAY_KINDS,
  CheckpointError,
  validateScenarioContext,
  assertScenarioContext,
  createScenarioRunId,
  validateCheckpoint,
  validate: validateCheckpoint,
  assertCheckpoint,
  assertRestorableCheckpoint,
  sanitizeHistoricalSideEffects,
  assertNoHistoricalSideEffects,
  createSideEffectGuard,
  createRestorePlan,
  cloneRestore,
  isolatedReplay,
  createIsolatedRegression,
  migrationCompare,
  exportCheckpoint,
  createCheckpointProvider,
  createProvider: createCheckpointProvider,
  defineProvider: createCheckpointProvider,
  CheckpointProvider: createCheckpointProvider,
  C034Provider: createCheckpointProvider,
  assertProvider
};

/* `export` is a valid object key even though it is a reserved declaration
 * word.  Keeping this alias makes the standalone SPI convenient to consume. */
api.export = exportCheckpoint;

module.exports = Object.freeze(api);
