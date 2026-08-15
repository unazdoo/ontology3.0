#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  BASELINE_SNAPSHOT_ID,
  BASELINE_VERSION,
  CHECKPOINT_DIR,
  FOUNDATION,
  PROJECT_ROOT,
  SCENARIO_ROOT,
  checkpointDigestPath,
  checkpointManifestPath,
  codeTreeDigest,
  createStateRef,
  projectRef,
  readJson,
  sha256Buffer,
  sha256File,
  stableJson,
  validateCheckpointCatalog,
  validateS004Phase,
  validateS004PreRisk,
  writeImmutable
} from "./checkpoint-lib.mjs";

const PRE_ALIAS = "CP-S004-PRE-20260815133128000";
const CREATED_AT = "2026-08-15T13:31:28.000Z";
const CATALOG_PATH = path.join(CHECKPOINT_DIR, "index.json");
const EVIDENCE_INDEX_PATH = path.join(SCENARIO_ROOT, "evidence/index.json");
const PRE_EVIDENCE_PATH = path.join(
  SCENARIO_ROOT,
  "evidence/PRE-S004-20260815133128000-pdf-cover-header.json"
);
const TOOL_PATH = path.join(SCENARIO_ROOT, "tools/build-report.mjs");
const HTML_PATH = path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.html");
const PDF_PATH = path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.pdf");

function usage() {
  console.error("用法：node checkpoints/create-pre-risk.mjs --render|--create|--verify");
  process.exit(2);
}

function checkpointId(context) {
  const suffix = sha256Buffer(`${context.scenarioRunId}\0${PRE_ALIAS}\0${CREATED_AT}`).slice(0, 12);
  return `CP-S004-20260815133128000-${suffix}`;
}

function changeRef(file, owner, resourceId, version) {
  return createStateRef({ owner, resourceId, version, file, formedAt: CREATED_AT });
}

function renderBundle() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  if (catalog.checkpoints.some((entry) => entry.phaseAlias === PRE_ALIAS)) {
    throw new Error(`${PRE_ALIAS} 已存在，禁止覆盖`);
  }
  const cp60Entry = catalog.checkpoints.find((entry) => entry.phaseAlias === "CP-S004-60");
  if (!cp60Entry) throw new Error("缺少 CP-S004-60 回退目标");
  const cp60 = readJson(checkpointManifestPath("CP-S004-60"));
  validateS004Phase(cp60, "CP-S004-60");
  const currentCode = codeTreeDigest();
  if (currentCode.treeSha256 !== cp60.code.treeSha256) {
    throw new Error("当前代码树已偏离 CP-S004-60，不能补造修改前 PRE");
  }
  for (const file of [TOOL_PATH, HTML_PATH, PDF_PATH]) {
    if (!fs.existsSync(file)) throw new Error(`PRE 修改目标不存在：${projectRef(file)}`);
  }

  const evidence = {
    schemaVersion: 1,
    evidenceType: "C034-pre-risk-change",
    changeId: "CHG-S004-PDF-COVER-HEADER-20260815-001",
    scenarioContext: cp60.scenarioContext,
    formedAt: CREATED_AT,
    reason: "准备修正正式 PDF 封面打印页眉裁切",
    riskLevel: "medium",
    changeScope: [
      {
        owner: "M06",
        ref: projectRef(TOOL_PATH),
        sha256Before: sha256File(TOOL_PATH),
        changeKind: "report-build-tool"
      },
      {
        owner: "M06",
        ref: projectRef(HTML_PATH),
        sha256Before: sha256File(HTML_PATH),
        changeKind: "same-source-html"
      },
      {
        owner: "M06",
        ref: projectRef(PDF_PATH),
        sha256Before: sha256File(PDF_PATH),
        changeKind: "same-source-pdf"
      }
    ],
    rollbackTarget: {
      phaseAlias: "CP-S004-60",
      checkpointId: cp60.checkpointId,
      manifestRef: cp60Entry.manifestRef,
      manifestSha256: cp60Entry.manifestSha256
    },
    restorePreflight: {
      status: "verified",
      mode: "isolated-clone",
      requiresNewScenarioRunId: true,
      overwritesHistory: false,
      externalCapabilitiesDefault: "disabled"
    },
    immutabilityRule: "现有 CP00—CP60 不得覆盖；修改后必须形成新报告版本或新快照"
  };
  const evidenceContent = stableJson(evidence);
  const evidenceSha = sha256Buffer(evidenceContent);
  const stateSections = structuredClone(cp60.stateSections);
  stateSections.configurations.items.push(
    changeRef(TOOL_PATH, "M06", "S004-PRE-RISK-REPORT-BUILD-TOOL", "pre-change")
  );
  stateSections.evidence.items.push({
    owner: "平台公共层",
    resourceId: "S004-PRE-RISK-PDF-COVER-HEADER",
    version: "1.0",
    ref: projectRef(PRE_EVIDENCE_PATH),
    sha256: evidenceSha,
    formedAt: CREATED_AT
  });

  const manifest = FOUNDATION.createCheckpointManifest(
    {
      checkpointId: checkpointId(cp60.scenarioContext),
      checkpointNode: "pre-risk-change",
      baselineVersion: BASELINE_VERSION,
      baselineSnapshotId: BASELINE_SNAPSHOT_ID,
      parentVersion: BASELINE_VERSION,
      scenarioContext: cp60.scenarioContext,
      code: {
        prototypeVersion: cp60.code.prototypeVersion,
        buildVersion: `${cp60.code.buildVersion}+pre-pdf-header-fix`,
        entryRef: cp60.code.entryRef,
        treeSha256: currentCode.treeSha256
      },
      modules: structuredClone(cp60.modules),
      stateSections,
      restoreReadiness: {
        status: "verified",
        verifiedAt: CREATED_AT,
        evidenceRef: projectRef(PRE_EVIDENCE_PATH)
      }
    },
    { now: new Date(CREATED_AT) }
  );
  const manifestContent = stableJson(manifest);
  const manifestSha = sha256Buffer(manifestContent);
  const manifestPath = checkpointManifestPath(PRE_ALIAS);
  const digestPath = checkpointDigestPath(PRE_ALIAS);
  const entry = {
    phaseAlias: PRE_ALIAS,
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
    note: "修正正式 PDF 封面打印页眉裁切之前的不可变保护点"
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
  if (!catalogItem) throw new Error("证据索引缺少 checkpoint-catalog 条目");
  catalogItem.sha256 = catalogSha;
  nextEvidenceIndex.items.push({
    evidenceType: "pre-risk-change",
    ref: projectRef(PRE_EVIDENCE_PATH),
    sha256: evidenceSha
  });

  return {
    entry,
    files: [
      { filePath: PRE_EVIDENCE_PATH, content: evidenceContent, mode: "add" },
      { filePath: manifestPath, content: manifestContent, mode: "add" },
      { filePath: digestPath, content: `${manifestSha}  manifest.json\n`, mode: "add" },
      { filePath: CATALOG_PATH, content: catalogContent, mode: "replace" },
      { filePath: EVIDENCE_INDEX_PATH, content: stableJson(nextEvidenceIndex), mode: "replace" }
    ]
  };
}

function create() {
  if (fs.existsSync(checkpointManifestPath(PRE_ALIAS))) {
    verify();
    return;
  }
  const bundle = renderBundle();
  for (const item of bundle.files) {
    if (item.mode === "replace") {
      throw new Error("正式落盘必须通过 apply_patch 替换 catalog/index；请使用 --render");
    }
    writeImmutable(item.filePath, item.content);
  }
}

function render() {
  const bundle = renderBundle();
  process.stdout.write(
    JSON.stringify({
      schemaVersion: 1,
      entry: bundle.entry,
      files: bundle.files.map((item) => ({ ref: projectRef(item.filePath), content: item.content, mode: item.mode }))
    })
  );
}

function verify() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  const entry = catalog.checkpoints.find((item) => item.phaseAlias === PRE_ALIAS);
  if (!entry) throw new Error(`catalog 缺少 ${PRE_ALIAS}`);
  const manifest = readJson(checkpointManifestPath(PRE_ALIAS));
  validateS004PreRisk(manifest, entry);
  console.log(`${PRE_ALIAS} 校验通过；回退目标 ${entry.rollbackTargetCheckpointId}。`);
}

const mode = process.argv[2];
if (mode === "--render") render();
else if (mode === "--create") create();
else if (mode === "--verify") verify();
else usage();
