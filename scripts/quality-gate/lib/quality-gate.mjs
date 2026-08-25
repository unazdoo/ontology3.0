import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Machine-readable implementation quality gate primitives.
 *
 * The implementation workspace has no service runtime yet.  These checks
 * therefore validate the evidence contract at the CI boundary and fail
 * closed when a team has not supplied a real receipt.  A green result means
 * the receipt is internally coherent; it does not manufacture runtime proof.
 */

export const QUALITY_GATE_VERSION = "implementation-quality-gate.v1";
export const DEFAULT_BASELINE_SNAPSHOT_ID = "BSL-OFW-V110-94ABD0E991B7";

export const REQUIRED_CHECKS = Object.freeze([
  "goldenData",
  "contractCompatibility",
  "e2e",
  "permissionNegative",
  "concurrencyIdempotency",
  "performance",
  "accessibility",
  "security",
  "sbom",
  "observability",
  "c034Recovery",
  "migration",
  "rollback",
  "ciCd"
]);

export const CANDIDATE_GATES = Object.freeze([
  "s001VerticalSlice",
  "security",
  "recovery"
]);

export const REQUIRED_RECEIPT_ROLES = Object.freeze([
  "provisioning",
  "databaseMigration",
  "objectStorageFingerprint",
  "rollback",
  "runtime",
  "audit",
  "negativeTests",
  "recovery"
]);

export const REQUIRED_NEGATIVE_CASES = Object.freeze([
  "missing-context",
  "unknown-schema",
  "unauthorized-owner",
  "cross-scenario",
  "duplicate-idempotency",
  "recovery-side-effect"
]);

const PASS_STATUSES = new Set(["passed", "verified"]);
const CHECK_STATUSES = new Set(["passed", "verified", "not-applicable"]);
const GATE_STATUSES = new Set(["passed", "verified", "blocked", "not-run"]);
const SHA256 = /^[a-f0-9]{64}$/i;
// Runtime IDs may be emitted by the scenario runtime (`S001-RUN-*`) or by a
// platform run service (`RUN-*`).  Both forms must be non-placeholder IDs.
const RUN_ID = /^(?:S[0-9]{3}-)?RUN-[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PR_NUMBER = /^[1-9][0-9]{0,8}$/;
const SHA = /^[a-f0-9]{7,64}$/i;
const FORBIDDEN_ENV_WORDS = /(^|[-_\/.])(prod(?:uction)?|shared|default|main)([-_\/.]|$)/i;
const FORBIDDEN_RECEIPT_MARKER = /(?:descriptor[-_ ]?only|fixture|fake|placeholder|prototype|historical|local[-_ ]?only)/i;
const LIVE_EVIDENCE_ROLES = new Set(["provisioning", "objectStorageFingerprint", "runtime", "audit", "recovery"]);

export class QualityGateError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = "QualityGateError";
    this.details = details;
  }
}

export function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function readJson(filePath) {
  const resolved = path.resolve(filePath);
  let text;
  try {
    text = fs.readFileSync(resolved, "utf8");
  } catch (error) {
    throw new QualityGateError(`Unable to read JSON file: ${resolved}`, [
      { code: "FILE_READ_FAILED", path: resolved, message: error.message }
    ]);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new QualityGateError(`Invalid JSON: ${resolved}`, [
      { code: "JSON_INVALID", path: resolved, message: error.message }
    ]);
  }
}

export function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function sha256(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  return crypto.createHash("sha256").update(input).digest("hex");
}

function receiptBinding(receipt) {
  return {
    pullRequestNumber: receipt?.pullRequest?.number ?? receipt?.pullRequestNumber,
    headSha: receipt?.pullRequest?.headSha ?? receipt?.headSha ?? receipt?.commitSha,
    environmentId: receipt?.environmentId ?? receipt?.prEnvironment?.id,
    implementationRoundId: receipt?.implementationRoundId ?? receipt?.roundId
  };
}

function normalizedReceiptPath(value) {
  if (!nonEmpty(value) || path.isAbsolute(value) || value.includes("\\")) return null;
  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) return null;
  return normalized.replace(/^\.\//, "");
}

function readBoundReceipt(reference, role, options, errors) {
  const field = `receipts.${role}`;
  if (!reference || typeof reference !== "object" || Array.isArray(reference)) {
    error(errors, "RECEIPT_REFERENCE_MISSING", field, `${role} receipt reference is required`);
    return null;
  }
  const relative = normalizedReceiptPath(reference.path);
  if (!relative) {
    error(errors, "RECEIPT_PATH_INVALID", `${field}.path`, "receipt path must be a repository-relative POSIX path without traversal");
    return null;
  }
  if (!SHA256.test(String(reference.sha256 || ""))) {
    error(errors, "RECEIPT_DIGEST_INVALID", `${field}.sha256`, "receipt reference needs a SHA-256 digest");
    return null;
  }
  const root = path.resolve(options.receiptRoot || process.cwd());
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    error(errors, "RECEIPT_PATH_OUTSIDE_ROOT", `${field}.path`, "receipt path escapes the configured receipt root");
    return null;
  }
  if (options.manifestPath && path.resolve(options.manifestPath) === resolved) {
    error(errors, "RECEIPT_MANIFEST_SELF_REFERENCE", `${field}.path`, "the evidence manifest cannot be its own source receipt");
    return null;
  }
  let bytes;
  let receipt;
  try {
    const rootReal = fs.realpathSync(root);
    const fileReal = fs.realpathSync(resolved);
    if (fileReal !== rootReal && !fileReal.startsWith(`${rootReal}${path.sep}`)) {
      error(errors, "RECEIPT_SYMLINK_OUTSIDE_ROOT", `${field}.path`, "receipt symlink escapes the configured receipt root");
      return null;
    }
    bytes = fs.readFileSync(fileReal);
    receipt = JSON.parse(bytes.toString("utf8"));
  } catch (readError) {
    error(errors, "RECEIPT_READ_FAILED", `${field}.path`, `unable to read and parse receipt: ${readError.message}`);
    return null;
  }
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    error(errors, "RECEIPT_INVALID", field, "receipt must be a JSON object");
    return null;
  }
  const digest = sha256(bytes);
  if (digest !== String(reference.sha256).toLowerCase()) {
    error(errors, "RECEIPT_DIGEST_MISMATCH", `${field}.sha256`, `receipt bytes do not match ${reference.sha256}`);
  }
  if (!nonEmpty(reference.receiptId) || !nonEmpty(receipt.receiptId) || reference.receiptId !== receipt.receiptId) {
    error(errors, "RECEIPT_ID_MISMATCH", `${field}.receiptId`, "receiptId must identify the parsed source receipt");
  }
  return { receipt, digest, relative, reference };
}

function validateReceiptBinding(loaded, role, expected, errors) {
  if (!loaded) return;
  const { receipt, reference } = loaded;
  const field = `receipts.${role}`;
  const actual = receiptBinding(receipt);
  const expectedHead = String(expected.headSha || "").toLowerCase();
  if (Number(actual.pullRequestNumber) !== Number(expected.pullRequestNumber)) {
    error(errors, "RECEIPT_PR_MISMATCH", field, `${role} receipt belongs to another pull request`);
  }
  if (!nonEmpty(actual.headSha) || String(actual.headSha).toLowerCase() !== expectedHead) {
    error(errors, "RECEIPT_HEAD_MISMATCH", field, `${role} receipt belongs to another commit`);
  }
  if (actual.environmentId !== expected.environmentId) {
    error(errors, "RECEIPT_ENVIRONMENT_MISMATCH", field, `${role} receipt belongs to another PR environment`);
  }
  if (actual.implementationRoundId !== expected.implementationRoundId) {
    error(errors, "RECEIPT_ROUND_MISMATCH", field, `${role} receipt belongs to another implementation round`);
  }
  const referenceBinding = {
    pullRequestNumber: reference.pullRequestNumber,
    headSha: reference.headSha,
    environmentId: reference.environmentId,
    implementationRoundId: reference.implementationRoundId
  };
  for (const key of Object.keys(referenceBinding)) {
    const expectedValue = key === "pullRequestNumber" ? Number(expected[key]) : key === "headSha" ? expectedHead : expected[key];
    const value = key === "pullRequestNumber" ? Number(referenceBinding[key]) : key === "headSha" ? String(referenceBinding[key] || "").toLowerCase() : referenceBinding[key];
    if (value !== expectedValue) error(errors, "RECEIPT_REFERENCE_BINDING_MISMATCH", `${field}.${key}`, `${key} must match the manifest CI binding`);
  }
  if (receipt.productionEvidence === false) {
    error(errors, "RECEIPT_NOT_PRODUCTION_EVIDENCE", field, `${role} explicitly declares productionEvidence=false`);
  }
  if (LIVE_EVIDENCE_ROLES.has(role) && receipt.productionEvidence !== true) {
    error(errors, "RECEIPT_LIVE_EVIDENCE_UNPROVEN", field, `${role} must explicitly declare productionEvidence=true`);
  }
  for (const marker of [receipt.provisioningMode, receipt.sourceType, receipt.evidenceMode, receipt.runtimeMode]) {
    if (nonEmpty(marker) && FORBIDDEN_RECEIPT_MARKER.test(marker)) {
      error(errors, "RECEIPT_SOURCE_FORBIDDEN", field, `${role} uses forbidden non-runtime evidence mode ${marker}`);
    }
  }
}

function statusOf(value) {
  return typeof value === "string" ? value : value?.status;
}

function validateProvisioningReceipt(loaded, environment, errors) {
  if (!loaded) return;
  const receipt = loaded.receipt;
  if (receipt.schemaVersion !== "implementation-pr-environment-provider.v1") {
    error(errors, "PROVISIONING_SCHEMA_INVALID", "receipts.provisioning", "live provider receipt schema is required");
  }
  if (!["provisioned", "verified", "passed", "ready"].includes(String(receipt.status || "").toLowerCase())) {
    error(errors, "PROVISIONING_STATUS_INVALID", "receipts.provisioning.status", "provider receipt must be provisioned, verified, passed, or ready");
  }
  if (FORBIDDEN_RECEIPT_MARKER.test(String(receipt.provisioningMode || ""))) {
    error(errors, "PROVISIONING_DESCRIPTOR_ONLY", "receipts.provisioning.provisioningMode", "descriptor-only provisioning cannot be implementation evidence");
  }
  const resources = receipt.resources || {};
  for (const [key, expected] of Object.entries({
    databaseSchema: environment?.databaseSchema,
    objectStoragePrefix: environment?.objectStoragePrefix,
    queueNamespace: environment?.queueNamespace
  })) {
    if (resources[key] !== expected) error(errors, "PROVISIONING_RESOURCE_MISMATCH", `receipts.provisioning.resources.${key}`, `${key} must match the isolated PR environment`);
  }
  const lease = receipt.credentialLease || {};
  if (lease.reference !== environment?.credentialRef || lease.mode !== "short-lived-least-privilege") {
    error(errors, "PROVISIONING_CREDENTIAL_LEASE_INVALID", "receipts.provisioning.credentialLease", "provider must prove the exact short-lived least-privilege credential reference");
  }
  if (!nonEmpty(lease.expiresAt) || Number.isNaN(Date.parse(lease.expiresAt))) {
    error(errors, "PROVISIONING_CREDENTIAL_EXPIRY_INVALID", "receipts.provisioning.credentialLease.expiresAt", "credential lease expiry must be an ISO date-time");
  }
  for (const service of ["postgres", "minio", "nats"]) {
    const state = String(statusOf(receipt.health?.[service]) || "").toLowerCase();
    if (!["passed", "verified", "healthy", "ready"].includes(state)) {
      error(errors, "PROVISIONING_HEALTH_MISSING", `receipts.provisioning.health.${service}`, `${service} live health evidence is required`);
    }
  }
}

function validateRuntimeReceipt(loaded, manifest, errors) {
  if (!loaded) return;
  const receipt = loaded.receipt;
  const runId = firstString(receipt.runtimeRunId, receipt.realRunId, ...(Array.isArray(receipt.realRunIds) ? receipt.realRunIds : []));
  if (!PASS_STATUSES.has(receipt.status) || receipt.runtimeRunIsReal !== true || !RUN_ID.test(String(runId || ""))) {
    error(errors, "RUNTIME_RECEIPT_NOT_REAL", "receipts.runtime", "runtime receipt must prove a passed real S001 run");
  }
  if (receipt.scenarioId !== "S001" || !Array.isArray(receipt.order) || receipt.order.join(",") !== "M02,M01,M03,M04,M06,M05,M06") {
    error(errors, "RUNTIME_RECEIPT_ORDER_INVALID", "receipts.runtime.order", "runtime receipt must prove the fixed S001 module order");
  }
  if (runId !== manifest.runtimeRunId) error(errors, "RUNTIME_RECEIPT_ID_MISMATCH", "runtimeRunId", "manifest runtimeRunId must come from the parsed runtime receipt");
}

function validateReceiptProjection(section, loaded, field, errors) {
  if (!loaded || !section || typeof section !== "object") return;
  const expected = {
    ...loaded.receipt,
    evidence: loaded.relative,
    receiptId: loaded.receipt.receiptId,
    receiptSha256: loaded.digest
  };
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  };
  if (JSON.stringify(canonical(section)) !== JSON.stringify(canonical(expected))) {
    error(errors, "RECEIPT_PROJECTION_MISMATCH", field, "manifest projection must exactly match its parsed source receipt plus path and digest");
  }
}

export function validateReceiptBundle(manifest, options = {}) {
  const errors = [];
  const index = manifest?.receipts;
  if (!index || typeof index !== "object" || Array.isArray(index)) {
    return { valid: false, verifiedCount: 0, errors: [{ code: "RECEIPT_INDEX_MISSING", path: "receipts", message: "a digest-bound receipt index is required" }], loaded: {} };
  }
  const expected = {
    pullRequestNumber: manifest.pullRequest?.number ?? options.pullRequestNumber,
    headSha: manifest.pullRequest?.headSha ?? options.headSha,
    environmentId: manifest.prEnvironment?.id,
    implementationRoundId: manifest.implementationRoundId
  };
  if (!PR_NUMBER.test(String(expected.pullRequestNumber || "")) || !SHA.test(String(expected.headSha || "")) || !nonEmpty(expected.environmentId) || !nonEmpty(expected.implementationRoundId)) {
    error(errors, "RECEIPT_BINDING_MISSING", "receipts", "manifest PR, head, environment, and implementationRoundId are required before receipts can be verified");
  }
  const loaded = {};
  for (const role of REQUIRED_RECEIPT_ROLES) {
    loaded[role] = readBoundReceipt(index[role], role, options, errors);
    validateReceiptBinding(loaded[role], role, expected, errors);
  }
  if (!index.checks || typeof index.checks !== "object" || Array.isArray(index.checks)) {
    error(errors, "CHECK_RECEIPT_INDEX_MISSING", "receipts.checks", "every named check needs a receipt reference");
  } else {
    loaded.checks = {};
    for (const check of REQUIRED_CHECKS) {
      loaded.checks[check] = readBoundReceipt(index.checks[check], `checks.${check}`, options, errors);
      validateReceiptBinding(loaded.checks[check], `checks.${check}`, expected, errors);
    }
  }
  validateProvisioningReceipt(loaded.provisioning, manifest.prEnvironment, errors);
  validateRuntimeReceipt(loaded.runtime, manifest, errors);
  validateReceiptProjection(manifest.databaseMigration, loaded.databaseMigration, "databaseMigration", errors);
  validateReceiptProjection(manifest.objectStorageFingerprint, loaded.objectStorageFingerprint, "objectStorageFingerprint", errors);
  validateReceiptProjection(manifest.rollback, loaded.rollback, "rollback", errors);
  validateReceiptProjection(manifest.audit, loaded.audit, "audit", errors);
  validateReceiptProjection(manifest.negativeTests, loaded.negativeTests, "negativeTests", errors);
  validateReceiptProjection(manifest.recoveryReceipt, loaded.recovery, "recoveryReceipt", errors);
  for (const check of REQUIRED_CHECKS) validateReceiptProjection(manifest.checks?.[check], loaded.checks?.[check], `checks.${check}`, errors);
  const provisioningRef = index.provisioning;
  if (manifest.prEnvironment?.provisioningReceipt !== provisioningRef?.path || manifest.prEnvironment?.provisioningReceiptSha256 !== provisioningRef?.sha256) {
    error(errors, "PROVISIONING_REFERENCE_MISMATCH", "prEnvironment.provisioningReceipt", "environment must bind the parsed provisioning receipt path and digest");
  }
  return {
    valid: errors.length === 0,
    verifiedCount: REQUIRED_RECEIPT_ROLES.filter((role) => loaded[role]).length + Object.values(loaded.checks || {}).filter(Boolean).length,
    errors,
    loaded
  };
}

function error(errors, code, field, message) {
  errors.push({ code, path: field, message });
}

function valueAt(object, field) {
  return object && Object.prototype.hasOwnProperty.call(object, field) ? object[field] : undefined;
}

function ownerIsValid(owner) {
  if (nonEmpty(owner)) return true;
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) return false;
  return nonEmpty(owner.name) || nonEmpty(owner.team) || nonEmpty(owner.id);
}

function firstString(...values) {
  return values.find((value) => nonEmpty(value));
}

function usableEvidence(value) {
  return nonEmpty(value) && !/(?:placeholder|example|fixture|fake|historical|local-only|^tbd$)/i.test(String(value));
}

function schemaVersionsOf(manifest) {
  const values = [];
  const input = manifest.schemaVersions;
  if (typeof input === "string") values.push(input);
  else if (Array.isArray(input)) values.push(...input);
  else if (input && typeof input === "object") values.push(...Object.values(input));
  if (nonEmpty(manifest.schemaVersion)) values.push(manifest.schemaVersion);
  return [...new Set(values.filter((value) => nonEmpty(value)).map((value) => String(value).trim()))];
}

function normalizeManifest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const grouped = input.implementation && typeof input.implementation === "object" ? input.implementation : {};
  const manifest = { ...grouped, ...input };
  if (!manifest.prEnvironment && grouped.prEnvironment) manifest.prEnvironment = grouped.prEnvironment;
  if (!manifest.schemaVersion && grouped.schemaVersions) {
    manifest.schemaVersions = grouped.schemaVersions;
    manifest.schemaVersion = Array.isArray(grouped.schemaVersions)
      ? grouped.schemaVersions[0]
      : typeof grouped.schemaVersions === "object" ? Object.values(grouped.schemaVersions)[0] : grouped.schemaVersions;
  }
  if (!manifest.runtimeRunId && Array.isArray(grouped.realRunIds)) {
    manifest.realRunIds = grouped.realRunIds;
    manifest.runtimeRunId = grouped.realRunIds[0];
  }
  if (!manifest.owner && grouped.owner) manifest.owner = grouped.owner;
  return manifest;
}

function environmentTokenParts(environment) {
  const match = /^pr-([1-9][0-9]*)-([a-f0-9]{7,64})$/i.exec(String(environment?.id || ""));
  return match ? { number: match[1], sha: match[2].toLowerCase() } : null;
}

function validateEnvironmentShape(environment, errors, fieldPrefix = "prEnvironment") {
  const parts = environmentTokenParts(environment);
  if (!parts) {
    error(errors, "PR_ENVIRONMENT_ID_INVALID", `${fieldPrefix}.id`, "id must be pr-<number>-<sha>");
    return;
  }
  const expected = {
    databaseSchema: `pr_${parts.number}_${parts.sha}`,
    objectStoragePrefix: `pr/${parts.number}/${parts.sha}/`,
    queueNamespace: `pr-${parts.number}-${parts.sha}`,
    credentialRef: `pr/${parts.number}/${parts.sha}`
  };
  for (const [field, value] of Object.entries(expected)) {
    if (environment[field] !== value) {
      error(errors, "PR_ENVIRONMENT_NOT_DERIVED", `${fieldPrefix}.${field}`, `${field} must be derived from ${fieldPrefix}.id`);
    }
  }
}

function checkEvidence(value, field, errors, { allowNotApplicable = true } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    error(errors, "CHECK_MISSING", field, `${field} must be an evidence object`);
    return false;
  }
  const status = value.status;
  if (!CHECK_STATUSES.has(status) || (!allowNotApplicable && status === "not-applicable")) {
    error(errors, "CHECK_STATUS_INVALID", `${field}.status`, `${field}.status must be passed, verified, or not-applicable`);
  }
  if (![value.evidence, value.evidenceUri, value.receiptUri].some(usableEvidence)) {
    error(errors, "CHECK_EVIDENCE_MISSING", `${field}.evidence`, `${field} needs a durable evidence/receipt URI or path`);
  }
  if (status === "not-applicable" && !nonEmpty(value.reason)) {
    error(errors, "CHECK_NA_REASON_MISSING", `${field}.reason`, `${field} not-applicable requires a reason`);
  }
  return true;
}

function validateMetadata(manifest, errors, options) {
  if (!nonEmpty(manifest.manifestVersion)) {
    error(errors, "MANIFEST_VERSION_MISSING", "manifestVersion", "manifestVersion is required");
  }
  if (manifest.gateVersion !== undefined && manifest.gateVersion !== QUALITY_GATE_VERSION) {
    error(errors, "GATE_VERSION_UNSUPPORTED", "gateVersion", `gateVersion must be ${QUALITY_GATE_VERSION}`);
  }

  if (!nonEmpty(manifest.baselineSnapshotId)) {
    error(errors, "BASELINE_SNAPSHOT_MISSING", "baselineSnapshotId", "baselineSnapshotId is required");
  } else if (options.expectedBaselineSnapshotId && manifest.baselineSnapshotId !== options.expectedBaselineSnapshotId) {
    error(errors, "BASELINE_SNAPSHOT_MISMATCH", "baselineSnapshotId", `must equal ${options.expectedBaselineSnapshotId}`);
  }

  for (const field of ["sourceTag", "sourceVersion", "implementationVersion"]) {
    if (!nonEmpty(manifest[field])) {
      error(errors, `${field.toUpperCase()}_MISSING`, field, `${field} must be recorded`);
    }
  }
  if (options.expectedSourceTag && manifest.sourceTag !== options.expectedSourceTag) {
    error(errors, "SOURCE_TAG_MISMATCH", "sourceTag", `must equal ${options.expectedSourceTag}`);
  }
  if (options.expectedSourceVersion && manifest.sourceVersion !== options.expectedSourceVersion) {
    error(errors, "SOURCE_VERSION_MISMATCH", "sourceVersion", `must equal ${options.expectedSourceVersion}`);
  }

  if (!nonEmpty(manifest.schemaVersion)) {
    error(errors, "SCHEMA_VERSION_MISSING", "schemaVersion", "schemaVersion is required");
  } else if (!/^(?:draft-[0-9]+\.[0-9]+\.[0-9]+|v?[0-9]+\.[0-9]+\.[0-9]+)$/.test(String(manifest.schemaVersion))) {
    error(errors, "SCHEMA_VERSION_INVALID", "schemaVersion", "schemaVersion must be draft-X.Y.Z or semver");
  }
  const schemaVersions = schemaVersionsOf(manifest);
  if (schemaVersions.length === 0) {
    error(errors, "SCHEMA_VERSIONS_MISSING", "schemaVersions", "at least one API/event/DB Schema version is required");
  }
  if (options.requiredSchemaVersion && !schemaVersions.includes(options.requiredSchemaVersion)) {
    error(errors, "SCHEMA_VERSION_REQUIRED", "schemaVersions", `must include ${options.requiredSchemaVersion}`);
  }
  const compatibility = manifest.schemaCompatibility || manifest.compatibility;
  if (compatibility === undefined) {
    error(errors, "SCHEMA_COMPATIBILITY_MISSING", "schemaCompatibility", "a Schema compatibility decision/receipt is required");
  } else {
    const status = typeof compatibility === "string" ? compatibility : compatibility?.status;
    if (!new Set(["exact", "compatible", "approved-additive", "review"]).has(status)) {
      error(errors, "SCHEMA_COMPATIBILITY_INVALID", "schemaCompatibility.status", "compatibility must be exact, compatible, approved-additive, or review");
    }
    if (status !== "exact" && typeof compatibility === "object" && ![compatibility.evidence, compatibility.evidenceUri].some(usableEvidence)) {
      error(errors, "SCHEMA_COMPATIBILITY_EVIDENCE_MISSING", "schemaCompatibility.evidence", "non-exact compatibility requires a durable decision receipt");
    }
  }
  if (!ownerIsValid(manifest.owner)) {
    error(errors, "OWNER_MISSING", "owner", "an accountable Owner (name, team, or id) is required");
  }
  if (!Array.isArray(manifest.providers) || manifest.providers.length === 0 || manifest.providers.some((value) => !nonEmpty(value))) {
    error(errors, "PROVIDERS_MISSING", "providers", "at least one Provider must be recorded");
  }
  if (!Array.isArray(manifest.consumers) || manifest.consumers.length === 0 || manifest.consumers.some((value) => !nonEmpty(value))) {
    error(errors, "CONSUMERS_MISSING", "consumers", "at least one Consumer must be recorded");
  }

  const migration = manifest.databaseMigration || manifest.databaseMigrations;
  if (!migration || typeof migration !== "object" || Array.isArray(migration)) {
    error(errors, "DATABASE_MIGRATION_MISSING", "databaseMigration", "databaseMigration up/down evidence is required");
  } else {
    const migrationStatus = migration.status;
    if (!["verified", "applied", "not-applicable"].includes(migrationStatus)) {
      error(errors, "DATABASE_MIGRATION_STATUS_INVALID", "databaseMigration.status", "status must be verified, applied, or not-applicable");
    }
    for (const direction of ["up", "down"]) {
      if (!nonEmpty(migration[direction])) {
        error(errors, "DATABASE_MIGRATION_DIRECTION_MISSING", `databaseMigration.${direction}`, `${direction} migration receipt or explicit none is required`);
      }
    }
    if (![migration.evidence, migration.evidenceUri].some(usableEvidence)) {
      error(errors, "DATABASE_MIGRATION_EVIDENCE_MISSING", "databaseMigration.evidence", "migration evidence is required");
    }
    if (migrationStatus === "not-applicable" && !nonEmpty(migration.reason)) {
      error(errors, "DATABASE_MIGRATION_NA_REASON_MISSING", "databaseMigration.reason", "not-applicable migration requires a reason");
    }
  }

  const storage = manifest.objectStorageFingerprint;
  if (!storage || typeof storage !== "object" || Array.isArray(storage)) {
    error(errors, "OBJECT_STORAGE_FINGERPRINT_MISSING", "objectStorageFingerprint", "object-storage fingerprint is required");
  } else {
    if (String(storage.algorithm || "").toLowerCase() !== "sha256") {
      error(errors, "OBJECT_STORAGE_ALGORITHM_INVALID", "objectStorageFingerprint.algorithm", "algorithm must be sha256");
    }
    if (!SHA256.test(String(storage.value || storage.digest || storage.sha256 || ""))) {
      error(errors, "OBJECT_STORAGE_DIGEST_INVALID", "objectStorageFingerprint.value", "value must be a 64-character SHA-256 digest");
    }
    if (!nonEmpty(storage.prefix)) {
      error(errors, "OBJECT_STORAGE_PREFIX_MISSING", "objectStorageFingerprint.prefix", "the isolated object-storage prefix is required");
    }
    if (![storage.evidence, storage.evidenceUri].some(usableEvidence)) {
      error(errors, "OBJECT_STORAGE_EVIDENCE_MISSING", "objectStorageFingerprint.evidence", "object-storage fingerprint evidence is required");
    }
    const environmentPrefix = manifest.prEnvironment?.objectStoragePrefix || manifest.implementation?.prEnvironment?.objectStoragePrefix;
    if (nonEmpty(environmentPrefix) && storage.prefix !== environmentPrefix) {
      error(errors, "OBJECT_STORAGE_PREFIX_MISMATCH", "objectStorageFingerprint.prefix", "fingerprint prefix must equal the isolated PR object-storage prefix");
    }
  }

  const rollback = manifest.rollback;
  if (!rollback || typeof rollback !== "object" || Array.isArray(rollback)) {
    error(errors, "ROLLBACK_MISSING", "rollback", "rollback plan and verification receipt are required");
  } else {
    if (!PASS_STATUSES.has(rollback.status)) {
      error(errors, "ROLLBACK_NOT_VERIFIED", "rollback.status", "rollback.status must be passed or verified");
    }
    if (!nonEmpty(rollback.targetVersion) && !nonEmpty(rollback.targetSnapshotId)) {
      error(errors, "ROLLBACK_TARGET_MISSING", "rollback.targetVersion", "rollback target version or snapshot is required");
    }
    if (![rollback.evidence, rollback.evidenceUri].some(usableEvidence)) {
      error(errors, "ROLLBACK_EVIDENCE_MISSING", "rollback.evidence", "rollback evidence is required");
    }
  }

  const runtimeRunId = firstString(manifest.runtimeRunId, ...(Array.isArray(manifest.realRunIds) ? manifest.realRunIds : []));
  if (!nonEmpty(runtimeRunId) || !RUN_ID.test(runtimeRunId) || /(?:example|fixture|fake|test-run|prototype|historical)/i.test(runtimeRunId)) {
    error(errors, "RUNTIME_RUN_ID_INVALID", "runtimeRunId", "a real S###-RUN-* runtime run ID is required; fixture IDs are not accepted");
  }
  if (manifest.runtimeRunIsReal !== true && manifest.runtime?.real !== true && manifest.runtime?.isReal !== true) {
    error(errors, "RUNTIME_RUN_NOT_REAL", "runtimeRunIsReal", "runtimeRunId must be explicitly marked real");
  }

  const audit = manifest.audit;
  if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
    error(errors, "AUDIT_MISSING", "audit", "audit receipt is required");
  } else {
    for (const field of ["actorRef", "traceId", "correlationId", "idempotencyKey", "formedAt"]) {
      if (!nonEmpty(audit[field])) error(errors, "AUDIT_FIELD_MISSING", `audit.${field}`, `${field} is required`);
    }
    const context = audit.scenarioContext || audit.context;
    if (!context || typeof context !== "object" || !nonEmpty(context.scenarioId) || !nonEmpty(context.scenarioVersion) || !nonEmpty(context.scenarioRunId) || !nonEmpty(context.formedAt) || !nonEmpty(context.status)) {
      error(errors, "AUDIT_CONTEXT_MISSING", "audit.scenarioContext", "audit must carry the complete C033 scenario context");
    }
    if (nonEmpty(audit.formedAt) && Number.isNaN(Date.parse(audit.formedAt))) {
      error(errors, "AUDIT_TIME_INVALID", "audit.formedAt", "formedAt must be an ISO date-time");
    }
    if (audit.appendOnly !== true) {
      error(errors, "AUDIT_NOT_APPEND_ONLY", "audit.appendOnly", "audit receipt must explicitly be append-only");
    }
    if (![audit.evidence, audit.evidenceUri].some(usableEvidence)) {
      error(errors, "AUDIT_EVIDENCE_MISSING", "audit.evidence", "audit evidence is required");
    }
  }

  const negative = manifest.negativeTests;
  if (!negative || typeof negative !== "object" || Array.isArray(negative)) {
    error(errors, "NEGATIVE_TESTS_MISSING", "negativeTests", "negative test receipt is required");
  } else {
    if (!PASS_STATUSES.has(negative.status)) error(errors, "NEGATIVE_TESTS_NOT_PASSED", "negativeTests.status", "negativeTests.status must be passed or verified");
    if (!Array.isArray(negative.cases) || negative.cases.length === 0) {
      error(errors, "NEGATIVE_TEST_CASES_MISSING", "negativeTests.cases", "at least one negative test case is required");
    } else {
      const normalized = negative.cases.map((item) => String(item).toLowerCase());
      const requiredCaseMatchers = [
        ["missing-context", (item) => item.includes("missing") && item.includes("context")],
        ["unknown-schema", (item) => item.includes("unknown") && item.includes("schema")],
        ["unauthorized-owner", (item) => item.includes("permission") || item.includes("unauthor") || item.includes("forbidden")],
        ["cross-scenario", (item) => item.includes("cross") && item.includes("scenario")],
        ["duplicate-idempotency", (item) => item.includes("duplicate") || item.includes("idempot")],
        ["recovery-side-effect", (item) => item.includes("recovery") && item.includes("side")]
      ];
      for (const [caseId, matcher] of requiredCaseMatchers) {
        if (!normalized.some(matcher)) error(errors, "NEGATIVE_CASE_MISSING", `negativeTests.cases.${caseId}`, `${caseId} negative test is required`);
      }
    }
    if (![negative.evidence, negative.evidenceUri].some(usableEvidence)) error(errors, "NEGATIVE_TEST_EVIDENCE_MISSING", "negativeTests.evidence", "negative test evidence is required");
  }

  const recovery = manifest.recoveryReceipt;
  if (!recovery || typeof recovery !== "object" || Array.isArray(recovery)) {
    error(errors, "RECOVERY_RECEIPT_MISSING", "recoveryReceipt", "C034 recovery receipt is required");
  } else {
    if (!PASS_STATUSES.has(recovery.status)) error(errors, "RECOVERY_NOT_VERIFIED", "recoveryReceipt.status", "recoveryReceipt.status must be passed or verified");
    if (!nonEmpty(recovery.sourceScenarioRunId) || !RUN_ID.test(recovery.sourceScenarioRunId)) error(errors, "RECOVERY_SOURCE_RUN_INVALID", "recoveryReceipt.sourceScenarioRunId", "source scenario run ID is required");
    if (!nonEmpty(recovery.restoredScenarioRunId) || !RUN_ID.test(recovery.restoredScenarioRunId)) error(errors, "RECOVERY_TARGET_RUN_INVALID", "recoveryReceipt.restoredScenarioRunId", "restored scenario run ID is required");
    if (recovery.sourceScenarioRunId === recovery.restoredScenarioRunId) error(errors, "RECOVERY_RUN_REUSED", "recoveryReceipt.restoredScenarioRunId", "recovery must create a new scenarioRunId");
    if (recovery.sideEffectsSuppressed !== true) error(errors, "RECOVERY_SIDE_EFFECTS_UNSAFE", "recoveryReceipt.sideEffectsSuppressed", "historical side effects must be suppressed");
    if (recovery.overwritesSource !== false) error(errors, "RECOVERY_SOURCE_OVERWRITE", "recoveryReceipt.overwritesSource", "source checkpoint must not be overwritten");
    if (![recovery.evidence, recovery.evidenceUri].some(usableEvidence)) error(errors, "RECOVERY_EVIDENCE_MISSING", "recoveryReceipt.evidence", "recovery evidence is required");
  }
}

function validateEnvironment(manifest, errors, options) {
  const environment = manifest.prEnvironment || manifest.implementation?.prEnvironment;
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    error(errors, "PR_ENVIRONMENT_MISSING", "prEnvironment", "PR isolation environment is required");
    return;
  }
  const fields = ["databaseSchema", "objectStoragePrefix", "queueNamespace", "credentialRef"];
  if (!nonEmpty(environment.id)) error(errors, "PR_ENVIRONMENT_ID_MISSING", "prEnvironment.id", "a unique PR environment ID is required");
  if (!nonEmpty(environment.provisioningReceipt) && !nonEmpty(environment.provisioningEvidence)) {
    error(errors, "PR_ENVIRONMENT_PROVISIONING_MISSING", "prEnvironment.provisioningReceipt", "a provider receipt proving isolated resources were provisioned is required");
  }
  const provisioning = environment.provisioningReceipt || environment.provisioningEvidence;
  if (provisioning && !usableEvidence(provisioning)) {
    error(errors, "PR_ENVIRONMENT_PROVISIONING_INVALID", "prEnvironment.provisioningReceipt", "provisioning receipt cannot be a placeholder or fixture");
  }
  for (const field of fields) {
    if (!nonEmpty(environment[field])) error(errors, "PR_ENVIRONMENT_FIELD_MISSING", `prEnvironment.${field}`, `${field} is required`);
    else if (FORBIDDEN_ENV_WORDS.test(environment[field])) error(errors, "PR_ENVIRONMENT_NOT_ISOLATED", `prEnvironment.${field}`, `${field} cannot point at a shared/production namespace`);
  }
  const values = fields.map((field) => environment[field]).filter(nonEmpty);
  if (new Set(values).size !== values.length) error(errors, "PR_ENVIRONMENT_COLLISION", "prEnvironment", "database, object store, queue and credential namespaces must be distinct");
  validateEnvironmentShape(environment, errors);
  if (nonEmpty(environment.credentialRef) && /(?:postgres(?:ql)?:\/\/|bearer\s|sk-[A-Za-z0-9]|AKIA[0-9A-Z]{12})/i.test(environment.credentialRef)) {
    error(errors, "PR_ENVIRONMENT_SECRET_LEAK", "prEnvironment.credentialRef", "credentialRef must be a short-lived reference, not a secret");
  }

  const number = manifest.pullRequest?.number ?? options.pullRequestNumber;
  const headSha = manifest.pullRequest?.headSha ?? options.headSha;
  if (number !== undefined && headSha !== undefined) {
    const derived = buildPrEnvironment(number, headSha);
    if (environment.id !== derived.id) error(errors, "PR_ENVIRONMENT_DERIVATION_MISMATCH", "prEnvironment.id", `must be derived from PR ${number} and head SHA`);
    for (const field of fields) {
      if (environment[field] !== derived[field]) error(errors, "PR_ENVIRONMENT_DERIVATION_MISMATCH", `prEnvironment.${field}`, `must be derived from PR ${number} and head SHA`);
    }
  }
}

export function buildPrEnvironment(pullRequestNumber, headSha) {
  const number = String(pullRequestNumber || "");
  const sha = String(headSha || "").toLowerCase();
  if (!PR_NUMBER.test(number)) throw new QualityGateError("pullRequestNumber must be a positive integer", [{ code: "PR_NUMBER_INVALID", path: "pullRequestNumber" }]);
  if (!SHA.test(sha)) throw new QualityGateError("headSha must be a hexadecimal commit SHA", [{ code: "HEAD_SHA_INVALID", path: "headSha" }]);
  const short = sha.slice(0, 12);
  const token = `pr-${number}-${short}`;
  return Object.freeze({
    id: token,
    isolationKey: token,
    token,
    databaseSchema: `pr_${number}_${short}`,
    objectStoragePrefix: `pr/${number}/${short}/`,
    queueNamespace: token,
    credentialRef: `pr/${number}/${short}`
  });
}

/** Validate an isolated PR namespace independently of a full evidence manifest. */
export function validatePrEnvironment(environment, options = {}) {
  const errors = [];
  const value = environment && typeof environment === "object" ? environment : {};
  const fields = ["databaseSchema", "objectStoragePrefix", "queueNamespace", "credentialRef"];
  if (!nonEmpty(value.id)) error(errors, "PR_ENVIRONMENT_ID_MISSING", "id", "id is required");
  for (const field of fields) {
    if (!nonEmpty(value[field])) error(errors, "PR_ENVIRONMENT_FIELD_MISSING", field, `${field} is required`);
    else if (FORBIDDEN_ENV_WORDS.test(value[field])) error(errors, "PR_ENVIRONMENT_NOT_ISOLATED", field, `${field} cannot point at a shared/production namespace`);
  }
  const values = fields.map((field) => value[field]).filter(nonEmpty);
  if (new Set(values).size !== values.length) error(errors, "PR_ENVIRONMENT_COLLISION", "$", "database, object store, queue and credential namespaces must be distinct");
  validateEnvironmentShape(value, errors, "$");
  if (nonEmpty(value.credentialRef) && /(?:postgres(?:ql)?:\/\/|bearer\s|sk-[A-Za-z0-9]|AKIA[0-9A-Z]{12})/i.test(value.credentialRef)) {
    error(errors, "PR_ENVIRONMENT_SECRET_LEAK", "credentialRef", "credentialRef must be a short-lived reference, not a secret");
  }
  if (options.pullRequestNumber !== undefined && options.headSha !== undefined) {
    try {
      const expected = buildPrEnvironment(options.pullRequestNumber, options.headSha);
      if (value.id !== expected.id) error(errors, "PR_ENVIRONMENT_DERIVATION_MISMATCH", "id", "id must be derived from PR and head SHA");
      for (const field of fields) {
        if (value[field] !== expected[field]) error(errors, "PR_ENVIRONMENT_DERIVATION_MISMATCH", field, `${field} must be derived from PR and head SHA`);
      }
    } catch (validationError) {
      errors.push(...(validationError.details || [{ code: "PR_ENVIRONMENT_DERIVATION_INVALID", path: "$", message: validationError.message }]));
    }
  }
  return { valid: errors.length === 0, errors, environment: value };
}

export function assertPrEnvironment(environment, options = {}) {
  const result = validatePrEnvironment(environment, options);
  if (!result.valid) throw new QualityGateError("PR environment is not isolated", result.errors);
  return result;
}

export function validatePrEvidence(manifest, options = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { valid: false, candidateEligible: false, errors: [{ code: "MANIFEST_INVALID", path: "$", message: "manifest must be an object" }] };
  }
  const normalizedManifest = normalizeManifest(manifest);
  validateMetadata(normalizedManifest, errors, {
    expectedBaselineSnapshotId: options.expectedBaselineSnapshotId || DEFAULT_BASELINE_SNAPSHOT_ID,
    expectedSourceTag: options.expectedSourceTag,
    expectedSourceVersion: options.expectedSourceVersion,
    requiredSchemaVersion: options.requiredSchemaVersion || "draft-0.1.0"
  });

  // `checks` is canonical. `gates`/`qualityChecks` are accepted as migration
  // aliases so existing module evidence can be adopted without weakening the
  // required check list.
  const checks = normalizedManifest.checks || normalizedManifest.gates || normalizedManifest.qualityChecks;
  if (!checks || typeof checks !== "object" || Array.isArray(checks)) {
    error(errors, "CHECKS_MISSING", "checks", "all required quality checks must be recorded");
  } else {
    for (const check of REQUIRED_CHECKS) checkEvidence(checks[check], `checks.${check}`, errors, { allowNotApplicable: check === "migration" });
    for (const key of Object.keys(checks)) {
      if (!REQUIRED_CHECKS.includes(key)) error(errors, "CHECK_UNKNOWN", `checks.${key}`, "unknown quality check; update the gate contract first");
    }
    if (checks.security?.status === "not-applicable") error(errors, "SECURITY_REQUIRED", "checks.security.status", "security gate cannot be waived");
    if (checks.c034Recovery?.status === "not-applicable") error(errors, "RECOVERY_REQUIRED", "checks.c034Recovery.status", "C034 recovery gate cannot be waived");
    if (checks.sbom?.status === "not-applicable") error(errors, "SBOM_REQUIRED", "checks.sbom.status", "SBOM gate cannot be waived");
  }

  validateEnvironment(normalizedManifest, errors, options);
  const receiptVerification = validateReceiptBundle(normalizedManifest, {
    ...options,
    manifestPath: options.manifestPath
  });
  errors.push(...receiptVerification.errors);

  const candidateGates = normalizedManifest.candidateGates || normalizedManifest.implementation?.candidateGates;
  if (!candidateGates || typeof candidateGates !== "object" || Array.isArray(candidateGates)) {
    error(errors, "CANDIDATE_GATES_MISSING", "candidateGates", "S001, security and recovery candidate gates must be explicit");
  } else {
    for (const gate of CANDIDATE_GATES) {
      const value = candidateGates[gate];
      if (!value || typeof value !== "object") {
        error(errors, "CANDIDATE_GATE_MISSING", `candidateGates.${gate}`, `${gate} gate is required`);
      } else {
        if (!GATE_STATUSES.has(value.status)) error(errors, "CANDIDATE_GATE_STATUS_INVALID", `candidateGates.${gate}.status`, "status must be passed, verified, blocked, or not-run");
        if (!nonEmpty(value.evidence) && !nonEmpty(value.evidenceUri)) error(errors, "CANDIDATE_GATE_EVIDENCE_MISSING", `candidateGates.${gate}.evidence`, "candidate gate evidence is required");
      }
    }
  }

  const allChecksPassed = checks && REQUIRED_CHECKS.every((check) => PASS_STATUSES.has(checks?.[check]?.status));
  const vertical = candidateGates?.s001VerticalSlice;
  const verticalPassed = PASS_STATUSES.has(vertical?.status);
  const verticalOrderValid = !verticalPassed || (Array.isArray(vertical?.order)
    && vertical.order.join(",") === "M02,M01,M03,M04,M06,M05,M06"
    && vertical.scenarioId === "S001"
    && (nonEmpty(vertical.realRunId) || nonEmpty(vertical.runtimeRunId)));
  const candidateRoundIds = CANDIDATE_GATES
    .map((gate) => candidateGates?.[gate]?.roundId || candidateGates?.[gate]?.implementationRoundId)
    .filter(nonEmpty);
  const candidateGatesPassed = CANDIDATE_GATES.every((gate) => PASS_STATUSES.has(candidateGates?.[gate]?.status));
  const sameRound = !candidateGatesPassed || (candidateRoundIds.length === CANDIDATE_GATES.length && new Set(candidateRoundIds).size === 1);
  if (!verticalOrderValid) error(errors, "S001_ORDER_INVALID", "candidateGates.s001VerticalSlice.order", "S001 vertical slice order must be M02,M01,M03,M04,M06,M05,M06");
  if (!sameRound) error(errors, "CANDIDATE_ROUND_MISMATCH", "candidateGates", "S001, security and recovery evidence must belong to one implementation round");
  const candidateEligible = errors.length === 0 && allChecksPassed && verticalOrderValid && sameRound
    && CANDIDATE_GATES.every((gate) => PASS_STATUSES.has(candidateGates?.[gate]?.status));
  if (normalizedManifest.implementationCandidate === true && !candidateEligible) {
    error(errors, "CANDIDATE_NOT_ELIGIBLE", "implementationCandidate", "implementation candidate requires S001 first vertical slice, security and recovery gates to pass");
  }
  return {
    valid: errors.length === 0,
    candidateEligible,
    errors,
    gateVersion: QUALITY_GATE_VERSION,
    requiredChecks: [...REQUIRED_CHECKS],
    candidateGates: [...CANDIDATE_GATES],
    receiptVerification: {
      valid: receiptVerification.valid,
      verifiedCount: receiptVerification.verifiedCount
    }
  };
}

export function assertPrEvidence(manifest, options = {}) {
  const result = validatePrEvidence(manifest, options);
  if (!result.valid) throw new QualityGateError("Implementation quality evidence failed", result.errors);
  return result;
}

export function formatValidationErrors(errors) {
  return errors.map((item) => `${item.path}: ${item.message}`).join("\n");
}
