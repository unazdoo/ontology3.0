import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));
const sha256 = (relativePath) => crypto.createHash("sha256").update(fs.readFileSync(path.join(packageRoot, relativePath))).digest("hex");

function packageFiles(directory = packageRoot) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? packageFiles(absolute) : [path.relative(packageRoot, absolute)];
  }).sort();
}

function loadCore() {
  const context = { window: {}, console };
  vm.runInNewContext(read("module/core.js"), context, { filename: "core.js" });
  return context.window.M07Core;
}

function assertNoAbsolutePath(value, location = "resource") {
  if (typeof value === "string") {
    const userRoot = "/" + "Users/";
    assert.equal(value.includes(userRoot) || value.includes("/home/") || value.startsWith("file:"), false, `${location} contains an absolute path`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoAbsolutePath(item, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => assertNoAbsolutePath(item, `${location}.${key}`));
  }
}

test("release and mount identity are fixed", () => {
  const manifest = readJson("INTEGRATION-MANIFEST.json");
  assert.equal(manifest.sourceTag, "prototype-v1.1.0-frozen");
  assert.equal(manifest.parentVersion, "v1.1.0");
  assert.equal(manifest.baselineSnapshotId, "BSL-OFW-V110-94ABD0E991B7");
  assert.equal(manifest.targetPrototypeVersion, "v1.2.0-rc.1");
  assert.equal(manifest.acceptanceReady, false);
  assert.equal(manifest.module.moduleId, "m07");
  assert.equal(manifest.module.route, "#module/m07");
  assert.equal(manifest.module.canonicalEntry, "module/workspace-v2.html");
});

test("Owner workspace is canonical and contains no second Shell", () => {
  const html = read("module/workspace-v2.html");
  const runtime = read("module/workspace-v2.js");
  assert.match(html, /id="m07-workspace"/);
  assert.match(html, /data-screen-label="M07 多视图探索工作区"/);
  assert.doesNotMatch(html, /platform-shell|global-nav|shell-topbar|s001-context/);
  assert.match(runtime, /const MODULE_ID = "m07"/);
  assert.match(runtime, /const MODULE_ROUTE = "#module\/m07"/);
  assert.match(runtime, /ofw\.m07\.prototype\.handoff\.v1/);
  assert.match(runtime, /operation: moduleId === "m08" \? "open-m08"/);
  assert.match(runtime, /m08: "#module\/m08"/);
  assert.doesNotMatch(runtime, /platform-shell|window\.parent\.document/);
});

test("S001 and S005 resources satisfy the same core contract", () => {
  const core = loadCore();
  assert.equal(typeof core.isLinkAllowed, "function");
  for (const [file, scenarioId] of [["resources/s001.json", "S001"], ["resources/s005.json", "S005"]]) {
    const resource = readJson(file);
    assert.equal(resource.schemaVersion, "ofw.m07.validation-resource.v1");
    assert.equal(resource.namespace, "ofw.m07.research.v1");
    assert.equal(resource.scenarioContext.scenarioId, scenarioId);
    assert.ok(resource.objects.length > 0);
    assert.ok(resource.links.length > 0);
    assert.ok(resource.series.length > 0);
    assertNoAbsolutePath(resource, file);

    const rootObject = resource.objects.find((item) => core.isAllowed(item, "m07.analyst"));
    assert.ok(rootObject, `${scenarioId} exposes an analyst root`);
    const links = core.visibleLinksForObject(resource, rootObject.id, "m07.analyst");
    assert.ok(Array.isArray(links));
    assert.ok(links.every((link) => core.isLinkAllowed(link, "m07.analyst")));
    const graph = core.graphSlice(resource, {
      currentObjectId: rootObject.id,
      roleId: "m07.analyst",
      graphHops: 2,
      graphQuality: ["passed", "warning", "blocked"],
    });
    assert.ok(graph.nodes.some((item) => item.id === rootObject.id));
  }
});

test("S005 regression uses the Owner core isLinkAllowed implementation", () => {
  const core = loadCore();
  const resource = readJson("resources/s005.json");
  const unrestrictedLink = resource.links.find((link) => !Array.isArray(link.permissions));
  assert.ok(unrestrictedLink, "S005 retains an unrestricted research link fixture");
  assert.equal(core.isLinkAllowed(unrestrictedLink, "m07.analyst"), true);
  const root = resource.objects.find((item) => item.objectTypeId === "m01.object-type.investment-portfolio");
  assert.doesNotThrow(() => core.visibleLinksForObject(resource, root.id, "m07.analyst"));
});

test("checksum inventory covers every package file except itself", () => {
  const checksumLines = read("SHA256SUMS").trim().split("\n").filter(Boolean);
  const entries = new Map(checksumLines.map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    assert.ok(match, `invalid checksum line: ${line}`);
    return [match[2], match[1]];
  }));
  const expectedFiles = packageFiles().filter((file) => file !== "SHA256SUMS");
  assert.deepEqual([...entries.keys()].sort(), expectedFiles);
  for (const [file, expected] of entries) assert.equal(sha256(file), expected, `${file} checksum mismatch`);
});
