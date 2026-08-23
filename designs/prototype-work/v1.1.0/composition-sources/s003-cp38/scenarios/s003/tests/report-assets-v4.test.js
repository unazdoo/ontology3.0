"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scenarioRoot = path.resolve(__dirname, "..");
const builder = require("../scripts/build-report-assets-v4.cjs");

function read(relativePath) {
  return fs.readFileSync(path.join(scenarioRoot, relativePath));
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("v4 report assets are reproducible and keep v3 immutable", () => {
  const v3Refs = ["resources/m06/report-manifest.v3.json", "resources/m06/report-contents.v3.json", "resources/m06/report-artifacts.v3.json"];
  const before = new Map(v3Refs.map((ref) => [ref, sha256(read(ref))]));
  const built = builder.buildReportAssetsV4();
  assert.equal(built.manifest.manifestVersion, "1.2.0");
  assert.equal(built.contents.reportCount, 21);
  assert.equal(built.artifacts.artifactCount, 21);
  for (const ref of v3Refs) assert.equal(sha256(read(ref)), before.get(ref), ref);
  assert.deepEqual(built.manifest.scenarioIdentity, json("resources/m01/c035-risk-results.v1.json").scenarioIdentity);
});

test("v4 downloads contain professional sections and no internal presentation enums", () => {
  const artifacts = json("resources/m06/report-artifacts.v4.json");
  const forbidden = /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;
  for (const artifact of artifacts.artifacts) {
    assert.doesNotMatch(artifact.html, forbidden, artifact.reportId);
    assert.match(artifact.html, /执行摘要与总体结论/);
    assert.match(artifact.html, /关键风险诊断说明/);
    assert.match(artifact.html, /风险应对策略与改善建议/);
    assert.match(artifact.html, /未来三个月行动建议/);
    assert.match(artifact.html, /核验、版本、产物与证据/);
  }
});

test("v4 content differentiates high-risk and construction plans without changing score facts", () => {
  const v3 = json("resources/m06/report-contents.v3.json");
  const v4 = json("resources/m06/report-contents.v4.json");
  const oldById = new Map(v3.reports.map((entry) => [entry.reportId, entry.content]));
  for (const entry of v4.reports) {
    const previous = oldById.get(entry.reportId);
    assert.ok(previous, entry.reportId);
    assert.equal(entry.content.assessment.rawScore, previous.assessment.rawScore);
    assert.equal(entry.content.assessment.finalScore, previous.assessment.finalScore);
    assert.deepEqual(entry.content.assessment.riskTier, previous.assessment.riskTier);
    assert.equal(entry.content.scenarioIdentity.scenarioRunId, previous.scenarioIdentity.scenarioRunId);
  }
  const construction = v4.reports.find((entry) => entry.content.assessment.isUnderConstruction)?.content;
  assert.equal(construction.assessment.rawScore, 60);
  assert.match(JSON.stringify(construction.threeMonthActionPlan), /建设资金|投产/);
  const red = v4.reports.find((entry) => entry.content.assessment.riskTier.tierId === "RED")?.content;
  assert.match(JSON.stringify(red.threeMonthActionPlan), /流动性应急|交叉违约/);
});

test("current integration advances beyond v4 while preserving v4 formal resources", () => {
  const source = fs.readFileSync(path.join(scenarioRoot, "integration-config.js"), "utf8");
  assert.match(source, /report-manifest\.v9\.json/);
  assert.match(source, /report-contents\.v9\.json/);
  assert.match(source, /report-artifacts\.v9\.json/);
  assert.match(source, /report-assurance-profile\.v3\.json/);
  for (const ref of ["report-manifest.v4.json", "report-contents.v4.json", "report-artifacts.v4.json", "report-assurance-profile.v2.json"]) {
    assert.ok(fs.existsSync(path.join(scenarioRoot, "resources/m06", ref)));
  }
});
