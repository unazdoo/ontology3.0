"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const m02Root = path.join(scenarioRoot, "baseline-adapters/data-engineering-prototype-review/review-v3");
const read = (file) => fs.readFileSync(path.join(m02Root, file), "utf8");

function loadCore() {
  const sandbox = { window: {}, Intl, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(read("shared/fixtures.js"), sandbox);
  vm.runInContext(read("s002-core-data.js"), sandbox);
  return { data: sandbox.window.DE_DATA, core: sandbox.window.S002_CORE_DATA };
}

test("M02真源原生注入五个逻辑源、八个唯一快照、双管道和双资产", () => {
  const { data, core } = loadCore();
  assert.deepEqual(Array.from(data.sources, (item) => item.id), [
    "DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION",
    "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"
  ]);
  assert.equal(data.sources.reduce((sum, item) => sum + item.snapshots.length, 0), 8);
  assert.equal(new Set(data.sources.flatMap((item) => item.snapshots.map((snapshot) => snapshot.snapshotId))).size, 8);
  assert.deepEqual(Array.from(data.pipelines, (item) => item.id), ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]);
  assert.deepEqual(Array.from(data.targetAssets, (item) => item.currentVersion), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.equal(core.pipelineSpecs.find((item) => item.pipelineId === "S002-PIPE-PROJECT-v1").sourceIds.join(","), "DS-ACTUAL-EXECUTION,DS-INITIAL-SUBMISSION,DS-PROJECT-COMMITMENT,DS-PROJECT-USE");
  assert.equal(core.pipelineSpecs.find((item) => item.pipelineId === "S002-PIPE-PROJECT-v1").snapshotCount, 6);
  assert.equal(core.pipelineSpecs.find((item) => item.pipelineId === "S002-PIPE-PROJECT-v1").totalNodeCount, 8);
  assert.equal(core.sourceFiles.every((item) => item.downloadHref && item.copyKind === "ORIGINAL_SOURCE_COPY" && item.marker === "SOURCE"), true);
});

test("M02双资产保留四视图、可解析关系端点且不持有业务Metric字段", () => {
  const { data } = loadCore();
  const memberIds = new Set(data.targetAssets.flatMap((asset) => asset.members.map((member) => member.id)));
  for (const asset of data.targetAssets) {
    assert.deepEqual(Array.from(asset.detailViews, (item) => item.key), ["overview", "members", "lineage", "consumption"]);
    assert.ok(asset.members.length > 0);
    assert.ok(asset.relationshipContracts.length > 0);
    for (const relation of asset.relationshipContracts) {
      assert.ok(memberIds.has(relation.sourceMemberId), `${relation.id} 来源成员不可解析`);
      assert.ok(memberIds.has(relation.targetMemberId), `${relation.id} 目标成员不可解析`);
    }
  }
  const fieldIds = data.targetAssets.flatMap((asset) => asset.members.flatMap((member) => member.fields.map((field) => field.fieldId)));
  for (const forbidden of ["PROP-S002-PROJECT-IN-TRANSIT", "PROP-S002-PROJECT-BALANCE", "PROP-S002-PURCHASE-PRICE-RATIO"]) {
    assert.equal(fieldIds.includes(forbidden), false, `M02不得发布业务公式派生字段 ${forbidden}`);
  }
});

test("M02画布按真实管道身份构图，来源节点不再借用finance或s003聚合身份", () => {
  const { data, core } = loadCore();
  const app = read("shared/app.js");
  const start = app.indexOf("  function s002SourceNodeSpecs()");
  const end = app.indexOf("  function defaultPythonModule", start);
  assert.ok(start >= 0 && end > start);
  const sandbox = { window: { S002_CORE_DATA: core }, D: data, CANVAS_ORIGIN: { x: 6000, y: 4200 } };
  vm.createContext(sandbox);
  vm.runInContext(`${app.slice(start, end)}; budget=s002PipelineGraph("S002-PIPE-BUDGET-v1"); project=s002PipelineGraph("S002-PIPE-PROJECT-v1");`, sandbox);
  const budget = JSON.parse(JSON.stringify(sandbox.budget));
  const project = JSON.parse(JSON.stringify(sandbox.project));
  assert.equal(budget.nodes.length, 7);
  assert.equal(project.nodes.length, 8);
  assert.equal(budget.nodes.filter((item) => item.key === "source").length, 3);
  assert.equal(project.nodes.filter((item) => item.key === "source").length, 4);
  for (const graph of [budget, project]) {
    for (const node of graph.nodes.filter((item) => item.key === "source")) {
      assert.equal(node.sourceId, node.logicalSourceId);
      assert.match(node.sourceId, /^DS-/);
      assert.doesNotMatch(node.sourceId, /finance-workbook|s003-workbook/);
    }
  }
});

test("M02 Owner投影形成八条flow快照、两条独立定义运行和两个可下钻资产版本", () => {
  const { data, core } = loadCore();
  const app = read("shared/app.js");
  const ownerProjectionStart = app.indexOf("  function projectS002OwnerRun(current)");
  const ownerProjectionEnd = app.indexOf("\n  let flow = projectS002OwnerRun", ownerProjectionStart);
  const helpersStart = app.indexOf("  function s002SourceNodeSpecs()");
  const helpersEnd = app.indexOf("  function defaultPythonModule", helpersStart);
  const scenarioContext = { scenarioId: "S002", scenarioVersion: "S002-v1", scenarioRunId: "S002-RUN-TEST", formedAt: "2026-08-15T08:00:00.000Z", status: "active" };
  const dataAssets = data.targetAssets.map((asset) => ({
    assetId: asset.t006Id, version: asset.currentVersion, name: asset.name,
    memberIds: asset.members.map((member) => member.id),
    internalRelationIds: asset.relationshipContracts.filter((relation) => relation.scope !== "cross-asset").map((relation) => relation.id),
    crossAssetRelationIds: asset.relationshipContracts.filter((relation) => relation.scope === "cross-asset").map((relation) => relation.id),
    qualityReceiptId: "S002-QUALITY-RECEIPT-v1", snapshotId: "S002-SOURCE-SNAPSHOT-v1", asOf: "2025-12-31",
    status: "published-for-scenario"
  }));
  const owner = {
    moduleId: "M02", moduleVersion: "S002-M02-1.0.0",
    progress: { dataConnected: true, qualityPassed: true, assetPublished: true },
    sourceSnapshot: { snapshotId: "S002-SOURCE-SNAPSHOT-v1", sourceSha256: "hash" },
    qualityReceipt: { receiptId: "S002-QUALITY-RECEIPT-v1", status: "passed-for-demo", checksPassed: 20, checksTotal: 20 },
    dataAssets,
    dataAsset: { version: "S002-DATA-v1", asOf: "2025-12-31", componentAssets: dataAssets },
    pipelineDefinitions: core.pipelineSpecs.map((spec) => ({
      pipelineId: spec.pipelineId,
      targetAssetVersion: spec.targetAssetVersion,
      sourceIds: Array.from(spec.sourceIds)
    })),
    pipelineRuns: core.pipelineSpecs.map((spec) => ({
      pipelineId: spec.pipelineId,
      runId: `RUN-${spec.pipelineId}`,
      targetAssetVersion: spec.targetAssetVersion,
      status: "completed"
    }))
  };
  // 模拟基线空工作区同步将可变展示字段改为“尚未发布”。Owner投影必须
  // 继续使用真源的稳定 assetSpecs 映射，不能把两条管道串到首个T006。
  data.targetAssets.forEach((asset) => { asset.currentVersion = "尚未发布"; });
  const sandbox = {
    window: { S002_CORE_DATA: core }, D: data, CANVAS_ORIGIN: { x: 6000, y: 4200 },
    SCENARIO_ID: "S002", SCENARIO_VERSION: "S002-v1", SCENARIO_RUN_ID: "S002-RUN-TEST",
    BOOT_PARAMS: new URLSearchParams(), copy: (value) => JSON.parse(JSON.stringify(value)),
    readS002ModuleOwnerEnvelope: () => ({ owner, bound: scenarioContext }),
    s002M01AdoptionEvidence: () => ({ ready: false, claimPresent: true, issues: ["待联合证据"], publishedOntology: { publishedPointer: "T019-S002-v1", dataAssetVersion: "S002-DATA-v1" }, c003Receipt: null, targetDraftBinding: null })
  };
  vm.createContext(sandbox);
  vm.runInContext(`${app.slice(helpersStart, helpersEnd)}\n${app.slice(ownerProjectionStart, ownerProjectionEnd)}\nresult=projectS002OwnerRun({ pipelineSchedules:{}, authorityVersionIds:{} });`, sandbox);
  const flow = JSON.parse(JSON.stringify(sandbox.result));
  assert.equal(flow.uploadedSnapshots.length, 8);
  assert.equal(new Set(flow.uploadedSnapshots.map((item) => item.snapshot.snapshotId)).size, 8);
  assert.equal(flow.uploadedSnapshots.every((item) => /^DS-/.test(item.sourceId)), true);
  assert.deepEqual(flow.publishedDefinitions.map((item) => item.pipelineId), ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]);
  assert.deepEqual(flow.runs.map((item) => item.pipelineId), ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]);
  assert.equal(flow.runs.find((item) => item.pipelineId === "S002-PIPE-PROJECT-v1").inputs.length, 4);
  assert.deepEqual(flow.assetVersions.map((item) => item.definitionVersion), ["S002-PIPE-BUDGET-v1", "S002-PIPE-PROJECT-v1"]);
  assert.deepEqual(flow.assetVersions.map((item) => item.targetAssetId), ["S002-BUDGET-EXECUTION-ASSET", "S002-PROJECT-OCCUPANCY-ASSET"]);
  assert.deepEqual(flow.assetVersions.map((item) => item.members.length), [4, 3]);
  assert.equal(flow.assetVersions[0].targetAssetId === flow.assetVersions[1].targetAssetId, false, "双资产不得串线到同一T006");
});

test("M02单文件构建按 fixtures → S002真源 → app 顺序执行，适配器不再重建资源货架", () => {
  const entry = read("方案B2.html");
  const adapter = read("s002-adapter.js");
  const fixturesAt = entry.indexOf("window.DE_DATA");
  const coreAt = entry.indexOf("window.S002_CORE_DATA");
  const appAt = entry.indexOf("const FLOW_KEY");
  assert.ok(fixturesAt >= 0 && coreAt > fixturesAt && appAt > coreAt);
  assert.match(entry, /s002-adapter\.js\?v=20260817-\d+/);
  const applyStart = adapter.indexOf("function applyScenarioProjection()");
  const applyEnd = adapter.indexOf("function schedule()", applyStart);
  const runtimeProjection = adapter.slice(applyStart, applyEnd);
  for (const forbidden of ["projectS002LogicalSourceDirectory", "projectS002AssetShelf", "projectS002PipelineDirectory", "projectS002PipelineCanvas", "adaptVisibleBaselineLabels"]) {
    assert.equal(runtimeProjection.includes(forbidden), false, `运行时不得再调用整页DOM投影 ${forbidden}`);
  }
  assert.ok(runtimeProjection.includes("projectSourceFileCatalog"));
});
