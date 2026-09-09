import { chromium } from '../../../designs/prototype-work/v1.4/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('outputs/review-v1.4');
const browser = await chromium.connectOverCDP(process.argv[2]);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().startsWith('http://127.0.0.1:4404/'));
page.setDefaultTimeout(6000);
const errors = [];
page.on('pageerror', e => { errors.push(e.message); void appendFile(path.join(out, 'logs/browser-errors.jsonl'), JSON.stringify({ time: new Date().toISOString(), error: e.message })+'\n'); });
page.on('requestfailed', r => void appendFile(path.join(out,'logs/request-failures.jsonl'), JSON.stringify({url:r.url(),failure:r.failure()})+'\n'));
await context.route(/https?:\/\/(?:localhost|127\.0\.0\.1):(?:4382|4383|4392|4393|4394)(?:\/|$)/, r => { void appendFile(path.join(out,'logs/blocked-main-ports.jsonl'),JSON.stringify({url:r.request().url()})+'\n'); return r.abort(); });
const frame = async () => {
  const element = await page.locator('#module-frame').elementHandle();
  const f = await element.contentFrame();
  await f.waitForFunction(() => document.body?.innerText.trim().length > 20);
  return f;
};
const shot = async name => {
  const file=path.join(out,'screenshots',name+'.png');
  await page.screenshot({path:file});
  await writeFile(path.join(out,'logs',name+'.json'),JSON.stringify({url:page.url(),viewport:page.viewportSize(),frames:await Promise.all(page.frames().map(async f=>({url:f.url(),text:await f.locator('body').innerText().catch(()=>''),controls:await f.locator('button,input,select,textarea,a').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,160),value:e.value,disabled:e.disabled,attrs:Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')||a.name==='href'||a.name==='id').map(a=>[a.name,a.value]))}))).catch(()=>[])}))),errors},null,2));
  return file;
};
const snap = async (target=page) => ({url:target.url(),text:await target.locator('body').innerText(),controls:await target.locator('button,input,select,textarea,a').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,120),value:e.value,disabled:e.disabled,attrs:Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')||a.name==='href'||a.name==='id').map(a=>[a.name,a.value]))})))});
const go = async id => { await page.locator(`[data-primary-nav][data-route="${id==='dashboard'?'#dashboard':id==='home'?'#home':'#module/'+id}"]`).click(); return id==='home'?page:frame(); };
const task = async (id,module) => { const s=page.locator(`[data-module-task-select="${module}"]`);if(await s.isVisible())await s.selectOption(id);else await page.locator(`[data-module-task="${id}"][data-module-id="${module}"]`).click();return frame(); };
const api={browser,context,page,frame,shot,snap,go,task,out,errors,writeFile,appendFile};
const server=createServer(async(req,res)=>{
  if(req.method!=='POST'){res.writeHead(405);res.end();return;}
  let code='';for await(const chunk of req)code+=chunk;
  const time=new Date().toISOString();
  try {
    await appendFile(path.join(out,'logs/browser-actions.jsonl'),JSON.stringify({time,code})+'\n');
    const result=await new (Object.getPrototypeOf(async()=>{}).constructor)(...Object.keys(api),code)(...Object.values(api));
    const body=JSON.stringify({ok:true,result});
    await appendFile(path.join(out,'logs/browser-results.jsonl'),JSON.stringify({time,result})+'\n');
    res.writeHead(200,{'content-type':'application/json'});res.end(body);
  } catch(e){const result={ok:false,error:e.stack};await appendFile(path.join(out,'logs/browser-results.jsonl'),JSON.stringify({time,...result})+'\n');res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));}
});
server.listen(0,'127.0.0.1',async()=>{const endpoint=`http://127.0.0.1:${server.address().port}`;await writeFile(path.join(out,'logs/browser-endpoint.txt'),endpoint);console.log(endpoint);});
