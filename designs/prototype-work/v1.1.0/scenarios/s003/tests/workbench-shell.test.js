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
const stylesPath = path.join(scenarioRoot, "styles.css");

const dataSource = fs.readFileSync(dataPath, "utf8");
const stateSource = fs.readFileSync(statePath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");
const stylesSource = fs.readFileSync(stylesPath, "utf8");
const dataContract = require(path.join(scenarioRoot, "resources", "m02", "data-contract.v1.1.json"));
const agentPosition = require(path.join(scenarioRoot, "resources", "m05", "agent-position.v1.json"));
const scenarioManifest = require(path.join(scenarioRoot, "resources", "scenario-manifest.json"));

function loadDataModule(fetchImpl) {
  const window = {
    S003ScoreEngine: {},
    S003ConfigService: {},
    S003QueryService: {},
    S003DecisionService: {},
    S003ReportService: {},
    S003CheckpointService: {}
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

test("统一场景壳只保留 M01—M06 六个既有模块，不新增第七模块", () => {
  const data = loadDataModule();
  const moduleIds = data.MODULES.map(function (item) { return item.id; });
  assert.equal(data.MODULES.length, 6);
  assert.deepEqual([...moduleIds].sort(), ["M01", "M02", "M03", "M04", "M05", "M06"]);
  assert.ok(data.MODULES.every(function (item) {
    return typeof item.view === "string" && item.view.length > 0 && !("href" in item);
  }));
  assert.match(appSource, /<button class="nav-item \$\{isActive \? "active" : ""\}" type="button" data-module-id=/);
  assert.doesNotMatch(appSource, /<a[^>]+data-module-id=/);
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
  assert.match(appSource, /scene-frame[^`]*\$\{scenarioTabs\(\)\}\$\{identityRail\(\)\}/s);
  assert.equal(scenarioManifest.baseline.baselineVersion, "1.0.3");
  assert.equal(scenarioManifest.baseline.immutable, true);
});

test("M02 场景视图锁定两个逻辑成员、I\/AA、评估口径和质量边界", () => {
  assert.deepEqual(dataContract.logicalMembers, ["财务数据", "调节因子"]);
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
  for (const copy of ["两个逻辑成员", "评估时点", "币种 / 金额单位", "当前期列", "上期列", "本视图不执行评分、不维护模型参数", "明确不归 M02"]) {
    assert.ok(appSource.includes(copy), `M02 页面缺少 ${copy}`);
  }
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
