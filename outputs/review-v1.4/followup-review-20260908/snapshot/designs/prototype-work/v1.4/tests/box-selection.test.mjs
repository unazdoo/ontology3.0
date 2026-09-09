import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterEnterprises, query } from "../src/domain.js";
import {
  createStore,
  defaultFilters,
  validateRestoredState,
} from "../src/store.js";
const data = JSON.parse(
  readFileSync(new URL("../public/data/portfolio.json", import.meta.url)),
);
test("box selection intersects rather than overwrites the original enterprise scope", () => {
  const base = {
      ...defaultFilters(),
      industry: "风电",
      objectIds: ["ENT-001", "ENT-002", "ENT-003"],
    },
    boxed = { ...base, boxIds: ["ENT-002", "ENT-020"] };
  assert.deepEqual(
    filterEnterprises(data, boxed).map((row) => row.id),
    ["ENT-002"],
  );
  assert.deepEqual(
    [...filterEnterprises(data, { ...boxed, boxIds: null })]
      .map((row) => row.id)
      .sort(),
    base.objectIds,
  );
  assert.deepEqual(base.objectIds, ["ENT-001", "ENT-002", "ENT-003"]);
});
test("empty business/query scopes stay empty until the user explicitly shows all enterprises", () => {
  assert.equal(
    filterEnterprises(data, { ...defaultFilters(), objectIds: [] }).length,
    0,
  );
  assert.equal(
    filterEnterprises(data, { ...defaultFilters(), boxIds: [] }).length,
    0,
  );
  assert.equal(filterEnterprises(data, defaultFilters()).length, 21);
});
test("named enterprise questions can leave the previous geographic box explicitly", () => {
  const result = query(data, "解释环保测试公司4", {
    filters: { ...defaultFilters(), boxIds: ["ENT-001"] },
    horizon: 90,
  });
  assert.deepEqual(
    result.result.rows.map((row) => row.id),
    ["ENT-020"],
  );
  assert.equal(result.filters.boxIds, null);
});
test("box filters persist and undo independently without deleting saved business records", () => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    store = createStore(storage);
  store.update({
    filters: { ...defaultFilters(), industry: "风电" },
    reports: [{ id: "keep-report" }],
  });
  store.update(
    { filters: { ...store.get().filters, boxIds: ["ENT-002"] } },
    { undoable: true },
  );
  assert.deepEqual(createStore(storage).get().filters.boxIds, ["ENT-002"]);
  store.undo();
  assert.equal(store.get().filters.boxIds, null);
  assert.equal(store.get().filters.industry, "风电");
  assert.equal(store.get().reports[0].id, "keep-report");
});
test("restored box IDs are validated and deduplicated without broadening an empty scope", () => {
  const store = createStore({ getItem: () => null, setItem: () => {} });
  store.update({
    filters: { ...defaultFilters(), boxIds: ["ENT-001", "ENT-001", "UNKNOWN"] },
  });
  assert.deepEqual(validateRestoredState(store.get(), data).filters.boxIds, [
    "ENT-001",
  ]);
  store.update({ filters: { ...defaultFilters(), boxIds: ["UNKNOWN"] } });
  assert.deepEqual(validateRestoredState(store.get(), data).filters.boxIds, []);
});
