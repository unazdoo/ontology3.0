import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const base = new URL('../composite/', import.meta.url);
const global = {}; global.window = global;
for (const file of ['shared/ontology-consumption.js','shared/business-catalog.js','modules/m07/business.js','resources/business-release.js']) vm.runInNewContext(readFileSync(new URL(file, base), 'utf8'), global);
const raw = JSON.parse(readFileSync(new URL('modules/m07/resources/portfolio.json', base)));
const sourceText = readFileSync(new URL('resources/business-source.json', base), 'utf8');
const source = JSON.parse(sourceText), release = global.OFW_M01_BUSINESS_RELEASE;
const catalog = () => global.OFW_BUSINESS_CATALOG.create(raw, source, release);

test('business directory consumes the exact M01-published snapshot and its verified data file', () => {
  assert.equal(release.version.validationSnapshot.status, 'passed');
  assert.equal(release.receipt.status, 'accepted');
  assert.equal(createHash('sha256').update(sourceText).digest('hex'), release.sourceContract.sourceFingerprint.value);
  assert.equal(release.version.dataContract.assetVersion, release.sourceContract.assetVersion);
  const c = catalog();
  assert.equal(c.validation.valid, true);
  assert.equal(c.objects.find(o => o.id === 'PRD-223C00000000A5FB').quality, 'warning');
  assert.equal(c.objects.find(o => o.id === 'DEMO-DEBT-004827').quality, undefined);
  assert.ok(c.objects.find(o => o.id === 's001.owner.001').aliases.includes('financing::s001.owner.001'));
  assert.ok(c.objects.find(o => o.id === 'INST-8C7053E111F5').aliases.includes('financing::s001.institution.553.01'));
  assert.equal(c.objects.length, 665);
  for (const o of c.objects) {
    assert.ok(release.version.objects.some(t => t.id === o.canonicalObjectRef.objectTypeRef));
    assert.equal(o.canonicalObjectRef.ontologyVersionId, release.version.id);
    const type = release.version.objects.find(t => t.id === o.objectTypeId);
    assert.ok(Object.values(o.properties).every(p => type.properties.some(def => def.id === p.propertyId)));
  }
  const directory = global.OFW_M07_BUSINESS.directory(c);
  assert.equal(directory.length, 30);
  assert.equal(directory.filter(o => o.objectTypeId === 'OBJ-ENTERPRISE').length, 23);
  assert.equal(directory.filter(o => o.objectTypeId === 'OBJ-INVESTMENT-PRODUCT').length, 4);
  assert.equal(directory.filter(o => o.objectTypeId === 'OBJ-INVESTMENT-HOLDING').length, 3);
  assert.ok(!c.objects.some(o => /s001\.group|s001\.loanbook|portfolio-01|BudgetUnit-/.test(o.id)));
});
test('all department budgets belong to one explicitly assigned demonstration enterprise', () => {
  const c = catalog();
  assert.equal(c.budgetOwnership.enterpriseId, 'ENT-020');
  assert.equal(c.budgetOwnership.classification, 'USER_AUTHORIZED_DEMO_ASSIGNMENT');
  assert.equal(c.objects.filter(o => o.budgetOwnership).length, 1);
  const departments = c.objects.filter(o => o.objectTypeId === 'OBJ-ENTERPRISE-DEPARTMENT');
  assert.equal(departments.length, 3);
  for (const [id, target] of [['dept-equipment','ENT-020-DEPT-SB'],['dept-technology','ENT-020-DEPT-JS'],['dept-safety','ENT-020-DEPT-AQ']]) assert.equal(departments.find(d => d.aliases.includes(id))?.id, target);
  assert.ok(departments.every(o => o.parentEnterpriseId === 'ENT-020' && !o.enterpriseId));
  const annual = source.records['V14-BUDGET-ANNUAL'].filter(row => row.year === 2025);
  assert.ok(Math.abs(annual.reduce((sum, r) => sum + r.budgetAmount, 0) - 1097.7) < 1e-8);
  assert.ok(Math.abs(annual.reduce((sum, r) => sum + r.actualAmount, 0) - 861.7265) < 1e-8);
  for (const row of source.records['V14-BUDGET-ANNUAL']) {
    const details = source.records['V14-BUDGET-DETAIL'].filter(d => d.annualId === row.annualId);
    assert.equal(details.length, 16);
    assert.ok(Math.abs(details.reduce((sum, r) => sum + r.actualAmount, 0) - row.actualAmount) < 0.001);
  }
});
test('financing collections contain individual source-note identities and reconcile to enterprise balances', () => {
  const c = catalog();
  for (const [id, count, balance] of [['ENT-020',75,393.134],['ENT-007',176,770],['ENT-017',50,20.016]]) {
    const collection = c.collections.find(collection => collection.id === `financing:${id}`);
    const loans = collection.memberIds.map(id => c.objects.find(o => o.id === id));
    assert.equal(collection.kind, 'object-set');
    assert.equal(loans.length, count);
    assert.ok(loans.every(o => o.objectTypeId === 'OBJ-FINANCING-DETAIL' && o.sourceIdentity.loanId === o.id));
    assert.ok(Math.abs(loans.reduce((sum, o) => sum + o.properties.balanceYuan.value / 1e8, 0) - balance) < 1e-6);
  }
  assert.equal(c.collections.find(c => c.id === 'group-finance').summary.loanCount, 5218);
});
test('holdings retain product-plus-ledger identity and distinct observed dates', () => {
  const c = catalog(), holdings = c.objects.filter(o => o.objectTypeId === 'OBJ-INVESTMENT-HOLDING');
  assert.equal(holdings.length, 3);
  assert.equal(new Set(holdings.map(o => `${o.ledgerId}:${o.productId}`)).size, 3);
  assert.equal(c.objects.filter(o => o.objectTypeId === 'OBJ-HOLDING-OBSERVATION').length, 208);
  const holdingB = holdings.find(o => o.aliases.includes('investment::holding-02'));
  assert.equal(c.series.find(s => s.ownerObjectId === holdingB.id).points.length, 79);
  assert.equal(c.collections.find(c => c.id === 'investment-analysis').kind, 'object-set');
});
test('draft versions and incorrect relationship data fail before directory construction', () => {
  const draft = structuredClone(release); draft.version.publicationState = 'Draft';
  assert.throws(() => global.OFW_BUSINESS_CATALOG.create(raw, source, draft), /published version/);
  const bad = structuredClone(source); bad.records['V14-DEPARTMENT'][0].enterpriseId = 'UNKNOWN';
  assert.throws(() => global.OFW_BUSINESS_CATALOG.create(raw, bad, release), /Unresolved business relationship/);
});
