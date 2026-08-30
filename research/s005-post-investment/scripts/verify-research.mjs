#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const RESEARCH_DIR = path.resolve("research/s005-post-investment");
const EVIDENCE_DIR = path.join(RESEARCH_DIR, "evidence");
const SOURCE_DIR = process.env.S005_SOURCE_DIR;
const NODE_MODULES = process.env.CODEX_WORKSPACE_NODE_MODULES;

if (!SOURCE_DIR) throw new Error("S005_SOURCE_DIR must point to the read-only snapshot source directory");
if (!NODE_MODULES) throw new Error("CODEX_WORKSPACE_NODE_MODULES must point to the bundled Node.js dependencies");

const requiredDocuments = [
  "资料与数据盘点.md",
  "投资快照字段字典.md",
  "快照身份与历史复现合同草案.md",
  "投后评价方法对照矩阵.md",
  "数据缺口与诚实降级矩阵.md",
  "S005一期范围与用户旅程.md",
  "S005资源Owner与跨模块合同草案.md",
  "历史回放设计与验证结果.md",
  "待用户裁决与CR建议.md",
  "S005全周期投后评价补充设计与数据源方案.md",
];

const prototypeFiles = [
  "prototype/index.html",
  "prototype/variants.html",
  "prototype/styles.css",
  "prototype/variants.css",
  "prototype/data.js",
  "prototype/app.js",
  "prototype/variants.js",
  "prototype/README.md",
  "prototype/_d_meta.json",
  "prototype/vendor/chart-stage.js",
  "prototype/vendor/lucide.min.js",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function importCsv(Workbook, fileName, sheetName) {
  const csv = await fs.readFile(path.join(EVIDENCE_DIR, fileName), "utf8");
  const workbook = await Workbook.fromCSV(csv, { sheetName });
  return workbook.worksheets.getItem(sheetName).getUsedRange(true).values;
}

for (const document of requiredDocuments) {
  const stat = await fs.stat(path.join(RESEARCH_DIR, document));
  assert(stat.isFile() && stat.size > 0, `Missing or empty document: ${document}`);
}

for (const fileName of prototypeFiles) {
  const stat = await fs.stat(path.join(RESEARCH_DIR, fileName));
  assert(stat.isFile() && stat.size > 0, `Missing or empty prototype file: ${fileName}`);
}

const prototypeHtml = await fs.readFile(path.join(RESEARCH_DIR, "prototype/index.html"), "utf8");
const prototypeApp = await fs.readFile(path.join(RESEARCH_DIR, "prototype/app.js"), "utf8");
const prototypeData = await fs.readFile(path.join(RESEARCH_DIR, "prototype/data.js"), "utf8");
const prototypeVariants = await fs.readFile(path.join(RESEARCH_DIR, "prototype/variants.js"), "utf8");
const prototypeVariantsHtml = await fs.readFile(path.join(RESEARCH_DIR, "prototype/variants.html"), "utf8");
assert(prototypeHtml.includes("chart-stage.js"), "Prototype chart-stage not wired");
assert(prototypeHtml.includes("sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i"), "Prototype d3 integrity pin missing");
assert(prototypeData.includes("ofw.s005.research.v1"), "Prototype namespace missing");
assert(prototypeData.includes("v1.1.0"), "Prototype v1.1.0 baseline marker missing");
assert(prototypeData.includes("peerTopThird"), "Peer top-third series missing");
assert(prototypeVariants.includes("fund_type"), "Wind fund_type marker missing");
assert(prototypeVariants.includes("不在范围"), "Minimal scope status missing");
assert(prototypeVariants.includes("variantA") && prototypeVariants.includes("variantB") && prototypeVariants.includes("variantC"), "Three cockpit variants missing");
assert(prototypeVariantsHtml.includes("design_doc_mode"), "Variant design canvas marker missing");
assert(!prototypeApp.includes("localStorage.setItem"), "Prototype must not write localStorage");
assert(!prototypeApp.includes("fetch("), "Prototype must not fetch external business data");
assert(!prototypeVariants.includes("localStorage.setItem"), "Variant prototype must not write localStorage");
assert(!prototypeVariants.includes("fetch("), "Variant prototype must not fetch external business data");

const runtimeRequire = createRequire(path.join(NODE_MODULES, ".s005-verifier.cjs"));
const { Workbook } = runtimeRequire("@oai/artifact-tool");

const schemaSummary = JSON.parse(
  await fs.readFile(path.join(EVIDENCE_DIR, "snapshot-schema-summary.json"), "utf8"),
);
assert(schemaSummary.namespace === "ofw.s005.research.v1", "Wrong namespace");
assert(schemaSummary.coverage.actualSnapshotCount === 79, "Expected 79 snapshots");
assert(schemaSummary.coverage.totalSheetInstances === 393, "Expected 393 sheet instances");
assert(schemaSummary.coverage.firstSnapshotDate === "2025-02-21", "Wrong first date");
assert(schemaSummary.coverage.lastSnapshotDate === "2026-07-17", "Wrong last date");
assert(schemaSummary.structure.distinctWorkbookStructureCount === 2, "Expected two workbook structures");
assert(schemaSummary.structure.workbookStructureTransitionCount === 2, "Expected two structure transitions");
assert(schemaSummary.replayCandidateSelection.count === 15, "Expected 15 replay candidates");
assert(schemaSummary.privacy.rawProductNamesEmitted === false, "Privacy assertion failed");

const inventory = await importCsv(Workbook, "snapshot-inventory.csv", "Inventory");
const inventoryHeader = inventory[0];
const inventoryRows = inventory.slice(1);
assert(inventoryRows.length === 393, `Expected 393 inventory rows, got ${inventoryRows.length}`);
const inventoryIndex = Object.fromEntries(inventoryHeader.map((name, index) => [name, index]));
for (const field of ["snapshot_date", "file_name", "sha256", "sheet_name", "data_record_count"]) {
  assert(Number.isInteger(inventoryIndex[field]), `Inventory field missing: ${field}`);
}

const rowsByFile = new Map();
for (const row of inventoryRows) {
  const fileName = row[inventoryIndex.file_name];
  if (!rowsByFile.has(fileName)) rowsByFile.set(fileName, []);
  rowsByFile.get(fileName).push(row);
  assert(/^[a-f0-9]{64}$/.test(row[inventoryIndex.sha256]), `Invalid SHA-256 for ${fileName}`);
}
assert(rowsByFile.size === 79, `Expected 79 unique files, got ${rowsByFile.size}`);

for (const [fileName, rows] of rowsByFile) {
  const expectedSheetCount = fileName.includes("20251020") ? 3 : 5;
  assert(rows.length === expectedSheetCount, `${fileName}: expected ${expectedSheetCount} sheets, got ${rows.length}`);
  const bytes = await fs.readFile(path.join(SOURCE_DIR, fileName));
  assert(sha256(bytes) === rows[0][inventoryIndex.sha256], `${fileName}: source hash changed`);
}

const candidates = await importCsv(Workbook, "tracking-candidates.csv", "Candidates");
const candidateHeader = candidates[0];
const candidateRows = candidates.slice(1);
const candidateIndex = Object.fromEntries(candidateHeader.map((name, index) => [name, index]));
assert(candidateRows.length === 15, `Expected 15 candidates, got ${candidateRows.length}`);
assert(Number.isInteger(candidateIndex.stable_product_id), "Candidate ID field missing");
const candidateIds = candidateRows.map((row) => row[candidateIndex.stable_product_id]);
assert(new Set(candidateIds).size === 15, "Candidate IDs are not unique");
assert(candidateIds.every((id) => /^PRD-[A-F0-9]{16}$/.test(id)), "Candidate pseudonym format failed");

const fieldQuality = JSON.parse(
  await fs.readFile(path.join(EVIDENCE_DIR, "field-quality-summary.json"), "utf8"),
);
assert(fieldQuality.namespace === "ofw.s005.research.v1", "Field quality namespace mismatch");
assert(fieldQuality.sourceSnapshotCount === 79, "Field quality snapshot count mismatch");

const researchEntries = await fs.readdir(RESEARCH_DIR, { withFileTypes: true });
assert(
  researchEntries.every(
    (entry) => !entry.isFile() || !/\.(xlsx|xls|docx)$/i.test(entry.name),
  ),
  "Raw office document found in research root",
);

console.log(
  JSON.stringify({
    status: "ok",
    documents: requiredDocuments.length,
    snapshots: rowsByFile.size,
    inventoryRows: inventoryRows.length,
    replayCandidates: candidateRows.length,
    sourceHashesVerified: rowsByFile.size,
  }),
);
