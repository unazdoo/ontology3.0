'use strict';

const identity = require('../../packages/identity');

const {
  C032_STATUSES,
  C008_STATUSES,
  EVENT_TYPES,
  SCHEMA_VERSIONS,
  assertArray,
  assertDateTime,
  assertEnvelope,
  assertEnum,
  assertSameContext,
  assertScenarioContext,
  assertText,
  assertUnique,
  cloneJson,
  fail,
  immutable,
  isRecord,
  operationMetadata,
  sealIntegrity,
  sha256,
  stableHash,
  text,
  verifyIntegrity
} = require('./domain');
const { MemoryOntologyRepository } = require('./repository');
const {
  normalizeC003Payload,
  normalizeC029Command,
  normalizeSemanticContent,
  sealC003Payload,
  splitResources,
  validateSemanticContent,
  S001_MEMBER_IDS,
  S001_RELATION_IDS
} = require('./validation');
const {
  AUTHORITATIVE_C008_SOURCE_ID,
  refreshC008Projection,
  validateC008Projection,
  validateC032ResponseFingerprint
} = require('./projection');

const T054_STATUS_ALIASES = Object.freeze({
  draft: 'draft-or-unpublished',
  unpublished: 'draft-or-unpublished',
  inactive: 'disabled',
  mismatch: 'asset-mismatch'
});
const C032_CLIENT_STATUS = Object.freeze({
  'draft-or-unpublished': 'draft',
  disabled: 'inactive'
});
const C028_RECEIPT_STATUSES = Object.freeze(['accepted', 'rejected', 'unknown']);
const CANDIDATE_ITEM_STATUSES = Object.freeze(['passed', 'failed', 'timeout', 'unknown', 'version-mismatch']);

function defaultClock() {
  return new Date().toISOString();
}

function makeDefaultId(prefix, value) {
  return `${prefix}-${sha256(value).slice(0, 24)}`;
}

function currentDraftRevision(draft) {
  return draft.revisions[draft.revisions.length - 1];
}

function latestPublished(state, ontologyId) {
  for (let index = state.publishedOrder.length - 1; index >= 0; index -= 1) {
    const published = state.published[state.publishedOrder[index]];
    if (published.ontologyId === ontologyId) return published;
  }
  return null;
}

function latestOpenDraft(state, ontologyId) {
  for (let index = state.draftOrder.length - 1; index >= 0; index -= 1) {
    const draft = state.drafts[state.draftOrder[index]];
    if (draft.ontologyId === ontologyId && draft.lifecycleState !== 'published' && draft.lifecycleState !== 'abandoned') return draft;
  }
  return null;
}

function exactSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const set = new Set(left);
  return set.size === left.length && right.every((item) => set.has(item));
}

function emptyContent(ontologyId) {
  return {
    ontologyId,
    name: '',
    description: '',
    resources: [],
    sourceMappingVersion: null,
    mapping: null,
    effectiveFrom: null,
    effectiveTo: null
  };
}

function payloadDigest(value) {
  // Canonical JSON fingerprints omit optional undefined fields. This keeps
  // the digest deterministic for callers that use sparse command objects.
  return stableHash({ value: JSON.parse(JSON.stringify(value)) });
}

function businessDigest(value, transientFields = []) {
  try {
    const copy = JSON.parse(JSON.stringify(value));
    transientFields.forEach((field) => { delete copy[field]; });
    return payloadDigest(copy);
  } catch (error) {
    fail('INVALID_JSON_VALUE', 'request cannot be fingerprinted as JSON', { cause: error.message });
  }
}

function safeError(error) {
  return {
    code: error?.code || 'VALIDATION_FAILED',
    message: error?.message || 'validation failed',
    details: error?.details || null
  };
}

function assertM01Owner(command, fields = ['callerModule', 'sourceModule', 'consumerModule', 'actorModule', 'ownerModule']) {
  fields.forEach((field) => {
    if (command?.[field] && command[field] !== 'M01') fail('OWNER_BOUNDARY_VIOLATION', `${field} must identify M01 for an M01-owned write`, { field, value: command[field] });
  });
}

function normalizeStatus(value) {
  return T054_STATUS_ALIASES[value] || value;
}

function m02QualityEvidence(quality) {
  if (!isRecord(quality)) return null;
  return quality.evidenceRef || quality.qualityId || null;
}

function flattenLineageNodes(value, result = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenLineageNodes(item, result));
  } else if (isRecord(value)) {
    const id = value.snapshotId || value.assetVersionId || value.sourceId || value.id;
    if (text(id)) result.push(String(id));
    if (value.upstream) flattenLineageNodes(value.upstream, result);
  } else if (text(value)) result.push(value.trim());
  return result;
}

function adaptM02C003Delivery(delivery) {
  if (!isRecord(delivery)) return delivery;
  const relationships = delivery.relationships || delivery.relations || [];
  const members = (delivery.members || []).map((member) => {
    if (!isRecord(member)) return member;
    const fields = Array.isArray(member.fields) ? member.fields : [];
    return {
      ...cloneJson(member),
      id: member.id || member.memberId,
      name: member.name || member.displayName || member.memberId,
      grain: member.grain,
      rowCount: member.rowCount ?? member.rows,
      primaryKey: member.primaryKey || member.identityFieldId || member.identity,
      fields
    };
  });
  const quality = delivery.quality;
  const lineageNodes = flattenLineageNodes(delivery.sourceChain || delivery.sourceSnapshotIds || []);
  // M02's delivery shape may carry a T007 content fingerprint rather than a
  // source snapshot fingerprint. Preserve it only when it is a real SHA-256;
  // do not invent a size or an evidence hash at this boundary.
  const sourceFingerprint = delivery.sourceFingerprint || (delivery.contentFingerprint && Number.isSafeInteger(delivery.sizeBytes)
    ? { algorithm: 'SHA-256', value: delivery.contentFingerprint, sizeBytes: delivery.sizeBytes }
    : null);
  const raw = {
    deliveryId: delivery.deliveryId,
    deliveryStatus: ['awaiting-receipt', 'pending', 'sending'].includes(delivery.status) ? 'delivered' : delivery.status,
    deliveredAt: delivery.sentAt || delivery.deliveredAt,
    sourceModule: delivery.sourceModule || 'M02',
    t006Id: delivery.assetId,
    t007Version: delivery.assetVersionId || delivery.assetVersion,
    t007Immutable: delivery.immutable,
    publicationState: delivery.publicationState,
    publishedAt: delivery.publishedAt,
    purpose: delivery.purpose,
    consumptionRestriction: delivery.consumptionStatus,
    versionDescription: delivery.versionDescription,
    t008: {
      asOf: normalizeAsOf(delivery.asOfTime || delivery.t008),
      evidenceRef: delivery.t008EvidenceRef || delivery.t008Confirmation?.evidenceRef || delivery.t008ConfirmationId
    },
    members,
    relations: relationships.map((relation) => ({
      ...cloneJson(relation),
      id: relation.id || relation.relationId,
      name: relation.name || relation.displayName || relation.relationId,
      sourceMemberId: relation.sourceMemberId || relation.source,
      targetMemberId: relation.targetMemberId || relation.target,
      sourceFieldId: relation.sourceFieldId || relation.sourceField,
      targetFieldId: relation.targetFieldId || relation.targetField,
      endpointCheckStatus: relation.endpointCheckStatus || relation.status
    })),
    expectedScope: delivery.expectedScope,
    qualitySummary: quality && {
      status: quality.status,
      evidenceRef: m02QualityEvidence(quality),
      checkedAt: quality.formedAt
    },
    lineage: {
      status: delivery.lineageCheckStatus || (lineageNodes.length > 0 ? 'passed' : 'unknown'),
      nodes: lineageNodes,
      evidenceRef: delivery.lineageEvidenceRef || delivery.pipelineVersionId || delivery.pipelineVersion,
      cycleDetected: delivery.cycleDetected === true
    },
    sourceFingerprint,
    retryOf: delivery.retryOf
  };
  if (delivery.scenarioContext) raw.scenarioContext = cloneJson(delivery.scenarioContext);
  return sealC003Payload(raw);
}

function stripC003EnvelopeFields(value, removeContext = false) {
  const copy = cloneJson(value);
  const fields = ['contractCode', 'schemaVersion', 'eventId', 'eventType', 'occurredAt', 'actorRef', 'actor', 'traceId', 'correlationId', 'idempotencyKey'];
  if (removeContext) fields.push('scenarioContext');
  fields.forEach((field) => delete copy[field]);
  return copy;
}

function normalizeAsOf(value) {
  if (!text(value)) return value;
  return value.includes('T') ? value.slice(0, 10) : value;
}

class OntologyService {
  constructor(options = {}) {
    this.context = assertScenarioContext(options.scenarioContext, { write: true });
    this.ontologyId = assertText(options.ontologyId || `ONTOLOGY-${this.context.scenarioId}`, 'ontologyId', { token: true });
    this.repository = options.repository || new MemoryOntologyRepository();
    this.clock = options.clock || defaultClock;
    this.idFactory = options.idFactory || makeDefaultId;
    this.repository.registerScenario(this.context);
    if (options.state) {
      this.replaceState(options.state, { replaceEmpty: true });
    }
    const state = this.repository.read(this.context);
    if (!state.c008) {
      this.repository.transaction(this.context, {}, (working) => {
        refreshC008Projection(working, this._now());
        return working.c008;
      });
    }
  }

  _now(value) {
    const now = value || (typeof this.clock === 'function' ? this.clock() : this.clock);
    assertDateTime(now, 'time', 'INVALID_TIME');
    return now;
  }

  _id(prefix, value) {
    const id = this.idFactory(prefix, value);
    return assertText(id, `${prefix} id`, { token: true, code: 'INVALID_ID_FACTORY' });
  }

  _context(value, options = {}) {
    return assertSameContext(this.context, value, { ...options, allowReadOnlyLifecycle: options.write !== true });
  }

  _audit(state, source, operation, outcome, details = {}) {
    state.counters.audit += 1;
    const now = this._now(details.formedAt);
    const metadata = operationMetadata(source, operation, now);
    const record = {
      auditId: this._id('M01-AUDIT', { operation, sequence: state.counters.audit, scenarioContext: state.scenarioContext }),
      sequence: state.counters.audit,
      actorRef: metadata.actorRef,
      traceId: metadata.traceId,
      correlationId: metadata.correlationId,
      scenarioContext: cloneJson(state.scenarioContext),
      sourceVersion: details.sourceVersion || 'none',
      targetVersion: details.targetVersion || 'none',
      formedAt: now,
      operation,
      outcome,
      refs: cloneJson(details.refs || []),
      reasonCode: details.reasonCode || null
    };
    state.audit.push(record);
    return record;
  }

  _newDraft(state, options = {}) {
    state.counters.draft += 1;
    const now = this._now(options.now);
    const draftId = options.draftId || this._id('M01-DRAFT', {
      scenarioContext: state.scenarioContext,
      ontologyId: options.ontologyId || this.ontologyId,
      sequence: state.counters.draft
    });
    if (state.drafts[draftId]) fail('DRAFT_ID_CONFLICT', 'draftId already exists', { draftId });
    const content = normalizeSemanticContent(options.content || emptyContent(options.ontologyId || this.ontologyId), {
      ontologyId: options.ontologyId || this.ontologyId
    });
    const revision = {
      contentRevision: 1,
      contentDigest: payloadDigest(content),
      content,
      savedAt: now,
      actorRef: options.actorRef || 'M01_SYSTEM',
      changeSummary: options.changeSummary || 'Draft created'
    };
    const draft = {
      schemaVersion: 'ofw.m01.draft.v1',
      draftId,
      id: draftId,
      ontologyId: content.ontologyId,
      draftRevision: state.counters.draft,
      lifecycleState: 'draft-unvalidated',
      lifecycleStatus: 'draft',
      status: 'Draft',
      scenarioContext: cloneJson(state.scenarioContext),
      basedOnPublishedId: options.basedOnPublishedId || null,
      basedOnT017Id: options.basedOnT017Id || null,
      sourceDeliveryId: options.sourceDeliveryId || null,
      replacesDraftId: options.replacesDraftId || null,
      createdAt: now,
      updatedAt: now,
      revisions: [revision],
      validation: null,
      publishedId: null
    };
    state.drafts[draftId] = draft;
    state.draftOrder.push(draftId);
    return draft;
  }

  _c003Input(input) {
    if (isRecord(input) && input.eventType) {
      const envelope = assertEnvelope(input, {
        schemaVersion: SCHEMA_VERSIONS.C003,
        eventType: EVENT_TYPES.C003_DELIVERY
      });
      this._context(envelope.scenarioContext, { write: true });
      return {
        source: envelope,
        context: envelope.scenarioContext,
        rawPayload: envelope.payload,
        canonicalPayload: envelope.payload,
        envelope
      };
    }
    if (!isRecord(input) || input.contractCode !== 'C003') fail('C003_INVALID', 'C003 input must be a Foundation envelope or M02 C003 delivery');
    const context = this._context(input.scenarioContext, { write: true });
    const looksCanonical = Boolean(input.t006Id && input.t007Version && input.sourceFingerprint
      && input.qualitySummary && input.lineage && input.integrity);
    let canonical = input.payload && isRecord(input.payload)
      ? input.payload
      : (looksCanonical ? input : null);
    const alternateCanonical = !input.payload && canonical === input ? stripC003EnvelopeFields(input, false) : null;
    const alternateCanonicalWithoutContext = !input.payload && canonical === input ? stripC003EnvelopeFields(input, true) : null;
    return {
      source: input,
      context,
      rawPayload: input.payload && isRecord(input.payload) ? input.payload : (canonical || input),
      canonicalPayload: canonical || adaptM02C003Delivery(input),
      alternateCanonical,
      alternateCanonicalWithoutContext,
      envelope: null
    };
  }

  _deliveryReceipt(state, input, status, details = {}) {
    const now = details.receivedAt || this._now();
    const payload = details.payload || {};
    const draft = details.draft || null;
    const replacedDraft = details.replacedDraft || null;
    const deliveryId = input.rawPayload?.deliveryId || payload.deliveryId || null;
    const t007Version = payload.t007Version || input.rawPayload?.t007Version || input.rawPayload?.assetVersionId || input.rawPayload?.assetVersion || null;
    return {
      schemaVersion: SCHEMA_VERSIONS.C003,
      receiptId: deliveryId ? this._id('M01-C003-RECEIPT', { deliveryId, scenarioContext: state.scenarioContext }) : null,
      contractCode: 'C003',
      sourceModule: 'M01',
      actorRef: input.source?.actorRef || input.source?.actor || 'M01_SYSTEM',
      traceId: input.source?.traceId || null,
      correlationId: input.source?.correlationId || null,
      deliveryId,
      status,
      receivedAt: now,
      reasonCode: details.reasonCode || null,
      reason: details.reason || null,
      scenarioContext: cloneJson(state.scenarioContext),
      t006Id: payload.t006Id || input.rawPayload?.t006Id || input.rawPayload?.assetId || null,
      assetId: payload.t006Id || input.rawPayload?.t006Id || input.rawPayload?.assetId || null,
      t007Version,
      assetVersionId: t007Version,
      t008AsOf: payload.t008?.asOf || input.rawPayload?.t008AsOf || normalizeAsOf(input.rawPayload?.asOfTime || input.rawPayload?.t008) || null,
      asOfTime: input.rawPayload?.asOfTime
        || (isRecord(input.rawPayload?.t008) ? input.rawPayload.t008.asOf : input.rawPayload?.t008)
        || payload.t008?.asOf
        || null,
      targetDraftId: draft?.draftId || null,
      targetDraftRevision: draft?.draftRevision || null,
      targetDraftContentRevision: draft ? currentDraftRevision(draft).contentRevision : null,
      draftIdentityRevision: draft?.draftRevision || null,
      targetDraftVersion: draft ? `${draft.draftId}:r${draft.draftRevision}` : null,
      targetDraftVersionId: draft?.draftId || null,
      previousDraftId: replacedDraft?.draftId || null,
      previousAssetVersionId: details.previousAssetVersionId || null,
      replacement: (replacedDraft || details.previousPublishedId || details.previousAssetVersionId) && draft ? {
        relation: 'replaced-by',
        replacementRelation: '替代',
        relationCode: 'replaced',
        previousDraftId: replacedDraft?.draftId || null,
        previousPublishedId: details.previousPublishedId || null,
        newDraftId: draft.draftId,
        previousAssetVersionId: details.previousAssetVersionId || null,
        newAssetVersionId: t007Version
      } : null,
      contentDigest: details.contentDigest || null,
      sourceContractFingerprint: details.contentDigest || null,
      immutableReceiptSnapshot: status === 'accepted' ? {
        deliveryId,
        t006Id: payload.t006Id || input.rawPayload?.assetId || null,
        t007Version,
        t008AsOf: payload.t008?.asOf || null,
        contentDigest: details.contentDigest || null,
        targetDraftId: draft?.draftId || null,
        targetDraftRevision: draft?.draftRevision || null
      } : null,
      readOnly: true
    };
  }

  receiveC003(input) {
    const parsed = this._c003Input(input);
    let incomingDigest = businessDigest({ ...parsed.rawPayload, scenarioContext: parsed.context }, ['traceId', 'correlationId', 'actorRef', 'actor', 'receivedAt', 'contractCode', 'schemaVersion', 'eventId', 'eventType', 'occurredAt', 'idempotencyKey']);
    let payload = null;
    let rejection = null;
    try {
      try {
        payload = normalizeC003Payload(parsed.canonicalPayload);
      } catch (firstError) {
        if (!parsed.alternateCanonical || firstError.code !== 'C003_CORRUPT') throw firstError;
        try {
          payload = normalizeC003Payload(parsed.alternateCanonical);
        } catch (secondError) {
          if (!parsed.alternateCanonicalWithoutContext) throw secondError;
          payload = normalizeC003Payload(parsed.alternateCanonicalWithoutContext);
        }
      }
      if (payload.scenarioContext) assertSameContext(parsed.context, payload.scenarioContext, { code: 'C003_CONTEXT_MISMATCH' });
      if (parsed.context.scenarioId === 'S001') {
        if (!exactSet(payload.members.map((item) => item.id), S001_MEMBER_IDS)) fail('C003_MEMBER_SCOPE_MISMATCH', 'S001 C003 member identities do not match the authoritative four-member scope');
        if (!exactSet(payload.relations.map((item) => item.id), S001_RELATION_IDS)) fail('C003_RELATION_SCOPE_MISMATCH', 'S001 C003 relation identities do not match the authoritative three-relation scope');
      }
      if (payload.sourceModule !== 'M02' && payload.sourceModule !== 'data-engineering') {
        fail('C003_SOURCE_INVALID', 'C003 must originate from M02 data engineering');
      }
      if (parsed.context.scenarioId === 'S003'
          || parsed.rawPayload.consumptionStatus === 'compatibility-only-non-consumable'
          || parsed.rawPayload.compatibilityOnly === true
          || parsed.rawPayload.consumption?.compatibilityOnly === true
          || payload.consumptionRestriction === 'compatibility-only-non-consumable'
          || payload.consumptionRestriction === 'permanently-non-consumable') {
        fail('S003_NOT_CONSUMABLE', 'a compatibility-only T007 cannot enter the M01 semantic consumption spine');
      }
    } catch (error) {
      rejection = safeError(error);
    }
    if (payload) {
      // Seal every normalized owner copy, including a payload that passed
      // shape validation but was rejected by a later M01 business gate.
      delete payload.integrity;
      payload = cloneJson(sealIntegrity(payload));
      if (!rejection) incomingDigest = payloadDigest(payload);
    }

    const transaction = this.repository.transaction(this.context, {}, (state) => {
      const deliveryId = parsed.rawPayload.deliveryId || payload?.deliveryId;
      if (!text(deliveryId)) fail(rejection?.code || 'C003_INVALID', rejection?.message || 'deliveryId is required', rejection?.details || { path: 'deliveryId' });
      const existing = state.deliveryRecords[deliveryId];
      if (existing) {
        if (existing.inputDigest !== incomingDigest) {
          fail('C003_IDEMPOTENCY_CONFLICT', 'the same C003 deliveryId identifies different content', {
            deliveryId,
            originalDigest: existing.inputDigest,
            incomingDigest
          });
        }
        return { ...existing.receipt, duplicate: true, outcome: 'duplicate', duplicateOf: existing.receipt.receiptId };
      }

      if (rejection || payload.deliveryStatus !== 'delivered') {
        const reason = rejection || { code: 'C003_NOT_DELIVERED', message: 'C003 has not reached delivered state' };
        const rawDeliveryStatus = parsed.rawPayload?.deliveryStatus || parsed.rawPayload?.status;
        const status = payload && payload.deliveryStatus === 'sent'
          || ['unknown', 'result-unknown', 'read-failed'].includes(rawDeliveryStatus)
          || reason.code === 'C003_UNKNOWN_STATUS'
          ? 'unknown'
          : 'rejected';
        const receipt = this._deliveryReceipt(state, parsed, status, {
          payload,
          reasonCode: reason.code,
          reason: reason.message,
          contentDigest: incomingDigest
        });
        state.deliveryRecords[deliveryId] = {
          inputDigest: incomingDigest,
          canonicalDigest: payload ? payloadDigest(payload) : null,
          payload: payload ? cloneJson(payload) : null,
          receipt
        };
        state.deliveryOrder.push(deliveryId);
        this._audit(state, parsed.source, 'C003.receive', status, {
          sourceVersion: payload?.t007Version || 'invalid',
          targetVersion: 'none',
          reasonCode: reason.code,
          refs: [deliveryId]
        });
        return receipt;
      }

      const priorRejected = state.deliveryOrder
        .map((id) => state.deliveryRecords[id])
        .find((record) => record.receipt.status !== 'accepted'
          && (record.payload?.t006Id || record.receipt.t006Id) === payload.t006Id
          && (record.payload?.t007Version || record.receipt.t007Version) === payload.t007Version
          && (record.payload?.t008?.asOf || record.receipt.t008AsOf) === payload.t008?.asOf);
      if (priorRejected && parsed.rawPayload.reacceptApproved !== true && parsed.rawPayload.reacceptDecision !== 'approved') {
        const receipt = this._deliveryReceipt(state, parsed, 'rejected', {
          payload,
          reasonCode: 'C003_REACCEPTANCE_UNDECIDED',
          reason: 'the same exact T007 was previously rejected; re-acceptance semantics remain an unresolved cross-module decision',
          contentDigest: incomingDigest
        });
        state.deliveryRecords[payload.deliveryId] = {
          inputDigest: incomingDigest,
          canonicalDigest: payloadDigest(payload),
          payload: cloneJson(payload),
          receipt
        };
        state.deliveryOrder.push(payload.deliveryId);
        this._audit(state, parsed.source, 'C003.receive', 'rejected', {
          sourceVersion: payload.t007Version,
          targetVersion: 'none',
          reasonCode: 'C003_REACCEPTANCE_UNDECIDED',
          refs: [payload.deliveryId]
        });
        return receipt;
      }

      const priorDraft = latestOpenDraft(state, this.ontologyId);
      const priorPublished = latestPublished(state, this.ontologyId);
      let baseContent = priorDraft ? currentDraftRevision(priorDraft).content : priorPublished?.content;
      if (!baseContent) baseContent = emptyContent(this.ontologyId);
      baseContent = cloneJson(baseContent);
      baseContent.sourceMappingVersion = null;
      baseContent.mapping = null;
      const draft = this._newDraft(state, {
        ontologyId: this.ontologyId,
        content: baseContent,
        basedOnPublishedId: priorPublished?.publishedId || null,
        basedOnT017Id: priorPublished?.t017Id || null,
        sourceDeliveryId: payload.deliveryId,
        replacesDraftId: priorDraft?.draftId || null,
        actorRef: parsed.source.actorRef || parsed.source.actor || 'M02',
        changeSummary: `C003 ${payload.deliveryId} received; exact T007 binding requires explicit mapping validation`
      });
      draft.sourceDeliverySnapshot = cloneJson(payload);
      draft.sourceContractFingerprint = payloadDigest(payload);
      draft.sourceAssetVersion = payload.t007Version;
      const priorDelivery = priorDraft?.sourceDeliveryId ? state.deliveryRecords[priorDraft.sourceDeliveryId]?.payload : null;
      const publishedDelivery = priorPublished?.sourceDeliveryId ? state.deliveryRecords[priorPublished.sourceDeliveryId]?.payload : null;
      const receipt = this._deliveryReceipt(state, parsed, 'accepted', {
        payload,
        draft,
        replacedDraft: priorDraft,
        previousAssetVersionId: priorDelivery?.t007Version || publishedDelivery?.t007Version || null,
        previousPublishedId: priorPublished?.publishedId || null,
        contentDigest: incomingDigest
      });
      state.deliveryRecords[payload.deliveryId] = {
        inputDigest: incomingDigest,
        canonicalDigest: payloadDigest(payload),
        payload: cloneJson(payload),
        receipt
      };
      state.deliveryOrder.push(payload.deliveryId);
      this._audit(state, parsed.source, 'C003.receive', 'accepted', {
        sourceVersion: payload.t007Version,
        targetVersion: `${draft.draftId}:r${draft.draftRevision}`,
        refs: [payload.deliveryId, draft.draftId]
      });
      return receipt;
    });
    return transaction.result;
  }

  acceptC003(input) { return this.receiveC003(input); }
  receiveDelivery(input) { return this.receiveC003(input); }

  createDraft(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    assertM01Owner(command);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      let base = null;
      if (command.basedOnPublishedId) {
        base = state.published[command.basedOnPublishedId];
        if (!base) fail('PUBLISHED_NOT_FOUND', 'the requested Published semantic version does not exist');
        assertSameContext(state.scenarioContext, base.scenarioContext);
      }
      const draft = this._newDraft(state, {
        ontologyId: command.ontologyId || base?.ontologyId || this.ontologyId,
        draftId: command.draftId,
        content: command.content || base?.content || emptyContent(command.ontologyId || this.ontologyId),
        basedOnPublishedId: base?.publishedId || null,
        basedOnT017Id: base?.t017Id || null,
        sourceDeliveryId: command.sourceDeliveryId || base?.sourceDeliveryId || null,
        actorRef: command.actorRef,
        changeSummary: command.changeSummary
      });
      this._audit(state, command, 'Draft.create', 'created', {
        sourceVersion: base?.semanticVersion || 'none',
        targetVersion: `${draft.draftId}:1`,
        refs: [draft.draftId]
      });
      return draft;
    }).result;
  }

  saveDraft(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    assertM01Owner(command);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const draft = state.drafts[command.draftId];
      if (!draft) fail('DRAFT_NOT_FOUND', 'Draft does not exist', { draftId: command.draftId });
      if (draft.lifecycleState === 'published') fail('DRAFT_ALREADY_PUBLISHED', 'a Published Draft cannot be modified; derive a revision Draft instead');
      if (draft.lifecycleState === 'abandoned') fail('DRAFT_ABANDONED', 'an abandoned Draft cannot be modified');
      const current = currentDraftRevision(draft);
      if (command.expectedContentRevision !== undefined && command.expectedContentRevision !== current.contentRevision) {
        fail('DRAFT_REVISION_CONFLICT', 'Draft changed before save', {
          expectedContentRevision: command.expectedContentRevision,
          actualContentRevision: current.contentRevision
        });
      }
      const content = normalizeSemanticContent(command.content, {
        ontologyId: draft.ontologyId,
        name: current.content.name,
        description: current.content.description
      });
      if (content.ontologyId !== draft.ontologyId) fail('ONTOLOGY_ID_IMMUTABLE', 'Draft ontologyId cannot change');
      const now = this._now(command.savedAt);
      const revision = {
        contentRevision: current.contentRevision + 1,
        contentDigest: payloadDigest(content),
        content,
        savedAt: now,
        actorRef: command.actorRef || 'M01_SYSTEM',
        changeSummary: command.changeSummary || 'Draft saved'
      };
      draft.revisions.push(revision);
      draft.updatedAt = now;
      draft.lifecycleState = 'draft-unvalidated';
      draft.lifecycleStatus = 'draft';
      draft.status = 'Draft';
      draft.validation = null;
      this._audit(state, command, 'Draft.save', 'saved', {
        sourceVersion: `${draft.draftId}:${current.contentRevision}`,
        targetVersion: `${draft.draftId}:${revision.contentRevision}`,
        refs: [draft.draftId]
      });
      return draft;
    }).result;
  }

  validateDraft(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const draft = state.drafts[command.draftId];
      if (!draft) fail('DRAFT_NOT_FOUND', 'Draft does not exist', { draftId: command.draftId });
      if (draft.lifecycleState === 'published') fail('DRAFT_ALREADY_PUBLISHED', 'Published content is immutable');
      const revision = currentDraftRevision(draft);
      if (command.expectedContentRevision !== undefined && command.expectedContentRevision !== revision.contentRevision) {
        fail('DRAFT_REVISION_CONFLICT', 'Draft changed before validation');
      }
      const validation = validateSemanticContent(revision.content);
      const errors = [...validation.errors];
      const delivery = draft.sourceDeliveryId ? state.deliveryRecords[draft.sourceDeliveryId] : null;
      const mappingStarted = text(revision.content.sourceMappingVersion) || isRecord(revision.content.mapping);
      if (mappingStarted && (!delivery || delivery.receipt.status !== 'accepted' || !delivery.payload)) {
        errors.push({ code: 'C003_ACCEPTED_REQUIRED', path: 'draft.sourceDeliveryId', message: 'an accepted exact C003 delivery is required' });
      } else if (mappingStarted) {
        const mapping = revision.content.mapping;
        const memberIds = mapping?.memberIds || [];
        const relationIds = mapping?.relationIds || [];
        if (!exactSet(memberIds, delivery.payload.expectedScope.memberIds)) {
          errors.push({ code: 'MAPPING_MEMBER_SCOPE_MISMATCH', path: 'content.mapping.memberIds', message: 'mapping must cover the exact delivered member scope' });
        }
        if (!exactSet(relationIds, delivery.payload.expectedScope.relationIds)) {
          errors.push({ code: 'MAPPING_RELATION_SCOPE_MISMATCH', path: 'content.mapping.relationIds', message: 'mapping must cover the exact delivered relation scope' });
        }
      }
      const now = this._now(command.checkedAt);
      draft.validation = {
        status: errors.length === 0 ? 'passed' : 'blocked',
        contentRevision: revision.contentRevision,
        contentDigest: revision.contentDigest,
        checkedAt: now,
        errors,
        evidenceRefs: cloneJson(command.evidenceRefs || [])
      };
      draft.lifecycleState = errors.length === 0 ? 'draft-validated' : 'draft-blocked';
      draft.lifecycleStatus = errors.length === 0 ? 'validated' : 'blocked';
      draft.status = errors.length === 0 ? 'validated' : 'blocked';
      this._audit(state, command, 'Draft.validate', draft.validation.status, {
        sourceVersion: `${draft.draftId}:${revision.contentRevision}`,
        targetVersion: `${draft.draftId}:${revision.contentRevision}`,
        refs: [draft.draftId]
      });
      return draft.validation;
    }).result;
  }

  publishDraft(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    assertM01Owner(command);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const draft = state.drafts[command.draftId];
      if (!draft) fail('DRAFT_NOT_FOUND', 'Draft does not exist', { draftId: command.draftId });
      if (draft.lifecycleState === 'published') return state.published[draft.publishedId];
      const revision = currentDraftRevision(draft);
      if (command.expectedContentRevision !== revision.contentRevision) fail('DRAFT_REVISION_CONFLICT', 'Draft changed before publish');
      if (!draft.validation || draft.validation.status !== 'passed'
          || draft.validation.contentRevision !== revision.contentRevision
          || draft.validation.contentDigest !== revision.contentDigest) {
        fail('DRAFT_VALIDATION_REQUIRED', 'the exact Draft content revision must pass validation before publish');
      }
      if (command.failPublish === true || command.simulateFailure === true) {
        fail('PUBLISH_FAILED', 'the Published version was not formed; the prior Published state remains authoritative');
      }
      if (typeof command.beforeCommit === 'function') {
        try {
          command.beforeCommit({ draftId: draft.draftId, contentRevision: revision.contentRevision });
        } catch (error) {
          fail('PUBLISH_FAILED', 'the Published version was not formed', { cause: error.message });
        }
      }
      const semanticVersion = assertText(command.semanticVersion || `${draft.ontologyId}-v${state.counters.published + 1}`, 'semanticVersion', { token: true, code: 'PUBLISH_INVALID' });
      const duplicate = state.publishedOrder.map((id) => state.published[id]).find((item) => item.ontologyId === draft.ontologyId && item.semanticVersion === semanticVersion);
      if (duplicate) {
        if (duplicate.contentDigest === revision.contentDigest && duplicate.sourceDraftId === draft.draftId) return duplicate;
        fail('SEMANTIC_VERSION_CONFLICT', 'semanticVersion already identifies different Published content');
      }
      state.counters.published += 1;
      const publishedAt = this._now(command.publishedAt);
      const publishedId = command.publishedId || this._id('M01-PUBLISHED', {
        ontologyId: draft.ontologyId,
        semanticVersion,
        sequence: state.counters.published,
        scenarioContext: state.scenarioContext
      });
      const t017Id = command.t017Id || this._id('T017', { publishedId, semanticVersion });
      if (state.published[publishedId]) fail('PUBLISHED_ID_CONFLICT', 'publishedId already exists');
      const existingT017 = state.publishedOrder.map((id) => state.published[id]).find((item) => item.t017Id === t017Id);
      if (existingT017 && (existingT017.contentDigest !== revision.contentDigest || existingT017.ontologyId !== draft.ontologyId)) {
        fail('T017_ID_CONFLICT', 't017Id already identifies another immutable Published version');
      }
      if (existingT017) return existingT017;
      const resources = cloneJson(revision.content.resources);
      const published = {
        schemaVersion: SCHEMA_VERSIONS.T017,
        contractCode: 'C007',
        resourceType: 'T017',
        publishedId,
        id: publishedId,
        versionId: publishedId,
        semanticVersionId: publishedId,
        t017Id,
        ontologyId: draft.ontologyId,
        semanticVersion,
        lifecycleState: 'Published',
        lifecycleStatus: 'published',
        publicationStatus: 'published',
        status: 'Published',
        immutable: true,
        publishedAt,
        effectiveFrom: revision.content.effectiveFrom || publishedAt,
        effectiveTo: revision.content.effectiveTo || null,
        sourceDraftId: draft.draftId,
        sourceDraftContentRevision: revision.contentRevision,
        sourceDeliveryId: draft.sourceDeliveryId,
        sourceDeliverySnapshot: draft.sourceDeliverySnapshot || null,
        sourceContractFingerprint: draft.sourceContractFingerprint || null,
        sourceMappingVersion: revision.content.sourceMappingVersion,
        contentDigest: revision.contentDigest,
        content: cloneJson(revision.content),
        resources,
        ...splitResources(resources),
        scenarioContext: cloneJson(state.scenarioContext),
        evidenceRefs: cloneJson(command.evidenceRefs || []),
        owner: 'M01',
        readOnly: true
      };
      const sealedPublished = sealIntegrity(published);
      state.published[publishedId] = cloneJson(sealedPublished);
      state.publishedOrder.push(publishedId);
      draft.lifecycleState = 'published';
      draft.lifecycleStatus = 'published';
      draft.status = 'published';
      draft.publishedId = publishedId;
      draft.updatedAt = publishedAt;
      this._audit(state, command, 'T017.publish', 'published', {
        sourceVersion: `${draft.draftId}:${revision.contentRevision}`,
        targetVersion: semanticVersion,
        refs: [draft.draftId, publishedId, t017Id]
      });
      return sealedPublished;
    }).result;
  }

  publish(command = {}) { return this.publishDraft(command); }

  deriveDraftFromPublished(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    const state = this.repository.read(context);
    const published = state.published[command.publishedId];
    if (!published) fail('PUBLISHED_NOT_FOUND', 'Published semantic version does not exist');
    return this.createDraft({
      ...command,
      scenarioContext: context,
      ontologyId: published.ontologyId,
      basedOnPublishedId: published.publishedId,
      sourceDeliveryId: published.sourceDeliveryId,
      content: published.content,
      changeSummary: command.changeSummary || `Revision derived from ${published.semanticVersion}`
    });
  }

  readDraft(command = {}) {
    const context = this._context(command.scenarioContext);
    const draft = this.repository.read(context).drafts[command.draftId];
    if (!draft) fail('DRAFT_NOT_FOUND', 'Draft does not exist');
    return draft;
  }

  readPublished(command = {}) {
    const context = this._context(command.scenarioContext);
    const published = this.repository.read(context).published[command.publishedId];
    if (!published) fail('PUBLISHED_NOT_FOUND', 'Published semantic version does not exist');
    return published;
  }

  _publishedResourceView(published, acceptedTypes) {
    const resources = published.resources.filter((resource) => acceptedTypes.includes(resource.type)).map((resource) => ({
      stableResourceId: resource.id,
      resourceId: resource.id,
      resourceType: resource.type,
      name: resource.name,
      definition: resource.definition,
      publishedId: published.publishedId,
      t017Id: published.t017Id,
      publishedSemanticVersion: published.semanticVersion,
      publicationStatus: published.publicationStatus,
      effectiveFrom: resource.effectiveFrom || published.effectiveFrom,
      effectiveTo: resource.effectiveTo || published.effectiveTo,
      dependencyIds: cloneJson(resource.dependencyIds || []),
      allowedLinkDirections: resource.type === 'LinkType' ? cloneJson(resource.allowedDirections || []) : undefined,
      sourceObjectTypeId: resource.sourceObjectTypeId || undefined,
      targetObjectTypeId: resource.targetObjectTypeId || undefined,
      objectTypeId: resource.objectTypeId || undefined,
      applicableObjectTypeId: resource.applicableObjectTypeId || undefined,
      formula: resource.formula || undefined,
      unit: resource.unit || undefined,
      condition: resource.condition || undefined,
      parameters: resource.parameters ? cloneJson(resource.parameters) : undefined,
      confirmationRequired: resource.confirmationRequired,
      metadata: cloneJson(resource.metadata || {}),
      evidenceRefs: cloneJson(published.evidenceRefs || []),
      scenarioContext: cloneJson(published.scenarioContext),
      readOnly: true
    }));
    return immutable(resources, 'Published semantic resource view');
  }

  readC004(command = {}) {
    const published = this.readPublished(command);
    return immutable({
      schemaVersion: SCHEMA_VERSIONS.C004,
      contractCode: 'C004',
      publishedId: published.publishedId,
      t017Id: published.t017Id,
      semanticVersion: published.semanticVersion,
      status: 'published',
      lifecycleStatus: 'published',
      scenarioContext: cloneJson(published.scenarioContext),
      resources: this._publishedResourceView(published, ['ObjectType', 'Property', 'LinkType']),
      readOnly: true
    }, 'C004 semantic resource view');
  }

  readC005(command = {}) {
    const published = this.readPublished(command);
    return immutable({
      schemaVersion: SCHEMA_VERSIONS.C005,
      contractCode: 'C005',
      publishedId: published.publishedId,
      t017Id: published.t017Id,
      semanticVersion: published.semanticVersion,
      status: 'published',
      lifecycleStatus: 'published',
      scenarioContext: cloneJson(published.scenarioContext),
      resources: this._publishedResourceView(published, ['Metric', 'Rule']),
      readOnly: true
    }, 'C005 semantic resource view');
  }

  readC006(command = {}) {
    const published = this.readPublished(command);
    return immutable({
      schemaVersion: SCHEMA_VERSIONS.C006,
      contractCode: 'C006',
      publishedId: published.publishedId,
      t017Id: published.t017Id,
      semanticVersion: published.semanticVersion,
      status: 'published',
      lifecycleStatus: 'published',
      scenarioContext: cloneJson(published.scenarioContext),
      resources: this._publishedResourceView(published, ['ActionType']),
      readOnly: true
    }, 'C006 semantic resource view');
  }

  readC007(command = {}) {
    const published = this.readPublished(command);
    return immutable({
      schemaVersion: SCHEMA_VERSIONS.C007,
      contractCode: 'C007',
      publishedId: published.publishedId,
      t017Id: published.t017Id,
      ontologyId: published.ontologyId,
      semanticVersion: published.semanticVersion,
      publicationStatus: published.publicationStatus,
      status: 'published',
      lifecycleStatus: 'published',
      publishedAt: published.publishedAt,
      effectiveFrom: published.effectiveFrom,
      effectiveTo: published.effectiveTo,
      contentDigest: published.contentDigest,
      resourceSummary: published.resources.map((resource) => ({ id: resource.id, type: resource.type })),
      evidenceRefs: cloneJson(published.evidenceRefs),
      scenarioContext: cloneJson(published.scenarioContext),
      readOnly: true
    }, 'C007 Published version view');
  }

  createRefreshTarget(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    assertM01Owner(command);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const t054Id = assertText(command.t054Id, 't054Id', { token: true, code: 'T054_INVALID' });
      const bindingVersion = assertText(command.bindingVersion, 'bindingVersion', { token: true, code: 'T054_INVALID' });
      const requestedStatus = normalizeStatus(command.status || command.bindingStatus || 'available');
      assertEnum(requestedStatus, C032_STATUSES.filter((status) => status !== 'not-established'), 'status', 'T054_UNKNOWN_STATUS');
      const versions = state.refreshTargets[t054Id] || [];
      const sameVersion = versions.find((target) => target.bindingVersion === bindingVersion);
      const commandDigest = payloadDigest({
        ...command,
        scenarioContext: context,
        expectedStateRevision: undefined
      });
      if (sameVersion) {
        if (sameVersion.commandDigest === commandDigest) return sameVersion;
        fail('T054_VERSION_CONFLICT', 'T054 bindingVersion already identifies different content', { t054Id, bindingVersion });
      }

      let status = requestedStatus;
      let reason = command.reason || null;
      const publishedId = command.publishedId || command.semanticVersionId || null;
      const t017Id = command.t017Id || command.semanticVersionId || null;
      const published = publishedId ? state.published[publishedId] : null;
      if (!published || (t017Id && published.t017Id !== t017Id)) {
        status = command.draftId ? 'draft-or-unpublished' : 't017-unlocatable';
        reason = reason || (command.draftId ? 'target references Draft or unpublished semantic content' : 'exact T017 cannot be located');
      }
      const delivery = published?.sourceDeliveryId ? state.deliveryRecords[published.sourceDeliveryId] : null;
      const t006Id = command.t006Id || delivery?.payload?.t006Id || null;
      if (published && (!delivery || delivery.receipt?.status !== 'accepted' || !delivery.payload)) {
        status = 't017-unlocatable';
        reason = reason || 'the Published T017 source delivery is not an accepted, locatable C003 record';
      }
      if (delivery?.payload && command.t006Id && command.t006Id !== delivery.payload.t006Id) {
        status = 'asset-mismatch';
        reason = reason || 'T054 target T006 does not match the exact Published source delivery';
      }
      if (delivery?.payload && command.t007Version && command.t007Version !== delivery.payload.t007Version) {
        status = 'asset-mismatch';
        reason = reason || 'T054 target T007 does not match the exact Published source delivery';
      }
      const sourceMappingVersion = command.sourceMappingVersion || command.mappingVersion;
      if (published && (!text(sourceMappingVersion) || sourceMappingVersion !== published.sourceMappingVersion)) {
        status = 'mapping-unlocatable';
        reason = reason || 'source mapping version does not match the exact Published T017';
      }
      const memberIds = (command.coverage?.memberIds || []).map(String);
      const relationIds = (command.coverage?.relationIds || []).map(String);
      assertUnique(memberIds, String, 'coverage.memberIds');
      assertUnique(relationIds, String, 'coverage.relationIds');
      if (delivery?.payload && (!exactSet(memberIds, delivery.payload.expectedScope.memberIds)
          || !exactSet(relationIds, delivery.payload.expectedScope.relationIds))) {
        status = 'coverage-insufficient';
        reason = reason || 'T054 does not exactly cover the delivered members and relations';
      }
      const ownerRef = command.ownerRef || command.owner;
      const verifiedAt = command.verifiedAt || command.lastVerifiedAt;
      const evidenceRefs = command.evidenceRefs || command.evidence || [];
      if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0 || evidenceRefs.some((ref) => !text(String(ref)))) {
        fail('T054_INVALID', 'T054 evidenceRefs must contain non-empty references');
      }
      if (!text(ownerRef) || !text(verifiedAt) || !Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
        if (status === 'available') {
          status = 'unknown';
          reason = reason || 'Owner verification or evidence is incomplete';
        }
      } else {
        assertDateTime(verifiedAt, 'verifiedAt', 'T054_INVALID');
      }
      if (requestedStatus === 'disabled') status = 'disabled';
      const allowSubmit = status === 'available';
      const target = sealIntegrity({
        schemaVersion: SCHEMA_VERSIONS.T054,
        resourceType: 'T054',
        t054Id,
        targetId: t054Id,
        bindingId: t054Id,
        bindingVersion,
        name: command.name || t054Id,
        status,
        normalizedStatus: status,
        allowSubmit,
        allowRefreshSubmission: allowSubmit,
        publishedId: published?.publishedId || publishedId || null,
        t017Id: published?.t017Id || t017Id || null,
        semanticVersion: published?.semanticVersion || null,
        sourceMappingVersion: sourceMappingVersion || null,
        mappingVersion: sourceMappingVersion || null,
        t006Id,
        assetId: t006Id,
        t007Version: command.t007Version || delivery?.payload?.t007Version || null,
        assetVersionId: command.t007Version || delivery?.payload?.t007Version || null,
        coverage: { memberIds, relationIds },
        ownerRef: ownerRef || null,
        verifiedAt: verifiedAt || null,
        reason,
        recoverySuggestion: command.recoverySuggestion || null,
        evidenceRefs: cloneJson(evidenceRefs),
        scenarioContext: cloneJson(state.scenarioContext),
        formedAt: this._now(command.formedAt),
        commandDigest,
        readOnly: true
      });
      state.refreshTargets[t054Id] = versions.concat(cloneJson(target));
      if (!state.refreshTargetOrder.includes(t054Id)) state.refreshTargetOrder.push(t054Id);
      this._audit(state, command, 'T054.version', status, {
        sourceVersion: versions.at(-1)?.bindingVersion || 'none',
        targetVersion: bindingVersion,
        refs: [t054Id, published?.t017Id].filter(Boolean),
        reasonCode: status === 'available' ? null : status
      });
      return target;
    }).result;
  }

  _latestTarget(state, t054Id) {
    const versions = state.refreshTargets[t054Id] || [];
    const seenVersions = new Set();
    versions.forEach((target) => {
      if (seenVersions.has(target.bindingVersion)) fail('T054_DUPLICATE_VERSION', 'T054 contains duplicate binding versions');
      seenVersions.add(target.bindingVersion);
      verifyIntegrity(target, { label: 'T054', code: 'T054_CORRUPT' });
    });
    return versions[versions.length - 1] || null;
  }

  _projectTargetForAsset(target, t006Id, clientMode) {
    let normalizedStatus = target.status;
    let reason = target.reason;
    if (target.t006Id !== t006Id) {
      normalizedStatus = 'asset-mismatch';
      reason = 'T054 belongs to another stable T006';
    }
    const status = clientMode ? (C032_CLIENT_STATUS[normalizedStatus] || normalizedStatus) : normalizedStatus;
    return {
      t054Id: target.t054Id,
      targetId: target.t054Id,
      bindingId: target.t054Id,
      bindingVersion: target.bindingVersion,
      name: target.name,
      status,
      normalizedStatus,
      allowSubmit: normalizedStatus === 'available',
      allowRefreshSubmission: normalizedStatus === 'available',
      publishedId: target.publishedId,
      t017Id: target.t017Id,
      semanticVersion: target.semanticVersion,
      sourceMappingVersion: target.sourceMappingVersion,
      mappingVersion: target.sourceMappingVersion,
      t006Id: target.t006Id,
      assetId: target.t006Id,
      coverage: cloneJson(target.coverage),
      ownerRef: target.ownerRef,
      verifiedAt: target.verifiedAt,
      reason,
      recoverySuggestion: target.recoverySuggestion,
      evidenceRefs: cloneJson(target.evidenceRefs),
      targetFingerprint: target.integrity.digest,
      scenarioContext: cloneJson(target.scenarioContext),
      readOnly: true
    };
  }

  discoverC032(request = {}) {
    const context = this._context(request.scenarioContext, { write: false });
    const t006Id = assertText(request.t006Id || request.assetId, 'assetId', { token: true, code: 'C032_INVALID' });
    const clientMode = request.requester === 'm02' || request.sourceModule === 'data-engineering';
    return this.repository.transaction(context, { readOnly: context.status !== 'active' && context.status !== 'restored' }, (state) => {
      state.counters.discovery += 1;
      const formedAt = this._now(request.requestedAt);
      const candidates = state.refreshTargetOrder
        .map((id) => this._latestTarget(state, id))
        .filter(Boolean)
        .map((target) => this._projectTargetForAsset(target, t006Id, clientMode));
      const available = candidates.filter((candidate) => candidate.normalizedStatus === 'available');
      let normalizedStatus;
      if (available.length > 0) normalizedStatus = 'available';
      else if (candidates.length === 0) normalizedStatus = 'not-established';
      else normalizedStatus = candidates[0].normalizedStatus;
      const status = clientMode ? (C032_CLIENT_STATUS[normalizedStatus] || normalizedStatus) : normalizedStatus;
      const responseId = this._id('M01-C032', {
        scenarioContext: state.scenarioContext,
        t006Id,
        sequence: state.counters.discovery
      });
      const responseBase = {
        schemaVersion: SCHEMA_VERSIONS.C032,
        contractCode: 'C032',
        sourceModule: 'M01',
        owner: 'M01',
        responseId,
        responseVersion: String(state.counters.discovery),
        responseFingerprint: null,
        requestId: request.requestId || null,
        t006Id,
        assetId: t006Id,
        status,
        normalizedStatus,
        readStatus: normalizedStatus === 'not-established' ? 'empty' : normalizedStatus,
        targetStatus: normalizedStatus,
        formedAt,
        readAt: this._now(),
        scenarioContext: cloneJson(state.scenarioContext),
        candidates,
        reasonCode: normalizedStatus === 'available' ? null : normalizedStatus,
        reason: normalizedStatus === 'not-established' ? 'no T054 exists for this C033 run' : candidates[0]?.reason || null,
        recovery: normalizedStatus === 'not-established' ? 'publish an exact T017 and let M01 explicitly establish and verify T054' : candidates[0]?.recoverySuggestion || null,
        readOnly: true
      };
      const response = sealIntegrity({
        ...responseBase,
        responseFingerprint: sha256(responseBase)
      });
      state.discoveries[responseId] = cloneJson(response);
      state.discoveryOrder.push(responseId);
      this._audit(state, request, 'C032.discover', normalizedStatus, {
        sourceVersion: t006Id,
        targetVersion: response.responseVersion,
        refs: [responseId, ...candidates.map((candidate) => candidate.t054Id)]
      });
      return response;
    }).result;
  }

  readC032(request = {}) { return this.discoverC032(request); }

  readT054(command = {}) {
    const context = this._context(command.scenarioContext);
    const state = this.repository.read(context);
    const target = this._latestTarget(state, command.t054Id || command.targetId || command.bindingId);
    if (!target) fail('T054_NOT_FOUND', 'T054 binding does not exist');
    return immutable(target, 'T054 read');
  }

  createT054(command = {}) { return this.createRefreshTarget(command); }

  _c028Receipt(state, request, status, details = {}) {
    const target = request.target || {};
    return {
      schemaVersion: SCHEMA_VERSIONS.C028,
      contractCode: 'C028',
      sourceModule: 'M01',
      actorRef: request.actorRef || 'M02',
      traceId: request.traceId || null,
      correlationId: request.correlationId || null,
      receiptId: this._id('M01-C028-RECEIPT', { requestId: request.requestId, scenarioContext: state.scenarioContext }),
      requestId: request.requestId,
      status,
      requestStatus: status === 'accepted' ? '已受理' : status === 'rejected' ? '已拒绝' : '结果未知',
      receivedAt: details.receivedAt || this._now(),
      reasonCode: details.reasonCode || null,
      reason: details.reason || null,
      t006Id: request.t006Id || request.assetId,
      assetId: request.t006Id || request.assetId,
      t007Version: request.t007Version || request.assetVersionId,
      assetVersionId: request.t007Version || request.assetVersionId,
      deliveryId: request.deliveryId,
      t008AsOf: request.t008AsOf || normalizeAsOf(request.asOfTime),
      asOfTime: request.asOfTime || request.t008AsOf,
      target: cloneJson(target),
      discovery: cloneJson(request.discovery),
      discoveryResponseId: request.discovery?.responseId || null,
      discoveryResponseVersion: request.discovery?.responseVersion || null,
      discoveryResponseFingerprint: request.discovery?.responseFingerprint || request.discovery?.integrity?.digest || null,
      preSubmitReread: details.preSubmitReread || null,
      scenarioContext: cloneJson(state.scenarioContext),
      existingT019Snapshot: details.existingT019Snapshot || null,
      readOnly: true
    };
  }

  submitC028(input = {}) {
    if (input.callerModule && !['M02', 'data-engineering'].includes(input.callerModule)) fail('OWNER_BOUNDARY_VIOLATION', 'only M02/data-engineering may submit C028');
    if (input.sourceModule && !['M02', 'data-engineering'].includes(input.sourceModule)) fail('OWNER_BOUNDARY_VIOLATION', 'only M02/data-engineering may submit C028');
    if (input.consumerModule && input.consumerModule !== 'M02') fail('OWNER_BOUNDARY_VIOLATION', 'only M02/data-engineering may submit C028');
    const request = isRecord(input.payload)
      ? (() => {
          if (!input.eventType) return { ...cloneJson(input.payload), scenarioContext: input.scenarioContext || input.payload.scenarioContext, actorRef: input.actorRef, traceId: input.traceId, correlationId: input.correlationId };
          const envelope = assertEnvelope(input, { schemaVersion: SCHEMA_VERSIONS.C028, eventType: EVENT_TYPES.C028_REQUEST });
          return { ...cloneJson(envelope.payload), scenarioContext: envelope.scenarioContext, actorRef: envelope.actorRef, traceId: envelope.traceId, correlationId: envelope.correlationId };
        })()
      : cloneJson(input, 'C028 request');
    const context = this._context(request.scenarioContext, { write: true });
    const requestId = assertText(request.requestId, 'requestId', { token: true, code: 'C028_INVALID' });
    request.requestId = requestId;
    request.t006Id = request.t006Id || request.assetId;
    request.t007Version = request.t007Version || request.assetVersionId;
    request.t008AsOf = request.t008AsOf || normalizeAsOf(request.asOfTime);
    request.target = cloneJson(request.target || {});
    request.discovery = cloneJson(request.discovery || {});
    const incomingDigest = businessDigest(request, [
      'traceId', 'correlationId', 'actorRef', 'actor', 'requestedAt', 'receivedAt', 'idempotencyKey',
      'contractCode', 'schemaVersion', 'eventId', 'eventType', 'occurredAt'
    ]);
    return this.repository.transaction(context, {}, (state) => {
      const existing = state.refreshRequests[requestId];
      if (existing) {
        if (existing.inputDigest !== incomingDigest) fail('C028_IDEMPOTENCY_CONFLICT', 'the same C028 requestId identifies different content');
        return existing.receipt;
      }
      let rejection = null;
      let delivery = null;
      let discovery = null;
      let liveTarget = null;
      try {
        assertText(request.t006Id, 'assetId', { token: true, code: 'C028_INVALID' });
        assertText(request.t007Version, 'assetVersionId', { token: true, code: 'C028_INVALID' });
        assertText(request.deliveryId, 'deliveryId', { token: true, code: 'C028_INVALID' });
        assertText(request.discovery.responseId, 'discovery.responseId', { token: true, code: 'C028_INVALID' });
        assertText(request.discovery.responseVersion, 'discovery.responseVersion', { code: 'C028_INVALID' });
        assertText(request.discovery.responseFingerprint || request.discovery.integrity?.digest, 'discovery.responseFingerprint', { token: true, code: 'C028_INVALID' });
        const t054Id = request.target.t054Id || request.target.targetId || request.target.bindingId;
        assertText(t054Id, 'target.t054Id', { token: true, code: 'C028_INVALID' });
        request.target.t054Id = t054Id;
        request.target.targetId = t054Id;
        request.target.bindingId = t054Id;
        delivery = state.deliveryRecords[request.deliveryId];
        if (!delivery || delivery.receipt.status !== 'accepted' || !delivery.payload) fail('C003_ACCEPTED_REQUIRED', 'C028 requires an accepted C003 delivery');
        if (delivery.payload.t006Id !== request.t006Id || delivery.payload.t007Version !== request.t007Version
            || delivery.payload.t008.asOf !== request.t008AsOf) {
          fail('C028_CANDIDATE_MISMATCH', 'C028 candidate does not match the accepted C003 T006/T007/T008');
        }
        discovery = state.discoveries[request.discovery.responseId];
        if (!discovery || discovery.responseVersion !== String(request.discovery.responseVersion)) fail('C032_RESPONSE_NOT_FOUND', 'C028 must reference an exact stored C032 response');
        verifyIntegrity(discovery, { label: 'C032 response', code: 'C032_CORRUPT' });
        validateC032ResponseFingerprint(discovery);
        if (request.discovery.responseFingerprint && request.discovery.responseFingerprint !== discovery.responseFingerprint) fail('C032_DRIFT', 'C028 discovery response fingerprint does not match the stored response');
        assertSameContext(state.scenarioContext, discovery.scenarioContext);
        if (discovery.t006Id !== request.t006Id) fail('C032_ASSET_MISMATCH', 'C032 response belongs to another T006');
        liveTarget = this._latestTarget(state, t054Id);
        if (!liveTarget) fail('T054_NOT_FOUND', 'selected T054 no longer exists');
        verifyIntegrity(liveTarget, { label: 'T054', code: 'T054_CORRUPT' });
        if (liveTarget.status !== 'available' || liveTarget.allowSubmit !== true) fail('T054_NOT_AVAILABLE', 'selected T054 is not available at submit-time reread', { status: liveTarget.status });
        if (liveTarget.t006Id !== request.t006Id) fail('T054_ASSET_MISMATCH', 'selected T054 belongs to another T006');
        if (liveTarget.bindingVersion !== request.target.bindingVersion
            || liveTarget.t017Id !== request.target.t017Id
            || liveTarget.sourceMappingVersion !== (request.target.sourceMappingVersion || request.target.mappingVersion)) {
          fail('C032_DRIFT', 'T054 changed after the cited C032 response');
        }
        const responseTarget = discovery.candidates.find((candidate) => candidate.t054Id === t054Id);
        if (!responseTarget || responseTarget.bindingVersion !== liveTarget.bindingVersion
            || responseTarget.targetFingerprint !== liveTarget.integrity.digest) {
          fail('C032_DRIFT', 'cited C032 response and live T054 do not identify the same binding');
        }
      const current = state.t019.current;
      const providedSnapshot = request.existingT019Snapshot || request.existingT019;
      if (!providedSnapshot) fail('T019_SNAPSHOT_REQUIRED', 'C028 must carry the exact pre-submit T019 snapshot, including an explicit empty snapshot');
      if (providedSnapshot && providedSnapshot.t019Revision !== state.t019.revision) {
        fail('T019_SNAPSHOT_MISMATCH', 'C028 pre-submit T019 revision is stale');
      }
      if (current && (!providedSnapshot || providedSnapshot.t019Revision !== state.t019.revision
            || providedSnapshot.combinationId !== current.combinationId
            || (providedSnapshot.t019Id && providedSnapshot.t019Id !== current.t019Id)
            || (providedSnapshot.semanticVersion && providedSnapshot.semanticVersion !== current.semantic.semanticVersion)
            || (providedSnapshot.semanticVersionId && providedSnapshot.semanticVersionId !== current.semantic.publishedId)
            || (providedSnapshot.dataVersion && providedSnapshot.dataVersion !== current.data.t007Version)
            || (providedSnapshot.t006Id && providedSnapshot.t006Id !== current.data.t006Id)
            || (providedSnapshot.asOf && providedSnapshot.asOf !== current.data.t008AsOf))) {
          fail('T019_SNAPSHOT_MISMATCH', 'C028 must carry the exact pre-submit T019 snapshot');
        }
        if (!current && providedSnapshot && (providedSnapshot.combinationId || providedSnapshot.t019Id || providedSnapshot.semanticVersion || providedSnapshot.dataVersion)) {
          fail('T019_SNAPSHOT_MISMATCH', 'C028 claims a T019 that does not exist');
        }
      } catch (error) {
        rejection = safeError(error);
      }
      const status = rejection ? 'rejected' : 'accepted';
      const receipt = this._c028Receipt(state, request, status, {
        reasonCode: rejection?.code,
        reason: rejection?.message,
        preSubmitReread: liveTarget ? {
          readAt: this._now(),
          t054Id: liveTarget.t054Id,
          bindingVersion: liveTarget.bindingVersion,
          targetFingerprint: liveTarget.integrity.digest,
          status: liveTarget.status
        } : null,
        existingT019Snapshot: state.t019.current ? {
          t019Revision: state.t019.revision,
          combinationId: state.t019.current.combinationId,
          t019Id: state.t019.current.t019Id
        } : { t019Revision: state.t019.revision, combinationId: null, t019Id: null }
      });
      state.refreshRequests[requestId] = {
        inputDigest: incomingDigest,
        request: cloneJson(request),
        receipt
      };
      state.refreshRequestOrder.push(requestId);
      this._audit(state, request, 'C028.receive', status, {
        sourceVersion: request.t007Version || 'invalid',
        targetVersion: request.target?.bindingVersion || 'invalid',
        refs: [requestId, request.deliveryId, request.target?.t054Id].filter(Boolean),
        reasonCode: rejection?.code
      });
      return receipt;
    }).result;
  }

  completeC029(command = {}) {
    if (command.callerModule && command.callerModule !== 'M01') fail('OWNER_BOUNDARY_VIOLATION', 'only M01 may form C029/T018');
    if (command.sourceModule && command.sourceModule !== 'M01') fail('OWNER_BOUNDARY_VIOLATION', 'only M01 may form C029/T018');
    if (command.consumerModule && command.consumerModule !== 'M01') fail('OWNER_BOUNDARY_VIOLATION', 'only M01 may form C029/T018');
    const context = this._context(command.scenarioContext, { write: true });
    const normalized = normalizeC029Command(command);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const requestRecord = state.refreshRequests[normalized.requestId];
      if (!requestRecord || requestRecord.receipt.status !== 'accepted') fail('C028_ACCEPTED_REQUIRED', 'C029 requires an accepted C028 request');
      const request = requestRecord.request;
      if (command.target) {
        const requestedTargetId = command.target.t054Id || command.target.targetId || command.target.bindingId;
        const requestTargetId = request.target.t054Id || request.target.targetId || request.target.bindingId;
        if (requestedTargetId !== requestTargetId || (command.target.bindingVersion && command.target.bindingVersion !== request.target.bindingVersion)) fail('C029_TARGET_MISMATCH', 'C029 target differs from the exact C028 target');
      }
      const candidateSemanticVersion = command.semanticVersionId || command.semanticVersion;
      const candidateDataVersion = command.dataVersion || command.assetVersionId || command.t007Version;
      const targetPublished = state.publishedOrder.map((id) => state.published[id]).find((item) => item.t017Id === request.target.t017Id);
      if (candidateSemanticVersion && !new Set([request.target.t017Id, request.target.semanticVersion, targetPublished?.publishedId].filter(Boolean)).has(candidateSemanticVersion)) fail('C029_CANDIDATE_VERSION_MISMATCH', 'C029 semantic version does not match C028 target');
      if (candidateDataVersion && candidateDataVersion !== request.t007Version) fail('C029_CANDIDATE_VERSION_MISMATCH', 'C029 data version does not match C028 candidate');
      if (command.candidateScenarioContext) assertSameContext(context, command.candidateScenarioContext, { code: 'C029_CONTEXT_MISMATCH' });
      const resultId = normalized.resultId || this._id('M01-C029', {
        requestId: normalized.requestId,
        normalized,
        scenarioContext: state.scenarioContext
      });
      const inputDigest = payloadDigest({ ...normalized, resultId, scenarioContext: context });
      const existing = state.refreshResults[resultId];
      if (existing) {
        if (existing.inputDigest !== inputDigest) fail('C029_IDEMPOTENCY_CONFLICT', 'the same C029 resultId identifies different content');
        return existing.result;
      }
      state.counters.result += 1;
      state.counters.qualification += 1;
      const formedAt = this._now(command.formedAt);
      const qualificationStatus = normalized.status === 'succeeded' ? 'eligible'
        : ['failed', 'incompatible'].includes(normalized.status) ? 'ineligible' : 'unknown';
      const qualificationId = this._id('T018', {
        resultId,
        requestId: request.requestId,
        sequence: state.counters.qualification
      });
      const t019Snapshot = state.t019.current ? {
        t019Revision: state.t019.revision,
        combinationId: state.t019.current.combinationId,
        t019Id: state.t019.current.t019Id,
        semanticVersion: state.t019.current.semantic.semanticVersion,
        dataVersion: state.t019.current.data.t007Version
      } : { t019Revision: state.t019.revision, combinationId: null, t019Id: null };
      const target = request.target;
      const qualification = {
        schemaVersion: SCHEMA_VERSIONS.T018,
        resourceType: 'T018',
        qualificationId,
        id: qualificationId,
        status: qualificationStatus,
        eligibilityStatus: qualificationStatus === 'eligible' ? '可消费候选' : qualificationStatus === 'ineligible' ? '尚未形成' : '结果待核对',
        requestId: request.requestId,
        basedOnC029ResultId: resultId,
        publishedId: state.publishedOrder.map((id) => state.published[id]).find((item) => item.t017Id === target.t017Id)?.publishedId || null,
        t017Id: target.t017Id,
        semanticVersion: state.publishedOrder.map((id) => state.published[id]).find((item) => item.t017Id === target.t017Id)?.semanticVersion || null,
        deliveryId: request.deliveryId,
        discoveryResponseId: request.discovery?.responseId || null,
        discoveryResponseVersion: request.discovery?.responseVersion || null,
        discoveryResponseFingerprint: request.discovery?.responseFingerprint || request.discovery?.integrity?.digest || null,
        t006Id: request.t006Id,
        t007Version: request.t007Version,
        assetVersionId: request.t007Version,
        t008AsOf: request.t008AsOf,
        asOfTime: request.asOfTime || request.t008AsOf,
        objectChecks: cloneJson(normalized.objectChecks),
        relationChecks: cloneJson(normalized.relationChecks),
        reason: normalized.reason,
        evidenceRefs: cloneJson(normalized.evidenceRefs),
        formedAt,
        scenarioContext: cloneJson(state.scenarioContext),
        readOnly: true
      };
      const result = {
        schemaVersion: SCHEMA_VERSIONS.C029,
        contractCode: 'C029',
        sourceModule: 'M01',
        actorRef: command.actorRef || 'M01_SYSTEM',
        traceId: command.traceId || null,
        correlationId: command.correlationId || null,
        resultId,
        id: resultId,
        requestId: request.requestId,
        status: normalized.status,
        resultStatus: normalized.status === 'succeeded' ? '成功' : normalized.status === 'failed' ? '失败' : normalized.status === 'processing' ? '处理中' : normalized.status === 'incompatible' ? '不兼容' : '未知',
        processingStatus: normalized.status,
        formedAt,
        scenarioContext: cloneJson(state.scenarioContext),
        t006Id: request.t006Id,
        assetId: request.t006Id,
        t007Version: request.t007Version,
        assetVersionId: request.t007Version,
        t008AsOf: request.t008AsOf,
        asOfTime: request.asOfTime || request.t008AsOf,
        deliveryId: request.deliveryId,
        target: cloneJson(target),
        discoveryResponseId: request.discovery?.responseId || null,
        discoveryResponseVersion: request.discovery?.responseVersion || null,
        discoveryResponseFingerprint: request.discovery?.responseFingerprint || request.discovery?.integrity?.digest || null,
        originalC028: { requestId: request.requestId, receiptId: requestRecord.receipt.receiptId },
        objectChecks: cloneJson(normalized.objectChecks),
        relationChecks: cloneJson(normalized.relationChecks),
        reason: normalized.reason,
        recoverySuggestion: normalized.recoverySuggestion,
        evidenceRefs: cloneJson(normalized.evidenceRefs),
        t018: cloneJson(qualification),
        t019Snapshot,
        readOnly: true
      };
      state.refreshResults[resultId] = { inputDigest, result };
      state.refreshResultOrder.push(resultId);
      state.qualifications[qualificationId] = qualification;
      state.qualificationOrder.push(qualificationId);
      if (normalized.status !== 'processing') {
        if (!state.t019.current && normalized.status !== 'succeeded') {
          state.t019.revision += 1;
          state.t019.transition = 'failed';
          state.t019.transitionReason = normalized.reason || `C029 ${normalized.status}`;
        }
        const candidateState = {
          sourceModule: 'M01',
          semanticVersionId: qualification.publishedId,
          semanticVersion: qualification.semanticVersion,
          dataVersion: qualification.t007Version,
          questionSetVersion: null,
          status: normalized.status === 'succeeded' ? 'passed' : normalized.status,
          items: [...normalized.objectChecks, ...normalized.relationChecks].map((item) => ({ id: item.id, status: item.status, evidenceRef: item.evidenceRef })),
          completedAt: formedAt,
          evidenceRefs: cloneJson(normalized.evidenceRefs),
          retryOf: null,
          scenarioContext: cloneJson(state.scenarioContext)
        };
        state.t019.pendingCandidateValidation = candidateState;
        refreshC008Projection(state, formedAt, {
          readStatus: state.t019.current ? 'ready' : (normalized.status === 'succeeded' ? 'empty' : 'failed'),
          reason: normalized.status === 'succeeded' ? null : (normalized.reason || `C029 ${normalized.status}`),
          recoverySuggestion: normalized.status === 'succeeded' ? null : 'repair the candidate and submit an associated C028 retry',
          candidateValidation: candidateState
        });
      }
      this._audit(state, command, 'C029.form', normalized.status, {
        sourceVersion: request.t007Version,
        targetVersion: target.t017Id,
        refs: [request.requestId, resultId, qualificationId]
      });
      return result;
    }).result;
  }

  recordC028(command = {}) { return this.submitC028(command); }
  processC028(command = {}) { return this.submitC028(command); }
  recordC029(command = {}) { return this.completeC029(command); }
  processC029(command = {}) { return this.completeC029(command); }
  formC029(command = {}) { return this.completeC029(command); }
  evaluateT018(command = {}) { return this.completeC029(command); }

  _resolveQualification(state, command) {
    const candidate = command.candidate || {};
    const qualificationId = command.qualificationId || command.t018Id || candidate.qualificationId || candidate.id;
    if (qualificationId && state.qualifications[qualificationId]) return state.qualifications[qualificationId];
    const resultId = command.resultId || command.c029ResultId || candidate.resultId || candidate.basedOnC029ResultId;
    if (resultId) {
      const resultRecord = state.refreshResults[resultId];
      if (resultRecord?.result?.t018) return resultRecord.result.t018;
      const byResult = state.qualificationOrder.map((id) => state.qualifications[id]).find((item) => item.basedOnC029ResultId === resultId);
      if (byResult) return byResult;
    }
    return null;
  }

  _resolveC029(state, command, qualification) {
    const resultId = command.resultId || command.c029ResultId || qualification?.basedOnC029ResultId;
    if (!resultId) return null;
    return state.refreshResults[resultId]?.result || null;
  }

  _normalizeGate(value, path) {
    if (value === true) return { status: 'passed', evidenceRefs: [] };
    if (typeof value === 'string') {
      const normalized = ['pass', 'passed', 'success', 'succeeded', 'eligible', 'ok'].includes(value.toLowerCase()) ? 'passed'
        : ['fail', 'failed', 'rejected', 'ineligible'].includes(value.toLowerCase()) ? 'failed' : 'unknown';
      return { status: normalized, evidenceRefs: [] };
    }
    if (!isRecord(value)) fail('T019_GATE_MISSING', `${path} must provide a gate result`);
    const status = ['pass', 'passed', 'success', 'succeeded', 'eligible', 'ok'].includes(String(value.status || value.outcome || '').toLowerCase()) ? 'passed'
      : ['fail', 'failed', 'rejected', 'ineligible'].includes(String(value.status || value.outcome || '').toLowerCase()) ? 'failed' : 'unknown';
    return {
      status,
      evidenceRefs: Array.isArray(value.evidenceRefs) ? cloneJson(value.evidenceRefs) : (value.evidenceRef ? [value.evidenceRef] : []),
      sourceModule: value.sourceModule || null,
      version: value.version || value.suiteVersion || null,
      details: value.details || null
    };
  }

  _candidateValidation(command, qualification, result, context) {
    const candidateValidation = command.candidateValidation || command.fixedQuestionValidation || command.consumerValidation || {};
    if (candidateValidation.sourceModule && !['M03', 'intelligent-query', 'query'].includes(candidateValidation.sourceModule)) fail('T019_GATE_SOURCE_INVALID', 'candidate validation must come from the authorized consumer validation owner');
    const candidateSemanticId = candidateValidation.semanticVersionId || candidateValidation.semanticVersion;
    const candidateDataId = candidateValidation.dataVersion || candidateValidation.assetVersionId;
    const questionSetVersion = candidateValidation.questionSetVersion || candidateValidation.suiteVersion;
    if (!candidateSemanticId || !candidateDataId || !questionSetVersion || !candidateValidation.completedAt) fail('T019_GATE_MISSING', 'candidate validation must carry exact semantic/data versions, question-set version, and completion time');
    if (candidateValidation.expiresAt && ((typeof candidateValidation.expiresAt === 'number' && Date.now() > candidateValidation.expiresAt)
        || (typeof candidateValidation.expiresAt === 'string' && Date.parse(candidateValidation.expiresAt) < Date.now()))) fail('T019_GATE_EXPIRED', 'candidate validation evidence has expired');
    const semanticIds = new Set([qualification.publishedId, qualification.t017Id, qualification.semanticVersion].filter(Boolean));
    if (candidateValidation.semanticVersionId && !semanticIds.has(candidateValidation.semanticVersionId)) fail('T019_CANDIDATE_VERSION_MISMATCH', 'candidate validation semantic version does not match T018');
    if (candidateValidation.semanticVersion && candidateValidation.semanticVersion !== qualification.semanticVersion) fail('T019_CANDIDATE_VERSION_MISMATCH', 'candidate validation semantic version does not match T018');
    if (candidateValidation.dataVersion && candidateValidation.dataVersion !== qualification.t007Version) fail('T019_CANDIDATE_VERSION_MISMATCH', 'candidate validation data version does not match T018');
    if (candidateValidation.assetVersionId && candidateValidation.assetVersionId !== qualification.t007Version) fail('T019_CANDIDATE_VERSION_MISMATCH', 'candidate validation asset version does not match T018');
    if (candidateValidation.scenarioContext) assertSameContext(context, candidateValidation.scenarioContext, { code: 'T019_CANDIDATE_CONTEXT_MISMATCH' });
    const items = Array.isArray(candidateValidation.items || candidateValidation.questions || candidateValidation.perQuestionStatus)
      ? (candidateValidation.items || candidateValidation.questions || candidateValidation.perQuestionStatus).map((item, index) => {
          const status = item.status || item.outcome;
          if (!CANDIDATE_ITEM_STATUSES.includes(status)) fail('T019_GATE_INVALID', `candidateValidation.items[${index}] has an unknown status`);
          return { id: item.id || `item-${index + 1}`, status, evidenceRef: item.evidenceRef || item.evidenceLocator || null };
        })
      : [];
    if (items.some((item) => item.status !== 'passed')) fail('T019_GATE_FAILED', 'every fixed-question validation item must pass before T019 adoption');
    const overallStatus = candidateValidation.overallStatus || candidateValidation.status || (items.length ? 'passed' : null);
    if (!overallStatus || !['passed', 'pass', 'succeeded', 'eligible'].includes(String(overallStatus).toLowerCase())) {
      fail('T019_GATE_MISSING', 'a completed fixed-question/consumer validation gate is required before T019 adoption');
    }
    const completedAt = candidateValidation.completedAt;
    assertDateTime(completedAt, 'candidateValidation.completedAt', 'T019_GATE_INVALID');
    const evidenceRefs = [
      ...(Array.isArray(candidateValidation.evidenceRefs) ? candidateValidation.evidenceRefs : []),
      ...(candidateValidation.evidenceRef ? [candidateValidation.evidenceRef] : []),
      ...items.map((item) => item.evidenceRef).filter(Boolean)
    ];
    if (evidenceRefs.length === 0) fail('T019_GATE_MISSING', 'candidate validation must provide an evidence reference');
    return {
      sourceModule: candidateValidation.sourceModule || 'M03',
      semanticVersionId: qualification.publishedId,
      semanticVersion: qualification.semanticVersion,
      dataVersion: qualification.t007Version,
      questionSetVersion,
      status: 'passed',
      items,
      completedAt,
      evidenceRefs: [...new Set(evidenceRefs.map(String))],
      retryOf: candidateValidation.retryOf || null,
      scenarioContext: cloneJson(context),
      resultId: result?.resultId || qualification.basedOnC029ResultId
    };
  }

  commitT019(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    assertM01Owner(command);
    if (command.consumerModule && command.consumerModule !== 'M01') fail('OWNER_BOUNDARY_VIOLATION', 'consumer modules cannot commit T019');
    if (command.actor && command.actor !== 'M01' && command.actor !== 'M01_SYSTEM') fail('OWNER_BOUNDARY_VIOLATION', 'consumer actors cannot commit T019');
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const qualificationHint = this._resolveQualification(state, command);
      const candidateRequestRecord = qualificationHint ? state.refreshRequests[qualificationHint.requestId] : null;
      const commandDigest = businessDigest(command, [
        'traceId',
        'correlationId',
        'actorRef',
        'expectedStateRevision',
        'expectedT019Revision'
      ]);
      const priorByIdempotency = command.idempotencyKey
        ? state.t019.history.find((item) => item.idempotencyKey === command.idempotencyKey)
        : null;
      if (priorByIdempotency) {
        if (priorByIdempotency.commandDigest !== commandDigest) fail('T019_IDEMPOTENCY_CONFLICT', 'T019 idempotencyKey identifies another adoption command');
        return priorByIdempotency.receipt;
      }
      const priorCommand = state.t019.history.find((item) => item.commandDigest === commandDigest && item.receipt);
      if (priorCommand) return priorCommand.receipt;
      const requestSnapshotRevision = candidateRequestRecord?.receipt?.existingT019Snapshot?.t019Revision;
      const expectedT019Revision = command.expectedT019Revision !== undefined ? command.expectedT019Revision : requestSnapshotRevision;
      if (expectedT019Revision === undefined || expectedT019Revision !== state.t019.revision) {
        fail('T019_REVISION_CONFLICT', 'T019 changed before this adoption could commit', {
          expectedT019Revision,
          actualT019Revision: state.t019.revision
        });
      }
      const qualification = qualificationHint;
      if (!qualification) fail('T018_NOT_FOUND', 'T019 adoption requires an exact T018 qualification record');
      if (qualification.status !== 'eligible') fail('T018_NOT_ELIGIBLE', 'only an eligible T018 candidate can enter T019');
      assertSameContext(state.scenarioContext, qualification.scenarioContext, { code: 'T018_CONTEXT_MISMATCH' });
      const result = this._resolveC029(state, command, qualification);
      if (!result || result.status !== 'succeeded') fail('C029_NOT_SUCCEEDED', 'T019 adoption requires a succeeded C029 result');
      const target = state.refreshRequests[qualification.requestId]?.request?.target || command.target || {};
      const candidateRequest = state.refreshRequests[qualification.requestId]?.request;
      if (!candidateRequest) fail('C028_NOT_FOUND', 'T019 candidate is not linked to an exact C028 request');
      const liveTarget = this._latestTarget(state, target.t054Id || target.targetId || target.bindingId);
      if (!liveTarget || liveTarget.status !== 'available' || liveTarget.allowSubmit !== true) fail('T054_NOT_AVAILABLE', 'T054 is no longer available at T019 commit time');
      verifyIntegrity(liveTarget, { label: 'T054', code: 'T054_CORRUPT' });
      const preSubmit = candidateRequestRecord.receipt?.preSubmitReread;
      if (!preSubmit || preSubmit.targetFingerprint !== liveTarget.integrity.digest || preSubmit.bindingVersion !== liveTarget.bindingVersion) {
        fail('C032_DRIFT', 'T054/C032 changed after C028 and before T019 adoption');
      }
      const published = qualification.publishedId ? state.published[qualification.publishedId] : null;
      if (!published || published.t017Id !== qualification.t017Id || published.publicationStatus !== 'published') {
        fail('T017_NOT_PUBLISHED', 'T019 candidate must point to an exact Published T017');
      }
      const deliveryRecord = state.deliveryRecords[qualification.deliveryId || result.deliveryId];
      if (!deliveryRecord || deliveryRecord.receipt.status !== 'accepted' || !deliveryRecord.payload) fail('C003_ACCEPTED_REQUIRED', 'T019 candidate requires an accepted C003 delivery');
      if (deliveryRecord.payload.t007Version !== qualification.t007Version || deliveryRecord.payload.t006Id !== qualification.t006Id) {
        fail('T019_CANDIDATE_MISMATCH', 'T018 candidate does not match its exact C003 T007/T006');
      }
      const candidateValidation = this._candidateValidation(command, qualification, result, context);
      const gatesInput = command.gates || command.validationGates || {};
      const sharedGateEvidence = Array.isArray(command.validationRefs) && command.validationRefs.length > 0
        ? { status: 'passed', evidenceRefs: command.validationRefs }
        : undefined;
      const gates = {
        ontology: this._normalizeGate(gatesInput.ontology || gatesInput.semantic || command.ontologyValidation || sharedGateEvidence, 'gates.ontology'),
        mapping: this._normalizeGate(gatesInput.mapping || command.mappingValidation || sharedGateEvidence, 'gates.mapping'),
        candidate: this._normalizeGate(gatesInput.candidate || candidateValidation, 'gates.candidate'),
        fixedQuestion: this._normalizeGate(gatesInput.fixedQuestion || gatesInput.consumer || candidateValidation, 'gates.fixedQuestion')
      };
      const failedGate = Object.entries(gates).find(([, gate]) => gate.status !== 'passed');
      if (failedGate) fail('T019_GATE_FAILED', `T019 gate ${failedGate[0]} did not pass`, { gates });
      const adoptionDigest = payloadDigest({
        qualificationId: qualification.qualificationId,
        resultId: result.resultId,
        candidateValidation,
        gates,
        scenarioContext: context
      });
      const priorAdoption = state.t019.history.find((item) => item.adoptionDigest === adoptionDigest);
      if (priorAdoption?.receipt) return priorAdoption.receipt;
      const now = this._now(command.switchedAt);
      const prior = state.t019.current ? cloneJson(state.t019.current) : null;
      state.t019.revision += 1;
      const combinationId = command.combinationId || this._id('T019-COMBINATION', {
        t017Id: published.t017Id,
        t007Version: qualification.t007Version,
        revision: state.t019.revision,
        scenarioContext: state.scenarioContext
      });
      const t019Id = command.t019Id || this._id('T019', {
        combinationId,
        revision: state.t019.revision,
        scenarioContext: state.scenarioContext
      });
      const invalidatedPair = state.t019.history.find((item) => state.t019.invalidatedCombinationIds.includes(item.combinationId)
        && item.semanticVersionId === published.publishedId
        && item.dataVersion === qualification.t007Version);
      if (invalidatedPair) fail('T019_COMBINATION_INVALIDATED', 'the semantic/data pair was previously invalidated and cannot be re-adopted');
      if (state.t019.invalidatedCombinationIds.includes(combinationId)) fail('T019_COMBINATION_INVALIDATED', 'an invalidated T019 combination cannot be adopted again');
      if (state.t019.history.some((item) => item.t019Id === t019Id)) fail('T019_ID_CONFLICT', 't019Id already exists in immutable history');
      if (state.t019.history.some((item) => item.combinationId === combinationId)) fail('T019_COMBINATION_CONFLICT', 'combinationId already exists in immutable history');
      const evidenceRefs = [...new Set([
        ...(Array.isArray(command.evidenceRefs) ? command.evidenceRefs : []),
        ...candidateValidation.evidenceRefs,
        ...Object.values(gates).flatMap((gate) => gate.evidenceRefs || []),
        ...qualification.evidenceRefs,
        ...result.evidenceRefs
      ].filter(Boolean).map(String))];
      if (evidenceRefs.length === 0) fail('T019_EVIDENCE_REQUIRED', 'T019 adoption requires evidence references');
      const current = {
        combinationId,
        t019Id,
        t019Revision: state.t019.revision,
        publishedId: published.publishedId,
        t017Id: published.t017Id,
        semantic: {
          publishedId: published.publishedId,
          t017Id: published.t017Id,
          semanticVersion: published.semanticVersion,
          contentDigest: published.contentDigest,
          resourceContractFingerprint: published.contentDigest,
          endpointContractFingerprint: sha256({ mapping: published.content.mapping, sourceMappingVersion: published.sourceMappingVersion })
        },
        data: {
          deliveryId: qualification.deliveryId,
          t006Id: qualification.t006Id,
          t007Version: qualification.t007Version,
          t008AsOf: qualification.t008AsOf,
          mappingFingerprint: sha256({ mappingVersion: target.sourceMappingVersion, t007Version: qualification.t007Version })
        },
        switchedAt: now,
        candidateValidation,
        gates,
        evidenceRefs,
        scenarioContext: cloneJson(state.scenarioContext),
        status: 'adopted',
        state: 'current',
        adoptionStatus: 'adopted',
        restrictions: []
      };
      if (prior) {
        state.t019.previousTrusted = prior;
        state.t019.trustedHistory.push(prior);
      }
      state.t019.current = current;
      state.t019.lastCandidateValidation = candidateValidation;
      state.t019.pendingCandidateValidation = null;
      state.t019.transition = 'switch';
      state.t019.transitionReason = null;
      state.t019.history.push({
        transition: 'switch',
        t019Id,
        combinationId,
        previousCombinationId: prior?.combinationId || null,
        semanticVersionId: published.publishedId,
        dataVersion: qualification.t007Version,
        candidateValidation,
        adoptionDigest,
        commandDigest,
        idempotencyKey: command.idempotencyKey || null,
        receipt: {
          schemaVersion: SCHEMA_VERSIONS.T019,
          contractCode: 'T019',
          status: 'adopted',
          t019Id,
          combinationId,
          t019Revision: state.t019.revision,
          semanticVersionId: published.publishedId,
          semanticVersion: published.semanticVersion,
          t017Id: published.t017Id,
          dataVersion: qualification.t007Version,
          assetVersionId: qualification.t007Version,
          t006Id: qualification.t006Id,
          asOf: qualification.t008AsOf,
          switchedAt: now,
          previousTrusted: prior ? { combinationId: prior.combinationId, t019Id: prior.t019Id } : null,
          candidateValidation,
          evidenceRefs,
          scenarioContext: cloneJson(state.scenarioContext),
          readOnly: true
        },
        formedAt: now,
        scenarioContext: cloneJson(state.scenarioContext)
      });
      refreshC008Projection(state, now, { candidateValidation });
      state.t019.history[state.t019.history.length - 1].receipt.c008Projection = cloneJson(state.c008);
      this._audit(state, command, 'T019.commit', 'adopted', {
        sourceVersion: `${published.t017Id}/${qualification.t007Version}`,
        targetVersion: t019Id,
        refs: [published.publishedId, qualification.qualificationId, result.resultId, t019Id]
      });
      return state.t019.history[state.t019.history.length - 1].receipt;
    }).result;
  }

  switchT019(command = {}) { return this.commitT019(command); }

  rollbackT019(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    assertM01Owner(command);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (state) => {
      const rollbackDigest = businessDigest(command, ['traceId', 'correlationId', 'actorRef', 'expectedStateRevision', 'expectedT019Revision']);
      const priorRollback = state.t019.history.find((item) => item.transition === 'rollback' && item.rollbackDigest === rollbackDigest && item.receipt);
      if (priorRollback) return priorRollback.receipt;
      if (command.idempotencyKey) {
        const priorByKey = state.t019.history.find((item) => item.idempotencyKey === command.idempotencyKey);
        if (priorByKey) {
          if (priorByKey.rollbackDigest !== rollbackDigest) fail('T019_IDEMPOTENCY_CONFLICT', 'rollback idempotencyKey identifies another command');
          return priorByKey.receipt;
        }
      }
      if (command.expectedT019Revision !== undefined && command.expectedT019Revision !== state.t019.revision) fail('T019_REVISION_CONFLICT', 'T019 changed before rollback');
      const current = state.t019.current;
      const previous = state.t019.previousTrusted;
      if (!previous) {
        state.t019.revision += 1;
        state.t019.transition = 'failed';
        state.t019.transitionReason = command.reason || 'no previous trusted combination exists';
        refreshC008Projection(state, this._now(command.formedAt), {
          readStatus: 'failed',
          reason: state.t019.transitionReason,
          affectedScope: command.affectedScope || null,
          recoverySuggestion: command.recoverySuggestion || 'publish and validate a new semantic/data candidate before retrying'
        });
        this._audit(state, command, 'T019.rollback', 'failed', {
          sourceVersion: current?.t019Id || 'none',
          targetVersion: 'none',
          refs: [current?.t019Id].filter(Boolean),
          reasonCode: 'NO_PREVIOUS_TRUSTED'
        });
        const failedReceipt = {
          status: 'failed',
          code: 'NO_PREVIOUS_TRUSTED',
          readStatus: 'failed',
          t019Id: current?.t019Id || null,
          scenarioContext: cloneJson(state.scenarioContext)
        };
        state.t019.history.push({ transition: 'rollback', rollbackDigest, idempotencyKey: command.idempotencyKey || null, t019Id: current?.t019Id || null, receipt: failedReceipt, formedAt: this._now(), scenarioContext: cloneJson(state.scenarioContext) });
        return failedReceipt;
      }
      if (command.previousTrustedCombinationId && command.previousTrustedCombinationId !== previous.combinationId) fail('PREVIOUS_TRUSTED_MISMATCH', 'rollback target is not the M01 previous-trusted combination');
      const now = this._now(command.rolledBackAt);
      state.t019.revision += 1;
      const rollbackFrom = current ? cloneJson(current) : null;
      if (rollbackFrom?.combinationId && !state.t019.invalidatedCombinationIds.includes(rollbackFrom.combinationId)) {
        state.t019.invalidatedCombinationIds.push(rollbackFrom.combinationId);
      }
      state.t019.current = cloneJson(previous);
      state.t019.current.t019Revision = state.t019.revision;
      state.t019.current.status = 'previous-trusted';
      state.t019.lastCandidateValidation = state.t019.current.candidateValidation || null;
      state.t019.pendingCandidateValidation = null;
      state.t019.current.rollbackOf = rollbackFrom?.t019Id || null;
      state.t019.current.switchedAt = now;
      state.t019.previousTrusted = null;
      state.t019.transition = 'rollback';
      state.t019.transitionReason = command.reason || 'candidate or current combination failed; previous trusted restored';
      state.t019.history.push({
        transition: 'rollback',
        t019Id: state.t019.current.t019Id,
        combinationId: state.t019.current.combinationId,
        rollbackOf: rollbackFrom?.t019Id || null,
        semanticVersionId: rollbackFrom?.semantic?.publishedId || null,
        dataVersion: rollbackFrom?.data?.t007Version || null,
        formedAt: now,
        reason: state.t019.transitionReason,
        rollbackDigest,
        idempotencyKey: command.idempotencyKey || null,
        scenarioContext: cloneJson(state.scenarioContext)
      });
      refreshC008Projection(state, now, {
        readStatus: 'previous-trusted',
        reason: state.t019.transitionReason,
        invalidatedCombination: rollbackFrom
      });
      this._audit(state, command, 'T019.rollback', 'previous-trusted', {
        sourceVersion: rollbackFrom?.t019Id || 'none',
        targetVersion: state.t019.current.t019Id,
        refs: [rollbackFrom?.t019Id, state.t019.current.t019Id].filter(Boolean),
        reasonCode: 'PREVIOUS_TRUSTED_RESTORED'
      });
      const rollbackReceipt = {
        schemaVersion: SCHEMA_VERSIONS.T019,
        contractCode: 'T019',
        status: 'previous-trusted',
        t019Id: state.t019.current.t019Id,
        combinationId: state.t019.current.combinationId,
        t019Revision: state.t019.revision,
        rollbackOf: rollbackFrom?.t019Id || null,
        switchedAt: now,
        scenarioContext: cloneJson(state.scenarioContext),
        c008Projection: cloneJson(state.c008),
        readOnly: true
      };
      state.t019.history[state.t019.history.length - 1].receipt = rollbackReceipt;
      return rollbackReceipt;
    }).result;
  }

  previousTrusted(command = {}) {
    const context = this._context(command.scenarioContext);
    const state = this.repository.read(context);
    return immutable(state.t019.previousTrusted, 'previous-trusted T019');
  }

  markQualityFailure(command = {}) {
    const context = this._context(command.scenarioContext, { write: true });
    if (command.callerModule && !['M01', 'M02'].includes(command.callerModule)) fail('OWNER_BOUNDARY_VIOLATION', 'quality failure facts cannot be supplied by a consumer');
    const state = this.repository.read(context);
    const current = state.t019.current;
    if (!current) fail('T019_NOT_FOUND', 'there is no current T019 combination to invalidate');
    if (command.combinationId && command.combinationId !== current.combinationId) fail('T019_COMBINATION_MISMATCH', 'quality failure references another T019 combination');
    if (!text(command.reason)) fail('QUALITY_FAILURE_REASON_REQUIRED', 'a hard quality failure requires a reason');
    if (command.confirmRollback === true && state.t019.previousTrusted) {
      return this.rollbackT019({
        scenarioContext: context,
        reason: command.reason,
        affectedScope: command.affectedScope,
        recoverySuggestion: command.recoverySuggestion,
        callerModule: 'M01',
        expectedT019Revision: command.expectedT019Revision,
        idempotencyKey: command.idempotencyKey,
        formedAt: command.formedAt
      });
    }
    const failureDigest = businessDigest(command, ['traceId', 'correlationId', 'actorRef', 'expectedStateRevision', 'expectedT019Revision']);
    return this.repository.transaction(context, { expectedRevision: command.expectedStateRevision }, (working) => {
      const active = working.t019.current;
      if (!active || active.combinationId !== current.combinationId) fail('T019_REVISION_CONFLICT', 'T019 changed before quality failure was recorded');
      const priorFailure = working.t019.history.find((item) => item.transition === 'failed' && item.failureDigest === failureDigest && item.receipt);
      if (priorFailure) return priorFailure.receipt;
      working.t019.transition = 'failed';
      working.t019.transitionReason = command.reason;
      working.t019.invalidatedCombinationIds.push(active.combinationId);
      working.t019.revision += 1;
      const now = this._now(command.formedAt);
      refreshC008Projection(working, now, {
        readStatus: 'failed',
        reason: command.reason,
        affectedScope: command.affectedScope || null,
        recoverySuggestion: command.recoverySuggestion || null,
        invalidatedCombination: active
      });
      const failureReceipt = {
        status: 'failed',
        t019Id: active.t019Id,
        combinationId: active.combinationId,
        readStatus: 'failed',
        previousTrustedAvailable: Boolean(working.t019.previousTrusted),
        scenarioContext: cloneJson(working.scenarioContext),
        readOnly: true
      };
      working.t019.history.push({
        transition: 'failed',
        t019Id: active.t019Id,
        combinationId: active.combinationId,
        reason: command.reason,
        failureDigest,
        idempotencyKey: command.idempotencyKey || null,
        receipt: failureReceipt,
        formedAt: now,
        scenarioContext: cloneJson(working.scenarioContext)
      });
      this._audit(working, command, 'T019.quality-failure', 'failed', {
        sourceVersion: active.t019Id,
        targetVersion: active.t019Id,
        refs: [active.t019Id],
        reasonCode: 'HARD_QUALITY_FAILURE'
      });
      return failureReceipt;
    }).result;
  }

  readT019(command = {}) {
    const context = this._context(command.scenarioContext);
    const state = this.repository.read(context);
    if (!state.t019.current) return immutable({ status: 'empty', t019Revision: state.t019.revision, current: null, previousTrusted: null, scenarioContext: cloneJson(context) }, 'T019 read');
    return immutable({
      status: state.t019.transition === 'rollback' ? 'previous-trusted' : state.t019.transition === 'failed' ? 'failed' : 'ready',
      t019Revision: state.t019.revision,
      t019Id: state.t019.current.t019Id,
      combinationId: state.t019.current.combinationId,
      current: state.t019.current,
      previousTrusted: state.t019.previousTrusted,
      scenarioContext: cloneJson(context),
      readOnly: true
    }, 'T019 read');
  }

  readC008(command = {}) {
    const context = this._context(command.scenarioContext);
    if (command.sources) {
      const { readC008Sources } = require('./projection');
      return readC008Sources({ sources: command.sources, scenarioContext: context });
    }
    const state = this.repository.read(context);
    let projection;
    if (Array.isArray(state.c008Sources)) {
      if (state.c008Sources.length === 0) fail('PROJECTION_SOURCE_MISSING', 'C008 authoritative source is missing');
      if (state.c008Sources.length > 1) fail('PROJECTION_DUAL_SOURCE', 'C008 has more than one authoritative source');
      const { readC008Sources } = require('./projection');
      projection = readC008Sources({ sources: state.c008Sources, scenarioContext: context });
    } else {
      if (!state.c008) fail('PROJECTION_SOURCE_MISSING', 'M01 has no C008 projection');
      validateC008Projection(state.c008, context);
      projection = state.c008;
    }
    if (projection.t019Revision !== state.t019.revision) fail('PROJECTION_STATE_MISMATCH', 'C008 projection revision does not match authoritative T019 state');
    const expectedCombination = state.t019.current?.combinationId || null;
    const projectedCombination = projection.current?.combinationId || null;
    if (projection.readStatus === 'failed') {
      if (state.t019.transition !== 'failed') fail('PROJECTION_STATE_MISMATCH', 'failed C008 projection does not match T019 transition state');
      if (projectedCombination !== null) fail('PROJECTION_STATE_MISMATCH', 'failed C008 projection cannot expose a current combination');
    } else if (projection.readStatus === 'previous-trusted'
        && (state.t019.transition !== 'rollback' || state.t019.current?.status !== 'previous-trusted')) {
      fail('PROJECTION_STATE_MISMATCH', 'previous-trusted C008 projection does not match T019 rollback state');
    } else if (expectedCombination !== projectedCombination) {
      fail('PROJECTION_STATE_MISMATCH', 'C008 current combination does not match authoritative T019 state');
    }
    if (projection.current && state.t019.current) {
      const expected = state.t019.current;
      if (projection.current.t019Id !== expected.t019Id
          || projection.current.semanticVersionId !== expected.semantic.publishedId
          || projection.current.dataVersion !== expected.data.t007Version
          || projection.current.t006Id !== expected.data.t006Id
          || projection.current.dataAsOf !== expected.data.t008AsOf
          || projection.current.switchedAt !== expected.switchedAt
          || projection.current.semanticContentDigest !== expected.semantic.contentDigest
          || projection.current.resourceContractFingerprint !== expected.semantic.resourceContractFingerprint
          || projection.current.endpointContractFingerprint !== expected.semantic.endpointContractFingerprint
          || identity.stableSerialize(projection.current.evidenceRefs || []) !== identity.stableSerialize(expected.evidenceRefs || [])) {
        fail('PROJECTION_STATE_MISMATCH', 'C008 current version fields do not match authoritative T019 state');
      }
    }
    const expectedPrevious = state.t019.previousTrusted;
    const projectedPrevious = projection.previousTrusted;
    if (!expectedPrevious && projectedPrevious) fail('PROJECTION_STATE_MISMATCH', 'C008 exposes a previous-trusted combination that T019 does not have');
    if (expectedPrevious && (!projectedPrevious
        || projectedPrevious.combinationId !== expectedPrevious.combinationId
        || projectedPrevious.t019Id !== expectedPrevious.t019Id
        || projectedPrevious.semanticVersionId !== expectedPrevious.semantic.publishedId
        || projectedPrevious.dataVersion !== expectedPrevious.data.t007Version)) {
      fail('PROJECTION_STATE_MISMATCH', 'C008 previous-trusted fields do not match authoritative T019 state');
    }
    const pendingCandidate = state.t019.pendingCandidateValidation;
    const expectedCandidate = (projection.candidateValidation?.overallStatus !== 'passed' && pendingCandidate)
      ? pendingCandidate
      : (state.t019.lastCandidateValidation || state.t019.current?.candidateValidation || state.t019.history.at(-1)?.candidateValidation || null);
    if (expectedCandidate && projection.candidateValidation) {
      if (projection.candidateValidation.candidateSemanticVersionId !== expectedCandidate.semanticVersionId
          || projection.candidateValidation.candidateDataVersion !== expectedCandidate.dataVersion
          || projection.candidateValidation.overallStatus !== expectedCandidate.status
          || identity.stableSerialize(projection.candidateValidation.evidenceRefs || []) !== identity.stableSerialize(expectedCandidate.evidenceRefs || [])) {
        fail('PROJECTION_STATE_MISMATCH', 'C008 candidate validation does not match authoritative T019 evidence');
      }
    }
    return immutable(projection, 'C008 projection');
  }

  projectC008(command = {}) {
    const context = this._context(command.scenarioContext || this.context, { write: true });
    assertM01Owner(command);
    if (command.readStatus) {
      const state = this.repository.read(context);
      const hasCurrent = Boolean(state.t019.current);
      if (command.readStatus === 'empty' && hasCurrent) fail('PROJECTION_STATUS_MISMATCH', 'empty C008 cannot be projected while T019 is current');
      if (command.readStatus === 'ready' && !hasCurrent) fail('PROJECTION_STATUS_MISMATCH', 'ready C008 requires a current T019');
      if (command.readStatus === 'previous-trusted' && (state.t019.transition !== 'rollback' || state.t019.current?.status !== 'previous-trusted')) fail('PROJECTION_STATUS_MISMATCH', 'previous-trusted C008 requires a rollback transition');
      if (command.readStatus === 'failed' && (!text(command.reason) || state.t019.transition !== 'failed')) fail('PROJECTION_STATUS_MISMATCH', 'failed C008 requires a failed T019 transition and reason');
    }
    return this.repository.transaction(context, {}, (state) => refreshC008Projection(state, this._now(command.formedAt), {
      readStatus: command.readStatus,
      reason: command.reason,
      affectedScope: command.affectedScope,
      recoverySuggestion: command.recoverySuggestion
    })).result;
  }

  consumerReader() {
    return Object.freeze({
      sourceId: AUTHORITATIVE_C008_SOURCE_ID,
      readC008: (command = {}) => this.readC008(command),
      readT019: (command = {}) => this.readT019(command),
      readC004: (command = {}) => this.readC004(command),
      readC005: (command = {}) => this.readC005(command),
      readC006: (command = {}) => this.readC006(command),
      readC007: (command = {}) => this.readC007(command)
    });
  }

  listDrafts(command = {}) {
    const context = this._context(command.scenarioContext);
    const state = this.repository.read(context);
    return immutable(state.draftOrder.map((id) => state.drafts[id]), 'Draft list');
  }

  listPublished(command = {}) {
    const context = this._context(command.scenarioContext);
    const state = this.repository.read(context);
    return immutable(state.publishedOrder.map((id) => state.published[id]), 'Published list');
  }

  getState(command = {}) {
    const context = this._context(command.scenarioContext || this.context);
    return this.repository.read(context);
  }

  exportOwnedState(command = {}) {
    return this.getState(command);
  }

  exportCheckpoint(command = {}) {
    return require('./checkpoint').createModuleCheckpoint(this, command);
  }

  export(command = {}) {
    return this.exportCheckpoint(command);
  }

  validateCheckpoint(checkpoint, options = {}) {
    return require('./checkpoint').validateModuleCheckpoint(this, checkpoint, options);
  }

  cloneRestore(command = {}, options = {}) {
    const request = command && command.checkpoint ? { ...command } : { ...options, checkpoint: command };
    if (!request.targetScenarioContext && request.checkpoint?.scenarioContext) {
      const checkpoint = require('../../packages/checkpoint');
      const source = request.checkpoint.scenarioContext;
      request.targetScenarioContext = {
        ...source,
        scenarioRunId: checkpoint.createScenarioRunId(source.scenarioId, { scenarioVersion: source.scenarioVersion, operation: 'clone-restore' }),
        formedAt: this._now(),
        status: 'restored'
      };
    }
    return require('./checkpoint').cloneRestoreModule(this, request);
  }

  isolatedReplay(command = {}, options = {}) {
    const request = command && command.checkpoint ? { ...command } : { ...options, checkpoint: command };
    if (!request.targetScenarioContext && request.checkpoint?.scenarioContext) {
      const checkpoint = require('../../packages/checkpoint');
      const source = request.checkpoint.scenarioContext;
      request.targetScenarioContext = {
        ...source,
        scenarioRunId: checkpoint.createScenarioRunId(source.scenarioId, { scenarioVersion: source.scenarioVersion, operation: 'isolated-replay' }),
        formedAt: this._now(),
        status: 'regression'
      };
    }
    return require('./checkpoint').isolatedReplayModule(this, request);
  }

  applyCloneRestore(result) {
    if (result.mode !== 'clone-restore') fail('REGRESSION_RESTORE_MIXED', 'isolated replay plans cannot be materialized as clone restores');
    if (!result?.restoredState?.scenarioContext) fail('INVALID_RESTORE_INPUT', 'clone restore result is missing a target state');
    const targetContext = assertScenarioContext(result.restoredState.scenarioContext, { write: true });
    if (this.repository.hasScenario(targetContext)) {
      const existing = this.repository.read(targetContext);
      const occupied = existing.revision > 0
        || existing.draftOrder.length > 0
        || existing.publishedOrder.length > 0
        || existing.deliveryOrder.length > 0
        || existing.refreshRequestOrder.length > 0
        || existing.refreshResultOrder.length > 0
        || existing.t019.current;
      if (occupied) fail('RESTORE_TARGET_EXISTS', 'clone restore target must be a new empty scenario run');
    } else {
      this.repository.registerScenario(targetContext);
    }
    return this.repository.importState(targetContext, result.restoredState, { replaceEmpty: true });
  }

  migrationCompare(command = {}) {
    return require('./checkpoint').migrationCompareModule(this, command);
  }

  replaceState(state, options = {}) {
    const context = this._context(state?.scenarioContext || this.context, { write: true });
    const imported = state?.moduleState || state;
    if (!isRecord(imported) || imported.stateSchemaVersion !== 'ofw.m01.checkpoint-state.v1') {
      fail('INVALID_RESTORE_STATE', 'M01 state schema is missing or unsupported');
    }
    if (!imported.c008) fail('PROJECTION_SOURCE_MISSING', 'restored M01 state must carry C008');
    validateC008Projection(imported.c008, context);
    if (!imported.counters || !isRecord(imported.counters)) fail('INVALID_RESTORE_STATE', 'restored M01 state counters are missing');
    return this.repository.importState(context, imported, { replaceEmpty: options.replaceEmpty === true });
  }

  get state() { return this.getState({ scenarioContext: this.context }); }
}

module.exports = Object.freeze({
  OntologyService,
  adaptM02C003Delivery,
  C032_STATUS_ALIASES: T054_STATUS_ALIASES,
  C032_CLIENT_STATUS,
  C028_RECEIPT_STATUSES,
  CANDIDATE_ITEM_STATUSES
});
