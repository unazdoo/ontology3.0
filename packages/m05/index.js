'use strict';

const releaseBoundary = require('../agent-release');
const contracts = require('./contracts');
const resources = require('./resources');
const security = require('./security');
const gateway = require('./gateway');
const audit = require('./audit');
const report = require('./report');
const orchestration = require('./orchestration');
const evaluation = require('./evaluation');
const checkpoint = require('./checkpoint');
const util = require('./util');
const schemas = require('./schema');
const identity = require('../identity');

const M05_SCHEMA_VERSION = 'ofw.m05.runtime.draft.v1';

class M05Runtime {
  constructor(options = {}) {
    this.clock = options.clock;
    this.audit = options.audit || new audit.AuditLog({ clock: this.clock });
    this.release = options.release || null;
    this.store = options.store || new report.ReportCopilotStore({ clock: this.clock, audit: this.audit });
    this.modelGateway = options.modelGateway || new gateway.ModelGateway({
      clock: this.clock,
      audit: this.audit,
      permissions: options.permissions,
      policy: options.policy,
      ledger: options.ledger,
      models: options.models || []
    });
    this.toolGateway = options.toolGateway || new gateway.ToolGateway({
      clock: this.clock,
      audit: this.audit,
      permissions: options.permissions,
      policy: options.policy,
      tools: options.tools || []
    });
    Object.freeze(this);
  }

  setRelease(nextRelease) {
    // Runtime instances are snapshots: changing a Release creates a new
    // runtime, which prevents a running request from silently switching deps.
    return new M05Runtime({ release: nextRelease, clock: this.clock, audit: this.audit, store: this.store, modelGateway: this.modelGateway, toolGateway: this.toolGateway });
  }

  receiveC024(value, options) { return this.store.receiveC024(value, options); }

  bindC024(requestId, options = {}) {
    const request = this.store.getRequest(requestId);
    if (!request) util.fail('C024_NOT_FOUND', 'C024 request has not been received');
    const exactRelease = options.release || this.release;
    if (!exactRelease) util.fail('RELEASE_REQUIRED', 'an exact Agent Release is required');
    return this.store.start(requestId, exactRelease, options);
  }

  createRun(sessionId, options = {}) {
    const exactRelease = options.release || this.release;
    if (!exactRelease) util.fail('RELEASE_REQUIRED', 'an exact Agent Release is required');
    return this.store.createRun(sessionId, exactRelease, options);
  }

  async answer(requestId, options = {}) {
    const chain = this.bindC024(requestId, options);
    const run = this.createRun(chain.session.sessionId, options);
    const request = chain.request;
    try {
      const modelResult = await this.modelGateway.invoke({
        release: options.release || this.release,
        input: { reportContext: request.reportContext, credibilitySummary: request.credibilitySummary, verificationResult: request.verificationResult || undefined },
        question: request.question,
        systemPrompt: options.systemPrompt,
        actor: options.actor,
        capabilities: options.capabilities,
        model: options.model,
        at: options.at
      });
      const result = report.createAnswerResult(run, request, modelResult.output, { clock: this.clock });
      return this.store.completeRun(run.runId, result, { clock: this.clock });
    } catch (error) {
      this.store.failRun(run.runId, error, { clock: this.clock });
      throw error;
    }
  }

  async explainVerification(requestId, options = {}) {
    const chain = this.bindC024(requestId, options);
    if (!chain.request.verificationResult) util.fail('VERIFICATION_RESULT_REQUIRED', 'M06 deterministic verification result is required');
    const run = this.createRun(chain.session.sessionId, options);
    const request = chain.request;
    try {
      const modelResult = await this.modelGateway.invoke({
        release: options.release || this.release,
        input: { reportContext: request.reportContext, credibilitySummary: request.credibilitySummary, verificationResult: request.verificationResult },
        question: request.question || 'Explain the supplied deterministic verification result without changing its states.',
        systemPrompt: options.systemPrompt,
        actor: options.actor,
        capabilities: options.capabilities,
        model: options.model,
        at: options.at
      });
      const result = report.createVerificationExplanationResult(run, request, modelResult.output, { clock: this.clock });
      return this.store.completeRun(run.runId, result, { clock: this.clock });
    } catch (error) {
      this.store.failRun(run.runId, error, { clock: this.clock });
      throw error;
    }
  }

  invokeTool(request) { return this.toolGateway.invoke(request); }
  cancelRun(runId, options) { return this.store.cancelRun(runId, options); }
  closeSession(sessionId, options) { return this.store.closeSession(sessionId, options); }
  evaluate(options = {}) { return evaluation.evaluateRelease(options.release || this.release, options); }
  exportCheckpoint(options = {}) { return checkpoint.exportM05Checkpoint({ release: options.release || this.release, scenarioContext: options.scenarioContext, state: { ...this.store.current(), audit: { count: this.audit.records?.length || this.audit.length || 0, tailDigest: this.audit.lastDigest || this.audit.snapshot?.().tailHash || null } }, checkpointId: options.checkpointId }, { clock: this.clock, now: options.now }); }
  cloneRestore(checkpointValue, options = {}) { return checkpoint.cloneRestoreM05Checkpoint(checkpointValue, options); }
  isolatedReplay(checkpointValue, options = {}) { return checkpoint.isolatedReplayM05Checkpoint(checkpointValue, options); }
  migrationCompare(source, target) { return checkpoint.migrationCompareM05(source, target); }
  resetProjection(options) { return this.store.resetProjection(options); }
  snapshot() { return util.immutable({ schemaVersion: M05_SCHEMA_VERSION, release: this.release, store: this.store.current(), audit: this.audit.list() }); }
}

function createM05Runtime(options) { return new M05Runtime(options); }

const api = {
  M05_SCHEMA_VERSION,
  M05Runtime, createM05Runtime,
  ...contracts,
  ...resources,
  ...security,
  ...gateway,
  ...audit,
  ...report,
  ...orchestration,
  ...evaluation,
  ...checkpoint,
  releaseBoundary,
  agentRelease: releaseBoundary,
  checkpoint,
  contracts,
  util,
  schemas,
  identity
};
api.generateIdempotencyKey = identity.generateIdempotencyKey;
api.identifyDuplicateRequest = identity.identifyDuplicateRequest;
api.createTraceContext = identity.createTraceContext;

api.C014_SCHEMA_VERSION = orchestration.ORCHESTRATION_SCHEMA_VERSION;
api.C014_CONTRACT_VERSION = orchestration.ORCHESTRATION_SCHEMA_VERSION;
api.C020_CONTRACT_VERSION = report.C020_SCHEMA_VERSION;
api.C024_CONTRACT_VERSION = report.C024_SCHEMA_VERSION;
api.C025_CONTRACT_VERSION = report.C025_SCHEMA_VERSION;
api.C024_REQUEST_SCHEMA_VERSION = report.C024_SCHEMA_VERSION;
api.C025_RESULT_SCHEMA_VERSION = report.C025_SCHEMA_VERSION;

// The strict Agent Release package is the canonical M05 resource boundary.
// Keep the runtime's grouped helpers above for internal compatibility, while
// exposing the exact public Release contract at the top level.
Object.assign(api, {
  AGENT_RELEASE_SCHEMA_VERSION: releaseBoundary.AGENT_RELEASE_SCHEMA_VERSION,
  AGENT_RELEASE_CONTRACT_VERSION: releaseBoundary.AGENT_RELEASE_CONTRACT_VERSION,
  RESOURCE_REGISTRY_SCHEMA_VERSION: releaseBoundary.RESOURCE_REGISTRY_SCHEMA_VERSION,
  RELEASE_STATUSES: releaseBoundary.RELEASE_STATUSES,
  SAFE_TOOL_OPERATIONS: releaseBoundary.SAFE_TOOL_OPERATIONS,
  createAgentRelease: releaseBoundary.createAgentRelease,
  AgentRelease: releaseBoundary.createAgentRelease,
  createRelease: releaseBoundary.createAgentRelease,
  validateAgentRelease: releaseBoundary.validateAgentRelease,
  assertAgentRelease: releaseBoundary.assertAgentRelease,
  publishAgentRelease: releaseBoundary.publishAgentRelease,
  disableAgentRelease: releaseBoundary.disableAgentRelease,
  createResourceRegistry: releaseBoundary.createResourceRegistry,
  createAgentReleaseRegistry: releaseBoundary.createAgentReleaseRegistry || releaseBoundary.createResourceRegistry,
  restoreResourceRegistry: releaseBoundary.restoreResourceRegistry,
  restoreAuditLog: releaseBoundary.restoreAuditLog,
  ResourceRegistry: releaseBoundary.ResourceRegistry,
  normalizeFixedReportContext: releaseBoundary.normalizeFixedReportContext,
  validateFixedReportContext: releaseBoundary.validateFixedReportContext,
  assertFixedReportContext: releaseBoundary.assertFixedReportContext,
  compareFixedReportContext: releaseBoundary.compareFixedReportContext,
  assertReleaseContext: releaseBoundary.assertReleaseContext,
  bindReleaseToContext: releaseBoundary.bindReleaseToContext,
  validateReleaseContext: releaseBoundary.validateReleaseContext,
  validateToolCall: releaseBoundary.validateToolCall,
  assertToolCall: releaseBoundary.assertToolCall,
  authorizeToolCall: releaseBoundary.authorizeToolCall,
  authorize: releaseBoundary.authorize,
  assertPermission: releaseBoundary.assertPermission,
  detectPromptInjection: releaseBoundary.detectPromptInjection,
  assertNoPromptInjection: releaseBoundary.assertNoPromptInjection,
  preparePromptInput: releaseBoundary.preparePromptInput,
  verifyAuditChain: releaseBoundary.verifyAuditChain,
  exportAgentReleaseCheckpoint: releaseBoundary.exportAgentReleaseCheckpoint,
  validateAgentReleaseCheckpoint: releaseBoundary.validateAgentReleaseCheckpoint,
  cloneAgentReleaseCheckpoint: releaseBoundary.cloneAgentReleaseCheckpoint
});

// Compatibility aliases used by module consumers and contract tests.
api.validateC024 = contracts.validateAgentInput;
api.assertC024 = report.assertC024Request;
api.receiveC024 = (store, request, options) => store.receiveC024(request, options);
api.createC025Answer = report.createAnswerResult;
api.createC025VerificationExplanation = report.createVerificationExplanationResult;
api.validateC025 = report.validateC025Result;
api.createC020Insight = report.createInsight;
api.replaceC020Insight = report.replaceInsight;
api.validateC020Insight = report.validateInsight;
api.validateC020 = report.validateInsight;
api.assertC020 = (value, options) => { const result = report.validateInsight(value, options); if (!result.valid) util.fail('C020_INVALID', 'C020 insight validation failed', result.errors); return util.immutable(value); };
api.createC014Release = orchestration.publishOrchestrationRelease;
api.validateC014Definition = orchestration.validateOrchestrationDefinition;
api.validateC014 = orchestration.validateOrchestrationDefinition;
api.runEvaluation = evaluation.evaluateRelease;
api.createC034Provider = checkpoint.createM05CheckpointProvider;
api.createCheckpointProvider = checkpoint.createM05CheckpointProvider;
api.C014 = Object.freeze({ schemaVersion: api.C014_SCHEMA_VERSION, validate: orchestration.validateOrchestrationDefinition, publish: orchestration.publishOrchestrationRelease, run: orchestration.runOrchestration });
api.C020 = Object.freeze({ schemaVersion: api.C020_SCHEMA_VERSION, validate: report.validateInsight, create: report.createInsight });
api.C024 = Object.freeze({ schemaVersion: api.C024_SCHEMA_VERSION, validate: report.validateC024Request, assert: report.assertC024Request, store: report.ReportCopilotStore });
api.C025 = Object.freeze({ schemaVersion: api.C025_SCHEMA_VERSION, validate: report.validateC025Result, answer: report.createAnswerResult, verificationExplanation: report.createVerificationExplanationResult });
api.C034 = Object.freeze({ schemaVersion: checkpoint.C034_SCHEMA_VERSION, providerVersion: checkpoint.C034_PROVIDER_VERSION, export: checkpoint.exportM05Checkpoint, validate: checkpoint.validateM05Checkpoint, cloneRestore: checkpoint.cloneRestoreM05Checkpoint, isolatedReplay: checkpoint.isolatedReplayM05Checkpoint, migrationCompare: checkpoint.migrationCompareM05 });
api.C017 = Object.freeze({ validate: contracts.validateCredibilitySummary, assert: contracts.assertCredibilitySummary, gate: contracts.evaluateCredibilityGate, assertGate: contracts.assertCredibilityGate });
api.M06 = Object.freeze({ validateReportContext: contracts.validateReportContext, validateVerificationResult: contracts.validateVerificationResult, assertReportContext: contracts.assertReportContext, assertVerificationResult: contracts.assertVerificationResult });

module.exports = Object.freeze(api);
