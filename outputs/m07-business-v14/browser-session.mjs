import { chromium } from '../../designs/prototype-work/v1.4/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('outputs/m07-business-v14');
const browser = await chromium.connectOverCDP('http://127.0.0.1:4466');
const context = await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true,reducedMotion:'reduce'});
const page = await context.newPage();
page.rc = async loc => {await loc.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));const b=await loc.boundingBox();if(!b||!b.width||!b.height)throw Error('Target not visible');await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
page.setDefaultTimeout(30000);
const errors = [];
page.on('pageerror', e => { errors.push(e.message); void appendFile(path.join(out, 'logs/browser-errors.jsonl'), JSON.stringify({ time: new Date().toISOString(), error: e.message })+'\n'); });
page.on('request', r => void appendFile(path.join(out,'logs/requests.jsonl'), JSON.stringify({at:Date.now(),url:r.url()})+'\n'));
page.on('response', r => void appendFile(path.join(out,'logs/responses.jsonl'), JSON.stringify({at:Date.now(),status:r.status(),url:r.url()})+'\n'));
page.on('requestfailed', r => void appendFile(path.join(out,'logs/request-failures.jsonl'), JSON.stringify({url:r.url(),failure:r.failure()})+'\n'));
if (page.url() === 'about:blank') await page.goto('http://127.0.0.1:4464/', {waitUntil:'commit', timeout:30000}).catch(error=>writeFile(out+'/logs/initial-navigation-frame-control.json',JSON.stringify({error:error.message,url:page.url()}))); 
await context.route(/https?:\/\/(?:localhost|127\.0\.0\.1):(?:4382|4383|4392|4393|4394)(?:\/|$)/, r => { void appendFile(path.join(out,'logs/blocked-main-ports.jsonl'),JSON.stringify({url:r.request().url()})+'\n'); return r.abort(); });
const frame = async () => {
  await page.waitForFunction(() => document.querySelector('#module-frame')?.contentDocument?.body?.innerText.length > 20, null, {polling:100});
  const element = await page.locator('#module-frame').elementHandle();
  const f = await element.contentFrame();
  await f.waitForFunction(() => document.body?.innerText.trim().length > 20, null, {polling:100});
  return f;
};
const shot = async name => {
  const file=path.join(out,'screenshots',name+'.png');
  const screenshotSession = await context.newCDPSession(page); const frameImage = await screenshotSession.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(file,Buffer.from(frameImage.data,'base64')); await screenshotSession.detach(); 
  await writeFile(path.join(out,'logs',name+'.json'),JSON.stringify({url:page.url(),viewport:page.viewportSize(),frames:await Promise.all(page.frames().map(async f=>({url:f.url(),text:await f.locator('body').innerText().catch(()=>''),controls:await f.locator('button,input,select,textarea,a').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,160),value:e.value,disabled:e.disabled,attrs:Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')||a.name==='href'||a.name==='id').map(a=>[a.name,a.value]))}))).catch(()=>[])}))),errors},null,2));
  return file;
};
const snap = async (target=page) => ({url:target.url(),text:await target.locator('body').innerText(),controls:await target.locator('button,input,select,textarea,a').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,120),value:e.value,disabled:e.disabled,attrs:Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')||a.name==='href'||a.name==='id').map(a=>[a.name,a.value]))})))});
const go = async id => { await page.locator(`[data-primary-nav][data-route="${id==='dashboard'?'#dashboard':id==='home'?'#home':'#module/'+id}"]`).click(); return id==='home'?page:frame(); };
const task = async (id,module) => { const s=page.locator(`[data-module-task-select="${module}"]`);if(await s.isVisible())await s.selectOption(id);else await page.locator(`[data-module-task="${id}"][data-module-id="${module}"]`).click();return frame(); };
page.ev=async name=>{await writeFile(out+'/logs/'+name+'.json',JSON.stringify({at:new Date().toISOString(),url:page.url(),viewport:page.viewportSize(),errors,frames:await Promise.all(page.frames().map(async f=>({url:f.url(),text:await f.locator('body').innerText(),state:await f.evaluate(()=>window.__OFW_M07_DEBUG__?.getState()||window.__OFW_V14__?.getState()||null)})))},null,2));}; page.rshot = shot; const api={browser,context,page,frame,shot,snap,go,task,out,errors,writeFile,appendFile};
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
