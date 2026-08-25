import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { buildPrEnvironment, sha256 } from "../lib/quality-gate.mjs";

export const TEST_BINDING = Object.freeze({
  pullRequestNumber: 42,
  headSha: "a".repeat(40),
  implementationRoundId: "ci-round-42-1"
});

const generator = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../generate-pr-evidence.mjs");

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function common(id, environment, extra = {}) {
  return {
    receiptId: id,
    status: "passed",
    productionEvidence: true,
    pullRequest: { number: TEST_BINDING.pullRequestNumber, headSha: TEST_BINDING.headSha },
    environmentId: environment.id,
    implementationRoundId: TEST_BINDING.implementationRoundId,
    formedAt: "2026-08-25T00:00:00.000Z",
    ...extra
  };
}

function checkReceipts(environment, runtimeRunId) {
  const values = {
    goldenData: { sha256: "1".repeat(64) },
    contractCompatibility: {
      compatibility: "exact", idempotencyContractVerified: true, c033ContractVerified: true,
      ownerBoundaryVerified: true, exactVersionContractVerified: true
    },
    e2e: {
      scenarioId: "S001", runtimeRunId, c033Verified: true, ownerBoundaryVerified: true, exactVersionsVerified: true,
      idempotency: {
        sameKeySameContentOnce: true, sameKeyDifferentContentRejected: true, casConflictRejected: true,
        outboxDuplicateSuppressed: true, inboxDuplicateSuppressed: true, retryNoDuplicateSideEffects: true
      }
    },
    permissionNegative: { deniedCases: ["cross-scenario"] },
    concurrencyIdempotency: { duplicateSuppressed: true, raceCovered: true, retryCovered: true },
    performance: { p95Ms: 120, sloMs: 500 },
    accessibility: { standard: "WCAG 2.2 AA", scope: "ui", uiChangesDetected: true, targetUrl: "http://127.0.0.1/app", axe: { executed: true }, violations: 0, keyboard: true },
    security: {
      unresolvedCritical: 0, unresolvedHigh: 0,
      secretScan: { status: "passed", findingCount: 0 },
      dependencyAudit: { status: "verified", vulnerabilities: { high: 0, critical: 0 } }
    },
    sbom: { format: "SPDX-2.3", sha256: "2".repeat(64) },
    observability: { logs: true, metrics: true, traces: true, alerts: true },
    c034Recovery: { receiptId: "RCPT-CHECK-C034", sideEffectsSuppressed: true, newScenarioRunId: true },
    migration: { up: "applied", down: "verified" },
    rollback: { targetVersion: "v1.0.3" },
    ciCd: { workflowRunId: "gha-42-1" }
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, common(`RCPT-CHECK-${key}`, environment, value)]));
}

export function createReceiptInputs(root, options = {}) {
  const environment = buildPrEnvironment(TEST_BINDING.pullRequestNumber, TEST_BINDING.headSha);
  const directory = path.join(root, "artifacts/receipts");
  const runtimeRunId = "S001-RUN-20260825-REAL-001";
  const receipts = {
    provisioning: common("RCPT-PROVISION", environment, {
      schemaVersion: "implementation-pr-environment-provider.v1",
      status: "provisioned",
      provisioningMode: "live-ephemeral-provider",
      resources: {
        databaseSchema: environment.databaseSchema,
        objectStoragePrefix: environment.objectStoragePrefix,
        queueNamespace: environment.queueNamespace
      },
      credentialLease: { reference: environment.credentialRef, mode: "short-lived-least-privilege", expiresAt: "2026-08-26T00:00:00.000Z" },
      health: { postgres: { status: "healthy" }, minio: { status: "ready" }, nats: { status: "passed" } },
      provisionedAt: "2026-08-25T00:00:00.000Z",
      expiresAt: "2026-08-26T00:00:00.000Z",
      cleanupPlan: "scoped-cleanup"
    }),
    databaseMigration: common("RCPT-MIGRATION", environment, { status: "verified", up: "applied", down: "verified" }),
    objectStorageFingerprint: common("RCPT-OBJECT", environment, { status: "verified", algorithm: "sha256", value: "b".repeat(64), prefix: environment.objectStoragePrefix, sourceType: "live-minio-prefix" }),
    rollback: common("RCPT-ROLLBACK", environment, { status: "verified", targetVersion: "v1.0.3" }),
    runtime: common("RCPT-RUNTIME", environment, {
      runtimeRunId,
      realRunIds: [runtimeRunId],
      runtimeRunIsReal: true,
      scenarioId: "S001",
      order: ["M02", "M01", "M03", "M04", "M06", "M05", "M06"]
    }),
    audit: common("RCPT-AUDIT", environment, {
      actorRef: "actor:ci", traceId: "trace-42", correlationId: "corr-42", idempotencyKey: "idem-42",
      appendOnly: true,
      scenarioContext: { scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: runtimeRunId, formedAt: "2026-08-25T00:00:00.000Z", status: "active" }
    }),
    negativeTests: common("RCPT-NEGATIVE", environment, { status: "verified", cases: ["missing-context", "unknown-schema", "unauthorized-owner", "cross-scenario", "duplicate-idempotency", "recovery-side-effect"] }),
    recovery: common("RCPT-RECOVERY", environment, {
      status: "verified",
      sourceScenarioRunId: runtimeRunId,
      restoredScenarioRunId: "S001-RUN-20260825-RESTORED-001",
      sideEffectsSuppressed: true,
      overwritesSource: false
    })
  };
  receipts.checks = checkReceipts(environment, runtimeRunId);
  if (typeof options.mutate === "function") options.mutate(receipts, environment);

  if (options.deferredAccessibility) {
    const finding = common("RCPT-ACCESSIBILITY-FINDING", environment, {
      status: "blocked", scope: "ui", uiChangesDetected: true, targetUrl: "http://127.0.0.1/app",
      standard: "WCAG 2.2 AA", axe: { executed: true }, violations: 1, keyboard: true,
      blockedReasons: ["axe-violations"], reason: "axe found a real color contrast violation"
    });
    const findingRelative = "artifacts/receipts/accessibility-finding.json";
    writeJson(path.join(root, findingRelative), finding);
    const findingDigest = sha256(fs.readFileSync(path.join(root, findingRelative)));
    receipts.checks.accessibility = common("RCPT-CHECK-accessibility", environment, {
      status: "not-applicable",
      reason: "current implementation slice is backend-only; the actual frozen UI finding remains open",
      scope: "backend-only",
      uiChangesDetected: false,
      nextGate: "first-ui-candidate",
      findingEvidence: {
        path: findingRelative, sha256: findingDigest, receiptId: finding.receiptId,
        pullRequestNumber: TEST_BINDING.pullRequestNumber, headSha: TEST_BINDING.headSha,
        environmentId: environment.id, implementationRoundId: TEST_BINDING.implementationRoundId
      }
    });
  }

  const index = {};
  for (const [role, receipt] of Object.entries(receipts)) {
    if (role === "checks") continue;
    const relative = `artifacts/receipts/${role}.json`;
    writeJson(path.join(root, relative), receipt);
    index[role] = relative;
  }
  index.checks = {};
  for (const [check, receipt] of Object.entries(receipts.checks)) {
    const relative = `artifacts/receipts/check-${check}.json`;
    writeJson(path.join(root, relative), receipt);
    index.checks[check] = relative;
  }
  const metadata = {
    baselineSnapshotId: "BSL-OFW-V110-94ABD0E991B7",
    sourceTag: "prototype-v1.1.0-frozen",
    sourceVersion: "v1.1.0",
    implementationVersion: "implementation-0.1.0",
    schemaVersion: "draft-0.1.0",
    schemaVersions: ["draft-0.1.0"],
    schemaCompatibility: { status: "exact" },
    owner: { name: "quality-owner", team: "platform" },
    providers: ["M01", "M02", "M03", "M04", "M05", "M06"],
    consumers: ["S001"]
  };
  writeJson(path.join(directory, "metadata.json"), metadata);
  writeJson(path.join(directory, "index.json"), index);
  return { directory, environment, index, metadata, receipts, runtimeRunId };
}

export function generateEvidence(root, options = {}) {
  const created = createReceiptInputs(root, options);
  const output = path.join(root, "implementation/evidence/pr-quality.json");
  const result = spawnSync(process.execPath, [
    generator,
    "--metadata", "artifacts/receipts/metadata.json",
    "--index", "artifacts/receipts/index.json",
    "--receipt-root", root,
    "--pr-number", String(TEST_BINDING.pullRequestNumber),
    "--head-sha", TEST_BINDING.headSha,
    "--round-id", TEST_BINDING.implementationRoundId,
    "--output", output
  ], { encoding: "utf8" });
  return { ...created, output, result, manifest: result.status === 0 ? JSON.parse(fs.readFileSync(output, "utf8")) : null };
}
