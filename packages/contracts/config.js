'use strict';

/*
 * Minimal configuration boundary only. It reads caller-owned values and never
 * persists flags, evaluates rollout rules, or makes an authorization decision.
 */

const CONFIG_SCHEMA_VERSION = 'draft-0.1.0';
const FLAG_NAME_RE = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateFeatureFlagConfig(value) {
  const errors = [];
  if (!isPlainObject(value)) {
    return { valid: false, errors: [{ path: '$', code: 'type', message: 'configuration must be an object' }] };
  }
  Object.keys(value).forEach((name) => {
    if (!FLAG_NAME_RE.test(name)) {
      errors.push({ path: `$.${name}`, code: 'name', message: 'flag name is invalid' });
    }
    const flag = value[name];
    if (!(typeof flag === 'boolean' || typeof flag === 'string' || typeof flag === 'number')) {
      errors.push({ path: `$.${name}`, code: 'value', message: 'flag value must be a scalar' });
    }
  });
  return { valid: errors.length === 0, errors };
}

function assertFeatureFlagConfig(value) {
  const result = validateFeatureFlagConfig(value);
  if (!result.valid) {
    const error = new Error('feature flag configuration validation failed');
    error.code = 'ERR_FEATURE_FLAG_CONFIG';
    error.errors = result.errors;
    throw error;
  }
  return Object.freeze({ ...value });
}

function resolveFeatureFlag(config, name, fallback = undefined) {
  if (!isPlainObject(config) || typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(config, name)) {
    return fallback;
  }
  return config[name];
}

function createFeatureFlagReader(config = {}) {
  const snapshot = assertFeatureFlagConfig(config);
  return Object.freeze({
    schemaVersion: CONFIG_SCHEMA_VERSION,
    has(name) { return Object.prototype.hasOwnProperty.call(snapshot, name); },
    get(name, fallback) { return resolveFeatureFlag(snapshot, name, fallback); },
    snapshot() { return { ...snapshot }; }
  });
}

module.exports = Object.freeze({
  CONFIG_SCHEMA_VERSION,
  FLAG_NAME_RE,
  validateFeatureFlagConfig,
  assertFeatureFlagConfig,
  resolveFeatureFlag,
  readFeatureFlag: resolveFeatureFlag,
  createFeatureFlagReader
});
