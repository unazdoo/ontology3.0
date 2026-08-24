"use strict";

const crypto = require("node:crypto");
const { fail } = require("./errors");

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value, label = "value") {
  if (value === undefined) fail("INVALID_JSON", `${label} is undefined`);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail("INVALID_JSON", `${label} must be JSON serializable`, { cause: error.message });
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function immutableJson(value, label) {
  return deepFreeze(cloneJson(value, label));
}

function sortedJson(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
      fail("INVALID_JSON", "stable serialization accepts JSON values only");
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      fail("INVALID_JSON", "stable serialization rejects non-finite numbers");
    }
    return value;
  }
  if (seen.has(value)) fail("INVALID_JSON", "stable serialization rejects cyclic values");
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => sortedJson(item, seen))
    : Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedJson(value[key], seen)]));
  seen.delete(value);
  return result;
}

function stableSerialize(value) {
  return JSON.stringify(sortedJson(value));
}

function sha256(value) {
  const input = Buffer.isBuffer(value) || value instanceof Uint8Array
    ? value
    : Buffer.from(typeof value === "string" ? value : stableSerialize(value), "utf8");
  return crypto.createHash("sha256").update(input).digest("hex");
}

function assertObject(value, label) {
  if (!isPlainObject(value)) fail("INVALID_INPUT", `${label} must be an object`);
  return value;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail("INVALID_INPUT", `${label} must be a non-empty string`);
  }
  return value.trim();
}

function assertArray(value, label, options = {}) {
  if (!Array.isArray(value)) fail("INVALID_INPUT", `${label} must be an array`);
  if (options.nonEmpty && value.length === 0) fail("INVALID_INPUT", `${label} must not be empty`);
  return value;
}

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail("INVALID_TIME", "clock returned an invalid time");
  return date.toISOString();
}

function contentId(prefix, value, length = 24) {
  return `${prefix}-${sha256(value).slice(0, length)}`;
}

function sameScenarioRun(left, right) {
  return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"]
    .every((field) => left[field] === right[field]));
}

function assertScenarioRun(value, expected, label = "scenarioContext") {
  assertObject(value, label);
  ["scenarioId", "scenarioVersion", "scenarioRunId"].forEach((field) => assertString(value[field], `${label}.${field}`));
  assertString(value.formedAt, `${label}.formedAt`);
  if (Number.isNaN(Date.parse(value.formedAt))) fail("INVALID_SCENARIO_CONTEXT", `${label}.formedAt must be an RFC 3339 date-time`);
  assertString(value.status, `${label}.status`);
  const versionPrefix = /^([A-Za-z][A-Za-z0-9_-]*)-v/.exec(value.scenarioVersion);
  const runPrefix = /^([A-Za-z][A-Za-z0-9_-]*)-RUN-/.exec(value.scenarioRunId);
  if (versionPrefix && versionPrefix[1] !== value.scenarioId) fail("SCENARIO_CONTEXT_MISMATCH", `${label}.scenarioVersion must belong to scenarioId`);
  if (runPrefix && runPrefix[1] !== value.scenarioId) fail("SCENARIO_CONTEXT_MISMATCH", `${label}.scenarioRunId must belong to scenarioId`);
  if (expected && !sameScenarioRun(value, expected)) {
    fail("SCENARIO_CONTEXT_MISMATCH", `${label} does not belong to the expected scenario run`, {
      expected,
      actual: value
    });
  }
  return value;
}

module.exports = Object.freeze({
  isPlainObject,
  cloneJson,
  deepFreeze,
  immutableJson,
  stableSerialize,
  sha256,
  assertObject,
  assertString,
  assertArray,
  nowIso,
  contentId,
  sameScenarioRun,
  assertScenarioRun
});
