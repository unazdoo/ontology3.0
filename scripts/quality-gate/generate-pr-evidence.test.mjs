import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { generateEvidence, TEST_BINDING } from "./test-support/receipt-bundle.mjs";

const verify = path.resolve(path.dirname(new URL(import.meta.url).pathname), "verify-pr-evidence.mjs");

function temporary() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "quality-receipts-"));
}

test("generator aggregates one CI round and verifier reopens every digest-bound receipt", () => {
  const root = temporary();
  try {
    const generated = generateEvidence(root);
    assert.equal(generated.result.status, 0, generated.result.stderr);
    assert.equal(generated.manifest.manifestVersion, "implementation-quality-evidence.v2");
    assert.equal(generated.manifest.implementationRoundId, TEST_BINDING.implementationRoundId);
    assert.equal(generated.manifest.runtimeRunId, generated.runtimeRunId);
    assert.equal(generated.manifest.receipts.provisioning.environmentId, generated.environment.id);
    assert.match(generated.manifest.receipts.runtime.sha256, /^[a-f0-9]{64}$/);

    const report = path.join(root, "artifacts/verification.json");
    const result = spawnSync(process.execPath, [
      verify,
      "--manifest", generated.output,
      "--receipt-root", root,
      "--pr-number", String(TEST_BINDING.pullRequestNumber),
      "--head-sha", TEST_BINDING.headSha,
      "--report", report
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const verification = JSON.parse(fs.readFileSync(report, "utf8"));
    assert.equal(verification.valid, true);
    assert.equal(verification.receiptVerification.valid, true);
    assert.equal(verification.receiptVerification.verifiedCount, 22);
    assert.match(verification.manifestSha256, /^[a-f0-9]{64}$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("verifier rejects a receipt changed after manifest generation", () => {
  const root = temporary();
  try {
    const generated = generateEvidence(root);
    assert.equal(generated.result.status, 0, generated.result.stderr);
    const auditPath = path.join(root, generated.manifest.receipts.audit.path);
    const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
    fs.writeFileSync(auditPath, `${JSON.stringify({ ...audit, appendOnly: false })}\n`, "utf8");
    const result = spawnSync(process.execPath, [verify, "--manifest", generated.output, "--receipt-root", root], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /RECEIPT_DIGEST_MISMATCH|do not match/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("verifier rejects a manifest whose source receipt is missing", () => {
  const root = temporary();
  try {
    const generated = generateEvidence(root);
    assert.equal(generated.result.status, 0, generated.result.stderr);
    fs.rmSync(path.join(root, generated.manifest.receipts.recovery.path));
    const result = spawnSync(process.execPath, [verify, "--manifest", generated.output, "--receipt-root", root], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /RECEIPT_READ_FAILED|unable to read/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("generator rejects descriptor-only and fixture object-storage evidence", () => {
  for (const mutate of [
    (receipts) => { receipts.provisioning.provisioningMode = "descriptor-only-provider-hook-required"; },
    (receipts) => { receipts.objectStorageFingerprint.productionEvidence = false; receipts.objectStorageFingerprint.sourceType = "fixture-shape-only"; }
  ]) {
    const root = temporary();
    try {
      const generated = generateEvidence(root, { mutate });
      assert.notEqual(generated.result.status, 0);
      assert.match(`${generated.result.stdout}\n${generated.result.stderr}`, /descriptor|fixture|productionEvidence|non-runtime/i);
      assert.equal(fs.existsSync(generated.output), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("generator rejects a receipt from another head or implementation round", () => {
  for (const mutate of [
    (receipts) => { receipts.checks.security.pullRequest.headSha = "b".repeat(40); },
    (receipts) => { receipts.recovery.implementationRoundId = "ci-round-other"; }
  ]) {
    const root = temporary();
    try {
      const generated = generateEvidence(root, { mutate });
      assert.notEqual(generated.result.status, 0);
      assert.match(`${generated.result.stdout}\n${generated.result.stderr}`, /another commit|another implementation round|RECEIPT_(?:HEAD|ROUND)_MISMATCH/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});
