#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const foundation = require("../../../foundation/ofw-scenario-foundation.js");
const packageRoot = path.resolve(__dirname, "..");
const REQUIRED_BASELINE = Object.freeze({
  baselineVersion: "1.0.3",
  baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
  parentVersion: "1.0.3"
});

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertPackageRef(ref, label) {
  if (typeof ref !== "string" || !ref.trim() || ref.includes("\0")) {
    fail(`${label} 必须是非空包内文件引用`);
  }
  const normalized = ref.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
    fail(`${label} 越出 S003 包: ${ref}`);
  }
  const absolute = path.resolve(packageRoot, normalized);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`)) {
    fail(`${label} 越出 S003 包: ${ref}`);
  }
  return {ref: normalized, absolute};
}

function resolveExistingPackageFile(ref, label) {
  const resolved = assertPackageRef(ref, label);
  if (!fs.existsSync(resolved.absolute) || !fs.statSync(resolved.absolute).isFile()) {
    fail(`${label} 文件不存在: ${resolved.ref}`);
  }
  return resolved;
}

function sha256File(ref, label) {
  return sha256Buffer(fs.readFileSync(resolveExistingPackageFile(ref, label || "引用").absolute));
}

function treeSha256(refs) {
  if (!Array.isArray(refs) || refs.length === 0) fail("codeRefs 至少包含一个包内文件");
  const uniqueRefs = [...new Set(refs)];
  if (uniqueRefs.length !== refs.length) fail("codeRefs 不得包含重复引用");
  const lines = uniqueRefs
    .slice()
    .sort()
    .map((ref) => `${sha256File(ref, "codeRefs")}  ${ref.replaceAll("\\", "/")}`);
  return sha256Buffer(Buffer.from(`${lines.join("\n")}\n`, "utf8"));
}

function assertBaseline(spec) {
  const supplied = spec.baseline || REQUIRED_BASELINE;
  Object.entries(REQUIRED_BASELINE).forEach(([key, expected]) => {
    if (supplied[key] !== expected) fail(`${key} 必须固定为 ${expected}`);
  });
  return REQUIRED_BASELINE;
}

function buildModules(spec) {
  if (!spec.modules || typeof spec.modules !== "object") fail("Checkpoint spec 缺少 modules");
  const modules = {};
  foundation.MODULE_IDS.forEach((moduleId) => {
    const item = spec.modules[moduleId];
    if (!item) fail(`Checkpoint spec 缺少 ${moduleId}`);
    modules[moduleId] = {
      moduleId,
      moduleVersion: item.moduleVersion,
      exportId: item.exportId,
      exportRef: item.exportRef,
      exportSha256: sha256File(item.exportRef, `${moduleId}.exportRef`),
      validation: {
        status: "verified",
        validatedAt: spec.createdAt,
        evidenceRef: item.evidenceRef
      },
      restoreMode: "isolated-clone"
    };
  });
  return modules;
}

function buildStateSections(spec) {
  if (!spec.stateSections || typeof spec.stateSections !== "object") {
    fail("Checkpoint spec 缺少 stateSections");
  }
  return Object.fromEntries(
    foundation.STATE_SECTION_NAMES.map((sectionName) => {
      const section = spec.stateSections[sectionName];
      if (!section) fail(`Checkpoint spec 缺少状态分区 ${sectionName}`);
      if (section.status !== "referenced") {
        return [sectionName, {status: section.status, reason: section.reason, items: []}];
      }
      if (!Array.isArray(section.items) || section.items.length === 0) {
        fail(`状态分区 ${sectionName} 标记为 referenced 时必须提供 items`);
      }
      const items = section.items.map((item, index) => ({
        owner: item.owner,
        resourceId: item.resourceId,
        version: item.version,
        ref: item.ref,
        sha256: sha256File(item.ref, `${sectionName}.items[${index}].ref`),
        formedAt: spec.createdAt
      }));
      return [sectionName, {status: "referenced", items}];
    })
  );
}

function main() {
  const specArg = process.argv[2];
  if (!specArg) fail("用法: node scripts/create-checkpoint-v2.cjs <spec.json>");
  const specPath = path.resolve(process.cwd(), specArg);
  if (!fs.existsSync(specPath) || !fs.statSync(specPath).isFile()) fail(`spec 文件不存在: ${specArg}`);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const baseline = assertBaseline(spec);
  const output = assertPackageRef(spec.outputRef, "outputRef");
  const sidecarPath = `${output.absolute}.sha256`;
  if (fs.existsSync(output.absolute) || fs.existsSync(sidecarPath)) {
    fail(`不可变 Checkpoint 已存在，拒绝覆盖: ${output.ref}`);
  }

  const entry = resolveExistingPackageFile(spec.entryRef, "entryRef");
  const normalizedCodeRefs = spec.codeRefs.map((ref) => assertPackageRef(ref, "codeRefs").ref);
  if (!normalizedCodeRefs.includes(entry.ref)) {
    fail(`entryRef 必须纳入 codeRefs: ${entry.ref}`);
  }

  const scenarioContext = foundation.assertScenarioContext(spec.scenarioContext);
  const manifest = foundation.createCheckpointManifest(
    {
      checkpointId: spec.checkpointId,
      checkpointNode: spec.checkpointNode,
      baselineVersion: baseline.baselineVersion,
      baselineSnapshotId: baseline.baselineSnapshotId,
      parentVersion: baseline.parentVersion,
      scenarioContext,
      code: {
        prototypeVersion: "1.1.0",
        buildVersion: spec.buildVersion,
        entryRef: entry.ref,
        treeSha256: treeSha256(normalizedCodeRefs)
      },
      modules: buildModules(spec),
      stateSections: buildStateSections(spec),
      restoreReadiness: {
        status: "verified",
        verifiedAt: spec.createdAt,
        evidenceRef: spec.restoreEvidenceRef
      }
    },
    {now: new Date(spec.createdAt)}
  );

  fs.mkdirSync(path.dirname(output.absolute), {recursive: true});
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(output.absolute, serialized, {flag: "wx"});
  const manifestSha = sha256Buffer(Buffer.from(serialized, "utf8"));
  fs.writeFileSync(sidecarPath, `${manifestSha}  ${path.basename(output.absolute)}\n`, {flag: "wx"});
  process.stdout.write(`${manifest.checkpointId} ${manifestSha}\n`);
}

main();
