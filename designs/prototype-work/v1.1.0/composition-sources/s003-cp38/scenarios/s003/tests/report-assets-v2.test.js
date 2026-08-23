"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

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
  return sha256(Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

test("v2 report resources and the earlier CP14 v1 resources remain hash locked", () => {
  const refs = [
    "resources/m06/report-manifest.v1.json",
    "resources/m06/report-contents.v1.json",
    "resources/m06/report-artifacts.v1.json",
    "resources/m06/report-manifest.v2.json",
    "resources/m06/report-contents.v2.json",
    "resources/m06/report-artifacts.v2.json"
  ];
  for (const ref of refs) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), ref);
  }
});

test("v2 definition and template contain all nine formal report chapters", () => {
  const definition = readJson("resources/m06/report-definition.v2.json");
  const template = readJson("resources/m06/report-template.v2.json");
  assert.equal(definition.definitionVersion, "1.1.0");
  assert.equal(template.templateVersion, "1.1.0");
  assert.equal(definition.requiredSections.length, 9);
  assert.equal(template.sections.length, 9);
  for (const sectionId of ["key-risk-diagnosis", "risk-strategy", "three-month-plan", "verification-and-evidence"]) {
    assert.ok(definition.requiredSections.includes(sectionId));
    assert.ok(template.sections.some((item) => item.sectionId === sectionId && item.required === true));
  }
  assert.equal(template.download.formalHtml, true);
  assert.equal(template.download.printToPdf, true);
});

test("all 21 v2 contents and downloaded HTML artifacts carry diagnosis strategy and three-month actions", () => {
  const manifest = readJson("resources/m06/report-manifest.v2.json");
  const contents = readJson("resources/m06/report-contents.v2.json");
  const artifacts = readJson("resources/m06/report-artifacts.v2.json");
  assert.equal(manifest.reportCount, 21);
  assert.equal(contents.reportCount, 21);
  assert.equal(artifacts.artifactCount, 21);
  assert.equal(manifest.invariants.previousV1EvidenceUntouched, true);
  const contentById = new Map(contents.reports.map((item) => [item.reportId, item]));
  const artifactById = new Map(artifacts.artifacts.map((item) => [item.reportId, item]));
  for (const entry of manifest.reports) {
    const contentEntry = contentById.get(entry.reportId);
    const artifact = artifactById.get(entry.reportId);
    assert.ok(contentEntry);
    assert.ok(artifact);
    assert.equal(contentEntry.content.contentVersion, "1.1.0");
    assert.equal(contentEntry.content.chapterOrder.length, 9);
    assert.equal(contentEntry.content.threeMonthActionPlan.length, 3);
    assert.ok(contentEntry.content.keyRiskDiagnosis.indicatorItems.length <= 3);
    assert.ok(contentEntry.content.responseStrategy.indicatorStrategies.length <= 3);
    assert.equal(contentEntry.content.verificationSummary.passedCount, 8);
    assert.equal(contentEntry.content.generationPolicy.createsActionRequest, false);
    assert.equal(contentEntry.contentSha256, serializedDigest(contentEntry.content));
    assert.equal(artifact.contentSha256, contentEntry.contentSha256);
    assert.equal(artifact.artifactSha256, sha256(Buffer.from(artifact.html, "utf8")));
    for (const token of ["关键风险诊断说明", "风险应对策略与改善建议", "未来三个月行动建议", "风险触发与行动状态", "核验、版本与证据"]) {
      assert.match(artifact.html, new RegExp(token));
    }
  }
});

test("v3 immutable correction remains hash locked and aligns every diagnosis actual value with indicator details", () => {
  const refs = [
    "resources/m06/report-manifest.v1.json",
    "resources/m06/report-contents.v1.json",
    "resources/m06/report-artifacts.v1.json",
    "resources/m06/report-manifest.v2.json",
    "resources/m06/report-contents.v2.json",
    "resources/m06/report-artifacts.v2.json",
    "resources/m06/report-manifest.v3.json",
    "resources/m06/report-contents.v3.json",
    "resources/m06/report-artifacts.v3.json"
  ];
  for (const ref of refs) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), ref);
  }

  const contents = readJson("resources/m06/report-contents.v3.json");
  const artifacts = readJson("resources/m06/report-artifacts.v3.json");
  assert.equal(contents.contentSetVersion, "1.1.1");
  assert.equal(contents.reportCount, 21);
  assert.equal(artifacts.artifactCount, 21);
  const artifactsByReport = new Map(artifacts.artifacts.map((item) => [item.reportId, item]));
  for (const entry of contents.reports) {
    const detailByName = new Map(entry.content.indicatorDetails.map((item) => [item.name, item]));
    for (const diagnosis of entry.content.keyRiskDiagnosis.indicatorItems) {
      const detail = detailByName.get(diagnosis.title);
      assert.ok(detail, `${entry.reportId} / ${diagnosis.title}`);
      assert.notEqual(detail.actualValue, null);
      assert.match(diagnosis.statement, new RegExp(`实际值为 ${String(detail.actualValue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.doesNotMatch(diagnosis.statement, /实际值为\s*未取得/);
    }
    const artifact = artifactsByReport.get(entry.reportId);
    assert.ok(artifact);
    assert.doesNotMatch(artifact.html, /实际值为\s*未取得/);
  }
});

test("current scenario resource registration advances beyond v3 while keeping v1/v2/v3 files available", () => {
  const integration = fs.readFileSync(path.join(root, "integration-config.js"), "utf8");
  const data = fs.readFileSync(path.join(root, "data.js"), "utf8");
  for (const ref of ["report-contract.v2.json", "report-manifest.v9.json", "report-contents.v9.json", "report-artifacts.v9.json"]) {
    assert.match(`${integration}\n${data}`, new RegExp(ref.replaceAll(".", "\\.")));
  }
  for (const ref of ["report-manifest.v1.json", "report-contents.v1.json", "report-artifacts.v1.json", "report-manifest.v2.json", "report-contents.v2.json", "report-artifacts.v2.json", "report-manifest.v3.json", "report-contents.v3.json", "report-artifacts.v3.json"]) {
    assert.ok(fs.existsSync(path.join(root, "resources/m06", path.basename(ref))));
  }
});
