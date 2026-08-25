"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const SOURCES = [
  "foundation/ofw-scenario-foundation.js",
  "scenarios/s003/domain/query-service.js",
  "intelligent-query-prototype/review-next/conversation-workspace/data.jsx",
  "intelligent-query-prototype/review-next/conversation-workspace/s003-native-bridge.js"
];
const FORMAL_RUN_ID = "S003-RUN-20260817163000000-c02200000001";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }
  get length() {
    return this.values.size;
  }
  key(index) {
    return [...this.values.keys()][index] ?? null;
  }
  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  setItem(key, value) {
    this.values.set(key, String(value));
  }
  removeItem(key) {
    this.values.delete(key);
  }
  keys() {
    return [...this.values.keys()];
  }
}

function queryString(runId, status = "active") {
  return `?scenarioId=S003&scenarioVersion=S003-v1&scenarioRunId=${runId}&scenarioContextFormedAt=2026-08-17T16%3A30%3A00.000Z&scenarioStatus=${status}`;
}

function createHarness(search, storage = new MemoryStorage()) {
  const listeners = new Map();
  const sandbox = {
    console,
    URLSearchParams,
    Intl,
    setTimeout,
    clearTimeout,
    location: {search},
    localStorage: storage,
    IQ_VARIANT: {id: "conversation", name: "对话工作区", storageKey: "ontology3.iq.review.conversation.v1"},
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    addEventListener(type, listener) {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener));
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).slice().forEach((listener) => listener(event));
      return true;
    },
    async fetch(url) {
      const relative = String(url).replace(/^\.\.\/\.\.\/\.\.\//, "");
      const filePath = path.join(WORKSPACE_ROOT, relative);
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(fs.readFileSync(filePath, "utf8"));
        }
      };
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  SOURCES.forEach((relative) => {
    const source = fs.readFileSync(path.join(WORKSPACE_ROOT, relative), "utf8");
    vm.runInContext(source, sandbox, {filename: relative});
  });
  return {sandbox, storage};
}

test("S003 六个问题进入原生固定结果、证据和运行历史所需结构", async () => {
  const {sandbox, storage} = createHarness(queryString(FORMAL_RUN_ID));
  const status = await sandbox.S003IQNativeBridge.readyPromise();
  assert.equal(status.status, "ready");
  assert.equal(status.error, null);

  const D = sandbox.IQDomain;
  const state = D.loadState(sandbox.IQ_VARIANT.storageKey);
  const context = D.readRuntimeContext();
  assert.equal(state.currentScenario, "S003");
  assert.equal(state.scenarioContext.runId, FORMAL_RUN_ID);
  assert.equal(state.activeConfig.actionRequestForbidden, true);
  assert.equal(state.activeConfig.allowedActions.includes("提交标准 Action Request"), false);
  assert.equal(context.versionId, "S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.equal(context.dataVersion, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  assert.equal(context.t019RecordId, "S003-M01-RECORD-ADOPT");
  assert.equal(context.t019EvidenceCode, "S003-M01-PUBLISHED-POINTER");

  const questions = [
    "当前集团各风险等级有多少家企业？",
    "哪些企业处于红灯或黑灯？",
    "风电测试公司01本轮债务风险评估详情是什么？",
    "风电测试公司01本轮评分最低的三项指标是什么？",
    "哪些企业因子采用了缺失套零或不适用语义？",
    "当前有哪些待成员单位接口人确认的亮灯预警？"
  ];
  const runs = questions.map((question) => {
    const templateId = D.resolveQuestion(question);
    const questionGate = sandbox.S003IQNativeBridge.validateQuestion(question, templateId, null, null);
    assert.equal(questionGate.passed, true, question);
    const runId = D.nextStableId("RUN");
    const result = D.materializeResult(templateId, context, runId, questionGate.queryContext);
    const verification = D.verifyFixedResult(result, context, state.activeConfig);
    assert.equal(verification.passed, true, `${question}: ${verification.issues.join("；")}`);
    assert.equal(result.s003NativeResult, true);
    assert.equal(result.projectionOnly, false);
    assert.deepEqual(JSON.parse(JSON.stringify(result.sideEffects)), {
      mutatesPublishedFacts: false,
      createsActionRequest: false,
      createsTodo: false,
      sendsNotification: false
    });
    assert.ok(result.rows.every((row) => row.evidenceId));
    return {id: runId, status: "成功", context, result};
  });

  D.saveState(sandbox.IQ_VARIANT.storageKey, {...state, liveRuns: runs});
  assert.ok(storage.keys().some((key) => key.includes(`:${FORMAL_RUN_ID}:m03:workspace%2Fstate`)));
  assert.equal(storage.getItem("ontology3.iq.review.conversation.v1"), null);
  assert.equal(D.actionEligibility(runs[0], state.activeConfig, state.scenarioContext).allowed, false);
  assert.equal(D.publishActionRequestInbox([], context).published, false);
});

test("S003 M03 使用 M01 原生版本身份和 T019 数据资产版本，不把 C035 结果集版本冒充数据版本", () => {
  const source = fs.readFileSync(path.join(WORKSPACE_ROOT, "intelligent-query-prototype/review-next/conversation-workspace/s003-native-bridge.js"), "utf8");
  assert.match(source, /publishedVersionId\(target\.packageVersion\)/);
  assert.match(source, /data\.c035\.inputIdentity\?\.dataAssetId/);
  assert.match(source, /t019RecordId = "S003-M01-RECORD-ADOPT"/);
  assert.match(source, /#published\/ontology/);
  assert.doesNotMatch(source, /#published\/s003-debt-risk-model/);
});

test("企业详情问题缺少企业身份时在创建运行前阻断", async () => {
  const {sandbox} = createHarness(queryString(FORMAL_RUN_ID));
  await sandbox.S003IQNativeBridge.readyPromise();
  const gate = sandbox.S003IQNativeBridge.validateQuestion(
    "指定企业本轮债务风险评估详情是什么？",
    "S003-QRY-003",
    null,
    null
  );
  assert.equal(gate.passed, false);
  assert.match(gate.reason, /必须明确一家企业/);
});

test("不同 scenarioRunId 物理隔离，非正式运行不能消费静态 Published 结果", async () => {
  const storage = new MemoryStorage();
  const formal = createHarness(queryString(FORMAL_RUN_ID), storage);
  assert.equal((await formal.sandbox.S003IQNativeBridge.readyPromise()).status, "ready");
  const formalState = formal.sandbox.IQDomain.loadState();
  formal.sandbox.IQDomain.saveState(null, {...formalState, draftQuestion: "正式轮次"});

  const projectionRunId = "S003-RUN-20260816120000000-abcdef123456";
  const projection = createHarness(queryString(projectionRunId), storage);
  const status = await projection.sandbox.S003IQNativeBridge.readyPromise();
  assert.equal(status.status, "error");
  assert.match(status.error, /运行身份不一致/);
  const projectionState = projection.sandbox.IQDomain.loadState();
  projection.sandbox.IQDomain.saveState(null, {...projectionState, draftQuestion: "工作投影轮次"});

  const keys = storage.keys().filter((key) => key.endsWith(":m03:workspace%2Fstate"));
  assert.equal(keys.length, 2);
  assert.ok(keys.some((key) => key.includes(`:${FORMAL_RUN_ID}:`)));
  assert.ok(keys.some((key) => key.includes(`:${projectionRunId}:`)));
  assert.equal(projection.sandbox.IQDomain.readRuntimeContext().ready, false);
});

test("历史只读场景可读原轮次状态但不再写入", async () => {
  const storage = new MemoryStorage();
  const active = createHarness(queryString(FORMAL_RUN_ID), storage);
  await active.sandbox.S003IQNativeBridge.readyPromise();
  const state = active.sandbox.IQDomain.loadState();
  active.sandbox.IQDomain.saveState(null, {...state, draftQuestion: "历史保留"});
  const before = JSON.stringify([...storage.values.entries()]);

  const historical = createHarness(queryString(FORMAL_RUN_ID, "historical-readonly"), storage);
  await historical.sandbox.S003IQNativeBridge.readyPromise();
  const historicalState = historical.sandbox.IQDomain.loadState();
  assert.equal(historicalState.draftQuestion, "历史保留");
  historical.sandbox.IQDomain.saveState(null, {...historicalState, draftQuestion: "不得覆盖"});
  assert.equal(JSON.stringify([...storage.values.entries()]), before);
  assert.equal(historical.sandbox.IQDomain.readRuntimeContext().allowConsumption, false);
});

test("restored、regression 和 closed 上下文均保持只读且不能正式问数", async () => {
  for (const status of ["restored", "regression", "closed"]) {
    const storage = new MemoryStorage();
    const active = createHarness(queryString(FORMAL_RUN_ID), storage);
    await active.sandbox.S003IQNativeBridge.readyPromise();
    const activeState = active.sandbox.IQDomain.loadState();
    active.sandbox.IQDomain.saveState(null, {...activeState, draftQuestion: "原投影"});
    const before = JSON.stringify([...storage.values.entries()]);

    const readonly = createHarness(queryString(FORMAL_RUN_ID, status), storage);
    await readonly.sandbox.S003IQNativeBridge.readyPromise();
    const context = readonly.sandbox.IQDomain.readRuntimeContext();
    assert.equal(context.allowConsumption, false, status);
    assert.equal(context.formalAnswerable, false, status);
    const gate = readonly.sandbox.S003IQNativeBridge.validateQuestion("当前集团各风险等级有多少家企业？", "S003-QRY-001", null, null);
    assert.equal(gate.passed, false, status);
    readonly.sandbox.IQDomain.saveState(null, {...readonly.sandbox.IQDomain.loadState(), draftQuestion: "不得写入"});
    assert.equal(JSON.stringify([...storage.values.entries()]), before, status);
  }
});

test("不兼容 M03 投影原位隔离并向页面暴露明确恢复提示", async () => {
  const storage = new MemoryStorage();
  const key = `ofw:v1.1.0:S003:S003-v1:${FORMAL_RUN_ID}:m03:workspace%2Fstate`;
  const recoveryKey = `ofw:v1.1.0:S003:S003-v1:${FORMAL_RUN_ID}:m03:workspace%2Fstate.recovered.v1`;
  storage.setItem(key, JSON.stringify({
    schemaVersion: "ofw.namespaced-storage.v0",
    scenarioContext: {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: FORMAL_RUN_ID,
      formedAt: "2026-08-17T16:30:00.000Z",
      status: "active"
    },
    payload: {draftQuestion: "旧投影不得消费"}
  }));
  const harness = createHarness(queryString(FORMAL_RUN_ID), storage);
  await harness.sandbox.S003IQNativeBridge.readyPromise();
  const state = harness.sandbox.IQDomain.loadState();
  assert.equal(state.draftQuestion, "");
  assert.equal(state.s003ProjectionIssue.isolated, true);
  assert.match(state.s003ProjectionIssue.reason, /schemaVersion 不兼容/);
  const originalRaw = storage.getItem(key);
  harness.sandbox.IQDomain.saveState(null, state);
  assert.equal(storage.getItem(key), originalRaw, "React 首次自动保存后原不兼容记录仍必须原位保留");
  assert.ok(storage.getItem(recoveryKey), "从 Published 重建的当前工作投影必须写入独立逻辑键");
  const recovered = JSON.parse(storage.getItem(recoveryKey));
  assert.equal(recovered.payload.s003ProjectionIssue.rebuiltLogicalKey, "workspace/state.recovered.v1");
});

test("旧版预置问数结果退出历史会话但保留为可审计迁移记录", async () => {
  const {sandbox} = createHarness(queryString(FORMAL_RUN_ID));
  await sandbox.S003IQNativeBridge.readyPromise();
  const D = sandbox.IQDomain;
  const current = D.loadState();
  const legacyRun = {
    id: "S003-M03-HISTORY-001",
    status: "成功",
    createdAt: "2026-08-15 13:40:00",
    context: {
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      scenarioRunId: FORMAL_RUN_ID
    },
    result: {title: "旧版预置问数结果"}
  };

  D.saveState(null, {...current, historyRuns: [legacyRun], currentRunId: legacyRun.id});
  const migrated = D.loadState();

  assert.equal(migrated.historyRuns.filter((run) => run.recordType === "published-fixed-result").length, 3);
  assert.equal(migrated.historyRuns.some((run) => run.id === legacyRun.id), false);
  assert.equal(migrated.currentRunId, null);
  assert.equal(migrated.legacyPublishedExampleRuns.length, 1);
  assert.equal(migrated.legacyPublishedExampleRuns[0].id, legacyRun.id);
  assert.equal(migrated.legacyPublishedExampleRuns[0].projectionStatus, "reclassified");
  assert.match(migrated.legacyPublishedExampleRuns[0].reclassificationReason, /缺少真实执行身份/);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated.s003HistoryMigration)), {
    status: "reclassified",
    count: 1,
    reason: "旧版预置结果不再冒充真实历史；原记录保留在 legacyPublishedExampleRuns。"
  });
});

test("封存 query-results 投影三条只读正式联调记录且真实用户运行仍独立追加", async () => {
  const {sandbox} = createHarness(queryString(FORMAL_RUN_ID));
  await sandbox.S003IQNativeBridge.readyPromise();
  const D = sandbox.IQDomain;
  const state = sandbox.S003IQNativeBridge.hydrateExperience(D.loadState());
  const resultSet = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "scenarios/s003/resources/m03/query-results.v2.json"), "utf8"));
  const formalRuns = state.historyRuns.filter((run) => run.recordType === "published-fixed-result");

  assert.equal(formalRuns.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(formalRuns.map((run) => run.sourceQueryId))), ["S003-QRY-001", "S003-QRY-002", "S003-QRY-003"]);
  formalRuns.forEach((run) => {
    assert.equal(run.id, `S003-M03-FORMAL-RUN:${resultSet.resultSetId}:${run.sourceQueryId}`);
    assert.equal(run.sourceResultSetId, resultSet.resultSetId);
    assert.equal(run.sourceResultSetVersion, resultSet.resultSetVersion);
    assert.equal(run.sourceFormedAt, resultSet.formedAt);
    assert.equal(run.createdAt, resultSet.formedAt);
    assert.equal(run.completedAt, resultSet.formedAt);
    assert.equal(run.userSession, false);
    assert.equal(run.readOnly, true);
    assert.equal(run.past, true);
    assert.equal(run.immutableSource, true);
    assert.equal(run.canRerunAgainstCurrentVersion, true);
    assert.equal(run.context.scenarioId, resultSet.scenarioIdentity.scenarioId);
    assert.equal(run.context.scenarioVersion, resultSet.scenarioIdentity.scenarioVersion);
    assert.equal(run.context.scenarioRunId, resultSet.scenarioIdentity.scenarioRunId);
    assert.deepEqual(JSON.parse(JSON.stringify(run.sideEffects)), {
      mutatesPublishedFacts: false,
      createsActionRequest: false,
      createsTodo: false,
      sendsNotification: false
    });
    assert.equal(run.result.sourceResultSetId, resultSet.resultSetId);
    assert.equal(run.result.sourceQueryId, run.sourceQueryId);
    assert.equal(D.verifyFixedResult(run.result, run.context, run.configSnapshot).passed, true);
  });
  assert.equal(formalRuns[2].question, "风电测试公司01本轮债务风险评估详情是什么？");
  assert.equal(formalRuns[2].originalQuestion, "指定企业本轮债务风险评估详情是什么？");

  const context = D.readRuntimeContext();
  const userRunId = "RUN-S003-USER-APPEND-001";
  const question = "当前集团各风险等级有多少家企业？";
  const queryContext = sandbox.S003IQNativeBridge.prepareQueryContext(question, null, null);
  const userRun = {
    id: userRunId,
    question,
    originalQuestion: question,
    finalQuestion: question,
    templateId: "S003-QRY-001",
    status: "成功",
    createdAt: "2026-08-16 12:00:00",
    completedAt: "2026-08-16 12:00:00",
    context,
    configSnapshot: state.activeConfig,
    queryContext,
    result: D.materializeResult("S003-QRY-001", context, userRunId, queryContext)
  };
  D.saveState(null, {...state, liveRuns: [userRun]});
  const reloaded = D.loadState();
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.liveRuns.map((run) => run.id))), [userRunId]);
  assert.equal(reloaded.historyRuns.filter((run) => run.recordType === "published-fixed-result").length, 3);
  assert.equal(new Set(reloaded.historyRuns.map((run) => run.id)).size, reloaded.historyRuns.length);
});

test("S003 Published 资源保留回到 M01 基线场景视图的深链", async () => {
  const {sandbox} = createHarness(queryString(FORMAL_RUN_ID));
  await sandbox.S003IQNativeBridge.readyPromise();
  const context = sandbox.IQDomain.readRuntimeContext();
  const href = sandbox.IQDomain.buildOntologyDeepLink(context, "S003-M01-DEBT-RISK-PKG");
  assert.match(href, /ontology-management-review\/canvas-first\/index\.html/);
  assert.match(href, /scenarioRunId=S003-RUN-/);
  assert.match(href, /#published\/ontology\?id=S003-M01-DEBT-RISK-PKG&version=S003-M01-DEBT-RISK-PKG%401.0.2$/);
  assert.equal(sandbox.IQDomain.buildOntologyDeepLink(context, "S003-C035-RISK-RESULTS-20251231-v2"), null);
});

test("M03 将 S003 内容装入原生推荐、问数视图、原子语义资源和 Agent 配置", async () => {
  const {sandbox} = createHarness(queryString(FORMAL_RUN_ID));
  await sandbox.S003IQNativeBridge.readyPromise();
  const hydrated = sandbox.S003IQNativeBridge.hydrateExperience(sandbox.IQDomain.loadState());
  assert.equal(hydrated.activeConfig.name, "债务风险问数助手");
  assert.equal(hydrated.activeConfig.bindingVersion, "1.0.2 · S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.equal(hydrated.activeConfig.bindingVersionId, "S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.equal(hydrated.activeConfig.c009Validation.status, "通过");
  assert.equal(hydrated.recommendations.status, "成功");
  assert.equal(hydrated.recommendations.items.length, 6);
  assert.equal(hydrated.historyRuns.filter((run) => run.recordType === "published-fixed-result").length, 3, "只投影封存的正式联调执行证据");
  assert.ok(hydrated.historyRuns.filter((run) => run.recordType === "published-fixed-result").every((run) => run.userSession === false));
  assert.equal(hydrated.savedViews.filter((view) => view.publishedExample).length, 6);
  assert.ok(hydrated.savedViews.filter((view) => view.publishedExample).every((view) => view.lastRunId === null));
  assert.ok(hydrated.savedViews.filter((view) => view.publishedExample).every((view) => view.sourceLabel === "Published 问题示例"));
  const context = sandbox.IQDomain.readRuntimeContext();
  const resourceTypes = new Set(context.resources.map((item) => item.type));
  ["Object Type", "Property", "Metric", "Rule", "Action Type"].forEach((type) => assert.ok(resourceTypes.has(type), type));
  assert.equal(context.resources.filter((item) => item.type === "Metric").length, 16);
  assert.equal(context.resources.filter((item) => item.type === "Rule").length, 13);
  assert.equal(context.resources.filter((item) => item.type === "Action Type").length, 3);
  const configValidation = sandbox.IQDomain.validateFixedQuestionSet(hydrated.activeConfig, context);
  assert.equal(configValidation.passed, true, configValidation.issues.join("；"));
  assert.equal(configValidation.questions.length, 6);
  assert.ok(configValidation.questions.every((item) => item.id.startsWith("S003-CVQ-") && item.status === "通过"));
  const candidateValidation = sandbox.IQDomain.validateCandidateFixedQuestionSet(context, "S003-M03-CANDIDATE-CHECK", {configSnapshot: hydrated.activeConfig});
  assert.equal(candidateValidation.passed, true, candidateValidation.issues.join("；"));
  assert.equal(candidateValidation.questions.length, 6);
  assert.ok(candidateValidation.questions.every((item) => item.templateId.startsWith("S003-QRY-") && item.status === "通过"));

  const catalog = JSON.parse(fs.readFileSync(path.join(WORKSPACE_ROOT, "scenarios/s003/resources/m03/query-catalog.v3.json"), "utf8"));
  assert.deepEqual(
    catalog.queries.map((item) => ({queryId: item.queryId, question: item.question, resultShape: item.resultShape})),
    JSON.parse(JSON.stringify(sandbox.S003QueryService.QUERY_DEFINITIONS.map((item) => ({queryId: item.queryId, question: item.question, resultShape: item.resultShape}))))
  );

  const appSource = fs.readFileSync(path.join(WORKSPACE_ROOT, "intelligent-query-prototype/review-next/conversation-workspace/app.jsx"), "utf8");
  const adapterSource = fs.readFileSync(path.join(WORKSPACE_ROOT, "intelligent-query-prototype/review-next/conversation-workspace/s003-adapter.jsx"), "utf8");
  const bridgeSource = fs.readFileSync(path.join(WORKSPACE_ROOT, "intelligent-query-prototype/review-next/conversation-workspace/s003-native-bridge.js"), "utf8");
  assert.match(appSource, /ask: \{ label: "问数工作台"/);
  assert.match(appSource, /semantics: \{ label: "语义资源"/);
  assert.match(appSource, /history: \{ label: "历史会话"/);
  assert.match(appSource, /views: \{ label: "问数视图"/);
  assert.match(appSource, /agent: \{ label: "Agent 配置"/);
  assert.doesNotMatch(appSource, /<S003Projection/);
  assert.doesNotMatch(appSource, /S003PublishedViews/);
  assert.match(appSource, /hydrateExperience/);
  assert.match(appSource, /当前问数助手：/);
  assert.match(appSource, /债务风险候选消费验证题集/);
  assert.match(appSource, /正式消费链/);
  assert.doesNotMatch(adapterSource, /function PublishedViews/);
  assert.match(appSource, /Published 问题示例/);
  assert.match(appSource, /正式联调执行记录 · 非用户会话/);
  assert.match(appSource, /查看 Published 固定结果/);
  assert.match(appSource, /按当前版本重新运行/);
  assert.match(appSource, /点击可查看边界详情/);
  assert.match(bridgeSource, /queryServiceApi\?\.QUERY_DEFINITIONS/);
  assert.match(bridgeSource, /definitionSource: "S003QueryService\.QUERY_DEFINITIONS"/);
  assert.doesNotMatch(bridgeSource, /id:\s*[`"]S003-M03-HISTORY-/);
  assert.doesNotMatch(bridgeSource, /const RECOMMENDED_QUESTIONS = Object\.freeze\(\[/);
});
