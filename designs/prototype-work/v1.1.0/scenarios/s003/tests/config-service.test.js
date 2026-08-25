"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const service = require("../domain/config-service.js");
const modelPackage = require("../resources/m01/model-package.v1.json");

test("从 Published 模型创建 Draft，Draft 不能直接作为 Published 运行配置", () => {
  const draft = service.createDraft(modelPackage, {
    draftId: "S003-MODEL-DRAFT-TEST",
    createdAt: "2026-08-15T13:20:00.000Z"
  });
  assert.equal(draft.lifecycleStatus, "draft");
  assert.equal(draft.editable.factors.length, 6);
  assert.equal(draft.editable.riskTiers.length, 4);
  assert.throws(() => service.publishDraft(draft, modelPackage), /未通过校验/);
});

test("企业当期因子输入不进入模型 Draft 或 Published 定义", () => {
  const enterpriseFactorInputs = {
    "S003-ENT-001": {
      "融资能力（已用授信余额/授信总额）": "一般",
      "担保情况": "未涉及担保"
    }
  };
  const draft = service.createDraft(modelPackage, {
    draftId: "S003-MODEL-DRAFT-WITH-FACTORS",
    enterpriseFactorInputs
  });
  assert.equal(Object.hasOwn(draft.editable, "enterpriseFactorInputs"), false);
  const marked = service.markValidated(draft, {validatedAt: "2026-08-15T13:21:00.000Z"});
  const published = service.publishDraft(marked.draft, modelPackage, {publishedAt: "2026-08-15T13:22:00.000Z"});
  assert.equal(Object.hasOwn(published, "enterpriseFactorInputs"), false);
  assert.equal(Object.hasOwn(modelPackage, "enterpriseFactorInputs"), false);
});
test("合法 Draft 可校验并发布为新版本，基础包保持不变", () => {
  const draft = service.createDraft(modelPackage, {
    draftId: "S003-MODEL-DRAFT-VALID",
    proposedVersion: "1.0.1",
    createdAt: "2026-08-15T13:20:00.000Z"
  });
  const marked = service.markValidated(draft, {validatedAt: "2026-08-15T13:21:00.000Z"});
  assert.equal(marked.validation.ok, true);
  assert.equal(marked.draft.lifecycleStatus, "validated");
  const published = service.publishDraft(marked.draft, modelPackage, {publishedAt: "2026-08-15T13:22:00.000Z"});
  assert.equal(published.packageVersion, "1.0.1");
  assert.equal(published.lifecycleStatus, "published");
  assert.equal(Object.hasOwn(published, "enterpriseFactorInputs"), false);
  assert.equal(modelPackage.packageVersion, "1.0.0");
  assert.equal(Object.isFrozen(published), true);
});

test("权重不等于100、非法系数、风险空档和新增档位均被拒绝", () => {
  const draft = service.createDraft(modelPackage, {draftId: "S003-MODEL-DRAFT-INVALID"});
  draft.editable.weights["环保"][0] = 99;
  draft.editable.factors[0].tiers[0].coefficient = -2;
  draft.editable.riskTiers.find((tier) => tier.tierId === "RED").maxExclusive = 30;
  draft.editable.riskTiers.push({tierId: "BLUE", name: "蓝灯", minInclusive: 90, maxExclusive: 100});
  const result = service.validateDraft(draft);
  assert.equal(result.ok, false);
  const codes = result.errors.map((error) => error.code);
  assert.ok(codes.includes("WEIGHT_SUM_NOT_100"));
  assert.ok(codes.includes("INVALID_FACTOR_COEFFICIENT"));
  assert.ok(codes.includes("INVALID_RISK_TIER_COUNT"));
});
