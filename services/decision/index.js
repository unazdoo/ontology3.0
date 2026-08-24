'use strict';

/*
 * M04 decision runtime.
 *
 * This module is deliberately storage agnostic.  The state object passed to
 * `stateStore` is the single C011-C013 source owned by M04.  C017 is only
 * accessed through the injected reader and only its minimum safety receipt is
 * retained.  A database/queue adapter can wrap the same transaction methods
 * without introducing another task store.
 */

const crypto = require('node:crypto');
const identity = require('../../packages/identity');
const checkpoint = require('../../packages/checkpoint');
const foundation = require('./foundation-adapter');

const SERVICE_VERSION = 'implementation-0.1.0';
const STATE_SCHEMA_VERSION = 'ofw.m04.decision-state.v1';
const REQUEST_SCHEMA_VERSION = 'ofw.m04.c011.action-request.v1';
const REMINDER_SCHEMA_VERSION = 'ofw.m04.c012.decision-reminder.v1';
const CONFIRMATION_SCHEMA_VERSION = 'ofw.m04.c012.human-decision.v1';
const TASK_SCHEMA_VERSION = 'ofw.m04.c013.owner-task.v1';
const C019_SCHEMA_VERSION = 'ofw.m04.c019.read-model.v1';
const RECEIPT_SCHEMA_VERSION = 'ofw.m04.receipt.v1';
const C017_RECEIPT_SCHEMA_VERSION = 'ofw.m04.c017-safety-receipt.v1';

const GATES = Object.freeze({
  REQUEST_RECEIPT: 'request_receipt',
  CONFIRMATION_SUBMIT: 'confirmation_submit',
  TASK_FORMATION: 'task_formation'
});

const READ_OUTCOMES = Object.freeze({
  ALLOWED: 'allowed',
  REJECTED: 'rejected',
  UNKNOWN: 'unknown',
  UNLOCATABLE: 'unlocatable',
  READ_ERROR: 'read_error',
  VERSION_CONFLICT: 'version_conflict'
});

const READ_ONLY_STATUSES = new Set(['historical-readonly', 'restored', 'regression', 'closed']);
const PUBLISHED_STATUSES = new Set(['published', 'PUBLISHED', '已发布', 'PUBLISHED-RESULTS', 'SUCCEEDED']);
const ALLOWED_QUALITY = new Set([
  'allowed', 'allow', 'ready', 'pass', 'passed', 'ok', '通过', '允许推进',
  '可消费', '可消费/允许推进', '消费就绪'
]);
const HARD_FAILURE_QUALITY = new Set([
  'failed', 'failure', 'hard_failure', 'hard-failure', 'rejected', 'error',
  '失败', '硬失败', '不允许推进', '不可消费'
]);

class DecisionError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
    this.details = details || null;
  }
}

function fail(code, message, details) {
  throw new DecisionError(code, message, details);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function freeze(value, seen) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  const visited = seen || new Set();
  if (visited.has(value)) return value;
  visited.add(value);
  Object.keys(value).forEach((key) => freeze(value[key], visited));
  return Object.freeze(value);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function valueText(value) {
  return text(value) ? value.trim() : '';
}

function nowIso(clock) {
  const value = typeof clock === 'function' ? clock() : clock;
  const date = value === undefined ? new Date() : value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_TIME', 'clock returned an invalid time');
  return date.toISOString();
}

function stableSerialize(value) {
  return identity.stableSerialize(value);
}

function digest(value, length = 24) {
  return crypto.createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex').slice(0, length);
}

function sameRun(left, right) {
  return identity.compareScenarioContext(left, right, { skipValidation: true });
}

function triple(context) {
  return {
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId
  };
}

function contextFrom(value) {
  if (isObject(value) && isObject(value.scenarioContext)) return value.scenarioContext;
  if (isObject(value) && isObject(value.scenarioIdentity)) return value.scenarioIdentity;
  return value;
}

function boolValue(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', 'y', '1', '是', '有', '否定失败'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', '否', '无', '不适用'].includes(normalized)) return false;
  return null;
}

function normalizeGate(value) {
  const gate = String(value || '').trim();
  if (Object.values(GATES).includes(gate)) return gate;
  const aliases = {
    receive: GATES.REQUEST_RECEIPT,
    receipt: GATES.REQUEST_RECEIPT,
    request: GATES.REQUEST_RECEIPT,
    confirm: GATES.CONFIRMATION_SUBMIT,
    confirmation: GATES.CONFIRMATION_SUBMIT,
    task: GATES.TASK_FORMATION,
    todo: GATES.TASK_FORMATION,
    assignment: GATES.TASK_FORMATION
  };
  return aliases[gate.toLowerCase()] || null;
}

function gateLabel(gate) {
  return {
    [GATES.REQUEST_RECEIPT]: 'C011 Action Request 接收前',
    [GATES.CONFIRMATION_SUBMIT]: 'C012 正向人工确认提交前',
    [GATES.TASK_FORMATION]: 'C013 负责人待办形成前'
  }[gate] || gate;
}

function normalizeQuality(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function qualityIsAllowed(value) {
  const normalized = normalizeQuality(value);
  return ALLOWED_QUALITY.has(normalized) || ALLOWED_QUALITY.has(normalized.toLowerCase());
}

function qualityIsHardFailure(value) {
  const normalized = normalizeQuality(value);
  return HARD_FAILURE_QUALITY.has(normalized) || HARD_FAILURE_QUALITY.has(normalized.toLowerCase());
}

function publicError(error) {
  if (!error) return null;
  return { code: error.code || 'ERROR', message: error.message || String(error), details: clone(error.details || null) };
}

function omitUndefined(value) {
  if (!isObject(value)) return value;
  const output = {};
  Object.keys(value).forEach((key) => {
    if (value[key] !== undefined) output[key] = value[key];
  });
  return output;
}

function readDataVersion(input) {
  const evidence = isObject(input.evidence) ? input.evidence : {};
  // `dataVersion` is the C011 double-version field.  T007 is kept separately
  // because data-engineering deliveries may expose a stable asset id beside
  // its human-readable version (for example `T007-...` and `1.0.0`).
  const value = input.dataVersion || evidence.dataVersion || input.t007Version
    || evidence.t007Version || input.t007 || evidence.t007 || input.dataAssetVersion
    || evidence.dataAssetVersion || input.assetVersion || evidence.assetVersion
    || input.dataAssetId || evidence.dataAssetId;
  return valueText(value);
}

function readT007(input, dataVersion) {
  const evidence = isObject(input.evidence) ? input.evidence : {};
  const value = input.t007 || input.t007Version || input.dataAssetId || input.dataAssetVersion
    || evidence.t007 || evidence.t007Version || evidence.dataAssetId || evidence.dataAssetVersion
    || input.assetVersion || evidence.assetVersion || dataVersion;
  return valueText(value);
}

function readSemanticVersion(input) {
  const evidence = isObject(input.evidence) ? input.evidence : {};
  return valueText(input.semanticVersion || input.publishedSemanticVersion || input.semanticVersionId
    || input.publishedVersion || input.ontologyVersion || evidence.semanticVersion || evidence.publishedSemanticVersion
    || evidence.publishedVersion || evidence.ontologyVersion);
}

function readActionType(input) {
  const raw = isObject(input.actionType) ? input.actionType : {};
  return {
    id: valueText(raw.id || raw.actionTypeId || input.actionTypeId),
    version: valueText(raw.version || raw.semanticVersion || input.actionTypeVersion),
    name: valueText(raw.name || raw.label) || null,
    status: raw.status === undefined ? null : raw.status
  };
}

function readSubject(input) {
  const subject = isObject(input.subject) ? input.subject : {};
  const id = valueText(input.subjectId || input.entityId || input.enterpriseId || subject.id || subject.subjectId);
  const name = valueText(input.subjectName || input.entityName || input.enterpriseName || subject.name || subject.subjectName) || null;
  return { id, name };
}

function readRule(input) {
  if (input.rule === null || input.rule === undefined) return null;
  if (!isObject(input.rule)) return { invalid: true };
  const rule = input.rule;
  return {
    id: valueText(rule.id || rule.ruleId),
    version: valueText(rule.version || rule.ruleVersion),
    evaluatedAt: valueText(rule.evaluatedAt || rule.evaluationTime),
    branch: valueText(rule.branch || rule.triggerBranch || rule.condition),
    hitEvidence: valueText(rule.hitEvidence || rule.evidence || rule.reason)
  };
}

function canonicalRule(input) {
  const rule = readRule(input);
  if (!rule) return { applicability: 'not_applicable', rule: null };
  if (rule.invalid) return { applicability: 'invalid', rule: null };
  const applicability = valueText(input.ruleApplicability || input.ruleApplicabilityStatus).toLowerCase();
  return { applicability: applicability || 'applicable', rule };
}

function canonicalMetric(input) {
  const metric = isObject(input.metric) ? input.metric : {};
  const evidence = isObject(input.evidence) ? input.evidence : {};
  return {
    id: valueText(metric.id || metric.metricId || evidence.metricId) || null,
    name: valueText(metric.name || metric.label) || null,
    value: metric.value === undefined ? null : clone(metric.value),
    unit: valueText(metric.unit) || null,
    scope: valueText(metric.scope || metric.objectScope) || null,
    evaluatedAt: valueText(metric.evaluatedAt || metric.evaluationTime) || null,
    explanation: valueText(metric.explanation || metric.triggerExplanation) || null,
    snapshotId: valueText(metric.snapshotId || metric.metricSnapshotId || evidence.metricSnapshotId) || null
  };
}

function canonicalEvidence(input, semanticVersion, dataVersion, t007) {
  const evidence = isObject(input.evidence) ? input.evidence : {};
  return {
    semanticVersion,
    dataVersion,
    t007: t007 || dataVersion,
    cutoff: valueText(input.cutoff || input.dataCutoff || evidence.cutoff || evidence.dataCutoff) || null,
    snapshotId: valueText(input.snapshotId || evidence.snapshotId || evidence.resultSnapshotId) || null,
    sourceResultId: valueText(input.sourceResultId || evidence.sourceResultId) || null,
    sourceResultVersion: valueText(input.sourceResultVersion || evidence.sourceResultVersion) || null,
    refs: Array.isArray(input.evidenceRefs) ? clone(input.evidenceRefs) : (Array.isArray(evidence.refs) ? clone(evidence.refs) : [])
  };
}

function normalizedEvidenceHasSnapshotAndCutoff(input) {
  const evidence = isObject(input?.evidence) ? input.evidence : {};
  const snapshot = input?.snapshotId || evidence.snapshotId;
  const cutoff = input?.cutoff || input?.dataCutoff || evidence.cutoff || evidence.dataCutoff;
  return text(snapshot) && text(cutoff);
}

function contractFingerprint(record) {
  return digest({
    requestId: record.requestId,
    scenarioContext: triple(record.scenarioContext),
    subjectId: record.subjectId,
    actionType: record.actionType,
    semanticVersion: record.semanticVersion,
    dataVersion: record.dataVersion,
    t007: record.t007 || null,
    rule: record.rule,
    ruleApplicability: record.ruleApplicability,
    metric: record.metric,
    evidence: record.evidence,
    sourceType: record.sourceType,
    sourceRef: record.sourceRef
  }, 64);
}

function idempotencyKey(record) {
  return [
    record.scenarioContext.scenarioId,
    record.scenarioContext.scenarioRunId,
    record.requestId,
    record.semanticVersion,
    record.dataVersion
  ].map((part) => String(part)).join('|');
}

function stableId(prefix, record, suffix) {
  const hash = digest({
    scenarioContext: triple(record.scenarioContext || record),
    requestId: record.requestId || record.id,
    semanticVersion: record.semanticVersion,
    dataVersion: record.dataVersion,
    t007: record.t007 || null,
    suffix: suffix || null
  }, 20).toUpperCase();
  return `${prefix}-${hash}`;
}

function sanitizeNavigationContext(value, context, subjectId, subjectName) {
  const input = isObject(value) ? value : {};
  const normalized = {
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    sourceScenario: valueText(input.sourceScenario || input.sourceScene || input.sourceModule) || context.scenarioId,
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId,
    scenarioStatus: context.status || 'active',
    subjectId: subjectId || valueText(input.subjectId) || null,
    filters: isObject(input.filters) ? clone(input.filters) : (isObject(input.filter) ? clone(input.filter) : {}),
    selectedComponent: valueText(input.selectedComponent) || null,
    scrollPosition: input.scrollPosition === undefined ? null : input.scrollPosition,
    returnPosition: valueText(input.returnPosition || input.returnTo || input.returnRoute) || null,
    issuedAt: valueText(input.issuedAt) || null
  };
  // C019/CR011 names retained as aliases for report-center consumers.
  normalized.sourceScene = normalized.sourceScenario;
  normalized.businessSubject = subjectName || valueText(input.businessSubject || input.subjectName) || normalized.subjectId;
  normalized.subjectName = subjectName || valueText(input.businessSubject || input.subjectName) || null;
  normalized.filter = normalized.filters;
  normalized.returnRoute = normalized.returnPosition;
  return freeze(normalized);
}

function hasForbiddenC017Copy(value, path, findings) {
  const result = findings || [];
  if (!value || typeof value !== 'object') return result;
  if (Array.isArray(value)) {
    value.forEach((item, index) => hasForbiddenC017Copy(item, `${path}[${index}]`, result));
    return result;
  }
  if (value.contractCode === 'C017' && value.schemaVersion !== C017_RECEIPT_SCHEMA_VERSION) {
    // A C011 may carry a small upstream quality-source locator.  It is a
    // reference, not a projection, when it contains only summary identity and
    // an evidence locator.  Full projections/containers remain forbidden.
    const referenceOnly = !('projections' in value) && !('gates' in value)
      && !('currentStateSummary' in value) && !('sourceRefs' in value)
      && Boolean(value.summaryId || value.summaryVersion || value.evidenceLocator);
    if (!referenceOnly) result.push(`${path}.contractCode`);
  }
  Object.keys(value).forEach((key) => {
    if (/^c017(?:Projection|Snapshot|Payload|Data|State|Copy)?$/i.test(key)
      || /^quality(?:Projection|Snapshot|Copy)$/i.test(key)) {
      result.push(`${path}.${key}`);
    }
    hasForbiddenC017Copy(value[key], `${path}.${key}`, result);
  });
  return result;
}

function immutableRequestSource(source) {
  if (!isObject(source)) return null;
  // Keep provenance fields needed for replay/audit, but never retain arbitrary
  // source payloads (which could accidentally include a second C017 or task
  // projection).  M04's canonical fields are stored alongside this snapshot.
  const allowed = [
    'requestId', 'id', 'actionRequestId', 'scenarioContext', 'scenarioIdentity',
    'subjectId', 'subjectName', 'entityId', 'enterpriseId', 'sourceType', 'sourceRef',
    'requester', 'submittedBy', 'actionType', 'actionTypeId', 'actionTypeVersion',
    'semanticVersion', 'publishedSemanticVersion', 'dataVersion', 't007', 't007Version',
    'dataAssetId', 'dataAssetVersion', 'rule', 'ruleApplicability', 'metric', 'evidence',
    'evidenceRefs', 'recommendation', 'routing', 'decisionRecipient', 'requestedOwner',
    'owner', 'cutoff', 'dataCutoff', 'sourceResultId', 'sourceResultVersion'
  ];
  const output = {};
  allowed.forEach((key) => {
    if (source[key] === undefined) return;
    if (key === 'evidence' && isObject(source[key])) {
      const evidence = source[key];
      output[key] = {};
      ['cutoff', 'dataCutoff', 'snapshotId', 'sourceResultId', 'sourceResultVersion', 'metricSnapshotId', 'dataVersion', 't007', 'semanticVersion'].forEach((field) => {
        if (evidence[field] !== undefined) output[key][field] = clone(evidence[field]);
      });
      return;
    }
    output[key] = clone(source[key]);
  });
  return output;
}

function assertContext(context, expected) {
  let normalized;
  try {
    normalized = foundation.assertStrictScenarioContext(context);
  } catch (error) {
    fail('INVALID_SCENARIO_CONTEXT', 'M04 requires a strict Foundation C033 scenario context', { cause: publicError(error) });
  }
  if (expected && !sameRun(normalized, expected)) {
    fail('SCENARIO_CONTEXT_MISMATCH', 'resource context does not match the active scenario run', {
      expected: triple(expected), actual: triple(normalized),
      mismatches: identity.compareScenarioContextDetailed(normalized, expected, { skipValidation: true }).mismatches
    });
  }
  return normalized;
}

function initialState(context) {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    moduleId: 'M04',
    serviceVersion: SERVICE_VERSION,
    stateRevision: 0,
    scenarioContext: clone(context),
    requests: [],
    reminders: [],
    confirmations: [],
    todos: [],
    notifications: [],
    receipts: [],
    activities: []
  };
}

function syncStateAliases(state) {
  state.requests.forEach((request) => {
    request.status = request.requestStatus;
    request.decisionStatus = request.confirmationStatus;
    request.todoStatus = request.taskStatus;
    Object.defineProperty(request, 'c017SafetyReads', {
      enumerable: false,
      configurable: true,
      get() { return request.c017Reads; }
    });
    const latestGate = (gate) => [...(request.c017Reads || [])].reverse().find((item) => item.gate === gate) || null;
    request.requestGate = latestGate(GATES.REQUEST_RECEIPT);
    request.confirmationGate = latestGate(GATES.CONFIRMATION_SUBMIT);
    request.taskGate = latestGate(GATES.TASK_FORMATION);
    Object.defineProperty(request, 'c017Receipt', {
      enumerable: false,
      configurable: true,
      get() { return request.requestGate; }
    });
  });
  state.confirmations.forEach((confirmation) => {
    confirmation.status = confirmation.decision === 'confirm' ? 'confirmed' : confirmation.decision === 'reject' ? 'rejected' : (confirmation.status || 'pending');
  });
  state.todos.forEach((task) => { task.status = task.status || 'pending'; });
  return state;
}

function normalizeState(input, context) {
  if (!input) return initialState(context);
  if (!isObject(input)) fail('INVALID_STATE', 'M04 state must be an object');
  const forbidden = hasForbiddenC017Copy(input, '$');
  if (forbidden.length) fail('C017_COPY_FORBIDDEN', 'M04 state must not contain a C017 projection copy', { paths: forbidden });
  if (input.schemaVersion !== STATE_SCHEMA_VERSION) {
    fail('STATE_SCHEMA_INCOMPATIBLE', 'M04 state schema must match the exact registered implementation version', {
      expected: STATE_SCHEMA_VERSION,
      actual: input.schemaVersion || null
    });
  }
  const state = {
    ...initialState(context),
    ...clone(input),
    scenarioContext: clone(input.scenarioContext || context)
  };
  assertContext(state.scenarioContext, context);
  ['requests', 'reminders', 'confirmations', 'todos', 'notifications', 'receipts', 'activities'].forEach((key) => {
    if (!Array.isArray(state[key])) fail('INVALID_STATE', `${key} must be an array`);
  });
  const ownedSchemas = {
    requests: REQUEST_SCHEMA_VERSION,
    reminders: REMINDER_SCHEMA_VERSION,
    confirmations: CONFIRMATION_SCHEMA_VERSION,
    todos: TASK_SCHEMA_VERSION
  };
  Object.entries(ownedSchemas).forEach(([key, expectedSchema]) => {
    state[key].forEach((record, index) => {
      if (record?.schemaVersion !== expectedSchema) {
        fail('STATE_RECORD_SCHEMA_INCOMPATIBLE', `${key}[${index}] schema must match the exact M04 contract version`, {
          path: `${key}[${index}].schemaVersion`, expected: expectedSchema, actual: record?.schemaVersion || null
        });
      }
    });
  });
  syncStateAliases(state);
  return state;
}

function safeInputForC017(record, gate) {
  return freeze({
    contractCode: 'C017',
    consumer: '决策中心',
    purpose: 'C011-C013 safety gate',
    gate,
    t007: record.t007 || record.dataVersion,
    dataVersion: record.dataVersion,
    scenarioContext: clone(record.scenarioContext),
    scenarioIdentity: triple(record.scenarioContext)
  });
}

function extractProjection(raw, record, gate) {
  if (!raw) return { outcome: READ_OUTCOMES.UNLOCATABLE, reason: 'C017 摘要不可定位' };
  if (raw instanceof Error) return { outcome: READ_OUTCOMES.READ_ERROR, reason: raw.message, error: publicError(raw) };
  if (isObject(raw) && raw.ok === false) {
    return { outcome: READ_OUTCOMES.READ_ERROR, reason: valueText(raw.reason || raw.message) || 'C017 权威读取失败', error: clone(raw.error || null) };
  }
  let envelope = Array.isArray(raw) ? { projections: raw } : raw;
  if (isObject(raw) && raw.projection && isObject(raw.projection)) {
    envelope = { ...raw.projection, scenarioContext: raw.projection.scenarioContext || raw.scenarioContext, contractCode: raw.projection.contractCode || raw.contractCode, consumer: raw.projection.consumer || raw.consumer };
  }
  if (isObject(raw) && raw.payload && isObject(raw.payload) && (raw.contractCode === 'C017' || raw.payload.contractCode === 'C017')) {
    envelope = { ...raw.payload, scenarioContext: raw.payload.scenarioContext || raw.scenarioContext, contractCode: raw.payload.contractCode || raw.contractCode, consumer: raw.payload.consumer || raw.consumer };
  }
  if (isObject(raw) && raw.value && isObject(raw.value) && !envelope.projections && !envelope.currentStateSummary) {
    envelope = { ...raw.value, scenarioContext: raw.value.scenarioContext || raw.scenarioContext, contractCode: raw.value.contractCode || raw.contractCode, consumer: raw.value.consumer || raw.consumer };
  }
  if (!isObject(envelope)) return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 返回状态未知' };

  const envelopeContext = contextFrom(envelope);
  if (!envelopeContext || (!envelopeContext.scenarioId && !envelopeContext.scenarioVersion && !envelopeContext.scenarioRunId)) {
    return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 返回缺少场景运行身份' };
  }
  const strictEnvelopeContext = foundation.strictScenarioContextResult(envelopeContext);
  if (!strictEnvelopeContext.valid) {
    return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 场景运行身份未通过 Foundation strict 校验', validationErrors: strictEnvelopeContext.errors };
  }
  if (envelopeContext && (envelopeContext.scenarioId || envelopeContext.scenarioVersion || envelopeContext.scenarioRunId)
      && !sameRun(envelopeContext, record.scenarioContext)) {
    return { outcome: READ_OUTCOMES.VERSION_CONFLICT, reason: 'C017 返回的场景轮次与请求不一致', conflict: true };
  }
  if (READ_ONLY_STATUSES.has(String(envelopeContext.status || '').toLowerCase())
      && !READ_ONLY_STATUSES.has(String(record.scenarioContext.status || '').toLowerCase())) {
    return { outcome: READ_OUTCOMES.VERSION_CONFLICT, reason: 'C017 返回的是历史/只读轮次', conflict: true };
  }
  if (envelope.contractCode && envelope.contractCode !== 'C017') {
    return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 返回合同标识不正确' };
  }
  if (envelope.consumer && envelope.consumer !== '决策中心' && envelope.consumer !== 'M04') {
    return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 返回投影不是决策中心最小安全投影' };
  }

  let projection = envelope;
  const expectedT007 = new Set([record.t007, record.dataVersion].filter(Boolean).map(String));
  if (Array.isArray(envelope.projections)) {
    const versionedProjections = envelope.projections.filter((item) => {
      if (!isObject(item)) return false;
      return Boolean(item.dataVersion || item.t007 || item.dataAssetId || item.dataAssetVersion);
    });
    projection = envelope.projections.find((item) => {
      if (!isObject(item)) return false;
      const versions = [item.dataVersion, item.t007, item.dataAssetId, item.dataAssetVersion].filter(Boolean).map(String);
      return versions.length === 0 || versions.every((version) => expectedT007.has(version));
    });
    if (!projection) {
      return versionedProjections.length
        ? { outcome: READ_OUTCOMES.VERSION_CONFLICT, reason: 'C017 未返回请求锁定的精确数据版本', conflict: true }
        : { outcome: READ_OUTCOMES.UNLOCATABLE, reason: '精确 T007 在 C017 中不可定位' };
    }
  }
  const projectionVersions = [projection.dataVersion, projection.t007, projection.dataAssetId, projection.dataAssetVersion].filter(Boolean).map(String);
  if (projectionVersions.some((version) => !expectedT007.has(version))) {
    return { outcome: READ_OUTCOMES.VERSION_CONFLICT, reason: 'C017 返回了不同的数据版本', conflict: true };
  }
  const projectionContext = contextFrom(projection);
  if (projectionContext && (projectionContext.scenarioId || projectionContext.scenarioVersion || projectionContext.scenarioRunId)) {
    const strictProjectionContext = foundation.strictScenarioContextResult(projectionContext);
    if (!strictProjectionContext.valid) {
      return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 摘要场景身份未通过 Foundation strict 校验', validationErrors: strictProjectionContext.errors };
    }
  }
  if (projectionContext && (projectionContext.scenarioId || projectionContext.scenarioVersion || projectionContext.scenarioRunId)
      && !sameRun(projectionContext, record.scenarioContext)) {
    return { outcome: READ_OUTCOMES.VERSION_CONFLICT, reason: 'C017 摘要场景轮次与请求不一致', conflict: true };
  }
  let gateRecord = projection;
  if (isObject(projection.gates)) {
    if (!isObject(projection.gates[gate])) return { outcome: READ_OUTCOMES.UNLOCATABLE, reason: `C017 未提供 ${gate} 的独立安全摘要` };
    gateRecord = projection.gates[gate];
  }
  const readStatus = valueText(gateRecord.readStatus || projection.readStatus || envelope.readStatus).toLowerCase();
  if (['not_found', 'not-found', 'unlocatable', '不可定位', '未定位'].includes(readStatus)) {
    return { outcome: READ_OUTCOMES.UNLOCATABLE, reason: valueText(gateRecord.reason || projection.reason || envelope.reason) || 'C017 摘要不可定位' };
  }
  if (['failed', 'error', 'unavailable', '读取失败'].includes(readStatus)) {
    return { outcome: READ_OUTCOMES.READ_ERROR, reason: valueText(gateRecord.reason || projection.reason || envelope.reason) || 'C017 读取失败' };
  }
  if (['unknown', '未知', 'indeterminate'].includes(readStatus)) {
    return { outcome: READ_OUTCOMES.UNKNOWN, reason: valueText(gateRecord.reason || projection.reason || envelope.reason) || 'C017 状态未知' };
  }
  const directSummary = (gateRecord.summaryId || gateRecord.currentStateSummaryId)
    ? {
      id: gateRecord.summaryId || gateRecord.currentStateSummaryId,
      version: gateRecord.summaryVersion || gateRecord.currentStateSummaryVersion,
      formedAt: gateRecord.summaryFormedAt || gateRecord.currentStateSummaryFormedAt,
      qualityStatus: gateRecord.qualityStatus,
      hardQualityFailure: gateRecord.hardQualityFailure,
      detectedAt: gateRecord.detectedAt,
      impactScope: gateRecord.impactScope,
      businessFieldCategories: gateRecord.businessFieldCategories,
      reason: gateRecord.reason,
      recovery: gateRecord.recovery,
      evidenceLocator: gateRecord.evidenceLocator
    }
    : null;
  const summary = gateRecord.currentStateSummary || projection.currentStateSummary || gateRecord.summary || projection.summary || directSummary;
  if (!isObject(summary)) return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 当前状态摘要未知' };
  const summaryId = valueText(summary.id || summary.summaryId || gateRecord.summaryId || projection.summaryId);
  const summaryVersion = valueText(summary.version || summary.summaryVersion || gateRecord.summaryVersion || projection.summaryVersion);
  const summaryFormedAt = valueText(summary.formedAt || summary.summaryFormedAt || gateRecord.summaryFormedAt || projection.summaryFormedAt);
  if (!summaryId || !summaryVersion || !summaryFormedAt || !identity.isDateTime(summaryFormedAt)) {
    return { outcome: READ_OUTCOMES.UNKNOWN, reason: 'C017 当前状态摘要身份不完整' };
  }
  const rawOutcome = valueText(gateRecord.outcome || projection.outcome || envelope.outcome || gateRecord.status || projection.status || envelope.status).toLowerCase();
  const qualityStatus = normalizeQuality(gateRecord.qualityStatus || summary.qualityStatus || projection.qualityStatus || envelope.qualityStatus
    || (gateRecord.allowed === true || projection.allowed === true || envelope.allowed === true || ['allowed', 'pass', 'passed', 'ready'].includes(rawOutcome) ? 'allowed' : rawOutcome === 'rejected' ? 'rejected' : null));
  const hardValue = gateRecord.hardQualityFailure ?? gateRecord.hardFailure ?? summary.hardQualityFailure ?? summary.hardFailure
    ?? projection.hardQualityFailure ?? projection.hardFailure ?? envelope.hardQualityFailure ?? envelope.hardFailure
    ?? (gateRecord.allowed === true || projection.allowed === true || envelope.allowed === true || rawOutcome === 'allowed' ? false : rawOutcome === 'rejected' ? true : undefined);
  const hardFailure = boolValue(hardValue);
  const readAt = nowIso(record.__clock);
  const base = {
    schemaVersion: C017_RECEIPT_SCHEMA_VERSION,
    contractCode: 'C017',
    readReceiptId: `C017READ-${digest({ requestId: record.requestId, gate, t007: record.t007 || record.dataVersion, summaryId, summaryVersion, readAt }, 20).toUpperCase()}`,
    gate,
    gateLabel: gateLabel(gate),
    t007: record.t007 || record.dataVersion,
    dataVersion: record.dataVersion,
    scenarioContext: clone(record.scenarioContext),
    scenarioIdentity: triple(record.scenarioContext),
    summaryId,
    summaryVersion,
    summaryFormedAt,
    currentStateSummaryId: summaryId,
    currentStateSummaryVersion: summaryVersion,
    currentStateSummaryFormedAt: summaryFormedAt,
    readAt,
    readTime: readAt,
    qualityStatus: qualityStatus || null,
    hardQualityFailure: hardFailure,
    hardFailure,
    detectedAt: valueText(gateRecord.detectedAt || summary.detectedAt || projection.detectedAt) || null,
    impactScope: valueText(gateRecord.impactScope || summary.impactScope || projection.impactScope) || null,
    businessFieldCategories: valueText(gateRecord.businessFieldCategories || summary.businessFieldCategories || projection.businessFieldCategories) || null,
    reason: valueText(gateRecord.reason || summary.reason || projection.reason) || null,
    recovery: valueText(gateRecord.recovery || summary.recovery || projection.recovery) || null,
    evidenceLocator: valueText(gateRecord.evidenceLocator || summary.evidenceLocator || projection.evidenceLocator) || null
  };
  if (hardFailure === true || qualityIsHardFailure(qualityStatus)) return { ...base, outcome: READ_OUTCOMES.REJECTED };
  if (hardFailure === false && qualityIsAllowed(qualityStatus)) return { ...base, outcome: READ_OUTCOMES.ALLOWED };
  if (hardFailure === null && qualityIsHardFailure(qualityStatus)) return { ...base, outcome: READ_OUTCOMES.REJECTED, hardQualityFailure: true };
  return { ...base, outcome: READ_OUTCOMES.UNKNOWN, reason: base.reason || 'C017 质量状态未知' };
}

function parseReadError(error) {
  return error instanceof DecisionError ? error : new DecisionError('C017_READ_ERROR', error?.message || String(error), { cause: publicError(error) });
}

class DecisionService {
  constructor(options = {}) {
    this.options = { ...options };
    this.strictContract = options.strictContract === true;
    this.context = assertContext(options.scenarioContext || options.context);
    this.clock = options.clock || options.now;
    this.c017Reader = options.c017Reader || options.readC017 || options.c017 || null;
    if (!this.c017Reader) fail('C017_READER_REQUIRED', 'M04 requires an injected read-only C017 reader');
    const readerCandidate = typeof this.c017Reader === 'function'
      ? this.c017Reader
      : this.c017Reader.read || this.c017Reader.readC017;
    this.readerIsAsync = options.c017ReaderAsync === true || readerCandidate?.constructor?.name === 'AsyncFunction';
    this.taskWriter = options.taskWriter || options.todoWriter || null;
    this.notificationWriter = options.notificationWriter || options.notify || null;
    this.stateStore = options.stateStore || options.repository || null;
    this._inFlight = new Map();
    this._storeKey = `${this.context.scenarioId}:${this.context.scenarioVersion}:${this.context.scenarioRunId}:M04`;
    let loaded;
    if (this.stateStore instanceof Map) loaded = this.stateStore.get(this._storeKey);
    else if (this.stateStore && typeof this.stateStore.load === 'function') loaded = this.stateStore.load();
    else if (this.stateStore && typeof this.stateStore.getState === 'function') loaded = this.stateStore.getState();
    const suppliedState = loaded || options.initialState;
    if (suppliedState && READ_ONLY_STATUSES.has(String(suppliedState.scenarioContext?.status || '').toLowerCase())
      && !READ_ONLY_STATUSES.has(String(this.context.status || '').toLowerCase())) {
      fail('STATE_LIFECYCLE_MISMATCH', 'an active M04 service cannot reopen a historical/read-only state');
    }
    this._state = normalizeState(suppliedState, this.context);
    this._state.scenarioContext = clone(this.context);
  }

  _now() {
    return nowIso(this.clock);
  }

  _assertWritable() {
    this._refreshState();
    if (READ_ONLY_STATUSES.has(String(this.context.status || '').toLowerCase())) {
      fail('HISTORICAL_READ_ONLY', 'historical, restored or regression scenario contexts are read-only');
    }
  }

  _refreshState() {
    if (this.stateStore instanceof Map) {
      const loaded = this.stateStore.get(this._storeKey);
      if (loaded) {
        if (READ_ONLY_STATUSES.has(String(loaded.scenarioContext?.status || '').toLowerCase())
          && !READ_ONLY_STATUSES.has(String(this.context.status || '').toLowerCase())) {
          fail('STATE_LIFECYCLE_MISMATCH', 'an active M04 service cannot reopen a historical/read-only state');
        }
        this._state = normalizeState(loaded, this.context);
      }
      return;
    }
    if (!this.stateStore) return;
    const loaded = typeof this.stateStore.load === 'function'
      ? this.stateStore.load()
      : typeof this.stateStore.getState === 'function' ? this.stateStore.getState() : null;
    if (loaded) {
      if (READ_ONLY_STATUSES.has(String(loaded.scenarioContext?.status || '').toLowerCase())
        && !READ_ONLY_STATUSES.has(String(this.context.status || '').toLowerCase())) {
        fail('STATE_LIFECYCLE_MISMATCH', 'an active M04 service cannot reopen a historical/read-only state');
      }
      this._state = normalizeState(loaded, this.context);
    }
  }

  _saveState() {
    if (this.stateStore instanceof Map) {
      this.stateStore.set(this._storeKey, clone(this._state));
      return;
    }
    if (!this.stateStore) return;
    if (typeof this.stateStore.save === 'function') this.stateStore.save(clone(this._state));
    else if (typeof this.stateStore.setState === 'function') this.stateStore.setState(clone(this._state));
  }

  _commit(mutator) {
    const previous = this._state;
    const candidate = clone(this._state);
    const value = mutator(candidate);
    candidate.stateRevision = Number.isInteger(candidate.stateRevision) ? candidate.stateRevision + 1 : 1;
    normalizeState(candidate, this.context);
    this._state = candidate;
    try {
      this._saveState();
    } catch (error) {
      this._state = previous;
      throw error;
    }
    return value;
  }

  _audit(eventType, record, input, refs = {}) {
    const actorRef = valueText(input?.actorRef || input?.actor || input?.submittedBy || input?.operator) || 'm04-system';
    const requestRef = record?.requestId || record?.id || null;
    const traceId = valueText(input?.traceId || input?.traceparent) || `tr-${digest({ eventType, requestId: requestRef, context: triple(this.context) }, 24)}`;
    const correlationId = valueText(input?.correlationId) || traceId;
    return {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      eventType,
      eventId: `EV-${digest({ eventType, traceId, at: this._now(), requestId: requestRef }, 20).toUpperCase()}`,
      occurredAt: this._now(),
      actorRef,
      traceId,
      correlationId,
      idempotencyKey: record?.idempotencyKey || null,
      scenarioContext: clone(this.context),
      resourceRefs: Object.keys(refs).map((type) => ({ type, id: refs[type] })).filter((item) => item.id),
      evidenceRefs: record?.evidence?.refs ? clone(record.evidence.refs) : [],
      payload: {}
    };
  }

  _normalizeRequest(input) {
    if (!isObject(input)) fail('REQUEST_CONTRACT_INVALID', 'Action Request must be an object');
    let envelope = null;
    if (isObject(input.payload)) {
      try {
        envelope = foundation.assertContractEnvelope(input);
      } catch (error) {
        fail('CONTRACT_ENVELOPE_INVALID', 'M04 requires a strict Foundation Contract Envelope', { cause: publicError(error) });
      }
    }
    const envelopeMetadata = envelope || input;
    const source = envelope
      ? {
        ...clone(envelope.payload),
        scenarioContext: envelope.payload.scenarioContext || envelope.scenarioContext,
        scenarioIdentity: envelope.payload.scenarioIdentity || envelope.scenarioIdentity,
        traceId: envelope.payload.traceId || envelope.traceId,
        correlationId: envelope.payload.correlationId || envelope.correlationId,
        actorRef: envelope.payload.actorRef || envelope.actorRef,
        evidenceRefs: envelope.payload.evidenceRefs || envelope.evidenceRefs
      }
      : clone(input);
    const forbidden = hasForbiddenC017Copy(source, '$');
    if (forbidden.length) fail('C017_COPY_FORBIDDEN', 'Action Request must not carry a C017 projection copy', { paths: forbidden });
    if (source.schemaVersion !== undefined && source.schemaVersion !== REQUEST_SCHEMA_VERSION) {
      fail('REQUEST_SCHEMA_INCOMPATIBLE', 'C011 Action Request schema must match the exact registered M04 version', {
        expected: REQUEST_SCHEMA_VERSION,
        actual: source.schemaVersion
      });
    }
    const requestContext = contextFrom(source);
    assertContext(requestContext, this.context);
    if (READ_ONLY_STATUSES.has(String(requestContext.status || '').toLowerCase())
      && !READ_ONLY_STATUSES.has(String(this.context.status || '').toLowerCase())) {
      fail('SCENARIO_CONTEXT_MISMATCH', 'a historical/read-only request cannot be written into an active run');
    }
    const requestId = valueText(source.requestId || source.id || source.actionRequestId);
    const subject = readSubject(source);
    const actionType = readActionType(source);
    const semanticVersion = readSemanticVersion(source);
    const dataVersion = readDataVersion(source);
    const t007 = readT007(source, dataVersion);
    const ruleInfo = canonicalRule(source);
    const metric = canonicalMetric(source);
    const problems = [];
    if (!requestId) problems.push({ field: 'requestId', reason: 'required' });
    if (!subject.id) problems.push({ field: 'subjectId', reason: 'required' });
    if (!actionType.id || !actionType.version) problems.push({ field: 'actionType', reason: 'published action type id/version required' });
    if (actionType.status !== null && !PUBLISHED_STATUSES.has(String(actionType.status))) problems.push({ field: 'actionType.status', reason: 'must be published' });
    if (this.strictContract && actionType.status === null) problems.push({ field: 'actionType.status', reason: 'published status is required' });
    if (this.strictContract && !subject.name) problems.push({ field: 'subjectName', reason: 'subject name is required' });
    if (!semanticVersion) problems.push({ field: 'semanticVersion', reason: 'exact published semantic version required' });
    if (!dataVersion) problems.push({ field: 'dataVersion', reason: 'exact T007 data version required' });
    if (ruleInfo.invalid) problems.push({ field: 'rule', reason: 'rule must be an object or omitted' });
    const sourceType = valueText(source.sourceType || source.source?.type) || 'unknown';
    const isRuleSource = /rule/i.test(sourceType);
    if (ruleInfo.applicability === 'applicable' && ruleInfo.rule
      && (!ruleInfo.rule.id || !ruleInfo.rule.version || !ruleInfo.rule.evaluatedAt || !ruleInfo.rule.branch || !ruleInfo.rule.hitEvidence)) {
      problems.push({ field: 'rule', reason: 'applicable Rule requires id/version/evaluatedAt/branch/hitEvidence' });
    }
    if (isRuleSource && (!ruleInfo.rule || !ruleInfo.rule.id || !ruleInfo.rule.version || !ruleInfo.rule.evaluatedAt || !ruleInfo.rule.branch || !ruleInfo.rule.hitEvidence)) {
      problems.push({ field: 'rule', reason: 'Rule source requires complete hit evidence' });
    }
    if (this.strictContract) {
      if (!metric.id || metric.value === null || metric.value === undefined) problems.push({ field: 'metric', reason: 'metric snapshot id/value is required' });
      if (!normalizedEvidenceHasSnapshotAndCutoff(source)) problems.push({ field: 'evidence', reason: 'evidence snapshot and data cutoff are required' });
    }
    if (Array.isArray(source.subjects) && source.subjects.length !== 1) problems.push({ field: 'subjects', reason: 'exactly one business subject is required' });
    ['autoConfirm', 'automaticConfirmation', 'autoCreateTodo', 'automaticTodo', 'todoId', 'taskId'].forEach((field) => {
      if (source[field] === true || (field.endsWith('Id') && source[field])) problems.push({ field, reason: 'source cannot carry M04 side effects' });
    });
    const normalized = {
      schemaVersion: REQUEST_SCHEMA_VERSION,
      contractCode: 'C011',
      requestId,
      id: requestId,
      scenarioContext: clone(this.context),
      scenarioIdentity: triple(this.context),
      subjectId: subject.id,
      subjectName: subject.name,
      scenario: valueText(source.scenario || source.scenarioName) || null,
      sourceType,
      sourceRef: valueText(source.sourceRef || source.sourceId) || null,
      requester: valueText(source.requester || source.submittedBy) || null,
      submittedBy: valueText(source.submittedBy || source.requester) || null,
      actionType,
      semanticVersion,
      dataVersion,
      t007,
      rule: ruleInfo.rule,
      ruleApplicability: ruleInfo.rule ? 'applicable' : 'not_applicable',
      metric,
      evidence: canonicalEvidence(source, semanticVersion, dataVersion, t007),
      recommendation: source.recommendation === undefined ? null : clone(source.recommendation),
      routing: source.routing ? clone(source.routing) : null,
      decisionRecipient: source.decisionRecipient ? clone(source.decisionRecipient) : null,
      requestedOwner: valueText(source.requestedOwner || source.owner) || null,
      original: source
    };
    normalized.idempotencyKey = idempotencyKey(normalized);
    normalized.callerIdempotencyKey = valueText(envelopeMetadata.idempotencyKey) || null;
    normalized.contractFingerprint = contractFingerprint(normalized);
    if (problems.length) {
      const error = new DecisionError('REQUEST_CONTRACT_INVALID', 'C011 Action Request contract rejected', { problems });
      error.normalized = normalized;
      throw error;
    }
    return normalized;
  }

  _readerFunction() {
    if (typeof this.c017Reader === 'function') return this.c017Reader;
    if (this.c017Reader && typeof this.c017Reader.read === 'function') return this.c017Reader.read.bind(this.c017Reader);
    if (this.c017Reader && typeof this.c017Reader.readC017 === 'function') return this.c017Reader.readC017.bind(this.c017Reader);
    fail('C017_READER_INVALID', 'C017 reader must be a function or expose read()');
  }

  _readC017(record, gate) {
    const query = safeInputForC017({ ...record, __clock: this.clock }, gate);
    let raw;
    try {
      raw = this._readerFunction()(query, gate, clone(this.context));
    } catch (error) {
      const parsed = parseReadError(error);
      return {
        schemaVersion: C017_RECEIPT_SCHEMA_VERSION,
        contractCode: 'C017',
        gate,
        gateLabel: gateLabel(gate),
        t007: record.t007 || record.dataVersion,
        dataVersion: record.dataVersion,
        scenarioContext: clone(record.scenarioContext),
        scenarioIdentity: triple(record.scenarioContext),
        readAt: this._now(),
        outcome: READ_OUTCOMES.READ_ERROR,
        reason: parsed.message,
        error: publicError(parsed)
      };
    }
    if (raw && typeof raw.then === 'function') fail('ASYNC_C017_READER', 'C017 reader returned a Promise; use the async operation API');
    try {
      const receipt = extractProjection(raw, { ...record, __clock: this.clock }, gate);
      return omitUndefined(receipt);
    } catch (error) {
      const parsed = parseReadError(error);
      return {
        schemaVersion: C017_RECEIPT_SCHEMA_VERSION,
        contractCode: 'C017',
        gate,
        gateLabel: gateLabel(gate),
        t007: record.t007 || record.dataVersion,
        dataVersion: record.dataVersion,
        scenarioContext: clone(record.scenarioContext),
        scenarioIdentity: triple(record.scenarioContext),
        readAt: this._now(),
        outcome: READ_OUTCOMES.READ_ERROR,
        reason: parsed.message,
        error: publicError(parsed)
      };
    }
  }

  readC017Safety(requestOrId, gate) {
    const normalizedGate = normalizeGate(gate);
    if (!normalizedGate) fail('C017_GATE_INVALID', 'unknown C017 safety gate');
    const request = typeof requestOrId === 'string' ? this._findRequest(requestOrId) : requestOrId;
    const record = request && request.requestId ? request : this._normalizeRequest(requestOrId);
    if (this.readerIsAsync) {
      return this._readC017RawAsync(record, normalizedGate).then((raw) => freeze(clone(extractProjection(raw, { ...record, __clock: this.clock }, normalizedGate))));
    }
    return freeze(clone(this._readC017(record, normalizedGate)));
  }

  readC017SafetyProjection(requestOrId, gate) { return this.readC017Safety(requestOrId, gate); }

  async _readC017RawAsync(record, gate) {
    const query = safeInputForC017({ ...record, __clock: this.clock }, gate);
    try {
      return await this._readerFunction()(query, gate, clone(this.context));
    } catch (error) {
      // Preserve a read failure as a gate receipt instead of turning an
      // unavailable authority into an unrecorded application exception.
      return new Error(parseReadError(error).message);
    }
  }

  _adoptTransient(transient, beforeFingerprint) {
    this._refreshState();
    if (beforeFingerprint && digest(this._state) !== beforeFingerprint) {
      fail('CONCURRENT_STATE_CHANGED', 'M04 state changed while an asynchronous gate was being read; retry the operation');
    }
    this._state = transient._state;
    this._saveState();
  }

  async _runWithAsyncGate(raw, operation, beforeFingerprint) {
    const transient = new DecisionService({
      scenarioContext: this.context,
      c017Reader: () => raw,
      clock: this.clock,
      initialState: this._state,
      taskWriter: this.taskWriter,
      notificationWriter: this.notificationWriter
    });
    const result = operation(transient);
    this._adoptTransient(transient, beforeFingerprint);
    return result;
  }

  _appendReceipt(state, receipt) {
    const value = clone(receipt);
    if (!value.receiptId) {
      value.receiptId = `RCPT-${digest({ kind: value.kind, requestId: value.requestId || null, gate: value.gate || null, occurredAt: value.occurredAt || null, ordinal: state.receipts.length }, 20).toUpperCase()}`;
    }
    value.id = value.id || value.receiptId;
    if (receipt && !receipt.receiptId) receipt.receiptId = value.receiptId;
    if (receipt && !receipt.id) receipt.id = value.id;
    if (!value.contractCode) {
      value.contractCode = value.kind?.startsWith('confirmation') ? 'C012'
        : value.kind?.startsWith('task') ? 'C013'
          : value.kind?.startsWith('receive') ? 'C011' : 'M04';
    }
    if (value.resourceRefs) {
      value.requestRef = value.resourceRefs.request || null;
      value.reminderRef = value.resourceRefs.reminder || null;
      value.confirmationRef = value.resourceRefs.confirmation || null;
      value.taskRef = value.resourceRefs.task || null;
      value.traceRef = value.resourceRefs.trace || null;
    }
    state.receipts.unshift(value);
  }

  _appendActivity(state, eventType, record, input, refs) {
    const envelope = this._audit(eventType, record, input, refs);
    state.activities.unshift({ ...envelope, payload: { requestId: record?.requestId || record?.id || null } });
  }

  _recordGate(state, request, receipt) {
    const target = state.requests.find((item) => item.requestId === request.requestId);
    if (target) {
      target.c017Reads = Array.isArray(target.c017Reads) ? target.c017Reads : [];
      target.c017Reads.push(clone(receipt));
      target.c017ReadAttempts = { ...(target.c017ReadAttempts || {}), [receipt.gate]: (target.c017ReadAttempts?.[receipt.gate] || 0) + 1 };
    }
  }

  _makeRequestRecord(normalized, receipt, input) {
    const at = receipt.readAt || this._now();
    const audit = this._audit('C011_ACTION_REQUEST_RECEIVED', normalized, input, { request: normalized.requestId });
    const request = {
      schemaVersion: REQUEST_SCHEMA_VERSION,
      requestId: normalized.requestId,
      id: normalized.requestId,
      actionRequestId: normalized.requestId,
      scenarioContext: clone(this.context),
      subjectId: normalized.subjectId,
      subjectName: normalized.subjectName,
      scenario: normalized.scenario,
      sourceType: normalized.sourceType,
      sourceRef: normalized.sourceRef,
      requester: normalized.requester,
      submittedBy: normalized.submittedBy,
      actionType: clone(normalized.actionType),
      semanticVersion: normalized.semanticVersion,
      dataVersion: normalized.dataVersion,
      t007: normalized.t007 || normalized.dataVersion,
      dataAssetVersion: normalized.dataVersion,
      rule: clone(normalized.rule),
      ruleApplicability: normalized.ruleApplicability,
      metric: clone(normalized.metric),
      evidence: clone(normalized.evidence),
      recommendation: clone(normalized.recommendation),
      routing: clone(normalized.routing),
      decisionRecipient: clone(normalized.decisionRecipient),
      requestedOwner: normalized.requestedOwner,
      idempotencyKey: normalized.idempotencyKey,
      callerIdempotencyKey: normalized.callerIdempotencyKey || null,
      contractFingerprint: normalized.contractFingerprint,
      receivedAt: at,
      requestStatus: receipt.outcome === READ_OUTCOMES.ALLOWED ? 'received' : receipt.outcome,
      reminderStatus: receipt.outcome === READ_OUTCOMES.ALLOWED ? 'awaiting_confirmation' : 'not_formed',
      confirmationStatus: 'pending',
      taskStatus: 'not_created',
      reminderId: null,
      confirmationId: null,
      taskId: null,
      traceId: stableId('TR', normalized, 'trace'),
      notificationId: null,
      c017Reads: [],
      c017ReadAttempts: {},
      history: [],
      pendingConfirmation: null,
      sourceRequest: immutableRequestSource(normalized.original),
      audit,
      actorRef: audit.actorRef,
      traceContext: { traceId: audit.traceId, correlationId: audit.correlationId }
    };
    request.c017Reads.push(clone(receipt));
    request.c017ReadAttempts[receipt.gate] = 1;
    if (receipt.outcome === READ_OUTCOMES.ALLOWED) {
      request.reminderId = stableId('REM', normalized, 'reminder');
      request.notificationId = stableId('NTF', normalized, 'reminder');
    }
    return request;
  }

  _makeReminder(request, receipt) {
    return {
      schemaVersion: REMINDER_SCHEMA_VERSION,
      contractCode: 'C012',
      reminderId: request.reminderId,
      id: request.reminderId,
      requestRef: request.requestId,
      requestId: request.requestId,
      actionRequestId: request.requestId,
      scenarioContext: clone(this.context),
      traceContext: clone(request.traceContext || null),
      actorRef: request.actorRef || null,
      sourceTraceId: request.traceContext?.traceId || null,
      correlationId: request.traceContext?.correlationId || null,
      subjectId: request.subjectId,
      subjectName: request.subjectName,
      actionType: clone(request.actionType),
      semanticVersion: request.semanticVersion,
      dataVersion: request.dataVersion,
      t007: request.t007 || request.dataVersion,
      dataAssetVersion: request.dataVersion,
      cutoff: request.evidence?.cutoff || null,
      status: 'awaiting_confirmation',
      createdAt: receipt.readAt || this._now(),
      c017Receipt: clone(receipt),
      confirmationId: null,
      taskId: null,
      history: [],
      audit: this._audit('C012_REMINDER_CREATED', request, request.traceContext || {}, { request: request.requestId, reminder: request.reminderId, trace: request.traceId })
    };
  }

  _makeNotification(request, kind, ref) {
    return {
      schemaVersion: 'ofw.m04.notification-receipt.v1',
      contractCode: 'C012',
      notificationId: kind === 'reminder' ? request.notificationId : stableId('NTF', request, `task:${ref}`),
      dedupeKey: `${kind}|${request.requestId}|${ref || ''}`,
      kind,
      requestId: request.requestId,
      actionRequestId: request.requestId,
      reminderId: request.reminderId,
      taskId: kind === 'task' ? ref : null,
      scenarioContext: clone(this.context),
      traceContext: clone(request.traceContext || null),
      actorRef: request.actorRef || null,
      status: 'recorded',
      createdAt: this._now(),
      attempts: 0
    };
  }

  _findRequest(requestId) {
    return this._state.requests.find((item) => item.requestId === requestId || item.id === requestId) || null;
  }

  _findTaskForRequest(requestId) {
    return this._state.todos.find((item) => item.requestId === requestId) || null;
  }

  _findExistingById(requestId) {
    return this._state.requests.find((item) => item.requestId === requestId) || null;
  }

  _result(base) {
    return freeze(clone(base));
  }

  _snapshotState() {
    return normalizeState(clone(this._state), this.context);
  }

  validateContractEnvelope(value) { return foundation.validateContractEnvelope(value); }
  assertContractEnvelope(value) { return foundation.assertContractEnvelope(value); }
  checkFoundationCompatibility(sourceVersion, targetVersion = foundation.FOUNDATION_SCHEMA_VERSION) {
    return foundation.compatibilityResult(sourceVersion, targetVersion);
  }

  createContractEnvelope(eventType, payload, options = {}) {
    if (!text(eventType)) fail('INVALID_EVENT_TYPE', 'eventType is required');
    const traceId = valueText(options.traceId) || `tr-${digest({ eventType, requestId: payload?.requestId || payload?.id, context: triple(this.context) }, 24)}`;
    const correlationId = valueText(options.correlationId) || traceId;
    const idempotency = valueText(options.idempotencyKey) || idempotencyKey({
      scenarioContext: this.context,
      requestId: payload?.requestId || payload?.id || `event-${digest(payload || {}, 12)}`,
      semanticVersion: payload?.semanticVersion || payload?.evidence?.semanticVersion || 'none',
      dataVersion: payload?.dataVersion || payload?.evidence?.dataVersion || 'none'
    });
    const envelope = {
      eventId: valueText(options.eventId) || `EVT-${digest({ eventType, traceId, at: this._now(), payload }, 20).toUpperCase()}`,
      eventType,
      schemaVersion: foundation.FOUNDATION_SCHEMA_VERSION,
      occurredAt: valueText(options.occurredAt) || this._now(),
      actorRef: options.actorRef || 'm04-system',
      correlationId,
      traceId,
      idempotencyKey: idempotency,
      scenarioContext: clone(this.context),
      resourceRefs: Array.isArray(options.resourceRefs) ? clone(options.resourceRefs) : [],
      evidenceRefs: Array.isArray(options.evidenceRefs) ? clone(options.evidenceRefs) : [],
      payload: clone(payload)
    };
    return foundation.assertContractEnvelope(envelope);
  }

  receiveActionRequest(input, options = {}) {
    if (this.readerIsAsync && options.allowAsync !== false) return this.receiveActionRequestAsync(input, options);
    this._assertWritable();
    let normalized;
    try {
      normalized = this._normalizeRequest(input);
    } catch (error) {
      if (error instanceof DecisionError && error.code === 'SCENARIO_CONTEXT_MISMATCH' && isObject(input)) {
        const incomingContext = contextFrom(input);
        const incomingRequestId = valueText(input.requestId || input.id || input.actionRequestId) || null;
        const receipt = {
          schemaVersion: RECEIPT_SCHEMA_VERSION,
          kind: 'receive',
          outcome: 'conflict',
          status: 'rejected',
          requestId: incomingRequestId,
          idempotencyKey: null,
          scenarioContext: clone(this.context),
          incomingScenarioContext: isObject(incomingContext) ? clone(incomingContext) : null,
          occurredAt: this._now(),
          reason: 'Action Request scenario/version/run does not match the active M04 context',
          conflict: publicError(error),
          resourceRefs: { request: null, reminder: null, confirmation: null, task: null, trace: null },
          sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
        };
        this._commit((state) => { this._appendReceipt(state, receipt); this._appendActivity(state, 'C011_SCENARIO_CONTEXT_CONFLICT', { requestId: incomingRequestId }, input, {}); });
        if (options.throwOnConflict) throw error;
        return this._result({ ok: false, status: 'rejected', outcome: 'conflict', conflict: true, receipt, refs: receipt.resourceRefs, effects: receipt.sideEffects, error: publicError(error) });
      }
      if (error instanceof DecisionError && ['C017_COPY_FORBIDDEN', 'CONTRACT_ENVELOPE_INVALID'].includes(error.code) && isObject(input)) {
        const receipt = {
          schemaVersion: RECEIPT_SCHEMA_VERSION,
          kind: 'receive',
          outcome: 'contract_rejected',
          status: 'rejected',
          requestId: valueText(input.requestId || input.id || input.actionRequestId || input.payload?.requestId || input.payload?.id || input.payload?.actionRequestId) || null,
          idempotencyKey: null,
          scenarioContext: clone(this.context),
          occurredAt: this._now(),
          reason: error.message,
          problems: clone(error.details?.paths || error.details?.errors || error.details?.cause?.details?.errors || []),
          resourceRefs: { request: null, reminder: null, confirmation: null, task: null, trace: null },
          sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
        };
        this._commit((state) => { this._appendReceipt(state, receipt); this._appendActivity(state, error.code === 'C017_COPY_FORBIDDEN' ? 'C011_C017_COPY_REJECTED' : 'C011_ENVELOPE_REJECTED', { requestId: receipt.requestId }, input, {}); });
        return this._result({ ok: false, status: 'rejected', outcome: 'contract_rejected', receipt, error: publicError(error), refs: receipt.resourceRefs, effects: receipt.sideEffects });
      }
      if (error instanceof DecisionError && error.normalized && options.persistInvalid !== false) {
        const at = this._now();
        const receipt = {
          schemaVersion: RECEIPT_SCHEMA_VERSION,
          kind: 'receive',
          outcome: 'contract_rejected',
          status: 'rejected',
          requestId: error.normalized.requestId || null,
          idempotencyKey: error.normalized.idempotencyKey || null,
          scenarioContext: clone(this.context),
          occurredAt: at,
          reason: error.message,
          problems: clone(error.details?.problems || []),
          resourceRefs: { request: null, reminder: null, confirmation: null, task: null, trace: null },
          sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
        };
        this._commit((state) => { this._appendReceipt(state, receipt); this._appendActivity(state, 'C011_CONTRACT_REJECTED', error.normalized, input, {}); });
        return this._result({ ok: false, status: 'rejected', outcome: 'contract_rejected', receipt, error: publicError(error), refs: receipt.resourceRefs, effects: receipt.sideEffects });
      }
      throw error;
    }
    const existing = this._findExistingById(normalized.requestId);
    if (existing) {
      if (existing.contractFingerprint === normalized.contractFingerprint
        && existing.idempotencyKey === normalized.idempotencyKey) {
        const receipt = this._state.receipts.find((item) => item.kind === 'receive' && item.requestId === existing.requestId && item.outcome !== 'conflict') || null;
        return this._result({
          ok: true,
          status: 'duplicate',
          outcome: 'duplicate',
          duplicate: true,
          request: existing,
          receipt,
          refs: this._refsForRequest(existing),
          effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
        });
      }
      const receipt = {
        schemaVersion: RECEIPT_SCHEMA_VERSION,
        kind: 'receive',
        outcome: 'conflict',
        status: 'rejected',
        requestId: normalized.requestId,
        idempotencyKey: normalized.idempotencyKey,
        scenarioContext: clone(this.context),
        occurredAt: this._now(),
        reason: 'same Action Request ID has a different scenario/version/subject/action type or fixed evidence',
        existingFingerprint: existing.contractFingerprint,
        incomingFingerprint: normalized.contractFingerprint,
        existingIdentity: { scenarioContext: triple(existing.scenarioContext), semanticVersion: existing.semanticVersion, dataVersion: existing.dataVersion, t007: existing.t007 || null },
        incomingIdentity: { scenarioContext: triple(normalized.scenarioContext), semanticVersion: normalized.semanticVersion, dataVersion: normalized.dataVersion, t007: normalized.t007 || null },
        existingRefs: this._refsForRequest(existing),
        resourceRefs: { request: existing.requestId, reminder: existing.reminderId, confirmation: existing.confirmationId, task: existing.taskId, trace: existing.traceId },
        sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
      };
      this._commit((state) => { this._appendReceipt(state, receipt); this._appendActivity(state, 'C011_IDEMPOTENCY_CONFLICT', existing, input, { request: existing.requestId }); });
      return this._result({ ok: false, status: 'rejected', outcome: 'conflict', conflict: true, request: existing, receipt, refs: this._refsForRequest(existing), effects: receipt.sideEffects });
    }

    const gate = this._readC017({ ...normalized, __clock: this.clock }, GATES.REQUEST_RECEIPT);
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      kind: 'receive',
      gate: GATES.REQUEST_RECEIPT,
      outcome: gate.outcome === READ_OUTCOMES.ALLOWED
        ? 'accepted'
        : gate.outcome === READ_OUTCOMES.REJECTED
          ? 'quality_rejected'
          : gate.outcome === READ_OUTCOMES.VERSION_CONFLICT
            ? 'conflict'
            : 'blocked',
      gateOutcome: gate.outcome,
      status: gate.outcome === READ_OUTCOMES.ALLOWED
        ? 'accepted'
        : gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT
          ? 'rejected'
          : 'blocked',
      requestId: normalized.requestId,
      idempotencyKey: normalized.idempotencyKey,
      scenarioContext: clone(this.context),
      semanticVersion: normalized.semanticVersion,
      dataVersion: normalized.dataVersion,
      occurredAt: gate.readAt || this._now(),
      reason: gate.reason || null,
      c017Read: clone(gate),
      resourceRefs: { request: normalized.requestId, reminder: null, confirmation: null, task: null, trace: null },
      sideEffects: { requests: 1, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
    };
    let requestRecord;
    this._commit((state) => {
      requestRecord = this._makeRequestRecord(normalized, gate, input);
      if (gate.outcome === READ_OUTCOMES.ALLOWED) {
        const reminder = this._makeReminder(requestRecord, gate);
        state.reminders.unshift(reminder);
        requestRecord.reminderStatus = 'awaiting_confirmation';
        receipt.resourceRefs.reminder = reminder.reminderId;
        receipt.sideEffects.reminders = 1;
        const reminderNotification = this._makeNotification(requestRecord, 'reminder', reminder.reminderId);
        if (!state.notifications.some((item) => item.dedupeKey === reminderNotification.dedupeKey)) {
          state.notifications.unshift(reminderNotification);
          receipt.sideEffects.notifications = 1;
        }
      } else {
        requestRecord.reminderStatus = 'not_formed';
        requestRecord.history.push({ type: 'receive_gate_blocked', at: gate.readAt || this._now(), gate: gate.gate, outcome: gate.outcome, reason: gate.reason || null });
      }
      receipt.resourceRefs.trace = requestRecord.traceId;
      this._recordGate(state, requestRecord, gate);
      state.requests.unshift(requestRecord);
      receipt.sideEffects.requests = 1;
      this._appendReceipt(state, receipt);
      this._appendActivity(state, gate.outcome === READ_OUTCOMES.ALLOWED ? 'C011_ACTION_REQUEST_ACCEPTED' : 'C011_ACTION_REQUEST_BLOCKED', requestRecord, input, { request: requestRecord.requestId, reminder: requestRecord.reminderId, trace: requestRecord.traceId });
    });
    // Notification delivery is an optional adapter.  It is called only after
    // the dedupe record exists and receives the stable dedupe key.
    this._deliverNewNotifications(requestRecord.requestId);
    return this._result({
      ok: gate.outcome === READ_OUTCOMES.ALLOWED,
      status: receipt.status,
      outcome: receipt.outcome,
      request: requestRecord,
      receipt,
      refs: receipt.resourceRefs,
      effects: receipt.sideEffects
    });
  }

  // Contract-friendly aliases used by M03/M06 adapters.
  receive(input, options = {}) { return this.receiveActionRequest(input, options); }
  submitActionRequest(input, options = {}) { return this.receiveActionRequest(input, options); }
  ingestActionRequest(input, options = {}) { return this.receiveActionRequest(input, options); }
  receiveContractEnvelope(envelope, options = {}) {
    foundation.assertContractEnvelope(envelope);
    return this.receiveActionRequest(envelope, options);
  }
  receiveActionRequestOrThrow(input, options = {}) {
    const result = this.receiveActionRequest(input, { ...options, throwOnConflict: true });
    if (result && result.ok === false && result.error) fail(result.error.code || 'C011_REJECTED', result.error.message, result.error.details);
    return result;
  }

  _deliverNewNotifications(requestId) {
    if (!this.notificationWriter) return;
    const pending = this._state.notifications.filter((item) => item.requestId === requestId && item.status === 'recorded' && item.attempts === 0);
    pending.forEach((notification) => {
      let result;
      try {
        const writer = typeof this.notificationWriter === 'function'
          ? this.notificationWriter
          : this.notificationWriter.send || this.notificationWriter.dispatch;
        if (typeof writer !== 'function') fail('NOTIFICATION_WRITER_INVALID', 'notificationWriter must be a function or expose send/dispatch');
        result = writer.call(this.notificationWriter, clone(notification), { dedupeKey: notification.dedupeKey });
      } catch (error) { result = { failed: true, error: publicError(error) }; }
      if (result && typeof result.then === 'function') fail('ASYNC_NOTIFICATION_WRITER', 'notification writer returned a Promise; use an async adapter');
      this._commit((state) => {
        const current = state.notifications.find((item) => item.notificationId === notification.notificationId);
        if (!current) return;
        current.attempts += 1;
        if (result && result.failed) { current.status = 'dispatch_failed'; current.error = clone(result.error || null); }
        else if (result && result.status === 'unknown') { current.status = 'unknown'; current.error = clone(result.error || { message: result.reason || 'notification result unknown' }); }
        else current.status = 'dispatched';
      });
    });
  }

  retryNotification(notificationId, input = {}) {
    this._assertWritable();
    const notification = this._state.notifications.find((item) => item.notificationId === notificationId);
    if (!notification) return this._result({ ok: false, status: 'not_found', outcome: 'not_found' });
    if (notification.status === 'dispatched') return this._result({ ok: true, status: 'duplicate', outcome: 'duplicate', duplicate: true, notification, effects: { notifications: 0 } });
    if (notification.status === 'unknown' && this.notificationWriter && typeof this.notificationWriter.findByDedupeKey !== 'function') {
      return this._result({ ok: false, status: 'unknown', outcome: 'unknown', notification, reason: 'notification result is unknown; reconcile the owner dispatch before retrying', effects: { notifications: 0 } });
    }
    if (!this.notificationWriter) return this._result({ ok: false, status: 'blocked', outcome: 'writer_unavailable', notification, effects: { notifications: 0 } });
    let result;
    try {
      const writer = typeof this.notificationWriter === 'function'
        ? this.notificationWriter
        : this.notificationWriter.send || this.notificationWriter.dispatch;
      if (typeof writer !== 'function') fail('NOTIFICATION_WRITER_INVALID', 'notificationWriter must be a function or expose send/dispatch');
      result = writer.call(this.notificationWriter, clone(notification), { dedupeKey: notification.dedupeKey, retry: true, input: clone(input) });
    } catch (error) { result = { failed: true, error: publicError(error) }; }
    if (result && typeof result.then === 'function') fail('ASYNC_NOTIFICATION_WRITER', 'notification writer returned a Promise; use an async adapter');
    this._commit((state) => {
      const current = state.notifications.find((item) => item.notificationId === notificationId);
      current.attempts += 1;
      if (result && result.failed) { current.status = 'dispatch_failed'; current.error = clone(result.error || null); }
      else if (result && result.status === 'unknown') { current.status = 'unknown'; current.error = clone(result.error || { message: result.reason || 'notification result unknown' }); }
      else current.status = 'dispatched';
    });
    const current = this._state.notifications.find((item) => item.notificationId === notificationId);
    return this._result({ ok: current.status === 'dispatched', status: current.status, outcome: current.status === 'dispatched' ? 'dispatched' : current.status, notification: current, effects: { notifications: current.status === 'dispatched' ? 1 : 0 } });
  }

  reconcileNotification(notificationId, result = {}) {
    this._assertWritable();
    const notification = this._state.notifications.find((item) => item.notificationId === notificationId);
    if (!notification) return this._result({ ok: false, status: 'not_found', outcome: 'not_found' });
    if (notification.status === 'dispatched') return this._result({ ok: true, status: 'duplicate', outcome: 'duplicate', duplicate: true, notification, effects: { notifications: 0 } });
    this._commit((state) => {
      const current = state.notifications.find((item) => item.notificationId === notificationId);
      current.status = 'dispatched';
      current.reconciledAt = this._now();
      current.dispatchRef = valueText(result.dispatchRef || result.id || result.messageId) || null;
      current.history = [...(current.history || []), { type: 'reconciled', at: current.reconciledAt, dispatchRef: current.dispatchRef }];
    });
    const current = this._state.notifications.find((item) => item.notificationId === notificationId);
    return this._result({ ok: true, status: 'dispatched', outcome: 'reconciled', notification: current, effects: { notifications: 0 } });
  }

  retryRequestReceipt(requestId, input = {}) {
    if (this.readerIsAsync && input.allowAsync !== false) return this.retryRequestReceiptAsync(requestId, input);
    this._assertWritable();
    const existing = this._findRequest(requestId);
    if (!existing) return this._result({ ok: false, status: 'not_found', outcome: 'not_found' });
    if (existing.requestStatus === 'received') return this._result({ ok: true, status: 'duplicate', outcome: 'duplicate', duplicate: true, request: existing, refs: this._refsForRequest(existing), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    if (existing.requestStatus === READ_OUTCOMES.REJECTED || existing.requestStatus === 'rejected' || existing.requestStatus === READ_OUTCOMES.VERSION_CONFLICT) {
      const retryReceipt = {
        schemaVersion: RECEIPT_SCHEMA_VERSION,
        kind: 'receive-retry',
        gate: GATES.REQUEST_RECEIPT,
        outcome: 'quality_rejected',
        gateOutcome: existing.requestStatus,
        status: 'rejected',
        requestId: existing.requestId,
        idempotencyKey: existing.idempotencyKey,
        scenarioContext: clone(this.context),
        occurredAt: this._now(),
        reason: 'hard quality or version conflict requires a new request on a trusted data version',
        resourceRefs: this._refsForRequest(existing),
        sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
      };
      this._commit((state) => {
        const current = state.requests.find((item) => item.requestId === existing.requestId);
        current.history.push({ type: 'receive_retry_rejected', at: retryReceipt.occurredAt, reason: retryReceipt.reason });
        this._appendReceipt(state, retryReceipt);
      });
      return this._result({ ok: false, status: 'rejected', outcome: 'quality_rejected', reason: retryReceipt.reason, request: this._findRequest(existing.requestId), receipt: retryReceipt, refs: this._refsForRequest(this._findRequest(existing.requestId)), effects: retryReceipt.sideEffects });
    }
    const gate = this._readC017(existing, GATES.REQUEST_RECEIPT);
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      kind: 'receive-retry',
      gate: GATES.REQUEST_RECEIPT,
      outcome: gate.outcome === READ_OUTCOMES.ALLOWED
        ? 'recovered'
        : gate.outcome === READ_OUTCOMES.REJECTED
          ? 'quality_rejected'
          : gate.outcome === READ_OUTCOMES.VERSION_CONFLICT
            ? 'conflict'
            : 'blocked',
      gateOutcome: gate.outcome,
      status: gate.outcome === READ_OUTCOMES.ALLOWED
        ? 'accepted'
        : gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT
          ? 'rejected'
          : 'blocked',
      requestId: existing.requestId,
      idempotencyKey: existing.idempotencyKey,
      scenarioContext: clone(this.context),
      semanticVersion: existing.semanticVersion,
      dataVersion: existing.dataVersion,
      occurredAt: gate.readAt || this._now(),
      reason: gate.reason || null,
      c017Read: clone(gate),
      resourceRefs: this._refsForRequest(existing),
      sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
    };
    let resultRequest;
    this._commit((state) => {
      const request = state.requests.find((item) => item.requestId === existing.requestId);
      this._recordGate(state, request, gate);
      request.history.push({ type: 'receive_retry', at: gate.readAt || this._now(), outcome: gate.outcome, reason: gate.reason || null });
      if (gate.outcome === READ_OUTCOMES.ALLOWED && !request.reminderId) {
        request.requestStatus = 'received';
        request.reminderStatus = 'awaiting_confirmation';
        request.reminderId = stableId('REM', request, 'reminder');
        request.notificationId = stableId('NTF', request, 'reminder');
        const reminder = this._makeReminder(request, gate);
        state.reminders.unshift(reminder);
        const reminderNotification = this._makeNotification(request, 'reminder', reminder.reminderId);
        if (!state.notifications.some((item) => item.dedupeKey === reminderNotification.dedupeKey)) {
          state.notifications.unshift(reminderNotification);
          receipt.sideEffects.notifications = 1;
        }
        receipt.resourceRefs.reminder = reminder.reminderId;
        receipt.sideEffects.reminders = 1;
        receipt.sideEffects.requests = 0;
      } else if (gate.outcome === READ_OUTCOMES.REJECTED) {
        request.requestStatus = 'rejected';
        request.reminderStatus = 'not_formed';
      } else {
        request.requestStatus = gate.outcome;
        request.reminderStatus = 'not_formed';
      }
      resultRequest = request;
      this._appendReceipt(state, receipt);
      this._appendActivity(state, gate.outcome === READ_OUTCOMES.ALLOWED ? 'C011_RECEIPT_RECOVERED' : 'C011_RECEIPT_RETRY_BLOCKED', request, input, { request: request.requestId, reminder: request.reminderId, trace: request.traceId });
    });
    this._deliverNewNotifications(existing.requestId);
    return this._result({ ok: gate.outcome === READ_OUTCOMES.ALLOWED, status: receipt.status, outcome: receipt.outcome, request: resultRequest, receipt, refs: this._refsForRequest(resultRequest), effects: receipt.sideEffects });
  }

  _confirmationForm(input, request) {
    const source = isObject(input) ? clone(input) : {};
    const mode = source.decision || source.mode || (source.confirmed === false ? 'reject' : source.confirmed === true ? 'confirm' : '');
    if (!['confirm', 'reject', 'confirmed', 'rejected'].includes(String(mode).toLowerCase())) fail('CONFIRMATION_INVALID', 'decision must be confirm or reject');
    const normalizedMode = String(mode).toLowerCase().startsWith('reject') ? 'reject' : 'confirm';
    const reason = valueText(source.reason || source.note || source.rationale);
    if (!reason) fail('CONFIRMATION_REASON_REQUIRED', 'human confirmation or rejection requires a reason');
    const owner = valueText(source.owner || source.ownerId || request.requestedOwner);
    if (normalizedMode === 'confirm' && !owner) fail('CONFIRMATION_OWNER_REQUIRED', 'a confirmed action requires an explicit responsible owner');
    return {
      mode: normalizedMode,
      reason,
      owner: normalizedMode === 'confirm' ? owner : null,
      ownerId: valueText(source.ownerId) || null,
      dueDate: valueText(source.dueDate) || null,
      instructions: source.instructions === undefined ? null : clone(source.instructions),
      selectedBanks: Array.isArray(source.selectedBanks || source.banks) ? clone(source.selectedBanks || source.banks) : [],
      selectedLoans: Array.isArray(source.selectedLoans || source.loans) ? clone(source.selectedLoans || source.loans) : [],
      actorRef: valueText(source.actorRef || source.actor || source.operator) || 'm04-operator',
      traceId: valueText(source.traceId) || null,
      correlationId: valueText(source.correlationId) || null
    };
  }

  confirmAction(requestId, input = {}, options = {}) {
    if (this.readerIsAsync && options.allowAsync !== false) return this.confirmActionAsync(requestId, input, options);
    this._assertWritable();
    const request = this._findRequest(requestId);
    if (!request) return this._result({ ok: false, status: 'not_found', outcome: 'not_found' });
    let form;
    try { form = this._confirmationForm(input, request); } catch (error) {
      if (error instanceof DecisionError) return this._result({ ok: false, status: 'rejected', outcome: 'contract_rejected', request, error: publicError(error), refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
      throw error;
    }
    if (request.confirmationStatus === 'confirmed' || request.confirmationStatus === 'rejected') {
      const existing = this._state.confirmations.find((item) => item.confirmationId === request.confirmationId);
      const incomingFingerprint = digest({ requestId, mode: form.mode, reason: form.reason, owner: form.owner, dueDate: form.dueDate, instructions: form.instructions, selectedBanks: form.selectedBanks, selectedLoans: form.selectedLoans }, 64);
      if (existing && existing.formFingerprint === incomingFingerprint) return this._result({ ok: true, status: 'duplicate', outcome: 'duplicate', duplicate: true, request, confirmation: existing, refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
      return this._result({ ok: false, status: 'rejected', outcome: 'conflict', conflict: true, request, reason: 'human decision is already recorded and cannot be overwritten', refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    const lastConfirmationGate = [...(request.c017Reads || [])].reverse().find((item) => item.gate === GATES.CONFIRMATION_SUBMIT);
    if (lastConfirmationGate?.outcome === READ_OUTCOMES.REJECTED || lastConfirmationGate?.outcome === READ_OUTCOMES.VERSION_CONFLICT) {
      const retryReceipt = this._confirmationReceipt(request, form, lastConfirmationGate, 'quality_rejected', digest(form, 64));
      retryReceipt.kind = 'confirmation-retry';
      this._commit((state) => {
        const current = state.requests.find((item) => item.requestId === request.requestId);
        current.history.push({ type: 'confirmation_retry_rejected', at: retryReceipt.occurredAt, reason: '必须基于新版本重新发起请求' });
        this._appendReceipt(state, retryReceipt);
      });
      return this._result({ ok: false, status: 'rejected', outcome: 'quality_rejected', request: this._findRequest(request.requestId), reason: '当前精确数据版本的 C017 已发生硬质量/版本冲突，必须基于新版本重新发起请求', receipt: retryReceipt, refs: this._refsForRequest(this._findRequest(request.requestId)), effects: retryReceipt.sideEffects });
    }
    if (!request.reminderId || request.reminderStatus === 'not_formed') {
      return this._result({ ok: false, status: 'blocked', outcome: 'blocked', request, reason: 'no decision reminder was formed', refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    if (request.reminderStatus !== 'awaiting_confirmation') {
      return this._result({ ok: false, status: 'blocked', outcome: 'blocked', request, reason: 'reminder is not awaiting human confirmation', refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    if (form.mode === 'reject') {
      const confirmation = this._makeConfirmation(request, form, null);
      this._commit((state) => {
        const current = state.requests.find((item) => item.requestId === request.requestId);
        current.confirmationStatus = 'rejected';
        current.reminderStatus = 'rejected';
        current.confirmationId = confirmation.confirmationId;
        current.pendingConfirmation = null;
        state.confirmations.unshift(confirmation);
        const reminder = state.reminders.find((item) => item.reminderId === current.reminderId);
        if (reminder) { reminder.status = 'rejected'; reminder.confirmationId = confirmation.confirmationId; reminder.history.push({ type: 'rejected', at: confirmation.decidedAt, confirmationId: confirmation.confirmationId }); }
        const receipt = this._confirmationReceipt(current, form, null, 'rejected', null);
        this._appendReceipt(state, receipt);
        this._appendActivity(state, 'C012_HUMAN_REJECTED', current, form, { request: current.requestId, reminder: current.reminderId, confirmation: confirmation.confirmationId, trace: current.traceId });
      });
      return this._result({ ok: true, status: 'rejected', outcome: 'rejected', request: this._findRequest(request.requestId), confirmation: this._state.confirmations.find((item) => item.requestId === request.requestId), refs: this._refsForRequest(this._findRequest(request.requestId)), effects: { requests: 0, reminders: 0, confirmations: 1, tasks: 0, notifications: 0 } });
    }

    const gate = this._readC017(request, GATES.CONFIRMATION_SUBMIT);
    const formFingerprint = digest({ requestId, mode: form.mode, reason: form.reason, owner: form.owner, dueDate: form.dueDate, instructions: form.instructions, selectedBanks: form.selectedBanks, selectedLoans: form.selectedLoans }, 64);
    if (gate.outcome !== READ_OUTCOMES.ALLOWED) {
      const gateReceipt = this._confirmationReceipt(request, form, gate, gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'quality_rejected' : 'blocked', formFingerprint);
      this._commit((state) => {
        const current = state.requests.find((item) => item.requestId === request.requestId);
        current.confirmationStatus = gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'rejected_pending' : 'blocked';
        current.pendingConfirmation = { ...clone(form), formFingerprint, savedAt: this._now(), submitted: false };
        current.history.push({ type: 'confirmation_gate', at: gate.readAt || this._now(), outcome: gate.outcome, formFingerprint, receipt: clone(gate) });
        this._recordGate(state, current, gate);
        this._appendReceipt(state, gateReceipt);
        this._appendActivity(state, gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'C012_CONFIRMATION_GATE_REJECTED' : 'C012_CONFIRMATION_GATE_BLOCKED', current, form, { request: current.requestId, reminder: current.reminderId, trace: current.traceId });
      });
      const current = this._findRequest(request.requestId);
      return this._result({ ok: false, status: gateReceipt.status, outcome: gateReceipt.outcome, request: current, receipt: gateReceipt, form: clone(form), refs: this._refsForRequest(current), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    const confirmation = this._makeConfirmation(request, form, gate);
    this._commit((state) => {
      const current = state.requests.find((item) => item.requestId === request.requestId);
      current.confirmationStatus = 'confirmed';
      current.reminderStatus = 'confirmed';
      current.confirmationId = confirmation.confirmationId;
      current.pendingConfirmation = null;
      current.taskStatus = 'not_created';
      state.confirmations.unshift(confirmation);
      const reminder = state.reminders.find((item) => item.reminderId === current.reminderId);
      if (reminder) { reminder.status = 'confirmed'; reminder.confirmationId = confirmation.confirmationId; reminder.history.push({ type: 'confirmed', at: confirmation.decidedAt, confirmationId: confirmation.confirmationId }); }
      this._recordGate(state, current, gate);
      const receipt = this._confirmationReceipt(current, form, gate, 'confirmed', formFingerprint);
      this._appendReceipt(state, receipt);
      this._appendActivity(state, 'C012_HUMAN_CONFIRMED', current, form, { request: current.requestId, reminder: current.reminderId, confirmation: confirmation.confirmationId, trace: current.traceId });
    });
    const current = this._findRequest(request.requestId);
    const receipt = this._state.receipts.find((item) => item.kind === 'confirmation' && item.requestId === request.requestId);
    return this._result({ ok: true, status: 'confirmed', outcome: 'confirmed', request: current, confirmation: this._state.confirmations.find((item) => item.requestId === request.requestId), receipt, refs: this._refsForRequest(current), effects: { requests: 0, reminders: 0, confirmations: 1, tasks: 0, notifications: 0 } });
  }

  confirm(requestId, input = {}, options = {}) { return this.confirmAction(requestId, input, options); }
  confirmHumanDecision(requestId, input = {}, options = {}) { return this.confirmAction(requestId, input, options); }
  confirmActionOrThrow(requestId, input = {}, options = {}) {
    const result = this.confirmAction(requestId, input, options);
    if (result && result.ok === false) fail(result.error?.code || 'C012_REJECTED', result.error?.message || result.reason || 'human decision rejected');
    return result;
  }

  _makeConfirmation(request, form, gate) {
    const confirmationId = stableId('DEC', request, form.mode + ':' + digest({ reason: form.reason, owner: form.owner, at: this._now() }, 12));
    return {
      schemaVersion: CONFIRMATION_SCHEMA_VERSION,
      contractCode: 'C012',
      confirmationId,
      decisionId: confirmationId,
      requestId: request.requestId,
      actionRequestId: request.requestId,
      reminderId: request.reminderId,
      scenarioContext: clone(this.context),
      traceContext: clone(request.traceContext || null),
      actorRef: form.actorRef || request.actorRef || null,
      sourceTraceId: request.traceContext?.traceId || null,
      correlationId: request.traceContext?.correlationId || null,
      decision: form.mode,
      reason: form.reason,
      owner: form.owner,
      ownerId: form.ownerId,
      dueDate: form.dueDate,
      instructions: clone(form.instructions),
      selectedBanks: clone(form.selectedBanks),
      selectedLoans: clone(form.selectedLoans),
      operator: form.actorRef,
      decidedAt: this._now(),
      c017Receipt: gate ? clone(gate) : null,
      formFingerprint: digest({ requestId: request.requestId, mode: form.mode, reason: form.reason, owner: form.owner, dueDate: form.dueDate, instructions: form.instructions, selectedBanks: form.selectedBanks, selectedLoans: form.selectedLoans }, 64),
      taskId: null,
      history: [],
      audit: this._audit(form.mode === 'confirm' ? 'C012_HUMAN_CONFIRMED' : 'C012_HUMAN_REJECTED', request, { ...form, ...(request.traceContext || {}) }, { request: request.requestId, reminder: request.reminderId })
    };
  }

  _confirmationReceipt(request, form, gate, outcome, formFingerprint) {
    return {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      kind: 'confirmation',
      gate: GATES.CONFIRMATION_SUBMIT,
      outcome,
      gateOutcome: gate?.outcome || null,
      status: outcome === 'confirmed' || outcome === 'rejected' ? outcome : 'blocked',
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      scenarioContext: clone(this.context),
      semanticVersion: request.semanticVersion,
      dataVersion: request.dataVersion,
      occurredAt: gate?.readAt || this._now(),
      reason: gate?.reason || form.reason,
      formFingerprint,
      c017Read: gate ? clone(gate) : null,
      resourceRefs: { request: request.requestId, reminder: request.reminderId, confirmation: outcome === 'confirmed' || outcome === 'rejected' ? request.confirmationId || null : null, task: null, trace: request.traceId },
      sideEffects: { requests: 0, reminders: 0, confirmations: outcome === 'confirmed' || outcome === 'rejected' ? 1 : 0, tasks: 0, notifications: 0 }
    };
  }

  retryConfirmation(requestId, form = {}) {
    const request = this._findRequest(requestId);
    const merged = { ...(request?.pendingConfirmation || {}), ...form, retry: true };
    return this.confirmAction(requestId, merged, { retry: true });
  }

  createTask(requestId, input = {}) {
    if (this.readerIsAsync && input.allowAsync !== false) return this.createTaskAsync(requestId, input);
    this._assertWritable();
    const request = this._findRequest(requestId);
    if (!request) return this._result({ ok: false, status: 'not_found', outcome: 'not_found' });
    const existingLocalTask = request.taskId
      ? this._state.todos.find((item) => item.taskId === request.taskId || item.id === request.taskId)
      : this._findTaskForRequest(requestId);
    if (existingLocalTask) {
      if (!request.taskId) {
        this._commit((state) => {
          const current = state.requests.find((item) => item.requestId === requestId);
          current.taskId = existingLocalTask.taskId || existingLocalTask.id;
          current.taskStatus = 'created';
          current.reminderStatus = 'task_created';
        });
      }
      const existing = this._findTaskForRequest(requestId) || existingLocalTask;
      return this._result({ ok: true, status: 'duplicate', outcome: 'duplicate', duplicate: true, request, task: existing || null, refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    if (request.confirmationStatus !== 'confirmed') {
      const receipt = { schemaVersion: RECEIPT_SCHEMA_VERSION, kind: 'task', gate: GATES.TASK_FORMATION, outcome: 'confirmation_required', status: 'blocked', requestId, scenarioContext: clone(this.context), occurredAt: this._now(), reason: '负责人待办只能在人工确认成功后创建', resourceRefs: this._refsForRequest(request), sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } };
      this._commit((state) => { this._appendReceipt(state, receipt); this._appendActivity(state, 'C013_TASK_BLOCKED_UNCONFIRMED', request, input, { request: request.requestId, reminder: request.reminderId, trace: request.traceId }); });
      return this._result({ ok: false, status: 'blocked', outcome: 'confirmation_required', request, receipt, refs: this._refsForRequest(request), effects: receipt.sideEffects });
    }
    if (request.taskStatus === 'unknown' && this.taskWriter && typeof this.taskWriter.findByIdempotencyKey !== 'function') {
      return this._result({ ok: false, status: 'unknown', outcome: 'unknown', request, reason: 'task writer result is unknown; reconcile the owner task before retrying', refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    const lastTaskGate = [...(request.c017Reads || [])].reverse().find((item) => item.gate === GATES.TASK_FORMATION);
    if (lastTaskGate?.outcome === READ_OUTCOMES.REJECTED || lastTaskGate?.outcome === READ_OUTCOMES.VERSION_CONFLICT) {
      const retryReceipt = {
        schemaVersion: RECEIPT_SCHEMA_VERSION,
        kind: 'task-retry',
        gate: GATES.TASK_FORMATION,
        outcome: 'quality_rejected',
        gateOutcome: lastTaskGate.outcome,
        status: 'rejected',
        requestId: request.requestId,
        idempotencyKey: request.idempotencyKey,
        scenarioContext: clone(this.context),
        occurredAt: this._now(),
        reason: '当前精确数据版本的 C017 待办门已拒绝，必须基于新版本重新发起请求',
        c017Read: clone(lastTaskGate),
        resourceRefs: this._refsForRequest(request),
        sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
      };
      this._commit((state) => { const current = state.requests.find((item) => item.requestId === request.requestId); current.history.push({ type: 'task_retry_rejected', at: retryReceipt.occurredAt, reason: retryReceipt.reason }); this._appendReceipt(state, retryReceipt); });
      return this._result({ ok: false, status: 'rejected', outcome: 'quality_rejected', request: this._findRequest(request.requestId), reason: retryReceipt.reason, receipt: retryReceipt, refs: this._refsForRequest(this._findRequest(request.requestId)), effects: retryReceipt.sideEffects });
    }
    const confirmation = this._state.confirmations.find((item) => item.confirmationId === request.confirmationId);
    if (!confirmation || confirmation.decision !== 'confirm') {
      return this._result({ ok: false, status: 'blocked', outcome: 'confirmation_required', request, reason: 'positive human confirmation is required', refs: this._refsForRequest(request), effects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 } });
    }
    const gate = this._readC017(request, GATES.TASK_FORMATION);
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      kind: 'task',
      gate: GATES.TASK_FORMATION,
      outcome: gate.outcome === READ_OUTCOMES.ALLOWED ? 'task_created' : gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'quality_rejected' : 'blocked',
      gateOutcome: gate.outcome,
      status: gate.outcome === READ_OUTCOMES.ALLOWED ? 'created' : gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'rejected' : 'blocked',
      requestId,
      idempotencyKey: request.idempotencyKey,
      scenarioContext: clone(this.context),
      semanticVersion: request.semanticVersion,
      dataVersion: request.dataVersion,
      occurredAt: gate.readAt || this._now(),
      reason: gate.reason || null,
      c017Read: clone(gate),
      resourceRefs: { request: request.requestId, reminder: request.reminderId, confirmation: request.confirmationId, task: null, trace: request.traceId },
      sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 0, notifications: 0 }
    };
    if (gate.outcome !== READ_OUTCOMES.ALLOWED) {
      this._commit((state) => {
        const current = state.requests.find((item) => item.requestId === request.requestId);
        current.taskStatus = gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'rejected' : 'blocked';
        current.reminderStatus = 'task_creation_blocked';
        current.history.push({ type: 'task_gate', at: gate.readAt || this._now(), outcome: gate.outcome, reason: gate.reason || null, c017Receipt: clone(gate) });
        this._recordGate(state, current, gate);
        const reminder = state.reminders.find((item) => item.reminderId === current.reminderId);
        if (reminder) { reminder.status = 'task_creation_blocked'; reminder.history.push({ type: 'task_gate', at: gate.readAt || this._now(), outcome: gate.outcome }); }
        this._appendReceipt(state, receipt);
        this._appendActivity(state, gate.outcome === READ_OUTCOMES.REJECTED || gate.outcome === READ_OUTCOMES.VERSION_CONFLICT ? 'C013_TASK_GATE_REJECTED' : 'C013_TASK_GATE_BLOCKED', current, input, { request: current.requestId, reminder: current.reminderId, confirmation: current.confirmationId, trace: current.traceId });
      });
      const current = this._findRequest(requestId);
      return this._result({ ok: false, status: receipt.status, outcome: receipt.outcome, request: current, confirmation, receipt, refs: this._refsForRequest(current), effects: receipt.sideEffects });
    }
    const task = this._makeTask(request, confirmation, input, gate);
    let writerResult = null;
    if (this.taskWriter) {
      try {
        // An unknown response must be reconciled by the owner before another
        // create call.  If the adapter exposes an idempotent lookup, use it
        // first so a successful remote write is never duplicated.
        if (request.taskStatus === 'unknown' && typeof this.taskWriter.findByIdempotencyKey === 'function') {
          const found = this.taskWriter.findByIdempotencyKey(task.idempotencyKey);
          if (found && typeof found.then === 'function') fail('ASYNC_TASK_WRITER', 'task writer lookup returned a Promise; use an async adapter');
          if (found) writerResult = { status: 'duplicate', task: found.task || found };
        }
        if (writerResult === null) {
        if (typeof this.taskWriter === 'function') writerResult = this.taskWriter(clone(task), { idempotencyKey: task.idempotencyKey });
        else if (typeof this.taskWriter.create === 'function') writerResult = this.taskWriter.create(clone(task), { idempotencyKey: task.idempotencyKey });
        else fail('TASK_WRITER_INVALID', 'taskWriter must be a function or expose create()');
        if (writerResult && typeof writerResult.then === 'function') fail('ASYNC_TASK_WRITER', 'task writer returned a Promise; use an async adapter');
        }
        if (writerResult && writerResult.failed) fail('TASK_CREATE_FAILED', writerResult.reason || 'task writer rejected the create operation', writerResult);
        if (writerResult && writerResult.status === 'unknown') {
          receipt.outcome = 'unknown'; receipt.status = 'unknown'; receipt.reason = writerResult.reason || 'task writer result unknown';
          this._commit((state) => { const current = state.requests.find((item) => item.requestId === requestId); current.taskStatus = 'unknown'; current.history.push({ type: 'task_create_unknown', at: this._now(), reason: receipt.reason }); this._appendReceipt(state, receipt); });
          return this._result({ ok: false, status: 'unknown', outcome: 'unknown', request: this._findRequest(requestId), confirmation, receipt, refs: this._refsForRequest(this._findRequest(requestId)), effects: receipt.sideEffects });
        }
        if (writerResult && writerResult.status === 'duplicate' && !writerResult.task && !writerResult.taskId && !writerResult.id && !writerResult.todoId) {
          receipt.outcome = 'unknown'; receipt.status = 'unknown'; receipt.reason = 'task writer reported a duplicate without returning the authoritative task';
          this._commit((state) => { const current = state.requests.find((item) => item.requestId === requestId); current.taskStatus = 'unknown'; current.history.push({ type: 'task_duplicate_unresolved', at: this._now(), reason: receipt.reason }); this._appendReceipt(state, receipt); });
          return this._result({ ok: false, status: 'unknown', outcome: 'unknown', request: this._findRequest(requestId), confirmation, receipt, refs: this._refsForRequest(this._findRequest(requestId)), effects: receipt.sideEffects });
        }
        if (writerResult && isObject(writerResult.task)) {
          const remoteTask = clone(writerResult.task);
          Object.assign(task, remoteTask, { requestId: request.requestId });
          const authoritativeTaskId = valueText(remoteTask.taskId || remoteTask.id || remoteTask.todoId);
          if (authoritativeTaskId) {
            task.taskId = authoritativeTaskId;
            task.todoId = authoritativeTaskId;
            task.id = authoritativeTaskId;
          }
          task.requestId = request.requestId;
          task.reminderId = request.reminderId;
          task.confirmationId = confirmation.confirmationId;
          task.scenarioContext = clone(this.context);
          task.semanticVersion = request.semanticVersion;
          task.dataVersion = request.dataVersion;
          task.t007 = request.t007 || request.dataVersion;
        }
        if (writerResult && !writerResult.task && (writerResult.taskId || writerResult.id || writerResult.todoId)) {
          const authoritativeTaskId = valueText(writerResult.taskId || writerResult.id || writerResult.todoId);
          task.taskId = authoritativeTaskId;
          task.todoId = authoritativeTaskId;
          task.id = authoritativeTaskId;
        }
      } catch (error) {
        receipt.outcome = 'create_failed'; receipt.status = 'failed'; receipt.reason = error.message;
        this._commit((state) => { const current = state.requests.find((item) => item.requestId === requestId); current.taskStatus = 'create_failed'; current.reminderStatus = 'task_creation_failed'; current.history.push({ type: 'task_create_failed', at: this._now(), reason: error.message }); this._appendReceipt(state, receipt); this._appendActivity(state, 'C013_TASK_CREATE_FAILED', current, input, { request: current.requestId, reminder: current.reminderId, confirmation: current.confirmationId, trace: current.traceId }); });
        return this._result({ ok: false, status: 'failed', outcome: 'create_failed', request: this._findRequest(requestId), confirmation, receipt, error: publicError(error), refs: this._refsForRequest(this._findRequest(requestId)), effects: receipt.sideEffects });
      }
    }
    this._commit((state) => {
      const current = state.requests.find((item) => item.requestId === requestId);
      current.taskId = task.taskId;
      current.taskStatus = 'created';
      current.reminderStatus = 'task_created';
      current.history.push({ type: 'task_created', at: task.createdAt, taskId: task.taskId, c017Receipt: clone(gate) });
      this._recordGate(state, current, gate);
      const reminder = state.reminders.find((item) => item.reminderId === current.reminderId);
      if (reminder) { reminder.status = 'task_created'; reminder.taskId = task.taskId; reminder.history.push({ type: 'task_created', at: task.createdAt, taskId: task.taskId }); }
      const decision = state.confirmations.find((item) => item.confirmationId === current.confirmationId);
      if (decision) { decision.taskId = task.taskId; decision.c017Receipt = clone(gate); }
      state.todos.unshift(task);
      receipt.resourceRefs.task = task.taskId;
      receipt.sideEffects.tasks = 1;
      const taskNotification = this._makeNotification(current, 'task', task.taskId);
      if (!state.notifications.some((item) => item.dedupeKey === taskNotification.dedupeKey)) {
        state.notifications.unshift(taskNotification);
        receipt.sideEffects.notifications = 1;
      }
      this._appendReceipt(state, receipt);
      this._appendActivity(state, 'C013_TASK_CREATED', current, input, { request: current.requestId, reminder: current.reminderId, confirmation: current.confirmationId, task: task.taskId, trace: current.traceId });
    });
    this._deliverNewNotifications(requestId);
    const current = this._findRequest(requestId);
    return this._result({ ok: true, status: 'created', outcome: 'task_created', request: current, confirmation, task: this._state.todos.find((item) => item.taskId === current.taskId), receipt, refs: this._refsForRequest(current), effects: receipt.sideEffects });
  }

  _makeTask(request, confirmation, input, gate) {
    const owner = valueText(input.owner || input.ownerId || confirmation.owner);
    if (!owner) fail('TASK_OWNER_REQUIRED', 'task owner is required');
    const taskId = stableId('TODO', request, 'task');
    return {
      schemaVersion: TASK_SCHEMA_VERSION,
      contractCode: 'C013',
      taskId,
      todoId: taskId,
      id: taskId,
      idempotencyKey: `task|${request.idempotencyKey}|${confirmation.confirmationId}`,
      requestId: request.requestId,
      actionRequestId: request.requestId,
      reminderId: request.reminderId,
      confirmationId: confirmation.confirmationId,
      scenarioContext: clone(this.context),
      traceContext: clone(request.traceContext || null),
      actorRef: valueText(input.actorRef || input.actor || request.actorRef) || null,
      sourceTraceId: request.traceContext?.traceId || null,
      correlationId: request.traceContext?.correlationId || null,
      subjectId: request.subjectId,
      subjectName: request.subjectName,
      owner,
      ownerId: valueText(input.ownerId || confirmation.ownerId) || null,
      title: valueText(input.title) || `${request.subjectName || request.subjectId} · ${request.actionType.name || request.actionType.id}`,
      instructions: input.instructions === undefined ? clone(confirmation.instructions) : clone(input.instructions),
      reason: confirmation.reason,
      dueDate: valueText(input.dueDate || confirmation.dueDate) || null,
      selectedBanks: input.selectedBanks === undefined ? clone(confirmation.selectedBanks) : clone(input.selectedBanks),
      selectedLoans: input.selectedLoans === undefined ? clone(confirmation.selectedLoans) : clone(input.selectedLoans),
      actionType: clone(request.actionType),
      semanticVersion: request.semanticVersion,
      dataVersion: request.dataVersion,
      t007: request.t007 || request.dataVersion,
      cutoff: request.evidence?.cutoff || null,
      metric: clone(request.metric),
      rule: clone(request.rule),
      ruleApplicability: request.ruleApplicability,
      evidence: clone(request.evidence),
      status: 'pending',
      createdAt: this._now(),
      c017Receipt: clone(gate),
      history: [],
      audit: this._audit('C013_TASK_CREATED', request, { ...input, ...(request.traceContext || {}) }, { request: request.requestId, reminder: request.reminderId, confirmation: confirmation.confirmationId, task: taskId, trace: request.traceId })
    };
  }

  retryTaskCreation(requestId, input = {}) {
    const request = this._findRequest(requestId);
    if (!request) return this._result({ ok: false, status: 'not_found', outcome: 'not_found' });
    if (request.taskId) return this.createTask(requestId, input);
    return this.createTask(requestId, { ...input, retry: true });
  }

  reconcileTaskCreation(requestId, taskInput) {
    this._assertWritable();
    const request = this._findRequest(requestId);
    if (!request || request.confirmationStatus !== 'confirmed') return this._result({ ok: false, status: 'blocked', outcome: 'confirmation_required' });
    if (request.taskId || this._findTaskForRequest(requestId)) return this.createTask(requestId, {});
    if (!isObject(taskInput)) return this._result({ ok: false, status: 'rejected', outcome: 'invalid_task' });
    const task = {
      ...clone(taskInput),
      schemaVersion: taskInput.schemaVersion || TASK_SCHEMA_VERSION,
      taskId: valueText(taskInput.taskId || taskInput.id || taskInput.todoId),
      id: valueText(taskInput.taskId || taskInput.id || taskInput.todoId),
      requestId,
      actionRequestId: requestId,
      reminderId: request.reminderId,
      confirmationId: request.confirmationId,
      scenarioContext: clone(this.context),
      semanticVersion: request.semanticVersion,
      dataVersion: request.dataVersion,
      t007: request.t007 || request.dataVersion,
      status: taskInput.status || 'pending',
      reconciledAt: this._now()
    };
    if (!task.taskId) return this._result({ ok: false, status: 'rejected', outcome: 'invalid_task', reason: 'taskId is required to reconcile an unknown result' });
    const receipt = {
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      kind: 'task-reconciled',
      gate: GATES.TASK_FORMATION,
      outcome: 'task_created',
      status: 'created',
      requestId,
      idempotencyKey: request.idempotencyKey,
      scenarioContext: clone(this.context),
      occurredAt: this._now(),
      reason: 'owner task result reconciled after an unknown response',
      resourceRefs: { request: request.requestId, reminder: request.reminderId, confirmation: request.confirmationId, task: task.taskId, trace: request.traceId },
      sideEffects: { requests: 0, reminders: 0, confirmations: 0, tasks: 1, notifications: 0 }
    };
    this._commit((state) => {
      const current = state.requests.find((item) => item.requestId === requestId);
      current.taskId = task.taskId;
      current.taskStatus = 'created';
      current.reminderStatus = 'task_created';
      current.history.push({ type: 'task_reconciled', at: receipt.occurredAt, taskId: task.taskId });
      const reminder = state.reminders.find((item) => item.reminderId === current.reminderId);
      if (reminder) { reminder.status = 'task_created'; reminder.taskId = task.taskId; }
      const confirmation = state.confirmations.find((item) => item.confirmationId === current.confirmationId);
      if (confirmation) confirmation.taskId = task.taskId;
      state.todos.unshift(task);
      this._appendReceipt(state, receipt);
      this._appendActivity(state, 'C013_TASK_RECONCILED', current, {}, { request: current.requestId, reminder: current.reminderId, confirmation: current.confirmationId, task: task.taskId, trace: current.traceId });
    });
    return this._result({ ok: true, status: 'created', outcome: 'task_reconciled', request: this._findRequest(requestId), task: this._findTaskForRequest(requestId), receipt, refs: this._refsForRequest(this._findRequest(requestId)), effects: receipt.sideEffects });
  }

  createTodo(requestId, input = {}) { return this.createTask(requestId, input); }
  createOwnerTask(requestId, input = {}) { return this.createTask(requestId, input); }
  retryTodoCreation(requestId, input = {}) { return this.retryTaskCreation(requestId, input); }
  reconcileTodo(requestId, input = {}) { return this.reconcileTaskCreation(requestId, input); }
  createTaskOrThrow(requestId, input = {}) {
    const result = this.createTask(requestId, input);
    if (result && result.ok === false) fail(result.error?.code || 'C013_REJECTED', result.error?.message || result.reason || 'task creation rejected');
    return result;
  }

  _refsForRequest(request) {
    if (!request) return { request: null, reminder: null, confirmation: null, task: null, trace: null };
    return { request: request.requestId || request.id || null, reminder: request.reminderId || null, confirmation: request.confirmationId || null, task: request.taskId || null, trace: request.traceId || null };
  }

  getState() {
    this._refreshState();
    return freeze(this._snapshotState());
  }

  listRequests() { this._refreshState(); return freeze(this._snapshotState().requests); }
  listReminders() { this._refreshState(); return freeze(this._snapshotState().reminders); }
  listConfirmations() { this._refreshState(); return freeze(this._snapshotState().confirmations); }
  listDecisions() { return this.listConfirmations(); }
  listTodos() { this._refreshState(); return freeze(this._snapshotState().todos); }
  listTasks() { return this.listTodos(); }
  listNotifications() { this._refreshState(); return freeze(this._snapshotState().notifications); }
  listReceipts() { this._refreshState(); return freeze(this._snapshotState().receipts); }
  listActivities() { this._refreshState(); return freeze(this._snapshotState().activities); }

  getDetail(type, id, options = {}) {
    this._refreshState();
    const normalized = String(type || '').toLowerCase();
    const lookupId = isObject(id) ? (id.targetId || id.id || id.requestId || id.reminderId || id.taskId || id.traceId) : id;
    const lookup = {
      request: () => this._state.requests.find((item) => item.requestId === lookupId || item.id === lookupId),
      reminder: () => this._state.reminders.find((item) => item.reminderId === lookupId || item.id === lookupId),
      confirmation: () => this._state.confirmations.find((item) => item.confirmationId === lookupId || item.id === lookupId),
      task: () => this._state.todos.find((item) => item.taskId === lookupId || item.id === lookupId),
      todo: () => this._state.todos.find((item) => item.taskId === lookupId || item.id === lookupId),
      trace: () => this._state.requests.find((item) => item.traceId === lookupId)
    };
    if (!lookup[normalized]) fail('DETAIL_TYPE_INVALID', 'unsupported M04 detail type');
    const record = lookup[normalized]();
    if (!record) return null;
    const canonicalType = normalized === 'todo' ? 'task' : normalized;
    const targetId = canonicalType === 'trace' ? record.traceId : (record[`${canonicalType}Id`] || record.id);
    const query = new URLSearchParams({
      scenarioId: this.context.scenarioId,
      scenarioVersion: this.context.scenarioVersion,
      scenarioRunId: this.context.scenarioRunId,
      scenarioStatus: this.context.status || 'active',
      mode: READ_ONLY_STATUSES.has(String(this.context.status || '').toLowerCase()) ? 'historical-readonly' : 'detail'
    });
    const routeType = canonicalType === 'trace' ? 'trace' : canonicalType;
    const routeTarget = canonicalType === 'trace' ? record.requestId : targetId;
    const href = `/decision-center/detail?${query.toString()}#${routeType}/${encodeURIComponent(routeTarget)}`;
    return freeze({
      targetType: canonicalType,
      targetId,
      href,
      stableDetailEntry: href,
      scenarioContext: clone(this.context),
      readOnly: true,
      canWrite: false,
      writeCapabilities: [],
      navigationContext: sanitizeNavigationContext(options.navigationContext || options.returnContext, this.context, record.subjectId || null, record.subjectName || null),
      record: clone(record)
    });
  }

  buildReturnContext(input = {}, subjectId) {
    return sanitizeNavigationContext(input, this.context, subjectId);
  }

  getC019Summary(options = {}) {
    this._refreshState();
    if (options.scenarioContext && !sameRun(options.scenarioContext, this.context)) {
      fail('SCENARIO_CONTEXT_MISMATCH', 'C019 read context does not match the active scenario run');
    }
    const summaryAt = this._now();
    const requests = this._state.requests.map((request) => {
      const refs = this._refsForRequest(request);
      const details = {
        request: refs.request ? this._detailEntry('request', refs.request, { ...options, navigationContext: { ...(options.navigationContext || options.returnContext || {}), sourceScenario: request.scenario || request.sourceType, subjectName: request.subjectName } }, request.subjectId) : null,
        reminder: refs.reminder ? this._detailEntry('reminder', refs.reminder, { ...options, navigationContext: { ...(options.navigationContext || options.returnContext || {}), sourceScenario: request.scenario || request.sourceType, subjectName: request.subjectName } }, request.subjectId) : null,
        task: refs.task ? this._detailEntry('task', refs.task, { ...options, navigationContext: { ...(options.navigationContext || options.returnContext || {}), sourceScenario: request.scenario || request.sourceType, subjectName: request.subjectName } }, request.subjectId) : null,
        trace: refs.trace ? this._detailEntry('trace', refs.trace, { ...options, navigationContext: { ...(options.navigationContext || options.returnContext || {}), sourceScenario: request.scenario || request.sourceType, subjectName: request.subjectName } }, request.subjectId) : null
      };
      return {
        requestId: request.requestId,
        requestRef: details.request,
        reminderRef: details.reminder,
        confirmationRef: refs.confirmation,
        taskRef: details.task,
        traceRef: details.trace,
        stableRefs: {
          request: details.request,
          reminder: details.reminder,
          task: details.task,
          trace: details.trace
        },
        requestRefId: refs.request,
        reminderRefId: refs.reminder,
        taskRefId: refs.task,
        traceRefId: refs.trace,
        detailEntries: details,
        navigationContext: sanitizeNavigationContext({ ...(options.navigationContext || options.returnContext || {}), sourceScenario: request.scenario || request.sourceType, subjectName: request.subjectName }, this.context, request.subjectId, request.subjectName),
        scenarioContext: clone(request.scenarioContext),
        sourceType: request.sourceType,
        sourceRef: request.sourceRef,
        scenario: request.scenario,
        sourceScene: request.scenario || request.sourceType,
        subjectId: request.subjectId,
        subjectName: request.subjectName,
        businessSubject: request.subjectName || request.subjectId,
        actionType: clone(request.actionType),
        rule: clone(request.rule),
        ruleApplicability: request.ruleApplicability,
        metric: clone(request.metric),
        metricId: request.metric?.id || null,
        metricValue: request.metric?.value === undefined ? null : clone(request.metric.value),
        semanticVersion: request.semanticVersion,
        dataVersion: request.dataVersion,
        t007: request.t007 || request.dataVersion,
        cutoff: request.evidence?.cutoff || null,
        requestStatus: request.requestStatus,
        reminderStatus: request.reminderStatus,
        confirmationStatus: request.confirmationStatus,
        taskStatus: request.taskStatus,
        receivedAt: request.receivedAt,
        lastReadAt: request.c017Reads?.at(-1)?.readAt || null,
        qualityStatus: request.c017Reads?.at(-1)?.qualityStatus || null,
        c017SummaryId: request.c017Reads?.at(-1)?.summaryId || null,
        c017SummaryVersion: request.c017Reads?.at(-1)?.summaryVersion || null,
        c017SummaryFormedAt: request.c017Reads?.at(-1)?.summaryFormedAt || null,
        c017EvidenceLocator: request.c017Reads?.at(-1)?.evidenceLocator || null
      };
    });
    const counts = {
      requests: requests.length,
      received: requests.filter((item) => item.requestStatus === 'received').length,
      blocked: requests.filter((item) => ['unknown', 'unlocatable', 'read_error', 'version_conflict'].includes(item.requestStatus)).length,
      rejected: requests.filter((item) => item.requestStatus === 'rejected').length,
      awaitingConfirmation: requests.filter((item) => item.reminderStatus === 'awaiting_confirmation').length,
      confirmed: requests.filter((item) => item.confirmationStatus === 'confirmed').length,
      humanRejected: requests.filter((item) => item.confirmationStatus === 'rejected').length,
      tasksPending: this._state.todos.filter((item) => item.status === 'pending').length,
      tasksCreated: this._state.todos.length,
      taskCreationBlocked: requests.filter((item) => ['blocked', 'rejected', 'create_failed', 'unknown'].includes(item.taskStatus)).length
    };
    return freeze({
      schemaVersion: C019_SCHEMA_VERSION,
      contractCode: 'C019',
      moduleId: 'M04',
      status: requests.length ? 'ready' : 'empty',
      availability: 'available',
      stateRevision: this._state.stateRevision || 0,
      summaryAt,
      summaryAsOf: summaryAt,
      formedAt: summaryAt,
      scenarioContext: clone(this.context),
      readOnly: true,
      canWrite: false,
      writeCapabilities: [],
      counts,
      statusCounts: clone(counts),
      records: requests,
      navigationContext: sanitizeNavigationContext(options.navigationContext || options.returnContext, this.context, null)
    });
  }

  _detailEntry(type, id, options = {}, subjectId) {
    const detail = this.getDetail(type, id, options);
    if (!detail) return null;
    const { record, ...entry } = detail;
    return { ...entry, subjectId: subjectId || null };
  }

  readC019(options = {}) { return this.getC019Summary(options); }
  getC019(options = {}) { return this.getC019Summary(options); }
  refreshC019(options = {}) { return this.getC019Summary(options); }
  readBackLink(options = {}) { return this.getC019Summary(options); }
  getSummary(options = {}) { return this.getC019Summary(options); }
  createReadOnlyProjection(options = {}) { return this.getC019Summary(options); }

  exportCheckpoint(options = {}) {
    const checkpointId = valueText(options.checkpointId) || `CP-M04-${this.context.scenarioRunId}-${digest(this._state, 12).toUpperCase()}`;
    const entries = [];
    const add = (kind, items) => items.forEach((record) => entries.push({ kind, record: clone(record) }));
    add('request', this._state.requests);
    add('reminder', this._state.reminders);
    add('confirmation', this._state.confirmations);
    add('assignment', this._state.todos);
    add('notificationReceipt', this._state.notifications);
    add('receipt', this._state.receipts);
    add('activity', this._state.activities);
    const value = {
      schemaVersion: checkpoint.CHECKPOINT_SCHEMA_VERSION,
      checkpointId,
      immutable: true,
      moduleId: 'M04',
      moduleVersion: SERVICE_VERSION,
      contractCode: 'C034',
      scenarioContext: clone(this.context),
      sourceScenarioRunId: this.context.scenarioRunId,
      restoreReadiness: { status: 'verified', verifiedAt: this._now(), owner: 'M04' },
      baselineVersion: options.baselineVersion || 'implementation-0.1.0',
      baselineSnapshotId: options.baselineSnapshotId || 'BSL-OFW-V110-94ABD0E991B7',
      stateFingerprint: digest(this._state, 64),
      c019SummaryAtExport: clone(this.getC019Summary()),
      // Generic ledger names are intentional: C034 recovery may carry
      // historical evidence, but it must never replay a dispatch collection.
      m04Ledger: { schemaVersion: STATE_SCHEMA_VERSION, context: clone(this.context), entries },
      sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY,
      overwritesHistory: false,
      overwritesSource: false
    };
    const forbidden = hasForbiddenC017Copy(value, '$');
    if (forbidden.length) fail('C017_COPY_FORBIDDEN', 'checkpoint contains a forbidden C017 copy', { paths: forbidden });
    return freeze(value);
  }

  export(options = {}) { return this.exportCheckpoint(options); }

  validateCheckpoint(value) {
    const structural = foundation.validateCheckpoint(value);
    const errors = [...structural.errors];
    if (value?.moduleId !== 'M04') errors.push({ code: 'MODULE_MISMATCH', path: 'moduleId', message: 'checkpoint moduleId must be M04' });
    const context = value?.scenarioContext;
    if (context && !sameRun(context, this.context)) {
      errors.push({ code: 'SCENARIO_CONTEXT_MISMATCH', path: 'scenarioContext', message: 'checkpoint belongs to a different scenario run' });
    }
    if (!value?.m04Ledger || !Array.isArray(value.m04Ledger.entries)) errors.push({ code: 'MISSING_M04_LEDGER', path: 'm04Ledger.entries', message: 'M04 checkpoint ledger is required' });
    if (value?.m04Ledger?.schemaVersion && value.m04Ledger.schemaVersion !== STATE_SCHEMA_VERSION) {
      errors.push({ code: 'M04_LEDGER_SCHEMA_INCOMPATIBLE', path: 'm04Ledger.schemaVersion', message: 'M04 ledger schema must match the exact registered version' });
    }
    const forbidden = hasForbiddenC017Copy(value, '$');
    if (forbidden.length) errors.push({ code: 'C017_COPY_FORBIDDEN', path: '$', message: 'checkpoint must not contain a C017 projection copy', details: { paths: forbidden } });
    return { ok: errors.length === 0, valid: errors.length === 0, errors };
  }

  validate(value) { return this.validateCheckpoint(value); }

  createCheckpointProvider(options = {}) {
    const service = this;
    return checkpoint.createCheckpointProvider({
      export(request = {}) { return service.exportCheckpoint(request); },
      validate(value) { return service.validateCheckpoint(value); },
      cloneRestore(request = {}) {
        const source = request.checkpoint || request.sourceCheckpoint;
        const validation = service.validateCheckpoint(source);
        if (!validation.ok) fail('INVALID_CHECKPOINT', 'M04 checkpoint validation failed', validation.errors);
        const targetContext = request.scenarioContext || request.targetScenarioContext;
        const entries = clone(source.m04Ledger.entries);
        return {
          moduleId: 'M04',
          restoredLedger: { schemaVersion: STATE_SCHEMA_VERSION, entries },
          restoredScenarioContext: clone(targetContext || null),
          historicalFactsReadOnly: true,
          sideEffectsSuppressed: true,
          sourceRefs: { checkpointId: source.checkpointId, sourceScenarioRunId: source.scenarioContext.scenarioRunId },
          restoreAdapterVersion: SERVICE_VERSION
        };
      },
      isolatedReplay(request = {}) {
        return {
          moduleId: 'M04',
          replayedFacts: [],
          historicalFactsReadOnly: true,
          sideEffectsSuppressed: true,
          sourceCheckpointId: request.checkpoint?.checkpointId || null
        };
      },
      migrationCompare(request = {}) {
        return { moduleId: 'M04', compared: true, sourceRefs: { source: request.source?.checkpointId || null, target: request.target?.checkpointId || null } };
      }
    }, options);
  }

  async receiveActionRequestAsync(input, options = {}) {
    this._assertWritable();
    let normalized;
    try { normalized = this._normalizeRequest(input); } catch (error) {
      return this.receiveActionRequest(input, { ...options, allowAsync: false });
    }
    const existing = this._findExistingById(normalized.requestId);
    if (existing) return this.receiveActionRequest(input, { ...options, allowAsync: false });
    const inFlightKey = normalized.idempotencyKey;
    if (this._inFlight.has(inFlightKey)) return this._inFlight.get(inFlightKey);
    const operation = (async () => {
      const before = digest(this._state);
      const raw = await this._readC017RawAsync(normalized, GATES.REQUEST_RECEIPT);
      return this._runWithAsyncGate(raw, (transient) => transient.receiveActionRequest(input, options), before);
    })();
    this._inFlight.set(inFlightKey, operation);
    try { return await operation; } finally { this._inFlight.delete(inFlightKey); }
  }

  async retryRequestReceiptAsync(id, input = {}) {
    this._assertWritable();
    const existing = this._findRequest(id);
    if (!existing || existing.requestStatus === 'received' || existing.requestStatus === 'rejected' || existing.requestStatus === READ_OUTCOMES.VERSION_CONFLICT) {
      return this.retryRequestReceipt(id, { ...input, allowAsync: false });
    }
    const before = digest(this._state);
    const raw = await this._readC017RawAsync(existing, GATES.REQUEST_RECEIPT);
    return this._runWithAsyncGate(raw, (transient) => transient.retryRequestReceipt(id, input), before);
  }

  async confirmActionAsync(id, input = {}, options = {}) {
    this._assertWritable();
    const request = this._findRequest(id);
    if (!request) return this.confirmAction(id, input, { ...options, allowAsync: false });
    let form;
    try { form = this._confirmationForm(input, request); } catch (_) { return this.confirmAction(id, input, { ...options, allowAsync: false }); }
    if (form.mode === 'reject' || request.confirmationStatus === 'confirmed' || request.confirmationStatus === 'rejected') {
      return this.confirmAction(id, input, { ...options, allowAsync: false });
    }
    const inFlightKey = `confirm|${request.idempotencyKey}`;
    if (this._inFlight.has(inFlightKey)) return this._inFlight.get(inFlightKey);
    const before = digest(this._state);
    const operation = (async () => {
      const raw = await this._readC017RawAsync(request, GATES.CONFIRMATION_SUBMIT);
      return this._runWithAsyncGate(raw, (transient) => transient.confirmAction(id, input, options), before);
    })();
    this._inFlight.set(inFlightKey, operation);
    try { return await operation; } finally { this._inFlight.delete(inFlightKey); }
  }

  async createTaskAsync(id, input = {}) {
    this._assertWritable();
    const request = this._findRequest(id);
    if (!request || request.taskId || this._findTaskForRequest(id) || request.confirmationStatus !== 'confirmed') return this.createTask(id, { ...input, allowAsync: false });
    const last = [...(request.c017Reads || [])].reverse().find((item) => item.gate === GATES.TASK_FORMATION);
    if (last?.outcome === READ_OUTCOMES.REJECTED || last?.outcome === READ_OUTCOMES.VERSION_CONFLICT) return this.createTask(id, { ...input, allowAsync: false });
    const inFlightKey = `task|${request.idempotencyKey}`;
    if (this._inFlight.has(inFlightKey)) return this._inFlight.get(inFlightKey);
    const before = digest(this._state);
    const operation = (async () => {
      const raw = await this._readC017RawAsync(request, GATES.TASK_FORMATION);
      return this._runWithAsyncGate(raw, (transient) => transient.createTask(id, input), before);
    })();
    this._inFlight.set(inFlightKey, operation);
    try { return await operation; } finally { this._inFlight.delete(inFlightKey); }
  }

  async retryTaskCreationAsync(id, input = {}) {
    return this.createTaskAsync(id, { ...input, retry: true });
  }

  restoreFromCheckpoint(source, options = {}) {
    return restoreFromCheckpoint(source, { ...options, c017Reader: options.c017Reader || this.c017Reader });
  }

  cloneRestore(source, options = {}) { return this.restoreFromCheckpoint(source, options); }
}

function createDecisionService(options) { return new DecisionService(options); }

function restoreFromCheckpoint(source, options = {}) {
  if (!isObject(source)) fail('INVALID_CHECKPOINT', 'M04 checkpoint must be an object');
  if (source.moduleId !== 'M04') fail('MODULE_MISMATCH', 'checkpoint moduleId must be M04');
  const forbidden = hasForbiddenC017Copy(source, '$');
  if (forbidden.length) fail('C017_COPY_FORBIDDEN', 'checkpoint contains a forbidden C017 copy', { paths: forbidden });
  foundation.assertCheckpoint(source);
  if (!source.m04Ledger || source.m04Ledger.schemaVersion !== STATE_SCHEMA_VERSION || !Array.isArray(source.m04Ledger.entries)) {
    fail('INVALID_CHECKPOINT', 'M04 checkpoint ledger is missing or uses an incompatible schema');
  }
  const plan = checkpoint.cloneRestore(source, {
    ...options,
    runIdFactory: options.runIdFactory || ((scenarioId, details) => `${scenarioId}-RUN-${details.operation || 'restore'}-${digest({ source: source.checkpointId || null, at: Date.now() }, 12)}`)
  });
  const targetContext = plan.scenarioContext;
  const restoredState = initialState(targetContext);
  const entries = Array.isArray(plan.restoreInput?.m04Ledger?.entries) ? plan.restoreInput.m04Ledger.entries : [];
  const buckets = {
    request: restoredState.requests,
    reminder: restoredState.reminders,
    confirmation: restoredState.confirmations,
    assignment: restoredState.todos,
    notificationReceipt: restoredState.notifications,
    receipt: restoredState.receipts,
    activity: restoredState.activities
  };
  entries.forEach((entry) => {
    if (entry && buckets[entry.kind] && entry.record) {
      const record = clone(entry.record);
      if (record.scenarioContext && !sameRun(record.scenarioContext, targetContext)) {
        record.sourceScenarioContext = clone(record.scenarioContext);
        record.scenarioContext = clone(targetContext);
      }
      record.historical = true;
      record.readOnly = true;
      buckets[entry.kind].push(record);
    }
  });
  // A restored run is intentionally read-only.  Historical notification and
  // assignment records are facts/receipts only; no writer is invoked.
  const restored = new DecisionService({
    scenarioContext: { ...targetContext, status: 'restored' },
    c017Reader: options.c017Reader || (() => null),
    initialState: restoredState,
    clock: options.clock || options.now
  });
  return freeze({ service: restored, plan: clone(plan), state: restored.getState() });
}

DecisionService.fromCheckpoint = restoreFromCheckpoint;

function validateC017Receipt(value) {
  const errors = [];
  if (!isObject(value)) return { ok: false, valid: false, errors: [{ code: 'TYPE', path: '$', message: 'C017 receipt must be an object' }] };
  if (value.schemaVersion !== C017_RECEIPT_SCHEMA_VERSION) errors.push({ code: 'SCHEMA', path: 'schemaVersion', message: 'invalid C017 receipt schema' });
  if (!Object.values(GATES).includes(value.gate)) errors.push({ code: 'GATE', path: 'gate', message: 'invalid C017 gate' });
  if (!text(value.t007 || value.dataVersion)) errors.push({ code: 'T007', path: 't007', message: 'exact T007 is required' });
  if (!Object.values(READ_OUTCOMES).includes(value.outcome)) errors.push({ code: 'OUTCOME', path: 'outcome', message: 'invalid C017 read outcome' });
  if (value.outcome === READ_OUTCOMES.ALLOWED && (value.hardQualityFailure !== false || !value.summaryId || !value.summaryVersion || !value.summaryFormedAt)) errors.push({ code: 'NOT_ALLOWED', path: '$', message: 'allowed receipt requires explicit current summary and no hard failure' });
  return { ok: errors.length === 0, valid: errors.length === 0, errors };
}

const api = {
  SERVICE_VERSION,
  STATE_SCHEMA_VERSION,
  REQUEST_SCHEMA_VERSION,
  REMINDER_SCHEMA_VERSION,
  CONFIRMATION_SCHEMA_VERSION,
  TASK_SCHEMA_VERSION,
  C019_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION,
  C017_RECEIPT_SCHEMA_VERSION,
  GATES,
  READ_OUTCOMES,
  DecisionError,
  DecisionService,
  M04DecisionService: DecisionService,
  DecisionRuntime: DecisionService,
  createDecisionService,
  createService: createDecisionService,
  createM04DecisionService: createDecisionService,
  restoreFromCheckpoint,
  restore: restoreFromCheckpoint,
  cloneRestore: restoreFromCheckpoint,
  validateC017Receipt,
  buildIdempotencyKey: idempotencyKey,
  fingerprintRequest: contractFingerprint
};

module.exports = Object.freeze(api);
