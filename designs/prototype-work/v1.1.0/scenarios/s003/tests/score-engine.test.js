const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const enginePath = path.join(scenarioRoot, "domain", "score-engine.js");
const engine = require(enginePath);
const modelPackage = JSON.parse(fs.readFileSync(
  path.join(scenarioRoot, "resources", "m01", "model-package.v1.json"),
  "utf8"
));
const fixture = JSON.parse(fs.readFileSync(
  path.join(scenarioRoot, "fixtures", "enterprise-fixture.v1.json"),
  "utf8"
));

const runContext = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-TEST-001",
  assessmentAt: fixture.assessmentAt,
  currency: fixture.currency,
  amountUnit: fixture.amountUnit,
  dataVersion: fixture.fixtureId,
  manualInputVersion: "S003-T053-TEST-001",
  publishedVersion: modelPackage.packageVersion,
  resultVersion: "1.0.0"
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function enterprise(id) {
  const found = fixture.enterprises.find((item) => item.enterpriseId === id);
  assert.ok(found, `fixture enterprise ${id} should exist`);
  return clone(found);
}

test("exports the stable CommonJS and browser UMD APIs", () => {
  for (const name of [
    "evaluateEnterprise",
    "evaluatePortfolio",
    "classifyRisk",
    "validateModelPackage",
    "roundLegacyParity"
  ]) {
    assert.equal(typeof engine[name], "function", `${name} should be exported`);
  }

  const source = fs.readFileSync(enginePath, "utf8");
  const browserContext = {};
  vm.runInNewContext(source, browserContext, { filename: "score-engine.js" });
  assert.equal(typeof browserContext.S003ScoreEngine.evaluateEnterprise, "function");
});

test("validates the published package without rewriting legacy non-monotonic anchors", () => {
  const validation = engine.validateModelPackage(modelPackage);
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((warning) => warning.code === "S003_LEGACY_NON_MONOTONIC_ANCHORS"));
});

test("roundLegacyParity follows Python half-even behavior", () => {
  assert.equal(engine.roundLegacyParity(2.675, 2), 2.67);
  assert.equal(engine.roundLegacyParity(1.005, 2), 1);
  assert.equal(engine.roundLegacyParity(2.5, 0), 2);
  assert.equal(engine.roundLegacyParity(3.5, 0), 4);
  assert.equal(engine.roundLegacyParity(-2.5, 0), -2);
});

test("scores wind enterprise 01 with the legacy golden result", () => {
  const result = engine.evaluateEnterprise(enterprise("S003-ENT-001"), modelPackage, runContext);
  assert.equal(result.indicatorResults.length, 15);
  assert.equal(result.rawScore, 84.4);
  assert.equal(result.factorSum, -0.3);
  assert.equal(result.finalScore, 59.08);
  assert.equal(result.riskTier.tierId, "GREEN");
  assert.equal(result.factorStates["electricity-price"], "APPLIED");
  assert.equal(result.lowestThree.length, 3);
  assert.equal(result.reportData.sections.overallRisk.finalScore, 59.08);
});

test("scores wind enterprise 07 and produces candidates without creating actions", () => {
  const result = engine.evaluateEnterprise(enterprise("S003-ENT-007"), modelPackage, runContext);
  assert.equal(result.rawScore, 75.5);
  assert.equal(result.factorSum, -0.5);
  assert.equal(result.finalScore, 37.75);
  assert.equal(result.riskTier.tierId, "YELLOW");
  assert.deepEqual(
    result.dispositionCandidates.map((candidate) => candidate.actionTypeId).sort(),
    ["S003_FACTOR_EMERGENCY", "S003_RISK_FOLLOW_UP"]
  );
  for (const candidate of result.dispositionCandidates) {
    assert.equal(candidate.status, "CANDIDATE_AWAITING_HUMAN_CONFIRMATION");
    assert.equal(candidate.actionRequestId, null);
    assert.equal(candidate.todoId, null);
    assert.equal(candidate.autoCreateActionRequest, false);
    assert.equal(candidate.autoCreateTodo, false);
  }
});

test("uses fixed 60 for construction enterprises and still applies factors", () => {
  const result = engine.evaluateEnterprise(enterprise("S003-ENT-010"), modelPackage, runContext);
  assert.equal(result.isUnderConstruction, true);
  assert.equal(result.rawScore, 60);
  assert.equal(result.factorSum, -0.1);
  assert.equal(result.finalScore, 54);
  assert.equal(result.indicatorResults.length, 15);
  assert.ok(result.indicatorResults.every((item) => item.marker === "UNDER_CONSTRUCTION_FIXED_60"));
  assert.equal(result.factorStates["electricity-price"], "NOT_APPLICABLE");
});

test("marks environmental electricity price as NOT_APPLICABLE", () => {
  const input = enterprise("S003-ENT-017");
  assert.equal(input.factorInputs["电价波动率"], null);
  const result = engine.evaluateEnterprise(input, modelPackage, runContext);
  const electricity = result.factorResults.find((factor) => factor.factorId === "electricity-price");
  assert.deepEqual(
    {
      state: electricity.state,
      marker: electricity.marker,
      coefficient: electricity.coefficient,
      tierId: electricity.tierId
    },
    { state: "NOT_APPLICABLE", marker: "NOT_APPLICABLE", coefficient: 0, tierId: null }
  );
});

test("defaults an applicable missing factor to zero without selecting a business tier", () => {
  const input = enterprise("S003-ENT-001");
  delete input.factorInputs["担保情况"];
  const result = engine.evaluateEnterprise(input, modelPackage, runContext);
  const guarantee = result.factorResults.find((factor) => factor.factorId === "guarantee");
  assert.equal(guarantee.state, "DEFAULTED_ZERO");
  assert.equal(guarantee.marker, "DEFAULTED_ZERO");
  assert.equal(guarantee.coefficient, 0);
  assert.equal(guarantee.tierId, null);
  assert.ok(result.markers.some((marker) => marker.resourceId === "guarantee" && marker.marker === "DEFAULTED_ZERO"));
});

test("assigns profitability history A=100 when any required year is missing", () => {
  const input = enterprise("S003-ENT-001");
  input.financialData["利润总额_上年同期累计数(上年)"] = null;
  const result = engine.evaluateEnterprise(input, modelPackage, runContext);
  const stability = result.indicatorResults.find((indicator) => indicator.name === "盈利稳定性");
  assert.equal(stability.actualValue, "A");
  assert.equal(stability.score, 100);
  assert.equal(stability.marker, "HISTORY_INSUFFICIENT_DEFAULT_A");
});

test("classifies exact risk boundaries deterministically", () => {
  const cases = [
    [9.99, "BLACK"],
    [10, "RED"],
    [24.99, "RED"],
    [25, "YELLOW"],
    [39.99, "YELLOW"],
    [40, "GREEN"],
    [100, "GREEN"]
  ];
  for (const [score, tierId] of cases) {
    assert.equal(engine.classifyRisk(score, modelPackage).tierId, tierId, `score=${score}`);
  }
});

test("clamps the final score and can produce a synthetic black-tier result", () => {
  const input = enterprise("S003-ENT-007");
  input.factorInputs = {
    "融资能力（已用授信余额/授信总额）": "较差",
    担保情况: "仅提供担保",
    总部支持程度: "低",
    电价波动率: "电价变化率小于等于-15%",
    是否存在重大诉讼: "重大诉讼",
    资金余缺预警: "当月资金余缺预警"
  };
  const result = engine.evaluateEnterprise(input, modelPackage, runContext);
  assert.equal(result.factorSum, -1);
  assert.equal(result.finalScore, 0);
  assert.equal(result.riskTier.tierId, "BLACK");
  assert.ok(result.dispositionCandidates.some((candidate) => candidate.actionTypeId === "S003_EMERGENCY_RESPONSE"));
  assert.ok(result.dispositionCandidates.some((candidate) => candidate.actionTypeId === "S003_FACTOR_EMERGENCY"));
  assert.equal(engine.clamp(120, 0, 100), 100);
  assert.equal(engine.clamp(-20, 0, 100), 0);
});

test("blocks invalid factor values, non-finite finance data, draft models and wrong scenarios", () => {
  const badFactor = enterprise("S003-ENT-001");
  badFactor.factorInputs["担保情况"] = "越界档位";
  assert.throws(
    () => engine.evaluateEnterprise(badFactor, modelPackage, runContext),
    (error) => error.code === "S003_INVALID_FACTOR_VALUE"
  );

  const badFinance = enterprise("S003-ENT-001");
  badFinance.financialData["资产总计_期末余额"] = "not-a-number";
  assert.throws(
    () => engine.evaluateEnterprise(badFinance, modelPackage, runContext),
    (error) => error.code === "S003_INVALID_NUMERIC_VALUE"
  );

  const draftModel = clone(modelPackage);
  draftModel.lifecycleStatus = "draft";
  assert.throws(
    () => engine.evaluateEnterprise(enterprise("S003-ENT-001"), draftModel, runContext),
    (error) => error.code === "S003_MODEL_NOT_PUBLISHED"
  );

  assert.throws(
    () => engine.evaluateEnterprise(enterprise("S003-ENT-001"), modelPackage, { ...runContext, scenarioId: "S001" }),
    (error) => error.code === "S003_SCENARIO_IDENTITY_MISMATCH"
  );
});

test("evaluates all 21 enterprises atomically with C035 facts and report data", () => {
  const first = engine.evaluatePortfolio(fixture, modelPackage, runContext);
  const second = engine.evaluatePortfolio(fixture, modelPackage, runContext);
  assert.equal(first.status, "SUCCEEDED");
  assert.equal(first.enterpriseCount, 21);
  assert.equal(first.results.length, 21);
  assert.equal(first.publishedFacts.length, 21);
  assert.equal(first.reports.length, 21);
  assert.equal(Object.values(first.summary.riskTierCounts).reduce((sum, count) => sum + count, 0), 21);
  assert.ok(first.results.every((result) => result.contractId === "C035" && result.indicatorResults.length === 15));
  assert.deepEqual(first, second, "same data/model/run identity must be deterministic");
});
