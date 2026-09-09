import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { query, parseQuestion, metrics, createPlan, defaultParams } from '../src/domain.js';
import { defaultFilters, reportSnapshot, newTask } from '../src/store.js';
const data = JSON.parse(readFileSync(new URL('../public/data/portfolio.json', import.meta.url)));
const context = () => ({ filters: defaultFilters(), horizon: 90 });

test('R14-013 rejects disjunction instead of silently converting the 21-member union into an intersection', () => {
  const rows = metrics(data, data.enterprises.map(entity => entity.id), 90).rows;
  const union = rows.filter(row => row.premium > 0 || row.gap > 0);
  assert.equal(union.length, 21);
  assert.equal(union.find(row => row.id === 'ENT-007').gap, 28105);
  assert.ok(union.some(row => row.id === 'ENT-020'));
  for (const question of [
    '找出高成本或有资金缺口的企业', '找出高成本或者有资金缺口的企业',
    '找出有资金缺口或高成本企业', '找出高成本或有资金缺口且是环保的企业',
    '找出高成本 OR 有资金缺口的企业', '找出高成本||有资金缺口的企业',
    '如果降息12.5bp，找出高成本或有资金缺口的企业',
  ]) {
    for (const current of [context(), { filters: { ...defaultFilters(), objectIds: ['ENT-007', 'ENT-020'] }, horizon: 30,
      plan: createPlan(data, ['ENT-007', 'ENT-020'], { ...defaultParams(), rateBps: -12.5 }, '固定方案', 30) }]) {
      const original = structuredClone(current);
      assert.throws(() => query(data, question, current), /暂不支持.*或/, question);
      assert.deepEqual(current, original);
    }
  }
});

test('R14-013 conjunction, named subjects and supported questions retain correct downstream identities', () => {
  const answer = query(data, '找出高成本且有资金缺口的企业', context());
  assert.equal(answer.result.rows.length, 9);
  assert.ok(answer.result.rows.every(row => row.premium > 0 && row.gap > 0));
  const report = reportSnapshot(answer.result, { evidence: answer.evidence });
  assert.deepEqual(report.evidence.objectIds, answer.evidence.objectIds);
  const task = newTask({ title: '固定范围复核', owner: '财务人员', dueDate: '2099-01-01', objectIds: answer.evidence.objectIds, evidence: answer.evidence });
  assert.deepEqual([...task.objectIds].sort(), [...answer.evidence.objectIds].sort());
  assert.deepEqual(query(data, 'ENT-007与ent-020的融资余额是多少', context()).evidence.objectIds.sort(), ['ENT-007', 'ENT-020']);
  assert.ok(query(data, '找出高成本企业', context()).result.rows.every(row => row.premium > 0));
  assert.ok(query(data, '找出有资金缺口的企业', context()).result.rows.every(row => row.gap > 0));
  assert.throws(() => parseQuestion('腾讯的融资余额是多少', data));
  assert.deepEqual(parseQuestion('未来90天如果降息12.5bp，授信收缩12.5%，展期30天', data).parameters, { rateBps: -12.5, creditHaircut: 12.5, extensionDays: 30, bankId: null });
});

function editor() {
  const global = { Intl, OFW_WORKFLOW: {} }; global.window = global;
  vm.runInNewContext(readFileSync(new URL('../composite/shared/report-editor.js', import.meta.url), 'utf8'), global);
  return global.OFW_REPORT_EDITOR;
}

test('R14-014 report renderer formats currency and rate precision without altering numeric source data', () => {
  const render = editor().blockBody;
  const block = { rows: [
    { name: '本金', value: 7.1610000000000005, unit: '亿元' },
    { name: '缺口1', value: 1.4080000000000001, unit: '亿元' },
    { name: '缺口2', value: 5.837999999999999, unit: '亿元' },
    { name: '利率', value: 2.4566589722, unit: '%' },
    { name: '本金元', value: 716100000.0000001, unit: '元' },
    { name: '零余额', value: 0, unit: '亿元' },
    { name: '负值', value: -1.4080000000000001, unit: '亿元' },
    { name: '缺失', value: null, unit: '%' },
  ] };
  const original = structuredClone(block), html = render(block);
  for (const expected of ['7.161 亿元', '1.408 亿元', '5.838 亿元', '2.4567 %', '716,100,000.00 元', '0.000 亿元', '-1.408 亿元', '暂无数据']) assert.ok(html.includes(expected), expected);
  assert.doesNotMatch(html, /0000000005|0000000001|999999999|暂无数据 %/);
  assert.deepEqual(block, original);
  assert.equal(render(block), html);
});

test('R14-014 zero, missing, textual values and series use the same safe rendering boundary', () => {
  const render = editor().blockBody;
  const html = render({ rows: [
    { name: '零利率', value: 0, unit: '%' }, { name: 'NaN', value: NaN, unit: '%' },
    { name: 'Infinity', value: Infinity, unit: '亿元' }, { name: '空字符串', value: '', unit: '%' },
    { name: '未评价', primary: '证据不足' }, { name: '转义', value: '<b>文本</b>' },
  ], series: [{ label: '历史金额', unit: '亿元', points: [{ date: '2025-12-31', value: 7.1610000000000005 }] }] });
  assert.match(html, /0\.0000 %/);
  assert.equal((html.match(/暂无数据/g) || []).length, 3);
  assert.match(html, /7\.161 亿元/);
  assert.match(html, /证据不足/);
  assert.match(html, /&lt;b&gt;文本&lt;\/b&gt;/);
});
