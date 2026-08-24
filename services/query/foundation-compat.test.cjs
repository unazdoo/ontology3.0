'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const contracts = require('../../packages/contracts');
const checkpoint = require('../../packages/checkpoint');
const compat = require('./foundation-compat');
const query = require('./index');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-M03-COMPAT-1',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function c011Payload(overrides = {}) {
  return {
    schemaVersion: compat.C011_SCHEMA_VERSION,
    contractCode: 'C011',
    requestId: 'ACTION-M03-COMPAT-1',
    idempotencyKey: `idem-v1:${'a'.repeat(64)}`,
    scenarioContext: { ...CONTEXT },
    scenarioRunId: CONTEXT.scenarioRunId,
    sourceModule: 'M03',
    sourceResultId: 'C010-RESULT-1',
    targetStableId: 'SUBJECT-1',
    actionTypeId: 'ACTION-1',
    publishedOntologyVersion: 'PUB-S001-v1',
    dataVersion: 'DATA-S001-v1',
    t019Id: 'T019-S001-v1',
    requestedAt: '2026-08-24T00:00:01.000Z',
    evidenceRefs: [{ evidenceType: 'C010', evidenceId: 'C010-E1' }],
    createsDecision: false,
    createsTodo: false,
    sendsNotification: false,
    ...overrides
  };
}

test('M03 uses Foundation strict C033 and rejects unknown or mismatched context fields', () => {
  assert.equal(compat.validateStrictScenarioContext(CONTEXT).valid, true);
  assert.equal(compat.validateStrictScenarioContext({ ...CONTEXT, futureField: true }).valid, false);
  assert.equal(compat.validateStrictScenarioContext({ ...CONTEXT, scenarioRunId: 'S002-RUN-1' }).valid, false);
  assert.throws(
    () => compat.strictScenarioContext({ ...CONTEXT, futureField: true }),
    (error) => error.code === 'ERR_M03_FOUNDATION_CONTEXT'
  );
});

test('M03 Contract Envelope is strict, propagates trace context, and fails closed on drift', () => {
  const payload = c011Payload();
  const envelope = compat.createC011Envelope(payload, {
    occurredAt: '2026-08-24T00:00:02.000Z',
    traceId: 'trace-incoming',
    correlationId: 'correlation-incoming'
  });
  assert.equal(envelope.schemaVersion, contracts.SCHEMA_VERSION);
  assert.equal(envelope.traceId, 'trace-incoming');
  assert.equal(envelope.correlationId, 'correlation-incoming');
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(compat.validateM03Envelope(envelope, { contractCode: 'C011' }).valid, true);

  const unknownTopLevel = compat.validateM03Envelope({ ...envelope, undeclared: true });
  assert.equal(unknownTopLevel.valid, false);
  const unknownContext = compat.validateM03Envelope({
    ...envelope,
    scenarioContext: { ...envelope.scenarioContext, undeclared: true }
  });
  assert.equal(unknownContext.valid, false);
  const payloadDrift = compat.validateM03Envelope({
    ...envelope,
    payload: { ...envelope.payload, idempotencyKey: `idem-v1:${'b'.repeat(64)}` }
  });
  assert.equal(payloadDrift.valid, false);
  assert.throws(
    () => compat.createC011Envelope({ ...payload, schemaVersion: 'ofw.m03.c011.request.v1' }),
    (error) => error.code === 'ERR_M03_ENVELOPE_PAYLOAD'
  );
});

test('M03 applies Foundation compatibility policy as exact-only by default', () => {
  assert.equal(
    compat.classifyFoundationSchemaCompatibility('draft-0.1.0', 'draft-0.1.0').status,
    contracts.COMPATIBILITY_STATUS.EXACT
  );
  assert.equal(
    compat.classifyFoundationSchemaCompatibility('draft-0.1.0', 'draft-0.1.1').status,
    contracts.COMPATIBILITY_STATUS.REVIEW
  );
  assert.throws(
    () => compat.assertFoundationSchemaCompatibility('draft-0.1.0', 'draft-0.1.1'),
    (error) => error.code === 'ERR_M03_SCHEMA_COMPATIBILITY'
  );
  assert.throws(
    () => compat.assertFoundationSchemaCompatibility('draft-0.1.0', '1.0.0'),
    (error) => error.code === 'ERR_M03_SCHEMA_COMPATIBILITY'
  );
});

test('M03 C034 provider exports and validates an immutable checkpoint, then isolates recovery', () => {
  const provider = compat.createM03C034Provider({ state: { queryRunIds: ['QRUN-1'], candidateCount: 1 } });
  assert.equal(provider.spiVersion, checkpoint.PROVIDER_SPI_VERSION);
  assert.equal(provider.schemaVersion, checkpoint.CHECKPOINT_SCHEMA_VERSION);
  const exported = provider.export({ scenarioContext: CONTEXT });
  assert.equal(exported.moduleId, 'M03');
  assert.equal(exported.baselineVersion, compat.M03_BASELINE_VERSION);
  assert.equal(exported.baselineSnapshotId, compat.M03_BASELINE_SNAPSHOT_ID);
  assert.equal(Object.isFrozen(exported), true);
  assert.equal(provider.validate(exported).ok, true);

  const restored = provider.cloneRestore(exported, {
    runIdFactory: (scenarioId, details) => `${scenarioId}-RUN-${details.operation}-new`
  });
  assert.notEqual(restored.targetScenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(restored.overwritesHistory, false);
  assert.equal(restored.overwritesSource, false);
  assert.equal(restored.replayHistoricalSideEffects, false);
  assert.deepEqual(restored.replayedSideEffects, []);
  assert.equal(restored.sideEffectsSuppressed, true);

  const replay = provider.isolatedReplay(exported, {
    runIdFactory: (scenarioId, details) => `${scenarioId}-RUN-${details.operation}-new`
  });
  assert.equal(replay.replayAccepted, true);
  assert.equal(replay.sideEffectsSuppressed, true);
  assert.deepEqual(replay.replayedSideEffects, []);
});

test('M03 C034 rejects foreign, unknown, mismatched, and side-effectful checkpoint state', () => {
  const provider = compat.createM03C034Provider({ state: {} });
  const exported = provider.export({ scenarioContext: CONTEXT });
  assert.equal(provider.validate({ ...exported, undeclared: true }).ok, false);
  assert.equal(provider.validate({ ...exported, moduleId: 'M01' }).ok, false);
  assert.equal(provider.validate({ ...exported, schemaVersion: 'ofw.c034.checkpoint.v2' }).ok, false);
  assert.equal(provider.validate({ ...exported, scenarioContext: { ...CONTEXT, futureField: true } }).ok, false);
  assert.throws(
    () => compat.createM03C034Provider({ state: { replayedNotifications: [{ id: 'N-1' }] } }).export({ scenarioContext: CONTEXT }),
    (error) => error.code === 'ERR_M03_C034_SIDE_EFFECT'
  );
  const foreign = { ...exported, moduleId: 'M01' };
  assert.throws(
    () => provider.cloneRestore(foreign, { runIdFactory: (scenarioId) => `${scenarioId}-RUN-new` }),
    (error) => error.code === 'ERR_M03_C034_CHECKPOINT_INVALID'
  );
});

test('M03 exposes the compatibility boundary without changing the standard C011 builder', () => {
  assert.equal(query.createC034Provider, compat.createM03C034Provider);
  assert.equal(query.createC011Envelope, compat.createC011Envelope);
  const payload = c011Payload();
  const before = JSON.stringify(payload);
  const envelope = query.createC011Envelope(payload, { occurredAt: '2026-08-24T00:00:03.000Z' });
  assert.equal(JSON.stringify(payload), before);
  assert.equal(envelope.payload.contractCode, 'C011');
});

