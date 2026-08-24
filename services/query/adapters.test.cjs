'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const adapters = require('./adapters');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-ADAPTER-1',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function c008(status = 'ready', extra = {}) {
  return {
    projectionId: adapters.C008_PROJECTION_ID,
    schemaVersion: adapters.C008_SCHEMA_VERSION,
    readStatus: status,
    scenarioContext: CONTEXT,
    t019: {
      bindingId: 'T019-S001-1',
      status: 'active',
      lifecycleStatus: 'active',
      publishedOntologyVersion: 'PUB-S001-1',
      dataVersion: 'DATA-S001-1',
      t007Id: 'T007-S001-1',
      evidenceRefs: [{ evidenceType: 'T019', evidenceId: 'T019-E1' }]
    },
    current: {
      status: 'current',
      lifecycleStatus: 'published',
      bindingStatus: 'active',
      t019Id: 'T019-S001-1',
      semanticVersionId: 'PUB-S001-1',
      publishedSemanticVersion: 'PUB-S001-1',
      dataVersion: 'DATA-S001-1',
      dataAsOf: '2026-08-23'
    },
    publishedOntology: { version: 'PUB-S001-1', status: 'PUBLISHED', resourceRefs: [] },
    t008: { id: 'T008-S001-1', value: '2026-08-23', evidenceRefs: [{ evidenceType: 'T008', evidenceId: 'T008-E1' }] },
    ...extra
  };
}

function c017(extra = {}) {
  return {
    projectionId: adapters.C017_PROJECTION_ID,
    schemaVersion: adapters.C017_SCHEMA_VERSION,
    contractCode: 'C017',
    consumer: 'M03',
    scenarioContext: CONTEXT,
    t007: { id: 'T007-S001-1', dataVersion: 'DATA-S001-1' },
    t019: { bindingId: 'T019-S001-1', publishedOntologyVersion: 'PUB-S001-1' },
    t008: { id: 'T008-S001-1', value: '2026-08-23', evidenceRefs: [{ evidenceType: 'T008', evidenceId: 'T008-E1' }] },
    status: 'ready',
    quality: { status: 'passed', hardFailure: false, evidenceRefs: [{ evidenceType: 'Q', evidenceId: 'Q-E1' }] },
    freshness: { status: 'current', evidenceRefs: [{ evidenceType: 'F', evidenceId: 'F-E1' }] },
    eligibility: 'allowed',
    bindingSummary: { id: 'BIND-SUMMARY-1', version: '1' },
    currentStatusSummary: { id: 'CURRENT-SUMMARY-1', version: '1' },
    evidenceRefs: [{ evidenceType: 'C017', evidenceId: 'C017-E1' }],
    ...extra
  };
}

test('C008/T019 adapter reads a fresh projection and returns a frozen canonical view', () => {
  let reads = 0;
  const adapter = adapters.createC008T019Adapter(() => { reads += 1; return c008(); });
  const result = adapter.read(CONTEXT);
  assert.equal(reads, 1);
  assert.equal(result.contractCode, 'C008');
  assert.equal(result.sourceModule, 'M01');
  assert.equal(result.current.semanticVersionId, 'PUB-S001-1');
  assert.equal(result.current.dataVersion, 'DATA-S001-1');
  assert.equal(result.readOnly, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.current), true);
});

test('C008 adapter rejects unknown/legacy/partial states and context drift', () => {
  const unknown = adapters.createC008T019Adapter(() => c008('unknown')).read(CONTEXT);
  assert.equal(unknown.consumable, false);
  assert.throws(() => adapters.createC008T019Adapter(() => c008('ready', { v16: {} })).read(CONTEXT), (error) => error.code === 'ERR_C008_LEGACY_STATE');
  assert.throws(() => adapters.createC008T019Adapter(() => c008('ready', { scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-OTHER' } })).read(CONTEXT), (error) => error.code === 'ERR_QUERY_CONTEXT_MISMATCH');
  assert.throws(() => adapters.createC008T019Adapter(() => c008('empty', { t019: { dataVersion: 'DATA-S001-1' } })).read(CONTEXT), (error) => error.code === 'ERR_C008_EMPTY_HAS_BINDING');
});

test('C008 real M01 pointer shape requires an explicit semantic lifecycle', () => {
  const positive = adapters.createC008T019Adapter(() => c008()).read(CONTEXT);
  assert.equal(positive.current.status, 'current');
  assert.equal(positive.current.lifecycleStatus, 'published');
  const missing = c008();
  delete missing.current.lifecycleStatus;
  delete missing.publishedOntology;
  assert.throws(
    () => adapters.createC008T019Adapter(() => missing).read(CONTEXT),
    (error) => error.code === 'ERR_C008_NOT_PUBLISHED'
  );
});

test('C017 adapter exposes only restricted quality/freshness projection and blocks permission/details', () => {
  const result = adapters.createC017Adapter(() => c017()).read(CONTEXT);
  assert.equal(result.contractCode, 'C017');
  assert.equal(result.consumerId, 'M03');
  assert.equal(result.consumable, true);
  assert.equal(result.t007.dataVersion, 'DATA-S001-1');
  assert.equal(result.t008.value, '2026-08-23');
  assert.equal(result.readOnly, true);
  const denied = adapters.createC017Adapter(() => c017({ permissionStatus: 'denied' })).read(CONTEXT);
  assert.equal(denied.consumable, false);
  assert.equal(denied.blockingReason, 'permission-denied');
  assert.throws(() => adapters.createC017Adapter(() => c017({ rows: [] })).read(CONTEXT), (error) => error.code === 'ERR_C017_BUSINESS_DETAIL_EXPOSED');
  const unknown = adapters.createC017Adapter(() => c017({ quality: { status: 'unknown' } })).read(CONTEXT);
  assert.equal(unknown.consumable, false);
  assert.equal(unknown.blockingReason, 'unknown-state');
});
