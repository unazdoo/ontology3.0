'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const foundation = require('../../packages/checkpoint');
const m01 = require('../../services/ontology');
const m02 = require('../../services/data');
const m03 = require('../../services/query');
const m04 = require('../../services/decision');
const m05 = require('../../packages/agent-release');
const m06 = require('../../services/report');

const source = Object.freeze({ scenarioId: 'S001', scenarioVersion: 'S001-v1', scenarioRunId: 'S001-RUN-C034-SOURCE', formedAt: '2026-08-24T00:00:00.000Z', status: 'active' });
const targetRunId = 'S001-RUN-C034-RESTORED';
const target = Object.freeze({ ...source, scenarioRunId: targetRunId, formedAt: '2026-08-24T01:00:00.000Z', status: 'restored' });
const replayTarget = Object.freeze({ ...target, status: 'regression' });
const clock = () => '2026-08-24T00:30:00.000Z';

function agentRelease() {
  return m05.publishAgentRelease(m05.createAgentRelease({
    releaseId: 'REL-C034', releaseVersion: 'REL-C034-v1', status: 'validated',
    agent: { type: 'agent', id: 'AGENT-REPORT-COPILOT', version: 'AGENT-REPORT-COPILOT-v1' }, prompt: { type: 'prompt', id: 'PROMPT-REPORT-COPILOT', version: 'PROMPT-REPORT-COPILOT-v4' },
    skills: [{ type: 'skill', id: 'SKILL-EVIDENCE-READ', version: 'SKILL-EVIDENCE-READ-v2' }, { type: 'skill', id: 'SKILL-VERIFY-EXPLAIN', version: 'SKILL-VERIFY-EXPLAIN-v1' }],
    tools: ['CONTEXT', 'EVIDENCE', 'ONTOLOGY', 'CREDIBILITY', 'VERIFICATION', 'RESULT'].map((id) => ({ type: 'tool', id: `TOOL-${id}-READ`, version: `TOOL-${id}-READ-v1` })),
    model: { type: 'model', id: 'MODEL-READONLY', version: 'MODEL-READONLY-v2' }, publishedOntologies: [{ type: 'publishedOntology', id: 'ONT-S001', version: 'ONT-S001-v3', status: 'published', owner: 'M01' }],
    scenario: { type: 'scenario', id: 'S001', version: 'S001-v1', owner: 'platform' }, validity: { validFrom: '2026-01-01T00:00:00.000Z', validTo: '2027-01-01T00:00:00.000Z' },
    resourceWhitelist: [
      ['reportContext', 'RPT-001', 'RPT-001-v1', ['read-context']], ['evidence', 'EVD-001', 'EVD-001-v1', ['read-evidence', 'cite']],
      ['publishedOntology', 'ONT-S001', 'ONT-S001-v3', ['read-ontology', 'validate-reference']], ['credibilitySummary', 'C017-S001-001', 'C017-S001-001-v1', ['read-credibility']],
      ['verificationResult', 'T049-001', 'T049-001-v1', ['read-verification']], ['answer', 'answer-output', 'answer-output-v1', ['emit-result']]
    ].map(([resourceType, resourceId, resourceVersion, operations]) => ({ resourceType, resourceId, resourceVersion, operations, readOnly: true })),
    permissions: { allowedRoles: ['operator', 'publisher', 'admin'], required: ['agent.run.execute'], denied: ['agent.action.execute', 'agent.report.publish'] }
  }), { now: clock() });
}

function providers() {
  const ontology = m01.createOntologyService({ scenarioContext: source, ontologyId: 'ONT-C034', clock });
  const data = m02.createDataRuntime({ clock: () => new Date(clock()) });
  const decision = m04.createDecisionService({ scenarioContext: source, clock, c017Reader: () => ({ contractCode: 'C017', scenarioContext: source, projections: [] }) });
  const reportStore = m06.createReportStore();
  const reportService = m06.createM06Service({ store: reportStore, clock });
  return {
    M01: m01.createM01CheckpointProvider(ontology),
    M02: m02.createM02CheckpointProvider(data, { verifyReferences: () => true }),
    M03: m03.createC034Provider({ state: { queryRunIds: ['M03-QUERY-1'] } }),
    M04: decision.createCheckpointProvider(),
    M05: null,
    M06: m06.createM06CheckpointProvider({ store: reportService.store, clock })
  };
}

function exportProvider(provider, moduleId) {
  const value = provider.export({ scenarioContext: source, checkpointId: `CP-${moduleId}` });
  assert.equal(Object.isFrozen(value), true, `${moduleId} export immutable`);
  assert.equal(provider.validate(value).ok, true, `${moduleId} validates its hash`);
  assert.equal(foundation.validateCheckpoint(value, { requireSchemaVersion: true }).ok, true, `${moduleId} validates Foundation C034`);
  return value;
}

test('M01-M04 and M06 actual C034 providers export immutable checkpoints and restore one new S001 run without side effects', () => {
  const all = providers();
  for (const moduleId of ['M01', 'M02', 'M03', 'M04', 'M06']) {
    const provider = all[moduleId];
    const checkpoint = exportProvider(provider, moduleId);
    const before = JSON.stringify(checkpoint);
    const restored = provider.cloneRestore(checkpoint, { scenarioContext: target, targetScenarioRunId: targetRunId, runIdFactory: () => targetRunId, now: target.formedAt });
    assert.equal(JSON.stringify(checkpoint), before, `${moduleId} does not overwrite source`);
    assert.equal(restored.overwritesSource, false, `${moduleId} cannot overwrite source`);
    assert.equal(restored.replayHistoricalSideEffects, false, `${moduleId} cannot replay historical effects`);
    const replay = provider.isolatedReplay(checkpoint, { scenarioContext: replayTarget, targetScenarioRunId: targetRunId, runIdFactory: () => targetRunId });
    assert.equal(replay.sideEffectsSuppressed, true, `${moduleId} suppresses replay effects`);
    for (const key of ['actions', 'notifications', 'approvals', 'todos', 'agentRuns', 'publishedReports']) assert.equal(key in replay, false, `${moduleId} replays no ${key}`);
  }
});

test('M05 actual Agent Release C034 is immutable, restores only to the shared new run, and suppresses Agent execution', () => {
  const checkpoint = m05.exportAgentReleaseCheckpoint(agentRelease(), { scenarioContext: source, now: clock() });
  assert.equal(m05.validateAgentReleaseCheckpoint(checkpoint).valid, true);
  const restored = m05.cloneAgentReleaseCheckpoint(checkpoint, { runIdFactory: () => targetRunId, now: target.formedAt });
  assert.equal(restored.scenarioContext.scenarioRunId, targetRunId);
  assert.equal(restored.overwritesSource, false);
  assert.equal(restored.autoRun, false);
  assert.equal(restored.autoToolInvocation, false);
});

test('all Foundation C034 exports fail closed for wrong baseline, wrong scenario, and tampering', () => {
  const all = providers();
  for (const moduleId of ['M01', 'M02', 'M03', 'M04', 'M06']) {
    const provider = all[moduleId];
    const checkpoint = exportProvider(provider, moduleId);
    assert.equal(provider.validate({ ...checkpoint, baselineSnapshotId: 'WRONG' }).ok, false, `${moduleId} rejects baseline drift`);
    assert.equal(provider.validate({ ...checkpoint, scenarioContext: { ...source, scenarioId: 'S002' } }).ok, false, `${moduleId} rejects scenario drift`);
    const tampered = JSON.parse(JSON.stringify(checkpoint));
    tampered.stateFingerprint = '0'.repeat(64);
    assert.equal(provider.validate(tampered).ok, false, `${moduleId} rejects tampering`);
  }
});
