(function installBusinessSourceAsset(global) {
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  function create({doc,win,openDrawer,signal,onLoaded}) {
    let manifest=null,data=null,selected=null,page=0,opened=false;
    const load=async()=>{
      const responses=await Promise.all([fetch('/designs/prototype-work/v1.5/composite/resources/business-source-manifest.json'),fetch('/designs/prototype-work/v1.5/composite/resources/business-source.json')]);
      if(responses.some(r=>!r.ok))throw Error('Business source unavailable');
      manifest=await responses[0].json();const text=await responses[1].text();
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
      const hash=[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==manifest.sha256)throw Error('Business source hash mismatch');
      data=JSON.parse(text);selected='V14-ENTERPRISE';
      if(signal.aborted)return;
      onLoaded();
      if(new URLSearchParams(win.location.search).get('businessSource')==='1'&&!opened){opened=true;const url=new URL(win.location.href);url.searchParams.delete('businessSource');win.history.replaceState(win.history.state,'',url);open();}
    };
    function render(){
      if(!data||signal.aborted)return;
      doc.querySelectorAll('[data-business-source-asset]').forEach(e=>e.remove());
      const table=doc.querySelector('.asset-resource-table tbody'),grid=doc.querySelector('.asset-column .asset-grid');
      if(!table&&!grid)return;
      const count=Object.values(data.records).reduce((n,rows)=>n+rows.length,0);
      const card=doc.createElement(table?'tr':'article');card.dataset.businessSourceAsset='true';
      if(table)card.innerHTML=`<td><strong>${esc(manifest.name)}</strong><small>既有快照的派生投影</small></td><td>${esc(manifest.version)}</td><td>对象目录</td><td>${esc(manifest.asOf)}</td><td>身份与关系已核对</td><td>${manifest.members.length}</td><td>${data.relations.length}</td><td>固定来源</td><td>投影已冻结</td><td><button class="text-link" data-business-source-open>查看详情</button></td>`;
      else {card.className='asset-card';card.innerHTML=`<div><span class="eyebrow">派生数据资产</span><h3>${esc(manifest.name)}</h3><p>${manifest.members.length} 个成员 · ${count} 条记录 · 企业、预算、融资与投资来源可追溯。</p></div><div class="summary-strip"><div class="fact"><span>当前版本</span><strong>${esc(manifest.version)}</strong></div><div class="fact"><span>来源截至</span><strong>逐记录保留原日期</strong></div></div><div class="card-foot"><span class="badge success">投影已冻结</span><button class="text-link" data-business-source-open>查看详情</button></div>`;}
      (table||grid).append(card);
      const countNode=doc.querySelector('.asset-column .resource-column-head h2 em');if(countNode)countNode.textContent=String(Number(countNode.textContent)+1);
    }
    function open(){
      if(!data)return;
      const member=manifest.members.find(m=>m.id===selected)||manifest.members[0];selected=member.id;
      const rows=data.records[selected]||[],size=20,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.max(0,Math.min(page,pages-1));
      const body=`<div><p>由既有原型来源形成的固定对象投影。预算企业归属是用户授权的演示映射，保留原预算金额与加工标识。</p><p>版本：${esc(manifest.version)}</p><label>数据成员 <select data-business-source-member>${manifest.members.map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''}>${esc(m.name)} · ${data.records[m.id].length} 条</option>`).join('')}</select></label><div style="overflow:auto;margin:16px 0"><table class="ofw-native-table"><thead><tr>${member.columns.map(c=>`<th>${esc(c.name)}${c.unit&&c.unit!=='—'?` (${esc(c.unit)})`:''}</th>`).join('')}</tr></thead><tbody>${rows.slice(page*size,(page+1)*size).map(r=>`<tr>${member.columns.map(c=>`<td>${esc(r[c.key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>第 ${page+1}/${pages} 页 · 共 ${rows.length} 条</p><div><button class="ofw-native-action" data-business-source-page="-1" ${page===0?'disabled':''}>上一页</button><button class="ofw-native-action" data-business-source-page="1" ${page===pages-1?'disabled':''}>下一页</button></div><details><summary>来源与完整性</summary><p>SHA-256：${esc(manifest.sha256)}</p>${Object.values(data.sources).map(s=>`<p><a href="/${esc(s.path)}" target="_blank" rel="noopener">${esc(s.path.split('/').at(-1))}</a><br>${esc(s.sha256)}</p>`).join('')}</details></div>`;
      openDrawer('企业业务全景来源投影','数据工程 · 固定来源与记录',body,`<a class="ofw-native-action primary" href="${esc(manifest.sourceUrl)}" download="enterprise-business-source.json">下载完整来源 JSON</a>`);
    }
    doc.addEventListener('click',event=>{if(event.target.closest('[data-business-source-open]'))open();const button=event.target.closest('[data-business-source-page]');if(button){page+=Number(button.dataset.businessSourcePage);open();}},{signal});
    doc.addEventListener('change',event=>{if(event.target.matches('[data-business-source-member]')){selected=event.target.value;page=0;open();}},{signal});
    void load().catch(error=>{if(!signal.aborted)console.error(error);});
    return {render};
  }
  global.OFW_BUSINESS_SOURCE_ASSET=Object.freeze({create});
})(window);
