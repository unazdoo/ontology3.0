import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const portfolio = JSON.parse(read("modules/m07/resources/portfolio.json"));
const master = JSON.parse(read("resources/enterprise-master.json"));
function runtime() {
  const store = new Map();
  const sandbox = { console, URLSearchParams, location: { search: "" }, localStorage: { getItem: (key) => store.get(key), setItem: (key, value) => store.set(key, value) }, sessionStorage: { getItem: () => null, setItem() {} }, dispatchEvent() {}, CustomEvent: class {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of ["resources/enterprise-master.js", "shared/workflow.js"]) vm.runInContext(read(file), sandbox);
  return sandbox;
}

test("21 unique enterprise objects replace the three duplicate financing nodes", () => {
  assert.equal(master.enterprises.length, 21);
  assert.equal(portfolio.objects.filter((item) => item.enterpriseId).length, 21);
  assert.equal(portfolio.objects.length, 71);
  assert.equal(new Set(portfolio.objects.map((item) => item.id)).size, 71);
  assert.equal(portfolio.objects.filter((item) => item.objectTypeId === "m01.object-type.financing-entity").length, 0);
});

test("all financing, model, decision and risk aliases resolve to the same enterprise", () => {
  const W = runtime().OFW_WORKFLOW;
  for (const alias of ["s001.entity.553", "financing::s001.entity.553", "UNIT-553", "单位553", "FinancingEntity-002", "S003-ENT-020", "risk::S003-ENT-020"]) assert.equal(W.canonicalId(alias), "ENT-020");
  assert.equal(W.canonicalId("s001.entity.465"), "ENT-007");
  assert.equal(W.canonicalId("s001.entity.561"), "ENT-017");
  assert.equal(W.canonicalId("LoanApplicant-001"), "LoanApplicant-001");
});

test("all active relationships, events and series reference existing objects after consolidation", () => {
  const ids = new Set(portfolio.objects.map((item) => item.id));
  for (const link of portfolio.links) { assert.ok(ids.has(link.from), link.id); assert.ok(ids.has(link.to), link.id); }
  for (const series of portfolio.series) assert.ok(ids.has(series.ownerObjectId), series.id);
  for (const event of portfolio.events) assert.ok(ids.has(event.objectId || event.ownerObjectId), event.id);
  assert.equal(portfolio.links.length, 67);
  assert.equal(portfolio.series.length, 39);
});

test("merged financing and risk facts retain their original version and values", () => {
  const entity = portfolio.objects.find((item) => item.id === "ENT-020");
  assert.equal(entity.properties.averageFinancingCost.value, 2.880984);
  assert.equal(entity.properties.balance.value, 393.134);
  assert.equal(entity.properties.riskScore.value, 23.05);
  assert.equal(entity.properties.averageFinancingCost.sourceScenarioId, "S001");
  assert.equal(entity.properties.riskScore.sourceScenarioId, "S003");
  assert.equal(entity.sourceFacets.S001.canonicalObjectRef.id, "s001.entity.553");
  assert.equal(entity.sourceFacets.S003.canonicalObjectRef.id, "S003-ENT-020");
  assert.notEqual(entity.properties.averageFinancingCost.dataVersionId, entity.properties.riskScore.dataVersionId);
});

test("coordinates are distributed, in China city ranges and explicitly synthetic", () => {
  const coordinates = new Set();
  for (const entity of master.enterprises) {
    const [lon, lat] = entity.location.geometry.coordinates;
    assert.ok(lon >= 73 && lon <= 135 && lat >= 18 && lat <= 54, entity.id);
    assert.equal(entity.location.authoritativeAddress, false);
    assert.equal(entity.location.kind, "DEMO_CITY_PLACEMENT");
    coordinates.add(`${lon},${lat}`);
  }
  assert.equal(coordinates.size, 21);
  assert.equal(portfolio.objects.filter((item) => item.properties?.geometry?.value).length, 32);
  assert.equal(portfolio.objects.filter((item) => item.location?.kind === "DEMO_CITY_PLACEMENT").length, 30);
  assert.ok(Math.max(...master.enterprises.map((item) => item.location.geometry.coordinates[0])) - Math.min(...master.enterprises.map((item) => item.location.geometry.coordinates[0])) > 25);
});

test("no financing values are invented for enterprises without a financing source", () => {
  const uncovered = portfolio.objects.filter((item) => item.enterpriseId && !item.sourceFacets.S001);
  assert.equal(uncovered.length, 18);
  for (const entity of uncovered) { assert.equal(entity.properties.averageFinancingCost, undefined); assert.equal(entity.properties.financingCoverage.value, "暂未提供融资数据"); }
});

test("host selection deduplicates aliases while preserving the requested business view", () => {
  const sandbox = runtime();
  for (const file of ["s001-e2e-integration/data.js", "s001-e2e-integration/state.js"]) vm.runInContext(read(file), sandbox);
  const store = sandbox.OFW_V131_STORE;
  store.updateWorkspaceContext({ scenarioId: "S001", activeObjectRef: { id: "UNIT-553", scenarioId: "S001" }, objectSetRef: { selectionMode: "EXPLICIT", count: 2, objectIds: ["UNIT-553", "S003-ENT-020"] } });
  assert.equal(store.workspaceContext().activeObjectRef.id, "ENT-020");
  assert.equal(store.workspaceContext().objectSetRef.count, 1);
  assert.equal(store.get().activeScenarioId, "S001");
});

test("model consumers match both domains through the master without changing source envelopes", () => {
  const W = runtime().OFW_WORKFLOW;
  const finance = [{ subjectId: "FinancingEntity-002", score: 68 }, { subjectId: "FinancingEntity-003", score: 74 }];
  const risk = [{ enterpriseId: "S003-ENT-020", score: 23.05 }];
  const scope = { activeObjectRef: { id: "ENT-020" } };
  assert.equal(W.scopeRows(finance, scope)[0].score, 68);
  assert.equal(W.scopeRows(risk, scope)[0].score, 23.05);
  assert.equal(finance[0].subjectId, "FinancingEntity-002");
  assert.equal(risk[0].enterpriseId, "S003-ENT-020");
  assert.match(read("modules/m07/app.js"), /closest\("button\[data-lens\]"\)/);
});
