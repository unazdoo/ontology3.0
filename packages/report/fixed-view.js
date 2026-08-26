"use strict";

const { fail } = require("./errors");
const { assertObject, assertString, assertArray, assertScenarioRun, immutableJson, contentId } = require("./utils");

const FIXED_VIEW_SNAPSHOT_SCHEMA_VERSION = "ofw.c018.fixed-query-view.snapshot.v1";
const DASHBOARD_DEFINITION_SCHEMA_VERSION = "ofw.m06.dashboard-definition.v1";
const DASHBOARD_CONTENT_VERSION_SCHEMA_VERSION = "ofw.m06.dashboard-content-version.v1";

function createFixedViewSnapshot(input) {
  assertObject(input, "C018 fixed view");
  const owner = assertString(input.owner, "C018.owner");
  if (!["M03", "智能问数"].includes(owner)) fail("C018_OWNER_MISMATCH", "C018 must remain owned by M03 intelligent query");
  const runStatus = assertString(input.runStatus, "C018.runStatus");
  const snapshot = {
    schemaVersion: FIXED_VIEW_SNAPSHOT_SCHEMA_VERSION,
    contractId: "C018",
    snapshotId: assertString(input.snapshotId || contentId("C018S", input), "C018.snapshotId"),
    viewId: assertString(input.viewId, "C018.viewId"),
    viewVersion: assertString(input.viewVersion, "C018.viewVersion"),
    businessName: assertString(input.businessName, "C018.businessName"),
    intent: assertString(input.intent, "C018.intent"),
    scenarioContext: assertScenarioRun(input.scenarioContext, null, "C018.scenarioContext"),
    owner,
    queryDefinition: {
      queryId: assertString(input.queryDefinition?.queryId, "C018.queryDefinition.queryId"),
      version: assertString(input.queryDefinition?.version, "C018.queryDefinition.version"),
      objectParameters: input.queryDefinition?.objectParameters || {},
      displayPreferences: input.queryDefinition?.displayPreferences || {}
    },
    binding: {
      semanticVersionId: assertString(input.binding?.semanticVersionId, "C018.binding.semanticVersionId"),
      semanticVersion: assertString(input.binding?.semanticVersion, "C018.binding.semanticVersion"),
      dataVersionId: assertString(input.binding?.dataVersionId, "C018.binding.dataVersionId"),
      t008: assertString(input.binding?.t008, "C018.binding.t008")
    },
    structuredResult: input.structuredResult === undefined ? null : input.structuredResult,
    fixedResult: input.structuredResult === undefined ? null : input.structuredResult,
    unit: input.unit || null,
    evidenceRefs: assertArray(input.evidenceRefs, "C018.evidenceRefs", { nonEmpty: runStatus === "succeeded" })
      .map((ref) => assertString(ref, "C018.evidenceRef")),
    generatedAt: assertString(input.generatedAt, "C018.generatedAt"),
    confidence: input.confidence || null,
    refreshPolicy: input.refreshPolicy || null,
    runStatus,
    status: runStatus,
    statusLabel: { succeeded: "成功", failed: "失败", blocked: "阻断", running: "运行中" }[runStatus] || runStatus,
    previousSuccessfulSnapshotId: input.previousSuccessfulSnapshotId || null,
    failure: input.failure || null,
    postQualityHardFailure: input.postQualityHardFailure === true,
    immutable: true
  };
  if (runStatus === "succeeded" && snapshot.structuredResult === null) {
    fail("C018_RESULT_MISSING", "a successful fixed query view requires a structured deterministic result");
  }
  if (runStatus !== "succeeded" && !snapshot.previousSuccessfulSnapshotId) {
    fail("C018_FAILURE_WITHOUT_FALLBACK", "a failed fixed query view must identify its previous successful snapshot");
  }
  return immutableJson(snapshot);
}

function createDashboardDefinition(input) {
  assertObject(input, "dashboard definition");
  const definition = {
    schemaVersion: DASHBOARD_DEFINITION_SCHEMA_VERSION,
    dashboardId: assertString(input.dashboardId, "dashboardId"),
    version: assertString(input.version, "dashboard version"),
    scenarioId: assertString(input.scenarioId, "dashboard scenarioId"),
    title: assertString(input.title, "dashboard title"),
    slots: assertArray(input.slots, "dashboard slots", { nonEmpty: true }).map((slot, index) => ({
      slotId: assertString(slot.slotId, `dashboard slots[${index}].slotId`),
      kind: assertString(slot.kind, `dashboard slots[${index}].kind`),
      resourceRef: assertString(slot.resourceRef, `dashboard slots[${index}].resourceRef`),
      title: assertString(slot.title, `dashboard slots[${index}].title`)
    })),
    createdAt: assertString(input.createdAt, "dashboard createdAt"),
    immutable: true
  };
  definition.slots.forEach((slot) => {
    if (!['fixed-query-view', 'published-report', 'agent-result', 'decision-summary'].includes(slot.kind)) {
      fail("DASHBOARD_RESOURCE_NOT_ALLOWED", `dashboard slot kind ${slot.kind} is not allowed`);
    }
  });
  return immutableJson(definition);
}

function createDashboardContentVersion(input) {
  assertObject(input, "dashboard content version");
  const definition = input.definition;
  if (definition?.schemaVersion !== DASHBOARD_DEFINITION_SCHEMA_VERSION) fail("INVALID_DASHBOARD_DEFINITION", "managed dashboard definition is required");
  const bindings = assertArray(input.bindings, "dashboard bindings", { nonEmpty: true });
  const bySlot = new Map(bindings.map((binding) => [binding.slotId, binding]));
  const content = definition.slots.map((slot) => {
    const binding = bySlot.get(slot.slotId);
    if (!binding || binding.resourceRef !== slot.resourceRef) {
      fail("DASHBOARD_BINDING_MISMATCH", `dashboard slot ${slot.slotId} must bind its exact immutable resourceRef`);
    }
    return { ...slot, resourceVersionRef: assertString(binding.resourceVersionRef, `${slot.slotId}.resourceVersionRef`) };
  });
  return immutableJson({
    schemaVersion: DASHBOARD_CONTENT_VERSION_SCHEMA_VERSION,
    dashboardContentVersionId: assertString(input.dashboardContentVersionId || contentId("DASHV", { definition, content }), "dashboardContentVersionId"),
    dashboardId: definition.dashboardId,
    definitionVersion: definition.version,
    scenarioContext: assertScenarioRun(input.scenarioContext, null, "dashboard scenarioContext"),
    content,
    formedAt: assertString(input.formedAt, "dashboard formedAt"),
    status: input.status || "draft",
    immutable: true
  });
}

module.exports = Object.freeze({
  FIXED_VIEW_SNAPSHOT_SCHEMA_VERSION,
  DASHBOARD_DEFINITION_SCHEMA_VERSION,
  DASHBOARD_CONTENT_VERSION_SCHEMA_VERSION,
  createFixedViewSnapshot,
  createDashboardDefinition,
  createDashboardContentVersion
});
