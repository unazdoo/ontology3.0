'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const data = require('./');
const foundation = require('../../packages/contracts');

const context = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-foundation',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function envelope(overrides = {}) {
  return {
    eventId: 'event-1',
    eventType: 'C003_DELIVERY',
    schemaVersion: data.DATA_SCHEMA_VERSION,
    occurredAt: '2026-08-24T00:00:01.000Z',
    actorRef: 'actor-1',
    correlationId: 'correlation-1',
    traceId: 'trace-1',
    idempotencyKey: 'idempotency-1',
    scenarioContext: context,
    resourceRefs: [{ refType: 'T007', refId: 'T007-1', refVersion: 'v1' }],
    evidenceRefs: [{ evidenceType: 'T005', evidenceId: 'T005-1' }],
    payload: { contractCode: 'C003', deliveryId: 'delivery-1' },
    ...overrides
  };
}

function asset() {
  return data.makeAssetVersion({
    assetId: 'T006-1', assetVersionId: 'T007-1', scenarioContext: context,
    asOfTime: '2025-12-31', members: [{ memberId: 'member-1' }], relationships: [],
    quality: data.makeQuality({ qualityId: 'T005-1', status: 'passed', hardFailure: false, checks: [] }),
    immutable: true, consumable: false, reusable: false,
    publicationState: 'published', publishedAt: '2026-08-24T00:00:00.000Z'
  });
}

function runtimeWithAcceptedDelivery() {
  const runtime = data.createDataRuntime({ clock: () => new Date('2026-08-24T01:00:00.000Z') });
  runtime.registerSource({ sourceId: 'source-boundary', name: 'source' });
  const snapshot = runtime.createSnapshot({ sourceId: 'source-boundary', content: 'boundary', scenarioContext: context });
  runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2025-12-31', confirmedBy: 'owner', scenarioContext: context });
  runtime.createPipeline({ pipelineId: 'pipeline-boundary', name: 'pipeline', outputAssetId: 'asset-boundary', inputSlots: [{ slotId: 'input', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }] });
  runtime.publishPipeline('pipeline-boundary');
  const run = runtime.runPipeline('pipeline-boundary', { scenarioContext: context, executor: () => ({ ok: true }), qualityChecks: [{ checkId: 'shape', status: 'passed', hard: true }] });
  const version = runtime.publishAsset(run.runId, { assetId: 'asset-boundary', members: ['member'] });
  const delivery = runtime.createDelivery({ assetVersionId: version.assetVersionId, scenarioContext: context, deliveryId: 'delivery-boundary' });
  runtime.recordDeliveryReceipt(delivery.deliveryId, {
    schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C003', deliveryId: delivery.deliveryId,
    assetVersionId: version.assetVersionId, status: 'accepted', scenarioContext: context
  });
  return { runtime, version, delivery };
}

test('M02 envelope is a strict Foundation Contract Envelope', () => {
  const value = data.createM02Envelope(envelope(), {
    payloadFields: ['contractCode', 'deliveryId'],
    requiredPayloadFields: ['contractCode', 'deliveryId']
  });
  assert.equal(foundation.validateContractEnvelope(value, { allowUnknown: false }).valid, true);
  assert.equal(data.validateM02Envelope(value).valid, true);
});

test('unknown envelope/context/payload fields and unregistered event types fail closed', () => {
  assert.throws(() => data.assertM02Envelope(envelope({ undeclared: true })), (error) => error.code === 'INVALID_M02_ENVELOPE');
  assert.throws(() => data.assertM02Envelope(envelope({ scenarioContext: { ...context, undeclared: true } })), (error) => error.code === 'ERR_CONTRACT_VALIDATION');
  assert.throws(() => data.assertM02Envelope(envelope({ eventType: 'UNREGISTERED' })), (error) => error.code === 'M02_EVENT_TYPE_UNKNOWN');
  assert.throws(() => data.assertM02Envelope(envelope({ payload: { contractCode: 'C003', deliveryId: 'delivery-1', future: true } }), {
    payloadFields: ['contractCode', 'deliveryId'], requiredPayloadFields: ['contractCode', 'deliveryId']
  }), (error) => error.code === 'INVALID_C003_DELIVERY_PAYLOAD');
});

test('compatibility gate accepts exact only and rejects review/breaking/malformed versions', () => {
  assert.equal(data.assertExactSchemaVersion(data.DATA_SCHEMA_VERSION).status, 'exact');
  for (const version of ['draft-0.1.1', 'draft-0.2.0', 'draft-1.0.0', '1.0.0', 'not-a-version']) {
    assert.throws(() => data.assertExactSchemaVersion(version), (error) => ['SCHEMA_VERSION_INCOMPATIBLE', 'SCHEMA_VERSION_INVALID', 'SCHEMA_VERSION_NOT_EXACT'].includes(error.code));
  }
});

test('C003 provider receipt must echo exact IDs, exact five-field context and exact schema', () => {
  const client = new data.C003Client({ provider: () => ({
    schemaVersion: data.DATA_SCHEMA_VERSION,
    contractCode: 'C003',
    status: 'accepted',
    scenarioContext: context
  }) });
  const delivery = client.createDelivery(asset(), { deliveryId: 'delivery-1' });
  assert.throws(() => client.send(delivery), (error) => error.code === 'INVALID_C003_RECEIPT');
  assert.equal(client.getReceipt(delivery.deliveryId), null);

  const lifecycleClient = new data.C003Client({ provider: (request) => ({
    schemaVersion: data.DATA_SCHEMA_VERSION,
    contractCode: 'C003',
    deliveryId: request.deliveryId,
    assetVersionId: request.assetVersionId,
    status: 'accepted',
    scenarioContext: { ...request.scenarioContext, status: 'archived' }
  }) });
  const lifecycleDelivery = lifecycleClient.createDelivery(asset(), { deliveryId: 'delivery-lifecycle' });
  assert.throws(() => lifecycleClient.send(lifecycleDelivery), (error) => error.code === 'SCENARIO_CONTEXT_MISMATCH');
});

test('C017 rejects unknown nested consumer fields instead of blocklist filtering', () => {
  const summary = data.makeC017Summary({
    summaryId: 'C017-strict', summaryVersion: '1', summaryType: 'current-state',
    assetId: 'T006-1', assetVersionId: 'T007-1', asOfTime: '2025-12-31',
    scenarioContext: context,
    fiveDimensions: {
      versionLocation: { status: 'located' }, contentAccess: { status: 'metadata-only' },
      evidenceCompleteness: { status: 'complete' }, replayCapability: { status: 'dependency-insufficient' },
      replayVerification: { status: 'not-executed' }
    },
    dataSideQualification: 'allowed',
    quality: { status: 'passed', opaqueFutureValue: true },
    evidence: [{ evidenceId: 'T005-1', locationStatus: 'locatable' }]
  });
  assert.throws(() => data.projectC017(summary, 'intelligent-query'), (error) => error.code === 'INVALID_C017_QUALITY');
});

test('runtime provider boundaries reject missing/unknown fields before state is written', () => {
  const { runtime, version, delivery } = runtimeWithAcceptedDelivery();
  const beforeDiscovery = runtime.c032Responses.size;
  assert.throws(() => runtime.discoverC032({ deliveryId: delivery.deliveryId, response: {
    schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C032', responseId: 'bad-response',
    responseVersion: '1', assetId: version.assetId, status: 'available', candidates: [], undeclared: true,
    scenarioContext: context
  } }), (error) => error.code === 'INVALID_C032_RESPONSE');
  assert.equal(runtime.c032Responses.size, beforeDiscovery);

  const discovery = runtime.discoverC032({ deliveryId: delivery.deliveryId, response: {
    schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C032', responseId: 'good-response',
    responseVersion: '1', assetId: version.assetId, status: 'available',
    candidates: [{ t054Id: 'target-1', bindingVersion: '1', status: 'available', allowSubmit: true }],
    scenarioContext: context
  } });
  const beforeRequests = runtime.refreshRequests.size;
  assert.throws(() => runtime.submitC028({ deliveryId: delivery.deliveryId, discovery, reread: discovery, requestId: 'bad-request', scenarioContext: context, receipt: {
    schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C028', requestId: 'bad-request',
    assetVersionId: version.assetVersionId, status: 'accepted', undeclared: true, scenarioContext: context
  } }), (error) => error.code === 'INVALID_C028_RECEIPT');
  assert.equal(runtime.refreshRequests.size, beforeRequests);

  const request = runtime.submitC028({ deliveryId: delivery.deliveryId, discovery, reread: discovery, requestId: 'good-request', scenarioContext: context, receipt: {
    schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C028', requestId: 'good-request',
    assetVersionId: version.assetVersionId, status: 'accepted', scenarioContext: context
  } });
  const beforeResults = runtime.refreshResults.size;
  assert.throws(() => runtime.recordC029(request.requestId, {
    schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C029', resultId: 'bad-result',
    requestId: request.requestId, status: 'failed', scenarioContext: context
  }), (error) => error.code === 'INVALID_C029_RESULT');
  assert.equal(runtime.refreshResults.size, beforeResults);
});
