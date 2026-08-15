#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  BASELINE_SNAPSHOT_ID,
  BASELINE_VERSION,
  CHECKPOINT_DIR,
  FOUNDATION,
  SCENARIO_ROOT,
  checkpointDigestPath,
  checkpointManifestPath,
  createStateRef,
  projectRef,
  readJson,
  sha256Buffer,
  sha256File,
  stableJson,
  validateCheckpointCatalog,
  validateS004Phase,
  validateS004PreRisk
} from "./checkpoint-lib.mjs";

const ALIAS = "CP-S004-PRE-20260815140408000";
const CREATED_AT = "2026-08-15T14:04:08.000Z";
const CATALOG_PATH = path.join(CHECKPOINT_DIR, "index.json");
const EVIDENCE_INDEX_PATH = path.join(SCENARIO_ROOT, "evidence/index.json");
const EVIDENCE_PATH = path.join(SCENARIO_ROOT, "evidence/PRE-S004-20260815140408000-pointer-promotion.json");
const SNAPSHOT_ROOT = path.join(SCENARIO_ROOT, "evidence/pointer-promotion-pre-20260815140408000");

function usage() {
  console.error("用法：node checkpoints/create-pointer-promotion-pre.mjs --render|--verify");
  process.exit(2);
}

function ref(file, owner, resourceId, version = "pre-promotion") {
  return createStateRef({ owner, resourceId, version, file, formedAt: CREATED_AT });
}

function renderBundle() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  if (catalog.checkpoints.some((entry) => entry.phaseAlias === ALIAS)) throw new Error(`${ALIAS} 已存在，禁止覆盖`);
  const cp60Entry = catalog.checkpoints.find((entry) => entry.phaseAlias === "CP-S004-60");
  const cp60 = readJson(checkpointManifestPath("CP-S004-60"));
  validateS004Phase(cp60, "CP-S004-60");
  const evidence = readJson(EVIDENCE_PATH);
  const evidenceSha = sha256File(EVIDENCE_PATH);
  const stateSections = structuredClone(cp60.stateSections);
  const dataSnapshot = path.join(SNAPSHOT_ROOT, "data.js.snapshot.txt");
  const artifactIndexSnapshot = path.join(SNAPSHOT_ROOT, "artifact-index.snapshot.json");
  const moduleIndexSnapshot = path.join(SNAPSHOT_ROOT, "module-export-index.snapshot.json");
  const buildTool = path.join(SCENARIO_ROOT, "tools/build-report.mjs");
  const oldManifest = path.join(SCENARIO_ROOT, "artifacts/report/publication-manifest.json");
  const targetManifest = path.join(SCENARIO_ROOT, "artifacts/report/publication-manifest-v1.0.1.json");
  for (const file of [dataSnapshot, artifactIndexSnapshot, moduleIndexSnapshot, buildTool, oldManifest, targetManifest]) {
    if (!fs.existsSync(file)) throw new Error(`pointer-promotion PRE 缺少锁定项：${projectRef(file)}`);
  }
  stateSections.configurations.items.push(
    ref(dataSnapshot, "S004 场景总装", "S004-PRE-POINTER-DATA-JS"),
    ref(artifactIndexSnapshot, "S004 场景总装", "S004-PRE-POINTER-ARTIFACT-INDEX"),
    ref(moduleIndexSnapshot, "M06", "S004-PRE-POINTER-MODULE-INDEX"),
    ref(buildTool, "M06", "S004-PRE-POINTER-BUILD-REPORT")
  );
  stateSections.reports.items.push(
    ref(oldManifest, "M06", "S004-PRE-POINTER-PUBLICATION-V1.0", "1.0.0"),
    ref(targetManifest, "M06", "S004-PRE-POINTER-TARGET-V1.0.1", "1.0.1")
  );
  stateSections.evidence.items.push({
    owner: "平台公共层",
    resourceId: "S004-PRE-RISK-POINTER-PROMOTION",
    version: "1.0",
    ref: projectRef(EVIDENCE_PATH),
    sha256: evidenceSha,
    formedAt: CREATED_AT
  });
  const suffix = sha256Buffer(`${cp60.scenarioContext.scenarioRunId}\0${ALIAS}\0${CREATED_AT}`).slice(0, 12);
  const manifest = FOUNDATION.createCheckpointManifest(
    {
      checkpointId: `CP-S004-20260815140408000-${suffix}`,
      checkpointNode: "pre-risk-change",
      baselineVersion: BASELINE_VERSION,
      baselineSnapshotId: BASELINE_SNAPSHOT_ID,
      parentVersion: BASELINE_VERSION,
      scenarioContext: cp60.scenarioContext,
      code: {
        prototypeVersion: cp60.code.prototypeVersion,
        buildVersion: `${cp60.code.buildVersion}+pre-pointer-promotion`,
        entryRef: cp60.code.entryRef,
        treeSha256: evidence.codeTreeSha256Before
      },
      modules: structuredClone(cp60.modules),
      stateSections,
      restoreReadiness: {
        status: "verified",
        verifiedAt: CREATED_AT,
        evidenceRef: projectRef(EVIDENCE_PATH)
      }
    },
    { now: new Date(CREATED_AT) }
  );
  const manifestContent = stableJson(manifest);
  const manifestSha = sha256Buffer(manifestContent);
  const manifestPath = checkpointManifestPath(ALIAS);
  const digestPath = checkpointDigestPath(ALIAS);
  const entry = {
    phaseAlias: ALIAS,
    checkpointNode: "pre-risk-change",
    checkpointId: manifest.checkpointId,
    sourceScenarioRunId: manifest.sourceScenarioRunId,
    createdAt: manifest.createdAt,
    manifestRef: projectRef(manifestPath),
    manifestSha256: manifestSha,
    immutable: true,
    status: "locked",
    riskLevel: "medium",
    rollbackTargetCheckpointId: cp60.checkpointId,
    note: "正式报告当前消费指针提升到 v1.0.1 之前的不可变保护点"
  };
  const nextCatalog = structuredClone(catalog);
  nextCatalog.generatedAt = CREATED_AT;
  nextCatalog.checkpoints.push(entry);
  const catalogContent = stableJson(nextCatalog);
  const catalogSha = sha256Buffer(catalogContent);
  const evidenceIndex = readJson(EVIDENCE_INDEX_PATH);
  const nextEvidenceIndex = structuredClone(evidenceIndex);
  nextEvidenceIndex.generatedAt = CREATED_AT;
  const catalogItem = nextEvidenceIndex.items.find((item) => item.evidenceType === "checkpoint-catalog");
  catalogItem.sha256 = catalogSha;
  nextEvidenceIndex.items.push({
    evidenceType: "pointer-promotion-pre-risk-change",
    ref: projectRef(EVIDENCE_PATH),
    sha256: evidenceSha
  });
  return {
    entry,
    files: [
      { ref: projectRef(manifestPath), content: manifestContent, mode: "add" },
      { ref: projectRef(digestPath), content: `${manifestSha}  manifest.json\n`, mode: "add" },
      { ref: projectRef(CATALOG_PATH), content: catalogContent, mode: "replace" },
      { ref: projectRef(EVIDENCE_INDEX_PATH), content: stableJson(nextEvidenceIndex), mode: "replace" }
    ]
  };
}

function render() {
  process.stdout.write(JSON.stringify({ schemaVersion: 1, ...renderBundle() }));
}

function verify() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  const entry = catalog.checkpoints.find((item) => item.phaseAlias === ALIAS);
  if (!entry) throw new Error(`catalog 缺少 ${ALIAS}`);
  const manifest = readJson(checkpointManifestPath(ALIAS));
  validateS004PreRisk(manifest, entry);
  console.log(`${ALIAS} 校验通过；已锁定提升前 v1.0 指针状态。`);
}

if (process.argv[2] === "--render") render();
else if (process.argv[2] === "--verify") verify();
else usage();
