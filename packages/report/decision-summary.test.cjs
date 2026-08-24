"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const report = require("./index.js");

const CONTEXT = Object.freeze({
  scenarioId: "S001",
  scenarioVersion: "S001-v1.1.0",
  scenarioRunId: "S001-RUN-20260824090000000-c019",
  formedAt: "2026-08-24T09:00:00.000Z",
  status: "active"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function navigation(subjectId = null, sourceScenario = "M06") {
  const filters = { status: "pending" };
  return {
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    sourceScenario,
    scenarioId: CONTEXT.scenarioId,
    scenarioVersion: CONTEXT.scenarioVersion,
    scenarioRunId: CONTEXT.scenarioRunId,
    scenarioStatus: CONTEXT.status,
    subjectId,
    filters,
    selectedComponent: "decision-summary",
    scrollPosition: 320,
    returnPosition: "report-decision-section",
    issuedAt: "2026-08-24T09:04:00.000Z",
    sourceScene: sourceScenario,
    businessSubject: subjectId ? "Unit 001" : null,
    subjectName: subjectId ? "Unit 001" : null,
    filter: clone(filters),
    returnRoute: "report-decision-section"
  };
}

function detailRef(type, targetId, subjectId, requestId = "AR-S001-001") {
  const query = new URLSearchParams({
    scenarioId: CONTEXT.scenarioId,
    scenarioVersion: CONTEXT.scenarioVersion,
    scenarioRunId: CONTEXT.scenarioRunId,
    scenarioStatus: CONTEXT.status,
    mode: "detail"
  });
  const routeTarget = type === "trace" ? requestId : targetId;
  const href = `/decision-center/detail?${query.toString()}#${type}/${encodeURIComponent(routeTarget)}`;
  return {
    targetType: type,
    targetId,
    href,
    stableDetailEntry: href,
    scenarioContext: CONTEXT,
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    navigationContext: navigation(subjectId, "S001"),
    subjectId
  };
}

function c019Summary(overrides = {}) {
  const requestRef = detailRef("request", "AR-S001-001", "UNIT-001");
  const reminderRef = detailRef("reminder", "REM-S001-001", "UNIT-001");
  const taskRef = detailRef("task", "TODO-S001-001", "UNIT-001");
  const traceRef = detailRef("trace", "TRACE-S001-001", "UNIT-001");
  const record = {
    requestId: "AR-S001-001",
    requestRef,
    reminderRef,
    confirmationRef: "CONF-S001-001",
    taskRef,
    traceRef,
    stableRefs: { request: clone(requestRef), reminder: clone(reminderRef), task: clone(taskRef), trace: clone(traceRef) },
    requestRefId: "AR-S001-001",
    reminderRefId: "REM-S001-001",
    taskRefId: "TODO-S001-001",
    traceRefId: "TRACE-S001-001",
    detailEntries: { request: clone(requestRef), reminder: clone(reminderRef), task: clone(taskRef), trace: clone(traceRef) },
    navigationContext: navigation("UNIT-001", "S001"),
    scenarioContext: CONTEXT,
    sourceType: "rule-hit",
    sourceRef: "M03-RESULT-001",
    scenario: "S001",
    sourceScene: "S001",
    subjectId: "UNIT-001",
    subjectName: "Unit 001",
    businessSubject: "Unit 001",
    actionType: { id: "ACTION-FINANCING", version: "1.0.0", name: "Financing optimization" },
    rule: { id: "RULE-RISK", version: "1.0.0", branch: "hit", hitEvidence: ["E-RULE"] },
    ruleApplicability: "applicable",
    metric: { id: "MET-BALANCE", value: 100, unit: "CNY" },
    metricId: "MET-BALANCE",
    metricValue: 100,
    semanticVersion: "SEM-S001-001",
    dataVersion: "DATA-S001-001",
    t007: "DATA-S001-001",
    cutoff: "2026-08-23T23:59:59.000Z",
    requestStatus: "received",
    reminderStatus: "task_created",
    confirmationStatus: "confirmed",
    taskStatus: "created",
    receivedAt: "2026-08-24T09:01:00.000Z",
    lastReadAt: "2026-08-24T09:03:00.000Z",
    qualityStatus: "allowed",
    c017SummaryId: "C017-S001-001",
    c017SummaryVersion: "1.0.0",
    c017SummaryFormedAt: "2026-08-24T09:03:00.000Z",
    c017EvidenceLocator: "urn:ofw:m02:c017:C017-S001-001"
  };
  const counts = {
    requests: 1,
    received: 1,
    blocked: 0,
    rejected: 0,
    awaitingConfirmation: 0,
    confirmed: 1,
    humanRejected: 0,
    tasksPending: 1,
    tasksCreated: 1,
    taskCreationBlocked: 0
  };
  return {
    schemaVersion: report.C019_SOURCE_SCHEMA_VERSION,
    contractCode: "C019",
    moduleId: "M04",
    status: "ready",
    availability: "available",
    stateRevision: 3,
    summaryAt: "2026-08-24T09:05:00.000Z",
    summaryAsOf: "2026-08-24T09:05:00.000Z",
    formedAt: "2026-08-24T09:05:00.000Z",
    scenarioContext: CONTEXT,
    readOnly: true,
    canWrite: false,
    writeCapabilities: [],
    counts,
    statusCounts: clone(counts),
    records: [record],
    navigationContext: navigation(),
    ...overrides
  };
}

function readInput(overrides = {}) {
  return {
    scenarioContext: CONTEXT,
    traceId: "TRACE-M06-C019-001",
    correlationId: "CORR-M06-C019-001",
    idempotencyKey: "IDEM-M06-C019-001",
    returnContext: {
      sourceScenario: "M06",
      subjectId: null,
      filters: { status: "pending" },
      selectedComponent: "decision-summary",
      scrollPosition: 320,
      returnPosition: "report-decision-section",
      issuedAt: "2026-08-24T09:04:00.000Z"
    },
    ...overrides
  };
}

function providerFixture(summary = c019Summary()) {
  const state = { calls: 0, summary, lastQuery: null };
  class M04OwnerApi {
    getC019Summary(query) {
      state.calls += 1;
      state.lastQuery = clone(query);
      return clone(state.summary);
    }
  }
  const owner = new M04OwnerApi();
  return { state, port: report.createM04DecisionPort(owner) };
}

function serviceFixture(provider, clock = () => "2026-08-24T09:06:00.000Z") {
  const store = report.createReportStore();
  const service = report.createReportService({ store, m04DecisionPort: provider.port, clock });
  return { store, service };
}

test("M06 official-shape consumer fixture stores only immutable M04 references and a read receipt", async () => {
  const provider = providerFixture();
  const harness = serviceFixture(provider);
  const received = await harness.service.receiveC019(readInput());

  assert.equal(received.status, "received");
  assert.equal(received.reference.sourceOwner, "M04");
  assert.equal(received.reference.version, `${report.C019_SOURCE_SCHEMA_VERSION}#3`);
  assert.equal(received.reference.resourceChains[0].resourceRefs.c011Request.targetId, "AR-S001-001");
  assert.equal(received.reference.resourceChains[0].resourceRefs.c012Reminder.targetId, "REM-S001-001");
  assert.equal(received.reference.resourceChains[0].resourceRefs.c012Decision.targetId, "CONF-S001-001");
  assert.equal(received.reference.resourceChains[0].resourceRefs.c013Task.targetId, "TODO-S001-001");
  assert.equal(received.reference.resourceChains[0].resourceRefs.c019Trace.targetId, "TRACE-S001-001");
  assert.match(received.reference.evidenceLocator, /^urn:ofw:m04:c019:C019REF-/);
  assert.equal(received.receipt.sourceFormedAt, "2026-08-24T09:05:00.000Z");
  assert.equal(received.receipt.readAt, "2026-08-24T09:06:00.000Z");
  assert.equal(received.receipt.traceId, "TRACE-M06-C019-001");
  assert.equal(received.receipt.correlationId, "CORR-M06-C019-001");
  assert.deepEqual(Object.keys(provider.state.lastQuery).sort(), ["returnContext", "scenarioContext"]);
  const storedJson = JSON.stringify(harness.store.snapshot());
  for (const forbidden of ["actionType", "metricValue", "Financing optimization", "taskStatus", "confirmationStatus"]) {
    assert.equal(storedJson.includes(forbidden), false, `${forbidden} must not be copied into M06 state`);
  }
  const stored = harness.service.readStoredC019({ receiptId: received.receipt.receiptId, scenarioContext: CONTEXT });
  assert.equal(stored.reference.referenceId, received.reference.referenceId);
  assert.equal(Object.isFrozen(stored.receipt), true);
  assert.equal(stored.receipt.resourceReturnContexts[0].navigationContext.returnPosition, "report-decision-section");
  assert.deepEqual(stored.receipt.resourceReturnContexts[0].navigationContext.filters, { status: "pending" });
});

test("C019 consumer fails closed on context, source version, owner, unknown state and write-boundary mismatches", async (t) => {
  const cases = [
    {
      name: "scenario run",
      mutate(summary) { summary.scenarioContext = { ...summary.scenarioContext, scenarioRunId: "S001-RUN-other" }; },
      code: "SCENARIO_CONTEXT_MISMATCH"
    },
    {
      name: "owner",
      mutate(summary) { summary.moduleId = "M05"; },
      code: "C019_OWNER_MISMATCH"
    },
    {
      name: "schema",
      mutate(summary) { summary.schemaVersion = "ofw.m04.c019.read-model.v2"; },
      code: "C019_SCHEMA_MISMATCH"
    },
    {
      name: "unknown status",
      mutate(summary) { summary.records[0].taskStatus = "future_state"; },
      code: "C019_STATUS_UNKNOWN"
    },
    {
      name: "unresolved owner status",
      mutate(summary) { summary.records[0].taskStatus = "unknown"; },
      code: "C019_STATUS_UNCERTAIN"
    },
    {
      name: "write capability",
      mutate(summary) { summary.canWrite = true; },
      code: "C019_WRITE_BOUNDARY_VIOLATION"
    },
    {
      name: "unknown field",
      mutate(summary) { summary.futureField = true; },
      code: "C019_UNKNOWN_FIELD"
    }
  ];
  for (const item of cases) {
    await t.test(item.name, async () => {
      const summary = c019Summary();
      item.mutate(summary);
      const provider = providerFixture(summary);
      const harness = serviceFixture(provider);
      await assert.rejects(() => harness.service.receiveC019(readInput()), (error) => error.code === item.code);
      assert.equal(harness.store.list("c019References").length, 0);
      assert.equal(harness.store.list("c019ReadReceipts").length, 0);
    });
  }
  const provider = providerFixture();
  const harness = serviceFixture(provider);
  await assert.rejects(
    () => harness.service.receiveC019(readInput({ expectedC019Version: `${report.C019_SOURCE_SCHEMA_VERSION}#4` })),
    (error) => error.code === "C019_VERSION_MISMATCH"
  );
  assert.equal(harness.store.list("c019References").length, 0);
});

test("same C019 idempotency and source version returns duplicate without a second record", async () => {
  let readTime = Date.parse("2026-08-24T09:06:00.000Z");
  const provider = providerFixture();
  const harness = serviceFixture(provider, () => new Date(readTime++).toISOString());
  const first = await harness.service.receiveC019(readInput());
  const revision = harness.store.snapshot().revision;

  provider.state.summary.summaryAt = "2026-08-24T09:07:00.000Z";
  provider.state.summary.summaryAsOf = provider.state.summary.summaryAt;
  provider.state.summary.formedAt = provider.state.summary.summaryAt;
  const duplicate = await harness.service.receiveC019(readInput());
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.receipt.receiptId, first.receipt.receiptId);
  assert.equal(harness.store.snapshot().revision, revision);
  assert.equal(harness.store.list("c019References").length, 1);
  assert.equal(harness.store.list("c019ReadReceipts").length, 1);

  provider.state.summary.records[0].confirmationStatus = "rejected";
  provider.state.summary.counts.confirmed = 0;
  provider.state.summary.counts.humanRejected = 1;
  provider.state.summary.statusCounts = clone(provider.state.summary.counts);
  await assert.rejects(
    () => harness.service.receiveC019(readInput({ idempotencyKey: "IDEM-M06-C019-SAME-VERSION-CHANGED" })),
    (error) => error.code === "C019_IMMUTABLE_VERSION_CONFLICT"
  );

  provider.state.summary = c019Summary({
    stateRevision: 4,
    summaryAt: "2026-08-24T09:08:00.000Z",
    summaryAsOf: "2026-08-24T09:08:00.000Z",
    formedAt: "2026-08-24T09:08:00.000Z"
  });
  await assert.rejects(
    () => harness.service.receiveC019(readInput()),
    (error) => error.code === "C019_IDEMPOTENCY_CONFLICT"
  );
  assert.equal(harness.store.list("c019References").length, 1);
  assert.equal(harness.store.list("c019ReadReceipts").length, 1);
});

function managedDefinition() {
  return report.createManagedReportDefinition({
    reportDefinitionId: "RDEF-S001-C019",
    version: "1.0.0",
    status: "enabled",
    title: "Decision summary report",
    purpose: { decisionQuestion: "What was formed?", useContext: "Read-only review", notApplicable: "No decision writes" },
    applicability: { scenarioIds: ["S001"], objectTypes: ["OT-UNIT"], scopePolicy: "selected-units" },
    audience: { readers: ["reviewer"], useBoundary: "internal" },
    templateRef: { templateId: "RT-S001-C019", version: "1.0.0" },
    sections: [{ sectionId: "decision", title: "Decision summary" }],
    evidenceSlots: [{ evidenceSlotId: "decision-slot", sectionId: "decision", required: true, allowedEvidenceTypes: ["decision-summary"], allowedContentTypes: ["rule-summary"] }],
    contentPolicy: { allowedContentTypes: ["rule-summary"], requiredBindingKinds: ["decision-summary"] },
    coveragePolicy: { minimumRequiredCoverage: 1, blockOnUnclassified: true, blockOnExecutionError: true },
    calculationPolicy: { allowedResultTypes: ["decision-summary"], roundingMode: "half-up", defaultTolerance: 0 },
    agentRef: { agentId: "report-agent", releaseVersion: "1.0.0" },
    skillRef: { skillId: "report-structure", version: "1.0.0" },
    verificationPolicy: { rulesVersion: "T049-1", explanationPolicy: "on-demand", warningBlocksPublication: false },
    comparisonPolicy: { policyVersion: "C027-1", allowedFactKinds: ["decision-summary"], freshnessThresholdRef: "FRESH-1", qualityWarningBlocks: false, regenerationRuleVersion: "REGEN-1" },
    reviewPolicy: { reviewerRoles: ["reviewer"] },
    publicationPolicy: { allowedAudience: ["internal"], namingRule: "RPT-{id}", replacementMode: "new-version" },
    enabledAt: "2026-08-24T09:00:00.000Z",
    changeSummary: "C019 consumer contract test"
  });
}

test("stored C019 reference becomes a governed C022 evidence item without report-success semantics", async () => {
  const provider = providerFixture();
  const harness = serviceFixture(provider);
  const received = await harness.service.receiveC019(readInput());
  const exactCombination = {
    semanticVersionId: "SEM-S001-001",
    dataVersionId: "DATA-S001-001",
    t008: "2026-08-23T23:59:59.000Z"
  };
  const item = harness.service.createC019EvidenceItem({
    receiptId: received.receipt.receiptId,
    evidenceId: "E-C019-001",
    evidenceSlotId: "decision-slot",
    fixedAt: "2026-08-24T09:08:00.000Z",
    exactCombination
  });
  assert.equal(item.evidenceType, "decision-summary");
  assert.equal(item.sourceOwner, "M04");
  assert.equal(item.resultRef.owner, "M04");
  assert.equal(item.resultRef.readOnly, true);
  assert.equal(item.t008, exactCombination.t008);
  assert.equal(item.resultRef.t008, exactCombination.t008);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "generationStatus"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "reportStatus"), false);
  assert.throws(
    () => harness.service.createC019EvidenceItem({
      receiptId: received.receipt.receiptId,
      evidenceId: "E-C019-WRONG-T008",
      evidenceSlotId: "decision-slot",
      fixedAt: "2026-08-24T09:08:00.000Z",
      exactCombination: { ...exactCombination, t008: "2026-08-23T00:00:00.000Z" }
    }),
    (error) => error.code === "C019_EVIDENCE_VERSION_MISMATCH"
  );

  const definition = managedDefinition();
  const template = report.createManagedReportTemplate({
    templateId: "RT-S001-C019",
    version: "1.0.0",
    name: "Decision summary template",
    reportType: "decision-summary",
    slots: [{ templateSlotId: "decision-content", sectionId: "decision", evidenceSlotId: "decision-slot", contentType: "rule-summary", anchorKind: "paragraph" }]
  }, definition);
  const fixedContext = {
    schemaVersion: report.FIXED_CONTEXT_SCHEMA_VERSION,
    fixedContextId: "FCTX-C019-001",
    scenarioContext: CONTEXT,
    exactCombination,
    generationBindingSummary: { summaryId: "C017-S001-001", version: "1.0.0", formedAt: "2026-08-24T09:03:00.000Z" },
    gateReadIds: ["GATE-1", "GATE-2", "GATE-3"],
    immutable: true
  };
  const evidencePack = report.buildEvidencePack({
    definition,
    template,
    fixedContext,
    evidenceItems: [item],
    fixedAt: "2026-08-24T09:08:00.000Z"
  });
  const c022 = report.buildC022Request({
    requestId: "C022-C019-001",
    reportAggregateId: "RAG-C019-001",
    scenarioContext: CONTEXT,
    definition,
    template,
    objectScope: { objectTypeId: "OT-UNIT", objectId: "UNIT-001" },
    generationScope: { sections: ["decision"] },
    evidencePack,
    fixedContext,
    requestedAt: "2026-08-24T09:08:00.000Z",
    idempotencyKey: "IDEM-C022-C019-001"
  });
  assert.equal(c022.status, "submitted");
  assert.equal(c022.evidencePack.items[0].resultRef.id, received.reference.referenceId);
  assert.equal(c022.evidencePack.items[0].structuredValue.resourceChainCount, 1);
});

test("ReportService consumer fixtures fix C019 through three live gates and the C022/C023 service path", async () => {
  let clockValue = Date.parse("2026-08-24T09:06:00.000Z");
  const clock = () => new Date(clockValue++).toISOString();
  const m04 = providerFixture();
  const reads = { c008: 0, c017: 0, c022: 0, lastC022: null };
  const exactCombination = {
    semanticVersionId: "SEM-S001-001",
    semanticVersion: "1.0.0",
    dataVersionId: "DATA-S001-001",
    t008: "2026-08-23T23:59:59.000Z"
  };
  const c008Provider = {
    readCurrentC008() {
      reads.c008 += 1;
      return {
        c008Id: "C008-S001-C019-GEN",
        version: "1.0.0",
        status: "ready",
        scenarioContext: CONTEXT,
        authoritativeRead: { receiptId: `C008-C019-GEN-${reads.c008}`, owner: "M01", source: "owner-api", mode: report.LIVE_READ_MODE, readAt: clock(), static: false },
        consumptionReadiness: { status: "ready" },
        currentAuthority: {
          t019: { id: "T019-S001-C019-GEN", version: "1.0.0", status: "active" },
          publishedSemanticVersion: { id: exactCombination.semanticVersionId, version: exactCombination.semanticVersion },
          dataVersion: { id: exactCombination.dataVersionId, t008: exactCombination.t008 },
          facts: []
        }
      };
    }
  };
  const c017Provider = {
    readCurrentC017() {
      reads.c017 += 1;
      return {
        summaryId: "C017-S001-C019-GEN",
        version: "1.0.0",
        summaryType: "generation-binding",
        formedAt: clock(),
        status: "ready",
        scenarioContext: CONTEXT,
        authoritativeRead: { receiptId: `C017-C019-GEN-${reads.c017}`, owner: "M02", source: "owner-api", mode: report.LIVE_READ_MODE, readAt: clock(), static: false },
        consumptionReadiness: { status: "ready" },
        binding: exactCombination,
        quality: { status: "pass", hardFailure: false }
      };
    }
  };
  const m05Port = {
    submitReportGeneration(c022) {
      reads.c022 += 1;
      reads.lastC022 = c022;
      return {
        schemaVersion: report.C023_SCHEMA_VERSION,
        requestId: c022.requestId,
        scenarioContext: c022.scenarioContext,
        evidencePackId: c022.evidencePack.evidencePackId,
        evidencePackVersion: c022.evidencePack.version,
        sourceDraftId: "C023-C019-GEN-001",
        version: "1.0.0",
        generationRun: {
          runId: "M05-RUN-C019-GEN-001",
          status: "completed",
          agentId: c022.agentRef.agentId,
          releaseVersion: c022.agentRef.releaseVersion,
          completedAt: clock()
        },
        contentItems: [{
          sourceContentItemId: "CONTENT-C019-GEN-001",
          order: 1,
          templateSlotId: "decision-content",
          contentType: "rule-summary",
          structuredContent: { text: "Decision summary is fixed by its M04 reference." },
          evidenceRefs: ["E-C019-GEN-001"],
          facts: [{ factId: "FACT-C019-GEN-001", kind: "decision-summary", value: "referenced", evidenceRefs: ["E-C019-GEN-001"] }]
        }],
        missingSections: [],
        warnings: [],
        handoffReceipt: { receiptId: "C023-RECEIPT-C019-GEN-001", acceptedAt: clock() }
      };
    }
  };
  const store = report.createReportStore();
  const service = report.createReportService({
    store,
    m04DecisionPort: m04.port,
    c008Provider,
    c017Provider,
    m05Port,
    clock
  });
  const definition = managedDefinition();
  service.registerReportDefinition(definition);
  service.registerReportTemplate({
    templateId: "RT-S001-C019",
    version: "1.0.0",
    reportDefinitionId: definition.reportDefinitionId,
    reportDefinitionVersion: definition.version,
    name: "Decision summary template",
    reportType: "decision-summary",
    slots: [{ templateSlotId: "decision-content", sectionId: "decision", evidenceSlotId: "decision-slot", contentType: "rule-summary", anchorKind: "paragraph" }]
  });
  const received = await service.receiveC019(readInput());
  const generated = await service.generateReport({
    requestId: "RGEN-C019-001",
    scenarioContext: CONTEXT,
    reportDefinitionId: definition.reportDefinitionId,
    reportDefinitionVersion: definition.version,
    objectScope: { objectTypeId: "OT-UNIT", objectId: "UNIT-001" },
    generationScope: { sections: ["decision"] },
    requestedBy: "reviewer-001",
    collectEvidence: async ({ exactCombination: fixed }) => [service.createC019EvidenceItem({
      receiptId: received.receipt.receiptId,
      evidenceId: "E-C019-GEN-001",
      evidenceSlotId: "decision-slot",
      fixedAt: clock(),
      exactCombination: fixed
    })]
  });
  assert.equal(reads.c008, 3);
  assert.equal(reads.c017, 3);
  assert.equal(reads.c022, 1);
  assert.equal(reads.lastC022.evidencePack.items[0].resultRef.id, received.reference.referenceId);
  assert.equal(reads.lastC022.evidencePack.items[0].t008, exactCombination.t008);
  assert.equal(generated.sourceDraft.sourceDraftId, "C023-C019-GEN-001");
  assert.ok(generated.contentVersion.contentVersionId);
  assert.equal(Object.prototype.hasOwnProperty.call(received.receipt, "generationStatus"), false);
  assert.equal(store.list("c019ReadReceipts").length, 1);
});

test("C034 exports and clone-restores C019 references and receipts as historical read-only state", async () => {
  const provider = providerFixture();
  const harness = serviceFixture(provider);
  await harness.service.receiveC019(readInput());
  const checkpointProvider = report.createM06CheckpointProvider({ store: harness.store, clock: () => "2026-08-24T09:10:00.000Z" });
  const exported = checkpointProvider.export({ scenarioContext: CONTEXT, checkpointId: "CP-M06-C019-001" });
  assert.equal(checkpointProvider.validate(exported).ok, true);
  assert.equal(exported.moduleExport.recordCounts.c019References, 1);
  assert.equal(exported.moduleExport.recordCounts.c019ReadReceipts, 1);
  assert.equal(exported.moduleExport.includes.includes("C019-read-references"), true);

  const restored = checkpointProvider.cloneRestore({
    checkpoint: exported,
    targetScenarioRunId: "S001-RUN-20260824100000000-c019-restored",
    now: "2026-08-24T10:00:00.000Z"
  });
  const references = Object.values(restored.restoredState.collections.c019References);
  const receipts = Object.values(restored.restoredState.collections.c019ReadReceipts);
  assert.equal(references.length, 1);
  assert.equal(receipts.length, 1);
  assert.equal(references[0].scenarioContext.scenarioRunId, CONTEXT.scenarioRunId);
  assert.equal(references[0].readOnly, true);
  assert.equal(receipts[0].immutable, true);
  assert.equal(restored.restoreReceipt.historicalReadOnly, true);
  assert.equal(restored.restoreReceipt.historicalSideEffectsReplayed, false);

  const moduleExport = report.buildReportModuleExport({
    scenarioContext: CONTEXT,
    checkpointNode: "agent-report-dashboard-completed",
    runtimeState: harness.store.snapshot()
  });
  assert.equal(report.validateReportModuleExport(moduleExport).ok, true);
  assert.ok(moduleExport.resources.some((item) => item.resourceType === "decision-summary-reference"));
  assert.ok(moduleExport.resources.some((item) => item.resourceType === "decision-summary-read-receipt"));
  const restorePlan = report.buildReportRestorePlan({ moduleExport, checkpointId: "CP-M06-C019-GENERIC" });
  assert.equal(restorePlan.moduleAdapters[0].resourceCounts.c019References, 1);
  assert.equal(restorePlan.moduleAdapters[0].resourceCounts.c019ReadReceipts, 1);
  const genericRestored = report.cloneReportModuleState(moduleExport, {
    now: "2026-08-24T10:00:00.000Z",
    runIdFactory: (scenarioId) => `${scenarioId}-RUN-c019-generic-restored`
  });
  assert.equal(genericRestored.c019References[0].readOnly, true);
  assert.equal(genericRestored.c019ReadReceipts[0].sourceOwner, "M04");
  const historical = report.historicalView(moduleExport);
  assert.equal(historical.c019References.length, 1);
  assert.equal(historical.c019ReadReceipts.length, 1);

  const writable = clone(exported);
  const writableReference = Object.values(writable.moduleExport.state.collections.c019References)[0];
  writableReference.canWrite = true;
  writableReference.writeCapabilities = ["mutate"];
  writableReference.businessRows = [{ secret: true }];
  const { contentHash: _oldHash, ...hashable } = writable.moduleExport;
  writable.moduleExport.contentHash = report.reportUtils.sha256(hashable);
  const validation = checkpointProvider.validate(writable);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => ["C019_UNKNOWN_FIELD", "C019_WRITE_BOUNDARY_VIOLATION"].includes(error.code)));
  assert.throws(
    () => checkpointProvider.cloneRestore({
      checkpoint: writable,
      targetScenarioRunId: "S001-RUN-20260824100000000-c019-invalid",
      now: "2026-08-24T10:00:00.000Z"
    }),
    (error) => error.code === "INVALID_M06_CHECKPOINT"
  );

  const brokenState = clone(harness.store.snapshot());
  const brokenReceipt = Object.values(brokenState.collections.c019ReadReceipts)[0];
  brokenReceipt.referenceRef.referenceId = "C019REF-missing";
  assert.throws(
    () => report.buildReportModuleExport({ scenarioContext: CONTEXT, runtimeState: brokenState }),
    (error) => error.code === "INVALID_REPORT_MODULE_EXPORT"
  );
});
