import {newTask} from './task-record.js';

export const CASE_STAGES = Object.freeze({REVIEW:'待研判',APPROVAL:'待批准',READY:'待承接',EXECUTING:'执行中',EXECUTED:'效果待复核',CLOSED:'已结项',RETURNED:'退回补充',REJECTED:'已拒绝',CANCELLED:'已取消'});
export function caseFlow(task) {
  if (task.decisionFlow) return structuredClone(task.decisionFlow);
  const stage = {OPEN:'REVIEW',IN_PROGRESS:'EXECUTING',BLOCKED:'RETURNED',COMPLETED:'EXECUTED',CANCELLED:'CANCELLED'}[task.status] || 'REVIEW';
  return {stage, approval:null, execution:[], effect:null, log:[], inherited:true};
}
const required = (value,label) => {if(!String(value||'').trim())throw Error(`请填写${label}`);return String(value).trim();};
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value||'') && Number.isFinite(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
export function advanceCase(task, action, fields={}, at=new Date().toISOString()) {
  const next=structuredClone(task), flow=caseFlow(task), stage=flow.stage;
  const allowed={submit:['REVIEW','RETURNED'],approve:['APPROVAL'],return:['APPROVAL'],reject:['APPROVAL'],accept:['READY'],progress:['EXECUTING'],complete:['EXECUTING'],review:['EXECUTED'],reopen:['CLOSED','EXECUTED','REJECTED','CANCELLED'],cancel:['REVIEW','RETURNED','READY'],assign:['REVIEW','RETURNED','READY','EXECUTING']};
  if(!allowed[action]?.includes(stage))throw Error('事项阶段已变化，请重新读取后操作');
  const note=required(fields.note,'处理意见或原因'),actor=required(fields.actor,'办理人');
  if(action==='submit')flow.stage='APPROVAL';
  if(action==='approve') {
    required(fields.owner,'执行负责人');if(!date(fields.dueDate)||fields.dueDate<at.slice(0,10))throw Error('请填写不早于处理日的执行期限');
    flow.approval={actor,note,at,scope:structuredClone(task.objectIds),evidence:structuredClone(task.evidence)};
    next.owner=fields.owner.trim();next.dueDate=fields.dueDate;flow.stage='READY';
  }
  if(action==='return')flow.stage='RETURNED';
  if(action==='reject')flow.stage='REJECTED';
  if(action==='accept')flow.stage='EXECUTING';
  if(action==='progress') {
    const reference=required(fields.reference,'执行凭证或材料编号');
    if(!date(fields.observedAt)||fields.observedAt>at.slice(0,10)||fields.observedAt<(flow.approval?.at||task.createdAt).slice(0,10))throw Error('执行日期须介于事项批准（或创建）与处理日之间');
    flow.execution.push({at,actor,note,reference,observedAt:fields.observedAt,source:'人工登记的本地办理材料'});
  }
  if(action==='complete') {
    if(!flow.execution.length)throw Error('请先登记执行进展及凭证，再确认执行完成');
    flow.stage='EXECUTED';flow.completedAt=at;flow.effect=null;
  }
  if(action==='review') {
    if(!['MET','UNMET','INSUFFICIENT'].includes(fields.outcome))throw Error('请选择效果复核结论');
    const reference=required(fields.reference,'效果依据或待补资料说明');
    if(!date(fields.observedAt)||fields.observedAt>at.slice(0,10)||fields.observedAt<(flow.completedAt||task.updatedAt).slice(0,10)||fields.observedAt<=(task.evidence.asOf||''))throw Error('复核观察日须晚于原依据日，且介于执行完成与处理日之间');
    flow.effect={at,actor,note,reference,observedAt:fields.observedAt,outcome:fields.outcome,source:'人工复核记录；未自动核实外部材料'};
    flow.stage=fields.outcome==='MET'?'CLOSED':'EXECUTED';
  }
  if(action==='reopen'){flow.stage='REVIEW';flow.effect=null;flow.approval=null;flow.execution=[];delete flow.completedAt;}
  if(action==='cancel')flow.stage='CANCELLED';
  if(action==='assign') {
    next.owner=required(fields.owner,'负责人');if(!date(fields.dueDate)||fields.dueDate<at.slice(0,10))throw Error('请填写不早于处理日的期限');next.dueDate=fields.dueDate;
  }
  flow.log.push({action,from:stage,to:flow.stage,at,actor,note,fields:structuredClone(fields),priorEffect:action==='reopen'?caseFlow(task).effect:null});
  next.decisionFlow=flow;next.status={REVIEW:'OPEN',APPROVAL:'OPEN',READY:'OPEN',EXECUTING:'IN_PROGRESS',EXECUTED:'COMPLETED',CLOSED:'COMPLETED',RETURNED:'OPEN',REJECTED:'CANCELLED',CANCELLED:'CANCELLED'}[flow.stage];next.updatedAt=at;
  next.history.push({from:task.status,to:next.status,kind:'DECISION_FLOW',action,at,note:`${actor} · ${note}`});
  return next;
}
export function taskFromModelRun(run,dataset,fields,existing=[]) {
  if(run?.status!=='SUCCEEDED'||!['USE','TRIAL'].includes(run.purpose))throw Error('请选择已成功使用或试用的固定模型运行');
  if(!dataset||run.output.asOf!==dataset.asOf||!run.objectIds.every(id=>dataset.enterprises.some(c=>c.id===id)))throw Error('模型运行与数据快照不一致');
  const attachedPlan=run.contextRefs?.planSnapshot||null;
  const task=newTask({...fields,existing,type:'模型结果研判',objectIds:run.objectIds,evidence:{asOf:dataset.asOf,horizon:Math.round((Date.parse(run.output.horizonEnd)-Date.parse(dataset.asOf))/86400000),objectIds:[...run.objectIds],dataVersion:dataset.dataVersion,ontologyVersion:dataset.ontologyVersion,dataDigest:dataset.digest,resultKind:run.resultIdentity||'MODEL_ADVISORY',modelRunId:run.id,modelVersionId:run.versionId,modelSignature:run.signature,executionSignature:run.executionSignature,dataKey:run.dataKey,planId:attachedPlan?.id||null},plan:attachedPlan});
  task.modelRun=structuredClone(run);task.decisionFlow={stage:'REVIEW',approval:null,execution:[],effect:null,log:[]};return task;
}
export function taskFromFinancingProposal(run,dataset,proposalId,fields,existing=[]){
  if(run?.methodId!=='refinance-ai'||run.status!=='SUCCEEDED'||!['USE','TRIAL'].includes(run.purpose))throw Error('请选择已成功业务运行的AI置换建议');
  const proposal=run.output.rows.flatMap(r=>r.proposals||[]).find(p=>p.id===proposalId);
  if(!proposal||proposal.status!=='AI_RECOMMENDED_PENDING_REVIEW')throw Error('原置换建议不存在或身份不一致');
  const duplicate=existing.find(t=>t.modelRun?.id===run.id&&t.recommendation?.id===proposalId&&t.actionCode===proposal.action&&!['CLOSED','CANCELLED','REJECTED'].includes(caseFlow(t).stage));
  if(duplicate)throw Error('此建议已形成未结束的行动事项，请继续原事项');
  const full=taskFromModelRun(run,dataset,fields,[]),objectIds=[proposal.enterpriseId];
  const task=newTask({...fields,existing,objectIds,type:'融资置换询价',plan:null,evidence:{...full.evidence,objectIds,planId:null,proposalId,loanId:proposal.loanId,actionCode:proposal.action,inputAssetRefs:run.inputLineage,pricingLevel:proposal.basis.level,pricingSampleSetId:proposal.basis.sampleSetId}});
  task.modelRun=structuredClone(run);task.recommendation=structuredClone(proposal);task.actionCode=proposal.action;return task;
}
export function caseBasisIssue(task,data,modelState) {
  if(!task.evidence?.dataDigest||!task.evidence?.ontologyVersion||!task.objectIds?.length)return '缺少固定对象或依据，请回到来源重新形成事项';
  const source=task.modelRun?modelState?.datasets?.[task.modelRun.dataKey]:data;
  if(!source||source.digest!==task.evidence.dataDigest||source.ontologyVersion!==task.evidence.ontologyVersion||source.asOf!==task.evidence.asOf)return '原快照或口径无法核对，请恢复原依据后再提交或批准';
  if(JSON.stringify([...task.objectIds].sort())!==JSON.stringify([...(task.evidence.objectIds||[])].sort()))return '对象范围与固定依据不一致';
  if(task.modelRun&&(!modelState.runs.some(r=>r.id===task.modelRun.id&&r.executionSignature===task.modelRun.executionSignature&&r.status==='SUCCEEDED')))return '固定模型运行无法核对，请回到模型记录检查';
  if(task.recommendation){const run=modelState.runs.find(r=>r.id===task.modelRun.id),proposal=run.output.rows.flatMap(r=>r.proposals||[]).find(p=>p.id===task.recommendation.id);if(!proposal||JSON.stringify(proposal)!==JSON.stringify(task.recommendation)||task.objectIds.length!==1||task.objectIds[0]!==proposal.enterpriseId)return '置换行动与固定原建议不一致，请恢复原方案';}
  return '';
}
