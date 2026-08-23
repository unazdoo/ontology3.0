import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../../../..");
const checkpointPath = path.join(scriptDir, "T056-baseline-checkpoint.json");
const digestPath = path.join(scriptDir, "T056-baseline-checkpoint.sha256");
const failures = [];

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function equal(label, actual, expected) {
  if (actual !== expected) failures.push(`${label}: ${actual} != ${expected}`);
}

function run(command, args) {
  return spawnSync(command, args, { cwd: projectRoot, encoding: "utf8" });
}

const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
const detachedDigest = fs.readFileSync(digestPath, "utf8").trim().split(/\s+/)[0];
const manifestPath = path.join(projectRoot, checkpoint.baseline.manifest);
const versionPath = path.join(projectRoot, "designs/prototype-releases/v1.1.0/VERSION.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(projectRoot, "designs/prototype-versions.json"), "utf8"));

equal("checkpoint digest", sha256(checkpointPath), detachedDigest);
equal("baselineSnapshotId", checkpoint.baselineSnapshotId, "BSL-OFW-V110-94ABD0E991B7");
equal("checkpoint status", checkpoint.status, "locked");
equal("manifest digest", sha256(manifestPath), checkpoint.baseline.manifestSha256);
equal("VERSION digest", sha256(versionPath), checkpoint.baseline.versionFileSha256);
equal("release tree", manifest.releaseTree.treeSha256, checkpoint.baseline.releaseTreeSha256);
equal("release file count", manifest.releaseTree.files, checkpoint.baseline.releaseFileCount);
equal("VERSION baselineSnapshotId", version.baselineSnapshotId, checkpoint.baselineSnapshotId);
equal("runtimeSnapshotIncluded", version.runtimeSnapshotIncluded, false);
equal("acceptanceReady", checkpoint.acceptance.acceptanceReady, false);
equal("registry frozen version", registry.currentFrozenVersion, "1.1.0");
equal("registry frozen snapshot", registry.currentFrozenBaselineSnapshotId, checkpoint.baselineSnapshotId);

const registration = registry.releases.find((item) => item.version === "1.1.0");
equal("registry checkpoint digest", registration?.baselineCheckpointSha256, detachedDigest);
equal("registry acceptanceReady", registration?.acceptanceReady, false);

for (const moduleVersion of checkpoint.moduleVersions) {
  const relative = moduleVersion.prototypePath.replace("designs/prototype-releases/v1.1.0/", "");
  equal(`${moduleVersion.module} tree`, moduleVersion.treeSha256, manifest.components[relative]?.treeSha256);
}

const releaseVerification = run("node", ["designs/prototype-releases/verify-release.mjs", "1.1.0"]);
if (releaseVerification.status !== 0) {
  failures.push(`release verification: ${(releaseVerification.stderr || releaseVerification.stdout).trim()}`);
}

const tag = run("git", ["rev-parse", `${checkpoint.baseline.gitTag}^{}`]);
if (tag.status !== 0 && process.env.ALLOW_PENDING_TAG !== "1") {
  failures.push(`frozen tag missing: ${checkpoint.baseline.gitTag}`);
}

if (failures.length) {
  console.error("v1.1.0 T056 基线校验失败：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const tagState = tag.status === 0 ? tag.stdout.trim() : "pending freeze commit";
console.log(`v1.1.0 T056 基线校验通过：${checkpoint.baselineSnapshotId}；tag=${tagState}；acceptanceReady=false。`);
