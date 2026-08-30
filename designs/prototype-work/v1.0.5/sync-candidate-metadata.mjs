import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const runId = process.env.SCENARIO_RUN_ID;
if (!runId) throw new Error("请设置 SCENARIO_RUN_ID");
const snapshotRelative = `runtime-snapshots/${runId}.runtime.json`;
const regressionRelative = `regression-results/${runId}/回归结果.md`;
const snapshotPath = path.join(root, snapshotRelative);
if (!fs.existsSync(snapshotPath)) throw new Error(`快照不存在：${snapshotRelative}`);
const snapshotBytes = fs.readFileSync(snapshotPath);
const snapshot = JSON.parse(snapshotBytes);
if (snapshot.scenarioRunId !== runId) throw new Error("快照轮次不匹配");
const sha256 = crypto.createHash("sha256").update(snapshotBytes).digest("hex");

function stored(key) {
  try { return JSON.parse(snapshot.localStorage?.[key] || "null"); } catch (_) { return null; }
}
const c008 = stored("ontology3-c008-authoritative-projection-v1");
const decision = stored("ontology3-decision-center-review-v2-portfolio-state-v6");
const report = stored("ontology3.report-center.lifecycle-review.v1");
const agent = stored("ontology3.agent-application.catalog.v1.0.4");
const query = stored("ontology3.iq.review.conversation.v1");
const taskId = decision?.tasks?.[0]?.id || null;
const publishedReport = report?.publishedReports?.find?.((item) => item?.reportNo || item?.id) || report?.report || null;
const reportNo = publishedReport?.reportNo || publishedReport?.id || null;
const evidencePackageId = publishedReport?.evidencePackId || publishedReport?.evidencePackageId || report?.report?.evidencePackId || null;
const assistant = report?.assistant || {};
const companionRunId = assistant?.requestRef?.runId || assistant?.runId || agent?.runs?.at?.(-1)?.id || null;
const comparisonRecordId = report?.comparison?.id || report?.report?.comparisonRecordId || null;
const versionPath = path.join(root, "VERSION.json");
const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
version.activeScenarioRunId = runId;
version.runtimeSnapshot = snapshotRelative;
version.runtimeSnapshotSha256 = sha256;
version.regressionResult = regressionRelative;
version.candidateFormedAt = new Date().toISOString();
version.integrationResult = "待回归结果";
version.runtimeSnapshotIncluded = true;
fs.writeFileSync(versionPath, `${JSON.stringify(version, null, 2)}\n`);

const replacements = {
  "S001-RUN-20260816020932258-96c5dc329c09": runId,
  "57c235f3add0e46c6e6ad60d51cbc8bee71b373c33f84ae3f3616f72d128971a": sha256,
  "TD-6847634593": taskId || "待形成本轮待办",
  "RPT-20260816-024139-010": reportNo || "待形成正式报告",
  "EP-20260816-023803-003": evidencePackageId || "待形成证据包",
  "RUN-20260816-002": companionRunId || "待形成伴读运行",
  "CMP-20260816-024346-001": comparisonRecordId || "待形成当前比较"
};
for (const file of ["completed-run.html", "RELEASE.md", "WORKSPACE.md", "CHANGELOG.md"]) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");
  for (const [from, to] of Object.entries(replacements)) content = content.split(from).join(to);
  fs.writeFileSync(filePath, content);
}
console.log(JSON.stringify({ runId, snapshotRelative, sha256, dataVersion: c008?.consumableDataVersion || null, semanticVersion: c008?.publishedSemanticVersion || null, taskId, reportNo, evidencePackageId, companionRunId, comparisonRecordId, queryRuns: query?.runs?.length || 0 }, null, 2));
