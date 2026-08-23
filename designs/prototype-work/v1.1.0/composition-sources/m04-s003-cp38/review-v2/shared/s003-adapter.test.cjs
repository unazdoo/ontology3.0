const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = __dirname;
const foundationSource = fs.readFileSync(path.join(root, "../../../foundation/ofw-scenario-foundation.js"), "utf8");
const adapterSource = fs.readFileSync(path.join(root, "s003-adapter.jsx"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.jsx"), "utf8");
const appCssSource = fs.readFileSync(path.join(root, "app.css"), "utf8");
const dataSource = fs.readFileSync(path.join(root, "data.jsx"), "utf8");
const scenarioDataSource = fs.readFileSync(path.join(root, "../../../scenarios/s003/data.js"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "../../../scenarios/s003/scripts/build-risk-action-routing-v2.cjs"), "utf8");
const decisionInbox = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m04/decision-inbox.v3.json"), "utf8"));
const decisionBinding = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m04/decision-binding.v2.json"), "utf8"));
const decisionRuntime = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m04/decision-runtime.v2.json"), "utf8"));
const decisionResults = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m04/decision-results.v3.json"), "utf8"));
const enterpriseRouting = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m04/enterprise-contact-routing.v1.json"), "utf8"));
const c017Projection = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m02/c017-decision-projection.v2.json"), "utf8"));
const c035Results = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m01/c035-risk-results.v2.json"), "utf8"));
const publishedPointer = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m01/published-pointer.v2.json"), "utf8"));
const actionTypeCatalog = JSON.parse(fs.readFileSync(path.join(root, "../../../scenarios/s003/resources/m01/action-type-catalog.v2.json"), "utf8"));

function resourceSha(relativePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relativePath))).digest("hex");
}

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

function toHostJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAdapter(search = "") {
  const sandbox = {
    location: { search },
    URLSearchParams,
    fetch: async () => { throw new Error("resource fetch is not used by persistence tests"); },
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(foundationSource, sandbox, { filename: "ofw-scenario-foundation.js" });
  vm.runInContext(adapterSource, sandbox, { filename: "s003-adapter.jsx" });
  return sandbox.S003DecisionAdapter;
}

function createRuntimeAdapter(search = "", resourceMutator = null) {
  const messages = [];
  const parent = { postMessage(message, origin) { messages.push({message, origin}); } };
  const sandbox = {
    location: { search, origin: "http://127.0.0.1:4333" },
    URLSearchParams,
    fetch: async (url) => {
      const filePath = path.resolve(root, "..", String(url));
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return {
        ok: true,
        status: 200,
        async json() { return resourceMutator ? resourceMutator(String(url), payload) : payload; }
      };
    },
    parent,
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(foundationSource, sandbox, { filename: "ofw-scenario-foundation.js" });
  vm.runInContext(adapterSource, sandbox, { filename: "s003-adapter.jsx" });
  return {adapter: sandbox.S003DecisionAdapter, messages};
}

function createStandaloneRuntimeAdapter(search = "") {
  const navigations = [];
  const location = {
    search,
    origin: "http://127.0.0.1:4333",
    href: `http://127.0.0.1:4333/decision-center-prototype/review-v2/action-portfolio.html${search}`,
    assign(href) { navigations.push(href); this.href = href; }
  };
  const sandbox = {
    location,
    URLSearchParams,
    fetch: async (url) => {
      const filePath = path.resolve(root, "..", String(url));
      return { ok: true, status: 200, async json() { return JSON.parse(fs.readFileSync(filePath, "utf8")); } };
    },
    console,
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(foundationSource, sandbox, { filename: "ofw-scenario-foundation.js" });
  vm.runInContext(adapterSource, sandbox, { filename: "s003-adapter.jsx" });
  return {adapter: sandbox.S003DecisionAdapter, navigations};
}

function createAppContractLogic() {
  const stop = appSource.indexOf("function DecisionRail");
  const presentationAdapter = createAdapter("?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=S003-RUN-20260817163000000-c02200000001&scenarioStatus=active");
  const sandbox = {
    React: { useCallback() {}, useEffect() {}, useMemo() {}, useState() {} },
    window: { DC_VARIANT: "portfolio", S003DecisionAdapter: presentationAdapter },
    SOURCE_META: { report: { label: "报告中心仪表盘" } },
    S001_DATA_STRUCTURE: {},
    normalizedScenarioContext(value = {}) { return { ...value }; },
    scenarioContextReady(value) { return Boolean(value?.scenarioId && value?.scenarioVersion && value?.scenarioRunId && value?.status === "active"); },
    decisionContextReadOnly(value) { return value?.status !== "active"; },
    formatNow() { return "2026-08-17 17:20:00"; },
    dateOnly() { return "2026-08-17"; },
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${appSource.slice(0, stop)}\n;globalThis.__contractLogic = { validateC011Payload, normalizeReceivedRequest, mergeS003ActiveRequestPresentation, c011ContractFingerprint, requestCanDecide, buildTaskFromDecision };`, sandbox, { filename: "app-contract-logic.jsx" });
  return sandbox.__contractLogic;
}

const RUN_A = {
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
  formedAt: "2026-08-17T16:30:00.000Z",
  status: "active",
  source: "test-only-extra-field",
};
const RUN_B = {
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260816090000000-aaaaaaaaaaaa",
  formedAt: "2026-08-16T09:00:00.000Z",
  status: "active",
};

test("M04 state and view records are physically isolated by scenarioRunId", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  adapter.writeRecord(RUN_A, "state", { marker: "run-a" }, storage);
  adapter.writeRecord(RUN_B, "state", { marker: "run-b" }, storage);
  adapter.writeRecord(RUN_A, "view", { route: "task/a" }, storage);

  assert.notEqual(adapter.physicalKey(RUN_A, "state"), adapter.physicalKey(RUN_B, "state"));
  assert.match(adapter.physicalKey(RUN_A, "state"), /:S003-v1:S003-RUN-20260817163000000-c02200000001:m04:/);
  assert.deepEqual(toHostJson(adapter.readRecord(RUN_A, "state", storage)), { marker: "run-a" });
  assert.deepEqual(toHostJson(adapter.readRecord(RUN_B, "state", storage)), { marker: "run-b" });
  assert.deepEqual(toHostJson(adapter.readRecord(RUN_A, "view", storage)), { route: "task/a" });
});

test("historical/checkpoint context can read the original run but every M04 write is rejected", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  adapter.writeRecord(RUN_A, "state", { taskStatus: "pending" }, storage);
  const historical = { ...RUN_A, status: "historical-readonly" };

  assert.equal(adapter.isReadOnlyContext(historical), true);
  assert.deepEqual(toHostJson(adapter.readRecord(historical, "state", storage)), { taskStatus: "pending" });
  assert.throws(() => adapter.writeRecord(historical, "state", { taskStatus: "completed" }, storage), /只读/);
  assert.throws(() => adapter.removeRecord(historical, "state", storage), /只读/);

  const checkpointAdapter = createAdapter("?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=S003-RUN-20260817163000000-c02200000001&scenarioStatus=active&checkpoint=CP05");
  assert.equal(checkpointAdapter.isReadOnlyContext(RUN_A), true);
});

test("S003 persistence never overwrites the S001 fixed state, view, or C019 keys", () => {
  const adapter = createAdapter();
  const fixed = {
    "ontology3-decision-center-review-v2-portfolio-state-v6": "s001-state",
    "ontology3-decision-center-view-v2-portfolio": "s001-view",
    "ontology3.decision-center.c019.projection.v1": "s001-c019",
  };
  const storage = createStorage(fixed);
  adapter.writeRecord(RUN_A, "state", { marker: "s003" }, storage);
  adapter.writeRecord(RUN_A, "view", { marker: "s003" }, storage);
  adapter.writeRecord(RUN_A, "projection", { marker: "s003" }, storage);

  const after = storage.snapshot();
  for (const [key, value] of Object.entries(fixed)) assert.equal(after[key], value);
  assert.equal(Object.keys(after).filter((key) => key.includes(":m04:")).length, 3);
});

test("M04 C011 and C017 contracts are physically isolated by scenario triple and legacy imports remain intact", () => {
  const adapter = createAdapter();
  const c011 = { contractCode: "C011", scenarioContext: RUN_A, formedAt: "2026-08-16 12:00:00", requests: [] };
  const c017 = { contractCode: "C017", consumer: "决策中心", scenarioContext: RUN_A, formedAt: "2026-08-16 12:00:00", projections: [] };
  const legacyC011Key = "ontology3.decision-center.c011.inbox.v1";
  const legacyC017Key = "ontology3.c017.decision-center.projection.v1";
  const storage = createStorage({
    [legacyC011Key]: JSON.stringify(c011),
    [legacyC017Key]: JSON.stringify(c017)
  });

  assert.deepEqual(toHostJson(adapter.readContractRecord(RUN_A, "c011", storage)), c011);
  assert.deepEqual(toHostJson(adapter.readContractRecord(RUN_A, "c017", storage)), c017);
  assert.ok(storage.getItem(adapter.physicalKey(RUN_A, "c011")));
  assert.ok(storage.getItem(adapter.physicalKey(RUN_A, "c017")));
  assert.equal(storage.getItem(legacyC011Key), JSON.stringify(c011));
  assert.equal(storage.getItem(legacyC017Key), JSON.stringify(c017));

  const c011RunB = { ...c011, scenarioContext: RUN_B };
  adapter.writeContractRecord(RUN_B, "c011", c011RunB, storage);
  assert.notEqual(adapter.physicalKey(RUN_A, "c011"), adapter.physicalKey(RUN_B, "c011"));
  assert.deepEqual(toHostJson(adapter.readContractRecord(RUN_B, "c011", storage)), c011RunB);
  assert.deepEqual(toHostJson(adapter.readContractRecord(RUN_A, "c011", storage)), c011);
});

test("active S003 C011 intake merges newly delivered legacy requests into the current namespaced inbox", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  const first = { id: "AR-S003-FIRST", scenarioContext: RUN_A };
  const second = { id: "AR-S003-SECOND", scenarioContext: RUN_A };
  adapter.writeContractRecord(RUN_A, "c011", {
    contractCode: "C011", scenarioContext: RUN_A, formedAt: "2026-08-17 09:00:00", requests: [first]
  }, storage);
  storage.setItem("ontology3.decision-center.c011.inbox.v1", JSON.stringify({
    contractCode: "C011", schemaVersion: 1, scenarioContext: RUN_A, formedAt: "2026-08-17 09:05:00", requests: [second]
  }));

  const merged = toHostJson(adapter.readContractRecord(RUN_A, "c011", storage));
  assert.deepEqual(merged.requests.map((item) => item.id).sort(), [first.id, second.id]);
  const reread = toHostJson(adapter.readContractRecord(RUN_A, "c011", storage));
  assert.deepEqual(reread.requests.map((item) => item.id).sort(), [first.id, second.id]);
});

test("active S003 task operations remain generic while historical write entries have a hard gate", () => {
  const adapter = createAdapter();
  assert.equal(adapter.isReadOnlyContext(RUN_A), false);
  assert.match(adapterSource, /active-owner-todo/);
  assert.doesNotMatch(adapterSource, /read-only-existing-result/);
  assert.match(appSource, /const runTaskAction[\s\S]*?decisionContextReadOnly\(current\.scenarioContext\)[\s\S]*?待办写操作已拒绝/);
  assert.match(appSource, /taskReadOnly[\s\S]*?开始、进展、完成、取消、修改、纠正和来源刷新均已禁用/);
  assert.match(dataSource, /S003DecisionAdapter\.writeRecord\(data\.scenarioContext, "state"/);
  assert.match(dataSource, /S003DecisionAdapter\.writeRecord\(data\.scenarioContext, "projection"/);
  assert.match(appSource, /getProjectionIssue\?\.\("view"\)[\s\S]*?writeRecord\(context, "view", \{\}, window\.sessionStorage\)/);
});

test("S003 decision copy uses business language and long identifiers cannot crowd the detail action", () => {
  const explanations = decisionInbox.requests.map((item) => item.metric.explanation).join("\n");
  const recommendations = decisionInbox.requests.map((item) => item.recommendation).join("\n");
  assert.doesNotMatch(explanations, /Published|C035|黄灯风险分档；黄灯风险分档/);
  assert.match(explanations, /本次评估为黄灯/);
  assert.match(recommendations, /重大诉讼/);
  assert.match(appSource, /function s003DecisionBusinessExplanation/);
  assert.match(appSource, /s003DecisionBusinessExplanation\(request\)/);
  assert.match(appCssSource, /\.portfolio-card > footer > span \{[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/s);
  assert.match(appCssSource, /\.portfolio-card > footer \.dc-btn \{[^}]*flex: 0 0 auto[^}]*white-space: nowrap/s);
});

test("S003 待我决策首次进入默认列表，列表或卡片偏好只接受显式 v3 UI 记录", () => {
  const workbench = appSource.slice(appSource.indexOf("function PortfolioWorkbenchScreen"), appSource.indexOf("function LegacyWorkbenchScreen"));
  assert.match(workbench, /const storedLayout = s003Scope/);
  assert.match(workbench, /stored\.layoutPreferenceVersion === 3/);
  assert.match(workbench, /\["list", "cards"\]\.includes\(stored\.layout\)/);
  assert.match(workbench, /\["groups", "list"\]\.includes\(stored\.layout\) \? stored\.layout : "groups"/);
  assert.match(workbench, /\["list", "cards"\]\.includes\(route\.query\.layout\)/);
  assert.match(workbench, /layoutPreferenceVersion: 3/);
  assert.match(workbench, /if \(next\.layout !== \(s003Scope \? "list" : "groups"\)\) params\.set\("layout", next\.layout\)/);
});

test("S003 运营概览呈现全部任务与四类待办状态，失败和纠正仍映射到处理中并保留底层状态", () => {
  const overview = appSource.slice(appSource.indexOf("function PortfolioOperationsOverviewScreen"), appSource.indexOf("function PortfolioRequestDirectoryScreen"));
  assert.equal((overview.match(/category: "(?:pending|in_progress|overdue|ended)"/g) || []).length, 4);
  assert.match(appSource, /\["in_progress", "execution_failed", "correcting"\]\.includes\(task\?\.status\)/);
  assert.doesNotMatch(overview, /source-count-grid/);
  assert.match(appSource, /title="决策来源"/);
});

test("S003 AI 摘要固定显示风险原因、来源、评分组成、最低指标、负向因子和按灯行动建议", () => {
  const summary = appSource.slice(appSource.indexOf("function buildPortfolioDecisionSummary"), appSource.indexOf("function WorkbenchScreen"));
  assert.match(summary, /scoreSummary/);
  assert.match(summary, /lowestSummary/);
  assert.match(summary, /negativeFactorSummary/);
  assert.match(summary, /actionGuidance/);
  assert.doesNotMatch(summary, /similarities/);
  assert.doesNotMatch(summary, /相似事项/);
  assert.doesNotMatch(summary, /已知证据缺口/);
  assert.match(summary, /评分组成/);
  assert.match(summary, /最低指标/);
  assert.match(summary, /负向因子/);
  assert.match(summary, /行动建议/);
  assert.match(appSource, /function s003RiskTierTone\(value\)/);
  assert.match(appSource, /function s003RiskTierClass\(value\)/);
  assert.match(appSource, /绿灯\|黄灯\|红灯\|黑灯\|GREEN\|YELLOW\|RED\|BLACK/);
  assert.match(summary, /className=\{s003RiskTierClass\(item\.evidence\)\}/);
  for (const tone of ["green", "yellow", "red", "black"]) {
    assert.match(appCssSource, new RegExp(`\\.ai-risk-tier\\.${tone} \\{`));
  }
  assert.match(summary, /Array\.isArray\(persistedSummary\.items\)/);
  assert.match(summary, /Array\.isArray\(persistedSummary\.affectedSubjects\)/);
  assert.match(summary, /if \(instant && DC_UI_VARIANT === "portfolio" && scope === "workbench"\)/);
  assert.match(appSource, /instant=\{s003Scope\}/);
});

test("S003 详情页先展示关键证据，详情操作按钮允许换行", () => {
  assert.match(appSource, /\{s003 \? <S003DecisionEvidencePanel request=\{request\} \/> : null\}/);
  assert.match(appCssSource, /\.detail-page \.page-actions \{[^}]*flex-wrap: wrap/s);
  assert.match(appCssSource, /\.detail-page \.page-actions \{ display: grid; grid-template-columns: repeat\(2/s);
});

test("every non-active S003 status is read-only", () => {
  const adapter = createAdapter();
  for (const status of ["restored", "regression", "migrated", "historical-readonly", "closed", "unknown"]) {
    assert.equal(adapter.isReadOnlyContext({...RUN_A, status}), true, status);
  }
});

test("incompatible M04 namespace record is retained and exposed as isolated projection", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  const key = adapter.physicalKey(RUN_A, "state");
  storage.setItem(key, JSON.stringify({schemaVersion: "ofw.namespaced-storage.v0", scenarioContext: RUN_A, payload: {marker: "old"}}));
  const originalRaw = storage.getItem(key);
  assert.equal(adapter.readRecord(RUN_A, "state", storage), null);
  adapter.writeRecord(RUN_A, "state", {marker: "rebuilt-from-formal"}, storage);
  assert.equal(storage.getItem(key), originalRaw, "React 首次 effect 写入不得覆盖原不兼容 envelope");
  assert.deepEqual(toHostJson(adapter.readRecord(RUN_A, "state", storage)), {marker: "rebuilt-from-formal"});
  assert.ok(storage.getItem(adapter.recoveryPhysicalKey(RUN_A, "state")));
  assert.equal(adapter.getProjectionIssue().isolated, true);
  assert.match(adapter.getProjectionIssue().reason, /不可兼容读取/);
  assert.equal(adapter.getProjectionIssue().rebuiltLogicalKey, adapter.RECOVERY_STORAGE_KEYS.state);
});

test("M04 projection write preflights an unread incompatible primary envelope", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  const key = adapter.physicalKey(RUN_A, "projection");
  const originalRaw = JSON.stringify({schemaVersion: "ofw.namespaced-storage.v0", scenarioContext: RUN_A, payload: {marker: "old-c019"}});
  storage.setItem(key, originalRaw);

  const rebuilt = {contractCode: "C019", schemaVersion: 1, scenarioContext: RUN_A, records: []};
  adapter.writeRecord(RUN_A, "projection", rebuilt, storage);

  assert.equal(storage.getItem(key), originalRaw, "首次 React effect 不得覆盖尚未读取的不兼容 C019 envelope");
  assert.deepEqual(toHostJson(adapter.readRecord(RUN_A, "projection", storage)), rebuilt);
  assert.ok(storage.getItem(adapter.recoveryPhysicalKey(RUN_A, "projection")));
  assert.equal(adapter.getProjectionIssue("projection").code, "INCOMPATIBLE_PROJECTION");
  assert.equal(adapter.getProjectionIssue("projection").originalLogicalKey, adapter.STORAGE_KEYS.projection);
});

test("M04 incompatible C019 payload is isolated and a corrupt recovery record is never overwritten", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  const primaryKey = adapter.physicalKey(RUN_A, "projection");
  const validEnvelopeVersion = "ofw.namespaced-storage.v1";
  const invalidPayloadRaw = JSON.stringify({
    schemaVersion: validEnvelopeVersion,
    scenarioContext: RUN_A,
    payload: {contractCode: "C019", schemaVersion: 999, scenarioContext: RUN_A, records: []}
  });
  storage.setItem(primaryKey, invalidPayloadRaw);
  const rebuilt = {contractCode: "C019", schemaVersion: 1, scenarioContext: RUN_A, records: []};
  adapter.writeRecord(RUN_A, "projection", rebuilt, storage);
  assert.equal(storage.getItem(primaryKey), invalidPayloadRaw);
  assert.equal(adapter.getProjectionIssue("projection").code, "INCOMPATIBLE_PROJECTION_PAYLOAD");

  const recoveryKey = adapter.recoveryPhysicalKey(RUN_A, "projection");
  const corruptRecoveryRaw = JSON.stringify({schemaVersion: "ofw.namespaced-storage.v0", scenarioContext: RUN_A, payload: {marker: "corrupt-recovery"}});
  storage.setItem(recoveryKey, corruptRecoveryRaw);
  assert.throws(() => adapter.writeRecord(RUN_A, "projection", rebuilt, storage), /恢复投影损坏，拒绝覆盖/);
  assert.equal(storage.getItem(recoveryKey), corruptRecoveryRaw);
  assert.equal(adapter.getProjectionIssue("projection").writeBlocked, true);
  assert.equal(adapter.getProjectionIssue("projection").recoveryRecordCorrupt, true);
});

test("immutable request fingerprint detects same-id mutable projection drift", () => {
  const adapter = createAdapter();
  const expected = {
    id: "AR-S003-001",
    scenarioContext: RUN_A,
    subjectId: "ENT-001",
    subjectName: "企业一",
    actionType: {id: "S003_RISK_FOLLOW_UP", version: "1.0.1"},
    sourceRef: "C035-001",
    metric: {id: "MET-S003-FINAL-RISK-SCORE", value: "42 分"},
    taskId: "TODO-S003-001",
    decision: {type: "confirm", time: "2026-08-15 13:30:00"},
    sourceResultVersion: "1.0.0",
    sourceCandidateId: "CAND-001"
  };
  assert.equal(adapter.immutableRecordMatches(expected, JSON.parse(JSON.stringify(expected)), "request"), true);
  assert.equal(adapter.immutableRecordMatches({...expected, metric: {...expected.metric, value: "99 分"}}, expected, "request"), false);
});

test("S003 reset delegates to the scenario shell and never creates a local run id", () => {
  assert.match(appSource, /requestScenarioRerun/);
  assert.match(appSource, /M04 未自行生成 scenarioRunId/);
  const s003Branch = appSource.slice(appSource.indexOf("if (window.S003DecisionAdapter?.isActive?.(current.scenarioContext))"), appSource.indexOf("const archived =", appSource.indexOf("if (window.S003DecisionAdapter?.isActive?.(current.scenarioContext))")));
  assert.doesNotMatch(s003Branch, /scenarioRunId:\s*`/);
});

test("M04 exposes five yellow/red/black alerts with one alert per enterprise", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const snapshot = await adapter.loadCandidateSnapshot(RUN_A);
  assert.equal(snapshot.summary.total, 5);
  assert.equal(snapshot.summary.awaitingHumanConfirmation, 4);
  assert.equal(snapshot.summary.confirmed, 1);
  assert.match(snapshot.actionRequestId, /S003-ENT-020/);
  assert.match(snapshot.todoId, /S003-ENT-020/);
  const counts = snapshot.candidates.reduce((result, candidate) => ({...result, [candidate.actionTypeId]: (result[candidate.actionTypeId] || 0) + 1}), {});
  assert.deepEqual(counts, {
    S003_RISK_FOLLOW_UP: 4,
    S003_SPECIAL_DISPOSAL: 1,
  });
  assert.equal(new Set(snapshot.candidates.map((item) => item.enterpriseId)).size, 5);
  assert.ok(snapshot.candidates.every((item) => ["YELLOW", "RED", "BLACK"].includes(item.riskTier)));
  assert.ok(snapshot.candidates.every((item) => item.trigger.type === "RISK_TIER"));
});

test("M04 can read the M02-owned formal C017 projection before any M02 page visit", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  await adapter.loadCandidateSnapshot(RUN_A);
  const storage = createStorage();
  const projection = toHostJson(adapter.readContractRecord(RUN_A, "c017", storage));
  assert.equal(projection.contractCode, "C017");
  assert.equal(projection.sourceModule, "数据工程");
  assert.equal(projection.consumer, "决策中心");
  assert.equal(projection.readStatus, "ready");
  assert.equal(projection.projections[0].dataVersion, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  for (const gate of ["request_receipt", "confirmation_submit", "task_formation"]) {
    const receipt = projection.projections[0].gates[gate];
    assert.equal(receipt.qualityStatus, "允许推进");
    assert.equal(receipt.hardQualityFailure, false);
    assert.ok(receipt.currentStateSummary.id);
    assert.ok(receipt.evidenceLocator);
  }
  assert.equal(storage.length, 0, "正式只读 C017 回退不应凭空改写浏览器存储");
});

test("M04 default S003 projection keeps three manually submitted pending decisions beside one handled item", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const initial = {
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  };
  const hydrated = toHostJson(await adapter.hydrateNativeState(initial));
  const awaiting = hydrated.requests.filter((item) => item.status === "awaiting");
  const handled = hydrated.requests.filter((item) => item.decision?.type === "confirm");
  assert.equal(awaiting.length, 3);
  assert.equal(handled.length, 1);
  assert.equal(hydrated.tasks.length, 1);
  assert.ok(awaiting.every((item) => item.automatic === false && item.confirmationEligibility.allowed === true));
  assert.ok(awaiting.every((item) => item.id === `AR-${item.sourceCandidateId}`));
  assert.ok(awaiting.every((item) => item.evidence.semanticVersion === "S003-M01-DEBT-RISK-PKG 1.0.2"));
  assert.ok(awaiting.every((item) => item.evidence.dataVersion === "1.0.0"));
  assert.ok(awaiting.every((item) => item.c017SafetyReads.some((read) => read.gate === "request_receipt" && read.outcome === "allowed")));
  assert.ok(awaiting.every((item) => item.evidence.quality === "允许推进"));
  assert.ok(awaiting.every((item) => item.evidence.qualitySource?.contractCode === "C017"));
  assert.ok(awaiting.every((item) => item.evidence.ready === "C017 接收安全门通过"));
  assert.equal(handled[0].c017SafetyReads.length, 3);
  assert.deepEqual(handled[0].c017SafetyReads.map((item) => item.gate), ["request_receipt", "confirmation_submit", "task_formation"]);
  assert.equal(hydrated.tasks[0].c017SafetyRead.gate, "task_formation");
  assert.equal(hydrated.scenarioBootstrap.pendingDecisionRequestCount, 3);
  assert.equal(hydrated.scenarioBootstrap.confirmedActionRequestCount, 1);
  assert.equal(hydrated.scenarioBootstrap.actionRequestCount, 4);
  assert.ok(awaiting.every((item) => item.decisionRecipient?.role === "成员单位债务风险接口人"));
  assert.ok(awaiting.every((item) => item.submittedBy === "集团债务风险管理人员"));
  assert.ok(awaiting.every((item) => item.owner === null && item.ownerId === null));
  assert.ok(awaiting.every((item) => item.taskId === null));
  assert.ok(awaiting.every((item) => !hydrated.tasks.some((task) => task.requestId === item.id)));
  assert.match(appSource, /sourceCandidateId: request\.sourceCandidateId \|\| request\.candidateId \|\| null/);
  assert.match(appSource, /actionTypeId: request\.actionType\?\.id \|\| request\.actionTypeId \|\| null/);
});

test("M04 refreshes stale active-run presentation copy without changing decisions, todos or immutable history", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const initial = {
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  };
  const hydrated = toHostJson(await adapter.hydrateNativeState(initial));
  const pending = hydrated.requests.find((item) => item.status === "awaiting");
  assert.ok(pending);
  const stale = JSON.parse(JSON.stringify(hydrated));
  const staleRequest = stale.requests.find((item) => item.id === pending.id);
  staleRequest.recommendation = "黄灯企业按亮灯直接形成预警入口，由集团风险管理员统一收件后再分办。";
  staleRequest.actionType.name = "旧版风险候选";
  staleRequest.actionType.description = "旧版整批收件语义";
  staleRequest.metric.explanation = "旧版说明";
  const migrated = toHostJson(await adapter.hydrateNativeState(stale));
  const current = migrated.requests.find((item) => item.id === pending.id);

  assert.match(current.recommendation, /集团债务风险管理人员/);
  assert.match(current.recommendation, /对应成员单位接口人/);
  assert.doesNotMatch(current.recommendation, /集团风险管理员统一收件/);
  assert.equal(current.actionType.name, "风险分档跟踪");
  assert.match(current.actionType.description, /对应成员单位接口人/);
  assert.match(current.metric.explanation, /黄灯/);
  assert.equal(current.decision, null);
  assert.equal(current.taskId, null);
  assert.equal(migrated.tasks.length, hydrated.tasks.length);
  assert.ok(migrated.auditHistory.some((entry) => /行动展示文案已按同一 C011 正式来源刷新/.test(entry.reason)));
});

test("M04 migrates stale dynamically submitted C011 role copy while preserving its workflow state", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const dynamic = {
    id: "AR-S003-DYNAMIC-019",
    requestId: "AR-S003-DYNAMIC-019",
    scenarioContext: RUN_A,
    scenario: "债务风险监测",
    sourceType: "report",
    sourceRef: "债务风险驾驶舱 · S003-C035-ENT-019",
    subjectId: "S003-ENT-019",
    subjectName: "环保测试公司3",
    requester: "集团债务风险管理人员",
    submittedBy: "集团债务风险管理人员",
    recommendation: "黄灯企业按亮灯直接形成预警入口，由集团风险管理员显式提交后送达对应成员单位接口人。",
    actionType: { id: "S003_RISK_FOLLOW_UP", name: "风险分档跟踪", description: "由集团风险管理员统一收件后再分办", version: "1.0.2" },
    metric: { id: "MET-S003-FINAL-RISK-SCORE", name: "企业最终风险评分", value: "37.31 分", explanation: "黄灯预警由集团风险管理员统一接收" },
    decisionRecipient: { recipientId: "S003-CONTACT-019", recipientName: "环保测试公司3债务风险接口人", role: "成员单位债务风险接口人" },
    recommendedTaskOwner: "环保测试公司3债务风险责任人",
    status: "awaiting",
    decision: null,
    taskId: null,
    evidence: { dataVersion: "1.0.0", qualitySource: { summaryId: "C017-SUMMARY" } },
    c017SafetyReads: []
  };
  const baseState = {
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [dynamic],
    tasks: [],
    activity: [],
    auditHistory: [],
  };
  const migrated = toHostJson(await adapter.hydrateNativeState(baseState));
  const current = migrated.requests.find((item) => item.id === dynamic.id);

  assert.ok(current);
  assert.match(current.recommendation, /集团债务风险管理人员/);
  assert.doesNotMatch(current.recommendation, /集团风险管理员/);
  assert.match(current.actionType.description, /成员单位接口人/);
  assert.doesNotMatch(current.metric.explanation, /集团风险管理员/);
  assert.equal(current.status, "awaiting");
  assert.equal(current.decision, null);
  assert.equal(current.taskId, null);
  assert.ok(migrated.auditHistory.some((entry) => /角色展示文案已显式迁移/.test(entry.reason)));
});

test("M04 uses the current-run v3 decision projection and preserves earlier immutable resources", () => {
  const inboxV1Path = path.resolve(root, "../../../scenarios/s003/resources/m04/decision-inbox.v1.json");
  const inboxV2Path = path.resolve(root, "../../../scenarios/s003/resources/m04/decision-inbox.v2.json");
  const resultsV1Path = path.resolve(root, "../../../scenarios/s003/resources/m04/decision-results.v1.json");
  const resultsV2Path = path.resolve(root, "../../../scenarios/s003/resources/m04/decision-results.v2.json");
  const inboxV3Path = path.resolve(root, "../../../scenarios/s003/resources/m04/decision-inbox.v3.json");
  const resultsV3Path = path.resolve(root, "../../../scenarios/s003/resources/m04/decision-results.v3.json");
  const inboxV1 = JSON.parse(fs.readFileSync(inboxV1Path, "utf8"));
  const inboxV2 = JSON.parse(fs.readFileSync(inboxV2Path, "utf8"));
  const resultsV1 = JSON.parse(fs.readFileSync(resultsV1Path, "utf8"));
  const resultsV2 = JSON.parse(fs.readFileSync(resultsV2Path, "utf8"));
  const inboxV3 = JSON.parse(fs.readFileSync(inboxV3Path, "utf8"));
  const resultsV3 = JSON.parse(fs.readFileSync(resultsV3Path, "utf8"));

  assert.equal(inboxV2.supersedes.inboxId, inboxV1.inboxId);
  assert.equal(resultsV2.supersedes.resultSetId, resultsV1.resultSetId);
  assert.ok(inboxV2.requests.every((item) => item.c017SafetyReads.length === 1));
  assert.ok(inboxV2.requests.every((item) => item.evidence.qualitySource.contractCode === "C017"));
  assert.deepEqual(resultsV2.confirmedDecision.c017SafetyReads.map((item) => item.gate), ["request_receipt", "confirmation_submit", "task_formation"]);
  assert.ok(resultsV2.policy.sourceContracts.includes("C017"));
  assert.equal(inboxV3.supersedes, "resources/m04/decision-inbox.v2.json");
  assert.equal(resultsV3.supersedes, "resources/m04/decision-results.v2.json");
  assert.equal(inboxV3.requests.length, 3);
  assert.equal(resultsV3.candidateSummary.total, 5);
  assert.equal(resultsV3.candidateSummary.actionRequestsCreated, 4);
  assert.equal(resultsV3.confirmedDecision.sideEffects.actionRequestCreated, false);
  assert.equal(resultsV3.confirmedDecision.sideEffects.todoCreated, true);
  assert.match(adapterSource, /decision-inbox\.v3\.json/);
  assert.match(adapterSource, /decision-results\.v3\.json/);
  assert.match(adapterSource, /c017-decision-projection\.v2\.json/);
});

test("M04 current formal resources share one run and one exact action-request contract", () => {
  const runId = "S003-RUN-20260817163000000-c02200000001";
  const identities = [
    decisionBinding.scenarioIdentity,
    decisionRuntime.scenarioIdentity,
    decisionInbox.scenarioIdentity,
    decisionResults.scenarioIdentity,
    enterpriseRouting.scenarioIdentity,
    c017Projection.scenarioContext,
    c035Results.scenarioIdentity,
    publishedPointer.scenarioIdentity,
    actionTypeCatalog.scenarioIdentity,
  ];
  assert.ok(identities.every((identity) => identity.scenarioId === "S003"
    && identity.scenarioVersion === "S003-v1"
    && identity.scenarioRunId === runId));

  assert.equal(decisionRuntime.binding.ref, "resources/m04/decision-binding.v2.json");
  assert.equal(decisionRuntime.binding.bindingVersion, decisionBinding.bindingVersion);
  assert.equal(decisionRuntime.binding.sha256, resourceSha("../../../scenarios/s003/resources/m04/decision-binding.v2.json"));
  assert.equal(decisionRuntime.source.ref, "resources/m01/c035-risk-results.v2.json");
  assert.equal(decisionRuntime.source.schemaVersion, c035Results.schemaVersion);
  assert.equal(decisionRuntime.source.sha256, resourceSha("../../../scenarios/s003/resources/m01/c035-risk-results.v2.json"));
  assert.equal(c035Results.modelPointer.pointerVersion, publishedPointer.pointerVersion);
  assert.equal(c035Results.modelPointer.pointerSha256, resourceSha("../../../scenarios/s003/resources/m01/published-pointer.v2.json"));
  assert.ok(decisionBinding.contracts.includes("C017"));
  assert.match(adapterSource, /decision-binding\.v2\.json/);
  assert.match(scenarioDataSource, /decisionBinding:\s*"\.\/resources\/m04\/decision-binding\.v2\.json"/);

  const alerts = c035Results.results.flatMap((result) => result.dispositionCandidates.map((candidate) => ({result, candidate})));
  assert.equal(alerts.length, 5);
  assert.equal(new Set(alerts.map(({result}) => result.enterprise.enterpriseId)).size, 5);
  assert.ok(alerts.every(({result, candidate}) => ["YELLOW", "RED", "BLACK"].includes(result.riskTier.tierId)
    && candidate.trigger.type === "RISK_TIER"
    && candidate.actionTypeId !== "S003_FACTOR_EMERGENCY"));
  assert.equal(actionTypeCatalog.actionTypes.length, 3);
  assert.equal(actionTypeCatalog.actionTypes.some((item) => item.actionTypeId === "S003_FACTOR_EMERGENCY"), false);

  const candidateById = new Map(decisionResults.candidatesBeforeConfirmation.map((item) => [item.candidateId, item]));
  assert.equal(decisionInbox.requests.length, 3);
  for (const request of decisionInbox.requests) {
    const candidate = candidateById.get(request.candidateId);
    assert.ok(candidate);
    assert.equal(request.subjectId, candidate.enterpriseId);
    assert.equal(request.sourceResultId, candidate.sourceResultId);
    assert.equal(request.evidence.snapshotId, candidate.sourceResultId);
    assert.equal(request.sourceCandidateId, candidate.candidateId);
    assert.equal(request.id, `AR-${candidate.candidateId}`);
    assert.equal(request.requestId, request.id);
    assert.equal(request.idempotencyKey, candidate.idempotencyKey);
  }

  assert.equal(decisionResults.candidateSummary.total, 5);
  assert.equal(decisionResults.candidateSummary.actionRequestsCreated, 4);
  assert.equal(decisionResults.candidateSummary.todosCreated, 1);
  const actionRequestIds = [
    ...decisionInbox.requests.map((item) => item.id),
    decisionResults.confirmedDecision.actionRequest.actionRequestId,
  ];
  assert.equal(actionRequestIds.length, 4);
  assert.equal(new Set(actionRequestIds).size, 4);
  assert.equal(decisionResults.confirmedDecision.sideEffects.actionRequestCreated, false);
  assert.equal(decisionResults.confirmedDecision.sideEffects.todoCreated, true);
  assert.equal(decisionRuntime.confirmation.duplicateConfirmation, "idempotent-no-new-record");
  assert.equal(decisionRuntime.sideEffects.actionRequestCreatedAtDashboardSubmission, true);
  assert.equal(decisionRuntime.sideEffects.actionRequestCreatedOnlyAfterConfirmation, false);
  const submitDecisionSource = appSource.slice(appSource.indexOf("const submitDecision"), appSource.indexOf("const requestSupplement"));
  assert.doesNotMatch(submitDecisionSource, /stableResourceId\("AR"|actionRequestId:\s*`AR-/);

  assert.equal(enterpriseRouting.routes.length, 21);
  assert.equal(new Set(enterpriseRouting.routes.map((item) => item.enterpriseId)).size, 21);
  assert.equal(new Set(enterpriseRouting.routes.map((item) => item.memberUnitId)).size, 21);
  assert.equal(new Set(enterpriseRouting.routes.map((item) => item.decisionRecipient.recipientId)).size, 21);
  assert.ok(enterpriseRouting.routes.every((item) => item.decisionRecipient.role === "成员单位债务风险接口人"));
  assert.equal(c017Projection.projections[0].scenarioContext.scenarioRunId, runId);
  assert.deepEqual(Object.keys(c017Projection.projections[0].gates).sort(), ["confirmation_submit", "request_receipt", "task_formation"]);
  assert.match(generatorSource, /idempotencyKey:\s*candidate\.idempotencyKey/);
  assert.match(generatorSource, /--contracts-only/);
});

test("M04 fails only the affected pending request closed when its C017 receipt is missing", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search, (url, payload) => {
    if (!url.includes("decision-inbox.v3.json")) return payload;
    const copy = JSON.parse(JSON.stringify(payload));
    const target = copy.requests.find((item) => item.subjectId === "S003-ENT-017");
    target.c017SafetyReads = [];
    target.evidence.quality = "质量检查通过";
    delete target.evidence.qualitySource;
    return copy;
  });
  const hydrated = toHostJson(await adapter.hydrateNativeState({
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  }));
  const blocked = hydrated.requests.find((item) => item.subjectId === "S003-ENT-017");
  const unaffected = hydrated.requests.filter((item) => item.status === "awaiting");
  assert.equal(blocked.status, "c017_blocked");
  assert.equal(blocked.confirmationEligibility.allowed, false);
  assert.equal(blocked.requestGate.status, "blocked");
  assert.equal(blocked.evidence.quality, "C017 接收安全回执未定位");
  assert.match(blocked.blockReason, /C017 request_receipt/);
  assert.equal(unaffected.length, 2);
  const pendingSection = adapterSource.slice(adapterSource.indexOf("function pendingReceiptState"), adapterSource.indexOf("function pendingRecordMatches"));
  assert.doesNotMatch(pendingSection, /riskResults|qualityResultId|inputIdentity/);
});

test("M04 enriches an old same-run work projection with C017 receipts without losing a human decision", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const initial = toHostJson(await adapter.hydrateNativeState({
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  }));
  const target = initial.requests.find((item) => item.status === "awaiting");
  target.c017SafetyReads = [];
  target.evidence.quality = "质量检查通过";
  delete target.evidence.qualitySource;
  target.status = "confirmed";
  target.taskId = "TD-S003-MIGRATED-001";
  target.decision = { type: "confirm", time: "2026-08-17 09:00:00", operator: target.decisionRecipient.recipientName, owner: `${target.subjectName}债务风险责任人` };
  initial.scenarioBootstrap.resultSetId = "S003-M04-DECISION-RESULTS-20260815-001";

  const reloaded = toHostJson(await adapter.hydrateNativeState(initial));
  const migrated = reloaded.requests.find((item) => item.id === target.id);
  assert.equal(migrated.status, "confirmed");
  assert.equal(migrated.taskId, "TD-S003-MIGRATED-001");
  assert.equal(migrated.decision.type, "confirm");
  assert.equal(migrated.c017SafetyReads[0].gate, "request_receipt");
  assert.equal(migrated.evidence.qualitySource.contractCode, "C017");
});

test("M04 reload preserves a human decision made on a seeded pending Action Request", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const initial = {
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  };
  const hydrated = toHostJson(await adapter.hydrateNativeState(initial));
  const pending = hydrated.requests.find((item) => item.status === "awaiting");
  pending.status = "confirmed";
  pending.taskId = "TD-S003-USER-CONFIRMED-001";
  pending.decision = {
    type: "confirm",
    time: "2026-08-16 10:00:00",
    operator: pending.decisionRecipient.recipientName,
    owner: `${pending.subjectName}债务风险责任人`,
  };
  const reloaded = toHostJson(await adapter.hydrateNativeState(hydrated));
  const preserved = reloaded.requests.find((item) => item.id === pending.id);
  assert.equal(preserved.status, "confirmed");
  assert.equal(preserved.taskId, "TD-S003-USER-CONFIRMED-001");
  assert.equal(preserved.decision.type, "confirm");
  assert.equal(reloaded.auditHistory.length, hydrated.auditHistory.length);
});

test("M04 migrates a legacy pending projection that incorrectly prefilled the todo owner", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const hydrated = toHostJson(await adapter.hydrateNativeState({
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  }));
  const legacyPending = hydrated.requests.find((item) => item.status === "awaiting");
  legacyPending.owner = legacyPending.recommendedTaskOwner;
  legacyPending.ownerId = legacyPending.recommendedTaskOwnerId;

  const migratedState = toHostJson(await adapter.hydrateNativeState(hydrated));
  const migrated = migratedState.requests.find((item) => item.id === legacyPending.id);
  assert.equal(migrated.status, "awaiting");
  assert.equal(migrated.decision, null);
  assert.equal(migrated.taskId, null);
  assert.equal(migrated.owner, null);
  assert.equal(migrated.ownerId, null);
  assert.equal(migrated.recommendedTaskOwner, legacyPending.recommendedTaskOwner);
  assert.ok(!migratedState.tasks.some((task) => task.requestId === migrated.id));
});

test("M04 enterprise report link returns to the same-run report center without creating side effects", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter, messages} = createRuntimeAdapter(search);
  const snapshot = await adapter.loadCandidateSnapshot(RUN_A);
  const candidate = snapshot.candidates.find((item) => item.candidateId !== snapshot.confirmedCandidateId);
  assert.equal(adapter.openEnterpriseReport(candidate, RUN_A), true);
  assert.equal(messages.length, 1);
  assert.deepEqual(toHostJson(messages[0].message), {
    channel: "ontology3.0-scenario-shell-v1",
    operation: "navigateScenarioModule",
    moduleId: "report",
    hash: `#/reports/view?enterpriseId=${candidate.enterpriseId}&runId=${RUN_A.scenarioRunId}`,
    scenarioId: RUN_A.scenarioId,
    scenarioVersion: RUN_A.scenarioVersion,
    scenarioRunId: RUN_A.scenarioRunId,
    sourceModule: "M04",
    enterpriseId: candidate.enterpriseId,
    requestedAt: messages[0].message.requestedAt,
  });
  assert.equal(messages[0].origin, "http://127.0.0.1:4333");
  assert.equal("actionRequest" in messages[0].message, false);
  assert.equal("todo" in messages[0].message, false);
  assert.equal("notification" in messages[0].message, false);
  assert.equal("approval" in messages[0].message, false);
  assert.match(appSource, /S003EnterpriseReportButton/);
  assert.match(appSource, /查看企业风险报告/);
});

test("M04 enterprise report link has a standalone same-run fallback", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter, navigations} = createStandaloneRuntimeAdapter(search);
  const snapshot = await adapter.loadCandidateSnapshot(RUN_A);
  const candidate = snapshot.candidates.find((item) => item.enterpriseId);
  assert.equal(adapter.openEnterpriseReport(candidate, RUN_A), true);
  assert.equal(navigations.length, 1);
  assert.match(navigations[0], /report-center\/review-lifecycle\/index\.html\?/);
  assert.match(navigations[0], new RegExp(`scenarioRunId=${RUN_A.scenarioRunId}`));
  assert.match(navigations[0], new RegExp(`enterpriseId=${candidate.enterpriseId}`));
  assert.match(navigations[0], /#\/reports\/view\?/);
});

test("M04 enterprise report link keeps the exact formal report evidence route", () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter, messages} = createRuntimeAdapter(search);
  const reportRoute = `#/reports/view?enterpriseId=S003-ENT-007&reportId=S003-RPT-RUN-A-ENT-007&runId=${RUN_A.scenarioRunId}`;
  const record = {
    subjectId: "S003-ENT-007",
    scenarioContext: RUN_A,
    evidence: {
      reportId: "S003-RPT-RUN-A-ENT-007",
      contentVersion: "1.6.0",
      artifactVersion: "html-print-capability-v8",
      artifactSha256: "sha256-test-only",
      reportRoute,
    },
  };
  assert.equal(adapter.openEnterpriseReport(record, RUN_A), true);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].message.hash, reportRoute);
});

test("dashboard C011 to generic decision, human confirmation, todo and report drill-through stays one native chain", () => {
  const adapter = createAdapter();
  const storage = createStorage();
  const dashboardRequest = {
    id: "AR-S003-DASHBOARD-001",
    requestId: "AR-S003-DASHBOARD-001",
    scenarioContext: RUN_A,
    sourceType: "report",
    subjectId: "S003-ENT-007",
    subjectName: "风电测试公司07",
    requester: "集团债务风险管理人员",
    submittedBy: "集团债务风险管理人员",
    routingTarget: { type: "member-unit-decision-center", organizationId: "S003-UNIT-007", organizationName: "风电测试公司07" },
    decisionRecipient: { enterpriseId: "S003-ENT-007", memberUnitId: "S003-UNIT-007", memberUnitName: "风电测试公司07", recipientId: "S003-CONTACT-007", recipientName: "风电测试公司07债务风险接口人", role: "成员单位债务风险接口人" },
    recipientRole: "成员单位债务风险接口人",
    recommendedTaskOwner: "风电测试公司07债务风险责任人",
    recommendedTaskOwnerId: "S003-ENT-007-DEBT-RISK-OWNER",
    actionType: { id: "S003_RISK_FOLLOW_UP", version: "1.0.1", status: "已发布" },
    metric: { id: "S003-METRIC-FINAL-SCORE", value: "37.75 分" },
    evidence: { semanticVersion: "S003-M01-DEBT-RISK-PKG 1.0.1", dataVersion: "1.0.0", snapshotId: "S003-C035-ENT-007", cutoff: "2025-12-31" }
  };
  adapter.writeContractRecord(RUN_A, "c011", { contractCode: "C011", scenarioContext: RUN_A, formedAt: "2026-08-16 12:00:00", requests: [dashboardRequest] }, storage);
  const inbox = toHostJson(adapter.readContractRecord(RUN_A, "c011", storage));
  assert.equal(inbox.requests[0].id, dashboardRequest.id);
  assert.match(appSource, /readC011Inbox[\s\S]*?readContractRecord\?\.\(currentContext, "c011"/);
  assert.match(appSource, /receiveActionRequests[\s\S]*?normalizeReceivedRequest/);
  assert.match(appSource, /normalizeReceivedRequest[\s\S]*?submittedBy[\s\S]*?decisionRecipient[\s\S]*?recommendedTaskOwner/);
  assert.match(appSource, /S003 行动申请缺少对应成员单位和债务风险接口人路由/);
  assert.match(appSource, /route\.parts\[0\] !== "request"[\s\S]*?receiveActionRequests\(\[target\]\)/);
  assert.match(appSource, /submitDecision[\s\S]*?operator: decisionOperatorName\(request\)[\s\S]*?buildTaskFromDecision/);
  assert.match(appSource, /成员单位接口人确认并交办/);
  assert.match(appSource, /function decisionTriggerLabel[\s\S]*?风险分档亮灯触发（来自债务风险监测仪表盘）/);
  assert.match(appSource, /<strong>\{decisionTriggerLabel\(request\)\}<\/strong>/);
  assert.doesNotMatch(appSource, /operator: "集团债务风险管理人员"/);
  assert.match(appSource, /S003EnterpriseReportButton[\s\S]*?openEnterpriseReport/);
  assert.match(dataSource, /item\.projectionMode \|\| \(item\.actionRequestImmutable \? "active-existing-result" : "active-submitted-request"\)/);
});

test("S003 C011 normalization separates submitter, member-unit recipient and todo owner", () => {
  const logic = createAppContractLogic();
  const payload = {
    id: "AR-S003-DASHBOARD-ROUTED-001",
    requestId: "AR-S003-DASHBOARD-ROUTED-001",
    scenarioContext: RUN_A,
    scenario: "债务风险监测",
    sourceType: "report",
    sourceRef: "债务风险驾驶舱 · S003-C035-ENT-007",
    subjectId: "S003-ENT-007",
    subjectName: "风电测试公司07",
    requester: "集团债务风险管理人员",
    submittedBy: "集团债务风险管理人员",
    recommendation: "黄灯企业按亮灯直接形成预警入口，由集团风险管理员显式提交后送达对应成员单位接口人。",
    actionType: { id: "S003_RISK_FOLLOW_UP", version: "1.0.2", status: "已发布", description: "由集团风险管理员统一收件后再分办" },
    metric: { id: "MET-S003-FINAL-RISK-SCORE", name: "企业最终风险评分", value: "37.75 分", explanation: "黄灯预警由集团风险管理员统一接收" },
    routingTarget: { type: "member-unit-decision-center", organizationId: "S003-UNIT-007", organizationName: "风电测试公司07" },
    decisionRecipient: { enterpriseId: "S003-ENT-007", memberUnitId: "S003-UNIT-007", memberUnitName: "风电测试公司07", recipientId: "S003-CONTACT-007", recipientName: "风电测试公司07债务风险接口人", role: "成员单位债务风险接口人" },
    recipientRole: "成员单位债务风险接口人",
    recommendedTaskOwner: "风电测试公司07债务风险责任人",
    recommendedTaskOwnerId: "S003-ENT-007-DEBT-RISK-OWNER",
    evidence: { semanticVersion: "S003-M01-DEBT-RISK-PKG 1.0.2", dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1", snapshotId: "S003-C035-ENT-007", cutoff: "2025-12-31", reportId: "S003-RPT-RUN-A-ENT-007", reportRoute: `#/reports/view?enterpriseId=S003-ENT-007&reportId=S003-RPT-RUN-A-ENT-007&runId=${RUN_A.scenarioRunId}` },
  };
  assert.equal(logic.validateC011Payload(payload, RUN_A).ok, true);
  const normalized = toHostJson(logic.normalizeReceivedRequest(payload, RUN_A, { outcome: "allowed", readAt: "2026-08-17 17:20:00", reason: "C017 允许推进" }));
  assert.equal(normalized.submittedBy, "集团债务风险管理人员");
  assert.equal(normalized.decisionRecipient.recipientName, "风电测试公司07债务风险接口人");
  assert.equal(normalized.recipientRole, "成员单位债务风险接口人");
  assert.equal(normalized.owner, null);
  assert.equal(normalized.ownerId, null);
  assert.equal(normalized.recommendedTaskOwner, "风电测试公司07债务风险责任人");
  assert.match(normalized.recommendation, /集团债务风险管理人员/);
  assert.match(normalized.recommendation, /对应成员单位接口人/);
  assert.doesNotMatch(normalized.actionType.description, /集团风险管理员/);
  assert.doesNotMatch(normalized.metric.explanation, /集团风险管理员/);
  assert.equal(logic.requestCanDecide(normalized), true);

  normalized.decision = { type: "confirm", time: "2026-08-17 17:30:00" };
  const selectedOwner = "风电测试公司07资金负责人";
  const task = toHostJson(logic.buildTaskFromDecision(normalized, {
    owner: selectedOwner,
    dueDate: "2026-08-24",
    instructions: "核实风险成因并落实改善计划",
    reason: "成员单位接口人确认后分办",
    banks: [],
  }));
  assert.equal(task.owner, selectedOwner);
  assert.equal(task.ownerId, null, "接口人改选负责人后不得沿用建议负责人的标识");
  assert.equal(task.assignedBy, "风电测试公司07债务风险接口人");
  assert.equal(task.requestId, normalized.id);

  const recommendedTask = toHostJson(logic.buildTaskFromDecision(normalized, {
    owner: normalized.recommendedTaskOwner,
    dueDate: "2026-08-24",
    instructions: "核实风险成因并落实改善计划",
    reason: "采用系统建议负责人",
    banks: [],
  }));
  assert.equal(recommendedTask.owner, normalized.recommendedTaskOwner);
  assert.equal(recommendedTask.ownerId, normalized.recommendedTaskOwnerId);

  const missingRoute = JSON.parse(JSON.stringify(payload));
  delete missingRoute.routingTarget;
  delete missingRoute.decisionRecipient;
  delete missingRoute.recipientRole;
  assert.equal(logic.validateC011Payload(missingRoute, RUN_A).ok, false);
  assert.match(logic.validateC011Payload(missingRoute, RUN_A).problems.join("；"), /不能回退给集团管理员/);
});

test("same-id S003 C011 refreshes only active presentation fields and preserves workflow state", () => {
  const logic = createAppContractLogic();
  const existing = {
    id: "AR-S003-DASHBOARD-ROUTED-001",
    scenarioContext: RUN_A,
    requester: "集团风险管理员",
    submittedBy: "集团风险管理员",
    sourceRef: "旧驾驶舱投影",
    recommendation: "黄灯企业由集团风险管理员统一收件后再分办。",
    actionType: { id: "S003_RISK_FOLLOW_UP", version: "1.0.2", name: "风险分档跟踪", description: "由集团风险管理员统一收件后再分办" },
    metric: { id: "MET-S003-FINAL-RISK-SCORE", value: "37.75 分", name: "企业最终风险评分", explanation: "黄灯预警由集团风险管理员统一接收" },
    decision: { type: "confirm", operator: "风电测试公司07债务风险接口人", time: "2026-08-17 17:30:00" },
    taskId: "TD-S003-0001",
    owner: "风电测试公司07资金负责人",
    ownerId: "S003-OWNER-007",
    evidence: { reportId: "S003-RPT-007", immutable: true },
    c017SafetyReads: [{ gate: "request_receipt", outcome: "allowed" }],
    contractFingerprint: "immutable-fingerprint",
  };
  const incoming = {
    ...existing,
    requester: "集团债务风险管理人员",
    submittedBy: "集团债务风险管理人员",
    sourceRef: "债务风险驾驶舱 · S003-C035-ENT-007",
    recommendation: "黄灯企业按亮灯直接形成预警入口，由集团风险管理员显式提交后送达对应成员单位接口人。",
    actionType: { ...existing.actionType, description: "由集团风险管理员统一收件后再分办" },
    metric: { ...existing.metric, explanation: "黄灯预警由集团风险管理员统一接收" },
    decision: null,
    taskId: null,
    owner: null,
    ownerId: null,
    evidence: { reportId: "SHOULD-NOT-OVERWRITE" },
    c017SafetyReads: [],
  };

  const refreshed = toHostJson(logic.mergeS003ActiveRequestPresentation(existing, incoming, RUN_A));
  assert.equal(refreshed.changed, true);
  assert.equal(refreshed.record.requester, existing.requester);
  assert.equal(refreshed.record.submittedBy, existing.submittedBy);
  assert.equal(refreshed.record.sourceRef, existing.sourceRef);
  assert.match(refreshed.record.recommendation, /集团债务风险管理人员/);
  assert.match(refreshed.record.recommendation, /对应成员单位接口人/);
  assert.doesNotMatch(refreshed.record.actionType.description, /集团风险管理员/);
  assert.doesNotMatch(refreshed.record.metric.explanation, /集团风险管理员/);
  assert.deepEqual(refreshed.record.decision, existing.decision);
  assert.equal(refreshed.record.taskId, existing.taskId);
  assert.equal(refreshed.record.owner, existing.owner);
  assert.equal(refreshed.record.ownerId, existing.ownerId);
  assert.deepEqual(refreshed.record.evidence, existing.evidence);
  assert.deepEqual(refreshed.record.c017SafetyReads, existing.c017SafetyReads);
  assert.equal(refreshed.record.contractFingerprint, existing.contractFingerprint);

  const historical = toHostJson(logic.mergeS003ActiveRequestPresentation(existing, incoming, { ...RUN_A, status: "historical-readonly" }));
  assert.equal(historical.changed, false);
  assert.equal(historical.record.recommendation, existing.recommendation);
  assert.match(appSource, /if \(sameId\) \{[\s\S]*?mergeS003ActiveRequestPresentation\(sameId, payload, current\.scenarioContext\)[\s\S]*?未重复创建行动申请或负责人待办/);
  assert.match(appSource, /const pendingIntake = inbox\.requests\.filter[\s\S]*?mergeS003ActiveRequestPresentation\(existing, item, data\.scenarioContext\)\.changed/);
});

test("M04 keeps the v1.0.3 generic workbench and does not mount an S003 candidate panel", () => {
  assert.doesNotMatch(appSource, /function S003CandidateSummary/);
  assert.doesNotMatch(appSource, /s003-candidate-panel/);
  assert.doesNotMatch(appSource, /到驾驶舱确认/);
  assert.match(appSource, /function PortfolioWorkbenchScreen/);
  assert.match(appSource, /function PortfolioActionIntakeScreen/);
  assert.match(appSource, /bankEvidenceNotApplicable/);
});

test("M04 C011 intake isolates other scenario runs without deleting their records", () => {
  assert.match(appSource, /sourceRequests\.filter\(\(request\) => sameScenarioContext/);
  assert.match(appSource, /excludedRequests: sourceRequests\.length - requests\.length|const excludedRequests = sourceRequests\.length - requests\.length/);
  assert.match(appSource, /已隔离其他场景请求/);
  assert.match(appSource, /原记录保持不变，但不会在当前待接收列表展示或接收/);
  assert.doesNotMatch(appSource, /removeItem\(DC_C011_INBOX_KEY\)/);
});

test("M04 consumes the M01 Published Action Type catalog instead of keeping private display names", async () => {
  const search = `?scenarioId=${RUN_A.scenarioId}&scenarioVersion=${RUN_A.scenarioVersion}&scenarioRunId=${RUN_A.scenarioRunId}&scenarioContextFormedAt=${encodeURIComponent(RUN_A.formedAt)}&scenarioStatus=active`;
  const {adapter} = createRuntimeAdapter(search);
  const hydrated = toHostJson(await adapter.hydrateNativeState({
    schemaVersion: 6,
    stateModelVersion: 2,
    variant: "portfolio",
    stateRevision: 1,
    scenarioContext: RUN_A,
    requests: [],
    tasks: [],
    activity: [],
    auditHistory: [],
  }));
  const names = new Set(hydrated.requests.map(item => item.actionType?.name));
  assert.ok(names.has("风险分档跟踪"));
  assert.ok(names.has("专项风险处置"));
  assert.equal(names.has("重大因子应急处置"), false);
  assert.match(adapterSource, /action-type-catalog\.v2\.json/);
  assert.match(adapterSource, /actionTypeCatalog\?\.actionTypes/);
  assert.doesNotMatch(adapterSource, /S003_RISK_FOLLOW_UP:\s*"风险跟踪"|S003_FACTOR_EMERGENCY:\s*"重大因子应急处置"/);
});

test("M04 feedback keeps S003 decision selection in list/card views with a right drawer", () => {
  const workbench = appSource.slice(appSource.indexOf("function PortfolioWorkbenchScreen"), appSource.indexOf("function LegacyWorkbenchScreen"));
  const decisionWorkspace = appSource.slice(appSource.indexOf("function PortfolioDecisionWorkspace"), appSource.indexOf("function PortfolioWorkbench({"));
  const preview = appSource.slice(appSource.indexOf("function PortfolioDecisionPreview"), appSource.indexOf("function PortfolioDecisionDrawer"));
  const drawer = appSource.slice(appSource.indexOf("function PortfolioDecisionDrawer"), appSource.indexOf("function PortfolioWorkbench({"));
  assert.match(workbench, /const s003Scope = data\.scenarioContext\?\.scenarioId === "S003"/);
  assert.match(workbench, /s003Scope \? <PortfolioDecisionSourceBoard requests=\{sourceBoardRequests\}/);
  assert.match(workbench, /matchesCommon\(item, true\)/);
  assert.match(workbench, /activeSource=\{sourceFilter\}/);
  assert.match(decisionWorkspace, /s003-drawer-workspace/);
  assert.match(decisionWorkspace, /value: "cards", label: "卡片视图"/);
  assert.match(decisionWorkspace, /!hasS003 && layout === "groups"/);
  assert.match(decisionWorkspace, /hasS003 && layout === "cards"/);
  assert.match(decisionWorkspace, /!hasS003 \? <PortfolioDecisionPreview/);
  assert.match(decisionWorkspace, /hasS003 && selected \? <PortfolioDecisionDrawer/);
  assert.match(preview, /portfolio-decision-preview/);
  assert.match(preview, /查看执行进展/);
  assert.match(drawer, /当前决策事项追溯/);
  assert.match(drawer, /trace\/reminder\/\$\{request\.reminderId\}/);
  assert.match(drawer, /查看追溯/);
  assert.match(drawer, /查看审批流进展/);
  assert.doesNotMatch(drawer, /查看原始行动申请/);
  assert.doesNotMatch(drawer, /请求补充信息/);
  assert.match(drawer, /确认并交办/);
  assert.match(drawer, /className="portfolio-drawer-actions"/);
  assert.match(drawer, /className="portfolio-drawer-scroll"/);
  assert.equal((drawer.match(/variant="primary"/g) || []).length, 1);
  assert.match(drawer, /<DCButton icon="ArrowRight"[\s\S]*?打开完整详情<\/DCButton>/);
  assert.doesNotMatch(drawer, /className="preview-decision-actions"/);
  assert.match(appCssSource, /\.portfolio-decision-workspace\.s003-drawer-workspace \.portfolio-master-detail/);
  assert.match(appCssSource, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(appCssSource, /\.portfolio-decision-drawer/);
  assert.match(appCssSource, /\.portfolio-preview-trace/);
  assert.match(appCssSource, /\.portfolio-drawer-actions[\s\S]*?flex-wrap: nowrap/);
  assert.match(appCssSource, /\.portfolio-decision-drawer \{[^}]*grid-template-rows: auto minmax\(0, 1fr\) auto[^}]*overflow: hidden/s);
  assert.match(appCssSource, /\.portfolio-drawer-scroll \{[^}]*overflow-y: auto/s);
  assert.match(appCssSource, /\.portfolio-decision-drawer \.decision-lifecycle \{[^}]*min-height: 60px[^}]*overflow-y: hidden/s);
  assert.match(appCssSource, /\.portfolio-drawer-actions \{[^}]*min-height: 58px[^}]*overflow-y: hidden/s);
});

test("M04 feedback reduces S003 operations and task pages to task status/list while preserving generic v1.0.3", () => {
  const portfolioOverview = appSource.slice(appSource.indexOf("function PortfolioOperationsOverviewScreen"), appSource.indexOf("function PortfolioRequestDirectoryScreen"));
  const portfolioTasks = appSource.slice(appSource.indexOf("function PortfolioTaskWorkspaceScreen"), appSource.indexOf("function LegacyTaskWorkspaceScreen"));
  const genericOverview = appSource.slice(appSource.indexOf("function LegacyOperationsOverviewScreen"), appSource.indexOf("function TraceStep"));
  const progressModal = appSource.slice(appSource.indexOf("function TaskProgressModal"), appSource.indexOf("function PortfolioWorkbenchScreen"));
  for (const forbidden of [/AISummaryPanel/, /operations-funnel/, /portfolio-exceptions/, /activity-board/, /最近运行记录/, /决策链路异常/]) {
    assert.doesNotMatch(portfolioOverview, forbidden);
  }
  assert.match(portfolioOverview, /任务派发状态/);
  assert.match(portfolioOverview, /category: "all", label: "全部任务"/);
  assert.match(portfolioOverview, /portfolio-ops-task-list/);
  assert.match(portfolioOverview, /最新审批流 \/ 进展/);
  assert.match(portfolioOverview, /查看审批流进展/);
  assert.match(portfolioOverview, /setProgressTaskId\(task\.id\)/);
  assert.doesNotMatch(portfolioOverview, /查看全部任务/);
  assert.match(portfolioTasks, /portfolio-task-summary/);
  assert.match(portfolioTasks, /PortfolioTaskDirectory/);
  assert.match(portfolioTasks, /s003Scope/);
  assert.match(portfolioTasks, /!s003Scope && layout === "groups"/);
  assert.match(portfolioTasks, /最新审批流\/进展/);
  assert.match(portfolioTasks, /查看审批流进展/);
  assert.match(portfolioTasks, /onClick=\{\(\) => onNavigate\(`task\/\$\{task\.id\}`\)\}>查看详情/);
  assert.match(progressModal, /title="审批流与任务进展"/);
  assert.match(progressModal, /footer=\{<DCButton variant="primary" onClick=\{onClose\}>关闭<\/DCButton>\}/);
  assert.doesNotMatch(progressModal, /onOpenTask|打开任务详情|onNavigate/);
  assert.match(appCssSource, /\.portfolio-task-health > div \{ grid-template-columns: repeat\(5/);
  assert.match(genericOverview, /AISummaryPanel/);
  assert.match(genericOverview, /operations-funnel/);
  assert.match(genericOverview, /activity-board/);
});
