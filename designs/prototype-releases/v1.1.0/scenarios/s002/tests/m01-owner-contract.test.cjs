"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const adapterPath = path.join(scenarioRoot, "baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js");
const storageKey = "ontology3-canvas-first-review-v17";

function executeAdapter(search, initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  const listeners = {};
  let replacement = null;
  const location = {
    search,
    hash: "#published",
    pathname: "/scenarios/s002/baseline-adapters/ontology-management-review/canvas-first/index.html",
    origin: "http://127.0.0.1:4400",
    href: `http://127.0.0.1:4400/scenarios/s002/baseline-adapters/ontology-management-review/canvas-first/index.html${search}#published`,
    replace(value) { replacement = value; }
  };
  const sandbox = {
    URL,
    URLSearchParams,
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    location,
    history: { replaceState() {} },
    window: { addEventListener(type, listener) { listeners[type] = listener; } },
    document: { documentElement: { dataset: {} } },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(adapterPath, "utf8"), sandbox, { filename: adapterPath });
  return {
    values,
    listeners,
    replacement: () => replacement,
    state: () => values.has(storageKey) ? JSON.parse(values.get(storageKey)) : null
  };
}

function readySearch(runId = "S002-RUN-M01-OWNER-READY") {
  return `?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=${runId}&m02AssetPublished=1&m01MappingApplied=1&m01OntologyPublished=1&m01Ready=1`;
}

function ownerStates(context, overrides = {}) {
  const m02Progress = { assetPublished: true, ...(overrides.m02Progress || {}) };
  const m01Progress = { mappingApplied: true, ontologyPublished: true, ...(overrides.m01Progress || {}) };
  const componentAssets = [
    {
      assetId: "S002-BUDGET-EXECUTION-ASSET",
      version: "S002-BUDGET-EXEC-v1",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"]
    },
    {
      assetId: "S002-PROJECT-OCCUPANCY-ASSET",
      version: "S002-PROJECT-OCC-v1",
      sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"]
    }
  ];
  const componentRefs = componentAssets.map((asset) => ({ assetId: asset.assetId, version: asset.version }));
  return {
    m02: {
      scenarioContext: context,
      payload: {
        moduleId: "M02",
        progress: m02Progress,
        sourceSnapshot: { snapshotId: "S002-SOURCE-SNAPSHOT-v1", logicalSources: 5, snapshotCount: 8 },
        qualityReceipt: { receiptId: "S002-QUALITY-RECEIPT-v1", status: "passed-for-demo" },
        dataAsset: { assetId: "S002-DATA-BUNDLE", version: "S002-DATA-v1", role: "compatibility-delivery-pointer", componentAssets: componentRefs },
        dataAssets: componentAssets,
        pipelineDefinitions: [
          { pipelineId: "S002-PIPE-BUDGET-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1", sourceIds: ["DS-ACTUAL-EXECUTION", "DS-APPROVED-BUDGET", "DS-INITIAL-SUBMISSION"] },
          { pipelineId: "S002-PIPE-PROJECT-v1", targetAssetVersion: "S002-PROJECT-OCC-v1", sourceIds: ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"] }
        ],
        pipelineRuns: [
          { runId: "RUN-S002-PIPE-BUDGET-v1", pipelineId: "S002-PIPE-BUDGET-v1", targetAssetVersion: "S002-BUDGET-EXEC-v1", status: "completed" },
          { runId: "RUN-S002-PIPE-PROJECT-v1", pipelineId: "S002-PIPE-PROJECT-v1", targetAssetVersion: "S002-PROJECT-OCC-v1", status: "completed" }
        ]
      }
    },
    m01: {
      scenarioContext: context,
      payload: {
        moduleId: "M01",
        progress: m01Progress,
        c003Receipt: {
          contractCode: "C003",
          receiptId: "RECEIPT-C003-S002-DATA-v1",
          deliveryId: "C003-S002-DATA-v1",
          status: "accepted",
          t006Id: "S002-DATA-BUNDLE",
          t007Version: "S002-DATA-v1",
          componentAssets: componentRefs,
          targetDraftId: "DRAFT-S002-BUDGET-v1",
          targetDraftRevision: 1,
          scenarioContext: context
        },
        targetDraftBinding: {
          deliveryId: "C003-S002-DATA-v1",
          sourceDeliveryId: "C003-S002-DATA-v1",
          assetVersion: "S002-DATA-v1",
          sourceAssetVersion: "S002-DATA-v1",
          componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
          targetDraftId: "DRAFT-S002-BUDGET-v1",
          targetDraftRevision: 1
        },
        mappingVersion: overrides.mappingVersion === false ? null : {
          mappingId: "S002-MAPPING-v1",
          dataAssetVersion: "S002-DATA-v1",
          componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
          assetBindings: componentRefs,
          crossAssetRelations: [
            { relationId: "REL-LINK-S002-VOUCHER-PROJECT" },
            { relationId: "REL-LINK-S002-PROJECT-VERSION" }
          ]
        },
        publishedOntology: overrides.publishedOntology === false ? null : {
          status: "published-for-scenario",
          ontologyVersion: "S002-ONTO-v1",
          publishedPointer: "T019-S002-v1",
          dataAssetVersion: "S002-DATA-v1",
          componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
          metricVersion: "S002-METRIC-v1",
          ruleVersion: "S002-RULE-v1",
          actionTypeVersion: "S002-ACTION-TYPE-v1",
          consumptionContext: {
            scenarioContext: context,
            dataBundleVersion: "S002-DATA-v1",
            componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
            ontologyVersion: "S002-ONTO-v1",
            publishedPointer: "T019-S002-v1",
            c003DeliveryId: "C003-S002-DATA-v1",
            c003ReceiptId: "RECEIPT-C003-S002-DATA-v1",
            targetDraftId: "DRAFT-S002-BUDGET-v1",
            targetDraftRevision: 1,
            status: "ready-for-current-scenario-run",
            readOnly: true
          }
        }
      }
    }
  };
}

function readinessQuery(states, context) {
  const runtime = executeAdapter(`?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=${context.scenarioRunId}&formedAt=${encodeURIComponent(context.formedAt)}&status=${context.status}&m01Ready=0`);
  runtime.listeners.message({
    origin: "http://127.0.0.1:4400",
    data: { channel: "ofw.s002", type: "restore-view-context", context, ownerStates: states }
  });
  return new URL(runtime.replacement()).searchParams;
}

test("M01只有同轮M02发布、映射完成且Published后才形成T019运行态", function () {
  const blocked = executeAdapter("?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=S002-RUN-BLOCKED");
  assert.equal(blocked.state(), null, "缺少Owner完成态时不得本地生成Published");

  const partiallyReady = executeAdapter("?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=S002-RUN-PARTIAL&m02AssetPublished=1&m01MappingApplied=1&m01OntologyPublished=0&m01Ready=0");
  assert.equal(partiallyReady.state(), null, "M01未Published时不得生成T019");

  const ready = executeAdapter(readySearch());
  assert.equal(ready.state().publishedVersions[0].consumptionContext.publishedPointer, "T019-S002-v1");
});

test("M01接收Owner State时校验scenarioRunId并要求页面以权威状态重载", function () {
  const runId = "S002-RUN-M01-MESSAGE";
  const currentContext = { scenarioId: "S002", scenarioVersion: "S002-v1", scenarioRunId: runId, formedAt: "2026-08-15T08:00:00.000Z", status: "active" };
  const ready = executeAdapter(readySearch(runId));
  ready.listeners.message({
    origin: "http://127.0.0.1:4400",
    data: { channel: "ofw.s002", type: "restore-view-context", context: currentContext, ownerStates: ownerStates({ ...currentContext, scenarioRunId: "S002-RUN-OTHER" }) }
  });
  assert.match(ready.replacement(), /m01Ready=0/, "跨运行Owner State必须降级并重载，不得复用旧T019");

  const blocked = executeAdapter("?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=S002-RUN-M01-MESSAGE&m01Ready=0");
  blocked.listeners.message({
    origin: "http://127.0.0.1:4400",
    data: { channel: "ofw.s002", type: "restore-view-context", context: currentContext, ownerStates: ownerStates(currentContext) }
  });
  assert.match(blocked.replacement(), /m01Ready=1/, "同轮完整Owner State应切换到正式消费页面");
});

test("M01 Owner就绪门精确校验双资产来源、双管道运行、C003、Draft和T019联合证据", function () {
  const context = { scenarioId: "S002", scenarioVersion: "S002-v1", scenarioRunId: "S002-RUN-M01-NEGATIVE", formedAt: "2026-08-15T08:00:00.000Z", status: "active" };
  const ready = readinessQuery(ownerStates(context), context);
  assert.equal(ready.get("m01Ready"), "1");

  const cases = [
    {
      name: "组件版本错误",
      mutate(states) { states.m02.payload.dataAssets[1].version = "S002-PROJECT-OCC-v2"; },
      expected: ["m02AssetPublished", "0"]
    },
    {
      name: "项目资产缺少项目使用来源",
      mutate(states) { states.m02.payload.dataAssets[1].sourceIds.pop(); },
      expected: ["m02AssetPublished", "0"]
    },
    {
      name: "项目管道运行身份错误",
      mutate(states) { states.m02.payload.pipelineRuns[1].runId = "RUN-S002-PIPE-WRONG-v1"; },
      expected: ["m02AssetPublished", "0"]
    },
    {
      name: "C003回执运行上下文不一致",
      mutate(states) { states.m01.payload.c003Receipt.scenarioContext = { ...context, formedAt: "2026-08-15T08:00:01.000Z" }; },
      expected: ["m01MappingApplied", "0"]
    },
    {
      name: "目标Draft未绑定双资产",
      mutate(states) { states.m01.payload.targetDraftBinding.componentAssetVersions.pop(); },
      expected: ["m01MappingApplied", "0"]
    },
    {
      name: "T019只声明指针但缺少联合版本",
      mutate(states) { states.m01.payload.publishedOntology.componentAssetVersions.pop(); },
      expected: ["m01OntologyPublished", "0"]
    }
  ];

  for (const item of cases) {
    const states = ownerStates(context);
    item.mutate(states);
    const query = readinessQuery(states, context);
    assert.equal(query.get(item.expected[0]), item.expected[1], item.name);
    assert.equal(query.get("m01Ready"), "0", `${item.name}不得进入正式消费态`);
  }
});

test("M01历史只读查看沿用原运行证据上下文且不把状态差异误判为跨轮次", function () {
  const sourceContext = { scenarioId: "S002", scenarioVersion: "S002-v1", scenarioRunId: "S002-RUN-M01-HISTORY", formedAt: "2026-08-15T08:00:00.000Z", status: "active" };
  const viewContext = { ...sourceContext, status: "historical-readonly" };
  const states = ownerStates(sourceContext);
  states.m02.scenarioContext = viewContext;
  states.m01.scenarioContext = viewContext;

  const query = readinessQuery(states, viewContext);
  assert.equal(query.get("m02AssetPublished"), "1");
  assert.equal(query.get("m01MappingApplied"), "1");
  assert.equal(query.get("m01OntologyPublished"), "1");
  assert.equal(query.get("m01Ready"), "1");

  states.m01.payload.c003Receipt.scenarioContext = { ...sourceContext, scenarioRunId: "S002-RUN-OTHER" };
  const crossRun = readinessQuery(states, viewContext);
  assert.equal(crossRun.get("m01Ready"), "0", "历史查看仍不得跨run复用C003证据");
});

test("M01历史只读或关闭运行禁止创建和修订Draft", function () {
  const app = fs.readFileSync(path.join(path.dirname(adapterPath), "app.js"), "utf8");
  assert.ok(app.includes('!["historical-readonly", "closed"].includes(context?.status)'), "历史或关闭运行未纳入写入门禁");
  assert.ok(app.includes('btn("创建修订 Draft", `clone-version:${version.id}`, { disabled: !currentScenarioContextReady() })'), "Published详情的修订入口未绑定只读门禁");
  const readinessStart = app.indexOf("  function currentScenarioContextReady()");
  const readinessEnd = app.indexOf("  function currentVersionWriteIssue", readinessStart);
  assert.ok(readinessStart >= 0 && readinessEnd > readinessStart);
  assert.ok(app.slice(readinessStart, readinessEnd).includes('historical-readonly'));
  assert.ok(app.slice(readinessStart, readinessEnd).includes('closed'));
});

test("M01本地缓存仅在完整C033、双资产来源链与Published绑定均有效时复用", function () {
  const runId = "S002-RUN-M01-CACHE-STRICT";
  const original = executeAdapter(readySearch(runId)).state();
  const corrupted = JSON.parse(JSON.stringify(original));
  corrupted.publishedVersions[0].sourceDeliverySnapshot.componentAssets[1].sourceSnapshotIds.pop();
  corrupted.publishedVersions[0].dataContract.componentAssets[1].sourceSnapshotIds.pop();
  corrupted.scenarioContextReceipts[`C033-${runId}`].receipt.status = "accepted-without-evidence";

  const repaired = executeAdapter(readySearch(runId), { [storageKey]: JSON.stringify(corrupted) }).state();
  const version = repaired.publishedVersions[0];
  assert.equal(repaired.s002BusinessSeedVersion, "S002-M01-BUDGET-PUBLISHED-v8");
  assert.equal(version.sourceDeliverySnapshot.componentAssets[1].sourceSnapshotIds.length, 6);
  assert.equal(version.dataContract.componentAssets[1].sourceSnapshotIds.length, 6);
  assert.equal(repaired.scenarioContextReceipts[`C033-${runId}`].receipt.status, "accepted");
});

test("M01语义依赖闭包可解析到M02原子字段并提供跨模块稳定别名", function () {
  const state = executeAdapter(readySearch("S002-RUN-M01-CLOSURE")).state();
  const version = state.publishedVersions[0];
  const properties = new Set(version.properties.map((item) => item.id));
  const metrics = new Map(version.metrics.map((item) => [item.id, item]));

  function resolves(dependencyId, visiting = new Set()) {
    if (properties.has(dependencyId)) return true;
    if (!metrics.has(dependencyId) || visiting.has(dependencyId)) return false;
    const next = new Set(visiting);
    next.add(dependencyId);
    return metrics.get(dependencyId).dependencyIds.every((item) => resolves(item, next));
  }

  for (const metric of version.metrics) {
    assert.equal(metric.dependencyIds.every((item) => resolves(item)), true, `${metric.code}存在无法解析的数据依赖`);
  }
  for (const rule of version.rules) {
    assert.equal(rule.dependencyIds.every((item) => resolves(item)), true, `${rule.code}存在无法解析的数据依赖`);
  }

  const expectedAliases = {
    "MET-001": "MET-S002-COST-TO-REVENUE",
    "MET-002": "MET-S002-GROSS-MARGIN",
    "MET-003": "MET-S002-NET-IN-TRANSIT",
    "MET-004": "MET-S002-POSITIVE-PURCHASE",
    "MET-005": "MET-S002-DEC-POSITIVE-PURCHASE-SHARE",
    "MET-006": "MET-S002-PROJECT-AVAILABLE-BALANCE",
    "MET-007": "MET-S002-BUDGET-EXECUTION-RATE",
    "MET-008": "MET-S002-ACTUAL-BUDGET-VARIANCE",
    "MET-009": "MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION",
    "RULE-001": "RULE-S002-PROJECT-COVERAGE",
    "RULE-002": "RULE-S002-EXECUTION-DEVIATION",
    "RULE-003": "RULE-S002-COST-TO-REVENUE",
    "RULE-004": "RULE-S002-YEAR-END-CONCENTRATION",
    "RULE-005": "RULE-S002-SUPPLIER-PRICE",
    "ACT-BUDGET-EXECUTION-RECTIFICATION": "ACTION-S002-BUDGET-INCREASE",
    "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW": "ACTION-S002-BUDGET-DECREASE",
    "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW": "ACTION-S002-SUBJECT-TRANSFER",
    "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT": "ACTION-S002-SUBMISSION-RETURN",
    "ACT-PROCUREMENT-COMMITMENT-CLEANUP": "ACTION-S002-RELEASE-COMMITMENT",
    "ACT-SUPPLIER-PRICE-REVIEW": "ACTION-S002-PRICE-REVIEW",
    "ACT-BUDGET-INCREASE": "ACTION-S002-BUDGET-INCREASE",
    "ACT-BUDGET-DECREASE": "ACTION-S002-BUDGET-DECREASE",
    "ACT-SUBJECT-TRANSFER": "ACTION-S002-SUBJECT-TRANSFER",
    "ACT-SUBMISSION-RETURN": "ACTION-S002-SUBMISSION-RETURN",
    "ACT-RELEASE-COMMITMENT": "ACTION-S002-RELEASE-COMMITMENT",
    "ACT-PRICE-REVIEW": "ACTION-S002-PRICE-REVIEW"
  };
  assert.deepEqual(JSON.parse(JSON.stringify(version.resourceAliases)), expectedAliases);
  assert.deepEqual(version.actions.map((item) => item.legacyCompatibleId), ["ACT-BUDGET-INCREASE", "ACT-BUDGET-DECREASE", "ACT-SUBJECT-TRANSFER", "ACT-SUBMISSION-RETURN", "ACT-RELEASE-COMMITMENT", "ACT-PRICE-REVIEW"]);

  const rule002 = version.rules.find((item) => item.code === "RULE-002");
  assert.deepEqual(rule002.actionRoutes.map((item) => item.actionTypeId), ["ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", "ACT-BUDGET-EXECUTION-RECTIFICATION", "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW"]);
  assert.equal(version.objects.find((item) => item.id === "OBJ-S002-ACTUAL-VOUCHER").count, 420);
  assert.equal(version.objects.find((item) => item.id === "OBJ-S002-PURCHASE-INITIATION").count, 108);
  assert.equal(version.links.length, 8);
  assert.equal(version.dataContract.crossAssetRelations.length, 2);
  assert.equal(properties.has("PROP-S002-PURCHASE-PRICE-RATIO"), false, "价格倍率不得作为M02原子字段");
  assert.equal(properties.has("PROP-S002-PROJECT-IN-TRANSIT"), false, "净在途占用必须由Metric计算");
});
