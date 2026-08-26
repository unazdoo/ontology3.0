'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const rules = require('./rule-runtime');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-RULE-1',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

function input(overrides = {}) {
  return {
    scenarioContext: CONTEXT,
    configurationVersion: 'CFG-v1',
    promptVersion: 'PROMPT-v1',
    skillVersions: [{ skillId: 'skill.query', version: '1' }],
    toolAllowlist: ['tool.semantic.v1'],
    publishedOntologyVersion: 'PUB-v1',
    dataVersion: 'DATA-v1',
    t008: { id: 'T008-v1', value: '2026-08-23' },
    generatedAt: '2026-08-24T00:01:00.000Z',
    c008: { status: 'ready', publishedOntologyVersion: 'PUB-v1' },
    t019: { status: 'published', publishedOntologyVersion: 'PUB-v1' },
    c017: { qualityStatus: 'passed', freshnessStatus: 'current', dataVersion: 'DATA-v1' },
    permission: true,
    metrics: { 'MET-COST': 7 },
    parameters: { threshold: 6 },
    rules: [{
      ruleId: 'RULE-PARAM',
      ruleVersion: '1',
      status: 'PUBLISHED',
      publishedOntologyVersion: 'PUB-v1',
      condition: { operator: 'gte', left: { metricId: 'MET-COST' }, right: { parameter: 'threshold' } },
      evidenceRefs: [{ evidenceType: 'E-Rule', evidenceId: 'RULE-E1' }]
    }],
    ...overrides
  };
}

test('Rule runtime evaluates only Published parameterized definitions and records a hit fact', () => {
  const result = rules.evaluateRun(input());
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.ruleHits.length, 1);
  assert.equal(result.ruleHits[0].outcome, rules.RULE_OUTCOMES.HIT);
  assert.equal(result.ruleHits[0].branches[0].conditions[0].expectedValue, 6);
  assert.equal(result.runtimeSnapshot.publishedOntologyVersion, 'PUB-v1');
});

test('unresolved parameters and unknown quality fail closed without inventing thresholds', () => {
  const unknown = rules.safeEvaluateRun(input({ parameters: {}, generatedAt: '2026-08-24T00:02:00.000Z' }));
  assert.equal(unknown.status, 'BLOCKED');
  assert.equal(unknown.unanswerableReasons[0].code, rules.BLOCK_CODES.UNKNOWN_STATE);
  const qualityUnknown = rules.safeEvaluateRun(input({ c017: { qualityStatus: 'unknown', freshnessStatus: 'current', dataVersion: 'DATA-v1' }, generatedAt: '2026-08-24T00:03:00.000Z' }));
  assert.equal(qualityUnknown.status, 'BLOCKED');
  assert.equal(qualityUnknown.unanswerableReasons[0].code, rules.BLOCK_CODES.UNKNOWN_STATE);
  assert.throws(() => rules.evaluateRule({ ruleId: 'R', ruleVersion: '1', status: 'PUBLISHED', recommendedThreshold: 3, condition: { operator: 'gte', left: 1, right: 2 } }, {}), (error) => error.code === rules.BLOCK_CODES.CONTEXT_INCOMPLETE);
});

test('hard quality, permission, idempotency and candidate expiry are fail closed', () => {
  const blocked = rules.safeEvaluateRun(input({ c017: { qualityStatus: 'failed', freshnessStatus: 'current', dataVersion: 'DATA-v1', hardQualityFailure: true }, generatedAt: '2026-08-24T00:04:00.000Z' }));
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.unanswerableReasons[0].code, rules.BLOCK_CODES.HARD_QUALITY_FAILURE);
  const denied = rules.safeEvaluateRun(input({ permission: false, generatedAt: '2026-08-24T00:05:00.000Z' }));
  assert.equal(denied.status, 'BLOCKED');
  assert.equal(denied.unanswerableReasons[0].code, rules.BLOCK_CODES.PERMISSION_DENIED);
  const runtime = rules.createRuleRuntime({ clock: () => new Date('2026-08-24T00:06:00.000Z') });
  const first = runtime.execute(input({ idempotencyKey: 'RULE-IDEM-1' }));
  const duplicate = runtime.execute(input({ idempotencyKey: 'RULE-IDEM-1' }));
  assert.deepEqual(duplicate, first);
  assert.throws(() => runtime.execute(input({ idempotencyKey: 'RULE-IDEM-1', dataVersion: 'DATA-OTHER' })), (error) => error.code === rules.BLOCK_CODES.IDEMPOTENCY_CONFLICT);
  const candidate = rules.createCandidate(first.ruleHits[0], input().rules[0], first.runtimeSnapshot, { candidateValidity: { validUntil: '2026-08-23T00:00:00.000Z' }, subjectRef: { id: 'SUBJECT-1' } });
  assert.equal(rules.validateCandidate(candidate, { now: '2026-08-24T00:00:00.000Z' }).valid, false);
  assert.equal(rules.validateCandidate(candidate, { now: '2026-08-24T00:00:00.000Z' }).errors[0].code, rules.BLOCK_CODES.CANDIDATE_EXPIRED);
});
