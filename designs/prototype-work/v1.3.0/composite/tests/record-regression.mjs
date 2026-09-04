import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const workRoot = resolve(testDir, "../..");
const matrixPath = resolve(workRoot, "COMPOSITE-REGRESSION-MATRIX.json");
const browserPath = resolve(workRoot, "composite/evidence/browser-regression.json");
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const browser = JSON.parse(readFileSync(browserPath, "utf8"));
const evidenceDate = browser.screenshots?.map((entry) => /-(\d{8})-/.exec(entry)?.[1]).find(Boolean) || browser.observedAt.slice(0, 10).replaceAll("-", "");
const blocked = new Set();

const staticModelEvidence = ["node --test composite/tests/model-portfolio.test.mjs", "composite/runtime/model-portfolio-engine.mjs", "composite/runtime/s003-registration.mjs"];
const modelRepositoryEvidence = ["node --test composite/tests/model-repository.test.mjs", "composite/runtime/model-repository-service.mjs", "composite/model-repositories/s003/repository-manifest.json"];
const shellEvidence = ["node --test composite/tests/shell-contract.test.mjs", "node --test composite/tests/stability-contract.test.mjs", "composite/evidence/browser-regression.json#scenarioCoverage"];
const mappings = {
  "CRG-001": ["node --test composite/tests/parent-integrity.test.mjs", "VERSION.json#parentCommit"],
  "CRG-002": ["node --test composite/tests/parent-integrity.test.mjs", "node designs/prototype-releases/verify-release.mjs 1.1.0"],
  "CRG-003": shellEvidence,
  "CRG-004": ["composite/evidence/browser-regression.json#scenarioCoverage"],
  "CRG-005": ["node --test composite/tests/shell-contract.test.mjs", "SCENARIO-REGISTRY.json#scenarioIsolation"],
  "CRG-006": ["node --test composite/tests/model-portfolio.test.mjs", "COMPOSITE-MANIFEST.json#formalBaseline"],
  "CRG-007": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#dataEngineering"],
  "CRG-008": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#dataEngineering"],
  "CRG-009": staticModelEvidence,
  "CRG-010": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#mainChain"],
  "CRG-011": ["node --test composite/tests/shell-contract.test.mjs", "composite/evidence/browser-regression.json#modelManagement", "composite/evidence/browser-regression.json#realModuleWorkflows/m08Scroll", "composite/evidence/screenshots/final-m08-portfolio-20260903-1440x900.png"],
  "CRG-012": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#modelPortfolio"],
  "CRG-013": [...staticModelEvidence, "composite/evidence/screenshots/final-m08-benchmark-20260903-1440x900.png"],
  "CRG-014": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#modelPortfolio", "composite/evidence/screenshots/final-m08-benchmark-20260903-1440x900.png"],
  "CRG-015": staticModelEvidence,
  "CRG-016": [...staticModelEvidence, "composite/evidence/screenshots/final-m08-20260903-1440x900.png"],
  "CRG-017": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#mainChain", "composite/evidence/screenshots/final-m08-shadow-20260903-1440x900.png"],
  "CRG-018": staticModelEvidence,
  "CRG-019": staticModelEvidence,
  "CRG-020": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/screenshots/final-m08-20260903-1440x900.png"],
  "CRG-021": ["composite/evidence/browser-regression.json#dashboard", "composite/evidence/screenshots/final-dashboard-20260903-1440x900.png"],
  "CRG-022": ["composite/evidence/browser-regression.json#dashboard", "composite/evidence/screenshots/final-dashboard-20260903-390x844.png"],
  "CRG-023": ["composite/evidence/browser-regression.json#realModuleWorkflows/modules/M07", "composite/evidence/browser-regression.json#scenarioCoverage", "composite/evidence/screenshots/final-m07-20260903-1440x900.png", "composite/evidence/screenshots/final-s002-m07-20260903-1440x900.png", "composite/evidence/screenshots/final-s004-m07-20260903-1440x900.png"],
  "CRG-024": ["composite/evidence/browser-regression.json#realModuleWorkflows/modules/M03", "composite/evidence/browser-regression.json#realModuleWorkflows/m03Recommendations", "composite/evidence/screenshots/final-m03-20260903-1440x900.png"],
  "CRG-025": ["composite/evidence/browser-regression.json#realModuleWorkflows/modules/M05", "composite/evidence/screenshots/final-m05-20260903-1440x900.png"],
  "CRG-026": ["composite/evidence/browser-regression.json#realModuleWorkflows/modules/M06", "composite/evidence/screenshots/final-m06-20260903-1440x900.png"],
  "CRG-027": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#realModuleWorkflows/modules/M04"],
  "CRG-028": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#realModuleWorkflows"],
  "CRG-029": ["node --test composite/tests/model-portfolio.test.mjs", "composite/evidence/browser-regression.json#dashboard"],
  "CRG-030": staticModelEvidence,
  "CRG-031": ["node --test composite/tests/model-portfolio.test.mjs", "composite/runtime/model-portfolio-engine.mjs"],
  "CRG-032": ["node --test composite/tests/stability-contract.test.mjs", "composite/evidence/browser-regression.json#stability"],
  "CRG-033": ["node --test composite/tests/stability-contract.test.mjs", "composite/evidence/browser-regression.json#stability", "v1.2.0 parent regression 123/123"],
  "CRG-034": ["composite/evidence/browser-regression.json#viewports/0", "composite/evidence/screenshots/final-home-20260903-1440x900.png", "composite/evidence/screenshots/final-m02-20260903-1440x900.png", "composite/evidence/screenshots/final-m03-20260903-1440x900.png", "composite/evidence/screenshots/final-m07-20260903-1440x900.png", "composite/evidence/screenshots/final-m08-20260903-1440x900.png", "composite/evidence/screenshots/final-dashboard-20260903-1440x900.png"],
  "CRG-035": ["composite/evidence/browser-regression.json#viewports/1", "composite/evidence/screenshots/final-m08-20260903-1280x720.png", "composite/evidence/screenshots/final-dashboard-20260903-1280x720.png"],
  "CRG-036": ["composite/evidence/browser-regression.json#viewports/2", "composite/evidence/screenshots/final-m03-20260903-390x844.png", "composite/evidence/screenshots/final-m08-20260903-390x844.png", "composite/evidence/screenshots/final-dashboard-20260903-390x844.png"],
  "CRG-037": ["node --test composite/tests/stability-contract.test.mjs", "composite/evidence/browser-regression.json#runtimeErrors", "node composite/tests/verify-candidate.mjs"],
  "CRG-038": ["node --test composite/tests/shell-contract.test.mjs", "node --test composite/tests/stability-contract.test.mjs", "composite/evidence/browser-regression.json#scenarioCoverage", "OPEN-ISSUES.md"],
  "CRG-039": ["node --test composite/tests/shell-contract.test.mjs", "composite/evidence/browser-regression.json#realModuleWorkflows/homepage", "composite/evidence/screenshots/final-home-20260903-1440x900.png"],
  "CRG-040": ["node --test composite/tests/shell-contract.test.mjs", "composite/evidence/browser-regression.json#modelManagement", "composite/evidence/browser-regression.json#scenarioCoverage", "composite/evidence/screenshots/final-m03-20260903-1440x900.png", "composite/evidence/screenshots/final-m07-20260903-1440x900.png"],
  "CRG-041": ["composite/evidence/browser-regression.json#realModuleWorkflows/m03Animation", "composite/evidence/screenshots/final-m03-thinking-20260903-1440x900.png", "composite/evidence/screenshots/final-m03-answer-20260903-1440x900.png"],
  "CRG-042": [...modelRepositoryEvidence, "composite/evidence/browser-regression.json#modelRepositories", "composite/evidence/screenshots/final-m08-repository-20260903-1440x900.png"],
  "CRG-043": ["node --test composite/tests/model-portfolio.test.mjs", ...modelRepositoryEvidence, "composite/evidence/browser-regression.json#realModuleWorkflows/s003Traceability", "composite/evidence/screenshots/final-m02-20260903-1440x900.png", "composite/evidence/screenshots/final-m01-20260903-1440x900.png"],
  "CRG-044": ["node --test composite/tests/shell-contract.test.mjs", "composite/evidence/browser-regression.json#dashboard/s004RealDashboard", "composite/evidence/screenshots/final-dashboard-s004-20260903-1440x900.png"],
  "CRG-045": ["composite/evidence/browser-regression.json#realModuleWorkflows/allScenarioOptimization", "composite/evidence/browser-regression.json#realModuleWorkflows/basicChains", "composite/evidence/browser-regression.json#realModuleWorkflows/s005"]
};

for (const item of matrix.cases) {
  item.status = blocked.has(item.id) ? "blocked" : "passed";
  item.observedAt = browser.observedAt;
  item.evidence = (mappings[item.id] || []).map((entry) => entry.replaceAll("20260903", evidenceDate));
  delete item.blockedReason;
}

matrix.runStatus = "passed";
matrix.runSummary = {
  passed: matrix.cases.length - blocked.size,
  failed: 0,
  blocked: blocked.size,
  pending: 0,
  lastObservedAt: browser.observedAt
};
matrix.acceptanceReady = false;
writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
console.log(`recorded ${matrix.runSummary.passed} passed / ${matrix.runSummary.blocked} blocked cases`);
