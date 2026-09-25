import {escapeModelText as esc} from './model-result-view.js';
export function parameterControl(spec,value,attribute,{state,disabled=false}={}){
  const attrs=`${attribute}="${spec.key}" ${disabled?'disabled':''}`;
  if(spec.type==='index'){
    const indices=[...new Set(Object.values(state?.bindingAssets||{}).filter(a=>a.kind==='ledger-contracts').flatMap(a=>a.rows.map(r=>r.rateIndex)).filter(Boolean))];
    return `<select ${attrs}><option value="ALL">全部基准利率（同幅变动情景）</option>${indices.map(index=>`<option value="${esc(index)}" ${value===index?'selected':''}>${esc(index)}</option>`).join('')}</select>`;
  }
  return `<input type="${spec.type==='date'?'date':'number'}" ${attrs} value="${esc(value)}" ${spec.type==='date'?'':`min="${spec.min}" max="${spec.max}" step="${['months','horizonDays','tenorMonths','extensionDays','tenorToleranceDays'].includes(spec.key)?1:.01}"`}>`;
}
export const parameterValue=element=>element.type==='number'?element.valueAsNumber:element.value;
