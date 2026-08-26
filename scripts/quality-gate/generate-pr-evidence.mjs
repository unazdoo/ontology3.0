#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_BASELINE_SNAPSHOT_ID,
  QUALITY_GATE_VERSION,
  REQUIRED_CHECKS,
  REQUIRED_RECEIPT_ROLES,
  buildPrEnvironment,
  formatValidationErrors,
  readJson,
  sha256,
  validatePrEvidence,
  writeJson
} from "./lib/quality-gate.mjs";

const DEFAULT_OUTPUT = "implementation/evidence/pr-quality.json";

function usage() {
  console.error(`Usage: node scripts/quality-gate/generate-pr-evidence.mjs [options]

Required:
  --metadata <path>       Stable manifest metadata JSON
  --index <path>          Receipt index JSON
  --pr-number <number>    Pull request number (or PR_NUMBER)
  --head-sha <sha>        Exact pull request head SHA (or HEAD_SHA)
  --round-id <id>         One CI implementation round (or IMPLEMENTATION_ROUND_ID)

Options:
  --receipt-root <path>   Root for index and receipt paths (default: current directory)
  --output <path>         Canonical manifest output (default: ${DEFAULT_OUTPUT})

The index must contain ${REQUIRED_RECEIPT_ROLES.join(", ")} and checks.{${REQUIRED_CHECKS.join(",")}}.`);
}

function parse(argv) {
  const result = {
    receiptRoot: process.cwd(),
    output: DEFAULT_OUTPUT,
    pullRequestNumber: process.env.PR_NUMBER,
    headSha: process.env.HEAD_SHA,
    implementationRoundId: process.env.IMPLEMENTATION_ROUND_ID
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--metadata") result.metadata = argv[++index];
    else if (value === "--index") result.index = argv[++index];
    else if (value === "--receipt-root") result.receiptRoot = argv[++index];
    else if (value === "--output") result.output = argv[++index];
    else if (value === "--pr-number") result.pullRequestNumber = argv[++index];
    else if (value === "--head-sha") result.headSha = argv[++index];
    else if (value === "--round-id") result.implementationRoundId = argv[++index];
    else if (value === "--help" || value === "-h") { usage(); process.exit(0); }
    else throw new Error(`Unknown option: ${value}`);
  }
  for (const field of ["metadata", "index", "pullRequestNumber", "headSha", "implementationRoundId"]) {
    if (result[field] === undefined || result[field] === null || String(result[field]).trim() === "") throw new Error(`${field} is required`);
  }
  return result;
}

function safeRelative(value, label) {
  if (typeof value !== "string" || value.trim() === "" || path.isAbsolute(value) || value.includes("\\")) throw new Error(`${label} must be a repository-relative POSIX path`);
  const normalized = path.posix.normalize(value).replace(/^\.\//, "");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) throw new Error(`${label} escapes receipt-root`);
  return normalized;
}

function resolveInside(root, relative, label) {
  const normalized = safeRelative(relative, label);
  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, normalized);
  if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) throw new Error(`${label} escapes receipt-root`);
  return { normalized, resolved };
}

function readInput(root, filePath, label) {
  const located = resolveInside(root, filePath, label);
  return { value: readJson(located.resolved), ...located };
}

function receiptPath(index, role) {
  const value = role.startsWith("checks.")
    ? index.checks?.[role.slice("checks.".length)]
    : index[role];
  return typeof value === "string" ? value : value?.path;
}

function loadReceipt(root, index, role, binding) {
  const relative = receiptPath(index, role);
  if (!relative) throw new Error(`receipt index is missing ${role}`);
  const located = resolveInside(root, relative, `receipt ${role}`);
  const bytes = fs.readFileSync(located.resolved);
  let receipt;
  try {
    receipt = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`receipt ${role} is invalid JSON: ${error.message}`);
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || typeof receipt.receiptId !== "string" || receipt.receiptId.trim() === "") {
    throw new Error(`receipt ${role} must be an object with receiptId`);
  }
  const reference = {
    path: located.normalized,
    sha256: sha256(bytes),
    receiptId: receipt.receiptId,
    pullRequestNumber: Number(binding.pullRequestNumber),
    headSha: String(binding.headSha).toLowerCase(),
    environmentId: binding.environmentId,
    implementationRoundId: binding.implementationRoundId
  };
  return { receipt, reference };
}

function projection(loaded) {
  return {
    ...loaded.receipt,
    evidence: loaded.reference.path,
    receiptId: loaded.reference.receiptId,
    receiptSha256: loaded.reference.sha256
  };
}

function requiredMetadata(metadata) {
  for (const field of ["owner", "providers", "consumers"]) {
    if (metadata[field] === undefined || metadata[field] === null) throw new Error(`metadata.${field} is required`);
  }
}

function candidateGate(loaded, additions = {}) {
  return {
    status: loaded.receipt.status,
    evidence: loaded.reference.path,
    receiptId: loaded.reference.receiptId,
    receiptSha256: loaded.reference.sha256,
    roundId: loaded.receipt.implementationRoundId || loaded.receipt.roundId,
    ...additions
  };
}

try {
  const options = parse(process.argv.slice(2));
  const receiptRoot = path.resolve(options.receiptRoot);
  const metadata = readInput(receiptRoot, options.metadata, "metadata").value;
  const index = readInput(receiptRoot, options.index, "index").value;
  requiredMetadata(metadata);

  const environment = buildPrEnvironment(options.pullRequestNumber, options.headSha);
  const binding = {
    pullRequestNumber: Number(options.pullRequestNumber),
    headSha: String(options.headSha).toLowerCase(),
    environmentId: environment.id,
    implementationRoundId: String(options.implementationRoundId)
  };
  const loaded = {};
  for (const role of REQUIRED_RECEIPT_ROLES) loaded[role] = loadReceipt(receiptRoot, index, role, binding);
  loaded.checks = {};
  for (const check of REQUIRED_CHECKS) loaded.checks[check] = loadReceipt(receiptRoot, index, `checks.${check}`, binding);

  const runtime = loaded.runtime.receipt;
  const runtimeRunId = runtime.runtimeRunId || runtime.realRunId || runtime.realRunIds?.[0];
  const receipts = Object.fromEntries(REQUIRED_RECEIPT_ROLES.map((role) => [role, loaded[role].reference]));
  receipts.checks = Object.fromEntries(REQUIRED_CHECKS.map((check) => [check, loaded.checks[check].reference]));

  const manifest = {
    manifestVersion: "implementation-quality-evidence.v2",
    gateVersion: QUALITY_GATE_VERSION,
    baselineSnapshotId: metadata.baselineSnapshotId || DEFAULT_BASELINE_SNAPSHOT_ID,
    sourceTag: metadata.sourceTag || "prototype-v1.1.0-frozen",
    sourceVersion: metadata.sourceVersion || "v1.1.0",
    implementationVersion: metadata.implementationVersion || "implementation-0.1.0",
    implementationRoundId: binding.implementationRoundId,
    generatedAt: new Date().toISOString(),
    pullRequest: { number: binding.pullRequestNumber, headSha: binding.headSha },
    schemaVersion: metadata.schemaVersion || "draft-0.1.0",
    schemaVersions: metadata.schemaVersions || [metadata.schemaVersion || "draft-0.1.0"],
    schemaCompatibility: metadata.schemaCompatibility || { status: "exact" },
    owner: metadata.owner,
    providers: metadata.providers,
    consumers: metadata.consumers,
    databaseMigration: projection(loaded.databaseMigration),
    objectStorageFingerprint: projection(loaded.objectStorageFingerprint),
    rollback: projection(loaded.rollback),
    runtimeRunId,
    realRunIds: runtime.realRunIds || [runtimeRunId],
    runtimeRunIsReal: runtime.runtimeRunIsReal,
    audit: projection(loaded.audit),
    negativeTests: projection(loaded.negativeTests),
    recoveryReceipt: projection(loaded.recovery),
    prEnvironment: {
      ...environment,
      provisioningReceipt: loaded.provisioning.reference.path,
      provisioningReceiptSha256: loaded.provisioning.reference.sha256
    },
    checks: Object.fromEntries(REQUIRED_CHECKS.map((check) => [check, projection(loaded.checks[check])])),
    candidateGates: {
      s001VerticalSlice: candidateGate(loaded.runtime, {
        scenarioId: runtime.scenarioId,
        realRunId: runtimeRunId,
        order: runtime.order
      }),
      security: candidateGate(loaded.checks.security),
      recovery: candidateGate(loaded.recovery)
    },
    receipts
  };

  const output = path.resolve(options.output);
  const validation = validatePrEvidence(manifest, {
    expectedBaselineSnapshotId: manifest.baselineSnapshotId,
    expectedSourceTag: manifest.sourceTag,
    expectedSourceVersion: manifest.sourceVersion,
    requiredSchemaVersion: manifest.schemaVersion,
    pullRequestNumber: binding.pullRequestNumber,
    headSha: binding.headSha,
    receiptRoot,
    manifestPath: output
  });
  if (!validation.valid) throw Object.assign(new Error("aggregated receipts failed strict evidence validation"), { details: validation.errors });
  writeJson(output, manifest);
  console.log(`PR evidence generated from ${validation.receiptVerification.verifiedCount} digest-bound receipts: ${output}`);
} catch (error) {
  console.error(`PR evidence generation FAILED: ${error.message}`);
  if (error.details?.length) console.error(formatValidationErrors(error.details));
  usage();
  process.exit(1);
}
