'use strict';

const {
  isRecord, isNonEmptyString, clone, immutable, sha256, issue, validation, assertValid, fail, uuid, list, assertNoForbiddenPayload, nowIso
} = require('./util');
const { assertAgentRelease, scopeSubset, allowlistContains } = require('./resources');
const { assertAgentInput, fixedInputFingerprint, validateM05SchemaCompatibility } = require('./contracts');
const strictReleaseBoundary = require('../agent-release');

const ORCHESTRATION_SCHEMA_VERSION = 'ofw.m05.c014.draft.v1';
const STEP_TYPES = Object.freeze(['start', 'agent', 'parallel-split', 'deterministic-condition', 'deterministic-join', 'human-pause', 'end', 'failure']);
const RUN_STATES = Object.freeze(['created', 'validating-input', 'input-invalid', 'waiting', 'running', 'human-paused', 'output-validating', 'partially-complete', 'completed', 'failed', 'cancelling', 'cancelled']);

function stepMap(steps) { return new Map((steps || []).map((step) => [step.id, step])); }

function outgoing(connections) {
  const map = new Map();
  (connections || []).forEach((connection) => {
    if (!isRecord(connection)) return;
    if (!map.has(connection.from)) map.set(connection.from, []);
    map.get(connection.from).push(connection.to);
  });
  return map;
}

function incoming(connections) {
  const map = new Map();
  (connections || []).forEach((connection) => {
    if (!isRecord(connection)) return;
    if (!map.has(connection.to)) map.set(connection.to, []);
    map.get(connection.to).push(connection.from);
  });
  return map;
}

function detectCycles(steps, connections) {
  const graph = outgoing(connections);
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];
  function visit(id, stack = []) {
    if (visiting.has(id)) { cycles.push([...stack, id]); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    (graph.get(id) || []).forEach((next) => visit(next, [...stack, id]));
    visiting.delete(id);
    visited.add(id);
  }
  const ids = steps.filter(isRecord).map((step) => step.id);
  ids.forEach((id) => visit(id));
  return cycles;
}

function reachableToTerminal(steps, connections) {
  const graph = outgoing(connections);
  const terminals = new Set(steps.filter((step) => isRecord(step) && ['end', 'failure'].includes(step.type)).map((step) => step.id));
  const memo = new Map();
  function reaches(id, trail = new Set()) {
    if (terminals.has(id)) return true;
    if (memo.has(id)) return memo.get(id);
    if (trail.has(id)) return false;
    const next = graph.get(id) || [];
    const value = next.length > 0 && next.every((child) => reaches(child, new Set([...trail, id])));
    memo.set(id, value);
    return value;
  }
  return { terminals, reaches };
}

function validateOrchestrationDefinition(value, options = {}) {
  const errors = [];
  const path = options.path || 'orchestrationDefinition';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'orchestration definition must be an object')]);
  if (value.schemaVersion !== undefined && !validateM05SchemaCompatibility(ORCHESTRATION_SCHEMA_VERSION, value.schemaVersion).valid) errors.push(issue(`${path}.schemaVersion`, 'version', `must equal ${ORCHESTRATION_SCHEMA_VERSION}`));
  const id = value.definitionId || value.id;
  const version = value.definitionVersion || value.version;
  if (!isNonEmptyString(id)) errors.push(issue(`${path}.definitionId`, 'required', 'definition identity is required'));
  if (!isNonEmptyString(version)) errors.push(issue(`${path}.definitionVersion`, 'required', 'definition version is required'));
  const steps = value.steps;
  const connections = value.connections || value.routes || [];
  if (!Array.isArray(steps) || steps.length === 0) errors.push(issue(`${path}.steps`, 'required', 'at least one step is required'));
  if (!Array.isArray(connections)) errors.push(issue(`${path}.connections`, 'type', 'connections must be an array'));
  if (!Array.isArray(steps)) return validation(errors.length === 0, errors);
  const ids = new Set();
  steps.forEach((step, index) => {
    if (!isRecord(step)) { errors.push(issue(`${path}.steps[${index}]`, 'type', 'step must be an object')); return; }
    if (!isNonEmptyString(step.id)) errors.push(issue(`${path}.steps[${index}].id`, 'required', 'step id is required'));
    else if (ids.has(step.id)) errors.push(issue(`${path}.steps[${index}].id`, 'duplicate', 'step id must be unique'));
    else ids.add(step.id);
    if (!STEP_TYPES.includes(step.type)) errors.push(issue(`${path}.steps[${index}].type`, 'enum', 'unsupported step type'));
    if (step.type === 'agent') {
      if (!step.agentRelease && !step.agentReleaseRef) errors.push(issue(`${path}.steps[${index}].agentRelease`, 'required', 'Agent step must bind an exact Agent Release'));
      if (step.model || step.prompt || step.tool) errors.push(issue(`${path}.steps[${index}]`, 'ownership', 'Step Binding cannot copy Agent resources'));
    } else if (step.agentRelease || step.agentReleaseRef) errors.push(issue(`${path}.steps[${index}].agentRelease`, 'ownership', 'control steps cannot bind an Agent Release'));
    if (step.type === 'deterministic-condition' && step.condition && typeof step.condition === 'string' && /llm|model|confidence|natural language/i.test(step.condition)) errors.push(issue(`${path}.steps[${index}].condition`, 'determinism', 'condition cannot depend on LLM text or confidence'));
  });
  const known = ids;
  if (Array.isArray(connections)) connections.forEach((connection, index) => {
    if (!isRecord(connection)) {
      errors.push(issue(`${path}.connections[${index}]`, 'type', 'connection must be an object'));
      return;
    }
    if (!known.has(connection.from) || !known.has(connection.to)) errors.push(issue(`${path}.connections[${index}]`, 'reference', 'connection endpoints must reference known steps'));
    if (connection.from === connection.to) errors.push(issue(`${path}.connections[${index}]`, 'cycle', 'self loops are not allowed'));
  });
  steps.filter((step) => isRecord(step) && step.type === 'deterministic-condition').forEach((step) => {
    const routes = (connections || []).filter((connection) => connection.from === step.id);
    const hasDefault = step.defaultValue !== undefined || routes.some((connection) => connection.default === true || connection.label === 'default' || connection.when === '__failure__');
    const hasFailure = steps.some((candidate) => isRecord(candidate) && candidate.type === 'failure') && routes.some((connection) => {
      const target = steps.find((candidate) => isRecord(candidate) && candidate.id === connection.to);
      return target?.type === 'failure';
    });
    if (!hasDefault && !hasFailure) errors.push(issue(`${path}.steps.${step.id}`, 'determinism', 'unknown condition values need an explicit default or failure path'));
  });
  const starts = steps.filter((step) => isRecord(step) && step.type === 'start');
  const terminals = steps.filter((step) => isRecord(step) && ['end', 'failure'].includes(step.type));
  if (starts.length !== 1) errors.push(issue(`${path}.steps`, 'topology', 'exactly one start step is required'));
  if (terminals.length === 0) errors.push(issue(`${path}.steps`, 'topology', 'at least one end or failure step is required'));
  const cycles = detectCycles(steps, connections);
  if (cycles.length) errors.push(issue(`${path}.connections`, 'cycle', 'orchestration graph must be acyclic', { cycles }));
  const inMap = incoming(connections);
  const outMap = outgoing(connections);
  steps.filter(isRecord).forEach((step) => {
    if (step.type !== 'start' && !inMap.has(step.id)) errors.push(issue(`${path}.steps.${step.id}`, 'topology', 'non-start step is disconnected'));
    if (!['end', 'failure'].includes(step.type) && !outMap.has(step.id)) errors.push(issue(`${path}.steps.${step.id}`, 'topology', 'non-terminal step needs an explicit outgoing path'));
  });
  if (starts.length === 1 && !cycles.length) {
    const reach = reachableToTerminal(steps, connections);
    if (!reach.reaches(starts[0].id)) errors.push(issue(`${path}.connections`, 'terminal-path', 'every reachable path must end in an explicit end/failure step'));
  }
  if (!value.outputContract && !value.outputContractRef) errors.push(issue(`${path}.outputContract`, 'required', 'existing output contract reference is required'));
  const outputContract = value.outputContract || value.outputContractRef;
  if (isNonEmptyString(outputContract) && !['C020', 'C020-AI-INSIGHT', 'C023', 'C025', 'C025-REPORT-COPILOT'].includes(outputContract)) errors.push(issue(`${path}.outputContract`, 'contract', 'final output must bind an existing approved contract (C020/C023/C025)'));
  return validation(errors.length === 0, errors);
}

function normalizeDefinition(value) {
  const source = clone(value);
  const result = {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    definitionId: source.definitionId || source.id,
    definitionVersion: source.definitionVersion || source.version,
    goal: source.goal || null,
    scenario: source.scenario || source.scenarioRef || null,
    inputContract: source.inputContract || source.inputContractRef || null,
    outputContract: source.outputContract || source.outputContractRef,
    steps: list(source.steps).map((step) => {
      const binding = step && (step.agentRelease || step.agentReleaseRef);
      const reference = binding && binding.releaseId
        ? { id: binding.releaseId, version: binding.releaseVersion || binding.version, digest: binding.digest || binding.fingerprint }
        : binding;
      return { ...step, agentRelease: reference || null };
    }),
    connections: list(source.connections || source.routes),
    failurePolicy: source.failurePolicy || 'stop',
    status: source.status || 'draft'
  };
  result.fingerprint = sha256(result);
  return immutable(result);
}

function assertOrchestrationDefinition(value, options = {}) {
  return normalizeDefinition(assertValid(validateOrchestrationDefinition(value, options), 'C014 OrchestrationDefinition') && value);
}

function permissionEntries(release, kind) { return release?.resourceAllowlist?.[kind] || []; }

function validateStepPermissions(step, release) {
  const errors = [];
  if (step.type !== 'agent') return errors;
  const binding = step.permissionNarrowing || step.permissions || {};
  const tools = list(binding.tools || binding.toolIds);
  tools.forEach((tool) => {
    const id = typeof tool === 'string' ? tool : tool.id || tool.refId;
    const version = typeof tool === 'string' ? undefined : tool.version || tool.refVersion;
    if (!releaseAllows(release, 'tool', id, version, undefined)) errors.push({ code: 'STEP_TOOL_EXPANDS_PERMISSION', id, version });
  });
  const resources = list(binding.resources || binding.resourceIds);
  resources.forEach((resource) => {
    const id = typeof resource === 'string' ? resource : resource.id || resource.refId;
    const version = typeof resource === 'string' ? undefined : resource.version || resource.refVersion;
    if (!releaseAllows(release, 'resource', id, version, undefined)) errors.push({ code: 'STEP_RESOURCE_EXPANDS_PERMISSION', id, version });
  });
  const capabilities = list(binding.capabilities || binding.capabilityIds);
  capabilities.forEach((capability) => {
    const id = typeof capability === 'string' ? capability : capability.id || capability.refId;
    const version = typeof capability === 'string' ? undefined : capability.version || capability.refVersion;
    if (!releaseAllows(release, 'capability', id, version, undefined)) errors.push({ code: 'STEP_CAPABILITY_EXPANDS_PERMISSION', id, version });
  });
  if (binding.evidenceScope !== undefined) {
    const allowedScopes = permissionEntries(release, 'resources').map((entry) => entry.scope).filter(Boolean)
      .concat((release.resourceWhitelist || []).map((entry) => entry.scope).filter(Boolean));
    if (allowedScopes.length === 0 || !allowedScopes.some((allowed) => scopeSubset(binding.evidenceScope, allowed))) errors.push({ code: 'STEP_EVIDENCE_SCOPE_EXPANDS_PERMISSION' });
  }
  return errors;
}

function releaseAllows(release, kind, id, version, scope) {
  if (allowlistContains(release, kind === 'tool' ? 'tools' : kind === 'capability' ? 'capabilities' : 'resources', id, version, scope)) return true;
  if (kind === 'tool' && Array.isArray(release?.tools)) return release.tools.some((entry) => (entry.id || entry.refId) === id && (entry.version || entry.refVersion) === version);
  if (kind === 'resource' && Array.isArray(release?.resourceWhitelist)) return release.resourceWhitelist.some((entry) => entry.resourceId === id && entry.resourceVersion === version && (!scope || scopeSubset(scope, entry.scope)));
  return false;
}

function publishOrchestrationRelease(definition, options = {}) {
  const inlineReleases = new Map();
  (definition?.steps || []).forEach((step) => {
    const candidate = step?.agentRelease || step?.agentReleaseRef;
    if (candidate?.releaseId) inlineReleases.set(`${candidate.releaseId}:${candidate.releaseVersion || candidate.version}`, candidate);
  });
  const normalized = assertOrchestrationDefinition(definition);
  const releases = options.agentReleases || options.releases || inlineReleases;
  const getRelease = (ref) => {
    if (ref && ref.releaseId) return ref;
    const id = ref?.refId || ref?.id || ref?.releaseId;
    const version = ref?.refVersion || ref?.version || ref?.releaseVersion;
    if (typeof releases.get === 'function') return releases.get(`${id}:${version}`) || releases.get(id);
    return releases[`${id}:${version}`] || releases[id];
  };
  const errors = [];
  normalized.steps.filter((step) => step.type === 'agent').forEach((step) => {
    const reference = step.agentRelease;
    const release = getRelease(reference) || (reference && reference.state ? reference : null);
    if (!release) errors.push({ code: 'AGENT_RELEASE_MISSING', stepId: step.id });
    else {
      try {
        const strictCheck = strictReleaseBoundary.validateAgentRelease(release, { requirePublished: false });
        if (!strictCheck.valid) assertAgentRelease({ ...release, state: release.state || 'enabled' });
      } catch (error) { errors.push({ code: error.code || 'AGENT_RELEASE_INVALID', stepId: step.id, message: error.message }); }
      errors.push(...validateStepPermissions(step, release).map((entry) => ({ ...entry, stepId: step.id })));
    }
  });
  if (errors.length) fail('ORCHESTRATION_RELEASE_INVALID', 'orchestration references invalid or over-broad Agent Releases', { errors });
  const release = immutable({
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    releaseId: options.releaseId || `${normalized.definitionId}-release`,
    releaseVersion: options.releaseVersion || `${normalized.definitionVersion}-1`,
    state: 'enabled',
    definition: normalized,
    agentReleaseRefs: normalized.steps.filter((step) => step.type === 'agent').map((step) => step.agentRelease),
    validation: { passed: true, checkedAt: options.checkedAt || new Date().toISOString(), errors: [] },
    failurePolicy: normalized.failurePolicy,
    fingerprint: sha256({ definition: normalized, agentReleaseRefs: normalized.steps.filter((step) => step.type === 'agent').map((step) => step.agentRelease) })
  });
  return release;
}

function startOrchestrationRun(release, input, options = {}) {
  if (!release || release.state !== 'enabled') fail('ORCHESTRATION_RELEASE_NOT_ENABLED', 'Orchestration Release is not enabled');
  const normalizedInput = assertAgentInput(input);
  const run = {
    runId: options.runId || uuid('orch-run'),
    attempt: 1,
    releaseId: release.releaseId,
    releaseVersion: release.releaseVersion,
    releaseFingerprint: release.fingerprint || release.digest,
    scenarioContext: normalizedInput.reportContext.scenarioContext,
    inputFingerprint: fixedInputFingerprint(normalizedInput),
    state: 'created',
    stepRuns: [],
    finalResult: null,
    createdAt: options.createdAt || new Date().toISOString()
  };
  if (options.audit?.append) options.audit.append({ operation: 'c014.run', outcome: 'started', details: { runId: run.runId, releaseId: run.releaseId, inputFingerprint: sha256(input) } });
  return immutable(run);
}

function retryOrchestrationRun(previous, reason, options = {}) {
  if (!previous || !isRecord(previous)) fail('ORCHESTRATION_RUN_REQUIRED', 'previous orchestration run is required');
  if (!['failed', 'partially-complete'].includes(previous.state)) fail('ORCHESTRATION_RETRY_INVALID', 'only failed or partial runs can be retried');
  if (options.releaseFingerprint && options.releaseFingerprint !== previous.releaseFingerprint) fail('ORCHESTRATION_RETRY_CONFIG_CHANGED', 'changed release requires a new orchestration run');
  if (options.inputFingerprint && options.inputFingerprint !== previous.inputFingerprint) fail('ORCHESTRATION_RETRY_INPUT_CHANGED', 'changed fixed input requires a new orchestration run');
  return immutable({ ...previous, runId: options.runId || uuid('orch-run'), attempt: previous.attempt + 1, state: 'created', retryOf: previous.runId, retryReason: reason || 'transient-failure', stepRuns: [], finalResult: null, createdAt: options.createdAt || new Date().toISOString() });
}

function cancelOrchestrationRun(run, options = {}) {
  if (!run || !isRecord(run)) fail('ORCHESTRATION_RUN_REQUIRED', 'run is required');
  if (['completed', 'failed', 'cancelled'].includes(run.state)) return immutable(run);
  return immutable({ ...run, state: 'cancelled', cancelledAt: options.cancelledAt || new Date().toISOString(), cancellationReason: options.reason || 'user-requested' });
}

function validateOrchestrationRelease(value, options = {}) {
  const errors = [];
  const path = options.path || 'orchestrationRelease';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'Orchestration Release must be an object')]);
  if (!isNonEmptyString(value.releaseId) || !isNonEmptyString(value.releaseVersion)) errors.push(issue(path, 'identity', 'exact orchestration release identity is required'));
  if (value.state !== 'enabled' && value.status !== 'enabled') errors.push(issue(`${path}.state`, 'lifecycle', 'Orchestration Release must be enabled'));
  if (!value.definition) errors.push(issue(`${path}.definition`, 'required', 'frozen definition is required'));
  else errors.push(...validateOrchestrationDefinition(value.definition, { path: `${path}.definition` }).errors);
  if (!Array.isArray(value.agentReleaseRefs)) errors.push(issue(`${path}.agentReleaseRefs`, 'required', 'exact Agent Release references are required'));
  return validation(errors.length === 0, errors);
}

function nextStepIds(definition, stepId, routeValue) {
  const connections = (definition.connections || []).filter((connection) => connection.from === stepId);
  if (routeValue === undefined || routeValue === null) return connections.map((connection) => connection.to);
  return connections.filter((connection) => connection.when === routeValue || connection.conditionValue === routeValue || connection.label === routeValue).map((connection) => connection.to);
}

/**
 * Deterministic, adapter-driven C014 execution. Control nodes never call the
 * model gateway; Agent nodes receive an immutable fixed input and an exact
 * Step Binding. The function returns a new run snapshot and never mutates the
 * Release or input.
 */
async function runOrchestration(orchestrationRelease, input, options = {}) {
  const releaseCheck = validateOrchestrationRelease(orchestrationRelease);
  if (!releaseCheck.valid) fail('ORCHESTRATION_RELEASE_INVALID', 'cannot run an invalid Orchestration Release', releaseCheck.errors);
  if (typeof options.agentExecutor !== 'function') fail('AGENT_EXECUTOR_REQUIRED', 'C014 execution requires an injected Agent executor');
  assertNoForbiddenPayload(input, 'C014 input');
  const definition = orchestrationRelease.definition;
  const steps = stepMap(definition.steps);
  const start = definition.steps.find((step) => step.type === 'start');
  const run = {
    schemaVersion: ORCHESTRATION_SCHEMA_VERSION,
    runId: options.runId || uuid('orch-run'),
    releaseId: orchestrationRelease.releaseId,
    releaseVersion: orchestrationRelease.releaseVersion,
    releaseFingerprint: orchestrationRelease.fingerprint,
    state: 'running',
    input: immutable(input),
    stepRuns: [],
    intermediateResults: [],
    startedAt: options.startedAt || nowIso(options.clock),
    finalResult: null
  };
  let frontier = [start.id];
  let guard = 0;
  const values = new Map();
  while (frontier.length && guard < definition.steps.length * 4) {
    guard += 1;
    const nextFrontier = [];
    for (const stepId of frontier) {
      const step = steps.get(stepId);
      if (!step) continue;
      const stepRun = { stepId, stepType: step.type, state: 'running', startedAt: nowIso(options.clock), inputFingerprint: sha256({ input, values: Object.fromEntries(values) }) };
      try {
        let output;
        if (step.type === 'start') output = input;
        else if (step.type === 'end' || step.type === 'failure') output = values.get(stepId) || null;
        else if (step.type === 'deterministic-condition') {
          const source = step.conditionField ? readPath(values.get(step.conditionSource) || input, step.conditionField) : values.get(step.conditionSource);
          const route = step.allowedValues && step.allowedValues.includes(source) ? source : (step.defaultValue !== undefined ? step.defaultValue : '__failure__');
          let paths = nextStepIds(definition, stepId, route);
          if (route === '__failure__' && paths.length === 0) {
            const failureStep = definition.steps.find((candidate) => candidate.type === 'failure');
            if (failureStep) paths = (definition.connections || []).filter((connection) => connection.from === stepId && connection.to === failureStep.id).map((connection) => connection.to);
          }
          output = { value: route, path: paths };
          nextFrontier.push(...output.path);
        } else if (step.type === 'human-pause') {
          run.state = 'human-paused';
          stepRun.state = 'human-paused';
          stepRun.output = { resumeRequired: true, fixedInput: true };
          run.stepRuns.push(immutable(stepRun));
          if (options.audit?.append) options.audit.append({ operation: 'c014.step', outcome: 'paused', details: { runId: run.runId, stepId } });
          return immutable(run);
        } else if (step.type === 'deterministic-join' || step.type === 'parallel-split') {
          output = { joined: true, sources: [...values.keys()] };
        } else if (step.type === 'agent') {
          output = await options.agentExecutor({ step: immutable(step), input: immutable(input), values: immutable(Object.fromEntries(values)), release: orchestrationRelease, runId: run.runId, readOnly: true, sideEffectsSuppressed: true });
          if (output?.sideEffects === true || output?.executedAction === true || output?.createdTodo === true) fail('STEP_SIDE_EFFECT_FORBIDDEN', 'C014 Agent step reported a prohibited side effect');
          assertNoForbiddenPayload(output, 'C014 agent output');
          run.intermediateResults.push(immutable({
            resultId: uuid('intermediate'),
            stepId,
            runId: run.runId,
            output: clone(output),
            outputFingerprint: sha256(output),
            confirmed: false,
            createdAt: nowIso(options.clock)
          }));
        }
        values.set(stepId, clone(output));
        stepRun.output = clone(output);
        stepRun.state = 'completed';
        stepRun.completedAt = nowIso(options.clock);
        if (step.type !== 'deterministic-condition') nextFrontier.push(...nextStepIds(definition, stepId));
      } catch (error) {
        stepRun.state = 'failed';
        stepRun.error = { code: error.code || 'STEP_FAILED', message: error.message || String(error) };
        run.stepRuns.push(immutable(stepRun));
        run.state = 'failed';
        run.failedAt = nowIso(options.clock);
        if (options.audit?.append) options.audit.append({ operation: 'c014.run', outcome: 'failed', details: { runId: run.runId, stepId, code: stepRun.error.code } });
        return immutable(run);
      }
      run.stepRuns.push(immutable(stepRun));
    }
    frontier = [...new Set(nextFrontier)];
  }
  if (guard >= definition.steps.length * 4) { run.state = 'failed'; run.error = { code: 'ORCHESTRATION_GUARD', message: 'execution exceeded deterministic topology guard' }; }
  else {
    const failureTerminal = definition.steps.find((step) => step.type === 'failure' && values.has(step.id));
    run.state = failureTerminal ? 'failed' : 'completed';
    const terminal = definition.steps.find((step) => step.type === 'end' && values.has(step.id));
    run.finalResult = terminal ? clone(values.get(terminal.id)) : null;
    run.completedAt = nowIso(options.clock);
    if (failureTerminal) run.failureStepId = failureTerminal.id;
  }
  if (options.audit?.append) options.audit.append({ operation: 'c014.run', outcome: run.state, details: { runId: run.runId, releaseId: run.releaseId } });
  return immutable(run);
}

function readPath(value, path) {
  return String(path).split('.').reduce((current, key) => current == null ? undefined : current[key], value);
}

module.exports = Object.freeze({
  ORCHESTRATION_SCHEMA_VERSION, STEP_TYPES, RUN_STATES, validateOrchestrationDefinition,
  normalizeDefinition, assertOrchestrationDefinition, detectCycles, reachableToTerminal,
  publishOrchestrationRelease, startOrchestrationRun, retryOrchestrationRun, cancelOrchestrationRun,
  validateStepPermissions, releaseAllows, validateOrchestrationRelease, runOrchestration, readPath
});
