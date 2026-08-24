'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const data = require('./');
const foundationCheckpoint = require('../../packages/checkpoint');

const context = Object.freeze({
  scenarioId: 'S001', scenarioVersion: 'S001-v1', scenarioRunId: 'S001-RUN-checkpoint',
  formedAt: '2026-08-24T00:00:00.000Z', status: 'active'
});

function runtimeWithRun() {
  const runtime = data.createDataRuntime({ clock: () => new Date('2026-08-24T01:00:00.000Z') });
  runtime.registerSource({ sourceId: 'source-cp', name: 'source' });
  const snapshot = runtime.createSnapshot({ sourceId: 'source-cp', content: 'checkpoint-content', scenarioContext: context });
  runtime.confirmAsOf(snapshot.snapshotId, { asOf: '2025-12-31', confirmedBy: 'owner', scenarioContext: context });
  runtime.createPipeline({ pipelineId: 'pipeline-cp', pipelineVersion: 'v1', name: 'pipeline', outputAssetId: 'asset-cp', inputSlots: [{ slotId: 'input', input: { kind: 'T002', snapshotId: snapshot.snapshotId } }] });
  runtime.publishPipeline('pipeline-cp');
  const run = runtime.runPipeline('pipeline-cp', { scenarioContext: context, executor: () => ({ stable: true }), qualityChecks: [{ checkId: 'shape', status: 'passed', hard: true }] });
  runtime.publishAsset(run.runId, { assetId: 'asset-cp', members: ['member-cp'], contentFingerprint: 'checkpoint-output' });
  return runtime;
}

test('M02 C034 provider exports immutable reference-only exact-version state', () => {
  const runtime = runtimeWithRun();
  const provider = data.createM02CheckpointProvider(runtime);
  assert.equal(provider.spiVersion, foundationCheckpoint.PROVIDER_SPI_VERSION);
  assert.equal(provider.schemaVersion, foundationCheckpoint.CHECKPOINT_SCHEMA_VERSION);
  foundationCheckpoint.assertProvider(provider);
  const exported = provider.export({ scenarioContext: context });
  assert.equal(exported.moduleId, 'M02');
  assert.equal(exported.moduleSchemaVersion, data.DATA_SCHEMA_VERSION);
  assert.equal(exported.restoreReadiness.status, 'not-verified');
  assert.equal(Object.isFrozen(exported), true);
  assert.equal('content' in exported.state.snapshotRefs[0], false);
  assert.equal(provider.validate(exported).ok, true);
  assert.deepEqual(provider.export({ scenarioContext: context }), exported);
});

test('M02 checkpoint rejects unknown fields, tampering and non-exact context', () => {
  const runtime = runtimeWithRun();
  const provider = data.createM02CheckpointProvider(runtime);
  const exported = provider.export({ scenarioContext: context });
  const unknown = JSON.parse(JSON.stringify(exported));
  unknown.state.future = true;
  assert.equal(provider.validate(unknown).ok, false);
  const tampered = JSON.parse(JSON.stringify(exported));
  tampered.state.runIds.push('unknown-run');
  assert.equal(provider.validate(tampered).ok, false);
  const unlockedS003 = JSON.parse(JSON.stringify(exported));
  unlockedS003.state.s003CompatibilityLocks = [{ assetVersionId: 'S003-T007', compatibilityOnly: true, consumable: true, reusable: false }];
  unlockedS003.stateFingerprint = data.contentFingerprint(unlockedS003.state);
  assert.equal(provider.validate(unlockedS003).ok, false);
  assert.throws(() => provider.export({ scenarioContext: { ...context, future: true } }), (error) => error.code === 'INVALID_SCENARIO_CONTEXT');
});

test('unverified restore is blocked; verified restore creates only a protected new-run plan', () => {
  const runtime = runtimeWithRun();
  const defaultProvider = data.createM02CheckpointProvider(runtime);
  const unverified = defaultProvider.export({ scenarioContext: context });
  assert.throws(() => defaultProvider.cloneRestore(unverified), (error) => error.code === 'CHECKPOINT_NOT_RESTORABLE');

  const provider = data.createM02CheckpointProvider(runtime, { verifyReferences: () => true });
  const verified = provider.export({ scenarioContext: context });
  const beforeRuns = runtime.runs.size;
  const plan = provider.cloneRestore(verified, {
    runIdFactory: () => 'S001-RUN-restored',
    now: '2026-08-24T02:00:00.000Z'
  });
  assert.equal(plan.sourceScenarioRunId, context.scenarioRunId);
  assert.equal(plan.targetScenarioRunId, 'S001-RUN-restored');
  assert.equal(plan.overwritesSource, false);
  assert.equal(plan.replayHistoricalSideEffects, false);
  assert.equal(plan.sideEffectsSuppressed, true);
  assert.equal(runtime.runs.size, beforeRuns, 'C034 plan does not materialize or execute M02 state');
});

test('isolated replay remains side-effect suppressed and source checkpoint unchanged', () => {
  const runtime = runtimeWithRun();
  const provider = data.createM02CheckpointProvider(runtime, { verifyReferences: () => true });
  const source = provider.export({ scenarioContext: context });
  const before = JSON.stringify(source);
  const replay = provider.isolatedReplay(source, { runIdFactory: () => 'S001-RUN-replay' });
  assert.equal(replay.sideEffectPolicy.allowExternalDispatch, false);
  assert.equal(replay.newScenarioRunId, 'S001-RUN-replay');
  assert.equal(JSON.stringify(source), before);
});
