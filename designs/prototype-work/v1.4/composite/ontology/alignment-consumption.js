(function showBusinessConsumer(global) {
  'use strict';
  const release = global.OFW_M01_BUSINESS_RELEASE;
  if (!release?.version) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  let scheduled = false;
  let focusedNode = null;
  function render() {
    scheduled = false;
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const focus = params.get('focus');
    if (focus && params.get('id') === release.version.id && params.get('tab') === 'canvas') {
      const node = [...document.querySelectorAll('.canvas-node[data-node]')].find(node => node.dataset.node === focus);
      if (node && node !== focusedNode) { focusedNode = node; node.style.outline = '4px solid #2878bd'; node.scrollIntoView({block:'center',inline:'center',behavior:'instant'}); }
    }
    if (params.get('version') !== release.version.id && params.get('id') !== release.version.id) return;
    const page = document.querySelector('.page-scroll.published-version, .page-scroll.resource-detail');
    if (!page || page.querySelector('[data-business-consumption]')) return;
    let receipt;
    try { receipt = JSON.parse(localStorage.getItem('ofw.m07.ontology-binding.v1') || 'null'); } catch (_) {}
    const verified = receipt?.status === 'validated' && receipt.semanticVersionId === release.version.id && receipt.dataVersionId === release.version.dataContract.assetVersion && receipt.sourceHash === release.sourceContract.sourceFingerprint.value;
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.dataset.businessConsumption = 'true';
    panel.innerHTML = `<div class="panel-head"><div><h2>业务全景对象绑定</h2><p>M07按本精确版本读取固定数据投影，核对对象身份、属性及关系。</p></div><span>${verified ? '类型与来源核对通过' : '等待业务全景读取验证'}</span></div><p>${escape(release.version.semanticVersion)} · ${release.version.objects.length} 类对象 · ${release.version.links.length} 类关系${verified ? ` · ${receipt.instances} 个记录实例` : ''}</p><p>统一企业为主目录；预算部门和明细从企业下探，持仓按台账范围内的产品汇总。集团汇总与临时产品组合采用视图或对象集。</p><p><button class="btn" data-open-business-source>在数据工程查看来源记录</button></p><p>此处为业务全景的目录读取绑定；下方正式数据启用状态属于问数与模型的消费组合。原融资问数、审批及已固定报告继续沿用各自来源版本。</p>`;
    panel.querySelector('[data-open-business-source]').addEventListener('click',()=>global.parent.postMessage({operation:'open-business-source',assetId:'V14-ENTERPRISE-VIEW'},location.origin));
    const anchor = page.querySelector('.panel');
    if (anchor) anchor.before(panel); else page.append(panel);
  }
  const observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; setTimeout(render, 0); } });
  observer.observe(document.getElementById('app'), {childList:true,subtree:true});
  render();
})(window);
