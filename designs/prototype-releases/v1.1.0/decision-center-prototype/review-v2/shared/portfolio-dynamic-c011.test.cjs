const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function memoryStorage() {
  const values = new Map();
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const scenarioContext = {
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
  formedAt: "2026-08-17T16:30:00.000Z",
  status: "active",
};
const request = {
  schemaVersion: "ofw.s003.c011.action-request.v2",
  id: "AR-S003-DYNAMIC-ENT-019",
  requestId: "AR-S003-DYNAMIC-ENT-019",
  scenarioContext,
  scenarioIdentity: scenarioContext,
  scenario: "债务风险监测",
  sourceType: "report",
  clientWorkspaceVersion: "ofw.dashboard.workspace.v7",
  sourceRef: "债务风险驾驶舱 · S003-C035-ENT-019",
  requester: "集团债务风险管理人员",
  submittedBy: "集团债务风险管理人员",
  requestTime: "2026-08-23 10:00:00",
  generatedTime: "2026-08-23 10:00:00",
  subjectId: "S003-ENT-019",
  subjectName: "环保测试公司3",
  actionType: { id: "S003_RISK_FOLLOW_UP", name: "风险分档跟踪", version: "1.0.2", status: "已发布" },
  metric: { id: "MET-S003-FINAL-RISK-SCORE", name: "企业最终风险评分", value: "37.31 分", evaluatedAt: "2025-12-31", scope: "环保测试公司3 · 环保" },
  evidence: { semanticVersion: "S003-M01-DEBT-RISK-PKG 1.0.2", dataVersion: "S003-T007-DEBT-RISK-20251231-v1", snapshotId: "S003-C035-ENT-019", cutoff: "2025-12-31" },
  decisionRecipient: { enterpriseId: "S003-ENT-019", memberUnitId: "S003-UNIT-019", memberUnitName: "环保测试公司3", recipientId: "S003-CONTACT-019", recipientName: "环保测试公司3债务风险接口人", role: "成员单位债务风险接口人" },
  recommendedTaskOwner: "环保测试公司3债务风险责任人",
  idempotencyKey: "S003-RUN|S003-ENT-019|S003_RISK_FOLLOW_UP|2025-12-31|1.1.0",
};
const inbox = { schemaVersion: "ofw.s003.c011.dashboard-inbox.v2", contractCode: "C011", scenarioContext, formedAt: "2026-08-23T10:00:00.000Z", requests: [request] };
const c017 = {
  contractCode: "C017",
  consumer: "决策中心",
  scenarioContext,
  projections: [{
    dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
    scenarioContext,
    gates: {
      request_receipt: {
        currentStateSummary: { id: "C017-S003-CURRENT", version: "current-2", formedAt: "2026-08-17T16:32:00.000Z" },
        qualityStatus: "允许推进",
        hardQualityFailure: false,
        reason: "当前摘要未标记硬质量失败",
        evidenceLocator: "C017/S003/request_receipt",
      },
    },
  }],
};

const storage = memoryStorage();
const c011PhysicalKey = `ofw:v1.1.0:${scenarioContext.scenarioId}:${scenarioContext.scenarioVersion}:${scenarioContext.scenarioRunId}:m04:${encodeURIComponent("decision-center.c011.inbox.v3")}`;
storage.setItem(c011PhysicalKey, JSON.stringify({
  schemaVersion: "ofw.namespaced-storage.v1",
  scenarioContext,
  savedAt: inbox.formedAt,
  payload: inbox,
}));
const window = {
  location: new URL("http://127.0.0.1/decision-center-prototype/review-v2/action-portfolio.html"),
  history: {
    state: null,
    replaceState(state, _title, next) {
      this.state = state;
      window.location = new URL(String(next), window.location);
    },
  },
  localStorage: storage,
  OFW_COMPOSITE_REGISTRY: {
    scenes: [{ scenarioId: "S001", name: "融资成本" }, { scenarioId: "S003", name: "债务风险监测" }],
    dataEngineering: {
      S003: { sourceVersionAliases: { "S003-T007-FORMAL-CANDIDATE-20251231-v1": "S003-T007-DEBT-RISK-20251231-v1" } },
    },
  },
  S003DecisionAdapter: {
    async hydrateNativeState(base) { return { ...base, requests: [], tasks: [], receipts: [], activity: [] }; },
    readContractRecord(_context, kind) { return kind === "c017" ? c017 : null; },
  },
};
const context = { window, URL, URLSearchParams, Date, console, Object, JSON, Map, Set, Promise };
vm.createContext(context);
const source = fs.readFileSync(path.join(__dirname, "portfolio-integration.js"), "utf8");
vm.runInContext(source, context, { filename: "portfolio-integration.js" });

(async () => {
  let state = await window.OFW_DECISION_PORTFOLIO.bootstrap();
  let dynamic = state.requests.filter((item) => item.id === request.id);
  assert.equal(dynamic.length, 1);
  assert.equal(dynamic[0].status, "awaiting");
  assert.equal(dynamic[0].requestGate.status, "accepted");
  assert.equal(dynamic[0].c017SafetyReads[0].versionAliasApplied, true);
  assert.equal(dynamic[0].taskId, null, "组合收件不得直接创建负责人待办");
  assert.equal(state.tasks.some((item) => item.requestId === request.id), false);

  state = await window.OFW_DECISION_PORTFOLIO.bootstrap();
  dynamic = state.requests.filter((item) => item.id === request.id);
  assert.equal(dynamic.length, 1, "重复启动必须幂等合并同一行动申请");

  const stored = JSON.parse(storage.getItem(window.OFW_DECISION_PORTFOLIO.storageKey));
  stored.requests = stored.requests.map((item) => item.id === request.id ? { ...item, status: "confirmed", decision: { type: "confirm" }, taskId: "TD-S003-DYNAMIC" } : item);
  stored.tasks.push({ id: "TD-S003-DYNAMIC", requestId: request.id, scenarioId: "S003", scenarioContext, status: "pending" });
  storage.setItem(window.OFW_DECISION_PORTFOLIO.storageKey, JSON.stringify(stored));
  state = await window.OFW_DECISION_PORTFOLIO.bootstrap();
  const preserved = state.requests.find((item) => item.id === request.id);
  assert.equal(preserved.status, "confirmed", "已有人工决定必须优先于重复动态收件");
  assert.equal(preserved.taskId, "TD-S003-DYNAMIC");
  assert.equal(state.tasks.filter((item) => item.id === "TD-S003-DYNAMIC").length, 1);

  console.log("portfolio dynamic C011 passed: C017 gate, idempotency, progressed decision preservation");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
