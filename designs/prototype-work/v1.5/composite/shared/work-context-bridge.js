import {readWork,relatedWorkItems,WORKBENCH_KEY,resultIdentityLabel} from './work-items.js';
import {readModelStore,MODEL_STORE_KEY} from './model-studio.js';
window.OFW_WORK_CONTEXT=Object.freeze({
  explorations:()=>readWork().explorations||[],
  tasks:id=>relatedWorkItems(id),
  runs:id=>readModelStore().runs.filter(r=>['USE','TRIAL'].includes(r.purpose)&&r.status==='SUCCEEDED'&&r.objectIds.includes(id)).slice(0,3),
  label:resultIdentityLabel,
});
window.dispatchEvent(new Event('ofw-work-context-ready'));
window.addEventListener('storage',event=>{if([WORKBENCH_KEY,MODEL_STORE_KEY].includes(event.key))window.dispatchEvent(new Event('ofw-work-context-ready'));});
