"use strict";

const crypto = require("node:crypto");

const checkpoint = require("../checkpoint");
const identity = require("../identity");

const REPORT_MODULE_EXPORT_SCHEMA_VERSION = "ofw.m06.report-module-export.v1";
const REPORT_OWNER_RECEIPT_SCHEMA_VERSION = "ofw.m06.report-owner-receipt.v1";
const REPORT_RESTORE_PLAN_SCHEMA_VERSION = "ofw.m06.restore-plan.v1";
const REPORT_EVIDENCE_INDEX_SCHEMA_VERSION = "ofw.m06.evidence-index.v1";
const REPORT_CLONE_RESTORE_SCHEMA_VERSION = "ofw.m06.clone-restore.v1";
const REPORT_HISTORICAL_VIEW_SCHEMA_VERSION = "ofw.m06.historical-view.v1";

function fail(code, message, details) {
  const error = new Error(message);
  error.name = "ReportExportError";
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

function sha256(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return crypto.createHash("sha256").update(value).digest("hex");
  return crypto.createHash("sha256").update(typeof value === "string" ? value : identity.stableSerialize(value), "utf8").digest("hex");
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) return Object.values(value);
  return [];
}

function stateFromExport(value) {
  if (isPlainObject(value) && isPlainObject(value.runtimeState)) return value.runtimeState;
  if (isPlainObject(value) && isPlainObject(value.collections)) {
    return {
      ...Object.fromEntries(Object.entries(value.collections).map(([name, records]) => [name, ensureArray(records)])),
      dashboardView: value.pointers?.dashboards || null,
      pointers: value.pointers || {}
    };
  }
  return value;
}

function reportResourceType(kind) {
  switch (kind) {
    case "reportDefinitions": return "report-definition";
    case "reportTemplates": return "report-template";
    case "fixedViews": return "fixed-query-view";
    case "dashboardDefinitions": return "dashboard-definition";
    case "c022Requests": return "report-generation-request";
    case "c023Receipts": return "agent-report-draft-receipt";
    case "anchors": return "stable-report-anchor";
    case "qualityWarnings": return "report-quality-warning";
    case "artifacts": return "published-report-artifact";
    case "dashboardVersions": return "dashboard-version";
    case "dashboardView": return "dashboard-view";
    case "evidencePackages": return "evidence-package";
    case "verificationRuns": return "report-verification-run";
    case "verificationResults": return "report-verification-result";
    case "comparisonRecords": return "report-comparison-record";
    default: return "report-draft";
  }
}

function buildResourceSummaries(runtimeState) {
  const resources = [];
  ["reportDefinitions", "reportTemplates", "fixedViews", "dashboardDefinitions", "c022Requests", "c023Receipts", "anchors", "qualityWarnings", "artifacts"].forEach((collection) => {
    ensureArray(runtimeState[collection]).forEach((item, index) => {
      const resourceId = item.reportDefinitionId || item.templateId || item.snapshotId || item.dashboardId || item.requestId || item.receiptId || item.t044Id || item.warningId || item.reportId || item.id || `${collection}-${index + 1}`;
      resources.push({
        resourceId,
        resourceType: reportResourceType(collection),
        version: item.version || item.contentVersionId || item.artifactVersion || resourceId,
        status: item.status || item.reviewStatus || "immutable",
        contentSnapshotRef: item.contentSnapshotRef || null
      });
    });
  });
  ensureArray(runtimeState.reports).forEach((item) => {
    resources.push({
      resourceId: item.reportId,
      resourceType: reportResourceType("reports"),
      version: item.contentVersionId || item.reportId,
      status: item.status || "draft",
      contentSnapshotRef: item.contentSnapshotRef || null
    });
  });
  ensureArray(runtimeState.dashboardVersions).forEach((item) => {
    resources.push({
      resourceId: item.dashboardVersionId,
      resourceType: reportResourceType("dashboardVersions"),
      version: item.contentVersionId || item.dashboardVersionId,
      status: item.status || "published",
      contentSnapshotRef: item.contentSnapshotRef || null
    });
  });
  if (isPlainObject(runtimeState.dashboardView)) {
    resources.push({
      resourceId: runtimeState.dashboardView.dashboardVersionId || "dashboard-view",
      resourceType: reportResourceType("dashboardView"),
      version: runtimeState.dashboardView.contentVersionId || runtimeState.dashboardView.dashboardVersionId || "dashboard-view",
      status: "current",
      contentSnapshotRef: runtimeState.dashboardView.contentSnapshotRef || null
    });
  }
  ensureArray(runtimeState.evidencePackages).forEach((item) => {
    resources.push({
      resourceId: item.evidencePackageId || item.packageId,
      resourceType: reportResourceType("evidencePackages"),
      version: item.version || item.packageVersion || "1.0.0",
      status: item.status || "available",
      contentSnapshotRef: item.contentSnapshotRef || null
    });
  });
  ensureArray(runtimeState.verificationRuns).forEach((item) => {
    resources.push({
      resourceId: item.verificationRunId || item.id,
      resourceType: reportResourceType("verificationRuns"),
      version: item.version || "1.0.0",
      status: item.status || "completed",
      contentSnapshotRef: item.contentSnapshotRef || null
    });
  });
  ensureArray(runtimeState.verificationResults).forEach((item) => {
    resources.push({
      resourceId: item.verificationResultId || item.id,
      resourceType: reportResourceType("verificationResults"),
      version: item.version || "1.0.0",
      status: item.status || "completed",
      contentSnapshotRef: item.contentSnapshotRef || null
    });
  });
  ensureArray(runtimeState.comparisonRecords).forEach((item, index) => {
    resources.push({
      resourceId: item.comparisonId || `comparison-${index + 1}`,
      resourceType: reportResourceType("comparisonRecords"),
      version: item.version || "1.0.0",
      status: item.recordStatus || item.status || "active",
      contentSnapshotRef: item.contentSnapshotRef || null
    });
  });
  return resources.filter((item) => nonEmptyString(item.resourceId));
}

function validateReportModuleExport(exportValue) {
  const errors = [];
  if (!isPlainObject(exportValue)) return { ok: false, errors: [{ code: "INVALID_EXPORT", path: "$", message: "module export must be an object" }] };
  if (exportValue.schemaVersion !== REPORT_MODULE_EXPORT_SCHEMA_VERSION) {
    errors.push({ code: "SCHEMA_VERSION_MISMATCH", path: "schemaVersion", message: "schemaVersion must match report module export" });
  }
  try {
    identity.assertScenarioContext(exportValue.scenarioContext);
  } catch (error) {
    errors.push({ code: "INVALID_SCENARIO_CONTEXT", path: "scenarioContext", message: error.message });
  }
  if (exportValue.moduleId !== "M06") errors.push({ code: "INVALID_MODULE_ID", path: "moduleId", message: "moduleId must be M06" });
  if (!["referenced", "empty"].includes(exportValue.stateDeclaration)) {
    errors.push({ code: "INVALID_STATE_DECLARATION", path: "stateDeclaration", message: "stateDeclaration must be referenced or empty" });
  }
  if (exportValue.ownerBoundary?.ownsDecisionState !== false) {
    errors.push({ code: "OWNER_BOUNDARY_OPENED", path: "ownerBoundary.ownsDecisionState", message: "M06 must not own decision state" });
  }
  if (exportValue.ownerBoundary?.historicalVerificationPersisted !== true) {
    errors.push({ code: "HISTORICAL_VERIFICATION_MISSING", path: "ownerBoundary.historicalVerificationPersisted", message: "M06 must persist its immutable historical T049 records" });
  }
  if (exportValue.sideEffectPolicy?.allowHistoricalReplay !== false || exportValue.sideEffectPolicy?.allowExternalDispatch !== false) {
    errors.push({ code: "SIDE_EFFECT_POLICY_OPENED", path: "sideEffectPolicy", message: "historical replay and external dispatch must remain false" });
  }
  const runtimeState = exportValue.runtimeState || {};
  const reportIds = new Set();
  ensureArray(runtimeState.reports).forEach((item, index) => {
    if (!item?.immutable) errors.push({ code: "REPORT_NOT_IMMUTABLE", path: `runtimeState.reports[${index}].immutable`, message: "historical report records must be immutable" });
    if (item?.reportId && reportIds.has(item.reportId)) errors.push({ code: "DUPLICATE_REPORT_ID", path: `runtimeState.reports[${index}].reportId`, message: "reportId must be unique in an export" });
    if (item?.reportId) reportIds.add(item.reportId);
    const version = item?.contentVersions?.find((candidate) => candidate.contentVersionId === item.contentVersionId);
    if (item?.contentVersionId && !version) errors.push({ code: "CONTENT_VERSION_MISSING", path: `runtimeState.reports[${index}].contentVersionId`, message: "report contentVersionId must resolve to an immutable content version" });
    if (item?.frozenPdf?.base64) {
      try {
        const actual = sha256(Buffer.from(item.frozenPdf.base64, "base64"));
        if (item.frozenPdf.sha256 && item.frozenPdf.sha256 !== actual) errors.push({ code: "PDF_HASH_MISMATCH", path: `runtimeState.reports[${index}].frozenPdf.sha256`, message: "frozen PDF hash mismatch" });
      } catch (error) {
        errors.push({ code: "PDF_INVALID", path: `runtimeState.reports[${index}].frozenPdf`, message: error.message });
      }
    }
    if (item?.frozenHtml && version?.htmlSha256) {
      const actualHtml = sha256(Buffer.from(item.frozenHtml, "utf8"));
      if (version.htmlSha256 !== actualHtml) errors.push({ code: "HTML_HASH_MISMATCH", path: `runtimeState.reports[${index}].frozenHtml`, message: "frozen HTML hash mismatch" });
    }
  });
  ensureArray(runtimeState.verificationRuns).forEach((item, index) => {
    if (item?.immutable === false) errors.push({ code: "VERIFICATION_MUTABLE", path: `runtimeState.verificationRuns[${index}]`, message: "historical T049 records may not be mutable" });
  });
  ensureArray(runtimeState.comparisonRecords).forEach((item, index) => {
    if (item?.immutable === false) errors.push({ code: "COMPARISON_MUTABLE", path: `runtimeState.comparisonRecords[${index}]`, message: "historical C027 records may not be mutable" });
  });
  return { ok: errors.length === 0, errors };
}

function buildReportModuleExport(input) {
  if (!isPlainObject(input)) fail("INVALID_MODULE_EXPORT_INPUT", "module export input must be an object");
  const scenarioContext = identity.assertScenarioContext(input.scenarioContext);
  const runtimeState = cloneJson(stateFromExport(input.runtimeState || input.state || {}), "runtimeState");
  const resources = buildResourceSummaries(runtimeState);
  const exportValue = {
    schemaVersion: REPORT_MODULE_EXPORT_SCHEMA_VERSION,
    moduleId: "M06",
    moduleName: "报告中心",
    owner: "报告中心",
    moduleVersion: nonEmptyString(input.moduleVersion) ? input.moduleVersion.trim() : "M06-report-package.v1",
    scenarioContext,
    checkpointNode: nonEmptyString(input.checkpointNode) ? input.checkpointNode.trim() : "agent-report-dashboard-completed",
    formedAt: nonEmptyString(input.formedAt) ? new Date(input.formedAt).toISOString() : scenarioContext.formedAt,
    stateDeclaration: resources.length ? "referenced" : "empty",
    emptyReason: resources.length ? null : "当前模块尚未形成报告、驾驶舱、核验或比较记录",
    ownerBoundary: {
      ownsDecisionState: false,
      dashboardOwner: true,
      reportVerificationOwner: true,
      historicalVerificationPersisted: true,
      overwritesHistoricalReports: false
    },
    sideEffectPolicy: {
      allowHistoricalReplay: false,
      allowExternalDispatch: false
    },
    resources,
    runtimeState
  };
  const validation = validateReportModuleExport(exportValue);
  if (!validation.ok) fail("INVALID_REPORT_MODULE_EXPORT", "report module export validation failed", validation.errors);
  return immutableJson(exportValue, "report module export");
}

function buildReportOwnerReceipt(input) {
  if (!isPlainObject(input)) fail("INVALID_OWNER_RECEIPT_INPUT", "owner receipt input must be an object");
  const moduleExport = buildReportModuleExport(input.moduleExport);
  if (!nonEmptyString(input.exportRef)) fail("MISSING_EXPORT_REF", "exportRef is required");
  if (!nonEmptyString(input.exportSha256)) fail("MISSING_EXPORT_SHA256", "exportSha256 is required");
  const expectedHash = sha256(moduleExport);
  if (input.exportSha256.trim().toLowerCase() !== expectedHash) {
    fail("EXPORT_HASH_MISMATCH", "owner receipt exportSha256 does not match the immutable module export", {
      expected: expectedHash,
      actual: input.exportSha256.trim().toLowerCase()
    });
  }
  return immutableJson({
    schemaVersion: REPORT_OWNER_RECEIPT_SCHEMA_VERSION,
    moduleId: moduleExport.moduleId,
    moduleVersion: moduleExport.moduleVersion,
    checkpointNode: moduleExport.checkpointNode,
    scenarioContext: moduleExport.scenarioContext,
    exportRef: input.exportRef.trim(),
    exportSha256: input.exportSha256.trim(),
    validatedAt: nonEmptyString(input.validatedAt) ? new Date(input.validatedAt).toISOString() : moduleExport.formedAt,
    validation: { status: "verified", ok: true }
  }, "report owner receipt");
}

function buildReportRestorePlan(input) {
  if (!isPlainObject(input)) fail("INVALID_RESTORE_PLAN_INPUT", "restore plan input must be an object");
  const moduleExport = buildReportModuleExport(input.moduleExport);
  return immutableJson({
    schemaVersion: REPORT_RESTORE_PLAN_SCHEMA_VERSION,
    checkpointId: nonEmptyString(input.checkpointId) ? input.checkpointId.trim() : null,
    checkpointNode: moduleExport.checkpointNode,
    moduleAdapters: [{
      moduleId: moduleExport.moduleId,
      scenarioAdapterVersion: moduleExport.moduleVersion,
      exportRef: nonEmptyString(input.exportRef) ? input.exportRef.trim() : null,
      restoreMode: "isolated-clone",
      resourceCounts: {
        reports: ensureArray(moduleExport.runtimeState.reports).length,
        dashboardVersions: ensureArray(moduleExport.runtimeState.dashboardVersions).length,
        evidencePackages: ensureArray(moduleExport.runtimeState.evidencePackages).length,
        comparisonRecords: ensureArray(moduleExport.runtimeState.comparisonRecords).length
      }
    }],
    historicalReadOnly: true,
    cloneCreatesNewScenarioRunId: true,
    regressionClearsDownstreamSideEffects: true,
    formedAt: moduleExport.formedAt
  }, "report restore plan");
}

function buildReportEvidenceIndex(input) {
  if (!isPlainObject(input)) fail("INVALID_EVIDENCE_INDEX_INPUT", "evidence index input must be an object");
  const files = ensureArray(input.files).map((item, index) => {
    if (!isPlainObject(item) || !nonEmptyString(item.ref) || !nonEmptyString(item.sha256)) {
      fail("INVALID_EVIDENCE_INDEX_FILE", `evidence file #${index + 1} requires ref and sha256`);
    }
    return { ref: item.ref.trim(), sha256: item.sha256.trim() };
  }).sort((left, right) => left.ref.localeCompare(right.ref));
  return immutableJson({
    schemaVersion: REPORT_EVIDENCE_INDEX_SCHEMA_VERSION,
    checkpointId: nonEmptyString(input.checkpointId) ? input.checkpointId.trim() : null,
    checkpointNode: nonEmptyString(input.checkpointNode) ? input.checkpointNode.trim() : null,
    validationScope: "report-module-boundary",
    files,
    formedAt: nonEmptyString(input.formedAt) ? new Date(input.formedAt).toISOString() : new Date().toISOString(),
    boundary: "只导出报告中心拥有的报告、驾驶舱、证据与比较记录；不覆盖历史报告。"
  }, "report evidence index");
}

function cloneReportModuleState(input, options) {
  const moduleExport = buildReportModuleExport(input);
  const now = nonEmptyString(options && options.now) ? new Date(options.now).toISOString() : new Date().toISOString();
  const targetScenarioRunId = checkpoint.createScenarioRunId(moduleExport.scenarioContext.scenarioId, {
    ...(options || {}),
    now,
    scenarioVersion: moduleExport.scenarioContext.scenarioVersion,
    sourceScenarioRunId: moduleExport.scenarioContext.scenarioRunId,
    operation: "report-clone-restore"
  });
  const restoredContext = identity.assertScenarioContext({
    ...moduleExport.scenarioContext,
    scenarioRunId: targetScenarioRunId,
    formedAt: now,
    status: "restored"
  });
  return immutableJson({
    schemaVersion: REPORT_CLONE_RESTORE_SCHEMA_VERSION,
    mode: "clone-restore",
    sourceScenarioRunId: moduleExport.scenarioContext.scenarioRunId,
    targetScenarioRunId,
    scenarioContext: restoredContext,
    overwritesSource: false,
    overwritesHistory: false,
    replayHistoricalSideEffects: false,
    sideEffectPolicy: checkpoint.SIDE_EFFECT_POLICY,
    restoreInput: cloneJson(moduleExport.runtimeState, "restoreInput"),
    reports: cloneJson(moduleExport.runtimeState.reports || [], "reports"),
    dashboardVersions: cloneJson(moduleExport.runtimeState.dashboardVersions || [], "dashboardVersions"),
    dashboardView: cloneJson(moduleExport.runtimeState.dashboardView || null, "dashboardView"),
    evidencePackages: cloneJson(moduleExport.runtimeState.evidencePackages || [], "evidencePackages"),
    verificationRuns: cloneJson(moduleExport.runtimeState.verificationRuns || [], "verificationRuns"),
    verificationResults: cloneJson(moduleExport.runtimeState.verificationResults || [], "verificationResults"),
    comparisonRecords: cloneJson(moduleExport.runtimeState.comparisonRecords || [], "comparisonRecords")
  }, "report clone restore");
}

function historicalView(input) {
  const moduleExport = buildReportModuleExport(input);
  return immutableJson({
    schemaVersion: REPORT_HISTORICAL_VIEW_SCHEMA_VERSION,
    readOnly: true,
    scenarioContext: moduleExport.scenarioContext,
    reports: cloneJson(moduleExport.runtimeState.reports || [], "reports"),
    dashboardVersions: cloneJson(moduleExport.runtimeState.dashboardVersions || [], "dashboardVersions"),
    dashboardView: cloneJson(moduleExport.runtimeState.dashboardView || null, "dashboardView"),
    evidencePackages: cloneJson(moduleExport.runtimeState.evidencePackages || [], "evidencePackages"),
    comparisonRecords: cloneJson(moduleExport.runtimeState.comparisonRecords || [], "comparisonRecords")
  }, "report historical view");
}

module.exports = Object.freeze({
  REPORT_MODULE_EXPORT_SCHEMA_VERSION,
  REPORT_OWNER_RECEIPT_SCHEMA_VERSION,
  REPORT_RESTORE_PLAN_SCHEMA_VERSION,
  REPORT_EVIDENCE_INDEX_SCHEMA_VERSION,
  REPORT_CLONE_RESTORE_SCHEMA_VERSION,
  REPORT_HISTORICAL_VIEW_SCHEMA_VERSION,
  buildReportModuleExport,
  validateReportModuleExport,
  buildReportOwnerReceipt,
  buildReportRestorePlan,
  buildReportEvidenceIndex,
  cloneReportModuleState,
  historicalView,
  sha256
});
