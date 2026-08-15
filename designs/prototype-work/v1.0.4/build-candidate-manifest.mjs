import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const scenarioRunId = "S001-RUN-20260815205357297-5625500f9a07";

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
  "runtime-snapshots",
  `regression-results/${scenarioRunId}`
];

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
  `runtime-snapshots/${scenarioRunId}.runtime.json`,
  `regression-results/${scenarioRunId}/回归结果.md`,
  `regression-results/${scenarioRunId}/result.json`,
  "shared-type-scale.css",
  "runtime-clock.js",
  "VERSION.json",
  "RELEASE.md",
  "WORKSPACE.md",
  "CHANGELOG.md",
  "SOURCE-MATERIALIZATION.json",
  "build-candidate-manifest.mjs",
  "verify-candidate.mjs"
];

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

for (const item of [...components, ...entries]) {
  const absolute = path.join(root, item);
  if (!fs.existsSync(absolute)) throw new Error(`候选清单目标不存在：${item}`);
}

const manifest = {
  manifestVersion: 1,
  prototypeVersion: "1.0.4",
  status: "release-candidate",
  generatedAt: "2026-08-15T21:53:20.803Z",
  scenarioRunId,
  acceptanceReady: false,
  rollbackVersion: "1.0.3",
  algorithm: "sha256(relativePath\\0fileBytes\\0, sorted recursively)",
  components: Object.fromEntries(components.map(item => [item, treeDigest(path.join(root, item))])),
  entries: Object.fromEntries(entries.map(item => [item, sha256(path.join(root, item))]))
};

fs.writeFileSync(path.join(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`v1.0.4 候选 manifest 已生成：${components.length} 个组件，${entries.length} 个入口。`);
