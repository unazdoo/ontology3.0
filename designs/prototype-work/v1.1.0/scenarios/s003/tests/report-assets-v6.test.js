"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const builder = require("../scripts/build-report-assets-v6.cjs");
const root = path.resolve(__dirname, "..");

function json(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function digest(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex");
}

test("v6 report resources are deterministic, hash-locked and preserve v1-v5", () => {
  builder.writeReportAssetsV6({ checkOnly: true });
  for (const ref of [
    "resources/m06/report-contents.v6.json",
    "resources/m06/report-artifacts.v6.json",
    "resources/m06/report-manifest.v6.json",
    "resources/m06/report-history-index.v1.json",
    "evidence/M06-report-content-v6-validation.md"
  ]) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), ref);
  }
  for (const version of [1, 2, 3, 4, 5]) {
    assert.ok(fs.existsSync(path.join(root, `resources/m06/report-manifest.v${version}.json`)));
  }
});

test("formation verification is a non-vacuous immutable 13-item result set", () => {
  const assurance = json("resources/m06/report-assurance-profile.v3.json");
  const contents = json("resources/m06/report-contents.v6.json");
  const checkIds = assurance.verificationChecks.map((item) => item.checkId);
  assert.equal(contents.reportCount, 21);
  for (const entry of contents.reports) {
    const report = entry.content;
    assert.deepEqual(report.verificationResults.map((item) => item.checkId), checkIds);
    assert.ok(report.verificationResults.every((item) => item.passed && item.evidence && item.impact && item.responsibility && item.recommendation));
    assert.equal(report.verificationSummary.checkCount, checkIds.length);
    assert.equal(report.verificationSummary.passedCount, checkIds.length);
    assert.equal(report.verificationSummary.failedCount, 0);
    assert.equal(report.verificationSummary.derivedFromResults, true);
  }
});

test("green score and major-factor management escalation remain separate facts", () => {
  const contents = json("resources/m06/report-contents.v6.json");
  const artifacts = json("resources/m06/report-artifacts.v6.json");
  const report = contents.reports.find((item) => item.content.enterprise.enterpriseId === "S003-ENT-009").content;
  assert.equal(report.assessment.riskTier.tierId, "GREEN");
  assert.equal(report.assessment.finalScore, 47.32);
  assert.equal(report.managementEscalation.triggered, true);
  assert.equal(report.managementEscalation.scoringTierUnchanged, true);
  assert.match(report.conclusion, /重大因子管理升级/);
  assert.match(report.threeMonthActionPlan[0].actions, /人工判断是否提交标准行动申请/);
  const artifact = artifacts.artifacts.find((item) => item.reportId === report.reportId);
  assert.match(artifact.html, /重大因子管理升级（评分分档不变）/);
});

test("formal artifact is HTML with browser print capability, not a fabricated PDF artifact", () => {
  const artifacts = json("resources/m06/report-artifacts.v6.json");
  for (const artifact of artifacts.artifacts) {
    assert.deepEqual(artifact.formats, ["html"]);
    assert.equal(artifact.mimeType, "text/html");
    assert.equal(artifact.printCapability.mode, "browser-print-to-pdf");
    assert.equal(artifact.printCapability.independentPdfArtifact, false);
    assert.match(artifact.html, /报告形成时逐项核验/);
  }
});

test("report history exposes the immutable supersedes chain without rewriting old versions", () => {
  const history = json("resources/m06/report-history-index.v1.json");
  assert.equal(history.versionCount, 6);
  assert.equal(history.versions.at(-1).manifestRef, "resources/m06/report-manifest.v6.json");
  assert.equal(history.versions.at(-1).status, "current");
  for (let index = 0; index < history.versions.length - 1; index += 1) {
    assert.equal(history.versions[index].status, "superseded");
    assert.equal(history.versions[index].supersededBy, history.versions[index + 1].manifestRef);
  }
  assert.match(history.semantics.viewHistoricalVersion, /只读/);
  assert.match(history.semantics.replacement, /不覆盖旧版本/);
});
