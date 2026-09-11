import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { start } from '../server.mjs';
const out = new URL('../../../../outputs/v1.5-verification/legacy-regressions/m07-20260909/final-layout/', import.meta.url); await mkdir(out,{recursive:true});
const runtime = await start({port:0,staticPort:0,modelingPort:0});
const profile = await mkdtemp(path.join(tmpdir(),'m07-final-'));
const child = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--disable-background-timer-throttling','--disable-renderer-backgrounding','about:blank'],{stdio:'ignore'});
let browser,page,f; const checks=[],errors=[];
async function click(locator){await locator.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));const b=await locator.boundingBox();assert.ok(b?.width&&b?.height);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
async function shot(name){const session=await page.context().newCDPSession(page);try{const result=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(new URL(name+'.png',out),Buffer.from(result.data,'base64'));}finally{await session.detach();}}
try{
let port;for(let i=0;i<100;i++){try{port=Number((await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(port);
browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
await page.goto(runtime.url+'/',{waitUntil:'domcontentloaded',timeout:60000});await click(page.locator('[data-primary-nav][data-route="#module/m07"]'));
await page.waitForFunction(()=>document.querySelector('#module-frame')?.contentWindow?.__OFW_M07_DEBUG__,null,{polling:100});f=await(await page.locator('#module-frame').elementHandle()).contentFrame();
await f.locator('#object-search').fill('环保');for(const id of ['ENT-020','ENT-017'])await click(f.locator(`.result-table [data-select-object="${id}"]`));await click(f.locator('#explore-selection'));await click(f.locator('.path-object[data-set-active="ENT-020"]'));await click(f.locator('button[data-lens=compare]'));
const options=await f.locator('#compare-metric option').evaluateAll(es=>es.map(e=>({id:e.value,text:e.textContent})));await f.locator('#compare-metric').selectOption(options.find(o=>JSON.parse(o.id)[1].endsWith(':averageFinancingCost')).id);
for(const [width,height]of [[1440,900],[1280,720],[390,844],[320,844]]){
await page.setViewportSize({width,height});await click(f.locator('button[data-lens=compare]'));
const boxes=await f.locator('.compare-lens,.comparison-chart,.bar-row,.compare-toolbar').evaluateAll(es=>es.map(e=>({class:e.className,width:e.clientWidth,scroll:e.scrollWidth})));assert.ok(boxes.every(b=>b.scroll<=b.width+1),JSON.stringify(boxes));
assert.ok(await f.locator('.inspector-metrics').textContent().then(t=>t.includes('静态快照 · 2025-12-31')));
await shot('comparison-'+width);
await click(f.locator('button[data-lens=graph]'));
const circle=f.locator('[data-graph-select="financing::s001.owner.001"] > circle');await click(circle);await f.waitForFunction(()=>__OFW_M07_DEBUG__.getState().activeId==='financing::s001.owner.001',null,{polling:100});
const text=await f.locator('.canvas-title p').innerText();assert.match(text,/关系中心：环保测试公司4.*当前节点：负责人001/);
const title=await f.locator('.canvas-title p').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight}));assert.ok(title.scroll<=title.width+1&&title.scrollHeight<=title.height+1);
await shot('graph-title-'+width);checks.push({width,boxes,title});console.log('PASS layout '+width);
await click(f.locator('[data-graph-select="ENT-020"] > circle'));
}
assert.deepEqual(errors,[]);await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',url:runtime.url,checks,errors},null,2));
}catch(e){await writeFile(new URL('failure.json',out),JSON.stringify({error:e.stack,checks,errors},null,2));throw e;}finally{await browser?.close();child.kill('SIGTERM');await runtime.close();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(()=>{});}
