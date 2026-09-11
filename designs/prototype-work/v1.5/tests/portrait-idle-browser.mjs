import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:4506');
const context=await browser.newContext({viewport:{width:1440,height:900}});
await context.addInitScript(()=>{window.__idle={messages:{},mutations:0};addEventListener('message',e=>{const k=e.data?.type||e.data?.operation||'other';__idle.messages[k]=(__idle.messages[k]||0)+1;});addEventListener('DOMContentLoaded',()=>new MutationObserver(ms=>__idle.mutations+=ms.length).observe(document,{childList:true,subtree:true,attributes:true}));});
const page=await context.newPage();page.setDefaultTimeout(20000);const session=await context.newCDPSession(page);await session.send('Performance.enable');
const metrics=async()=>Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
const results=[];
for(const id of ['home','m07','ontology','data']){
 if(id==='home')await page.goto('http://127.0.0.1:4504/');
 else {const loc=page.locator(`[data-primary-nav][data-route="#module/${id}"]`);const box=await loc.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
 await page.waitForTimeout(2500);
 const before=await metrics();const states0=await Promise.all(page.frames().map(f=>f.evaluate(()=>({url:location.href,...__idle})).catch(()=>null)));
 await page.waitForTimeout(4000);
 const after=await metrics();const states1=await Promise.all(page.frames().map(f=>f.evaluate(()=>({url:location.href,...__idle})).catch(()=>null)));
 results.push({id,cpuSeconds:after.TaskDuration-before.TaskDuration,scriptSeconds:after.ScriptDuration-before.ScriptDuration,heapMB:after.JSHeapUsedSize/1e6,nodes:after.Nodes,states0,states1});console.log(JSON.stringify(results.at(-1)));
}
if(process.env.PHASE==='final')for(const result of results){assert.ok(result.cpuSeconds<0.1,`idle CPU regression: ${result.id}`);assert.ok(result.scriptSeconds<0.01,`idle script regression: ${result.id}`);for(let i=0;i<result.states0.length;i++)assert.equal(result.states1[i].mutations-result.states0[i].mutations,0,`idle DOM loop: ${result.id}`);}
await writeFile(new URL('../../../../outputs/m07-portrait-20260910/idle-'+(process.env.PHASE||'before')+'.json',import.meta.url),JSON.stringify(results,null,2));
await context.close();await browser.close();
