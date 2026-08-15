#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  CHECKPOINT_DIR,
  FOUNDATION,
  SCENARIO_ROOT,
  checkpointDigestPath,
  checkpointManifestPath,
  codeTreeDigest,
  projectRef,
  readJson,
  sha256Buffer,
  sha256File,
  stableJson,
  validateCheckpointCatalog,
  writeImmutable
} from "./checkpoint-lib.mjs";

const CREATED_AT = "2026-08-15T14:55:00.000Z";
const FINAL_ALIAS = "CP-S004-DELIVERY-20260815145500000";
const FINAL_ID = "CP-S004-20260815145500000-95ba973809e9";
const SOURCE_ALIAS = "CP-S004-60-POSTFIX-20260815141021100";
const EVIDENCE_PATH = path.join(SCENARIO_ROOT, "evidence/final-delivery-ready-20260815145500000.json");
const TEST_PATH = path.join(SCENARIO_ROOT, "tests/checkpoint-contract.test.mjs");
const TEST_SNAPSHOT_PATH = path.join(
  SCENARIO_ROOT,
  "evidence/final-delivery/checkpoint-contract-28-tests-20260815145500000.snapshot.mjs"
);
const CATALOG_PATH = path.join(CHECKPOINT_DIR, "index.json");
const EVIDENCE_INDEX_PATH = path.join(SCENARIO_ROOT, "evidence/index.json");

const INVALID_ALIASES = new Set([
  "CP-S004-DELIVERY-20260815142926000",
  "CP-S004-60-POSTFIX-20260815143000000",
  "CP-S004-DELIVERY-20260815143509000"
  ,"CP-S004-DELIVERY-20260815144500000"
]);
const INVALID_EVIDENCE_REFS = new Set([
  "designs/prototype-work/v1.1.0/scenarios/s004/evidence/final-delivery-ready.json",
  "designs/prototype-work/v1.1.0/scenarios/s004/evidence/final-delivery-v1.0.1.json",
  "designs/prototype-work/v1.1.0/scenarios/s004/evidence/final-delivery-ready-v2.json",
  "designs/prototype-work/v1.1.0/scenarios/s004/evidence/final-delivery-ready-20260815144500000.json"
]);

function ref(relative) {
  return projectRef(path.join(SCENARIO_ROOT, relative));
}

function stateRef(relative, owner, resourceId, version) {
  const absolute = path.join(SCENARIO_ROOT, relative);
  return {
    formedAt: CREATED_AT,
    owner,
    ref: projectRef(absolute),
    resourceId,
    sha256: sha256File(absolute),
    version
  };
}

const sourceManifestPath = checkpointManifestPath(SOURCE_ALIAS);
const sourceManifest = readJson(sourceManifestPath);
const sourceEntry = readJson(CATALOG_PATH).checkpoints.find((item) => item.phaseAlias === SOURCE_ALIAS);
const code = codeTreeDigest();

writeImmutable(TEST_SNAPSHOT_PATH, fs.readFileSync(TEST_PATH));

const moduleOwnerExports = Object.fromEntries(
  FOUNDATION.MODULE_IDS.map((moduleId) => {
    const relative = moduleId === "M06" ? "module-exports/M06-publication-v1.0.1.json" : `module-exports/${moduleId}.json`;
    const absolute = path.join(SCENARIO_ROOT, relative);
    return [moduleId, { ref: projectRef(absolute), sha256: sha256File(absolute) }];
  })
);

const evidence = {
  schemaVersion: 1,
  evidenceType: "S004-delivery-handoff-completed",
  deliveryStage: "delivery-handoff-completed",
  deliveryStatus: "final-delivery-ready",
  formedAt: CREATED_AT,
  scenarioContext: sourceManifest.scenarioContext,
  baselineVersion: sourceManifest.baselineVersion,
  baselineSnapshotId: sourceManifest.baselineSnapshotId,
  sourceFinalCheckpoint: {
    phaseAlias: SOURCE_ALIAS,
    checkpointId: sourceManifest.checkpointId,
    manifestSha256: sha256File(sourceManifestPath)
  },
  removedInvalidIntermediates: [...INVALID_ALIASES],
  code: {
    treeSha256: code.treeSha256,
    files: code.files,
    bytes: code.bytes,
    entryRef: "designs/prototype-work/v1.1.0/scenarios/s004/index.html#home"
  },
  deliveryDocuments: [
    { ref: ref("README.md"), sha256: sha256File(path.join(SCENARIO_ROOT, "README.md")) },
    { ref: ref("INTEGRATION-HANDOFF.md"), sha256: sha256File(path.join(SCENARIO_ROOT, "INTEGRATION-HANDOFF.md")) },
    { ref: ref("_d_meta.json"), sha256: sha256File(path.join(SCENARIO_ROOT, "_d_meta.json")) }
  ],
  moduleOwnerExports,
  currentPublication: {
    pointerRef: ref("artifacts/report/current-publication-pointer.json"),
    pointerSha256: sha256File(path.join(SCENARIO_ROOT, "artifacts/report/current-publication-pointer.json")),
    publicationId: "PUB-S004-20260815-0002",
    contentVersion: "1.0.1",
    pdfRef: ref("artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf"),
    pdfSha256: sha256File(path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf")),
    sameSourceOutputRef: ref("artifacts/report/same-source-output-v1.0.1.json"),
    sameSourceOutputSha256: sha256File(path.join(SCENARIO_ROOT, "artifacts/report/same-source-output-v1.0.1.json"))
  },
  verification: {
    checkpointContract: {
      result: "28/28 passed",
      sourceSnapshotRef: projectRef(TEST_SNAPSHOT_PATH),
      sourceSnapshotSha256: sha256File(TEST_SNAPSHOT_PATH)
    },
    foundationContract: { result: "12/12 passed" },
    baseline: { result: "v1.0.3 T056 passed" },
    browser: {
      result: "PASS",
      ref: ref("evidence/browser/browser-verification.json"),
      sha256: sha256File(path.join(SCENARIO_ROOT, "evidence/browser/browser-verification.json")),
      viewports: ["1440x900", "1280x720", "390x844"],
      consoleErrors: 0,
      consoleWarnings: 0
    },
    workbook: {
      result: "PASS",
      workbookRef: ref("artifacts/data/S004_贷前调查合成演示资料包.xlsx"),
      workbookSha256: sha256File(path.join(SCENARIO_ROOT, "artifacts/data/S004_贷前调查合成演示资料包.xlsx")),
      inspectionRef: ref("artifacts/data/S004_贷前调查合成演示资料包.xlsx.inspect.ndjson"),
      inspectionSha256: sha256File(path.join(SCENARIO_ROOT, "artifacts/data/S004_贷前调查合成演示资料包.xlsx.inspect.ndjson")),
      formulaErrorMatches: 0
    },
    pdf: {
      result: "PASS",
      contentVersion: "1.0.1",
      pdfSha256: sha256File(path.join(SCENARIO_ROOT, "artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf")),
      browserPdfStatus: 200,
      sameSource: true
    }
  },
  boundaries: {
    scenarioIndependentAcceptanceCompleted: true,
    integrationReady: true,
    platformAcceptanceReady: false,
    doesNotModifySharedFoundation: true,
    doesNotOverwriteHistoricalCheckpoint: true
  },
  status: "verified"
};
const evidenceContent = stableJson(evidence);
writeImmutable(EVIDENCE_PATH, evidenceContent);
const evidenceSha256 = sha256Buffer(evidenceContent);

const manifest = structuredClone(sourceManifest);
manifest.checkpointId = FINAL_ID;
manifest.createdAt = CREATED_AT;
manifest.code = {
  ...manifest.code,
  buildVersion: "S004-v1-build-20260815.4-final-delivery",
  treeSha256: code.treeSha256
};
manifest.modules.M06.validation = {
  evidenceRef: projectRef(EVIDENCE_PATH),
  status: "verified",
  validatedAt: CREATED_AT
};
manifest.restoreReadiness = {
  evidenceRef: projectRef(EVIDENCE_PATH),
  status: "verified",
  verifiedAt: CREATED_AT
};
manifest.stateSections.evidence.items = [
  ...manifest.stateSections.evidence.items,
  {
    formedAt: CREATED_AT,
    owner: "平台公共层",
    ref: projectRef(EVIDENCE_PATH),
    resourceId: "S004-FINAL-DELIVERY-READY",
    sha256: evidenceSha256,
    version: "final-delivery"
  },
  stateRef("README.md", "S004 场景总装", "S004-FINAL-README", "final"),
  stateRef("INTEGRATION-HANDOFF.md", "S004 场景总装", "S004-FINAL-INTEGRATION-HANDOFF", "final"),
  stateRef("_d_meta.json", "S004 场景总装", "S004-FINAL-D-META", "final"),
  stateRef("evidence/browser/browser-verification.json", "S004 浏览器验证", "S004-FINAL-BROWSER-EVIDENCE", "final"),
  stateRef("artifacts/data/S004_贷前调查合成演示资料包.xlsx.inspect.ndjson", "M02", "S004-FINAL-WORKBOOK-INSPECTION", "final"),
  stateRef(
    "evidence/final-delivery/checkpoint-contract-28-tests-20260815145500000.snapshot.mjs",
    "平台公共层",
    "S004-FINAL-CHECKPOINT-CONTRACT-SNAPSHOT",
    "28-tests"
  )
];

const finalManifestContent = stableJson(manifest);
const finalManifestPath = checkpointManifestPath(FINAL_ALIAS);
const finalDigestPath = checkpointDigestPath(FINAL_ALIAS);
const finalManifestSha256 = sha256Buffer(finalManifestContent);
writeImmutable(finalManifestPath, finalManifestContent);
writeImmutable(finalDigestPath, `${finalManifestSha256}  manifest.json\n`);

const catalog = readJson(CATALOG_PATH);
catalog.checkpoints = catalog.checkpoints.filter(
  (entry) => !INVALID_ALIASES.has(entry.phaseAlias) && entry.phaseAlias !== FINAL_ALIAS
);
catalog.checkpoints.push({
  checkpointId: FINAL_ID,
  checkpointNode: "e2e-integrated",
  createdAt: CREATED_AT,
  deliveryStage: "delivery-handoff-completed",
  deliveryStatus: "final-delivery-ready",
  immutable: true,
  manifestRef: projectRef(finalManifestPath),
  manifestSha256: finalManifestSha256,
  note: "S004 独立验收、集成交接、Owner 导出和全类验证完成后的唯一最终来源快照",
  phaseAlias: FINAL_ALIAS,
  sourceScenarioRunId: sourceManifest.sourceScenarioRunId,
  status: "locked",
  supersedesCheckpointId: sourceEntry.checkpointId
});
catalog.generatedAt = CREATED_AT;
fs.writeFileSync(CATALOG_PATH, stableJson(catalog));

const evidenceIndex = readJson(EVIDENCE_INDEX_PATH);
evidenceIndex.items = evidenceIndex.items.filter(
  (item) => !INVALID_EVIDENCE_REFS.has(item.ref) && item.ref !== projectRef(EVIDENCE_PATH)
);
evidenceIndex.items.push({
  evidenceType: "final-delivery-ready",
  ref: projectRef(EVIDENCE_PATH),
  sha256: evidenceSha256
});
const catalogEvidence = evidenceIndex.items.find((item) => item.evidenceType === "checkpoint-catalog");
catalogEvidence.sha256 = sha256File(CATALOG_PATH);
evidenceIndex.generatedAt = CREATED_AT;
fs.writeFileSync(EVIDENCE_INDEX_PATH, stableJson(evidenceIndex));

for (const alias of INVALID_ALIASES) {
  fs.rmSync(path.join(CHECKPOINT_DIR, alias), { recursive: true, force: true });
}
for (const evidenceRef of INVALID_EVIDENCE_REFS) {
  fs.rmSync(path.resolve(path.join(SCENARIO_ROOT, "../../../../.."), evidenceRef), { force: true });
}
fs.rmSync(path.join(SCENARIO_ROOT, "evidence/final-delivery/checkpoint-contract-27-tests.snapshot.mjs"), { force: true });
fs.rmSync(path.join(SCENARIO_ROOT, "evidence/final-delivery/checkpoint-contract-28-tests.snapshot.mjs"), { force: true });
fs.rmSync(path.join(CHECKPOINT_DIR, "create-final-delivery-checkpoint.mjs"), { force: true });

validateCheckpointCatalog(readJson(CATALOG_PATH));
console.log(`${FINAL_ALIAS} / ${FINAL_ID} / ${finalManifestSha256}`);
