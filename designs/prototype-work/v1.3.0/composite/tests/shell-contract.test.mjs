import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const compositeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workRoot = path.resolve(compositeRoot, "..");
const repositoryRoot = path.resolve(workRoot, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(compositeRoot, relativePath), "utf8");

function loadDataAndCatalog() {
  const context = vm.createContext({ console });
  context.window = context;
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(repositoryRoot, "designs/prototype-work/v1.2.0/composite/resources/catalog.js"), "utf8"), context);
  vm.runInContext(read("resources/catalog.js"), context);
  vm.runInContext(read("s001-e2e-integration/data.js"), context);
  return context;
}

test("v1.3 unique entry preserves the parent Shell CSS and uses a minimal local renderer delta", () => {
  const html = read("s001-e2e-integration/index.html");
  const parentApp = fs.readFileSync(path.join(repositoryRoot, "designs/prototype-work/v1.2.0/composite/s001-e2e-integration/app.js"), "utf8");
  const app = read("s001-e2e-integration/app.js");
  assert.match(html, /v1\.2\.0\/composite\/s001-e2e-integration\/styles\.css/);
  assert.match(html, /\.\/app\.js/);
  assert.doesNotMatch(html, /<iframe[^>]+v1\.2\.0\/composite\/s001-e2e-integration\/index\.html/);
  assert.equal(fs.existsSync(path.join(compositeRoot, "s001-e2e-integration/app.js")), true);
  for (const token of ["BRAND_BRAIN_SVG", "classic-home-frame", "architecture-foot", "renderModule", "frameSource", "OFW_M07_OPEN_M08"]) {
    assert(parentApp.includes(token) && app.includes(token), token);
  }
  assert.match(app, /其他窗口状态已变化/);
  assert.doesNotMatch(app, /storage[\s\S]{0,120}location\.reload/);
  assert.match(app, /scheduleNavigationRender/);
  assert.match(app, /MODULE_TASKS/);
  assert.match(app, /module-subnav/);
  assert.doesNotMatch(app, /SCENARIO_SCOPED_MODULES|data-module-scenario-select|module-scenario-control/);
  assert.doesNotMatch(app, /scenarioPortfolioMarkup|场景运行与待办|data-scenario-card|统一资源目录|focus-scenario|switch-scenario|切换业务场景|模块工作区|home-chain-track/);
  assert.equal(fs.existsSync(path.join(compositeRoot, "s001-e2e-integration/styles.parent.css")), false);
});

test("shell registers M01-M08 and Dashboard once with the parent S005 default context", () => {
  const context = loadDataAndCatalog();
  const data = context.OFW_V130_DATA;
  assert.equal(data.version, "v1.3.0-rc.1");
  assert.equal(data.parentCommit, "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0");
  assert.equal(data.modules.length, 8);
  assert.equal(data.nav.length, 10);
  assert.equal(new Set(data.modules.map((item) => item.route)).size, 8);
  assert.equal(data.dashboard.route, "#dashboard");
  assert.equal(data.scenarios.find((item) => item.default).id, "S005");
  assert.deepEqual(Array.from(data.scenarios, (item) => item.id), ["S001", "S002", "S003", "S004", "S005"]);
});

test("v1.3 browser state keys are isolated from v1.2 runtime state", () => {
  const stateSource = read("s001-e2e-integration/state.js");
  assert.match(stateSource, /ofw\.prototype\.v1\.3\.0\.composite\.state\.v2/);
  assert.match(stateSource, /ofw\.prototype\.v1\.3\.0\.composite\.handoff\.v2/);
  assert.match(stateSource, /ofw\.prototype\.v1\.3\.0\.modeling-research\.v1/);
  assert.doesNotMatch(stateSource, /ofw\.prototype\.v1\.2\.0\.composite\.state/);
});

test("resource catalog remains one 9x5 directory and adds S002/S004 exploration without replacing parent modules", () => {
  const context = loadDataAndCatalog();
  const catalog = context.OFW_V130_CATALOG;
  assert.equal(catalog.resources.length, 45);
  assert.equal(new Set(catalog.resources.map((item) => `${item.moduleId}:${item.scenarioId}`)).size, 45);
  for (const moduleId of ["data", "ontology", "query", "decision", "agent", "report", "m07", "modeling", "dashboard"]) {
    assert.equal(catalog.resourcesFor(moduleId).length, 5);
  }
  assert.equal(catalog.resource("ofw.v130.modeling.s003").type, "ModelPortfolioOptimizationCenter");
  assert.equal(catalog.resource("ofw.v130.decision.s003").refs[0], "NON_FACT_SOURCE_REJECTED");
  assert.equal(catalog.resource("ofw.v130.data.s001").name, "融资数据资产");
  assert.equal(catalog.resource("ofw.v130.dashboard.s005").name, "投后评价六域驾驶舱");
  assert.equal(catalog.resource("ofw.v130.m07.s002").status, "available");
  assert.equal(catalog.resource("ofw.v130.m07.s004").status, "available");
});

test("all scenarios use the real parent module workspaces with native closed-loop integrations", () => {
  const data = read("s001-e2e-integration/data.js");
  const shell = read("s001-e2e-integration/app.js");
  const integrations = read("integrations/native-module-integrations.js");
  const modelCenter = read("model-center/app.js");
  const modelCenterCss = read("model-center/styles.css");
  const dashboard = read("dashboard/index.html");
  assert.doesNotMatch(data, /s003Source|workspaces\/risk-cycle/);
  for (const source of [
    "data-engineering-prototype-review/review-v3/方案B2.html",
    "ontology-management-review/canvas-first/index.html",
    "intelligent-query-prototype/review-next/conversation-workspace/index.html",
    "decision-center-prototype/review-v2/action-portfolio.html",
    "agent-application/Agent应用.html",
    "report-center/review-lifecycle/index.html"
  ]) assert(data.includes(source), source);
  assert.doesNotMatch(shell, /module-workbench\.html|S005_PARENT_WORKBENCH_ENTRY|OFW_S003_WORKFLOWS/);
  assert.match(shell, /OFW_NATIVE_MODULE_INTEGRATIONS/);
  assert.match(integrations, /modern-start\[hidden\]|modern-composer|data-open|ontology-open|agent-open|report-open|dashboard-open/);
  assert.match(integrations, /QUERY_SCENARIOS|queryRecommendationScenario|ofw-query-scenario-tabs/);
  assert.match(integrations, /S001[\s\S]*融资成本[\s\S]*S002[\s\S]*预算监督[\s\S]*S003[\s\S]*债务风险[\s\S]*S004[\s\S]*贷前评估[\s\S]*S005[\s\S]*投后评价/);
  for (const step of ["正在确认问题范围", "正在读取权威数据", "正在整理业务结果", "正在核对回答依据", "正在生成回答"]) assert.match(integrations, new RegExp(step));
  assert.match(integrations, /queryEpoch|queryRunning|clearQueryTimers|ofw-native-query-thinking/);
  assert.match(integrations, /build-data|validate-data|freeze-data|create-contract|NON_FACT_SOURCE_REJECTED/);
  assert.doesNotMatch(integrations, /v1\.3 增量|原 v1\.2 页面|查看增量|ofw-s003-workflow/);
  assert.match(data, /v1\.2\.0\/composite\/modules\/m07\/module\/workspace-v2\.html/);
  assert.match(data, /model-center\/index\.html/);
  assert.match(data, /name: "模型优化中心"/);
  for (const label of ["优化工作台", "业务目标与模型", "统一评测", "候选观察", "发布与监测", "模型代码仓"]) assert.match(modelCenter, new RegExp(label));
  assert.match(modelCenter, /VIEW_ALIASES/);
  assert.doesNotMatch(modelCenter, /function statusMarkup/);
  assert.doesNotMatch(modelCenter, /S003|Enterprise|债务风险|liquidityGap|\/v1\/s003/);
  assert.match(modelCenter, /model-management\/context|model-management\/actions/);
  assert.match(modelCenterCss, /center-nav-list \{[^}]*display: grid/s);
  assert.doesNotMatch(modelCenterCss, /center-nav-list[^}]*overflow-x/);
  assert.match(modelCenterCss, /\.center-nav \{[^}]*background: #e8eef4/s);
  assert.match(read("s001-e2e-integration/styles.css"), /\.module-subnav \{[^}]*background: #e4ebf2/s);
  assert.match(read("s001-e2e-integration/styles.css"), /\.top-breadcrumb/);
  assert.doesNotMatch(read("dashboard/app.js"), /五条业务链在同一原型|保留正式 1\.0\.2 基线/);
  assert.doesNotMatch(integrations, /债务风险模型数据资产|债务风险模型语义合同|ofw-native-inline-model-data/);
  assert.match(integrations, /asset-resource-table|published-ontology-card|DATA_ASSET_NAMES|SEMANTIC_CONTRACT_NAMES/);
  assert.match(integrations, /实际执行明细|中国广核年度报告|新建草稿（可编辑副本）/);
  assert.match(integrations, /ofw-sector-comparison|query-action-submit|ofw-decision-ops/);
  assert.equal(fs.existsSync(path.join(compositeRoot, "modules/m07/resources/portfolio.json")), true);
  assert.match(dashboard, /\.\/styles\.css/);
  assert.match(dashboard, /\.\/app\.js/);
  for (const source of [integrations, modelCenter, dashboard]) assert.doesNotMatch(source, /location\.replace/);
  assert.equal(fs.existsSync(path.join(compositeRoot, "workspaces/risk-cycle/entry.html")), false);
  assert.equal(fs.existsSync(path.join(compositeRoot, "modules/modeling/consumer/result-projection.html")), false);
  assert.equal(fs.existsSync(path.join(compositeRoot, "model-center/index.html")), true);
  assert.equal(fs.existsSync(path.join(compositeRoot, "modules/m07/module/workspace-v2.html")), false);
  assert.equal(fs.existsSync(path.join(compositeRoot, "scenarios/s005/module-workbench.html")), false);
  assert.equal(fs.existsSync(path.join(compositeRoot, "modules/m07/resources/s002.json")), true);
  assert.equal(fs.existsSync(path.join(compositeRoot, "modules/m07/resources/s004.json")), true);
});

test("M02 and M01 expose traceable S003 model data assets and per-model semantic bindings", () => {
  const registration = read("runtime/s003-registration.mjs");
  const integrations = read("integrations/native-module-integrations.js");
  for (const asset of ["企业纵向观察", "独立风险事件与结果标签", "现金流与可用资金观察", "债务到期与再融资计划", "担保、股权、关联交易与共同债权人关系", "评级、诉讼、审计意见与重大事项"]) assert.match(registration, new RegExp(asset));
  assert.match(registration, /dataAssets/);
  assert.match(registration, /modelBindings/);
  assert.match(registration, /featureAvailableAt <= predictionAsOf/);
  assert.match(integrations, /数据成员/);
  assert.match(integrations, /模型字段与结果合同/);
});

test("Dashboard registers S004 as a real fifth workspace instead of an injected shell card", () => {
  const data = read("dashboard/data.js");
  const app = read("dashboard/app.js");
  const integrations = read("integrations/native-module-integrations.js");
  assert.match(data, /const preloan =/);
  assert.match(data, /dashboards: \[financing, budget, risk, preloan, postInvestment\]/);
  assert.match(app, /function renderPreloan/);
  assert.match(app, /preloan-applicant-detail|preloan-evidence-detail|preloanModelComparison/);
  assert.doesNotMatch(integrations, /data-ofw-native-dashboard-card/);
});

test("v1.2-style Dashboard exposes five result views and no automatic release claims", () => {
  const app = read("dashboard/app.js");
  const data = read("dashboard/data.js");
  for (const label of ["正式结果", "候选试算", "影子观察", "压力模拟", "正式与候选差异"]) assert(data.includes(label));
  for (const view of ["formal", "candidate", "shadow", "simulation", "difference"]) assert(app.includes(`\"${view}\"`));
  for (const label of ["用户评审已通过", "生产上线已完成", "一期验收已通过", "模型有效性已经正式证明"]) assert.equal(app.includes(label), false);
  assert.match(read("runtime/model-portfolio-engine.mjs"), /NON_FACT_SOURCE_REJECTED/);
  assert.match(app, /正式 FACT、候选 PREDICTION、影子 SHADOW 与 SIMULATION 严格分离/);
});
