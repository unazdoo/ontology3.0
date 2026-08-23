"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const CURRENT_RUN_ID = "S003-RUN-20260817163000000-c02200000001";
const CURRENT_OUTPUT_REFS = Object.freeze([
  "resources/m04/decision-binding.v2.json",
  "resources/m04/enterprise-contact-routing.v1.json",
  "resources/m02/c017-decision-projection.v2.json",
  "resources/m01/model-package.v2.json",
  "resources/m01/published-pointer.v2.json",
  "resources/m01/action-type-catalog.v2.json",
  "resources/m01/c035-risk-results.v2.json",
  "resources/m01/evaluation-run.v2.json",
  "resources/m01/published-risk-facts.v2.json",
  "resources/m01/runtime-export.v2.json",
  "resources/m03/query-catalog.v3.json",
  "resources/m03/query-runtime.v2.json",
  "resources/m03/query-results.v2.json",
  "resources/m04/decision-runtime.v2.json",
  "resources/m04/decision-inbox.v3.json",
  "resources/m04/decision-results.v3.json",
  "resources/m06/report-contents.v9.json",
  "resources/m06/report-artifacts.v9.json",
  "resources/m06/report-manifest.v9.json",
  "resources/m06/report-history-index.v4.json",
  "resources/m05/agent-position.v7.json"
]);

function readJson(ref) {
  return JSON.parse(fs.readFileSync(path.join(root, ref), "utf8"));
}

function digest(ref) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, ref))).digest("hex");
}

function assertIdempotencyIdentity(record, enterpriseId, actionTypeId, assessmentAt, resultVersion) {
  assert.equal(
    record.idempotencyKey,
    [CURRENT_RUN_ID, enterpriseId, actionTypeId, assessmentAt, resultVersion].join("|")
  );
  assert.equal(record.idempotencyKey.split("|")[1], enterpriseId);
}

test("当前生成资源和 SHA-256 sidecar 一致，数据装配读取 decision-binding v2", () => {
  for (const ref of CURRENT_OUTPUT_REFS) {
    const sidecar = fs.readFileSync(path.join(root, `${ref}.sha256`), "utf8").trim().split(/\s+/)[0];
    assert.equal(sidecar, digest(ref), `${ref} sidecar 与当前文件不一致`);
  }
  const dataSource = fs.readFileSync(path.join(root, "data.js"), "utf8");
  assert.match(dataSource, /decisionBinding:\s*"\.\/resources\/m04\/decision-binding\.v2\.json"/);
  assert.doesNotMatch(dataSource, /decisionBinding:\s*"\.\/resources\/m04\/decision-binding\.v1\.json"/);
});

test("五条黄红黑亮灯预警严格一企一候选，绿灯不形成行动", () => {
  const riskResults = readJson("resources/m01/c035-risk-results.v2.json");
  const evaluationRun = readJson("resources/m01/evaluation-run.v2.json");
  const decisionResults = readJson("resources/m04/decision-results.v3.json");
  const expected = riskResults.results
    .filter((result) => ["YELLOW", "RED", "BLACK"].includes(result.riskTier.tierId))
    .map((result) => result.enterprise.enterpriseId)
    .sort();
  const candidates = decisionResults.candidatesBeforeConfirmation;
  const actual = candidates.map((candidate) => candidate.enterpriseId).sort();

  assert.deepEqual(expected, ["S003-ENT-007", "S003-ENT-017", "S003-ENT-018", "S003-ENT-019", "S003-ENT-020"]);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, 5);
  assert.equal(riskResults.summary.dispositionCandidateCount, 5);
  assert.equal(evaluationRun.counts.dispositionCandidates, 5);
  assert.equal(decisionResults.candidateSummary.total, 5);
  assert.equal(decisionResults.candidateSummary.oneAlertPerEnterprise, true);
  for (const result of riskResults.results) {
    const expectedCount = ["YELLOW", "RED", "BLACK"].includes(result.riskTier.tierId) ? 1 : 0;
    assert.equal(result.dispositionCandidates.length, expectedCount, result.enterprise.enterpriseId);
    assert.ok(result.dispositionCandidates.every((candidate) => candidate.trigger?.type === "RISK_TIER"), result.enterprise.enterpriseId);
  }
});

test("四条已提交 Action Request 的幂等键与企业身份精确一致", () => {
  const inbox = readJson("resources/m04/decision-inbox.v3.json");
  const decisionResults = readJson("resources/m04/decision-results.v3.json");
  const pending = inbox.requests.map((request) => ({
    enterpriseId: request.subjectId,
    actionTypeId: request.actionType.id,
    assessmentAt: request.metric.evaluatedAt,
    resultVersion: request.sourceResultVersion,
    idempotencyKey: request.idempotencyKey
  }));
  const confirmed = decisionResults.confirmedDecision.actionRequest;
  const submitted = pending.concat({
    enterpriseId: confirmed.enterpriseId,
    actionTypeId: confirmed.actionTypeId,
    assessmentAt: confirmed.assessmentAt,
    resultVersion: confirmed.resultVersion,
    idempotencyKey: confirmed.idempotencyKey
  });

  assert.equal(submitted.length, 4);
  assert.deepEqual(submitted.map((item) => item.enterpriseId).sort(), [
    "S003-ENT-007",
    "S003-ENT-017",
    "S003-ENT-018",
    "S003-ENT-020"
  ]);
  assert.equal(new Set(submitted.map((item) => item.idempotencyKey)).size, 4);
  assert.ok(inbox.requests.every((request) => request.owner === null && request.ownerId === null));
  assert.ok(inbox.requests.every((request) => request.decisionRecipient?.role === "成员单位债务风险接口人"));
  assert.ok(inbox.requests.every((request) => request.recommendedTaskOwner && request.recommendedTaskOwnerId));
  for (const item of submitted) {
    assertIdempotencyIdentity(item, item.enterpriseId, item.actionTypeId, item.assessmentAt, item.resultVersion);
  }
  assert.equal(decisionResults.candidateSummary.actionRequestsCreated, 4);
});

test("当前正式资源不含重大因子独立行动，21 家企业路由唯一完整", () => {
  const routing = readJson("resources/m04/enterprise-contact-routing.v1.json");
  const riskResults = readJson("resources/m01/c035-risk-results.v2.json");
  const currentDocuments = CURRENT_OUTPUT_REFS.map(readJson);
  assert.doesNotMatch(JSON.stringify(currentDocuments), /S003_FACTOR_EMERGENCY/);

  assert.equal(routing.routes.length, 21);
  assert.equal(new Set(routing.routes.map((route) => route.enterpriseId)).size, 21);
  assert.equal(new Set(routing.routes.map((route) => route.memberUnitId)).size, 21);
  assert.equal(new Set(routing.routes.map((route) => route.decisionRecipient.recipientId)).size, 21);
  assert.deepEqual(
    routing.routes.map((route) => route.enterpriseId).sort(),
    riskResults.results.map((result) => result.enterprise.enterpriseId).sort()
  );
  assert.ok(routing.routes.every((route) => route.decisionRecipient.role === "成员单位债务风险接口人"));
});
