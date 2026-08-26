'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const m03 = require('../../services/query');
const m04 = require('../../services/decision');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-C011-INTEGRATION-1',
  formedAt: '2026-08-24T10:00:00.000Z',
  status: 'active'
});

const C008 = Object.freeze({
  schemaVersion: 'ofw.m01.c008.v1', contractCode: 'C008', sourceModule: 'M01',
  projectionId: 'C008-C011-1', projectionVersion: 1, formedAt: '2026-08-24T10:00:01.000Z',
  readStatus: 'ready', scenarioContext: CONTEXT, readOnly: true,
  current: {
    t019Id: 'T019-C011-1', semanticVersionId: 'PUB-S001-v1',
    publishedSemanticVersion: 'S001-ONTO-v1', dataVersion: 'T007-S001-v1',
    lifecycleStatus: 'published', publicationStatus: 'published', bindingStatus: 'active', t019Status: 'active',
    consumableDataVersion: 'T007-S001-v1', dataAsOf: '2026-08-23', t008: '2026-08-23',
    evidenceRefs: [{ evidenceType: 'T019', evidenceId: 'T019-C011-E1' }]
  }
});

const C017 = Object.freeze({
  schemaVersion: 'm02-data.draft.v1', contractCode: 'C017', consumer: 'intelligent-query',
  summaryId: 'C017-C011-1', summaryVersion: '1', scenarioContext: CONTEXT,
  assetVersionId: 'T007-S001-v1', t007Id: 'T007-S001-v1', asOfTime: '2026-08-23',
  t008: '2026-08-23', dataSideQualification: 'allowed',
  quality: { status: 'passed', hardFailure: false, evidenceRefs: [{ evidenceType: 'Q', evidenceId: 'Q-C011-1' }] },
  freshness: { status: 'current', evidenceRefs: [{ evidenceType: 'F', evidenceId: 'F-C011-1' }] },
  evidence: [{ evidenceType: 'T005', evidenceId: 'T005-C011-1' }]
});

const CONFIG = Object.freeze({
  configVersion: 'C009-C011-v1', promptVersion: 'PROMPT-C011-v1',
  skillSet: ['skill.semantic-query.v1'], loadedSkillSet: ['skill.semantic-query.v1'],
  toolAllowlist: ['tool.semantic-read.v1'], availableTools: ['tool.semantic-read.v1'],
  publishedOntologyVersion: 'PUB-S001-v1', resourceAllowlist: ['MET-COST', 'RULE-COST', 'ACTION-OPTIMIZE'],
  enabled: true, scenarioContext: CONTEXT, evaluationTime: '2026-08-24T10:00:02.000Z'
});

function produceC011() {
  const planner = m03.createQueryPlanner({
    scenarioContext: CONTEXT, c008Reader: () => C008, c017Reader: () => C017,
    config: CONFIG, permissions: { c008: true, c017: true },
    clock: () => '2026-08-24T10:00:03.000Z'
  });
  const plan = planner.plan({ query: {
    question: '查询融资成本', finalUnderstanding: '查询融资成本',
    metricRefs: [{ id: 'MET-COST', type: 'Metric' }], ruleRefs: [{ id: 'RULE-COST', type: 'Rule' }],
    scope: { objects: [{ id: 'SUBJECT-1', label: '示例主体' }] }
  } });
  const run = planner.execute({ plan, generatedAt: '2026-08-24T10:00:04.000Z' }, () => ({
    metrics: [{ metricId: 'MET-COST', value: 4.2, evidenceRefs: [{ evidenceType: 'metric', evidenceId: 'MET-C011-1' }] }],
    rules: [{ ruleId: 'RULE-COST', ruleVersion: '1', status: 'hit', evidenceRefs: [{ evidenceType: 'rule', evidenceId: 'RULE-C011-1' }] }],
    rows: [{ resultItemId: 'SUBJECT-1', value: 4.2, evidenceRefs: [{ evidenceType: 'row', evidenceId: 'ROW-C011-1' }] }]
  }));
  assert.equal(run.status, 'completed');
  return planner.buildC011(run, {
    target: { stableId: 'SUBJECT-1', name: '示例主体' },
    actionType: { actionTypeId: 'ACTION-OPTIMIZE', version: 'PUB-S001-v1', status: 'PUBLISHED' },
    metricSnapshot: { id: 'MET-COST', value: 4.2 }
  });
}

function decisionService(context = CONTEXT) {
  return m04.createDecisionService({
    scenarioContext: context,
    c017Reader: (query, gate) => ({
      contractCode: 'C017',
      consumer: 'M04',
      scenarioContext: query.scenarioContext,
      projections: [{
        dataVersion: query.dataVersion,
        scenarioContext: query.scenarioContext,
        gates: {
          [gate]: {
            currentStateSummary: {
              id: `C017-${query.dataVersion}-${gate}`,
              version: '1',
              formedAt: '2026-08-24T10:00:05.000Z',
              qualityStatus: 'passed',
              hardQualityFailure: false,
              evidenceLocator: `C017/${query.dataVersion}/${gate}`
            },
            qualityStatus: 'passed',
            hardQualityFailure: false
          }
        }
      }]
    }),
    clock: () => '2026-08-24T10:00:05.000Z'
  });
}

test('M03 actual Provider C011 is accepted by M04 and duplicate delivery has no second side effect', () => {
  const provided = produceC011();
  assert.equal(provided.schemaVersion, 'ofw.m03.c011.action-request.v1');
  assert.equal(provided.schemaVersion, m03.C011_SCHEMA_VERSION);
  assert.equal(provided.schemaVersion, m04.REQUEST_SCHEMA_VERSION);

  const service = decisionService();
  const accepted = service.receiveActionRequest(provided);
  assert.equal(accepted.outcome, 'accepted');
  assert.equal(accepted.request.requestId, provided.requestId);
  assert.equal(service.listRequests().length, 1);
  assert.equal(service.listReminders().length, 1);
  assert.equal(service.listNotifications().length, 1);

  const duplicate = service.receiveActionRequest(provided);
  assert.equal(duplicate.outcome, 'duplicate');
  assert.equal(duplicate.refs.request, accepted.refs.request);
  assert.equal(service.listRequests().length, 1);
  assert.equal(service.listReminders().length, 1);
  assert.equal(service.listNotifications().length, 1);
});

test('derived M03 C011 with a mismatched scenario run is fail-closed without side effects', () => {
  const provided = produceC011();
  const otherContext = { ...CONTEXT, scenarioRunId: 'S001-RUN-C011-INTEGRATION-OTHER' };
  const mismatchedRun = { ...provided, scenarioContext: otherContext, scenarioRunId: otherContext.scenarioRunId };
  const received = decisionService().receiveActionRequest(mismatchedRun);
  assert.equal(received.outcome, 'conflict');
  assert.equal(received.error.code, 'SCENARIO_CONTEXT_MISMATCH');
  assert.equal(received.effects.requests, 0);
  assert.equal(received.effects.reminders, 0);
  assert.equal(received.effects.notifications, 0);
});

test('derived M03 C011 with the legacy schema is rejected before C017 or side effects', () => {
  const provided = produceC011();
  const service = decisionService();
  const legacy = { ...provided, schemaVersion: 'ofw.m03.c011.request.v1' };
  assert.throws(() => service.receiveActionRequest(legacy), (error) => error.code === 'REQUEST_SCHEMA_INCOMPATIBLE');
  assert.equal(service.listRequests().length, 0);
  assert.equal(service.listReminders().length, 0);
  assert.equal(service.listNotifications().length, 0);
});
