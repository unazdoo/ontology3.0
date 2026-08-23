import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); },
  };
}

const legacyS001 = JSON.stringify({ contractCode: "C011", scenarioContext: { scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-LOCKED" }, requests: [{ id: "AR-S001-KEEP" }] });
const storage = memoryStorage({ "ontology3.decision-center.c011.inbox.v1": legacyS001 });
const nodes = new Map();
const document = {
  getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { id, innerHTML: "", className: "", classList: { add() {}, remove() {}, contains() { return false; } } });
    return nodes.get(id);
  },
  addEventListener() {},
};
const window = {
  __OFW_DASHBOARD_SKIP_RENDER__: true,
  RC_PORTFOLIO: { data: {} },
  localStorage: storage,
  location: { hash: "#/dashboards" },
  addEventListener() {},
  setTimeout,
  clearTimeout,
  scrollTo() {},
};
const context = {
  window,
  document,
  localStorage: storage,
  location: window.location,
  addEventListener() {},
  setTimeout,
  clearTimeout,
  console,
  URLSearchParams,
  Date,
};
vm.createContext(context);
vm.runInContext(read("./data.js"), context, { filename: "data.js" });
vm.runInContext(read("./app.js"), context, { filename: "app.js" });

const api = window.OFW_RISK_DASHBOARD_TEST_API;
const risk = window.DASHBOARD_DATA.dashboards.find((item) => item.id === "risk");
assert.ok(api, "风险工作流测试接口未装入");
assert.equal(risk.actions.length, 5);
assert.equal(api.validateRiskModelDraft().ok, true);
assert.equal(api.riskActionRecord(risk.actions.find((item) => item.enterpriseId === "S003-ENT-020")).stage, "handled");
assert.equal(api.riskActionRecord(risk.actions.find((item) => item.enterpriseId === "S003-ENT-007")).stage, "submitted");
assert.equal(api.riskActionRecord(risk.actions.find((item) => item.enterpriseId === "S003-ENT-019")).stage, "pending");
assert.equal(api.riskIndustry(risk.companies.find((item) => item.enterpriseId === "S003-ENT-010")), "新能源产业-风电");
assert.equal(api.modelHasChanges(), false);

api.state.riskModelDraft.weights["环保"][0] = 9;
assert.equal(api.modelHasChanges(), true);
let validation = api.validateRiskModelDraft();
assert.equal(validation.ok, false);
assert.ok(validation.errors.some((item) => item.includes("权重合计")));
api.state.riskModelDraft.weights["环保"][0] = 5;
assert.equal(api.modelHasChanges(), false);

api.state.riskModelDraft.tiers.find((item) => item.tierId === "YELLOW").minInclusive = 45;
validation = api.validateRiskModelDraft();
assert.equal(validation.ok, false);
assert.ok(validation.errors.some((item) => item.includes("阈值顺序")));
api.state.riskModelDraft.tiers.find((item) => item.tierId === "YELLOW").minInclusive = 25;

const item = risk.actions.find((candidate) => candidate.enterpriseId === "S003-ENT-019");
const request = api.buildRiskActionRequest(item, new Date("2026-08-23T10:00:00.000Z"));
assert.equal(request.sourceType, "report");
assert.equal(request.schemaVersion, "ofw.s003.c011.action-request.v2");
assert.equal(request.clientWorkspaceVersion, "ofw.dashboard.workspace.v7");
assert.equal(request.actionType.status, "已发布");
assert.equal(request.decisionRecipient.role, "成员单位债务风险接口人");
assert.equal(request.taskId, null);
assert.equal(request.decision, null);
assert.equal(request.evidence.dataVersion, "S003-T007-DEBT-RISK-20251231-v1");

api.writeRiskActionRequest(request);
api.writeRiskActionRequest(request);
const physicalKey = `ofw:v1.1.0:S003:S003-v1:${api.context.scenarioRunId}:m04:${encodeURIComponent("decision-center.c011.inbox.v3")}`;
const envelope = JSON.parse(storage.getItem(physicalKey));
assert.equal(envelope.payload.contractCode, "C011");
assert.equal(envelope.payload.schemaVersion, "ofw.s003.c011.dashboard-inbox.v2");
assert.equal(envelope.payload.requests.length, 1, "重复提交必须保持同标识幂等");
assert.equal(storage.getItem("ontology3.decision-center.c011.inbox.v1"), legacyS001, "不得覆盖其他场景旧收件包");

console.log("risk workflow passed: 5 independent candidates, C011 idempotency, model validation gates");
