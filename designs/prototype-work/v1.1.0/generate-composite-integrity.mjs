import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(root, "VERSION.json"), "utf8"));
const components = {
  Shell: ["s001-e2e-integration/index.html", "s001-e2e-integration/app.js", "s001-e2e-integration/data.js", "s001-e2e-integration/state.js", "s001-e2e-integration/styles.css"],
  M01: ["ontology-management-review/canvas-first/index.html", "ontology-management-review/canvas-first/app.js", "ontology-management-review/canvas-first/app.css", "ontology-management-review/canvas-first/portfolio-integration.js"],
  M02: ["data-engineering-prototype-review/review-v3/方案B2.html", "data-engineering-prototype-review/review-v3/shared/app.js", "data-engineering-prototype-review/review-v3/shared/fixtures.js"],
  M03: ["intelligent-query-prototype/review-next/conversation-workspace/index.html", "intelligent-query-prototype/review-next/conversation-workspace/app.compiled.js", "intelligent-query-prototype/review-next/conversation-workspace/data.compiled.js", "intelligent-query-prototype/review-next/conversation-workspace/portfolio-integration.js", "intelligent-query-prototype/review-next/conversation-workspace/modern.css"],
  M04: ["decision-center-prototype/review-v2/action-portfolio.html", "decision-center-prototype/review-v2/shared/app.compiled.js", "decision-center-prototype/review-v2/shared/data.compiled.js", "decision-center-prototype/review-v2/shared/app.css", "decision-center-prototype/review-v2/shared/portfolio-integration.js"],
  M05: ["agent-application/Agent应用.html", "agent-application/app.compiled.js", "agent-application/data.compiled.js", "agent-application/portfolio-integration.js", "agent-application/app.css"],
  M06: ["report-center/review-lifecycle/index.html", "report-center/review-lifecycle/canonical-app.js", "report-center/review-lifecycle/canonical-data.js", "report-center/review-lifecycle/canonical.css", "report-center/review-lifecycle/s003-app.js", "report-center/review-lifecycle/s003-data.js", "report-center/review-lifecycle/s003-styles.css"],
  Dashboard: ["dashboard/index.html", "dashboard/app.js", "dashboard/data.js", "dashboard/styles.css", "scenarios/s003/domain/score-engine.js"]
};

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const result = {};
for (const [component, files] of Object.entries(components)) {
  result[component] = files.map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Missing integrity target: ${relativePath}`);
    return { path: relativePath, sha256: sha256(absolutePath) };
  });
}

const manifest = {
  schemaVersion: "ofw.composite-integrity.v1",
  candidateVersion: version.targetVersion,
  candidateParentVersion: version.candidateParentVersion,
  governanceBaselineVersion: version.governanceBaselineVersion,
  baselineSnapshotId: version.baselineSnapshotId,
  uniqueEntry: version.entry,
  reviewRevision: version.reviewRevision,
  snapshotStatus: version.candidateSnapshotStatus,
  rollbackVersion: version.rollbackVersion,
  generatedAt: new Date().toISOString(),
  componentCount: Object.keys(result).length,
  fileCount: Object.values(result).reduce((sum, files) => sum + files.length, 0),
  allFilesPresent: true,
  regression: "COMPOSITE-REGRESSION-MATRIX.json",
  acceptanceReady: false,
  components: result
};

fs.writeFileSync(path.join(root, version.integrityManifest), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${version.integrityManifest}: ${manifest.componentCount} components / ${manifest.fileCount} files`);
