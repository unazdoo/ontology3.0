"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const dataPath = path.join(scenarioRoot, "data.js");
const statePath = path.join(scenarioRoot, "state.js");
const appPath = path.join(scenarioRoot, "app.js");
const queryServicePath = path.join(scenarioRoot, "domain", "query-service.js");
const stylesPath = path.join(scenarioRoot, "styles.css");
const indexPath = path.join(scenarioRoot, "index.html");

const dataSource = fs.readFileSync(dataPath, "utf8");
const stateSource = fs.readFileSync(statePath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");
const queryServiceSource = fs.readFileSync(queryServicePath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");
const indexSource = fs.readFileSync(indexPath, "utf8");
const dataContract = require(path.join(scenarioRoot, "resources", "m02", "data-contract.v1.1.json"));
const sourceRegistry = require(path.join(scenarioRoot, "resources", "m02", "source-registry.v4.json"));
const pipelineProjection = require(path.join(scenarioRoot, "resources", "m02", "pipeline-current-projection.v4.json"));
const agentPosition = require(path.join(scenarioRoot, "resources", "m05", "agent-position.v1.json"));
const scenarioManifest = require(path.join(scenarioRoot, "resources", "scenario-manifest.json"));

function loadDataModule(fetchImpl) {
  const window = {
    S003ScoreEngine: {},
    S003ConfigService: {},
    S003QueryService: {},
    S003DecisionService: {},
    S003ReportService: {},
    S003CheckpointService: {},
    S003CheckpointProjection: {}
  };
  const context = {
    window,
    fetch: fetchImpl || (async function () {
      throw new Error("unexpected fetch");
    })
  };
  vm.runInNewContext(dataSource, context, { filename: dataPath });
  return window.S003Data;
}

test("统一场景壳保留 M01—M06，并恢复 v1.0.3 的八个公共入口", () => {
  const data = loadDataModule();
  const moduleIds = data.MODULES.map(function (item) { return item.id; });
  assert.equal(data.MODULES.length, 6);
  assert.deepEqual([...moduleIds].sort(), ["M01", "M02", "M03", "M04", "M05", "M06"]);
  assert.ok(data.MODULES.every(function (item) {
    return typeof item.view === "string" && item.view.length > 0 && !("href" in item);
  }));
  assert.equal(JSON.stringify(Array.from(data.PLATFORM_NAV, function (item) { return item.id; })), JSON.stringify(["home", "M02", "M01", "M03", "M04", "M05", "M06", "dashboard"]));
  assert.match(appSource, /data-platform-action=/);
  assert.match(appSource, /view-platform-home/);
  assert.match(appSource, /view-overview/);
});

test("模块入口映射到 S003 壳内视图和既有 Owner", () => {
  const data = loadDataModule();
  const modules = Object.fromEntries(data.MODULES.map(function (item) { return [item.id, item]; }));

  assert.equal(modules.M02.view, "data-quality");
  assert.equal(modules.M01.view, "configuration");
  assert.equal(modules.M03.view, "query-decision");
  assert.equal(modules.M03.anchor, "m03-query");
  assert.equal(modules.M04.view, "query-decision");
  assert.equal(modules.M04.anchor, "m04-decision");
  assert.equal(modules.M05.view, "agent-boundary");
  assert.equal(modules.M06.view, "overview");

  for (const mapping of [
    ['"data-quality": "M02"', "M02 数据与质量"],
    ['"factor-entry": "M02"', "M02 企业因子填报"],
    ['configuration: "M01"', "M01 模型配置"],
    ['"query-decision": "M03"', "M03/M04 共用壳内视图"],
    ['"agent-boundary": "M05"', "M05 能力边界"],
    ['overview: "M06"', "M06 总览"],
    ['enterprises: "M06"', "M06 企业明细"],
    ['runs: "M06"', "M06 运行"],
    ['checkpoints: "M06"', "M06 快照"],
    ['report: "M06"', "M06 报告"]
  ]) {
    assert.ok(stateSource.includes(mapping[0]), `${mapping[1]}映射缺失`);
  }

  assert.equal(dataContract.moduleOwner, "数据工程");
  assert.equal(dataContract.businessInputOwner, "财务公司");
  assert.equal(agentPosition.moduleOwner, "Agent应用");
  assert.equal(scenarioManifest.scenario.businessOwner, "财务公司");
});

test("M01—M06 主入口以 v1.0.3 壳为主体装载基线模块原型，不裁剪模块内部结构", () => {
  const data = loadDataModule();
  assert.ok(data.MODULES.every(function (item) {
    return item.frameView && item.source && item.entryHash;
  }));
  assert.equal(data.HANDOFF_CHANNEL, "ontology3.0-s001-handoff-v1");
  for (const item of data.PLATFORM_NAV) {
    if (item.id === "home" || item.id === "dashboard") continue;
    assert.equal(item.action, "open-module-adapter", `${item.id} 一级入口必须直达基线模块帧`);
    assert.equal(item.baselineModuleId, item.id, `${item.id} 一级入口缺少基线模块映射`);
  }
  assert.match(appSource, /function renderModuleFrame\(moduleId\)/);
  assert.match(appSource, /class="module-view"/);
  assert.match(appSource, /<iframe id="module-frame"/);
  assert.match(appSource, /is-module-stage/);
  assert.match(appSource, /deliverScenarioContextToFrame/);
  assert.match(appSource, /captureFramePosition/);
  assert.match(appSource, /moduleFrameCache/);
  assert.match(appSource, /cacheCurrentModuleFrame/);
  assert.match(appSource, /warmModuleSources/);
  assert.match(appSource, /cache: "force-cache"/);
  assert.match(appSource, /module-M03/);
  assert.match(appSource, /module-M04/);
  assert.match(appSource, /不替换基线页面内部能力/);
});

test("产业卡可直接带入企业明细筛选，风险行动展示按灯归类", () => {
  assert.match(appSource, /data-action="view-sector-enterprises"/);
  assert.match(appSource, /STORE\.setFilter\("enterpriseSectorFilter"/);
  assert.match(appSource, /function candidateActionLabel\(candidate\)/);
  assert.match(appSource, /黄灯预警/);
  assert.match(appSource, /红灯预警/);
  assert.match(appSource, /黑灯预警/);
  assert.match(stylesSource, /sector-drill-hint/);
});

test("场景上下文通过基线模块真实监听的交接频道投递，不再使用私有频道或注入改写 CSS", () => {
  assert.match(appSource, /DATA\.HANDOFF_CHANNEL/);
  assert.match(dataSource, /ontology3\.0-s001-handoff-v1/);
  assert.doesNotMatch(appSource, /ontology3\.0-s003-handoff-v1/);
  assert.doesNotMatch(appSource, /moduleFrameAdapterCss/);
  assert.doesNotMatch(appSource, /s003-module-adapter/);
  assert.doesNotMatch(appSource, /display:none!important/);
  // 投递语义与 v1.0.3 公共壳一致：M01 收 C033 信封，M02 收场景上下文本体。
  const deliverSource = appSource.match(/function deliverScenarioContextToFrame\(frame, module\)[\s\S]*?(?=\n  function captureFramePosition)/)?.[0] || "";
  assert.ok(deliverSource, "deliverScenarioContextToFrame 源码缺失");
  assert.match(deliverSource, /module\.id !== "M01" && module\.id !== "M02"/);
  assert.match(deliverSource, /contractCode: "C033"/);
  assert.match(deliverSource, /targetModule: module\.id === "M01" \? "本体管理" : "数据工程"/);
});

test("所有工作台视图持续展示场景、基线、Published 模型和数据身份", () => {
  for (const label of [
    "scenarioId",
    "scenarioVersion",
    "scenarioRunId",
    "baselineVersion",
    "baselineSnapshotId",
    "Published 模型",
    "Published 输入",
    "数据资产",
    "assessmentAt"
  ]) {
    assert.ok(appSource.includes(label), `持续身份栏缺少 ${label}`);
  }
  assert.match(appSource, /scene-frame/);
  assert.match(appSource, /scenarioTabs\(\)/);
  assert.match(appSource, /identityRail\(\)/);
  assert.match(appSource, /baseline-architecture/);
  assert.equal(scenarioManifest.baseline.baselineVersion, "1.0.3");
  assert.equal(scenarioManifest.baseline.immutable, true);
});

test("M02 当前场景只接入财务数据，并锁定 I\/AA、评估口径和质量边界", () => {
  assert.deepEqual(pipelineProjection.inputSources.map((item) => item.slotId), ["financialWorkbook"]);
  assert.deepEqual(sourceRegistry.sources.find((item) => item.nativeResourceId === "s003-workbook").pipelineMemberScope, ["财务数据"]);
  assert.deepEqual(sourceRegistry.sources.map((item) => item.nativeResourceId), ["s003-workbook"]);
  assert.equal(sourceRegistry.runInputsNotDataSources[0].name, "企业当期因子输入快照");
  assert.equal(sourceRegistry.runInputsNotDataSources[0].owner, "M02 数据工程");
  assert.equal(sourceRegistry.excludedFromDataSources.some((item) => item.name === "企业因子配置"), false);
  assert.equal(dataContract.currentPeriodColumn, "I");
  assert.equal(dataContract.priorPeriodColumn, "AA");
  assert.equal(dataContract.assessmentAt, "2025-12-31");
  assert.equal(dataContract.currency, "CNY");
  assert.equal(dataContract.amountUnit, "元");
  assert.equal(dataContract.applicability["环保.电价波动率"], "NOT_APPLICABLE");
  assert.equal(dataContract.applicability["在建企业.电价波动率"], "NOT_APPLICABLE");

  for (const excluded of ["风险评分", "评分公式", "因子系数", "评分权重", "风险阈值", "风险分档命中", "Action Type 命中"]) {
    assert.ok(dataContract.qualityDoesNotOwn.includes(excluded), `M02 排除项缺少 ${excluded}`);
  }
  assert.match(dataSource, /财务工作簿作为唯一数据源登记/);
  assert.match(dataSource, /锁定 T053 企业因子输入/);
  assert.match(dataSource, /独立人工输入快照/);
});

test("M05 明示一期无专属 Agent，并阻断四项越界动作", () => {
  assert.equal(agentPosition.dedicatedAgent, false);
  assert.equal(agentPosition.status, "verified-not-required-for-phase-1");
  assert.deepEqual(agentPosition.forbidden, ["重算C035结果", "修改模型配置", "自动创建Action Request", "替代人工确认"]);
  assert.match(appSource, /一期不建设 S003 专属 Agent/);
  assert.match(appSource, /Agent 不进入评分闭环/);
  assert.match(appSource, /四项强制阻断/);
  assert.match(appSource, /Agent 写入<\/dt><dd>禁止/);
});

test("驾驶舱风险行动说明与讲解稿采用同一亮灯及两阶段分办口径", () => {
  assert.match(appSource, /风险行动候选按亮灯逐户纳入/);
  assert.match(appSource, /黄灯、红灯、黑灯各形成一条预警候选/);
  assert.match(appSource, /重大因子只作为报告诊断证据，不单独生成行动/);
  assert.match(appSource, /overview-action-panel/);
  assert.match(appSource, /const actionCandidates = decisionCandidates\(\)/);
  assert.match(appSource, /data-action="view-decision-todos"/);
  assert.match(appSource, /提交后将直接送达.*决策中心；本步骤不设置负责人，也不会创建待办/);
  assert.match(appSource, /接口人确认并选择负责人后，才会形成负责人待办/);
  assert.match(appSource, /行动申请不经过集团管理员统一收件/);
});

test("CP08 是可选加载项，文件尚未形成时不阻断场景启动", async () => {
  const requested = [];
  const data = loadDataModule(async function (resourcePath) {
    requested.push(resourcePath);
    if (resourcePath.includes("CP08-unified-scene-shell-completed.json")) {
      return { ok: false, status: 404, statusText: "Not Found" };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async function () { return {}; }
    };
  });

  const bundle = await data.load();
  const cp08 = bundle.checkpoints.find(function (item) { return item.code === "CP08"; });
  assert.ok(requested.some(function (item) { return item.includes("CP08-unified-scene-shell-completed.json"); }));
  assert.ok(cp08);
  assert.equal(cp08.manifest, null);
  assert.equal(bundle.model && typeof bundle.model, "object");
});

test("快照查看、恢复、回归和快速重评统一经过 C034 场景编排服务", () => {
  for (const contractCall of [
    "createCheckpointService",
    ".viewHistorical(",
    ".cloneRestore(",
    ".createRegression(",
    ".beginRerun(",
    ".completeRunAttempt("
  ]) {
    assert.ok(stateSource.includes(contractCall), `state.js 缺少 ${contractCall} 编排桥接`);
  }
  assert.match(stateSource, /OP-S003-\$\{operationTimestamp17\(\)\}-\$\{nonce\}/);
  assert.doesNotMatch(stateSource, /FOUNDATION\.cloneRestore\(/);
  assert.doesNotMatch(stateSource, /FOUNDATION\.createIsolatedRegression\(/);
  assert.match(appSource, /await STORE\.isolatedRegression/);
});

test("克隆恢复只恢复版本化状态，不把历史结果冒充为新运行成功结果", () => {
  assert.match(stateSource, /runStatus: "restored"/);
  assert.match(stateSource, /activeRun: null/);
  assert.match(stateSource, /当前仅恢复配置与数据状态，尚未形成新评估结果/);
  assert.doesNotMatch(stateSource, /executionMode = "restored-projection"/);
  assert.match(appSource, /恢复操作只克隆版本化状态/);
});

test("动态运行、恢复副本和隔离回归可刷新续接，并可无副作用返回正式运行", () => {
  assert.match(stateSource, /assertProjectionPayload\(context, "m06", "runs\/current", payload\)/);
  assert.match(stateSource, /assertProjectedRunResources\(projectedRuntime, projectedConfig, projectedFactors\)/);
  assert.match(stateSource, /delete stored\.reports/);
  assert.match(stateSource, /ensureRuntimeReports\(projectedRun/);
  assert.match(appSource, /run\.riskCounts \|\| \{\}/);
  assert.match(stateSource, /returnToLastSuccessfulRun/);
  assert.match(appSource, /data-action="return-successful-run"/);
  assert.match(appSource, /url\.searchParams\.set\("scenarioRunId"/);
  assert.match(appSource, /未重放任何历史副作用/);
});

test("历史快照只通过显式退出离开，并可用 checkpoint 参数跨模块和刷新续接", () => {
  const navigateSource = appSource.match(/function navigate\(view, enterpriseId, options\)[\s\S]*?(?=\n  async function quickRerun)/)?.[0] || "";
  assert.ok(navigateSource);
  assert.doesNotMatch(navigateSource, /exitHistoricalView/);
  assert.match(appSource, /url\.searchParams\.set\("checkpoint", state\(\)\.historicalView\.code\)/);
  assert.match(stateSource, /checkpointCode: query\.get\("checkpoint"\)/);
  assert.match(stateSource, /if \(route\.checkpointCode\) await viewCheckpoint\(route\.checkpointCode\)/);
  assert.match(appSource, /历史报告只读链接已复制；刷新后仍按 Checkpoint 还原/);
});

test("NOT_APPLICABLE 使用明确不适用视觉，不会回显旧业务枚举值", () => {
  assert.match(appSource, /notApplicable \|\| value == null \|\| value === "" \? "selected"/);
  assert.match(appSource, /!notApplicable && choice === value \? "selected"/);
  assert.match(appSource, /is-not-applicable/);
  assert.match(stylesSource, /\.factor-field\.is-not-applicable/);
  assert.match(stylesSource, /select:disabled[^}]*-webkit-text-fill-color/s);
});

test("运行和 Checkpoint 时间统一使用确定性 UTC 口径", () => {
  const data = loadDataModule();
  assert.equal(data.formatDateTime("2026-08-15T13:30:00.000Z"), "2026-08-15 13:30:00 UTC");
  assert.equal(data.formatDateTime("invalid"), "invalid");
});

test("S003 目录入口只兼容跳转到 v1.0.3 派生统一壳", () => {
  assert.match(indexSource, /s001-e2e-integration\/index\.html/);
  assert.match(indexSource, /searchParams\.set\("scenarioId", "S003"\)/);
  assert.match(indexSource, /window\.location\.replace/);
  assert.match(indexSource, /window\.location\.protocol === "file:"/);
  assert.match(indexSource, /http:\/\/127\.0\.0\.1:4333\/s001-e2e-integration\/index\.html/);
  assert.match(indexSource, /启动S003\.command/);
  assert.doesNotMatch(indexSource, /src="\.\/app\.js/);
  assert.doesNotMatch(indexSource, /src="\.\/state\.js/);
  assert.match(dataSource, /const ASSET_VERSION = currentScriptVersion \|\| "20260819-40-performance"/);
  assert.match(dataSource, /decision-center-prototype\/index\.html\?prototypeBuild=20260819-40-performance/);
  assert.match(dataSource, /scenarioAssetUrl\(path\)/);
  assert.match(dataSource, /script\.src = `\$\{resolved\}\$\{resolved\.includes\("\?"\)/);
});

test("S003 文件入口不再把 file:// 重定向到会静默失败的公共壳", () => {
  const shellIndex = fs.readFileSync(path.resolve(scenarioRoot, "../../s001-e2e-integration/index.html"), "utf8");
  assert.match(shellIndex, /params\.get\("scenarioId"\) === "S003"/);
  assert.match(shellIndex, /scenarios\/s003\/index\.html/);
  assert.match(shellIndex, /window\.location\.replace/);
});

test("隔离回归在 UI 和状态层同时阻断 Action Request 与负责人待办", () => {
  assert.match(stateSource, /隔离回归为演练模式，不得创建 Action Request、通知或负责人待办/);
  assert.match(appSource, /current\?\.authorityMode === "isolated-regression"/);
  assert.match(appSource, /if \(!runAuthority\(\)\.canDecision\) throw new Error\("M04 已阻断/);
  assert.match(appSource, /工作投影、历史只读或隔离演练均不得创建行动申请、通知或负责人待办/);
});

test("行动闭环分为驾驶舱提交与成员单位接口人确认分办两个阶段", () => {
  assert.match(appSource, /行动申请不经过集团管理员统一收件/);
  assert.match(appSource, /集团债务风险管理人员显式提交后，行动申请直达对应成员单位债务风险接口人/);
  assert.match(appSource, /成员单位接口人确认并选择负责人后，沿用通用决策中心框架形成负责人待办/);
  assert.match(appSource, /invokeStoreMethod\(\["submitActionRequest", "submitDecision"\]/);
  assert.match(appSource, /invokeStoreMethod\(\["confirmMemberUnitDecision", "confirmMemberUnitActionRequest", "confirmSubmittedActionRequest", "confirmDecision"\]/);
  assert.match(appSource, /提交后只形成送达对应成员单位接口人的行动申请，不设置负责人、不创建待办/);
});

test("published-runtime 明示为工作投影，并在 UI 与状态边界阻断 M03 和 M04", () => {
  assert.match(appSource, /current\.authorityMode === "published-runtime" \|\| current\.projectionOnly === true/);
  assert.match(appSource, /工作投影 \/ 待 Owner 导出/);
  assert.match(appSource, /M03 查询已阻断/);
  assert.match(appSource, /M04 处置候选已阻断/);
  assert.match(appSource, /if \(!runAuthority\(\)\.canQuery\)/);
  assert.match(appSource, /if \(!runAuthority\(\)\.canDecision\)/);
  assert.match(stylesSource, /\.query-option:disabled/);
  assert.match(stylesSource, /\.authority-banner\.work-projection/);
});

test("工作投影报告只可预览，正式制品、深链和导出仅向 published-evidence 开放", () => {
  assert.match(appSource, /formalActionsAllowed = Boolean\(authority\.canFormalReport && formal && formal\.projectionOnly !== true\)/);
  assert.match(appSource, /if \(!state\(\)\.historicalView && isPublishedEvidenceRun\(run\)\)/);
  assert.match(appSource, /工作投影或隔离演练不生成正式报告深链/);
  assert.match(appSource, /if \(!isPublishedEvidenceRun\(displayRun\(\)\)\) return toast/);
  assert.match(appSource, /正式打印与 PDF 导出须等待 Owner 导出/);
  assert.match(appSource, /report-page[^`]*report-preview/);
  assert.match(stylesSource, /\.report-page\.report-preview\s*\{[^}]*display:\s*none!important/s);
});

test("M03 运行时同时绑定同轮 C035 与 Published 风险事实", () => {
  assert.match(stateSource, /portfolio: run\.raw,[\s\S]*c035Results: run\.raw,[\s\S]*publishedFacts: bundle\.publishedFacts/);
  assert.match(queryServiceSource, /PUBLISHED-RESULTS/);
});

test("CP03/CP04 历史视图不得跨越读取当前 bundle 的 CP06 报告", () => {
  const resolverSource = appSource.match(/function formalReportFor\(enterpriseId\)[\s\S]*?(?=\n  function renderReport)/)?.[0] || "";
  assert.ok(resolverSource, "formalReportFor 源码缺失");
  const historicalBranch = resolverSource.match(/if \(st\.historicalView\) \{[\s\S]*?return \{ manifest, content, artifact, projectionOnly: false \};\n    \}/)?.[0] || "";
  assert.ok(historicalBranch, "历史报告解析分支缺失");
  assert.match(historicalBranch, /st\.historicalView\.projection/);
  assert.match(historicalBranch, /projection\?\.reportManifest\?\.reports/);
  assert.match(historicalBranch, /if \(!manifest\) return null/);
  assert.doesNotMatch(historicalBranch, /bundle\(\)/);
  assert.match(appSource, /state\(\)\.historicalView && !formal/);
  assert.match(appSource, /不得跨越到后续 CP06 报告资源/);
});

test("调节因子与风险分档配置展示适用范围、分档标准和默认语义", () => {
  for (const token of ["DEFAULTED_ZERO", "NOT_APPLICABLE", "factor-config-note", "risk-tier-description", "综合分 = clamp"]) {
    assert.ok(appSource.includes(token), `配置页面缺少 ${token}`);
  }
});

test("壳层不复用 S001 运行身份，也不复制 S001 融资业务定义", () => {
  const shellSources = [dataSource, stateSource, appSource, stylesSource].join("\n");
  assert.doesNotMatch(shellSources, /S001-RUN-/);
  assert.doesNotMatch(shellSources, /S001-ENT-/);
  assert.doesNotMatch(shellSources, /S001-v\d/);
  assert.doesNotMatch(shellSources, /融资指标|融资风险评分|S001 Action/);
  assert.equal(scenarioManifest.scenario.scenarioId, "S003");
  assert.equal(scenarioManifest.scenario.scenarioVersion, "S003-v1");
  assert.match(scenarioManifest.scenario.initialScenarioRunId, /^S003-RUN-/);
});

test("统一字号 token 与 1080\/820\/560 响应式断点完整存在", () => {
  for (const token of ["--type-caption", "--type-meta", "--type-body", "--type-label"]) {
    assert.ok(stylesSource.includes(token), `缺少字号 token ${token}`);
  }
  for (const breakpoint of [1080, 820, 560]) {
    assert.match(stylesSource, new RegExp(`@media \\(max-width: ${breakpoint}px\\)`));
  }
  assert.match(stylesSource, /\.identity-rail\s*\{[^}]*grid-template-columns/s);
  assert.match(stylesSource, /\.global-nav\.is-mobile-open\s*\{[^}]*transform:\s*translateX\(0\)/s);
});
