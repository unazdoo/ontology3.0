#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

const DEFAULT_SOURCE_DIR = process.env.S005_SOURCE_DIR || null;
const DEFAULT_OUTPUT_DIR = path.resolve(
  "research/s005-post-investment/evidence",
);
const DEFAULT_NODE_MODULES = process.env.CODEX_WORKSPACE_NODE_MODULES || null;
const DEFAULT_PYTHON = process.env.CODEX_WORKSPACE_PYTHON || "python3";
const NAMESPACE = "ofw.s005.research.v1";
const EXPECTED_SNAPSHOT_COUNT = 79;
const CANDIDATE_COUNT = 15;

function parseArgs(argv) {
  const options = {
    sourceDir: DEFAULT_SOURCE_DIR,
    outputDir: DEFAULT_OUTPUT_DIR,
    nodeModules:
      process.env.CODEX_WORKSPACE_NODE_MODULES || DEFAULT_NODE_MODULES,
    python: process.env.CODEX_WORKSPACE_PYTHON || DEFAULT_PYTHON,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--source" && value) {
      options.sourceDir = path.resolve(value);
      index += 1;
    } else if (argument === "--output" && value) {
      options.outputDir = path.resolve(value);
      index += 1;
    } else if (argument === "--node-modules" && value) {
      options.nodeModules = path.resolve(value);
      index += 1;
    } else if (argument === "--python" && value) {
      options.python = path.resolve(value);
      index += 1;
    } else if (argument === "--help") {
      console.log(
        "Usage: audit-snapshots.mjs [--source DIR] [--output DIR] [--node-modules DIR] [--python FILE]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  if (!options.sourceDir) {
    throw new Error("Provide --source DIR or set S005_SOURCE_DIR");
  }
  if (!options.nodeModules) {
    throw new Error("Provide --node-modules DIR or set CODEX_WORKSPACE_NODE_MODULES");
  }
  return options;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase();
}

function isPresent(value) {
  return value !== null && value !== undefined && normalizeText(value) !== "";
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isUsableIdentity(value) {
  const normalized = normalizeKey(value);
  return (
    normalized.length > 0 &&
    /[\p{L}\p{N}]/u.test(normalized) &&
    !isFormulaErrorValue(normalized)
  );
}

function anonymizedId(domain, rawValue) {
  return `${domain.toUpperCase()}-${sha256(
    `${NAMESPACE}|${domain}|${normalizeKey(rawValue)}`,
  )
    .slice(0, 16)
    .toUpperCase()}`;
}

function excelColumn(index) {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function trimMatrix(values) {
  let lastRow = -1;
  let lastColumn = -1;
  for (let rowIndex = 0; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex] || [];
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      if (isPresent(row[columnIndex])) {
        lastRow = Math.max(lastRow, rowIndex);
        lastColumn = Math.max(lastColumn, columnIndex);
      }
    }
  }
  if (lastRow < 0 || lastColumn < 0) return [];
  return values
    .slice(0, lastRow + 1)
    .map((row) => Array.from({ length: lastColumn + 1 }, (_, index) => row?.[index] ?? null));
}

function mergeCachedValues(artifactValues, cachedValues) {
  const rowCount = Math.max(artifactValues.length, cachedValues.length);
  const columnCount = Math.max(
    artifactValues.reduce((maximum, row) => Math.max(maximum, row.length), 0),
    cachedValues.reduce((maximum, row) => Math.max(maximum, row.length), 0),
  );
  return trimMatrix(
    Array.from({ length: rowCount }, (_, rowIndex) =>
      Array.from({ length: columnCount }, (_, columnIndex) => {
        const cachedValue = cachedValues[rowIndex]?.[columnIndex];
        const artifactValue = artifactValues[rowIndex]?.[columnIndex];
        if (isPresent(artifactValue) && !isFormulaErrorValue(artifactValue)) {
          return artifactValue;
        }
        if (isPresent(cachedValue)) return cachedValue;
        return null;
      }),
    ),
  );
}

function compositeFields(values, headerRows, columnCount) {
  return Array.from({ length: columnCount }, (_, columnIndex) => {
    const labels = headerRows
      .map((rowIndex) => normalizeText(values[rowIndex]?.[columnIndex]))
      .filter(Boolean);
    const uniqueLabels = [...new Set(labels)];
    return uniqueLabels.length > 0
      ? uniqueLabels.join(" / ")
      : `UNLABELED_COLUMN_${excelColumn(columnIndex)}`;
  });
}

function selectSheetProfile(sheetName, values, columnCount) {
  const normalizedName = normalizeText(sheetName);
  if (normalizedName === "投资项目每周简报") {
    return {
      role: "product_position_snapshot",
      headerRows: [0],
      recordMethod: "rows_after_header_with_security_code_and_name",
      isDataRow: (row, rowIndex) =>
        rowIndex > 0 &&
        isPresent(row[0]) &&
        isPresent(row[1]) &&
        ![row[0], row[1]].some((value) =>
          [values[0]?.[0], values[0]?.[1]].some(
            (header) => normalizeText(value) === normalizeText(header),
          ),
        ),
    };
  }
  if (normalizedName === "风险监控指标") {
    return {
      role: "portfolio_risk_indicator_definition",
      headerRows: [0, 1],
      recordMethod: "rows_after_two_level_header_with_indicator_name",
      isDataRow: (row, rowIndex) => rowIndex > 1 && isPresent(row[0]),
    };
  }
  if (normalizedName === "债券投资交易风险监控周报表") {
    return {
      role: "bond_trade_risk_snapshot",
      headerRows: [2],
      recordMethod: "rows_after_header_with_bond_name_excluding_repeated_header",
      isDataRow: (row, rowIndex) =>
        rowIndex > 2 &&
        isPresent(row[2]) &&
        normalizeText(row[2]) !== normalizeText(values[2]?.[2]),
    };
  }
  if (normalizedName === "固收业务风险监控周报表") {
    return {
      role: "fixed_income_holding_risk_snapshot",
      headerRows: [3],
      recordMethod: "rows_after_header_with_bond_name",
      isDataRow: (row, rowIndex) =>
        rowIndex > 3 &&
        isPresent(row[2]) &&
        normalizeText(row[2]) !== normalizeText(values[3]?.[2]),
    };
  }
  if (normalizedName === "投资风险限额监控表") {
    return {
      role: "investment_limit_snapshot",
      headerRows: [2, 3],
      recordMethod: "rows_after_two_level_header_with_business_or_product_type",
      isDataRow: (row, rowIndex) => rowIndex > 3 && (isPresent(row[0]) || isPresent(row[1])),
    };
  }

  const headerRow = values.reduce(
    (best, row, rowIndex) => {
      const textCells = (row || []).filter(
        (value) => typeof value === "string" && normalizeText(value),
      ).length;
      return textCells > best.textCells ? { rowIndex, textCells } : best;
    },
    { rowIndex: 0, textCells: -1 },
  ).rowIndex;
  return {
    role: "unclassified_sheet",
    headerRows: [headerRow],
    recordMethod: "rows_after_detected_header_with_any_value",
    isDataRow: (row, rowIndex) =>
      rowIndex > headerRow && (row || []).some((value) => isPresent(value)),
  };
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n") + "\n";
}

function percentage(numerator, denominator) {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}

function updateIdentity(map, rawKey, date, alias, completeness = null) {
  const key = normalizeKey(rawKey);
  if (!isUsableIdentity(key)) return;
  let entry = map.get(key);
  if (!entry) {
    entry = {
      key,
      dates: new Set(),
      aliases: new Set(),
      completenessValues: [],
    };
    map.set(key, entry);
  }
  entry.dates.add(date);
  if (isPresent(alias)) entry.aliases.add(normalizeKey(alias));
  if (completeness !== null) entry.completenessValues.push(completeness);
}

function summarizeCoverage(entries, snapshotCount) {
  const counts = entries.map((entry) => entry.dates.size);
  const atLeast = (minimum) => counts.filter((count) => count >= minimum).length;
  return {
    distinctIdentityCount: entries.length,
    observedOnceCount: counts.filter((count) => count === 1).length,
    observedAtLeast4Count: atLeast(4),
    observedAtLeast13Count: atLeast(13),
    observedAtLeast26Count: atLeast(26),
    observedInAtLeastHalfSnapshotsCount: atLeast(Math.ceil(snapshotCount / 2)),
    observedInAllSnapshotsCount: counts.filter((count) => count === snapshotCount).length,
    maximumSnapshotCount: counts.length > 0 ? Math.max(...counts) : 0,
  };
}

function isFormula(value) {
  return typeof value === "string" && value.startsWith("=");
}

function isFormulaErrorValue(value) {
  return (
    typeof value === "string" &&
    /^#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|GETTING_DATA|SPILL!|CALC!|FIELD!|BLOCKED!|UNKNOWN!|CONNECT!|BUSY!)$/i.test(
      value.trim(),
    )
  );
}

function duplicateKeyCounts(rows, columnIndex) {
  const counts = new Map();
  let missingKeyRowCount = 0;
  for (const row of rows) {
    const key = normalizeKey(row[columnIndex]);
    if (!isUsableIdentity(key)) {
      missingKeyRowCount += 1;
      continue;
    }
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicatedCounts = [...counts.values()].filter((count) => count > 1);
  return {
    rowCount: rows.length,
    populatedKeyCount: counts.size,
    missingKeyRowCount,
    duplicatedKeyCount: duplicatedCounts.length,
    duplicateRowCount: duplicatedCounts.reduce((sum, count) => sum + count - 1, 0),
  };
}

function fieldTemporalSemantics(role, columnIndex) {
  const semantics = {
    product_position_snapshot: [
      "identifier",
      "descriptive_as_of_snapshot",
      "classification_as_of_snapshot",
      "classification_as_of_snapshot",
      "classification_as_of_snapshot",
      "organizational_assignment_as_of_snapshot",
      "point_in_time_balance",
      "ambiguous_balance_or_cost_basis",
      "year_to_date_cumulative",
      "point_in_time_valuation",
      "point_in_time_valuation_result",
      "point_in_time_market_price",
      "cost_basis",
      "year_to_date_cumulative_realized_result",
      "classification_as_of_snapshot",
      "organizational_assignment_as_of_snapshot",
    ],
    portfolio_risk_indicator_definition: [
      "rule_definition",
      "rule_definition",
      "rule_definition",
      "rule_threshold",
      "rule_threshold",
      "rule_threshold",
      "rule_definition",
      "rule_definition",
      "rule_definition",
    ],
    bond_trade_risk_snapshot: [
      "row_identifier",
      "classification_as_of_snapshot",
      "descriptive_as_of_snapshot",
      "point_in_time_nominal_balance",
      "cost_basis",
      "point_in_time_market_price",
      "cumulative_received_interest",
      "cumulative_performance_measure",
      "risk_threshold_or_status",
      "risk_threshold_or_status",
    ],
    fixed_income_holding_risk_snapshot: [
      "row_identifier",
      "classification_as_of_snapshot",
      "descriptive_as_of_snapshot",
      "descriptive_as_of_snapshot",
      "point_in_time_concentration",
      "point_in_time_portfolio_ratio",
      "point_in_time_term_or_duration",
      "point_in_time_investment_balance",
      "derived_or_unlabeled_source_value",
      "derived_or_unlabeled_source_value",
      "derived_or_unlabeled_source_value",
    ],
    investment_limit_snapshot: [
      "classification_as_of_snapshot",
      "classification_as_of_snapshot",
      "point_in_time_position_or_cost",
      "rule_limit",
      "point_in_time_limit_measure",
      "point_in_time_limit_status",
      "descriptive_as_of_snapshot",
    ],
  };
  return semantics[role]?.[columnIndex] || "unknown_requires_owner_definition";
}

function updateFieldQuality(
  qualityMap,
  sheetName,
  role,
  fields,
  dataRowEntries,
  artifactValues,
  cachedValues,
  formulas,
  formulaAccessAvailable,
) {
  for (let columnIndex = 0; columnIndex < fields.length; columnIndex += 1) {
    const field = fields[columnIndex];
    const key = `${role}|${columnIndex}|${field}`;
    if (!qualityMap.has(key)) {
      qualityMap.set(key, {
        sheetName,
        sheetRole: role,
        columnIndex1Based: columnIndex + 1,
        field,
        temporalSemantics: fieldTemporalSemantics(role, columnIndex),
        snapshotDates: new Set(),
        totalDataRows: 0,
        nonEmptyCount: 0,
        numericCount: 0,
        formulaCellCount: 0,
        formulaErrorValueCount: 0,
        formulaErrorInFormulaCellCount: 0,
        artifactImportErrorValueCount: 0,
        artifactImportErrorInFormulaCellCount: 0,
        formulaAccessUnavailableSnapshotCount: 0,
      });
    }
    const entry = qualityMap.get(key);
    if (!formulaAccessAvailable) {
      entry.formulaAccessUnavailableSnapshotCount += 1;
    }
    for (const { row, rowIndex, snapshotDate } of dataRowEntries) {
      const value = row[columnIndex];
      const formula = formulaAccessAvailable
        ? formulas[rowIndex]?.[columnIndex]
        : null;
      const artifactValue = artifactValues[rowIndex]?.[columnIndex];
      const cachedValue = cachedValues[rowIndex]?.[columnIndex];
      entry.snapshotDates.add(snapshotDate);
      entry.totalDataRows += 1;
      if (isPresent(value)) entry.nonEmptyCount += 1;
      if (isNumber(value)) entry.numericCount += 1;
      if (isFormula(formula)) entry.formulaCellCount += 1;
      if (isFormulaErrorValue(cachedValue)) entry.formulaErrorValueCount += 1;
      if (isFormula(formula) && isFormulaErrorValue(cachedValue)) {
        entry.formulaErrorInFormulaCellCount += 1;
      }
      if (isFormulaErrorValue(artifactValue)) {
        entry.artifactImportErrorValueCount += 1;
      }
      if (isFormula(formula) && isFormulaErrorValue(artifactValue)) {
        entry.artifactImportErrorInFormulaCellCount += 1;
      }
    }
  }
}

const options = parseArgs(process.argv.slice(2));
const execFileAsync = promisify(execFile);
const runtimeRequire = createRequire(
  path.join(options.nodeModules, ".s005-artifact-tool-resolver.cjs"),
);
const { FileBlob, SpreadsheetFile } = runtimeRequire("@oai/artifact-tool");
let artifactToolVersion = "2.8.6+";
try {
  const packageMetadata = JSON.parse(
    await fs.readFile(
      path.join(options.nodeModules, "@oai/artifact-tool/package.json"),
      "utf8",
    ),
  );
  artifactToolVersion = packageMetadata.version || artifactToolVersion;
} catch {
  // The public skill contract guarantees 2.8.6+; exact package metadata is optional.
}

const sourceEntries = (await fs.readdir(options.sourceDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^.*\uff08\d{8}\uff09\.xlsx$/u.test(entry.name))
  .map((entry) => {
    const match = entry.name.match(/\uff08(\d{8})\uff09\.xlsx$/u);
    return {
      fileName: entry.name,
      dateCompact: match[1],
      date: `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}`,
      fullPath: path.join(options.sourceDir, entry.name),
    };
  })
  .sort((left, right) => left.dateCompact.localeCompare(right.dateCompact));

if (sourceEntries.length === 0) {
  throw new Error(`No dated XLSX snapshots found in ${options.sourceDir}`);
}
if (sourceEntries.length !== EXPECTED_SNAPSHOT_COUNT) {
  throw new Error(
    `Expected ${EXPECTED_SNAPSHOT_COUNT} dated snapshots, found ${sourceEntries.length}; update the governed baseline before rerunning.`,
  );
}

const cachedValueExtractor = String.raw`
import datetime
import json
import math
import pathlib
import re
import sys
from openpyxl import load_workbook

source_dir = pathlib.Path(sys.argv[1])
pattern = re.compile(r".*\uff08\d{8}\uff09\.xlsx$")

def clean(value):
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (datetime.date, datetime.datetime, datetime.time)):
        return value.isoformat()
    return str(value)

result = {}
for workbook_path in sorted(
    (path for path in source_dir.iterdir() if path.is_file() and pattern.match(path.name)),
    key=lambda path: path.name,
):
    workbook = load_workbook(workbook_path, read_only=True, data_only=True)
    result[workbook_path.name] = {
        sheet.title: [
            [clean(value) for value in row]
            for row in sheet.iter_rows(values_only=True)
        ]
        for sheet in workbook.worksheets
    }
    workbook.close()
json.dump(result, sys.stdout, ensure_ascii=False, separators=(",", ":"))
`;
const { stdout: cachedValueJson } = await execFileAsync(
  options.python,
  ["-c", cachedValueExtractor, options.sourceDir],
  { maxBuffer: 64 * 1024 * 1024, encoding: "utf8" },
);
const cachedWorkbookValues = JSON.parse(cachedValueJson);

const inventoryRows = [];
const workbookAudits = [];
const productIdentities = new Map();
const issuerIdentities = new Map();
const bondHoldingIdentities = new Map();
const productNameToCodes = new Map();
const fieldQualityMap = new Map();
const duplicateKeyAudit = [];
let formulaAccessFailureCount = 0;
let cachedValueAccessFailureCount = 0;

for (const sourceEntry of sourceEntries) {
  const fileBytes = await fs.readFile(sourceEntry.fullPath);
  const fileStat = await fs.stat(sourceEntry.fullPath);
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(sourceEntry.fullPath),
  );
  const sheetAudits = [];
  const snapshotDuplicateAudit = {
    snapshotDate: sourceEntry.date,
    productSecurityCode: null,
    fixedIncomeBondName: null,
    fixedIncomeIssuerName: null,
    bondTradeBondName: null,
  };

  for (let sheetIndex = 0; sheetIndex < workbook.worksheets.items.length; sheetIndex += 1) {
    const sheet = workbook.worksheets.items[sheetIndex];
    const usedRange = sheet.getUsedRange(true);
    const artifactValues = trimMatrix(usedRange?.values || []);
    const cachedWorkbook = cachedWorkbookValues[sourceEntry.fileName] || {};
    const cachedSheetValues = Object.entries(cachedWorkbook).find(
      ([cachedSheetName]) => normalizeText(cachedSheetName) === normalizeText(sheet.name),
    )?.[1];
    if (!cachedSheetValues) cachedValueAccessFailureCount += 1;
    const cachedValues = trimMatrix(cachedSheetValues || []);
    const values = mergeCachedValues(
      artifactValues,
      cachedValues,
    );
    let formulas = [];
    let formulaAccessAvailable = true;
    try {
      formulas = usedRange?.formulas || [];
    } catch {
      formulaAccessAvailable = false;
      formulaAccessFailureCount += 1;
    }
    const usedRows = artifactValues.length;
    const usedColumns = artifactValues.reduce(
      (maximum, row) => Math.max(maximum, row.length),
      0,
    );
    const profile = selectSheetProfile(sheet.name, artifactValues, usedColumns);
    const fields = compositeFields(artifactValues, profile.headerRows, usedColumns);
    const dataRowEntries = values
      .map((row, rowIndex) => ({
        row,
        rowIndex,
        snapshotDate: sourceEntry.date,
      }))
      .filter(({ row, rowIndex }) => profile.isDataRow(row, rowIndex));
    const dataRows = dataRowEntries.map(({ row }) => row);
    updateFieldQuality(
      fieldQualityMap,
      sheet.name,
      profile.role,
      fields,
      dataRowEntries,
      artifactValues,
      cachedValues,
      formulas,
      formulaAccessAvailable,
    );
    const structurePayload = {
      sheetName: normalizeText(sheet.name),
      role: profile.role,
      headerRows: profile.headerRows.map((rowIndex) => rowIndex + 1),
      usedColumns,
      fields: fields.map(normalizeText),
    };
    const structureSignature = sha256(
      JSON.stringify(structurePayload),
    ).slice(0, 16);

    if (profile.role === "product_position_snapshot") {
      snapshotDuplicateAudit.productSecurityCode = duplicateKeyCounts(dataRows, 0);
      for (const row of dataRows) {
        const productCode = row[0];
        const productName = row[1];
        const numericCoverage =
          row.slice(6, 14).filter(isNumber).length / Math.min(8, Math.max(1, row.slice(6, 14).length));
        updateIdentity(
          productIdentities,
          productCode,
          sourceEntry.date,
          productName,
          numericCoverage,
        );
        const nameKey = normalizeKey(productName);
        if (nameKey) {
          if (!productNameToCodes.has(nameKey)) productNameToCodes.set(nameKey, new Set());
          productNameToCodes.get(nameKey).add(normalizeKey(productCode));
        }
      }
    } else if (profile.role === "fixed_income_holding_risk_snapshot") {
      snapshotDuplicateAudit.fixedIncomeBondName = duplicateKeyCounts(dataRows, 2);
      snapshotDuplicateAudit.fixedIncomeIssuerName = duplicateKeyCounts(dataRows, 3);
      for (const row of dataRows) {
        updateIdentity(
          bondHoldingIdentities,
          row[2],
          sourceEntry.date,
          row[2],
        );
        if (isPresent(row[3])) {
          updateIdentity(issuerIdentities, row[3], sourceEntry.date, row[3]);
        }
      }
    } else if (profile.role === "bond_trade_risk_snapshot") {
      snapshotDuplicateAudit.bondTradeBondName = duplicateKeyCounts(dataRows, 2);
      for (const row of dataRows) {
        updateIdentity(
          bondHoldingIdentities,
          row[2],
          sourceEntry.date,
          row[2],
        );
      }
    }

    sheetAudits.push({
      sheetIndex: sheetIndex + 1,
      sheetName: sheet.name,
      role: profile.role,
      headerRows: profile.headerRows.map((rowIndex) => rowIndex + 1),
      fields,
      usedRows,
      usedColumns,
      dataRecordCount: dataRows.length,
      recordMethod: profile.recordMethod,
      structureSignature,
      formulaAccessAvailable,
    });
  }

  const workbookStructureSignature = sha256(
    JSON.stringify(
      sheetAudits.map((sheet) => ({
        sheetName: sheet.sheetName,
        structureSignature: sheet.structureSignature,
      })),
    ),
  ).slice(0, 16);
  workbookAudits.push({
    ...sourceEntry,
    sha256: sha256(fileBytes),
    sizeBytes: fileStat.size,
    sheetAudits,
    workbookStructureSignature,
  });
  duplicateKeyAudit.push(snapshotDuplicateAudit);
}

for (let index = 0; index < workbookAudits.length; index += 1) {
  const workbook = workbookAudits[index];
  const previous = workbookAudits[index - 1];
  const currentSignatures = new Map(
    workbook.sheetAudits.map((sheet) => [sheet.sheetName, sheet.structureSignature]),
  );
  const previousSignatures = new Map(
    (previous?.sheetAudits || []).map((sheet) => [sheet.sheetName, sheet.structureSignature]),
  );
  const allSheetNames = [...new Set([...currentSignatures.keys(), ...previousSignatures.keys()])];
  const changedSheets = allSheetNames.filter(
    (sheetName) => currentSignatures.get(sheetName) !== previousSignatures.get(sheetName),
  );
  const changeStatus = !previous
    ? "INITIAL"
    : changedSheets.length === 0
      ? "UNCHANGED"
      : "CHANGED";
  for (const sheet of workbook.sheetAudits) {
    inventoryRows.push({
      snapshot_date: workbook.date,
      file_name: workbook.fileName,
      sha256: workbook.sha256,
      size_bytes: workbook.sizeBytes,
      sheet_index: sheet.sheetIndex,
      sheet_name: sheet.sheetName,
      sheet_role: sheet.role,
      header_rows_1_based: sheet.headerRows.join("|"),
      field_names_json: JSON.stringify(sheet.fields),
      used_rows: sheet.usedRows,
      used_columns: sheet.usedColumns,
      data_record_count: sheet.dataRecordCount,
      record_count_method: sheet.recordMethod,
      sheet_structure_signature: sheet.structureSignature,
      workbook_structure_signature: workbook.workbookStructureSignature,
      structure_change_vs_previous: changeStatus,
      changed_sheets_vs_previous: changedSheets.join("|"),
    });
  }
}

const products = [...productIdentities.values()];
const issuers = [...issuerIdentities.values()];
const bondHoldings = [...bondHoldingIdentities.values()];
const candidates = products
  .map((product) => {
    const completeness =
      product.completenessValues.length === 0
        ? 0
        : product.completenessValues.reduce((sum, value) => sum + value, 0) /
          product.completenessValues.length;
    const dates = [...product.dates].sort();
    return {
      stable_product_id: anonymizedId("prd", product.key),
      snapshot_count: product.dates.size,
      snapshot_coverage_pct: percentage(product.dates.size, sourceEntries.length),
      first_seen_date: dates[0],
      last_seen_date: dates.at(-1),
      name_variant_count: product.aliases.size,
      numeric_field_coverage_pct: Number((completeness * 100).toFixed(2)),
      stable_key_basis: "normalized_security_code",
      key_quality: product.aliases.size <= 1 ? "STRONG" : "REVIEW_ALIAS_VARIATION",
      selection_reason: "highest_cross_snapshot_coverage_then_numeric_completeness",
    };
  })
  .sort(
    (left, right) =>
      right.snapshot_count - left.snapshot_count ||
      right.numeric_field_coverage_pct - left.numeric_field_coverage_pct ||
      left.stable_product_id.localeCompare(right.stable_product_id),
  )
  .slice(0, Math.min(CANDIDATE_COUNT, products.length))
  .map((candidate, index) => ({ replay_rank: index + 1, ...candidate }));

const workbookVariantMap = new Map();
for (const workbook of workbookAudits) {
  if (!workbookVariantMap.has(workbook.workbookStructureSignature)) {
    workbookVariantMap.set(workbook.workbookStructureSignature, []);
  }
  workbookVariantMap.get(workbook.workbookStructureSignature).push(workbook.date);
}

const sheetProfileMap = new Map();
for (const workbook of workbookAudits) {
  for (const sheet of workbook.sheetAudits) {
    const key = `${sheet.sheetName}|${sheet.structureSignature}`;
    if (!sheetProfileMap.has(key)) {
      sheetProfileMap.set(key, {
        sheetName: sheet.sheetName,
        role: sheet.role,
        structureSignature: sheet.structureSignature,
        fields: sheet.fields,
        headerRows: sheet.headerRows,
        recordCountMethod: sheet.recordMethod,
        dates: [],
        recordCounts: [],
        usedRowCounts: [],
      });
    }
    const entry = sheetProfileMap.get(key);
    entry.dates.push(workbook.date);
    entry.recordCounts.push(sheet.dataRecordCount);
    entry.usedRowCounts.push(sheet.usedRows);
  }
}

const productCodeAliasVariationCount = products.filter(
  (product) => product.aliases.size > 1,
).length;
const productNameMultiCodeCount = [...productNameToCodes.values()].filter(
  (codes) => codes.size > 1,
).length;
const workbookTransitions = workbookAudits.slice(1).filter(
  (workbook, index) =>
    workbook.workbookStructureSignature !==
    workbookAudits[index].workbookStructureSignature,
).length;

const allSheetNames = [
  ...new Set(workbookAudits.flatMap((workbook) => workbook.sheetAudits.map((sheet) => sheet.sheetName))),
].sort();
const missingSheetAudit = workbookAudits
  .map((workbook) => {
    const present = new Set(workbook.sheetAudits.map((sheet) => sheet.sheetName));
    return {
      snapshotDate: workbook.date,
      missingSheets: allSheetNames.filter((sheetName) => !present.has(sheetName)),
    };
  })
  .filter((entry) => entry.missingSheets.length > 0);

const intervalAudit = workbookAudits.slice(1).map((workbook, index) => {
  const previous = workbookAudits[index];
  const days = Math.round(
    (Date.parse(`${workbook.date}T00:00:00Z`) -
      Date.parse(`${previous.date}T00:00:00Z`)) /
      86_400_000,
  );
  return {
    previousSnapshotDate: previous.date,
    snapshotDate: workbook.date,
    intervalDays: days,
    isSevenDayInterval: days === 7,
  };
});
const intervalDistribution = Object.fromEntries(
  [...new Set(intervalAudit.map((entry) => entry.intervalDays))]
    .sort((left, right) => left - right)
    .map((days) => [
      String(days),
      intervalAudit.filter((entry) => entry.intervalDays === days).length,
    ]),
);

const fieldQuality = [...fieldQualityMap.values()]
  .map((entry) => ({
    sheetName: entry.sheetName,
    sheetRole: entry.sheetRole,
    columnIndex1Based: entry.columnIndex1Based,
    field: entry.field,
    temporalSemantics: entry.temporalSemantics,
    directAdjacentSnapshotDifferenceAllowedAsTransactionOrCashFlow: false,
    snapshotCount: entry.snapshotDates.size,
    totalDataRows: entry.totalDataRows,
    nonEmptyCount: entry.nonEmptyCount,
    nonEmptyRatePct: percentage(entry.nonEmptyCount, entry.totalDataRows),
    numericCount: entry.numericCount,
    numericRateOfAllRowsPct: percentage(entry.numericCount, entry.totalDataRows),
    numericRateOfNonEmptyPct: percentage(entry.numericCount, entry.nonEmptyCount),
    formulaCellCount: entry.formulaCellCount,
    formulaErrorValueCount: entry.formulaErrorValueCount,
    formulaErrorInFormulaCellCount: entry.formulaErrorInFormulaCellCount,
    artifactImportErrorValueCount: entry.artifactImportErrorValueCount,
    artifactImportErrorInFormulaCellCount:
      entry.artifactImportErrorInFormulaCellCount,
    formulaAccessUnavailableSnapshotCount:
      entry.formulaAccessUnavailableSnapshotCount,
  }))
  .sort(
    (left, right) =>
      left.sheetRole.localeCompare(right.sheetRole) ||
      left.columnIndex1Based - right.columnIndex1Based,
  );

const fieldQualitySummary = {
  artifact: "S005 field quality and snapshot cadence audit",
  namespace: NAMESPACE,
  generatedAt: new Date().toISOString(),
  sourceSnapshotCount: workbookAudits.length,
  formulaAudit: {
    publicApiSurface: "Range.formulas aligned with imported Range.values",
    formulaAccessFailureCount,
    cachedValueAccessFailureCount,
    formulaErrorDefinition:
      "formulaErrorValueCount uses source cached values read by bundled openpyxl data_only=True; artifactImportErrorValueCount separately reports artifact-tool imported/calculated error tokens. Each formula-cell variant additionally requires a formula in the same aligned cell.",
    caveat:
      "The two error surfaces must not be conflated. Source cached-value errors are source-quality evidence; artifact import errors may reflect unsupported formula calculation. No source formula was recalculated or repaired.",
  },
  fieldQuality,
  duplicateCandidateKeysBySnapshot: {
    definitions: {
      productSecurityCode:
        "normalized security code in product_position_snapshot (strong candidate)",
      fixedIncomeBondName:
        "normalized bond name in fixed_income_holding_risk_snapshot (name-only candidate)",
      fixedIncomeIssuerName:
        "normalized issuer name in fixed_income_holding_risk_snapshot (name-only candidate)",
      bondTradeBondName:
        "normalized bond name in bond_trade_risk_snapshot (name-only candidate)",
    },
    managerKey:
      "Not audited because no explicit manager identifier or manager-name field is present.",
    interpretation: [
      "No within-snapshot duplicate was found for the product security-code candidate, supporting its use as a replay row key subject to security-master confirmation.",
      "No within-snapshot duplicate was found for the bond-name candidates, but names remain weaker than authoritative bond codes and still require a security master.",
      "Issuer names repeat across holdings in every available fixed-income snapshot because one issuer can map to multiple bonds. Issuer name is an entity-link candidate, not a unique holding-row key.",
    ],
    snapshots: duplicateKeyAudit,
  },
  cadence: {
    firstSnapshotDate: workbookAudits[0].date,
    lastSnapshotDate: workbookAudits.at(-1).date,
    transitionCount: intervalAudit.length,
    sevenDayIntervalCount: intervalAudit.filter((entry) => entry.isSevenDayInterval).length,
    nonSevenDayIntervalCount: intervalAudit.filter((entry) => !entry.isSevenDayInterval).length,
    intervalDaysDistribution: intervalDistribution,
    nonSevenDayIntervals: intervalAudit.filter((entry) => !entry.isSevenDayInterval),
    interpretation:
      "The source is a dated weekly/periodic snapshot series with irregular and month-end intervals; it is not a continuous daily series.",
  },
  missingSheets: {
    affectedSnapshots: missingSheetAudit,
    explicit20251020Finding: {
      snapshotDate: "2025-10-20",
      missingSheets: missingSheetAudit.find(
        (entry) => entry.snapshotDate === "2025-10-20",
      )?.missingSheets || [],
      interpretation:
        "Two expected sheet roles are absent from the source workbook on this date and reappear in the next snapshot. Do not impute their records from adjacent snapshots.",
    },
  },
  temporalSemanticsBoundary: {
    safeDirectDifferenceFields: [],
    prohibition:
      "No audited field is approved for interpreting an adjacent-snapshot difference directly as a trade or cash flow.",
    reasons: [
      "Point-in-time balances and valuations can change because of transactions, market prices, valuation methods, classifications, corrections, or multiple simultaneous causes.",
      "Year-to-date and cumulative fields can reset, be corrected, change definition, or combine realized and valuation effects; a weekly delta is not a transaction ledger.",
      "Irregular snapshot intervals and the 2025-10-20 missing-sheet event break any assumption of complete consecutive-period observation.",
      "Cash-flow and transaction conclusions require dated transaction, subscription/redemption, coupon/interest, fee, and settlement records with stable event identifiers.",
    ],
    semanticLabels: {
      yearToDate:
        "year_to_date_cumulative and year_to_date_cumulative_realized_result",
      cumulative:
        "cumulative_received_interest and cumulative_performance_measure",
      pointInTime:
        "labels beginning point_in_time_ plus current descriptive/classification assignments",
      ambiguous:
        "ambiguous_balance_or_cost_basis, derived_or_unlabeled_source_value, and unknown_requires_owner_definition",
    },
  },
  privacy: {
    identityValuesEmitted: false,
    duplicateAuditEmitsCountsOnly: true,
  },
};

const schemaSummary = {
  artifact: "S005 snapshot schema and identity audit",
  namespace: NAMESPACE,
  generatedAt: new Date().toISOString(),
  source: {
    directory: options.sourceDir,
    filePattern: "*（YYYYMMDD）.xlsx",
    accessMode: "read_only",
    sourceFilesModified: false,
    sourceFilesCopied: false,
  },
  parser: {
    primary:
      "@oai/artifact-tool SpreadsheetFile.importXlsx for workbook structure and formula surfaces",
    version: artifactToolVersion,
    importedSnapshotCount: workbookAudits.length,
    failedImportCount: 0,
    fallback:
      "bundled Python openpyxl read_only=True, data_only=True for cached cell values only",
    fallbackReason:
      "Used after full-batch audit showed that artifact-tool evaluates many supported source formula cells to error tokens even when the XLSX contains usable cached values. The fallback prevents parser-calculation limitations from being misclassified as missing business identities or source formula errors.",
    cachedValueAccessFailureCount,
  },
  coverage: {
    expectedSnapshotCount: EXPECTED_SNAPSHOT_COUNT,
    actualSnapshotCount: workbookAudits.length,
    countMatchesExpectation: workbookAudits.length === EXPECTED_SNAPSHOT_COUNT,
    firstSnapshotDate: workbookAudits[0].date,
    lastSnapshotDate: workbookAudits.at(-1).date,
    totalWorkbookBytes: workbookAudits.reduce(
      (sum, workbook) => sum + workbook.sizeBytes,
      0,
    ),
    totalSheetInstances: inventoryRows.length,
    distinctSheetNames: [...new Set(inventoryRows.map((row) => row.sheet_name))].length,
  },
  structure: {
    distinctWorkbookStructureCount: workbookVariantMap.size,
    workbookStructureTransitionCount: workbookTransitions,
    workbookVariants: [...workbookVariantMap.entries()].map(
      ([signature, dates]) => ({
        signature,
        snapshotCount: dates.length,
        firstDate: dates[0],
        lastDate: dates.at(-1),
      }),
    ),
    sheetSchemaVariants: [...sheetProfileMap.values()].map((entry) => ({
      sheetName: entry.sheetName,
      role: entry.role,
      structureSignature: entry.structureSignature,
      fields: entry.fields,
      headerRows: entry.headerRows,
      recordCountMethod: entry.recordCountMethod,
      snapshotCount: entry.dates.length,
      firstDate: entry.dates[0],
      lastDate: entry.dates.at(-1),
      minimumDataRecordCount: Math.min(...entry.recordCounts),
      maximumDataRecordCount: Math.max(...entry.recordCounts),
      minimumUsedRowCount: Math.min(...entry.usedRowCounts),
      maximumUsedRowCount: Math.max(...entry.usedRowCounts),
    })),
  },
  identityAssessment: {
    product: {
      sourceSheetRole: "product_position_snapshot",
      candidateKey: "normalized security code",
      quality: "STRONG_CANDIDATE_PENDING_SOURCE_OWNER_CONFIRMATION",
      rationale:
        "An explicit security code and name are present in each product-position row; code/name cardinality anomalies are reported only as counts.",
      ...summarizeCoverage(products, sourceEntries.length),
      codesWithMultipleNormalizedNamesCount: productCodeAliasVariationCount,
      normalizedNamesMappedToMultipleCodesCount: productNameMultiCodeCount,
    },
    manager: {
      candidateKey: null,
      quality: "UNAVAILABLE",
      rationale:
        "No explicit manager identifier or manager-name field exists in the audited sheets. Parsing a manager from a product name would be heuristic and is not accepted as a stable key.",
    },
    issuer: {
      sourceSheetRole: "fixed_income_holding_risk_snapshot",
      candidateKey: "normalized issuer name",
      quality: "MODERATE_NAME_ONLY_REQUIRES_MASTER_DATA",
      rationale:
        "An issuer-name field exists, but no issuer code or authoritative entity identifier is present.",
      ...summarizeCoverage(issuers, sourceEntries.length),
    },
    holding: {
      productHoldingCandidateKey: "normalized security code",
      productHoldingQuality: "STRONG_CANDIDATE_PENDING_SOURCE_OWNER_CONFIRMATION",
      bondHoldingCandidateKey: "normalized bond name",
      bondHoldingQuality: "MODERATE_NAME_ONLY_REQUIRES_SECURITY_MASTER",
      rationale:
        "Product positions expose a code; bond-risk sheets expose a bond name but no consistently populated bond code in the audited structure.",
      bondHoldingCoverage: summarizeCoverage(bondHoldings, sourceEntries.length),
    },
  },
  replayCandidateSelection: {
    count: candidates.length,
    targetRange: "10-20",
    selectedCountWithinTargetRange:
      candidates.length >= 10 && candidates.length <= 20,
    method:
      "Rank normalized security-code identities by snapshot coverage, then numeric-field completeness; emit only namespace-scoped anonymized IDs.",
    limitations: [
      "Selection establishes longitudinal traceability, not product suitability or evaluation quality.",
      "Weekly snapshots cannot be treated as daily NAV, market data, or complete cash-flow history.",
      "A security master is still required to confirm code semantics, share-class changes, mergers, and renames.",
    ],
  },
  privacy: {
    rawProductNamesEmitted: false,
    rawSecurityCodesEmittedInIdentityOutputs: false,
    rawManagerNamesEmitted: false,
    rawIssuerNamesEmitted: false,
    rawBondNamesEmitted: false,
    anonymization:
      "SHA-256(namespace|domain|normalized source key), truncated to 16 uppercase hex characters; intended only as a stable research pseudonym.",
  },
  limitations: [
    "Record counts use documented sheet-specific structural predicates and are not accounting reconciliations.",
    "Merged headers are represented from imported cell values; unlabeled imported columns receive positional labels.",
    "Formula error cells, if present in source workbooks, are treated as source values and are not recalculated or repaired.",
    "No raw source workbook was modified, copied, renamed, or exported.",
  ],
};

await fs.mkdir(options.outputDir, { recursive: true });
const inventoryPath = path.join(options.outputDir, "snapshot-inventory.csv");
const schemaPath = path.join(options.outputDir, "snapshot-schema-summary.json");
const candidatesPath = path.join(options.outputDir, "tracking-candidates.csv");
const fieldQualityPath = path.join(options.outputDir, "field-quality-summary.json");

const inventoryContent = toCsv(inventoryRows, [
  "snapshot_date",
  "file_name",
  "sha256",
  "size_bytes",
  "sheet_index",
  "sheet_name",
  "sheet_role",
  "header_rows_1_based",
  "field_names_json",
  "used_rows",
  "used_columns",
  "data_record_count",
  "record_count_method",
  "sheet_structure_signature",
  "workbook_structure_signature",
  "structure_change_vs_previous",
  "changed_sheets_vs_previous",
]);
const schemaContent = `${JSON.stringify(schemaSummary, null, 2)}\n`;
const candidatesContent = toCsv(candidates, [
  "replay_rank",
  "stable_product_id",
  "snapshot_count",
  "snapshot_coverage_pct",
  "first_seen_date",
  "last_seen_date",
  "name_variant_count",
  "numeric_field_coverage_pct",
  "stable_key_basis",
  "key_quality",
  "selection_reason",
]);
const fieldQualityContent = `${JSON.stringify(fieldQualitySummary, null, 2)}\n`;

const emittedEvidence = [
  inventoryContent,
  schemaContent,
  candidatesContent,
  fieldQualityContent,
].join("\n");
const rawIdentityValues = [
  ...products.flatMap((entry) =>
    [entry.key, ...entry.aliases].map((value) => ({ domain: "product", value })),
  ),
  ...issuers.flatMap((entry) =>
    [entry.key, ...entry.aliases].map((value) => ({ domain: "issuer", value })),
  ),
  ...bondHoldings.flatMap((entry) =>
    [entry.key, ...entry.aliases].map((value) => ({ domain: "bond", value })),
  ),
];
const leakedIdentities = rawIdentityValues.filter(
  ({ value }) => value.length >= 4 && emittedEvidence.includes(value),
);
const leakedIdentityCount = leakedIdentities.length;
if (leakedIdentityCount > 0) {
  throw new Error(
    `Privacy validation failed: ${JSON.stringify(
      leakedIdentities.map(({ domain, value }) => ({
        domain,
        length: value.length,
        fingerprint: sha256(value).slice(0, 12),
      })),
    )}`,
  );
}

await fs.writeFile(inventoryPath, inventoryContent, "utf8");
await fs.writeFile(schemaPath, schemaContent, "utf8");
await fs.writeFile(candidatesPath, candidatesContent, "utf8");
await fs.writeFile(fieldQualityPath, fieldQualityContent, "utf8");

console.log(
  JSON.stringify({
    status: "ok",
    snapshots: workbookAudits.length,
    sheets: inventoryRows.length,
    firstDate: workbookAudits[0].date,
    lastDate: workbookAudits.at(-1).date,
    workbookStructureVariants: workbookVariantMap.size,
    productIdentityCount: products.length,
    issuerIdentityCount: issuers.length,
    bondHoldingIdentityCount: bondHoldings.length,
    replayCandidates: candidates.length,
    formulaAccessFailures: formulaAccessFailureCount,
    cachedValueAccessFailures: cachedValueAccessFailureCount,
    privacyLeakCount: leakedIdentityCount,
    outputFiles: [
      path.relative(process.cwd(), inventoryPath),
      path.relative(process.cwd(), schemaPath),
      path.relative(process.cwd(), candidatesPath),
      path.relative(process.cwd(), fieldQualityPath),
    ],
  }),
);
