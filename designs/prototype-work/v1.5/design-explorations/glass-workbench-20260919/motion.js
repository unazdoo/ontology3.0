/* Finite, task-linked motion. No animation loop, polling, or business-state mutation. */
(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const root=document.getElementById('app'),caption=document.createElement('div');caption.id='motion-caption';caption.hidden=true;caption.setAttribute('role','status');document.body.append(caption);
  let animations=new Set(),timeouts=new Set(),previous=null,lastCamera=null,replaying=false;
  const duration={a:520,b:620,c:430},easing='cubic-bezier(.18,.72,.2,1)';
  const state=()=>window.__DESIGN_REVIEW__?.read();
  const reduced=()=>media.matches||state()?.reducedMotion;
  function animate(element,keyframes,options={}){
    if(!element||reduced())return null;
    const animation=element.animate(keyframes,{duration:duration[state()?.variant||'a'],easing,fill:'none',...options});animations.add(animation);root.dataset.activeMotion=String(animations.size);
    animation.finished.then(()=>{animations.delete(animation);root.dataset.activeMotion=String(animations.size);}).catch(()=>{animations.delete(animation);root.dataset.activeMotion=String(animations.size);});return animation;
  }
  function later(fn,ms){const id=setTimeout(()=>{timeouts.delete(id);fn();},ms);timeouts.add(id);return id;}
  function stop(){for(const a of animations)a.cancel();animations.clear();for(const id of timeouts)clearTimeout(id);timeouts.clear();caption.hidden=true;replaying=false;root.dataset.activeMotion='0';}
  function surfaces(){return [...root.querySelectorAll('.query-layout>.query-history,.query-layout>.query-center,.query-layout>.query-evidence,.map-layout>.entity-panel,.map-layout>.map-canvas,.map-layout>.object-panel,.decision-layout>.case-list,.decision-layout>.case-detail,.ontology-layout>.resource-panel,.ontology-layout>.graph-panel,.ontology-layout>.property-panel')].filter(e=>e.getBoundingClientRect().width>0);}
  function enter(){
    if(reduced())return;
    animate(root.querySelector('.page-heading'),[{opacity:.4,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:380});
    surfaces().forEach((el,i)=>animate(el,[{opacity:.18,transform:`translateY(${state().variant==='b'?22:14}px)`},{opacity:1,transform:'translateY(0)'}],{delay:i*55}));
    const selected=root.querySelector('.side-nav button.active');animate(selected,[{boxShadow:'inset 0 0 0 1px transparent'},{boxShadow:'inset 0 0 0 1px rgba(210,231,251,.24)'},{boxShadow:'inset 0 0 0 1px transparent'}],{duration:560});
  }
  function camera(){
    const world=root.querySelector('.map-world');if(!world){lastCamera=null;return;}
    const s=state(),point=s.selected&&window.REVIEW_DATA.enterprises.find(e=>e.id===s.selected)?.point;
    const z=s.zoom,dx=point?(500-point[0])*.13:0,dy=point?(350-point[1])*.13:0;
    const target=`translate(${500-500*z+dx}px,${320-320*z+dy}px) scale(${z})`;
    world.removeAttribute('transform');world.style.transformOrigin='0 0';world.style.transform=target;
    if(lastCamera&&lastCamera!==target)animate(world,[{transform:lastCamera},{transform:target}],{duration:replaying?850:650});
    lastCamera=target;
  }
  function connections(){if(reduced())return;for(const line of root.querySelectorAll('.map-edge:not(.guarantee),.onto-edge:not(.dashed)')){
    const length=line.getTotalLength?.()||200;animate(line,[{strokeDasharray:`${length} ${length}`,strokeDashoffset:length,opacity:.15},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0,opacity:.75}],{duration:720});
  }}
  function onRender(){const now=state();const changed=!previous||now.page!==previous.page||now.variant!==previous.variant;const selected=previous&&(now.selected!==previous.selected||now.caseId!==previous.caseId||now.node!==previous.node);stop();
    if(changed)enter();else if(selected){const info=root.querySelector(now.page==='map'?'.object-panel':now.page==='decision'?'.case-detail':'.property-panel');animate(info,[{opacity:.35,transform:'translateX(9px)'},{opacity:1,transform:'translateX(0)'}],{duration:340});}
    camera();if(changed||selected||JSON.stringify(now.relations)!==JSON.stringify(previous?.relations))connections();previous=now;
  }
  function drawer(){if(reduced())return;animate(document.getElementById('drawer'),[{opacity:.3,transform:'translateX(32px)'},{opacity:1,transform:'translateX(0)'}],{duration:310});}
  function replay(){stop();if(reduced()){caption.textContent='低动效已开启：保留状态反馈，省略位移与描线。';caption.hidden=false;later(()=>caption.hidden=true,2200);return;}
    replaying=true;caption.textContent='① 玻璃面板依次进入';caption.hidden=false;enter();
    later(()=>{caption.textContent=state().page==='map'?'② 视角平滑聚焦，关联路径一次呈现':state().page==='ontology'?'② 业务依赖一次描绘，选中资源轻量突出':'② 关键结论与依据轻量突出';
      if(state().page==='map'){const world=root.querySelector('.map-world');if(world){const target=world.style.transform;animate(world,[{transform:target},{transform:target+' translate(-18px,6px) scale(1.04)'},{transform:target}],{duration:1200});}connections();}
      else if(state().page==='ontology'){connections();animate(root.querySelector('.onto-node.active'),[{opacity:.65},{opacity:1}],{duration:420});}
      else animate(root.querySelector(state().page==='query'?'.risk-stats':'.basis-card'),[{boxShadow:'inset 0 0 0 1px transparent'},{boxShadow:'inset 0 0 0 1px rgba(229,212,167,.43)'},{boxShadow:'inset 0 0 0 1px transparent'}],{duration:950});
    },650);
    later(()=>{caption.textContent='③ 动效已结束，画面静止；所有业务状态保持不变。';},1900);later(()=>{caption.hidden=true;replaying=false;},3200);
  }
  document.addEventListener('glass-rendered',onRender);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});media.addEventListener('change',()=>{if(media.matches)stop();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')stop();});
  window.GLASS_MOTION={replay,drawer,stop,read:()=>({active:animations.size,scheduled:timeouts.size,replaying,reduced:reduced()})};
  onRender();
})();
