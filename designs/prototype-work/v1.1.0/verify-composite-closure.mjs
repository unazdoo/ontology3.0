import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const json = (relative) => JSON.parse(read(relative));

const version = json("VERSION.json");
assert.equal(version.targetVersion, "v1.1.0-rc.10");
assert.equal(version.acceptanceReady, false);
assert.equal(version.activeScenarioRunId, null);
assert.equal(version.runtimeSnapshotIncluded, false);
assert.equal(version.legacyRestoreEntry, null);
assert.equal(version.entry, "s001-e2e-integration/index.html");

const integrity = json(version.integrityManifest);
assert.equal(integrity.candidateVersion, version.targetVersion);
assert.equal(integrity.reviewRevision, version.reviewRevision);
assert.equal(integrity.acceptanceReady, false);
assert.equal(integrity.allFilesPresent, true);
for (const files of Object.values(integrity.components)) {
  for (const item of files) {
    const absolutePath = path.join(root, item.path);
    assert.ok(fs.existsSync(absolutePath), `${item.path} integrity target missing`);
    const actual = crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
    assert.equal(actual, item.sha256, `${item.path} integrity mismatch`);
  }
}

const registryContext = vm.createContext({ window: {} });
vm.runInContext(read("composite-resource-registry.js"), registryContext);
const registry = registryContext.window.OFW_COMPOSITE_REGISTRY;
assert.deepEqual(Array.from(registry.scenes, (item) => item.scenarioId), ["S001", "S002", "S003", "S004"]);
assert.ok(registry.scenes.every((item) => item.status === "completed"));
assert.equal(registry.workflow.S001.completed, 15);
assert.equal(registry.workflow.S002.completed, 13);
assert.equal(registry.workflow.S003.completed, 15);
assert.equal(registry.workflow.S004.completed, 15);
assert.equal(registry.dataEngineering.S002.combinationAsset, "S002-DATA-v1");
assert.deepEqual(Array.from(registry.dataEngineering.S002.assets), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
assert.equal(registry.dataEngineering.S004.assets[0], "DATA-ASSET-S004-20260815-V01");
assert.equal(registry.query.S001.configId, "IQ-AGENT-S001-FINANCING");
assert.equal(registry.ontology.S004.semanticVersionId, "SEM-S004-PREFLIGHT-V1");
assert.equal(registry.ontology.S004.pointer, "REC-T019-S004-20260815");
assert.equal(registry.chain.S002.M04.status, "not_applicable");
assert.equal(registry.chain.S004.M03.status, "not_applicable");
assert.equal(registry.chain.S004.M04.status, "not_applicable");

const reportContext = vm.createContext({ window: {}, console });
reportContext.window = reportContext;
vm.runInContext(read("report-center/review-lifecycle/portfolio-integration.js"), reportContext);
vm.runInContext(read("report-center/review-lifecycle/canonical-data.js"), reportContext);
const reportData = reportContext.RC_CANONICAL_DATA;
assert.equal(reportData.reports.length, 24);
assert.equal(reportData.definitions.length, 4);
assert.equal(new Set(reportData.reports.map((item) => item.reportNo)).size, 24);
assert.ok(reportData.reports.every((item) => item.status === "已发布"));
for (const report of reportData.reports) {
  assert.deepEqual(Array.from(report.formats), ["HTML", "PDF"]);
  assert.ok(fs.existsSync(path.resolve(root, "report-center/review-lifecycle", report.html)), `${report.reportNo} HTML missing`);
  assert.ok(fs.existsSync(path.resolve(root, "report-center/review-lifecycle", report.pdf)), `${report.reportNo} PDF missing`);
}
const s001Report = reportData.reports.find((item) => item.category === "融资经营分析");
assert.equal(s001Report.reportNo, "RPT-20260816-092626-010");
assert.equal(s001Report.version, "2.0.0");
assert.equal(s001Report.dataVersion, "FIN-ASSET-20251231-v02");
const s003Report = reportData.reports.find((item) => item.scope === "环保测试公司4");
assert.equal(s003Report.reportNo, "RISK-020-2025");
assert.equal(s003Report.version, "1.7.0");
assert.equal(s003Report.evidenceId, "企业风险证据包 · S003-ENT-020");
const s004Report = reportData.reports.find((item) => item.category === "贷前调查");
assert.equal(s004Report.dataVersion, "DATA-ASSET-S004-20260815-V01");
assert.match(s004Report.semanticVersion, /SEM-S004-PREFLIGHT-V1/);

const reportHtmlFiles = [
  "report-center/review-lifecycle/portfolio-assets/s001-financing-report.html",
  "report-center/review-lifecycle/portfolio-assets/s002-budget-report.html",
  ...fs.readdirSync(path.join(root, "report-center/review-lifecycle/portfolio-assets/s003")).filter((name) => name.endsWith(".html")).map((name) => `report-center/review-lifecycle/portfolio-assets/s003/${name}`),
  "scenarios/s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.html"
];
// Published is a legitimate business lifecycle status in formal reports; only
// review-stage and unresolved-contract wording is forbidden in user-facing artifacts.
const forbiddenReportCopy = /演示|模拟|原型|非真实|\bC008\b|待总控裁决|合同冲突/;
for (const file of reportHtmlFiles) assert.doesNotMatch(read(file), forbiddenReportCopy, `${file} contains review-only copy`);

const dashboardContext = vm.createContext({ window: { RC_PORTFOLIO: reportContext.RC_PORTFOLIO } });
vm.runInContext(read("dashboard/data.js"), dashboardContext);
const dashboards = dashboardContext.window.DASHBOARD_DATA.dashboards;
assert.equal(dashboards.length, 3);
const financing = dashboards.find((item) => item.id === "financing");
assert.equal(financing.actions.filter((item) => item.status === "执行中").length, 1);
assert.equal(financing.actions.filter((item) => item.status === "待人工确认").length, 2);
const budget = dashboards.find((item) => item.id === "budget");
assert.deepEqual(Array.from(budget.topics, (item) => item.id), ["cost", "project", "travel", "accrual", "concentration", "supplier"]);
assert.ok(budget.topics.every((item) => budget.details[item.id]?.length >= 3));
const riskDashboard = dashboards.find((item) => item.id === "risk");
assert.equal(riskDashboard.companies.length, 21);
assert.equal(riskDashboard.companies.filter((item) => item.report).length, 21);
assert.ok(financing.metrics.every((item) => item.trend === "flat"));

const queryPortfolio = read("intelligent-query-prototype/review-next/conversation-workspace/portfolio-integration.js");
const queryApp = read("intelligent-query-prototype/review-next/conversation-workspace/app.jsx");
assert.match(queryPortfolio, /name: "智能问数助手"/);
assert.match(queryPortfolio, /同一助手按业务域固定唯一 C009 绑定档案/);
assert.match(queryApp, /全部.*融资成本.*债务风险.*融资管理/s);
assert.doesNotMatch(queryPortfolio, /recommendation\([^\n]+"S004"/);

const decisionApp = read("decision-center-prototype/review-v2/shared/app.jsx");
const decisionPortfolio = read("decision-center-prototype/review-v2/shared/portfolio-integration.js");
assert.match(decisionApp, /AI 摘要/);
assert.match(decisionApp, /读取行动申请与 Rule/);
assert.match(decisionApp, /追踪待办/);
assert.doesNotMatch(decisionApp, /查看运营概览/);
assert.match(decisionPortfolio, /function dynamicS003Requests\(context\)/);
assert.match(decisionPortfolio, /c017ReadForRequest\(request, c017\)/);

const agentApp = read("agent-application/app.jsx");
const agentPortfolio = read("agent-application/portfolio-integration.js");
assert.match(agentApp, /Prompt 规定任务和表达边界/);
assert.match(agentApp, /一次 Agent 运行如何被复核/);
assert.match(agentApp, /back=\{\(\) => navigate\("agents"\)\}/);
assert.match(agentPortfolio, /report-verification-agent/);
assert.match(agentPortfolio, /submitVerification/);
assert.match(agentPortfolio, /Report Verification Extraction/);
assert.match(agentPortfolio, /determinationStatus: "not-evaluated"/);
assert.doesNotMatch(agentPortfolio, /determinationStatus: "passed"|determinationStatus: "failed"/);

const canonicalReportApp = read("report-center/review-lifecycle/canonical-app.js");
const nativeRiskReportApp = read("report-center/review-lifecycle/s003-app.js");
assert.match(canonicalReportApp, /全部正式报告/);
assert.match(canonicalReportApp, /待复核内容/);
assert.match(canonicalReportApp, /集团经营报告/);
assert.doesNotMatch(canonicalReportApp, /亮灯企业报告/);
assert.match(canonicalReportApp, /本月发布/);
assert.doesNotMatch(canonicalReportApp, /查看追溯/);
assert.match(canonicalReportApp, /function syncReportScenarioIdentity\(report\)/);
assert.match(canonicalReportApp, /function startReportVerification\(report\)/);
assert.match(canonicalReportApp, /runtime\.submitVerification/);
assert.match(canonicalReportApp, /1 个 Agent 抽取批次/);
assert.match(canonicalReportApp, /class="module-nav" aria-label="报告中心导航"/);
assert.match(canonicalReportApp, /新增报告定义/);
assert.match(canonicalReportApp, /Agent 抽取声明/);
assert.match(canonicalReportApp, /证据定位与规则方法/);
assert.match(canonicalReportApp, /确定性通过判据/);
assert.doesNotMatch(canonicalReportApp, /data-tab="comparison"/);
assert.doesNotMatch(nativeRiskReportApp, /一期处置边界|一期不建设|S003 一期报告|原型记录路由/);

const dashboardApp = read("dashboard/app.js");
assert.match(dashboardApp, /风险总览/);
assert.match(dashboardApp, /产业与薄弱项/);
assert.match(dashboardApp, /风险处置行动/);
assert.match(dashboardApp, /模型与运行/);
assert.match(dashboardApp, /数据更新后重评/);
assert.match(dashboardApp, /模型调整后重评/);
assert.doesNotMatch(dashboardApp, /<h2>企业正式报告<\/h2>/);
assert.match(dashboardApp, /提交行动申请/);
assert.match(dashboardApp, /risk-action-confirm/);
assert.match(dashboardApp, /risk-action-submit/);
assert.match(dashboardApp, /risk-model-publish-run/);
assert.match(dashboardApp, /S003ScoreEngine\.scorePortfolio/);
assert.doesNotMatch(dashboardApp, /risk-open-m01/);
assert.match(dashboardApp, /S003-T007-DEBT-RISK-20251231-v1/);
assert.doesNotMatch(`${dashboardApp}\n${read("dashboard/data.js")}`, /S003-T007-FORMAL-CANDIDATE/);

const moduleDataContext = vm.createContext({ window: {} });
vm.runInContext(read("s001-e2e-integration/data.js"), moduleDataContext);
const integrationDirectory = path.join(root, "s001-e2e-integration");
for (const module of moduleDataContext.window.S001_DATA.modules) {
  const cleanSource = module.source.split("?")[0].split("#")[0];
  assert.ok(fs.existsSync(path.resolve(integrationDirectory, cleanSource)), `${module.id} entry missing`);
}
assert.ok(fs.existsSync(path.join(root, "dashboard/index.html")));
const shellApp = read("s001-e2e-integration/app.js");
assert.match(shellApp, /data-primary-nav="true"/);
assert.match(shellApp, /resetModuleRoutes\.add\(targetModule\)/);
assert.match(shellApp, /const sourceScenarioId = url\.searchParams\.get\("scenarioId"\)/);
assert.match(shellApp, /const requestedScenarioId = sourceScenarioId \|\| outerScenarioId/);

assert.match(agentPortfolio, /21,613\.387 亿元/);
assert.match(agentPortfolio, /2\.372231%/);
assert.match(agentPortfolio, /欧陆银行、寰宇银行、海联银行/);
assert.match(agentPortfolio, /RPT-20260816-092626-010/);
assert.match(agentPortfolio, /RISK-020-2025/);
assert.doesNotMatch(agentPortfolio, /118\.315亿元|2\.448%|浦发银行|建设银行/);

console.log("PASS composite closure: 4 scenarios, 7 workbenches, 24 HTML/PDF reports and cross-module identities verified.");
