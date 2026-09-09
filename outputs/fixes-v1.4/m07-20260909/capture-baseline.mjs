import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const out = new URL('./', import.meta.url), root = new URL('../../../designs/prototype-work/v1.4/', out);
await mkdir(out, { recursive: true });
const app = await readFile(new URL('composite/modules/m07/app.js', root), 'utf8');
const data = JSON.parse(await readFile(new URL('composite/modules/m07/resources/portfolio.json', root), 'utf8'));
const pair = data.objects.filter(item => ['ENT-020', 'ENT-017'].includes(item.id));
const global = { state: { timeRange: { start: '2024-12-31', end: '2026-08-15' }, graphExpanded: ['ENT-020'] }, numeric: v => typeof v === 'number' && Number.isFinite(v),
  propertyEntries: item => Object.entries(item.properties || {}), propertyLabel: key => key,
  objectSeries: item => data.series.filter(s => s.ownerObjectId === item.id), activeObject: () => pair.find(item => item.id === 'ENT-020'),
  resolveObject: id => data.objects.find(item => item.id === id), indexes: { linksByObject: new Map(data.objects.map(item => [item.id, data.links.filter(link => link.from === item.id || link.to === item.id)])) } };
const context = vm.createContext(global);
for (const name of ['hashString', 'metricCandidates', 'valueForMetric', 'graphProjection']) {
  const start = app.indexOf(`  function ${name}(`), rest = app.slice(start + 2), end = rest.slice(1).search(/\n  (?:async )?function /);
  vm.runInContext(end < 0 ? rest : rest.slice(0, end + 1), context);
}
const metrics = global.metricCandidates(pair), rule = metrics.find(m => m.key === 'ruleMetricValue');
global.state.timeRange = { start: '2026-01-01', end: '2026-08-15' };
const graph = global.graphProjection();
const loan = graph.positions.get('financing::s001.loanbook.553'), owner = graph.positions.get('financing::s001.owner.001');
await writeFile(new URL('baseline.json', out), JSON.stringify({ at: new Date().toISOString(), appSha256: createHash('sha256').update(app).digest('hex'),
  dataSha256: createHash('sha256').update(await readFile(new URL('composite/modules/m07/resources/portfolio.json', root))).digest('hex'),
  mixedRule: { definition: rule, values: pair.map(item => ({ id: item.id, label: item.properties.ruleMetricLabel.value, value: global.valueForMetric(item, rule) })) },
  outsideWindowRisk: pair.map(item => ({ id: item.id, value: global.valueForMetric(item, metrics.find(m => m.key === 'riskScore')) })),
  graph: { nodes: graph.nodes.map(n => n.item.id), positions: [...graph.positions], loanOwnerDistance: Math.hypot(loan.x-owner.x, loan.y-owner.y) } }, null, 2));
console.log('Baseline evidence saved');
