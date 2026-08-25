#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  assertPrEnvironment,
  buildPrEnvironment,
  formatValidationErrors,
  readJson,
  writeJson
} from "./lib/quality-gate.mjs";
import {
  DESCRIPTOR_PROVISIONING_MODE,
  LIVE_PROVISIONING_MODE,
  assertProviderReceipt,
  deriveLiveResources,
  prepareRuntimeCredentials,
  probeLiveEnvironment,
  provisionLiveEnvironment,
  renderNatsServerConfig
} from "./lib/pr-environment-provider.mjs";

function usage() {
  console.error(`Usage: node scripts/quality-gate/provision-pr-environment.mjs --pr-number <number> --head-sha <sha> [options]

Default mode only derives a descriptor and is never implementation evidence.

Options:
  --live                  Provision PostgreSQL, MinIO and NATS JetStream
  --probe                 Probe an existing live environment instead of provisioning
  --prepare-runtime-identities
                          Generate runtime secrets and a dual-user NATS config before containers start
  --nats-config-output <path>
                          Private NATS config output for --prepare-runtime-identities
  --receipt <path>        Existing provider receipt (required with --probe)
  --receipt-output <path> Provider receipt output (default artifacts/pr-environment-provisioning.json)
  --round-id <id>         Implementation round identity (required with --live)
  --lease-seconds <n>     Credential lease, 900..21600 seconds (default 3600)
  --output <path>         Write the environment descriptor
  --manifest <path>       Verify a manifest's declared prEnvironment
  --check-env             Verify all PR namespace environment variables
  --github-output         Append non-secret namespace values to $GITHUB_OUTPUT`);
}

function parse(argv) {
  const result = {
    output: null,
    manifest: null,
    receipt: null,
    receiptOutput: "artifacts/pr-environment-provisioning.json",
    roundId: process.env.IMPLEMENTATION_ROUND_ID || null,
    leaseSeconds: undefined,
    live: false,
    probe: false,
    prepareRuntimeIdentities: false,
    natsConfigOutput: null,
    checkEnv: false,
    githubOutput: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--pr-number") result.pullRequestNumber = argv[++i];
    else if (option === "--head-sha") result.headSha = argv[++i];
    else if (option === "--output") result.output = argv[++i];
    else if (option === "--manifest") result.manifest = argv[++i];
    else if (option === "--receipt") result.receipt = argv[++i];
    else if (option === "--receipt-output") result.receiptOutput = argv[++i];
    else if (option === "--round-id") result.roundId = argv[++i];
    else if (option === "--lease-seconds") result.leaseSeconds = Number(argv[++i]);
    else if (option === "--live") result.live = true;
    else if (option === "--probe") result.probe = true;
    else if (option === "--prepare-runtime-identities") result.prepareRuntimeIdentities = true;
    else if (option === "--nats-config-output") result.natsConfigOutput = argv[++i];
    else if (option === "--check-env") result.checkEnv = true;
    else if (option === "--github-output") result.githubOutput = true;
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  if (result.pullRequestNumber === undefined || result.headSha === undefined) throw new Error("--pr-number and --head-sha are required");
  if (result.probe && !result.live) throw new Error("--probe requires --live");
  if (result.probe && !result.receipt) throw new Error("--probe requires --receipt");
  if (result.live && !result.roundId) throw new Error("--live requires --round-id or IMPLEMENTATION_ROUND_ID");
  if (result.prepareRuntimeIdentities && (result.live || !result.natsConfigOutput)) throw new Error("--prepare-runtime-identities requires --nats-config-output and cannot be combined with --live");
  return result;
}

function envValue(...names) {
  return names.map((name) => process.env[name]).find((value) => value !== undefined);
}

function checkProcessEnvironment(expected) {
  const actual = {
    id: envValue("PR_ENVIRONMENT_ID", "PR_ENV_ID"),
    isolationKey: envValue("PR_ISOLATION_KEY"),
    databaseSchema: envValue("PR_DB_SCHEMA", "PR_DATABASE_SCHEMA"),
    objectStoragePrefix: envValue("PR_OBJECT_STORAGE_PREFIX", "PR_OBJECT_PREFIX"),
    queueNamespace: envValue("PR_QUEUE_NAMESPACE", "PR_QUEUE_NS"),
    credentialRef: envValue("PR_CREDENTIAL_REF", "PR_CREDENTIAL_NAMESPACE")
  };
  if (!actual.id || !actual.isolationKey) throw new Error("PR_ENVIRONMENT_ID and PR_ISOLATION_KEY must be explicitly set");
  assertPrEnvironment(actual, { pullRequestNumber: options.pullRequestNumber, headSha: options.headSha });
  for (const field of ["id", "isolationKey", "databaseSchema", "objectStoragePrefix", "queueNamespace", "credentialRef"]) {
    if (actual[field] !== expected[field]) throw new Error(`${field} does not match the derived PR namespace`);
  }
  return actual;
}

function appendGithubOutput(output) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(output)
    .filter(([key]) => ["id", "isolationKey", "databaseSchema", "objectStoragePrefix", "queueNamespace", "credentialRef", "token", "implementationRoundId", "provisioningReceiptId", "provisioningReceiptDigest"].includes(key))
    .map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

function appendGithubEnvironment(descriptor, credentials) {
  if (!process.env.GITHUB_ENV) return;
  const values = {
    PR_ENVIRONMENT_ID: descriptor.id,
    PR_ISOLATION_KEY: descriptor.isolationKey,
    PR_DB_SCHEMA: descriptor.databaseSchema,
    PR_OBJECT_STORAGE_PREFIX: descriptor.objectStoragePrefix,
    PR_QUEUE_NAMESPACE: descriptor.queueNamespace,
    PR_CREDENTIAL_REF: descriptor.credentialRef,
    PR_DATABASE_ROLE: descriptor.resources?.postgresRole,
    PR_DATABASE_URL: credentials?.databaseUrl,
    PR_RUNTIME_POSTGRES_PASSWORD: credentials?.postgresPassword || credentials?.databasePassword,
    PR_RUNTIME_MINIO_ACCESS_KEY: credentials?.minioAccessKey,
    PR_RUNTIME_MINIO_SECRET_KEY: credentials?.minioSecretKey,
    PR_RUNTIME_MINIO_SESSION_TOKEN: credentials?.minioSessionToken,
    PR_RUNTIME_NATS_USER: credentials?.natsUser,
    PR_RUNTIME_NATS_PASSWORD: credentials?.natsPassword
  };
  const lines = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => `${key}=${value}`);
  fs.appendFileSync(process.env.GITHUB_ENV, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  if (process.env.GITHUB_ACTIONS === "true") {
    for (const value of [credentials?.postgresPassword, credentials?.databasePassword, credentials?.minioAccessKey, credentials?.minioSecretKey, credentials?.minioSessionToken, credentials?.natsUser, credentials?.natsPassword].filter(Boolean)) {
      process.stdout.write(`::add-mask::${value}\n`);
    }
  }
}

function descriptorBase() {
  const environment = buildPrEnvironment(options.pullRequestNumber, options.headSha);
  return {
    schemaVersion: "implementation-pr-environment.v1",
    pullRequestNumber: Number(options.pullRequestNumber),
    headSha: String(options.headSha).toLowerCase(),
    ...environment,
    createdAt: new Date().toISOString()
  };
}

let options;
try {
  options = parse(process.argv.slice(2));
  const base = descriptorBase();
  if (options.manifest) {
    const manifest = readJson(options.manifest);
    const declared = manifest.prEnvironment || manifest.implementation?.prEnvironment;
    assertPrEnvironment(declared, { pullRequestNumber: options.pullRequestNumber, headSha: options.headSha });
  }
  if (options.checkEnv) checkProcessEnvironment(base);

  let output;
  let credentials;
  if (options.prepareRuntimeIdentities) {
    credentials = prepareRuntimeCredentials(base);
    const config = renderNatsServerConfig(base, credentials, {
      user: process.env.PR_PROVIDER_NATS_USER,
      password: process.env.PR_PROVIDER_NATS_PASSWORD
    });
    fs.mkdirSync(path.dirname(path.resolve(options.natsConfigOutput)), { recursive: true });
    fs.writeFileSync(path.resolve(options.natsConfigOutput), config, { encoding: "utf8", mode: 0o600, flag: "wx" });
    output = {
      ...base,
      resources: deriveLiveResources(base),
      provisioningReceipt: null,
      provisioningMode: DESCRIPTOR_PROVISIONING_MODE,
      productionEvidence: false,
      evidenceEligible: false,
      runtimeIdentityPrepared: true,
      natsConfigRef: path.basename(options.natsConfigOutput)
    };
  } else if (options.live) {
    if (!/^pr-[1-9][0-9]*-[a-f0-9]{12}$/.test(base.id)) throw new Error("live mode requires a head SHA of at least 12 hexadecimal characters");
    const live = options.probe
      ? { receipt: await probeLiveEnvironment({ descriptor: base, receipt: readJson(options.receipt), roundId: options.roundId }) }
      : await provisionLiveEnvironment({ descriptor: base, roundId: options.roundId, leaseSeconds: options.leaseSeconds });
    const receipt = assertProviderReceipt(live.receipt, { descriptor: base, pullRequestNumber: options.pullRequestNumber, headSha: options.headSha, roundId: options.roundId });
    writeJson(options.receiptOutput, receipt);
    credentials = live.credentials;
    output = {
      ...base,
      provisioningReceipt: `artifact://${path.basename(options.receiptOutput)}`,
      provisioningReceiptId: receipt.receiptId,
      provisioningReceiptDigest: receipt.receiptDigest,
      provisioningMode: LIVE_PROVISIONING_MODE,
      productionEvidence: true,
      evidenceEligible: true,
      implementationRoundId: receipt.implementationRoundId,
      expiresAt: receipt.expiresAt,
      resources: receipt.resources,
      credentialLease: receipt.credentialLease,
      health: receipt.health
    };
  } else {
    output = {
      ...base,
      provisioningReceipt: null,
      provisioningReceiptDigest: null,
      provisioningMode: DESCRIPTOR_PROVISIONING_MODE,
      productionEvidence: false,
      evidenceEligible: false,
      productionCredentialsAllowed: false
    };
  }
  if (options.output) writeJson(options.output, output);
  if (options.githubOutput) appendGithubOutput(output);
  if (options.live || options.prepareRuntimeIdentities) appendGithubEnvironment(output, credentials);
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(`PR environment provisioning FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  usage();
  process.exit(1);
}
