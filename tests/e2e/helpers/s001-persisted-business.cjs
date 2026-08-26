'use strict';

const data = require('../../../services/data');
const ontology = require('../../../services/ontology');
const query = require('../../../services/query');
const decision = require('../../../services/decision');
const report = require('../../../packages/report');
const agent = require('../../../packages/m05');
const { runS001Data, runS001Semantic } = require('./s001-data-semantic.cjs');
const { runS001Query, runS001Decision } = require('./s001-query-decision.cjs');
const {
  prepareS001Report,
  runS001M05Copilot,
  completeS001ReportCopilot,
  defaultGenerationRunner,
  defaultExtractionRunner
} = require('./s001-report-agent.cjs');
const { queryInputs, createS001RuntimeResources } = require('./s001-runtime-config.cjs');

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function reopenM02(state) {
  return data.createDataRuntime({ state: state.domainState, clock: () => new Date('2026-08-25T02:00:00.000Z') });
}

function reopenM01(state) {
  return ontology.createOntologyService({
    scenarioContext: state.scenarioContext,
    ontologyId: 'ONT-S001-FINANCE',
    state: state.checkpoint.moduleState,
    clock: () => '2026-08-25T02:00:00.000Z'
  });
}

function ownerResources(m02State, m01State) {
  const dataRuntime = reopenM02(m02State);
  const ontologyService = reopenM01(m01State);
  return {
    dataRuntime,
    ontologyService,
    resources: createS001RuntimeResources({
      scenarioContext: m02State.scenarioContext,
      ontologyService,
      dataRuntime,
      asset: m02State.outputs.asset
    })
  };
}

function runM02Stage(options = {}) {
  const front = runS001Data({ scenarioRunId: options.scenarioRunId, formedAt: options.formedAt });
  const checkpoint = data.createM02CheckpointProvider(front.runtime, { verifyReferences: () => true }).export({
    scenarioContext: front.scenarioContext,
    checkpointId: `CP-M02-${front.scenarioContext.scenarioRunId}`
  });
  return json({
    moduleId: 'M02',
    scenarioContext: front.scenarioContext,
    domainState: front.runtime.exportState(),
    checkpoint,
    outputs: { snapshot: front.snapshot, t008: front.t008, run: front.run, asset: front.asset, delivery: front.delivery },
    contract: { code: 'C003', payload: front.delivery }
  });
}

function runM01Stage(input) {
  const m02State = input.m02State;
  const delivery = input.c003Payload;
  if (delivery.deliveryId !== m02State.outputs.delivery.deliveryId) throw new Error('M01 received a C003 identity that differs from persisted M02 state');
  const semantic = runS001Semantic({
    scenarioContext: m02State.scenarioContext,
    asset: m02State.outputs.asset,
    delivery
  });
  const checkpoint = ontology.createM01CheckpointProvider(semantic.service).export({
    scenarioContext: semantic.scenarioContext,
    checkpointId: `CP-M01-${semantic.scenarioContext.scenarioRunId}`
  });
  return json({
    moduleId: 'M01', scenarioContext: semantic.scenarioContext, checkpoint,
    outputs: {
      c003: semantic.c003, published: semantic.published, c028: semantic.c028,
      c029: semantic.c029, t019: semantic.t019, c008: semantic.c008
    },
    contract: { code: 'C008', payload: semantic.c008 }
  });
}

async function runM03Stage(input) {
  const { dataRuntime, ontologyService, resources } = ownerResources(input.m02State, input.m01State);
  const c008 = input.c008Payload;
  const authoritative = ontologyService.readC008({ scenarioContext: input.m02State.scenarioContext });
  if (JSON.stringify(c008.current) !== JSON.stringify(authoritative.current)) throw new Error('M03 C008 event differs from the M01 owner state');
  const common = queryInputs(input.m02State.scenarioContext, c008.current.semanticVersionId);
  const queryStage = await runS001Query({
    ...common,
    scenarioContext: input.m02State.scenarioContext,
    readC008: () => c008,
    readC017: resources.readC017Owner,
    clock: resources.clock
  }, { query: common.query, traceId: common.traceId, correlationId: common.correlationId, clock: resources.clock });
  const checkpointProvider = query.createC034Provider({
    scenarioContext: input.m02State.scenarioContext,
    state: {
      queryRuns: queryStage.planner.listRuns(),
      currentPlan: queryStage.plan,
      c009Config: common.c009Config,
      c010Result: queryStage.run.result
    }
  });
  const checkpoint = checkpointProvider.export({
    scenarioContext: input.m02State.scenarioContext,
    checkpointId: `CP-M03-${input.m02State.scenarioContext.scenarioRunId}`
  });
  void dataRuntime;
  return json({
    moduleId: 'M03', scenarioContext: input.m02State.scenarioContext, checkpoint,
    outputs: { plan: queryStage.plan, run: queryStage.run, c011: queryStage.c011 },
    contract: { code: 'C011', payload: queryStage.c011 }
  });
}

async function runM04Stage(input) {
  const { resources } = ownerResources(input.m02State, input.m01State);
  const common = queryInputs(input.m02State.scenarioContext, input.m01State.outputs.c008.current.semanticVersionId);
  const stage = await runS001Decision({
    ...common,
    scenarioContext: input.m02State.scenarioContext,
    c011: input.c011Payload,
    readC017: resources.readC017Owner,
    clock: resources.clock
  }, { traceId: common.traceId, correlationId: common.correlationId, owner: common.owner, clock: resources.clock });
  const checkpoint = stage.m04.exportCheckpoint({ checkpointId: `CP-M04-${input.m02State.scenarioContext.scenarioRunId}` });
  return json({
    moduleId: 'M04', scenarioContext: input.m02State.scenarioContext, checkpoint,
    domainState: stage.m04.getState(),
    outputs: { received: stage.received, confirmation: stage.confirmation, task: stage.task, c019: stage.c019 },
    contract: { code: 'C019', payload: stage.c019 }
  });
}

function reopenM04(m04State, resources) {
  return decision.createDecisionService({
    scenarioContext: m04State.scenarioContext,
    c017Reader: (request) => resources.readC017Owner({ ...request, consumer: 'M04' }),
    initialState: m04State.domainState,
    clock: resources.clock
  });
}

async function runM06PrepareStage(input) {
  const { resources } = ownerResources(input.m02State, input.m01State);
  const m04 = reopenM04(input.m04State, resources);
  const prepared = await prepareS001Report({
    scenarioContext: input.m02State.scenarioContext,
    c008Provider: resources.c008Provider,
    c017Provider: resources.c017Provider,
    authorizationPort: resources.authorizationPort,
    generationRelease: resources.release,
    extractionRelease: resources.release,
    agentReleaseRef: resources.agentReleaseRef,
    c017Resolver: resources.c017Resolver,
    m05Runtime: resources.runtime,
    copilotActor: resources.copilotActor,
    clock: resources.clock
  }, m04, {
    scenarioContext: input.m02State.scenarioContext,
    exactCombination: resources.exact,
    generationRelease: resources.release,
    extractionRelease: resources.release,
    agentReleaseRef: resources.agentReleaseRef,
    c017Resolver: resources.c017Resolver,
    authorizationPort: resources.authorizationPort,
    copilotActor: resources.copilotActor,
    clock: resources.clock
  });
  if (input.c019Payload.records?.[0]?.requestId !== prepared.c019.reference.records?.[0]?.requestId
      && input.c019Payload.status !== prepared.c019.reference.sourceStatus) {
    throw new Error('M06 C019 event differs from the M04 owner read');
  }
  const checkpoint = report.createM06CheckpointProvider({ store: prepared.service.store, clock: resources.clock }).export({
    scenarioContext: input.m02State.scenarioContext,
    checkpointId: `CP-M06-PREP-${input.m02State.scenarioContext.scenarioRunId}`
  });
  return json({
    moduleId: 'M06', scenarioContext: input.m02State.scenarioContext, checkpoint,
    domainState: prepared.storeState,
    outputs: {
      c019: prepared.c019, generation: prepared.generation, t049: prepared.t049,
      review: prepared.review, artifact: prepared.artifact, copilotInput: prepared.copilotInput,
      c024: prepared.c024
    },
    contract: { code: 'C024', payload: prepared.c024.envelope }
  });
}

async function runM05Stage(input) {
  const { resources } = ownerResources(input.m02State, input.m01State);
  const port = agent.createM06ReportPort({
    runtime: resources.runtime,
    generationRelease: resources.release,
    extractionRelease: resources.release,
    c017Resolver: resources.c017Resolver,
    copilotActor: resources.copilotActor,
    generationRunner: defaultGenerationRunner(resources.clock),
    extractionRunner: defaultExtractionRunner(resources.clock),
    clock: resources.clock
  });
  const result = await runS001M05Copilot({ c024: { envelope: input.c024Payload }, m05Port: port });
  const checkpoint = resources.runtime.exportCheckpoint({
    scenarioContext: input.m02State.scenarioContext,
    checkpointId: `CP-M05-${input.m02State.scenarioContext.scenarioRunId}`
  });
  return json({
    moduleId: 'M05', scenarioContext: input.m02State.scenarioContext, checkpoint,
    outputs: { receiptEnvelope: result.receiptEnvelope, resultEnvelope: result.resultEnvelope },
    contract: { code: 'C025', payload: { receiptEnvelope: result.receiptEnvelope, resultEnvelope: result.resultEnvelope } }
  });
}

async function runM06CompleteStage(input) {
  const { resources } = ownerResources(input.m02State, input.m01State);
  const m04 = reopenM04(input.m04State, resources);
  const replayPort = {
    receiveReportCopilotRequest: async () => input.c025Payload.receiptEnvelope,
    runReportCopilot: async () => input.c025Payload.resultEnvelope,
    readReportCopilotResult: async () => input.c025Payload.resultEnvelope
  };
  const store = report.createReportStore({ initialState: input.m06State.domainState });
  const service = report.createReportService({
    store,
    c008Provider: resources.c008Provider,
    c017Provider: resources.c017Provider,
    m04DecisionPort: report.createM04DecisionPort(m04),
    m05Port: replayPort,
    m05CopilotPort: replayPort,
    authorizationPort: resources.authorizationPort,
    clock: resources.clock
  });
  const completed = await completeS001ReportCopilot({
    service,
    copilotInput: input.m06State.outputs.copilotInput,
    c019: input.m06State.outputs.c019,
    generation: input.m06State.outputs.generation,
    t049: input.m06State.outputs.t049,
    review: input.m06State.outputs.review,
    artifact: input.m06State.outputs.artifact,
    c027: { triggered: false, reason: 'C027 requires explicit user action' }
  }, input.c025Payload, { service });
  const checkpoint = report.createM06CheckpointProvider({ store, clock: resources.clock }).export({
    scenarioContext: input.m02State.scenarioContext,
    checkpointId: `CP-M06-FINAL-${input.m02State.scenarioContext.scenarioRunId}`
  });
  return json({
    moduleId: 'M06', scenarioContext: input.m02State.scenarioContext, checkpoint,
    domainState: store.snapshot(),
    outputs: { artifact: completed.artifact, t049: completed.t049, copilot: completed.copilot, c027: completed.c027 }
  });
}

module.exports = Object.freeze({
  runM02Stage,
  runM01Stage,
  runM03Stage,
  runM04Stage,
  runM06PrepareStage,
  runM05Stage,
  runM06CompleteStage,
  reopenM02,
  reopenM01,
  ownerResources
});
