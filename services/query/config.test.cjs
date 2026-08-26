'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const config = require('./config');

const BASE = {
  agentId: 'AGENT-S001',
  configVersion: 'CFG-S001-v1',
  status: 'enabled',
  promptVersion: 'PROMPT-S001-v1',
  skills: ['skill.scenario-resource-discovery.v1', 'skill.object-resolution.v1', 'skill.controlled-query-planning.v1'],
  toolAllowlist: ['tool.semantic-query.v1', 'tool.evidence-read.v1', 'tool.action-request-submit.v1'],
  platformDeterminismVersion: 'PLATFORM-GATES-v1',
  publishedOntologyVersion: 'PUB-S001-v1',
  resourceWhitelist: [{ id: 'MET-COST', version: 'PUB-S001-v1', kind: 'Metric' }],
  scenarios: [{ scenarioId: 'S001', scenarioVersion: 'S001-v1' }]
};

test('C009 snapshot pins config, Prompt, Skill, Tool, Published and validity window', () => {
  const snapshot = config.createConfigSnapshot({
    ...BASE,
    validFrom: '2026-01-01T00:00:00.000Z',
    validUntil: '2027-01-01T00:00:00.000Z'
  }, { snapshotAt: '2026-08-24T00:00:00.000Z' });
  assert.equal(snapshot.schemaVersion, config.CONFIG_SCHEMA_VERSION);
  assert.equal(snapshot.promptVersion, 'PROMPT-S001-v1');
  assert.equal(snapshot.publishedOntologyVersion, 'PUB-S001-v1');
  assert.equal(snapshot.skillSet.length, 3);
  assert.equal(snapshot.toolAllowlist.length, 3);
  assert.equal(typeof snapshot.fingerprint, 'string');
  assert.equal(Object.isFrozen(snapshot), true);
});

test('C009 actual capability proof is required to pass runtime verification and mismatches fail', () => {
  const snapshot = config.createConfigSnapshot(BASE);
  const actual = {
    skills: snapshot.skills.map((skill) => ({ skillId: skill.skillId, version: skill.version, status: 'loaded' })),
    tools: snapshot.toolWhitelist.map((tool) => ({ toolId: tool.toolId, version: tool.version, status: 'available' })),
    platformDeterminismVersion: 'PLATFORM-GATES-v1'
  };
  assert.equal(config.verifyCapabilityProof(snapshot, actual).valid, true);
  actual.skills[0].version = 'wrong';
  assert.equal(config.verifyCapabilityProof(snapshot, actual).valid, false);
});

test('C009 matching is fail-closed for disabled, ambiguous and unbound configurations', () => {
  const context = { scenarioId: 'S001', scenarioVersion: 'S001-v1', scenarioRunId: 'S001-RUN-CFG', formedAt: '2026-08-24T00:00:00.000Z', status: 'active' };
  const first = { ...BASE, validFrom: '2026-01-01T00:00:00.000Z', validUntil: '2027-01-01T00:00:00.000Z' };
  const match = config.matchAgentConfigs([first], context, '2026-08-24T00:00:00.000Z');
  assert.equal(match.status, 'unique');
  assert.equal(config.matchAgentConfigs([{ ...first, configVersion: 'CFG-S001-v2' }, first], context, '2026-08-24T00:00:00.000Z').status, 'ambiguous');
  assert.equal(config.matchAgentConfigs([{ ...first, status: 'disabled' }], context, '2026-08-24T00:00:00.000Z').status, 'none');
});
