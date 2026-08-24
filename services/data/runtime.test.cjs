'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DataPipelineRuntime,
  DataRuntimeError,
  ERROR_CODES,
  QUALITY_STATUS,
  detectCycle,
  evaluateQualityChecks,
  fingerprint
} = require('./runtime');

const context = (runId = 'S001-RUN-1') => ({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: runId,
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function makeRuntime() {
  let tick = 0;
  return new DataPipelineRuntime({
    clock: () => new Date(Date.UTC(2026, 7, 24, 0, 0, tick++)),
    idFactory: (prefix, value) => `${prefix}-${fingerprint(value).slice(0, 10)}`
  });
}

function sourceAndSnapshot(runtime, runContext = context()) {
  runtime.registerSource({ sourceId: 'SRC-1', name: 'uploaded workbook' });
  const snapshot = runtime.createSnapshot({
    sourceId: 'SRC-1',
    snapshotId: `SNAP-${runContext.scenarioRunId}`,
    fileName: 'input.csv',
    content: 'id,value\n1,10\n',
    scenarioContext: runContext
  });
  const confirmation = runtime.confirmAsOf(snapshot.snapshotId, {
    asOf: '2026-08-23T00:00:00.000Z',
    confirmedBy: 'user-1',
    basis: 'signed-source-note',
    scenarioContext: runContext
  });
  return { snapshot: runtime.getSnapshot(snapshot.snapshotId), confirmation };
}

function publishedPipeline(runtime, snapshotId, outputAssetId = 'T006-ASSET') {
  runtime.createPipeline({
    pipelineId: 'T003-PIPE',
    pipelineVersion: 'v1',
    name: 'controlled pipeline',
    outputAssetId,
    inputSlots: [{ slotId: 'source', input: { kind: 'T002', snapshotId } }],
    processingModule: { moduleId: 'T004-PREBUILT', version: 'v1' },
    qualityChecks: [{ ruleId: 'shape', hard: true }]
  });
  return runtime.publishPipeline('T003-PIPE');
}

function successfulRun(runtime, runContext = context(), outputAssetId = 'T006-ASSET', checks, options = {}) {
  const { snapshot } = options.snapshot ? { snapshot: options.snapshot } : sourceAndSnapshot(runtime, runContext);
  const pipelineId = options.pipelineId || `T003-PIPE-${runContext.scenarioRunId}`;
  if (!runtime.pipelines.has(pipelineId)) {
    runtime.createPipeline({
      pipelineId,
      pipelineVersion: 'v1',
      name: 'controlled pipeline',
      outputAssetId,
      inputSlots: [{ slotId: 'source', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }],
      processingModule: { moduleId: 'T004-PREBUILT', version: 'v1' },
      qualityChecks: [{ ruleId: 'shape', hard: true }]
    });
    runtime.publishPipeline(pipelineId);
  }
  const run = runtime.startRun(pipelineId, {
    scenarioContext: runContext,
    idempotencyKey: `run-${runContext.scenarioRunId}`
  });
  runtime.recordQuality(run.runId, { checks: checks || [{ ruleId: 'shape', status: 'passed', hard: true }] });
  return { run: runtime.getRun(run.runId), snapshot };
}

test('T002 stores the actual content fingerprint/read event and requires explicit T008', () => {
  const runtime = makeRuntime();
  const { snapshot, confirmation } = sourceAndSnapshot(runtime);
  assert.equal(snapshot.resourceType, 'T002');
  assert.notEqual(snapshot.contentHash, 'not-a-real-hash');
  assert.match(snapshot.contentHash, /^[a-f0-9]{64}$/);
  assert.ok(snapshot.readEventId);
  assert.equal(snapshot.t008ConfirmationId, confirmation.confirmationId);
  assert.throws(
    () => runtime.startRun('missing', { scenarioContext: context() }),
    (error) => error.code === ERROR_CODES.NOT_FOUND
  );
  assert.ok(Object.isFrozen(snapshot));
  assert.throws(() => { snapshot.contentHash = 'changed'; }, TypeError);
});

test('T008 confirmation is bound to one C033 run and cannot be reused after a reset', () => {
  const runtime = makeRuntime();
  const first = sourceAndSnapshot(runtime, context('S001-RUN-1'));
  runtime.createPipeline({
    pipelineId: 'P', name: 'P', outputAssetId: 'A',
    inputSlots: [{ slotId: 'in', input: { kind: 'T002', snapshotId: first.snapshot.snapshotId } }]
  });
  runtime.publishPipeline('P');
  assert.throws(
    () => runtime.startRun('P', { scenarioContext: context('S001-RUN-2'), idempotencyKey: 'different-run' }),
    (error) => error.code === ERROR_CODES.T008_CONTEXT_MISMATCH
  );
});

test('published T003 rejects graph cycles and formal run locks exact input content', () => {
  assert.deepEqual(detectCycle({ a: ['b'], b: ['a'] }).hasCycle, true);
  const runtime = makeRuntime();
  const { snapshot } = sourceAndSnapshot(runtime);
  publishedPipeline(runtime, snapshot.snapshotId);
  const run = runtime.startRun('T003-PIPE', { scenarioContext: context(), idempotencyKey: 'lock-1' });
  assert.equal(run.status, 'running');
  assert.equal(run.inputLocks[0].kind, 'T002');
  assert.equal(run.inputLocks[0].contentHash, snapshot.contentHash);
  assert.equal(run.inputLocks[0].t008ConfirmationId, snapshot.t008ConfirmationId);
  assert.ok(run.inputLockFingerprint);
});

test('hard quality failure blocks publication and preserves the previous trusted version', () => {
  const runtime = makeRuntime();
  const first = successfulRun(runtime);
  const firstAsset = runtime.publishAsset(first.run.runId, {
    members: [{ memberId: 'member-1' }],
    reuseLicense: { allowed: true }
  });
  const failedContext = context('S001-RUN-2');
  const second = successfulRun(runtime, failedContext, 'T006-ASSET', [{ ruleId: 'key', status: 'failed', hard: true, failedCount: 2 }]);
  assert.equal(second.run.status, 'failed');
  assert.equal(second.run.qualityStatus, QUALITY_STATUS.FAILED);
  assert.throws(
    () => runtime.publishAsset(second.run.runId, { members: [{ memberId: 'member-1' }] }),
    (error) => error.code === ERROR_CODES.QUALITY_HARD_FAILURE
  );
  assert.equal(runtime.currentTrusted('T006-ASSET').assetVersionId, firstAsset.assetVersionId);
  assert.equal(second.run.fallback.currentTrustedVersionId, firstAsset.assetVersionId);
});

test('warning quality requires an explicit acknowledgement and equivalent content is not republished', () => {
  const runtime = makeRuntime();
  const first = successfulRun(runtime, context('S001-RUN-1'), 'A', [{ ruleId: 'shape', status: 'warning', hard: false }]);
  assert.throws(
    () => runtime.publishAsset(first.run.runId, { members: [{ memberId: 'm' }] }),
    (error) => error.code === ERROR_CODES.WARNING_ACK_REQUIRED
  );
  const firstAsset = runtime.publishAsset(first.run.runId, { members: [{ memberId: 'm' }], warningAcknowledgement: 'reviewed', reuseLicense: { allowed: true } });
  assert.equal(firstAsset.resourceType, 'T007');

  // Re-running the same published definition and exact input in the same
  // scenario run must not manufacture an equivalent T007 version.
  const secondRun = runtime.startRun('T003-PIPE-S001-RUN-1', {
    scenarioContext: context('S001-RUN-1'),
    idempotencyKey: 'same-input-second-attempt'
  });
  runtime.recordQuality(secondRun.runId, { checks: [{ ruleId: 'shape', status: 'warning', hard: false }] });
  const second = { run: runtime.getRun(secondRun.runId) };
  const same = runtime.publishAsset(second.run.runId, { members: [{ memberId: 'm' }], warningAcknowledgement: 'reviewed', reuseLicense: { allowed: true } });
  assert.equal(same.status, 'no-data-change');
  assert.equal(runtime.listAssetVersions('A').length, 1);
});

test('retry is idempotent and rejects any input or pipeline drift', () => {
  const runtime = makeRuntime();
  const { snapshot } = sourceAndSnapshot(runtime);
  publishedPipeline(runtime, snapshot.snapshotId);
  const original = runtime.startRun('T003-PIPE', { scenarioContext: context(), idempotencyKey: 'original' });
  runtime.failRun(original.runId, { stage: 'processing', code: 'PROCESSING_FAILED', reason: 'worker unavailable' });
  const retry = runtime.retryRun(original.runId, { idempotencyKey: 'retry-1' });
  assert.notEqual(retry.runId, original.runId);
  assert.equal(retry.retryOf, original.runId);
  assert.equal(retry.inputLockFingerprint, original.inputLockFingerprint);
  assert.equal(runtime.retryRun(original.runId, { idempotencyKey: 'retry-1' }).runId, retry.runId);
  assert.throws(
    () => runtime.retryRun(original.runId, { idempotencyKey: 'retry-drift', scenarioContext: context('S001-RUN-2') }),
    (error) => error.code === ERROR_CODES.RETRY_DRIFT
  );
});

test('follow-latest resolves and freezes the exact T007 at run start', () => {
  const runtime = makeRuntime();
  const c = context();
  const firstRun = successfulRun(runtime, c, 'UPSTREAM', undefined, { pipelineId: 'UPSTREAM-PIPE' });
  const firstAsset = runtime.publishAsset(firstRun.run.runId, { assetId: 'UPSTREAM', members: [{ memberId: 'm' }], reuseLicense: { allowed: true } });
  const consumerPipelineId = 'CONSUMER-PIPE';
  runtime.createPipeline({ pipelineId: consumerPipelineId, name: 'consumer', outputAssetId: 'CONSUMER', inputSlots: [{ slotId: 'upstream', input: { kind: 'T007', assetId: 'UPSTREAM', mode: 'follow-latest', requiredReuseConditions: {} } }] });
  runtime.publishPipeline(consumerPipelineId);
  const run = runtime.startRun(consumerPipelineId, { scenarioContext: c, idempotencyKey: 'follow-one' });
  assert.equal(run.inputLocks[0].assetVersionId, firstAsset.assetVersionId);
  assert.equal(run.inputLocks[0].lockedAt !== undefined, true);
});

test('direct and indirect T007 cycles are rejected, including S003 compatibility versions', () => {
  const runtime = makeRuntime();
  const c = context();
  const { snapshot } = sourceAndSnapshot(runtime, c);
  publishedPipeline(runtime, snapshot.snapshotId, 'A');
  const runA = runtime.startRun('T003-PIPE', { scenarioContext: c, idempotencyKey: 'a' });
  runtime.recordQuality(runA.runId, { checks: [{ ruleId: 'q', status: 'passed', hard: true }] });
  const assetA = runtime.publishAsset(runA.runId, { members: [{ memberId: 'm' }], reuseLicense: { allowed: true } });

  runtime.createPipeline({ pipelineId: 'P-B', name: 'B', outputAssetId: 'B', inputSlots: [{ slotId: 'in', input: { kind: 'T007', assetVersionId: assetA.assetVersionId } }] });
  runtime.publishPipeline('P-B');
  const runB = runtime.startRun('P-B', { scenarioContext: c, idempotencyKey: 'b' });
  runtime.recordQuality(runB.runId, { checks: [{ ruleId: 'q', status: 'passed', hard: true }] });
  const assetB = runtime.publishAsset(runB.runId, { members: [{ memberId: 'm' }], reuseLicense: { allowed: true } });
  assert.throws(
    () => runtime.createPipeline({ pipelineId: 'P-C', name: 'C', outputAssetId: 'A', inputSlots: [{ slotId: 'in', input: { kind: 'T007', assetVersionId: assetB.assetVersionId } }] }),
    (error) => error.code === ERROR_CODES.CYCLE
  );

  const s3 = { ...c, scenarioId: 'S003', scenarioVersion: 'S003-v1', scenarioRunId: 'S003-RUN-1' };
  const r3 = makeRuntime();
  const { snapshot: s3Snapshot } = sourceAndSnapshot(r3, s3);
  r3.createPipeline({ pipelineId: 'P3', name: 'S003 compatibility', outputAssetId: 'S3-A', inputSlots: [{ slotId: 'in', input: { kind: 'T002', snapshotId: s3Snapshot.snapshotId } }] });
  r3.publishPipeline('P3');
  const run3 = r3.startRun('P3', { scenarioContext: s3, idempotencyKey: 's3-run' });
  r3.recordQuality(run3.runId, { checks: [{ ruleId: 'shape', status: 'passed', hard: true }] });
  const compat = r3.publishAsset(run3.runId, { members: [{ memberId: 'financial-data' }, { memberId: 'adjustment-factors' }], compatibilityOnly: true });
  assert.equal(compat.consumption.compatibilityOnly, true);
  assert.equal(compat.consumption.status, 'permanently-non-consumable');
  assert.throws(() => r3.setConsumptionEvidence(compat.assetVersionId, { consumable: true, t019Evidence: { id: 'x' } }), (error) => error.code === ERROR_CODES.S003_NOT_CONSUMABLE);
});

test('C017 projection is restricted, five-dimensional, and blocks confirmed post-publish hard failure', () => {
  const runtime = makeRuntime();
  const { run } = successfulRun(runtime);
  const asset = runtime.publishAsset(run.runId, { members: [{ memberId: 'm' }], reuseLicense: { allowed: true } });
  const normal = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: context(), purpose: 'query', requestedBy: 'm03', readId: 'read-normal' });
  assert.equal(normal.contractCode, 'C017');
  assert.equal(normal.restricted, true);
  assert.deepEqual(Object.keys(normal.currentStateSummary.fiveDimensions || normal.fiveDimensions).sort(), ['contentAccess', 'evidenceCompleteness', 'replayCapability', 'replayVerification', 'versionLocation'].sort());
  assert.equal('content' in normal, false);
  assert.equal('members' in normal, false);
  runtime.recordPostPublishFinding({ findingId: 'F-1', assetVersionId: asset.assetVersionId, hard: true, status: 'pending', reason: 'late check' });
  runtime.confirmPostPublishFinding('F-1', { confirmedBy: 'user-1' });
  const blocked = runtime.readC017({ assetVersionId: asset.assetVersionId, scenarioContext: context(), purpose: 'decision', requestedBy: 'm04', readId: 'read-blocked' });
  assert.equal(blocked.consumer, 'M04');
  assert.equal(blocked.projection.consumer, 'M04');
  assert.equal(blocked.currentStateSummary.currentStateSummary.status, 'data-side-prohibited');
  assert.equal(blocked.projection.currentQualityStatus, 'hard-failed');
  assert.equal(runtime.currentTrusted('T006-ASSET').assetVersionId, asset.assetVersionId, 'historical trusted pointer is not silently rewritten');
});

test('quality helper separates warning, hard failure and unknown', () => {
  assert.equal(evaluateQualityChecks([{ ruleId: 'a', status: 'warning' }]).status, QUALITY_STATUS.WARNING);
  assert.equal(evaluateQualityChecks([{ ruleId: 'a', status: 'failed', hard: true }]).status, QUALITY_STATUS.FAILED);
  assert.equal(evaluateQualityChecks([{ ruleId: 'a', status: 'unknown', hard: true }]).status, QUALITY_STATUS.UNKNOWN);
});

test('errors expose stable M02 code and details', () => {
  const error = new DataRuntimeError(ERROR_CODES.CYCLE, 'cycle', { path: ['a', 'a'] });
  assert.equal(error.code, ERROR_CODES.CYCLE);
  assert.deepEqual(error.details.path, ['a', 'a']);
});
