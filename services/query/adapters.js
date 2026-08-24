'use strict';

/*
 * M03 consumes projections owned by M01/M02.  These adapters intentionally
 * accept a caller-owned reader and never retain a writable reference to it.
 * A projection is read again for every call; the returned value is a frozen
 * diagnostic/consumption view, not a local copy of T019 or C017 truth.
 */

const { fail } = require('./errors');
const {
  isRecord,
  clone,
  deepFreeze,
  contextTriple,
  assertSameContext,
  readSource,
  rejectMutationMethods,
  pick,
  firstObject,
  firstString,
  normalizeEvidenceRefs
} = require('./utils');

const C008_PROJECTION_ID = 'ontology3-c008-authoritative-projection-v1';
const C008_SCHEMA_VERSION = '1';
const C017_PROJECTION_ID = 'data-c017-consumer-projection-v1';
const C017_SCHEMA_VERSION = '1';
const M03_CONSUMER_ID = 'M03';

const C008_STATES = Object.freeze(['empty', 'ready', 'failed', 'previous-trusted', 'unknown']);
const C017_STATES = Object.freeze([
  'ready', 'warning', 'stale', 'refreshing', 'quality-failed',
  'unknown', 'permission-denied', 'not-found', 'failed'
]);

function upper(value) {
  return String(value || '').trim().toUpperCase();
}

function consistentString(value, keys, code, label) {
  const values = keys.map((key) => pick(value, [key])).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  const unique = [...new Set(values)];
  if (unique.length > 1) fail(code, `${label} aliases disagree`, { values: unique });
  return unique[0] || null;
}

function readStatus(source) {
  return String(pick(source, ['readStatus', 'status', 'state', 'projectionStatus']) || '').trim().toLowerCase();
}

function adapterContext(value) {
  if (!isRecord(value)) return value;
  const required = ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'];
  if (required.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return value;
  return isRecord(value.scenarioContext) ? value.scenarioContext
    : isRecord(value.context) ? value.context : value;
}

function assertReadableContext(context) {
  if (!['active', 'running', 'ready', 'pending', 'restored', 'regression'].includes(String(context.status || '').toLowerCase())) {
    fail('ERR_QUERY_CONTEXT_NOT_READABLE', 'closed or unknown scenario context cannot be consumed', { status: context.status });
  }
  return context;
}

function assertEnvelope(raw, id, version, label, options = {}) {
  if (!isRecord(raw)) fail('ERR_QUERY_PROJECTION_INVALID', `${label} projection must be an object`);
  const projectionId = firstString(raw, ['projectionId', 'projection', 'contractId', 'resourceId']);
  const rawSchemaValue = pick(raw, ['schemaVersion', 'projectionVersion', 'contractVersion']);
  const schemaVersion = rawSchemaValue === 1 ? '1' : firstString(raw, ['schemaVersion', 'projectionVersion', 'contractVersion']);
  const hasSchemaField = ['schemaVersion', 'projectionVersion', 'contractVersion'].some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  const hasProjectionField = ['projectionId', 'projection', 'contractId', 'resourceId'].some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!hasProjectionField) fail('ERR_QUERY_PROJECTION_ID_INVALID', `${label} projection identity is required`);
  if (!hasSchemaField) fail('ERR_QUERY_PROJECTION_VERSION_INVALID', `${label} schema version is required`);
  if (hasSchemaField && !schemaVersion) fail('ERR_QUERY_PROJECTION_VERSION_INVALID', `${label} schema version must be a non-empty string`);
  if (projectionId && projectionId !== id && !(options.allowProjectionId && projectionId.length > 0)) {
    fail('ERR_QUERY_PROJECTION_ID_MISMATCH', `${label} projection identity is not recognized`, { expected: id, actual: projectionId });
  }
  const schemaAccepted = options.allowSchemaVersion
    ? (typeof options.allowSchemaVersion === 'function' ? options.allowSchemaVersion(schemaVersion) : options.allowSchemaVersion.includes(schemaVersion))
    : schemaVersion === version;
  if (schemaVersion && !schemaAccepted) {
    fail('ERR_QUERY_PROJECTION_VERSION_MISMATCH', `${label} projection schema version is not supported`, { expected: version, actual: schemaVersion });
  }
  return { projectionId: id, schemaVersion: version };
}

function rejectLegacyState(raw) {
  const legacy = ['v16', 'v17', 'ontologyV16', 'ontologyV17', 'publishedV16', 'publishedV17'];
  const found = legacy.filter((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (found.length) fail('ERR_C008_LEGACY_STATE', 'legacy ontology state keys cannot establish C008 truth', { keys: found });
}

function normalizeT019(raw, context) {
  const source = firstObject(raw, ['t019', 'T019', 'authoritativeBinding', 'consumptionBinding', 'currentBinding', 'current']) || {};
  const published = firstObject(raw, ['publishedOntology', 'published', 'ontology', 'semanticVersion']) || {};
  const semanticVersionId = firstString(source, ['semanticVersionId', 'publishedSemanticVersionId', 'publishedOntologyVersion'])
    || firstString(published, ['semanticVersionId', 'publishedSemanticVersionId', 'version', 'publishedVersion']);
  const semanticDisplayVersion = firstString(source, ['publishedSemanticVersion', 'semanticVersion', 'ontologyVersion', 'publishedVersion'])
    || firstString(published, ['publishedSemanticVersion', 'semanticVersion', 'version', 'publishedVersion', 'ontologyVersion'])
    || semanticVersionId;
  const dataVersion = consistentString(source, ['dataVersion', 'consumableDataVersion', 't007Version', 'exactDataVersion'], 'ERR_C008_VERSION_MISMATCH', 'C008 data version')
    || firstString(raw, ['dataVersion', 'consumableDataVersion', 'exactDataVersion']);
  const t007Id = firstString(source, ['t007Id', 'dataAssetId', 'datasetId', 'dataVersionId'])
    || firstString(raw, ['t007Id', 'dataAssetId', 'datasetId'])
    || dataVersion;
  const t008Id = firstString(source, ['t008Id', 'freshnessId', 'asOfEvidenceId'])
    || firstString(raw, ['t008Id', 'freshnessId'])
    || firstString(firstObject(raw, ['t008', 'T008']), ['id', 't008Id', 'evidenceId']);
  const bindingVersion = firstString(source, ['bindingVersion', 'version', 't019Version'])
    || firstString(raw, ['t019Version']);
  const bindingStatus = firstString(source, ['status', 'state', 'lifecycleStatus']) || null;
  const bindingContext = source.scenarioContext || source.scenarioIdentity || raw.scenarioContext || raw.scenarioIdentity;
  if (bindingContext) assertSameContext(context, bindingContext, 'C008.T019.scenarioContext');
  return {
    bindingId: firstString(source, ['bindingId', 'id', 't019Id']) || null,
    bindingVersion,
    status: bindingStatus,
    publishedOntologyVersion: semanticVersionId,
    publishedSemanticVersion: semanticDisplayVersion,
    dataVersion,
    t007Id,
    t008Id,
    scenarioContext: contextTriple(context),
    evidenceRefs: normalizeEvidenceRefs(source.evidenceRefs || published.evidenceRefs || raw.evidenceRefs || (source.evidenceLocator ? [{ evidenceType: 'T019', evidenceId: source.evidenceLocator }] : []), 'C008.T019.evidenceRefs')
  };
}

function normalizedAsOf(raw) {
  const t008 = firstObject(raw, ['t008', 'T008', 'freshnessEvidence', 'asOfEvidence']) || {};
  const current = firstObject(raw, ['current', 't019', 'authoritativeBinding']) || {};
  return firstString(raw, ['dataAsOf', 'asOf', 'dataAsOfTime'])
    || firstString(t008, ['value', 'asOf', 'dataAsOf', 'through'])
    || firstString(current, ['dataAsOf', 'asOf', 't008'])
    || null;
}

function normalizePublished(raw, context, t019) {
  const source = firstObject(raw, ['publishedOntology', 'published', 'ontology', 'semantic']) || {};
  const version = firstString(source, ['version', 'publishedVersion', 'semanticVersion', 'ontologyVersion'])
    || t019.publishedOntologyVersion;
  const status = upper(firstString(source, ['status', 'lifecycleStatus', 'state']) || 'PUBLISHED');
  const resources = pick(source, ['resources', 'resourceRefs', 'allowedResources', 'catalog'])
    || pick(raw, ['resources', 'resourceRefs', 'allowedResources']);
  if (resources !== undefined && !Array.isArray(resources) && !isRecord(resources)) {
    fail('ERR_C008_PUBLISHED_INVALID', 'C008 published resource metadata must be a collection');
  }
  const resourceRefs = Array.isArray(resources) ? resources.map((resource, index) => {
    if (typeof resource === 'string' && resource.trim()) return { resourceId: resource.trim(), version: null, kind: null, purpose: null };
    if (!isRecord(resource)) fail('ERR_C008_PUBLISHED_INVALID', `published resource ${index} must be a stable reference`);
    const resourceId = firstString(resource, ['resourceId', 'id', 'stableId', 'key']);
    if (!resourceId) fail('ERR_C008_PUBLISHED_INVALID', `published resource ${index} has no stable identity`);
    return {
      resourceId,
      version: firstString(resource, ['version', 'resourceVersion', 'publishedVersion']) || null,
      kind: firstString(resource, ['kind', 'type', 'resourceType']) || null,
      purpose: firstString(resource, ['purpose', 'use']) || null
    };
  }) : (resources ? Object.values(clone(resources)).map((resource) => ({
    resourceId: firstString(resource, ['resourceId', 'id', 'stableId', 'key']),
    version: firstString(resource, ['version', 'resourceVersion', 'publishedVersion']) || null,
    kind: firstString(resource, ['kind', 'type', 'resourceType']) || null,
    purpose: firstString(resource, ['purpose', 'use']) || null
  })).filter((resource) => resource.resourceId) : []);
  return {
    version,
    status,
    readStatus: status,
    effectiveAt: firstString(source, ['effectiveAt', 'validFrom', 'publishedAt']) || null,
    resourceRefs,
    scenarioContext: contextTriple(context)
  };
}

function validateC008(raw, context, options = {}) {
  if (isRecord(raw?.response)) raw = { ...clone(raw.response), projectionId: raw.response.projectionId || raw.projectionId, schemaVersion: raw.response.schemaVersion || raw.schemaVersion };
  if (isRecord(raw?.projection) && (raw.contractCode === 'C008' || raw.projection.contractCode === 'C008')) {
    raw = { ...clone(raw.projection), projectionId: raw.projection.projectionId || raw.projectionId, schemaVersion: raw.projection.schemaVersion || raw.schemaVersion };
  }
  assertEnvelope(raw, C008_PROJECTION_ID, C008_SCHEMA_VERSION, 'C008');
  if ((raw.sourceModule && String(raw.sourceModule).toUpperCase() !== 'M01') || (raw.moduleId && String(raw.moduleId).toUpperCase() !== 'M01')) fail('ERR_C008_PRODUCER_MISMATCH', 'C008 projection is not produced by M01');
  if (raw.readOnly === false || raw.immutable === false || raw.writable === true) fail('ERR_QUERY_READER_NOT_READ_ONLY', 'C008 projection is writable');
  rejectLegacyState(raw);
  const status = readStatus(raw);
  if (!C008_STATES.includes(status)) {
    fail('ERR_C008_STATUS_UNKNOWN', 'C008 read status is unknown; consumption is blocked', { status: status || null });
  }
  const rawContext = raw.scenarioContext || raw.scenarioIdentity || raw.context;
  if (rawContext) assertSameContext(context, rawContext, 'C008.scenarioContext');
  const t019 = normalizeT019(raw, context);
  const published = normalizePublished(raw, context, t019);
  const diagnostics = Array.isArray(raw.diagnostics) ? clone(raw.diagnostics) : [];
  const errors = Array.isArray(raw.errors) ? clone(raw.errors) : [];
  const consumable = status === 'ready' || status === 'previous-trusted';

  if (consumable) {
    if (!t019.publishedOntologyVersion) fail('ERR_C008_T019_INCOMPLETE', 'ready C008 must identify an exact Published ontology version');
    if (!t019.dataVersion) fail('ERR_C008_T019_INCOMPLETE', 'ready C008 must identify an exact consumable data version');
    if (!t019.t007Id) fail('ERR_C008_T019_INCOMPLETE', 'ready C008 must identify the exact T007 asset');
    if (options.requireEvidence !== false && !t019.evidenceRefs.length) fail('ERR_C008_EVIDENCE_INCOMPLETE', 'ready C008/T019 must have a stable evidence reference');
    if (published.status !== 'PUBLISHED') fail('ERR_C008_NOT_PUBLISHED', 'C008 can only expose a Published ontology');
    if (t019.status && !['adopted', 'active', 'ready', 'published', 'current', 'succeeded', 'previous-trusted'].includes(String(t019.status).toLowerCase())) {
      fail('ERR_C008_T019_NOT_ACTIVE', 'T019 binding is not an active authoritative combination', { status: t019.status });
    }
    if (published.version && t019.publishedSemanticVersion && published.version !== t019.publishedSemanticVersion && published.version !== t019.publishedOntologyVersion) {
      fail('ERR_C008_VERSION_MISMATCH', 'Published ontology and T019 semantic versions do not match', {
        publishedVersion: published.version,
        t019Version: t019.publishedSemanticVersion
      });
    }
  }
  if (status === 'empty' && (t019.publishedOntologyVersion || t019.dataVersion || t019.t007Id)) {
    fail('ERR_C008_EMPTY_HAS_BINDING', 'empty C008 cannot contain a partial T019 binding');
  }
  if (status === 'failed' && !errors.length && !diagnostics.length && options.requireFailureReason !== false) {
    fail('ERR_C008_FAILURE_REASON_MISSING', 'failed C008 must include a diagnostic reason');
  }

  const current = {
    combinationId: t019.bindingId,
    bindingStatus: t019.status,
    bindingVersion: t019.bindingVersion,
    t019Id: t019.bindingId,
    semanticVersionId: t019.publishedOntologyVersion,
    publishedSemanticVersion: t019.publishedSemanticVersion || t019.publishedOntologyVersion,
    dataVersion: t019.dataVersion,
    consumableDataVersion: t019.dataVersion,
    dataAsOf: normalizedAsOf(raw),
    t008: normalizedAsOf(raw),
    t006Id: t019.t007Id,
    t017Id: null,
    evidenceRefs: t019.evidenceRefs,
    resources: Array.isArray(published.resourceRefs) ? published.resourceRefs : []
  };
  return deepFreeze({
    projectionId: C008_PROJECTION_ID,
    schemaVersion: C008_SCHEMA_VERSION,
    contractCode: 'C008',
    sourceModule: 'M01',
    producer: firstString(raw, ['producer', 'owner', 'moduleId']) || 'M01',
    readStatus: status,
    consumable,
    scenarioContext: contextTriple(context),
    t019,
    current,
    semanticVersionId: current.semanticVersionId,
    publishedSemanticVersion: current.publishedSemanticVersion,
    publishedVersionId: current.semanticVersionId,
    dataVersion: current.dataVersion,
    consumableDataVersion: current.dataVersion,
    exactDataVersion: current.dataVersion,
    t007Id: current.t006Id,
    t019Id: current.t019Id,
    dataAsOf: current.dataAsOf,
    t008: current.t008,
    publishedOntology: published,
    diagnostics,
    errors,
    readOnly: true
  });
}

function createC008T019Adapter(reader, options = {}) {
  rejectMutationMethods(reader, 'C008');
  const read = readSource(reader, 'C008');
  return Object.freeze({
    projectionId: C008_PROJECTION_ID,
    schemaVersion: C008_SCHEMA_VERSION,
    read(context, readOptions = {}) {
      const normalizedContext = assertReadableContext(contextTriple(adapterContext(context)));
      let raw;
      try {
        raw = read({
          consumer: 'intelligent-query',
          consumerId: M03_CONSUMER_ID,
          scenarioContext: clone(normalizedContext),
          purpose: 'M03-C008-read'
        });
      } catch (error) {
        fail('ERR_C008_READ_FAILED', 'C008 authoritative projection could not be read', { cause: error.code || error.message });
      }
      if (raw && typeof raw.then === 'function') { if (typeof raw.catch === 'function') raw.catch(() => {}); fail('ERR_C008_ASYNC_READER', 'use readAsync for an asynchronous C008 reader'); }
      return validateC008(raw, normalizedContext, options);
    },
    async readAsync(context, readOptions = {}) {
      const normalizedContext = assertReadableContext(contextTriple(adapterContext(context)));
      let raw;
      try {
        raw = await read({ consumer: 'intelligent-query', consumerId: M03_CONSUMER_ID, scenarioContext: clone(normalizedContext), purpose: 'M03-C008-read' });
      } catch (error) {
        fail('ERR_C008_READ_FAILED', 'C008 authoritative projection could not be read', { cause: error.code || error.message });
      }
      return validateC008(raw, normalizedContext, options);
    },
    readStrict(context) {
      const projection = this.read(context);
      if (!projection.consumable) fail('ERR_C008_NOT_CONSUMABLE', 'C008 is not currently consumable', { status: projection.readStatus });
      return projection;
    },
    async readStrictAsync(context) {
      const projection = await this.readAsync(context);
      if (!projection.consumable) fail('ERR_C008_NOT_CONSUMABLE', 'C008 is not currently consumable', { status: projection.readStatus });
      return projection;
    }
  });
}

function normalizeQuality(raw) {
  const source = firstObject(raw, ['quality', 'qualitySummary', 'qualityStatus']) || {};
  const status = String(firstString(source, ['status', 'state', 'qualityStatus']) || firstString(raw, ['qualityStatus']) || 'unknown').toLowerCase();
  const hardFailure = source.hardFailure === true || source.hardQualityFailure === true || ['failed', 'hard-failed', 'quality-failed'].includes(status);
  return {
    status,
    hardFailure,
    reason: firstString(source, ['reason', 'message', 'failureReason']) || null,
    affectedScope: clone(pick(source, ['affectedScope', 'impact', 'affectedRange']) || null),
    evidenceRefs: normalizeEvidenceRefs(source.evidenceRefs || raw.qualityEvidenceRefs || raw.evidenceRefs, 'C017.quality.evidenceRefs')
  };
}

function normalizeFreshness(raw) {
  const source = firstObject(raw, ['freshness', 'freshnessSummary', 'freshnessStatus']) || {};
  const status = String(firstString(source, ['status', 'state', 'freshnessStatus']) || firstString(raw, ['freshnessStatus']) || 'unknown').toLowerCase();
  return {
    status,
    asOf: firstString(source, ['asOf', 'dataAsOf', 'through']) || firstString(raw, ['dataAsOf', 'asOf']) || null,
    lastSuccessfulAt: firstString(source, ['lastSuccessfulAt', 'lastSuccessAt']) || null,
    reason: firstString(source, ['reason', 'message']) || null,
    evidenceRefs: normalizeEvidenceRefs(source.evidenceRefs || raw.freshnessEvidenceRefs || raw.evidenceRefs, 'C017.freshness.evidenceRefs')
  };
}

function normalizeT008(raw) {
  const source = firstObject(raw, ['t008', 'T008', 'freshnessEvidence', 'asOfEvidence']) || {};
  const scalar = typeof raw.t008 === 'string' ? raw.t008 : null;
  const asOf = firstString(source, ['value', 'asOf', 'dataAsOf', 'through']) || scalar || firstString(raw, ['dataAsOf', 'asOf']);
  const sourceRef = firstString(source, ['source', 'sourceId', 'origin']) || null;
  const evidenceRefs = normalizeEvidenceRefs(source.evidenceRefs || raw.t008EvidenceRefs || raw.evidenceRefs || raw.evidence || (source.evidenceLocator ? [{ evidenceId: source.evidenceLocator, evidenceType: 'T008' }] : []), 'C017.T008.evidenceRefs');
  return {
    id: firstString(source, ['id', 't008Id', 'evidenceId']) || null,
    value: asOf,
    source: sourceRef,
    timezone: firstString(source, ['timezone', 'timeZone', 'tz']) || null,
    precision: firstString(source, ['precision', 'granularity']) || null,
    evidenceRefs
  };
}

function sanitizeSummary(value) {
  if (!isRecord(value)) return null;
  return {
    id: firstString(value, ['id', 'summaryId', 'statusSummaryId']) || null,
    version: firstString(value, ['version', 'summaryVersion']) || null,
    formedAt: firstString(value, ['formedAt', 'createdAt']) || null,
    qualityStatus: firstString(value, ['qualityStatus', 'status']) || null,
    hardQualityFailure: value.hardQualityFailure === true,
    detectedAt: firstString(value, ['detectedAt', 'discoveredAt']) || null,
    impactScope: clone(pick(value, ['impactScope', 'affectedScope']) || null),
    businessFieldCategories: clone(pick(value, ['businessFieldCategories', 'fieldCategories']) || null),
    reason: firstString(value, ['reason', 'message']) || null,
    recovery: firstString(value, ['recovery', 'recoveryAdvice']) || null,
    evidenceLocator: firstString(value, ['evidenceLocator', 'locator']) || null
  };
}

function flattenC017Projection(raw, context) {
  if (!isRecord(raw) || !Array.isArray(raw.projections)) return raw;
  const matching = raw.projections.filter((candidate) => {
    if (!isRecord(candidate)) return false;
    const candidateContext = candidate.scenarioContext || candidate.scenarioIdentity;
    if (!candidateContext) return true;
    return candidateContext.scenarioId === context.scenarioId
      && candidateContext.scenarioVersion === context.scenarioVersion
      && candidateContext.scenarioRunId === context.scenarioRunId;
  });
  if (matching.length !== 1) {
    fail('ERR_C017_PROJECTION_AMBIGUOUS', 'C017 projection package does not contain exactly one matching run projection', { matches: matching.length });
  }
  const selected = matching[0];
  return {
    ...clone(raw),
    ...clone(selected),
    projectionId: raw.projectionId || selected.projectionId || C017_PROJECTION_ID,
    schemaVersion: raw.schemaVersion || selected.schemaVersion || C017_SCHEMA_VERSION,
    contractCode: raw.contractCode || selected.contractCode || 'C017',
    consumer: selected.consumer || raw.consumer,
    scenarioContext: selected.scenarioContext || raw.scenarioContext,
    t007: selected.t007 || raw.t007 || { dataVersion: selected.dataVersion || raw.dataVersion, id: selected.dataVersion || raw.dataVersion },
    t019: selected.t019 || raw.t019 || { publishedOntologyVersion: selected.publishedOntologyVersion || raw.publishedOntologyVersion },
    t008: selected.t008 || raw.t008 || { value: selected.asOfTime || raw.asOfTime, evidenceRefs: selected.evidenceRefs || raw.evidenceRefs },
    quality: selected.quality || { status: selected.qualityStatus || raw.qualityStatus, hardFailure: selected.hardQualityFailure || raw.hardQualityFailure },
    freshness: selected.freshness || { status: selected.freshnessStatus || raw.freshnessStatus },
    dataSideQualification: selected.dataSideQualification || selected.consumptionEligibility || selected.qualityStatus || raw.dataSideQualification || raw.consumptionEligibility || raw.qualityStatus,
    bindingSummary: selected.bindingSummary || selected.versionBindingSummary || raw.bindingSummary || raw.versionBindingSummary || { id: selected.dataVersion || raw.dataVersion, version: selected.dataAssetVersion || raw.projectionVersion },
    currentStatusSummary: selected.currentStatusSummary || selected.currentStateSummary || raw.currentStatusSummary || raw.currentStateSummary,
    evidenceRefs: selected.evidenceRefs || raw.evidenceRefs || (selected.evidenceLocator ? [{ evidenceId: selected.evidenceLocator, evidenceType: 'C017' }] : [])
  };
}

function normalizeC017(raw, context, options = {}) {
  if (isRecord(raw?.response)) raw = { ...clone(raw.response), projectionId: raw.response.projectionId || raw.projectionId, schemaVersion: raw.response.schemaVersion || raw.schemaVersion };
  if (isRecord(raw?.projection) && (raw.contractCode === 'C017' || raw.projection.contractCode === 'C017')) {
    raw = { ...clone(raw.projection), projectionId: raw.projection.projectionId || raw.projectionId, schemaVersion: raw.projection.schemaVersion || raw.schemaVersion };
  }
  assertEnvelope(raw, C017_PROJECTION_ID, C017_SCHEMA_VERSION, 'C017', {
    allowProjectionId: options.strictProjectionId !== true,
    allowSchemaVersion: (value) => value === C017_SCHEMA_VERSION || value.startsWith('ofw.') || value.startsWith('m02-')
  });
  raw = flattenC017Projection(raw, context);
  if ((raw.sourceModule && String(raw.sourceModule).toUpperCase() !== 'M02') || (raw.moduleId && String(raw.moduleId).toUpperCase() !== 'M02')) fail('ERR_C017_PRODUCER_MISMATCH', 'C017 projection is not produced by M02');
  if (raw.contractCode && String(raw.contractCode).toUpperCase() !== 'C017') fail('ERR_C017_CONTRACT_MISMATCH', 'projection is not C017');
  if (raw.readOnly === false || raw.immutable === false || raw.writable === true) fail('ERR_QUERY_READER_NOT_READ_ONLY', 'C017 projection is writable');
  const rawContext = raw.scenarioContext || raw.scenarioIdentity || raw.context;
  if (!rawContext) fail('ERR_C017_CONTEXT_MISSING', 'C017 projection must carry the complete C033 context');
  assertSameContext(context, rawContext, 'C017.scenarioContext');
  const consumer = upper(firstString(raw, ['consumer', 'consumerId', 'consumerModule', 'audience']) || M03_CONSUMER_ID);
  if (consumer !== M03_CONSUMER_ID && consumer !== 'INTELLIGENT-QUERY' && consumer !== '智能问数' && consumer !== '智能问数模块') {
    fail('ERR_C017_CONSUMER_MISMATCH', 'C017 projection is not addressed to M03', { consumer });
  }
  const t007 = firstObject(raw, ['t007', 'T007', 'dataVersion', 'dataset']) || {};
  const t007Id = firstString(t007, ['id', 't007Id', 'assetId', 'dataAssetId', 'version']) || firstString(raw, ['t007Id', 'dataAssetId', 'assetVersionId']);
  const dataVersion = firstString(t007, ['dataVersion', 'exactVersion', 'version', 'id']) || firstString(raw, ['dataVersion', 'exactDataVersion', 'assetVersionId']);
  const t019 = firstObject(raw, ['t019', 'T019', 'authoritativeBinding', 'current']) || {};
  const ontologyVersion = firstString(t019, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion', 'publishedVersion'])
    || firstString(raw, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion']);
  const quality = normalizeQuality(raw);
  const freshness = normalizeFreshness(raw);
  const t008 = normalizeT008(raw);
  const eligibility = firstString(raw, ['consumptionEligibility', 'eligibility', 'consumerStatus', 'dataSideQualification']) || null;
  const statusToken = firstString(raw, ['status', 'state', 'consumptionStatus', 'readStatus']);
  const inferredReady = !statusToken && ['allowed', 'allowed-with-warning', 'allowed_with_warning', 'eligible', 'consumable', 'ready', 'stale', 'stale_allowed', '允许推进', '允许带警告'].includes(String(eligibility || '').toLowerCase()) && quality.status !== 'unknown' && freshness.status !== 'unknown';
  const status = String(statusToken || (inferredReady ? 'ready' : 'unknown')).toLowerCase();
  const permissionRaw = String(firstString(raw, ['permissionStatus', 'authorizationStatus', 'accessStatus']) || 'granted').toLowerCase();
  const permission = ['granted', 'allowed', 'authorized', 'authorised', 'true', 'pass'].includes(permissionRaw) ? 'granted' : permissionRaw;
  const evidenceRefs = normalizeEvidenceRefs(raw.evidenceRefs || raw.evidence || [], 'C017.evidenceRefs');
  const summaryRefs = {
    binding: sanitizeSummary(firstObject(raw, ['bindingSummary', 'versionBindingSummary']))
      || (raw.bindingSummaryId ? { id: raw.bindingSummaryId, version: raw.bindingSummaryVersion || null } : null)
      || (raw.summaryId ? { id: raw.summaryId, version: raw.summaryVersion || null } : null),
    current: sanitizeSummary(firstObject(raw, ['currentStatusSummary', 'statusSummary', 'currentSummary']))
      || (raw.currentStatusSummaryId ? { id: raw.currentStatusSummaryId, version: raw.currentStatusSummaryVersion || null } : null)
      || (raw.summaryId ? { id: raw.summaryId, version: raw.summaryVersion || null } : null)
  };
  const forbidden = ['rows', 'records', 'businessRows', 'sourceFields', 'workbook', 'rawData', 'members', 'details'];
  const leaked = forbidden.filter((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (leaked.length && options.rejectBusinessDetails !== false) {
    fail('ERR_C017_BUSINESS_DETAIL_EXPOSED', 'C017 projection must not expose business details', { fields: leaked });
  }
  if (!t007Id || !dataVersion || !ontologyVersion) {
    fail('ERR_C017_VERSION_CONTEXT_MISSING', 'C017 must identify exact T007 and Published ontology versions');
  }
  if (!t008.id || !t008.value || !t008.evidenceRefs.length) {
    fail('ERR_C017_T008_INCOMPLETE', 'C017 must include an exact T008 identity, as-of value and stable evidence');
  }
  if (!summaryRefs.binding || !summaryRefs.current) {
    fail('ERR_C017_SUMMARY_INCOMPLETE', 'C017 must include both version-binding and current-status summaries');
  }
  if (options.requireEvidence !== false && (!quality.evidenceRefs.length || !freshness.evidenceRefs.length)) {
    fail('ERR_C017_EVIDENCE_INCOMPLETE', 'C017 quality and freshness states must have stable evidence references');
  }
  const qualityReady = ['pass', 'passed', 'ok', 'warning', 'ready', 'stale', '允许推进', '通过', '质量通过'].includes(quality.status)
    || quality.status.includes('allow') || quality.status.includes('通过');
  const freshnessReady = ['ready', 'current', 'fresh', 'stale', 'warning', '允许推进', '当前', '新鲜'].includes(freshness.status)
    || freshness.status.includes('current') || freshness.status.includes('fresh');
  const qualityFailureState = ['failed', 'hard-failed', 'quality-failed', 'fail', 'prohibited', '失败'].some((value) => quality.status.includes(value));
  const freshnessFailureState = ['failed', 'unknown', 'not-run', 'running', 'refreshing', '处理中'].some((value) => freshness.status.includes(value));
  const blockingReason = permission !== 'granted'
    ? 'permission-denied'
    : quality.hardFailure || qualityFailureState
      ? 'hard-quality-failure'
      : status === 'unknown' || quality.status === 'unknown' || freshnessFailureState
        ? 'unknown-state'
        : ['failed', 'quality-failed', 'permission-denied', 'not-found'].includes(status)
          ? status
          : null;
  const consumable = !blockingReason
    && ['ready', 'warning', 'stale'].includes(status)
    && qualityReady
    && freshnessReady
    && (eligibility === null || ['allowed', 'allowed-with-warning', 'allowed_with_warning', 'eligible', 'consumable', 'ready', 'stale', 'stale_allowed', '允许推进', '允许带警告'].includes(String(eligibility).toLowerCase()));
  const qualification = quality.hardFailure ? 'prohibited' : (status === 'stale' || status === 'warning' ? 'allowed-with-warning' : (eligibility || (consumable ? 'allowed' : 'prohibited')));
  const currentStatusSummary = summaryRefs.current;
  const bindingSummary = summaryRefs.binding;
  return deepFreeze({
    projectionId: C017_PROJECTION_ID,
    schemaVersion: C017_SCHEMA_VERSION,
    contractCode: 'C017',
    producer: firstString(raw, ['producer', 'owner', 'moduleId']) || 'M02',
    sourceModule: 'M02',
    consumer: 'intelligent-query',
    consumerId: M03_CONSUMER_ID,
    consumerModule: M03_CONSUMER_ID,
    assetVersionId: dataVersion,
    asOfTime: t008.value,
    dataSideQualification: qualification,
    status,
    consumable,
    blockingReason,
    permissionStatus: permission,
    scenarioContext: contextTriple(context),
    t007: { id: t007Id, dataVersion },
    t019: { publishedOntologyVersion: ontologyVersion, bindingId: firstString(t019, ['bindingId', 'id']) || null },
    t008,
    t008Evidence: clone(t008.evidenceRefs),
    quality,
    freshness,
    qualityStatus: quality.status,
    freshnessStatus: freshness.status,
    eligibility,
    summaryRefs: clone(summaryRefs),
    bindingSummary: clone(bindingSummary),
    currentStatusSummary: clone(currentStatusSummary),
    evidenceRefs,
    readOnly: true
  });
}

function createC017Adapter(reader, options = {}) {
  rejectMutationMethods(reader, 'C017');
  const read = readSource(reader, 'C017');
  return Object.freeze({
    projectionId: C017_PROJECTION_ID,
    schemaVersion: C017_SCHEMA_VERSION,
    read(context, readOptions = {}) {
      const normalizedContext = assertReadableContext(contextTriple(adapterContext(context)));
      let raw;
      try {
        raw = read({
          consumer: 'intelligent-query',
          consumerId: M03_CONSUMER_ID,
          scenarioContext: clone(normalizedContext),
          purpose: 'M03-C017-read'
        });
      } catch (error) {
        fail('ERR_C017_READ_FAILED', 'C017 restricted projection could not be read', { cause: error.code || error.message });
      }
      if (raw && typeof raw.then === 'function') { if (typeof raw.catch === 'function') raw.catch(() => {}); fail('ERR_C017_ASYNC_READER', 'use readAsync for an asynchronous C017 reader'); }
      return normalizeC017(raw, normalizedContext, options);
    },
    async readAsync(context, readOptions = {}) {
      const normalizedContext = assertReadableContext(contextTriple(adapterContext(context)));
      let raw;
      try {
        raw = await read({ consumer: 'intelligent-query', consumerId: M03_CONSUMER_ID, scenarioContext: clone(normalizedContext), purpose: 'M03-C017-read' });
      } catch (error) {
        fail('ERR_C017_READ_FAILED', 'C017 restricted projection could not be read', { cause: error.code || error.message });
      }
      return normalizeC017(raw, normalizedContext, options);
    },
    readStrict(context) {
      const projection = this.read(context);
      if (!projection.consumable) fail('ERR_C017_NOT_CONSUMABLE', 'C017 does not authorize consumption', { reason: projection.blockingReason, status: projection.status });
      return projection;
    },
    async readStrictAsync(context) {
      const projection = await this.readAsync(context);
      if (!projection.consumable) fail('ERR_C017_NOT_CONSUMABLE', 'C017 does not authorize consumption', { reason: projection.blockingReason, status: projection.status });
      return projection;
    }
  });
}

function createReadonlyAdapters(input = {}) {
  const { c008, c008Reader, c017, c017Reader, options = {} } = input || {};
  const ontology = createC008T019Adapter(c008 || c008Reader, options.c008 || {});
  const quality = createC017Adapter(c017 || c017Reader, options.c017 || {});
  return Object.freeze({ c008: ontology, c008T019: ontology, c017: quality });
}

function readC008T019(reader, context, options) {
  return createC008T019Adapter(reader, options).read(context);
}

function readC017(reader, context, options) {
  return createC017Adapter(reader, options).read(context);
}

module.exports = Object.freeze({
  C008_PROJECTION_ID,
  C008_SCHEMA_VERSION,
  C017_PROJECTION_ID,
  C017_SCHEMA_VERSION,
  M03_CONSUMER_ID,
  C008_STATES,
  C017_STATES,
  createC008T019Adapter,
  createC008Adapter: createC008T019Adapter,
  createC008T019ReadAdapter: createC008T019Adapter,
  createC008T019Reader: createC008T019Adapter,
  createOntologyAdapter: createC008T019Adapter,
  createC017Adapter,
  createDataQualityAdapter: createC017Adapter,
  createC017ReadAdapter: createC017Adapter,
  createC017Reader: createC017Adapter,
  createReadonlyAdapters,
  readC008T019,
  readC017,
  validateC008,
  normalizeC017
});
