'use strict';

const {
  isRecord, isNonEmptyString, clone, immutable, sha256, issue, validation, assertValid,
  fail, uuid, getRef, normalizeRef, nowIso, list, asSet
} = require('./util');
const { scanPromptInjection } = require('./security');

const RESOURCE_TYPES = Object.freeze([
  'Agent', 'Prompt', 'Skill', 'Tool', 'ToolAllowlist', 'Model', 'PublishedOntology', 'Scenario', 'OutputContract'
]);
const RELEASE_STATES = Object.freeze(['draft', 'testable', 'validating', 'validation-failed', 'validated', 'enabled', 'disabled', 'historical']);
const RELEASE_SCHEMA_VERSION = 'ofw.m05.agent-release.draft.v1';
const EXACT_VERSION_RE = /^(?!latest$)(?!current$)(?!head$)(?!tip$)(?!main$)(?!master$)\S+$/i;

function ref(value, type, required = true) {
  const normalized = normalizeRef(value, type);
  if (!normalized && required) return null;
  return normalized;
}

function validateResourceRef(value, options = {}) {
  const errors = [];
  const path = options.path || 'resource';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'resource must be an object')]);
  const type = value.type || value.resourceType || value.refType;
  const id = value.id || value.refId || value.resourceId;
  const version = value.version || value.refVersion || value.resourceVersion;
  if (!isNonEmptyString(type) || !RESOURCE_TYPES.includes(type)) errors.push(issue(`${path}.type`, 'enum', 'unsupported M05 resource type'));
  if (!isNonEmptyString(id)) errors.push(issue(`${path}.id`, 'required', 'resource id is required'));
  if (!isNonEmptyString(version)) errors.push(issue(`${path}.version`, 'required', 'resource version is required'));
  else if (!EXACT_VERSION_RE.test(String(version).trim())) errors.push(issue(`${path}.version`, 'exact', 'resource version must be exact; latest/current aliases are forbidden'));
  const status = String(value.status || 'published').toLowerCase();
  if (!['draft', 'published', 'active', 'enabled', 'valid'].includes(status)) errors.push(issue(`${path}.status`, 'lifecycle', 'resource is not consumable'));
  if (status === 'draft' && options.allowDraft !== true) errors.push(issue(`${path}.status`, 'lifecycle', 'draft resources cannot be bound to a release'));
  if (value.digest !== undefined && (!isNonEmptyString(value.digest) || !/^[a-f0-9]{64}$/i.test(value.digest))) errors.push(issue(`${path}.digest`, 'format', 'digest must be a SHA-256 hex string'));
  return validation(errors.length === 0, errors);
}

function normalizeResource(value, type) {
  const source = clone(value || {});
  const result = {
    type: type || source.type || source.resourceType || source.refType,
    id: source.id || source.refId || source.resourceId,
    version: source.version || source.refVersion || source.resourceVersion,
    status: source.status || 'published'
  };
  if (source.digest) result.digest = source.digest;
  if (source.owner) result.owner = source.owner;
  if (source.effectiveWindow || source.validity) result.effectiveWindow = source.effectiveWindow || source.validity;
  if (source.metadata) result.metadata = source.metadata;
  return immutable(result);
}

function assertResource(value, options = {}) {
  assertValid(validateResourceRef(value, options), 'M05 Resource');
  return normalizeResource(value);
}

class ResourceRegistry {
  constructor(resources = [], options = {}) {
    const source = resources instanceof ResourceRegistry ? resources.resources : resources;
    if (!Array.isArray(source)) fail('RESOURCE_REGISTRY_INVALID', 'resources must be an array');
    const normalized = source.map((item) => assertResource(item, { allowDraft: options.allowDraft === true }));
    const keys = new Set();
    normalized.forEach((item) => {
      const key = `${item.type}:${item.id}:${item.version}`;
      if (keys.has(key)) fail('RESOURCE_DUPLICATE', `duplicate resource ${key}`);
      keys.add(key);
    });
    this.resources = immutable(normalized);
    this.schemaVersion = RELEASE_SCHEMA_VERSION;
    Object.freeze(this);
  }

  register(resource, options = {}) {
    const normalized = assertResource(resource, { allowDraft: options.allowDraft === true });
    const key = `${normalized.type}:${normalized.id}:${normalized.version}`;
    if (this.resources.some((item) => `${item.type}:${item.id}:${item.version}` === key)) fail('RESOURCE_DUPLICATE', `resource ${key} already exists`);
    return new ResourceRegistry([...this.resources, normalized], options);
  }

  get(type, id, version) {
    if (!isNonEmptyString(version) || !EXACT_VERSION_RE.test(String(version).trim())) return null;
    return this.resources.find((item) => item.type === type && item.id === id && item.version === version) || null;
  }

  has(value) {
    const normalized = normalizeResource(value);
    return Boolean(normalized && this.get(normalized.type, normalized.id, normalized.version));
  }

  list(type) { return this.resources.filter((item) => !type || item.type === type); }
}

function allowlistEntries(value, key) {
  const source = value?.[key] || value?.[`${key}Allowlist`] || [];
  return list(source).map((entry) => {
    if (isNonEmptyString(entry)) return { id: entry.trim() };
    if (!isRecord(entry)) return null;
    return {
      id: entry.id || entry.refId || entry.name || entry.toolId || entry.resourceId,
      version: entry.version || entry.refVersion || entry.resourceVersion || undefined,
      scope: entry.scope || entry.resourceScope || undefined,
      actions: Array.isArray(entry.actions) ? [...entry.actions] : undefined,
      requiresConfirmation: entry.requiresConfirmation === true
    };
  }).filter((entry) => entry && isNonEmptyString(entry.id)).map((entry) => {
    const normalized = { id: entry.id.trim() };
    if (entry.version) normalized.version = String(entry.version).trim();
    if (entry.scope) normalized.scope = immutable(entry.scope);
    if (entry.actions) normalized.actions = [...new Set(entry.actions.map(String))].sort();
    if (entry.requiresConfirmation) normalized.requiresConfirmation = true;
    return normalized;
  });
}

function validateAllowlist(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(issue(path, 'required', 'resource allowlist is required'));
    return;
  }
  for (const key of ['tools', 'resources', 'capabilities']) {
    if (value[key] !== undefined && !Array.isArray(value[key])) errors.push(issue(`${path}.${key}`, 'type', 'allowlist entries must be an array'));
  }
  const forbidden = ['filesystem', 'internet', 'database', 'raw-data', 't002', 't007', 't019', 'report-publish', 'action-execute', 'todo-write'];
  const values = [...allowlistEntries(value, 'tools'), ...allowlistEntries(value, 'resources'), ...allowlistEntries(value, 'capabilities')];
  values.forEach((entry) => {
    if (entry.id === '*' || /^(latest|current|head|main|master)$/i.test(String(entry.id || ''))) errors.push(issue(`${path}.${entry.id || 'entry'}.id`, 'exact', 'wildcard/current resource ids are not allowed'));
    if (forbidden.some((token) => entry.id.toLowerCase().includes(token))) errors.push(issue(`${path}.${entry.id}`, 'forbidden', 'allowlist contains a prohibited capability'));
    if (!entry.version || !EXACT_VERSION_RE.test(entry.version)) errors.push(issue(`${path}.${entry.id}.version`, 'exact', 'every allowlist entry must pin an exact version'));
  });
}

function validateAgentRelease(value, options = {}) {
  const errors = [];
  const path = options.path || 'agentRelease';
  if (!isRecord(value)) return validation(false, [issue(path, 'type', 'Agent Release must be an object')]);
  const requiredRefs = [
    ['agent', 'Agent'], ['prompt', 'Prompt'], ['model', 'Model'], ['toolAllowlist', 'ToolAllowlist'],
    ['publishedOntology', 'PublishedOntology'], ['scenario', 'Scenario'], ['outputContract', 'OutputContract']
  ];
  for (const [key, type] of requiredRefs) {
    if (!ref(value[key] || value[`${key}Ref`], type)) errors.push(issue(`${path}.${key}`, 'required', `exact ${type} reference is required`));
  }
  const skills = value.skills || value.skillRefs;
  if (!Array.isArray(skills) || skills.length === 0) errors.push(issue(`${path}.skills`, 'required', 'at least one exact Skill reference is required'));
  else skills.forEach((skill, index) => { if (!ref(skill, 'Skill')) errors.push(issue(`${path}.skills[${index}]`, 'required', 'exact Skill reference is required')); });
  const releaseId = value.releaseId || value.id || value.agentReleaseId;
  const releaseVersion = value.releaseVersion || value.version || value.agentReleaseVersion;
  if (!isNonEmptyString(releaseId)) errors.push(issue(`${path}.releaseId`, 'required', 'release identity is required'));
  if (!isNonEmptyString(releaseVersion)) errors.push(issue(`${path}.releaseVersion`, 'required', 'release version is required'));
  const state = String(value.state || value.status || 'validated').toLowerCase();
  if (!RELEASE_STATES.includes(state)) errors.push(issue(`${path}.state`, 'enum', 'unsupported release state'));
  if (['enabled', 'validated'].includes(state) && value.validation && value.validation.passed === false) errors.push(issue(`${path}.validation`, 'gate', 'release validation has not passed'));
  validateAllowlist(value.resourceAllowlist || value.allowlist, `${path}.resourceAllowlist`, errors);
  const window = value.effectiveWindow || value.validity || {};
  if (!isRecord(window)) errors.push(issue(`${path}.effectiveWindow`, 'type', 'effective window must be an object'));
  else {
    const start = window.validFrom || window.startsAt || value.effectiveFrom;
    const end = window.validTo || window.endsAt || value.effectiveTo;
    if (!isNonEmptyString(start) || !requireDate(start)) errors.push(issue(`${path}.effectiveWindow.validFrom`, 'format', 'validFrom is required and must be RFC 3339'));
    if (end !== undefined && (!isNonEmptyString(end) || !requireDate(end))) errors.push(issue(`${path}.effectiveWindow.validTo`, 'format', 'validTo must be RFC 3339'));
    if (start && end && Date.parse(start) > Date.parse(end)) errors.push(issue(`${path}.effectiveWindow`, 'range', 'validFrom must precede validTo'));
  }
  if (value.prompt) {
    const scan = scanPromptInjection(value.prompt.body || value.prompt.text || value.prompt.content || value.prompt);
    if (scan.detected) errors.push(issue(`${path}.prompt`, 'prompt-injection', 'prompt contains an unsafe instruction pattern', scan));
  }
  if (value.publishedOntology && String(value.publishedOntology.status || 'published').toLowerCase() !== 'published') errors.push(issue(`${path}.publishedOntology`, 'lifecycle', 'only Published ontology resources may be bound'));
  if (value.scenario && ['disabled', 'paused', 'not-ready'].includes(String(value.scenario.status || '').toLowerCase())) errors.push(issue(`${path}.scenario`, 'lifecycle', 'scenario is not ready for new runs'));
  return validation(errors.length === 0, errors);
}

function requireDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) && /T\d{2}:\d{2}:\d{2}/.test(value);
}

function normalizeAgentRelease(value, options = {}) {
  const source = clone(value);
  const result = {
    schemaVersion: RELEASE_SCHEMA_VERSION,
    releaseId: source.releaseId || source.id || source.agentReleaseId,
    releaseVersion: source.releaseVersion || source.version || source.agentReleaseVersion,
    state: String(source.state || source.status || 'validated').toLowerCase(),
    agent: ref(source.agent || source.agentRef, 'Agent'),
    prompt: ref(source.prompt || source.promptRef, 'Prompt'),
    skills: list(source.skills || source.skillRefs).map((item) => ref(item, 'Skill')).filter(Boolean),
    model: ref(source.model || source.modelRef, 'Model'),
    toolAllowlist: ref(source.toolAllowlist || source.toolAllowlistRef || source.allowlistRef, 'ToolAllowlist'),
    publishedOntology: ref(source.publishedOntology || source.publishedOntologyRef || source.ontology, 'PublishedOntology'),
    scenario: ref(source.scenario || source.scenarioRef || source.scenarioBinding, 'Scenario'),
    outputContract: ref(source.outputContract || source.outputContractRef, 'OutputContract'),
    resourceAllowlist: {
      tools: allowlistEntries(source.resourceAllowlist || source.allowlist, 'tools'),
      resources: allowlistEntries(source.resourceAllowlist || source.allowlist, 'resources'),
      capabilities: allowlistEntries(source.resourceAllowlist || source.allowlist, 'capabilities')
    },
    effectiveWindow: clone(source.effectiveWindow || source.validity || {
      validFrom: source.effectiveFrom || source.formedAt || nowIso(options.clock)
    }),
    validation: clone(source.validation || { passed: true, cases: [] }),
    owner: source.owner || 'M05 / Agent Application'
  };
  result.fingerprint = sha256(result);
  return immutable(result);
}

function assertAgentRelease(value, options = {}) {
  return normalizeAgentRelease(assertValid(validateAgentRelease(value, options), 'AgentRelease') && value, options);
}

function ensureRegistryContains(release, registry) {
  if (!registry) return true;
  const refs = [release.agent, release.prompt, ...release.skills, release.model, release.toolAllowlist, release.publishedOntology, release.scenario, release.outputContract];
  const missing = refs.filter((item) => !registry.has({ type: item.refType, id: item.refId, version: item.refVersion })).map((item) => item.refType + ':' + item.refId + ':' + item.refVersion);
  if (missing.length) fail('RELEASE_RESOURCE_MISSING', 'Agent Release references resources absent from the registry', { missing });
  return true;
}

function publishAgentRelease(value, options = {}) {
  const release = assertAgentRelease({ ...value, state: 'validated' }, options);
  ensureRegistryContains(release, options.registry);
  if (release.validation && release.validation.passed === false) fail('RELEASE_VALIDATION_REQUIRED', 'only a validated Agent Release can be published');
  return immutable({ ...release, state: 'enabled', publishedAt: nowIso(options.clock), fingerprint: sha256({ ...release, state: 'enabled' }) });
}

function isWithinEffectiveWindow(release, at = new Date().toISOString()) {
  const window = release.effectiveWindow || {};
  const start = window.validFrom || window.startsAt;
  const end = window.validTo || window.endsAt;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return false;
  if (start && time < Date.parse(start)) return false;
  if (end && time >= Date.parse(end)) return false;
  return true;
}

function allowlistContains(release, kind, id, version, scope, action) {
  let entries = release?.resourceAllowlist?.[kind] || [];
  // Accept the strict M05 Agent Release shape (`resourceWhitelist`) at the
  // gateway boundary without copying or widening its permissions.
  if (entries.length === 0 && Array.isArray(release?.resourceWhitelist)) {
    const expectedType = kind === 'tools' ? 'tool' : kind === 'resources' ? null : kind;
    entries = release.resourceWhitelist
      .filter((entry) => !expectedType || entry.resourceType === expectedType || entry.type === expectedType)
      .map((entry) => ({ id: entry.resourceId || entry.id || entry.refId, version: entry.resourceVersion || entry.version || entry.refVersion, scope: entry.scope, actions: entry.operations || entry.actions }));
  }
  return entries.some((entry) => {
    if (entry.id !== id) return false;
    if (!entry.version || !version || entry.version !== version) return false;
    if (action && entry.actions && !entry.actions.includes(action)) return false;
    if (scope && entry.scope && !scopeSubset(scope, entry.scope)) return false;
    return true;
  });
}

function scopeSubset(actual, allowed) {
  if (actual === undefined || actual === null) return true;
  if (allowed === undefined || allowed === null) return false;
  if (Array.isArray(actual)) return actual.every((item) => Array.isArray(allowed) && allowed.includes(item));
  if (isRecord(actual) && isRecord(allowed)) return Object.keys(actual).every((key) => {
    if (!(key in allowed)) return false;
    if (Array.isArray(actual[key])) return Array.isArray(allowed[key]) && actual[key].every((item) => allowed[key].includes(item));
    return actual[key] === allowed[key];
  });
  return actual === allowed;
}

function authorizeResource(release, request = {}) {
  const errors = [];
  if (!release || !['enabled', 'active'].includes(String(release.state || release.status || '').toLowerCase())) errors.push({ code: 'RELEASE_NOT_ENABLED', message: 'Agent Release is not enabled' });
  if (request.at && !isWithinEffectiveWindow(release, request.at)) errors.push({ code: 'RELEASE_OUTSIDE_EFFECTIVE_WINDOW', message: 'Agent Release is outside its effective window' });
  const kind = request.kind || 'resources';
  if (request.id && !allowlistContains(release, kind, request.id, request.version, request.scope, request.action)) errors.push({ code: 'RESOURCE_NOT_ALLOWLISTED', message: 'resource/tool is not in the exact Release allowlist', details: { kind, id: request.id, version: request.version } });
  return { allowed: errors.length === 0, errors };
}

function assertAuthorizedResource(release, request) {
  const result = authorizeResource(release, request);
  if (!result.allowed) fail(result.errors[0].code, result.errors[0].message, result.errors);
  return true;
}

module.exports = Object.freeze({
  RESOURCE_TYPES, RELEASE_STATES, RELEASE_SCHEMA_VERSION,
  ResourceRegistry, validateResourceRef, normalizeResource, assertResource,
  validateAgentRelease, normalizeAgentRelease, assertAgentRelease, publishAgentRelease,
  ensureRegistryContains, isWithinEffectiveWindow, allowlistContains, scopeSubset,
  authorizeResource, assertAuthorizedResource, allowlistEntries
});
