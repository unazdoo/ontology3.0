'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contract = require('./contracts');
const schema = require('./schemas/m02-data-contracts.schema.json');

const context = {
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-contract',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
};

test('M02 registry covers only the requested T/C ownership surface', () => {
  assert.equal(schema.schemaVersion, contract.DATA_SCHEMA_VERSION);
  assert.equal(schema.contractVersion, contract.DATA_CONTRACT_VERSION);
  assert.deepEqual(schema.resources.map((item) => item.code), ['T001', 'T002', 'T003', 'T005', 'T006', 'T007', 'T008']);
  assert.deepEqual(schema.contracts.map((item) => item.code), contract.CONTRACT_CODES);
  assert.deepEqual(schema.events.map((item) => item.code), ['T002_READ', 'T008_CONFIRMED', 'T008_READ', 'C017_READ']);
  assert.equal(schema.consumerProjection.code, 'C017');
  assert.equal(schema.consumerProjection.metadataOnly, true);
});

test('immutable constructors validate canonical T002/T005/T007/C003 shapes', () => {
  const snapshot = contract.makeSnapshot({
    snapshotId: 'T002-1', sourceId: 'T001-1', contentFingerprint: 'a'.repeat(64),
    readAt: '2026-08-24T00:00:00.000Z', status: 'registered', immutable: true
  });
  assert.equal(Object.isFrozen(snapshot), true);
  const quality = contract.makeQuality({ qualityId: 'T005-1', status: 'passed', hardFailure: false, checks: [] });
  const asset = contract.makeAssetVersion({
    assetId: 'T006-1', assetVersionId: 'T007-1', scenarioContext: context,
    asOfTime: '2025-12-31', members: [{ memberId: 'm' }], relationships: [],
    quality, immutable: true, consumable: true
  });
  assert.equal(asset.assetVersionId, 'T007-1');
  const delivery = contract.makeDelivery({
    deliveryId: 'C003-1', contractCode: 'C003', assetId: 'T006-1', assetVersionId: 'T007-1',
    asOfTime: '2025-12-31', scenarioContext: context, status: 'pending', sentAt: '2026-08-24T00:00:00.000Z'
  });
  assert.equal(delivery.contractCode, 'C003');
});

test('C017 projection rejects forbidden business content and preserves C033', () => {
  const summary = contract.makeC017Summary({
    summaryId: 'C017-1', summaryVersion: '1', summaryType: 'current-state',
    assetId: 'T006-1', assetVersionId: 'T007-1', asOfTime: '2025-12-31',
    scenarioContext: context,
    fiveDimensions: {
      versionLocation: { status: 'located' }, contentAccess: { status: 'available' },
      evidenceCompleteness: { status: 'complete' }, replayCapability: { status: 'conditions-available' },
      replayVerification: { status: 'not-executed' }
    },
    dataSideQualification: 'allowed',
    quality: { status: 'passed' },
    evidence: [{ evidenceId: 'T005-1', locationStatus: 'locatable' }]
  });
  const projection = contract.projectC017(summary, 'intelligent-query');
  assert.deepEqual(projection.scenarioContext, context);
  assert.equal('rows' in projection, false);
  assert.throws(() => contract.projectC017({ ...summary, evidence: [{ rows: [{ secret: 1 }] }] }, 'intelligent-query'), (error) => error.code === 'INVALID_C017_EVIDENCE');
});

test('S003 compatibility contract cannot be promoted or reused', () => {
  const quality = contract.makeQuality({ qualityId: 'T005-s3', status: 'passed', hardFailure: false, checks: [] });
  assert.throws(() => contract.makeAssetVersion({
    assetId: 'T006-S003', assetVersionId: 'T007-S003', scenarioContext: { ...context, scenarioId: 'S003', scenarioVersion: 'S003-v1', scenarioRunId: 'S003-RUN-1' },
    asOfTime: '2025-12-31', members: [{ memberId: 'financial-data' }, { memberId: 'adjustment-factors' }],
    relationships: [], quality, immutable: true, consumable: true, reusable: true, compatibilityOnly: true
  }), (error) => error.code === 'S003_COMPATIBILITY_LOCK');
});
