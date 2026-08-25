'use strict';

const query = require('../../../services/query');
const decision = require('../../../services/decision');

function required(value, name) {
  if (!value) throw new Error(`runS001QueryDecision requires front.${name}`);
  return value;
}

function asReader(front, name) {
  const reader = front[name] || front[`${name}Reader`];
  if (typeof reader !== 'function') throw new Error(`runS001QueryDecision requires a function front.${name}`);
  return reader;
}

async function invoke(value) {
  return value && typeof value.then === 'function' ? value : Promise.resolve(value);
}

async function runS001Query(front, options = {}) {
  const scenarioContext = required(front.scenarioContext, 'scenarioContext');
  const c008Reader = asReader(front, 'readC008');
  const c017Reader = asReader(front, 'readC017');
  const config = required(front.c009Config || front.config, 'c009Config');
  const executor = required(front.queryExecutor || front.executor, 'queryExecutor');
  const clock = options.clock || front.clock;
  const traceId = options.traceId || front.traceId;
  const correlationId = options.correlationId || front.correlationId || traceId;
  if (!traceId || !correlationId) throw new Error('runS001QueryDecision requires traceId and correlationId');

  const planner = query.createQueryPlanner({
    scenarioContext,
    c008Reader: (request) => c008Reader({ ...request, scenarioContext }),
    c017Reader: (request) => c017Reader({ ...request, scenarioContext, consumer: 'intelligent-query' }),
    config,
    permissions: front.permissions || { c008: true, c017: true },
    clock
  });
  const plan = await invoke(planner.plan({
    query: required(options.query || front.query, 'query'),
    scenarioContext,
    traceId,
    correlationId
  }));
  const run = await invoke(planner.execute({
    plan,
    scenarioContext,
    idempotencyKey: options.queryIdempotencyKey || front.queryIdempotencyKey,
    generatedAt: options.generatedAt || front.generatedAt
  }, (fixedPlan, context) => executor(fixedPlan, { ...context, traceId, correlationId })));
  if (run.status !== 'completed' || !run.result?.answerable) throw new Error(`M03 C010 did not complete: ${run.status}`);

  const c011 = planner.buildC011(run, {
    target: required(options.target || front.target, 'target'),
    actionType: required(options.actionType || front.actionType, 'actionType'),
    metricSnapshot: options.metricSnapshot || front.metricSnapshot,
    traceId,
    correlationId
  });
  if (c011.scenarioRunId !== scenarioContext.scenarioRunId) throw new Error('M03 C011 scenario run drift');
  return Object.freeze({ scenarioContext, plan, run, c011, planner, traceId, correlationId });
}

async function runS001Decision(front, options = {}) {
  const scenarioContext = required(front.scenarioContext, 'scenarioContext');
  const c017Reader = asReader(front, 'readC017');
  const c011 = required(front.c011, 'c011');
  const clock = options.clock || front.clock;
  const traceId = options.traceId || front.traceId || c011.traceId;
  const correlationId = options.correlationId || front.correlationId || c011.correlationId || traceId;
  if (!traceId || !correlationId) throw new Error('runS001Decision requires traceId and correlationId');
  const m04 = decision.createDecisionService({
    scenarioContext,
    c017Reader: (request, gate) => c017Reader({ ...request, scenarioContext, consumer: 'M04' }, gate),
    taskWriter: front.taskWriter,
    notificationWriter: front.notificationWriter,
    clock
  });
  const received = await invoke(m04.receiveActionRequest(c011));
  if (received.outcome !== 'accepted') throw new Error(`M04 rejected C011: ${received.outcome}`);
  const confirmation = await invoke(m04.confirmAction(c011.requestId, {
    decision: 'confirm',
    reason: options.confirmationReason || front.confirmationReason || 'S001 human confirmation',
    owner: required(options.owner || front.owner, 'owner'),
    actorRef: options.actorRef || front.actorRef || 's001-reviewer',
    traceId,
    correlationId
  }));
  if (confirmation.outcome !== 'confirmed') throw new Error(`M04 confirmation did not complete: ${confirmation.outcome}`);
  const task = await invoke(m04.createOwnerTask(c011.requestId, {
    traceId,
    correlationId
    // Q003 is deliberately omitted: no due-date policy is injected here.
  }));
  if (task.outcome !== 'task_created') throw new Error(`M04 task did not complete: ${task.outcome}`);
  const c019 = m04.readC019({ scenarioContext, returnContext: { sourceScenario: 'M06', filters: {}, issuedAt: options.readAt || front.readAt } });
  if (c019.status !== 'ready' || !Array.isArray(c019.records) || c019.records.length !== 1) throw new Error('M04 C019 is not a ready single-resource-chain summary');

  return Object.freeze({ scenarioContext, c011, received, confirmation, task, c019, m04, traceId, correlationId });
}

async function runS001QueryDecision(front, options = {}) {
  const queryStage = await runS001Query(front, options);
  const decisionStage = await runS001Decision({ ...front, ...queryStage }, options);
  return Object.freeze({ ...queryStage, ...decisionStage });
}

module.exports = Object.freeze({ runS001Query, runS001Decision, runS001QueryDecision });
