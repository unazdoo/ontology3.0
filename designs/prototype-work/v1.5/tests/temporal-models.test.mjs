import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createModelStudio,normalizeModelInput,defaultParameters,validateModelOutput} from '../composite/shared/model-studio.js';
import {FORECAST_METHODS,financingForecast,forecastParameterDefaults,validateForecastOutput,aggregateCostSeries} from '../composite/shared/forecast-methods.js';
import {mapContext} from '../src/map-context.js';
import {metrics} from '../src/domain.js';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url))),input=normalizeModelInput(data,['ENT-007','ENT-020']);
const parameters=method=>({...defaultParameters('cost'),...forecastParameterDefaults(method),months:6});
for(const method of Object.keys(FORECAST_METHODS))test(`${method}: monthly predictions preserve observed facts, loan totals and history identity`,()=>{
  const before=JSON.stringify(input),p=parameters(method),output=financingForecast(input,p,method);validateModelOutput('cost',output,input,p);validateForecastOutput(output,input,p);
  for(const row of output.rows){assert.equal(row.history.length,12);assert.equal(row.history.filter(p=>p.identity==='SNAPSHOT').length,1);assert.equal(row.forecast.length,6);assert.equal(row.forecast.at(-1).t,'2026-06-30');assert.ok(row.history.slice(0,-1).every(p=>p.identity==='CONTRACT_BACKCAST'));assert.ok(row.forecast.every(p=>p.identity==='FORECAST'));}
  assert.equal(JSON.stringify(input),before);
});
test('fixed-rate contracts keep their coupon before maturity while floating loans react to scenarios',()=>{
  const fixed=structuredClone(input);fixed.loans=fixed.loans.map(l=>({...l,rateType:'FIXED',maturityDate:'2030-12-31'}));const p={...parameters('reversion'),rateShockBps:200},r=financingForecast(fixed,p,'reversion');r.rows.forEach(row=>assert.ok(row.forecast.every(pt=>Math.abs(pt.v-row.baselineRate)<1e-9)));
});
test('zero rollover produces gaps after repayment rather than invented zero cost observations',()=>{
  const p={...parameters('cashflow'),months:36,rolloverPct:0},r=financingForecast(input,p,'cashflow');validateModelOutput('cost',r,input,p);validateForecastOutput(r,input,p);assert.ok(r.rows.every(row=>row.forecast.at(-1).v===null&&row.forecast.at(-1).balanceYuan===0));
});
test('sector and group cost is weighted by financing balance at each point',()=>{
  const rows=[{enterpriseId:'a',history:[{t:'2025-12-31',v:2,balanceYuan:100,identity:'SNAPSHOT'}],forecast:[]},{enterpriseId:'b',history:[{t:'2025-12-31',v:8,balanceYuan:300,identity:'SNAPSHOT'}],forecast:[]}];assert.equal(aggregateCostSeries(rows,['a','b']).history[0].v,6.5);assert.equal(aggregateCostSeries(rows,['a']).history[0].v,2);
});
test('forecast timing or relabeling an estimate as an actual observation is rejected',()=>{
  const p=parameters('cashflow'),r=financingForecast(input,p,'cashflow');r.rows[0].history[0].identity='SNAPSHOT';assert.throws(()=>validateForecastOutput(r,input,p),/身份/);const second=financingForecast(input,p,'cashflow');second.rows[0].forecast[0].t='2027-01-01';assert.throws(()=>validateForecastOutput(second,input,p),/月份/);
});
test('maintained forecasting methods are published in the cost goal and keep separate working drafts',async()=>{
  const map=new Map(),studio=createModelStudio({storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},executor:async(code,input,p)=>new Function('input','parameters',code)(input,p)});const key=await studio.initialize(data);await studio.initializeForecastMethods(key);await studio.initializeForecastMethods(key);assert.equal(studio.read().versions.filter(v=>v.methodId).length,3);assert.equal(studio.read().bindings['builtin-cost'],'reference-cost-1');
  let goal=studio.read().goals.find(g=>g.id==='builtin-cost');goal=await studio.selectMethod(goal.id,'cashflow',goal.draft.revision);goal=await studio.saveDraft(goal.id,{parameters:{...goal.draft.parameters,refinanceSpreadBps:33}},goal.draft.revision);goal=await studio.selectMethod(goal.id,'reversion',goal.draft.revision);goal=await studio.selectMethod(goal.id,'cashflow',goal.draft.revision);assert.equal(goal.draft.parameters.refinanceSpreadBps,33);assert.equal(studio.read().bindings[goal.id],'reference-cost-1');await studio.run(goal.id);const published=await studio.publish(goal.id,{name:'2.0.0',publisher:'测试',note:'维护后的现金流模型'});assert.equal(published.methodId,'cashflow');const used=await studio.run(goal.id,{purpose:'USE',versionId:published.id,objectIds:['ENT-020']});assert.equal(used.output.rows[0].forecast.length,12);
});
test('focused map contains loan and facility banks and both guarantee endpoints outside the selected scope',()=>{
  const g=data.guarantees[0],rows=metrics(data,[g.guarantorId],90).rows,ctx=mapContext(data,rows,{selectedId:g.guarantorId,relationTypes:['financing','credit','guarantee']});assert.ok(ctx.focusIds.includes(g.beneficiaryId));assert.ok(ctx.enterprises.find(e=>e.id===g.beneficiaryId).contextOnly);const banks=new Set([...data.loans.filter(l=>l.enterpriseId===g.guarantorId).map(l=>l.bankId),...data.facilities.filter(f=>f.enterpriseId===g.guarantorId&&f.validUntil>=data.asOf).map(f=>f.bankId)]);assert.deepEqual(ctx.banks.map(b=>b.id).sort(),[...banks].sort());assert.ok(ctx.edges.some(e=>e.id===g.id));assert.equal(rows.length,1);
  const global=mapContext(data,rows,{relationships:true,relationTypes:['financing','credit','guarantee']});assert.equal(global.focused,false);assert.equal(global.banks.length,data.banks.length);assert.equal(global.edges.filter(e=>e.kind==='担保').length,data.guarantees.length);
});
