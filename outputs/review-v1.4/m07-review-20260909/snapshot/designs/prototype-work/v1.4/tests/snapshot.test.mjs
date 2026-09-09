import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { snapshotData, validateSnapshot } from "../src/snapshot-data.js";
const root = new URL("../", import.meta.url),
  read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const data = read("public/data/portfolio.json"),
  catalog = read("public/data/snapshots/catalog.json");
test("all nine asset snapshots exactly match the currently consumed simulation data", () => {
  const expected = snapshotData(data);
  assert.equal(catalog.dataDigest, data.digest);
  assert.equal(catalog.assets.length, 9);
  assert.equal(catalog.validation.rowCount, 300);
  assert.equal(validateSnapshot(catalog).status, "PASSED");
  for (const asset of catalog.assets) {
    assert.deepEqual(
      asset.rows,
      expected.assets.find((other) => other.id === asset.id).rows,
    );
    assert.equal(asset.rowCount, asset.rows.length);
    assert.equal(
      asset.contentDigest,
      createHash("sha256").update(JSON.stringify(asset.rows)).digest("hex"),
    );
    assert.equal(asset.classification, "SIMULATED_SNAPSHOT");
  }
});
test("missing fields, duplicate primary keys and dangling references reject the snapshot", () => {
  for (const mutate of [
    (c) => delete c.assets[0].rows[0].cash,
    (c) => c.assets[0].rows.push(c.assets[0].rows[0]),
    (c) => (c.assets[2].rows[0].bankId = "UNKNOWN"),
  ]) {
    const value = structuredClone(catalog);
    mutate(value);
    assert.equal(validateSnapshot(value).status, "FAILED");
  }
});
test("Excel is a real complete workbook with the exact registered SHA-256 and byte length", () => {
  const bytes = readFileSync(new URL("public" + catalog.file.url, root));
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  assert.equal(bytes.length, catalog.file.sizeBytes);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    catalog.file.sha256,
  );
  assert.equal(catalog.file.sheetCount, 11);
});
test("every exported Excel cell retains its value, date/percentage type, frozen headers and full record coverage", () => {
  const python =
    process.env.CODEX_PYTHON ||
    "/Users/domi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
  const script = `import sys,json,pathlib,openpyxl,datetime,math
root=pathlib.Path(sys.argv[1]);c=json.loads((root/'public/data/snapshots/catalog.json').read_text());w=openpyxl.load_workbook(root/'public'/c['file']['url'].lstrip('/'),data_only=True)
assert len(w.sheetnames)==11
for a in c['assets']:
 s=w[a['sheetName']];assert s.max_row==a['rowCount']+1;assert s.max_column==len(a['fields']);assert s.freeze_panes=='B2'
 for i,row in enumerate(a['rows'],2):
  for j,f in enumerate(a['fields'],1):
   cell=s.cell(i,j);expected=row[f['key']];actual=cell.value
   if f['type']=='date': assert isinstance(actual,datetime.datetime) and actual.date().isoformat()==expected
   elif f['type'] in ('number','percent'): assert isinstance(actual,(int,float)) and math.isclose(actual,expected/(100 if f['type']=='percent' else 1),abs_tol=1e-10,rel_tol=1e-10)
   else: assert actual==expected,(a['key'],i,j,actual,expected)
 assert s['A1'].font.color.rgb=='FFFFFFFF'
print('All 300 exported records and typed fields verified')`;
  const result = spawnSync(python, ["-c", script, fileURLToPath(root)], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /300 exported records/);
});
