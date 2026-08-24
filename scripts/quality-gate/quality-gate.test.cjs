"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

let gate;
let environment;

function validManifest() {
  environment = { ...gate.buildPrEnvironment(42, "a".repeat(40)), provisioningReceipt: "artifact://pr-environment-provisioned.json" };
  const checks = Object.fromEntries(gate.REQUIRED_CHECKS.map((id) => [id, { status: "passed", evidence: `artifacts/${id}.json` }]));
  const candidateGates = {
    s001VerticalSlice: {
      status: "passed", evidence: "artifacts/s001-e2e.json", scenarioId: "S001",
      order: ["M02", "M01", "M03", "M04", "M06", "M05", "M06"],
      realRunId: "S001-RUN-20260824-abc123", roundId: "round-001"
    },
    security: { status: "passed", evidence: "artifacts/security.json", roundId: "round-001" },
    recovery: { status: "passed", evidence: "artifacts/recovery.json", roundId: "round-001" }
  };
  return {
    manifestVersion: "implementation-quality-evidence.v1",
    gateVersion: gate.QUALITY_GATE_VERSION,
    baselineSnapshotId: gate.DEFAULT_BASELINE_SNAPSHOT_ID,
    sourceTag: "prototype-v1.1.0-frozen",
    sourceVersion: "v1.1.0",
    implementationVersion: "implementation-0.1.0",
    schemaVersion: "draft-0.1.0",
    schemaVersions: { api: "draft-0.1.0", event: "draft-0.1.0", db: "draft-0.1.0" },
    schemaCompatibility: { status: "exact" },
    owner: { team: "Implementation Quality", name: "owner@example.invalid" },
    providers: ["foundation"],
    consumers: ["s001"],
    pullRequest: { number: 42, headSha: "a".repeat(40) },
    databaseMigration: { status: "verified", up: "none", down: "none", evidence: "artifacts/migration.json" },
    objectStorageFingerprint: { status: "verified", algorithm: "sha256", value: "b".repeat(64), prefix: environment.objectStoragePrefix, evidence: "artifacts/object-manifest.json" },
    rollback: { status: "verified", targetVersion: "1.0.3", evidence: "artifacts/rollback.json" },
    runtimeRunId: "S001-RUN-20260824-abc123",
    runtimeRunIsReal: true,
    audit: {
      actorRef: "actor:quality-owner", traceId: "trace-001", correlationId: "corr-001",
      idempotencyKey: "idem-001", formedAt: "2026-08-24T00:00:00.000Z",
      appendOnly: true,
      scenarioContext: { scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-20260824-abc123", formedAt: "2026-08-24T00:00:00.000Z", status: "active" },
      evidence: "artifacts/audit.json"
    },
    negativeTests: { status: "verified", cases: ["missing-context", "unknown-schema", "unauthorized-owner", "cross-scenario", "duplicate-idempotency", "recovery-side-effect"], evidence: "artifacts/negative.json" },
    recoveryReceipt: {
      status: "verified", sourceScenarioRunId: "S001-RUN-source-001", restoredScenarioRunId: "S001-RUN-restored-001",
      sideEffectsSuppressed: true, overwritesSource: false, evidence: "artifacts/c034-recovery.json"
    },
    prEnvironment: environment,
    checks,
    candidateGates,
    implementationCandidate: false
  };
}

test.before(async () => { gate = await import("./lib/quality-gate.mjs"); });

test("accepts a complete PR evidence manifest and computes candidate eligibility", () => {
  const result = gate.validatePrEvidence(validManifest(), { pullRequestNumber: 42, headSha: "a".repeat(40) });
  assert.equal(result.valid, true, gate.formatValidationErrors(result.errors));
  assert.equal(result.candidateEligible, true);
});

test("fails closed for baseline, real-run and audit omissions", () => {
  const manifest = validManifest();
  delete manifest.baselineSnapshotId;
  manifest.runtimeRunIsReal = false;
  delete manifest.audit.idempotencyKey;
  const result = gate.validatePrEvidence(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "BASELINE_SNAPSHOT_MISSING"));
  assert.ok(result.errors.some((item) => item.code === "RUNTIME_RUN_NOT_REAL"));
  assert.ok(result.errors.some((item) => item.code === "AUDIT_FIELD_MISSING"));
});

test("rejects a shared or non-derived PR environment", () => {
  const manifest = validManifest();
  manifest.prEnvironment = { ...manifest.prEnvironment, id: "pr-42-aaaaaaaaaaaa", databaseSchema: "shared", objectStoragePrefix: "pr/42/aaaaaaaaaaaa/" };
  const result = gate.validatePrEvidence(manifest);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "PR_ENVIRONMENT_NOT_ISOLATED"));
  assert.ok(result.errors.some((item) => item.code === "PR_ENVIRONMENT_NOT_DERIVED"));
});

test("candidate remains blocked when one required check or candidate gate is pending", () => {
  const manifest = validManifest();
  manifest.checks.security.status = "pending";
  manifest.candidateGates.recovery.status = "blocked";
  const result = gate.validatePrEvidence(manifest);
  assert.equal(result.candidateEligible, false);
  assert.equal(result.valid, false);
});

test("builds and validates deterministic isolated namespaces", () => {
  const value = gate.buildPrEnvironment(7, "c".repeat(40));
  assert.equal(value.id, "pr-7-cccccccccccc");
  assert.equal(gate.validatePrEnvironment(value, { pullRequestNumber: 7, headSha: "c".repeat(40) }).valid, true);
});
