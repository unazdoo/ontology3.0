import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const workRoot = resolve(testDir, "../..");
const compositeRoot = join(workRoot, "composite");
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

const version = json("VERSION.json");
const modules = json("MODULE-REGISTRY.json");
const scenarios = json("SCENARIO-REGISTRY.json");
const manifest = json("COMPOSITE-MANIFEST.json");
const matrix = json("COMPOSITE-REGRESSION-MATRIX.json");
const packageVerification = json("PACKAGE-VERIFICATION.json");
const browser = json("composite/evidence/browser-regression.json");

check("candidate and parent identity", () => {
  assert.equal(version.version, "1.3.1-rc.1");
  assert.equal(version.parentCommit, "e3990c69e77882062035490ef718fd93549bbf82");
  assert.equal(version.parentSubtree, "a24109c8be2ffceca73e0fedbb9387f4b85a7176");
  assert.equal(version.acceptanceReady, false);
  assert.equal(manifest.candidateVersion, "v1.3.1-rc.1");
});

check("single Shell and canonical routes", () => {
  assert.equal(modules.shell.count, 1);
  assert.equal(modules.shell.nestedPlatformShellAllowed, false);
  assert.equal(modules.modules.length, 9);
  assert.equal(new Set(modules.modules.map((item) => item.route)).size, 9);
  assert(existsSync(join(workRoot, modules.shell.entry)));
});

check("five business domains share module catalogs without a global selector", () => {
  assert.deepEqual(scenarios.scenarios.map((item) => item.scenarioId), ["S001", "S002", "S003", "S004", "S005"]);
  assert.equal(scenarios.presentationPolicy.includes("no global scenario selector"), true);
  assert.equal(scenarios.scenarios.every((item) => item.fullLifecycle), true);
});

check("browser and regression evidence passed", () => {
  assert.equal(browser.candidateVersion, "v1.3.1-rc.1");
  assert.equal(browser.overallResult, "passed");
  assert.equal(browser.scenarioCoverage.totalPagesChecked, 50);
  assert.equal(browser.runtimeErrors.applicationConsoleErrors, 0);
  assert.equal(browser.runtimeErrors.pageErrors, 0);
  assert.equal(browser.runtimeErrors.failedResourceRequests, 0);
  assert.equal(browser.stability.crossTabReloadsObserved, 0);
  assert.equal(browser.stability.historyBackFrameLoadDelta, 0);
  assert.ok(browser.viewports.every((item) => item.result === "passed"));
  assert.equal(matrix.runStatus, "passed");
  assert.equal(matrix.runSummary.passed, matrix.cases.length);
});

check("model and truth boundaries are preserved", () => {
  assert.equal(manifest.formalBaseline.immutable, true);
  assert.equal(manifest.formalBaseline.formalPointerMutable, false);
  assert.equal(manifest.modelPortfolio.aggregateScoreCreated, false);
  assert.equal(manifest.modelPortfolio.automaticChampionSelectionAllowed, false);
  assert.equal(manifest.modelPortfolio.automaticReleaseAllowed, false);
  assert.equal(manifest.resultContracts.hardRejectCode, "NON_FACT_SOURCE_REJECTED");
  assert.equal(manifest.resultContracts.externalSideEffects, 0);
});

check("package verification is internally consistent", () => {
  assert.equal(packageVerification.targetPrototypeVersion, "v1.3.1-rc.1");
  assert.equal(packageVerification.result, "PASSED");
  assert.equal(packageVerification.regressionMatrix.passed, matrix.cases.length);
  assert.equal(packageVerification.acceptanceReady, false);
});

check("artifact inventory matches every composite file", () => {
  assert.equal(manifest.artifactInventory.status, "complete");
  const files = walk(compositeRoot).filter((target) => lstatSync(target).isFile()).sort();
  assert.equal(manifest.artifactInventory.fileCount, files.length);
  assert.equal(manifest.artifactInventory.totalBytes, files.reduce((sum, target) => sum + statSync(target).size, 0));
  const inventory = new Map(manifest.artifactInventory.files.map((item) => [item.path, item]));
  for (const target of files) {
    const key = posix(relative(workRoot, target));
    assert.equal(inventory.get(key)?.sha256, sha256(target), key);
  }
});

check("candidate contains no symlinks or absolute presentation references", () => {
  for (const target of walk(workRoot)) assert.equal(lstatSync(target).isSymbolicLink(), false, target);
  for (const target of walk(compositeRoot).filter((entry) => lstatSync(entry).isFile() && [".html", ".css", ".js", ".mjs", ".json"].includes(extname(entry)))) {
    assert.doesNotMatch(readFileSync(target, "utf8"), /(?:src|href)=["']\/Users\//, target);
  }
});

check("all required governance artifacts exist", () => {
  for (const name of manifest.governanceArtifacts) assert(existsSync(join(workRoot, name)), name);
});

if (failures.length) {
  console.error(`\n${failures.length} verification checks failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${passed}/${passed} verification checks passed.`);
}
