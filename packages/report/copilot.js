"use strict";

const { fail } = require("./errors");
const {
  assertObject,
  assertString,
  assertArray,
  assertScenarioRun,
  immutableJson,
  stableSerialize,
  sha256,
  contentId
} = require("./utils");
const { assertAllowedKeys } = require("./handoff");
const {
  createStrictContractEnvelope,
  unwrapStrictContractEnvelope
} = require("./boundary");

const FIXED_REPORT_CONTEXT_SCHEMA_VERSION = "ofw.c024.fixed-report-context.v1";
const C024_SCHEMA_VERSION = "ofw.c024.report-copilot-request.v1";
const C024_RECEIPT_SCHEMA_VERSION = "ofw.c024.report-copilot-receipt.v1";
const C025_SCHEMA_VERSION = "ofw.c025.report-copilot-result.v1";
const C025_READ_SCHEMA_VERSION = "ofw.c025.report-copilot-read-request.v1";

const C024_EVENT_TYPE = "M06.C024.ReportCopilotRequested";
const C024_RECEIPT_EVENT_TYPE = "M05.C024.ReportCopilotReceived";
const C025_EVENT_TYPE = "M05.C025.ReportCopilotResult";
const C025_READ_EVENT_TYPE = "M06.C025.ReportCopilotReadRequested";

const PURPOSES = Object.freeze(["report-question", "t049-explanation", "c027-explanation"]);
const BINDING_STATUSES = Object.freeze(["active", "restricted", "stale", "closed"]);
const SESSION_STATUSES = Object.freeze(["active", "restricted", "stale", "closed"]);
const RUN_STATUSES = Object.freeze([
  "complete", "limited-complete", "partial-complete", "input-invalid", "failed", "output-invalid", "cancelled"
]);
const RESULT_STATUSES = Object.freeze([...RUN_STATUSES]);

function assertExact(left, right, code, message) {
  if (stableSerialize(left) !== stableSerialize(right)) fail(code, message, { expected: right, actual: left });
}

function assertDateTime(value, label) {
  const text = assertString(value, label);
  if (Number.isNaN(Date.parse(text))) fail("INVALID_CONTRACT_TIME", `${label} must be a valid date-time`);
  return text;
}

function normalizeAuthorizationRef(value) {
  assertObject(value, "authorizationRef");
  assertAllowedKeys(value, ["decisionId", "version", "status", "decidedAt", "scopeRef"], "authorizationRef");
  const result = {
    decisionId: assertString(value.decisionId, "authorizationRef.decisionId"),
    version: assertString(value.version, "authorizationRef.version"),
    status: assertString(value.status, "authorizationRef.status"),
    decidedAt: assertDateTime(value.decidedAt, "authorizationRef.decidedAt"),
    scopeRef: assertString(value.scopeRef, "authorizationRef.scopeRef")
  };
  if (result.status !== "allowed") fail("COPILOT_NOT_AUTHORIZED", "C024 requires an allowed platform authorization result");
  return result;
}

function normalizeAgentReleaseRef(value) {
  assertObject(value, "agentReleaseRef");
  assertAllowedKeys(value, ["agentId", "version"], "agentReleaseRef");
  return {
    agentId: assertString(value.agentId, "agentReleaseRef.agentId"),
    version: assertString(value.version, "agentReleaseRef.version")
  };
}

function normalizeC017Ref(value, evidencePack) {
  const expected = evidencePack.generationBindingSummary;
  assertObject(value, "c017Ref");
  assertAllowedKeys(value, ["summaryId", "version", "formedAt"], "c017Ref");
  const result = {
    summaryId: assertString(value.summaryId, "c017Ref.summaryId"),
    version: assertString(value.version, "c017Ref.version"),
    formedAt: assertDateTime(value.formedAt, "c017Ref.formedAt")
  };
  assertExact(result, expected, "C017_REFERENCE_MISMATCH", "C024 must use the report generation-time C017 summary reference");
  return result;
}

function normalizeExactCombination(value) {
  assertObject(value, "exactCombination");
  const fields = [
    "t019Id", "t019Version", "semanticVersionId", "semanticVersion", "dataVersionId", "t008",
    "c017SummaryId", "c017SummaryVersion"
  ];
  assertAllowedKeys(value, fields, "exactCombination");
  return Object.fromEntries(fields.map((field) => [field, assertString(value[field], `exactCombination.${field}`)]));
}

function deterministicReference(input, contentVersion, evidencePack) {
  const purpose = input.purpose;
  if (purpose === "report-question") {
    if (input.t049 || input.comparison) fail("COPILOT_CONTEXT_OVERREACH", "ordinary report questions cannot include T049 or C027 context");
    return null;
  }
  if (purpose === "t049-explanation") {
    const t049 = assertObject(input.t049, "T049 reference source");
    if (t049.runStatus !== "completed" || t049.contentVersionId !== contentVersion.contentVersionId
        || t049.evidencePackRef?.evidencePackId !== evidencePack.evidencePackId) {
      fail("T049_REFERENCE_MISMATCH", "C024 T049 explanation must bind a completed result for the exact report context");
    }
    return {
      type: "T049",
      id: assertString(t049.verificationRunId, "T049.verificationRunId"),
      version: assertString(t049.version, "T049.version"),
      status: t049.status,
      currentStatusSummaryRef: t049.currentStatusSummaryRef
    };
  }
  const comparison = assertObject(input.comparison, "C027 reference source");
  if (comparison.runStatus !== "completed" || comparison.contentVersionId !== contentVersion.contentVersionId
      || comparison.evidencePackRef?.evidencePackId !== evidencePack.evidencePackId) {
    fail("C027_REFERENCE_MISMATCH", "C024 C027 explanation must bind a formed comparison for the exact report context");
  }
  return {
    type: "C027",
    id: assertString(comparison.comparisonRecordId, "C027.comparisonRecordId"),
    version: comparison.version || "1.0.0",
    status: comparison.result,
    currentStatusSummaryRef: comparison.currentStatusSummaryRef,
    c008Ref: comparison.c008Ref
  };
}

function buildFixedReportContext(input) {
  assertObject(input, "fixed report context input");
  const artifact = assertObject(input.artifact, "published report artifact");
  const contentVersion = assertObject(input.contentVersion, "contentVersion");
  const evidencePack = assertObject(input.evidencePack, "evidencePack");
  const scenarioContext = assertScenarioRun(artifact.scenarioContext, contentVersion.scenarioContext, "published report scenarioContext");
  if (artifact.status !== "published") fail("REPORT_NOT_PUBLISHED", "official C024 requires a published report artifact");
  if (artifact.contentVersionId !== contentVersion.contentVersionId) fail("CONTENT_VERSION_MISMATCH", "published report and contentVersion do not match");
  if (artifact.evidencePackRef?.evidencePackId !== evidencePack.evidencePackId
      || artifact.evidencePackRef?.version !== evidencePack.version
      || contentVersion.evidencePackRef?.evidencePackId !== evidencePack.evidencePackId
      || contentVersion.evidencePackRef?.version !== evidencePack.version) {
    fail("EVIDENCE_PACK_MISMATCH", "published report, contentVersion and evidence pack do not match");
  }
  const anchors = assertArray(input.anchors, "anchors", { nonEmpty: true }).map((anchor, index) => {
    assertObject(anchor, `anchors[${index}]`);
    if (anchor.contentVersionId !== contentVersion.contentVersionId || !contentVersion.anchorIds.includes(anchor.t044Id)) {
      fail("ANCHOR_CONTEXT_MISMATCH", `anchor ${anchor.t044Id || index} does not belong to the exact content version`);
    }
    return {
      t044Id: assertString(anchor.t044Id, `anchors[${index}].t044Id`),
      anchorKind: assertString(anchor.anchorKind, `anchors[${index}].anchorKind`),
      sectionId: assertString(anchor.sectionId, `anchors[${index}].sectionId`),
      stableLocation: assertString(anchor.stableLocation, `anchors[${index}].stableLocation`),
      evidenceRefs: [...new Set((anchor.evidenceRefs || []).map((ref) => assertString(ref, `anchors[${index}].evidenceRef`)))]
    };
  }).sort((left, right) => left.t044Id.localeCompare(right.t044Id));
  const anchorSnapshotId = contentId("C024-AS", {
    contentVersionId: contentVersion.contentVersionId,
    anchors: anchors.map((anchor) => anchor.t044Id)
  });
  const c017Ref = normalizeC017Ref(input.c017Ref, evidencePack);
  const authorizationRef = normalizeAuthorizationRef(input.authorizationRef);
  const agentReleaseRef = normalizeAgentReleaseRef(input.agentReleaseRef);
  const semanticEvidenceRefs = Array.isArray(input.semanticEvidenceRefs)
    ? input.semanticEvidenceRefs.map((ref) => assertString(ref, "semanticEvidenceRef"))
    : [];
  const deterministicResultRef = deterministicReference(input, contentVersion, evidencePack);
  const reportRef = {
    reportId: assertString(artifact.reportId, "artifact.reportId"),
    reportNumber: assertString(artifact.reportNo, "artifact.reportNo"),
    artifactVersion: assertString(artifact.artifactVersion, "artifact.artifactVersion"),
    contentVersionId: contentVersion.contentVersionId,
    generationRunId: assertString(contentVersion.sourceDraftRef.generationRunId, "contentVersion.generationRunId")
  };
  const evidencePackRef = { evidencePackId: evidencePack.evidencePackId, version: evidencePack.version };
  const definitionRef = {
    reportDefinitionId: assertString(contentVersion.definitionRef?.reportDefinitionId, "definitionRef.reportDefinitionId"),
    version: assertString(contentVersion.definitionRef?.version, "definitionRef.version")
  };
  const templateRef = {
    templateId: assertString(contentVersion.templateRef?.templateId, "templateRef.templateId"),
    version: assertString(contentVersion.templateRef?.version, "templateRef.version")
  };
  const exactCombination = normalizeExactCombination(evidencePack.exactCombination);
  const selectionScope = assertString(input.selectionScope, "selectionScope");
  const body = {
    scenarioContext,
    reportRef,
    definitionRef,
    templateRef,
    evidencePackRef,
    anchorSnapshot: { anchorSnapshotId, version: contentVersion.contentVersionId, selectionScope, anchors },
    exactCombination,
    c017Ref,
    semanticEvidenceRefs,
    authorizationRef,
    agentReleaseRef,
    deterministicResultRef
  };
  return immutableJson({
    schemaVersion: FIXED_REPORT_CONTEXT_SCHEMA_VERSION,
    fixedContextId: contentId("C024-FCTX", body),
    version: "1.0.0",
    ...body,
    allowedEvidenceRefs: [...new Set([
      ...assertArray(evidencePack.items, "evidencePack.items", { nonEmpty: true }).map((item, index) => assertString(item.evidenceId, `evidencePack.items[${index}].evidenceId`)),
      ...anchors.flatMap((anchor) => anchor.evidenceRefs),
      ...semanticEvidenceRefs
    ])].sort(),
    immutable: true
  });
}

function buildC024Envelope(input) {
  assertObject(input, "C024 envelope input");
  if (!PURPOSES.includes(input.purpose)) fail("C024_PURPOSE_INVALID", `purpose must be one of ${PURPOSES.join(", ")}`);
  const question = assertString(input.question, "C024.question");
  const fixedReportContext = buildFixedReportContext(input);
  const requestFingerprint = sha256({
    fixedContextId: fixedReportContext.fixedContextId,
    purpose: input.purpose,
    question,
    agentReleaseRef: fixedReportContext.agentReleaseRef,
    deterministicResultRef: fixedReportContext.deterministicResultRef
  });
  const requestId = input.requestId || `C024-${requestFingerprint.slice(0, 24)}`;
  const idempotencyKey = `idem-v1:${requestFingerprint}`;
  const payload = immutableJson({
    schemaVersion: C024_SCHEMA_VERSION,
    contractId: "C024",
    requestId,
    requestFingerprint,
    scenarioContext: fixedReportContext.scenarioContext,
    fixedReportContext,
    selectionIntent: {
      purpose: input.purpose,
      selectionScope: assertString(input.selectionScope, "C024.selectionScope"),
      question
    },
    agentReleaseRef: fixedReportContext.agentReleaseRef,
    requestedBy: assertString(input.requestedBy, "C024.requestedBy"),
    requestedAt: assertString(input.requestedAt, "C024.requestedAt"),
    immutable: true
  });
  const envelope = createStrictContractEnvelope({
    eventId: input.eventId || `EVT-${requestId}`,
    eventType: C024_EVENT_TYPE,
    occurredAt: payload.requestedAt,
    actorRef: payload.requestedBy,
    correlationId: assertString(input.correlationId, "C024.correlationId"),
    traceId: assertString(input.traceId, "C024.traceId"),
    idempotencyKey,
    scenarioContext: fixedReportContext.scenarioContext,
    resourceRefs: [
      `report:${fixedReportContext.reportRef.reportId}@${fixedReportContext.reportRef.artifactVersion}`,
      `content-version:${fixedReportContext.reportRef.contentVersionId}`,
      `fixed-report-context:${fixedReportContext.fixedContextId}@${fixedReportContext.version}`,
      `agent-release:${fixedReportContext.agentReleaseRef.agentId}@${fixedReportContext.agentReleaseRef.version}`
    ],
    evidenceRefs: [
      `evidence-pack:${fixedReportContext.evidencePackRef.evidencePackId}@${fixedReportContext.evidencePackRef.version}`,
      ...fixedReportContext.anchorSnapshot.anchors.map((anchor) => `T044:${anchor.t044Id}`)
    ],
    payload,
    payloadSchemaVersion: C024_SCHEMA_VERSION
  });
  return immutableJson({ fixedReportContext, payload, envelope });
}

function acceptC024ReceiptEnvelope(envelope, expected) {
  const payload = unwrapStrictContractEnvelope(envelope, {
    scenarioContext: expected.scenarioContext,
    eventType: C024_RECEIPT_EVENT_TYPE,
    payloadSchemaVersion: C024_RECEIPT_SCHEMA_VERSION
  });
  assertAllowedKeys(payload, [
    "schemaVersion", "contractId", "requestId", "idempotencyKey", "scenarioContext",
    "fixedContextRef", "status", "receivedAt", "owner"
  ], "C024 receipt");
  assertScenarioRun(payload.scenarioContext, expected.scenarioContext, "C024 receipt scenarioContext");
  if (payload.contractId !== "C024" || payload.requestId !== expected.requestId
      || payload.idempotencyKey !== expected.idempotencyKey || payload.owner !== "M05") {
    fail("C024_RECEIPT_MISMATCH", "M05 C024 receipt does not match the submitted request");
  }
  assertExact(payload.fixedContextRef, { id: expected.fixedContextId, version: expected.fixedContextVersion }, "C024_RECEIPT_MISMATCH", "M05 C024 receipt fixed context does not match");
  if (payload.status === "rejected") fail("C024_REJECTED", "M05 rejected the C024 request", { receipt: payload });
  if (payload.status !== "accepted") fail("C024_RECEIPT_STATUS_UNKNOWN", "M05 returned an unknown C024 receipt status", { status: payload.status });
  assertDateTime(payload.receivedAt, "C024 receipt receivedAt");
  return immutableJson(payload);
}

function assertKnownStatus(status, allowed, label) {
  const value = assertString(status, `${label}.status`);
  if (!allowed.includes(value)) fail("C025_STATUS_UNKNOWN", `${label} returned an unknown status`, { status: value });
  return value;
}

function normalizeC025Resource(resource, kind, expected) {
  assertObject(resource, `C025.${kind}`);
  const fields = {
    binding: ["bindingId", "bindingVersion", "status", "scenarioContext", "fixedContextRef", "reportRef", "evidencePackRef", "anchorSnapshotRef", "agentReleaseRef", "authorizationRef", "exactCombination", "c017Ref", "deterministicResultRef"],
    session: ["sessionId", "sessionVersion", "status", "scenarioContext", "bindingId", "bindingVersion", "reportRef", "agentReleaseRef", "exactCombination"],
    run: ["runId", "runVersion", "status", "attempt", "scenarioContext", "requestId", "sessionId", "bindingId", "agentReleaseRef", "reportRef", "evidencePackRef", "exactCombination", "startedAt", "completedAt"],
    result: ["resultId", "resultVersion", "status", "type", "scenarioContext", "runId", "sessionId", "bindingId", "agentReleaseRef", "reportRef", "evidencePackRef", "exactCombination", "deterministicResultRef", "anchorRefs", "evidenceRefs", "generatedAt", "limitations"]
  }[kind];
  assertAllowedKeys(resource, fields, `C025.${kind}`);
  assertScenarioRun(resource.scenarioContext, expected.scenarioContext, `C025.${kind}.scenarioContext`);
  return resource;
}

function resourceChain(value) {
  return {
    bindingRef: { id: value.binding.bindingId, version: value.binding.bindingVersion },
    sessionRef: { id: value.session.sessionId, version: value.session.sessionVersion },
    runRef: { id: value.run.runId, version: value.run.runVersion, attempt: value.run.attempt },
    resultRef: { id: value.result.resultId, version: value.result.resultVersion }
  };
}

function observeC025ResourceChain(envelope, expected) {
  const payload = unwrapStrictContractEnvelope(envelope, {
    scenarioContext: expected.scenarioContext,
    eventType: C025_EVENT_TYPE,
    payloadSchemaVersion: C025_SCHEMA_VERSION
  });
  assertScenarioRun(payload.scenarioContext, expected.scenarioContext, "C025.scenarioContext");
  if (payload.contractId !== "C025" || payload.owner !== "M05" || payload.requestId !== expected.requestId
      || payload.idempotencyKey !== expected.idempotencyKey) {
    fail("C025_REQUEST_MISMATCH", "C025 does not match the C024 request identity");
  }
  const identity = {
    fixedContextRef: { id: expected.fixedContextId, version: expected.fixedContextVersion },
    reportRef: expected.reportRef,
    evidencePackRef: expected.evidencePackRef,
    anchorSnapshotRef: expected.anchorSnapshotRef,
    agentReleaseRef: expected.agentReleaseRef,
    exactCombination: expected.exactCombination,
    c017Ref: expected.c017Ref,
    deterministicResultRef: expected.deterministicResultRef
  };
  Object.keys(identity).forEach((field) => assertExact(payload[field], identity[field], "C025_CONTEXT_MISMATCH", `C025 ${field} does not match C024`));
  const binding = assertObject(payload.binding, "C025.binding");
  const session = assertObject(payload.session, "C025.session");
  const run = assertObject(payload.run, "C025.run");
  const result = assertObject(payload.result, "C025.result");
  [binding, session, run, result].forEach((resource, index) => assertScenarioRun(resource.scenarioContext, expected.scenarioContext, `C025 resource[${index}].scenarioContext`));
  assertExact(binding.fixedContextRef, identity.fixedContextRef, "C025_BINDING_MISMATCH", "binding fixed context mismatch");
  assertExact(binding.reportRef, identity.reportRef, "C025_BINDING_MISMATCH", "binding report mismatch");
  assertExact(binding.evidencePackRef, identity.evidencePackRef, "C025_BINDING_MISMATCH", "binding evidence pack mismatch");
  assertExact(binding.anchorSnapshotRef, identity.anchorSnapshotRef, "C025_BINDING_MISMATCH", "binding anchor snapshot mismatch");
  assertExact(binding.agentReleaseRef, identity.agentReleaseRef, "C025_AGENT_RELEASE_MISMATCH", "binding Agent Release mismatch");
  assertExact(binding.exactCombination, identity.exactCombination, "C025_BINDING_MISMATCH", "binding exact combination mismatch");
  assertExact(binding.c017Ref, identity.c017Ref, "C025_BINDING_MISMATCH", "binding C017 reference mismatch");
  assertExact(binding.deterministicResultRef, identity.deterministicResultRef, "C025_BINDING_MISMATCH", "binding deterministic result reference mismatch");
  [session.agentReleaseRef, run.agentReleaseRef, result.agentReleaseRef].forEach((ref) => assertExact(ref, identity.agentReleaseRef, "C025_AGENT_RELEASE_MISMATCH", "C025 Agent Release mismatch"));
  [session.reportRef, run.reportRef, result.reportRef].forEach((ref) => assertExact(ref, identity.reportRef, "C025_CONTEXT_MISMATCH", "C025 report identity mismatch"));
  [run.evidencePackRef, result.evidencePackRef].forEach((ref) => assertExact(ref, identity.evidencePackRef, "C025_CONTEXT_MISMATCH", "C025 evidence pack mismatch"));
  [session.exactCombination, run.exactCombination, result.exactCombination].forEach((value) => assertExact(value, identity.exactCombination, "C025_CONTEXT_MISMATCH", "C025 exact combination mismatch"));
  assertExact(result.deterministicResultRef, identity.deterministicResultRef, "C025_CONTEXT_MISMATCH", "C025 deterministic result reference mismatch");
  assertString(binding.bindingId, "C025.binding.bindingId");
  assertString(binding.bindingVersion, "C025.binding.bindingVersion");
  assertString(session.sessionId, "C025.session.sessionId");
  assertString(session.sessionVersion, "C025.session.sessionVersion");
  assertString(run.runId, "C025.run.runId");
  assertString(run.runVersion, "C025.run.runVersion");
  assertString(result.resultId, "C025.result.resultId");
  assertString(result.resultVersion, "C025.result.resultVersion");
  if (!Number.isInteger(run.attempt) || run.attempt < 1) fail("C025_RUN_ATTEMPT_INVALID", "C025 run attempt must be a positive integer");
  if (session.bindingId !== binding.bindingId || session.bindingVersion !== binding.bindingVersion
      || run.bindingId !== binding.bindingId || result.bindingId !== binding.bindingId
      || run.sessionId !== session.sessionId || result.sessionId !== session.sessionId
      || result.runId !== run.runId || run.requestId !== expected.requestId) {
    fail("C025_RESOURCE_CHAIN_MISMATCH", "C025 Binding, Session, Run and Result references are not one chain");
  }
  if ([expected.generationRunId, expected.t049RunId].filter(Boolean).includes(run.runId)) {
    fail("C025_RUN_REUSED", "report copilot Run must be independent from generation and T049 Runs");
  }
  const refs = resourceChain({ binding, session, run, result });
  return immutableJson({
    requestId: expected.requestId,
    ...refs,
    resourceChainFingerprint: sha256(refs)
  });
}

function acceptC025Envelope(envelope, expected) {
  const payload = unwrapStrictContractEnvelope(envelope, {
    scenarioContext: expected.scenarioContext,
    eventType: C025_EVENT_TYPE,
    payloadSchemaVersion: C025_SCHEMA_VERSION
  });
  assertAllowedKeys(payload, [
    "schemaVersion", "contractId", "requestId", "idempotencyKey", "scenarioContext", "fixedContextRef",
    "reportRef", "evidencePackRef", "anchorSnapshotRef", "agentReleaseRef", "exactCombination", "c017Ref",
    "deterministicResultRef", "binding", "session", "run", "result", "formedAt", "owner"
  ], "C025");
  assertScenarioRun(payload.scenarioContext, expected.scenarioContext, "C025.scenarioContext");
  if (payload.contractId !== "C025" || payload.owner !== "M05" || payload.requestId !== expected.requestId
      || payload.idempotencyKey !== expected.idempotencyKey) {
    fail("C025_REQUEST_MISMATCH", "C025 does not match the C024 request identity");
  }
  const identity = {
    fixedContextRef: { id: expected.fixedContextId, version: expected.fixedContextVersion },
    reportRef: expected.reportRef,
    evidencePackRef: expected.evidencePackRef,
    anchorSnapshotRef: expected.anchorSnapshotRef,
    agentReleaseRef: expected.agentReleaseRef,
    exactCombination: expected.exactCombination,
    c017Ref: expected.c017Ref,
    deterministicResultRef: expected.deterministicResultRef
  };
  Object.keys(identity).forEach((field) => assertExact(payload[field], identity[field], "C025_CONTEXT_MISMATCH", `C025 ${field} does not match C024`));

  const binding = normalizeC025Resource(payload.binding, "binding", expected);
  const session = normalizeC025Resource(payload.session, "session", expected);
  const run = normalizeC025Resource(payload.run, "run", expected);
  const result = normalizeC025Resource(payload.result, "result", expected);
  assertDateTime(payload.formedAt, "C025.formedAt");
  assertString(binding.bindingId, "C025.binding.bindingId");
  assertString(binding.bindingVersion, "C025.binding.bindingVersion");
  assertString(session.sessionId, "C025.session.sessionId");
  assertString(session.sessionVersion, "C025.session.sessionVersion");
  assertString(run.runId, "C025.run.runId");
  assertString(run.runVersion, "C025.run.runVersion");
  if (!Number.isInteger(run.attempt) || run.attempt < 1) fail("C025_RUN_ATTEMPT_INVALID", "C025 run attempt must be a positive integer");
  assertDateTime(run.startedAt, "C025.run.startedAt");
  assertDateTime(run.completedAt, "C025.run.completedAt");
  assertString(result.resultId, "C025.result.resultId");
  assertString(result.resultVersion, "C025.result.resultVersion");
  assertDateTime(result.generatedAt, "C025.result.generatedAt");
  assertString(result.limitations, "C025.result.limitations");
  const resultAnchorRefs = assertArray(result.anchorRefs, "C025.result.anchorRefs");
  const resultEvidenceRefs = assertArray(result.evidenceRefs, "C025.result.evidenceRefs");
  assertExact(binding.fixedContextRef, identity.fixedContextRef, "C025_BINDING_MISMATCH", "binding fixed context mismatch");
  assertExact(binding.reportRef, identity.reportRef, "C025_BINDING_MISMATCH", "binding report mismatch");
  assertExact(binding.evidencePackRef, identity.evidencePackRef, "C025_BINDING_MISMATCH", "binding evidence pack mismatch");
  assertExact(binding.anchorSnapshotRef, identity.anchorSnapshotRef, "C025_BINDING_MISMATCH", "binding anchor snapshot mismatch");
  assertExact(binding.agentReleaseRef, identity.agentReleaseRef, "C025_AGENT_RELEASE_MISMATCH", "binding Agent Release mismatch");
  assertExact(binding.authorizationRef, expected.authorizationRef, "C025_BINDING_MISMATCH", "binding authorization mismatch");
  assertExact(binding.exactCombination, identity.exactCombination, "C025_BINDING_MISMATCH", "binding exact semantic/data/T008 combination mismatch");
  assertExact(binding.c017Ref, identity.c017Ref, "C025_BINDING_MISMATCH", "binding C017 reference mismatch");
  assertExact(binding.deterministicResultRef, identity.deterministicResultRef, "C025_BINDING_MISMATCH", "binding deterministic result reference mismatch");
  [session.agentReleaseRef, run.agentReleaseRef, result.agentReleaseRef].forEach((ref) => assertExact(ref, identity.agentReleaseRef, "C025_AGENT_RELEASE_MISMATCH", "C025 Agent Release mismatch"));
  [session.reportRef, run.reportRef, result.reportRef].forEach((ref) => assertExact(ref, identity.reportRef, "C025_CONTEXT_MISMATCH", "C025 report identity mismatch"));
  [run.evidencePackRef, result.evidencePackRef].forEach((ref) => assertExact(ref, identity.evidencePackRef, "C025_CONTEXT_MISMATCH", "C025 evidence pack mismatch"));
  [session.exactCombination, run.exactCombination, result.exactCombination].forEach((value) => assertExact(value, identity.exactCombination, "C025_CONTEXT_MISMATCH", "C025 exact semantic/data/T008 combination mismatch"));
  assertExact(result.deterministicResultRef, identity.deterministicResultRef, "C025_CONTEXT_MISMATCH", "C025 result deterministic reference mismatch");
  if (session.bindingId !== binding.bindingId || session.bindingVersion !== binding.bindingVersion
      || run.bindingId !== binding.bindingId || result.bindingId !== binding.bindingId
      || run.sessionId !== session.sessionId || result.sessionId !== session.sessionId
      || result.runId !== run.runId || run.requestId !== expected.requestId) {
    fail("C025_RESOURCE_CHAIN_MISMATCH", "C025 Binding, Session, Run and Result references are not one chain");
  }
  if ([expected.generationRunId, expected.t049RunId].filter(Boolean).includes(run.runId)) {
    fail("C025_RUN_REUSED", "report copilot Run must be independent from generation and T049 Runs");
  }
  const bindingStatus = assertKnownStatus(binding.status, BINDING_STATUSES, "binding");
  const sessionStatus = assertKnownStatus(session.status, SESSION_STATUSES, "session");
  const runStatus = assertKnownStatus(run.status, RUN_STATUSES, "run");
  const resultStatus = assertKnownStatus(result.status, RESULT_STATUSES, "result");
  const expectedResultType = expected.purpose === "report-question" ? "report-copilot-answer" : "report-copilot-explanation";
  if (result.type !== expectedResultType) fail("C025_RESULT_TYPE_MISMATCH", `C025 result type must be ${expectedResultType}`);
  const unknownAnchors = resultAnchorRefs.filter((ref) => !expected.anchorIds.includes(ref));
  const unknownEvidence = resultEvidenceRefs.filter((ref) => !expected.allowedEvidenceRefs.includes(ref));
  if (unknownAnchors.length || unknownEvidence.length) {
    fail("C025_RESULT_REFERENCE_MISMATCH", "C025 result references anchors or evidence outside the fixed report context", { unknownAnchors, unknownEvidence });
  }
  if (!resultAnchorRefs.length || !resultEvidenceRefs.length) fail("C025_RESULT_REFERENCE_MISSING", "C025 result must reference fixed anchors and evidence");
  const successful = bindingStatus === "active" && sessionStatus === "active" && runStatus === "complete" && resultStatus === "complete";
  const outcome = successful ? "complete" : [runStatus, resultStatus].includes("failed") ? "failed" : "limited";
  const resourceChainFingerprint = sha256(resourceChain({ binding, session, run, result }));
  const reference = immutableJson({
    schemaVersion: "ofw.m06.c025-reference.v1",
    contractId: "C025",
    c025ReferenceId: contentId("C025-REF", {
      requestId: expected.requestId,
      bindingId: binding.bindingId,
      sessionId: session.sessionId,
      runId: run.runId,
      resultId: result.resultId
    }),
    requestId: expected.requestId,
    idempotencyKey: expected.idempotencyKey,
    scenarioContext: expected.scenarioContext,
    fixedContextRef: identity.fixedContextRef,
    reportRef: identity.reportRef,
    evidencePackRef: identity.evidencePackRef,
    anchorSnapshotRef: identity.anchorSnapshotRef,
    agentReleaseRef: identity.agentReleaseRef,
    bindingRef: { id: binding.bindingId, version: binding.bindingVersion, status: bindingStatus },
    sessionRef: { id: session.sessionId, version: session.sessionVersion, status: sessionStatus },
    runRef: { id: run.runId, version: run.runVersion, attempt: run.attempt, status: runStatus },
    resultRef: { id: result.resultId, version: result.resultVersion, type: result.type, status: resultStatus, generatedAt: result.generatedAt },
    resourceChainFingerprint,
    anchorRefs: [...resultAnchorRefs],
    evidenceRefs: [...resultEvidenceRefs],
    outcome,
    successful,
    owner: "M05",
    readOnly: true,
    immutable: true
  });
  return immutableJson({ reference, referenceFingerprint: sha256(reference), resourceChainFingerprint });
}

function buildC025ReadEnvelope(input) {
  assertObject(input, "C025 read input");
  const payload = immutableJson({
    schemaVersion: C025_READ_SCHEMA_VERSION,
    requestId: assertString(input.requestId, "C025 read requestId"),
    idempotencyKey: assertString(input.idempotencyKey, "C025 read idempotencyKey"),
    sourceIdempotencyKey: assertString(input.sourceIdempotencyKey, "C025 read sourceIdempotencyKey"),
    scenarioContext: assertScenarioRun(input.scenarioContext, null),
    fixedContextRef: input.fixedContextRef,
    bindingRef: input.bindingRef || null,
    sessionRef: input.sessionRef || null,
    runRef: input.runRef || null,
    resultRef: input.resultRef || null,
    requestedAt: assertString(input.requestedAt, "C025 read requestedAt")
  });
  return createStrictContractEnvelope({
    eventId: input.eventId || `EVT-C025-READ-${payload.requestId}`,
    eventType: C025_READ_EVENT_TYPE,
    occurredAt: payload.requestedAt,
    actorRef: input.actorRef,
    correlationId: input.correlationId,
    traceId: input.traceId,
    idempotencyKey: payload.idempotencyKey,
    scenarioContext: payload.scenarioContext,
    resourceRefs: [
      payload.bindingRef && `binding:${payload.bindingRef.id}@${payload.bindingRef.version}`,
      payload.sessionRef && `session:${payload.sessionRef.id}@${payload.sessionRef.version}`,
      payload.runRef && `run:${payload.runRef.id}@${payload.runRef.version}`,
      payload.resultRef && `result:${payload.resultRef.id}@${payload.resultRef.version}`
    ].filter(Boolean),
    evidenceRefs: [],
    payload,
    payloadSchemaVersion: C025_READ_SCHEMA_VERSION
  });
}

function expectedC025Context(c024Envelope) {
  const c024 = unwrapStrictContractEnvelope(c024Envelope, {
    eventType: C024_EVENT_TYPE,
    payloadSchemaVersion: C024_SCHEMA_VERSION
  });
  const context = c024.fixedReportContext;
  return immutableJson({
    requestId: c024.requestId,
    idempotencyKey: c024Envelope.idempotencyKey,
    purpose: c024.selectionIntent.purpose,
    scenarioContext: c024.scenarioContext,
    fixedContextId: context.fixedContextId,
    fixedContextVersion: context.version,
    reportRef: context.reportRef,
    evidencePackRef: context.evidencePackRef,
    anchorSnapshotRef: { id: context.anchorSnapshot.anchorSnapshotId, version: context.anchorSnapshot.version },
    anchorIds: context.anchorSnapshot.anchors.map((anchor) => anchor.t044Id),
    allowedEvidenceRefs: context.allowedEvidenceRefs,
    agentReleaseRef: context.agentReleaseRef,
    authorizationRef: context.authorizationRef,
    exactCombination: context.exactCombination,
    c017Ref: context.c017Ref,
    deterministicResultRef: context.deterministicResultRef,
    generationRunId: context.reportRef.generationRunId,
    t049RunId: context.deterministicResultRef?.type === "T049" ? context.deterministicResultRef.id : null
  });
}

module.exports = Object.freeze({
  FIXED_REPORT_CONTEXT_SCHEMA_VERSION,
  C024_SCHEMA_VERSION,
  C024_RECEIPT_SCHEMA_VERSION,
  C025_SCHEMA_VERSION,
  C025_READ_SCHEMA_VERSION,
  C024_EVENT_TYPE,
  C024_RECEIPT_EVENT_TYPE,
  C025_EVENT_TYPE,
  C025_READ_EVENT_TYPE,
  PURPOSES,
  buildFixedReportContext,
  buildC024Envelope,
  acceptC024ReceiptEnvelope,
  observeC025ResourceChain,
  acceptC025Envelope,
  buildC025ReadEnvelope,
  expectedC025Context
});
