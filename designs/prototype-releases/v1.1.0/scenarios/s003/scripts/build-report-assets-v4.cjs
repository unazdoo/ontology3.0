#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const reportService = require("../domain/report-service-v3.js");
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

const FORMED_AT = "2026-08-16T21:10:00.000Z";
const PROTOTYPE_VERSION = "1.1.0";
const CONTENT_VERSION = "1.2.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v4";

const SOURCE_REFS = Object.freeze({
  ...v2Builder.SOURCE_REFS,
  reportAssurance: "resources/m06/report-assurance-profile.v2.json",
  previousManifest: "resources/m06/report-manifest.v3.json",
  previousContents: "resources/m06/report-contents.v3.json",
  previousArtifacts: "resources/m06/report-artifacts.v3.json"
});

const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v4.json",
  artifacts: "resources/m06/report-artifacts.v4.json",
  manifest: "resources/m06/report-manifest.v4.json",
  evidence: "evidence/CP18-report-content-v4-validation.md"
});

function riskEvidence(refs) {
  return Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, sourceEvidence(ref)]));
}

function validateReports(reports, artifacts) {
  if (reports.length !== 21 || artifacts.length !== 21) throw new Error("S003 正式报告必须完整覆盖 21 家企业");
  const forbidden = /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;
  for (const report of reports) {
    if (report.schemaVersion !== CONTENT_SCHEMA_VERSION) throw new Error(`报告 schemaVersion 不一致: ${report.reportId}`);
    if ((report.indicatorDetails || []).length !== 15) throw new Error(`报告财务指标不完整: ${report.reportId}`);
    if ((report.keyRiskDiagnosis?.indicatorItems || []).some((item) => /实际值为\s*未取得/.test(item.statement || ""))) {
      throw new Error(`报告关键诊断仍包含错误实际值占位: ${report.reportId}`);
    }
    if (report.assessment?.isUnderConstruction && !JSON.stringify(report.threeMonthActionPlan).includes("建设资金")) {
      throw new Error(`在建企业报告缺少建设资金专题: ${report.reportId}`);
    }
    if (["RED", "BLACK"].includes(report.assessment?.riskTier?.tierId) && !JSON.stringify(report.threeMonthActionPlan).includes("交叉违约")) {
      throw new Error(`高风险企业报告缺少流动性应急专题: ${report.reportId}`);
    }
  }
  for (const artifact of artifacts) {
    if (forbidden.test(artifact.html)) throw new Error(`正式下载产物包含内部枚举或对象字符串: ${artifact.reportId}`);
    if (!artifact.html.includes("关键风险诊断说明") || !artifact.html.includes("风险应对策略与改善建议") || !artifact.html.includes("未来三个月行动建议")) {
      throw new Error(`正式下载产物正文不完整: ${artifact.reportId}`);
    }
  }
}

function buildReportAssetsV4() {
  const c035Results = readJson(SOURCE_REFS.c035Results);
  const publishedFacts = readJson(SOURCE_REFS.publishedFacts);
  const publishedPointer = readJson(SOURCE_REFS.publishedPointer);
  const reportContract = readJson(SOURCE_REFS.reportContract);
  const reportDefinition = readJson(SOURCE_REFS.reportDefinition);
  const reportTemplate = readJson(SOURCE_REFS.reportTemplate);
  const reportAssurance = readJson(SOURCE_REFS.reportAssurance);
  const decisionResults = readJson(SOURCE_REFS.decisionResults);
  const evidence = riskEvidence(SOURCE_REFS);
  const service = reportService.createReportService({
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
    artifactVersion: "html-print-v4",
    hydrateActualValues: true
  });

  const reports = service.listReports();
  const contentEntries = reports.map((report) => ({
    reportId: report.reportId,
    contentVersion: report.contentVersion,
    contentSha256: sha256(serialize(report)),
    content: report
  }));
  const artifactEntries = reports.map((report, index) => {
    const html = service.renderHtml(report.enterprise.enterpriseId);
    return {
      artifactId: `${report.reportId}-HTML-V4`,
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
  validateReports(reports, artifactEntries);

  const contents = {
    schemaVersion: "ofw.s003.m06.report-content-set.v4",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260816-003",
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
    reportAssurance: { id: reportAssurance.profileId, version: reportAssurance.profileVersion, ref: SOURCE_REFS.reportAssurance },
    correction: {
      reason: "正式阅读页、内容资源与 HTML 下载产物统一中文化状态、结构化触发依据、专业诊断和分档化三个月行动建议。",
      previousVersionPreserved: true,
      sourceScenarioRunIdUnchanged: true
    },
    reportCount: contentEntries.length,
    reports: contentEntries
  };

  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v4",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260816-003",
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
  const transferredToTodoCount = reports.reduce((count, report) => count + report.disposition.candidates.filter((candidate) => candidate.status === "CONFIRMED_TO_OWNER_TODO").length, 0);
  const manifest = {
    schemaVersion: "ofw.s003.m06.report-manifest.v4",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    manifestId: "S003-M06-REPORT-MANIFEST-20260816-003",
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
    reportAssuranceProfileId: reportAssurance.profileId,
    reportAssuranceProfileVersion: reportAssurance.profileVersion,
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
      transferredToOwnerTodo: transferredToTodoCount,
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
      previousV1V2V3EvidenceUntouched: true,
      exactScenarioRunDeepLink: true,
      sourceFactsRemainUnmodified: true,
      reportGenerationCreatesNoDecisionSideEffects: true,
      localizedBusinessStatuses: true,
      structuredTriggerRendering: true,
      professionalDiagnosisAndPlans: true,
      dedicatedAgentRequired: false,
      dedicatedFirstLevelModuleCreated: false,
      clientSideScoreRecalculation: false,
      reportFormats: ["html", "print-to-pdf"]
    }
  };

  const manifestBytes = serialize(manifest);
  const evidenceBytes = Buffer.from([
    "# CP18 M06 正式报告 v4 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${c035Results.scenarioIdentity.scenarioRunId}`,
    `- 报告内容版本：${CONTENT_VERSION}`,
    `- 报告数量：${reports.length}`,
    "",
    "## 结论",
    "",
    "- v1—v3 正式报告内容、制品和清单保持原字节不变。",
    "- v4 统一报告中心阅读页与正式 HTML 下载产物，消除内部枚举、对象字符串和未格式化实际值。",
    "- 关键风险诊断包含实际值、得分、业务含义、建议核查和证据引用。",
    "- 红/黑灯、黄灯、绿灯和在建企业采用差异化管理建议；不新增评分规则或自动决策副作用。",
    "- 行动状态区分待提交、已提交、已转负责人待办和真实关闭，不再将待办理事项显示为已处理。",
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

function writeReportAssetsV4({ checkOnly = false } = {}) {
  const built = buildReportAssetsV4();
  for (const ref of Object.values(SOURCE_REFS)) writeOrVerifyAtRoot(packageRoot, ref, fs.readFileSync(resolveRef(ref)), checkOnly);
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV4({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({ SOURCE_REFS, OUTPUT_REFS, buildReportAssetsV4, writeReportAssetsV4, validateReports });
