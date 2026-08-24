'use strict';

const {
  C032_STATUSES,
  C008_STATUSES,
  C029_STATUSES,
  SCHEMA_VERSIONS,
  OntologyError,
  assertScenarioContext,
  cloneJson,
  fail,
  isRecord,
  sealIntegrity,
  verifyIntegrity
} = require('./domain');
const { normalizeC003Payload, normalizeC029Command, normalizeSemanticContent, validateSemanticContent } = require('./validation');
const { validateC008Projection, validateC032ResponseFingerprint } = require('./projection');

function validationResult(fn, value, options) {
  try {
    const normalized = fn(value, options);
    return { valid: true, ok: true, errors: [], value: normalized };
  } catch (error) {
    return { valid: false, ok: false, errors: [{ code: error.code || 'VALIDATION_FAILED', path: error.details?.path || '$', message: error.message, details: error.details || null }] };
  }
}

function validateC003(value, options = {}) {
  return validationResult(normalizeC003Payload, value, options);
}

function validateC029(value, options = {}) {
  return validationResult(normalizeC029Command, value, options);
}

function validateC008(value, options = {}) {
  return validationResult(validateC008Projection, value, options.scenarioContext);
}

function validatePublishedReadEnvelope(value, contractCode) {
  const errors = [];
  try {
    if (!isRecord(value)) fail(`${contractCode}_INVALID`, `${contractCode} must be an object`);
    if (value.schemaVersion && value.schemaVersion !== SCHEMA_VERSIONS[contractCode]) fail('SCHEMA_VERSION_MISMATCH', `${contractCode} schemaVersion is unsupported`);
    if (value.contractCode && value.contractCode !== contractCode) fail('CONTRACT_CODE_MISMATCH', `${contractCode} contractCode is incorrect`);
    if (!value.publishedId && !value.t017Id) fail(`${contractCode}_INVALID`, `${contractCode} requires an exact Published/T017 identity`);
    if (!value.semanticVersion) fail(`${contractCode}_INVALID`, `${contractCode} requires semanticVersion`);
    assertScenarioContext(value.scenarioContext);
    if (value.readOnly !== true) fail(`${contractCode}_READ_ONLY_REQUIRED`, `${contractCode} consumer view must be read-only`);
    if (value.integrity) verifyIntegrity(value, { label: contractCode, code: `${contractCode}_CORRUPT` });
  } catch (error) {
    errors.push({ code: error.code || `${contractCode}_INVALID`, message: error.message, details: error.details || null });
  }
  return { valid: errors.length === 0, ok: errors.length === 0, errors };
}

function validateT019(value) {
  const errors = [];
  try {
    if (!isRecord(value)) fail('T019_INVALID', 'T019 must be an object');
    const current = value.current || value;
    assertScenarioContext(value.scenarioContext);
    if (value.status === 'empty' && !value.current && !value.t019Id && !value.combinationId) return { valid: true, ok: true, errors: [] };
    if (!current.t019Id || !current.combinationId) fail('T019_INVALID', 'T019 requires stable t019Id and combinationId');
    if (!['adopted', 'ready', 'previous-trusted', 'failed'].includes(value.status)) fail('T019_UNKNOWN_STATUS', 'T019 status is unsupported');
  } catch (error) {
    errors.push({ code: error.code || 'T019_INVALID', message: error.message, details: error.details || null });
  }
  return { valid: errors.length === 0, ok: errors.length === 0, errors };
}

module.exports = Object.freeze({
  SCHEMA_VERSIONS,
  C032_STATUSES,
  C008_STATUSES,
  C029_STATUSES,
  OntologyError,
  validateC003,
  validateC004: (value) => validatePublishedReadEnvelope(value, 'C004'),
  validateC005: (value) => validatePublishedReadEnvelope(value, 'C005'),
  validateC006: (value) => validatePublishedReadEnvelope(value, 'C006'),
  validateC007: (value) => validatePublishedReadEnvelope(value, 'C007'),
  validateC032: (value) => {
    const errors = [];
    try {
      if (!isRecord(value)) fail('C032_INVALID', 'C032 must be an object');
      if (value.schemaVersion && value.schemaVersion !== SCHEMA_VERSIONS.C032) fail('SCHEMA_VERSION_MISMATCH', 'C032 schemaVersion is unsupported');
      const rawStatus = value.normalizedStatus || value.status;
      const normalizedStatus = { draft: 'draft-or-unpublished', inactive: 'disabled' }[rawStatus] || rawStatus;
      if (!C032_STATUSES.includes(normalizedStatus)) fail('C032_UNKNOWN_STATUS', 'C032 status is unsupported');
      assertScenarioContext(value.scenarioContext);
      if (value.integrity) verifyIntegrity(value, { label: 'C032', code: 'C032_CORRUPT' });
      validateC032ResponseFingerprint(value);
    } catch (error) {
      errors.push({ code: error.code || 'C032_INVALID', message: error.message, details: error.details || null });
    }
    return { valid: errors.length === 0, ok: errors.length === 0, errors };
  },
  validateC003,
  validateC028: (value) => {
    const errors = [];
    try {
      if (!isRecord(value) || !value.requestId || !value.deliveryId) fail('C028_INVALID', 'C028 requires requestId and deliveryId');
      if (value.status && !['pending', 'queued', 'sent', 'accepted', 'rejected', 'unknown'].includes(value.status)) fail('C028_UNKNOWN_STATUS', 'C028 status is unsupported');
      if (value.status === 'accepted' && (!isRecord(value.target) || !isRecord(value.discovery))) fail('C028_INVALID', 'accepted C028 requires exact target and discovery snapshots');
      if (value.status === 'accepted' && !value.preSubmitReread && !value.discoveryResponseId) fail('C028_INVALID', 'accepted C028 requires a submit-time reread identity');
      assertScenarioContext(value.scenarioContext);
      if (value.integrity) verifyIntegrity(value, { label: 'C028', code: 'C028_CORRUPT' });
    } catch (error) {
      errors.push({ code: error.code || 'C028_INVALID', message: error.message, details: error.details || null });
    }
    return { valid: errors.length === 0, ok: errors.length === 0, errors };
  },
  validateC029,
  validateT018: (value) => {
    const errors = [];
    try {
      if (!isRecord(value) || !value.qualificationId) fail('T018_INVALID', 'T018 requires qualificationId');
      if (!['eligible', 'ineligible', 'unknown'].includes(value.status)) fail('T018_UNKNOWN_STATUS', 'T018 status is unsupported');
      assertScenarioContext(value.scenarioContext);
      if (value.integrity) verifyIntegrity(value, { label: 'T018', code: 'T018_CORRUPT' });
    } catch (error) {
      errors.push({ code: error.code || 'T018_INVALID', message: error.message, details: error.details || null });
    }
    return { valid: errors.length === 0, ok: errors.length === 0, errors };
  },
  validateT019,
  validateC008,
  normalizeC003Payload,
  normalizeC029Command,
  normalizeSemanticContent,
  validateSemanticContent,
  sealC003Payload: (value) => sealIntegrity(cloneJson(value)),
  verifyIntegrity
});
