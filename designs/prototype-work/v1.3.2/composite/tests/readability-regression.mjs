import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startCandidate } from "../start-candidate.mjs";

const { chromium } = createRequire(import.meta.url)("playwright");
const output = fileURLToPath(new URL("../evidence/readability/", import.meta.url));
await mkdir(output, { recursive: true });
const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const results = [], errors = [];
const journeys = [
  ["data", "resources"], ["data", "pipelines"], ["data", "runs"],
  ["ontology", "published"], ["ontology", "modeling"],
  ["query", "ask"], ["query", "history"], ["query", "settings"],
  ["decision", "workbench"], ["decision", "todos"],
  ["agent", "agents"], ["agent", "resources"], ["agent", "orchestrations"],
  ["report", "catalog"], ["report", "create"], ["report", "definitions"],
  ["m07", "discover"], ["m07", "explore"],
  ["modeling", "objectives"], ["modeling", "models"], ["modeling", "compare"], ["modeling", "observe"], ["modeling", "release"],
  ["dashboard", "directory"], ["dashboard", "financing"], ["dashboard", "budget"], ["dashboard", "risk"], ["dashboard", "preloan"], ["dashboard", "post-investment"]
];

async function scrollToRealBottom(page, frame, moduleId) {
  const regions = await frame.evaluate(() => {
    const root = document.documentElement;
    const docScrolls = /auto|scroll/.test(getComputedStyle(root).overflowY) && root.scrollHeight > innerHeight + 3;
    const selected = docScrolls ? [document.body] : [...document.querySelectorAll('main,section,div,aside')].filter((element) => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      if (!/auto|scroll/.test(style.overflowY) || element.scrollHeight <= element.clientHeight + 3 || rect.width < 140 || rect.height < 100 || rect.bottom <= 0 || rect.top >= innerHeight) return false;
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 3) return false;
      }
      return true;
    });
    return selected.map((element, index) => {
      element.dataset.scrollAudit = String(index);
      const marker = document.createElement('div');
      marker.dataset.scrollEnd = String(index);
      marker.style.cssText = 'display:block;height:1px;min-height:1px;width:1px;flex:0 0 1px;grid-column:1/-1;pointer-events:none';
      element.appendChild(marker);
      return { index, document: docScrolls, name: element.id || element.className || element.tagName };
    });
  });
  const checks = [];
  const frameBox = await page.locator('#module-frame').boundingBox();
  for (const region of regions) {
    const scroller = frame.locator(`[data-scroll-audit="${region.index}"]`);
    const bounds = await scroller.evaluate((node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, viewport: innerHeight }; });
    if (!region.document) assert.ok(bounds.y >= -1 && bounds.y + bounds.height <= bounds.viewport + 1, `${moduleId}: ${region.name} extends outside the iframe`);
    const x = frameBox.x + Math.min(frameBox.width - 5, bounds.x + bounds.width - 5);
    const y = frameBox.y + Math.min(frameBox.height - 20, Math.max(20, bounds.y + Math.min(bounds.height / 2, 180)));
    await page.mouse.move(x, y);
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.mouse.wheel(0, 10000);
      await page.waitForTimeout(120);
    }
    const end = await frame.locator(`[data-scroll-end="${region.index}"]`).evaluate((node) => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, viewport: innerHeight }));
    assert.ok(end.bottom <= end.viewport + 1 && end.bottom >= 0, `${moduleId}: cannot reach bottom of ${region.name}: ${JSON.stringify(end)}`);
    checks.push({ region: region.name, bottom: end.bottom, viewport: end.viewport });
  }
  await frame.evaluate(() => document.querySelectorAll('[data-scroll-end]').forEach((node) => node.remove()));
  return checks;
}

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(8000);
    page.on('pageerror', (error) => errors.push({ width: viewport.width, message: error.message }));
    await page.goto(runtime.entryUrl);
    assert.equal(await page.locator('#workspace-context-chip,#workspace-context-slot').count(), 0);
    if (viewport.width <= 620) {
      await page.waitForFunction(() => [...document.querySelectorAll('.nav-label')].every((node) => getComputedStyle(node).display === 'none'));
      assert.equal(await page.locator('.nav-label-short:visible').count(), 10);
    }
    try {
      await page.mouse.move(viewport.width - 8, viewport.height - 80);
      await page.mouse.wheel(0, 10000);
      await page.waitForTimeout(200);
      const home = await page.locator('.home-view').boundingBox();
      const last = await page.locator('.home-capability-entry').last().boundingBox();
      const footer = await page.locator('.home-capability-panel > footer').boundingBox();
      assert.ok(last.y + last.height <= home.y + home.height + 1, 'last homepage entry must be reachable');
      assert.ok(footer.y >= last.y + last.height - 1, 'homepage footer must not cover entries');
      assert.ok(footer.y + footer.height <= home.y + home.height + 1, 'homepage footer must be reachable');
      await page.screenshot({ path: path.join(output, `${viewport.width}-home-bottom.png`) });
      results.push({ name: `${viewport.width}-home`, status: 'passed' }); console.log(`PASS ${viewport.width}-home`);
    } catch (error) {
      results.push({ name: `${viewport.width}-home`, status: 'failed', error: error.message }); console.error(`FAIL ${viewport.width}-home: ${error.message}`);
    }
    for (const [moduleId, task] of journeys) {
      const name = `${viewport.width}-${moduleId}-${task}`;
      try {
        const route = moduleId === 'dashboard' ? '#dashboard' : `#module/${moduleId}`;
        await page.locator(`[data-primary-nav][data-route="${route}"]`).click();
        const frame = await (await page.locator('#module-frame').elementHandle()).contentFrame();
        await frame.waitForFunction(() => document.body?.innerText.length > 30 && document.documentElement.dataset.ofwModule);
        if (viewport.width <= 620) await page.locator(`[data-module-task-select="${moduleId}"]`).selectOption(task);
        else await page.locator(`[data-module-id="${moduleId}"][data-module-task="${task}"]`).click();
        await frame.waitForTimeout(500);
        const metrics = await frame.evaluate(() => {
          const app = document.querySelector('body > #app,body > #root,body > #model-center');
          const r = app?.getBoundingClientRect();
          const leaves = [...document.querySelectorAll('p,span,small,td,th,label,button,input,select')].filter((node) => node.getClientRects().length && node.textContent.trim() && !node.childElementCount && getComputedStyle(node).visibility !== 'hidden');
          const fonts = leaves.map((node) => ({ size: Number.parseFloat(getComputedStyle(node).fontSize), text: node.textContent.trim().slice(0, 30) }));
          return { viewport: innerHeight, top: r?.top, bottom: r?.bottom, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, tiny: fonts.filter((item) => item.size > 0 && item.size < 12), contextBars: document.querySelectorAll('[data-ofw-workspace-context],[data-workspace-context]').length };
        });
        assert.equal(metrics.contextBars, 0, 'generic context strips must be removed');
        assert.equal(metrics.tiny.length, 0, `small text: ${JSON.stringify(metrics.tiny.slice(0, 5))}`);
        assert.ok(metrics.scrollWidth <= metrics.width + 1, `horizontal overflow ${JSON.stringify(metrics)}`);
        if (['data', 'ontology', 'query', 'decision', 'agent', 'm07'].includes(moduleId) && task !== 'todos') {
          assert.ok(metrics.top >= -1 && metrics.bottom <= metrics.viewport + 1, `root is clipped ${JSON.stringify(metrics)}`);
        }
        const scrolling = await scrollToRealBottom(page, frame, moduleId);
        if (['resources','published','ask','agents','catalog','discover','release'].includes(task)) await page.screenshot({ path: path.join(output, `${name}-bottom.png`) });
        results.push({ name, status: 'passed', scrolling }); console.log(`PASS ${name}`);
      } catch (error) {
        results.push({ name, status: 'failed', error: error.message }); console.error(`FAIL ${name}: ${error.message}`);
        await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {});
      }
    }
    await context.close();
  }
} finally {
  await browser.close(); await runtime.close();
  const result = { version: 'v1.3.2-rc.1', observedAt: new Date().toISOString(), results, errors, passed: results.filter((item) => item.status === 'passed').length, failed: results.filter((item) => item.status === 'failed').length };
  await writeFile(path.join(output, 'regression.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ passed: result.passed, failed: result.failed, errors }, null, 2));
  if (result.failed || errors.length) process.exitCode = 1;
}
