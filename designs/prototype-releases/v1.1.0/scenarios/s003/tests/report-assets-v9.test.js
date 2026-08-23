"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const reportBuilder = require("../scripts/build-report-assets-v9.cjs");
const agentBuilder = require("../scripts/build-agent-position-v7.cjs");
const root = path.resolve(__dirname, "..");

function json(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function digest(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex");
}

const forbidden = /确需处置时由风险管理人员从驾驶舱提交行动申请|重大变化通过驾驶舱提交标准行动申请|人工判断是否提交行动申请|决定是否提交标准行动申请|报告中心仪表盘提出建议/;

test("v9 report resources and M05 binding are deterministic and hash locked", () => {
  reportBuilder.writeReportAssetsV9({ checkOnly: true });
  agentBuilder.writeAgentPositionV7({ checkOnly: true });
  for (const ref of [
    "resources/m06/report-contents.v9.json",
    "resources/m06/report-artifacts.v9.json",
    "resources/m06/report-manifest.v9.json",
    "resources/m06/report-history-index.v4.json",
    "resources/m05/agent-position.v7.json",
    "evidence/M06-report-content-v9-validation.md"
  ]) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), ref);
  }
});

test("v9 uses risk-tier lights as the only alert policy and routes each alert to the member-unit contact", () => {
  const contents = json("resources/m06/report-contents.v9.json");
  const manifest = json("resources/m06/report-manifest.v9.json");
  assert.deepEqual(manifest.summary.riskTierCounts, { GREEN: 16, YELLOW: 4, RED: 1, BLACK: 0 });
  assert.equal(manifest.summary.alertCount, 5);
  assert.equal(manifest.summary.reportsWithDispositionCandidate, 5);
  assert.equal(contents.reportCount, 21);
  for (const entry of contents.reports) {
    const report = entry.content;
    const tierId = report.assessment.riskTier.tierId;
    assert.doesNotMatch(JSON.stringify(report), forbidden, report.reportId);
    if (tierId === "GREEN") {
      assert.equal(report.disposition.candidateCount, 0, report.reportId);
      assert.match(report.responseStrategy.guidance, /绿灯.*不形成预警行动/, report.reportId);
    } else {
      assert.ok(["YELLOW", "RED", "BLACK"].includes(tierId), report.reportId);
      assert.equal(report.disposition.candidateCount, 1, report.reportId);
      assert.match(report.responseStrategy.guidance, /按亮灯形成一条预警行动/, report.reportId);
      assert.match(report.responseStrategy.guidance, /对应成员单位债务风险接口人确认/, report.reportId);
      assert.match(report.responseStrategy.guidance, /接口人确认后再分办本单位负责人/, report.reportId);
    }
  }
});

test("v9 formal HTML and manifest hashes use the same current resources", () => {
  const artifacts = json("resources/m06/report-artifacts.v9.json");
  const manifest = json("resources/m06/report-manifest.v9.json");
  assert.equal(artifacts.artifactCount, 21);
  for (const artifact of artifacts.artifacts) {
    assert.equal(artifact.contentVersion, "1.7.0");
    assert.equal(artifact.artifactVersion, "html-print-capability-v9");
    assert.doesNotMatch(artifact.html, forbidden, artifact.reportId);
  }
  for (const source of Object.values(manifest.source)) {
    assert.equal(source.sha256, digest(source.ref), source.ref);
  }
  for (const collection of Object.values(manifest.collections)) {
    assert.equal(collection.sha256, digest(collection.ref), collection.ref);
  }
});

test("v4 report history has one unique entry per immutable manifest and points to v9", () => {
  const history = json("resources/m06/report-history-index.v4.json");
  const refs = history.versions.map((item) => item.manifestRef);
  assert.equal(history.currentManifestRef, "resources/m06/report-manifest.v9.json");
  assert.equal(history.versionCount, 9);
  assert.equal(new Set(refs).size, refs.length);
  assert.deepEqual(refs, Array.from({ length: 9 }, (_, index) => `resources/m06/report-manifest.v${index + 1}.json`));
  assert.ok(history.versions.slice(0, -1).every((item) => item.status === "historical"));
  assert.equal(history.versions.at(-1).status, "current");
});

test("M05 v7 binds the exact v9 report manifest, content and artifact without adding a dedicated agent", () => {
  const position = json("resources/m05/agent-position.v7.json");
  assert.equal(position.dedicatedAgent, false);
  assert.equal(position.reportBinding.manifestRef, "resources/m06/report-manifest.v9.json");
  assert.equal(position.reportBinding.contentRef, "resources/m06/report-contents.v9.json");
  assert.equal(position.reportBinding.artifactRef, "resources/m06/report-artifacts.v9.json");
  assert.equal(position.reportBinding.manifestVersion, "1.7.0");
  assert.equal(position.reportBinding.manifestSha256, digest(position.reportBinding.manifestRef));
  assert.equal(position.reportBinding.contentSetSha256, digest(position.reportBinding.contentRef));
  assert.equal(position.reportBinding.artifactSetSha256, digest(position.reportBinding.artifactRef));
});
