import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = path.resolve(root, "../../..");
const matrixPath = path.join(root, "COMPOSITE-REGRESSION-MATRIX.json");
const browserEvidencePath = path.join(root, "composite/evidence/browser-regression.json");

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout || ""}${result.stderr || ""}`);
  }
  return String(result.stdout || "").trim();
}

const executedCommands = [
  ["node", ["--test", "composite/s001-e2e-integration/state.contract.test.mjs"], root],
  ["node", ["--test", "composite/s001-e2e-integration/baseline-parity.test.mjs"], root],
  ["node", ["--test", "composite/dashboard/dashboard.contract.test.mjs"], root],
  ["node", ["--test", "composite/resources/catalog.test.mjs"], root],
  ["node", ["--test", "composite/modules/m07/tests/contracts.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/test/static-contract.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/validation/test/model-governance.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/validation/test/objective-registry.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/validation/test/server.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/validation/test/simulation.test.mjs"], root],
  ["node", ["--test", "composite/modules/modeling/consumer/result-projection.contract.test.mjs"], root],
  ["node", ["--test", "composite/scenarios/s005/tests/runtime.test.mjs"], root],
  ["node", ["--test", "composite/scenarios/s005/tests/evaluation-engine.test.mjs"], root],
  ["node", ["--test", "composite/scenarios/s005/tests/module-workbench.contract.test.mjs"], root],
  ["node", ["--test", "composite/tests/m07-m08-runtime.test.mjs"], root],
  ["node", ["--test", "composite/tests/start-candidate.test.mjs"], root],
  ["node", ["designs/prototype-releases/verify-release.mjs", "1.1.0"], repositoryRoot],
  ["node", ["designs/scenario-checkpoints/baselines/v1.1.0/verify-baseline.mjs"], repositoryRoot]
];
for (const [command, args, cwd] of executedCommands) run(command, args, cwd);

const browser = JSON.parse(fs.readFileSync(browserEvidencePath, "utf8"));
assert.equal(browser.candidateVersion, "v1.2.0-rc.1");
assert.ok(!Number.isNaN(Date.parse(browser.observedAt)), "browser evidence requires a valid observedAt");
assert.equal(browser.routeCoverage.result, "passed");
assert.equal(browser.routeCoverage.routes.length, 10);
assert.equal(browser.routeCoverage.meaningfulContent, 10);
assert.equal(browser.routeCoverage.outerShellCount, 1);
assert.equal(browser.routeCoverage.outerGlobalNavigationCount, 1);
assert.equal(browser.routeCoverage.visibleNestedGlobalNavigationCount, 0);
assert.equal(browser.routeCoverage.moduleScenarioLoaderCount, 0);
assert.deepEqual(browser.viewports.map((item) => item.size), ["1440x900", "1280x720", "390x844"]);
for (const viewport of browser.viewports) {
  assert.equal(viewport.result, "passed", `${viewport.size} did not pass`);
  assert.equal(viewport.routesChecked, 10, `${viewport.size} route coverage incomplete`);
  assert.equal(viewport.blankPages, 0);
  assert.equal(viewport.outerHorizontalOverflows, 0);
  assert.equal(viewport.iframeHorizontalOverflows, 0);
  assert.equal(viewport.clippedCommandButtons, 0);
}
assert.equal(browser.resourceCatalog.result, "passed");
assert.equal(browser.resourceCatalog.registeredResources, 45);
assert.equal(browser.resourceCatalog.crossScenarioFallbackObserved, false);
assert.equal(browser.handoff.result, "passed");
assert.equal(browser.handoff.identityFieldsExact, true);
assert.equal(browser.handoff.identityDriftObserved, false);
assert.equal(browser.handoff.objectRestored, true);
assert.equal(browser.handoff.returnedToM07, true);
assert.equal(browser.handoff.crossObjectSeriesFallbackObserved, false);
assert.equal(browser.baselineParity.result, "passed");
assert.equal(browser.baselineParity.brandAssetExact, true);
assert.equal(browser.baselineParity.homeSkeletonPreserved, true);
assert.equal(browser.baselineParity.moduleChainCount, 8);
assert.equal(browser.baselineParity.s005InitialProgress, "0/7");
assert.equal(browser.dashboardS005.result, "passed");
assert.equal(browser.dashboardS005.directoryCount, 4);
assert.equal(browser.dashboardS005.scenarioId, "S005");
assert.equal(browser.dashboardS005.scenarioVersion, "S005-v1");
assert.equal(browser.dashboardS005.status, "部分评价");
assert.equal(browser.dashboardS005.nestedPlatformShellCount, 0);
assert.equal(browser.dashboardS005.currentRunOnly, true);
assert.equal(browser.dashboardS005.domainCount, 6);
assert.equal(browser.dashboardS005.metricCount, 34);
assert.equal(browser.dashboardS005.fixedFixtureResultReadObserved, false);
assert.equal(browser.s005ActualChain.result, "passed");
assert.equal(browser.s005ActualChain.progressBefore, "0/7");
assert.equal(browser.s005ActualChain.progressAfter, "7/7");
assert.equal(browser.s005ActualChain.sameFiveFieldIdentity, true);
assert.equal(browser.s005ActualChain.dashboardUpdatedFromCurrentRun, true);
assert.equal(browser.s005ActualChain.resetProgress, "0/7");
assert.equal(browser.s005ActualChain.archivedScenariosChanged, 0);
assert.equal(browser.s005Boundaries.result, "passed");
assert.equal(browser.s005Boundaries.weeklySharpeAnnualizedAsDaily, false);
assert.equal(browser.s005Boundaries.m04SideEffects, 0);
assert.equal(browser.s005Boundaries.modelingFactCoverageIncrement, 0);
assert.equal(browser.m08ObjectiveWorkspace.result, "passed");
assert.deepEqual(browser.m08ObjectiveWorkspace.scopes, ["全部目标", "当前场景"]);
assert.deepEqual(browser.m08ObjectiveWorkspace.objectiveKinds, ["FORECAST", "CLASSIFICATION", "SCORING", "OPTIMIZATION"]);
assert.equal(browser.m08ObjectiveWorkspace.simulationLifecycleStage, false);
assert.equal(browser.s003ContinuousOptimization.result, "passed");
assert.equal(browser.s003ContinuousOptimization.candidateCount, 3);
assert.equal(browser.s003ContinuousOptimization.dataRequiredCandidates, 1);
assert.equal(browser.s003ContinuousOptimization.maturityWindows, 3);
assert.equal(browser.s003ContinuousOptimization.holdoutUseCount, 1);
assert.equal(browser.s003DashboardProjection.result, "passed");
assert.equal(browser.s003DashboardProjection.enterpriseCount, 21);
assert.deepEqual(browser.s003DashboardProjection.views, ["正式结果", "候选试算", "差异"]);
assert.equal(browser.modelingConsumers.result, "passed");
assert.deepEqual(browser.modelingConsumers.readOnlyModules, ["M03", "M05", "M06", "M07", "Dashboard"]);
assert.equal(browser.modelingConsumers.m04Blocked, true);
assert.equal(browser.s003ArchivedIdentity.result, "passed");
assert.equal(browser.s003ArchivedIdentity.archivedRunChanged, false);
assert.equal(browser.bindingAndTruthBoundaries.result, "passed");
assert.equal(browser.bindingAndTruthBoundaries.m04Code, "NON_FACT_SOURCE_REJECTED");
assert.equal(browser.bindingAndTruthBoundaries.factPredictionSimulationIsolated, true);
assert.equal(browser.launcherAndCache.result, "passed");
assert.equal(browser.launcherAndCache.singleLauncher, true);
assert.equal(browser.launcherAndCache.legacyHashRedirected, true);
assert.equal(browser.navigationState.result, "passed");
assert.deepEqual(browser.navigationState.refreshRoutes, ["#home", "#module/ontology", "#module/m07", "#module/modeling"]);
assert.deepEqual(browser.navigationState.historyForwardPath, ["#home", "#module/m07", "#module/modeling", "#module/m07"]);
assert.deepEqual(browser.navigationState.historyBackSequence, ["#module/modeling", "#module/m07", "#home"]);
assert.deepEqual(browser.navigationState.historyForwardSequence, ["#module/m07", "#module/modeling", "#module/m07"]);
assert.equal(browser.resetIsolation.result, "passed");
assert.equal(browser.resetIsolation.behavioralTestsPassed, 9);
assert.equal(browser.resetIsolation.archivedScenariosChanged, 0);
assert.deepEqual(browser.runtimeErrors, {
  consoleErrors: 0,
  consoleWarnings: 0,
  pageErrorOverlays: 0,
  failedResourceRequests: 0,
  externalMapRequests: 0,
  result: "passed"
});
for (const screenshot of browser.screenshots) assert.ok(fs.existsSync(path.join(root, screenshot)), `missing screenshot: ${screenshot}`);

const evidence = {
  "CRG-001": ["composite/evidence/browser-regression.json#routeCoverage", "composite/evidence/screenshots/home-1440x900.png"],
  "CRG-002": ["composite/evidence/browser-regression.json#routeCoverage", "node composite/tests/verify-candidate.mjs"],
  "CRG-003": ["node composite/tests/verify-candidate.mjs", "MODULE-REGISTRY.json"],
  "CRG-004": ["node --test composite/resources/catalog.test.mjs", "composite/evidence/browser-regression.json#resourceCatalog"],
  "CRG-005": ["node --test composite/s001-e2e-integration/state.contract.test.mjs", "SCENARIO-REGISTRY.json#archivedIdentityProtection"],
  "CRG-006": ["composite/evidence/browser-regression.json#handoff", "node --test composite/tests/m07-m08-runtime.test.mjs"],
  "CRG-007": ["node --test composite/tests/m07-m08-runtime.test.mjs", "node --test composite/modules/modeling/test/static-contract.test.mjs"],
  "CRG-008": ["composite/evidence/browser-regression.json#navigationState"],
  "CRG-009": ["composite/evidence/browser-regression.json#navigationState"],
  "CRG-010": ["composite/evidence/browser-regression.json#routeCoverage"],
  "CRG-011": ["node --test composite/s001-e2e-integration/state.contract.test.mjs", "composite/evidence/browser-regression.json#resetIsolation"],
  "CRG-012": ["composite/evidence/browser-regression.json#viewports/0", "composite/evidence/screenshots/home-1440x900.png", "composite/evidence/screenshots/m08-1440x900.png"],
  "CRG-013": ["composite/evidence/browser-regression.json#viewports/1", "composite/evidence/screenshots/home-1280x720.png", "composite/evidence/screenshots/m01-1280x720.png"],
  "CRG-014": ["composite/evidence/browser-regression.json#viewports/2", "composite/evidence/screenshots/home-390x844.png", "composite/evidence/screenshots/m07-390x844.png", "composite/evidence/screenshots/m08-390x844.png"],
  "CRG-015": ["composite/evidence/browser-regression.json#runtimeErrors"],
  "CRG-016": ["node designs/prototype-releases/verify-release.mjs 1.1.0", "node designs/scenario-checkpoints/baselines/v1.1.0/verify-baseline.mjs"],
  "CRG-017": ["node composite/tests/verify-candidate.mjs", "COMPOSITE-MANIFEST.json#composition"],
  "CRG-018": ["node composite/tests/verify-candidate.mjs", "composite/evidence/browser-regression.json#routeCoverage"],
  "CRG-019": ["COMPOSITE-MANIFEST.json#stateSeparation", "node composite/tests/verify-candidate.mjs"],
  "CRG-020": ["node --test composite/s001-e2e-integration/baseline-parity.test.mjs", "composite/evidence/browser-regression.json#baselineParity", "composite/evidence/screenshots/home-1440x900.png", "composite/evidence/screenshots/home-390x844.png"],
  "CRG-021": ["node --test composite/dashboard/dashboard.contract.test.mjs", "composite/evidence/browser-regression.json#dashboardS005", "composite/evidence/screenshots/dashboard-s005-1440x900.png", "composite/evidence/screenshots/dashboard-s005-390x844.png"],
  "CRG-022": ["node --test composite/s001-e2e-integration/state.contract.test.mjs", "node --test composite/scenarios/s005/tests/evaluation-engine.test.mjs", "composite/evidence/browser-regression.json#s005ActualChain"],
  "CRG-023": ["node --test composite/scenarios/s005/tests/evaluation-engine.test.mjs", "node --test composite/scenarios/s005/tests/module-workbench.contract.test.mjs", "composite/evidence/browser-regression.json#s005Boundaries"],
  "CRG-024": ["node --test composite/modules/modeling/test/static-contract.test.mjs", "composite/evidence/browser-regression.json#m08ObjectiveWorkspace", "composite/evidence/screenshots/m08-all-objectives-1440x900.png"],
  "CRG-025": ["node --test composite/modules/modeling/test/static-contract.test.mjs", "node --test composite/modules/modeling/validation/test/objective-registry.test.mjs"],
  "CRG-026": ["node --test composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs", "SCENARIO-REGISTRY.json#scenarios/2/modelingResearch"],
  "CRG-027": ["node --test composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs", "composite/evidence/browser-regression.json#s003ContinuousOptimization"],
  "CRG-028": ["node --test composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs", "composite/evidence/screenshots/m08-s003-candidates-1440x900.png"],
  "CRG-029": ["node --test composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs", "composite/evidence/screenshots/m08-s003-shadow-1440x900.png"],
  "CRG-030": ["node --test composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs", "composite/evidence/browser-regression.json#bindingAndTruthBoundaries"],
  "CRG-031": ["node --test composite/dashboard/dashboard.contract.test.mjs", "composite/evidence/browser-regression.json#s003DashboardProjection", "composite/evidence/screenshots/dashboard-s003-diff-1440x900.png"],
  "CRG-032": ["node --test composite/modules/modeling/consumer/result-projection.contract.test.mjs", "node --test composite/modules/m07/tests/contracts.test.mjs", "composite/evidence/browser-regression.json#modelingConsumers"],
  "CRG-033": ["node --test composite/s001-e2e-integration/state.contract.test.mjs", "node --test composite/modules/modeling/validation/test/simulation.test.mjs", "composite/evidence/browser-regression.json#bindingAndTruthBoundaries"],
  "CRG-034": ["node --test composite/s001-e2e-integration/state.contract.test.mjs", "node --test composite/modules/modeling/validation/test/s003-continuous-optimization.test.mjs", "composite/evidence/browser-regression.json#s003ArchivedIdentity"],
  "CRG-035": ["composite/evidence/browser-regression.json#launcherAndCache", "composite/evidence/browser-regression.json#navigationState"],
  "CRG-036": ["node --test composite/tests/start-candidate.test.mjs", "composite/evidence/browser-regression.json#launcherAndCache", "composite/evidence/screenshots/m08-s003-390x844.png"]
};

const matrix = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
for (const item of matrix.cases) {
  if (!evidence[item.id]) throw new Error(`Missing evidence mapping for ${item.id}`);
  item.status = "passed";
  item.observedAt = browser.observedAt;
  item.evidence = evidence[item.id];
}
matrix.runStatus = "passed";
matrix.runSummary = {
  passed: matrix.cases.length,
  failed: 0,
  blocked: 0,
  pending: 0,
  lastObservedAt: browser.observedAt
};
matrix.acceptanceReady = false;
fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`executed ${executedCommands.length} verification commands and recorded ${matrix.cases.length} cases at ${browser.observedAt}`);
