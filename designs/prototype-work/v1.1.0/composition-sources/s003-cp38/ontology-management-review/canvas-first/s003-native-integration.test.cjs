"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const scenarioApp = fs.readFileSync(path.resolve(root, "../../scenarios/s003/app.js"), "utf8");
const adapter = fs.readFileSync(path.join(root, "s003-scenario-adapter.js"), "utf8");
const adapterCss = fs.readFileSync(path.join(root, "s003-scenario-adapter.css"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const shellApp = fs.readFileSync(path.resolve(root, "../../s001-e2e-integration/app.js"), "utf8");
const modelConfiguration = JSON.parse(fs.readFileSync(path.resolve(root, "../../scenarios/s003/resources/m01/model-configuration.v3.json"), "utf8"));
const legacyModelConfiguration = JSON.parse(fs.readFileSync(path.resolve(root, "../../scenarios/s003/resources/m01/model-configuration.v2.json"), "utf8"));
const actionTypeCatalog = JSON.parse(fs.readFileSync(path.resolve(root, "../../scenarios/s003/resources/m01/action-type-catalog.v2.json"), "utf8"));
const sourceRegistry = JSON.parse(fs.readFileSync(path.resolve(root, "../../scenarios/s003/resources/m02/source-registry.v4.json"), "utf8"));

function sourceBetween(startPattern, endPattern) {
  const start = app.search(startPattern);
  assert.notEqual(start, -1, `missing source start ${startPattern}`);
  const tail = app.slice(start);
  const end = tail.search(endPattern);
  assert.notEqual(end, -1, `missing source end ${endPattern}`);
  return tail.slice(0, end);
}

function createC008RecoveryHarness(input = {}) {
  const functions = [
    sourceBetween(/function statePersistenceSnapshot\(\)/, /\n  function persist\(/),
    sourceBetween(/function isKnownLegacyC008ProjectionFault/, /\n  function storedC008ProjectionForRecovery/),
    sourceBetween(/function storedC008ProjectionForRecovery/, /\n  function rememberC008ProjectionFault/),
    sourceBetween(/function rememberC008ProjectionFault/, /\n  function recoverKnownLegacyC008ProjectionFault/),
    sourceBetween(/function recoverKnownLegacyC008ProjectionFault/, /\n  function writeAuthoritativeC008Projection/),
    sourceBetween(/function writeAuthoritativeC008Projection/, /\n  function repairAuthoritativeC008Projection/)
  ].join("\n");
  const values = new Map(Object.entries(input.storage || {}));
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
  const factory = new Function("env", `
    let state = env.state;
    const ENTRY_SCENARIO_ID = "S003";
    const ENTRY_SCENARIO_VERSION = "S003-v1";
    const ENTRY_SCENARIO_RUN_ID = "S003-RUN-20260815133000000-c03503000001";
    const STORAGE_KEY = "workspace";
    const C008_PROJECTION_KEY = "c008";
    const C008_PROJECTION_RECOVERY_SCHEMA_VERSION = 1;
    const LEGACY_C008_MISSING_VALIDATION_REASON = "可用状态投影缺少同场景、同双版本的候选固定题验证引用";
    const LEGACY_C008_BOOTSTRAP_CONTEXT_REASON = "统一权威投影与当前场景运行上下文不一致";
    const localStorage = env.localStorage;
    const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
    const scenarioContextOf = (value, fallback = {}) => {
      const source = value?.scenarioContext || value || {};
      return {
        scenarioId: source.scenarioId || fallback.scenarioId || null,
        scenarioVersion: source.scenarioVersion || fallback.scenarioVersion || null,
        scenarioRunId: source.scenarioRunId || fallback.scenarioRunId || null,
        scenarioName: source.scenarioName || fallback.scenarioName || null,
        formedAt: source.formedAt || fallback.formedAt || null,
        status: source.status || fallback.status || null
      };
    };
    const currentScenarioContext = () => clone(env.currentScenarioContext || {
      scenarioId: "S003",
      scenarioVersion: ENTRY_SCENARIO_VERSION,
      scenarioRunId: ENTRY_SCENARIO_RUN_ID,
      scenarioName: "债务风险监测",
      formedAt: "2026-08-15T13:30:00.000Z",
      status: "active"
    });
    const fullNowText = () => "2026-08-16 18:00:00";
    const makeId = prefix => prefix + "-TEST";
    const authoritativeProjectionReadFailure = env.authoritativeProjectionReadFailure;
    const authoritativeC008Projection = env.authoritativeC008Projection;
    ${functions}
    return { writeAuthoritativeC008Projection, getState: () => state };
  `);
  return {
    api: factory({
      state: input.state,
      localStorage,
      authoritativeProjectionReadFailure: input.authoritativeProjectionReadFailure,
      authoritativeC008Projection: input.authoritativeC008Projection,
      currentScenarioContext: input.currentScenarioContext
    }),
    values
  };
}

test("M01 keeps the baseline modeling and Published routes and only adds native extension hooks", () => {
  for (const token of ["function renderModelingHome", "function renderPublishedHome", "function renderPublishedVersion", "function renderPublishedResource", "function renderReadonlyModel"]) {
    assert.ok(app.includes(token), `missing baseline function ${token}`);
  }
  assert.match(app, /window\.ONTOLOGY_SCENARIO_HOST/);
  assert.match(app, /registerPublishedVersion:\s*registerScenarioPublishedVersion/);
  assert.match(app, /scenarioExtension\(\)\?\.versionTabs/);
  assert.match(app, /scenarioExtension\(\)\?\.renderVersionTab/);
  assert.doesNotMatch(adapter, /main\.innerHTML|\.main\)\.innerHTML|product-nav-foot[\s\S]{0,80}innerHTML/);
  assert.doesNotMatch(adapter, /MutationObserver|stopImmediatePropagation|capture:\s*true/);
  assert.match(adapter, /document\.addEventListener\("click", scheduleScenarioSurfaceSync\)/);
  assert.match(adapter, /window\.addEventListener\("hashchange", scheduleScenarioSurfaceSync\)/);
  assert.match(adapter, /replaceOrInsertAfter\(anchor, current, renderModelingPublishedSummary\(\)\)/);
  assert.doesNotMatch(adapter, /#modeling\/s003|#published\/s003/);
});

test("S003 M01 has a physically isolated workspace key while S001 keeps the exact baseline key", () => {
  assert.match(app, /ENTRY_SCENARIO_ID === "S001"[\s\S]*?"ontology3-canvas-first-review-v17"/);
  assert.match(app, /ontology3-canvas-first-review-v17:\$\{ENTRY_SCENARIO_ID\}:\$\{ENTRY_SCENARIO_VERSION\}:\$\{ENTRY_SCENARIO_RUN_ID\}/);
  assert.match(adapter, /if \(params\.get\("scenarioId"\) !== "S003"\) return/);
  assert.match(index, /s003-scenario-adapter\.js\?v=[^"']+/);
  assert.match(app, /function initialScenarioContext\(existing = null\)/);
  assert.match(app, /scenarioContexts: \{ \[entryContext\.scenarioId\]: entryContext \}, activeScenarioId: entryContext\.scenarioId/);
  assert.match(app, /if \(ENTRY_SCENARIO_ID === "S001" \|\| currentScenarioContextReady\(\)\) writeAuthoritativeC008Projection\(\)/);
});

test("S003 Published model is registered as a native version with Metric Rule and Action Type resources", () => {
  assert.match(adapter, /VERSION_ID = "S003-M01-DEBT-RISK-V1"/);
  assert.match(adapter, /ONTOLOGY_ID = "S003-M01-DEBT-RISK-PKG"/);
  assert.match(adapter, /registerPublishedVersion\(\{/);
  assert.match(adapter, /metricResources\(model\)/);
  assert.match(adapter, /ruleResources\(model\)/);
  assert.match(adapter, /actionResources\(model\)/);
  assert.match(adapter, /S003-METRIC-FINAL-SCORE/);
  assert.match(adapter, /S003-RULE-MAJOR-LITIGATION/);
  assert.match(adapter, /S003-RULE-CURRENT-FUND-GAP/);
  assert.match(adapter, /isCurrentTierOnlyModel\(model\) \? tierRules : \[\.\.\.tierRules, \.\.\.triggerRules\]/);
  assert.match(adapter, /集团债务风险管理人员从驾驶舱提交后，先形成通用 Action Request/);
  assert.match(adapter, /recipientRole: "成员单位债务风险接口人"/);
  assert.doesNotMatch(adapter, /S003-RULE-UNDER-CONSTRUCTION-60|S003-RULE-HISTORY-DEFAULT-A|S003-RULE-MISSING-FACTOR-ZERO|S003-RULE-FACTOR-/);
  assert.match(adapter, /CONFIG_TAB = "s003-model-config"/);
});

test("M01 provides one classified model configuration page and a stable dashboard route", () => {
  assert.equal(modelConfiguration.moduleId, "M01");
  assert.equal(modelConfiguration.businessOwner, "财务公司");
  assert.equal(modelConfiguration.scenarioIdentity.scenarioRunId, "S003-RUN-20260817163000000-c02200000001");
  assert.equal(modelConfiguration.publishedModelRef, "resources/m01/published-pointer.v2.json#/activeTarget/publishedSnapshot");
  assert.equal(modelConfiguration.supersedes, "resources/m01/model-configuration.v2.json");
  assert.deepEqual(modelConfiguration.sections.map(item => item.sectionId), ["overview", "factors", "weights", "tiers"]);
  assert.deepEqual(modelConfiguration.sections.map(item => item.label), ["配置总览", "调节因子配置", "评分权重", "风险分档配置"]);
  assert.equal("excludedSubTabs" in modelConfiguration, false);
  assert.doesNotMatch(JSON.stringify(modelConfiguration), /企业因子配置/);
  assert.match(adapter, /const MODEL_CONFIG_SECTIONS = Object\.freeze/);
  assert.match(adapter, /function normalizeModelConfiguration\(configuration\)/);
  assert.match(adapter, /function modelConfigurationFingerprint\(model\)/);
  assert.match(adapter, /const waitingForRerun = Boolean\(currentFingerprint && runFingerprint && currentFingerprint !== runFingerprint\)/);
  assert.match(adapter, /版本号不同，但未检测到有效配置内容变化/);
  assert.match(adapter, /source\.sections = MODEL_CONFIG_SECTIONS\.map/);
  assert.match(adapter, /modelConfiguration = normalizeModelConfiguration\(configuration\)/);
  assert.equal(legacyModelConfiguration.sections.some(item => !modelConfiguration.sections.some(current => current.sectionId === item.sectionId)), true);
  assert.match(modelConfiguration.stableRoute, /tab=s003-model-config&configTab=\{sectionId\}/);
  for (const token of ["function configSections()", "function configGroups()", "function configSectionGroups()", "function activeConfigSection()", "function modelConfigRoute(sectionId = \"overview\")", "调节因子配置", "评分权重", "风险分档配置", "保存模型草稿", "校验模型配置", "发布模型版本"]) {
    assert.ok(adapter.includes(token), `missing classified configuration token ${token}`);
  }
  assert.match(adapter, /modelConfigurationRoute: sectionId => modelConfigRoute\(sectionId\)/);
  assert.match(app, /if \(tab === "s003-model-config" && version\?\.ontologyStableId === "S003-M01-DEBT-RISK-PKG"\)/);
  assert.match(index, /app\.js\?v=20260819-40-performance/);
  assert.match(index, /s003-scenario-adapter\.js\?v=20260819-40-performance/);
  assert.match(adapter, /getModelConfiguration:/);
  assert.match(adapter, /shellRequest\("openS003DashboardCandidate", \{\}\)/);
  assert.match(adapter, /function refreshConfigViewInPlace\(\)/);
  assert.match(adapter, /type="button" data-s003-m01-action="publish"/);
  assert.doesNotMatch(adapter, /navigateScenarioModule", \{ moduleId: "dashboard"/);
  assert.doesNotMatch(adapter, /saveS003FactorInputs|validateS003FactorInputs|publishS003FactorInputs/);
  assert.doesNotMatch(adapter, /factor-input|data-s003-m01-factor-input|enterpriseFactorConfiguration/);
  assert.doesNotMatch(adapterCss, /factor-input/);
  assert.match(adapter, /独立 T053 人工输入快照/);
  assert.doesNotMatch(adapter, /在数据资源目录查看|data-s003-m01-open-factor-source|data-s003-m01-open-factor-input|#\/resources\/source\/s003-enterprise-factor-input/);
  assert.equal(sourceRegistry.sources.find(item => item.nativeResourceId === "s003-enterprise-factor-input"), undefined);
  assert.equal(sourceRegistry.sources.find(item => item.nativeResourceId === "s003-workbook").visibleInDataSourceDirectory, true);
  assert.match(adapter, /调节因子配置/);
  assert.match(adapter, /评分权重/);
  assert.match(adapter, /风险分档配置/);
  assert.match(adapter, /版本与生效机制/);
  assert.match(adapter, /不原地删除或启用旧版本/);
  assert.match(adapter, /需要回退时克隆旧版本形成更高版本的新 Draft/);
  assert.match(adapter, /驾驶舱按新版本快速重跑/);
  assert.match(adapterCss, /s003-m01-version-state/);
  assert.match(adapterCss, /s003-m01-version-rules/);
  assert.doesNotMatch(adapter.match(/function configSections\(\)[\s\S]*?(?=\n  function activeConfigSection)/)?.[0] || "", /行动触发|固定业务语义|发布与版本/);
  assert.match(adapter, /模型配置不得写入 Python 管道参数或数据质量规则|不进入 Python 管道参数或数据质量规则/);
  assert.equal(actionTypeCatalog.lifecycleStatus, "published");
  assert.equal(actionTypeCatalog.publishedModelBinding.semanticVersionId, "S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.deepEqual(actionTypeCatalog.actionTypes.map(item => item.displayName), ["风险分档跟踪", "专项风险处置", "重大风险应急响应"]);
  assert.match(adapter, /model-configuration\.v3\.json/);
  assert.match(adapter, /action-type-catalog\.v2\.json/);
  assert.match(adapter, /M04 与 M06 只消费当前 Published 名称和说明/);
  assert.match(adapter, /Published 消费上下文完整/);
  assert.match(adapter, /M03 兼容和问数运行由独立消费方状态展示/);
});

test("当前 Published 画布只展示风险分档 Rule，历史重大因子触发定义不装入当前本体", () => {
  assert.match(adapter, /旧模型中的重大因子[\s\S]*不应继续装入当前本体画布/);
  assert.match(adapter, /if \(!isCurrentTierOnlyModel\(model\)\) \(action\.triggerFactors \|\| \[\]\)\.forEach/);
  assert.match(scenarioApp, /风险行动候选按亮灯逐户纳入/);
  assert.match(scenarioApp, /重大因子只作为报告诊断证据，不单独生成行动/);
});

test("旧 T054 不可提交绑定会保留并追加当前精确映射绑定", () => {
  const appendSource = sourceBetween(/function appendRefreshTargetVersion\(version, statusValue, statusReason\)/, /\n  function ensureScenarioRefreshTarget/);
  const ensureSource = sourceBetween(/function ensureScenarioRefreshTarget\(versionId\)/, /\n  function versionRecord/);
  const context = { scenarioId: "S003", scenarioVersion: "S003-v1", scenarioRunId: "S003-RUN-TEST" };
  const version = {
    id: "S003-M01-DEBT-RISK-V1",
    name: "企业债务风险评估模型",
    ontologyStableId: "S003-M01-DEBT-RISK-PKG",
    semanticVersion: "V1.0.1",
    publicationState: "Published",
    refreshTargetStableId: "S003-T054-DEBT-RISK-REFRESH-TARGET",
    scenarioContext: context,
    dataContract: { mappingVersionId: "S003-M01-MAPPING-v1", assetId: "S003-T006-DEBT-RISK", members: [{ id: "financial" }, { id: "factor-input" }], relations: [] }
  };
  const oldTarget = {
    stableId: version.refreshTargetStableId,
    bindingVersion: "1",
    semanticVersionId: version.id,
    semanticVersion: version.semanticVersion,
    status: "active",
    sourceMappingVersionId: "LEGACY-MAPPING",
    dataAssetId: version.dataContract.assetId,
    memberIds: ["financial"],
    relationIds: [],
    evidenceLocator: "OLD-EVIDENCE",
    scenarioContext: context
  };
  const state = { publishedVersions: [version], refreshTargetBindingsByVersion: { [version.id]: [oldTarget] } };
  const factory = new Function("env", `
    let state = env.state;
    const ONTOLOGY_DEFINITION_OWNER = "本体管理";
    const clone = value => JSON.parse(JSON.stringify(value));
    const currentScenarioContext = () => clone(env.context);
    const sameScenarioDefinition = () => true;
    const publicationStateOf = item => item.publicationState;
    const versionDataContract = item => item.dataContract;
    const resolvedExternalValue = value => value != null && String(value).trim() !== "";
    const scenarioContextOf = item => clone(item.scenarioContext);
    const fullNowText = () => "2026-08-16 18:30:00";
    const refreshTargetHistory = item => state.refreshTargetBindingsByVersion[item.id] || [];
    const allRefreshTargets = () => Object.values(state.refreshTargetBindingsByVersion).flat();
    const latestRefreshTargetByStableId = stableId => allRefreshTargets().filter(item => item.stableId === stableId).sort((a, b) => Number(b.bindingVersion) - Number(a.bindingVersion))[0] || null;
    const latestRefreshTarget = item => refreshTargetHistory(item).slice().sort((a, b) => Number(b.bindingVersion) - Number(a.bindingVersion))[0] || null;
    const publishedMappingContractAssessment = () => ({ complete: true });
    const refreshTargetAssessment = (_version, target) => ({ label: target.sourceMappingVersionId === env.mappingVersion ? "可供刷新" : "来源映射不可定位" });
    const refreshTargetCandidate = (target, assetId) => ({ ...clone(target), allowRefreshSubmission: target.status === "active" && target.sourceMappingVersionId === env.mappingVersion && target.dataAssetId === assetId });
    const addRecord = () => ({ evidenceCode: "NEW-EVIDENCE" });
    let persistCount = 0;
    let renderCount = 0;
    const persist = () => { persistCount += 1; };
    const render = () => { renderCount += 1; };
    ${appendSource}
    ${ensureSource}
    return { run: ensureScenarioRefreshTarget, getState: () => state, counts: () => ({ persistCount, renderCount }) };
  `);
  const harness = factory({ state, context, mappingVersion: version.dataContract.mappingVersionId });
  const oldSnapshot = JSON.stringify(oldTarget);
  const result = harness.run(version.id);
  const history = harness.getState().refreshTargetBindingsByVersion[version.id];

  assert.equal(history.length, 2);
  assert.equal(JSON.stringify(history[0]), oldSnapshot);
  assert.equal(history[1].bindingVersion, "2");
  assert.equal(history[1].sourceMappingVersionId, version.dataContract.mappingVersionId);
  assert.match(history[1].statusReason, /追加兼容绑定；保留旧绑定 1/);
  assert.equal(result.allowRefreshSubmission, true);
  assert.deepEqual(harness.counts(), { persistCount: 1, renderCount: 1 });
});

test("C003 binds the exact delivery and asset version to a hidden S003 integration Draft", () => {
  assert.match(app, /function ensureScenarioIntegrationDraft\(version, context\)/);
  assert.match(app, /item\.integrationOnly === true/);
  assert.match(app, /!item\.sourceAssetVersion \|\| item\.sourceAssetVersion === contract\?\.assetVersion/);
  assert.match(app, /draft\.sourceDeliveryId = contract\.deliveryId/);
  assert.match(app, /draft\.sourceAssetVersion = contract\.assetVersion/);
  assert.match(app, /draft\.sourceDataContract = clone\(contract\)/);
  assert.match(app, /draftRevision: draft\.draftRevision/);
  assert.match(app, /function repairAcceptedDataAssetBinding\(contract, receipt\)/);
  assert.match(app, /repairAcceptedDataAssetBinding\(contract, deliveryExisting\)/);
});

test("S003 默认建模入口附加 Published 摘要而不替换基线 Draft 工作台", () => {
  assert.match(adapter, /function renderModelingPublishedSummary\(\)/);
  assert.match(adapter, /data-s003-m01-modeling-summary/);
  assert.doesNotMatch(adapter, /草稿、建模、版本、资源与画布仍使用 v1\.0\.3 原生能力/);
  assert.match(adapter, /data-s003-m01-open-version="resources"/);
  assert.match(adapter, /data-s003-m01-open-version="overview"/);
  assert.match(adapter, /data-s003-m01-open-version="canvas"/);
  assert.match(adapter, /ONTOLOGY_SCENARIO_HOST\.openVersion\(versionId/);
  assert.doesNotMatch(adapter, /querySelector\(["']\.draft-catalog-panel["']\)\?\.remove/);
});

test("S003 Published 资源形成 Metric → Rule → Action Type 可视依赖", () => {
  assert.doesNotMatch(adapter, /function factorRuleId\(factor, index = 0\)|S003-RULE-FACTOR-/);
  assert.match(adapter, /S003-RULE-MAJOR-LITIGATION/);
  assert.match(adapter, /S003-RULE-CURRENT-FUND-GAP/);
  assert.match(adapter, /metricIds: \["S003-METRIC-FINAL-SCORE"\]/);
  assert.match(adapter, /function actionRuleIds\(action, model\)/);
  assert.match(adapter, /ruleIds: actionRuleIds\(action, model\)/);
  assert.match(adapter, /actionTypeCatalog\?\.actionTypes/);
  assert.equal(actionTypeCatalog.actionTypes.some(item => item.actionTypeId === "S003_FACTOR_EMERGENCY"), false);
  assert.deepEqual(actionTypeCatalog.actionTypes.map(item => item.triggerSummary), ["黄灯风险分档", "红灯风险分档", "黑灯风险分档"]);
});

test("S003 Published 画布使用确定性分层布局并支持背景平移、滚轮缩放、节点点击和适配视图", () => {
  const layout = adapter.match(/function positionsFor\(version\)[\s\S]*?(?=\n  function buildVersion)/)?.[0] || "";
  assert.match(layout, /sourceMetrics/);
  assert.match(layout, /riskRules/);
  assert.match(layout, /triggerRules/);
  assert.match(layout, /version\.actions/);
  assert.match(adapter, /dataset\.s003M01CanvasEnhanced = "true"/);
  assert.match(adapter, /data-s003-m01-canvas-fit/);
  assert.match(adapter, /data-s003-m01-canvas-reset-layout/);
  assert.match(app, /supportsPublishedCanvasGestures: ENTRY_SCENARIO_ID === "S003"/);
  assert.match(app, /setPublishedCanvasZoom\(ui\.publishedCanvasZoom \* \(event\.deltaY < 0 \? 1\.1 : \.9\)/);
  assert.match(app, /publishedCanvasPanDrag/);
  assert.match(adapter, /点击节点查看资源或沿袭详情/);
  assert.match(adapter, /if \(node \|\| event\.target\.closest\("button, a, input, select, textarea"\)\) return/);
  assert.doesNotMatch(adapter, /node\.removeAttribute\("data-action"\)/);
  assert.match(adapter, /视图操作不会改写 Published 快照/);
});

test("Published lineage data nodes open read-only details instead of remaining inert", () => {
  assert.match(app, /data-action="open-published-lineage-node:/);
  assert.match(app, /ui\.modal = \{ type: "publishedLineageNode", versionId, nodeId \}/);
  assert.match(app, /Published 数据沿袭只读详情/);
  assert.match(app, /本体管理不能修改数据源、管道、质量规则或历史证据/);
  assert.match(app, /visibleNodeIds\.has\(member\.id\)/);
  assert.match(app, /\["process", "asset", "data", "source", "member", "field"\]\.includes\(node\.kind\)/);
  assert.match(adapter, /publishedLineageSourceChain:/);
  assert.match(adapter, /M01 模型配置/);
});

test("Published-only registration is independent from the Draft runtime and Draft failure is fail-closed", () => {
  const registerIndex = adapter.indexOf("waitForHost();");
  const publishedReadIndex = adapter.indexOf('shellRequest("getS003PublishedResources")');
  const runtimeReadIndex = adapter.lastIndexOf("await hydrateRuntime();");
  assert.ok(registerIndex >= 0 && registerIndex < publishedReadIndex && publishedReadIndex < runtimeReadIndex);
  assert.match(adapter, /Published 版本与资源仍可只读，配置写操作已关闭/);
  assert.match(adapter, /runtimeMode = "read-only-degraded"/);
  for (const operation of ["saveS003ConfigurationDraft", "validateS003Configuration", "publishS003Configuration", "resetS003Configuration"]) {
    assert.match(adapter, new RegExp(operation));
  }
});

test("S001 Published directory filters by the active scenario definition and cannot leak S003 resources", () => {
  assert.match(app, /state\.publishedVersions\.filter\(version => sameScenarioDefinition\(version, current\)\)/);
  assert.match(app, /const available = state\.publishedVersions\.filter\(item => sameScenarioDefinition\(item, current\)\)/);
});

test("动态 Published 升版保留上一正式组合并刷新场景级 C008/T019 投影", () => {
  const registration = app.match(/function registerScenarioPublishedVersion\(input\)[\s\S]*?(?=\n  function synchronizeStateFromStorage)/)?.[0] || "";
  assert.match(registration, /priorFormalSnapshot/);
  assert.match(registration, /rememberFormalSnapshot\(priorFormalSnapshot\)/);
  assert.match(registration, /existingRecords/);
  assert.match(registration, /existingRecord = mergedRecords\.get\(record\.id\)/);
  assert.match(registration, /candidateValidationReference: incomingBinding\.candidateValidationReference \|\| clone\(existingBinding\.candidateValidationReference \|\| null\)/);
  assert.match(registration, /previous: clone\(existingSlot\.previous \|\| null\)/);
  assert.match(registration, /persist\(\);/);
  assert.doesNotMatch(registration, /persist\(\{\s*refreshProjection:\s*false\s*\}\)/);
  assert.match(adapter, /basedOnPackageVersion/);
  assert.match(adapter, /basedOnVersionId/);
  assert.match(adapter, /model\.provenance\?\.sourceDraftId/);
});

test("仅已知旧 C008 验证引用故障会被隔离重建，未知故障继续 fail-closed", () => {
  assert.match(app, /LEGACY_C008_MISSING_VALIDATION_REASON = "可用状态投影缺少同场景、同双版本的候选固定题验证引用"/);
  const knownCheck = app.match(/function isKnownLegacyC008ProjectionFault\(reason\)[\s\S]*?(?=\n  function storedC008ProjectionForRecovery)/)?.[0] || "";
  assert.match(knownCheck, /ENTRY_SCENARIO_ID !== "S003"/);
  assert.match(knownCheck, /LEGACY_C008_MISSING_VALIDATION_REASON/);

  const recovery = app.match(/function recoverKnownLegacyC008ProjectionFault\(observedReason = null\)[\s\S]*?(?=\n  function writeAuthoritativeC008Projection)/)?.[0] || "";
  assert.match(recovery, /previousFault:/);
  assert.match(recovery, /previousProjection: stored\.projection/);
  assert.match(recovery, /previousProjectionRaw:/);
  assert.match(recovery, /c008ProjectionRecoveryHistory\.push\(recoveryRecord\)/);
  assert.match(recovery, /authoritativeC008Projection\(false\)/);
  assert.match(recovery, /历史正式证据未删除或覆盖/);

  const writer = app.match(/function writeAuthoritativeC008Projection\(\)[\s\S]*?(?=\n  function repairAuthoritativeC008Projection)/)?.[0] || "";
  assert.match(writer, /activeFaultReason && !isKnownLegacyC008ProjectionFault\(activeFaultReason\)\) return false/);
  assert.match(writer, /storedFailure && !isKnownLegacyC008ProjectionFault\(storedFailure\)/);
  assert.match(writer, /rememberC008ProjectionFault\(storedFailure\)/);
  assert.match(writer, /recoverKnownLegacyC008ProjectionFault\(storedFailure \|\| activeFaultReason\)/);
});

test("已知旧 C008 fault 保留旧投影并原位重建当前精确 unavailable 组合", () => {
  const reason = "可用状态投影缺少同场景、同双版本的候选固定题验证引用";
  const oldProjection = { projectionVersion: "7", readStatus: "available", publishedSemanticVersionId: "S003-M01-DEBT-RISK-V1", validationReference: null };
  const state = {
    c008ProjectionRevision: 7,
    c008ProjectionFormedAt: "2026-08-15 13:30:00",
    c008ProjectionFault: { detectedAt: "2026-08-15 13:31:00", reason },
    c008ProjectionRecoveryHistory: []
  };
  const rebuilt = {
    projectionVersion: "8",
    readStatus: "unavailable",
    publishedSemanticVersionId: "S003-M01-DEBT-RISK-V1_0_2",
    publishedSemanticVersion: "V1.0.2",
    consumableDataVersion: "S003-T007-DATA-v1",
    dataAsOf: "2025-12-31",
    evidenceLocator: "S003-M01-PUBLISHED-POINTER",
    scenarioContext: { scenarioId: "S003", scenarioVersion: "S003-v1", scenarioRunId: "S003-RUN-20260815133000000-c03503000001" }
  };
  const harness = createC008RecoveryHarness({
    state,
    storage: { c008: JSON.stringify(oldProjection) },
    authoritativeProjectionReadFailure: () => reason,
    authoritativeC008Projection: () => ({ ...rebuilt, projectionVersion: String(state.c008ProjectionRevision) })
  });

  assert.equal(harness.api.writeAuthoritativeC008Projection(), true);
  const nextState = harness.api.getState();
  assert.equal(nextState.c008ProjectionFault, null);
  assert.equal(nextState.c008ProjectionRecoveryHistory.length, 1);
  assert.deepEqual(nextState.c008ProjectionRecoveryHistory[0].previousProjection, oldProjection);
  assert.equal(nextState.c008ProjectionRecoveryHistory[0].previousFault.reason, reason);
  assert.equal(nextState.c008ProjectionRecoveryHistory[0].rebuiltProjection.readStatus, "unavailable");
  assert.equal(nextState.c008ProjectionRecoveryHistory[0].rebuiltProjection.publishedSemanticVersionId, "S003-M01-DEBT-RISK-V1_0_2");
  assert.equal(JSON.parse(harness.values.get("c008")).readStatus, "unavailable");
  assert.equal(JSON.parse(harness.values.get("c008")).publishedSemanticVersionId, "S003-M01-DEBT-RISK-V1_0_2");
  assert.equal(JSON.parse(harness.values.get("workspace")).c008ProjectionRecoveryHistory.length, 1);
});

test("旧初始化顺序写入 S003 命名空间的 S001 默认投影会显式隔离并重建", () => {
  const reason = "统一权威投影与当前场景运行上下文不一致";
  const oldProjection = {
    projectionId: "c008",
    projectionVersion: "1",
    schemaVersion: 1,
    readStatus: "empty",
    scenarioContext: {
      scenarioId: "S001",
      scenarioVersion: "S001-v1",
      scenarioRunId: "s001-awaiting-delivery",
      scenarioName: "集团融资成本与债务结构优化",
      formedAt: "2026-08-16 17:00:00",
      status: "等待合法交付"
    }
  };
  const state = {
    c008ProjectionRevision: 1,
    c008ProjectionFault: { detectedAt: "2026-08-16 17:00:01", reason },
    c008ProjectionRecoveryHistory: []
  };
  const rebuilt = {
    projectionVersion: "2",
    readStatus: "unavailable",
    publishedSemanticVersionId: "S003-M01-DEBT-RISK-V1",
    publishedSemanticVersion: "V1.0.1",
    consumableDataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
    dataAsOf: "2025-12-31",
    evidenceLocator: "S003-M01-PUBLISHED-POINTER",
    scenarioContext: {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: "S003-RUN-20260815133000000-c03503000001"
    }
  };
  const harness = createC008RecoveryHarness({
    state,
    storage: { c008: JSON.stringify(oldProjection) },
    authoritativeProjectionReadFailure: () => reason,
    authoritativeC008Projection: () => ({ ...rebuilt, projectionVersion: String(state.c008ProjectionRevision) })
  });

  assert.equal(harness.api.writeAuthoritativeC008Projection(), true);
  const nextState = harness.api.getState();
  assert.equal(nextState.c008ProjectionFault, null);
  assert.equal(nextState.c008ProjectionRecoveryHistory.length, 1);
  assert.equal(nextState.c008ProjectionRecoveryHistory[0].recoveryType, "known-legacy-s003-bootstrap-context");
  assert.equal(nextState.c008ProjectionRecoveryHistory[0].previousProjection.scenarioContext.scenarioId, "S001");
  assert.equal(JSON.parse(harness.values.get("c008")).scenarioContext.scenarioId, "S003");
});

test("非旧启动形态的跨场景上下文不一致继续 fail-closed", () => {
  const reason = "统一权威投影与当前场景运行上下文不一致";
  const raw = JSON.stringify({
    projectionId: "c008",
    schemaVersion: 1,
    scenarioContext: {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: "S003-RUN-TAMPERED"
    }
  });
  let rebuildCalls = 0;
  const harness = createC008RecoveryHarness({
    state: { c008ProjectionRevision: 1, c008ProjectionFault: { reason }, c008ProjectionRecoveryHistory: [] },
    storage: { c008: raw },
    authoritativeProjectionReadFailure: () => reason,
    authoritativeC008Projection: () => { rebuildCalls += 1; return {}; }
  });

  assert.equal(harness.api.writeAuthoritativeC008Projection(), false);
  assert.equal(harness.values.get("c008"), raw);
  assert.equal(rebuildCalls, 0);
  assert.equal(harness.api.getState().c008ProjectionRecoveryHistory.length, 0);
});

test("未知 C008 fault 不自动删除、覆盖或重建", () => {
  const unknownReason = "统一权威投影结构版本不兼容";
  const oldRaw = JSON.stringify({ schemaVersion: 0, readStatus: "available" });
  const state = {
    c008ProjectionRevision: 7,
    c008ProjectionFault: { detectedAt: "2026-08-15 13:31:00", reason: unknownReason },
    c008ProjectionRecoveryHistory: []
  };
  let rebuildCalls = 0;
  const harness = createC008RecoveryHarness({
    state,
    storage: { c008: oldRaw },
    authoritativeProjectionReadFailure: () => unknownReason,
    authoritativeC008Projection: () => { rebuildCalls += 1; return {}; }
  });

  assert.equal(harness.api.writeAuthoritativeC008Projection(), false);
  assert.equal(harness.values.get("c008"), oldRaw);
  assert.equal(rebuildCalls, 0);
  assert.equal(harness.api.getState().c008ProjectionRecoveryHistory.length, 0);
  assert.equal(harness.api.getState().c008ProjectionFault.reason, unknownReason);
});

test("缺少智能问数候选验证时精确 C008 组合保持 unavailable，而非伪报 available", () => {
  const bindingPackage = app.match(/function authoritativeBindingPackage\(version\)[\s\S]*?(?=\n  function currentScenarioContext)/)?.[0] || "";
  assert.match(bindingPackage, /validationReference\.sourceModule === "智能问数"/);
  assert.match(bindingPackage, /validationReference\.contractCode === "C008"/);
  assert.match(bindingPackage, /validationReference\.decisionRef === "D064"/);
  assert.match(bindingPackage, /sameScenarioEnvelope\(validationReference, binding\)/);
  assert.match(bindingPackage, /adoptionEvidenceReady && validationReferenceReady/);
  assert.match(bindingPackage, /等待智能问数候选固定题验证/);

  const projection = app.match(/function authoritativeC008Projection\(validateStored = true\)[\s\S]*?(?=\n  function isKnownLegacyC008ProjectionFault)/)?.[0] || "";
  assert.match(projection, /packageValue\?\.consumable\s*\? "available"\s*:\s*"unavailable"/);
  assert.match(projection, /publishedSemanticVersionId: exposeBinding \? current\.id : null/);
  assert.match(projection, /validationReference: exposeBinding && binding\?\.candidateValidationReference/);
});

test("统一壳按当前 S003 scenarioRunId 读取隔离的 C008 权威投影", () => {
  assert.match(shellApp, /function currentC008ProjectionKey\(\)/);
  assert.match(shellApp, /`\$\{C008_PROJECTION_KEY\}:\$\{context\.scenarioId\}:\$\{context\.scenarioVersion\}:\$\{context\.scenarioRunId\}`/);
  assert.match(shellApp, /readStoredObject\(currentC008ProjectionKey\(\)\)/);
});
