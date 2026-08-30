import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WORK_ROOT = resolve(TEST_DIR, "../..");
const COMPOSITE_ROOT = join(WORK_ROOT, "composite");
const REPO_ROOT = resolve(WORK_ROOT, "../../..");
const FROZEN_RELATIVE = "designs/prototype-releases/v1.1.0";
const SOURCE_COMMIT = "a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716";
const failures = [];
let passed = 0;

function check(name, action) {
  try {
    action();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function json(name) {
  return JSON.parse(readFileSync(join(WORK_ROOT, name), "utf8"));
}

function source(path) {
  return readFileSync(path, "utf8");
}

function posixPath(value) {
  return value.split(sep).join("/");
}

function walk(root) {
  const output = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      output.push(path);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(path);
    }
  };
  visit(root);
  return output;
}

function candidateFiles() {
  return walk(COMPOSITE_ROOT).filter((path) => lstatSync(path).isFile());
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function runScript(path, context) {
  vm.runInContext(source(path), context, { filename: path });
}

function browserDataContext() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  runScript(join(COMPOSITE_ROOT, "s001-e2e-integration/data.js"), context);
  runScript(join(COMPOSITE_ROOT, "resources/catalog.js"), context);
  return sandbox;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  };
}

function stateContext() {
  class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }
  const sandbox = {
    console,
    crypto: webcrypto,
    CustomEvent,
    dispatchEvent() {},
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    location: { search: "", hash: "#home" },
    matchMedia: () => ({ matches: false }),
    URLSearchParams
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  runScript(join(COMPOSITE_ROOT, "scenarios/s005/scenario-config.js"), context);
  runScript(join(COMPOSITE_ROOT, "scenarios/s005/scenario-adapter.js"), context);
  runScript(join(COMPOSITE_ROOT, "s001-e2e-integration/data.js"), context);
  runScript(join(COMPOSITE_ROOT, "s001-e2e-integration/state.js"), context);
  return sandbox;
}

function localReference(value) {
  const cleaned = value.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned || cleaned.startsWith("#") || /^(?:https?:|data:|mailto:|javascript:|about:)/i.test(cleaned)) return null;
  return decodeURIComponent(cleaned.split(/[?#]/)[0]);
}

function presentationReferences(path) {
  const text = source(path);
  const refs = [];
  if (extname(path) === ".html") {
    for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) refs.push(match[1]);
  }
  if (extname(path) === ".css") {
    for (const match of text.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) refs.push(match[1]);
  }
  return refs.map(localReference).filter(Boolean);
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

const moduleRegistry = json("MODULE-REGISTRY.json");
const scenarioRegistry = json("SCENARIO-REGISTRY.json");
const manifest = json("COMPOSITE-MANIFEST.json");
const matrix = json("COMPOSITE-REGRESSION-MATRIX.json");
const browserEvidence = json("composite/evidence/browser-regression.json");
const contractChanges = json("CONTRACT-CHANGE-REQUESTS.json");
const browserData = browserDataContext();

check("baseline and candidate identity", () => {
  assert.equal(moduleRegistry.targetPrototypeVersion, "v1.2.0-rc.1");
  assert.equal(moduleRegistry.sourceBaseline.sourceCommit, SOURCE_COMMIT);
  assert.equal(moduleRegistry.sourceBaseline.baselineSnapshotId, "BSL-OFW-V110-94ABD0E991B7");
  assert.equal(moduleRegistry.acceptanceReady, false);
  assert.equal(scenarioRegistry.targetPrototypeVersion, "v1.2.0-rc.1");
  assert.equal(scenarioRegistry.sourceCommit, SOURCE_COMMIT);
  assert.equal(scenarioRegistry.baselineSnapshotId, "BSL-OFW-V110-94ABD0E991B7");
  assert.equal(scenarioRegistry.acceptanceReady, false);
  assert.equal(manifest.candidateVersion, "v1.2.0-rc.1");
  assert.equal(manifest.sourceBaseline.sourceCommit, SOURCE_COMMIT);
  assert.equal(manifest.acceptanceReady, false);
  assert.equal(matrix.acceptanceReady, false);
});

check("M01-M08 and Dashboard registration", () => {
  const expected = {
    M01: ["ontology", "#module/ontology"],
    M02: ["data", "#module/data"],
    M03: ["query", "#module/query"],
    M04: ["decision", "#module/decision"],
    M05: ["agent", "#module/agent"],
    M06: ["report", "#module/report"],
    M07: ["m07", "#module/m07"],
    M08: ["modeling", "#module/modeling"],
    Dashboard: ["dashboard", "#dashboard"]
  };
  assert.deepEqual(moduleRegistry.moduleOrder, Object.keys(expected));
  assert.equal(moduleRegistry.modules.length, 9);
  const ids = new Set();
  const routes = new Set();
  for (const module of moduleRegistry.modules) {
    assert.deepEqual([module.moduleId, module.route], expected[module.resourceOwnerId]);
    assert(!ids.has(module.moduleId), `duplicate moduleId ${module.moduleId}`);
    assert(!routes.has(module.route), `duplicate route ${module.route}`);
    ids.add(module.moduleId);
    routes.add(module.route);
    assert(!module.entry.startsWith("/"), `${module.resourceOwnerId} entry must be relative`);
    assert(existsSync(resolve(WORK_ROOT, module.entry)), `${module.resourceOwnerId} entry does not exist`);
  }
  const m07 = moduleRegistry.modules.find((module) => module.resourceOwnerId === "M07");
  const m08 = moduleRegistry.modules.find((module) => module.resourceOwnerId === "M08");
  assert.equal(m07.canonicalImplementation, "workspace-v2");
  assert.equal(m08.resourceOwnerId, "M08");
});

check("shell route data matches module registry", () => {
  const shellModules = new Map(browserData.OFW_V120_DATA.modules.map((module) => [module.ownerId, module]));
  for (const module of moduleRegistry.modules.filter((item) => item.resourceOwnerId !== "Dashboard")) {
    const shell = shellModules.get(module.resourceOwnerId);
    assert(shell, `${module.resourceOwnerId} missing from shell data`);
    assert.equal(shell.id, module.moduleId);
    assert.equal(shell.route, module.route);
  }
  assert.equal(browserData.OFW_V120_DATA.dashboard.id, "dashboard");
  assert.equal(browserData.OFW_V120_DATA.dashboard.route, "#dashboard");
});

check("canonical M07 and M08 implementation contracts", () => {
  const m07 = moduleRegistry.modules.find((module) => module.resourceOwnerId === "M07");
  const m08 = moduleRegistry.modules.find((module) => module.resourceOwnerId === "M08");
  assert.match(m07.entry, /\/workspace-v2\.html$/);
  assert.match(m08.entry, /\/content\.html$/);
  const bridgeSource = source(join(COMPOSITE_ROOT, "modules/modeling/bridge/m07-m08-bridge.js"));
  for (const token of ["OFW_M07_OPEN_M08", "OFW_M08_DELIVER_CONTEXT", "OFW_M08_RETURN_TO_M07", "scenarioVersion", "formedAt"]) {
    assert(bridgeSource.includes(token), `bridge missing ${token}`);
  }
  const integration = JSON.parse(source(join(COMPOSITE_ROOT, "modules/modeling/INTEGRATION-MANIFEST.json")));
  assert.equal(integration.mount.moduleId, "modeling");
  assert.equal(integration.mount.route, "#module/modeling");
  assert.equal(integration.s005Objective.objectiveId, "MO-S005-POST-INVESTMENT-RESEARCH-v1");
  assert.deepEqual(integration.s005Objective.resultKinds, ["PREDICTION", "SIMULATION"]);
  assert.equal(integration.s005Objective.missingInputPolicy, "UNAVAILABLE_NO_CROSS_SCENARIO_FALLBACK");
});

check("S001-S005 scenario identities", () => {
  const expected = {
    S001: ["S001-v1", "S001-RUN-20260816081748567-705ac89fb83a"],
    S002: ["S002-v1", "S002-RUN-20260815080000000-6ef5d0ef82f9"],
    S003: ["S003-v1", "S003-RUN-20260817163000000-c02200000001"],
    S004: ["S004-v2.1.0", "S004-RUN-20260815233000000-7f3c8e42a1b6"]
  };
  assert.deepEqual(scenarioRegistry.scenarios.map((scenario) => scenario.scenarioId), ["S001", "S002", "S003", "S004", "S005"]);
  for (const [scenarioId, [version, runId]] of Object.entries(expected)) {
    const scenario = scenarioRegistry.scenarios.find((item) => item.scenarioId === scenarioId);
    assert.equal(scenario.scenarioVersion, version);
    assert.equal(scenario.scenarioRunId, runId);
    assert.equal(scenario.lifecycle, "archived");
    assert.equal(scenario.mutable, false);
    assert.equal(scenario.status, "completed");
  }
  const s005 = scenarioRegistry.scenarios.find((scenario) => scenario.scenarioId === "S005");
  assert.equal(s005.scenarioVersion, "S005-v1");
  assert(!Object.hasOwn(s005, "scenarioRunId"), "S005 registry must not pin a run id");
  assert.equal(s005.scenarioRunIdPolicy.mode, "dynamic-per-run");
  assert.equal(s005.scenarioRunIdPolicy.historicalRunReuseAllowed, false);
  assert.equal(s005.resetPolicy.touchArchivedScenarios, false);
});

check("shell scenario definitions match the registry", () => {
  const shellScenarios = new Map(browserData.OFW_V120_DATA.scenarios.map((scenario) => [scenario.id, scenario]));
  for (const registered of scenarioRegistry.scenarios) {
    const shell = shellScenarios.get(registered.scenarioId);
    assert(shell, `${registered.scenarioId} missing from shell data`);
    assert.equal(shell.scenarioVersion, registered.scenarioVersion, `${registered.scenarioId} version mismatch`);
    if (registered.lifecycle === "archived") {
      assert.equal(shell.scenarioRunId, registered.scenarioRunId);
      assert.equal(shell.formedAt, registered.formedAt);
      assert.equal(shell.archived, true);
    }
  }
});

check("unified resource catalog covers 9 modules x 5 scenarios", () => {
  const catalog = browserData.OFW_V120_CATALOG;
  const moduleIds = moduleRegistry.modules.map((module) => module.moduleId);
  assert.equal(catalog.scenarios.length, 5);
  assert.equal(catalog.resources.length, 45);
  assert.equal(new Set(catalog.resources.map((resource) => resource.id)).size, 45);
  for (const moduleId of moduleIds) {
    const resources = catalog.resourcesFor(moduleId);
    assert.equal(resources.length, 5, `${moduleId} must expose five scenario records`);
    assert.deepEqual(new Set(resources.map((resource) => resource.scenarioId)), new Set(["S001", "S002", "S003", "S004", "S005"]));
    assert(resources.every((resource) => resource.route === moduleRegistry.modules.find((module) => module.moduleId === moduleId).route));
  }
  const s005Modeling = catalog.resources.find((resource) => resource.moduleId === "modeling" && resource.scenarioId === "S005");
  assert.equal(s005Modeling.modelingObjectiveRef, "MO-S005-POST-INVESTMENT-RESEARCH-v1");
  assert.equal(s005Modeling.objectRef.objectTypeRef, "InvestmentProduct");
});

check("current scenario reset is isolated", () => {
  const sandbox = stateContext();
  const store = sandbox.OFW_V120_STORE;
  const before = store.get();
  const archivedBefore = Object.fromEntries(["S001", "S002", "S003", "S004"].map((id) => [id, before.scenarios[id].scenarioContext]));
  const previousS005Run = before.scenarios.S005.scenarioContext.scenarioRunId;
  const receipt = store.resetCurrentScenario("S005");
  const after = store.get();
  assert.equal(receipt.changed, true);
  assert.deepEqual(Array.from(receipt.touchedScenarios), ["S005"]);
  assert.notEqual(after.scenarios.S005.scenarioContext.scenarioRunId, previousS005Run);
  assert.match(after.scenarios.S005.scenarioContext.scenarioRunId, /^S005-RUN-[0-9]{17}-[a-f0-9]{12}$/);
  assert.equal(after.scenarios.S005.runHistory.at(-1).scenarioContext.scenarioRunId, previousS005Run);
  for (const id of ["S001", "S002", "S003", "S004"]) assert.deepEqual(after.scenarios[id].scenarioContext, archivedBefore[id]);
  const protectedReceipt = store.resetCurrentScenario("S001");
  assert.equal(protectedReceipt.changed, false);
  assert.deepEqual(store.get().scenarios.S001.scenarioContext, archivedBefore.S001);
});

check("M07-M08-M07 bridge rejects identity drift", () => {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  runScript(join(COMPOSITE_ROOT, "modules/modeling/bridge/m07-m08-bridge.js"), context);
  const bridge = sandbox.OFW_M07_M08_BRIDGE;
  const identity = {
    scenarioId: "S005",
    scenarioVersion: "S005-v1",
    scenarioRunId: "S005-RUN-20260827000000000-abcdef123456",
    formedAt: "2026-08-27T00:00:00.000Z",
    status: "active"
  };
  const opened = bridge.acceptM07Open({
    type: "OFW_M07_OPEN_M08",
    sourceModuleId: "m07",
    sourceRoute: "#module/m07",
    payload: { ...identity, objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct" } }
  }, identity);
  assert(bridge.sameScenario(opened, identity));
  const delivery = bridge.deliveryMessage({ scenarioContext: identity, explorationHandoff: identity }, identity);
  assert.equal(delivery.type, "OFW_M08_DELIVER_CONTEXT");
  const returned = bridge.returnMessage({
    inputManifest: identity,
    resultEnvelope: { inputSnapshot: identity }
  }, identity);
  assert.equal(returned.type, "OFW_M08_RETURN_TO_M07");
  assert.throws(() => bridge.acceptM07Open({
    type: "OFW_M07_OPEN_M08",
    payload: { ...identity, scenarioRunId: "S005-RUN-20260827000000000-deadbeef0000", objectRef: { id: "x", objectTypeRef: "InvestmentProduct" } }
  }, identity), /does not match/);
});

check("unique entry and local presentation references resolve", () => {
  assert.equal(manifest.uniqueEntry, "composite/s001-e2e-integration/index.html");
  assert(existsSync(join(WORK_ROOT, manifest.uniqueEntry)));
  assert.equal(moduleRegistry.shell.entry, manifest.uniqueEntry);
  for (const path of candidateFiles().filter((candidate) => [".html", ".css"].includes(extname(candidate)))) {
    for (const ref of presentationReferences(path)) {
      assert(!ref.startsWith("/"), `${posixPath(relative(WORK_ROOT, path))} contains absolute reference ${ref}`);
      if (extname(path) === ".html") {
        const target = resolve(dirname(path), ref);
        assert(existsSync(target), `${posixPath(relative(WORK_ROOT, path))} has missing reference ${ref}`);
      }
    }
  }
});

check("candidate contains no symlink or runtime snapshot", () => {
  const entries = walk(COMPOSITE_ROOT);
  assert.equal(entries.filter((path) => lstatSync(path).isSymbolicLink()).length, 0);
  const forbidden = entries.filter((path) => /(^|\/)(?:runtime-snapshots?|run-snapshots?)(\/|$)|\.runtime\.json$/i.test(posixPath(relative(COMPOSITE_ROOT, path))));
  assert.deepEqual(forbidden, []);
  assert.equal(manifest.runtimeState.included, false);
  assert.deepEqual(manifest.runtimeState.snapshotFiles, []);
  assert.equal(manifest.stateSeparation.formalResult, "not included");
});

check("single platform shell contract", () => {
  assert.equal(moduleRegistry.shell.count, 1);
  assert.equal(manifest.composition.platformShellCount, 1);
  assert.equal(manifest.composition.moduleScenarioLoaderCount, 0);
  assert.equal(moduleRegistry.registrationPolicy.moduleScenarioLoaderAllowed, false);
  assert.equal(moduleRegistry.registrationPolicy.resourceEntryMode, "home-directory-auto-context");
  const index = source(join(COMPOSITE_ROOT, "s001-e2e-integration/index.html"));
  const shellApp = source(join(COMPOSITE_ROOT, "s001-e2e-integration/app.js"));
  const shellCss = source(join(COMPOSITE_ROOT, "s001-e2e-integration/styles.css"));
  assert.equal((index.match(/id=["']app["']/g) || []).length, 1);
  assert.doesNotMatch(`${shellApp}\n${shellCss}`, /module-catalog|module-resource-items|resource-chip|data-module-scenario|toggle-catalog/);
  for (const path of candidateFiles().filter((candidate) => candidate.includes(`${sep}modules${sep}`) && [".html", ".css", ".js"].includes(extname(candidate)) && !candidate.includes(`${sep}test${sep}`))) {
    const text = source(path);
    assert.doesNotMatch(text, /class=["'][^"']*platform-shell|class=["'][^"']*global-nav|class=["'][^"']*shell-topbar/i, `${posixPath(relative(WORK_ROOT, path))} declares a nested platform shell`);
  }
});

check("v1.1 brand and home baseline structure is preserved", () => {
  const testPath = "composite/s001-e2e-integration/baseline-parity.test.mjs";
  const result = spawnSync(process.execPath, ["--test", testPath], { cwd: WORK_ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout || ""}${result.stderr || ""}`);
  const appSource = source(join(COMPOSITE_ROOT, "s001-e2e-integration/app.js"));
  const cssSource = source(join(COMPOSITE_ROOT, "s001-e2e-integration/styles.css"));
  for (const token of ["brand-mark brand-mark-ai", "brand-brain", "scheme-a-home", "home-status-strip", "classic-home-frame", "architecture-cycle", "classic-domain-detail", "home-chain-track", "home-summary-grid", "从可信数据到可追溯行动"]) {
    assert(appSource.includes(token) || cssSource.includes(token), `baseline home token missing: ${token}`);
  }
  assert.equal(stateContext().OFW_V120_STORE.s005Progress().done, 0);
  assert.equal(stateContext().OFW_V120_STORE.s005Progress().total, 7);
});

check("candidate Dashboard preserves baseline and integrates S005", () => {
  const dashboard = moduleRegistry.modules.find((module) => module.resourceOwnerId === "Dashboard");
  assert.equal(dashboard.entry, "composite/dashboard/index.html");
  assert.equal(dashboard.sourceEntry, "../../prototype-releases/v1.1.0/dashboard/index.html");
  assert.equal(dashboard.assetMode, "candidate-incremental-overlay");
  assert.equal(browserData.OFW_V120_DATA.dashboard.source, "../dashboard/index.html?v=20260828-01");
  const testPath = "composite/dashboard/dashboard.contract.test.mjs";
  const result = spawnSync(process.execPath, ["--test", testPath], { cwd: WORK_ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout || ""}${result.stderr || ""}`);
});

check("visible internal copy is scrubbed", () => {
  const appSource = source(join(COMPOSITE_ROOT, "s001-e2e-integration/app.js"));
  const replacements = [
    ["交互原型", "业务工作台"], ["原型", "工作台"], ["演示环境", "业务工作区"], ["演示数据", "业务数据"],
    ["研究夹具", "参考数据"], ["合成预览", "结果预览"], ["研究服务", "模型服务"], ["研究角色模拟", "角色视图"],
    ["统一原型入口", "统一工作台"], ["方案说明", "业务说明"], ["评审环境", "业务工作区"]
  ];
  const escapedUnicode = (value) => Array.from(value, (character) => `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`).join("");
  for (const [from, to] of replacements) {
    const literalPair = `["${from}", "${to}"]`;
    const escapedPair = `["${escapedUnicode(from)}", "${escapedUnicode(to)}"]`;
    assert(appSource.includes(literalPair) || appSource.includes(escapedPair), `scrubber missing ${from}`);
  }
  assert.match(appSource, /scrubInternalCopy\(doc\)/);
  const visibleFiles = candidateFiles().filter((path) => [".html", ".js", ".json"].includes(extname(path)) && !path.includes(`${sep}tests${sep}`) && !path.includes(`${sep}test${sep}`) && !path.includes(`${sep}validation${sep}`));
  for (const path of visibleFiles) {
    let renderedText = source(path);
    for (const [from, to] of replacements) renderedText = renderedText.replaceAll(from, to);
    assert.doesNotMatch(renderedText, /演示|原型|研究夹具|方案说明|模拟(?:页面|环境|角色|成功提示|完成提示|产品壳)/, `${posixPath(relative(WORK_ROOT, path))} leaves internal copy visible`);
  }
});

check("frozen v1.1.0 tree is unchanged", () => {
  const changed = gitOutput(["diff", "--name-only", SOURCE_COMMIT, "--", FROZEN_RELATIVE]);
  const untracked = gitOutput(["ls-files", "--others", "--exclude-standard", "--", FROZEN_RELATIVE]);
  assert.equal(changed, "", `tracked frozen changes:\n${changed}`);
  assert.equal(untracked, "", `untracked frozen files:\n${untracked}`);
  assert.equal(manifest.sourceBaseline.referenceMode, "read-only-relative");
  assert.equal(manifest.composition.copiedFrozenTree, false);
});

check("artifact inventory matches candidate files", () => {
  assert.equal(manifest.artifactInventory.status, "complete", "run node composite/tests/refresh-manifest.mjs first");
  const actual = candidateFiles().map((path) => ({
    path: posixPath(relative(WORK_ROOT, path)),
    bytes: statSync(path).size,
    sha256: sha256(path)
  })).sort((left, right) => left.path.localeCompare(right.path, "en"));
  assert.equal(manifest.artifactInventory.fileCount, actual.length);
  assert.equal(manifest.artifactInventory.totalBytes, actual.reduce((sum, file) => sum + file.bytes, 0));
  assert.deepEqual(manifest.artifactInventory.files, actual);
});

check("regression matrix is complete without unexecuted success claims", () => {
  assert.equal(matrix.cases.length, 21);
  assert.equal(new Set(matrix.cases.map((item) => item.id)).size, matrix.cases.length);
  const requiredAreas = ["entry-and-routing", "single-shell", "resource-catalog", "handoff", "refresh", "history", "deep-link", "reset-isolation", "viewport-1440", "viewport-1280", "viewport-mobile", "runtime-errors", "frozen-integrity", "baseline-shell-home-parity", "dashboard-s005-integration"];
  for (const area of requiredAreas) assert(matrix.cases.some((item) => item.area === area), `matrix missing ${area}`);
  for (const item of matrix.cases) {
    assert(matrix.statusVocabulary.includes(item.status), `${item.id} has unsupported status`);
    if (item.status === "passed") {
      assert(item.observedAt, `${item.id} passed without observedAt`);
      assert(item.evidence.length, `${item.id} passed without evidence`);
      assert.equal(item.observedAt, browserEvidence.observedAt, `${item.id} observedAt does not match browser evidence`);
      for (const reference of item.evidence) {
        if (reference.startsWith("node ")) continue;
        const file = reference.split("#")[0];
        assert(existsSync(join(WORK_ROOT, file)), `${item.id} evidence target missing: ${file}`);
      }
    }
  }
  assert.equal(matrix.runStatus, "passed");
  assert.deepEqual(matrix.runSummary, { passed: 21, failed: 0, blocked: 0, pending: 0, lastObservedAt: browserEvidence.observedAt });
  assert.equal(browserEvidence.routeCoverage.result, "passed");
  assert.equal(browserEvidence.routeCoverage.routes.length, 10);
  assert.equal(browserEvidence.routeCoverage.meaningfulContent, 10);
  assert.equal(browserEvidence.routeCoverage.outerShellCount, 1);
  assert.equal(browserEvidence.routeCoverage.visibleNestedGlobalNavigationCount, 0);
  assert.equal(browserEvidence.routeCoverage.moduleScenarioLoaderCount, 0);
  assert.deepEqual(browserEvidence.viewports.map((item) => item.size), ["1440x900", "1280x720", "390x844"]);
  assert(browserEvidence.viewports.every((item) => item.result === "passed" && item.routesChecked === 10 && item.blankPages === 0 && item.outerHorizontalOverflows === 0 && item.iframeHorizontalOverflows === 0));
  assert.equal(browserEvidence.handoff.result, "passed");
  assert.equal(browserEvidence.handoff.identityFieldsExact, true);
  assert.equal(browserEvidence.handoff.returnedToM07, true);
  assert.equal(browserEvidence.baselineParity.result, "passed");
  assert.equal(browserEvidence.baselineParity.brandAssetExact, true);
  assert.equal(browserEvidence.baselineParity.moduleChainCount, 8);
  assert.equal(browserEvidence.baselineParity.s005InitialProgress, "0/7");
  assert.equal(browserEvidence.dashboardS005.result, "passed");
  assert.equal(browserEvidence.dashboardS005.directoryCount, 4);
  assert.equal(browserEvidence.dashboardS005.scenarioId, "S005");
  assert.equal(browserEvidence.dashboardS005.scenarioVersion, "S005-v1");
  assert.equal(browserEvidence.dashboardS005.status, "部分评价");
  assert.equal(browserEvidence.dashboardS005.productCount, 5);
  assert.equal(browserEvidence.dashboardS005.nestedPlatformShellCount, 0);
  assert.deepEqual(browserEvidence.navigationState.historyForwardPath, ["#home", "#module/m07", "#module/modeling", "#module/m07"]);
  assert.deepEqual(browserEvidence.navigationState.historyBackSequence, ["#module/modeling", "#module/m07", "#home"]);
  assert.deepEqual(browserEvidence.navigationState.historyForwardSequence, ["#module/m07", "#module/modeling", "#module/m07"]);
  assert.deepEqual(browserEvidence.runtimeErrors, { consoleErrors: 0, consoleWarnings: 0, pageErrorOverlays: 0, failedResourceRequests: 0, externalMapRequests: 0, result: "passed" });
  assert.equal(manifest.verification.fullRegressionStatus, "passed");
  assert.equal(manifest.verification.browserEvidence, "composite/evidence/browser-regression.json");
});

check("candidate handoff adapter pending governance executes the actual M07 payload builder through M08", () => {
  const testPath = "composite/tests/m07-m08-runtime.test.mjs";
  const result = spawnSync(process.execPath, ["--test", testPath], { cwd: WORK_ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout || ""}${result.stderr || ""}`);
  const request = contractChanges.requests.find((item) => item.id === "CR-V120-001");
  assert.equal(request?.status, "CANDIDATE_ADAPTER_IMPLEMENTED_PENDING_GOVERNANCE");
  assert(request.resolutionEvidence.includes(testPath), "CR-V120-001 must cite the executable cross-package test");
});

console.log(`\n${passed} checks passed; ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
