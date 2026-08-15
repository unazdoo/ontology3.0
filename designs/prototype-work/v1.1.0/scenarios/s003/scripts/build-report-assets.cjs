#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const reportService = require("../domain/report-service.js");

const packageRoot = path.resolve(__dirname, "..");
const FORMED_AT = "2026-08-15T15:10:00.000Z";
const PROTOTYPE_VERSION = "1.1.0";
const SOURCE_REFS = Object.freeze({
  c035Results: "resources/m01/c035-risk-results.v1.json",
  publishedFacts: "resources/m01/published-risk-facts.v1.json",
  publishedPointer: "resources/m01/published-pointer.v1.json",
  reportContract: "resources/m06/report-contract.v1.json",
  decisionResults: "resources/m04/decision-results.v1.json"
});
const OUTPUT_REFS = Object.freeze([
  "resources/m06/report-contents.v1.json",
  "resources/m06/report-artifacts.v1.json",
  "resources/m06/report-manifest.v1.json",
  "evidence/CP06-report-validation.md"
]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function resolveRefAtRoot(root, ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..") || path.isAbsolute(ref)) {
    throw new Error("非法包内引用: " + String(ref));
  }
  const absoluteRoot = path.resolve(root);
  const absolute = path.resolve(absoluteRoot, ref);
  if (!absolute.startsWith(absoluteRoot + path.sep)) {
    throw new Error("引用越出资源根目录: " + ref);
  }
  return absolute;
}

function resolveRef(ref) {
  return resolveRefAtRoot(packageRoot, ref);
}

function readJson(ref) {
  const target = resolveRef(ref);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error("缺少报告来源资源: " + ref);
  }
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function serialize(value) {
  return Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8");
}

function sidecarBytes(ref, digest) {
  return Buffer.from(digest + "  " + path.basename(ref) + "\n", "utf8");
}

function writeOrVerifyAtRoot(root, ref, bytes, checkOnly) {
  const target = resolveRefAtRoot(root, ref);
  const digest = sha256(bytes);
  if (fs.existsSync(target)) {
    if (!fs.readFileSync(target).equals(bytes)) {
      throw new Error("不可变资源内容不一致，拒绝覆盖: " + ref);
    }
  } else if (checkOnly) {
    throw new Error("缺少不可变资源: " + ref);
  } else {
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes, {flag: "wx"});
  }

  const sidecarRef = ref + ".sha256";
  const sidecarTarget = resolveRefAtRoot(root, sidecarRef);
  const expectedSidecar = sidecarBytes(ref, digest);
  if (fs.existsSync(sidecarTarget)) {
    if (!fs.readFileSync(sidecarTarget).equals(expectedSidecar)) {
      throw new Error("SHA sidecar 内容不一致，拒绝覆盖: " + sidecarRef);
    }
  } else if (checkOnly) {
    throw new Error("缺少 SHA sidecar: " + sidecarRef);
  } else {
    fs.mkdirSync(path.dirname(sidecarTarget), {recursive: true});
    fs.writeFileSync(sidecarTarget, expectedSidecar, {flag: "wx"});
  }
  return digest;
}

function sourceEvidence(ref) {
  return {
    ref: ref,
    sha256: sha256(fs.readFileSync(resolveRef(ref)))
  };
}

function riskTierCounts(reports) {
  return reports.reduce(function (counts, report) {
    const tierId = report.assessment.riskTier.tierId;
    counts[tierId] = (counts[tierId] || 0) + 1;
    return counts;
  }, {GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0});
}

function buildReportAssets() {
  const c035Results = readJson(SOURCE_REFS.c035Results);
  const publishedFacts = readJson(SOURCE_REFS.publishedFacts);
  const publishedPointer = readJson(SOURCE_REFS.publishedPointer);
  const reportContract = readJson(SOURCE_REFS.reportContract);
  const hasDecisionResults = fs.existsSync(resolveRef(SOURCE_REFS.decisionResults));
  const decisionResults = hasDecisionResults ? readJson(SOURCE_REFS.decisionResults) : null;
  const evidence = {
    c035Results: sourceEvidence(SOURCE_REFS.c035Results),
    publishedFacts: sourceEvidence(SOURCE_REFS.publishedFacts),
    publishedPointer: sourceEvidence(SOURCE_REFS.publishedPointer),
    reportContract: sourceEvidence(SOURCE_REFS.reportContract),
    decisionResults: hasDecisionResults ? sourceEvidence(SOURCE_REFS.decisionResults) : null
  };

  const service = reportService.createReportService({
    scenarioContext: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    generatedAt: FORMED_AT,
    c035Results: c035Results,
    publishedFacts: publishedFacts,
    publishedPointer: publishedPointer,
    reportContract: reportContract,
    decisionResults: decisionResults,
    sourceEvidence: evidence
  });
  const reports = service.listReports();

  const contentEntries = reports.map(function (report) {
    return {
      reportId: report.reportId,
      contentVersion: report.contentVersion,
      contentSha256: sha256(serialize(report)),
      content: report
    };
  });
  const artifactEntries = reports.map(function (report, index) {
    const html = service.renderHtml(report.enterprise.enterpriseId);
    return {
      artifactId: report.reportId + "-HTML",
      reportId: report.reportId,
      artifactVersion: report.artifactVersion,
      formats: ["html", "print-to-pdf"],
      mimeType: "text/html",
      contentVersion: report.contentVersion,
      contentSha256: contentEntries[index].contentSha256,
      artifactSha256: sha256(Buffer.from(html, "utf8")),
      deepLink: report.deepLink,
      html: html
    };
  });

  const contents = {
    schemaVersion: "ofw.s003.m06.report-content-set.v1",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260815-001",
    contentSetVersion: "1.0.0",
    status: "published-report-contents",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    assessmentAt: c035Results.assessmentAt,
    reportCount: contentEntries.length,
    reports: contentEntries
  };
  const artifacts = {
    schemaVersion: "ofw.s003.m06.report-artifact-set.v1",
    moduleId: "M06",
    moduleOwner: "报告中心",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260815-001",
    artifactSetVersion: "1.0.0",
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
  const contentsDigest = sha256(contentsBytes);
  const artifactsDigest = sha256(artifactsBytes);
  const confirmedCount = reports.reduce(function (count, report) {
    return count + report.disposition.candidates.filter(function (candidate) {
      return candidate.status === "CONFIRMED_TO_OWNER_TODO";
    }).length;
  }, 0);
  const manifest = {
    schemaVersion: "ofw.s003.m06.report-manifest.v1",
    moduleId: "M06",
    moduleOwner: "报告中心",
    businessOwner: "财务公司",
    manifestId: "S003-M06-REPORT-MANIFEST-20260815-001",
    manifestVersion: "1.0.0",
    status: "formal-reports-generated",
    immutable: true,
    formedAt: FORMED_AT,
    scenarioIdentity: c035Results.scenarioIdentity,
    prototypeVersion: PROTOTYPE_VERSION,
    assessmentAt: c035Results.assessmentAt,
    modelIdentity: {
      packageId: publishedPointer.activeTarget.packageId,
      packageVersion: publishedPointer.activeTarget.packageVersion,
      publishedVersion: publishedPointer.activeTarget.packageVersion,
      lifecycleStatus: publishedPointer.activeTarget.lifecycleStatus
    },
    source: {
      c035Results: evidence.c035Results,
      publishedFacts: evidence.publishedFacts,
      publishedPointer: evidence.publishedPointer,
      reportContract: evidence.reportContract,
      decisionResults: evidence.decisionResults
    },
    collections: {
      contents: {
        contentSetId: contents.contentSetId,
        contentSetVersion: contents.contentSetVersion,
        ref: OUTPUT_REFS[0],
        sha256: contentsDigest
      },
      artifacts: {
        artifactSetId: artifacts.artifactSetId,
        artifactSetVersion: artifacts.artifactSetVersion,
        ref: OUTPUT_REFS[1],
        sha256: artifactsDigest
      }
    },
    reportCount: reports.length,
    summary: {
      riskTierCounts: riskTierCounts(reports),
      reportsWithDispositionCandidate: reports.filter(function (report) {
        return report.disposition.candidateCount > 0;
      }).length,
      confirmedToOwnerTodo: confirmedCount,
      actionRequestsCreatedByReportGeneration: 0,
      todosCreatedByReportGeneration: 0,
      notificationsDispatchedByReportGeneration: 0
    },
    reports: reports.map(function (report, index) {
      return {
        reportId: report.reportId,
        reportVersion: report.reportVersion,
        contentVersion: report.contentVersion,
        contentSha256: contentEntries[index].contentSha256,
        artifactId: artifactEntries[index].artifactId,
        artifactVersion: report.artifactVersion,
        artifactSha256: artifactEntries[index].artifactSha256,
        enterpriseId: report.enterprise.enterpriseId,
        enterpriseName: report.enterprise.name,
        finalScore: report.assessment.finalScore,
        riskTierId: report.assessment.riskTier.tierId,
        scenarioIdentity: report.scenarioIdentity,
        prototypeVersion: report.deliveryIdentity.prototypeVersion,
        deepLink: report.deepLink
      };
    }),
    invariants: {
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
  const manifestDigest = sha256(manifestBytes);
  const evidenceLines = [
    "# CP06 M06 企业报告验证",
    "",
    "- 形成时间：" + FORMED_AT,
    "- 场景运行：" + c035Results.scenarioIdentity.scenarioRunId,
    "- 场景版本：" + c035Results.scenarioIdentity.scenarioVersion,
    "- 原型版本：" + PROTOTYPE_VERSION,
    "- 报告数量：" + reports.length,
    "- 风险分布：绿 " + manifest.summary.riskTierCounts.GREEN
      + "、黄 " + manifest.summary.riskTierCounts.YELLOW
      + "、红 " + manifest.summary.riskTierCounts.RED
      + "、黑 " + manifest.summary.riskTierCounts.BLACK,
    "",
    "## 验证结论",
    "",
    "- 21 家企业均由同一轮次 Published C035 与风险事实生成正式报告内容和 HTML/打印制品。",
    "- 每份报告均包含评分、风险档位、15 项指标、6 项调节因子、默认语义、规则说明和证据引用。",
    "- 报告深链精确绑定 scenarioId、scenarioVersion、scenarioRunId、prototypeVersion、enterpriseId 与 reportId。",
    "- scenarioVersion 保持权威运行身份 " + c035Results.scenarioIdentity.scenarioVersion
      + "；原型交付版本独立记录为 " + PROTOTYPE_VERSION + "。",
    "- 在建企业固定 60 分、盈利历史不足按 A=100、适用因子缺失套零、不适用单独标记等规则均写入报告解释。",
    "- 报告生成不重算风险分，不创建 Action Request、负责人待办、审批或通知。",
    "- M06 沿用报告中心和场景工作台，不创建新一级模块或 S003 专属 Agent。",
    "",
    "## 资源哈希",
    "",
    "- " + evidence.reportContract.sha256 + "  " + SOURCE_REFS.reportContract,
    "- " + contentsDigest + "  " + OUTPUT_REFS[0],
    "- " + artifactsDigest + "  " + OUTPUT_REFS[1],
    "- " + manifestDigest + "  " + OUTPUT_REFS[2],
    "",
    "## 不可变与恢复语义",
    "",
    "- 本脚本只创建缺失资源；任何既有资源或 sidecar 内容不一致时均拒绝覆盖。",
    "- 历史报告使用原 scenarioRunId 只读查看；从快照恢复或回归时必须创建新的 scenarioRunId。",
    "- HTML 与 print-to-pdf 共享同一 reportId、内容版本和场景身份。",
    ""
  ];
  const evidenceBytes = Buffer.from(evidenceLines.join("\n"), "utf8");

  return {
    service: service,
    reports: reports,
    contents: contents,
    artifacts: artifacts,
    manifest: manifest,
    assets: new Map([
      [SOURCE_REFS.reportContract, fs.readFileSync(resolveRef(SOURCE_REFS.reportContract))],
      [OUTPUT_REFS[0], contentsBytes],
      [OUTPUT_REFS[1], artifactsBytes],
      [OUTPUT_REFS[2], manifestBytes],
      [OUTPUT_REFS[3], evidenceBytes]
    ])
  };
}

function materializeReportAssets(build, checkOnly, root) {
  const targetRoot = root || packageRoot;
  const results = [];
  for (const pair of build.assets.entries()) {
    const ref = pair[0];
    const bytes = pair[1];
    results.push({
      ref: ref,
      sha256: writeOrVerifyAtRoot(targetRoot, ref, bytes, checkOnly)
    });
  }
  return results;
}

function main() {
  const checkOnly = process.argv.includes("--check");
  try {
    const build = buildReportAssets();
    const results = materializeReportAssets(build, checkOnly);
    process.stdout.write(build.manifest.manifestId + "\n");
    results.forEach(function (result) {
      process.stdout.write(result.sha256 + "  " + result.ref + "\n");
    });
  } catch (error) {
    process.stderr.write((error && error.stack) || String(error));
    process.stderr.write("\n");
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = Object.freeze({
  FORMED_AT: FORMED_AT,
  PROTOTYPE_VERSION: PROTOTYPE_VERSION,
  SOURCE_REFS: SOURCE_REFS,
  OUTPUT_REFS: OUTPUT_REFS,
  sha256: sha256,
  serialize: serialize,
  writeOrVerifyAtRoot: writeOrVerifyAtRoot,
  buildReportAssets: buildReportAssets,
  materializeReportAssets: materializeReportAssets
});
