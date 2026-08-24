'use strict';

const crypto = require('node:crypto');

const contracts = require('../../packages/contracts');
const identity = require('../../packages/identity');

const IMPLEMENTATION_VERSION = 'implementation-0.1.0';
const BASELINE_SNAPSHOT_ID = 'BSL-OFW-V110-94ABD0E991B7';
const SOURCE_TAG = 'prototype-v1.1.0-frozen';

const SCHEMA_VERSIONS = Object.freeze({
  C003: 'ofw.m01.c003.v1',
  C004: 'ofw.m01.c004.v1',
  C005: 'ofw.m01.c005.v1',
  C006: 'ofw.m01.c006.v1',
  C007: 'ofw.m01.c007.v1',
  C008: 'ofw.m01.c008.v1',
  C028: 'ofw.m01.c028.v1',
  C029: 'ofw.m01.c029.v1',
  C032: 'ofw.m01.c032.v1',
  T017: 'ofw.m01.t017.v1',
  T018: 'ofw.m01.t018.v1',
  T019: 'ofw.m01.t019.v1',
  T054: 'ofw.m01.t054.v1',
  CHECKPOINT_STATE: 'ofw.m01.checkpoint-state.v1'
});

const EVENT_TYPES = Object.freeze({
  C003_DELIVERY: 'm01.c003.data-asset-delivery',
  C028_REQUEST: 'm01.c028.refresh-request',
  C029_RESULT: 'm01.c029.refresh-result',
  T019_SWITCH: 'm01.t019.switch',
  T019_ROLLBACK: 'm01.t019.rollback'
});

const WRITABLE_CONTEXT_STATUSES = Object.freeze(['active', 'restored']);
const READ_ONLY_CONTEXT_STATUSES = Object.freeze(['historical-readonly', 'closed', 'regression']);
const RESOURCE_TYPES = Object.freeze([
  'ObjectType',
  'Property',
  'LinkType',
  'Metric',
  'Rule',
  'ActionType'
]);
const C032_STATUSES = Object.freeze([
  'available',
  'not-established',
  'draft-or-unpublished',
  'disabled',
  'asset-mismatch',
  'coverage-insufficient',
  't017-unlocatable',
  'mapping-unlocatable',
  'unknown'
]);
const C029_STATUSES = Object.freeze(['processing', 'succeeded', 'failed', 'incompatible', 'unknown']);
const T018_STATUSES = Object.freeze(['eligible', 'ineligible', 'unknown']);
const C008_STATUSES = Object.freeze(['empty', 'ready', 'failed', 'previous-trusted']);
const DRAFT_STATES = Object.freeze(['draft-unvalidated', 'draft-validating', 'draft-blocked', 'draft-validated', 'published', 'abandoned']);
const PUBLISHED_STATES = Object.freeze(['published', 'deprecating', 'deprecated']);
const T019_STATES = Object.freeze(['empty', 'adopted', 'previous-trusted', 'failed']);

class OntologyError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'OntologyError';
    this.code = code;
    this.details = details || null;
  }
}

function fail(code, message, details) {
  throw new OntologyError(code, message, details);
}

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function token(value) {
  return text(value) && !/\s/.test(value.trim());
}

function cloneJson(value, label = 'value') {
  if (value === undefined) fail('INVALID_JSON_VALUE', `${label} is undefined`);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail('INVALID_JSON_VALUE', `${label} must be JSON serializable`, { cause: error.message });
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function immutable(value, label) {
  return deepFreeze(cloneJson(value, label));
}

function stableHash(value) {
  try {
    const canonical = JSON.parse(JSON.stringify(value));
    return identity.requestFingerprint(canonical, { fields: ['value'] });
  } catch (error) {
    fail('INVALID_JSON_VALUE', 'value cannot be fingerprinted as JSON', { cause: error.message });
  }
}

function sha256(value) {
  try {
    const input = typeof value === 'string' ? value : identity.stableSerialize(value);
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
  } catch (error) {
    fail('INVALID_JSON_VALUE', 'value cannot be hashed as JSON', { cause: error.message });
  }
}

function withoutIntegrity(value) {
  const copy = cloneJson(value, 'integrity payload');
  delete copy.integrity;
  return copy;
}

function sealIntegrity(value) {
  const copy = withoutIntegrity(value);
  copy.integrity = {
    algorithm: 'SHA-256',
    digest: sha256(copy)
  };
  return immutable(copy, 'sealed payload');
}

function verifyIntegrity(value, options = {}) {
  const label = options.label || 'payload';
  const code = options.code || 'INTEGRITY_CHECK_FAILED';
  if (!isRecord(value?.integrity) || value.integrity.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(value.integrity.digest || '')) {
    fail(code, `${label} has no valid SHA-256 integrity record`);
  }
  const actual = sha256(withoutIntegrity(value));
  if (actual !== value.integrity.digest) {
    fail(code, `${label} digest does not match its content`, {
      expected: value.integrity.digest,
      actual
    });
  }
  return true;
}

function assertText(value, path, options = {}) {
  const valid = options.token ? token(value) : text(value);
  if (!valid) fail(options.code || 'VALIDATION_FAILED', `${path} must be a non-empty ${options.token ? 'token' : 'string'}`, { path });
  return value.trim();
}

function assertDateTime(value, path, code = 'VALIDATION_FAILED') {
  if (!contracts.isDateTime(value)) fail(code, `${path} must be an RFC 3339 date-time`, { path });
  return value;
}

function assertEnum(value, allowed, path, code = 'UNKNOWN_STATUS') {
  if (!allowed.includes(value)) fail(code, `${path} has an unsupported value`, { path, value, allowed });
  return value;
}

function assertArray(value, path, options = {}) {
  if (!Array.isArray(value)) fail(options.code || 'VALIDATION_FAILED', `${path} must be an array`, { path });
  if (options.nonEmpty && value.length === 0) fail(options.code || 'VALIDATION_FAILED', `${path} must not be empty`, { path });
  return value;
}

function assertUnique(items, valueOf, path, code = 'DUPLICATE_IDENTITY') {
  const seen = new Set();
  items.forEach((item, index) => {
    const value = valueOf(item, index);
    if (seen.has(value)) fail(code, `${path} contains a duplicate identity`, { path: `${path}[${index}]`, value });
    seen.add(value);
  });
  return seen;
}

function assertScenarioContext(value, options = {}) {
  let context;
  try {
    context = identity.assertScenarioContext(value, { allowUnknown: false });
  } catch (error) {
    fail(options.code || 'INVALID_SCENARIO_CONTEXT', 'C033 scenario context is invalid', {
      errors: error.errors || [{ message: error.message }]
    });
  }
  const knownStatuses = [...WRITABLE_CONTEXT_STATUSES, ...READ_ONLY_CONTEXT_STATUSES];
  if (!knownStatuses.includes(context.status)) {
    fail('UNKNOWN_CONTEXT_STATUS', 'C033 status is not supported by M01', {
      status: context.status,
      knownStatuses
    });
  }
  if (options.write && !WRITABLE_CONTEXT_STATUSES.includes(context.status)) {
    fail('CONTEXT_READ_ONLY', 'the C033 context does not allow M01 writes', { status: context.status });
  }
  return context;
}

function assertSameContext(expected, actual, options = {}) {
  const expectedContext = assertScenarioContext(expected);
  const actualContext = assertScenarioContext(actual, { code: options.code });
  const comparison = identity.compareScenarioContextDetailed(expectedContext, actualContext, {
    includeLifecycle: options.allowReadOnlyLifecycle !== true,
    allowUnknown: false
  });
  if (!comparison.same) {
    if (options.write
        && comparison.mismatches.length === 1
        && comparison.mismatches[0].field === 'status'
        && READ_ONLY_CONTEXT_STATUSES.includes(actualContext.status)) {
      fail('CONTEXT_READ_ONLY', 'the C033 context is historical/closed and cannot be written', { status: actualContext.status });
    }
    const runMismatch = comparison.mismatches.some((item) => item.field === 'scenarioRunId');
    fail(runMismatch ? 'SCENARIO_RUN_MISMATCH' : (options.code || 'SCENARIO_CONTEXT_MISMATCH'), 'operation C033 does not match the M01 workspace context', {
      mismatches: comparison.mismatches
    });
  }
  if (options.write && !WRITABLE_CONTEXT_STATUSES.includes(actualContext.status)) {
    fail('CONTEXT_READ_ONLY', 'the C033 context does not allow M01 writes', { status: actualContext.status });
  }
  return actualContext;
}

function assertEnvelope(value, expected) {
  let envelope;
  try {
    envelope = contracts.assertContractEnvelope(value, { allowUnknown: false });
  } catch (error) {
    fail('INVALID_CONTRACT_ENVELOPE', 'the Foundation contract envelope is invalid', {
      errors: error.errors || [{ message: error.message }]
    });
  }
  if (expected.schemaVersion) {
    try {
      contracts.assertSchemaCompatibility(expected.schemaVersion, envelope.schemaVersion);
    } catch (error) {
      fail('SCHEMA_VERSION_MISMATCH', 'contract schemaVersion is not exactly compatible', {
        expected: expected.schemaVersion,
        actual: envelope.schemaVersion,
        compatibility: error.result || null
      });
    }
  }
  if (expected.eventType && envelope.eventType !== expected.eventType) {
    fail('EVENT_TYPE_MISMATCH', 'contract eventType is not supported', {
      expected: expected.eventType,
      actual: envelope.eventType
    });
  }
  return envelope;
}

function operationMetadata(envelopeOrCommand, operation, now) {
  const trace = identity.createTraceContext(envelopeOrCommand || {});
  const source = envelopeOrCommand || {};
  return {
    operation,
    actorRef: source.actorRef || source.actor || 'M01_SYSTEM',
    traceId: source.traceId || trace.traceId,
    correlationId: source.correlationId || trace.correlationId,
    formedAt: now
  };
}

function contextKey(context) {
  return `${context.scenarioId}::${context.scenarioVersion}::${context.scenarioRunId}`;
}

function normalizeRef(value, path, defaultType) {
  if (text(value)) return { id: value.trim(), type: defaultType || null, version: null };
  if (!isRecord(value)) fail('VALIDATION_FAILED', `${path} must be a reference object`, { path });
  return {
    id: assertText(value.id || value.refId || value.resourceId, `${path}.id`, { token: true }),
    type: value.type || value.refType || value.resourceType || defaultType || null,
    version: value.version || value.refVersion || value.resourceVersion || null
  };
}

module.exports = Object.freeze({
  IMPLEMENTATION_VERSION,
  BASELINE_SNAPSHOT_ID,
  SOURCE_TAG,
  SCHEMA_VERSIONS,
  EVENT_TYPES,
  WRITABLE_CONTEXT_STATUSES,
  READ_ONLY_CONTEXT_STATUSES,
  RESOURCE_TYPES,
  C032_STATUSES,
  C029_STATUSES,
  T018_STATUSES,
  C008_STATUSES,
  DRAFT_STATES,
  PUBLISHED_STATES,
  T019_STATES,
  OntologyError,
  fail,
  isRecord,
  hasOwn,
  text,
  token,
  cloneJson,
  deepFreeze,
  immutable,
  stableHash,
  sha256,
  withoutIntegrity,
  sealIntegrity,
  verifyIntegrity,
  assertText,
  assertDateTime,
  assertEnum,
  assertArray,
  assertUnique,
  assertScenarioContext,
  assertSameContext,
  assertEnvelope,
  operationMetadata,
  contextKey,
  normalizeRef
});
