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

const here = path.dirname(new URL(import.meta.url).pathname);
const verifyScript = path.join(here, "verify-pr-evidence.mjs");
const sbomScript = path.join(here, "generate-sbom.mjs");
const verifySbomScript = path.join(here, "verify-sbom.mjs");

function validManifest(overrides = {}) {
  const pullRequest = { number: 42, headSha: "a".repeat(40) };
  const environment = { ...buildPrEnvironment(pullRequest.number, pullRequest.headSha), provisioningReceipt: "artifact://pr-environment-provisioned.json" };
  const checks = Object.fromEntries(REQUIRED_CHECKS.map((name) => [name, {
    status: "passed",
    evidence: `evidence/${name}.json`
  }]));
  checks.goldenData.hash = sha256("golden-data-v1");
  checks.contractCompatibility.compatibility = "compatible";
  checks.sbom.artifact = "artifacts/sbom.spdx.json";
  return {
    manifestVersion: "pr-quality.v1",
    gateVersion: "implementation-quality-gate.v1",
    baselineSnapshotId: DEFAULT_BASELINE_SNAPSHOT_ID,
    sourceTag: "prototype-v1.1.0-frozen",
    sourceVersion: "v1.1.0",
    implementationVersion: "implementation-0.1.0",
    schemaVersion: "draft-0.1.0",
    schemaVersions: ["draft-0.1.0"],
    schemaCompatibility: { status: "compatible", evidence: "evidence/compatibility.json" },
    owner: { name: "quality-owner", team: "platform" },
    providers: ["foundation"],
    consumers: ["s001"],
    pullRequest,
    databaseMigration: { status: "verified", up: "none", down: "none", evidence: "evidence/migration.json" },
    objectStorageFingerprint: { status: "verified", algorithm: "sha256", value: "b".repeat(64), prefix: environment.objectStoragePrefix, evidence: "evidence/object-manifest.json" },
    rollback: { status: "verified", targetVersion: "1.0.3", evidence: "evidence/rollback.json" },
    runtimeRunId: "S001-RUN-202608240001",
    runtimeRunIsReal: true,
    audit: { actorRef: "actor:ci", traceId: "trace-1", correlationId: "corr-1", idempotencyKey: "idem-1", formedAt: "2026-08-24T00:00:00.000Z", appendOnly: true, scenarioContext: { scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-202608240001", formedAt: "2026-08-24T00:00:00.000Z", status: "active" }, evidence: "evidence/audit.json" },
    negativeTests: { status: "passed", cases: ["missing-context", "unknown-schema", "unauthorized-owner", "cross-scenario", "duplicate-idempotency", "recovery-side-effect"], evidence: "evidence/negative.json" },
    recoveryReceipt: { status: "passed", sourceScenarioRunId: "S001-RUN-source", restoredScenarioRunId: "S001-RUN-restored", sideEffectsSuppressed: true, overwritesSource: false, evidence: "evidence/recovery.json" },
    prEnvironment: environment,
    checks,
    candidateGates: {
      s001VerticalSlice: { status: "passed", evidence: "evidence/s001.json", scenarioId: "S001", realRunId: "S001-RUN-202608240001", order: ["M02", "M01", "M03", "M04", "M06", "M05", "M06"], roundId: "round-1" },
      security: { status: "passed", evidence: "evidence/security.json", roundId: "round-1" },
      recovery: { status: "passed", evidence: "evidence/recovery.json", roundId: "round-1" }
    },
    ...overrides
  };
}

test("valid evidence is accepted and candidate eligibility is computed", () => {
  const result = validatePrEvidence(validManifest());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.candidateEligible, true);
});

test("negative case policy is represented by the validator", () => {
  const policy = JSON.parse(fs.readFileSync(path.join(here, "../../quality-gates/required-negative-cases.json"), "utf8"));
  assert.deepEqual(REQUIRED_NEGATIVE_CASES, policy.required.map((item) => item.id));
});

test("missing mandatory metadata fails closed", () => {
  const manifest = validManifest();
  delete manifest.baselineSnapshotId;
  delete manifest.owner;
  delete manifest.runtimeRunId;
  delete manifest.recoveryReceipt;
  const result = validatePrEvidence(manifest);
  assert.equal(result.valid, false);
  for (const code of ["BASELINE_SNAPSHOT_MISSING", "OWNER_MISSING", "RUNTIME_RUN_ID_INVALID", "RECOVERY_RECEIPT_MISSING"]) {
    assert.ok(result.errors.some((item) => item.code === code), code);
  }
});

test("candidate remains blocked when security or recovery is not passed", () => {
  const manifest = validManifest({ candidateGates: {
    s001VerticalSlice: { status: "passed", evidence: "evidence/s001.json", scenarioId: "S001", realRunId: "S001-RUN-202608240001", order: ["M02", "M01", "M03", "M04", "M06", "M05", "M06"], roundId: "round-1" },
    security: { status: "blocked", evidence: "evidence/security.json" },
    recovery: { status: "passed", evidence: "evidence/recovery.json" }
  } });
  const result = validatePrEvidence(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.candidateEligible, false);
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
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "implementation-quality-"));
  try {
    const manifestPath = path.join(temp, "pr-evidence.json");
    fs.writeFileSync(manifestPath, JSON.stringify(validManifest()), "utf8");
    const success = spawnSync(process.execPath, [verifyScript, "--manifest", manifestPath, "--pr-number", "42", "--head-sha", "a".repeat(40)], { encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    const invalid = validManifest({ recoveryReceipt: { ...validManifest().recoveryReceipt, restoredScenarioRunId: "S001-RUN-source" } });
    fs.writeFileSync(manifestPath, JSON.stringify(invalid), "utf8");
    const failure = spawnSync(process.execPath, [verifyScript, "--manifest", manifestPath], { encoding: "utf8" });
    assert.notEqual(failure.status, 0);
    assert.match(`${failure.stdout}\n${failure.stderr}`, /RECOVERY_RUN_REUSED|recovery must create/i);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
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
