import {readFile} from 'node:fs/promises';

// Version-local presentation changes; the frozen module remains the functional baseline.
export async function presentOntology(native) {
  const view=await readFile(new URL('../composite/ontology/published-workspace.js',import.meta.url),'utf8');
  const replace=(from,to)=>{if(!native.includes(from))throw Error('Ontology presentation boundary changed: '+from.slice(0,80));native=native.replace(from,to);};
  const start=native.indexOf('  function renderPublishedVersion() {'),end=native.indexOf('  function renderVersionTab(version, tab)',start);
  if(start<0||end<0)throw Error('Ontology version view boundary changed');
  native=native.slice(0,start)+view+'\n'+native.slice(end);
  native=native.replaceAll('go(`published/version?id=${id}&tab=overview`)','go(`published/version?id=${id}&tab=canvas`)');
  replace('btn("查看详情", `open-version:${detailVersion.id}`','btn("查看画布", `open-version:${detailVersion.id}`');
  replace('<article class="published-ontology-card">','<article class="published-ontology-card" data-action="open-version:${detailVersion.id}">');
  replace('<h2>${esc(lead.name)}</h2>','<h2><button class="ontology-card-open" data-action="open-version:${detailVersion.id}">${esc(lead.name)}</button></h2>');
  replace('if (tab === "canvas") return renderPublishedCanvas(version);','if (tab === "canvas") return `<div class="published-explorer">${renderPublishedCanvas(version)}${renderPublishedInspector(version)}</div>`;');
  replace('function renderPublishedCanvas(version) {',`function renderPublishedCanvas(version) {
    if(ui.publishedFitVersion!==version.id){ui.publishedFitVersion=version.id;ui.publishedCanvasZoom=Math.max(.2,Math.min(.85,(innerWidth-390)/WORLD.width,(innerHeight-260)/WORLD.height));}`);
  native=native.replaceAll('data-node="${esc(node.id)}"','data-node="${esc(node.id)}" data-selected="${route()===\'published/version\'&&ui.publishedSelection===node.id}"');
  replace('if (action.startsWith("open-published-resource:")) {',`if (action === "published-clear-selection") { ui.publishedSelection=null;return render(); }
    if (action === "published-resource-details") { const version=selectedVersion(); return go(\`published/resource?version=\${version.id}&id=\${encodeURIComponent(ui.publishedSelection)}&tab=overview&from=canvas\`); }
    if (action === "published-fit") { const scroll=document.querySelector('.published-canvas-scroll');if(scroll){ui.publishedCanvasZoom=Math.max(.2,Math.min(1,(scroll.clientWidth-48)/WORLD.width,(scroll.clientHeight-48)/WORLD.height));applyPublishedCanvasZoom();scroll.scrollLeft=0;scroll.scrollTop=0;}return; }
    if (action.startsWith("open-published-resource:") && routeParams().get("tab")==="canvas") { ui.publishedSelection=action.split(":").slice(2).join(":");const scroll=document.querySelector('.published-canvas-scroll');const position={x:scroll?.scrollLeft||0,y:scroll?.scrollTop||0};render();const restored=document.querySelector('.published-canvas-scroll');if(restored){restored.scrollLeft=position.x;restored.scrollTop=position.y;}return; }
    if (action.startsWith("open-published-resource:")) {`);
  replace('btn("返回资源与模型", `open-version-tab:${version.id}:resources`)', 'btn(routeParams().get("from")==="canvas" ? "返回本体画布" : "返回资源与模型", `open-version-tab:${version.id}:${routeParams().get("from")==="canvas" ? "canvas" : "resources"}`)');
  replace('go(`published/resource?version=${version.id}&id=${encodeURIComponent(id)}&tab=${action.split(":")[1]}`)', 'go(`published/resource?version=${version.id}&id=${encodeURIComponent(id)}&tab=${action.split(":")[1]}&from=${routeParams().get("from")||""}`)');
  replace('if (event.target.id === "published-version-select") {',`if(event.target.id === "ontology-workspace-version"){ const version=state.publishedVersions.find(item=>item.id===event.target.value); if(version){activateScenarioForVersion(version);ui.publishedSelection=null;persist();go(\`published/version?id=\${encodeURIComponent(version.id)}&tab=\${routeParams().get('tab')||'canvas'}\`);}return; }
    if (event.target.id === "published-version-select") {`);
  native=native.replaceAll('Math.max(.5, Math.min(1, Number(ui.publishedCanvasZoom || .72)))','Math.max(.2, Math.min(1, Number(ui.publishedCanvasZoom || .72)))').replaceAll('Math.max(.5, ui.publishedCanvasZoom - .1)','Math.max(.2, ui.publishedCanvasZoom - .1)');
  replace('<button data-action="published-canvas-zoom:reset">恢复比例</button>','<button data-action="published-fit">适应画布</button><button data-action="published-canvas-zoom:reset">恢复比例</button>');
  return native;
}
