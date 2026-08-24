'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createDataRuntime, ERROR_CODES } = require('./runtime');

const context = {
  scenarioId: 'S001', scenarioVersion: 'S001-v1', scenarioRunId: 'S001-RUN-idem',
  formedAt: '2026-08-24T00:00:00.000Z', status: 'active'
};
const schemaVersion = 'draft-0.1.0';

function prepared() {
  const runtime = createDataRuntime({ clock: () => new Date('2026-08-24T01:00:00.000Z') });
  runtime.registerSource({ sourceId: 'source-idem', name: 'source' });
  const snapshot = runtime.createSnapshot({ sourceId: 'source-idem', content: 'same', scenarioContext: context });
  runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2025-12-31', confirmedBy: 'user', scenarioContext: context });
  runtime.createPipeline({ pipelineId: 'pipeline-idem', name: 'pipeline', outputAssetId: 'asset-idem', inputSlots: [{ slotId: 'input', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }] });
  runtime.publishPipeline('pipeline-idem');
  return runtime;
}

test('formal run and C003/C028/C029 repeated identifiers are side-effect free', () => {
  const runtime = prepared();
  const first = runtime.startRun('pipeline-idem', { scenarioContext: context, idempotencyKey: 'run-key' });
  const duplicate = runtime.startRun('pipeline-idem', { scenarioContext: context, idempotencyKey: 'run-key' });
  assert.equal(duplicate.runId, first.runId);
  runtime.executeRun(first.runId, () => ({ stable: true }), { qualityChecks: [{ checkId: 'shape', status: 'passed', hard: true }] });
  const asset = runtime.publishAsset(first.runId, { assetId: 'asset-idem', members: ['m'], contentFingerprint: 'stable' });
  const delivery = runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: context, deliveryId: 'delivery-idem' });
  runtime.recordDeliveryReceipt(delivery.deliveryId, { schemaVersion, contractCode: 'C003', deliveryId: delivery.deliveryId, assetVersionId: asset.assetVersionId, status: 'accepted', scenarioContext: context });
  const discovery = runtime.discoverC032({ deliveryId: delivery.deliveryId, response: { schemaVersion, contractCode: 'C032', responseId: 'response-idem', responseVersion: '1', assetId: asset.assetId, status: 'available', scenarioContext: context, candidates: [{ t054Id: 'target', bindingVersion: '1', allowSubmit: true, status: 'available' }] } });
  const receipt = { schemaVersion, contractCode: 'C028', requestId: 'request-idem', assetVersionId: asset.assetVersionId, status: 'accepted', scenarioContext: context };
  const request = runtime.submitC028({ deliveryId: delivery.deliveryId, discovery, reread: discovery, scenarioContext: context, requestId: 'request-idem', receipt });
  assert.equal(runtime.submitC028({ deliveryId: delivery.deliveryId, discovery, reread: discovery, scenarioContext: context, requestId: 'request-idem', receipt }).requestId, request.requestId);
  const resultInput = { schemaVersion, contractCode: 'C029', resultId: 'result-idem', requestId: request.requestId, assetVersionId: asset.assetVersionId, status: 'failed', scenarioContext: context };
  const result = runtime.recordC029(request.requestId, resultInput);
  assert.equal(runtime.recordC029(request.requestId, resultInput).resultId, result.resultId);
});

test('reusing an idempotency key with a changed payload fails closed', () => {
  const runtime = prepared();
  runtime.startRun('pipeline-idem', { scenarioContext: context, idempotencyKey: 'same-key' });
  assert.throws(() => runtime.startRun('pipeline-idem', { scenarioContext: context, idempotencyKey: 'same-key', trigger: 'schedule' }), (error) => error.code === ERROR_CODES.IDEMPOTENCY_CONFLICT);
});
