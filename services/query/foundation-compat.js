'use strict';

/*
 * M03's narrow compatibility boundary for the Foundation merge.  This file
 * adapts public Foundation contracts without changing their ownership:
 * strict C033 validation, the draft Contract Envelope, schema compatibility,
 * and the C034 Provider SPI.  It does not persist checkpoints or module truth.
 */

const crypto = require('node:crypto');
const contracts = require('../../packages/contracts');
const checkpoint = require('../../packages/checkpoint');
const { fail } = require('./errors');
const {
  isRecord,
  clone,
  deepFreeze,
  normalizeEvidenceRefs,
  nowIso,
  fingerprint
} = require('./utils');

const M03_MODULE_ID = 'M03';
const M03_MODULE_VERSION = 'implementation-0.1.0';
const M03_BASELINE_VERSION = '1.1.0';
const M03_BASELINE_SNAPSHOT_ID = 'BSL-OFW-V110-94ABD0E991B7';
const FOUNDATION_SCHEMA_VERSION = contracts.SCHEMA_VERSION;
const C034_SCHEMA_VERSION = checkpoint.CHECKPOINT_SCHEMA_VERSION;
const C034_PROVIDER_VERSION = checkpoint.PROVIDER_SPI_VERSION;
const C011_SCHEMA_VERSION = 'ofw.m03.c011.action-request.v1';
const C034_ALLOWED_CHECKPOINT_FIELDS = Object.freeze([
  'schemaVersion',
  'checkpointId',
  'immutable',
  'scenarioContext',
  'sourceScenarioRunId',
  'restoreReadiness',
  'moduleId',
  'moduleVersion',
  'implementationVersion',
  'baselineVersion',
  'baselineSnapshotId',
  'state',
  'sideEffectPolicy',
  'overwritesHistory',
  'overwritesSource',
  'replayHistoricalSideEffects',
  'replayedSideEffects'
]);

const C034_REQUIRED_CHECKPOINT_FIELDS = Object.freeze([
  'schemaVersion',
  'checkpointId',
  'immutable',
  'scenarioContext',
  'sourceScenarioRunId',
  'restoreReadiness',
  'moduleId',
  'moduleVersion',
  'implementationVersion',
  'baselineVersion',
  'baselineSnapshotId',
  'state',
  'sideEffectPolicy',
  'overwritesHistory',
  'overwritesSource',
  'replayHistoricalSideEffects',
  'replayedSideEffects'
]);

const ENVELOPE_RESOURCE_FIELDS = new Set([
  'refType', 'refId', 'refVersion', 'owner', 'locator', 'relation', 'digest',
  'resourceType', 'resourceId', 'resourceVersion', 'type', 'kind', 'version', 'id', 'key'
]);
const ENVELOPE_EVIDENCE_FIELDS = new Set([
  'evidenceType', 'evidenceId', 'evidenceVersion', 'locator', 'digest', 'formedAt', 'owner',
  'refType', 'refId', 'refVersion', 'resourceType', 'resourceId', 'resourceVersion', 'type', 'kind', 'version', 'id', 'key'
]);
const C034_READINESS_FIELDS = new Set(['status', 'checkedAt', 'verifiedAt', 'owner', 'reason']);

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function unwrapScenarioContext(value) {
  if (!isRecord(value)) return value;
  // A context-shaped object is validated as-is so an accidental nested or
  // extension field cannot be silently discarded at the Foundation boundary.
  const required = ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'];
  if (required.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return value;
  if (isRecord(value.scenarioContext)) return value.scenarioContext;
  if (isRecord(value.context)) return value.context;
  return value;
}

function strictScenarioContext(value, path = 'scenarioContext') {
  const source = unwrapScenarioContext(value);
  try {
    return deepFreeze(contracts.assertScenarioContext(source, {
      path,
      allowUnknown: false,
      enforcePrefix: true
    }));
  } catch (error) {
    fail('ERR_M03_FOUNDATION_CONTEXT', `${path} failed Foundation strict validation`, {
      cause: error.code || error.name,
      errors: error.errors || error.details || null
    });
  }
}

function validateStrictScenarioContext(value) {
  try {
    return { valid: true, errors: [], value: strictScenarioContext(value) };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code, message: error.message, details: error.details }], value: null };
  }
}

function assertFoundationSchemaCompatibility(sourceVersion, targetVersion, options = {}) {
  if (sourceVersion !== FOUNDATION_SCHEMA_VERSION || targetVersion !== FOUNDATION_SCHEMA_VERSION) {
    fail('ERR_M03_SCHEMA_COMPATIBILITY', 'M03 only accepts the exact Foundation draft envelope schema version', {
      sourceVersion,
      targetVersion,
      expected: FOUNDATION_SCHEMA_VERSION
    });
  }
  try {
    return contracts.assertSchemaCompatibility(sourceVersion, targetVersion, options);
  } catch (error) {
    fail('ERR_M03_SCHEMA_COMPATIBILITY', 'Foundation schema compatibility check failed', {
      cause: error.code || error.name,
      result: error.result || null
    });
  }
}

function classifyFoundationSchemaCompatibility(sourceVersion, targetVersion, options = {}) {
  return contracts.classifySchemaCompatibility(sourceVersion, targetVersion, options);
}

function compatibilityResult(sourceVersion, targetVersion, options = {}) {
  const result = classifyFoundationSchemaCompatibility(sourceVersion, targetVersion, options);
  const exact = result.status === contracts.COMPATIBILITY_STATUS.EXACT;
  return {
    ok: exact,
    valid: exact,
    result,
    errors: exact ? [] : [{
      code: 'ERR_M03_SCHEMA_COMPATIBILITY',
      path: 'schemaVersion',
      message: 'M03 accepts only an exact registered schema version',
      details: result
    }]
  };
}

function assertExactSchemaVersion(actual, expected, label = 'schema') {
  if (typeof expected !== 'string' || expected.trim() === '' || actual !== expected) {
    fail('ERR_M03_SCHEMA_MISMATCH', `${label} must use the exact registered schema version`, { expected: expected || null, actual: actual || null });
  }
  // Foundation's classifier is still consulted when both identifiers are
  // parseable Foundation draft/final versions; custom M03/C034 identifiers
  // are exact owner-scoped compatibility identifiers and must not be guessed.
  const source = contracts.parseSchemaVersion(actual);
  const target = contracts.parseSchemaVersion(expected);
  if (source && target) {
    try { contracts.assertSchemaCompatibility(actual, expected); } catch (error) {
      fail('ERR_M03_SCHEMA_COMPATIBILITY', `${label} compatibility check failed`, { cause: error.code, result: error.result || null });
    }
  }
  return actual;
}

function assertM03SchemaVersion(actual, expected, label = 'M03 schema') {
  if (typeof actual !== 'string' || actual !== expected) {
    fail('ERR_M03_SCHEMA_MISMATCH', `${label} must use the exact registered M03 schema version`, { expected, actual: actual || null });
  }
  return actual;
}

function envelopeEvidenceRefs(value) {
  return normalizeEvidenceRefs(value || []).map((ref) => ({
    evidenceType: ref.evidenceType || 'opaque',
    evidenceId: ref.evidenceId,
    ...(ref.evidenceVersion ? { evidenceVersion: ref.evidenceVersion } : {})
  }));
}

function envelopeResourceRefs(request, options = {}) {
  const refs = [];
  const add = (type, id, version) => {
    if (id) refs.push({ refType: type, refId: String(id), ...(version ? { refVersion: String(version) } : {}) });
  };
  add('c009-config', request.configVersion, options.configVersion);
  add('published-ontology', request.publishedOntologyVersion, request.publishedOntologyVersion);
  add('data-version', request.dataVersion, request.dataVersion);
  add('t019', request.t019Id, request.t019Version);
  add('c010-result', request.sourceResultId, request.sourceResultFingerprint);
  return refs;
}

function assertEnvelopeReferenceFields(value, field, allowed) {
  if (!Array.isArray(value)) return;
  value.forEach((ref, index) => {
    if (typeof ref === 'string') return;
    if (!isRecord(ref)) fail('ERR_M03_ENVELOPE_REFERENCE', `${field}[${index}] must be a reference`, { path: `${field}[${index}]` });
    const unknown = Object.keys(ref).filter((key) => !allowed.has(key));
    if (unknown.length) fail('ERR_M03_ENVELOPE_REFERENCE', `${field}[${index}] contains unknown fields`, { path: `${field}[${index}]`, fields: unknown });
  });
}

function assertEnvelopePayloadIdentity(envelope) {
  if (!isRecord(envelope.payload)) return;
  if (envelope.payload.idempotencyKey && envelope.payload.idempotencyKey !== envelope.idempotencyKey) {
    fail('ERR_M03_ENVELOPE_IDEMPOTENCY', 'Envelope and payload idempotency keys must match');
  }
  if (envelope.payload.scenarioRunId && envelope.payload.scenarioRunId !== envelope.scenarioContext.scenarioRunId) {
    fail('ERR_M03_ENVELOPE_CONTEXT', 'Envelope and payload scenarioRunId values must match');
  }
  if (envelope.payload.scenarioContext) {
    const payloadContext = strictScenarioContext(envelope.payload.scenarioContext, 'envelope.payload.scenarioContext');
    const fields = ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'];
    if (!fields.every((field) => payloadContext[field] === envelope.scenarioContext[field])) {
      fail('ERR_M03_ENVELOPE_CONTEXT', 'Envelope and payload ScenarioContext must match');
    }
  }
}

function deterministicTrace(request, options = {}) {
  const seed = request.idempotencyKey || request.requestId || fingerprint(request);
  const digest = hash({ seed, scenarioRunId: request.scenarioRunId || null });
  return {
    traceId: options.traceId || `m03-trace-${digest.slice(0, 32)}`,
    correlationId: options.correlationId || `m03-correlation-${digest.slice(32, 64)}`
  };
}

function createM03Envelope(request, options = {}) {
  if (!isRecord(request)) fail('ERR_M03_ENVELOPE_PAYLOAD', 'M03 envelope payload must be an object');
  const context = strictScenarioContext(request.scenarioContext);
  assertFoundationSchemaCompatibility(FOUNDATION_SCHEMA_VERSION, FOUNDATION_SCHEMA_VERSION);
  const trace = deterministicTrace(request, options);
  const occurredAt = options.occurredAt || request.requestedAt || request.generatedAt || nowIso();
  const eventType = options.eventType || request.eventType || 'm03.c011.submit';
  const eventId = options.eventId || request.eventId || `m03-event-${hash({ eventType, idempotencyKey: request.idempotencyKey, scenarioRunId: context.scenarioRunId }).slice(0, 32)}`;
  const envelope = {
    eventId,
    eventType,
    schemaVersion: FOUNDATION_SCHEMA_VERSION,
    occurredAt,
    actorRef: options.actorRef || request.actorRef || 'M03',
    correlationId: options.correlationId || request.correlationId || trace.correlationId,
    traceId: options.traceId || request.traceId || trace.traceId,
    idempotencyKey: request.idempotencyKey,
    scenarioContext: context,
    resourceRefs: options.resourceRefs || request.resourceRefs || envelopeResourceRefs(request, options),
    evidenceRefs: options.evidenceRefs || envelopeEvidenceRefs(request.evidenceRefs),
    payload: clone(request)
  };
  try {
    assertEnvelopeReferenceFields(envelope.resourceRefs, 'resourceRefs', ENVELOPE_RESOURCE_FIELDS);
    assertEnvelopeReferenceFields(envelope.evidenceRefs, 'evidenceRefs', ENVELOPE_EVIDENCE_FIELDS);
    if (request.scenarioRunId && request.scenarioRunId !== context.scenarioRunId) {
      fail('ERR_M03_ENVELOPE_CONTEXT', 'Envelope payload scenarioRunId must match its C033 context');
    }
    return deepFreeze(contracts.assertContractEnvelope(envelope, {
      allowUnknown: false,
      enforcePrefix: true
    }));
  } catch (error) {
    fail('ERR_M03_ENVELOPE_INVALID', 'M03 Contract Envelope failed strict Foundation validation', {
      cause: error.code || error.name,
      errors: error.errors || error.details || null
    });
  }
}

function createC011Envelope(request, options = {}) {
  if (!isRecord(request) || request.contractCode !== 'C011') {
    fail('ERR_M03_ENVELOPE_PAYLOAD', 'C011 Envelope payload must be the standard C011 request');
  }
  if (request.schemaVersion !== C011_SCHEMA_VERSION) {
    fail('ERR_M03_ENVELOPE_PAYLOAD', 'C011 Envelope payload schemaVersion is not the standard M03 C011 version', {
      expected: C011_SCHEMA_VERSION,
      actual: request.schemaVersion || null
    });
  }
  if (request.scenarioRunId && request.scenarioContext?.scenarioRunId !== request.scenarioRunId) {
    fail('ERR_M03_ENVELOPE_PAYLOAD', 'C011 payload scenarioRunId must match its C033 context');
  }
  return createM03Envelope(request, {
    ...options,
    eventType: 'm03.c011.submit'
  });
}

function validateM03Envelope(value, options = {}) {
  try {
    if (!isRecord(value)) fail('ERR_M03_ENVELOPE_INVALID', 'M03 envelope must be an object');
    assertFoundationSchemaCompatibility(value.schemaVersion, FOUNDATION_SCHEMA_VERSION);
    const normalized = contracts.assertContractEnvelope(value, {
      allowUnknown: false,
      enforcePrefix: true
    });
    assertEnvelopeReferenceFields(normalized.resourceRefs, 'resourceRefs', ENVELOPE_RESOURCE_FIELDS);
    assertEnvelopeReferenceFields(normalized.evidenceRefs, 'evidenceRefs', ENVELOPE_EVIDENCE_FIELDS);
    if (options.eventType && normalized.eventType !== options.eventType) fail('ERR_M03_ENVELOPE_EVENT_TYPE', 'unexpected M03 envelope eventType');
    if (options.contractCode && normalized.payload?.contractCode !== options.contractCode) fail('ERR_M03_ENVELOPE_PAYLOAD', 'unexpected M03 envelope payload contractCode');
    assertEnvelopePayloadIdentity(normalized);
    return { valid: true, errors: [], value: deepFreeze(normalized) };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code || 'ERR_M03_ENVELOPE_INVALID', message: error.message, details: error.details || error.errors }], value: null };
  }
}

function assertM03Envelope(value, options = {}) {
  const result = validateM03Envelope(value, options);
  if (!result.valid) fail(result.errors[0].code, result.errors[0].message, result.errors[0].details);
  return result.value;
}

function checkpointState(options, request) {
  const reader = request.stateReader || request.readState || options.stateReader || options.readState;
  const state = typeof reader === 'function'
    ? reader({ scenarioContext: request.scenarioContext, purpose: 'M03-C034-export' })
    : (request.state !== undefined ? request.state : (options.state || {}));
  if (state && typeof state.then === 'function') fail('ERR_M03_C034_ASYNC_STATE', 'C034 stateReader must be synchronous for the sync SPI');
  if (!isRecord(state)) fail('ERR_M03_C034_STATE_INVALID', 'M03 C034 state must be a JSON object');
  try {
    checkpoint.assertNoHistoricalSideEffects(state);
  } catch (error) {
    fail('ERR_M03_C034_SIDE_EFFECT', 'M03 checkpoint state contains replayable historical side effects', { cause: error.code, details: error.details });
  }
  return clone(state);
}

function validateM03Checkpoint(value, options = {}) {
  const errors = [];
  const structural = checkpoint.validateCheckpoint(value, {
    requireSchemaVersion: true,
    contextOptions: { allowUnknown: false }
  });
  if (!structural.ok) errors.push(...structural.errors);
  if (!isRecord(value)) return { ok: false, valid: false, errors };
  C034_REQUIRED_CHECKPOINT_FIELDS.forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(value, field) || value[field] === undefined || value[field] === null) {
      errors.push({ code: 'M03_CHECKPOINT_FIELD_REQUIRED', path: field, message: `${field} is required` });
    }
  });
  const unknownFields = Object.keys(value).filter((key) => !C034_ALLOWED_CHECKPOINT_FIELDS.includes(key));
  unknownFields.forEach((key) => errors.push({ code: 'UNKNOWN_M03_CHECKPOINT_FIELD', path: key, message: 'unknown M03 checkpoint field' }));
  if (value.moduleId !== M03_MODULE_ID) errors.push({ code: 'M03_CHECKPOINT_MODULE_MISMATCH', path: 'moduleId', message: 'checkpoint must belong to M03' });
  if (value.moduleVersion !== undefined && (typeof value.moduleVersion !== 'string' || !value.moduleVersion.trim())) errors.push({ code: 'M03_CHECKPOINT_MODULE_VERSION', path: 'moduleVersion', message: 'moduleVersion must be a non-empty string' });
  if (value.implementationVersion !== undefined && value.implementationVersion !== value.moduleVersion) errors.push({ code: 'M03_CHECKPOINT_IMPLEMENTATION_VERSION', path: 'implementationVersion', message: 'implementationVersion must match moduleVersion' });
  if (value.baselineVersion !== undefined && value.baselineVersion !== M03_BASELINE_VERSION) errors.push({ code: 'M03_CHECKPOINT_BASELINE_MISMATCH', path: 'baselineVersion', message: 'checkpoint must remain pinned to frozen v1.1.0 baseline' });
  if (value.baselineSnapshotId !== undefined && value.baselineSnapshotId !== M03_BASELINE_SNAPSHOT_ID) errors.push({ code: 'M03_CHECKPOINT_BASELINE_MISMATCH', path: 'baselineSnapshotId', message: 'checkpoint must remain pinned to the frozen baseline snapshot' });
  if (!isRecord(value.state)) errors.push({ code: 'M03_CHECKPOINT_STATE_INVALID', path: 'state', message: 'M03 checkpoint state must be an object' });
  if (value.sourceScenarioRunId && value.sourceScenarioRunId !== value.scenarioContext?.scenarioRunId) errors.push({ code: 'M03_CHECKPOINT_RUN_MISMATCH', path: 'sourceScenarioRunId', message: 'source run must match strict C033 context' });
  const policyMismatch = value.sideEffectPolicy && (
    Object.keys(checkpoint.SIDE_EFFECT_POLICY).some((key) => value.sideEffectPolicy[key] !== false)
    || Object.keys(value.sideEffectPolicy).some((key) => !Object.prototype.hasOwnProperty.call(checkpoint.SIDE_EFFECT_POLICY, key))
  );
  if (policyMismatch) {
    errors.push({ code: 'M03_CHECKPOINT_SIDE_EFFECT_POLICY', path: 'sideEffectPolicy', message: 'C034 side-effect policy must remain Foundation default' });
  }
  if (value.immutable !== undefined && value.immutable !== true) errors.push({ code: 'M03_CHECKPOINT_IMMUTABLE', path: 'immutable', message: 'M03 checkpoints must be immutable' });
  if (value.restoreReadiness && value.restoreReadiness.status !== 'verified') errors.push({ code: 'M03_CHECKPOINT_NOT_READY', path: 'restoreReadiness.status', message: 'M03 checkpoints must be restore-ready' });
  if (isRecord(value.restoreReadiness)) {
    Object.keys(value.restoreReadiness).filter((key) => !C034_READINESS_FIELDS.has(key)).forEach((key) => {
      errors.push({ code: 'UNKNOWN_M03_CHECKPOINT_FIELD', path: `restoreReadiness.${key}`, message: 'unknown restoreReadiness field' });
    });
  }
  if (value.overwritesHistory !== undefined && value.overwritesHistory !== false) errors.push({ code: 'M03_CHECKPOINT_SIDE_EFFECT', path: 'overwritesHistory', message: 'history overwrite is forbidden' });
  if (value.overwritesSource !== undefined && value.overwritesSource !== false) errors.push({ code: 'M03_CHECKPOINT_SIDE_EFFECT', path: 'overwritesSource', message: 'source overwrite is forbidden' });
  if (value.replayHistoricalSideEffects !== undefined && value.replayHistoricalSideEffects !== false) errors.push({ code: 'M03_CHECKPOINT_SIDE_EFFECT', path: 'replayHistoricalSideEffects', message: 'historical replay is forbidden' });
  if (value.replayedSideEffects !== undefined && (!Array.isArray(value.replayedSideEffects) || value.replayedSideEffects.length > 0)) errors.push({ code: 'M03_CHECKPOINT_SIDE_EFFECT', path: 'replayedSideEffects', message: 'replayed side effects must remain empty' });
  if (value.scenarioContext) {
    const contextResult = contracts.validateScenarioContext(value.scenarioContext, { allowUnknown: false, enforcePrefix: true });
    if (!contextResult.valid) errors.push(...contextResult.errors.map((error) => ({ ...error, code: `M03_${error.code || 'CONTEXT_INVALID'}` })));
  }
  try {
    assertExactSchemaVersion(value.schemaVersion, C034_SCHEMA_VERSION, 'C034 checkpoint schema');
  } catch (error) {
    errors.push({ code: error.code, path: 'schemaVersion', message: error.message, details: error.details });
  }
  return { ok: errors.length === 0, valid: errors.length === 0, errors };
}

function createM03C034Provider(options = {}) {
  const moduleVersion = options.moduleVersion || M03_MODULE_VERSION;
  const baselineVersion = options.baselineVersion || M03_BASELINE_VERSION;
  const baselineSnapshotId = options.baselineSnapshotId || M03_BASELINE_SNAPSHOT_ID;
  const implementation = {
    export(request = {}) {
      const context = strictScenarioContext(request.scenarioContext || options.scenarioContext);
      const state = checkpointState(options, { ...request, scenarioContext: context });
      const checkpointId = request.checkpointId || options.checkpointId || `M03-CP-${hash({ context, baselineVersion, baselineSnapshotId, state }).slice(0, 24)}`;
      const value = {
        schemaVersion: C034_SCHEMA_VERSION,
        checkpointId,
        immutable: true,
        scenarioContext: context,
        sourceScenarioRunId: context.scenarioRunId,
        restoreReadiness: { status: 'verified' },
        moduleId: M03_MODULE_ID,
        moduleVersion,
        implementationVersion: moduleVersion,
        baselineVersion,
        baselineSnapshotId,
        state,
        sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY,
        overwritesHistory: false,
        overwritesSource: false,
        replayHistoricalSideEffects: false,
        replayedSideEffects: []
      };
      const validation = validateM03Checkpoint(value);
      if (!validation.ok) fail('ERR_M03_C034_EXPORT_INVALID', 'M03 C034 export failed strict validation', validation.errors);
      return deepFreeze(value);
    },
    validate(value) {
      return validateM03Checkpoint(value);
    },
    cloneRestore(request = {}) {
      const validation = validateM03Checkpoint(request.checkpoint);
      if (!validation.ok) fail('ERR_M03_C034_CHECKPOINT_INVALID', 'M03 cloneRestore requires a valid M03 checkpoint', validation.errors);
      if (request.targetScenarioRunId && request.targetScenarioRunId === request.sourceScenarioRunId) fail('ERR_M03_C034_RUN_REUSED', 'M03 cloneRestore requires a new scenarioRunId');
      return {
        moduleId: M03_MODULE_ID,
        restoreAccepted: true,
        sourceCheckpointId: request.checkpoint?.checkpointId || null,
        sourceScenarioRunId: request.sourceScenarioRunId || null,
        targetScenarioRunId: request.targetScenarioRunId || request.scenarioContext?.scenarioRunId || null,
        restoredStateFingerprint: request.checkpoint?.state ? fingerprint(request.checkpoint.state) : null,
        overwritesHistory: false,
        overwritesSource: false,
        replayHistoricalSideEffects: false,
        replayedSideEffects: [],
        sideEffectsSuppressed: true,
        sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY
      };
    },
    isolatedReplay(request = {}) {
      const validation = validateM03Checkpoint(request.checkpoint);
      if (!validation.ok) fail('ERR_M03_C034_CHECKPOINT_INVALID', 'M03 isolatedReplay requires a valid M03 checkpoint', validation.errors);
      if (request.targetScenarioRunId && request.targetScenarioRunId === request.sourceScenarioRunId) fail('ERR_M03_C034_RUN_REUSED', 'M03 isolatedReplay requires a new scenarioRunId');
      return {
        moduleId: M03_MODULE_ID,
        replayAccepted: true,
        sourceCheckpointId: request.checkpoint?.checkpointId || null,
        sourceScenarioRunId: request.sourceScenarioRunId || null,
        targetScenarioRunId: request.targetScenarioRunId || request.scenarioContext?.scenarioRunId || null,
        replayedSideEffects: [],
        overwritesHistory: false,
        overwritesSource: false,
        sideEffectsSuppressed: true,
        sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY
      };
    },
    migrationCompare(request = {}) {
      return { moduleId: M03_MODULE_ID, providerCompatibility: 'exact', compared: true, sideEffectsSuppressed: true, sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY };
    }
  };
  return checkpoint.createProvider(implementation, { requireSchemaVersion: true, requireAllMethods: true });
}

function exportM03Checkpoint(provider, request) {
  const selected = provider
    ? (provider.spiVersion === C034_PROVIDER_VERSION && provider.schemaVersion === C034_SCHEMA_VERSION
      ? provider
      : checkpoint.createProvider(provider, { requireSchemaVersion: true }))
    : createM03C034Provider(request || {});
  return selected.export(request || {});
}

module.exports = Object.freeze({
  M03_MODULE_ID,
  M03_MODULE_VERSION,
  M03_BASELINE_VERSION,
  M03_BASELINE_SNAPSHOT_ID,
  FOUNDATION_SCHEMA_VERSION,
  C034_SCHEMA_VERSION,
  C034_PROVIDER_VERSION,
  C011_SCHEMA_VERSION,
  C034_ALLOWED_CHECKPOINT_FIELDS,
  C034_REQUIRED_CHECKPOINT_FIELDS,
  strictScenarioContext,
  validateStrictScenarioContext,
  assertFoundationSchemaCompatibility,
  classifyFoundationSchemaCompatibility,
  compatibilityResult,
  assertExactSchemaVersion,
  assertM03SchemaVersion,
  createM03Envelope,
  createC011Envelope,
  validateM03Envelope,
  assertM03Envelope,
  validateM03Checkpoint,
  createM03C034Provider,
  createM03CheckpointProvider: createM03C034Provider,
  createC034Provider: createM03C034Provider,
  createCheckpointProvider: createM03C034Provider,
  C034Provider: createM03C034Provider,
  exportM03Checkpoint,
  exportCheckpoint: exportM03Checkpoint
});
