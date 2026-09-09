import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseQuestion,query,percent,metrics,createPlan} from '../src/domain.js';
import {defaultFilters} from '../src/store.js';
import {createV14ModelServer} from '../runtime/model-runtime.mjs';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url)));
test('R14-002 rejects every unknown subject without expanding or partially matching the set',()=>{
  for(const question of ['不存在的Review企业融资余额多少','华南环保集团融资余额多少','ENT-020与华南环保集团融资余额多少','ENT-020和ENT-999融资余额多少','环保测试公司10融资余额多少']) assert.throws(()=>query(data,question,{filters:defaultFilters(),horizon:90}),undefined,question);
  for(const e of data.enterprises) for(const name of [e.name,e.id,...e.aliasNames]) assert.deepEqual(parseQuestion(`${name}融资余额多少`,data).objectIds,[e.id]);
});
test('R14-006 decimal parameters affect independent loan and facility calculations; malformed values fail',()=>{
  const q=parseQuestion('未来90天如果降息12.5bp，授信收缩12.5%，展期30天',data);
  assert.deepEqual(q.parameters,{rateBps:-12.5,creditHaircut:12.5,extensionDays:30,bankId:null});
  const p=createPlan(data,data.enterprises.map(e=>e.id),q.parameters,'小数回归方案',90);
  const before=metrics(data,data.enterprises.map(e=>e.id),90),after=metrics(data,p.objectIds,90,p);
  assert.ok(after.totals.cost < before.totals.cost);
  for(const question of ['如果降息-12.5bp','如果降息12.55bp','如果授信收缩-2%','如果授信收缩101%','如果降息201bp','如果展期-30天','如果展期3.5天','如果降息很多bp'])assert.throws(()=>parseQuestion(question,data),undefined,question);
  assert.equal(parseQuestion('如果降息50bp，授信收缩30%',data).parameters.rateBps,-50);
});
test('R14-001 generic demonstration baselines have no FACT scores and retain explicit provenance',async()=>{
  const server=createV14ModelServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{for(const id of ['S001','S002','S004','S005']){
    const body=await (await fetch(`http://127.0.0.1:${server.address().port}/v1/model-management/context?scenarioId=${id}`)).json();
    const envelope=body.state.results.formalEnvelope;
    assert.equal(envelope.resultKind,'DEMO_BASELINE');assert.ok(envelope.subjects.every(r=>r.score===null&&r.confidence===null&&r.resultStatus==='NOT_EVALUATED'));
    assert.equal(envelope.provenance.actualCalculation,false);
  }}finally{await new Promise(r=>server.close(r));}
});
test('R14-005 incompatible domains, unknown IDs, time and versions remain explicit errors',()=>{
  const global={};global.window=global;
  vm.runInNewContext(readFileSync(new URL('../composite/shared/workflow.js',import.meta.url),'utf8'),global);
  const envelope={subjects:[{subjectId:'ENT-020'}],dataVersionId:'V1',asOf:'2025-12-31'};
  const state={scenario:{scenarioId:'S003'},results:{formalEnvelope:envelope}};
  const W=global.OFW_WORKFLOW;
  for(const context of [{scenarioId:'S005'},{objectSetRef:{objectIds:['dept-equipment']}},{dataVersionRef:{id:'V2'}},{timeRange:{end:'2026-01-01'}}]){
    assert.ok(W.contextIssue(state,context));assert.equal(W.resultSnapshot(state,context).rows.length,0);
  }
  assert.equal(W.contextIssue(state,{scenarioId:'S003',objectSetRef:{objectIds:['ENT-020']},dataVersionRef:{id:'V1'},timeRange:{end:'2025-12-31'}}),'');
});
test('R14-010 missing and zero-balance costs never concatenate a unit',()=>{
  assert.equal(percent(null),'暂无数据');assert.equal(percent(NaN),'暂无数据');assert.equal(percent(0),'0.00%');
  assert.equal(percent(metrics(data,[],90).totals.cost),'暂无数据');
  const zero=structuredClone(data);zero.loans.forEach(row=>row.principal=0);
  assert.equal(percent(metrics(zero,zero.enterprises.map(e=>e.id),90).totals.cost),'暂无数据');
});
