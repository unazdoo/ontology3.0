"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");
const adapter = fs.readFileSync(path.join(__dirname, "s003-scenario-adapter.js"), "utf8");
const contract = fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/data-contract.v1.1.json"), "utf8");
const factorConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/factor-config.v1.json"), "utf8"));
const riskBandConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/risk-band-config.v1.json"), "utf8"));
const pipelineRun = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/pipeline-run.v2.json"), "utf8"));
const sourceRegistry = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/source-registry.v4.json"), "utf8"));
const pipelineProjection = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/pipeline-current-projection.v4.json"), "utf8"));
const modelConfiguration = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m01/model-configuration.v3.json"), "utf8"));
const workbookDownload = fs.readFileSync(path.join(__dirname, "../../../scenarios/s003/resources/m02/企业债务风险评估模版_S003兼容版.xlsx"));

test("M02 keeps the baseline resource directory and data source detail renderer", () => {
  for (const token of ["function resourceDirectory", "function sourceDetail", "function sourceDetailBody", "function pipelinesPage", "function runDetail", "function assetDetail"]) {
    assert.ok(app.includes(token), `missing baseline function ${token}`);
  }
  assert.match(app, /SCENARIO_ID = REQUESTED_SCENARIO_ID === "S003" \? "S003" : "S001"/);
  assert.match(app, /window\.DE_SCENARIO_HOST/);
});

test("S003 directory and M02 pipeline only expose the financial workbook", () => {
  assert.match(app, /registerScenarioResourceBundle/);
  assert.match(app, /D\.sources\.filter\(s => s\.catalogVisible !== false/);
  assert.match(adapter, /sourceTabs: \(\) => \[\]/);
  assert.match(adapter, /managesSource: source => Boolean\(bundle && source\?\.id === "s003-workbook"\)/);
  const extension = adapter.match(/const extension = \{[\s\S]*?(?=\n  window\.DE_SCENARIO_EXTENSION)/)?.[0] || "";
  assert.match(extension, /renderSourceTab:/);
  assert.match(extension, /if \(source\?\.id === "s003-workbook"\)/);
  assert.doesNotMatch(extension, /if \(source\?\.id === "s003-enterprise-factor-input"\)/);
  assert.match(contract, /财务数据/);
  assert.match(contract, /企业因子/);
  assert.match(adapter, /currentPeriodColumn/);
  assert.match(adapter, /priorPeriodColumn/);
  assert.deepEqual(sourceRegistry.sources.map(item => item.nativeResourceId), ["s003-workbook"]);
  assert.equal(sourceRegistry.sources.find(item => item.nativeResourceId === "s003-workbook")?.visibleInDataSourceDirectory, true);
  assert.deepEqual(sourceRegistry.excludedFromDataSources.map(item => item.name), ["调节因子配置", "评分权重", "风险分档配置", "固定计算语义"]);
  assert.equal(sourceRegistry.runInputsNotDataSources[0].name, "企业当期因子输入快照");
  assert.equal(sourceRegistry.runInputsNotDataSources[0].owner, "M02 数据工程");
  const registration = app.match(/function registerScenarioResourceBundle\(resources\)[\s\S]*?(?=\n  function syncFlowData)/)?.[0] || "";
  assert.doesNotMatch(registration, /node-source-factor-config|node-source-risk-config|configSourceRecord/);
  assert.match(registration, /D\.sources\.findIndex\(item=>item\.id===sourceId\)/);
});

test("formal S003 source retains baseline settings lifecycle and generic pipeline quality asset routes", () => {
  assert.match(app, /managedScenarioSource=scenarioExtension\(\)\?\.managesSource\?\.\(s\)===true/);
  assert.match(app, /\["settings","设置"\]/);
  assert.match(adapter, /helpers\.button\("编辑设置","source-settings"/);
  assert.match(app, /pipelines\/\$\{p\.pipelineId\}\/canvas/);
  assert.match(app, /resources\/asset\/\$\{esc\(target\?\.id/);
});

test("S003 workbook overview, snapshots, downloads and source-specific pipeline nodes remain native", () => {
  assert.match(app, /if\(tab==="overview"\)return `\$\{sourceOverview\(s\)\}\$\{extended\}`/);
  assert.match(app, /download href="\$\{esc\(x\.downloadUrl\)\}"/);
  assert.match(app, /node-source-workbook/);
  assert.doesNotMatch(app, /node-source-enterprise-factors/);
  assert.match(app, /node-refresh/);
  assert.match(app, /inputSlotId:"financialWorkbook"/);
  assert.doesNotMatch(app, /inputSlotId:"enterpriseFactorInput"/);
  assert.match(adapter, /workbookSheetScope/);
  assert.match(adapter, /inputSheetIds: \["s003-financial"\]/);
  assert.match(app, /企业债务风险评估模版_S003兼容版\.xlsx/);
  assert.equal(crypto.createHash("sha256").update(workbookDownload).digest("hex"), "dbdab9c870d7f2e456c3a9e0f91b340b372da6d40eb241551e0ee8848cac42a0");
  assert.match(app, /source\.name/);
});

test("current pipeline has one financial source node and model configuration stays outside M02", () => {
  assert.deepEqual(pipelineRun.inputSources.map(item => item.nodeId), ["node-source-workbook"]);
  assert.ok(pipelineRun.inputSources.every(item => item.contentMode === "full-data" && item.passContentToPython === true));
  assert.equal(pipelineRun.nodes.find(item => item.nodeId === "node-refresh")?.status, "succeeded");
  assert.deepEqual(pipelineProjection.inputSources.map(item => item.nodeId), ["node-source-workbook"]);
  assert.ok(pipelineProjection.inputSources.every(item => item.contentMode === "full-data" && item.passContentToPython === true));
  assert.equal(pipelineProjection.adoptionEvidence.publishedPointerId, "S003-M01-PUBLISHED-POINTER");
  assert.match(app, /x:5810,y:4210/);
  assert.match(app, /x:6000,y:4210/);
  assert.match(app, /x:6190,y:4210/);
  assert.match(app, /x:6380,y:4210/);
  assert.match(app, /x:6570,y:4210/);
  assert.match(app, /鼠标滚轮缩放/);
  assert.match(app, /if\(!viewport\|\|!ui\.canvas\)return/);
  assert.match(app, /qualityRuleLabels/);
  assert.match(adapter, /不进入 Python 管道参数或数据质量规则/);
  assert.deepEqual(modelConfiguration.sections.map(item => item.sectionId), ["overview", "factors", "weights", "tiers"]);
  assert.equal(pipelineProjection.humanBusinessInputBinding.snapshotId, "S003-T053-INPUT-20251231-v1");
  assert.equal(pipelineProjection.humanBusinessInputBinding.pipelineInput, false);
});

test("CP14 M02 configuration files remain historical evidence while current ownership moves to M01", () => {
  assert.equal(factorConfig.configKind, "factor-coefficients");
  assert.equal(factorConfig.factors.length, 6);
  assert.equal(riskBandConfig.configKind, "risk-bands");
  assert.deepEqual(riskBandConfig.tiers.map(item => item.tierId), ["GREEN", "YELLOW", "RED", "BLACK"]);
  assert.equal(modelConfiguration.moduleId, "M01");
  assert.equal(modelConfiguration.businessOwner, "财务公司");
  assert.match(modelConfiguration.stableRoute, /tab=s003-model-config&configTab=\{sectionId\}/);
  const extension = adapter.match(/const extension = \{[\s\S]*?(?=\n  window\.DE_SCENARIO_EXTENSION)/)?.[0] || "";
  assert.doesNotMatch(extension, /getConfigProjection/);
  assert.doesNotMatch(extension, /s003-factor-config|s003-risk-band-config/);
  assert.match(adapter, /function redirectRetiredModelConfigRoute\(\)/);
  assert.match(adapter, /operation: "navigateScenarioModule"/);
  assert.match(adapter, /tab=s003-model-config&configTab=\$\{configTab\}/);
});

test("retired M02 model configuration projections are left untouched and all active routes move to M01", () => {
  for (const token of ["LEGACY_CONFIG_PROJECTION_SCHEMA", "migrateLegacyConfigProjection", "archiveConfigProjection", "configStateFor", "renderConfigEditor", "publishConfig"]) {
    assert.ok(!adapter.includes(token), `retired M02 config code must not remain active: ${token}`);
  }
  assert.match(adapter, /M02 不再读取、|旧调节因子\/风险分档数据源页面及其工作投影已经停用/);
  assert.doesNotMatch(adapter, /data-s003-m02-factor|data-s003-m02-action|saveS003FactorInputs|validateS003FactorInputs|publishS003FactorInputs/);
  assert.match(adapter, /企业当期因子保留为不可变 T053 输入版本/);
  assert.doesNotMatch(adapter, /localStorage\.clear|sessionStorage\.clear/);
});

test("M02 adapter does not hijack events or replace the module root", () => {
  assert.doesNotMatch(adapter, /stopImmediatePropagation|MutationObserver|capture:\s*true/);
  assert.doesNotMatch(adapter, /\.main[\s\S]{0,80}innerHTML|product-nav-foot[\s\S]{0,80}innerHTML/);
  assert.doesNotMatch(adapter, /localStorage\.clear|removeItem\([^)]*\*|重置整个场景/);
  assert.match(adapter, /runtimeMode = "read-only-degraded"/);
  assert.match(adapter, /基线数据工程目录、导航和通用操作仍保持可用/);
});

test("M02 versions enterprise inputs but never owns risk scoring weights coefficients or thresholds", () => {
  assert.match(adapter, /企业当期因子以 M02 T053 不可变人工输入快照/);
  assert.match(adapter, /调节因子系数、评分权重、固定计算语义和风险分档仍由 M01/);
  assert.doesNotMatch(adapter, /finalScore\s*=|rawScore\s*=|riskTiers\s*=|weights\s*=/);
  assert.match(adapter, /Python 管道参数或数据质量规则/);
});

test("current M02 view references formal adoption without fabricating historical request identifiers", () => {
  assert.equal(pipelineProjection.historicalEvidenceMutated, false);
  assert.match(app, /evidenceMode:"adoption-projection"/);
  assert.match(app, /当前投影不补造历史请求号/);
  assert.match(app, /t019EvidenceId:publishedPointer\.pointerId/);
  assert.match(app, /flow\.authorityVersionIds\[asset\.t006Id\]=version\.id/);
  assert.match(app, /version\.bindingTrustSummary=buildBindingTrustSummary\(version,run\)/);
  assert.match(app, /syncC017ProjectionStores\(\)/);
  assert.doesNotMatch(JSON.stringify(pipelineProjection.adoptionEvidence), /requestId|resultId/);
  assert.deepEqual(pipelineRun.inputSources.map(item => item.nodeId), ["node-source-workbook"]);
  assert.doesNotMatch(JSON.stringify(pipelineRun), /node-source-factor-config|node-source-risk-config/);
});

test("trusted formal adoption closes only the historical canvas display while new refresh stays on strict C003/C032 gates", () => {
  const projection = app.match(/function trustedFormalAdoptionProjection\(version,run,binding=ontologyBindingForCanvas\(\)\)[\s\S]*?(?=\n  function ontologyBindingGate)/)?.[0] || "";
  for (const token of ["trustedScenarioRegistration", "authorityVersion", "t019Status", "t019EvidenceId", "publishedContext", "sameScenarioContext", "sourceMappingVersionId", "currentFormal"]) {
    assert.match(projection, new RegExp(token), `trusted adoption projection misses ${token}`);
  }
  const bindingGate = app.match(/function ontologyBindingGate\(canvas=ui\.canvas\)[\s\S]*?(?=\n  function versionForNode)/)?.[0] || "";
  assert.match(bindingGate, /!delivery&&!adoptionProjection\.okay/);
  assert.match(bindingGate, /adoptionProjection:adoptionProjection\.okay\?adoptionProjection:null/);
  const discovery = app.match(/async function discoverOntologyBindings\(readPurpose="发现",options=\{\}\)[\s\S]*?(?=\n  function markRefreshSubmissionOutcome)/)?.[0] || "";
  const submit = app.match(/async function submitOntologyRefresh\(\)[\s\S]*?(?=\n  function requestRefresh)/)?.[0] || "";
  assert.match(discovery, /completeC003DeliveryForVersion\(version\)/);
  assert.match(discovery, /if\(!delivery\)/);
  assert.match(submit, /completeC003DeliveryForVersion\(version\)/);
  assert.match(submit, /discoverOntologyBindings\("提交前重读"/);
  assert.match(app, /当前投影不补造历史请求号/);
});

test("C003 waits for the S003 Published integration Draft and validates the financial input fingerprint", () => {
  assert.match(app, /function ontologyBridgeEntryUrl\(\)/);
  for (const field of ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status", "baselineVersion", "baselineSnapshotId", "prototypeVersion"]) {
    assert.match(app, new RegExp(`${field}:`), `hidden M01 bridge misses ${field}`);
  }
  assert.match(app, /function ontologyFrameReadyForC003\(frame\)/);
  assert.match(app, /published\.length>0&&drafts\.some/);
  assert.match(app, /slotId==="financialWorkbook"/);
  assert.match(app, /registeredSnapshots=D\.sources\.flatMap/);
  assert.match(app, /不会在页面加载时继续生成后续 Axx/);
  assert.doesNotMatch(app, /sourceFingerprint\?\.value!==run\?\.snapshotHash/);
});
