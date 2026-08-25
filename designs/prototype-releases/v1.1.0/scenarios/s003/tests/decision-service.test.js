"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const servicePath = path.join(scenarioRoot, "domain", "decision-service.js");
const service = require(servicePath);
const foundation = require(path.join(scenarioRoot, "..", "..", "foundation", "ofw-scenario-foundation.js"));
const c035ResultSet = require(path.join(scenarioRoot, "resources", "m01", "c035-risk-results.v1.json"));
const currentC035ResultSet = require(path.join(scenarioRoot, "resources", "m01", "c035-risk-results.v2.json"));
const binding = require(path.join(scenarioRoot, "resources", "m04", "decision-binding.v1.json"));
const enterpriseContactRouting = require(path.join(scenarioRoot, "resources", "m04", "enterprise-contact-routing.v1.json"));

const scenarioContext = Object.freeze(c035ResultSet.scenarioIdentity);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createService(overrides) {
  return service.createDecisionService({
    scenarioContext,
    c035Results: c035ResultSet,
    publicationStatus: "PUBLISHED",
    now: () => "2026-08-15T14:20:00.000Z",
    ...(overrides || {})
  });
}

function firstCandidate() {
  return c035ResultSet.results
    .flatMap((result) => result.dispositionCandidates || [])[0];
}

function createCurrentService(overrides) {
  return service.createDecisionService({
    scenarioContext: currentC035ResultSet.scenarioIdentity,
    c035Results: currentC035ResultSet,
    enterpriseContactRouting,
    publicationStatus: "PUBLISHED",
    now: () => "2026-08-17T16:40:00.000Z",
    ...(overrides || {})
  });
}

function firstCurrentCandidate() {
  return currentC035ResultSet.results
    .flatMap((result) => result.dispositionCandidates || [])[0];
}

test("暴露 CommonJS/浏览器 API，并保持通用决策合同边界", () => {
  assert.equal(typeof service.createDecisionService, "function");
  assert.deepEqual(service.IDEMPOTENCY_FIELDS, binding.idempotencyKey);
  assert.deepEqual(service.ACTION_TYPE_IDS, [
    "S003_RISK_FOLLOW_UP",
    "S003_SPECIAL_DISPOSAL",
    "S003_EMERGENCY_RESPONSE",
    "S003_FACTOR_EMERGENCY"
  ]);
  const browserContext = {OFWScenarioFoundation: foundation};
  vm.runInNewContext(fs.readFileSync(servicePath, "utf8"), browserContext, {filename: "decision-service.js"});
  assert.equal(typeof browserContext.S003DecisionService.createDecisionService, "function");
  assert.equal(service.SUBMISSION_SCHEMA_VERSION, "ofw.s003.m04.submission-receipt.v1");
  assert.equal(service.MEMBER_CONFIRMATION_SCHEMA_VERSION, "ofw.s003.m04.member-confirmation-receipt.v1");
});

test("当前 v2 流程由驾驶舱提交 C011，owner/todo 必须保持为空并直达成员单位接口人", () => {
  const decision = createCurrentService();
  const candidate = firstCurrentCandidate();
  const receipt = decision.submitActionRequest(candidate.candidateId, {
    submittedBy: "集团债务风险管理人员",
    note: "请成员单位核实亮灯预警。",
    submittedAt: "2026-08-17T16:41:00.000Z"
  });

  assert.equal(receipt.schemaVersion, "ofw.s003.m04.submission-receipt.v1");
  assert.equal(receipt.stage, "submitted");
  assert.equal(receipt.created, true);
  assert.equal(receipt.sideEffects.actionRequestCreated, true);
  assert.equal(receipt.sideEffects.todoCreated, false);
  assert.equal(receipt.sideEffects.routedToMemberUnit, true);
  assert.equal(receipt.actionRequest.status, "awaiting-member-unit-confirmation");
  assert.equal(receipt.actionRequest.contractCode, "C011");
  assert.equal(receipt.actionRequest.owner, null);
  assert.equal(receipt.actionRequest.ownerId, null);
  assert.equal(receipt.actionRequest.todoId, null);
  assert.equal(receipt.actionRequest.todo, null);
  assert.equal(receipt.todo, null);
  assert.equal(receipt.actionRequest.confirmed, false);
  assert.equal(receipt.actionRequest.decisionRecipient.role, "成员单位债务风险接口人");
  assert.equal(receipt.actionRequest.decisionRecipient.recipientId, "S003-CONTACT-007");
  assert.equal(decision.listActionRequests().length, 1);
  assert.equal(decision.listActionRequests()[0].stage, "submitted");
});

test("当前 v2 预警候选严格按黄灯、红灯、黑灯亮灯形成一企一条，不以诊断建议筛选", () => {
  const decision = createCurrentService();
  const candidates = decision.listCandidates();
  const litResults = currentC035ResultSet.results.filter((result) => result.riskTier?.tierId !== "GREEN");
  assert.equal(candidates.length, litResults.length);
  assert.deepEqual(
    candidates.map((candidate) => candidate.enterpriseId).sort(),
    litResults.map((result) => result.enterprise.enterpriseId).sort()
  );
  assert.ok(candidates.every((candidate) => ["YELLOW", "RED", "BLACK"].includes(candidate.riskTier)));
  assert.ok(candidates.every((candidate) => candidate.trigger?.type === "RISK_TIER"));
  assert.ok(candidates.every((candidate) => candidate.requiresHumanConfirmation === true));
  assert.ok(candidates.every((candidate) => candidate.autoCreateActionRequest === false && candidate.autoCreateTodo === false));
  assert.equal(candidates.filter((candidate) => candidate.actionTypeId === "S003_FACTOR_EMERGENCY").length, 0);
});

test("成员单位接口人确认并选择负责人后才生成负责人待办，且不重复创建 C011", () => {
  const decision = createCurrentService();
  const candidate = firstCurrentCandidate();
  const submission = decision.submitActionRequest(candidate.candidateId, {
    submittedBy: "集团债务风险管理人员",
    submittedAt: "2026-08-17T16:41:00.000Z"
  });
  const receipt = decision.confirmMemberUnitActionRequest(candidate.candidateId, {
    confirmed: true,
    recipientId: submission.actionRequest.decisionRecipient.recipientId,
    recipientName: submission.actionRequest.decisionRecipient.recipientName,
    owner: "风电测试公司07债务风险责任人",
    ownerId: "S003-ENT-007-DEBT-RISK-OWNER",
    note: "成员单位接口人已核实并完成分办。",
    confirmedAt: "2026-08-17T16:42:00.000Z"
  });

  assert.equal(receipt.schemaVersion, "ofw.s003.m04.member-confirmation-receipt.v1");
  assert.equal(receipt.stage, "confirmed");
  assert.equal(receipt.sideEffects.actionRequestCreated, false);
  assert.equal(receipt.sideEffects.todoCreated, true);
  assert.equal(receipt.actionRequest.actionRequestId, submission.actionRequest.actionRequestId);
  assert.equal(receipt.actionRequest.status, "confirmed-to-owner-todo");
  assert.equal(receipt.actionRequest.owner, "风电测试公司07债务风险责任人");
  assert.equal(receipt.actionRequest.confirmedBy, "风电测试公司07债务风险接口人");
  assert.equal(receipt.todo.target, "负责人待办");
  assert.equal(receipt.todo.owner, "风电测试公司07债务风险责任人");
  assert.equal(receipt.todo.actionRequestId, submission.actionRequest.actionRequestId);
  assert.equal(decision.listActionRequests()[0].stage, "confirmed");
});

test("当前 v2 两阶段流程保持幂等，确认前、错收件人和缺路由均 fail-closed", () => {
  const decision = createCurrentService();
  const candidate = firstCurrentCandidate();

  assert.throws(
    () => decision.confirmMemberUnitActionRequest(candidate.candidateId, {
      confirmed: true,
      owner: "风电测试公司07债务风险责任人"
    }),
    (error) => error.code === "S003_DECISION_ACTION_REQUEST_REQUIRED"
  );
  assert.throws(
    () => decision.submitActionRequest(candidate.candidateId, {owner: "不得在驾驶舱指定"}),
    (error) => error.code === "S003_DECISION_SUBMISSION_STAGE_VIOLATION"
  );

  const first = decision.submitActionRequest(candidate.candidateId, {submittedBy: "集团债务风险管理人员"});
  const duplicate = decision.submitActionRequest(candidate.candidateId, {submittedBy: "另一提交人不得覆盖"});
  assert.equal(duplicate.idempotent, true);
  assert.equal(duplicate.sideEffects.actionRequestCreated, false);
  assert.equal(duplicate.actionRequest.actionRequestId, first.actionRequest.actionRequestId);
  assert.equal(duplicate.actionRequest.submittedBy, "集团债务风险管理人员");

  assert.throws(
    () => decision.confirmMemberUnitActionRequest(candidate.candidateId, {
      confirmed: true,
      recipientId: "S003-CONTACT-999",
      owner: "风电测试公司07债务风险责任人"
    }),
    (error) => error.code === "S003_DECISION_RECIPIENT_MISMATCH"
  );

  assert.throws(
    () => service.createDecisionService({
      scenarioContext: currentC035ResultSet.scenarioIdentity,
      c035Results: currentC035ResultSet,
      publicationStatus: "PUBLISHED"
    }),
    (error) => error.code === "S003_DECISION_ROUTING_REQUIRED"
  );
});

test("当前 v2 历史查看、恢复与回归均禁止提交 C011 或确认形成待办", () => {
  for (const status of ["historical-readonly", "restored", "regression"]) {
    const scenarioContext = {...currentC035ResultSet.scenarioIdentity, status};
    const c035Results = clone(currentC035ResultSet);
    c035Results.scenarioIdentity = {...c035Results.scenarioIdentity, status};
    c035Results.results.forEach((result) => {
      result.scenarioIdentity = {...result.scenarioIdentity, status};
    });
    const routing = clone(enterpriseContactRouting);
    routing.scenarioIdentity = {...routing.scenarioIdentity, status};
    const decision = createCurrentService({scenarioContext, c035Results, enterpriseContactRouting: routing, mode: status});
    assert.throws(
      () => decision.submitActionRequest(decision.listCandidates()[0].candidateId),
      (error) => error.code === "S003_DECISION_SIDE_EFFECT_DISABLED",
      status
    );
  }
});

test("默认只暴露待人工确认候选，不自动创建 Action Request 或待办", () => {
  const query = createService();
  const candidates = query.listCandidates();
  assert.equal(candidates.length, 9);
  assert.ok(candidates.every((candidate) => candidate.status === "CANDIDATE_AWAITING_HUMAN_CONFIRMATION"));
  assert.ok(candidates.every((candidate) => candidate.requiresHumanConfirmation === true));
  assert.equal(query.listConfirmed().length, 0);
  assert.equal(Object.isFrozen(candidates), true);
  assert.equal(Object.isFrozen(candidates[0]), true);
});

test("明确人工确认后只创建一个 Action Request 和一个负责人待办", () => {
  const decision = createService();
  const candidate = firstCandidate();
  const receipt = decision.confirmCandidate(candidate.candidateId, {
    confirmed: true,
    owner: "集团债务风险负责人",
    note: "请核对本轮风险证据并安排跟踪。",
    confirmedAt: "2026-08-15T14:21:00.000Z"
  });

  assert.equal(receipt.created, true);
  assert.equal(receipt.idempotent, false);
  assert.equal(receipt.sideEffects.actionRequestCreated, true);
  assert.equal(receipt.sideEffects.todoCreated, true);
  assert.equal(receipt.sideEffects.notificationSent, false);
  assert.equal(receipt.sideEffects.externalDispatch, false);
  assert.equal(receipt.actionRequest.schemaVersion, "ofw.s003.m04.action-request.v1");
  assert.equal(receipt.actionRequest.owner, "集团债务风险负责人");
  assert.equal(receipt.actionRequest.confirmed, true);
  assert.equal(receipt.actionRequest.automatic, false);
  assert.equal(receipt.actionRequest.multiLevelApproval, false);
  assert.equal(receipt.actionRequest.multiUserPermissionModel, false);
  assert.equal(receipt.todo.schemaVersion, "ofw.s003.m04.owner-todo.v1");
  assert.equal(receipt.todo.target, "负责人待办");
  assert.equal(receipt.todo.owner, "集团债务风险负责人");
  assert.equal(receipt.todo.approvalRequired, false);
  assert.equal(receipt.actionRequest.todoId, receipt.todo.todoId);
  assert.equal(decision.listConfirmed().length, 1);
});

test("相同幂等键重复确认不产生第二条记录并返回原始身份", () => {
  const decision = createService();
  const candidate = firstCandidate();
  const confirmation = {
    confirmed: true,
    owner: "集团债务风险负责人",
    note: "首次确认",
    confirmedAt: "2026-08-15T14:22:00.000Z"
  };
  const first = decision.confirmCandidate(candidate.candidateId, confirmation);
  const second = decision.confirmCandidate(candidate.candidateId, {
    confirmed: true,
    owner: "另一名不应覆盖的人员",
    note: "重复确认不得覆盖既有记录",
    confirmedAt: "2026-08-15T14:23:00.000Z"
  });

  assert.equal(first.actionRequest.actionRequestId, second.actionRequest.actionRequestId);
  assert.equal(first.todo.todoId, second.todo.todoId);
  assert.equal(second.created, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.sideEffects.actionRequestCreated, false);
  assert.equal(second.sideEffects.todoCreated, false);
  assert.equal(decision.listConfirmed().length, 1);
  assert.equal(decision.listConfirmed()[0].actionRequest.owner, "集团债务风险负责人");
});

test("existingRecords 可跨服务实例恢复幂等状态", () => {
  const firstService = createService();
  const candidate = firstCandidate();
  const first = firstService.confirmCandidate(candidate.candidateId, {
    confirmed: true,
    owner: "集团债务风险负责人",
    note: "跨实例验证",
    confirmedAt: "2026-08-15T14:24:00.000Z"
  });
  const restored = createService({existingRecords: [first]});
  const replay = restored.confirmCandidate(candidate.candidateId, {
    confirmed: true,
    owner: "不应被覆盖",
    note: "重复确认",
    confirmedAt: "2026-08-15T14:25:00.000Z"
  });
  assert.equal(replay.idempotent, true);
  assert.equal(replay.created, false);
  assert.equal(replay.actionRequest.actionRequestId, first.actionRequest.actionRequestId);
  assert.equal(restored.listConfirmed().length, 1);
});

test("缺 owner、未确认、非法 note 和不支持权限字段均阻断", () => {
  const decision = createService();
  const candidate = firstCandidate();
  assert.throws(
    () => decision.confirmCandidate(candidate.candidateId, {confirmed: true, note: "缺负责人"}),
    (error) => error.code === "S003_DECISION_INVALID_CONFIRMATION"
  );
  assert.throws(
    () => decision.confirmCandidate(candidate.candidateId, {confirmed: false, owner: "集团债务风险负责人"}),
    (error) => error.code === "S003_DECISION_CONFIRMATION_REQUIRED"
  );
  assert.throws(
    () => decision.confirmCandidate(candidate.candidateId, {confirmed: true, owner: "集团债务风险负责人", note: 42}),
    (error) => error.code === "S003_DECISION_INVALID_CONFIRMATION"
  );
  assert.throws(
    () => decision.confirmCandidate(candidate.candidateId, {confirmed: true, owner: "集团债务风险负责人", note: "x".repeat(2001)}),
    (error) => error.code === "S003_DECISION_INVALID_CONFIRMATION"
  );
  assert.throws(
    () => decision.confirmCandidate(candidate.candidateId, {confirmed: true, owner: "集团债务风险负责人", approver: "A"}),
    (error) => error.code === "S003_DECISION_UNSUPPORTED_AUTHORITY"
  );
  assert.equal(decision.listConfirmed().length, 0);
});

test("历史查看、restored 和 regression 轮次禁止所有副作用", () => {
  const historicalContext = {...scenarioContext, status: "historical-readonly"};
  const historical = createService({scenarioContext: historicalContext});
  assert.equal(historical.listCandidates().length, 9);
  assert.throws(
    () => historical.confirmCandidate(firstCandidate().candidateId, {confirmed: true, owner: "集团债务风险负责人"}),
    (error) => error.code === "S003_DECISION_SIDE_EFFECT_DISABLED"
  );

  const restoredContext = {...scenarioContext, status: "restored"};
  const restored = createService({scenarioContext: restoredContext, mode: "restored"});
  assert.equal(restored.listCandidates().length, 9);
  assert.throws(
    () => restored.confirmCandidate(firstCandidate().candidateId, {confirmed: true, owner: "集团债务风险负责人"}),
    (error) => error.code === "S003_DECISION_SIDE_EFFECT_DISABLED"
  );
  assert.equal(restored.listConfirmed().length, 0);

  const regressionContext = {...scenarioContext, scenarioRunId: "S003-RUN-20260815133100000-deadbeef1234", status: "regression"};
  const regressionResults = clone(c035ResultSet);
  regressionResults.scenarioIdentity = {...regressionResults.scenarioIdentity, ...regressionContext};
  regressionResults.results.forEach((result) => {
    result.scenarioIdentity = {...result.scenarioIdentity, ...regressionContext};
    result.dispositionCandidates = (result.dispositionCandidates || []).map((candidate) => ({
      ...candidate,
      idempotencyKey: candidate.idempotencyKey.replace(scenarioContext.scenarioRunId, regressionContext.scenarioRunId)
    }));
  });
  const regression = createService({
    scenarioContext: regressionContext,
    c035Results: regressionResults,
    mode: "isolated-regression"
  });
  assert.throws(
    () => regression.confirmCandidate(regression.listCandidates()[0].candidateId, {confirmed: true, owner: "集团债务风险负责人"}),
    (error) => error.code === "S003_DECISION_SIDE_EFFECT_DISABLED"
  );
  assert.equal(regression.listConfirmed().length, 0);
});

test("错误场景身份、Draft、错 runId、重复候选和副作用候选均被拒绝", () => {
  assert.throws(
    () => createService({
      scenarioContext: {...scenarioContext, scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-20260815133000000-abcdef123456"}
    }),
    (error) => error.code === "S003_DECISION_SCENARIO_MISMATCH"
  );

  const draft = clone(c035ResultSet);
  draft.results[0].modelIdentity.lifecycleStatus = "draft";
  assert.throws(
    () => createService({c035Results: draft}),
    (error) => error.code === "S003_DECISION_SOURCE_NOT_PUBLISHED"
  );

  const wrongRun = clone(c035ResultSet);
  wrongRun.results[0].scenarioIdentity.scenarioRunId = "S003-RUN-20260815133200000-111111111111";
  assert.throws(
    () => createService({c035Results: wrongRun}),
    (error) => error.code === "S003_DECISION_SCENARIO_MISMATCH"
  );

  const duplicate = clone(c035ResultSet);
  const candidate = duplicate.results.find((result) => result.dispositionCandidates.length).dispositionCandidates[0];
  duplicate.results.find((result) => result.dispositionCandidates.length).dispositionCandidates.push(clone(candidate));
  assert.throws(
    () => createService({c035Results: duplicate}),
    (error) => error.code === "S003_DECISION_DUPLICATE_CANDIDATE"
  );

  const sideEffect = clone(c035ResultSet);
  const sideEffectCandidate = sideEffect.results.find((result) => result.dispositionCandidates.length).dispositionCandidates[0];
  sideEffectCandidate.actionRequestId = "AR-ALREADY-CREATED";
  assert.throws(
    () => createService({c035Results: sideEffect}),
    (error) => error.code === "S003_DECISION_SIDE_EFFECT_SOURCE"
  );
});
