"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(scenarioRoot, relative), "utf8");

test("M06驾驶舱按六类监督关注展示证据且不绑定运行态决策事项", function () {
  const data = read("data.js");
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");

  for (const [sourceId, category] of [
    ["HIT-002-2025-AQ", "预算执行"],
    ["HIT-003-2025-AQ", "成本效率"],
    ["DASH-EXEC-AQ-2025", "项目余额"],
    ["DASH-OCC-JS-2025", "年末占用"],
    ["SUG-001", "申报合理性"],
  ]) {
    assert.ok(data.includes(sourceId), `根场景缺少权威预警来源 ${sourceId}`);
    assert.ok(adapter.includes(sourceId), `M06事实包缺少驾驶舱候选 ${sourceId}`);
    assert.ok(adapter.includes(`category: "${category}"`), `${sourceId} 未归入 ${category}`);
  }

  assert.ok(adapter.includes("function supplierDashboardWarningCandidates()"), "M06缺少由供应商组结果派生预警的逻辑");
  assert.ok(adapter.includes('group.anomaly === true && Number(group.maxMinRatio) > 1.2'), "供应商预警没有使用严格>1.2边界");
  assert.ok(adapter.includes('category: "供应商价格"'), "供应商异常组未归入供应商价格分类");

  assert.ok(adapter.includes('sourceLabel: isRuleHit ? "Rule 命中" : "驾驶舱分析建议（非Rule命中）"'));
  assert.ok(adapter.includes('Boolean(candidate.relatedSourceId && candidate.ruleId)'), "复用既有Rule Hit的驾驶舱候选未识别为Rule证据");
  assert.ok(adapter.includes('id: "HIT-003-2025-AQ"'), "成本占收比预警未直接复用既有待决策sourceId");
  assert.ok(app.includes('warning.sourceKind !== "rule-hit" && warning.rule'), "M06缺少分析建议/Rule命中冲突门");
  assert.ok(app.includes('ruleApplicability: warning.rule ? "适用" : "不适用"'));
  assert.ok(adapter.includes('existingActionRequestId: null'));
  assert.ok(adapter.includes('recommendation: attentionRecommendation(candidate)'));
  assert.ok(app.includes("本版本不生成 Action Request、决策事项或平台内待办"));
  for (const category of ["预算执行", "成本效率", "项目余额", "年末占用", "供应商价格", "申报合理性"]) assert.ok(adapter.includes(`category: "${category}"`), `缺少预警分类：${category}`);
});

test("每张关注卡只提供指标与证据下钻，不展示行动申请入口", function () {
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  assert.ok(app.includes("function warningActionButton(warning, options = {})"));
  assert.ok(app.includes('function warningActionButton(warning, options = {}) {\n    return "";\n  }'));
  assert.ok(app.includes('data-action="open-action-warning-detail" data-warning="${esc(warning.id)}"'));
  const activeSection = app.slice(app.indexOf("function ruleAndActionSection()"), app.indexOf("/* 旧行动协同实现保留为历史代码"));
  assert.equal(activeSection.includes('data-action="open-action"'), false);
  assert.equal(activeSection.includes('data-action="submit-action"'), false);
});

test("M06范围边界、实施日期和响应式关注布局保持明确", function () {
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  const css = read("baseline-adapters/m06/report-center/review-lifecycle/styles.css");

  assert.ok(app.includes("实施基准日 2026-08-15"));
  assert.ok(app.includes("不触发决策中心"));
  assert.ok(app.includes("本版本不生成 Action Request、决策事项或平台内待办"));
  assert.ok(css.includes(".budget-warning-grid"));
  assert.ok(css.includes(".budget-warning-grid"));
  assert.ok(css.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"));
  assert.ok(css.includes("@media (max-width: 700px)"));
  assert.ok(css.includes(".budget-warning-actions { align-items: stretch; flex-direction: column; }"));
});

test("驾驶舱主题切换写入路由且报告、预警口径与权威数据一致", function () {
  const data = read("data.js");
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");

  assert.ok(app.includes("return navigate(`/dashboard/s002?tab=${normalizedTab}`)"), "驾驶舱页签未同步更新基线路由");
  assert.ok(adapter.includes("S002-M06-REPORT-PROJECTION-v11"), "供应商人月成本口径修正未触发报告投影升版");
  assert.ok(adapter.includes('id: "RULE-003", code: "R03", name: "成本占收比异常"'), "RULE-003未对齐成本占收比异常");
  assert.ok(adapter.includes("命中：成本占收比 112.63%；真正毛利率 -12.63%"), "报告缺少RULE-003真实命中结果");
  assert.ok(adapter.includes("14组跨年计提与冲回/实际确认已逐条配对"), "跨年计提未降级为质量核验披露");
  assert.equal(adapter.includes('name: "计提配对核验无异常"'), false, "跨年计提仍冒充正式RULE-003");
  assert.ok(adapter.includes('id: "RULE-005-SUPPORT"'), "供应商价格倍率仍冒充正式Metric");
  assert.equal(adapter.includes('id: "MET-010"'), false, "M06残留未发布MET-010");
  assert.ok(adapter.includes('branch: "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2"'), "M06 RULE-005未切换为最高/最低人月成本倍率");
  assert.equal(adapter.includes("currentUnitPrice / cohortMedianUnitPrice"), false, "M06仍残留旧单价/中位价Rule逻辑");
  assert.ok(adapter.includes('value: "310.30%"'), "技术部初始申报成本占收比未对齐权威数据");
  assert.ok(data.includes('relatedSourceId: "HIT-001"'), "DASH-EXEC未复用既有HIT-001");
  assert.ok(data.includes('metricId: "MET-006"') && data.includes('ruleId: "RULE-001"'), "DASH-EXEC未对齐MET-006/RULE-001");
  assert.ok(data.includes('metricValue: -20.5038'), "DASH-EXEC未对齐项目可用立项余额-20.5038万元");
  assert.ok(adapter.includes('"RULE-001": "R01"'), "驾驶舱Rule code未显式映射R01");
  assert.ok(adapter.includes('relatedSourceId: candidate.relatedSourceId || null'), "M06未保留既有Rule Hit来源标识");
});

test("关注卡状态只区分Rule命中和分析关注，不回显决策状态", function () {
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  assert.ok(app.includes('return { label: warning?.sourceKind === "rule-hit" ? "Rule 命中" : "分析关注"'));
  assert.ok(app.includes("requestId: null"));
});

test("驾驶舱发布保持零运行态决策事项", function () {
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  assert.equal(adapter.includes("3条人工确认形成平台内待办"), false);
  assert.equal(adapter.includes("4条继续待决策"), false);
  assert.ok(adapter.includes("当前 S002 运行不生成行动申请、决策事项或平台内待办"));
  assert.ok(adapter.includes("existingActionRequestId: null"));
});

test("驾驶舱采用六专题页签与专题内事实下钻布局", function () {
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  const css = read("baseline-adapters/m06/report-center/review-lifecycle/styles.css");
  for (const topic of ["cost", "project", "travel", "accrual", "concentration", "supplier"]) assert.ok(app.includes(`key: "${topic}"`), `缺少专题页签：${topic}`);
  assert.ok(app.includes("function topicCostContent()"));
  assert.ok(app.includes("function topicProjectContent()"));
  assert.ok(app.includes("function topicTravelContent()"));
  assert.ok(app.includes("function topicAccrualContent()"));
  assert.ok(app.includes("function topicConcentrationContent()"));
  assert.ok(app.includes("function topicSupplierContent()"));
  assert.ok(app.includes("人月成本=年度预算净额（万元）×10000÷服务人月"), "供应商专题未解释净额÷人月公式");
  assert.ok(app.includes("最高/最低倍率>1.2为异常，等于1.2不命中"), "供应商专题未展示严格阈值边界");
  assert.ok(app.includes("净额（万元）") && app.includes("服务人月") && app.includes("人月成本（元）"), "供应商明细下钻字段不完整");
  assert.ok(app.includes('data-action="toggle-dashboard-row"'));
  assert.ok(app.includes('state.dashboard.expandedRows'));
  assert.ok(app.includes("function dashboardDetailRow"));
  assert.ok(app.includes("function topicRuleLegend"));
  assert.ok(app.includes("上期明确为2025实际，本期明确为2026初始申报"));
  for (const sourceKey of ["cost", "projects", "travel", "accrual", "concentration", "suppliers"]) assert.ok(adapter.includes(`${sourceKey}:`), `M06事实包缺少专题明细：${sourceKey}`);
  assert.equal(app.includes('data-action="open-ask" data-context="${state.dashboard.scopeId}"'), false, "驾驶舱不应连接智能问数");
  assert.ok(css.includes(".dashboard-topic-stats"));
  assert.ok(css.includes(".dashboard-hierarchy-table"));
  assert.ok(css.includes(".dashboard-inline-detail"));
  assert.ok(css.includes(".dashboard-rule-legend"));
});

test("差旅费补齐数据保持年度、汇总守恒与演示标识", function () {
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  assert.ok(adapter.includes('priorYear: 17.55, currentYear: 29.86, delta: 12.31, yoy: 70.14'));
  assert.ok(adapter.includes('priorYear: 36.11, currentYear: 24.46, delta: -11.65, yoy: -32.26'));
  assert.ok(adapter.includes('priorYear: 43.66, currentYear: 18.21, delta: -25.45, yoy: -58.29'));
  assert.ok(adapter.includes('currentYear: 10.29, delta: 4.44, dataMarker: "SYNTHETIC_FOR_DEMO"'), "设备管理部项目拆分未校准0.01万元守恒差异");
  assert.ok(adapter.includes('dataMarker: "MIXED_SOURCE_AND_DEMO_MARKERS"'));
});

test("分类预警展示用户可理解规则并可展开具体证据", function () {
  const data = read("data.js");
  const adapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  const app = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  for (const category of ["预算执行", "成本效率", "项目余额", "年末占用", "供应商价格", "申报合理性"]) assert.ok(app.includes(`"${category}": {`), `缺少预警规则说明：${category}`);
  for (const category of ["项目余额", "年末占用"]) assert.ok(data.includes(`category: "${category}"`), `根场景预警未归一为：${category}`);
  assert.ok(app.includes('"供应商价格": {'), "供应商分类缺少用户可理解的规则说明");
  assert.ok(adapter.includes("function canonicalWarningCategory(trigger = {})"), "M06缺少父场景旧分类的运行时归一");
  for (const stale of ["预算覆盖不足", "年末占用集中", "供应商报价偏高"]) assert.equal(data.includes(`alertType: "${stale}"`), false, `根场景仍暴露旧预警名称：${stale}`);
  assert.ok(app.includes("先看每类判定逻辑，再展开到具体单位、项目、指标值和证据"));
  assert.ok(app.includes("为什么触发"));
  assert.ok(app.includes("用户可理解的判定"));
  assert.ok(app.includes("本版本不生成决策中心事项"));
});
