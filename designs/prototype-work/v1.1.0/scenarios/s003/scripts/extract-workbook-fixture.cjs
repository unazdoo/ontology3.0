#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function unzipText(workbookPath, member) {
  try {
    return childProcess.execFileSync("unzip", ["-p", workbookPath, member], {encoding: "utf8"});
  } catch (error) {
    fail(`无法读取 ${member}: ${error.message}`);
  }
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function stripTags(value) {
  return decodeXml(String(value || "").replace(/<[^>]+>/g, ""));
}

function parseSharedStrings(xml) {
  const result = [];
  const siPattern = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siPattern.exec(xml))) {
    const textParts = [];
    const textPattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
    let textMatch;
    while ((textMatch = textPattern.exec(match[1]))) textParts.push(decodeXml(textMatch[1]));
    result.push(textParts.join(""));
  }
  return result;
}

function columnIndex(cellRef) {
  const letters = String(cellRef).match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) return -1;
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseCellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\st="([^"]+)"/)?.[1] || "n";
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (type === "inlineStr") return stripTags(cellXml.match(/<is>([\s\S]*?)<\/is>/)?.[1] || "");
  if (value === undefined) return null;
  if (type === "s") return sharedStrings[Number(value)] ?? null;
  if (type === "b") return value === "1";
  if (type === "str") return decodeXml(value);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : decodeXml(value);
}

function parseSheet(xml, sharedStrings) {
  const rows = [];
  const rowPattern = /<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g;
  let rowMatch;
  while ((rowMatch = rowPattern.exec(xml))) {
    const row = [];
    // OOXML represents blank styled cells as self-closing tags (`<c .../>`).
    // The previous expression started at such a cell and consumed the next
    // closing `</c>`, shifting every following value one column to the left.
    // Parse normal and self-closing cells as two explicit alternatives so a
    // business blank remains attached to its physical column.
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowMatch[1]))) {
      const attributes = cellMatch[1];
      const cellRef = attributes.match(/\br="([A-Z]+\d+)"/i)?.[1];
      if (!cellRef) continue;
      row[columnIndex(cellRef)] = parseCellValue(cellMatch[0], sharedStrings);
    }
    rows.push(Array.from({length: row.length}, (_, index) => row[index] ?? null));
  }
  return rows;
}

function recordsFromRows(rows) {
  const headers = rows[0].map((value) => String(value || "").trim());
  return rows.slice(1).map((row, rowIndex) => ({
    sourceRow: rowIndex + 2,
    values: Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]))
  }));
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function main() {
  const workbookPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!workbookPath || !outputPath) {
    fail("用法: node scripts/extract-workbook-fixture.cjs <input.xlsx> <output.json>");
  }
  if (!fs.existsSync(workbookPath)) fail(`工作簿不存在: ${workbookPath}`);

  const sharedStrings = parseSharedStrings(unzipText(workbookPath, "xl/sharedStrings.xml"));
  const financeRows = parseSheet(unzipText(workbookPath, "xl/worksheets/sheet1.xml"), sharedStrings);
  const factorRows = parseSheet(unzipText(workbookPath, "xl/worksheets/sheet2.xml"), sharedStrings);
  const financeRecords = recordsFromRows(financeRows);
  const factorRecords = recordsFromRows(factorRows);
  const factorByName = new Map(factorRecords.map((record) => [record.values["单位名称"], record]));

  const enterprises = financeRecords.map((record, index) => {
    const name = record.values["单位名称"];
    const factorRecord = factorByName.get(name);
    if (!factorRecord) fail(`调节因子缺少单位: ${name}`);
    return {
      enterpriseId: `S003-ENT-${String(index + 1).padStart(3, "0")}`,
      sourceRows: {finance: record.sourceRow, factors: factorRecord.sourceRow},
      name,
      sector: factorRecord.values["产业板块"],
      category: factorRecord.values["公司类别"],
      financialData: record.values,
      factorInputs: Object.fromEntries(
        Object.entries(factorRecord.values).filter(([key]) => !["单位名称", "产业板块", "公司类别"].includes(key))
      )
    };
  });

  if (enterprises.length !== 21) fail(`预期21家企业，实际 ${enterprises.length}`);
  if (factorRecords.length !== 21) fail(`调节因子预期21行，实际 ${factorRecords.length}`);

  const categoryCounts = enterprises.reduce((counts, enterprise) => {
    counts[enterprise.category] = (counts[enterprise.category] || 0) + 1;
    return counts;
  }, {});
  const expectedCategoryCounts = {
    "新能源产业-风电": 13,
    "在建企业": 3,
    "环保": 4,
    "核电": 1
  };
  Object.entries(expectedCategoryCounts).forEach(([category, count]) => {
    if (categoryCounts[category] !== count) {
      fail(`${category} 预期 ${count} 家，实际 ${categoryCounts[category] || 0} 家`);
    }
  });

  enterprises
    .filter((enterprise) => enterprise.category === "环保")
    .forEach((enterprise) => {
      if (enterprise.factorInputs["电价波动率"] !== null) {
        fail(`${enterprise.name} 的环保电价因子必须为空并解释为 NOT_APPLICABLE`);
      }
      if (!enterprise.factorInputs["是否存在重大诉讼"]) {
        fail(`${enterprise.name} 的诉讼因子不得因空电价单元格发生列错位`);
      }
    });

  const fixture = {
    schemaVersion: "ofw.s003.fixture.v1",
    fixtureId: "S003-FIXTURE-20251231-v1",
    fixtureRole: "formal-build-test-fixture-not-consumable-asset",
    source: {
      fileName: path.basename(workbookPath),
      sha256: sha256File(workbookPath),
      logicalMembers: ["财务数据", "调节因子"],
      financeRange: "A1:AA22",
      factorRange: "A1:I22"
    },
    assessmentAt: "2025-12-31",
    currency: "CNY",
    amountUnit: "元",
    currentPeriodColumn: "I",
    priorPeriodColumn: "AA",
    enterpriseCount: enterprises.length,
    stableIdPolicy: "workbook-row-order-fixture-id; production-must-use-master-enterprise-id",
    businessRules: {
      environmentalElectricityPriceBlank: "NOT_APPLICABLE",
      applicableFactorBlank: "DEFAULTED_ZERO",
      invalidValue: "BLOCK"
    },
    enterprises
  };

  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  process.stdout.write(`${outputPath} ${fixture.enterpriseCount} ${fixture.source.sha256}\n`);
}

main();
