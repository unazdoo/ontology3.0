'use strict';

const foundationContracts = require('../contracts');
const identity = require('../identity');
const m05Contracts = require('./contracts');
const {
  isRecord, isNonEmptyString, immutable, stableSerialize, sha256, fail
} = require('./util');

const FIXED_REPORT_CONTEXT_SCHEMA_VERSION = 'ofw.c024.fixed-report-context.v1';
const REPORT_COPILOT_C024_SCHEMA_VERSION = 'ofw.c024.report-copilot-request.v1';
const REPORT_COPILOT_RECEIPT_SCHEMA_VERSION = 'ofw.c024.report-copilot-receipt.v1';
const REPORT_COPILOT_C025_SCHEMA_VERSION = 'ofw.c025.report-copilot-result.v1';
const REPORT_COPILOT_READ_SCHEMA_VERSION = 'ofw.c025.report-copilot-read-request.v1';

const REPORT_COPILOT_REQUEST_EVENT_TYPE = 'M06.C024.ReportCopilotRequest';
const REPORT_COPILOT_RECEIPT_EVENT_TYPE = 'M05.C024.ReportCopilotReceived';
const REPORT_COPILOT_RESULT_EVENT_TYPE = 'M05.C025.ReportCopilotResult';
const REPORT_COPILOT_READ_EVENT_TYPE = 'M06.C025.ReportCopilotRead';

// M06 50efbcd shipped these two event spellings. Keep the accepted set closed
// to the dispatch contract plus that concrete consumer until M06 converges.
const M06_CURRENT_REQUEST_EVENT_TYPE = 'M06.C024.ReportCopilotRequested';
const M06_CURRENT_READ_EVENT_TYPE = 'M06.C025.ReportCopilotReadRequested';
const REQUEST_EVENT_TYPES = new Set([REPORT_COPILOT_REQUEST_EVENT_TYPE, M06_CURRENT_REQUEST_EVENT_TYPE]);
const READ_EVENT_TYPES = new Set([REPORT_COPILOT_READ_EVENT_TYPE, M06_CURRENT_READ_EVENT_TYPE]);

const PURPOSES = new Set(['report-question', 't049-explanation', 'c027-explanation']);
const C024_FIELDS = new Set([
  'schemaVersion', 'contractId', 'requestId', 'requestFingerprint', 'scenarioContext',
  'fixedReportContext', 'selectionIntent', 'agentReleaseRef', 'requestedBy',
  'requestedAt', 'immutable'
]);
const FIXED_CONTEXT_FIELDS = new Set([
  'schemaVersion', 'fixedContextId', 'version', 'scenarioContext', 'reportRef',
  'definitionRef', 'templateRef', 'evidencePackRef', 'anchorSnapshot',
  'exactCombination', 'c017Ref', 'semanticEvidenceRefs', 'authorizationRef',
  'agentReleaseRef', 'deterministicResultRef', 'allowedEvidenceRefs', 'immutable'
]);
const EXACT_FIELDS = new Set([
  't019Id', 't019Version', 'semanticVersionId', 'semanticVersion', 'dataVersionId',
  't008', 'c017SummaryId', 'c017SummaryVersion'
]);
const RECEIPT_FIELDS = new Set([
  'schemaVersion', 'contractId', 'requestId', 'idempotencyKey', 'scenarioContext',
  'fixedContextRef', 'status', 'receivedAt', 'owner'
]);
const READ_FIELDS = new Set([
  'schemaVersion', 'requestId', 'idempotencyKey', 'sourceIdempotencyKey',
  'scenarioContext', 'fixedContextRef', 'bindingRef', 'sessionRef', 'runRef',
  'resultRef', 'requestedAt'
]);

function assertRecord(value, path) {
  if (!isRecord(value)) fail('REPORT_COPILOT_CONTRACT_INVALID', `${path} must be an object`);
  return value;
}

function assertOnly(value, fields, path) {
  assertRecord(value, path);
  const unknownFields = Object.keys(value).filter((field) => !fields.has(field));
  if (unknownFields.length) fail('REPORT_COPILOT_UNKNOWN_FIELD', `${path} contains unknown fields`, { unknownFields });
  return value;
}

function assertText(value, path) {
  if (!isNonEmptyString(value)) fail('REPORT_COPILOT_CONTRACT_INVALID', `${path} must be a non-empty string`);
  return value;
}

function assertDateTime(value, path) {
  assertText(value, path);
  if (!identity.isDateTime(value)) fail('REPORT_COPILOT_CONTRACT_INVALID', `${path} must be an RFC 3339 date-time`);
  return value;
}

function assertSame(actual, expected, code, message) {
  if (stableSerialize(actual) !== stableSerialize(expected)) fail(code, message, { expected, actual });
}

function assertScenario(value, expected, path) {
  let scenario;
  try { scenario = identity.assertScenarioContext(value, { allowUnknown: false, enforcePrefix: true, path }); }
  catch (error) { fail('REPORT_COPILOT_CONTEXT_INVALID', `${path} failed strict C033 validation`, { errors: error.errors || error.details }); }
  if (expected) assertSame(scenario, expected, 'REPORT_COPILOT_CONTEXT_MISMATCH', `${path} belongs to another scenario run`);
  return immutable(scenario);
}

function assertRef(value, fields, path) {
  assertOnly(value, new Set(fields), path);
  fields.forEach((field) => assertText(value[field], `${path}.${field}`));
  return immutable(value);
}

function assertStringArray(value, path, options = {}) {
  if (!Array.isArray(value) || (options.nonEmpty && value.length === 0)) fail('REPORT_COPILOT_CONTRACT_INVALID', `${path} must be ${options.nonEmpty ? 'a non-empty ' : 'an '}array`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertText(item, `${path}[${index}]`);
    if (seen.has(item)) fail('REPORT_COPILOT_CONTRACT_INVALID', `${path} contains a duplicate reference`, { item });
    seen.add(item);
  });
  return [...value];
}

function assertStrictEnvelope(value, eventTypes, payloadSchemaVersion, path) {
  let envelope;
  try { envelope = foundationContracts.assertContractEnvelope(value, { allowUnknown: false, enforcePrefix: true }); }
  catch (error) { fail('REPORT_COPILOT_ENVELOPE_INVALID', `${path} failed strict Foundation Envelope validation`, { errors: error.errors || error.details }); }
  if (!eventTypes.has(envelope.eventType)) fail('REPORT_COPILOT_EVENT_MISMATCH', `${path}.eventType is not accepted`, { actual: envelope.eventType, expected: [...eventTypes] });
  if (!isRecord(envelope.payload) || envelope.payload.schemaVersion !== payloadSchemaVersion) fail('REPORT_COPILOT_SCHEMA_MISMATCH', `${path} payload schemaVersion must equal ${payloadSchemaVersion}`);
  assertScenario(envelope.scenarioContext, null, `${path}.scenarioContext`);
  return immutable(envelope);
}

function assertExactCombination(value) {
  assertOnly(value, EXACT_FIELDS, 'C024.fixedReportContext.exactCombination');
  EXACT_FIELDS.forEach((field) => assertText(value[field], `C024.fixedReportContext.exactCombination.${field}`));
  assertDateTime(value.t008, 'C024.fixedReportContext.exactCombination.t008');
  return immutable(value);
}

function assertDeterministicResultRef(value) {
  if (value === null) return null;
  assertOnly(value, new Set(['type', 'id', 'version', 'status', 'currentStatusSummaryRef', 'c008Ref']), 'C024.fixedReportContext.deterministicResultRef');
  for (const field of ['type', 'id', 'version', 'status']) assertText(value[field], `C024.fixedReportContext.deterministicResultRef.${field}`);
  if (!['T049', 'C027'].includes(value.type)) fail('REPORT_COPILOT_CONTRACT_INVALID', 'deterministicResultRef.type must be T049 or C027');
  if (value.currentStatusSummaryRef !== undefined) {
    assertOnly(value.currentStatusSummaryRef, new Set(['summaryId', 'version', 'formedAt', 'readReceiptId']), 'C024.fixedReportContext.deterministicResultRef.currentStatusSummaryRef');
    for (const field of ['summaryId', 'version', 'formedAt']) assertText(value.currentStatusSummaryRef[field], `C024.fixedReportContext.deterministicResultRef.currentStatusSummaryRef.${field}`);
    if (value.currentStatusSummaryRef.readReceiptId !== undefined) assertText(value.currentStatusSummaryRef.readReceiptId, 'C024.fixedReportContext.deterministicResultRef.currentStatusSummaryRef.readReceiptId');
    assertDateTime(value.currentStatusSummaryRef.formedAt, 'C024.fixedReportContext.deterministicResultRef.currentStatusSummaryRef.formedAt');
  }
  if (value.c008Ref !== undefined) assertRef(value.c008Ref, ['c008Id', 'version', 'readReceiptId'], 'C024.fixedReportContext.deterministicResultRef.c008Ref');
  return immutable(value);
}

function assertFixedReportContext(value, scenarioContext) {
  assertOnly(value, FIXED_CONTEXT_FIELDS, 'C024.fixedReportContext');
  if (value.schemaVersion !== FIXED_REPORT_CONTEXT_SCHEMA_VERSION || value.immutable !== true) fail('REPORT_COPILOT_CONTRACT_INVALID', 'fixedReportContext must use the immutable official schema');
  assertText(value.fixedContextId, 'C024.fixedReportContext.fixedContextId');
  assertText(value.version, 'C024.fixedReportContext.version');
  const scenario = assertScenario(value.scenarioContext, scenarioContext, 'C024.fixedReportContext.scenarioContext');
  const reportRef = assertRef(value.reportRef, ['reportId', 'reportNumber', 'artifactVersion', 'contentVersionId', 'generationRunId'], 'C024.fixedReportContext.reportRef');
  const definitionRef = assertRef(value.definitionRef, ['reportDefinitionId', 'version'], 'C024.fixedReportContext.definitionRef');
  const templateRef = assertRef(value.templateRef, ['templateId', 'version'], 'C024.fixedReportContext.templateRef');
  const evidencePackRef = assertRef(value.evidencePackRef, ['evidencePackId', 'version'], 'C024.fixedReportContext.evidencePackRef');
  const exactCombination = assertExactCombination(value.exactCombination);
  const c017Ref = assertRef(value.c017Ref, ['summaryId', 'version', 'formedAt'], 'C024.fixedReportContext.c017Ref');
  assertDateTime(c017Ref.formedAt, 'C024.fixedReportContext.c017Ref.formedAt');
  if (c017Ref.summaryId !== exactCombination.c017SummaryId || c017Ref.version !== exactCombination.c017SummaryVersion) fail('REPORT_COPILOT_C017_MISMATCH', 'C017 reference does not match exactCombination');
  const authorizationRef = assertRef(value.authorizationRef, ['decisionId', 'version', 'status', 'decidedAt', 'scopeRef'], 'C024.fixedReportContext.authorizationRef');
  assertDateTime(authorizationRef.decidedAt, 'C024.fixedReportContext.authorizationRef.decidedAt');
  if (authorizationRef.status !== 'allowed') fail('REPORT_COPILOT_PERMISSION_DENIED', 'C024 authorizationRef must be allowed');
  const agentReleaseRef = assertRef(value.agentReleaseRef, ['agentId', 'version'], 'C024.fixedReportContext.agentReleaseRef');
  const semanticEvidenceRefs = assertStringArray(value.semanticEvidenceRefs, 'C024.fixedReportContext.semanticEvidenceRefs');
  const allowedEvidenceRefs = assertStringArray(value.allowedEvidenceRefs, 'C024.fixedReportContext.allowedEvidenceRefs', { nonEmpty: true });
  const deterministicResultRef = assertDeterministicResultRef(value.deterministicResultRef);
  assertOnly(value.anchorSnapshot, new Set(['anchorSnapshotId', 'version', 'selectionScope', 'anchors']), 'C024.fixedReportContext.anchorSnapshot');
  for (const field of ['anchorSnapshotId', 'version', 'selectionScope']) assertText(value.anchorSnapshot[field], `C024.fixedReportContext.anchorSnapshot.${field}`);
  if (!Array.isArray(value.anchorSnapshot.anchors) || value.anchorSnapshot.anchors.length === 0) fail('REPORT_COPILOT_CONTRACT_INVALID', 'anchorSnapshot.anchors must be non-empty');
  const anchorIds = new Set();
  const anchors = value.anchorSnapshot.anchors.map((anchor, index) => {
    const path = `C024.fixedReportContext.anchorSnapshot.anchors[${index}]`;
    assertOnly(anchor, new Set(['t044Id', 'anchorKind', 'sectionId', 'stableLocation', 'evidenceRefs']), path);
    for (const field of ['t044Id', 'anchorKind', 'sectionId', 'stableLocation']) assertText(anchor[field], `${path}.${field}`);
    if (anchorIds.has(anchor.t044Id)) fail('REPORT_COPILOT_CONTRACT_INVALID', 'anchorSnapshot contains a duplicate T044', { t044Id: anchor.t044Id });
    anchorIds.add(anchor.t044Id);
    const evidenceRefs = assertStringArray(anchor.evidenceRefs, `${path}.evidenceRefs`);
    evidenceRefs.forEach((ref) => { if (!allowedEvidenceRefs.includes(ref)) fail('REPORT_COPILOT_EVIDENCE_MISMATCH', 'T044 evidence is outside allowedEvidenceRefs', { ref }); });
    return immutable({ ...anchor, evidenceRefs });
  });
  semanticEvidenceRefs.forEach((ref) => { if (!allowedEvidenceRefs.includes(ref)) fail('REPORT_COPILOT_EVIDENCE_MISMATCH', 'semantic evidence is outside allowedEvidenceRefs', { ref }); });
  return immutable({
    ...value,
    scenarioContext: scenario,
    reportRef,
    definitionRef,
    templateRef,
    evidencePackRef,
    anchorSnapshot: { ...value.anchorSnapshot, anchors },
    exactCombination,
    c017Ref,
    semanticEvidenceRefs,
    authorizationRef,
    agentReleaseRef,
    deterministicResultRef,
    allowedEvidenceRefs
  });
}

function assertC024Envelope(value) {
  const envelope = assertStrictEnvelope(value, REQUEST_EVENT_TYPES, REPORT_COPILOT_C024_SCHEMA_VERSION, 'C024 Envelope');
  const payload = envelope.payload;
  assertOnly(payload, C024_FIELDS, 'C024 payload');
  if (payload.contractId !== 'C024' || payload.immutable !== true) fail('REPORT_COPILOT_CONTRACT_INVALID', 'C024 must be immutable and use contractId C024');
  for (const field of ['requestId', 'requestFingerprint', 'requestedBy']) assertText(payload[field], `C024.${field}`);
  assertDateTime(payload.requestedAt, 'C024.requestedAt');
  const scenarioContext = assertScenario(payload.scenarioContext, envelope.scenarioContext, 'C024.scenarioContext');
  const fixedReportContext = assertFixedReportContext(payload.fixedReportContext, scenarioContext);
  assertOnly(payload.selectionIntent, new Set(['purpose', 'selectionScope', 'question']), 'C024.selectionIntent');
  const purpose = assertText(payload.selectionIntent.purpose, 'C024.selectionIntent.purpose');
  if (!PURPOSES.has(purpose)) fail('REPORT_COPILOT_CONTRACT_INVALID', 'C024 selectionIntent purpose is unsupported', { purpose });
  const selectionScope = assertText(payload.selectionIntent.selectionScope, 'C024.selectionIntent.selectionScope');
  const question = assertText(payload.selectionIntent.question, 'C024.selectionIntent.question');
  if (selectionScope !== fixedReportContext.anchorSnapshot.selectionScope) fail('REPORT_COPILOT_CONTEXT_MISMATCH', 'selectionIntent does not match the fixed anchor snapshot scope');
  const agentReleaseRef = assertRef(payload.agentReleaseRef, ['agentId', 'version'], 'C024.agentReleaseRef');
  assertSame(agentReleaseRef, fixedReportContext.agentReleaseRef, 'REPORT_COPILOT_RELEASE_MISMATCH', 'C024 Agent Release references differ');
  const fingerprint = sha256({
    fixedContextId: fixedReportContext.fixedContextId,
    purpose,
    question,
    agentReleaseRef,
    deterministicResultRef: fixedReportContext.deterministicResultRef
  });
  if (payload.requestFingerprint !== fingerprint || envelope.idempotencyKey !== `idem-v1:${fingerprint}`) fail('REPORT_COPILOT_IDEMPOTENCY_MISMATCH', 'C024 fingerprint/idempotency key is invalid');
  if (payload.requestedAt !== envelope.occurredAt || stableSerialize(payload.requestedBy) !== stableSerialize(envelope.actorRef)) fail('REPORT_COPILOT_ENVELOPE_MISMATCH', 'C024 actor or occurrence time differs from its Envelope');
  return immutable({ envelope, payload: { ...payload, scenarioContext, fixedReportContext, selectionIntent: { purpose, selectionScope, question }, agentReleaseRef } });
}

function unwrapProviderPayload(value, expectedScenario, path) {
  if (isRecord(value) && value.schemaVersion === foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION && Object.prototype.hasOwnProperty.call(value, 'payload')) {
    let envelope;
    try { envelope = foundationContracts.assertContractEnvelope(value, { allowUnknown: false, enforcePrefix: true }); }
    catch (error) { fail('REPORT_COPILOT_PROVIDER_INVALID', `${path} provider Envelope is invalid`, { errors: error.errors || error.details }); }
    assertScenario(envelope.scenarioContext, expectedScenario, `${path}.scenarioContext`);
    return envelope.payload;
  }
  return value;
}

function assertResolvedC017(value, c024) {
  const summary = unwrapProviderPayload(value, c024.payload.scenarioContext, 'C017');
  let candidate = summary;
  let result = m05Contracts.validateCredibilitySummary(candidate, { path: 'C017' });
  if (!result.valid && isRecord(summary?.quality) && isRecord(summary?.binding)) {
    const qualityStatus = summary.quality.hardFailure === true ? 'failed' : ({ pass: 'passed', passed: 'passed', warning: 'warning', warn: 'warning', fail: 'failed', failed: 'failed', 'hard-fail': 'failed', unknown: 'unknown', unverifiable: 'not-verifiable' }[String(summary.quality.status || '').toLowerCase()]);
    if (!qualityStatus || summary.consumptionReadiness?.status !== 'ready') fail('REPORT_COPILOT_C017_INVALID', 'resolved C017 summary is not consumable');
    candidate = {
      summaryId: summary.summaryId,
      summaryVersion: summary.version,
      formedAt: summary.formedAt,
      status: qualityStatus,
      freshness: isRecord(summary.freshness) ? { status: summary.freshness.status } : summary.freshness,
      ...(summary.quality.affectedScope ? { scope: summary.quality.affectedScope } : {}),
      semanticVersionId: summary.binding.semanticVersionId,
      semanticVersion: summary.binding.semanticVersion,
      dataVersionId: summary.binding.dataVersionId,
      dataAssetVersion: summary.binding.dataVersionId,
      t008: summary.binding.t008,
      scenarioContext: summary.scenarioContext,
      owner: summary.owner || summary.authoritativeRead?.owner || 'M02'
    };
    result = m05Contracts.validateCredibilitySummary(candidate, { path: 'C017' });
  }
  if (!result.valid) fail('REPORT_COPILOT_C017_INVALID', 'resolved C017 summary is invalid', result.errors);
  const normalized = m05Contracts.assertCredibilitySummary(candidate);
  const expected = c024.payload.fixedReportContext.c017Ref;
  if (normalized.summaryId !== expected.summaryId || normalized.summaryVersion !== expected.version || normalized.formedAt !== expected.formedAt) fail('REPORT_COPILOT_C017_MISMATCH', 'resolved C017 summary does not match the fixed reference');
  if (normalized.scenarioContext) assertScenario(normalized.scenarioContext, c024.payload.scenarioContext, 'C017.scenarioContext');
  const exact = c024.payload.fixedReportContext.exactCombination;
  for (const [field, expectedValue] of [['semanticVersionId', exact.semanticVersionId], ['semanticVersion', exact.semanticVersion], ['dataVersionId', exact.dataVersionId], ['t008', exact.t008]]) {
    if (normalized[field] !== undefined && normalized[field] !== expectedValue) fail('REPORT_COPILOT_C017_MISMATCH', `resolved C017 ${field} differs from the fixed context`);
  }
  return immutable(normalized);
}

function normalizedVerificationStatus(value) {
  return ({ pass: 'passed', passed: 'passed', warning: 'warning', warn: 'warning', fail: 'failed', failed: 'failed', unverifiable: 'not-verifiable', 'not-verifiable': 'not-verifiable', incomplete: 'not-verifiable', unknown: 'unknown' })[String(value || '').toLowerCase()] || null;
}

function assertResolvedVerification(value, c024) {
  const verification = unwrapProviderPayload(value, c024.payload.scenarioContext, 'M06 deterministic verification');
  const ref = c024.payload.fixedReportContext.deterministicResultRef;
  const verificationVersion = verification?.version || verification?.resultVersion;
  if (!ref || ref.type !== 'T049' || verification?.verificationRunId !== ref.id || verificationVersion !== ref.version || verification?.status !== ref.status) fail('REPORT_COPILOT_VERIFICATION_MISMATCH', 'resolved T049 result does not match the fixed reference');
  const expectedEvidencePack = c024.payload.fixedReportContext.evidencePackRef;
  if (verification?.evidencePackRef?.evidencePackId !== expectedEvidencePack.evidencePackId || verification?.evidencePackRef?.version !== expectedEvidencePack.version) fail('REPORT_COPILOT_VERIFICATION_MISMATCH', 'resolved T049 result binds another evidence pack');
  let candidate = verification;
  let result = m05Contracts.validateVerificationResult(candidate, { path: 'verificationResult', requireReportIdentity: true });
  if (!result.valid && verification?.runStatus === 'completed' && Array.isArray(verification.results)) {
    const mappedStatus = normalizedVerificationStatus(verification.status);
    if (!mappedStatus) fail('REPORT_COPILOT_VERIFICATION_INVALID', 'resolved T049 status is unsupported');
    candidate = {
      verificationRunId: verification.verificationRunId,
      resultId: verification.verificationResultId,
      resultVersion: verification.version,
      status: mappedStatus,
      checks: verification.results
        .map((item) => ({ checkId: item.resultId, status: normalizedVerificationStatus(item.status || item.state) }))
        .filter((item) => item.status),
      reportId: c024.payload.fixedReportContext.reportRef.reportId,
      contentVersion: verification.contentVersionId,
      scenarioContext: verification.scenarioContext,
      owner: 'M06'
    };
    result = m05Contracts.validateVerificationResult(candidate, { path: 'verificationResult', requireReportIdentity: true });
  }
  if (!result.valid) fail('REPORT_COPILOT_VERIFICATION_INVALID', 'resolved deterministic verification result is invalid', result.errors);
  const normalized = m05Contracts.assertVerificationResult(candidate, { requireReportIdentity: true });
  if (normalized.reportId !== c024.payload.fixedReportContext.reportRef.reportId || normalized.contentVersion !== c024.payload.fixedReportContext.reportRef.contentVersionId) fail('REPORT_COPILOT_VERIFICATION_MISMATCH', 'resolved T049 result belongs to another report/content version');
  if (normalized.scenarioContext) assertScenario(normalized.scenarioContext, c024.payload.scenarioContext, 'verificationResult.scenarioContext');
  return immutable(normalized);
}

function assertResolvedComparison(value, c024) {
  const comparison = unwrapProviderPayload(value, c024.payload.scenarioContext, 'M06 C027 comparison');
  const ref = c024.payload.fixedReportContext.deterministicResultRef;
  const expectedEvidencePack = c024.payload.fixedReportContext.evidencePackRef;
  assertRecord(comparison, 'C027 comparison');
  if (!ref || ref.type !== 'C027' || comparison.comparisonRecordId !== ref.id
      || (comparison.version || '1.0.0') !== ref.version
      || (comparison.result || comparison.comparisonStatus) !== ref.status
      || comparison.runStatus !== 'completed'
      || comparison.contentVersionId !== c024.payload.fixedReportContext.reportRef.contentVersionId
      || comparison.evidencePackRef?.evidencePackId !== expectedEvidencePack.evidencePackId
      || comparison.evidencePackRef?.version !== expectedEvidencePack.version) {
    fail('REPORT_COPILOT_COMPARISON_MISMATCH', 'resolved C027 comparison does not match the fixed reference/report/evidence context');
  }
  assertScenario(comparison.scenarioContext, c024.payload.scenarioContext, 'C027.scenarioContext');
  if (ref.currentStatusSummaryRef !== undefined) assertSame(comparison.currentStatusSummaryRef, ref.currentStatusSummaryRef, 'REPORT_COPILOT_COMPARISON_MISMATCH', 'resolved C027 current C017 reference differs');
  if (ref.c008Ref !== undefined) assertSame(comparison.c008Ref, ref.c008Ref, 'REPORT_COPILOT_COMPARISON_MISMATCH', 'resolved C027 C008 reference differs');
  return immutable({
    comparisonRecordId: comparison.comparisonRecordId,
    version: comparison.version || '1.0.0',
    status: comparison.result || comparison.comparisonStatus,
    scenarioContext: comparison.scenarioContext,
    contentVersionId: comparison.contentVersionId,
    evidencePackRef: comparison.evidencePackRef,
    currentStatusSummaryRef: comparison.currentStatusSummaryRef,
    c008Ref: comparison.c008Ref,
    owner: 'M06'
  });
}

function toRuntimeReportContext(c024, verificationResult, comparisonResult) {
  const fixed = c024.payload.fixedReportContext;
  const exact = fixed.exactCombination;
  const firstAnchor = fixed.anchorSnapshot.anchors[0];
  return immutable({
    scenarioContext: fixed.scenarioContext,
    reportId: fixed.reportRef.reportId,
    contentVersion: fixed.reportRef.contentVersionId,
    evidencePackageId: fixed.evidencePackRef.evidencePackId,
    evidencePackageVersion: fixed.evidencePackRef.version,
    semanticResourceId: exact.semanticVersionId,
    semanticVersion: exact.semanticVersion,
    publishedOntology: { type: 'publishedOntology', id: exact.semanticVersionId, version: exact.semanticVersion, status: 'published', owner: 'M01' },
    dataAssetVersion: exact.dataVersionId,
    dataAsOf: exact.t008,
    anchorSnapshotId: fixed.anchorSnapshot.anchorSnapshotId,
    anchorSnapshotVersion: fixed.anchorSnapshot.version,
    selectedAnchor: firstAnchor.t044Id,
    anchors: fixed.anchorSnapshot.anchors.map((anchor) => anchor.t044Id),
    credibilitySummaryRef: { type: 'credibilitySummary', id: fixed.c017Ref.summaryId, version: fixed.c017Ref.version, owner: 'M02' },
    ...(verificationResult ? { verificationResultRef: { type: 'verificationResult', id: verificationResult.resultId, version: verificationResult.resultVersion, owner: 'M06' } } : {}),
    permission: { allowed: true, decisionId: fixed.authorizationRef.decisionId, version: fixed.authorizationRef.version, scopeRef: fixed.authorizationRef.scopeRef },
    fixedContextRef: { id: fixed.fixedContextId, version: fixed.version },
    reportRef: fixed.reportRef,
    evidencePackRef: fixed.evidencePackRef,
    exactCombination: exact,
    c017Ref: fixed.c017Ref,
    agentReleaseRef: fixed.agentReleaseRef,
    deterministicResultRef: fixed.deterministicResultRef,
    ...(comparisonResult ? { comparisonResult } : {}),
    allowedEvidenceRefs: fixed.allowedEvidenceRefs
  });
}

function createRuntimeEnvelope(c024, c017Summary, verificationResult, comparisonResult) {
  const fixed = c024.payload.fixedReportContext;
  const reportContext = toRuntimeReportContext(c024, verificationResult, comparisonResult);
  const requestType = c024.payload.selectionIntent.purpose === 't049-explanation' ? 'verification-explanation' : 'question';
  const payload = {
    requestId: c024.payload.requestId,
    idempotencyKey: c024.envelope.idempotencyKey,
    requestType,
    question: c024.payload.selectionIntent.question,
    reportContext,
    credibilitySummary: c017Summary,
    ...(verificationResult ? { verificationResult } : {}),
    permission: reportContext.permission,
    receivedAt: c024.payload.requestedAt,
    sourceRef: { type: 'C024', id: c024.payload.requestId, version: fixed.version, owner: 'M06' },
    metadata: { officialReportCopilotEnvelope: c024.envelope }
  };
  return immutable({
    eventId: `${c024.envelope.eventId}:M05-runtime`,
    eventType: 'M06.C024',
    schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
    occurredAt: c024.envelope.occurredAt,
    actorRef: c024.envelope.actorRef,
    correlationId: c024.envelope.correlationId,
    traceId: c024.envelope.traceId,
    idempotencyKey: c024.envelope.idempotencyKey,
    scenarioContext: c024.payload.scenarioContext,
    resourceRefs: c024.envelope.resourceRefs,
    evidenceRefs: c024.envelope.evidenceRefs,
    payload
  });
}

function createReceiptEnvelope(c024, receivedRequest, options = {}) {
  const fixed = c024.payload.fixedReportContext;
  const receivedAt = receivedRequest.receivedAt;
  const payload = immutable({
    schemaVersion: REPORT_COPILOT_RECEIPT_SCHEMA_VERSION,
    contractId: 'C024',
    requestId: c024.payload.requestId,
    idempotencyKey: c024.envelope.idempotencyKey,
    scenarioContext: c024.payload.scenarioContext,
    fixedContextRef: { id: fixed.fixedContextId, version: fixed.version },
    status: 'accepted',
    receivedAt,
    owner: 'M05'
  });
  const envelope = {
    eventId: options.idFactory('M05-C024-RECEIPT', { requestId: payload.requestId, receivedAt }),
    eventType: REPORT_COPILOT_RECEIPT_EVENT_TYPE,
    schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
    occurredAt: receivedAt,
    actorRef: 'M05',
    correlationId: c024.envelope.correlationId,
    traceId: c024.envelope.traceId,
    idempotencyKey: c024.envelope.idempotencyKey,
    scenarioContext: payload.scenarioContext,
    resourceRefs: [`fixed-report-context:${fixed.fixedContextId}@${fixed.version}`],
    evidenceRefs: [],
    payload
  };
  return immutable(foundationContracts.assertContractEnvelope(envelope, { allowUnknown: false, enforcePrefix: true }));
}

function assertReceiptEnvelope(value, c024) {
  const envelope = assertStrictEnvelope(value, new Set([REPORT_COPILOT_RECEIPT_EVENT_TYPE]), REPORT_COPILOT_RECEIPT_SCHEMA_VERSION, 'C024 receipt Envelope');
  const payload = envelope.payload;
  assertOnly(payload, RECEIPT_FIELDS, 'C024 receipt payload');
  const fixed = c024.payload.fixedReportContext;
  if (payload.contractId !== 'C024' || payload.owner !== 'M05' || payload.status !== 'accepted'
      || payload.requestId !== c024.payload.requestId || payload.idempotencyKey !== c024.envelope.idempotencyKey) fail('REPORT_COPILOT_RECEIPT_MISMATCH', 'C024 receipt does not match the accepted request');
  assertScenario(payload.scenarioContext, c024.payload.scenarioContext, 'C024 receipt scenarioContext');
  assertSame(payload.fixedContextRef, { id: fixed.fixedContextId, version: fixed.version }, 'REPORT_COPILOT_RECEIPT_MISMATCH', 'C024 receipt fixed context differs');
  assertDateTime(payload.receivedAt, 'C024 receipt receivedAt');
  return immutable({ envelope, payload });
}

function normalizeResultRef(value, path) {
  if (isNonEmptyString(value)) return value;
  if (!isRecord(value)) fail('REPORT_COPILOT_OUTPUT_INVALID', `${path} must identify one fixed resource`);
  const id = value.t044Id || value.evidenceId || value.id || value.refId || value.resourceId;
  return assertText(id, path);
}

function mapSessionStatus(value) {
  if (value === 'active') return 'active';
  if (value === 'restricted') return 'restricted';
  if (['context-stale', 'comparison-stale', 'historical'].includes(value)) return 'stale';
  if (value === 'closed') return 'closed';
  fail('REPORT_COPILOT_STATUS_UNKNOWN', 'internal Session has an unknown status', { status: value });
}

function mapRunStatus(value) {
  const statuses = {
    completed: 'complete',
    'restricted-completed': 'limited-complete',
    'partially-completed': 'partial-complete',
    'input-invalid': 'input-invalid',
    failed: 'failed',
    'output-invalid': 'output-invalid',
    cancelled: 'cancelled'
  };
  if (!statuses[value]) fail('REPORT_COPILOT_STATUS_UNKNOWN', 'internal Run has an unknown or non-terminal status', { status: value });
  return statuses[value];
}

function assertRuntimeChain(chain, c024) {
  const { binding, session, run, result } = chain;
  if (!binding || !session || !run || !result) fail('REPORT_COPILOT_CHAIN_UNKNOWN', 'complete Binding/Session/Run/Result resources are required');
  if (binding.requestId !== c024.payload.requestId || session.bindingId !== binding.bindingId
      || run.bindingId !== binding.bindingId || result.bindingId !== binding.bindingId
      || run.sessionId !== session.sessionId || result.sessionId !== session.sessionId
      || result.runId !== run.runId || run.requestId !== c024.payload.requestId || run.resultId !== result.resultId) fail('REPORT_COPILOT_CHAIN_MISMATCH', 'internal Binding/Session/Run/Result do not form one chain');
  const expectedRelease = c024.payload.fixedReportContext.agentReleaseRef;
  if (run.releaseRef?.version !== expectedRelease.version) fail('REPORT_COPILOT_RELEASE_MISMATCH', 'internal Run used a different Agent Release');
  const generationRunId = c024.payload.fixedReportContext.reportRef.generationRunId;
  const deterministicRunId = c024.payload.fixedReportContext.deterministicResultRef?.type === 'T049' ? c024.payload.fixedReportContext.deterministicResultRef.id : null;
  if ([generationRunId, deterministicRunId].filter(Boolean).includes(run.runId)) fail('REPORT_COPILOT_RUN_REUSED', 'copilot Run identity reuses generation or T049 Run');
}

function createC025Envelope(c024, chain, options = {}) {
  assertRuntimeChain(chain, c024);
  const { binding, session, run, result } = chain;
  const fixed = c024.payload.fixedReportContext;
  const runStatus = mapRunStatus(run.state);
  if (!['complete', 'limited-complete', 'partial-complete'].includes(runStatus)) fail('REPORT_COPILOT_RUN_NOT_SUCCESSFUL', 'failed or incomplete internal Run cannot be mapped to a successful C025', { status: runStatus });
  const expectedInternalType = c024.payload.selectionIntent.purpose === 't049-explanation' ? 'verification-explanation' : 'answer';
  if (result.resultType !== expectedInternalType) fail('REPORT_COPILOT_OUTPUT_INVALID', 'internal result type does not match C024 purpose');
  const anchorRefs = (result.anchors || []).map((ref, index) => normalizeResultRef(ref, `internalResult.anchors[${index}]`));
  const evidenceRefs = (result.evidenceRefs || []).map((ref, index) => normalizeResultRef(ref, `internalResult.evidenceRefs[${index}]`));
  const allowedAnchors = new Set(fixed.anchorSnapshot.anchors.map((anchor) => anchor.t044Id));
  const allowedEvidence = new Set(fixed.allowedEvidenceRefs);
  if (!anchorRefs.length || anchorRefs.some((ref) => !allowedAnchors.has(ref))) fail('REPORT_COPILOT_OUTPUT_INVALID', 'internal result anchors are missing or outside the fixed T044 snapshot', { anchorRefs });
  if (!evidenceRefs.length || evidenceRefs.some((ref) => !allowedEvidence.has(ref))) fail('REPORT_COPILOT_OUTPUT_INVALID', 'internal result evidence is missing or outside the fixed whitelist', { evidenceRefs });
  const fixedContextRef = { id: fixed.fixedContextId, version: fixed.version };
  const anchorSnapshotRef = { id: fixed.anchorSnapshot.anchorSnapshotId, version: fixed.anchorSnapshot.version };
  const agentReleaseRef = fixed.agentReleaseRef;
  const sessionStatus = mapSessionStatus(session.state);
  const limitations = Array.isArray(result.limitations) ? result.limitations.filter(isNonEmptyString).join('; ') : (isNonEmptyString(result.limitations) ? result.limitations : '');
  const limitationText = limitations || 'Fixed report evidence only; no report, T049 or C027 mutation.';
  const payload = immutable({
    schemaVersion: REPORT_COPILOT_C025_SCHEMA_VERSION,
    contractId: 'C025',
    requestId: c024.payload.requestId,
    idempotencyKey: c024.envelope.idempotencyKey,
    scenarioContext: fixed.scenarioContext,
    fixedContextRef,
    reportRef: fixed.reportRef,
    evidencePackRef: fixed.evidencePackRef,
    anchorSnapshotRef,
    agentReleaseRef,
    exactCombination: fixed.exactCombination,
    c017Ref: fixed.c017Ref,
    deterministicResultRef: fixed.deterministicResultRef,
    binding: {
      bindingId: binding.bindingId,
      bindingVersion: binding.bindingVersion,
      status: sessionStatus,
      scenarioContext: fixed.scenarioContext,
      fixedContextRef,
      reportRef: fixed.reportRef,
      evidencePackRef: fixed.evidencePackRef,
      anchorSnapshotRef,
      agentReleaseRef,
      authorizationRef: fixed.authorizationRef,
      exactCombination: fixed.exactCombination,
      c017Ref: fixed.c017Ref,
      deterministicResultRef: fixed.deterministicResultRef
    },
    session: {
      sessionId: session.sessionId,
      sessionVersion: '1.0.0',
      status: sessionStatus,
      scenarioContext: fixed.scenarioContext,
      bindingId: binding.bindingId,
      bindingVersion: binding.bindingVersion,
      reportRef: fixed.reportRef,
      agentReleaseRef,
      exactCombination: fixed.exactCombination
    },
    run: {
      runId: run.runId,
      runVersion: '1.0.0',
      status: runStatus,
      attempt: run.attempt,
      scenarioContext: fixed.scenarioContext,
      requestId: c024.payload.requestId,
      sessionId: session.sessionId,
      bindingId: binding.bindingId,
      agentReleaseRef,
      reportRef: fixed.reportRef,
      evidencePackRef: fixed.evidencePackRef,
      exactCombination: fixed.exactCombination,
      startedAt: run.createdAt,
      completedAt: run.completedAt
    },
    result: {
      resultId: result.resultId,
      resultVersion: result.resultVersion,
      status: runStatus,
      type: c024.payload.selectionIntent.purpose === 'report-question' ? 'report-copilot-answer' : 'report-copilot-explanation',
      scenarioContext: fixed.scenarioContext,
      runId: run.runId,
      sessionId: session.sessionId,
      bindingId: binding.bindingId,
      agentReleaseRef,
      reportRef: fixed.reportRef,
      evidencePackRef: fixed.evidencePackRef,
      exactCombination: fixed.exactCombination,
      deterministicResultRef: fixed.deterministicResultRef,
      anchorRefs: [...new Set(anchorRefs)],
      evidenceRefs: [...new Set(evidenceRefs)],
      generatedAt: result.generatedAt,
      limitations: limitationText
    },
    formedAt: result.generatedAt,
    owner: 'M05'
  });
  const envelope = {
    eventId: options.idFactory('M05-C025-RESULT', { requestId: payload.requestId, resultId: result.resultId }),
    eventType: REPORT_COPILOT_RESULT_EVENT_TYPE,
    schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
    occurredAt: payload.formedAt,
    actorRef: 'M05',
    correlationId: c024.envelope.correlationId,
    traceId: c024.envelope.traceId,
    idempotencyKey: c024.envelope.idempotencyKey,
    scenarioContext: fixed.scenarioContext,
    resourceRefs: [
      `binding:${binding.bindingId}@${binding.bindingVersion}`,
      `session:${session.sessionId}@1.0.0`,
      `run:${run.runId}@1.0.0`,
      `result:${result.resultId}@${result.resultVersion}`
    ],
    evidenceRefs: payload.result.evidenceRefs,
    payload
  };
  return immutable(foundationContracts.assertContractEnvelope(envelope, { allowUnknown: false, enforcePrefix: true }));
}

function assertReadEnvelope(value) {
  const envelope = assertStrictEnvelope(value, READ_EVENT_TYPES, REPORT_COPILOT_READ_SCHEMA_VERSION, 'C025 read Envelope');
  const payload = envelope.payload;
  assertOnly(payload, READ_FIELDS, 'C025 read payload');
  for (const field of ['requestId', 'idempotencyKey', 'sourceIdempotencyKey']) assertText(payload[field], `C025 read.${field}`);
  assertDateTime(payload.requestedAt, 'C025 read.requestedAt');
  const scenarioContext = assertScenario(payload.scenarioContext, envelope.scenarioContext, 'C025 read.scenarioContext');
  if (payload.idempotencyKey !== envelope.idempotencyKey) fail('REPORT_COPILOT_IDEMPOTENCY_MISMATCH', 'C025 read payload/Envelope idempotency differs');
  assertRef(payload.fixedContextRef, ['id', 'version'], 'C025 read.fixedContextRef');
  const refFields = {
    bindingRef: ['id', 'version', 'status'],
    sessionRef: ['id', 'version', 'status'],
    runRef: ['id', 'version', 'attempt', 'status'],
    resultRef: ['id', 'version', 'type', 'status', 'generatedAt']
  };
  for (const [field, fields] of Object.entries(refFields)) {
    if (payload[field] === null) continue;
    assertOnly(payload[field], new Set(fields), `C025 read.${field}`);
    assertText(payload[field].id, `C025 read.${field}.id`);
    assertText(payload[field].version, `C025 read.${field}.version`);
    if (payload[field].status !== undefined) assertText(payload[field].status, `C025 read.${field}.status`);
    if (field === 'runRef' && payload[field].attempt !== undefined && (!Number.isInteger(payload[field].attempt) || payload[field].attempt < 1)) fail('REPORT_COPILOT_CONTRACT_INVALID', 'C025 read runRef.attempt must be positive');
    if (field === 'resultRef' && payload[field].generatedAt !== undefined) assertDateTime(payload[field].generatedAt, 'C025 read.resultRef.generatedAt');
  }
  return immutable({ envelope, payload: { ...payload, scenarioContext } });
}

function formalChainRefs(envelope) {
  const payload = envelope.payload;
  return immutable({
    bindingRef: { id: payload.binding.bindingId, version: payload.binding.bindingVersion, status: payload.binding.status },
    sessionRef: { id: payload.session.sessionId, version: payload.session.sessionVersion, status: payload.session.status },
    runRef: { id: payload.run.runId, version: payload.run.runVersion, attempt: payload.run.attempt, status: payload.run.status },
    resultRef: { id: payload.result.resultId, version: payload.result.resultVersion, type: payload.result.type, status: payload.result.status, generatedAt: payload.result.generatedAt }
  });
}

function assertReadMatches(read, c024, resultEnvelope) {
  const fixed = c024.payload.fixedReportContext;
  if (read.payload.requestId !== c024.payload.requestId || read.payload.sourceIdempotencyKey !== c024.envelope.idempotencyKey) fail('REPORT_COPILOT_READ_MISMATCH', 'C025 read request/source idempotency does not match C024');
  assertScenario(read.payload.scenarioContext, c024.payload.scenarioContext, 'C025 read scenarioContext');
  assertSame(read.payload.fixedContextRef, { id: fixed.fixedContextId, version: fixed.version }, 'REPORT_COPILOT_READ_MISMATCH', 'C025 read fixed context differs');
  const refs = formalChainRefs(resultEnvelope);
  for (const field of ['bindingRef', 'sessionRef', 'runRef', 'resultRef']) {
    if (read.payload[field] === null) continue;
    for (const [key, value] of Object.entries(read.payload[field])) {
      if (refs[field][key] !== value) fail('REPORT_COPILOT_READ_MISMATCH', `C025 read ${field}.${key} differs from the stored chain`, { expected: refs[field][key], actual: value });
    }
  }
  return refs;
}

module.exports = Object.freeze({
  FIXED_REPORT_CONTEXT_SCHEMA_VERSION,
  REPORT_COPILOT_C024_SCHEMA_VERSION,
  REPORT_COPILOT_RECEIPT_SCHEMA_VERSION,
  REPORT_COPILOT_C025_SCHEMA_VERSION,
  REPORT_COPILOT_READ_SCHEMA_VERSION,
  REPORT_COPILOT_REQUEST_EVENT_TYPE,
  REPORT_COPILOT_RECEIPT_EVENT_TYPE,
  REPORT_COPILOT_RESULT_EVENT_TYPE,
  REPORT_COPILOT_READ_EVENT_TYPE,
  M06_CURRENT_REQUEST_EVENT_TYPE,
  M06_CURRENT_READ_EVENT_TYPE,
  assertC024Envelope,
  assertResolvedC017,
  assertResolvedVerification,
  assertResolvedComparison,
  createRuntimeEnvelope,
  createReceiptEnvelope,
  assertReceiptEnvelope,
  createC025Envelope,
  assertReadEnvelope,
  assertReadMatches,
  formalChainRefs
});
