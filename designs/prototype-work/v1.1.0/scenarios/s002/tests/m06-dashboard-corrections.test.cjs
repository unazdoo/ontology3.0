"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scenarioRoot = path.resolve(__dirname, "..");
const m06App = fs.readFileSync(path.join(scenarioRoot, "baseline-adapters/m06/report-center/review-lifecycle/app.js"), "utf8");
const m06Data = fs.readFileSync(path.join(scenarioRoot, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"), "utf8");
const m02Adapter = fs.readFileSync(path.join(scenarioRoot, "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js"), "utf8");

test("驾驶舱明细执行率按明细预算与实际独立重算", () => {
  assert.match(m06App, /function detailExecutionRate\(item\)/);
  assert.match(m06App, /const rate = detailExecutionRate\(detailItem\)/);
  assert.doesNotMatch(m06App, /formatPercent\(detailItem\.executionRate, 2\)/);
});

test("驾驶舱详情不再展示难以理解的标识字段和真正毛利率文案", () => {
  assert.doesNotMatch(m06App, /<span>数据标识<\/span>/);
  assert.doesNotMatch(m06App, /<span>来源标识<\/span>/);
  // M01/M06 report facts may retain the separately-defined gross-margin
  // metric for semantic/report evidence.  The high-fidelity dashboard itself
  // must not expose it as a KPI or warning label.
  const dashboardVisible = m06App.slice(m06App.indexOf("function topicCostContent()"), m06App.indexOf("function reportWorkflowIndex()"));
  assert.doesNotMatch(dashboardVisible, /真正毛利率/);
  assert.match(m06Data, /费用高于收入净额/);
});

test("M02高保真目录不展示实现层消费上下文说明", () => {
  assert.match(m02Adapter, /function sanitizeHighFidelityCopy\(\)/);
  assert.match(m02Adapter, /2 个场景已发布资产/);
  assert.match(m02Adapter, /数据消费上下文 · 本轮完整上下文已核对/);
  assert.match(m02Adapter, /node\.hidden = true/);
});

test("M02场景画布按真实节点位置生成正交连线", () => {
  assert.match(m02Adapter, /left:\\s\*\(\[\\d\.\]\+\)px/);
  assert.match(m02Adapter, /top:\\s\*\(\[\\d\.\]\+\)px/);
  assert.match(m02Adapter, /M \$\{startX\} \$\{startY\} H \$\{midX\} V \$\{targetY\} H \$\{targetX\}/);
});
