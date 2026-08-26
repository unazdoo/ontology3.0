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
  readRecordSource,
  relativePath,
  writeJson
} from "./lib/quality-probe-common.mjs";

const MODULES = Object.freeze(["M01", "M02", "M03", "M04", "M05", "M06"]);

function usage() {
  console.error(`Usage: node scripts/quality-gate/run-observability-evidence.mjs [options]

Required:
  --runtime <path>   Passed real-runtime receipt
  --logs <path>      Structured JSON/NDJSON logs
  --metrics <path>   Structured JSON metrics
  --traces <path>    Structured JSON trace spans
  --alerts <path>    Fail-closed alert probe receipt
  --output <path>    Observability receipt JSON`);
}

function parse(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (["--runtime", "--logs", "--metrics", "--traces", "--alerts", "--output"].includes(value)) result[value.slice(2)] = argv[++index];
    else if (value === "--help" || value === "-h") result.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  for (const field of ["runtime", "logs", "metrics", "traces", "alerts", "output"]) if (!result[field]) throw new Error(`--${field} is required`);
  return result;
}

function timestamp(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${label} needs an ISO timestamp`);
}

function moduleCoverage(records, field = "moduleId") {
  return [...new Set(records.map((record) => record[field]).filter(Boolean))].sort();
}

function requireModules(records, label) {
  const covered = moduleCoverage(records);
  const missing = MODULES.filter((moduleId) => !covered.includes(moduleId));
  if (missing.length) throw new Error(`${label} missing module coverage: ${missing.join(",")}`);
  return covered;
}

function validateLogs(source, binding) {
  if (source.records.length === 0) throw new Error("structured logs are empty");
  for (const [index, record] of source.records.entries()) {
    assertRecordBinding(record, binding, `log[${index}]`);
    timestamp(record.timestamp || record.formedAt, `log[${index}]`);
    if (!record.level || !(record.message || record.event || record.eventType)) throw new Error(`log[${index}] lacks level/message`);
  }
  return requireModules(source.records, "logs");
}

function validateMetrics(source, binding) {
  if (source.records.length === 0) throw new Error("structured metrics are empty");
  for (const [index, record] of source.records.entries()) {
    assertRecordBinding(record, binding, `metric[${index}]`);
    timestamp(record.timestamp || record.formedAt, `metric[${index}]`);
    if (!record.name || !Number.isFinite(Number(record.value)) || !record.unit) throw new Error(`metric[${index}] lacks name/value/unit`);
  }
  return requireModules(source.records, "metrics");
}

function validateTraces(source, binding) {
  if (source.records.length === 0) throw new Error("trace spans are empty");
  let roots = 0;
  const ids = new Set();
  for (const [index, span] of source.records.entries()) {
    assertRecordBinding(span, binding, `span[${index}]`);
    if (!span.spanId || !span.name || !["ok", "passed", "success"].includes(String(span.status || span.statusCode || "").toLowerCase())) throw new Error(`span[${index}] lacks successful span identity`);
    timestamp(span.startedAt || span.startTime, `span[${index}].startedAt`);
    timestamp(span.endedAt || span.endTime, `span[${index}].endedAt`);
    if (Date.parse(span.endedAt || span.endTime) < Date.parse(span.startedAt || span.startTime)) throw new Error(`span[${index}] ends before it starts`);
    if (ids.has(span.spanId)) throw new Error(`duplicate spanId ${span.spanId}`);
    ids.add(span.spanId);
    if (!span.parentSpanId) roots += 1;
  }
  if (roots !== 1) throw new Error(`trace must contain exactly one root span, found ${roots}`);
  for (const span of source.records) if (span.parentSpanId && !ids.has(span.parentSpanId)) throw new Error(`span ${span.spanId} has unknown parent ${span.parentSpanId}`);
  return requireModules(source.records, "traces");
}

function validateAlert(source, binding) {
  const alert = source.value;
  assertRecordBinding(alert, binding, "alert receipt");
  if (!new Set(["passed", "verified"]).has(alert.status) || alert.productionEvidence !== true || alert.failClosed !== true) throw new Error("alert receipt is not passed fail-closed evidence");
  const probe = alert.probe || alert.testProbe;
  if (!probe || probe.triggered !== true || probe.detected !== true || probe.blocked !== true) throw new Error("alert receipt must prove triggered/detected/blocked probe behavior");
  if (!alert.alertId && !probe.alertId) throw new Error("alert receipt lacks stable alertId");
  timestamp(alert.formedAt || probe.detectedAt, "alert receipt");
  return alert;
}

export function evaluateObservabilityEvidence(inputs) {
  const binding = bindingFromRuntime(inputs.runtime, inputs.env);
  const errors = [];
  let logModules = [];
  let metricModules = [];
  let traceModules = [];
  let alert = null;
  for (const [name, evaluator] of [
    ["logs", () => { logModules = validateLogs(inputs.logs, binding); }],
    ["metrics", () => { metricModules = validateMetrics(inputs.metrics, binding); }],
    ["traces", () => { traceModules = validateTraces(inputs.traces, binding); }],
    ["alerts", () => { alert = validateAlert(inputs.alerts, binding); }]
  ]) {
    try { evaluator(); }
    catch (error) { errors.push({ source: name, message: publicError(error) }); }
  }
  const passed = errors.length === 0;
  return baseReceipt("observability", binding, {
    status: passed ? "passed" : "blocked",
    evidence: relativePath(inputs.output),
    logs: { status: passed ? "verified" : "blocked", count: inputs.logs.records.length, moduleCoverage: logModules, sha256: inputs.logs.sha256, source: inputs.logs.path },
    metrics: { status: passed ? "verified" : "blocked", count: inputs.metrics.records.length, moduleCoverage: metricModules, sha256: inputs.metrics.sha256, source: inputs.metrics.path },
    traces: { status: passed ? "verified" : "blocked", count: inputs.traces.records.length, moduleCoverage: traceModules, sha256: inputs.traces.sha256, source: inputs.traces.path },
    alerts: { status: passed ? "verified" : "blocked", alertId: alert?.alertId || alert?.probe?.alertId || null, sha256: inputs.alerts.sha256, source: inputs.alerts.path },
    sameRunCorrelation: passed,
    errors,
    sources: { runtime: inputs.runtimeSource, logs: inputs.logs.path, metrics: inputs.metrics.path, traces: inputs.traces.path, alerts: inputs.alerts.path }
  });
}

async function main(options) {
  const runtimeSource = readJsonSource(options.runtime);
  const inputs = {
    ...options,
    runtime: runtimeSource.value,
    runtimeSource: { path: runtimeSource.path, sha256: runtimeSource.sha256 },
    logs: readRecordSource(options.logs, "logs"),
    metrics: readRecordSource(options.metrics, "metrics"),
    traces: readRecordSource(options.traces, "spans"),
    alerts: readJsonSource(options.alerts)
  };
  const receipt = evaluateObservabilityEvidence(inputs);
  writeJson(options.output, receipt);
  if (receipt.status !== "passed") throw new Error(`observability evidence blocked: ${receipt.errors.map((entry) => entry.source).join(",")}`);
  console.log(`Observability evidence passed: ${options.output}`);
}

const invoked = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  try {
    const options = parse(process.argv.slice(2));
    if (options.help) { usage(); process.exit(0); }
    await main(options);
  } catch (error) {
    console.error(`Observability evidence FAILED: ${publicError(error)}`);
    usage();
    process.exit(1);
  }
}
