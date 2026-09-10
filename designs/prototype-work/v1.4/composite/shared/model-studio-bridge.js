import {MODEL_STORE_KEY,readModelStore,studioSignals} from './model-studio.js';
let cached=[];
function refresh(){try{cached=studioSignals(readModelStore());}catch(_){cached=[];}window.dispatchEvent(new CustomEvent('ofw-model-signals-ready'));}
window.OFW_STUDIO_SIGNALS=Object.freeze({forObject:id=>cached.filter(event=>event.objectId===id)});
window.addEventListener('storage',event=>{if(event.key===MODEL_STORE_KEY)refresh();});
window.addEventListener('ofw-model-studio-change',refresh);
refresh();
