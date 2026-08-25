const fs = require("fs");
const path = require("path");
const vm = require("vm");

const s001Root = path.resolve(__dirname, "../../../../../../s001-v1.0.7/designs/prototype-work/v1.0.7");
const snapshotPath = path.join(s001Root, "runtime-snapshots/S001-RUN-20260816081748567-705ac89fb83a.runtime.json");
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const s001M01 = JSON.parse(snapshot.localStorage["ontology3-canvas-first-review-v17"]);
const s001M02 = JSON.parse(snapshot.localStorage["ontology3.data-engineering.workspace.v5-handoff"]);

function assignment(name, value) {
  return `(function(){window.${name}=Object.freeze(${JSON.stringify(value)});})();\n`;
}

fs.writeFileSync(path.join(__dirname, "portfolio-s001-seed.js"), assignment("OFW_M01_S001_SEED", s001M01));
fs.writeFileSync(path.resolve(__dirname, "../../data-engineering-prototype-review/review-v3/portfolio-s001-flow-seed.js"), assignment("OFW_M02_S001_FLOW_SEED", s001M02));

const s002Adapter = path.resolve(__dirname, "../../scenarios/s002/baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js");
const store = new Map();
const localStorage = {
  getItem: (key) => store.has(key) ? store.get(key) : null,
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};
const location = {
  search: "?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=S002-RUN-20260815080000000-6ef5d0ef82f9&formedAt=2026-08-15T08:00:00.000Z&status=active&m02AssetPublished=1&m01MappingApplied=1&m01OntologyPublished=1&m01Ready=1",
  hash: "", pathname: "/portfolio-seed", href: "http://127.0.0.1/portfolio-seed"
};
const document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: { dataset: {} },
  createDocumentFragment: () => ({ append() {} }),
  createElement: () => ({ dataset: {}, append() {}, querySelectorAll: () => [] })
};
class MutationObserver { observe() {} }
const window = {
  localStorage, location, document, MutationObserver,
  history: { replaceState() {} },
  addEventListener() {},
  setTimeout(callback) { callback(); return 1; },
  clearTimeout() {}
};
window.window = window;
window.parent = window;
const context = {
  window, localStorage, location, document, MutationObserver,
  history: window.history, globalThis: window, URLSearchParams, URL,
  setTimeout: window.setTimeout, clearTimeout: window.clearTimeout, console
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(s002Adapter, "utf8"), context);
const s002M01 = JSON.parse(store.get("ontology3-canvas-first-review-v17"));
fs.writeFileSync(path.join(__dirname, "portfolio-s002-seed.js"), assignment("OFW_M01_S002_SEED", s002M01));

console.log("Portfolio seeds generated.");
