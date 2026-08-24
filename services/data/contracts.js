'use strict';

/*
 * M02 data spine contracts.
 *
 * This module is deliberately storage agnostic.  It owns the shape and
 * invariants of data-engineering records; runtime.js supplies the in-memory
 * orchestration used by the implementation tests and by small adapters.
 */

const crypto = require('node:crypto');
const contracts = require('../../packages/contracts');
const identity = require('../../packages/identity');

const DATA_CONTRACT_VERSION = 'm02-data.draft.v1';
const DATA_SCHEMA_VERSION = contracts.SCHEMA_VERSION;
const DATA_SPINE_CONTRACT_ID = 'ofw.m02.data-spine.v1';
const EVENT_SCHEMA_VERSION = contracts.SCHEMA_VERSION;
const EVENT_CONTRACT_ID = 'ofw.m02.data-event.v1';
const T007_S003_COMPATIBILITY_STATUS = 'compatibility-only-non-consumable';
const CONTRACT_CODES = Object.freeze(['C001', 'C002', 'C003', 'C017', 'C032', 'C028', 'C029']);

const EXECUTION_STATES = Object.freeze([
  'queued', 'running', 'waiting-confirmation', 'completed', 'failed'
]);
const QUALITY_STATES = Object.freeze([
  'not-run', 'running', 'passed', 'warning', 'failed', 'unknown'
]);
const DELIVERY_STATES = Object.freeze([
  'pending', 'sending', 'awaiting-receipt', 'accepted', 'rejected', 'unknown'
]);
const C032_STATES = Object.freeze([
  'not-read', 'reading', 'available', 'not-established', 'draft', 'inactive',
  'asset-mismatch', 'coverage-insufficient', 't017-unlocatable',
  'mapping-unlocatable', 'context-invalid', 'unknown', 'read-failed'
]);
const C028_STATES = Object.freeze([
  'pending', 'queued', 'sent', 'accepted', 'rejected', 'unknown',
  'not-sent-superseded'
]);
const C029_STATES = Object.freeze(['processing', 'succeeded', 'failed', 'incompatible', 'unknown']);
const C003_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'contractCode', 'receiptId', 'idempotencyKey', 'deliveryId',
  'assetVersionId', 't007Id', 'status', 'receivedAt', 'reasonCode', 'reason',
  'targetDraftVersion', 'replacement', 'scenarioContext', 'uncertainty'
]);
const C032_RESPONSE_FIELDS = Object.freeze([
  'schemaVersion', 'contractCode', 'responseId', 'responseVersion', 'idempotencyKey',
  'assetId', 't006Id', 'status', 'formedAt', 'readAt', 'scenarioContext',
  'candidates', 'reasonCode', 'reason', 'recovery', 'requestId', 'uncertainty'
]);
const C032_CANDIDATE_FIELDS = Object.freeze([
  't054Id', 'targetId', 'bindingId', 'bindingVersion', 'bindingName', 'name',
  'status', 'allowSubmit', 't017Id', 'mappingVersion', 'assetId', 't006Id',
  'memberCoverage', 'relationshipCoverage', 'owner', 'lastVerifiedAt',
  'reasonCode', 'reason', 'recovery', 'evidence'
]);
const C028_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'contractCode', 'requestId', 'idempotencyKey', 'deliveryId',
  'assetVersionId', 't007Id', 'status', 'receivedAt', 'reasonCode', 'reason',
  'target', 'scenarioContext', 'uncertainty'
]);
const C029_RESULT_FIELDS = Object.freeze([
  'schemaVersion', 'contractCode', 'resultId', 'idempotencyKey', 'requestId',
  'deliveryId', 'assetId', 'assetVersionId', 't006Id', 't007Id', 'status',
  'formedAt', 'reasonCode', 'reason', 'recovery', 'evidence',
  't018Qualification', 't019Snapshot', 'target', 'discovery', 'scenarioContext'
]);

const FIVE_DIMENSIONS = Object.freeze([
  'versionLocation',
  'contentAccess',
  'evidenceCompleteness',
  'replayCapability',
  'replayVerification'
]);

const FORBIDDEN_CONSUMER_KEYS = new Set([
  'rows', 'records', 'data', 'rawContent', 'content', 'workbook', 'filePath',
  'sourceFields', 'physicalFields', 'failureSamples', 'samples', 'businessValues',
  'metricFormula', 'ruleThreshold', 'pythonCode', 'scriptSource', 'downloadUrl',
  'businessConclusion', 'riskScore', 'score', 'metric', 'rule', 'formula',
  'businessRows', 'businessValues', 'rawRows'
]);
const FORBIDDEN_CONSUMER_KEYS_LOWER = new Set([...FORBIDDEN_CONSUMER_KEYS].map((key) => key.toLowerCase()));

class DataContractError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'DataContractError';
    this.code = code;
    this.details = details;
    this.errors = details;
  }
}

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (seen.has(value)) throw new DataContractError('CYCLIC_VALUE', 'cyclic values are not supported');
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
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  if (Buffer.isBuffer(value)) return value;
  seen.add(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
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

function dateTime(value) {
  return contracts.isDateTime(value);
}

function asOfValue(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  if (dateTime(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function nowIso(value) {
  const candidate = value || new Date().toISOString();
  if (!dateTime(candidate)) throw new DataContractError('INVALID_TIME', `invalid RFC3339 time: ${candidate}`);
  return candidate;
}

function stableValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      throw new DataContractError('NON_JSON_VALUE', 'only JSON values can be fingerprinted');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new DataContractError('NON_JSON_VALUE', 'non-finite numbers cannot be fingerprinted');
    }
    return value;
  }
  if (seen.has(value)) throw new DataContractError('CYCLIC_VALUE', 'cyclic values cannot be fingerprinted');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((item) => stableValue(item, seen));
  else {
    result = {};
    Object.keys(value).sort().forEach((key) => { result[key] = stableValue(value[key], seen); });
  }
  seen.delete(value);
  return result;
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function contentFingerprint(content) {
  const bytes = Buffer.isBuffer(content)
    ? content
    : typeof content === 'string'
      ? Buffer.from(content, 'utf8')
      : Buffer.from(stableSerialize(content), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function idFor(prefix, parts) {
  const digest = crypto.createHash('sha256').update(parts.join('|'), 'utf8').digest('hex').slice(0, 24);
  return `${prefix}-${digest}`;
}

function assertContext(context, options = {}) {
  try {
    return identity.assertScenarioContext(context, {
      enforcePrefix: options.enforcePrefix,
      allowUnknown: options.allowUnknown === true
    });
  } catch (error) {
    throw new DataContractError('INVALID_SCENARIO_CONTEXT', error.message, error.errors || []);
  }
}

function assertActiveContext(context, options = {}) {
  const normalized = assertContext(context, options);
  if (['inactive', 'unknown', 'disabled', 'stopped', 'archived'].includes(String(normalized.status).toLowerCase())) {
    throw new DataContractError('SCENARIO_CONTEXT_INACTIVE', 'scenario context is not active for this operation');
  }
  return normalized;
}

function sameRunContext(left, right) {
  return identity.compareScenarioContext(left, right);
}

function sameExactContext(left, right) {
  return identity.compareScenarioContext(left, right, { includeLifecycle: true });
}

function requireContextMatch(expected, actual) {
  const normalizedExpected = assertContext(expected);
  const normalizedActual = assertContext(actual);
  if (!sameExactContext(normalizedExpected, normalizedActual)) {
    throw new DataContractError('SCENARIO_CONTEXT_MISMATCH', 'records must echo the exact five-field C033 context');
  }
}

function assertAllowedFields(value, fields, contract, options = {}) {
  if (!isRecord(value)) throw new DataContractError(`INVALID_${contract}`, `${contract} must be an object`);
  const allowed = new Set(fields);
  const requiredFields = new Set(options.required || []);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  const missing = [...requiredFields].filter((field) => !hasOwn(value, field) || value[field] === undefined || value[field] === null || value[field] === '');
  if (unknown.length || missing.length) {
    throw new DataContractError(`INVALID_${contract}`, `${contract} shape is not exact`, { unknown, missing });
  }
  return value;
}

function assertExactSchemaVersion(actual, expected = DATA_SCHEMA_VERSION) {
  const version = contracts.validateSchemaVersion(actual);
  if (!version.valid) throw new DataContractError('SCHEMA_VERSION_INVALID', 'schemaVersion is not recognized by Foundation', version.errors);
  let result;
  try { result = contracts.assertSchemaCompatibility(expected, actual); } catch (error) {
    throw new DataContractError('SCHEMA_VERSION_INCOMPATIBLE', error.message, error.result || []);
  }
  if (result.status !== contracts.COMPATIBILITY_STATUS.EXACT) {
    throw new DataContractError('SCHEMA_VERSION_NOT_EXACT', 'M02 accepts only the registered exact schema version', result);
  }
  return result;
}

function assertC032Candidate(value) {
  assertAllowedFields(value, C032_CANDIDATE_FIELDS, 'C032_CANDIDATE');
  for (const field of ['memberCoverage', 'relationshipCoverage']) {
    if (isRecord(value[field])) assertAllowedFields(value[field], ['status', 'required', 'covered', 'missing', 'total'], 'C032_COVERAGE');
  }
  if (isRecord(value.owner)) assertAllowedFields(value.owner, ['refType', 'refId'], 'C032_OWNER', { required: ['refType', 'refId'] });
  for (const evidence of Array.isArray(value.evidence) ? value.evidence : []) {
    assertAllowedFields(evidence, ['evidenceType', 'evidenceId', 'evidenceVersion', 'refType', 'refId', 'refVersion', 'locator', 'fingerprint'], 'C032_EVIDENCE', { required: ['evidenceType', 'evidenceId'] });
  }
  return value;
}

function assertT019Snapshot(value) {
  if (value === null || value === undefined) return value;
  return assertAllowedFields(value, ['t019Id', 'status', 'semanticVersion', 'assetVersionId', 't007Id', 'asOfTime', 't008', 'observedAt', 'evidenceId'], 'C029_T019_SNAPSHOT');
}

function assertEvidenceReferences(values, contract = 'M02_EVIDENCE') {
  if (values === null || values === undefined) return values;
  if (!Array.isArray(values)) throw new DataContractError(`INVALID_${contract}`, `${contract} must be an array`);
  for (const evidence of values) {
    assertAllowedFields(evidence, ['evidenceType', 'evidenceId', 'evidenceVersion', 'refType', 'refId', 'refVersion', 'locator', 'fingerprint'], contract, { required: ['evidenceType', 'evidenceId'] });
  }
  return values;
}

function assertT018Qualification(value) {
  if (value === null || value === undefined || typeof value === 'string') return value;
  return assertAllowedFields(value, ['status', 'reason', 'evidenceId', 'formedAt'], 'C029_T018_QUALIFICATION', { required: ['status'] });
}

function assertC003Replacement(value) {
  if (value === null || value === undefined) return value;
  return assertAllowedFields(value, ['previousAssetVersionId', 'newAssetVersionId', 'relation', 'formedAt', 'evidenceId'], 'C003_REPLACEMENT');
}

function required(value, fields, kind) {
  if (!isRecord(value)) throw new DataContractError('INVALID_RECORD', `${kind} must be an object`);
  const errors = [];
  fields.forEach((field) => {
    if (!hasOwn(value, field) || value[field] === undefined || value[field] === null || value[field] === '') {
      errors.push({ field, code: 'required' });
    }
  });
  if (errors.length) throw new DataContractError(`INVALID_${kind.toUpperCase()}`, `${kind} is missing required fields`, errors);
  return value;
}

function validateSource(value) {
  required(value, ['sourceId', 'name', 'category', 'readMethod', 'status'], 'source');
  if (!token(value.sourceId) || !text(value.name) || !token(value.category) || !token(value.readMethod)) {
    throw new DataContractError('INVALID_SOURCE', 'source identity and method must be non-empty tokens');
  }
  if (value.sourceVersion !== undefined && !token(value.sourceVersion)) throw new DataContractError('INVALID_SOURCE', 'sourceVersion must be a non-empty token');
  if (value.scenarioId !== undefined || value.scenarioRunId !== undefined || value.scenarioContext !== undefined) {
    throw new DataContractError('SCENARIO_IN_SOURCE_IDENTITY', 'scenario context is not part of T001 identity');
  }
  return value;
}

function validateAsOfConfirmation(value) {
  required(value, ['confirmedBy', 'confirmedAt', 'basis', 'scenarioContext'], 'as-of confirmation');
  const asOfTime = value.asOfTime || value.asOf || value.t008;
  if (!asOfValue(asOfTime) || !text(value.confirmedBy) || !text(value.basis) || !dateTime(value.confirmedAt)) {
    throw new DataContractError('INVALID_T008_CONFIRMATION', 'T008 confirmation requires explicit value, actor, time and basis');
  }
  assertContext(value.scenarioContext);
  return value;
}

function validateSnapshot(value) {
  required(value, [
    'snapshotId', 'sourceId', 'readAt', 'status', 'immutable'
  ], 'snapshot');
  const fingerprintValue = value.contentFingerprint || value.contentHash || value.sha256;
  if (!token(value.snapshotId) || !token(value.sourceId) || !/^[a-f0-9]{64}$/i.test(fingerprintValue || '')) {
    throw new DataContractError('INVALID_T002', 'T002 identity or SHA-256 fingerprint is invalid');
  }
  if (!dateTime(value.readAt) || value.immutable !== true) {
    throw new DataContractError('INVALID_T002', 'T002 must be immutable and carry a valid read time');
  }
  if (value.t008Confirmation) validateAsOfConfirmation(value.t008Confirmation);
  return value;
}

function validateQuality(value) {
  required(value, ['qualityId', 'status', 'hardFailure', 'checks'], 'quality');
  if (!token(value.qualityId) || !QUALITY_STATES.includes(value.status) || typeof value.hardFailure !== 'boolean' || !Array.isArray(value.checks)) {
    throw new DataContractError('INVALID_T005', 'T005 quality result is malformed');
  }
  if (value.hardFailure && value.status !== 'failed') {
    throw new DataContractError('INVALID_T005', 'a hard quality failure must have failed status');
  }
  return value;
}

function validateAssetVersion(value, options = {}) {
  required(value, [
    'scenarioContext', 'members', 'quality', 'immutable', 'consumable'
  ], 'asset version');
  const assetId = value.assetId || value.t006Id;
  const assetVersionId = value.assetVersionId || value.t007Id || value.versionId;
  const asOfTime = value.asOfTime || value.t008 || value.asOf;
  const relationships = value.relationships || value.relations || [];
  if (!token(assetId) || !token(assetVersionId) || !text(asOfTime)
      || !Array.isArray(value.members) || !Array.isArray(relationships)
      || value.immutable !== true || typeof value.consumable !== 'boolean') {
    throw new DataContractError('INVALID_T007', 'T007 version is malformed');
  }
  assertContext(value.scenarioContext);
  validateQuality(value.quality);
  if (value.compatibilityOnly === true) {
    if (value.consumable !== false || value.reusable !== false) {
      throw new DataContractError('S003_COMPATIBILITY_LOCK', 'S003 compatibility T007 is permanently non-consumable and non-reusable');
    }
  }
  if (options.requireConsumable && (value.consumable !== true || value.compatibilityOnly === true)) {
    throw new DataContractError('T007_NOT_CONSUMABLE', 'this T007 cannot be consumed by the requested client');
  }
  return value;
}

function validatePipeline(value) {
  required(value, ['pipelineId', 'nodes', 'edges', 'status'], 'pipeline');
  const versionId = value.pipelineVersionId || value.pipelineVersion || value.version;
  const assetId = value.assetId || value.outputAssetId || value.t006Id;
  if (!token(value.pipelineId) || !token(versionId) || !token(assetId)
      || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new DataContractError('INVALID_T003', 'T003 pipeline definition is malformed');
  }
  return value;
}

function validateDelivery(value) {
  required(value, [
    'deliveryId', 'contractCode', 'scenarioContext',
    'status', 'sentAt'
  ], 'delivery');
  const assetId = value.assetId || value.t006Id;
  const assetVersionId = value.assetVersionId || value.t007Id;
  const asOfTime = value.asOfTime || value.t008 || value.asOf;
  if (value.contractCode !== 'C003' || !token(value.deliveryId) || !token(assetId)
      || !token(assetVersionId) || !text(asOfTime) || !DELIVERY_STATES.includes(value.status) || !dateTime(value.sentAt)) {
    throw new DataContractError('INVALID_C003', 'C003 delivery envelope is malformed');
  }
  assertContext(value.scenarioContext);
  return value;
}

function validateC017Summary(value) {
  required(value, [
    'summaryId', 'summaryVersion', 'summaryType', 'assetId', 'assetVersionId',
    'asOfTime', 'scenarioContext', 'fiveDimensions', 'dataSideQualification'
  ], 'C017 summary');
  if (!token(value.summaryId) || !token(value.summaryVersion) || !['version-bound', 'current-state'].includes(value.summaryType)
      || !token(value.assetId) || !token(value.assetVersionId) || !isRecord(value.fiveDimensions)
      || !['allowed', 'allowed-with-warning', 'prohibited', 'unknown'].includes(value.dataSideQualification)) {
    throw new DataContractError('INVALID_C017', 'C017 summary is malformed');
  }
  FIVE_DIMENSIONS.forEach((dimension) => {
    if (!hasOwn(value.fiveDimensions, dimension) || !text(value.fiveDimensions[dimension].status)) {
      throw new DataContractError('INVALID_C017', `C017 five-dimensional status is missing ${dimension}`);
    }
  });
  const dimensionKeys = Object.keys(value.fiveDimensions);
  if (dimensionKeys.length !== FIVE_DIMENSIONS.length || dimensionKeys.some((key) => !FIVE_DIMENSIONS.includes(key))) {
    throw new DataContractError('INVALID_C017', 'C017 must contain exactly the registered five dimensions');
  }
  for (const dimension of Object.values(value.fiveDimensions)) {
    assertAllowedFields(dimension, ['status', 'reason', 'formedAt', 'evidenceRef'], 'C017_DIMENSION', { required: ['status'] });
  }
  assertContext(value.scenarioContext);
  return value;
}

function assertNoForbiddenKeys(value, path = '$', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) throw new DataContractError('CYCLIC_VALUE', 'projection cannot contain cycles');
  seen.add(value);
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_CONSUMER_KEYS.has(key) || FORBIDDEN_CONSUMER_KEYS_LOWER.has(key.toLowerCase())) throw new DataContractError('CONSUMER_DATA_LEAK', `restricted projection contains ${path}.${key}`);
    assertNoForbiddenKeys(value[key], `${path}.${key}`, seen);
  });
  seen.delete(value);
}

function immutableRecord(value, validator) {
  const copy = clone(value);
  validator(copy);
  return deepFreeze(copy);
}

function makeSource(value) { return immutableRecord(value, validateSource); }
function makeSnapshot(value) {
  const normalized = clone(value);
  if (normalized.contentFingerprint === undefined) normalized.contentFingerprint = normalized.contentHash || normalized.sha256;
  return immutableRecord(normalized, validateSnapshot);
}
function makeQuality(value) { return immutableRecord(value, validateQuality); }
function makeAssetVersion(value, options) {
  const normalized = clone(value);
  if (normalized.relationships === undefined) normalized.relationships = normalized.relations || [];
  if (normalized.asOfTime === undefined) normalized.asOfTime = normalized.t008 || normalized.asOf;
  if (normalized.consumable === undefined) normalized.consumable = false;
  return immutableRecord(normalized, (item) => validateAssetVersion(item, options));
}
function makePipeline(value) {
  const normalized = clone(value);
  if (normalized.pipelineVersionId === undefined) normalized.pipelineVersionId = normalized.pipelineVersion || normalized.version;
  if (normalized.assetId === undefined) normalized.assetId = normalized.outputAssetId || normalized.t006Id;
  return immutableRecord(normalized, validatePipeline);
}
function makeDelivery(value) {
  const normalized = clone(value);
  if (normalized.asOfTime === undefined) normalized.asOfTime = normalized.t008 || normalized.asOf;
  return immutableRecord(normalized, validateDelivery);
}
function makeC017Summary(value) {
  const normalized = clone(value);
  if (normalized.asOfTime === undefined) normalized.asOfTime = normalized.t008 || normalized.asOf;
  return immutableRecord(normalized, validateC017Summary);
}

function createReadEvent({ eventId, consumer, requester, context, assetVersionId, summaryId, summaryVersion, status, readAt }) {
  if (!text(assetVersionId) || !text(summaryId) || !text(summaryVersion)) {
    throw new DataContractError('INVALID_C017_READ', 'C017 read event must identify the exact T007 and both summary identities');
  }
  const event = {
    eventId: eventId || idFor('C017-READ', [consumer, requester, assetVersionId, summaryId, readAt || 'now']),
    eventType: 'C017_READ',
    eventName: 'C017_READ',
    schemaVersion: EVENT_SCHEMA_VERSION,
    occurredAt: nowIso(readAt),
    consumer: text(consumer) ? consumer : 'unknown',
    requester: text(requester) ? requester : 'unknown',
    assetVersionId,
    summaryId,
    summaryVersion,
    status: status || 'ok',
    scenarioContext: assertContext(context)
  };
  return deepFreeze(event);
}

function createAsOfReadEvent({ eventId, snapshotId, requester, context, readAt, status = 'read' }) {
  return deepFreeze({
    eventId: eventId || idFor('T008-READ', [snapshotId, requester, readAt || 'now']),
    eventType: 'T008_READ',
    eventName: 'T008_READ',
    schemaVersion: EVENT_SCHEMA_VERSION,
    occurredAt: nowIso(readAt),
    snapshotId,
    requester: text(requester) ? requester : 'unknown',
    status,
    scenarioContext: assertContext(context)
  });
}

function createAsOfConfirmation(value) {
  const copy = clone(value);
  if (copy.asOfTime === undefined) copy.asOfTime = copy.asOf || copy.t008;
  validateAsOfConfirmation(copy);
  return deepFreeze({
    confirmationId: copy.confirmationId || idFor('T008-CONF', [copy.asOfTime, copy.confirmedBy, copy.confirmedAt, stableSerialize(copy.scenarioContext)]),
    ...copy,
    eventType: 'T008_CONFIRMED',
    eventName: 'T008_CONFIRMED',
    schemaVersion: EVENT_SCHEMA_VERSION
  });
}

function projectC017(summary, consumer, options = {}) {
  validateC017Summary(summary);
  const allowedConsumers = new Set(['ontology', 'intelligent-query', 'decision-center', 'agent', 'report', 'm04', 'm03', 'm05', 'm06']);
  if (!allowedConsumers.has(consumer)) throw new DataContractError('CONSUMER_NOT_ALLOWED', `consumer ${consumer} is not allowed to read C017`);
  const strictOptional = (value, fields, name) => {
    if (value !== null && value !== undefined) assertAllowedFields(value, fields, name);
  };
  strictOptional(summary.quality, ['status', 'qualityId', 'checkCount', 'failedCount', 'warningCount', 'hardFailure', 'reason'], 'C017_QUALITY');
  strictOptional(summary.freshness, ['status', 'reason', 'asOfTime', 't008', 'evaluatedAt', 'age', 'thresholdRef', 'thresholdVersion', 'owner', 'scope', 'gate'], 'C017_FRESHNESS');
  strictOptional(summary.candidate, ['assetVersionId', 't007Id', 'status', 'stage', 'asOfTime', 't008', 'reason', 'recovery', 'formedAt'], 'C017_CANDIDATE');
  strictOptional(summary.currentAuthority, ['t019Id', 'evidenceId', 'status', 'observedAt', 'semanticVersion', 'assetVersionId', 't007Id', 'asOfTime', 't008', 'formedAt'], 'C017_AUTHORITY');
  strictOptional(summary.previousAuthority, ['t019Id', 'evidenceId', 'status', 'observedAt', 'semanticVersion', 'assetVersionId', 't007Id', 'asOfTime', 't008', 'formedAt'], 'C017_AUTHORITY');
  strictOptional(summary.delivery, ['deliveryId', 'status', 'receiptStatus', 'receivedAt'], 'C017_DELIVERY');
  strictOptional(summary.discovery, ['responseId', 'responseVersion', 'status', 't054Id', 'bindingVersion', 't017Id', 'mappingVersion', 'readAt', 'reason', 'recovery'], 'C017_DISCOVERY');
  strictOptional(summary.refresh, ['requestId', 'status', 'requestedAt', 'result'], 'C017_REFRESH');
  if (summary.refresh?.result) assertAllowedFields(summary.refresh.result, ['resultId', 'status', 'formedAt', 't018Qualification'], 'C017_REFRESH_RESULT');
  strictOptional(summary.retention, ['status', 'until', 'policyId', 'policyVersion', 'reason', 'lastCheckedAt'], 'C017_RETENTION');
  strictOptional(summary.reproducibility, ['status', 'reason', 'verificationId', 'verifiedAt'], 'C017_REPRODUCIBILITY');
  for (const evidence of summary.evidence || []) {
    assertAllowedFields(evidence, ['evidenceId', 'evidenceType', 'evidenceVersion', 'type', 'assetVersionId', 't007Id', 'scope', 'locationStatus', 'formedAt', 'lastConfirmedAt', 'owner', 'recovery'], 'C017_EVIDENCE', { required: ['evidenceId'] });
  }
  const base = {
    contractCode: 'C017',
    contractVersion: DATA_CONTRACT_VERSION,
    consumer,
    summaryId: summary.summaryId,
    summaryVersion: summary.summaryVersion,
    summaryType: summary.summaryType,
    versionBoundSummaryId: summary.versionBoundSummaryId || (summary.summaryType === 'version-bound' ? summary.summaryId : null),
    versionBoundSummaryVersion: summary.versionBoundSummaryVersion || (summary.summaryType === 'version-bound' ? summary.summaryVersion : null),
    formedAt: summary.formedAt,
    observedAt: summary.observedAt || summary.formedAt,
    factLastConfirmedAt: summary.factLastConfirmedAt || null,
    scenarioContext: clone(summary.scenarioContext),
    assetId: summary.assetId,
    assetVersionId: summary.assetVersionId,
    t006Id: summary.assetId,
    t007Id: summary.assetVersionId,
    asOfTime: summary.asOfTime,
    t008: summary.asOfTime,
    dataSideQualification: summary.dataSideQualification,
    qualificationReason: summary.qualificationReason,
    fiveDimensions: clone(summary.fiveDimensions),
    freshness: clone(summary.freshness || { status: 'unknown', reason: 'not provided' }),
    quality: clone(summary.quality || { status: 'unknown', reason: 'not provided' }),
    candidate: clone(summary.candidate || null),
    dataSidePreviousQualified: clone(summary.dataSidePreviousQualified || null),
    currentAuthority: clone(summary.currentAuthority || null),
    previousAuthority: clone(summary.previousAuthority || null),
    delivery: clone(summary.delivery || null),
    discovery: clone(summary.discovery || null),
    refresh: clone(summary.refresh || null),
    evidence: clone(summary.evidence || []),
    retention: clone(summary.retention || { status: 'unknown' }),
    reproducibility: clone(summary.reproducibility || { status: 'not-executed', reason: 'not executed / dependency insufficient' }),
    consistency: clone(summary.consistency || 'unknown')
  };
  assertNoForbiddenKeys(base);
  if (consumer === 'decision-center' || consumer === 'm04') {
    // C011 safety gates receive only the minimum quality projection.
    return deepFreeze({
      contractCode: base.contractCode,
      contractVersion: base.contractVersion,
      consumer: base.consumer,
      summaryId: base.summaryId,
      summaryVersion: base.summaryVersion,
      formedAt: base.formedAt,
      scenarioContext: base.scenarioContext,
      assetVersionId: base.assetVersionId,
      t007Id: base.t007Id,
      t008: base.t008,
      currentQualityStatus: base.quality.status,
      hardQualityFailure: Boolean(summary.hardQualityFailure),
      affectedScope: clone(summary.affectedScope || null),
      discoveredAt: summary.discoveredAt || null,
      reason: summary.qualificationReason || null,
      recovery: summary.recovery || null,
      evidence: clone(summary.evidence || [])
    });
  }
  return deepFreeze(base);
}

function validationResult(validator, value, options) {
  try {
    validator(value, options);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code, message: error.message, details: error.details }] };
  }
}

module.exports = Object.freeze({
  DATA_CONTRACT_VERSION,
  DATA_SCHEMA_VERSION,
  DATA_SPINE_CONTRACT_ID,
  EVENT_SCHEMA_VERSION,
  EVENT_CONTRACT_ID,
  CONTRACT_CODES,
  T007_S003_COMPATIBILITY_STATUS,
  EXECUTION_STATES,
  QUALITY_STATES,
  DELIVERY_STATES,
  C032_STATES,
  C028_STATES,
  C029_STATES,
  C003_RECEIPT_FIELDS,
  C032_RESPONSE_FIELDS,
  C032_CANDIDATE_FIELDS,
  C028_RECEIPT_FIELDS,
  C029_RESULT_FIELDS,
  FIVE_DIMENSIONS,
  FORBIDDEN_CONSUMER_KEYS,
  FORBIDDEN_CONSUMER_KEYS_LOWER,
  DataContractError,
  clone,
  deepFreeze,
  stableSerialize,
  contentFingerprint,
  idFor,
  assertContext,
  assertActiveContext,
  sameRunContext,
  sameExactContext,
  requireContextMatch,
  assertAllowedFields,
  assertExactSchemaVersion,
  assertC032Candidate,
  assertT019Snapshot,
  assertEvidenceReferences,
  assertT018Qualification,
  assertC003Replacement,
  validateSource,
  validateSnapshot,
  validateAsOfConfirmation,
  validatePipeline,
  validateQuality,
  validateAssetVersion,
  validateDelivery,
  validateC017Summary,
  assertNoForbiddenKeys,
  immutableRecord,
  makeSource,
  makeSnapshot,
  makeQuality,
  makePipeline,
  makeAssetVersion,
  makeDelivery,
  makeC017Summary,
  createReadEvent,
  createAsOfReadEvent,
  createAsOfConfirmation,
  projectC017,
  validateT001: validateSource,
  validateT002: validateSnapshot,
  validateT003: validatePipeline,
  validateT005: validateQuality,
  validateT007: validateAssetVersion,
  validateT008Confirmation: validateAsOfConfirmation,
  checkSource: (value) => validationResult(validateSource, value),
  checkSnapshot: (value) => validationResult(validateSnapshot, value),
  checkPipeline: (value) => validationResult(validatePipeline, value),
  checkQuality: (value) => validationResult(validateQuality, value),
  checkAssetVersion: (value, options) => validationResult(validateAssetVersion, value, options),
  checkDelivery: (value) => validationResult(validateDelivery, value),
  checkC017Summary: (value) => validationResult(validateC017Summary, value),
  isValidT001: (value) => validationResult(validateSource, value).valid,
  isValidT002: (value) => validationResult(validateSnapshot, value).valid,
  isValidT003: (value) => validationResult(validatePipeline, value).valid,
  isValidT005: (value) => validationResult(validateQuality, value).valid,
  isValidT007: (value, options) => validationResult(validateAssetVersion, value, options).valid,
  isValidC003: (value) => validationResult(validateDelivery, value).valid,
  isValidC017: (value) => validationResult(validateC017Summary, value).valid,
  validateT001Result: (value) => validationResult(validateSource, value),
  validateT002Result: (value) => validationResult(validateSnapshot, value),
  validateT003Result: (value) => validationResult(validatePipeline, value),
  validateT005Result: (value) => validationResult(validateQuality, value),
  validateT007Result: (value, options) => validationResult(validateAssetVersion, value, options),
  validateC003Result: (value) => validationResult(validateDelivery, value),
  validateC017Result: (value) => validationResult(validateC017Summary, value)
});
