"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { createRuntime, scenarioRoot } = require("./runtime-harness.cjs");

function read(relative) {
  return fs.readFileSync(path.join(scenarioRoot, relative), "utf8");
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadM01PublishedVersion(runId = "S002-RUN-SEMANTIC-TEST") {
  const localStorage = memoryStorage();
  const sandbox = {
    URLSearchParams,
    localStorage,
    location: {
      search: `?scenarioId=S002&scenarioVersion=S002-v1&scenarioRunId=${runId}&m02AssetPublished=1&m01MappingApplied=1&m01OntologyPublished=1&m01Ready=1`,
      hash: "#published",
      pathname: "/scenarios/s002/baseline-adapters/ontology-management-review/canvas-first/index.html",
      origin: "http://127.0.0.1:4353"
    },
    history: { replaceState() {} },
    window: { addEventListener() {} },
    document: { documentElement: { dataset: {} } },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(read("baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js"), sandbox);
  const state = JSON.parse(localStorage.getItem("ontology3-canvas-first-review-v17"));
  return state.publishedVersions.find((version) => version.id === "SEM-S002-BUDGET-v1");
}

function loadM03Domain({ scenarioId = "S002", runId = "S002-RUN-SEMANTIC-TEST", ontologyPublished = true, status = "active", mode = "live", storedProjection = undefined } = {}) {
  const scenarioContext = {
    scenarioId,
    scenarioVersion: scenarioId === "S002" ? "S002-v1" : "S001-v1",
    scenarioRunId: runId,
    formedAt: "2026-08-15T08:00:00.000Z",
    status
  };
  const defaultProjection = scenarioId === "S002" ? {
    projectionId: "ontology3-c008-authoritative-projection-v1",
    projectionVersion: "1",
    schemaVersion: 1,
    formedAt: "2026-08-15T08:00:00.000Z",
    sourceModule: "本体管理",
    contractCode: "C008",
    readStatus: "available",
    scenarioContext,
    current: {
      ontologyStableId: "ONT-S002-BUDGET-SUPERVISION",
      semanticVersionId: "SEM-S002-BUDGET-v1",
      semanticVersion: "S002-ONTO-v1",
      dataVersion: "S002-DATA-v1",
      asOf: "2025-12-31",
      switchedAt: "2026-08-15 16:00:00",
      t019: { recordId: "T019-S002-v1", evidenceId: "EV-T019-S002-v1" }
    }
  } : null;
  const projection = storedProjection === undefined ? defaultProjection : storedProjection;
  const localStorage = memoryStorage(projection ? { "ontology3-c008-authoritative-projection-v1": projection } : {});
  const m02 = {
    moduleId: "M02",
    progress: { dataConnected: true, qualityPassed: true, assetPublished: true },
    sourceSnapshot: { snapshotId: "S002-SOURCE-SNAPSHOT-v1" },
    qualityReceipt: { receiptId: "S002-QUALITY-RECEIPT-v1", status: "passed-for-demo", formedAt: "2026-08-15T08:01:00.000Z", disclaimer: "演示加工通过，不等于生产数据验收。" },
    dataAsset: { assetId: "S002-DATA-ASSET", version: "S002-DATA-v1", status: "published-for-scenario", asOf: "2025-12-31", formedAt: "2026-08-15T08:02:00.000Z" }
  };
  const parent = { S002_STORE: {
    get: () => ({ context: scenarioContext, mode, progress: { ontologyPublished, dataConnected: true, qualityPassed: true, assetPublished: true } }),
    exportOwnedState: () => ({ scenarioContext, mode, modules: { m02 } })
  } };
  const window = { parent };
  const sandbox = {
    window,
    localStorage,
    location: { search: `?scenarioId=${scenarioId}&scenarioVersion=${scenarioContext.scenarioVersion}&scenarioRunId=${runId}&status=${status}` },
    URLSearchParams,
    Intl,
    Date,
    Math,
    JSON,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/data.jsx"), sandbox);
  return window.IQDomain;
}

test("S002统一壳层按模块加载独立v1.0.3场景适配入口", function () {
  const app = read("app.js");
  const moduleApp = read("module-app.js");
  const moduleHtml = read("module.html");
  for (const token of ["platform-shell", "global-nav", "global-topbar", "route-stage", "module-frame"]) {
    assert.ok(app.includes(token), `缺少基线壳层结构 ${token}`);
  }
  const runtime = createRuntime({ startIso: "2026-08-15T04:50:00.000Z", randomSeed: 129 });
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.data.nav.map((item) => item.route))), ["#home", "#module/data", "#module/ontology", "#module/query", "#module/decision", "#module/agent", "#module/report", "#dashboard"]);
  assert.ok(app.includes("#module/${module.id}"), "模块导航未使用统一基线路由模板");
  assert.equal(app.includes("module.html?"), false, "正式入口仍指向旧统一 module.html");
  for (const entry of [
    "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html",
    "baseline-adapters/ontology-management-review/canvas-first/index.html",
    "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    "baseline-adapters/m04/decision-center-prototype/index.html",
    "baseline-adapters/m05/agent-application/Agent应用.html",
    "baseline-adapters/m06/report-center/review-lifecycle/index.html"
  ]) assert.ok(app.includes(entry), `缺少独立基线入口映射：${entry}`);
  assert.ok(moduleApp.includes("请从 S002 统一工作台进入"), "模块直达未被场景上下文门拦截");
  assert.equal(moduleApp.includes("function moduleRailMarkup"), false, "iframe内仍保留第二套平台rail生成器");
  assert.equal(/app\.innerHTML = [`\"][^`\"]*platform-rail/.test(moduleApp), false, "iframe运行DOM仍生成第二套平台rail");
  assert.ok(moduleHtml.includes("styles.css?v=S002-20260815-4"));
  assert.ok(moduleHtml.includes("module-app.js?v=S002-20260815-4"));
});

test("模块页保留v1.0.3统一一级导航与各模块产品导航", function () {
  const app = read("app.js");
  const css = read("styles.css");
  assert.equal(app.includes('frameRoute ? "frame-route" : ""'), false, "模块路由仍主动切换到隐藏一级导航的frame-route");
  assert.equal(css.includes(".platform-shell.frame-route > .global-nav"), false, "模块路由仍通过CSS隐藏统一一级导航");
  assert.ok(app.includes('class="brand-mark brand-mark-ai" aria-hidden="true"'), "品牌标记未恢复v1.0.3可访问性结构");
  assert.ok(app.includes("brain-mesh-outline") && app.includes("brain-mesh-edge") && app.includes("brain-mesh-seam"), "品牌未恢复v1.0.3点阵神经网络脑形");
  assert.equal((app.match(/brain-mesh-node/g) || []).length, 24, "品牌脑形节点数量未与v1.0.3一致");
  for (const hash of ['data: "#/resources"', 'ontology: "#published/version?id=SEM-S002-BUDGET-v1&tab=canvas"', 'query: "#/ask"', 'decision: "#workbench"', 'agent: "#/runs"', 'report: "#/lifecycle"']) {
    assert.ok(app.includes(hash), `缺少v1.0.3模块初始路由：${hash}`);
  }
  assert.ok(app.includes(".app-workspace > .topbar .data-context"), "M03专属语义上下文入口适配缺失");
  assert.ok(app.includes(".decision-app > .product-nav"), "M04专属产品导航适配缺失");
  assert.ok(app.includes(".app-shell > .workspace"), "M05专属workspace适配缺失");
  assert.ok(app.includes(".app-workspace > .topbar .mobile-nav-toggle"), "M06窄屏抽屉导航适配缺失");
  assert.ok(app.includes(".app-shell > .platform-rail { display:none!important; }"), "嵌入模块未隐藏模块自身的平台级rail");
  assert.ok(app.includes("function mobileProductNavFixCss"), "M02/M01/M05移动端产品导航修复缺失");
  assert.ok(app.includes(".app-shell > .product-nav { width:auto!important; min-width:0!important; display:flex!important;"), "移动端产品导航仍可能被隐藏");
  assert.ok(app.includes('event.data.type === "submit-dashboard-action"'), "预算驾驶舱预警未桥接M04 Owner State");
  assert.equal(app.includes('const roots = ["body>.app-shell"'), false, "六模块仍使用统一通用适配模板");
});

test("品牌SVG与六模块frameAdapterCss逐字复用v1.0.3基线", function () {
  const app = read("app.js");
  const baselineCandidates = [
    path.resolve(scenarioRoot, "../../../../prototype-releases/v1.0.3/s001-e2e-integration/app.js"),
    "/Users/domi/Public/Vibecoding/ontology3.0/designs/prototype-releases/v1.0.3/s001-e2e-integration/app.js"
  ];
  const baselinePath = baselineCandidates.find((candidate) => fs.existsSync(candidate));
  if (!baselinePath) {
    // Portable Windows packages intentionally do not carry the immutable parent
    // baseline. In that mode, retain a structural proof in the package test;
    // the exact byte-for-byte comparison runs in the source workspace.
    assert.ok(app.includes("brainCircuit:"), "缺少基线品牌 brainCircuit 结构");
    assert.ok(app.includes("function frameAdapterCss"), "缺少基线 frameAdapterCss 结构");
    return;
  }
  const baseline = fs.readFileSync(baselinePath, "utf8");
  const line = (source, marker) => source.split("\n").find((item) => item.includes(marker));
  const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))).trim();
  assert.equal(line(app, "brainCircuit:"), line(baseline, "brainCircuit:"), "品牌brainCircuit SVG与v1.0.3不一致");
  assert.equal(
    section(app, "  function frameAdapterCss", "  function adaptFrame"),
    section(baseline, "  function frameAdapterCss", "  function installFrameAdapter"),
    "六模块frameAdapterCss未逐字复用v1.0.3专属适配规则"
  );
});

test("file预览显示HTTP启动门且公共normalize不覆盖模块专属导航", function () {
  const app = read("app.js");
  const frameCss = read("baseline-adapters/s002-frame-normalize.css");
  assert.ok(app.includes('window.location.protocol === "file:"'), "file协议未被显式识别");
  assert.ok(app.includes('data-protocol-gate="http-required"'), "file协议没有HTTP启动提示门");
  assert.ok(app.includes("python3 -m http.server 4332 --directory designs/prototype-work/v1.1.0"), "HTTP启动提示缺少可执行命令");
  assert.equal(frameCss.includes(".platform-rail"), false, "公共normalize仍覆盖模块平台rail");
  assert.equal(frameCss.includes(".product-nav"), false, "公共normalize仍覆盖模块产品导航");
  assert.equal(frameCss.includes(".topbar"), false, "公共normalize仍覆盖模块topbar");
  assert.ok(frameCss.includes("Module-specific navigation and responsive behavior"), "公共normalize未声明逐模块适配边界");
  for (const entry of [
    "baseline-adapters/ontology-management-review/canvas-first/index.html",
    "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html",
    "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    "baseline-adapters/m04/decision-center-prototype/review-v2/action-portfolio.html",
    "baseline-adapters/m05/agent-application/Agent应用.html",
    "baseline-adapters/m06/report-center/review-lifecycle/index.html"
  ]) assert.ok(read(entry).includes("s002-frame-normalize.css"), `${entry}未加载场景内壳层整理样式`);

});

test("预算指标在M01/M03/M06保持同一语义", function () {

  const m01 = read("baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js");
  const m03 = read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/s002-adapter.js");
  const m03Data = read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/data.jsx");
  const m06 = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  assert.ok(m01.includes('"预算差异额", "万元"'), "M01预算差异仍使用旧百分比口径");
  assert.ok(m01.includes('["RULE-S002-COST-TO-REVENUE", "RULE-003", "成本占收比异常"'), "M01未绑定当前RULE-003语义");
  assert.ok(m03Data.includes('"RULE-003": "RULE-S002-COST-TO-REVENUE"'), "M03未按稳定ID消费当前RULE-003语义");
  assert.ok(m03.includes('status: "需关注"') && m03Data.includes('s002Rule("RULE-S002-COST-TO-REVENUE", "成本占收比异常"'), "M03缺少成本占收比正式语义与结果状态");
  assert.equal(m03.includes("RULE-S002-ACCRUAL-VARIANCE") || m03Data.includes("RULE-S002-ACCRUAL-VARIANCE"), false, "M03仍把跨年计提配对作为正式Rule资源");
  assert.ok(m06.includes("成本占收比异常") && m06.includes("EVAL-ACCRUAL-001"), "M06未区分RULE-003与跨年计提质量核验");
  assert.ok(m01.includes("供应商服务人员人月成本差异") && m01.includes("采购净额÷人月"), "M01未绑定当前RULE-005语义");
  for (const value of ["1,097.70", "861.73", "78.50", "74.35", "25.65", "163.38", "8.59", "14.35"]) assert.ok(m03.includes(value), `M03缺少统一场景值 ${value}`);
  for (const value of ["费用预算 1,097.70 万元", "实际费用 861.73 万元", "163.38 万元", "正向 PR 8.59% / 净在途 14.35%", "executionRate: 78.50"]) assert.ok(m06.includes(value), `M06缺少统一场景值 ${value}`);
  assert.ok(m06.includes('status: item.rule.status || "命中"'), "M06把已评估无命中的单位强制改写为Rule命中");
  assert.equal(m03.includes("486.20"), false, "M03仍保留旧净在途占用");
  assert.equal(m03.includes("38.60"), false, "M03仍保留旧采购集中度");
  assert.equal(m06.includes("费用 1,097.70 万元；实际 962.31 万元"), false, "M06仍保留旧实际费用事实");
  assert.equal(m06.includes("正向 PR 12.60% / 净在途 14.98%"), false, "M06仍保留旧年末集中度事实");
});

test("M03只读消费M01完整Published预算资源并统一长短稳定ID", function () {
  const m01 = loadM01PublishedVersion();
  assert.deepEqual(
    [m01.objects.length, m01.properties.length, m01.links.length, m01.metrics.length, m01.rules.length, m01.actions.length],
    [7, 62, 8, 9, 5, 6]
  );

  const domain = loadM03Domain();
  assert.equal(domain.ACTIVE_ONTOLOGY_ID, "ONT-S002-BUDGET-SUPERVISION");
  assert.equal(domain.HANDOFF_CHANNEL, "ontology3.0-s002-handoff-v1");
  const projection = domain.readAuthoritativeProjection();
  const publishedResponse = domain.readPublishedContextResponse(projection);
  assert.equal(publishedResponse.ready, true);
  assert.equal(publishedResponse.fallback, true, "M01页面不驻留时应使用统一工作台只读Published投影");
  const semantic = domain.readPublishedOntologyContext();
  const binding = domain.readOntologyBindingContext();
  const runtime = domain.readRuntimeContext();
  assert.equal(semantic.ready, true, semantic.reason);
  assert.equal(binding.ready, true, binding.reason);
  assert.equal(binding.versionId, "SEM-S002-BUDGET-v1");
  assert.equal(binding.semanticVersion, "S002-ONTO-v1");
  assert.equal(binding.dataVersion, "S002-DATA-v1");
  assert.equal(binding.asOf, "2025-12-31");
  assert.equal(binding.t019RecordId, "T019-S002-v1");
  assert.equal(binding.t019EvidenceCode, "EV-T019-S002-v1");
  assert.equal(runtime.ready, true, runtime.reason);
  assert.equal(runtime.status, "带警告可消费");
  assert.deepEqual(
    ["Object Type", "Property", "Link Type", "Metric", "Rule", "Action Type"].map((type) => semantic.resources.filter((item) => item.type === type).length),
    [7, 62, 8, 9, 5, 6]
  );

  const m03ById = Object.fromEntries(plain(semantic.resources).map((item) => [item.id, item]));
  for (const metric of m01.metrics) {
    const actual = m03ById[metric.id];
    assert.ok(actual, `M03缺少M01 Metric ${metric.id}`);
    assert.deepEqual(
      plain({ name: actual.name, unit: actual.unit, calculation: actual.calculation, definition: actual.definition, dependencyIds: actual.dependencyIds, scope: actual.scope, time: actual.time, zeroHandling: actual.zeroHandling }),
      plain({ name: metric.name, unit: metric.unit, calculation: metric.calculation, definition: metric.definition, dependencyIds: metric.dependencyIds, scope: metric.scope, time: metric.time, zeroHandling: metric.zeroHandling })
    );
  }
  for (const rule of m01.rules) {
    const actual = m03ById[rule.id];
    assert.ok(actual, `M03缺少M01 Rule ${rule.id}`);
    assert.deepEqual(
      plain({ name: actual.name, condition: actual.condition, dependencyIds: actual.dependencyIds, scope: actual.scope }),
      plain({ name: rule.name, condition: rule.condition, dependencyIds: rule.dependencyIds, scope: rule.appliesTo })
    );
  }
  for (const action of m01.actions) {
    const actual = m03ById[action.id];
    assert.ok(actual, `M03缺少M01 Action Type ${action.id}`);
    assert.deepEqual(
      plain({ name: actual.name, dependencyIds: actual.dependencyIds, result: actual.result, confirmation: actual.confirmation, definition: actual.definition, scope: actual.scope }),
      plain({ name: action.name, dependencyIds: action.ruleIds, result: action.result, confirmation: action.confirmation, definition: action.definition, scope: action.target })
    );
  }

  const aliases = Object.entries(plain(domain.S002_RESOURCE_ID_ALIASES));
  const actionResources = plain(domain.S002_RESOURCES).filter((item) => item.type === "Action Type");
  assert.deepEqual(actionResources.map((item) => item.actionTypeId), ["ACT-BUDGET-EXECUTION-RECTIFICATION", "ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW", "ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW", "ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT", "ACT-PROCUREMENT-COMMITMENT-CLEANUP", "ACT-SUPPLIER-PRICE-REVIEW"]);
  assert.deepEqual(actionResources.map((item) => item.legacyCompatibleId), ["ACT-BUDGET-INCREASE", "ACT-BUDGET-DECREASE", "ACT-SUBJECT-TRANSFER", "ACT-SUBMISSION-RETURN", "ACT-RELEASE-COMMITMENT", "ACT-PRICE-REVIEW"]);
  assert.equal(aliases.length, 26, "20个当前短ID与6个旧Action ID均应可解析");
  assert.equal(new Set(aliases.map(([, canonicalId]) => canonicalId)).size, 20, "短ID必须唯一解析到长稳定ID");
  for (const [shortId, canonicalId] of aliases) {
    const actionIdentity = actionResources.find((item) => item.actionTypeId === shortId || item.legacyCompatibleId === shortId);
    assert.equal(domain.canonicalResourceId(shortId), canonicalId);
    assert.equal(domain.canonicalResourceId(canonicalId), canonicalId);
    assert.equal(domain.shortResourceId(canonicalId), actionIdentity?.actionTypeId || shortId);
    assert.equal(domain.resourceFromContext(semantic, shortId)?.id, canonicalId);
  }

  const initialState = domain.createInitialState();
  assert.equal(initialState.currentScenario, "S002");
  assert.equal(initialState.scenarioContext.name, "预算监督管理");
  assert.equal(initialState.activeConfig.allowedResources.length, 97);
  assert.equal(domain.deriveConfigRuntimeState(initialState.activeConfig, runtime, binding).status, "兼容");

  const financingDomain = loadM03Domain({ scenarioId: "S001", runId: "S001-RUN-SEMANTIC-TEST" });
  assert.equal(financingDomain.ACTIVE_ONTOLOGY_ID, "ONT-GROUP-FINANCING-OPTIMIZATION");
  assert.equal(financingDomain.HANDOFF_CHANNEL, "ontology3.0-s001-handoff-v1");
  assert.equal(financingDomain.canonicalResourceId("MET-FIN-BALANCE"), "MET-FINANCING-BALANCE");
});

test("M03在CP07历史只读查看中仍消费同轮Published资源但不恢复写权限", function () {
  const domain = loadM03Domain({
    runId: "S002-RUN-HISTORICAL-SEMANTIC-TEST",
    status: "historical-readonly",
    mode: "historical"
  });
  const projection = domain.readAuthoritativeProjection();
  const publishedResponse = domain.readPublishedContextResponse(projection);
  const semantic = domain.readPublishedOntologyContext();
  assert.equal(publishedResponse.ready, true);
  assert.equal(publishedResponse.historicalReadonly, true);
  assert.equal(publishedResponse.source, "S002_CHECKPOINT_READ_ONLY_PUBLISHED_PROJECTION");
  assert.equal(semantic.ready, true, semantic.reason);
  assert.equal(semantic.resources.length, 97);
  assert.equal(semantic.scenarioRunId, "S002-RUN-HISTORICAL-SEMANTIC-TEST");
  assert.equal(semantic.scenarioStatus, "historical-readonly");
});

test("M03以当前S002同轮Owner State隔离旧C008缓存，未Published时不伪装就绪", function () {
  const staleProjection = {
    projectionId: "ontology3-c008-authoritative-projection-v1",
    projectionVersion: "stale-s001",
    schemaVersion: 1,
    formedAt: "2026-08-14T08:00:00.000Z",
    sourceModule: "本体管理",
    contractCode: "C008",
    readStatus: "available",
    scenarioContext: { scenarioId: "S001", scenarioVersion: "S001-v1", scenarioRunId: "S001-RUN-STALE", formedAt: "2026-08-14T08:00:00.000Z", status: "active" },
    current: { ontologyStableId: "ONT-GROUP-FINANCING-OPTIMIZATION", semanticVersionId: "SEM-S001", semanticVersion: "S001-ONTO-v1", dataVersion: "S001-DATA-v1", asOf: "2025-12-31", switchedAt: "2026-08-14T08:00:00.000Z", t019: { recordId: "T019-S001", evidenceId: "EV-T019-S001" } }
  };
  const completed = loadM03Domain({ runId: "S002-RUN-CURRENT", ontologyPublished: true, storedProjection: staleProjection });
  const projection = completed.readAuthoritativeProjection();
  const semantic = completed.readPublishedOntologyContext();
  assert.equal(projection.ready, true);
  assert.equal(projection.source, "S002_SCENARIO_PACKAGE_READ_ONLY_PROJECTION");
  assert.equal(projection.ownerStateVerified, true);
  assert.equal(projection.ignoredStoredProjection, "共享C008不作为S002当前轮次真值");
  assert.equal(semantic.ready, true, semantic.reason);
  assert.equal(semantic.resources.length, 97);

  const incomplete = loadM03Domain({ runId: "S002-RUN-NOT-PUBLISHED", ontologyPublished: false, storedProjection: staleProjection });
  const blocked = incomplete.readAuthoritativeProjection();
  assert.equal(blocked.ready, false);
  assert.equal(blocked.status, "Published未形成");
  assert.match(blocked.reason, /尚未完成Published切换/);
});

test("M03结构化结果区分8.59%采购发起、14.35%总体观察与18.9437%正式命中", function () {
  const adapter = read("baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/s002-adapter.js");
  const start = adapter.indexOf("function queryResultMarkup");
  const end = adapter.indexOf("function ensureQueryResultStyle", start);
  const markupSource = adapter.slice(start, end);
  assert.ok(markupSource.includes('"MET-S002-DEC-POSITIVE-PURCHASE-SHARE", "采购集中", "12月正向采购发起占比", (positivePrShare * 100).toFixed(2)'));
  assert.ok(markupSource.includes('"MET-S002-YEAR-END-OCCUPANCY-CONCENTRATION", "组合总体", "12月净在途占用占比", (budgetOccupancyShare * 100).toFixed(2)'));
  assert.ok(markupSource.includes('positivePrShare >= 0.1 ? "需关注" : "可计算"'), "8.59%行仍错误复用净在途阈值");
  assert.ok(markupSource.includes('"总体观察值"'), "14.35%组合值仍被冒充正式Rule命中");
  assert.ok(adapter.includes("18.9437%"), "M03缺少设备项目粒度的RULE-004正式命中精确值");
  assert.ok(markupSource.includes('data-s002-resource-id="${esc(row[0])}"'), "结果行未携带可下钻的Published资源身份");
});

test("正式运行页面不再展示场景适配说明、顶部外挂或浮动标识", function () {
  const shell = read("app.js");
  const runtimeFiles = [
    "baseline-adapters/ontology-management-review/canvas-first/s002-adapter.js",
    "baseline-adapters/data-engineering-prototype-review/review-v3/s002-adapter.js",
    "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/s002-adapter.js",
    "baseline-adapters/m04/s002-adapter.js",
    "baseline-adapters/m05/agent-application/s002-adapter.js",
    "baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js"
  ];
  const forbidden = ["本体场景适配", "数据工程场景适配", "智能问数场景适配", "报告中心 / 预算驾驶舱适配", "v1.0.3 基线适配", "本适配层"];
  for (const file of runtimeFiles) {
    const content = read(file);
    for (const phrase of forbidden) assert.equal(content.includes(phrase), false, `${file}仍展示准备阶段说明：${phrase}`);
  }
  assert.equal(shell.includes("复用 v1.0.3 统一工作台结构"), false, "首页仍展示实现过程说明");
  assert.ok(shell.includes("从预算申报、执行到监督分析的完整链路"), "首页缺少预算监督业务目标");
  const m01 = read(runtimeFiles[0]);
  const m02 = read(runtimeFiles[1]);
  const m03 = read(runtimeFiles[2]);
  const m06 = read(runtimeFiles[5]);
  for (const [moduleId, content] of [["M01", m01], ["M02", m02], ["M03", m03]]) {
    for (const token of ["s002-adapter-panel", "s002-adapter-badge", "function panelMarkup", "function ensureBanner"]) {
      assert.equal(content.includes(token), false, `${moduleId}仍创建可见场景外挂：${token}`);
    }
  }
  for (const token of ["s002-budget-context-note", "s002-dashboard-projection", "function addBudgetContextNotice", "function renderDashboardProjection"]) {
    assert.equal(m06.includes(token), false, `M06仍创建可见场景外挂：${token}`);
  }
  assert.ok(m01.includes("function ensureBudgetRuntime"), "M01预算本体运行态投影被误删");
  assert.ok(m01.includes("MET-S002-BUDGET-EXECUTION-RATE"), "M01预算 Metric 投影被误删");
  assert.ok(m01.includes("ACTION-S002-BUDGET-INCREASE"), "M01预算 Action Type 投影被误删");
  assert.ok(m02.includes("function projectOwnerStatus"), "M02 Owner State 原生区域投影被误删");
  assert.ok(m02.includes("data-s002-component-asset") && m02.includes("asset-resource-table tbody"), "M02 原生数据资产卡/列表投影被误删");
  assert.ok(m02.includes("function applyScenarioProjection"), "M02 场景投影调度被误删");
  assert.ok(m03.includes('data-s002-recommendations="M03"'), "M03六个预算问题未进入基线推荐问题区域");
  assert.ok(m03.includes("recommendation-card"), "M03未复用基线推荐卡片");
  assert.ok(m03.includes("预算问数运行结果"), "M03缺少真实预算问数运行结果");
  assert.ok(m06.includes("budgetSupervisionDetails"), "M06缺少预算监督原生明细事实包");
});

test("六个场景入口保留基线DOM锚点并加载独立适配层", function () {
  const entries = {
    M01: ["baseline-adapters/ontology-management-review/canvas-first/index.html", ["id=\"app\"", "app.js", "s002-adapter.js"]],
    M02: ["baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html", ["class=\"app-shell\"", "resource-board", "canvas-workbench", "s002-adapter.js"]],
    M03: ["baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html", ["data-workspace=\"conversation\"", "app.jsx", "components.jsx"]],
    M04: ["baseline-adapters/m04/decision-center-prototype/index.html", ["review-v2/action-portfolio.html", "正在进入决策中心"]],
    M05: ["baseline-adapters/m05/agent-application/Agent应用.html", ["AGENT_WORKSPACE", "app.css", "data.jsx"]],
    M06: ["baseline-adapters/m06/report-center/review-lifecycle/index.html", ["报告中心", "data.js", "app.js"]]
  };
  for (const [moduleId, [entry, anchors]] of Object.entries(entries)) {
    const content = read(entry);
    for (const anchor of anchors) assert.ok(content.includes(anchor), `${moduleId}缺少基线锚点或适配入口：${anchor}`);
  }
  for (const [file, anchors] of [
    ["baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/app.jsx", ["workspace-grid", "composer"]],
    ["baseline-adapters/m04/decision-center-prototype/review-v2/action-portfolio.html", ["DC_VARIANT"]],
    ["baseline-adapters/m04/decision-center-prototype/review-v2/shared/app.jsx", ["screen-stage", "DecisionTopbar"]],
    ["baseline-adapters/m05/agent-application/components.jsx", ["AppShell"]],
    ["baseline-adapters/m05/agent-application/app.jsx", ["data-table-wrap", "data-table"]]
  ]) {
    const content = read(file);
    for (const anchor of anchors) assert.ok(content.includes(anchor), `基线文件 ${file} 缺少锚点：${anchor}`);
  }
  assert.equal(fs.existsSync(path.join(scenarioRoot, "baseline-adapters/m01/index.html")), false, "禁止回退到统一 m01 模板");
  assert.equal(fs.existsSync(path.join(scenarioRoot, "baseline-adapters/m02/index.html")), false, "禁止回退到统一 m02 模板");
});

test("六模块运行入口与基线副本一一映射，M05/M06场景状态不串线", function () {
  const app = read("app.js");
  const entries = [
    "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html",
    "baseline-adapters/ontology-management-review/canvas-first/index.html",
    "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    "baseline-adapters/m04/decision-center-prototype/index.html",
    "baseline-adapters/m05/agent-application/Agent应用.html",
    "baseline-adapters/m06/report-center/review-lifecycle/index.html"
  ];
  assert.equal(new Set(entries).size, 6, "六模块必须拥有不同的运行入口");
  assert.equal((app.match(/module\.html/g) || []).length, 1, "module.html只能作为历史注释证据出现");
  assert.equal(app.includes("module-app.js"), false, "正式运行入口不得引用旧统一 module-app.js");

  const m05 = read("baseline-adapters/m05/agent-application/Agent应用.html");
  assert.ok(m05.includes('<script type="text/babel" src="data.jsx'), "M05必须先初始化基线数据");
  assert.ok(m05.includes('<script type="text/babel" src="s002-adapter.js'), "M05适配器必须在数据初始化后执行");
  assert.ok(m05.indexOf('src="data.jsx') < m05.indexOf('src="s002-adapter.js'), "M05适配器脚本顺序错误");
  assert.ok(m05.includes("ontology3.s002.agent-application.catalog.v1"), "M05缺少S002独立存储命名空间");
  const m05Adapter = read("baseline-adapters/m05/agent-application/s002-adapter.js");
  assert.ok(m05Adapter.includes("window.AGENT_APP_INITIAL_STATE = initial"), "M05未替换活动初始投影");
  assert.ok(m05Adapter.includes("window.AGENT_PROMPTS = budgetPrompts"), "M05仍把S001 Prompt作为活动目录");

  const m06 = read("baseline-adapters/m06/report-center/review-lifecycle/index.html");
  assert.equal(m06.includes("../../s002-adapter.js"), false, "M06不得加载已停用的第二套主题适配器");
  assert.equal((m06.match(/s002-adapter\.js\?v=[^"']+/g) || []).length, 1, "M06缺少唯一场景适配器");
});

test("场景副本保留各自 v1.0.3 主结构锚点", function () {
  const baselineRoot = path.resolve(scenarioRoot, "../../../../../../../ontology3.0/designs/prototype-releases/v1.0.3");
  const pairs = {
    M01: ["ontology-management-review/canvas-first/index.html", "baseline-adapters/ontology-management-review/canvas-first/index.html", ["id=\"app\"", "app.js", "app.css"]],
    M02: ["data-engineering-prototype-review/review-v3/方案B2.html", "baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html", ["resource-board", "canvas-workbench", "modal-backdrop"]],
    M03: ["intelligent-query-prototype/review-next/conversation-workspace/index.html", "baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html", ["data-workspace=\"conversation\"", "app.jsx", "components.jsx"]],
    M04: ["decision-center-prototype/index.html", "baseline-adapters/m04/decision-center-prototype/index.html", ["review-v2/action-portfolio.html", "正在进入决策中心"]],
    M05: ["agent-application/Agent应用.html", "baseline-adapters/m05/agent-application/Agent应用.html", ["AGENT_WORKSPACE", "data.jsx", "components.jsx"]],
    M06: ["report-center/review-lifecycle/index.html", "baseline-adapters/m06/report-center/review-lifecycle/index.html", ["报告中心", "data.js", "app.js"]]
  };
  for (const [moduleId, [sourceRef, targetRef, anchors]] of Object.entries(pairs)) {
    const source = fs.readFileSync(path.join(baselineRoot, sourceRef), "utf8");
    const target = read(targetRef);
    for (const anchor of anchors) {
      assert.ok(source.includes(anchor), `${moduleId}基线缺少预期锚点：${anchor}`);
      assert.ok(target.includes(anchor), `${moduleId}场景副本删除基线锚点：${anchor}`);
    }
  }
});

test("M06覆盖预算执行、申报、项目余额、采购占用、差旅、计提、供应商、异常与报告正文", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T05:00:00.000Z", randomSeed: 130 });
  const data = runtime.data;
  const reportApp = read("baseline-adapters/m06/report-center/review-lifecycle/app.js");
  const reportAdapter = read("baseline-adapters/m06/report-center/review-lifecycle/s002-adapter.js");
  const m06Runtime = `${reportApp}\n${reportAdapter}`;
  assert.equal(data.expenseDetails.length, 96);
  assert.equal(data.travelFacts.length, 6);
  assert.equal(data.accrualPairs.length, 14);
  assert.equal(data.supplierBenchmarks.length, 42);
  assert.ok(Array.isArray(data.supplierBenchmarkGroups) && data.supplierBenchmarkGroups.length > 0);
  assert.equal(data.legalRecordExplanations.length, 3);
  assert.equal(data.expenseDetails.every((row) => row.dataMarker === "SYNTHETIC_FOR_DEMO"), true);
  assert.equal(data.accrualPairs.every((row) => row.variance === 0 && row.dataMarker === "DERIVED_REVERSAL"), true);
  assert.equal(data.annualFacts.every((row) => row.dataMarker === "MIXED_SOURCE_AND_DEMO_MARKERS" && row.fieldMarkers.actualRevenue === "SOURCE" && row.fieldMarkers.actualExpense === "MIXED_SOURCE_AND_DEMO_MARKERS" && row.fieldMarkers.approvedBudget === "SOURCE"), true);
  assert.equal(data.submissionFacts.filter((row) => row.year === 2026).every((row) => row.fieldMarkers.publicExpense === "SYNTHETIC_FOR_DEMO"), true);
  assert.equal(data.occupancy.byProject.every((row) => row.dataMarker === "SOURCE"), true);
  assert.equal(data.ruleHitInputs.every((row) => row.year && row.subjectCategories.length && row.periods.length && row.dataMarker), true);
  assert.equal(data.actionSuggestions.every((row) => row.year && row.subjectCategories.length && row.periods.length && row.dataMarker), true);
  for (const fact of data.annualFacts) {
    const details = data.expenseDetails.filter((row) => row.year === fact.year && row.department === fact.department);
    const budget = details.reduce((sum, row) => sum + row.approvedBudget, 0);
    const actual = details.reduce((sum, row) => sum + row.actual, 0);
    assert.ok(Math.abs(budget - fact.approvedExpenseBudget) < 0.000001, `${fact.year}/${fact.department}预算分摊不守恒`);
    assert.ok(Math.abs(actual - fact.actualExpense) < 0.000001, `${fact.year}/${fact.department}实际分摊不守恒`);
  }
  assert.ok(data.supplierBenchmarks.every((row) => row.budgetSubject === "业务支持费-技术配置" && row.personCategory === "技术服务"));
  assert.ok(data.supplierBenchmarks.every((row) => Math.abs(row.monthlyNetCostRmb - row.netAmountWan * 10000 / row.serviceMonths) < 0.01));
  const exactBoundary = data.supplierBenchmarkGroups.find((row) => row.year === 2026 && row.supplier === "供应商3" && row.level === "初级");
  assert.equal(exactBoundary.maxMinRatio, 1.2);
  assert.equal(exactBoundary.anomaly, false, "最高/最低倍率等于1.2时必须不命中");
  for (const label of ["最终批准预算", "初始申报", "项目可用立项余额", "净在途占用", "供应商价格复核", "年末采购/预算占用集中度", "预算监督明细", "差旅费分析", "跨年计提差异", "供应商/人月成本"]) {
    assert.ok(m06Runtime.includes(label), `M06正式运行入口缺少内容：${label}`);
  }
  for (const filter of ["year", "unit", "subject", "project", "period", "anomaly"]) {
    assert.ok(reportApp.includes(`{ key: "${filter}"`), `缺少${filter}筛选定义`);
  }
  assert.ok(reportApp.includes('data-change="budget-filter"'));
  assert.ok(reportApp.includes("filteredBudgetSupervisionRows"));
  assert.ok(reportApp.includes("reset-budget-filters"));
  assert.ok(reportApp.includes("open-budget-detail"));
  assert.ok(reportApp.includes("decisionStatusLabel"));
  assert.ok(reportAdapter.includes("budgetSupervisionDetails"));
});

test("演示加工逐项保留标识且报告草稿与驾驶舱发布边界分离", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T05:10:00.000Z", randomSeed: 131 });
  runtime.store.connectData();
  runtime.store.runQuality();
  runtime.store.publishData();
  runtime.store.applyMapping();
  runtime.store.publishOntology();
  runtime.store.executeQuestion("Q-EXECUTION");
  runtime.store.runRules();
  runtime.store.submitActions();
  runtime.store.runAgents();
  const report = runtime.store.buildReport();
  const dashboard = runtime.store.publishDashboard();
  assert.equal(report.status, "draft");
  assert.equal(report.formalArtifactPublished, false);
  assert.equal(report.t049Ref, null);
  assert.equal(report.departmentSections.length, 3);
  assert.equal(report.departmentSections.every((section) => section.sections.length === 6), true);
  assert.equal(dashboard.status, "published");
  assert.equal(dashboard.owner, "M06");
  assert.equal(report.contentSnapshot.c018.fixedView.annualFacts.every((row) => row.dataMarker), true);
  assert.equal(report.contentSnapshot.c019.actionRequests.every((row) => row.dataMarker && row.year && row.subjectCategories.length && row.periods.length), true);
  assert.equal(runtime.data.legalRecordExplanations.some((row) => row.dataMarker === "CORRECTED"), true);
  assert.equal(runtime.data.projects.filter((row) => row.netInTransitDataMarker === "IMPUTED_ZERO").length, 18);
});

test("桌面、窄屏和移动端样式均保留基线响应式断点", function () {
  const css = read("styles.css");
  for (const width of [1180, 900, 760, 520]) assert.ok(css.includes(`@media (max-width: ${width}px)`));
  assert.ok(css.includes(".report-section-grid { grid-template-columns: 1fr; }"));
  assert.ok(css.includes(".dashboard-filters { width: 100%; flex-wrap: wrap; }"));
  assert.ok(css.includes(".s002-module-shell > .product-nav { display: none; }"));
});

test("统一工作台进入窄屏时自动收起主菜单，避免移动端遮挡模块内容", function () {
  const app = read("app.js");
  assert.ok(app.includes('window.matchMedia("(max-width: 1024px)")'));
  assert.ok(app.includes("collapseOnNarrowViewport"));
  assert.ok(app.includes('localStorage.setItem(SHELL_NAV_KEY, "true")'));
});
