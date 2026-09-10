import {chromium} from '../../designs/prototype-work/v1.4/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.connectOverCDP(process.env.CDP_URL||'http://[::1]:4516');
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>{window.__perf={mutations:0,messages:{},storage:0};addEventListener('message',e=>{const k=e.data?.type||e.data?.operation||'other';__perf.messages[k]=(__perf.messages[k]||0)+1;});addEventListener('storage',()=>__perf.storage++);addEventListener('DOMContentLoaded',()=>new MutationObserver(ms=>__perf.mutations+=ms.length).observe(document,{attributes:true,subtree:true,childList:true,characterData:true}));});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const results=[];const out=new URL('./',import.meta.url);
async function click(loc){await loc.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const b=await loc.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
async function frame(){await page.waitForFunction(()=>document.querySelector('#module-frame')?.contentWindow?.__OFW_M07_DEBUG__,null,{polling:100});return(await page.locator('#module-frame').elementHandle()).contentFrame();}
async function sample(name,target=page){await target.waitForTimeout(2000);const cdp=await context.newCDPSession(target);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.start');const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));const states=()=>Promise.all(target.frames().map(f=>f.evaluate(()=>({url:location.href,...__perf,animations:document.getAnimations().map(a=>({name:a.animationName,state:a.playState,target:a.effect?.target?.getAttribute('class'),iterations:String(a.effect?.getTiming().iterations)}))})).catch(()=>null)));const before=await metrics(),s0=await states();await target.waitForTimeout(4000);const after=await metrics(),s1=await states();const {profile}=await cdp.send('Profiler.stop');await writeFile(new URL(name+'.cpuprofile',out),JSON.stringify(profile));const deltas=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,after[k]-before[k]]));results.push({name,deltas,heapMB:after.JSHeapUsedSize/1e6,s0,s1,errors});await writeFile(new URL('diagnostic-results.json',out),JSON.stringify(results,null,2));console.log(JSON.stringify({name,deltas,frames:s1.map((s,i)=>({mutations:s?.mutations-s0[i]?.mutations,animations:s?.animations}))}));await cdp.detach();}
try{
 await page.goto('http://127.0.0.1:4514/',{waitUntil:'domcontentloaded'});await sample('home');
 await click(page.locator('[data-primary-nav][data-route="#module/m07"]'));let f=await frame();await sample('directory');
 await click(f.locator('.result-table .object-name[data-open-object="ENT-020"]'));await sample('portrait');
 await click(f.locator('#workspace-context [data-route="discover"]'));await click(f.locator('.result-table [data-select-object="ENT-001"]'));await sample('selected-directory');
 const second=await context.newPage();second.on('pageerror',e=>errors.push(e.message));await second.goto(page.url(),{waitUntil:'domcontentloaded'});await sample('two-tabs',second);await second.close();
 await writeFile(new URL('diagnostic-done.json',out),JSON.stringify({errors,count:results.length}));
}finally{await context.close();await browser.close();}
