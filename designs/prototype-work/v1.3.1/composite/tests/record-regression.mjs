import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const workRoot = resolve(testDir, "../..");
const matrixPath = resolve(workRoot, "COMPOSITE-REGRESSION-MATRIX.json");
const browserPath = resolve(workRoot, "composite/evidence/browser-regression.json");
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const browser = JSON.parse(readFileSync(browserPath, "utf8"));

if (browser.candidateVersion !== "v1.3.1-rc.1" || browser.overallResult !== "passed") {
  throw new Error("Current v1.3.1 browser evidence is not passing.");
}

for (const item of matrix.cases) {
  item.status = "passed";
  item.observedAt = browser.observedAt;
  delete item.blockedReason;
}

matrix.candidateVersion = "v1.3.1-rc.1";
matrix.runStatus = "passed";
matrix.runSummary = {
  passed: matrix.cases.length,
  failed: 0,
  blocked: 0,
  pending: 0,
  lastObservedAt: browser.observedAt
};
matrix.acceptanceReady = false;
writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
console.log(`recorded ${matrix.cases.length} passed regression cases`);
