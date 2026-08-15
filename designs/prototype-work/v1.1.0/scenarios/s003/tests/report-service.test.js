"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const reportService = require("../domain/report-service.js");
const c035Results = require("../resources/m01/c035-risk-results.v1.json");
const publishedFacts = require("../resources/m01/published-risk-facts.v1.json");
const publishedPointer = require("../resources/m01/published-pointer.v1.json");
const reportContract = require("../resources/m06/report-contract.v1.json");
const decisionResults = require("../resources/m04/decision-results.v1.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function create(overrides) {
  return reportService.createReportService(Object.assign({
    scenarioContext: c035Results.scenarioIdentity,
    prototypeVersion: "1.1.0",
    generatedAt: "2026-08-15T15:10:00.000Z",
    c035Results: c035Results,
    publishedFacts: publishedFacts,
    publishedPointer: publishedPointer,
    reportContract: reportContract,
    decisionResults: decisionResults
  }, overrides || {}));
}

test("M06 creates 21 immutable formal reports from one exact Published run", () => {
  const service = create();
  const reports = service.listReports();
  assert.equal(service.moduleId, "M06");
  assert.equal(service.readOnly, true);
  assert.equal(service.prototypeVersion, "1.1.0");
  assert.equal(reports.length, 21);
  assert.ok(Object.isFrozen(reports));
  for (const report of reports) {
    assert.equal(report.status, "published-report");
    assert.equal(report.immutable, true);
    assert.equal(report.scenarioIdentity.scenarioId, "S003");
    assert.equal(report.scenarioIdentity.scenarioVersion, "S003-v1");
    assert.equal(report.scenarioIdentity.scenarioRunId, "S003-RUN-20260815133000000-c03503000001");
    assert.equal(report.deliveryIdentity.prototypeVersion, "1.1.0");
    assert.equal(report.indicatorDetails.length, 15);
    assert.equal(report.adjustmentFactors.length, 6);
    assert.ok(report.keyIndicators.length <= 3);
    assert.ok(report.evidenceReferences.length >= 7);
    assert.equal(report.generationPolicy.createsActionRequest, false);
    assert.equal(report.generationPolicy.createsTodo, false);
    assert.equal(report.generationPolicy.sendsNotification, false);
    assert.equal(report.generationPolicy.dedicatedAgentRequired, false);
  }
});

test("report deep links separate authoritative scenarioVersion from prototypeVersion", () => {
  const report = create().getReport("S003-ENT-001");
  const url = new URL(report.deepLink.href, "http://127.0.0.1:4333/scenarios/s003/");
  assert.equal(url.searchParams.get("scenarioId"), "S003");
  assert.equal(url.searchParams.get("scenarioVersion"), "S003-v1");
  assert.equal(url.searchParams.get("scenarioRunId"), "S003-RUN-20260815133000000-c03503000001");
  assert.equal(url.searchParams.get("prototypeVersion"), "1.1.0");
  assert.equal(url.searchParams.get("enterpriseId"), "S003-ENT-001");
  assert.equal(url.searchParams.get("reportId"), report.reportId);
  assert.equal(url.hash, "#report/S003-ENT-001");
});

test("user-decided default and applicability rules remain explicit in report content", () => {
  const construction = create().getReport("S003-ENT-010");
  assert.equal(construction.assessment.isUnderConstruction, true);
  assert.equal(construction.assessment.rawScore, 60);
  assert.ok(construction.indicatorDetails.every(function (indicator) {
    return indicator.marker === "UNDER_CONSTRUCTION_FIXED_60";
  }));
  const electricity = construction.adjustmentFactors.find(function (factor) {
    return factor.factorId === "electricity-price";
  });
  assert.equal(electricity.state, "NOT_APPLICABLE");
  assert.equal(construction.factorStateSummary.NOT_APPLICABLE, 1);
  const ruleById = Object.fromEntries(construction.ruleExplanations.map(function (rule) {
    return [rule.ruleId, rule];
  }));
  assert.equal(ruleById["S003-RULE-UNDER-CONSTRUCTION-60"].applied, true);
  assert.match(ruleById["S003-RULE-PROFIT-HISTORY-A"].statement, /A 档计 100 分/);
  assert.match(ruleById["S003-RULE-DEFAULTED-ZERO"].statement, /DEFAULTED_ZERO/);
  assert.match(ruleById["S003-RULE-NOT-APPLICABLE"].statement, /NOT_APPLICABLE/);
});

test("M04 decision state is reported without creating new decision side effects", () => {
  const service = create();
  const confirmed = service.getReport("S003-ENT-020");
  assert.equal(confirmed.disposition.candidateCount, 2);
  const confirmedCandidate = confirmed.disposition.candidates.find(function (candidate) {
    return candidate.status === "CONFIRMED_TO_OWNER_TODO";
  });
  assert.ok(confirmedCandidate);
  assert.equal(confirmedCandidate.actionRequestId, "AR-S003-00BMPUKR");
  assert.equal(confirmedCandidate.todoId, "TODO-S003-00BMPUKR");
  assert.equal(confirmedCandidate.multiLevelApproval, false);
  assert.equal(confirmedCandidate.notificationSent, false);

  const awaiting = service.getReport("S003-ENT-007");
  assert.ok(awaiting.disposition.candidates.every(function (candidate) {
    return candidate.status === "CANDIDATE_AWAITING_HUMAN_CONFIRMATION";
  }));
});

test("HTML artifact is traceable and contains score, factors, rules and evidence", () => {
  const html = create().renderHtml("S003-ENT-001");
  assert.match(html, /企业债务风险诊断报告/);
  assert.match(html, /scenarioRunId/);
  assert.match(html, /S003-RUN-20260815133000000-c03503000001/);
  assert.match(html, /prototypeVersion/);
  assert.match(html, /调节因子明细/);
  assert.match(html, /财务指标评分明细/);
  assert.match(html, /规则说明/);
  assert.match(html, /证据引用/);
  assert.doesNotMatch(html, /<script/i);
});

test("M06 rejects Draft, wrong run identities and fact/result mismatches", () => {
  const draftFacts = clone(publishedFacts);
  draftFacts.status = "draft";
  assert.throws(function () {
    create({publishedFacts: draftFacts});
  }, function (error) {
    return error.code === "S003_REPORT_SOURCE_NOT_PUBLISHED";
  });

  const wrongContext = clone(c035Results.scenarioIdentity);
  wrongContext.scenarioRunId = "S003-RUN-20260815133000000-c03503009999";
  assert.throws(function () {
    create({scenarioContext: wrongContext});
  }, function (error) {
    return error.code === "S003_REPORT_SCENARIO_MISMATCH";
  });

  const inconsistentFacts = clone(publishedFacts);
  inconsistentFacts.facts[0].object.finalScore = 0;
  assert.throws(function () {
    create({publishedFacts: inconsistentFacts});
  }, function (error) {
    return error.code === "S003_REPORT_FACT_RESULT_MISMATCH";
  });
});
