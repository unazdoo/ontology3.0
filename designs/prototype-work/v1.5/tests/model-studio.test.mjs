import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createModelStudio,MODEL_TEMPLATES,defaultCode,defaultParameters,normalizeModelInput,validateModelOutput,validateParameters,readModelStore,MODEL_STORE_KEY,studioSignals} from '../composite/shared/model-studio.js';
import {metrics} from '../src/domain.js';
import {orderForView,greatCirclePoint,greatCircleGeometry,viewSignal} from '../src/exploration-view.js';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url)));
const execute=async(code,input,p)=>new Function('input','parameters',code)(input,p);
async function fixture(){const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};const studio=createModelStudio({storage,executor:execute});const dataKey=await studio.initialize(data);return {studio,dataKey,storage};}
async function goalFor(type){const setup=await fixture();let goal=await setup.studio.createGoal({type,name:`验收${type}`,question:MODEL_TEMPLATES[type].question,owner:'模型维护组'},setup.dataKey);goal=await setup.studio.saveDraft(goal.id,{objectIds:['ENT-001','ENT-020']},goal.draft.revision);return {...setup,goal};}

test('three reference goals are backed by actual calculations and prepared source data',async()=>{
  const {studio}=await fixture(),state=studio.read();assert.equal(state.goals.length,3);assert.equal(state.versions.length,3);
  assert.ok(state.runs.every(run=>run.status==='SUCCEEDED'&&run.checks.length===3&&run.output.rows.length===21));
  assert.equal(Object.keys(state.datasets).length,1);
});

for(const type of ['cost','structure','risk'])test(`${type}: create, scope, validate, publish, use and reload`,async()=>{
  const {studio,goal,storage}=await goalFor(type);
  await assert.rejects(studio.publish(goal.id,{name:'1.0.0',note:'未核验',publisher:'验收人'}),/核验/);
  const validation=await studio.run(goal.id);assert.equal(validation.objectIds.length,2);
  const version=await studio.publish(goal.id,{name:'1.0.0',note:'核验后的发布',publisher:'验收人'});
  const run=await studio.run(goal.id,{purpose:'USE',versionId:version.id,objectIds:['ENT-020']});assert.equal(run.output.rows.length,1);assert.equal(run.output.rows[0].enterpriseId,'ENT-020');
  assert.equal(studio.read().bindings[goal.id],undefined);await studio.bind(goal.id,version.id);
  const reloaded=createModelStudio({storage,executor:execute});assert.equal(reloaded.read().bindings[goal.id],version.id);assert.equal(reloaded.read().runs.find(r=>r.id===run.id).status,'SUCCEEDED');
  assert.equal(version.validationRunId,validation.id);assert.equal(version.signature,run.signature);assert.ok(run.executionSignature);
});

test('draft edits invalidate release readiness without changing published version or results',async()=>{
  const {studio,goal}=await goalFor('cost');await studio.run(goal.id);const version=await studio.publish(goal.id,{name:'1.0.0',note:'首次发布',publisher:'验收人'});const before=JSON.stringify(version);
  const first=await studio.run(goal.id,{purpose:'USE',versionId:version.id,objectIds:['ENT-020']});
  const current=studio.read().goals.find(g=>g.id===goal.id);await studio.saveDraft(goal.id,{parameters:{...current.draft.parameters,rateShockBps:300}},current.draft.revision);
  await assert.rejects(studio.publish(goal.id,{name:'1.1.0',note:'未重新核验',publisher:'验收人'}),/核验/);
  const second=await studio.run(goal.id,{purpose:'USE',versionId:version.id,objectIds:['ENT-020']});assert.deepEqual(first.output,second.output);assert.equal(JSON.stringify(studio.read().versions.find(v=>v.id===version.id)),before);
});

test('run scenarios are recorded separately; fixed risk policy cannot be overridden at use time',async()=>{
  const {studio}=await fixture();const version=studio.read().bindings['builtin-cost'];const before=JSON.stringify(studio.read().versions.find(v=>v.id===version));
  const normal=await studio.run('builtin-cost',{purpose:'USE',versionId:version,objectIds:['ENT-020']});
  const changed=await studio.run('builtin-cost',{purpose:'USE',versionId:version,objectIds:['ENT-020'],parameterOverrides:{rateShockBps:150}});
  assert.ok(changed.output.rows[0].predictedInterest>normal.output.rows[0].predictedInterest);assert.notEqual(changed.executionSignature,normal.executionSignature);assert.equal(JSON.stringify(studio.read().versions.find(v=>v.id===version)),before);
  await assert.rejects(studio.run('builtin-risk',{purpose:'USE',versionId:studio.read().bindings['builtin-risk'],parameterOverrides:{redScore:90}}),/模型策略/);
});

test('failed code and invalid financial output do not produce releasable drafts',async()=>{
  const {studio,goal}=await goalFor('cost');let current=studio.read().goals.find(g=>g.id===goal.id);
  await studio.saveDraft(goal.id,{code:"throw new Error('算法测试错误');"},current.draft.revision);await assert.rejects(studio.run(goal.id),/算法测试错误/);
  assert.equal(studio.read().runs[0].status,'FAILED');assert.equal(studio.read().goals.find(g=>g.id===goal.id).draft.validatedSignature,null);
  current=studio.read().goals.find(g=>g.id===goal.id);await studio.saveDraft(goal.id,{code:defaultCode('cost')},current.draft.revision);await studio.run(goal.id);
  assert.ok(studio.read().goals.find(g=>g.id===goal.id).draft.validationRunId);
  const input=normalizeModelInput(data,['ENT-020']),p=defaultParameters('cost'),output=MODEL_TEMPLATES.cost.algorithm(input,p);output.rows[0].balanceYuan++;
  assert.throws(()=>validateModelOutput('cost',output,input,p),/基准本金/);
});

test('duplicate releases, foreign scopes and out-of-range parameters are rejected',async()=>{
  const {studio}=await fixture();await assert.rejects(studio.publish('builtin-cost',{name:'1.0.0',note:'覆盖版本',publisher:'验收人'}),/不能覆盖/);
  await assert.rejects(studio.run('builtin-cost',{purpose:'USE',versionId:'reference-cost-1',objectIds:['ENT-APPLICANT-001']}),/适用范围/);
  assert.throws(()=>validateParameters('cost',{...defaultParameters('cost'),months:1.5}),/整数/);
  assert.throws(()=>validateParameters('risk',{...defaultParameters('risk'),redScore:80}),/界限/);
});

test('version switch, disable and goal archive preserve history while blocking new use',async()=>{
  const {studio,goal}=await goalFor('risk');await studio.run(goal.id);const first=await studio.publish(goal.id,{name:'1.0.0',note:'初版',publisher:'验收人'});const second=await studio.publish(goal.id,{name:'1.1.0',note:'同配置复用',publisher:'验收人'});
  await studio.bind(goal.id,first.id);assert.equal(studio.read().bindings[goal.id],first.id);await studio.setAvailability(first.id,false);await assert.rejects(studio.run(goal.id,{purpose:'USE',versionId:first.id}),/启用/);
  await studio.archiveGoal(goal.id,true);await assert.rejects(studio.run(goal.id,{purpose:'USE',versionId:second.id}),/归档/);assert.equal(studio.read().versions.filter(v=>v.goalId===goal.id).length,2);
  await studio.archiveGoal(goal.id,false);const result=await studio.run(goal.id,{purpose:'USE',versionId:second.id,objectIds:['ENT-020']});assert.equal(result.status,'SUCCEEDED');
});

test('goal edits preserve frozen goal definition and stale draft saves cannot overwrite newer work',async()=>{
  const {studio,goal}=await goalFor('cost');await studio.run(goal.id);const version=await studio.publish(goal.id,{name:'1.0.0',note:'初版',publisher:'验收人'});const old=JSON.stringify(version);
  await studio.updateGoal(goal.id,{name:'更新后的预测目标',question:'更新后的业务问题',owner:'新维护组'});assert.equal(JSON.stringify(studio.read().versions.find(v=>v.id===version.id)),old);assert.equal(studio.read().goals.find(g=>g.id===goal.id).draft.validationRunId,null);
  await assert.rejects(studio.saveDraft(goal.id,{note:'旧页面'},goal.draft.revision),/其他页面/);
});

test('risk use produces traceable model signals without changing historical scores',async()=>{
  const {studio}=await fixture();const run=await studio.run('builtin-risk',{purpose:'USE',versionId:'reference-risk-1',objectIds:['ENT-020']});const row=run.output.rows[0];assert.equal(row.historicalScore,23.05);assert.equal(row.historicalTier,'红灯');
  const signal=studioSignals(studio.read()).find(s=>s.objectId==='ENT-020');assert.ok(signal);assert.equal(signal.runId,run.id);assert.equal(signal.source,'model');assert.ok(signal.evidenceRefs.includes(run.id));
  assert.equal(data.enterprises.find(c=>c.id==='ENT-020').riskScore,23.05);
});

test('interrupted runs have a bounded lifetime and do not remain running after reload',()=>{
  const saved={schemaVersion:1,goals:[],versions:[],datasets:{},runs:[{id:'r',status:'RUNNING',expiresAt:Date.now()-1000}],availability:{},bindings:{},audit:[]};
  const restored=readModelStore({getItem:key=>key===MODEL_STORE_KEY?JSON.stringify(saved):null});assert.equal(restored.runs[0].status,'FAILED');assert.match(restored.runs[0].error,/超时/);
});

test('disabling the latest monitor version does not resurrect an older alert',async()=>{
  const {studio,goal}=await goalFor('risk');await studio.run(goal.id);const first=await studio.publish(goal.id,{name:'1.0.0',note:'初版',publisher:'验收人'});await studio.run(goal.id,{purpose:'USE',versionId:first.id,objectIds:['ENT-020']});
  const second=await studio.publish(goal.id,{name:'1.1.0',note:'第二版',publisher:'验收人'});await studio.run(goal.id,{purpose:'USE',versionId:second.id,objectIds:['ENT-020']});
  await studio.setAvailability(second.id,false);assert.equal(studioSignals(studio.read()).filter(signal=>signal.goalId===goal.id).length,0);
  assert.equal(studio.read().runs.filter(run=>run.goalId===goal.id&&run.purpose==='USE').length,2);
});

test('analysis perspectives reorder cards and keep shared map signals distinct from historical risk',()=>{
  const rows=metrics(data,data.enterprises.map(c=>c.id),90).rows,copy=JSON.stringify(rows);const risk=orderForView(rows,'risk',data),cost=orderForView(rows,'cost',data),maturity=orderForView(rows,'maturity',data);
  assert.notDeepEqual(risk.map(r=>r.id),cost.map(r=>r.id));assert.ok(rows.some(row=>viewSignal(row,'risk',data).tone!==viewSignal(row,'cost',data).tone));assert.ok(maturity.every((r,i)=>!i||maturity[i-1].viewSignal.rank>=r.viewSignal.rank));assert.equal(JSON.stringify(rows),copy);
  assert.ok(orderForView(rows,'exposure',data).every(row=>row.viewSignal.tone==='blue'));
});

test('bank links follow great circles, remain finite and split at the date line',()=>{
  const start=[120.2,30.3],end=[-74,40.7],middle=greatCirclePoint(start,end,.5);assert.ok(middle[1]>45);assert.ok(middle.every(Number.isFinite));
  assert.ok(greatCirclePoint(start,end,0).every((n,i)=>Math.abs(n-start[i])<1e-8));assert.ok(greatCirclePoint(start,end,1).every((n,i)=>Math.abs(n-end[i])<1e-8));
  assert.ok(greatCirclePoint([0,0],[180,0],.5).every(Number.isFinite));const geometry=greatCircleGeometry([170,30],[-170,40]);assert.equal(geometry.type,'MultiLineString');assert.ok(geometry.coordinates.every(line=>line.every((p,i)=>!i||Math.abs(p[0]-line[i-1][0])<=180)));
});
