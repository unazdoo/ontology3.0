#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const helpers = require("./build-report-assets-v2.cjs");

const { packageRoot, sha256, resolveRef, readJson, serialize, writeOrVerifyAtRoot } = helpers;
const FORMED_AT = "2026-08-17T19:41:00.000Z";
const SOURCE_REFS = Object.freeze({
  previous: "resources/m05/agent-position.v6.json",
  manifest: "resources/m06/report-manifest.v9.json",
  contents: "resources/m06/report-contents.v9.json",
  artifacts: "resources/m06/report-artifacts.v9.json"
});
const OUTPUT_REF = "resources/m05/agent-position.v7.json";

function buildAgentPositionV7() {
  const previous = readJson(SOURCE_REFS.previous);
  const manifest = readJson(SOURCE_REFS.manifest);
  const contents = readJson(SOURCE_REFS.contents);
  const artifacts = readJson(SOURCE_REFS.artifacts);
  const manifestReport = manifest.reports?.[0];
  const contentEntry = contents.reports?.find((item) => item.reportId === manifestReport?.reportId);
  const artifact = artifacts.artifacts?.find((item) => item.reportId === manifestReport?.reportId);
  if (!manifestReport || !contentEntry?.content || !artifact) throw new Error("M05 无法绑定 M06 v9 正式报告资源");
  const content = contentEntry.content;
  return {
    ...previous,
    schemaVersion: "ofw.s003.m05.agent-position.v7",
    exportVersion: "1.7.0",
    supersedes: SOURCE_REFS.previous,
    scenarioProfile: {
      ...previous.scenarioProfile,
      derivedReleaseVersion: "1.5",
      prompt: {
        ...previous.scenarioProfile.prompt,
        version: "1.4",
        validatedAt: "2026-08-17 19:41:00",
        change: "绑定 S003 v9 正式企业债务风险报告，统一亮灯预警及成员单位接口人确认后分办语义。"
      }
    },
    reportBinding: {
      ...previous.reportBinding,
      manifestId: manifest.manifestId,
      manifestVersion: manifest.manifestVersion,
      manifestRef: SOURCE_REFS.manifest,
      manifestSha256: sha256(fs.readFileSync(resolveRef(SOURCE_REFS.manifest))),
      contentSetId: contents.contentSetId,
      contentSetVersion: contents.contentSetVersion,
      contentRef: SOURCE_REFS.contents,
      contentSetSha256: sha256(fs.readFileSync(resolveRef(SOURCE_REFS.contents))),
      reportId: manifestReport.reportId,
      reportVersion: manifestReport.reportVersion,
      contentVersion: manifestReport.contentVersion,
      contentSha256: manifestReport.contentSha256,
      artifactSetId: artifacts.artifactSetId,
      artifactSetVersion: artifacts.artifactSetVersion,
      artifactRef: SOURCE_REFS.artifacts,
      artifactSetSha256: sha256(fs.readFileSync(resolveRef(SOURCE_REFS.artifacts))),
      artifactId: artifact.artifactId,
      artifactVersion: artifact.artifactVersion,
      artifactSha256: artifact.artifactSha256,
      verificationRef: `${SOURCE_REFS.contents}#/reports/0/content/verificationSummary`,
      verificationSummary: content.verificationSummary,
      enterprise: content.enterprise,
      assessment: {
        finalScore: content.assessment.finalScore,
        riskTierId: content.assessment.riskTier.tierId,
        riskTierName: content.assessment.riskTier.name,
        factorSum: content.assessment.factorSum,
        lowestIndicators: (content.indicatorDetails || []).slice().sort((a, b) => Number(a.score || 0) - Number(b.score || 0)).slice(0, 3).map((item) => item.name),
        negativeFactors: (content.adjustmentFactors || []).filter((item) => Number(item.coefficient || 0) < 0).map((item) => `${item.name} ${Number(item.coefficient).toFixed(2)}`)
      },
      deepLink: content.deepLink
    },
    lifecyclePolicy: {
      ...previous.lifecyclePolicy,
      currentBindingFormedAt: FORMED_AT,
      sourceReportRunIdUnchanged: true,
      previousV1ThroughV6Preserved: true
    }
  };
}

function writeAgentPositionV7({ checkOnly = false } = {}) {
  const built = buildAgentPositionV7();
  writeOrVerifyAtRoot(packageRoot, OUTPUT_REF, serialize(built), checkOnly);
  return built;
}

if (require.main === module) {
  const checkOnly = process.argv.includes("--check");
  writeAgentPositionV7({ checkOnly });
  process.stdout.write(`${checkOnly ? "verified" : "created"} ${OUTPUT_REF}\n`);
}

module.exports = Object.freeze({ FORMED_AT, SOURCE_REFS, OUTPUT_REF, buildAgentPositionV7, writeAgentPositionV7 });
