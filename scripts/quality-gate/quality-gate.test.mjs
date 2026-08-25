import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  DEFAULT_BASELINE_SNAPSHOT_ID,
  REQUIRED_NEGATIVE_CASES,
  REQUIRED_CHECKS,
  buildPrEnvironment,
  sha256,
  validatePrEnvironment,
  validatePrEvidence
} from "./lib/quality-gate.mjs";
import { generateEvidence, TEST_BINDING } from "./test-support/receipt-bundle.mjs";

const here = path.dirname(new URL(import.meta.url).pathname);
const verifyScript = path.join(here, "verify-pr-evidence.mjs");
const sbomScript = path.join(here, "generate-sbom.mjs");
const verifySbomScript = path.join(here, "verify-sbom.mjs");

function withEvidence(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "implementation-quality-"));
  try {
    const generated = generateEvidence(root);
    assert.equal(generated.result.status, 0, generated.result.stderr);
    return callback(generated, root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("valid evidence is accepted and candidate eligibility is computed", () => {
  withEvidence((generated, root) => {
    const result = validatePrEvidence(generated.manifest, { receiptRoot: root, manifestPath: generated.output });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.candidateEligible, true);
    assert.equal(result.receiptVerification.verifiedCount, 22);
  });
});

test("negative case policy is represented by the validator", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(here, "../../quality-gates/required-negative-cases.json"), "utf8"));
  assert.deepEqual(REQUIRED_NEGATIVE_CASES, policy.required.map((item) => item.id));
});

test("missing mandatory metadata fails closed", () => {
  withEvidence((generated, root) => {
    const manifest = generated.manifest;
    delete manifest.baselineSnapshotId;
    delete manifest.owner;
    delete manifest.runtimeRunId;
    delete manifest.realRunIds;
    delete manifest.recoveryReceipt;
    const result = validatePrEvidence(manifest, { receiptRoot: root });
    assert.equal(result.valid, false);
    for (const code of ["BASELINE_SNAPSHOT_MISSING", "OWNER_MISSING", "RUNTIME_RUN_ID_INVALID", "RECOVERY_RECEIPT_MISSING"]) {
      assert.ok(result.errors.some((item) => item.code === code), code);
    }
  });
});

test("candidate remains blocked when security or recovery is not passed", () => {
  withEvidence((generated, root) => {
    generated.manifest.candidateGates.security.status = "blocked";
    const result = validatePrEvidence(generated.manifest, { receiptRoot: root });
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.candidateEligible, false);
  });
});

test("environment derivation rejects collisions and production names", () => {
  const expected = buildPrEnvironment(42, "a".repeat(40));
  assert.equal(validatePrEnvironment(expected, { pullRequestNumber: 42, headSha: "a".repeat(40) }).valid, true);
  const collision = { ...expected, queueNamespace: expected.databaseSchema };
  assert.equal(validatePrEnvironment(collision, { pullRequestNumber: 42, headSha: "a".repeat(40) }).valid, false);
  const production = { ...expected, databaseSchema: "production" };
  assert.equal(validatePrEnvironment(production).valid, false);
});

test("CLI verifies a manifest and fails for a reused recovery run", () => {
  withEvidence((generated, root) => {
    const success = spawnSync(process.execPath, [verifyScript, "--manifest", generated.output, "--receipt-root", root, "--pr-number", String(TEST_BINDING.pullRequestNumber), "--head-sha", TEST_BINDING.headSha], { encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    generated.manifest.recoveryReceipt.restoredScenarioRunId = generated.manifest.recoveryReceipt.sourceScenarioRunId;
    fs.writeFileSync(generated.output, JSON.stringify(generated.manifest), "utf8");
    const failure = spawnSync(process.execPath, [verifyScript, "--manifest", generated.output, "--receipt-root", root], { encoding: "utf8" });
    assert.notEqual(failure.status, 0);
    assert.match(`${failure.stdout}\n${failure.stderr}`, /RECOVERY_RUN_REUSED|recovery must create/i);
  });
});

test("SBOM generator emits a verifiable SPDX document", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "implementation-sbom-"));
  try {
    fs.writeFileSync(path.join(temp, "package.json"), JSON.stringify({ name: "fixture-package", version: "1.2.3", dependencies: { "example-dependency": "^1.0.0" } }), "utf8");
    const components = [
      ["foundation", ["packages/contracts"]], ["m01", ["services/ontology"]], ["m02", ["services/data"]],
      ["m03", ["services/query"]], ["m04", ["services/decision"]], ["m05", ["packages/m05"]],
      ["m06", ["packages/report"]], ["integration-contract-tests", ["tests/integration"]], ["quality-gates", ["quality-gates", "scripts/quality-gate"]]
    ];
    for (const [, paths] of components) for (const componentPath of paths) {
      const directory = path.join(temp, componentPath);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, "source.js"), `// ${componentPath}\n`, "utf8");
    }
    fs.writeFileSync(path.join(temp, "quality-gates", "component-inventory.json"), JSON.stringify({ schemaVersion: "implementation-component-inventory.v1", components: components.map(([id, paths]) => ({ id, name: id, version: "1.0.0", paths })) }), "utf8");
    const output = path.join(temp, "sbom.json");
    const generated = spawnSync(process.execPath, [sbomScript, "--root", temp, "--output", "sbom.json"], { encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr);
    const verified = spawnSync(process.execPath, [verifySbomScript, "--root", temp, "--sbom", output, "--package", path.join(temp, "package.json")], { encoding: "utf8" });
    assert.equal(verified.status, 0, verified.stderr);
    assert.ok(JSON.parse(fs.readFileSync(output, "utf8")).packages.length >= 11);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("SBOM component inventory fails closed for duplicate paths and missing source directories", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "implementation-sbom-invalid-"));
  try {
    fs.writeFileSync(path.join(temp, "package.json"), JSON.stringify({ name: "fixture-package", version: "1.2.3" }), "utf8");
    fs.mkdirSync(path.join(temp, "quality-gates"), { recursive: true });
    fs.writeFileSync(path.join(temp, "quality-gates", "component-inventory.json"), JSON.stringify({ schemaVersion: "implementation-component-inventory.v1", components: [{ id: "one", name: "one", version: "1", paths: ["missing"] }, { id: "two", name: "two", version: "1", paths: ["missing"] }] }), "utf8");
    const failure = spawnSync(process.execPath, [sbomScript, "--root", temp, "--output", "sbom.json"], { encoding: "utf8" });
    assert.notEqual(failure.status, 0);
    assert.match(`${failure.stdout}\n${failure.stderr}`, /component path does not exist|duplicate component path/i);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
