"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const builder = require("../scripts/build-report-assets.cjs");
const root = path.resolve(__dirname, "..");

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function digest(ref) {
  return sha256(fs.readFileSync(path.join(root, ref)));
}

function serializedDigest(value) {
  return sha256(Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8"));
}

test("CP06 immutable report resources remain hash locked", () => {
  for (const ref of [
    "resources/m06/report-contract.v1.json",
    "resources/m06/report-contents.v1.json",
    "resources/m06/report-artifacts.v1.json",
    "resources/m06/report-manifest.v1.json",
    "evidence/CP06-report-validation.md"
  ]) {
    const sidecar = fs.readFileSync(path.join(root, ref + ".sha256"), "utf8");
    assert.equal(sidecar, digest(ref) + "  " + path.basename(ref) + "\n");
  }
});

test("manifest traces all 21 reports to exact content and artifact hashes", () => {
  const manifest = readJson("resources/m06/report-manifest.v1.json");
  const contents = readJson("resources/m06/report-contents.v1.json");
  const artifacts = readJson("resources/m06/report-artifacts.v1.json");
  assert.equal(manifest.reportCount, 21);
  assert.equal(contents.reportCount, 21);
  assert.equal(artifacts.artifactCount, 21);
  assert.deepEqual(manifest.summary.riskTierCounts, {GREEN: 16, YELLOW: 4, RED: 1, BLACK: 0});
  assert.equal(manifest.scenarioIdentity.scenarioVersion, "S003-v1");
  assert.equal(manifest.prototypeVersion, "1.1.0");
  assert.equal(manifest.scenarioIdentity.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
  assert.equal(manifest.collections.contents.sha256, digest("resources/m06/report-contents.v1.json"));
  assert.equal(manifest.collections.artifacts.sha256, digest("resources/m06/report-artifacts.v1.json"));

  const contentById = new Map(contents.reports.map(function (entry) {
    return [entry.reportId, entry];
  }));
  const artifactByReportId = new Map(artifacts.artifacts.map(function (entry) {
    return [entry.reportId, entry];
  }));
  for (const entry of manifest.reports) {
    const content = contentById.get(entry.reportId);
    const artifact = artifactByReportId.get(entry.reportId);
    assert.ok(content);
    assert.ok(artifact);
    assert.equal(content.contentSha256, serializedDigest(content.content));
    assert.equal(entry.contentSha256, content.contentSha256);
    assert.equal(artifact.contentSha256, content.contentSha256);
    assert.equal(artifact.artifactSha256, sha256(Buffer.from(artifact.html, "utf8")));
    assert.equal(entry.artifactSha256, artifact.artifactSha256);
    assert.equal(entry.scenarioIdentity.scenarioVersion, "S003-v1");
    assert.equal(entry.prototypeVersion, "1.1.0");
    assert.equal(entry.deepLink.parameters.scenarioRunId, manifest.scenarioIdentity.scenarioRunId);
    assert.equal(entry.deepLink.parameters.scenarioVersion, "S003-v1");
    assert.equal(entry.deepLink.parameters.prototypeVersion, "1.1.0");
  }
});

test("formal report content carries complete business details and evidence", () => {
  const contents = readJson("resources/m06/report-contents.v1.json");
  for (const entry of contents.reports) {
    const report = entry.content;
    assert.equal(report.indicatorDetails.length, 15);
    assert.equal(report.adjustmentFactors.length, 6);
    assert.ok(report.keyIndicators.length <= 3);
    assert.ok(report.ruleExplanations.length >= 6);
    assert.ok(report.evidenceReferences.some(function (evidence) {
      return evidence.evidenceType === "C035_RESULT" && /^[a-f0-9]{64}$/.test(evidence.sha256);
    }));
    assert.ok(report.evidenceReferences.some(function (evidence) {
      return evidence.evidenceType === "PUBLISHED_RISK_FACT" && /^[a-f0-9]{64}$/.test(evidence.sha256);
    }));
    assert.equal(report.generationPolicy.clientSideScoreRecalculation, false);
  }
});

test("report generation adds no module, Agent, Action Request, todo or notification", () => {
  const manifest = readJson("resources/m06/report-manifest.v1.json");
  assert.equal(manifest.moduleId, "M06");
  assert.equal(manifest.invariants.dedicatedFirstLevelModuleCreated, false);
  assert.equal(manifest.invariants.dedicatedAgentRequired, false);
  assert.equal(manifest.summary.actionRequestsCreatedByReportGeneration, 0);
  assert.equal(manifest.summary.todosCreatedByReportGeneration, 0);
  assert.equal(manifest.summary.notificationsDispatchedByReportGeneration, 0);
});

test("immutable writer is idempotent and refuses mismatched existing resources", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "s003-report-assets-"));
  try {
    const bytes = Buffer.from("{\"ok\":true}\n", "utf8");
    builder.writeOrVerifyAtRoot(tempRoot, "resources/test.json", bytes, false);
    builder.writeOrVerifyAtRoot(tempRoot, "resources/test.json", bytes, false);
    assert.throws(function () {
      builder.writeOrVerifyAtRoot(
        tempRoot,
        "resources/test.json",
        Buffer.from("{\"ok\":false}\n", "utf8"),
        false
      );
    }, /拒绝覆盖/);
    assert.equal(fs.readFileSync(path.join(tempRoot, "resources/test.json"), "utf8"), "{\"ok\":true}\n");
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
});
