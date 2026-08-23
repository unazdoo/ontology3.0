"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const adapterRef = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js";
const entryRef = "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html";
const sharedAppRef = "baseline-adapters/data-engineering-prototype-review/review-v3/shared/app.js";
const sharedFixturesRef = "baseline-adapters/data-engineering-prototype-review/review-v3/shared/fixtures.js";
const coreRef = "baseline-adapters/data-engineering-prototype-review/review-v3/s002-core-data.js";

function read(ref) {
  return fs.readFileSync(path.join(scenarioRoot, ref), "utf8");
}

test("M02内部路由切换后继续投影同轮次正式管道、质量和资产状态", function () {
  const adapter = read(adapterRef);
  const entry = read(entryRef);

  assert.equal(
    adapter.includes('if (root.dataset.s002OwnerProjection === "ready" && root.dataset.s002OwnerRunId === projection.runId) return;'),
    false,
    "M02不得在资源页首次投影后跳过数据管道与运行历史页"
  );
  for (const token of [
    "function projectS002PipelineDirectory",
    "PIPELINE_SPECS.forEach((spec, index) =>",
    'setFactIn(card, "管道定义版本", spec.pipelineId)',
    'setFactIn(card, "目标资产", asset.name)',
    'badgeNode.textContent = run ? "已完成" : "已登记 · 待运行"',
    "function projectS002RunHistory",
    'badge.textContent = `${runs.length} 条记录`',
    "projection.qualityDetail",
    'setText(page, ".canvas-mode-banner > span:not(.badge)"',
    'setText(page, ".canvas-mode-banner em", `${run.runId} · 已完成`)',
    'railBadge.textContent = "运行证据只读"',
    "pipelineNameField.value = spec.name",
    "pipelinePurposeField.value = spec.purpose",
    'setText(node, ".node-status", "已完成")',
    'contextStrong.textContent = "整条管道 · 已完成"',
    'validationButton.textContent = "直达运行证据只读"',
    "validationButton.disabled = true",
    "重复凭证",
    "期间异常",
    "日期倒置"
  ]) {
    assert.ok(adapter.includes(token), `M02正式运行投影缺少：${token}`);
  }
  assert.match(entry, /s002-adapter\.js\?v=20260817-\d+/, "M02入口未加载带缓存版本的场景脚本");
});

test("M02两条正式管道分别按原生逻辑源和快照集合汇入Python", function () {
  const entry = read(entryRef);
  const sharedApp = read(sharedAppRef);
  const expectedFiles = [
    "2024年实际执行.xlsx",
    "2025年实际执行.xlsx",
    "2024年预算下达明细.xlsx",
    "2025年预算下达明细.xlsx",
    "2025年预算申报明细汇总.xlsx",
    "2026年预算申报明细汇总.xlsx",
    "2025年预算占用.XLSX",
    "项目预算使用情况表.xlsx"
  ];

  for (const token of [
    "function s002SourceNodeSpecs()", "function s002PipelineGraph(definitionId)",
    'sourceId:item.sourceId', 'sourceFileId:item.sourceId', 'sourceSnapshotIds:[...item.snapshotIds]',
    'snapshotCount:item.snapshotCount', 'logicalMemberCount:item.logicalMemberCount',
    'id:"edge-python-quality"', 'id:"edge-quality-publish"', 'id:"edge-publish-refresh"',
    'data-source-file-node="true"', 'data-logical-source-node="true"', 'data-source-snapshot-count='
  ]) assert.ok(sharedApp.includes(token), `M02逻辑来源画布缺少：${token}`);
  for (const file of expectedFiles) assert.ok(entry.includes(file), `M02构建入口缺少来源文件：${file}`);

  const dataSandbox = { window: {}, Intl, encodeURIComponent };
  vm.createContext(dataSandbox);
  vm.runInContext(read(sharedFixturesRef), dataSandbox);
  vm.runInContext(read(coreRef), dataSandbox);
  const specsStart = sharedApp.indexOf("function s002SourceNodeSpecs()");
  const graphEnd = sharedApp.indexOf("function defaultPythonModule", specsStart);
  const sandbox = { window: dataSandbox.window, D: dataSandbox.window.DE_DATA, CANVAS_ORIGIN: { x: 900, y: 700 } };
  vm.createContext(sandbox);
  vm.runInContext(`${sharedApp.slice(specsStart, graphEnd)}; budget=s002PipelineGraph("S002-PIPE-BUDGET-v1"); project=s002PipelineGraph("S002-PIPE-PROJECT-v1");`, sandbox);
  const graphs = [sandbox.budget, sandbox.project].map((item) => JSON.parse(JSON.stringify(item)));
  assert.deepEqual(graphs.map((graph) => graph.nodes.length), [7, 8]);
  assert.deepEqual(graphs.map((graph) => graph.nodes.filter((node) => node.key === "source").length), [3, 4]);
  assert.deepEqual(graphs.map((graph) => graph.nodes.filter((node) => node.key === "source").reduce((sum, node) => sum + node.snapshotCount, 0)), [6, 6]);
  assert.deepEqual(graphs[1].nodes.filter((node) => node.key === "source").map((node) => node.sourceId), ["DS-ACTUAL-EXECUTION", "DS-INITIAL-SUBMISSION", "DS-PROJECT-COMMITMENT", "DS-PROJECT-USE"]);
  const uniqueSources = new Set(graphs.flatMap((graph) => graph.nodes.filter((node) => node.key === "source").map((node) => node.sourceId)));
  const uniqueSnapshots = new Set(graphs.flatMap((graph) => graph.nodes.filter((node) => node.key === "source").flatMap((node) => node.sourceSnapshotIds)));
  assert.equal(uniqueSources.size, 5);
  assert.equal(uniqueSnapshots.size, 8);
  for (const graph of graphs) {
    const sourceNodes = graph.nodes.filter((node) => node.key === "source");
    assert.equal(graph.edges.filter((edge) => edge.to === "node-python").length, sourceNodes.length);
    assert.deepEqual(graph.edges.slice(-3).map((edge) => [edge.from, edge.to, edge.slotId]), [["node-python", "node-quality", "main"], ["node-quality", "node-publish", "main"], ["node-publish", "node-refresh", "main"]]);
    for (let left = 0; left < sourceNodes.length; left += 1) {
      for (let right = left + 1; right < sourceNodes.length; right += 1) {
        const a = sourceNodes[left];
        const b = sourceNodes[right];
        const overlap = a.x < b.x + 150 && a.x + 150 > b.x && a.y < b.y + 150 && a.y + 150 > b.y;
        assert.equal(overlap, false, `${a.displayName} 与 ${b.displayName} 发生画布重叠`);
      }
    }
  }
  assert.ok(entry.includes('"s002LogicalSourceNodeCount":5'), "M02清单未登记五个逻辑数据源节点");
  assert.ok(entry.includes('"s002SnapshotCount":8'), "M02清单未登记八个年度/确认快照");
  assert.ok(entry.includes('"s002LogicalMemberCount":14'), "M02清单未登记十四个逻辑成员");
  assert.ok(entry.includes('"scenarioImplementationDate":"2026-08-15"'), "M02场景实施日期漂移");
  assert.ok(entry.includes('"canvasReverifiedAt":"2026-08-15"'), "M02画布复验日期未统一为实施日期");
  assert.ok(entry.includes('nodeCount:7, source:"3个逻辑数据源 / 6个快照 / 12个逻辑成员"'));
  assert.ok(entry.includes('nodeCount:8, source:"4个逻辑数据源 / 6个快照 / 12个逻辑成员"'));
});

test("M02不得仅凭Published声明把刷新节点升级为消费就绪", function () {
  const sharedApp = read(sharedAppRef);
  const adapter = read(adapterRef);
  const helperStart = sharedApp.indexOf("  function readS002ModuleOwnerEnvelope(");
  const helperEnd = sharedApp.indexOf("  function projectS002OwnerRun(", helperStart);
  assert.ok(helperStart > -1 && helperEnd > helperStart, "无法定位M02的M01采用证据核对函数");

  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-20260815160000000-9f72297443c6",
    formedAt: "2026-08-15T08:00:00.000Z",
    status: "active"
  };
  const owner = {
    moduleId: "M01",
    moduleVersion: "S002-M01-1.0.0",
    progress: { mappingApplied: true, ontologyPublished: true },
    mappingVersion: { dataAssetVersion: "S002-DATA-v1", componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"] },
    publishedOntology: {
      ontologyVersion: "S002-ONTO-v1",
      publishedPointer: "T019-S002-v1",
      dataAssetVersion: "S002-DATA-v1",
      componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
      status: "published-for-scenario"
    }
  };
  const envelopeFor = (payload) => JSON.stringify({
    schemaVersion: "ofw.namespaced-storage.v1",
    scenarioContext: context,
    payload
  });
  const evaluate = (payload) => {
    const sandbox = {
      localStorage: { getItem: () => envelopeFor(payload) },
      encodeURIComponent,
      SCENARIO_ID: "S002",
      SCENARIO_VERSION: "S002-v1",
      SCENARIO_RUN_ID: context.scenarioRunId,
      SCENARIO_FORMED_AT: context.formedAt,
      SCENARIO_STATUS: context.status,
      S002_HISTORY_READ_ONLY: false,
      scenario: context,
      sameScenarioContext(left, right) {
        return ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => left?.[field] === right?.[field]);
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(`${sharedApp.slice(helperStart, helperEnd)}; result=s002M01AdoptionEvidence("S002-DATA-v1", scenario);`, sandbox);
    return JSON.parse(JSON.stringify(sandbox.result));
  };

  const claimOnly = evaluate(owner);
  assert.equal(claimOnly.claimPresent, true, "应保留同轮T019声明供核对");
  assert.equal(claimOnly.ready, false, "只有Published/T019声明不得显示消费就绪");
  assert.ok(claimOnly.issues.some((item) => /C003/.test(item)), "缺少C003回执时必须给出证据问题");
  assert.ok(claimOnly.issues.some((item) => /目标 Draft/.test(item)), "缺少目标Draft绑定时必须给出证据问题");

  const complete = evaluate({
    ...owner,
    c003Receipt: {
      sourceModule: "本体管理",
      contractCode: "C003",
      status: "accepted",
      deliveryId: "C003-S002-DATA-v1",
      t007Version: "S002-DATA-v1",
      componentAssets: [{ version: "S002-BUDGET-EXEC-v1" }, { version: "S002-PROJECT-OCC-v1" }],
      scenarioContext: context
    },
    targetDraftBinding: {
      deliveryId: "C003-S002-DATA-v1",
      assetVersion: "S002-DATA-v1",
      componentAssetVersions: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
      targetDraftId: "DRAFT-S002-BUDGET-v1",
      targetDraftRevision: 1
    }
  });
  assert.equal(complete.ready, true, "同轮C003回执和目标Draft精确绑定完整时才可消费");

  const projectionStart = sharedApp.indexOf("  function projectS002OwnerRun(");
  const projectionEnd = sharedApp.indexOf("\n  let flow = projectS002OwnerRun", projectionStart);
  const projectionSource = sharedApp.slice(projectionStart, projectionEnd);
  assert.equal(/refreshStatus:\s*"adopted"/.test(projectionSource), false, "Owner投影不得无条件写死adopted");
  for (const token of [
    "const consumptionReady=adoptionEvidence.ready",
    'refreshStatus: consumptionReady?"adopted":"evidence-pending"',
    'node.key==="refresh"&&!consumptionReady?"waiting-confirmation":"success"',
    'label:"历史采用声明 · 待证据核对"',
    "ownerProjectionAdoptionEvidence: {",
    "c003Receipt:copy(adoptionEvidence.c003Receipt||null)",
    "targetDraftBinding:copy(adoptionEvidence.targetDraftBinding||null)",
    'projected?.ready===true&&(version?.id===projected.dataAssetVersion||projectedComponentVersions.includes(version?.id))',
    'evidenceLocator:`M01 Owner State / ${projected.c003Receipt?.deliveryId||"C003"}'
  ]) assert.ok(sharedApp.includes(token), `M02刷新门条件投影缺少：${token}`);
  assert.ok(adapter.includes('consumptionLabel: adoption.ready ? "可消费（演示数据）" : "已发布 · 待 M01 联合证据核对"'), "M02资源页消费状态未与M01联合证据同步");
});

test("M02历史只读只接受父工作台同轮Owner envelope，不回退活动localStorage", function () {
  const sharedApp = read(sharedAppRef);
  const helperStart = sharedApp.indexOf("  function readS002ModuleOwnerEnvelope(");
  const helperEnd = sharedApp.indexOf("  function s002M01AdoptionEvidence(", helperStart);
  assert.ok(helperStart > -1 && helperEnd > helperStart);

  const context = {
    scenarioId: "S002",
    scenarioVersion: "S002-v1",
    scenarioRunId: "S002-RUN-HISTORY-TEST",
    formedAt: "2026-08-15T08:00:00.000Z",
    status: "historical-readonly"
  };
  const owner = { moduleId: "M02", moduleVersion: "S002-M02-1.0.0" };
  const envelope = (overrides = {}) => ({
    schemaVersion: "ofw.namespaced-storage.v1",
    scenarioContext: { ...context, ...overrides },
    payload: owner
  });
  const evaluate = ({ parent = null, local = envelope(), status = context.status } = {}) => {
    const sandbox = {
      SCENARIO_ID: context.scenarioId,
      SCENARIO_VERSION: context.scenarioVersion,
      SCENARIO_RUN_ID: context.scenarioRunId,
      SCENARIO_FORMED_AT: context.formedAt,
      SCENARIO_STATUS: status,
      S002_HISTORY_READ_ONLY: ["historical-readonly", "closed"].includes(status),
      encodeURIComponent,
      window: { __S002_PARENT_OWNER_STATES: parent ? { m02: parent } : null },
      localReads: 0
    };
    sandbox.localStorage = {
      getItem() {
        sandbox.localReads += 1;
        return JSON.stringify(local);
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(`${sharedApp.slice(helperStart, helperEnd)}; result=readS002ModuleOwnerEnvelope("m02","M02","S002-M02-1.0.0");`, sandbox);
    return { result: sandbox.result ? JSON.parse(JSON.stringify(sandbox.result)) : null, localReads: sandbox.localReads };
  };

  const missingParent = evaluate();
  assert.equal(missingParent.result, null);
  assert.equal(missingParent.localReads, 0, "历史只读不得读取活动localStorage");

  for (const mismatch of [
    { scenarioRunId: "S002-RUN-OTHER" },
    { formedAt: "2026-08-15T09:00:00.000Z" },
    { status: "active" }
  ]) {
    const rejected = evaluate({ parent: envelope(mismatch) });
    assert.equal(rejected.result, null, `应拒绝不匹配的历史Owner envelope：${JSON.stringify(mismatch)}`);
    assert.equal(rejected.localReads, 0);
  }

  const accepted = evaluate({ parent: envelope() });
  assert.equal(accepted.result.owner.moduleId, "M02");
  assert.equal(accepted.result.bound.scenarioRunId, context.scenarioRunId);
  assert.equal(accepted.localReads, 0);

  const liveContext = { ...context, status: "active" };
  const liveEnvelope = {
    schemaVersion: "ofw.namespaced-storage.v1",
    scenarioContext: liveContext,
    payload: owner
  };
  const live = evaluate({ status: "active", local: liveEnvelope });
  assert.equal(live.result.owner.moduleId, "M02");
  assert.equal(live.localReads, 1, "活动运行可读取自身命名空间Owner State");
});

test("M02普通新运行无Published证据时进入准备Draft，只有显式历史身份缺失才报错", function () {
  const sharedApp = read(sharedAppRef);
  const ensureStart = sharedApp.indexOf("  function ensureCanvas(id)");
  const ensureEnd = sharedApp.indexOf("  function openPublishedDefinition", ensureStart);
  const canvasStart = sharedApp.indexOf("  function canvasPage(id)");
  const canvasEnd = sharedApp.indexOf("  function canvasToolbar", canvasStart);
  assert.ok(ensureStart > -1 && ensureEnd > ensureStart && canvasStart > -1 && canvasEnd > canvasStart);
  const ensureSource = sharedApp.slice(ensureStart, ensureEnd);
  const canvasSource = sharedApp.slice(canvasStart, canvasEnd);
  assert.ok(ensureSource.includes("if(historyDefinition&&!published) return null;"));
  assert.ok(ensureSource.includes("if(S002_HISTORY_READ_ONLY&&scenarioDefinition&&!published)return null;"));
  assert.ok(ensureSource.includes('else ui.canvas = makeCanvas(id, "five")'));
  assert.ok(canvasSource.includes("正在读取历史管道证据"));
  assert.ok(canvasSource.includes("历史生产证据不可定位"));
});
