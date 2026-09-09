import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  symlink,
  access,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { snapshotData, validateSnapshot } from "../src/snapshot-data.js";
const root = new URL("../", import.meta.url),
  runtime = new URL(".runtime/snapshot-builder/", root);
const dependencies =
  process.env.CODEX_NODE_MODULES ||
  "/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
await mkdir(runtime, { recursive: true });
try {
  await access(new URL("node_modules", runtime));
} catch {
  await symlink(dependencies, new URL("node_modules", runtime), "dir");
}
const require = createRequire(new URL("package.json", runtime));
const { Workbook, SpreadsheetFile } = await import(
  pathToFileURL(require.resolve("@oai/artifact-tool")).href
);
const data = JSON.parse(
  await readFile(new URL("public/data/portfolio.json", root), "utf8"),
);
const catalog = snapshotData(data),
  validation = validateSnapshot(catalog);
if (validation.status !== "PASSED") throw new Error(JSON.stringify(validation));
const output = new URL(
  "../../../outputs/01a076ca-84cf-7610-bd49-13945dd62fc8/",
  root,
);
const publicDir = new URL("public/data/snapshots/", root);
await mkdir(output, { recursive: true });
await mkdir(publicDir, { recursive: true });
const workbook = Workbook.create(),
  manifest = workbook.worksheets.add("快照说明");
const sheets = new Map(
  catalog.assets.map((asset) => [
    asset.key,
    workbook.worksheets.add(asset.sheetName),
  ]),
);
const dictionary = workbook.worksheets.add("字段字典");
const column = (index) => {
  let name = "";
  for (let x = index + 1; x > 0; x = Math.floor((x - 1) / 26))
    name = String.fromCharCode(65 + ((x - 1) % 26)) + name;
  return name;
};
function styleTable(sheet, headers, rows, name, fields = []) {
  sheet.showGridLines = false;
  const end = `${column(headers.length - 1)}${rows.length + 1}`,
    range = sheet.getRange(`A1:${end}`);
  range.values = [headers, ...rows];
  range.format.font = { name: "Arial", size: 11, color: "#243449" };
  range.format.rowHeight = 24;
  range.format.verticalAlignment = "center";
  range.format.columnWidth = 22;
  const table = sheet.tables.add(`A1:${end}`, true, name);
  table.style = "TableStyleMedium2";
  table.showFilterButton = true;
  sheet.getRange(`A1:${column(headers.length - 1)}1`).format.rowHeight = 36;
  sheet.getRange(`A1:${column(headers.length - 1)}1`).format.wrapText = true;
  sheet.getRange(`A1:${column(headers.length - 1)}1`).format.fill = "#315FAE";
  sheet.getRange(`A1:${column(headers.length - 1)}1`).format.font = {
    name: "Arial",
    size: 11,
    color: "#FFFFFF",
    bold: true,
  };
  sheet.getRange(
    `A1:${column(headers.length - 1)}1`,
  ).format.horizontalAlignment = "center";
  fields.forEach((f, i) => {
    const range = sheet.getRange(
      `${column(i)}2:${column(i)}${rows.length + 1}`,
    );
    if (f.type === "number") {
      range.setNumberFormat(f.unit === "度" ? "0.000000" : "#,##0.000000");
      range.format.horizontalAlignment = "right";
    } else if (f.type === "percent") {
      range.setNumberFormat("0.000000%");
      range.format.horizontalAlignment = "right";
    } else if (f.type === "date") {
      range.setNumberFormat("yyyy-mm-dd");
    } else {
      range.setNumberFormat("@");
    }
    sheet.getRange(
      `${column(i)}1:${column(i)}${rows.length + 1}`,
    ).format.columnWidth =
      f.key === "basis" || f.key === "financeBasis" || f.key === "accuracy"
        ? 58
        : f.key === "aliases"
          ? 46
          : f.label.includes("名称") || f.key === "name"
            ? 30
            : 22;
  });
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(1);
}
for (const asset of catalog.assets) {
  const rows = asset.rows.map((row) =>
    asset.fields.map((f) =>
      f.type === "date"
        ? new Date(`${row[f.key]}T00:00:00Z`)
        : f.type === "percent"
          ? row[f.key] / 100
          : row[f.key],
    ),
  );
  styleTable(
    sheets.get(asset.key),
    asset.fields.map((f) => (f.unit ? `${f.label}（${f.unit}）` : f.label)),
    rows,
    `Snapshot_${asset.key}`,
    asset.fields,
  );
}
manifest.showGridLines = false;
manifest.tabColor = "#315FAE";
manifest.getRange("A1:F25").format.font = {
  name: "Arial",
  size: 11,
  color: "#243449",
};
manifest.getRange("A1:F25").format.columnWidth = 24;
manifest.getRange("A1:F25").format.rowHeight = 25;
manifest.getRange("A2").values = [["融资与债务风险模拟数据快照"]];
manifest.getRange("A2").format.font = { size: 16, bold: true };
const metadata = [
  ["数据属性", "完整模拟构造，仅用于原型验证"],
  ["快照ID", catalog.snapshotId],
  ["观察日", new Date(`${catalog.asOf}T00:00:00Z`)],
  ["数据版本", catalog.dataVersion],
  ["语义版本", catalog.ontologyVersion],
  ["内容指纹", catalog.dataDigest],
  ["来源说明", "原型企业身份与评分样本 + 确定性融资明细构造"],
  ["使用边界", "非真实借据、授信批准、工商地址或正式企业评级"],
];
manifest.getRange("A4:B11").values = metadata;
manifest.getRange("B6").setNumberFormat("yyyy-mm-dd");
manifest.getRange("B4:B11").format.columnWidth = 20;
manifest.getRange("B4:B11").format.wrapText = false;
manifest.getRange("B4:B11").format.horizontalAlignment = "left";
manifest.getRange("A9:B9").format.rowHeight = 44;
manifest.getRange("A13:D22").values = [
  ["数据资产", "记录数", "字段数", "完整性"],
  ...catalog.assets.map((asset) => [
    asset.name,
    asset.rowCount,
    asset.fields.length,
    "已校验",
  ]),
];
manifest.getRange("A13:D13").format.fill = "#EAF0F8";
manifest.getRange("A13:D13").format.font.bold = true;
manifest.getRange("A14:A22").format.columnWidth = 30;
manifest.getRange("B14:D22").format.horizontalAlignment = "right";
const dictionaryRows = catalog.assets.flatMap((asset) =>
  asset.fields.map((f) => [
    asset.name,
    f.key,
    f.label,
    f.type,
    f.unit || "无",
    f.reference || "无",
    "非空",
    asset.snapshotId,
  ]),
);
styleTable(
  dictionary,
  [
    "数据资产",
    "字段编码",
    "字段名称",
    "数据类型",
    "单位",
    "外键引用",
    "空值约束",
    "快照ID",
  ],
  dictionaryRows,
  "FieldDictionary",
);
dictionary.getRange(`H1:H${dictionaryRows.length + 1}`).format.columnWidth = 48;
workbook.recalculate();
for (const asset of catalog.assets) {
  const actual = sheets
    .get(asset.key)
    .getRange(`A2:A${asset.rowCount + 1}`)
    .values.flat();
  if (
    JSON.stringify(actual) !== JSON.stringify(asset.rows.map((row) => row.id))
  )
    throw new Error(`Workbook identity mismatch ${asset.key}`);
}
console.log(
  (
    await workbook.inspect({
      kind: "table",
      range: "融资合同台账!A1:L5",
      include: "values",
      tableMaxRows: 5,
      tableMaxCols: 12,
      maxChars: 2200,
    })
  ).ndjson,
);
console.log(
  (
    await workbook.inspect({
      kind: "match",
      searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!",
      options: { useRegex: true, maxResults: 20 },
      maxChars: 1000,
    })
  ).ndjson,
);
const previews = new URL("artifacts/snapshot-workbook/", root);
await mkdir(previews, { recursive: true });
for (const [name, range] of [
  ["快照说明", "A2:F22"],
  ...catalog.assets.map((asset) => [
    asset.sheetName,
    `A1:${column(Math.min(asset.fields.length, 6) - 1)}8`,
  ]),
  ["字段字典", "A1:H8"],
]) {
  const blob = await workbook.render({
    sheetName: name,
    range,
    scale: 1.4,
    format: "png",
  });
  await writeFile(
    new URL(`${name}.png`, previews),
    new Uint8Array(await blob.arrayBuffer()),
  );
}
const fileName = "融资与债务风险模拟数据快照-20251231.xlsx",
  file = new URL(fileName, output);
await (await SpreadsheetFile.exportXlsx(workbook)).save(fileURLToPath(file));
const bytes = await readFile(file),
  sha256 = createHash("sha256").update(bytes).digest("hex");
const publicName = `finance-risk-20251231-${sha256.slice(0, 12)}.xlsx`;
await copyFile(file, new URL(publicName, publicDir));
catalog.file = {
  name: fileName,
  url: `/data/snapshots/${publicName}`,
  sha256,
  sizeBytes: bytes.length,
  sheetCount: 11,
};
catalog.validation = validation;
catalog.builtAt = new Date().toISOString();
for (const asset of catalog.assets)
  asset.contentDigest = createHash("sha256")
    .update(JSON.stringify(asset.rows))
    .digest("hex");
await writeFile(
  new URL("catalog.json", publicDir),
  JSON.stringify(catalog, null, 2) + "\n",
);
await writeFile(
  new URL("catalog.js", publicDir),
  `window.OFW_V14_SNAPSHOT_CATALOG=${JSON.stringify(catalog).replaceAll("<", "\\u003c")};\n`,
);
await writeFile(
  new URL("validation.json", previews),
  JSON.stringify(
    {
      validation,
      file: catalog.file,
      dataDigest: data.digest,
      output: fileURLToPath(file),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    output: fileURLToPath(file),
    validation,
    file: catalog.file,
  }),
);
