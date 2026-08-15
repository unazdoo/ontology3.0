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
  referencedSection,
  sha256Buffer,
  sha256File,
  stableJson,
  validateCheckpointCatalog,
  validateS004PostFix
} from "./checkpoint-lib.mjs";

const CREATED_AT_50 = "2026-08-15T14:10:21.000Z";
const CREATED_AT_60 = "2026-08-15T14:10:21.100Z";
const ALIAS_50 = "CP-S004-50-POSTFIX-20260815141021000";
const ALIAS_60 = "CP-S004-60-POSTFIX-20260815141021100";
const CATALOG_PATH = path.join(CHECKPOINT_DIR, "index.json");
const EVIDENCE_INDEX_PATH = path.join(SCENARIO_ROOT, "evidence/index.json");
const POST_EVIDENCE_PATH = path.join(SCENARIO_ROOT, "evidence/post-fix-publication-v1.0.1.json");
const POINTER_HISTORY_PATH = path.join(
  SCENARIO_ROOT,
  "evidence/publication-pointer-history/PTR-S004-PUBLICATION-CURRENT-001-v1.0.1.json"
);
const M06_EXPORT_PATH = path.join(SCENARIO_ROOT, "module-exports/M06-publication-v1.0.1.json");

function usage() {
  console.error("用法：node checkpoints/create-postfix-checkpoints.mjs --render|--verify");
  process.exit(2);
}

function stateRef(file, owner, resourceId, version, formedAt) {
  return createStateRef({ owner, resourceId, version, file, formedAt });
}

function m06Binding(stateCode, formedAt) {
  const payload = readJson(M06_EXPORT_PATH);
  const state = payload.checkpointStates[stateCode];
  if (!state) throw new Error(`M06 新导出缺少 ${stateCode}`);
  return {
    moduleId: "M06",
    moduleVersion: state.moduleVersion,
    exportId: state.exportId,
    exportRef: `${projectRef(M06_EXPORT_PATH)}#checkpointStates.${stateCode}`,
    exportSha256: sha256File(M06_EXPORT_PATH),
    validation: {
      status: "verified",
      validatedAt: formedAt,
      evidenceRef: projectRef(POST_EVIDENCE_PATH)
    },
    restoreMode: "isolated-clone"
  };
}

function reportItems(binding, formedAt, phaseCode) {
  const files = [
    [POINTER_HISTORY_PATH, "M06", `S004-${phaseCode}-CURRENT-POINTER-V1.0.1`, "1.0.1"],
    [path.join(SCENARIO_ROOT, "artifacts/report/publication-manifest-v1.0.1.json"), "M06", `S004-${phaseCode}-PUBLICATION-V1.0.1`, "1.0.1"],
    [path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.html"), "M06", `S004-${phaseCode}-HTML-V1.0.1`, "1.0.1"],
    [path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf"), "M06", `S004-${phaseCode}-PDF-V1.0.1`, "1.0.1"],
    [path.join(SCENARIO_ROOT, "artifacts/report/report-data-v1.0.1.json"), "M06", `S004-${phaseCode}-REPORT-DATA-V1.0.1`, "1.0.1"],
    [path.join(SCENARIO_ROOT, "artifacts/report/same-source-output-v1.0.1.json"), "M06", `S004-${phaseCode}-SAME-SOURCE-V1.0.1`, "1.0.1"]
  ];
  for (const [file] of files) if (!fs.existsSync(file)) throw new Error(`post-fix 报告制品缺失：${projectRef(file)}`);
  return [
    {
      owner: "M06",
      resourceId: binding.exportId,
      version: binding.moduleVersion,
      ref: binding.exportRef,
      sha256: binding.exportSha256,
      formedAt
    },
    ...files.map(([file, owner, resourceId, version]) => stateRef(file, owner, resourceId, version, formedAt))
  ];
}

function buildManifest({ alias, createdAt, baseAlias, stateCode, phaseCode }) {
  const base = readJson(checkpointManifestPath(baseAlias));
  const postEvidence = readJson(POST_EVIDENCE_PATH);
  const binding = m06Binding(stateCode, createdAt);
  const modules = structuredClone(base.modules);
  modules.M06 = binding;
  const sections = structuredClone(base.stateSections);
  sections.reports = referencedSection(reportItems(binding, createdAt, phaseCode));
  sections.evidence.items.push(
    stateRef(POST_EVIDENCE_PATH, "平台公共层", "S004-POST-FIX-PUBLICATION-V1.0.1", "1.0.1", createdAt),
    stateRef(
      path.join(SCENARIO_ROOT, "evidence/PRE-S004-20260815140408000-pointer-promotion.json"),
      "平台公共层",
      "S004-POINTER-PROMOTION-PRE",
      "1.0",
      createdAt
    ),
    stateRef(
      path.join(SCENARIO_ROOT, "artifacts/report/publication-manifest.json"),
      "M06",
      "S004-PRESERVED-PUBLICATION-V1.0",
      "1.0.0",
      createdAt
    )
  );
  const suffix = sha256Buffer(`${base.scenarioContext.scenarioRunId}\0${alias}\0${createdAt}`).slice(0, 12);
  return FOUNDATION.createCheckpointManifest(
    {
      checkpointId: `CP-S004-${alias.slice(-17)}-${suffix}`,
      checkpointNode: phaseCode === "CP50" ? "agent-report-dashboard-completed" : "e2e-integrated",
      baselineVersion: BASELINE_VERSION,
      baselineSnapshotId: BASELINE_SNAPSHOT_ID,
      parentVersion: BASELINE_VERSION,
      scenarioContext: base.scenarioContext,
      code: {
        prototypeVersion: base.code.prototypeVersion,
        buildVersion: `S004-v1-build-20260815.2-${phaseCode.toLowerCase()}-postfix`,
        entryRef: base.code.entryRef,
        treeSha256: postEvidence.code.treeSha256
      },
      modules,
      stateSections: sections,
      restoreReadiness: {
        status: "verified",
        verifiedAt: createdAt,
        evidenceRef: projectRef(POST_EVIDENCE_PATH)
      }
    },
    { now: new Date(createdAt) }
  );
}

function renderBundle() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  for (const alias of [ALIAS_50, ALIAS_60]) {
    if (catalog.checkpoints.some((entry) => entry.phaseAlias === alias)) throw new Error(`${alias} 已存在，禁止覆盖`);
  }
  const definitions = [
    { alias: ALIAS_50, createdAt: CREATED_AT_50, baseAlias: "CP-S004-50", stateCode: "POSTFIX_CP50", phaseCode: "CP50" },
    { alias: ALIAS_60, createdAt: CREATED_AT_60, baseAlias: "CP-S004-60", stateCode: "POSTFIX_CP60", phaseCode: "CP60" }
  ];
  const nextCatalog = structuredClone(catalog);
  const files = [];
  const entries = [];
  for (const definition of definitions) {
    const manifest = buildManifest(definition);
    const content = stableJson(manifest);
    const digest = sha256Buffer(content);
    const manifestPath = checkpointManifestPath(definition.alias);
    const digestPath = checkpointDigestPath(definition.alias);
    const baseEntry = catalog.checkpoints.find((entry) => entry.phaseAlias === definition.baseAlias);
    const entry = {
      phaseAlias: definition.alias,
      checkpointNode: manifest.checkpointNode,
      checkpointId: manifest.checkpointId,
      sourceScenarioRunId: manifest.sourceScenarioRunId,
      createdAt: manifest.createdAt,
      manifestRef: projectRef(manifestPath),
      manifestSha256: digest,
      immutable: true,
      status: "locked",
      contentVersion: "1.0.1",
      supersedesCheckpointId: baseEntry.checkpointId,
      sourcePointerPromotionCheckpointId: "CP-S004-20260815140408000-195f33db9b29",
      note: `${definition.phaseCode} 当前发布指针提升到 v1.0.1 后的追加快照`
    };
    entries.push(entry);
    nextCatalog.checkpoints.push(entry);
    files.push({ ref: projectRef(manifestPath), content, mode: "add" });
    files.push({ ref: projectRef(digestPath), content: `${digest}  manifest.json\n`, mode: "add" });
  }
  nextCatalog.generatedAt = CREATED_AT_60;
  const catalogContent = stableJson(nextCatalog);
  const catalogSha = sha256Buffer(catalogContent);
  const evidenceIndex = readJson(EVIDENCE_INDEX_PATH);
  const nextEvidenceIndex = structuredClone(evidenceIndex);
  nextEvidenceIndex.generatedAt = CREATED_AT_60;
  const catalogItem = nextEvidenceIndex.items.find((item) => item.evidenceType === "checkpoint-catalog");
  catalogItem.sha256 = catalogSha;
  nextEvidenceIndex.items.push(
    {
      evidenceType: "post-fix-publication-v1.0.1",
      ref: projectRef(POST_EVIDENCE_PATH),
      sha256: sha256File(POST_EVIDENCE_PATH)
    },
    {
      evidenceType: "publication-pointer-history-v1.0.1",
      ref: projectRef(POINTER_HISTORY_PATH),
      sha256: sha256File(POINTER_HISTORY_PATH)
    }
  );
  files.push({ ref: projectRef(CATALOG_PATH), content: catalogContent, mode: "replace" });
  files.push({ ref: projectRef(EVIDENCE_INDEX_PATH), content: stableJson(nextEvidenceIndex), mode: "replace" });
  return { entries, files };
}

function render() {
  process.stdout.write(JSON.stringify({ schemaVersion: 1, ...renderBundle() }));
}

function verify() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  for (const alias of [ALIAS_50, ALIAS_60]) {
    const entry = catalog.checkpoints.find((item) => item.phaseAlias === alias);
    if (!entry) throw new Error(`catalog 缺少 ${alias}`);
    validateS004PostFix(readJson(checkpointManifestPath(alias)), entry);
  }
  console.log(`${ALIAS_50} / ${ALIAS_60} 校验通过；当前发布版本为 v1.0.1。`);
}

if (process.argv[2] === "--render") render();
else if (process.argv[2] === "--verify") verify();
else usage();
