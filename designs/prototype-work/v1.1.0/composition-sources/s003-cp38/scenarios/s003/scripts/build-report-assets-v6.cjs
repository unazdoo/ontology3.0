#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const reportService = require("../domain/report-service-v5.js");
const helpers = require("./build-report-assets-v2.cjs");

const {
  packageRoot,
  sha256,
  resolveRef,
  readJson,
  serialize,
  writeOrVerifyAtRoot
} = helpers;

const FORMED_AT = "2026-08-17T03:00:00.000Z";
const CONTENT_VERSION = "1.4.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v6";

const HISTORY_MANIFEST_REFS = Object.freeze([
  "resources/m06/report-manifest.v1.json",
  "resources/m06/report-manifest.v2.json",
  "resources/m06/report-manifest.v3.json",
  "resources/m06/report-manifest.v4.json",
  "resources/m06/report-manifest.v5.json"
]);

const SOURCE_REFS = Object.freeze({
  previousManifest: "resources/m06/report-manifest.v5.json",
  previousContents: "resources/m06/report-contents.v5.json",
  previousArtifacts: "resources/m06/report-artifacts.v5.json",
  reportAssurance: "resources/m06/report-assurance-profile.v3.json"
});

const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v6.json",
  artifacts: "resources/m06/report-artifacts.v6.json",
  manifest: "resources/m06/report-manifest.v6.json",
  history: "resources/m06/report-history-index.v1.json",
  evidence: "evidence/M06-report-content-v6-validation.md"
});

function validateReports(reports, artifacts, assurance) {
  if (reports.length !== 21 || artifacts.length !== 21) throw new Error("S003 正式报告 v6 必须完整覆盖 21 家企业");
  const checkIds = assurance.verificationChecks.map((item) => item.checkId);
  const forbidden = /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;
  for (const report of reports) {
    if (report.schemaVersion !== CONTENT_SCHEMA_VERSION) throw new Error(`报告 schemaVersion 不一致: ${report.reportId}`);
    if ((report.verificationResults || []).length !== checkIds.length) throw new Error(`形成时核验项不完整: ${report.reportId}`);
    if (report.verificationSummary?.derivedFromResults !== true || report.verificationSummary.passedCount !== checkIds.length) {
      throw new Error(`形成时核验汇总不是逐项结果推导或存在失败: ${report.reportId}`);
    }
    if (report.verificationResults.some((item, index) => item.checkId !== checkIds[index] || !item.passed || !item.evidence || !item.impact || !item.responsibility || !item.recommendation)) {
      throw new Error(`形成时核验缺少证据、影响、责任或建议: ${report.reportId}`);
    }
    if (report.artifactPolicy?.independentPdfArtifact !== false || report.artifactPolicy?.browserPrintToPdf !== true) {
      throw new Error(`报告未明确浏览器打印与独立 PDF 产物边界: ${report.reportId}`);
    }
  }
  for (const artifact of artifacts) {
    if (forbidden.test(artifact.html)) throw new Error(`正式下载产物包含内部枚举或对象字符串: ${artifact.reportId}`);
    if (artifact.formats.length !== 1 || artifact.formats[0] !== "html" || artifact.printCapability?.independentPdfArtifact !== false) {
      throw new Error(`正式产物错误声明独立 PDF: ${artifact.reportId}`);
    }
    if (!artifact.html.includes("报告形成时逐项核验") || !artifact.html.includes("浏览器打印")) {
      throw new Error(`正式 HTML 未包含逐项核验或打印边界: ${artifact.reportId}`);
    }
  }
  const escalation = reports.find((report) => report.enterprise.enterpriseId === "S003-ENT-009");
  if (!escalation?.managementEscalation?.triggered || escalation.managementEscalation.scoringTierUnchanged !== true) {
    throw new Error("S003-ENT-009 未固化重大因子管理升级与评分分档分离语义");
  }
  const escalationArtifact = artifacts.find((item) => item.reportId === escalation.reportId);
  if (!/重大因子管理升级/.test(escalation.conclusion) || !/重大因子管理升级/.test(escalationArtifact.html)) {
    throw new Error("S003-ENT-009 正式内容或下载产物未包含重大因子管理升级提示");
  }
}

function buildHistoryIndex(currentManifest) {
  const historical = HISTORY_MANIFEST_REFS.map((ref) => ({ ref, manifest: readJson(ref) }));
  const versions = [...historical, { ref: OUTPUT_REFS.manifest, manifest: currentManifest }].map(({ ref, manifest }, index, all) => ({
    sequence: index + 1,
    manifestId: manifest.manifestId,
    manifestVersion: manifest.manifestVersion,
    manifestRef: ref,
    formedAt: manifest.formedAt,
    reportCount: manifest.reportCount,
    status: index === all.length - 1 ? "current" : "superseded",
    supersedes: manifest.supersedes || null,
    supersededBy: index < all.length - 1 ? all[index + 1].ref : null,
    immutable: manifest.immutable === true
  }));
  return {
    schemaVersion: "ofw.s003.m06.report-history-index.v1",
    moduleId: "M06",
    moduleOwner: "报告中心",
    historyId: "S003-M06-REPORT-HISTORY-20260817-001",
    historyVersion: "1.0.0",
    lifecycleStatus: "published",
    formedAt: FORMED_AT,
    immutable: true,
    scenarioIdentity: currentManifest.scenarioIdentity,
    currentManifestRef: OUTPUT_REFS.manifest,
    versionCount: versions.length,
    versions,
    semantics: {
      viewHistoricalVersion: "只读展示该版本清单、内容和证据，不改写当前指针",
      replacement: "新内容版本通过 supersedes / supersededBy 建立替代链，不覆盖旧版本",
      withdrawal: "撤回只改变目录引用状态；历史内容与哈希仍保留。当前原型未对既有不可变资源执行撤回。"
    }
  };
}

function buildReportAssetsV6() {
  const previousManifest = readJson(SOURCE_REFS.previousManifest);
  const previousContents = readJson(SOURCE_REFS.previousContents);
  const previousArtifacts = readJson(SOURCE_REFS.previousArtifacts);
  const assurance = readJson(SOURCE_REFS.reportAssurance);
  const reports = previousContents.reports.map((entry) => reportService.upgradeReport(entry.content, {
    contentSchemaVersion: CONTENT_SCHEMA_VERSION,
    reportVersion: CONTENT_VERSION,
    contentVersion: CONTENT_VERSION,
    artifactVersion: "html-print-capability-v6",
    verificationChecks: assurance.verificationChecks,
    checkedAt: FORMED_AT
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
      artifactId: `${report.reportId}-HTML-V6`,
      reportId: report.reportId,
      enterpriseCategory: report.enterprise.category,
      artifactVersion: report.artifactVersion,
      formats: ["html"],
      mimeType: "text/html",
      printCapability: {
        enabled: true,
        mode: "browser-print-to-pdf",
        independentPdfArtifact: false,
        statement: "用户可从固定 HTML 使用浏览器打印或另存为 PDF；当前版本不声明独立 PDF 文件、URL 或哈希。"
      },
      contentVersion: report.contentVersion,
      contentSha256: contentEntries[index].contentSha256,
      artifactSha256: sha256(Buffer.from(html, "utf8")),
      deepLink: report.deepLink,
      html
    };
  });
  validateReports(reports, artifactEntries, assurance);

  const contents = {
    schemaVersion: "ofw.s003.m06.report-content-set.v6",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260817-005",
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
      reason: "固化逐项形成时核验证据、重大因子管理升级语义和 HTML/浏览器打印产物边界。",
      previousVersionPreserved: true,
      sourceScenarioRunIdUnchanged: true
    },
    reportCount: contentEntries.length,
    reports: contentEntries
  };

  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v6",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260817-005",
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
    schemaVersion: "ofw.s003.m06.report-manifest.v6",
    manifestId: "S003-M06-REPORT-MANIFEST-20260817-005",
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
      reportFormats: ["html"],
      browserPrintToPdfCapability: true,
      independentPdfArtifact: false,
      previousV1ThroughV5EvidenceUntouched: true,
      formationVerificationDerivedFromImmutableResults: true,
      majorFactorManagementSignalSeparatedFromScoreTier: true
    }
  };
  const manifestBytes = serialize(manifest);
  const history = buildHistoryIndex(manifest);
  const historyBytes = serialize(history);
  const evidenceBytes = Buffer.from([
    "# M06 正式报告 v6 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${previousContents.scenarioIdentity.scenarioRunId}`,
    `- 报告内容版本：${CONTENT_VERSION}`,
    `- 报告数量：${reports.length}`,
    "- Checkpoint 状态：本文件为 M06 模块证据，不代表 CP18 或任何平台 Checkpoint 已封存。",
    "",
    "## 结论",
    "",
    "- v1—v5 正式报告内容、制品和清单保持原字节不变。",
    "- 13 项形成时核验均保存逐项结果、证据、影响、责任和建议，汇总由结果数组推导。",
    "- 风电测试公司09保持绿灯评分事实，同时固化重大因子触发后的管理关注升级语义。",
    "- 正式产物为固定 HTML；打印/PDF 是浏览器能力，不再声明不存在的独立 PDF 文件或哈希。",
    "- 报告版本历史通过独立索引展示 supersedes / supersededBy 替代链，不覆盖历史版本。",
    "",
    "## 资源哈希",
    "",
    `- ${sha256(contentsBytes)}  ${OUTPUT_REFS.contents}`,
    `- ${sha256(artifactsBytes)}  ${OUTPUT_REFS.artifacts}`,
    `- ${sha256(manifestBytes)}  ${OUTPUT_REFS.manifest}`,
    `- ${sha256(historyBytes)}  ${OUTPUT_REFS.history}`,
    ""
  ].join("\n"), "utf8");

  return { reports, contents, artifacts, manifest, history, assets: new Map([
    [OUTPUT_REFS.contents, contentsBytes],
    [OUTPUT_REFS.artifacts, artifactsBytes],
    [OUTPUT_REFS.manifest, manifestBytes],
    [OUTPUT_REFS.history, historyBytes],
    [OUTPUT_REFS.evidence, evidenceBytes]
  ]) };
}

function writeReportAssetsV6({ checkOnly = false } = {}) {
  const built = buildReportAssetsV6();
  for (const ref of [...Object.values(SOURCE_REFS), ...HISTORY_MANIFEST_REFS]) {
    writeOrVerifyAtRoot(packageRoot, ref, fs.readFileSync(resolveRef(ref)), checkOnly);
  }
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV6({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({
  FORMED_AT,
  CONTENT_VERSION,
  CONTENT_SCHEMA_VERSION,
  HISTORY_MANIFEST_REFS,
  SOURCE_REFS,
  OUTPUT_REFS,
  buildReportAssetsV6,
  writeReportAssetsV6,
  validateReports
});
