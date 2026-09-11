(function loadBusinessRelease(global) {
  'use strict';
  const release = global.OFW_M01_BUSINESS_RELEASE;
  if (!release?.version || !global.OFW_M01_PORTFOLIO_STATE) return;
  const state = global.OFW_M01_PORTFOLIO_STATE;
  if (!state.publishedVersions.some(version => version.id === release.version.id)) {
    state.publishedVersions.push(structuredClone(release.version));
    state.recordsByVersion[release.version.id] = structuredClone(release.records);
  }
  if (release.publishedDraft && !state.drafts.some(draft => draft.id === release.publishedDraft.id)) state.drafts.push(structuredClone(release.publishedDraft));
  const source = release.sourceContract;
  const key = `${source.assetId}::${source.assetVersion}`;
  state.externalDataAssets[key] ||= structuredClone(source);
  state.dataAssetDeliveryReceipts[source.deliveryId] ||= structuredClone(release.receipt);
  state.dataAssetDeliveryFingerprints[source.deliveryId] ||= release.version.sourceDeliveryFingerprint;
  localStorage.setItem('ontology3-canvas-first-review-v17', JSON.stringify(state));
})(window);
