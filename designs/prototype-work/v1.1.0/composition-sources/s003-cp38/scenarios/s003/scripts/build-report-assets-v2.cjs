#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const reportService = require("../domain/report-service-v2.js");

const packageRoot = path.resolve(__dirname, "..");
const FORMED_AT = "2026-08-16T16:00:00.000Z";
const PROTOTYPE_VERSION = "1.1.0";
const SOURCE_REFS = Object.freeze({
  c035Results: "resources/m01/c035-risk-results.v1.json",
  publishedFacts: "resources/m01/published-risk-facts.v1.json",
  publishedPointer: "resources/m01/published-pointer.v1.json",
  reportContract: "resources/m06/report-contract.v2.json",
  reportDefinition: "resources/m06/report-definition.v2.json",
  reportTemplate: "resources/m06/report-template.v2.json",
  decisionResults: "resources/m04/decision-results.v1.json"
});
const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v2.json",
  artifacts: "resources/m06/report-artifacts.v2.json",
  manifest: "resources/m06/report-manifest.v2.json",
  evidence: "evidence/CP15-report-content-v2-validation.md"
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resolveRefAtRoot(root, ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..") || path.isAbsolute(ref)) throw new Error(`非法包内引用: ${String(ref)}`);
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, ref);
  if (!absolute.startsWith(`${absoluteRoot}${path.sep}`)) throw new Error(`引用越出资源根目录: ${ref}`);
  return absolute;
}

function resolveRef(ref) {
  return resolveRefAtRoot(packageRoot, ref);
}

function readJson(ref) {
  const target = resolveRef(ref);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new Error(`缺少报告来源资源: ${ref}`);
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function serialize(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sidecarBytes(ref, digest) {
  return Buffer.from(`${digest}  ${path.basename(ref)}\n`, "utf8");
}

function writeOrVerifyAtRoot(root, ref, bytes, checkOnly) {
  const target = resolveRefAtRoot(root, ref);
  const digest = sha256(bytes);
  if (fs.existsSync(target)) {
    if (!fs.readFileSync(target).equals(bytes)) throw new Error(`不可变资源内容不一致，拒绝覆盖: ${ref}`);
  } else if (checkOnly) {
    throw new Error(`缺少不可变资源: ${ref}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: "wx" });
  }
  const sidecarRef = `${ref}.sha256`;
  const sidecarTarget = resolveRefAtRoot(root, sidecarRef);
  const expected = sidecarBytes(ref, digest);
  if (fs.existsSync(sidecarTarget)) {
    if (!fs.readFileSync(sidecarTarget).equals(expected)) throw new Error(`SHA sidecar 内容不一致，拒绝覆盖: ${sidecarRef}`);
  } else if (checkOnly) {
    throw new Error(`缺少 SHA sidecar: ${sidecarRef}`);
  } else {
    fs.mkdirSync(path.dirname(sidecarTarget), { recursive: true });
    fs.writeFileSync(sidecarTarget, expected, { flag: "wx" });
  }
  return digest;
}

function sourceEvidence(ref) {
  return { ref, sha256: sha256(fs.readFileSync(resolveRef(ref))) };
}

function riskTierCounts(reports) {
  return reports.reduce((counts, report) => {
    const tierId = report.assessment.riskTier.tierId;
    counts[tierId] = (counts[tierId] || 0) + 1;
    return counts;
  }, { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 });
}

function buildReportAssetsV2() {
  const c035Results = readJson(SOURCE_REFS.c035Results);
  const publishedFacts = readJson(SOURCE_REFS.publishedFacts);
  const publishedPointer = readJson(SOURCE_REFS.publishedPointer);
  const reportContract = readJson(SOURCE_REFS.reportContract);
  const reportDefinition = readJson(SOURCE_REFS.reportDefinition);
  const reportTemplate = readJson(SOURCE_REFS.reportTemplate);
  const decisionResults = readJson(SOURCE_REFS.decisionResults);
  const evidence = Object.fromEntries(Object.entries(SOURCE_REFS).map(([key, ref]) => [key, sourceEvidence(ref)]));
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
      artifactId: `${report.reportId}-HTML-V2`,
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
    schemaVersion: "ofw.s003.m06.report-content-set.v2",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260816-001",
    contentSetVersion: "1.1.0",
    supersedes: "resources/m06/report-contents.v1.json",
    status: "published-report-contents",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    assessmentAt: c035Results.assessmentAt,
    reportDefinition: { id: reportDefinition.definitionId, version: reportDefinition.definitionVersion, ref: SOURCE_REFS.reportDefinition },
    reportTemplate: { id: reportTemplate.templateId, version: reportTemplate.templateVersion, ref: SOURCE_REFS.reportTemplate },
    reportCount: contentEntries.length,
    reports: contentEntries
  };
  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v2",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260816-001",
    artifactSetVersion: "1.1.0",
    supersedes: "resources/m06/report-artifacts.v1.json",
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
    schemaVersion: "ofw.s003.m06.report-manifest.v2",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    manifestId: "S003-M06-REPORT-MANIFEST-20260816-001",
    manifestVersion: "1.1.0",
    supersedes: "resources/m06/report-manifest.v1.json",
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
      previousV1EvidenceUntouched: true,
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
    "# CP15 M06 正式报告 v2 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${c035Results.scenarioIdentity.scenarioRunId}`,
    `- 报告定义 / 模板：${reportDefinition.definitionVersion} / ${reportTemplate.templateVersion}`,
    `- 报告数量：${reports.length}`,
    "",
    "## 结论",
    "",
    "- v1 正式报告内容、制品、清单及 CP14 引用保持原字节不变。",
    "- v2 为同一正式评分运行的新报告内容版本，补齐 9 章正式正文、关键风险诊断、改善建议和未来三个月行动建议。",
    "- HTML 下载制品与报告中心阅读器使用同一章节合同，并持续绑定原 scenarioRunId、企业、模型、数据和证据。",
    "- 管理建议不新增评分规则，不自动创建 Action Request、审批、通知或负责人待办。",
    "- 报告伴读与核验继续沿用平台通用能力，不建设 S003 专属 Agent。",
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

function writeReportAssetsV2({ checkOnly = false } = {}) {
  const built = buildReportAssetsV2();
  for (const ref of [SOURCE_REFS.reportContract, SOURCE_REFS.reportDefinition, SOURCE_REFS.reportTemplate]) {
    writeOrVerifyAtRoot(packageRoot, ref, fs.readFileSync(resolveRef(ref)), checkOnly);
  }
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV2({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({
  packageRoot,
  sha256,
  resolveRef,
  readJson,
  serialize,
  sourceEvidence,
  riskTierCounts,
  SOURCE_REFS,
  OUTPUT_REFS,
  buildReportAssetsV2,
  writeReportAssetsV2,
  writeOrVerifyAtRoot
});
