#!/usr/bin/env node
import process from "node:process";
import fs from "node:fs";
import {
  DEFAULT_BASELINE_SNAPSHOT_ID,
  formatValidationErrors,
  readJson,
  validatePrEvidence,
  writeJson
} from "./lib/quality-gate.mjs";

function usage() {
  console.error(`Usage: node scripts/quality-gate/verify-pr-evidence.mjs --manifest <path> [options]

Options:
  --manifest <path>       PR quality evidence JSON (required)
  --baseline <snapshot>   Expected baselineSnapshotId (default: ${DEFAULT_BASELINE_SNAPSHOT_ID})
  --pr-number <number>    Validate deterministic PR environment derivation
  --head-sha <sha>        Validate deterministic PR environment derivation
  --policy <path>         Policy JSON (default: quality-gates/policy.json)
  --report <path>         Write a machine-readable validation report
  --candidate              Fail unless all candidate conditions are met
  --github-output         Append candidate status to $GITHUB_OUTPUT when available`);
}

function args(argv) {
  const result = { manifest: null, baseline: DEFAULT_BASELINE_SNAPSHOT_ID, report: null, policy: "quality-gates/policy.json", githubOutput: false, candidate: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") result.manifest = argv[++index];
    else if (value === "--baseline") result.baseline = argv[++index];
    else if (value === "--pr-number") result.pullRequestNumber = argv[++index];
    else if (value === "--head-sha") result.headSha = argv[++index];
    else if (value === "--policy") result.policy = argv[++index];
    else if (value === "--report") result.report = argv[++index];
    else if (value === "--candidate") result.candidate = true;
    else if (value === "--github-output") result.githubOutput = true;
    else if (value === "--help" || value === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${value}`);
  }
  return result;
}

function appendGithubOutput(result) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = [
    `quality_valid=${result.valid}`,
    `candidate_eligible=${result.candidateEligible}`,
    `quality_error_count=${result.errors.length}`
  ];
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`, "utf8");
}

let options;
try {
  options = args(process.argv.slice(2));
  if (!options.manifest) throw new Error("--manifest is required");
  const manifest = readJson(options.manifest);
  const policy = readJson(options.policy);
  const result = validatePrEvidence(manifest, {
    expectedBaselineSnapshotId: options.baseline || policy.baseline?.baselineSnapshotId,
    expectedSourceTag: policy.baseline?.sourceTag,
    expectedSourceVersion: policy.baseline?.sourceVersion,
    requiredSchemaVersion: policy.schema?.requiredVersion || "draft-0.1.0",
    pullRequestNumber: options.pullRequestNumber,
    headSha: options.headSha
  });
  const report = {
    gateVersion: result.gateVersion,
    manifest: options.manifest,
    valid: result.valid,
    candidateEligible: result.candidateEligible,
    requiredChecks: result.requiredChecks,
    candidateGates: result.candidateGates,
    errors: result.errors,
    policyVersion: policy.policyVersion || null,
    checkedAt: new Date().toISOString()
  };
  if (options.report) writeJson(options.report, report);
  if (options.githubOutput) appendGithubOutput(result);
  if (!result.valid) {
    console.error("Implementation quality evidence FAILED (fail-closed):");
    console.error(formatValidationErrors(result.errors));
    process.exit(1);
  }
  if (options.candidate && !result.candidateEligible) {
    console.error("Implementation candidate gate FAILED: S001, security, recovery and all required checks must pass.");
    process.exit(1);
  }
  console.log(`Implementation quality evidence verified; candidateEligible=${result.candidateEligible}.`);
} catch (error) {
  console.error(`Implementation quality evidence FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  usage();
  process.exit(1);
}
