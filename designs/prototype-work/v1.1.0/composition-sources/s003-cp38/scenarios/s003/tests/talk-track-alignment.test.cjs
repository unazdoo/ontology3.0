"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (ref) => fs.readFileSync(path.join(root, ref), "utf8");
const json = (ref) => JSON.parse(read(ref));

test("讲解稿对应的 M01 模型配置不再包含企业因子配置页签", () => {
  const configuration = json("resources/m01/model-configuration.v3.json");
  assert.deepEqual(
    configuration.sections.map((section) => section.label),
    ["配置总览", "调节因子配置", "评分权重", "风险分档配置"]
  );
  assert.doesNotMatch(JSON.stringify(configuration), /企业因子配置/);
  assert.match(JSON.stringify(configuration), /独立 T053 人工输入快照/);
});

test("讲解稿的黑红黄预警收敛为按亮灯一企一条行动候选", () => {
  const results = json("resources/m01/c035-risk-results.v2.json");
  const lit = results.results.filter((result) => ["YELLOW", "RED", "BLACK"].includes(result.riskTier.tierId));
  const green = results.results.filter((result) => result.riskTier.tierId === "GREEN");
  assert.equal(lit.length, 5);
  assert.equal(green.length, 16);
  assert.ok(lit.every((result) => result.dispositionCandidates.length === 1));
  assert.ok(lit.every((result) => result.dispositionCandidates[0].trigger?.type === "RISK_TIER"));
  assert.ok(green.every((result) => result.dispositionCandidates.length === 0));
  assert.doesNotMatch(JSON.stringify(results), /S003_FACTOR_EMERGENCY/);
});

test("讲解稿的行动路由为成员单位接口人两阶段确认，不回退集团统一收件", () => {
  const binding = json("resources/m04/decision-binding.v2.json");
  const routing = json("resources/m04/enterprise-contact-routing.v1.json");
  const decisionService = read("domain/decision-service.js");
  const dashboard = read("app.js");
  const reportCenter = read("../../report-center/review-lifecycle/app.js");

  assert.equal(binding.confirmationActor, "成员单位债务风险接口人");
  assert.equal(binding.todoCreatedOnlyAfterRecipientConfirmation, true);
  assert.equal(binding.automaticCreation, false);
  assert.equal(binding.routing.missingRoutePolicy, "FAIL_CLOSED");
  assert.equal(binding.routing.fallbackToGroupAdministrator, false);
  assert.ok(routing.routes.every((route) => route.decisionRecipient.role === "成员单位债务风险接口人"));
  assert.match(decisionService, /status: "awaiting-member-unit-confirmation"/);
  assert.match(decisionService, /owner: null/);
  assert.match(decisionService, /todoId: null/);
  assert.match(decisionService, /成员单位债务风险接口人/);
  assert.match(dashboard, /按亮灯逐户形成预警入口/);
  assert.match(dashboard, /直接送达对应成员单位债务风险接口人/);
  assert.match(reportCenter, /已送达成员单位接口人/);
  assert.doesNotMatch(reportCenter, /集团管理员统一收件|自动推送至|提交审批/);
});
