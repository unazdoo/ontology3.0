import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const json = (relativePath) => JSON.parse(read(relativePath));

function loadCore() {
  const context = { window: {}, console };
  vm.runInNewContext(read("module/core.js"), context, { filename: "core.js" });
  return context.window.M07Core;
}

test("candidate contains only the minimal M07 module and resource assets", () => {
  const expected = [
    "module/core.js",
    "module/unavailable.html",
    "module/vendor/d3.min.js",
    "module/vendor/leaflet.css",
    "module/vendor/leaflet.js",
    "module/vendor/lucide.min.js",
    "module/workspace-v2.css",
    "module/workspace-v2.html",
    "module/workspace-v2.js",
    "resources/s001.json",
    "resources/s005.json"
  ];
  expected.forEach((relativePath) => assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath));
});

test("M07 remains a single embedded workspace", () => {
  const html = read("module/workspace-v2.html");
  const runtime = read("module/workspace-v2.js");
  assert.match(html, /id="m07-workspace"/);
  assert.doesNotMatch(html, /platform-shell|global-nav|shell-topbar|s001-context/);
  assert.match(runtime, /const MODULE_ID = "m07"/);
  assert.match(runtime, /const MODULE_ROUTE = "#module\/m07"/);
  assert.match(runtime, /type: "OFW_M07_OPEN_M08"/);
});

test("unregistered scenarios have an embedded no-fallback state", () => {
  const html = read("module/unavailable.html");
  assert.doesNotMatch(html, /platform-shell|global-nav|shell-topbar/);
  assert.match(html, /当前场景尚未登记多视图资源/);
  assert.match(html, /不会改用其他场景的数据/);
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\("scenarioId"\)/);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|https?:\/\//);
});

test("S005 host identity, M08 handoff and return position are explicit", () => {
  const runtime = read("module/workspace-v2.js");
  assert.match(runtime, /SCENARIO_CONTEXT_FIELDS = \["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"\]/);
  assert.match(runtime, /applyHostScenarioContext\(params\)/);
  assert.match(runtime, /scenarioVersion: scenarioContext\.scenarioVersion/);
  assert.match(runtime, /formedAt: scenarioContext\.formedAt/);
  assert.match(runtime, /status: scenarioContext\.status/);
  assert.match(runtime, /scenarioContext,/);
  assert.match(runtime, /state\.seriesIds[\s\S]+resource\.series\.find/);
  assert.match(runtime, /returnPosition = params\.get\("position"\)/);
  assert.match(runtime, /restoreReturnPosition\(\)/);
});

test("S005 products use the five canonical fixture ObjectRefs", () => {
  const resource = json("resources/s005.json");
  const fixture = JSON.parse(fs.readFileSync(path.resolve(root, "../../scenarios/s005/resources/s005-research-fixture.json"), "utf8"));
  assert.deepEqual(
    resource.objects.filter((item) => item.canonicalObjectRef).map((item) => item.canonicalObjectRef),
    fixture.products.map((item) => item.objectRef)
  );
  assert.equal(resource.scenarioContext.scenarioVersion, "S005-v1");
  assert.equal(resource.scenarioContext.scenarioRunId, "HOST_SCENARIO_CONTEXT_REQUIRED");
  assert.equal(resource.scenarioContext.formedAt, null);
  assert.equal(resource.scenarioContext.status, "host-required");
  assert.equal(resource.source.sourceAssetVersion, "S005-DATA-AUDIT-79-SNAPSHOTS");
});

test("space view performs no external tile request and page copy has no internal labels", () => {
  const runtime = read("module/workspace-v2.js");
  const core = read("module/core.js");
  assert.doesNotMatch(runtime, /tile\.openstreetmap|L\.tileLayer\(|https?:\/\//);
  assert.doesNotMatch(`${runtime}\n${core}`, /统一原型入口|研究角色模拟|研究夹具|验证资源/);
  assert.match(runtime, /当前视图不加载外部底图/);
});

test("S001 and S005 still satisfy the shared visibility contract", () => {
  const core = loadCore();
  for (const [file, scenarioId] of [["resources/s001.json", "S001"], ["resources/s005.json", "S005"]]) {
    const resource = json(file);
    assert.equal(resource.schemaVersion, "ofw.m07.validation-resource.v1");
    assert.equal(resource.scenarioContext.scenarioId, scenarioId);
    assert.ok(resource.objects.length > 0);
    assert.ok(resource.links.length > 0);
    assert.ok(resource.series.length > 0);
    const rootObject = resource.objects.find((item) => core.isAllowed(item, "m07.analyst"));
    assert.ok(rootObject);
    assert.ok(Array.isArray(core.visibleLinksForObject(resource, rootObject.id, "m07.analyst")));
  }
});
