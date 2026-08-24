'use strict';

/*
 * M03 query planning and run facts.
 *
 * This module is intentionally provider agnostic.  C008/T019 and C017 are
 * supplied through read-only adapters (or immutable snapshots); this module
 * never writes either source and never reads business rows.  A semantic query
 * executor is injected by the owning query adapter.  The executor may return
 * facts, but it cannot change the run context or the fixed version envelope.
 */

const crypto = require('node:crypto');
const identity = require('../../packages/identity');
const contracts = require('../../packages/contracts');
const c011 = require('./c011-contract');

const IMPLEMENTATION_VERSION = 'implementation-0.1.0';
const BASELINE_SNAPSHOT_ID = 'BSL-OFW-V110-94ABD0E991B7';
const SOURCE_TAG = 'prototype-v1.1.0-frozen';

const SCHEMA_VERSIONS = Object.freeze({
  C009: 'ofw.m03.c009.v1',
  C010: 'ofw.m03.c010.v1',
  C011: 'ofw.m03.c011.action-request.v1',
  C018: 'ofw.m03.c018.v1',
  QUERY_PLAN: 'ofw.m03.query-plan.v1',
  QUERY_RUN: 'ofw.m03.query-run.v1',
  RULE_RESULT: 'ofw.m03.rule-result.v1',
  CANDIDATE: 'ofw.m03.candidate.v1'
});

const PLAN_STATUSES = Object.freeze([
  'clarification-required',
  'executable',
  'running',
  'completed',
  'not-executable',
  'expired',
  'abandoned'
]);

const RUN_STATUSES = Object.freeze([
  'planned',
  'running',
  'completed',
  'blocked',
  'failed',
  'abandoned'
]);

const RESULT_STATUSES = Object.freeze(['completed', 'partial', 'not-answerable']);
const RULE_STATUSES = Object.freeze(['hit', 'not-hit', 'unknown']);
const CANDIDATE_STATUSES = Object.freeze([
  'draft', 'validating', 'passed', 'failed', 'unknown', 'submitted',
  'expired', 'superseded'
]);
const CONDITIONAL_CAPABILITIES = Object.freeze({
  qaX007ActionResultQuery: 'conditional',
  qaX010CandidateExpiry: 'conditional',
  qaX010CandidateConcurrency: 'conditional',
  qaX010CandidateChangeDetection: 'conditional'
});

const ERROR_CODES = Object.freeze({
  INVALID_ARGUMENT: 'QUERY_INVALID_ARGUMENT',
  INVALID_SCENARIO_CONTEXT: 'QUERY_INVALID_SCENARIO_CONTEXT',
  SCENARIO_CONTEXT_MISMATCH: 'QUERY_SCENARIO_CONTEXT_MISMATCH',
  SCENARIO_RUN_MISMATCH: 'QUERY_SCENARIO_RUN_MISMATCH',
  UNKNOWN_STATE: 'QUERY_UNKNOWN_STATE',
  C008_MISSING: 'QUERY_C008_MISSING',
  C008_NOT_READ_ONLY: 'QUERY_C008_NOT_READ_ONLY',
  C008_NOT_READY: 'QUERY_C008_NOT_READY',
  C008_VERSION_MISSING: 'QUERY_C008_VERSION_MISSING',
  C017_MISSING: 'QUERY_C017_MISSING',
  C017_NOT_RESTRICTED: 'QUERY_C017_NOT_RESTRICTED',
  C017_PERMISSION_DENIED: 'QUERY_C017_PERMISSION_DENIED',
  C017_HARD_QUALITY_FAILURE: 'QUERY_C017_HARD_QUALITY_FAILURE',
  C017_VERSION_MISMATCH: 'QUERY_C017_VERSION_MISMATCH',
  C017_QUALITY_UNKNOWN: 'QUERY_C017_QUALITY_UNKNOWN',
  C017_FRESHNESS_UNKNOWN: 'QUERY_C017_FRESHNESS_UNKNOWN',
  CONFIG_MISSING: 'QUERY_CONFIG_MISSING',
  CONFIG_NOT_ENABLED: 'QUERY_CONFIG_NOT_ENABLED',
  CONFIG_VERSION_MISMATCH: 'QUERY_CONFIG_VERSION_MISMATCH',
  CONFIG_CAPABILITY_UNPROVEN: 'QUERY_CONFIG_CAPABILITY_UNPROVEN',
  CONFIG_EFFECTIVE_EXPIRED: 'QUERY_CONFIG_EFFECTIVE_EXPIRED',
  PERMISSION_DENIED: 'QUERY_PERMISSION_DENIED',
  RESOURCE_NOT_ALLOWED: 'QUERY_RESOURCE_NOT_ALLOWED',
  RESOURCE_NOT_PUBLISHED: 'QUERY_RESOURCE_NOT_PUBLISHED',
  LINK_NOT_ALLOWED: 'QUERY_LINK_NOT_ALLOWED',
  FORBIDDEN_QUERY_INPUT: 'QUERY_FORBIDDEN_INPUT',
  PLAN_NOT_EXECUTABLE: 'QUERY_PLAN_NOT_EXECUTABLE',
  PLAN_EXPIRED: 'QUERY_PLAN_EXPIRED',
  IDEMPOTENCY_CONFLICT: 'QUERY_IDEMPOTENCY_CONFLICT',
  RUN_NOT_FOUND: 'QUERY_RUN_NOT_FOUND',
  RUN_NOT_RETRYABLE: 'QUERY_RUN_NOT_RETRYABLE',
  RETRY_DRIFT: 'QUERY_RETRY_DRIFT',
  ASYNC_EXECUTOR: 'QUERY_ASYNC_EXECUTOR',
  RESULT_INVALID: 'QUERY_RESULT_INVALID',
  RESULT_VERSION_MISMATCH: 'QUERY_RESULT_VERSION_MISMATCH',
  RESULT_EVIDENCE_INCOMPLETE: 'QUERY_RESULT_EVIDENCE_INCOMPLETE',
  RULE_INVALID: 'QUERY_RULE_INVALID',
  C011_NOT_ELIGIBLE: 'QUERY_C011_NOT_ELIGIBLE',
  C011_INVALID: 'QUERY_C011_INVALID',
  CANDIDATE_INVALID: 'QUERY_CANDIDATE_INVALID',
  CANDIDATE_EXPIRED: 'QUERY_CANDIDATE_EXPIRED',
  CANDIDATE_DRIFT: 'QUERY_CANDIDATE_DRIFT',
  CANDIDATE_CONCURRENT: 'QUERY_CANDIDATE_CONCURRENT'
});

const FORBIDDEN_QUERY_KEYS = new Set([
  'sql', 'querySql', 'table', 'tableName', 'column', 'columnName', 'field',
  'fieldName', 'join', 'joins', 'rawRows', 'rows', 'records', 'workbook',
  'sourceFields', 'physicalFields', 'pythonCode', 'scriptSource', 'formula',
  'memory', 'conversationMemory', 'externalKnowledge', 'latestVersion', 'latest'
]);
const FORBIDDEN_RESULT_KEYS = new Set(['workbook', 'rawData', 'sourceFields', 'physicalFields', 'sourceRows', 'sql', 'querySql', 'formula', 'pythonCode']);

class QueryPlannerError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'QueryPlannerError';
    this.code = code;
    this.details = details;
    this.errors = details;
  }
}

function fail(code, message, details) {
  throw new QueryPlannerError(code, message, details);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail(ERROR_CODES.INVALID_ARGUMENT, 'cyclic values are not supported');
  seen.add(value);
  const result = Array.isArray(value) ? value.map((item) => clone(item, seen)) : {};
  if (!Array.isArray(value)) Object.keys(value).forEach((key) => { result[key] = clone(value[key], seen); });
  seen.delete(value);
  return result;
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function immutable(value) {
  return deepFreeze(clone(value));
}

function stableSerialize(value) {
  try {
    return identity.stableSerialize(value);
  } catch (error) {
    fail(ERROR_CODES.INVALID_ARGUMENT, 'value cannot be serialized deterministically', { cause: error.message });
  }
}

function jsonSafe(value, seen = new WeakSet()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return null;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  seen.add(value);
  const result = Array.isArray(value) ? value.map((item) => jsonSafe(item, seen)) : {};
  if (!Array.isArray(value)) Object.keys(value).forEach((key) => { result[key] = jsonSafe(value[key], seen); });
  seen.delete(value);
  return result;
}

function digest(value) {
  return crypto.createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');
}

function nowIso(clock, explicit) {
  const value = explicit || (typeof clock === 'function' ? clock() : new Date().toISOString());
  if (!contracts.isDateTime(value)) fail(ERROR_CODES.INVALID_ARGUMENT, 'clock must return an RFC3339 timestamp', { value });
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

function assertContext(value) {
  try {
    return contracts.assertScenarioContext(contextInput(value), { allowUnknown: false, enforcePrefix: true });
  } catch (error) {
    fail(ERROR_CODES.INVALID_SCENARIO_CONTEXT, error.message, error.errors || error.details || null);
  }
}

function assertQueryContext(value) {
  const context = assertContext(value);
  if (!['active', 'running', 'ready', 'pending', 'restored', 'regression'].includes(String(context.status).toLowerCase())) {
    fail(ERROR_CODES.UNKNOWN_STATE, `scenario context status ${context.status} is not queryable`);
  }
  return context;
}

function sameRun(left, right) {
  const leftContext = contextInput(left);
  const rightContext = contextInput(right);
  const leftResult = contracts.validateScenarioContext(leftContext, { allowUnknown: false, enforcePrefix: true });
  const rightResult = contracts.validateScenarioContext(rightContext, { allowUnknown: false, enforcePrefix: true });
  return Boolean(leftResult.valid && rightResult.valid && identity.compareScenarioContext(leftContext, rightContext, { skipValidation: true }));
}

function requireSameRun(expected, actual, code = ERROR_CODES.SCENARIO_CONTEXT_MISMATCH) {
  if (!sameRun(expected, actual)) fail(code, 'records must use the exact same C033 scenario run', {
    expected: expected ? clone(expected) : null,
    actual: actual ? clone(actual) : null
  });
}

function firstText(source, keys) {
  for (const key of keys) if (text(source?.[key])) return source[key].trim();
  return null;
}

function firstValue(source, keys) {
  for (const key of keys) if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') return source[key];
  return null;
}

function consistentText(source, keys, code, label) {
  const values = keys.map((key) => source?.[key]).filter((value) => text(value)).map((value) => String(value).trim());
  const unique = [...new Set(values)];
  if (unique.length > 1) fail(code, `${label || 'version'} aliases disagree`, { values: unique });
  return unique[0] || null;
}

function ensureNoForbiddenKeys(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) fail(ERROR_CODES.FORBIDDEN_QUERY_INPUT, 'query input contains a cycle', { path });
  seen.add(value);
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_QUERY_KEYS.has(key) || FORBIDDEN_QUERY_KEYS.has(key.toLowerCase())) {
      fail(ERROR_CODES.FORBIDDEN_QUERY_INPUT, `query input contains forbidden physical field ${path}.${key}`, { path: `${path}.${key}` });
    }
    ensureNoForbiddenKeys(value[key], `${path}.${key}`, seen);
  });
  seen.delete(value);
}

function ensureNoPhysicalResultKeys(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) fail(ERROR_CODES.RESULT_INVALID, 'structured result contains a cycle', { path });
  seen.add(value);
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_RESULT_KEYS.has(key) || FORBIDDEN_RESULT_KEYS.has(key.toLowerCase())) {
      fail(ERROR_CODES.RESULT_INVALID, `structured result contains forbidden source field ${path}.${key}`, { path: `${path}.${key}` });
    }
    ensureNoPhysicalResultKeys(value[key], `${path}.${key}`, seen);
  });
  seen.delete(value);
}

function invokeReader(reader, names, input, missingCode) {
  if (typeof reader === 'function') return reader(input);
  if (reader && typeof reader === 'object') {
    const writes = ['write', 'set', 'update', 'delete', 'publish', 'switch', 'mutate'].filter((key) => typeof reader[key] === 'function');
    if (writes.length) fail(missingCode === ERROR_CODES.C008_MISSING ? ERROR_CODES.C008_NOT_READ_ONLY : ERROR_CODES.C017_NOT_RESTRICTED, 'read provider exposes write operations', { operations: writes });
    for (const name of names) if (typeof reader[name] === 'function') return reader[name](input);
    // A supplied object is accepted only as an immutable snapshot.  It is
    // copied before validation so callers cannot mutate a run retrospectively.
    if (reader.contractCode || reader.schemaVersion || reader.projectionId) return reader;
  }
  fail(missingCode, 'required read-only provider is unavailable');
}

function rejectPromise(value) {
  if (value && typeof value.then === 'function') fail(ERROR_CODES.ASYNC_EXECUTOR, 'synchronous API received an asynchronous provider; use the async API');
  return value;
}

function unwrapProjection(value, contractCode) {
  if (isRecord(value?.response)) return unwrapProjection(value.response, contractCode);
  if (isRecord(value?.projection) && (value.contractCode === contractCode || value.projection.contractCode === contractCode)) {
    return value.projection;
  }
  return value;
}

function normalizeC008(value, expectedContext) {
  const source = unwrapProjection(rejectPromise(value), 'C008');
  if (!isRecord(source)) fail(ERROR_CODES.C008_MISSING, 'C008 projection must be an object');
  const legacyKeys = ['v16', 'v17', 'ontologyV16', 'ontologyV17', 'publishedV16', 'publishedV17'];
  const legacyFound = legacyKeys.filter((key) => hasOwn(source, key));
  if (legacyFound.length) fail(ERROR_CODES.C008_NOT_READY, 'legacy C008 state keys cannot establish authoritative truth', { keys: legacyFound });
  if (['write', 'set', 'update', 'delete', 'publish', 'switch', 'mutate'].some((key) => typeof source[key] === 'function')) {
    fail(ERROR_CODES.C008_NOT_READ_ONLY, 'C008 provider exposes a write operation');
  }
  if (source.contractCode !== 'C008' || String(source.sourceModule || '').toUpperCase() !== 'M01' || source.readOnly !== true) {
    fail(ERROR_CODES.C008_NOT_READ_ONLY, 'C008 must be the M01 read-only authoritative projection');
  }
  // C008 is a metadata projection only.  Reject a provider that attempts to
  // smuggle source rows/workbook fields into the query boundary.
  assertRestrictedProjectionShape(source);
  const context = assertQueryContext(source.scenarioContext);
  requireSameRun(expectedContext, context);
  const readStatus = String(source.readStatus || source.legacyReadStatus || source.availabilityStatus || '').toLowerCase();
  if (!['ready', 'previous-trusted'].includes(readStatus)) {
    const code = readStatus === 'failed' || !['empty', 'failed'].includes(readStatus) ? ERROR_CODES.UNKNOWN_STATE : ERROR_CODES.C008_NOT_READY;
    fail(code, `C008 is not consumable (${readStatus || 'unknown'})`, { readStatus, reason: source.reason || null });
  }
  const current = source.current || {};
  const bindingStatus = String(current.bindingStatus || current.t019Status || '').toLowerCase();
  if (bindingStatus && ['failed', 'unknown', 'pending', 'processing', 'rejected'].includes(bindingStatus)) {
    fail(ERROR_CODES.UNKNOWN_STATE, 'T019 binding state is not authoritative', { status: bindingStatus });
  }
  const semanticLifecycle = String(current.status || current.lifecycleStatus || source.publicationStatus || 'PUBLISHED').toLowerCase();
  if (!['published', 'published-results', 'active', 'ready'].includes(semanticLifecycle)) {
    fail(ERROR_CODES.C008_NOT_READY, 'C008 does not point to an active Published semantic version', { status: semanticLifecycle });
  }
  const semanticVersionId = consistentText(current, ['semanticVersionId', 'publishedSemanticVersionId'], ERROR_CODES.C008_VERSION_MISSING, 'C008 semantic version')
    || consistentText(source, ['semanticVersionId', 'publishedSemanticVersionId'], ERROR_CODES.C008_VERSION_MISSING, 'C008 semantic version');
  const publishedVersion = consistentText(current, ['publishedSemanticVersion', 'semanticVersion'], ERROR_CODES.C008_VERSION_MISSING, 'C008 Published version')
    || consistentText(source, ['publishedSemanticVersion', 'semanticVersion'], ERROR_CODES.C008_VERSION_MISSING, 'C008 Published version');
  const dataVersion = consistentText(current, ['consumableDataVersion', 'dataVersion'], ERROR_CODES.C008_VERSION_MISSING, 'C008 data version')
    || consistentText(source, ['consumableDataVersion', 'dataVersion'], ERROR_CODES.C008_VERSION_MISSING, 'C008 data version');
  const t008 = firstValue(current, ['dataAsOf', 'asOf', 't008'])
    || firstValue(source, ['dataAsOf', 'dataAsOfTime', 'asOf', 't008']);
  const t019Id = firstText(current, ['t019Id', 'publishedPointer']) || firstText(source, ['publishedPointer', 't019Id']);
  if (!token(semanticVersionId) || !token(publishedVersion) || !token(dataVersion) || !token(t019Id)) {
    fail(ERROR_CODES.C008_VERSION_MISSING, 'C008 ready projection must pin Published, T019 and exact T007 data version');
  }
  return immutable({
    schemaVersion: source.schemaVersion || 'ofw.m01.c008.v1',
    contractCode: 'C008',
    sourceId: source.sourceId || 'M01:C008',
    projectionId: source.projectionId || null,
    projectionVersion: source.projectionVersion || null,
    readStatus,
    formedAt: source.formedAt || null,
    scenarioContext: context,
    current: {
      combinationId: current.combinationId || null,
      t019Id,
      semanticVersionId,
      publishedSemanticVersion: publishedVersion,
      dataVersion,
      consumableDataVersion: dataVersion,
      dataAsOf: t008 === null || t008 === undefined ? null : String(t008),
      t008: t008 === null || t008 === undefined ? null : String(t008),
      t006Id: firstText(current, ['t006Id', 'assetId']) || firstText(source, ['t006Id', 'assetId']),
      t017Id: firstText(current, ['t017Id']) || firstText(source, ['t017Id']),
      resourceContractFingerprint: current.resourceContractFingerprint || null,
      endpointContractFingerprint: current.endpointContractFingerprint || null,
      evidenceRefs: Array.isArray(current.evidenceRefs) ? current.evidenceRefs : []
    },
    candidateValidation: source.candidateValidation || null,
    readOnly: true,
  });
}

function assertRestrictedProjectionShape(value) {
  ensureNoForbiddenKeys(value);
  return value;
}

function normalizeC017(value, expectedContext, c008) {
  const wrapper = rejectPromise(value);
  if (!isRecord(wrapper)) fail(ERROR_CODES.C017_MISSING, 'C017 projection must be an object');
  const projection = unwrapProjection(wrapper, 'C017');
  if (!isRecord(projection) || projection.contractCode !== 'C017') fail(ERROR_CODES.C017_MISSING, 'C017 contract code is missing');
  if (projection.readOnly === false || projection.immutable === false || projection.writable === true) fail(ERROR_CODES.C017_NOT_RESTRICTED, 'C017 projection is writable');
  if (['write', 'set', 'update', 'delete', 'publish', 'switch', 'mutate'].some((key) => typeof projection[key] === 'function')) {
    fail(ERROR_CODES.C017_NOT_RESTRICTED, 'C017 provider exposes a write operation');
  }
  assertRestrictedProjectionShape(projection);
  const consumer = String(projection.consumer || projection.consumerId || wrapper.consumer || wrapper.consumerId || '').toLowerCase();
  if (!['intelligent-query', 'm03', '智能问数', '智能问数模块'].includes(consumer)) fail(ERROR_CODES.C017_PERMISSION_DENIED, 'C017 projection is not issued to intelligent-query');
  const context = assertQueryContext(projection.scenarioContext || wrapper.scenarioContext);
  requireSameRun(expectedContext, context);
  const dataVersion = firstText(projection, ['assetVersionId', 't007Id', 'dataVersion']);
  const t008Raw = firstValue(projection, ['asOfTime', 't008', 'dataAsOf']);
  const t008 = isRecord(t008Raw) ? firstString(t008Raw, ['value', 'asOf', 'dataAsOf', 'through']) : t008Raw;
  if (!token(dataVersion) || !text(t008)) fail(ERROR_CODES.C017_VERSION_MISMATCH, 'C017 must pin one exact T007 and T008');
  if (dataVersion !== c008.current.dataVersion || (c008.current.dataAsOf && String(t008) !== String(c008.current.dataAsOf))) {
    fail(ERROR_CODES.C017_VERSION_MISMATCH, 'C017 T007/T008 differs from the C008/T019 combination', {
      c008DataVersion: c008.current.dataVersion,
      c017DataVersion: dataVersion,
      c008T008: c008.current.dataAsOf,
      c017T008: String(t008)
    });
  }
  const rawQualification = String(projection.dataSideQualification || '').toLowerCase();
  const qualification = rawQualification.includes('allow') || rawQualification.includes('允许')
    ? rawQualification.includes('warning') || rawQualification.includes('警告') ? 'allowed-with-warning' : 'allowed'
    : rawQualification;
  const qualityStatusToken = String(projection.quality?.status || projection.qualityStatus || '').toLowerCase();
  const permissionToken = String(projection.permissionStatus || projection.authorizationStatus || '').toLowerCase();
  const projectionBlock = String(projection.blockingReason || '').toLowerCase();
  if (permissionToken && ['denied', 'blocked', 'forbidden', '无权'].some((item) => permissionToken.includes(item))) {
    fail(ERROR_CODES.C017_PERMISSION_DENIED, 'C017 projection denies M03 consumption', { permissionStatus: permissionToken });
  }
  if (permissionToken && !['granted', 'allowed', 'authorized', 'authorised', 'true', 'pass'].includes(permissionToken)) {
    fail(ERROR_CODES.UNKNOWN_STATE, 'C017 permission state is unknown', { permissionStatus: permissionToken });
  }
  if (projectionBlock === 'permission-denied') fail(ERROR_CODES.C017_PERMISSION_DENIED, 'C017 projection denies M03 consumption');
  if (String(projection.status || '').toLowerCase() === 'permission-denied') fail(ERROR_CODES.C017_PERMISSION_DENIED, 'C017 projection denies M03 consumption');
  if (projectionBlock === 'hard-quality-failure' || ['quality-failed', 'hard-failed'].includes(String(projection.status || '').toLowerCase()) || projection.hardQualityFailure === true || projection.quality?.hardFailure === true || qualityStatusToken.includes('fail') || qualityStatusToken.includes('失败') || qualityStatusToken.includes('prohibit')) {
    fail(ERROR_CODES.C017_HARD_QUALITY_FAILURE, 'C017 marks the exact data version as prohibited by a hard quality failure');
  }
  if (projectionBlock === 'unknown-state' || ['unknown', 'not-found', 'failed', 'permission-denied', 'refreshing', 'processing'].includes(String(projection.status || '').toLowerCase())) {
    fail(ERROR_CODES.UNKNOWN_STATE, 'C017 projection state is not determinable', { status: projection.status, blockingReason: projection.blockingReason || null });
  }
  if (qualification === 'prohibited' || projection.hardQualityFailure === true || projection.quality?.hardFailure === true || qualityStatusToken.includes('fail') || qualityStatusToken.includes('失败') || qualityStatusToken.includes('prohibit')) {
    fail(ERROR_CODES.C017_HARD_QUALITY_FAILURE, 'C017 marks the exact data version as prohibited by a hard quality failure', {
      dataVersion,
      affectedScope: projection.affectedScope || null,
      reason: projection.qualificationReason || projection.reason || null
    });
  }
  if (!['allowed', 'allowed-with-warning'].includes(qualification)) {
    fail(ERROR_CODES.UNKNOWN_STATE, 'C017 data-side qualification is unknown or unavailable', { qualification });
  }
  const quality = projection.quality;
  const qualityStatus = firstText(quality, ['status']) || firstText(projection, ['qualityStatus', 'currentQualityStatus']);
  const normalizedQualityStatus = String(qualityStatus || '').toLowerCase();
  if (!qualityStatus || ['unknown', 'not-run', 'running', 'pending', 'processing'].includes(normalizedQualityStatus)) fail(ERROR_CODES.C017_QUALITY_UNKNOWN, 'C017 quality status is not a known terminal state', { qualityStatus });
  const freshness = projection.freshness;
  const freshnessStatus = firstText(freshness, ['status']) || firstText(projection, ['freshnessStatus']);
  const normalizedFreshnessStatus = String(freshnessStatus || '').toLowerCase();
  if (!freshnessStatus || ['unknown', 'not-run', 'running', 'pending', 'processing'].includes(normalizedFreshnessStatus)) fail(ERROR_CODES.C017_FRESHNESS_UNKNOWN, 'C017 freshness status is not a known terminal state', { freshnessStatus });
  return immutable({
    schemaVersion: projection.schemaVersion || projection.contractVersion || 'm02-data.draft.v1',
    contractCode: 'C017',
    consumer,
    summaryId: projection.summaryId || wrapper.currentStateSummary?.summaryId || null,
    summaryVersion: projection.summaryVersion || wrapper.currentStateSummary?.summaryVersion || null,
    scenarioContext: context,
    dataVersion,
    t008: String(t008),
    t008Evidence: Array.isArray(projection.evidence) ? projection.evidence : (projection.t008Evidence || (isRecord(t008Raw) ? t008Raw.evidenceRefs || t008Raw.evidence || [] : [])),
    qualification,
    quality: projection.quality || { status: qualityStatus },
    freshness: projection.freshness || { status: freshnessStatus },
    evidence: Array.isArray(projection.evidence) ? projection.evidence : [],
    warnings: projection.warnings || projection.quality?.warnings || [],
    currentAuthority: projection.currentAuthority || null,
    previousAuthority: projection.previousAuthority || null,
  });
}

function publicProjection(value) {
  if (!isRecord(value)) return value;
  const copy = clone(value);
  delete copy.raw;
  return immutable(copy);
}

function normalizeStringList(value, field) {
  if (!Array.isArray(value)) fail(ERROR_CODES.CONFIG_MISSING, `${field} must be an array`);
  const result = value.map((item) => {
    if (text(item)) return item.trim();
    if (isRecord(item) && token(item.id || item.skillId || item.toolId || item.resourceId)) return clone(item);
    fail(ERROR_CODES.CONFIG_MISSING, `${field} contains an invalid entry`);
  });
  return result;
}

function identityOf(value, fallbackKeys = ['id', 'skillId', 'toolId', 'resourceId']) {
  if (text(value)) return value.trim();
  if (isRecord(value)) return firstText(value, fallbackKeys);
  return null;
}

function configProofList(config, keys, field) {
  for (const key of keys) if (config[key] !== undefined) return normalizeStringList(config[key], field);
  return null;
}

function listIds(value) {
  return (value || []).map((item) => identityOf(item)).filter(Boolean);
}

function capabilityKey(value) {
  if (text(value)) return value.trim();
  if (!isRecord(value)) return null;
  const id = identityOf(value, ['id', 'skillId', 'toolId', 'resourceId']);
  if (!id) return null;
  const version = firstText(value, ['version', 'skillVersion', 'toolVersion', 'resourceVersion']);
  return version ? `${id}@${version}` : id;
}

function equalIdLists(expected, actual) {
  const left = [...new Set((expected || []).map(capabilityKey).filter(Boolean))].sort();
  const right = [...new Set((actual || []).map(capabilityKey).filter(Boolean))].sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function normalizeConfig(config, expectedContext, c008, clock) {
  if (!isRecord(config)) fail(ERROR_CODES.CONFIG_MISSING, 'C009 configuration snapshot is required');
  const forbiddenAgentFields = ['reportAgent', 'insightAgent', 'companionAgent', 'agentApplication', 'conversationMemory', 'externalKnowledge'];
  const injected = forbiddenAgentFields.filter((key) => hasOwn(config, key));
  if (injected.length) fail(ERROR_CODES.CONFIG_CAPABILITY_UNPROVEN, 'M05/report-agent context cannot be injected into C009', { fields: injected });
  const configVersion = firstText(config, ['configVersion', 'version', 'configurationVersion']);
  const promptVersion = firstText(config, ['promptVersion', 'systemPromptVersion'])
    || firstText(config.prompt, ['version', 'promptVersion']);
  const skillSet = config.skillSet || config.skills || config.skillVersions;
  const toolAllowlist = config.toolAllowlist || config.toolWhitelist || config.tools;
  const publishedOntologyVersion = firstText(config, ['publishedOntologyVersion', 'semanticVersion', 'semanticVersionId', 'ontologyVersion']);
  const resourceAllowlist = config.resourceAllowlist || config.resourceWhitelist || config.resources;
  if (!token(configVersion) || !token(promptVersion) || !token(publishedOntologyVersion)) fail(ERROR_CODES.CONFIG_MISSING, 'C009 must pin config, Prompt and Published versions');
  const actualPromptVersion = firstText(config, ['actualPromptVersion', 'loadedPromptVersion']) || firstText(config.capabilityProof, ['promptVersion', 'actualPromptVersion']);
  if (actualPromptVersion && actualPromptVersion !== promptVersion) fail(ERROR_CODES.CONFIG_CAPABILITY_UNPROVEN, 'C009 actual Prompt loading proof is mismatched', { expected: promptVersion, actual: actualPromptVersion });
  const expectedPlatformVersion = firstText(config, ['platformDeterminismVersion', 'deterministicCapabilityVersion', 'platformVersion']);
  const actualPlatformVersion = firstText(config, ['actualPlatformDeterminismVersion', 'loadedPlatformVersion']) || firstText(config.capabilityProof, ['platformDeterminismVersion', 'platformVersion']);
  if (expectedPlatformVersion && actualPlatformVersion && expectedPlatformVersion !== actualPlatformVersion) fail(ERROR_CODES.CONFIG_CAPABILITY_UNPROVEN, 'C009 platform deterministic capability proof is mismatched', { expected: expectedPlatformVersion, actual: actualPlatformVersion });
  const skills = normalizeStringList(skillSet, 'skillSet');
  const tools = normalizeStringList(toolAllowlist, 'toolAllowlist');
  const resources = normalizeStringList(resourceAllowlist, 'resourceAllowlist');
  const enabled = config.enabled === true || ['enabled', 'active'].includes(String(config.status || '').toLowerCase());
  if (!enabled) fail(ERROR_CODES.CONFIG_NOT_ENABLED, 'C009 configuration is not enabled');
  if (publishedOntologyVersion !== c008.current.semanticVersionId && publishedOntologyVersion !== c008.current.publishedSemanticVersion) {
    fail(ERROR_CODES.CONFIG_VERSION_MISMATCH, 'C009 Published ontology binding differs from C008/T019');
  }
  if (c008.current.semanticVersionId && publishedOntologyVersion !== c008.current.semanticVersionId) {
    fail(ERROR_CODES.CONFIG_VERSION_MISMATCH, 'C009 must bind the exact Published semantic identity, not only its display version', {
      expected: c008.current.semanticVersionId,
      actual: publishedOntologyVersion
    });
  }
  const effectiveFrom = config.effectiveFrom || config.validFrom || null;
  const effectiveTo = config.effectiveTo || config.validTo || config.expiresAt || null;
  const now = nowIso(clock, config.evaluationTime || undefined);
  if (effectiveFrom && (!contracts.isDateTime(effectiveFrom) || Date.parse(now) < Date.parse(effectiveFrom))) {
    fail(ERROR_CODES.CONFIG_EFFECTIVE_EXPIRED, 'C009 configuration is not yet effective', { effectiveFrom, now });
  }
  if (effectiveTo && (!contracts.isDateTime(effectiveTo) || Date.parse(now) >= Date.parse(effectiveTo))) {
    fail(ERROR_CODES.CONFIG_EFFECTIVE_EXPIRED, 'C009 configuration validity window has expired', { effectiveTo, now });
  }
  const loadedSkills = config.loadedSkillSet || config.loadedSkills || config.actualSkills || config.capabilityProof?.skills;
  const availableTools = config.availableTools || config.actualTools || config.capabilityProof?.tools;
  const proofStatus = firstText(config.capabilityProof, ['status', 'state']);
  if (proofStatus && !['loaded', 'available', 'verified', 'ready', 'passed'].includes(proofStatus.toLowerCase())) {
    fail(ERROR_CODES.CONFIG_CAPABILITY_UNPROVEN, 'C009 Skill/Tool capability proof is not affirmative', { status: proofStatus });
  }
  if (!loadedSkills || !availableTools || !equalIdLists(skills, loadedSkills) || !equalIdLists(tools, availableTools)) {
    fail(ERROR_CODES.CONFIG_CAPABILITY_UNPROVEN, 'C009 actual Skill/Tool loading proof is missing or mismatched');
  }
  const context = config.scenarioContext || expectedContext;
  requireSameRun(expectedContext, assertContext(context));
  return immutable({
    schemaVersion: config.schemaVersion || SCHEMA_VERSIONS.C009,
    configId: firstText(config, ['configId', 'agentId']) || null,
    configVersion,
    promptVersion,
    skillSet: skills,
    toolAllowlist: tools,
    loadedSkillSet: normalizeStringList(loadedSkills, 'loadedSkillSet'),
    availableTools: normalizeStringList(availableTools, 'availableTools'),
    toolAllowlistVersion: firstText(config, ['toolAllowlistVersion', 'toolWhitelistVersion', 'toolsVersion']) || null,
    resourceAllowlistVersion: firstText(config, ['resourceAllowlistVersion', 'resourceWhitelistVersion', 'resourceVersion']) || null,
    publishedOntologyVersion,
    platformDeterminismVersion: expectedPlatformVersion || null,
    resourceAllowlist: resources,
    scenarioContext: expectedContext,
    effectiveFrom,
    effectiveTo,
    enabled: true,
    capabilityProof: config.capabilityProof || { skills: clone(loadedSkills), tools: clone(availableTools) },
    raw: clone(config)
  });
}

function permissionValue(permissions, keys) {
  for (const key of keys) {
    if (permissions && hasOwn(permissions, key)) return permissions[key];
    if (permissions?.read && hasOwn(permissions.read, key)) return permissions.read[key];
  }
  return undefined;
}

function assertPermissions(permissions, input = {}) {
  if (typeof input.permissionChecker === 'function') {
    const checked = input.permissionChecker({ operation: 'query-read', permissions: clone(permissions || {}) });
    if (checked !== true && checked?.allowed !== true) fail(ERROR_CODES.PERMISSION_DENIED, 'query read permission was not granted', checked || null);
    return;
  }
  const source = permissions || input.permissions || input.authorization;
  const c008 = permissionValue(source, ['c008', 'readC008', 'C008']);
  const c017 = permissionValue(source, ['c017', 'readC017', 'C017']);
  if (c008 !== true || c017 !== true) fail(ERROR_CODES.PERMISSION_DENIED, 'query requires explicit read permission for C008 and C017', { c008, c017 });
}

function normalizeResourceRef(value, kind) {
  const id = identityOf(value, ['id', 'resourceId', `${kind}Id`]);
  if (!token(id)) fail(ERROR_CODES.INVALID_ARGUMENT, `${kind} reference must have a stable id`);
  return {
    id,
    type: isRecord(value) ? (value.type || value.resourceType || kind) : kind,
    version: isRecord(value) ? (value.version || value.resourceVersion || null) : null,
    direction: isRecord(value) ? (value.direction || null) : null
  };
}

function resourceIdsFromQuery(query) {
  const refs = [];
  const groups = [
    ['objectRefs', 'Object'], ['objects', 'Object'], ['metricRefs', 'Metric'],
    ['metrics', 'Metric'], ['ruleRefs', 'Rule'], ['rules', 'Rule'],
    ['linkRefs', 'LinkType'], ['links', 'LinkType'], ['actionTypes', 'ActionType']
  ];
  groups.forEach(([key, kind]) => {
    if (!query[key]) return;
    if (!Array.isArray(query[key])) fail(ERROR_CODES.INVALID_ARGUMENT, `${key} must be an array`);
    query[key].forEach((item) => refs.push(normalizeResourceRef(item, kind)));
  });
  if (Array.isArray(query.resourceRefs)) query.resourceRefs.forEach((item) => refs.push(normalizeResourceRef(item, 'Resource')));
  const dedup = new Map();
  refs.forEach((item) => { if (!dedup.has(item.id)) dedup.set(item.id, item); });
  return [...dedup.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function semanticResources(c008) {
  const current = c008.current || {};
  const candidates = current.resources || [];
  return Array.isArray(candidates) ? candidates : [];
}

function assertResourceEligibility(query, config, c008) {
  const refs = Array.isArray(query.resources) && query.resources.length
    ? query.resources.map((item) => normalizeResourceRef(item, item.type || 'Resource'))
    : resourceIdsFromQuery(query);
  const allowedEntries = new Map((config.resourceAllowlist || []).map((item) => [identityOf(item), item]));
  const allowed = new Set([...allowedEntries.keys()].filter(Boolean));
  const published = semanticResources(c008);
  const publishedEntries = new Map(published.map((item) => [identityOf(item), item]));
  const publishedIds = new Set([...publishedEntries.keys()].filter(Boolean));
  refs.forEach((ref) => {
    // Object instances are resolved within the explicitly selected scope;
    // the whitelist pins semantic Object types/resources, not every subject
    // identity a user may select.  Metric/Rule/Link/Action refs remain
    // default-deny and must be present in both the C009 whitelist and the
    // exact Published package when that package exposes a catalog.
    const isObjectInstance = String(ref.type || ref.kind || '').toLowerCase() === 'object';
    if (!isObjectInstance && (allowed.size === 0 || !allowed.has(ref.id))) fail(ERROR_CODES.RESOURCE_NOT_ALLOWED, `resource ${ref.id} is outside the C009 allowlist`, { resourceId: ref.id });
    if (!isObjectInstance && publishedIds.size > 0 && !publishedIds.has(ref.id)) fail(ERROR_CODES.RESOURCE_NOT_PUBLISHED, `resource ${ref.id} is not in the exact Published package`, { resourceId: ref.id });
    const configured = allowedEntries.get(ref.id);
    const configuredVersion = isRecord(configured) ? firstText(configured, ['version', 'resourceVersion', 'publishedVersion']) : null;
    if (!isObjectInstance && configuredVersion && ref.version && configuredVersion !== ref.version) fail(ERROR_CODES.CONFIG_VERSION_MISMATCH, `resource ${ref.id} version differs from C009 whitelist`, { expected: configuredVersion, actual: ref.version });
    const publishedVersion = isRecord(publishedEntries.get(ref.id)) ? firstText(publishedEntries.get(ref.id), ['version', 'resourceVersion', 'publishedVersion']) : null;
    if (!isObjectInstance && publishedVersion && ref.version && publishedVersion !== ref.version) fail(ERROR_CODES.RESOURCE_NOT_PUBLISHED, `resource ${ref.id} version differs from Published package`, { expected: publishedVersion, actual: ref.version });
  });
  (query.links || query.linkRefs || []).forEach((link) => {
    if (!isRecord(link)) return;
    if (link.direction && link.allowedDirections && !link.allowedDirections.includes(link.direction)) fail(ERROR_CODES.LINK_NOT_ALLOWED, `link direction ${link.direction} is not allowed`, { link });
    if (link.sourceId && link.targetId && link.endpointIds && (!link.endpointIds.includes(link.sourceId) || !link.endpointIds.includes(link.targetId))) fail(ERROR_CODES.LINK_NOT_ALLOWED, 'link endpoints are outside the Published endpoint contract', { link });
  });
  return refs;
}

function normalizeScope(query) {
  const raw = query.scope || query.objectScope || {};
  const objects = Array.isArray(raw.objects) ? raw.objects : Array.isArray(query.objects) ? query.objects : [];
  const normalized = objects.map((item) => {
    const id = identityOf(item, ['id', 'objectId', 'stableId']);
    if (!token(id)) fail(ERROR_CODES.INVALID_ARGUMENT, 'object scope must use stable identities');
    return { id, label: isRecord(item) ? (item.label || item.name || null) : null, level: isRecord(item) ? (item.level || item.type || null) : null };
  });
  const seen = new Set();
  const deduped = [];
  const duplicates = [];
  normalized.forEach((item) => {
    if (seen.has(item.id)) duplicates.push(item.id);
    else { seen.add(item.id); deduped.push(item); }
  });
  deduped.sort((a, b) => a.id.localeCompare(b.id));
  return { objects: deduped, duplicates: [...new Set(duplicates)].sort() };
}

function normalizeQuery(input) {
  const query = isRecord(input) ? clone(input) : { question: input };
  ensureNoForbiddenKeys(query);
  const originalQuestion = firstText(query, ['originalQuestion', 'question', 'text']);
  if (!originalQuestion) fail(ERROR_CODES.INVALID_ARGUMENT, 'query must include the original user question');
  const finalUnderstanding = firstText(query, ['finalUnderstanding', 'understanding']) || originalQuestion;
  const scope = normalizeScope(query);
  const resources = resourceIdsFromQuery(query);
  const inherited = query.inheritedContext || query.sessionInheritance || null;
  return {
    originalQuestion,
    finalUnderstanding,
    intent: query.intent || 'query',
    scope,
    time: query.time || query.timeRange || null,
    filters: Array.isArray(query.filters) ? query.filters : [],
    groupBy: Array.isArray(query.groupBy) ? query.groupBy : [],
    orderBy: Array.isArray(query.orderBy) ? query.orderBy : [],
    output: query.output || 'structured',
    resources,
    links: Array.isArray(query.links || query.linkRefs) ? clone(query.links || query.linkRefs) : [],
    ruleDefinitions: Array.isArray(query.ruleDefinitions) ? clone(query.ruleDefinitions) : [],
    inheritedContext: inherited ? clone(inherited) : null,
    topN: query.topN === undefined ? null : query.topN,
    parameters: query.parameters ? clone(query.parameters) : {},
    clarificationRequired: query.clarificationRequired === true || query.needsClarification === true,
    ambiguous: query.ambiguous === true
  };
}

function createPlanSnapshot(input, dependencies) {
  const context = dependencies.context;
  const query = normalizeQuery(input.query || input);
  const configuration = dependencies.configuration || dependencies.config;
  if (query.clarificationRequired === true || query.needsClarification === true || query.ambiguous === true) {
    const clarificationFingerprint = digest({ context, query, configVersion: configuration?.configVersion || null });
    return immutable({
      schemaVersion: SCHEMA_VERSIONS.QUERY_PLAN,
      planId: `QPLAN-${clarificationFingerprint.slice(0, 24)}`,
      planFingerprint: clarificationFingerprint,
      status: 'clarification-required',
      scenarioContext: context,
      originalQuestion: query.originalQuestion,
      finalUnderstanding: query.finalUnderstanding,
      query,
      scope: query.scope,
      configuration: configuration || null,
      semantic: null,
      data: null,
      gates: { clarification: 'required' },
      blockedReasons: [{ code: 'CLARIFICATION_REQUIRED', message: 'object, scope, time or semantic ambiguity must be resolved before execution' }],
      createdAt: dependencies.createdAt
    });
  }
  const resources = assertResourceEligibility(query, configuration, dependencies.c008);
  const semantic = {
    t019Id: dependencies.c008.current.t019Id,
    t019Version: dependencies.c008.current.bindingVersion || null,
    publishedVersionId: dependencies.c008.current.semanticVersionId,
    publishedVersion: dependencies.c008.current.publishedSemanticVersion,
    t017Id: dependencies.c008.current.t017Id,
    resourceRefs: resources,
    publishedResourceRefs: semanticResources(dependencies.c008),
    linkPaths: query.links,
    evidenceTypes: ['E-Object', 'E-Metric', 'E-Rule', 'E-Link', 'E-Detail', 'E-Version', 'E-Quality']
  };
  const data = {
    dataVersion: dependencies.c008.current.dataVersion,
    t008: dependencies.c008.current.dataAsOf || dependencies.c017.t008,
    t008Evidence: dependencies.c017.t008Evidence || dependencies.c017.evidence || [],
    quality: dependencies.c017.quality,
    freshness: dependencies.c017.freshness,
    qualification: dependencies.c017.qualification,
    evidence: dependencies.c017.evidence
  };
  const fixed = {
    scenarioContext: context,
    configVersion: configuration.configVersion,
    promptVersion: configuration.promptVersion,
    skillSet: configuration.skillSet,
    toolAllowlist: configuration.toolAllowlist,
    toolAllowlistVersion: configuration.toolAllowlistVersion,
    resourceAllowlistVersion: configuration.resourceAllowlistVersion,
    publishedVersion: semantic.publishedVersion,
    publishedVersionId: semantic.publishedVersionId,
    dataVersion: data.dataVersion,
    t008: data.t008,
    query,
    semantic,
    data
  };
  const fingerprint = digest(fixed);
  return immutable({
    schemaVersion: SCHEMA_VERSIONS.QUERY_PLAN,
    planId: `QPLAN-${fingerprint.slice(0, 24)}`,
    planFingerprint: fingerprint,
    status: 'executable',
    scenarioContext: context,
    originalQuestion: query.originalQuestion,
    finalUnderstanding: query.finalUnderstanding,
    query,
    scope: query.scope,
    semantic,
    data,
    configuration: {
      configId: configuration.configId,
      configVersion: configuration.configVersion,
      promptVersion: configuration.promptVersion,
      skillSet: configuration.skillSet,
      toolAllowlist: configuration.toolAllowlist,
      toolAllowlistVersion: configuration.toolAllowlistVersion,
      resourceAllowlistVersion: configuration.resourceAllowlistVersion,
      publishedOntologyVersion: configuration.publishedOntologyVersion,
      platformDeterminismVersion: configuration.platformDeterminismVersion,
      resourceAllowlist: configuration.resourceAllowlist,
      capabilityProof: configuration.capabilityProof
    },
    gates: {
      c008: 'passed',
      c017: 'passed',
      permissions: 'passed',
      configuration: 'passed',
      resources: 'passed'
    },
    actionEligibility: {
      conditional: true,
      reason: 'Action qualification is evaluated only from a completed result and a single target; no action is created by the planner.'
    },
    createdAt: dependencies.createdAt
  });
}

function normalizeEvidenceRefs(value) {
  if (value === undefined || value === null) return [];
  const refs = Array.isArray(value) ? value : [value];
  return refs.map((item) => {
    if (text(item)) return { evidenceType: 'opaque', evidenceId: item.trim() };
    if (!isRecord(item)) fail(ERROR_CODES.RESULT_EVIDENCE_INCOMPLETE, 'evidence reference must be an object or stable id');
    const evidenceId = firstText(item, ['evidenceId', 'refId', 'id', 'key']);
    const evidenceType = firstText(item, ['evidenceType', 'refType', 'type', 'kind']) || 'opaque';
    if (!token(evidenceId)) fail(ERROR_CODES.RESULT_EVIDENCE_INCOMPLETE, 'evidence reference must identify an id');
    return clone({ ...item, evidenceType, evidenceId });
  }).sort((a, b) => `${a.evidenceType}:${a.evidenceId}`.localeCompare(`${b.evidenceType}:${b.evidenceId}`));
}

function compareValues(value, operator, expected) {
  switch (operator) {
    case 'gt': return value > expected;
    case 'gte': return value >= expected;
    case 'lt': return value < expected;
    case 'lte': return value <= expected;
    case 'eq': return value === expected;
    case 'neq': return value !== expected;
    case 'in': return Array.isArray(expected) && expected.includes(value);
    case 'notIn': return Array.isArray(expected) && !expected.includes(value);
    case 'between': return Array.isArray(expected) && expected.length === 2 && value >= expected[0] && value <= expected[1];
    case 'exists': return value !== undefined && value !== null;
    case 'missing': return value === undefined || value === null;
    default: return undefined;
  }
}

function metricValue(metrics, metricId) {
  if (isRecord(metrics) && hasOwn(metrics, metricId)) return metrics[metricId];
  if (Array.isArray(metrics)) {
    const found = metrics.find((item) => identityOf(item, ['metricId', 'id', 'resourceId']) === metricId);
    return found ? firstValue(found, ['value', 'exact', 'metricValue']) : undefined;
  }
  return undefined;
}

/**
 * Evaluate a parameterized Published Rule definition.  No threshold or
 * business policy is defined here; every operator/threshold comes from the
 * supplied definition and unresolved parameters remain `unknown`.
 */
function evaluateRule(definition, metrics, options = {}) {
  if (!isRecord(definition) || !token(definition.ruleId || definition.id)) fail(ERROR_CODES.RULE_INVALID, 'Rule definition requires a stable ruleId');
  const ruleId = definition.ruleId || definition.id;
  const branches = Array.isArray(definition.branches) ? definition.branches : (Array.isArray(definition.conditions) ? definition.conditions : []);
  if (!branches.length) {
    return immutable({ schemaVersion: SCHEMA_VERSIONS.RULE_RESULT, ruleId, status: 'unknown', reasonCode: 'RULE_DEFINITION_EMPTY', branches: [], evidenceRefs: normalizeEvidenceRefs(options.evidenceRefs || definition.evidenceRefs) });
  }
  const evaluated = branches.map((branch, index) => {
    if (!isRecord(branch)) return { branchId: `branch-${index + 1}`, status: 'unknown', reasonCode: 'BRANCH_INVALID', evidenceRefs: [] };
    const branchId = branch.branchId || branch.id || `branch-${index + 1}`;
    const metricId = branch.metricId || branch.metric || null;
    const value = metricId ? metricValue(metrics, metricId) : undefined;
    const operator = branch.operator || branch.comparator;
    const threshold = hasOwn(branch, 'threshold') ? branch.threshold : (hasOwn(branch, 'expected') ? branch.expected : undefined);
    const evidenceRefs = normalizeEvidenceRefs(branch.evidenceRefs || definition.evidenceRefs || options.evidenceRefs);
    if (!token(metricId) || !token(operator) || threshold === undefined && !['exists', 'missing'].includes(operator)) {
      return { branchId, metricId, value: value === undefined ? null : value, operator: operator || null, threshold: threshold === undefined ? null : threshold, status: 'unknown', reasonCode: 'PARAMETER_UNRESOLVED', evidenceRefs };
    }
    const verdict = compareValues(value, operator, threshold);
    if (verdict === undefined || (value === undefined && !['exists', 'missing'].includes(operator))) {
      return { branchId, metricId, value: value === undefined ? null : value, operator, threshold: threshold === undefined ? null : threshold, status: 'unknown', reasonCode: verdict === undefined ? 'OPERATOR_UNSUPPORTED' : 'METRIC_UNAVAILABLE', evidenceRefs };
    }
    return { branchId, metricId, value, operator, threshold: threshold === undefined ? null : clone(threshold), status: verdict ? 'hit' : 'not-hit', evidenceRefs };
  });
  const hit = evaluated.some((branch) => branch.status === 'hit');
  const unknown = evaluated.some((branch) => branch.status === 'unknown');
  const status = hit ? 'hit' : unknown ? 'unknown' : 'not-hit';
  const evidenceRefs = normalizeEvidenceRefs([
    ...evaluated.flatMap((branch) => branch.evidenceRefs || []),
    ...(definition.evidenceRefs || []),
    ...(options.evidenceRefs || [])
  ]);
  return immutable({
    schemaVersion: SCHEMA_VERSIONS.RULE_RESULT,
    ruleId,
    name: definition.name || null,
    publishedVersion: definition.publishedVersion || definition.version || null,
    status,
    branches: evaluated.sort((a, b) => String(a.branchId).localeCompare(String(b.branchId))),
    evidenceRefs,
    reasonCode: status === 'unknown' ? 'RULE_NOT_DETERMINABLE' : null
  });
}

function evaluateRules(definitions, metrics, options = {}) {
  if (!Array.isArray(definitions)) fail(ERROR_CODES.RULE_INVALID, 'Rule definitions must be an array');
  return definitions.map((definition) => evaluateRule(definition, metrics, options)).sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function normalizeRows(rows, options = {}) {
  if (rows === undefined || rows === null) return [];
  if (!Array.isArray(rows)) fail(ERROR_CODES.RESULT_INVALID, 'structured result rows must be an array');
  const normalized = rows.map((row, index) => {
    if (!isRecord(row)) fail(ERROR_CODES.RESULT_INVALID, `structured result row ${index} must be an object`);
    const id = identityOf(row, ['resultItemId', 'id', 'key']);
    if (!token(id)) fail(ERROR_CODES.RESULT_INVALID, `structured result row ${index} needs a stable resultItemId`);
    const status = row.status || 'available';
    return { ...clone(row), resultItemId: id, status, evidenceRefs: normalizeEvidenceRefs(row.evidenceRefs || row.evidence) };
  });
  const ids = new Set();
  normalized.forEach((row) => { if (ids.has(row.resultItemId)) fail(ERROR_CODES.RESULT_INVALID, `duplicate result item ${row.resultItemId}`); ids.add(row.resultItemId); });
  return options.preserveOrder ? normalized : normalized.sort((a, b) => a.resultItemId.localeCompare(b.resultItemId));
}

function normalizeMetricResults(metrics) {
  if (metrics === undefined || metrics === null) return [];
  const list = Array.isArray(metrics) ? metrics : Object.entries(metrics).map(([id, value]) => ({ metricId: id, value }));
  return list.map((metric, index) => {
    if (!isRecord(metric)) fail(ERROR_CODES.RESULT_INVALID, `metric result ${index} must be an object`);
    const metricId = identityOf(metric, ['metricId', 'id', 'resourceId']);
    if (!token(metricId)) fail(ERROR_CODES.RESULT_INVALID, `metric result ${index} needs a stable metricId`);
    return { ...clone(metric), metricId, evidenceRefs: normalizeEvidenceRefs(metric.evidenceRefs || metric.evidence) };
  }).sort((a, b) => a.metricId.localeCompare(b.metricId));
}

function normalizeRuleResults(rules) {
  if (rules === undefined || rules === null) return [];
  if (!Array.isArray(rules)) fail(ERROR_CODES.RESULT_INVALID, 'rule results must be an array');
  return rules.map((rule, index) => {
    if (!isRecord(rule)) fail(ERROR_CODES.RESULT_INVALID, `rule result ${index} must be an object`);
    const ruleId = identityOf(rule, ['ruleId', 'id', 'resourceId']);
    const rawStatus = String(rule.status || rule.outcome || '').toLowerCase();
    const status = rawStatus === 'hit'
      ? 'hit'
      : rawStatus === 'not_hit' || rawStatus === 'not-hit'
        ? 'not-hit'
        : rawStatus === 'unknown' ? 'unknown' : rawStatus;
    if (!token(ruleId) || !RULE_STATUSES.includes(status)) fail(ERROR_CODES.RESULT_INVALID, `rule result ${index} has invalid identity or status`);
    return { ...clone(rule), ruleId, status, evidenceRefs: normalizeEvidenceRefs(rule.evidenceRefs || rule.evidence) };
  }).sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function buildEvidenceMapping(rows, metrics, rules, supplied) {
  const mapping = Array.isArray(supplied) ? supplied.map((item) => clone(item)) : [];
  const byId = new Map(mapping.map((item) => [item.resultItemId || item.metricId || item.ruleId || item.id, item]));
  const required = [
    ...rows.map((item) => ({ id: item.resultItemId, refs: item.evidenceRefs })),
    ...metrics.map((item) => ({ id: item.metricId, refs: item.evidenceRefs })),
    ...rules.map((item) => ({ id: item.ruleId, refs: item.evidenceRefs }))
  ];
  required.forEach(({ id, refs }) => {
    const existing = byId.get(id);
    const evidenceRefs = normalizeEvidenceRefs(existing?.evidenceRefs || refs);
    if (!evidenceRefs.length) fail(ERROR_CODES.RESULT_EVIDENCE_INCOMPLETE, `result item ${id} has no evidence mapping`, { resultItemId: id });
    const normalized = { resultItemId: id, evidenceRefs };
    byId.set(id, normalized);
  });
  return [...byId.values()].sort((a, b) => String(a.resultItemId || '').localeCompare(String(b.resultItemId || '')));
}

function normalizeStructuredResult(raw, plan, input = {}) {
  const source = isRecord(raw) ? raw : { value: raw };
  ensureNoPhysicalResultKeys(source);
  const rows = normalizeRows(source.rows || source.items || source.resultItems, { preserveOrder: Array.isArray(plan.query?.orderBy) && plan.query.orderBy.length > 0 });
  const metrics = normalizeMetricResults(source.metrics || source.metricResults);
  const definitions = source.ruleDefinitions || input.ruleDefinitions || plan.query.ruleDefinitions || [];
  let rules = normalizeRuleResults(source.rules || source.ruleResults);
  if (!rules.length && Array.isArray(definitions) && definitions.length) rules = evaluateRules(definitions, source.metricValues || metrics, { evidenceRefs: source.evidenceRefs });
  const evidenceMapping = buildEvidenceMapping(rows, metrics, rules, source.evidenceMapping);
  if (rules.some((rule) => rule.status === 'unknown')) {
    fail(ERROR_CODES.UNKNOWN_STATE, 'one or more Rule results are unknown; the query is not answerable');
  }
  const topEvidence = normalizeEvidenceRefs(source.evidenceRefs);
  if (!rows.length && !metrics.length && !rules.length) {
    if (!topEvidence.length) fail(ERROR_CODES.RESULT_EVIDENCE_INCOMPLETE, 'an empty result requires a locatable evidence reference');
    evidenceMapping.push({ resultItemId: 'RESULT_SET', evidenceRefs: topEvidence });
  }
  const structured = {
    resultSetId: source.resultSetId || `RESULT-SET-${digest({ rows, metrics, rules }).slice(0, 24)}`,
    rows,
    metrics,
    rules,
    evidenceMapping,
    empty: rows.length === 0 && metrics.length === 0 && rules.length === 0,
    emptyReason: source.emptyReason || null,
    deterministic: true
  };
  return immutable(structured);
}

function qualityForResult(c017) {
  return clone(c017.quality);
}

function freshnessForResult(c017) {
  return clone(c017.freshness);
}

function createBlockedResult(input, context, configuration, error, generatedAt, c008 = null, c017 = null) {
  const reason = {
    code: error?.code || ERROR_CODES.UNKNOWN_STATE,
    message: error?.message || 'query cannot be answered',
    details: jsonSafe(error?.details || null),
    owner: error?.code?.startsWith('QUERY_C008') || error?.code?.startsWith('ERR_C008') ? 'M01' : error?.code?.startsWith('QUERY_C017') || error?.code?.startsWith('ERR_C017') ? 'M02' : 'M03',
    recoverable: true
  };
  const query = (() => {
    try { return normalizeQuery(input?.query || input || {}); } catch (_) { return { originalQuestion: firstText(input || {}, ['question', 'originalQuestion']) || null, finalUnderstanding: null, scope: { objects: [], duplicates: [] } }; }
  })();
  const fixed = {
    scenarioContext: context || null,
    query,
    configuration: configuration || null,
    publishedVersion: c008?.current?.publishedSemanticVersion || null,
    publishedVersionId: c008?.current?.semanticVersionId || null,
    dataVersion: c008?.current?.dataVersion || null,
    t008: c008?.current?.dataAsOf || null,
    reason
  };
  const resultId = `C010-${digest(fixed).slice(0, 24)}`;
  return immutable({
    schemaVersion: SCHEMA_VERSIONS.C010,
    contractCode: 'C010',
    resultId,
    runId: input?.runId || null,
    scenarioRunId: context?.scenarioRunId || null,
    scenarioContext: context || null,
    originalQuestion: query.originalQuestion,
    finalUnderstanding: query.finalUnderstanding,
    query,
    plan: null,
    configuration: configuration || null,
    publishedVersion: fixed.publishedVersion,
    publishedVersionId: fixed.publishedVersionId,
    dataVersion: fixed.dataVersion,
    t008: fixed.t008,
    structuredResult: null,
    evidenceMapping: [],
    quality: c017 ? qualityForResult(c017) : { status: 'unknown' },
    freshness: c017 ? freshnessForResult(c017) : { status: 'unknown' },
    notAnswerableReason: reason,
    status: 'not-answerable',
    answerable: false,
    generatedAt,
    sourceRunId: input?.sourceRunId || null,
    fingerprint: digest(fixed)
  });
}

function assertResultContext(result, plan) {
  if (!result || !isRecord(result)) fail(ERROR_CODES.RESULT_INVALID, 'executor must return a structured result object');
  if (result.scenarioContext && !sameRun(result.scenarioContext, plan.scenarioContext)) fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'executor attempted to change the C033 run context');
  const semanticVersion = result.publishedVersion || result.publishedVersionId || result.publishedOntologyVersion || result.semanticVersion;
  if (semanticVersion && semanticVersion !== plan.semantic.publishedVersion && semanticVersion !== plan.semantic.publishedVersionId) fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'executor result uses a different Published semantic version');
  if (result.dataVersion && result.dataVersion !== plan.data.dataVersion) fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'executor result uses a different data version');
  const t008 = isRecord(result.t008)
    ? (result.t008.value || result.t008.asOf || result.t008.dataAsOf || result.t008.id)
    : result.t008;
  if (t008 && String(t008) !== String(plan.data.t008)) fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'executor result uses a different T008');
}

function buildC010Result(run, raw, planner, input = {}) {
  assertResultContext(raw, run.plan);
  const structuredResult = normalizeStructuredResult(raw, run.plan, input);
  const generatedAt = nowIso(planner.clock, input.generatedAt);
  const evidenceMapping = structuredResult.evidenceMapping.slice();
  const contextEvidence = [
    { resultItemId: 'T008', refs: planner.c017?.t008Evidence || [] },
    { resultItemId: 'QUALITY', refs: planner.c017?.quality?.evidenceRefs || [] },
    { resultItemId: 'FRESHNESS', refs: planner.c017?.freshness?.evidenceRefs || [] },
    { resultItemId: 'C017', refs: planner.c017?.evidence || [] }
  ];
  const existingEvidenceIds = new Set(evidenceMapping.map((item) => item.resultItemId));
  contextEvidence.forEach((entry) => {
    const refs = normalizeEvidenceRefs(entry.refs);
    if (refs.length && !existingEvidenceIds.has(entry.resultItemId)) evidenceMapping.push({ resultItemId: entry.resultItemId, evidenceRefs: refs });
  });
  const body = {
    schemaVersion: SCHEMA_VERSIONS.C010,
    contractCode: 'C010',
    resultId: input.resultId || `C010-${digest({ runId: run.runId, structuredResult }).slice(0, 24)}`,
    runId: run.runId,
    scenarioRunId: run.scenarioContext.scenarioRunId,
    scenarioId: run.scenarioContext.scenarioId,
    scenarioVersion: run.scenarioContext.scenarioVersion,
    scenarioContext: run.scenarioContext,
    originalQuestion: run.plan.originalQuestion,
    finalUnderstanding: run.plan.finalUnderstanding,
    query: run.plan.query,
    plan: run.plan,
    configuration: run.plan.configuration,
    configVersion: run.plan.configuration.configVersion,
    promptVersion: run.plan.configuration.promptVersion,
    skillSet: clone(run.plan.configuration.skillSet),
    toolAllowlist: clone(run.plan.configuration.toolAllowlist),
    publishedVersion: run.plan.semantic.publishedVersion,
    publishedVersionId: run.plan.semantic.publishedVersionId,
    t019Id: run.plan.semantic.t019Id,
    t019Version: run.plan.semantic.t019Version,
    dataVersion: run.plan.data.dataVersion,
    t008: run.plan.data.t008,
    t008Evidence: clone(run.plan.data.t008Evidence || []),
    structuredResult,
    evidenceMapping,
    quality: qualityForResult(planner.c017),
    freshness: freshnessForResult(planner.c017),
    notAnswerableReason: null,
    status: 'completed',
    answerable: true,
    generatedAt,
    sourceRunId: input.sourceRunId || null,
    retryOf: run.retryOf || null
  };
  body.fingerprint = digest(body);
  return immutable(body);
}

function requestIdentity(input, plan) {
  return {
    operation: 'm03-query-run',
    scenarioContext: {
      scenarioId: plan.scenarioContext.scenarioId,
      scenarioVersion: plan.scenarioContext.scenarioVersion,
      scenarioRunId: plan.scenarioContext.scenarioRunId
    },
    planFingerprint: plan.planFingerprint,
    query: plan.query,
    configVersion: plan.configuration.configVersion,
    publishedVersionId: plan.semantic.publishedVersionId,
    dataVersion: plan.data.dataVersion,
    t008: plan.data.t008,
    retryOf: input.retryOf || null
  };
}

function makeId(prefix, value, idFactory) {
  if (typeof idFactory === 'function') {
    const id = idFactory(prefix, value);
    if (!token(id)) fail(ERROR_CODES.INVALID_ARGUMENT, 'idFactory must return a stable token');
    return id;
  }
  return `${prefix}-${digest(value).slice(0, 24)}`;
}

function candidateContext(candidate) {
  return candidate?.scenarioContext || {
    scenarioId: candidate?.scenarioId,
    scenarioVersion: candidate?.scenarioVersion,
    scenarioRunId: candidate?.scenarioRunId,
    formedAt: candidate?.formedAt,
    status: candidate?.status || 'active'
  };
}

function candidateValidity(candidate, now = new Date().toISOString()) {
  if (!candidate || !isRecord(candidate)) return { status: 'invalid', reasonCode: ERROR_CODES.CANDIDATE_INVALID };
  if (!['passed', 'submitted'].includes(candidate.status)) return { status: 'invalid', reasonCode: 'CANDIDATE_NOT_PASSED' };
  const expiresAt = candidate.expiresAt || candidate.validUntil || candidate.validTo || null;
  if (expiresAt && (!contracts.isDateTime(expiresAt) || Date.parse(now) >= Date.parse(expiresAt))) return { status: 'expired', reasonCode: ERROR_CODES.CANDIDATE_EXPIRED, expiresAt };
  if (!expiresAt) return { status: 'conditional', reasonCode: 'CANDIDATE_EXPIRY_UNSPECIFIED' };
  return { status: 'valid', reasonCode: null, expiresAt };
}

function validateCandidate(candidate, expected = {}) {
  if (!isRecord(candidate)) fail(ERROR_CODES.CANDIDATE_INVALID, 'candidate validation record must be an object');
  const context = assertContext(candidate.scenarioContext || candidateContext(candidate));
  if (expected.scenarioContext) requireSameRun(expected.scenarioContext, context, ERROR_CODES.CANDIDATE_DRIFT);
  const semanticVersion = candidate.semanticVersionId || candidate.publishedVersionId || candidate.publishedVersion;
  const dataVersion = candidate.dataVersion || candidate.t007Id;
  if (expected.publishedVersionId && semanticVersion !== expected.publishedVersionId) fail(ERROR_CODES.CANDIDATE_DRIFT, 'candidate Published version differs from current C008', { expected: expected.publishedVersionId, actual: semanticVersion });
  if (expected.dataVersion && dataVersion !== expected.dataVersion) fail(ERROR_CODES.CANDIDATE_DRIFT, 'candidate data version differs from current C008/C017', { expected: expected.dataVersion, actual: dataVersion });
    const validity = candidateValidity(candidate, expected.now || new Date().toISOString());
    if (validity.status === 'expired') fail(ERROR_CODES.CANDIDATE_EXPIRED, 'candidate validity window has expired', validity);
    if (validity.status === 'invalid') fail(ERROR_CODES.CANDIDATE_INVALID, 'candidate is not in a passed state', validity);
    if (!candidate.evidenceRefs?.length) fail(ERROR_CODES.CANDIDATE_INVALID, 'candidate submission requires validation evidence references');
  return immutable({ ...clone(candidate), scenarioContext: context, validity });
}

class CandidateRegistry {
  constructor(options = {}) {
    this.clock = options.clock;
    this.idFactory = options.idFactory;
    this.records = options.records instanceof Map ? new Map(options.records) : new Map();
    this.submissions = new Map();
  }

  create(input = {}) {
    const context = assertContext(input.scenarioContext);
    const semanticVersionId = firstText(input, ['semanticVersionId', 'publishedVersionId', 'publishedVersion']);
    const dataVersion = firstText(input, ['dataVersion', 't007Id']);
    const questionSetVersion = firstText(input, ['questionSetVersion', 'suiteVersion']);
    if (!token(semanticVersionId) || !token(dataVersion) || !token(questionSetVersion)) fail(ERROR_CODES.CANDIDATE_INVALID, 'candidate must pin semantic, data and question-set versions');
    const now = nowIso(this.clock, input.createdAt);
    const identityBody = { scenarioContext: context, semanticVersionId, dataVersion, questionSetVersion, questions: input.questions || [] };
    const candidateId = input.candidateId || makeId('CANDIDATE', identityBody, this.idFactory);
    const existing = this.records.get(candidateId);
    if (existing) {
      if (digest(existing.identity) !== digest(identityBody)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'candidateId identifies a different candidate');
      return existing.record;
    }
    const status = input.status || 'draft';
    if (!CANDIDATE_STATUSES.includes(status)) fail(ERROR_CODES.CANDIDATE_INVALID, `unknown candidate status ${status}`);
    const record = immutable({
      schemaVersion: SCHEMA_VERSIONS.CANDIDATE,
      candidateId,
      identity: identityBody,
      scenarioContext: context,
      semanticVersionId,
      dataVersion,
      questionSetVersion,
      questions: clone(input.questions || []),
      status,
      expiresAt: input.expiresAt || input.validUntil || null,
      createdAt: now,
      updatedAt: now,
      retryOf: input.retryOf || null,
      validationRunId: input.validationRunId || null,
      evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs),
      submission: null
    });
    this.records.set(candidateId, { identity: identityBody, record });
    return record;
  }

  get(candidateId) {
    const entry = this.records.get(candidateId);
    if (!entry) fail(ERROR_CODES.CANDIDATE_INVALID, `candidate ${candidateId} was not found`);
    return entry.record;
  }

  list() { return [...this.records.values()].map((entry) => entry.record); }

  snapshot() { return new Map([...this.records.entries()].map(([key, entry]) => [key, entry.record])); }

  submit(candidateId, input = {}) {
    const candidate = this.get(candidateId);
    const now = nowIso(this.clock, input.submittedAt);
    const expected = { ...input, now, scenarioContext: input.scenarioContext || candidate.scenarioContext };
    const validated = validateCandidate(candidate, expected);
    const validity = validated.validity;
    if (validity.status === 'conditional') {
      // QA-X-010 has not fixed an expiry policy. Keep the handoff explicitly
      // conditional rather than inventing a default TTL.
    }
    const submissionKey = input.idempotencyKey || identity.generateIdempotencyKey({ operation: 'candidate-submit', candidateId, scenarioContext: candidate.scenarioContext, semanticVersionId: candidate.semanticVersionId, dataVersion: candidate.dataVersion }, { fields: ['operation', 'candidateId', 'scenarioContext', 'semanticVersionId', 'dataVersion'] });
    const requestFingerprint = digest({ candidateId, scenarioContext: candidate.scenarioContext, semanticVersionId: candidate.semanticVersionId, dataVersion: candidate.dataVersion, questionSetVersion: candidate.questionSetVersion });
    const prior = this.submissions.get(submissionKey);
    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'candidate submission idempotency key conflicts with another candidate');
      return prior.receipt;
    }
    if (candidate.status === 'submitted' && candidate.submission) return candidate.submission;
    const receipt = immutable({
      schemaVersion: SCHEMA_VERSIONS.CANDIDATE,
      contractCode: 'CANDIDATE_VALIDATION_HANDOFF',
      candidateId,
      status: 'submitted',
      outcome: 'conditional',
      validity,
      scenarioContext: candidate.scenarioContext,
      semanticVersionId: candidate.semanticVersionId,
      dataVersion: candidate.dataVersion,
      questionSetVersion: candidate.questionSetVersion,
      submittedAt: now,
      idempotencyKey: submissionKey,
      requestFingerprint,
      targetModule: 'M01',
      t019WriteAllowed: false,
      evidenceRefs: candidate.evidenceRefs
    });
    const next = immutable({ ...candidate, status: 'submitted', updatedAt: now, submission: receipt });
    this.records.set(candidateId, { identity: this.records.get(candidateId).identity, record: next });
    this.submissions.set(submissionKey, { requestFingerprint, receipt });
    return receipt;
  }

  retry(candidateId, input = {}) {
    const prior = this.get(candidateId);
    if (!['failed', 'unknown', 'expired', 'superseded'].includes(prior.status)) fail(ERROR_CODES.RUN_NOT_RETRYABLE, 'candidate is not in a retryable state');
    const context = assertContext(input.scenarioContext || prior.scenarioContext);
    requireSameRun(prior.scenarioContext, context, ERROR_CODES.CANDIDATE_DRIFT);
    if (input.semanticVersionId && input.semanticVersionId !== prior.semanticVersionId) fail(ERROR_CODES.CANDIDATE_DRIFT, 'candidate retry cannot change semantic version');
    if (input.dataVersion && input.dataVersion !== prior.dataVersion) fail(ERROR_CODES.CANDIDATE_DRIFT, 'candidate retry cannot change data version');
    const retryAt = nowIso(this.clock, input.createdAt);
    const candidateIdForRetry = input.candidateId || makeId('CANDIDATE', {
      identity: prior.identity,
      retryOf: prior.candidateId,
      retryAt
    }, this.idFactory);
    return this.create({ ...clone(prior), candidateId: candidateIdForRetry, status: 'draft', retryOf: prior.candidateId, scenarioContext: context, createdAt: retryAt, updatedAt: undefined, submission: null });
  }
}

class QueryPlanner {
  constructor(options = {}) {
    this.context = assertQueryContext(options.scenarioContext);
    this.clock = options.clock;
    this.idFactory = options.idFactory;
    this.permissions = options.permissions || options.authorization;
    this.c008Reader = options.c008Reader || options.c008 || options.readC008;
    this.c017Reader = options.c017Reader || options.c017 || options.readC017;
    this.config = options.config || options.agentConfig;
    this.runs = options.runs instanceof Map ? new Map(options.runs) : new Map();
    this.idempotency = options.idempotency instanceof Map ? new Map(options.idempotency) : new Map();
    this.plans = new Map();
    this.c008 = null;
    this.c017 = null;
    this.configuration = null;
    this.candidateRegistry = options.candidateRegistry || new CandidateRegistry({ clock: this.clock });
  }

  _readContext(input = {}) {
    assertPermissions(this.permissions, input);
    const context = assertQueryContext(input.scenarioContext || this.context);
    requireSameRun(this.context, context);
    const c008Value = input.c008 || invokeReader(this.c008Reader, ['readC008', 'read', 'get'], { scenarioContext: context, consumer: 'intelligent-query', purpose: 'query-plan' }, ERROR_CODES.C008_MISSING);
    const c008 = normalizeC008(c008Value, context);
    const c017Value = input.c017 || invokeReader(this.c017Reader, ['readC017', 'readC017Projection', 'read', 'get'], { scenarioContext: context, assetVersionId: c008.current.dataVersion, consumer: 'intelligent-query', purpose: 'query-plan' }, ERROR_CODES.C017_MISSING);
    const c017 = normalizeC017(c017Value, context, c008);
    const configuration = normalizeConfig(input.config || this.config, context, c008, this.clock);
    this.c008 = c008;
    this.c017 = c017;
    this.configuration = configuration;
    return { context, c008, c017, configuration };
  }

  plan(input = {}) {
    const dependencies = this._readContext(input);
    const createdAt = nowIso(this.clock, input.plannedAt);
    const plan = createPlanSnapshot(input, { ...dependencies, createdAt });
    this.plans.set(plan.planId, plan);
    return plan;
  }

  planAsync(input = {}) {
    return Promise.resolve().then(async () => {
      const context = assertQueryContext(input.scenarioContext || this.context);
      requireSameRun(this.context, context);
      assertPermissions(this.permissions, input);
      const c008Value = input.c008 || await (typeof this.c008Reader === 'function' ? this.c008Reader({ scenarioContext: context, consumer: 'intelligent-query', purpose: 'query-plan' }) : invokeReader(this.c008Reader, ['readAsync', 'readC008', 'read', 'get'], { scenarioContext: context, consumer: 'intelligent-query', purpose: 'query-plan' }, ERROR_CODES.C008_MISSING));
      const c008 = normalizeC008(c008Value, context);
      const c017Value = input.c017 || await (typeof this.c017Reader === 'function' ? this.c017Reader({ scenarioContext: context, assetVersionId: c008.current.dataVersion, consumer: 'intelligent-query', purpose: 'query-plan' }) : invokeReader(this.c017Reader, ['readAsync', 'readC017', 'readC017Projection', 'read', 'get'], { scenarioContext: context, assetVersionId: c008.current.dataVersion, consumer: 'intelligent-query', purpose: 'query-plan' }, ERROR_CODES.C017_MISSING));
      const c017 = normalizeC017(c017Value, context, c008);
      const configuration = normalizeConfig(input.config || this.config, context, c008, this.clock);
      this.c008 = c008; this.c017 = c017; this.configuration = configuration;
      const plan = createPlanSnapshot(input, { context, c008, c017, configuration, createdAt: nowIso(this.clock, input.plannedAt) });
      this.plans.set(plan.planId, plan);
      return plan;
    });
  }

  _getPlan(value, input = {}) {
    const plan = typeof value === 'string' ? this.plans.get(value) : value;
    if (!plan || !isRecord(plan)) fail(ERROR_CODES.PLAN_NOT_EXECUTABLE, 'query plan was not found');
    if (plan.status !== 'executable') fail(ERROR_CODES.PLAN_NOT_EXECUTABLE, `query plan is ${plan.status}`);
    requireSameRun(this.context, plan.scenarioContext);
    if (input.scenarioContext) requireSameRun(plan.scenarioContext, assertContext(input.scenarioContext));
    return plan;
  }

  _beginRun(plan, input = {}) {
    const request = requestIdentity(input, plan);
    const fingerprint = digest(request);
    const key = input.idempotencyKey || identity.generateIdempotencyKey(request, { fields: Object.keys(request) });
    const prior = this.idempotency.get(key);
    if (prior) {
      if (prior.requestFingerprint !== fingerprint) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'query idempotency key conflicts with another request', { key });
      const existing = this.runs.get(prior.runId);
      if (existing) return { run: existing, duplicate: true, key, fingerprint };
    }
    if (input.retryOf) {
      const original = this.runs.get(input.retryOf);
      if (!original) fail(ERROR_CODES.RUN_NOT_FOUND, 'retry source run was not found');
      if (!['failed', 'blocked'].includes(original.status)) fail(ERROR_CODES.RUN_NOT_RETRYABLE, 'only failed or blocked runs may be retried');
      requireSameRun(original.scenarioContext, plan.scenarioContext, ERROR_CODES.RETRY_DRIFT);
      if (original.plan.planFingerprint !== plan.planFingerprint) fail(ERROR_CODES.RETRY_DRIFT, 'retry cannot change the fixed query plan');
    }
    const startedAt = nowIso(this.clock, input.startedAt);
    const runId = input.runId || makeId('QRUN', { request, fingerprint }, this.idFactory);
    const run = immutable({
      schemaVersion: SCHEMA_VERSIONS.QUERY_RUN,
      runId,
      scenarioRunId: plan.scenarioContext.scenarioRunId,
      scenarioContext: plan.scenarioContext,
      planId: plan.planId,
      planFingerprint: plan.planFingerprint,
      plan,
      c008Snapshot: this.c008,
      c017Snapshot: this.c017,
      status: 'running',
      startedAt,
      completedAt: null,
      retryOf: input.retryOf || null,
      attempt: input.retryOf ? (this.runs.get(input.retryOf)?.attempt || 1) + 1 : 1,
      idempotencyKey: key,
      requestFingerprint: fingerprint,
      resultId: null,
      result: null,
      failure: null
    });
    this.runs.set(runId, run);
    this.idempotency.set(key, { requestFingerprint: fingerprint, runId });
    return { run, duplicate: false, key, fingerprint };
  }

  _verifyFixedContext(plan, input = {}) {
    if (input.verifyContextOnComplete === false) return;
    const current = this._readContext({ scenarioContext: plan.scenarioContext });
    this._assertSameFixedValues(plan, current.c008, current.c017);
  }

  async _verifyFixedContextAsync(plan, input = {}) {
    if (input.verifyContextOnComplete === false) return;
    assertPermissions(this.permissions, input);
    const context = assertQueryContext(plan.scenarioContext);
    const c008Value = input.c008 || (typeof this.c008Reader === 'function'
      ? await this.c008Reader({ scenarioContext: context, consumer: 'intelligent-query', purpose: 'query-result-verify' })
      : await invokeReader(this.c008Reader, ['readAsync', 'readC008', 'read', 'get'], { scenarioContext: context, consumer: 'intelligent-query', purpose: 'query-result-verify' }, ERROR_CODES.C008_MISSING));
    const c008 = normalizeC008(c008Value, context);
    const c017Value = input.c017 || (typeof this.c017Reader === 'function'
      ? await this.c017Reader({ scenarioContext: context, assetVersionId: c008.current.dataVersion, consumer: 'intelligent-query', purpose: 'query-result-verify' })
      : await invokeReader(this.c017Reader, ['readAsync', 'readC017', 'readC017Projection', 'read', 'get'], { scenarioContext: context, assetVersionId: c008.current.dataVersion, consumer: 'intelligent-query', purpose: 'query-result-verify' }, ERROR_CODES.C017_MISSING));
    const c017 = normalizeC017(c017Value, context, c008);
    this.c008 = c008;
    this.c017 = c017;
    this._assertSameFixedValues(plan, c008, c017);
  }

  _assertSameFixedValues(plan, c008, c017) {
    const expectedSemantic = plan.semantic.publishedVersionId;
    const expectedData = plan.data.dataVersion;
    const expectedT008 = String(plan.data.t008);
    if (c008.current.semanticVersionId !== expectedSemantic
      || c008.current.dataVersion !== expectedData
      || c008.current.t019Id !== plan.semantic.t019Id
      || (plan.semantic.t019Version && c008.current.bindingVersion !== plan.semantic.t019Version)
      || (c008.current.dataAsOf && String(c008.current.dataAsOf) !== expectedT008)) {
      fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'C008/T019 changed while the query was executing', {
        expected: { semanticVersionId: expectedSemantic, dataVersion: expectedData, t019Id: plan.semantic.t019Id, t019Version: plan.semantic.t019Version || null, t008: expectedT008 },
        actual: { semanticVersionId: c008.current.semanticVersionId, dataVersion: c008.current.dataVersion, t019Id: c008.current.t019Id, t019Version: c008.current.bindingVersion || null, t008: c008.current.dataAsOf }
      });
    }
    if (digest(c008.current.resources || []) !== digest(plan.semantic.publishedResourceRefs || [])) {
      fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'Published resource package changed while the query was executing');
    }
    if (c017.dataVersion !== expectedData || String(c017.t008) !== expectedT008) {
      fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'C017 T007/T008 changed while the query was executing', { expected: { dataVersion: expectedData, t008: expectedT008 }, actual: { dataVersion: c017.dataVersion, t008: c017.t008 } });
    }
    if (digest(c017.quality || {}) !== digest(plan.data.quality || {}) || digest(c017.freshness || {}) !== digest(plan.data.freshness || {})) {
      fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'C017 quality/freshness evidence changed while the query was executing');
    }
    if (c017.qualification && !['allowed', 'allowed-with-warning'].includes(String(c017.qualification).toLowerCase())) {
      fail(ERROR_CODES.UNKNOWN_STATE, 'C017 consumption qualification changed while the query was executing', { qualification: c017.qualification });
    }
  }

  execute(input = {}, executor) {
    const plan = this._getPlan(input.plan || input.planId, input);
    const begun = this._beginRun(plan, input);
    if (begun.duplicate) return begun.run;
    const run = begun.run;
    const fn = executor || input.executor;
    try {
      if (input.structuredResult === undefined && typeof fn !== 'function') fail(ERROR_CODES.RESULT_INVALID, 'a deterministic semantic executor or structured result is required');
      const raw = input.structuredResult !== undefined ? input.structuredResult : fn(plan, { scenarioContext: plan.scenarioContext, c008: publicProjection(this.c008), c017: publicProjection(this.c017) });
      rejectPromise(raw);
      this._verifyFixedContext(plan, input);
      const result = buildC010Result(run, raw || {}, this, input);
      const completed = immutable({ ...run, status: 'completed', completedAt: result.generatedAt, resultId: result.resultId, result, failure: null });
      this.runs.set(run.runId, completed);
      return completed;
    } catch (error) {
      const failedAt = nowIso(this.clock, input.completedAt);
      const failure = { code: error.code || ERROR_CODES.RESULT_INVALID, message: error.message, details: error.details || null };
      const failedResult = createBlockedResult({ ...input, runId: run.runId }, run.scenarioContext, plan.configuration, error, failedAt, run.c008Snapshot, run.c017Snapshot);
      const failed = immutable({ ...run, status: 'failed', completedAt: failedAt, resultId: failedResult.resultId, result: failedResult, failure });
      this.runs.set(run.runId, failed);
      if (input.throwOnFailure === true) throw error;
      return failed;
    }
  }

  executeAsync(input = {}, executor) {
    return Promise.resolve().then(async () => {
      const plan = this._getPlan(input.plan || input.planId, input);
      const begun = this._beginRun(plan, input);
      if (begun.duplicate) return begun.run;
      const run = begun.run;
      try {
        const fn = executor || input.executor;
        if (input.structuredResult === undefined && typeof fn !== 'function') fail(ERROR_CODES.RESULT_INVALID, 'a deterministic semantic executor or structured result is required');
        const raw = input.structuredResult !== undefined ? input.structuredResult : await fn(plan, { scenarioContext: plan.scenarioContext, c008: publicProjection(this.c008), c017: publicProjection(this.c017) });
        await this._verifyFixedContextAsync(plan, input);
        const result = buildC010Result(run, raw || {}, this, input);
        const completed = immutable({ ...run, status: 'completed', completedAt: result.generatedAt, resultId: result.resultId, result, failure: null });
        this.runs.set(run.runId, completed);
        return completed;
      } catch (error) {
        const failedAt = nowIso(this.clock, input.completedAt);
        const failure = { code: error.code || ERROR_CODES.RESULT_INVALID, message: error.message, details: error.details || null };
        const failedResult = createBlockedResult({ ...input, runId: run.runId }, run.scenarioContext, plan.configuration, error, failedAt, run.c008Snapshot, run.c017Snapshot);
        const failed = immutable({ ...run, status: 'failed', completedAt: failedAt, resultId: failedResult.resultId, result: failedResult, failure });
        this.runs.set(run.runId, failed);
        if (input.throwOnFailure === true) throw error;
        return failed;
      }
    });
  }

  run(input = {}, executor) {
    if (input.idempotencyKey) {
      const prior = this.idempotency.get(input.idempotencyKey);
      if (prior?.runId && this.runs.has(prior.runId)) return this.runs.get(prior.runId);
    }
    try {
      const plan = input.plan || this.plan(input);
      return this.execute({ ...input, plan }, executor);
    } catch (error) {
      const generatedAt = nowIso(this.clock, input.generatedAt);
      // A failed context read must never borrow the previous run's C008/C017
      // or configuration snapshot.  Preserve only caller-provided diagnostics
      // and leave unavailable fixed fields null.
      const attemptedConfiguration = input.config || input.agentConfig || input.plan?.configuration || null;
      const attemptedC008 = input.c008 || null;
      const attemptedC017 = input.c017 || null;
      const result = createBlockedResult(input, this.context, attemptedConfiguration, error, generatedAt, attemptedC008, attemptedC017);
      const runId = input.runId || makeId('QRUN', { scenarioContext: this.context, resultId: result.resultId }, this.idFactory);
      const blocked = immutable({
        schemaVersion: SCHEMA_VERSIONS.QUERY_RUN,
        runId,
        scenarioRunId: this.context.scenarioRunId,
        scenarioContext: this.context,
        planId: null,
        planFingerprint: null,
        plan: null,
        status: 'blocked',
        startedAt: generatedAt,
        completedAt: generatedAt,
        retryOf: input.retryOf || null,
        attempt: 1,
        idempotencyKey: input.idempotencyKey || null,
        requestFingerprint: null,
        resultId: result.resultId,
        result,
        failure: { code: error.code || ERROR_CODES.UNKNOWN_STATE, message: error.message, details: jsonSafe(error.details || null) }
      });
      this.runs.set(runId, blocked);
      if (input.idempotencyKey) this.idempotency.set(input.idempotencyKey, {
        requestFingerprint: digest({ operation: 'm03-blocked-run', input: jsonSafe(input), reason: blocked.failure.code }),
        runId
      });
      return blocked;
    }
  }

  retry(runId, input = {}, executor) {
    const original = this.runs.get(runId);
    if (!original) fail(ERROR_CODES.RUN_NOT_FOUND, `run ${runId} was not found`);
    if (!['failed', 'blocked'].includes(original.status)) fail(ERROR_CODES.RUN_NOT_RETRYABLE, 'only failed or blocked runs may be retried');
    const plan = this._getPlan(original.plan, { scenarioContext: input.scenarioContext || original.scenarioContext });
    if (input.plan && digest(input.plan) !== digest(original.plan)) fail(ERROR_CODES.RETRY_DRIFT, 'retry plan differs from original fixed plan');
    return this.execute({ ...input, plan, retryOf: runId }, executor);
  }

  getRun(runId) {
    const run = this.runs.get(runId);
    if (!run) fail(ERROR_CODES.RUN_NOT_FOUND, `run ${runId} was not found`);
    return run;
  }

  listRuns() { return [...this.runs.values()]; }

  buildC011(runOrId, input = {}) {
    const run = typeof runOrId === 'string' ? this.getRun(runOrId) : runOrId;
    if (!run || run.status !== 'completed' || !run.result?.answerable) fail(ERROR_CODES.C011_NOT_ELIGIBLE, 'only a completed answerable run may produce C011');
    const target = input.target || input.subject;
    const targetId = identityOf(target, ['stableId', 'objectId', 'subjectId', 'id']);
    if (!token(targetId)) fail(ERROR_CODES.C011_INVALID, 'C011 requires one stable business subject');
    ensureNoPhysicalResultKeys(target, 'C011.target');
    const actionTypeId = identityOf(input.actionType, ['actionTypeId', 'id', 'resourceId']);
    if (!token(actionTypeId)) fail(ERROR_CODES.C011_INVALID, 'C011 requires an Action Type stable identity');
    const allowedResources = new Set(listIds(run.plan.configuration.resourceAllowlist));
    if (!allowedResources.size || !allowedResources.has(actionTypeId)) {
      fail(ERROR_CODES.RESOURCE_NOT_ALLOWED, `Action Type ${actionTypeId} is outside the C009 resource allowlist`);
    }
    const actionVersion = isRecord(input.actionType)
      ? firstText(input.actionType, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion'])
      : null;
    if (isRecord(input.actionType)) {
      ensureNoPhysicalResultKeys(input.actionType, 'C011.actionType');
      const actionStatus = String(input.actionType.status || input.actionType.lifecycleStatus || input.actionType.publicationStatus || 'PUBLISHED').toUpperCase();
      if (actionStatus !== 'PUBLISHED') fail(ERROR_CODES.C011_INVALID, 'Action Type is not Published', { status: actionStatus });
    }
    if (actionVersion && actionVersion !== run.result.publishedVersionId && actionVersion !== run.result.publishedVersion) {
      fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'Action Type is not from the fixed Published ontology version');
    }
    const configuredAction = (run.plan.configuration.resourceAllowlist || []).find((item) => identityOf(item) === actionTypeId);
    const configuredActionVersion = isRecord(configuredAction) ? firstText(configuredAction, ['version', 'resourceVersion', 'publishedVersion']) : null;
    const actionResourceVersion = isRecord(input.actionType) ? firstText(input.actionType, ['version', 'resourceVersion', 'publishedVersionId']) : null;
    if (configuredActionVersion && actionResourceVersion !== configuredActionVersion) {
      fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'Action Type must pin the exact Published resource version', { expected: configuredActionVersion, actual: actionResourceVersion || null });
    }
    const rule = input.rule || run.result.structuredResult.rules.find((item) => item.status === 'hit');
    if (!rule || !token(rule.ruleId) || !token(rule.ruleVersion || rule.version) || rule.status !== 'hit' || !rule.evidenceRefs?.length) fail(ERROR_CODES.C011_NOT_ELIGIBLE, 'C011 requires a versioned hit Rule with evidence');
    ensureNoPhysicalResultKeys(rule, 'C011.rule');
    const ruleVersion = firstText(rule, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion']);
    if (ruleVersion && ruleVersion !== run.result.publishedVersionId && ruleVersion !== run.result.publishedVersion) fail(ERROR_CODES.RESULT_VERSION_MISMATCH, 'Rule result is not from the fixed Published ontology version');
    const evidenceRefs = normalizeEvidenceRefs([...(run.result.evidenceMapping || []).flatMap((item) => item.evidenceRefs || []), ...(input.evidenceRefs || []), ...(rule.evidenceRefs || [])]);
    if (!evidenceRefs.length) fail(ERROR_CODES.C011_NOT_ELIGIBLE, 'C011 requires fixed evidence references');
    const request = {
      contractCode: 'C011',
      schemaVersion: SCHEMA_VERSIONS.C011,
      requestId: input.requestId || makeId('ACTION', { runId: run.runId, targetId, actionTypeId, ruleId: rule.ruleId }, this.idFactory),
      idempotencyKey: input.idempotencyKey || identity.generateIdempotencyKey({
        scenarioContext: run.scenarioContext,
        requestId: input.requestId || null,
        runId: run.runId,
        targetId,
        actionTypeId,
        ruleId: rule.ruleId,
        publishedVersionId: run.result.publishedVersionId,
        dataVersion: run.result.dataVersion,
        t019Version: run.result.t019Version || null
      }, { fields: ['scenarioContext', 'requestId', 'runId', 'targetId', 'actionTypeId', 'ruleId', 'publishedVersionId', 'dataVersion', 't019Version'] }),
      scenarioContext: run.scenarioContext,
      scenarioId: run.scenarioContext.scenarioId,
      scenarioVersion: run.scenarioContext.scenarioVersion,
      scenarioRunId: run.scenarioContext.scenarioRunId,
      sourceModule: 'M03',
      sourceRunId: run.runId,
      sourceResultId: run.result.resultId,
      target: clone(target),
      targetStableId: targetId,
      actionType: clone(input.actionType),
      actionTypeId,
      rule: clone(rule),
      metricSnapshot: clone(input.metricSnapshot || run.result.structuredResult.metrics),
      publishedVersionId: run.result.publishedVersionId,
      publishedVersion: run.result.publishedVersion,
      dataVersion: run.result.dataVersion,
      t008: run.result.t008,
      t008Evidence: clone(run.result.t008Evidence || []),
      configVersion: run.result.configuration.configVersion,
      promptVersion: run.result.configuration.promptVersion,
      skillSet: run.result.configuration.skillSet,
      toolAllowlist: run.result.configuration.toolAllowlist,
      toolAllowlistVersion: run.result.configuration.toolAllowlistVersion || null,
      quality: clone(run.result.quality),
      freshness: clone(run.result.freshness),
      evidenceRefs,
      requestedAt: nowIso(this.clock, input.requestedAt),
      status: 'pending',
      m03CreatesDecision: false,
      m03CreatesTodo: false,
      m03SendsNotification: false
    };
    if (!identity.validateIdempotencyKey(request.idempotencyKey).valid) fail(ERROR_CODES.C011_INVALID, 'C011 idempotency key is invalid');
    try {
      return c011.buildC011Request({
        ...request,
        generatedAt: run.result.generatedAt || run.completedAt || request.requestedAt,
        sourceResultFingerprint: run.result.fingerprint,
        resultId: run.result.resultId,
        resultVersion: run.result.resultVersion,
        semanticVersion: run.result.publishedVersionId || run.result.publishedVersion,
        publishedOntologyVersion: run.result.publishedVersionId || run.result.publishedVersion,
        t007: run.result.t007 || run.result.t007Version || run.result.dataVersion,
        structuredMetrics: run.result.structuredResult.metrics || run.result.structuredResult.metricResults || [],
        metricEvidenceRefs: (run.result.structuredResult.metrics || []).flatMap((metric) => metric.evidenceRefs || []),
        ruleEvidenceRefs: rule.evidenceRefs || [],
        evidenceSnapshotId: run.result.resultId,
        dataCutoff: isRecord(run.result.t008) ? (run.result.t008.value || run.result.t008.asOf || run.result.t008.dataAsOf) : run.result.t008,
        resourceWhitelist: run.plan.configuration.resourceAllowlist,
        configuration: run.plan.configuration,
        sourceType: 'rule',
        sourceRef: rule.ruleId
      });
    } catch (error) {
      if (error.code && String(error.code).startsWith('ERR_C011_')) fail(ERROR_CODES.C011_INVALID, error.message, error.details);
      throw error;
    }
  }

  createCandidate(input) { return this.candidateRegistry.create(input); }
  listCandidates() { return this.candidateRegistry.list(); }
  validateCandidate(candidate, expected) { return validateCandidate(candidate, expected); }
  submitCandidate(candidateId, input) { return this.candidateRegistry.submit(candidateId, input); }
  retryCandidate(candidateId, input) { return this.candidateRegistry.retry(candidateId, input); }
}

function createQueryPlanner(options) {
  return new QueryPlanner(options);
}

module.exports = Object.freeze({
  IMPLEMENTATION_VERSION,
  BASELINE_SNAPSHOT_ID,
  SOURCE_TAG,
  SCHEMA_VERSIONS,
  PLAN_STATUSES,
  RUN_STATUSES,
  RESULT_STATUSES,
  RULE_STATUSES,
  CANDIDATE_STATUSES,
  CONDITIONAL_CAPABILITIES,
  ERROR_CODES,
  QueryPlannerError,
  QueryPlanner,
  CandidateRegistry,
  createQueryPlanner,
  normalizeC008,
  normalizeC017,
  publicProjection,
  normalizeConfig,
  normalizeQuery,
  createPlanSnapshot,
  evaluateRule,
  evaluateRules,
  candidateValidity,
  validateCandidate,
  createBlockedResult,
  normalizeStructuredResult,
  buildC010Result,
  buildC011: (planner, run, input) => planner.buildC011(run, input),
  stableSerialize,
  digest,
  immutable
});
