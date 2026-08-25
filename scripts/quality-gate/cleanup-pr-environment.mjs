#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { assertPrEnvironment, formatValidationErrors, readJson, writeJson } from "./lib/quality-gate.mjs";

function parse(argv) {
  const result = { descriptor: null, output: "artifacts/pr-environment-cleanup.json", execute: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--descriptor") result.descriptor = argv[++i];
    else if (argv[i] === "--output") result.output = argv[++i];
    else if (argv[i] === "--execute") result.execute = true;
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/cleanup-pr-environment.mjs --descriptor path [--output path] [--execute]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!result.descriptor) throw new Error("--descriptor is required");
  return result;
}

try {
  const options = parse(process.argv.slice(2));
  const descriptor = readJson(options.descriptor);
  assertPrEnvironment(descriptor);
  if (options.execute && process.env.ALLOW_PR_ENV_CLEANUP !== "1") {
    throw new Error("--execute requires ALLOW_PR_ENV_CLEANUP=1; refusing unscoped deletion");
  }
  const receipt = {
    schemaVersion: "implementation-pr-environment-cleanup.v1",
    environmentId: descriptor.id,
    resources: {
      databaseSchema: descriptor.databaseSchema,
      objectStoragePrefix: descriptor.objectStoragePrefix,
      queueNamespace: descriptor.queueNamespace,
      credentialRef: descriptor.credentialRef
    },
    status: options.execute ? "requested" : "planned",
    destructiveActionsPerformed: false,
    evidence: "artifact://pr-environment-cleanup.json",
    formedAt: new Date().toISOString()
  };
  writeJson(options.output, receipt);
  console.log(`PR environment cleanup ${receipt.status}: ${descriptor.id}`);
} catch (error) {
  console.error(`PR environment cleanup FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  process.exit(1);
}
