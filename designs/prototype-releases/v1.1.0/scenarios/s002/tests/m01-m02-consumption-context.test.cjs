"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const m01Ref = "baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js";
const m02Ref = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

function scenarioData() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read("data.js"), sandbox);
  return JSON.parse(JSON.stringify(sandbox.window.S002_DATA));
}

function m01SeedState() {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const sandbox = {
    URLSearchParams,
    localStorage,
    location: { search: "?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=S002-RUN-20260815160000000-9f72297443c6&formedAt=2026-08-15T08%3A00%3A00.000Z&status=active&m02AssetPublished=1&m01MappingApplied=1&m01OntologyPublished=1&m01Ready=1", hash: "#published", pathname: "/m01/index.html" },
    history: { replaceState() {} },
    window: { addEventListener() {} },
    document: { documentElement: { dataset: {} } },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(read(m01Ref), sandbox);
  return JSON.parse(values.get("ontology3-canvas-first-review-v17"));
}

function baselineC003Fingerprint(value) {
  const canonical = (item) => {
    if (Array.isArray(item)) return item.map(canonical);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])]));
  };
  const snapshot = { ...value };
  delete snapshot.payloadFingerprint;
  const content = JSON.stringify(canonical(snapshot));
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `C003-PF-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}-${content.length}`;
}

test("M02两个独立数据资产覆盖五个逻辑源，并显式区分资产内与跨资产关系", function () {
  const data = scenarioData();
  assert.equal(data.dataSources.length, 5);
  assert.equal(data.sourceManifest.length, 8);
  assert.equal(data.dataAssets.length, 2);
  assert.deepEqual(data.dataAssets.map((asset) => asset.version), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.deepEqual(data.dataAssets[0].relationshipScope, { internal: 4, crossAsset: 1 });
  assert.deepEqual(data.dataAssets[1].relationshipScope, { internal: 2, crossAsset: 1 });
  assert.deepEqual(data.dataAssets[0].crossAssetRelationIds, ["REL-LINK-S002-VOUCHER-PROJECT"]);
  assert.deepEqual(data.dataAssets[1].crossAssetRelationIds, ["REL-LINK-S002-PROJECT-VERSION"]);
  assert.deepEqual(data.dataAssets[1].sourceIds, ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"]);
  assert.deepEqual(data.dataPipelines.map((pipeline) => pipeline.targetAssetVersion), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
});

test("M01的C003组合合同满足v1.0.3精确来源链，并保留两条组件管道沿袭", function () {
  const source = read(m01Ref);
  assert.ok(source.includes('assetRole: "compatibility-delivery-pointer"'));
  assert.ok(source.includes('sourceChain: ["S002-SOURCE-SNAPSHOT-v1", "S002-PIPE-BUDGET-v1 + S002-PIPE-PROJECT-v1", "RUN-S002-PIPE-BUDGET-v1 + RUN-S002-PIPE-PROJECT-v1", "S002-QUALITY-RECEIPT-v1", DATA_BUNDLE_VERSION]'));
  assert.ok(source.includes('runs: ['));
  assert.ok(source.includes('{ runId: "RUN-S002-PIPE-BUDGET-v1", definitionVersion: "S002-PIPE-BUDGET-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1" }'));
  assert.ok(source.includes('{ runId: "RUN-S002-PIPE-PROJECT-v1", definitionVersion: "S002-PIPE-PROJECT-v1", targetAssetVersion: "S002-PROJECT-OCC-v1" }'));
  assert.equal(source.includes('RUN-S002-M02-v1'), false, "不得继续引用不存在的聚合M02运行");
  assert.equal(source.includes('QR-S002-DATA-v1'), false, "不得继续引用不存在的质量结果编号");
  assert.ok(source.includes('componentSourceChains: {'));
  assert.ok(source.includes('"S002-BUDGET-EXEC-v1": ["SRC-2024-ACTUAL + SRC-2025-ACTUAL'));
  assert.ok(source.includes('"S002-PROJECT-OCC-v1": ["SRC-2024-ACTUAL + SRC-2025-ACTUAL + SRC-2025-SUBMISSION + SRC-2026-SUBMISSION + SRC-2025-COMMITMENT + SRC-PROJECT-USE"'));
  assert.ok(source.includes('crossAssetRelations: ['));
  assert.ok(source.includes('sourceAssetVersion: "S002-BUDGET-EXEC-v1", targetAssetVersion: "S002-PROJECT-OCC-v1"'));
  assert.ok(source.includes('sourceAssetVersion: "S002-PROJECT-OCC-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1"'));
  assert.equal(source.includes('...Object.fromEntries(sourceDelivery.componentAssets.map'), false, "不得把组合合同机械改写成指纹失效的组件C003合同");

  const state = m01SeedState();
  const delivery = state.externalDataAssets["S002-DATA-BUNDLE::S002-DATA-v1"];
  assert.equal(delivery.payloadFingerprintValid, true);
  assert.equal(delivery.payloadFingerprint, baselineC003Fingerprint(delivery), "C003载荷指纹必须与v1.0.3接收端算法完全一致");
  assert.deepEqual(delivery.sourceChain, [
    "S002-SOURCE-SNAPSHOT-v1",
    "S002-PIPE-BUDGET-v1 + S002-PIPE-PROJECT-v1",
    "RUN-S002-PIPE-BUDGET-v1 + RUN-S002-PIPE-PROJECT-v1",
    "S002-QUALITY-RECEIPT-v1",
    "S002-DATA-v1"
  ]);
  assert.deepEqual(delivery.runEvidence.runs.map((run) => run.runId), ["RUN-S002-PIPE-BUDGET-v1", "RUN-S002-PIPE-PROJECT-v1"]);
  const receipt = state.dataAssetDeliveryReceipts[delivery.deliveryId];
  assert.equal(receipt.receiptId, "RECEIPT-C003-S002-DATA-v1");
  assert.equal(receipt.deliveryId, "C003-S002-DATA-v1");
  assert.deepEqual(receipt.componentAssets.map((asset) => asset.version), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
});

test("M01的sourceDelivery、dataContract、Draft、C033与T019消费投影使用同一双资产合同", function () {
  const state = m01SeedState();
  const version = state.publishedVersions[0];
  const delivery = version.sourceDeliverySnapshot;
  const contract = version.dataContract;
  const receipt = version.sourceDeliveryReceiptSnapshot;
  const binding = state.bindingsByVersion[version.id].current;
  const c033 = state.scenarioContextReceipts[`C033-${version.scenarioContext.scenarioRunId}`];

  assert.deepEqual(delivery.componentAssets.map((asset) => ({
    version: asset.assetVersion,
    sources: asset.sourceIds,
    snapshots: asset.sourceSnapshotIds,
    pipeline: asset.pipelineId,
    run: asset.runId
  })), [
    {
      version: "S002-BUDGET-EXEC-v1",
      sources: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"],
      snapshots: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2024-BUDGET", "SRC-2025-BUDGET", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION"],
      pipeline: "S002-PIPE-BUDGET-v1",
      run: "RUN-S002-PIPE-BUDGET-v1"
    },
    {
      version: "S002-PROJECT-OCC-v1",
      sources: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"],
      snapshots: ["SRC-2024-ACTUAL", "SRC-2025-ACTUAL", "SRC-2025-SUBMISSION", "SRC-2026-SUBMISSION", "SRC-2025-COMMITMENT", "SRC-PROJECT-USE"],
      pipeline: "S002-PIPE-PROJECT-v1",
      run: "RUN-S002-PIPE-PROJECT-v1"
    }
  ]);
  assert.deepEqual(contract.componentAssets, delivery.componentAssets);
  assert.deepEqual(contract.crossAssetRelations, delivery.crossAssetRelations);
  assert.deepEqual(contract.componentSourceChains, delivery.componentSourceChains);
  assert.deepEqual(version.consumptionContext.componentAssets.map((asset) => asset.version), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.deepEqual(receipt.componentAssets.map((asset) => asset.version), ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.deepEqual(binding.dataVersions, ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.deepEqual(binding.consumptionContext.componentAssetVersions, ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"]);
  assert.equal(receipt.targetDraftId, "DRAFT-S002-BUDGET-v1");
  assert.equal(binding.consumptionContext.targetDraftId, "DRAFT-S002-BUDGET-v1");
  assert.deepEqual(c033.envelope.scenarioContext, version.scenarioContext);
  assert.deepEqual(c033.receipt.scenarioContext, version.scenarioContext);
  assert.equal(c033.receipt.status, "accepted");
});

test("M01与M02共同展示同轮消费上下文，而不是仅凭Published文案宣称可用", function () {
  const m01 = read(m01Ref);
  const m02 = read(m02Ref);
  for (const token of [
    "consumptionContext:",
    "C003接收 → C029匹配 → T018资格 → C008固定题验证 → C009兼容 → T019采用",
    'document.querySelector(".data-consumption") || document.querySelector(".published-ontology-detail")',
    "C003兼容组合指针",
    "独立数据资产",
    "预算编制与执行资产",
    "项目占用与余额资产",
    "S002-PIPE-BUDGET-v1",
    "S002-PIPE-PROJECT-v1",
    "S002-SOURCE-SNAPSHOT-v1",
    "S002-QUALITY-RECEIPT-v1",
    "RUN-S002-PIPE-BUDGET-v1",
    "RUN-S002-PIPE-PROJECT-v1",
    "RECEIPT-C003-S002-DATA-v1",
    "不作为第三个业务数据资产",
    "Published本体 / T019"
  ]) assert.ok(m01.includes(token), `M01消费上下文缺少：${token}`);
  for (const token of [
    "M01 映射未完整绑定两个独立数据资产版本",
    "M01 Published 未完整引用两个独立数据资产版本",
    "M01 C003回执未绑定当前完整场景运行上下文",
    "M01 C003回执未列明两个独立数据资产版本",
    "目标Draft未完整绑定两个独立数据资产版本",
    "function consumptionContextHtml",
    "data-s002-consumption-context",
    "来源快照",
    "质量回执",
    "组件正式运行",
    "S002-QUALITY-RECEIPT-v1",
    "RUN-S002-PIPE-BUDGET-v1 + RUN-S002-PIPE-PROJECT-v1"
  ]) assert.ok(m02.includes(token), `M02联合消费核对缺少：${token}`);
  assert.ok(m02.includes('consumptionLabel: adoption.ready ? "可消费（演示数据）" : "已发布 · 待 M01 联合证据核对"'));
  assert.ok(m02.includes('context.status === "historical-readonly"'), "历史只读查看未保留原 active C003 回执语义");
  assert.ok(m02.includes('["active", "historical-readonly"].includes(value?.status)'), "历史只读状态兼容范围不明确");
});

test("RULE-003承担成本占收比异常识别，跨年计提配对独立作为质量核验", function () {
  const data = scenarioData();
  const rule = data.rules.find((item) => item.id === "RULE-003");
  const evaluation = data.ruleEvaluations.find((item) => item.evaluationId === "EVAL-ACCRUAL-001");
  assert.equal(rule.name, "成本占收比异常");
  assert.equal(rule.metricId, "MET-001");
  assert.equal(rule.actionTypeId, "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW");
  assert.equal(rule.expression, "costToRevenue >= 100%");
  assert.equal(evaluation.status, "evaluated-no-hit");
  assert.equal(evaluation.actionPolicy, "no-action");
  assert.equal(evaluation.ruleId, null);
  assert.equal(data.ruleHitMappings.some((mapping) => mapping.ruleId === "RULE-003" && mapping.hitId === "HIT-003-2025-AQ"), true);
  assert.equal(data.actionSuggestions.find((item) => item.id === "SUG-001").metricId, "MET-001");
});

test("六类整改 Action 使用场景权威 ID，旧 ID 仅保留兼容映射", function () {
  const data = scenarioData();
  assert.deepEqual(data.actionTypes.map((item) => item.id), [
    "ACT-BUDGET-EXECUTION-RECTIFICATION",
    "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW",
    "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW",
    "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT",
    "ACT-PROCUREMENT-COMMITMENT-CLEANUP",
    "ACT-SUPPLIER-PRICE-REVIEW"
  ]);
  assert.deepEqual(data.actionTypes.map((item) => item.legacyCompatibleId), [
    "ACT-BUDGET-INCREASE",
    "ACT-BUDGET-DECREASE",
    "ACT-SUBJECT-TRANSFER",
    "ACT-SUBMISSION-RETURN",
    "ACT-RELEASE-COMMITMENT",
    "ACT-PRICE-REVIEW"
  ]);
  assert.equal(data.legacyActionTypeIdMap["ACT-SUBJECT-TRANSFER"], "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW");
});
