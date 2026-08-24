"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const report = require("./index.js");
const foundationCheckpoint = require("../checkpoint");

function scenarioContext() {
  return {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-20260824080000000-abcdef123456",
    formedAt: "2026-08-24T08:00:00.000Z",
    status: "active"
  };
}

function reportSource() {
  return {
    reportId: "RPT-S002-001",
    scenarioContext: scenarioContext(),
    title: "S002 预算监督管理报告",
    subtitle: "同源 HTML / PDF 固定输出",
    definition: {
      reportDefinitionId: "C022-S002-v1",
      title: "S002 预算监督管理报告",
      sections: [
        { sectionId: "overview", title: "预算执行概览" },
        { sectionId: "anomalies", title: "异常与关注事项" }
      ]
    },
    template: {
      templateId: "C023-S002-v1",
      reportDefinitionId: "C022-S002-v1",
      slots: [
        { slotId: "slot-overview", sectionId: "overview" },
        { slotId: "slot-anomalies", sectionId: "anomalies" }
      ]
    },
    sections: [
      {
        sectionId: "overview",
        summary: "固定读取 C018 / C019 后形成的不可变正文。",
        blocks: [
          {
            contentItemId: "CONTENT-001",
            anchorId: "anchor-content-001",
            text: "报告生成前重新读取 C008/C017，并按固定 renderManifest 冻结上下文。",
            factRefs: ["FACT-001"],
            evidenceRefs: ["EVID-001"]
          }
        ]
      },
      {
        sectionId: "anomalies",
        blocks: [
          {
            contentItemId: "CONTENT-002",
            anchorId: "anchor-content-002",
            text: "质量失败仅警告旧报告，并阻断新生成。",
            factRefs: ["FACT-002"],
            evidenceRefs: ["EVID-002"]
          }
        ]
      }
    ],
    renderManifest: {
      manifestId: "RM-S002-v1",
      version: "1.0.0",
      items: [
        {
          contentItemId: "CONTENT-001",
          anchorId: "anchor-content-001",
          sectionId: "overview",
          templateSlot: "slot-overview",
          location: "overview/CONTENT-001",
          factRefs: ["FACT-001"],
          evidenceRefs: ["EVID-001"]
        },
        {
          contentItemId: "CONTENT-002",
          anchorId: "anchor-content-002",
          sectionId: "anomalies",
          templateSlot: "slot-anomalies",
          location: "anomalies/CONTENT-002",
          factRefs: ["FACT-002"],
          evidenceRefs: ["EVID-002"]
        }
      ]
    },
    verificationPlan: [
      { id: "T049-001", factId: "FACT-001", contentItemId: "CONTENT-001", checkType: "deterministicFactCheck", owner: "报告中心" },
      { id: "T049-002", factId: "FACT-002", contentItemId: "CONTENT-002", checkType: "unboundContentDetection", owner: "报告中心" }
    ],
    contentSnapshot: {
      c018: { contractId: "C018-S002-v1", fixedView: { annualFacts: [{ year: 2025, actualRevenue: 78.5 }] } },
      c019: { decisionSummary: { status: "no-runtime-actions" } }
    }
  };
}

function runtimeState() {
  const frozenReport = report.createFrozenReportRecord(reportSource(), { now: "2026-08-24T08:05:00.000Z" });
  const dashboardVersion = report.createDashboardVersion({ report: frozenReport, dashboardVersionId: "DASH-S002-001" });
  const dashboardView = report.createDashboardView({ report: frozenReport, dashboardVersionId: "DASH-S002-001" });
  return {
    moduleId: "M06",
    moduleVersion: "S002-M06-1.0.0",
    reports: [frozenReport],
    dashboardVersions: [dashboardVersion],
    dashboardView,
    evidencePackages: [{ evidencePackageId: "EP-S002-001", version: "1.0.0", status: "available", contentSnapshotRef: frozenReport.contentSnapshotRef }],
    verificationRuns: [{ verificationRunId: "VRF-S002-001", version: "1.0.0", status: "completed", contentSnapshotRef: frozenReport.contentSnapshotRef }],
    verificationResults: [{ verificationResultId: "VRF-RESULT-S002-001", version: "1.0.0", status: "completed", contentSnapshotRef: frozenReport.contentSnapshotRef }],
    comparisonRecords: [{ comparisonId: "CMP-S002-001", version: "1.0.0", recordStatus: "已陈旧", contentSnapshotRef: frozenReport.contentSnapshotRef }]
  };
}

test("report definition and template are immutable and validated", () => {
  const definition = report.createReportDefinition(reportSource().definition);
  const template = report.createReportTemplate(reportSource().template, { definition });
  assert.equal(definition.schemaVersion, report.REPORT_DEFINITION_SCHEMA_VERSION);
  assert.equal(template.schemaVersion, report.REPORT_TEMPLATE_SCHEMA_VERSION);
  assert.equal(Object.isFrozen(definition), true);
  assert.equal(Object.isFrozen(template), true);
  assert.throws(() => report.createReportTemplate({ templateId: "bad", slots: [] }), (error) => error.code === "MISSING_TEMPLATE_REPORT_DEFINITION");
});

test("same-source HTML and PDF share the same frozen source and PDF bytes are real", () => {
  const rendered = report.renderSameSourceBundle(reportSource());
  assert.equal(rendered.schemaVersion, report.SAME_SOURCE_RENDER_SCHEMA_VERSION);
  assert.match(rendered.html, /data-render-mode="same-source"/);
  assert.match(rendered.html, /anchor-content-001/);
  assert.equal(rendered.renderManifest.items.length, 2);
  assert.equal(Buffer.isBuffer(rendered.pdfBytes), true);
  assert.equal(rendered.pdfBytes.subarray(0, 8).toString("binary"), "%PDF-1.4");
  assert.match(rendered.pdfBytes.toString("binary"), /%%EOF/);
  assert.match(rendered.pdfBytes.toString("binary"), /Report ID: RPT-S002-001/);
  assert.match(rendered.pdfBytes.toString("binary"), /Definition: C022-S002-v1 \/ Template: C023-S002-v1/);
});

test("frozen report record stores immutable content versions and ignores later input mutation", () => {
  const source = reportSource();
  const frozen = report.createFrozenReportRecord(source, { now: "2026-08-24T08:05:00.000Z" });
  source.sections[0].blocks[0].text = "MUTATED";
  source.contentSnapshot.c018.fixedView.annualFacts[0].actualRevenue = 0;
  assert.equal(frozen.contentVersions.length, 1);
  assert.equal(frozen.contentVersionId.startsWith("CV-RPT-S002-001-"), true);
  assert.match(frozen.frozenHtml, /固定读取 C018 \/ C019/);
  assert.equal(frozen.contentSnapshot.c018.fixedView.annualFacts[0].actualRevenue, 78.5);
  assert.equal(Buffer.from(frozen.frozenPdf.base64, "base64").subarray(0, 8).toString("binary"), "%PDF-1.4");
});

test("module export carries reports, evidence, dashboards and comparison records without opening boundaries", () => {
  const exported = report.buildReportModuleExport({
    scenarioContext: scenarioContext(),
    checkpointNode: "agent-report-dashboard-completed",
    formedAt: "2026-08-24T08:10:00.000Z",
    runtimeState: runtimeState()
  });
  assert.equal(exported.stateDeclaration, "referenced");
  assert.equal(exported.ownerBoundary.ownsDecisionState, false);
  assert.deepEqual(exported.sideEffectPolicy, foundationCheckpoint.SIDE_EFFECT_POLICY);
  assert.equal(exported.foundationContractVersion, report.FOUNDATION_CONTRACT_VERSION);
  assert.equal(exported.checkpointSpiVersion, foundationCheckpoint.PROVIDER_SPI_VERSION);
  const legacyPolicy = JSON.parse(JSON.stringify(exported));
  legacyPolicy.sideEffectPolicy.allowHistoricalReplay = false;
  assert.equal(report.validateReportModuleExport(legacyPolicy).ok, false);
  assert.ok(report.validateReportModuleExport(legacyPolicy).errors.some((error) => error.code === "SIDE_EFFECT_POLICY_UNKNOWN_FIELD"));
  assert.ok(exported.resources.some((item) => item.resourceType === "report-draft"));
  assert.ok(exported.resources.some((item) => item.resourceType === "dashboard-version"));
  assert.ok(exported.resources.some((item) => item.resourceType === "evidence-package"));
  assert.ok(exported.resources.some((item) => item.resourceType === "report-comparison-record"));
  const receipt = report.buildReportOwnerReceipt({ moduleExport: exported, exportRef: "evidence/M06-state-export.json", exportSha256: report.sha256(exported) });
  assert.equal(receipt.validation.ok, true);
  const restorePlan = report.buildReportRestorePlan({ moduleExport: exported, exportRef: "evidence/M06-state-export.json", checkpointId: "CP06" });
  assert.equal(restorePlan.cloneCreatesNewScenarioRunId, true);
  const evidenceIndex = report.buildReportEvidenceIndex({
    checkpointId: "CP06",
    checkpointNode: "agent-report-dashboard-completed",
    formedAt: "2026-08-24T08:10:00.000Z",
    files: [
      { ref: "evidence/M06-state-export.json", sha256: "a".repeat(64) },
      { ref: "evidence/M06-owner-receipt.json", sha256: "b".repeat(64) }
    ]
  });
  assert.equal(evidenceIndex.files.length, 2);
});

test("clone restore forms a new scenarioRunId and preserves frozen report/dashboard records without mutating source", () => {
  const state = runtimeState();
  const exported = report.buildReportModuleExport({
    scenarioContext: scenarioContext(),
    checkpointNode: "agent-report-dashboard-completed",
    runtimeState: state
  });
  const restored = report.cloneReportModuleState(exported, {
    now: "2026-08-24T08:20:00.000Z",
    runIdFactory: (scenarioId, details) => `${scenarioId}-RUN-${details.operation}-new`
  });
  assert.notEqual(restored.scenarioContext.scenarioRunId, exported.scenarioContext.scenarioRunId);
  assert.equal(restored.scenarioContext.scenarioRunId, "S002-RUN-report-clone-restore-new");
  assert.equal(restored.overwritesSource, false);
  assert.equal(restored.reports[0].reportId, state.reports[0].reportId);
  assert.equal(restored.dashboardVersions[0].contentSnapshotRef, state.dashboardVersions[0].contentSnapshotRef);
  assert.equal(state.reports[0].status, "draft");
  assert.equal(state.dashboardVersions[0].status, "published");
});

test("historical view remains read-only and keeps the original run id", () => {
  const exported = report.buildReportModuleExport({
    scenarioContext: scenarioContext(),
    checkpointNode: "agent-report-dashboard-completed",
    runtimeState: runtimeState()
  });
  const historical = report.historicalView(exported);
  assert.equal(historical.readOnly, true);
  assert.equal(historical.scenarioContext.scenarioRunId, exported.scenarioContext.scenarioRunId);
  assert.equal(historical.reports.length, 1);
});
