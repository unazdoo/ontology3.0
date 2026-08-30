let artifactTool;
try {
  artifactTool = await import("@oai/artifact-tool");
} catch {
  artifactTool = await import(
    "/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs"
  );
}

const { FileBlob, SpreadsheetFile } = artifactTool;

const sources = [
  "/Users/domi/Public/Vibecoding/ontology3.0/outputs/019fe24f-db30-7da0-9401-1a959656dd7e/融资一览表_一期演示数据.xlsx",
  "/Users/domi/Public/Vibecoding/ontology3.0/outputs/019fe492-60b5-70e3-a8d2-f5f1844b27da/企业债务风险评估模版_S003兼容版.xlsx",
];

function clip(value, limit = 80) {
  const text = value == null ? "" : String(value);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function normalized(value) {
  return value == null ? "" : String(value).trim();
}

function uniqueCount(rows, index) {
  return new Set(rows.map((row) => normalized(row[index])).filter(Boolean)).size;
}

function countBlank(rows, index) {
  return rows.reduce((count, row) => count + (normalized(row[index]) ? 0 : 1), 0);
}

function financingMetrics(values) {
  const headers = values[0].map((value) => normalized(value));
  const rows = values.slice(1).filter((row) => row.some((value) => normalized(value)));
  const col = (name) => headers.indexOf(name);
  const idIndex = col("借据编号");
  const ids = rows.map((row) => normalized(row[idIndex])).filter(Boolean);
  const duplicatedIds = ids.length - new Set(ids).size;
  const blankFields = headers
    .map((name, index) => ({ name, blankCount: countBlank(rows, index) }))
    .filter((item) => item.blankCount > 0)
    .sort((a, b) => b.blankCount - a.blankCount);
  const drawDateIndex = col("提款日期");
  const dueDateIndex = col("提款到期日期");
  const invalidDateOrder = rows.filter((row) => {
    const start = Date.parse(normalized(row[drawDateIndex]));
    const end = Date.parse(normalized(row[dueDateIndex]));
    return Number.isFinite(start) && Number.isFinite(end) && start > end;
  }).length;

  return {
    recordCount: rows.length,
    fieldCount: headers.length,
    headers,
    uniqueBorrowers: uniqueCount(rows, col("借款人")),
    uniqueInstitutions: uniqueCount(rows, col("融资机构")),
    institutionCategories: uniqueCount(rows, col("融资机构类别")),
    businessSegments: uniqueCount(rows, col("所属板块")),
    currencies: uniqueCount(rows, col("借据币种")),
    uniqueLoanIds: new Set(ids).size,
    duplicatedLoanIds: duplicatedIds,
    blankLoanIds: countBlank(rows, idIndex),
    invalidDateOrder,
    blankFields,
  };
}

for (const source of sources) {
  const input = await FileBlob.load(source);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const result = { source, sheets: [] };

  for (let index = 0; index < workbook.worksheets.items.length; index += 1) {
    const sheet = workbook.worksheets.getItemAt(index);
    const used = sheet.getUsedRange(true);
    if (!used) {
      result.sheets.push({ name: sheet.name, empty: true });
      continue;
    }
    const values = used.values ?? [];
    const record = {
      name: sheet.name,
      rowCount: values.length,
      columnCount: Math.max(0, ...values.map((row) => row.length)),
      sample: values.slice(0, 8).map((row) => row.slice(0, 20).map((value) => clip(value))),
    };
    if (sheet.name === "2-融资一览表明细") {
      record.metrics = financingMetrics(values);
    }
    if (sheet.name === "Sheet1" || sheet.name === "场景问数样例") {
      record.detail = values.map((row) => row.map((value) => clip(value, 160)));
    }
    result.sheets.push(record);
  }

  console.log(JSON.stringify(result, null, 2));
}
