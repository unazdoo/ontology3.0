'use strict';

// Runtime-shaped entry point for parity with the other module services. The
// implementation remains the single OntologyService/Repository authority.
const api = require('./index');

module.exports = Object.freeze({
  OntologyService: api.OntologyService,
  OntologyRuntime: api.OntologyService,
  M01OntologyRuntime: api.OntologyService,
  OntologyRuntimeError: api.OntologyError,
  OntologyError: api.OntologyError,
  ERROR_CODES: Object.freeze({
    INVALID_SCENARIO_CONTEXT: 'INVALID_SCENARIO_CONTEXT',
    SCENARIO_CONTEXT_MISMATCH: 'SCENARIO_CONTEXT_MISMATCH',
    SCENARIO_RUN_MISMATCH: 'SCENARIO_RUN_MISMATCH',
    C003_INVALID: 'C003_INVALID',
    C003_IDEMPOTENCY_CONFLICT: 'C003_IDEMPOTENCY_CONFLICT',
    C032_DRIFT: 'C032_DRIFT',
    C028_INVALID: 'C028_INVALID',
    C029_INVALID: 'C029_INVALID',
    T018_NOT_ELIGIBLE: 'T018_NOT_ELIGIBLE',
    T019_GATE_FAILED: 'T019_GATE_FAILED',
    T019_REVISION_CONFLICT: 'T019_REVISION_CONFLICT',
    NO_PREVIOUS_TRUSTED: 'NO_PREVIOUS_TRUSTED',
    PROJECTION_DUAL_SOURCE: 'PROJECTION_DUAL_SOURCE',
    PROJECTION_CORRUPT: 'PROJECTION_CORRUPT'
  }),
  createOntologyService: api.createOntologyService,
  createRuntime: api.createOntologyService,
  createM01CheckpointProvider: api.createM01CheckpointProvider
});
