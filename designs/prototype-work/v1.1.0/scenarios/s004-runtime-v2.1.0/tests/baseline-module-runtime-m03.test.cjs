"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-runtime.js"), "utf8");
const M03_STATE_KEY = "ontology3.iq.review.conversation.v1";

function notApplicableState() {
  return {
    schemaVersion: 20,
    scenarioApplicability: { status: "NOT_APPLICABLE" },
    activeConfigStatus: "NOT_APPLICABLE",
    activeConfig: { scenarioApplicability: { status: "NOT_APPLICABLE" } },
    liveRuns: [],
    historyRuns: [],
    actionRequests: []
  };
}

function createSandbox({ scenarioId = "S004", moduleId = "M03", contextStatus = "active", state = notApplicableState(), extraRecords = {} } = {}) {
  const documentListeners = {};
  const windowListeners = {};
  const records = new Map();
  if (state) records.set(M03_STATE_KEY, JSON.stringify(state));
  Object.entries(extraRecords).forEach(([key, value]) => records.set(key, JSON.stringify(value)));
  const search = new URLSearchParams({
    moduleId,
    scenarioId,
    scenarioVersion: `${scenarioId}-v2.1.0`,
    scenarioRunId: `${scenarioId}-RUN-20260816000000000-test`,
    formedAt: "2026-08-16T00:00:00.000Z",
    status: contextStatus
  }).toString();
  const href = `http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?${search}`;
  const document = {
    currentScript: { src: "http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-runtime.js" },
    documentElement: { dataset: {} },
    body: {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener(type, listener) { (documentListeners[type] ||= []).push(listener); }
  };
  const sandbox = {
    document,
    location: { href, search: `?${search}`, hash: "" },
    localStorage: {
      getItem(key) { return records.get(String(key)) ?? null; },
      setItem(key, value) { records.set(String(key), String(value)); },
      removeItem(key) { records.delete(String(key)); }
    },
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe() {} },
    URL,
    URLSearchParams,
    setTimeout() { return 0; },
    addEventListener(type, listener) { (windowListeners[type] ||= []).push(listener); },
    __OFW_BASELINE_MODULE_RUNTIME_TEST__: true
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", "MutationObserver", runtimeSource)(sandbox, sandbox, sandbox.MutationObserver);
  return { sandbox, api: sandbox.OFWBaselineModuleRuntimeTestApi, documentListeners, records };
}

function fakeButton(label, { ancestor = null, title = null, blocked = false } = {}) {
  const labelNode = { textContent: label };
  const button = {
    textContent: label,
    dataset: blocked ? { ofwS004M03Blocked: "true" } : {},
    querySelector(selector) { return selector === ".ui-button__label" ? labelNode : null; },
    matches(selector) { return selector === '[title="重置状态"]' && title === "重置状态"; },
    closest(selector) {
      if (selector === "button, [role='button']") return button;
      if (ancestor && selector.includes(ancestor)) return { className: ancestor };
      return null;
    }
  };
  return button;
}

test("M03 仅在 S004 且状态为 NOT_APPLICABLE 时标注场景边界并保留原生交互", () => {
  const s004 = createSandbox();
  assert.equal(s004.api.isM03NotApplicable(), true);
  s004.api.patchM03NotApplicable();
  assert.equal(s004.sandbox.document.documentElement.dataset.ofwS004M03Applicability, "NOT_APPLICABLE");
  assert.equal(s004.sandbox.document.documentElement.dataset.ofwS004M03InteractionMode, "BASELINE_NATIVE_CONTROLS_PRESERVED");

  const s001 = createSandbox({ scenarioId: "S001" });
  assert.equal(s001.api.isM03NotApplicable(), false);
  s001.api.patchM03NotApplicable();
  assert.equal(s001.sandbox.document.documentElement.dataset.ofwS004M03Applicability, "applicable");

  const active = createSandbox({ state: { schemaVersion: 20, scenarioApplicability: { status: "ACTIVE" } } });
  assert.equal(active.api.isM03NotApplicable(), false);
});

test("M03 NOT_APPLICABLE 不拦截 v1.0.3 推荐、问数、验证、重置或导航控件", () => {
  const { api } = createSandbox();
  [
    "刷新推荐", "提交问题", "验证当前配置", "生成候选版本", "运行验证",
    "开始验证", "提交本体管理核对", "发起行动请求", "确认重置"
  ].forEach((label) => assert.equal(api.shouldBlockM03Control(fakeButton(label)), false, label));
  assert.equal(api.shouldBlockM03Control(fakeButton("任意推荐卡", { ancestor: ".recommendation-panel" })), false);
  assert.equal(api.shouldBlockM03Control(fakeButton("提交", { ancestor: "form.composer" })), false);
  assert.equal(api.shouldBlockM03Control(fakeButton("重置", { title: "重置状态" })), false);
  assert.equal(api.shouldBlockM03Control(fakeButton("本场景不适用")), false);
  assert.equal(api.shouldBlockM03Control(fakeButton("本场景不适用", { blocked: true })), false);
  assert.equal(api.shouldBlockM03Control(fakeButton("查看详情")), false);
  assert.equal(api.shouldBlockM03Control(fakeButton("重新读取")), false);
});

test("M03 capture listeners 不阻断 React 原生 click 与 submit", () => {
  const { sandbox, documentListeners } = createSandbox();
  const clickTarget = fakeButton("提交问题");
  const click = { target: clickTarget, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  documentListeners.click[0](click);
  assert.equal(click.prevented, false);
  assert.equal(click.stopped, false);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M03LastBlockedAction, undefined);

  const form = { matches(selector) { return selector === "form.composer, form.follow-composer"; } };
  const submit = { target: form, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  documentListeners.submit[0](submit);
  assert.equal(submit.prevented, false);
  assert.equal(submit.stopped, false);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M03LastNativeSubmit, "submit");
});

test("M03 适配仅标注原生区域，不改写标题、隐藏推荐或禁用原控件", () => {
  assert.match(runtimeSource, /\.ask-hero/);
  assert.match(runtimeSource, /\.recommendation-panel/);
  assert.match(runtimeSource, /\.active-config/);
  assert.match(runtimeSource, /\.candidate-validation-page/);
  assert.match(runtimeSource, /BASELINE_NATIVE_CONTROLS_PRESERVED/);
  assert.doesNotMatch(runtimeSource, /\.recommendation-grid[\s\S]{0,180}hidden = true/);
  assert.doesNotMatch(runtimeSource, /patchM03AskPage\(\)[\s\S]{0,800}disableM03Control/);
  assert.doesNotMatch(runtimeSource, /replaceAll\([^\n]*S001[^\n]*S004/);
});

test("M01 在 M03 不适用时只认可真实报告与 Agent 消费证据，不伪造问数合同", () => {
  const runId = "S004-RUN-20260816000000000-test";
  const extraRecords = {
    "ontology3-c008-authoritative-projection-v1": { current: { semanticVersionId: "SEM-S004", dataVersion: "DA-S004", t019: { evidenceId: "EVID-T019-S004" } } },
    "ontology3.c017.report-center.projection.v1": { projections: [{ scenarioContext: { scenarioRunId: runId }, allowConsumption: true }] },
    "ontology3.agent-application.catalog.v7": { evidencePackages: [{ status: "ready" }] },
    "ontology3.report-center.lifecycle-review.v1": { report: { stage: "published", evidencePackId: "EVID-S004" } }
  };
  const ready = createSandbox({ moduleId: "M01", extraRecords });
  assert.equal(ready.api.scenarioM03NotApplicable(), true);
  assert.equal(ready.api.reportAgentConsumptionReady(), true);

  const incomplete = createSandbox({ moduleId: "M01", extraRecords: { ...extraRecords, "ontology3.agent-application.catalog.v7": { evidencePackages: [] } } });
  assert.equal(incomplete.api.reportAgentConsumptionReady(), false);
  assert.match(runtimeSource, /不生成问数 Run、Result、C009 或兼容性结论/);
  assert.match(runtimeSource, /S004 报告与 Agent 消费链已就绪；M03 保持 NOT_APPLICABLE/);
  assert.doesNotMatch(runtimeSource, /externalConsumerCompatibility[^\n]*智能问数/);
});
