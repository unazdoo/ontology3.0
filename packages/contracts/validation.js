'use strict';

/**
 * Small, dependency-free validators for the draft Foundation contracts.
 *
 * The functions deliberately return errors rather than throwing. Callers that
 * need fail-closed behavior can use the matching assert* function.
 */

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

class ContractValidationError extends Error {
  constructor(contract, errors) {
    const summary = errors.map((error) => `${error.path}: ${error.message}`).join('; ');
    super(`${contract} validation failed${summary ? `: ${summary}` : ''}`);
    this.name = 'ContractValidationError';
    this.code = 'ERR_CONTRACT_VALIDATION';
    this.contract = contract;
    this.errors = errors;
  }
}

function issue(path, code, message) {
  return { path, code, message };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 && !/\s/.test(value.trim());
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// RFC 3339 date-time, with a real calendar value accepted by Date.parse.
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isDateTime(value) {
  if (typeof value !== 'string' || !DATE_TIME_PATTERN.test(value) || Number.isNaN(Date.parse(value))) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offset = match[7] === 'Z' ? null : match[7].slice(1).split(':').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12
    && day >= 1 && day <= daysInMonth
    && hour >= 0 && hour <= 23
    && minute >= 0 && minute <= 59
    && second >= 0 && second <= 59
    && (!offset || (offset[0] >= 0 && offset[0] <= 23 && offset[1] >= 0 && offset[1] <= 59));
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (isRecord(value)) {
    const result = {};
    Object.keys(value).forEach((key) => { result[key] = clone(value[key]); });
    return result;
  }
  return value;
}

function firstString(source, keys) {
  for (const key of keys) {
    if (isText(source?.[key])) return source[key].trim();
  }
  return null;
}

function scenarioPrefixMatches(scenarioId, candidate) {
  if (!isText(scenarioId) || !isText(candidate)) return false;
  const id = scenarioId.trim();
  const value = candidate.trim();
  if (value === id || value.startsWith(`${id}-`) || value.startsWith(`${id}_`)
      || value.startsWith(`${id}.`) || value.startsWith(`${id}/`)) return true;
  const explicitPrefix = /^([A-Za-z][A-Za-z0-9_-]*)-(?:v|RUN-)/.exec(value);
  return !explicitPrefix || explicitPrefix[1] === id;
}

function validateScenarioContext(value, options = {}) {
  const errors = [];
  const path = options.path || 'scenarioContext';
  if (!isRecord(value)) {
    return { valid: false, errors: [issue(path, 'type', 'must be an object')] };
  }

  const required = ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'];
  required.forEach((key) => {
    if (!hasOwn(value, key) || value[key] === null || value[key] === undefined || value[key] === '') {
      errors.push(issue(`${path}.${key}`, 'required', 'is required'));
    }
  });

  ['scenarioId', 'scenarioVersion', 'scenarioRunId'].forEach((key) => {
    if (hasOwn(value, key) && !isNonEmptyString(value[key])) {
      errors.push(issue(`${path}.${key}`, 'format', 'must be a non-empty string without whitespace'));
    }
  });
  if (hasOwn(value, 'formedAt') && !isDateTime(value.formedAt)) {
    errors.push(issue(`${path}.formedAt`, 'format', 'must be an RFC 3339 date-time'));
  }
  if (hasOwn(value, 'status') && !isText(value.status)) {
    errors.push(issue(`${path}.status`, 'format', 'must be a non-empty string'));
  }

  const enforcePrefix = options.enforcePrefix !== false;
  if (enforcePrefix && isNonEmptyString(value.scenarioId)) {
    if (isNonEmptyString(value.scenarioVersion) && !scenarioPrefixMatches(value.scenarioId, value.scenarioVersion)) {
      errors.push(issue(`${path}.scenarioVersion`, 'mismatch', 'must use the scenarioId prefix'));
    }
    if (isNonEmptyString(value.scenarioRunId) && !scenarioPrefixMatches(value.scenarioId, value.scenarioRunId)) {
      errors.push(issue(`${path}.scenarioRunId`, 'mismatch', 'must use the scenarioId prefix'));
    }
  }

  if (options.allowUnknown === false) {
    const allowed = new Set(required.concat(options.allowedFields || []));
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) errors.push(issue(`${path}.${key}`, 'unknown', 'is not allowed'));
    });
  }
  return { valid: errors.length === 0, errors };
}

function normalizeScenarioContext(value, options = {}) {
  const normalized = clone(value);
  if (!isRecord(normalized)) return normalized;
  ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'status'].forEach((key) => {
    if (typeof normalized[key] === 'string') normalized[key] = normalized[key].trim();
  });
  if (options.canonicalizeDate === true && isDateTime(normalized.formedAt)) {
    normalized.formedAt = new Date(normalized.formedAt).toISOString();
  }
  return normalized;
}

function assertScenarioContext(value, options = {}) {
  const result = validateScenarioContext(value, options);
  if (!result.valid) throw new ContractValidationError('ScenarioContext', result.errors);
  return normalizeScenarioContext(value, options);
}

function validateActorRef(value, options = {}) {
  const path = options.path || 'actorRef';
  if (isText(value)) return { valid: true, errors: [] };
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return { valid: false, errors: [issue(path, 'format', 'must be a non-empty string or reference object')] };
  }
  // The identity boundary owns the reference shape. Foundation only requires
  // that an object reference is non-empty and remains opaque.
  return { valid: true, errors: [] };
}

function normalizeResourceRef(value, options = {}) {
  if (isText(value)) return value.trim();
  if (!isRecord(value)) return clone(value);
  const result = clone(value);
  const type = firstString(value, ['refType', 'resourceType', 'evidenceType', 'type', 'kind']);
  const id = firstString(value, ['refId', 'resourceId', 'evidenceId', 'id', 'key']);
  const version = firstString(value, ['refVersion', 'resourceVersion', 'evidenceVersion', 'version']);
  if (type && options.addCanonical !== false) result.refType = type;
  if (id && options.addCanonical !== false) result.refId = id;
  if (version && options.addCanonical !== false) result.refVersion = version;
  return result;
}

function validateResourceRef(value, options = {}) {
  const path = options.path || 'resourceRef';
  if (options.allowString && isText(value)) return { valid: true, errors: [] };
  if (!isRecord(value)) return { valid: false, errors: [issue(path, 'type', 'must be an object')] };
  const type = firstString(value, ['refType', 'resourceType', 'type', 'kind']);
  const id = firstString(value, ['refId', 'resourceId', 'id', 'key', 'uri']);
  const errors = [];
  if (!type) errors.push(issue(`${path}.refType`, 'required', 'must identify the resource type'));
  if (!id) errors.push(issue(`${path}.refId`, 'required', 'must identify the resource'));
  if (hasOwn(value, 'refVersion') && !isNonEmptyString(value.refVersion)) {
    errors.push(issue(`${path}.refVersion`, 'format', 'must be a non-empty string'));
  }
  return { valid: errors.length === 0, errors };
}

function normalizeEvidenceRef(value, options = {}) {
  const result = normalizeResourceRef(value, options);
  if (isRecord(result) && options.addCanonical !== false) {
    const type = firstString(value, ['evidenceType', 'refType', 'resourceType', 'type', 'kind']);
    const id = firstString(value, ['evidenceId', 'refId', 'resourceId', 'id', 'key']);
    const version = firstString(value, ['evidenceVersion', 'refVersion', 'resourceVersion', 'version']);
    if (type) result.evidenceType = type;
    if (id) result.evidenceId = id;
    if (version) result.evidenceVersion = version;
  }
  return result;
}

function validateEvidenceRef(value, options = {}) {
  const path = options.path || 'evidenceRef';
  if (options.allowString && isText(value)) return { valid: true, errors: [] };
  if (!isRecord(value)) return { valid: false, errors: [issue(path, 'type', 'must be an object')] };
  const type = firstString(value, ['evidenceType', 'refType', 'resourceType', 'type', 'kind']);
  const id = firstString(value, ['evidenceId', 'refId', 'resourceId', 'id', 'key', 'uri']);
  const errors = [];
  if (!type) errors.push(issue(`${path}.evidenceType`, 'required', 'must identify the evidence type'));
  if (!id) errors.push(issue(`${path}.evidenceId`, 'required', 'must identify the evidence'));
  if (hasOwn(value, 'formedAt') && !isDateTime(value.formedAt)) {
    errors.push(issue(`${path}.formedAt`, 'format', 'must be an RFC 3339 date-time'));
  }
  return { valid: errors.length === 0, errors };
}

function validateAuditFields(value, options = {}) {
  const errors = [];
  const path = options.path || 'auditFields';
  if (!isRecord(value)) return { valid: false, errors: [issue(path, 'type', 'must be an object')] };
  const required = [
    'actorRef',
    'traceId',
    'correlationId',
    'scenarioContext',
    'sourceVersion',
    'targetVersion',
    'formedAt',
    'operation',
    'outcome'
  ];
  required.forEach((key) => {
    if (!hasOwn(value, key) || value[key] === null || value[key] === undefined || value[key] === '') {
      errors.push(issue(`${path}.${key}`, 'required', 'is required'));
    }
  });
  if (hasOwn(value, 'actorRef')) errors.push(...validateActorRef(value.actorRef, { path: `${path}.actorRef` }).errors);
  ['traceId', 'correlationId', 'sourceVersion', 'targetVersion', 'operation', 'outcome'].forEach((key) => {
    if (hasOwn(value, key) && !isText(value[key])) errors.push(issue(`${path}.${key}`, 'format', 'must be a non-empty string'));
  });
  if (hasOwn(value, 'formedAt') && !isDateTime(value.formedAt)) errors.push(issue(`${path}.formedAt`, 'format', 'must be an RFC 3339 date-time'));
  if (hasOwn(value, 'scenarioContext')) {
    errors.push(...validateScenarioContext(value.scenarioContext, {
      path: `${path}.scenarioContext`,
      enforcePrefix: options.enforcePrefix,
      allowUnknown: options.allowUnknown
    }).errors);
  }
  if (options.allowUnknown === false) {
    const allowed = new Set(required.concat(options.allowedFields || []));
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) errors.push(issue(`${path}.${key}`, 'unknown', 'is not allowed'));
    });
  }
  return { valid: errors.length === 0, errors };
}

// The field list is intentionally data-only.  It is a compile-time/documentary
// contract, not an audit store or a policy engine.
const AUDIT_FIELDS = Object.freeze([
  'actorRef',
  'traceId',
  'correlationId',
  'scenarioContext',
  'sourceVersion',
  'targetVersion',
  'formedAt',
  'operation',
  'outcome'
]);

const AUDIT_FIELD_PURPOSES = Object.freeze({
  actorRef: 'Reference the actor supplied by the caller boundary.',
  traceId: 'Join the operation to a distributed trace.',
  correlationId: 'Join related requests and receipts.',
  scenarioContext: 'Bind the operation to one C033 scenario/version/run.',
  sourceVersion: 'Record the source version read or migrated from.',
  targetVersion: 'Record the target version compared or migrated to.',
  formedAt: 'Record when the audit metadata was formed.',
  operation: 'Name the stable operation that produced the metadata.',
  outcome: 'Record the operation outcome without becoming business truth.'
});

function createAuditFields(value, options = {}) {
  return assertAuditFields(value, options);
}

function normalizeAuditFields(value, options = {}) {
  const normalized = clone(value);
  if (!isRecord(normalized)) return normalized;
  normalized.scenarioContext = normalizeScenarioContext(normalized.scenarioContext, options);
  ['traceId', 'correlationId', 'sourceVersion', 'targetVersion', 'operation', 'outcome'].forEach((key) => {
    if (typeof normalized[key] === 'string') normalized[key] = normalized[key].trim();
  });
  return normalized;
}

function validateContractEnvelope(value, options = {}) {
  const errors = [];
  const path = options.path || 'envelope';
  if (!isRecord(value)) return { valid: false, errors: [issue(path, 'type', 'must be an object')] };
  const required = [
    'eventId',
    'eventType',
    'schemaVersion',
    'occurredAt',
    'actorRef',
    'correlationId',
    'traceId',
    'idempotencyKey',
    'scenarioContext',
    'resourceRefs',
    'evidenceRefs',
    'payload'
  ];
  required.forEach((key) => {
    // `payload` is intentionally unconstrained by the draft schema, so null is
    // a valid present payload. All metadata fields still reject null below.
    if (!hasOwn(value, key) || value[key] === undefined || (key !== 'payload' && value[key] === null)) {
      errors.push(issue(`${path}.${key}`, 'required', 'is required'));
    }
  });
  ['eventId', 'eventType', 'schemaVersion', 'correlationId', 'traceId', 'idempotencyKey'].forEach((key) => {
    if (hasOwn(value, key) && !isNonEmptyString(value[key])) errors.push(issue(`${path}.${key}`, 'format', 'must be a non-empty string without whitespace'));
  });
  if (hasOwn(value, 'occurredAt') && !isDateTime(value.occurredAt)) errors.push(issue(`${path}.occurredAt`, 'format', 'must be an RFC 3339 date-time'));
  if (hasOwn(value, 'actorRef')) errors.push(...validateActorRef(value.actorRef, { path: `${path}.actorRef` }).errors);
  if (hasOwn(value, 'scenarioContext')) {
    errors.push(...validateScenarioContext(value.scenarioContext, {
      path: `${path}.scenarioContext`,
      enforcePrefix: options.enforcePrefix,
      allowUnknown: options.allowUnknown
    }).errors);
  }
  if (hasOwn(value, 'resourceRefs')) {
    if (!Array.isArray(value.resourceRefs)) errors.push(issue(`${path}.resourceRefs`, 'type', 'must be an array'));
    else value.resourceRefs.forEach((ref, index) => errors.push(...validateResourceRef(ref, { allowString: true, path: `${path}.resourceRefs[${index}]` }).errors));
  }
  if (hasOwn(value, 'evidenceRefs')) {
    if (!Array.isArray(value.evidenceRefs)) errors.push(issue(`${path}.evidenceRefs`, 'type', 'must be an array'));
    else value.evidenceRefs.forEach((ref, index) => errors.push(...validateEvidenceRef(ref, { allowString: true, path: `${path}.evidenceRefs[${index}]` }).errors));
  }
  if (options.allowUnknown === false) {
    const allowed = new Set(required.concat(options.allowedFields || []));
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) errors.push(issue(`${path}.${key}`, 'unknown', 'is not allowed'));
    });
  }
  return { valid: errors.length === 0, errors };
}

function normalizeContractEnvelope(value, options = {}) {
  const normalized = clone(value);
  if (!isRecord(normalized)) return normalized;
  normalized.scenarioContext = normalizeScenarioContext(normalized.scenarioContext, options);
  if (Array.isArray(normalized.resourceRefs)) normalized.resourceRefs = normalized.resourceRefs.map((ref) => normalizeResourceRef(ref, options));
  if (Array.isArray(normalized.evidenceRefs)) normalized.evidenceRefs = normalized.evidenceRefs.map((ref) => normalizeEvidenceRef(ref, options));
  ['eventId', 'eventType', 'schemaVersion', 'correlationId', 'traceId', 'idempotencyKey'].forEach((key) => {
    if (typeof normalized[key] === 'string') normalized[key] = normalized[key].trim();
  });
  return normalized;
}

function assertContractEnvelope(value, options = {}) {
  const result = validateContractEnvelope(value, options);
  if (!result.valid) throw new ContractValidationError('ContractEnvelope', result.errors);
  return normalizeContractEnvelope(value, options);
}

function createContractEnvelope(value, options = {}) {
  return assertContractEnvelope(value, options);
}

function assertResourceRef(value, options = {}) {
  const result = validateResourceRef(value, options);
  if (!result.valid) throw new ContractValidationError('ResourceRef', result.errors);
  return normalizeResourceRef(value, options);
}

function assertEvidenceRef(value, options = {}) {
  const result = validateEvidenceRef(value, options);
  if (!result.valid) throw new ContractValidationError('EvidenceRef', result.errors);
  return normalizeEvidenceRef(value, options);
}

function assertAuditFields(value, options = {}) {
  const result = validateAuditFields(value, options);
  if (!result.valid) throw new ContractValidationError('AuditFields', result.errors);
  return normalizeAuditFields(value, options);
}

function isValid(resultOrValue, validator, options) {
  if (resultOrValue && typeof resultOrValue.valid === 'boolean' && Array.isArray(resultOrValue.errors)) return resultOrValue.valid;
  return validator(resultOrValue, options).valid;
}

// `ok` is a non-enumerable compatibility view for the prototype-era helper
// shape. Keeping it non-enumerable preserves the compact `{ valid, errors }`
// result for JSON consumers while allowing `result.ok` in existing callers.
function withOk(result) {
  if (result && typeof result === 'object' && !Object.prototype.hasOwnProperty.call(result, 'ok')) {
    Object.defineProperty(result, 'ok', { value: result.valid, enumerable: false, configurable: true });
  }
  return result;
}

const publicValidateScenarioContext = (value, options) => withOk(validateScenarioContext(value, options));
const publicValidateResourceRef = (value, options) => withOk(validateResourceRef(value, options));
const publicValidateEvidenceRef = (value, options) => withOk(validateEvidenceRef(value, options));
const publicValidateAuditFields = (value, options) => withOk(validateAuditFields(value, options));
const publicValidateContractEnvelope = (value, options) => withOk(validateContractEnvelope(value, options));

module.exports = {
  ContractValidationError,
  isDateTime,
  isNonEmptyString,
  scenarioPrefixMatches,
  validateScenarioContext: publicValidateScenarioContext,
  normalizeScenarioContext,
  assertScenarioContext,
  validateActorRef,
  normalizeResourceRef,
  validateResourceRef: publicValidateResourceRef,
  assertResourceRef,
  normalizeEvidenceRef,
  validateEvidenceRef: publicValidateEvidenceRef,
  assertEvidenceRef,
  validateAuditFields: publicValidateAuditFields,
  normalizeAuditFields,
  assertAuditFields,
  createAuditFields,
  AUDIT_FIELDS,
  AUDIT_FIELD_PURPOSES,
  validateContractEnvelope: publicValidateContractEnvelope,
  normalizeContractEnvelope,
  assertContractEnvelope,
  createContractEnvelope,
  // Friendly aliases used by module consumers.
  validateEnvelope: publicValidateContractEnvelope,
  assertEnvelope: assertContractEnvelope,
  createEnvelope: createContractEnvelope,
  assertContract: assertContractEnvelope,
  validateContract: publicValidateContractEnvelope,
  normalizeEnvelope: normalizeContractEnvelope,
  validateScenario: publicValidateScenarioContext,
  assertScenario: assertScenarioContext,
  isValidEnvelope: (value, options) => isValid(value, publicValidateContractEnvelope, options),
  isValidScenarioContext: (value, options) => isValid(value, publicValidateScenarioContext, options),
  isValidResourceRef: (value, options) => isValid(value, publicValidateResourceRef, options),
  isValidEvidenceRef: (value, options) => isValid(value, publicValidateEvidenceRef, options),
  isValidAuditFields: (value, options) => isValid(value, publicValidateAuditFields, options)
};
