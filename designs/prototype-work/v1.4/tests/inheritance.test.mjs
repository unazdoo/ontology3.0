import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { canonicalScope } from "../src/platform.js";
const root = new URL("../", import.meta.url),
  parent = new URL("../../v1.3.2/composite/", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const manifest = JSON.parse(read("INHERITANCE-MANIFEST.json"));
test("cross-module transfer preserves explicit empty scopes and never replaces non-enterprise objects with all enterprises", () => {
  const data = { enterprises: [{ id: "ENT-020", aliasNames: ["单位553"] }] };
  assert.deepEqual(
    canonicalScope({ objectSetRef: { objectIds: [] } }, data).objectIds,
    [],
  );
  assert.deepEqual(
    canonicalScope({ objectSetRef: { objectIds: ["BudgetUnit-002"] } }, data)
      .objectIds,
    [],
  );
  assert.deepEqual(
    canonicalScope(
      { objectSetRef: { objectIds: ["S003-ENT-020", "单位553"] } },
      data,
    ).objectIds,
    ["ENT-020"],
  );
  assert.equal(canonicalScope({}, data).objectIds, null);
});
const allowed = new Set([
  "s001-e2e-integration/app.js",
  "s001-e2e-integration/index.html",
  "s001-e2e-integration/styles.css",
  "s001-e2e-integration/data.js",
  "shared/report-editor.js",
  "shared/workflow.js",
  "modules/m07/app.js",
  "modules/m07/index.html",
  "modules/m07/styles.css",
  "model-center/app.js",
  "start-candidate.mjs",
  "tests/server.test.mjs",
  "tests/workflow.test.mjs",
  "tests/shell-contract.test.mjs",
  "tests/chrome-regression.mjs",
  "tests/readability-regression.mjs",
  "dashboard/app.js",
  "integrations/native-module-integrations.js",
]);
test("every inherited v1.3.2 source file remains unchanged; all 45 inherited files exist", () => {
  assert.equal(manifest.files.length, 45);
  for (const file of manifest.files) {
    assert.equal(
      digest(readFileSync(new URL(file.path, parent))),
      file.parentSha256,
      `parent changed: ${file.path}`,
    );
    const current = readFileSync(new URL("composite/" + file.path, root));
    if (!allowed.has(file.path))
      assert.equal(
        digest(current),
        file.inheritedSha256,
        `unrelated inherited change: ${file.path}`,
      );
  }
});
test("all original modules, five domains and resource content are inherited without replacements", () => {
  const load = (body) => {
    const sandbox = {};
    sandbox.window = sandbox;
    vm.runInNewContext(body, sandbox);
    return sandbox.OFW_V131_DATA;
  };
  const original = load(
      readFileSync(new URL("s001-e2e-integration/data.js", parent), "utf8"),
    ),
    current = load(read("composite/s001-e2e-integration/data.js"));
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        current.modules.map((module) =>
          module.id === "ontology"
            ? {
                ...module,
                source: original.modules.find((item) => item.id === "ontology")
                  .source,
              }
            : module.id === "m07"
              ? { ...module, name: original.modules.find(item => item.id === "m07").name }
              : module,
        ),
      ),
    ),
    JSON.parse(JSON.stringify(original.modules)),
  );
  assert.equal(current.modules.find(item => item.id === "m07").name, "业务全景");
  assert.equal(
    current.modules.find((item) => item.id === "ontology").source,
    "../ontology/index.html?v=20260907-01",
  );
  assert.match(
    read("composite/ontology/index.html"),
    /prototype-releases\/v1\.1\.0\/ontology-management-review\/canvas-first\/app\.js/,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(current.scenarios)),
    JSON.parse(JSON.stringify(original.scenarios)),
  );
  const baseline = JSON.parse(
      readFileSync(new URL("modules/m07/resources/portfolio.json", parent)),
    ),
    portfolio = JSON.parse(
      read("composite/modules/m07/resources/portfolio.json"),
    );
  assert.deepEqual(portfolio, baseline);
  assert.equal(portfolio.objects.length, 71);
  assert.equal(
    portfolio.objects.filter((item) => item.id.startsWith("ENT-")).length,
    21,
  );
});
test("the default entry is the inherited platform, not the standalone map application", () => {
  assert.match(
    read("index.html"),
    /v1\.4\/composite\/s001-e2e-integration\/index\.html/,
  );
  assert.doesNotMatch(read("index.html"), /src\/app\.js/);
  const html = read("composite/s001-e2e-integration/index.html");
  assert.match(html, /joint-workbench\.js/);
  assert.match(html, /report-editor\.js/);
  assert.doesNotMatch(read("src/app.js"), /href="[^"\n]*v1\.3\.2/);
});
test("joint views extend existing module task lists instead of removing originals", () => {
  const script = read("composite/integrations/joint-workbench.js");
  for (const id of [
    "situation",
    "map-query",
    "financing-plans",
    "analysis-tasks",
    "joint-reports",
  ])
    assert.ok(script.includes(id));
  assert.match(script, /base\.resources/);
  assert.doesNotMatch(script, /task\("joint-data"/);
  assert.doesNotMatch(script, /task\("rule-sandbox"/);
  assert.match(script, /dashboard:.*task\("situation"/);
  assert.match(script, /W\.appendBlock/);
  assert.match(
    read("composite/shared/report-editor.js"),
    /returnReport\(block\)/,
  );
});
test("repeated joint-report sync preserves prose edited in the inherited editor", () => {
  const saved = new Map(),
    sandbox = {
      console,
      crypto: globalThis.crypto,
      location: { origin: "http://localhost" },
      URL,
      URLSearchParams,
      localStorage: {
        getItem: (key) => saved.get(key) || null,
        setItem: (key, value) => saved.set(key, value),
      },
      OFW_V131_CATALOG: { resources: [] },
      OFW_ENTERPRISE_MASTER: { resolve: (id) => ({ id, name: "企业" }) },
    };
  sandbox.window = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(read("composite/shared/workflow.js"), context);
  vm.runInContext(read("composite/integrations/joint-workbench.js"), context);
  const report = {
    id: "report-1",
    title: "融资分析",
    notes: "原分析",
    rows: [
      {
        id: "ENT-020",
        name: "企业",
        loanIds: ["L1"],
        balance: 100,
        cost: 2.8,
        due: 20,
        gap: 5,
      },
    ],
    evidence: { dataDigest: "digest", objectIds: ["ENT-020"], horizon: 90 },
  };
  sandbox.OFW_V14_JOINT.publishReport(report);
  const draft = sandbox.OFW_WORKFLOW.readReport("S003");
  assert.equal(draft.contentBlocks.length, 4);
  draft.contentBlocks[0].text = "用户在原报告编辑器补充的复核意见";
  sandbox.OFW_WORKFLOW.saveReport("S003", draft);
  report.notes = "更新分析";
  sandbox.OFW_V14_JOINT.publishReport(report);
  const updated = sandbox.OFW_WORKFLOW.readReport("S003");
  assert.equal(updated.contentBlocks.length, 4);
  assert.ok(
    updated.contentBlocks.some(
      (block) => block.text === "用户在原报告编辑器补充的复核意见",
    ),
  );
  assert.ok(
    updated.contentBlocks.some((block) => block.text.includes("更新分析")),
  );
  const reordered = { ...updated, contentBlocks: updated.contentBlocks.slice(1).reverse() };
  sandbox.OFW_WORKFLOW.saveReport("S003", reordered);
  sandbox.OFW_V14_JOINT.publishReport(report);
  assert.deepEqual(sandbox.OFW_WORKFLOW.readReport("S003").contentBlocks.map((block) => block.id), reordered.contentBlocks.map((block) => block.id));
  sandbox.OFW_WORKFLOW.saveReport("S003", { ...reordered, contentBlocks: [] });
  sandbox.OFW_V14_JOINT.publishReport(report);
  assert.equal(sandbox.OFW_WORKFLOW.readReport("S003").contentBlocks.length, 0);
});
