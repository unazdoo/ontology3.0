#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const reportService = require("../domain/report-service-v6.js");
const helpers = require("./build-report-assets-v2.cjs");

const { packageRoot, sha256, resolveRef, readJson, serialize, writeOrVerifyAtRoot } = helpers;
const FORMED_AT = "2026-08-17T18:30:00.000Z";
const CONTENT_VERSION = "1.5.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v7";
const SOURCE_REFS = Object.freeze({
  previousManifest: "resources/m06/report-manifest.v6.json",
  previousContents: "resources/m06/report-contents.v6.json",
  previousArtifacts: "resources/m06/report-artifacts.v6.json",
  previousHistory: "resources/m06/report-history-index.v1.json",
  reportAssurance: "resources/m06/report-assurance-profile.v3.json"
});
const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v7.json",
  artifacts: "resources/m06/report-artifacts.v7.json",
  manifest: "resources/m06/report-manifest.v7.json",
  history: "resources/m06/report-history-index.v2.json",
  evidence: "evidence/M06-report-content-v7-validation.md"
});

function riskTierCounts(reports) {
  return reports.reduce((counts, report) => {
    const tierId = report.assessment?.riskTier?.tierId || "UNKNOWN";
    counts[tierId] = (counts[tierId] || 0) + 1;
    return counts;
  }, { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 });
}

function buildHistory(previousHistory, currentManifest) {
  const versions = previousHistory.versions.map((item) => ({ ...item, status: "superseded", supersededBy: item.sequence === previousHistory.versionCount ? OUTPUT_REFS.manifest : item.supersededBy }));
  const next = {
    sequence: versions.length + 1,
    manifestId: currentManifest.manifestId,
    manifestVersion: currentManifest.manifestVersion,
    manifestRef: OUTPUT_REFS.manifest,
    formedAt: currentManifest.formedAt,
    reportCount: currentManifest.reportCount,
    status: "current",
    supersedes: SOURCE_REFS.previousManifest,
    supersededBy: null,
    immutable: true
  };
  if (versions.length) versions[versions.length - 1].supersededBy = OUTPUT_REFS.manifest;
  return {
    ...previousHistory,
    schemaVersion: "ofw.s003.m06.report-history-index.v2",
    historyId: "S003-M06-REPORT-HISTORY-20260817-002",
    historyVersion: "1.1.0",
    formedAt: FORMED_AT,
    currentManifestRef: OUTPUT_REFS.manifest,
    versionCount: versions.length + 1,
    versions: [...versions, next],
    semantics: {
      ...(previousHistory.semantics || {}),
      viewHistoricalVersion: "只读展示该版本清单、内容和证据，不改写当前指针",
      replacement: "新内容版本通过 supersedes / supersededBy 建立替代链，不覆盖旧版本",
      withdrawal: "撤回只改变目录引用状态；历史内容与哈希仍保留。"
    }
  };
}

function buildReportAssetsV7() {
  const previousManifest = readJson(SOURCE_REFS.previousManifest);
  const previousContents = readJson(SOURCE_REFS.previousContents);
  const previousArtifacts = readJson(SOURCE_REFS.previousArtifacts);
  const previousHistory = readJson(SOURCE_REFS.previousHistory);
  const assurance = readJson(SOURCE_REFS.reportAssurance);
  const reports = previousContents.reports.map((entry) => reportService.upgradeReport(entry.content, {
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    reportVersion: CONTENT_VERSION,
    contentVersion: CONTENT_VERSION,
    artifactVersion: "html-print-capability-v7",
    legacyV7: true,
    verificationChecks: assurance.verificationChecks,
    checkedAt: FORMED_AT
  }));
  if (reports.length !== 21) throw new Error(`S003 正式报告 v7 必须完整覆盖 21 家企业，实际 ${reports.length}`);
  const contentEntries = reports.map((report) => ({ reportId: report.reportId, contentVersion: report.contentVersion, contentSha256: sha256(serialize(report)), content: report }));
  const artifactEntries = reports.map((report, index) => {
    const html = reportService.renderReportHtml(report, CONTENT_SCHEMA_VERSION);
    if (/评分分档与重大因子管理信号分开判断|\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO)\b/.test(html)) throw new Error(`报告 HTML 仍含不可读技术文案: ${report.reportId}`);
    return {
      artifactId: `${report.reportId}-HTML-V7`,
      reportId: report.reportId,
      enterpriseCategory: report.enterprise.category,
      artifactVersion: report.artifactVersion,
      formats: ["html"],
      mimeType: "text/html",
      printCapability: { enabled: true, mode: "browser-print-to-pdf", independentPdfArtifact: false, statement: "用户可从固定 HTML 使用浏览器打印或另存为 PDF；当前版本不声明独立 PDF 文件、URL 或哈希。" },
      contentVersion: report.contentVersion,
      contentSha256: contentEntries[index].contentSha256,
      artifactSha256: sha256(Buffer.from(html, "utf8")),
      deepLink: report.deepLink,
      html
    };
  });
  const contents = {
    schemaVersion: "ofw.s003.m06.report-content-set.v7",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260817-006",
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
    reportAssurance: previousContents.reportAssurance,
    correction: { reason: "提升 21 家企业正式报告的风险画像、关键风险诊断和管理建议可读性，保持评分事实与 scenarioRunId 不变。", previousVersionPreserved: true, sourceScenarioRunIdUnchanged: true },
    reportCount: contentEntries.length,
    reports: contentEntries
  };
  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v7",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260817-006",
    artifactSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousArtifacts,
    status: "published-report-artifacts",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: previousContents.scenarioIdentity,
    prototypeVersion: previousContents.prototypeVersion,
    primaryFormat: "html",
    browserPrintToPdf: true,
    independentPdfArtifact: false,
    artifactCount: artifactEntries.length,
    artifacts: artifactEntries
  };
  const contentsBytes = serialize(contents);
  const artifactsBytes = serialize(artifacts);
  const manifest = {
    ...previousManifest,
    schemaVersion: "ofw.s003.m06.report-manifest.v7",
    manifestId: "S003-M06-REPORT-MANIFEST-20260817-006",
    manifestVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousManifest,
    formedAt: FORMED_AT,
    collections: {
      contents: { contentSetId: contents.contentSetId, contentSetVersion: contents.contentSetVersion, ref: OUTPUT_REFS.contents, sha256: sha256(contentsBytes) },
      artifacts: { artifactSetId: artifacts.artifactSetId, artifactSetVersion: artifacts.artifactSetVersion, ref: OUTPUT_REFS.artifacts, sha256: sha256(artifactsBytes) }
    },
    reportCount: reports.length,
    summary: { ...previousManifest.summary, riskTierCounts: riskTierCounts(reports) },
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
    }))
  };
  const history = buildHistory(previousHistory, manifest);
  const manifestBytes = serialize(manifest);
  const historyBytes = serialize(history);
  const evidenceBytes = Buffer.from([
    "# M06 正式报告 v7 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${previousContents.scenarioIdentity.scenarioRunId}`,
    `- 报告内容版本：${CONTENT_VERSION}`,
    `- 报告数量：${reports.length}`,
    "",
    "## 结论",
    "",
    "- v1—v6 正式报告内容、制品、清单及历史证据保持不可变。",
    "- v7 只重写业务叙事、潜在风险画像、关键诊断和管理建议，不改写评分、风险分档、因子系数、行动状态或运行身份。",
    "- 正式 HTML、报告中心阅读器和浏览器打印继续使用同一内容版本。",
    "- 产业/薄弱项下钻只读消费同一轮评分和报告，不补造企业或指标数据。",
    "",
    "## 资源哈希",
    "",
    `- ${sha256(contentsBytes)}  ${OUTPUT_REFS.contents}`,
    `- ${sha256(artifactsBytes)}  ${OUTPUT_REFS.artifacts}`,
    `- ${sha256(manifestBytes)}  ${OUTPUT_REFS.manifest}`,
    `- ${sha256(historyBytes)}  ${OUTPUT_REFS.history}`,
    ""
  ].join("\n"), "utf8");
  return { reports, contents, artifacts, manifest, history, assets: new Map([[OUTPUT_REFS.contents, contentsBytes], [OUTPUT_REFS.artifacts, artifactsBytes], [OUTPUT_REFS.manifest, manifestBytes], [OUTPUT_REFS.history, historyBytes], [OUTPUT_REFS.evidence, evidenceBytes]]) };
}

function writeReportAssetsV7({ checkOnly = false } = {}) {
  const built = buildReportAssetsV7();
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV7({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({ FORMED_AT, CONTENT_VERSION, CONTENT_SCHEMA_VERSION, SOURCE_REFS, OUTPUT_REFS, buildReportAssetsV7, writeReportAssetsV7 });
