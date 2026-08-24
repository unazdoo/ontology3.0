'use strict';

const crypto = require('node:crypto');
const identity = require('../../packages/identity');
const contracts = require('../../packages/contracts');
const { fail } = require('./errors');

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail('ERR_QUERY_CYCLIC_VALUE', 'query values must not contain cycles');
  seen.add(value);
  const result = Array.isArray(value) ? value.map((item) => clone(item, seen)) : Object.fromEntries(
    Object.keys(value).map((key) => [key, clone(value[key], seen)])
  );
  seen.delete(value);
  return result;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value) || seen.has(value)) return value;
  seen.add(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function token(value) {
  return text(value) ? value.trim() : null;
}

function requiredString(value, path) {
  const result = token(value);
  if (!result || /\s/.test(result)) fail('ERR_QUERY_REQUIRED_FIELD', `${path} must be a non-empty token`, { path });
  return result;
}

function stableSerialize(value) {
  return identity.stableSerialize(jsonSafe(value));
}

function jsonSafe(value, seen = new WeakSet()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail('ERR_QUERY_CYCLIC_VALUE', 'query values must not contain cycles');
  seen.add(value);
  const result = Array.isArray(value) ? value.map((item) => jsonSafe(item, seen)) : {};
  if (!Array.isArray(value)) Object.keys(value).forEach((key) => { result[key] = jsonSafe(value[key], seen); });
  seen.delete(value);
  return result;
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableSerialize(value), 'utf8').digest('hex');
}

function fingerprint(value) {
  return sha256(value);
}

function nowIso(now) {
  const value = now === undefined ? new Date() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('ERR_QUERY_INVALID_TIME', 'time must be a valid date-time');
  return date.toISOString();
}

function assertDateTime(value, path) {
  if (!identity.isDateTime(value)) fail('ERR_QUERY_INVALID_TIME', `${path} must be an RFC 3339 date-time`, { path, value });
  return value;
}

function contextInput(value) {
  if (!isRecord(value)) return value;
  const required = ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'];
  if (required.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return value;
  if (isRecord(value.scenarioContext)) return value.scenarioContext;
  if (isRecord(value.context)) return value.context;
  return value;
}

function contextTriple(context, path = 'scenarioContext') {
  const source = contextInput(context);
  if (!isRecord(source)) fail('ERR_QUERY_CONTEXT_REQUIRED', `${path} is required`);
  let normalized;
  try {
    // Foundation's strict C033 boundary is the source of truth for M03. An
    // extension must be explicitly reconciled; it is never accepted by
    // default merely because the draft identity helper can carry it.
    normalized = contracts.assertScenarioContext(source, {
      path,
      allowUnknown: false,
      enforcePrefix: true
    });
  } catch (error) {
    fail('ERR_QUERY_CONTEXT_INVALID', `${path} is invalid`, { path, cause: error.code, errors: error.errors || error.details });
  }
  return {
    scenarioId: normalized.scenarioId,
    scenarioVersion: normalized.scenarioVersion,
    scenarioRunId: normalized.scenarioRunId,
    formedAt: normalized.formedAt,
    status: normalized.status
  };
}

function sameContext(left, right) {
  try {
    const leftContext = contextTriple(left, 'leftScenarioContext');
    const rightContext = contextTriple(right, 'rightScenarioContext');
    return identity.compareScenarioContext(leftContext, rightContext, { skipValidation: true });
  } catch (_error) {
    return false;
  }
}

function assertSameContext(expected, actual, path = 'scenarioContext') {
  const expectedContext = contextTriple(expected, `${path}.expected`);
  const actualContext = contextTriple(actual, `${path}.actual`);
  if (!identity.compareScenarioContext(expectedContext, actualContext, { skipValidation: true })) {
    fail('ERR_QUERY_CONTEXT_MISMATCH', `${path} does not match the active scenario run`, {
      expected: expectedContext,
      actual: actualContext
    });
  }
}

function pick(value, keys) {
  if (!isRecord(value)) return undefined;
  for (const key of keys) if (value[key] !== undefined && value[key] !== null) return value[key];
  return undefined;
}

function readSource(reader, label) {
  if (typeof reader === 'function') return reader;
  if (reader && typeof reader.read === 'function') return (...args) => reader.read(...args);
  if (reader && typeof reader.get === 'function') return (...args) => reader.get(...args);
  if (reader && typeof reader.snapshot === 'function') return (...args) => reader.snapshot(...args);
  if (isRecord(reader)) return () => reader;
  fail('ERR_QUERY_READER_INVALID', `${label || 'projection'} reader must be a function or read-only reader`);
}

function rejectMutationMethods(reader, label) {
  if (!reader || typeof reader !== 'object') return;
  for (const key of ['write', 'set', 'update', 'delete', 'publish', 'switch', 'mutate']) {
    if (typeof reader[key] === 'function') {
      fail('ERR_QUERY_READER_NOT_READ_ONLY', `${label || 'projection'} reader exposes a write operation`, { operation: key });
    }
  }
}

function firstObject(value, keys) {
  const selected = pick(value, keys);
  return isRecord(selected) ? selected : null;
}

function firstString(value, keys) {
  const selected = pick(value, keys);
  return text(selected) ? selected.trim() : null;
}

function normalizeEvidenceRefs(refs, path = 'evidenceRefs') {
  if (refs === undefined || refs === null) return [];
  if (!Array.isArray(refs)) fail('ERR_QUERY_EVIDENCE_INVALID', `${path} must be an array`, { path });
  const normalized = refs.map((ref, index) => {
    if (typeof ref === 'string' && ref.trim()) return { evidenceId: ref.trim() };
    if (!isRecord(ref)) fail('ERR_QUERY_EVIDENCE_INVALID', `${path}[${index}] must be a reference object`, { path: `${path}[${index}]` });
    const evidenceId = firstString(ref, ['evidenceId', 'refId', 'id', 'key']);
    if (!evidenceId) fail('ERR_QUERY_EVIDENCE_INVALID', `${path}[${index}] must identify evidence`, { path: `${path}[${index}]` });
    return {
      evidenceType: firstString(ref, ['evidenceType', 'refType', 'type', 'kind']) || null,
      evidenceId,
      evidenceVersion: firstString(ref, ['evidenceVersion', 'refVersion', 'version']) || null,
      locator: firstString(ref, ['locator', 'uri', 'path']) || null,
      digest: firstString(ref, ['digest', 'sha256', 'hash']) || null,
      owner: firstString(ref, ['owner', 'producer']) || null
    };
  });
  const unique = new Map();
  normalized.forEach((ref) => unique.set(`${ref.evidenceType || ''}:${ref.evidenceId}:${ref.evidenceVersion || ''}`, ref));
  return [...unique.values()].sort((left, right) => `${left.evidenceType || ''}:${left.evidenceId}`.localeCompare(`${right.evidenceType || ''}:${right.evidenceId}`));
}

module.exports = Object.freeze({
  isRecord,
  clone,
  deepFreeze,
  text,
  token,
  requiredString,
  stableSerialize,
  jsonSafe,
  sha256,
  fingerprint,
  nowIso,
  assertDateTime,
  contextTriple,
  sameContext,
  assertSameContext,
  pick,
  readSource,
  rejectMutationMethods,
  firstObject,
  firstString,
  normalizeEvidenceRefs
});
