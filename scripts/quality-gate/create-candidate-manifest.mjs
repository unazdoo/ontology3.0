#!/usr/bin/env node
import process from "node:process";
import { DEFAULT_BASELINE_SNAPSHOT_ID, formatValidationErrors, readJson, validatePrEvidence, writeJson } from "./lib/quality-gate.mjs";

function parse(argv) {
  const result = { evidence: null, output: "artifacts/implementation-candidate.json", baseline: DEFAULT_BASELINE_SNAPSHOT_ID };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--evidence" || argv[i] === "--manifest") result.evidence = argv[++i];
    else if (argv[i] === "--output") result.output = argv[++i];
    else if (argv[i] === "--baseline") result.baseline = argv[++i];
    else if (argv[i] === "--pr-number") result.pullRequestNumber = argv[++i];
    else if (argv[i] === "--head-sha") result.headSha = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/create-candidate-manifest.mjs --evidence pr-quality.json [--output path]");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!result.evidence) throw new Error("--evidence is required");
  return result;
}

try {
  const options = parse(process.argv.slice(2));
  const evidence = readJson(options.evidence);
  const result = validatePrEvidence(evidence, {
    expectedBaselineSnapshotId: options.baseline,
    pullRequestNumber: options.pullRequestNumber,
    headSha: options.headSha
  });
  if (!result.valid || !result.candidateEligible) {
    const details = result.errors.length ? formatValidationErrors(result.errors) : "all gates are not passed";
    throw new Error(`implementation candidate is blocked:\n${details}`);
  }
  const candidate = {
    manifestVersion: "implementation-candidate.v1",
    status: "implementation-candidate",
    baselineSnapshotId: evidence.baselineSnapshotId,
    sourceTag: evidence.sourceTag,
    sourceVersion: evidence.sourceVersion,
    implementationVersion: evidence.implementationVersion,
    schemaVersion: evidence.schemaVersion,
    owner: evidence.owner,
    commitSha: evidence.pullRequest?.headSha || evidence.commitSha || null,
    environmentId: evidence.prEnvironment?.id || null,
    realRunIds: evidence.realRunIds || [evidence.runtimeRunId],
    candidateGates: evidence.candidateGates,
    evidenceManifest: options.evidence,
    generatedAt: new Date().toISOString()
  };
  writeJson(options.output, candidate);
  console.log(`Implementation candidate created: ${options.output}`);
} catch (error) {
  console.error(`Implementation candidate creation FAILED: ${error.message}`);
  process.exit(1);
}
