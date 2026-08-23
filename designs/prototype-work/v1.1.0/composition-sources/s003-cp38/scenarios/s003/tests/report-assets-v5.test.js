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

test("v5 report resources are immutable, hash-locked and preserve v4", () => {
  for (const ref of [
    "resources/m06/report-assurance-profile.v3.json",
    "resources/m06/report-contents.v5.json",
    "resources/m06/report-artifacts.v5.json",
    "resources/m06/report-manifest.v5.json",
    "evidence/CP18-report-content-v5-validation.md"
  ]) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), ref);
  }
  assert.ok(fs.existsSync(path.join(root, "resources/m06/report-contents.v4.json")));
  assert.ok(fs.existsSync(path.join(root, "resources/m06/report-artifacts.v4.json")));
  assert.ok(fs.existsSync(path.join(root, "resources/m06/report-manifest.v4.json")));
});

test("all 21 v5 reports contain professional diagnosis, strategy and three-month plans", () => {
  const contents = json("resources/m06/report-contents.v5.json");
  const artifacts = json("resources/m06/report-artifacts.v5.json");
  assert.equal(contents.reportCount, 21);
  assert.equal(artifacts.artifactCount, 21);
  for (const entry of contents.reports) {
    const content = entry.content;
    assert.equal(content.contentVersion, "1.3.0");
    assert.equal(content.indicatorDetails.length, 15);
    assert.ok(content.keyRiskDiagnosis);
    assert.ok(content.responseStrategy);
    assert.equal(content.threeMonthActionPlan.length, 3);
    assert.equal(content.verificationSummary.checkCount, 13);
    assert.equal(content.verificationSummary.passedCount, 13);
  }
});

test("construction reports use fixed-60 construction semantics instead of indicator weakness claims", () => {
  const contents = json("resources/m06/report-contents.v5.json");
  const artifacts = json("resources/m06/report-artifacts.v5.json");
  const construction = contents.reports.map((entry) => entry.content).filter((content) => content.assessment.isUnderConstruction);
  assert.equal(construction.length, 3);
  for (const content of construction) {
    const semanticText = JSON.stringify({
      conclusion: content.conclusion,
      diagnosis: content.keyRiskDiagnosis,
      strategy: content.responseStrategy,
      plan: content.threeMonthActionPlan
    });
    assert.match(semanticText, /固定 60/);
    assert.match(semanticText, /建设资金/);
    assert.match(semanticText, /投产条件/);
    assert.doesNotMatch(semanticText, /低分指标|最低指标/);
    assert.ok(content.keyRiskDiagnosis.indicatorItems.every((item) => item.type !== "indicator"));
    const artifact = artifacts.artifacts.find((item) => item.reportId === content.reportId);
    assert.ok(artifact);
    assert.match(artifact.html, /财务指标口径清单/);
    assert.doesNotMatch(artifact.html, /权重<\/th><th>加权得分/);
  }
});

test("report assurance requires non-vacuous decision evidence", () => {
  const assurance = json("resources/m06/report-assurance-profile.v3.json");
  assert.equal(assurance.profileVersion, "1.2.0");
  assert.equal(assurance.decisionEvidencePolicy.emptySetMayPassOnlyWhenNoCandidateExpected, true);
  assert.ok(assurance.verificationChecks.some((item) => item.checkId === "decision-status-alignment" && /实际存在/.test(item.label)));
});
