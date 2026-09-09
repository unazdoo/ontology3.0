import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {start} from '../server.mjs';

const output=new URL('../artifacts/home-presentation/',import.meta.url);await mkdir(output,{recursive:true});
const runtime=await start({port:0,staticPort:0,modelingPort:0});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[],results=[];
let page;
try{
 for(const [width,height] of [[1920,1080],[1440,900],[1280,633],[1024,768],[768,1024],[620,900],[390,844],[320,740]]){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(runtime.url);await page.waitForSelector('.architecture-node');
  assert.equal(await page.locator('.architecture-intro h1').innerText(),'从可信数据到可追溯决策');
  assert.equal(await page.locator('.global-nav').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(23, 36, 53)');
  assert.equal(await page.locator('.nav-item.active').evaluate(node=>getComputedStyle(node).backgroundColor),width<=620?'rgb(34, 54, 75)':'rgb(41, 61, 84)');
  let positions;
  for(const domain of ['foundation','intelligence','action']){
   await page.locator(`.architecture-node[data-domain="${domain}"]`).click();
   await page.mouse.move(width-3,10);
   const check=await page.evaluate(()=>{
    const failures=[],nodes=[...document.querySelectorAll('.architecture-node')],rectangles=[];
    for(const node of nodes){
     const b=node.getBoundingClientRect(),cx=b.x+b.width/2,cy=b.y+b.height/2,r=b.width/2;
     rectangles.push({domain:node.dataset.domain,x:b.x,y:b.y,width:b.width,height:b.height});
     for(const label of node.querySelectorAll('.node-en,.node-zh,.node-scope')){
      if(!label.getClientRects().length)failures.push(`${node.dataset.domain}: hidden ${label.className}`);
      const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())for(let i=0;i<walker.currentNode.textContent.length;i++){
       if(!walker.currentNode.textContent[i].trim())continue;
       const range=document.createRange();range.setStart(walker.currentNode,i);range.setEnd(walker.currentNode,i+1);
       for(const rect of range.getClientRects())for(const x of [rect.left,rect.right])for(const y of [rect.top,rect.bottom])if(Math.hypot(x-cx,y-cy)>r-1)failures.push(`${node.dataset.domain}: clipped ${walker.currentNode.textContent[i]} at ${Math.hypot(x-cx,y-cy).toFixed(1)} / ${r}`);
      }
     }
    }
    for(let i=0;i<rectangles.length;i++)for(let j=i+1;j<rectangles.length;j++){const a=rectangles[i],b=rectangles[j];if(Math.hypot(a.x+a.width/2-b.x-b.width/2,a.y+a.height/2-b.y-b.height/2)<(a.width+b.width)/2)failures.push('overlapping circles');}
    for(const label of document.querySelectorAll('.classic-core > b,.classic-core > span')){
     const range=document.createRange();range.selectNodeContents(label);
     for(const text of range.getClientRects())for(const node of rectangles){const cx=node.x+node.width/2,cy=node.y+node.height/2,nearestX=Math.max(text.left,Math.min(cx,text.right)),nearestY=Math.max(text.top,Math.min(cy,text.bottom));if(Math.hypot(nearestX-cx,nearestY-cy)<node.width/2)failures.push(`center text obscured by ${node.domain}`);}
    }
    const stage=document.querySelector('.home-view'),stageBox=stage.getBoundingClientRect();
    return {failures,rectangles:rectangles.map(rect=>({...rect,x:rect.x-stageBox.x,y:rect.y-stageBox.y+stage.scrollTop})),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.deepEqual(check.failures,[],`${width} ${domain}: circle text clipping`);assert.equal(check.overflow,false);
   if(positions)assert.deepEqual(check.rectangles,positions,`${width}: domain switch moved circles`);positions=check.rectangles;
  }
  await page.locator('.home-view').evaluate(node=>node.scrollTop=0);
  await page.screenshot({path:fileURLToPath(new URL(`home-${width}.png`,output))});
  await page.locator('.home-view').evaluate(node=>node.scrollTop=node.scrollHeight);
  await page.locator('.home-capability-list').evaluate(node=>node.scrollTop=node.scrollHeight);
  const footer=await page.locator('.home-capability-panel > footer').boundingBox(),stage=await page.locator('.home-view').boundingBox();assert.ok(footer.y+footer.height<=stage.y+stage.height+1,`${width}: footer is unreachable`);
  if(width>620){await page.locator('[data-action="toggle-navigation"]').click();assert.equal(await page.locator('.architecture-node').count(),3);assert.equal(await page.locator('.global-nav').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(23, 36, 53)');}
  results.push({width,height,domains:3,textFullyVisible:true,menuBlue:true,footerReachable:true});console.log(`PASS ${width}x${height}`);await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('result.json',output),JSON.stringify({status:'passed',results,errors,completedAt:new Date().toISOString()},null,2));await rm(new URL('failure.png',output),{force:true});
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:fileURLToPath(new URL('failure.png',output))});throw error;}finally{await browser.close();await runtime.close();}
