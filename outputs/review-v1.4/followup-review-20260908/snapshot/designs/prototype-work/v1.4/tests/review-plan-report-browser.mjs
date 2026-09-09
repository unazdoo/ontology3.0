import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {start} from '../server.mjs';
const out=new URL('../../../../outputs/fixes-v1.4/plan-report/',import.meta.url);await mkdir(out,{recursive:true});
const saved=JSON.parse(await readFile(new URL('../map-report/state.json',out),'utf8'));
const runtime=await start({port:0,staticPort:0,modelingPort:0});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
await context.addInitScript(saved=>{if(!localStorage.getItem('ofw.v1.4.workbench.v1'))localStorage.setItem('ofw.v1.4.workbench.v1',JSON.stringify(saved));},saved);
const page=await context.newPage();page.setDefaultTimeout(25000);let f;const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
async function frame(){await page.waitForTimeout(500);f=await(await page.locator('#module-frame').elementHandle()).contentFrame();return f;}
async function shot(name){await page.screenshot({path:new URL(name+'.png',out).pathname});checks.push(name);console.log('PASS '+name);}
const state=()=>f.evaluate(()=>__OFW_V14__.getState());
async function sync(){await f.locator('[data-action=native-report]').click();await page.waitForURL('**#module/report');await frame();await f.locator('[data-ofw-native-action=report-open]').first().click();await f.locator('[data-report-editor]').waitFor();}
async function openJoint(id){await page.locator('[data-primary-nav][data-route="#module/report"]').click();await page.locator('[data-module-task=joint-reports]').click();await frame();await f.locator(`[data-action=open-report][data-id="${id}"]`).click();}
try{
await page.goto(runtime.url+'/');await page.locator('[data-primary-nav][data-route="#module/decision"]').click();await page.locator('[data-module-task=financing-plans]').click();await frame();await f.locator('[data-action=apply-plan]').first().click();await page.waitForURL('**#dashboard');await frame();await f.waitForSelector('#global-map[data-map-ready=true]');
const plan=(await state()).plans.find(p=>p.id===saved.plans[0].id);assert.ok(plan);assert.equal((await state()).activePlanId,plan.id);
const oldAnswer=saved.queries.find(q=>q.status==='success'&&q.evidence?.planId===plan.id);
await f.locator('#active-plan').selectOption('');
await f.locator('#horizon').selectOption('180');
await f.locator('[data-action=right-tab][data-tab=query]').click();
await f.locator(`[data-action=apply-answer][data-id="${oldAnswer.id}"]`).click();
assert.equal((await state()).activePlanId,oldAnswer.evidence.planId);
assert.equal((await state()).horizon,oldAnswer.horizon);
assert.deepEqual((await state()).filters.objectIds,oldAnswer.evidence.objectIds);
await shot('00-old-simulation-answer-restores-plan-window-and-scope');
await f.locator('[data-action=create-report]').click();await f.locator('#report-title').fill('方案压力报告');await f.locator('#report-notes').fill('v1：固定小数降息和授信收缩假设。');await f.locator('#report-edit [type=submit]').click();const original=(await state()).reports[0];
assert.equal(original.evidence.resultKind,'SIMULATION');assert.equal(original.evidence.planId,plan.id);
await sync();let draft=await page.evaluate(()=>OFW_WORKFLOW.readReport('S003'));assert.ok(draft.contentBlocks.every(b=>b.resultMode==='simulation'));assert.ok(draft.workspaceContext.resultMode.label.includes(plan.name));assert.match(await f.locator('[data-report-editor]').innerText(),new RegExp(plan.name));await shot('01-named-simulation-identity');
const pending=page.waitForEvent('download');await f.locator('[data-ofw-report-action=export]').click();await(await pending).saveAs(new URL('named-simulation.html',out).pathname);assert.match(await readFile(new URL('named-simulation.html',out),'utf8'),new RegExp(plan.name));
await f.locator('[data-ofw-report-action=source]').first().click();await page.waitForURL('**#dashboard');await frame();await f.waitForSelector('#global-map[data-map-ready=true]');assert.equal((await state()).activePlanId,plan.id);assert.equal((await state()).horizon,original.evidence.horizon);await shot('02-return-fixed-plan');
await openJoint(original.id);await f.locator('[data-action=review-report]').click();await f.locator('#report-reviewer').fill('财务复核人');await f.locator('#review-note').fill('已核对固定方案和输入；仅冻结本地报告。');await f.locator('#report-review-form [type=submit]').click();assert.equal((await state()).reports.find(r=>r.id===original.id).status,'REVIEWED');
await f.locator('[data-action=revise-report]').click();await f.locator('#report-notes').fill('v2：增加跟踪频率与责任安排。');await f.locator('#report-edit [type=submit]').click();const revision=(await state()).reports[0];assert.equal(revision.parentId,original.id);assert.equal(revision.version,2);assert.equal(revision.evidence.planId,plan.id);await sync();draft=await page.evaluate(()=>OFW_WORKFLOW.readReport('S003'));assert.equal(draft.contentBlocks.length,8);assert.ok(draft.contentBlocks.filter(b=>b.jointReportId===original.id).every(b=>b.text.includes('v1：')));assert.ok(draft.contentBlocks.filter(b=>b.jointReportId===revision.id).every(b=>b.text.includes('v2：')));await shot('03-independent-report-revisions');
await page.reload();await frame();await f.locator('[data-ofw-native-action=report-open]').first().click();assert.equal((await page.evaluate(()=>OFW_WORKFLOW.readReport('S003'))).contentBlocks.length,8);
await writeFile(new URL('draft.json',out),JSON.stringify(draft,null,2));assert.deepEqual(errors,[]);await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks,errors,url:runtime.url},null,2));
}catch(e){await page.screenshot({path:new URL('failure.png',out).pathname});await writeFile(new URL('failure.json',out),JSON.stringify({error:e.stack,checks,errors,body:await f?.locator('body').innerText().catch(()=> 'Frame navigating')},null,2));throw e;}finally{await browser.close();await runtime.close();}
