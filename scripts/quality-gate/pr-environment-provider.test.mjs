import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildPrEnvironment } from "./lib/quality-gate.mjs";
import {
  assertProviderReceipt,
  cleanupLiveEnvironment,
  createRuntimeScopeGuard,
  deriveLiveResources,
  fingerprintLiveObjectStorage,
  probeLiveEnvironment,
  prepareRuntimeCredentials,
  provisionLiveEnvironment,
  renderNatsServerConfig
} from "./lib/pr-environment-provider.mjs";

const HEAD_SHA = "a".repeat(40);
const NOW = "2026-08-25T00:00:00.000Z";
const ROUND_ID = "implementation-round-provider-001";

function descriptor() {
  return {
    schemaVersion: "implementation-pr-environment.v1",
    pullRequestNumber: 42,
    headSha: HEAD_SHA,
    ...buildPrEnvironment(42, HEAD_SHA),
    createdAt: NOW
  };
}

function fakeAdapters(options = {}) {
  const calls = [];
  let active = false;
  const resource = (name, input) => name === "postgres" ? input.resources.databaseSchema
    : name === "minio" ? `${input.resources.objectStorageBucket}/${input.resources.objectStoragePrefix}`
      : input.resources.jetStreamName;
  const adapter = (name) => ({
    async provision(input) {
      calls.push(`${name}:provision`);
      if (options.failProvision === name) throw new Error(`${name} provision failed secret=must-not-leak`);
      active = true;
      if (name === "postgres") return { databaseUrl: "postgres://app:redacted@localhost/db", runtimeScopeVerified: true, crossScopeDenied: true };
      if (name === "minio") return { minioAccessKey: "sts-access", minioSecretKey: "sts-secret", minioSessionToken: "sts-token", runtimeScopeVerified: true, crossScopeDenied: true };
      return { probeSequence: 1, runtimeScopeVerified: true, crossScopeDenied: true };
    },
    async probe(input) {
      calls.push(`${name}:probe`);
      if (!active || options.failProbe === name) throw new Error(`${name} probe failed`);
      return { server: `${name}-test`, resource: resource(name, input), runtimeScopeVerified: true, crossScopeDenied: true, ...(name === "nats" ? { probeSequence: 1 } : {}) };
    },
    async cleanup(input) {
      calls.push(`${name}:cleanup`);
      if (options.failCleanup === name) throw new Error(`${name} cleanup failed token=must-not-leak`);
      active = false;
      return { status: "absent", resource: resource(name, input) };
    },
    async fingerprint() {
      calls.push(`${name}:fingerprint`);
      return { value: "b".repeat(64), fileCount: 2 };
    }
  });
  return { postgres: adapter("postgres"), objectStorage: adapter("minio"), queue: adapter("nats"), calls };
}

test("live provider emits a strict secret-free receipt and supports probe", async () => {
  const adapters = fakeAdapters();
  const value = await provisionLiveEnvironment({ descriptor: descriptor(), roundId: ROUND_ID, leaseSeconds: 900, now: NOW, adapters });
  const receipt = assertProviderReceipt(value.receipt, {
    descriptor: descriptor(), pullRequestNumber: 42, headSha: HEAD_SHA, roundId: ROUND_ID,
    now: "2026-08-25T00:05:00.000Z"
  });
  assert.equal(receipt.productionEvidence, true);
  assert.equal(receipt.provisioningMode, "live-provider");
  assert.equal(receipt.credentialLease.secretIncluded, false);
  assert.equal(receipt.health.postgres.status, "passed");
  assert.equal(receipt.health.minio.status, "passed");
  assert.equal(receipt.health.nats.status, "passed");
  assert.equal(receipt.resources.runtimeCredentialRefs.postgres, "pr/42/aaaaaaaaaaaa/postgres-app");
  assert.equal(receipt.resources.minioRuntimeScope.credentialMode, "sts-inline-session-policy");
  assert.equal(receipt.resources.natsRuntimeIdentity.credentialMode, "server-startup-config");
  assert.doesNotMatch(JSON.stringify(receipt), /must-not-leak|databasePassword|postgres:\/\/app:|sts-secret|sts-token/);
  assert.match(value.credentials.databaseUrl, /^postgres:/);
  assert.ok(value.credentials.databasePassword.length >= 32);
  assert.equal(value.credentials.minioAccessKey, "sts-access");
  assert.equal(value.credentials.natsUser, receipt.resources.natsRuntimeIdentity.principal);

  const verified = await probeLiveEnvironment({ descriptor: descriptor(), receipt, roundId: ROUND_ID, now: "2026-08-25T00:06:00.000Z", adapters });
  assert.equal(verified.status, "verified");
  assertProviderReceipt(verified, { descriptor: descriptor(), roundId: ROUND_ID });
});

test("runtime scope helpers and NATS startup config deny cross-prefix and cross-subject access", () => {
  const value = descriptor();
  const resources = deriveLiveResources(value);
  const runtimeAdapter = createRuntimeScopeGuard(resources);
  assert.equal(runtimeAdapter.objectStorage.assertAccess(resources.objectStorageBucket, `${resources.objectStoragePrefix}allowed.json`), true);
  assert.throws(() => runtimeAdapter.objectStorage.assertAccess(resources.objectStorageBucket, "other/denied.json"), (error) => error.details?.some((item) => item.code === "MINIO_RUNTIME_SCOPE_DENIED"));
  assert.equal(runtimeAdapter.queue.assertPublish(`${resources.queueNamespace}.C003`), true);
  assert.throws(() => runtimeAdapter.queue.assertPublish(`other.${resources.queueNamespace}.C003`), (error) => error.details?.some((item) => item.code === "NATS_RUNTIME_SCOPE_DENIED"));

  const runtime = prepareRuntimeCredentials(value, { postgresPassword: "pg-secret", natsPassword: "runtime-secret" });
  const config = renderNatsServerConfig(value, runtime, { user: "provider-admin", password: "provider-secret" });
  assert.match(config, /runtime_pr_42_aaaaaaaaaaaa/);
  assert.match(config, /pr-42-aaaaaaaaaaaa\.>/);
  assert.doesNotMatch(JSON.stringify(resources), /runtime-secret|provider-secret|pg-secret/);
});

test("provider rejects tampering, expiry and descriptor-only receipts", async () => {
  const value = await provisionLiveEnvironment({ descriptor: descriptor(), roundId: ROUND_ID, leaseSeconds: 900, now: NOW, adapters: fakeAdapters() });
  assert.throws(() => assertProviderReceipt({ ...value.receipt, productionEvidence: false }), /descriptor-only|digest/i);
  assert.throws(() => assertProviderReceipt(value.receipt, { descriptor: { ...descriptor(), databaseSchema: "pr_42_bbbbbbbbbbbb" } }), /descriptor|derived|match|isolated/i);
  assert.throws(() => assertProviderReceipt(value.receipt, { now: "2026-08-25T00:16:00.000Z" }), /expired/i);
});

test("live fingerprint binds MinIO content to the provider receipt", async () => {
  const adapters = fakeAdapters();
  const { receipt } = await provisionLiveEnvironment({ descriptor: descriptor(), roundId: ROUND_ID, now: NOW, adapters });
  const result = await fingerprintLiveObjectStorage({ descriptor: descriptor(), receipt, roundId: ROUND_ID, now: NOW, adapters });
  assert.equal(result.productionEvidence, true);
  assert.equal(result.sourceType, "minio-live");
  assert.equal(result.providerReceiptDigest, receipt.receiptDigest);
  assert.equal(result.value, "b".repeat(64));
  assert.match(result.receiptId, /^OBJFP-/);
  assert.equal(result.pullRequest.headSha, HEAD_SHA);
});

test("live cleanup is exact, receipt-bound and reports partial failure", async () => {
  const adapters = fakeAdapters();
  const { receipt } = await provisionLiveEnvironment({ descriptor: descriptor(), roundId: ROUND_ID, now: NOW, adapters });
  const cleanup = await cleanupLiveEnvironment({ descriptor: descriptor(), receipt, roundId: ROUND_ID, now: NOW, adapters });
  assert.equal(cleanup.status, "completed");
  assert.equal(cleanup.outsideScopeTouched, false);
  assert.equal(cleanup.postCleanupProbe.allResourcesAbsent, true);
  assert.equal(cleanup.provisioningReceiptDigest, receipt.receiptDigest);
  assert.equal(cleanup.productionEvidence, true);
  assert.match(cleanup.receiptId, /^PRCLEAN-/);

  const failingAdapters = fakeAdapters({ failCleanup: "minio" });
  const live = await provisionLiveEnvironment({ descriptor: descriptor(), roundId: ROUND_ID, now: NOW, adapters: failingAdapters });
  await assert.rejects(
    cleanupLiveEnvironment({ descriptor: descriptor(), receipt: live.receipt, roundId: ROUND_ID, now: NOW, adapters: failingAdapters }),
    (error) => error.receipt?.status === "failed" && error.receipt?.outsideScopeTouched === false
  );
});

test("failed provisioning runs scoped compensation and redacts provider errors", async () => {
  const adapters = fakeAdapters({ failProvision: "minio" });
  await assert.rejects(
    provisionLiveEnvironment({ descriptor: descriptor(), roundId: ROUND_ID, now: NOW, adapters }),
    (error) => /compensation failures=0/.test(error.message) && !error.message.includes("must-not-leak")
  );
  assert.ok(adapters.calls.includes("postgres:cleanup"));
  assert.equal(adapters.calls.includes("minio:cleanup"), false);
  assert.equal(adapters.calls.includes("nats:cleanup"), false);
});

test("descriptor CLI is explicitly ineligible and check-env requires identity", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pr-provider-cli-"));
  try {
    const output = path.join(temp, "descriptor.json");
    const script = path.join(path.dirname(new URL(import.meta.url).pathname), "provision-pr-environment.mjs");
    const created = spawnSync(process.execPath, [script, "--pr-number", "42", "--head-sha", HEAD_SHA, "--output", output], { encoding: "utf8" });
    assert.equal(created.status, 0, created.stderr);
    const value = JSON.parse(fs.readFileSync(output, "utf8"));
    assert.equal(value.evidenceEligible, false);
    assert.equal(value.productionEvidence, false);
    assert.equal(value.provisioningReceipt, null);

    const checked = spawnSync(process.execPath, [script, "--pr-number", "42", "--head-sha", HEAD_SHA, "--check-env"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PR_DB_SCHEMA: value.databaseSchema,
        PR_OBJECT_STORAGE_PREFIX: value.objectStoragePrefix,
        PR_QUEUE_NAMESPACE: value.queueNamespace,
        PR_CREDENTIAL_REF: value.credentialRef
      }
    });
    assert.notEqual(checked.status, 0);
    assert.match(checked.stderr, /PR_ENVIRONMENT_ID/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("prepare-runtime-identities CLI writes a private dual-user NATS config without leaking secrets", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pr-provider-nats-config-"));
  try {
    const script = path.join(path.dirname(new URL(import.meta.url).pathname), "provision-pr-environment.mjs");
    const configPath = path.join(temp, "nats.conf");
    const githubEnv = path.join(temp, "github.env");
    const result = spawnSync(process.execPath, [
      script, "--pr-number", "42", "--head-sha", HEAD_SHA,
      "--prepare-runtime-identities", "--nats-config-output", configPath
    ], {
      encoding: "utf8",
      env: { ...process.env, PR_PROVIDER_NATS_USER: "provider-admin", PR_PROVIDER_NATS_PASSWORD: "provider-private-value", GITHUB_ENV: githubEnv }
    });
    assert.equal(result.status, 0, result.stderr);
    const config = fs.readFileSync(configPath, "utf8");
    const environment = fs.readFileSync(githubEnv, "utf8");
    assert.match(config, /provider-private-value/);
    assert.match(config, /runtime_pr_42_aaaaaaaaaaaa/);
    assert.match(environment, /PR_RUNTIME_NATS_PASSWORD=/);
    assert.doesNotMatch(result.stdout, /provider-private-value|PR_RUNTIME_NATS_PASSWORD=/);
    assert.equal(fs.statSync(configPath).mode & 0o077, 0);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
