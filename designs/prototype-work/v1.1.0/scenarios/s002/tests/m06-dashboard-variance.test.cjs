"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");

test("M06预算驾驶舱明确展示预算差异额并复用基线口径抽屉", function () {
  const app = fs.readFileSync(path.join(scenarioRoot, "baseline-adapters/m06/report-center/review-lifecycle/app.js"), "utf8");
  const adapter = fs.readFileSync(path.join(scenarioRoot, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"), "utf8");

  assert.ok(adapter.includes("budgetVariance: -235.97"), "M06事实包缺少预算差异结果");
  assert.ok(app.includes('["budgetVariance", "预算差异额", formatNumber(m.budgetVariance, 2), "万元"]'), "驾驶舱核心指标未展示预算差异额");
  assert.ok(app.includes('budgetVariance: ["预算差异额"'), "预算差异额未复用基线口径与证据抽屉");
  assert.ok(app.includes("实际费用 - 最终批准费用预算；负数表示实际低于预算"), "预算差异额口径不明确");
});

