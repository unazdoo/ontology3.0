import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const storage = new Map();
const sandbox = {
  console, URLSearchParams,
  location: { search: "", hash: "", pathname: "/ontology-management/index.html", replace() {} },
  history: { replaceState() {} }, document: { readyState: "loading" },
  addEventListener() {}, requestAnimationFrame() {}, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const run = relative => vm.runInContext(fs.readFileSync(path.join(here, relative), "utf8"), sandbox, { filename: relative });

run("../../composite-resource-registry.js");
run("portfolio-s001-seed.js");
run("portfolio-s002-seed.js");
run("../../scenarios/s004-runtime-v2.1.0/seed-data.js");
run("portfolio-integration.js");

const state = sandbox.window.OFW_M01_PORTFOLIO_STATE;
const groups = new Set(state.publishedVersions.map(version => version.ontologyStableId));
assert.equal(groups.size, 4, "published ontology catalog must contain four ontologies");
for (const scenarioId of ["S001", "S002", "S003", "S004"]) {
  assert.ok(state.publishedVersions.some(version => version.scenarioContext?.scenarioId === scenarioId), `${scenarioId} published ontology missing`);
  assert.ok(state.scenarioContexts?.[scenarioId], `${scenarioId} modeling context missing`);
}
const s003 = state.publishedVersions.find(version => version.scenarioContext?.scenarioId === "S003");
assert.equal(s003.dataContract.assetVersion, "S003-T007-DEBT-RISK-20251231-v1");
assert.doesNotMatch(JSON.stringify(s003), /FORMAL-CANDIDATE|兼容性验证|不可消费/);
assert.match(fs.readFileSync(path.join(here, "app.js"), "utf8"), /const ontologyCount = new Set\(state\.publishedVersions\.map/);
assert.match(fs.readFileSync(path.join(here, "app.js"), "utf8"), /activateScenarioForVersion\(version\)/);

console.log(`PASS M01 portfolio: ${groups.size} published ontologies and revision contexts verified.`);
