"use strict";

const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const scenarioRoot = path.resolve(__dirname, "..");
const workRoot = path.resolve(scenarioRoot, "../..");
const releaseRoot = path.resolve(workRoot, "../../prototype-releases/v1.0.3");

function read(relativePath) {
  return fs.readFileSync(path.join(workRoot, relativePath), "utf8");
}

function readRelease(relativePath) {
  return fs.readFileSync(path.join(releaseRoot, relativePath), "utf8");
}

test("S003 入口只跳转到 v1.0.3 派生公共壳，不启动独立产品壳", () => {
  const entry = fs.readFileSync(path.join(scenarioRoot, "index.html"), "utf8");
  assert.match(entry, /s001-e2e-integration\/index\.html/);
  assert.match(entry, /searchParams\.set\("scenarioId", "S003"\)/);
  assert.doesNotMatch(entry, /src="\.\/app\.js/);
  assert.doesNotMatch(entry, /src="\.\/state\.js/);
  assert.doesNotMatch(entry, /src="\.\/styles\.css/);
});

test("公共壳以配置注册 S003，并继续使用 v1.0.3 的六模块入口", () => {
  const index = read("s001-e2e-integration/index.html");
  const config = read("scenarios/s003/integration-config.js");
  const data = read("s001-e2e-integration/data.js");
  assert.match(index, /scenarios\/s003\/integration-config\.js/);
  assert.match(config, /implementationMode:\s*"baseline-extension"/);
  assert.match(config, /standalonePrototype:\s*false/);
  assert.match(config, /baselineVersion:\s*"1\.0\.3"/);
  assert.match(config, /baselineSnapshotId:\s*"BSL-S001-V103-DE0119608E26"/);
  assert.match(config, /acceptanceReady:\s*false/);
  assert.match(config, /CP14-v103-full-scene-regression-completed\.json/);
  assert.match(config, /S003ShellHealth\(M01-M06 page health\)/);
  assert.match(data, /const externalScenarios = Object\.values\(window\.OFW_SCENARIO_CONFIGS/);
  for (const id of ["data", "ontology", "query", "decision", "agent", "report"]) {
    assert.match(data, new RegExp(`id: "${id}"`));
  }
});

test("当前场景注册和 v17 集成清单只把现行正式资源作为活动指针", () => {
  const config = read("scenarios/s003/integration-config.js");
  assert.match(config, /scenarioRunId:\s*"S003-RUN-20260817163000000-c02200000001"/);
  assert.match(config, /ontologyVersion:\s*"S003-M01-DEBT-RISK-PKG 1\.0\.2"/);
  for (const ref of [
    "resources/m01/published-pointer.v2.json",
    "resources/m02/source-registry.v4.json",
    "resources/m02/pipeline-current-projection.v4.json",
    "resources/m02/c017-decision-projection.v2.json",
    "resources/m04/decision-results.v3.json",
    "resources/m05/agent-position.v7.json",
    "resources/m06/report-manifest.v9.json",
    "resources/m06/report-history-index.v4.json"
  ]) assert.match(config, new RegExp(ref.replaceAll(".", "\\.")));

  const builderPath = path.join(scenarioRoot, "scripts", "build-baseline-extension-inventory.cjs");
  const probe = [
    "process.argv.push('--v17');",
    `const builder = require(${JSON.stringify(builderPath)});`,
    "const inventory = builder.buildInventory();",
    "process.stdout.write(JSON.stringify({variant: builder.variant, scenarioIdentity: inventory.scenarioIdentity, currentFormalResourceRefs: inventory.currentFormalResourceRefs, files: inventory.files.map((item) => item.path)}));"
  ].join("");
  const result = spawnSync(process.execPath, ["-e", probe], {cwd: workRoot, encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  const inventory = JSON.parse(result.stdout);
  assert.equal(inventory.variant, "v17");
  assert.equal(inventory.scenarioIdentity.scenarioRunId, "S003-RUN-20260817163000000-c02200000001");
  assert.deepEqual(Object.keys(inventory.currentFormalResourceRefs), ["M01", "M02", "M03", "M04", "M05", "M06"]);
  for (const ref of [
    "scenarios/s003/resources/m01/model-package.v2.json",
    "scenarios/s003/resources/m02/source-registry.v4.json",
    "scenarios/s003/resources/m02/c017-decision-projection.v2.json",
    "scenarios/s003/resources/m03/query-catalog.v3.json",
    "scenarios/s003/resources/m04/decision-runtime.v2.json",
    "scenarios/s003/resources/m05/agent-position.v7.json",
    "scenarios/s003/resources/m06/report-manifest.v9.json",
    "scenarios/s003/resources/m06/report-history-index.v4.json"
  ]) assert.ok(inventory.files.includes(ref), `v17 清单缺少 ${ref}`);
});

test("M01 默认进入基线建模入口，S003 配置仅通过条件式子路由装入", () => {
  const adapter = read("ontology-management-review/canvas-first/s003-scenario-adapter.js");
  const config = read("scenarios/s003/integration-config.js");
  assert.match(adapter, /CONFIG_TAB = "s003-model-config"/);
  assert.match(adapter, /versionTabs: version => isCurrentS003Version\(version\)/);
  assert.match(adapter, /renderVersionTab: \(version, tab\)/);
  assert.match(adapter, /registerPublishedVersion\(\{/);
  assert.doesNotMatch(adapter, /#modeling\/s003|#published\/s003/);
  assert.doesNotMatch(adapter, /MutationObserver|stopImmediatePropagation/);
  assert.match(config, /initialHash:\s*"#modeling"/);
  assert.match(config, /deprecatedInitialHashes:\s*\["#modeling\/s003-debt-risk-config"\]/);
});

test("M02/M01 旧私有默认 hash 定向迁移回基线入口，不影响 S001", () => {
  const config = read("scenarios/s003/integration-config.js");
  const platformShell = read("s001-e2e-integration/app.js");
  assert.match(config, /initialHash:\s*"#\/resources"/);
  for (const retiredRoute of ["s003-workbook\\?tab=overview", "s003-factor-config\\*", "s003-risk-band-config\\*", "s003-enterprise-factor-input\\*"]) {
    assert.match(config, new RegExp(`#\\/resources\\/source\\/${retiredRoute}`));
  }
  assert.match(platformShell, /function migrateDeprecatedModuleHash/);
  assert.match(platformShell, /scenario\.id !== "S003"/);
  assert.match(platformShell, /pattern\.endsWith\("\*"\)/);
  assert.match(platformShell, /deprecated-s003-private-entry-to-baseline-entry/);
});

test("公共壳区分历史 Checkpoint 完成度与当前运行健康，并提供 Published-only 读取合同", () => {
  const platformShell = read("s001-e2e-integration/app.js");
  const scenarioState = read("scenarios/s003/state.js");
  assert.match(platformShell, /历史节点/);
  assert.match(platformShell, /不可变 Checkpoint 完成度；当前来源链路/);
  assert.match(platformShell, /不代表当前运行健康/);
  assert.match(platformShell, /const done = checkpointMode \? checkpoint\.done : sourceDone/);
  assert.match(platformShell, /getS003PublishedResources/);
  assert.match(scenarioState, /function getPublishedResourceSnapshot/);
  assert.match(scenarioState, /readMode:\s*"published-only"/);
  assert.match(scenarioState, /acceptanceReady:\s*false/);
  const runtimeHealth = scenarioState.match(/function buildRuntimeHealth\(\)[\s\S]*?(?=\n  function refreshRuntimeHealthState)/)?.[0] || "";
  assert.match(runtimeHealth, /checkpointCatalogIssues: clone\(state\.checkpointCatalogIssues\)/);
  assert.doesNotMatch(runtimeHealth, /checkpointCatalogIssues[\s\S]*?warnings\.push/);
});

test("任意非正式活动轮次均可显式返回上一正式成功运行且不清理历史", () => {
  const platformShell = read("s001-e2e-integration/app.js");
  const scenarioState = read("scenarios/s003/state.js");
  assert.match(platformShell, /function s003FormalReturnAvailability/);
  assert.match(platformShell, /data-action="return-formal-run"/);
  assert.match(platformShell, /runtime\.returnToLastSuccessfulRun\(\)/);
  assert.match(platformShell, /STORE\.adoptScenarioContext\?\.\("S003", nextContext/);
  assert.match(platformShell, /未执行重评，也未重放历史副作用/);
  assert.match(scenarioState, /function returnToLastSuccessfulRun/);
  assert.doesNotMatch(platformShell.match(/if \(action === "return-formal-run"\)[\s\S]*?(?=\n\s*if \(action ===)/)?.[0] || "", /localStorage\.clear|removeItem|resetCurrentScenario/);
});

test("首页健康必须合并 M01—M06 真实页面装载状态，未检查或页面失败不得显示健康", () => {
  const platformShell = read("s001-e2e-integration/app.js");
  const healthProviders = [
    read("ontology-management-review/canvas-first/s003-scenario-adapter.js"),
    read("data-engineering-prototype-review/review-v3/shared/s003-scenario-adapter.js"),
    read("intelligent-query-prototype/review-next/conversation-workspace/s003-native-bridge.js"),
    read("decision-center-prototype/review-v2/shared/s003-adapter.jsx"),
    read("agent-application/s003-adapter.jsx"),
    read("report-center/review-lifecycle/app.js")
  ];
  assert.match(platformShell, /const s003ModulePageHealth = Object\.create\(null\)/);
  assert.match(platformShell, /function inspectS003ModulePageHealth/);
  assert.match(platformShell, /currentRunHealthy: status === "healthy"/);
  assert.match(platformShell, /该模块页面尚未在当前浏览器会话中打开/);
  assert.match(platformShell, /uncheckedModules/);
  assert.match(platformShell, /window\.S003ShellHealth/);
  for (const source of healthProviders) assert.match(source, /getHealth|S003ReportModuleHealth/);
});

test("M02 保留基线目录与详情组件，S003 只通过条件式资源扩展装入", () => {
  const relativeApp = "data-engineering-prototype-review/review-v3/shared/app.js";
  const nativeApp = read(relativeApp);
  const frozenApp = readRelease(relativeApp);
  const adapter = read("data-engineering-prototype-review/review-v3/shared/s003-scenario-adapter.js");
  const ontologyAdapter = read("ontology-management-review/canvas-first/s003-scenario-adapter.js");
  const shell = read("data-engineering-prototype-review/review-v3/shared/shell.html");
  const platformShell = read("s001-e2e-integration/app.js");
  for (const contractToken of ["function render", "function route", "function resourceDirectory", "function sourceDetail", "function pipelinesPage"]) {
    assert.ok(frozenApp.includes(contractToken), `冻结基线缺少 ${contractToken}`);
    assert.ok(nativeApp.includes(contractToken), `派生工作树裁掉了 ${contractToken}`);
  }
  assert.match(nativeApp, /SCENARIO_ID = REQUESTED_SCENARIO_ID === "S003" \? "S003" : "S001"/);
  assert.match(nativeApp, /function scenarioExtension\(\)/);
  assert.match(adapter, /managesSource:/);
  assert.match(adapter, /sourceTabs:/);
  assert.match(adapter, /renderSourceTab:/);
  assert.match(adapter, /window\.DE_SCENARIO_EXTENSION = extension/);
  assert.match(nativeApp, /registerResourceBundle/);
  assert.match(nativeApp, /renderSourceTab/);
  assert.match(adapter, /configTab/);
  assert.match(adapter, /scenarioVersion/);
  assert.match(adapter, /scenarioRunId/);
  assert.doesNotMatch(adapter, /stopImmediatePropagation/);
  assert.doesNotMatch(adapter, /main\.innerHTML|\.main[^\n]*innerHTML/);
  assert.ok(shell.indexOf("s003-scenario-adapter.js") < shell.indexOf("{{APP_JS}}"));
  for (const operation of ["saveS003FactorInputs", "validateS003FactorInputs", "publishS003FactorInputs"]) {
    assert.doesNotMatch(adapter, new RegExp(operation));
    assert.doesNotMatch(ontologyAdapter, new RegExp(operation));
    assert.match(platformShell, new RegExp(operation));
  }
  for (const operation of ["saveS003ConfigurationDraft", "validateS003Configuration", "publishS003Configuration", "resetS003Configuration"]) {
    assert.match(ontologyAdapter, new RegExp(operation));
    assert.match(platformShell, new RegExp(operation));
  }
  assert.match(adapter, /function redirectRetiredModelConfigRoute\(\)/);
  assert.match(adapter, /navigateScenarioModule/);
  assert.match(adapter, /tab=s003-model-config/);
  assert.doesNotMatch(adapter, /configStorageKey\(kind\)|archiveConfigProjection|renderConfigEditor|publishConfig/);
  assert.doesNotMatch(adapter, /localStorage\?*\.clear\s*\(|localStorage\.clear\s*\(/);
  assert.doesNotMatch(adapter, /localStorage\?*\.removeItem\s*\(|localStorage\.removeItem\s*\(/);
});

test("M03 保留原问数 App，并把 Published 问题装入原问数视图而非首页独立投影", () => {
  const app = read("intelligent-query-prototype/review-next/conversation-workspace/app.jsx");
  const adapter = read("intelligent-query-prototype/review-next/conversation-workspace/s003-adapter.jsx");
  assert.match(app, /ReactDOM\.createRoot\(document\.getElementById\("root"\)\)\.render\(<App \/>\)/);
  assert.doesNotMatch(app, /const EntryApp/);
  assert.match(app, /savedViews/);
  assert.match(app, /hydrateExperience/);
  assert.match(app, /isPublishedFixedHistory/);
  assert.doesNotMatch(app, /S003IQAdapter\?\.PublishedViews/);
  assert.doesNotMatch(app, /<S003Projection/);
  assert.match(app, /正式联调执行记录 · Published 固定结果 · 非用户会话/);
  assert.match(app, /按当前版本重新运行/);
  assert.match(app, /isPublishedFixedHistory/);
  assert.match(app, /hydrateExperience/);
});

test("M04 只把 S003 结果投影到通用决策状态，不新增专属路由或导航", () => {
  const app = read("decision-center-prototype/review-v2/shared/app.jsx");
  const adapter = read("decision-center-prototype/review-v2/shared/s003-adapter.jsx");
  assert.match(app, /S003DecisionAdapter\.hydrateNativeState/);
  assert.doesNotMatch(app, /#s003/);
  assert.doesNotMatch(adapter, /S003DecisionPage|s003-decision-page/);
  assert.match(adapter, /Action Request/);
  assert.match(adapter, /负责人待办/);
  assert.match(adapter, /通用决策工作区/);
});

test("M05 和 M06 保持通用目录与报告生命周期，S003 只装入报告伴读配置和公共驾驶舱", () => {
  const agentApp = read("agent-application/app.jsx");
  const reportApp = read("report-center/review-lifecycle/app.js");
  assert.match(agentApp, /S003AgentAdapter\.BoundaryCard/);
  assert.match(agentApp, /function AgentDirectory\(\)/);
  assert.match(reportApp, /\/dashboard\/s003/);
  assert.match(reportApp, /集团债务风险监测/);
  assert.match(reportApp, /navigateScenarioModule/);
  assert.match(reportApp, /requestS003ShellAction\("navigateScenarioModule", \{ moduleId, hash \}\)/);
  assert.match(reportApp, /data-module="ontology"/);
  assert.match(reportApp, /s003ModelConfigurationHash\("overview"\)/);
  assert.doesNotMatch(reportApp, /data-tab="configuration"/);
  assert.doesNotMatch(reportApp, /adoptS003M02Configuration/);
  assert.match(reportApp, /requestScenarioRerun/);
  assert.match(reportApp, /关键风险诊断说明/);
  assert.match(reportApp, /风险应对策略与改善建议/);
  assert.match(reportApp, /未来三个月行动建议/);
  assert.doesNotMatch(reportApp, /function renderS003(?:Lifecycle|Reports|Generate)\(/);
  assert.match(reportApp, /function renderLifecycle\(\)[\s\S]*?const s003 = s003ScenarioSelected\(\)/);
  assert.match(reportApp, /function renderReports\(\)[\s\S]*?const provider = s003 \? s003NativeProvider\(\) : null/);
});

test("快速重跑完成后在公共仪表盘展示隔离预览，六模块公共上下文保持最近正式运行", () => {
  const platformShell = read("s001-e2e-integration/app.js");
  const confirmReset = platformShell.match(/if \(action === "confirm-reset"\)[\s\S]*?(?=\n    if \(action === "refresh-source"\))/)?.[0] || "";
  assert.ok(confirmReset, "统一壳缺少重跑确认处理");
  assert.match(confirmReset, /const formalRun = runtime\.returnToLastSuccessfulRun\(\)/);
  assert.match(confirmReset, /requestedModuleTarget = \{ moduleId: "dashboard", hash: `#\/dashboard\/s003\?runId=\$\{previewRunId\}` \}/);
  assert.match(confirmReset, /scenarioUrl\(scenario\.id, rerun \? "#dashboard" : "#home", shellContext\)/);
  assert.match(confirmReset, /公共模块继续使用最近正式运行/);
  assert.doesNotMatch(confirmReset, /requestedModuleTarget = \{ moduleId: "report"/);
});

test("旧链接落在重跑预览时，演示入口恢复正式上下文并保留仪表盘预览选择", () => {
  const platformShell = read("s001-e2e-integration/app.js");
  const bootstrap = platformShell.match(/if \(activeScenario\(\)\.id === "S003"\) \{\n    ensureS003Runtime\(\)\.then\(\(\) => \{[\s\S]*?(?=\n    \}\)\.catch)/)?.[0] || "";
  assert.ok(bootstrap, "统一壳缺少 S003 启动恢复逻辑");
  assert.match(bootstrap, /activeRun\?\.projectionOnly === true/);
  assert.match(bootstrap, /window\.S003Store\.returnToLastSuccessfulRun\(\)/);
  assert.match(bootstrap, /最近重跑保留为驾驶舱可切换预览/);
  assert.match(bootstrap, /#\/dashboard\/s003\?runId=\$\{encodeURIComponent\(previewRunId\)\}/);
  assert.match(bootstrap, /!\["data", "ontology"\]\.includes\(route\.moduleId\)/);
  assert.doesNotMatch(bootstrap, /localStorage\.clear|removeItem|resetCurrentScenario/);
});

test("运行服务只有在新 scenarioRunId 已被公共壳采用后才刷新 iframe", () => {
  const platformShell = read("s001-e2e-integration/app.js");
  const subscription = platformShell.match(/s003RuntimeUnsubscribe = window\.S003Store\.subscribe\(function \(\) \{[\s\S]*?(?=\n\s*\}\);\n\s*\})/)?.[0] || "";
  assert.ok(subscription, "统一壳缺少 S003 运行服务订阅");
  assert.match(subscription, /const runtimeContext = nextSnapshot\?\.context/);
  assert.match(subscription, /const shellContext = activeScenarioContext\(\)/);
  assert.match(subscription, /runtimeContext\.scenarioRunId === shellContext\.scenarioRunId/);
  assert.match(subscription, /activeScenario\(\)\.id === "S003" && runtimeIdentityAdopted/);
  assert.doesNotMatch(subscription, /if \(activeScenario\(\)\.id === "S003"\) \{\s*render\(\)/);
});

test("所有模块适配器复用 v1.0.3 公共交接合同，不建立 S003 私有交接频道", () => {
  const adapters = [
    read("ontology-management-review/canvas-first/s003-scenario-adapter.js"),
    read("data-engineering-prototype-review/review-v3/shared/s003-scenario-adapter.js")
  ].join("\n");
  const nativeApps = [
    read("ontology-management-review/canvas-first/app.js"),
    read("data-engineering-prototype-review/review-v3/shared/app.js")
  ].join("\n");
  assert.match(nativeApps, /ontology3\.0-s001-handoff-v1/);
  assert.match(adapters, /ontology3\.0-scenario-shell-v1/);
  assert.doesNotMatch(adapters, /ontology3\.0-s003-handoff-v1/);
});
