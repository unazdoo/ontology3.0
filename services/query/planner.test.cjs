'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createQueryPlanner,
  CandidateRegistry,
  ERROR_CODES,
  evaluateRule,
  candidateValidity,
  SCHEMA_VERSIONS
} = require('./planner');
const evidence = require('./evidence');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-M03-TEST',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
});

const C008 = Object.freeze({
  schemaVersion: 'ofw.m01.c008.v1',
  contractCode: 'C008',
  sourceModule: 'M01',
  sourceId: 'M01:C008',
  projectionId: 'C008-S001-1',
  projectionVersion: 1,
  formedAt: '2026-08-24T00:00:01.000Z',
  readStatus: 'ready',
  scenarioContext: CONTEXT,
  current: {
    combinationId: 'T019-S001-1',
    t019Id: 'T019-S001-1',
    semanticVersionId: 'PUB-S001-v1',
    publishedSemanticVersion: 'S001-ONTO-v1',
    t017Id: 'T017-S001-v1',
    dataVersion: 'T007-S001-v1',
    consumableDataVersion: 'T007-S001-v1',
    dataAsOf: '2025-12-31',
    t008: '2025-12-31',
    t006Id: 'T006-S001',
    evidenceRefs: [{ evidenceType: 'T019', evidenceId: 'T019-E1' }]
  },
  candidateValidation: null,
  readOnly: true
});

const C017 = Object.freeze({
  schemaVersion: 'm02-data.draft.v1',
  contractCode: 'C017',
  consumer: 'intelligent-query',
  summaryId: 'C017-S001-1',
  summaryVersion: '1',
  scenarioContext: CONTEXT,
  assetVersionId: 'T007-S001-v1',
  t007Id: 'T007-S001-v1',
  asOfTime: '2025-12-31',
  t008: '2025-12-31',
  dataSideQualification: 'allowed',
  quality: { status: 'passed', hardFailure: false },
  freshness: { status: 'current' },
  evidence: [{ evidenceType: 'T005', evidenceId: 'T005-E1' }]
});

const CONFIG = Object.freeze({
  schemaVersion: 'ofw.m03.c009.v1',
  configId: 'C009-S001-IQ',
  configVersion: 'C009-S001-v1',
  promptVersion: 'PROMPT-S001-v1',
  skillSet: ['skill.semantic-query.v1', 'skill.evidence.v1'],
  loadedSkillSet: ['skill.evidence.v1', 'skill.semantic-query.v1'],
  toolAllowlist: ['tool.semantic-read.v1'],
  availableTools: ['tool.semantic-read.v1'],
  publishedOntologyVersion: 'PUB-S001-v1',
  resourceAllowlist: ['MET-COST', 'RULE-COST', 'ACTION-OPTIMIZE'],
  enabled: true,
  scenarioContext: CONTEXT,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveTo: '2027-01-01T00:00:00.000Z',
  evaluationTime: '2026-08-24T00:00:02.000Z'
});

function makePlanner(overrides = {}) {
  return createQueryPlanner({
    scenarioContext: CONTEXT,
    c008Reader: () => C008,
    c017Reader: () => C017,
    config: CONFIG,
    permissions: { c008: true, c017: true },
    clock: () => '2026-08-24T00:01:00.000Z',
    ...overrides
  });
}

function query(overrides = {}) {
  return {
    question: '查询融资成本',
    finalUnderstanding: '查询融资成本',
    objectRefs: [{ id: 'OBJ-SUBJECT', type: 'Object' }],
    metricRefs: [{ id: 'MET-COST', type: 'Metric' }],
    ruleRefs: [{ id: 'RULE-COST', type: 'Rule' }],
    scope: { objects: [{ id: 'SUBJECT-1', label: '示例主体' }, { id: 'SUBJECT-1', label: '重复主体' }] },
    ...overrides
  };
}

function result() {
  return {
    metrics: [{ metricId: 'MET-COST', value: 4.2, unit: '%', evidenceRefs: [{ evidenceType: 'E-Metric', evidenceId: 'MET-E1' }] }],
    rules: [{ ruleId: 'RULE-COST', ruleVersion: '1', status: 'hit', branches: [{ branchId: 'b1', status: 'hit' }], evidenceRefs: [{ evidenceType: 'E-Rule', evidenceId: 'RULE-E1' }] }],
    rows: [{ resultItemId: 'SUBJECT-1', value: 4.2, unit: '%', evidenceRefs: [{ evidenceType: 'E-Object', evidenceId: 'OBJ-E1' }] }]
  };
}

test('plan fixes all seven run context groups and is deterministic', () => {
  const planner = makePlanner();
  const first = planner.plan({ query: query() });
  const second = planner.plan({ query: query({ scope: { objects: [{ id: 'SUBJECT-1' }] } }) });
  assert.equal(first.status, 'executable');
  assert.equal(first.scenarioContext.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(first.configuration.configVersion, CONFIG.configVersion);
  assert.equal(first.configuration.promptVersion, CONFIG.promptVersion);
  assert.deepEqual(first.configuration.skillSet.slice().sort(), CONFIG.skillSet.slice().sort());
  assert.deepEqual(first.configuration.toolAllowlist, CONFIG.toolAllowlist);
  assert.equal(first.semantic.publishedVersionId, C008.current.semanticVersionId);
  assert.equal(first.data.dataVersion, C008.current.dataVersion);
  assert.equal(first.data.t008, C008.current.dataAsOf);
  assert.deepEqual(first.scope.duplicates, ['SUBJECT-1']);
  assert.notEqual(first.planFingerprint, second.planFingerprint, 'changing query scope must make a new plan');
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.query), true);
});

test('execution produces a fixed C010 result and repeated idempotent call returns the same run', () => {
  const planner = makePlanner();
  const plan = planner.plan({ query: query() });
  const input = { plan, idempotencyKey: 'query-idem-1', generatedAt: '2026-08-24T00:02:00.000Z' };
  const first = planner.execute(input, () => result());
  const duplicate = planner.execute(input, () => ({ rows: [] }));
  assert.equal(first.status, 'completed');
  assert.equal(first.result.contractCode, 'C010');
  assert.equal(first.result.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(first.result.configuration.configVersion, CONFIG.configVersion);
  assert.equal(first.result.publishedVersionId, C008.current.semanticVersionId);
  assert.equal(first.result.dataVersion, C008.current.dataVersion);
  assert.equal(first.result.t008, C008.current.dataAsOf);
  assert.equal(first.result.structuredResult.deterministic, true);
  assert.equal(first.result.evidenceMapping.length >= 3, true);
  assert.equal(duplicate.runId, first.runId);
  assert.equal(duplicate.result.fingerprint, first.result.fingerprint);
});

test('parameterized Rule evaluation never invents Q001/Q002/Q004 thresholds', () => {
  const hit = evaluateRule({
    ruleId: 'RULE-PARAM',
    branches: [{ branchId: 'high', metricId: 'MET-X', operator: 'gte', threshold: 7, evidenceRefs: ['RULE-E'] }]
  }, { 'MET-X': 7 });
  assert.equal(hit.status, 'hit');
  assert.equal(hit.branches[0].threshold, 7);
  const unknown = evaluateRule({
    ruleId: 'RULE-UNRESOLVED',
    branches: [{ branchId: 'pending', metricId: 'MET-X', operator: 'gte' }]
  }, { 'MET-X': 7 });
  assert.equal(unknown.status, 'unknown');
  assert.equal(unknown.reasonCode, 'RULE_NOT_DETERMINABLE');
  const missing = evaluateRule({
    ruleId: 'RULE-MISSING',
    branches: [{ branchId: 'missing', metricId: 'MET-X', operator: 'missing', evidenceRefs: ['RULE-E2'] }]
  }, {});
  assert.equal(missing.status, 'hit');
});

test('C008/C017 hard failure, version mismatch, unknown and permission failure are fail-closed', () => {
  const cases = [
    { overrides: { permissions: {} }, code: ERROR_CODES.PERMISSION_DENIED },
    { overrides: { c008Reader: () => ({ ...C008, readStatus: 'failed', current: null }) }, code: ERROR_CODES.UNKNOWN_STATE },
    { overrides: { c017Reader: () => ({ ...C017, dataSideQualification: 'prohibited', hardQualityFailure: true }) }, code: ERROR_CODES.C017_HARD_QUALITY_FAILURE },
    { overrides: { c017Reader: () => ({ ...C017, assetVersionId: 'T007-OTHER', t007Id: 'T007-OTHER' }) }, code: ERROR_CODES.C017_VERSION_MISMATCH },
    { overrides: { c017Reader: () => ({ ...C017, freshness: { status: 'unknown' } }) }, code: ERROR_CODES.C017_FRESHNESS_UNKNOWN }
  ];
  for (const item of cases) {
    const planner = makePlanner(item.overrides);
    assert.throws(() => planner.plan({ query: query() }), (error) => error.code === item.code, item.code);
    const blocked = planner.run({ query: query() }, () => result());
    assert.equal(blocked.result.status, 'not-answerable');
    assert.equal(blocked.result.answerable, false);
    assert.equal(blocked.result.notAnswerableReason.code, item.code);
  }
});

test('a failed context reread does not borrow prior run versions into the blocked result', () => {
  const planner = makePlanner();
  const first = planner.run({ query: query(), generatedAt: '2026-08-24T00:02:30.000Z' }, () => result());
  assert.equal(first.status, 'completed');
  const blocked = planner.run({
    query: query(),
    c017: { ...C017, assetVersionId: 'T007-OTHER', t007Id: 'T007-OTHER' },
    generatedAt: '2026-08-24T00:02:31.000Z'
  }, () => result());
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.result.status, 'not-answerable');
  assert.equal(blocked.result.dataVersion, null);
  assert.equal(blocked.result.configuration, null);
});

test('Skill and Tool proof compares pinned versions, not display names only', () => {
  const planner = makePlanner({
    config: {
      ...CONFIG,
      skillSet: [{ id: 'skill.semantic-query', version: 'v2' }],
      loadedSkillSet: [{ id: 'skill.semantic-query', version: 'v1' }],
      toolAllowlist: [{ id: 'tool.semantic-read', version: 'v1' }],
      availableTools: [{ id: 'tool.semantic-read', version: 'v1' }]
    }
  });
  assert.throws(() => planner.plan({ query: query() }), (error) => error.code === ERROR_CODES.CONFIG_CAPABILITY_UNPROVEN);
});

test('retry keeps exact plan and rejects context or plan drift', () => {
  const planner = makePlanner();
  const plan = planner.plan({ query: query() });
  const failed = planner.execute({ plan, idempotencyKey: 'query-failed', throwOnFailure: false }, () => {
    throw new Error('temporary executor failure');
  });
  assert.equal(failed.status, 'failed');
  const retry = planner.retry(failed.runId, { idempotencyKey: 'query-retry', generatedAt: '2026-08-24T00:03:00.000Z' }, () => result());
  assert.equal(retry.status, 'completed');
  assert.equal(retry.retryOf, failed.runId);
  assert.equal(retry.planFingerprint, failed.planFingerprint);
  assert.throws(() => planner.retry(failed.runId, { scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-OTHER' } }, () => result()), (error) => error.code === ERROR_CODES.RETRY_DRIFT || error.code === ERROR_CODES.SCENARIO_CONTEXT_MISMATCH);
});

test('output verification rejects a T019/data change between planning and result fixation', () => {
  let c008Reads = 0;
  const planner = makePlanner({
    c008Reader: () => {
      c008Reads += 1;
      return c008Reads === 1 ? C008 : { ...C008, current: { ...C008.current, dataVersion: 'T007-CHANGED' } };
    }
  });
  const plan = planner.plan({ query: query() });
  const run = planner.execute({ plan, throwOnFailure: false }, () => result());
  assert.equal(run.status, 'failed');
  assert.equal([ERROR_CODES.RESULT_VERSION_MISMATCH, ERROR_CODES.C008_VERSION_MISSING].includes(run.failure.code), true);
  assert.equal(run.result.answerable, false);
});

test('only a fixed result with one hit Rule can produce standard C011', () => {
  const planner = makePlanner();
  const plan = planner.plan({ query: query() });
  const run = planner.execute({ plan, generatedAt: '2026-08-24T00:04:00.000Z' }, () => result());
  const request = planner.buildC011(run, {
    target: { stableId: 'SUBJECT-1', name: '示例主体' },
    actionType: { actionTypeId: 'ACTION-OPTIMIZE', name: '优化建议' },
    metricSnapshot: { 'MET-COST': 4.2 }
  });
  assert.equal(request.contractCode, 'C011');
  assert.equal(request.schemaVersion, SCHEMA_VERSIONS.C011);
  assert.equal(request.schemaVersion, evidence.C011_SCHEMA_VERSION);
  assert.equal(request.scenarioContext.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(request.sourceRunId, run.runId);
  assert.equal(request.sourceResultId, run.result.resultId);
  assert.equal(request.m03CreatesDecision, false);
  assert.equal(request.m03CreatesTodo, false);
  assert.equal(request.m03SendsNotification, false);
  assert.equal(request.evidenceRefs.length > 0, true);
  assert.throws(() => planner.buildC011(run, { target: { stableId: 'SUBJECT-1' } }), (error) => error.code === ERROR_CODES.C011_INVALID);
});

test('C011 rejects the retired request schema and a different scenario run', () => {
  const planner = makePlanner();
  const plan = planner.plan({ query: query() });
  const run = planner.execute({ plan, generatedAt: '2026-08-24T00:04:30.000Z' }, () => result());
  const request = planner.buildC011(run, {
    target: { stableId: 'SUBJECT-1', name: '示例主体' },
    actionType: { actionTypeId: 'ACTION-OPTIMIZE', name: '优化建议' }
  });
  const retired = { ...request, schemaVersion: 'ofw.m03.c011.request.v1' };
  assert.equal(evidence.validateC011Request(retired).valid, false);
  assert.equal(evidence.validateC011Request(retired).errors[0].code, 'ERR_C011_SCHEMA_MISMATCH');
  assert.throws(() => evidence.assertC011Request(retired), (error) => error.code === 'ERR_C011_SCHEMA_MISMATCH');

  const wrongRun = { ...request, scenarioRunId: 'S001-RUN-OTHER' };
  assert.equal(evidence.validateC011Request(wrongRun).valid, false);
});

test('candidate expiry remains conditional until an expiry is provided; expired candidate is rejected', () => {
  assert.equal(candidateValidity({ status: 'passed' }, '2026-08-24T00:00:00.000Z').status, 'conditional');
  assert.equal(candidateValidity({ status: 'passed', expiresAt: '2026-08-25T00:00:00.000Z' }, '2026-08-24T00:00:00.000Z').status, 'valid');
  assert.equal(candidateValidity({ status: 'passed', expiresAt: '2026-08-24T00:00:00.000Z' }, '2026-08-24T00:00:00.000Z').status, 'expired');

  const registry = new CandidateRegistry({ clock: () => '2026-08-24T00:00:00.000Z' });
  const candidate = registry.create({
    candidateId: 'CANDIDATE-1',
    scenarioContext: CONTEXT,
    semanticVersionId: C008.current.semanticVersionId,
    dataVersion: C008.current.dataVersion,
    questionSetVersion: 'QUESTIONS-v1',
    status: 'passed',
    evidenceRefs: ['CAND-E1']
  });
  const first = registry.submit(candidate.candidateId, { scenarioContext: CONTEXT, idempotencyKey: 'candidate-submit-1' });
  const duplicate = registry.submit(candidate.candidateId, { scenarioContext: CONTEXT, idempotencyKey: 'candidate-submit-1' });
  assert.equal(first.candidateId, duplicate.candidateId);
  assert.equal(first.idempotencyKey, duplicate.idempotencyKey);
});

test('query input cannot smuggle physical rows, SQL or source fields', () => {
  const planner = makePlanner();
  assert.throws(() => planner.plan({ query: query({ rows: [{ secret: 1 }] }) }), (error) => error.code === ERROR_CODES.FORBIDDEN_QUERY_INPUT);
  assert.throws(() => planner.plan({ query: query({ sql: 'select 1' }) }), (error) => error.code === ERROR_CODES.FORBIDDEN_QUERY_INPUT);
});

test('explicit ambiguity yields a non-executable clarification plan', () => {
  const planner = makePlanner();
  const plan = planner.plan({ query: query({ clarificationRequired: true }) });
  assert.equal(plan.status, 'clarification-required');
  assert.throws(() => planner.execute({ plan }), (error) => error.code === ERROR_CODES.PLAN_NOT_EXECUTABLE);
});
