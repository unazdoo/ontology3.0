"use strict";

const { fail } = require("./errors");
const {
  assertObject,
  assertString,
  assertArray,
  assertScenarioRun,
  immutableJson,
  cloneJson,
  stableSerialize,
  sha256,
  contentId
} = require("./utils");

const C019_SOURCE_SCHEMA_VERSION = "ofw.m04.c019.read-model.v1";
const C019_REFERENCE_SCHEMA_VERSION = "ofw.m06.c019-reference.v1";
const C019_READ_RECEIPT_SCHEMA_VERSION = "ofw.m06.c019-read-receipt.v1";
const C019_SOURCE_OWNER = "M04";
const C019_SOURCE_OWNER_NAME = "Decision Center";
const C019_EVIDENCE_TYPE = "decision-summary";

const TOP_LEVEL_FIELDS = Object.freeze([
  "schemaVersion", "contractCode", "moduleId", "status", "availability",
  "stateRevision", "summaryAt", "summaryAsOf", "formedAt", "scenarioContext",
  "readOnly", "canWrite", "writeCapabilities", "counts", "statusCounts",
  "records", "navigationContext"
]);
const RECORD_FIELDS = Object.freeze([
  "requestId", "requestRef", "reminderRef", "confirmationRef", "taskRef", "traceRef",
  "stableRefs", "requestRefId", "reminderRefId", "taskRefId", "traceRefId",
  "detailEntries", "navigationContext", "scenarioContext", "sourceType", "sourceRef",
  "scenario", "sourceScene", "subjectId", "subjectName", "businessSubject", "actionType",
  "rule", "ruleApplicability", "metric", "metricId", "metricValue", "semanticVersion",
  "dataVersion", "t007", "cutoff", "requestStatus", "reminderStatus",
  "confirmationStatus", "taskStatus", "receivedAt", "lastReadAt", "qualityStatus",
  "c017SummaryId", "c017SummaryVersion", "c017SummaryFormedAt", "c017EvidenceLocator"
]);
const DETAIL_REF_FIELDS = Object.freeze([
  "targetType", "targetId", "href", "stableDetailEntry", "scenarioContext",
  "readOnly", "canWrite", "writeCapabilities", "navigationContext", "subjectId"
]);
const NAVIGATION_FIELDS = Object.freeze([
  "readOnly", "canWrite", "writeCapabilities", "sourceScenario", "scenarioId",
  "scenarioVersion", "scenarioRunId", "scenarioStatus", "subjectId", "filters",
  "selectedComponent", "scrollPosition", "returnPosition", "issuedAt", "sourceScene",
  "businessSubject", "subjectName", "filter", "returnRoute"
]);
const RETURN_CONTEXT_FIELDS = Object.freeze([
  "sourceScenario", "subjectId", "filters", "selectedComponent", "scrollPosition",
  "returnPosition", "issuedAt"
]);
const READ_INPUT_FIELDS = Object.freeze([
  "scenarioContext", "traceId", "correlationId", "idempotencyKey", "returnContext",
  "expectedC019Version", "expectedStateRevision"
]);
const COUNTS_FIELDS = Object.freeze([
  "requests", "received", "blocked", "rejected", "awaitingConfirmation", "confirmed",
  "humanRejected", "tasksPending", "tasksCreated", "taskCreationBlocked"
]);
const REQUEST_STATUSES = new Set(["received", "rejected", "unknown", "unlocatable", "read_error", "version_conflict"]);
const REMINDER_STATUSES = new Set([
  "not_formed", "awaiting_confirmation", "rejected", "confirmed", "task_created",
  "task_creation_blocked", "task_creation_failed"
]);
const CONFIRMATION_STATUSES = new Set(["pending", "rejected", "rejected_pending", "blocked", "confirmed"]);
const TASK_STATUSES = new Set(["not_created", "created", "rejected", "blocked", "unknown", "create_failed"]);
const STORED_REFERENCE_FIELDS = Object.freeze([
  "schemaVersion", "referenceId", "version", "evidenceLocator", "contractId",
  "sourceContract", "sourceOwner", "sourceOwnerName", "scenarioContext", "sourceStatus",
  "sourceProjectionHash", "resourceChains", "readOnly", "canWrite", "writeCapabilities",
  "immutable", "contentHash"
]);
const STORED_RECEIPT_FIELDS = Object.freeze([
  "schemaVersion", "receiptId", "version", "contractId", "owner", "sourceOwner",
  "scenarioContext", "traceId", "correlationId", "idempotencyKey", "requestFingerprint",
  "referenceRef", "sourceFormedAt", "readAt", "sourceStatus", "readStatus", "outcome",
  "scope", "navigationContext", "resourceReturnContexts", "readOnly", "canWrite",
  "writeCapabilities", "immutable", "contentHash"
]);
const STORED_CHAIN_FIELDS = Object.freeze([
  "requestId", "scenarioContext", "sourceContext", "exactVersions", "receivedAt",
  "lastC017ReadAt", "c017Ref", "resourceRefs"
]);
const STORED_RESOURCE_REF_FIELDS = Object.freeze([
  "contractCode", "targetType", "targetId", "href", "stableDetailEntry",
  "scenarioContext", "subjectId", "readOnly", "canWrite", "writeCapabilities"
]);
const STORED_NAVIGATION_FIELDS = Object.freeze([
  "readOnly", "canWrite", "writeCapabilities", "sourceScenario", "scenarioId",
  "scenarioVersion", "scenarioRunId", "scenarioStatus", "subjectId", "filters",
  "selectedComponent", "scrollPosition", "returnPosition", "issuedAt"
]);
const HASH_RE = /^[a-f0-9]{64}$/;

function assertAllowedKeys(value, allowed, label) {
  assertObject(value, label);
  const unknownFields = Object.keys(value).filter((field) => !allowed.includes(field));
  if (unknownFields.length) fail("C019_UNKNOWN_FIELD", `${label} contains unknown fields`, { unknownFields });
  return value;
}

function optionalString(value, label) {
  return value === null || value === undefined ? null : assertString(value, label);
}

function assertIso(value, label) {
  const source = assertString(value, label);
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) fail("C019_TIME_INVALID", `${label} must be an ISO timestamp`);
  return date.toISOString();
}

function assertReadOnlyBoundary(value, label) {
  if (value.readOnly !== true || value.canWrite !== false) {
    fail("C019_WRITE_BOUNDARY_VIOLATION", `${label} must be explicitly read-only`);
  }
  const capabilities = assertArray(value.writeCapabilities, `${label}.writeCapabilities`);
  if (capabilities.length !== 0) fail("C019_WRITE_BOUNDARY_VIOLATION", `${label} must not carry write capabilities`);
}

function assertKnownStatus(value, allowed, label) {
  const status = assertString(value, label);
  if (!allowed.has(status)) fail("C019_STATUS_UNKNOWN", `${label} is not a known M04 C019 status`, { status });
  return status;
}

function assertSameJson(left, right, code, message) {
  if (stableSerialize(left) !== stableSerialize(right)) fail(code, message);
}

function normalizeReturnContextInput(value) {
  const input = value === undefined ? {} : assertAllowedKeys(value, RETURN_CONTEXT_FIELDS, "C019 returnContext");
  const filters = input.filters === undefined ? {} : cloneJson(assertObject(input.filters, "C019 returnContext.filters"));
  return immutableJson({
    sourceScenario: optionalString(input.sourceScenario, "C019 returnContext.sourceScenario") || "M06",
    subjectId: optionalString(input.subjectId, "C019 returnContext.subjectId"),
    filters,
    selectedComponent: optionalString(input.selectedComponent, "C019 returnContext.selectedComponent"),
    scrollPosition: input.scrollPosition === undefined ? null : cloneJson(input.scrollPosition),
    returnPosition: optionalString(input.returnPosition, "C019 returnContext.returnPosition"),
    issuedAt: optionalString(input.issuedAt, "C019 returnContext.issuedAt")
  });
}

function prepareC019Read(input) {
  assertAllowedKeys(input, READ_INPUT_FIELDS, "C019 read input");
  const expectedStateRevision = input.expectedStateRevision;
  if (expectedStateRevision !== undefined && expectedStateRevision !== null
    && (!Number.isInteger(expectedStateRevision) || expectedStateRevision < 0)) {
    fail("C019_VERSION_INVALID", "expectedStateRevision must be a non-negative integer");
  }
  return immutableJson({
    scenarioContext: assertScenarioRun(input.scenarioContext, null, "C019 read scenarioContext"),
    traceId: assertString(input.traceId, "C019 traceId"),
    correlationId: assertString(input.correlationId, "C019 correlationId"),
    idempotencyKey: assertString(input.idempotencyKey, "C019 idempotencyKey"),
    returnContext: normalizeReturnContextInput(input.returnContext),
    expectedC019Version: optionalString(input.expectedC019Version, "C019 expectedC019Version"),
    expectedStateRevision: expectedStateRevision === undefined ? null : expectedStateRevision
  });
}

function normalizeNavigation(value, scenarioContext, label) {
  assertAllowedKeys(value, NAVIGATION_FIELDS, label);
  assertReadOnlyBoundary(value, label);
  for (const field of ["scenarioId", "scenarioVersion", "scenarioRunId"]) {
    if (value[field] !== scenarioContext[field]) fail("C019_NAVIGATION_CONTEXT_MISMATCH", `${label}.${field} does not match C033`);
  }
  if (value.scenarioStatus !== scenarioContext.status) {
    fail("C019_NAVIGATION_CONTEXT_MISMATCH", `${label}.scenarioStatus does not match C033`);
  }
  const sourceScenario = assertString(value.sourceScenario, `${label}.sourceScenario`);
  if (value.sourceScene !== sourceScenario) fail("C019_NAVIGATION_ALIAS_MISMATCH", `${label}.sourceScene is inconsistent`);
  const filters = cloneJson(assertObject(value.filters, `${label}.filters`));
  assertSameJson(value.filter, filters, "C019_NAVIGATION_ALIAS_MISMATCH", `${label}.filter is inconsistent`);
  const returnPosition = optionalString(value.returnPosition, `${label}.returnPosition`);
  if (optionalString(value.returnRoute, `${label}.returnRoute`) !== returnPosition) {
    fail("C019_NAVIGATION_ALIAS_MISMATCH", `${label}.returnRoute is inconsistent`);
  }
  optionalString(value.businessSubject, `${label}.businessSubject`);
  optionalString(value.subjectName, `${label}.subjectName`);
  return immutableJson({
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    sourceScenario,
    scenarioId: scenarioContext.scenarioId,
    scenarioVersion: scenarioContext.scenarioVersion,
    scenarioRunId: scenarioContext.scenarioRunId,
    scenarioStatus: scenarioContext.status,
    subjectId: optionalString(value.subjectId, `${label}.subjectId`),
    filters,
    selectedComponent: optionalString(value.selectedComponent, `${label}.selectedComponent`),
    scrollPosition: cloneJson(value.scrollPosition),
    returnPosition,
    issuedAt: optionalString(value.issuedAt, `${label}.issuedAt`)
  });
}

function assertStableDetailEntry(value, type, scenarioContext, label) {
  const entry = assertString(value, label);
  let url;
  try {
    url = new URL(entry, "https://m04.invalid");
  } catch (_) {
    fail("C019_DETAIL_ENTRY_INVALID", `${label} must be a stable M04 detail entry`);
  }
  if (!entry.startsWith("/decision-center/detail?") || url.origin !== "https://m04.invalid" || url.pathname !== "/decision-center/detail") {
    fail("C019_DETAIL_ENTRY_INVALID", `${label} must remain inside the M04 decision detail boundary`);
  }
  const allowedQuery = new Set(["scenarioId", "scenarioVersion", "scenarioRunId", "scenarioStatus", "mode"]);
  const unknownQuery = [...new Set(url.searchParams.keys())].filter((field) => !allowedQuery.has(field));
  if (unknownQuery.length) fail("C019_DETAIL_ENTRY_INVALID", `${label} contains unknown navigation parameters`, { unknownQuery });
  for (const field of ["scenarioId", "scenarioVersion", "scenarioRunId"]) {
    if (url.searchParams.get(field) !== scenarioContext[field]) fail("C019_DETAIL_ENTRY_CONTEXT_MISMATCH", `${label} does not bind exact C033`);
  }
  if (url.searchParams.get("scenarioStatus") !== scenarioContext.status
    || !["detail", "historical-readonly"].includes(url.searchParams.get("mode"))) {
    fail("C019_DETAIL_ENTRY_INVALID", `${label} has an invalid mode or scenario status`);
  }
  if (!url.hash.startsWith(`#${type}/`) || url.hash.length <= type.length + 2) {
    fail("C019_DETAIL_ENTRY_INVALID", `${label} does not identify the expected target type`);
  }
  return entry;
}

function normalizeDetailRef(value, expectedType, expectedId, scenarioContext, label) {
  if (value === null) return { reference: null, navigationContext: null };
  assertAllowedKeys(value, DETAIL_REF_FIELDS, label);
  assertReadOnlyBoundary(value, label);
  if (value.targetType !== expectedType) fail("C019_REFERENCE_TYPE_MISMATCH", `${label}.targetType must be ${expectedType}`);
  const targetId = assertString(value.targetId, `${label}.targetId`);
  if (expectedId !== null && targetId !== expectedId) fail("C019_REFERENCE_ID_MISMATCH", `${label}.targetId does not match its stable id`);
  const refContext = assertScenarioRun(value.scenarioContext, scenarioContext, `${label}.scenarioContext`);
  const href = assertStableDetailEntry(value.href, expectedType, refContext, `${label}.href`);
  if (value.stableDetailEntry !== href) fail("C019_DETAIL_ENTRY_MISMATCH", `${label}.stableDetailEntry must equal href`);
  const navigationContext = normalizeNavigation(value.navigationContext, refContext, `${label}.navigationContext`);
  const subjectId = optionalString(value.subjectId, `${label}.subjectId`);
  return {
    reference: immutableJson({
      targetType: expectedType,
      targetId,
      href,
      stableDetailEntry: href,
      scenarioContext: refContext,
      subjectId,
      readOnly: true,
      canWrite: false,
      writeCapabilities: []
    }),
    navigationContext
  };
}

function optionalId(value, label) {
  return value === null ? null : assertString(value, label);
}

function contractReference(contractCode, value) {
  return value ? immutableJson({ contractCode, ...value }) : null;
}

function assertHash(value, label) {
  if (typeof value !== "string" || !HASH_RE.test(value)) fail("C019_STORED_HASH_INVALID", `${label} must be a SHA-256 hash`);
  return value;
}

function assertStoredNavigation(value, scenarioContext, label) {
  assertAllowedKeys(value, STORED_NAVIGATION_FIELDS, label);
  assertReadOnlyBoundary(value, label);
  for (const field of ["scenarioId", "scenarioVersion", "scenarioRunId"]) {
    if (value[field] !== scenarioContext[field]) fail("C019_STORED_CONTEXT_MISMATCH", `${label}.${field} does not match C033`);
  }
  if (value.scenarioStatus !== scenarioContext.status) fail("C019_STORED_CONTEXT_MISMATCH", `${label}.scenarioStatus does not match C033`);
  assertString(value.sourceScenario, `${label}.sourceScenario`);
  optionalString(value.subjectId, `${label}.subjectId`);
  assertObject(value.filters, `${label}.filters`);
  optionalString(value.selectedComponent, `${label}.selectedComponent`);
  if (value.scrollPosition === undefined) fail("C019_STORED_RECORD_INVALID", `${label}.scrollPosition is required`);
  optionalString(value.returnPosition, `${label}.returnPosition`);
  optionalString(value.issuedAt, `${label}.issuedAt`);
}

function assertStoredResourceRef(value, key, scenarioContext, label) {
  if (value === null) {
    if (["c011Request", "c019Trace"].includes(key)) fail("C019_STORED_REFERENCE_INVALID", `${label} is required`);
    return;
  }
  assertAllowedKeys(value, STORED_RESOURCE_REF_FIELDS, label);
  assertReadOnlyBoundary(value, label);
  const expected = {
    c011Request: ["C011", "request"],
    c012Reminder: ["C012", "reminder"],
    c012Decision: ["C012", "confirmation"],
    c013Task: ["C013", "task"],
    c019Trace: ["C019", "trace"]
  }[key];
  if (!expected || value.contractCode !== expected[0] || value.targetType !== expected[1]) {
    fail("C019_STORED_REFERENCE_INVALID", `${label} has an invalid contract or target type`);
  }
  assertString(value.targetId, `${label}.targetId`);
  const refContext = assertScenarioRun(value.scenarioContext, scenarioContext, `${label}.scenarioContext`);
  if (key === "c012Decision") {
    if (value.stableDetailEntry !== null || value.href !== undefined) {
      fail("C019_STORED_REFERENCE_INVALID", `${label} must not invent an M04 confirmation detail entry`);
    }
  } else {
    const href = assertStableDetailEntry(value.href, expected[1], refContext, `${label}.href`);
    if (value.stableDetailEntry !== href) fail("C019_STORED_REFERENCE_INVALID", `${label}.stableDetailEntry must equal href`);
    optionalString(value.subjectId, `${label}.subjectId`);
  }
}

function assertStoredChain(value, scenarioContext, index) {
  const label = `C019 reference.resourceChains[${index}]`;
  assertAllowedKeys(value, STORED_CHAIN_FIELDS, label);
  const requestId = assertString(value.requestId, `${label}.requestId`);
  assertScenarioRun(value.scenarioContext, scenarioContext, `${label}.scenarioContext`);
  const sourceContext = assertAllowedKeys(value.sourceContext, ["sourceType", "sourceRef", "sourceScenario", "subjectId"], `${label}.sourceContext`);
  assertString(sourceContext.sourceType, `${label}.sourceContext.sourceType`);
  optionalString(sourceContext.sourceRef, `${label}.sourceContext.sourceRef`);
  assertString(sourceContext.sourceScenario, `${label}.sourceContext.sourceScenario`);
  assertString(sourceContext.subjectId, `${label}.sourceContext.subjectId`);
  const versions = assertAllowedKeys(value.exactVersions, ["semanticVersion", "dataVersion", "t007", "dataCutoff"], `${label}.exactVersions`);
  assertString(versions.semanticVersion, `${label}.exactVersions.semanticVersion`);
  assertString(versions.dataVersion, `${label}.exactVersions.dataVersion`);
  assertString(versions.t007, `${label}.exactVersions.t007`);
  optionalString(versions.dataCutoff, `${label}.exactVersions.dataCutoff`);
  assertIso(value.receivedAt, `${label}.receivedAt`);
  if (value.lastC017ReadAt !== null) assertIso(value.lastC017ReadAt, `${label}.lastC017ReadAt`);
  if (value.c017Ref !== null) {
    const c017Ref = assertAllowedKeys(value.c017Ref, ["summaryId", "version", "formedAt", "evidenceLocator"], `${label}.c017Ref`);
    optionalString(c017Ref.summaryId, `${label}.c017Ref.summaryId`);
    optionalString(c017Ref.version, `${label}.c017Ref.version`);
    if (c017Ref.formedAt !== null) assertIso(c017Ref.formedAt, `${label}.c017Ref.formedAt`);
    optionalString(c017Ref.evidenceLocator, `${label}.c017Ref.evidenceLocator`);
  }
  const refs = assertAllowedKeys(value.resourceRefs, ["c011Request", "c012Reminder", "c012Decision", "c013Task", "c019Trace"], `${label}.resourceRefs`);
  for (const key of ["c011Request", "c012Reminder", "c012Decision", "c013Task", "c019Trace"]) {
    assertStoredResourceRef(refs[key], key, scenarioContext, `${label}.resourceRefs.${key}`);
  }
  if (refs.c011Request.targetId !== requestId) fail("C019_STORED_REFERENCE_INVALID", `${label} request reference does not match requestId`);
}

function assertStoredC019Reference(value, expectedScenarioContext) {
  assertAllowedKeys(value, STORED_REFERENCE_FIELDS, "stored C019 reference");
  if (value.schemaVersion !== C019_REFERENCE_SCHEMA_VERSION || value.contractId !== "C019") {
    fail("C019_STORED_REFERENCE_INVALID", "stored C019 reference schema or contract is invalid");
  }
  if (value.sourceOwner !== C019_SOURCE_OWNER || value.sourceOwnerName !== C019_SOURCE_OWNER_NAME) {
    fail("C019_STORED_REFERENCE_INVALID", "stored C019 reference Owner is invalid");
  }
  assertReadOnlyBoundary(value, "stored C019 reference");
  if (value.immutable !== true) fail("C019_STORED_REFERENCE_INVALID", "stored C019 reference must be immutable");
  const scenarioContext = assertScenarioRun(value.scenarioContext, expectedScenarioContext || null, "stored C019 reference.scenarioContext");
  const sourceContract = assertAllowedKeys(value.sourceContract, ["schemaVersion", "contractCode", "moduleId", "stateRevision", "version"], "stored C019 reference.sourceContract");
  if (sourceContract.schemaVersion !== C019_SOURCE_SCHEMA_VERSION || sourceContract.contractCode !== "C019" || sourceContract.moduleId !== C019_SOURCE_OWNER
    || !Number.isInteger(sourceContract.stateRevision) || sourceContract.stateRevision < 0) {
    fail("C019_STORED_REFERENCE_INVALID", "stored C019 source contract is invalid");
  }
  const expectedVersion = `${sourceContract.schemaVersion}#${sourceContract.stateRevision}`;
  if (sourceContract.version !== expectedVersion || value.version !== expectedVersion) {
    fail("C019_STORED_REFERENCE_INVALID", "stored C019 source version is invalid");
  }
  if (!["ready", "empty"].includes(value.sourceStatus)) fail("C019_STORED_REFERENCE_INVALID", "stored C019 source status is invalid");
  assertHash(value.sourceProjectionHash, "stored C019 sourceProjectionHash");
  const chains = assertArray(value.resourceChains, "stored C019 resourceChains");
  if ((value.sourceStatus === "ready") !== (chains.length > 0)) fail("C019_STORED_REFERENCE_INVALID", "stored C019 source status does not match resource chains");
  chains.forEach((chain, index) => assertStoredChain(chain, scenarioContext, index));
  const referenceId = assertString(value.referenceId, "stored C019 referenceId");
  const expectedReferenceId = contentId("C019REF", { scenarioContext, sourceVersion: value.version });
  if (referenceId !== expectedReferenceId || value.evidenceLocator !== `urn:ofw:m04:c019:${referenceId}`) {
    fail("C019_STORED_REFERENCE_INVALID", "stored C019 reference identity or evidence locator is invalid");
  }
  const referenceBody = {
    contractId: value.contractId,
    sourceContract: value.sourceContract,
    sourceOwner: value.sourceOwner,
    sourceOwnerName: value.sourceOwnerName,
    scenarioContext: value.scenarioContext,
    sourceStatus: value.sourceStatus,
    sourceProjectionHash: value.sourceProjectionHash,
    resourceChains: value.resourceChains,
    readOnly: value.readOnly,
    canWrite: value.canWrite,
    writeCapabilities: value.writeCapabilities,
    immutable: value.immutable
  };
  if (assertHash(value.contentHash, "stored C019 reference.contentHash") !== sha256(referenceBody)) {
    fail("C019_STORED_HASH_MISMATCH", "stored C019 reference content hash does not match");
  }
  return immutableJson(value);
}

function assertStoredC019ReadReceipt(value, reference, expectedScenarioContext) {
  assertAllowedKeys(value, STORED_RECEIPT_FIELDS, "stored C019 read receipt");
  if (value.schemaVersion !== C019_READ_RECEIPT_SCHEMA_VERSION || value.contractId !== "C019" || value.version !== "1.0.0") {
    fail("C019_STORED_RECEIPT_INVALID", "stored C019 read receipt schema or contract is invalid");
  }
  if (value.owner !== "M06" || value.sourceOwner !== C019_SOURCE_OWNER || value.immutable !== true) {
    fail("C019_STORED_RECEIPT_INVALID", "stored C019 read receipt Owner boundary is invalid");
  }
  assertReadOnlyBoundary(value, "stored C019 read receipt");
  const scenarioContext = assertScenarioRun(value.scenarioContext, expectedScenarioContext || reference?.scenarioContext || null, "stored C019 read receipt.scenarioContext");
  for (const field of ["traceId", "correlationId", "idempotencyKey"]) assertString(value[field], `stored C019 read receipt.${field}`);
  assertHash(value.requestFingerprint, "stored C019 read receipt.requestFingerprint");
  if (value.sourceStatus !== reference.sourceStatus || value.readStatus !== "succeeded" || value.outcome !== "received" || value.scope !== "read-receipt-only") {
    fail("C019_STORED_RECEIPT_INVALID", "stored C019 read receipt status is invalid");
  }
  assertIso(value.sourceFormedAt, "stored C019 read receipt.sourceFormedAt");
  assertIso(value.readAt, "stored C019 read receipt.readAt");
  const referenceRef = assertAllowedKeys(value.referenceRef, ["referenceId", "version", "evidenceLocator"], "stored C019 read receipt.referenceRef");
  if (referenceRef.referenceId !== reference.referenceId || referenceRef.version !== reference.version || referenceRef.evidenceLocator !== reference.evidenceLocator) {
    fail("C019_STORED_REFERENCE_MISMATCH", "stored C019 read receipt does not identify its immutable reference");
  }
  assertStoredNavigation(value.navigationContext, scenarioContext, "stored C019 read receipt.navigationContext");
  const requestIds = new Set(reference.resourceChains.map((chain) => chain.requestId));
  assertArray(value.resourceReturnContexts, "stored C019 read receipt.resourceReturnContexts").forEach((item, index) => {
    const label = `stored C019 read receipt.resourceReturnContexts[${index}]`;
    assertAllowedKeys(item, ["requestId", "navigationContext", "detailNavigation"], label);
    const requestId = assertString(item.requestId, `${label}.requestId`);
    if (!requestIds.has(requestId)) fail("C019_STORED_RECEIPT_INVALID", `${label} identifies an unknown request`);
    assertStoredNavigation(item.navigationContext, scenarioContext, `${label}.navigationContext`);
    const detailNavigation = assertAllowedKeys(item.detailNavigation, ["c011Request", "c012Reminder", "c013Task", "c019Trace"], `${label}.detailNavigation`);
    for (const key of ["c011Request", "c012Reminder", "c013Task", "c019Trace"]) {
      if (detailNavigation[key] !== null) assertStoredNavigation(detailNavigation[key], scenarioContext, `${label}.detailNavigation.${key}`);
    }
  });
  const receiptId = assertString(value.receiptId, "stored C019 read receipt.receiptId");
  const expectedReceiptId = contentId("C019READ", { scenarioContext, idempotencyKey: value.idempotencyKey, sourceVersion: reference.version });
  if (receiptId !== expectedReceiptId) fail("C019_STORED_RECEIPT_INVALID", "stored C019 read receipt identity is invalid");
  const receiptBody = {
    contractId: value.contractId,
    owner: value.owner,
    sourceOwner: value.sourceOwner,
    scenarioContext: value.scenarioContext,
    traceId: value.traceId,
    correlationId: value.correlationId,
    idempotencyKey: value.idempotencyKey,
    requestFingerprint: value.requestFingerprint,
    referenceRef: value.referenceRef,
    sourceFormedAt: value.sourceFormedAt,
    readAt: value.readAt,
    sourceStatus: value.sourceStatus,
    readStatus: value.readStatus,
    outcome: value.outcome,
    scope: value.scope,
    navigationContext: value.navigationContext,
    resourceReturnContexts: value.resourceReturnContexts,
    readOnly: value.readOnly,
    canWrite: value.canWrite,
    writeCapabilities: value.writeCapabilities,
    immutable: value.immutable
  };
  if (assertHash(value.contentHash, "stored C019 read receipt.contentHash") !== sha256(receiptBody)) {
    fail("C019_STORED_HASH_MISMATCH", "stored C019 read receipt content hash does not match");
  }
  return immutableJson(value);
}

function assertStoredC019Pair(reference, receipt, expectedScenarioContext) {
  const validReference = assertStoredC019Reference(reference, expectedScenarioContext);
  const validReceipt = assertStoredC019ReadReceipt(receipt, validReference, expectedScenarioContext);
  return immutableJson({ reference: validReference, receipt: validReceipt });
}

function normalizeRecord(record, index, scenarioContext) {
  const label = `C019.records[${index}]`;
  assertAllowedKeys(record, RECORD_FIELDS, label);
  const recordContext = assertScenarioRun(record.scenarioContext, scenarioContext, `${label}.scenarioContext`);
  const requestId = assertString(record.requestId, `${label}.requestId`);
  const requestRefId = assertString(record.requestRefId, `${label}.requestRefId`);
  if (requestRefId !== requestId) fail("C019_REFERENCE_ID_MISMATCH", `${label}.requestRefId must equal requestId`);
  const reminderRefId = optionalId(record.reminderRefId, `${label}.reminderRefId`);
  const taskRefId = optionalId(record.taskRefId, `${label}.taskRefId`);
  const traceRefId = assertString(record.traceRefId, `${label}.traceRefId`);
  const confirmationRef = optionalId(record.confirmationRef, `${label}.confirmationRef`);
  const stableRefs = assertAllowedKeys(record.stableRefs, ["request", "reminder", "task", "trace"], `${label}.stableRefs`);
  const detailEntries = assertAllowedKeys(record.detailEntries, ["request", "reminder", "task", "trace"], `${label}.detailEntries`);
  for (const type of ["request", "reminder", "task", "trace"]) {
    assertSameJson(record[`${type}Ref`], stableRefs[type], "C019_REFERENCE_ALIAS_MISMATCH", `${label}.${type}Ref and stableRefs.${type} differ`);
    assertSameJson(record[`${type}Ref`], detailEntries[type], "C019_REFERENCE_ALIAS_MISMATCH", `${label}.${type}Ref and detailEntries.${type} differ`);
  }
  const request = normalizeDetailRef(record.requestRef, "request", requestRefId, recordContext, `${label}.requestRef`);
  const reminder = normalizeDetailRef(record.reminderRef, "reminder", reminderRefId, recordContext, `${label}.reminderRef`);
  const task = normalizeDetailRef(record.taskRef, "task", taskRefId, recordContext, `${label}.taskRef`);
  const trace = normalizeDetailRef(record.traceRef, "trace", traceRefId, recordContext, `${label}.traceRef`);
  if (!request.reference || !trace.reference) fail("C019_REQUIRED_REFERENCE_MISSING", `${label} requires real request and trace references`);
  if (Boolean(reminder.reference) !== Boolean(reminderRefId) || Boolean(task.reference) !== Boolean(taskRefId)) {
    fail("C019_REFERENCE_ID_MISMATCH", `${label} reference presence does not match its stable id`);
  }
  const statuses = {
    requestStatus: assertKnownStatus(record.requestStatus, REQUEST_STATUSES, `${label}.requestStatus`),
    reminderStatus: assertKnownStatus(record.reminderStatus, REMINDER_STATUSES, `${label}.reminderStatus`),
    confirmationStatus: assertKnownStatus(record.confirmationStatus, CONFIRMATION_STATUSES, `${label}.confirmationStatus`),
    taskStatus: assertKnownStatus(record.taskStatus, TASK_STATUSES, `${label}.taskStatus`)
  };
  if (["unknown", "unlocatable", "read_error", "version_conflict"].includes(statuses.requestStatus)
    || statuses.taskStatus === "unknown") {
    fail("C019_STATUS_UNCERTAIN", `${label} contains an unresolved M04 owner status`);
  }
  const semanticVersion = assertString(record.semanticVersion, `${label}.semanticVersion`);
  const dataVersion = assertString(record.dataVersion, `${label}.dataVersion`);
  const t007 = assertString(record.t007, `${label}.t007`);
  const dataCutoff = optionalString(record.cutoff, `${label}.cutoff`);
  const subjectId = assertString(record.subjectId, `${label}.subjectId`);
  const sourceType = assertString(record.sourceType, `${label}.sourceType`);
  const sourceRef = optionalString(record.sourceRef, `${label}.sourceRef`);
  const sourceScenario = optionalString(record.scenario, `${label}.scenario`) || sourceType;
  if (record.sourceScene !== sourceScenario) fail("C019_SOURCE_CONTEXT_MISMATCH", `${label}.sourceScene is inconsistent`);
  optionalString(record.subjectName, `${label}.subjectName`);
  optionalString(record.businessSubject, `${label}.businessSubject`);
  optionalString(record.ruleApplicability, `${label}.ruleApplicability`);
  optionalString(record.metricId, `${label}.metricId`);
  const receivedAt = assertIso(record.receivedAt, `${label}.receivedAt`);
  const lastReadAt = record.lastReadAt === null ? null : assertIso(record.lastReadAt, `${label}.lastReadAt`);
  const qualityStatus = optionalString(record.qualityStatus, `${label}.qualityStatus`);
  const c017SummaryId = optionalString(record.c017SummaryId, `${label}.c017SummaryId`);
  const c017SummaryVersion = optionalString(record.c017SummaryVersion, `${label}.c017SummaryVersion`);
  const c017SummaryFormedAt = record.c017SummaryFormedAt === null ? null : assertIso(record.c017SummaryFormedAt, `${label}.c017SummaryFormedAt`);
  const c017EvidenceLocator = optionalString(record.c017EvidenceLocator, `${label}.c017EvidenceLocator`);
  const c017Ref = [c017SummaryId, c017SummaryVersion, c017SummaryFormedAt, c017EvidenceLocator].some((value) => value !== null)
    ? { summaryId: c017SummaryId, version: c017SummaryVersion, formedAt: c017SummaryFormedAt, evidenceLocator: c017EvidenceLocator }
    : null;
  const navigationContext = normalizeNavigation(record.navigationContext, recordContext, `${label}.navigationContext`);
  return {
    chain: immutableJson({
      requestId,
      scenarioContext: recordContext,
      sourceContext: { sourceType, sourceRef, sourceScenario, subjectId },
      exactVersions: { semanticVersion, dataVersion, t007, dataCutoff },
      receivedAt,
      lastC017ReadAt: lastReadAt,
      c017Ref,
      resourceRefs: {
        c011Request: contractReference("C011", request.reference),
        c012Reminder: contractReference("C012", reminder.reference),
        c012Decision: confirmationRef ? {
          contractCode: "C012",
          targetType: "confirmation",
          targetId: confirmationRef,
          stableDetailEntry: null,
          scenarioContext: recordContext,
          readOnly: true,
          canWrite: false,
          writeCapabilities: []
        } : null,
        c013Task: contractReference("C013", task.reference),
        c019Trace: contractReference("C019", trace.reference)
      }
    }),
    navigation: immutableJson({
      requestId,
      navigationContext,
      detailNavigation: {
        c011Request: request.navigationContext,
        c012Reminder: reminder.navigationContext,
        c013Task: task.navigationContext,
        c019Trace: trace.navigationContext
      }
    }),
    statuses
  };
}

function validateCounts(value, records) {
  assertAllowedKeys(value, COUNTS_FIELDS, "C019.counts");
  for (const field of COUNTS_FIELDS) {
    if (!Number.isInteger(value[field]) || value[field] < 0) fail("C019_COUNTS_INVALID", `C019.counts.${field} must be a non-negative integer`);
  }
  const statuses = records.map((record) => record.statuses);
  const expected = {
    requests: records.length,
    received: statuses.filter((item) => item.requestStatus === "received").length,
    blocked: statuses.filter((item) => ["unknown", "unlocatable", "read_error", "version_conflict"].includes(item.requestStatus)).length,
    rejected: statuses.filter((item) => item.requestStatus === "rejected").length,
    awaitingConfirmation: statuses.filter((item) => item.reminderStatus === "awaiting_confirmation").length,
    confirmed: statuses.filter((item) => item.confirmationStatus === "confirmed").length,
    humanRejected: statuses.filter((item) => item.confirmationStatus === "rejected").length,
    tasksCreated: records.filter((item) => item.chain.resourceRefs.c013Task !== null).length,
    taskCreationBlocked: statuses.filter((item) => ["blocked", "rejected", "create_failed", "unknown"].includes(item.taskStatus)).length
  };
  for (const [field, expectedValue] of Object.entries(expected)) {
    if (value[field] !== expectedValue) fail("C019_COUNTS_MISMATCH", `C019.counts.${field} does not match records`);
  }
  if (value.tasksPending > value.tasksCreated) fail("C019_COUNTS_MISMATCH", "C019.counts.tasksPending exceeds tasksCreated");
  return immutableJson(value);
}

function acceptC019Summary(raw, input) {
  assertObject(input, "C019 acceptance input");
  const { readAt: suppliedReadAt, ...readInput } = input;
  const prepared = prepareC019Read(readInput);
  assertAllowedKeys(raw, TOP_LEVEL_FIELDS, "C019 summary");
  if (raw.schemaVersion !== C019_SOURCE_SCHEMA_VERSION) {
    fail("C019_SCHEMA_MISMATCH", `C019 schemaVersion must be ${C019_SOURCE_SCHEMA_VERSION}`);
  }
  if (raw.contractCode !== "C019") fail("C019_CONTRACT_MISMATCH", "C019 contractCode must be C019");
  if (raw.moduleId !== C019_SOURCE_OWNER) fail("C019_OWNER_MISMATCH", "C019 source owner must be M04");
  if (!Number.isInteger(raw.stateRevision) || raw.stateRevision < 0) fail("C019_VERSION_INVALID", "C019 stateRevision must be a non-negative integer");
  const sourceVersion = `${raw.schemaVersion}#${raw.stateRevision}`;
  if (prepared.expectedStateRevision !== null && raw.stateRevision !== prepared.expectedStateRevision) {
    fail("C019_VERSION_MISMATCH", "C019 stateRevision does not match the requested version");
  }
  if (prepared.expectedC019Version !== null && sourceVersion !== prepared.expectedC019Version) {
    fail("C019_VERSION_MISMATCH", "C019 source version does not match the requested version");
  }
  const scenarioContext = assertScenarioRun(raw.scenarioContext, prepared.scenarioContext, "C019 summary.scenarioContext");
  assertReadOnlyBoundary(raw, "C019 summary");
  if (raw.availability !== "available") fail("C019_AVAILABILITY_INVALID", "C019 availability must be available");
  if (!["ready", "empty"].includes(raw.status)) fail("C019_STATUS_UNKNOWN", "C019 summary status is not known", { status: raw.status });
  if (raw.summaryAt !== raw.summaryAsOf || raw.summaryAt !== raw.formedAt) {
    fail("C019_FORMED_TIME_MISMATCH", "C019 summaryAt, summaryAsOf and formedAt must identify the same read");
  }
  const sourceFormedAt = assertIso(raw.summaryAt, "C019 summaryAt");
  const records = assertArray(raw.records, "C019.records").map((record, index) => normalizeRecord(record, index, scenarioContext));
  if ((raw.status === "ready") !== (records.length > 0)) fail("C019_STATUS_MISMATCH", "C019 ready/empty status does not match records");
  const counts = validateCounts(raw.counts, records);
  assertSameJson(raw.statusCounts, counts, "C019_COUNTS_MISMATCH", "C019 statusCounts must match counts");
  const navigationContext = normalizeNavigation(raw.navigationContext, scenarioContext, "C019.navigationContext");
  const returnedContext = {
    sourceScenario: navigationContext.sourceScenario,
    subjectId: navigationContext.subjectId,
    filters: navigationContext.filters,
    selectedComponent: navigationContext.selectedComponent,
    scrollPosition: navigationContext.scrollPosition,
    returnPosition: navigationContext.returnPosition,
    issuedAt: navigationContext.issuedAt
  };
  assertSameJson(returnedContext, prepared.returnContext, "C019_RETURN_CONTEXT_MISMATCH", "M04 did not return the exact requested navigation context");
  const sourceProjectionHash = sha256({
    sourceStatus: raw.status,
    counts,
    records: records.map((record) => ({
      requestId: record.chain.requestId,
      referenceHash: sha256(record.chain),
      statuses: record.statuses
    }))
  });
  const referenceBody = {
    contractId: "C019",
    sourceContract: {
      schemaVersion: raw.schemaVersion,
      contractCode: raw.contractCode,
      moduleId: raw.moduleId,
      stateRevision: raw.stateRevision,
      version: sourceVersion
    },
    sourceOwner: C019_SOURCE_OWNER,
    sourceOwnerName: C019_SOURCE_OWNER_NAME,
    scenarioContext,
    sourceStatus: raw.status,
    sourceProjectionHash,
    resourceChains: records.map((record) => record.chain),
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    immutable: true
  };
  const referenceId = contentId("C019REF", { scenarioContext, sourceVersion });
  const reference = immutableJson({
    schemaVersion: C019_REFERENCE_SCHEMA_VERSION,
    referenceId,
    version: sourceVersion,
    evidenceLocator: `urn:ofw:m04:c019:${referenceId}`,
    ...referenceBody,
    contentHash: sha256(referenceBody)
  });
  const readAt = assertIso(suppliedReadAt, "C019 readAt");
  const receiptBody = {
    contractId: "C019",
    owner: "M06",
    sourceOwner: C019_SOURCE_OWNER,
    scenarioContext,
    traceId: prepared.traceId,
    correlationId: prepared.correlationId,
    idempotencyKey: prepared.idempotencyKey,
    requestFingerprint: sha256({
      scenarioContext: prepared.scenarioContext,
      traceId: prepared.traceId,
      correlationId: prepared.correlationId,
      idempotencyKey: prepared.idempotencyKey,
      returnContext: prepared.returnContext,
      expectedC019Version: prepared.expectedC019Version,
      expectedStateRevision: prepared.expectedStateRevision
    }),
    referenceRef: { referenceId, version: sourceVersion, evidenceLocator: reference.evidenceLocator },
    sourceFormedAt,
    readAt,
    sourceStatus: raw.status,
    readStatus: "succeeded",
    outcome: "received",
    scope: "read-receipt-only",
    navigationContext,
    resourceReturnContexts: records.map((record) => record.navigation),
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    immutable: true
  };
  const receiptId = contentId("C019READ", { scenarioContext, idempotencyKey: prepared.idempotencyKey, sourceVersion });
  const accepted = immutableJson({
    reference,
    receipt: {
      schemaVersion: C019_READ_RECEIPT_SCHEMA_VERSION,
      receiptId,
      version: "1.0.0",
      ...receiptBody,
      contentHash: sha256(receiptBody)
    }
  });
  return assertStoredC019Pair(accepted.reference, accepted.receipt, scenarioContext);
}

function createM04DecisionPort(provider) {
  if (provider === null || (typeof provider !== "object" && typeof provider !== "function")) {
    fail("M04_C019_PORT_INVALID", "M04 decision provider must expose an owner API instance");
  }
  const method = typeof provider.readC019 === "function"
    ? provider.readC019
    : typeof provider.getC019Summary === "function"
      ? provider.getC019Summary
      : null;
  if (!method) fail("M04_C019_PORT_INVALID", "M04 decision provider must expose readC019() or getC019Summary()");
  return Object.freeze({
    readC019(query) {
      assertAllowedKeys(query, ["scenarioContext", "returnContext"], "M04 C019 port query");
      const scenarioContext = assertScenarioRun(query.scenarioContext, null, "M04 C019 port scenarioContext");
      const returnContext = normalizeReturnContextInput(query.returnContext);
      return method.call(provider, { scenarioContext, returnContext });
    }
  });
}

function commonVersion(chains, field) {
  const values = [...new Set(chains.map((chain) => chain.exactVersions[field]))];
  if (values.length !== 1) fail("C019_EVIDENCE_VERSION_MIXED", `selected C019 references do not share one ${field}`);
  return values[0];
}

function buildC019EvidenceItem(input) {
  assertAllowedKeys(input, [
    "reference", "receipt", "evidenceId", "evidenceSlotId", "fixedAt", "requestIds",
    "exactCombination", "objectScope", "evidenceRefs"
  ], "C019 evidence input");
  const stored = assertStoredC019Pair(input.reference, input.receipt);
  const reference = stored.reference;
  const receipt = stored.receipt;
  if (reference.sourceStatus !== "ready" || reference.resourceChains.length === 0) {
    fail("C019_EVIDENCE_UNAVAILABLE", "only a ready C019 reference can enter a C022 evidence pack");
  }
  const requestedIds = input.requestIds === undefined
    ? null
    : assertArray(input.requestIds, "C019 evidence requestIds", { nonEmpty: true }).map((id) => assertString(id, "C019 requestId"));
  if (requestedIds && new Set(requestedIds).size !== requestedIds.length) fail("C019_EVIDENCE_SELECTION_INVALID", "C019 requestIds must be unique");
  const selected = requestedIds
    ? requestedIds.map((requestId) => reference.resourceChains.find((chain) => chain.requestId === requestId))
    : reference.resourceChains;
  if (selected.some((chain) => !chain)) fail("C019_EVIDENCE_SELECTION_INVALID", "C019 evidence selection contains an unknown requestId");
  const semanticVersion = commonVersion(selected, "semanticVersion");
  const dataVersion = commonVersion(selected, "dataVersion");
  const exactCombination = assertObject(input.exactCombination, "C019 exactCombination");
  const t008 = assertString(exactCombination.t008, "C019 exactCombination.t008");
  const dataCutoff = commonVersion(selected, "dataCutoff");
  if (exactCombination.semanticVersionId !== semanticVersion
    || exactCombination.dataVersionId !== dataVersion
    || dataCutoff !== t008) {
    fail("C019_EVIDENCE_VERSION_MISMATCH", "C019 evidence does not match the fixed report semantic/data versions");
  }
  const stableEntries = selected.flatMap((chain) => Object.values(chain.resourceRefs)
    .filter(Boolean)
    .map((resourceRef) => resourceRef.stableDetailEntry)
    .filter(Boolean));
  const evidenceRefs = [...new Set([
    reference.evidenceLocator,
    ...stableEntries,
    ...(input.evidenceRefs === undefined ? [] : assertArray(input.evidenceRefs, "C019 evidenceRefs").map((ref) => assertString(ref, "C019 evidenceRef")))
  ])];
  return immutableJson({
    evidenceId: assertString(input.evidenceId, "C019 evidenceId"),
    version: reference.version,
    evidenceType: C019_EVIDENCE_TYPE,
    evidenceSlotId: assertString(input.evidenceSlotId, "C019 evidenceSlotId"),
    immutableRef: reference.evidenceLocator,
    sourceOwner: C019_SOURCE_OWNER,
    structuredValue: {
      contractId: "C019",
      snapshotKind: "immutable-reference",
      sourceStatus: reference.sourceStatus,
      sourceFormedAt: receipt.sourceFormedAt,
      resourceChainCount: selected.length
    },
    unit: null,
    precision: null,
    rounding: null,
    objectScope: input.objectScope || null,
    semanticRef: null,
    resultRef: {
      type: C019_EVIDENCE_TYPE,
      contractId: "C019",
      id: reference.referenceId,
      version: reference.version,
      owner: C019_SOURCE_OWNER,
      readReceiptId: receipt.receiptId,
      evidenceLocator: reference.evidenceLocator,
      formedAt: receipt.sourceFormedAt,
      readAt: receipt.readAt,
      dataVersion: dataVersion,
      t008,
      readOnly: true
    },
    semanticVersionId: semanticVersion,
    dataVersionId: dataVersion,
    t008,
    evidenceRefs,
    fixedAt: assertIso(input.fixedAt, "C019 evidence fixedAt"),
    accessible: true,
    authorized: true,
    immutable: true
  });
}

module.exports = Object.freeze({
  C019_SOURCE_SCHEMA_VERSION,
  C019_REFERENCE_SCHEMA_VERSION,
  C019_READ_RECEIPT_SCHEMA_VERSION,
  C019_SOURCE_OWNER,
  C019_EVIDENCE_TYPE,
  prepareC019Read,
  acceptC019Summary,
  createM04DecisionPort,
  createDecisionSummaryPort: createM04DecisionPort,
  buildC019EvidenceItem,
  assertStoredC019Reference,
  assertStoredC019ReadReceipt,
  assertStoredC019Pair
});
