'use strict';

const domain = require('./domain');
const repository = require('./repository');
const validation = require('./validation');
const projection = require('./projection');
const service = require('./service');
const checkpoint = require('./checkpoint');
const contracts = require('./contracts');

function createOntologyService(options) {
  return new service.OntologyService(options);
}

const ERROR_CODES = Object.freeze({
  INVALID_SCENARIO_CONTEXT: 'INVALID_SCENARIO_CONTEXT',
  UNKNOWN_CONTEXT_STATUS: 'UNKNOWN_CONTEXT_STATUS',
  CONTEXT_READ_ONLY: 'CONTEXT_READ_ONLY',
  SCENARIO_CONTEXT_MISMATCH: 'SCENARIO_CONTEXT_MISMATCH',
  SCENARIO_RUN_MISMATCH: 'SCENARIO_RUN_MISMATCH',
  C003_INVALID: 'C003_INVALID',
  C003_CORRUPT: 'C003_CORRUPT',
  C003_SOURCE_INVALID: 'C003_SOURCE_INVALID',
  C003_UNKNOWN_STATUS: 'C003_UNKNOWN_STATUS',
  C003_IDEMPOTENCY_CONFLICT: 'C003_IDEMPOTENCY_CONFLICT',
  C003_MEMBER_SCOPE_MISMATCH: 'C003_MEMBER_SCOPE_MISMATCH',
  C003_RELATION_SCOPE_MISMATCH: 'C003_RELATION_SCOPE_MISMATCH',
  C003_RELATION_ENDPOINT_MISMATCH: 'C003_RELATION_ENDPOINT_MISMATCH',
  C003_QUALITY_BLOCKED: 'C003_QUALITY_BLOCKED',
  C003_LINEAGE_BLOCKED: 'C003_LINEAGE_BLOCKED',
  C003_LINEAGE_CYCLE: 'C003_LINEAGE_CYCLE',
  C032_INVALID: 'C032_INVALID',
  C032_UNKNOWN_STATUS: 'C032_UNKNOWN_STATUS',
  C032_DRIFT: 'C032_DRIFT',
  C032_RESPONSE_NOT_FOUND: 'C032_RESPONSE_NOT_FOUND',
  C032_ASSET_MISMATCH: 'C032_ASSET_MISMATCH',
  C028_INVALID: 'C028_INVALID',
  C028_IDEMPOTENCY_CONFLICT: 'C028_IDEMPOTENCY_CONFLICT',
  C028_CANDIDATE_MISMATCH: 'C028_CANDIDATE_MISMATCH',
  C029_INVALID: 'C029_INVALID',
  C029_UNKNOWN_STATUS: 'C029_UNKNOWN_STATUS',
  C029_IDEMPOTENCY_CONFLICT: 'C029_IDEMPOTENCY_CONFLICT',
  C029_CHECK_REQUIRED: 'C029_CHECK_REQUIRED',
  T017_NOT_PUBLISHED: 'T017_NOT_PUBLISHED',
  T018_NOT_FOUND: 'T018_NOT_FOUND',
  T018_NOT_ELIGIBLE: 'T018_NOT_ELIGIBLE',
  T019_GATE_MISSING: 'T019_GATE_MISSING',
  T019_GATE_FAILED: 'T019_GATE_FAILED',
  T019_REVISION_CONFLICT: 'T019_REVISION_CONFLICT',
  T054_INVALID: 'T054_INVALID',
  T054_CORRUPT: 'T054_CORRUPT',
  T054_NOT_AVAILABLE: 'T054_NOT_AVAILABLE',
  T054_DUPLICATE_VERSION: 'T054_DUPLICATE_VERSION',
  NO_PREVIOUS_TRUSTED: 'NO_PREVIOUS_TRUSTED',
  PROJECTION_SOURCE_MISSING: 'PROJECTION_SOURCE_MISSING',
  PROJECTION_DUAL_SOURCE: 'PROJECTION_DUAL_SOURCE',
  PROJECTION_CORRUPT: 'PROJECTION_CORRUPT',
  PROJECTION_SCHEMA_MISMATCH: 'PROJECTION_SCHEMA_MISMATCH',
  PROJECTION_CONTEXT_MISMATCH: 'PROJECTION_CONTEXT_MISMATCH',
  OWNER_BOUNDARY_VIOLATION: 'OWNER_BOUNDARY_VIOLATION',
  CONCURRENT_TRANSACTION: 'CONCURRENT_TRANSACTION',
  REVISION_CONFLICT: 'REVISION_CONFLICT'
});

const CONTRACT_VERSIONS = Object.freeze(Object.fromEntries(
  Object.entries(domain.SCHEMA_VERSIONS).map(([key, value]) => [`${key}_SCHEMA_VERSION`, value])
));

const api = {
  ...domain,
  ...validation,
  ...projection,
  ...checkpoint,
  ...contracts,
  ...repository,
  ...service,
  ERROR_CODES,
  CONTRACT_VERSIONS,
  ...CONTRACT_VERSIONS,
  createOntologyService,
  createService: createOntologyService,
  Ontology: service.OntologyService,
  M01Service: service.OntologyService,
  M01Error: domain.OntologyError,
  OntologyRuntimeError: domain.OntologyError,
  MemoryRepository: repository.MemoryOntologyRepository,
  createC034Provider: checkpoint.createM01CheckpointProvider,
  createCheckpointProvider: checkpoint.createM01CheckpointProvider,
  C034Provider: checkpoint.createM01CheckpointProvider,
  // Function aliases make the module convenient for thin adapters while all
  // writes still execute against an explicit M01 service instance.
  receiveC003: (instance, input) => instance.receiveC003(input),
  acceptC003: (instance, input) => instance.receiveC003(input),
  receiveDelivery: (instance, input) => instance.receiveC003(input),
  createDraft: (instance, input) => instance.createDraft(input),
  saveDraft: (instance, input) => instance.saveDraft(input),
  validateDraft: (instance, input) => instance.validateDraft(input),
  publishDraft: (instance, input) => instance.publishDraft(input),
  publish: (instance, input) => instance.publishDraft(input),
  deriveDraftFromPublished: (instance, input) => instance.deriveDraftFromPublished(input),
  discoverC032: (instance, input) => instance.discoverC032(input),
  discoverRefreshTarget: (instance, input) => instance.discoverC032(input),
  readC032: (instance, input) => instance.discoverC032(input),
  createT054: (instance, input) => instance.createRefreshTarget(input),
  createRefreshTarget: (instance, input) => instance.createRefreshTarget(input),
  submitC028: (instance, input) => instance.submitC028(input),
  receiveC028: (instance, input) => instance.submitC028(input),
  completeC029: (instance, input) => instance.completeC029(input),
  receiveC029: (instance, input) => instance.completeC029(input),
  evaluateT018: (instance, input) => instance.completeC029(input),
  commitT019: (instance, input) => instance.commitT019(input),
  switchT019: (instance, input) => instance.commitT019(input),
  rollbackT019: (instance, input) => instance.rollbackT019(input),
  markQualityFailure: (instance, input) => instance.markQualityFailure(input),
  invalidateT019: (instance, input) => instance.markQualityFailure(input),
  readC008: (instance, input) => instance.readC008(input),
  projectC008: (instance, input) => instance.projectC008(input),
  previousTrusted: (instance, input) => instance.previousTrusted(input),
  exportState: (instance, input) => instance.exportOwnedState(input),
  exportCheckpoint: (instance, input) => instance.exportCheckpoint(input),
  validateCheckpoint: (instance, input) => instance.validateCheckpoint(input),
  cloneRestore: (instance, input, options) => instance.cloneRestore(input, options),
  isolatedReplay: (instance, input, options) => instance.isolatedReplay(input, options),
  migrationCompare: (instance, input) => instance.migrationCompare(input),
  applyCloneRestore: (instance, input) => instance.applyCloneRestore(input)
};

module.exports = Object.freeze(api);
