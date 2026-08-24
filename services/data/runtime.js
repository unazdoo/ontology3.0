'use strict';

/**
 * M02 data spine runtime.
 *
 * This module is deliberately storage/framework agnostic.  It supplies the
 * state-machine and gate semantics used by a persistent adapter: records are
 * copied and frozen on ingress, versions are append-only, and every formal
 * run keeps an exact input lock.  It does not inspect or calculate business
 * metrics, rules, scores, or conclusions.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const dataContracts = require('./contracts');

let identity = null;
try {
  // The Foundation package is optional for consumers that only use the pure
  // helpers.  Its canonical context and idempotency primitives are preferred.
  identity = require('../../packages/identity');
} catch (_) {
  identity = null;
}

const SCHEMA_VERSION = dataContracts.DATA_SCHEMA_VERSION;
const DATA_SPINE_CONTRACT_ID = dataContracts.DATA_SPINE_CONTRACT_ID;
const RUNTIME_VERSION = 'implementation-0.1.0';

const STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown'
});

const QUALITY_STATUS = Object.freeze({
  NOT_RUN: 'not-run',
  RUNNING: 'running',
  PASSED: 'passed',
  WARNING: 'warning',
  FAILED: 'failed',
  UNKNOWN: 'unknown'
});

const ERROR_CODES = Object.freeze({
  INVALID_ARGUMENT: 'M02_INVALID_ARGUMENT',
  INVALID_CONTEXT: 'M02_INVALID_CONTEXT',
  NOT_FOUND: 'M02_NOT_FOUND',
  IMMUTABLE: 'M02_IMMUTABLE',
  INVALID_STATE: 'M02_INVALID_STATE',
  DUPLICATE_IDEMPOTENT: 'M02_DUPLICATE_IDEMPOTENT',
  IDEMPOTENCY_CONFLICT: 'M02_IDEMPOTENCY_CONFLICT',
  T008_REQUIRED: 'M02_T008_CONFIRMATION_REQUIRED',
  T008_CONTEXT_MISMATCH: 'M02_T008_CONTEXT_MISMATCH',
  INPUT_UNAVAILABLE: 'M02_INPUT_UNAVAILABLE',
  INPUT_DRIFT: 'M02_INPUT_DRIFT',
  CYCLE: 'M02_CYCLE_REJECTED',
  REUSE_NOT_ALLOWED: 'M02_REUSE_NOT_ALLOWED',
  QUALITY_REQUIRED: 'M02_QUALITY_REQUIRED',
  QUALITY_HARD_FAILURE: 'M02_QUALITY_HARD_FAILURE',
  QUALITY_UNKNOWN: 'M02_QUALITY_UNKNOWN',
  WARNING_ACK_REQUIRED: 'M02_WARNING_ACK_REQUIRED',
  CONTEXT_MISMATCH: 'M02_CONTEXT_MISMATCH',
  S003_NOT_CONSUMABLE: 'M02_S003_NOT_CONSUMABLE',
  RETRY_DRIFT: 'M02_RETRY_DRIFT',
  DELIVERY_BLOCKED: 'M02_DELIVERY_BLOCKED',
  C003_REACCEPTANCE_UNSPECIFIED: 'M02_C003_REACCEPTANCE_UNSPECIFIED',
  CYCLE_REJECTED: 'M02_CYCLE_REJECTED',
  HARD_QUALITY_FAILURE: 'M02_QUALITY_HARD_FAILURE',
  T008_CONFIRMATION_REQUIRED: 'M02_T008_CONFIRMATION_REQUIRED',
  S003_NON_CONSUMABLE: 'M02_S003_NOT_CONSUMABLE'
});

class DataRuntimeError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'DataRuntimeError';
    this.code = code;
    this.details = details || null;
    this.errors = details || [];
  }
}

function fail(code, message, details) {
  throw new DataRuntimeError(code, message, details);
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

function nonEmpty(value, label) {
  if (!text(value)) fail(ERROR_CODES.INVALID_ARGUMENT, `${label || 'value'} must be a non-empty string`);
  return value.trim();
}

function clone(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (seen.has(value)) fail(ERROR_CODES.INVALID_ARGUMENT, 'cyclic values are not supported');
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

function sorted(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'fingerprints only accept JSON values');
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'fingerprints reject non-finite numbers');
    }
    return value;
  }
  if (seen.has(value)) fail(ERROR_CODES.INVALID_ARGUMENT, 'fingerprints reject cyclic values');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map((item) => sorted(item, seen));
  else {
    result = {};
    Object.keys(value).sort().forEach((key) => { result[key] = sorted(value[key], seen); });
  }
  seen.delete(value);
  return result;
}

function withoutUndefined(value, seen = new WeakSet()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) fail(ERROR_CODES.INVALID_ARGUMENT, 'fingerprints reject cyclic values');
  seen.add(value);
  let result;
  if (Array.isArray(value)) {
    result = value.map((item) => {
      const normalized = withoutUndefined(item, seen);
      return normalized === undefined ? null : normalized;
    });
  } else {
    result = {};
    Object.keys(value).forEach((key) => {
      const normalized = withoutUndefined(value[key], seen);
      if (normalized !== undefined) result[key] = normalized;
    });
  }
  seen.delete(value);
  return result;
}

function stableSerialize(value) {
  const normalized = withoutUndefined(value);
  if (identity && typeof identity.stableSerialize === 'function') {
    try {
      return identity.stableSerialize(normalized);
    } catch (_) {
      // Foundation's strict serializer rejects undefined/function values;
      // normalized JSON remains deterministic for runtime idempotency.
    }
  }
  return JSON.stringify(sorted(normalized));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');
}

function contentFingerprint(value) {
  const bytes = Buffer.isBuffer(value)
    ? Buffer.from(value)
    : typeof value === 'string'
      ? Buffer.from(value, 'utf8')
      : Buffer.from(stableSerialize(value), 'utf8');
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function immutable(value) {
  const copied = clone(value);
  const freeze = (item, seen = new WeakSet()) => {
    if (!item || typeof item !== 'object' || seen.has(item) || Object.isFrozen(item)) return item;
    if (Buffer.isBuffer(item)) return item;
    seen.add(item);
    Reflect.ownKeys(item).forEach((key) => freeze(item[key], seen));
    return Object.freeze(item);
  };
  return freeze(copied);
}

function nowIso(value) {
  const date = value === undefined ? new Date() : value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) fail(ERROR_CODES.INVALID_ARGUMENT, 'invalid timestamp');
  return date.toISOString();
}

function contextFrom(value) {
  if (isRecord(value) && isRecord(value.scenarioContext)) return value.scenarioContext;
  return value;
}

function validateContext(value) {
  const context = contextFrom(value);
  if (identity && typeof identity.validateScenarioContext === 'function') {
    const result = identity.validateScenarioContext(context);
    if (!result.valid) fail(ERROR_CODES.INVALID_CONTEXT, 'invalid C033 scenario context', result.errors);
    return immutable(context);
  }
  if (!isRecord(context)) fail(ERROR_CODES.INVALID_CONTEXT, 'scenarioContext must be an object');
  ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'].forEach((key) => nonEmpty(context[key], `scenarioContext.${key}`));
  if (Number.isNaN(Date.parse(context.formedAt))) fail(ERROR_CODES.INVALID_CONTEXT, 'scenarioContext.formedAt is invalid');
  return immutable(context);
}

function requireActiveContext(value) {
  const context = validateContext(value);
  if (['inactive', 'unknown', 'disabled', 'stopped', 'archived'].includes(String(context.status).toLowerCase())) {
    fail(ERROR_CODES.INVALID_CONTEXT, 'scenario context is not active for a new write', { status: context.status });
  }
  return context;
}

function sameRunContext(left, right) {
  const a = contextFrom(left);
  const b = contextFrom(right);
  return Boolean(a && b && a.scenarioId === b.scenarioId
    && a.scenarioVersion === b.scenarioVersion && a.scenarioRunId === b.scenarioRunId);
}

function sameExactContext(left, right) {
  const a = validateContext(left);
  const b = validateContext(right);
  return ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status']
    .every((field) => a[field] === b[field]);
}

function requireExactContext(expected, actual, message) {
  if (!sameExactContext(expected, actual)) fail(ERROR_CODES.CONTEXT_MISMATCH, message || 'C033 context must match exactly');
  return validateContext(actual);
}

function sameScenarioDefinition(left, right) {
  const a = contextFrom(left);
  const b = contextFrom(right);
  return Boolean(a && b && a.scenarioId === b.scenarioId && a.scenarioVersion === b.scenarioVersion);
}

function makeId(prefix, value, options = {}) {
  if (typeof options.idFactory === 'function') return nonEmpty(options.idFactory(prefix, value), `${prefix} id`);
  const suffix = fingerprint({ prefix, value, nonce: options.nonce || crypto.randomUUID() }).slice(0, 20);
  return `${prefix}-${suffix}`;
}

function requestKey(request, supplied) {
  if (text(supplied)) return supplied.trim();
  // Foundation's generic key intentionally hashes a small envelope field
  // allow-list.  M02 operation keys must also bind pipeline/version/purpose
  // and resource IDs, so use the complete canonical request here.
  return `idem-v1:${fingerprint(request)}`;
}

function inputKind(input) {
  if (!isRecord(input)) return null;
  const kind = input.kind || input.type || input.resourceType;
  if (kind === 'T002' || kind === 'snapshot' || kind === 'source-snapshot') return 'T002';
  if (kind === 'T007' || kind === 'asset-version' || kind === 'upstream-asset') return 'T007';
  if (input.snapshotId || input.t002Id) return 'T002';
  if (input.assetVersionId || input.t007Id || input.versionId) return 'T007';
  return kind;
}

function inputId(input) {
  return input.snapshotId || input.t002Id || input.assetVersionId || input.t007Id || input.versionId || input.refId;
}

function normalizeMembers(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(ERROR_CODES.INVALID_ARGUMENT, 'memberIds must be an array');
  const members = value.map((item) => {
    if (text(item)) return item.trim();
    if (isRecord(item)) return nonEmpty(item.memberId || item.id || item.name, 'member id');
    fail(ERROR_CODES.INVALID_ARGUMENT, 'member must be a string or object');
  });
  if (new Set(members).size !== members.length) fail(ERROR_CODES.INVALID_ARGUMENT, 'memberIds must be unique');
  return members;
}

function sortedUnique(values) {
  return [...new Set((values || []).filter(Boolean))].sort();
}

// `lockedAt` is an audit timestamp, not an input identity. Retries resolve the
// same immutable sources again and must compare semantic locks only.
function semanticLocks(locks) {
  return (locks || []).map((lock) => {
    const copy = { ...lock };
    delete copy.lockedAt;
    return copy;
  });
}

function contentInputIdentity(locks) {
  return (locks || []).map((lock) => ({
    slotId: lock.slotId,
    kind: lock.kind,
    contentHash: lock.contentHash || null,
    contentFingerprint: lock.contentFingerprint || null,
    assetId: lock.assetId || null,
    assetVersionId: lock.assetVersionId || null,
    memberIds: lock.memberIds || []
  }));
}

function pipelineIdentity(pipeline) {
  const copy = clone(pipeline);
  delete copy.status;
  delete copy.publishedAt;
  delete copy.publishedBy;
  return copy;
}

function normalizeCheck(check, index) {
  if (!isRecord(check)) fail(ERROR_CODES.INVALID_ARGUMENT, `quality check ${index} must be an object`);
  const id = nonEmpty(check.ruleId || check.checkId || `check-${index + 1}`, 'quality check id');
  const status = String(check.status || (check.passed === true ? 'pass' : check.passed === false ? 'fail' : 'unknown')).toLowerCase();
  const normalizedStatus = status === 'pass' || status === 'passed' || status === 'ok'
    ? 'passed' : status === 'warn' || status === 'warning' ? 'warning'
      : status === 'fail' || status === 'failed' || status === 'error' ? 'failed' : 'unknown';
  const hard = check.hard === true || check.blocking === true || check.severity === 'hard' || check.severity === 'error';
  const failedCount = Number.isFinite(check.failedCount) ? check.failedCount : (normalizedStatus === 'failed' ? 1 : 0);
  return {
    ruleId: id,
    ruleVersion: check.ruleVersion || null,
    status: normalizedStatus,
    hard,
    blocking: hard && (normalizedStatus === 'failed' || normalizedStatus === 'unknown'),
    checkedCount: Number.isFinite(check.checkedCount) ? check.checkedCount : null,
    failedCount,
    warningCount: Number.isFinite(check.warningCount) ? check.warningCount : (normalizedStatus === 'warning' ? 1 : 0),
    affectedMembers: normalizeMembers(check.affectedMembers || check.memberIds),
    evidenceRef: check.evidenceRef ? clone(check.evidenceRef) : null,
    reason: check.reason || null,
    recovery: check.recovery || check.recoveryAdvice || null
  };
}

function evaluateQualityChecks(checks, options = {}) {
  if (!Array.isArray(checks)) fail(ERROR_CODES.INVALID_ARGUMENT, 'quality checks must be an array');
  const normalized = checks.map(normalizeCheck);
  const hardFailures = normalized.filter((check) => check.hard && check.status === 'failed');
  const hardUnknown = normalized.filter((check) => check.hard && check.status === 'unknown');
  const warnings = normalized.filter((check) => check.status === 'warning');
  const softFailures = normalized.filter((check) => !check.hard && check.status === 'failed');
  let status = QUALITY_STATUS.PASSED;
  if (hardFailures.length > 0) status = QUALITY_STATUS.FAILED;
  else if (hardUnknown.length > 0 || normalized.some((check) => check.status === 'unknown')) status = QUALITY_STATUS.UNKNOWN;
  else if (warnings.length > 0 || softFailures.length > 0) status = QUALITY_STATUS.WARNING;
  const result = {
    schemaVersion: SCHEMA_VERSION,
    qualityId: options.qualityId || makeId('T005', { checks: normalized, runId: options.runId }),
    runId: options.runId || null,
    status,
    hardFailure: hardFailures.length > 0,
    hardUnknown: hardUnknown.length > 0,
    executionStatus: options.executionStatus || 'completed',
    checks: normalized,
    summary: {
      checkCount: normalized.length,
      hardFailureCount: hardFailures.length,
      unknownCount: hardUnknown.length || normalized.filter((check) => check.status === 'unknown').length,
      warningCount: warnings.length + softFailures.length,
      failedCount: normalized.filter((check) => check.status === 'failed').length,
      allowedToPublish: status === QUALITY_STATUS.PASSED || status === QUALITY_STATUS.WARNING,
      hardFailure: hardFailures.length > 0,
      hardUnknown: hardUnknown.length > 0
    },
    formedAt: nowIso(options.formedAt)
  };
  return immutable(result);
}

/** Execute caller-owned structural checks; this does not define business rules. */
function runQualityChecks(output, definitions, options = {}) {
  if (!Array.isArray(definitions)) fail(ERROR_CODES.INVALID_ARGUMENT, 'quality check definitions must be an array');
  const checks = definitions.map((definition, index) => {
    if (!isRecord(definition) || typeof definition.evaluate !== 'function') {
      fail(ERROR_CODES.INVALID_ARGUMENT, `quality check ${index} must provide an evaluate function`);
    }
    try {
      const result = definition.evaluate(output);
      if (typeof result === 'boolean') return { checkId: definition.checkId || definition.ruleId || `check-${index + 1}`, status: result ? 'passed' : 'failed', hard: definition.hard === true, reason: result ? null : definition.reason || 'check returned false' };
      return { ...clone(result || {}), checkId: definition.checkId || definition.ruleId || `check-${index + 1}`, hard: definition.hard === true || result?.hard === true };
    } catch (error) {
      return { checkId: definition.checkId || definition.ruleId || `check-${index + 1}`, status: 'unknown', hard: definition.hard === true, reason: error.message, recovery: definition.recovery || null };
    }
  });
  return evaluateQualityChecks(checks, options);
}

/** Return a cycle report for a directed resource graph without mutating it. */
function detectCycle(graph) {
  const adjacency = graph instanceof Map ? graph : new Map(Object.entries(graph || {}).map(([key, value]) => [key, Array.isArray(value) ? value : []]));
  const visiting = new Set();
  const visited = new Set();
  const path = [];
  let cycle = null;
  const visit = (node) => {
    if (cycle) return;
    if (visiting.has(node)) {
      const index = path.indexOf(node);
      cycle = path.slice(index).concat(node);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    path.push(node);
    const next = adjacency.get(node) || [];
    next.forEach((child) => visit(child));
    path.pop();
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of adjacency.keys()) visit(node);
  return cycle ? { hasCycle: true, cycle } : { hasCycle: false, cycle: [] };
}

function assertAcyclic(graph) {
  const report = detectCycle(graph);
  if (report.hasCycle) fail(ERROR_CODES.CYCLE, 'resource dependency cycle rejected', report);
  return report;
}

function normalizePipelineGraph(input = {}) {
  const nodes = Array.isArray(input.nodes) ? input.nodes.map((node, index) => {
    if (!isRecord(node)) fail(ERROR_CODES.INVALID_ARGUMENT, `pipeline node ${index} must be an object`);
    return {
      id: nonEmpty(node.id || node.nodeId || `node-${index + 1}`, 'pipeline node id'),
      type: String(node.type || node.kind || '').toLowerCase(),
      slotId: node.slotId || node.inputSlot || null
    };
  }) : [];
  const rawEdges = Array.isArray(input.edges) ? input.edges : Array.isArray(input.graph) ? input.graph : null;
  const adjacency = new Map();
  nodes.forEach((node) => adjacency.set(node.id, []));
  if (rawEdges) {
    rawEdges.forEach((edge, index) => {
      if (!isRecord(edge)) fail(ERROR_CODES.INVALID_ARGUMENT, `pipeline edge ${index} must be an object`);
      const from = nonEmpty(edge.from || edge.source || edge.sourceId, 'edge source');
      const to = nonEmpty(edge.to || edge.target || edge.targetId, 'edge target');
      if (!adjacency.has(from)) adjacency.set(from, []);
      if (!adjacency.has(to)) adjacency.set(to, []);
      adjacency.get(from).push(to);
    });
  } else if (isRecord(input.graph)) {
    Object.entries(input.graph).forEach(([from, targets]) => {
      if (!adjacency.has(from)) adjacency.set(from, []);
      const list = Array.isArray(targets) ? targets : [];
      list.forEach((to) => {
        const target = isRecord(to) ? (to.to || to.target || to.id) : to;
        if (!text(target)) fail(ERROR_CODES.INVALID_ARGUMENT, `edge target from ${from} is invalid`);
        if (!adjacency.has(target)) adjacency.set(target, []);
        adjacency.get(from).push(target);
      });
    });
  }
  const cycle = detectCycle(adjacency);
  if (cycle.hasCycle) fail(ERROR_CODES.CYCLE, 'pipeline graph contains a cycle', cycle);
  if (nodes.length) {
    const typeOf = (node) => node.type.replace(/[_-]/g, '');
    const sources = nodes.filter((node) => ['source', 'datasource', 't001', 't002'].includes(typeOf(node)));
    const python = nodes.filter((node) => ['python', 'processor', 't004'].includes(typeOf(node)));
    const checks = nodes.filter((node) => ['quality', 'check', 'datacheck', 't005'].includes(typeOf(node)));
    const publish = nodes.filter((node) => ['publish', 'assetpublish', 't007'].includes(typeOf(node)));
    if (!sources.length || python.length !== 1 || checks.length !== 1 || publish.length !== 1) {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'pipeline must contain 1..n sources and exactly one Python, quality and publish node', { sources: sources.length, python: python.length, checks: checks.length, publish: publish.length });
    }
    const refresh = nodes.filter((node) => ['refresh', 'submitrefresh', 'c028'].includes(typeOf(node)));
    if (refresh.length > 1) fail(ERROR_CODES.INVALID_ARGUMENT, 'pipeline can contain at most one refresh node');
    // The first stage is fan-in only; everything after Python is a single chain.
    for (const node of nodes) {
      const outgoing = adjacency.get(node.id) || [];
      if (!python.some((candidate) => candidate.id === node.id) && outgoing.length > 1) {
        fail(ERROR_CODES.INVALID_ARGUMENT, 'pipeline branches are not allowed after the Python node', { nodeId: node.id });
      }
    }
    const nextOf = (node) => adjacency.get(node.id) || [];
    const hasEdge = (from, to) => nextOf(from).includes(to.id);
    const py = python[0];
    const check = checks[0];
    const pub = publish[0];
    if (!hasEdge(py, check) || !hasEdge(check, pub)) {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'pipeline must keep the Python -> quality -> publish order');
    }
    for (const source of sources) if (!hasEdge(source, py)) {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'every source node must connect to the single Python node', { sourceId: source.id });
    }
    if (refresh.length && !hasEdge(pub, refresh[0])) {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'refresh node must follow the publish node', { refreshNodeId: refresh[0].id });
    }
  }
  return { nodes, edges: [...adjacency.entries()].flatMap(([from, targets]) => targets.map((to) => ({ from, to }))), adjacency };
}

class DataPipelineRuntime {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date());
    this.idFactory = options.idFactory;
    this.sources = new Map();
    this.snapshots = new Map();
    this.pipelines = new Map();
    this.pipelineVersions = new Map();
    this.runs = new Map();
    this.quality = new Map();
    this.assets = new Map(); // T006 logical asset records
    this.assetVersions = new Map(); // T007 immutable versions
    this.assetVersionOrder = new Map();
    this.assetDependencies = new Map();
    this.t008Confirmations = new Map();
    this.t008ReadEvents = new Map();
    this.readEvents = new Map();
    this.idempotency = new Map();
    this.deliveryRecords = new Map();
    this.c032Responses = new Map();
    this.c032Sequence = 0;
    this.refreshRequests = new Map();
    this.refreshResults = new Map();
    this.refreshResultHistory = new Map();
    this.c017Reads = new Map();
    this.c017Summaries = new Map();
    this.c017VersionBoundByAssetVersion = new Map();
    this.c017CurrentByAssetVersion = new Map();
    this.events = new Map();
    this.postPublishFindings = new Map();
    this.candidateOutcomes = new Map();
  }

  _now(value) {
    return nowIso(value === undefined ? this.clock() : value);
  }

  _id(prefix, value) {
    return makeId(prefix, value, { idFactory: this.idFactory, nonce: this._now() });
  }

  _put(map, key, value) {
    if (map.has(key)) fail(ERROR_CODES.INVALID_STATE, `duplicate identifier ${key}`);
    const frozen = immutable(value);
    map.set(key, frozen);
    return frozen;
  }

  _get(map, id, type) {
    const value = map.get(id);
    if (!value) fail(ERROR_CODES.NOT_FOUND, `${type || 'resource'} ${id} was not found`, { id, type });
    return value;
  }

  _rememberIdempotent(operation, key, request, value) {
    const mapKey = `${operation}:${key}`;
    const requestFingerprint = fingerprint(request);
    const prior = this.idempotency.get(mapKey);
    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint) {
        fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'same idempotency key was used for a different request', {
          operation, idempotencyKey: key, existingFingerprint: prior.requestFingerprint, requestFingerprint
        });
      }
      return { duplicate: true, value: prior.value };
    }
    this.idempotency.set(mapKey, { requestFingerprint, value });
    return { duplicate: false, value };
  }

  _contextMatchesRun(context, runContext) {
    if (!sameRunContext(context, runContext)) fail(ERROR_CODES.CONTEXT_MISMATCH, 'record does not belong to the active scenario run');
  }

  /** Register a stable T001 source.  Scenario identity is intentionally absent. */
  registerSource(input = {}) {
    const sourceId = nonEmpty(input.sourceId || input.t001Id || this._id('T001', input.name || input), 'sourceId');
    if (this.sources.has(sourceId)) {
      const existing = this.sources.get(sourceId);
      const requested = {
        sourceId,
        name: input.name || existing.name,
        sourceType: input.sourceType || input.kind || existing.sourceType,
        sourceVersion: input.sourceVersion || input.version || existing.sourceVersion,
        category: input.category || input.sourceType || input.kind || existing.category,
        readMethod: input.readMethod || input.accessMode || existing.readMethod,
        accessMode: input.accessMode || existing.accessMode,
        status: input.status || existing.status,
        metadata: input.metadata === undefined ? existing.metadata : input.metadata
      };
      if (fingerprint({
        name: existing.name, sourceType: existing.sourceType, sourceVersion: existing.sourceVersion, accessMode: existing.accessMode,
        category: existing.category, readMethod: existing.readMethod, status: existing.status, metadata: existing.metadata
      }) !== fingerprint({
        name: requested.name, sourceType: requested.sourceType, sourceVersion: requested.sourceVersion, accessMode: requested.accessMode,
        category: requested.category, readMethod: requested.readMethod, status: requested.status, metadata: requested.metadata
      })) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'T001 source id identifies different source metadata', { sourceId });
      return existing;
    }
    if (input.scenarioId !== undefined || input.scenarioRunId !== undefined || input.scenarioContext !== undefined) {
      fail(ERROR_CODES.INVALID_ARGUMENT, 'scenario context is not part of T001 identity');
    }
    const source = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T001',
      sourceId,
      name: nonEmpty(input.name || sourceId, 'source name'),
      idempotencyKey: `t001:${sourceId}`,
      description: input.description || null,
      sourceType: input.sourceType || input.kind || 'manual-upload',
      sourceVersion: input.sourceVersion || input.version || 'v1',
      category: input.category || input.sourceType || input.kind || 'manual-upload',
      readMethod: input.readMethod || input.accessMode || 'manual-upload',
      accessMode: input.accessMode || null,
      status: input.status || 'active',
      registeredAt: this._now(input.registeredAt),
      // Deliberately no scenarioId/scenarioRunId: C033 is run context, not source identity.
      metadata: input.metadata ? clone(input.metadata) : null
    };
    return this._put(this.sources, sourceId, source);
  }

  getSource(sourceId) { return this._get(this.sources, sourceId, 'T001'); }
  registerT001(input) { return this.registerSource(input); }
  registerDataSource(input) { return this.registerSource(input); }

  /** Read a real local source once and register the resulting immutable T002. */
  captureFile(sourceId, filePath, input = {}) {
    const source = this.getSource(sourceId);
    if (!text(filePath) || !path.isAbsolute(filePath)) fail(ERROR_CODES.INVALID_ARGUMENT, 'captureFile requires an absolute file path');
    let stat;
    let content;
    try {
      stat = fs.statSync(filePath);
      if (!stat.isFile()) fail(ERROR_CODES.INVALID_ARGUMENT, 'captureFile target is not a regular file');
      content = fs.readFileSync(filePath);
    } catch (error) {
      if (error instanceof DataRuntimeError) throw error;
      fail(ERROR_CODES.INPUT_UNAVAILABLE, `source file could not be read: ${error.message}`, { sourceId, filePath });
    }
    return this.createSnapshot({
      ...input,
      sourceId: source.sourceId,
      content,
      fileName: input.fileName || path.basename(filePath),
      byteLength: stat.size,
      readAt: input.readAt || this._now(),
      contentRef: input.contentRef || { storage: 'caller-owned', fingerprint: contentFingerprint(content) }
    });
  }

  ingestFile(sourceId, filePath, input) { return this.captureFile(sourceId, filePath, input); }

  discoverDirectory(sourceId, directoryPath, input = {}) {
    if (!text(directoryPath) || !path.isAbsolute(directoryPath)) fail(ERROR_CODES.INVALID_ARGUMENT, 'discoverDirectory requires an absolute directory path');
    let names;
    try { names = fs.readdirSync(directoryPath).sort(); } catch (error) { fail(ERROR_CODES.INPUT_UNAVAILABLE, `source directory could not be read: ${error.message}`, { directoryPath }); }
    const pattern = input.pattern instanceof RegExp ? input.pattern : null;
    return names.filter((name) => {
      if (!pattern) return true;
      pattern.lastIndex = 0;
      return pattern.test(name);
    }).map((name) => this.captureFile(sourceId, path.join(directoryPath, name), input));
  }

  /** Record the actual read and create an immutable T002 snapshot. */
  createSnapshot(input = {}) {
    const sourceId = nonEmpty(input.sourceId || input.t001Id, 'sourceId');
    this._get(this.sources, sourceId, 'T001');
    const content = input.content !== undefined ? input.content : input.bytes;
    if (content === undefined || content === null) fail(ERROR_CODES.INVALID_ARGUMENT, 'snapshot content is required');
    const raw = Buffer.isBuffer(content) ? Buffer.from(content) : typeof content === 'string' ? Buffer.from(content) : Buffer.from(stableSerialize(content));
    const actualHash = crypto.createHash('sha256').update(raw).digest('hex');
    const contentHash = input.contentHash || actualHash;
    if (!/^[a-f0-9]{64}$/i.test(contentHash)) fail(ERROR_CODES.INVALID_ARGUMENT, 'contentHash must be a SHA-256 hex digest');
    if (String(contentHash).toLowerCase() !== actualHash) fail(ERROR_CODES.INPUT_DRIFT, 'supplied contentHash does not match the bytes actually read', { expected: actualHash, supplied: contentHash });
    const readAt = this._now(input.readAt || input.readEvent?.readAt);
    const explicitSnapshotId = input.snapshotId || input.t002Id;
    const duplicate = [...this.snapshots.values()].find((snapshot) => snapshot.sourceId === sourceId && snapshot.contentHash === contentHash);
    // A repeated read of identical content is idempotent at the T002 content
    // boundary.  It still receives a new read event (and may receive a new
    // C033/T008 confirmation) but does not create a second raw snapshot unless
    // the caller explicitly supplies a new snapshot identity.
    if (duplicate && !explicitSnapshotId) {
      this.recordReadEvent(duplicate.snapshotId, {
        readAt,
        observedHash: contentHash,
        byteLength: raw.byteLength,
        sourceId,
        scenarioContext: input.scenarioContext ? validateContext(input.scenarioContext) : duplicate.scenarioContext,
        eventId: input.readEventId
      });
      this._updateSourceSnapshotFacts(sourceId, duplicate.snapshotId, readAt, duplicate.t008 || null);
      return duplicate;
    }
    const snapshotId = nonEmpty(explicitSnapshotId || this._id('T002', { sourceId, contentHash, readAt }), 'snapshotId');
    if (this.snapshots.has(snapshotId)) {
      const existing = this.snapshots.get(snapshotId);
      if (existing.sourceId !== sourceId || existing.contentHash !== contentHash.toLowerCase()) {
        fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'T002 snapshot id identifies different content', { snapshotId });
      }
      this.recordReadEvent(snapshotId, {
        readAt,
        observedHash: contentHash,
        byteLength: raw.byteLength,
        sourceId,
        scenarioContext: input.scenarioContext ? validateContext(input.scenarioContext) : existing.scenarioContext,
        eventId: input.readEventId
      });
      return existing;
    }
    const context = input.scenarioContext ? validateContext(input.scenarioContext) : null;
    const snapshot = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T002',
      snapshotId,
      sourceId,
      sourceVersion: this.getSource(sourceId).sourceVersion,
      fileName: input.fileName || null,
      byteLength: raw.byteLength,
      contentHash: contentHash.toLowerCase(),
      contentFingerprint: contentHash.toLowerCase(),
      sha256: contentHash.toLowerCase(),
      idempotencyKey: `t002:${contentHash.toLowerCase()}`,
      bytes: raw.byteLength,
      readAt,
      discoveredAt: input.discoveredAt ? this._now(input.discoveredAt) : readAt,
      status: duplicate ? 'duplicate' : (input.status || 'awaiting-t008'),
      immutable: true,
      duplicateOf: duplicate ? duplicate.snapshotId : null,
      previousSnapshotId: input.previousSnapshotId || null,
      structure: input.structure ? clone(input.structure) : null,
      scenarioContext: context,
      t008ConfirmationId: null,
      t008ConfirmationIds: [],
      t008: null,
      // Content is retained by a real adapter/object store; runtime keeps a
      // defensive copy only when explicitly requested for tests.
      contentRef: input.contentRef || null,
      content: input.retainContent === true ? (Buffer.isBuffer(content) ? Buffer.from(content).toString('base64') : clone(content)) : undefined,
      contentEncoding: input.retainContent === true && Buffer.isBuffer(content) ? 'base64' : null,
      readEventId: null
    };
    const stored = this._put(this.snapshots, snapshotId, snapshot);
    const event = this.recordReadEvent(snapshotId, {
      readAt,
      observedHash: contentHash,
      byteLength: raw.byteLength,
      sourceId,
      scenarioContext: context || undefined,
      eventId: input.readEventId
    });
    const next = { ...stored, readEventId: event.readEventId };
    this.snapshots.set(snapshotId, immutable(next));
    this._updateSourceSnapshotFacts(sourceId, snapshotId, readAt, null);
    return this.snapshots.get(snapshotId);
  }

  _updateSourceSnapshotFacts(sourceId, snapshotId, readAt, asOf) {
    const source = this.getSource(sourceId);
    this.sources.set(sourceId, immutable({
      ...source,
      latestSnapshotId: snapshotId,
      snapshotCount: [...this.snapshots.values()].filter((item) => item.sourceId === sourceId).length,
      lastDiscoveredAt: readAt,
      lastReadAt: readAt,
      lastSuccessfulAt: readAt,
      latestAsOf: asOf || source.latestAsOf || null
    }));
  }

  getSnapshot(snapshotId) { return this._get(this.snapshots, snapshotId, 'T002'); }
  getSnapshotContent(snapshotId) {
    const snapshot = this.getSnapshot(snapshotId);
    if (snapshot.content === undefined) fail(ERROR_CODES.INPUT_UNAVAILABLE, 'raw content is not retained by this runtime adapter');
    return snapshot.contentEncoding === 'base64' ? Buffer.from(snapshot.content, 'base64') : clone(snapshot.content);
  }
  createT002(input) { return this.createSnapshot(input); }
  captureT002(input) { return this.createSnapshot(input); }
  ingestSnapshot(input) { return this.createSnapshot(input); }

  recordReadEvent(snapshotId, input = {}) {
    const snapshot = this._get(this.snapshots, snapshotId, 'T002');
    const readEventId = nonEmpty(input.readEventId || input.eventId || this._id('T002-READ', { snapshotId, at: input.readAt }), 'readEventId');
    const observedHash = String(input.observedHash || snapshot.contentHash).toLowerCase();
    if (observedHash !== snapshot.contentHash) fail(ERROR_CODES.INPUT_DRIFT, 'read event content hash does not match T002', { snapshotId, expected: snapshot.contentHash, observed: observedHash });
    const event = {
      schemaVersion: SCHEMA_VERSION,
      eventType: 'T002.read',
      eventName: 'T002_READ',
      readEventId,
      snapshotId,
      sourceId: snapshot.sourceId,
      readAt: this._now(input.readAt),
      observedHash,
      byteLength: input.byteLength === undefined ? snapshot.byteLength : input.byteLength,
      scenarioContext: input.scenarioContext ? validateContext(input.scenarioContext) : snapshot.scenarioContext,
      actorRef: input.actorRef || null
    };
    if (this.readEvents.has(readEventId)) {
      const existing = this.readEvents.get(readEventId);
      if (fingerprint(existing) !== fingerprint(event)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'read event id conflicts with an existing event');
      return existing;
    }
    const stored = this._put(this.readEvents, readEventId, event);
    this.events.set(readEventId, stored);
    return stored;
  }

  /** Add an explicit T008 confirmation; uploading/reading time never confirms it. */
  confirmAsOf(snapshotId, input = {}) {
    const snapshot = this._get(this.snapshots, snapshotId, 'T002');
    const asOf = nonEmpty(input.asOf || input.t008 || input.asOfAt || input.asOfTime, 'T008 asOf');
    const confirmedBy = nonEmpty(input.confirmedBy || input.actorRef, 'T008 confirmedBy');
    const confirmedAt = this._now(input.confirmedAt);
    const scenarioContext = requireActiveContext(input.scenarioContext || snapshot.scenarioContext);
    if (!scenarioContext) fail(ERROR_CODES.T008_REQUIRED, 'T008 confirmation requires C033 scenario context');
    const readForContext = [...this.readEvents.values()].some((event) => event.snapshotId === snapshotId && event.scenarioContext && sameRunContext(event.scenarioContext, scenarioContext));
    if (!readForContext) fail(ERROR_CODES.T008_CONTEXT_MISMATCH, 'T008 confirmation requires a read event from the same C033 run');
    const priorForContext = (snapshot.t008ConfirmationIds || [snapshot.t008ConfirmationId]).filter(Boolean)
      .map((id) => this.t008Confirmations.get(id)).find((item) => item && sameRunContext(item.scenarioContext, scenarioContext));
    const priorWithDifferentAsOf = (snapshot.t008ConfirmationIds || [snapshot.t008ConfirmationId]).filter(Boolean)
      .map((id) => this.t008Confirmations.get(id)).find((item) => item && item.asOf !== asOf);
    if (priorWithDifferentAsOf) {
      fail(ERROR_CODES.IMMUTABLE, 'a T002 cannot carry conflicting T008 values; create a new T002 for a correction', { snapshotId, existing: priorWithDifferentAsOf.asOf, supplied: asOf });
    }
    if (priorForContext) {
      if (priorForContext.asOf !== asOf) fail(ERROR_CODES.IMMUTABLE, 'T008 for an existing T002/run cannot be changed; create a new T002 for a correction', { snapshotId });
      const requestedBasis = input.basis || input.evidence || 'explicit-user-confirmation';
      const requestedBy = input.confirmedBy || input.actorRef;
      if (priorForContext.confirmedBy !== requestedBy || priorForContext.basis !== requestedBasis) {
        fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'same T008 confirmation context was submitted with different evidence', { snapshotId });
      }
      return priorForContext;
    }
    const confirmationId = nonEmpty(input.confirmationId || input.t008ConfirmationId || this._id('T008', { snapshotId, asOf, scenarioContext }), 'confirmationId');
    const confirmation = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T008',
      confirmationId,
      idempotencyKey: `t008:${fingerprint({ snapshotId, asOf, scenarioContext })}`,
      snapshotId,
      asOf,
      asOfTime: asOf,
      confirmedBy,
      confirmedAt,
      basis: nonEmpty(input.basis || input.evidence || 'explicit-user-confirmation', 'T008 basis'),
      evidenceRefs: input.evidenceRefs ? clone(input.evidenceRefs) : [],
      scenarioContext
    };
    try {
      dataContracts.validateAsOfConfirmation(confirmation);
    } catch (error) {
      fail(ERROR_CODES.T008_REQUIRED, error.message, error.details || error.errors);
    }
    const prior = this.t008Confirmations.get(confirmationId);
    if (prior) {
      if (fingerprint(prior) !== fingerprint(confirmation)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'T008 confirmation id conflicts with an existing confirmation');
      return prior;
    }
    const stored = this._put(this.t008Confirmations, confirmationId, confirmation);
    this.events.set(confirmationId, immutable({
      eventType: 'T008_CONFIRMED',
      eventName: 'T008_CONFIRMED',
      eventId: confirmationId,
      snapshotId,
      asOf: confirmation.asOf,
      confirmedBy: confirmation.confirmedBy,
      confirmedAt: confirmation.confirmedAt,
      scenarioContext: confirmation.scenarioContext
    }));
    const confirmationIds = [...new Set([...(snapshot.t008ConfirmationIds || []), confirmationId])];
    const nextSnapshot = {
      ...snapshot,
      status: 'registered',
      t008ConfirmationId: snapshot.t008ConfirmationId || confirmationId,
      t008ConfirmationIds: confirmationIds,
      t008: snapshot.t008 || asOf,
      t008Confirmation: snapshot.t008Confirmation || confirmation
    };
    this.snapshots.set(snapshotId, immutable(nextSnapshot));
    const source = this.getSource(snapshot.sourceId);
    this.sources.set(snapshot.sourceId, immutable({ ...source, latestAsOf: source.latestSnapshotId === snapshotId ? asOf : source.latestAsOf || asOf }));
    return stored;
  }

  confirmT008(snapshotId, input) { return this.confirmAsOf(snapshotId, input); }
  confirmDataAsOf(snapshotId, input) { return this.confirmAsOf(snapshotId, input); }

  getT008Confirmation(confirmationId) { return this._get(this.t008Confirmations, confirmationId, 'T008'); }

  /** Record a read of the explicit T008 evidence; reading never confirms it. */
  readT008(snapshotId, input = {}) {
    const snapshot = this.getSnapshot(snapshotId);
    const requestedContext = input.scenarioContext ? validateContext(input.scenarioContext) : null;
    const confirmationId = input.confirmationId
      || (snapshot.t008ConfirmationIds || []).find((id) => {
        const candidate = this.t008Confirmations.get(id);
        return candidate && (!requestedContext || sameRunContext(candidate.scenarioContext, requestedContext));
      })
      || snapshot.t008ConfirmationId;
    if (!confirmationId) fail(ERROR_CODES.T008_REQUIRED, 'T008 must be explicitly confirmed before it can be read as authoritative');
    const confirmation = this.getT008Confirmation(confirmationId);
    const context = requestedContext || validateContext(confirmation.scenarioContext);
    if (!sameRunContext(context, confirmation.scenarioContext)) fail(ERROR_CODES.T008_CONTEXT_MISMATCH, 'T008 read context mismatch');
    const readEventId = nonEmpty(input.readEventId || input.eventId || this._id('T008-READ', { snapshotId, confirmationId, context }), 'T008 readEventId');
    const event = {
      schemaVersion: SCHEMA_VERSION,
      eventType: 'T008_READ',
      eventName: 'T008_READ',
      readEventId,
      snapshotId,
      confirmationId,
      asOf: confirmation.asOf,
      readAt: this._now(input.readAt),
      requester: input.requester || input.actorRef || null,
      scenarioContext: context,
      status: 'read'
    };
    const prior = this.t008ReadEvents.get(readEventId);
    if (prior) {
      if (fingerprint(prior) !== fingerprint(event)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'T008 read event id conflict');
      return prior;
    }
    const stored = this._put(this.t008ReadEvents, readEventId, event);
    this.events.set(readEventId, stored);
    return stored;
  }

  recordT008Read(snapshotId, input) { return this.readT008(snapshotId, input); }
  readAsOf(snapshotId, input) { return this.readT008(snapshotId, input); }
  listEvents() { return [...this.events.values()]; }
  listReadEvents(snapshotId) { return [...this.readEvents.values(), ...this.t008ReadEvents.values()].filter((event) => !snapshotId || event.snapshotId === snapshotId); }

  _normalizeInputSlot(slot, index) {
    if (!isRecord(slot)) fail(ERROR_CODES.INVALID_ARGUMENT, `input slot ${index} must be an object`);
    const slotId = nonEmpty(slot.slotId || slot.id || slot.name || `input-${index + 1}`, 'input slot id');
    return {
      slotId,
      name: slot.name || slotId,
      input: slot.input ? clone(slot.input) : clone(slot),
      required: slot.required !== false,
      memberIds: normalizeMembers(slot.memberIds || slot.members)
    };
  }

  createPipeline(input = {}) {
    const pipelineId = nonEmpty(input.pipelineId || input.t003Id || this._id('T003', input.name || input), 'pipelineId');
    const version = input.version || input.pipelineVersion || 'v1';
    const slots = (input.inputSlots || input.inputs || []).map((slot, index) => this._normalizeInputSlot(slot, index));
    if (new Set(slots.map((slot) => slot.slotId)).size !== slots.length) fail(ERROR_CODES.INVALID_ARGUMENT, 'input slots must be unique');
    const outputAssetId = nonEmpty(input.outputAssetId || input.t006Id || input.assetId, 'outputAssetId');
    const graphInput = {
      nodes: input.nodes || input.graph?.nodes,
      edges: Array.isArray(input.edges) ? input.edges : (Array.isArray(input.graph?.edges) ? input.graph.edges : undefined),
      graph: input.graph && !Array.isArray(input.graph) && !input.graph.nodes && !input.graph.edges
        ? input.graph
        : (input.graph?.adjacency || undefined)
    };
    const normalizedGraph = normalizePipelineGraph(graphInput);
    if (input.strictShape === true && !normalizedGraph.nodes.length) fail(ERROR_CODES.INVALID_ARGUMENT, 'strict M02 pipeline definitions require explicit node graph');
    for (const slot of slots) {
      const source = slot.input || slot;
      if (inputKind(source) === 'T007') {
        const upstreamAssetId = source.assetId || source.t006Id;
        if (upstreamAssetId && upstreamAssetId === outputAssetId) {
          fail(ERROR_CODES.CYCLE, 'pipeline output cannot directly consume its own T006', { outputAssetId, slotId: slot.slotId });
        }
        const upstreamVersionId = inputId(source);
        if (upstreamVersionId && this.assetVersions.has(upstreamVersionId)) this._checkInputCycle(outputAssetId, upstreamVersionId);
      }
    }
    const definition = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T003',
      pipelineId,
      pipelineVersion: version,
      pipelineVersionId: version,
      status: STATUS.DRAFT,
      name: nonEmpty(input.name || pipelineId, 'pipeline name'),
      description: input.description || null,
      outputAssetId,
      assetId: outputAssetId,
      inputSlots: slots,
      processingModule: input.processingModule ? clone(input.processingModule) : null,
      qualityChecks: input.qualityChecks ? clone(input.qualityChecks) : [],
      nodes: clone(normalizedGraph.nodes),
      edges: clone(normalizedGraph.edges),
      graph: clone(normalizedGraph.edges),
      scenarioId: input.scenarioId || null,
      createdAt: this._now(input.createdAt),
      publishedAt: null
    };
    const versionKey = `${pipelineId}:${version}`;
    const existingVersion = this.pipelineVersions.get(versionKey);
    if (existingVersion) {
      if (fingerprint(pipelineIdentity(existingVersion)) !== fingerprint(pipelineIdentity(definition))) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'T003 version id identifies a different definition', { pipelineId, version });
      return existingVersion;
    }
    const stored = immutable(definition);
    this.pipelineVersions.set(versionKey, stored);
    // The map entry is the editable/current pointer; historical versions are
    // retained in pipelineVersions and are never rewritten.
    this.pipelines.set(pipelineId, stored);
    return stored;
  }

  getPipeline(pipelineId) { return this._get(this.pipelines, pipelineId, 'T003'); }
  getPipelineVersion(pipelineId, version) { return this._get(this.pipelineVersions, `${pipelineId}:${version}`, 'T003 version'); }
  definePipeline(input) { return this.createPipeline(input); }

  publishPipeline(pipelineId, input = {}) {
    const pipeline = this.getPipeline(pipelineId);
    if (pipeline.status === STATUS.PUBLISHED) return pipeline;
    if (pipeline.status !== STATUS.DRAFT) fail(ERROR_CODES.INVALID_STATE, 'only a draft T003 can be published');
    if (!pipeline.inputSlots.length) fail(ERROR_CODES.INVALID_ARGUMENT, 'a pipeline requires at least one input slot');
    const slotIds = pipeline.inputSlots.map((slot) => slot.slotId);
    if (new Set(slotIds).size !== slotIds.length) fail(ERROR_CODES.INVALID_ARGUMENT, 'input slots must be unique');
    const published = { ...pipeline, status: STATUS.PUBLISHED, publishedAt: this._now(input.publishedAt), publishedBy: input.publishedBy || null };
    this.pipelines.set(pipelineId, immutable(published));
    this.pipelineVersions.set(`${pipelineId}:${published.pipelineVersion}`, this.pipelines.get(pipelineId));
    return this.pipelines.get(pipelineId);
  }
  publishT003(pipelineId, input) { return this.publishPipeline(pipelineId, input); }

  _assetVersionAncestry(assetVersionId, seen = new Set()) {
    if (seen.has(assetVersionId)) return [];
    seen.add(assetVersionId);
    const version = this.assetVersions.get(assetVersionId);
    if (!version) return [];
    const result = [version.assetId];
    for (const dependency of version.inputs || []) {
      if (dependency.kind === 'T007' && dependency.assetVersionId) {
        result.push(...this._assetVersionAncestry(dependency.assetVersionId, seen));
      }
    }
    return result;
  }

  _checkInputCycle(outputAssetId, inputVersionId) {
    if (!outputAssetId || !inputVersionId) return;
    const version = this._get(this.assetVersions, inputVersionId, 'T007');
    if (version.assetId === outputAssetId || this._assetVersionAncestry(inputVersionId).includes(outputAssetId)) {
      fail(ERROR_CODES.CYCLE, 'T007 input would create a direct or indirect asset cycle', { outputAssetId, inputVersionId });
    }
  }

  _latestQualified(assetId) {
    const ids = this.assetVersionOrder.get(assetId) || [];
    const candidates = ids.map((id) => this.assetVersions.get(id)).filter(Boolean).filter((version) => {
      const qualityStatus = version.quality?.status;
      return version.consumption?.compatibilityOnly !== true
        && (qualityStatus === QUALITY_STATUS.PASSED || qualityStatus === QUALITY_STATUS.WARNING)
        && !this._isVersionBlocked(version.assetVersionId);
    });
    return candidates[candidates.length - 1] || null;
  }

  _isVersionBlocked(assetVersionId) {
    return [...this.postPublishFindings.values()].some((finding) => finding.assetVersionId === assetVersionId && finding.status === 'confirmed' && finding.hard === true);
  }

  _resolveInput(slot, context, outputAssetId) {
    const source = slot.input || slot;
    const kind = inputKind(source);
    const id = inputId(source);
    if (kind === 'T002') {
      const snapshot = this.getSnapshot(id);
      const confirmationId = source.t008ConfirmationId
        || (snapshot.t008ConfirmationIds || []).find((id) => {
          const candidate = this.t008Confirmations.get(id);
          return candidate && sameRunContext(candidate.scenarioContext, context);
        })
        || snapshot.t008ConfirmationId;
      if (!confirmationId) fail(ERROR_CODES.T008_REQUIRED, `input slot ${slot.slotId} has no explicit T008 confirmation`, { slotId: slot.slotId, snapshotId: id });
      const confirmation = this.getT008Confirmation(confirmationId);
      if (confirmation.snapshotId !== snapshot.snapshotId) fail(ERROR_CODES.T008_CONTEXT_MISMATCH, 'T008 confirmation belongs to another T002 snapshot', { slotId: slot.slotId, snapshotId: snapshot.snapshotId, confirmationId });
      if (!sameRunContext(confirmation.scenarioContext, context)) fail(ERROR_CODES.T008_CONTEXT_MISMATCH, 'T008 confirmation belongs to another scenario run', { slotId: slot.slotId, confirmationId });
      return {
        slotId: slot.slotId,
        kind: 'T002',
        snapshotId: snapshot.snapshotId,
        contentHash: snapshot.contentHash,
        t008: confirmation.asOf,
        t008ConfirmationId: confirmation.confirmationId,
        readEventId: snapshot.readEventId,
        memberIds: normalizeMembers(source.memberIds || slot.memberIds),
        sourceId: snapshot.sourceId,
        lockedAt: this._now()
      };
    }
    if (kind === 'T007') {
      let version;
      const mode = source.mode || source.versionMode || (source.followLatest ? 'follow-latest' : 'fixed');
      if (mode === 'follow-latest' || source.followLatest === true) {
        const assetId = nonEmpty(source.assetId || source.t006Id, 'follow-latest assetId');
        version = this._latestQualified(assetId);
        if (!version) fail(ERROR_CODES.INPUT_UNAVAILABLE, `no qualified T007 exists for ${assetId}`, { assetId });
      } else {
        version = this._get(this.assetVersions, id, 'T007');
      }
      if (version.consumption?.compatibilityOnly === true || version.scenarioContext?.scenarioId === 'S003' && version.consumption?.consumable === false) {
        fail(ERROR_CODES.S003_NOT_CONSUMABLE, 'the current S003 compatibility T007 is permanently non-consumable', { assetVersionId: version.assetVersionId });
      }
      if (!sameScenarioDefinition(version.scenarioContext, context)
          && source.allowCrossScenarioReuse !== true
          && version.reuseLicense?.crossScenario !== true) {
        fail(ERROR_CODES.CONTEXT_MISMATCH, 'upstream T007 scenario definition does not match the active C033 context', { assetVersionId: version.assetVersionId });
      }
      this._checkInputCycle(outputAssetId, version.assetVersionId);
      const license = version.reuseLicense || {};
      if (license.allowed !== true && source.allowUnlicensed !== true) {
        fail(ERROR_CODES.REUSE_NOT_ALLOWED, 'T007 reuse requires an explicit publish-time license', { assetVersionId: version.assetVersionId });
      }
      const requiredConditions = ['fields', 'grain', 'stableKeys', 'quality', 'retention', 'access'];
      if (source.requiredReuseConditions) {
        for (const condition of requiredConditions) {
          if (source.requiredReuseConditions[condition] !== undefined
              && stableSerialize(source.requiredReuseConditions[condition]) !== stableSerialize(license[condition])) {
            fail(ERROR_CODES.REUSE_NOT_ALLOWED, `T007 reuse ${condition} condition does not match its publish-time license`, { assetVersionId: version.assetVersionId, condition });
          }
        }
      }
      const memberIds = normalizeMembers(source.memberIds || source.members || slot.memberIds);
      const availableMembers = (version.members || []).map((member) => member.memberId || member.id || member.name).filter(Boolean);
      if (memberIds.length && memberIds.some((memberId) => !availableMembers.includes(memberId))) {
        fail(ERROR_CODES.INPUT_UNAVAILABLE, 'requested T007 member is not present in the locked version', { memberIds, availableMembers });
      }
      return {
        slotId: slot.slotId,
        kind: 'T007',
        assetId: version.assetId,
        assetVersionId: version.assetVersionId,
        contentFingerprint: version.contentFingerprint,
        t008: version.t008,
        memberIds: memberIds.length ? memberIds : availableMembers,
        reuseLicense: clone({
          allowed: license.allowed === true,
          fields: license.fields || null,
          grain: license.grain || null,
          stableKeys: license.stableKeys || null,
          quality: license.quality || null,
          retention: license.retention || null,
          access: license.access || null,
          cycleCheck: 'passed'
        }),
        sourceContext: clone(version.scenarioContext),
        lockedAt: this._now()
      };
    }
    fail(ERROR_CODES.INVALID_ARGUMENT, `input slot ${slot.slotId} has an unsupported input kind`, { kind, input: source });
  }

  _assertRunIdempotency(request, suppliedKey, operation = 'run') {
    const key = requestKey(request, suppliedKey);
    const mapKey = `${operation}:${key}`;
    const requestFingerprint = fingerprint(request);
    const prior = this.idempotency.get(mapKey);
    if (prior) {
      if (prior.requestFingerprint !== requestFingerprint) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'idempotency key conflicts with a different run request', { key, operation });
      return { key, duplicate: true, existing: this.runs.get(prior.value) || prior.value };
    }
    return { key, duplicate: false, requestFingerprint };
  }

  /** Lock exact T002/T007 inputs at the start of a formal run. */
  startRun(pipelineId, input = {}) {
    const pipeline = input.pipelineVersion || input.pipelineVersionId
      ? this.getPipelineVersion(pipelineId, input.pipelineVersion || input.pipelineVersionId)
      : this.getPipeline(pipelineId);
    if (pipeline.status !== STATUS.PUBLISHED) fail(ERROR_CODES.INVALID_STATE, 'formal runs require a published T003');
    const scenarioContext = requireActiveContext(input.scenarioContext);
    const request = {
      operation: 'formal-run',
      pipelineId,
      pipelineVersion: pipeline.pipelineVersion,
      processingModule: clone(pipeline.processingModule || null),
      processingModuleVersion: pipeline.processingModule?.version || pipeline.processingModule?.moduleVersion || null,
      scenarioContext,
      inputSlots: pipeline.inputSlots,
      trigger: input.trigger || 'manual',
      retryOf: input.retryOf || null,
      runNonce: input.runNonce || null
    };
    const locks = pipeline.inputSlots.map((slot) => this._resolveInput(slot, scenarioContext, pipeline.outputAssetId));
    request.inputLocks = semanticLocks(locks);
    const idem = this._assertRunIdempotency(request, input.idempotencyKey, 'run');
    if (idem.duplicate) return idem.existing;
    const lockedAsOfValues = [...new Set(locks.map((lock) => lock.t008).filter((value) => text(value)))];
    if (lockedAsOfValues.length > 1) fail(ERROR_CODES.INPUT_DRIFT, 'formal inputs must agree on one T008 for an atomic T007', { lockedAsOfValues });
    const runId = nonEmpty(input.runId || this._id('RUN', { pipelineId, scenarioContext, locks, runNonce: input.runNonce || null, retryOf: input.retryOf || null }), 'runId');
    const priorForRetry = input.retryOf ? this._get(this.runs, input.retryOf, 'run') : null;
    if (priorForRetry) {
      if (!sameRunContext(priorForRetry.scenarioContext, scenarioContext)) fail(ERROR_CODES.RETRY_DRIFT, 'retry must use the same C033 run context');
      if (fingerprint(semanticLocks(priorForRetry.inputLocks)) !== fingerprint(semanticLocks(locks))) fail(ERROR_CODES.RETRY_DRIFT, 'retry input locks would drift');
      if (priorForRetry.pipelineId !== pipelineId || priorForRetry.pipelineVersion !== pipeline.pipelineVersion) fail(ERROR_CODES.RETRY_DRIFT, 'retry pipeline version would drift');
    }
    const run = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'formal-run',
      runId,
      pipelineId,
      pipelineVersion: pipeline.pipelineVersion,
      outputAssetId: pipeline.outputAssetId,
      scenarioContext,
      trigger: input.trigger || 'manual',
      startedAt: this._now(input.startedAt),
      endedAt: null,
      status: STATUS.RUNNING,
      executionState: 'running',
      closedLoopResult: 'not-published',
      nodeTimeline: [],
      inputLocks: locks,
      inputLockFingerprint: fingerprint(semanticLocks(locks)),
      t008ConfirmationIds: locks.filter((lock) => lock.t008ConfirmationId).map((lock) => lock.t008ConfirmationId),
      retryOf: input.retryOf || null,
      attempt: priorForRetry ? (priorForRetry.attempt || 1) + 1 : 1,
      qualityId: null,
      qualityStatus: QUALITY_STATUS.NOT_RUN,
      candidateAssetVersionId: null,
      failure: null,
      fallback: this._fallbackState(pipeline.outputAssetId)
    };
    const stored = this._put(this.runs, runId, run);
    this.idempotency.set(`run:${idem.key}`, { requestFingerprint: idem.requestFingerprint, value: runId });
    return stored;
  }

  beginRun(pipelineId, input) { return this.startRun(pipelineId, input); }
  startFormalRun(pipelineId, input) { return this.startRun(pipelineId, input); }

  _fallbackState(assetId) {
    const current = this._latestQualified(assetId);
    return {
      preserved: true,
      assetId,
      currentTrustedVersionId: current ? current.assetVersionId : null,
      latestQualifiedVersionId: this._latestQualified(assetId)?.assetVersionId || null
    };
  }

  getRun(runId) { return this._get(this.runs, runId, 'formal run'); }

  /** Compute and append the single formal T005 for a run. */
  recordQuality(runId, input = {}) {
    const run = this.getRun(runId);
    if (run.qualityId) {
      const existing = this._get(this.quality, run.qualityId, 'T005');
      const candidate = evaluateQualityChecks(input.checks || input.results || [], { ...input, runId, qualityId: run.qualityId });
      if (fingerprint(existing.checks) !== fingerprint(candidate.checks)) fail(ERROR_CODES.IMMUTABLE, 'formal T005 cannot be overwritten');
      return existing;
    }
    const result = evaluateQualityChecks(input.checks || input.results || [], { ...input, runId, formedAt: this._now(input.formedAt) });
    if (this.quality.has(result.qualityId)) fail(ERROR_CODES.IMMUTABLE, 'T005 quality identity already belongs to another immutable result', { qualityId: result.qualityId });
    this.quality.set(result.qualityId, result);
    let nextStatus = STATUS.COMPLETED;
    let failure = null;
    if (result.status === QUALITY_STATUS.FAILED) {
      nextStatus = STATUS.FAILED;
      failure = { stage: 'quality', code: ERROR_CODES.QUALITY_HARD_FAILURE, reason: 'one or more hard quality checks failed', qualityId: result.qualityId };
    } else if (result.status === QUALITY_STATUS.UNKNOWN) {
      nextStatus = STATUS.BLOCKED;
      failure = { stage: 'quality', code: ERROR_CODES.QUALITY_UNKNOWN, reason: 'quality could not be determined', qualityId: result.qualityId };
    }
    const updated = {
      ...run,
      endedAt: nextStatus === STATUS.COMPLETED || nextStatus === STATUS.FAILED || nextStatus === STATUS.BLOCKED ? this._now() : null,
      status: nextStatus,
      qualityId: result.qualityId,
      qualityStatus: result.status,
      nodeTimeline: [...(run.nodeTimeline || []), {
        nodeType: 'T005',
        status: 'completed',
        qualityId: result.qualityId,
        formedAt: result.formedAt
      }],
      failure,
      fallback: this._fallbackState(run.outputAssetId)
    };
    this.runs.set(runId, immutable(updated));
    return result;
  }

  evaluateQuality(runId, checks, options) { return this.recordQuality(runId, { ...(options || {}), checks }); }
  qualityGate(runId, checks, options) { return this.recordQuality(runId, { ...(options || {}), checks }); }
  runQualityGate(runId, checks, options) { return this.recordQuality(runId, { ...(options || {}), checks }); }

  completeRun(runId, input = {}) {
    const run = this.getRun(runId);
    if (run.status !== STATUS.RUNNING) return run;
    if (!run.qualityId && input.qualityChecks) this.recordQuality(runId, { checks: input.qualityChecks });
    const afterQuality = this.getRun(runId);
    if (!afterQuality.qualityId) {
      const updated = { ...afterQuality, status: STATUS.BLOCKED, executionState: 'blocked', endedAt: this._now(), failure: { stage: 'quality', code: ERROR_CODES.QUALITY_REQUIRED, reason: 'formal T005 is required before completion' } };
      this.runs.set(runId, immutable(updated));
      return this.runs.get(runId);
    }
    return this.getRun(runId);
  }

  failRun(runId, input = {}) {
    const run = this.getRun(runId);
    if (run.status === STATUS.FAILED || run.status === STATUS.BLOCKED) return run;
    const failure = {
      stage: input.stage || 'execution',
      code: input.code || ERROR_CODES.INVALID_STATE,
      reason: input.reason || input.message || 'formal run failed',
      details: input.details ? clone(input.details) : null
    };
    const updated = {
      ...run,
      status: STATUS.FAILED,
      executionState: 'failed',
      endedAt: this._now(input.endedAt),
      nodeTimeline: [...(run.nodeTimeline || []), { nodeType: failure.stage, status: 'failed', formedAt: this._now(input.endedAt), reason: failure.reason }],
      failure,
      fallback: this._fallbackState(run.outputAssetId)
    };
    this.runs.set(runId, immutable(updated));
    return this.runs.get(runId);
  }

  executeRun(runId, executor, input = {}) {
    const run = this.getRun(runId);
    if (typeof executor !== 'function') fail(ERROR_CODES.INVALID_ARGUMENT, 'executor must be a function');
    if (run.status !== STATUS.RUNNING) return run;
    try {
      const output = executor(clone(run.inputLocks), clone(run));
      if (output && typeof output.then === 'function') {
        return output.then((value) => this._finishExecution(runId, value, input)).catch((error) => this.failRun(runId, { stage: 'processing', reason: error.message, code: 'M02_PROCESSING_FAILED' }));
      }
      return this._finishExecution(runId, output, input);
    } catch (error) {
      return this.failRun(runId, { stage: 'processing', reason: error.message, code: 'M02_PROCESSING_FAILED' });
    }
  }

  _finishExecution(runId, output, input) {
    const run = this.getRun(runId);
    if (input.qualityChecks || input.checks) this.recordQuality(runId, { checks: input.qualityChecks || input.checks });
    else if (input.quality) this.recordQuality(runId, input.quality);
    else if (output && output.qualityChecks) this.recordQuality(runId, { checks: output.qualityChecks });
    else {
      const pipeline = this.getPipelineVersion(run.pipelineId, run.pipelineVersion);
      if (Array.isArray(pipeline.qualityChecks) && pipeline.qualityChecks.some((check) => typeof check?.evaluate === 'function')) {
        const generated = runQualityChecks(output, pipeline.qualityChecks, { runId });
        this.recordQuality(runId, { checks: generated.checks, formedAt: generated.formedAt });
      }
    }
    const after = this.getRun(runId);
    if (after.status === STATUS.FAILED || after.status === STATUS.BLOCKED) return after;
    const outputHash = output === undefined ? null : fingerprint(output);
    const updated = {
      ...after,
      outputFingerprint: outputHash,
      outputRef: input.outputRef || null,
      status: after.qualityId ? STATUS.COMPLETED : STATUS.BLOCKED,
      executionState: after.qualityId ? 'completed' : 'blocked',
      endedAt: this._now(),
      nodeTimeline: [...(after.nodeTimeline || []), { nodeType: 'T004', status: 'completed', outputFingerprint: outputHash, formedAt: this._now() }],
      failure: after.qualityId ? null : { stage: 'quality', code: ERROR_CODES.QUALITY_REQUIRED, reason: 'formal T005 is required before completion' }
    };
    this.runs.set(runId, immutable(updated));
    return this.runs.get(runId);
  }

  runPipeline(pipelineId, input = {}) {
    const run = this.startRun(pipelineId, input);
    if (run.status !== STATUS.RUNNING || typeof input.executor !== 'function') return run;
    return this.executeRun(run.runId, input.executor, input);
  }
  runFormal(pipelineId, input) { return this.runPipeline(pipelineId, input); }

  _buildAssetMembers(inputMembers) {
    if (!Array.isArray(inputMembers) || inputMembers.length === 0) fail(ERROR_CODES.INVALID_ARGUMENT, 'T007 requires a non-empty members array');
    const seen = new Set();
    return inputMembers.map((member, index) => {
      const value = isRecord(member) ? { ...clone(member) } : { memberId: String(member) };
      const memberId = nonEmpty(value.memberId, `member ${index} memberId`);
      if (seen.has(memberId)) fail(ERROR_CODES.INVALID_ARGUMENT, 'T007 member IDs must be unique');
      seen.add(memberId);
      return { ...value, memberId };
    });
  }

  _buildAssetRelations(inputRelations) {
    if (inputRelations === undefined) return [];
    if (!Array.isArray(inputRelations)) fail(ERROR_CODES.INVALID_ARGUMENT, 'T007 relations must be an array');
    return inputRelations.map((relation, index) => {
      if (!isRecord(relation)) fail(ERROR_CODES.INVALID_ARGUMENT, `T007 relation ${index} must be an object`);
      const relationId = nonEmpty(relation.relationId, `relation ${index} relationId`);
      return { ...clone(relation), relationId };
    });
  }

  _qualityIdentity(quality) {
    if (!quality) return null;
    return {
      status: quality.status,
      executionStatus: quality.executionStatus,
      checks: (quality.checks || []).map((check) => ({
        ruleId: check.ruleId,
        ruleVersion: check.ruleVersion,
        status: check.status,
        hard: check.hard,
        blocking: check.blocking,
        checkedCount: check.checkedCount,
        failedCount: check.failedCount,
        warningCount: check.warningCount,
        affectedMembers: check.affectedMembers,
        reason: check.reason,
        recovery: check.recovery
      }))
    };
  }

  /** Publish one immutable T007 only after a successful formal T005 gate. */
  publishAsset(runId, input = {}) {
    const run = this.getRun(runId);
    if (run.status !== STATUS.COMPLETED) {
      if (run.failure?.code === ERROR_CODES.QUALITY_HARD_FAILURE) fail(ERROR_CODES.QUALITY_HARD_FAILURE, 'hard quality failure blocks T007 publication', run.failure);
      fail(ERROR_CODES.INVALID_STATE, 'only a completed formal run can publish T007', { runId, status: run.status });
    }
    const quality = this._get(this.quality, run.qualityId, 'T005');
    if (quality.status === QUALITY_STATUS.FAILED) fail(ERROR_CODES.QUALITY_HARD_FAILURE, 'hard quality failure blocks T007 publication');
    if (quality.status === QUALITY_STATUS.UNKNOWN) fail(ERROR_CODES.QUALITY_UNKNOWN, 'unknown quality blocks T007 publication');
    const warningAcknowledgement = input.warningAcknowledgement || input.warningReason;
    if (quality.status === QUALITY_STATUS.WARNING && !text(warningAcknowledgement)) fail(ERROR_CODES.WARNING_ACK_REQUIRED, 'publishing a warning result requires an explicit acknowledgement');
    this._contextMatchesRun(run.scenarioContext, run.scenarioContext);
    const assetId = nonEmpty(input.assetId || run.outputAssetId, 'assetId');
    const members = this._buildAssetMembers(input.members || input.memberList);
    const relations = this._buildAssetRelations(input.relations || input.relationships);
    const t008 = input.t008 || input.asOf || (run.inputLocks.find((lock) => lock.t008)?.t008);
    if (!text(t008)) fail(ERROR_CODES.T008_REQUIRED, 'T007 publication requires T008');
    const lockedT008 = run.inputLocks.find((lock) => lock.t008)?.t008;
    if (lockedT008 && t008 !== lockedT008) fail(ERROR_CODES.INPUT_DRIFT, 'T007 cannot publish with a T008 different from the run lock', { lockedT008, supplied: t008 });
    // Content identity intentionally excludes run IDs, formation timestamps,
    // T005 IDs and audit timestamps.  A repeat of the same exact data and
    // checks must produce "no data change" even when it ran in a new attempt.
    const versionContent = {
      assetId,
      scenarioContext: {
        scenarioId: run.scenarioContext.scenarioId,
        scenarioVersion: run.scenarioContext.scenarioVersion
      },
      t008,
      members,
      relations,
      // Audit event IDs and confirmation IDs are provenance, not content
      // identity. A byte-identical rerun with a fresh read/confirmation must
      // remain a no-data-change result while retaining the new audit chain.
      inputLocks: contentInputIdentity(run.inputLocks),
      pipelineId: run.pipelineId,
      pipelineVersion: run.pipelineVersion,
      processingModule: input.processingModule || run.processingModule || null,
      quality: this._qualityIdentity(quality),
      outputFingerprint: input.contentFingerprint || run.outputFingerprint || fingerprint(input.output || {
        inputIdentity: contentInputIdentity(run.inputLocks),
        pipelineId: run.pipelineId,
        pipelineVersion: run.pipelineVersion
      }),
      compatibilityOnly: input.compatibilityOnly === true
        || run.scenarioContext.scenarioId === 'S003' && ['compatibility', 'compatibility-validation'].includes(input.purpose)
    };
    const contentFingerprint = fingerprint(versionContent);
    const priorIds = this.assetVersionOrder.get(assetId) || [];
    const prior = priorIds.map((id) => this.assetVersions.get(id)).find((version) => version && version.contentFingerprint === contentFingerprint);
    if (prior) {
      const updatedRun = { ...run, candidateAssetVersionId: prior.assetVersionId, status: STATUS.COMPLETED, executionState: 'completed', closedLoopResult: 'published-no-data-change', endedAt: run.endedAt || this._now(), publishStatus: 'no-data-change', nodeTimeline: [...(run.nodeTimeline || []), { nodeType: 'T007', status: 'no-data-change', assetVersionId: prior.assetVersionId, formedAt: this._now() }], fallback: this._fallbackState(assetId) };
      this.runs.set(runId, immutable(updatedRun));
      return immutable({ status: 'no-data-change', existing: prior, run: this.runs.get(runId) });
    }
    const asset = this.assets.get(assetId) || this._put(this.assets, assetId, {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T006',
      assetId,
      name: input.assetName || assetId,
      createdAt: this._now(),
      scenarioId: run.scenarioContext.scenarioId
    });
    if (asset.scenarioId && asset.scenarioId !== run.scenarioContext.scenarioId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'T006 cannot change scenario ownership');
    // A candidate cannot depend on itself or any descendant of itself.
    for (const lock of run.inputLocks) if (lock.kind === 'T007') this._checkInputCycle(assetId, lock.assetVersionId);
    const versionNumber = priorIds.length + 1;
    const assetVersionId = nonEmpty(input.assetVersionId || input.t007Id || `${assetId}-v${versionNumber}`, 'assetVersionId');
    if (this.assetVersions.has(assetVersionId)) fail(ERROR_CODES.IMMUTABLE, 'T007 version id already exists');
    const compatibilityOnly = versionContent.compatibilityOnly;
    const effectiveReuseLicense = compatibilityOnly
      ? { allowed: false, reason: 'S003 compatibility version is permanently non-reusable' }
      : (input.reuseLicense ? clone(input.reuseLicense) : { allowed: false });
    if (compatibilityOnly && relations.length > 0) fail(ERROR_CODES.INVALID_ARGUMENT, 'S003 compatibility T007 must not declare ontology relationships');
    if (compatibilityOnly && members.length !== 2) fail(ERROR_CODES.INVALID_ARGUMENT, 'S003 compatibility T007 must contain exactly two logical members');
    const t008ConfirmationIds = sortedUnique(run.inputLocks.map((lock) => lock.t008ConfirmationId));
    const t008EvidenceRef = t008ConfirmationIds.length === 1 ? t008ConfirmationIds[0] : null;
    const rawSnapshotLocks = run.inputLocks.filter((lock) => lock.kind === 'T002');
    let sourceFingerprint = null;
    if (rawSnapshotLocks.length === 1) {
      const snapshot = this.snapshots.get(rawSnapshotLocks[0].snapshotId);
      if (snapshot && snapshot.contentFingerprint === rawSnapshotLocks[0].contentHash) {
        sourceFingerprint = {
          algorithm: 'SHA-256',
          value: snapshot.contentFingerprint,
          sizeBytes: snapshot.byteLength
        };
      }
    }
    const expectedScope = {
      memberIds: members.map((member) => member.memberId),
      relationIds: relations.map((relation) => relation.relationId)
    };
    const version = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T007',
      assetId,
      assetVersionId,
      versionId: assetVersionId,
      t007Version: input.version || `v${versionNumber}`,
      version: input.version || `v${versionNumber}`,
      scenarioContext: run.scenarioContext,
      t008,
      asOfTime: t008,
      members,
      relations,
      relationships: relations,
      expectedScope,
      inputs: run.inputLocks,
      inputLocks: run.inputLocks,
      pipelineId: run.pipelineId,
      pipelineVersionId: run.pipelineVersion,
      pipelineVersion: run.pipelineVersion,
      processingModule: input.processingModule || run.processingModule || null,
      processingModuleVersion: input.processingModuleVersion || input.processingModule?.version || run.processingModule?.version || null,
      quality: quality,
      qualityId: quality.qualityId,
      warningAcknowledgement: text(warningAcknowledgement) ? warningAcknowledgement : null,
      contentFingerprint,
      publicationState: 'published',
      publishedAt: this._now(input.publishedAt),
      publishedBy: input.publishedBy || null,
      releaseNote: input.releaseNote || input.versionNote || null,
      reuseLicense: effectiveReuseLicense,
      reusable: Boolean(effectiveReuseLicense.allowed === true),
      immutable: true,
      purpose: input.purpose || 'formal-data-asset',
      versionDescription: input.versionDescription || input.releaseNote || input.versionNote || null,
      sourceSnapshotIds: rawSnapshotLocks.map((lock) => lock.snapshotId),
      sourceFingerprint,
      t008ConfirmationIds,
      t008EvidenceRef,
      sourceRunId: run.runId,
      lineageCheckStatus: 'passed',
      lineageEvidenceRef: run.runId,
      cycleDetected: false,
      sourceChain: clone(this._sourceChain(run.inputLocks)),
      consumption: {
        // S003 compatibility assets are permanently non-consumable.  No API
        // below can promote this flag in place.
        compatibilityOnly,
        consumable: false,
        status: compatibilityOnly ? 'permanently-non-consumable' : 'published-not-consumable-until-ontology-evidence'
      }
    };
    // Publication creates a candidate; only an external C008/T019 evidence
    // projection can describe it as currently consumable. The immutable T007
    // itself is never rewritten.
    version.consumable = false;
    version.compatibilityOnly = compatibilityOnly;
    const stored = this._put(this.assetVersions, assetVersionId, version);
    this.assetVersionOrder.set(assetId, [...priorIds, assetVersionId]);
    this.assetDependencies.set(assetVersionId, run.inputLocks.filter((lock) => lock.kind === 'T007').map((lock) => lock.assetVersionId));
    this.runs.set(runId, immutable({ ...run, candidateAssetVersionId: assetVersionId, status: STATUS.COMPLETED, executionState: 'completed', closedLoopResult: 'published-awaiting-delivery', publishStatus: 'published', endedAt: run.endedAt || this._now(), nodeTimeline: [...(run.nodeTimeline || []), { nodeType: 'T007', status: 'published', assetVersionId, formedAt: this._now() }], fallback: this._fallbackState(assetId) }));
    return stored;
  }
  publishT007(runId, input) { return this.publishAsset(runId, input); }
  publishDataAssetVersion(runId, input) { return this.publishAsset(runId, input); }

  _sourceChain(locks, seen = new Set()) {
    const chain = [];
    for (const lock of locks || []) {
      if (lock.kind === 'T002') {
        const snapshot = this.snapshots.get(lock.snapshotId);
        chain.push({ kind: 'T002', snapshotId: lock.snapshotId, sourceId: snapshot?.sourceId || lock.sourceId, sourceVersion: snapshot?.sourceVersion || null, contentHash: lock.contentHash });
      } else if (lock.kind === 'T007') {
        const version = this.assetVersions.get(lock.assetVersionId);
        if (!version || seen.has(lock.assetVersionId)) continue;
        seen.add(lock.assetVersionId);
        chain.push({ kind: 'T007', assetVersionId: lock.assetVersionId, assetId: version.assetId, contentFingerprint: version.contentFingerprint, upstream: this._sourceChain(version.inputs, seen) });
      }
    }
    return chain;
  }

  getAsset(assetId) { return this._get(this.assets, assetId, 'T006'); }

  registerAsset(input = {}) {
    const assetId = nonEmpty(input.assetId || input.t006Id, 'assetId');
    const record = {
      schemaVersion: SCHEMA_VERSION,
      resourceType: 'T006',
      assetId,
      name: input.name || assetId,
      description: input.description || null,
      scenarioId: input.scenarioId || null,
      owner: input.owner || 'data-engineering',
      createdAt: this._now(input.createdAt)
    };
    const existing = this.assets.get(assetId);
    if (existing) {
      if (fingerprint(existing) !== fingerprint({ ...existing, ...record, createdAt: existing.createdAt })) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'T006 identity identifies a different asset');
      return existing;
    }
    return this._put(this.assets, assetId, record);
  }

  createAsset(input) { return this.registerAsset(input); }

  getAssetVersion(assetVersionId) { return this._get(this.assetVersions, assetVersionId, 'T007'); }
  getT007(assetVersionId) { return this.getAssetVersion(assetVersionId); }

  listAssetVersions(assetId) { return (this.assetVersionOrder.get(assetId) || []).map((id) => this.assetVersions.get(id)); }

  currentTrusted(assetId) {
    const ids = this.assetVersionOrder.get(assetId) || [];
    const candidates = ids.map((id) => this.assetVersions.get(id)).filter(Boolean).filter((version) => {
      const status = version.quality?.status;
      // This is the last historically trusted/published data version, not a
      // claim that it is currently safe after an append-only hard finding.
      // C017 exposes the finding and marks data-side qualification prohibited;
      // retaining the pointer is what makes failure fallback auditable.
      return version.consumption?.compatibilityOnly !== true && (status === QUALITY_STATUS.PASSED || status === QUALITY_STATUS.WARNING);
    });
    return candidates[candidates.length - 1] || null;
  }

  latestTrusted(assetId) { return this._latestQualified(assetId); }
  currentDataQualified(assetId) { return this._latestQualified(assetId); }

  getFallback(assetId) {
    const current = this._latestQualified(assetId);
    const latest = this._latestQualified(assetId);
    return immutable({ assetId, currentTrustedVersionId: current?.assetVersionId || null, latestQualifiedVersionId: latest?.assetVersionId || null, preserved: true });
  }

  /** End a failed candidate without deleting or rewriting its evidence. */
  endFailedCandidate(assetVersionId, input = {}) {
    const version = this.getAssetVersion(assetVersionId);
    const outcomeId = nonEmpty(input.outcomeId || this._id('CANDIDATE-END', { assetVersionId, reason: input.reason || null }), 'outcomeId');
    const outcome = {
      schemaVersion: SCHEMA_VERSION,
      outcomeId,
      assetId: version.assetId,
      assetVersionId,
      status: 'ended-failed',
      reason: input.reason || 'candidate ended after a determined failure',
      failureStage: input.failureStage || null,
      originalRunId: input.originalRunId || version.inputLocks?.runId || null,
      originalRequestId: input.originalRequestId || null,
      endedAt: this._now(input.endedAt),
      scenarioContext: version.scenarioContext,
      fallback: this._fallbackState(version.assetId)
    };
    const prior = this.candidateOutcomes.get(outcomeId);
    if (prior) {
      if (fingerprint(prior) !== fingerprint(outcome)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'candidate outcome id conflict');
      return prior;
    }
    const stored = this._put(this.candidateOutcomes, outcomeId, outcome);
    this.events.set(outcomeId, stored);
    return stored;
  }

  endFailedAssetCandidate(assetVersionId, input) { return this.endFailedCandidate(assetVersionId, input); }
  getCandidateOutcome(outcomeId) { return this._get(this.candidateOutcomes, outcomeId, 'candidate outcome'); }

  /** Record an append-only post-publish hard finding; never mutates T007/T005. */
  recordPostPublishFinding(input = {}) {
    const assetVersion = this.getAssetVersion(input.assetVersionId || input.t007Id);
    const findingId = nonEmpty(input.findingId || this._id('T005-FINDING', { assetVersionId: assetVersion.assetVersionId, reason: input.reason }), 'findingId');
    const finding = {
      schemaVersion: SCHEMA_VERSION,
      findingId,
      assetVersionId: assetVersion.assetVersionId,
      status: input.status || 'pending',
      hard: input.hard === true,
      checkId: input.checkId || null,
      severity: input.severity || null,
      reason: input.reason || null,
      affectedMembers: normalizeMembers(input.affectedMembers || input.memberIds),
      discoveredAt: this._now(input.discoveredAt),
      confirmedAt: input.confirmedAt ? this._now(input.confirmedAt) : null,
      evidenceRefs: input.evidenceRefs ? clone(input.evidenceRefs) : [],
      recovery: input.recovery || null
    };
    const prior = this.postPublishFindings.get(findingId);
    if (prior) {
      if (fingerprint(prior) !== fingerprint(finding)) fail(ERROR_CODES.IMMUTABLE, 'post-publish finding is append-only');
      return prior;
    }
    const stored = this._put(this.postPublishFindings, findingId, finding);
    return stored;
  }

  confirmPostPublishFinding(findingId, input = {}) {
    const prior = this._get(this.postPublishFindings, findingId, 'quality finding');
    if (prior.status !== 'pending') return prior;
    const next = { ...prior, status: 'confirmed', confirmedAt: this._now(input.confirmedAt), confirmedBy: input.confirmedBy || null, hard: input.hard === undefined ? prior.hard : input.hard === true };
    this.postPublishFindings.set(findingId, immutable(next));
    return this.postPublishFindings.get(findingId);
  }

  /** Retry a failed run with the same exact locks and context. */
  retryRun(runId, input = {}) {
    const original = this.getRun(runId);
    if (original.status !== STATUS.FAILED && original.status !== STATUS.BLOCKED) fail(ERROR_CODES.INVALID_STATE, 'only a failed or blocked run can be retried');
    const scenarioContext = requireActiveContext(input.scenarioContext || original.scenarioContext);
    if (!sameRunContext(scenarioContext, original.scenarioContext)) fail(ERROR_CODES.RETRY_DRIFT, 'retry must use the original C033 scenario run');
    const pipeline = this.getPipelineVersion(original.pipelineId, original.pipelineVersion);
    if (pipeline.pipelineVersion !== original.pipelineVersion) fail(ERROR_CODES.RETRY_DRIFT, 'retry cannot use a newer T003 version');
    const currentLocks = pipeline.inputSlots.map((slot) => this._resolveInput(slot, scenarioContext, pipeline.outputAssetId));
    if (fingerprint(semanticLocks(currentLocks)) !== original.inputLockFingerprint) fail(ERROR_CODES.RETRY_DRIFT, 'retry input locks no longer match the original exact locks');
    const request = { operation: 'formal-run-retry', originalRunId: runId, pipelineId: original.pipelineId, pipelineVersion: original.pipelineVersion, scenarioContext, inputLocks: original.inputLocks };
    const idem = this._assertRunIdempotency(request, input.idempotencyKey, 'retry');
    if (idem.duplicate) return idem.existing;
    const retried = this.startRun(original.pipelineId, {
      ...input,
      scenarioContext,
      retryOf: runId,
      idempotencyKey: undefined,
      runId: input.runId
    });
    this.idempotency.set(`retry:${idem.key}`, { requestFingerprint: idem.requestFingerprint, value: retried.runId });
    return retried;
  }

  /** Mark a C003 delivery as accepted/rejected/unknown without changing T007. */
  createDelivery(input = {}) {
    const version = this.getAssetVersion(input.assetVersionId || input.t007Id);
    const context = requireActiveContext(input.scenarioContext || version.scenarioContext);
    requireExactContext(version.scenarioContext, context, 'C003 delivery context must match the exact T007 context');
    if (version.compatibilityOnly === true || version.consumption?.compatibilityOnly === true
        || version.scenarioContext?.scenarioId === 'S003' && ['compatibility', 'compatibility-validation'].includes(version.purpose)) {
      fail(ERROR_CODES.S003_NOT_CONSUMABLE, 'S003 compatibility T007 cannot be delivered for consumption');
    }
    if (this._isVersionBlocked(version.assetVersionId)) {
      fail(ERROR_CODES.QUALITY_HARD_FAILURE, 'a confirmed post-publish hard quality finding blocks C003 delivery');
    }
    const sourceRun = version.sourceRunId ? this.runs.get(version.sourceRunId) : null;
    if (!sourceRun || sourceRun.candidateAssetVersionId !== version.assetVersionId
        || sourceRun.qualityId !== version.qualityId
        || sourceRun.pipelineId !== version.pipelineId
        || sourceRun.pipelineVersion !== version.pipelineVersion
        || !Array.isArray(version.inputLocks)
        || !sameExactContext(sourceRun.scenarioContext, version.scenarioContext)
        || fingerprint(sourceRun.inputLocks) !== fingerprint(version.inputLocks)) {
      fail(ERROR_CODES.INPUT_DRIFT, 'C003 T007 is not bound to its authoritative formal run');
    }
    const authoritativeQuality = this.quality.get(version.qualityId);
    if (!authoritativeQuality || authoritativeQuality.runId !== sourceRun.runId
        || fingerprint(authoritativeQuality) !== fingerprint(version.quality)) {
      fail('C003_QUALITY_MISMATCH', 'C003 quality evidence does not match the authoritative T005');
    }
    if (authoritativeQuality.status === QUALITY_STATUS.WARNING && !text(version.warningAcknowledgement)) {
      fail(ERROR_CODES.WARNING_ACK_REQUIRED, 'warning-quality C003 requires the acknowledgement locked into T007');
    }
    const rawSnapshotLocks = version.inputLocks.filter((lock) => lock.kind === 'T002');
    if (rawSnapshotLocks.length !== 1) {
      fail('C003_SOURCE_FINGERPRINT_INVALID', 'C003 requires one exact raw source fingerprint under the existing contract');
    }
    const rawLock = rawSnapshotLocks[0];
    const confirmation = version.t008EvidenceRef ? this.t008Confirmations.get(version.t008EvidenceRef) : null;
    if (!confirmation || version.t008ConfirmationIds?.length !== 1
        || version.t008ConfirmationIds[0] !== confirmation.confirmationId
        || rawLock.t008ConfirmationId !== confirmation.confirmationId
        || confirmation.snapshotId !== rawLock.snapshotId
        || !sameExactContext(confirmation.scenarioContext, version.scenarioContext)
        || confirmation.asOf !== rawLock.t008 || confirmation.asOf !== version.t008) {
      fail('C003_T008_EVIDENCE_REQUIRED', 'T007 T008 evidence is missing or does not match the exact run and as-of time');
    }
    const snapshot = this.snapshots.get(rawLock.snapshotId);
    const authoritativeSourceFingerprint = snapshot && snapshot.immutable === true
      && snapshot.contentFingerprint === rawLock.contentHash
      ? { algorithm: 'SHA-256', value: snapshot.contentFingerprint, sizeBytes: snapshot.byteLength }
      : null;
    if (!authoritativeSourceFingerprint
        || version.sourceSnapshotIds?.length !== 1 || version.sourceSnapshotIds[0] !== rawLock.snapshotId
        || fingerprint(authoritativeSourceFingerprint) !== fingerprint(version.sourceFingerprint)) {
      fail('C003_SOURCE_FINGERPRINT_INVALID', 'C003 source fingerprint does not match the locked immutable T002 bytes');
    }
    const authoritativeSourceChain = this._sourceChain(version.inputLocks);
    if (version.lineageCheckStatus !== 'passed' || version.cycleDetected !== false
        || version.lineageEvidenceRef !== sourceRun.runId
        || fingerprint(authoritativeSourceChain) !== fingerprint(version.sourceChain)) {
      fail('C003_LINEAGE_BLOCKED', 'C003 lineage evidence does not match the authoritative run input locks');
    }
    try { dataContracts.assertC003DeliveryEligible(version); } catch (error) {
      fail(error.code || ERROR_CODES.DELIVERY_BLOCKED, error.message, error.details || error.errors || null);
    }
    const deliveryId = nonEmpty(input.deliveryId || input.c003Id || this._id('C003', { assetVersionId: version.assetVersionId, context }), 'deliveryId');
    const existingDelivery = this.deliveryRecords.get(deliveryId);
    if (existingDelivery) {
      if (existingDelivery.assetVersionId !== version.assetVersionId || !sameExactContext(existingDelivery.scenarioContext, context)) {
        fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'delivery id identifies a different exact T007 or C033 context', { deliveryId });
      }
      return existingDelivery;
    }
    const priorRejected = [...this.deliveryRecords.values()].find((record) => record.assetVersionId === version.assetVersionId && ['rejected', 'unknown'].includes(record.status));
    if (priorRejected) {
      fail(ERROR_CODES.C003_REACCEPTANCE_UNSPECIFIED, 'C003 rejected/unknown delivery cannot be silently re-submitted before the re-acceptance contract is defined', { priorDeliveryId: priorRejected.deliveryId });
    }
    const request = { operation: 'C003-delivery', deliveryId, assetVersionId: version.assetVersionId, scenarioContext: context };
    const idem = this._rememberIdempotent('delivery', input.idempotencyKey || requestKey(request), request, deliveryId);
    if (idem.duplicate) return this._get(this.deliveryRecords, idem.value, 'C003 delivery');
    const delivery = {
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C003',
      sourceModule: 'data-engineering',
      targetModule: input.targetModule || 'ontology-management',
      deliveryId,
      assetId: version.assetId,
      assetVersionId: version.assetVersionId,
      t006Id: version.assetId,
      t007Id: version.assetVersionId,
      t008: version.t008,
      asOfTime: version.t008,
      immutable: version.immutable === true,
      publicationState: version.publicationState,
      qualityStatus: version.quality.status,
      t008ConfirmationIds: clone(version.t008ConfirmationIds || []),
      t008ConfirmationId: version.t008EvidenceRef,
      t008EvidenceRef: version.t008EvidenceRef,
      members: clone(version.members),
      relations: clone(version.relations),
      expectedScope: clone(version.expectedScope),
      quality: clone(version.quality),
      t005Id: version.qualityId,
      warningAcknowledgement: version.warningAcknowledgement || null,
      sourceChain: clone(version.sourceChain),
      sourceSnapshotIds: clone(version.sourceSnapshotIds || []),
      sourceFingerprint: clone(version.sourceFingerprint),
      pipelineId: version.pipelineId,
      pipelineVersionId: version.pipelineVersionId,
      pipelineVersion: version.pipelineVersion,
      processingModule: clone(version.processingModule || null),
      processingModuleVersion: version.processingModuleVersion || null,
      publishedAt: version.publishedAt,
      versionDescription: version.versionDescription || version.releaseNote || null,
      scenarioContext: context,
      lineageCheckStatus: version.lineageCheckStatus,
      lineageEvidenceRef: version.lineageEvidenceRef,
      cycleDetected: version.cycleDetected,
      sentAt: this._now(input.sentAt),
      status: 'awaiting-receipt',
      purpose: version.purpose || 'semantic-refresh-candidate',
      consumptionStatus: version.consumption?.compatibilityOnly ? 'compatibility-only-non-consumable' : 'candidate',
      receipt: null
    };
    dataContracts.assertNoForbiddenKeys({ members: delivery.members, relationships: delivery.relations, sourceChain: delivery.sourceChain });
    try { dataContracts.validateDelivery(delivery); } catch (error) {
      fail(error.code || ERROR_CODES.DELIVERY_BLOCKED, error.message, error.details || error.errors || null);
    }
    return this._put(this.deliveryRecords, deliveryId, delivery);
  }
  createC003Delivery(input) { return this.createDelivery(input); }

  recordDeliveryReceipt(deliveryId, input = {}) {
    const delivery = this._get(this.deliveryRecords, deliveryId, 'C003 delivery');
    dataContracts.assertAllowedFields(input, dataContracts.C003_RECEIPT_FIELDS, 'C003_RECEIPT', {
      required: ['schemaVersion', 'contractCode', 'deliveryId', 'assetVersionId', 'status', 'scenarioContext']
    });
    dataContracts.assertExactSchemaVersion(input.schemaVersion);
    if (input.contractCode !== 'C003') fail(ERROR_CODES.CONTEXT_MISMATCH, 'C003 receipt contractCode mismatch');
    dataContracts.assertC003Replacement(input.replacement);
    const status = input.status || input.outcome;
    if (!['accepted', 'rejected', 'unknown'].includes(status)) fail(ERROR_CODES.INVALID_ARGUMENT, 'C003 receipt status must be accepted, rejected, or unknown');
    if (!input.scenarioContext) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C003 receipt must echo C033 scenario context');
    const receipt = {
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C003',
      receiptId: input.receiptId || this._id('C003-RECEIPT', { deliveryId, status }),
      idempotencyKey: input.idempotencyKey || `c003-receipt:${fingerprint({ deliveryId, status, scenarioContext: delivery.scenarioContext })}`,
      deliveryId,
      status,
      receivedAt: this._now(input.receivedAt),
      reason: input.reason || null,
      targetDraftVersion: input.targetDraftVersion || null,
      replacement: input.replacement ? clone(input.replacement) : null,
      scenarioContext: validateContext(input.scenarioContext || delivery.scenarioContext),
      assetVersionId: delivery.assetVersionId
    };
    if (input.deliveryId !== deliveryId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C003 receipt deliveryId mismatch');
    if (input.assetVersionId !== delivery.assetVersionId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C003 receipt T007 mismatch');
    requireExactContext(delivery.scenarioContext, receipt.scenarioContext, 'C003 receipt context mismatch');
    if (delivery.receipt) {
      const comparable = (value) => ({
        deliveryId: value.deliveryId,
        assetVersionId: value.assetVersionId,
        status: value.status,
        reason: value.reason,
        targetDraftVersion: value.targetDraftVersion,
        replacement: value.replacement,
        scenarioContext: value.scenarioContext
      });
      if (fingerprint(comparable(delivery.receipt)) !== fingerprint(comparable(receipt))) fail(ERROR_CODES.IMMUTABLE, 'C003 receipt cannot be overwritten');
      return delivery.receipt;
    }
    const next = { ...delivery, status: status === 'accepted' ? 'accepted' : status === 'rejected' ? 'rejected' : 'unknown', receipt };
    this.deliveryRecords.set(deliveryId, immutable(next));
    return this.deliveryRecords.get(deliveryId).receipt;
  }
  receiveC003Receipt(deliveryId, input) { return this.recordDeliveryReceipt(deliveryId, input); }
  createDeliveryReceipt(deliveryId, input) { return this.recordDeliveryReceipt(deliveryId, input); }

  getDelivery(deliveryId) { return this._get(this.deliveryRecords, deliveryId, 'C003 delivery'); }

  /**
   * Read-only C032/T054 discovery.  The runtime never stores the returned
   * target as pipeline truth; it is an append-only response used for one
   * submission and must be read again immediately before C028.
   */
  discoverC032(input = {}) {
    const delivery = input.deliveryId ? this.getDelivery(input.deliveryId) : input.delivery || null;
    if (delivery && delivery.status !== 'accepted') fail(ERROR_CODES.DELIVERY_BLOCKED, 'C032 discovery requires an accepted C003 receipt');
    const assetId = nonEmpty(input.assetId || delivery?.assetId || delivery?.t006Id, 'assetId');
    const context = requireActiveContext(input.scenarioContext || delivery?.scenarioContext);
    if (delivery) requireExactContext(delivery.scenarioContext, context, 'C032 context does not match C003');
    const responseId = nonEmpty(input.responseId || this._id('C032', { assetId, context, at: input.readAt, sequence: ++this.c032Sequence }), 'responseId');
    const readAt = this._now(input.readAt);
    const externalResponse = Boolean(input.response || typeof input.provider === 'function');
    let response = input.response || null;
    if (typeof input.provider === 'function') response = input.provider({ assetId, scenarioContext: context, delivery, responseId, readAt });
    response = response || { schemaVersion: SCHEMA_VERSION, contractCode: 'C032', responseId, responseVersion: '1', assetId, status: 'not-established', candidates: [], scenarioContext: context };
    if (!Array.isArray(response.candidates)) fail(ERROR_CODES.INVALID_ARGUMENT, 'C032 candidates must be an array');
    if (externalResponse) {
      dataContracts.assertAllowedFields(response, dataContracts.C032_RESPONSE_FIELDS, 'C032_RESPONSE', {
        required: ['schemaVersion', 'contractCode', 'responseId', 'responseVersion', 'assetId', 'status', 'scenarioContext', 'candidates']
      });
      dataContracts.assertExactSchemaVersion(response.schemaVersion);
      if (response.contractCode !== 'C032') fail(ERROR_CODES.CONTEXT_MISMATCH, 'C032 response contractCode mismatch');
      for (const candidate of response.candidates || []) dataContracts.assertC032Candidate(candidate);
    }
    if (input.strict === true && response.status === 'available') {
      for (const candidate of response.candidates) {
        if (!text(candidate.t054Id || candidate.targetId || candidate.bindingId)
            || !text(candidate.bindingVersion) || !text(candidate.t017Id)
            || !text(candidate.mappingVersion)) fail(ERROR_CODES.INPUT_UNAVAILABLE, 'strict C032 candidate is missing a stable binding or mapping identity');
      }
    }
    const allowedStatuses = new Set(['not-read', 'reading', 'available', 'not-established', 'draft', 'inactive', 'asset-mismatch', 'coverage-insufficient', 't017-unlocatable', 'mapping-unlocatable', 'context-invalid', 'unknown', 'read-failed']);
    if (!allowedStatuses.has(response.status)) fail(ERROR_CODES.INVALID_ARGUMENT, `invalid C032 status ${response.status}`);
    if (!response.assetId || response.assetId !== assetId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C032 response must echo the exact T006');
    if (!response.scenarioContext) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C032 response must echo C033 scenario context');
    const responseContext = requireExactContext(context, response.scenarioContext, 'C032 response context mismatch');
    const normalized = immutable({
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C032',
      responseId: response.responseId,
      responseVersion: String(response.responseVersion),
      idempotencyKey: `c032:${fingerprint({ assetId, context, responseId })}`,
      assetId,
      t006Id: assetId,
      status: response.status,
      formedAt: this._now(response.formedAt || readAt),
      readAt,
      scenarioContext: responseContext,
      candidates: clone(response.candidates || []),
      reasonCode: response.reasonCode || null,
      reason: response.reason || null,
      recovery: response.recovery || null,
      deliveryId: delivery?.deliveryId || null
    });
    if (this.c032Responses.has(responseId)) {
      const prior = this.c032Responses.get(responseId);
      if (fingerprint(prior) !== fingerprint(normalized)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'C032 response id conflict');
      return prior;
    }
    this.c032Responses.set(responseId, normalized);
    this.events.set(responseId, normalized);
    return normalized;
  }

  discoverRefreshTarget(input) { return this.discoverC032(input); }
  discoverC032Async(input) { return Promise.resolve().then(() => this.discoverC032(input)); }
  getC032(responseId) { return this._get(this.c032Responses, responseId, 'C032 response'); }

  _sameC032Selection(left, right) {
    if (!left || !right || left.assetId !== right.assetId || left.status !== right.status || left.responseVersion !== right.responseVersion) return false;
    if (!sameExactContext(left.scenarioContext, right.scenarioContext)) return false;
    const project = (value) => (value.candidates || []).map((candidate) => ({
      t054Id: candidate.t054Id || candidate.targetId || candidate.bindingId || null,
      bindingVersion: candidate.bindingVersion || null,
      t017Id: candidate.t017Id || null,
      mappingVersion: candidate.mappingVersion || null,
      allowSubmit: candidate.allowSubmit === true,
      status: candidate.status || null
    }));
    return stableSerialize(project(left)) === stableSerialize(project(right));
  }

  /** Form and submit a C028 only after a fresh C032 read has been compared. */
  submitC028(input = {}) {
    const delivery = input.deliveryId ? this.getDelivery(input.deliveryId) : input.delivery || null;
    if (!delivery || delivery.status !== 'accepted') fail(ERROR_CODES.DELIVERY_BLOCKED, 'C028 requires an accepted C003 receipt');
    if (delivery.consumptionStatus === 'compatibility-only-non-consumable' || delivery.compatibilityOnly === true) fail(ERROR_CODES.S003_NOT_CONSUMABLE, 'S003 compatibility T007 cannot enter C028');
    const context = requireActiveContext(input.scenarioContext || delivery.scenarioContext);
    requireExactContext(delivery.scenarioContext, context, 'C028 context mismatch');
    const discovery = input.discoveryId ? this.getC032(input.discoveryId) : input.discovery;
    const reread = input.rereadId ? this.getC032(input.rereadId) : input.reread;
    if (!discovery || discovery.status !== 'available') fail(ERROR_CODES.INPUT_UNAVAILABLE, 'C028 requires an available C032 response');
    requireExactContext(context, discovery.scenarioContext, 'C032 discovery context mismatch');
    if (reread && !this._sameC032Selection(discovery, reread)) fail(ERROR_CODES.INPUT_DRIFT, 'C032 target or mapping drifted before C028 submission');
    const candidates = (reread || discovery).candidates || [];
    const targetId = input.targetId || input.t054Id || input.bindingId;
    const target = input.target || candidates.find((candidate) => (targetId ? (candidate.t054Id || candidate.targetId || candidate.bindingId) === targetId : true) && candidate.allowSubmit === true && candidate.status === 'available');
    if (!target || target.allowSubmit !== true || target.status !== 'available') fail(ERROR_CODES.INPUT_UNAVAILABLE, 'selected C032 target is not submittable');
    if (input.strict === true && (!text(target.bindingVersion) || !text(target.t017Id) || !text(target.mappingVersion))) fail(ERROR_CODES.INPUT_UNAVAILABLE, 'strict C028 requires T054 binding, T017 and mapping identities');
    const requestId = nonEmpty(input.requestId || input.c028Id || this._id('C028', { deliveryId: delivery.deliveryId, target, context, retryOf: input.retryOf || null }), 'requestId');
    const request = {
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C028',
      requestId,
      deliveryId: delivery.deliveryId,
      assetId: delivery.assetId,
      assetVersionId: delivery.assetVersionId,
      t006Id: delivery.assetId,
      t007Id: delivery.assetVersionId,
      t008: delivery.t008,
      scenarioContext: context,
      discovery: clone(reread || discovery),
      target: clone(target),
      trigger: input.trigger || 'manual',
      retryOf: input.retryOf || null,
      requestedAt: this._now(input.requestedAt),
      status: 'pending',
      idempotencyKey: input.idempotencyKey || `c028:${fingerprint({ deliveryId: delivery.deliveryId, target, context, retryOf: input.retryOf || null })}`
    };
    const existing = this.refreshRequests.get(requestId);
    if (existing) {
      const semantic = (value) => { const copy = clone(value); delete copy.requestedAt; return copy; };
      if (fingerprint(semantic(existing.request)) !== fingerprint(semantic(request))) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'C028 request id conflict');
      return existing.receipt;
    }
    const externalReceipt = Boolean(input.receipt || typeof input.provider === 'function');
    let receipt = input.receipt || null;
    if (typeof input.provider === 'function') receipt = input.provider(immutable(request));
    if (!receipt) receipt = { schemaVersion: SCHEMA_VERSION, contractCode: 'C028', requestId, assetVersionId: delivery.assetVersionId, status: 'pending', scenarioContext: context };
    if (externalReceipt) {
      dataContracts.assertAllowedFields(receipt, dataContracts.C028_RECEIPT_FIELDS, 'C028_RECEIPT', {
        required: ['schemaVersion', 'contractCode', 'requestId', 'assetVersionId', 'status', 'scenarioContext']
      });
      dataContracts.assertExactSchemaVersion(receipt.schemaVersion);
      if (receipt.contractCode !== 'C028') fail(ERROR_CODES.CONTEXT_MISMATCH, 'C028 receipt contractCode mismatch');
    }
    const allowed = new Set(['pending', 'queued', 'sent', 'accepted', 'rejected', 'unknown', 'not-sent-superseded']);
    if (!allowed.has(receipt.status)) fail(ERROR_CODES.INVALID_ARGUMENT, 'invalid C028 receipt status');
    if (['accepted', 'rejected', 'unknown'].includes(receipt.status) && !receipt.scenarioContext) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C028 receipt must echo C033 scenario context');
    if (receipt.requestId !== requestId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C028 receipt requestId mismatch');
    if (receipt.assetVersionId !== delivery.assetVersionId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C028 receipt T007 mismatch');
    if (receipt.target) {
      dataContracts.assertC032Candidate(receipt.target);
      const returnedTarget = receipt.target.t054Id || receipt.target.targetId || receipt.target.bindingId;
      const submittedTarget = target.t054Id || target.targetId || target.bindingId;
      if (returnedTarget !== submittedTarget || (receipt.target.bindingVersion || null) !== (target.bindingVersion || null)) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C028 receipt target mismatch');
    }
    if (!receipt.scenarioContext) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C028 receipt must echo C033 scenario context');
    const receiptContext = requireExactContext(context, receipt.scenarioContext, 'C028 receipt context mismatch');
    const normalizedReceipt = immutable({ ...clone(receipt), contractCode: 'C028', requestId, deliveryId: delivery.deliveryId, assetVersionId: delivery.assetVersionId, scenarioContext: receiptContext, receivedAt: this._now(receipt.receivedAt) });
    const record = immutable({ request: immutable(request), receipt: normalizedReceipt });
    this.refreshRequests.set(requestId, record);
    this.events.set(requestId, normalizedReceipt);
    return normalizedReceipt;
  }

  submitRefreshRequest(input) { return this.submitC028(input); }
  submitC028Async(input) { return Promise.resolve().then(() => this.submitC028(input)); }
  getC028(requestId) { return this._get(this.refreshRequests, requestId, 'C028 request').receipt; }

  /** Accept a read-only C029 result; mismatched results never enter the store. */
  recordC029(requestId, input = {}) {
    const record = this.refreshRequests.get(requestId);
    if (!record) fail(ERROR_CODES.NOT_FOUND, `C028 request ${requestId} was not found`);
    const request = record.request;
    if (!['accepted', 'sent', 'queued'].includes(record.receipt.status)) fail(ERROR_CODES.DELIVERY_BLOCKED, 'C029 cannot enter the projection before a C028 request is accepted');
    const result = input.result || input;
    dataContracts.assertAllowedFields(result, dataContracts.C029_RESULT_FIELDS, 'C029_RESULT', {
      required: ['schemaVersion', 'contractCode', 'resultId', 'requestId', 'assetVersionId', 'status', 'scenarioContext']
    });
    dataContracts.assertExactSchemaVersion(result.schemaVersion);
    if (result.contractCode !== 'C029') fail(ERROR_CODES.CONTEXT_MISMATCH, 'C029 result contractCode mismatch');
    const status = result.status;
    if (!['processing', 'succeeded', 'failed', 'incompatible', 'unknown'].includes(status)) fail(ERROR_CODES.INVALID_ARGUMENT, 'invalid C029 result status');
    if (result.requestId !== requestId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C029 request mismatch');
    if (result.assetVersionId !== request.assetVersionId) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C029 T007 mismatch');
    if (!result.scenarioContext) fail(ERROR_CODES.CONTEXT_MISMATCH, 'C029 result must echo C033 scenario context');
    const context = validateContext(result.scenarioContext);
    requireExactContext(request.scenarioContext, context, 'C029 context mismatch');
    if (result.target) {
      dataContracts.assertC032Candidate(result.target);
      const resultTargetId = result.target.t054Id || result.target.targetId || result.target.bindingId;
      const requestTargetId = request.target.t054Id || request.target.targetId || request.target.bindingId;
      if (resultTargetId !== requestTargetId || (result.target.bindingVersion || null) !== (request.target.bindingVersion || null)) {
        fail(ERROR_CODES.CONTEXT_MISMATCH, 'C029 target binding mismatch');
      }
    }
    dataContracts.assertT019Snapshot(result.t019Snapshot);
    dataContracts.assertT018Qualification(result.t018Qualification);
    dataContracts.assertEvidenceReferences(result.evidence, 'C029_EVIDENCE');
    const resultId = nonEmpty(result.resultId, 'resultId');
    const normalized = immutable({
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C029',
      resultId,
      idempotencyKey: result.idempotencyKey || `c029:${fingerprint({ requestId, resultId, status })}`,
      requestId,
      deliveryId: request.deliveryId,
      assetId: request.assetId,
      assetVersionId: request.assetVersionId,
      t006Id: request.assetId,
      t007Id: request.assetVersionId,
      scenarioContext: context,
      target: clone(request.target),
      discovery: clone(request.discovery),
      status,
      formedAt: this._now(result.formedAt),
      reason: result.reason || null,
      recovery: result.recovery || null,
      evidence: clone(result.evidence || []),
      t018Qualification: result.t018Qualification || null,
      t019Snapshot: clone(result.t019Snapshot || null)
    });
    const prior = this.refreshResults.get(resultId);
    if (prior) {
      const semantic = (value) => { const copy = clone(value); delete copy.formedAt; return copy; };
      if (fingerprint(semantic(prior)) === fingerprint(semantic(normalized))) return prior;
      const terminal = new Set(['succeeded', 'failed', 'incompatible', 'unknown']);
      if (prior.status !== 'processing' || !terminal.has(normalized.status)) fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'C029 result id conflict');
      const history = this.refreshResultHistory.get(resultId) || [prior];
      this.refreshResultHistory.set(resultId, [...history, normalized]);
      this.refreshResults.set(resultId, normalized);
      this.events.set(resultId, normalized);
      return normalized;
    }
    this.refreshResults.set(resultId, normalized);
    this.refreshResultHistory.set(resultId, [normalized]);
    this.events.set(resultId, normalized);
    return normalized;
  }

  recordRefreshResult(requestId, input) { return this.recordC029(requestId, input); }
  recordC029Async(requestId, input) { return Promise.resolve().then(() => this.recordC029(requestId, input)); }
  getC029(resultId) { return this._get(this.refreshResults, resultId, 'C029 result'); }

  _c017FiveDimensions(version) {
    const blocked = this._isVersionBlocked(version.assetVersionId);
    const dimensions = {
      versionLocation: { status: 'located' },
      contentAccess: { status: version.contentRef ? 'available-by-authorized-reference' : 'metadata-only' },
      evidenceCompleteness: { status: version.sourceChain && version.qualityId && version.pipelineId ? 'complete' : 'incomplete' },
      replayCapability: { status: version.sourceChain && version.inputs?.length ? 'conditions-available' : 'dependency-insufficient' },
      replayVerification: { status: 'not-executed', reason: blocked ? 'blocked by confirmed hard quality finding' : 'not executed / dependency insufficient' }
    };
    Object.defineProperty(dimensions, 'replayability', { value: dimensions.replayCapability, enumerable: false });
    return dimensions;
  }

  _c017OperationalFacts(version) {
    const deliveries = [...this.deliveryRecords.values()].filter((item) => item.assetVersionId === version.assetVersionId);
    const delivery = deliveries[deliveries.length - 1] || null;
    const requests = [...this.refreshRequests.values()].filter((item) => item.request.assetVersionId === version.assetVersionId);
    const request = requests[requests.length - 1] || null;
    const results = request ? [...this.refreshResults.values()].filter((item) => item.requestId === request.request.requestId) : [];
    const result = results[results.length - 1] || null;
    return {
      delivery: delivery ? { deliveryId: delivery.deliveryId, status: delivery.status, receiptStatus: delivery.receipt?.status || null, receivedAt: delivery.receipt?.receivedAt || null } : null,
      refresh: request ? { requestId: request.request.requestId, status: request.receipt.status, requestedAt: request.request.requestedAt, result: result ? { resultId: result.resultId, status: result.status, formedAt: result.formedAt, t018Qualification: result.t018Qualification || null } : null } : null
    };
  }

  _makeC017Summary(version, type, input = {}) {
    const context = validateContext(input.scenarioContext || version.scenarioContext);
    requireExactContext(version.scenarioContext, context, 'C017 summary context mismatch');
    const blockedFinding = [...this.postPublishFindings.values()].find((finding) => finding.assetVersionId === version.assetVersionId && finding.status === 'confirmed' && finding.hard === true);
    const qualityStatus = blockedFinding ? 'failed' : version.quality?.status || QUALITY_STATUS.UNKNOWN;
    const compatibilityLocked = version.compatibilityOnly === true || version.consumption?.compatibilityOnly === true;
    const operational = this._c017OperationalFacts(version);
    const summaryVersion = input.summaryVersion || (type === 'version-bound' ? '1' : String((this.c017CurrentByAssetVersion.get(version.assetVersionId) || 0) + 1));
    const suppliedSummaryId = type === 'version-bound' ? input.versionSummaryId : input.currentSummaryId;
    const summaryId = suppliedSummaryId || (input.summaryId ? `${input.summaryId}-${type}` : this._id(type === 'version-bound' ? 'C017-VERSION' : 'C017-CURRENT', { assetVersionId: version.assetVersionId, summaryVersion }));
    const summary = {
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C017',
      summaryId,
      summaryVersion,
      summaryType: type,
      formedAt: this._now(input.formedAt),
      observedAt: this._now(input.observedAt || input.formedAt),
      factLastConfirmedAt: input.factLastConfirmedAt || version.publishedAt,
      assetId: version.assetId,
      assetVersionId: version.assetVersionId,
      asOfTime: version.t008,
      t008: version.t008,
      scenarioContext: context,
      versionBindingSummary: {
        assetId: version.assetId,
        assetVersionId: version.assetVersionId,
        t008: version.t008,
        qualityStatus: version.quality?.status || QUALITY_STATUS.UNKNOWN,
        qualityId: version.qualityId,
        formedAt: version.publishedAt
      },
      currentStateSummary: {
        status: compatibilityLocked || blockedFinding ? 'data-side-prohibited' : qualityStatus === QUALITY_STATUS.FAILED || qualityStatus === QUALITY_STATUS.UNKNOWN ? 'blocked' : 'available',
        hardFailure: blockedFinding ? { findingId: blockedFinding.findingId, reason: blockedFinding.reason, affectedMembers: blockedFinding.affectedMembers, discoveredAt: blockedFinding.discoveredAt } : null,
        candidate: false,
        previousTrustedVersionId: this._latestQualified(version.assetId)?.assetVersionId || null
      },
      fiveDimensions: this._c017FiveDimensions(version),
      dataSideQualification: compatibilityLocked || blockedFinding || qualityStatus === QUALITY_STATUS.FAILED || qualityStatus === QUALITY_STATUS.UNKNOWN
        ? 'prohibited' : qualityStatus === QUALITY_STATUS.WARNING ? 'allowed-with-warning' : 'allowed',
      qualificationReason: compatibilityLocked ? 'compatibility-only T007 is permanently non-consumable' : blockedFinding?.reason || (qualityStatus === QUALITY_STATUS.UNKNOWN ? 'quality or evidence is unknown' : null),
      quality: {
        status: blockedFinding ? 'hard-failed' : qualityStatus,
        qualityId: version.qualityId,
        checkCount: version.quality?.summary?.checkCount || 0,
        failedCount: version.quality?.summary?.failedCount || 0,
        warningCount: version.quality?.summary?.warningCount || 0,
        hardFailure: Boolean(blockedFinding || version.quality?.hardFailure)
      },
      hardQualityFailure: Boolean(blockedFinding || version.quality?.hardFailure),
      affectedScope: blockedFinding ? { members: blockedFinding.affectedMembers || [], fields: [], scope: 'declared' } : null,
      discoveredAt: blockedFinding?.discoveredAt || null,
      freshness: clone(input.freshness || { status: 'unknown', reason: 'no external freshness threshold supplied' }),
      candidate: clone(input.candidate || null),
      dataSidePreviousQualified: this._latestQualified(version.assetId)?.assetVersionId === version.assetVersionId ? null : (this._latestQualified(version.assetId)?.assetVersionId || null),
      currentAuthority: clone(input.currentAuthority || null),
      previousAuthority: clone(input.previousAuthority || null),
      delivery: clone(input.delivery || operational.delivery),
      discovery: clone(input.discovery || null),
      refresh: clone(input.refresh || operational.refresh),
      evidence: clone(input.evidence || [{ evidenceId: version.qualityId, type: 'T005', assetVersionId: version.assetVersionId, locationStatus: 'locatable' }]),
      retention: clone(input.retention || { status: 'unknown' }),
      reproducibility: { status: 'not-executed', reason: 'not executed / dependency insufficient' },
      consistency: 'data-side-consistent'
    };
    // The contract validator is intentionally strict; retain compatibility
    // aliases in the public payload but store the canonical shape as well.
    summary.versionBound = summary.versionBindingSummary;
    summary.currentState = summary.currentStateSummary;
    dataContracts.validateC017Summary(summary);
    return immutable(summary);
  }

  createC017Summaries(input = {}) {
    const version = this.getAssetVersion(input.assetVersionId || input.t007Id);
    const existingVersionBoundId = this.c017VersionBoundByAssetVersion.get(version.assetVersionId);
    const versionBound = existingVersionBoundId
      ? this.getC017Summary(existingVersionBoundId)
      : this._makeC017Summary(version, 'version-bound', input);
    const currentState = this._makeC017Summary(version, 'current-state', input);
    const currentWithBinding = immutable({ ...currentState, versionBoundSummaryId: versionBound.summaryId, versionBoundSummaryVersion: versionBound.summaryVersion });
    this.c017Summaries.set(versionBound.summaryId, versionBound);
    this.c017VersionBoundByAssetVersion.set(version.assetVersionId, versionBound.summaryId);
    const existingCurrent = this.c017Summaries.get(currentWithBinding.summaryId);
    if (existingCurrent && fingerprint(existingCurrent) !== fingerprint(currentWithBinding)) fail(ERROR_CODES.IMMUTABLE, 'C017 current-state summary is append-only');
    this.c017Summaries.set(currentWithBinding.summaryId, currentWithBinding);
    const numericVersion = Number(currentWithBinding.summaryVersion);
    this.c017CurrentByAssetVersion.set(version.assetVersionId, Number.isFinite(numericVersion)
      ? numericVersion
      : (this.c017CurrentByAssetVersion.get(version.assetVersionId) || 0) + 1);
    return immutable({ versionBound, currentState: currentWithBinding, versionBoundSummary: versionBound, currentStateSummary: currentWithBinding });
  }

  getC017Summary(summaryId) { return this._get(this.c017Summaries, summaryId, 'C017 summary'); }

  /** C017 metadata-only read.  A read event is append-only and never returns rows. */
  readC017(input = {}) {
    const version = this.getAssetVersion(input.assetVersionId || input.t007Id);
    const context = requireActiveContext(input.scenarioContext || version.scenarioContext);
    requireExactContext(version.scenarioContext, context, 'C017 read context mismatch');
    const purpose = nonEmpty(input.purpose || input.consumer || 'metadata', 'C017 purpose');
    const consumer = input.consumer || (['decision-gate', 'decision', 'm04'].includes(purpose) ? 'M04' : 'report');
    dataContracts.c017ConsumerProfile(consumer);
    const readId = nonEmpty(input.readId || input.requestId || this._id('C017-READ', { purpose, assetVersionId: version.assetVersionId, context }), 'C017 readId');
    const request = { operation: 'C017-read', readId, purpose, consumer, assetVersionId: version.assetVersionId, scenarioContext: context };
    const existingRead = this.c017Reads.get(readId);
    if (existingRead) {
      if (existingRead.consumer !== consumer || existingRead.purpose !== purpose
          || existingRead.assetVersionId !== version.assetVersionId
          || !sameExactContext(existingRead.scenarioContext, context)) {
        fail(ERROR_CODES.IDEMPOTENCY_CONFLICT, 'C017 read id identifies a different consumer, purpose, T007 or C033 context', { readId });
      }
      return existingRead;
    }
    const idem = this._rememberIdempotent('c017', input.idempotencyKey || requestKey(request), request, readId);
    if (idem.duplicate) return this._get(this.c017Reads, idem.value, 'C017 read');
    const summaries = this.createC017Summaries({ ...input, scenarioContext: context });
    // Unknown consumers fail closed.  Falling back to a broader projection
    // would turn a caller typo or an unauthorized purpose into an escalation.
    const projection = dataContracts.projectC017(summaries.currentState, consumer, input);
    const readEvent = dataContracts.createReadEvent({
      eventId: readId,
      consumer,
      requester: input.requestedBy || input.actorRef || purpose,
      context,
      assetVersionId: version.assetVersionId,
      summaryId: summaries.currentState.summaryId,
      summaryVersion: summaries.currentState.summaryVersion,
      status: 'ok',
      readAt: input.readAt || this._now()
    });
    const qualityStatus = String(projection.quality?.status || '').toLowerCase();
    const qualification = String(projection.dataSideQualification || '').toLowerCase();
    const consumable = ['allowed', 'allowed-with-warning'].includes(qualification)
      && !projection.quality?.hardFailure
      && !['unknown', 'failed', 'hard-failed', 'hard-fail'].includes(qualityStatus);
    const authoritativeRead = {
      receiptId: readEvent.eventId,
      owner: 'M02',
      source: 'owner-api',
      mode: 'authoritative-current-read',
      readAt: readEvent.occurredAt,
      static: false
    };
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      contractCode: 'C017',
      readId,
      purpose,
      consumer,
      requestedBy: input.requestedBy || input.actorRef || null,
      readAt: readEvent.occurredAt,
      scenarioContext: context,
      versionBindingSummary: summaries.versionBound,
      currentStateSummary: summaries.currentState,
      versionBoundSummary: summaries.versionBound,
      currentSummary: summaries.currentState,
      projection,
      readEvent,
      authoritativeRead,
      readReceipt: authoritativeRead,
      status: consumable ? 'ready' : (qualityStatus === 'unknown' ? 'unknown' : 'blocked'),
      consumptionReadiness: { status: consumable ? 'ready' : 'blocked' },
      restricted: true
    };
    const stored = this._put(this.c017Reads, readId, payload);
    this.events.set(readId, readEvent);
    return stored;
  }

  readC017Projection(input) { return this.readC017(input); }
  readC017Summary(input) { return this.readC017(input); }
  readTrustSummary(input) { return this.readC017(input); }
  readC017Safe(input = {}) {
    try {
      return { status: 'ok', response: this.readC017(input) };
    } catch (error) {
      const status = error.code === ERROR_CODES.NOT_FOUND ? 'version-unlocatable'
        : error.code === ERROR_CODES.CONTEXT_MISMATCH || error.code === ERROR_CODES.INVALID_CONTEXT ? 'context-mismatch'
          : error.code === ERROR_CODES.S003_NOT_CONSUMABLE ? 'non-consumable'
            : 'read-failed';
      return immutable({ status, errorCode: error.code, reason: error.message, scenarioContext: input.scenarioContext || null, assetVersionId: input.assetVersionId || input.t007Id || null });
    }
  }

  setConsumptionEvidence(assetVersionId, input = {}) {
    const version = this.getAssetVersion(assetVersionId);
    if (version.compatibilityOnly === true || version.consumption?.compatibilityOnly === true) fail(ERROR_CODES.S003_NOT_CONSUMABLE, 'S003 compatibility T007 can never become consumable');
    if (input.consumable === true && !input.t019Evidence) fail(ERROR_CODES.DELIVERY_BLOCKED, 'consumable status requires explicit T019 evidence');
    // Preserve immutable T007 and append an external status projection.
    const projection = immutable({ assetVersionId, status: input.status || (input.consumable ? 'consumable' : 'not-consumable'), consumable: input.consumable === true, evidence: input.t019Evidence ? clone(input.t019Evidence) : null, formedAt: this._now(input.formedAt) });
    return projection;
  }
}

function createDataRuntime(options) { return new DataPipelineRuntime(options); }

module.exports = Object.freeze({
  SCHEMA_VERSION,
  DATA_SPINE_CONTRACT_ID,
  RUNTIME_VERSION,
  STATUS,
  QUALITY_STATUS,
  ERROR_CODES,
  DataRuntimeError,
  DataPipelineRuntime,
  DataSpineRuntime: DataPipelineRuntime,
  createDataRuntime,
  createRuntime: createDataRuntime,
  stableSerialize,
  fingerprint,
  contentFingerprint,
  detectCycle,
  findCycle: detectCycle,
  assertAcyclic,
  evaluateQualityChecks,
  runQualityChecks,
  validateScenarioContext: validateContext,
  sameRunContext,
  sameExactContext,
  sameScenarioDefinition
});
