import { chromium } from '../../../../designs/prototype-work/v1.4/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const out = new URL('../', import.meta.url);
const browser = await chromium.connectOverCDP(process.argv[2]);
const context = browser.contexts()[0];
const page = context.pages().find(p => p.url().startsWith('http://127.0.0.1:4404/'));
const errors = [], checks = [];
page.setDefaultTimeout(10000);
page.on('pageerror', e => errors.push(e.message));
await context.route(/https?:\/\/(?:localhost|127\.0\.0\.1):(?:4382|4383|4392|4393|4394)(?:\/|$)/, r => r.abort());
async function frame() {
  await page.waitForFunction(() => document.querySelector('#module-frame')?.contentDocument?.body?.innerText.length > 20);
  return (await page.locator('#module-frame').elementHandle()).contentFrame();
}
async function capture(name) {
  await page.screenshot({path:new URL(`screenshots/${name}.png`,out).pathname, animations:'disabled'});
  const evidence = {at:new Date().toISOString(),url:page.url(),viewport:page.viewportSize(),errors:[...errors],frames:await Promise.all(page.frames().map(async f=>({url:f.url(),text:await f.locator('body').innerText()})))};
  await writeFile(new URL(`logs/${name}.json`,out),JSON.stringify(evidence,null,2));
}
async function ask(f, question) {
  await f.locator('#question').fill(question);
  await f.getByRole('button',{name:'发送问题',exact:true}).click();
  await f.waitForFunction(q=>{const s=JSON.parse(localStorage.getItem('ofw.v1.4.workbench.v1'));return s.queries[0]?.question===q && ['success','failed'].includes(s.queries[0].status)},question);
  return f.evaluate(()=>{const q=JSON.parse(localStorage.getItem('ofw.v1.4.workbench.v1')).queries[0];return {id:q.id,question:q.question,status:q.status,summary:q.summary,parameters:q.parameters,evidence:q.evidence}});
}
try {
  await page.locator('[data-primary-nav][data-route="#dashboard"]').click();
  await page.locator('[data-module-task=situation][data-module-id=dashboard]').click();
  let f=await frame();
  await f.locator('#global-map[data-map-ready=true]').waitFor();
  const normal=await ask(f,'未来90天到期多少？');
  checks.push({id:'control',status:'实际可用',actual:normal});
  await capture('02-normal-query');
  const unknown=await ask(f,'华南环保集团融资余额多少');
  checks.push({id:'R14-002',status:unknown.status==='success'?'仍可复现':'需核对',actual:unknown});
  await capture('03-unknown-enterprise');
  const decimal=await ask(f,'未来90天如果降息12.5bp，授信收缩12.5%，展期30天');
  await f.locator(`[data-action=scenario-answer][data-id="${decimal.id}"]`).click();
  checks.push({id:'R14-006',status:'仍可复现',actual:decimal,inputs:{rate:await f.locator('#scenario-rate').inputValue(),credit:await f.locator('#scenario-credit').inputValue(),extension:await f.locator('#scenario-extension').inputValue()}});
  await capture('04-decimal-parameters');
  await f.locator('#entity-search').fill('不存在的Review企业');
  checks.push({id:'R14-010',status:'仍可复现',actual:await f.locator('[data-object-type=definition][data-object-id=weightedCost]').first().innerText()});
  await capture('05-empty-scope');
  await page.setViewportSize({width:1280,height:720});await capture('06-1280');
  await page.setViewportSize({width:390,height:844});await capture('07-390');
  await page.setViewportSize({width:320,height:844});await capture('08-320');
  await page.setViewportSize({width:1440,height:900});
  await page.locator('[data-primary-nav][data-route="#module/ontology"]').click();
  f=await frame();await f.locator('[data-owned-rule-open=S001]').waitFor();
  await f.locator('[data-owned-rule-open=S001]').click();
  await capture('09-ontology-click');
  checks.push({id:'R14-003',status:'仍可复现',actual:{errors:[...errors],url:f.url(),view:await f.locator('body').innerText()}});
  await writeFile(new URL('logs/results.json',out),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify(checks.map(c=>({id:c.id,status:c.status,actual:c.id==='R14-003'?c.actual.errors:c.actual,inputs:c.inputs})),null,2));
} catch(e) {
  await writeFile(new URL('logs/script-error.json',out),JSON.stringify({error:e.stack,checks,errors},null,2));
  throw e;
}
