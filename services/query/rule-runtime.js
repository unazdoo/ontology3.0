'use strict';

/**
 * Deterministic Rule evaluation for M03.
 *
 * This module deliberately contains no S001 thresholds or business formulas.
 * A Rule definition is a Published, parameterized condition supplied by M01;
 * this runtime only resolves the supplied metric/parameter values and records
 * the resulting fact.  Configuration, semantic, data and permission gates are
 * checked before any condition is evaluated.
 */

const crypto = require('node:crypto');
const contracts = require('../../packages/contracts');

let identity = null;
try {
  // The implementation workspace keeps Foundation packages dependency-free.
  // Loading it opportunistically also lets this module run in a browser bundle.
  identity = require('../../packages/identity');
} catch (_error) {
  identity = null;
}

const RULE_RUNTIME_SCHEMA_VERSION = 'ofw.m03.rule-run.v1';
const RULE_DEFINITION_SCHEMA_VERSION = 'ofw.m03.rule-definition.v1';
const RULE_CANDIDATE_SCHEMA_VERSION = 'ofw.m03.rule-candidate.v1';

const RULE_OUTCOMES = Object.freeze({
  HIT: 'HIT',
  NOT_HIT: 'NOT_HIT',
  UNKNOWN: 'UNKNOWN'
});

const RUN_STATUSES = Object.freeze({
  SUCCEEDED: 'SUCCEEDED',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  REPLAYED: 'REPLAYED'
});

const BLOCK_CODES = Object.freeze({
  CONTEXT_INCOMPLETE: 'CONTEXT_INCOMPLETE',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  HARD_QUALITY_FAILURE: 'HARD_QUALITY_FAILURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  UNKNOWN_STATE: 'UNKNOWN_STATE',
  CANDIDATE_EXPIRED: 'CANDIDATE_EXPIRED',
  CANDIDATE_INVALID: 'CANDIDATE_INVALID',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  EVIDENCE_MISSING: 'EVIDENCE_MISSING'
});

const ALLOW_STATUSES = new Set([
  'ALLOW', 'ALLOWED', 'READY', 'SUCCEEDED', 'SUCCESS', 'PASS', 'PASSED',
  'PUBLISHED', 'PREVIOUS_TRUSTED', 'PUBLISHED-RESULTS', 'ALLOW_WITH_WARNING',
  'ALLOWED_WITH_WARNING', 'STALE_ALLOWED', 'WARNING', 'CURRENT', 'FRESH',
  'OK', 'STALE', 'GRANTED', 'ALLOWED', 'AUTHORIZED', 'AUTHORISED', 'TRUE', 'PASS', '通过', '允许推进', '质量通过', '当前', '新鲜'
]);
const WARNING_STATUSES = new Set([
  'ALLOW_WITH_WARNING', 'ALLOWED_WITH_WARNING', 'STALE_ALLOWED', 'WARNING', 'STALE'
]);
const BLOCK_STATUSES = new Set([
  'BLOCK', 'BLOCKED', 'DENY', 'DENIED', 'FAIL', 'FAILED', 'HARD_FAIL',
  'HARD-FAIL', 'INVALID', 'INCOMPATIBLE', 'REJECTED', 'NOT_READY', 'EMPTY'
]);
const UNKNOWN_STATUSES = new Set([
  'UNKNOWN', 'PENDING', 'RUNNING', 'REFRESHING', 'PROCESSING', 'UNAVAILABLE',
  'NOT_FOUND', 'NOT-FOUND', 'UNDETERMINED'
]);

const OPERATORS = new Set([
  'eq', 'equal', '=', 'neq', 'notEqual', '!=', 'gt', 'greaterThan', '>',
  'gte', 'greaterThanOrEqual', '>=', 'lt', 'lessThan', '<', 'lte',
  'lessThanOrEqual', '<=', 'in', 'notIn', 'between', 'exists', 'notExists',
  'truthy', 'falsy'
]);

class RuleRuntimeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RuleRuntimeError';
    this.code = code;
    this.details = details;
    this.blocked = true;
    this.reasons = Array.isArray(details.reasons) ? details.reasons : [{ code, message }];
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmpty(value) {
  return text(value) || (Array.isArray(value) && value.length > 0);
}

function clone(value) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new RuleRuntimeError(BLOCK_CODES.CONTEXT_INCOMPLETE, 'Rule runtime input must be JSON serializable', {
      cause: error.message
    });
  }
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function pick(source, keys, fallback) {
  if (!isRecord(source)) return fallback;
  for (const key of keys) {
    if (hasOwn(source, key) && source[key] !== undefined && source[key] !== null) return source[key];
  }
  return fallback;
}

function normalizeStatus(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim().toUpperCase().replace(/\s+/g, '_');
}

function statusClass(value) {
  const status = normalizeStatus(value);
  if (!status || UNKNOWN_STATUSES.has(status)) return 'UNKNOWN';
  if (BLOCK_STATUSES.has(status)) return 'BLOCK';
  if (ALLOW_STATUSES.has(status)) return WARNING_STATUSES.has(status) ? 'WARNING' : 'ALLOW';
  return 'UNKNOWN';
}

function isDate(value) {
  return typeof value === 'string'
    && (identity && typeof identity.isDateTime === 'function' ? identity.isDateTime(value) : !Number.isNaN(Date.parse(value)));
}

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  if (isDate(value)) return new Date(value).toISOString();
  return null;
}

function nowFrom(clock, candidate) {
  const value = candidate || (typeof clock === 'function' ? clock() : new Date());
  const result = iso(value);
  if (!result) {
    throw new RuleRuntimeError(BLOCK_CODES.CONTEXT_INCOMPLETE, 'generatedAt must be a valid timestamp', {
      generatedAt: value
    });
  }
  return result;
}

function stable(value) {
  if (identity && typeof identity.stableSerialize === 'function') return identity.stableSerialize(value);
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (!isRecord(item)) return item;
    return Object.keys(item).sort().reduce((result, key) => {
      result[key] = sort(item[key]);
      return result;
    }, {});
  };
  return JSON.stringify(sort(value));
}

function hash(value) {
  return crypto.createHash('sha256').update(stable(value), 'utf8').digest('hex');
}

function contextInput(value) {
  if (!isRecord(value)) return value;
  const required = ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'];
  if (required.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return value;
  if (isRecord(value.scenarioContext)) return value.scenarioContext;
  if (isRecord(value.context)) return value.context;
  return value;
}

function compareContext(left, right) {
  const a = contextInput(left);
  const b = contextInput(right);
  const leftValidation = contracts.validateScenarioContext(a, { allowUnknown: false });
  const rightValidation = contracts.validateScenarioContext(b, { allowUnknown: false });
  if (!leftValidation.valid || !rightValidation.valid) return false;
  if (identity && typeof identity.compareScenarioContext === 'function') return identity.compareScenarioContext(a, b, { skipValidation: true });
  return Boolean(a && b && a.scenarioId === b.scenarioId
    && a.scenarioVersion === b.scenarioVersion && a.scenarioRunId === b.scenarioRunId);
}

function contextTriple(context) {
  return {
    scenarioId: context && context.scenarioId,
    scenarioVersion: context && context.scenarioVersion,
    scenarioRunId: context && context.scenarioRunId
  };
}

function normalizeScenarioContext(value) {
  const source = contextInput(value);
  if (!isRecord(source)) return source;
  try {
    return contracts.assertScenarioContext(source, { allowUnknown: false });
  } catch (_error) {
    // Keep the invalid shape available for the fail-closed diagnostic; the
    // run gate below returns CONTEXT_INCOMPLETE rather than accepting it.
    return clone(source);
  }
}

function validateScenarioContext(value) {
  const context = normalizeScenarioContext(value);
  const result = contracts.validateScenarioContext(context, { allowUnknown: false });
  return result.valid ? [] : result.errors;
}

function normalizeToolList(value) {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].sort();
  if (isRecord(value)) return Object.keys(value).filter((key) => value[key]).sort();
  return null;
}

function normalizeSkillVersions(value) {
  if (!Array.isArray(value)) return null;
  return value.map((item) => {
    if (text(item)) return { skillId: String(item).trim(), version: null };
    if (!isRecord(item)) return { skillId: null, version: null };
    return {
      skillId: pick(item, ['skillId', 'id', 'name'], null),
      version: pick(item, ['version', 'skillVersion'], null)
    };
  }).sort((a, b) => `${a.skillId || ''}:${a.version || ''}`.localeCompare(`${b.skillId || ''}:${b.version || ''}`));
}

function normalizeRunSnapshot(input, generatedAt) {
  const source = isRecord(input) && isRecord(input.runtimeSnapshot)
    ? input.runtimeSnapshot
    : isRecord(input) && isRecord(input.binding)
      ? input.binding
      : (isRecord(input) ? input : {});
  const context = normalizeScenarioContext(pick(source, ['scenarioContext', 'context'], pick(input, ['scenarioContext', 'context'], null)));
  const t008 = pick(source, ['t008', 'T008', 'qualityFreshness'], pick(input, ['t008', 'T008', 'qualityFreshness'], null));
  return {
    configurationVersion: pick(source, ['configurationVersion', 'configVersion', 'agentConfigurationVersion'], pick(input, ['configurationVersion', 'configVersion'], null)),
    promptVersion: pick(source, ['promptVersion', 'systemPromptVersion'], pick(input, ['promptVersion'], null)),
    skillVersions: normalizeSkillVersions(pick(source, ['skillVersions', 'skills', 'skillSet'], pick(input, ['skillVersions', 'skills'], null))),
    toolAllowlist: normalizeToolList(pick(source, ['toolAllowlist', 'toolWhitelist', 'tools'], pick(input, ['toolAllowlist', 'toolWhitelist'], null))),
    publishedOntologyVersion: pick(source, ['publishedOntologyVersion', 'ontologyVersion', 'semanticVersion', 'publishedVersion'], pick(input, ['publishedOntologyVersion', 'ontologyVersion'], null)),
    dataVersion: pick(source, ['dataVersion', 'consumableDataVersion', 'exactDataVersion'], pick(input, ['dataVersion', 'consumableDataVersion'], null)),
    t008: clone(t008),
    scenarioContext: clone(context),
    generatedAt: iso(pick(source, ['generatedAt', 'createdAt'], pick(input, ['generatedAt', 'createdAt'], generatedAt))) || generatedAt
  };
}

function validateRunSnapshot(snapshot) {
  const errors = [];
  if (!isRecord(snapshot)) return [{ path: 'runtimeSnapshot', code: 'required', message: 'must be an object' }];
  ['configurationVersion', 'promptVersion', 'publishedOntologyVersion', 'dataVersion'].forEach((key) => {
    if (!text(snapshot[key])) errors.push({ path: `runtimeSnapshot.${key}`, code: 'required', message: 'is required' });
  });
  if (!Array.isArray(snapshot.skillVersions)) errors.push({ path: 'runtimeSnapshot.skillVersions', code: 'required', message: 'must be an array' });
  else snapshot.skillVersions.forEach((skill, index) => {
    if (!isRecord(skill) || !text(skill.skillId) || !text(skill.version)) {
      errors.push({ path: `runtimeSnapshot.skillVersions[${index}]`, code: 'incomplete', message: 'skillId and version are required' });
    }
  });
  if (!Array.isArray(snapshot.toolAllowlist)) errors.push({ path: 'runtimeSnapshot.toolAllowlist', code: 'required', message: 'must be an array' });
  if (!isRecord(snapshot.t008)) errors.push({ path: 'runtimeSnapshot.t008', code: 'required', message: 'T008 snapshot is required' });
  if (!isDate(snapshot.generatedAt)) errors.push({ path: 'runtimeSnapshot.generatedAt', code: 'required', message: 'must be a timestamp' });
  errors.push(...validateScenarioContext(snapshot.scenarioContext));
  return errors;
}

function sourceVersion(source, keys) {
  return pick(source, keys, null);
}

function normalizeQualityProjection(input, snapshot) {
  const c017 = pick(input, ['c017', 'qualityProjection', 'qualityFreshness'], null);
  const t008 = snapshot.t008 || {};
  const source = isRecord(c017) ? c017 : t008;
  const qualityStatus = pick(source, ['qualityStatus', 'qualityState', 'status', 'consumptionStatus'], null)
    || pick(source.quality, ['status', 'state', 'qualityStatus'], null);
  const freshnessStatus = pick(source, ['freshnessStatus', 'freshnessState'], null)
    || pick(source.freshness, ['status', 'state', 'freshnessStatus'], null);
  const dataAsOf = pick(source, ['dataAsOf', 'dataAsOfAt', 'asOf', 'dataCutoffAt'], null);
  const warnings = pick(source, ['warnings', 'warningItems', 'qualityWarnings'], []);
  const safeSource = clone(source);
  ['rows', 'records', 'businessRows', 'sourceFields', 'workbook', 'rawData', 'members', 'details'].forEach((key) => { if (isRecord(safeSource)) delete safeSource[key]; });
  return {
    source: safeSource,
    qualityStatus: normalizeStatus(qualityStatus),
    qualityClass: statusClass(qualityStatus),
    freshnessStatus: normalizeStatus(freshnessStatus),
    freshnessClass: statusClass(freshnessStatus),
    dataAsOf: isDate(dataAsOf) ? new Date(dataAsOf).toISOString() : null,
    lastSuccessfulRefreshAt: iso(pick(source, ['lastSuccessfulRefreshAt', 'refreshedAt'], null)),
    warnings: Array.isArray(warnings) ? clone(warnings) : [],
    version: sourceVersion(source, ['version', 'projectionVersion', 't008Version', 'dataVersion'])
  };
}

function permissionState(input, quality) {
  const source = pick(input, ['permission', 'authorization', 'access'], null)
    || (isRecord(input.c017) ? pick(input.c017, ['permission', 'authorization', 'access', 'permissionStatus', 'authorizationStatus', 'accessStatus'], null) : null);
  if (source === true) return 'ALLOW';
  if (source === false) return 'BLOCK';
  if (text(source)) return statusClass(source);
  if (isRecord(source)) return source.allowed === true || source.permitted === true
    ? 'ALLOW'
    : source.allowed === false || source.permitted === false ? 'BLOCK' : 'UNKNOWN';
  return 'UNKNOWN';
}

function c008State(input) {
  const source = pick(input, ['c008', 'ontologyProjection', 'publishedProjection'], null);
  if (!isRecord(source)) return { state: 'UNKNOWN', source: null };
  const status = pick(source, ['status', 'consumptionStatus', 'state', 'lifecycleStatus', 'readStatus'], null);
  const current = isRecord(source.current) ? source.current : source;
  const semanticVersion = pick(current, ['publishedOntologyVersion', 'publishedSemanticVersion', 'semanticVersion', 'semanticVersionId'], null);
  return { state: statusClass(status), status: normalizeStatus(status), version: semanticVersion, source: clone(source) };
}

function t019State(input, snapshot) {
  const source = pick(input, ['t019', 'publishedOntology', 'semanticSnapshot'], null);
  if (!isRecord(source)) return { state: 'UNKNOWN', version: null, source: null };
  const status = pick(source, ['status', 'lifecycleStatus', 'publicationStatus', 'state', 'readStatus'], null);
  const version = pick(source, ['publishedOntologyVersion', 'ontologyVersion', 'version', 'publishedVersion'], null)
    || pick(source.current, ['publishedOntologyVersion', 'publishedSemanticVersion', 'semanticVersion', 'semanticVersionId'], null);
  return { state: statusClass(status), status: normalizeStatus(status), version, source: clone(source) };
}

function gateRun(input, snapshot, options = {}) {
  const reasons = [];
  const contextErrors = validateRunSnapshot(snapshot);
  if (contextErrors.length) reasons.push({ code: BLOCK_CODES.CONTEXT_INCOMPLETE, errors: contextErrors });

  const c008 = c008State(input);
  if (c008.state === 'BLOCK') reasons.push({ code: BLOCK_CODES.HARD_QUALITY_FAILURE, source: 'C008', status: c008.status });
  else if (c008.state === 'UNKNOWN') reasons.push({ code: BLOCK_CODES.UNKNOWN_STATE, source: 'C008', status: c008.status || null });

  const t019 = t019State(input, snapshot);
  if (t019.state === 'BLOCK') reasons.push({ code: BLOCK_CODES.VERSION_MISMATCH, source: 'T019', status: t019.status });
  else if (t019.state === 'UNKNOWN') reasons.push({ code: BLOCK_CODES.UNKNOWN_STATE, source: 'T019', status: t019.status || null });

  if (t019.version && snapshot.publishedOntologyVersion && t019.version !== snapshot.publishedOntologyVersion) {
    reasons.push({ code: BLOCK_CODES.VERSION_MISMATCH, source: 'T019', expected: snapshot.publishedOntologyVersion, actual: t019.version });
  }
  const c008Version = c008.source && sourceVersion(c008.source, ['publishedOntologyVersion', 'ontologyVersion', 'version']);
  if (c008Version && snapshot.publishedOntologyVersion && c008Version !== snapshot.publishedOntologyVersion) {
    reasons.push({ code: BLOCK_CODES.VERSION_MISMATCH, source: 'C008', expected: snapshot.publishedOntologyVersion, actual: c008Version });
  }

  const quality = normalizeQualityProjection(input, snapshot);
  if (quality.qualityClass === 'BLOCK') reasons.push({ code: BLOCK_CODES.HARD_QUALITY_FAILURE, source: 'C017/T008', status: quality.qualityStatus });
  else if (quality.qualityClass === 'UNKNOWN') reasons.push({ code: BLOCK_CODES.UNKNOWN_STATE, source: 'C017/T008', status: quality.qualityStatus });
  if (quality.freshnessClass === 'BLOCK') reasons.push({ code: BLOCK_CODES.HARD_QUALITY_FAILURE, source: 'C017/T008', status: quality.freshnessStatus });
  else if (quality.freshnessClass === 'UNKNOWN') reasons.push({ code: BLOCK_CODES.UNKNOWN_STATE, source: 'C017/T008', status: quality.freshnessStatus });

  const c017Version = isRecord(input.c017) && sourceVersion(input.c017, ['dataVersion', 'consumableDataVersion', 'exactDataVersion']);
  if (c017Version && snapshot.dataVersion && c017Version !== snapshot.dataVersion) {
    reasons.push({ code: BLOCK_CODES.VERSION_MISMATCH, source: 'C017', expected: snapshot.dataVersion, actual: c017Version });
  }
  const t008Version = sourceVersion(snapshot.t008, ['dataVersion', 'consumableDataVersion', 'exactDataVersion']);
  if (t008Version && snapshot.dataVersion && t008Version !== snapshot.dataVersion) {
    reasons.push({ code: BLOCK_CODES.VERSION_MISMATCH, source: 'T008', expected: snapshot.dataVersion, actual: t008Version });
  }

  const permission = permissionState(input, quality);
  if (permission === 'BLOCK') reasons.push({ code: BLOCK_CODES.PERMISSION_DENIED, status: 'DENIED' });
  else if (permission !== 'ALLOW') reasons.push({ code: BLOCK_CODES.PERMISSION_DENIED, status: 'UNKNOWN' });

  const expectedContext = pick(input, ['scenarioContext', 'context'], snapshot.scenarioContext);
  if (!compareContext(expectedContext, snapshot.scenarioContext)) {
    reasons.push({ code: BLOCK_CODES.VERSION_MISMATCH, source: 'scenarioContext', expected: contextTriple(snapshot.scenarioContext), actual: contextTriple(normalizeScenarioContext(expectedContext)) });
  }

  if (reasons.length && options.throw !== false) {
    const primary = reasons.some((reason) => reason.code === BLOCK_CODES.PERMISSION_DENIED)
      ? BLOCK_CODES.PERMISSION_DENIED
      : reasons.some((reason) => reason.code === BLOCK_CODES.HARD_QUALITY_FAILURE)
        ? BLOCK_CODES.HARD_QUALITY_FAILURE
        : reasons.some((reason) => reason.code === BLOCK_CODES.VERSION_MISMATCH)
          ? BLOCK_CODES.VERSION_MISMATCH
          : reasons.some((reason) => reason.code === BLOCK_CODES.CONTEXT_INCOMPLETE)
            ? BLOCK_CODES.CONTEXT_INCOMPLETE
            : BLOCK_CODES.UNKNOWN_STATE;
    throw new RuleRuntimeError(primary, 'Rule run blocked by a fail-closed gate', { reasons, quality, permission });
  }
  return { reasons, quality, permission, c008, t019 };
}

function normalizeEvidenceRefs(value) {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  const refs = values.map((item) => {
    if (text(item)) return { evidenceId: item.trim() };
    if (!isRecord(item)) return null;
    const ref = clone(item);
    const id = pick(ref, ['evidenceId', 'refId', 'id', 'key', 'uri'], null);
    const type = pick(ref, ['evidenceType', 'refType', 'type', 'kind'], null);
    const version = pick(ref, ['evidenceVersion', 'refVersion', 'version'], null);
    if (id) ref.evidenceId = id;
    if (type) ref.evidenceType = type;
    if (version) ref.evidenceVersion = version;
    return id ? ref : null;
  }).filter(Boolean);
  const byKey = new Map();
  refs.forEach((ref) => byKey.set(`${ref.evidenceId}:${ref.evidenceVersion || ''}`, ref));
  return [...byKey.values()].sort((a, b) => `${a.evidenceId}:${a.evidenceVersion || ''}`.localeCompare(`${b.evidenceId}:${b.evidenceVersion || ''}`));
}

function metricMap(value) {
  const map = new Map();
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (!isRecord(item)) return;
      const id = pick(item, ['metricId', 'id', 'key', 'name'], null);
      if (id) map.set(String(id), metricRecord(item, String(id)));
    });
  } else if (isRecord(value)) {
    Object.keys(value).forEach((key) => map.set(key, metricRecord(value[key], key)));
  }
  return map;
}

function metricRecord(value, metricId) {
  if (isRecord(value)) {
    return {
      metricId,
      value: hasOwn(value, 'value') ? value.value : pick(value, ['actualValue', 'result', 'metricValue'], undefined),
      unit: pick(value, ['unit', 'uom'], null),
      status: normalizeStatus(pick(value, ['status', 'state'], 'READY')),
      evidenceRefs: normalizeEvidenceRefs(pick(value, ['evidenceRefs', 'evidence', 'evidenceMapping'], [])),
      dataVersion: pick(value, ['dataVersion', 'consumableDataVersion'], null),
      source: {
        metricId,
        value: hasOwn(value, 'value') ? value.value : pick(value, ['actualValue', 'result', 'metricValue'], undefined),
        unit: pick(value, ['unit', 'uom'], null),
        status: normalizeStatus(pick(value, ['status', 'state'], 'READY')),
        dataVersion: pick(value, ['dataVersion', 'consumableDataVersion'], null)
      }
    };
  }
  return { metricId, value, unit: null, status: 'READY', evidenceRefs: [], dataVersion: null, source: value };
}

function parameterMap(value) {
  const map = new Map();
  if (!isRecord(value)) return map;
  Object.keys(value).forEach((key) => {
    const item = value[key];
    map.set(key, isRecord(item) && hasOwn(item, 'value') ? item.value : item);
  });
  return map;
}

function operand(value, context) {
  if (isRecord(value)) {
    const metricId = pick(value, ['metricId', 'metricRef', 'metric'], null);
    if (metricId && text(metricId)) {
      const record = context.metrics.get(String(metricId));
      if (!record) return { known: false, reason: 'METRIC_MISSING', metricId };
      return { known: record.value !== undefined && record.value !== null, value: record.value, unit: record.unit, metricId: String(metricId), evidenceRefs: record.evidenceRefs, status: record.status };
    }
    const parameter = pick(value, ['parameter', 'parameterRef', 'param'], null);
    if (parameter && text(parameter)) {
      if (!context.parameters.has(String(parameter))) return { known: false, reason: 'PARAMETER_MISSING', parameter: String(parameter) };
      return { known: true, value: context.parameters.get(String(parameter)), parameter: String(parameter), evidenceRefs: [] };
    }
    if (hasOwn(value, 'ref') && text(value.ref)) {
      const ref = String(value.ref);
      if (ref.startsWith('metric:')) return operand({ metricId: ref.slice(7) }, context);
      if (ref.startsWith('parameter:')) return operand({ parameter: ref.slice(10) }, context);
    }
    if (hasOwn(value, 'literal')) return { known: true, value: value.literal, evidenceRefs: [] };
    if (hasOwn(value, 'value') && Object.keys(value).length <= 3) return { known: true, value: value.value, unit: value.unit || null, evidenceRefs: [] };
  }
  return { known: value !== undefined && value !== null, value, evidenceRefs: [] };
}

function normalizedOperator(value) {
  if (!text(value)) return null;
  const op = String(value).trim();
  const aliases = {
    equal: 'eq', '=': 'eq', notEqual: 'neq', '!=': 'neq', greaterThan: 'gt', '>': 'gt',
    greaterThanOrEqual: 'gte', '>=': 'gte', lessThan: 'lt', '<': 'lt',
    lessThanOrEqual: 'lte', '<=': 'lte', 'not-in': 'notIn', 'not_exists': 'notExists'
  };
  return aliases[op] || op;
}

function compareValues(operator, left, right) {
  const op = normalizedOperator(operator);
  if (!OPERATORS.has(op) && !OPERATORS.has(operator)) return null;
  switch (op) {
    case 'eq': return left === right;
    case 'neq': return left !== right;
    case 'gt': return typeof left === 'number' && typeof right === 'number' && Number.isFinite(left) && Number.isFinite(right) ? left > right : null;
    case 'gte': return typeof left === 'number' && typeof right === 'number' && Number.isFinite(left) && Number.isFinite(right) ? left >= right : null;
    case 'lt': return typeof left === 'number' && typeof right === 'number' && Number.isFinite(left) && Number.isFinite(right) ? left < right : null;
    case 'lte': return typeof left === 'number' && typeof right === 'number' && Number.isFinite(left) && Number.isFinite(right) ? left <= right : null;
    case 'in': return Array.isArray(right) ? right.includes(left) : null;
    case 'notIn': return Array.isArray(right) ? !right.includes(left) : null;
    case 'between': {
      const range = Array.isArray(right) ? right : isRecord(right) ? [right.min, right.max] : null;
      return range && range.length === 2 && typeof left === 'number' && typeof range[0] === 'number' && typeof range[1] === 'number'
        ? left >= range[0] && left <= range[1] : null;
    }
    case 'exists': return left !== undefined && left !== null;
    case 'notExists': return left === undefined || left === null;
    case 'truthy': return Boolean(left);
    case 'falsy': return !left;
    default: return null;
  }
}

function conditionNode(node, context, path = 'condition') {
  if (Array.isArray(node)) {
    return conditionGroup(node, 'all', context, path);
  }
  if (!isRecord(node)) return { status: null, branches: [], reasons: ['CONDITION_INVALID'] };
  const all = pick(node, ['all', 'and'], null);
  if (Array.isArray(all)) return conditionGroup(all, 'all', context, path);
  const any = pick(node, ['any', 'or'], null);
  if (Array.isArray(any)) return conditionGroup(any, 'any', context, path);
  if (hasOwn(node, 'not')) {
    const result = conditionNode(node.not, context, `${path}.not`);
    return { ...result, status: result.status === null ? null : !result.status };
  }
  if (isRecord(node.when)) return conditionNode(node.when, context, `${path}.when`);
  if (isRecord(node.condition) || Array.isArray(node.condition)) return conditionNode(node.condition, context, `${path}.condition`);

  const operator = normalizedOperator(pick(node, ['operator', 'op', 'comparison'], null));
  const leftValue = pick(node, ['left', 'actual', 'metric', 'metricRef', 'metricId'], null);
  const rightValue = pick(node, ['right', 'expected', 'threshold', 'value', 'parameter', 'param'], null);
  if (!operator || leftValue === null || rightValue === null) return { status: null, branches: [], reasons: ['CONDITION_INVALID'] };
  const left = operand(leftValue, context);
  const right = operand(rightValue, context);
  const refs = normalizeEvidenceRefs([
    ...(left.evidenceRefs || []), ...(right.evidenceRefs || []), ...(node.evidenceRefs || node.evidence || [])
  ]);
  if (!left.known || !right.known) {
    return {
      status: null,
      branches: [{ path, operator, actualValue: left.value, expectedValue: right.value, matched: null, evidenceRefs: refs }],
      reasons: [left.reason || right.reason || 'OPERAND_UNKNOWN']
    };
  }
  const matched = compareValues(operator, left.value, right.value);
  return {
    status: matched,
    branches: [{
      path,
      operator,
      actualValue: left.value,
      expectedValue: right.value,
      unit: left.unit || right.unit || null,
      matched,
      evidenceRefs: refs,
      metricId: left.metricId || null,
      parameter: right.parameter || null
    }],
    reasons: matched === null ? ['COMPARISON_UNKNOWN'] : []
  };
}

function conditionGroup(nodes, mode, context, path) {
  const children = nodes.map((node, index) => conditionNode(node, context, `${path}.${mode}[${index}]`));
  const statuses = children.map((child) => child.status);
  const status = mode === 'any'
    ? statuses.some((value) => value === true) ? true : statuses.every((value) => value === false) ? false : null
    : statuses.every((value) => value === true) ? true : statuses.some((value) => value === false) ? false : null;
  return {
    status,
    branches: children.flatMap((child) => child.branches),
    reasons: children.flatMap((child) => child.reasons || [])
  };
}

function validateRuleDefinition(definition, options = {}) {
  const errors = [];
  if (!isRecord(definition)) return { valid: false, errors: [{ path: 'rule', code: 'type', message: 'must be an object' }] };
  const id = pick(definition, ['ruleId', 'id', 'stableId'], null);
  const version = pick(definition, ['ruleVersion', 'version'], null);
  const status = normalizeStatus(pick(definition, ['status', 'lifecycleStatus', 'publicationStatus'], null));
  if (!text(id)) errors.push({ path: 'rule.ruleId', code: 'required', message: 'is required' });
  if (!text(version)) errors.push({ path: 'rule.ruleVersion', code: 'required', message: 'is required' });
  if (status !== 'PUBLISHED') errors.push({ path: 'rule.status', code: 'not-published', message: 'must be PUBLISHED' });
  if (!hasOwn(definition, 'condition') && !hasOwn(definition, 'conditions') && !hasOwn(definition, 'branches')) {
    errors.push({ path: 'rule.condition', code: 'required', message: 'a parameterized condition or branches is required' });
  }
  if (hasOwn(definition, 'recommendedThreshold') || ['RECOMMENDATION', 'RECOMMENDED', 'PROPOSED'].includes(normalizeStatus(definition.thresholdSource))) {
    errors.push({ path: 'rule.recommendedThreshold', code: 'forbidden', message: 'recommendation thresholds are not formal business policy' });
  }
  const ontologyVersion = pick(definition, ['publishedOntologyVersion', 'publishedVersionId', 'ontologyVersion', 'semanticVersion'], null);
  if (!text(ontologyVersion)) errors.push({ path: 'rule.publishedOntologyVersion', code: 'required', message: 'must pin the exact Published ontology version' });
  if (options.publishedOntologyVersion && ontologyVersion && ontologyVersion !== options.publishedOntologyVersion) {
    errors.push({ path: 'rule.publishedOntologyVersion', code: 'mismatch', message: 'does not match the run ontology version' });
  }
  return { valid: errors.length === 0, errors };
}

function normalizedBranches(definition) {
  if (Array.isArray(definition.branches)) {
    return definition.branches.map((branch, index) => ({
      branchId: pick(branch, ['branchId', 'id', 'name'], `branch-${index + 1}`),
      condition: pick(branch, ['condition', 'when', 'conditions'], branch),
      evidenceRefs: normalizeEvidenceRefs(pick(branch, ['evidenceRefs', 'evidence'], []))
    })).sort((a, b) => String(a.branchId).localeCompare(String(b.branchId)));
  }
  return [{
    branchId: pick(definition, ['branchId'], 'main'),
    condition: pick(definition, ['condition', 'conditions'], null),
    evidenceRefs: normalizeEvidenceRefs(pick(definition, ['evidenceRefs', 'evidence'], []))
  }];
}

function evaluateRule(definition, input = {}, options = {}) {
  const validation = validateRuleDefinition(definition, { publishedOntologyVersion: options.publishedOntologyVersion });
  if (!validation.valid) {
    if (options.throwOnInvalid !== false) throw new RuleRuntimeError(BLOCK_CODES.CONTEXT_INCOMPLETE, 'Rule definition is invalid or not Published', { errors: validation.errors });
    return { outcome: RULE_OUTCOMES.UNKNOWN, reasons: validation.errors.map((error) => error.code), definition: clone(definition) };
  }
  const suppliedParameters = pick(input, ['parameters', 'ruleParameters'], definition.parameters || {});
  if (isRecord(suppliedParameters) && Object.values(suppliedParameters).some((item) => isRecord(item) && ['RECOMMENDATION', 'RECOMMENDED', 'PROPOSED'].includes(normalizeStatus(item.source || item.thresholdSource)))) {
    throw new RuleRuntimeError(BLOCK_CODES.CONTEXT_INCOMPLETE, 'recommendation parameters are not formal Rule policy');
  }
  const metrics = metricMap(pick(input, ['metrics', 'metricResults', 'metricSnapshots'], {}));
  const parameters = parameterMap(suppliedParameters);
  const context = { metrics, parameters };
  const branches = normalizedBranches(definition).map((branch) => {
    const result = conditionNode(branch.condition, context, `branch:${branch.branchId}`);
    return {
      branchId: String(branch.branchId),
      outcome: result.status === true ? RULE_OUTCOMES.HIT : result.status === false ? RULE_OUTCOMES.NOT_HIT : RULE_OUTCOMES.UNKNOWN,
      status: result.status === true ? 'hit' : result.status === false ? 'not-hit' : 'unknown',
      matched: result.status,
      conditions: result.branches,
      reasons: result.reasons,
      evidenceRefs: normalizeEvidenceRefs([...branch.evidenceRefs, ...result.branches.flatMap((item) => item.evidenceRefs || [])])
    };
  });
  const hit = branches.some((branch) => branch.matched === true);
  const unknown = branches.some((branch) => branch.matched === null);
  let outcome = hit ? RULE_OUTCOMES.HIT : unknown ? RULE_OUTCOMES.UNKNOWN : RULE_OUTCOMES.NOT_HIT;
  const evidenceRefs = normalizeEvidenceRefs([
    ...normalizeEvidenceRefs(pick(definition, ['evidenceRefs', 'evidence'], [])),
    ...branches.flatMap((branch) => branch.evidenceRefs || [])
  ]);
  const reasons = [...new Set(branches.flatMap((branch) => branch.reasons || []))];
  const result = {
    schemaVersion: RULE_DEFINITION_SCHEMA_VERSION,
    ruleId: pick(definition, ['ruleId', 'id', 'stableId'], null),
    ruleVersion: pick(definition, ['ruleVersion', 'version'], null),
    name: pick(definition, ['name', 'label', 'title'], null),
    outcome,
    status: outcome === RULE_OUTCOMES.HIT ? 'hit' : outcome === RULE_OUTCOMES.NOT_HIT ? 'not-hit' : 'unknown',
    hit: outcome === RULE_OUTCOMES.HIT,
    branches,
    evidenceRefs,
    reasons,
    parameterSnapshot: clone(Object.fromEntries(parameters.entries())),
    parameterFingerprint: hash(parameters),
    definitionFingerprint: hash(definition)
  };
  if ((options.requireEvidence || false) && !evidenceRefs.length) {
    outcome = RULE_OUTCOMES.UNKNOWN;
    result.outcome = outcome;
    result.status = 'unknown';
    result.hit = false;
    result.reasons = [...new Set([...result.reasons, BLOCK_CODES.EVIDENCE_MISSING])];
  }
  return deepFreeze(result);
}

function ruleDefinitions(input) {
  const rules = pick(input, ['rules', 'ruleDefinitions', 'publishedRules'], []);
  if (Array.isArray(rules)) return rules.slice().sort((a, b) => String(pick(a, ['ruleId', 'id'], '')).localeCompare(String(pick(b, ['ruleId', 'id'], ''))));
  if (isRecord(rules)) return Object.values(rules).sort((a, b) => String(pick(a, ['ruleId', 'id'], '')).localeCompare(String(pick(b, ['ruleId', 'id'], ''))));
  return [];
}

function evidenceMapping(ruleResults) {
  return ruleResults.reduce((mapping, result) => {
    mapping[result.ruleId] = result.evidenceRefs.map((ref) => clone(ref));
    return mapping;
  }, {});
}

function candidateValidity(input, definition) {
  const source = pick(input, ['candidateValidity', 'candidate', 'validity'], null)
    || pick(definition, ['candidateValidity', 'validity'], null);
  if (!isRecord(source)) return null;
  const validUntil = iso(pick(source, ['validUntil', 'expiresAt', 'candidateValidUntil'], null));
  if (!validUntil) return null;
  return {
    validUntil,
    issuedAt: iso(pick(source, ['issuedAt', 'createdAt'], null)),
    policyVersion: pick(source, ['policyVersion', 'validityPolicyVersion'], null)
  };
}

function createCandidate(ruleResult, definition, snapshot, input) {
  if (ruleResult.outcome !== RULE_OUTCOMES.HIT) return null;
  const validity = candidateValidity(input, definition);
  if (!validity) return null;
  const subjectRef = pick(input, ['subjectRef', 'targetRef', 'objectRef'], null);
  const canonical = {
    scenarioContext: contextTriple(snapshot.scenarioContext),
    ruleId: ruleResult.ruleId,
    ruleVersion: ruleResult.ruleVersion,
    subjectRef,
    configurationVersion: snapshot.configurationVersion,
    publishedOntologyVersion: snapshot.publishedOntologyVersion,
    dataVersion: snapshot.dataVersion,
    evidenceRefs: ruleResult.evidenceRefs,
    validUntil: validity.validUntil
  };
  return {
    schemaVersion: RULE_CANDIDATE_SCHEMA_VERSION,
    candidateId: `RULE-CAND-${hash(canonical).slice(0, 24)}`,
    ruleId: ruleResult.ruleId,
    ruleVersion: ruleResult.ruleVersion,
    subjectRef: clone(subjectRef),
    status: 'ACTIVE',
    issuedAt: validity.issuedAt || snapshot.generatedAt,
    validUntil: validity.validUntil,
    validityPolicyVersion: validity.policyVersion,
    scenarioContext: clone(snapshot.scenarioContext),
    configurationVersion: snapshot.configurationVersion,
    publishedOntologyVersion: snapshot.publishedOntologyVersion,
    dataVersion: snapshot.dataVersion,
    evidenceRefs: clone(ruleResult.evidenceRefs),
    definitionFingerprint: ruleResult.definitionFingerprint,
    parameterFingerprint: ruleResult.parameterFingerprint
  };
}

function validateCandidate(candidate, options = {}) {
  const errors = [];
  if (!isRecord(candidate)) return { valid: false, errors: [{ code: BLOCK_CODES.CANDIDATE_INVALID, message: 'candidate must be an object' }] };
  ['candidateId', 'ruleId', 'ruleVersion', 'validUntil', 'configurationVersion', 'publishedOntologyVersion', 'dataVersion'].forEach((key) => {
    if (!text(candidate[key])) errors.push({ code: BLOCK_CODES.CANDIDATE_INVALID, path: key, message: 'is required' });
  });
  if (!isDate(candidate.validUntil)) errors.push({ code: BLOCK_CODES.CANDIDATE_INVALID, path: 'validUntil', message: 'must be a timestamp' });
  const now = iso(options.now || new Date());
  if (now && isDate(candidate.validUntil) && new Date(candidate.validUntil).getTime() <= new Date(now).getTime()) {
    errors.push({ code: BLOCK_CODES.CANDIDATE_EXPIRED, path: 'validUntil', message: 'candidate validity has elapsed' });
  }
  if (options.scenarioContext && !compareContext(candidate.scenarioContext, options.scenarioContext)) {
    errors.push({ code: BLOCK_CODES.VERSION_MISMATCH, path: 'scenarioContext', message: 'candidate belongs to another run' });
  }
  ['configurationVersion', 'publishedOntologyVersion', 'dataVersion'].forEach((key) => {
    if (options[key] && candidate[key] !== options[key]) errors.push({ code: BLOCK_CODES.VERSION_MISMATCH, path: key, message: 'candidate version does not match current run' });
  });
  return { valid: errors.length === 0, errors };
}

function assertCandidate(candidate, options = {}) {
  const result = validateCandidate(candidate, options);
  if (!result.valid) {
    const code = result.errors.some((error) => error.code === BLOCK_CODES.CANDIDATE_EXPIRED)
      ? BLOCK_CODES.CANDIDATE_EXPIRED
      : result.errors.some((error) => error.code === BLOCK_CODES.VERSION_MISMATCH)
        ? BLOCK_CODES.VERSION_MISMATCH : BLOCK_CODES.CANDIDATE_INVALID;
    throw new RuleRuntimeError(code, 'Rule candidate is not usable', { errors: result.errors });
  }
  return clone(candidate);
}

function canonicalRequest(input) {
  const value = clone(input || {});
  if (isRecord(value)) {
    delete value.generatedAt;
    delete value.createdAt;
    delete value.idempotencyKey;
    delete value.retry;
    delete value.returnBlockedFact;
    if (isRecord(value.scenarioContext)) {
      value.scenarioContext = contextTriple(value.scenarioContext);
    }
  }
  return value;
}

function makeIdempotencyKey(input) {
  const provided = pick(input, ['idempotencyKey', 'runIdempotencyKey'], null);
  if (text(provided)) return String(provided).trim();
  if (identity && typeof identity.generateIdempotencyKey === 'function') return identity.generateIdempotencyKey(canonicalRequest(input));
  return `rule-run-v1:${hash(canonicalRequest(input))}`;
}

function blockedFact(input, snapshot, error, now) {
  const details = error instanceof RuleRuntimeError ? error.details : {};
  return deepFreeze({
    schemaVersion: RULE_RUNTIME_SCHEMA_VERSION,
    status: RUN_STATUSES.BLOCKED,
    runIdempotencyKey: makeIdempotencyKey(input),
    runFactId: `RULE-RUN-${hash({ scenarioContext: contextTriple(snapshot.scenarioContext), runIdempotencyKey: makeIdempotencyKey(input), generatedAt: snapshot.generatedAt || now }).slice(0, 32)}`,
    scenarioContext: clone(snapshot.scenarioContext),
    generatedAt: snapshot.generatedAt || now,
    configurationVersion: snapshot.configurationVersion,
    promptVersion: snapshot.promptVersion,
    skillVersions: clone(snapshot.skillVersions),
    toolAllowlist: clone(snapshot.toolAllowlist),
    publishedOntologyVersion: snapshot.publishedOntologyVersion,
    dataVersion: snapshot.dataVersion,
    t008: clone(snapshot.t008),
    runtimeSnapshot: clone(snapshot),
    qualityFreshness: clone(details.quality || null),
    structuredResult: null,
    ruleEvaluations: [],
    ruleHits: [],
    evidenceMapping: {},
    unanswerableReasons: clone([{ code: error.code, message: error.message }, ...(error.reasons || [])]),
    retryable: false
  });
}

function evaluateRun(input, options = {}) {
  const source = clone(input || {});
  const clock = options.clock || (() => new Date());
  const generatedAt = nowFrom(clock, pick(source, ['generatedAt', 'createdAt'], null));
  const snapshot = normalizeRunSnapshot(source, generatedAt);
  snapshot.generatedAt = generatedAt;
  if (['closed', 'abandoned', 'cancelled'].includes(String(snapshot.scenarioContext?.status || '').toLowerCase())) {
    throw new RuleRuntimeError(BLOCK_CODES.UNKNOWN_STATE, 'closed or abandoned scenario runs cannot evaluate Rules');
  }
  const gate = gateRun(source, snapshot, { throw: true });
  const definitions = ruleDefinitions(source);
  if (!definitions.length) {
    throw new RuleRuntimeError(BLOCK_CODES.CONTEXT_INCOMPLETE, 'At least one Published Rule definition is required', {
      reasons: [{ code: 'RULES_MISSING', message: 'no Rule definitions were supplied' }]
    });
  }
  const ruleResults = definitions.map((definition) => evaluateRule(definition, {
    metrics: pick(source, ['metrics', 'metricResults', 'metricSnapshots'], {}),
    parameters: pick(source, ['parameters', 'ruleParameters'], {})
  }, {
    publishedOntologyVersion: snapshot.publishedOntologyVersion,
    requireEvidence: options.requireEvidence !== false
  }));
  const evaluations = ruleResults.map((result, index) => {
    const definition = definitions[index];
    const candidate = createCandidate(result, definition, snapshot, source);
    return { ...result, candidate };
  });
  const unknownEvaluations = evaluations.filter((result) => result.outcome === RULE_OUTCOMES.UNKNOWN);
  if (unknownEvaluations.length && options.allowUnknownRule !== true) {
    throw new RuleRuntimeError(BLOCK_CODES.UNKNOWN_STATE, 'one or more Published Rules could not be determined', {
      reasons: unknownEvaluations.map((result) => ({ code: 'RULE_NOT_DETERMINABLE', ruleId: result.ruleId, reasons: result.reasons })),
      quality: gate.quality
    });
  }
  const ruleHits = evaluations.filter((result) => result.outcome === RULE_OUTCOMES.HIT);
  const missingCandidateValidity = ruleHits.filter((result) => !result.candidate).map((result) => result.ruleId);
  const unanswerableReasons = evaluations.flatMap((result) => result.reasons || []).filter(Boolean);
  const output = {
    schemaVersion: RULE_RUNTIME_SCHEMA_VERSION,
    status: RUN_STATUSES.SUCCEEDED,
    runIdempotencyKey: makeIdempotencyKey(source),
    runFactId: `RULE-RUN-${hash({ scenarioContext: contextTriple(snapshot.scenarioContext), runIdempotencyKey: makeIdempotencyKey(source), generatedAt }).slice(0, 32)}`,
    scenarioContext: clone(snapshot.scenarioContext),
    generatedAt,
    configurationVersion: snapshot.configurationVersion,
    promptVersion: snapshot.promptVersion,
    skillVersions: clone(snapshot.skillVersions),
    toolAllowlist: clone(snapshot.toolAllowlist),
    publishedOntologyVersion: snapshot.publishedOntologyVersion,
    dataVersion: snapshot.dataVersion,
    t008: clone(snapshot.t008),
    runtimeSnapshot: clone(snapshot),
    qualityFreshness: clone(gate.quality),
    structuredResult: {
      type: 'rule-evaluations',
      count: evaluations.length,
      hitCount: ruleHits.length,
      unknownCount: evaluations.filter((result) => result.outcome === RULE_OUTCOMES.UNKNOWN).length,
      evaluations: evaluations.map((result) => ({
        ruleId: result.ruleId,
        ruleVersion: result.ruleVersion,
        outcome: result.outcome,
        branches: result.branches,
        evidenceRefs: result.evidenceRefs
      }))
    },
    ruleEvaluations: evaluations,
    ruleHits,
    evidenceMapping: evidenceMapping(evaluations),
    unanswerableReasons: [...new Set(unanswerableReasons)],
    candidateValidity: {
      required: ruleHits.length > 0,
      missingForRuleIds: missingCandidateValidity,
      allValid: missingCandidateValidity.length === 0
    },
    retryable: false
  };
  return deepFreeze(output);
}

class RuleRuntime {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date());
    this.requireEvidence = options.requireEvidence !== false;
    this.ledger = options.ledger instanceof Map ? options.ledger : new Map();
  }

  execute(input = {}) {
    const key = makeIdempotencyKey(input);
    const fingerprint = hash(canonicalRequest(input));
    const existing = this.ledger.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new RuleRuntimeError(BLOCK_CODES.IDEMPOTENCY_CONFLICT, 'Idempotency key is already bound to another Rule run', {
          idempotencyKey: key,
          expectedFingerprint: existing.fingerprint,
          actualFingerprint: fingerprint
        });
      }
      return clone(existing.output);
    }
    try {
      const output = evaluateRun({ ...clone(input), idempotencyKey: key }, { clock: this.clock, requireEvidence: this.requireEvidence });
      this.ledger.set(key, { fingerprint, status: RUN_STATUSES.SUCCEEDED, attempts: 1, output: clone(output) });
      return clone(output);
    } catch (error) {
      if (error instanceof RuleRuntimeError && input.returnBlockedFact === true) {
        const generatedAt = nowFrom(this.clock, pick(input, ['generatedAt', 'createdAt'], null));
        const snapshot = normalizeRunSnapshot(input, generatedAt);
        const output = blockedFact(input, snapshot, error, generatedAt);
        this.ledger.set(key, { fingerprint, status: RUN_STATUSES.BLOCKED, attempts: 1, output: clone(output) });
        return clone(output);
      }
      throw error;
    }
  }

  retry(input = {}) {
    const key = makeIdempotencyKey(input);
    const existing = this.ledger.get(key);
    if (existing && existing.status === RUN_STATUSES.SUCCEEDED) return clone(existing.output);
    if (existing && existing.status === RUN_STATUSES.BLOCKED) {
      throw new RuleRuntimeError(existing.output.unanswerableReasons?.[0]?.code || BLOCK_CODES.UNKNOWN_STATE, 'Blocked Rule run cannot be retried without a new fixed context', {
        idempotencyKey: key,
        reasons: existing.output.unanswerableReasons
      });
    }
    const output = this.execute(input);
    return output;
  }

  getRun(idempotencyKey) {
    const record = this.ledger.get(idempotencyKey);
    return record ? clone(record.output) : null;
  }
}

function createRuleRuntime(options) {
  return new RuleRuntime(options);
}

function safeEvaluateRun(input, options = {}) {
  try {
    return evaluateRun(input, options);
  } catch (error) {
    if (!(error instanceof RuleRuntimeError)) throw error;
    const generatedAt = nowFrom(options.clock || (() => new Date()), pick(input, ['generatedAt', 'createdAt'], null));
    const snapshot = normalizeRunSnapshot(input, generatedAt);
    return blockedFact(input, snapshot, error, generatedAt);
  }
}

module.exports = Object.freeze({
  RULE_RUNTIME_SCHEMA_VERSION,
  RULE_DEFINITION_SCHEMA_VERSION,
  RULE_CANDIDATE_SCHEMA_VERSION,
  RULE_OUTCOMES,
  RUN_STATUSES,
  BLOCK_CODES,
  RuleRuntimeError,
  validateRunSnapshot,
  normalizeRunSnapshot,
  gateRun,
  validateRuleDefinition,
  evaluateRule,
  evaluateRules: (rules, input, options) => (Array.isArray(rules) ? rules : []).map((rule) => evaluateRule(rule, input, options)),
  evaluateRun,
  safeEvaluateRun,
  createCandidate,
  validateCandidate,
  assertCandidate,
  isCandidateUsable: (candidate, options) => validateCandidate(candidate, options).valid,
  makeIdempotencyKey,
  createRuleRuntime,
  RuleRuntime
});
