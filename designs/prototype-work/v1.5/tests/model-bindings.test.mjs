import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createModelStudio,defaultParameters,studioSignals} from '../composite/shared/model-studio.js';
import {defaultIOBindings,validateIOBindings,bindModelInput,consumerOutputRows} from '../composite/shared/model-contracts.js';
import {mapContext} from '../src/map-context.js';import {metrics} from '../src/domain.js';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url))),history=JSON.parse(readFileSync(new URL('../public/data/finance-history-demo.json',import.meta.url)));
async function setup(){const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)},studio=createModelStudio({storage,executor:async(code,input,p)=>new Function('input','parameters',code)(input,p)});const key=await studio.initialize(data);await studio.registerBindingAsset(history);return{studio,key,storage};}
test('simulated history is continuous, varied, explicitly fictional, and anchored to unchanged snapshot',()=>{
  assert.equal(history.rows.length,504);assert.equal(history.sourceDigest,data.digest);
  for(const company of data.enterprises){const rows=history.rows.filter(r=>r.enterpriseId===company.id);assert.equal(rows.length,24);assert.equal(new Set(rows.map(r=>r.asOf)).size,24);assert.ok(new Set(rows.map(r=>r.rate)).size>15);assert.ok(rows.slice(0,-1).every(r=>r.identity==='SIMULATED_HISTORY'));const last=rows.at(-1),base=metrics(data,[company.id],90).rows[0];assert.equal(last.identity,'SNAPSHOT');assert.equal(last.asOf,data.asOf);assert.ok(Math.abs(last.rate-base.cost)<1e-8);assert.ok(Math.abs(last.balanceYuan-base.balance*1e6)<.01);}
});
test('bindings control the runtime input and reject unit and foreign-key mismatches',async()=>{
  const {studio,key}=await setup(),state=studio.read(),goal=state.goals.find(g=>g.id==='builtin-cost'),config={...goal.draft,methodId:'damped'},io=defaultIOBindings(state,goal,config);
  const bound=bindModelInput(state,goal,config,['ENT-020'],io);assert.equal(bound.input.costHistory.length,24);assert.equal(bound.lineage.inputs.length,3);
  const bad=structuredClone(io);bad.inputs.loans.fields.rate='principal';assert.throws(()=>validateIOBindings(state,goal,config,bad),/单位/);
  const keyMismatch=structuredClone(io);keyMismatch.inputs.loans.fields.enterpriseId='id';assert.throws(()=>bindModelInput(state,goal,config,['ENT-020'],keyMismatch),/关联/);
  const stale=structuredClone(io);stale.inputs.history.assetDigest='wrong';assert.throws(()=>validateIOBindings(state,goal,config,stale),/指纹/);
});
test('simulation does not mark the draft validated or create business output datasets and alerts',async()=>{
  const {studio,key}=await setup();let goal=await studio.createGoal({name:'模拟测试目标',type:'risk',question:'test',owner:'owner'},key);goal=await studio.saveDraft(goal.id,{objectIds:['ENT-017','ENT-020']},goal.draft.revision);
  const run=await studio.run(goal.id,{purpose:'SIMULATION',objectIds:['ENT-020']});assert.equal(run.resultIdentity,'DEVELOPMENT_SIMULATION');assert.equal(studio.read().goals.find(g=>g.id===goal.id).draft.validationRunId,null);assert.equal(Object.keys(studio.read().outputDatasets).length,0);assert.equal(studioSignals(studio.read()).length,0);
  await assert.rejects(studio.publish(goal.id,{name:'1.0.0',note:'x',publisher:'p'}),/核验/);await assert.rejects(studio.run(goal.id,{objectIds:['ENT-020']}),/全部输入范围/);
});
test('output field aliases are emitted, frozen in releases, and consumed by time-series rendering',async()=>{
  const {studio,key}=await setup();await studio.initializeForecastMethods(key);let goal=studio.read().goals.find(g=>g.id==='builtin-cost');goal=await studio.selectMethod(goal.id,'damped',goal.draft.revision);const io=structuredClone(goal.draft.ioBindings);io.output.name='预测结果资产';io.output.fields.find(f=>f.source==='forecast.v').name='projected_cost_pct';goal=await studio.saveDraft(goal.id,{objectIds:['ENT-020'],ioBindings:io},goal.draft.revision);await studio.run(goal.id);const version=await studio.publish(goal.id,{name:'4.0.0',note:'with output contract',publisher:'owner'});const run=await studio.run(goal.id,{purpose:'USE',versionId:version.id,objectIds:['ENT-020']});
  assert.equal(run.output.rows[0].history.length,24);assert.equal(run.emittedOutput.rowCount,12);assert.ok('projected_cost_pct' in run.emittedOutput.rows[0]);assert.equal(run.emittedOutput.rows[0].projected_cost_pct,run.output.rows[0].forecast[0].v);assert.deepEqual(consumerOutputRows(run)[0].forecast,run.output.rows[0].forecast);assert.equal(studio.read().outputDatasets[run.id].datasetId,io.output.datasetId);
  const frozen=JSON.stringify(version);const newer=structuredClone(io);newer.output.name='changed';await studio.saveDraft(goal.id,{ioBindings:newer},studio.read().goals.find(g=>g.id===goal.id).draft.revision);assert.equal(studio.read().goals.find(g=>g.id===goal.id).draft.validatedSignature,null);assert.equal(JSON.stringify(studio.read().versions.find(v=>v.id===version.id)),frozen);
});
test('duplicate output names cannot be published as a valid contract',async()=>{
  const {studio}=await setup(),state=studio.read(),goal=state.goals[0],io=defaultIOBindings(state,goal);io.output.fields[1].name=io.output.fields[0].name;assert.throws(()=>validateIOBindings(state,goal,goal.draft,io),/同名/);
});
test('relation filters are exclusive when requested and no focus means no relation lines',()=>{
  const rows=metrics(data,['ENT-017'],90).rows;const finance=mapContext(data,rows,{selectedId:'ENT-017',relationTypes:['financing']});assert.ok(finance.edges.length);assert.ok(finance.edges.every(e=>e.kind==='借款'));assert.equal(finance.enterprises.length,1);
  const guarantee=mapContext(data,rows,{selectedId:'ENT-017',relationTypes:['guarantee']});assert.equal(guarantee.banks.length,0);assert.ok(guarantee.edges.every(e=>e.kind==='担保'));assert.ok(guarantee.enterprises.some(e=>e.contextOnly));
  const cleared=mapContext(data,rows,{relationTypes:['financing','guarantee']});assert.equal(cleared.edges.length,0);assert.equal(cleared.focused,false);
});
