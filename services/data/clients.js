'use strict';

/* Provider-facing clients for the M02 cross-module contracts. */

const crypto = require('node:crypto');
const {
  DataContractError,
  clone,
  deepFreeze,
  stableSerialize,
  idFor,
  assertContext,
  assertActiveContext,
  requireContextMatch,
  sameRunContext,
  validateAssetVersion,
  validateDelivery,
  createReadEvent,
  assertNoForbiddenKeys,
  C032_STATES,
  C028_STATES,
  C029_STATES,
  DELIVERY_STATES,
  T007_S003_COMPATIBILITY_STATUS
} = require('./contracts');

function nowIso(clock) {
  const value = typeof clock === 'function' ? clock() : new Date().toISOString();
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new DataContractError('INVALID_TIME', 'clock must return an RFC3339 timestamp');
  return value;
}

function invoke(provider, names, payload) {
  if (typeof provider === 'function') return provider(payload);
  if (provider && typeof provider === 'object') {
    for (const name of names) if (typeof provider[name] === 'function') return provider[name](payload);
  }
  throw new DataContractError('PROVIDER_UNAVAILABLE', `provider does not implement ${names.join(' or ')}`);
}

function optionsStrict(value) { return value === true; }

class C001Client {
  constructor(runtime) {
    if (!runtime || typeof runtime.registerSource !== 'function') throw new DataContractError('RUNTIME_UNAVAILABLE', 'C001Client requires an M02 runtime');
    this.runtime = runtime;
  }
  register(input) { return this.runtime.registerSource(input); }
  get(sourceId) { return this.runtime.getSource(sourceId); }
}

class C002Client {
  constructor(runtime) {
    if (!runtime || typeof runtime.createSnapshot !== 'function') throw new DataContractError('RUNTIME_UNAVAILABLE', 'C002Client requires an M02 runtime');
    this.runtime = runtime;
  }
  capture(input) { return this.runtime.createSnapshot(input); }
  confirmAsOf(snapshotId, input) { return this.runtime.confirmAsOf(snapshotId, input); }
  readAsOf(snapshotId, input) { return this.runtime.readT008(snapshotId, input); }
  get(snapshotId) { return this.runtime.getSnapshot(snapshotId); }
}

function digest(value) {
  return crypto.createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');
}

function assertExactReceipt(receipt, delivery) {
  if (!receipt || typeof receipt !== 'object') throw new DataContractError('INVALID_C003_RECEIPT', 'provider returned no C003 receipt');
  if (receipt.deliveryId !== delivery.deliveryId || receipt.assetVersionId !== delivery.assetVersionId) {
    throw new DataContractError('C003_RECEIPT_MISMATCH', 'receipt must echo the exact delivery and T007 identifiers');
  }
  if (!receipt.scenarioContext) throw new DataContractError('C003_RECEIPT_MISSING_CONTEXT', 'receipt must echo the exact C033 scenario context');
  requireContextMatch(delivery.scenarioContext, receipt.scenarioContext);
  if (!['accepted', 'rejected', 'unknown'].includes(receipt.status)) {
    throw new DataContractError('INVALID_C003_RECEIPT', 'receipt status must be accepted, rejected or unknown');
  }
  return deepFreeze(clone(receipt));
}

class C003Client {
  constructor(options = {}) {
    this.provider = options.provider;
    this.clock = options.clock;
    this.receipts = options.receipts instanceof Map ? options.receipts : new Map();
    this.deliveries = options.deliveries instanceof Map ? options.deliveries : new Map();
  }

  createDelivery(asset, options = {}) {
    validateAssetVersion(asset);
    const context = assertActiveContext(options.scenarioContext || asset.scenarioContext);
    requireContextMatch(asset.scenarioContext, context);
    const sentAt = options.sentAt || nowIso(this.clock);
    const deliveryId = options.deliveryId || idFor('C003', [asset.assetVersionId, context.scenarioRunId, sentAt, options.attempt || '1']);
    const existingDelivery = this.deliveries.get(deliveryId);
    if (existingDelivery) {
      if (existingDelivery.assetVersionId !== asset.assetVersionId || !sameRunContext(existingDelivery.scenarioContext, context)) {
        throw new DataContractError('IDEMPOTENCY_CONFLICT', 'delivery id identifies a different T007 or C033 context');
      }
    }
    const priorRejected = [...this.deliveries.values()].find((item) => item.assetVersionId === asset.assetVersionId && ['rejected', 'unknown'].includes(item.status));
    if (!existingDelivery && priorRejected) {
      throw new DataContractError('C003_REACCEPTANCE_UNSPECIFIED', 'a rejected/unknown C003 delivery cannot be silently re-submitted before contract clarification');
    }
    const delivery = {
      deliveryId,
      sourceModule: 'data-engineering',
      targetModule: options.targetModule || 'ontology-management',
      contractCode: 'C003',
      contractVersion: options.contractVersion || 'm02-c003.draft.v1',
      assetId: asset.assetId,
      assetVersionId: asset.assetVersionId,
      t006Id: asset.assetId,
      t007Id: asset.assetVersionId,
      asOfTime: asset.asOfTime,
      t008: asset.asOfTime,
      purpose: asset.purpose || options.purpose || 'semantic-refresh-candidate',
      consumptionStatus: asset.compatibilityOnly ? T007_S003_COMPATIBILITY_STATUS : (asset.consumptionStatus || 'candidate'),
      members: clone(asset.members),
      relationships: clone(asset.relationships),
      quality: clone(asset.quality),
      sourceSnapshotIds: clone(asset.sourceSnapshotIds || []),
      pipelineVersionId: asset.pipelineVersionId,
      processingModuleVersion: asset.processingModuleVersion,
      publishedAt: asset.publishedAt,
      versionDescription: asset.versionDescription,
      scenarioContext: context,
      sentAt,
      status: 'pending',
      idempotencyKey: options.idempotencyKey || `c003:${digest({ assetVersionId: asset.assetVersionId, context, deliveryId })}`
    };
    assertNoForbiddenKeys({ members: delivery.members, relationships: delivery.relationships, quality: delivery.quality, sourceSnapshotIds: delivery.sourceSnapshotIds });
    validateDelivery(delivery);
    const frozen = deepFreeze(delivery);
    if (existingDelivery) {
      const semantic = (value) => { const copy = clone(value); delete copy.sentAt; delete copy.status; delete copy.receipt; return copy; };
      if (stableSerialize(semantic(existingDelivery)) !== stableSerialize(semantic(frozen))) throw new DataContractError('IDEMPOTENCY_CONFLICT', 'delivery id already identifies a different C003 payload');
      return existingDelivery;
    }
    this.deliveries.set(deliveryId, frozen);
    return frozen;
  }

  send(deliveryOrAsset, options = {}) {
    const delivery = deliveryOrAsset?.contractCode === 'C003'
      ? deliveryOrAsset
      : this.createDelivery(deliveryOrAsset, options);
    validateDelivery(delivery);
    const existingReceipt = this.receipts.get(delivery.deliveryId);
    if (existingReceipt) return existingReceipt;
    const sending = deepFreeze({ ...clone(delivery), status: 'awaiting-receipt', sentAt: delivery.sentAt || nowIso(this.clock) });
    this.deliveries.set(delivery.deliveryId, sending);
    let result;
    try {
      result = invoke(this.provider, ['receiveC003', 'receiveDelivery', 'acceptDelivery', 'deliver'], sending);
    } catch (error) {
      if (options.onProviderError === 'unknown') {
        result = { status: 'unknown', reasonCode: 'PROVIDER_UNCERTAIN', reason: error.message, scenarioContext: sending.scenarioContext, uncertainty: true };
      } else throw error;
    }
    const finish = (providerResult) => {
      const receipt = assertExactReceipt({
        ...providerResult,
        deliveryId: providerResult?.deliveryId || sending.deliveryId,
        assetVersionId: providerResult?.assetVersionId || sending.assetVersionId,
        receivedAt: providerResult?.receivedAt || nowIso(this.clock)
      }, sending);
      this.receipts.set(sending.deliveryId, receipt);
      this.deliveries.set(sending.deliveryId, deepFreeze({
        ...clone(sending),
        status: receipt.status,
        receipt
      }));
      return receipt;
    };
    return result && typeof result.then === 'function' ? result.then(finish) : finish(result);
  }

  getReceipt(deliveryId) { return this.receipts.get(deliveryId) || null; }

  sendOnce(deliveryOrAsset, options) { return this.send(deliveryOrAsset, options); }
  deliver(deliveryOrAsset, options) { return this.send(deliveryOrAsset, options); }
  sendAsync(deliveryOrAsset, options) { return Promise.resolve().then(() => this.send(deliveryOrAsset, options)); }
}

class C032Client {
  constructor(options = {}) {
    this.provider = options.provider;
    this.clock = options.clock;
    this.readEvents = options.readEvents || [];
  }

  discover({ assetId, scenarioContext, delivery, readAt, requester = 'm02', strict = false } = {}) {
    assetId = assetId || delivery?.assetId;
    if (!assetId) throw new DataContractError('C032_ASSET_REQUIRED', 'C032 discovery requires a stable T006 identifier');
    const context = assertActiveContext(scenarioContext || delivery?.scenarioContext);
    if (delivery) {
      if (delivery.status !== 'accepted') throw new DataContractError('C003_NOT_ACCEPTED', 'C032 discovery requires an accepted C003 receipt');
      if (delivery.assetId !== assetId) throw new DataContractError('C032_ASSET_MISMATCH', 'C032 query must use the delivered T006');
      requireContextMatch(delivery.scenarioContext, context);
    }
    const request = {
      requestId: idFor('C032-REQ', [assetId, context.scenarioRunId, readAt || 'now']),
      contractCode: 'C032',
      assetId,
      t006Id: assetId,
      scenarioContext: context,
      requestedAt: readAt || nowIso(this.clock),
      requester
    };
    let response;
    try {
      response = invoke(this.provider, ['discoverC032', 'discoverRefreshTarget', 'discover'], request);
    } catch (error) {
      response = { status: 'read-failed', reasonCode: 'PROVIDER_ERROR', reason: error.message, candidates: [], scenarioContext: context, uncertainty: true };
    }
    response = response || { status: 'unknown', candidates: [] };
    if (!C032_STATES.includes(response.status)) throw new DataContractError('INVALID_C032', `invalid C032 status ${response.status}`);
    if (optionsStrict(strict) && response.status === 'available') {
      for (const candidate of response.candidates || []) {
        if (!candidate.t054Id && !candidate.targetId && !candidate.bindingId) throw new DataContractError('INVALID_C032', 'strict C032 candidate lacks T054 identity');
      }
    }
    if (response.scenarioContext) requireContextMatch(context, response.scenarioContext);
    else throw new DataContractError('C032_CONTEXT_MISSING', 'C032 response must echo C033 context');
    if (response.assetId !== undefined && response.assetId !== assetId) throw new DataContractError('C032_ASSET_MISMATCH', 'C032 response identifies another T006');
    const normalized = deepFreeze({
      responseId: response.responseId || idFor('C032', [request.requestId, response.status]),
      responseVersion: response.responseVersion || '1',
      contractCode: 'C032',
      assetId,
      t006Id: assetId,
      status: response.status,
      formedAt: response.formedAt || request.requestedAt,
      readAt: response.readAt || nowIso(this.clock),
      scenarioContext: clone(response.scenarioContext),
      candidates: clone(response.candidates || []),
      reasonCode: response.reasonCode,
      reason: response.reason,
      recovery: response.recovery,
      requestId: request.requestId
    });
    this.readEvents.push(deepFreeze({ type: 'C032_READ', request: clone(request), responseId: normalized.responseId, responseVersion: normalized.responseVersion }));
    return normalized;
  }

  selectAvailable(response, targetId) {
    if (!response || response.status !== 'available') throw new DataContractError('C032_NOT_AVAILABLE', 'C032 response is not available');
    const candidates = response.candidates || [];
    const found = candidates.find((candidate) => candidate.t054Id === targetId || candidate.targetId === targetId || candidate.bindingId === targetId);
    if (!found) throw new DataContractError('C032_TARGET_NOT_FOUND', 'requested T054 is not in the current response');
    if (found.allowSubmit !== true || found.status !== 'available') throw new DataContractError('C032_TARGET_NOT_SUBMITTABLE', 'selected C032 target is not currently submittable');
    return deepFreeze(clone(found));
  }

  read(args) { return this.discover(args); }
  discoverTargets(args) { return this.discover(args); }
  discoverAsync(args) { return Promise.resolve().then(() => this.discover(args)); }
}

function compareDiscovery(left, right) {
  // A fresh C032 read has a new response identity. Drift is determined from
  // the binding/status payload, not from the read event identifier.
  const fields = ['assetId', 'status', 'responseVersion'];
  if (!left || !right) return false;
  if (!sameRunContext(left.scenarioContext, right.scenarioContext)) return false;
  if (fields.some((field) => left[field] !== right[field])) return false;
  const candidateKey = (value) => (value || []).map((item) => ({
    t054Id: item.t054Id || item.targetId || item.bindingId || null,
    bindingVersion: item.bindingVersion || null,
    t017Id: item.t017Id || null,
    mappingVersion: item.mappingVersion || null,
    allowSubmit: item.allowSubmit === true,
    status: item.status || null
  }));
  return stableSerialize(candidateKey(left.candidates)) === stableSerialize(candidateKey(right.candidates));
}

class C028Client {
  constructor(options = {}) {
    this.provider = options.provider;
    this.clock = options.clock;
    this.requests = options.requests instanceof Map ? options.requests : new Map();
    this.c029 = options.c029Client || null;
  }

  submit({ delivery, discovery, selectedTarget, reread, asset, scenarioContext, trigger = 'manual', retryOf, requestId, strict = false } = {}) {
    if (!delivery || delivery.contractCode !== 'C003' || delivery.status !== 'accepted') throw new DataContractError('C003_NOT_ACCEPTED', 'C028 requires an accepted C003 delivery');
    const context = assertActiveContext(scenarioContext || delivery.scenarioContext);
    requireContextMatch(delivery.scenarioContext, context);
    if (asset?.compatibilityOnly === true || delivery.consumptionStatus === T007_S003_COMPATIBILITY_STATUS) throw new DataContractError('S003_NOT_CONSUMABLE', 'S003 compatibility T007 cannot enter C028/C029');
    if (!discovery || discovery.status !== 'available') throw new DataContractError('C032_NOT_AVAILABLE', 'C028 requires an available C032 response');
    requireContextMatch(context, discovery.scenarioContext);
    const target = selectedTarget || (discovery.candidates || []).find((candidate) => candidate.allowSubmit === true && candidate.status === 'available');
    if (!target || target.allowSubmit !== true || target.status !== 'available') throw new DataContractError('C032_TARGET_NOT_SUBMITTABLE', 'C028 requires one currently available target');
    if (strict && (!target.bindingVersion || !target.t017Id || !target.mappingVersion)) throw new DataContractError('C032_TARGET_INCOMPLETE', 'strict C028 requires T054 binding, T017 and mapping identities');
    if (reread && !compareDiscovery(discovery, reread)) throw new DataContractError('C032_DRIFT', 'C032 target changed before C028 submission');
    if (reread) requireContextMatch(context, reread.scenarioContext);
    const targetId = target.t054Id || target.targetId || target.bindingId;
    const request = {
      requestId: requestId || idFor('C028', [delivery.assetVersionId, targetId, context.scenarioRunId, retryOf || 'root']),
      contractCode: 'C028',
      assetId: delivery.assetId,
      assetVersionId: delivery.assetVersionId,
      t006Id: delivery.assetId,
      t007Id: delivery.assetVersionId,
      asOfTime: delivery.asOfTime,
      t008: delivery.asOfTime,
      deliveryId: delivery.deliveryId,
      scenarioContext: context,
      target: clone(target),
      discovery: clone(reread || discovery),
      trigger,
      retryOf: retryOf || null,
      status: 'pending',
      requestedAt: nowIso(this.clock),
      idempotencyKey: `c028:${digest({ deliveryId: delivery.deliveryId, targetId, context, retryOf: retryOf || null })}`
    };
    const frozen = deepFreeze(request);
    const existing = this.requests.get(request.requestId);
    if (existing) {
      const semantic = (value) => { const copy = clone(value); delete copy.requestedAt; return copy; };
      if (stableSerialize(semantic(existing.request)) !== stableSerialize(semantic(frozen))) throw new DataContractError('IDEMPOTENCY_CONFLICT', 'C028 request id identifies a different payload');
      return existing.receipt || existing;
    }
    let result;
    try {
      result = invoke(this.provider, ['submitC028', 'submitRefreshRequest', 'submit'], frozen);
    } catch (error) {
      result = { status: 'unknown', reasonCode: 'PROVIDER_UNCERTAIN', reason: error.message, scenarioContext: frozen.scenarioContext, uncertainty: true };
    }
    if (!C028_STATES.includes(result?.status)) throw new DataContractError('INVALID_C028_RECEIPT', 'provider returned an invalid C028 status');
    if (!result.scenarioContext) throw new DataContractError('C028_RECEIPT_MISSING_CONTEXT', 'C028 receipt must echo C033 context');
    requireContextMatch(context, result.scenarioContext);
    if (result.requestId && result.requestId !== request.requestId) throw new DataContractError('C028_RECEIPT_MISMATCH', 'C028 receipt must echo requestId');
    if (result.target) {
      const returnedTarget = result.target.t054Id || result.target.targetId || result.target.bindingId;
      if (returnedTarget !== targetId || (result.target.bindingVersion || null) !== (target.bindingVersion || null)) throw new DataContractError('C028_RECEIPT_MISMATCH', 'C028 receipt target differs from the submitted C032 target');
    }
    const receipt = deepFreeze({
      ...clone(result),
      contractCode: 'C028',
      requestId: request.requestId,
      assetId: delivery.assetId,
      assetVersionId: delivery.assetVersionId,
      deliveryId: delivery.deliveryId,
      target: clone(target),
      scenarioContext: context,
      receivedAt: result.receivedAt || nowIso(this.clock)
    });
    this.requests.set(request.requestId, { request: frozen, receipt });
    return receipt;
  }

  get(requestId) { return this.requests.get(requestId)?.receipt || null; }
  createRequest(args) { return this.submit(args); }
  retry(original, args = {}) {
    if (!original || !original.requestId) throw new DataContractError('INVALID_RETRY', 'C028 retry must reference an original request');
    return this.submit({ ...args, retryOf: original.requestId });
  }
  submitAsync(args) { return Promise.resolve().then(() => this.submit(args)); }
}

class C029Client {
  constructor() { this.results = new Map(); this.history = new Map(); }

  accept({ result, request, delivery, context } = {}) {
    if (!result || !C029_STATES.includes(result.status)) throw new DataContractError('INVALID_C029', 'invalid C029 result status');
    const expectedContext = context || request?.scenarioContext || delivery?.scenarioContext;
    requireContextMatch(expectedContext, result.scenarioContext);
    if (request && result.requestId !== request.requestId) throw new DataContractError('C029_REQUEST_MISMATCH', 'C029 must reference the exact C028 request');
    if (request && result.assetVersionId !== request.assetVersionId) throw new DataContractError('C029_ASSET_MISMATCH', 'C029 must echo the exact T007 from C028');
    if (delivery && result.assetVersionId !== delivery.assetVersionId) throw new DataContractError('C029_ASSET_MISMATCH', 'C029 must reference the exact delivered T007');
    if (result.target && request?.target) {
      const left = result.target.t054Id || result.target.targetId || result.target.bindingId;
      const right = request.target.t054Id || request.target.targetId || request.target.bindingId;
      if (left !== right || result.target.bindingVersion !== request.target.bindingVersion) throw new DataContractError('C029_TARGET_MISMATCH', 'C029 target differs from C028');
    }
    const key = result.resultId || idFor('C029', [result.requestId, result.assetVersionId, result.status]);
    const frozen = deepFreeze({ ...clone(result), contractCode: 'C029', resultId: key });
    const existing = this.results.get(key);
    if (existing) {
      const semantic = (value) => { const copy = clone(value); delete copy.formedAt; delete copy.receivedAt; return copy; };
      if (stableSerialize(semantic(existing)) === stableSerialize(semantic(frozen))) return existing;
      if (existing.status !== 'processing' || !['succeeded', 'failed', 'incompatible', 'unknown'].includes(frozen.status)) throw new DataContractError('IDEMPOTENCY_CONFLICT', 'C029 result id identifies a different result');
      this.history.set(key, [...(this.history.get(key) || [existing]), frozen]);
      this.results.set(key, frozen);
      return frozen;
    }
    this.results.set(key, frozen);
    this.history.set(key, [frozen]);
    return frozen;
  }

  get(resultId) { return this.results.get(resultId) || null; }
  recordResult(args) { return this.accept(args); }
  acceptAsync(args) { return Promise.resolve().then(() => this.accept(args)); }
}

module.exports = Object.freeze({
  C001Client,
  C002Client,
  C003Client,
  C032Client,
  C028Client,
  C029Client,
  compareDiscovery,
  assertExactReceipt,
  createDelivery: (...args) => new C003Client().createDelivery(...args),
  projectC003Delivery: (...args) => new C003Client().createDelivery(...args),
  discoverC032: (...args) => new C032Client().discover(...args),
  submitC028: (...args) => new C028Client().submit(...args),
  acceptC029: (...args) => new C029Client().accept(...args)
});
