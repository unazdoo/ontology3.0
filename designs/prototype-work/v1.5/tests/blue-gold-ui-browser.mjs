import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const phase=process.env.REVIEW_PHASE||'after',base=process.env.BASE_URL||'http://127.0.0.1:4594',out=new URL(`../../../../outputs/v1.5-verification/blue-gold-refactor/${phase}/`,import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:4596'),context=await browser.newContext({viewport:{width:1920,height:1080},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(25000);const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));let f;
async function click(locator){await locator.waitFor({state:'attached'});await locator.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await page.waitForTimeout(80);const b=await locator.boundingBox();assert.ok(b?.width&&b?.height);await page.mouse.click(b.x+b.width/2,b.y+b.height/2);}
async function frame(kind){await page.waitForFunction(kind=>document.querySelector('#module-frame')?.dataset.moduleId===kind&&document.querySelector('#module-frame')?.dataset.pending==='false',kind,{polling:100});f=await(await page.locator('#module-frame').elementHandle()).contentFrame();return f;}
async function capture(name){await page.waitForTimeout(550);const cd=await context.newCDPSession(page),img=await cd.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await cd.detach();await writeFile(new URL(name+'.png',out),Buffer.from(img.data,'base64'));const doc=f||page;
 const snapshot=await doc.evaluate(()=>({title:document.title,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()).filter(Boolean),actions:[...document.querySelectorAll('button,a,summary,input,select,textarea')].map(e=>({tag:e.tagName,name:(e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent||e.getAttribute('placeholder')||'').trim().replace(/\s+/g,' '),id:e.id,href:e.tagName==='A'?e.getAttribute('href'):null})),body:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth+1,theme:document.documentElement.dataset.ofwTheme||null}));
 const brand=await page.locator('.brand-brain').innerHTML();snapshot.brandHash=createHash('sha256').update(brand).digest('hex');snapshot.name=name;snapshot.errors=[...errors];await writeFile(new URL(name+'.json',out),JSON.stringify(snapshot,null,2));checks.push(name);console.log('CAPTURE',phase,name);return snapshot;
}
try{
 await page.goto(base+'/');await capture('00-home');
 for(const kind of ['data','ontology','m07','query','decision','agent','report','modeling']){await click(page.locator(`[data-primary-nav][data-route="#module/${kind}"]`));await frame(kind);await capture('01-'+kind);}
 await click(page.locator('[data-primary-nav][data-route="#module/m07"]'));await frame('m07');
 for(const [task,name] of [['directory','02-business-panorama'],['situation','03-map'],['temporal','04-temporal']]){await click(page.locator(`.object-primary-children [data-module-task="${task}"]`));await frame('dashboard');if(task==='situation')await f.waitForFunction(()=>window.__OFW_V14__?.getMap()?.getSource('entities'),null,{polling:100});if(task==='temporal')await f.waitForFunction(()=>window.__OFW_TEMPORAL__,null,{polling:100});await capture(name);}
 const snapshots=await Promise.all(checks.map(name=>readFile(new URL(name+'.json',out),'utf8').then(JSON.parse)));
 if(phase==='after'){
  const before=await Promise.all(checks.map(name=>readFile(new URL('../before/'+name+'.json',out),'utf8').then(JSON.parse)));
  const comparison=snapshots.map((s,i)=>{const b=before[i],keys=actions=>new Set(actions.map(a=>a.tag+'|'+a.name+'|'+a.id)),next=keys(s.actions);return {page:s.name,brandPreserved:s.brandHash===b.brandHash,missingActions:[...keys(b.actions)].filter(a=>!next.has(a)),beforeActionCount:b.actions.length,afterActionCount:s.actions.length,theme:s.theme,overflow:s.overflow};});
  await writeFile(new URL('../comparison.json',out),JSON.stringify(comparison,null,2));assert.ok(comparison.every(p=>p.brandPreserved),'original brain brand preserved');assert.ok(comparison.every(p=>!p.overflow),'no horizontal document overflow');
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks,errors},null,2));
}catch(error){await writeFile(new URL('failure.json',out),JSON.stringify({error:error.stack,checks,errors,body:await f?.locator('body').innerText().catch(()=>'' )},null,2));throw error;}finally{await context.close();await browser.close();}
