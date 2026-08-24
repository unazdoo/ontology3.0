'use strict';

/*
 * Compatibility facade for M05's legacy `refType/refId/refVersion` shape.
 * New code should use `packages/agent-release`; this facade lets the gateway
 * and orchestration modules consume the same immutable policy boundary while
 * preserving their existing wire names.
 */

const strict = require('../agent-release');

function toStrictRef(value, fallbackType) {
  if (value === null || value === undefined) return null;
  const source = typeof value === 'string' ? { id: value } : value;
  return {
    type: source.type || source.refType || source.resourceType || fallbackType,
    id: source.id || source.refId || source.resourceId,
    version: source.version || source.refVersion || source.resourceVersion,
    ...(source.status === undefined ? {} : { status: source.status }),
    ...(source.owner === undefined ? {} : { owner: source.owner })
  };
}

function toStrictAllowlist(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const entries = [];
  for (const [kind, list] of Object.entries(value)) {
    if (!Array.isArray(list)) continue;
    list.forEach((entry) => {
      const source = typeof entry === 'string' ? { id: entry } : entry || {};
      const id = source.resourceId || source.toolId || source.id || source.refId || source.name;
      const version = source.resourceVersion || source.toolVersion || source.version || source.refVersion;
      const operations = source.operations || source.allowedOperations || source.actions || ['read'];
      entries.push({ resourceType: source.resourceType || (kind === 'tools' ? 'tool' : 'evidence'), resourceId: id, resourceVersion: version, operations, scope: source.scope, readOnly: source.readOnly !== false });
    });
  }
  return entries;
}

function toStrictRelease(value) {
  if (!value || typeof value !== 'object') return value;
  if (value.agent && value.prompt && value.model && Array.isArray(value.skills) && Array.isArray(value.tools || value.toolRefs)) return value;
  const source = value;
  const allowlist = source.resourceWhitelist || source.resourceAllowlist || source.allowlist || {};
  const tools = source.tools || source.toolRefs || (Array.isArray(allowlist.tools) ? allowlist.tools : []).map((entry) => toStrictRef(entry, 'tool'));
  return {
    schemaVersion: strict.AGENT_RELEASE_SCHEMA_VERSION,
    releaseId: source.releaseId || source.id || source.agentReleaseId,
    releaseVersion: source.releaseVersion || source.version || source.agentReleaseVersion,
    status: source.status || (source.state === 'enabled' ? 'active' : source.state) || 'validated',
    agent: toStrictRef(source.agent || source.agentRef, 'agent'),
    prompt: toStrictRef(source.prompt || source.promptRef, 'prompt'),
    skills: (source.skills || source.skillRefs || []).map((item) => toStrictRef(item, 'skill')),
    tools: tools.map((item) => toStrictRef(item, 'tool')),
    model: toStrictRef(source.model || source.modelRef, 'model'),
    publishedOntologies: [toStrictRef(source.publishedOntologies?.[0] || source.publishedOntology || source.publishedOntologyRef || source.ontology, 'publishedOntology')].filter(Boolean),
    scenario: toStrictRef(source.scenario || source.scenarioRef || source.scenarioBinding, 'scenario'),
    validity: source.validity || source.effectiveWindow || { validFrom: source.effectiveFrom, validTo: source.effectiveTo },
    resourceWhitelist: toStrictAllowlist(allowlist),
    outputContract: source.outputContract || source.outputContractRef || null,
    permissions: source.permissions,
    metadata: source.metadata
  };
}

function fromStrictRef(value) {
  if (!value) return null;
  return { refType: value.type, refId: value.id, refVersion: value.version, ...(value.status === undefined ? {} : { status: value.status }), ...(value.owner === undefined ? {} : { owner: value.owner }) };
}

function fromStrictRelease(value) {
  const source = value;
  return {
    schemaVersion: 'ofw.m05.agent-release.draft.v1',
    releaseId: source.releaseId,
    releaseVersion: source.releaseVersion,
    state: source.status === 'active' ? 'enabled' : source.status,
    agent: fromStrictRef(source.agent),
    prompt: fromStrictRef(source.prompt),
    skills: (source.skills || []).map(fromStrictRef),
    model: fromStrictRef(source.model),
    publishedOntology: fromStrictRef(source.publishedOntologies?.[0]),
    scenario: fromStrictRef(source.scenario),
    validity: source.validity,
    resourceAllowlist: {
      tools: (source.tools || []).map(fromStrictRef),
      resources: (source.resourceWhitelist || []).map((entry) => ({ id: entry.resourceId, version: entry.resourceVersion, scope: entry.scope, actions: entry.operations })),
      capabilities: []
    },
    permissions: source.permissions,
    fingerprint: source.digest || strict.digestRelease(source)
  };
}

function validateAgentRelease(value, options) {
  return strict.validateAgentRelease(toStrictRelease(value), options);
}

function assertAgentRelease(value, options) {
  return fromStrictRelease(strict.assertAgentRelease(toStrictRelease(value), options));
}

function createAgentRelease(value, options) {
  return fromStrictRelease(strict.createAgentRelease(toStrictRelease(value), options));
}

function publishAgentRelease(value, options = {}) {
  return fromStrictRelease(strict.publishAgentRelease(toStrictRelease(value), options));
}

module.exports = Object.freeze({
  ...strict,
  toStrictRef,
  toStrictRelease,
  fromStrictRelease,
  validateAgentRelease,
  assertAgentRelease,
  createAgentRelease,
  publishAgentRelease
});
