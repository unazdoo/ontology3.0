(function migrateDecisionDataIdentity(global) {
  'use strict';
  const key = global.OFW_DECISION_PORTFOLIO.storageKey;
  const style = document.createElement('style');
  style.textContent = '.detail-page .page-header{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.detail-page .page-heading{width:100%}.detail-page .page-actions{width:100%;max-width:100%;flex-wrap:wrap;justify-content:flex-start}.detail-page .page-title-line>div{min-width:0;flex:1}.detail-page .page-title-line>.dc-icon-btn{flex:none}';
  document.head.append(style);
  const state = JSON.parse(localStorage.getItem(key));
  let changed = false;
  for (const request of state.requests || []) {
    const evidence = request.evidence;
    if (request.scenarioContext?.scenarioId !== 'S003' || !evidence?.dataAssetId || !/^S003-T007-/.test(evidence.dataAssetId) || evidence.dataVersion === evidence.dataAssetId) continue;
    // Only migrate the known legacy version-number field; conflicting full identities still fail the gate.
    if (!/^\d+\.\d+\.\d+$/.test(evidence.dataVersion)) continue;
    request.evidence = {...evidence, declaredDataVersion: evidence.dataVersion, dataVersion: evidence.dataAssetId};
    request.dataVersion = evidence.dataAssetId;
    request.dataIdentityMigration = {from:evidence.dataVersion,to:evidence.dataAssetId,at:new Date().toISOString(),reason:'Separate source version number from exact T007 asset identity'};
    changed = true;
  }
  if (changed) localStorage.setItem(key,JSON.stringify({...state,stateRevision:state.stateRevision+1}));
})(window);
