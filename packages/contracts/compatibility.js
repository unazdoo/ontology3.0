'use strict';

/*
 * Conservative, dependency-free schema compatibility classification. This is
 * a decision helper only: it does not register schemas, persist migrations or
 * infer whether a domain change is additive. Callers must provide that fact
 * explicitly when opting in.
 */

const DRAFT_VERSION_RE = /^draft-(\d+)\.(\d+)\.(\d+)$/;
const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)$/;
const COMPATIBILITY_SCHEMA_VERSION = 'draft-0.1.0';
const COMPATIBILITY_CONTRACT_STATUS = 'draft';

const COMPATIBILITY_STATUS = Object.freeze({
  EXACT: 'exact',
  COMPATIBLE: 'compatible',
  REVIEW: 'review',
  BREAKING: 'breaking',
  INCOMPATIBLE: 'incompatible'
});

class SchemaCompatibilityError extends Error {
  constructor(result) {
    super(`schema compatibility check failed: ${result.status} (${result.reason})`);
    this.name = 'SchemaCompatibilityError';
    this.code = 'ERR_SCHEMA_COMPATIBILITY';
    this.result = result;
  }
}

function parseSchemaVersion(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const normalized = value.trim();
  const draft = DRAFT_VERSION_RE.exec(normalized);
  if (draft) {
    return {
      raw: normalized,
      channel: 'draft',
      major: Number(draft[1]),
      minor: Number(draft[2]),
      patch: Number(draft[3])
    };
  }
  const semver = SEMVER_RE.exec(normalized);
  if (semver) {
    return {
      raw: normalized,
      channel: 'final',
      major: Number(semver[1]),
      minor: Number(semver[2]),
      patch: Number(semver[3])
    };
  }
  return null;
}

function validateSchemaVersion(value) {
  const parsed = parseSchemaVersion(value);
  if (!parsed) {
    return {
      valid: false,
      errors: [{ path: 'schemaVersion', code: 'format', message: 'must be draft-X.Y.Z or X.Y.Z' }]
    };
  }
  return { valid: true, errors: [], parsed };
}

function compareNumbers(source, target) {
  for (const field of ['major', 'minor', 'patch']) {
    if (source[field] !== target[field]) return target[field] > source[field] ? 1 : -1;
  }
  return 0;
}

function inputPair(sourceOrRequest, targetOrOptions, maybeOptions) {
  if (typeof sourceOrRequest === 'object' && sourceOrRequest !== null
      && Object.prototype.hasOwnProperty.call(sourceOrRequest, 'sourceVersion')) {
    return {
      sourceVersion: sourceOrRequest.sourceVersion,
      targetVersion: sourceOrRequest.targetVersion,
      options: {
        ...sourceOrRequest,
        ...(sourceOrRequest.options || {}),
        ...(targetOrOptions || {})
      }
    };
  }
  return {
    sourceVersion: sourceOrRequest,
    targetVersion: targetOrOptions,
    options: maybeOptions || {}
  };
}

function classification(sourceVersion, targetVersion, options = {}) {
  const source = parseSchemaVersion(sourceVersion);
  const target = parseSchemaVersion(targetVersion);
  const base = {
    schemaVersion: COMPATIBILITY_SCHEMA_VERSION,
    contractStatus: COMPATIBILITY_CONTRACT_STATUS,
    sourceVersion,
    targetVersion,
    source,
    target,
    requiresReview: false,
    compatible: false,
    status: COMPATIBILITY_STATUS.INCOMPATIBLE,
    reason: 'invalid schema version'
  };
  if (typeof sourceVersion === 'string' && typeof targetVersion === 'string'
      && sourceVersion.trim() !== '' && sourceVersion.trim() === targetVersion.trim()) {
    return Object.freeze({ ...base, compatible: true, status: COMPATIBILITY_STATUS.EXACT, reason: 'same schema version' });
  }
  if (!source || !target) return Object.freeze(base);
  if (source.channel !== target.channel) {
    return Object.freeze({ ...base, reason: 'draft/final channel change requires explicit promotion' });
  }

  const direction = compareNumbers(source, target);
  if (direction < 0) {
    return Object.freeze({ ...base, reason: 'target schema version is older than source' });
  }
  if (target.major > source.major || options.changeKind === 'breaking') {
    return Object.freeze({ ...base, status: COMPATIBILITY_STATUS.BREAKING, reason: 'required or major contract change' });
  }

  const additive = options.changeKind === 'additive';
  if (additive && options.allowAdditive === true && target.major === source.major) {
    return Object.freeze({
      ...base,
      compatible: true,
      requiresReview: true,
      status: COMPATIBILITY_STATUS.COMPATIBLE,
      reason: 'explicitly approved additive change'
    });
  }
  return Object.freeze({
    ...base,
    requiresReview: true,
    status: COMPATIBILITY_STATUS.REVIEW,
    reason: target.minor > source.minor ? 'higher minor draft requires additive-shape review' : 'higher patch requires owner review'
  });
}

function classifySchemaCompatibility(sourceOrRequest, targetOrOptions, maybeOptions) {
  const pair = inputPair(sourceOrRequest, targetOrOptions, maybeOptions);
  return classification(pair.sourceVersion, pair.targetVersion, pair.options);
}

function assertSchemaCompatibility(sourceOrRequest, targetOrOptions, maybeOptions) {
  const pair = inputPair(sourceOrRequest, targetOrOptions, maybeOptions);
  const result = classification(pair.sourceVersion, pair.targetVersion, pair.options);
  const allowed = result.status === COMPATIBILITY_STATUS.EXACT
    || (result.status === COMPATIBILITY_STATUS.COMPATIBLE && pair.options.allowAdditive === true)
    || (result.status === COMPATIBILITY_STATUS.REVIEW && pair.options.allowReview === true);
  if (!allowed) throw new SchemaCompatibilityError(result);
  return result;
}

function isSchemaCompatible(sourceOrRequest, targetOrOptions, maybeOptions) {
  return classifySchemaCompatibility(sourceOrRequest, targetOrOptions, maybeOptions).compatible;
}

module.exports = Object.freeze({
  COMPATIBILITY_SCHEMA_VERSION,
  COMPATIBILITY_CONTRACT_STATUS,
  DRAFT_VERSION_RE,
  SEMVER_RE,
  COMPATIBILITY_STATUS,
  SchemaCompatibilityError,
  parseSchemaVersion,
  validateSchemaVersion,
  classifySchemaCompatibility,
  checkSchemaCompatibility: classifySchemaCompatibility,
  compareSchemaVersions: classifySchemaCompatibility,
  assertSchemaCompatibility,
  isSchemaCompatible,
  isCompatibleSchemaVersion: isSchemaCompatible
});
