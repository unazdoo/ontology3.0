import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function relativePath(filePath, root = process.cwd()) {
  return path.relative(path.resolve(root), path.resolve(filePath)).split(path.sep).join("/");
}

export function readJsonSource(filePath, root = process.cwd()) {
  const resolved = path.resolve(root, filePath);
  const bytes = fs.readFileSync(resolved);
  let value;
  try { value = JSON.parse(bytes.toString("utf8")); }
  catch (error) { throw new Error(`${filePath} is invalid JSON: ${error.message}`); }
  return Object.freeze({ path: relativePath(resolved, root), sha256: sha256(bytes), value });
}

export function readRecordSource(filePath, property, root = process.cwd()) {
  const resolved = path.resolve(root, filePath);
  const bytes = fs.readFileSync(resolved);
  const text = bytes.toString("utf8").trim();
  let parsed;
  try {
    if (text.startsWith("[") || text.startsWith("{")) parsed = JSON.parse(text);
    else parsed = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    throw new Error(`${filePath} is not valid structured JSON/NDJSON: ${error.message}`);
  }
  const records = Array.isArray(parsed) ? parsed : parsed?.[property];
  if (!Array.isArray(records)) throw new Error(`${filePath} must be an array or contain ${property}[]`);
  return Object.freeze({ path: relativePath(resolved, root), sha256: sha256(bytes), records, envelope: parsed });
}

function exactBindingValue(runtime, primary, aliases = []) {
  for (const key of [primary, ...aliases]) {
    if (runtime?.[key] !== undefined && runtime?.[key] !== null) return runtime[key];
  }
  return null;
}

export function bindingFromRuntime(runtime, env = process.env) {
  if (!runtime || typeof runtime !== "object" || Array.isArray(runtime)) throw new Error("runtime receipt must be an object");
  const pullRequestNumber = Number(runtime.pullRequest?.number);
  const headSha = String(runtime.pullRequest?.headSha || "").toLowerCase();
  const environmentId = String(runtime.environmentId || "");
  const implementationRoundId = String(runtime.implementationRoundId || runtime.roundId || "");
  const runtimeRunId = String(exactBindingValue(runtime, "runtimeRunId", ["realRunId"]) || "");
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) throw new Error("runtime receipt pullRequest.number is invalid");
  if (!/^[a-f0-9]{12,64}$/.test(headSha)) throw new Error("runtime receipt pullRequest.headSha is invalid");
  if (environmentId !== `pr-${pullRequestNumber}-${headSha.slice(0, 12)}`) throw new Error("runtime receipt environmentId is not derived from PR/head");
  if (!implementationRoundId || !/^(?:S[0-9]{3}-)?RUN-[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runtimeRunId)) throw new Error("runtime receipt round/run identity is invalid");
  if (runtime.status !== "passed" || runtime.runtimeRunIsReal !== true || runtime.productionEvidence !== true) throw new Error("runtime receipt is not passed real evidence");
  const expected = {
    PR_NUMBER: String(pullRequestNumber), HEAD_SHA: headSha,
    PR_ENVIRONMENT_ID: environmentId, IMPLEMENTATION_ROUND_ID: implementationRoundId
  };
  for (const [key, value] of Object.entries(expected)) {
    if (nonEmpty(env[key]) && String(env[key]).toLowerCase() !== String(value).toLowerCase()) throw new Error(`${key} disagrees with runtime receipt`);
  }
  return Object.freeze({
    pullRequest: Object.freeze({ number: pullRequestNumber, headSha }),
    environmentId,
    implementationRoundId,
    runtimeRunId,
    traceId: String(runtime.audit?.traceId || runtime.traceId || ""),
    correlationId: String(runtime.audit?.correlationId || runtime.correlationId || "")
  });
}

export function assertRecordBinding(record, binding, label, options = {}) {
  const runId = String(record?.runtimeRunId || record?.scenarioRunId || record?.scenarioContext?.scenarioRunId || "");
  const environmentId = String(record?.environmentId || record?.prEnvironment?.id || "");
  const roundId = String(record?.implementationRoundId || record?.roundId || "");
  const correlationId = String(record?.correlationId || record?.traceContext?.correlationId || "");
  const traceId = String(record?.traceId || record?.traceContext?.traceId || "");
  if (runId !== binding.runtimeRunId) throw new Error(`${label} belongs to another runtimeRunId`);
  if (environmentId !== binding.environmentId || roundId !== binding.implementationRoundId) throw new Error(`${label} belongs to another environment/round`);
  if (options.requireCorrelation !== false && (!correlationId || correlationId !== binding.correlationId)) throw new Error(`${label} correlationId does not match the runtime`);
  if (options.requireTrace !== false && (!traceId || traceId !== binding.traceId)) throw new Error(`${label} traceId does not match the runtime`);
}

export function baseReceipt(kind, binding, fields = {}) {
  const formedAt = new Date().toISOString();
  const identity = `${kind}:${binding.runtimeRunId}:${binding.pullRequest.headSha}:${binding.implementationRoundId}`;
  return {
    schemaVersion: `ofw.quality-${kind.toLowerCase()}.v1`,
    receiptId: `${kind.toUpperCase()}-${sha256(identity).slice(0, 24).toUpperCase()}`,
    status: "passed",
    productionEvidence: true,
    pullRequest: binding.pullRequest,
    environmentId: binding.environmentId,
    implementationRoundId: binding.implementationRoundId,
    runtimeRunId: binding.runtimeRunId,
    traceId: binding.traceId,
    correlationId: binding.correlationId,
    formedAt,
    ...fields
  };
}

export function writeJson(filePath, value) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return resolved;
}

export function publicError(error) {
  return String(error?.message || error || "unknown error").replace(/(?:postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[redacted]@").slice(0, 1000);
}
