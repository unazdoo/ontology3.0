'use strict';

const {
  isRecord, isNonEmptyString, clone, immutable, sha256, issue, validation, assertValid,
  fail, uuid, nowIso, assertNoForbiddenPayload, findForbiddenKeys, compareIdentity
} = require('./util');
const contracts = require('./contracts');
const releaseBoundary = require('../agent-release');
const { AuditLog } = require('./audit');

const C024_SCHEMA_VERSION = 'ofw.c024.report-copilot-request.draft.v1';
const C025_SCHEMA_VERSION = 'ofw.c025.report-copilot-result.draft.v1';
const C020_SCHEMA_VERSION = 'ofw.c020.ai-insight.draft.v1';

const REQUEST_STATES = Object.freeze(['received', 'blocked', 'ready', 'historical']);
const SESSION_STATES = Object.freeze(['active', 'context-stale', 'comparison-stale', 'restricted', 'closed', 'historical']);
const RUN_STATES = Object.freeze(['created', 'input-invalid', 'waiting', 'running', 'output-validating', 'completed', 'restricted-completed', 'partially-completed', 'output-invalid', 'failed', 'cancelling', 'cancelled', 'historical']);
const RESULT_STATES = Object.freeze(['unconfirmed', 'confirmed-reference', 'rejected', 'historical']);
const C024_ALLOWED_FIELDS = new Set(['schemaVersion', 'requestId', 'id', 'copilotRequestId', 'idempotencyKey', 'requestKey', 'requestType', 'type', 'intent', 'question', 'reportContext', 'fixedReportContext', 'contextBinding', 'context', 'credibilitySummary', 'c017', 'verificationResult', 'deterministicVerificationResult', 'permission', 'authorization', 'actorRef', 'actor', 'correlationId', 'traceId', 'receivedAt', 'formedAt', 'sourceRef', 'm06RequestRef', 'metadata']);
const EXACT_VERSION_RE = /^(?!latest$)(?!current$)(?!head$)(?!tip$)(?!main$)(?!master$)\S+$/i;

function first(value, names) {
  for (const name of names) if (isNonEmptyString(value?.[name])) return value[name].trim();
  return null;
}

function refValue(value, aliases = []) {
  if (isNonEmptyString(value)) return { id: value.trim(), version: null };
  if (!isRecord(value)) return null;
  const id = ['id', 'refId', 'resourceId', 'key', ...aliases].map((key) => value[key]).find(isNonEmptyString);
  const version = ['version', 'refVersion', 'resourceVersion'].map((key) => value[key]).find(isNonEmptyString);
  return id ? { id: id.trim(), version: version ? version.trim() : null } : null;
}

function validateEvidenceRefs(value, path, errors) {
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    const ref = refValue(entry, ['evidenceId', 'evidenceRef']);
    if (!ref || !isNonEmptyString(ref.id) || ref.id === '*' || /^(latest|current|head|main|master)$/i.test(ref.id)) errors.push(issue(`${path}[${index}]`, 'exact', 'evidence reference must identify one explicit item'));
    const version = isRecord(entry) ? (entry.version || entry.refVersion || entry.evidenceVersion) : null;
    if (version !== undefined && (!isNonEmptyString(version) || /^(latest|current|head|main|master)$/i.test(String(version)))) errors.push(issue(`${path}[${index}].version`, 'exact', 'evidence reference version must be exact when supplied'));
  });
}

function canonicalRequest(value) {
  const source = clone(value);
  const context = source.reportContext || source.fixedReportContext || source.contextBinding || source.context;
  return {
    schemaVersion: C024_SCHEMA_VERSION,
    requestId: first(source, ['requestId', 'id', 'copilotRequestId']),
    idempotencyKey: first(source, ['idempotencyKey', 'requestKey']) || null,
    requestType: first(source, ['requestType', 'type', 'intent']) || 'question',
    question: source.question === undefined ? null : String(source.question),
    reportContext: context,
    credibilitySummary: source.credibilitySummary || source.c017 || null,
    verificationResult: source.verificationResult || source.deterministicVerificationResult || null,
    permission: source.permission || source.authorization || null,
    actorRef: source.actorRef || source.actor || null,
    correlationId: source.correlationId || null,
    traceId: source.traceId || null,
    receivedAt: source.receivedAt || source.formedAt || null,
    sourceRef: source.sourceRef || source.m06RequestRef || null,
    metadata: source.metadata || {}
  };
}

function validateC024Request(value, options = {}) {
  const errors = [];
  const path = options.path || 'c024';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'C024 request must be an object')]);
  if (value.schemaVersion !== undefined) {
    const compatibility = contracts.validateM05SchemaCompatibility(C024_SCHEMA_VERSION, value.schemaVersion);
    if (!compatibility.valid) errors.push(issue(`${path}.schemaVersion`, 'version', `must equal ${C024_SCHEMA_VERSION}`, compatibility));
  }
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'C024 request contains prohibited business detail or side-effect fields', { fields: forbidden }));
  let source;
  try { source = canonicalRequest(value); }
  catch (error) { return validation(false, [issue(path, 'json', 'C024 request must be a finite JSON structure')]); }
  Object.keys(value).forEach((key) => { if (!C024_ALLOWED_FIELDS.has(key)) errors.push(issue(`${path}.${key}`, 'unknown', 'C024 accepts only fixed report/C017/M06 verification inputs')); });
  if (!isNonEmptyString(source.requestId)) errors.push(issue(`${path}.requestId`, 'required', 'requestId is required'));
  else if (/\s/.test(source.requestId)) errors.push(issue(`${path}.requestId`, 'format', 'requestId must not contain whitespace'));
  if (source.idempotencyKey && (!isNonEmptyString(source.idempotencyKey) || source.idempotencyKey.length > 256 || /\s/.test(source.idempotencyKey))) errors.push(issue(`${path}.idempotencyKey`, 'format', 'idempotencyKey must be a bounded non-whitespace token'));
  if (!isNonEmptyString(source.requestType) || !['question', 'verification-explanation', 'answer', 'copilot', 'report-reading'].includes(source.requestType)) errors.push(issue(`${path}.requestType`, 'enum', 'unsupported C024 request type'));
  if (['question', 'answer', 'copilot', 'report-reading'].includes(source.requestType) && !isNonEmptyString(source.question)) errors.push(issue(`${path}.question`, 'required', 'question is required for a report assistant request'));
  if (!source.reportContext) errors.push(issue(`${path}.reportContext`, 'required', 'M06 fixed report context is required'));
  else {
    const result = releaseBoundary.validateFixedReportContext(source.reportContext, { requireVerification: source.requestType === 'verification-explanation', requireAllowed: options.allowBlocked !== true });
    if (!result.valid) errors.push(...result.errors.map((error) => ({ ...error, path: `${path}.reportContext.${error.path}` })));
  }
  if (!source.credibilitySummary) errors.push(issue(`${path}.credibilitySummary`, 'required', 'C017 summary is required'));
  else {
    const result = contracts.validateCredibilitySummary(source.credibilitySummary, { path: `${path}.credibilitySummary` });
    if (!result.valid) errors.push(...result.errors);
    const contextRef = refValue(source.reportContext && source.reportContext.credibilitySummaryRef);
    const summaryId = first(source.credibilitySummary, ['summaryId', 'id', 'credibilityId']);
    const summaryVersion = first(source.credibilitySummary, ['summaryVersion', 'version']);
    if (contextRef && (contextRef.id !== summaryId || contextRef.version !== summaryVersion)) {
      errors.push(issue(`${path}.credibilitySummary`, 'mismatch', 'C017 summary identity/version must match the fixed report context reference'));
    }
    if (source.credibilitySummary.owner && !/^M02(?:$|[/:_-])/i.test(String(source.credibilitySummary.owner))) errors.push(issue(`${path}.credibilitySummary.owner`, 'owner-mismatch', 'C017 summary must be supplied by M02/data engineering'));
  }
  if (source.verificationResult) {
    const result = contracts.validateVerificationResult(source.verificationResult, { path: `${path}.verificationResult`, requireReportIdentity: true });
    if (!result.valid) errors.push(...result.errors);
    const contextRef = refValue(source.reportContext && source.reportContext.verificationResultRef);
    if (contextRef) {
      const resultId = first(source.verificationResult, ['resultId', 'id']);
      const resultVersion = first(source.verificationResult, ['resultVersion', 'version']);
      if (contextRef.id !== resultId || contextRef.version !== resultVersion) errors.push(issue(`${path}.verificationResult`, 'mismatch', 'M06 verification result identity/version must match the fixed report context reference'));
    }
    if (source.verificationResult.owner && !/^M06(?:$|[/:_-])/i.test(String(source.verificationResult.owner))) errors.push(issue(`${path}.verificationResult.owner`, 'owner-mismatch', 'deterministic verification result must be supplied by M06'));
  } else if (source.requestType === 'verification-explanation') errors.push(issue(`${path}.verificationResult`, 'required', 'M06 deterministic verification result is required for an explanation request'));
  const fixedIdentity = contracts.compareFixedContext(source.reportContext, source.credibilitySummary, source.verificationResult);
  if (!fixedIdentity.same) errors.push(issue(`${path}`, 'mismatch', 'C024 inputs do not share the fixed report context identity', fixedIdentity.mismatches));
  if (!isRecord(source.permission)) errors.push(issue(`${path}.permission`, 'required', 'C024 permission decision is required'));
  else if (options.allowBlocked !== true && source.permission.allowed !== true) errors.push(issue(`${path}.permission`, 'denied', 'C024 permission decision must explicitly allow the fixed context'));
  if (source.sourceRef) {
    const sourceIdentity = refValue(source.sourceRef);
    if (!sourceIdentity || !sourceIdentity.version || /^(latest|current|head|main|master)$/i.test(sourceIdentity.version)) errors.push(issue(`${path}.sourceRef`, 'exact', 'M06 source reference must pin an exact version'));
    if (isRecord(source.sourceRef) && source.sourceRef.owner && !/^M06(?:$|[/:_-])/i.test(String(source.sourceRef.owner))) errors.push(issue(`${path}.sourceRef.owner`, 'owner-mismatch', 'C024 source must be supplied by M06'));
  }
  if (source.receivedAt && !requireDateTime(source.receivedAt)) errors.push(issue(`${path}.receivedAt`, 'format', 'receivedAt must be an RFC 3339 date-time'));
  return validation(errors.length === 0, errors);
}

function requireDateTime(value) { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /T\d{2}:\d{2}:\d{2}/.test(value); }

function normalizeC024Request(value, options = {}) {
  const source = canonicalRequest(value);
  source.reportContext = releaseBoundary.assertFixedReportContext(source.reportContext, { requireVerification: source.requestType === 'verification-explanation', requireAllowed: options.allowBlocked === true ? false : true });
  source.credibilitySummary = contracts.assertCredibilitySummary(source.credibilitySummary);
  if (source.verificationResult) source.verificationResult = contracts.assertVerificationResult(source.verificationResult, { requireReportIdentity: true });
  source.receivedAt = source.receivedAt || nowIso(options.clock);
  source.status = source.permission?.allowed === true ? 'received' : 'blocked';
  source.fingerprint = sha256({
    requestType: source.requestType,
    idempotencyKey: source.idempotencyKey,
    question: source.question,
    reportContext: source.reportContext,
    credibilitySummary: source.credibilitySummary,
    verificationResult: source.verificationResult || null,
    permission: source.permission
  });
  return immutable(source);
}

function assertC024Request(value, options = {}) {
  const result = validateC024Request(value, options);
  if (!result.valid) {
    const mismatch = result.errors.some((error) => ['mismatch', 'owner-mismatch', 'inactive', 'exact'].includes(error.code));
    fail(mismatch ? 'CONTEXT_MISMATCH' : 'C024_INVALID', 'C024 report copilot request was rejected', result.errors);
  }
  return normalizeC024Request(value, options);
}

function contextIdentity(value) {
  const context = value?.reportContext || value?.context || value;
  const report = context || {};
  return {
    scenarioId: report.scenarioId,
    scenarioVersion: report.scenarioVersion,
    scenarioRunId: report.scenarioRunId,
    reportId: first(report, ['reportId', 'reportNumber', 'documentId', 'draftId']),
    contentVersion: first(report, ['contentVersion', 'reportContentVersion', 'draftVersion', 'version']),
    evidencePackageId: first(report, ['evidencePackageId', 'evidenceId']) || refValue(report.evidencePackage)?.id,
    evidencePackageVersion: first(report, ['evidencePackageVersion']) || refValue(report.evidencePackage)?.version,
    semanticVersion: first(report, ['semanticVersion', 'publishedOntologyVersion']) || refValue(report.publishedOntology)?.version,
    dataAssetVersion: first(report, ['dataAssetVersion', 'dataVersion', 'authoritativeDataVersion']),
    dataAsOf: first(report, ['dataAsOf', 'effectiveAt', 'formedAt']),
    anchorSnapshotId: first(report, ['anchorSnapshotId', 'anchorId']),
    anchorSnapshotVersion: first(report, ['anchorSnapshotVersion', 'anchorVersion']),
    selectedAnchor: report.selectedAnchor || report.anchor || null
  };
}

function compareRequestIdentity(left, right) {
  const a = contextIdentity(left);
  const b = contextIdentity(right);
  const fields = Object.keys(a);
  const mismatches = fields.filter((field) => JSON.stringify(a[field]) !== JSON.stringify(b[field])).map((field) => ({ field, expected: a[field], actual: b[field] }));
  return { same: mismatches.length === 0, mismatches };
}

function validateContextBinding(value, options = {}) {
  const errors = [];
  const path = options.path || 'contextBinding';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'context binding must be an object')]);
  if (!isNonEmptyString(value.bindingId)) errors.push(issue(`${path}.bindingId`, 'required', 'bindingId is required'));
  if (!isNonEmptyString(value.bindingVersion)) errors.push(issue(`${path}.bindingVersion`, 'required', 'bindingVersion is required'));
  if (!value.requestId) errors.push(issue(`${path}.requestId`, 'required', 'requestId is required'));
  if (!value.reportContext) errors.push(issue(`${path}.reportContext`, 'required', 'fixed report context is required'));
  if (value.reportContext && value.fingerprint && value.fingerprint !== sha256(value.reportContext)) errors.push(issue(`${path}.fingerprint`, 'integrity', 'binding context fingerprint mismatch'));
  return validation(errors.length === 0, errors);
}

function createContextBinding(request, options = {}) {
  const c024 = request.schemaVersion === C024_SCHEMA_VERSION ? request : assertC024Request(request, options);
  return immutable({
    schemaVersion: 'ofw.m05.context-binding.draft.v1',
    bindingId: options.bindingId || uuid('binding'),
    bindingVersion: options.bindingVersion || 'v1',
    requestId: c024.requestId,
    reportContext: c024.reportContext,
    credibilitySummary: c024.credibilitySummary,
    verificationResult: c024.verificationResult || null,
    permission: c024.permission,
    fingerprint: sha256(c024.reportContext),
    createdAt: options.createdAt || nowIso(options.clock),
    immutable: true
  });
}

function createSession(binding, options = {}) {
  if (!binding || !binding.bindingId) fail('BINDING_REQUIRED', 'Context Binding is required to create a session');
  return immutable({
    schemaVersion: 'ofw.m05.report-reading-session.draft.v1',
    sessionId: options.sessionId || uuid('session'),
    requestId: binding.requestId,
    bindingId: binding.bindingId,
    bindingVersion: binding.bindingVersion,
    reportContext: binding.reportContext,
    state: 'active',
    createdAt: options.createdAt || nowIso(options.clock),
    lastActivityAt: options.createdAt || nowIso(options.clock),
    history: []
  });
}

function createAgentRun(session, release, options = {}) {
  if (!session || !session.sessionId) fail('SESSION_REQUIRED', 'Report Reading Session is required to create a run');
  if (!release || !release.releaseId) fail('RELEASE_REQUIRED', 'exact Agent Release is required to create a run');
  const run = {
    schemaVersion: 'ofw.m05.agent-run.draft.v1',
    runId: options.runId || uuid('agent-run'),
    attempt: Number(options.attempt || 1),
    sessionId: session.sessionId,
    bindingId: session.bindingId,
    bindingVersion: session.bindingVersion,
    requestId: session.requestId,
    releaseRef: { id: release.releaseId, version: release.releaseVersion || release.version, digest: release.digest || release.fingerprint },
    reportContext: session.reportContext,
    anchorSnapshot: options.anchorSnapshot || options.selectedAnchor || session.reportContext.selectedAnchor || null,
    inputFingerprint: options.inputFingerprint || sha256({ reportContext: session.reportContext, anchorSnapshot: options.anchorSnapshot || options.selectedAnchor || session.reportContext.selectedAnchor || null, bindingId: session.bindingId, release: release.fingerprint || release.digest }),
    state: 'created',
    createdAt: options.createdAt || nowIso(options.clock),
    retryOf: options.retryOf || null,
    attempts: []
  };
  return immutable(run);
}

function validateC025Result(value, options = {}) {
  const errors = [];
  const path = options.path || 'c025';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'C025 result must be an object')]);
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'C025 result contains prohibited business detail or side-effect fields', { fields: forbidden }));
  if (value.schemaVersion && value.schemaVersion !== C025_SCHEMA_VERSION) errors.push(issue(`${path}.schemaVersion`, 'version', `must equal ${C025_SCHEMA_VERSION}`));
  if (value.generatedAt && !requireDateTime(value.generatedAt)) errors.push(issue(`${path}.generatedAt`, 'format', 'generatedAt must be an RFC 3339 date-time'));
  for (const [field, label] of [['resultId', 'result identity'], ['runId', 'Agent run identity'], ['resultVersion', 'result version']]) if (!isNonEmptyString(value[field])) errors.push(issue(`${path}.${field}`, 'required', `${label} is required`));
  if (value.resultVersion && !EXACT_VERSION_RE.test(value.resultVersion)) errors.push(issue(`${path}.resultVersion`, 'exact', 'resultVersion must be exact'));
  if (value.runId && !EXACT_VERSION_RE.test(value.runId)) errors.push(issue(`${path}.runId`, 'exact', 'runId must be an exact identity'));
  if (value.state !== undefined && !RESULT_STATES.includes(value.state)) errors.push(issue(`${path}.state`, 'enum', 'unsupported result state'));
  if (value.state && value.state !== 'unconfirmed' && options.allowStateTransition !== true) errors.push(issue(`${path}.state`, 'permission', 'new C025 results must start unconfirmed'));
  if (!['answer', 'verification-explanation'].includes(value.resultType)) errors.push(issue(`${path}.resultType`, 'enum', 'resultType must be answer or verification-explanation'));
  if (!value.reportContext) errors.push(issue(`${path}.reportContext`, 'required', 'fixed report context is required'));
  if (!value.evidenceRefs || !Array.isArray(value.evidenceRefs)) errors.push(issue(`${path}.evidenceRefs`, 'required', 'evidenceRefs must be an array'));
  else if (value.evidenceRefs.length === 0 && value.resultType === 'answer' && options.allowEvidenceEmpty !== true && value.restricted !== true) errors.push(issue(`${path}.evidenceRefs`, 'required', 'an answer must cite at least one fixed evidence item'));
  else {
    validateEvidenceRefs(value.evidenceRefs, `${path}.evidenceRefs`, errors);
    const packageId = first(value.reportContext, ['evidencePackageId', 'evidenceId']);
    if (packageId) value.evidenceRefs.forEach((entry, index) => {
      if (isRecord(entry) && entry.packageId && entry.packageId !== packageId) errors.push(issue(`${path}.evidenceRefs[${index}].packageId`, 'mismatch', 'evidence must belong to the fixed evidence package'));
    });
  }
  if (value.resultType === 'answer' && !isNonEmptyString(value.answer)) errors.push(issue(`${path}.answer`, 'required', 'answer text is required'));
  if (value.resultType === 'verification-explanation') {
    if (!value.verificationResultRef) errors.push(issue(`${path}.verificationResultRef`, 'required', 'deterministic verification result reference is required'));
    else if (value.verificationResultRef.owner && !/^M06(?:$|[/:_-])/i.test(String(value.verificationResultRef.owner))) errors.push(issue(`${path}.verificationResultRef.owner`, 'owner-mismatch', 'deterministic verification result must remain an M06 reference'));
    if (!Array.isArray(value.checks)) errors.push(issue(`${path}.checks`, 'required', 'original deterministic checks must be preserved'));
    if (!isNonEmptyString(value.explanation || value.answer)) errors.push(issue(`${path}.explanation`, 'required', 'verification explanation text is required'));
    if (Array.isArray(value.checks)) value.checks.forEach((check, index) => {
      const original = check.originalStatus || check.status;
      if (!contracts.ALLOWED_VERIFICATION_STATES.includes(String(original || '').toLowerCase())) errors.push(issue(`${path}.checks[${index}].originalStatus`, 'enum', 'original deterministic state is invalid'));
      if (check.status && check.status !== original && options.allowReclassification !== true) errors.push(issue(`${path}.checks[${index}].status`, 'immutable', 'Agent may not reclassify deterministic states'));
    });
    const contextRef = refValue(value.reportContext?.verificationResultRef);
    const resultRef = refValue(value.verificationResultRef);
    if (contextRef && resultRef && (contextRef.id !== resultRef.id || (contextRef.version && resultRef.version && contextRef.version !== resultRef.version))) errors.push(issue(`${path}.verificationResultRef`, 'mismatch', 'verification result must match the fixed M06 context reference'));
  }
  if (value.reportContext && value.requestContext && !compareRequestIdentity(value.reportContext, value.requestContext).same) errors.push(issue(`${path}.reportContext`, 'mismatch', 'result context differs from request context'));
  if (value.credibilitySummaryRef && value.reportContext?.credibilitySummaryRef) {
    const expected = refValue(value.reportContext.credibilitySummaryRef);
    const actual = refValue(value.credibilitySummaryRef);
    if (expected && actual && (expected.id !== actual.id || (expected.version && actual.version && expected.version !== actual.version))) errors.push(issue(`${path}.credibilitySummaryRef`, 'mismatch', 'result credibility reference must match fixed C017 context'));
  }
  return validation(errors.length === 0, errors);
}

function normalizeC025Result(value, options = {}) {
  const source = clone(value);
  source.schemaVersion = C025_SCHEMA_VERSION;
  source.resultVersion = source.resultVersion || 'v1';
  source.state = source.state || 'unconfirmed';
  source.generatedAt = source.generatedAt || nowIso(options.clock);
  source.evidenceRefs = Array.isArray(source.evidenceRefs) ? source.evidenceRefs : [];
  source.immutable = true;
  const fingerprintInput = { ...source };
  delete fingerprintInput.fingerprint;
  source.fingerprint = sha256(fingerprintInput);
  return immutable(source);
}

function assertC025Result(value, options = {}) {
  const result = validateC025Result(value, options);
  if (!result.valid) {
    const mismatch = result.errors.some((error) => ['mismatch', 'owner-mismatch', 'immutable'].includes(error.code));
    fail(mismatch ? 'C025_CONTEXT_MISMATCH' : 'C025_INVALID', 'C025 report copilot result was rejected', result.errors);
  }
  return normalizeC025Result(value, options);
}

function createAnswerResult(run, input, output, options = {}) {
  const answer = typeof output === 'string' ? output : output?.answer;
  if (!isNonEmptyString(answer)) fail('OUTPUT_CONTRACT_INVALID', 'answer output must contain non-empty answer text');
  const result = {
    resultType: 'answer', resultId: options.resultId || uuid('answer'), resultVersion: options.resultVersion || 'v1', runId: run.runId,
    requestId: run.requestId, sessionId: run.sessionId, bindingId: run.bindingId, bindingVersion: run.bindingVersion, agentReleaseRef: run.releaseRef,
    reportContext: run.reportContext, requestContext: run.reportContext, answer: String(answer), scope: output?.scope || options.scope || 'selected-anchor',
    anchors: output?.anchors || options.anchors || (run.anchorSnapshot ? [run.anchorSnapshot] : (run.reportContext.selectedAnchor ? [run.reportContext.selectedAnchor] : [])),
    evidenceRefs: output?.evidenceRefs || [], semanticRefs: output?.semanticRefs || [], credibilitySummaryRef: output?.credibilitySummaryRef || run.reportContext.credibilitySummaryRef || null,
    limitations: output?.limitations || [], sourceRef: input?.sourceRef || null, dataAssetVersion: run.reportContext.dataAssetVersion || run.reportContext.dataVersion || null, dataAsOf: run.reportContext.dataAsOf || null, freshnessState: input?.credibilitySummary?.freshness?.status || input?.credibilitySummary?.freshnessStatus || null, restricted: output?.restricted === true, confirmationState: 'unconfirmed', state: 'unconfirmed'
  };
  try { return assertC025Result(result, { ...options, allowEvidenceEmpty: result.restricted === true }); }
  catch (error) { fail('OUTPUT_CONTRACT_INVALID', error.message, error.details); }
}

function createVerificationExplanationResult(run, input, output, options = {}) {
  const verification = input?.verificationResult || input?.deterministicVerificationResult || run.verificationResult;
  const originalChecks = verification?.checks || verification?.items || [];
  if (!verification) fail('VERIFICATION_RESULT_REQUIRED', 'verification explanation requires the M06 deterministic result');
  const checks = originalChecks.map((check) => ({ ...clone(check), originalStatus: check.originalStatus || check.status || check.state, status: check.originalStatus || check.status || check.state, explanation: output?.explanations?.[check.checkId || check.id] || null }));
  const result = {
    resultType: 'verification-explanation', resultId: options.resultId || uuid('verification-explanation'), resultVersion: options.resultVersion || 'v1', runId: run.runId,
    requestId: run.requestId, sessionId: run.sessionId, bindingId: run.bindingId, bindingVersion: run.bindingVersion, agentReleaseRef: run.releaseRef,
    reportContext: run.reportContext, requestContext: run.reportContext, anchors: output?.anchors || (run.anchorSnapshot ? [run.anchorSnapshot] : []), verificationResultRef: { id: verification.resultId || verification.id, version: verification.resultVersion || verification.version },
    verificationStatus: verification.status || verification.overallStatus, checks, summary: output?.summary || null, explanation: output?.explanation || output?.answer || '',
    recommendations: output?.recommendations || [], evidenceRefs: output?.evidenceRefs || [], limitations: output?.limitations || [], sourceRef: input?.sourceRef || null, dataAssetVersion: run.reportContext.dataAssetVersion || run.reportContext.dataVersion || null, dataAsOf: run.reportContext.dataAsOf || null, freshnessState: input?.credibilitySummary?.freshness?.status || input?.credibilitySummary?.freshnessStatus || null, confirmationState: 'unconfirmed', state: 'unconfirmed'
  };
  try { return assertC025Result(result, options); }
  catch (error) { fail('OUTPUT_CONTRACT_INVALID', error.message, error.details); }
}

function markResultState(result, state, options = {}) {
  if (!RESULT_STATES.includes(state)) fail('RESULT_STATE_INVALID', 'unsupported C025 result state');
  if (result.state === 'historical') fail('RESULT_IMMUTABLE', 'historical result cannot be changed');
  if (state === 'confirmed-reference' && options.permission !== true) fail('PERMISSION_DENIED', 'confirming a result requires explicit permission');
  if (state === 'confirmed-reference' && ['stale', 'unknown'].includes(String(result.freshnessState || '').toLowerCase()) && options.allowStale !== true) fail('C017_USAGE_BLOCKED', 'stale or unknown C017 freshness blocks result confirmation');
  const next = { ...result, sourceFingerprint: result.fingerprint || null, state, confirmationState: state, confirmation: { actorRef: options.actorRef || null, formedAt: options.formedAt || nowIso(options.clock), note: options.note || null } };
  delete next.fingerprint; next.fingerprint = sha256(next); return immutable(next);
}

function markContextStale(session, reason, options = {}) {
  if (session.state === 'closed' || session.state === 'historical') return immutable(session);
  return immutable({ ...session, state: options.comparisonOnly ? 'comparison-stale' : 'context-stale', staleReason: reason, staleAt: options.at || nowIso(options.clock) });
}

class ReportCopilotStore {
  constructor(options = {}) {
    this.clock = options.clock;
    this.audit = options.audit || new AuditLog({ clock: this.clock });
    this.requests = new Map();
    this.bindings = new Map();
    this.sessions = new Map();
    this.runs = new Map();
    this.results = new Map();
    this.history = [];
    this.currentScenarioRunId = options.currentScenarioRunId || null;
  }

  receiveC024(value, options = {}) {
    let request;
    // Receiving a structurally valid but unauthorized request is safe and
    // auditable; it remains blocked and cannot create Binding/Session/Run.
    try { request = assertC024Request(value, { clock: this.clock, allowBlocked: options.allowBlocked !== false }); }
    catch (error) { this.audit.append({ operation: 'c024.receive', outcome: 'rejected', actorRef: value?.actorRef || value?.actor, traceId: value?.traceId, correlationId: value?.correlationId, reasonCode: error.code, details: { requestId: value?.requestId } }); throw error; }
    const existing = this.requests.get(request.requestId);
    if (existing) {
      if (existing.fingerprint !== request.fingerprint) {
        this.audit.append({ operation: 'c024.receive', outcome: 'rejected', actorRef: request.actorRef, traceId: request.traceId, correlationId: request.correlationId, reasonCode: 'C024_IDENTITY_CONFLICT', scenarioContext: existing.reportContext, details: { requestId: request.requestId } });
        fail('C024_IDENTITY_CONFLICT', 'same C024 requestId was reused with a different fixed context');
      }
      return existing;
    }
    const historicalById = [...this.history].reverse().find((entry) => entry.type === 'request' && entry.value.requestId === request.requestId)?.value;
    if (historicalById) {
      if (historicalById.fingerprint !== request.fingerprint) fail('C024_IDENTITY_CONFLICT', 'historical C024 requestId cannot be reused with a different fixed context');
      return historicalById;
    }
    if (request.idempotencyKey) {
      const prior = [...this.requests.values(), ...this.history.filter((entry) => entry.type === 'request').map((entry) => entry.value)].find((candidate) => candidate.idempotencyKey === request.idempotencyKey);
      if (prior) {
        if (prior.fingerprint !== request.fingerprint) fail('C024_IDEMPOTENCY_CONFLICT', 'same idempotencyKey was reused with a different fixed request');
        return prior;
      }
    }
    // A new report/content/scenario identity never silently reuses the old
    // projection. Historical records stay queryable but cannot receive new
    // questions or results.
    for (const [oldId, oldRequest] of this.requests) {
      if (oldRequest.reportContext.scenarioId === request.reportContext.scenarioId
          && !compareRequestIdentity(oldRequest.reportContext, request.reportContext).same) {
        const historicalRequest = immutable({ ...oldRequest, status: 'historical', historicalAt: nowIso(this.clock), supersededBy: request.requestId });
        this.history.push(immutable({ type: 'request', value: historicalRequest }));
        this.requests.delete(oldId);
        const oldBinding = this.bindings.get(oldId);
        if (oldBinding) {
          this.history.push(immutable({ type: 'binding', value: oldBinding }));
          this.bindings.delete(oldId);
          for (const [sessionId, session] of this.sessions) if (session.bindingId === oldBinding.bindingId) {
            const historicalSession = markContextStale(session, 'new-c024-context', { clock: this.clock });
            this.history.push(immutable({ type: 'session', value: historicalSession }));
            this.sessions.delete(sessionId);
            for (const [runId, run] of this.runs) if (run.sessionId === sessionId) {
              const historicalRun = immutable({ ...run, state: 'historical', historicalAt: nowIso(this.clock), supersededBy: request.requestId });
              this.history.push(immutable({ type: 'run', value: historicalRun }));
              this.runs.delete(runId);
              for (const [resultId, result] of this.results) if (result.runId === runId) {
                this.history.push(immutable({ type: 'result', value: immutable({ ...result, state: 'historical' }) }));
                this.results.delete(resultId);
              }
            }
          }
        }
      }
    }
    this.requests.set(request.requestId, request);
    this.currentScenarioRunId = request.reportContext.scenarioRunId;
    this.audit.append({ operation: 'c024.receive', outcome: 'accepted', reasonCode: 'C024_RECEIVED', actorRef: request.actorRef, traceId: request.traceId, correlationId: request.correlationId, scenarioContext: request.reportContext, details: { requestId: request.requestId, fingerprint: request.fingerprint } });
    return request;
  }

  getRequest(requestId) {
    if (this.requests.has(requestId)) return this.requests.get(requestId);
    const historical = [...this.history].reverse().find((entry) => entry.type === 'request' && entry.value.requestId === requestId);
    return historical ? historical.value : null;
  }
  getBinding(requestId) { return this.bindings.get(requestId) || [...this.history].reverse().find((entry) => entry.type === 'binding' && entry.value.requestId === requestId)?.value || null; }
  getSession(sessionId) { return this.sessions.get(sessionId) || [...this.history].reverse().find((entry) => entry.type === 'session' && entry.value.sessionId === sessionId)?.value || null; }
  getRun(runId) { return this.runs.get(runId) || [...this.history].reverse().find((entry) => entry.type === 'run' && entry.value.runId === runId)?.value || null; }
  getResult(resultId) { return this.results.get(resultId) || [...this.history].reverse().find((entry) => entry.type === 'result' && entry.value.resultId === resultId)?.value || null; }

  start(requestId, release, options = {}) {
    const request = this.requests.get(requestId);
    if (!request) fail('C024_NOT_FOUND', 'C024 request has not been received');
    if (request.status !== 'received') fail('C024_BLOCKED', 'C024 request is blocked');
    const purpose = request.requestType === 'verification-explanation' ? 'explanation' : 'answer';
    const gate = contracts.evaluateCredibilityGate(request.credibilitySummary, purpose, { allowStale: options.allowStale === true });
    if (!gate.allowed) {
      this.audit.append({ operation: 'c024.start', outcome: 'rejected', actorRef: request.actorRef, traceId: request.traceId, correlationId: request.correlationId, reasonCode: 'C017_USAGE_BLOCKED', scenarioContext: request.reportContext, details: { requestId, gate } });
      fail('C017_USAGE_BLOCKED', 'C017 credibility gate blocked the report assistant run', gate);
    }
    try { releaseBoundary.assertReleaseContext(release, request.reportContext, { at: options.at || new Date().toISOString() }); }
    catch (error) { this.audit.append({ operation: 'c024.start', outcome: 'rejected', actorRef: request.actorRef, traceId: request.traceId, correlationId: request.correlationId, reasonCode: error.code, scenarioContext: request.reportContext, details: { requestId } }); throw error; }
    if (this.bindings.has(requestId)) return this.bindings.get(requestId);
    const binding = createContextBinding(request, { clock: this.clock });
    this.bindings.set(requestId, binding);
    const session = createSession(binding, { clock: this.clock });
    this.sessions.set(session.sessionId, session);
    this.audit.append({ operation: 'c024.start', outcome: 'accepted', actorRef: request.actorRef, traceId: request.traceId, correlationId: request.correlationId, reasonCode: 'C025_CHAIN_STARTED', scenarioContext: request.reportContext, details: { requestId, bindingId: binding.bindingId, sessionId: session.sessionId } });
    return { request, binding, session };
  }

  createRun(sessionId, release, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) fail('SESSION_NOT_FOUND', 'session not found');
    if (session.state !== 'active' && session.state !== 'comparison-stale') fail('SESSION_NOT_ACTIVE', 'session is not active');
    releaseBoundary.assertReleaseContext(release, session.reportContext, { at: options.at || new Date().toISOString() });
    const run = createAgentRun(session, release, { clock: this.clock, ...options });
    this.runs.set(run.runId, run);
    this.sessions.set(sessionId, immutable({ ...session, lastActivityAt: nowIso(this.clock), history: [...(session.history || []), { runId: run.runId, anchorSnapshot: run.anchorSnapshot, inputFingerprint: run.inputFingerprint, createdAt: run.createdAt }] }));
    this.audit.append({ operation: 'agent.run.create', outcome: 'accepted', reasonCode: 'RUN_CREATED', scenarioContext: run.reportContext, details: { runId: run.runId, sessionId, attempt: run.attempt } });
    return run;
  }

  completeRun(runId, result, options = {}) {
    const run = this.runs.get(runId);
    if (!run) fail('RUN_NOT_FOUND', 'Agent run not found');
    if (run.state === 'historical' || run.state === 'cancelled') fail('RUN_IMMUTABLE', 'run cannot be completed');
    if (run.state === 'failed' || ['completed', 'restricted-completed', 'partially-completed'].includes(run.state)) fail('RUN_STATE_INVALID', 'a failed or terminal run requires a new retry attempt');
    const normalized = assertC025Result(result, options);
    if (normalized.runId !== run.runId || !compareRequestIdentity(normalized.reportContext, run.reportContext).same) fail('C025_CONTEXT_MISMATCH', 'result does not match the fixed run snapshot');
    if (run.anchorSnapshot && Array.isArray(normalized.anchors) && normalized.anchors.length && !normalized.anchors.includes(run.anchorSnapshot)) fail('C025_CONTEXT_MISMATCH', 'result anchor does not match the fixed run snapshot');
    const runState = normalized.restricted === true ? 'restricted-completed' : (normalized.partial === true ? 'partially-completed' : 'completed');
    const completedRun = immutable({ ...run, state: runState, completedAt: options.completedAt || nowIso(this.clock), resultId: normalized.resultId });
    this.runs.set(runId, completedRun);
    this.results.set(normalized.resultId, normalized);
    this.audit.append({ operation: 'c025.complete', outcome: 'accepted', reasonCode: 'C025_RESULT_CREATED', scenarioContext: run.reportContext, details: { runId, resultId: normalized.resultId } });
    return normalized;
  }

  failRun(runId, error, options = {}) {
    const run = this.runs.get(runId);
    if (!run) fail('RUN_NOT_FOUND', 'Agent run not found');
    if (['completed', 'restricted-completed', 'partially-completed', 'cancelled', 'historical'].includes(run.state)) fail('RUN_STATE_INVALID', 'terminal run cannot be changed to failed');
    const failed = immutable({ ...run, state: 'failed', failedAt: options.at || nowIso(this.clock), error: { code: error?.code || 'RUN_FAILED', message: error?.message || String(error) } });
    this.runs.set(runId, failed);
    this.audit.append({ operation: 'agent.run', outcome: 'rejected', reasonCode: failed.error.code, scenarioContext: run.reportContext, details: { runId } });
    return failed;
  }

  cancelRun(runId, options = {}) {
    const run = this.runs.get(runId);
    if (!run) fail('RUN_NOT_FOUND', 'Agent run not found');
    if (['completed', 'failed', 'cancelled', 'historical'].includes(run.state)) return run;
    const cancelled = immutable({ ...run, state: 'cancelled', cancelledAt: options.at || nowIso(this.clock), cancellationReason: options.reason || 'user-requested' });
    this.runs.set(runId, cancelled);
    this.audit.append({ operation: 'agent.run.cancel', outcome: 'accepted', reasonCode: 'RUN_CANCELLED', scenarioContext: run.reportContext, details: { runId } });
    return cancelled;
  }

  closeSession(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) fail('SESSION_NOT_FOUND', 'session not found');
    const closed = immutable({ ...session, state: 'closed', closedAt: options.at || nowIso(this.clock), closeReason: options.reason || 'user-requested' });
    this.sessions.set(sessionId, closed);
    return closed;
  }

  retryRun(runId, release, options = {}) {
    const previous = this.runs.get(runId);
    if (!previous) fail('RUN_NOT_FOUND', 'Agent run not found');
    if (!['failed', 'partially-completed', 'restricted-completed'].includes(previous.state)) fail('RETRY_NOT_ALLOWED', 'only failed or restricted runs can be retried');
    if (options.inputFingerprint && options.inputFingerprint !== previous.inputFingerprint) fail('RETRY_SNAPSHOT_CHANGED', 'retry input snapshot changed');
    const nextReleaseFingerprint = release?.digest || release?.fingerprint || releaseBoundary.digestRelease(release);
    const previousReleaseFingerprint = previous.releaseRef?.digest;
    if (previousReleaseFingerprint && nextReleaseFingerprint !== previousReleaseFingerprint) fail('RETRY_RELEASE_CHANGED', 'changed Agent Release requires a new run, not a retry');
    releaseBoundary.assertReleaseContext(release, this.sessions.get(previous.sessionId).reportContext, { at: options.at || new Date().toISOString() });
    const next = createAgentRun(this.sessions.get(previous.sessionId), release, { clock: this.clock, retryOf: previous.runId, attempt: previous.attempt + 1, inputFingerprint: previous.inputFingerprint, anchorSnapshot: previous.anchorSnapshot });
    this.runs.set(next.runId, next);
    return next;
  }

  markHistoricalForContext(previousRunId, nextContext) {
    const previous = this.runs.get(previousRunId);
    if (!previous) return null;
    if (compareRequestIdentity(previous.reportContext, nextContext).same) return previous;
    const historical = immutable({ ...previous, state: 'historical', historicalAt: nowIso(this.clock), supersededByContext: contextIdentity(nextContext) });
    this.runs.set(previousRunId, historical);
    const session = this.sessions.get(previous.sessionId);
    if (session) this.sessions.set(session.sessionId, markContextStale(session, 'report-context-changed', { clock: this.clock }));
    return historical;
  }

  resetProjection(options = {}) {
    const targetRunId = options.scenarioRunId || this.currentScenarioRunId;
    const removed = { requests: 0, bindings: 0, sessions: 0, runs: 0, results: 0 };
    if (!targetRunId) return immutable({ targetRunId: null, removed, historyCount: this.history.length, noCurrentProjection: true });
    for (const [id, request] of this.requests) if (!targetRunId || request.reportContext.scenarioRunId === targetRunId) { this.history.push(immutable({ type: 'request', value: request })); this.requests.delete(id); removed.requests += 1; }
    for (const [id, binding] of this.bindings) if (!this.requests.has(binding.requestId)) { this.history.push(immutable({ type: 'binding', value: binding })); this.bindings.delete(id); removed.bindings += 1; }
    for (const [id, session] of this.sessions) if (!this.requests.has(session.requestId)) { this.history.push(immutable({ type: 'session', value: session })); this.sessions.delete(id); removed.sessions += 1; }
    for (const [id, run] of this.runs) if (!this.sessions.has(run.sessionId)) { this.history.push(immutable({ type: 'run', value: run })); this.runs.delete(id); removed.runs += 1; }
    for (const [id, result] of this.results) if (!this.runs.has(result.runId)) { this.history.push(immutable({ type: 'result', value: result })); this.results.delete(id); removed.results += 1; }
    this.currentScenarioRunId = null;
    this.audit.append({ operation: 'c034.reset-projection', outcome: 'accepted', reasonCode: 'PROJECTION_RESET', details: { targetRunId, removed } });
    return immutable({ targetRunId, removed, historyCount: this.history.length });
  }

  current() {
    return immutable({ requests: [...this.requests.values()], bindings: [...this.bindings.values()], sessions: [...this.sessions.values()], runs: [...this.runs.values()], results: [...this.results.values()] });
  }

  historical() { return immutable(this.history); }
}

function createReportCopilotStore(options) { return new ReportCopilotStore(options); }

// C020: AI Insight is intentionally separate from C025. It can only describe
// fixed evidence; no metric/rule computation or Action execution is exposed.
function validateInsight(value, options = {}) {
  const errors = [];
  const path = options.path || 'insight';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'AI Insight must be an object')]);
  if (value.schemaVersion !== undefined) {
    const compatibility = contracts.validateM05SchemaCompatibility(C020_SCHEMA_VERSION, value.schemaVersion);
    if (!compatibility.valid) errors.push(issue(`${path}.schemaVersion`, 'version', `must equal ${C020_SCHEMA_VERSION}`, compatibility));
  }
  const forbidden = findForbiddenKeys(value);
  if (forbidden.length) errors.push(issue(`${path}`, 'forbidden', 'C020 insight contains prohibited business detail or side-effect fields', { fields: forbidden }));
  for (const field of ['insightId', 'insightVersion', 'runId', 'title']) if (!isNonEmptyString(value[field])) errors.push(issue(`${path}.${field}`, 'required', `${field} is required`));
  if (value.insightVersion && !EXACT_VERSION_RE.test(value.insightVersion)) errors.push(issue(`${path}.insightVersion`, 'exact', 'insightVersion must be exact'));
  if (!(isNonEmptyString(value.scope) || (isRecord(value.scope) && Object.keys(value.scope).length > 0) || (Array.isArray(value.scope) && value.scope.length > 0))) errors.push(issue(`${path}.scope`, 'required', 'insight scope is required'));
  if (!isNonEmptyString(value.observation || value.coreObservation || value.explanation)) errors.push(issue(`${path}.observation`, 'required', 'an evidence-backed observation is required'));
  if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length === 0) errors.push(issue(`${path}.evidenceRefs`, 'required', 'every factual insight needs evidence references'));
  else {
    validateEvidenceRefs(value.evidenceRefs, `${path}.evidenceRefs`, errors);
    const packageId = first(value.reportContext, ['evidencePackageId', 'evidenceId']);
    if (packageId) value.evidenceRefs.forEach((entry, index) => {
      if (isRecord(entry) && entry.packageId && entry.packageId !== packageId) errors.push(issue(`${path}.evidenceRefs[${index}].packageId`, 'mismatch', 'insight evidence must belong to the fixed evidence package'));
    });
  }
  if (value.confirmationState && !['unconfirmed', 'confirmed', 'rejected'].includes(value.confirmationState)) errors.push(issue(`${path}.confirmationState`, 'enum', 'unsupported confirmation state'));
  if (value.confirmationState && value.confirmationState !== 'unconfirmed' && options.allowStateTransition !== true) errors.push(issue(`${path}.confirmationState`, 'permission', 'new C020 insights must start unconfirmed'));
  if (value.freshnessState && !['fresh', 'stale', 'unknown'].includes(value.freshnessState)) errors.push(issue(`${path}.freshnessState`, 'enum', 'unsupported freshness state'));
  if (value.generatedAt && !requireDateTime(value.generatedAt)) errors.push(issue(`${path}.generatedAt`, 'format', 'generatedAt must be an RFC 3339 date-time'));
  if (value.actionCandidates !== undefined) {
    if (!Array.isArray(value.actionCandidates)) errors.push(issue(`${path}.actionCandidates`, 'type', 'action candidates must be an array'));
    else value.actionCandidates.forEach((candidate, index) => {
      if (!isRecord(candidate) || !isNonEmptyString(candidate.actionTypeId || candidate.typeId || candidate.id)) errors.push(issue(`${path}.actionCandidates[${index}]`, 'reference', 'candidate must reference a published Action Type'));
      if (candidate.status && !['not-initiated', 'not_started', 'pending-user-confirmation'].includes(String(candidate.status).toLowerCase())) errors.push(issue(`${path}.actionCandidates[${index}].status`, 'side-effect', 'Action candidates must remain not initiated'));
    });
  }
  if (value.reportContext) errors.push(...contracts.validateReportContext(value.reportContext, { path: `${path}.reportContext` }).errors);
  return validation(errors.length === 0, errors);
}

function createInsight(value, options = {}) {
  const source = clone(value);
  source.insightId = source.insightId || uuid('insight');
  source.insightVersion = source.insightVersion || 'v1';
  source.confirmationState = source.confirmationState || 'unconfirmed';
  source.freshnessState = source.freshnessState || 'fresh';
  source.generatedAt = source.generatedAt || nowIso(options.clock);
  if (options.credibilitySummary && !source.credibilitySummaryRef) {
    const fixedSummary = contracts.assertCredibilitySummary(options.credibilitySummary);
    source.credibilitySummaryRef = { id: fixedSummary.summaryId, version: fixedSummary.summaryVersion, owner: fixedSummary.owner || 'M02' };
  }
  if (options.release && !source.generation) source.generation = {
    agentRelease: { id: options.release.releaseId, version: options.release.releaseVersion || options.release.version, digest: options.release.digest || options.release.fingerprint },
    agent: options.release.agent || options.release.agentRef || null,
    prompt: options.release.prompt || options.release.promptRef || null,
    skills: options.release.skills || options.release.skillRefs || [],
    tools: options.release.tools || options.release.toolRefs || [],
    model: options.release.model || options.release.modelRef || null,
    publishedOntology: options.release.publishedOntologies?.[0] || options.release.publishedOntology || null
  };
  source.immutable = true;
  const fingerprintInput = { ...source };
  delete fingerprintInput.fingerprint;
  source.fingerprint = sha256(fingerprintInput);
  const result = validation(validateInsight(source).valid, validateInsight(source).errors);
  if (!result.valid) fail('C020_INVALID', 'AI Insight output contract failed', result.errors);
  return immutable(source);
}

function confirmInsight(insight, options = {}) {
  if (insight.confirmationState === 'rejected') fail('INSIGHT_IMMUTABLE', 'rejected insight requires a new run');
  if (['stale', 'unknown'].includes(String(insight.freshnessState || '').toLowerCase()) && options.allowStale !== true) fail('C017_USAGE_BLOCKED', 'stale or unknown C017 freshness blocks insight confirmation');
  if (options.permission !== true) fail('PERMISSION_DENIED', 'confirming an insight requires explicit permission');
  const next = { ...insight, sourceFingerprint: insight.fingerprint || null, confirmationState: 'confirmed', confirmation: { actorRef: options.actorRef || null, formedAt: options.formedAt || nowIso(options.clock), note: options.note || null } };
  delete next.fingerprint; next.fingerprint = sha256(next); return immutable(next);
}

function rejectInsight(insight, options = {}) {
  const next = { ...insight, sourceFingerprint: insight.fingerprint || null, confirmationState: 'rejected', rejection: { actorRef: options.actorRef || null, formedAt: options.formedAt || nowIso(options.clock), reason: options.reason || 'not specified' } };
  delete next.fingerprint; next.fingerprint = sha256(next); return immutable(next);
}

function markInsightStale(insight, reason, options = {}) {
  const next = { ...insight, sourceFingerprint: insight.fingerprint || null, freshnessState: 'stale', stale: { detectedAt: options.at || nowIso(options.clock), reason, originalDataVersion: insight.reportContext?.dataVersion || insight.reportContext?.dataAssetVersion || insight.dataVersion || insight.dataAssetVersion || null }, confirmationState: insight.confirmationState };
  delete next.fingerprint;
  next.fingerprint = sha256(next);
  return immutable(next);
}

function replaceInsight(previous, next, options = {}) {
  if (!previous || !next) fail('INSIGHT_REPLACEMENT_INVALID', 'both source and replacement insights are required');
  if (previous.insightId === next.insightId && previous.insightVersion === next.insightVersion) fail('INSIGHT_REPLACEMENT_INVALID', 'replacement must have a new immutable insight version');
  const replacement = { ...clone(next), replacedFrom: { insightId: previous.insightId, insightVersion: previous.insightVersion, fingerprint: previous.fingerprint || null }, replacementReason: options.reason || 'new-fixed-evidence' };
  delete replacement.fingerprint; replacement.fingerprint = sha256(replacement);
  return immutable(replacement);
}

module.exports = Object.freeze({
  C024_SCHEMA_VERSION, C025_SCHEMA_VERSION, C020_SCHEMA_VERSION, REQUEST_STATES, SESSION_STATES, RUN_STATES, RESULT_STATES,
  canonicalRequest, validateC024Request, normalizeC024Request, assertC024Request, contextIdentity, compareRequestIdentity,
  validateContextBinding, createContextBinding, createSession, createAgentRun,
  validateC025Result, normalizeC025Result, assertC025Result, createAnswerResult, createVerificationExplanationResult,
  markResultState, markContextStale, ReportCopilotStore, createReportCopilotStore,
  validateInsight, createInsight, confirmInsight, rejectInsight, markInsightStale, replaceInsight, validateEvidenceRefs
});
