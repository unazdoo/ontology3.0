import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { startCandidate } from '/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/start-candidate.mjs';

const require = createRequire('/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const { chromium } = require('playwright');
const out = '/tmp/ofw-ux-audit-20260905/v131';
await mkdir(out, { recursive: true });
const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push({ kind: 'pageerror', route: page.url(), message: e.message }));
page.on('console', m => { if (m.type() === 'error') errors.push({ kind: 'console', route: page.url(), message: m.text() }); });
const routes = ['home', 'data', 'ontology', 'query', 'decision', 'agent', 'report', 'm07', 'modeling', 'dashboard'];
const summary = [];

function inspect() {
  const visible = el => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const controls = [...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')].filter(visible);
  const facts = el => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, id: el.id, class: String(el.className).slice(0, 100), text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 110), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), value: el.value, disabled: !!el.disabled };
  };
  return {
    title: document.title, url: location.href, width: innerWidth, height: innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    text: document.body.innerText,
    headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map(el => el.innerText),
    controls: controls.map(facts),
    scrollRegions: [...document.querySelectorAll('*')].filter(el => visible(el) && el.clientHeight > 60 && el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)).map(facts),
    clippedControls: controls.filter(el => { const r = el.getBoundingClientRect(); return r.width < 12 || r.height < 12 || r.right > innerWidth + 2 || r.left < -2; }).map(facts)
  };
}

try {
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      const hash = route === 'home' ? '#home' : route === 'dashboard' ? '#dashboard' : `#module/${route}`;
      await page.goto(runtime.entryUrl.replace('#home', hash), { waitUntil: 'networkidle' });
      let frame;
      let inner = null;
      if (route !== 'home') {
        await page.waitForTimeout(1800);
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            frame = await (await page.locator('#module-frame').elementHandle()).contentFrame();
            await frame.waitForFunction(() => document.body?.innerText.length > 30);
            inner = await frame.evaluate(inspect);
            break;
          } catch (error) {
            if (attempt === 4) throw error;
            await page.waitForTimeout(600);
          }
        }
      }
      const shell = await page.evaluate(inspect);
      const key = `${viewport.width}-${route}`;
      await page.screenshot({path:`${out}/${key}.png`});
      await writeFile(`${out}/${key}.json`, JSON.stringify({shell, inner}, null, 2));
      summary.push({ key, headings: inner?.headings.slice(0, 6) || shell.headings, shellOverflow: shell.scrollWidth > viewport.width + 1, frameOverflow: inner ? inner.scrollWidth > inner.width + 1 : false, clippedControls: inner?.clippedControls.slice(0, 8), textLength: inner?.text.length || shell.text.length });
      console.log(JSON.stringify(summary.at(-1)));
    }
  }
} finally {
  await writeFile(`${out}/summary.json`, JSON.stringify({summary,errors}, null, 2));
  await browser.close();
  await runtime.close();
}
