import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
const out=new URL('../../../../outputs/v1.5-verification/legacy-regressions/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
try{
await page.goto('http://127.0.0.1:55789/');
await page.locator('[data-primary-nav][data-route="#module/decision"]').click();
let f=await (await page.locator('#module-frame').elementHandle()).contentFrame();
await f.waitForFunction(()=>document.body.innerText.includes('环保测试公司2'));
await f.locator('tr').filter({hasText:'环保测试公司2'}).getByRole('button',{name:'查看详情',exact:true}).click();
await f.getByRole('button',{name:'确认并交办',exact:true}).click();
await writeFile(new URL('probe-decision.txt',out),await f.locator('body').innerText());
await writeFile(new URL('probe-controls.json',out),JSON.stringify(await f.locator('button,input,select,textarea').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:e.innerText,label:e.getAttribute('aria-label'),type:e.type,placeholder:e.placeholder}))),null,2));
await page.screenshot({path:new URL('probe-decision.png',out).pathname});
}finally{await browser.close();}
