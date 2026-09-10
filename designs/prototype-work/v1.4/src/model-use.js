import {createModelStudio,MODEL_TEMPLATES,MODEL_STORE_KEY,runtimeParameterSpecs} from '../composite/shared/model-studio.js';
import {modelResultMarkup,escapeModelText as esc} from '../composite/shared/model-result-view.js';
import '../composite/shared/model-result-view.css';

export function createModelUse({getData,getScope,onUpdate,onOpenStudio}) {
  const studio=createModelStudio();
  let ready=false,preparing=null,selectedVersionId=null,selectedRunId=sessionStorage.getItem('ofw-enterprise-model-run')||null,error='',busy=false,controller=null,scopeMode='selected',overrides={};
  const versions=()=>{const state=studio.read();return state.goals.filter(goal=>!goal.archived).flatMap(goal=>state.versions.filter(version=>version.goalId===goal.id&&state.availability[version.id]).map(version=>({...version,goalName:goal.name,current:state.bindings[goal.id]===version.id}))).sort((a,b)=>Number(b.current)-Number(a.current)||a.goalName.localeCompare(b.goalName,'zh-CN'));};
  const version=()=>versions().find(version=>version.id===selectedVersionId)||versions()[0];
  const ids=()=>{const scope=getScope();return scopeMode==='selected'&&scope.selectedId?[scope.selectedId]:scope.objectIds;};
  const eligible=()=>ids().filter(id=>version()?.objectIds.includes(id));
  async function prepare(){if(ready)return;if(preparing)return preparing;preparing=studio.initialize(getData()).then(()=>{ready=true;selectedVersionId=studio.read().runs.find(run=>run.id===selectedRunId)?.versionId||version()?.id;error='';}).catch(caught=>{error=caught.message;}).finally(()=>{preparing=null;onUpdate();});return preparing;}
  function markup() {
    if(!ready){void prepare();return `<div class="model-use"><h3>使用模型版本</h3><p>${error?esc(error):'正在读取模型目标与发布版本…'}</p>${error?'<button class="button" data-model-use="retry">重新读取</button>':''}</div>`;}
    const options=versions(),chosen=version(),scope=getScope(),run=studio.read().runs.find(run=>run.id===selectedRunId);
    if(!chosen)return '<div class="model-use"><h3>使用模型</h3><p>当前没有可用的发布版本。请在模型与算法中核验并发布目标版本。</p><button class="button" data-action="native-model" data-module="modeling" data-task="objectives">管理模型目标</button></div>';
    selectedVersionId=chosen.id;
    return `<div class="model-use"><header><h3>使用已发布模型</h3><small>按目标、版本和企业范围运行</small></header><label>模型与版本<select id="model-use-version" ${busy?'disabled':''}>${options.map(item=>`<option value="${item.id}" ${chosen.id===item.id?'selected':''}>${esc(item.goalName)} · ${esc(item.name)}${item.current?'（当前应用）':''}</option>`).join('')}</select></label><p>${esc(MODEL_TEMPLATES[chosen.type].method)}</p><label>本次范围<select id="model-use-scope" ${busy?'disabled':''}><option value="selected" ${scopeMode==='selected'?'selected':''} ${scope.selectedId?'':'disabled'}>当前企业${scope.selectedId?' · '+esc(getData().enterprises.find(company=>company.id===scope.selectedId)?.name||scope.selectedId):''}</option><option value="all" ${scopeMode==='all'||!scope.selectedId?'selected':''}>当前结果范围 · ${scope.objectIds.length} 家</option></select></label><p class="model-use-scope">本次将运行 ${eligible().length} 家适用企业：${eligible().slice(0,4).map(id=>esc(getData().enterprises.find(c=>c.id===id)?.name||id)).join('、')}${eligible().length>4?'等':''}</p><details><summary>本次运行情景</summary><div class="model-use-parameters">${runtimeParameterSpecs(chosen.type).map(spec=>`<label>${esc(spec.label)}（${esc(spec.unit)}）<input type="number" data-model-use-parameter="${spec.key}" ${busy?'disabled':''} value="${overrides[spec.key]??chosen.parameters[spec.key]}" min="${spec.min}" max="${spec.max}" step="0.1"></label>`).join('')}</div></details><p class="model-use-basis">基于版本绑定的 ${esc(studio.read().datasets[chosen.dataKey]?.asOf)} 演示快照；本次情景单独记录，结果不改写历史事实。</p><div class="model-use-actions"><button class="button primary" data-model-use="run" ${busy||!eligible().length?'disabled':''}>${busy?'正在计算…':`运行 ${eligible().length} 家企业`}</button>${busy?'<button class="button" data-model-use="cancel">停止</button>':''}<button class="button" data-model-use="definition">查看模型版本</button></div>${error?`<p class="model-use-error" role="alert">${esc(error)}</p>`:''}${run?`${modelResultMarkup(run,{compact:true})}<button class="button" data-model-use="record">查看目标与运行记录</button>`:''}</div>`;
  }
  async function action(kind) {
    if(kind==='cancel'){controller?.abort();return;}
    if(kind==='retry'){ready=false;await prepare();return;}
    if(kind==='definition'){onOpenStudio({goalId:version().goalId,versionId:version().id});return;}
    if(kind==='record'){const run=studio.read().runs.find(run=>run.id===selectedRunId);onOpenStudio({goalId:run.goalId,versionId:run.versionId,runId:run.id});return;}
    if(kind!=='run'||busy)return;
    await prepare();const chosen=version(),objectIds=eligible();if(!chosen||!objectIds.length)return;
    busy=true;error='';controller=new AbortController();onUpdate();
    try{const result=await studio.run(chosen.goalId,{purpose:'USE',versionId:chosen.id,objectIds,parameterOverrides:overrides,source:'企业对象探索',signal:controller.signal});selectedRunId=result.id;sessionStorage.setItem('ofw-enterprise-model-run',result.id);}catch(caught){error=caught.message;}finally{busy=false;controller=null;onUpdate();}
  }
  function change(target) { if(target.id==='model-use-version'){selectedVersionId=target.value;selectedRunId=null;overrides={};onUpdate();return true;}if(target.id==='model-use-scope'){scopeMode=target.value;onUpdate();return true;}if(target.dataset.modelUseParameter){overrides[target.dataset.modelUseParameter]=target.valueAsNumber;return true;}return false; }
  function showRun(runId) { const run=studio.read().runs.find(run=>run.id===runId);if(run){selectedRunId=runId;sessionStorage.setItem('ofw-enterprise-model-run',runId);selectedVersionId=run.versionId;ready=true;scopeMode=run.objectIds.length===1?'selected':'all';} }
  const storageChanged=event=>{if(event.key===MODEL_STORE_KEY&&ready&&!busy)onUpdate();};window.addEventListener('storage',storageChanged);
  return {markup,action,change,showRun,destroy(){controller?.abort();window.removeEventListener('storage',storageChanged);}};
}
