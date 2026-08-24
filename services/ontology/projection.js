'use strict';

const {
  C008_STATUSES,
  SCHEMA_VERSIONS,
  assertDateTime,
  assertEnum,
  assertSameContext,
  assertScenarioContext,
  assertText,
  cloneJson,
  fail,
  immutable,
  isRecord,
  sealIntegrity,
  sha256,
  text,
  verifyIntegrity
} = require('./domain');
const identity = require('../../packages/identity');

const AUTHORITATIVE_C008_SOURCE_ID = 'M01:C008';

function combinationProjection(combination) {
  if (!combination) return null;
  return {
    combinationId: combination.combinationId,
    t019Id: combination.t019Id,
    semanticVersionId: combination.semantic.publishedId,
    publishedSemanticVersion: combination.semantic.semanticVersion,
    semanticVersion: combination.semantic.semanticVersion,
    t017Id: combination.semantic.t017Id,
    semanticContentDigest: combination.semantic.contentDigest,
    resourceContractFingerprint: combination.semantic.resourceContractFingerprint || combination.semantic.contentDigest,
    endpointContractFingerprint: combination.semantic.endpointContractFingerprint || combination.data.mappingFingerprint || null,
    dataDeliveryId: combination.data.deliveryId,
    consumableDataVersion: combination.data.t007Version,
    dataVersion: combination.data.t007Version,
    t006Id: combination.data.t006Id,
    dataAsOf: combination.data.t008AsOf,
    asOf: combination.data.t008AsOf,
    status: 'current',
    consumptionStatus: 'available',
    switchedAt: combination.switchedAt,
    evidenceRefs: cloneJson(combination.evidenceRefs || []),
    scenarioContext: cloneJson(combination.scenarioContext),
    t019: {
      id: combination.t019Id,
      evidenceId: combination.evidenceRefs?.[0] || null,
      revision: combination.t019Revision
    }
  };
}

function previousProjection(previousTrusted) {
  if (!previousTrusted) return null;
  const projected = combinationProjection(previousTrusted);
  return {
    ...projected,
    canRollback: true,
    restrictions: cloneJson(previousTrusted.restrictions || []),
    trustEvidenceRefs: cloneJson(previousTrusted.evidenceRefs || [])
  };
}

function candidateProjection(candidateValidation) {
  if (!candidateValidation) return null;
  return {
    sourceModule: candidateValidation.sourceModule,
    candidateSemanticVersionId: candidateValidation.semanticVersionId,
    candidateSemanticVersion: candidateValidation.semanticVersion,
    candidateDataVersion: candidateValidation.dataVersion,
    questionSetVersion: candidateValidation.questionSetVersion,
    suiteVersion: candidateValidation.questionSetVersion,
    overallStatus: candidateValidation.status,
    perQuestionStatus: cloneJson(candidateValidation.items || []),
    completedAt: candidateValidation.completedAt,
    evidenceRefs: cloneJson(candidateValidation.evidenceRefs || []),
    retryOf: candidateValidation.retryOf || null,
    scenarioContext: cloneJson(candidateValidation.scenarioContext)
  };
}

function refreshC008Projection(state, now, options = {}) {
  state.counters.projection += 1;
  // A failed projection must not advertise the invalidated combination as a
  // consumable `current`; the authoritative T019 history remains available to
  // M01 for diagnosis and rollback.
  const current = options.readStatus === 'failed' ? null : combinationProjection(state.t019.current);
  const previousTrusted = previousProjection(state.t019.previousTrusted);
  let readStatus = options.readStatus;
  if (!readStatus) {
    if (state.t019.transition === 'rollback' && current) readStatus = 'previous-trusted';
    else if (current) readStatus = 'ready';
    else if (state.t019.transition === 'failed') readStatus = 'failed';
    else readStatus = 'empty';
  }
  assertEnum(readStatus, C008_STATUSES, 'readStatus', 'UNKNOWN_PROJECTION_STATUS');
  const lastHistory = state.t019.history[state.t019.history.length - 1] || null;
  const candidateValidation = options.candidateValidation || current?.candidateValidation || lastHistory?.candidateValidation || null;
  const projection = {
    schemaVersion: SCHEMA_VERSIONS.C008,
    contractCode: 'C008',
    sourceModule: 'M01',
    sourceId: AUTHORITATIVE_C008_SOURCE_ID,
    projectionId: state.projectionId,
    projectionVersion: state.counters.projection,
    formedAt: now,
    readStatus,
    // Compatibility aliases for older read-only consumers. `readStatus` is
    // the normative C008 state; these fields never create a second source.
    availabilityStatus: readStatus === 'ready' || readStatus === 'previous-trusted' ? 'available' : readStatus === 'empty' ? 'empty' : 'failed',
    legacyReadStatus: readStatus === 'ready' || readStatus === 'previous-trusted' ? 'available' : readStatus,
    scenarioContext: cloneJson(state.scenarioContext),
    current,
    publishedPointer: current?.t019Id || null,
    semanticVersionId: current?.semanticVersionId || null,
    semanticVersion: current?.semanticVersion || null,
    dataVersion: current?.dataVersion || null,
    dataAsOf: current?.dataAsOf || null,
    previousTrusted,
    previousTrustedCombination: previousTrusted,
    candidateValidation: candidateProjection(candidateValidation),
    t019Revision: state.t019.revision,
    transition: state.t019.transition,
    reason: options.reason || state.t019.transitionReason || (readStatus === 'empty' ? 'no T019 authoritative combination exists for this C033 run' : null),
    affectedScope: options.affectedScope || null,
    recoverySuggestion: options.recoverySuggestion || (readStatus === 'empty' ? 'complete C003, publish T017, process C028/C029/T018, validate the candidate, then ask M01 to commit T019' : null),
    invalidatedCombination: options.invalidatedCombination
      ? combinationProjection(options.invalidatedCombination)
      : (options.readStatus === 'failed' && state.t019.current ? combinationProjection(state.t019.current) : null),
    readOnly: true
  };
  state.c008 = cloneJson(sealIntegrity(projection));
  state.c008Sources = [cloneJson(state.c008)];
  return immutable(state.c008, 'C008 projection');
}

function validateCombination(value, path, expectedContext) {
  if (!isRecord(value)) fail('PROJECTION_CORRUPT', `${path} must be an object`);
  [
    'combinationId',
    't019Id',
    'semanticVersionId',
    'publishedSemanticVersion',
    't017Id',
    'semanticContentDigest',
    'dataDeliveryId',
    'consumableDataVersion',
    't006Id',
    'dataAsOf',
    'switchedAt'
  ].forEach((field) => assertText(value[field], `${path}.${field}`, { code: 'PROJECTION_CORRUPT' }));
  assertDateTime(value.switchedAt, `${path}.switchedAt`, 'PROJECTION_CORRUPT');
  assertSameContext(expectedContext, value.scenarioContext, { code: 'PROJECTION_CONTEXT_MISMATCH', allowReadOnlyLifecycle: true });
  if (value.semanticVersion !== value.publishedSemanticVersion || value.dataVersion !== value.consumableDataVersion || value.asOf !== value.dataAsOf) {
    fail('PROJECTION_VERSION_MISMATCH', `${path} compatibility aliases disagree with the authoritative versions`);
  }
  return true;
}

function validateC008Projection(value, expectedContext) {
  if (!isRecord(value)) fail('PROJECTION_CORRUPT', 'C008 projection must be an object');
  if (value.schemaVersion !== SCHEMA_VERSIONS.C008) {
    fail('PROJECTION_SCHEMA_MISMATCH', 'C008 schemaVersion is not supported', {
      expected: SCHEMA_VERSIONS.C008,
      actual: value.schemaVersion
    });
  }
  if (value.contractCode !== 'C008' || value.sourceModule !== 'M01' || value.sourceId !== AUTHORITATIVE_C008_SOURCE_ID || value.readOnly !== true) {
    fail('PROJECTION_SOURCE_INVALID', 'C008 is not the M01 read-only authoritative projection');
  }
  assertText(value.projectionId, 'projectionId', { code: 'PROJECTION_CORRUPT' });
  if (!Number.isSafeInteger(value.projectionVersion) || value.projectionVersion < 1) fail('PROJECTION_CORRUPT', 'projectionVersion must be a positive integer');
  assertDateTime(value.formedAt, 'formedAt', 'PROJECTION_CORRUPT');
  assertEnum(value.readStatus, C008_STATUSES, 'readStatus', 'UNKNOWN_PROJECTION_STATUS');
  const context = assertScenarioContext(value.scenarioContext);
  if (expectedContext) assertSameContext(expectedContext, context, { code: 'PROJECTION_CONTEXT_MISMATCH', allowReadOnlyLifecycle: true });
  verifyIntegrity(value, { label: 'C008 projection', code: 'PROJECTION_CORRUPT' });
  if (['ready', 'previous-trusted'].includes(value.readStatus)) {
    validateCombination(value.current, 'current', context);
  } else if (value.current !== null) {
    fail('PROJECTION_STATUS_MISMATCH', `${value.readStatus} C008 projection cannot expose a current consumable combination`);
  }
  if (value.previousTrusted !== null) validateCombination(value.previousTrusted, 'previousTrusted', context);
  if (value.previousTrustedCombination !== null && identity.stableSerialize(value.previousTrustedCombination) !== identity.stableSerialize(value.previousTrusted)) {
    fail('PROJECTION_VERSION_MISMATCH', 'previous-trusted aliases disagree');
  }
  if (value.candidateValidation !== null) {
    if (!isRecord(value.candidateValidation)) fail('PROJECTION_CORRUPT', 'candidateValidation must be an object or null');
    assertSameContext(context, value.candidateValidation.scenarioContext, { code: 'PROJECTION_CONTEXT_MISMATCH', allowReadOnlyLifecycle: true });
  }
  if (value.readStatus === 'failed' && !text(value.reason)) fail('PROJECTION_CORRUPT', 'failed C008 projection requires a reason');
  return { valid: true, errors: [] };
}

function validateC032ResponseFingerprint(value) {
  if (!value?.responseFingerprint) return true;
  const base = cloneJson(value);
  delete base.integrity;
  base.responseFingerprint = null;
  if (sha256(base) !== value.responseFingerprint) fail('C032_CORRUPT', 'C032 responseFingerprint does not match response content');
  return true;
}

function parseSourcePayload(payload) {
  if (typeof payload !== 'string') return cloneJson(payload, 'C008 source payload');
  try {
    return JSON.parse(payload);
  } catch (error) {
    fail('PROJECTION_CORRUPT', 'C008 source is not valid JSON', { cause: error.message });
  }
}

function readC008Sources(input) {
  // Accept a direct projection for local adapters, while the cross-module
  // boundary remains the explicit `{ sources: [...] }` form.
  if (isRecord(input) && input.schemaVersion === SCHEMA_VERSIONS.C008 && input.sourceId === AUTHORITATIVE_C008_SOURCE_ID) {
    validateC008Projection(input, input.scenarioContext || null);
    return immutable(input, 'C008 consumer snapshot');
  }
  const sources = Array.isArray(input) ? input : input?.sources;
  const expectedContext = Array.isArray(input) ? null : input?.scenarioContext;
  if (!Array.isArray(sources) || sources.length === 0) fail('PROJECTION_SOURCE_MISSING', 'no M01 C008 source was supplied');
  const sourceIds = sources.map((source) => source?.sourceId || source?.id || null);
  const seen = new Set();
  for (const sourceId of sourceIds) {
    if (seen.has(sourceId)) fail('PROJECTION_SOURCE_DUPLICATE', 'the same C008 source was supplied more than once', { sourceId });
    seen.add(sourceId);
  }
  if (sources.length !== 1) fail('PROJECTION_DUAL_SOURCE', 'C008 requires exactly one authoritative source', { sourceIds });
  const source = sources[0];
  if (!isRecord(source) || sourceIds[0] !== AUTHORITATIVE_C008_SOURCE_ID) {
    fail('PROJECTION_SOURCE_INVALID', 'C008 sourceId must identify the M01 authoritative source', { sourceId: sourceIds[0] });
  }
  const projection = parseSourcePayload(
    source.payload ?? source.value ?? source.projection
      ?? (source.schemaVersion === SCHEMA_VERSIONS.C008 ? source : undefined)
  );
  validateC008Projection(projection, expectedContext);
  return immutable(projection, 'C008 consumer snapshot');
}

function createC008Consumer(readSources) {
  if (typeof readSources !== 'function') fail('INVALID_CONSUMER_ADAPTER', 'readSources must be a function');
  return Object.freeze({
    sourceId: AUTHORITATIVE_C008_SOURCE_ID,
    read(scenarioContext) {
      const sources = readSources(scenarioContext);
      if (sources && typeof sources.then === 'function') {
        return Promise.resolve(sources).then((items) => readC008Sources({ sources: items, scenarioContext }));
      }
      return readC008Sources({ sources, scenarioContext });
    }
  });
}

module.exports = Object.freeze({
  AUTHORITATIVE_C008_SOURCE_ID,
  combinationProjection,
  refreshC008Projection,
  validateC008Projection,
  validateC032ResponseFingerprint,
  readC008Sources,
  createC008Consumer
});
