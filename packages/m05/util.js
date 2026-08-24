'use strict';

const crypto = require('node:crypto');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) throw new TypeError('cyclic values are not supported');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((item) => clone(item, seen));
  else {
    result = {};
    Object.keys(value).forEach((key) => { result[key] = clone(value[key], seen); });
  }
  seen.delete(value);
  return result;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function immutable(value) {
  return deepFreeze(clone(value));
}

function stableValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      throw new TypeError('stable serialization accepts JSON values only');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('non-finite number');
    return value;
  }
  if (seen.has(value)) throw new TypeError('cyclic values are not supported');
  seen.add(value);
  const result = Array.isArray(value) ? value.map((item) => item === undefined ? null : stableValue(item, seen)) : {};
  if (!Array.isArray(value)) Object.keys(value).sort().forEach((key) => {
    // Match JSON canonicalization: optional object fields with undefined are
    // omitted instead of making an otherwise valid snapshot unhashable.
    if (value[key] !== undefined) result[key] = stableValue(value[key], seen);
  });
  seen.delete(value);
  return result;
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  const input = typeof value === 'string' ? value : stableSerialize(value);
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function uuid(prefix) {
  return `${prefix ? `${prefix}-` : ''}${crypto.randomUUID()}`;
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

function nowIso(clock) {
  const raw = typeof clock === 'function' ? clock() : new Date().toISOString();
  const value = raw instanceof Date ? raw.toISOString() : raw;
  if (!isDateTime(value)) throw new TypeError('clock must return an RFC 3339 date-time');
  return value;
}

class M05Error extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'M05Error';
    this.code = code;
    this.details = details ? immutable(details) : null;
  }
}

function fail(code, message, details) {
  throw new M05Error(code, message, details);
}

function issue(path, code, message, details) {
  return { path, code, message, ...(details ? { details: clone(details) } : {}) };
}

function validation(valid, errors = []) {
  const result = { valid, errors };
  Object.defineProperty(result, 'ok', { value: valid, enumerable: false });
  return result;
}

function assertValid(result, contract) {
  if (!result.valid) {
    throw new M05Error('ERR_M05_VALIDATION', `${contract || 'M05 contract'} validation failed`, { errors: result.errors });
  }
  return result;
}

// These names are intentionally broad: they protect the boundary even when a
// caller uses a legacy alias for an otherwise forbidden business payload.
const FORBIDDEN_KEYS = new Set([
  'workbook', 'workbookpath', 'workbookfile', 'xlsx', 'xls', 'csv', 'spreadsheet',
  't002', 't007', 't019', 't019switch', 'switcht019', 'candidate', 'candidateversion', 'candidateasset', 'fallbackversion', 'previoustrusted', 't002rows', 't007rows', 'rows', 'columns', 'members', 'records', 'businessrows', 'rawrows', 'rawdata', 'businessdata',
  'database', 'db', 'sql', 'query', 'querytext', 'table', 'tables', 'column', 'reporttext', 'reportbody', 'html', 'markdown', 'chapters', 'paragraphs', 'documentcontent',
  'sourcefile', 'sourcepath', 'filepath', 'filecontents', 'originalsnapshot',
  'metricformula', 'ruleformula', 'rulethreshold', 'metricresult', 'ruleresult', 'actualvalue', 'expectedvalue', 'formula', 'threshold', 'calculation', 'computedmetric', 'computedrule',
  't019switch', 'switcht019', 'publishreport', 'reportpublication', 'executeaction', 'actionrequest', 'actionexecution', 'actiondispatch', 'actionconfirmation',
  'createtodo', 'todo', 'task', 'notification', 'approval', 'dispatch', 'displaystate', 'publicationstate', 'reportstatus', 'reviewstatus', 'actionstatus', 'reviewquestion', 'regenerationrequest', 'reportpublish', 'confidencescore', 'confidencepercent', 'probabilityscore', 'chainofthought', 'hiddenprompt', 'reasoningtrace', 'promptoverride',
  'systemprompt', 'systempromptoverride', 'tooloverride', 'modeloverride'
]);

function canonicalKey(key) {
  return String(key).toLowerCase().replace(/[\s_.:/-]/g, '');
}

function findForbiddenKeys(value, path = '$', found = [], seen = new WeakSet()) {
  if (Array.isArray(value)) {
    if (seen.has(value)) return found;
    seen.add(value);
    value.forEach((item, index) => findForbiddenKeys(item, `${path}[${index}]`, found, seen));
    return found;
  }
  if (!isRecord(value)) return found;
  if (seen.has(value)) return found;
  seen.add(value);
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_KEYS.has(canonicalKey(key))) found.push({ path: `${path}.${key}`, key });
    findForbiddenKeys(value[key], `${path}.${key}`, found, seen);
  });
  return found;
}

function assertNoForbiddenPayload(value, contract) {
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) fail('FORBIDDEN_INPUT', `${contract || 'M05 input'} contains prohibited business data or operation`, { fields: forbidden });
  return true;
}

function getRef(value, aliases = []) {
  if (isNonEmptyString(value)) return { id: value.trim(), version: null };
  if (!isRecord(value)) return null;
  const id = ["refId", "resourceId", "id", "key", ...aliases].map((key) => value[key]).find(isNonEmptyString);
  const version = ["refVersion", "resourceVersion", "version"].map((key) => value[key]).find(isNonEmptyString) || null;
  return id ? { id: id.trim(), version: version && version.trim() } : null;
}

function normalizeRef(value, type) {
  const ref = getRef(value);
  if (!ref) return null;
  return { refType: type || (isRecord(value) && value.refType) || 'resource', refId: ref.id, ...(ref.version ? { refVersion: ref.version } : {}) };
}

function identityFromContext(context) {
  const source = isRecord(context) && isRecord(context.scenarioContext) ? context.scenarioContext : context;
  if (!isRecord(source)) return null;
  return {
    scenarioId: source.scenarioId,
    scenarioVersion: source.scenarioVersion,
    scenarioRunId: source.scenarioRunId,
    formedAt: source.formedAt,
    status: source.status
  };
}

function compareIdentity(left, right, fields = ['scenarioId', 'scenarioVersion', 'scenarioRunId']) {
  const a = identityFromContext(left) || {};
  const b = identityFromContext(right) || {};
  const mismatches = fields.filter((field) => a[field] !== b[field]).map((field) => ({ field, left: a[field], right: b[field] }));
  return { same: mismatches.length === 0, mismatches };
}

function requireString(value, path, errors) {
  if (!isNonEmptyString(value)) errors.push(issue(path, 'required', 'must be a non-empty string'));
}

function list(value) { return Array.isArray(value) ? value : []; }

function asSet(value) { return new Set(list(value).map((item) => typeof item === 'string' ? item : item && (item.id || item.refId || item.name)).filter(Boolean)); }

module.exports = Object.freeze({
  hasOwn, isRecord, isNonEmptyString, clone, deepFreeze, immutable, stableValue, stableSerialize, sha256, uuid,
  isDateTime, nowIso, M05Error, fail, issue, validation, assertValid, FORBIDDEN_KEYS, canonicalKey,
  findForbiddenKeys, assertNoForbiddenPayload, getRef, normalizeRef, identityFromContext, compareIdentity,
  requireString, list, asSet
});
