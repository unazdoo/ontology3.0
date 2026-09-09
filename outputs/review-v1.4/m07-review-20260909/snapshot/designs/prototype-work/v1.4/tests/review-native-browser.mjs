import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {start} from '../server.mjs';
const out=new URL('../../../../outputs/fixes-v1.4/native/',import.meta.url);await mkdir(out,{recursive:true});
const runtime=await start({port:0,staticPort:0,modelingPort:0});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});page.setDefaultTimeout(20000);
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));let f;
async function frame(){f=await(await page.locator('#module-frame').elementHandle()).contentFrame();return f;}
async function go(route){await page.locator(`[data-primary-nav][data-route="${route}"]`).click();await frame();}
async function shot(name){await page.screenshot({path:new URL(name+'.png',out).pathname});await writeFile(new URL(name+'.txt',out),await f.locator('body').innerText());checks.push(name);console.log('PASS '+name);}
async function recommend(text){await f.locator('.modern-question-grid > button:visible').filter({hasText:text}).first().click();await f.getByText('查看回答详情',{exact:true}).first().waitFor();}
async function newQuery(){await go('#module/query');await page.locator('[data-module-id=query][data-module-task=ask]').click();await page.waitForTimeout(400);await frame();if(await f.getByRole('button',{name:'返回问数工作台',exact:true}).count())await f.getByRole('button',{name:'返回问数工作台',exact:true}).click();if(await f.getByRole('button',{name:'新会话',exact:true}).count())await f.getByRole('button',{name:'新会话',exact:true}).first().click();await f.locator('.modern-start').waitFor();}
try{
await page.goto(runtime.url+'/');
await go('#dashboard');await page.locator('[data-module-task=post-investment]').click();await frame();await f.locator('[data-ofw-native-action=dashboard-open]').click();
assert.match(await f.locator('.ofw-native-dashboard-summary').innerText(),/演示基准.*合成(?:演示|示例)/);assert.doesNotMatch(await f.locator('.ofw-native-dashboard-summary').innerText(),/正式事实/);assert.equal(await f.locator('.ofw-native-query-row').filter({hasText:'无法评价'}).count(),4);await shot('01-synthetic-baseline-no-fact-scores');
await newQuery();await recommend('集团当前融资余额和平均融资成本');
assert.match(await f.locator('.modern-answer-card').innerText(),/21,613\.387/);assert.match(await f.locator('.modern-answer-card').innerText(),/2\.372231/);await shot('02-group-answer-balance-and-cost');
await f.getByText('查看回答详情',{exact:true}).click();await f.locator('.modern-detail-tabs').waitFor();
await writeFile(new URL('group-detail-controls.json',out),JSON.stringify(await f.locator('button').allTextContents(),null,2));
const pending=page.waitForEvent('download');await f.getByRole('button',{name:/导出/}).first().click();const download=await pending;await download.saveAs(new URL('group-query.csv',out).pathname);const csv=await readFile(new URL('group-query.csv',out),'utf8');assert.match(csv,/21613\.387|21,613\.387/);assert.match(csv,/2\.372231/);await shot('03-group-detail-export');
await newQuery();await recommend('2025年三个部门');
await f.getByRole('button',{name:'带入探索',exact:true}).click();await page.waitForURL('**#module/m07');await frame();await f.locator('#result-title').filter({hasText:'来源范围未映射'}).waitFor();assert.match(await f.locator('#result-count').innerText(),/0 个结果/);await shot('04-budget-explorer-explicit-unmapped');
const budgetContext=await page.evaluate(()=>OFW_V131_STORE.workspaceContext());assert.equal(budgetContext.scenarioId,'S002');assert.equal(budgetContext.objectSetRef.objectIds.length,3);
await page.reload();await frame();await f.locator('#result-title').filter({hasText:'来源范围未映射'}).waitFor();await f.locator('#clear-selection').click();await f.locator('#result-title').filter({hasText:'全部对象'}).waitFor();await shot('05-unmapped-reload-and-recovery');
await newQuery();await f.locator('.modern-question-grid > button:visible').filter({hasText:'哪些借款主体需要优先人工复核'}).first().click();await f.locator('#ofw-native-query-answer .modern-answer-card').waitFor();assert.doesNotMatch(await f.locator('#ofw-native-query-answer').innerText(),/成功|0 条正式结果|设备管理部|InvestmentProduct/);await shot('06-preloan-explicit-no-data');
const history=await page.evaluate(()=>OFW_WORKFLOW.readQueryHistory());const latest=history[0];assert.equal(latest.scenarioId,'S004');assert.ok(!JSON.stringify(latest.workspaceContext).includes('dept-'));assert.ok(!JSON.stringify(latest.workspaceContext).includes('InvestmentProduct'));
await go('#module/modeling');await f.locator('[data-enter-target=S005]').click();await f.locator('.workspace-input').waitFor();assert.doesNotMatch(await f.locator('.workspace-input').innerText(),/设备管理部/);await shot('07-post-model-compatible-target');
await page.locator('[data-module-task=objectives][data-module-id=modeling]').click();await f.locator('[data-enter-target=S003]').click();await f.locator('.workspace-input').waitFor();assert.doesNotMatch(await f.locator('.workspace-input').innerText(),/设备管理部/);await shot('08-risk-model-compatible-target');
assert.deepEqual(errors,[]);await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks,errors,url:runtime.url,history,budgetContext},null,2));
}catch(e){await page.screenshot({path:new URL('failure.png',out).pathname});await writeFile(new URL('failure.json',out),JSON.stringify({error:e.stack,checks,errors,body:await f?.locator('body').innerText()},null,2));throw e;}finally{await browser.close();await runtime.close();}
