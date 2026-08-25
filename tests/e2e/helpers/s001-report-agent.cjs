"use strict";

const m06 = require("../../../packages/report");
const m05 = require("../../../packages/m05");

function required(value, label) {
  if (!value) throw new Error(`runS001ReportAgent requires ${label}`);
  return value;
}

function text(value, label) {
  if (typeof value !== "string" || !value) throw new Error(`runS001ReportAgent requires ${label}`);
  return value;
}

function now(clock) {
  return typeof clock === "function" ? clock() : new Date().toISOString();
}

function definition(c019EvidenceType, clock) {
  return {
    reportDefinitionId: "RDEF-S001-REPORT-AGENT", version: "1.0.0", status: "enabled", title: "S001 Decision Report",
    purpose: { decisionQuestion: "What is the current decision state?", useContext: "controlled review", notApplicable: "no action execution" },
    applicability: { scenarioIds: ["S001"], objectTypes: ["S001-OBJECT"], scopePolicy: "single" }, audience: { readers: ["s001-reviewer"], useBoundary: "controlled" },
    templateRef: { templateId: "RT-S001-REPORT-AGENT", version: "1.0.0" }, sections: [{ sectionId: "decision", title: "Decision Summary" }],
    evidenceSlots: [{ evidenceSlotId: "c019", sectionId: "decision", required: true, allowedEvidenceTypes: [c019EvidenceType], allowedContentTypes: ["rule-summary"] }],
    contentPolicy: { allowedContentTypes: ["rule-summary"], requiredBindingKinds: ["decision-summary"] }, coveragePolicy: { minimumRequiredCoverage: 1, blockOnUnclassified: true, blockOnExecutionError: true },
    calculationPolicy: { allowedResultTypes: [c019EvidenceType], roundingMode: "half-up", defaultTolerance: 0, prohibitAgentCalculation: true },
    agentRef: { agentId: "s001-report-draft", releaseVersion: "1.0.0" }, skillRef: { skillId: "s001-report-structure", version: "1.0.0" },
    verificationPolicy: { rulesVersion: "T049-S001-1.0.0", explanationPolicy: "on-demand", warningBlocksPublication: false }, comparisonPolicy: { policyVersion: "C027-S001-1.0.0", allowedFactKinds: ["decision-summary"], freshnessThresholdRef: "S001", qualityWarningBlocks: false, regenerationRuleVersion: "S001" },
    reviewPolicy: { reviewerRoles: ["s001-reviewer"] }, publicationPolicy: { allowedAudience: ["internal"], namingRule: "S001", replacementMode: "new-version" }, enabledAt: now(clock), changeSummary: "S001 report agent E2E"
  };
}

function template() {
  return { templateId: "RT-S001-REPORT-AGENT", version: "1.0.0", reportDefinitionId: "RDEF-S001-REPORT-AGENT", reportDefinitionVersion: "1.0.0", name: "S001 Decision Template", reportType: "decision-summary", slots: [{ templateSlotId: "c019-slot", sectionId: "decision", evidenceSlotId: "c019", contentType: "rule-summary", anchorKind: "paragraph" }] };
}

function defaultGenerationRunner(clock) {
  return async ({ c022 }) => {
    const evidence = c022.evidencePack.items[0];
    return { runId: `M05-GEN-${c022.requestId}`, status: "completed", completedAt: now(clock), sourceDraftId: `C023-${c022.requestId}`, version: "1.0.0", missingSections: [], warnings: [], contentItems: [{ sourceContentItemId: "C019-DECISION-SUMMARY", order: 1, templateSlotId: "c019-slot", contentType: "rule-summary", structuredContent: { text: "Decision summary is fixed from the M04 C019 reference." }, evidenceRefs: [evidence.evidenceId], facts: [{ factId: "C019-DECISION", kind: "decision-summary", value: evidence.structuredValue, unit: null, semanticRef: evidence.semanticRef, evidenceRefs: [evidence.evidenceId], resultRef: evidence.resultRef, humanConfirmationRequired: true }] }] };
  };
}

function defaultExtractionRunner(clock) {
  return async ({ fixedInput }) => ({ status: "completed", completedAt: now(clock), claims: fixedInput.contentItems.flatMap((item) => item.facts.map((fact) => ({ sourceContentItemId: item.sourceContentItemId, factId: fact.factId, t044Id: fixedInput.anchors.find((anchor) => anchor.sourceContentItemId === item.sourceContentItemId).t044Id, observedValue: fact.value, observedUnit: fact.unit, evidenceRefs: fact.evidenceRefs, semanticRef: fact.semanticRef || null }))) });
}

async function prepareS001Report(front, decision, options = {}) {
  const scenarioContext = required(options.scenarioContext || front?.scenarioContext, "front.scenarioContext");
  const clock = options.clock || front?.clock;
  const c008Provider = required(options.c008Provider || front?.c008Provider, "front.c008Provider");
  const c017Provider = required(options.c017Provider || front?.c017Provider, "front.c017Provider");
  const authorizationPort = required(options.authorizationPort || front?.authorizationPort, "front.authorizationPort");
  const m04Port = m06.createM04DecisionPort(required(decision, "decision"));
  const runtime = required(options.runtime || front?.m05Runtime, "options.runtime or front.m05Runtime");
  const generationRelease = required(options.generationRelease || front?.generationRelease, "options.generationRelease or front.generationRelease");
  const m05Port = options.m05Port || m05.createM06ReportPort({
    runtime,
    generationRelease,
    extractionRelease: options.extractionRelease || front?.extractionRelease || generationRelease,
    c017Resolver: required(options.c017Resolver || front?.c017Resolver, "options.c017Resolver or front.c017Resolver"),
    copilotActor: required(options.copilotActor || front?.copilotActor, "options.copilotActor or front.copilotActor"),
    generationRunner: options.generationRunner || defaultGenerationRunner(clock), extractionRunner: options.extractionRunner || defaultExtractionRunner(clock),
    clock, executionTimeoutMs: options.executionTimeoutMs
  });
  const service = m06.createReportService({ store: options.store || m06.createReportStore(), c008Provider, c017Provider, m04DecisionPort: m04Port, m05Port, m05CopilotPort: m05Port, authorizationPort, clock });
  service.registerReportDefinition(definition(m06.C019_EVIDENCE_TYPE, clock));
  service.registerReportTemplate(template());

  const c019 = await service.receiveC019({ scenarioContext, traceId: text(options.traceId || "TRACE-S001-REPORT-AGENT", "traceId"), correlationId: text(options.correlationId || "CORR-S001-REPORT-AGENT", "correlationId"), idempotencyKey: text(options.c019IdempotencyKey || "IDEM-S001-C019", "c019IdempotencyKey"), returnContext: options.returnContext || { sourceScenario: "M06", filters: {}, issuedAt: now(clock) } });
  if (c019.reference.sourceStatus !== "ready") throw new Error(`M04 C019 is not ready: ${c019.reference.sourceStatus}`);
  const exactCombination = required(options.exactCombination, "options.exactCombination derived from the same real owner reads");
  const evidence = service.createC019EvidenceItem({ receiptId: c019.receipt.receiptId, evidenceId: options.evidenceId || "E-C019-S001", evidenceSlotId: "c019", fixedAt: now(clock), exactCombination, objectScope: options.objectScope || { objectTypeId: "S001-OBJECT", objectId: "S001" }, evidenceRefs: options.c019EvidenceRefs || [] });
  let generation;
  try {
    generation = await service.generateReport({ requestId: options.generationRequestId || "RGEN-S001-REPORT-AGENT", scenarioContext, reportDefinitionId: "RDEF-S001-REPORT-AGENT", reportDefinitionVersion: "1.0.0", objectScope: options.objectScope || { objectTypeId: "S001-OBJECT", objectId: "S001" }, generationScope: { sections: ["decision"] }, requestedBy: options.requestedBy || "s001-reviewer", collectEvidence: async () => [evidence] });
  } catch (error) {
    throw error;
  }
  const t049 = await service.verifyContent({ contentVersionId: generation.contentVersion.contentVersionId, verificationRunId: options.verificationRunId || "T049-S001-REPORT-AGENT", initiatedBy: options.requestedBy || "s001-reviewer" });
  const review = await service.confirmReview({ contentVersionId: generation.contentVersion.contentVersionId, reviewCopyId: generation.reviewCopy.reviewCopyId, verificationRunId: t049.verificationRunId, reviewer: options.reviewer || "s001-reviewer", conclusion: options.reviewConclusion || "confirmed against fixed C019 evidence" });
  const artifact = await service.publishReport({ reportId: options.reportId || "RPT-S001-REPORT-AGENT", reportNo: options.reportNo || "RPT-S001-REPORT-AGENT", artifactVersion: "1.0.0", contentVersionId: generation.contentVersion.contentVersionId, verificationRunId: t049.verificationRunId, reviewDecisionId: review.reviewDecisionId, publishedBy: options.publisher || "s001-reviewer" });
  const copilotInput = { reportId: artifact.reportId, reportNumber: artifact.reportNo, artifactVersion: artifact.artifactVersion, contentVersionId: generation.contentVersion.contentVersionId, anchorIds: generation.anchors.map((anchor) => anchor.t044Id), selectionScope: "whole-report", purpose: "report-question", question: options.question || "Explain the fixed decision evidence and review boundary.", c017Ref: generation.c022.evidencePack.generationBindingSummary, agentReleaseRef: required(options.agentReleaseRef || front?.agentReleaseRef, "options.agentReleaseRef or front.agentReleaseRef"), semanticEvidenceRefs: [], requestedBy: options.requestedBy || "s001-reviewer", requestedAt: now(clock), correlationId: options.copilotCorrelationId || "CORR-S001-C024", traceId: options.copilotTraceId || "TRACE-S001-C024" };
  const c024 = await service.createReportCopilotRequest(copilotInput);
  return Object.freeze({ scenarioContext, service, m05Port, c019, evidence, generation, t049, review, artifact, copilotInput, c024, storeState: service.snapshot(), c027: Object.freeze({ triggered: false, reason: "C027 requires explicit user action and is not run by this helper" }) });
}

async function runS001M05Copilot(prepared, options = {}) {
  const port = options.m05Port || prepared.m05Port;
  const c024Envelope = prepared.c024?.envelope || options.c024Envelope;
  if (!port || !c024Envelope) throw new Error("runS001M05Copilot requires the persisted C024 envelope and an M05 port");
  const receiptEnvelope = await port.receiveReportCopilotRequest(c024Envelope);
  const resultEnvelope = await port.runReportCopilot(c024Envelope, receiptEnvelope);
  return Object.freeze({ c024Envelope, receiptEnvelope, resultEnvelope });
}

async function completeS001ReportCopilot(prepared, m05Result, options = {}) {
  const service = options.service || prepared.service;
  if (!service) throw new Error("completeS001ReportCopilot requires a rehydrated M06 service");
  const copilot = await service.requestReportCopilot(prepared.copilotInput);
  return Object.freeze({ ...prepared, ...m05Result, service, copilot, storeState: service.snapshot() });
}

async function runS001ReportAgent(front, decision, options = {}) {
  const prepared = await prepareS001Report(front, decision, options);
  const m05Result = await runS001M05Copilot(prepared, options);
  return completeS001ReportCopilot(prepared, m05Result, options);
}

module.exports = Object.freeze({ prepareS001Report, runS001M05Copilot, completeS001ReportCopilot, runS001ReportAgent, definition, template, defaultGenerationRunner, defaultExtractionRunner });
