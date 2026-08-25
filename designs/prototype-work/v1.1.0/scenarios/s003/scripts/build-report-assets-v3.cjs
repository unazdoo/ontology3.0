#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const reportService = require("../domain/report-service-v2.js");
const v2Builder = require("./build-report-assets-v2.cjs");

const {
  packageRoot,
  sha256,
  resolveRef,
  readJson,
  serialize,
  sourceEvidence,
  riskTierCounts,
  writeOrVerifyAtRoot
} = v2Builder;

const FORMED_AT = "2026-08-16T19:30:00.000Z";
const PROTOTYPE_VERSION = "1.1.0";
const CONTENT_VERSION = "1.1.1";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v3";

const SOURCE_REFS = Object.freeze({
  ...v2Builder.SOURCE_REFS,
  previousManifest: "resources/m06/report-manifest.v2.json",
  previousContents: "resources/m06/report-contents.v2.json",
  previousArtifacts: "resources/m06/report-artifacts.v2.json"
});

const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v3.json",
  artifacts: "resources/m06/report-artifacts.v3.json",
  manifest: "resources/m06/report-manifest.v3.json",
  evidence: "evidence/CP15-report-content-v3-validation.md"
});

function riskEvidence(refs) {
  return Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, sourceEvidence(ref)]));
}

function validateDiagnosisActualValues(reports) {
  for (const report of reports) {
    const details = new Map(report.indicatorDetails.map((item) => [item.name, item]));
    for (const diagnosis of report.keyRiskDiagnosis.indicatorItems) {
      const detail = details.get(diagnosis.title);
      if (!detail || detail.actualValue === null || detail.actualValue === undefined) {
        throw new Error(`正式报告诊断缺少指标实际值: ${report.enterprise.enterpriseId} / ${diagnosis.title}`);
      }
      if (/实际值为\s*未取得/.test(diagnosis.statement)) {
        throw new Error(`正式报告诊断仍包含错误占位: ${report.enterprise.enterpriseId} / ${diagnosis.title}`);
      }
      if (!diagnosis.statement.includes(`实际值为 ${String(detail.actualValue)}`)) {
        throw new Error(`正式报告诊断与指标明细不一致: ${report.enterprise.enterpriseId} / ${diagnosis.title}`);
      }
    }
  }
}

function buildReportAssetsV3() {
  const c035Results = readJson(SOURCE_REFS.c035Results);
  const publishedFacts = readJson(SOURCE_REFS.publishedFacts);
  const publishedPointer = readJson(SOURCE_REFS.publishedPointer);
  const reportContract = readJson(SOURCE_REFS.reportContract);
  const reportDefinition = readJson(SOURCE_REFS.reportDefinition);
  const reportTemplate = readJson(SOURCE_REFS.reportTemplate);
  const decisionResults = readJson(SOURCE_REFS.decisionResults);
  const evidence = riskEvidence(SOURCE_REFS);
  const service = reportService.createReportService({
    legacyReportSemantics: true,
    scenarioContext: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    generatedAt: FORMED_AT,
    c035Results,
    publishedFacts,
    publishedPointer,
    reportContract,
    decisionResults,
    sourceEvidence: {
      c035Results: evidence.c035Results,
      publishedFacts: evidence.publishedFacts,
      publishedPointer: evidence.publishedPointer,
      reportContract: evidence.reportContract,
      decisionResults: evidence.decisionResults
    }
  }, {
    serviceVersion: CONTENT_VERSION,
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    reportVersion: CONTENT_VERSION,
    contentVersion: CONTENT_VERSION,
    artifactVersion: "html-print-v3",
    hydrateActualValues: true
  });

  const reports = service.listReports();
  validateDiagnosisActualValues(reports);
  const contentEntries = reports.map((report) => ({
    reportId: report.reportId,
    contentVersion: report.contentVersion,
    contentSha256: sha256(serialize(report)),
    content: report
  }));
  const artifactEntries = reports.map((report, index) => {
    const html = service.renderHtml(report.enterprise.enterpriseId);
    if (/实际值为\s*未取得/.test(html)) throw new Error(`下载报告包含错误占位: ${report.enterprise.enterpriseId}`);
    return {
      artifactId: `${report.reportId}-HTML-V3`,
      reportId: report.reportId,
      artifactVersion: report.artifactVersion,
      formats: ["html", "print-to-pdf"],
      mimeType: "text/html",
      contentVersion: report.contentVersion,
      contentSha256: contentEntries[index].contentSha256,
      artifactSha256: sha256(Buffer.from(html, "utf8")),
      deepLink: report.deepLink,
      html
    };
  });

  const contents = {
    schemaVersion: "ofw.s003.m06.report-content-set.v3",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260816-002",
    contentSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousContents,
    status: "published-report-contents",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    assessmentAt: c035Results.assessmentAt,
    reportDefinition: { id: reportDefinition.definitionId, version: reportDefinition.definitionVersion, ref: SOURCE_REFS.reportDefinition },
    reportTemplate: { id: reportTemplate.templateId, version: reportTemplate.templateVersion, ref: SOURCE_REFS.reportTemplate },
    correction: {
      reason: "关键风险诊断应复用同名财务指标明细的 actualValue，不得读取缺失字段形成错误占位。",
      previousVersionPreserved: true,
      sourceScenarioRunIdUnchanged: true
    },
    reportCount: contentEntries.length,
    reports: contentEntries
  };

  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v3",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260816-002",
    artifactSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousArtifacts,
    status: "published-report-artifacts",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    sameIdentityAcrossFormats: true,
    artifactCount: artifactEntries.length,
    artifacts: artifactEntries
  };

  const contentsBytes = serialize(contents);
  const artifactsBytes = serialize(artifacts);
  const confirmedCount = reports.reduce((count, report) => count + report.disposition.candidates.filter((candidate) => candidate.status === "CONFIRMED_TO_OWNER_TODO").length, 0);
  const manifest = {
    schemaVersion: "ofw.s003.m06.report-manifest.v3",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    manifestId: "S003-M06-REPORT-MANIFEST-20260816-002",
    manifestVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousManifest,
    status: "formal-reports-generated",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    assessmentAt: c035Results.assessmentAt,
    reportDefinitionId: reportDefinition.definitionId,
    reportDefinitionVersion: reportDefinition.definitionVersion,
    reportTemplateId: reportTemplate.templateId,
    reportTemplateVersion: reportTemplate.templateVersion,
    modelIdentity: {
      packageId: publishedPointer.activeTarget.packageId,
      packageVersion: publishedPointer.activeTarget.packageVersion,
      publishedVersion: publishedPointer.activeTarget.packageVersion,
      lifecycleStatus: publishedPointer.activeTarget.lifecycleStatus
    },
    source: evidence,
    collections: {
      contents: { contentSetId: contents.contentSetId, contentSetVersion: contents.contentSetVersion, ref: OUTPUT_REFS.contents, sha256: sha256(contentsBytes) },
      artifacts: { artifactSetId: artifacts.artifactSetId, artifactSetVersion: artifacts.artifactSetVersion, ref: OUTPUT_REFS.artifacts, sha256: sha256(artifactsBytes) }
    },
    reportCount: reports.length,
    summary: {
      riskTierCounts: riskTierCounts(reports),
      reportsWithDispositionCandidate: reports.filter((report) => report.disposition.candidateCount > 0).length,
      confirmedToOwnerTodo: confirmedCount,
      actionRequestsCreatedByReportGeneration: 0,
      todosCreatedByReportGeneration: 0,
      notificationsDispatchedByReportGeneration: 0
    },
    reports: reports.map((report, index) => ({
      reportId: report.reportId,
      reportVersion: report.reportVersion,
      contentVersion: report.contentVersion,
      contentSha256: contentEntries[index].contentSha256,
      artifactId: artifactEntries[index].artifactId,
      artifactVersion: artifactEntries[index].artifactVersion,
      artifactSha256: artifactEntries[index].artifactSha256,
      enterpriseId: report.enterprise.enterpriseId,
      enterpriseName: report.enterprise.name,
      finalScore: report.assessment.finalScore,
      riskTierId: report.assessment.riskTier.tierId,
      scenarioIdentity: report.scenarioIdentity,
      prototypeVersion: report.deliveryIdentity.prototypeVersion,
      deepLink: report.deepLink
    })),
    invariants: {
      previousV1AndV2EvidenceUntouched: true,
      diagnosisActualValueMatchesIndicatorDetails: true,
      exactScenarioRunDeepLink: true,
      sourceFactsRemainUnmodified: true,
      reportGenerationCreatesNoDecisionSideEffects: true,
      dedicatedAgentRequired: false,
      dedicatedFirstLevelModuleCreated: false,
      clientSideScoreRecalculation: false,
      reportFormats: ["html", "print-to-pdf"]
    }
  };

  const manifestBytes = serialize(manifest);
  const evidenceBytes = Buffer.from([
    "# CP15 M06 正式报告 v3 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${c035Results.scenarioIdentity.scenarioRunId}`,
    `- 报告内容版本：${CONTENT_VERSION}`,
    `- 报告数量：${reports.length}`,
    "",
    "## 结论",
    "",
    "- v1、v2 正式报告内容、制品和清单保持原字节不变。",
    "- v3 仅修正关键风险诊断的实际值映射：同名指标必须复用 indicatorDetails.actualValue。",
    "- 21 份正文与 HTML 下载制品均不再出现错误的‘实际值为未取得’占位。",
    "- scenarioRunId、评分、风险分档、模型、数据和行动状态均未改写。",
    "- 报告生成不创建 Action Request、通知、审批或负责人待办。",
    "",
    "## 资源哈希",
    "",
    `- ${sha256(contentsBytes)}  ${OUTPUT_REFS.contents}`,
    `- ${sha256(artifactsBytes)}  ${OUTPUT_REFS.artifacts}`,
    `- ${sha256(manifestBytes)}  ${OUTPUT_REFS.manifest}`,
    ""
  ].join("\n"), "utf8");

  return { reports, contents, artifacts, manifest, assets: new Map([
    [OUTPUT_REFS.contents, contentsBytes],
    [OUTPUT_REFS.artifacts, artifactsBytes],
    [OUTPUT_REFS.manifest, manifestBytes],
    [OUTPUT_REFS.evidence, evidenceBytes]
  ]) };
}

function writeReportAssetsV3({ checkOnly = false } = {}) {
  const built = buildReportAssetsV3();
  for (const ref of Object.values(SOURCE_REFS)) {
    writeOrVerifyAtRoot(packageRoot, ref, fs.readFileSync(resolveRef(ref)), checkOnly);
  }
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV3({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({
  SOURCE_REFS,
  OUTPUT_REFS,
  buildReportAssetsV3,
  writeReportAssetsV3,
  validateDiagnosisActualValues
});
