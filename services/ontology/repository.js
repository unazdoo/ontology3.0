'use strict';

const {
  assertScenarioContext,
  assertSameContext,
  cloneJson,
  contextKey,
  fail,
  immutable,
  isRecord
} = require('./domain');

function emptyState(scenarioContext, projectionId) {
  return {
    stateSchemaVersion: 'ofw.m01.state.v1',
    scenarioContext: cloneJson(scenarioContext),
    revision: 0,
    counters: {
      draft: 0,
      published: 0,
      discovery: 0,
      result: 0,
      qualification: 0,
      projection: 0,
      checkpoint: 0,
      audit: 0
    },
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
    t019: {
      revision: 0,
      current: null,
      previousTrusted: null,
      trustedHistory: [],
      invalidatedCombinationIds: [],
      transition: 'empty',
      transitionReason: null,
      lastCandidateValidation: null,
      pendingCandidateValidation: null,
      history: []
    },
    projectionId,
    c008: null,
    audit: [],
    restoredFrom: null,
    importedHistory: null
  };
}

class MemoryOntologyRepository {
  constructor(options = {}) {
    this._states = new Map();
    this._locks = new Set();
    this._projectionPrefix = options.projectionPrefix || 'M01:C008';
  }

  hasScenario(scenarioContext) {
    const context = assertScenarioContext(scenarioContext);
    return this._states.has(contextKey(context));
  }

  registerScenario(scenarioContext) {
    const context = assertScenarioContext(scenarioContext);
    const key = contextKey(context);
    const existing = this._states.get(key);
    if (existing) {
      assertSameContext(existing.scenarioContext, context);
      return immutable(existing, 'ontology state');
    }
    const projectionId = `${this._projectionPrefix}:${context.scenarioId}:${context.scenarioRunId}`;
    const state = emptyState(context, projectionId);
    this._states.set(key, state);
    return immutable(state, 'ontology state');
  }

  read(scenarioContext) {
    const context = assertScenarioContext(scenarioContext);
    const state = this._states.get(contextKey(context));
    if (!state) fail('SCENARIO_CONTEXT_UNKNOWN', 'the C033 scenario run is not registered in M01', { scenarioContext: context });
    assertSameContext(state.scenarioContext, context, { allowReadOnlyLifecycle: true });
    return immutable(state, 'ontology state');
  }

  transaction(scenarioContext, options, mutator) {
    const config = isRecord(options) ? options : {};
    const context = assertScenarioContext(scenarioContext, { write: config.readOnly !== true });
    const key = contextKey(context);
    const current = this._states.get(key);
    if (!current) fail('SCENARIO_CONTEXT_UNKNOWN', 'the C033 scenario run is not registered in M01', { scenarioContext: context });
    assertSameContext(current.scenarioContext, context, { write: config.readOnly !== true, allowReadOnlyLifecycle: config.readOnly === true });
    if (this._locks.has(key)) fail('CONCURRENT_TRANSACTION', 'a write is already in progress for this scenario run');
    if (config.expectedRevision !== undefined && config.expectedRevision !== current.revision) {
      fail('REVISION_CONFLICT', 'M01 state changed before the write could commit', {
        expectedRevision: config.expectedRevision,
        actualRevision: current.revision
      });
    }
    if (config.readOnly === true) {
      const working = cloneJson(current, 'read-only ontology state');
      const result = mutator(working);
      return immutable({ result, state: current }, 'read-only ontology transaction result');
    }
    this._locks.add(key);
    try {
      const working = cloneJson(current, 'ontology transaction state');
      const result = mutator(working);
      const changed = JSON.stringify(working) !== JSON.stringify(current);
      if (changed) {
        working.revision = current.revision + 1;
        this._states.set(key, working);
      }
      return immutable({ result, state: changed ? working : current }, 'ontology transaction result');
    } finally {
      this._locks.delete(key);
    }
  }

  importState(scenarioContext, state, options = {}) {
    const context = assertScenarioContext(scenarioContext, { write: true });
    if (!isRecord(state)) fail('INVALID_RESTORE_STATE', 'restored M01 state must be an object');
    const key = contextKey(context);
    if (this._states.has(key)) {
      const existing = this._states.get(key);
      const occupied = existing.revision > 0
        || existing.draftOrder.length > 0
        || existing.publishedOrder.length > 0
        || existing.deliveryOrder.length > 0
        || existing.refreshRequestOrder.length > 0
        || existing.refreshResultOrder.length > 0
        || existing.t019?.current;
      if (!options.replaceEmpty || occupied) {
        fail('RESTORE_TARGET_EXISTS', 'clone restore requires an empty, isolated scenario run', { scenarioContext: context });
      }
    }
    const copy = cloneJson(state, 'restored M01 state');
    copy.scenarioContext = cloneJson(context);
    copy.revision = Number(copy.revision || 0);
    this._states.set(key, copy);
    return immutable(copy, 'restored M01 state');
  }

  replace(scenarioContext, state) {
    return this.importState(scenarioContext, state, { replaceEmpty: true });
  }

  listScenarioContexts() {
    return immutable(Array.from(this._states.values()).map((state) => state.scenarioContext), 'scenario contexts');
  }
}

module.exports = Object.freeze({
  MemoryOntologyRepository,
  emptyState
});
