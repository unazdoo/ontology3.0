import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { start } from '../server.mjs';
const out = new URL('../../../../outputs/v1.5-verification/legacy-regressions/m07-20260909/browser/', import.meta.url);
await mkdir(out, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const profile = await mkdtemp(path.join(tmpdir(), 'm07-fix-browser-'));
const executable = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const processHandle = spawn(executable, ['--headless', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
let browser, page, f;
const checks = [], errors = [], screenshots = [], selections = [];
async function frame() {
  await page.waitForFunction(() => document.querySelector('#module-frame')?.contentDocument?.body?.innerText.length > 30, null, { polling: 100 });
  f = await (await page.locator('#module-frame').elementHandle()).contentFrame();
}
async function click(locator) {
  await locator.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  const box = await locator.boundingBox(); assert.ok(box?.width && box?.height);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function check(name) {
  checks.push(name); console.log('PASS ' + name);
  await writeFile(new URL(name + '.json', out), JSON.stringify({ state: await f.evaluate(() => window.__OFW_M07_DEBUG__?.getState() || null), text: await f.locator('body').innerText() }, null, 2));
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(new URL(name + '.png', out), Buffer.from(result.data, 'base64')); screenshots.push(name);
  } finally { await session.detach(); }
}
async function lens(id) { await click(f.locator(`button[data-lens=${id}]`)); await f.waitForFunction(id => __OFW_M07_DEBUG__.getState().lens === id, id, { polling: 100 }); }
async function metric(predicate) {
  const options = await f.locator('#compare-metric option').evaluateAll(options => options.map(option => ({ id: option.value, text: option.textContent })));
  const chosen = options.find(predicate); assert.ok(chosen, JSON.stringify(options));
  await f.locator('#compare-metric').selectOption(chosen.id);
  return chosen;
}
async function graphClick(id) {
  const node = f.locator(`[data-graph-select="${id}"]`), circle = node.locator(':scope > circle');
  await circle.evaluate(element => element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }));
  const hit = await circle.evaluate(element => { const box = element.getBoundingClientRect(); const x=box.x+box.width/2, y=box.y+box.height/2; return { id: document.elementFromPoint(x,y)?.closest('[data-graph-select]')?.dataset.graphSelect, width: box.width }; });
  assert.equal(hit.id, id); assert.ok(hit.width >= 28, JSON.stringify(hit));
  await click(circle);
  await f.waitForFunction(id => __OFW_M07_DEBUG__.getState().activeId === id, id, { polling: 100 });
  selections.push({ width: page.viewportSize().width, id, hit });
}
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  assert.ok(port); browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', acceptDownloads: true });
  page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(runtime.url + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await click(page.locator('[data-primary-nav][data-route="#module/m07"]')); await frame();
  await f.waitForFunction(() => Boolean(window.__OFW_M07_DEBUG__), null, { polling: 100 });
  await f.locator('#object-search').fill('环保');
  for (const id of ['ENT-020', 'ENT-017']) await click(f.locator(`.result-table [data-select-object="${id}"]`));
  await click(f.locator('#explore-selection'));
  await click(f.locator('.path-object[data-set-active="ENT-020"]'));
  await lens('compare');
  assert.ok(!(await f.locator('#compare-metric option').allTextContents()).some(text => text.includes('规则指标值')));
  await metric(option => option.text.includes('average') || JSON.parse(option.id)[1].endsWith(':averageFinancingCost'));
  assert.match(await f.locator('.bar-comparison').innerText(), /2\.88/); assert.match(await f.locator('.bar-comparison').innerText(), /2\.23/);
  await click(f.locator('[data-compare-chart=dot]')); assert.doesNotMatch(await f.locator('.dot-axis').innerText(), /48\.21/);
  await click(f.locator('[data-compare-chart=radar]')); assert.doesNotMatch(await f.locator('.radar-grid').textContent(), /规则指标值/);
  await check('01-compatible-metrics');
  await lens('temporal');
  await f.locator('#context-time-start').fill('2026-01-01'); await f.locator('#context-time-start').dispatchEvent('change');
  await lens('compare');
  await metric(option => JSON.parse(option.id)[0] === 'property' && JSON.parse(option.id)[1].endsWith(':riskScore'));
  await click(f.locator('[data-compare-chart=bar]'));
  assert.match(await f.locator('.comparison-time-note').innerText(), /2025-12-31.*不受区间筛选影响.*不在所选区间/);
  await metric(option => JSON.parse(option.id)[0] === 'series' && JSON.parse(option.id)[1] === 'm01.property.riskScore');
  assert.match(await f.locator('.comparison-chart').innerText(), /无观测/);
  await check('02-outside-window');
  await click(f.locator('#continue-analysis')); await click(f.locator('[data-navigate-module=report]'));
  await page.waitForURL('**#module/report'); await frame();
  await click(f.locator('[data-ofw-native-action=report-open]').first());
  await f.locator('[data-report-editor]').waitFor({ state: 'attached' });
  const draft = await page.evaluate(() => OFW_WORKFLOW.readReport('S003') || OFW_WORKFLOW.readReport('S001'));
  const block = draft.contentBlocks.find(block => block.sourceModuleId === 'm07'); assert.ok(block);
  assert.ok(!block.rows.some(row => row.name.includes('规则指标值')));
  assert.ok(block.rows.some(row => row.asOf === '2025-12-31' && row.status.includes('不受区间筛选影响')));
  const pending = page.waitForEvent('download'); await click(f.locator('[data-ofw-report-action=export]')); await (await pending).saveAs(new URL('comparison.html', out).pathname);
  const html = await readFile(new URL('comparison.html', out), 'utf8'); assert.match(html, /2025-12-31/); assert.match(html, /不受区间筛选影响/); assert.doesNotMatch(html, /规则指标值/);
  await writeFile(new URL('report-draft.json', out), JSON.stringify(draft, null, 2));
  await click(f.locator('[data-ofw-report-action=source]').first()); await page.waitForURL('**#module/m07'); await frame();
  await f.waitForFunction(() => Boolean(window.__OFW_M07_DEBUG__), null, { polling: 100 });
  await lens('graph');
  for (const [width,height] of [[1440,900],[1280,720],[390,844],[320,844]]) {
    await page.setViewportSize({width,height});
    for (const id of ['financing::s001.loanbook.553', 'financing::s001.owner.001']) await graphClick(id);
    assert.match(await f.locator('.canvas-title p').innerText(), /关系中心：环保测试公司4.*当前节点：负责人001/);
    assert.equal(await f.evaluate(() => __OFW_M07_DEBUG__.getState().graphExpanded[0]), 'ENT-020');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await check('03-node-hit-' + width);
  }
  await page.setViewportSize({width:1440,height:900});
  await click(f.locator('[data-graph-expand="financing::s001.loanbook.553"]'));
  assert.ok(await f.locator('.graph-node').count() >= 9);
  await click(f.locator('#continue-analysis')); assert.match(await f.locator('.handoff-scope-types').innerText(), /多种对象类型/); await check('04-mixed-scope-feedback');
  await click(f.locator('[data-close-drawer]').first());
  await page.locator('[data-module-task=discover][data-module-id=m07]').click({force:true});
  await f.locator('#object-search').fill(''); await click(f.locator('#clear-selection'));
  await f.locator('#object-search').fill('费用');
  for (const id of ['budget::BudgetUnit-001','budget::BudgetUnit-002']) await click(f.locator(`.result-table [data-select-object="${id}"]`));
  await click(f.locator('#explore-selection')); await click(f.locator('.path-object[data-set-active="budget::BudgetUnit-002"]')); await lens('compare');
  await f.locator('#context-time-start').fill('2024-12-31'); await f.locator('#context-time-start').dispatchEvent('change');
  await f.locator('#context-time-end').fill('2025-03-31'); await f.locator('#context-time-end').dispatchEvent('change');
  await metric(option => JSON.parse(option.id)[0] === 'series' && JSON.parse(option.id)[1] === 'm01.property.budget-execution-rate');
  await click(f.locator('[data-compare-chart=bar]'));
  assert.match(await f.locator('.bar-comparison').innerText(), /25\.3/); assert.doesNotMatch(await f.locator('.bar-comparison').innerText(), /105\.4/);
  await check('05-budget-q1');
  await page.reload({waitUntil:'domcontentloaded'}); await frame(); await f.waitForFunction(() => Boolean(window.__OFW_M07_DEBUG__),null,{polling:100});
  assert.match(await f.locator('.bar-comparison').innerText(), /25\.3/); await check('06-refresh-preserves-period');
  assert.deepEqual(errors, []);
  await writeFile(new URL('result.json', out), JSON.stringify({status:'passed',at:new Date().toISOString(),url:runtime.url,checks,screenshots,selections,errors},null,2));
} catch (error) {
  await writeFile(new URL('failure.json', out), JSON.stringify({error:error.stack,checks,errors,selections,text:await f?.locator('body').innerText({timeout:3000}).catch(()=> 'Unavailable')},null,2)); throw error;
} finally {
  await browser?.close(); processHandle.kill('SIGTERM'); await runtime.close(); await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300}).catch(error => console.error('Temporary profile cleanup: ' + error.message));
}
