'use strict';

const foundationCheckpoint = require('../../packages/checkpoint');
const {
  SCHEMA_VERSIONS,
  assertSameContext,
  assertScenarioContext,
  cloneJson,
  fail,
  immutable,
  isRecord,
  sealIntegrity,
  verifyIntegrity
} = require('./domain');
const { validateC008Projection, refreshC008Projection } = require('./projection');

const CHECKPOINT_SCHEMA_VERSION = foundationCheckpoint.CHECKPOINT_SCHEMA_VERSION;

function stateSnapshot(service, context) {
  return cloneJson(service.getState({ scenarioContext: context }));
}

function createModuleCheckpoint(service, request = {}) {
  const context = assertScenarioContext(request.scenarioContext || service.context);
  assertSameContext(service.context, context);
  const state = stateSnapshot(service, context);
  const now = service._now(request.formedAt);
  const checkpointId = request.checkpointId || service._id('M01-CP', { context, revision: state.revision, now });
  const moduleState = {
    stateSchemaVersion: SCHEMA_VERSIONS.CHECKPOINT_STATE,
    scenarioContext: cloneJson(context),
    ontologyId: service.ontologyId,
    projectionId: state.projectionId,
    counters: state.counters,
    drafts: state.drafts,
    draftOrder: state.draftOrder,
    published: state.published,
    publishedOrder: state.publishedOrder,
    deliveryRecords: state.deliveryRecords,
    deliveryOrder: state.deliveryOrder,
    refreshTargets: state.refreshTargets,
    refreshTargetOrder: state.refreshTargetOrder,
    discoveries: state.discoveries,
    discoveryOrder: state.discoveryOrder,
    refreshRequests: state.refreshRequests,
    refreshRequestOrder: state.refreshRequestOrder,
    refreshResults: state.refreshResults,
    refreshResultOrder: state.refreshResultOrder,
    qualifications: state.qualifications,
    qualificationOrder: state.qualificationOrder,
    t019: state.t019,
    c008: state.c008,
    c008Sources: state.c008Sources,
    historicalState: state.historicalState || null,
    historicalAudit: state.historicalAudit || null,
    historicalProjection: state.historicalProjection || null,
    audit: state.audit,
    revision: state.revision
  };
  const checkpoint = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    checkpointId,
    module: 'M01',
    moduleOwner: 'M01',
    moduleState,
    drafts: state.drafts,
    publishedVersions: state.published,
    t019: state.t019,
    c008Projection: state.c008,
    scenarioContext: cloneJson(context),
    sourceScenarioRunId: context.scenarioRunId,
    baselineVersion: request.baselineVersion || 'v1.1.0',
    baselineSnapshotId: request.baselineSnapshotId || 'BSL-OFW-V110-94ABD0E991B7',
    implementationVersion: 'implementation-0.1.0',
    sourceTag: 'prototype-v1.1.0-frozen',
    exportedAt: now,
    immutable: true,
    restoreReadiness: { status: 'verified', checkedAt: now },
    sideEffectPolicy: foundationCheckpoint.SIDE_EFFECT_POLICY,
    overwritesHistory: false,
    overwritesSource: false,
    replayHistoricalSideEffects: false,
    replayedSideEffects: [],
    stateRevision: state.revision,
    resourceSummary: {
      draftCount: state.draftOrder.length,
      publishedCount: state.publishedOrder.length,
      deliveryCount: state.deliveryOrder.length,
      targetCount: state.refreshTargetOrder.length,
      refreshRequestCount: state.refreshRequestOrder.length,
      refreshResultCount: state.refreshResultOrder.length,
      t019Revision: state.t019.revision,
      projectionVersion: state.c008?.projectionVersion || null
    }
  };
  return sealIntegrity(checkpoint);
}

function validateModuleCheckpoint(service, checkpoint, options = {}) {
  const errors = [];
  try {
    const structural = foundationCheckpoint.validateCheckpoint(checkpoint, {
      requireSchemaVersion: true
    });
    if (!structural.ok) errors.push(...structural.errors);
  } catch (error) {
    errors.push({ code: error.code || 'INVALID_CHECKPOINT', path: '$', message: error.message });
  }
  try {
    verifyIntegrity(checkpoint, { label: 'M01 checkpoint', code: 'CHECKPOINT_CORRUPT' });
  } catch (error) {
    errors.push({ code: error.code, path: '$.integrity', message: error.message });
  }
  try {
    if (checkpoint.immutable !== true) fail('CHECKPOINT_NOT_IMMUTABLE', 'M01 checkpoint immutable must be true');
    if (!isRecord(checkpoint.restoreReadiness) || checkpoint.restoreReadiness.status !== 'verified') fail('CHECKPOINT_NOT_RESTORABLE', 'M01 checkpoint restoreReadiness must be verified');
    if (checkpoint.module !== 'M01' || checkpoint.moduleOwner !== 'M01') fail('CHECKPOINT_OWNER_MISMATCH', 'checkpoint is not owned by M01');
    const context = assertScenarioContext(checkpoint.scenarioContext);
    if (checkpoint.sourceScenarioRunId !== context.scenarioRunId) fail('SOURCE_RUN_MISMATCH', 'checkpoint sourceScenarioRunId does not match C033');
    if (!isRecord(checkpoint.moduleState)) fail('CHECKPOINT_STATE_MISSING', 'checkpoint moduleState is required');
    assertSameContext(context, checkpoint.moduleState.scenarioContext);
    if (checkpoint.moduleState.stateSchemaVersion !== SCHEMA_VERSIONS.CHECKPOINT_STATE) fail('CHECKPOINT_SCHEMA_MISMATCH', 'M01 state schema is not supported');
    validateC008Projection(checkpoint.moduleState.c008, context);
    if (!Array.isArray(checkpoint.moduleState.c008Sources) || checkpoint.moduleState.c008Sources.length !== 1) {
      fail('PROJECTION_DUAL_SOURCE', 'checkpoint must contain exactly one C008 source');
    }
    const checkpointSource = checkpoint.moduleState.c008Sources[0];
    if (checkpointSource?.sourceId !== 'M01:C008') fail('PROJECTION_SOURCE_INVALID', 'checkpoint C008 source must be M01:C008');
    if (checkpointSource?.integrity) verifyIntegrity(checkpointSource, { label: 'checkpoint C008 source', code: 'PROJECTION_CORRUPT' });
    if (checkpointSource?.integrity?.digest !== checkpoint.moduleState.c008?.integrity?.digest) fail('PROJECTION_SOURCE_MISMATCH', 'checkpoint C008 source and projection content disagree');
    const sourceIds = checkpoint.moduleState.c008.sourceId ? [checkpoint.moduleState.c008.sourceId] : [];
    if (sourceIds.length !== 1 || sourceIds[0] !== 'M01:C008') fail('PROJECTION_SOURCE_INVALID', 'checkpoint must contain one M01 C008 source');
    if (checkpoint.moduleState.t019?.current) assertSameContext(context, checkpoint.moduleState.t019.current.scenarioContext);
    Object.values(checkpoint.moduleState.deliveryRecords || {}).forEach((record) => {
      if (record.payload?.integrity) verifyIntegrity(record.payload, { label: 'C003 payload', code: 'C003_CORRUPT' });
      if (record.payload?.scenarioContext) assertSameContext(context, record.payload.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
      if (record.receipt?.scenarioContext) assertSameContext(context, record.receipt.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.drafts || {}).forEach((draft) => {
      if (!draft.draftId || !Array.isArray(draft.revisions) || !['draft-unvalidated', 'draft-blocked', 'draft-validated', 'published', 'abandoned'].includes(draft.lifecycleState)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint Draft structure is invalid');
      draft.revisions.forEach((revision) => {
        if (!Number.isSafeInteger(revision.contentRevision) || revision.contentRevision < 1 || !revision.contentDigest || !isRecord(revision.content)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint Draft revision structure is invalid');
      });
      assertSameContext(context, draft.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.published || {}).forEach((published) => {
      if (published.schemaVersion !== SCHEMA_VERSIONS.T017 || !published.publishedId || !published.t017Id || published.immutable !== true || published.publicationStatus !== 'published' || !Array.isArray(published.resources)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint Published structure is invalid');
      if (!published.integrity) fail('CHECKPOINT_CORRUPT', 'checkpoint Published record has no integrity seal');
      verifyIntegrity(published, { label: 'T017', code: 'CHECKPOINT_CORRUPT' });
      assertSameContext(context, published.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.refreshTargets || {}).flat().forEach((target) => {
      verifyIntegrity(target, { label: 'T054', code: 'T054_CORRUPT' });
      assertSameContext(context, target.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.discoveries || {}).forEach((discovery) => {
      verifyIntegrity(discovery, { label: 'C032', code: 'C032_CORRUPT' });
      assertSameContext(context, discovery.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.refreshRequests || {}).forEach((record) => {
      if (!record.request?.requestId || !record.receipt?.requestId || !['accepted', 'rejected', 'unknown'].includes(record.receipt.status)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint C028 structure is invalid');
      if (record.request?.scenarioContext) assertSameContext(context, record.request.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
      if (record.receipt?.scenarioContext) assertSameContext(context, record.receipt.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.refreshResults || {}).forEach((record) => {
      if (!record.result?.resultId || !['processing', 'succeeded', 'failed', 'incompatible', 'unknown'].includes(record.result.status)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint C029 structure is invalid');
      if (record.result?.scenarioContext) assertSameContext(context, record.result.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
      if (record.result?.t018?.scenarioContext) assertSameContext(context, record.result.t018.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    Object.values(checkpoint.moduleState.qualifications || {}).forEach((qualification) => {
      if (!qualification.qualificationId || !['eligible', 'ineligible', 'unknown'].includes(qualification.status)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint T018 structure is invalid');
      assertSameContext(context, qualification.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    (checkpoint.moduleState.t019?.history || []).forEach((record) => {
      if (!record.transition || (record.transition !== 'failed' && !record.t019Id)) fail('CHECKPOINT_STATE_INVALID', 'checkpoint T019 history structure is invalid');
      assertSameContext(context, record.scenarioContext, { code: 'CHECKPOINT_CONTEXT_MISMATCH' });
    });
    if (checkpoint.moduleState.t019?.current) {
      const current = checkpoint.moduleState.t019.current;
      if (!current.t019Id || !current.combinationId || !isRecord(current.semantic) || !isRecord(current.data) || !current.semantic.publishedId || !current.data.t007Version) fail('CHECKPOINT_STATE_INVALID', 'checkpoint current T019 structure is invalid');
    }
  } catch (error) {
    errors.push({ code: error.code || 'CHECKPOINT_INVALID', path: '$.moduleState', message: error.message, details: error.details || null });
  }
  return { ok: errors.length === 0, valid: errors.length === 0, errors };
}

function isolatedState(service, checkpoint, targetContext, mode) {
  const sourceState = cloneJson(checkpoint.moduleState);
  const historicalState = cloneJson(sourceState);
  const restored = {
    ...sourceState,
    scenarioContext: cloneJson(targetContext),
    restoredFrom: {
      checkpointId: checkpoint.checkpointId,
      sourceScenarioRunId: checkpoint.sourceScenarioRunId,
      mode
    },
    // Historical definitions and evidence remain available, but the new
    // isolated run never inherits authority or silently switches production.
    t019: {
      ...sourceState.t019,
      revision: 0,
      current: null,
      previousTrusted: null,
      transition: 'empty',
      transitionReason: 'isolated restore starts without a current authority',
      history: [],
      trustedHistory: [],
      invalidatedCombinationIds: []
    },
    // Historical records are deliberately kept outside the active namespace;
    // this prevents old delivery/request IDs from satisfying new-run
    // idempotency checks or being consumed as current facts.
    historicalState,
    historicalDrafts: sourceState.drafts || {},
    historicalPublishedVersions: sourceState.published || {},
    historicalT019: sourceState.t019 || null,
    historicalAudit: sourceState.audit || [],
    historicalProjection: sourceState.c008 || null,
    drafts: {},
    draftOrder: [],
    published: {},
    publishedOrder: [],
    deliveryRecords: {},
    deliveryOrder: [],
    refreshTargets: {},
    refreshTargetOrder: [],
    discoveries: {},
    discoveryOrder: [],
    refreshRequests: {},
    refreshRequestOrder: [],
    refreshResults: {},
    refreshResultOrder: [],
    qualifications: {},
    qualificationOrder: [],
    c008: null,
    revision: 0,
    audit: []
  };
  restored.counters = {
    draft: 0,
    published: 0,
    discovery: 0,
    result: 0,
    qualification: 0,
    projection: 0,
    checkpoint: 0,
    audit: 0
  };
  restored.projectionId = `${sourceState.projectionId || 'M01:C008'}:${targetContext.scenarioRunId}`;
  const projection = refreshC008Projection(restored, service._now(), {
    readStatus: 'empty',
    reason: 'isolated restore starts without an authoritative T019',
    recoverySuggestion: 'revalidate the restored Draft and explicitly adopt a new T019 in this scenario run'
  });
  restored.c008 = cloneJson(projection);
  return restored;
}

function cloneRestoreModule(service, request = {}) {
  const checkpoint = request.checkpoint || request.sourceCheckpoint;
  if (!checkpoint) fail('INVALID_RESTORE_INPUT', 'cloneRestore requires a checkpoint');
  const targetContext = assertScenarioContext(request.targetScenarioContext || request.scenarioContext, { write: true });
  const sourceContext = assertScenarioContext(checkpoint.scenarioContext);
  if (targetContext.scenarioRunId === sourceContext.scenarioRunId) fail('SCENARIO_RUN_REUSED', 'clone restore must create a new scenarioRunId');
  const validation = validateModuleCheckpoint(service, checkpoint);
  if (!validation.ok) fail('INVALID_CHECKPOINT', 'M01 checkpoint cannot be restored', validation.errors);
  const restoredState = isolatedState(service, checkpoint, targetContext, 'clone-restore');
  return {
    module: 'M01',
    mode: 'clone-restore',
    checkpointId: checkpoint.checkpointId,
    sourceScenarioRunId: sourceContext.scenarioRunId,
    targetScenarioRunId: targetContext.scenarioRunId,
    scenarioContext: cloneJson(targetContext),
    restoredState,
    currentT019: null,
    appliedToSource: false,
    overwritesHistory: false,
    overwritesSource: false,
    replayHistoricalSideEffects: false,
    sideEffectsSuppressed: true,
    sideEffectPolicy: foundationCheckpoint.SIDE_EFFECT_POLICY
  };
}

function isolatedReplayModule(service, request = {}) {
  const result = cloneRestoreModule(service, request);
  return { ...result, mode: 'isolated-replay', replayedSideEffects: [], externalCapabilitiesDefault: 'disabled' };
}

function migrationCompareModule(service, request = {}) {
  const baseline = request.comparison || foundationCheckpoint.migrationCompare(request.source, request.target, request.options || {});
  const sourceState = request.source?.moduleState;
  const targetState = request.target?.moduleState;
  const findings = [];
  if (sourceState && targetState) {
    if (sourceState.t019?.current && targetState.t019?.current
        && sourceState.t019.current.combinationId === targetState.t019.current.combinationId) {
      findings.push({ code: 'REUSED_T019_COMBINATION', severity: 'error', message: 'migration target reused the source T019 combination' });
    }
    if (sourceState.c008?.projectionId && targetState.c008?.projectionId === sourceState.c008.projectionId) {
      findings.push({ code: 'REUSED_PROJECTION_ID', severity: 'error', message: 'migration target reused the source C008 projection identity' });
    }
  }
  return {
    ...baseline,
    compatible: baseline.compatible !== false && findings.every((finding) => finding.severity !== 'error'),
    findings,
    module: 'M01',
    sourceScenarioRunId: baseline.sourceScenarioRunId,
    targetScenarioRunId: baseline.targetScenarioRunId,
    newScenarioRunId: baseline.newScenarioRunId,
    overwritesSource: false,
    sideEffectsSuppressed: true,
    sideEffectPolicy: foundationCheckpoint.SIDE_EFFECT_POLICY
  };
}

function createM01CheckpointProvider(service, options = {}) {
  if (!service) fail('INVALID_PROVIDER', 'createM01CheckpointProvider requires an OntologyService');
  const implementation = {
    export(request) { return createModuleCheckpoint(service, request || {}); },
    validate(checkpoint) { return validateModuleCheckpoint(service, checkpoint); },
    cloneRestore(request) { return cloneRestoreModule(service, request || {}); },
    isolatedReplay(request) { return isolatedReplayModule(service, request || {}); },
    migrationCompare(request) { return migrationCompareModule(service, request || {}); }
  };
  return foundationCheckpoint.createProvider(implementation, {
    requireSchemaVersion: options.requireSchemaVersion !== false,
    requireAllMethods: true
  });
}

module.exports = Object.freeze({
  CHECKPOINT_SCHEMA_VERSION,
  createModuleCheckpoint,
  validateModuleCheckpoint,
  cloneRestoreModule,
  isolatedReplayModule,
  migrationCompareModule,
  createM01CheckpointProvider,
  createCheckpointProvider: createM01CheckpointProvider,
  exportCheckpoint: createModuleCheckpoint
});
