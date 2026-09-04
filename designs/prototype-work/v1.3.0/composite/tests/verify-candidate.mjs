import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const workRoot = resolve(testDir, "../..");
const compositeRoot = join(workRoot, "composite");
const repositoryRoot = resolve(workRoot, "../../..");
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
  return JSON.parse(readFileSync(join(workRoot, name), "utf8"));
}

function walk(root) {
  const output = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      output.push(target);
      if (entry.isDirectory() && !entry.isSymbolicLink()) visit(target);
    }
  };
  visit(root);
  return output;
}

function sha256(target) {
  return createHash("sha256").update(readFileSync(target)).digest("hex");
}

function posix(value) {
  return value.split(sep).join("/");
}

function localReference(value) {
  const cleaned = value.trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned || cleaned.startsWith("#") || /^(?:https?:|data:|mailto:|javascript:|about:)/i.test(cleaned)) return null;
  return decodeURIComponent(cleaned.split(/[?#]/)[0]);
}

function presentationReferences(target) {
  const text = readFileSync(target, "utf8");
  const refs = [];
  if (extname(target) === ".html") {
    for (const match of text.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) refs.push(match[1]);
  }
  if (extname(target) === ".css") {
    for (const match of text.matchAll(/url\(\s*([^)]+?)\s*\)/gi)) refs.push(match[1]);
  }
  return refs.map(localReference).filter(Boolean);
}

function loadCatalogAndData() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repositoryRoot, "designs/prototype-work/v1.2.0/composite/resources/catalog.js"), "utf8"), context);
  vm.runInContext(readFileSync(join(compositeRoot, "resources/catalog.js"), "utf8"), context);
  vm.runInContext(readFileSync(join(compositeRoot, "s001-e2e-integration/data.js"), "utf8"), context);
  return sandbox;
}

const version = json("VERSION.json");
const moduleRegistry = json("MODULE-REGISTRY.json");
const scenarioRegistry = json("SCENARIO-REGISTRY.json");
const manifest = json("COMPOSITE-MANIFEST.json");
const matrix = json("COMPOSITE-REGRESSION-MATRIX.json");
const integration = json("INTEGRATION-SOURCES.json");
const packageVerification = existsSync(join(workRoot, "PACKAGE-VERIFICATION.json")) ? json("PACKAGE-VERIFICATION.json") : null;
const browserEvidence = existsSync(join(compositeRoot, "evidence/browser-regression.json")) ? json("composite/evidence/browser-regression.json") : null;
const browserData = loadCatalogAndData();

check("candidate and parent identity", () => {
  assert.equal(version.version, "1.3.0-rc.1");
  assert.equal(version.parentCommit, "e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0");
  assert.equal(version.parentSubtree, "e57caf36b4a815b4d363ca93ee69305c12228938");
  assert.equal(version.acceptanceReady, false);
  assert.equal(manifest.candidateVersion, "v1.3.0-rc.1");
  assert.equal(manifest.acceptanceReady, false);
  assert.equal(matrix.acceptanceReady, false);
});

check("single Shell and canonical routes", () => {
  assert.equal(moduleRegistry.shell.count, 1);
  assert.equal(moduleRegistry.shell.nestedPlatformShellAllowed, false);
  assert.equal(moduleRegistry.modules.length, 9);
  assert.equal(new Set(moduleRegistry.modules.map((item) => item.route)).size, 9);
  assert.deepEqual(moduleRegistry.moduleOrder, ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "Dashboard"]);
  assert(existsSync(join(workRoot, moduleRegistry.shell.entry)));
  const shellHtml = readFileSync(join(workRoot, moduleRegistry.shell.entry), "utf8");
  assert.match(shellHtml, /v1\.2\.0\/composite\/s001-e2e-integration\/styles\.css/);
  assert.match(shellHtml, /\.\/app\.js/);
  assert.equal(moduleRegistry.shell.renderer, "composite/s001-e2e-integration/app.js");
  assert.equal(moduleRegistry.shell.rendererBaseline, "../v1.2.0/composite/s001-e2e-integration/app.js");
  assert.equal(existsSync(join(compositeRoot, "s001-e2e-integration/app.js")), true);
});

check("v1.2 visual baseline is preserved by selective local derivatives", () => {
  const shell = readFileSync(join(compositeRoot, "s001-e2e-integration/app.js"), "utf8");
  const parentShell = readFileSync(join(repositoryRoot, "designs/prototype-work/v1.2.0/composite/s001-e2e-integration/app.js"), "utf8");
  for (const token of ["BRAND_BRAIN_SVG", "classic-home-frame", "architecture-foot", "renderModule", "frameSource", "OFW_M07_OPEN_M08"]) {
    assert(parentShell.includes(token) && shell.includes(token), token);
  }
  const data = readFileSync(join(compositeRoot, "s001-e2e-integration/data.js"), "utf8");
  const integrations = readFileSync(join(compositeRoot, "integrations/native-module-integrations.js"), "utf8");
  const modelCenter = readFileSync(join(compositeRoot, "model-center/app.js"), "utf8");
  assert.match(data, /v1\.2\.0\/composite\/modules\/m07\/module\/workspace-v2\.html/);
  assert.match(data, /model-center\/index\.html/);
  assert.doesNotMatch(shell, /S005_PARENT_WORKBENCH_ENTRY|module-workbench\.html|OFW_S003_WORKFLOWS/);
  assert.match(shell, /OFW_NATIVE_MODULE_INTEGRATIONS/);
  assert.match(shell, /MODULE_TASKS|module-subnav/);
  assert.doesNotMatch(shell, /SCENARIO_SCOPED_MODULES|data-module-scenario-select|module-scenario-control/);
  assert.doesNotMatch(shell, /scenarioPortfolioMarkup|场景运行与待办|data-scenario-card|统一资源目录|focus-scenario|switch-scenario/);
  assert.match(integrations, /modern-start\[hidden\]|data-open|ontology-open|agent-open|report-open|dashboard-open/);
  assert.doesNotMatch(integrations, /债务风险模型数据资产|债务风险模型语义合同|ofw-native-inline-model-data/);
  assert.match(integrations, /asset-resource-table|published-ontology-card|DATA_ASSET_NAMES|SEMANTIC_CONTRACT_NAMES/);
  assert.match(integrations, /正在确认问题范围|正在读取权威数据|正在整理业务结果|正在核对回答依据|正在生成回答/);
  assert.match(modelCenter, /模型优化中心|模型代码仓|监测与回退/);
  assert.equal(existsSync(join(compositeRoot, "workspaces/risk-cycle/entry.html")), false);
  assert.equal(existsSync(join(compositeRoot, "modules/modeling/consumer/result-projection.html")), false);
  assert.equal(existsSync(join(compositeRoot, "modules/m07/module/workspace-v2.html")), false);
  assert.deepEqual(manifest.composition.authorizedRedesignModules, ["M08"]);
  assert.deepEqual(moduleRegistry.modules.filter((item) => item.replacementPageAllowed === true).map((item) => item.resourceOwnerId), ["M08"]);
  assert.equal(moduleRegistry.modules.find((item) => item.resourceOwnerId === "M07").entry, "../v1.2.0/composite/modules/m07/module/workspace-v2.html");
  assert.equal(existsSync(join(compositeRoot, "modules/m07/resources/portfolio.json")), true);
  assert.equal(moduleRegistry.modules.find((item) => item.resourceOwnerId === "M08").entry, "composite/model-center/index.html");
});

check("five scenarios and 45 resources", () => {
  assert.deepEqual(scenarioRegistry.scenarios.map((item) => item.scenarioId), ["S001", "S002", "S003", "S004", "S005"]);
  assert.equal(browserData.OFW_V130_CATALOG.resources.length, 45);
  assert.equal(new Set(browserData.OFW_V130_CATALOG.resources.map((item) => `${item.moduleId}:${item.scenarioId}`)).size, 45);
  assert.equal(browserData.OFW_V130_DATA.scenarios.find((item) => item.default).id, "S005");
  assert.equal(browserData.OFW_V130_CATALOG.resource("ofw.v130.m07.s002").status, "available");
  assert.equal(browserData.OFW_V130_CATALOG.resource("ofw.v130.m07.s004").status, "available");
});

check("formal S003 hashes and immutable role", () => {
  const formalModel = join(repositoryRoot, "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json");
  const formalResults = join(repositoryRoot, "designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/c035-risk-results.v2.json");
  assert.equal(sha256(formalModel), manifest.formalBaseline.modelSourceSha256);
  assert.equal(sha256(formalResults), manifest.formalBaseline.resultSourceSha256);
  assert.equal(manifest.formalBaseline.immutable, true);
  assert.equal(manifest.formalBaseline.formalPointerMutable, false);
});

check("generic engine and S003 registration are separate", () => {
  const generic = readFileSync(join(compositeRoot, "runtime/model-portfolio-engine.mjs"), "utf8");
  const registration = readFileSync(join(compositeRoot, "runtime/s003-registration.mjs"), "utf8");
  assert.doesNotMatch(generic, /S003|Enterprise|债务风险|liquidityGap/);
  assert.match(registration, /S003_REGISTRATION/);
  assert.equal(moduleRegistry.modules.find((item) => item.resourceOwnerId === "M08").genericEngine, "composite/runtime/model-portfolio-engine.mjs");
});

check("model portfolio and truth boundaries", () => {
  assert.equal(manifest.modelPortfolio.objectiveCount, 8);
  assert.equal(manifest.modelPortfolio.modelCount, 10);
  assert.equal(manifest.modelPortfolio.coreChallengerCount, 2);
  assert.equal(manifest.modelPortfolio.supplementalModelCount, 7);
  assert.equal(manifest.modelPortfolio.aggregateScoreCreated, false);
  assert.equal(manifest.modelPortfolio.automaticChampionSelectionAllowed, false);
  assert.equal(manifest.resultContracts.hardRejectCode, "NON_FACT_SOURCE_REJECTED");
});

check("Python model repositories and M02/M01 traceability are registered", () => {
  const repositoryService = readFileSync(join(compositeRoot, "runtime/model-repository-service.mjs"), "utf8");
  const registration = readFileSync(join(compositeRoot, "runtime/s003-registration.mjs"), "utf8");
  const repositoryManifest = JSON.parse(readFileSync(join(compositeRoot, "model-repositories/s003/repository-manifest.json"), "utf8"));
  assert.equal(repositoryManifest.repositories.length, 10);
  assert.ok(repositoryManifest.repositories.every((item) => item.files.includes("README.md") && item.files.includes("model.py") && item.files.includes("tests/test_model.py")));
  assert.match(repositoryService, /runRepository|testRepository|createBranch|releaseCandidate/);
  assert.match(repositoryService, /FROZEN_DATA_VERSION_REQUIRED|SEMANTIC_CONTRACT_REQUIRED|PROTECTED_BRANCH|TAG_IMMUTABLE/);
  assert.match(registration, /dataAssets|modelBindings/);
});

check("isolated state and no runtime snapshot", () => {
  const stateSource = readFileSync(join(compositeRoot, "s001-e2e-integration/state.js"), "utf8");
  assert.match(stateSource, /ofw\.prototype\.v1\.3\.0/);
  assert.equal(manifest.composition.runtimeSnapshotIncluded, false);
  assert.equal(scenarioRegistry.scenarioIsolation.runtimeSnapshotIncluded, false);
  assert.equal(manifest.stateSeparation.formalFactsMutated, false);
  assert.equal(manifest.stateSeparation.externalSideEffects, 0);
});

check("all local presentation references resolve", () => {
  const presentationFiles = walk(compositeRoot).filter((target) => [".html", ".css"].includes(extname(target)));
  for (const target of presentationFiles) {
    for (const ref of presentationReferences(target)) {
      const resolved = resolve(dirname(target), ref);
      assert(existsSync(resolved), `${posix(relative(repositoryRoot, target))} -> ${ref}`);
    }
  }
});

check("candidate contains no symlinks or absolute source references", () => {
  for (const target of walk(workRoot)) assert.equal(lstatSync(target).isSymbolicLink(), false, target);
  for (const target of walk(compositeRoot).filter((entry) => lstatSync(entry).isFile() && [".html", ".css", ".js", ".mjs", ".json"].includes(extname(entry)))) {
    const source = readFileSync(target, "utf8");
    assert.doesNotMatch(source, /(?:src|href)=["']\/Users\//, target);
  }
});

check("navigation stability guards prevent refresh storms", () => {
  const shell = readFileSync(join(compositeRoot, "s001-e2e-integration/app.js"), "utf8");
  assert.match(shell, /其他窗口状态已变化/);
  assert.doesNotMatch(shell, /storage[\s\S]{0,180}location\.reload/);
  assert.match(shell, /function scheduleNavigationRender/);
  assert.match(shell, /addEventListener\("hashchange", scheduleNavigationRender\)/);
  assert.match(shell, /frame !== document\.getElementById\("module-frame"\)/);
  for (const target of walk(compositeRoot).filter((entry) => {
    if (!lstatSync(entry).isFile() || ![".html", ".js", ".mjs"].includes(extname(entry))) return false;
    const key = posix(relative(compositeRoot, entry));
    return !key.startsWith("tests/") && !key.startsWith("evidence/");
  })) {
    const source = readFileSync(target, "utf8");
    assert.doesNotMatch(source, /location\.replace|setInterval|MutationObserver/, target);
  }
});

check("artifact inventory matches files", () => {
  assert.equal(manifest.artifactInventory.status, "complete");
  const currentFiles = walk(compositeRoot).filter((target) => lstatSync(target).isFile()).sort();
  assert.equal(manifest.artifactInventory.fileCount, currentFiles.length);
  assert.equal(manifest.artifactInventory.totalBytes, currentFiles.reduce((sum, target) => sum + statSync(target).size, 0));
  const inventory = new Map(manifest.artifactInventory.files.map((item) => [item.path, item]));
  for (const target of currentFiles) {
    const key = posix(relative(workRoot, target));
    assert.equal(inventory.get(key)?.sha256, sha256(target), key);
  }
});

check("governance artifacts are present", () => {
  for (const name of manifest.governanceArtifacts) assert(existsSync(join(workRoot, name)), name);
  assert(existsSync(join(workRoot, "ACTUAL-CHANGES.md")));
  assert(existsSync(join(workRoot, "OPEN-ISSUES.md")));
});

check("integration inputs are read-only and minimal", () => {
  assert.equal(integration.parentPrototype.immutable, true);
  assert.equal(integration.parentPrototype.commit, version.parentCommit);
  assert.equal(integration.parentPrototype.wholeTreeCopied, false);
  assert.equal(integration.inputs.find((item) => item.id === "V120-SHELL")?.localDerivative, "composite/s001-e2e-integration/app.js");
  assert.ok(integration.inputs.every((item) => item.wholeDirectoryCopied !== true));
  assert.ok(integration.prohibitedInputs.includes("second platform Shell"));
});

check("final evidence and package verification are internally consistent", () => {
  assert(packageVerification, "PACKAGE-VERIFICATION.json missing");
  assert(browserEvidence, "browser-regression.json missing");
  assert.equal(packageVerification.targetPrototypeVersion, "v1.3.0-rc.1");
  assert.equal(packageVerification.acceptanceReady, false);
  assert.equal(browserEvidence.candidateVersion, "v1.3.0-rc.1");
  assert.equal(browserEvidence.runtimeErrors.applicationConsoleErrors, 0);
  assert.equal(browserEvidence.runtimeErrors.pageErrors, 0);
  assert.equal(browserEvidence.runtimeErrors.failedResourceRequests, 0);
  assert.equal(browserEvidence.stability.crossTabReloadsObserved, 0);
  assert.ok(browserEvidence.stability.historyBackFrameLoadDelta <= 1);
  assert.equal(browserEvidence.scenarioCoverage.result, "passed");
  assert.equal(browserEvidence.scenarioCoverage.totalPagesChecked, 50);
  assert.equal(browserEvidence.realModuleWorkflows.result, "passed");
  assert.equal(browserEvidence.modelManagement.navigationModeDesktop, "Shell-level vertical task navigation");
  assert.equal(browserEvidence.modelManagement.iframeNavigationVisible, false);
  assert.equal(browserEvidence.modelManagement.horizontalTaskMenuUsed, false);
  assert.equal(browserEvidence.realModuleWorkflows.homepage.scenarioOperationsVisible, false);
  assert.equal(browserEvidence.realModuleWorkflows.homepage.platformArchitectureVisible, true);
  assert.equal(browserEvidence.realModuleWorkflows.homepage.moduleDirectoryEntries, 0);
  assert.equal(browserEvidence.realModuleWorkflows.homepage.globalScenarioSwitcherVisible, false);
  assert.equal(browserEvidence.realModuleWorkflows.homepage.unifiedResourceDirectoryVisible, false);
  assert.equal(browserEvidence.realModuleWorkflows.m03Animation.observed.length, 5);
  assert.equal(browserEvidence.realModuleWorkflows.m03Animation.cancellation.startVisible, true);
  assert.equal(browserEvidence.realModuleWorkflows.m03Recommendations.observed.ALL, 51);
  assert.equal(browserEvidence.realModuleWorkflows.m03Recommendations.tabCount, 6);
  assert.equal(browserEvidence.realModuleWorkflows.m03Recommendations.frameReloads, 0);
  assert.equal(browserEvidence.realModuleWorkflows.m03Recommendations.baselineAnimationStep, "正在确认问题范围");
  assert.equal(browserEvidence.realModuleWorkflows.s003Traceability.dataCatalogNative, true);
  assert.equal(browserEvidence.realModuleWorkflows.s003Traceability.semanticCatalogNative, true);
  assert.equal(browserEvidence.realModuleWorkflows.s003Traceability.dataPromptPanels, 0);
  assert.equal(browserEvidence.realModuleWorkflows.s003Traceability.semanticPromptPanels, 0);
  assert.equal(browserEvidence.modelManagement.views.length, 5);
  assert.ok(Object.values(browserEvidence.realModuleWorkflows.m08Scroll.views).every((item) => item.documentScrollWorked));
  assert.equal(browserEvidence.realModuleWorkflows.m08Scroll.views.repository.internalScrollAvailable, true);
  assert.equal(browserEvidence.modelRepositories.result, "passed");
  assert.equal(browserEvidence.modelRepositories.repositoryCount, 10);
  assert.equal(browserEvidence.dashboard.s004RealDashboard.modelResultReady, true);
  assert.deepEqual(Object.keys(browserEvidence.realModuleWorkflows.allScenarioOptimization), ["S001", "S002", "S003", "S004", "S005"]);
  assert.ok(Object.values(browserEvidence.realModuleWorkflows.allScenarioOptimization).every((item) => item.status === "BINDING_APPLIED" && item.bindingStatus === "APPLIED" && item.shadowWindows === 3 && item.releaseCandidateId && item.simulationResultId));
  assert.deepEqual(browserEvidence.viewports.map((item) => item.routesChecked), [50, 10, 10]);
  assert.ok(browserEvidence.viewports.every((item) => item.result === "passed"));
  assert.equal(matrix.runStatus, "passed");
  assert.equal(matrix.runSummary.passed, matrix.cases.length);
  assert.equal(matrix.runSummary.blocked, 0);
});

if (failures.length) {
  console.error(`\n${failures.length} verification checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${passed}/${passed} verification checks passed.`);
}
