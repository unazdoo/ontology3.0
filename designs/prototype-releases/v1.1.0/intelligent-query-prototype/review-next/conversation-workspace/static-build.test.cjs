"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("../../vendor/babel.min.js");

const sources = ["data.jsx", "components.jsx", "app.jsx"];

function loadPortfolioRuntime() {
  const vm = require("node:vm");
  const context = {
    console,
    structuredClone,
    Date,
    setTimeout,
    clearTimeout,
    Intl,
    URL,
    URLSearchParams,
    location: { origin: "http://127.0.0.1", search: "", hash: "" },
    localStorage: { length: 0, getItem() { return null; }, setItem() {}, removeItem() {}, key() { return null; } }
  };
  context.window = context;
  vm.createContext(context);
  const root = path.resolve(__dirname, "../../..");
  [
    path.join(root, "composite-resource-registry.js"),
    path.join(__dirname, "data.compiled.js"),
    path.join(__dirname, "portfolio-integration.js")
  ].forEach((file) => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file }));
  return context;
}

test("M03 uses synchronous compiled scripts around the portfolio adapter", () => {
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  assert.doesNotMatch(html, /babel\.min\.js|type=["']text\/babel["']/);
  const order = ["data.compiled.js", "portfolio-integration.js", "components.compiled.js", "app.compiled.js"]
    .map((name) => html.indexOf(name));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
});

test("M03 compiled artifacts match their JSX sources", () => {
  sources.forEach((sourceName) => {
    const source = fs.readFileSync(path.join(__dirname, sourceName), "utf8");
    const code = Babel.transform(source, {
      presets: [["react", { runtime: "classic" }]],
      sourceType: "script",
      filename: sourceName,
      comments: false,
      compact: true
    }).code;
    const expected = `(function () {\n${code}\n})();\n`;
    assert.equal(fs.readFileSync(path.join(__dirname, sourceName.replace(/\.jsx$/, ".compiled.js")), "utf8"), expected);
  });
});

test("M03 portfolio keeps semantic resources and query configs traceable", () => {
  const portfolio = fs.readFileSync(path.join(__dirname, "portfolio-integration.js"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "app.jsx"), "utf8");
  assert.match(portfolio, /IQ-AGENT-PLATFORM-FINANCE/);
  ["S002-OBJ-BUDGET-EXECUTION", "S002-RULE-BUDGET-COVERAGE", "S002-ACTION-BUDGET-RECTIFICATION", "S003-OBJ-ENTERPRISE", "S003-RULE-RISK-TIER", "S003-ACTION-SPECIAL-DISPOSAL"].forEach((id) => assert.match(portfolio, new RegExp(id)));
  assert.doesNotMatch(portfolio.slice(0, portfolio.indexOf("const s001LinkContracts")), /S004-(?:OBJ|MET|RULE|ACTION)/);
  assert.match(app, /function PortfolioSemanticPage/);
  assert.match(app, /function PortfolioAgentPage/);
  assert.match(app, /一个助手身份统一理解问题/);
  assert.doesNotMatch(portfolio, /S003-T007-FORMAL-CANDIDATE-20251231-v1/);
});

test("M03 uses one assistant identity with three traceable C009 domain bindings", () => {
  const context = loadPortfolioRuntime();

  const hydrated = context.IQ_PORTFOLIO.hydrateState({
    enabledConfigs: [{ id: "IQ-AGENT-FINANCING", sceneId: "S001", scene: "集团融资成本与债务结构优化", status: "已启用" }]
  });
  assert.deepEqual(
    Array.from(hydrated.enabledConfigs, (config) => config.id),
    ["IQ-AGENT-PLATFORM-FINANCE"]
  );
  assert.equal(context.IQ_PORTFOLIO.platformAgentConfig.domainBindings.length, 3);
  assert.equal(new Set(Object.values(context.IQ_PORTFOLIO.agentConfigs).map((config) => config.id)).size, 1);
  assert.deepEqual(Array.from(context.IQ_PORTFOLIO.platformAgentConfig.domainBindings, (item) => item.scenarioId), ["S001", "S002", "S003"]);
  assert.equal(context.IQ_PORTFOLIO.agentConfigs.S003.bindingVersionId, "T019-S003-v1");
  assert.equal(context.IQ_PORTFOLIO.agentConfigs.S003.semanticVersion, "S003-M01-DEBT-RISK-PKG 1.0.2");
  const s002Context = context.IQ_PORTFOLIO.scenarioContext("S002");
  assert.equal(s002Context.dataVersion, "S002-DATA-v1");
  assert.deepEqual(Array.from(s002Context.componentDataVersions), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.equal(context.IQ_PORTFOLIO.semanticResources["S002-MET-PROJECT-BALANCE"].dataVersion, "S002-PROJECT-OCC-v1");
});

test("M03 derives three exact read-only query contexts from the composite registry", () => {
  const context = loadPortfolioRuntime();
  const expected = {
    S001: { dataVersion: "FIN-ASSET-20251231-v02", components: ["FIN-ASSET-20251231-v02"], pointer: "T019-S001-v1" },
    S002: { dataVersion: "S002-DATA-v1", components: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"], pointer: "T019-S002-v1" },
    S003: { dataVersion: "S003-T007-DEBT-RISK-20251231-v1", components: ["S003-T007-DEBT-RISK-20251231-v1"], pointer: "T019-S003-v1" }
  };
  Object.entries(expected).forEach(([scenarioId, binding]) => {
    const registryScene = context.OFW_COMPOSITE_REGISTRY.scene(scenarioId);
    const runtime = context.IQ_PORTFOLIO.scenarioContext(scenarioId);
    const config = context.IQ_PORTFOLIO.agentConfigs[scenarioId];
    assert.equal(runtime.scenarioId, registryScene.scenarioId);
    assert.equal(runtime.scenarioVersion, registryScene.scenarioVersion);
    assert.equal(runtime.scenarioRunId, registryScene.scenarioRunId);
    assert.equal(runtime.versionId, binding.pointer);
    assert.equal(runtime.t019EvidenceCode, binding.pointer);
    assert.equal(runtime.dataVersion, binding.dataVersion);
    assert.deepEqual(Array.from(runtime.componentDataVersions), binding.components);
    assert.equal(runtime.asOf, registryScene.dataAsOf);
    assert.equal(runtime.allowConsumption, true);
    assert.ok(runtime.resourceContractFingerprint);
    assert.ok(runtime.runtimeContextFingerprint);
    assert.equal(config.bindingVersionId, runtime.versionId);
    assert.equal(config.resourceContractFingerprint, runtime.resourceContractFingerprint);
    assert.equal(config.c009Validation.status, "通过");
    assert.equal(config.c009Validation.sceneRunId, runtime.scenarioRunId);
  });
});

test("M03 uniquely matches, verifies and exports one completed question per queryable scenario", () => {
  const context = loadPortfolioRuntime();
  const cases = [
    ["集团当前融资余额和平均融资成本分别是多少？", "S001", "IQ-AGENT-PLATFORM-FINANCE"],
    ["2025年三个部门的费用预算执行率和剩余空间分别是多少？", "S002", "IQ-AGENT-PLATFORM-FINANCE"],
    ["当前21家企业的债务风险等级怎么分布？", "S003", "IQ-AGENT-PLATFORM-FINANCE"]
  ];
  cases.forEach(([text, scenarioId, configId], index) => {
    const question = context.IQ_PORTFOLIO.matchQuestion(text);
    assert.equal(question.scenarioId, scenarioId);
    const matches = context.IQ_PORTFOLIO.matchAgents(question, Object.values(context.IQ_PORTFOLIO.agentConfigs));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].config.id, configId);
    const runtime = context.IQ_PORTFOLIO.scenarioContext(scenarioId);
    assert.equal(context.IQ_PORTFOLIO.validateQuestion(question, matches[0].config, runtime).passed, true);
    const runId = `TEST-${scenarioId}-${index + 1}`;
    const result = context.IQ_PORTFOLIO.materialize(question.templateId, runtime, runId, { unitCodes: context.IQDomain.referencedUnitCodes(text), originalQuestion: text });
    assert.ok(result);
    assert.equal(context.IQ_PORTFOLIO.verifyResult(result, runtime, matches[0].config, question).passed, true);
    const run = { sourcePortfolioRecord: true, status: "成功", question: text, finalQuestion: text, context: runtime, configSnapshot: matches[0].config, result };
    const csv = context.IQDomain.csvEligibility(run);
    assert.equal(csv.allowed, true);
    assert.equal(csv.reason, "");
    assert.ok(result.evidenceIds.length >= result.rows.length);
    assert.equal(result.contextIdentity.scenarioRunId, runtime.scenarioRunId);
    assert.equal(result.contextIdentity.dataVersion, runtime.dataVersion);
  });
});

test("M03 recommendation tabs are curated, answerable and exclude report copilot", () => {
  const context = loadPortfolioRuntime();
  const recommendations = Array.from(context.IQ_PORTFOLIO.recommendations);
  const counts = recommendations.reduce((result, item) => ({ ...result, [item.category]: (result[item.category] || 0) + 1 }), {});
  assert.deepEqual(Object.keys(counts).sort(), ["债务风险", "融资成本", "融资管理"].sort());
  assert.ok(counts["融资成本"] >= 10);
  assert.ok(counts["债务风险"] >= 10);
  assert.ok(counts["融资管理"] >= 10);
  assert.doesNotMatch(JSON.stringify(recommendations), /报告伴读|S004/);
  assert.equal(context.IQ_PORTFOLIO.scenarioContext("S004"), null);
  assert.equal(Object.keys(context.IQ_PORTFOLIO.templates).some((id) => id.startsWith("portfolio-s004-")), false);
  assert.equal(Object.values(context.IQ_PORTFOLIO.semanticResources).some((item) => item.scenarioId === "S004"), false);
  recommendations.forEach((question, index) => {
    const runtime = context.IQ_PORTFOLIO.scenarioContext(question.scenarioId);
    const matches = context.IQ_PORTFOLIO.matchAgents(question, []);
    assert.equal(matches.length, 1, question.question);
    assert.equal(context.IQ_PORTFOLIO.validateQuestion(question, matches[0].config, runtime).passed, true, question.question);
    const result = context.IQ_PORTFOLIO.materialize(question.templateId, runtime, `CURATED-${index + 1}`, { unitCodes: context.IQDomain.referencedUnitCodes(question.question), originalQuestion: question.question });
    assert.ok(result?.summary && result?.rows?.length, question.question);
    assert.equal(context.IQ_PORTFOLIO.verifyResult(result, runtime, matches[0].config, question).passed, true, question.question);
  });
});

test("M03 rejects scene, data, whitelist and evidence drift instead of bypassing gates", () => {
  const context = loadPortfolioRuntime();
  const text = "2025年各部门费用预算执行率和差异额分别是多少？";
  const question = context.IQ_PORTFOLIO.matchQuestion(text);
  const runtime = context.IQ_PORTFOLIO.scenarioContext("S002");
  const config = context.IQ_PORTFOLIO.agentConfigs.S002;
  const changedScene = structuredClone(runtime);
  changedScene.scenarioRunId = "S002-RUN-MISMATCH";
  assert.equal(context.IQ_PORTFOLIO.validateQuestion(question, config, changedScene).passed, false);
  const changedData = structuredClone(runtime);
  changedData.dataVersion = "S002-DATA-LATEST";
  assert.equal(context.IQ_PORTFOLIO.validateQuestion(question, config, changedData).passed, false);
  const changedWhitelist = structuredClone(config);
  changedWhitelist.allowedResources = changedWhitelist.allowedResources.filter((id) => id !== "S002-MET-BUDGET-EXECUTION-RATE");
  assert.equal(context.IQ_PORTFOLIO.validateQuestion(question, changedWhitelist, runtime).passed, false);
  const result = context.IQ_PORTFOLIO.materialize(question.templateId, runtime, "TEST-S002-TAMPER");
  result.rows[0].evidenceId = null;
  const run = { sourcePortfolioRecord: true, status: "成功", question: text, finalQuestion: text, context: runtime, configSnapshot: config, result };
  assert.equal(context.IQDomain.csvEligibility(run).allowed, false);
});

test("M03 migrates historical answer copy to business language", () => {
  const context = loadPortfolioRuntime();
  const hydrated = context.IQ_PORTFOLIO.hydrateState({
    enabledConfigs: [],
    liveRuns: [],
    historyRuns: [{ id: "OLD", result: { title: "Published 结果", summary: "来自 C035 Published 结果", rows: [{ detail: "C035 Published" }] } }]
  });
  const text = JSON.stringify(hydrated.historyRuns.find((run) => run.id === "OLD").result);
  assert.doesNotMatch(text, /Published|C035/i);
  assert.match(text, /已发布|正式评估结果/);
});
