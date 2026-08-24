'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const foundationContracts = require('../contracts');
const m05 = require('./index.js');
const { sha256 } = require('./util');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-report-port',
  formedAt: '2026-08-24T09:00:00.000Z',
  status: 'active'
});

function clock() { return '2026-08-24T10:00:00.000Z'; }

function c022(overrides = {}) {
  const definition = {
    schemaVersion: m05.M06_DEFINITION_SCHEMA_VERSION,
    reportDefinitionId: 'RDEF-1',
    version: '1.0.0',
    status: 'enabled',
    title: 'Report',
    purpose: {},
    applicability: {},
    audience: {},
    templateRef: { templateId: 'RT-1', version: '1.0.0' },
    sections: [{ sectionId: 'overview', title: 'Overview', required: true, order: 1 }],
    evidenceSlots: [{ evidenceSlotId: 'metric-slot', sectionId: 'overview', required: true, allowedEvidenceTypes: ['metric-result'], allowedContentTypes: ['metric'] }],
    contentPolicy: { allowedContentTypes: ['metric'], requiredBindingKinds: ['metric-result'] },
    coveragePolicy: {},
    calculationPolicy: { allowedResultTypes: ['metric-result'], roundingMode: 'half-up', defaultTolerance: 0.5, prohibitAgentCalculation: true },
    agentRef: { agentId: 'report-agent', releaseVersion: '1.0.0' },
    skillRef: { skillId: 'report-structure', version: '1.0.0' },
    verificationPolicy: {},
    comparisonPolicy: {},
    presentationPolicy: {},
    reviewPolicy: {},
    publicationPolicy: {},
    enabledAt: '2026-08-24T09:00:00.000Z',
    changeSummary: 'initial',
    immutable: true
  };
  const template = {
    schemaVersion: m05.M06_TEMPLATE_SCHEMA_VERSION,
    templateId: 'RT-1',
    version: '1.0.0',
    reportDefinitionId: 'RDEF-1',
    reportDefinitionVersion: '1.0.0',
    name: 'Template',
    reportType: 'test',
    slots: [{ templateSlotId: 'slot-metric', sectionId: 'overview', evidenceSlotId: 'metric-slot', contentType: 'metric', anchorKind: 'metric-value', required: true, fixedText: null }],
    page: {},
    styles: {},
    scriptAllowed: false,
    externalDynamicContentAllowed: false,
    immutable: true
  };
  const exactCombination = {
    t019Id: 'T019-1', t019Version: '1.0.0', semanticVersionId: 'ONT-1',
    semanticVersion: '1.0.0', dataVersionId: 'DATA-1', t008: '2026-08-23T23:59:59.000Z',
    c017SummaryId: 'C017-1', c017SummaryVersion: '1.0.0'
  };
  const fixedContext = {
    schemaVersion: m05.M06_FIXED_CONTEXT_SCHEMA_VERSION,
    fixedContextId: 'FCTX-1',
    scenarioContext: CONTEXT,
    exactCombination,
    generationBindingSummary: { summaryId: 'C017-1', version: '1.0.0', formedAt: '2026-08-24T09:00:00.000Z' },
    c008Refs: [], c017Refs: [], gateReadIds: ['G1', 'G2', 'G3'],
    fixedAt: '2026-08-24T09:01:00.000Z',
    immutable: true
  };
  const evidencePack = {
    schemaVersion: m05.EVIDENCE_PACK_SCHEMA_VERSION,
    evidencePackId: 'EP-1',
    version: '1.0.0',
    scenarioContext: CONTEXT,
    definitionRef: 'RDEF-1@1.0.0',
    templateRef: 'RT-1@1.0.0',
    fixedContextId: 'FCTX-1',
    exactCombination,
    generationBindingSummary: fixedContext.generationBindingSummary,
    gateReadIds: fixedContext.gateReadIds,
    items: [{
      evidenceId: 'E-METRIC', version: '1.0.0', evidenceType: 'metric-result',
      evidenceSlotId: 'metric-slot', immutableRef: 'metric://balance/1', sourceOwner: 'M01',
      structuredValue: 100, unit: 'CNY', precision: 2, rounding: 'half-up', objectScope: null,
      semanticRef: { resourceId: 'MET-BALANCE', version: '1.0.0' }, resultRef: null,
      semanticVersionId: 'ONT-1', dataVersionId: 'DATA-1', t008: exactCombination.t008,
      evidenceRefs: ['SRC-1'], fixedAt: '2026-08-24T09:01:00.000Z', accessible: true,
      authorized: true, immutable: true
    }],
    completeness: { status: 'complete', required: 1, missing: 0 },
    fixedAt: '2026-08-24T09:01:00.000Z',
    contentHash: 'hash-1',
    immutable: true
  };
  const objectScope = { objectTypeId: 'GROUP', objectId: 'G-1' };
  const generationScope = { sections: ['overview'] };
  return {
    schemaVersion: m05.C022_SCHEMA_VERSION,
    contractId: 'C022',
    requestId: 'C022-REQ-1',
    scenarioContext: CONTEXT,
    reportContext: { scenarioContext: CONTEXT, reportAggregateId: 'REPORT-1', objectScope, generationScope },
    reportAggregateId: 'REPORT-1',
    definitionRef: { reportDefinitionId: 'RDEF-1', version: '1.0.0' },
    templateRef: { templateId: 'RT-1', version: '1.0.0' },
    reportDefinition: definition,
    template,
    objectScope,
    generationScope,
    evidencePack,
    evidencePackId: 'EP-1',
    evidencePackVersion: '1.0.0',
    fixedContext,
    agentRef: definition.agentRef,
    skillRef: definition.skillRef,
    allowedContentTypes: definition.contentPolicy.allowedContentTypes,
    requestedAt: '2026-08-24T09:02:00.000Z',
    status: 'submitted',
    statusLabel: 'submitted',
    idempotencyKey: 'idem-c022-1',
    immutable: true,
    ...overrides
  };
}

function generationOutput() {
  return {
    runId: 'M05-GEN-RUN-1',
    status: 'completed',
    completedAt: clock(),
    sourceDraftId: 'C023-DRAFT-1',
    version: '1.0.0',
    contentItems: [{
      sourceContentItemId: 'CONTENT-1',
      order: 1,
      templateSlotId: 'slot-metric',
      contentType: 'metric',
      structuredContent: { text: 'Balance is 100 CNY.' },
      evidenceRefs: ['E-METRIC'],
      facts: [{ factId: 'FACT-1', kind: 'metric-result', value: 100, unit: 'CNY', evidenceRefs: ['E-METRIC'], semanticRef: { resourceId: 'MET-BALANCE', version: '1.0.0' } }],
      warnings: []
    }],
    missingSections: [],
    warnings: []
  };
}

function extractionRequest(sourceDraft) {
  const contentItems = sourceDraft.contentItems.map((item) => ({ ...item, sectionId: 'overview' }));
  return {
    schemaVersion: m05.EXTRACTION_REQUEST_SCHEMA_VERSION,
    requestId: 'C024-EXT-1',
    scenarioContext: CONTEXT,
    contentVersionId: 'CV-1',
    contentItems,
    anchors: [{
      schemaVersion: 'ofw.t044.stable-report-anchor.v1', contractId: 'T044', t044Id: 'T044-1',
      reportAggregateId: 'REPORT-1', contentVersionId: 'CV-1', sourceDraftId: sourceDraft.sourceDraftId,
      sourceContentItemId: 'CONTENT-1', sectionId: 'overview', templateSlotId: 'slot-metric',
      anchorKind: 'metric-value', stableLocation: 'overview:slot-metric:CONTENT-1', factRefs: ['FACT-1'],
      evidenceRefs: ['E-METRIC'], bindingVersion: '1.0.0', immutable: true
    }],
    evidencePackRef: { evidencePackId: 'EP-1', version: '1.0.0' },
    fixedContext: { exactCombination: c022().fixedContext.exactCombination, generationBindingSummary: c022().fixedContext.generationBindingSummary },
    purpose: 'claim-extraction-only-no-deterministic-outcome'
  };
}

function runtimeReportContext() {
  return {
    ...CONTEXT,
    reportId: 'REPORT-1',
    contentVersion: 'REPORT-1-v1',
    evidencePackageId: 'EP-1',
    evidencePackageVersion: '1.0.0',
    semanticVersion: 'ONT-1.0.0',
    dataAssetVersion: 'DATA-1',
    dataAsOf: '2026-08-23T23:59:59.000Z',
    anchorSnapshotId: 'ANCHOR-1',
    anchorSnapshotVersion: '1.0.0',
    selectedAnchor: 'section:overview',
    credibilitySummaryRef: { type: 'credibilitySummary', id: 'C017-1', version: '1.0.0', owner: 'M02' },
    permission: { allowed: true }
  };
}

function runtimeReleaseInput() {
  return {
    releaseId: 'REL-REPORT-PORT',
    releaseVersion: '1.0.0',
    status: 'validated',
    agent: { type: 'agent', id: 'AGENT-REPORT', version: '1.0.0' },
    prompt: { type: 'prompt', id: 'PROMPT-REPORT', version: '1.0.0' },
    skills: [{ type: 'skill', id: 'SKILL-REPORT', version: '1.0.0' }],
    tools: [{ type: 'tool', id: 'TOOL-READ', version: '1.0.0' }],
    model: { type: 'model', id: 'MODEL-READ', version: '1.0.0' },
    publishedOntologies: [{ type: 'publishedOntology', id: 'ONT', version: 'ONT-1.0.0', status: 'published' }],
    scenario: { type: 'scenario', id: 'S001', version: 'S001-v1' },
    validity: { validFrom: '2026-01-01T00:00:00.000Z', validTo: '2027-01-01T00:00:00.000Z' },
    resourceWhitelist: [
      { resourceType: 'reportContext', resourceId: 'REPORT-1', resourceVersion: 'REPORT-1-v1', operations: ['read-context'], readOnly: true },
      { resourceType: 'evidence', resourceId: 'EP-1', resourceVersion: '1.0.0', operations: ['read-evidence'], readOnly: true },
      { resourceType: 'publishedOntology', resourceId: 'ONT', resourceVersion: 'ONT-1.0.0', operations: ['read-ontology'], readOnly: true },
      { resourceType: 'credibilitySummary', resourceId: 'C017-1', resourceVersion: '1.0.0', operations: ['read-credibility'], readOnly: true },
      { resourceType: 'answer', resourceId: 'answer-output', resourceVersion: '1.0.0', operations: ['emit-result'], readOnly: true }
    ]
  };
}

function portRelease(overrides = {}) {
  const input = {
    releaseId: 'REL-M06-REPORT-PORT',
    releaseVersion: '1.0.0',
    status: 'validated',
    agent: { type: 'agent', id: 'report-agent', version: '1.0.0' },
    prompt: { type: 'prompt', id: 'report-generation-prompt', version: '1.0.0' },
    skills: [{ type: 'skill', id: 'report-structure', version: '1.0.0' }],
    tools: [{ type: 'tool', id: 'report-evidence-read', version: '1.0.0' }],
    model: { type: 'model', id: 'report-model', version: '1.0.0' },
    publishedOntologies: [{ type: 'publishedOntology', id: 'ONT-1', version: '1.0.0', status: 'published' }],
    scenario: { type: 'scenario', id: 'S001', version: 'S001-v1' },
    validity: { validFrom: '2026-01-01T00:00:00.000Z', validTo: '2027-01-01T00:00:00.000Z' },
    resourceWhitelist: [
      { resourceType: 'evidence', resourceId: 'EP-1', resourceVersion: '1.0.0', operations: ['read-evidence'], readOnly: true },
      { resourceType: 'publishedOntology', resourceId: 'ONT-1', resourceVersion: '1.0.0', operations: ['read-ontology'], readOnly: true }
    ],
    ...overrides
  };
  return m05.publishAgentRelease(m05.createAgentRelease(input, { now: clock() }), { now: clock() });
}

function portOptions(options = {}) {
  return { clock, agentRelease: portRelease(), ...options };
}

function officialC024(overrides = {}) {
  const exactCombination = {
    t019Id: 'T019-1',
    t019Version: '1.0.0',
    semanticVersionId: 'ONT',
    semanticVersion: 'ONT-1.0.0',
    dataVersionId: 'DATA-1',
    t008: '2026-08-23T23:59:59.000Z',
    c017SummaryId: 'C017-1',
    c017SummaryVersion: '1.0.0',
    ...(overrides.exactCombination || {})
  };
  const fixedReportContext = {
    schemaVersion: m05.FIXED_REPORT_CONTEXT_SCHEMA_VERSION,
    fixedContextId: 'C024-FCTX-1',
    version: '1.0.0',
    scenarioContext: CONTEXT,
    reportRef: { reportId: 'REPORT-1', reportNumber: 'REPORT-001', artifactVersion: '1.0.0', contentVersionId: 'REPORT-1-v1', generationRunId: 'M05-GENERATION-RUN-1' },
    definitionRef: { reportDefinitionId: 'RDEF-1', version: '1.0.0' },
    templateRef: { templateId: 'RT-1', version: '1.0.0' },
    evidencePackRef: { evidencePackId: 'EP-1', version: '1.0.0' },
    anchorSnapshot: {
      anchorSnapshotId: 'ANCHOR-SNAPSHOT-1',
      version: 'REPORT-1-v1',
      selectionScope: 'whole-report',
      anchors: [{ t044Id: 'T044-1', anchorKind: 'metric-value', sectionId: 'overview', stableLocation: 'overview:slot-metric:CONTENT-1', evidenceRefs: ['E-METRIC'] }]
    },
    exactCombination,
    c017Ref: { summaryId: 'C017-1', version: '1.0.0', formedAt: '2026-08-24T09:00:00.000Z' },
    semanticEvidenceRefs: [],
    authorizationRef: { decisionId: 'AUTH-C024-1', version: '1.0.0', status: 'allowed', decidedAt: '2026-08-24T09:01:00.000Z', scopeRef: 'REPORT-1@REPORT-1-v1' },
    agentReleaseRef: { agentId: 'AGENT-REPORT', version: '1.0.0' },
    deterministicResultRef: null,
    allowedEvidenceRefs: ['E-METRIC'],
    immutable: true,
    ...(overrides.fixedReportContext || {})
  };
  const purpose = overrides.purpose || 'report-question';
  const question = overrides.question || 'Explain the fixed report evidence.';
  const requestFingerprint = sha256({
    fixedContextId: fixedReportContext.fixedContextId,
    purpose,
    question,
    agentReleaseRef: fixedReportContext.agentReleaseRef,
    deterministicResultRef: fixedReportContext.deterministicResultRef
  });
  const payload = {
    schemaVersion: m05.REPORT_COPILOT_C024_SCHEMA_VERSION,
    contractId: 'C024',
    requestId: overrides.requestId || 'C024-OFFICIAL-1',
    requestFingerprint,
    scenarioContext: CONTEXT,
    fixedReportContext,
    selectionIntent: { purpose, selectionScope: fixedReportContext.anchorSnapshot.selectionScope, question },
    agentReleaseRef: fixedReportContext.agentReleaseRef,
    requestedBy: 'reader-1',
    requestedAt: '2026-08-24T09:02:00.000Z',
    immutable: true
  };
  return foundationContracts.assertContractEnvelope({
    eventId: `M06-C024-${payload.requestId}`,
    eventType: overrides.eventType || m05.REPORT_COPILOT_REQUEST_EVENT_TYPE,
    schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
    occurredAt: payload.requestedAt,
    actorRef: payload.requestedBy,
    correlationId: `CORR-${payload.requestId}`,
    traceId: `TRACE-${payload.requestId}`,
    idempotencyKey: `idem-v1:${requestFingerprint}`,
    scenarioContext: CONTEXT,
    resourceRefs: [],
    evidenceRefs: ['E-METRIC'],
    payload
  }, { allowUnknown: false, enforcePrefix: true });
}

function officialC017() {
  return {
    summaryId: 'C017-1',
    summaryVersion: '1.0.0',
    formedAt: '2026-08-24T09:00:00.000Z',
    status: 'passed',
    freshness: { status: 'fresh' },
    semanticVersionId: 'ONT',
    dataVersionId: 'DATA-1',
    dataAssetVersion: 'DATA-1',
    t008: '2026-08-23T23:59:59.000Z',
    scenarioContext: CONTEXT,
    owner: 'M02'
  };
}

function officialM06C017() {
  return {
    summaryId: 'C017-1',
    version: '1.0.0',
    summaryType: 'generation-binding',
    formedAt: '2026-08-24T09:00:00.000Z',
    status: 'ready',
    scenarioContext: CONTEXT,
    authoritativeRead: { receiptId: 'C017-READ-1', owner: 'M02', source: 'owner-api', mode: 'live-owner-read', readAt: clock(), static: false },
    consumptionReadiness: { status: 'ready' },
    binding: { semanticVersionId: 'ONT', semanticVersion: 'ONT-1.0.0', dataVersionId: 'DATA-1', t008: '2026-08-23T23:59:59.000Z' },
    quality: { status: 'pass', hardFailure: false, affectedScope: null },
    freshness: { status: 'fresh' },
    reproducibility: { replayVerification: 'consistent' }
  };
}

function officialRead(c024Envelope, c025Envelope, overrides = {}) {
  const { eventType = m05.REPORT_COPILOT_READ_EVENT_TYPE, ...payloadOverrides } = overrides;
  const refs = c025Envelope ? m05.formalChainRefs(c025Envelope) : { bindingRef: null, sessionRef: null, runRef: null, resultRef: null };
  const idempotencyKey = `idem-v1:${sha256({ operation: 'C025-read', requestId: c024Envelope.payload.requestId })}`;
  const payload = {
    schemaVersion: m05.REPORT_COPILOT_READ_SCHEMA_VERSION,
    requestId: c024Envelope.payload.requestId,
    idempotencyKey,
    sourceIdempotencyKey: c024Envelope.idempotencyKey,
    scenarioContext: CONTEXT,
    fixedContextRef: { id: c024Envelope.payload.fixedReportContext.fixedContextId, version: c024Envelope.payload.fixedReportContext.version },
    ...refs,
    requestedAt: clock(),
    ...payloadOverrides
  };
  return foundationContracts.assertContractEnvelope({
    eventId: `M06-C025-READ-${payload.requestId}`,
    eventType,
    schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
    occurredAt: payload.requestedAt,
    actorRef: 'reader-1',
    correlationId: c024Envelope.correlationId,
    traceId: c024Envelope.traceId,
    idempotencyKey,
    scenarioContext: CONTEXT,
    resourceRefs: [],
    evidenceRefs: [],
    payload
  }, { allowUnknown: false, enforcePrefix: true });
}

test('real M06 port validates C022, stores one immutable C023 and resumes it', async () => {
  let calls = 0;
  const modelGateway = { invoke: async () => ({ output: {} }) };
  const toolGateway = { invoke: async () => ({ output: {} }) };
  const port = m05.createM06ReportPort(portOptions({
    modelGateway,
    toolGateway,
    generationRunner: async ({ c022: input, fixedInput, agentRelease, modelGateway: injectedModelGateway, toolGateway: injectedToolGateway, readOnly, sideEffectsSuppressed }) => {
      calls += 1;
      assert.equal(input.schemaVersion, m05.C022_SCHEMA_VERSION);
      assert.equal(Object.isFrozen(fixedInput), true);
      assert.equal(agentRelease.releaseVersion, input.agentRef.releaseVersion);
      assert.equal(injectedModelGateway, modelGateway);
      assert.equal(injectedToolGateway, toolGateway);
      assert.equal(readOnly, true);
      assert.equal(sideEffectsSuppressed, true);
      return generationOutput();
    }
  }));
  const input = c022();
  assert.equal(m05.validateC022Request(input).valid, true);
  const first = await port.submitReportGeneration(input);
  const duplicate = await port.submitReportGeneration(input);
  assert.equal(calls, 1);
  assert.deepEqual(first, duplicate);
  assert.equal(first.schemaVersion, m05.C023_SCHEMA_VERSION);
  assert.equal(first.generationRun.agentId, input.agentRef.agentId);
  assert.equal(first.generationRun.releaseVersion, input.agentRef.releaseVersion);
  assert.equal(Object.hasOwn(first.contentItems[0], 'sectionId'), false);
  assert.equal(Object.hasOwn(first, 't044'), false);
  assert.deepEqual(port.readReportGeneration({ requestId: input.requestId, scenarioContext: CONTEXT }), first);
  await assert.rejects(() => port.submitReportGeneration({ ...input, requestedAt: '2026-08-24T09:03:00.000Z' }), (error) => error.code === 'C022_IDEMPOTENCY_CONFLICT');
  assert.throws(() => port.readReportGeneration({ requestId: input.requestId, scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-other' } }), (error) => error.code === 'CONTEXT_MISMATCH');

  let mismatchedCalls = 0;
  const mismatchedReleasePort = m05.createM06ReportPort(portOptions({
    agentRelease: portRelease({ agent: { type: 'agent', id: 'other-agent', version: '1.0.0' } }),
    generationRunner: async () => { mismatchedCalls += 1; return generationOutput(); }
  }));
  await assert.rejects(() => mismatchedReleasePort.submitReportGeneration(c022()), (error) => error.code === 'AGENT_RELEASE_MISMATCH');
  assert.equal(mismatchedCalls, 0);

  const unauthorized = c022();
  unauthorized.evidencePack = { ...unauthorized.evidencePack, items: [{ ...unauthorized.evidencePack.items[0], authorized: false }] };
  assert.equal(m05.validateC022Request(unauthorized).valid, false);
  const rawInput = c022();
  rawInput.evidencePack = { ...rawInput.evidencePack, items: [{ ...rawInput.evidencePack.items[0], structuredValue: { workbookPath: '/tmp/input.xlsx' } }] };
  assert.equal(m05.validateC022Request(rawInput).valid, false);
});

test('generation pending and unknown outcomes fail closed without implicit resubmit', async () => {
  let finish;
  const pendingPort = m05.createM06ReportPort(portOptions({
    generationRunner: () => new Promise((resolve) => { finish = resolve; })
  }));
  const pending = pendingPort.submitReportGeneration(c022());
  await Promise.resolve();
  assert.throws(() => pendingPort.readReportGeneration({ requestId: 'C022-REQ-1', scenarioContext: CONTEXT }), (error) => error.code === 'REPORT_GENERATION_PENDING');
  finish(generationOutput());
  await pending;

  const unknownPort = m05.createM06ReportPort(portOptions({ generationRunner: async () => undefined }));
  await assert.rejects(() => unknownPort.submitReportGeneration(c022()), (error) => error.code === 'REPORT_GENERATION_EXECUTION_UNKNOWN');
  assert.throws(() => unknownPort.readReportGeneration({ requestId: 'C022-REQ-1', scenarioContext: CONTEXT }), (error) => error.code === 'REPORT_GENERATION_EXECUTION_UNKNOWN');

  const invalidStatusPort = m05.createM06ReportPort(portOptions({ generationRunner: async () => ({ ...generationOutput(), status: '' }) }));
  await assert.rejects(() => invalidStatusPort.submitReportGeneration(c022()), (error) => error.code === 'REPORT_GENERATION_EXECUTION_UNKNOWN');

  const timeoutPort = m05.createM06ReportPort(portOptions({ executionTimeoutMs: 5, generationRunner: () => new Promise(() => {}) }));
  await assert.rejects(() => timeoutPort.submitReportGeneration(c022()), (error) => error.code === 'TIMEOUT');
  assert.throws(() => timeoutPort.readReportGeneration({ requestId: 'C022-REQ-1', scenarioContext: CONTEXT }), (error) => error.code === 'REPORT_GENERATION_EXECUTION_UNKNOWN');
});

test('claim extraction binds current content/T044/evidence without deterministic outcomes', async () => {
  const sourceDraft = {
    schemaVersion: m05.C023_SCHEMA_VERSION,
    sourceDraftId: 'C023-DRAFT-1',
    ...generationOutput()
  };
  let calls = 0;
  const port = m05.createM06ReportPort(portOptions({
    extractionRunner: async ({ fixedInput, deterministicOutcomeAllowed }) => {
      calls += 1;
      assert.equal(Object.isFrozen(fixedInput), true);
      assert.equal(deterministicOutcomeAllowed, false);
      return {
        claims: [{ sourceContentItemId: 'CONTENT-1', factId: 'FACT-1', t044Id: 'T044-1', observedValue: 100, observedUnit: 'CNY', evidenceRefs: ['E-METRIC'], semanticRef: { resourceId: 'MET-BALANCE', version: '1.0.0' } }],
        completedAt: clock()
      };
    }
  }));
  const request = extractionRequest(sourceDraft);
  assert.equal(m05.validateExtractionRequest(request).valid, true);
  const first = await port.extractReportClaims(request);
  const duplicate = await port.extractReportClaims(request);
  assert.equal(calls, 1);
  assert.deepEqual(first, duplicate);
  assert.equal(first.schemaVersion, m05.EXTRACTION_RESULT_SCHEMA_VERSION);
  assert.equal(first.status, 'completed');
  assert.equal(first.claims[0].t044Id, 'T044-1');
  assert.equal(Object.hasOwn(first.claims[0], 'verificationStatus'), false);
  assert.equal(Object.hasOwn(first, 't049'), false);
});

test('claim extraction rejects decision fields and out-of-binding evidence', async () => {
  const sourceDraft = { schemaVersion: m05.C023_SCHEMA_VERSION, sourceDraftId: 'C023-DRAFT-1', ...generationOutput() };
  const request = extractionRequest(sourceDraft);
  const wrongAnchor = { ...request, anchors: [{ ...request.anchors[0], schemaVersion: 'unknown', factRefs: [] }] };
  assert.equal(m05.validateExtractionRequest(wrongAnchor).valid, false);
  const decisionPort = m05.createM06ReportPort(portOptions({
    extractionRunner: async () => ({ claims: [{ sourceContentItemId: 'CONTENT-1', factId: 'FACT-1', t044Id: 'T044-1', observedValue: 100, evidenceRefs: ['E-METRIC'], verificationStatus: 'pass' }] })
  }));
  await assert.rejects(() => decisionPort.extractReportClaims(request), (error) => error.code === 'EXTRACTION_OUTPUT_INVALID');

  const evidencePort = m05.createM06ReportPort(portOptions({
    extractionRunner: async () => ({ claims: [{ sourceContentItemId: 'CONTENT-1', factId: 'FACT-1', t044Id: 'T044-1', observedValue: 100, evidenceRefs: ['OUTSIDE'] }] })
  }));
  await assert.rejects(() => evidencePort.extractReportClaims(request), (error) => error.code === 'EXTRACTION_OUTPUT_INVALID');

  const duplicatePort = m05.createM06ReportPort(portOptions({
    extractionRunner: async () => ({ claims: [
      { claimId: 'CLAIM-1', sourceContentItemId: 'CONTENT-1', factId: 'FACT-1', t044Id: 'T044-1', observedValue: 100, evidenceRefs: ['E-METRIC'] },
      { claimId: 'CLAIM-2', sourceContentItemId: 'CONTENT-1', factId: 'FACT-1', t044Id: 'T044-1', observedValue: 101, evidenceRefs: ['E-METRIC'] }
    ] })
  }));
  await assert.rejects(() => duplicatePort.extractReportClaims(request), (error) => error.code === 'EXTRACTION_OUTPUT_INVALID');
});

test('report port can return strict Foundation envelopes for M06 production mode', async () => {
  const port = m05.createM06ReportPort(portOptions({
    generationRunner: async () => generationOutput(),
    responseEnvelope: { generationEventType: 'M05.C023', extractionEventType: 'M05.EXTRACTION', actorRef: 'M05' }
  }));
  const response = await port.submitReportGeneration(c022());
  assert.equal(foundationContracts.validateContractEnvelope(response, { allowUnknown: false }).valid, true);
  assert.equal(response.payload.schemaVersion, m05.C023_SCHEMA_VERSION);
  assert.equal(response.scenarioContext.scenarioRunId, CONTEXT.scenarioRunId);
  assert.deepEqual(port.readReportGeneration({ requestId: 'C022-REQ-1', scenarioContext: CONTEXT }), response);
});

test('report port delegates Foundation C024 and C025 reads to a real M05Runtime', async () => {
  const release = m05.publishAgentRelease(m05.createAgentRelease(runtimeReleaseInput(), { now: clock() }), { now: clock() });
  const runtime = m05.createM05Runtime({
    clock,
    release,
    models: [{
      id: 'MODEL-READ',
      version: '1.0.0',
      execute: async () => ({ output: { answer: 'Fixed evidence explanation', evidenceRefs: [{ id: 'EP-1' }] } })
    }]
  });
  const port = m05.createM06ReportPort({ runtime });
  const reportContext = runtimeReportContext();
  const payload = {
    requestId: 'C024-RUNTIME-1',
    idempotencyKey: 'idem-c024-runtime-1',
    question: 'Explain the fixed evidence',
    reportContext,
    credibilitySummary: { summaryId: 'C017-1', summaryVersion: '1.0.0', status: 'passed', dataAssetVersion: 'DATA-1', freshness: { status: 'fresh' } },
    permission: { allowed: true }
  };
  const envelope = {
    eventId: 'M06-C024-EVENT-1',
    eventType: 'M06.C024',
    schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
    occurredAt: clock(),
    actorRef: 'M06',
    correlationId: 'CORR-C024-RUNTIME-1',
    traceId: 'TRACE-C024-RUNTIME-1',
    idempotencyKey: payload.idempotencyKey,
    scenarioContext: CONTEXT,
    resourceRefs: [],
    evidenceRefs: [],
    payload
  };

  const received = port.receiveEnvelope(envelope, { expectedEventType: 'M06.C024' });
  assert.equal(received.requestId, payload.requestId);
  const c025 = await runtime.answer(received.requestId, { actor: { roles: ['operator'] }, at: clock() });
  assert.equal(c025.schemaVersion, m05.C025_SCHEMA_VERSION);
  assert.deepEqual(port.readC025Result(c025.resultId), c025);
  assert.deepEqual(port.receiveEnvelope(envelope, { expectedEventType: 'M06.C024' }), received);
});

test('official report copilot bridge receives, runs and reads one real Runtime chain', async () => {
  let modelCalls = 0;
  const release = m05.publishAgentRelease(m05.createAgentRelease(runtimeReleaseInput(), { now: clock() }), { now: clock() });
  const runtime = m05.createM05Runtime({
    clock,
    release,
    models: [{
      id: 'MODEL-READ',
      version: '1.0.0',
      execute: async () => {
        modelCalls += 1;
        return { output: { answer: 'Fixed evidence explanation', anchors: ['T044-1'], evidenceRefs: [{ id: 'E-METRIC' }], limitations: ['Reference-only answer'] } };
      }
    }]
  });
  const port = m05.createM06ReportPort({
    runtime,
    clock,
    c017Resolver: async () => officialM06C017(),
    copilotActor: { id: 'reader-1', roles: ['operator'], scenarioIds: ['S001'] }
  });
  const requestEnvelope = officialC024({ eventType: m05.M06_CURRENT_REQUEST_EVENT_TYPE });
  const [receipt, concurrentReceipt] = await Promise.all([
    port.receiveReportCopilotRequest(requestEnvelope),
    port.receiveReportCopilotRequest(requestEnvelope)
  ]);
  assert.deepEqual(concurrentReceipt, receipt);
  assert.equal(receipt.eventType, m05.REPORT_COPILOT_RECEIPT_EVENT_TYPE);
  assert.equal(receipt.payload.schemaVersion, m05.REPORT_COPILOT_RECEIPT_SCHEMA_VERSION);
  assert.equal(receipt.payload.fixedContextRef.id, requestEnvelope.payload.fixedReportContext.fixedContextId);

  const [formal, concurrentFormal] = await Promise.all([
    port.runReportCopilot(requestEnvelope, receipt),
    port.runReportCopilot(requestEnvelope, receipt)
  ]);
  assert.deepEqual(concurrentFormal, formal);
  assert.equal(formal.eventType, m05.REPORT_COPILOT_RESULT_EVENT_TYPE);
  assert.equal(formal.payload.schemaVersion, m05.REPORT_COPILOT_C025_SCHEMA_VERSION);
  assert.equal(formal.payload.result.type, 'report-copilot-answer');
  assert.equal(Object.hasOwn(formal.payload.result, 'answer'), false);
  assert.equal(formal.payload.reportRef.contentVersionId, 'REPORT-1-v1');
  assert.equal(formal.payload.evidencePackRef.evidencePackId, 'EP-1');
  assert.equal(formal.payload.result.anchorRefs[0], 'T044-1');
  assert.equal(formal.payload.result.evidenceRefs[0], 'E-METRIC');
  assert.equal(formal.payload.exactCombination.dataVersionId, 'DATA-1');
  assert.equal(formal.payload.agentReleaseRef.version, release.releaseVersion);
  assert.equal(modelCalls, 1);
  assert.equal(runtime.store.current().bindings.length, 1);
  assert.equal(runtime.store.current().sessions.length, 1);
  assert.equal(runtime.store.current().runs.length, 1);
  assert.equal(runtime.store.current().results.length, 1);
  const internalDraft = runtime.store.getResult(formal.payload.result.resultId);
  assert.equal(internalDraft.schemaVersion, m05.C025_SCHEMA_VERSION);
  assert.equal(internalDraft.resultType, 'answer');
  assert.notEqual(internalDraft.schemaVersion, formal.payload.schemaVersion);

  const readEnvelope = officialRead(requestEnvelope, formal, { eventType: m05.M06_CURRENT_READ_EVENT_TYPE });
  assert.deepEqual(await port.readReportCopilotResult(readEnvelope), formal);
  assert.deepEqual(await port.receiveReportCopilotRequest(requestEnvelope), receipt);
  assert.deepEqual(await port.runReportCopilot(requestEnvelope, receipt), formal);
  assert.deepEqual(await port.readReportCopilotResult(readEnvelope), formal);
  assert.equal(modelCalls, 1);
  assert.equal(runtime.store.current().runs.length, 1);
  assert.equal(port.store.snapshot().copilot.length, 1);

  const currentM06Spelling = officialC024({ requestId: 'C024-CURRENT-M06-EVENT', eventType: m05.M06_CURRENT_REQUEST_EVENT_TYPE });
  assert.equal(m05.assertC024Envelope(currentM06Spelling).payload.requestId, 'C024-CURRENT-M06-EVENT');
  assert.equal(m05.assertC024Envelope(officialC024({ requestId: 'C024-DISPATCH-EVENT' })).payload.requestId, 'C024-DISPATCH-EVENT');
});

test('official report copilot bridge rejects mismatches without creating another Run', async () => {
  const release = m05.publishAgentRelease(m05.createAgentRelease(runtimeReleaseInput(), { now: clock() }), { now: clock() });
  const runtime = m05.createM05Runtime({
    clock,
    release,
    models: [{ id: 'MODEL-READ', version: '1.0.0', execute: async () => ({ output: { answer: 'ok', anchors: ['T044-1'], evidenceRefs: [{ id: 'E-METRIC' }] } }) }]
  });
  const noC017Port = m05.createM06ReportPort({ runtime, clock, copilotActor: { roles: ['operator'] } });
  await assert.rejects(() => noC017Port.receiveReportCopilotRequest(officialC024()), (error) => error.code === 'REPORT_COPILOT_C017_RESOLVER_REQUIRED');

  const port = m05.createM06ReportPort({ runtime, clock, c017Resolver: async () => officialC017(), copilotActor: { roles: ['operator'] } });
  const requestEnvelope = officialC024();
  const receipt = await port.receiveReportCopilotRequest(requestEnvelope);
  const badReceipt = JSON.parse(JSON.stringify(receipt));
  badReceipt.payload.fixedContextRef.id = 'OTHER-CONTEXT';
  await assert.rejects(() => port.runReportCopilot(requestEnvelope, badReceipt), (error) => error.code === 'REPORT_COPILOT_RECEIPT_MISMATCH');
  assert.equal(runtime.store.current().runs.length, 0);

  const formal = await port.runReportCopilot(requestEnvelope, receipt);
  const conflicting = officialC024({ exactCombination: { dataVersionId: 'DATA-OTHER' } });
  await assert.rejects(() => port.receiveReportCopilotRequest(conflicting), (error) => error.code === 'REPORT_COPILOT_IDEMPOTENCY_CONFLICT');
  const badRead = officialRead(requestEnvelope, formal, { resultRef: { ...m05.formalChainRefs(formal).resultRef, id: 'RESULT-OTHER' } });
  await assert.rejects(() => port.readReportCopilotResult(badRead), (error) => error.code === 'REPORT_COPILOT_READ_MISMATCH');
  assert.equal(runtime.store.current().runs.length, 1);

  const unknownEvent = JSON.parse(JSON.stringify(officialC024({ requestId: 'C024-UNKNOWN-EVENT' })));
  unknownEvent.eventType = 'M06.C024.Future';
  await assert.rejects(() => port.receiveReportCopilotRequest(unknownEvent), (error) => error.code === 'REPORT_COPILOT_EVENT_MISMATCH');
});

test('official T049 explanation resolves the real deterministic result without reclassification', async () => {
  const deterministicResultRef = {
    type: 'T049',
    id: 'T049-RUN-1',
    version: '1.0.0',
    status: 'warning',
    currentStatusSummaryRef: { summaryId: 'C017-CURRENT-1', version: '1.0.0', formedAt: '2026-08-24T09:03:00.000Z', readReceiptId: 'C017-READ-CURRENT-1' }
  };
  const t049 = {
    schemaVersion: 'ofw.t049.deterministic-report-verification.v1',
    contractId: 'T049',
    verificationRunId: 'T049-RUN-1',
    verificationResultId: 'T049-RESULT-1',
    version: '1.0.0',
    scenarioContext: CONTEXT,
    contentVersionId: 'REPORT-1-v1',
    evidencePackRef: { evidencePackId: 'EP-1', version: '1.0.0' },
    runStatus: 'completed',
    status: 'warning',
    results: [{ resultId: 'T049-CHECK-1', status: 'warning' }]
  };
  const requestEnvelope = officialC024({
    requestId: 'C024-T049-EXPLANATION',
    purpose: 't049-explanation',
    question: 'Explain the fixed T049 result without changing its status.',
    fixedReportContext: { deterministicResultRef }
  });
  const release = m05.publishAgentRelease(m05.createAgentRelease(runtimeReleaseInput(), { now: clock() }), { now: clock() });
  const runtime = m05.createM05Runtime({
    clock,
    release,
    models: [{ id: 'MODEL-READ', version: '1.0.0', execute: async () => ({ output: { explanation: 'The supplied warning remains a warning.', anchors: ['T044-1'], evidenceRefs: [{ id: 'E-METRIC' }] } }) }]
  });
  const port = m05.createM06ReportPort({
    runtime,
    clock,
    c017Resolver: async () => officialM06C017(),
    verificationResolver: async () => t049,
    copilotActor: { roles: ['operator'] }
  });
  const receipt = await port.receiveReportCopilotRequest(requestEnvelope);
  const formal = await port.runReportCopilot(requestEnvelope, receipt);
  assert.equal(formal.payload.result.type, 'report-copilot-explanation');
  assert.deepEqual(formal.payload.deterministicResultRef, deterministicResultRef);
  const internal = runtime.store.getResult(formal.payload.result.resultId);
  assert.equal(internal.resultType, 'verification-explanation');
  assert.equal(internal.verificationStatus, 'warning');
  assert.equal(internal.checks[0].status, 'warning');
});

test('official report copilot failed and unknown executions remain fail closed', async () => {
  const createFailureHarness = (mode) => {
    let calls = 0;
    const release = m05.publishAgentRelease(m05.createAgentRelease(runtimeReleaseInput(), { now: clock() }), { now: clock() });
    const runtime = m05.createM05Runtime({
      clock,
      release,
      policy: { timeoutMs: 5, maxAttempts: 1, backoffMs: 0 },
      models: [{
        id: 'MODEL-READ',
        version: '1.0.0',
        execute: async () => {
          calls += 1;
          if (mode === 'unknown') return new Promise(() => {});
          const error = new Error('model failed');
          error.code = 'MODEL_FAILED';
          throw error;
        }
      }]
    });
    const port = m05.createM06ReportPort({ runtime, clock, executionTimeoutMs: 50, c017Resolver: async () => officialC017(), copilotActor: { roles: ['operator'] } });
    return { runtime, port, calls: () => calls };
  };

  for (const mode of ['failed', 'unknown']) {
    const harness = createFailureHarness(mode);
    const requestEnvelope = officialC024({ requestId: `C024-${mode.toUpperCase()}` });
    const receipt = await harness.port.receiveReportCopilotRequest(requestEnvelope);
    await assert.rejects(() => harness.port.runReportCopilot(requestEnvelope, receipt), (error) => mode === 'unknown' ? error.code === 'TIMEOUT' : error.code === 'MODEL_FAILED');
    const record = harness.port.store.getCopilot(requestEnvelope.payload.requestId);
    assert.equal(record.status, mode);
    await assert.rejects(() => harness.port.runReportCopilot(requestEnvelope, receipt), (error) => error.code === (mode === 'unknown' ? 'REPORT_COPILOT_EXECUTION_UNKNOWN' : 'REPORT_COPILOT_FAILED'));
    await assert.rejects(() => harness.port.readReportCopilotResult(officialRead(requestEnvelope, null)), (error) => error.code === (mode === 'unknown' ? 'REPORT_COPILOT_EXECUTION_UNKNOWN' : 'REPORT_COPILOT_FAILED'));
    assert.equal(harness.calls(), 1);
    assert.equal(harness.runtime.store.current().runs.length, 1);
    assert.equal(harness.runtime.store.current().results.length, 0);
  }
});
