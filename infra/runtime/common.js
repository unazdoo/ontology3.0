'use strict';

const crypto = require('node:crypto');

const MODULE_IDS = Object.freeze(['M01', 'M02', 'M03', 'M04', 'M05', 'M06']);
const PR_SCHEMA_RE = /^pr_[1-9][0-9]*_[a-f0-9]{7,40}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

class RuntimePersistenceError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'RuntimePersistenceError';
    this.code = code;
    this.details = details || null;
  }
}

function fail(code, message, details) {
  throw new RuntimePersistenceError(code, message, details);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_ARGUMENT', `${label || 'value'} must be a non-empty string`);
  return value.trim();
}

function moduleId(value, label = 'moduleId') {
  const normalized = text(value, label).toUpperCase();
  if (!MODULE_IDS.includes(normalized)) fail('MODULE_OWNER_INVALID', `${label} must be one of ${MODULE_IDS.join(', ')}`, { value });
  return normalized;
}

function prSchema(value) {
  const normalized = text(value, 'prSchema').toLowerCase();
  if (!PR_SCHEMA_RE.test(normalized)) {
    fail('PR_SCHEMA_INVALID', 'prSchema must be derived from an isolated PR environment', { value });
  }
  return normalized;
}

function moduleSchema(prSchemaValue, moduleIdValue) {
  return `${prSchema(prSchemaValue)}_${moduleId(moduleIdValue).toLowerCase()}`;
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) fail('SQL_IDENTIFIER_INVALID', 'SQL identifier is not safe', { value });
  return `"${value}"`;
}

function stableValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') fail('JSON_VALUE_INVALID', 'runtime state must be JSON serializable');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('JSON_VALUE_INVALID', 'runtime state cannot contain a non-finite number');
    return value;
  }
  if (seen.has(value)) fail('JSON_VALUE_INVALID', 'runtime state cannot contain cycles');
  seen.add(value);
  const normalized = Array.isArray(value)
    ? value.map((item) => stableValue(item, seen))
    : Object.keys(value).sort().reduce((result, key) => {
      const item = stableValue(value[key], seen);
      result[key] = item;
      return result;
    }, {});
  seen.delete(value);
  return normalized;
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : stableSerialize(value), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function clone(value, label = 'value') {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail('JSON_VALUE_INVALID', `${label} must be JSON serializable`, { cause: error.message });
  }
}

function scenarioContext(value) {
  if (!isRecord(value)) fail('SCENARIO_CONTEXT_INVALID', 'scenarioContext must be an object');
  const allowed = new Set(['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status']);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) fail('SCENARIO_CONTEXT_INVALID', 'scenarioContext contains unknown fields', { unknown });
  const result = {
    scenarioId: text(value.scenarioId, 'scenarioContext.scenarioId'),
    scenarioVersion: text(value.scenarioVersion, 'scenarioContext.scenarioVersion'),
    scenarioRunId: text(value.scenarioRunId, 'scenarioContext.scenarioRunId'),
    formedAt: text(value.formedAt, 'scenarioContext.formedAt'),
    status: text(value.status, 'scenarioContext.status')
  };
  if (Number.isNaN(Date.parse(result.formedAt))) fail('SCENARIO_CONTEXT_INVALID', 'scenarioContext.formedAt must be an ISO date-time');
  if (/^S[0-9]{3}-/.test(result.scenarioVersion) && !result.scenarioVersion.startsWith(`${result.scenarioId}-`)) {
    fail('SCENARIO_CONTEXT_MISMATCH', 'scenarioVersion does not belong to scenarioId');
  }
  if (/^S[0-9]{3}-RUN-/.test(result.scenarioRunId) && !result.scenarioRunId.startsWith(`${result.scenarioId}-RUN-`)) {
    fail('SCENARIO_CONTEXT_MISMATCH', 'scenarioRunId does not belong to scenarioId');
  }
  return Object.freeze(result);
}

function sameScenarioRun(left, right) {
  const a = scenarioContext(left);
  const b = scenarioContext(right);
  return a.scenarioId === b.scenarioId
    && a.scenarioVersion === b.scenarioVersion
    && a.scenarioRunId === b.scenarioRunId;
}

function iso(value, label = 'time') {
  const candidate = value instanceof Date ? value : new Date(value === undefined ? Date.now() : value);
  if (Number.isNaN(candidate.getTime())) fail('TIME_INVALID', `${label} must be a valid date-time`);
  return candidate.toISOString();
}

function sha(value, label) {
  const normalized = text(value, label).toLowerCase();
  if (!SHA256_RE.test(normalized)) fail('SHA256_INVALID', `${label} must be a SHA-256 hex digest`);
  return normalized;
}

module.exports = Object.freeze({
  MODULE_IDS,
  PR_SCHEMA_RE,
  SHA256_RE,
  RuntimePersistenceError,
  fail,
  isRecord,
  text,
  moduleId,
  prSchema,
  moduleSchema,
  quoteIdentifier,
  stableSerialize,
  sha256,
  clone,
  scenarioContext,
  sameScenarioRun,
  iso,
  sha
});
