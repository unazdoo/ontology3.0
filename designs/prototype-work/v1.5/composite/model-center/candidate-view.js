import {simulationSummary} from './builder-view.js';
import {MODEL_TEMPLATES,modelParameterSpecs} from '../shared/model-studio.js';
import {escapeModelText as esc,modelMoney,modelNumber,modelResultMarkup} from '../shared/model-result-view.js';

const btn=(action,label,disabled=false)=>`<button class="studio-button" data-candidate-action="${action}" ${disabled?'disabled':''}>${label}</button>`;
const identity=v=>v.origin==='VERIFIED_CANDIDATE'?'已核验候选':'已发布';
export function createCandidateView({studio,getGoal,getHostIds,render,setBusy,onResult,onPromote}) {
  let goalId=null,selectedId=null,leftId=null,rightId=null,comparisonId=null,scope='context',error='',controller=null;
  const state=()=>studio.read();
  function chosenIds(version) {const host=getHostIds();return host.length?host.filter(id=>version.objectIds.includes(id)):[...version.objectIds];}
  function markup(goal) {
    if(goalId!==goal.id){goalId=goal.id;selectedId=null;leftId=null;rightId=null;comparisonId=null;error='';}
    const s=state(),candidates=s.candidates.filter(v=>v.goalId===goal.id),versions=[...s.versions.filter(v=>v.goalId===goal.id),...candidates];
    const candidate=candidates.find(v=>v.id===selectedId)||candidates.at(-1);selectedId=candidate?.id||null;
    leftId=versions.some(v=>v.id===leftId)?leftId:s.bindings[goal.id]||versions[0]?.id;
    rightId=versions.some(v=>v.id===rightId)?rightId:candidate?.id||versions.at(-1)?.id;
    const options=id=>versions.map(v=>`<option value="${v.id}" ${v.id===id?'selected':''}>${esc(v.name)} · ${identity(v)}</option>`).join('');
    const review=s.reviews.filter(r=>r.candidateId===candidate?.id).at(-1),trial=s.runs.find(r=>r.versionId===candidate?.id&&r.purpose==='TRIAL'&&r.status==='SUCCEEDED');
    const left=versions.find(v=>v.id===leftId),right=versions.find(v=>v.id===rightId),common=left?.objectIds.filter(id=>right?.objectIds.includes(id))||[],ids=scope==='context'&&getHostIds().length?common.filter(id=>getHostIds().includes(id)):common;
    const comparison=s.comparisons.find(c=>c.id===comparisonId)||s.comparisons.filter(c=>c.goalId===goal.id).at(-1);
    const names=ids.map(id=>s.datasets[left?.dataKey]?.enterprises.find(c=>c.id===id)?.name||id);
    return `<section class="studio-panel candidate-panel"><header><div><h2>候选观察与业务审阅</h2><p>将已核验草稿固定为候选，试用、审阅后可正式发布。当前应用继续独立维护。</p></div></header>${error?`<p class="studio-notice error" role="alert">${esc(error)}</p>`:''}<details><summary>从当前草稿创建候选</summary><form id="candidate-form" class="candidate-form"><label class="studio-field"><span>候选名称</span><input name="name" required placeholder="例如：期限调整候选 2"></label><label class="studio-field"><span>变更说明</span><input name="note" required placeholder="业务约束或方法的变化"></label><label class="studio-field"><span>负责人</span><input name="owner" required value="${esc(goal.owner)}"></label><button class="studio-button primary" ${goal.archived?'disabled':''}>固定已核验候选</button></form></details>${candidate?`<label class="studio-field"><span>查看候选</span><select id="candidate-choice">${candidates.map(v=>`<option value="${v.id}" ${v.id===candidate.id?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label><div class="candidate-state"><span class="studio-badge">已核验 · ${esc(candidate.name)}</span><span class="studio-badge ${s.candidateBindings[goal.id]===candidate.id?'success':''}">${s.candidateBindings[goal.id]===candidate.id?'候选试用已启用':'候选试用未启用'}</span><span>${review?'已记录人工审阅':'待业务审阅'}</span></div><p>${esc(candidate.note)} · 数据截至 ${esc(s.datasets[candidate.dataKey]?.asOf)}</p><p>本次试用：${chosenIds(candidate).map(id=>esc(s.datasets[candidate.dataKey]?.enterprises.find(c=>c.id===id)?.name||id)).join('、')||'没有共同适用企业'}${getHostIds().length>chosenIds(candidate).length?'；部分上下文企业不适用，请回数据与范围核对。':''}</p><div class="studio-inline-actions">${btn(s.candidateBindings[goal.id]===candidate.id?'disable':'enable',s.candidateBindings[goal.id]===candidate.id?'关闭候选试用':'启用候选试用',goal.archived)}${btn('trial','运行候选试用',s.candidateBindings[goal.id]!==candidate.id||!chosenIds(candidate).length||goal.archived)}${btn('promote','从此候选正式发布',!review||goal.archived)}</div>${controller?btn('cancel','停止本次比较或试用'):''}${trial?`<details><summary>最近候选试用 · ${esc(trial.id)}</summary>${simulationSummary(trial)}${btn('use-result','带此结果继续研判')}</details>`:''}<form id="candidate-review-form" class="candidate-review-form"><label class="studio-field"><span>审阅人</span><input name="reviewer" required placeholder="登记实际审阅人"></label><label class="studio-field"><span>模型审阅与使用边界</span><textarea name="note" required rows="2" placeholder="说明约束、代价和仍需验证的假设"></textarea></label><button class="studio-button">记录审阅意见</button></form>${review?`<p>最近审阅：${esc(review.reviewer)} · ${esc(review.note)}</p><details><summary>审阅历史与所引运行</summary>${s.reviews.filter(r=>r.candidateId===candidate.id).map(r=>`<p>${esc(r.at)} · ${esc(r.reviewer)} · ${esc(r.note)}<br>${r.runIds.map(esc).join('、')}</p>`).join('')}</details>`:''}`:'<p class="studio-empty">尚无候选。先核验草稿，再创建独立候选快照。</p>'}</section><section class="studio-panel"><h2>固定版本构建比较</h2><p>两个版本使用同一数据快照、相同企业和分析窗口；参数差异作为比较内容保留。</p><div class="candidate-form"><label class="studio-field"><span>左侧版本</span><select id="compare-left">${options(leftId)}</select></label><label class="studio-field"><span>右侧版本</span><select id="compare-right">${options(rightId)}</select></label><label class="studio-field"><span>比较范围</span><select id="compare-scope"><option value="context" ${scope==='context'?'selected':''}>${getHostIds().length?'当前业务上下文':'共同适用企业'}</option><option value="all" ${scope==='all'?'selected':''}>全部共同适用企业</option></select></label></div><p>将比较 ${ids.length} 家：${names.map(esc).join('、')||'无适用对象'}${scope==='context'&&getHostIds().length>ids.length?'；上下文中部分企业不在共同范围内。':''}</p>${btn('compare','运行固定比较',!ids.length||leftId===rightId||goal.archived)}${controller?btn('cancel','停止本次比较或试用'):''}${comparison?comparisonMarkup(comparison,s):'<p class="studio-empty">比较完成后，保留两侧运行与差异依据。</p>'}${s.comparisons.filter(c=>c.goalId===goal.id).length?`<label class="studio-field"><span>历史比较</span><select id="comparison-history">${s.comparisons.filter(c=>c.goalId===goal.id).slice().reverse().map(c=>`<option value="${c.id}" ${c.id===comparison?.id?'selected':''}>${esc(c.at)} · ${c.objectIds.length} 家</option>`).join('')}</select></label>`:''}</section>`;
  }
  async function action(action) {
    if(action==='cancel'){controller?.abort();return;}
    if(controller)return;
    const s=state(),goal=getGoal(),candidate=s.candidates.find(v=>v.id===selectedId);
    error='';
    try {
      if(action==='enable'||action==='disable')await studio.enableTrial(goal.id,action==='enable'?candidate.id:null);
      if(action==='promote'){onPromote(candidate);return;}
      if(action==='use-result'){const r=s.runs.find(r=>r.versionId===candidate.id&&r.purpose==='TRIAL'&&r.status==='SUCCEEDED');onResult(r);return;}
      if(action==='trial'||action==='compare') {
        controller=new AbortController();setBusy('正在计算固定版本结果…');render();
        if(action==='trial')await studio.run(goal.id,{purpose:'TRIAL',versionId:candidate.id,objectIds:chosenIds(candidate),signal:controller.signal});
        else {const versions=[...s.versions,...s.candidates],left=versions.find(v=>v.id===leftId),right=versions.find(v=>v.id===rightId),common=left.objectIds.filter(id=>right.objectIds.includes(id));const result=await studio.compareVersions(goal.id,{leftId,rightId,objectIds:scope==='context'&&getHostIds().length?common.filter(id=>getHostIds().includes(id)):common,signal:controller.signal});comparisonId=result.id;}
      }
    }catch(e){error=e.message;}finally{controller=null;setBusy('');render();}
  }
  async function submit(form) {
    if(!['candidate-form','candidate-review-form'].includes(form.id))return false;
    if(controller)return true;
    error='';try{const fields=Object.fromEntries(new FormData(form));if(form.id==='candidate-form'){selectedId=(await studio.freezeCandidate(getGoal().id,fields)).id;rightId=selectedId;}else await studio.reviewCandidate(selectedId,fields);}catch(e){error=e.message;}render();return true;
  }
  function change(target){const map={'candidate-choice':value=>selectedId=value,'compare-left':value=>leftId=value,'compare-right':value=>rightId=value,'compare-scope':value=>scope=value,'comparison-history':value=>comparisonId=value};if(map[target.id]){map[target.id](target.value);render();return true;}return false;}
  return {markup,action,submit,change,destroy(){controller?.abort();}};
}
function comparisonMarkup(c,s) {
  const a=s.runs.find(r=>r.id===c.leftRunId),b=s.runs.find(r=>r.id===c.rightRunId);if(!a||!b)return '<p role="alert">比较记录缺失，请重新运行。</p>';
  const differences=a.output.rows.filter(row=>JSON.stringify(row)!==JSON.stringify(b.output.rows.find(other=>other.enterpriseId===row.enterpriseId))).length;
  const changed=[...new Map([...modelParameterSpecs(a.type,a.methodId),...modelParameterSpecs(b.type,b.methodId)].map(spec=>[spec.key,spec])).values()].filter(spec=>a.parameters[spec.key]!==b.parameters[spec.key]);
  return `<div class="candidate-comparison"><p><b>${esc(a.versionName)} → ${esc(b.versionName)}</b> · 构建与契约比较</p><div class="studio-table-scroll"><table><thead><tr><th>检查项</th><th>左侧</th><th>右侧</th></tr></thead><tbody><tr><th>输入快照</th><td>${esc(a.output.asOf)}</td><td>${esc(b.output.asOf)}</td></tr><tr><th>输入样本数</th><td>${a.objectIds.length}</td><td>${b.objectIds.length}</td></tr><tr><th>输出记录数</th><td>${a.emittedOutput?.rowCount??a.output.rows.length}</td><td>${b.emittedOutput?.rowCount??b.output.rows.length}</td></tr><tr><th>契约检查</th><td>${a.checks.length} 项通过</td><td>${b.checks.length} 项通过</td></tr><tr><th>输出结构</th><td>${esc(a.emittedOutput?.grain||a.output.kind)}</td><td>${esc(b.emittedOutput?.grain||b.output.kind)}</td></tr></tbody></table></div><p>有 ${differences} 条样本输出发生变化。业务结果在已绑定的消费视图查看。</p>${changed.length?`<p>参数变化：${changed.map(spec=>esc(spec.label)+' '+esc(a.parameters[spec.key]??'未使用')+' → '+esc(b.parameters[spec.key]??'未使用')).join('；')}</p>`:''}<details><summary>调试样例和绑定依据</summary>${simulationSummary(a)}${simulationSummary(b)}</details><p class="studio-code-ref">比较记录 ${esc(c.id)}</p></div>`;
}
