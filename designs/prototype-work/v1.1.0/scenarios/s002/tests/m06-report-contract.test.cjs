"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function loadAdapter() {
  const values = new Map();
  const localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
  const noop = () => {};
  const document = {
    readyState: "complete",
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: noop,
    createElement: () => ({ id: "", style: {}, appendChild: noop }),
    head: { appendChild: noop },
  };
  const window = {
    parent: null,
    addEventListener: noop,
    location: { search: "?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=M06-CONTRACT-TEST&formedAt=2026-08-15T08:00:00.000Z&status=active" },
    RC_DATA: { product: {}, publishedSemantic: {}, metrics: {}, rules: [], actionTypes: [], reportEvidence: { factPackages: {} }, scenes: [], definitions: [], templates: [] },
  };
  window.parent = window;
  const sandbox = { window, document, localStorage, URLSearchParams, console, setTimeout: noop };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"), "utf8"), sandbox);
  return sandbox.window.S002_M06_ADAPTER.factPackage;
}

test("M06报告事实包绑定双数据资产并提供确定性核验字段", () => {
  const pack = loadAdapter();
  assert.equal(pack.factPackageStatus, "available");
  assert.deepEqual(Array.from(pack.dataAssetVersions), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.equal(pack.dataAssetId, "S002-DATA-BUNDLE");
  assert.equal(pack.contentFacts.length, 58);
  assert.equal(pack.renderManifest.items.length, 66);
  assert.ok(pack.contentFacts.every((fact) => Array.isArray(fact.applicableChecks) && fact.applicableChecks.length >= 6));
  assert.equal(pack.contentFacts.reduce((total, fact) => total + fact.applicableChecks.length, 0), 418, "58项报告事实的适用检查清单应保持稳定");
  assert.ok(pack.contentFacts.every((fact) => fact.resultVersion), "报告事实缺少结果版本");
  assert.ok(pack.contentFacts.every((fact) => Array.isArray(fact.evidenceRefs) && fact.evidenceRefs.length), "报告事实缺少证据引用");
  assert.ok(pack.contentFacts.every((fact) => fact.semanticSnapshot?.publishedVersion === "S002-ONTO-v1"));
  assert.ok(pack.contentFacts.every((fact) => fact.trustSnapshot?.asOf === "2025-12-31" && fact.trustSnapshot?.consumptionReadiness === "可消费"));
  const contentIds = pack.renderManifest.items.map((item) => item.contentItemId);
  assert.equal(new Set(contentIds).size, contentIds.length);
  assert.equal(pack.metrics.length, 9);
  assert.equal(pack.rules.length, 5);
  assert.equal(pack.actionTypes.length, 6);
  assert.deepEqual(Array.from(pack.actionTypes, (item) => item.id), ["ACT-BUDGET-EXECUTION-RECTIFICATION", "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", "ACT-PROCUREMENT-COMMITMENT-CLEANUP", "ACT-SUPPLIER-PRICE-REVIEW"]);
  assert.deepEqual(Array.from(pack.actionTypes, (item) => item.legacyCompatibleId), ["ACT-BUDGET-INCREASE", "ACT-BUDGET-DECREASE", "ACT-SUBJECT-TRANSFER", "ACT-SUBMISSION-RETURN", "ACT-RELEASE-COMMITMENT", "ACT-PRICE-REVIEW"]);
  const rule3 = pack.rules.find((item) => item.id === "RULE-003");
  assert.equal(rule3.metricId, "MET-001");
  assert.equal(rule3.branch, "costToRevenue >= 100%");
  assert.equal(rule3.actionType, "费用管理优化核查");
  const rule3Fact = pack.contentFacts.find((item) => item.id === "FACT-R03-RESULT");
  assert.equal(rule3Fact.ruleSnapshot.metricId, "MET-001");
  assert.match(String(rule3Fact.value), /112\.63%/);
  assert.equal(pack.dashboardActionWarnings.length, 5);
  assert.deepEqual(new Set(pack.dashboardActionWarnings.map((item) => item.category)), new Set(["预算执行", "成本效率", "项目余额", "年末占用", "申报合理性"]));
  assert.equal(pack.dashboardActionWarnings.some((item) => item.category === "供应商价格"), false, "当前源技术配置无严格>1.2异常组，不应伪造供应商预警");
  assert.ok(pack.dashboardActionWarnings.some((item) => item.sourceId === "HIT-003-2025-AQ" && item.actionType === "费用管理优化核查"));
  assert.ok(pack.dashboardActionWarnings.every((item) => item.existingActionRequestId === null));
  assert.ok(pack.dashboardActionWarnings.some((item) => item.sourceId === "SUG-001" && item.sourceKind === "analysis-suggestion"));
});

test("M06单位余额、RULE-002分支、供应商可比组与报告叙事对齐权威事实", () => {
  const pack = loadAdapter();
  const source = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"), "utf8");
  const owners = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/external-owners.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/app.js"), "utf8");

  assert.equal(pack.units["安全运行部"].availableBalance, 278.8868);
  assert.equal(pack.units["技术部"].availableBalance, 749.3669);
  assert.equal(pack.units["设备管理部"].availableBalance, 1128.765);
  assert.equal(Number(Object.values(pack.units).reduce((sum, unit) => sum + unit.availableBalance, 0).toFixed(4)), 2157.0187);

  const rule2 = pack.rules.find((item) => item.id === "RULE-002");
  assert.match(rule2.threshold, /<=70%偏低/);
  assert.match(rule2.threshold, /95%—100%接近上限/);
  assert.match(rule2.threshold, />100%超支/);
  assert.equal(pack.units["设备管理部"].rule.id, "RULE-002");
  assert.equal(pack.units["设备管理部"].rule.branch, "expenseExecutionRate <= 70%");
  assert.equal(pack.units["技术部"].rule.status, "已评估无命中");
  assert.ok(source.includes('"HIT-002-2025-SB": { id: "AR-S002-008"'));
  assert.ok(owners.includes('"HIT-002-2025-SB": { id: "AR-S002-008"'));
  assert.equal(source.includes("SUG-002"), false);
  assert.equal(owners.includes("SUG-002"), false);

  const suppliers = pack.contentFacts.find((item) => item.id === "FACT-R01-INSTITUTIONS");
  assert.equal(suppliers.ruleSnapshot.ruleId, "RULE-005");
  assert.equal(suppliers.ruleSnapshot.supportingMeasureId, "RULE-005-SUPPORT");
  assert.match(String(suppliers.value), /各部门人月成本=净额÷人月/);
  assert.match(String(suppliers.value), /最高\/最低倍率>1\.2/);
  const rule5 = pack.rules.find((item) => item.id === "RULE-005");
  assert.equal(rule5.name, "供应商同级人月成本差异");
  assert.equal(rule5.branch, "maxMonthlyNetCostRmb / minMonthlyNetCostRmb > 1.2");
  assert.equal(rule5.threshold, "最高/最低人月成本倍率 > 1.2");
  const supplierDetails = pack.dashboardSourceDetails.suppliers;
  assert.equal(supplierDetails.length, 4);
  assert.ok(supplierDetails.every((item) => item.budgetSubject === "业务支持费-技术配置" && item.personCategory === "技术服务"));
  assert.ok(supplierDetails.every((item) => Math.abs(item.monthlyNetCostRmb - item.netAmountWan * 10000 / item.serviceMonths) < 0.000001));
  const exactBoundary = supplierDetails.find((item) => item.supplier === "供应商3" && item.level === "初级");
  assert.equal(exactBoundary.maxMinRatio, 1.2);
  assert.equal(exactBoundary.anomaly, false, "最高/最低倍率等于1.2时必须不命中");
  assert.ok(pack.institutions.every((item) => Array.isArray(item.details) && item.details.length >= 2), "供应商汇总缺少部门项目穿透明细");

  const concentration = pack.contentFacts.find((item) => item.id === "FACT-JUDGMENT-SHORT-LOW");
  assert.match(String(concentration.value), /14\.35%.*总体观察/);
  assert.match(String(concentration.value), /18\.9437%/);
  assert.match(String(concentration.value), /18\.9437%命中RULE-004/);

  const submissionTrend = pack.budgetSupervisionDetails.find((item) => item.id === "BSD-S002-012");
  assert.match(submissionTrend.action, /核对收入确认、费用结构、申报依据和可优化空间/);
  assert.equal(submissionTrend.actionRequestId, null);
  assert.match(submissionTrend.evidence, /本趋势不直接触发/);

  assert.ok(app.includes('["approvedBudget", "最终批准费用预算"'));
  assert.ok(app.includes('["预算执行结构", structures.rate]'));
  assert.ok(app.includes('["成本与毛利结构", structures.finance]'));
  assert.equal(source.includes('["执行结构", "项目余额结构"]'), false);
});

test("M06适配器运行时统一六类规范Action名称", () => {
  const source = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"), "utf8");
  const owners = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/external-owners.js"), "utf8");
  for (const name of ["预算执行整改", "下一年度预算合理性复核", "费用管理优化核查", "预算申报依据补充", "采购占用清理", "供应商价格复核"]) assert.ok(source.includes(name), `缺少预算评价整改Action名称：${name}`);
  for (const text of [source, owners]) {
    assert.ok(text.includes('"HIT-003-2025-AQ": { id: "AR-S002-003"'), "HIT-003成本占收比事项未对齐AR-S002-003");
    assert.ok(text.includes('"HIT-002-2025-AQ": { id: "AR-S002-004"'), "HIT-002-2025-AQ预算执行事项未对齐AR-S002-004");
    assert.equal(text.includes('"HIT-002-2024-JS"'), false, "M06仍保留已移除的HIT-002-2024-JS映射");
  }
  const app = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/app.js"), "utf8");
  assert.match(app, /simulateVerificationTimeout && v\.attempt === 1/);
  assert.ok(app.includes("自动核验 · ${verification.coverage.completed || 0}/${verification.coverage.applicable || 0}"), "核验完成后未在页签回显覆盖数");
});

test("M06历史快照只读边界与驾驶舱六专题保持明确", () => {
  const app = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/app.js"), "utf8");
  const adapter = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"), "utf8");
  assert.ok(app.includes('"historical-readonly"'));
  assert.ok(app.includes("isHistoricalReadOnlyContext"));
  assert.ok(app.includes("HISTORICAL_READONLY_WRITE_ACTIONS"));
  assert.ok(app.includes("核验结果不会保存到历史快照"));
  assert.ok(adapter.includes("S002_M06_INITIAL_STATE"));
  assert.ok(adapter.includes("annualComparisons"));
  assert.ok(adapter.includes("submissionComparisons"));
  assert.ok(app.includes("normalizeS002Trend"));
  assert.ok(app.includes('["2024", 96.8488]') && app.includes('["2025", 78.50]'), "历史预算趋势缺少显式迁移值");
  assert.ok(adapter.includes('readiness: "可消费"') && adapter.includes('compatibility: "兼容"'), "报告绑定快照缺少就绪或兼容状态");
  assert.ok(adapter.includes('contentItemId: anchor.contentItemId'), "T044绑定缺少内容项身份");
  for (const tab of ["变动成本执行率", "项目立项余额", "差旅费分析", "跨年计提差异", "年末采购/预算占用集中度", "供应商/人月成本"]) assert.ok(app.includes(tab), `缺少驾驶舱专题：${tab}`);
});

test("M06预算报告直接使用六章预算正文并保留基线报告阅读生命周期", () => {
  const app = fs.readFileSync(path.join(root, "baseline-adapters/m06/report-center/review-lifecycle/app.js"), "utf8");
  for (const chapter of ["预算执行概览", "成本效率与真正毛利率", "项目余额与采购占用", "单位、跨年与初始申报", "异常与关注事项", "证据、质量与边界"]) {
    assert.ok(app.includes(chapter), `缺少预算报告章节：${chapter}`);
  }
  assert.ok(app.includes("function s002ReportPaper("));
  assert.ok(app.includes('if (DATA.product?.semanticVersion === "S002-ONTO-v1") return s002ReportPaper'));
  assert.ok(app.includes('aria-label="S002预算监督管理报告正文"'));
  assert.ok(app.includes("报告草稿与驾驶舱发布分离"));
  assert.ok(app.includes("start-verification") && app.includes("verificationUnitResults(report, scopeContext, planSnapshot"));
  assert.ok(app.includes("概率安全分析项目为什么命中 R01？"), "报告助手R01推荐问题未使用项目级准确主体");
  assert.equal(app.includes("单位553为什么命中 R01？"), false, "报告助手仍保留错误的单位级R01主体");
});
