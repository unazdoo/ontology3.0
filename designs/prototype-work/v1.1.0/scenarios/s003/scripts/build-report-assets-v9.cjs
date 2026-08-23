#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const reportService = require("../domain/report-service-v6.js");
const helpers = require("./build-report-assets-v2.cjs");

const { packageRoot, sha256, resolveRef, readJson, serialize, writeOrVerifyAtRoot } = helpers;
const FORMED_AT = "2026-08-17T19:40:00.000Z";
const CONTENT_VERSION = "1.7.0";
const CONTENT_SCHEMA_VERSION = "ofw.s003.m06.enterprise-report-content.v7";

const SOURCE_REFS = Object.freeze({
  previousManifest: "resources/m06/report-manifest.v8.json",
  previousContents: "resources/m06/report-contents.v8.json",
  previousArtifacts: "resources/m06/report-artifacts.v8.json",
  c035Results: "resources/m01/c035-risk-results.v2.json",
  publishedFacts: "resources/m01/published-risk-facts.v2.json",
  publishedPointer: "resources/m01/published-pointer.v2.json",
  formalDataAsset: "resources/m02/formal-candidate-data-asset.v1.json",
  humanInputSnapshot: "resources/m02/human-input-snapshot.v1.json",
  qualityResult: "resources/m02/quality-result.v1.json",
  decisionResults: "resources/m04/decision-results.v3.json",
  reportContract: "resources/m06/report-contract.v2.json",
  reportDefinition: "resources/m06/report-definition.v2.json",
  reportTemplate: "resources/m06/report-template.v2.json",
  reportAssurance: "resources/m06/report-assurance-profile.v3.json"
});

const OUTPUT_REFS = Object.freeze({
  contents: "resources/m06/report-contents.v9.json",
  artifacts: "resources/m06/report-artifacts.v9.json",
  manifest: "resources/m06/report-manifest.v9.json",
  history: "resources/m06/report-history-index.v4.json",
  evidence: "evidence/M06-report-content-v9-validation.md"
});

const HISTORY_MANIFEST_REFS = Object.freeze([
  "resources/m06/report-manifest.v1.json",
  "resources/m06/report-manifest.v2.json",
  "resources/m06/report-manifest.v3.json",
  "resources/m06/report-manifest.v4.json",
  "resources/m06/report-manifest.v5.json",
  "resources/m06/report-manifest.v6.json",
  "resources/m06/report-manifest.v7.json",
  "resources/m06/report-manifest.v8.json"
]);

const FORBIDDEN_ACTION_WORDING = /确需处置时由风险管理人员从驾驶舱提交行动申请|重大变化通过驾驶舱提交标准行动申请|重大变化及时提交行动申请|人工判断是否提交行动申请|决定是否提交标准行动申请|报告中心仪表盘提出建议/;

function sourceEvidence(ref, extra = {}) {
  return { ref, sha256: sha256(fs.readFileSync(resolveRef(ref))), ...extra };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function riskTierCounts(reports) {
  return reports.reduce((counts, report) => {
    const tierId = report.assessment?.riskTier?.tierId || "UNKNOWN";
    counts[tierId] = (counts[tierId] || 0) + 1;
    return counts;
  }, { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 });
}

function alertCount(reports) {
  return reports.filter((report) => ["YELLOW", "RED", "BLACK"].includes(report.assessment?.riskTier?.tierId)).length;
}

function assertReportSemantics(report) {
  const serialized = JSON.stringify(report);
  if (FORBIDDEN_ACTION_WORDING.test(serialized)) throw new Error(`报告仍含旧行动语义: ${report.reportId}`);
  const tierId = report.assessment?.riskTier?.tierId;
  const candidates = report.disposition?.candidates || [];
  if (tierId === "GREEN") {
    if (candidates.length !== 0 || !/绿灯.*不形成预警行动/.test(report.responseStrategy?.guidance || "")) {
      throw new Error(`绿灯报告行动语义不一致: ${report.reportId}`);
    }
  } else if (["YELLOW", "RED", "BLACK"].includes(tierId)) {
    if (candidates.length !== 1 || !/按亮灯形成一条预警行动/.test(report.responseStrategy?.guidance || "")) {
      throw new Error(`亮灯报告未形成一企一预警: ${report.reportId}`);
    }
    if (!/对应成员单位债务风险接口人/.test(report.responseStrategy?.guidance || "")
      || !/接口人确认后再分办本单位负责人/.test(report.responseStrategy?.guidance || "")) {
      throw new Error(`亮灯报告缺少成员单位接口人路由语义: ${report.reportId}`);
    }
  }
}

function replaceEvidence(report, evidenceType, next) {
  const references = Array.isArray(report.evidenceReferences) ? report.evidenceReferences : [];
  const index = references.findIndex((item) => item.evidenceType === evidenceType);
  if (index < 0) throw new Error(`${report.reportId} 缺少 ${evidenceType} 证据`);
  references[index] = { ...references[index], ...next };
  report.evidenceReferences = references;
}

function refreshReportEvidence(report, sources) {
  const enterpriseId = report.enterprise?.enterpriseId;
  const resultIndex = sources.c035Results.results.findIndex((item) => item.enterprise?.enterpriseId === enterpriseId);
  const factIndex = sources.publishedFacts.facts.findIndex((item) => item.subjectId === enterpriseId);
  if (resultIndex < 0 || factIndex < 0) throw new Error(`${report.reportId} 无法定位当前 C035 / Published fact`);
  const result = sources.c035Results.results[resultIndex];
  const fact = sources.publishedFacts.facts[factIndex];
  const pointerTarget = sources.publishedPointer.activeTarget;

  replaceEvidence(report, "C035_RESULT", {
    evidenceId: result.resultId,
    evidenceVersion: result.resultVersion || sources.c035Results.resultSetVersion,
    ref: SOURCE_REFS.c035Results,
    sha256: sources.hashes.c035Results,
    jsonPointer: `#/results/${resultIndex}`
  });
  replaceEvidence(report, "PUBLISHED_RISK_FACT", {
    evidenceId: fact.factId,
    evidenceVersion: fact.factVersion || sources.publishedFacts.factSetVersion,
    ref: SOURCE_REFS.publishedFacts,
    sha256: sources.hashes.publishedFacts,
    jsonPointer: `#/facts/${factIndex}`
  });
  replaceEvidence(report, "PUBLISHED_MODEL_POINTER", {
    evidenceId: sources.publishedPointer.pointerId,
    evidenceVersion: sources.publishedPointer.pointerVersion,
    ref: SOURCE_REFS.publishedPointer,
    sha256: sources.hashes.publishedPointer,
    packageVersion: pointerTarget.packageVersion
  });
  replaceEvidence(report, "FORMAL_DATA_ASSET", {
    evidenceId: sources.formalDataAsset.dataAssetId,
    evidenceVersion: sources.formalDataAsset.dataAssetVersion,
    ref: SOURCE_REFS.formalDataAsset,
    sha256: sources.hashes.formalDataAsset
  });
  replaceEvidence(report, "HUMAN_INPUT_SNAPSHOT", {
    evidenceId: sources.humanInputSnapshot.snapshotId,
    evidenceVersion: sources.humanInputSnapshot.snapshotVersion,
    ref: SOURCE_REFS.humanInputSnapshot,
    sha256: sources.hashes.humanInputSnapshot
  });
  replaceEvidence(report, "QUALITY_RESULT", {
    evidenceId: sources.qualityResult.qualityResultId,
    evidenceVersion: sources.qualityResult.schemaVersion,
    ref: SOURCE_REFS.qualityResult,
    sha256: sources.hashes.qualityResult
  });
  replaceEvidence(report, "REPORT_CONTRACT", {
    evidenceId: sources.reportContract.contractId,
    evidenceVersion: sources.reportContract.contractVersion,
    ref: SOURCE_REFS.reportContract,
    sha256: sources.hashes.reportContract
  });
  replaceEvidence(report, "DECISION_RESULT", {
    evidenceId: sources.decisionResults.resultSetId,
    evidenceVersion: sources.decisionResults.resultSetVersion,
    ref: SOURCE_REFS.decisionResults,
    sha256: sources.hashes.decisionResults
  });
  report.modelIdentity = {
    packageId: pointerTarget.packageId,
    packageVersion: pointerTarget.packageVersion,
    publishedVersion: pointerTarget.packageVersion,
    lifecycleStatus: pointerTarget.lifecycleStatus
  };
  report.verificationResults = (report.verificationResults || []).map((item) => item.checkId === "decision-status-alignment"
    ? {
        ...item,
        evidence: `${sources.decisionResults.resultSetId}；${report.disposition?.candidateCount || 0} 条形成时候选与同轮状态一致`
      }
    : item);
  return report;
}

function buildHistory(currentManifest) {
  const historical = HISTORY_MANIFEST_REFS.map((ref) => ({ ref, manifest: readJson(ref) }));
  const all = [...historical, { ref: OUTPUT_REFS.manifest, manifest: currentManifest }];
  return {
    schemaVersion: "ofw.s003.m06.report-history-index.v4",
    moduleId: "M06",
    moduleOwner: "报告中心",
    historyId: "S003-M06-REPORT-HISTORY-20260817-004",
    historyVersion: "1.3.0",
    lifecycleStatus: "published",
    formedAt: FORMED_AT,
    immutable: true,
    scenarioIdentity: currentManifest.scenarioIdentity,
    currentManifestRef: OUTPUT_REFS.manifest,
    versionCount: all.length,
    versions: all.map(({ ref, manifest }, index) => ({
      sequence: index + 1,
      manifestId: manifest.manifestId,
      manifestVersion: manifest.manifestVersion,
      manifestRef: ref,
      formedAt: manifest.formedAt,
      reportCount: manifest.reportCount,
      status: index === all.length - 1 ? "current" : "historical",
      supersedes: manifest.supersedes || null,
      supersededBy: index < all.length - 1 ? all[index + 1].ref : null,
      immutable: manifest.immutable === true
    })),
    semantics: {
      viewHistoricalVersion: "只读展示该版本清单、内容和证据，不改写当前指针",
      replacement: "新内容版本通过 supersedes / supersededBy 建立替代链，不覆盖旧版本",
      withdrawal: "撤回只改变目录引用状态；历史内容、制品与哈希仍保留。",
      historyRepair: "v4 从 v1—v8 实际清单重建唯一序列，修复旧索引中的重复引用和时间倒序；不改写任何历史清单。"
    }
  };
}

function buildReportAssetsV9() {
  const previousManifest = readJson(SOURCE_REFS.previousManifest);
  const previousContents = readJson(SOURCE_REFS.previousContents);
  const previousArtifacts = readJson(SOURCE_REFS.previousArtifacts);
  const c035Results = readJson(SOURCE_REFS.c035Results);
  const publishedFacts = readJson(SOURCE_REFS.publishedFacts);
  const publishedPointer = readJson(SOURCE_REFS.publishedPointer);
  const formalDataAsset = readJson(SOURCE_REFS.formalDataAsset);
  const humanInputSnapshot = readJson(SOURCE_REFS.humanInputSnapshot);
  const qualityResult = readJson(SOURCE_REFS.qualityResult);
  const decisionResults = readJson(SOURCE_REFS.decisionResults);
  const reportContract = readJson(SOURCE_REFS.reportContract);
  const reportDefinition = readJson(SOURCE_REFS.reportDefinition);
  const reportTemplate = readJson(SOURCE_REFS.reportTemplate);
  const assurance = readJson(SOURCE_REFS.reportAssurance);
  const publishedModel = publishedPointer.activeTarget?.publishedSnapshot;
  if (!publishedModel || publishedPointer.activeTarget?.lifecycleStatus !== "published") throw new Error("M01 Published 模型指针不可用");
  const sourceBundle = {
    c035Results,
    publishedFacts,
    publishedPointer,
    formalDataAsset,
    humanInputSnapshot,
    qualityResult,
    decisionResults,
    reportContract,
    hashes: Object.fromEntries([
      "c035Results",
      "publishedFacts",
      "publishedPointer",
      "formalDataAsset",
      "humanInputSnapshot",
      "qualityResult",
      "decisionResults",
      "reportContract"
    ].map((key) => [key, sha256(fs.readFileSync(resolveRef(SOURCE_REFS[key])))]))
  };

  const reports = previousContents.reports.map((entry) => {
    const upgraded = clone(reportService.upgradeReport(entry.content, {
      contentSchemaVersion: CONTENT_SCHEMA_VERSION,
      reportVersion: CONTENT_VERSION,
      contentVersion: CONTENT_VERSION,
      artifactVersion: "html-print-capability-v9",
      verificationChecks: assurance.verificationChecks,
      checkedAt: FORMED_AT
    }));
    upgraded.generatedAt = FORMED_AT;
    upgraded.reportVersion = CONTENT_VERSION;
    upgraded.contentVersion = CONTENT_VERSION;
    upgraded.artifactVersion = "html-print-capability-v9";
    refreshReportEvidence(upgraded, sourceBundle);
    assertReportSemantics(upgraded);
    return upgraded;
  });
  if (reports.length !== 21) throw new Error(`S003 正式报告 v9 必须覆盖 21 家企业，实际 ${reports.length}`);
  if (alertCount(reports) !== Number(c035Results.summary?.alertEnterpriseCount || 0)) throw new Error("正式报告亮灯行动数量与 C035 不一致");

  const contentEntries = reports.map((report) => ({
    reportId: report.reportId,
    contentVersion: CONTENT_VERSION,
    contentSha256: sha256(serialize(report)),
    content: report
  }));
  const previousArtifactByReport = new Map(previousArtifacts.artifacts.map((item) => [item.reportId, item]));
  const artifactEntries = reports.map((report, index) => {
    const previous = previousArtifactByReport.get(report.reportId) || {};
    const html = reportService.renderReportHtml(report, CONTENT_SCHEMA_VERSION);
    if (FORBIDDEN_ACTION_WORDING.test(html)) throw new Error(`报告 HTML 仍含旧行动语义: ${report.reportId}`);
    return {
      ...previous,
      artifactId: `${report.reportId}-HTML-V9`,
      reportId: report.reportId,
      artifactVersion: "html-print-capability-v9",
      formats: ["html"],
      mimeType: "text/html",
      contentVersion: CONTENT_VERSION,
      contentSha256: contentEntries[index].contentSha256,
      artifactSha256: sha256(Buffer.from(html, "utf8")),
      deepLink: previous.deepLink || report.deepLink,
      html
    };
  });

  const contents = {
    ...previousContents,
    schemaVersion: "ofw.s003.m06.report-content-set.v9",
    contentSetId: "S003-M06-REPORT-CONTENTS-20260817-008",
    contentSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousContents,
    formedAt: FORMED_AT,
    reportAssurance: { id: assurance.profileId, version: assurance.profileVersion, ref: SOURCE_REFS.reportAssurance },
    correction: {
      reason: "按风险分档亮灯统一黄灯、红灯、黑灯的一企一预警语义，并明确行动申请直达成员单位接口人确认后再分办负责人。",
      previousVersionPreserved: true,
      sourceScenarioRunIdUnchanged: true,
      scoreAndTierFactsUnchanged: true
    },
    reportCount: contentEntries.length,
    reports: contentEntries
  };
  const artifacts = {
    ...previousArtifacts,
    schemaVersion: "ofw.s003.m06.report-artifact-set.v9",
    artifactSetId: "S003-M06-REPORT-ARTIFACTS-20260817-008",
    artifactSetVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousArtifacts,
    formedAt: FORMED_AT,
    artifactCount: artifactEntries.length,
    artifacts: artifactEntries
  };
  const contentsBytes = serialize(contents);
  const artifactsBytes = serialize(artifacts);

  const manifest = {
    ...previousManifest,
    schemaVersion: "ofw.s003.m06.report-manifest.v9",
    manifestId: "S003-M06-REPORT-MANIFEST-20260817-008",
    manifestVersion: CONTENT_VERSION,
    supersedes: SOURCE_REFS.previousManifest,
    formedAt: FORMED_AT,
    reportAssuranceProfileId: assurance.profileId,
    reportAssuranceProfileVersion: assurance.profileVersion,
    modelIdentity: {
      packageId: publishedModel.packageId,
      packageVersion: publishedModel.packageVersion,
      publishedVersion: publishedModel.packageVersion,
      lifecycleStatus: publishedModel.lifecycleStatus
    },
    source: {
      c035Results: sourceEvidence(SOURCE_REFS.c035Results, { resultSetId: c035Results.resultSetId, resultSetVersion: c035Results.resultSetVersion }),
      publishedFacts: sourceEvidence(SOURCE_REFS.publishedFacts, { factSetId: publishedFacts.factSetId, factSetVersion: publishedFacts.factSetVersion }),
      publishedPointer: sourceEvidence(SOURCE_REFS.publishedPointer, { pointerId: publishedPointer.pointerId, pointerVersion: publishedPointer.pointerVersion }),
      formalDataAsset: sourceEvidence(SOURCE_REFS.formalDataAsset, { dataAssetId: formalDataAsset.dataAssetId, dataAssetVersion: formalDataAsset.dataAssetVersion }),
      humanInputSnapshot: sourceEvidence(SOURCE_REFS.humanInputSnapshot, { snapshotId: humanInputSnapshot.snapshotId, snapshotVersion: humanInputSnapshot.snapshotVersion }),
      qualityResult: sourceEvidence(SOURCE_REFS.qualityResult, { qualityResultId: qualityResult.qualityResultId, qualityResultVersion: qualityResult.schemaVersion }),
      reportContract: sourceEvidence(SOURCE_REFS.reportContract, { contractId: reportContract.contractId, contractVersion: reportContract.contractVersion }),
      reportDefinition: sourceEvidence(SOURCE_REFS.reportDefinition, { definitionId: reportDefinition.definitionId, definitionVersion: reportDefinition.definitionVersion }),
      reportTemplate: sourceEvidence(SOURCE_REFS.reportTemplate, { templateId: reportTemplate.templateId, templateVersion: reportTemplate.templateVersion }),
      decisionResults: sourceEvidence(SOURCE_REFS.decisionResults, { resultSetId: decisionResults.resultSetId, resultSetVersion: decisionResults.resultSetVersion }),
      reportAssurance: sourceEvidence(SOURCE_REFS.reportAssurance, { profileId: assurance.profileId, profileVersion: assurance.profileVersion }),
      previousManifest: sourceEvidence(SOURCE_REFS.previousManifest, { manifestId: previousManifest.manifestId, manifestVersion: previousManifest.manifestVersion }),
      previousContents: sourceEvidence(SOURCE_REFS.previousContents, { contentSetId: previousContents.contentSetId, contentSetVersion: previousContents.contentSetVersion }),
      previousArtifacts: sourceEvidence(SOURCE_REFS.previousArtifacts, { artifactSetId: previousArtifacts.artifactSetId, artifactSetVersion: previousArtifacts.artifactSetVersion })
    },
    collections: {
      contents: { contentSetId: contents.contentSetId, contentSetVersion: contents.contentSetVersion, ref: OUTPUT_REFS.contents, sha256: sha256(contentsBytes) },
      artifacts: { artifactSetId: artifacts.artifactSetId, artifactSetVersion: artifacts.artifactSetVersion, ref: OUTPUT_REFS.artifacts, sha256: sha256(artifactsBytes) }
    },
    reportCount: reports.length,
    summary: {
      ...(previousManifest.summary || {}),
      riskTierCounts: riskTierCounts(reports),
      reportsWithDispositionCandidate: alertCount(reports),
      alertEnterpriseCount: alertCount(reports),
      alertCount: alertCount(reports)
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
      yellowRedBlackOneAlertPerEnterprise: true,
      majorFactorDoesNotCreateIndependentAction: true,
      dashboardSubmissionRoutesToMemberUnitContact: true,
      todoCreatedOnlyAfterMemberUnitContactConfirmation: true,
      previousV1ThroughV8EvidenceUntouched: true
    }
  };
  const manifestBytes = serialize(manifest);
  const history = buildHistory(manifest);
  const historyBytes = serialize(history);
  const evidenceBytes = Buffer.from([
    "# M06 正式报告 v9 验证",
    "",
    `- 形成时间：${FORMED_AT}`,
    `- 正式来源 scenarioRunId：${contents.scenarioIdentity.scenarioRunId}`,
    `- 报告内容版本：${CONTENT_VERSION}`,
    `- 报告数量：${reports.length}`,
    `- 亮灯预警数量：${alertCount(reports)}`,
    "- Checkpoint 状态：本文件为 M06 模块证据，不代表 CP22 已封存。",
    "",
    "## 结论",
    "",
    "- v1—v8 正式报告内容、制品、清单和历史证据保持原字节不变。",
    "- 黄灯、红灯、黑灯均按亮灯形成一企一预警；绿灯保持常态监测。",
    "- 集团债务风险管理人员从驾驶舱提交后，行动申请直接进入对应成员单位接口人的通用决策中心；接口人确认后再分办本单位负责人。",
    "- 重大因子只作为诊断证据，不单独形成行动；评分、风险分档、企业数量和 scenarioRunId 均未改变。",
    "- v9 清单重新计算全部来源、内容和制品哈希；历史索引从实际 v1—v8 清单重建唯一顺序。",
    "",
    "## 资源哈希",
    "",
    `- ${sha256(contentsBytes)}  ${OUTPUT_REFS.contents}`,
    `- ${sha256(artifactsBytes)}  ${OUTPUT_REFS.artifacts}`,
    `- ${sha256(manifestBytes)}  ${OUTPUT_REFS.manifest}`,
    `- ${sha256(historyBytes)}  ${OUTPUT_REFS.history}`,
    ""
  ].join("\n"), "utf8");

  return {
    reports,
    contents,
    artifacts,
    manifest,
    history,
    assets: new Map([
      [OUTPUT_REFS.contents, contentsBytes],
      [OUTPUT_REFS.artifacts, artifactsBytes],
      [OUTPUT_REFS.manifest, manifestBytes],
      [OUTPUT_REFS.history, historyBytes],
      [OUTPUT_REFS.evidence, evidenceBytes]
    ])
  };
}

function writeReportAssetsV9({ checkOnly = false } = {}) {
  const built = buildReportAssetsV9();
  for (const [ref, bytes] of built.assets) writeOrVerifyAtRoot(packageRoot, ref, bytes, checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeReportAssetsV9({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REFS.manifest}\n`);
}

module.exports = Object.freeze({
  FORMED_AT,
  CONTENT_VERSION,
  CONTENT_SCHEMA_VERSION,
  SOURCE_REFS,
  OUTPUT_REFS,
  buildReportAssetsV9,
  writeReportAssetsV9
});
