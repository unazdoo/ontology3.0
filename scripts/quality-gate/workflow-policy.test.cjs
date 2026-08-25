"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflow = fs.readFileSync(path.join(__dirname, "../../.github/workflows/implementation-quality.yml"), "utf8");
const policy = JSON.parse(fs.readFileSync(path.join(__dirname, "../../quality-gates/policy.json"), "utf8"));

test("workflow exposes every implementation quality gate and retains evidence", () => {
  assert.match(workflow, /pull_request:[\s\S]*?branches:[\s\S]*?- main/);
  for (const label of [
    "golden-data", "contract-compatibility", "e2e", "permission-negative",
    "concurrency-idempotency", "performance", "accessibility", "security",
    "sbom", "observability", "c034-recovery", "migration", "rollback", "ci-cd"
  ]) assert.match(workflow, new RegExp(label.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), label);
  assert.match(workflow, /retention-days:\s*90/);
  assert.doesNotMatch(workflow, /continue-on-error\s*:/);
  assert.match(workflow, /fail-fast:\s*false/);
  assert.match(workflow, /--candidate/);
  for (const command of [
    "BASELINE_SNAPSHOT_ID: BSL-OFW-V110-94ABD0E991B7",
    "verify-baseline-reference.mjs",
    "fingerprint-object-storage.mjs",
    "cleanup-pr-environment.mjs",
    "create-candidate-manifest.mjs",
    '--baseline "$BASELINE_SNAPSHOT_ID"'
  ]) assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), command);
  const policyToWorkflow = {
    goldenData: "golden-data", contractCompatibility: "contract-compatibility", permissionNegative: "permission-negative",
    concurrencyIdempotency: "concurrency-idempotency", c034Recovery: "c034-recovery", ciCd: "ci-cd"
  };
  for (const check of policy.requiredChecks) {
    const label = policyToWorkflow[check] || check;
    assert.match(workflow, new RegExp(label), `policy check ${check}`);
  }
});

test("candidate job depends on the evidence and named gate jobs", () => {
  const candidate = workflow.slice(workflow.indexOf("implementation-candidate:"));
  assert.match(candidate, /needs:\s*\[pr-evidence, scenario-regression, named-quality-gates\]/);
});

test("real PR evidence runs before cleanup and is handed to downstream gates", () => {
  const runtime = workflow.slice(workflow.indexOf("real-pr-quality:"), workflow.indexOf("named-quality-gates:"));
  for (const marker of [
    "postgres:16-alpine",
    "minio/minio:RELEASE.2025-04-22T22-12-26Z",
    "nats:2.10.26-alpine -c /etc/nats/ofw.conf",
    "minio/health/ready",
    "js-enabled-only=true",
    "provision-pr-environment.mjs",
    "migrate-runtime.mjs up",
    "migrate-runtime.mjs down",
    "run-real-runtime-evidence.mjs",
    "generate-pr-evidence.mjs",
    "cleanup-pr-environment.mjs",
    "if: always() && steps.environment.outcome == 'success'"
  ]) assert.match(runtime, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), marker);
  assert.ok(runtime.indexOf("run-real-runtime-evidence.mjs") < runtime.indexOf("cleanup-pr-environment.mjs"));
  assert.ok(runtime.indexOf("generate-pr-evidence.mjs") < runtime.indexOf("cleanup-pr-environment.mjs"));
  const downstream = workflow.slice(workflow.indexOf("named-quality-gates:"));
  assert.match(downstream, /actions\/download-artifact@v4/);
  assert.match(downstream, /implementation-quality-runtime-\$\{\{ github\.run_id \}\}/);
});
