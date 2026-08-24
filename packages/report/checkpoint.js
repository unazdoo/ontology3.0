"use strict";

const checkpoint = require("../checkpoint");
const { fail } = require("./errors");
const { emptyState, normalizeState, STORE_SCHEMA_VERSION } = require("./store");
const {
  assertObject,
  assertString,
  assertScenarioRun,
  sameScenarioRun,
  immutableJson,
  cloneJson,
  stableSerialize,
  sha256,
  contentId,
  nowIso
} = require("./utils");

const M06_CHECKPOINT_EXPORT_SCHEMA_VERSION = "ofw.m06.c034-export.v1";
const M06_RESTORE_RECEIPT_SCHEMA_VERSION = "ofw.m06.c034-clone-restore-receipt.v1";

function recordScenarioContext(record) {
  return record?.scenarioContext || record?.contentVersion?.scenarioContext || null;
}

function belongsToRun(record, scenarioContext) {
  const context = recordScenarioContext(record);
  if (context) return sameScenarioRun(context, scenarioContext);
  if (record?.scenarioId) return record.scenarioId === scenarioContext.scenarioId;
  return true;
}

function filterStoreState(state, scenarioContext) {
  const normalized = normalizeState(state);
  const collections = {};
  Object.entries(normalized.collections).forEach(([name, records]) => {
    collections[name] = Object.fromEntries(Object.entries(records).filter(([, record]) => belongsToRun(record, scenarioContext)));
  });
  const includedIds = new Set(Object.values(collections).flatMap((records) => Object.keys(records)));
  const pointers = Object.fromEntries(Object.entries(normalized.pointers).map(([namespace, values]) => [
    namespace,
    Object.fromEntries(Object.entries(values).filter(([, pointer]) => {
      if (!pointer || typeof pointer !== "object") return true;
      const refs = Object.values(pointer).filter((value) => typeof value === "string");
      return refs.length === 0 || refs.some((ref) => includedIds.has(ref));
    }))
  ]));
  return { schemaVersion: STORE_SCHEMA_VERSION, revision: normalized.revision, collections, pointers };
}

function exportCounts(moduleState) {
  const names = [
    "reportDefinitions", "reportTemplates", "fixedViews", "dashboardDefinitions", "dashboardVersions",
    "generationRequests", "c022Requests", "evidencePacks", "sourceDrafts", "contentVersions", "anchors",
    "verificationExtractions", "verificationRuns", "comparisons", "comparisonAttempts", "comparisonStaleness", "qualityWarnings", "artifacts"
  ];
  return Object.fromEntries(names.map((name) => [name, Object.keys(moduleState.collections[name] || {}).length]));
}

function exportHash(moduleExport) {
  const { contentHash: _ignored, ...hashable } = moduleExport;
  return sha256(hashable);
}

function createM06Checkpoint(input) {
  assertObject(input, "M06 checkpoint export input");
  const scenarioContext = assertScenarioRun(input.scenarioContext, null);
  const state = typeof input.store?.snapshot === "function" ? input.store.snapshot() : input.state;
  const moduleState = filterStoreState(state, scenarioContext);
  const moduleExport = {
    schemaVersion: M06_CHECKPOINT_EXPORT_SCHEMA_VERSION,
    contractId: "C034",
    moduleId: "M06",
    owner: "报告中心",
    moduleVersion: input.moduleVersion || "packages/report.v1",
    scenarioContext,
    exportedAt: input.exportedAt || nowIso(input.clock),
    state: moduleState,
    recordCounts: exportCounts(moduleState),
    includes: ["report-definitions", "templates", "C018-references", "dashboards", "C022-C023", "T044", "T049", "C027", "HTML-PDF", "quality-warnings"],
    immutable: true
  };
  moduleExport.contentHash = exportHash(moduleExport);
  const checkpointId = input.checkpointId || contentId("CP-M06", { scenarioContext, contentHash: moduleExport.contentHash });
  return immutableJson({
    schemaVersion: checkpoint.CHECKPOINT_SCHEMA_VERSION,
    checkpointId,
    scenarioContext,
    sourceScenarioRunId: scenarioContext.scenarioRunId,
    immutable: true,
    restoreReadiness: { status: "verified", verifiedAt: moduleExport.exportedAt, moduleId: "M06" },
    sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY,
    overwritesHistory: false,
    moduleExport
  });
}

function validateM06Checkpoint(value) {
  const structural = checkpoint.validateCheckpoint(value, { requireSchemaVersion: true });
  const errors = [...structural.errors];
  const moduleExport = value?.moduleExport;
  if (!moduleExport || moduleExport.schemaVersion !== M06_CHECKPOINT_EXPORT_SCHEMA_VERSION) {
    errors.push({ code: "M06_EXPORT_MISSING", path: "moduleExport", message: "M06 module export is required" });
  } else {
    if (moduleExport.moduleId !== "M06") errors.push({ code: "MODULE_ID_MISMATCH", path: "moduleExport.moduleId", message: "moduleId must be M06" });
    if (!sameScenarioRun(moduleExport.scenarioContext, value.scenarioContext)) {
      errors.push({ code: "SCENARIO_CONTEXT_MISMATCH", path: "moduleExport.scenarioContext", message: "module export and checkpoint context must match" });
    }
    try { normalizeState(moduleExport.state); } catch (error) {
      errors.push({ code: "M06_STATE_INVALID", path: "moduleExport.state", message: error.message });
    }
    const expectedHash = exportHash(moduleExport);
    if (moduleExport.contentHash !== expectedHash) {
      errors.push({ code: "M06_EXPORT_HASH_MISMATCH", path: "moduleExport.contentHash", message: "module export content hash does not match" });
    }
  }
  return { ok: errors.length === 0, errors };
}

function createRestoredState(sourceCheckpoint, targetScenarioContext, restoredAt) {
  const validation = validateM06Checkpoint(sourceCheckpoint);
  if (!validation.ok) fail("INVALID_M06_CHECKPOINT", "M06 checkpoint validation failed", validation.errors);
  const state = normalizeState(cloneJson(sourceCheckpoint.moduleExport.state, "M06 checkpoint state"));
  const receipt = {
    schemaVersion: M06_RESTORE_RECEIPT_SCHEMA_VERSION,
    restoreReceiptId: contentId("M06RESTORE", { checkpointId: sourceCheckpoint.checkpointId, targetScenarioContext }),
    sourceCheckpointId: sourceCheckpoint.checkpointId,
    sourceScenarioRunId: sourceCheckpoint.scenarioContext.scenarioRunId,
    targetScenarioRunId: targetScenarioContext.scenarioRunId,
    scenarioContext: targetScenarioContext,
    restoredAt,
    mode: "isolated-clone",
    historicalReadOnly: true,
    historicalExportHash: sourceCheckpoint.moduleExport.contentHash,
    historicalView: sourceCheckpoint.moduleExport,
    automaticPublication: false,
    automaticRecalculation: false,
    automaticComparison: false,
    historicalSideEffectsReplayed: false,
    immutable: true
  };
  state.collections.checkpointReceipts[receipt.restoreReceiptId] = receipt;
  state.revision = state.revision + 1;
  return { state: immutableJson(state), receipt: immutableJson(receipt) };
}

function compareM06CheckpointExports(left, right) {
  const leftValidation = validateM06Checkpoint(left);
  const rightValidation = validateM06Checkpoint(right);
  if (!leftValidation.ok || !rightValidation.ok) {
    fail("INVALID_M06_CHECKPOINT", "both checkpoints must validate before comparison", { left: leftValidation.errors, right: rightValidation.errors });
  }
  const names = Object.keys(left.moduleExport.state.collections);
  return immutableJson({
    sourceCheckpointId: left.checkpointId,
    targetCheckpointId: right.checkpointId,
    sourceHash: left.moduleExport.contentHash,
    targetHash: right.moduleExport.contentHash,
    identical: left.moduleExport.contentHash === right.moduleExport.contentHash,
    collectionDeltas: Object.fromEntries(names.map((name) => [name,
      Object.keys(right.moduleExport.state.collections[name] || {}).length - Object.keys(left.moduleExport.state.collections[name] || {}).length
    ])),
    mutatesSource: false
  });
}

function createM06CheckpointProvider(options) {
  assertObject(options, "M06 checkpoint provider options");
  const implementation = {
    export(request) {
      return createM06Checkpoint({
        store: options.store,
        scenarioContext: request.scenarioContext,
        checkpointId: request.checkpointId,
        moduleVersion: options.moduleVersion,
        clock: options.clock,
        exportedAt: request.exportedAt
      });
    },
    validate(value) {
      return validateM06Checkpoint(value);
    },
    cloneRestore(request) {
      const restoredAt = request.scenarioContext.formedAt || nowIso(options.clock);
      const restored = createRestoredState(request.checkpoint, request.scenarioContext, restoredAt);
      return {
        moduleId: "M06",
        restoreReceipt: restored.receipt,
        restoredState: restored.state,
        historicalReadOnly: true,
        automaticPublication: false,
        automaticRecalculation: false,
        automaticComparison: false
      };
    },
    isolatedReplay(request) {
      const restored = createRestoredState(request.checkpoint, request.scenarioContext, request.scenarioContext.formedAt || nowIso(options.clock));
      return {
        moduleId: "M06",
        regressionState: restored.state,
        historicalReadOnly: true,
        externalCapabilitiesDisabled: true,
        automaticPublication: false,
        automaticRecalculation: false
      };
    },
    migrationCompare(request) {
      return {
        moduleId: "M06",
        compatible: request.comparison.compatible,
        sourceStateHash: options.store ? sha256(options.store.snapshot()) : null,
        mutatesSource: false
      };
    }
  };
  return checkpoint.createProvider(implementation, { requireAllMethods: true, requireSchemaVersion: true });
}

module.exports = Object.freeze({
  M06_CHECKPOINT_EXPORT_SCHEMA_VERSION,
  M06_RESTORE_RECEIPT_SCHEMA_VERSION,
  createM06Checkpoint,
  validateM06Checkpoint,
  createRestoredState,
  compareM06CheckpointExports,
  createM06CheckpointProvider
});
