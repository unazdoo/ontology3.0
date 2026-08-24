'use strict';

const checkpoint = require('../../packages/checkpoint');
const {
  DATA_SCHEMA_VERSION,
  DATA_SPINE_CONTRACT_ID,
  clone,
  deepFreeze,
  contentFingerprint,
  assertContext,
  sameExactContext,
  assertAllowedFields,
  assertExactSchemaVersion
} = require('./contracts');

const M02_CHECKPOINT_STATE_VERSION = DATA_SCHEMA_VERSION;
const M02_CHECKPOINT_MODULE_ID = 'M02';
const CHECKPOINT_FIELDS = Object.freeze([
  'schemaVersion', 'checkpointId', 'immutable', 'scenarioContext',
  'sourceScenarioRunId', 'formedAt', 'restoreReadiness', 'sideEffectPolicy',
  'overwritesHistory', 'overwritesSource', 'moduleId', 'moduleContractId',
  'moduleSchemaVersion', 'moduleStateVersion', 'stateFingerprint', 'state'
]);
const STATE_FIELDS = Object.freeze([
  'runIds', 'qualityIds', 'assetIds', 'assetVersionIds', 'pipelineRefs',
  't008ConfirmationIds', 'snapshotRefs', 'sourceRefs', 'upstreamAssetVersionRefs',
  'auditOnlyRefs', 's003CompatibilityLocks'
]);
const AUDIT_REF_FIELDS = Object.freeze([
  'deliveryIds', 'c017SummaryIds', 'c017ReadIds', 'c032ResponseIds',
  'c028RequestIds', 'c029ResultIds', 'findingIds', 'candidateOutcomeIds',
  'readEventIds'
]);

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function values(map) { return map instanceof Map ? [...map.values()] : []; }
function exact(value, context) {
  try { return value?.scenarioContext && sameExactContext(value.scenarioContext, context); } catch (_) { return false; }
}

function buildState(runtime, context) {
  if (!runtime || !(runtime.runs instanceof Map)) throw new TypeError('M02 checkpoint export requires a DataPipelineRuntime');
  const runs = values(runtime.runs).filter((item) => exact(item, context));
  const runIds = sortedUnique(runs.map((item) => item.runId));
  const qualityIds = sortedUnique(runs.map((item) => item.qualityId));
  const assetVersions = values(runtime.assetVersions).filter((item) => exact(item, context));
  const assetVersionIds = sortedUnique(assetVersions.map((item) => item.assetVersionId));
  const assetIds = sortedUnique(assetVersions.map((item) => item.assetId).concat(runs.map((item) => item.outputAssetId)));
  const t008Confirmations = values(runtime.t008Confirmations).filter((item) => exact(item, context));
  const t008ConfirmationIds = sortedUnique(t008Confirmations.map((item) => item.confirmationId));
  const lockedSnapshots = runs.flatMap((run) => run.inputLocks || []).filter((lock) => lock.kind === 'T002');
  const snapshotIds = sortedUnique(lockedSnapshots.map((lock) => lock.snapshotId).concat(t008Confirmations.map((item) => item.snapshotId)));
  const snapshotRefs = snapshotIds.map((snapshotId) => {
    const item = runtime.snapshots.get(snapshotId);
    return deepFreeze({ snapshotId, sourceId: item?.sourceId || null, contentFingerprint: item?.contentFingerprint || item?.contentHash || null });
  });
  const sourceIds = sortedUnique(snapshotRefs.map((item) => item.sourceId));
  const sourceRefs = sourceIds.map((sourceId) => {
    const item = runtime.sources.get(sourceId);
    return deepFreeze({ sourceId, sourceVersion: item?.sourceVersion || null });
  });
  const pipelineRefs = sortedUnique(runs.map((item) => `${item.pipelineId}@${item.pipelineVersion}`));
  const upstreamAssetVersionRefs = sortedUnique(runs.flatMap((run) => run.inputLocks || [])
    .filter((lock) => lock.kind === 'T007').map((lock) => lock.assetVersionId));
  const deliveries = values(runtime.deliveryRecords).filter((item) => exact(item, context));
  const requests = values(runtime.refreshRequests).filter((item) => exact(item.request, context));
  const requestIds = sortedUnique(requests.map((item) => item.request.requestId));
  const results = values(runtime.refreshResults).filter((item) => requestIds.includes(item.requestId));
  const findings = values(runtime.postPublishFindings).filter((item) => assetVersionIds.includes(item.assetVersionId));
  const outcomes = values(runtime.candidateOutcomes).filter((item) => exact(item, context));
  const readEvents = values(runtime.readEvents).concat(values(runtime.t008ReadEvents)).filter((item) => exact(item, context));
  const auditOnlyRefs = deepFreeze({
    deliveryIds: sortedUnique(deliveries.map((item) => item.deliveryId)),
    c017SummaryIds: sortedUnique(values(runtime.c017Summaries).filter((item) => exact(item, context)).map((item) => item.summaryId)),
    c017ReadIds: sortedUnique(values(runtime.c017Reads).filter((item) => exact(item, context)).map((item) => item.readId)),
    c032ResponseIds: sortedUnique(values(runtime.c032Responses).filter((item) => exact(item, context)).map((item) => item.responseId)),
    c028RequestIds: requestIds,
    c029ResultIds: sortedUnique(results.map((item) => item.resultId)),
    findingIds: sortedUnique(findings.map((item) => item.findingId)),
    candidateOutcomeIds: sortedUnique(outcomes.map((item) => item.outcomeId)),
    readEventIds: sortedUnique(readEvents.map((item) => item.readEventId || item.eventId))
  });
  const s003CompatibilityLocks = assetVersions.filter((item) => item.compatibilityOnly === true || item.consumption?.compatibilityOnly === true)
    .map((item) => deepFreeze({
      assetVersionId: item.assetVersionId,
      compatibilityOnly: true,
      consumable: false,
      reusable: false
    }));
  return deepFreeze({
    runIds,
    qualityIds,
    assetIds,
    assetVersionIds,
    pipelineRefs,
    t008ConfirmationIds,
    snapshotRefs,
    sourceRefs,
    upstreamAssetVersionRefs,
    auditOnlyRefs,
    s003CompatibilityLocks
  });
}

function validateM02Checkpoint(value, runtime) {
  const errors = [];
  try {
    assertAllowedFields(value, CHECKPOINT_FIELDS, 'M02_CHECKPOINT', { required: CHECKPOINT_FIELDS });
    const structural = checkpoint.validateCheckpoint(value, { requireSchemaVersion: true });
    if (!structural.ok) errors.push(...structural.errors);
    assertContext(value.scenarioContext);
    assertExactSchemaVersion(value.moduleSchemaVersion, DATA_SCHEMA_VERSION);
    assertExactSchemaVersion(value.moduleStateVersion, M02_CHECKPOINT_STATE_VERSION);
    if (value.moduleId !== M02_CHECKPOINT_MODULE_ID) errors.push({ code: 'M02_MODULE_MISMATCH', path: 'moduleId' });
    if (value.moduleContractId !== DATA_SPINE_CONTRACT_ID) errors.push({ code: 'M02_CONTRACT_MISMATCH', path: 'moduleContractId' });
    assertAllowedFields(value.state, STATE_FIELDS, 'M02_CHECKPOINT_STATE', { required: STATE_FIELDS });
    assertAllowedFields(value.state.auditOnlyRefs, AUDIT_REF_FIELDS, 'M02_CHECKPOINT_AUDIT_REFS', { required: AUDIT_REF_FIELDS });
    if (contentFingerprint(value.state) !== value.stateFingerprint) errors.push({ code: 'M02_STATE_FINGERPRINT_MISMATCH', path: 'stateFingerprint' });
    for (const lock of value.state.s003CompatibilityLocks) {
      assertAllowedFields(lock, ['assetVersionId', 'compatibilityOnly', 'consumable', 'reusable'], 'M02_S003_LOCK', { required: ['assetVersionId', 'compatibilityOnly', 'consumable', 'reusable'] });
      if (lock.compatibilityOnly !== true || lock.consumable !== false || lock.reusable !== false) errors.push({ code: 'M02_S003_LOCK_INVALID', path: 'state.s003CompatibilityLocks' });
    }
    if (runtime) {
      for (const runId of value.state.runIds) {
        const run = runtime.runs.get(runId);
        if (!run || !sameExactContext(run.scenarioContext, value.scenarioContext)) errors.push({ code: 'M02_RUN_REF_INVALID', path: `state.runIds.${runId}` });
      }
      for (const qualityId of value.state.qualityIds) if (!runtime.quality.has(qualityId)) errors.push({ code: 'M02_QUALITY_REF_INVALID', path: `state.qualityIds.${qualityId}` });
      for (const assetVersionId of value.state.assetVersionIds) if (!runtime.assetVersions.has(assetVersionId)) errors.push({ code: 'M02_T007_REF_INVALID', path: `state.assetVersionIds.${assetVersionId}` });
      for (const confirmationId of value.state.t008ConfirmationIds) if (!runtime.t008Confirmations.has(confirmationId)) errors.push({ code: 'M02_T008_REF_INVALID', path: `state.t008ConfirmationIds.${confirmationId}` });
    } else if (value.restoreReadiness.status === 'verified') {
      errors.push({ code: 'M02_VERIFIED_CHECKPOINT_REQUIRES_OWNER_RESOLVER', path: 'restoreReadiness.status' });
    }
  } catch (error) {
    errors.push({ code: error.code || 'M02_CHECKPOINT_INVALID', path: '$', message: error.message, details: error.details || null });
  }
  return { ok: errors.length === 0, valid: errors.length === 0, errors };
}

function exportM02Checkpoint(runtime, request = {}, options = {}) {
  const context = assertContext(request.scenarioContext);
  const state = buildState(runtime, context);
  const stateFingerprint = contentFingerprint(state);
  const verified = typeof options.verifyReferences === 'function'
    && options.verifyReferences({ runtime, scenarioContext: context, state, stateFingerprint }) === true;
  const value = deepFreeze({
    schemaVersion: checkpoint.CHECKPOINT_SCHEMA_VERSION,
    checkpointId: request.checkpointId || `M02-CP-${context.scenarioRunId}-${stateFingerprint.slice(0, 16)}`,
    immutable: true,
    scenarioContext: context,
    sourceScenarioRunId: context.scenarioRunId,
    formedAt: request.formedAt || context.formedAt,
    restoreReadiness: { status: verified ? 'verified' : 'not-verified' },
    sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY,
    overwritesHistory: false,
    overwritesSource: false,
    moduleId: M02_CHECKPOINT_MODULE_ID,
    moduleContractId: DATA_SPINE_CONTRACT_ID,
    moduleSchemaVersion: DATA_SCHEMA_VERSION,
    moduleStateVersion: M02_CHECKPOINT_STATE_VERSION,
    stateFingerprint,
    state
  });
  const validation = validateM02Checkpoint(value, runtime);
  if (!validation.ok) throw new Error(`M02 checkpoint export invalid: ${JSON.stringify(validation.errors)}`);
  return value;
}

function createM02CheckpointProvider(runtime, options = {}) {
  return checkpoint.createProvider({
    export(request) { return exportM02Checkpoint(runtime, request, options); },
    validate(value) { return validateM02Checkpoint(value, runtime); }
  }, { requireSchemaVersion: true });
}

module.exports = Object.freeze({
  M02_CHECKPOINT_STATE_VERSION,
  M02_CHECKPOINT_MODULE_ID,
  CHECKPOINT_FIELDS,
  STATE_FIELDS,
  AUDIT_REF_FIELDS,
  buildM02CheckpointState: buildState,
  validateM02Checkpoint,
  exportM02Checkpoint,
  createM02CheckpointProvider
});
