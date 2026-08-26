"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

let gate;
let fixture;
let fixtureRoot;

function validManifest() {
  return JSON.parse(JSON.stringify(fixture.manifest));
}

test.before(async () => {
  gate = await import("./lib/quality-gate.mjs");
  const support = await import("./test-support/receipt-bundle.mjs");
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quality-lib-cjs-"));
  fixture = support.generateEvidence(fixtureRoot);
  assert.equal(fixture.result.status, 0, fixture.result.stderr);
});

test.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

test("accepts a complete PR evidence manifest and computes candidate eligibility", () => {
  const result = gate.validatePrEvidence(validManifest(), { pullRequestNumber: 42, headSha: "a".repeat(40), receiptRoot: fixtureRoot, manifestPath: fixture.output });
  assert.equal(result.valid, true, gate.formatValidationErrors(result.errors));
  assert.equal(result.candidateEligible, true);
});

test("fails closed for baseline, real-run and audit omissions", () => {
  const manifest = validManifest();
  delete manifest.baselineSnapshotId;
  manifest.runtimeRunIsReal = false;
  delete manifest.audit.idempotencyKey;
  const result = gate.validatePrEvidence(manifest, { receiptRoot: fixtureRoot });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "BASELINE_SNAPSHOT_MISSING"));
  assert.ok(result.errors.some((item) => item.code === "RUNTIME_RUN_NOT_REAL"));
  assert.ok(result.errors.some((item) => item.code === "AUDIT_FIELD_MISSING"));
});

test("rejects a shared or non-derived PR environment", () => {
  const manifest = validManifest();
  manifest.prEnvironment = { ...manifest.prEnvironment, id: "pr-42-aaaaaaaaaaaa", databaseSchema: "shared", objectStoragePrefix: "pr/42/aaaaaaaaaaaa/" };
  const result = gate.validatePrEvidence(manifest, { receiptRoot: fixtureRoot });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "PR_ENVIRONMENT_NOT_ISOLATED"));
  assert.ok(result.errors.some((item) => item.code === "PR_ENVIRONMENT_NOT_DERIVED"));
});

test("candidate remains blocked when one required check or candidate gate is pending", () => {
  const manifest = validManifest();
  manifest.checks.security.status = "pending";
  manifest.candidateGates.recovery.status = "blocked";
  const result = gate.validatePrEvidence(manifest, { receiptRoot: fixtureRoot });
  assert.equal(result.candidateEligible, false);
  assert.equal(result.valid, false);
});

test("builds and validates deterministic isolated namespaces", () => {
  const value = gate.buildPrEnvironment(7, "c".repeat(40));
  assert.equal(value.id, "pr-7-cccccccccccc");
  assert.equal(gate.validatePrEnvironment(value, { pullRequestNumber: 7, headSha: "c".repeat(40) }).valid, true);
});
