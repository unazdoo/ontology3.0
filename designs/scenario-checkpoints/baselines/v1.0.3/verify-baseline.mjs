import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../../../..");
const checkpointPath = path.join(scriptDir, "T056-baseline-checkpoint.json");
const detachedDigestPath = path.join(scriptDir, "T056-baseline-checkpoint.sha256");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assertEqual(label, actual, expected, failures) {
  if (actual !== expected) failures.push(`${label}: ${actual} != ${expected}`);
}

function run(command, args) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8"
  });
}

const failures = [];
const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const detachedDigest = fs.readFileSync(detachedDigestPath, "utf8").trim().split(/\s+/)[0];
const releaseManifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "designs/prototype-releases/v1.0.3/manifest.json"), "utf8")
);

assertEqual("checkpoint digest", sha256(checkpointPath), detachedDigest, failures);
assertEqual("baselineSnapshotId", checkpoint.baselineSnapshotId, "BSL-S001-V103-DE0119608E26", failures);
assertEqual("checkpoint status", checkpoint.status, "locked", failures);
assertEqual("acceptanceReady", checkpoint.acceptance?.acceptanceReady, false, failures);

const registry = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "designs/prototype-versions.json"), "utf8")
);
assertEqual("registry current frozen version", registry.currentFrozenVersion, "1.0.3", failures);
assertEqual(
  "registry current baseline snapshot",
  registry.currentFrozenBaselineSnapshotId,
  "BSL-S001-V103-DE0119608E26",
  failures
);
const releaseRegistration = registry.releases.find((item) => item.version === "1.0.3");
assertEqual(
  "release registration checkpoint digest",
  releaseRegistration?.baselineCheckpointSha256,
  detachedDigest,
  failures
);

const workspaceVersion = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "designs/prototype-work/v1.1.0/VERSION.json"), "utf8")
);
assertEqual("workspace parentVersion", workspaceVersion.parentVersion, "1.0.3", failures);
assertEqual(
  "workspace baselineSnapshotId",
  workspaceVersion.baselineSnapshotId,
  "BSL-S001-V103-DE0119608E26",
  failures
);
assertEqual("workspace acceptanceReady", workspaceVersion.acceptanceReady, false, failures);

const expectedModuleComponents = {
  M01: "ontology-management-review",
  M02: "data-engineering-prototype-review",
  M03: "intelligent-query-prototype",
  M04: "decision-center-prototype",
  M05: "agent-application",
  M06: "report-center"
};
for (const moduleVersion of checkpoint.moduleVersions || []) {
  const component = expectedModuleComponents[moduleVersion.module];
  assertEqual(
    `${moduleVersion.module} treeSha256`,
    moduleVersion.treeSha256,
    releaseManifest.components?.[component]?.treeSha256,
    failures
  );
}
for (const platformComponent of checkpoint.platformComponents || []) {
  const component = Object.entries(releaseManifest.components).find(
    ([, value]) => value.treeSha256 === platformComponent.treeSha256
  );
  if (!component) failures.push(`platform component not found in release manifest: ${platformComponent.name}`);
}

const expectedFiles = [
  ["release manifest", "designs/prototype-releases/v1.0.3/manifest.json", "de0119608e26b09cfbdcf86143db95ca9446c25030453086b4f8c1e840af8ba1"],
  ["release VERSION", "designs/prototype-releases/v1.0.3/VERSION.json", "64b5544e20a511933b47de6973672bcffa8bb505381710cf14024ed84a9f8d9b"],
  ["historical runtime reference", "designs/prototype-releases/v1.0.3/runtime-snapshots/S001-RUN-20260814062516042-e1fd5e6ab3f4.runtime.json", "3de07e7f69b013924dcb6725b6c35ff61f38fba3234f93a472aa45821ddec774"]
];

for (const [label, relativePath, expected] of expectedFiles) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${label}: missing ${relativePath}`);
    continue;
  }
  assertEqual(label, sha256(absolutePath), expected, failures);
}

const tagResult = run("git", ["rev-parse", "prototype-v1.0.3-frozen^{}"]);
if (tagResult.status !== 0) {
  failures.push(`git tag resolution failed: ${tagResult.stderr.trim()}`);
} else {
  assertEqual(
    "frozen tag target",
    tagResult.stdout.trim(),
    "ea69e9ad3bceef93b000e6f3ddc639ab093e2515",
    failures
  );
}

const releaseVerification = run("node", ["designs/prototype-releases/verify-release.mjs", "1.0.3"]);
if (releaseVerification.status !== 0) {
  failures.push(`release verification failed: ${(releaseVerification.stderr || releaseVerification.stdout).trim()}`);
}

if (failures.length) {
  console.error("v1.0.3 T056 基线校验失败：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("v1.0.3 T056 基线校验通过：BSL-S001-V103-DE0119608E26；acceptanceReady=false。");
