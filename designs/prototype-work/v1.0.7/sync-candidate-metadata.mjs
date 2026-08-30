import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const runId = process.env.SCENARIO_RUN_ID;
if (!runId) throw new Error("请设置 SCENARIO_RUN_ID");
const snapshotRelative = `runtime-snapshots/${runId}.runtime.json`;
const regressionRelative = `regression-results/${runId}/回归结果.md`;
const regressionJsonRelative = `regression-results/${runId}/result.json`;
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
const queryRuns = [...(query?.liveRuns || []), ...(query?.historyRuns || [])];
const runById = new Map(queryRuns.map((item) => [item?.id, item]));
const actionBatches = new Map();
for (const request of query?.actionRequests || []) {
  if (!request?.runId || !request?.target) continue;
  if (!actionBatches.has(request.runId)) actionBatches.set(request.runId, []);
  actionBatches.get(request.runId).push(request);
}
const expectedTargets = ["单位553", "单位465", "单位561"];
const completeBatches = [...actionBatches.entries()]
  .map(([sourceRunId, requests]) => ({
    sourceRunId,
    requests,
    run: runById.get(sourceRunId) || null,
    complete: expectedTargets.every((target) => requests.some((item) => item.target === target))
  }))
  .filter((item) => item.complete)
  .sort((left, right) => String(left.run?.completedAt || left.run?.createdAt || "").localeCompare(String(right.run?.completedAt || right.run?.createdAt || "")));
const activeActionBatch = completeBatches.at(-1) || null;
const activeRequestIds = new Set((activeActionBatch?.requests || []).map((item) => item.id));
const task = (decision?.tasks || [])
  .filter((item) => activeRequestIds.has(item?.requestId))
  .sort((left, right) => String(left?.createdAt || "").localeCompare(String(right?.createdAt || "")))
  .at(-1) || null;
const taskId = task?.id || null;
const publishedReport = report?.report?.stage === "published"
  ? report.report
  : [...(report?.publishedReports || [])]
      .filter((item) => item?.reportNo || item?.id)
      .sort((left, right) => String(left?.publishedAt || "").localeCompare(String(right?.publishedAt || "")))
      .at(-1) || null;
const reportNo = publishedReport?.reportNo || publishedReport?.id || null;
const evidencePackageId = publishedReport?.evidencePackId || publishedReport?.evidencePackageId || null;
const companionRun = (agent?.runs || [])
  .filter((item) => item?.snapshot?.agentId === "report-copilot" && ["complete", "partial"].includes(item?.status))
  .filter((item) => item?.snapshot?.reportNumber === reportNo && String(item?.snapshot?.contentVersion) === String(publishedReport?.contentVersion))
  .sort((left, right) => String(left?.completedAt || left?.result?.generatedAt || "").localeCompare(String(right?.completedAt || right?.result?.generatedAt || "")))
  .at(-1) || null;
const companionRunId = companionRun?.id || null;
const companionRequestId = companionRun?.requestId || null;
const companionResultId = companionRun?.result?.id || null;
const comparisonRecordId = publishedReport?.comparison?.recordId || publishedReport?.comparisonRecordId ||
  [...(publishedReport?.comparisonRecords || [])].reverse().find((item) => item?.recordId || item?.id)?.recordId ||
  [...(publishedReport?.comparisonRecords || [])].reverse().find((item) => item?.recordId || item?.id)?.id || null;
const verificationRunId = publishedReport?.verification?.runId || null;
const verificationCoverage = publishedReport?.verification?.coverage || {};
const reportContentVersion = publishedReport?.contentVersion || null;
const publicationFailure = (publishedReport?.publicationRuns || []).find((item) => item?.status === "失败") || null;
const publicationSuccess = [...(publishedReport?.publicationRuns || [])].reverse().find((item) => item?.status === "成功") || null;
const versionPath = path.join(root, "VERSION.json");
const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
if (version.status !== "release-candidate") throw new Error(`当前版本 ${version.version} 仍是 ${version.status}，完成真实运行后再同步候选元数据`);
const regressionJsonPath = path.join(root, regressionJsonRelative);
const regressionResult = fs.existsSync(regressionJsonPath) ? JSON.parse(fs.readFileSync(regressionJsonPath, "utf8")) : null;
version.activeScenarioRunId = runId;
version.runtimeSnapshot = snapshotRelative;
version.runtimeSnapshotSha256 = sha256;
version.regressionResult = regressionRelative;
version.candidateFormedAt = new Date().toISOString();
version.integrationResult = regressionResult?.status === "passed" ? regressionResult.integrationProgress : "待回归结果";
version.runtimeSnapshotIncluded = true;
fs.writeFileSync(versionPath, `${JSON.stringify(version, null, 2)}\n`);

const replacements = {
  "S001-RUN-20260816020932258-96c5dc329c09": runId,
  "57c235f3add0e46c6e6ad60d51cbc8bee71b373c33f84ae3f3616f72d128971a": sha256,
  "TD-6847634593": taskId || "待形成本轮待办",
  "RPT-20260816-024139-010": reportNo || "待形成正式报告",
  "RPT-20260816-085841-010": reportNo || "待形成正式报告",
  "EP-20260816-023803-003": evidencePackageId || "待形成证据包",
  "EP-20260816-084401-003": evidencePackageId || "待形成证据包",
  "RUN-20260816-002": companionRunId || "待形成伴读运行",
  "RUN-20260816-001": companionRunId || "待形成伴读运行",
  "CMP-20260816-024346-001": comparisonRecordId || "待形成当前比较",
  "待形成当前比较": comparisonRecordId || "待形成当前比较",
  "semantic-MSV6HYRE-DXBB": c008?.publishedSemanticVersionId || "待形成语义版本",
  "21 项不可比较": `${publishedReport?.comparison?.counts?.unverifiable ?? "待形成"} 项不可比较`,
  "VRF-20260816-024016-004": publishedReport?.verification?.retryOf || "VRF-20260816-092530-004",
  "VRF-20260816-024028-005": verificationRunId || "待形成核验成功记录",
  "PRUN-20260816-024124-008": publicationFailure?.id || "待形成发布失败记录",
  "PRUN-20260816-024137-009": publicationSuccess?.id || "待形成发布成功记录"
};
for (const file of ["completed-run.html", "RELEASE.md", "WORKSPACE.md", "CHANGELOG.md"]) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, "utf8");
  for (const [from, to] of Object.entries(replacements)) content = content.split(from).join(to);
  if (reportNo && reportContentVersion) {
    if (file === "completed-run.html") {
      content = content.replace(/(<article class="card"><span>正式报告<\/span><strong>)[^<]+(<\/strong>)/, `$1${reportNo} / ${reportContentVersion}$2`);
    } else if (file === "RELEASE.md") {
      content = content.replace(/^- 正式报告：`[^`]+`$/m, `- 正式报告：\`${reportNo} / ${reportContentVersion}\``);
    } else if (file === "CHANGELOG.md") {
      content = content.replace(/(^## v1\.0\.5 新运行轮次与候选收口[\s\S]*?^- 报告链路：`)[^`]+(`、`[^`]+`、`[^`]+`、`[^`]+`。)/m, `$1${reportNo} / ${reportContentVersion}$2`);
    }
  }
  fs.writeFileSync(filePath, content);
}
console.log(JSON.stringify({
  runId,
  snapshotRelative,
  sha256,
  dataVersion: c008?.consumableDataVersion || null,
  semanticVersion: c008?.publishedSemanticVersion || null,
  semanticVersionId: c008?.publishedSemanticVersionId || null,
  actionRequestRunId: activeActionBatch?.sourceRunId || null,
  activeActionRequests: activeActionBatch?.requests?.length || 0,
  taskId,
  reportNo,
  reportContentVersion,
  evidencePackageId,
  companionRequestId,
  companionRunId,
  companionResultId,
  comparisonRecordId,
  verificationRunId,
  publicationFailureRunId: publicationFailure?.id || null,
  publicationSuccessRunId: publicationSuccess?.id || null,
  queryRuns: queryRuns.length
}, null, 2));
