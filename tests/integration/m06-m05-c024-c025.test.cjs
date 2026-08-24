"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const m06 = require("../../packages/report");
const m05 = require("../../packages/m05");

const context = Object.freeze({ scenarioId: "S001", scenarioVersion: "S001-v1.1.0", scenarioRunId: "S001-RUN-20260824120000000-integration", formedAt: "2026-08-24T12:00:00.000Z", status: "active" });
const now = () => "2026-08-24T12:00:00.000Z";

function release() {
  const input = { releaseId: "REL-COPILOT", releaseVersion: "2.0.0", status: "validated", agent: { type: "agent", id: "report-copilot", version: "2.0.0" }, prompt: { type: "prompt", id: "prompt", version: "1" }, skills: [{ type: "skill", id: "skill", version: "1" }], tools: [{ type: "tool", id: "tool", version: "1" }], model: { type: "model", id: "model", version: "1" }, publishedOntologies: [{ type: "publishedOntology", id: "SEM-1", version: "1", status: "published" }], scenario: { type: "scenario", id: "S001", version: "S001-v1.1.0" }, validity: { validFrom: "2026-01-01T00:00:00.000Z", validTo: "2027-01-01T00:00:00.000Z" }, resourceWhitelist: [{ resourceType: "reportContext", resourceId: "context", resourceVersion: "1", operations: ["read-context"], readOnly: true }] };
  return m05.publishAgentRelease(m05.createAgentRelease(input, { now: now() }), { now: now() });
}

function build(mode = "success") {
  let calls = 0;
  const runtime = m05.createM05Runtime({ clock: now, release: release(), policy: { timeoutMs: 10, maxAttempts: 1, backoffMs: 0 }, models: [{ id: "model", version: "1", execute: async () => { calls += 1; if (mode === "failed") { const error = new Error("model failed"); error.code = "MODEL_FAILED"; throw error; } if (mode === "unknown") return new Promise(() => {}); return { output: { answer: "fixed", anchors: ["T044-1"], evidenceRefs: [{ id: "E-1" }] } }; } }] });
  const port = m05.createM06ReportPort({ runtime, clock: now, executionTimeoutMs: 20, copilotActor: { roles: ["operator"] }, c017Resolver: async () => ({ summaryId: "C017-1", summaryVersion: "1", formedAt: now(), status: "passed", freshness: { status: "fresh" }, semanticVersionId: "SEM-1", dataVersionId: "DATA-1", dataAssetVersion: "DATA-1", t008: "2026-08-24T11:00:00.000Z", scenarioContext: context, owner: "M02" }) });
  const store = m06.createReportStore();
  const service = m06.createReportService({ store, m05CopilotPort: port, authorizationPort: { authorizeReportCopilotContext: async (request) => ({ decisionId: "AUTH-1", version: "1", status: "allowed", decidedAt: now(), scopeRef: request.scopeRef, scenarioContext: context, owner: "platform", source: "authorization-api" }) }, clock: now });
  const evidencePack = { evidencePackId: "EP-1", version: "1", scenarioContext: context, exactCombination: { t019Id: "T019-1", t019Version: "1", semanticVersionId: "SEM-1", semanticVersion: "1", dataVersionId: "DATA-1", t008: "2026-08-24T11:00:00.000Z", c017SummaryId: "C017-1", c017SummaryVersion: "1" }, generationBindingSummary: { summaryId: "C017-1", version: "1", formedAt: now() }, items: [{ evidenceId: "E-1" }] };
  const content = { contentVersionId: "CV-1", scenarioContext: context, evidencePackRef: { evidencePackId: "EP-1", version: "1" }, definitionRef: { reportDefinitionId: "RDEF-1", version: "1" }, templateRef: { templateId: "RT-1", version: "1" }, sourceDraftRef: { generationRunId: "GEN-1" }, anchorIds: ["T044-1"] };
  const artifact = { reportId: "RPT-1", reportNo: "RPT-1", artifactVersion: "1", status: "published", scenarioContext: context, contentVersionId: "CV-1", evidencePackRef: { evidencePackId: "EP-1", version: "1" } };
  const anchor = { t044Id: "T044-1", contentVersionId: "CV-1", sourceDraftId: "DRAFT-1", sourceContentItemId: "ITEM-1", sectionId: "overview", templateSlotId: "slot", anchorKind: "metric-value", stableLocation: "overview:slot", evidenceRefs: ["E-1"] };
  store.append("artifacts", artifact.reportId, artifact); store.append("contentVersions", content.contentVersionId, content); store.append("evidencePacks", evidencePack.evidencePackId, evidencePack); store.append("anchors", anchor.t044Id, anchor);
  return { service, port, runtime, calls: () => calls };
}

function request(overrides = {}) { return { reportId: "RPT-1", reportNumber: "RPT-1", artifactVersion: "1", contentVersionId: "CV-1", anchorIds: ["T044-1"], selectionScope: "whole-report", purpose: "report-question", question: "Explain", c017Ref: { summaryId: "C017-1", version: "1", formedAt: now() }, agentReleaseRef: { agentId: "report-copilot", version: "2.0.0" }, semanticEvidenceRefs: [], requestedBy: "reader", requestedAt: now(), correlationId: "CORR-1", traceId: "TRACE-1", ...overrides }; }

test("actual M06 requestReportCopilot completes M05 receive-run-read with a stable successful C025 reference", async () => {
  const h = build(); const first = await h.service.requestReportCopilot(request()); const retry = await h.service.requestReportCopilot(request());
  assert.equal(first.successful, true); assert.equal(first.outcome, "complete"); assert.equal(retry.c025ReferenceId, first.c025ReferenceId); assert.equal(h.runtime.store.current().runs.length, 1); assert.equal(h.calls(), 1);
});

test("wrong report, content, evidence anchor, scenario run and Agent Release are rejected", async () => {
  const h = build();
  for (const bad of [{ reportId: "OTHER" }, { contentVersionId: "OTHER" }, { anchorIds: ["OTHER"] }, { agentReleaseRef: { agentId: "other", version: "1" } }]) await assert.rejects(() => h.service.requestReportCopilot(request(bad)));
  const created = await h.service.createReportCopilotRequest(request({ requestId: "C024-RUN-MISMATCH" }));
  const wrongRun = JSON.parse(JSON.stringify(created.envelope));
  wrongRun.scenarioContext.scenarioRunId = "S001-RUN-20260824120000000-other";
  await assert.rejects(() => h.port.receiveReportCopilotRequest(wrongRun));
  assert.equal(h.runtime.store.current().runs.length, 0);
});

test("unknown and failed M05 executions never create a successful M06 C025 reference", async () => {
  for (const mode of ["unknown", "failed"]) { const h = build(mode); await assert.rejects(() => h.service.requestReportCopilot(request({ requestId: `C024-${mode}` }))); assert.equal(h.service.getReportCopilotReference(`C024-${mode}`), null); }
});
