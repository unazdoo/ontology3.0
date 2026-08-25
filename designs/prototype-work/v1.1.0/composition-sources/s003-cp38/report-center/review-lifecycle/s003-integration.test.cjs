const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = __dirname;
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const externalOwnersSource = fs.readFileSync(path.join(root, "external-owners.js"), "utf8");
const lifecycleCss = fs.readFileSync(path.join(root, "lifecycle.css"), "utf8");
const scenarioRoot = path.join(root, "../../scenarios/s003");
const manifest = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m06/report-manifest.v9.json"), "utf8"));
const contents = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m06/report-contents.v9.json"), "utf8"));
const artifacts = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m06/report-artifacts.v9.json"), "utf8"));
const assurance = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m06/report-assurance-profile.v3.json"), "utf8"));
const definition = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m06/report-definition.v2.json"), "utf8"));
const template = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m06/report-template.v2.json"), "utf8"));
const actionTypeCatalog = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m01/action-type-catalog.v2.json"), "utf8"));
const riskResults = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m01/c035-risk-results.v2.json"), "utf8"));
const enterpriseContactRouting = JSON.parse(fs.readFileSync(path.join(scenarioRoot, "resources/m04/enterprise-contact-routing.v1.json"), "utf8"));

function sourceBetween(start, end) {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing ${end}`);
  return appSource.slice(from, to);
}

function createOwnerRuntime(seed = {}) {
  const values = new Map(Object.entries(seed));
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const sandbox = {
    console,
    Date,
    Intl,
    JSON,
    URLSearchParams,
    structuredClone,
    localStorage,
    location: {
      search: "?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=S003-RUN-20260815133000000-c03503000001&formedAt=2026-08-15T13%3A30%3A00.000Z&status=active"
    },
    OFWScenarioFoundation: { STORAGE_SCHEMA_VERSION: "ofw.namespaced-storage.v1" }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(externalOwnersSource, sandbox, { filename: "external-owners.js" });
  return sandbox;
}

test("M06 registers all 21 S003 Published enterprise reports in the baseline report provider", () => {
  assert.equal(manifest.reportCount, 21);
  assert.equal(contents.reportCount, 21);
  assert.equal(manifest.reports.length, 21);
  assert.equal(contents.reports.length, 21);
  const contentIds = new Set(contents.reports.map((record) => record.reportId));
  for (const report of manifest.reports) {
    assert.ok(contentIds.has(report.reportId), report.reportId);
    assert.equal(report.scenarioIdentity.scenarioId, "S003");
    assert.equal(report.scenarioIdentity.scenarioRunId, manifest.scenarioIdentity.scenarioRunId);
  }
  assert.match(appSource, /function s003ReportProvider\(/);
  assert.match(appSource, /stage: contextState\.projectionOnly \? "runtime-preview" : "published"/);
  assert.match(appSource, /function s003CatalogItems\(provider = s003NativeProvider\(\)\)[\s\S]*?provider\.reports\.map/);
  assert.equal(manifest.manifestVersion, "1.7.0");
  assert.equal(contents.contentSetVersion, "1.7.0");
  assert.ok(contents.reports.every((item) => item.content.chapterOrder.length === 9));
});

test("S003 resources are registered inside baseline lifecycle, catalog and generation renderers", () => {
  assert.doesNotMatch(appSource, /function renderS003(?:Lifecycle|Reports|Generate)\(/);
  const lifecycle = sourceBetween("function renderLifecycle()", "function renderReports()");
  const reports = sourceBetween("function renderReports()", "function generationProgress()");
  const generate = sourceBetween("function renderGenerate()", "function reportChapters()");
  assert.match(lifecycle, /const s003 = s003ScenarioSelected\(\)/);
  assert.match(lifecycle, /data-screen-label="报告目录"/);
  assert.match(lifecycle, /ledger-toolbar/);
  assert.match(lifecycle, /s003-open-report/);
  assert.match(reports, /const provider = s003 \? s003NativeProvider\(\) : null/);
  assert.match(reports, /data-screen-label="报告资源管理"/);
  assert.match(reports, /报告定义/);
  assert.match(reports, /报告模板/);
  assert.match(generate, /data-screen-label="报告生成工作区"/);
  assert.match(generate, /workflow-strip/);
  assert.doesNotMatch(appSource, /return renderS003(?:Lifecycle|Reports|Generate)\(\)/);
});

test("S003 keeps the v1.0.3 six-stage report lifecycle and only injects same-run evidence", () => {
  const lifecycle = sourceBetween("function renderLifecycle()", "function renderReports()");
  for (const label of ["创建", "固定证据", "内容生成", "核验复核", "形成产物", "发布历史"]) {
    assert.match(lifecycle, new RegExp(`\\[\\"${label}\\"`));
  }
  assert.match(lifecycle, /S003 只注入每一阶段的同运行证据/);
  assert.match(lifecycle, /provider\.definition\?\.id/);
  assert.match(lifecycle, /providerResources\.results\?\.inputIdentity\?\.dataAssetId/);
  assert.match(lifecycle, /providerResources\.reportAssurance\?\.verificationChecks\?\.length/);
  assert.match(lifecycle, /历史记录可追溯/);
  assert.match(lifecycle, /s003 \? "确定性形成结构化内容项" : "Agent 返回结构化内容项"/);
});

test("S003 dashboard stays in the public dashboard route and report-center navigation has no dedicated workbench tab", () => {
  assert.doesNotMatch(appSource, /product-nav-item[^`]*S003 场景工作台/);
  assert.match(appSource, /const catalogReportCount = s003ScenarioSelected\(\)[\s\S]*?publishedReportCount/);
  assert.match(appSource, /providerPublishedReportCount/);
  assert.match(appSource, /Math\.max\(Number\(options\.publishedReportCount \|\| 0\), providerPublishedReportCount\)/);
  assert.match(appSource, /<span>报告目录<\/span><em>\$\{catalogReportCount\}<\/em>/);
  assert.match(appSource, /path === "\/dashboard\/s003" && s003ScenarioSelected\(\)\) html = renderS003Dashboard\(\)/);
  assert.match(appSource, /data-action="s003-navigate-module" data-module="ontology"/);
  assert.match(appSource, /S003-M01-DEBT-RISK-V1/);
  assert.match(appSource, /tab: "s003-model-config"/);
  assert.match(appSource, /requestS003ShellAction\("navigateScenarioModule", \{ moduleId, hash \}\)/);
  const dashboard = sourceBetween("function renderS003Dashboard()", "function renderScenes()");
  assert.doesNotMatch(dashboard, /data-tab="configuration"/);
  assert.doesNotMatch(dashboard, />因子与风险配置</);
  assert.match(appSource, /scene\.id === "S003" && S003_CONFIG && s003ScenarioSelected\(\)/);
});

test("dashboard run switching reads formal, active and historical runs without borrowing another run's details", () => {
  const options = sourceBetween("function s003RunOptions", "function s003SummaryOnlyResources");
  const resources = sourceBetween("function s003ResourcesForRun", "async function loadS003Dashboard");
  assert.match(options, /snapshot\?\.activeRun/);
  assert.match(options, /snapshot\?\.runHistory/);
  assert.match(options, /snapshot\?\.lastSuccessfulRun/);
  assert.match(options, /formal\.runId/);
  assert.match(resources, /s003SummaryOnlyResources/);
  assert.match(resources, /s003RuntimeResources/);
  assert.match(appSource, /data-change="s003-run-selection"/);
  assert.match(appSource, /该历史运行没有逐户明细投影/);
  assert.match(appSource, /请从对应 Checkpoint 克隆恢复/);
});

test("an explicit non-S003 URL cannot inherit stale S003 browser context", () => {
  const requestedContext = sourceBetween("function s003RequestedContext()", "function s003ScenarioSelected()");
  assert.match(requestedContext, /if \(explicit\.scenarioId\) return explicit/);
  assert.doesNotMatch(requestedContext, /explicit\.scenarioId === S003_CONFIG\?\.id \? explicit : activeScenarioContext\(\)/);
});

test("M06 delegates the unified model configuration to M01 and submits actions through generic C011", () => {
  const actionRequestBuilder = sourceBetween("function s003ActionRequestForCandidate", "function s003RunSelector");
  assert.match(appSource, /function s003ModelConfigurationHash/);
  assert.match(appSource, /configTab: sectionId/);
  assert.match(appSource, /function s003ConfigurationDelta\(/);
  assert.match(appSource, /function s003ModelConfigFingerprint\(/);
  assert.match(appSource, /configurationModel\?\.packageVersion/);
  assert.match(appSource, /configurationDelta\.ahead/);
  assert.match(appSource, /const currentModel = staticResources\.publishedModel/);
  assert.match(appSource, /const currentInput = staticResources\.inputSnapshot/);
  assert.doesNotMatch(appSource, /runModelVersion && currentModel\?\.packageVersion && runModelVersion !== currentModel\.packageVersion/);
  assert.match(appSource, /function s003ActionRequestForCandidate/);
  assert.match(appSource, /function s003MemberUnitDecisionRoute/);
  assert.match(appSource, /routingTarget: clone\(route\.routingTarget\)/);
  assert.match(appSource, /decisionRecipient: clone\(route\.decisionRecipient\)/);
  assert.match(appSource, /recipientRole: route\.recipientRole/);
  assert.match(appSource, /recipientName: route\.recipientName/);
  assert.match(appSource, /recipientId: route\.recipientId/);
  assert.match(appSource, /recommendedTaskOwner: route\.recommendedTaskOwner/);
  assert.match(appSource, /recommendedTaskOwnerId: route\.recommendedTaskOwnerId/);
  assert.match(actionRequestBuilder, /owner: null,[\s\S]*?ownerId: null,[\s\S]*?decisionRecipient: clone\(route\.decisionRecipient\)/);
  assert.doesNotMatch(actionRequestBuilder, /owner: route\.recipientName|owner: route\.recommendedTaskOwner/);
  assert.match(appSource, /dataVersion: inputIdentity\.dataAssetId/);
  assert.match(appSource, /dataAssetId: inputIdentity\.dataAssetId/);
  assert.match(appSource, /sourceType: "report"/);
  assert.match(appSource, /rule: null/);
  assert.match(appSource, /OWNERS\.decision\.submitAction\(payload\)/);
  const submitHandler = sourceBetween('if (action === "s003-submit-action-request")', 'if (action === "s003-open-action-request")');
  const afterNewSubmission = submitHandler.slice(submitHandler.indexOf("OWNERS.decision.submitAction(payload)"));
  assert.doesNotMatch(afterNewSubmission, /navigateScenarioModule/);
  assert.match(submitHandler, /驾驶舱保留当前位置/);
  assert.match(submitHandler, /已送达成员单位接口人/);
  assert.match(submitHandler, /确认后再提交分办任务/);
  assert.match(appSource, /code: "PENDING_SUBMISSION", label: "待提交行动申请"/);
  assert.match(appSource, /code: "REQUEST_SUBMITTED", label: request\.requestGate\?\.status === "accepted" \? "已送达成员单位接口人 · 待确认" : "已送达成员单位接口人"/);
  assert.match(submitHandler, /candidate\.routeConfigured === false/);
  assert.match(submitHandler, /成员单位接口人未配置/);
  assert.match(appSource, /提交行动申请/);
  assert.match(appSource, /requestS003ShellAction\("requestScenarioRerun"/);
  assert.match(appSource, /function s003CandidateActionControl/);
  assert.match(appSource, /surface === "report"/);
  assert.match(appSource, /data-action="s003-open-dashboard-candidate"/);
  assert.match(appSource, /前往驾驶舱提交/);
  assert.match(appSource, /requestS003ShellAction\("openS003DashboardCandidate", \{ candidateId, enterpriseId \}\)/);
  assert.match(appSource, /历史记录仅供查看，不重复发送行动申请/);
  assert.match(appSource, /切换正式评分后提交/);
  assert.match(appSource, /data-action="s003-switch-formal-run"/);
  assert.match(externalOwnersSource, /getCurrentScenarioContext: activeScenario/);
  assert.match(externalOwnersSource, /const active = decisionProjection\.getCurrentScenarioContext\(\)/);
  assert.doesNotMatch(externalOwnersSource, /submitAction\(payload\)[\s\S]*?localStorage\.getItem\(PLATFORM_SCENARIO_CONTEXT_KEY\)/);
});

test("M06 reads the current S003 C019 projection from the M04 namespaced owner record", () => {
  const scenarioContext = {
    scenarioId: "S003",
    scenarioVersion: "S003-v1",
    scenarioRunId: "S003-RUN-20260815133000000-c03503000001",
    formedAt: "2026-08-15T13:30:00.000Z",
    status: "active"
  };
  const logicalKey = "decision-center.c019.projection.v1";
  const physicalKey = `ofw:v1.1.0:${scenarioContext.scenarioId}:${scenarioContext.scenarioVersion}:${scenarioContext.scenarioRunId}:m04:${encodeURIComponent(logicalKey)}`;
  const projection = {
    contractCode: "C019",
    schemaVersion: 1,
    owner: "决策中心",
    consumer: "报告中心",
    scenarioContext,
    summaryAsOf: "2026-08-15 14:30:00",
    records: [
      ["AR-PENDING-1", "DR-PENDING-1", "S003-ENT-007", "风电测试公司07", "awaiting", "待决策", null],
      ["AR-PENDING-2", "DR-PENDING-2", "S003-ENT-017", "环保测试公司1", "awaiting", "待决策", null],
      ["AR-PENDING-3", "DR-PENDING-3", "S003-ENT-018", "环保测试公司2", "awaiting", "待决策", null],
      ["AR-DONE-1", "DR-DONE-1", "S003-ENT-020", "环保测试公司4", "confirmed", "已处理", "TD-DONE-1"]
    ].map(([requestId, reminderId, enterpriseId, enterpriseName, requestStatus, reminderStatus, taskId]) => ({
      scenarioContext,
      requestStatus,
      reminderStatus,
      decisionStatus: taskId ? "confirm" : null,
      taskStatus: taskId ? "pending" : null,
      businessSubject: { id: enterpriseId, name: enterpriseName },
      semanticVersion: "S003-M01-DEBT-RISK-PKG 1.0.1",
      dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
      requestRef: { targetType: "request", targetId: requestId, stableDetailEntry: `#request/${requestId}` },
      reminderRef: { targetType: "reminder", targetId: reminderId, stableDetailEntry: `#reminder/${reminderId}` },
      taskRef: taskId ? { targetType: "task", targetId: taskId, stableDetailEntry: `#task/${taskId}` } : null,
      traceRef: { targetType: "trace", targetId: `TR-${requestId}`, stableDetailEntry: `#trace/request/${requestId}` }
    }))
  };
  const runtime = createOwnerRuntime({
    [physicalKey]: JSON.stringify({
      schemaVersion: "ofw.namespaced-storage.v1",
      scenarioContext,
      savedAt: "2026-08-15T14:30:00.000Z",
      payload: projection
    }),
    "ontology3.decision-center.c019.projection.v1": JSON.stringify({
      contractCode: "C019",
      schemaVersion: 1,
      owner: "决策中心",
      scenarioContext: { ...scenarioContext, scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-SENTINEL" },
      records: []
    })
  });

  const diagnostic = runtime.RC_EXTERNAL_OWNERS.decision.diagnose();
  const summaries = runtime.RC_EXTERNAL_OWNERS.decision.listScenarioSummaries();

  assert.equal(diagnostic.available, true);
  assert.equal(diagnostic.recordCount, 4);
  assert.equal(diagnostic.sourceKey, physicalKey);
  assert.equal(summaries.length, 4);
  assert.deepEqual(summaries.map((item) => item.status), ["awaiting", "awaiting", "awaiting", "confirmed"]);
  assert.deepEqual(summaries.map((item) => item.reminderStatus), ["待决策", "待决策", "待决策", "已处理"]);
  assert.equal(summaries[3].decisionStatus, "confirm");
  assert.equal(summaries[3].taskStatus, "pending");
  assert.ok(summaries.every((item) => item.scenarioContext.scenarioId === "S003"));
  assert.match(externalOwnersSource, /decision-center\.c019\.projection\.recovered\.v1/);
  assert.match(externalOwnersSource, /ofw:v1\.1\.0:/);
});

test("S003 dashboard and enterprise report meet the reference information-density floor without adding business rules", () => {
  const overview = sourceBetween("function s003Overview()", "function s003DashboardProjection(mode)");
  const dashboardProjection = sourceBetween("function s003DashboardProjection(mode)", "function s003ReportValue(value)");
  const riskAnalysis = sourceBetween("function s003RiskAnalysis(results)", "function s003ReportManagementFocus(content, candidates)");
  const formalReport = sourceBetween("function renderS003FormalReport()", "function s003Operations()");
  assert.match(overview, /风险分档分布与判定口径/);
  assert.match(overview, /预警企业<\/span><strong>\$\{attentionEnterpriseCount\}/);
  assert.match(dashboardProjection, /querySelector\("\.s003-overview-industry"\)\?\.remove/);
  assert.match(dashboardProjection, /actionPanel\?\.remove/);
  assert.match(riskAnalysis, /产业风险分布/);
  assert.match(riskAnalysis, /共性薄弱指标/);
  assert.match(riskAnalysis, /s003SectorCard\(sector, \{ selectedSector \}\)/);
  assert.match(riskAnalysis, /s003SortDetailRows\(detailRows\)/);
  assert.match(appSource, /s003-sector-metrics/);
  assert.match(appSource, /reportIndexLayout: "list"/);
  assert.match(appSource, /综合分升序/);
  assert.doesNotMatch(overview, /亮灯预警候选<\/span><strong>\$\{candidates\.length\}/);
  assert.doesNotMatch(overview, /风险行动进度<\/span><strong>\$\{awaitingCount\}/);
  assert.doesNotMatch(overview, /待推送|已推送成员单位/);
  assert.match(overview, /s003RiskActionTypeForTier/);
  assert.doesNotMatch(overview, /重大风险因子纳入关注|S003_FACTOR_EMERGENCY/);
  assert.match(overview, /查看企业报告/);
  assert.match(overview, /s003CandidateActionControl/);
  assert.match(overview, /s003TierActionLabel/);
  assert.match(appSource, /YELLOW: "黄灯预警"/);
  assert.match(appSource, /RED: "红灯预警"/);
  assert.match(appSource, /BLACK: "黑灯预警"/);
  assert.match(overview, /接收接口人/);
  assert.match(overview, /确认后建议分办/);
  assert.match(overview, /企业风险评分明细/);
  assert.match(dashboardProjection, /mode === "actions"/);
  assert.match(dashboardProjection, /s003-action-workspace/);
  assert.doesNotMatch(dashboardProjection, /运行与快照/);
  assert.match(formalReport, /关键风险诊断说明/);
  assert.match(formalReport, /风险应对策略与改善建议/);
  assert.match(formalReport, /未来三个月行动建议/);
  assert.match(formalReport, /不改变模型阈值，也不自动创建行动申请或待办/);
  assert.match(appSource, /自动核验/);
  assert.match(appSource, /报告问答/);
  assert.match(formalReport, /content\.keyRiskDiagnosis/);
  assert.match(formalReport, /content\.responseStrategy/);
  assert.match(formalReport, /content\.threeMonthActionPlan/);
  assert.match(formalReport, /s003ReportIndicatorValue/);
  assert.match(formalReport, /s003-management-strategy-grid/);
  assert.match(formalReport, /s003ConcreteReportStrategy/);
  assert.match(appSource, /5 个工作日内由财务负责人/);
  assert.match(appSource, /责任角色：资金负责人/);
  assert.match(appSource, /底层合同：/);
  assert.match(formalReport, /s003EvidenceTypeLabel\(item\.evidenceType\)/);
  assert.match(formalReport, /重大因子作为亮灯预警的补充证据/);
  assert.doesNotMatch(formalReport, /评分分档与重大因子管理信号分开判断/);
  const managementPortfolios = contents.reports.flatMap((report) => report.content.responseStrategy.managementPortfolios || []);
  assert.ok(managementPortfolios.some((item) => item.title === "流动性与偿债安排"));
  assert.ok(managementPortfolios.some((item) => item.title === "融资、担保及诉讼风险管理"));
  assert.ok(managementPortfolios.some((item) => item.title === "监测、复评与证据留存"));
  assert.match(formalReport, /const actualValue = diagnosis\.actualValueDisplay \|\| s003ReportIndicatorValue/);
  assert.match(formalReport, /实际值 \$\{actualValue\}/);
  assert.match(appSource, /APPLIED: "已采用"/);
  assert.match(appSource, /NOT_APPLICABLE: "业务不适用"/);
  assert.match(appSource, /DEFAULTED_ZERO: "缺失套零档"/);
});

test("dashboard sector and weakness cards enter one drill workspace and keep action presentation tier-first", () => {
  const handlers = sourceBetween('if (action === "s003-set-tab")', 'if (action === "s003-retry-load")');
  assert.match(handlers, /s003Dashboard\.tab = "analysis"/);
  assert.match(handlers, /s003Dashboard\.analysisSector = element\.dataset\.sector/);
  assert.match(handlers, /s003Dashboard\.analysisIndicator = element\.dataset\.indicator/);
  const projection = sourceBetween("function s003DashboardProjection(mode)", "function s003ReportValue(value)");
  assert.match(projection, /querySelector\("\.s003-overview-industry"\)\?\.remove/);
  assert.match(appSource, /function s003CandidateTierLabel\(candidate\)/);
  assert.match(appSource, /底层 Action Type 标识仍用于合同追溯/);
});

test("dashboard risk legend keeps all four lamp colors prominent and distinguishable", () => {
  const projection = sourceBetween("function s003DashboardProjection(mode)", "function s003ReportValue(value)");
  assert.match(projection, /s003-risk-legend-item s003-risk-legend-\$\{tone\}/);
  assert.match(lifecycleCss, /\.s003-risk-legend>\.s003-risk-legend-green\{--s003-risk-lamp:#267157/);
  assert.match(lifecycleCss, /\.s003-risk-legend>\.s003-risk-legend-yellow\{--s003-risk-lamp:#c7830a/);
  assert.match(lifecycleCss, /\.s003-risk-legend>\.s003-risk-legend-red\{--s003-risk-lamp:#b8453e/);
  assert.match(lifecycleCss, /\.s003-risk-legend>\.s003-risk-legend-black\{--s003-risk-lamp:#29313a/);
  assert.match(lifecycleCss, /\.s003-risk-legend \.s003-risk-dot\{[^}]*background:var\(--s003-risk-lamp\)[^}]*box-shadow:0 0 0 2px var\(--s003-risk-lamp\)/);
  assert.match(lifecycleCss, /border-top:4px solid var\(--s003-risk-lamp\)/);
  assert.match(projection, /const tone = String\(button\.dataset\.risk \|\| "unknown"\)\.toLowerCase\(\)/);
});

test("missing checkpoint catalog entries warn without blocking Published dashboard resources", () => {
  const loader = sourceBetween("async function loadS003Dashboard()", "function currentPublishedReports()");
  assert.match(loader, /Promise\.allSettled/);
  assert.match(loader, /checkpointIssues/);
  assert.doesNotMatch(loader, /throw new Error\(`checkpoint \$\{response\.status\}/);
  assert.match(appSource, /评分结果、企业报告和驾驶舱仍可正常查看/);
});

test("S003 report table of contents scrolls the baseline report viewport explicitly", () => {
  assert.match(appSource, /viewport\.scrollTo\(\{ top: Math\.max\(0, viewport\.scrollTop \+ sectionRect\.top - viewportRect\.top - 16\)/);
});

test("M06 has no obsolete private configuration or candidate-entry implementation", () => {
  assert.doesNotMatch(appSource, /function s003Configuration\(/);
  assert.doesNotMatch(appSource, /renderS003FormalReportLegacy/);
  assert.doesNotMatch(appSource, /s003-adopt-config-and-rerun/);
  assert.doesNotMatch(appSource, /s003-open-candidate/);
  assert.doesNotMatch(appSource, /打开专用配置页签|采用配置并快速重跑/);
});

test("formal S003 reports land in report center with deterministic verification companion and downloads", () => {
  assert.match(appSource, /function renderS003FormalReport\(\)/);
  assert.match(appSource, /function s003FormalReportHash/);
  assert.match(appSource, /#\/reports\/view/);
  assert.match(appSource, /path === "\/reports\/view"/);
  assert.match(appSource, /s003-open-formal-report/);
  assert.match(appSource, /return navigate\(hash\.slice\(1\)\)/);
  assert.match(appSource, /reader-shell s003-reader-shell/);
  assert.match(appSource, /reader-grid/);
  assert.match(appSource, /reader-toc/);
  assert.match(appSource, /report-viewport/);
  assert.match(appSource, /assistant-pane/);
  assert.match(appSource, /s003-jump-report-section/);
  assert.doesNotMatch(sourceBetween("function renderS003FormalReport()", "function s003Operations()"), /<a href="#s003-report-/);
  assert.match(appSource, /自动核验/);
  assert.match(appSource, /报告伴读/);
  assert.match(appSource, /s003-download-report-html/);
  assert.match(appSource, /s003-print-formal-report/);
  assert.match(appSource, /s003-download-template-json/);
});

test("formal report rendering fails closed instead of rebuilding missing business content in the UI", () => {
  const formalReport = sourceBetween("function renderS003FormalReport()", "function s003Operations()");
  assert.match(formalReport, /const contentReady = Boolean/);
  assert.match(formalReport, /正式报告内容版本不完整/);
  assert.match(formalReport, /已阻断备用文案拼装/);
  assert.doesNotMatch(formalReport, /diagnoseIndicator|recommendationFor|factorRecommendation/);
  assert.match(formalReport, /content\.responseStrategy\.managementPortfolios/);
  assert.match(formalReport, /content\.threeMonthActionPlan/);
});

test("S003 formal report keeps diagnosis, strategy, three-month plan and baseline reader assistant together", () => {
  const formalReport = sourceBetween("function renderS003FormalReport()", "function s003Operations()");
  assert.match(formalReport, /id="s003-report-diagnosis"/);
  assert.match(formalReport, /关键风险诊断说明/);
  assert.match(formalReport, /id="s003-report-strategy"/);
  assert.match(formalReport, /风险应对策略与改善建议/);
  assert.match(formalReport, /id="s003-report-three-months"/);
  assert.match(formalReport, /未来三个月行动建议/);
  assert.match(formalReport, /reader-toc/);
  assert.match(formalReport, /report-viewport/);
  assert.match(appSource, /function s003ReportAssistantPane/);
  assert.match(appSource, /assistant-pane/);
  assert.match(appSource, /assistant-tabs/);
  assert.match(appSource, /function s003ReportAssistantQA/);
  assert.match(appSource, /suggestion-list/);
  assert.match(appSource, /data-input="s003-companion-draft"/);
  assert.match(appSource, /function s003ReportAssistantVerification/);
  assert.match(appSource, /verification-summary/);
  assert.match(appSource, /verification-list/);
  assert.match(appSource, /s003-set-verification-filter/);
  assert.match(appSource, /s003-locate-verification/);
  assert.match(appSource, /s003-explain-verification/);
  assert.match(appSource, /s003-toggle-report-comparison/);
  assert.match(formalReport, /s003-report-company/);
  assert.match(formalReport, /s003-report-document-title/);
  assert.match(lifecycleCss, /\.s003-reader-shell \.assistant-pane\{grid-template-rows:auto auto minmax\(0,1fr\)\}/);
  assert.match(appSource, /assistant-content/);
  assert.match(lifecycleCss, /\.s003-formal-document\{container-type:inline-size/);
});

test("report assistant provides free questions, evidence navigation, current comparison and four-state verification", () => {
  assert.match(appSource, /placeholder="询问当前报告或所选章节"/);
  assert.match(appSource, /s003-submit-companion-agent/);
  assert.match(appSource, /定位正文/);
  assert.match(appSource, /打开证据/);
  assert.match(appSource, /与当前运行比较/);
  assert.match(appSource, /查看追溯/);
  for (const label of ["通过", "警告", "失败", "无法核验"]) assert.match(appSource, new RegExp(label));
  assert.match(appSource, /s003-set-verification-filter/);
  assert.match(appSource, /s003-locate-verification/);
  assert.match(appSource, /s003-explain-verification/);
  assert.match(appSource, /function s003VerificationSeverityLabel/);
  assert.match(appSource, /核验编号 \$\{item\?\.checkId/);
  assert.match(appSource, /assistant-content s003-assistant-content/);
});

test("runtime report projection preserves same-run action candidates without enabling submission", () => {
  const runtime = sourceBetween("function s003RuntimeResultRecord", "function s003RunOptions");
  assert.match(runtime, /dispositionCandidates: clone\(item\.candidateActions/);
  assert.match(runtime, /const runtimeCandidates = results\.flatMap/);
  assert.match(runtime, /status: "runtime-candidate-preview"/);
  assert.match(runtime, /projectionOnly: true/);
  assert.match(runtime, /candidatesBeforeConfirmation: runtimeCandidates/);
});

test("dashboard action queue is driven only by yellow, red and black risk tiers", () => {
  const candidateSource = sourceBetween("function s003RiskActionTypeForTier", "function s003CandidateTriggerText");
  const actionableResults = riskResults.results.filter((record) => ["YELLOW", "RED", "BLACK"].includes(record.riskTier.tierId));
  const tierCandidates = riskResults.results.flatMap((record) => (record.dispositionCandidates || [])
    .filter((candidate) => candidate.trigger?.type === "RISK_TIER")
    .map((candidate) => ({ enterpriseId: record.enterprise.enterpriseId, tierId: record.riskTier.tierId, candidate })));
  const greenFactorCandidates = riskResults.results.flatMap((record) => (record.dispositionCandidates || [])
    .filter((candidate) => record.riskTier.tierId === "GREEN" && candidate.trigger?.type === "MAJOR_FACTOR"));

  assert.equal(actionableResults.length, 5);
  assert.equal(tierCandidates.length, actionableResults.length);
  assert.equal(greenFactorCandidates.length, 0, "current Published results must not emit factor-only action candidates");
  assert.match(candidateSource, /if \(!\["YELLOW", "RED", "BLACK"\]\.includes\(tierId\)\) return null/);
  assert.match(candidateSource, /candidate\?\.trigger\?\.type === "RISK_TIER"/);
  assert.match(candidateSource, /s003RiskTierCandidateRecords/);
  assert.doesNotMatch(candidateSource, /trigger\?\.type === "MAJOR_FACTOR"/);
});

test("legacy group-owner requests do not masquerade as member-unit routing", () => {
  const routeSource = sourceBetween("function s003MemberUnitDecisionRoute", "function s003RiskTierCandidateRecords");
  const stateSource = sourceBetween("function s003CurrentDecisionState", "function s003DecisionCandidates");
  assert.equal(enterpriseContactRouting.routes.length, riskResults.results.length);
  assert.deepEqual(new Set(enterpriseContactRouting.routes.map((item) => item.enterpriseId)), new Set(riskResults.results.map((item) => item.enterprise.enterpriseId)));
  assert.ok(enterpriseContactRouting.routes.every((item) => item.decisionRecipient?.role === "成员单位债务风险接口人"));
  assert.match(routeSource, /resources\?\.enterpriseContactRouting\?\.routes/);
  assert.match(routeSource, /routeConfigured: false/);
  assert.match(routeSource, /type: "member-unit-decision-center"/);
  assert.match(routeSource, /role: configured\.decisionRecipient\.role \|\| "成员单位债务风险接口人"/);
  assert.match(routeSource, /decisionRecipient/);
  assert.match(routeSource, /recommendedTaskOwner/);
  assert.match(appSource, /该企业尚未配置成员单位债务风险接口人/);
  assert.match(stateSource, /code: "ROUTING_MISMATCH"/);
  assert.match(stateSource, /待按成员单位接口人重新提交/);
  assert.match(stateSource, /resubmittable: true/);
  assert.match(stateSource, /!request && formationState\.routeValid === false/);
  assert.match(stateSource, /既有记录由集团统一接收/);
});

test("decision workflow statuses are localized before dashboard and report presentation", () => {
  const statusLabel = sourceBetween("function s003WorkflowStatusLabel", "function s003CurrentDecisionState");
  assert.match(statusLabel, /pending: "待负责人处理"/);
  assert.match(statusLabel, /assigned: "待负责人处理"/);
  assert.match(statusLabel, /awaiting: "待决策"/);
  assert.match(statusLabel, /confirmed: "已处理"/);
  assert.match(statusLabel, /submitted: "已提交"/);
  assert.match(statusLabel, /accepted: "已接收"/);
  assert.match(statusLabel, /completed: "已完成"/);
  assert.match(statusLabel, /closed: "已关闭"/);
  assert.match(statusLabel, /rejected: "已退回"/);
  const sourceLabel = sourceBetween("function s003DecisionStateSourceLabel", "function s003CurrentDecisionState");
  assert.match(sourceLabel, /C011: "行动申请入口（C011）"/);
  assert.match(sourceLabel, /C019: "决策中心回读（C019）"/);
  assert.match(sourceLabel, /"report-formation": "报告形成时快照"/);
  assert.match(sourceLabel, /"legacy-group-route": "既有集团统一接收记录"/);
  const displayStatus = sourceBetween("function s003CandidateDisplayStatus", "function s003ContentCandidateStatus");
  assert.match(displayStatus, /s003WorkflowStatusLabel\(currentState\.label \|\| currentState\.status/);
});

test("M06 consumes M01 Published Action Type presentation metadata without business-name hardcoding", () => {
  assert.equal(actionTypeCatalog.lifecycleStatus, "published");
  assert.deepEqual(actionTypeCatalog.actionTypes.map((item) => item.displayName), [
    "风险分档跟踪",
    "专项风险处置",
    "重大风险应急响应"
  ]);
  const meta = sourceBetween("function s003ActionTypeMeta(actionTypeId)", "function s003DecisionInboxRequests");
  assert.match(meta, /resources\.actionTypeCatalog/);
  assert.match(meta, /item\.displayName/);
  assert.match(meta, /item\.description/);
  assert.match(meta, /item\.requiresHumanConfirmation/);
  assert.match(meta, /显式提交后送达对应成员单位接口人/);
  assert.doesNotMatch(meta, /风险分档跟踪|专项风险处置|重大风险应急响应|重大因子应急处置/);
});

test("dashboard and report keep immutable formation status separate from current C011/C019 state", () => {
  assert.match(appSource, /function s003DecisionInboxRequests/);
  assert.match(appSource, /OWNERS\.decision\.listInboxRequests/);
  assert.match(appSource, /function s003DecisionSummaries/);
  assert.match(appSource, /OWNERS\.decision\.listScenarioSummaries/);
  assert.match(appSource, /formationState/);
  assert.match(appSource, /currentState/);
  assert.match(appSource, /currentEvidenceCoverage/);
  assert.match(appSource, /candidate\.currentState\?\.code === "PENDING_SUBMISSION"/);
  assert.match(appSource, /currentRequests\.some\(\(request\) => requestMatchesCandidate/);
  assert.match(appSource, /currentSummaries\.some\(\(summary\) => summaryMatchesCandidate/);
  assert.match(appSource, /报告形成时/);
  assert.match(appSource, /成员单位处理状态/);
  assert.doesNotMatch(appSource, /actionSubmissions/);
  assert.match(externalOwnersSource, /listInboxRequests/);
  assert.match(externalOwnersSource, /sourceCandidateId: action\.sourceCandidateId/);
  assert.match(appSource, /request\?\.scenarioContext \|\| request\?\.scenarioIdentity \|\| \{\}/);
  assert.match(externalOwnersSource, /record\.sourceCandidateId/);
});

test("enterprise detail keeps construction-company minimum-indicator semantics visible", () => {
  const constructionIds = ["S003-ENT-010", "S003-ENT-011", "S003-ENT-012"];
  for (const enterpriseId of constructionIds) {
    const result = riskResults.results.find((item) => item.enterprise.enterpriseId === enterpriseId);
    assert.ok(result, enterpriseId);
    assert.equal(result.enterprise.category, "在建企业");
    assert.deepEqual(result.lowestThree, [], enterpriseId);
  }
  assert.match(appSource, /function s003LowestMetricDisplay\(record\)/);
  const lowestDisplay = sourceBetween("function s003LowestMetricDisplay(record)", "function s003ReportWeakDisplay(content, weak)");
  assert.match(lowestDisplay, /record\?\.enterprise\?\.category === "在建企业"[\s\S]*?return "—"/);
  assert.match(appSource, /function s003ReportWeakDisplay\(content, weak\)/);
  assert.match(appSource, /content\?\.assessment\?\.isUnderConstruction\) return "—"/);
  assert.match(appSource, /<td>\$\{s003LowestMetricDisplay\(record\)\}<\/td>/);
  assert.match(appSource, /already published indicator results/);
});

test("current verification rereads decision state and local interpretation is not represented as Agent output", () => {
  const verification = sourceBetween("function s003ReportVerification", "function s003CompanionAnswer");
  assert.match(verification, /s003DecisionInboxRequests/);
  assert.match(verification, /s003DecisionSummaries/);
  assert.match(verification, /currentRequestAlignment/);
  assert.match(verification, /currentSummaryAlignment/);
  assert.match(appSource, /报告形成时核验/);
  assert.match(appSource, /当前跨模块核验/);
  assert.match(appSource, /固定字段解读/);
  assert.match(appSource, /未调用 Agent/);
  assert.match(appSource, /s003-submit-companion-agent/);
  assert.match(appSource, /publishC024Request\(request\)/);
  assert.match(appSource, /function s003CompanionRequestState/);
  assert.match(appSource, /OWNERS\.agent\.getQA\?\.\(request\.requestId\)/);
  assert.match(appSource, /Agent 应用只读返回/);
  assert.match(appSource, /Session \$\{requestRef\.sessionId\}/);
  assert.match(appSource, /s003-clear-companion-session/);
  assert.match(appSource, /回答已生成/);
  const companion = sourceBetween("function s003ReportAssistantQA", "function s003ReportAssistantVerification");
  assert.match(companion, /suggestion-list/);
  assert.doesNotMatch(companion, /正在从 Agent 应用读取问题与答案/);
});

test("formal report follows the Published definition/template chapter order and localizes resource details", () => {
  const expectedOrder = definition.requiredSections;
  assert.deepEqual(template.sections.map((section) => section.sectionId), expectedOrder);
  assert.ok(contents.reports.every((item) => JSON.stringify(item.content.chapterOrder) === JSON.stringify(expectedOrder)));
  assert.match(appSource, /function s003ReportChapterPlan\(content, template\)/);
  assert.match(appSource, /Array\.isArray\(content\?\.chapterOrder\)/);
  assert.match(appSource, /function s003OrderReportPaper\(markup, chapters\)/);
  assert.match(appSource, /article\.insertBefore\(section, footer \|\| null\)/);
  assert.match(appSource, /number\.textContent = chapter\.no/);
  assert.match(appSource, /const reportPaper = s003OrderReportPaper\(reportPaperSource, chapters\)/);
  assert.match(appSource, /在建企业固定 60 分/);
  assert.match(appSource, /盈利历史不足按 A/);
  assert.match(appSource, /缺失因子套 0 档/);
  assert.match(appSource, /A4 响应式阅读版/);
  assert.match(appSource, /HTML 阅读版/);
});

test("all formal reports preserve the user-decided scoring defaults and 15-indicator evidence", () => {
  for (const entry of contents.reports) assert.equal(entry.content.indicatorDetails.length, 15, entry.reportId);
  const reports = contents.reports.map((entry) => entry.content);
  const underConstruction = reports.filter((report) => report.assessment.isUnderConstruction);
  assert.equal(underConstruction.length, 3);
  assert.ok(underConstruction.every((report) => report.assessment.rawScore === 60));
  const ruleStatements = reports[0].ruleExplanations.map((rule) => rule.statement).join("\n");
  assert.match(ruleStatements, /盈利历史不足时按 A 档计 100 分/);
  assert.match(ruleStatements, /适用但缺失的企业因子套用零系数档/);
  const environmental = reports.filter((report) => report.enterprise.category === "环保");
  assert.equal(environmental.length, 4);
  assert.ok(environmental.every((report) => {
    const electricityPrice = report.adjustmentFactors.find((factor) => factor.factorId === "electricity-price");
    return electricityPrice?.state === "NOT_APPLICABLE" && electricityPrice.coefficient === 0;
  }));
});

test("M06 projection compatibility keeps legacy records and writes the new namespaced projection key", () => {
  assert.match(appSource, /const S003_STATE_KEY = "report-center\/state\.v2"/);
  assert.match(appSource, /const S003_LEGACY_STATE_KEY = "report-center\/state"/);
  assert.match(appSource, /legacy-migrated-copy/);
  assert.match(appSource, /legacy-isolated/);
  assert.match(appSource, /const currentCandidates = \[/);
  assert.match(appSource, /currentCandidates\.length \? currentCandidates/);
  assert.match(appSource, /sharedStorage\.set\(S003_STATE_KEY, compacted\)/);
  assert.match(appSource, /sessionStore\.set\(S003_STATE_KEY, compacted\)/);
  assert.doesNotMatch(sourceBetween("function saveState()", "function commit("), /sessionStore\.set\("report-center\/state"/);
  assert.doesNotMatch(sourceBetween("function saveState()", "function commit("), /remove\(S003_LEGACY_STATE_KEY/);
  assert.match(appSource, /s003ProjectionIssue\?\.blocking/);
});

test("S003 reset delegates to the public shell and never clears the current run in place", () => {
  const resetHandler = sourceBetween('if (action === "confirm-reset")', 'if (action === "close-modal")');
  assert.match(resetHandler, /if \(s003ScenarioSelected\(\)\)/);
  assert.match(resetHandler, /requestS003ShellAction\("requestScenarioRerun"/);
  const beforeLegacyReset = resetHandler.slice(0, resetHandler.indexOf("clearTimers\(\)"));
  assert.doesNotMatch(beforeLegacyReset, /state = newState\(\)/);
  assert.match(beforeLegacyReset, /不会在原 scenarioRunId 内清空状态/);
});

test("checkpoint restore uses clone-restore through the public shell and never creates a local run id", () => {
  assert.match(appSource, /data-action="s003-request-restore"/);
  assert.match(appSource, /requestS003ShellAction\("requestScenarioRestore", \{ checkpointId, sourceScenarioRunId, mode: "clone-restore", sourceModule: "M06" \}\)/);
  const restoreHandler = sourceBetween('if (action === "s003-request-restore")', 'if (action === "s003-set-tab")');
  assert.doesNotMatch(restoreHandler, /scenarioRunId\s*[:=]\s*`/);
  assert.match(restoreHandler, /原 \$\{sourceScenarioRunId\} 保持只读且不会覆盖/);
});

test("S003 initial M06 state does not inherit S001 finance or unit selections", () => {
  const newStateSource = sourceBetween("function newState()", "function factPackageReference(");
  assert.match(newStateSource, /reportType: s003 \? "s003-debt-risk" : "finance"/);
  assert.match(newStateSource, /compareUnits: s003 \? \[\] : \["单位553", "单位465", "单位561"\]/);
  assert.match(newStateSource, /actionUnit: s003 \? null : "单位553"/);
});

test("formal report v9 localizes statuses, preserves structured triggers and corrects construction semantics", () => {
  assert.equal(artifacts.artifactCount, 21);
  const forbidden = /\[object Object\]|\b(?:APPLIED|EVALUATED|NOT_APPLICABLE|DEFAULTED_ZERO|CONFIRMED_TO_OWNER_TODO|CANDIDATE_AWAITING_HUMAN_CONFIRMATION)\b/;
  for (const artifact of artifacts.artifacts) {
    assert.equal(artifact.contentVersion, "1.7.0");
    assert.doesNotMatch(artifact.html, forbidden, artifact.reportId);
    assert.match(artifact.html, /关键风险诊断说明/);
    assert.match(artifact.html, /风险应对策略与改善建议/);
    assert.match(artifact.html, /未来三个月行动建议/);
  }
  const red = contents.reports.find((entry) => entry.content.assessment.riskTier.tierId === "RED")?.content;
  assert.ok(red);
  assert.match(JSON.stringify(red.threeMonthActionPlan), /资金余缺|应急资金/);
  const construction = contents.reports.find((entry) => entry.content.assessment.isUnderConstruction)?.content;
  assert.ok(construction);
  assert.match(JSON.stringify(construction.threeMonthActionPlan), /建设资金/);
  assert.match(JSON.stringify(construction.responseStrategy), /投产条件/);
  assert.doesNotMatch(JSON.stringify({ conclusion: construction.conclusion, diagnosis: construction.keyRiskDiagnosis, strategy: construction.responseStrategy }), /低分指标|最低指标/);
  assert.ok(construction.keyRiskDiagnosis.indicatorItems.every((item) => item.type !== "indicator"));
  const constructionArtifact = artifacts.artifacts.find((item) => item.reportId === construction.reportId);
  assert.match(constructionArtifact.html, /财务指标口径清单/);
  assert.doesNotMatch(constructionArtifact.html, /权重<\/th><th>加权得分/);
});

test("report companion and assurance profile cover strategy, plans, defaults and presentation consistency", () => {
  assert.equal(assurance.profileVersion, "1.2.0");
  assert.equal(assurance.verificationChecks.length, 13);
  assert.ok(assurance.companionQuestions.some((item) => item.questionId === "strategy"));
  assert.ok(assurance.companionQuestions.some((item) => item.questionId === "three-month-plan"));
  assert.ok(assurance.companionQuestions.some((item) => item.questionId === "defaults"));
  assert.match(appSource, /localized-business-status/);
  assert.match(appSource, /structured-trigger/);
  assert.match(appSource, /diagnosis-value-format/);
  assert.match(appSource, /decision-status-alignment/);
  assert.match(appSource, /construction-semantics/);
});
