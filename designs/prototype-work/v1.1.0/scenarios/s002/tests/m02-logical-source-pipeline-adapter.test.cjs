"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scenarioRoot = path.resolve(__dirname, "..");
const adapterRef = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js";
const entryRef = "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html";
const dataRef = "data.js";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

test("M02目录按五个逻辑数据源组织，并将八个快照映射到详情页", function () {
  const adapter = read(adapterRef);
  const data = read(dataRef);
  const expectedLogicalSources = [
    "DS-ACTUAL-EXECUTION",
    "DS-APPROVED-BUDGET",
    "DS-INITIAL-SUBMISSION",
    "DS-PROJECT-COMMITMENT",
    "DS-PROJECT-USE"
  ];
  for (const id of expectedLogicalSources) assert.ok(adapter.includes(`id: "${id}"`), `适配层缺少逻辑源 ${id}`);
  assert.ok(data.includes("logicalSources: 5"), "场景质量摘要未登记五个逻辑数据源");
  assert.ok(data.includes("snapshotCount: 8"), "场景质量摘要未登记八个快照");
  assert.ok(adapter.includes("function projectS002LogicalSourceDirectory"));
  assert.ok(adapter.includes("function sourceDirectoryCard"));
  assert.ok(adapter.includes("function sourceDirectoryCardGroup"));
  assert.ok(adapter.includes("function projectS002LogicalSourceDetail"));
  assert.ok(adapter.includes("data-s002-logical-source-id"));
  assert.ok(adapter.includes("data-s002-logical-source-group"));
  assert.ok(adapter.includes('const view = tbody ? "list" : "cards"'));
  assert.ok(adapter.includes('sourceDirectoryCardGroup("预算编制与执行"'));
  assert.ok(adapter.includes('sourceDirectoryCardGroup("项目与采购"'));
  assert.ok(adapter.includes("5 个已接入逻辑数据源 · 8 个不可变快照 · 14 个逻辑成员"));
  assert.ok(adapter.includes("s002LogicalSource"));
  assert.ok(adapter.includes("function logicalSourceCatalogPanel"));
  assert.equal(adapter.includes("8 个来源快照均可查看和下载"), false, "目录不得重复展示第二份快照汇总清单");
  assert.ok(adapter.includes("下载来源工作簿"), "各逻辑源详情仍需提供快照下载");
});

test("M02每个逻辑源详情展示精确快照数量、文件下载和只读边界", function () {
  const adapter = read(adapterRef);
  for (const token of [
    "${files.length} 个快照 · ${files.length} 份文件",
    "ORIGINAL_SOURCE_COPY",
    "下载来源工作簿",
    "下载不会登记快照、重跑管道或改变质量、资产及消费状态",
    "tab === \"content\"",
    "tab === \"snapshots\"",
    "快照内容与逻辑成员",
    "历史快照只读保留；恢复、回归或重置创建新的scenarioRunId"
  ]) assert.ok(adapter.includes(token), `M02详情缺少：${token}`);
  assert.equal(/sourceFileHref\([^)]*\).*localStorage\.setItem/s.test(adapter), false, "下载逻辑不得写Owner状态");
});

test("M02资源区投影两个独立数据资产，并保留组合交付指针说明", function () {
  const adapter = read(adapterRef);
  for (const token of [
    "S002-BUDGET-EXECUTION-ASSET",
    "S002-PROJECT-OCCUPANCY-ASSET",
    "S002-BUDGET-EXEC-v1",
    "S002-PROJECT-OCC-v1",
    "预算编制与执行数据资产",
    "项目预算占用与余额数据资产",
    "memberCount: 4",
    "memberCount: 3",
    "relationshipCount: 4",
    "relationshipCount: 3",
    "internalRelationshipCount: 2",
    "crossAssetRelationshipCount: 1",
    "2 个独立数据资产已发布",
    "S002-DATA-v1 仅作为 C003 兼容交付组合指针",
    "不作为第三个业务数据资产",
    "function assetTableRowHtml",
    'assetColumn.querySelector(".asset-resource-table tbody")',
    'tableBody.dataset.s002AssetTable = "two-component-assets"',
    'grid.dataset.s002AssetGrid = "two-component-assets"',
    '<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z">',
    "场景消费就绪",
    "场景已发布 · 待联合证据核对"
  ]) assert.ok(adapter.includes(token), `M02资产投影缺少：${token}`);
  assert.ok(adapter.includes("function projectS002AssetShelf"));
  assert.equal(adapter.includes("S002 预算监督数据资产"), false, "M02不得再投影单一组合业务资产卡");
  assert.equal(adapter.includes("最新版本不可消费"), false, "M02场景投影不得保留基线单资产不可消费文案");
  assert.equal((adapter.match(/data-s002-component-asset/g) || []).length >= 2, true, "卡片和列表均需保留双资产稳定锚点");
});

test("M02管道目录和画布按两条独立管道投影来源节点", function () {
  const adapter = read(adapterRef);
  const entry = read(entryRef);
  for (const token of [
    "S002-PIPE-BUDGET-v1",
    "S002-PIPE-PROJECT-v1",
    "sourceNodeCount: 3",
    "sourceNodeCount: 4",
    "totalNodeCount: 7",
    "totalNodeCount: 8",
    "function projectS002PipelineDirectory",
    "function projectS002PipelineCanvas",
    "s002Pipeline",
    "page.dataset.s002PipelineId",
    "page.dataset.s002SourceNodeCount",
    "S002-BUDGET-EXEC-v1",
    "S002-PROJECT-OCC-v1",
    "spec.sourceIds.map(logicalSourceFor)"
  ]) assert.ok(adapter.includes(token), `M02管道投影缺少：${token}`);
  assert.ok(entry.includes('data-logical-source-node="true"'), "M02基线适配画布缺少逻辑数据源节点锚点");
  assert.ok(entry.includes("data-source-snapshot-count="), "M02基线适配画布缺少节点内快照数量锚点");
  assert.ok(adapter.includes("visibleIds.has(sourceId)"), "画布未按当前管道隐藏无关来源节点");
  assert.ok(adapter.includes("projectS002RunHistory"), "正式运行历史未按两条管道投影");
  assert.equal(adapter.includes('#/pipelines/finance-pipeline/canvas?s002Pipeline='), false, "S002正式入口不得借用finance-pipeline路径");
  assert.ok(adapter.includes('`#/pipelines/${encodeURIComponent(pipelineId)}/canvas?s002Pipeline=${encodeURIComponent(pipelineId)}`'));
  assert.ok(adapter.includes("S002-PIPE-PROJECT-v1 · 4 个逻辑源 / 6 个快照"));
  assert.match(entry, /s002-adapter\.js\?v=20260817-\d+/, "M02入口未加载带缓存版本的场景适配器");
});

test("M02场景适配不写入v1.0.3基线目录或其他模块入口", function () {
  const adapter = read(adapterRef);
  assert.equal(adapter.includes("/prototype-releases/v1.0.3/"), false);
  assert.equal(/M03|M04|M05|M06/.test(adapter), false, "M02适配层不得注入其他模块状态");
});
