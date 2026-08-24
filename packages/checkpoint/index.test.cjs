"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const checkpoint = require("./index.js");

function context(runId, version) {
  return {
    scenarioId: "S001",
    scenarioVersion: version || "S001-v1",
    scenarioRunId: runId || "S001-RUN-source",
    formedAt: "2026-08-24T00:00:00.000Z",
    status: "active"
  };
}

function manifest(overrides) {
  return {
    schemaVersion: checkpoint.CHECKPOINT_SCHEMA_VERSION,
    checkpointId: "CP-S001-001",
    immutable: true,
    scenarioContext: context(),
    sourceScenarioRunId: "S001-RUN-source",
    restoreReadiness: { status: "verified" },
    ...overrides
  };
}

function fixedRunId(scenarioId, details) {
  return `${scenarioId}-RUN-${details.operation}-new`;
}

test("validates a minimal immutable checkpoint and rejects context mismatch", () => {
  assert.equal(checkpoint.validateCheckpoint(manifest()).ok, true);
  const mismatch = manifest({ sourceScenarioRunId: "S001-RUN-other" });
  assert.equal(checkpoint.validateCheckpoint(mismatch).ok, false);
});

test("checkpoint C033 validation rejects missing formedAt and status", () => {
  const withoutFormedAt = manifest({ scenarioContext: { ...context() } });
  delete withoutFormedAt.scenarioContext.formedAt;
  assert.equal(checkpoint.validateCheckpoint(withoutFormedAt).ok, false);
  const withoutStatus = manifest({ scenarioContext: { ...context() } });
  delete withoutStatus.scenarioContext.status;
  assert.equal(checkpoint.validateCheckpoint(withoutStatus).ok, false);
});

test("checkpoint C033 validation rejects unknown context fields by default", () => {
  const value = manifest({ scenarioContext: { ...context(), undeclared: true } });
  assert.equal(checkpoint.validateCheckpoint(value).ok, false);
  assert.equal(checkpoint.validateCheckpoint(value, { contextOptions: { allowUnknown: true } }).ok, true);
});

test("cloneRestore creates a new run and leaves the source immutable", () => {
  const source = manifest({
    actionRequests: [{ id: "AR-1" }],
    notifications: [{ id: "N-1" }],
    approvals: [{ id: "A-1" }],
    todos: [{ id: "T-1" }]
  });
  const restored = checkpoint.cloneRestore(source, {
    runIdFactory: fixedRunId,
    now: "2026-08-24T01:00:00.000Z"
  });
  assert.notEqual(restored.scenarioContext.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(restored.overwritesHistory, false);
  assert.equal(restored.overwritesSource, false);
  assert.equal(restored.replayHistoricalSideEffects, false);
  assert.deepEqual(restored.replayedSideEffects, []);
  assert.deepEqual(restored.sideEffectPolicy, checkpoint.SIDE_EFFECT_POLICY);
  assert.equal("actionRequests" in restored.restoreInput, false);
  assert.equal("notifications" in restored.restoreInput, false);
  assert.equal("approvals" in restored.restoreInput, false);
  assert.equal("todos" in restored.restoreInput, false);
  assert.equal(source.actionRequests.length, 1);
  assert.equal(restored.scenarioContext.status, "restored");
});

test("isolatedReplay blocks all historical side effects through its guard", () => {
  const replay = checkpoint.isolatedReplay(manifest(), {
    runIdFactory: fixedRunId,
    now: "2026-08-24T02:00:00.000Z"
  });
  assert.equal(replay.mode, "isolated-replay");
  assert.equal(replay.externalCapabilitiesDefault, "disabled");
  assert.notEqual(replay.targetScenarioRunId, "S001-RUN-source");
  assert.throws(() => replay.guard.sendNotification({}), (error) => error.code === "HISTORICAL_SIDE_EFFECT_REPLAY");
  assert.throws(() => replay.guard.createActionRequest({}), (error) => error.code === "HISTORICAL_SIDE_EFFECT_REPLAY");
  assert.throws(() => replay.guard.createApproval({}), (error) => error.code === "HISTORICAL_SIDE_EFFECT_REPLAY");
  assert.throws(() => replay.guard.createTodo({}), (error) => error.code === "HISTORICAL_SIDE_EFFECT_REPLAY");
});

test("unverified checkpoints cannot be restored", () => {
  assert.throws(
    () => checkpoint.cloneRestore(manifest({ restoreReadiness: { status: "not-verified" } })),
    (error) => error.code === "CHECKPOINT_NOT_RESTORABLE"
  );
});

test("migrationCompare rejects unchanged, in-place, cross-scenario and downgrade migrations", () => {
  const source = {
    scenarioId: "S001",
    scenarioVersion: "S001-v1",
    scenarioRunId: "S001-RUN-source",
    baselineVersion: "1.1.0",
    baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7"
  };
  assert.throws(
    () => checkpoint.migrationCompare(source, {
      ...source,
      scenarioVersion: "S001-v2",
      scenarioRunId: "S001-RUN-target"
    }),
    (error) => error.code === "UNCHANGED_BASELINE"
  );
  assert.throws(
    () => checkpoint.migrationCompare(source, {
      ...source,
      baselineVersion: "1.2.0",
      baselineSnapshotId: "BSL-OFW-V120-NEW",
      scenarioRunId: "S001-RUN-target"
    }),
    (error) => error.code === "IN_PLACE_SCENARIO_VERSION_MIGRATION"
  );
  assert.throws(
    () => checkpoint.migrationCompare(source, {
      ...source,
      scenarioId: "S002",
      scenarioVersion: "S002-v2",
      baselineVersion: "1.2.0",
      baselineSnapshotId: "BSL-OFW-V120-NEW"
    }),
    (error) => error.code === "SCENARIO_ID_MISMATCH"
  );
  assert.throws(
    () => checkpoint.migrationCompare(source, {
      ...source,
      scenarioVersion: "S001-v2",
      baselineVersion: "1.0.0",
      baselineSnapshotId: "BSL-OFW-V100-OLD",
      scenarioRunId: "S001-RUN-target"
    }),
    (error) => error.code === "MIGRATION_VERSION_REGRESSION"
  );
});

test("provider SPI delegates export/validate and protects clone restore output", async () => {
  let cloneRequest;
  const provider = checkpoint.createProvider({
    export: () => manifest(),
    validate: () => ({ ok: true, errors: [] }),
    cloneRestore: (request) => {
      cloneRequest = request;
      return { restoredRefs: ["M01"] };
    },
    isolatedReplay: () => ({ replayedSideEffects: [] }),
    migrationCompare: () => ({ compared: true })
  });
  checkpoint.assertProvider(provider);
  const exported = await provider.export({ scenarioContext: context() });
  assert.equal(exported.checkpointId, "CP-S001-001");
  assert.equal((await provider.validate(exported)).ok, true);
  const restored = await provider.cloneRestore(manifest(), { runIdFactory: fixedRunId });
  assert.equal(restored.restoredRefs[0], "M01");
  assert.equal(cloneRequest.allowHistoricalReplay, false);
  assert.equal(cloneRequest.allowExternalDispatch, false);
  assert.equal(restored.overwritesHistory, false);
});

test("provider rejects adapter attempts to replay historical side effects", () => {
  const provider = checkpoint.createProvider({
    cloneRestore: () => ({ replayedNotifications: [{ id: "N-1" }] })
  });
  assert.throws(
    () => provider.cloneRestore(manifest(), { runIdFactory: fixedRunId }),
    (error) => error.code === "HISTORICAL_SIDE_EFFECT_REPLAY"
  );
});

test("provider request input cannot smuggle historical side-effect collections", () => {
  let received;
  const provider = checkpoint.createProvider({
    cloneRestore: (request) => {
      received = request;
      return { restoredRefs: [] };
    }
  });
  provider.cloneRestore({
    checkpoint: manifest(),
    actionRequests: [{ id: "AR-1" }],
    notifications: [{ id: "N-1" }],
    approvals: [{ id: "AP-1" }],
    todos: [{ id: "TODO-1" }]
  }, { runIdFactory: fixedRunId });
  assert.equal("actionRequests" in received, false);
  assert.equal("notifications" in received, false);
  assert.equal("approvals" in received, false);
  assert.equal("todos" in received, false);
});

test("provider accepts the common { valid, errors } validation shape", async () => {
  const provider = checkpoint.createProvider({
    export: () => manifest(),
    validate: () => ({ valid: true, errors: [] })
  });
  assert.equal((await provider.validate(manifest())).ok, true);
});
