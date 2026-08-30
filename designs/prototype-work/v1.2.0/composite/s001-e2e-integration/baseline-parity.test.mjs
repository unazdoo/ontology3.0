import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.resolve(root, "../..");
const repositoryRoot = path.resolve(workRoot, "../../..");
const frozenRoot = path.join(repositoryRoot, "designs/prototype-releases/v1.1.0/s001-e2e-integration");
const read = (file) => fs.readFileSync(file, "utf8");
const candidateApp = read(path.join(root, "app.js"));
const candidateCss = read(path.join(root, "styles.css"));
const frozenApp = read(path.join(frozenRoot, "app.js"));

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear()
  };
}

function loadStore() {
  const context = vm.createContext({
    console,
    URLSearchParams,
    Date,
    Math,
    JSON,
    Uint8Array,
    crypto: { randomUUID: () => "00112233-4455-6677-8899-aabbccddeeff" },
    location: { search: "", hash: "#home" },
    localStorage: storage(),
    sessionStorage: storage(),
    matchMedia: () => ({ matches: false }),
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options?.detail; } }
  });
  context.window = context;
  context.globalThis = context;
  for (const file of [
    path.join(workRoot, "composite/scenarios/s005/scenario-config.js"),
    path.join(workRoot, "composite/scenarios/s005/scenario-adapter.js"),
    path.join(root, "data.js"),
    path.join(root, "state.js")
  ]) vm.runInContext(read(file), context, { filename: file });
  return context;
}

test("candidate uses the exact frozen brain-network brand asset", () => {
  const frozenMatch = frozenApp.match(/brainCircuit:\s*'([^']+)'/);
  const candidateMatch = candidateApp.match(/const BRAND_BRAIN_SVG = '([^']+)'/);
  assert(frozenMatch, "frozen brainCircuit asset missing");
  assert(candidateMatch, "candidate brand asset missing");
  assert.equal(candidateMatch[1], frozenMatch[1]);
  assert.match(candidateApp, /brand-mark brand-mark-ai/);
  assert.match(candidateApp, /class="icon brand-brain"/);
});

test("candidate preserves frozen brand motion and home information architecture", () => {
  for (const token of [
    "brain-mesh-outline", "brain-mesh-edge", "brain-mesh-seam", "brain-mesh-signal", "brain-mesh-node",
    "brand-brain-float", "brand-brain-signal", "brand-brain-flash",
    "scheme-a-home", "home-status-strip", "classic-home-frame", "architecture-cycle", "architecture-node",
    "classic-core", "classic-domain-detail", "home-chain-track", "home-summary-grid"
  ]) assert(candidateApp.includes(token) || candidateCss.includes(token), `missing baseline token ${token}`);
  assert.match(candidateApp, /从可信数据到可追溯行动/);
  assert.match(candidateApp, /const HOME_DOMAIN_ORDER = \["foundation", "intelligence", "action"\]/);
});

test("baseline home is extended by M07 and M08 without replacing its structure", () => {
  const domains = candidateApp.slice(candidateApp.indexOf("const HOME_DOMAINS"), candidateApp.indexOf("const BRAND_BRAIN_SVG"));
  for (const moduleId of ["data", "ontology", "query", "decision", "agent", "report", "m07", "modeling"]) {
    assert(domains.includes(`"${moduleId}"`), `home domains missing ${moduleId}`);
  }
  assert.match(candidateApp, /const chain = DATA\.modules\.map/);
  const frameIndex = candidateApp.indexOf("classic-home-frame");
  const resourceIndex = candidateApp.indexOf("${unifiedResourcePanel()}", frameIndex);
  assert(frameIndex >= 0 && resourceIndex > frameIndex, "unified resource directory must follow the baseline home frame");
});

test("five-scene status remains honest at a fresh S005 run", () => {
  const context = loadStore();
  const definitions = context.OFW_V120_DATA.scenarios;
  assert.deepEqual(Array.from(definitions, (scenario) => scenario.id), ["S001", "S002", "S003", "S004", "S005"]);
  assert(definitions.slice(0, 4).every((scenario) => scenario.archived && scenario.status === "completed"));
  assert.equal(definitions[4].archived, false);
  assert.deepEqual({ ...context.OFW_V120_STORE.s005Progress() }, { done: 0, total: 7, active: 0, blocked: 0 });
});

test("module workspaces open directly without a scenario resource loader", () => {
  const stateSource = read(path.join(root, "state.js"));
  const removedTokens = [
    "resourceCatalogMarkup", "moduleResourceItems", "module-catalog", "module-resource-items", "resource-chip",
    "toggle-catalog", "data-module-scenario", "data-module-status", "catalogOpen", "moduleFilters"
  ];
  for (const token of removedTokens) {
    assert(!candidateApp.includes(token) && !candidateCss.includes(token) && !stateSource.includes(token), `scenario loader token remains: ${token}`);
  }
  assert(candidateApp.includes('${breadcrumb(module)}<section class="frame-stage">'), "module content must follow the breadcrumb directly");
  assert.match(candidateApp, /STORE\.selectResource\(resource\.moduleId, resource\.id, resource\.scenarioId\)/, "home resource entry must still carry context automatically");
  const state = loadStore().OFW_V120_STORE.get();
  assert.equal(Object.hasOwn(state, "catalogOpen"), false);
  assert.equal(Object.hasOwn(state, "moduleFilters"), false);
});
