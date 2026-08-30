import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(root, "catalog.js"), "utf8");

function loadCatalog() {
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: "catalog.js" });
  return context.window.OFW_V120_CATALOG;
}

test("catalog exposes five scenarios across the nine canonical module directories", () => {
  const catalog = loadCatalog();
  const modules = ["data", "ontology", "query", "decision", "agent", "report", "m07", "modeling", "dashboard"];
  assert.deepEqual(Array.from(catalog.scenarios, (item) => item.scenarioId), ["S001", "S002", "S003", "S004", "S005"]);
  assert.equal(catalog.resources.length, 45);
  modules.forEach((moduleId) => assert.equal(catalog.resourcesFor(moduleId).length, 5));
  assert.deepEqual([...new Set(catalog.resources.map((item) => item.moduleId))], modules);
});

test("every resource carries the unified business catalog fields", () => {
  const catalog = loadCatalog();
  const required = ["id", "moduleId", "scenarioId", "name", "type", "businessDomain", "status", "scenarioStatus", "scenarioArchived", "owner", "asOf", "summary", "refs"];
  catalog.resources.forEach((item) => {
    required.forEach((field) => assert.ok(Object.hasOwn(item, field), `${item.id}.${field}`));
    assert.equal(Array.isArray(item.refs), true, `${item.id}.refs`);
    assert.equal(Object.isFrozen(item), true);
    assert.equal(Object.isFrozen(item.refs), true);
  });
});

test("archived scenario identity is immutable and S005 remains active", () => {
  const catalog = loadCatalog();
  ["S001", "S002", "S003", "S004"].forEach((scenarioId) => {
    const scenario = catalog.scenario(scenarioId);
    assert.equal(scenario.status, "archived");
    assert.equal(scenario.archived, true);
    assert.equal(Object.hasOwn(scenario, "scenarioRunId"), false);
    assert.ok(catalog.resources.filter((item) => item.scenarioId === scenarioId).every((item) => item.scenarioStatus === "archived" && item.scenarioArchived === true));
  });
  const s005 = catalog.scenario("S005");
  assert.equal(s005.status, "active");
  assert.equal(s005.archived, false);
  assert.equal(Object.hasOwn(s005, "scenarioRunId"), false);
  assert.ok(catalog.resources.filter((item) => item.scenarioId === "S005").every((item) => item.scenarioStatus === "active" && item.scenarioArchived === false));
  assert.ok(catalog.resources.filter((item) => item.scenarioId === "S005").every((item) => !["completed", "published", "confirmed"].includes(item.status)));
});

test("S005 exploration and modeling share canonical references", () => {
  const catalog = loadCatalog();
  const m07 = catalog.resource("ofw.v120.m07.s005");
  const m08 = catalog.resource("ofw.v120.modeling.s005");
  assert.equal(m07.objectRef.id, "PRD-223C00000000A5FB");
  assert.equal(m07.objectRef.objectTypeRef, "InvestmentProduct");
  assert.deepEqual(m08.objectRef, m07.objectRef);
  assert.equal(m08.modelingObjectiveRef, "MO-S005-POST-INVESTMENT-RESEARCH-v1");
  assert.equal(m08.dataVersionId, m07.dataVersionId);
  assert.equal(m08.ontologyVersionId, m07.ontologyVersionId);
});
