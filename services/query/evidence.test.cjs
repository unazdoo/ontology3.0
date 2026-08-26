'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const evidence = require('./evidence');
const foundation = require('./foundation-compat');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-EVIDENCE-1',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

const CONFIG = Object.freeze({
  configId: 'C009-S001',
  configVersion: 'CFG-S001-v1',
  promptVersion: 'PROMPT-S001-v1',
  skillVersions: [{ skillId: 'skill.query', version: '1' }],
  toolAllowlist: [{ toolId: 'tool.semantic', version: '1' }],
  publishedOntologyVersion: 'PUB-S001-v1',
  resourceWhitelist: [{ resourceId: 'ACTION-OPTIMIZE', version: 'PUB-S001-v1', kind: 'ActionType' }]
});

function fact(overrides = {}) {
  return evidence.createResultFact({
    scenarioContext: CONTEXT,
    configuration: CONFIG,
    publishedOntologyVersion: 'PUB-S001-v1',
    dataVersion: 'DATA-S001-v1',
    t019Id: 'T019-S001-v1',
    t008: { id: 'T008-S001-v1', value: '2026-08-23', evidenceRefs: [{ evidenceType: 'T008', evidenceId: 'T008-E1' }] },
    originalQuestion: '查询融资成本',
    finalUnderstanding: '查询融资成本',
    structuredResult: {
      rows: [{ resultItemId: 'SUBJECT-1', value: 4.2, unit: '%', evidenceRefs: [{ evidenceType: 'E-Object', evidenceId: 'ROW-E1' }] }],
      metrics: [{ metricId: 'MET-COST', value: 4.2, evidenceRefs: [{ evidenceType: 'E-Metric', evidenceId: 'MET-E1' }] }],
      rules: [{ ruleId: 'RULE-COST', ruleVersion: '1', status: 'hit', branch: 'hit', evidenceRefs: [{ evidenceType: 'E-Rule', evidenceId: 'RULE-E1' }] }]
    },
    quality: { status: 'passed', evidenceRefs: [{ evidenceType: 'QUALITY', evidenceId: 'Q-E1' }] },
    freshness: { status: 'current', evidenceRefs: [{ evidenceType: 'FRESHNESS', evidenceId: 'F-E1' }] },
    generatedAt: '2026-08-24T00:01:00.000Z',
    ...overrides
  });
}

test('C010 result fact pins all run versions, result identity, evidence and generation time', () => {
  const result = fact();
  assert.equal(result.contractCode, 'C010');
  assert.equal(result.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(result.configuration.promptVersion, CONFIG.promptVersion);
  assert.equal(result.publishedOntologyVersion, 'PUB-S001-v1');
  assert.equal(result.dataVersion, 'DATA-S001-v1');
  assert.equal(result.t008.id, 'T008-S001-v1');
  assert.equal(result.evidenceMapping.length >= 3, true);
  assert.equal(result.deterministic, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(evidence.validateResultFact(result, { scenarioContext: CONTEXT }).valid, true);
});

test('C010 blocks missing evidence and version mismatch', () => {
  assert.throws(() => fact({ structuredResult: { rows: [{ resultItemId: 'ROW-1', value: 1 }] } }), (error) => error.code === 'ERR_C010_EVIDENCE_MISSING');
  const result = fact();
  const mismatch = evidence.validateResultFact(result, { dataVersion: 'DATA-OTHER' });
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.errors[0].code, 'ERR_C010_VERSION_MISMATCH');
  assert.throws(() => fact({ structuredResult: { rows: [{ resultItemId: 'ROW-1', value: 1, sourceFields: { secret: 1 }, evidenceRefs: [{ evidenceId: 'E1' }] }] } }), (error) => error.code === 'ERR_C010_SOURCE_DATA_FORBIDDEN');
});

test('C010 preserves a blocked run as a not-answerable fact without fabricating data', () => {
  const result = fact({ status: 'not-answerable', notAnswerableReason: { code: 'QUALITY_UNKNOWN' }, structuredResult: null });
  assert.equal(result.answerable, false);
  assert.equal(result.status, 'not-answerable');
  assert.equal(result.structuredResult.rows.length, 0);
  assert.equal(result.notAnswerableReason.code, 'QUALITY_UNKNOWN');
});

test('CSV is generated deterministically from complete fixed rows and excludes source fields', () => {
  const result = fact();
  const csv = evidence.createCsv(result);
  assert.equal(csv.rowCount, 1);
  assert.match(csv.content, /scenarioRunId/);
  assert.match(csv.content, /SUBJECT-1/);
  assert.match(csv.content, /ROW-E1/);
  assert.doesNotMatch(csv.content, /workbook|sourceFields|physicalFields/);
  assert.equal(evidence.createCsv(result).content, csv.content);
});

test('C018 separates query definition/display preference and C011 is one standard request with no decision side effect', () => {
  const result = fact();
  const view = evidence.createQueryView({ result, queryDefinition: { objectId: 'SUBJECT-1', metricId: 'MET-COST' }, displayPreferences: { mode: 'table' } });
  assert.equal(view.contractCode, 'C018');
  assert.deepEqual(view.queryDefinition, { objectId: 'SUBJECT-1', metricId: 'MET-COST' });
  assert.deepEqual(view.displayPreferences, { mode: 'table' });
  const action = { actionTypeId: 'ACTION-OPTIMIZE', version: 'PUB-S001-v1', status: 'published' };
  const request = evidence.buildC011Request({ result, target: { stableId: 'SUBJECT-1', name: '主体' }, actionType: action });
  assert.equal(request.contractCode, 'C011');
  assert.equal(request.targetStableId, 'SUBJECT-1');
  assert.equal(request.createsDecision, false);
  assert.equal(request.createsTodo, false);
  assert.equal(evidence.validateC011Request(request).valid, true);
  assert.equal(evidence.validateC011Request({ ...request, schemaVersion: 'ofw.m03.c011.request.v1' }).valid, false);
  assert.equal(evidence.validateC011Request({ ...request, scenarioRunId: 'S001-RUN-OTHER' }).valid, false);
  const enveloped = evidence.submitC011({ result, target: { stableId: 'SUBJECT-1', name: '主体' }, actionType: action, requestId: 'ACTION-ENVELOPE', includeEnvelope: true }, () => ({ requestId: 'EXT-ENVELOPE' }));
  assert.equal(enveloped.status, 'submitted');
  assert.equal(foundation.validateM03Envelope(enveloped.envelope, { contractCode: 'C011' }).valid, true);
  assert.equal(enveloped.envelope.payload.contractCode, 'C011');
  const seen = new Map([[request.idempotencyKey, request]]);
  const duplicate = evidence.submitC011({ result, target: { stableId: 'SUBJECT-1', name: '主体' }, actionType: action, requestId: request.requestId }, () => { throw new Error('must not call owner on duplicate'); }, seen);
  assert.equal(duplicate.status, 'duplicate');
  assert.throws(() => evidence.submitC011({ result, target: { stableId: 'SUBJECT-2', name: '另一个主体' }, actionType: action, requestId: request.requestId, idempotencyKey: request.idempotencyKey }, () => { throw new Error('must not call owner on conflict'); }, seen), (error) => error.code === 'ERR_C011_IDEMPOTENCY_CONFLICT');
  const unknown = evidence.submitC011({ result, target: { stableId: 'SUBJECT-1', name: '主体' }, actionType: action, requestId: 'ACTION-UNKNOWN' }, () => { throw Object.assign(new Error('timeout'), { code: 'TIMEOUT' }); });
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.retryAllowed, false);
  const ledger = evidence.createC011Submitter();
  let calls = 0;
  const submitted = ledger.submit({ result, target: { stableId: 'SUBJECT-1', name: '主体' }, actionType: action, requestId: 'ACTION-LEDGER' }, () => { calls += 1; return { requestId: 'EXT-1' }; });
  const repeated = ledger.submit({ result, target: { stableId: 'SUBJECT-1', name: '主体' }, actionType: action, requestId: 'ACTION-LEDGER' }, () => { calls += 1; return { requestId: 'EXT-2' }; });
  assert.equal(submitted.status, 'submitted');
  assert.equal(repeated.status, 'duplicate');
  assert.equal(calls, 1);
});
