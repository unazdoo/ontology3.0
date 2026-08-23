"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function json(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function digest(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex");
}

test("v7 immutable report resources remain hash locked", () => {
  for (const ref of [
    "resources/m06/report-contents.v7.json",
    "resources/m06/report-artifacts.v7.json",
    "resources/m06/report-manifest.v7.json",
    "resources/m06/report-history-index.v2.json",
    "evidence/M06-report-content-v7-validation.md"
  ]) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), ref);
  }
});

test("v7 preserves C035 score and risk tier for every enterprise", () => {
  const c035 = json("resources/m01/c035-risk-results.v1.json");
  const contents = json("resources/m06/report-contents.v7.json");
  const manifest = json("resources/m06/report-manifest.v7.json");
  assert.equal(contents.reportCount, c035.enterpriseCount);
  assert.equal(manifest.reportCount, c035.enterpriseCount);
  const byEnterprise = new Map(c035.results.map((item) => [item.enterprise.enterpriseId, item]));
  for (const entry of contents.reports) {
    const report = entry.content;
    const source = byEnterprise.get(report.enterprise.enterpriseId);
    assert.ok(source, report.enterprise.enterpriseId);
    assert.equal(report.scenarioIdentity.scenarioRunId, c035.scenarioIdentity.scenarioRunId);
    assert.equal(report.assessment.finalScore, source.finalScore, report.enterprise.enterpriseId);
    assert.equal(report.assessment.riskTier.tierId, source.riskTier.tierId, report.enterprise.enterpriseId);
  }
});

test("v7 formal HTML is readable business language and keeps professional sections", () => {
  const contents = json("resources/m06/report-contents.v7.json");
  const artifacts = json("resources/m06/report-artifacts.v7.json");
  assert.equal(artifacts.artifactCount, 21);
  for (const artifact of artifacts.artifacts) {
    assert.deepEqual(artifact.formats, ["html"]);
    assert.equal(artifact.printCapability.mode, "browser-print-to-pdf");
    assert.doesNotMatch(artifact.html, /评分分档与重大因子管理信号分开判断|\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO)\b/);
    assert.match(artifact.html, /关键风险诊断/);
    assert.match(artifact.html, /风险应对策略/);
    assert.match(artifact.html, /未来三个月行动建议/);
  }
  for (const entry of contents.reports) {
    const report = entry.content;
    assert.ok(report.conclusion && report.conclusion.length > 40, report.reportId);
    assert.ok(report.keyRiskDiagnosis?.indicatorItems?.length || report.keyRiskDiagnosis?.factorItems?.length, report.reportId);
    assert.ok(report.responseStrategy?.guidance, report.reportId);
    assert.ok(report.threeMonthActionPlan?.length, report.reportId);
  }
});

test("v7 history appends v7 without rewriting v6", () => {
  const history = json("resources/m06/report-history-index.v2.json");
  assert.equal(history.versionCount, 7);
  assert.equal(history.currentManifestRef, "resources/m06/report-manifest.v7.json");
  assert.equal(history.versions.at(-1).manifestRef, "resources/m06/report-manifest.v7.json");
  assert.equal(history.versions.at(-1).status, "current");
  assert.equal(history.versions.at(-2).manifestRef, "resources/m06/report-manifest.v6.json");
  assert.equal(history.versions.at(-2).status, "superseded");
  assert.equal(history.versions.at(-2).supersededBy, "resources/m06/report-manifest.v7.json");
});
