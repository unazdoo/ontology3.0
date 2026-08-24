'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const data = require('./');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-202608240001',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function clock() { return new Date('2026-08-24T01:00:00.000Z'); }

function c003Receipt(delivery, status, extra = {}) {
  return { schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C003', deliveryId: delivery.deliveryId, assetVersionId: delivery.assetVersionId, status, scenarioContext: delivery.scenarioContext, ...extra };
}

function c032Response(responseId, candidates, extra = {}) {
  return { schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C032', responseId, responseVersion: '1', assetId: 'T006-FINANCE', status: 'available', scenarioContext: CONTEXT, candidates, ...extra };
}

function c028Receipt(requestId, assetVersionId, status = 'accepted', extra = {}) {
  return { schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C028', requestId, assetVersionId, status, scenarioContext: CONTEXT, ...extra };
}

function c029Result(resultId, requestId, assetVersionId, status, extra = {}) {
  return { schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C029', resultId, requestId, assetVersionId, status, scenarioContext: CONTEXT, ...extra };
}

function setup(options = {}) {
  const runtime = data.createDataRuntime({ clock, ...options });
  runtime.registerSource({ sourceId: 'T001-S001', name: 'Finance workbook', category: 'manual-workbook', readMethod: 'upload' });
  const snapshot = runtime.createSnapshot({
    sourceId: 'T001-S001',
    fileName: 'finance.xlsx',
    content: Buffer.from('stable-content'),
    scenarioContext: CONTEXT,
    readAt: '2026-08-24T01:00:01.000Z'
  });
  const confirmation = runtime.confirmAsOf(snapshot.snapshotId, {
    asOf: '2025-12-31',
    confirmedBy: 'demo-user',
    confirmedAt: '2026-08-24T01:00:02.000Z',
    basis: 'business-owner-confirmed',
    scenarioContext: CONTEXT
  });
  runtime.readT008(snapshot.snapshotId, { scenarioContext: CONTEXT, requester: 'test' });
  runtime.createPipeline({
    pipelineId: 'T003-S001',
    pipelineVersion: 'T003-S001-v1',
    name: 'standardise',
    outputAssetId: 'T006-FINANCE',
    inputSlots: [{ slotId: 'raw-finance', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }],
    nodes: [
      { id: 'source', type: 'source' },
      { id: 'python', type: 'python' },
      { id: 'quality', type: 'quality' },
      { id: 'publish', type: 'publish' },
      { id: 'refresh', type: 'refresh' }
    ],
    edges: [
      { from: 'source', to: 'python' },
      { from: 'python', to: 'quality' },
      { from: 'quality', to: 'publish' },
      { from: 'publish', to: 'refresh' }
    ]
  });
  runtime.publishPipeline('T003-S001');
  return { runtime, snapshot, confirmation };
}

function runAndPublish(runtime, options = {}) {
  const run = runtime.startRun('T003-S001', { scenarioContext: CONTEXT, ...options });
  const completed = runtime.executeRun(run.runId, () => ({ normalised: true }), {
    qualityChecks: options.qualityChecks || [{ checkId: 'structure', status: 'passed', hard: true, checkedCount: 1 }]
  });
  return { runtime, run: completed, asset: runtime.publishAsset(completed.runId, {
    assetId: 'T006-FINANCE',
    members: [
      { memberId: 'member-a', grain: 'one-row' },
      { memberId: 'member-b', grain: 'one-row' }
    ],
    relations: [{ relationId: 'relation-a' }],
    reuseLicense: { allowed: true, fields: ['id'], grain: 'one-row', stableKeys: ['id'], quality: 'passed', retention: 'retained', access: 'authorized' },
    contentFingerprint: options.contentFingerprint || 'same-normalised-output'
  }) };
}

test('T001 excludes scenario identity and T002 captures actual content fingerprint/read event', () => {
  const { runtime, snapshot } = setup();
  assert.equal(snapshot.immutable, true);
  assert.match(snapshot.contentFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.readEventId.startsWith('T002-READ-'), true);
  assert.equal('scenarioId' in runtime.getSource('T001-S001'), false);
  assert.throws(() => runtime.getSource('T001-S001').name = 'changed', TypeError);
});

test('real file capture fingerprints bytes rather than file name or timestamps', () => {
  const runtime = data.createDataRuntime({ clock });
  runtime.registerSource({ sourceId: 'T001-FILE', name: 'local fixture', category: 'shared-folder', readMethod: 'filesystem' });
  const snapshot = runtime.captureFile('T001-FILE', require('node:path').resolve(__dirname, 'README.md'), { scenarioContext: CONTEXT });
  assert.equal(snapshot.byteLength > 0, true);
  assert.match(snapshot.contentFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.fileName, 'README.md');
});

test('identical raw reads are content-idempotent but read events remain observable', () => {
  const { runtime, snapshot } = setup();
  const duplicate = runtime.createSnapshot({ sourceId: 'T001-S001', content: Buffer.from('stable-content'), scenarioContext: CONTEXT, readAt: '2026-08-24T01:01:00.000Z', readEventId: 'read-duplicate' });
  assert.equal(duplicate.snapshotId, snapshot.snapshotId);
  assert.equal(runtime.listReadEvents(snapshot.snapshotId).some((event) => event.readEventId === 'read-duplicate'), true);
});

test('T008 requires explicit confirmation and cannot be silently changed', () => {
  const { runtime, snapshot } = setup();
  assert.throws(() => runtime.startRun('T003-S001', { scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-other' } }), (error) => error.code === data.ERROR_CODES.T008_CONTEXT_MISMATCH || error.code === data.ERROR_CODES.INVALID_CONTEXT);
  assert.throws(() => runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2026-01-01', confirmedBy: 'u', scenarioContext: CONTEXT }), (error) => error.code === data.ERROR_CODES.IMMUTABLE);
});

test('one stable T002 can carry separate explicit T008 evidence for separate scenario runs', () => {
  const { runtime, snapshot } = setup();
  const other = { ...CONTEXT, scenarioRunId: 'S001-RUN-202608240002' };
  const duplicate = runtime.createSnapshot({ sourceId: 'T001-S001', content: Buffer.from('stable-content'), scenarioContext: other, readEventId: 'read-other-run' });
  assert.equal(duplicate.snapshotId, snapshot.snapshotId);
  const confirmation = runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2025-12-31', confirmedBy: 'other-user', scenarioContext: other });
  assert.notEqual(confirmation.confirmationId, runtime.getT008Confirmation(runtime.getSnapshot(snapshot.snapshotId).t008ConfirmationId).confirmationId);
  assert.equal(runtime.readT008(snapshot.snapshotId, { scenarioContext: other }).asOf, '2025-12-31');
});

test('formal run locks exact T002/T008 at start and rejects input drift on retry', () => {
  const { runtime } = setup();
  const run = runtime.startRun('T003-S001', { scenarioContext: CONTEXT, runId: 'run-one' });
  assert.equal(run.inputLocks[0].snapshotId.startsWith('T002-'), true);
  assert.equal(run.inputLocks[0].t008, '2025-12-31');
  runtime.failRun('run-one', { stage: 'processing', reason: 'temporary failure' });
  assert.throws(() => runtime.retryRun('run-one', { scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-other' } }), (error) => error.code === data.ERROR_CODES.RETRY_DRIFT || error.code === data.ERROR_CODES.INVALID_CONTEXT);
});

test('T003 definition revisions are append-only and a run can pin an exact published revision', () => {
  const { runtime, snapshot } = setup();
  runtime.createPipeline({ pipelineId: 'T003-S001', pipelineVersion: 'T003-S001-v2', name: 'revised', outputAssetId: 'T006-FINANCE', inputSlots: [{ slotId: 'raw-finance', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }] });
  runtime.publishPipeline('T003-S001');
  const pinned = runtime.startRun('T003-S001', { pipelineVersion: 'T003-S001-v2', scenarioContext: CONTEXT });
  assert.equal(pinned.pipelineVersion, 'T003-S001-v2');
  assert.equal(runtime.getPipelineVersion('T003-S001', 'T003-S001-v1').status, 'published');
});

test('hard quality failure blocks T007 and does not create a candidate asset', () => {
  const { runtime } = setup();
  const run = runtime.startRun('T003-S001', { scenarioContext: CONTEXT });
  const failed = runtime.executeRun(run.runId, () => ({ normalised: false }), { qualityChecks: [{ checkId: 'schema', status: 'failed', hard: true, failedCount: 2 }] });
  assert.equal(failed.status, data.STATUS.FAILED);
  assert.throws(() => runtime.publishAsset(run.runId, { assetId: 'T006-FINANCE', members: ['m'] }), (error) => error.code === data.ERROR_CODES.QUALITY_HARD_FAILURE);
  assert.equal(runtime.listAssetVersions('T006-FINANCE').length, 0);
});

test('quality runner executes only caller-supplied structural checks and fails unknown closed', () => {
  const passed = data.runQualityChecks({ rows: 1 }, [{ checkId: 'has-output', hard: true, evaluate: (output) => output.rows > 0 }]);
  assert.equal(passed.status, 'passed');
  const unknown = data.runQualityChecks({}, [{ checkId: 'throws', hard: true, evaluate: () => { throw new Error('dependency unavailable'); } }]);
  assert.equal(unknown.status, 'unknown');
});

test('warning quality requires explicit acknowledgement', () => {
  const { runtime } = setup();
  const run = runtime.startRun('T003-S001', { scenarioContext: CONTEXT });
  runtime.executeRun(run.runId, () => ({ normalised: true }), { qualityChecks: [{ checkId: 'optional', status: 'warning', hard: false }] });
  assert.throws(() => runtime.publishAsset(run.runId, { assetId: 'T006-FINANCE', members: ['m'] }), (error) => error.code === data.ERROR_CODES.WARNING_ACK_REQUIRED);
});

test('cycle detection rejects direct and indirect T007 reuse', () => {
  const { runtime } = setup();
  const { asset } = runAndPublish(runtime);
  assert.throws(() => runtime._checkInputCycle('T006-FINANCE', asset.assetVersionId), (error) => error.code === data.ERROR_CODES.CYCLE);
  assert.deepEqual(data.detectCycle({ a: ['b'], b: ['a'] }), { hasCycle: true, cycle: ['a', 'b', 'a'] });
});

test('same output publishes once and later run reports no data change', () => {
  const { runtime } = setup();
  const first = runAndPublish(runtime);
  const secondRun = runtime.startRun('T003-S001', { scenarioContext: CONTEXT, runNonce: 'second' });
  runtime.executeRun(secondRun.runId, () => ({ normalised: true }), { qualityChecks: [{ checkId: 'structure', status: 'passed', hard: true, checkedCount: 1 }] });
  const second = runtime.publishAsset(secondRun.runId, { assetId: 'T006-FINANCE', members: [{ memberId: 'member-a', grain: 'one-row' }, { memberId: 'member-b', grain: 'one-row' }], relations: [{ relationId: 'relation-a' }], reuseLicense: first.asset.reuseLicense, contentFingerprint: 'same-normalised-output' });
  assert.equal(second.status, 'no-data-change');
  assert.equal(runtime.listAssetVersions('T006-FINANCE').length, 1);
});

test('C003 receipt is exact, append-only and idempotent', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const delivery = runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT });
  assert.equal(asset.publicationState, 'published');
  assert.equal(delivery.immutable, true);
  assert.equal(delivery.publicationState, 'published');
  assert.equal(delivery.qualityStatus, asset.quality.status);
  assert.equal(delivery.assetVersionId, asset.assetVersionId);
  assert.deepEqual(delivery.scenarioContext, asset.scenarioContext);
  assert.equal(Object.isFrozen(delivery), true);
  assert.throws(() => data.validateDelivery({ ...delivery, publicationState: 'candidate' }), (error) => error.code === 'C003_NOT_PUBLISHED');
  const rejectedInput = c003Receipt(delivery, 'rejected', { reason: 'mapping missing', targetDraftVersion: 'draft-1' });
  const rejected = runtime.recordDeliveryReceipt(delivery.deliveryId, rejectedInput);
  assert.equal(rejected.status, 'rejected');
  assert.deepEqual(runtime.recordDeliveryReceipt(delivery.deliveryId, rejectedInput), rejected);
  assert.throws(() => runtime.recordDeliveryReceipt(delivery.deliveryId, c003Receipt(delivery, 'accepted')), (error) => error.code === data.ERROR_CODES.IMMUTABLE);
  assert.deepEqual(runtime.createDelivery({ assetVersionId: asset.assetVersionId, deliveryId: delivery.deliveryId, scenarioContext: CONTEXT }).receipt, rejected);
  assert.throws(() => runtime.createDelivery({ assetVersionId: asset.assetVersionId, deliveryId: 'new-attempt', scenarioContext: CONTEXT }), (error) => error.code === data.ERROR_CODES.C003_REACCEPTANCE_UNSPECIFIED);
});

test('C003 rejects tampered, unpublished, quality-failed and permanently non-consumable T007 inputs', () => {
  const { asset } = runAndPublish(setup().runtime);
  const client = new data.C003Client();
  assert.throws(() => client.createDelivery({ ...asset, immutable: false }), (error) => ['INVALID_T007', 'C003_NOT_IMMUTABLE'].includes(error.code));
  assert.throws(() => client.createDelivery({ ...asset, publicationState: 'candidate' }), (error) => error.code === 'C003_NOT_PUBLISHED');
  assert.throws(() => client.createDelivery({ ...asset, publicationState: 'unpublished' }), (error) => error.code === 'C003_NOT_PUBLISHED');
  assert.throws(() => client.createDelivery({ ...asset, quality: { ...asset.quality, status: 'failed', hardFailure: true } }), (error) => error.code === 'C003_QUALITY_BLOCKED');
  assert.throws(() => client.createDelivery({ ...asset, quality: { ...asset.quality, status: 'unknown' } }), (error) => error.code === 'C003_QUALITY_BLOCKED');
  assert.throws(() => client.createDelivery({ ...asset, purpose: 'non-consumable', consumption: { ...asset.consumption, status: 'permanently-non-consumable' } }), (error) => error.code === 'C003_NOT_CONSUMABLE');
});

test('C032 requires accepted C003 and C028 rejects stale pre-submit discovery', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const delivery = runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT });
  assert.throws(() => runtime.discoverC032({ deliveryId: delivery.deliveryId, scenarioContext: CONTEXT }), (error) => error.code === data.ERROR_CODES.DELIVERY_BLOCKED);
  runtime.recordDeliveryReceipt(delivery.deliveryId, c003Receipt(delivery, 'accepted'));
  const first = runtime.discoverC032({ deliveryId: delivery.deliveryId, response: c032Response('response-1', [{ t054Id: 'T054-1', bindingVersion: 'v1', allowSubmit: true, status: 'available' }]) });
  const drifted = runtime.discoverC032({ deliveryId: delivery.deliveryId, response: c032Response('response-2', [{ t054Id: 'T054-1', bindingVersion: 'v2', allowSubmit: true, status: 'available' }], { responseVersion: 'v2' }) });
  assert.throws(() => runtime.submitC028({ deliveryId: delivery.deliveryId, discovery: first, reread: drifted, scenarioContext: CONTEXT }), (error) => error.code === data.ERROR_CODES.INPUT_DRIFT);
});

test('C028/C029 preserve exact context and distinguish accepted request from result', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const delivery = runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT });
  runtime.recordDeliveryReceipt(delivery.deliveryId, c003Receipt(delivery, 'accepted'));
  const response = runtime.discoverC032({ deliveryId: delivery.deliveryId, response: c032Response('response-main', [{ t054Id: 'T054-1', bindingVersion: 'v1', allowSubmit: true, status: 'available' }]) });
  const requestId = 'request-main';
  const request = runtime.submitC028({ deliveryId: delivery.deliveryId, discovery: response, reread: response, scenarioContext: CONTEXT, requestId, receipt: c028Receipt(requestId, asset.assetVersionId) });
  assert.equal(request.status, 'accepted');
  const result = runtime.recordC029(request.requestId, c029Result('result-main', request.requestId, asset.assetVersionId, 'failed', { reason: 'incompatible' }));
  assert.equal(result.status, 'failed');
  assert.equal(runtime.getC028(request.requestId).status, 'accepted');
});

test('C029 processing to terminal transition keeps the same result history without rewriting request identity', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const delivery = runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT });
  runtime.recordDeliveryReceipt(delivery.deliveryId, c003Receipt(delivery, 'accepted'));
  const discovery = runtime.discoverC032({ deliveryId: delivery.deliveryId, response: c032Response('response-transition', [{ t054Id: 'target', bindingVersion: '1', allowSubmit: true, status: 'available' }]) });
  const transitionRequestId = 'request-transition';
  const request = runtime.submitC028({ deliveryId: delivery.deliveryId, discovery, reread: discovery, scenarioContext: CONTEXT, requestId: transitionRequestId, receipt: c028Receipt(transitionRequestId, asset.assetVersionId) });
  const processing = runtime.recordC029(request.requestId, c029Result('result-transition', request.requestId, asset.assetVersionId, 'processing'));
  const terminal = runtime.recordC029(request.requestId, c029Result('result-transition', request.requestId, asset.assetVersionId, 'succeeded'));
  assert.equal(processing.resultId, terminal.resultId);
  assert.equal(runtime.getC029('result-transition').status, 'succeeded');
});

test('C017 creates two immutable summaries, five dimensions and restricted consumer projection', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const read = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT, consumer: 'intelligent-query', purpose: 'intelligent-query', requestedBy: 'm03' });
  assert.equal(read.versionBindingSummary.summaryType, 'version-bound');
  assert.equal(read.currentStateSummary.summaryType, 'current-state');
  assert.equal(read.projection.assetVersionId, asset.assetVersionId);
  assert.equal(read.projection.fiveDimensions.replayVerification.status, 'not-executed');
  assert.equal('rows' in read.projection, false);
  assert.equal('records' in read.projection, false);
  assert.throws(() => read.projection.assetVersionId = 'other', TypeError);
  assert.ok(runtime.listEvents().some((event) => event.eventType === 'C017_READ'));
  const second = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT, consumer: 'intelligent-query', purpose: 'intelligent-query', requestedBy: 'm03', readId: 'read-second' });
  assert.equal(second.versionBindingSummary.summaryId, read.versionBindingSummary.summaryId);
  assert.notEqual(second.currentStateSummary.summaryId, read.currentStateSummary.summaryId);
});

test('C017 decision-center projection is smaller than the general consumer projection', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const read = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT, consumer: 'decision-center', purpose: 'decision-gate' });
  assert.equal(read.projection.consumer, 'decision-center');
  assert.equal('quality' in read.projection, false);
  assert.equal(typeof read.projection.currentQualityStatus, 'string');
  assert.equal('sourceFields' in read.projection, false);
});

test('C017 rejects unknown consumers instead of widening or silently downgrading the projection', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  assert.throws(() => runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT, consumer: 'unregistered-consumer' }), (error) => error.code === 'CONSUMER_NOT_ALLOWED');
});

test('confirmed post-publish hard finding blocks C017 but leaves T005/T007 immutable', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const finding = runtime.recordPostPublishFinding({ assetVersionId: asset.assetVersionId, findingId: 'finding-1', hard: true, reason: 'integrity evidence', affectedMembers: ['member-a'] });
  runtime.confirmPostPublishFinding(finding.findingId, { confirmedBy: 'u' });
  const read = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: CONTEXT, consumer: 'report' });
  assert.equal(read.currentStateSummary.dataSideQualification, 'prohibited');
  assert.equal(read.currentStateSummary.hardQualityFailure, true);
  assert.equal(runtime.getAssetVersion(asset.assetVersionId).quality.status, 'passed');
});

test('S003 compatibility T007 is permanently non-consumable and cannot enter C028', () => {
  const runtime = data.createDataRuntime({ clock });
  const s003 = { ...CONTEXT, scenarioId: 'S003', scenarioVersion: 'S003-v1', scenarioRunId: 'S003-RUN-1' };
  runtime.registerSource({ sourceId: 'T001-S003', name: 'Compatibility workbook', category: 'manual-workbook', readMethod: 'upload' });
  const snapshot = runtime.createSnapshot({ sourceId: 'T001-S003', content: 'compatibility', scenarioContext: s003 });
  runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2025-12-31', confirmedBy: 'u', scenarioContext: s003 });
  runtime.createPipeline({ pipelineId: 'T003-S003', name: 'compatibility', outputAssetId: 'T006-S003', inputSlots: [{ slotId: 'input', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }] });
  runtime.publishPipeline('T003-S003');
  const run = runtime.startRun('T003-S003', { scenarioContext: s003 });
  runtime.executeRun(run.runId, () => ({ compatibility: true }), { qualityChecks: [{ checkId: 'structure', status: 'passed', hard: true }] });
  const asset = runtime.publishAsset(run.runId, { assetId: 'T006-S003', purpose: 'compatibility', compatibilityOnly: true, members: [{ memberId: 'financial-data' }, { memberId: 'adjustment-factors' }], relations: [] });
  assert.equal(asset.compatibilityOnly, true);
  assert.equal(asset.consumable, false);
  assert.equal(asset.reusable, false);
  assert.throws(() => runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: s003 }), (error) => error.code === data.ERROR_CODES.S003_NOT_CONSUMABLE);
  assert.throws(() => runtime.createDelivery({ assetVersionId: asset.assetVersionId, scenarioContext: s003, purpose: 'compatibility-validation' }), (error) => error.code === data.ERROR_CODES.S003_NOT_CONSUMABLE);
  const summary = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: s003, consumer: 'report' });
  assert.equal(summary.projection.dataSideQualification, 'prohibited');
});

test('client adapters enforce exact C003/C032/C028/C029 echoes and duplicate calls', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const provider = {
    receiveC003: (delivery) => ({ schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C003', deliveryId: delivery.deliveryId, assetVersionId: delivery.assetVersionId, status: 'accepted', scenarioContext: delivery.scenarioContext }),
    discoverC032: (request) => ({ schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C032', responseId: 'resp-1', responseVersion: '1', status: 'available', assetId: request.assetId, scenarioContext: request.scenarioContext, candidates: [{ t054Id: 'target-1', bindingVersion: '1', allowSubmit: true, status: 'available' }] }),
    submitC028: (request) => ({ schemaVersion: data.DATA_SCHEMA_VERSION, contractCode: 'C028', requestId: request.requestId, assetVersionId: request.assetVersionId, status: 'accepted', scenarioContext: request.scenarioContext })
  };
  const c003 = new data.C003Client({ provider });
  const delivery = c003.createDelivery(asset, { scenarioContext: CONTEXT, deliveryId: 'delivery-1' });
  const receipt = c003.send(delivery);
  assert.equal(c003.send(delivery), receipt);
  const c032 = new data.C032Client({ provider });
  const discovery = c032.discover({ assetId: asset.assetId, delivery: { ...delivery, status: 'accepted' }, scenarioContext: CONTEXT });
  const target = c032.selectAvailable(discovery, 'target-1');
  const c028 = new data.C028Client({ provider });
  const request = c028.submit({ delivery: { ...delivery, status: 'accepted' }, discovery, reread: discovery, selectedTarget: target, scenarioContext: CONTEXT });
  assert.equal(request.status, 'accepted');
  const c029 = new data.C029Client();
  assert.throws(() => c029.accept({ result: { ...c029Result('r', request.requestId, asset.assetVersionId, 'succeeded'), scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-other' } }, request }), (error) => error.code === 'SCENARIO_CONTEXT_MISMATCH');
});

test('client communication uncertainty stays unknown and is never upgraded to success', () => {
  const { runtime, asset } = runAndPublish(setup().runtime);
  const c003 = new data.C003Client({ provider: () => { throw new Error('network'); } });
  const delivery = c003.createDelivery(asset, { scenarioContext: CONTEXT, deliveryId: 'uncertain-delivery' });
  const receipt = c003.send(delivery, { onProviderError: 'unknown' });
  assert.equal(receipt.status, 'unknown');
  const c032 = new data.C032Client({ provider: () => { throw new Error('network'); } });
  const discovery = c032.discover({ assetId: asset.assetId, scenarioContext: CONTEXT, delivery: { ...delivery, status: 'accepted' } });
  assert.equal(discovery.status, 'read-failed');
  assert.throws(() => new data.C028Client({ provider: () => { throw new Error('network'); } }).submit({ delivery: { ...delivery, status: 'accepted', consumptionStatus: 'candidate' }, discovery, scenarioContext: CONTEXT }), (error) => error.code === 'C032_NOT_AVAILABLE');
});
