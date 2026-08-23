'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const contracts = require('..');

const validContext = () => ({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-202608240001',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

const validEnvelope = () => ({
  eventId: 'evt-001',
  eventType: 'foundation.test',
  schemaVersion: 'draft-0.1.0',
  occurredAt: '2026-08-24T00:00:01.000Z',
  actorRef: 'actor-001',
  correlationId: 'corr-001',
  traceId: 'trace-001',
  idempotencyKey: 'idem-001',
  scenarioContext: validContext(),
  resourceRefs: [{ refType: 'dataset', refId: 'dataset-001', refVersion: 'v1' }],
  evidenceRefs: [{ evidenceType: 'snapshot', evidenceId: 'evidence-001' }],
  payload: { value: 1 }
});

test('exports draft schemas and stable metadata', () => {
  assert.equal(contracts.SCHEMA_VERSION, 'draft-0.1.0');
  assert.equal(contracts.SCHEMA_DRAFT, 'http://json-schema.org/draft-07/schema#');
  for (const schema of Object.values(contracts.schemas).filter((value, index, values) => values.indexOf(value) === index)) {
    assert.equal(schema['x-contract-status'], 'draft');
    assert.equal(schema['x-contract-version'], 'draft-0.1.0');
    assert.equal(schema.$schema, contracts.SCHEMA_DRAFT);
  }
});

test('accepts a legal C033 scenario context', () => {
  const result = contracts.validateScenarioContext(validContext());
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.deepEqual(contracts.assertScenarioContext(validContext()), validContext());
});

test('rejects a context without scenarioId', () => {
  const context = validContext();
  delete context.scenarioId;
  const result = contracts.validateScenarioContext(context);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.path.endsWith('.scenarioId') && error.code === 'required'));
});

test('rejects a context without scenarioRunId', () => {
  const context = validContext();
  delete context.scenarioRunId;
  const result = contracts.validateScenarioContext(context);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.path.endsWith('.scenarioRunId') && error.code === 'required'));
});

test('rejects scenario version and run prefix mismatch', () => {
  const context = validContext();
  context.scenarioVersion = 'S002-v1';
  context.scenarioRunId = 'S002-RUN-1';
  const result = contracts.validateScenarioContext(context);
  assert.equal(result.valid, false);
  assert.equal(result.errors.filter((error) => error.code === 'mismatch').length, 2);
});

test('normalizes reference aliases without mutating input', () => {
  const input = { resourceType: 'dataset', resourceId: 'D-1', version: 'v2' };
  const normalized = contracts.normalizeResourceRef(input);
  assert.equal(normalized.refType, 'dataset');
  assert.equal(normalized.refId, 'D-1');
  assert.equal(normalized.refVersion, 'v2');
  assert.equal(input.refId, undefined);
  assert.equal(contracts.validateResourceRef(input).valid, true);
});

test('accepts a legal Envelope and rejects missing required fields', () => {
  const envelope = validEnvelope();
  assert.equal(contracts.validateContractEnvelope(envelope).valid, true);
  envelope.payload = null;
  assert.equal(contracts.validateContractEnvelope(envelope).valid, true);
  envelope.payload = { value: 1 };
  assert.deepEqual(contracts.createContractEnvelope(envelope).payload, { value: 1 });
  delete envelope.evidenceRefs;
  assert.equal(contracts.validateContractEnvelope(envelope).valid, false);
  assert.throws(() => contracts.assertContractEnvelope(envelope), (error) => {
    assert.equal(error.code, 'ERR_CONTRACT_VALIDATION');
    return error.errors.some((item) => item.path.endsWith('.evidenceRefs'));
  });
});

test('validates the minimum audit field structure', () => {
  const audit = {
    actorRef: { refType: 'user', refId: 'u-1' },
    traceId: 'trace-1',
    correlationId: 'corr-1',
    scenarioContext: validContext(),
    sourceVersion: 'v1.1.0',
    targetVersion: 'implementation-0.1.0',
    formedAt: '2026-08-24T00:00:02.000Z',
    operation: 'contract.validate',
    outcome: 'accepted'
  };
  assert.equal(contracts.validateAuditFields(audit).valid, true);
  delete audit.outcome;
  assert.equal(contracts.validateAuditFields(audit).valid, false);
});

test('strict mode can reject unknown fields while default draft mode permits them', () => {
  const context = { ...validContext(), futureField: 'allowed in draft' };
  assert.equal(contracts.validateScenarioContext(context).valid, true);
  assert.equal(contracts.validateScenarioContext(context, { allowUnknown: false }).valid, false);
});
