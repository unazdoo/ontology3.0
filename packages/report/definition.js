"use strict";

const { fail } = require("./errors");
const { assertObject, assertString, assertArray, immutableJson, contentId } = require("./utils");

const MANAGED_DEFINITION_SCHEMA_VERSION = "ofw.m06.report-definition.v1";
const MANAGED_TEMPLATE_SCHEMA_VERSION = "ofw.m06.report-template.v1";
const CONTROLLED_CONTENT_TYPES = Object.freeze([
  "heading", "paragraph", "metric", "table", "chart", "rule-summary", "evidence-note", "footnote", "attachment", "ai-suggestion"
]);
const GOVERNED_RESULT_TYPES = Object.freeze([
  "property", "link", "metric-result", "rule-result", "fixed-query-view", "decision-summary", "approved-agent-result", "governed-result"
]);

function unique(values, label) {
  const seen = new Set();
  values.forEach((value) => {
    if (seen.has(value)) fail("DUPLICATE_ID", `${label} ${value} is duplicated`);
    seen.add(value);
  });
}

function normalizeEvidenceSlot(value, index, sections) {
  assertObject(value, `evidenceSlots[${index}]`);
  const slot = {
    evidenceSlotId: assertString(value.evidenceSlotId || value.id, `evidenceSlots[${index}].evidenceSlotId`),
    sectionId: assertString(value.sectionId, `evidenceSlots[${index}].sectionId`),
    required: value.required !== false,
    allowedEvidenceTypes: assertArray(value.allowedEvidenceTypes, `evidenceSlots[${index}].allowedEvidenceTypes`, { nonEmpty: true })
      .map((type) => assertString(type, "allowedEvidenceType")),
    allowedContentTypes: assertArray(value.allowedContentTypes, `evidenceSlots[${index}].allowedContentTypes`, { nonEmpty: true })
      .map((type) => assertString(type, "allowedContentType"))
  };
  if (!sections.has(slot.sectionId)) fail("UNKNOWN_SECTION", `evidence slot ${slot.evidenceSlotId} targets an unknown section`);
  slot.allowedContentTypes.forEach((type) => {
    if (!CONTROLLED_CONTENT_TYPES.includes(type)) fail("UNCONTROLLED_CONTENT_TYPE", `content type ${type} is not controlled by M06`);
  });
  return slot;
}

function createManagedReportDefinition(input) {
  assertObject(input, "report definition");
  const forbiddenDefinitionFields = ["formula", "metricFormula", "ruleThreshold", "rawDataPath", "promptBody", "promptText"];
  const presentForbidden = forbiddenDefinitionFields.filter((field) => Object.prototype.hasOwnProperty.call(input, field));
  if (presentForbidden.length) fail("DEFINITION_OWNER_BOUNDARY_VIOLATION", `report definition cannot own ${presentForbidden.join(", ")}`);
  const scenarioIds = assertArray(input.applicability?.scenarioIds, "applicability.scenarioIds", { nonEmpty: true })
    .map((id) => assertString(id, "scenarioId"));
  const objectTypes = assertArray(input.applicability?.objectTypes, "applicability.objectTypes", { nonEmpty: true })
    .map((id) => assertString(id, "objectType"));
  const sections = assertArray(input.sections, "sections", { nonEmpty: true }).map((section, index) => ({
    sectionId: assertString(section.sectionId || section.id, `sections[${index}].sectionId`),
    title: assertString(section.title, `sections[${index}].title`),
    required: section.required !== false,
    order: index + 1
  }));
  unique(sections.map((section) => section.sectionId), "sectionId");
  const sectionIds = new Set(sections.map((section) => section.sectionId));
  const evidenceSlots = assertArray(input.evidenceSlots, "evidenceSlots", { nonEmpty: true })
    .map((slot, index) => normalizeEvidenceSlot(slot, index, sectionIds));
  unique(evidenceSlots.map((slot) => slot.evidenceSlotId), "evidenceSlotId");
  const allowedResultTypes = assertArray(input.calculationPolicy?.allowedResultTypes, "calculationPolicy.allowedResultTypes", { nonEmpty: true })
    .map((type) => assertString(type, "allowedResultType"));
  allowedResultTypes.forEach((type) => {
    if (!GOVERNED_RESULT_TYPES.includes(type)) fail("UNGOVERNED_CALCULATION_SOURCE", `${type} is not an approved deterministic result type`);
  });
  const definition = {
    schemaVersion: MANAGED_DEFINITION_SCHEMA_VERSION,
    reportDefinitionId: assertString(input.reportDefinitionId, "reportDefinitionId"),
    version: assertString(input.version, "version"),
    status: assertString(input.status, "status"),
    title: assertString(input.title, "title"),
    purpose: {
      decisionQuestion: assertString(input.purpose?.decisionQuestion, "purpose.decisionQuestion"),
      useContext: assertString(input.purpose?.useContext, "purpose.useContext"),
      notApplicable: assertString(input.purpose?.notApplicable, "purpose.notApplicable")
    },
    applicability: { scenarioIds, objectTypes, scopePolicy: assertString(input.applicability?.scopePolicy, "applicability.scopePolicy") },
    audience: {
      readers: assertArray(input.audience?.readers, "audience.readers", { nonEmpty: true }).map((reader) => assertString(reader, "reader")),
      useBoundary: assertString(input.audience?.useBoundary, "audience.useBoundary")
    },
    templateRef: {
      templateId: assertString(input.templateRef?.templateId, "templateRef.templateId"),
      version: assertString(input.templateRef?.version, "templateRef.version")
    },
    sections,
    evidenceSlots,
    contentPolicy: {
      allowedContentTypes: assertArray(input.contentPolicy?.allowedContentTypes, "contentPolicy.allowedContentTypes", { nonEmpty: true })
        .map((type) => assertString(type, "allowedContentType")),
      requiredBindingKinds: assertArray(input.contentPolicy?.requiredBindingKinds, "contentPolicy.requiredBindingKinds", { nonEmpty: true })
        .map((type) => assertString(type, "requiredBindingKind"))
    },
    coveragePolicy: {
      minimumRequiredCoverage: Number(input.coveragePolicy?.minimumRequiredCoverage),
      blockOnUnclassified: input.coveragePolicy?.blockOnUnclassified !== false,
      blockOnExecutionError: input.coveragePolicy?.blockOnExecutionError !== false
    },
    calculationPolicy: {
      allowedResultTypes,
      roundingMode: assertString(input.calculationPolicy?.roundingMode, "calculationPolicy.roundingMode"),
      defaultTolerance: Number(input.calculationPolicy?.defaultTolerance || 0),
      prohibitAgentCalculation: true
    },
    agentRef: {
      agentId: assertString(input.agentRef?.agentId, "agentRef.agentId"),
      releaseVersion: assertString(input.agentRef?.releaseVersion, "agentRef.releaseVersion")
    },
    skillRef: {
      skillId: assertString(input.skillRef?.skillId, "skillRef.skillId"),
      version: assertString(input.skillRef?.version, "skillRef.version")
    },
    verificationPolicy: {
      rulesVersion: assertString(input.verificationPolicy?.rulesVersion, "verificationPolicy.rulesVersion"),
      explanationPolicy: assertString(input.verificationPolicy?.explanationPolicy, "verificationPolicy.explanationPolicy"),
      warningBlocksPublication: input.verificationPolicy?.warningBlocksPublication === true
    },
    comparisonPolicy: {
      policyVersion: assertString(input.comparisonPolicy?.policyVersion, "comparisonPolicy.policyVersion"),
      allowedFactKinds: assertArray(input.comparisonPolicy?.allowedFactKinds, "comparisonPolicy.allowedFactKinds", { nonEmpty: true })
        .map((kind) => assertString(kind, "comparison fact kind")),
      freshnessThresholdRef: assertString(input.comparisonPolicy?.freshnessThresholdRef, "comparisonPolicy.freshnessThresholdRef"),
      qualityWarningBlocks: input.comparisonPolicy?.qualityWarningBlocks === true,
      regenerationRuleVersion: assertString(input.comparisonPolicy?.regenerationRuleVersion, "comparisonPolicy.regenerationRuleVersion")
    },
    presentationPolicy: { sameSourceHtmlPdf: true, stableAnchors: true, arbitraryHtmlAllowed: false },
    reviewPolicy: {
      reviewerRoles: assertArray(input.reviewPolicy?.reviewerRoles, "reviewPolicy.reviewerRoles", { nonEmpty: true })
        .map((role) => assertString(role, "reviewerRole")),
      requireHumanConfirmation: true
    },
    publicationPolicy: {
      allowedAudience: assertArray(input.publicationPolicy?.allowedAudience, "publicationPolicy.allowedAudience", { nonEmpty: true })
        .map((audience) => assertString(audience, "allowedAudience")),
      namingRule: assertString(input.publicationPolicy?.namingRule, "publicationPolicy.namingRule"),
      replacementMode: assertString(input.publicationPolicy?.replacementMode, "publicationPolicy.replacementMode")
    },
    enabledAt: assertString(input.enabledAt, "enabledAt"),
    changeSummary: assertString(input.changeSummary, "changeSummary"),
    immutable: true
  };
  if (definition.status !== "enabled") fail("DEFINITION_NOT_ENABLED", "only enabled report definitions may generate reports");
  if (!(definition.coveragePolicy.minimumRequiredCoverage > 0 && definition.coveragePolicy.minimumRequiredCoverage <= 1)) {
    fail("INVALID_COVERAGE_POLICY", "minimumRequiredCoverage must be greater than 0 and at most 1");
  }
  definition.contentPolicy.allowedContentTypes.forEach((type) => {
    if (!CONTROLLED_CONTENT_TYPES.includes(type)) fail("UNCONTROLLED_CONTENT_TYPE", `content type ${type} is not controlled by M06`);
  });
  return immutableJson(definition);
}

function createManagedReportTemplate(input, definition) {
  assertObject(input, "report template");
  assertObject(definition, "managed report definition");
  const forbiddenTemplateFields = ["formula", "ruleThreshold", "dataSource", "sourcePath", "prompt", "skill", "agentTool"];
  const presentForbidden = forbiddenTemplateFields.filter((field) => Object.prototype.hasOwnProperty.call(input, field));
  if (presentForbidden.length) fail("TEMPLATE_OWNER_BOUNDARY_VIOLATION", `template cannot own ${presentForbidden.join(", ")}`);
  if (definition.schemaVersion !== MANAGED_DEFINITION_SCHEMA_VERSION) fail("INVALID_DEFINITION", "managed report definition is required");
  const slots = assertArray(input.slots, "template.slots", { nonEmpty: true }).map((slot, index) => ({
    templateSlotId: assertString(slot.templateSlotId || slot.slotId || slot.id, `template.slots[${index}].templateSlotId`),
    sectionId: assertString(slot.sectionId, `template.slots[${index}].sectionId`),
    evidenceSlotId: assertString(slot.evidenceSlotId, `template.slots[${index}].evidenceSlotId`),
    contentType: assertString(slot.contentType, `template.slots[${index}].contentType`),
    anchorKind: assertString(slot.anchorKind, `template.slots[${index}].anchorKind`),
    required: slot.required !== false,
    fixedText: typeof slot.fixedText === "string" ? slot.fixedText : null
  }));
  slots.forEach((slot, index) => {
    const forbidden = forbiddenTemplateFields.filter((field) => Object.prototype.hasOwnProperty.call(input.slots[index], field));
    if (forbidden.length) fail("TEMPLATE_OWNER_BOUNDARY_VIOLATION", `template slot ${slot.templateSlotId} cannot own ${forbidden.join(", ")}`);
  });
  unique(slots.map((slot) => slot.templateSlotId), "templateSlotId");
  const sectionIds = new Set(definition.sections.map((section) => section.sectionId));
  const evidenceById = new Map(definition.evidenceSlots.map((slot) => [slot.evidenceSlotId, slot]));
  slots.forEach((slot) => {
    if (!sectionIds.has(slot.sectionId)) fail("UNKNOWN_SECTION", `template slot ${slot.templateSlotId} has an unknown section`);
    const evidenceSlot = evidenceById.get(slot.evidenceSlotId);
    if (!evidenceSlot) fail("UNKNOWN_EVIDENCE_SLOT", `template slot ${slot.templateSlotId} has an unknown evidence slot`);
    if (!evidenceSlot.allowedContentTypes.includes(slot.contentType)) {
      fail("CONTENT_TYPE_NOT_ALLOWED", `template slot ${slot.templateSlotId} content type is outside its evidence slot`);
    }
  });
  const mappedEvidenceSlots = new Set(slots.map((slot) => slot.evidenceSlotId));
  definition.evidenceSlots.filter((slot) => slot.required).forEach((slot) => {
    if (!mappedEvidenceSlots.has(slot.evidenceSlotId)) fail("REQUIRED_EVIDENCE_SLOT_UNMAPPED", `required evidence slot ${slot.evidenceSlotId} has no template slot`);
  });
  const mappedSections = new Set(slots.map((slot) => slot.sectionId));
  definition.sections.filter((section) => section.required).forEach((section) => {
    if (!mappedSections.has(section.sectionId)) fail("REQUIRED_SECTION_UNMAPPED", `required section ${section.sectionId} has no template slot`);
  });
  const template = {
    schemaVersion: MANAGED_TEMPLATE_SCHEMA_VERSION,
    templateId: assertString(input.templateId, "templateId"),
    version: assertString(input.version, "version"),
    reportDefinitionId: definition.reportDefinitionId,
    reportDefinitionVersion: definition.version,
    name: assertString(input.name, "name"),
    reportType: assertString(input.reportType, "reportType"),
    slots,
    page: input.page || { size: "A4", orientation: "portrait" },
    styles: input.styles || {},
    scriptAllowed: false,
    externalDynamicContentAllowed: false,
    immutable: true
  };
  if (template.templateId !== definition.templateRef.templateId || template.version !== definition.templateRef.version) {
    fail("TEMPLATE_VERSION_MISMATCH", "template does not match the exact definition template reference");
  }
  return immutableJson(template);
}

function definitionKey(definition) {
  return `${definition.reportDefinitionId}@${definition.version}`;
}

function templateKey(template) {
  return `${template.templateId}@${template.version}`;
}

module.exports = Object.freeze({
  MANAGED_DEFINITION_SCHEMA_VERSION,
  MANAGED_TEMPLATE_SCHEMA_VERSION,
  CONTROLLED_CONTENT_TYPES,
  GOVERNED_RESULT_TYPES,
  createManagedReportDefinition,
  createManagedReportTemplate,
  definitionKey,
  templateKey,
  definitionContentId: (definition) => contentId("RDEF", definition)
});
