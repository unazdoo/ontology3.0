import { chromium } from '../../designs/prototype-work/v1.4/node_modules/playwright/index.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const out = new URL('./', import.meta.url);
await mkdir(new URL('before/', out), {recursive:true});
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const logs=[];
try {
  await page.goto('http://127.0.0.1:55336/');
  await page.getByRole('button',{name:'经营驾驶舱',exact:true}).click();
  await page.locator('[data-module-task=situation]').click();
  const f=await (await page.locator('#module-frame').elementHandle()).contentFrame();
  await f.waitForSelector('#global-map[data-map-ready=true]');
  for(const q of ['不存在的Review企业融资余额多少','华南环保集团融资余额多少','未来90天如果降息12.5bp，授信收缩12.5%，展期30天']) {
    await f.locator('#question').fill(q);
    await f.locator('#query-form [type=submit]').click();
    await f.waitForFunction(()=>__OFW_V14__.getState().queries[0]?.status);
    await f.waitForTimeout(900);
    logs.push(await f.evaluate(()=>__OFW_V14__.getState().queries[0]));
  }
  await page.screenshot({path:new URL('before/query-boundaries.png',out).pathname});
  const files=['src/domain.js','src/app.js','composite/shared/workflow.js','composite/integrations/joint-workbench.js','composite/integrations/native-module-integrations.js'];
  const hashes={};
  for(const file of files) hashes[file]=createHash('sha256').update(await readFile(new URL('../../designs/prototype-work/v1.4/'+file,out))).digest('hex');
  await writeFile(new URL('before/baseline.json',out),JSON.stringify({at:new Date().toISOString(),cwd:process.cwd(),branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),status:execFileSync('git',['status','--short'],{encoding:'utf8'}),hashes,queries:logs},null,2));
}finally{await browser.close();}
