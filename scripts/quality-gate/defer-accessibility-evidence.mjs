#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  assertRecordBinding,
  baseReceipt,
  bindingFromRuntime,
  publicError,
  readJsonSource,
  relativePath,
  writeJson
} from "./lib/quality-probe-common.mjs";

const UI_PATH = /^(?:apps\/web\/|src\/(?:ui|components)\/|designs\/prototype-releases\/v1\.1\.0\/)/;

function parse(argv) {
  const result = { base: "origin/main" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--runtime") result.runtime = argv[++index];
    else if (value === "--finding") result.finding = argv[++index];
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--base") result.base = argv[++index];
    else if (value === "--help" || value === "-h") result.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  for (const field of ["runtime", "finding", "output"]) if (!result[field]) throw new Error(`--${field} is required`);
  return result;
}

function usage() {
  console.error("Usage: node defer-accessibility-evidence.mjs --runtime path --finding path --output path [--base origin/main]");
}

function uiChanges(base) {
  const result = spawnSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`cannot determine UI change scope: ${String(result.stderr || "git diff failed").trim()}`);
  return String(result.stdout || "").split(/\r?\n/).filter(Boolean).filter((file) => UI_PATH.test(file));
}

export function createBackendAccessibilityDeferral(input) {
  const binding = bindingFromRuntime(input.runtime, input.env);
  assertRecordBinding(input.finding.value, binding, "accessibility finding");
  const finding = input.finding.value;
  if (finding.status !== "blocked" || finding.productionEvidence !== true || finding.axe?.executed !== true
      || !(Number(finding.violations) > 0 || finding.blockedReasons?.includes("axe-violations"))) {
    throw new Error("finding must be a real axe receipt blocked by an actual accessibility violation");
  }
  if (input.uiChangePaths.length) throw new Error(`backend-only deferral is forbidden for UI changes: ${input.uiChangePaths.join(", ")}`);
  return baseReceipt("accessibility", binding, {
    status: "not-applicable",
    evidence: relativePath(input.output),
    reason: "This implementation slice changes backend/runtime infrastructure only; the real baseline finding is retained for the first UI candidate.",
    scope: "backend-only",
    uiChangesDetected: false,
    uiChangePaths: [],
    nextGate: "first-ui-candidate",
    findingEvidence: {
      path: input.finding.path,
      sha256: input.finding.sha256,
      receiptId: finding.receiptId,
      pullRequestNumber: binding.pullRequest.number,
      headSha: binding.pullRequest.headSha,
      environmentId: binding.environmentId,
      implementationRoundId: binding.implementationRoundId
    }
  });
}

async function main(options) {
  const runtime = readJsonSource(options.runtime);
  const finding = readJsonSource(options.finding);
  const receipt = createBackendAccessibilityDeferral({
    runtime: runtime.value,
    finding,
    output: options.output,
    uiChangePaths: uiChanges(options.base)
  });
  writeJson(options.output, receipt);
  console.log(`Backend accessibility deferred with digest-bound finding: ${options.output}`);
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  try {
    const options = parse(process.argv.slice(2));
    if (options.help) { usage(); process.exit(0); }
    await main(options);
  } catch (error) {
    console.error(`Accessibility deferral FAILED: ${publicError(error)}`);
    usage();
    process.exit(1);
  }
}
