#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const foundation = require("../../../foundation/ofw-scenario-foundation.js");
const packageRoot = path.resolve(__dirname, "..");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function sha256Buffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function resolvePackageRef(ref) {
  if (typeof ref !== "string" || !ref || ref.includes("..")) {
    fail(`非法包内引用: ${String(ref)}`);
  }
  const absolute = path.resolve(packageRoot, ref);
  if (!absolute.startsWith(`${packageRoot}${path.sep}`) && absolute !== packageRoot) {
    fail(`引用越出 S003 包: ${ref}`);
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    fail(`引用文件不存在: ${ref}`);
  }
  return absolute;
}

function sha256File(ref) {
  return sha256Buffer(fs.readFileSync(resolvePackageRef(ref)));
}

function treeSha256(refs) {
  const lines = refs
    .slice()
    .sort()
    .map((ref) => `${sha256File(ref)}  ${ref}`);
  return sha256Buffer(Buffer.from(`${lines.join("\n")}\n`, "utf8"));
}

function buildModules(spec) {
  const modules = {};
  foundation.MODULE_IDS.forEach((moduleId) => {
    const item = spec.modules[moduleId];
    if (!item) fail(`Checkpoint spec 缺少 ${moduleId}`);
    modules[moduleId] = {
      moduleId,
      moduleVersion: item.moduleVersion,
      exportId: item.exportId,
      exportRef: item.exportRef,
      exportSha256: sha256File(item.exportRef),
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
  return Object.fromEntries(
    foundation.STATE_SECTION_NAMES.map((sectionName) => {
      const section = spec.stateSections[sectionName];
      if (!section) fail(`Checkpoint spec 缺少状态分区 ${sectionName}`);
      if (section.status !== "referenced") {
        return [sectionName, {status: section.status, reason: section.reason, items: []}];
      }
      const items = section.items.map((item) => ({
        owner: item.owner,
        resourceId: item.resourceId,
        version: item.version,
        ref: item.ref,
        sha256: sha256File(item.ref),
        formedAt: spec.createdAt
      }));
      return [sectionName, {status: "referenced", items}];
    })
  );
}

function main() {
  const specArg = process.argv[2];
  if (!specArg) fail("用法: node scripts/create-checkpoint.cjs <spec.json>");
  const specPath = path.resolve(process.cwd(), specArg);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const outputRef = spec.outputRef;
  const outputPath = path.resolve(packageRoot, outputRef);
  const sidecarPath = `${outputPath}.sha256`;
  if (fs.existsSync(outputPath) || fs.existsSync(sidecarPath)) {
    fail(`不可变 Checkpoint 已存在，拒绝覆盖: ${outputRef}`);
  }

  const scenarioContext = foundation.assertScenarioContext(spec.scenarioContext);
  const manifest = foundation.createCheckpointManifest(
    {
      checkpointId: spec.checkpointId,
      checkpointNode: spec.checkpointNode,
      baselineVersion: "1.0.3",
      baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
      parentVersion: "1.0.3",
      scenarioContext,
      code: {
        prototypeVersion: "1.1.0",
        buildVersion: spec.buildVersion,
        entryRef: spec.entryRef,
        treeSha256: treeSha256(spec.codeRefs)
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

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(outputPath, serialized, {flag: "wx"});
  const manifestSha = sha256Buffer(Buffer.from(serialized, "utf8"));
  fs.writeFileSync(sidecarPath, `${manifestSha}  ${path.basename(outputPath)}\n`, {flag: "wx"});
  process.stdout.write(`${manifest.checkpointId} ${manifestSha}\n`);
}

main();

