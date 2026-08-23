"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

function loadData() {
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(read("data.js"), sandbox);
  return sandbox.window.S002_DATA;
}

function near(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) <= epsilon, `${actual} != ${expected}`);
}

test("供应商服务人员人月成本只由技术配置净额除以服务人月派生", function () {
  const data = loadData();
  assert.ok(data.supplierBenchmarks.length > 0, "缺少供应商技术配置来源明细");

  data.supplierBenchmarks.forEach((row) => {
    assert.equal(row.budgetSubject, "业务支持费-技术配置");
    assert.equal(row.sourceMember, "技术配置");
    assert.equal(row.currency, "CNY");
    assert.equal(row.unit, "元/人月");
    assert.ok(Number(row.serviceMonths) > 0, `${row.id} 服务人月必须大于0`);
    near(row.monthlyNetCostWan, Number(row.netAmountWan) / Number(row.serviceMonths));
    near(row.monthlyNetCostRmb, Number(row.netAmountWan) * 10000 / Number(row.serviceMonths), 0.01);
    assert.equal(row.sourceDataMarker, "SOURCE", `${row.id} 未保留来源标识`);
    assert.equal(row.dataMarker, "SOURCE", `${row.id} 来源明细不应伪装成演示补数`);
  });
});

test("供应商人月成本比较组锁定同年度同口径且跨部门比较", function () {
  const data = loadData();
  const expectedKey = (row) => [
    row.year,
    row.budgetSubject,
    row.personCategory,
    row.supplier,
    row.level,
    row.currency,
    row.taxRate
  ].join("|");

  data.supplierBenchmarks.forEach((row) => {
    assert.equal(row.comparisonGroupKey, expectedKey(row));
    assert.equal(row.comparisonGroupKey.includes(row.department), false, "部门应是组内成员而不是组键");
    assert.equal(row.comparisonGroupKey.includes(row.projectId), false, "项目应是穿透明细而不是组键");
  });

  data.supplierBenchmarkGroups.forEach((group) => {
    const members = data.supplierBenchmarks.filter((row) => row.comparisonGroupKey === group.comparisonGroupKey);
    assert.equal(group.memberCount, members.length);
    assert.equal(group.departmentCount, new Set(members.map((row) => row.department)).size);
    assert.equal(group.year, members[0].year);
    assert.equal(group.supplier, members[0].supplier);
    assert.equal(group.level, members[0].level);
  });
  assert.ok(data.supplierBenchmarkGroups.some((group) => group.departmentCount > 1), "缺少跨部门可比组");
});

test("最高最低倍率严格大于1.2才异常，等于1.2不命中", function () {
  const data = loadData();
  data.supplierBenchmarkGroups.forEach((group) => {
    const expected = group.departmentCount >= 2 && Number(group.maxMinRatio) > 1.2;
    assert.equal(group.anomaly, expected, `${group.comparisonGroupKey} 的严格边界判定错误`);
  });

  const boundary = data.supplierBenchmarkGroups.find((group) => Math.abs(Number(group.maxMinRatio) - 1.2) <= 1e-9);
  assert.ok(boundary, "缺少最高/最低倍率恰好为1.2的边界样本");
  assert.equal(boundary.departmentCount >= 2, true);
  assert.equal(boundary.anomaly, false, "倍率等于1.2不得判定异常");

  const rule = data.rules.find((item) => item.id === "RULE-005");
  assert.ok(rule);
  assert.equal(rule.expression, "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2");
  assert.match(rule.evidence, /严格大于1\.2才异常，等于1\.2不命中/);
});

test("M06供应商专题保留规则解释、组汇总和业务明细穿透字段", function () {
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  const supplierTopic = app.slice(app.indexOf("function topicSupplierContent()"), app.indexOf("function dashboardOverview()"));

  for (const phrase of [
    "供应商/人月成本专题按同供应商同级别跨部门比对",
    "人月成本=净额÷人月",
    "最高/最低倍率>1.2为异常，等于1.2不命中",
    "供应商×级别组汇总与部门明细",
    "净额（万元）",
    "服务人月",
    "人月成本（元）",
    "币种 / 税率",
    "组内倍率",
    "数据标识"
  ]) {
    assert.ok(supplierTopic.includes(phrase), `M06供应商专题缺少：${phrase}`);
  }
  assert.match(supplierTopic, /dashboardRowToggle\("supplier", groupKey\)/);
  assert.match(supplierTopic, /dashboardDetailRow\(9,/);
  assert.match(supplierTopic, /budgetDataMarker\(item\.dataMarker \|\| item\.sourceDataMarker\)/);

  assert.match(adapter, /function supplierMonthlyNetCostRmb\(item\)/);
  assert.match(adapter, /netAmountWan \* 10000 \/ serviceMonths/);
  assert.match(adapter, /item\.budgetSubject[\s\S]*item\.personCategory[\s\S]*item\.supplier[\s\S]*item\.level[\s\S]*item\.currency[\s\S]*supplierTaxKey\(item\.taxRate\)/);
  assert.match(adapter, /const crossDepartment = departmentsInGroup\.length > 1/);
  assert.match(adapter, /const anomaly = crossDepartment && Number\.isFinite\(ratio\) && ratio > 1\.2/);
  assert.match(adapter, /sourceDataMarker: item\.sourceDataMarker \|\| item\.dataMarker \|\| "SOURCE"/);
});

test("M01 Published Rule 与 M03 语义资源使用同一供应商人月成本口径", function () {
  const m01 = read("baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js");
  const m03Adapter = read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/s002-adapter.js");
  const m03Resources = read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/data.jsx");

  for (const source of [m01, m03Resources]) {
    assert.match(source, /RULE-S002-SUPPLIER-PRICE/);
    assert.match(source, /预算二级科目为“业务支持费-技术配置”/);
    assert.match(source, /可比组至少覆盖2个部门且人月均大于0/);
    assert.match(source, /人月成本=采购净额÷人月/);
    assert.match(source, /最高部门人月成本÷最低部门人月成本 > 1\.2 时异常/);
  }

  assert.match(m03Adapter, /按年度、预算二级科目、人员分类、供应商、人员级别、币种和税率分组/);
  assert.match(m03Adapter, /最高\/最低倍率严格大于1\.2才异常/);
  assert.match(m03Adapter, /本轮最高倍率为1\.20/);
  assert.match(m03Adapter, /dataMarker: "SOURCE_AND_DERIVED"/);
});
