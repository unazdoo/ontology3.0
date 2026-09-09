import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { start } from '../server.mjs';
const before = process.env.NAV_BEFORE === '1';
const out = new URL(`../../../../outputs/fixes-v1.4/navigation-paint/${before ? 'before' : 'after'}/`, import.meta.url);
await mkdir(out, { recursive: true });
const runtime = await start({ port: 0, staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const samples = [], errors = [], checks = [];
await context.exposeBinding('__recordNavigationPaint', ({ frame }, value) => samples.push({ url: frame.url(), ...value }));
await context.addInitScript(() => {
  if (self === top) return;
  const selectors = '.platform-rail,.product-nav,.app-rail,.module-nav,.center-nav,.center-mobile-select,.global-nav';
  document.addEventListener('DOMContentLoaded', () => {
    const slowImage = document.createElement('img');
    slowImage.hidden = true;
    slowImage.src = '/__navigation-paint-hold.svg';
    document.body.append(slowImage);
  });
  let first = true, previous = '';
  function sample() {
    const visible = [...document.querySelectorAll(selectors)].filter(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }).map(element => ({ selector: element.className, text: element.textContent.trim().slice(0, 80) }));
    if (document.body?.innerText.trim().length > 20) {
      const key = JSON.stringify(visible);
      if (first || previous !== key) window.__recordNavigationPaint({ first, readyState: document.readyState, visible, time: performance.now() });
      previous = key; first = false;
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
});
// Simulate a slow noncritical resource: navigation must be correct before window.load.
await context.route(/\.(?:png|svg|jpg)(?:\?|$)/, async route => {
  await new Promise(resolve => setTimeout(resolve, 700));
  await route.continue();
});
await context.route('**/__navigation-paint-hold.svg', async route => {
  await new Promise(resolve => setTimeout(resolve, 1200));
  await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
});
const page = await context.newPage();
page.setDefaultTimeout(30000);
page.on('pageerror', error => errors.push(error.message));
async function frame() { return (await page.locator('#module-frame').elementHandle()).contentFrame(); }
async function go(id) {
  const oldCount = samples.length;
  await page.locator(`[data-primary-nav][data-route="${id === 'dashboard' ? '#dashboard' : '#module/' + id}"]`).click();
  const f = await frame();
  await f.waitForFunction(() => document.body?.innerText.trim().length > 80);
  await f.waitForLoadState('load');
  await page.waitForTimeout(180);
  checks.push({ id, width: page.viewportSize().width, frameUrl: f.url(), samples: samples.slice(oldCount) });
  return f;
}
try {
  await page.goto(runtime.url + '/');
  for (const id of ['data', 'ontology', 'query', 'decision', 'agent', 'report', 'm07', 'modeling', 'dashboard']) await go(id);
  await page.screenshot({ path: new URL('desktop.png', out).pathname });
  if (!before) {
    for (const [width, height] of [[1280, 720], [390, 844], [320, 844]]) {
      await page.setViewportSize({ width, height });
      for (const id of ['query', 'modeling', 'dashboard']) {
        // Primary navigation uses the overflow sheet on narrow screens.
        const nav = page.locator(`[data-primary-nav][data-route="${id === 'dashboard' ? '#dashboard' : '#module/' + id}"]`);
        if (!await nav.isVisible()) {
          await page.getByRole('button', { name: /更多模块|展开主导航|打开导航/ }).first().click();
        }
        await go(id);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: new URL(`width-${width}.png`, out).pathname });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await go('query');
    const f = await frame();
    const navCount = samples.length;
    await page.locator('[data-module-id=query][data-module-task=semantics]').click();
    await f.waitForFunction(() => location.hash.includes('semantics'));
    await page.locator('[data-module-id=query][data-module-task=ask]').click();
    await f.waitForFunction(() => location.hash.includes('ask'));
    await page.reload();
    await (await frame()).waitForLoadState('load');
    await page.goBack();
    await page.waitForTimeout(400);
    checks.push({ id: 'subnav-refresh-back', samples: samples.slice(navCount) });
    assert.equal(samples.filter(sample => sample.visible.length).length, 0, JSON.stringify(samples.filter(sample => sample.visible.length), null, 2));
    assert.ok(samples.length >= 9);
    assert.deepEqual(errors, []);
    // Standalone professional pages retain their own navigation.
    const standalone = await context.newPage();
    await standalone.goto(runtime.url + '/designs/prototype-work/v1.4/composite/model-center/index.html?apiBase=' + encodeURIComponent(runtime.url + '/model-api'));
    await standalone.locator('.center-nav').waitFor({ state: 'visible' });
    await standalone.close();
  }
  await writeFile(new URL('result.json', out), JSON.stringify({ status: before ? 'observed' : 'passed', at: new Date().toISOString(), runtime: runtime.url, checks, samples, flashes: samples.filter(sample => sample.visible.length), errors }, null, 2));
  console.log(JSON.stringify({ samples: samples.length, flashes: samples.filter(sample => sample.visible.length).length, checks: checks.length }));
} catch (error) {
  await page.screenshot({ path: new URL('failure.png', out).pathname });
  await writeFile(new URL('failure.json', out), JSON.stringify({ error: error.stack, samples, errors, checks }, null, 2));
  throw error;
} finally { await browser.close(); await runtime.close(); }
