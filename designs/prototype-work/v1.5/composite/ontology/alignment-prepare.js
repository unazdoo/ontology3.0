(async function prepareBusinessRevision(global) {
  'use strict';
  if (new URLSearchParams(location.search).get('schemaPrepare') !== '1') return;
  const preparation = await fetch('../resources/business-preparation.json').then(response => response.json());
  const previous = global.ontologyReview.dataAssetDeliveryReceipt(preparation.delivery.deliveryId);
  if (previous?.status === 'rejected') {
    const delivery = preparation.delivery;
    delivery.retryOf = delivery.deliveryId;
    delivery.previousDeliveryId = delivery.retryOf;
    delivery.attemptNumber = 2;
    delivery.deliveryId = `${delivery.deliverySeriesId}-A2`;
    delete delivery.payloadFingerprint;
    const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    const text = JSON.stringify(canonical(delivery));
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    delivery.payloadFingerprint = `C003-PF-${(hash >>> 0).toString(16).padStart(8, '0').toUpperCase()}-${text.length}`;
  }
  const receipt = global.ontologyReview.deliverDataAsset(preparation.delivery);
  global.__OFW_BUSINESS_PREPARATION__ = { receipt };
  if (receipt.status !== 'accepted') return;
  const key = 'ontology3-canvas-first-review-v17';
  const state = JSON.parse(localStorage.getItem(key));
  const draft = state.drafts.find(item => item.id === receipt.targetDraftId);
  if (!draft || draft.publishedVersionId || draft.businessAlignmentPrepared) return;
  Object.assign(draft, structuredClone(preparation.blueprint), {
    draftName: '企业业务全景对象修订', businessAlignmentPrepared: true,
    draftRevision: Number(draft.draftRevision || 0) + 1,
    validation: { status: 'idle', checkedAt: null, issues: [] },
    sourceDataContract: structuredClone(receipt.sourceDataContract),
  });
  for (const resource of [...draft.objects, ...draft.objects.flatMap(object => object.properties), ...draft.links, ...draft.metrics, ...draft.rules, ...draft.actions]) {
    resource.publicationState = 'Draft';
    resource.lifecycleState = 'Draft';
    resource.status = 'Draft';
    resource.owner = '本体管理';
  }
  state.activeDraftId = draft.id;
  localStorage.setItem(key, JSON.stringify(state));
  const next = new URL(location.href);
  next.searchParams.delete('schemaPrepare');
  next.hash = `modeling/workbench?draft=${encodeURIComponent(draft.id)}`;
  location.replace(next.href);
})(window);
