import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../composite/modules/m07/', import.meta.url);
const source = JSON.parse(readFileSync(new URL('resources/portfolio.json', root)));
const seed = JSON.parse(readFileSync(new URL('resources/decision-seed.json', root)));
const scope = {};
vm.runInNewContext(readFileSync(new URL('business.js', root), 'utf8'), scope);
const business = scope.OFW_M07_BUSINESS;
test('business projection preserves facts, real business warnings and referential integrity', () => {
  const projected = business.project(source);
  const ids = new Set(projected.objects.map(o => o.id));
  for (const id of ['preloan::LoanApplicant-002', 'preloan::LoanApplicant-004', 'investment::product-03', 'investment::manager-02']) assert.equal(ids.has(id), false);
  assert.ok(projected.links.every(l => ids.has(l.from) && ids.has(l.to)));
  assert.ok(projected.events.every(e => ids.has(e.objectId || e.ownerObjectId)));
  assert.ok(projected.series.every(s => ids.has(s.ownerObjectId)));
  assert.ok(projected.series.every(s => s.propertyId !== 'm01.property.data-completeness'));
  assert.equal(projected.objects.find(o => o.id === 'ENT-020'), source.objects.find(o => o.id === 'ENT-020'));
  assert.equal(business.status(projected.objects.find(o => o.id === 'budget::BudgetUnit-002')), '预算超支');
  assert.equal(business.status(projected.objects.find(o => o.id === 'ENT-020')), '红灯');
  assert.ok(projected.objects.every(o => business.entries(o).every(([key, p]) => p.value != null && !/quality|Completeness|evidenceStatus|sourceCode/.test(key))));
});
test('M07 reads the original decision task and updated result without mutating facts or task state', () => {
  const item = source.objects.find(o => o.id === 'ENT-020');
  const initial = business.records(item, seed, { getItem: () => null });
  assert.equal(initial.length, 2);
  assert.equal(initial[0].task.id, 'TD-6872111633');
  assert.equal(initial[0].stage, '待承接');
  const saved = structuredClone(seed);
  saved.portfolioIntegrationVersion = 'ofw.decision.portfolio.v3';
  saved.tasks[0].status = 'completed';
  saved.tasks[0].result = { summary: '完成复核，后续跟踪成本' };
  const before = JSON.stringify(saved);
  const result = business.records(item, seed, { getItem: () => before });
  assert.equal(result[0].stage, '已完成');
  assert.equal(result[0].task.result.summary, '完成复核，后续跟踪成本');
  assert.equal(item.properties.riskTier.value, '红灯');
  assert.equal(item.properties.averageFinancingCost.value, 2.880984);
  assert.equal(JSON.stringify(saved), before);
  assert.equal(seed.tasks[0].status, 'assigned');
  assert.equal(business.records(source.objects.find(o => o.id === 'ENT-001'), seed, { getItem: () => before }).length, 0);
});
test('initial decision projection uses exact frozen M04 records', () => {
  const baseline = new URL('../../../prototype-releases/v1.1.0/', import.meta.url);
  const integration = readFileSync(new URL('decision-center-prototype/review-v2/shared/portfolio-integration.js', baseline), 'utf8');
  const original = JSON.parse(integration.match(/const S001_SEED = (.*);/)[1]);
  for (const task of original.tasks) assert.deepEqual(seed.tasks.find(t => t.id === task.id), task);
  for (const request of original.requests) assert.deepEqual(seed.requests.find(r => r.id === request.id), request);
});
test('report source restores the exploration URL separately from its single-object report scope', () => {
  const returnUrl = 'http://127.0.0.1:4464/designs/prototype-work/v1.5/composite/modules/m07/index.html?object=ENT-020&set=ENT-017,ENT-020&lens=overview#explore';
  const draft = { contentBlocks: [{ id: 'block', sourceModuleId: 'm07', returnUrl, workspaceContext: { objectSetRef: { objectIds: ['ENT-020'] } } }] };
  let restoredUrl, route, context;
  const global = { URL, location: { href: 'http://127.0.0.1:4464/shell#module/report' },
    history: { state: {}, replaceState: (_state, _title, url) => { restoredUrl = url; } },
    OFW_WORKFLOW: { readReport: () => draft } };
  global.window = global;
  vm.runInNewContext(readFileSync(new URL('../composite/shared/report-editor.js', import.meta.url), 'utf8'), global);
  const editor = global.OFW_REPORT_EDITOR.create({ doc: { querySelector: () => null }, scenarioId: 'S003',
    navigate: value => { route = value; }, updateWorkspaceContext: value => { context = value; } });
  editor.handle({ preventDefault() {}, stopImmediatePropagation() {}, target: { closest: () => ({ dataset: { ofwReportAction: 'source', blockId: 'block' } }) } });
  assert.equal(restoredUrl.searchParams.get('exploration'), returnUrl);
  assert.deepEqual(context.objectSetRef.objectIds, ['ENT-020']);
  assert.equal(route, '#module/m07');
});
