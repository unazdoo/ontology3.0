"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-runtime.js"), "utf8");
const M05_STATE_KEY = "ontology3.agent-application.catalog.v7";
const M06_STATE_KEY = "ontology3.report-center.lifecycle-review.v1";
const C022_INBOX_KEY = "ontology3.agent-application.c022-inbox.v1";
const C008_STATE_KEY = "ontology3-c008-authoritative-projection-v1";
const C017_REPORT_KEY = "ontology3.c017.report-center.projection.v1";

function readOnlyState() {
  return {
    schemaVersion: 23,
    scenarioAccess: { mode: "READ_ONLY_EXISTING_ARTIFACTS" },
    evidencePackages: [],
    runs: [],
    sessions: []
  };
}

function createSandbox({ scenarioId = "S004", moduleId = "M05", state = readOnlyState(), querySelectorAll, querySelector, extraRecords = {}, parentRelay = null } = {}) {
  const documentListeners = {};
  const windowListeners = {};
  const records = new Map();
  if (state) records.set(M05_STATE_KEY, JSON.stringify(state));
  Object.entries(extraRecords).forEach(([key, value]) => records.set(key, JSON.stringify(value)));
  const search = new URLSearchParams({
    moduleId,
    scenarioId,
    scenarioVersion: `${scenarioId}-v2.1.0`,
    scenarioRunId: `${scenarioId}-RUN-20260816000000000-m05test`,
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  }).toString();
  const href = `http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-loader.html?${search}`;
  const document = {
    currentScript: { src: "http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-runtime.js" },
    documentElement: { dataset: {} },
    body: {},
    querySelector(selector) { return querySelector?.(selector) || null; },
    querySelectorAll(selector) { return querySelectorAll?.(selector) || []; },
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
  sandbox.parent = parentRelay ? { OFW_S004_RUNTIME_RELAY: parentRelay } : sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  new Function("window", "globalThis", "MutationObserver", runtimeSource)(sandbox, sandbox, sandbox.MutationObserver);
  return { sandbox, api: sandbox.OFWBaselineModuleRuntimeTestApi, documentListeners, records };
}

test("S004 运行层通过场景外壳转交 C022 与 M05 Owner 状态且不改变合同标识", () => {
  const published = [];
  const c022 = {
    contractCode: "C022",
    scenarioContext: {
      scenarioId: "S004",
      scenarioVersion: "S004-v2.1.0",
      scenarioRunId: "S004-RUN-20260816000000000-m05test",
      formedAt: "2026-08-16T00:00:00.000Z",
      status: "active"
    },
    requests: [{ requestId: "RGEN-S004-001" }]
  };
  const relay = {
    publish(record) { published.push(JSON.parse(JSON.stringify(record))); return true; },
    read({ kind }) { return kind === "C022" ? JSON.parse(JSON.stringify(c022)) : null; }
  };
  const m06 = createSandbox({ moduleId: "M06", state: null, extraRecords: { [C022_INBOX_KEY]: c022 }, parentRelay: relay });
  assert.equal(m06.api.publishS004RuntimeRelay("C022", C022_INBOX_KEY), true);
  assert.equal(published[0].kind, "C022");
  assert.equal(published[0].payload.contractCode, "C022");
  assert.equal(published[0].payload.requests[0].requestId, "RGEN-S004-001");

  const m05 = createSandbox({ parentRelay: relay });
  assert.equal(m05.api.consumeS004RuntimeRelay("C022", C022_INBOX_KEY), true);
  assert.deepEqual(JSON.parse(m05.records.get(C022_INBOX_KEY)), c022);
  assert.equal(m05.sandbox.document.documentElement.dataset.ofwS004RuntimeRelayConsume, "C022:ok");
});

test("M06 往返 M05 时通过同轮外壳中继保留新内容版本聚合", () => {
  const scenarioContext = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-m05test",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const activeM06 = {
    scenarioContext,
    report: {
      scenarioContext,
      aggregateId: "RAG-S004-RELAY-001",
      requestId: "RGEN-S004-RELAY-001",
      stage: "generating",
      evidencePackId: "EP-S004-RELAY-001",
      evidencePacks: [{ id: "EP-S004-RELAY-001" }]
    },
    publishedReports: []
  };
  const published = [];
  const relay = {
    publish(record) { published.push(JSON.parse(JSON.stringify(record))); return true; },
    read({ kind }) { return kind === "M06_RUNTIME_STATE" ? JSON.parse(JSON.stringify(activeM06)) : null; }
  };
  const m06 = createSandbox({ moduleId: "M06", state: null, parentRelay: relay });
  assert.deepEqual(JSON.parse(m06.records.get(M06_STATE_KEY)), activeM06);
  assert.equal(m06.sandbox.document.documentElement.dataset.ofwS004RuntimeRelayConsume, "M06_RUNTIME_STATE:ok");
  assert.equal(m06.api.publishS004RuntimeRelay("M06_RUNTIME_STATE", M06_STATE_KEY), true);
  assert.equal(published.at(-1).payload.report.requestId, "RGEN-S004-RELAY-001");
});

test("M05 每次 Owner 状态落盘后立即同步最新 C023 Run/Result", () => {
  assert.match(runtimeSource, /publishS004RuntimeRelayPayload\("M05_RUNTIME_STATE", relayPayload\)/);
  assert.match(runtimeSource, /publishS004RuntimeRelayPayload\("M06_RUNTIME_STATE", relayPayload\)/);
});

test("M05/M06 中继在大状态物理写入前先保留同轮运行态", () => {
  const m05Block = runtimeSource.match(/function installM05GenerationStorageProjection\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  const m06Block = runtimeSource.match(/function installM06GenerationStorageProjection\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.ok(m05Block.indexOf('publishS004RuntimeRelayPayload("M05_RUNTIME_STATE", relayPayload)')
    < m05Block.indexOf("previous.call(this, key, projectedValue)"));
  assert.ok(m06Block.indexOf('publishS004RuntimeRelayPayload("M06_RUNTIME_STATE", relayPayload)')
    < m06Block.indexOf("previous.call(this, key, projectedValue)"));
});

test("M05 模块重开时预热发布当前 Owner 完成态", () => {
  const published = [];
  const relay = {
    publish(record) { published.push(JSON.parse(JSON.stringify(record))); return true; },
    read() { return null; }
  };
  const state = {
    ...readOnlyState(),
    scenarioAccess: { mode: "APPEND_NEW_RUNS_PRESERVE_HISTORY" },
    currentScenarioContext: {
      scenarioId: "S004",
      scenarioVersion: "S004-v2.1.0",
      scenarioRunId: "S004-RUN-20260816000000000-m05test",
      formedAt: "2026-08-16T00:00:00.000Z",
      status: "active"
    },
    runs: [{ id: "RUN-S004-C023-001", status: "complete" }]
  };
  const created = createSandbox({ state, parentRelay: relay });
  const prewarm = published.find((record) => record.kind === "M05_RUNTIME_STATE");
  assert.ok(prewarm);
  assert.equal(prewarm.payload.runs[0].id, "RUN-S004-C023-001");
  assert.equal(created.sandbox.document.documentElement.dataset.ofwS004M05RelayPrewarm, "current-owner-state-published");
});

test("M05 模块重开先恢复同轮运行态再继续原生状态机", () => {
  const active = {
    ...readOnlyState(),
    scenarioAccess: { mode: "APPEND_NEW_RUNS_PRESERVE_HISTORY" },
    currentScenarioContext: {
      scenarioId: "S004",
      scenarioVersion: "S004-v2.1.0",
      scenarioRunId: "S004-RUN-20260816000000000-m05test",
      formedAt: "2026-08-16T00:00:00.000Z",
      status: "active"
    },
    runs: [{ id: "RUN-S004-C023-RESUME", requestId: "RGEN-S004-RESUME", status: "running" }]
  };
  const published = [];
  const relay = {
    publish(record) { published.push(JSON.parse(JSON.stringify(record))); return true; },
    read({ kind }) { return kind === "M05_RUNTIME_STATE" ? JSON.parse(JSON.stringify(active)) : null; }
  };
  const created = createSandbox({ state: readOnlyState(), parentRelay: relay });
  const restored = JSON.parse(created.records.get(M05_STATE_KEY));
  assert.equal(restored.runs[0].id, "RUN-S004-C023-RESUME");
  assert.equal(restored.runs[0].status, "running");
  assert.equal(restored.currentScenarioContext.scenarioId, active.currentScenarioContext.scenarioId);
  assert.equal(restored.currentScenarioContext.scenarioVersion, active.currentScenarioContext.scenarioVersion);
  assert.equal(restored.currentScenarioContext.scenarioRunId, active.currentScenarioContext.scenarioRunId);
  assert.equal(restored.currentScenarioContext.scenarioLabel, "财务公司贷款贷前调查");
  assert.equal(created.sandbox.document.documentElement.dataset.ofwS004RuntimeRelayConsume, "M05_RUNTIME_STATE:ok");
  assert.equal(published.at(-1).payload.runs[0].id, "RUN-S004-C023-RESUME");
});

test("M05 实际开始生成后持续发布完成态供 M06 回读", () => {
  assert.match(runtimeSource, /\["接收请求", "开始生成报告草稿", "开始生成", "重新运行", "重试原快照", "创建替代运行"\]/);
  assert.match(runtimeSource, /scheduleS004RuntimeRelay\("M05_RUNTIME_STATE", M05_STATE_KEY, \[80, 500, 1200, 2200, 3600, 5200, 6500\]\)/);
  assert.match(runtimeSource, /normalizeS004M05StoredState\(\);\s*m05RuntimeCache = null;\s*patchM05GenerationArtifactCopy\(\);/);
});

function fakeButton(label) {
  const attributes = new Map();
  const button = {
    textContent: label,
    dataset: {},
    disabled: false,
    setAttribute(name, value) { attributes.set(name, value); },
    closest(selector) { return selector === "button, [role='button']" ? button : null; }
  };
  return { button, attributes };
}

test("M05 在 S004 运行时只保留当前场景静态证据，S001 默认目录不被改写", () => {
  const s004 = createSandbox();
  const baselineInitial = {
    evidencePackages: [
      { id: "finance-2026-07-31", kind: "finance" },
      { id: "s004-static", scenarioContext: { scenarioId: "S004" } }
    ]
  };
  s004.sandbox.AGENT_APP_INITIAL_STATE = baselineInitial;
  assert.deepEqual(baselineInitial.evidencePackages.map((item) => item.id), ["s004-static"]);
  assert.equal(baselineInitial.scenarioEvidenceIsolation.mode, "S004_ONLY");
  assert.equal(baselineInitial.scenarioEvidenceIsolation.filteredCount, 1);

  const s001 = createSandbox({ scenarioId: "S001", state: null });
  const s001Initial = { evidencePackages: [{ id: "finance-2026-07-31", kind: "finance" }] };
  assert.equal(s001.api.m05InitialEvidenceFilter(s001Initial), s001Initial);
  assert.deepEqual(s001Initial.evidencePackages.map((item) => item.id), ["finance-2026-07-31"]);
});

test("M05 当前 C022/C023 仅校正精确基线默认文案并保留历史与用户自定义标题", () => {
  const scenarioContext = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    scenarioRunId: "S004-RUN-20260816000000000-m05test",
    formedAt: "2026-08-16T00:00:00.000Z",
    status: "active"
  };
  const currentRequest = {
    id: "RGEN-20260816-001",
    type: "report-draft",
    title: "融资经营分析报告生成",
    currentProjection: true,
    scenarioContext,
    requestContext: { ...scenarioContext, scenarioLabel: "S004 · 集团融资成本与债务结构优化" },
    c022: { reportContext: { ...scenarioContext, scenarioLabel: "S004 · 财务公司贷款贷前调查" } }
  };
  const currentRun = {
    id: "RUN-20260816-001",
    currentProjection: true,
    scenarioContext,
    snapshot: {
      agentId: "report-draft",
      scenarioId: "S004",
      scenarioVersion: "S004-v2.1.0",
      scenarioRunId: "S004-RUN-20260816000000000-m05test",
      scenario: "S004 · 集团融资成本与债务结构优化",
      requestContext: { ...scenarioContext, scenarioLabel: "S001 · 集团融资成本与债务结构优化" }
    },
    result: { id: "RES-20260816-001", type: "Agent Report Draft", title: "融资经营分析报告结构化源草稿" }
  };
  const historical = {
    ...currentRequest,
    id: "RGEN-HISTORY",
    currentProjection: false,
    title: "融资经营分析报告生成"
  };
  const custom = {
    ...currentRequest,
    id: "RGEN-CUSTOM",
    title: "调查岗定制贷前报告生成"
  };
  const { api } = createSandbox({ state: { ...readOnlyState(), inboundRequests: [], runs: [], sessions: [] } });
  const projected = api.normalizeS004M05RuntimeProjection({
    currentScenarioContext: { ...scenarioContext, scenarioLabel: "S001 · 集团融资成本与债务结构优化" },
    evidencePackages: [{
      id: "EVID-CURRENT-C022",
      kind: "report-generation",
      currentProjection: true,
      scenarioContext: { ...scenarioContext, scenarioRunId: "S004-RUN-HISTORICAL" },
      requestContext: { ...scenarioContext, scenarioLabel: "S004 · 集团融资成本与债务结构优化" }
    }],
    inboundRequests: [currentRequest, historical, custom],
    runs: [currentRun],
    sessions: []
  });
  assert.equal(projected.currentScenarioContext.scenarioLabel, "财务公司贷款贷前调查");
  assert.equal(projected.evidencePackages[0].requestContext.scenarioLabel, "财务公司贷款贷前调查");
  assert.equal(projected.inboundRequests[0].title, "S004 贷前调查报告生成");
  assert.equal(projected.inboundRequests[0].requestContext.scenarioLabel, "财务公司贷款贷前调查");
  assert.equal(projected.inboundRequests[0].c022.reportContext.scenarioLabel, "S004 · 财务公司贷款贷前调查");
  assert.equal(projected.runs[0].snapshot.scenario, "财务公司贷款贷前调查");
  assert.equal(projected.runs[0].snapshot.requestContext.scenarioLabel, "财务公司贷款贷前调查");
  assert.equal(projected.runs[0].result.title, "S004 贷前调查报告结构化源草稿");
  assert.equal(projected.inboundRequests[1].title, "融资经营分析报告生成");
  assert.equal(projected.inboundRequests[2].title, "调查岗定制贷前报告生成");
});

test("M05 历史 S004 证据仅在展示层校正精确基线场景文案，不改写证据合同", () => {
  const valueNode = { textContent: "S004 · S004 · 集团融资成本与债务结构优化", dataset: {} };
  const evidencePage = {
    textContent: "RDEF-S004-PREFLIGHT-002 报告生成固定证据 S004 · S004 · 集团融资成本与债务结构优化",
    dataset: {},
    matches(selector) { return selector === ".page[data-screen-label='证据包详情']"; },
    querySelectorAll() { return [valueNode]; }
  };
  const { api } = createSandbox({
    state: { ...readOnlyState(), inboundRequests: [], runs: [], sessions: [] },
    querySelectorAll(selector) {
      return selector.includes("data-screen-label='证据包详情'") ? [evidencePage] : [];
    }
  });
  api.patchM05GenerationArtifactCopy();
  assert.equal(valueNode.textContent, "S004 · 财务公司贷款贷前调查");
  assert.equal(valueNode.dataset.ofwS004GenerationCopy, "scenario-normalized");
  assert.equal(evidencePage.dataset.ofwS004GenerationArtifact, "current-s004");
});

test("M05 当前 C022 用途门允许时不再同时展示不可用原因，证据目录保持受控排布", () => {
  const noticeClasses = new Set(["notice", "danger"]);
  const titleNode = { textContent: "当前固定证据与闭环可用于形成新的草稿、运行和核验记录" };
  const messageNode = { textContent: "当前摘要未提供该用途的 Agent 门禁判断输入。" };
  const notice = {
    textContent: `${titleNode.textContent}${messageNode.textContent}`,
    classList: {
      contains(value) { return noticeClasses.has(value); },
      add(...values) { values.forEach((value) => noticeClasses.add(value)); },
      remove(...values) { values.forEach((value) => noticeClasses.delete(value)); }
    },
    dataset: {},
    querySelector(selector) { return selector === "strong" ? titleNode : selector === "span" ? messageNode : null; }
  };
  const page = {
    children: [notice],
    dataset: {},
    querySelector(selector) {
      if (selector === ".page-header h1") return { textContent: "RDEF-S004-PREFLIGHT-002 报告生成固定证据" };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "article") return [{ textContent: "报告草稿生成与移交 允许" }];
      return [];
    }
  };
  const state = { ...readOnlyState(), scenarioAccess: { mode: "APPEND_NEW_RUNS_PRESERVE_HISTORY" } };
  const { api } = createSandbox({
    state,
    querySelector(selector) { return selector === '.page[data-screen-label="证据包详情"]' ? page : null; }
  });
  api.patchM05EvidenceClosedLoop();
  assert.equal(titleNode.textContent, "当前固定证据可用于新的 Agent 草稿运行");
  assert.match(messageNode.textContent, /用途门为允许/);
  assert.equal(noticeClasses.has("success"), true);
  assert.equal(noticeClasses.has("danger"), false);
  assert.equal(page.dataset.ofwS004M05EvidenceDetail, "active-evidence-append");
  assert.equal(notice.dataset.ofwS004ClosedLoopNotice, "active-evidence-append");
});

test("M05 只读门禁阻断新增、运行和版本变更入口，但保留查看导航", () => {
  const { api } = createSandbox();
  ["基于此版本创建新草稿", "停用", "重新启用", "接收生成请求", "接收伴读请求", "读取报告交接", "退回结果", "确认可作参考", "发起运行", "开始生成", "创建编排", "验证配置", "保存草稿", "启用 Release", "试运行草稿", "提交申请"].forEach((label) => {
    assert.equal(api.shouldBlockM05Control(fakeButton(label).button), true, label);
  });
  ["查看详情", "查看报告请求", "查看结果", "重新读取状态", "关闭", "取消"].forEach((label) => {
    assert.equal(api.shouldBlockM05Control(fakeButton(label).button), false, label);
  });
});

test("M05 capture listener 在 React 前阻断副作用并记录动作", () => {
  const { sandbox, documentListeners } = createSandbox();
  const { button } = fakeButton("发起运行");
  const event = {
    target: button,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  documentListeners.click.forEach((listener) => listener(event));
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(button.disabled, true);
  assert.equal(button.dataset.ofwS004M05Blocked, "true");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M05LastBlockedAction, "发起运行");
});

test("M05 伴读完成卡片使用 Run、Result、Session 语义，不再声称形成源草稿", () => {
  const message = { textContent: "已形成独立 Run、Result 与源草稿，可从运行记录查看。" };
  const notice = { querySelector(selector) { return selector === "div > span" ? message : null; } };
  const card = {
    textContent: "S004 贷前调查报告伴读 请求已完成",
    dataset: {},
    querySelector(selector) { return selector === ".notice" ? notice : null; }
  };
  const sandbox = createSandbox({ querySelectorAll(selector) { return selector === ".request-card" ? [card] : []; } });
  sandbox.api.patchM05ReadOnly();
  assert.match(message.textContent, /Run、Result 与伴读 Session/);
  assert.doesNotMatch(message.textContent, /源草稿/);
  assert.equal(card.dataset.ofwS004CompanionReadonly, "true");
});

test("M05 报告问答请求也使用伴读 Session 语义", () => {
  const message = { textContent: "已形成独立 Run、Result 与源草稿，可从运行记录查看。" };
  const notice = { querySelector(selector) { return selector === "div > span" ? message : null; } };
  const card = {
    textContent: "S004 报告问答 · 偿债能力 请求已完成",
    dataset: {},
    querySelector(selector) { return selector === ".notice" ? notice : null; }
  };
  const state = { ...readOnlyState(), scenarioAccess: { mode: "APPEND_NEW_RUNS_PRESERVE_HISTORY" } };
  const sandbox = createSandbox({ state, querySelectorAll(selector) { return selector === ".request-card" ? [card] : []; } });
  sandbox.api.patchM05ReadOnly();
  assert.match(message.textContent, /伴读 Session/);
  assert.doesNotMatch(message.textContent, /源草稿/);
  assert.equal(card.dataset.ofwS004CompanionReadonly, "false");
});

test("M05 Agent 保持已启用状态且不在业务卡片追加场景技术说明", () => {
  const classes = new Set(["neutral"]);
  const badge = {
    textContent: "仅查看既有制品",
    innerHTML: "仅查看既有制品",
    classList: {
      add(...values) { values.forEach((value) => classes.add(value)); },
      remove(...values) { values.forEach((value) => classes.delete(value)); }
    }
  };
  const title = { textContent: "S004 贷前调查报告 Agent" };
  const card = {
    textContent: "S004 贷前调查报告 Agent",
    dataset: {},
    querySelector(selector) {
      if (selector === ".agent-card-head h2") return title;
      if (selector === ".agent-card-head .badge" || selector === ".badge") return badge;
      return null;
    }
  };
  const sandbox = createSandbox({ querySelectorAll(selector) { return selector === ".agent-card" ? [card] : []; } });
  sandbox.api.patchM05AgentPresentation();
  assert.match(badge.innerHTML, /已启用/);
  assert.equal(classes.has("success"), true);
  assert.equal(classes.has("neutral"), false);
  assert.equal(card.dataset.ofwS004AgentState, "enabled");
});

test("M05 仅在数据、Published、证据、Agent、核验、人工复核、发布和伴读全部可定位时确认闭环", () => {
  const state = {
    ...readOnlyState(),
    evidencePackages: [{ kind: "report-generation", status: "ready", evidencePackageId: "EVID-S004", items: [{ id: "F-1" }] }],
    runs: [
      { id: "RUN-DRAFT", status: "complete", result: { id: "RESULT-DRAFT", type: "Agent Report Draft" }, snapshot: { evidencePackageId: "EVID-S004" } },
      { id: "RUN-COPILOT", status: "complete", result: { id: "RESULT-COPILOT", type: "Report Copilot Result" } }
    ],
    sessions: [{ id: "SESSION-COPILOT", latestRunId: "RUN-COPILOT", latestResultId: "RESULT-COPILOT" }]
  };
  const extraRecords = {
    [C008_STATE_KEY]: { current: { semanticVersionId: "SEM-S004", semanticVersion: "2.0.0", dataVersion: "DATA-S004", t019: { evidenceId: "T019-S004" } } },
    [C017_REPORT_KEY]: { projections: [{ scenarioContext: { scenarioRunId: "S004-RUN-20260816000000000-m05test" }, allowConsumption: true, dataVersion: "DATA-S004", currentStateSummary: { hardQualityFailure: false } }] },
    [M06_STATE_KEY]: {
      report: {
        reportNo: "S004-PLR-2026-0001",
        contentVersion: "2.0.0",
        stage: "published",
        contentSnapshot: { contentFacts: [{ id: "F-1" }] },
        verificationRuns: [{ runId: "VERIFY-S004", status: "completed", coverage: { status: "complete" } }],
        humanReview: { status: "confirmed", confirmationId: "HCONF-S004" },
        artifactManifest: { html: { output: { file: "report.html" } }, pdf: { output: { file: "report.pdf" } } }
      }
    }
  };
  const sandbox = createSandbox({ state, extraRecords });
  const summary = sandbox.api.m05ClosedLoopStatus();
  assert.equal(summary.complete, true);
  assert.equal(summary.steps.length, 8);
  assert.deepEqual(summary.steps.map((step) => step.complete), Array(8).fill(true));

  extraRecords[M06_STATE_KEY].report.humanReview.status = "pending";
  const incomplete = createSandbox({ state, extraRecords }).api.m05ClosedLoopStatus();
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.steps.find((step) => step.id === "review").complete, false);
});

test("M05 适配只修改 v1.1.0 运行层，不复制或改写冻结 Agent 应用源码", () => {
  assert.match(runtimeSource, /READ_ONLY_EXISTING_ARTIFACTS/);
  assert.match(runtimeSource, /scenarioEvidenceIsolation/);
  assert.match(runtimeSource, /Run、Result 与伴读 Session/);
  assert.match(runtimeSource, /S004 闭环已完成 · 当前轮次可继续运行/);
  assert.match(runtimeSource, /当前 Release 已启用，可发起新的报告草稿运行/);
  assert.match(runtimeSource, /baseline-detail-structure/);
  assert.match(runtimeSource, /财务公司贷款贷前调查报告生成/);
  assert.match(runtimeSource, /当前版本的输入、输出与资源范围/);
  assert.match(runtimeSource, /由报告生成运行绑定借款人、贷款申请和证据包/);
  assert.doesNotMatch(runtimeSource, /场景运行参数与跨借款人复用/);
  assert.doesNotMatch(runtimeSource, /更换借款人不会改写本 Agent 或历史报告/);
  assert.match(runtimeSource, /APPEND_NEW_RUNS_PRESERVE_HISTORY/);
  assert.doesNotMatch(runtimeSource, /replaceAll\([^\n]*S001[^\n]*S004/);
});

test("M05 APPEND_NEW_RUNS_PRESERVE_HISTORY 不阻断当前轮次运行并保留历史不可变语义", () => {
  const state = {
    ...readOnlyState(),
    scenarioAccess: { mode: "APPEND_NEW_RUNS_PRESERVE_HISTORY" }
  };
  const { api, sandbox } = createSandbox({ state });
  assert.equal(api.m05ScenarioReadOnly(), false);
  assert.equal(api.shouldBlockM05Control(fakeButton("发起运行").button), false);
  assert.equal(api.shouldBlockM05Control(fakeButton("接收伴读请求").button), false);
  api.patchM05ReadOnly();
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M05Access, "APPEND_NEW_RUNS_PRESERVE_HISTORY");
  assert.match(runtimeSource, /从报告请求发起/);
  assert.match(runtimeSource, /redirected-to-report-request/);
  assert.match(runtimeSource, /moduleFragment: "#\/reports\/generate"/);
});
