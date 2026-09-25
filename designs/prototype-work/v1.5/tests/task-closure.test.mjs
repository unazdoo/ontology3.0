import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createModelStudio,studioSignals} from '../composite/shared/model-studio.js';
import {newTask} from '../composite/shared/task-record.js';
import {advanceCase,caseFlow,taskFromModelRun,caseBasisIssue} from '../composite/shared/task-workflow.js';
import {readWork,saveWorkTask,WORKBENCH_KEY} from '../composite/shared/work-items.js';
import {metrics} from '../src/domain.js';
import {initialState,validateRestoredState} from '../src/store.js';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url)));
const storage=()=>{const map=new Map();return{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)}};
const fixture=async()=>{const store=storage(),studio=createModelStudio({storage:store,executor:async(code,input,p)=>new Function('input','parameters',code)(input,p)});await studio.initialize(data);return{studio,store}};
const evidence={objectIds:['ENT-020'],asOf:data.asOf,horizon:90,dataVersion:data.dataVersion,dataDigest:data.digest,ontologyVersion:data.ontologyVersion,resultKind:'DEMO_BASELINE',planId:null};
const makeTask=()=>newTask({title:'到期事项研判',owner:'研判人',dueDate:'2099-12-31',objectIds:['ENT-020'],evidence,existing:[],plan:null});
test('an imported model window preserves its exact day count in map calculations and restored state',()=>{
  assert.equal(metrics(data,['ENT-020'],31).end,'2026-01-31');
  assert.equal(validateRestoredState({...initialState(),horizon:31},data).horizon,31);
  assert.throws(()=>metrics(data,['ENT-020'],0),/窗口/);
  assert.throws(()=>metrics(data,['ENT-020'],1.5),/窗口/);
});
test('candidate trial, comparison and review preserve current application and frozen references',async()=>{
  const {studio}=await fixture(),goalId='builtin-risk',before=JSON.stringify(studio.read().versions[2]),goal=studio.read().goals.find(g=>g.id===goalId);
  await studio.saveDraft(goalId,{parameters:{...goal.draft.parameters,redScore:30}},goal.draft.revision);
  await assert.rejects(studio.freezeCandidate(goalId,{name:'候选一',note:'阈值调整',owner:'维护人'}),/核验/);
  await studio.run(goalId);const candidate=await studio.freezeCandidate(goalId,{name:'候选一',note:'阈值调整',owner:'维护人'});
  await assert.rejects(studio.run(goalId,{purpose:'TRIAL',versionId:candidate.id}),/启用/);
  await studio.enableTrial(goalId,candidate.id);const run=await studio.run(goalId,{purpose:'TRIAL',versionId:candidate.id,objectIds:['ENT-020']});
  assert.equal(run.resultIdentity,'CANDIDATE_TRIAL');assert.equal(studio.read().bindings[goalId],'reference-risk-1');assert.equal(studioSignals(studio.read()).length,0);
  const comparison=await studio.compareVersions(goalId,{leftId:'reference-risk-1',rightId:candidate.id,objectIds:['ENT-020']});assert.equal(comparison.objectIds.length,1);
  await assert.rejects(studio.promoteCandidate(candidate.id,{name:'1.1.0',note:'发布',publisher:'发布人'}),/审阅/);
  const review=await studio.reviewCandidate(candidate.id,{reviewer:'审阅人',note:'保留进一步复核边界'});const promoted=await studio.promoteCandidate(candidate.id,{name:'1.1.0',note:'发布',publisher:'发布人'});
  assert.equal(promoted.reviewId,review.id);assert.equal(studio.read().bindings[goalId],'reference-risk-1');assert.equal(JSON.stringify(studio.read().versions[2]),before);
  await studio.bind(goalId,promoted.id);await studio.enableTrial(goalId,null);assert.equal(studio.read().bindings[goalId],promoted.id);assert.ok(studio.read().runs.some(r=>r.id===run.id));
});
test('fixed comparison rejects a changed horizon before recording either comparison run',async()=>{
  const {studio}=await fixture(),goal=studio.read().goals.find(g=>g.id==='builtin-risk');await studio.saveDraft(goal.id,{parameters:{...goal.draft.parameters,horizonDays:180}},goal.draft.revision);await studio.run(goal.id);const c=await studio.freezeCandidate(goal.id,{name:'180天',note:'窗口变化',owner:'维护人'});const before=studio.read().runs.length;
  await assert.rejects(studio.compareVersions(goal.id,{leftId:'reference-risk-1',rightId:c.id,objectIds:['ENT-020']}),/窗口不同/);assert.equal(studio.read().runs.length,before);
});
test('a scenario run is not promoted into an ordinary risk event',async()=>{
  const {studio}=await fixture();const result=await studio.run('builtin-risk',{purpose:'USE',versionId:'reference-risk-1',objectIds:['ENT-020'],parameterOverrides:{horizonDays:180}});assert.equal(result.resultIdentity,'SCENARIO_SIMULATION');assert.equal(studioSignals(studio.read()).length,0);
});
test('approval, execution and effect are separate and failed recovery preserves fixed evidence',()=>{
  let task=makeTask();const original=JSON.stringify(task.evidence),at='2099-01-02T10:00:00.000Z';const act=(action,fields={})=>task=advanceCase(task,action,{actor:'办理人',note:'明确处理意见',...fields},at);
  assert.throws(()=>act('complete'),/阶段/);act('submit');assert.equal(caseFlow(task).stage,'APPROVAL');act('return');assert.equal(caseFlow(task).stage,'RETURNED');act('submit');act('approve',{owner:'执行人',dueDate:'2099-02-01'});assert.equal(caseFlow(task).stage,'READY');assert.equal(task.status,'OPEN');act('accept');assert.throws(()=>act('complete'),/凭证/);
  act('progress',{reference:'本地执行材料-1',observedAt:'2099-01-02'});act('complete');assert.equal(caseFlow(task).stage,'EXECUTED');assert.equal(caseFlow(task).effect,null);
  act('review',{reference:'复核材料-1',observedAt:'2099-01-02',outcome:'UNMET'});assert.equal(caseFlow(task).stage,'EXECUTED');act('reopen');assert.equal(caseFlow(task).stage,'REVIEW');assert.equal(caseFlow(task).log.at(-1).priorEffect.outcome,'UNMET');assert.equal(JSON.stringify(task.evidence),original);
});
test('effect requires later dated evidence and cannot be recorded before execution',()=>{
  const task=makeTask();assert.throws(()=>advanceCase(task,'review',{actor:'人',note:'意见',reference:'材料',outcome:'MET',observedAt:'2026-09-11'}),/阶段/);
  const completed={...task,decisionFlow:undefined,updatedAt:'2026-09-10T00:00:00Z',status:'COMPLETED'};assert.throws(()=>advanceCase(completed,'review',{actor:'人',note:'意见',reference:'材料',outcome:'MET',observedAt:data.asOf}),/观察日/);
});
test('model result becomes an unapproved fixed case; stale writes and source changes are rejected',async()=>{
  const {studio,store}=await fixture(),run=await studio.run('builtin-cost',{purpose:'USE',versionId:'reference-cost-1',objectIds:['ENT-020']});
  const task=taskFromModelRun(run,studio.read().datasets[run.dataKey],{title:'预测结果研判',owner:'负责人',dueDate:'2099-12-31'},[]);assert.equal(caseFlow(task).stage,'REVIEW');assert.equal(task.evidence.modelRunId,run.id);saveWorkTask(task,null,store);
  assert.equal(caseBasisIssue(task,data,studio.read()),'');assert.match(caseBasisIssue({...task,evidence:{...task.evidence,dataDigest:'wrong'}},data,studio.read()),/快照/);
  const next=advanceCase(task,'submit',{actor:'人',note:'提交'},'2099-01-02T00:00:00Z');saveWorkTask(next,task.updatedAt,store);assert.throws(()=>saveWorkTask(task,task.updatedAt,store),/其他页面/);assert.equal(readWork(store).tasks.length,1);assert.equal(JSON.parse(store.getItem(WORKBENCH_KEY)).tasks[0].modelRun.signature,run.signature);
});
