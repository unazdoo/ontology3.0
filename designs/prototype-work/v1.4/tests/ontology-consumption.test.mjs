import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const global = {};
vm.runInNewContext(readFileSync(new URL('../composite/shared/ontology-consumption.js', import.meta.url), 'utf8'), global);
const { validate } = global.OFW_ONTOLOGY_CONSUMPTION;
const seed = { window: {} };
vm.runInNewContext(readFileSync(new URL('../../../prototype-releases/v1.1.0/ontology-management-review/canvas-first/portfolio-s001-seed.js', import.meta.url), 'utf8'), seed);
const version = JSON.parse(JSON.stringify(seed.window.OFW_M01_S001_SEED.publishedVersions[0]));

function input() {
  return {
    publishedVersions: [structuredClone(version)],
    bindings: [
      { id: 'enterprise', semanticVersionId: version.id, objectTypeId: 'OBJ-FINANCING-ENTITY', dataVersionId: 'FIN-ASSET-20251231-v02', identityMap: { 'PROP-FINANCING-ENTITY-UNIT-CODE': 'unitCode' } },
      { id: 'loan', semanticVersionId: version.id, objectTypeId: 'OBJ-FINANCING-DETAIL', dataVersionId: 'FIN-ASSET-20251231-v02', identityMap: { 'PROP-FINANCING-DETAIL-LOAN-ID': 'loanId' } },
    ],
    instances: [
      { id: 'enterprise-1', kind: 'object', bindingId: 'enterprise', sourceIdentity: { unitCode: 'unit-1' } },
      { id: 'loan-1', kind: 'object', bindingId: 'loan', sourceIdentity: { loanId: 'loan-1' } },
    ],
    links: [{ id: 'belongs-to', semanticVersionId: version.id, linkTypeId: 'LINK-ENTITY-FINANCING', sourceId: 'loan-1', targetId: 'enterprise-1' }],
  };
}

test('exact published M01 object identities and relationship endpoints resolve', () => {
  const payload = input(), original = JSON.stringify(payload);
  assert.equal(validate(payload).valid, true);
  assert.equal(JSON.stringify(payload), original);
});
test('M07-style prefixes and rule IDs do not prove Object Type registration', () => {
  for (const objectTypeId of ['m01.object-type.financing-group', 'RULE-HIGH-FINANCING-COST']) {
    const payload = input(); payload.bindings[0].objectTypeId = objectTypeId;
    assert.ok(validate(payload).issues.some(issue => issue.code === 'UNKNOWN_OBJECT_TYPE'));
  }
});
test('candidate or wrong exact semantic versions cannot be consumed as published', () => {
  const draft = input(); draft.publishedVersions[0].publicationState = 'Draft';
  assert.ok(validate(draft).issues.some(issue => issue.code === 'UNPUBLISHED_SEMANTIC_VERSION'));
  const renamed = input(); renamed.bindings[0].semanticVersionId = 'S002-ONTO-v1';
  assert.ok(validate(renamed).issues.some(issue => issue.code === 'UNKNOWN_SEMANTIC_VERSION'));
});
test('75-loan collection cannot masquerade as a single loan object', () => {
  const collection = input(); collection.instances[1] = { id: 'loan-1', kind: 'object-set', bindingId: 'loan', count: 75 };
  assert.ok(validate(collection).issues.some(issue => issue.code === 'COLLECTION_IS_NOT_INSTANCE'));
  const absentKey = input(); absentKey.instances[1].sourceIdentity = { recordCount: 75 };
  assert.ok(validate(absentKey).issues.some(issue => issue.code === 'MISSING_SOURCE_IDENTITY'));
});
test('new display IDs cannot duplicate a source business identity', () => {
  const payload = input(); payload.instances.push({ ...payload.instances[0], id: 'another-display-name' });
  assert.ok(validate(payload).issues.some(issue => issue.code === 'DUPLICATE_BUSINESS_IDENTITY'));
});
test('reversed relationship endpoints violate the published M01 definition', () => {
  const payload = input(); payload.links[0].sourceId = 'enterprise-1'; payload.links[0].targetId = 'loan-1';
  assert.ok(validate(payload).issues.some(issue => issue.code === 'LINK_ENDPOINT_TYPE_MISMATCH'));
});
