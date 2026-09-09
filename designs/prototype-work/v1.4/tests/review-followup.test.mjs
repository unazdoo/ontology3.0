import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseQuestion, query, createPlan, comparePlan } from '../src/domain.js';
import { defaultFilters } from '../src/store.js';

const data = JSON.parse(readFileSync(new URL('../public/data/portfolio.json', import.meta.url)));
const context = () => ({ filters: defaultFilters(), horizon: 90 });

test('R14-002 consumes complete questions: unregistered abbreviations and mixed subjects cannot propagate a result', () => {
  const unknowns = ['腾讯', '中国广核', '阿里巴巴', 'ACME', '中广核', '华南环保', '腾讯控股', '腾的讯'];
  for (const name of unknowns) {
    for (const question of [`${name}的融资余额是多少`, `${name}融资余额多少`, `ENT-020与${name}的融资余额是多少`, `${name}和单位553的融资成本多少`, `融资余额多少，主体为${name}`, `请查询“${name}”的融资余额`]) {
      const current = context(), saved = structuredClone(current);
      assert.throws(() => query(data, question, current), /主体未登记|未识别/, question);
      assert.deepEqual(current, saved);
    }
  }
  for (const question of ['ENT-020分公司融资余额多少', '不存在的Review企业融资余额多少', '环保测试公司10融资余额多少', '排除ENT-020后融资余额多少', 'ENT-020的利润多少', 'ENT-020融资余额多少并发送邮件']) assert.throws(() => query(data, question, context()), undefined, question);
});

test('R14-002 preserves all registered names, aliases, ID case and generic portfolio questions', () => {
  for (const entity of data.enterprises) {
    for (const name of [entity.name, entity.id, entity.id.toLowerCase(), ...entity.aliasNames]) assert.deepEqual(parseQuestion(`${name}的融资余额是多少`, data).objectIds, [entity.id]);
  }
  for (const question of ['集团的融资余额是多少', '请问集团当前融资余额和平均融资成本分别是多少', '全部企业融资余额多少', '所有企业的融资余额是多少', '未来90天到期多少？', '这些企业主要依赖哪些银行？', '有哪些担保关系？']) assert.equal(query(data, question, context()).result.rows.length, 21, question);
  assert.equal(query(data, '环保企业融资余额多少', context()).result.rows.length, 4);
  assert.equal(query(data, '找出高成本且有资金缺口的企业', context()).result.rows.length, 9);
  assert.deepEqual(parseQuestion('ENT-020与ent-019的融资余额是多少', data).objectIds.sort(), ['ENT-019', 'ENT-020']);
});

test('R14-012 repeated, conflicting, incomplete and staged parameters reject consistently', () => {
  for (const question of [
    '如果先降息12.5bp再加息25bp，未来90天到期多少？',
    '如果授信收缩12.5%后再收缩20%，未来90天资金缺口多少？',
    '如果展期30天再展期60天，未来90天到期多少？',
    '降息12.5bp和降息12.5bp', '降息12.5bp、加息', '收缩12.5%再收缩', '展期30天和展期30天',
    '先降息12.5bp再收缩20%', '降息12.5bp再25bp', '收缩12.5%后20%', '展期30天后60天',
    '降息12.5bp/25bp', '收缩12.5%/-20%', '展期30天，追加10天',
  ]) assert.throws(() => parseQuestion(question, data), /暂不支持|未识别|窗口/, question);
  for (const [rate, credit] of [[12.5, 12.5], [50, 30]]) {
    const parsed = parseQuestion(`未来90天如果降息${rate}bp，授信收缩${credit}%，展期30天`, data);
    assert.deepEqual(parsed.parameters, { rateBps: -rate, creditHaircut: credit, extensionDays: 30, bankId: null });
    const plan = createPlan(data, data.enterprises.map(entity => entity.id), parsed.parameters, '单阶段假设', 90);
    const result = comparePlan(data, plan);
    assert.ok(result.after.totals.cost < result.before.totals.cost);
  }
});

function reports() {
  const memory = new Map();
  const global = { crypto: globalThis.crypto, console, URL, URLSearchParams, location: { origin: 'http://localhost' },
    localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
    OFW_V131_CATALOG: { resources: [] }, OFW_ENTERPRISE_MASTER: { resolve: id => ({ id, name: '企业' }) } };
  global.window = global;
  const sandbox = vm.createContext(global);
  for (const path of ['shared/workflow.js', 'integrations/joint-workbench.js']) vm.runInContext(readFileSync(new URL('../composite/' + path, import.meta.url), 'utf8'), sandbox);
  return { publish: global.OFW_V14_JOINT.publishReport, read: () => global.OFW_WORKFLOW.readReport('S003'), save: draft => global.OFW_WORKFLOW.saveReport('S003', draft) };
}
const report = () => ({ id: 'source-1', title: '初始名称', notes: '初始结论', status: 'DRAFT', version: 1,
  rows: [{ id: 'ENT-020', name: '企业', loanIds: ['LOAN-1'], balance: 100, cost: 2.8, due: 20, gap: 5 }],
  evidence: { dataDigest: 'digest', dataVersion: 'V1', ontologyVersion: 'O1', asOf: '2025-12-31', objectIds: ['ENT-020'], horizon: 90, resultKind: 'DEMO_BASELINE', planId: null } });

test('R14-011 source changes update untouched fields and snapshots, independent of target edits', () => {
  const r = reports(), source = report();
  r.publish(source);
  let draft = r.read();
  const [title, text, deleted] = draft.contentBlocks;
  title.title = '人工标题';
  text.text = '人工结论';
  draft.contentBlocks = [text, title, draft.contentBlocks[3]];
  r.save(draft);
  source.title = '改名'; source.notes = '新结论';
  r.publish(source);
  draft = r.read();
  assert.deepEqual(Array.from(draft.contentBlocks, block => block.id), [text.id, title.id, draft.contentBlocks[2].id]);
  assert.equal(draft.contentBlocks[0].text, '人工结论'); assert.match(draft.contentBlocks[0].title, /^改名/);
  assert.equal(draft.contentBlocks[1].title, '人工标题'); assert.match(draft.contentBlocks[1].text, /新结论/);
  assert.ok(draft.contentBlocks.every(block => block.jointSnapshot.title === source.title && block.jointSnapshot.notes === source.notes));
  assert.ok(!draft.contentBlocks.some(block => block.id === deleted.id));
  r.publish(source); assert.deepEqual(r.read().contentBlocks, draft.contentBlocks);
  r.save({ ...draft, contentBlocks: [] }); r.publish({ ...source, title: '再次改名' }); assert.equal(r.read().contentBlocks.length, 0);
});

test('R14-011 older blocks migrate field ownership from fingerprints without losing previous manual changes', () => {
  const r = reports(), source = report(); r.publish(source);
  const legacy = r.read();
  for (const block of legacy.contentBlocks) { delete block.jointSourceFields; delete block.jointEditedFields; }
  legacy.contentBlocks[0].text = '旧版目标人工文字';
  const block = legacy.contentBlocks[1];
  block.text = '旧同步后的源结论';
  block.fingerprint = JSON.stringify([block.sourceModuleId, block.title, block.resultId, block.rows, block.text, block.workspaceContext]);
  r.save(legacy);
  source.title = '迁移后标题'; source.notes = '迁移后结论'; r.publish(source);
  const updated = r.read();
  assert.equal(updated.contentBlocks[0].text, '旧版目标人工文字');
  assert.ok(updated.contentBlocks.every(block => block.title.startsWith('迁移后标题')));
  assert.match(updated.contentBlocks[1].text, /迁移后结论/);
  assert.ok(updated.contentBlocks.every(block => block.jointSnapshot.notes === '迁移后结论'));
});

test('R14-011 frozen source remains immutable while a new revision gets its own fields and snapshot', () => {
  const r = reports(), source = { ...report(), status: 'REVIEWED' }; r.publish(source);
  const frozen = r.read().contentBlocks;
  r.publish({ ...source, title: '同ID不应覆盖', notes: '同ID不应覆盖' });
  assert.deepEqual(r.read().contentBlocks, frozen);
  r.publish({ ...source, id: 'source-2', parentId: source.id, status: 'DRAFT', version: 2, title: 'v2', notes: 'v2新结论' });
  const draft = r.read(); assert.equal(draft.contentBlocks.length, 8);
  assert.deepEqual(draft.contentBlocks.slice(0, 4), frozen);
  assert.ok(draft.contentBlocks.slice(4).every(block => block.jointSnapshot.version === 2 && block.title.startsWith('v2')));
});
