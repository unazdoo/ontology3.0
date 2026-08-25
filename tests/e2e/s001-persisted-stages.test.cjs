'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const stages = require('./helpers/s001-persisted-business.cjs');
const data = require('../../services/data');
const ontology = require('../../services/ontology');
const query = require('../../services/query');
const decision = require('../../services/decision');
const agent = require('../../packages/m05');
const report = require('../../packages/report');

test('S001 owner stages consume only the prior persisted contract payload', async () => {
  const m02 = stages.runM02Stage({ scenarioRunId: 'S001-RUN-PERSISTED-STAGES' });
  const m01 = stages.runM01Stage({ m02State: m02, c003Payload: m02.contract.payload });
  const m03 = await stages.runM03Stage({ m02State: m02, m01State: m01, c008Payload: m01.contract.payload });
  const m04 = await stages.runM04Stage({ m02State: m02, m01State: m01, c011Payload: m03.contract.payload });
  const m06 = await stages.runM06PrepareStage({ m02State: m02, m01State: m01, m04State: m04, c019Payload: m04.contract.payload });
  const m05 = await stages.runM05Stage({ m02State: m02, m01State: m01, c024Payload: m06.contract.payload });
  const final = await stages.runM06CompleteStage({ m02State: m02, m01State: m01, m04State: m04, m06State: m06, c025Payload: m05.contract.payload });

  assert.equal(m01.outputs.c003.status, 'accepted');
  assert.equal(m01.outputs.c008.readStatus, 'ready');
  assert.equal(m03.outputs.run.status, 'completed');
  assert.equal(m04.outputs.confirmation.outcome, 'confirmed');
  assert.equal(m04.outputs.task.outcome, 'task_created');
  assert.equal(m06.outputs.t049.status, 'pass');
  assert.equal(final.outputs.copilot.outcome, 'complete');
  assert.equal(final.outputs.c027.triggered, false);
  assert.equal(final.scenarioContext.scenarioRunId, m02.scenarioContext.scenarioRunId);

  const target = { ...m02.scenarioContext, scenarioRunId: 'S001-RUN-PERSISTED-RESTORED', formedAt: '2026-08-25T04:00:00.000Z', status: 'restored' };
  const m02Owner = data.createM02CheckpointProvider(stages.reopenM02(m02), { verifyReferences: () => true });
  assert.equal(m02Owner.validate(m02.checkpoint).ok, true);
  assert.equal(m02Owner.cloneRestore(m02.checkpoint, { scenarioContext: target, targetScenarioRunId: target.scenarioRunId }).sideEffectsSuppressed, true);
  const m01Owner = ontology.createM01CheckpointProvider(stages.reopenM01(m01));
  assert.equal(m01Owner.validate(m01.checkpoint).ok, true);
  assert.equal(m01Owner.cloneRestore(m01.checkpoint, { scenarioContext: target, targetScenarioRunId: target.scenarioRunId }).overwritesSource, false);
  const m03Owner = query.createC034Provider({ state: m03.checkpoint.state });
  assert.equal(m03Owner.validate(m03.checkpoint).ok, true);
  assert.equal(m03Owner.cloneRestore(m03.checkpoint, { scenarioContext: target, sourceScenarioRunId: m02.scenarioContext.scenarioRunId, targetScenarioRunId: target.scenarioRunId }).sideEffectsSuppressed, true);
  const ownerResources = stages.ownerResources(m02, m01).resources;
  const m04Service = decision.createDecisionService({ scenarioContext: m04.scenarioContext, c017Reader: ownerResources.readC017Owner, initialState: m04.domainState, clock: ownerResources.clock });
  const m04Owner = m04Service.createCheckpointProvider();
  assert.equal(m04Owner.validate(m04.checkpoint).ok, true);
  assert.equal(m04Owner.cloneRestore(m04.checkpoint, { scenarioContext: target, targetScenarioRunId: target.scenarioRunId }).sideEffectsSuppressed, true);
  assert.equal(agent.C034.validate(m05.checkpoint).valid, true);
  assert.equal(agent.C034.cloneRestore(m05.checkpoint, { scenarioContext: target, runIdFactory: () => target.scenarioRunId }).overwritesSource, false);
  const reportStore = report.createReportStore({ initialState: final.domainState });
  const m06Owner = report.createM06CheckpointProvider({ store: reportStore, clock: () => target.formedAt });
  assert.equal(m06Owner.validate(final.checkpoint).ok, true);
  assert.equal(m06Owner.cloneRestore(final.checkpoint, { scenarioContext: target }).historicalReadOnly, true);
});
