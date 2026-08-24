#!/usr/bin/env node
import process from "node:process";
import { formatValidationErrors, nonEmpty, readJson, writeJson } from "./lib/quality-gate.mjs";

const KINDS = new Set(["performance", "accessibility", "observability", "security", "sbom", "concurrency-idempotency", "permission-negative", "e2e"]);

function parse(argv) {
  const result = { receipt: null, kind: null, report: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--receipt") result.receipt = argv[++i];
    else if (argv[i] === "--kind") result.kind = argv[++i];
    else if (argv[i] === "--report") result.report = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: node scripts/quality-gate/verify-nfr-receipt.mjs --kind performance|accessibility|observability|security|sbom|concurrency-idempotency|permission-negative|e2e --receipt path");
      process.exit(0);
    } else throw new Error(`Unknown option: ${argv[i]}`);
  }
  if (!result.receipt || !KINDS.has(result.kind)) throw new Error("--receipt and a supported --kind are required");
  return result;
}

function required(value, path, errors) {
  if (value === undefined || value === null || value === "") errors.push({ path, message: "required evidence is missing" });
}

try {
  const options = parse(process.argv.slice(2));
  const receipt = readJson(options.receipt);
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) errors.push({ path: "$", message: "receipt must be an object" });
  else {
    if (!["passed", "verified"].includes(receipt.status)) errors.push({ path: "status", message: "receipt must be passed or verified" });
    required(receipt.evidence || receipt.evidenceUri || receipt.receiptUri, "evidence", errors);
    if (options.kind === "performance") {
      required(receipt.p95Ms ?? receipt.metrics?.p95Ms, "metrics.p95Ms", errors);
      required(receipt.sloMs ?? receipt.metrics?.sloMs, "metrics.sloMs", errors);
      if (Number(receipt.p95Ms ?? receipt.metrics?.p95Ms) > Number(receipt.sloMs ?? receipt.metrics?.sloMs)) errors.push({ path: "metrics.p95Ms", message: "p95 exceeds SLO" });
    } else if (options.kind === "accessibility") {
      required(receipt.standard, "standard", errors);
      if (Number(receipt.violations ?? receipt.results?.violations) !== 0) errors.push({ path: "violations", message: "accessibility violations must be zero" });
      if (receipt.keyboard !== true && receipt.results?.keyboard !== true) errors.push({ path: "keyboard", message: "keyboard path evidence is required" });
    } else if (options.kind === "observability") {
      for (const field of ["logs", "metrics", "traces", "alerts"]) if (receipt[field] !== true && receipt[field]?.status !== "verified") errors.push({ path: field, message: `${field} evidence is required` });
    } else if (options.kind === "security") {
      if (Number(receipt.unresolvedCritical ?? receipt.findings?.critical ?? 0) !== 0) errors.push({ path: "unresolvedCritical", message: "unresolved critical findings must be zero" });
      if (Number(receipt.unresolvedHigh ?? receipt.findings?.high ?? 0) !== 0) errors.push({ path: "unresolvedHigh", message: "unresolved high findings must be zero" });
    } else if (options.kind === "sbom") {
      required(receipt.format, "format", errors);
      required(receipt.sha256 || receipt.sbomSha256, "sha256", errors);
    } else if (options.kind === "concurrency-idempotency") {
      for (const field of ["duplicateSuppressed", "raceCovered", "retryCovered"]) if (receipt[field] !== true) errors.push({ path: field, message: `${field} evidence is required` });
    } else if (options.kind === "permission-negative") {
      if (!Array.isArray(receipt.deniedCases) || receipt.deniedCases.length === 0) errors.push({ path: "deniedCases", message: "at least one denied case is required" });
    } else if (options.kind === "e2e") {
      required(receipt.scenarioId, "scenarioId", errors);
      required(receipt.runtimeRunId || receipt.runId, "runtimeRunId", errors);
      if (receipt.scenarioId !== "S001") errors.push({ path: "scenarioId", message: "candidate E2E must be S001" });
    }
  }
  const report = { schemaVersion: "implementation-nfr-receipt.v1", kind: options.kind, status: errors.length ? "failed" : "passed", valid: errors.length === 0, errors };
  if (options.report) writeJson(options.report, report);
  if (errors.length) {
    console.error(`NFR receipt FAILED:\n${formatValidationErrors(errors)}`);
    process.exit(1);
  }
  console.log(`${options.kind} receipt passed.`);
} catch (error) {
  console.error(`NFR receipt FAILED: ${error.message}`);
  process.exit(1);
}
