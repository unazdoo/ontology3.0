import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { start } from '../server.mjs';
const before = process.env.REVIEW_BEFORE === '1';
const out = new URL(`../../../../outputs/fixes-v1.4/logic-format-20260908/${before ? 'before' : 'after'}/`, import.meta.url);
await mkdir(out, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce' });
if (process.env.REVIEW_NO_WEBGL === '1') {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /webgl/i.test(kind) ? null : getContext.call(this, kind, ...args);
    };
  });
}
if (process.env.REVIEW_BUILT === '1') {
  const html = (await readFile(new URL('../dist/workbench.html', import.meta.url), 'utf8')).replaceAll('/assets/', '/dist/assets/');
  await page.route('**/workbench.html?**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
}
page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
const checks = [], errors = [], answers = [];
let f;
page.on('pageerror', error => errors.push(error.message));
async function frame() { await page.waitForTimeout(200); f = await (await page.locator('#module-frame').elementHandle()).contentFrame(); }
const state = () => f.evaluate(() => __OFW_V14__.getState());
async function ask(question) {
  const old = (await state()).queries[0]?.id;
  await f.locator('#question').fill(question);
  await f.locator('#query-form [type=submit]').click({ force: true });
  await f.waitForFunction(old => __OFW_V14__.getState().queries[0]?.id !== old, old, { polling: 100 });
  await f.locator('#question:not([disabled])').waitFor();
  const answer = (await state()).queries[0]; answers.push(answer); return answer;
}
async function shot(name) {
  await writeFile(new URL(name + '.txt', out), await f.locator('body').innerText());
  if (process.env.REVIEW_SCREENSHOTS !== '0') await page.screenshot({ path: new URL(name + '.png', out).pathname, animations: 'disabled', timeout: 60000 });
  checks.push(name); console.log('PASS ' + name);
}
try {
  await page.goto(runtime.url + '/');
  await page.locator('[data-primary-nav][data-route="#dashboard"]').click({ force: true });
  await page.locator('[data-module-task=situation]').click({ force: true });
  await frame(); await f.waitForFunction(() => Boolean(window.__OFW_V14__), null, { polling: 100 });
  const initial = await state();
  const allRows = await f.evaluate(() => __OFW_V14__.getResult().rows);
  const union = allRows.filter(row => row.premium > 0 || row.gap > 0).map(row => row.id);
  assert.equal(union.length, 21); assert.ok(union.includes('ENT-007') && union.includes('ENT-020'));
  const or = await ask('找出高成本或有资金缺口的企业');
  if (!before) {
    assert.equal(or.status, 'failed'); assert.match(or.summary, /暂不支持.*或/);
    const after = await state();
    for (const key of ['filters', 'activePlanId', 'horizon', 'reports', 'tasks', 'plans']) assert.deepEqual(after[key], initial[key], key);
    assert.equal(await f.locator('.answer').first().locator('footer').count(), 0);
  }
  await shot('01-or-condition');
  const and = await ask('找出高成本且有资金缺口的企业');
  assert.equal(and.status, 'success'); assert.equal(and.evidence.objectIds.length, 9);
  if (!before) {
    for (const question of ['找出高成本或者有资金缺口的企业', '找出高成本或有资金缺口且是环保的企业', '找出高成本或缺口企业，如果降息12.5bp', '腾讯的融资余额是多少']) {
      const previous = await state(); assert.equal((await ask(question)).status, 'failed', question);
      for (const key of ['filters', 'activePlanId', 'horizon', 'reports', 'tasks', 'plans']) assert.deepEqual((await state())[key], previous[key], key);
    }
    assert.equal((await ask('ENT-007与ENT-020的融资余额是多少')).evidence.objectIds.length, 2);
    await f.locator('[data-action=reset-filters]').first().click({ force: true });
    assert.equal((await ask('找出高成本企业')).status, 'success');
    assert.equal((await ask('未来90天如果降息12.5bp，授信收缩12.5%，展期30天')).status, 'success');
    await f.locator('[data-action=reset-filters]').first().click({ force: true });
    await ask('找出高成本且有资金缺口的企业');
  }
  const valid = (await state()).queries.find(answer => answer.status === 'success' && answer.question === and.question);
  await f.locator(`[data-action=report-answer][data-id="${valid.id}"]`).click({ force: true });
  const source = (await state()).reports[0];
  await f.locator('#report-title').fill('金额精度复核报告');
  await f.locator('#report-edit [type=submit]').click({ force: true });
  await f.locator('[data-action=native-report]').click({ force: true });
  await page.waitForURL('**#module/report'); await frame();
  await f.locator('[data-ofw-native-action=report-open]').first().click({ force: true }); await f.locator('[data-report-editor]').waitFor();
  const readDraft = () => page.evaluate(() => OFW_WORKFLOW.readReport('S003'));
  const draft = await readDraft();
  const fixedRows = JSON.stringify(draft.contentBlocks.map(block => ({ rows: block.rows, source: block.jointSnapshot })));
  let editValues = await f.locator('[data-report-editor] .report-content-table tr td:nth-child(2)').allTextContents();
  if (!before) {
    assert.ok(editValues.includes('7.161 亿元'));
    assert.ok(editValues.includes('1.408 亿元'));
    assert.ok(editValues.includes('5.838 亿元'));
    assert.ok(editValues.some(value => /^\d+\.\d{4} %$/.test(value)));
    assert.ok(!editValues.some(value => /\.\d{10}/.test(value)));
  }
  await f.locator('[data-report-block]').nth(2).evaluate(element => element.scrollIntoView({ block: "nearest", behavior: "instant" })); await shot('02-formatted-edit');
  await f.locator('[data-ofw-report-action=preview]').click({ force: true });
  const previewValues = await f.locator('[data-report-editor] .report-content-table tr td:nth-child(2)').allTextContents();
  assert.deepEqual(previewValues, editValues);
  const pending = page.waitForEvent('download'); await f.locator('[data-ofw-report-action=export]').click({ force: true });
  await (await pending).saveAs(new URL('report.html', out).pathname);
  const html = await readFile(new URL('report.html', out), 'utf8');
  if (!before) { assert.match(html, /7\.161 亿元/); assert.doesNotMatch(html, /7\.1610000000000005|1\.4080000000000001|5\.837999999999999/); }
  assert.equal(JSON.stringify((await readDraft()).contentBlocks.map(block => ({ rows: block.rows, source: block.jointSnapshot }))), fixedRows);
  assert.deepEqual(draft.contentBlocks[0].jointSnapshot.rows, source.rows);
  await shot('03-preview-and-export');
  if (!before) {
    await f.locator('[data-ofw-report-action=preview]').click({ force: true });
    const firstId = draft.contentBlocks[0].id;
    await f.locator(`[data-report-field=text][data-block-id="${firstId}"]`).fill('人工结论与源数值保持独立。');
    await f.locator(`[data-ofw-report-action=down][data-block-id="${firstId}"]`).click({ force: true });
    assert.equal((await readDraft()).contentBlocks.find(block => block.id === firstId).text, '人工结论与源数值保持独立。');
    for (const [width, height] of [[1280, 720], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      await f.locator('[data-ofw-report-action=export]').evaluate(element => element.scrollIntoView({ block: "nearest", behavior: "instant" }));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot('04-format-' + width);
    }
    await page.setViewportSize({ width: 1440, height: 900 }); await page.reload(); await frame();
    await f.locator('[data-ofw-native-action=report-open]').first().click({ force: true }); await f.locator('[data-report-editor]').waitFor();
    assert.match(await f.locator('[data-report-editor]').innerText(), /7\.161 亿元/);
    assert.equal(JSON.stringify((await readDraft()).contentBlocks.map(block => ({ id: block.id, rows: block.rows })).sort((a,b) => a.id.localeCompare(b.id))), JSON.stringify(draft.contentBlocks.map(block => ({ id: block.id, rows: block.rows })).sort((a,b) => a.id.localeCompare(b.id))));
    await shot('05-refresh');
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('result.json', out), JSON.stringify({ status: before ? 'reproduced' : 'passed', screenshotsEnabled: process.env.REVIEW_SCREENSHOTS !== '0', builtWorkbench: process.env.REVIEW_BUILT === '1', webglUnavailable: process.env.REVIEW_NO_WEBGL === '1', at: new Date().toISOString(), url: runtime.url, checks, answers, union, editValues, previewValues, source, draft, errors }, null, 2));
} catch (error) {
  await writeFile(new URL('failure.json', out), JSON.stringify({ error: error.stack, checks, answers, errors, url: f?.url(), body: await f?.locator('body').innerText({ timeout: 3000 }).catch(() => 'Unavailable frame') }, null, 2));
  throw error;
} finally { await browser.close(); await runtime.close(); }
