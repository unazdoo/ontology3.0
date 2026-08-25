#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import {
  assertPrEnvironment,
  buildPrEnvironment,
  formatValidationErrors,
  readJson,
  writeJson
} from "./lib/quality-gate.mjs";

function usage() {
  console.error(`Usage: node scripts/quality-gate/provision-pr-environment.mjs --pr-number <number> --head-sha <sha> [options]

Creates deterministic, non-production namespaces for a PR:
  id, databaseSchema, objectStoragePrefix, queueNamespace, credentialRef

Options:
  --output <path>       Write the environment JSON
  --manifest <path>     Read prEnvironment from an evidence manifest and verify it
  --check-env           Verify PR_ENVIRONMENT_ID/PR_DB_SCHEMA/PR_OBJECT_STORAGE_PREFIX/PR_QUEUE_NAMESPACE/PR_CREDENTIAL_REF
  --github-output       Append namespace values to $GITHUB_OUTPUT`);
}

function parse(argv) {
  const result = { output: null, manifest: null, checkEnv: false, githubOutput: false };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--pr-number") result.pullRequestNumber = argv[++i];
    else if (option === "--head-sha") result.headSha = argv[++i];
    else if (option === "--output") result.output = argv[++i];
    else if (option === "--manifest") result.manifest = argv[++i];
    else if (option === "--check-env") result.checkEnv = true;
    else if (option === "--github-output") result.githubOutput = true;
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  if (result.pullRequestNumber === undefined || result.headSha === undefined) throw new Error("--pr-number and --head-sha are required");
  return result;
}

function envValue(...names) {
  return names.map((name) => process.env[name]).find((value) => value !== undefined);
}

function checkProcessEnvironment(expected) {
  const actual = {
    id: envValue("PR_ENVIRONMENT_ID", "PR_ENV_ID") || expected.id,
    isolationKey: envValue("PR_ISOLATION_KEY", "PR_ENVIRONMENT_ID", "PR_ENV_ID") || expected.isolationKey,
    databaseSchema: envValue("PR_DB_SCHEMA", "PR_DATABASE_SCHEMA"),
    objectStoragePrefix: envValue("PR_OBJECT_STORAGE_PREFIX", "PR_OBJECT_PREFIX"),
    queueNamespace: envValue("PR_QUEUE_NAMESPACE", "PR_QUEUE_NS"),
    credentialRef: envValue("PR_CREDENTIAL_REF", "PR_CREDENTIAL_NAMESPACE")
  };
  assertPrEnvironment(actual, { pullRequestNumber: options.pullRequestNumber, headSha: options.headSha });
  for (const field of Object.keys(expected)) {
    if (field !== "token" && actual[field] !== expected[field]) throw new Error(`${field} does not match the derived PR namespace`);
  }
  return actual;
}

let options;
try {
  options = parse(process.argv.slice(2));
  const environment = buildPrEnvironment(options.pullRequestNumber, options.headSha);
  if (options.manifest) {
    const manifest = readJson(options.manifest);
    const declared = manifest.prEnvironment || manifest.implementation?.prEnvironment;
    assertPrEnvironment(declared, { pullRequestNumber: options.pullRequestNumber, headSha: options.headSha });
  }
  if (options.checkEnv) checkProcessEnvironment(environment);
  const output = {
    schemaVersion: "implementation-pr-environment.v1",
    pullRequestNumber: Number(options.pullRequestNumber),
    headSha: String(options.headSha).toLowerCase(),
    ...environment,
    provisioningReceipt: null,
    provisioningMode: "descriptor-only-provider-hook-required",
    productionCredentialsAllowed: false,
    createdAt: new Date().toISOString()
  };
  if (options.output) writeJson(options.output, output);
  if (options.githubOutput && process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(output)
      .filter(([key]) => ["id", "isolationKey", "databaseSchema", "objectStoragePrefix", "queueNamespace", "credentialRef", "token"].includes(key))
      .map(([key, value]) => `${key}=${value}`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
  }
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(`PR environment provisioning FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  usage();
  process.exit(1);
}
