'use strict';

/*
 * M04's narrow adapter to the Foundation boundary.  Domain payloads remain
 * M04-owned; only the C033/envelope/checkpoint metadata is validated here.
 * Compatibility is deliberately exact-only until a future owner review
 * explicitly registers an additive reader.
 */

const crypto = require('node:crypto');
const contracts = require('../../packages/contracts');
const identity = require('../../packages/identity');
const checkpoint = require('../../packages/checkpoint');

const FOUNDATION_SCHEMA_VERSION = contracts.SCHEMA_VERSION;
const CHECKPOINT_SCHEMA_VERSION = checkpoint.CHECKPOINT_SCHEMA_VERSION;
const SOURCE_TAG = 'prototype-v1.1.0-frozen';
const PARENT_VERSION = 'v1.1.0';
const BASELINE_SNAPSHOT_ID = 'BSL-OFW-V110-94ABD0E991B7';

function errorRecord(code, path, message, details) {
  return { code, path, message, ...(details ? { details } : {}) };
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableDigest(value) {
  return crypto.createHash('sha256').update(identity.stableSerialize(value), 'utf8').digest('hex');
}

function ledgerFingerprint(entries) {
  return stableDigest(entries);
}

function checkpointFingerprint(value) {
  const copy = clone(value);
  if (copy && typeof copy === 'object') delete copy.checkpointFingerprint;
  return stableDigest(copy);
}

function strictScenarioContextResult(value) {
  return contracts.validateScenarioContext(value, { allowUnknown: false });
}

function assertStrictScenarioContext(value) {
  const result = strictScenarioContextResult(value);
  if (!result.valid) {
    const error = new contracts.ContractValidationError('M04 ScenarioContext', result.errors);
    error.code = 'M04_INVALID_SCENARIO_CONTEXT';
    throw error;
  }
  return contracts.normalizeScenarioContext(value);
}

function compatibilityResult(actual, expected) {
  const result = contracts.classifySchemaCompatibility(actual, expected);
  if (result.status !== contracts.COMPATIBILITY_STATUS.EXACT) {
    return {
      ok: false,
      valid: false,
      result,
      errors: [errorRecord('SCHEMA_INCOMPATIBLE', 'schemaVersion', 'M04 accepts only the exact registered Foundation schema version', result)]
    };
  }
  return { ok: true, valid: true, result, errors: [] };
}

function assertExactSchemaVersion(actual, expected, path = 'schemaVersion') {
  const compatibility = compatibilityResult(actual, expected);
  if (!compatibility.ok) {
    const error = new Error('M04 schema compatibility check failed');
    error.name = 'M04SchemaCompatibilityError';
    error.code = 'M04_SCHEMA_INCOMPATIBLE';
    error.details = compatibility;
    throw error;
  }
  return compatibility.result;
}

function validateContractEnvelope(value) {
  const errors = [];
  const compatibility = compatibilityResult(value?.schemaVersion, FOUNDATION_SCHEMA_VERSION);
  if (!compatibility.ok) errors.push(...compatibility.errors);
  const structural = contracts.validateContractEnvelope(value, { allowUnknown: false });
  if (!structural.valid) errors.push(...structural.errors);
  if (!value || !value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) {
    errors.push(errorRecord('C011_PAYLOAD_INVALID', 'payload', 'M04 Contract Envelope payload must be an object'));
  }
  return {
    ok: errors.length === 0,
    valid: errors.length === 0,
    errors,
    compatibility: compatibility.result || null
  };
}

function assertContractEnvelope(value) {
  const result = validateContractEnvelope(value);
  if (!result.valid) {
    const error = new Error('M04 Contract Envelope validation failed');
    error.name = 'M04ContractEnvelopeError';
    error.code = 'M04_INVALID_CONTRACT_ENVELOPE';
    error.details = result;
    throw error;
  }
  // Re-run Foundation normalization only after the exact compatibility and
  // strict unknown-field checks have passed.
  return contracts.normalizeContractEnvelope(value);
}

function validateCheckpoint(value) {
  const compatibility = compatibilityResult(value?.schemaVersion, CHECKPOINT_SCHEMA_VERSION);
  const structural = checkpoint.validateCheckpoint(value, {
    requireSchemaVersion: true,
    contextOptions: { allowUnknown: false }
  });
  const errors = [...(compatibility.ok ? [] : compatibility.errors), ...structural.errors];
  const requiredBaseline = [
    ['sourceTag', SOURCE_TAG],
    ['parentVersion', PARENT_VERSION],
    ['baselineSnapshotId', BASELINE_SNAPSHOT_ID]
  ];
  requiredBaseline.forEach(([field, expected]) => {
    if (value?.[field] !== expected) {
      errors.push(errorRecord('BASELINE_IDENTITY_MISMATCH', field, `M04 checkpoint must use ${expected}`, {
        expected,
        actual: value?.[field] ?? null
      }));
    }
  });
  if (value?.baselineVersion !== PARENT_VERSION) {
    errors.push(errorRecord('BASELINE_VERSION_MISMATCH', 'baselineVersion', `M04 checkpoint must use ${PARENT_VERSION}`, {
      expected: PARENT_VERSION,
      actual: value?.baselineVersion ?? null
    }));
  }
  if (!value?.stateFingerprint) errors.push(errorRecord('MISSING_STATE_FINGERPRINT', 'stateFingerprint', 'stateFingerprint is required'));
  if (!value?.ledgerFingerprint) errors.push(errorRecord('MISSING_LEDGER_FINGERPRINT', 'ledgerFingerprint', 'ledgerFingerprint is required'));
  if (!value?.checkpointFingerprint) errors.push(errorRecord('MISSING_CHECKPOINT_FINGERPRINT', 'checkpointFingerprint', 'checkpointFingerprint is required'));
  if (Array.isArray(value?.m04Ledger?.entries)) {
    const expectedLedgerFingerprint = ledgerFingerprint(value.m04Ledger.entries);
    if (value.stateFingerprint && value.stateFingerprint !== expectedLedgerFingerprint) {
      errors.push(errorRecord('STATE_FINGERPRINT_MISMATCH', 'stateFingerprint', 'stateFingerprint does not match the M04 ledger', {
        expected: expectedLedgerFingerprint,
        actual: value.stateFingerprint
      }));
    }
    if (value.ledgerFingerprint && value.ledgerFingerprint !== expectedLedgerFingerprint) {
      errors.push(errorRecord('LEDGER_FINGERPRINT_MISMATCH', 'ledgerFingerprint', 'ledgerFingerprint does not match the M04 ledger', {
        expected: expectedLedgerFingerprint,
        actual: value.ledgerFingerprint
      }));
    }
  }
  if (value?.checkpointFingerprint && value.checkpointFingerprint !== checkpointFingerprint(value)) {
    errors.push(errorRecord('CHECKPOINT_FINGERPRINT_MISMATCH', 'checkpointFingerprint', 'checkpoint content fingerprint does not match the checkpoint body', {
      expected: checkpointFingerprint(value),
      actual: value.checkpointFingerprint
    }));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const allowed = new Set([
      'schemaVersion', 'checkpointId', 'immutable', 'moduleId', 'moduleVersion',
      'contractCode', 'scenarioContext', 'sourceScenarioRunId', 'restoreReadiness',
      'sourceTag', 'sourceVersion', 'parentVersion', 'implementationVersion',
      'baselineVersion', 'baselineSnapshotId', 'stateFingerprint', 'ledgerFingerprint', 'checkpointFingerprint', 'c019SummaryAtExport',
      'm04Ledger', 'sideEffectPolicy', 'overwritesHistory', 'overwritesSource'
    ]);
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) errors.push(errorRecord('UNKNOWN_CHECKPOINT_FIELD', key, 'M04 strict checkpoint reader rejects unknown fields'));
    });
  }
  return {
    ok: errors.length === 0,
    valid: errors.length === 0,
    errors,
    compatibility: compatibility.result || null
  };
}

function assertCheckpoint(value) {
  const result = validateCheckpoint(value);
  if (!result.ok) {
    const error = new Error('M04 checkpoint compatibility validation failed');
    error.name = 'M04CheckpointCompatibilityError';
    error.code = 'M04_INVALID_CHECKPOINT';
    error.details = result;
    throw error;
  }
  return value;
}

module.exports = Object.freeze({
  FOUNDATION_SCHEMA_VERSION,
  CHECKPOINT_SCHEMA_VERSION,
  SOURCE_TAG,
  PARENT_VERSION,
  BASELINE_SNAPSHOT_ID,
  stableDigest,
  ledgerFingerprint,
  checkpointFingerprint,
  strictScenarioContextResult,
  assertStrictScenarioContext,
  compatibilityResult,
  assertExactSchemaVersion,
  validateContractEnvelope,
  assertContractEnvelope,
  validateCheckpoint,
  assertCheckpoint
});
