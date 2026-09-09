import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root = new URL('../composite/modules/m07/', import.meta.url);
const data = JSON.parse(readFileSync(new URL('resources/portfolio.json', root), 'utf8'));
const source = readFileSync(new URL('app.js', root), 'utf8');
const byId = id => data.objects.find(item => item.id === id);
const pair = ['ENT-020', 'ENT-017'].map(byId);
const full = { start: '2024-12-31', end: '2026-08-15' }, outside = { start: '2026-01-01', end: '2026-08-15' };
function policy(resource = data) {
  const global = {}; global.window = global;
  vm.runInNewContext(readFileSync(new URL('comparison.js', root), 'utf8'), global);
  return global.OFW_M07_COMPARISON.create({ resources: resource.portfolioResources, seriesFor: item => resource.series.filter(s => s.ownerObjectId === item.id), labelFor: key => key });
}
test('R14-015 generic rule values are not comparable, real financing cost and risk definitions remain comparable', () => {
  const p = policy(), candidates = p.candidates(pair, full);
  assert.ok(!candidates.some(m => m.key === 'ruleMetricValue'));
  const cost = candidates.find(m => m.key === 'averageFinancingCost');
  assert.deepEqual(pair.map(item => p.observation(item, cost, full).value), [2.880984, 2.22838]);
  assert.equal(p.excluded(pair).length, 2);
  assert.ok(p.excluded(pair).some(text => text.includes('短期债务')));
  assert.ok(p.aligned(pair, cost, full));
  assert.ok(candidates.some(m => m.key === 'riskScore'));
  const mutated = structuredClone(pair); mutated[1].properties.averageFinancingCost.ontologyVersionId = 'DIFFERENT';
  assert.ok(!p.candidates(mutated, full).some(m => m.key === 'averageFinancingCost'));
});
test('R14-015 matching labels do not merge unrelated series, and duplicate series do not count twice', () => {
  const changed = structuredClone(data);
  const series = changed.series.find(s => s.ownerObjectId === 'ENT-017' && s.propertyId === 's001.property.averageFinancingCost');
  series.propertyId = 'unrelated-metric';
  assert.ok(!policy(changed).candidates(pair, full).some(m => m.kind === 'series' && m.metricId === 's001.property.averageFinancingCost'));
  const single = changed.objects.filter(o => o.id === 'ENT-020');
  changed.series.push(structuredClone(changed.series.find(s => s.ownerObjectId === 'ENT-020')));
  assert.equal(policy(changed).candidates(single, full).length, 0);
});
test('R14-016 outside window retains explicitly dated static snapshots and returns no series observations', () => {
  const p = policy(), candidates = p.candidates(pair, outside);
  const risk = candidates.find(m => m.kind === 'property' && m.key === 'riskScore');
  assert.deepEqual(pair.map(item => p.observation(item, risk, outside).value), [23.05, 30.52]);
  assert.match(p.timeNote(pair, risk, outside), /2025-12-31.*不受区间筛选影响.*不在所选区间/);
  const observed = candidates.find(m => m.kind === 'series' && m.metricId === 'm01.property.riskScore');
  assert.ok(observed); assert.equal(observed.available, 0);
  assert.equal(p.observation(pair[0], observed, outside).value, null);
  assert.match(p.timeNote(pair, observed, outside), /2026-01-01.*无观测/);
});
test('R14-016 Q1 budget comparison uses 25.3% while static annual 105.4% is dated separately', () => {
  const items = ['budget::BudgetUnit-001', 'budget::BudgetUnit-002'].map(byId), p = policy();
  const range = { start: '2024-12-31', end: '2025-03-31' };
  const candidates = p.candidates(items, range);
  const observed = candidates.find(m => m.kind === 'series' && m.metricId === 'm01.property.budget-execution-rate');
  const annual = candidates.find(m => m.kind === 'property' && m.key === 'executionRate');
  assert.equal(p.observation(items[1], observed, range).value, 25.3);
  assert.equal(p.observation(items[1], observed, range).asOf, '2025-03-31');
  assert.equal(p.observation(items[1], annual, range).value, 105.4);
  assert.match(p.timeNote(items, annual, range), /2025-12-31.*不受区间筛选影响/);
});
function projection(expanded = ['ENT-020']) {
  const global = { state: { graphExpanded: expanded }, activeObject: () => pair[0], resolveObject: byId,
    indexes: { linksByObject: new Map(data.objects.map(item => [item.id, data.links.filter(link => link.from === item.id || link.to === item.id)])) } };
  const start = source.indexOf('  function graphProjection('), rest = source.slice(start + 2), end = rest.slice(1).search(/\n  (?:async )?function /);
  vm.runInNewContext(rest.slice(0, end + 1), global);
  return global.graphProjection();
}
test('R14-017 deterministic layout reserves at least 190 units for labels, circles and handles', () => {
  for (const expanded of [['ENT-020'], ['ENT-020', 'financing::s001.loanbook.553'], ['ENT-020', ...data.objects.map(o => o.id)]]) {
    const graph = projection(expanded), positions = [...graph.positions];
    for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
      assert.ok(Math.hypot(positions[i][1].x - positions[j][1].x, positions[i][1].y - positions[j][1].y) >= 189.99, positions[i][0] + ' / ' + positions[j][0]);
    }
    assert.equal(JSON.stringify([...projection(expanded).positions]), JSON.stringify(positions));
    assert.equal(graph.root.id, 'ENT-020');
  }
});
