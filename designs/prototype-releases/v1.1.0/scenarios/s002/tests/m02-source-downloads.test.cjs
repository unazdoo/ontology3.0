"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");
const entryRef = "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html";
const adapterRef = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js";
const sharedAppRef = "baseline-adapters/data-engineering-prototype-review/review-v3/shared/app.js";
const coreRef = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-core-data.js";
const manifestRef = "data/source-manifest.json";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("M02八份已上传来源均提供逐字节原始副本，文件身份与source-manifest一致", function () {
  const manifest = JSON.parse(read(manifestRef));
  assert.equal(manifest.sources.length, 8);
  assert.equal(manifest.downloadPolicy.copyKind, "ORIGINAL_SOURCE_COPY");
  assert.equal(manifest.downloadPolicy.contentChanged, false);
  assert.equal(manifest.downloadPolicy.verifiedAt, "2026-08-15");
  assert.equal(manifest.downloadPolicy.downloadMutatesOwnerState, false);

  for (const source of manifest.sources) {
    assert.ok(source.download, `${source.sourceId} 未登记下载副本`);
    assert.equal(source.download.copyKind, "ORIGINAL_SOURCE_COPY");
    assert.equal(source.download.marker, "SOURCE");
    assert.equal(source.download.sha256Verified, true);
    assert.equal(path.basename(source.download.relativePath), source.file);
    assert.ok(Number.isInteger(source.rows) && source.rows > 0, `${source.sourceId} 行数无效`);
    assert.ok(source.asOf, `${source.sourceId} 缺少业务时点`);
    assert.ok(source.logicalMembers.length > 0, `${source.sourceId} 缺少逻辑成员`);

    const copy = path.join(scenarioRoot, "data", source.download.relativePath);
    assert.ok(fs.existsSync(copy), `${source.sourceId} 下载文件不存在`);
    assert.equal(fs.statSync(copy).size, source.download.sizeBytes, `${source.sourceId} 文件字节数不一致`);
    assert.equal(sha256(copy), source.sha256, `${source.sourceId} SHA-256不一致`);
    assert.equal(fs.readFileSync(copy).subarray(0, 2).toString("ascii"), "PK", `${source.sourceId} 不是有效XLSX ZIP容器`);
  }
});

test("M02数据源详情沿用基线页面展示文件身份并提供真实同源下载", function () {
  const adapter = read(adapterRef);
  const manifest = JSON.parse(read(manifestRef));

  for (const source of manifest.sources) {
    for (const token of [source.sourceId, source.file, source.sha256]) {
      assert.ok(adapter.includes(token), `M02来源目录缺少 ${token}`);
    }
  }
  for (const token of [
    "projectSourceFileCatalog()",
    "projectSourceDownloadSummary()",
    "data-s002-source-file",
    "data-s002-source-download",
    "../../../data/source-files/",
    "ORIGINAL_SOURCE_COPY",
    "下载来源工作簿",
    "下载不会登记快照、重跑管道或改变质量、资产及消费状态"
  ]) assert.ok(adapter.includes(token), `M02下载查看交互缺少：${token}`);

  const downloadSection = adapter.slice(adapter.indexOf("function sourceFileHref"), adapter.indexOf("function applyScenarioProjection"));
  assert.equal(/localStorage\.setItem|sessionStorage\.setItem|postMessage\(|registerSnapshotFile|publishAsset|startFormalRun/.test(downloadSection), false, "查看下载不得改变Owner State或触发运行/发布");
});

test("M02五个原生数据源详情沿用基线页签并在快照页提供只读下载", function () {
  const adapter = read(adapterRef);
  const sharedApp = read(sharedAppRef);
  const core = read(coreRef);
  for (const id of ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"]) {
    assert.ok(core.includes(`source("${id}"`), `真源缺少 ${id}`);
  }
  for (const token of [
    'const tabs = [["overview","概览"],["content","内容与字段"],["snapshots","快照历史"],["references","引用关系"],["settings","设置"]]',
    "function sourceSnapshotDownloadHref(snapshot)",
    'data-s002-source-file="${esc(x.snapshotId)}"',
    'data-s002-source-download="${esc(x.snapshotId)}"',
    "下载来源工作簿",
    "下载只读副本不会登记新快照、重跑管道或改变资产及消费状态"
  ]) assert.ok(sharedApp.includes(token), `原生来源详情缺少：${token}`);
  const applyStart = adapter.indexOf("function applyScenarioProjection()");
  const applyEnd = adapter.indexOf("function schedule()", applyStart);
  const runtimeProjection = adapter.slice(applyStart, applyEnd);
  assert.equal(runtimeProjection.includes("projectCompletedSourceDetail"), false);
  assert.equal(runtimeProjection.includes("projectCompletedSourceModal"), false);
});

test("M02入口的公共normalize引用可解析且下载链接目标位于S002隔离目录", function () {
  const entry = read(entryRef);
  const entryPath = path.join(scenarioRoot, entryRef);
  const normalizeHref = entry.match(/href="([^"]*s002-frame-normalize\.css[^"]*)"/)?.[1];
  assert.ok(normalizeHref, "方案B2缺少s002-frame-normalize.css契约");
  assert.ok(fs.existsSync(path.resolve(path.dirname(entryPath), normalizeHref.split("?")[0])), "方案B2的normalize引用无法解析");
  assert.match(entry, /s002-adapter\.js\?v=20260817-\d+/, "方案B2未加载带缓存版本的M02场景适配器");

  const manifest = JSON.parse(read(manifestRef));
  for (const source of manifest.sources) {
    const target = path.resolve(path.dirname(entryPath), "../../../data/source-files", source.file);
    assert.ok(target.startsWith(path.join(scenarioRoot, "data", "source-files") + path.sep), "下载目标越出S002隔离目录");
    assert.ok(fs.existsSync(target), `${source.file} 的页面相对下载目标不存在`);
  }
});
