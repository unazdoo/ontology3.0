"use strict";

const contracts = require("../contracts");

const REPORT_DEFINITION_SCHEMA_VERSION = "ofw.c022.report-definition.v1";
const REPORT_TEMPLATE_SCHEMA_VERSION = "ofw.c023.report-template.v1";

function fail(code, message, details) {
  const error = new Error(message);
  error.name = "ReportTemplateError";
  error.code = code;
  if (details !== undefined) error.details = details;
  throw error;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneJson(value, label) {
  if (value === undefined) fail("INVALID_JSON", `${label || "value"} must not be undefined`);
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail("INVALID_JSON", `${label || "value"} must be JSON serializable`, error && error.message);
  }
}

function deepFreeze(value, seen) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  const visited = seen || new Set();
  if (visited.has(value)) return value;
  visited.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], visited));
  return Object.freeze(value);
}

function immutableJson(value, label) {
  return deepFreeze(cloneJson(value, label));
}

function normalizeDefinitionSection(value, index) {
  if (!isPlainObject(value)) fail("INVALID_SECTION", `definition section #${index + 1} must be an object`);
  const sectionId = value.sectionId || value.id;
  if (!nonEmptyString(sectionId)) fail("MISSING_SECTION_ID", `definition section #${index + 1} requires sectionId`);
  if (!nonEmptyString(value.title)) fail("MISSING_SECTION_TITLE", `definition section ${sectionId} requires title`);
  return {
    sectionId: String(sectionId).trim(),
    title: String(value.title).trim(),
    summary: nonEmptyString(value.summary) ? value.summary.trim() : null,
    required: value.required !== false,
    ordinal: index + 1
  };
}

function normalizeTemplateSlot(value, index) {
  if (!isPlainObject(value)) fail("INVALID_SLOT", `template slot #${index + 1} must be an object`);
  const slotId = value.slotId || value.id;
  if (!nonEmptyString(slotId)) fail("MISSING_SLOT_ID", `template slot #${index + 1} requires slotId`);
  if (!nonEmptyString(value.sectionId)) fail("MISSING_SLOT_SECTION", `template slot ${slotId} requires sectionId`);
  return {
    slotId: String(slotId).trim(),
    sectionId: String(value.sectionId).trim(),
    variant: nonEmptyString(value.variant) ? value.variant.trim() : "default",
    className: nonEmptyString(value.className) ? value.className.trim() : null,
    staticLabel: nonEmptyString(value.staticLabel) ? value.staticLabel.trim() : null
  };
}

function validateUnique(list, field, label) {
  const seen = new Set();
  for (const item of list) {
    if (seen.has(item[field])) fail("DUPLICATE_ID", `${label} ${item[field]} is duplicated`);
    seen.add(item[field]);
  }
}

function createReportDefinition(input) {
  if (!isPlainObject(input)) fail("INVALID_DEFINITION", "report definition must be an object");
  if (!nonEmptyString(input.reportDefinitionId)) fail("MISSING_REPORT_DEFINITION_ID", "reportDefinitionId is required");
  if (!nonEmptyString(input.title)) fail("MISSING_REPORT_TITLE", "definition title is required");
  if (!Array.isArray(input.sections) || input.sections.length === 0) fail("MISSING_SECTIONS", "definition sections are required");
  const sections = input.sections.map(normalizeDefinitionSection);
  validateUnique(sections, "sectionId", "definition section");
  return immutableJson({
    schemaVersion: REPORT_DEFINITION_SCHEMA_VERSION,
    reportDefinitionId: input.reportDefinitionId.trim(),
    version: nonEmptyString(input.version) ? input.version.trim() : "1.0.0",
    title: input.title.trim(),
    subtitle: nonEmptyString(input.subtitle) ? input.subtitle.trim() : null,
    sections,
    immutable: true,
    metadata: isPlainObject(input.metadata) ? cloneJson(input.metadata, "definition metadata") : {}
  }, "report definition");
}

function createReportTemplate(input, options) {
  if (!isPlainObject(input)) fail("INVALID_TEMPLATE", "report template must be an object");
  if (!nonEmptyString(input.templateId)) fail("MISSING_TEMPLATE_ID", "templateId is required");
  const definition = options && options.definition ? createReportDefinition(options.definition) : null;
  const reportDefinitionId = input.reportDefinitionId || definition && definition.reportDefinitionId;
  if (!nonEmptyString(reportDefinitionId)) fail("MISSING_TEMPLATE_REPORT_DEFINITION", "template requires reportDefinitionId");
  const slots = Array.isArray(input.slots) && input.slots.length
    ? input.slots.map(normalizeTemplateSlot)
    : definition
      ? definition.sections.map((section) => normalizeTemplateSlot({ slotId: `slot-${section.sectionId}`, sectionId: section.sectionId }))
      : [];
  if (!slots.length) fail("MISSING_TEMPLATE_SLOTS", "template slots are required");
  validateUnique(slots, "slotId", "template slot");
  if (definition) {
    const knownSections = new Set(definition.sections.map((section) => section.sectionId));
    slots.forEach((slot) => {
      if (!knownSections.has(slot.sectionId)) {
        fail("UNKNOWN_TEMPLATE_SECTION", `template slot ${slot.slotId} targets unknown section ${slot.sectionId}`);
      }
    });
  }
  return immutableJson({
    schemaVersion: REPORT_TEMPLATE_SCHEMA_VERSION,
    templateId: input.templateId.trim(),
    reportDefinitionId: reportDefinitionId.trim(),
    version: nonEmptyString(input.version) ? input.version.trim() : "1.0.0",
    layout: nonEmptyString(input.layout) ? input.layout.trim() : "formal-report",
    slots,
    immutable: true,
    metadata: isPlainObject(input.metadata) ? cloneJson(input.metadata, "template metadata") : {}
  }, "report template");
}

function assertScenarioContext(value) {
  return contracts.assertScenarioContext(value, { allowUnknown: false });
}

module.exports = Object.freeze({
  REPORT_DEFINITION_SCHEMA_VERSION,
  REPORT_TEMPLATE_SCHEMA_VERSION,
  createReportDefinition,
  createReportTemplate,
  assertScenarioContext
});
