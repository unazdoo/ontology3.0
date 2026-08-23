'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const identity = require('./index.js');

const context = () => ({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-202608240001',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

const request = (overrides = {}) => ({
  idempotencyKey: identity.generateIdempotencyKey({
    schemaVersion: 'ofw.test.v1',
    eventType: 'test.request',
    operation: 'validate',
    scenarioContext: context(),
    payload: { value: 1 }
  }),
  schemaVersion: 'ofw.test.v1',
  eventType: 'test.request',
  operation: 'validate',
  scenarioContext: context(),
  payload: { value: 1 },
  ...overrides
});

test('validates a legal C033 context and exposes ok compatibility', () => {
  const result = identity.validateScenarioContext(context());
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(result.ok, true);
  assert.deepEqual(identity.assertScenarioContext(context()), context());
});

test('rejects missing scenarioId and scenarioRunId', () => {
  const value = context();
  delete value.scenarioId;
  delete value.scenarioRunId;
  const result = identity.validateScenarioContext(value);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.path.endsWith('.scenarioId')));
  assert.ok(result.errors.some((item) => item.path.endsWith('.scenarioRunId')));
});

test('rejects scenario version/run prefix mismatch', () => {
  const value = context();
  value.scenarioVersion = 'S002-v1';
  value.scenarioRunId = 'S002-RUN-1';
  const result = identity.validateScenarioContext(value);
  assert.equal(result.valid, false);
  assert.equal(result.errors.filter((item) => item.code === 'mismatch').length, 2);
});

test('compares the same run context and has stable serialization/fingerprint', () => {
  const left = context();
  const right = { status: 'completed', scenarioRunId: left.scenarioRunId, scenarioVersion: left.scenarioVersion, scenarioId: left.scenarioId, formedAt: left.formedAt };
  assert.equal(identity.sameRunContext(left, right), true);
  assert.equal(identity.sameRunContext(left, { ...right, scenarioRunId: 'S001-RUN-other' }), false);
  assert.equal(identity.stableSerialize({ b: 2, a: 1 }), identity.stableSerialize({ a: 1, b: 2 }));
  assert.equal(identity.contextFingerprint(left), identity.contextFingerprint({ ...left }));
  assert.notEqual(identity.contextFingerprint(left), identity.contextFingerprint({ ...left, scenarioVersion: 'S001-v2', scenarioRunId: 'S001-RUN-new' }));
  assert.notEqual(identity.contextFingerprint(left), identity.contextFingerprint({ ...left, status: 'completed' }));
  assert.equal(identity.contextFingerprint(left, { includeLifecycle: false }), identity.contextFingerprint({ ...left, status: 'completed' }, { includeLifecycle: false }));
});

test('generates and validates deterministic idempotency keys', () => {
  const a = { operation: 'op', schemaVersion: 'v1', payload: { b: 2, a: 1 } };
  const b = { payload: { a: 1, b: 2 }, schemaVersion: 'v1', operation: 'op' };
  const key = identity.generateIdempotencyKey(a);
  assert.equal(key, identity.generateIdempotencyKey(b));
  assert.equal(identity.validateIdempotencyKey(key).valid, true);
  assert.equal(identity.validateIdempotencyKey(key, { strictGenerated: true }).valid, true);
  assert.equal(identity.validateIdempotencyKey({ idempotencyKey: key }).valid, true);
  assert.equal(identity.isValidIdempotencyKey('bad key'), false);
});

test('recognizes duplicate requests without mutating the seen index', () => {
  const first = request();
  const seen = new Map([[first.idempotencyKey, first]]);
  const before = Array.from(seen.entries());
  const duplicate = identity.identifyDuplicateRequest({ ...first, traceId: 'different-trace' }, seen);
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.sideEffectAllowed, false);
  assert.deepEqual(Array.from(seen.entries()), before);
});

test('a compact remembered record remains duplicate-detectable', () => {
  const first = request();
  const remembered = identity.rememberRequest({}, first);
  const duplicate = identity.identifyDuplicateRequest(first, remembered);
  assert.equal(duplicate.status, 'duplicate');
});

test('a key-only seen index is treated as a duplicate without side effects', () => {
  const first = request();
  const duplicate = identity.identifyDuplicateRequest(first, new Set([first.idempotencyKey]));
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(duplicate.sideEffectAllowed, false);
});

test('same idempotency key with a different schema version is a conflict', () => {
  const first = request();
  const seen = new Map([[first.idempotencyKey, first]]);
  const conflict = identity.identifyDuplicateRequest({ ...first, schemaVersion: 'ofw.test.v2' }, seen);
  assert.equal(conflict.status, 'conflict');
  assert.equal(conflict.reason, 'schema-version-conflict');
  assert.equal(conflict.sideEffectAllowed, false);
});

test('trace and correlation IDs propagate without overwriting the source', () => {
  const source = { traceId: 'trace-1', correlationId: 'corr-1' };
  const target = identity.propagateTraceContext(source, { payload: { ok: true } });
  assert.deepEqual(target.traceId, 'trace-1');
  assert.deepEqual(target.correlationId, 'corr-1');
  assert.deepEqual(source, { traceId: 'trace-1', correlationId: 'corr-1' });
});

test('raw key requests and target trace context remain compatible', () => {
  const key = identity.generateIdempotencyKey({ operation: 'raw' });
  assert.equal(identity.identifyDuplicateRequest(key, new Set([key])).status, 'duplicate');
  const target = identity.propagateTraceContext({}, { traceId: 'target-trace', correlationId: 'target-correlation' });
  assert.equal(target.traceId, 'target-trace');
  assert.equal(target.correlationId, 'target-correlation');
});
