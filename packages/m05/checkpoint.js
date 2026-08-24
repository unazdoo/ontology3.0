'use strict';

const crypto = require('node:crypto');
const {
  isRecord, isNonEmptyString, clone, immutable, sha256, issue, validation, fail, nowIso,
  assertNoForbiddenPayload
} = require('./util');
const { validateAgentRelease, assertAgentRelease } = require('../agent-release');
const strictReleaseBoundary = require('../agent-release');

const C034_SCHEMA_VERSION = 'ofw.m05.c034.checkpoint.v1';
const C034_PROVIDER_VERSION = 'c034.provider.v1';
const C034_CONTRACT_VERSION = 'draft-0.1.0';
const SIDE_EFFECT_POLICY = Object.freeze({
  allowHistoricalActionRequestReplay: false,
  allowHistoricalNotificationReplay: false,
  allowHistoricalApprovalReplay: false,
  allowHistoricalTodoReplay: false,
  allowExternalDispatch: false,
  allowAutoRun: false,
  allowAutoToolInvocation: false
});

function scenarioContext(value) {
  const source = value?.scenarioContext || value;
  if (!isRecord(source)) return null;
  return { scenarioId: source.scenarioId, scenarioVersion: source.scenarioVersion, scenarioRunId: source.scenarioRunId, formedAt: source.formedAt, status: source.status };
}

function validateContext(value, path = 'scenarioContext') {
  const context = scenarioContext(value);
  const errors = [];
  if (!context) return [issue(path, 'type', 'scenario context must be an object')];
  ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'].forEach((field) => { if (!isNonEmptyString(context[field])) errors.push(issue(`${path}.${field}`, 'required', `${field} is required`)); });
  if (context.formedAt && Number.isNaN(Date.parse(context.formedAt))) errors.push(issue(`${path}.formedAt`, 'format', 'formedAt must be RFC 3339'));
  return errors;
}

function safeState(state = {}) {
  if (!isRecord(state)) return {};
  const output = {};
  const project = (value, kind) => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      if (!isRecord(item)) return null;
      const result = { kind, id: item.requestId || item.bindingId || item.sessionId || item.runId || item.resultId || item.id || null };
      ['status', 'state', 'attempt', 'requestId', 'bindingId', 'bindingVersion', 'sessionId', 'runId', 'resultId', 'resultType', 'releaseRef', 'reportContext', 'inputFingerprint', 'fingerprint', 'createdAt', 'completedAt', 'failedAt', 'retryOf', 'historicalAt'].forEach((key) => { if (item[key] !== undefined) result[key] = clone(item[key]); });
      // Do not export questions, prompts, report text, generated prose or raw
      // payloads. The immutable evidence/context references remain auditable.
      return result;
    }).filter(Boolean);
  };
  if (state.requests) output.requests = project(state.requests, 'request');
  if (state.bindings) output.bindings = project(state.bindings, 'binding');
  if (state.sessions) output.sessions = project(state.sessions, 'session');
  if (state.runs) output.runs = project(state.runs, 'run');
  if (state.results) output.results = project(state.results, 'result');
  if (state.history) output.history = project(state.history, 'history');
  if (state.currentScenarioRunId !== undefined) output.currentScenarioRunId = state.currentScenarioRunId;
  if (isRecord(state.audit)) output.audit = { count: Number(state.audit.count || 0), tailDigest: state.audit.tailDigest || null };
  // Never export a callback, raw provider, or side-effect collection.
  assertNoForbiddenPayload(output, 'M05 checkpoint state');
  return output;
}

function exportM05Checkpoint(input = {}, options = {}) {
  const release = assertAgentRelease(input.release || input.agentRelease);
  const context = scenarioContext(input.scenarioContext || input.context || input);
  const errors = validateContext(context);
  if (errors.length) fail('INVALID_CHECKPOINT_CONTEXT', 'checkpoint scenario context is invalid', errors);
  if (context.scenarioId !== release.scenario.id || context.scenarioVersion !== release.scenario.version) fail('CONTEXT_MISMATCH', 'checkpoint context does not match Agent Release scenario');
  const checkpoint = {
    schemaVersion: C034_SCHEMA_VERSION,
    providerVersion: C034_PROVIDER_VERSION,
    checkpointId: input.checkpointId || `CP-M05-${release.releaseId}-${release.releaseVersion}`,
    formedAt: options.now ? nowIso(() => options.now) : (input.formedAt ? nowIso(() => input.formedAt) : nowIso(options.clock)),
    immutable: true,
    scenarioContext: context,
    agentRelease: release,
    releaseRef: { id: release.releaseId, version: release.releaseVersion, digest: release.digest },
    state: safeState(input.state || input.snapshot || {}),
    sideEffectPolicy: SIDE_EFFECT_POLICY,
    sideEffectsSuppressed: true,
    autoRun: false,
    autoToolInvocation: false,
    overwritesSource: false,
    digest: null
  };
  const digestInput = { ...checkpoint };
  delete digestInput.digest;
  checkpoint.digest = sha256(digestInput);
  return immutable(checkpoint);
}

function validateM05Checkpoint(value) {
  const errors = [];
  if (!isRecord(value)) return validation(false, [issue('$', 'type', 'checkpoint must be an object')]);
  if (value.schemaVersion === strictReleaseBoundary.CHECKPOINT_SCHEMA_VERSION) return strictReleaseBoundary.validateAgentReleaseCheckpoint(value);
  if (value.schemaVersion !== C034_SCHEMA_VERSION) errors.push(issue('schemaVersion', 'version', `must equal ${C034_SCHEMA_VERSION}`));
  if (value.providerVersion !== C034_PROVIDER_VERSION) errors.push(issue('providerVersion', 'version', `must equal ${C034_PROVIDER_VERSION}`));
  if (value.immutable !== true) errors.push(issue('immutable', 'required', 'checkpoint must be immutable'));
  errors.push(...validateContext(value.scenarioContext));
  const release = validateAgentRelease(value.agentRelease, { requirePublished: false });
  if (!release.valid) errors.push(...release.errors.map((error) => ({ ...error, path: `agentRelease.${error.path}` })));
  if (!value.sideEffectsSuppressed || value.autoRun !== false || value.autoToolInvocation !== false || value.overwritesSource !== false) errors.push(issue('$', 'side-effect-policy', 'checkpoint restore must suppress side effects'));
  if (value.sideEffectPolicy && JSON.stringify(value.sideEffectPolicy) !== JSON.stringify(SIDE_EFFECT_POLICY)) errors.push(issue('sideEffectPolicy', 'side-effect-policy', 'checkpoint side effect policy cannot be widened'));
  try { assertNoForbiddenPayload(value, 'M05 checkpoint'); } catch (error) { errors.push(issue('$', 'forbidden', error.message)); }
  if (isRecord(value.state)) {
    const rawStateKeys = [];
    (function walk(node, path) {
      if (Array.isArray(node)) return node.forEach((item, index) => walk(item, `${path}[${index}]`));
      if (!isRecord(node)) return;
      Object.keys(node).forEach((key) => {
        if (/^(?:question|prompt|answer|explanation|reportText|reportBody|generatedText|response|rawOutput)$/i.test(key)) rawStateKeys.push(`${path}.${key}`);
        walk(node[key], `${path}.${key}`);
      });
    }(value.state, 'state'));
    if (rawStateKeys.length) errors.push(issue('state', 'forbidden', 'checkpoint state may contain references/metadata only', { fields: rawStateKeys }));
  }
  const copy = clone(value);
  const digest = copy.digest;
  delete copy.digest;
  if (!isNonEmptyString(digest) || sha256(copy) !== digest) errors.push(issue('digest', 'integrity', 'checkpoint digest mismatch'));
  return validation(errors.length === 0, errors);
}

function cloneRestoreM05Checkpoint(checkpoint, options = {}) {
  if (checkpoint && checkpoint.schemaVersion === strictReleaseBoundary.CHECKPOINT_SCHEMA_VERSION) return strictReleaseBoundary.cloneAgentReleaseCheckpoint(checkpoint, options);
  const result = validateM05Checkpoint(checkpoint);
  if (!result.valid) fail('INVALID_CHECKPOINT', 'M05 checkpoint cannot be restored', result.errors);
  const source = clone(checkpoint);
  const old = source.scenarioContext;
  const runId = typeof options.runIdFactory === 'function' ? options.runIdFactory(old.scenarioId, old.scenarioRunId) : `${old.scenarioId}-RUN-restore-${crypto.randomUUID()}`;
  if (!isNonEmptyString(runId) || runId === old.scenarioRunId) fail('SCENARIO_RUN_REUSED', 'restore must create a new scenarioRunId');
  if (!(runId === old.scenarioId || runId.startsWith(`${old.scenarioId}-`) || runId.startsWith(`${old.scenarioId}_`) || runId.startsWith(`${old.scenarioId}/`))) fail('SCENARIO_MISMATCH', 'restored scenarioRunId must remain in the source scenario namespace');
  const formedAt = options.now ? nowIso(() => options.now) : nowIso(options.clock);
  const restored = {
    ...source,
    checkpointId: options.checkpointId || `${source.checkpointId}-RESTORED-${runId}`,
    formedAt,
    scenarioContext: { ...old, scenarioRunId: runId, formedAt, status: 'restored' },
    sourceScenarioRunId: old.scenarioRunId,
    targetScenarioRunId: runId,
    restored: true,
    autoRun: false,
    autoToolInvocation: false,
    overwritesSource: false,
    digest: null
  };
  const digestInput = { ...restored };
  delete digestInput.digest;
  restored.digest = sha256(digestInput);
  return immutable(restored);
}

function isolatedReplayM05Checkpoint(checkpoint, options = {}) {
  const restored = cloneRestoreM05Checkpoint(checkpoint, options);
  return immutable({
    operation: 'isolated-replay',
    schemaVersion: C034_SCHEMA_VERSION,
    sourceCheckpointId: checkpoint.checkpointId,
    scenarioContext: restored.scenarioContext,
    releaseRef: restored.releaseRef,
    state: restored.state,
    sideEffectPolicy: SIDE_EFFECT_POLICY,
    sideEffectsSuppressed: true,
    autoRun: false,
    autoToolInvocation: false,
    replayed: false,
    planOnly: true,
    newScenarioRunId: restored.targetScenarioRunId
  });
}

function migrationCompareM05(source, target) {
  if (source?.schemaVersion === strictReleaseBoundary.CHECKPOINT_SCHEMA_VERSION || target?.schemaVersion === strictReleaseBoundary.CHECKPOINT_SCHEMA_VERSION) {
    const foundation = require('../checkpoint');
    return foundation.migrationCompare(source, target);
  }
  const sourceResult = validateM05Checkpoint(source);
  const targetResult = validateM05Checkpoint(target);
  if (!sourceResult.valid || !targetResult.valid) fail('INVALID_CHECKPOINT', 'both migration checkpoints must validate', { source: sourceResult.errors, target: targetResult.errors });
  const sourceContext = source.scenarioContext;
  const targetContext = target.scenarioContext;
  if (sourceContext.scenarioId !== targetContext.scenarioId) fail('SCENARIO_MISMATCH', 'migration cannot cross scenarios');
  if (sourceContext.scenarioRunId === targetContext.scenarioRunId) fail('SCENARIO_RUN_REUSED', 'migration target must use a new scenarioRunId');
  if (source.digest === target.digest) fail('UNCHANGED_CHECKPOINT', 'migration target must differ from source');
  const sourceVersion = source.agentRelease.releaseVersion || '';
  const targetVersion = target.agentRelease.releaseVersion || '';
  const sourceNumeric = /(?:^|[-._])v?(\d+(?:\.\d+)+)$/.exec(sourceVersion)?.[1];
  const targetNumeric = /(?:^|[-._])v?(\d+(?:\.\d+)+)$/.exec(targetVersion)?.[1];
  if (sourceNumeric && targetNumeric && targetNumeric.localeCompare(sourceNumeric, undefined, { numeric: true }) < 0) fail('VERSION_REGRESSION', 'migration target Agent Release version regresses the source');
  return immutable({ operation: 'migration-compare', sourceCheckpointId: source.checkpointId, targetCheckpointId: target.checkpointId, sourceScenarioRunId: sourceContext.scenarioRunId, targetScenarioRunId: targetContext.scenarioRunId, compatible: source.agentRelease.releaseId === target.agentRelease.releaseId, findings: [], sideEffectsSuppressed: true, overwritesSource: false });
}

function assertSafeAdapterResult(value) {
  if (!isRecord(value)) return value;
  if (value.sideEffectsSuppressed === false || value.autoRun === true || value.autoToolInvocation === true || value.overwritesSource === true) fail('HISTORICAL_SIDE_EFFECT_REPLAY', 'C034 adapter attempted to widen the side-effect policy');
  const blocked = ['action', 'notification', 'approval', 'todo', 'task', 'dispatch', 'sideEffect', 'externalCall', 'executed', 'published', 'autoRun', 'toolInvocation'];
  const keys = Object.keys(value).filter((key) => blocked.some((token) => key.toLowerCase().includes(token)) && value[key] && value[key] !== false && value[key] !== 'disabled');
  if (keys.length) fail('HISTORICAL_SIDE_EFFECT_REPLAY', 'C034 adapter reported a historical side effect or dispatch', { keys });
  return value;
}

function createM05CheckpointProvider(options = {}) {
  const owner = options.owner || {};
  return Object.freeze({
    schemaVersion: C034_SCHEMA_VERSION,
    providerVersion: C034_PROVIDER_VERSION,
    export(request) {
      const value = typeof owner.export === 'function' ? owner.export(request) : exportM05Checkpoint(request, options);
      assertSafeAdapterResult(value);
      const checked = validateM05Checkpoint(value);
      if (!checked.valid) fail('INVALID_EXPORT', 'C034 owner export returned an invalid checkpoint', checked.errors);
      return immutable(value);
    },
    validate(checkpoint) { const base = validateM05Checkpoint(checkpoint); if (!base.valid || typeof owner.validate !== 'function') return base; const extra = owner.validate(checkpoint); return validation(base.valid && extra?.valid !== false, [...base.errors, ...(extra?.errors || [])]); },
    cloneRestore(request) { const base = cloneRestoreM05Checkpoint(request, options); if (typeof owner.cloneRestore !== 'function') return base; const providerResult = assertSafeAdapterResult(owner.cloneRestore({ checkpoint: base, sideEffectPolicy: SIDE_EFFECT_POLICY, autoRun: false, autoToolInvocation: false })); return immutable({ ...base, providerResult }); },
    isolatedReplay(request) { const base = isolatedReplayM05Checkpoint(request, options); if (typeof owner.isolatedReplay !== 'function') return base; const providerResult = assertSafeAdapterResult(owner.isolatedReplay({ checkpoint: request, replay: base, sideEffectPolicy: SIDE_EFFECT_POLICY })); return immutable({ ...base, providerResult }); },
    migrationCompare(source, target) { const base = migrationCompareM05(source, target); if (typeof owner.migrationCompare !== 'function') return base; const providerResult = assertSafeAdapterResult(owner.migrationCompare({ source, target, comparison: base, sideEffectPolicy: SIDE_EFFECT_POLICY })); return immutable({ ...base, providerResult }); }
  });
}

module.exports = Object.freeze({
  C034_SCHEMA_VERSION, C034_PROVIDER_VERSION, C034_CONTRACT_VERSION, SIDE_EFFECT_POLICY,
  exportM05Checkpoint, exportCheckpoint: exportM05Checkpoint, validateM05Checkpoint, validateCheckpoint: validateM05Checkpoint,
  cloneRestoreM05Checkpoint, cloneRestore: cloneRestoreM05Checkpoint, isolatedReplayM05Checkpoint, isolatedReplay: isolatedReplayM05Checkpoint,
  migrationCompareM05, migrationCompare: migrationCompareM05, createM05CheckpointProvider, createProvider: createM05CheckpointProvider,
  assertC034ReplaySafe: (value) => { assertNoForbiddenPayload(value, 'C034 replay'); assertSafeAdapterResult(value); return true; },
  assertSafeAdapterResult
});
