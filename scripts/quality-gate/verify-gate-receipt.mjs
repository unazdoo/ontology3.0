#!/usr/bin/env node
import process from "node:process";
import { DIAGNOSTIC_CHECKS, formatValidationErrors, nonEmpty, readJson, writeJson } from "./lib/quality-gate.mjs";

const GATE_KEYS = Object.freeze({
  "golden-data": "goldenData",
  "contract-compatibility": "contractCompatibility",
  e2e: "e2e",
  "permission-negative": "permissionNegative",
  "concurrency-idempotency": "concurrencyIdempotency",
  performance: "performance",
  accessibility: "accessibility",
  security: "security",
  sbom: "sbom",
  observability: "observability",
  "c034-recovery": "c034Recovery",
  migration: "migration",
  rollback: "rollback",
  "ci-cd": "ciCd"
});

function usage() {
  console.error(`Usage: node scripts/quality-gate/verify-gate-receipt.mjs --manifest <path> --gate <name> [options]

Gate names match the CI matrix: ${Object.keys(GATE_KEYS).join(", ")}
  --report <path>       Write a machine-readable receipt report`);
}
function parse(argv) {
  const result = { manifest: null, gate: null, report: null };
  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === "--manifest") result.manifest = argv[++i];
    else if (option === "--gate") result.gate = argv[++i];
    else if (option === "--report") result.report = argv[++i];
    else if (option === "--help" || option === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${option}`);
  }
  if (!result.manifest || !result.gate) throw new Error("--manifest and --gate are required");
  if (!GATE_KEYS[result.gate]) throw new Error(`unknown gate: ${result.gate}`);
  return result;
}

function fail(details) {
  const error = new Error("quality gate receipt failed");
  error.details = details;
  throw error;
}

function required(value, path, errors) {
  if (value === undefined || value === null || value === "") errors.push({ code: "GATE_DETAIL_MISSING", path, message: "required gate detail is missing" });
}

function validateGateDetails(key, receipt, errors) {
  if (key === "goldenData") required(receipt.sha256 || receipt.hash || receipt.manifestSha256, "sha256", errors);
  if (key === "contractCompatibility") {
    required(receipt.compatibility || receipt.schemaCompatibility, "compatibility", errors);
    for (const field of ["idempotencyContractVerified", "c033ContractVerified", "ownerBoundaryVerified", "exactVersionContractVerified"]) {
      if (receipt[field] !== true) errors.push({ code: "CONTRACT_SAFETY_SUBEVIDENCE_MISSING", path: field, message: `${field} must be true` });
    }
  }
  if (key === "e2e") {
    required(receipt.scenarioId, "scenarioId", errors);
    required(receipt.runtimeRunId || receipt.runId, "runtimeRunId", errors);
    if (receipt.scenarioId !== "S001") errors.push({ code: "E2E_SCENARIO_INVALID", path: "scenarioId", message: "E2E gate must cover S001" });
    for (const field of ["sameKeySameContentOnce", "sameKeyDifferentContentRejected", "casConflictRejected", "outboxDuplicateSuppressed", "inboxDuplicateSuppressed", "retryNoDuplicateSideEffects"]) {
      if (receipt.idempotency?.[field] !== true) errors.push({ code: "E2E_IDEMPOTENCY_SUBEVIDENCE_MISSING", path: `idempotency.${field}`, message: `${field} must be true` });
    }
    for (const field of ["c033Verified", "ownerBoundaryVerified", "exactVersionsVerified"]) if (receipt[field] !== true) errors.push({ code: "E2E_AUTHORITY_SUBEVIDENCE_MISSING", path: field, message: `${field} must be true` });
  }
  if (key === "permissionNegative") {
    if (!Array.isArray(receipt.deniedCases || receipt.negativeCases) || (receipt.deniedCases || receipt.negativeCases).length === 0) errors.push({ code: "PERMISSION_CASES_MISSING", path: "deniedCases", message: "permission-denied cases are required" });
  }
  if (key === "concurrencyIdempotency") {
    for (const field of ["duplicateSuppressed", "raceCovered", "retryCovered"]) if (receipt[field] !== true) errors.push({ code: "CONCURRENCY_DETAIL_MISSING", path: field, message: `${field} must be true` });
  }
  if (key === "performance") {
    const p95 = receipt.p95Ms ?? receipt.metrics?.p95Ms;
    const slo = receipt.sloMs ?? receipt.metrics?.sloMs;
    required(p95, "metrics.p95Ms", errors); required(slo, "metrics.sloMs", errors);
    if (Number.isFinite(Number(p95)) && Number.isFinite(Number(slo)) && Number(p95) > Number(slo)) errors.push({ code: "PERFORMANCE_SLO_BREACH", path: "metrics.p95Ms", message: "p95 exceeds SLO" });
  }
  if (key === "accessibility") {
    required(receipt.standard, "standard", errors);
    if (Number(receipt.violations ?? receipt.results?.violations) !== 0) errors.push({ code: "ACCESSIBILITY_VIOLATIONS", path: "violations", message: "violations must be zero" });
    if (receipt.keyboard !== true && receipt.results?.keyboard !== true) errors.push({ code: "ACCESSIBILITY_KEYBOARD_MISSING", path: "keyboard", message: "keyboard evidence is required" });
  }
  if (key === "security") {
    if (Number(receipt.unresolvedCritical ?? receipt.findings?.critical ?? 0) !== 0) errors.push({ code: "SECURITY_CRITICAL_FINDINGS", path: "unresolvedCritical", message: "unresolved critical findings must be zero" });
    if (Number(receipt.unresolvedHigh ?? receipt.findings?.high ?? 0) !== 0) errors.push({ code: "SECURITY_HIGH_FINDINGS", path: "unresolvedHigh", message: "unresolved high findings must be zero" });
    if (receipt.secretScan?.status !== "passed" || Number(receipt.secretScan?.findingCount) !== 0) errors.push({ code: "SECURITY_SECRET_SCAN_MISSING", path: "secretScan", message: "a clean secret scan receipt is required" });
    if (receipt.dependencyAudit?.status !== "verified" || Number(receipt.dependencyAudit?.vulnerabilities?.high) !== 0 || Number(receipt.dependencyAudit?.vulnerabilities?.critical) !== 0) errors.push({ code: "SECURITY_DEPENDENCY_AUDIT_MISSING", path: "dependencyAudit", message: "npm audit must prove zero high/critical vulnerabilities" });
  }
  if (key === "sbom") { required(receipt.format, "format", errors); required(receipt.sha256 || receipt.sbomSha256, "sha256", errors); }
  if (key === "observability") for (const field of ["logs", "metrics", "traces", "alerts"]) if (receipt[field] !== true && receipt[field]?.status !== "verified") errors.push({ code: "OBSERVABILITY_DETAIL_MISSING", path: field, message: `${field} evidence is required` });
  if (key === "c034Recovery") {
    required(receipt.receiptId || receipt.recoveryReceiptId, "receiptId", errors);
    if (receipt.sideEffectsSuppressed !== true) errors.push({ code: "RECOVERY_SIDE_EFFECTS_UNSAFE", path: "sideEffectsSuppressed", message: "historical side effects must be suppressed" });
    if (receipt.newScenarioRunId === false) errors.push({ code: "RECOVERY_RUN_NOT_CLONED", path: "newScenarioRunId", message: "recovery must create a new run" });
  }
  if (key === "migration") { required(receipt.up, "up", errors); required(receipt.down, "down", errors); }
  if (key === "rollback") required(receipt.targetVersion || receipt.targetSnapshotId, "targetVersion", errors);
  if (key === "ciCd") required(receipt.workflowRunId || receipt.pipelineRunId, "workflowRunId", errors);
}

function validateDiagnosticDisposition(key, receipt, errors) {
  if (!["blocked", "not-applicable"].includes(receipt.status)) return;
  if (!nonEmpty(receipt.reason)) errors.push({ code: "DIAGNOSTIC_REASON_MISSING", path: "reason", message: `${receipt.status} diagnostic requires a reason` });
  if (key === "accessibility" && receipt.status === "not-applicable") {
    if (receipt.scope !== "backend-only" || receipt.uiChangesDetected !== false || receipt.nextGate !== "first-ui-candidate" || !receipt.findingEvidence) {
      errors.push({ code: "ACCESSIBILITY_DEFER_INVALID", path: "checks.accessibility", message: "backend-only deferral requires scope, no UI changes, real findingEvidence, and nextGate=first-ui-candidate" });
    }
  }
}

let options;
try {
  options = parse(process.argv.slice(2));
  const manifest = readJson(options.manifest);
  const checks = manifest.checks || manifest.gates || manifest.qualityChecks || manifest.implementation?.checks;
  const key = GATE_KEYS[options.gate];
  const receipt = checks?.[key];
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    errors.push({ code: "GATE_RECEIPT_MISSING", path: `checks.${key}`, message: `${options.gate} receipt is required` });
  } else {
    const diagnostic = DIAGNOSTIC_CHECKS.includes(key);
    const allowedStatuses = diagnostic ? ["passed", "verified", "blocked", "not-applicable"] : ["passed", "verified"];
    if (!allowedStatuses.includes(receipt.status)) {
      errors.push({ code: "GATE_RECEIPT_NOT_PASSED", path: `checks.${key}.status`, message: diagnostic ? "diagnostic status must be passed, verified, blocked, or not-applicable" : "hard gate status must be passed or verified" });
    }
    const evidence = receipt.evidence || receipt.evidenceUri || receipt.receiptUri;
    if (!nonEmpty(evidence)) errors.push({ code: "GATE_RECEIPT_EVIDENCE_MISSING", path: `checks.${key}.evidence`, message: "durable evidence URI/path is required" });
    if (nonEmpty(evidence) && /(?:placeholder|example|fixture|fake|todo|tbd|local-only)/i.test(evidence)) {
      errors.push({ code: "GATE_RECEIPT_PLACEHOLDER", path: `checks.${key}.evidence`, message: "placeholder/fixture/local-only evidence cannot close a gate" });
    }
    if (receipt.runId && /(?:example|fixture|fake|historical|prototype)/i.test(String(receipt.runId))) {
      errors.push({ code: "GATE_RECEIPT_RUN_INVALID", path: `checks.${key}.runId`, message: "real runtime ID is required" });
    }
    validateDiagnosticDisposition(key, receipt, errors);
    if (["passed", "verified"].includes(receipt.status)) validateGateDetails(key, receipt, errors);
  }
  if (errors.length) fail(errors);
  const report = {
    schemaVersion: "implementation-quality-gate-receipt.v1",
    gate: options.gate,
    checkKey: key,
    status: receipt.status,
    evidence: receipt.evidence || receipt.evidenceUri || receipt.receiptUri,
    runtimeRunId: receipt.runId || receipt.runtimeRunId || null,
    valid: true
  };
  if (options.report) writeJson(options.report, report);
  console.log(`${options.gate} receipt verified: ${report.evidence}`);
} catch (error) {
  console.error(`Quality gate receipt FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  usage();
  process.exit(1);
}
