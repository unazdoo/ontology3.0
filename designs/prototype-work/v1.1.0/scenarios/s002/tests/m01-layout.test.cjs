"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const adapterPath = path.join(scenarioRoot, "baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js");

function runAdapter(randomValue) {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const controlledMath = Object.create(Math);
  controlledMath.random = () => randomValue;
  const sandbox = {
    URLSearchParams,
    Math: controlledMath,
    localStorage,
    location: {
      search: "?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=S002-RUN-M01-LAYOUT-TEST&m02AssetPublished=1&m01MappingApplied=1&m01OntologyPublished=1&m01Ready=1",
      hash: "#published",
      pathname: "/scenarios/s002/baseline-adapters/ontology-management-review/canvas-first/index.html",
      origin: "http://127.0.0.1:4353"
    },
    history: { replaceState() {} },
    window: { addEventListener() {} },
    document: { documentElement: { dataset: {} } },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterPath, "utf8"), sandbox, { filename: adapterPath });
  const state = JSON.parse(localStorage.getItem("ontology3-canvas-first-review-v17"));
  const version = state.publishedVersions.find((item) => item.id === "SEM-S002-BUDGET-v1");
  return { seedVersion: state.s002BusinessSeedVersion, version };
}

function nodeGeometry(version) {
  const definitions = [
    ["object", version.objects, 210, 104],
    ["link", version.links, 190, 82],
    ["metric", version.metrics, 190, 82],
    ["rule", version.rules, 190, 82],
    ["action", version.actions, 220, 92]
  ];
  return definitions.flatMap(([kind, items, width, height]) => items.map((item) => {
    const position = version.positions[item.id];
    return { id: item.id, kind, x: position?.[0], y: position?.[1], width, height };
  }));
}

test("M01的7 Object、9 Metric、5 Rule和6 Action Type均有确定分层坐标", function () {
  const first = runAdapter(0.01);
  const second = runAdapter(0.99);
  assert.equal(first.seedVersion, "S002-M01-BUDGET-PUBLISHED-v8");
  assert.deepEqual(first.version.positions, second.version.positions, "布局不得受Math.random影响");

  const coreResources = [
    ...first.version.objects,
    ...first.version.metrics,
    ...first.version.rules,
    ...first.version.actions
  ];
  assert.deepEqual(
    [first.version.objects.length, first.version.metrics.length, first.version.rules.length, first.version.actions.length],
    [7, 9, 5, 6]
  );
  assert.equal(coreResources.length, 27);
  for (const resource of coreResources) {
    const position = first.version.positions[resource.id];
    assert.equal(Array.isArray(position), true, `${resource.id}缺少固定位置`);
    assert.equal(position.length, 2, `${resource.id}坐标格式错误`);
    assert.equal(position.every(Number.isFinite), true, `${resource.id}坐标不是有限数值`);
  }

  assert.deepEqual([...new Set(first.version.objects.map((item) => first.version.positions[item.id][1]))], [70]);
  assert.deepEqual([...new Set(first.version.metrics.map((item) => first.version.positions[item.id][1]))], [390, 490]);
  assert.deepEqual([...new Set(first.version.rules.map((item) => first.version.positions[item.id][1]))], [590]);
  assert.deepEqual([...new Set(first.version.actions.map((item) => first.version.positions[item.id][1]))], [690]);
});

test("M01完整35节点图谱无明显重叠并适合v1.0.3默认Published缩放", function () {
  const source = fs.readFileSync(adapterPath, "utf8");
  assert.equal(source.includes("Math.random"), false, "S002布局适配器不得使用随机坐标");

  const { version } = runAdapter(0.5);
  assert.equal(version.links.length, 8);
  const nodes = nodeGeometry(version);
  assert.equal(nodes.length, 35);
  assert.equal(nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)), true, "完整语义图谱仍有节点落入基线随机回退");

  const minimumGap = 16;
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex];
      const right = nodes[rightIndex];
      const separated =
        left.x + left.width + minimumGap <= right.x ||
        right.x + right.width + minimumGap <= left.x ||
        left.y + left.height + minimumGap <= right.y ||
        right.y + right.height + minimumGap <= left.y;
      assert.equal(separated, true, `${left.id}与${right.id}发生明显重叠或间距不足`);
    }
  }

  const rightEdge = Math.max(...nodes.map((node) => node.x + node.width));
  const bottomEdge = Math.max(...nodes.map((node) => node.y + node.height));
  assert.ok(rightEdge * 0.72 <= 1200, `默认72%缩放后的图谱宽度过大：${rightEdge * 0.72}`);
  assert.ok(bottomEdge * 0.72 <= 600, `默认72%缩放后的图谱高度过大：${bottomEdge * 0.72}`);
});
