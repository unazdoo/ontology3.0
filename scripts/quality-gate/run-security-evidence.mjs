#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
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

function usage() {
  console.error(`Usage: node scripts/quality-gate/run-security-evidence.mjs [options]

Required:
  --runtime <path>              Passed real-runtime receipt
  --secret-scan <path>          Secret scan JSON
  --npm-audit <path>            npm audit --json output
  --permission-negative <path>  Runtime permission-negative receipt
  --output <path>               Aggregated security receipt`);
}

function parse(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--runtime") result.runtime = argv[++index];
    else if (value === "--secret-scan") result.secretScan = argv[++index];
    else if (value === "--npm-audit") result.npmAudit = argv[++index];
    else if (value === "--permission-negative") result.permissionNegative = argv[++index];
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--help" || value === "-h") result.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  for (const field of ["runtime", "secretScan", "npmAudit", "permissionNegative", "output"]) if (!result[field]) throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
  return result;
}

function vulnerabilityCounts(audit) {
  if (Number(audit?.auditReportVersion) < 2 || !audit?.metadata?.vulnerabilities || typeof audit.metadata.vulnerabilities !== "object") {
    throw new Error("npm audit receipt must be auditReportVersion 2 with metadata.vulnerabilities");
  }
  const values = audit.metadata.vulnerabilities;
  const result = {};
  for (const key of ["info", "low", "moderate", "high", "critical", "total"]) {
    const value = Number(values[key]);
    if (!Number.isInteger(value) || value < 0) throw new Error(`npm audit vulnerability count ${key} is invalid`);
    result[key] = value;
  }
  return result;
}

function permissionCoverage(receipt) {
  const cases = Array.isArray(receipt.deniedCases) ? receipt.deniedCases.map((entry) => String(typeof entry === "string" ? entry : entry.id || entry.caseId || entry.reasonCode || "").toLowerCase()) : [];
  const required = {
    unauthorizedOwner: (value) => /owner|permission|unauthor|forbidden/.test(value),
    crossScenario: (value) => /cross[-_ ]?scenario|scenario[-_ ]?mismatch/.test(value),
    privilegeEscalation: (value) => /privilege|role|scope|resource/.test(value)
  };
  const coverage = Object.fromEntries(Object.entries(required).map(([key, matcher]) => [key, cases.some(matcher)]));
  return { cases, coverage, complete: Object.values(coverage).every(Boolean) };
}

export function evaluateSecurityEvidence(inputs) {
  const binding = bindingFromRuntime(inputs.runtime, inputs.env);
  const errors = [];
  const secret = inputs.secretScan.value;
  const audit = inputs.npmAudit.value;
  const permission = inputs.permissionNegative.value;
  let counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  const permissions = permissionCoverage(permission);

  if (secret.status !== "passed" || !Array.isArray(secret.findings) || secret.findings.length !== 0) errors.push({ source: "secret-scan", message: "secret scan has findings or did not pass" });
  try {
    counts = vulnerabilityCounts(audit);
    if (counts.high !== 0 || counts.critical !== 0) throw new Error(`npm audit has high=${counts.high}, critical=${counts.critical}`);
  } catch (error) {
    errors.push({ source: "npm-audit", message: publicError(error) });
  }
  try {
    assertRecordBinding(permission, binding, "permission-negative receipt", { requireTrace: false });
    if (!new Set(["passed", "verified"]).has(permission.status) || permission.productionEvidence !== true || !permissions.complete) throw new Error("permission-negative receipt lacks passed owner/scenario/privilege coverage");
  } catch (error) {
    errors.push({ source: "permission-negative", message: publicError(error) });
  }
  const passed = errors.length === 0;
  return baseReceipt("security", binding, {
    status: passed ? "passed" : "blocked",
    evidence: relativePath(inputs.output),
    unresolvedCritical: counts.critical,
    unresolvedHigh: counts.high,
    findings: { critical: counts.critical, high: counts.high },
    secretScan: { status: secret.status, findingCount: secret.findings?.length ?? null, sha256: inputs.secretScan.sha256, source: inputs.secretScan.path },
    dependencyAudit: { status: counts.high === 0 && counts.critical === 0 ? "verified" : "blocked", vulnerabilities: counts, sha256: inputs.npmAudit.sha256, source: inputs.npmAudit.path },
    permissionNegative: { status: permissions.complete ? "verified" : "blocked", deniedCaseCount: permissions.cases.length, coverage: permissions.coverage, sha256: inputs.permissionNegative.sha256, source: inputs.permissionNegative.path },
    errors,
    sources: { runtime: inputs.runtimeSource, secretScan: inputs.secretScan.path, npmAudit: inputs.npmAudit.path, permissionNegative: inputs.permissionNegative.path }
  });
}

async function main(options) {
  const runtimeSource = readJsonSource(options.runtime);
  const inputs = {
    ...options,
    runtime: runtimeSource.value,
    runtimeSource: { path: runtimeSource.path, sha256: runtimeSource.sha256 },
    secretScan: readJsonSource(options.secretScan),
    npmAudit: readJsonSource(options.npmAudit),
    permissionNegative: readJsonSource(options.permissionNegative)
  };
  const receipt = evaluateSecurityEvidence(inputs);
  writeJson(options.output, receipt);
  if (receipt.status !== "passed") throw new Error(`security evidence blocked: ${receipt.errors.map((entry) => entry.source).join(",")}`);
  console.log(`Security evidence passed: ${options.output}`);
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  try {
    const options = parse(process.argv.slice(2));
    if (options.help) { usage(); process.exit(0); }
    await main(options);
  } catch (error) {
    console.error(`Security evidence FAILED: ${publicError(error)}`);
    usage();
    process.exit(1);
  }
}
