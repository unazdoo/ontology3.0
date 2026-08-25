#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const reportService = require("../domain/report-service-v4.js");
const helpers = require("./build-report-assets-v2.cjs");

const {
  packageRoot,
  sha256,
  resolveRef,
  readJson,
  serialize,
  writeOrVerifyAtRoot
} = helpers;

const FORMED_AT = "2026-08-16T23:30:00.000Z";
const CONTENT_VERSION = "1.3.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v5";

const SOURCE_REFS = Object.freeze({
  previousManifest: "resources/m06/report-manifest.v4.json",
  previousContents: "resources/m06/report-contents.v4.json",
  previousArtifacts: "resources/m06/report-artifacts.v4.json",
  reportAssurance: "resources/m06/report-assurance-profile.v3.json"
});

const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v5.json",
  artifacts: "resources/m06/report-artifacts.v5.json",
  manifest: "resources/m06/report-manifest.v5.json",
  evidence: "evidence/CP18-report-content-v5-validation.md"
});

function validateReports(reports, artifacts) {
  if (reports.length !== 21 || artifacts.length !== 21) throw new Error("S003 正式报告 v5 必须完整覆盖 21 家企业");
  const forbidden = /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;
  for (const report of reports) {
    if (report.schemaVersion !== CONTENT_SCHEMA_VERSION) throw new Error(`报告 schemaVersion 不一致: ${report.reportId}`);
    if ((report.indicatorDetails || []).length !== 15) throw new Error(`报告指标口径不完整: ${report.reportId}`);
    if (!report.keyRiskDiagnosis || !report.responseStrategy || (report.threeMonthActionPlan || []).length !== 3) {
      throw new Error(`报告诊断、策略或三个月计划不完整: ${report.reportId}`);
    }
    if (report.assessment?.isUnderConstruction) {
      const text = JSON.stringify({
        conclusion: report.conclusion,
        diagnosis: report.keyRiskDiagnosis,
        strategy: report.responseStrategy,
        plan: report.threeMonthActionPlan
      });
      if (!text.includes("建设资金") || !text.includes("投产条件") || !text.includes("固定 60")) {
        throw new Error(`在建企业报告缺少建设资金、投产条件或固定 60 分语义: ${report.reportId}`);
      }
      if (/低分指标|最低指标/.test(text)) throw new Error(`在建企业报告错误引用低分指标: ${report.reportId}`);
      if ((report.keyRiskDiagnosis.indicatorItems || []).some((item) => item.type === "indicator")) {
        throw new Error(`在建企业报告不得形成财务指标得分诊断: ${report.reportId}`);
      }
    }
  }
  for (const artifact of artifacts) {
    if (forbidden.test(artifact.html)) throw new Error(`正式下载产物包含内部枚举或对象字符串: ${artifact.reportId}`);
    if (!artifact.html.includes("关键风险诊断说明") || !artifact.html.includes("风险应对策略与改善建议") || !artifact.html.includes("未来三个月行动建议")) {
      throw new Error(`正式下载产物正文不完整: ${artifact.reportId}`);
    }
    if (artifact.enterpriseCategory === "在建企业" && (!artifact.html.includes("财务指标口径清单") || artifact.html.includes("权重</th><th>加权得分"))) {
      throw new Error(`在建企业下载报告仍展示虚假权重汇总: ${artifact.reportId}`);
    }
  }
}

function buildReportAssetsV5() {
  const previousManifest = readJson(SOURCE_REFS.previousManifest);
  const previousContents = readJson(SOURCE_REFS.previousContents);
  const previousArtifacts = readJson(SOURCE_REFS.previousArtifacts);
  const assurance = readJson(SOURCE_REFS.reportAssurance);
  const reports = previousContents.reports.map((entry) => reportService.upgradeReport(entry.content, {
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    reportVersion: CONTENT_VERSION,
    contentVersion: CONTENT_VERSION,
    artifactVersion: "html-print-v5"
  }));
  const contentEntries = reports.map((report) => ({
    reportId: report.reportId,
    contentVersion: report.contentVersion,
    contentSha256: sha256(serialize(report)),
    content: report
  }));
  const artifactEntries = reports.map((report, index) => {
    const html = reportService.renderReportHtml(report, CONTENT_SCHEMA_VERSION);
    return {
      artifactId: `${report.reportId}-HTML-V5`,
      reportId: report.reportId,
      enterpriseCategory: report.enterprise.category,
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
    schemaVersion: "ofw.s003.m06.report-content-set.v5",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260816-004",
    contentSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousContents,
    status: "published-report-contents",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: previousContents.scenarioIdentity,
    prototypeVersion: previousContents.prototypeVersion,
    assessmentAt: previousContents.assessmentAt,
    reportDefinition: previousContents.reportDefinition,
    reportTemplate: previousContents.reportTemplate,
    reportAssurance: { id: assurance.profileId, version: assurance.profileVersion, ref: SOURCE_REFS.reportAssurance },
    correction: {
      reason: "修正在建企业正式报告的诊断与展示语义，并强化决策证据非空集校验合同。",
      previousVersionPreserved: true,
      sourceScenarioRunIdUnchanged: true
    },
    reportCount: contentEntries.length,
    reports: contentEntries
  };

  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v5",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260816-004",
    artifactSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousArtifacts,
    status: "published-report-artifacts",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: previousContents.scenarioIdentity,
    prototypeVersion: previousContents.prototypeVersion,
    sameIdentityAcrossFormats: true,
    artifactCount: artifactEntries.length,
    artifacts: artifactEntries
  };

  const contentsBytes = serialize(contents);
  const artifactsBytes = serialize(artifacts);
  const manifest = {
    ...previousManifest,
    schemaVersion: "ofw.s003.m06.report-manifest.v5",
    manifestId: "S003-M06-REPORT-MANIFEST-20260816-004",
    manifestVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousManifest,
    formedAt: FORMED_AT,
    reportAssuranceProfileId: assurance.profileId,
    reportAssuranceProfileVersion: assurance.profileVersion,
    collections: {
      contents: { contentSetId: contents.contentSetId, contentSetVersion: contents.contentSetVersion, ref: OUTPUT_REFS.contents, sha256: sha256(contentsBytes) },
      artifacts: { artifactSetId: artifacts.artifactSetId, artifactSetVersion: artifacts.artifactSetVersion, ref: OUTPUT_REFS.artifacts, sha256: sha256(artifactsBytes) }
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
      ...(previousManifest.invariants || {}),
      previousV1V2V3V4EvidenceUntouched: true,
      constructionReportsUseNoLowIndicatorDiagnosis: true,
      constructionIndicatorTableHasNoSyntheticWeightTotal: true,
      nonVacuousDecisionEvidenceRequired: true
    }
  };
  const manifestBytes = serialize(manifest);
  const evidenceBytes = Buffer.from([
    "# CP18 M06 正式报告 v5 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${previousContents.scenarioIdentity.scenarioRunId}`,
    `- 报告内容版本：${CONTENT_VERSION}`,
    `- 报告数量：${reports.length}`,
    "",
    "## 结论",
    "",
    "- v1—v4 正式报告内容、制品和清单保持原字节不变。",
    "- 在建企业不再使用低分指标诊断，改为建设资金、工程进度、投产条件、融资保障和运营资金语义。",
    "- 在建企业正式下载报告不再展示虚假的权重合计或最低指标排序。",
    "- 报告核验合同要求预期 C011/C019 记录实际存在并与候选精确对应。",
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

function writeReportAssetsV5({ checkOnly = false } = {}) {
  const built = buildReportAssetsV5();
  for (const ref of Object.values(SOURCE_REFS)) writeOrVerifyAtRoot(packageRoot, ref, fs.readFileSync(resolveRef(ref)), checkOnly);
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV5({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({ SOURCE_REFS, OUTPUT_REFS, buildReportAssetsV5, writeReportAssetsV5, validateReports });
