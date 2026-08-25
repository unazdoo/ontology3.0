import assert from "node:assert/strict";
import test from "node:test";
import { runAccessibilityProbe } from "./run-accessibility-evidence.mjs";
import { evaluateObservabilityEvidence } from "./run-observability-evidence.mjs";
import { evaluateSecurityEvidence } from "./run-security-evidence.mjs";

const binding = Object.freeze({
  pullRequest: { number: 42, headSha: "a".repeat(40) },
  environmentId: "pr-42-aaaaaaaaaaaa",
  implementationRoundId: "gha-42-1",
  runtimeRunId: "S001-RUN-REAL-42",
  traceId: "trace-42",
  correlationId: "corr-42"
});

function runtime() {
  return {
    receiptId: "RUNTIME-42", status: "passed", productionEvidence: true, runtimeRunIsReal: true,
    pullRequest: binding.pullRequest, environmentId: binding.environmentId,
    implementationRoundId: binding.implementationRoundId, runtimeRunId: binding.runtimeRunId,
    audit: { traceId: binding.traceId, correlationId: binding.correlationId }
  };
}

function source(records, property) {
  return { path: `artifacts/${property}.json`, sha256: "b".repeat(64), records, envelope: { [property]: records } };
}

function record(moduleId, additions = {}) {
  return {
    moduleId, runtimeRunId: binding.runtimeRunId, environmentId: binding.environmentId,
    implementationRoundId: binding.implementationRoundId, traceId: binding.traceId,
    correlationId: binding.correlationId, timestamp: "2026-08-25T00:00:00.000Z",
    ...additions
  };
}

function fakePlaywright(violations = [], focus = [{ matched: true, visible: true }, { matched: true, visible: true }]) {
  let evaluateCalls = 0;
  const page = {
    setDefaultTimeout() {}, on() {},
    async goto() {}, async addScriptTag() {},
    keyboard: { async press() {} },
    async evaluate(_fn, arg) {
      evaluateCalls += 1;
      if (evaluateCalls === 1) return { violations, incomplete: [], passes: [{ id: "document-title" }] };
      if (evaluateCalls === 2) return undefined;
      const current = focus[evaluateCalls - 3] || { matched: false, visible: false };
      return { selector: arg.selector, activeTag: "BUTTON", activeId: null, activeLabel: null, ...current };
    }
  };
  const context = { async newPage() { return page; }, async close() {} };
  const browser = { async newContext() { return context; }, async close() {}, version() { return "test-browser-1"; } };
  return { chromium: { async launch() { return browser; } } };
}

test("accessibility probe requires a real browser path and blocks axe violations", async () => {
  const options = {
    runtime: runtime(), browser: "chromium", url: "http://127.0.0.1/app", timeoutMs: 5000,
    output: "artifacts/accessibility.json", focusSteps: [{ selector: "#nav" }, { selector: "#action" }],
    sources: { runtime: { path: "runtime.json", sha256: "a".repeat(64) }, focusPath: { path: "focus.json", sha256: "c".repeat(64) } }
  };
  const passed = await runAccessibilityProbe(options, { playwright: fakePlaywright(), axeSource: "x".repeat(200) });
  assert.equal(passed.status, "passed");
  assert.equal(passed.keyboard, true);
  assert.equal(passed.axe.executed, true);

  const blocked = await runAccessibilityProbe(options, { playwright: fakePlaywright([{ id: "color-contrast", impact: "serious", description: "contrast", help: "fix", nodes: [] }]), axeSource: "x".repeat(200) });
  assert.equal(blocked.status, "blocked");
  assert.deepEqual(blocked.blockedReasons, ["axe-violations"]);
});

test("observability receipt validates actual logs, metrics, spans and fail-closed alert correlation", () => {
  const modules = ["M01", "M02", "M03", "M04", "M05", "M06"];
  const logs = modules.map((moduleId) => record(moduleId, { level: "info", message: `${moduleId} completed` }));
  const metrics = modules.map((moduleId) => record(moduleId, { name: "ofw_stage_duration", value: 10, unit: "ms" }));
  const spans = modules.map((moduleId, index) => record(moduleId, {
    spanId: `span-${index + 1}`, parentSpanId: index === 0 ? null : "span-1", name: `${moduleId}.stage`,
    status: "ok", startedAt: "2026-08-25T00:00:00.000Z", endedAt: "2026-08-25T00:00:00.010Z"
  }));
  const alert = {
    receiptId: "ALERT-42", status: "verified", productionEvidence: true, failClosed: true,
    runtimeRunId: binding.runtimeRunId, environmentId: binding.environmentId, implementationRoundId: binding.implementationRoundId,
    traceId: binding.traceId, correlationId: binding.correlationId, formedAt: "2026-08-25T00:00:01.000Z",
    alertId: "ALERT-PROBE-42", probe: { triggered: true, detected: true, blocked: true }
  };
  const receipt = evaluateObservabilityEvidence({
    runtime: runtime(), output: "artifacts/observability.json", runtimeSource: { path: "runtime.json", sha256: "a".repeat(64) },
    logs: source(logs, "logs"), metrics: source(metrics, "metrics"), traces: source(spans, "spans"),
    alerts: { path: "artifacts/alerts.json", sha256: "d".repeat(64), value: alert }
  });
  assert.equal(receipt.status, "passed", JSON.stringify(receipt.errors));
  assert.equal(receipt.sameRunCorrelation, true);
  assert.equal(receipt.traces.count, 6);

  logs[0].correlationId = "other";
  const blocked = evaluateObservabilityEvidence({
    runtime: runtime(), output: "artifacts/observability.json", runtimeSource: { path: "runtime.json", sha256: "a".repeat(64) },
    logs: source(logs, "logs"), metrics: source(metrics, "metrics"), traces: source(spans, "spans"),
    alerts: { path: "artifacts/alerts.json", sha256: "d".repeat(64), value: alert }
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.logs.status, "blocked");
});

test("security receipt aggregates secret scan, npm audit and runtime permission negatives", () => {
  const permission = {
    receiptId: "PERMISSION-42", status: "verified", productionEvidence: true,
    runtimeRunId: binding.runtimeRunId, environmentId: binding.environmentId,
    implementationRoundId: binding.implementationRoundId, correlationId: binding.correlationId,
    deniedCases: ["unauthorized-owner", "cross-scenario", "privilege-escalation"]
  };
  const inputs = {
    runtime: runtime(), output: "artifacts/security.json", runtimeSource: { path: "runtime.json", sha256: "a".repeat(64) },
    secretScan: { path: "secret.json", sha256: "b".repeat(64), value: { status: "passed", findings: [] } },
    npmAudit: { path: "audit.json", sha256: "c".repeat(64), value: { auditReportVersion: 2, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } } } },
    permissionNegative: { path: "permission.json", sha256: "d".repeat(64), value: permission }
  };
  const passed = evaluateSecurityEvidence(inputs);
  assert.equal(passed.status, "passed", JSON.stringify(passed.errors));
  assert.equal(passed.permissionNegative.coverage.privilegeEscalation, true);

  inputs.npmAudit.value.metadata.vulnerabilities.high = 1;
  const blocked = evaluateSecurityEvidence(inputs);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.unresolvedHigh, 1);
});
