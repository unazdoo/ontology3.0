"use strict";

const { fail } = require("./errors");
const {
  assertObject,
  assertString,
  assertArray,
  assertScenarioRun,
  sameScenarioRun,
  immutableJson,
  contentId,
  sha256
} = require("./utils");
const { MANAGED_DEFINITION_SCHEMA_VERSION, MANAGED_TEMPLATE_SCHEMA_VERSION } = require("./definition");
const { FIXED_CONTEXT_SCHEMA_VERSION } = require("./gate");

const EVIDENCE_PACK_SCHEMA_VERSION = "ofw.c022.report-evidence-pack.v1";
const C022_SCHEMA_VERSION = "ofw.c022.report-generation-request.v1";
const C023_SCHEMA_VERSION = "ofw.c023.agent-report-draft.v1";
const REVIEW_COPY_SCHEMA_VERSION = "ofw.m06.review-copy.v1";
const CONTENT_VERSION_SCHEMA_VERSION = "ofw.m06.report-content-version.v1";
const T044_SCHEMA_VERSION = "ofw.t044.stable-report-anchor.v1";

const FORBIDDEN_RAW_KEYS = /^(?:rawRows?|rows?|workbook|worksheet|filePath|sourceFile|sql|prompt|promptBody|t002|t007Members?|businessRows?)$/i;
const FORBIDDEN_C023_KEYS = /^(?:html|pdf|script|javascript|t044|anchorId|domPath|pdfPage|formula|calculation)$/i;

function assertAllowedKeys(value, allowed, label) {
  const unknownFields = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unknownFields.length) fail("UNKNOWN_CONTRACT_FIELD", `${label} contains unknown fields`, { unknownFields });
}

function findForbiddenKeys(value, pattern, path = "$", findings = [], seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return findings;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, pattern, `${path}[${index}]`, findings, seen));
    return findings;
  }
  Object.keys(value).forEach((key) => {
    if (pattern.test(key)) findings.push(`${path}.${key}`);
    findForbiddenKeys(value[key], pattern, `${path}.${key}`, findings, seen);
  });
  return findings;
}

function buildEvidencePack(input) {
  assertObject(input, "evidence pack input");
  const definition = input.definition;
  const template = input.template;
  const fixedContext = input.fixedContext;
  if (definition?.schemaVersion !== MANAGED_DEFINITION_SCHEMA_VERSION) fail("INVALID_DEFINITION", "managed report definition is required");
  if (template?.schemaVersion !== MANAGED_TEMPLATE_SCHEMA_VERSION) fail("INVALID_TEMPLATE", "managed report template is required");
  if (fixedContext?.schemaVersion !== FIXED_CONTEXT_SCHEMA_VERSION) fail("INVALID_FIXED_CONTEXT", "three-gate fixed report context is required");
  const allowedSlots = new Map(definition.evidenceSlots.map((slot) => [slot.evidenceSlotId, slot]));
  const items = assertArray(input.evidenceItems, "evidenceItems", { nonEmpty: true }).map((item, index) => {
    assertObject(item, `evidenceItems[${index}]`);
    const forbidden = findForbiddenKeys(item, FORBIDDEN_RAW_KEYS);
    if (forbidden.length) fail("RAW_DATA_FORBIDDEN", "C022 evidence pack cannot contain raw or unmanaged source data", { paths: forbidden });
    const normalized = {
      evidenceId: assertString(item.evidenceId, `evidenceItems[${index}].evidenceId`),
      version: assertString(item.version, `evidenceItems[${index}].version`),
      evidenceType: assertString(item.evidenceType, `evidenceItems[${index}].evidenceType`),
      evidenceSlotId: assertString(item.evidenceSlotId, `evidenceItems[${index}].evidenceSlotId`),
      immutableRef: assertString(item.immutableRef, `evidenceItems[${index}].immutableRef`),
      sourceOwner: assertString(item.sourceOwner, `evidenceItems[${index}].sourceOwner`),
      structuredValue: item.structuredValue === undefined ? null : item.structuredValue,
      unit: item.unit || null,
      precision: item.precision ?? null,
      rounding: item.rounding || null,
      objectScope: item.objectScope || null,
      semanticRef: item.semanticRef || null,
      resultRef: item.resultRef || null,
      semanticVersionId: item.semanticVersionId || null,
      dataVersionId: item.dataVersionId || null,
      t008: item.t008 || null,
      evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : [],
      fixedAt: assertString(item.fixedAt || input.fixedAt, `evidenceItems[${index}].fixedAt`),
      accessible: item.accessible !== false,
      authorized: item.authorized !== false,
      immutable: true
    };
    const slot = allowedSlots.get(normalized.evidenceSlotId);
    if (!slot) fail("EVIDENCE_OUT_OF_SCOPE", `evidence item ${normalized.evidenceId} targets an unknown evidence slot`);
    ["semanticVersionId", "dataVersionId", "t008"].forEach((field) => {
      if (normalized[field] !== null && normalized[field] !== fixedContext.exactCombination[field === "semanticVersionId" ? "semanticVersionId" : field === "dataVersionId" ? "dataVersionId" : "t008"]) {
        fail("EVIDENCE_VERSION_MISMATCH", `evidence item ${normalized.evidenceId} does not bind the fixed ${field}`);
      }
    });
    if (!slot.allowedEvidenceTypes.includes(normalized.evidenceType)) {
      fail("EVIDENCE_TYPE_NOT_ALLOWED", `evidence item ${normalized.evidenceId} type is not allowed in ${slot.evidenceSlotId}`);
    }
    return normalized;
  });
  const ids = new Set();
  items.forEach((item) => {
    if (ids.has(item.evidenceId)) fail("DUPLICATE_EVIDENCE_ID", `evidence item ${item.evidenceId} is duplicated`);
    ids.add(item.evidenceId);
  });
  const missingSlots = definition.evidenceSlots
    .filter((slot) => slot.required && !items.some((item) => item.evidenceSlotId === slot.evidenceSlotId))
    .map((slot) => slot.evidenceSlotId);
  if (missingSlots.length) fail("REQUIRED_EVIDENCE_MISSING", "required report evidence slots are missing", { missingSlots });
  const packBody = {
    scenarioContext: fixedContext.scenarioContext,
    definitionRef: `${definition.reportDefinitionId}@${definition.version}`,
    templateRef: `${template.templateId}@${template.version}`,
    fixedContextId: fixedContext.fixedContextId,
    exactCombination: fixedContext.exactCombination,
    generationBindingSummary: fixedContext.generationBindingSummary,
    gateReadIds: fixedContext.gateReadIds,
    items
  };
  return immutableJson({
    schemaVersion: EVIDENCE_PACK_SCHEMA_VERSION,
    evidencePackId: input.evidencePackId || contentId("EP", packBody),
    version: input.version || "1.0.0",
    ...packBody,
    completeness: { status: "complete", required: definition.evidenceSlots.filter((slot) => slot.required).length, missing: 0 },
    fixedAt: assertString(input.fixedAt, "evidencePack.fixedAt"),
    contentHash: sha256(packBody),
    immutable: true
  });
}

function buildC022Request(input) {
  assertObject(input, "C022 input");
  const definition = input.definition;
  const template = input.template;
  const evidencePack = input.evidencePack;
  if (evidencePack?.schemaVersion !== EVIDENCE_PACK_SCHEMA_VERSION) fail("INVALID_EVIDENCE_PACK", "fixed C022 evidence pack is required");
  assertScenarioRun(input.scenarioContext, evidencePack.scenarioContext, "C022.scenarioContext");
  const request = {
    schemaVersion: C022_SCHEMA_VERSION,
    contractId: "C022",
    requestId: assertString(input.requestId, "C022.requestId"),
    scenarioContext: input.scenarioContext,
    reportContext: { scenarioContext: input.scenarioContext, reportAggregateId: input.reportAggregateId, objectScope: input.objectScope, generationScope: input.generationScope },
    reportAggregateId: assertString(input.reportAggregateId, "C022.reportAggregateId"),
    definitionRef: { reportDefinitionId: definition.reportDefinitionId, version: definition.version },
    templateRef: { templateId: template.templateId, version: template.version },
    reportDefinition: definition,
    template,
    objectScope: input.objectScope,
    generationScope: input.generationScope,
    evidencePack,
    evidencePackId: evidencePack.evidencePackId,
    evidencePackVersion: evidencePack.version,
    fixedContext: input.fixedContext,
    agentRef: definition.agentRef,
    skillRef: definition.skillRef,
    allowedContentTypes: definition.contentPolicy.allowedContentTypes,
    requestedAt: assertString(input.requestedAt, "C022.requestedAt"),
    status: "submitted",
    statusLabel: "已提交",
    idempotencyKey: assertString(input.idempotencyKey, "C022.idempotencyKey"),
    immutable: true
  };
  return immutableJson(request);
}

function normalizeC023ContentItem(item, index, c022, definition, template) {
  assertObject(item, `C023.contentItems[${index}]`);
  assertAllowedKeys(item, [
    "sourceContentItemId", "contentItemId", "parentContentItemId", "order", "templateSlotId",
    "templateSlot", "contentType", "structuredContent", "evidenceRefs", "facts", "warnings"
  ], `C023.contentItems[${index}]`);
  const forbidden = findForbiddenKeys(item, FORBIDDEN_C023_KEYS);
  if (forbidden.length) fail("C023_OWNER_BOUNDARY_VIOLATION", "M05 C023 cannot contain T044, HTML/PDF, scripts or formal calculations", { paths: forbidden });
  const slotId = assertString(item.templateSlotId || item.templateSlot, `C023.contentItems[${index}].templateSlotId`);
  const slot = template.slots.find((candidate) => candidate.templateSlotId === slotId);
  if (!slot) fail("C023_TEMPLATE_SLOT_MISMATCH", `C023 content item targets unknown template slot ${slotId}`);
  const contentType = assertString(item.contentType, `C023.contentItems[${index}].contentType`);
  if (contentType !== slot.contentType || !definition.contentPolicy.allowedContentTypes.includes(contentType)) {
    fail("C023_CONTENT_TYPE_NOT_ALLOWED", `C023 content type ${contentType} is not allowed in ${slotId}`);
  }
  const structuredText = typeof item.structuredContent === "string"
    ? item.structuredContent
    : item.structuredContent && typeof item.structuredContent.text === "string"
      ? item.structuredContent.text
      : "";
  if (/<\/?(?:script|style|iframe|object)\b|javascript:/i.test(structuredText)) {
    fail("C023_ARBITRARY_HTML_FORBIDDEN", `C023 content item ${item.sourceContentItemId || item.contentItemId} contains executable markup`);
  }
  const packEvidenceIds = new Set(c022.evidencePack.items.map((evidence) => evidence.evidenceId));
  const evidenceRefs = assertArray(item.evidenceRefs, `C023.contentItems[${index}].evidenceRefs`);
  const invalidEvidenceRefs = evidenceRefs.filter((ref) => !packEvidenceIds.has(ref));
  if (invalidEvidenceRefs.length) fail("C023_EVIDENCE_OUT_OF_PACK", "C023 content item references evidence outside the fixed pack", { invalidEvidenceRefs });
  const facts = Array.isArray(item.facts) ? item.facts.map((fact, factIndex) => {
    assertObject(fact, `C023.contentItems[${index}].facts[${factIndex}]`);
    assertAllowedKeys(fact, [
      "factId", "kind", "value", "unit", "evidenceRefs", "semanticRef", "resultRef",
      "tolerance", "required", "humanConfirmationRequired", "agentCalculated"
    ], `C023.contentItems[${index}].facts[${factIndex}]`);
    const factEvidenceRefs = assertArray(fact.evidenceRefs, `fact ${fact.factId} evidenceRefs`, { nonEmpty: true });
    const invalid = factEvidenceRefs.filter((ref) => !packEvidenceIds.has(ref));
    if (invalid.length) fail("C023_EVIDENCE_OUT_OF_PACK", `fact ${fact.factId} references evidence outside the fixed pack`, { invalid });
    return {
      factId: assertString(fact.factId, "C023.factId"),
      kind: assertString(fact.kind, "C023.fact.kind"),
      value: fact.value,
      unit: fact.unit || null,
      evidenceRefs: factEvidenceRefs,
      semanticRef: fact.semanticRef || null,
      resultRef: fact.resultRef || null,
      tolerance: fact.tolerance ?? definition.calculationPolicy.defaultTolerance,
      required: fact.required !== false,
      humanConfirmationRequired: fact.humanConfirmationRequired === true,
      agentCalculated: fact.agentCalculated === true
    };
  }) : [];
  return {
    sourceContentItemId: assertString(item.sourceContentItemId || item.contentItemId, `C023.contentItems[${index}].sourceContentItemId`),
    parentContentItemId: item.parentContentItemId || null,
    order: Number.isInteger(item.order) ? item.order : index + 1,
    sectionId: slot.sectionId,
    templateSlotId: slotId,
    contentType,
    structuredContent: item.structuredContent,
    evidenceRefs,
    facts,
    warnings: Array.isArray(item.warnings) ? item.warnings : []
  };
}

function acceptC023Draft(raw, c022, definition, template) {
  assertObject(raw, "C023");
  assertAllowedKeys(raw, [
    "schemaVersion", "contractId", "requestId", "c022RequestId", "request", "scenarioContext",
    "reportContext", "evidencePackId", "evidencePackVersion", "evidencePack", "generationRun",
    "generationRunId", "generationStatus", "agentId", "agentReleaseVersion", "agentVersion",
    "generatedAt", "sourceDraftId", "version", "contentItems", "missingSections", "warnings",
    "handoffReceipt", "handoffReceiptId", "receivedAt"
  ], "C023");
  if (raw.schemaVersion !== C023_SCHEMA_VERSION) fail("C023_SCHEMA_MISMATCH", `C023 schemaVersion must be ${C023_SCHEMA_VERSION}`);
  const requestId = raw.requestId || raw.c022RequestId || raw.request?.requestId;
  const scenarioContext = raw.scenarioContext || raw.reportContext?.scenarioContext;
  const evidencePackId = raw.evidencePackId || raw.evidencePack?.evidencePackId || raw.evidencePack?.id;
  const evidencePackVersion = raw.evidencePackVersion || raw.evidencePack?.version;
  if (requestId !== c022.requestId) fail("C023_REQUEST_MISMATCH", "C023 does not answer the submitted C022 request");
  if (!sameScenarioRun(scenarioContext, c022.scenarioContext)) fail("C023_CONTEXT_MISMATCH", "C023 scenario run does not match C022");
  if (evidencePackId !== c022.evidencePack.evidencePackId || evidencePackVersion !== c022.evidencePack.version) {
    fail("C023_EVIDENCE_PACK_MISMATCH", "C023 does not bind the exact C022 evidence pack");
  }
  const run = assertObject(raw.generationRun || {
    runId: raw.generationRunId,
    status: raw.generationStatus || "completed",
    agentId: raw.agentId,
    releaseVersion: raw.agentReleaseVersion || raw.agentVersion,
    completedAt: raw.generatedAt
  }, "C023.generationRun");
  assertAllowedKeys(run, ["runId", "status", "agentId", "releaseVersion", "completedAt"], "C023.generationRun");
  if (raw.handoffReceipt) assertAllowedKeys(raw.handoffReceipt, ["receiptId", "acceptedAt"], "C023.handoffReceipt");
  const generationRunId = assertString(run.runId, "C023.generationRun.runId");
  const generationAgentId = assertString(run.agentId, "C023.generationRun.agentId");
  const generationReleaseVersion = assertString(run.releaseVersion, "C023.generationRun.releaseVersion");
  if (generationRunId === c022.requestId) {
    fail("RUN_ID_REUSED", "M05 generation Run must have an identity distinct from C022");
  }
  const normalizedRunStatus = run.status === "succeeded" ? "completed" : run.status;
  if (normalizedRunStatus !== "completed") fail("C023_GENERATION_INCOMPLETE", "C023 can only be accepted from a completed M05 generation run");
  if (generationAgentId !== c022.agentRef.agentId || generationReleaseVersion !== c022.agentRef.releaseVersion) {
    fail("C023_AGENT_VERSION_MISMATCH", "C023 generation run does not match the fixed Agent release");
  }
  const contentItems = assertArray(raw.contentItems, "C023.contentItems", { nonEmpty: true })
    .map((item, index) => normalizeC023ContentItem(item, index, c022, definition, template));
  const contentIds = new Set();
  contentItems.forEach((item) => {
    if (contentIds.has(item.sourceContentItemId)) fail("C023_DUPLICATE_CONTENT_ID", `duplicate C023 source content item ${item.sourceContentItemId}`);
    contentIds.add(item.sourceContentItemId);
  });
  const sourceDraft = {
    schemaVersion: C023_SCHEMA_VERSION,
    contractId: "C023",
    sourceDraftId: assertString(raw.sourceDraftId, "C023.sourceDraftId"),
    version: assertString(raw.version, "C023.version"),
    requestId: c022.requestId,
    scenarioContext: c022.scenarioContext,
    evidencePackId: c022.evidencePack.evidencePackId,
    evidencePackVersion: c022.evidencePack.version,
    contentItems,
    missingSections: Array.isArray(raw.missingSections) ? raw.missingSections : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    status: "received",
    statusLabel: "已接收",
    generationRun: {
      runId: generationRunId,
      agentId: generationAgentId,
      releaseVersion: generationReleaseVersion,
      skillId: c022.skillRef.skillId,
      skillVersion: c022.skillRef.version,
      generatedAt: assertString(run.completedAt || raw.generatedAt, "C023.generatedAt")
    },
    handoffReceipt: {
      receiptId: assertString(raw.handoffReceipt?.receiptId || raw.handoffReceiptId, "C023.handoffReceipt.receiptId"),
      sourceOwner: "M05",
      targetOwner: "M06",
      acceptedAt: assertString(raw.handoffReceipt?.acceptedAt || raw.receivedAt || raw.generatedAt, "C023.handoffReceipt.acceptedAt")
    },
    immutable: true
  };
  sourceDraft.generationRunId = sourceDraft.generationRun.runId;
  sourceDraft.agentReleaseVersion = sourceDraft.generationRun.releaseVersion;
  sourceDraft.generatedAt = sourceDraft.generationRun.generatedAt;
  sourceDraft.handoffReceiptId = sourceDraft.handoffReceipt.receiptId;
  return immutableJson(sourceDraft);
}

function createReviewArtifacts(input) {
  const sourceDraft = input.sourceDraft;
  const definition = input.definition;
  const evidencePack = input.evidencePack;
  if (sourceDraft?.schemaVersion !== C023_SCHEMA_VERSION) fail("INVALID_SOURCE_DRAFT", "accepted C023 source draft is required");
  const contentVersionId = input.contentVersionId || contentId("CV", {
    requestId: sourceDraft.requestId,
    sourceDraftId: sourceDraft.sourceDraftId,
    sourceDraftVersion: sourceDraft.version,
    evidencePackId: evidencePack.evidencePackId,
    reviewRevision: input.reviewRevision || 1
  });
  const reviewCopyId = input.reviewCopyId || contentId("RCP", { contentVersionId, sourceDraftId: sourceDraft.sourceDraftId });
  const anchors = sourceDraft.contentItems.map((item) => immutableJson({
    schemaVersion: T044_SCHEMA_VERSION,
    contractId: "T044",
    t044Id: contentId("T044", { contentVersionId, sourceContentItemId: item.sourceContentItemId }),
    reportAggregateId: assertString(input.reportAggregateId, "reportAggregateId"),
    contentVersionId,
    sourceDraftId: sourceDraft.sourceDraftId,
    sourceContentItemId: item.sourceContentItemId,
    sectionId: item.sectionId,
    templateSlotId: item.templateSlotId,
    anchorKind: input.template.slots.find((slot) => slot.templateSlotId === item.templateSlotId).anchorKind,
    stableLocation: `${item.sectionId}:${item.templateSlotId}:${item.sourceContentItemId}`,
    factRefs: item.facts.map((fact) => fact.factId),
    evidenceRefs: [...new Set([...(item.evidenceRefs || []), ...item.facts.flatMap((fact) => fact.evidenceRefs || [])])],
    bindingVersion: "1.0.0",
    immutable: true
  }));
  const factInventory = sourceDraft.contentItems.flatMap((item) => item.facts.map((fact) => ({
    ...fact,
    sourceContentItemId: item.sourceContentItemId,
    sectionId: item.sectionId,
    templateSlotId: item.templateSlotId,
    t044Ids: anchors.filter((anchor) => anchor.sourceContentItemId === item.sourceContentItemId).map((anchor) => anchor.t044Id)
  })));
  const unboundItems = sourceDraft.contentItems.filter((item) => item.contentType !== "heading"
    && new Set([...(item.evidenceRefs || []), ...item.facts.flatMap((fact) => fact.evidenceRefs || [])]).size === 0);
  const planned = factInventory.length + unboundItems.length;
  const bound = factInventory.filter((fact) => fact.evidenceRefs.length > 0 && fact.t044Ids.length > 0).length;
  const contentVersion = immutableJson({
    schemaVersion: CONTENT_VERSION_SCHEMA_VERSION,
    contentVersionId,
    reportAggregateId: input.reportAggregateId,
    scenarioContext: sourceDraft.scenarioContext,
    sourceDraftRef: { sourceDraftId: sourceDraft.sourceDraftId, version: sourceDraft.version, generationRunId: sourceDraft.generationRun.runId },
    definitionRef: { reportDefinitionId: definition.reportDefinitionId, version: definition.version },
    templateRef: { templateId: input.template.templateId, version: input.template.version },
    evidencePackRef: { evidencePackId: evidencePack.evidencePackId, version: evidencePack.version },
    contentItems: sourceDraft.contentItems,
    missingSections: sourceDraft.missingSections,
    factInventory,
    anchorIds: anchors.map((anchor) => anchor.t044Id),
    coverage: {
      planned,
      applicable: planned,
      bound,
      unbound: planned - bound,
      unclassified: 0,
      skipped: 0,
      verified: 0,
      executionErrors: 0,
      coverageRate: planned === 0 ? 0 : bound / planned
    },
    status: "review",
    formedAt: assertString(input.formedAt, "contentVersion.formedAt"),
    immutable: true
  });
  const reviewCopy = immutableJson({
    schemaVersion: REVIEW_COPY_SCHEMA_VERSION,
    reviewCopyId,
    contentVersionId,
    sourceDraftId: sourceDraft.sourceDraftId,
    revision: input.reviewRevision || 1,
    contentItems: sourceDraft.contentItems,
    humanDiffs: [],
    reviewStatus: "pending",
    formedAt: input.formedAt,
    immutable: true
  });
  return immutableJson({ reviewCopy, contentVersion, anchors });
}

module.exports = Object.freeze({
  EVIDENCE_PACK_SCHEMA_VERSION,
  C022_SCHEMA_VERSION,
  C023_SCHEMA_VERSION,
  REVIEW_COPY_SCHEMA_VERSION,
  CONTENT_VERSION_SCHEMA_VERSION,
  T044_SCHEMA_VERSION,
  buildEvidencePack,
  buildC022Request,
  acceptC023Draft,
  createReviewArtifacts,
  findForbiddenKeys,
  assertAllowedKeys
});
