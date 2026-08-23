'use strict';

/*
 * C033 and idempotency primitives.  This module is intentionally storage- and
 * framework-agnostic: all operations are pure except for cryptographic hash
 * calculation and random trace-id generation.  It does not create business
 * records, dispatch messages, or assign module ownership.
 */

const crypto = require('node:crypto');

const IDENTITY_SCHEMA_VERSION = 'draft-0.1.0';
const C033_SCHEMA_VERSION = 'ofw.c033.scenario-context.draft.v1';
const IDEMPOTENCY_SCHEMA_VERSION = 'ofw.idempotency.draft.v1';
const TRACE_SCHEMA_VERSION = 'ofw.trace-context.draft.v1';
const IDEMPOTENCY_KEY_PREFIX = 'idem-v1';
const CONTEXT_FIELDS = Object.freeze(['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status']);
const RUN_COMPARISON_FIELDS = Object.freeze(['scenarioId', 'scenarioVersion', 'scenarioRunId']);
const REQUEST_FINGERPRINT_FIELDS = Object.freeze([
  'schemaVersion',
  'eventType',
  'operation',
  'scenarioContext',
  'resourceRefs',
  'evidenceRefs',
  'payload'
]);

class IdentityValidationError extends Error {
  constructor(contract, errors) {
    super(`${contract} validation failed${errors.length ? `: ${errors.map((error) => `${error.path}: ${error.message}`).join('; ')}` : ''}`);
    this.name = 'IdentityValidationError';
    this.code = 'ERR_IDENTITY_VALIDATION';
    this.contract = contract;
    this.errors = errors;
  }
}

function error(path, code, message) {
  return { path, code, message };
}

function result(valid, errors = []) {
  const value = { valid, errors };
  // Compatibility with the foundation prototype/checkpoint helpers.
  Object.defineProperty(value, 'ok', { value: valid, enumerable: false, configurable: true });
  return value;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/\s/.test(value.trim());
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function isDateTime(value) {
  if (typeof value !== 'string' || !DATE_TIME_RE.test(value) || Number.isNaN(Date.parse(value))) return false;
  const match = DATE_TIME_RE.exec(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[7] === 'Z' ? null : match[7].slice(1).split(':').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
    && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59
    && (!offset || (offset[0] >= 0 && offset[0] <= 23 && offset[1] >= 0 && offset[1] <= 59));
}

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new TypeError('cyclic values are not supported');
  seen.add(value);
  let copy;
  if (Array.isArray(value)) copy = value.map((item) => clone(item, seen));
  else {
    copy = {};
    Object.keys(value).forEach((key) => { copy[key] = clone(value[key], seen); });
  }
  seen.delete(value);
  return copy;
}

function sortedValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      throw new TypeError('stable serialization only accepts JSON values');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('stable serialization rejects non-finite numbers');
    return value;
  }
  if (seen.has(value)) throw new TypeError('stable serialization rejects cyclic values');
  seen.add(value);
  let normalized;
  if (Array.isArray(value)) normalized = value.map((item) => sortedValue(item, seen));
  else {
    normalized = {};
    Object.keys(value).sort().forEach((key) => { normalized[key] = sortedValue(value[key], seen); });
  }
  seen.delete(value);
  return normalized;
}

function stableSerialize(value) {
  return JSON.stringify(sortedValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableSerialize(value), 'utf8').digest('hex');
}

function contextInput(value) {
  if (isRecord(value) && isRecord(value.scenarioContext)) return value.scenarioContext;
  return value;
}

function scenarioPrefixMatches(scenarioId, candidate, kind) {
  if (!text(scenarioId) || !text(candidate)) return false;
  const id = scenarioId.trim();
  const value = candidate.trim();
  if (value === id || value.startsWith(`${id}-`) || value.startsWith(`${id}_`) || value.startsWith(`${id}.`) || value.startsWith(`${id}/`)) return true;
  // Generic IDs remain supported, but an explicit `<scenario>-v...` or
  // `<scenario>-RUN-...` prefix must agree with scenarioId.
  const pattern = kind === 'run'
    ? /^([A-Za-z][A-Za-z0-9_-]*)-RUN-/
    : /^([A-Za-z][A-Za-z0-9_-]*)-v/;
  const match = pattern.exec(value);
  return !match || match[1] === id;
}

function normalizeScenarioContext(value, options = {}) {
  const source = contextInput(value);
  if (!isRecord(source)) return source;
  const normalized = clone(source);
  ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'status'].forEach((field) => {
    if (typeof normalized[field] === 'string') normalized[field] = normalized[field].trim();
  });
  if (options.canonicalizeDate && isDateTime(normalized.formedAt)) normalized.formedAt = new Date(normalized.formedAt).toISOString();
  return normalized;
}

function validateScenarioContext(value, options = {}) {
  const source = contextInput(value);
  const errors = [];
  const path = options.path || 'scenarioContext';
  if (!isRecord(source)) return result(false, [error(path, 'type', 'must be an object')]);
  CONTEXT_FIELDS.forEach((field) => {
    if (!hasOwn(source, field) || source[field] === null || source[field] === undefined || source[field] === '') {
      errors.push(error(`${path}.${field}`, 'required', 'is required'));
    }
  });
  ['scenarioId', 'scenarioVersion', 'scenarioRunId'].forEach((field) => {
    if (hasOwn(source, field) && !nonEmptyString(source[field])) errors.push(error(`${path}.${field}`, 'format', 'must be a non-empty string without whitespace'));
  });
  if (hasOwn(source, 'formedAt') && !isDateTime(source.formedAt)) errors.push(error(`${path}.formedAt`, 'format', 'must be an RFC 3339 date-time'));
  if (hasOwn(source, 'status') && !text(source.status)) errors.push(error(`${path}.status`, 'format', 'must be a non-empty string'));
  if (options.enforcePrefix !== false && nonEmptyString(source.scenarioId)) {
    if (nonEmptyString(source.scenarioVersion) && !scenarioPrefixMatches(source.scenarioId, source.scenarioVersion, 'version')) errors.push(error(`${path}.scenarioVersion`, 'mismatch', 'must use the scenarioId prefix'));
    if (nonEmptyString(source.scenarioRunId) && !scenarioPrefixMatches(source.scenarioId, source.scenarioRunId, 'run')) errors.push(error(`${path}.scenarioRunId`, 'mismatch', 'must use the scenarioId prefix'));
  }
  if (options.allowUnknown !== true) {
    const allowed = new Set(CONTEXT_FIELDS.concat(options.allowedFields || []));
    Object.keys(source).forEach((field) => { if (!allowed.has(field)) errors.push(error(`${path}.${field}`, 'unknown', 'is not allowed')); });
  }
  return result(errors.length === 0, errors);
}

function assertScenarioContext(value, options = {}) {
  const validation = validateScenarioContext(value, options);
  if (!validation.valid) throw new IdentityValidationError('ScenarioContext', validation.errors);
  return normalizeScenarioContext(value, options);
}

function compareScenarioContext(left, right, options = {}) {
  const a = contextInput(left);
  const b = contextInput(right);
  if (!options.skipValidation) {
    if (!validateScenarioContext(a, options).valid || !validateScenarioContext(b, options).valid) return false;
  }
  const fields = options.includeLifecycle === true ? CONTEXT_FIELDS : RUN_COMPARISON_FIELDS;
  return fields.every((field) => a?.[field] === b?.[field]);
}

function sameRunContext(left, right, options) {
  return compareScenarioContext(left, right, options);
}

function contextFingerprint(value, options = {}) {
  const context = normalizeScenarioContext(contextInput(value), options);
  const fields = options.includeLifecycle === true ? CONTEXT_FIELDS : RUN_COMPARISON_FIELDS;
  const canonical = {};
  fields.forEach((field) => { canonical[field] = context?.[field]; });
  return sha256(stableSerialize(canonical));
}

const IDEMPOTENCY_KEY_RE = new RegExp(`^${IDEMPOTENCY_KEY_PREFIX}:[a-f0-9]{64}$`);
const GENERIC_IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

function validateIdempotencyKey(value, options = {}) {
  const errors = [];
  if (!nonEmptyString(value)) errors.push(error('idempotencyKey', 'format', 'must be a non-empty token'));
  else if (options.strictGenerated === true ? !IDEMPOTENCY_KEY_RE.test(value) : !GENERIC_IDEMPOTENCY_KEY_RE.test(value)) {
    errors.push(error('idempotencyKey', 'format', options.strictGenerated ? `must match ${IDEMPOTENCY_KEY_PREFIX}:<sha256>` : 'contains unsupported characters or exceeds 256 characters'));
  }
  return result(errors.length === 0, errors);
}

function assertIdempotencyKey(value, options = {}) {
  const validation = validateIdempotencyKey(value, options);
  if (!validation.valid) throw new IdentityValidationError('IdempotencyKey', validation.errors);
  return value.trim();
}

function idempotencyInput(value, options = {}) {
  const source = isRecord(value) ? value : { request: value };
  const canonical = {};
  const fields = options.fields || REQUEST_FINGERPRINT_FIELDS;
  fields.forEach((field) => {
    if (hasOwn(source, field)) canonical[field] = source[field];
  });
  if (Object.keys(canonical).length === 0) canonical.request = source;
  return canonical;
}

function generateIdempotencyKey(value, options = {}) {
  const digest = sha256(idempotencyInput(value, options));
  return `${IDEMPOTENCY_KEY_PREFIX}:${digest}`;
}

function requestFingerprint(value, options = {}) {
  return sha256(idempotencyInput(value, options));
}

function readSeen(seen, key) {
  if (!seen) return undefined;
  if (seen instanceof Map) return seen.get(key);
  if (seen instanceof Set) return seen.has(key) ? { idempotencyKey: key, __opaque: true } : undefined;
  if (Array.isArray(seen)) {
    const found = seen.find((item) => item === key || (item && item.idempotencyKey === key));
    return found === key ? { idempotencyKey: key, __opaque: true } : found;
  }
  if (isRecord(seen)) return seen[key] === true ? { idempotencyKey: key, __opaque: true } : seen[key];
  return undefined;
}

function requestRecord(value, options = {}) {
  const request = isRecord(value) ? value : { value };
  // `rememberRequest` stores a compact record rather than the original
  // payload. Reuse its fingerprint when it is later used as the seen index;
  // recomputing from the compact record would turn a true duplicate into a
  // false conflict.
  if (nonEmptyString(request.idempotencyKey) && nonEmptyString(request.fingerprint)) {
    return {
      idempotencyKey: request.idempotencyKey,
      schemaVersion: request.schemaVersion ?? null,
      scenarioContext: request.scenarioContext ? normalizeScenarioContext(request.scenarioContext, options) : null,
      fingerprint: request.fingerprint
    };
  }
  const key = request.idempotencyKey || generateIdempotencyKey(request, options);
  const validation = validateIdempotencyKey(key, options);
  if (!validation.valid) throw new IdentityValidationError('IdempotencyKey', validation.errors);
  return {
    idempotencyKey: key,
    schemaVersion: request.schemaVersion ?? null,
    scenarioContext: request.scenarioContext ? normalizeScenarioContext(request.scenarioContext, options) : null,
    fingerprint: requestFingerprint(request, options)
  };
}

/**
 * Compare a request with a caller-owned read-only seen index. No map, record,
 * queue, or business state is mutated. `status === "new"` is the only result
 * that may proceed to a side-effecting owner.
 */
function identifyDuplicateRequest(request, seen, options = {}) {
  const current = requestRecord(request, options);
  const existing = readSeen(seen || options.seen, current.idempotencyKey);
  if (!existing) {
    return {
      duplicate: false,
      conflict: false,
      status: 'new',
      key: current.idempotencyKey,
      idempotencyKey: current.idempotencyKey,
      fingerprint: current.fingerprint,
      sideEffectAllowed: true,
      shouldShortCircuit: false
    };
  }
  const existingRecord = requestRecord(existing, options);
  if (existing && existing.__opaque) {
    return {
      duplicate: true,
      conflict: false,
      status: 'duplicate',
      reason: 'same-key-seen-index',
      key: current.idempotencyKey,
      idempotencyKey: current.idempotencyKey,
      fingerprint: current.fingerprint,
      existing: clone(existing),
      sideEffectAllowed: false,
      shouldShortCircuit: true
    };
  }
  const versionConflict = existingRecord.schemaVersion !== current.schemaVersion
    && existingRecord.schemaVersion !== null && current.schemaVersion !== null;
  const conflict = versionConflict || existingRecord.fingerprint !== current.fingerprint;
  return {
    duplicate: !conflict,
    conflict,
    status: conflict ? 'conflict' : 'duplicate',
    reason: versionConflict ? 'schema-version-conflict' : (conflict ? 'same-key-different-request' : 'same-key-same-request'),
    key: current.idempotencyKey,
    idempotencyKey: current.idempotencyKey,
    fingerprint: current.fingerprint,
    existing: clone(existing),
    sideEffectAllowed: false,
    shouldShortCircuit: true
  };
}

function rememberRequest(seen, request, options = {}) {
  const record = requestRecord(request, options);
  if (seen instanceof Map) {
    const next = new Map(seen);
    next.set(record.idempotencyKey, record);
    return next;
  }
  const next = isRecord(seen) ? clone(seen) : {};
  next[record.idempotencyKey] = record;
  return next;
}

function isValidIdempotencyKey(value, options) {
  return validateIdempotencyKey(value, options).valid;
}

function extractTraceContext(value) {
  const source = isRecord(value) ? value : {};
  const headers = isRecord(source.headers) ? source.headers : {};
  const traceId = source.traceId || source.traceparent || headers.traceId || headers.traceparent || headers['x-trace-id'];
  const correlationId = source.correlationId || headers.correlationId || headers['x-correlation-id'];
  return {
    traceId: text(traceId) ? String(traceId).trim() : null,
    correlationId: text(correlationId) ? String(correlationId).trim() : null
  };
}

function createTraceContext(value, options = {}) {
  const inherited = extractTraceContext(value);
  const traceId = inherited.traceId || options.traceId || (typeof options.traceIdFactory === 'function' ? options.traceIdFactory() : crypto.randomUUID());
  const correlationId = inherited.correlationId || options.correlationId || (typeof options.correlationIdFactory === 'function' ? options.correlationIdFactory() : traceId);
  if (!nonEmptyString(traceId) || !nonEmptyString(correlationId)) throw new IdentityValidationError('TraceContext', [error('traceId', 'format', 'trace and correlation IDs must be non-empty')]);
  return { traceId: String(traceId).trim(), correlationId: String(correlationId).trim() };
}

function propagateTraceContext(source, target = {}) {
  const trace = createTraceContext(source, { traceId: extractTraceContext(source).traceId, correlationId: extractTraceContext(source).correlationId });
  const resultValue = isRecord(target) ? clone(target) : {};
  resultValue.traceId = trace.traceId;
  resultValue.correlationId = trace.correlationId;
  return resultValue;
}

function createTraceHeaders(value) {
  const trace = createTraceContext(value);
  return { 'x-trace-id': trace.traceId, 'x-correlation-id': trace.correlationId };
}

module.exports = Object.freeze({
  IDENTITY_SCHEMA_VERSION,
  C033_SCHEMA_VERSION,
  IDEMPOTENCY_SCHEMA_VERSION,
  TRACE_SCHEMA_VERSION,
  IDEMPOTENCY_KEY_PREFIX,
  CONTEXT_FIELDS,
  RUN_COMPARISON_FIELDS,
  IdentityValidationError,
  isDateTime,
  stableSerialize,
  contextFingerprint,
  fingerprintScenarioContext: contextFingerprint,
  scenarioContextFingerprint: contextFingerprint,
  validateScenarioContext,
  assertScenarioContext,
  normalizeScenarioContext,
  compareScenarioContext,
  sameScenarioContext: compareScenarioContext,
  sameRunContext,
  isSameRunContext: sameRunContext,
  validateIdempotencyKey,
  assertIdempotencyKey,
  isValidIdempotencyKey,
  generateIdempotencyKey,
  createIdempotencyKey: generateIdempotencyKey,
  requestFingerprint,
  identifyDuplicateRequest,
  detectDuplicateRequest: identifyDuplicateRequest,
  checkIdempotency: identifyDuplicateRequest,
  rememberRequest,
  extractTraceContext,
  createTraceContext,
  propagateTraceContext,
  withTraceContext: propagateTraceContext,
  createTraceHeaders
});
