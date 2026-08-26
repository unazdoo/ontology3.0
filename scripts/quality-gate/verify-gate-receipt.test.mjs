import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = path.join(path.dirname(new URL(import.meta.url).pathname), "verify-gate-receipt.mjs");

test("gate receipt adapter maps kebab-case CI names and rejects placeholders", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gate-receipt-"));
  try {
    const manifest = path.join(directory, "manifest.json");
    const report = path.join(directory, "report.json");
    fs.writeFileSync(manifest, JSON.stringify({ checks: { e2e: {
      status: "verified", evidence: "artifact://e2e-run.json", scenarioId: "S001", runtimeRunId: "S001-RUN-20260824-1",
      c033Verified: true, ownerBoundaryVerified: true, exactVersionsVerified: true,
      idempotency: {
        sameKeySameContentOnce: true, sameKeyDifferentContentRejected: true, casConflictRejected: true,
        outboxDuplicateSuppressed: true, inboxDuplicateSuppressed: true, retryNoDuplicateSideEffects: true
      }
    } } }), "utf8");
    const success = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "e2e", "--report", report], { encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    assert.equal(JSON.parse(fs.readFileSync(report, "utf8")).valid, true);

    fs.writeFileSync(manifest, JSON.stringify({ checks: { e2e: { status: "passed", evidence: "fixture://example" } } }), "utf8");
    const failure = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "e2e"], { encoding: "utf8" });
    assert.notEqual(failure.status, 0);
    assert.match(`${failure.stdout}\n${failure.stderr}`, /placeholder|fixture/i);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("diagnostic checks accept explicit blocked/deferred dispositions while hard gates do not", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gate-diagnostic-"));
  try {
    const manifest = path.join(directory, "manifest.json");
    fs.writeFileSync(manifest, JSON.stringify({ checks: { performance: { status: "blocked", reason: "non-representative environment", evidence: "artifact://performance-blocked.json" } } }), "utf8");
    const diagnostic = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "performance"], { encoding: "utf8" });
    assert.equal(diagnostic.status, 0, diagnostic.stderr);

    fs.writeFileSync(manifest, JSON.stringify({ checks: { accessibility: {
      status: "not-applicable", reason: "backend-only slice", evidence: "artifact://accessibility-deferred.json",
      scope: "backend-only", uiChangesDetected: false, nextGate: "first-ui-candidate",
      findingEvidence: { path: "artifacts/axe-blocked.json" }
    } } }), "utf8");
    const deferred = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "accessibility"], { encoding: "utf8" });
    assert.equal(deferred.status, 0, deferred.stderr);

    fs.writeFileSync(manifest, JSON.stringify({ checks: { e2e: { status: "blocked", reason: "not ready", evidence: "artifact://e2e-blocked.json" } } }), "utf8");
    const hard = spawnSync(process.execPath, [script, "--manifest", manifest, "--gate", "e2e"], { encoding: "utf8" });
    assert.notEqual(hard.status, 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
