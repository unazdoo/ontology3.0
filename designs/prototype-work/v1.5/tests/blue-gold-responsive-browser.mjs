import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const out = process.env.OUTPUT_DIR?pathToFileURL(resolve(process.env.OUTPUT_DIR)+'/'):new URL('../../../../outputs/v1.5-verification/glass-refinement-20260919/responsive/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:4596');
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = [], checks = [], geometry = [];
page.on('pageerror', error => errors.push(error.message));
let frame;
async function click(locator) {
  await locator.waitFor({state:'visible'});
  await locator.evaluate(el => el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  await page.waitForTimeout(100);
  const box = await locator.boundingBox();
  assert.ok(box?.width && box?.height);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function ready() {
  await page.waitForTimeout(350);
  await page.waitForFunction(() => document.querySelector('#module-frame')?.dataset.pending === 'false', null, {polling:100});
  frame = await (await page.locator('#module-frame').elementHandle()).contentFrame();
  await frame.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(200);
}
async function snapshot(name, screenshot = true) {
  const shell = await page.evaluate(() => ({width:innerWidth, scrollWidth:document.documentElement.scrollWidth, animations:document.getAnimations().filter(a=>a.playState==='running').length}));
  const content = await frame.evaluate(() => ({width:innerWidth, scrollWidth:document.documentElement.scrollWidth, text:document.body.innerText.length, theme:document.documentElement.dataset.ofwTheme, overflowing:[...document.body.querySelectorAll('*')].filter(el=>{const b=el.getBoundingClientRect();return b.width&&b.left>=0&&b.right>innerWidth+2&&getComputedStyle(el).position!=='fixed';}).slice(0,12).map(el=>({tag:el.tagName,cls:el.className?.baseVal??el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right}))}));
  geometry.push({name,shell,content});
  if (screenshot) { const cd = await context.newCDPSession(page); const image = await cd.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await cd.detach(); await writeFile(new URL(name+'.png',out),Buffer.from(image.data,'base64')); }
  assert.ok(content.text>40, name+' contains business content');
  assert.equal(content.theme,'blue-gold',name+' theme');
  checks.push(name); console.log('PASS '+name);
}
try {
  await page.goto('http://127.0.0.1:4594/');
  for (const module of ['data','ontology','m07','query','decision','agent','report','modeling']) {
    await click(page.locator(`[data-primary-nav][data-route="#module/${module}"]`)); await ready();
    const children = page.locator('.nav-group.expanded .primary-children button');
    const count = await children.count();
    for(let i=0;i<count;i++) { const button=children.nth(i); const label=await button.innerText(); await click(button); await ready(); await snapshot(`secondary-${module}-${i}`, false); checks.push(label.trim()); }
  }
  for(const [width,height] of [[2560,1440],[1440,900],[390,900],[320,900]]) {
    await page.setViewportSize({width,height});
    for (const module of ['data','ontology','m07','query','decision','agent','report','modeling']) {
      await click(page.locator(`[data-primary-nav][data-route="#module/${module}"]`)); await ready();
      if(width<=720 && !await page.locator('.platform-shell').evaluate(el=>el.classList.contains('nav-collapsed'))) {await click(page.locator('.brand-lockup'));await page.waitForTimeout(250);}
      await snapshot(`${width}-${module}`);
    }
  }
  await page.setViewportSize({width:1920,height:1080});
  await click(page.locator('[data-primary-nav][data-route="#module/modeling"]'));await ready();
  const frameNode=await page.locator('#module-frame').elementHandle();
  const before=await page.locator('#module-frame').boundingBox();
  await click(page.locator('.nav-fold-control'));await page.waitForTimeout(250);
  assert.ok((await page.locator('#module-frame').boundingBox()).height>before.height+40);
  assert.ok(await frameNode.evaluate(el=>el===document.querySelector('#module-frame')));
  assert.equal(await page.locator('.global-topbar,[data-glass-action],.nav-foot').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(200);
  assert.equal(await page.locator('.brand-brain .brain-mesh-signal').first().evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(200);
  assert.ok(await page.locator('.brand-brain .brain-mesh-signal').first().evaluate(el=>el.getAnimations().some(a=>a.playState==='running')));
  await snapshot('simplified-chrome-and-accessible-motion');
  assert.deepEqual(errors,[]);
  const overflow=geometry.filter(item=>item.shell.scrollWidth>item.shell.width+1||item.content.scrollWidth>item.content.width+1);
  await writeFile(new URL('result.json',out),JSON.stringify({status:overflow.length?'layout-failures':'passed',checks,errors,overflow,geometry},null,2));
  assert.deepEqual(overflow,[],'all module documents stay within viewport');
} catch(error) {
  await writeFile(new URL('failure.json',out),JSON.stringify({error:error.stack,checks,errors,geometry,body:await frame?.locator('body').innerText().catch(()=>'' )},null,2));throw error;
} finally { await context.close(); await browser.close(); }
