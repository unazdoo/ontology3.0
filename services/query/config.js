'use strict';

const { fail } = require('./errors');
const {
  isRecord,
  clone,
  deepFreeze,
  requiredString,
  nowIso,
  assertDateTime,
  contextTriple,
  fingerprint,
  firstString
} = require('./utils');

const CONFIG_SCHEMA_VERSION = 'ofw.m03.c009.agent-config.v1';
const CONFIG_STATUSES = Object.freeze(['editing', 'pending-validation', 'validation-failed', 'enabled', 'disabled']);
const REQUIRED_SKILLS = Object.freeze([
  'scenario-resource-discovery',
  'object-resolution',
  'controlled-query-planning'
]);
const BASE_TOOL_KINDS = Object.freeze(['semantic-query', 'evidence-read', 'action-request-submit']);

function list(value, path) {
  if (!Array.isArray(value)) fail('ERR_C009_CONFIG_FIELD', `${path} must be an array`, { path });
  return value;
}

function ref(value, path, options = {}) {
  if (typeof value === 'string' && value.trim()) {
    const id = value.trim();
    const inferredVersion = /(?:@|[._-]v\d(?:[A-Za-z0-9._-]*))$/i.test(id) ? id : null;
    if (options.requireVersion !== false && !inferredVersion) fail('ERR_C009_CONFIG_REF_VERSION', `${path} must pin a version`, { path, id });
    return { id, version: inferredVersion };
  }
  if (!isRecord(value)) fail('ERR_C009_CONFIG_REF', `${path} must be a stable reference`, { path });
  const id = firstString(value, ['id', 'stableId', 'resourceId', 'skillId', 'toolId', 'kind', 'type']);
  if (!id) fail('ERR_C009_CONFIG_REF', `${path} must identify a stable resource`, { path });
  const version = firstString(value, ['version', 'refVersion', 'resourceVersion']);
  if (options.requireVersion !== false && !version) fail('ERR_C009_CONFIG_REF_VERSION', `${path} must pin a version`, { path, id });
  return {
    id,
    version: version || null,
    purpose: firstString(value, ['purpose', 'use', 'description']) || null,
    kind: firstString(value, ['kind', 'type']) || null
  };
}

function normalizeSkill(value, index) {
  const item = ref(value, `skills[${index}]`);
  return { skillId: item.id, version: item.version, purpose: item.purpose || null };
}

function normalizeTool(value, index) {
  const item = ref(value, `toolWhitelist[${index}]`);
  const idToken = item.id.toLowerCase();
  const kind = item.kind || (idToken.includes('semantic') || idToken.includes('query')
    ? 'semantic-query'
    : idToken.includes('evidence')
      ? 'evidence-read'
      : idToken.includes('action')
        ? 'action-request-submit'
        : null);
  return { toolId: item.id, version: item.version, purpose: item.purpose || null, kind: kind || null };
}

function normalizeResource(value, index) {
  const item = ref(value, `resourceWhitelist[${index}]`);
  return { resourceId: item.id, version: item.version, kind: item.kind || null, purpose: item.purpose || null };
}

function normalizeScenario(value, index) {
  if (typeof value === 'string' && value.trim()) return { scenarioId: value.trim(), scenarioVersion: null };
  if (!isRecord(value)) fail('ERR_C009_CONFIG_SCENARIO', `scenarios[${index}] must be a scenario binding`);
  const scenarioId = requiredString(value.scenarioId || value.id, `scenarios[${index}].scenarioId`);
  const scenarioVersion = firstString(value, ['scenarioVersion', 'version']);
  return { scenarioId, scenarioVersion };
}

function normalizePrompt(input) {
  const prompt = isRecord(input) ? input : { version: input };
  return {
    version: requiredString(prompt.version || prompt.promptVersion, 'prompt.version'),
    id: firstString(prompt, ['id', 'promptId']) || null,
    digest: firstString(prompt, ['digest', 'sha256', 'hash']) || null
  };
}

function normalizeProof(input, label) {
  if (!isRecord(input)) fail('ERR_C009_CAPABILITY_PROOF', `${label} proof is required`, { label });
  const status = String(input.status || input.state || '').trim().toLowerCase();
  if (!['loaded', 'available', 'verified', 'ready', 'passed'].includes(status)) {
    fail('ERR_C009_CAPABILITY_PROOF', `${label} proof is not affirmative`, { label, status: status || null });
  }
  const id = firstString(input, ['id', 'stableId', 'skillId', 'toolId', 'capabilityId']);
  const version = firstString(input, ['version', 'loadedVersion', 'actualVersion']);
  if (!id || !version) fail('ERR_C009_CAPABILITY_PROOF', `${label} proof must identify actual id and version`, { label });
  return {
    id,
    version,
    status,
    checkedAt: input.checkedAt || input.verifiedAt || null,
    source: firstString(input, ['source', 'runtime', 'provider']) || null,
    purpose: firstString(input, ['purpose', 'use']) || null
  };
}

function normalizeConfig(input, options = {}) {
  if (!isRecord(input)) fail('ERR_C009_CONFIG_INVALID', 'C009 agent configuration must be an object');
  const forbiddenAgentFields = ['reportAgent', 'insightAgent', 'companionAgent', 'agentApplication', 'conversationMemory', 'externalKnowledge'];
  const injected = forbiddenAgentFields.filter((key) => Object.prototype.hasOwnProperty.call(input, key));
  if (injected.length) fail('ERR_C009_CONFIG_SCOPE', 'M05/report-agent context cannot be injected into C009', { fields: injected });
  const config = {
    schemaVersion: input.schemaVersion || CONFIG_SCHEMA_VERSION,
    agentId: requiredString(input.agentId || input.id, 'agentId'),
    configVersion: requiredString(input.configVersion || input.version, 'configVersion'),
    status: String(input.status || (input.enabled ? 'enabled' : '')).trim().toLowerCase(),
    prompt: normalizePrompt(input.prompt || input.systemPrompt || input.promptVersion),
    skills: list(input.skills || input.skillSet || [], 'skills').map(normalizeSkill),
    toolWhitelist: list(input.toolWhitelist || input.toolAllowlist || input.tools || [], 'toolWhitelist').map(normalizeTool),
    platformDeterminismVersion: requiredString(
      input.platformDeterminismVersion || input.deterministicCapabilityVersion || input.platformCapabilitiesVersion,
      'platformDeterminismVersion'
    ),
    publishedOntologyVersion: requiredString(
      input.publishedOntologyVersion || input.publishedSemanticVersion || input.ontologyVersion,
      'publishedOntologyVersion'
    ),
    resourceWhitelist: list(input.resourceWhitelist || input.resources || [], 'resourceWhitelist').map(normalizeResource),
    scenarios: list(input.scenarios || input.scenarioBindings || (input.scenarioId ? [{ scenarioId: input.scenarioId, scenarioVersion: input.scenarioVersion }] : []), 'scenarios').map(normalizeScenario),
    validFrom: input.validFrom || input.effectiveFrom || null,
    validUntil: input.validUntil || input.effectiveUntil || null,
    owner: firstString(input, ['owner', 'moduleOwner']) || 'M03',
    description: firstString(input, ['description', 'summary']) || null,
    capabilityProof: input.capabilityProof ? clone(input.capabilityProof) : null,
    loadedSkillSet: input.loadedSkillSet || input.loadedSkills || input.actualSkills || input.capabilityProof?.skills || null,
    availableTools: input.availableTools || input.actualTools || input.capabilityProof?.tools || null,
    actualPromptVersion: input.actualPromptVersion || input.loadedPromptVersion || input.capabilityProof?.promptVersion || null,
    actualPlatformDeterminismVersion: input.actualPlatformDeterminismVersion || input.loadedPlatformVersion || input.capabilityProof?.platformDeterminismVersion || null,
    resourceWhitelistVersion: firstString(input, ['resourceWhitelistVersion', 'resourceVersion']) || null,
    toolWhitelistVersion: firstString(input, ['toolWhitelistVersion', 'toolsVersion']) || null,
    createdAt: input.createdAt || null
  };
  if (!CONFIG_STATUSES.includes(config.status)) fail('ERR_C009_CONFIG_STATUS', 'C009 configuration status is not recognized', { status: config.status || null });
  if (config.schemaVersion !== CONFIG_SCHEMA_VERSION) fail('ERR_C009_CONFIG_SCHEMA', 'unsupported C009 configuration schema', { expected: CONFIG_SCHEMA_VERSION, actual: config.schemaVersion });
  if (!config.skills.length) fail('ERR_C009_CONFIG_SKILLS', 'C009 configuration must pin its Skill set');
  if (!config.toolWhitelist.length) fail('ERR_C009_CONFIG_TOOLS', 'C009 configuration must pin its Tool whitelist');
  if (!config.resourceWhitelist.length) fail('ERR_C009_CONFIG_RESOURCES', 'C009 configuration must pin its resource whitelist');
  if (!config.scenarios.length) fail('ERR_C009_CONFIG_SCENARIOS', 'C009 configuration must bind at least one scenario');
  const skillIds = new Set(config.skills.map((skill) => skill.skillId));
  if (options.requireBaseSkills !== false) {
    const missing = REQUIRED_SKILLS.filter((skill) => {
      const aliases = {
        'scenario-resource-discovery': ['scenario-resource-discovery', 'scenario', 'resource-discovery'],
        'object-resolution': ['object-resolution', 'object', 'semantic-resolution'],
        'controlled-query-planning': ['controlled-query-planning', 'query-planning', 'semantic-query']
      }[skill];
      return ![...skillIds].some((id) => aliases.some((alias) => id.toLowerCase().includes(alias)));
    });
    if (missing.length) fail('ERR_C009_CONFIG_SKILLS', 'C009 configuration is missing required query Skills', { missing });
  }
  if (options.requireBaseTools !== false) {
    const toolText = config.toolWhitelist.map((tool) => `${tool.kind || ''}:${tool.toolId}`.toLowerCase()).join('|');
    const missing = BASE_TOOL_KINDS.filter((kind) => !toolText.includes(kind));
    if (missing.length) fail('ERR_C009_CONFIG_TOOLS', 'C009 configuration is missing a required Tool category', { missing });
  }
  if (config.validFrom) assertDateTime(config.validFrom, 'validFrom');
  if (config.validUntil) assertDateTime(config.validUntil, 'validUntil');
  if (config.validFrom && config.validUntil && Date.parse(config.validUntil) <= Date.parse(config.validFrom)) {
    fail('ERR_C009_CONFIG_WINDOW', 'validUntil must be after validFrom');
  }
  return config;
}

function validateAgentConfig(value, options = {}) {
  try {
    const normalized = normalizeConfig(value, options);
    return { valid: true, errors: [], value: normalized };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code || 'ERR_C009_CONFIG', message: error.message, details: error.details }], value: null };
  }
}

function assertAgentConfig(value, options = {}) {
  const result = validateAgentConfig(value, options);
  if (!result.valid) fail(result.errors[0].code, result.errors[0].message, result.errors[0].details);
  return deepFreeze(result.value);
}

function configFingerprint(config) {
  return fingerprint({
    schemaVersion: config.schemaVersion,
    agentId: config.agentId,
    configVersion: config.configVersion,
    prompt: config.prompt,
    skills: config.skills,
    toolWhitelist: config.toolWhitelist,
    platformDeterminismVersion: config.platformDeterminismVersion,
    publishedOntologyVersion: config.publishedOntologyVersion,
    resourceWhitelist: config.resourceWhitelist,
    scenarios: config.scenarios,
    validFrom: config.validFrom,
    validUntil: config.validUntil
  });
}

function isConfigActive(config, at = new Date()) {
  const timestamp = at instanceof Date ? at.getTime() : Date.parse(at);
  if (Number.isNaN(timestamp) || config.status !== 'enabled') return false;
  if (config.validFrom && timestamp < Date.parse(config.validFrom)) return false;
  if (config.validUntil && timestamp >= Date.parse(config.validUntil)) return false;
  return true;
}

function matchesScenario(config, context) {
  const triple = contextTriple(context);
  return config.scenarios.some((binding) => binding.scenarioId === triple.scenarioId
    && (!binding.scenarioVersion || binding.scenarioVersion === triple.scenarioVersion));
}

function matchAgentConfigs(configs, context, at = new Date()) {
  if (!Array.isArray(configs)) fail('ERR_C009_CONFIG_CANDIDATES', 'agent configurations must be an array');
  const candidates = configs.map((item) => assertAgentConfig(item)).filter((config) => isConfigActive(config, at) && matchesScenario(config, context));
  if (candidates.length === 1) return { status: 'unique', config: candidates[0], candidates };
  if (candidates.length > 1) return { status: 'ambiguous', config: null, candidates };
  return { status: 'none', config: null, candidates: [] };
}

function verifyCapabilityProof(config, actual = {}) {
  const errors = [];
  const actualPromptVersion = actual.promptVersion || actual.loadedPromptVersion || actual.prompt?.version;
  if (actualPromptVersion !== undefined && actualPromptVersion !== config.prompt.version) {
    errors.push({ code: 'PROMPT_VERSION_MISMATCH', expected: config.prompt.version, actual: actualPromptVersion });
  }
  const skills = Array.isArray(actual.skills) ? actual.skills : [];
  const tools = Array.isArray(actual.tools || actual.toolWhitelist) ? (actual.tools || actual.toolWhitelist) : [];
  for (const expected of config.skills) {
    const found = skills.find((item) => (item.skillId || item.id || item.stableId) === expected.skillId);
    if (!found) { errors.push({ code: 'SKILL_MISSING', id: expected.skillId }); continue; }
    const version = found.version || found.actualVersion || found.loadedVersion;
    if (version !== expected.version) errors.push({ code: 'SKILL_VERSION_MISMATCH', id: expected.skillId, expected: expected.version, actual: version || null });
    if (expected.purpose && found.purpose && found.purpose !== expected.purpose) errors.push({ code: 'SKILL_PURPOSE_MISMATCH', id: expected.skillId });
    if (!['loaded', 'available', 'verified', 'ready', 'passed'].includes(String(found.status || found.state || '').toLowerCase())) errors.push({ code: 'SKILL_NOT_PROVEN', id: expected.skillId });
  }
  for (const expected of config.toolWhitelist) {
    const found = tools.find((item) => (item.toolId || item.id || item.stableId) === expected.toolId);
    if (!found) { errors.push({ code: 'TOOL_MISSING', id: expected.toolId }); continue; }
    const version = found.version || found.actualVersion || found.loadedVersion;
    if (version !== expected.version) errors.push({ code: 'TOOL_VERSION_MISMATCH', id: expected.toolId, expected: expected.version, actual: version || null });
    if (expected.purpose && found.purpose && found.purpose !== expected.purpose) errors.push({ code: 'TOOL_PURPOSE_MISMATCH', id: expected.toolId });
    if (!['loaded', 'available', 'verified', 'ready', 'passed'].includes(String(found.status || found.state || '').toLowerCase())) errors.push({ code: 'TOOL_NOT_PROVEN', id: expected.toolId });
  }
  const expectedSkillIds = new Set(config.skills.map((item) => item.skillId));
  skills.forEach((item) => {
    const id = item.skillId || item.id || item.stableId;
    if (id && !expectedSkillIds.has(id)) errors.push({ code: 'SKILL_OUTSIDE_WHITELIST', id });
  });
  const expectedToolIds = new Set(config.toolWhitelist.map((item) => item.toolId));
  tools.forEach((item) => {
    const id = item.toolId || item.id || item.stableId;
    if (id && !expectedToolIds.has(id)) errors.push({ code: 'TOOL_OUTSIDE_WHITELIST', id });
  });
  const platformVersion = actual.platformDeterminismVersion || actual.platformVersion;
  if (platformVersion !== config.platformDeterminismVersion) errors.push({ code: 'PLATFORM_VERSION_MISMATCH', expected: config.platformDeterminismVersion, actual: platformVersion || null });
  return { valid: errors.length === 0, errors };
}

function createConfigSnapshot(input, options = {}) {
  const config = assertAgentConfig(input, options);
  const normalizeActual = (items, expected, idKeys) => Array.isArray(items) ? items.map((item) => {
    if (typeof item === 'string') {
      const found = expected.find((candidate) => candidate[idKeys] === item);
      return { [idKeys]: item, version: found ? found.version : item, status: 'verified' };
    }
    return clone(item);
  }) : null;
  return deepFreeze({
    ...config,
    promptVersion: config.prompt.version,
    skillSet: config.skills,
    toolAllowlist: config.toolWhitelist,
    resourceAllowlist: config.resourceWhitelist,
    loadedSkillSet: normalizeActual(config.loadedSkillSet, config.skills, 'skillId'),
    availableTools: normalizeActual(config.availableTools, config.toolWhitelist, 'toolId'),
    actualPromptVersion: config.actualPromptVersion,
    actualPlatformDeterminismVersion: config.actualPlatformDeterminismVersion,
    fingerprint: configFingerprint(config),
    snapshotAt: options.snapshotAt || nowIso()
  });
}

module.exports = Object.freeze({
  CONFIG_SCHEMA_VERSION,
  CONFIG_STATUSES,
  REQUIRED_SKILLS,
  BASE_TOOL_KINDS,
  normalizeConfig,
  validateAgentConfig,
  assertAgentConfig,
  createConfigSnapshot,
  configFingerprint,
  isConfigActive,
  matchesScenario,
  matchAgentConfigs,
  verifyCapabilityProof,
  normalizeCapabilityProof: normalizeProof
});
