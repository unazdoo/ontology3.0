'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const query = require('./index');

const CONTEXT = {
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-RUNTIME-1',
  formedAt: '2026-08-24T00:00:00.000Z',
  status: 'active'
};

function fixtures() {
  const c008 = {
    projectionId: query.C008_PROJECTION_ID,
    schemaVersion: '1',
    readStatus: 'ready',
    scenarioContext: CONTEXT,
    current: { status: 'current', lifecycleStatus: 'published', bindingStatus: 'active', t019Id: 'T019-1', publishedOntologyVersion: 'PUB-1', dataVersion: 'DATA-1', t007Id: 'DATA-1', dataAsOf: '2026-08-23', evidenceRefs: [{ evidenceType: 'T019', evidenceId: 'T019-E1' }] },
    t019: { bindingId: 'T019-1', status: 'active', lifecycleStatus: 'active', publishedOntologyVersion: 'PUB-1', dataVersion: 'DATA-1', t007Id: 'DATA-1', evidenceRefs: [{ evidenceType: 'T019', evidenceId: 'T019-E1' }] },
    publishedOntology: { version: 'PUB-1', status: 'PUBLISHED', resourceRefs: [{ resourceId: 'MET-COST', kind: 'Metric' }] },
    t008: { id: 'T008-1', value: '2026-08-23', evidenceRefs: [{ evidenceType: 'T008', evidenceId: 'T008-E1' }] }
  };
  const c017 = {
    projectionId: query.C017_PROJECTION_ID,
    schemaVersion: '1',
    contractCode: 'C017',
    consumer: 'M03',
    scenarioContext: CONTEXT,
    t007: { id: 'DATA-1', dataVersion: 'DATA-1' },
    t019: { publishedOntologyVersion: 'PUB-1' },
    t008: { id: 'T008-1', value: '2026-08-23', evidenceRefs: [{ evidenceType: 'T008', evidenceId: 'T008-E1' }] },
    status: 'ready',
    quality: { status: 'passed', evidenceRefs: [{ evidenceType: 'QUALITY', evidenceId: 'Q-E1' }] },
    freshness: { status: 'current', evidenceRefs: [{ evidenceType: 'FRESHNESS', evidenceId: 'F-E1' }] },
    eligibility: 'allowed',
    bindingSummary: { id: 'B-1' },
    currentStatusSummary: { id: 'C-1' },
    evidenceRefs: [{ evidenceType: 'C017', evidenceId: 'C017-E1' }]
  };
  const config = {
    configVersion: 'CFG-1',
    promptVersion: 'PROMPT-1',
    skillSet: ['skill.semantic-query.v1'],
    loadedSkillSet: ['skill.semantic-query.v1'],
    toolAllowlist: ['tool.semantic-read.v1'],
    availableTools: ['tool.semantic-read.v1'],
    publishedOntologyVersion: 'PUB-1',
    resourceAllowlist: ['MET-COST'],
    enabled: true,
    scenarioContext: CONTEXT,
    evaluationTime: '2026-08-24T00:00:00.000Z'
  };
  return { c008, c017, config };
}

test('createM03Runtime composes raw read-only projections and keeps the executor metadata-only', () => {
  const { c008, c017, config } = fixtures();
  const runtime = query.createM03Runtime({ scenarioContext: CONTEXT, c008, c017, config, permissions: { c008: true, c017: true }, clock: () => '2026-08-24T01:00:00.000Z' });
  let executorContext;
  const plan = runtime.plan({ query: { question: '查询成本', metricRefs: [{ id: 'MET-COST', type: 'Metric' }] } });
  const run = runtime.execute({ plan, generatedAt: '2026-08-24T01:01:00.000Z' }, (_plan, context) => {
    executorContext = context;
    return { rows: [{ resultItemId: 'SUBJECT-1', value: 1, evidenceRefs: [{ evidenceType: 'ROW', evidenceId: 'ROW-E1' }] }] };
  });
  assert.equal(run.status, 'completed');
  assert.equal(executorContext.c008.raw, undefined);
  assert.equal(executorContext.c017.raw, undefined);
  assert.equal(run.result.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(run.result.dataVersion, 'DATA-1');
});
