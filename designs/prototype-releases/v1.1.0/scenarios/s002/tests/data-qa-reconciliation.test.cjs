"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const m03Root = path.join(scenarioRoot, "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace");

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

function loadData() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(read("data.js"), sandbox);
  return sandbox.window.S002_DATA;
}

function near(actual, expected, epsilon = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test("8份工作簿映射为5逻辑源、8快照、14逻辑成员和2个数据资产", function () {
  const data = loadData();
  assert.equal(data.sourceManifest.length, 8);
  assert.equal(data.dataSources.length, 5);
  assert.equal(data.dataSources.reduce((sum, source) => sum + source.snapshotCount, 0), 8);
  assert.equal(data.sourceManifest.reduce((sum, source) => sum + source.members.length, 0), 14);
  assert.deepEqual(
    JSON.parse(JSON.stringify(data.dataAssets.map((asset) => asset.version))),
    ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]
  );
  assert.equal(data.sourceReconciliation.lineage.sourceFiles, 8);
  assert.equal(data.sourceReconciliation.lineage.logicalSources, 5);
  assert.equal(data.sourceReconciliation.lineage.snapshots, 8);
  assert.equal(data.sourceReconciliation.lineage.logicalMembers, 14);
});

test("2025预算执行、成本占收比与毛利率从固定场景事实一致推导", function () {
  const data = loadData();
  const facts = data.annualFacts.filter((row) => row.year === 2025);
  const approved = facts.reduce((sum, row) => sum + row.approvedExpenseBudget, 0);
  const actual = facts.reduce((sum, row) => sum + row.actualExpense, 0);
  const revenue = facts.reduce((sum, row) => sum + row.actualRevenue, 0);
  near(approved, 1097.70);
  near(actual, 861.7265);
  near(revenue, 1159.0222);
  near(actual / approved, 0.7850291518629864);
  near(actual / revenue, 0.7434943869064802);
  near(1 - actual / revenue, 0.2565056130935198);

  const audit = data.sourceReconciliation.portfolio2025;
  assert.equal(audit.approvedExpenseBudget.displayAmount, undefined);
  assert.equal(audit.actualExpense.sourceWorkbookAmount, 981.5595);
  assert.equal(audit.actualExpense.scenarioAmount, 861.7265);
  assert.equal(audit.actualExpense.displayAmount, 861.73);
  assert.equal(audit.actualExpense.delta, -119.833);
  assert.equal(audit.actualExpense.marker, "MIXED_SOURCE_AND_DEMO_MARKERS");
  assert.equal(facts.every((row) => row.fieldMarkers.actualExpense === "MIXED_SOURCE_AND_DEMO_MARKERS"), true);
});

test("采购占用和项目余额口径与源表审计结果一致且不掩盖加工输入", function () {
  const data = loadData();
  assert.equal(data.occupancy.totalPositivePr, 273.09);
  assert.equal(data.occupancy.decemberPositivePr, 23.45);
  assert.equal(data.occupancy.netInTransit, 163.38);
  near(data.occupancy.decemberShare, 23.45 / 273.09, 0.000001);
  near(data.occupancy.budgetOccupancyDecemberShare, 23.45 / 163.38, 0.000001);
  assert.equal(data.occupancy.totalsDataMarker, "SOURCE");
  assert.equal(data.occupancy.byProject.every((row) => row.dataMarker === "SOURCE"), true);

  assert.equal(data.projects.length, 21);
  assert.equal(new Set(data.projects.map((row) => row.projectId)).size, 21);
  assert.equal(data.projects.reduce((sum, row) => sum + row.launchAmount, 0), 4317);
  near(data.projects.reduce((sum, row) => sum + row.availableBalance, 0), 2157.0187);
  const negative = data.projects.filter((row) => row.availableBalance < 0);
  assert.deepEqual(JSON.parse(JSON.stringify(negative.map((row) => [row.projectId, row.availableBalance]))), [["PRJ-AQ-概率-2025-002", -20.5038]]);
  assert.equal(negative[0].containsSyntheticInputs, true);
  assert.equal(negative[0].netInTransitDataMarker, "SOURCE");
});

test("M03六问六答逐题绑定，展示费用口径并披露源表与演示加工差异", function () {
  const data = loadData();
  const adapter = fs.readFileSync(path.join(m03Root, "s002-adapter.js"), "utf8");
  const domain = fs.readFileSync(path.join(m03Root, "data.jsx"), "utf8");
  const approvedQuestions = [
    "2025年各部门费用预算执行率和差异额分别是多少？",
    "哪些单位2025年成本占收比超过100%，对应真正毛利率是否为负？",
    "项目可用立项余额不足或净在途占用异常的项目有哪些？",
    "12月正向采购发起占比和年末采购/预算占用集中度如何？",
    "2026年初始申报中，哪个部门成本占收比最高？",
    "2024—2025年各部门费用预算执行率变化分别是多少？"
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(data.questions.map((item) => item.label))), approvedQuestions);
  approvedQuestions.forEach((question) => {
    assert.ok(adapter.includes(question), `适配器缺少问题：${question}`);
    assert.ok(domain.includes(question), `问数域缺少问题：${question}`);
  });

  for (const key of ["s002-budget-execution", "s002-cost-margin", "s002-project-occupancy", "s002-year-end", "s002-submission", "s002-actions"]) {
    assert.ok(adapter.includes(`"${key}": {`), `缺少独立答案 ${key}`);
    assert.ok(domain.includes(`RESULT_TEMPLATES["${key}"]`), `缺少固定结果 ${key}`);
  }
  for (const value of ["1,097.70", "861.73", "78.50", "74.35", "25.65", "163.38", "273.09", "8.59", "14.35", "18.9437", "-20.5038"]) {
    assert.ok(adapter.includes(value), `M03答案缺少关键值 ${value}`);
  }
  assert.ok(adapter.includes("14.35%为组合总体观察值"));
  assert.ok(adapter.includes("设备维护项目12月净在途占全年18.94%，正式命中RULE-004"));
  assert.ok(adapter.includes("2025源工作簿费用合计981.5595万元"));
  assert.ok(adapter.includes("差额-119.8330万元已登记为MIXED_SOURCE_AND_DEMO_MARKERS"));
  assert.equal(adapter.includes(": 2297.7"), false, "M03仍把收入预算与费用预算合并后标为费用预算");
  assert.equal(adapter.includes(": 2020.75"), false, "M03仍把收入与费用合并后标为实际费用");
});

test("M03第六问展示跨年执行趋势且不混入决策事项", function () {
  const adapter = fs.readFileSync(path.join(m03Root, "s002-adapter.js"), "utf8");
  const domain = fs.readFileSync(path.join(m03Root, "data.jsx"), "utf8");
  for (const value of ["84.25", "63.20", "-21.05", "90.12", "77.97", "-12.15", "125.48", "98.86", "-26.62"]) {
    assert.ok(adapter.includes(value), `适配答案缺少跨年值 ${value}`);
    assert.ok(domain.includes(value), `固定结果缺少跨年值 ${value}`);
  }
  const adapterActionResult = adapter.slice(adapter.indexOf('"s002-actions": {'), adapter.indexOf("  });", adapter.indexOf('"s002-actions": {')));
  const domainActionResult = domain.slice(domain.indexOf('RESULT_TEMPLATES["s002-actions"]'), domain.indexOf("\n  }", domain.indexOf('RESULT_TEMPLATES["s002-actions"]')));
  for (const phrase of ["待我决策", "行动申请", "Action Request", "预算调增", "科目调剂"]) {
    assert.equal(adapterActionResult.includes(phrase), false, `跨年答案混入决策语义：${phrase}`);
    assert.equal(domainActionResult.includes(phrase), false, `跨年固定结果混入决策语义：${phrase}`);
  }
});
