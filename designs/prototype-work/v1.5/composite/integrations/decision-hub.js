import {financingProposalMarkup} from '../shared/financing-proposal-view.js';
import {readWork,saveWorkTask,WORKBENCH_KEY,EFFECT_KEY,resultIdentityLabel} from '../shared/work-items.js';
import {newTask} from '../shared/task-record.js';
import {caseFlow,advanceCase,caseBasisIssue,CASE_STAGES} from '../shared/task-workflow.js';
import {readModelStore} from '../shared/model-studio.js';
import {escapeModelText as esc,modelResultMarkup,modelMoney} from '../shared/model-result-view.js';

const mount=document.createElement('main');mount.id='decision-hub';mount.hidden=true;document.body.append(mount);
const style=document.createElement('link');style.rel='stylesheet';style.href='/designs/prototype-work/v1.5/composite/integrations/decision-hub.css';document.head.append(style);
const nativeRoot=document.getElementById('root');
const back=document.createElement('button');back.className='hub-native-back';back.textContent='← 返回事项工作台';back.hidden=true;back.onclick=()=>go(nativeReturnCase||'');document.body.append(back);
let data=null,error='',formAction=null,sourceFilter='',ownerFilter='',search='',createMode=false,currentRevision=null,nativeReturnCase='',summaryOpen=false;
const stageGroups=[['all','全部事项'],['review','待研判'],['approval','待批准'],['execution','待执行与执行中'],['effect','待复核'],['ended','已结束'],['attention','需补充或恢复']];
const group=stage=>['REVIEW'].includes(stage)?'review':stage==='APPROVAL'?'approval':['READY','EXECUTING'].includes(stage)?'execution':stage==='EXECUTED'?'effect':['CLOSED','CANCELLED','REJECTED'].includes(stage)?'ended':'attention';
const sourceNames={qa:'智能问数',query:'智能问数',report:'报告 / 驾驶舱',agent:'Agent 应用',rule:'规则预警'};
const nextLabels={REVIEW:'研判并提交',APPROVAL:'审阅并决定',READY:'确认承接',EXECUTING:'登记执行进展',EXECUTED:'复核业务效果',CLOSED:'查看结项依据',RETURNED:'补充后重新提交',REJECTED:'查看拒绝原因',CANCELLED:'查看取消记录'};
const actionNames={submit:'提交待批准',approve:'批准并分办',accept:'确认承接',progress:'登记执行凭证',complete:'确认执行完成',review:'保存效果复核',return:'退回补充',reject:'拒绝并记录原因',reopen:'重开事项',cancel:'取消事项',assign:'调整负责人和期限'};
const button=(action,label,attrs='')=>`<button class="hub-button" data-hub-action="${action}" ${attrs}>${label}</button>`;
const badge=(label,tone='')=>`<span class="hub-badge ${tone}">${esc(label)}</span>`;
const today=()=>new Date().toISOString().slice(0,10);
const route=()=>new URLSearchParams(location.hash.split('?')[1]||'');
const send=(type,payload={})=>parent.postMessage({type,...payload},location.origin);
function go(id='',extra={}) {const params=new URLSearchParams();if(id)params.set('case',id);if(route().get('stage'))params.set('stage',route().get('stage'));for(const [key,value] of Object.entries(extra))params.set(key,value);location.hash='workbench'+(params.size?'?'+params:'');formAction=null;error='';render();}
function readNative() {return JSON.parse(localStorage.getItem(window.OFW_DECISION_PORTFOLIO.storageKey)||'null')||{requests:[],tasks:[]};}
function effects() {return JSON.parse(localStorage.getItem(EFFECT_KEY)||'{}');}
function nativeStage(request,task) {
  if(task){if(task.status==='completed')return 'EXECUTED';if(['cancelled','corrected'].includes(task.status))return 'CANCELLED';if(['in_progress','accepted'].includes(task.status))return 'EXECUTING';if(['assigned','pending'].includes(task.status))return 'READY';return 'RETURNED';}
  if(['rejected','withdrawn','replaced'].includes(request.status))return 'REJECTED';
  if(['awaiting','received'].includes(request.status))return 'APPROVAL';
  if(request.status==='confirmed'||request.decision?.type==='confirm')return 'READY';
  return 'RETURNED';
}
function items() {
  const native=readNative(),reviewed=effects(),taskMap=new Map(native.tasks.map(t=>[t.id,t]));
  const originals=native.requests.filter(r=>!r.duplicateOf).map(request=>{
    const task=taskMap.get(request.taskId)||native.tasks.find(t=>t.requestId===request.id),key=`${request.scenarioContext?.scenarioRunId||'portfolio'}:${task?.id||request.id}`,effect=reviewed[key];
    const stage=effect?.outcome==='MET'?'CLOSED':nativeStage(request,task);
    return {id:'native:'+request.id,native:true,request,task,key,effect,stage,title:request.actionType?.name||'待处理事项',subject:request.subjectName||request.subjectId,objectIds:[String(request.subjectId).replace(/^S003-/,'')],owner:task?.owner||request.recipientName||request.owner||'未登记',dueDate:task?.dueDate||'',source:sourceNames[request.sourceType]||request.sourceType||'业务申请',asOf:request.evidence?.cutoff||request.riskEvidence?.assessmentAt||'未登记',reason:request.metric?`${request.metric.name} · ${request.metric.value}`:request.recommendation||'查看原申请依据',createdAt:request.requestTime||request.generatedTime||''};
  });
  const local=readWork().tasks.map(task=>({id:'local:'+task.id,native:false,task,stage:caseFlow(task).stage,title:task.title,subject:task.objectIds.map(id=>data?.enterprises.find(c=>c.id===id)?.name||id).join('、'),objectIds:task.objectIds,owner:task.owner,dueDate:task.dueDate,source:task.recommendation?'AI推荐置换方案':task.modelRun?'模型与算法':task.plan?'对象分析方案':'对象分析 / 人工发起',asOf:task.evidence.asOf||'未登记',reason:task.modelRun?resultIdentityLabel(task.modelRun.resultIdentity):task.plan?'附带固定模拟方案，待业务研判':'按固定对象与依据跟踪处理',createdAt:task.createdAt}));
  return [...local,...originals].sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||b.createdAt.localeCompare(a.createdAt));
}
function render() {
  const path=location.hash.split('?')[0]||'#workbench',show=['#workbench','#overview'].includes(path)&&!route().has('original');
  mount.hidden=!show;nativeRoot.hidden=show;back.hidden=show;document.body.classList.toggle('has-decision-hub',show);
  if(!show)return;
  if(!data){mount.innerHTML='<p class="hub-empty" role="status">正在读取事项与固定分析来源…</p>';return;}
  try {
    const all=items(),selected=all.find(i=>i.id===route().get('case'));
    if(route().has('case')&&!selected){mount.innerHTML=`<h1>事项暂不可用</h1><p role="alert">原事项未读取到，请检查来源或重新读取。</p>${button('reload','重新读取')}${button('back','返回工作台')}`;return;}
    mount.innerHTML=path==='#overview'?overview(all):selected?detail(selected):workbench(all);
    if(createMode)mount.insertAdjacentHTML('beforeend',createForm());
    mount.querySelector('h1')?.setAttribute('tabindex','-1');
  }catch(e){error=e.message;mount.innerHTML=`<h1>事项读取失败</h1><p role="alert">${esc(error)}</p>${button('reload','重新读取')}`;}
}
function workbench(all) {
  const stage=route().get('stage')||'all',filtered=all.filter(i=>(stage==='all'||group(i.stage)===stage)&&(!sourceFilter||i.source===sourceFilter)&&(!ownerFilter||i.owner===ownerFilter)&&(!search||`${i.subject} ${i.title}`.includes(search)));
  return `<header class="hub-header"><div><small>决策中心 · 统一事项入口</small><h1>事项工作台</h1><p>接收业务事项与方案，沿同一事项完成研判、决定、执行与效果复核。</p></div><div class="hub-header-actions">${button('summary','事项摘要')}${button('create','＋ 新建待研判事项','class="primary"')}</div></header><nav class="hub-stages" aria-label="事项阶段">${stageGroups.map(([key,label])=>`<button data-hub-stage="${key}" aria-pressed="${key===stage}">${label}<b>${all.filter(i=>key==='all'||group(i.stage)===key).length}</b></button>`).join('')}</nav><div class="hub-filters"><label>查找事项<input id="hub-search" type="search" placeholder="对象或事项名称" value="${esc(search)}"></label><label>来源<select id="hub-source"><option value="">全部来源</option>${[...new Set(all.map(i=>i.source))].map(v=>`<option ${sourceFilter===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>负责人<select id="hub-owner"><option value="">全部负责人</option>${[...new Set(all.map(i=>i.owner))].map(v=>`<option ${ownerFilter===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>${button('clear','清除筛选')}</div>${summaryOpen?summaryMarkup(filtered):''}<section class="hub-panel"><header><h2>${stageGroups.find(([k])=>k===stage)?.[1]||'全部事项'} · ${filtered.length}</h2><small>有期限的事项优先，按期限由近到远；未登记期限单列在后。</small></header><div class="hub-table-scroll"><table class="hub-case-table"><thead><tr><th>对象 / 事项</th><th>来源与依据日</th><th>当前阶段</th><th>负责人 / 期限</th><th>下一步</th></tr></thead><tbody>${filtered.map(i=>`<tr><td><strong>${esc(i.subject)}</strong><span>${esc(i.title)}</span><small>${esc(i.reason)}</small></td><td>${esc(i.source)}<small>依据日 ${esc(i.asOf)}</small></td><td>${badge(CASE_STAGES[i.stage],i.stage==='EXECUTED'?'amber':'')}${i.dueDate&&i.dueDate<today()&&!['CLOSED','CANCELLED','REJECTED'].includes(i.stage)?badge('超过登记期限','amber'):''}</td><td>${esc(i.owner)}<small>${esc(i.dueDate||'期限未登记')}</small></td><td>${button('open',nextLabels[i.stage],`data-id="${esc(i.id)}"`)}</td></tr>`).join('')||'<tr><td colspan="5">当前筛选没有事项。可清除筛选，或从对象分析、问数、模型及报告形成新事项。</td></tr>'}</tbody></table></div></section><p class="hub-boundary">这里汇集不同来源的本地原型事项。来源事实、规则预警、模型提示与模拟方案保留各自身份；执行记录与业务效果分别核对。</p>`;
}
function overview(all) {
  const active=all.filter(i=>group(i.stage)!=='ended'),overdue=active.filter(i=>i.dueDate&&i.dueDate<today()),sources=[...new Set(all.map(i=>i.source))];
  return `<header class="hub-header"><div><small>决策中心 · 运营总览</small><h1>事项进度与待办分布</h1><p>与事项工作台使用同一批记录，按阶段和来源了解整体进度。</p></div>${button('back','进入事项工作台')}</header><div class="hub-overview-cards">${stageGroups.slice(1).map(([key,label])=>`<button data-hub-stage="${key}"><span>${label}</span><strong>${all.filter(i=>group(i.stage)===key).length}</strong><small>查看对应事项 →</small></button>`).join('')}</div><section class="hub-panel"><h2>期限与恢复</h2><p>尚未结束 ${active.length} 项 · 超过登记期限 ${overdue.length} 项 · 未登记期限 ${active.filter(i=>!i.dueDate).length} 项。</p><p>效果待复核仍属未结束事项。执行完成不会计为业务效果达成。</p></section><section class="hub-panel"><h2>按来源汇总</h2><div class="hub-table-scroll"><table><thead><tr><th>来源</th><th>总数</th><th>待处理与执行</th><th>效果待复核</th><th>已结束</th></tr></thead><tbody>${sources.map(source=>{const rows=all.filter(i=>i.source===source);return `<tr><th>${esc(source)}</th><td>${rows.length}</td><td>${rows.filter(i=>!['ended','effect'].includes(group(i.stage))).length}</td><td>${rows.filter(i=>group(i.stage)==='effect').length}</td><td>${rows.filter(i=>group(i.stage)==='ended').length}</td></tr>`;}).join('')}</tbody></table></div><details><summary>原申请的运营与追溯记录</summary><p>原申请、分办失败恢复和历史记录继续保留。</p>${button('native-overview','查看来源办理记录')}</details></section>`;
}
function summaryMarkup(records) {
  const groups=stageGroups.slice(1).map(([id,label])=>[label,records.filter(r=>group(r.stage)===id).length]);
  return `<section class="hub-panel hub-summary"><header><div><h2>当前范围的事项摘要</h2><p>${records.length} 个事项 · ${groups.filter(([,count])=>count).map(([label,count])=>label+' '+count+' 项').join('，')}。</p></div>${button('summary','收起摘要')}</header><p>根据固定来源、办理状态和原建议组织，摘要不产生新的批准或执行记录。</p><div class="hub-summary-items">${records.map(item=>`<article><header><strong>${esc(item.subject)} · ${esc(item.title)}</strong>${button('open','打开事项',`data-id="${esc(item.id)}"`)}</header><small>${esc(item.source)} · 依据日 ${esc(item.asOf)} · ${esc(CASE_STAGES[item.stage])}</small>${recommendation(item)}</article>`).join('')||'<p>当前筛选没有事项。</p>'}</div></section>`;
}
function detail(item) {
  const task=item.task,flow=item.native?null:caseFlow(task),issue=item.native?'':caseBasisIssue(task,data,readModelStore());
  currentRevision=task?.updatedAt;
  const stage=item.stage;
  return `<header class="hub-header"><div>${button('back','← 返回事项工作台')}<h1>${esc(item.title)}</h1><p>${esc(item.subject)}</p><div class="hub-meta">${badge(CASE_STAGES[stage],stage==='EXECUTED'?'amber':'')}${badge(item.source)}<span>依据日 ${esc(item.asOf)}</span><span>处理日 ${today()}</span></div></div></header><div class="hub-context"><strong>${esc(item.subject)}</strong><span>范围 ${item.objectIds.length} 个对象</span><span>${item.native?'原申请固定来源':resultIdentityLabel(task.evidence.resultKind)}</span>${!item.native?`<span>分析窗口 ${task.evidence.horizon} 天</span>`:''}${item.objectIds.length===1&&/^ENT-/.test(item.objectIds[0])?button('portrait','打开对象画像'):''}</div>${issue?`<p class="hub-error" role="alert">${esc(issue)}。${button('source','回到分析来源')}</p>`:''}<div class="hub-detail-grid"><section class="hub-panel"><h2>形成依据与固定附件</h2>${recommendation(item)}${item.native?nativeBasis(item):localBasis(task)}<details><summary>身份与来源引用</summary><pre>${esc(JSON.stringify(item.native?item.request.evidence:task.evidence,null,2))}</pre><p>事项编号 ${esc(item.native?item.request.id:task.id)}</p></details></section><section class="hub-panel"><h2>当前要处理什么</h2><p>${guidance(stage)}</p>${error?`<p class="hub-error" role="alert">${esc(error)}</p>`:''}${item.native?nativeActions(item):localActions(task,issue)}${formAction?operationForm(formAction,item):''}</section></div>${traceMarkup(item)}${!item.native?historyMarkup(task):`<section class="hub-panel"><h2>执行与效果</h2><p>${stage==='EXECUTED'?'原办理已完成；业务效果尚需独立复核。':'查看原办理流程中的决定、分办及执行记录。'}</p>${item.effect?`<p>复核记录：${esc(item.effect.note)} · ${esc(item.effect.reference)} · ${esc(item.effect.source)}</p>`:''}${button('native','打开原申请与办理记录')}</section>`}`;
}
function guidance(stage) {
  return {REVIEW:'先确认业务问题和固定依据，再提交需要批准的安排。',APPROVAL:'审阅拟采取的措施，决定批准分办、退回补充或拒绝。批准后仍需执行人承接。',READY:'执行人确认承接已批准的安排，随后登记进展和凭证。',EXECUTING:'按批准范围登记实际办理材料。完成执行后，继续核对业务效果。',EXECUTED:'依据后续数据复核业务目标。未达成或依据不足时，保留待复核并补充处理。',CLOSED:'查看执行与效果依据。新情况可另行补充处理或重开，原历史保留。',RETURNED:'依据原处理意见补充材料，保留来源后重新提交。',REJECTED:'本次安排已拒绝，查看原因后可重开研判。',CANCELLED:'本事项已取消；如需继续，记录原因后重开。'}[stage];
}
function recommendation(item) {
  if(item.native){const r=item.request,advice=window.portfolioDecisionGuidance?.(r),risk=window.isS003DecisionRecord?.(r)?window.s003DecisionActionGuidance?.(r):null;return `<section class="hub-recommendation"><header><span>研判参考</span><b>${esc(risk?.title||advice?.direction||'核对来源后决定')}</b></header><p>${esc(risk?.detail||advice?.reason||r.recommendation||'先核对触发条件、证据和适用范围，再明确处置内容。')}</p><small>预期影响：${esc(window.portfolioExpectedImpact?.(r)||'以实际办理反馈和后续效果证据为准。')}</small><p class="hub-recommendation-boundary">建议供人工判断；不代表本事项已经批准。</p></section>`;}
  const task=item.task,run=task.modelRun;let direction='核对业务问题，形成明确处置安排',detail='核对原始材料、适用范围和期限，补全拟采取措施后再提交批准。',facts='';
  if(task.recommendation)return `<section class="hub-recommendation"><b>${esc(task.recommendation.actionLabel)}</b><p>先取得有效报价、额度与费用，核实原借据置换条件；询价办理完成后再独立复核降本效果。</p></section>`;
  if(run?.methodId==='history-continuation')return '<section class="hub-recommendation"><b>历史序列外推参考</b><p>仅观察历史趋势；没有加入利率变动、合同续作或融资规模变化。</p></section>';
  if(run?.type==='cost'){const cost=run.output.rows.reduce((sum,r)=>sum+r.deltaInterest,0);direction=cost>0?'复核预测成本上升与融资安排':'核对成本变化的原因和假设';detail='检查浮息敞口、到期续作报价和资金占用变化，明确可接受的成本上限。利息减少可能来自本金占用下降，不能直接视为利率改善。';facts=`本次窗口预测利息相对基准变化 ${modelMoney(cost)}。`;}
  if(run?.type==='structure'){const unmet=run.output.rows.filter(r=>!r.achieved);direction=unmet.length?'先补充未达到目标的方案约束':'审阅成本与期限的取舍';detail=unmet.length?`${unmet.map(r=>r.name).join('、')}的模拟未达到目标；核对调整额度、成本上限及期限，再决定是否补充方案。`:'模拟达到结构目标，仍需核对融资报价、可获得额度和办理条件。';}
  if(run?.type==='risk'){direction='核实触发依据，确定跟踪或处置范围';detail='分别核对历史风险评分、偿债缺口与成本偏离。监控提示不等于已发生逾期或违约，先补足事实和来源材料。';facts=run.output.rows.map(r=>`${r.name}：${r.reasons.map(x=>x.label+' '+x.value+x.unit).join('；')||'未触发条件'}`).join('。');}
  if(task.plan&&!run){direction='比较方案收益、代价和执行前提';detail='核对利率、展期、授信假设与银行可行性，保留本金、成本和资金覆盖约束；拟定负责人及期限后提交。';facts=`固定方案：浮息变化 ${task.plan.parameters.rateBps}bp，展期 ${task.plan.parameters.extensionDays}天，授信收缩 ${task.plan.parameters.creditHaircut}%。`;}
  return `<section class="hub-recommendation"><header><span>研判参考</span><b>${direction}</b></header>${facts?`<p>${esc(facts)}</p>`:''}<p>${esc(detail)}</p><small>建议根据固定分析结果形成；批准、执行和效果复核仍分别记录。</small></section>`;
}
function traceMarkup(item) {
  const task=item.task,r=item.request;
  const steps=item.native?[
    ['数据与业务口径',r.evidence?.dataVersion||'原申请数据',r.evidence?.cutoff||item.asOf,'native-request'],
    ['规则 / 模型 / 查询结果',r.metric?.name||r.rule?.name||'来源结果',r.metric?.value||r.sourceRef||'查看来源引用','native-request'],
    ['行动申请',r.requester||r.submittedBy||'来源发起人',r.requestTime||r.generatedTime||'未登记时间','native-request'],
    ['收件与决定',r.recipientName||'原收件人',r.decision?.reason||r.recommendation||'待人工决定','native'],
    ['分办与办理',task?.owner||'待分办',task?.result?.summary||task?.instructions||'尚未形成执行反馈','native']
  ]:[
    ['固定数据快照',task.evidence.dataVersion,task.evidence.asOf,'trace-evidence'],
    [task.modelRun?'模型运行':task.plan?'模拟方案':'对象分析',task.modelRun?.goalDefinition?.name||task.plan?.name||item.subject,task.modelRun?.versionName||task.evidence.resultKind,'source'],
    ['形成待处理事项',task.title,task.createdAt,'trace-history'],
    ['研判与决定',caseFlow(task).approval?.actor||task.owner,caseFlow(task).approval?.note||'保留提请内容与每次决定','trace-history'],
    ['执行与效果',CASE_STAGES[caseFlow(task).stage],caseFlow(task).effect?.note||'办理记录与效果证据分别保留','trace-history']
  ];
  const risk=item.native?r.riskEvidence:null;
  return `<section class="hub-panel hub-trace"><header><div><h2>本事项从哪里来</h2><p>从输入证据到办理结果，沿原事项身份回溯。</p></div>${item.native?button('native-trace','打开完整追溯'):button('trace-history','展开全链路记录')}</header><div class="hub-trace-steps">${steps.map(([title,primary,secondary,action],i)=>`<button data-hub-action="${action}"><span>${i+1}</span><div><strong>${esc(title)}</strong><b>${esc(primary)}</b><small>${esc(secondary)}</small></div></button>`).join('')}</div>${risk?`<details class="hub-risk-basis" open><summary>原模型的关键风险依据</summary><div class="hub-risk-metrics"><span>原始评分 <b>${esc(risk.rawScore)}</b></span><span>调节合计 <b>${esc(risk.factorSum)}</b></span><span>最终评分 <b>${esc(risk.finalScore)}</b></span><span>评估日 <b>${esc(risk.assessmentAt)}</b></span></div><ul>${(risk.lowestIndicators||[]).map(x=>`<li>${esc(x.name)} · ${esc(x.score)}分</li>`).join('')}${(risk.factors||[]).filter(x=>x.applicable&&x.coefficient<0).map(x=>`<li>${esc(x.name)} · ${esc(x.tierLabel)} · 调节 ${esc(x.coefficient)}</li>`).join('')}</ul><p>这些值引用原模型评估结果，事项办理不会重新计算或改写评分。</p></details>`:''}</section>`;
}
function nativeBasis(item) {
  const r=item.request;
  return `<p>${esc(item.reason)}</p><p>${esc(r.recommendation||'')}</p><div class="hub-fact-types">${badge(r.riskEvidence?'模型提示':r.rule?'规则预警':'业务申请')}<span>${esc(r.sourceRef||'')}</span></div><p>原数据版本：${esc(r.evidence?.dataVersion||'未登记')}</p><p>原语义版本：${esc(r.evidence?.semanticVersion||'未登记')}</p>${r.riskEvidence?'<p>风险评分与提示不代表已发生违约；办理状态不改写原评分。</p>':''}${button('native','查看原依据并继续办理')}`;
}
function localBasis(task) {
  const parent=task.parentTaskId?`<p>关联原事项：${esc(task.parentTaskId)}</p>${button('open','查看原事项与复核结论',`data-id="local:${esc(task.parentTaskId)}"`)}${task.parentEffect?`<p>上次复核：${esc(task.parentEffect.note)}</p>`:''}`:'';
  if(task.recommendation)return parent+financingProposalMarkup(task.recommendation)+button('source','回到原曲线与置换建议');
  if(task.modelRun)return parent+modelResultMarkup(task.modelRun,{compact:true})+button('source','查看模型运行与参数');
  return `<div class="hub-fact-types">${badge(task.plan?'模拟方案':'示例快照事实')}<p>${esc(task.plan?.name||'按已登记对象与观察日形成跟踪事项')}</p></div>${task.plan?`<dl><dt>浮息变化</dt><dd>${task.plan.parameters.rateBps} bp</dd><dt>授信收缩</dt><dd>${task.plan.parameters.creditHaircut}%</dd><dt>借款展期</dt><dd>${task.plan.parameters.extensionDays} 天</dd></dl><p>此处为提交时固定的假设，尚未执行，也不更改原快照。</p>`:''}${task.parentTaskId?`<p>补充事项来源：${esc(task.parentTaskId)}</p>`:''}${button('source','回到来源查看分析')}`;
}
function nativeActions(item) {
  return `<p>继续核对原申请中的证据、收件人和分办条件。</p>${button('native',nextLabels[item.stage])}${item.stage==='EXECUTED'?button('operation','登记效果复核','data-operation="review"'):''}`;
}
function localActions(task,issue) {
  const f=caseFlow(task),primary={REVIEW:'submit',RETURNED:'submit',APPROVAL:'approve',READY:'accept',EXECUTING:'progress',EXECUTED:'review'}[f.stage];
  const proposal=f.log.findLast(e=>e.action==='submit');
  const others={REVIEW:['assign','cancel'],RETURNED:['assign','cancel'],APPROVAL:['return','reject'],READY:['assign','cancel'],EXECUTING:['complete','assign'],EXECUTED:['reopen'],CLOSED:['reopen'],REJECTED:['reopen'],CANCELLED:['reopen']}[f.stage]||[];
  return `${proposal?`<p><b>提请批准内容：</b>${esc(proposal.note)}</p>`:''}${f.approval?`<p>批准记录：${esc(f.approval.actor)} · ${esc(f.approval.note)}</p>`:f.inherited?'<p>沿用已有跟踪记录；未补造历史批准。</p>':''}<p>负责人 ${esc(task.owner)} · 期限 ${esc(task.dueDate)}</p>${f.effect?`<p class="hub-notice">${{MET:'人工复核已达成',UNMET:'复核未达成',INSUFFICIENT:'复核依据不足'}[f.effect.outcome]}：${esc(f.effect.note)}</p>`:''}<div class="hub-action-line">${primary?button('operation',actionNames[primary],`data-operation="${primary}" ${issue&&['submit','approve'].includes(primary)?'disabled':''}`):''}${['EXECUTED','CLOSED'].includes(f.stage)?button('supplement','发起补充事项'):''}</div>${others.length?`<details><summary>其他处理</summary><div class="hub-action-line">${others.map(action=>button('operation',actionNames[action],`data-operation="${action}"`)).join('')}</div></details>`:''}`;
}
function operationForm(action,item) {
  return `<form id="hub-operation-form" data-action="${action}" class="hub-form"><h3>${actionNames[action]}</h3><label>办理人<input name="actor" required placeholder="填写实际办理人"></label>${['approve','assign'].includes(action)?`<label>负责人<input name="owner" required value="${esc(item.owner)}"></label><label>期限<input name="dueDate" type="date" required min="${today()}" value="${item.dueDate>=today()?item.dueDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}"></label>`:''}${['progress','review'].includes(action)?`<label>${action==='review'?'复核观察日':'执行日期'}<input name="observedAt" type="date" max="${today()}" required value="${today()}"></label><label>${action==='review'?'效果依据 / 待补资料':'执行凭证编号'}<input name="reference" required placeholder="可追踪的材料编号或来源说明"></label>`:''}${action==='review'?'<label>复核结论<select name="outcome"><option value="INSUFFICIENT">依据不足，继续待复核</option><option value="UNMET">目标未达成，继续处理</option><option value="MET">依据已核对，目标达成并结项</option></select></label><p>记录人工复核结论及引用；原型不会自动验证外部材料或更新业务事实。</p>':''}<label>${action==='submit'?'拟采取措施 / 提请批准内容':'处理意见 / 原因'}<textarea name="note" required rows="3"></textarea></label><p id="hub-form-error" class="hub-error" role="alert"></p><div class="hub-action-line"><button class="hub-button primary" type="submit">${actionNames[action]}</button>${button('close-form','取消本次操作')}</div></form>`;
}
function historyMarkup(task) {
  const f=caseFlow(task);
  return `<section id="hub-decision-history" class="hub-panel"><h2>办理记录与效果依据</h2>${f.execution.length?`<div class="hub-table-scroll"><table><thead><tr><th>执行日</th><th>办理人</th><th>进展</th><th>凭证</th></tr></thead><tbody>${f.execution.map(e=>`<tr><td>${esc(e.observedAt)}</td><td>${esc(e.actor)}</td><td>${esc(e.note)}</td><td>${esc(e.reference)}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚无新增执行凭证。</p>'}${f.effect?`<p>${esc(f.effect.observedAt)} · ${esc(f.effect.actor)} · ${esc(f.effect.note)}<br>依据：${esc(f.effect.reference)} · ${esc(f.effect.source)}</p>`:'<p>业务效果尚未核实，不据办理完成自动判定达成。</p>'}<details><summary>查看全链路历史（${task.history.length} 条）</summary><ol>${task.history.map(e=>`<li><strong>${esc(e.action?actionNames[e.action]:e.to)}</strong> · ${esc(e.note)}<small>${esc(e.at)}</small></li>`).join('')}</ol></details>${button('report','生成固定复核报告')}</section>`;
}
function createForm() {
  return `<section class="hub-panel hub-new-case"><h2>新建待研判事项</h2><form id="hub-create-form" class="hub-form"><label>关联对象<select name="objectId">${data.enterprises.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>事项名称<input name="title" required placeholder="写清待判断的问题或待处理安排"></label><label>负责人<input name="owner" required></label><label>目标期限<input name="dueDate" type="date" required min="${today()}" value="${new Date(Date.now()+7*86400000).toISOString().slice(0,10)}"></label><p>引用已登记的 ${esc(data.asOf)} 示例快照。方案或模型结果可从相应分析页面送入，保留固定附件。</p><p class="hub-error" role="alert"></p><button class="hub-button primary">创建待研判事项</button>${button('close-create','取消')}</form></section>`;
}
mount.addEventListener('click',event=>{
  const stage=event.target.closest('[data-hub-stage]');if(stage){go('',{stage:stage.dataset.hubStage});return;}
  const target=event.target.closest('[data-hub-action]');if(!target)return;event.preventDefault();const action=target.dataset.hubAction,item=items().find(i=>i.id===route().get('case'));
  try {
    if(action==='open'){go(target.dataset.id);return;}
    if(action==='back'){go('');return;}
    if(action==='reload'){location.reload();return;}
    if(action==='clear'){sourceFilter='';ownerFilter='';search='';go('',{stage:'all'});return;}
    if(action==='summary'){summaryOpen=!summaryOpen;render();return;}
    if(action==='create'||action==='close-create'){createMode=action==='create';render();mount.querySelector('.hub-new-case')?.scrollIntoView();return;}
    if(action==='operation'||action==='close-form'){formAction=action==='operation'?target.dataset.operation:null;render();mount.querySelector('.hub-form input')?.focus();return;}
    if(action==='native-overview'){location.hash='overview?original=1';render();return;}
    if(action==='native-trace'){nativeReturnCase=item.id;location.hash='trace/request/'+encodeURIComponent(item.request.id);render();return;}
    if(action==='native-request'){nativeReturnCase=item.id;location.hash='request/'+encodeURIComponent(item.request.id);render();return;}
    if(action==='trace-evidence'){mount.querySelector('.hub-detail-grid details:last-child')?.setAttribute('open','');mount.querySelector('.hub-detail-grid details:last-child')?.scrollIntoView({block:'center'});return;}
    if(action==='trace-history'){const history=mount.querySelector('#hub-decision-history');history?.querySelector('details')?.setAttribute('open','');history?.scrollIntoView({block:'start'});return;}
    if(action==='native'){nativeReturnCase=item.id;location.hash=item.task?'task/'+encodeURIComponent(item.task.id):item.request.reminderId?'reminder/'+encodeURIComponent(item.request.reminderId):'request/'+encodeURIComponent(item.request.id);render();return;}
    if(action==='portrait'){send('OFW_CASE_PORTRAIT',{objectId:item.objectIds[0]});return;}
    if(action==='source'){send('OFW_CASE_SOURCE',{taskId:item.task.id});return;}
    if(action==='supplement') {
      const original=item.task,newTitle=original.title+' · 补充处置',duplicate=readWork().tasks.find(t=>t.parentTaskId===original.id&&!['CLOSED','CANCELLED','REJECTED'].includes(caseFlow(t).stage));
      if(duplicate){go('local:'+duplicate.id);return;}
      const next=newTask({title:newTitle,owner:original.owner,dueDate:new Date(Date.now()+7*86400000).toISOString().slice(0,10),objectIds:original.objectIds,evidence:original.evidence,plan:original.plan,existing:readWork().tasks,type:original.type});next.parentTaskId=original.id;next.parentEffect=structuredClone(caseFlow(original).effect);if(original.modelRun)next.modelRun=structuredClone(original.modelRun);if(original.recommendation){next.recommendation=structuredClone(original.recommendation);next.actionCode=original.actionCode;}saveWorkTask(next);go('local:'+next.id);return;
    }
    if(action==='report'){send('OFW_CASE_REPORT',{taskId:item.task.id});return;}
  }catch(e){error=e.message;render();}
});
mount.addEventListener('change',event=>{if(event.target.id==='hub-source')sourceFilter=event.target.value;if(event.target.id==='hub-owner')ownerFilter=event.target.value;if(event.target.matches('#hub-source,#hub-owner'))render();});
mount.addEventListener('input',event=>{if(event.target.id==='hub-search'){search=event.target.value;const pos=event.target.selectionStart;render();const field=mount.querySelector('#hub-search');field.focus();field.setSelectionRange(pos,pos);}});
mount.addEventListener('submit',event=>{
  event.preventDefault();const form=event.target,fields=Object.fromEntries(new FormData(form));
  try {
    if(form.id==='hub-create-form'){const ids=[fields.objectId],task=newTask({...fields,objectIds:ids,existing:readWork().tasks,evidence:{objectIds:ids,asOf:data.asOf,horizon:90,dataVersion:data.dataVersion,dataDigest:data.digest,ontologyVersion:data.ontologyVersion,resultKind:'DEMO_BASELINE',planId:null},plan:null});saveWorkTask(task);createMode=false;go('local:'+task.id);return;}
    if(form.id!=='hub-operation-form')return;
    const item=items().find(i=>i.id===route().get('case')),action=form.dataset.action;
    if(item.native) {
      if(action!=='review'||item.stage!=='EXECUTED')throw Error('当前原事项尚不能复核效果');
      const pseudo={...item.task,createdAt:item.createdAt,updatedAt:item.task.completedAt||item.createdAt,objectIds:item.objectIds,evidence:{asOf:item.asOf},history:[],status:'COMPLETED',decisionFlow:{stage:'EXECUTED',completedAt:item.task.completedAt||item.createdAt,execution:[],log:[],effect:null}};
      const reviewed=advanceCase(pseudo,'review',fields),saved=effects();saved[item.key]=reviewed.decisionFlow.effect;localStorage.setItem(EFFECT_KEY,JSON.stringify(saved));
    }else {
      const issue=caseBasisIssue(item.task,data,readModelStore());if(issue&&['submit','approve'].includes(action))throw Error(issue);
      if(item.task.updatedAt!==currentRevision)throw Error('事项已更新，请重新读取后操作');
      saveWorkTask(advanceCase(item.task,action,fields),currentRevision);
    }
    formAction=null;error='';render();
  }catch(e){form.querySelector('[role="alert"]').textContent=e.message;}
});
window.addEventListener('hashchange',()=>{formAction=null;error='';render();});window.addEventListener('popstate',render);
document.addEventListener('click',event=>{if(!mount.contains(event.target))setTimeout(render,0);});
window.addEventListener('storage',event=>{if([WORKBENCH_KEY,EFFECT_KEY,window.OFW_DECISION_PORTFOLIO.storageKey].includes(event.key)){if(formAction){error='来源记录已更新，请取消本次操作后重新读取。';return;}render();}});
render();
try{const response=await fetch('/data/portfolio.json');if(!response.ok)throw Error('固定分析数据读取失败');data=await response.json();render();}catch(e){mount.innerHTML=`<h1>事项数据读取失败</h1><p role="alert">${esc(e.message)}</p>${button('reload','重新读取')}`;}
