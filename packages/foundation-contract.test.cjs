"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const contracts = require("./contracts");
const identity = require("./identity");
const checkpoint = require("./checkpoint");

function context() {
  return {
    scenarioId: "S001",
    scenarioVersion: "S001-v1",
    scenarioRunId: "S001-RUN-202608240001",
    formedAt: "2026-08-24T00:00:00.000Z",
    status: "active"
  };
}

function request() {
  const value = {
    schemaVersion: "foundation.test.v1",
    eventType: "foundation.test.request",
    operation: "contract-test",
    scenarioContext: context(),
    resourceRefs: [],
    evidenceRefs: [],
    payload: { value: 1 }
  };
  return { ...value, idempotencyKey: identity.generateIdempotencyKey(value) };
}

function checkpointValue() {
  return {
    schemaVersion: checkpoint.CHECKPOINT_SCHEMA_VERSION,
    checkpointId: "CP-S001-001",
    immutable: true,
    scenarioContext: context(),
    sourceScenarioRunId: context().scenarioRunId,
    restoreReadiness: { status: "verified" },
    actionRequests: [{ id: "AR-1" }],
    notifications: [{ id: "N-1" }],
    approvals: [{ id: "AP-1" }],
    todos: [{ id: "TODO-1" }]
  };
}

test("all public envelope fields validate through the draft contract", () => {
  const value = request();
  const envelope = {
    eventId: "evt-1",
    eventType: value.eventType,
    schemaVersion: value.schemaVersion,
    occurredAt: "2026-08-24T00:00:01.000Z",
    actorRef: "actor-1",
    correlationId: "corr-1",
    traceId: "trace-1",
    idempotencyKey: value.idempotencyKey,
    scenarioContext: value.scenarioContext,
    resourceRefs: value.resourceRefs,
    evidenceRefs: value.evidenceRefs,
    payload: value.payload
  };
  assert.equal(contracts.validateContractEnvelope(envelope).valid, true);
  assert.equal(contracts.validateContractEnvelope({ ...envelope, actorRef: undefined }).valid, false);
});

test("C033 rejects every missing required context field", () => {
  for (const field of ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]) {
    const value = context();
    delete value[field];
    assert.equal(identity.validateScenarioContext(value).valid, false, field);
    assert.equal(contracts.validateScenarioContext(value).valid, false, field);
  }
});

test("C033 strict validation rejects an undeclared context field", () => {
  const value = { ...context(), undeclared: true };
  assert.equal(identity.validateScenarioContext(value).valid, false);
  assert.equal(contracts.validateScenarioContext(value, { allowUnknown: false }).valid, false);
});

test("idempotency verification and duplicate detection remain side-effect free", () => {
  const first = request();
  assert.equal(identity.verifyIdempotencyKey(first.idempotencyKey, first).valid, true);
  const seen = new Map([[first.idempotencyKey, first]]);
  const before = JSON.stringify([...seen]);
  const duplicate = identity.identifyDuplicateRequest({ ...first, traceId: "a-new-trace" }, seen);
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.sideEffectAllowed, false);
  assert.equal(JSON.stringify([...seen]), before);
  assert.equal(identity.verifyIdempotencyKey("idem-v1:" + "0".repeat(64), first).valid, false);
});

test("trace and correlation context can be forwarded without changing the source", () => {
  const source = { traceId: "trace-1", correlationId: "corr-1" };
  const target = identity.propagateTraceContext(source, { payload: { ok: true } });
  assert.deepEqual(target, { payload: { ok: true }, traceId: "trace-1", correlationId: "corr-1" });
  assert.deepEqual(source, { traceId: "trace-1", correlationId: "corr-1" });
});

test("audit fields stay a pure, minimum metadata structure", () => {
  const fields = contracts.createAuditFields({
    actorRef: "actor-1",
    traceId: "trace-1",
    correlationId: "corr-1",
    scenarioContext: context(),
    sourceVersion: "v1.1.0",
    targetVersion: "implementation-0.1.0",
    formedAt: "2026-08-24T00:00:01.000Z",
    operation: "checkpoint.cloneRestore",
    outcome: "prepared"
  });
  assert.deepEqual(Object.keys(fields).sort(), contracts.AUDIT_FIELDS.slice().sort());
});

test("checkpoint recovery creates a new run and strips historical side effects", () => {
  const source = checkpointValue();
  const restored = checkpoint.cloneRestore(source, {
    runIdFactory: (scenarioId, details) => `${scenarioId}-RUN-${details.operation}-new`,
    now: "2026-08-24T01:00:00.000Z"
  });
  assert.notEqual(restored.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(restored.overwritesSource, false);
  assert.equal(restored.replayHistoricalSideEffects, false);
  assert.deepEqual(restored.replayedSideEffects, []);
  assert.equal("actionRequests" in restored.restoreInput, false);
  assert.equal("notifications" in restored.restoreInput, false);
  assert.equal("approvals" in restored.restoreInput, false);
  assert.equal("todos" in restored.restoreInput, false);
  assert.equal(source.actionRequests.length, 1);
});

test("illegal migration is rejected before any target is produced", () => {
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
      scenarioVersion: "S002-v2",
      baselineVersion: "1.2.0",
      baselineSnapshotId: "BSL-OFW-V120-NEW",
      scenarioRunId: "S001-RUN-target"
    }),
    (error) => error.code === "SCENARIO_VERSION_MISMATCH"
  );
});
