'use strict';

const adapters = require('./adapters');
const config = require('./config');
const planner = require('./planner');
const rules = require('./rule-runtime');
const evidence = require('./evidence');
const { QueryServiceError, fail } = require('./errors');
const utils = require('./utils');

const SERVICE_VERSION = 'implementation-0.1.0';

function buildC011Compat(first, second, third) {
  if (first && typeof first.buildC011 === 'function') return first.buildC011(second, third || {});
  if (first && first.result && first.plan) return evidence.buildC011Request({ ...(second || {}), run: first, result: first.result });
  return evidence.buildC011Request(first || {}, second || {});
}

function createM03Runtime(options = {}) {
  const context = options.scenarioContext;
  if (!context) fail('ERR_QUERY_CONTEXT_REQUIRED', 'M03 runtime requires a C033 scenario context');
  const readonly = options.adapters || adapters.createReadonlyAdapters({
    c008: options.c008Adapter || options.c008Reader || options.c008,
    c017: options.c017Adapter || options.c017Reader || options.c017,
    options: options.adapterOptions || {}
  });
  const queryPlanner = options.planner || planner.createQueryPlanner({
    ...options,
    scenarioContext: context,
    c008Reader: options.c008Adapter || readonly.c008,
    c017Reader: options.c017Adapter || readonly.c017,
    permissions: options.permissions || options.authorization
  });
  const runtime = {
    serviceVersion: SERVICE_VERSION,
    scenarioContext: utils.deepFreeze(utils.contextTriple(context)),
    adapters: readonly,
    planner: queryPlanner,
    plan(input) { return queryPlanner.plan({ ...input, scenarioContext: input?.scenarioContext || context }); },
    planAsync(input) { return queryPlanner.planAsync({ ...input, scenarioContext: input?.scenarioContext || context }); },
    execute(input, executor) { return queryPlanner.execute({ ...input, scenarioContext: input?.scenarioContext || context }, executor); },
    executeAsync(input, executor) { return queryPlanner.executeAsync({ ...input, scenarioContext: input?.scenarioContext || context }, executor); },
    run(input, executor) { return queryPlanner.run({ ...input, scenarioContext: input?.scenarioContext || context }, executor); },
    retry(runId, input, executor) { return queryPlanner.retry(runId, { ...input, scenarioContext: input?.scenarioContext || context }, executor); },
    getRun(runId) { return queryPlanner.getRun(runId); },
    listRuns() { return queryPlanner.listRuns(); },
    createResultFact(input) { return evidence.createResultFact({ ...input, scenarioContext: input?.scenarioContext || context }); },
    validateResultFact(input, expected) { return evidence.validateResultFact(input, { ...expected, scenarioContext: expected?.scenarioContext || context }); },
    exportCsv(input) { return evidence.createCsv(input); },
    createQueryView(input) { return evidence.createQueryView(input); },
    createQueryViewRegistry(options) { return new evidence.QueryViewRegistry(options); },
    buildC011(input) { return evidence.buildC011Request(input); },
    submitC011(input, submitter, seen) { return evidence.submitC011(input, submitter, seen); },
    submitC011Async(input, submitter, seen) { return evidence.submitC011Async(input, submitter, seen); },
    runRules(input, ruleOptions) { return rules.evaluateRun({ ...input, scenarioContext: input?.scenarioContext || context }, ruleOptions); },
    safeRunRules(input, ruleOptions) { return rules.safeEvaluateRun({ ...input, scenarioContext: input?.scenarioContext || context }, ruleOptions); },
    createCandidate(input) { return queryPlanner.createCandidate(input); },
    listCandidates() { return queryPlanner.listCandidates(); },
    validateCandidate(candidate, expected) { return queryPlanner.validateCandidate(candidate, expected); },
    submitCandidate(candidateId, input) { return queryPlanner.submitCandidate(candidateId, input); },
    retryCandidate(candidateId, input) { return queryPlanner.retryCandidate(candidateId, input); }
  };
  return Object.freeze(runtime);
}

module.exports = Object.freeze({
  SERVICE_VERSION,
  QueryServiceError,
  createM03Runtime,
  createRuntime: createM03Runtime,
  ...adapters,
  ...config,
  ...planner,
  // The run-fact evaluator is the public Rule API because it enforces the
  // Published/version/evidence gates. The planner's compact evaluator remains
  // available under explicit query-prefixed aliases for legacy callers.
  evaluateRuleFact: rules.evaluateRule,
  evaluatePublishedRule: rules.evaluateRule,
  evaluateRule: rules.evaluateRule,
  evaluateQueryRule: planner.evaluateRule,
  evaluateRules: rules.evaluateRules,
  evaluateQueryRules: planner.evaluateRules,
  evaluateRuleRun: rules.evaluateRun,
  safeEvaluateRuleRun: rules.safeEvaluateRun,
  createRuleRuntime: rules.createRuleRuntime,
  RuleRuntime: rules.RuleRuntime,
  RuleRuntimeError: rules.RuleRuntimeError,
  RULE_OUTCOMES: rules.RULE_OUTCOMES,
  RULE_RUN_BLOCK_CODES: rules.BLOCK_CODES,
  BLOCK_CODES: rules.BLOCK_CODES,
  RULE_RUNTIME_SCHEMA_VERSION: rules.RULE_RUNTIME_SCHEMA_VERSION,
  RULE_DEFINITION_SCHEMA_VERSION: rules.RULE_DEFINITION_SCHEMA_VERSION,
  RULE_CANDIDATE_SCHEMA_VERSION: rules.RULE_CANDIDATE_SCHEMA_VERSION,
  RULE_RUNTIME_STATUSES: rules.RUN_STATUSES,
  validateRuleDefinition: rules.validateRuleDefinition,
  validateRuleRunSnapshot: rules.validateRunSnapshot,
  createRuleCandidate: rules.createCandidate,
  validateRuleCandidate: rules.validateCandidate,
  ...evidence,
  buildC011: buildC011Compat,
  buildStandardC011: evidence.buildC011Request
});
