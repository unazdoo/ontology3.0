(function(global){
 'use strict';
 if(global.OFW_BLUE_GOLD)return;
 const media=global.matchMedia('(prefers-reduced-motion: reduce)');
 const animations=new Set();
 const themedSheets=new WeakSet();
 function rgb(value){const h=/^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);if(h){const v=h[1].length===3?[...h[1]].map(c=>c+c).join(''):h[1];return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16));}const m=/^rgba?\(([^)]+)\)$/.exec(value);if(!m)return null;const numbers=m[1].split(/[, /]+/).filter(Boolean).map(Number);return numbers.length===3||numbers[3]>.08?numbers.slice(0,3):null;}
 function recolor(style,selector=''){
  if(/maplibre|mapbox|map-|map_|map\s|province|\.spatial|\.selected-map|\.core-piece|print/i.test(selector))return;
  const background=style.getPropertyValue('background-color').trim(),bg=rgb(background);if(bg&&Math.min(...bg)>185)style.setProperty('background-color','var(--glass-panel-soft)',style.getPropertyPriority('background-color'));
  const gradient=style.getPropertyValue('background-image');if(gradient?.includes('gradient'))style.setProperty('background-image',gradient.replace(/rgba?\([^)]+\)|#[\da-f]{6}\b/gi,match=>{const c=rgb(match);return c&&Math.min(...c)>185?'rgba(21,43,70,.65)':match;}),style.getPropertyPriority('background-image'));
  const value=style.getPropertyValue('color').trim(),color=rgb(value);if(color&&Math.max(...color)<190){const [r,g,b]=color,hi=Math.max(r,g,b),lo=Math.min(r,g,b);let token='--glass-muted';if(hi<75||hi-lo<28&&hi<120)token='--glass-ink';else if(r>g*1.35&&r>b*1.25)token='--glass-red';else if(r>105&&g>80&&b<g*.78)token='--glass-gold';else if(g>r*1.22&&g>b*1.1)token='--glass-green';else if(b>r*1.2)token='--glass-blue';style.setProperty('color',`var(${token})`,style.getPropertyPriority('color'));}
 }
 function normalizeStyles(){
  function rules(list){for(const rule of list){if(rule.conditionText?.includes('print')||rule.media?.mediaText?.includes('print'))continue;if(rule.selectorText&&rule.style)recolor(rule.style,rule.selectorText);if(rule.cssRules)rules(rule.cssRules);}}
  for(const sheet of document.styleSheets){if(themedSheets.has(sheet)||sheet.href?.includes('/blue-gold/')||sheet.ownerNode?.id==='ofw-glass-initial')continue;try{rules(sheet.cssRules);themedSheets.add(sheet);}catch(_){}}
 }
 function apply(doc=document){if(!doc)return;doc.documentElement.dataset.ofwTheme='blue-gold';doc.documentElement.dataset.ofwLowMotion=String(media.matches);doc.documentElement.dataset.ofwPageHidden=String(doc.hidden);if(doc===document)normalizeStyles();}
 function enter(doc=document){if(media.matches||!doc.body)return;const target=doc.querySelector('#decision-hub:not([hidden]),.modern-start,.modern-conversation,.studio-content,.discover-view,.page-scroll,.page-shell,.primary-pane,.ts-workspace,.workbench-surface');if(!target)return;for(const a of animations)a.cancel();animations.clear();const animation=target.animate([{opacity:.6,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.2,.7,.2,1)'});animations.add(animation);animation.finished.then(()=>animations.delete(animation)).catch(()=>animations.delete(animation));}
 apply();
 document.addEventListener('load',event=>{if(event.target.tagName==='LINK')normalizeStyles();},true);
 // Reading an immutable report changes only its embedded screen presentation.
 // Direct HTML/PDF downloads and print media keep the original artifact styling.
 document.addEventListener('load',event=>{if(!event.target.matches?.('iframe.report-document-frame'))return;try{const doc=event.target.contentDocument;if(!doc||doc.getElementById('ofw-report-reading'))return;const link=doc.createElement('link');link.id='ofw-report-reading';link.rel='stylesheet';link.media='screen';link.href='/designs/prototype-work/v1.5/composite/shared/blue-gold/report-reading.css';doc.head.append(link);}catch(_){}},true);
 const cssObserver=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeName==='STYLE'||n.nodeName==='LINK')))normalizeStyles();});cssObserver.observe(document.head,{childList:true});
 media.addEventListener('change',()=>{apply();if(media.matches){for(const a of animations)a.cancel();animations.clear();}});
 document.addEventListener('visibilitychange',()=>{document.documentElement.dataset.ofwPageHidden=String(document.hidden);});
 global.addEventListener('pagehide',()=>{for(const a of animations)a.cancel();animations.clear();cssObserver.disconnect();},{once:true});
 global.OFW_BLUE_GOLD=Object.freeze({apply,enter,preferences:()=>({lowMotion:media.matches})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{apply();},{once:true});else apply();
})(window);
