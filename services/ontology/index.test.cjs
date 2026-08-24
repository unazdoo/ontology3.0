'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const identity = require('../../packages/identity');
const ontology = require('./index.js');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-M01-TEST',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

let timeCounter = 1;
function clock() {
  return new Date(Date.parse('2026-08-24T00:00:00.000Z') + timeCounter++ * 1000).toISOString();
}

function digest(value) {
  return crypto.createHash('sha256').update(identity.stableSerialize(value), 'utf8').digest('hex');
}

function delivery(overrides = {}) {
  const members = [
    ['FIN-MEMBER-SUBJECT', 'subject', 'f1'],
    ['FIN-MEMBER-DETAIL', 'detail', 'f2'],
    ['FIN-MEMBER-INSTITUTION', 'institution', 'f3'],
    ['FIN-MEMBER-OWNER', 'owner', 'f4']
  ].map(([id, name, fieldId]) => ({
    id,
    name,
    grain: 'one row per entity',
    rowCount: 1,
    primaryKey: fieldId,
    qualityStatus: 'passed',
    fields: [{ id: fieldId, name: `${name}-id`, dataType: 'text' }]
  }));
  const relations = [
    ['FIN-REL-DETAIL-SUBJECT', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-SUBJECT'],
    ['FIN-REL-DETAIL-INSTITUTION', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-INSTITUTION'],
    ['FIN-REL-SUBJECT-OWNER', 'FIN-MEMBER-SUBJECT', 'FIN-MEMBER-OWNER']
  ].map(([id, sourceMemberId, targetMemberId], index) => ({
    id,
    name: id,
    sourceMemberId,
    targetMemberId,
    sourceFieldId: `f${index === 0 ? 2 : index === 1 ? 2 : 1}`,
    targetFieldId: `f${index === 0 ? 1 : index === 1 ? 3 : 4}`,
    endpointCheckStatus: 'passed'
  }));
  const payload = {
    deliveryId: 'C003-S001-DATA-v1',
    deliveryStatus: 'delivered',
    deliveredAt: '2026-08-24T00:00:01.000Z',
    sourceModule: 'M02',
    t006Id: 'T006-FINANCE',
    t007Version: 'T007-FINANCE-v1',
    t007Immutable: true,
    publicationState: 'published',
    publishedAt: '2026-08-24T00:00:01.000Z',
    t008: { asOf: '2026-08-23', evidenceRef: 'T008-S001-v1' },
    sourceFingerprint: { algorithm: 'SHA-256', value: 'a'.repeat(64), sizeBytes: 2048 },
    expectedScope: {
      memberIds: members.map((item) => item.id),
      relationIds: relations.map((item) => item.id)
    },
    members,
    relations,
    qualitySummary: { status: 'passed', evidenceRef: 'T005-S001-v1' },
    lineage: { status: 'passed', nodes: ['T002-S001-v1', 'T003-S001-v1', 'T004-S001-v1'], evidenceRef: 'LINEAGE-S001-v1' },
    ...overrides
  };
  delete payload.integrity;
  payload.integrity = { algorithm: 'SHA-256', digest: digest(payload) };
  return { ...payload, contractCode: 'C003', scenarioContext: CONTEXT };
}

function makeService() {
  timeCounter = 1;
  return ontology.createOntologyService({
    scenarioContext: CONTEXT,
    ontologyId: 'ONT-S001-FINANCE',
    clock
  });
}

function buildPublished(service) {
  const receipt = service.receiveC003(delivery());
  assert.equal(receipt.status, 'accepted');
  const draft = service.readDraft({ scenarioContext: CONTEXT, draftId: receipt.targetDraftId });
  const content = {
    ontologyId: 'ONT-S001-FINANCE',
    name: 'S001 finance ontology',
    description: 'Stable semantic definitions for the S001 financing workflow.',
    sourceMappingVersion: 'MAPPING-S001-v1',
    mapping: {
      memberIds: ['FIN-MEMBER-SUBJECT', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-INSTITUTION', 'FIN-MEMBER-OWNER'],
      relationIds: ['FIN-REL-DETAIL-SUBJECT', 'FIN-REL-DETAIL-INSTITUTION', 'FIN-REL-SUBJECT-OWNER']
    },
    resources: [
      { id: 'OBJ-FINANCE-SUBJECT', type: 'ObjectType', name: 'Financing subject', definition: 'A financing business subject.' },
      { id: 'PROP-SUBJECT-ID', type: 'Property', name: 'Subject id', definition: 'Stable subject identity.', objectTypeId: 'OBJ-FINANCE-SUBJECT' },
      { id: 'MET-FINANCE-BALANCE', type: 'Metric', name: 'Financing balance', definition: 'Published financing balance.', dependencyIds: ['PROP-SUBJECT-ID'], unit: 'CNY' },
      { id: 'RULE-HIGH-COST', type: 'Rule', name: 'High cost', definition: 'Published high cost rule.', dependencyIds: ['MET-FINANCE-BALANCE'] },
      { id: 'ACTION-OPTIMIZE', type: 'ActionType', name: 'Optimize financing', definition: 'Published optimization action.', targetObjectTypeId: 'OBJ-FINANCE-SUBJECT' }
    ]
  };
  service.saveDraft({ scenarioContext: CONTEXT, draftId: draft.draftId, expectedContentRevision: 1, content });
  const validation = service.validateDraft({ scenarioContext: CONTEXT, draftId: draft.draftId, expectedContentRevision: 2 });
  assert.equal(validation.status, 'passed');
  return service.publishDraft({ scenarioContext: CONTEXT, draftId: draft.draftId, expectedContentRevision: 2, semanticVersion: 'S001-ONTO-v1' });
}

function buildTargetAndRequest(service, published) {
  service.createRefreshTarget({
    scenarioContext: CONTEXT,
    t054Id: 'T054-S001-FINANCE',
    bindingVersion: '1',
    publishedId: published.publishedId,
    t017Id: published.t017Id,
    t006Id: 'T006-FINANCE',
    sourceMappingVersion: 'MAPPING-S001-v1',
    coverage: {
      memberIds: ['FIN-MEMBER-SUBJECT', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-INSTITUTION', 'FIN-MEMBER-OWNER'],
      relationIds: ['FIN-REL-DETAIL-SUBJECT', 'FIN-REL-DETAIL-INSTITUTION', 'FIN-REL-SUBJECT-OWNER']
    },
    ownerRef: 'M01-owner',
    verifiedAt: '2026-08-24T00:00:10.000Z',
    evidenceRefs: ['T054-EVIDENCE-S001']
  });
  const discovery = service.discoverC032({ scenarioContext: CONTEXT, assetId: 'T006-FINANCE', requester: 'm02' });
  assert.equal(discovery.status, 'available');
  const request = service.submitC028({
    requestId: 'C028-S001-1',
    scenarioContext: CONTEXT,
    t006Id: 'T006-FINANCE',
    t007Version: 'T007-FINANCE-v1',
    t008AsOf: '2026-08-23',
    deliveryId: 'C003-S001-DATA-v1',
    target: discovery.candidates[0],
    discovery,
    existingT019Snapshot: { t019Revision: 0, combinationId: null }
  });
  assert.equal(request.status, 'accepted');
  return { discovery, request };
}

test('initial C008 is an honest empty projection', () => {
  const service = makeService();
  const projection = service.readC008({ scenarioContext: CONTEXT });
  assert.equal(projection.readStatus, 'empty');
  assert.equal(projection.current, null);
  assert.equal(projection.previousTrusted, null);
  assert.equal(projection.scenarioContext.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(projection.readOnly, true);
});

test('C003 accepts one exact same-context delivery and is idempotent', () => {
  const service = makeService();
  const first = service.receiveC003(delivery());
  const duplicate = service.receiveC003(delivery());
  assert.equal(first.status, 'accepted');
  assert.equal(duplicate.status, 'accepted');
  assert.equal(duplicate.duplicate, true);
  assert.equal(service.listDrafts({ scenarioContext: CONTEXT }).length, 1);
});

test('C003 accepts the Foundation versioned envelope without inferring C033', () => {
  const service = makeService();
  const canonical = delivery();
  delete canonical.contractCode;
  delete canonical.scenarioContext;
  const receipt = service.receiveC003({
    eventId: 'EV-C003-S001-1',
    eventType: ontology.EVENT_TYPES.C003_DELIVERY,
    schemaVersion: ontology.SCHEMA_VERSIONS.C003,
    occurredAt: '2026-08-24T00:00:01.000Z',
    actorRef: 'M02',
    correlationId: 'CORR-C003-S001-1',
    traceId: 'TRACE-C003-S001-1',
    idempotencyKey: 'C003-S001-IDEM-1',
    scenarioContext: CONTEXT,
    resourceRefs: [],
    evidenceRefs: [],
    payload: canonical
  });
  assert.equal(receipt.status, 'accepted');
  assert.deepEqual(receipt.scenarioContext, CONTEXT);
});

test('Foundation Envelope compatibility and strict unknown-field policy fail closed', () => {
  const service = makeService();
  const canonical = delivery();
  delete canonical.contractCode;
  delete canonical.scenarioContext;
  const envelope = {
    eventId: 'EV-C003-S001-STRICT',
    eventType: ontology.EVENT_TYPES.C003_DELIVERY,
    schemaVersion: ontology.SCHEMA_VERSIONS.C003,
    occurredAt: '2026-08-24T00:00:01.000Z',
    actorRef: 'M02',
    correlationId: 'CORR-C003-S001-STRICT',
    traceId: 'TRACE-C003-S001-STRICT',
    idempotencyKey: 'C003-S001-IDEM-STRICT',
    scenarioContext: CONTEXT,
    resourceRefs: [],
    evidenceRefs: [],
    payload: canonical
  };
  assert.throws(
    () => service.receiveC003({ ...envelope, undeclared: true }),
    (error) => error.code === 'INVALID_CONTRACT_ENVELOPE'
  );
  assert.throws(
    () => service.receiveC003({ ...envelope, scenarioContext: { ...CONTEXT, undeclared: true } }),
    (error) => error.code === 'INVALID_CONTRACT_ENVELOPE'
  );
  assert.throws(
    () => service.receiveC003({ ...envelope, schemaVersion: 'ofw.m01.c003.v2' }),
    (error) => error.code === 'SCHEMA_VERSION_MISMATCH'
      && error.details.compatibility.status === 'incompatible'
  );
  assert.equal(service.listDrafts({ scenarioContext: CONTEXT }).length, 0);
});

test('C003 accepts a direct canonical payload whose integrity includes the nested C033', () => {
  const service = makeService();
  const canonical = delivery();
  canonical.scenarioContext = CONTEXT;
  delete canonical.integrity;
  canonical.integrity = { algorithm: 'SHA-256', digest: digest(canonical) };
  const receipt = service.receiveC003(canonical);
  assert.equal(receipt.status, 'accepted');
});

test('C003 rejects context mismatch, corrupted payload and same-id content conflict', () => {
  const service = makeService();
  const wrongContext = { ...CONTEXT, scenarioRunId: 'S001-RUN-OTHER' };
  assert.throws(() => service.receiveC003({ ...delivery(), scenarioContext: wrongContext }), (error) => error.code === 'SCENARIO_RUN_MISMATCH');
  const corrupt = delivery();
  corrupt.integrity.digest = 'b'.repeat(64);
  const rejected = service.receiveC003(corrupt);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reasonCode, 'C003_CORRUPT');
  assert.throws(() => service.receiveC003({ ...delivery({ t007Version: 'T007-FINANCE-v2' }), deliveryId: 'C003-S001-DATA-v1' }), (error) => error.code === 'C003_IDEMPOTENCY_CONFLICT');
});

test('C003 does not silently re-accept the same rejected T007 under a new delivery id', () => {
  const service = makeService();
  const rejected = service.receiveC003(delivery({ sourceModule: 'M03' }));
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.reasonCode, 'C003_SOURCE_INVALID');
  const retry = service.receiveC003(delivery({ deliveryId: 'C003-S001-DATA-RETRY' }));
  assert.equal(retry.status, 'rejected');
  assert.equal(retry.reasonCode, 'C003_REACCEPTANCE_UNDECIDED');
});

test('Draft validation, immutable T017 publication and revision derivation', () => {
  const service = makeService();
  const published = buildPublished(service);
  assert.equal(published.lifecycleState, 'Published');
  assert.equal(Object.isFrozen(published), true);
  assert.throws(() => { published.semanticVersion = 'changed'; }, TypeError);
  const revision = service.deriveDraftFromPublished({ scenarioContext: CONTEXT, publishedId: published.publishedId });
  assert.equal(revision.basedOnPublishedId, published.publishedId);
  assert.equal(service.listPublished({ scenarioContext: CONTEXT }).length, 1);
});

test('C032 distinguishes empty and available and C028 rereads the exact target', () => {
  const service = makeService();
  const empty = service.discoverC032({ scenarioContext: CONTEXT, assetId: 'T006-FINANCE', requester: 'm02' });
  assert.equal(empty.status, 'not-established');
  const published = buildPublished(service);
  const { discovery, request } = buildTargetAndRequest(service, published);
  assert.equal(discovery.candidates[0].allowSubmit, true);
  assert.equal(request.status, 'accepted');
  const drift = service.createRefreshTarget({
    scenarioContext: CONTEXT,
    t054Id: 'T054-S001-FINANCE',
    bindingVersion: '2',
    publishedId: published.publishedId,
    t017Id: published.t017Id,
    t006Id: 'T006-FINANCE',
    sourceMappingVersion: 'MAPPING-S001-v1',
    coverage: { memberIds: ['FIN-MEMBER-SUBJECT'], relationIds: [] },
    ownerRef: 'M01-owner',
    verifiedAt: '2026-08-24T00:00:20.000Z',
    evidenceRefs: ['T054-EVIDENCE-S001-2']
  });
  assert.equal(drift.status, 'coverage-insufficient');
  const stale = service.submitC028({
    requestId: 'C028-S001-STALE',
    scenarioContext: CONTEXT,
    t006Id: 'T006-FINANCE',
    t007Version: 'T007-FINANCE-v1',
    t008AsOf: '2026-08-23',
    deliveryId: 'C003-S001-DATA-v1',
    target: discovery.candidates[0],
    discovery,
    existingT019Snapshot: { t019Revision: 0, combinationId: null }
  });
  assert.equal(stale.status, 'rejected');
  assert.ok(['T054_NOT_AVAILABLE', 'C032_DRIFT'].includes(stale.reasonCode));
});

test('C029 success creates eligible T018 but does not switch T019', () => {
  const service = makeService();
  const published = buildPublished(service);
  buildTargetAndRequest(service, published);
  const result = service.completeC029({
    requestId: 'C028-S001-1',
    scenarioContext: CONTEXT,
    status: 'succeeded',
    objectChecks: [{ id: 'OBJ-CHECK', status: 'passed', evidenceRef: 'OBJ-CHECK-E' }],
    relationChecks: [],
    evidenceRefs: ['C029-EVIDENCE-S001']
  });
  assert.equal(result.status, 'succeeded');
  assert.equal(result.t018.status, 'eligible');
  assert.equal(service.readT019({ scenarioContext: CONTEXT }).status, 'empty');
});

test('T019 atomically adopts a fully evidenced candidate and records previous trusted', () => {
  const service = makeService();
  const published = buildPublished(service);
  buildTargetAndRequest(service, published);
  const result = service.completeC029({ requestId: 'C028-S001-1', scenarioContext: CONTEXT, status: 'succeeded', objectChecks: [{ id: 'OBJ-CHECK', status: 'passed', evidenceRef: 'OBJ-CHECK-E' }], relationChecks: [], evidenceRefs: ['C029-EVIDENCE-S001'] });
  const command = {
    scenarioContext: CONTEXT,
    qualificationId: result.t018.qualificationId,
    idempotencyKey: 'T019-S001-FIRST',
    gates: { ontology: { status: 'passed', evidenceRefs: ['ONTO-GATE'] }, mapping: { status: 'passed', evidenceRefs: ['MAP-GATE'] } },
    candidateValidation: {
      sourceModule: 'M03',
      semanticVersionId: published.publishedId,
      dataVersion: 'T007-FINANCE-v1',
      questionSetVersion: 'S001-FIXED-v1',
      status: 'passed',
      completedAt: '2026-08-24T00:00:30.000Z',
      evidenceRefs: ['M03-CV-S001']
    }
  };
  const adoption = service.commitT019(command);
  const duplicate = service.commitT019(command);
  assert.equal(adoption.status, 'adopted');
  const projection = service.readC008({ scenarioContext: CONTEXT });
  assert.equal(projection.readStatus, 'ready');
  assert.equal(projection.current.semanticVersionId, published.publishedId);
  assert.equal(projection.current.dataVersion, 'T007-FINANCE-v1');
  assert.equal(projection.current.t019.evidenceId, 'M03-CV-S001');
  assert.equal(duplicate.t019Id, adoption.t019Id);
  assert.equal(duplicate.t019Revision, adoption.t019Revision);
});

test('hard quality failure without a safe fallback yields failed C008', () => {
  const service = makeService();
  const published = buildPublished(service);
  buildTargetAndRequest(service, published);
  const first = service.completeC029({ requestId: 'C028-S001-1', scenarioContext: CONTEXT, status: 'succeeded', objectChecks: [{ id: 'OBJ-CHECK', status: 'passed', evidenceRef: 'OBJ-CHECK-E' }], relationChecks: [], evidenceRefs: ['C029-EVIDENCE-S001'] });
  const adopted = service.commitT019({ scenarioContext: CONTEXT, qualificationId: first.t018.qualificationId, gates: { ontology: { status: 'passed', evidenceRefs: ['ONTO-GATE'] }, mapping: { status: 'passed', evidenceRefs: ['MAP-GATE'] } }, candidateValidation: { semanticVersionId: published.publishedId, dataVersion: 'T007-FINANCE-v1', questionSetVersion: 'S001-FIXED-v1', status: 'passed', completedAt: '2026-08-24T00:00:30.000Z', evidenceRefs: ['CV-1'] } });
  // A second adoption creates a previous-trusted combination.
  const second = service.completeC029({ requestId: 'C028-S001-1', scenarioContext: CONTEXT, status: 'succeeded', objectChecks: [{ id: 'OBJ-CHECK-2', status: 'passed', evidenceRef: 'OBJ-CHECK-E-2' }], relationChecks: [], evidenceRefs: ['C029-EVIDENCE-S001-2'], resultId: 'C029-S001-2' });
  // Same request/result candidate is intentionally not re-adopted; use the
  // first combination to exercise the no-safe-combination failure path.
  const failed = service.markQualityFailure({ scenarioContext: CONTEXT, combinationId: adopted.combinationId, reason: 'hard quality failure', callerModule: 'M02' });
  assert.equal(failed.readStatus, 'failed');
  assert.equal(service.readC008({ scenarioContext: CONTEXT }).readStatus, 'failed');
  assert.equal(service.readC008({ scenarioContext: CONTEXT }).current, null);
  assert.equal(second.t018.status, 'eligible');
});

test('a second atomic adoption can roll back to the previous-trusted combination', () => {
  const service = makeService();
  const published = buildPublished(service);
  const { discovery } = buildTargetAndRequest(service, published);
  const firstResult = service.completeC029({
    requestId: 'C028-S001-1',
    scenarioContext: CONTEXT,
    status: 'succeeded',
    objectChecks: [{ id: 'OBJ-CHECK-1', status: 'passed', evidenceRef: 'OBJ-E-1' }],
    relationChecks: [],
    evidenceRefs: ['C029-E-1']
  });
  const first = service.commitT019({
    scenarioContext: CONTEXT,
    qualificationId: firstResult.t018.qualificationId,
    idempotencyKey: 'T019-FIRST',
    gates: { ontology: { status: 'passed', evidenceRefs: ['ONTO-GATE'] }, mapping: { status: 'passed', evidenceRefs: ['MAP-GATE'] } },
    candidateValidation: { semanticVersionId: published.publishedId, dataVersion: 'T007-FINANCE-v1', questionSetVersion: 'S001-FIXED-v1', status: 'passed', completedAt: '2026-08-24T00:00:30.000Z', evidenceRefs: ['CV-1'] }
  });

  const secondDelivery = service.receiveC003(delivery({
    deliveryId: 'C003-S001-DATA-v2',
    t007Version: 'T007-FINANCE-v2',
    sourceFingerprint: { algorithm: 'SHA-256', value: 'b'.repeat(64), sizeBytes: 4096 }
  }));
  assert.equal(secondDelivery.status, 'accepted');
  const freshDiscovery = service.discoverC032({ scenarioContext: CONTEXT, assetId: 'T006-FINANCE', requester: 'm02' });
  const secondRequest = service.submitC028({
    requestId: 'C028-S001-2',
    scenarioContext: CONTEXT,
    t006Id: 'T006-FINANCE',
    t007Version: 'T007-FINANCE-v2',
    t008AsOf: '2026-08-23',
    deliveryId: 'C003-S001-DATA-v2',
    target: freshDiscovery.candidates[0],
    discovery: freshDiscovery,
    existingT019Snapshot: { t019Revision: first.t019Revision, combinationId: first.combinationId }
  });
  assert.equal(secondRequest.status, 'accepted');
  const secondResult = service.completeC029({
    requestId: 'C028-S001-2',
    scenarioContext: CONTEXT,
    status: 'succeeded',
    objectChecks: [{ id: 'OBJ-CHECK-2', status: 'passed', evidenceRef: 'OBJ-E-2' }],
    relationChecks: [],
    evidenceRefs: ['C029-E-2']
  });
  const second = service.commitT019({
    scenarioContext: CONTEXT,
    qualificationId: secondResult.t018.qualificationId,
    idempotencyKey: 'T019-SECOND',
    gates: { ontology: { status: 'passed', evidenceRefs: ['ONTO-GATE-2'] }, mapping: { status: 'passed', evidenceRefs: ['MAP-GATE-2'] } },
    candidateValidation: { semanticVersionId: published.publishedId, dataVersion: 'T007-FINANCE-v2', questionSetVersion: 'S001-FIXED-v2', status: 'passed', completedAt: '2026-08-24T00:00:40.000Z', evidenceRefs: ['CV-2'] }
  });
  assert.equal(service.previousTrusted({ scenarioContext: CONTEXT }).combinationId, first.combinationId);
  const rolledBack = service.markQualityFailure({
    scenarioContext: CONTEXT,
    combinationId: second.combinationId,
    reason: 'post-adoption hard quality failure',
    callerModule: 'M02',
    confirmRollback: true,
    expectedT019Revision: second.t019Revision
  });
  assert.equal(rolledBack.status, 'previous-trusted');
  const projection = service.readC008({ scenarioContext: CONTEXT });
  assert.equal(projection.readStatus, 'previous-trusted');
  assert.equal(projection.current.combinationId, first.combinationId);
  assert.equal(discovery.status, 'available');
});

test('C008 rejects a dual source or damaged projection and C034 clone creates a new run', () => {
  const service = makeService();
  const checkpoint = service.exportCheckpoint({ scenarioContext: CONTEXT });
  assert.equal(service.validateCheckpoint(checkpoint).ok, true);
  const damaged = JSON.parse(JSON.stringify(checkpoint));
  damaged.integrity.digest = 'f'.repeat(64);
  assert.equal(service.validateCheckpoint(damaged).ok, false);
  assert.throws(() => service.readC008({
    scenarioContext: CONTEXT,
    sources: [checkpoint.moduleState.c008, checkpoint.moduleState.c008]
  }), (error) => error.code === 'PROJECTION_SOURCE_DUPLICATE' || error.code === 'PROJECTION_DUAL_SOURCE');
  const provider = ontology.createM01CheckpointProvider(service);
  const restored = provider.cloneRestore(checkpoint, {
    scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-M01-RESTORED' }
  });
  assert.notEqual(restored.targetScenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(restored.restoredState.c008.readStatus, 'empty');
  assert.equal(checkpoint.moduleState.t019.current, null);
});

test('C034 rejects a re-signed checkpoint containing a cross-C033 historical record', () => {
  const service = makeService();
  const checkpoint = service.exportCheckpoint({ scenarioContext: CONTEXT });
  const tampered = JSON.parse(JSON.stringify(checkpoint));
  tampered.moduleState.t019.history.push({
    transition: 'failed',
    t019Id: 'T019-OTHER',
    scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-OTHER' }
  });
  delete tampered.integrity;
  tampered.integrity = { algorithm: 'SHA-256', digest: digest(tampered) };
  assert.equal(service.validateCheckpoint(tampered).ok, false);
  assert.throws(() => service.cloneRestore(tampered, { scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-RESTORE-2' } }), (error) => error.code === 'INVALID_CHECKPOINT');
});

test('C034 validates a checkpoint containing an accepted delivery and Published T017', () => {
  const service = makeService();
  const published = buildPublished(service);
  const checkpoint = service.exportCheckpoint({ scenarioContext: CONTEXT });
  assert.equal(checkpoint.moduleState.published[published.publishedId].immutable, true);
  assert.equal(service.validateCheckpoint(checkpoint).ok, true);
  const restored = service.cloneRestore(checkpoint);
  assert.equal(restored.restoredState.historicalState.published[published.publishedId].t017Id, published.t017Id);
});

test('C034 uses Foundation strict C033 validation after the compatibility merge', () => {
  const service = makeService();
  const checkpoint = service.exportCheckpoint({ scenarioContext: CONTEXT });
  const withUnknownContext = JSON.parse(JSON.stringify(checkpoint));
  withUnknownContext.scenarioContext.undeclared = true;
  delete withUnknownContext.integrity;
  withUnknownContext.integrity = { algorithm: 'SHA-256', digest: digest(withUnknownContext) };
  const result = service.validateCheckpoint(withUnknownContext);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.code === 'UNKNOWN_SCENARIO_CONTEXT_FIELD'));
});
