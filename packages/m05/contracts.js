'use strict';

const identity = require('../identity');
const foundationContracts = require('../contracts');
const {
  isRecord, isNonEmptyString, clone, immutable, sha256, issue, validation, assertValid, fail,
  assertNoForbiddenPayload, findForbiddenKeys, getRef, normalizeRef, identityFromContext, compareIdentity,
  requireString, list
} = require('./util');

const CONTRACT_VERSION = 'ofw.m05.contracts.draft.v1';
const ALLOWED_VERIFICATION_STATES = Object.freeze(['passed', 'warning', 'failed', 'not-verifiable', 'not_verifiable', 'unknown']);
const ALLOWED_CREDIBILITY_STATES = Object.freeze(['passed', 'warning', 'failed', 'unknown', 'not-verifiable', 'not_verifiable']);
const EXACT_VERSION_RE = /^(?!latest$)(?!current$)(?!head$)(?!tip$)(?!main$)(?!master$)\S+$/i;
const M05_ENVELOPE_SCHEMA_VERSION = foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION;

function pathValue(value, names) {
  for (const name of names) {
    if (isNonEmptyString(value?.[name])) return value[name].trim();
  }
  return null;
}

function contextOf(value) {
  return isRecord(value) && isRecord(value.scenarioContext) ? value.scenarioContext : value;
}

function validateContext(context, path = 'scenarioContext') {
  const explicit = isRecord(context) && isRecord(context.scenarioContext);
  const source = explicit ? context.scenarioContext : context;
  const strictContext = explicit ? source : (isRecord(source) ? {
    scenarioId: source.scenarioId,
    scenarioVersion: source.scenarioVersion,
    scenarioRunId: source.scenarioRunId,
    formedAt: source.formedAt,
    status: source.status
  } : source);
  const result = identity.validateScenarioContext(strictContext, {
    path,
    allowUnknown: false,
    enforcePrefix: true
  });
  return result.errors || [];
}

function validateM05SchemaCompatibility(sourceVersion, targetVersion) {
  const result = foundationContracts.classifySchemaCompatibility(sourceVersion, targetVersion);
  const recognized = (value) => Boolean(foundationContracts.parseSchemaVersion(value)) || (typeof value === 'string' && /^ofw\.[A-Za-z0-9.-]+\.v\d+$/.test(value));
  const valid = recognized(sourceVersion) && recognized(targetVersion) && result.status === foundationContracts.COMPATIBILITY_STATUS.EXACT;
  const reason = recognized(sourceVersion) && recognized(targetVersion) ? result.reason : 'unrecognized schema version';
  return { valid, errors: valid ? [] : [issue('schemaVersion', 'incompatible', `M05 requires an exact recognized schema version: ${reason}`, result)], compatibility: result };
}

function assertM05SchemaCompatibility(sourceVersion, targetVersion) {
  const result = validateM05SchemaCompatibility(sourceVersion, targetVersion);
  if (!result.valid) fail('M05_SCHEMA_INCOMPATIBLE', 'M05 rejects non-exact schema compatibility', result);
  return result.compatibility;
}

function validateM05Envelope(value, options = {}) {
  const path = options.path || 'envelope';
  const base = foundationContracts.validateContractEnvelope(value, {
    path,
    allowUnknown: false,
    enforcePrefix: true
  });
  const errors = [...base.errors];
  if (isRecord(value)) {
    const compatibility = validateM05SchemaCompatibility(M05_ENVELOPE_SCHEMA_VERSION, value.schemaVersion);
    errors.push(...compatibility.errors.map((error) => ({ ...error, path: `${path}.${error.path}` })));
    if (!isNonEmptyString(options.expectedEventType)) errors.push(issue(`${path}.eventType`, 'policy', 'M05 requires one expected eventType at the consumer boundary'));
    else if (value.eventType !== options.expectedEventType) errors.push(issue(`${path}.eventType`, 'mismatch', `must equal ${options.expectedEventType}`));
  }
  return validation(errors.length === 0, errors);
}

function assertM05Envelope(value, options = {}) {
  const result = validateM05Envelope(value, options);
  if (!result.valid) fail('M05_ENVELOPE_INVALID', 'Foundation Contract Envelope was rejected by M05', result.errors);
  return immutable(foundationContracts.normalizeContractEnvelope(value));
}

function refErrors(value, path, type, required = true) {
  const errors = [];
  const ref = getRef(value);
  if (!ref && required) errors.push(issue(path, 'required', 'must be a stable id/version reference'));
  if (ref && (!ref.version || !EXACT_VERSION_RE.test(ref.version))) errors.push(issue(`${path}.version`, 'exact', 'reference must pin an exact immutable version'));
  if (ref && isRecord(value) && value.status && !['published', 'active', 'enabled', 'valid'].includes(String(value.status).toLowerCase())) {
    errors.push(issue(`${path}.status`, 'lifecycle', `${type || 'resource'} reference is not consumable`));
  }
  return errors;
}

function validateReportContext(value, options = {}) {
  const errors = [];
  const path = options.path || 'reportContext';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'must be an object')]);
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'M06 report context may contain metadata references only', { fields: forbidden }));
  errors.push(...validateContext(value, `${path}.scenarioContext`));

  const reportId = pathValue(value, ['reportId', 'reportNumber', 'documentId', 'reportRef', 'draftId']);
  const contentVersion = pathValue(value, ['contentVersion', 'reportContentVersion', 'draftVersion', 'version']);
  if (!reportId) errors.push(issue(`${path}.reportId`, 'required', 'a report or draft identity is required'));
  if (!contentVersion) errors.push(issue(`${path}.contentVersion`, 'required', 'an immutable content version is required'));
  const evidenceRef = value.evidencePackage || value.evidencePack || value.generationEvidencePackage
    || (pathValue(value, ['evidencePackageId', 'evidenceId']) ? { id: pathValue(value, ['evidencePackageId', 'evidenceId']), version: pathValue(value, ['evidencePackageVersion', 'evidenceVersion']) } : null);
  const ontologyRef = value.publishedOntology || value.ontologyBinding || value.ontology
    || (pathValue(value, ['semanticVersion', 'publishedOntologyVersion', 'ontologyVersion']) ? { id: pathValue(value, ['semanticResourceId', 'ontologyId']) || 'published-ontology', version: pathValue(value, ['semanticVersion', 'publishedOntologyVersion', 'ontologyVersion']) } : null);
  errors.push(...refErrors(evidenceRef, `${path}.evidencePackage`, 'evidence package'));
  errors.push(...refErrors(ontologyRef, `${path}.publishedOntology`, 'Published ontology'));

  const effectiveAt = pathValue(value, ['effectiveAt', 'formedAt', 'asOf', 'dataAsOf']);
  if (!effectiveAt) errors.push(issue(`${path}.effectiveAt`, 'required', 'an effective/as-of time is required'));
  else if (!identity.isDateTime(effectiveAt)) errors.push(issue(`${path}.effectiveAt`, 'format', 'must be an RFC 3339 date-time'));

  const validity = value.validity || value.effectiveWindow || {};
  if (isRecord(validity)) {
    for (const key of ['validFrom', 'validTo', 'startsAt', 'endsAt']) {
      if (validity[key] !== undefined && !identity.isDateTime(validity[key])) errors.push(issue(`${path}.validity.${key}`, 'format', 'must be an RFC 3339 date-time'));
    }
    if (validity.validFrom && validity.validTo && Date.parse(validity.validFrom) > Date.parse(validity.validTo)) {
      errors.push(issue(`${path}.validity`, 'range', 'validFrom must not be after validTo'));
    }
  }

  const anchors = value.anchors || value.stableAnchors || value.anchorSnapshot;
  if (anchors !== undefined && !Array.isArray(anchors) && !isRecord(anchors)) errors.push(issue(`${path}.anchors`, 'type', 'must be a stable anchor collection'));
  const permission = value.permission || value.authorization || value.permissionDecision;
  if (permission !== undefined && !isRecord(permission)) errors.push(issue(`${path}.permission`, 'type', 'must be a permission decision object'));
  if (permission && permission.allowed === false && options.requireAllowed !== false) errors.push(issue(`${path}.permission`, 'denied', 'report context is not authorized for this run'));

  // Only metadata references are accepted. A fixed context may carry a data
  // version and cutoff time, but never data rows or an executable query.
  const dataVersion = pathValue(value, ['dataVersion', 'dataAssetVersion', 'authoritativeDataVersion', 't008Version']);
  if (!dataVersion) errors.push(issue(`${path}.dataVersion`, 'required', 'an exact data/authority version reference is required'));
  const dataAsOf = pathValue(value, ['dataAsOf', 'dataCutoffAt', 'dataEffectiveAt']);
  if (dataAsOf && !identity.isDateTime(dataAsOf)) errors.push(issue(`${path}.dataAsOf`, 'format', 'must be an RFC 3339 date-time'));

  return validation(errors.length === 0, errors);
}

function normalizeReportContext(value) {
  const result = clone(value);
  if (!isRecord(result)) return result;
  if (!result.scenarioContext) {
    result.scenarioContext = {
      scenarioId: result.scenarioId,
      scenarioVersion: result.scenarioVersion,
      scenarioRunId: result.scenarioRunId,
      formedAt: result.formedAt || result.effectiveAt,
      status: result.status || 'active'
    };
  }
  result.reportId = pathValue(result, ['reportId', 'reportNumber', 'documentId', 'reportRef', 'draftId']);
  result.contentVersion = pathValue(result, ['contentVersion', 'reportContentVersion', 'draftVersion', 'version']);
  const explicitEvidence = result.evidencePackage || result.evidencePack || result.generationEvidencePackage;
  result.evidencePackage = normalizeRef(explicitEvidence
    || (pathValue(result, ['evidencePackageId', 'evidenceId']) ? { id: pathValue(result, ['evidencePackageId', 'evidenceId']), version: pathValue(result, ['evidencePackageVersion', 'evidenceVersion']) } : null), 'evidence-package');
  const explicitOntology = result.publishedOntology || result.ontologyBinding || result.ontology;
  if (explicitOntology) result.publishedOntology = normalizeRef(explicitOntology, 'published-ontology');
  else delete result.publishedOntology;
  result.dataVersion = pathValue(result, ['dataVersion', 'dataAssetVersion', 'authoritativeDataVersion', 't008Version']);
  result.effectiveAt = pathValue(result, ['effectiveAt', 'formedAt', 'asOf', 'dataAsOf']);
  if (result.anchors === undefined && result.stableAnchors !== undefined) result.anchors = result.stableAnchors;
  return immutable(result);
}

function assertReportContext(value, options = {}) {
  return normalizeReportContext(assertValid(validateReportContext(value, options), 'ReportContext') && value);
}

function validateCredibilitySummary(value, options = {}) {
  const errors = [];
  const path = options.path || 'credibilitySummary';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'must be an object')]);
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'C017 summary may contain metadata only', { fields: forbidden }));
  const summaryId = pathValue(value, ['summaryId', 'id', 'credibilityId']);
  const summaryVersion = pathValue(value, ['summaryVersion', 'version']);
  if (!summaryId) errors.push(issue(`${path}.summaryId`, 'required', 'summary identity is required'));
  else if (!EXACT_VERSION_RE.test(summaryId)) errors.push(issue(`${path}.summaryId`, 'exact', 'summary identity must be exact'));
  if (!summaryVersion) errors.push(issue(`${path}.summaryVersion`, 'required', 'summary version is required'));
  else if (!EXACT_VERSION_RE.test(summaryVersion)) errors.push(issue(`${path}.summaryVersion`, 'exact', 'summary version must be exact'));
  const status = pathValue(value, ['status', 'qualityStatus', 'overallStatus', 'credibilityStatus']);
  if (!status) errors.push(issue(`${path}.status`, 'required', 'quality/credibility status is required'));
  else if (!ALLOWED_CREDIBILITY_STATES.includes(status.toLowerCase())) errors.push(issue(`${path}.status`, 'enum', 'unsupported credibility status'));
  const freshness = value.freshness || value.freshnessStatus || value.freshnessSummary;
  if (freshness !== undefined) {
    const freshnessValue = isRecord(freshness) ? pathValue(freshness, ['status', 'state', 'value']) : freshness;
    if (!isNonEmptyString(freshnessValue)) errors.push(issue(`${path}.freshness`, 'format', 'freshness must have a status'));
  }
  const scope = value.scope || value.impactScope || value.affectedScope;
  if (scope !== undefined && !isRecord(scope) && !Array.isArray(scope) && !isNonEmptyString(scope)) errors.push(issue(`${path}.scope`, 'type', 'scope must be structured metadata'));
  const formedAt = pathValue(value, ['formedAt', 'createdAt', 'checkedAt']);
  if (formedAt && !identity.isDateTime(formedAt)) errors.push(issue(`${path}.formedAt`, 'format', 'must be an RFC 3339 date-time'));
  if (value.digest !== undefined) {
    const copy = clone(value); delete copy.digest;
    if (!/^[a-f0-9]{64}$/i.test(String(value.digest)) || sha256(copy) !== value.digest) errors.push(issue(`${path}.digest`, 'integrity', 'C017 summary digest mismatch'));
  }
  if (value.scenarioContext) errors.push(...validateContext(value.scenarioContext, `${path}.scenarioContext`));
  return validation(errors.length === 0, errors);
}

function normalizeCredibilitySummary(value) {
  const result = clone(value);
  result.summaryId = pathValue(result, ['summaryId', 'id', 'credibilityId']);
  result.summaryVersion = pathValue(result, ['summaryVersion', 'version']);
  result.status = pathValue(result, ['status', 'qualityStatus', 'overallStatus', 'credibilityStatus']);
  if (result.freshness && !isRecord(result.freshness)) result.freshness = { status: result.freshness };
  return immutable(result);
}

function assertCredibilitySummary(value, options = {}) {
  const checked = assertValid(validateCredibilitySummary(value, options), 'C017 CredibilitySummary');
  try { return normalizeCredibilitySummary(checked && value); }
  catch (error) { fail('C017_INVALID', 'C017 summary must be a finite JSON structure', { cause: error.message }); }
}

function validateVerificationResult(value, options = {}) {
  const errors = [];
  const path = options.path || 'verificationResult';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'must be an object')]);
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'M06 verification result may contain metadata only', { fields: forbidden }));
  const runId = pathValue(value, ['verificationRunId', 'runId', 'verificationId']);
  const resultId = pathValue(value, ['resultId', 'id']);
  const version = pathValue(value, ['resultVersion', 'version']);
  if (!runId) errors.push(issue(`${path}.verificationRunId`, 'required', 'verification run identity is required'));
  else if (!EXACT_VERSION_RE.test(runId)) errors.push(issue(`${path}.verificationRunId`, 'exact', 'verification run identity must be exact'));
  if (!resultId) errors.push(issue(`${path}.resultId`, 'required', 'verification result identity is required'));
  if (!version) errors.push(issue(`${path}.resultVersion`, 'required', 'verification result version is required'));
  else if (!EXACT_VERSION_RE.test(version)) errors.push(issue(`${path}.resultVersion`, 'exact', 'verification result version must be exact'));
  const state = pathValue(value, ['status', 'overallStatus', 'state']);
  if (!state) errors.push(issue(`${path}.status`, 'required', 'verification status is required'));
  else if (!ALLOWED_VERIFICATION_STATES.includes(state.toLowerCase())) errors.push(issue(`${path}.status`, 'enum', 'unsupported deterministic verification status'));
  const checks = value.checks || value.items || value.results;
  if (!Array.isArray(checks)) errors.push(issue(`${path}.checks`, 'required', 'checks must be an array'));
  else checks.forEach((check, index) => {
    if (!isRecord(check)) errors.push(issue(`${path}.checks[${index}]`, 'type', 'check must be an object'));
    else {
      if (!pathValue(check, ['checkId', 'id', 'ruleId'])) errors.push(issue(`${path}.checks[${index}].checkId`, 'required', 'check identity is required'));
      const checkStatus = pathValue(check, ['status', 'state']);
      if (!checkStatus || !ALLOWED_VERIFICATION_STATES.includes(checkStatus.toLowerCase())) errors.push(issue(`${path}.checks[${index}].status`, 'enum', 'check status must be one of the deterministic states'));
    }
  });
  const reportId = pathValue(value, ['reportId', 'reportNumber', 'documentId']);
  const contentVersion = pathValue(value, ['contentVersion', 'reportContentVersion', 'versionRef']);
  if (reportId === null && options.requireReportIdentity !== false) errors.push(issue(`${path}.reportId`, 'required', 'report identity is required'));
  if (contentVersion === null && options.requireReportIdentity !== false) errors.push(issue(`${path}.contentVersion`, 'required', 'report content version is required'));
  if (value.scenarioContext) errors.push(...validateContext(value.scenarioContext, `${path}.scenarioContext`));
  if (value.digest !== undefined) {
    const copy = clone(value); delete copy.digest;
    if (!/^[a-f0-9]{64}$/i.test(String(value.digest)) || sha256(copy) !== value.digest) errors.push(issue(`${path}.digest`, 'integrity', 'M06 verification result digest mismatch'));
  }
  return validation(errors.length === 0, errors);
}

function normalizeVerificationResult(value) {
  const result = clone(value);
  result.verificationRunId = pathValue(result, ['verificationRunId', 'runId', 'verificationId']);
  result.resultId = pathValue(result, ['resultId', 'id']);
  result.resultVersion = pathValue(result, ['resultVersion', 'version']);
  result.status = pathValue(result, ['status', 'overallStatus', 'state']);
  result.checks = list(result.checks || result.items || result.results).map((check) => ({
    ...check,
    checkId: pathValue(check, ['checkId', 'id', 'ruleId']),
    status: pathValue(check, ['status', 'state'])
  }));
  return immutable(result);
}

function assertVerificationResult(value, options = {}) {
  const checked = assertValid(validateVerificationResult(value, options), 'M06 DeterministicVerificationResult');
  try { return normalizeVerificationResult(checked && value); }
  catch (error) { fail('M06_VERIFICATION_INVALID', 'M06 verification result must be a finite JSON structure', { cause: error.message }); }
}

const INPUT_FIELDS = new Set([
  'requestId', 'requestType', 'question', 'reportContext', 'fixedReportContext', 'contextBinding',
  'credibilitySummary', 'c017', 'verificationResult', 'deterministicVerificationResult', 'permissions', 'permission',
  'authorization', 'now', 'clock', 'metadata'
]);

function validateAgentInput(value, options = {}) {
  const errors = [];
  const path = options.path || 'agentInput';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'must be an object')]);
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'M05 Agent input may contain fixed metadata only', { fields: forbidden }));
  Object.keys(value).forEach((key) => { if (!INPUT_FIELDS.has(key)) errors.push(issue(`${path}.${key}`, 'unknown', 'M05 accepts only fixed M06/C017 inputs')); });
  const report = value.reportContext || value.fixedReportContext || value.contextBinding;
  const credibility = value.credibilitySummary || value.c017;
  const verification = value.verificationResult || value.deterministicVerificationResult;
  if (!report) errors.push(issue(`${path}.reportContext`, 'required', 'M06 fixed report context is required'));
  else errors.push(...validateReportContext(report, { path: `${path}.reportContext` }).errors);
  if (!credibility) errors.push(issue(`${path}.credibilitySummary`, 'required', 'C017 credibility summary is required'));
  else errors.push(...validateCredibilitySummary(credibility, { path: `${path}.credibilitySummary` }).errors);
  if (verification) errors.push(...validateVerificationResult(verification, { path: `${path}.verificationResult` }).errors);
  if (value.question !== undefined && !isNonEmptyString(value.question)) errors.push(issue(`${path}.question`, 'format', 'question must be a non-empty string'));
  if (value.prompt !== undefined && !isNonEmptyString(value.prompt)) errors.push(issue(`${path}.prompt`, 'format', 'prompt must be a non-empty string'));
  return validation(errors.length === 0, errors);
}

function normalizeAgentInput(value) {
  const result = clone(value);
  result.reportContext = normalizeReportContext(result.reportContext || result.fixedReportContext || result.contextBinding);
  result.credibilitySummary = normalizeCredibilitySummary(result.credibilitySummary || result.c017);
  if (result.verificationResult || result.deterministicVerificationResult) result.verificationResult = normalizeVerificationResult(result.verificationResult || result.deterministicVerificationResult);
  delete result.fixedReportContext;
  delete result.contextBinding;
  delete result.c017;
  delete result.deterministicVerificationResult;
  return immutable(result);
}

function assertAgentInput(value, options = {}) {
  const checked = assertValid(validateAgentInput(value, options), 'M05 AgentInput');
  try { return normalizeAgentInput(checked && value); }
  catch (error) { fail('M05_INPUT_INVALID', 'Agent input must be a finite JSON structure', { cause: error.message }); }
}

/**
 * C017 is a read-only fact source; M05 owns the purpose-specific gate. A
 * failed/unknown quality state never gets silently replaced by a prior or
 * candidate version. Freshness may be permitted for a narrow explanatory
 * use, but confirmation, report handoff and Action-related uses remain
 * blocked unless the caller explicitly supplies a contract allowing it.
 */
function evaluateCredibilityGate(summary, purpose = 'answer', options = {}) {
  const value = assertCredibilitySummary(summary);
  const quality = String(value.status || '').toLowerCase();
  const freshness = String(value.freshness?.status || value.freshnessStatus || 'unknown').toLowerCase();
  const hardFailure = ['failed', 'unknown', 'not-verifiable', 'not_verifiable'].includes(quality);
  const warning = quality === 'warning';
  const stale = ['stale', 'expired', 'unknown', 'not-verifiable', 'not_verifiable'].includes(freshness);
  const staleAllowed = options.allowStale === true && ['answer', 'explanation', 'verification-explanation', 'read-only'].includes(purpose);
  const blockedPurposes = new Set(['confirm', 'report-handoff', 'action', 'publish', 'new-insight']);
  const reasons = [];
  if (hardFailure) reasons.push('C017_QUALITY_HARD_FAILURE');
  if (stale && !staleAllowed) reasons.push('C017_FRESHNESS_BLOCKED');
  if (stale && blockedPurposes.has(purpose)) reasons.push('C017_FRESHNESS_BLOCKED_FOR_PURPOSE');
  const allowed = reasons.length === 0;
  return immutable({ allowed, purpose, quality, freshness, warning, stale, reasons, restrictions: [ ...(warning ? ['quality-warning'] : []), ...(stale ? ['stale-or-unknown-freshness'] : []) ], summaryId: value.summaryId, summaryVersion: value.summaryVersion });
}

function assertCredibilityGate(summary, purpose, options) {
  const result = evaluateCredibilityGate(summary, purpose, options);
  if (!result.allowed) fail('C017_USAGE_BLOCKED', 'C017 credibility gate blocked the requested M05 operation', result);
  return result;
}

function fixedInputFingerprint(input) {
  const value = assertAgentInput(input);
  return sha256({
    reportContext: value.reportContext,
    credibilitySummary: value.credibilitySummary,
    verificationResult: value.verificationResult || null
  });
}

function assertMatchingIdentity(reportContext, other, label) {
  const comparison = compareIdentity(reportContext, other);
  if (!comparison.same) throw new Error(`${label || 'input'} scenario identity mismatch`);
  return true;
}

function extractReportIdentity(context) {
  const value = context || {};
  const evidence = value.evidencePackage || value.evidencePack || value.generationEvidencePackage;
  const ontology = value.publishedOntology || value.ontologyBinding || value.ontology;
  return {
    reportId: pathValue(value, ['reportId', 'reportNumber', 'documentId', 'reportRef', 'draftId']),
    contentVersion: pathValue(value, ['contentVersion', 'reportContentVersion', 'draftVersion', 'version']),
    evidencePackage: normalizeRef(evidence || (pathValue(value, ['evidencePackageId', 'evidenceId']) ? { id: pathValue(value, ['evidencePackageId', 'evidenceId']), version: pathValue(value, ['evidencePackageVersion', 'evidenceVersion']) } : null), 'evidence-package'),
    publishedOntology: normalizeRef(ontology || (pathValue(value, ['semanticVersion', 'publishedOntologyVersion', 'ontologyVersion']) ? { id: pathValue(value, ['semanticResourceId', 'ontologyId']) || 'published-ontology', version: pathValue(value, ['semanticVersion', 'publishedOntologyVersion', 'ontologyVersion']) } : null), 'published-ontology'),
    dataVersion: pathValue(value, ['dataVersion', 'dataAssetVersion', 'authoritativeDataVersion', 't008Version']),
    dataAsOf: pathValue(value, ['dataAsOf', 'dataCutoffAt', 'dataEffectiveAt']),
    anchorSnapshotId: pathValue(value, ['anchorSnapshotId', 'stableAnchorSnapshotId', 'anchorId']),
    anchorSnapshotVersion: pathValue(value, ['anchorSnapshotVersion', 'stableAnchorVersion', 'anchorVersion']),
    selectedAnchor: value.selectedAnchor || value.selectedAnchorId || value.anchorId || null
  };
}

function compareFixedContext(reportContext, credibilitySummary, verificationResult) {
  const report = normalizeReportContext(reportContext);
  if (!isRecord(report)) return { same: false, mismatches: [{ source: 'reportContext', code: 'required', message: 'fixed report context is required' }] };
  const mismatches = [];
  for (const item of [credibilitySummary, verificationResult].filter(Boolean)) {
    const context = contextOf(item);
    const hasExplicitContext = isRecord(item?.scenarioContext)
      || ['scenarioId', 'scenarioVersion', 'scenarioRunId'].some((field) => item?.[field] !== undefined);
    if (hasExplicitContext && context && !compareIdentity(report, context).same) mismatches.push({ source: item === credibilitySummary ? 'credibilitySummary' : 'verificationResult', mismatch: compareIdentity(report, context).mismatches });
    const identity = extractReportIdentity(item);
    const expected = extractReportIdentity(report);
    for (const field of ['reportId', 'contentVersion', 'dataVersion', 'dataAsOf', 'anchorSnapshotId', 'anchorSnapshotVersion', 'selectedAnchor']) {
      // A C017 summary's `version` is its summaryVersion, and an M06 result's
      // `version` is its resultVersion. Only compare a report identity when the
      // producer explicitly supplied the corresponding report/data alias.
      if (field === 'contentVersion' && !['contentVersion', 'reportContentVersion', 'draftVersion'].some((key) => item?.[key] !== undefined)) continue;
      if (field === 'reportId' && !['reportId', 'reportNumber', 'documentId', 'draftId'].some((key) => item?.[key] !== undefined)) continue;
      if (field === 'dataVersion' && !['dataVersion', 'dataAssetVersion', 'authoritativeDataVersion', 't008Version'].some((key) => item?.[key] !== undefined)) continue;
      if (field === 'dataAsOf' && !['dataAsOf', 'dataCutoffAt', 'dataEffectiveAt'].some((key) => item?.[key] !== undefined)) continue;
      if (field === 'anchorSnapshotId' && !['anchorSnapshotId', 'stableAnchorSnapshotId', 'anchorId'].some((key) => item?.[key] !== undefined)) continue;
      if (field === 'anchorSnapshotVersion' && !['anchorSnapshotVersion', 'stableAnchorVersion', 'anchorVersion'].some((key) => item?.[key] !== undefined)) continue;
      if (field === 'selectedAnchor' && !['selectedAnchor', 'selectedAnchorId', 'anchorId'].some((key) => item?.[key] !== undefined)) continue;
      if (identity[field] !== null && identity[field] !== undefined && identity[field] !== expected[field]) mismatches.push({ source: item === credibilitySummary ? 'credibilitySummary' : 'verificationResult', field, expected: expected[field], actual: identity[field] });
    }
  }
  return { same: mismatches.length === 0, mismatches };
}

module.exports = Object.freeze({
  CONTRACT_VERSION, M05_ENVELOPE_SCHEMA_VERSION, ALLOWED_VERIFICATION_STATES, ALLOWED_CREDIBILITY_STATES,
  validateM05SchemaCompatibility, assertM05SchemaCompatibility, validateM05Envelope, assertM05Envelope,
  validateReportContext, normalizeReportContext, assertReportContext,
  validateCredibilitySummary, normalizeCredibilitySummary, assertCredibilitySummary,
  validateVerificationResult, normalizeVerificationResult, assertVerificationResult,
  validateAgentInput, normalizeAgentInput, assertAgentInput, fixedInputFingerprint, evaluateCredibilityGate, assertCredibilityGate,
  contextOf, extractReportIdentity, compareFixedContext, assertMatchingIdentity,
  pathValue, refErrors
});
