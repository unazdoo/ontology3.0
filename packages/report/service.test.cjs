"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const report = require("./index.js");

const CONTEXT = Object.freeze({
  scenarioId: "S001",
  scenarioVersion: "S001-v1.1.0",
  scenarioRunId: "S001-RUN-20260824090000000-m06report",
  formedAt: "2026-08-24T09:00:00.000Z",
  status: "active"
});

function sequentialClock(start = "2026-08-24T09:00:00.000Z") {
  let value = Date.parse(start);
  return () => new Date(value++).toISOString();
}

function definitionInput() {
  return {
    reportDefinitionId: "RDEF-S001-FINANCE",
    version: "1.0.0",
    status: "enabled",
    title: "集团融资风险报告",
    purpose: {
      decisionQuestion: "集团融资风险和规则命中情况如何？",
      useContext: "内部融资风险复核",
      notApplicable: "不得作为自动授信或行动决定"
    },
    applicability: { scenarioIds: ["S001"], objectTypes: ["OT-GROUP"], scopePolicy: "single-group" },
    audience: { readers: ["finance-reviewer"], useBoundary: "internal-controlled-report" },
    templateRef: { templateId: "RT-S001-FINANCE", version: "1.0.0" },
    sections: [
      { sectionId: "overview", title: "融资概览" },
      { sectionId: "risk", title: "风险与人工边界" }
    ],
    evidenceSlots: [
      { evidenceSlotId: "metric-slot", sectionId: "overview", required: true, allowedEvidenceTypes: ["metric-result"], allowedContentTypes: ["metric"] },
      { evidenceSlotId: "rule-slot", sectionId: "risk", required: true, allowedEvidenceTypes: ["rule-result"], allowedContentTypes: ["rule-summary"] },
      { evidenceSlotId: "suggestion-slot", sectionId: "risk", required: true, allowedEvidenceTypes: ["governed-result"], allowedContentTypes: ["ai-suggestion"] }
    ],
    contentPolicy: {
      allowedContentTypes: ["metric", "rule-summary", "ai-suggestion"],
      requiredBindingKinds: ["metric-result", "rule-result", "ai-suggestion"]
    },
    coveragePolicy: { minimumRequiredCoverage: 1, blockOnUnclassified: true, blockOnExecutionError: true },
    calculationPolicy: { allowedResultTypes: ["metric-result", "rule-result", "governed-result"], roundingMode: "half-up", defaultTolerance: 0.5 },
    agentRef: { agentId: "report-draft-agent", releaseVersion: "1.0.0" },
    skillRef: { skillId: "report-structure", version: "1.0.0" },
    verificationPolicy: { rulesVersion: "T049-RULES-1.0.0", explanationPolicy: "on-demand", warningBlocksPublication: false },
    comparisonPolicy: {
      policyVersion: "C027-POLICY-1.0.0",
      allowedFactKinds: ["metric-result", "rule-result", "ai-suggestion"],
      freshnessThresholdRef: "FRESHNESS-POLICY-1.0.0",
      qualityWarningBlocks: false,
      regenerationRuleVersion: "REGEN-RULE-1.0.0"
    },
    reviewPolicy: { reviewerRoles: ["finance-reviewer"] },
    publicationPolicy: { allowedAudience: ["internal"], namingRule: "RPT-{scenario}-{date}", replacementMode: "new-version" },
    enabledAt: "2026-08-24T09:00:00.000Z",
    changeSummary: "M06 initial managed definition"
  };
}

function templateInput() {
  return {
    templateId: "RT-S001-FINANCE",
    version: "1.0.0",
    reportDefinitionId: "RDEF-S001-FINANCE",
    reportDefinitionVersion: "1.0.0",
    name: "集团融资风险正式模板",
    reportType: "finance-risk",
    slots: [
      { templateSlotId: "slot-metric", sectionId: "overview", evidenceSlotId: "metric-slot", contentType: "metric", anchorKind: "metric-value" },
      { templateSlotId: "slot-rule", sectionId: "risk", evidenceSlotId: "rule-slot", contentType: "rule-summary", anchorKind: "rule-conclusion" },
      { templateSlotId: "slot-suggestion", sectionId: "risk", evidenceSlotId: "suggestion-slot", contentType: "ai-suggestion", anchorKind: "paragraph" }
    ]
  };
}

function authorityFixture(clock) {
  const state = {
    semanticVersionId: "T019-S001-PUBLISHED-001",
    semanticVersion: "1.0.0",
    dataVersionId: "T007-S001-DATA-001",
    t008: "2026-08-23T23:59:59.000Z",
    hardFailure: false,
    qualityStatus: "pass",
    affectedScope: null,
    freshness: { status: "fresh" },
    reproducibility: { replayVerification: "consistent" },
    generationCombinationsByStage: null
  };
  let c008Reads = 0;
  let c017Reads = 0;
  function combinationFor(request) {
    return state.generationCombinationsByStage?.[request.stage] || state;
  }
  const c008Provider = {
    readCurrentC008(request) {
      c008Reads += 1;
      const combination = combinationFor(request);
      return {
        c008Id: `C008-S001-${combination.dataVersionId}`,
        version: "1.0.0",
        status: "ready",
        scenarioContext: CONTEXT,
        authoritativeRead: { receiptId: `C008-READ-${c008Reads}`, owner: "M01", source: "owner-api", mode: report.LIVE_READ_MODE, readAt: clock(), static: false },
        consumptionReadiness: { status: "ready" },
        currentAuthority: {
          t019: { id: "T019-CURRENT-S001", version: "1.0.0", status: "active" },
          publishedSemanticVersion: { id: combination.semanticVersionId, version: combination.semanticVersion },
          dataVersion: { id: combination.dataVersionId, t008: combination.t008 },
          facts: [
            { factId: "FACT-BALANCE", value: 100, unit: "CNY", semanticRef: { resourceId: "MET-BALANCE", version: "1.0.0" }, semanticCompatibility: "compatible" },
            { factId: "FACT-RULE", value: "hit", unit: null, semanticRef: { resourceId: "RULE-RISK", version: "1.0.0" }, semanticCompatibility: "compatible" },
            { factId: "FACT-SUGGESTION", value: "manual review", unit: null, semanticCompatibility: "compatible" }
          ]
        },
        candidates: [{ id: "T007-CANDIDATE", status: "processing" }],
        previousAuthority: { t019Id: "T019-PREVIOUS-S001", dataVersionId: "T007-S001-DATA-000" }
      };
    }
  };
  function c017Value(request, suffix) {
    const combination = combinationFor(request);
    return {
      summaryId: `C017-S001-${combination.dataVersionId}-${suffix}`,
      version: "1.0.0",
      summaryType: request.purpose?.includes("generation") || request.purpose === "M06-report-generation" ? "generation-binding" : "current-status",
      formedAt: clock(),
      status: "ready",
      scenarioContext: CONTEXT,
      authoritativeRead: { receiptId: `C017-READ-${++c017Reads}`, owner: "M02", source: "owner-api", mode: report.LIVE_READ_MODE, readAt: clock(), static: false },
      consumptionReadiness: { status: "ready" },
      binding: {
        semanticVersionId: combination.semanticVersionId,
        semanticVersion: combination.semanticVersion,
        dataVersionId: combination.dataVersionId,
        t008: combination.t008
      },
      quality: {
        status: state.qualityStatus,
        hardFailure: state.hardFailure,
        failureId: state.hardFailure ? "QUALITY-HARD-001" : null,
        affectedScope: state.affectedScope,
        factAt: state.hardFailure ? "2026-08-24T10:00:00.000Z" : null,
        confirmedAt: null
      },
      freshness: state.freshness,
      reproducibility: state.reproducibility,
      previousDataVersion: { dataVersionId: "T007-S001-DATA-000" },
      candidates: [{ id: "T007-CANDIDATE", status: "processing" }]
    };
  }
  const c017Provider = {
    readCurrentC017(request) { return c017Value(request, "CURRENT"); },
    readC017ForVersion(request) {
      return c017Value({ ...request, stage: null }, "BOUND");
    }
  };
  return { state, c008Provider, c017Provider, counts: () => ({ c008Reads, c017Reads }) };
}

function m05Fixture(clock) {
  const state = { submitCount: 0, extractCount: 0, extractionMode: "pass", lastC022: null };
  return {
    state,
    port: {
      submitReportGeneration(c022) {
        state.submitCount += 1;
        state.lastC022 = c022;
        return {
          schemaVersion: report.C023_SCHEMA_VERSION,
          requestId: c022.requestId,
          scenarioContext: c022.scenarioContext,
          evidencePackId: c022.evidencePack.evidencePackId,
          evidencePackVersion: c022.evidencePack.version,
          sourceDraftId: `C023-DRAFT-${state.submitCount}`,
          version: "1.0.0",
          generationRun: {
            runId: `M05-GEN-RUN-${state.submitCount}`,
            status: "completed",
            agentId: c022.agentRef.agentId,
            releaseVersion: c022.agentRef.releaseVersion,
            completedAt: clock()
          },
          contentItems: [
            {
              sourceContentItemId: "CONTENT-METRIC",
              order: 1,
              templateSlotId: "slot-metric",
              contentType: "metric",
              structuredContent: { text: "集团融资余额为 100 CNY。" },
              evidenceRefs: ["E-METRIC"],
              facts: [{ factId: "FACT-BALANCE", kind: "metric-result", value: 100, unit: "CNY", evidenceRefs: ["E-METRIC"], semanticRef: { resourceId: "MET-BALANCE", version: "1.0.0" }, tolerance: 0.5 }]
            },
            {
              sourceContentItemId: "CONTENT-RULE",
              order: 2,
              templateSlotId: "slot-rule",
              contentType: "rule-summary",
              structuredContent: { text: "融资风险规则结论为 hit。" },
              evidenceRefs: ["E-RULE"],
              facts: [{ factId: "FACT-RULE", kind: "rule-result", value: "hit", unit: null, evidenceRefs: ["E-RULE"], semanticRef: { resourceId: "RULE-RISK", version: "1.0.0" } }]
            },
            {
              sourceContentItemId: "CONTENT-SUGGESTION",
              order: 3,
              templateSlotId: "slot-suggestion",
              contentType: "ai-suggestion",
              structuredContent: { text: "AI 建议：manual review，最终结论由人工确认。" },
              evidenceRefs: ["E-SUGGESTION"],
              facts: [{ factId: "FACT-SUGGESTION", kind: "ai-suggestion", value: "manual review", unit: null, evidenceRefs: ["E-SUGGESTION"], humanConfirmationRequired: true }]
            }
          ],
          missingSections: [],
          warnings: [],
          handoffReceipt: { receiptId: `C023-RECEIPT-${state.submitCount}`, acceptedAt: clock() }
        };
      },
      extractReportClaims(request) {
        state.extractCount += 1;
        const claims = [];
        request.contentItems.forEach((item) => {
          item.facts.forEach((fact) => {
            if (state.extractionMode === "mixed" && fact.factId === "FACT-SUGGESTION") return;
            let observedValue = fact.value;
            if (state.extractionMode === "mixed" && fact.factId === "FACT-BALANCE") observedValue = 100.25;
            if (state.extractionMode === "mixed" && fact.factId === "FACT-RULE") observedValue = "miss";
            const anchor = request.anchors.find((candidate) => candidate.sourceContentItemId === item.sourceContentItemId);
            claims.push({
              claimId: `CLAIM-${state.extractCount}-${fact.factId}`,
              sourceContentItemId: item.sourceContentItemId,
              factId: fact.factId,
              t044Id: anchor.t044Id,
              observedValue,
              observedUnit: fact.unit,
              evidenceRefs: fact.evidenceRefs,
              semanticRef: fact.semanticRef
            });
          });
        });
        return {
          schemaVersion: report.EXTRACTION_RESULT_SCHEMA_VERSION,
          extractionResultId: `M05-EXTRACT-RESULT-${state.extractCount}`,
          extractionRunId: `M05-EXTRACT-RUN-${state.extractCount}`,
          scenarioContext: request.scenarioContext,
          contentVersionId: request.contentVersionId,
          evidencePackId: request.evidencePackRef.evidencePackId,
          agentReleaseVersion: "verification-extractor@1.0.0",
          status: "completed",
          claims,
          completedAt: clock()
        };
      }
    }
  };
}

function authorizationFixture(clock) {
  let calls = 0;
  return {
    authorizeReportComparison(request) {
      calls += 1;
      return {
        decisionId: `AUTH-C027-${calls}`,
        owner: "platform",
        source: "authorization-api",
        scenarioContext: request.scenarioContext,
        decidedAt: clock(),
        allowed: true,
        deniedFactIds: []
      };
    }
  };
}

function evidenceItems() {
  const fixedAt = "2026-08-24T09:01:00.000Z";
  return [
    { evidenceId: "E-METRIC", version: "1.0.0", evidenceType: "metric-result", evidenceSlotId: "metric-slot", immutableRef: "metric-result://balance/1", sourceOwner: "M01", structuredValue: 100, unit: "CNY", semanticRef: { resourceId: "MET-BALANCE", version: "1.0.0" }, evidenceRefs: ["SRC-1"], fixedAt },
    { evidenceId: "E-RULE", version: "1.0.0", evidenceType: "rule-result", evidenceSlotId: "rule-slot", immutableRef: "rule-result://risk/1", sourceOwner: "M01", structuredValue: "hit", semanticRef: { resourceId: "RULE-RISK", version: "1.0.0" }, evidenceRefs: ["SRC-2"], fixedAt },
    { evidenceId: "E-SUGGESTION", version: "1.0.0", evidenceType: "governed-result", evidenceSlotId: "suggestion-slot", immutableRef: "agent-result://suggestion/1", sourceOwner: "M05", structuredValue: "manual review", evidenceRefs: ["SRC-3"], fixedAt }
  ];
}

function buildHarness(options = {}) {
  const clock = options.clock || sequentialClock();
  const authority = authorityFixture(clock);
  const m05 = m05Fixture(clock);
  const store = report.createReportStore(options.filePath ? { filePath: options.filePath } : {});
  const service = report.createReportService({
    store,
    c008Provider: authority.c008Provider,
    c017Provider: authority.c017Provider,
    m05Port: m05.port,
    authorizationPort: authorizationFixture(clock),
    clock
  });
  service.registerReportDefinition(definitionInput());
  service.registerReportTemplate(templateInput());
  return { clock, authority, m05, store, service };
}

async function generate(harness, overrides = {}) {
  return harness.service.generateReport({
    scenarioContext: CONTEXT,
    reportDefinitionId: "RDEF-S001-FINANCE",
    reportDefinitionVersion: "1.0.0",
    objectScope: { objectTypeId: "OT-GROUP", objectId: "GROUP-001" },
    generationScope: { sections: ["overview", "risk"] },
    requestedBy: "user-001",
    collectEvidence: async () => evidenceItems(),
    ...overrides
  });
}

test("generation performs three fresh C008/C017 reads and a real C022/C023 handoff before M06 forms T044", async () => {
  const harness = buildHarness();
  const result = await generate(harness);
  assert.equal(harness.authority.counts().c008Reads, 3);
  assert.equal(harness.m05.state.submitCount, 1);
  assert.equal(harness.m05.state.lastC022.schemaVersion, report.C022_SCHEMA_VERSION);
  assert.equal(result.sourceDraft.schemaVersion, report.C023_SCHEMA_VERSION);
  assert.equal(result.anchors.length, 3);
  assert.ok(result.anchors.every((anchor) => anchor.schemaVersion === report.T044_SCHEMA_VERSION));
  assert.equal(result.sourceDraft.contentItems.some((item) => Object.hasOwn(item, "anchorId")), false);
  assert.equal(Object.isFrozen(result.contentVersion), true);
  const gateReads = harness.store.list("generationGateReads");
  assert.deepEqual(gateReads.map((gate) => gate.stage), report.GATE_STAGES);
  assert.equal(new Set(gateReads.flatMap((gate) => [gate.c008.receipt.receiptId, gate.c017.receipt.receiptId])).size, 6);
});

test("static authority input and an authority change between gates fail closed without an evidence pack or M05 Run", async () => {
  const clock = sequentialClock();
  const authority = authorityFixture(clock);
  const m05 = m05Fixture(clock);
  const staticService = report.createReportService({
    store: report.createReportStore(),
    c008Provider: { c008Id: "STATIC-C008", t019Id: "STATIC-T019" },
    c017Provider: authority.c017Provider,
    m05Port: m05.port,
    clock
  });
  staticService.registerReportDefinition(definitionInput());
  staticService.registerReportTemplate(templateInput());
  await assert.rejects(() => generate({ service: staticService }), (error) => error.code === "LIVE_OWNER_READER_REQUIRED");
  assert.equal(staticService.store.list("evidencePacks").length, 0);
  assert.equal(m05.state.submitCount, 0);

  const changed = buildHarness();
  changed.authority.state.generationCombinationsByStage = {
    "before-evidence": changed.authority.state,
    "after-evidence": { ...changed.authority.state, dataVersionId: "T007-S001-DATA-002", t008: "2026-08-24T00:00:00.000Z" },
    "before-agent": { ...changed.authority.state, dataVersionId: "T007-S001-DATA-002", t008: "2026-08-24T00:00:00.000Z" }
  };
  await assert.rejects(() => generate(changed), (error) => error.code === "AUTHORITY_CHANGED_DURING_GENERATION");
  assert.equal(changed.store.list("evidencePacks").length, 0);
  assert.equal(changed.store.list("c022Requests").length, 0);
  assert.equal(changed.m05.state.submitCount, 0);
});

test("M05 extraction precedes five deterministic groups and T049 keeps four states, anchors and coverage", async () => {
  const harness = buildHarness();
  const generated = await generate(harness);
  const passed = await harness.service.verifyContent({ contentVersionId: generated.contentVersion.contentVersionId, verificationRunId: "T049-RUN-PASS", initiatedBy: "reviewer-001" });
  assert.equal(harness.m05.state.extractCount, 1);
  assert.equal(passed.groups.length, 5);
  assert.equal(passed.status, "pass");
  assert.equal(passed.coverageStatus, "complete");
  assert.equal(passed.factCoverage.anchorCovered, 3);
  assert.ok(passed.results.every((item) => item.t044Ids.length && item.evidenceRefs.length));

  harness.m05.state.extractionMode = "mixed";
  const mixed = await harness.service.verifyContent({ contentVersionId: generated.contentVersion.contentVersionId, verificationRunId: "T049-RUN-MIXED", initiatedBy: "reviewer-001" });
  const statuses = new Set(mixed.results.filter((item) => item.applicability === "applicable").map((item) => item.status));
  assert.deepEqual([...statuses].sort(), ["fail", "pass", "unverifiable", "warning"]);
  assert.equal(harness.store.get("verificationRuns", "T049-RUN-PASS").status, "pass");
  assert.equal(mixed.status, "fail");
});

test("confirmed content publishes immutable same-source HTML/PDF and dashboard/C018 state survives store reopen", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "m06-report-store-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "report-store.json");
  const harness = buildHarness({ filePath });
  const generated = await generate(harness);
  const t049 = await harness.service.verifyContent({ contentVersionId: generated.contentVersion.contentVersionId, verificationRunId: "T049-PUBLISH", initiatedBy: "reviewer-001" });
  const decision = await harness.service.confirmReview({
    contentVersionId: generated.contentVersion.contentVersionId,
    reviewCopyId: generated.reviewCopy.reviewCopyId,
    verificationRunId: t049.verificationRunId,
    reviewer: "reviewer-001",
    conclusion: "confirmed against fixed evidence"
  });
  const artifact = await harness.service.publishReport({
    reportId: "RPT-S001-001",
    reportNo: "S001-FIN-2026-001",
    artifactVersion: "1.0.0",
    contentVersionId: generated.contentVersion.contentVersionId,
    verificationRunId: t049.verificationRunId,
    reviewDecisionId: decision.reviewDecisionId,
    publishedBy: "publisher-001"
  });
  assert.equal(artifact.status, "published");
  assert.match(artifact.frozenHtml, /data-render-mode="same-source"/);
  assert.equal(Buffer.from(artifact.frozenPdf.base64, "base64").subarray(0, 8).toString("binary"), "%PDF-1.4");
  assert.equal(artifact.contentVersions[0].sourceHash.length, 64);

  const fixedView = harness.service.importFixedQueryView({
    viewId: "C018-FINANCE-BALANCE",
    viewVersion: "1.0.0",
    businessName: "集团融资余额",
    intent: "group-finance-balance",
    scenarioContext: CONTEXT,
    owner: "M03",
    queryDefinition: { queryId: "QUERY-FIN-BALANCE", version: "1.0.0", objectParameters: { groupId: "GROUP-001" } },
    binding: { semanticVersionId: harness.authority.state.semanticVersionId, semanticVersion: harness.authority.state.semanticVersion, dataVersionId: harness.authority.state.dataVersionId, t008: harness.authority.state.t008 },
    structuredResult: { value: 100 },
    unit: "CNY",
    evidenceRefs: ["E-METRIC"],
    generatedAt: harness.clock(),
    confidence: { status: "high" },
    refreshPolicy: { mode: "explicit-compatible-refresh" },
    runStatus: "succeeded"
  });
  harness.service.registerDashboardDefinition({
    dashboardId: "DASH-S001",
    version: "1.0.0",
    scenarioId: "S001",
    title: "集团融资驾驶舱",
    createdAt: harness.clock(),
    slots: [
      { slotId: "balance", kind: "fixed-query-view", resourceRef: "C018-FINANCE-BALANCE", title: "集团融资余额" },
      { slotId: "report", kind: "published-report", resourceRef: "RPT-S001-001", title: "正式报告" }
    ]
  });
  const dashboard = harness.service.createDashboardVersion({
    dashboardId: "DASH-S001",
    definitionVersion: "1.0.0",
    scenarioContext: CONTEXT,
    bindings: [
      { slotId: "balance", resourceRef: "C018-FINANCE-BALANCE", resourceVersionRef: fixedView.snapshotId },
      { slotId: "report", resourceRef: "RPT-S001-001", resourceVersionRef: artifact.reportId }
    ]
  });
  harness.service.publishDashboardVersion({ dashboardContentVersionId: dashboard.dashboardContentVersionId, publishedBy: "publisher-001" });
  const reopened = report.createReportStore({ filePath });
  assert.equal(reopened.get("artifacts", "RPT-S001-001").contentVersions[0].sourceHash, artifact.contentVersions[0].sourceHash);
  assert.equal(reopened.get("fixedViews", fixedView.snapshotId).structuredResult.value, 100);
  assert.ok(reopened.pointer("dashboards", "DASH-S001").dashboardContentVersionId);
});

test("C027 requires an explicit user action, creates independent records and appends staleness without overwriting old results", async () => {
  const harness = buildHarness();
  const generated = await generate(harness);
  await assert.rejects(() => harness.service.compareWithCurrent({ contentVersionId: generated.contentVersion.contentVersionId, initiatedBy: "reader-001" }), (error) => error.code === "EXPLICIT_USER_ACTION_REQUIRED");
  const first = await harness.service.compareWithCurrent({ contentVersionId: generated.contentVersion.contentVersionId, initiatedBy: "reader-001", explicitUserAction: true, comparisonRunId: "C027-RUN-001" });
  assert.equal(first.result, "comparable");
  assert.equal(first.stale, false);
  const originalHash = report.reportUtils.sha256(first);
  harness.authority.state.dataVersionId = "T007-S001-DATA-002";
  harness.authority.state.t008 = "2026-08-24T10:00:00.000Z";
  const staleView = await harness.service.markComparisonStaleIfAuthorityChanged({ comparisonRecordId: first.comparisonRecordId });
  assert.equal(staleView.stale, true);
  assert.equal(report.reportUtils.sha256(harness.store.get("comparisons", first.comparisonRecordId)), originalHash);
  const second = await harness.service.compareWithCurrent({ contentVersionId: generated.contentVersion.contentVersionId, initiatedBy: "reader-001", explicitUserAction: true, comparisonRunId: "C027-RUN-002" });
  assert.notEqual(second.comparisonRecordId, first.comparisonRecordId);
  assert.equal(harness.store.list("comparisons").length, 2);
  assert.equal(harness.store.get("comparisons", first.comparisonRecordId).stale, false);
  assert.equal(harness.service.getComparison(first.comparisonRecordId).stale, true);
});

test("post-publication hard quality failure only appends a warning to the old report and blocks new generation", async () => {
  const harness = buildHarness();
  const generated = await generate(harness);
  const t049 = await harness.service.verifyContent({ contentVersionId: generated.contentVersion.contentVersionId, verificationRunId: "T049-QUALITY", initiatedBy: "reviewer-001" });
  const decision = await harness.service.confirmReview({ contentVersionId: generated.contentVersion.contentVersionId, reviewCopyId: generated.reviewCopy.reviewCopyId, verificationRunId: t049.verificationRunId, reviewer: "reviewer-001", conclusion: "confirmed" });
  const artifact = await harness.service.publishReport({ reportId: "RPT-S001-QUALITY", contentVersionId: generated.contentVersion.contentVersionId, verificationRunId: t049.verificationRunId, reviewDecisionId: decision.reviewDecisionId, publishedBy: "publisher-001" });
  const artifactHash = report.reportUtils.sha256(artifact);
  const t049Hash = report.reportUtils.sha256(t049);
  const evidenceCount = harness.store.list("evidencePacks").length;
  const submitCount = harness.m05.state.submitCount;
  harness.authority.state.hardFailure = true;
  harness.authority.state.qualityStatus = "hard-fail";
  harness.authority.state.affectedScope = { factIds: ["FACT-BALANCE"] };
  const warning = await harness.service.observePostPublicationQualityFailure({ reportId: artifact.reportId });
  assert.equal(warning.originalContentChanged, false);
  assert.equal(report.reportUtils.sha256(harness.store.get("artifacts", artifact.reportId)), artifactHash);
  assert.equal(report.reportUtils.sha256(harness.store.get("verificationRuns", t049.verificationRunId)), t049Hash);
  await assert.rejects(() => generate(harness, { requestId: "RGEN-BLOCKED-QUALITY" }), (error) => error.code === "POST_QUALITY_HARD_FAILURE");
  assert.equal(harness.store.list("evidencePacks").length, evidenceCount);
  assert.equal(harness.m05.state.submitCount, submitCount);
  assert.equal(harness.service.getPublishedReport(artifact.reportId).warnings.length, 1);
});

test("C034 exports report/evidence/T049/C027 state and clone restore creates a new read-only run", async () => {
  const harness = buildHarness();
  const generated = await generate(harness);
  await harness.service.verifyContent({ contentVersionId: generated.contentVersion.contentVersionId, verificationRunId: "T049-C034", initiatedBy: "reviewer-001" });
  await harness.service.compareWithCurrent({ contentVersionId: generated.contentVersion.contentVersionId, initiatedBy: "reader-001", explicitUserAction: true, comparisonRunId: "C027-C034" });
  const provider = report.createM06CheckpointProvider({ store: harness.store, clock: harness.clock });
  const exported = provider.export({ scenarioContext: CONTEXT, checkpointId: "CP-M06-S001-001" });
  assert.equal(provider.validate(exported).ok, true);
  assert.equal(exported.moduleExport.recordCounts.evidencePacks, 1);
  assert.equal(exported.moduleExport.recordCounts.verificationRuns, 1);
  assert.equal(exported.moduleExport.recordCounts.comparisons, 1);
  const sourceHash = report.reportUtils.sha256(exported);
  const restored = provider.cloneRestore({
    checkpoint: exported,
    targetScenarioRunId: "S001-RUN-20260824110000000-restored",
    now: "2026-08-24T11:00:00.000Z"
  });
  assert.equal(restored.targetScenarioRunId, "S001-RUN-20260824110000000-restored");
  assert.equal(restored.restoreReceipt.historicalReadOnly, true);
  assert.equal(restored.restoreReceipt.automaticPublication, false);
  assert.equal(restored.restoreReceipt.automaticRecalculation, false);
  assert.equal(Object.keys(restored.restoredState.collections.artifacts).length, 0);
  assert.equal(restored.restoreReceipt.historicalView.recordCounts.comparisons, 1);
  assert.equal(report.reportUtils.sha256(exported), sourceHash);
});
