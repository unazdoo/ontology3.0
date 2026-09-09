import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { startCandidate } from '/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite/start-candidate.mjs';
const require = createRequire('/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const { chromium } = require('playwright');
const out = '/tmp/ofw-ux-audit-20260905/v131';
const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await context.newPage();
const evidence = {};
const errors = [];
page.on('pageerror', e => errors.push(e.message));
async function enter(route) {
  const hash = route === 'dashboard' ? '#dashboard' : `#module/${route}`;
  await page.goto(runtime.entryUrl.replace('#home', hash), {waitUntil:'networkidle'});
  return frame();
}
async function frame() {
  await page.waitForTimeout(1200);
  for (let i=0;i<5;i++) {
    try {
      const f=await (await page.locator('#module-frame').elementHandle()).contentFrame();
      await f.waitForFunction(()=>document.body?.innerText.length>30);
      return f;
    } catch(e) { if(i===4) throw e; await page.waitForTimeout(500); }
  }
}
async function nav(route) {
  await page.locator(`.primary-nav [data-route="${route === 'dashboard' ? '#dashboard' : '#module/'+route}"]`).click();
  return frame();
}
async function probe(name, operation) {
  try { evidence[name]=await operation(); }
  catch(error) { evidence[name]={error:error.message}; }
  console.log(name,JSON.stringify(evidence[name]));
}
try {
  await probe('model-target-return',async()=>{
    let f=await enter('modeling');
    await f.locator('[data-enter-target="S003"]').click();
    await page.waitForTimeout(500);
    const before=await f.locator('h1').innerText();
    const stateBefore=await page.evaluate(()=>window.OFW_V120_STORE.get());
    await nav('query');
    f=await nav('modeling');
    const after=await f.locator('h1').innerText();
    return {before,after,activeScenario:stateBefore.activeScenarioId,comparison:stateBefore.workspaceContext.comparisonRef};
  });
  await probe('query-draft-return',async()=>{
    let f=await enter('query');
    await f.locator('textarea').fill('请分析当前对象在所选期间的成本变化');
    const before=await f.locator('textarea').inputValue();
    await nav('ontology');
    f=await nav('query');
    return {before,after:await f.locator('textarea').inputValue()};
  });
  await probe('decision-control-reachability',async()=>{
    const checks=[];
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});
      const f=await enter('decision');
      const btn=f.getByRole('button',{name:'查看详情',exact:true}).first();
      const geometry=await btn.evaluate(el=>{
        const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height,right:r.right});
        const parents=[];
        for(let p=el;p;p=p.parentElement){const s=getComputedStyle(p);if(p.scrollWidth>p.clientWidth+2||s.overflowX==='hidden')parents.push({tag:p.tagName,class:p.className,rect:rect(p.getBoundingClientRect()),client:p.clientWidth,scroll:p.scrollWidth,overflowX:s.overflowX});}
        return {width:innerWidth,button:rect(el.getBoundingClientRect()),parents};
      });
      const click=await btn.click({timeout:2200}).then(()=>true).catch(e=>e.message.split('\n')[0]);
      checks.push({width,geometry,click});
      await page.screenshot({path:`${out}/decision-reachability-${width}.png`});
    }
    return checks;
  });
  await page.setViewportSize({width:1440,height:900});
  await probe('m07-null-comparison',async()=>{
    const f=await enter('m07');
    await f.locator('[data-open-object="financing::s001.entity.553"]:visible').click({timeout:3000});
    await f.locator('[data-lens="compare"]').click();
    await page.waitForTimeout(400);
    return {text:await f.locator('#canvas-stage').innerText(),options:await f.locator('#compare-metric').innerText()};
  });
  await probe('m07-save-filter-restore',async()=>{
    await context.clearCookies();
    let f=await enter('m07');
    await f.locator('[data-route="discover"]:visible').first().click();
    await f.locator('#object-search').fill('环保');
    await f.locator('#explore-selection').click();
    const before=await f.evaluate(()=>window.__OFW_M07_DEBUG__.getContext());
    await f.locator('#save-exploration').click();
    await f.locator('#exploration-name').fill('环保筛选复现');
    await f.locator('#save-dialog button[value="default"]').click();
    await f.locator('[data-route="discover"]:visible').first().click();
    await f.locator('#object-search').fill('银行');
    await f.locator('[data-open-saved]').filter({hasText:'环保筛选复现'}).click();
    const after=await f.evaluate(()=>({context:window.__OFW_M07_DEBUG__.getContext(),state:window.__OFW_M07_DEBUG__.getState()}));
    await page.screenshot({path:`${out}/saved-exploration-wrong-scope.png`});
    return {before,after};
  });
  await probe('report-formal-context-without-candidate',async()=>{
    const f=await enter('report');
    await f.locator('[data-ofw-native-action="report-add-context"]').last().click();
    return {text:await f.locator('#ofw-native-drawer-root').innerText(),stored:await f.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.includes('report-draft')).map(k=>[k,localStorage.getItem(k)])))};
  });
  await probe('service-failure-feedback',async()=>{
    await page.route(`${runtime.modelingUrl}/**`,route=>route.abort('failed'));
    const f=await enter('modeling');
    return {shell:await page.locator('.nav-foot').innerText(),content:await f.locator('body').innerText()};
  });
} finally {
  await writeFile(`${out}/flows.json`,JSON.stringify({evidence,errors},null,2));
  await browser.close();
  await runtime.close();
}
