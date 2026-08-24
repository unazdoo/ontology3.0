'use strict';

/*
 * M03-owned C011 provider shape. Both public builders feed this boundary so
 * the downstream decision consumer receives one deterministic payload shape.
 * This is an implementation adapter, not a new platform contract.
 */

const identity = require('../../packages/identity');
const { fail } = require('./errors');
const {
  isRecord,
  clone,
  deepFreeze,
  contextTriple,
  normalizeEvidenceRefs,
  fingerprint,
  nowIso,
  firstString
} = require('./utils');

const C011_SCHEMA_VERSION = 'ofw.m03.c011.action-request.v1';
const PUBLISHED_STATUSES = new Set(['published', 'PUBLISHED', '已发布', 'PUBLISHED-RESULTS', 'SUCCEEDED']);
const SIDE_EFFECT_FIELDS = Object.freeze([
  'createsDecision',
  'createsTodo',
  'sendsNotification',
  'm03CreatesDecision',
  'm03CreatesTodo',
  'm03SendsNotification'
]);

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function required(value, field, code = 'ERR_C011_REQUIRED') {
  if (!text(value)) fail(code, `C011.${field} is required`, { field });
  return String(value).trim();
}

function timestamp(value, field) {
  const normalized = required(value, field, 'ERR_C011_TIMESTAMP_REQUIRED');
  if (!identity.isDateTime(normalized)) fail('ERR_C011_TIMESTAMP_INVALID', `C011.${field} must be an RFC 3339 timestamp`, { field, value: normalized });
  return normalized;
}

function refs(value, path = 'evidenceRefs') {
  if (value === undefined || value === null) return [];
  const input = Array.isArray(value) ? value : [value];
  return normalizeEvidenceRefs(input, path);
}

function mergeRefs(...values) {
  const byKey = new Map();
  values.forEach((value, index) => {
    refs(value, `evidenceRefs[${index}]`).forEach((ref) => {
      byKey.set(`${ref.evidenceType || ''}:${ref.evidenceId}:${ref.evidenceVersion || ''}`, ref);
    });
  });
  return [...byKey.values()].sort((left, right) => `${left.evidenceType || ''}:${left.evidenceId}:${left.evidenceVersion || ''}`.localeCompare(`${right.evidenceType || ''}:${right.evidenceId}:${right.evidenceVersion || ''}`));
}

function evidenceId(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isRecord(value)) return null;
  return firstString(value, ['evidenceId', 'refId', 'id', 'key', 'uri']);
}

function normalizeSubject(source) {
  const subjects = source.subjects || source.targetSubjects;
  if (subjects !== undefined && (!Array.isArray(subjects) || subjects.length !== 1)) {
    fail('ERR_C011_TARGET_REQUIRED', 'C011 requires exactly one business subject');
  }
  const target = source.target || source.subject || (subjects ? subjects[0] : null);
  if (!isRecord(target)) fail('ERR_C011_TARGET_REQUIRED', 'C011 requires one stable target subject');
  const subjectId = firstString(target, ['subjectId', 'stableId', 'objectId', 'id']) || firstString(source, ['subjectId', 'entityId', 'enterpriseId']);
  const subjectName = firstString(target, ['subjectName', 'name', 'label']) || firstString(source, ['subjectName', 'entityName', 'enterpriseName']);
  if (!subjectId) fail('ERR_C011_TARGET_REQUIRED', 'C011 subjectId is required');
  if (!subjectName) fail('ERR_C011_TARGET_REQUIRED', 'C011 subjectName is required');
  return { subjectId, subjectName, target: clone(target) };
}

function normalizeActionType(source, semanticVersion) {
  const raw = source.actionType;
  if (!isRecord(raw)) fail('ERR_C011_ACTION_TYPE_REQUIRED', 'C011 actionType must be a versioned Published reference');
  const id = firstString(raw, ['id', 'actionTypeId', 'stableId']) || firstString(source, ['actionTypeId']);
  const version = firstString(raw, ['version', 'publishedVersionId', 'semanticVersionId', 'actionTypeVersion']) || firstString(source, ['actionTypeVersion']);
  const status = firstString(raw, ['status', 'lifecycleStatus', 'publicationStatus']) || firstString(source, ['actionTypeStatus']);
  if (!id || !version || !status) fail('ERR_C011_ACTION_TYPE_REQUIRED', 'C011 actionType requires id, version and status');
  if (!PUBLISHED_STATUSES.has(status) && !PUBLISHED_STATUSES.has(status.toLowerCase())) {
    fail('ERR_C011_ACTION_TYPE_NOT_PUBLISHED', 'C011 actionType must be Published', { status });
  }
  const actionSemanticVersion = firstString(raw, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion']);
  if (actionSemanticVersion && actionSemanticVersion !== semanticVersion) {
    fail('ERR_C011_VERSION_MISMATCH', 'C011 actionType does not belong to the fixed Published semantic version', { expected: semanticVersion, actual: actionSemanticVersion });
  }
  const allowlist = source.resourceWhitelist || source.resourceAllowlist || [];
  if (Array.isArray(allowlist) && allowlist.length) {
    const configured = allowlist.find((item) => (typeof item === 'string' ? item : firstString(item, ['resourceId', 'actionTypeId', 'id', 'stableId'])) === id);
    if (!configured) fail('ERR_C011_ACTION_TYPE_NOT_ALLOWED', 'C011 actionType is outside the fixed C009 resource allowlist', { actionTypeId: id });
    const configuredVersion = isRecord(configured) && firstString(configured, ['version', 'resourceVersion', 'publishedVersion']);
    if (configuredVersion && configuredVersion !== version) fail('ERR_C011_VERSION_MISMATCH', 'C011 actionType version differs from the fixed C009 resource version', { expected: configuredVersion, actual: version });
  }
  return {
    id,
    version,
    name: firstString(raw, ['name', 'label', 'title']) || null,
    status: 'published'
  };
}

function hitBranch(rule) {
  const direct = firstString(rule, ['branch', 'triggerBranch', 'branchId']);
  if (direct) return direct;
  const branches = Array.isArray(rule.branches) ? rule.branches : [];
  const hit = branches.find((branch) => {
    const status = String(branch?.status || branch?.outcome || '').toLowerCase();
    return branch?.matched === true || branch?.hit === true || status === 'hit' || status === 'true';
  });
  return hit ? firstString(hit, ['branch', 'branchId', 'id', 'name']) : null;
}

function normalizeRule(source, generatedAt) {
  const raw = source.rule;
  if (!isRecord(raw)) fail('ERR_C011_RULE_REQUIRED', 'C011 requires one Rule hit');
  const id = firstString(raw, ['id', 'ruleId', 'stableId']);
  const version = firstString(raw, ['version', 'ruleVersion', 'publishedVersion']);
  const status = String(raw.status || raw.outcome || (raw.hit === true ? 'hit' : '')).toLowerCase();
  if (!id || !version || !['hit', 'true'].includes(status)) fail('ERR_C011_RULE_REQUIRED', 'C011 Rule must be a versioned hit');
  const evaluatedAt = timestamp(firstString(raw, ['evaluatedAt', 'evaluationTime']) || source.ruleEvaluatedAt || generatedAt, 'rule.evaluatedAt');
  // A missing explicit branch is only normalized to the deterministic hit
  // branch when the Rule result itself proves a hit; no prose is invented.
  const branch = hitBranch(raw) || (status === 'hit' ? 'hit' : null);
  if (!branch) fail('ERR_C011_RULE_BRANCH_REQUIRED', 'C011 hit Rule must identify its hit branch');
  const ruleRefs = mergeRefs(raw.evidenceRefs, raw.evidence, source.ruleEvidenceRefs);
  if (!ruleRefs.length) fail('ERR_C011_RULE_EVIDENCE_REQUIRED', 'C011 hit Rule must carry fixed evidence references');
  const refIds = new Set(ruleRefs.map((ref) => ref.evidenceId));
  const suppliedHitEvidence = evidenceId(raw.hitEvidence);
  const hitEvidence = suppliedHitEvidence || ruleRefs[0].evidenceId;
  if (!hitEvidence || !refIds.has(hitEvidence)) {
    fail('ERR_C011_RULE_EVIDENCE_REQUIRED', 'C011 hitEvidence must reference a fixed Rule evidence id', { hitEvidence });
  }
  const ruleSemanticVersion = firstString(raw, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion']);
  if (ruleSemanticVersion && ruleSemanticVersion !== source.semanticVersion) {
    fail('ERR_C011_VERSION_MISMATCH', 'C011 Rule is not from the fixed Published semantic version', { expected: source.semanticVersion, actual: ruleSemanticVersion });
  }
  return {
    value: { id, version, evaluatedAt, branch, hitEvidence },
    evidenceRefs: ruleRefs
  };
}

function metricCandidates(source) {
  const structured = source.structuredMetrics || source.metrics || source.structuredResult?.metrics || source.structuredResult?.metricResults || [];
  const explicit = source.metricSnapshot !== undefined ? source.metricSnapshot : source.metric;
  const toItems = (value) => {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && (own(value, 'id') || own(value, 'metricId') || own(value, 'value') || own(value, 'actualValue') || own(value, 'result'))) return [value];
    if (isRecord(value)) return Object.entries(value).map(([id, item]) => isRecord(item) ? { ...item, id: item.id || item.metricId || id } : { id, value: item });
    return [];
  };
  const byId = new Map();
  toItems(structured).forEach((item) => {
    if (isRecord(item)) {
      const id = firstString(item, ['id', 'metricId', 'key', 'name']);
      if (id) byId.set(id, clone(item));
    }
  });
  toItems(explicit).forEach((item) => {
    if (isRecord(item)) {
      const id = firstString(item, ['id', 'metricId', 'key', 'name']);
      if (id) byId.set(id, { ...(byId.get(id) || {}), ...clone(item) });
    }
  });
  return [...byId.values()];
}

function normalizeMetrics(source, generatedAt, snapshotFallback) {
  const candidates = metricCandidates(source);
  if (!candidates.length) fail('ERR_C011_METRIC_REQUIRED', 'C011 requires a metric snapshot');
  const values = candidates.map((raw) => {
    const id = firstString(raw, ['id', 'metricId', 'key', 'name']);
    const value = own(raw, 'value') ? raw.value : own(raw, 'actualValue') ? raw.actualValue : own(raw, 'result') ? raw.result : raw.metricValue;
    if (!id || value === undefined || value === null) fail('ERR_C011_METRIC_REQUIRED', 'C011 metric snapshot requires id and value');
    const evidenceRefs = mergeRefs(raw.evidenceRefs, raw.evidence, source.metricEvidenceRefs);
    if (!evidenceRefs.length) fail('ERR_C011_METRIC_EVIDENCE_REQUIRED', 'C011 metric snapshot requires fixed evidence references', { metricId: id });
    const snapshotId = firstString(raw, ['snapshotId', 'metricSnapshotId']) || evidenceRefs[0].evidenceId || snapshotFallback;
    if (!snapshotId) fail('ERR_C011_METRIC_SNAPSHOT_REQUIRED', 'C011 metric snapshot identity is required', { metricId: id });
    return {
      id,
      name: firstString(raw, ['name', 'label', 'title']) || null,
      value: clone(value),
      unit: firstString(raw, ['unit', 'uom']) || null,
      scope: firstString(raw, ['scope', 'objectScope']) || null,
      evaluatedAt: timestamp(firstString(raw, ['evaluatedAt', 'evaluationTime']) || generatedAt, 'metric.evaluatedAt'),
      explanation: firstString(raw, ['explanation', 'triggerExplanation']) || null,
      snapshotId
    };
  });
  values.sort((left, right) => left.id.localeCompare(right.id));
  return { value: values[0], values, evidenceRefs: mergeRefs(...candidates.map((item) => item.evidenceRefs || item.evidence || [])) };
}

function normalizeT008(source, dataVersion, evidenceRefs) {
  const raw = source.t008;
  const rawObject = isRecord(raw) ? raw : null;
  const value = firstString(rawObject, ['value', 'asOf', 'dataAsOf', 'through']) || (typeof raw === 'string' ? raw.trim() : null) || firstString(source, ['dataCutoff', 'cutoff']);
  if (!value) fail('ERR_C011_T008_REQUIRED', 'C011 requires a fixed T008/data cutoff');
  const t008Refs = mergeRefs(rawObject?.evidenceRefs, source.t008Evidence, evidenceRefs);
  if (!t008Refs.length) fail('ERR_C011_T008_EVIDENCE_REQUIRED', 'C011 T008/data cutoff requires fixed evidence references');
  const id = firstString(rawObject, ['id', 't008Id', 'evidenceId']) || t008Refs.find((ref) => ref.evidenceType === 'T008')?.evidenceId || t008Refs[0].evidenceId || dataVersion;
  return { id, value, timezone: firstString(rawObject, ['timezone', 'timeZone', 'tz']) || null, precision: firstString(rawObject, ['precision', 'granularity']) || null, evidenceRefs: t008Refs };
}

function normalizeConfiguration(source) {
  const config = source.configuration || source.config || {};
  const configVersion = firstString(config, ['configVersion', 'configurationVersion', 'version']) || firstString(source, ['configVersion', 'configurationVersion']);
  const promptVersion = firstString(config, ['promptVersion', 'systemPromptVersion']) || firstString(source, ['promptVersion']);
  const skills = config.skillVersions || config.skillSet || config.skills || source.skillVersions || source.skillSet;
  const tools = config.toolAllowlist || config.toolWhitelist || config.tools || source.toolAllowlist;
  if (!configVersion || !promptVersion || !Array.isArray(skills) || !Array.isArray(tools) || !skills.length || !tools.length) fail('ERR_C011_CONFIGURATION_REQUIRED', 'C011 requires the fixed C009 configuration versions');
  const normalizeRef = (item, idKeys) => {
    if (typeof item === 'string' && item.trim()) return { id: item.trim(), version: item.trim() };
    if (!isRecord(item)) return null;
    return { id: firstString(item, idKeys), version: firstString(item, ['version', 'skillVersion', 'toolVersion', 'refVersion']) };
  };
  const skillVersions = skills.map((item) => normalizeRef(item, ['skillId', 'id', 'stableId'])).filter(Boolean);
  const toolAllowlist = tools.map((item) => normalizeRef(item, ['toolId', 'id', 'stableId'])).filter(Boolean);
  if (skillVersions.some((item) => !item.id || !item.version) || toolAllowlist.some((item) => !item.id || !item.version)) fail('ERR_C011_CONFIGURATION_REQUIRED', 'C011 Skill and Tool references must pin versions');
  return { configVersion, promptVersion, skillVersions, toolAllowlist, toolAllowlistVersion: firstString(config, ['toolAllowlistVersion', 'toolWhitelistVersion', 'toolsVersion']) || firstString(source, ['toolAllowlistVersion']) || null };
}

function buildC011Request(source = {}) {
  if (!isRecord(source)) fail('ERR_C011_INVALID', 'C011 provider input must be an object');
  const scenarioContext = contextTriple(source.scenarioContext);
  if (!['active', 'running', 'ready', 'pending', 'restored', 'regression'].includes(String(scenarioContext.status || '').toLowerCase())) fail('ERR_C011_CONTEXT_INVALID', 'C011 cannot be formed for a closed or unknown scenario run');
  const generatedAt = timestamp(source.generatedAt || source.completedAt || source.startedAt || source.requestedAt, 'generatedAt');
  const requestedAt = timestamp(source.requestedAt || generatedAt, 'requestedAt');
  const subject = normalizeSubject(source);
  const semanticVersion = required(source.semanticVersion || source.publishedOntologyVersion || source.publishedVersionId || source.publishedVersion, 'semanticVersion', 'ERR_C011_VERSION_CONTEXT_MISSING');
  const dataVersion = required(source.dataVersion || source.exactDataVersion, 'dataVersion', 'ERR_C011_VERSION_CONTEXT_MISSING');
  const t007 = required(source.t007 || source.t007Version || dataVersion, 't007', 'ERR_C011_VERSION_CONTEXT_MISSING');
  const actionType = normalizeActionType(source, semanticVersion);
  const ruleResult = normalizeRule({ ...source, semanticVersion }, generatedAt);
  const sourceResultId = firstString(source, ['sourceResultId', 'resultId']);
  const sourceResultFingerprint = firstString(source, ['sourceResultFingerprint', 'fingerprint']);
  const snapshotFallback = sourceResultId || sourceResultFingerprint || null;
  const metricResult = normalizeMetrics(source, generatedAt, snapshotFallback);
  const preliminaryRefs = mergeRefs(source.evidenceRefs, source.resultEvidenceRefs, source.t008Evidence, source.qualityEvidenceRefs, source.freshnessEvidenceRefs, ruleResult.evidenceRefs, metricResult.evidenceRefs, source.metricEvidenceRefs, source.structuredResult?.evidenceRefs);
  const t008 = normalizeT008(source, dataVersion, preliminaryRefs);
  const allEvidenceRefs = mergeRefs(preliminaryRefs, t008.evidenceRefs, metricResult.evidenceRefs);
  const evidence = source.evidence || {};
  const evidenceSnapshotId = firstString(evidence, ['snapshotId', 'resultSnapshotId']) || firstString(source, ['evidenceSnapshotId', 'snapshotId']) || snapshotFallback;
  const dataCutoff = firstString(evidence, ['cutoff', 'dataCutoff']) || firstString(source, ['dataCutoff', 'cutoff']) || t008.value;
  if (!evidenceSnapshotId || !dataCutoff || !allEvidenceRefs.length) fail('ERR_C011_EVIDENCE_REQUIRED', 'C011 evidence requires snapshotId, data cutoff and fixed references');
  const configuration = normalizeConfiguration(source);
  const quality = clone(source.quality || source.qualityFreshness?.quality || null);
  const freshness = clone(source.freshness || source.qualityFreshness?.freshness || null);
  if (!isRecord(quality) || !firstString(quality, ['status', 'qualityStatus', 'state'])) fail('ERR_C011_QUALITY_REQUIRED', 'C011 quality status is required');
  if (!isRecord(freshness) || !firstString(freshness, ['status', 'freshnessStatus', 'state'])) fail('ERR_C011_FRESHNESS_REQUIRED', 'C011 freshness status is required');
  const requestId = firstString(source, ['requestId', 'id', 'actionRequestId']) || `ACTION-${fingerprint({ scenarioContext, subjectId: subject.subjectId, actionType, rule: ruleResult.value, semanticVersion, dataVersion }).slice(0, 24)}`;
  const idempotencyKey = source.idempotencyKey || identity.generateIdempotencyKey({ scenarioContext, requestId, subjectId: subject.subjectId, actionTypeId: actionType.id, ruleId: ruleResult.value.id, semanticVersion, dataVersion, t007 }, { fields: ['scenarioContext', 'requestId', 'subjectId', 'actionTypeId', 'ruleId', 'semanticVersion', 'dataVersion', 't007'] });
  if (!identity.validateIdempotencyKey(idempotencyKey).valid) fail('ERR_C011_IDEMPOTENCY_INVALID', 'C011 idempotency key is invalid');
  const output = {
    schemaVersion: C011_SCHEMA_VERSION,
    contractCode: 'C011',
    requestId,
    id: requestId,
    idempotencyKey,
    scenarioContext,
    scenarioIdentity: { scenarioId: scenarioContext.scenarioId, scenarioVersion: scenarioContext.scenarioVersion, scenarioRunId: scenarioContext.scenarioRunId },
    scenarioId: scenarioContext.scenarioId,
    scenarioVersion: scenarioContext.scenarioVersion,
    scenarioRunId: scenarioContext.scenarioRunId,
    sourceModule: 'M03',
    sourceType: source.sourceType || 'rule',
    sourceRef: source.sourceRef || sourceResultId || ruleResult.value.id,
    sourceRunId: source.sourceRunId || null,
    sourceResultId: sourceResultId || null,
    sourceResultFingerprint: sourceResultFingerprint || null,
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
    targetStableId: subject.subjectId,
    target: subject.target,
    actionType,
    actionTypeId: actionType.id,
    actionTypeVersion: actionType.version,
    semanticVersion,
    publishedOntologyVersion: semanticVersion,
    publishedVersion: semanticVersion,
    publishedVersionId: semanticVersion,
    dataVersion,
    t007,
    t019Id: source.t019Id || null,
    t019Version: source.t019Version || null,
    t008,
    rule: ruleResult.value,
    ruleApplicability: 'applicable',
    metric: metricResult.value,
    metricSnapshot: metricResult.values,
    evidence: {
      semanticVersion,
      dataVersion,
      t007,
      cutoff: dataCutoff,
      snapshotId: evidenceSnapshotId,
      sourceResultId: sourceResultId || null,
      sourceResultVersion: source.resultVersion || source.sourceResultVersion || '1',
      refs: allEvidenceRefs
    },
    evidenceRefs: allEvidenceRefs,
    configVersion: configuration.configVersion,
    promptVersion: configuration.promptVersion,
    skillVersions: configuration.skillVersions,
    skillSet: configuration.skillVersions,
    toolAllowlist: configuration.toolAllowlist,
    toolAllowlistVersion: configuration.toolAllowlistVersion,
    quality,
    freshness,
    requestedAt,
    status: 'pending',
    createsDecision: false,
    createsTodo: false,
    sendsNotification: false,
    m03CreatesDecision: false,
    m03CreatesTodo: false,
    m03SendsNotification: false
  };
  assertC011Request(output);
  return deepFreeze(output);
}

function assertC011Request(value) {
  if (!isRecord(value) || value.contractCode !== 'C011') fail('ERR_C011_INVALID', 'C011 request must be a standard C011 object');
  if (value.schemaVersion !== C011_SCHEMA_VERSION) fail('ERR_C011_SCHEMA_MISMATCH', 'C011 request must use the canonical M03 action-request schema', { expected: C011_SCHEMA_VERSION, actual: value.schemaVersion || null });
  ['requestId', 'id', 'idempotencyKey', 'scenarioRunId', 'subjectId', 'subjectName', 'actionTypeId', 'semanticVersion', 'dataVersion', 't007', 'requestedAt'].forEach((field) => required(value[field], field, 'ERR_C011_INVALID'));
  const context = contextTriple(value.scenarioContext);
  if (context.scenarioRunId !== value.scenarioRunId) fail('ERR_C011_CONTEXT_MISMATCH', 'C011 scenarioRunId must match its C033 context');
  if (value.targetStableId !== value.subjectId) fail('ERR_C011_TARGET_MISMATCH', 'C011 targetStableId must remain an alias of subjectId');
  if (!isRecord(value.actionType) || value.actionType.id !== value.actionTypeId || !text(value.actionType.version) || !PUBLISHED_STATUSES.has(value.actionType.status) && !PUBLISHED_STATUSES.has(String(value.actionType.status).toLowerCase())) fail('ERR_C011_ACTION_TYPE_REQUIRED', 'C011 actionType id/version/status is incomplete or not Published');
  if (!isRecord(value.rule) || !text(value.rule.id) || !text(value.rule.version) || !identity.isDateTime(value.rule.evaluatedAt) || !text(value.rule.branch) || !text(value.rule.hitEvidence)) fail('ERR_C011_RULE_REQUIRED', 'C011 Rule requires id/version/evaluatedAt/branch/hitEvidence');
  if (!Array.isArray(value.evidenceRefs) || !value.evidenceRefs.length) fail('ERR_C011_EVIDENCE_REQUIRED', 'C011 requires fixed evidence references');
  const evidenceIds = new Set(value.evidenceRefs.map((ref) => ref.evidenceId));
  if (!evidenceIds.has(value.rule.hitEvidence)) fail('ERR_C011_RULE_EVIDENCE_REQUIRED', 'C011 hitEvidence must reference a fixed evidence id');
  if (!isRecord(value.metric) || !text(value.metric.id) || value.metric.value === undefined || value.metric.value === null || !text(value.metric.snapshotId)) fail('ERR_C011_METRIC_REQUIRED', 'C011 metric snapshot requires id/value/snapshotId');
  if (!Array.isArray(value.metricSnapshot) || !value.metricSnapshot.length) fail('ERR_C011_METRIC_REQUIRED', 'C011 metricSnapshot is required');
  if (!isRecord(value.evidence) || value.evidence.semanticVersion !== value.semanticVersion || value.evidence.dataVersion !== value.dataVersion || value.evidence.t007 !== value.t007 || !text(value.evidence.snapshotId) || !text(value.evidence.cutoff) || !Array.isArray(value.evidence.refs) || !value.evidence.refs.length) fail('ERR_C011_EVIDENCE_REQUIRED', 'C011 evidence requires semantic/data/T007 versions, snapshot and cutoff');
  if (!isRecord(value.quality) || !text(value.quality.status) || !isRecord(value.freshness) || !text(value.freshness.status)) fail('ERR_C011_QUALITY_REQUIRED', 'C011 quality and freshness statuses are required');
  if (!text(value.configVersion) || !text(value.promptVersion) || !Array.isArray(value.skillVersions) || !value.skillVersions.length || !Array.isArray(value.toolAllowlist) || !value.toolAllowlist.length) fail('ERR_C011_CONFIGURATION_REQUIRED', 'C011 fixed configuration versions are required');
  if (!identity.isDateTime(value.requestedAt)) fail('ERR_C011_TIMESTAMP_INVALID', 'C011 requestedAt must be an RFC 3339 timestamp');
  SIDE_EFFECT_FIELDS.forEach((field) => { if (value[field] !== false) fail('ERR_C011_INVALID', `C011.${field} must be false`); });
  return true;
}

function validateC011Request(value) {
  try {
    assertC011Request(value);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code || 'ERR_C011_INVALID', message: error.message, details: error.details }] };
  }
}

module.exports = Object.freeze({
  C011_SCHEMA_VERSION,
  buildC011Request,
  assertC011Request,
  validateC011Request
});
