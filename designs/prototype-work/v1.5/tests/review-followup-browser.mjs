import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { start } from '../server.mjs';

const before = process.env.REVIEW_BEFORE === '1';
const out = new URL(`../../../../outputs/v1.5-verification/legacy-regressions/followup-20260908/${before ? 'before' : 'after'}/`, import.meta.url);
await mkdir(out, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
page.setDefaultTimeout(30000);
let f;
const errors = [], checks = [], answers = [];
page.on('pageerror', error => errors.push(error.message));
async function frame() {
  await page.waitForTimeout(350);
  f = await (await page.locator('#module-frame').elementHandle()).contentFrame();
  return f;
}
const state = () => f.evaluate(() => __OFW_V14__.getState());
const draft = () => page.evaluate(() => OFW_WORKFLOW.readReport('S003'));
async function shot(name) {
  await page.screenshot({ path: new URL(name + '.png', out).pathname });
  checks.push(name);
  console.log('PASS ' + name);
}
async function ask(question) {
  const old = (await state()).queries[0]?.id;
  await f.locator('#question').fill(question);
  await f.locator('#query-form [type=submit]').click();
  await f.waitForFunction(old => __OFW_V14__.getState().queries[0]?.id !== old, old);
  await f.locator('#question:not([disabled])').waitFor();
  const answer = (await state()).queries[0];
  answers.push(answer);
  return answer;
}
async function saveSource(title, notes) {
  await f.locator('#report-title').fill(title);
  await f.locator('#report-notes').fill(notes);
  await f.locator('#report-edit [type=submit]').click();
  await page.waitForTimeout(200);
}
async function nativeEditor() {
  await f.locator('[data-action=native-report]').click();
  await page.waitForURL('**#module/report');
  await frame();
  await f.locator('[data-ofw-native-action=report-open]').first().click();
  await f.locator('[data-report-editor]').waitFor();
}
async function sourceEditor(id) {
  await page.locator('[data-primary-nav][data-route="#module/report"]').click();
  await page.locator('[data-module-task=joint-reports]').click();
  await frame();
  await f.locator(`[data-action=open-report][data-id="${id}"]`).click();
}
async function exportNative(name) {
  const pending = page.waitForEvent('download');
  await f.locator('[data-ofw-report-action=export]').click();
  await (await pending).saveAs(new URL(name + '.html', out).pathname);
  return readFile(new URL(name + '.html', out), 'utf8');
}
try {
  await page.goto(runtime.url + '/');
  await page.locator('[data-primary-nav][data-route="#dashboard"]').click();
  await page.locator('[data-module-task=situation]').click();
  await frame();
  await f.waitForSelector('#global-map[data-map-ready=true]');
  const questions = [
    '腾讯的融资余额是多少', '中国广核融资余额多少', 'ENT-020与腾讯的融资余额是多少',
    '如果先降息12.5bp再加息25bp，未来90天到期多少？',
    '如果授信收缩12.5%后再收缩20%，未来90天资金缺口多少？',
    '如果展期30天再展期60天，未来90天到期多少？',
  ];
  for (const question of questions) {
    const previous = await state();
    const answer = await ask(question);
    if (!before) {
      assert.equal(answer.status, 'failed', question);
      assert.deepEqual((await state()).filters, previous.filters);
      assert.equal((await state()).activePlanId, previous.activePlanId);
      assert.equal((await state()).horizon, previous.horizon);
      assert.equal(await f.locator('.answer').first().locator('footer').count(), 0);
    }
  }
  await shot('01-subject-and-parameter-boundaries');
  if (!before) {
    for (const question of ['集团融资余额多少', '全部企业的融资余额是多少', '解释ent-020', '单位553融资余额多少']) assert.equal((await ask(question)).status, 'success', question);
    const answer = await ask('未来90天如果降息12.5bp，授信收缩12.5%，展期30天');
    assert.equal(answer.status, 'success');
    await f.locator(`[data-action=scenario-answer][data-id="${answer.id}"]`).click();
    assert.equal(await f.locator('#scenario-rate').inputValue(), '-12.5');
    assert.equal(await f.locator('#scenario-credit').inputValue(), '12.5');
    await shot('02-single-stage-decimals');
    await f.locator('[data-action=right-tab][data-tab=query]').click();
  }
  await f.locator('[data-action=reset-filters]').first().click();
  const result = await ask('找出成本偏离高于25bp的企业');
  await f.locator(`[data-action=report-answer][data-id="${result.id}"]`).click();
  const source = (await state()).reports[0];
  const title = '复审-25bp规则基准报告-改名';
  const notes = '本轮最新结论：这是25bp范围的基准报告。';
  await saveSource(title, notes);
  await nativeEditor();
  const renamed = await draft();
  await writeFile(new URL('renamed-report.json', out), JSON.stringify(renamed, null, 2));
  const html = await exportNative('renamed-report');
  if (!before) {
    assert.ok(renamed.contentBlocks.every(block => block.title.startsWith(title)));
    assert.ok(renamed.contentBlocks.every(block => block.jointSnapshot.title === title && block.jointSnapshot.notes === notes));
    assert.match(html, new RegExp(title));
  }
  await shot('03-source-title-and-snapshot');
  if (!before) {
    const [manualTitle, manualText, deleted] = renamed.contentBlocks;
    await f.locator(`[data-report-field=title][data-block-id="${manualTitle.id}"]`).fill('目标端人工标题');
    await f.locator(`[data-report-field=text][data-block-id="${manualText.id}"]`).fill('目标端人工结论');
    await f.locator(`[data-ofw-report-action=down][data-block-id="${manualTitle.id}"]`).click();
    await f.locator(`[data-ofw-report-action=delete][data-block-id="${deleted.id}"]`).click();
    const ids = (await draft()).contentBlocks.map(block => block.id);
    await sourceEditor(source.id);
    await saveSource('第二次源标题', '第二次源结论');
    await nativeEditor();
    const updated = await draft();
    assert.deepEqual(updated.contentBlocks.map(block => block.id), ids);
    assert.equal(updated.contentBlocks.find(block => block.id === manualTitle.id).title, '目标端人工标题');
    assert.match(updated.contentBlocks.find(block => block.id === manualTitle.id).text, /第二次源结论/);
    assert.equal(updated.contentBlocks.find(block => block.id === manualText.id).text, '目标端人工结论');
    assert.match(updated.contentBlocks.find(block => block.id === manualText.id).title, /第二次源标题/);
    assert.ok(updated.contentBlocks.every(block => block.jointSnapshot.title === '第二次源标题' && block.jointSnapshot.notes === '第二次源结论'));
    await shot('04-per-field-edit-order-deletion-protection');
    const exportHtml = await exportNative('edited-report');
    assert.match(exportHtml, /目标端人工标题/);
    assert.match(exportHtml, /第二次源标题/);
    await f.locator('[data-ofw-report-action=source]').first().click();
    await page.waitForURL('**#dashboard');
    await frame();
    await f.waitForSelector('#global-map[data-map-ready=true]');
    assert.equal((await state()).reports.find(report => report.id === source.id).notes, '第二次源结论');
    await sourceEditor(source.id);
    await f.locator('[data-action=review-report]').click();
    await f.locator('#report-reviewer').fill('本轮复核人');
    await f.locator('#review-note').fill('冻结第一版，下一版单独修订。');
    await f.locator('#report-review-form [type=submit]').click();
    await nativeEditor();
    const frozen = (await draft()).contentBlocks.filter(block => block.jointReportId === source.id);
    await sourceEditor(source.id);
    await f.locator('[data-action=revise-report]').click();
    const revision = (await state()).reports[0];
    await saveSource('独立v2标题', '独立v2结论');
    await nativeEditor();
    assert.deepEqual((await draft()).contentBlocks.filter(block => block.jointReportId === source.id), frozen);
    assert.ok((await draft()).contentBlocks.filter(block => block.jointReportId === revision.id).every(block => block.jointSnapshot.version === 2 && block.title.startsWith('独立v2标题')));
    await shot('05-frozen-v1-independent-v2');
    for (const [width, height] of [[1440, 900], [1280, 720], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await f.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await f.locator('[data-ofw-report-action=export]').scrollIntoViewIfNeeded();
      await shot(`06-report-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    while (await f.locator('[data-ofw-report-action=delete]').count()) await f.locator('[data-ofw-report-action=delete]').first().click();
    await sourceEditor(revision.id);
    await saveSource('全删后源标题', '不能恢复已删除块');
    await nativeEditor();
    assert.equal((await draft()).contentBlocks.length, 0);
    await page.reload();
    await frame();
    assert.equal((await draft()).contentBlocks.length, 0);
    await shot('07-delete-all-and-refresh');
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL('result.json', out), JSON.stringify({ status: before ? 'reproduced' : 'passed', url: runtime.url, at: new Date().toISOString(), checks, answers, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', out).pathname });
  await writeFile(new URL('failure.json', out), JSON.stringify({ error: error.stack, checks, answers, errors, text: await f?.locator('body').innerText().catch(() => 'Frame changed') }, null, 2));
  throw error;
} finally {
  await browser.close();
  await runtime.close();
}
