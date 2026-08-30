import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const version = readJson("VERSION.json");
const scenarioRunId = process.env.SCENARIO_RUN_ID || version.activeScenarioRunId;
if (!scenarioRunId) throw new Error("VERSION.activeScenarioRunId 未设置");

const snapshotRelative = `runtime-snapshots/${scenarioRunId}.runtime.json`;
const regressionRelative = `regression-results/${scenarioRunId}`;
const resultRelative = `${regressionRelative}/result.json`;
const targetedRelative = `${regressionRelative}/targeted-regression.json`;

const required = (relative) => {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) throw new Error(`候选清单目标不存在：${relative}`);
  return absolute;
};

const snapshot = readJson(snapshotRelative);
const result = readJson(resultRelative);
const targeted = readJson(targetedRelative);
if (snapshot.scenarioRunId !== scenarioRunId) throw new Error("运行快照与 activeScenarioRunId 不一致");
if (snapshot.prototypeVersion !== "1.0.5") throw new Error("运行快照 prototypeVersion 必须为 1.0.5");
if (result.scenarioRunId !== scenarioRunId || result.prototypeVersion !== "1.0.5") throw new Error("回归结果与候选轮次不一致");
if (result.integrationProgress !== "15/15" || result.status !== "passed" || result.acceptanceReady !== false) throw new Error("回归结果未满足 15/15、passed、acceptanceReady=false");
if (targeted.scenarioRunId !== scenarioRunId || targeted.passed !== true || targeted.acceptanceReady !== false) throw new Error("定向回归尚未通过");
if (targeted.pageViewportCombinations !== 24) throw new Error("定向回归必须包含 24 组页面—分辨率组合");

function listFiles(directory) {
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const absolute = path.join(directory, name);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) files.push(...listFiles(absolute));
    else if (stat.isFile()) files.push(absolute);
  }
  return files;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function treeDigest(directory) {
  const hash = crypto.createHash("sha256");
  const files = listFiles(directory);
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(directory, file).split(path.sep).join("/");
    const content = fs.readFileSync(file);
    bytes += content.length;
    hash.update(relative);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return { files: files.length, bytes, treeSha256: hash.digest("hex") };
}

const components = [
  "ontology3-homepage-review",
  "data-engineering-prototype-review",
  "ontology-management-review",
  "ontology-management-prototype",
  "intelligent-query-prototype",
  "decision-center-prototype",
  "agent-application",
  "report-center",
  "s001-e2e-integration",
  snapshotRelative,
  regressionRelative
];
components.forEach(required);

const entries = [
  "s001-e2e-integration/index.html",
  "ontology3-homepage-review/方案A-经典复刻版.html",
  "data-engineering-prototype-review/review-v3/方案B2.html",
  "ontology-management-review/canvas-first/index.html",
  "intelligent-query-prototype/review-next/conversation-workspace/index.html",
  "decision-center-prototype/index.html",
  "agent-application/Agent应用.html",
  "report-center/review-lifecycle/index.html",
  "completed-run.html",
  "open-completed-run.html",
  snapshotRelative,
  resultRelative,
  `${regressionRelative}/回归结果.md`,
  targetedRelative,
  "shared-type-scale.css",
  "runtime-clock.js",
  "VERSION.json",
  "RELEASE.md",
  "WORKSPACE.md",
  "CHANGELOG.md",
  "SOURCE-MATERIALIZATION.json",
  "sync-candidate-metadata.mjs",
  "build-candidate-manifest.mjs",
  "verify-candidate.mjs"
];
entries.forEach(required);

const generatedAt = process.env.GENERATED_AT || new Date().toISOString();
const manifest = {
  manifestVersion: 1,
  prototypeVersion: "1.0.5",
  status: "release-candidate",
  generatedAt,
  scenarioRunId,
  acceptanceReady: false,
  rollbackVersion: version.rollbackVersion || "1.0.4",
  algorithm: "sha256(relativePath\\0fileBytes\\0, sorted recursively)",
  components: Object.fromEntries(components.map((item) => [item, treeDigest(path.join(root, item))])),
  entries: Object.fromEntries(entries.map((item) => [item, sha256(path.join(root, item))]))
};

fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`v1.0.5 候选 manifest 已生成：${components.length} 个组件，${entries.length} 个入口，轮次 ${scenarioRunId}。`);
