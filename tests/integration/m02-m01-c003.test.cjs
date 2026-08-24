'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const data = require('../../services/data');
const ontology = require('../../services/ontology');

const CONTEXT = Object.freeze({
  scenarioId: 'S002',
  scenarioVersion: 'S002-v1',
  scenarioRunId: 'S002-RUN-C003-INTEGRATION',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function makeDelivery() {
  const runtime = data.createDataRuntime({ clock: () => new Date('2026-08-24T01:00:00.000Z') });
  runtime.registerSource({ sourceId: 'T001-C003-INTEGRATION', name: 'C003 integration source' });
  const snapshot = runtime.createSnapshot({
    sourceId: 'T001-C003-INTEGRATION',
    content: Buffer.from('provider-produced-data'),
    scenarioContext: CONTEXT
  });
  runtime.confirmAsOf(snapshot.snapshotId, {
    asOf: '2025-12-31',
    confirmedBy: 'integration-owner',
    scenarioContext: CONTEXT
  });
  runtime.createPipeline({
    pipelineId: 'T003-C003-INTEGRATION',
    name: 'C003 integration pipeline',
    outputAssetId: 'T006-C003-INTEGRATION',
    inputSlots: [{ slotId: 'source', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }]
  });
  runtime.publishPipeline('T003-C003-INTEGRATION');
  const run = runtime.runPipeline('T003-C003-INTEGRATION', {
    scenarioContext: CONTEXT,
    executor: () => ({ normalized: true }),
    qualityChecks: [{ checkId: 'shape', status: 'passed', hard: true }]
  });
  const asset = runtime.publishAsset(run.runId, {
    assetId: 'T006-C003-INTEGRATION',
    members: [
      {
        memberId: 'member-subject',
        name: 'Subject',
        grain: 'one row per subject',
        rowCount: 1,
        primaryKey: 'subject-id',
        fields: [{ id: 'subject-id', name: 'Subject ID', dataType: 'text', nullable: false }],
        qualityStatus: 'passed'
      },
      {
        memberId: 'member-detail',
        name: 'Detail',
        grain: 'one row per detail',
        rowCount: 1,
        primaryKey: 'detail-id',
        fields: [
          { id: 'detail-id', name: 'Detail ID', dataType: 'text', nullable: false },
          { id: 'subject-ref', name: 'Subject Reference', dataType: 'text', nullable: false }
        ],
        qualityStatus: 'passed'
      }
    ],
    relations: [{
      relationId: 'relation-detail-subject',
      name: 'Detail belongs to subject',
      sourceMemberId: 'member-detail',
      targetMemberId: 'member-subject',
      sourceFieldId: 'subject-ref',
      targetFieldId: 'subject-id',
      endpointCheckStatus: 'passed'
    }]
  });
  return runtime.createC003Delivery({
    assetVersionId: asset.assetVersionId,
    deliveryId: 'C003-M02-M01-INTEGRATION-1',
    scenarioContext: CONTEXT
  });
}

function makeConsumer() {
  return ontology.createOntologyService({
    scenarioContext: CONTEXT,
    ontologyId: 'ONT-C003-INTEGRATION',
    clock: () => '2026-08-24T01:00:01.000Z'
  });
}

test('M02 provider C003 is accepted by M01 for the same C033 and exact T007', () => {
  const delivery = makeDelivery();
  const receipt = makeConsumer().receiveC003(delivery);

  assert.equal(receipt.status, 'accepted');
  assert.equal(receipt.deliveryId, delivery.deliveryId);
  assert.equal(receipt.assetVersionId, delivery.assetVersionId);
  assert.deepEqual(receipt.scenarioContext, CONTEXT);
});

test('M01 rejects an M02 provider C003 whose C033 does not match', () => {
  const delivery = makeDelivery();
  const consumer = makeConsumer();

  assert.throws(
    () => consumer.receiveC003({ ...delivery, scenarioContext: { ...CONTEXT, scenarioRunId: 'S002-RUN-OTHER' } }),
    (error) => error.code === 'SCENARIO_RUN_MISMATCH'
  );
});

test('M01 makes a repeated real M02 provider C003 side-effect free', () => {
  const delivery = makeDelivery();
  const consumer = makeConsumer();
  const first = consumer.receiveC003(delivery);
  const second = consumer.receiveC003(delivery);

  assert.equal(second.duplicate, true);
  assert.equal(second.duplicateOf, first.receiptId);
  assert.equal(second.receiptId, first.receiptId);
  assert.equal(consumer.repository.read(CONTEXT).deliveryOrder.length, 1);
});
