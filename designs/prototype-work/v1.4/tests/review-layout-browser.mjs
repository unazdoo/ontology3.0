import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {start} from '../server.mjs';
const out=new URL('../../../../outputs/fixes-v1.4/layout-final/',import.meta.url);await mkdir(out,{recursive:true});
const runtime=await start({port:0,staticPort:0,modelingPort:0});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(30000);const checks=[];
try{await page.goto(runtime.url+'/');await page.locator('[data-primary-nav][data-route="#dashboard"]').click();await page.locator('[data-module-task=situation]').click();const f=await(await page.locator('#module-frame').elementHandle()).contentFrame();await f.waitForSelector('#global-map[data-map-ready=true]');
for(const [width,height]of [[1440,900],[1280,720],[390,844],[320,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(350);const values=await f.locator('.metric-cell > strong').evaluateAll(es=>es.map(e=>({text:e.innerText,width:e.clientWidth,scrollWidth:e.scrollWidth})));assert.ok(values.every(e=>e.scrollWidth<=e.width),JSON.stringify(values));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:new URL(`map-${width}.png`,out).pathname});checks.push({width,height,values});}
await writeFile(new URL('result.json',out),JSON.stringify({status:'passed',checks,url:runtime.url},null,2));}finally{await browser.close();await runtime.close();}
