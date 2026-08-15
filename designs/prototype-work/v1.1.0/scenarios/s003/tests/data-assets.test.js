"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const packageRoot = path.resolve(__dirname, "..");
const fixture = require("../fixtures/enterprise-fixture.v1.json");
const contract = require("../resources/m02/data-contract.v1.1.json");
const source = require("../resources/m02/source-asset.v1.json");
const humanInput = require("../resources/m02/human-input-snapshot.v1.json");
const candidate = require("../resources/m02/formal-candidate-data-asset.v1.json");
const quality = require("../resources/m02/quality-result.v1.json");
const pipeline = require("../resources/m02/pipeline-run.v1.json");

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("权威工作簿身份、评估上下文和两个逻辑成员被锁定", () => {
  const workbookPath = "/Users/domi/Public/Vibecoding/ontology3.0/outputs/019fe492-60b5-70e3-a8d2-f5f1844b27da/企业债务风险评估模版_S003兼容版.xlsx";
  assert.equal(sha256File(workbookPath), source.sourceSha256);
  assert.deepEqual(source.logicalMembers.map((member) => member.name), ["财务数据", "调节因子"]);
  assert.equal(candidate.assessmentAt, "2025-12-31");
  assert.equal(candidate.currency, "CNY");
  assert.equal(candidate.amountUnit, "元");
});

test("21 家企业、类别分布和稳定测试夹具 ID 完整", () => {
  assert.equal(fixture.enterpriseCount, 21);
  assert.equal(candidate.enterpriseCount, 21);
  const ids = fixture.enterprises.map((enterprise) => enterprise.enterpriseId);
  assert.equal(new Set(ids).size, 21);
  assert.equal(ids[0], "S003-ENT-001");
  assert.equal(ids[20], "S003-ENT-021");
  const counts = Object.fromEntries(
    Object.entries(Object.groupBy(fixture.enterprises, (enterprise) => enterprise.category)).map(([key, values]) => [key, values.length])
  );
  assert.deepEqual(counts, {"新能源产业-风电": 13, "在建企业": 3, "环保": 4, "核电": 1});
});

test("环保和在建企业的电价因子明确为 NOT_APPLICABLE", () => {
  const records = humanInput.records.filter((record) => ["环保", "在建企业"].includes(record.category));
  assert.equal(records.length, 7);
  records.forEach((record) => {
    const electricity = record.values.find((value) => value.factorName === "电价波动率");
    assert.equal(electricity.state, "NOT_APPLICABLE");
    assert.equal(electricity.normalizedValue, null);
  });
  assert.equal(humanInput.stateCounts.NOT_APPLICABLE, 7);
});

test("M02 质量只校验数据，不拥有评分模型业务参数", () => {
  assert.equal(quality.status, "passed");
  assert.ok(quality.checks.every((check) => check.status === "passed"));
  ["风险评分", "因子系数", "评分权重", "风险阈值", "风险分档命中"].forEach((name) => {
    assert.ok(quality.explicitlyExcludedChecks.includes(name));
  });
  assert.ok(pipeline.forbiddenOperationsConfirmedAbsent.includes("风险评分"));
  assert.equal(candidate.consumptionPolicy.directM03M04M05M06Consumption, false);
  assert.equal(contract.forbiddenCompatibilityAsset.consumable, false);
  assert.equal(contract.forbiddenCompatibilityAsset.mayBePromotedInPlace, false);
});

