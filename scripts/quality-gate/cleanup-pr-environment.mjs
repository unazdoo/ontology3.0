#!/usr/bin/env node
import process from "node:process";
import { assertPrEnvironment, formatValidationErrors, readJson, writeJson } from "./lib/quality-gate.mjs";
import { cleanupLiveEnvironment } from "./lib/pr-environment-provider.mjs";

function parse(argv) {
  const result = { descriptor: null, receipt: null, output: "artifacts/pr-environment-cleanup.json", roundId: process.env.IMPLEMENTATION_ROUND_ID || null, execute: false, live: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--descriptor") result.descriptor = argv[++i];
    else if (argv[i] === "--receipt") result.receipt = argv[++i];
    else if (argv[i] === "--output") result.output = argv[++i];
    else if (argv[i] === "--round-id") result.roundId = argv[++i];
    else if (argv[i] === "--execute") result.execute = true;
    else if (argv[i] === "--live") result.live = true;
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/cleanup-pr-environment.mjs --descriptor path [--live --execute --receipt path --round-id id] [--output path]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!result.descriptor) throw new Error("--descriptor is required");
  if (result.live && (!result.execute || !result.receipt)) throw new Error("live cleanup requires --execute and --receipt");
  if (result.execute && !result.live) throw new Error("--execute requires --live");
  return result;
}

let options;
try {
  options = parse(process.argv.slice(2));
  const descriptor = readJson(options.descriptor);
  assertPrEnvironment(descriptor);
  if (options.live) {
    if (process.env.ALLOW_PR_ENV_CLEANUP !== "1") throw new Error("live cleanup requires ALLOW_PR_ENV_CLEANUP=1");
    try {
      const receipt = await cleanupLiveEnvironment({ descriptor, receipt: readJson(options.receipt), roundId: options.roundId || undefined });
      writeJson(options.output, receipt);
      console.log(`PR environment cleanup completed: ${descriptor.id}`);
    } catch (error) {
      if (error.receipt) writeJson(options.output, error.receipt);
      throw error;
    }
  } else {
    const receipt = {
      schemaVersion: "implementation-pr-environment-cleanup.v1",
      environmentId: descriptor.id,
      resources: {
        databaseSchema: descriptor.databaseSchema,
        objectStoragePrefix: descriptor.objectStoragePrefix,
        queueNamespace: descriptor.queueNamespace,
        credentialRef: descriptor.credentialRef
      },
      status: "planned",
      productionEvidence: false,
      scopedDeletionPerformed: false,
      destructiveActionsPerformed: false,
      evidence: "artifact://pr-environment-cleanup.json",
      formedAt: new Date().toISOString()
    };
    writeJson(options.output, receipt);
    console.log(`PR environment cleanup planned: ${descriptor.id}`);
  }
} catch (error) {
  console.error(`PR environment cleanup FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  process.exit(1);
}
