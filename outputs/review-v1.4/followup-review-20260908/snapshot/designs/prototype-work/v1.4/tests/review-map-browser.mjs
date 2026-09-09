import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {start} from '../server.mjs';
const out=new URL('../../../../outputs/fixes-v1.4/map-report/',import.meta.url);await mkdir(out,{recursive:true});
const runtime=await start({port:0,staticPort:0,modelingPort:0});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});page.setDefaultTimeout(20000);
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));let f;
async function frame(){f=await(await page.locator('#module-frame').elementHandle()).contentFrame();return f;}
const state=()=>f.evaluate(()=>__OFW_V14__.getState());
async function shot(name){await page.screenshot({path:new URL(name+'.png',out).pathname});checks.push(name);console.log('PASS '+name);}
async function ask(question){const before=(await state()).queries[0]?.id;await f.locator('#question').fill(question);await f.locator('#query-form [type=submit]').click();await f.waitForFunction(before=>__OFW_V14__.getState().queries[0]?.id!==before,before);await f.locator('#question:not([disabled])').waitFor();return (await state()).queries[0];}
async function download(locator,name){const pending=page.waitForEvent('download');await locator.click();const d=await pending;const path=new URL(name,out).pathname;await d.saveAs(path);return readFile(path,'utf8');}
try{
await page.goto(runtime.url+'/');await page.locator('[data-primary-nav][data-route="#dashboard"]').click();await page.locator('[data-module-task=situation]').click();await frame();await f.waitForSelector('#global-map[data-map-ready=true]');
const first=await ask('找出高成本且有资金缺口的企业');assert.equal(first.status,'success');assert.equal(first.evidence.objectIds.length,9);
for(const q of ['不存在的Review企业融资余额多少','华南环保集团融资余额多少','ENT-020和ENT-999融资余额多少']){
  const before=JSON.stringify((await state()).filters);const a=await ask(q);assert.equal(a.status,'failed');assert.match(a.summary,/主体未登记/);assert.equal(JSON.stringify((await state()).filters),before);assert.equal(await f.locator('.answer').first().locator('footer').count(),0);
}
await shot('01-unknown-subjects-rejected');
const decimal=await ask('未来90天如果降息12.5bp，授信收缩12.5%，展期30天');assert.equal(decimal.status,'success');
await f.locator(`[data-action=scenario-answer][data-id="${decimal.id}"]`).click();
assert.equal(await f.locator('#scenario-rate').inputValue(),'-12.5');assert.equal(await f.locator('#scenario-credit').inputValue(),'12.5');
await f.locator('#scenario-name').fill('小数降息与授信收缩方案');await f.locator('#scenario-form [type=submit]').click();
assert.equal((await state()).plans[0].parameters.rateBps,-12.5);assert.equal((await state()).plans[0].parameters.creditHaircut,12.5);
await shot('02-decimal-plan-applied');
await f.locator('[data-action=right-tab][data-tab=query]').click();
for(const q of ['如果降息-5bp','如果收缩101%','如果降息12.55bp'])assert.equal((await ask(q)).status,'failed');
await f.locator('#question').fill('未来30天到期多少');await f.locator('#query-form [type=submit]').click();await f.locator('[data-action=cancel-query]').click({force:true});assert.equal((await state()).queries[0].status,'cancelled');
while((await state()).queries.length<30){const n=(await state()).queries.length;await ask(n%2?'未来30天到期多少':'未来90天到期多少');}
while(await f.locator('[data-action=query-history-more]').count())await f.locator('[data-action=query-history-more]').click();
assert.equal(await f.locator('.answer').count(),30);assert.ok(await f.locator(`[data-action=apply-answer][data-id="${first.id}"]`).isVisible());await shot('03-thirty-query-history');
await page.reload();await frame();await f.waitForSelector('#global-map[data-map-ready=true]');while(await f.locator('[data-action=query-history-more]').count())await f.locator('[data-action=query-history-more]').click();
assert.equal(await f.locator('.answer').count(),30);
await f.locator(`[data-action=apply-answer][data-id="${first.id}"]`).click();let s=await state();assert.equal(s.activePlanId,null);assert.equal(s.horizon,first.horizon);assert.deepEqual(s.filters.objectIds,first.evidence.objectIds);
await f.locator(`[data-action=report-answer][data-id="${first.id}"]`).click();await f.locator('#report-title').fill('旧答案基准报告');await f.locator('#report-edit [type=submit]').click();s=await state();const baseline=s.reports[0];assert.equal(baseline.evidence.planId,null);assert.equal(baseline.evidence.resultKind,'DEMO_BASELINE');
const html=await download(f.locator('[data-action=export-report]'),'baseline-report.html');assert.match(html,/演示基准/);assert.doesNotMatch(html,/暂无%/);
await f.locator('[data-action=native-report]').click();await page.waitForURL('**#module/report');await frame();await f.locator('[data-ofw-native-action=report-open]').first().click();await f.locator('[data-report-editor]').waitFor();
let draft=await page.evaluate(()=>OFW_WORKFLOW.readReport('S003'));assert.ok(draft.contentBlocks.every(b=>b.resultMode==='demo'));assert.equal(draft.workspaceContext.objectSet.count,9);
const edited=draft.contentBlocks[0].id,deleted=draft.contentBlocks[2].id;
await f.locator(`[data-report-field=text][data-block-id="${edited}"]`).fill('人工复核意见：保留这段文字及调整后的顺序。');await f.locator(`[data-ofw-report-action=down][data-block-id="${edited}"]`).click();await f.locator(`[data-ofw-report-action=delete][data-block-id="${deleted}"]`).click();
draft=await page.evaluate(()=>OFW_WORKFLOW.readReport('S003'));const order=draft.contentBlocks.map(b=>b.id);
const nativeHtml=await download(f.locator('[data-ofw-report-action=export]'),'native-baseline-edited.html');assert.match(nativeHtml,/演示基准/);assert.match(nativeHtml,/人工复核意见/);assert.doesNotMatch(nativeHtml,/压力模拟/);
await shot('04-edited-baseline-report');
await f.locator('[data-ofw-report-action=source]').first().click();await page.waitForURL('**#dashboard');await frame();await f.waitForSelector('#global-map[data-map-ready=true]');
await page.locator('[data-primary-nav][data-route="#module/report"]').click();await page.locator('[data-module-task=joint-reports]').click();await frame();await f.locator(`[data-action=open-report][data-id="${baseline.id}"]`).click();await f.locator('[data-action=native-report]').click();await frame();
draft=await page.evaluate(()=>OFW_WORKFLOW.readReport('S003'));assert.deepEqual(draft.contentBlocks.map(b=>b.id),order);assert.equal(draft.contentBlocks.find(b=>b.id===edited).text,'人工复核意见：保留这段文字及调整后的顺序。');assert.ok(!draft.contentBlocks.some(b=>b.id===deleted));await shot('05-repeat-sync-preserves-edit-order-deletion');
await page.locator('[data-primary-nav][data-route="#dashboard"]').click();await page.locator('[data-module-task=situation]').click();await frame();await f.waitForSelector('#global-map[data-map-ready=true]');
await f.locator('#entity-search').fill('没有该检索对象');await f.locator('#entity-search').dispatchEvent('input');await f.waitForFunction(()=>__OFW_V14__.getResult().rows.length===0);assert.match(await f.locator('#metric-strip').innerText(),/暂无数据/);assert.doesNotMatch(await f.locator('body').innerText(),/暂无%|NaN/);await shot('06-empty-cost');
await f.locator('[data-action=reset-filters]').first().click();assert.match(await f.locator('#metric-strip').innerText(),/2\.46%/);
for(const [width,height]of [[1440,900],[1280,720],[390,844],[320,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(`07-layout-${width}`);}
await writeFile(new URL('state.json',out),JSON.stringify(await state(),null,2));assert.deepEqual(errors,[]);await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks,errors,url:runtime.url},null,2));
}catch(e){await page.screenshot({path:new URL('failure.png',out).pathname});await writeFile(new URL('failure.json',out),JSON.stringify({error:e.stack,checks,errors,body:await f?.locator('body').innerText()},null,2));throw e;}finally{await browser.close();await runtime.close();}
