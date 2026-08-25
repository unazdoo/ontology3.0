"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const servicePath = path.join(scenarioRoot, "domain", "query-service.js");
const serviceModule = require(servicePath);
const scoreEngine = require(path.join(scenarioRoot, "domain", "score-engine.js"));
const foundation = require(path.join(scenarioRoot, "..", "..", "foundation", "ofw-scenario-foundation.js"));
const modelPackage = require(path.join(scenarioRoot, "resources", "m01", "model-package.v2.json"));
const fixture = require(path.join(scenarioRoot, "fixtures", "enterprise-fixture.v1.json"));

const scenarioContext = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
  formedAt: "2026-08-17T16:30:00.000Z",
  status: "active"
});

const scoreContext = Object.freeze({
  scenarioId: scenarioContext.scenarioId,
  scenarioVersion: scenarioContext.scenarioVersion,
  scenarioRunId: scenarioContext.scenarioRunId,
  assessmentAt: fixture.assessmentAt,
  currency: fixture.currency,
  amountUnit: fixture.amountUnit,
  dataVersion: fixture.fixtureId,
  manualInputVersion: "S003-T053-INPUT-20251231-v1",
  publishedVersion: modelPackage.packageVersion,
  resultVersion: "1.0.0"
});

const portfolio = scoreEngine.evaluatePortfolio(fixture, modelPackage, scoreContext);
const queryRuntime = require(path.join(scenarioRoot, "resources", "m03", "query-runtime.v2.json"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createService(overrides) {
  return serviceModule.createQueryService({
    scenarioContext,
    portfolio,
    publicationStatus: "PUBLISHED",
    ...(overrides || {})
  });
}

test("暴露 CommonJS/浏览器 UMD API 和六个固定只读问题", () => {
  assert.equal(typeof serviceModule.createQueryService, "function");
  assert.equal(serviceModule.QUERY_DEFINITIONS.length, 6);
  assert.deepEqual(
    serviceModule.QUERY_DEFINITIONS.map((definition) => definition.queryId),
    ["S003-QRY-001", "S003-QRY-002", "S003-QRY-003", "S003-QRY-004", "S003-QRY-005", "S003-QRY-006"]
  );

  const browserContext = {OFWScenarioFoundation: foundation};
  vm.runInNewContext(fs.readFileSync(servicePath, "utf8"), browserContext, {filename: "query-service.js"});
  assert.equal(typeof browserContext.S003QueryService.createQueryService, "function");
  assert.equal(browserContext.S003QueryService.QUERY_DEFINITIONS.length, 6);
  assert.deepEqual(queryRuntime.queries, clone(serviceModule.QUERY_DEFINITIONS));
  assert.deepEqual(queryRuntime.sideEffects, {
    mutatesPublishedFacts: false,
    createsActionRequest: false,
    createsTodo: false,
    sendsNotification: false
  });
});

test("风险分布只从同轮次 Published Fact/C035 汇总", () => {
  const answer = createService().execute(serviceModule.QUERY_IDS.RISK_DISTRIBUTION);
  assert.equal(answer.readOnly, true);
  assert.equal(answer.mode, "read-only-published-facts");
  assert.deepEqual(answer.scenarioIdentity, {
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: scenarioContext.scenarioRunId
  });
  assert.deepEqual(answer.result.counts, portfolio.summary.riskTierCounts);
  assert.equal(answer.result.total, 21);
  assert.deepEqual(
    answer.result.tiers.map(({tierId, name}) => ({tierId, name})),
    [
      {tierId: "GREEN", name: "绿灯"},
      {tierId: "YELLOW", name: "黄灯"},
      {tierId: "RED", name: "红灯"},
      {tierId: "BLACK", name: "黑灯"}
    ]
  );
  assert.equal(answer.source.c035ResultCount, 21);
  assert.equal(answer.source.publishedFactCount, 21);
});

test("可直接消费 CP03 物化的 C035 结果集和 Published Fact 集", () => {
  const c035ResultSet = require(path.join(scenarioRoot, "resources", "m01", "c035-risk-results.v1.json"));
  const publishedFactSet = require(path.join(scenarioRoot, "resources", "m01", "published-risk-facts.v1.json"));
  const query = serviceModule.createQueryService({
    scenarioContext: c035ResultSet.scenarioIdentity,
    c035Results: c035ResultSet,
    publishedFacts: publishedFactSet
  });
  const answer = query.execute(serviceModule.QUERY_IDS.RISK_DISTRIBUTION);
  assert.equal(answer.result.total, 21);
  assert.deepEqual(answer.result.counts, c035ResultSet.summary.riskTierCounts);
  assert.equal(answer.scenarioIdentity.scenarioRunId, c035ResultSet.scenarioIdentity.scenarioRunId);
});

test("浏览器正式运行可直接消费 published-results 状态的 C035 组合", () => {
  const c035ResultSet = require(path.join(scenarioRoot, "resources", "m01", "c035-risk-results.v2.json"));
  const publishedFactSet = require(path.join(scenarioRoot, "resources", "m01", "published-risk-facts.v2.json"));
  const query = serviceModule.createQueryService({
    scenarioContext: c035ResultSet.scenarioIdentity,
    portfolio: c035ResultSet,
    c035Results: c035ResultSet,
    publishedFacts: publishedFactSet,
    publicationStatus: "PUBLISHED"
  });
  const answer = query.execute(serviceModule.QUERY_IDS.RISK_DISTRIBUTION);
  assert.equal(answer.result.total, 21);
  assert.equal(answer.source.c035ResultCount, 21);
  assert.equal(answer.source.publishedFactCount, 21);
});

test("红黑企业查询只返回 RED/BLACK 并按风险和分值排序", () => {
  const answer = createService().execute("red-black-enterprises");
  assert.ok(answer.result.enterprises.length > 0);
  assert.ok(answer.result.enterprises.every((enterprise) => ["RED", "BLACK"].includes(enterprise.riskTier.tierId)));
  assert.equal(answer.result.enterprises[0].enterpriseId, "S003-ENT-020");
  assert.equal(answer.result.enterprises[0].riskTier.tierId, "RED");
});

test("企业详情和最低三项携带同一 C035 证据身份", () => {
  const query = createService();
  const detail = query.execute(serviceModule.QUERY_IDS.ENTERPRISE_DETAIL, {enterpriseId: "S003-ENT-001"});
  const lowest = query.execute(serviceModule.QUERY_IDS.LOWEST_THREE, {enterpriseId: "S003-ENT-001"});
  const source = portfolio.results.find((result) => result.enterprise.enterpriseId === "S003-ENT-001");

  assert.equal(detail.result.resultId, source.resultId);
  assert.equal(detail.result.finalScore, 59.08);
  assert.equal(detail.result.indicators.length, 15);
  assert.deepEqual(lowest.result.indicators, source.keyRisks);
  assert.equal(lowest.result.count, 3);

  assert.throws(
    () => query.execute(serviceModule.QUERY_IDS.ENTERPRISE_DETAIL),
    (error) => error.code === "S003_QUERY_ENTERPRISE_REQUIRED"
  );
});

test("默认/不适用因子区分 DEFAULTED_ZERO 与 NOT_APPLICABLE", () => {
  const fixtureWithMissing = clone(fixture);
  delete fixtureWithMissing.enterprises[0].factorInputs["担保情况"];
  const portfolioWithMissing = scoreEngine.evaluatePortfolio(fixtureWithMissing, modelPackage, scoreContext);
  const query = createService({portfolio: portfolioWithMissing});

  const defaulted = query.execute(serviceModule.QUERY_IDS.FACTOR_DEFAULTS, {enterpriseId: "S003-ENT-001"});
  assert.equal(defaulted.result.counts.DEFAULTED_ZERO, 1);
  assert.equal(defaulted.result.counts.NOT_APPLICABLE, 0);
  assert.equal(defaulted.result.records[0].factors[0].state, "DEFAULTED_ZERO");

  const notApplicable = query.execute(serviceModule.QUERY_IDS.FACTOR_DEFAULTS, {enterpriseId: "S003-ENT-017"});
  assert.equal(notApplicable.result.counts.NOT_APPLICABLE, 1);
  assert.equal(notApplicable.result.records[0].factors[0].factorId, "electricity-price");
});

test("处置候选保持待人工确认，查询不会创建 Action Request 或待办", () => {
  const sourceBefore = JSON.stringify(portfolio);
  const query = createService();
  const answer = query.execute(serviceModule.QUERY_IDS.DISPOSITION_CANDIDATES);

  assert.ok(answer.result.count > 0);
  for (const candidate of answer.result.candidates) {
    assert.equal(candidate.requiresHumanConfirmation, true);
    assert.equal(candidate.actionRequestId, null);
    assert.equal(candidate.todoId, null);
    assert.equal(candidate.autoCreateActionRequest, false);
    assert.equal(candidate.autoCreateTodo, false);
  }
  assert.deepEqual(answer.sideEffects, {
    mutatesPublishedFacts: false,
    createsActionRequest: false,
    createsTodo: false,
    sendsNotification: false
  });
  assert.equal("createActionRequest" in query, false);
  assert.equal("createTodo" in query, false);
  assert.equal(JSON.stringify(portfolio), sourceBefore, "只读查询不得修改权威来源");
  assert.equal(Object.isFrozen(answer), true);
  assert.equal(Object.isFrozen(answer.result.candidates), true);
});

test("拒绝 Draft、错误 scenarioRunId 和不一致 Published Fact", () => {
  assert.throws(
    () => createService({publicationStatus: "DRAFT"}),
    (error) => error.code === "S003_QUERY_SOURCE_NOT_PUBLISHED"
  );

  const draftPortfolio = clone(portfolio);
  draftPortfolio.results[0].modelIdentity.lifecycleStatus = "draft";
  assert.throws(
    () => createService({portfolio: draftPortfolio}),
    (error) => error.code === "S003_QUERY_SOURCE_NOT_PUBLISHED"
  );

  const wrongRun = clone(portfolio);
  wrongRun.results[0].scenarioIdentity.scenarioRunId = "S003-RUN-20260815153100123-111111111111";
  assert.throws(
    () => createService({portfolio: wrongRun}),
    (error) => error.code === "S003_QUERY_SCENARIO_MISMATCH"
  );

  const inconsistentFact = clone(portfolio);
  inconsistentFact.publishedFacts[0].object.finalScore += 1;
  assert.throws(
    () => createService({portfolio: inconsistentFact}),
    (error) => error.code === "S003_QUERY_FACT_MISMATCH"
  );
});

test("拒绝错误场景身份、未知问题和已混入副作用的候选", () => {
  assert.throws(
    () => serviceModule.createQueryService({
      scenarioContext: {...scenarioContext, scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-20260815153000123-abcdef123456"},
      portfolio,
      publicationStatus: "PUBLISHED"
    }),
    (error) => error.code === "S003_QUERY_SCENARIO_MISMATCH"
  );

  assert.throws(
    () => createService().execute("S003-QRY-999"),
    (error) => error.code === "S003_QUERY_UNKNOWN"
  );

  const sideEffectSource = clone(portfolio);
  const owner = sideEffectSource.results.find((result) => result.dispositionCandidates.length);
  owner.dispositionCandidates[0].actionRequestId = "AR-SHOULD-NOT-BE-HERE";
  assert.throws(
    () => createService({portfolio: sideEffectSource}),
    (error) => error.code === "S003_QUERY_SIDE_EFFECT_SOURCE"
  );
});
