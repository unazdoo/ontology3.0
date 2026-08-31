import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const workRoot = path.resolve(root, "../..");
const repositoryRoot = path.resolve(workRoot, "../../..");
const frozenRoot = path.join(repositoryRoot, "designs/prototype-releases/v1.1.0/dashboard");
const read = (file) => fs.readFileSync(file, "utf8");

function loadData(file) {
  const context = vm.createContext({ console });
  context.window = context;
  vm.runInContext(read(file), context, { filename: file });
  return JSON.parse(JSON.stringify(context.DASHBOARD_DATA));
}

function normalizeBaselinePaths(value) {
  if (typeof value === "string") return value.replaceAll("../../../../prototype-releases/v1.1.0/", "../");
  if (Array.isArray(value)) return value.map(normalizeBaselinePaths);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeBaselinePaths(item)]));
  return value;
}

const candidate = loadData(path.join(root, "data.js"));
const frozen = loadData(path.join(frozenRoot, "data.js"));
const appSource = read(path.join(root, "app.js"));
const indexSource = read(path.join(root, "index.html"));

test("candidate Dashboard preserves the three frozen business dashboards", () => {
  assert.deepEqual(candidate.dashboards.map((dashboard) => dashboard.id), ["financing", "budget", "risk", "post-investment"]);
  assert.deepEqual(normalizeBaselinePaths(candidate.dashboards.slice(0, 3)), frozen.dashboards);
});

test("S005 Dashboard keeps registration metadata but no fixed evaluation result", () => {
  const post = candidate.dashboards[3];
  assert.equal(post.scenarioId, "S005");
  assert.equal(post.scenarioVersion, "S005-v1");
  assert.equal(Object.hasOwn(post, "scenarioRunId"), false);
  assert.equal(post.status, "等待评价");
  assert.equal(post.period, "等待当前轮次");
  assert.deepEqual(post.metrics, []);
  for (const fixedResultKey of ["sourceSummary", "versionRefs", "products", "marketSeries", "selectionSeries", "riskLamps"])
    assert.equal(Object.hasOwn(post, fixedResultKey), false, `fixed S005 result remains: ${fixedResultKey}`);
  assert.doesNotMatch(JSON.stringify(post), /79|393|0\.42|PRD-|当前正式使用|预置成功|已完成/);
});

test("S005 Dashboard exposes all six evaluation domains and requested metrics", () => {
  for (const token of [
    "产品自身表现", "财务公司实际投资结果", "固定收益风险", "管理与运行质量", "持续准入合规", "选择与执行",
    "TWR", "实际投资 TWR", "MWR / XIRR", "已实现收益", "未实现收益", "现金流", "费用", "Sharpe", "Sortino", "Calmar", "信息比率", "波动", "最大回撤", "回撤恢复",
    "久期", "评级迁移", "集中度", "流动性", "Carry 归因", "Roll-down 归因", "曲线归因", "信用归因", "选择归因", "择时归因",
    "下一可得 NAV", "实际 NAV", "滑点", "结算状态",
  ]) assert(appSource.includes(token), `missing S005 six-domain contract: ${token}`);
  assert.match(appSource, /renderPostInvestment\(current\.tab\)/);
  assert.match(appSource, /缺失指标不补零/);
  assert.match(appSource, /证据下钻/);
  assert.match(appSource, /真实结果、预测结果和模拟结果严格隔离/);
});

test("S005 Dashboard requests and validates current-run evaluation messages", () => {
  for (const token of [
    "OFW_S005_EVALUATION_REQUEST", "OFW_S005_EVALUATION_CONTEXT",
    "scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status",
    "evaluationRun", "evaluationResult", "scored_coverage", "confidence",
    "评价日", "数据截至", "Wind 批次", "事件读取时间", "公式 / 参数版本", "评价状态",
  ]) assert(appSource.includes(token), `missing S005 current-run token: ${token}`);
  assert.doesNotMatch(appSource, /dash\.(?:sourceSummary|marketSeries|selectionSeries|products|riskLamps|versionRefs)/);
});

test("S005 normalizer preserves nulls and rejects cross-run results", () => {
  const context = vm.createContext({
    console,
    location: { hash: "#/view/post-investment/overview", origin: "http://127.0.0.1:4342" },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => ({ innerHTML: "", className: "" }), addEventListener: () => {} },
    setTimeout: () => 0,
  });
  context.window = context;
  context.parent = context;
  context.addEventListener = () => {};
  context.scrollTo = () => {};
  context.__OFW_DASHBOARD_SKIP_RENDER__ = true;
  vm.runInContext(read(path.join(root, "data.js")), context);
  vm.runInContext(appSource, context);
  const api = context.OFW_S005_DASHBOARD_TEST_API;
  const scenarioContext = { scenarioId: "S005", scenarioVersion: "S005-v1", scenarioRunId: "S005-RUN-TEST-001", formedAt: "2026-08-30T09:00:00+08:00", status: "active" };
  assert.equal(api.acceptEvaluationContext({ scenarioContext, evaluationRun: null, evaluationResult: null }), "");
  const pendingDomains = JSON.parse(JSON.stringify(api.normalizedDomains()));
  assert.equal(pendingDomains.length, 6);
  assert.ok(pendingDomains.every((domain) => domain.status.label === "等待评价"));
  assert.match(api.acceptEvaluationContext({ scenarioContext, evaluationRun: null, evaluationResult: { evaluationResultId: "RESULT-WITHOUT-RUN" } }), /不能提供/);
  const error = api.acceptEvaluationContext({
    scenarioContext,
    evaluationRun: { evaluationRunId: "EVAL-001", scenarioContext },
    evaluationResult: {
      evaluationResultId: "RESULT-001",
      evaluationRunId: "EVAL-001",
      scenarioContext,
      statusBar: { dataAsOf: "2026-07-17", scoredCoverage: 0.25, confidence: { score: 0.225, level: "very_low" } },
      domains: {
        productPerformance: {
          domainId: "productPerformance",
          title: "产品自身表现",
          status: "PARTIAL",
          metrics: {
            twr: { value: 1.23, unit: "%", evidenceRefs: ["EV-TWR-001"] },
            sharpe: { value: null, status: "INSUFFICIENT_HISTORY", missingReason: "周快照不能计算日频 Sharpe。" },
            sortino: { value: null, status: "PARTIAL", missingReason: "仅有部分下行收益观察。" },
            calmar: { value: null, status: "NOT_EVALUABLE", missingReason: "缺少足够观察期。" },
          },
        },
        continuingEligibilityCompliance: {
          domainId: "continuingEligibilityCompliance",
          status: "PARTIAL",
          metrics: {
            continuingEligibility: { status: "PARTIAL", value: { eligible: 3, reviewRequired: 1, unknown: 1, displayedProducts: 5, candidateCount: 15 } },
          },
        },
      },
    },
  });
  assert.equal(error, "");
  const domains = JSON.parse(JSON.stringify(api.normalizedDomains()));
  assert.equal(domains.length, 6);
  const performance = domains.find((domain) => domain.id === "product-performance");
  assert.equal(performance.metrics.find((metric) => metric.key === "twr").display, "1.23 %");
  assert.equal(performance.metrics.find((metric) => metric.key === "sharpe").display, "观察期不足");
  assert.equal(performance.metrics.find((metric) => metric.key === "sharpe").missingReasons[0], "周快照不能计算日频 Sharpe。");
  assert.equal(performance.metrics.find((metric) => metric.key === "sortino").display, "部分评价");
  assert.equal(performance.metrics.find((metric) => metric.key === "calmar").display, "无法评价");
  const compliance = domains.find((domain) => domain.id === "continuous-admission-compliance");
  assert.equal(compliance.metrics.find((metric) => metric.key === "continuing-eligibility").display, "准入 3 · 需复核 1 · 未知 1 · 已列示 5/15");
  assert.match(api.acceptEvaluationContext({
    scenarioContext,
    evaluationRun: { evaluationRunId: "EVAL-001", scenarioContext },
    evaluationResult: { evaluationResultId: "RESULT-OTHER", evaluationRunId: "EVAL-OTHER", scenarioContext: { ...scenarioContext, scenarioRunId: "S005-RUN-OTHER" } },
  }), /不一致/);
});

test("candidate Dashboard remains content-only inside the composite Shell", () => {
  assert.doesNotMatch(`${indexSource}\n${appSource}`, /class=["'][^"']*(?:platform-shell|global-nav|global-topbar)/i);
  assert.match(indexSource, /id="app"/);
  assert.match(indexSource, /data\.js\?v=20260831-06/);
  assert.match(indexSource, /app\.js\?v=20260831-06/);
});

test("S003 modeling page is a schema-driven M08 consumer", () => {
  const schema = candidate.consumerSchemas.s003Modeling;
  assert.equal(schema.schemaVersion, "ofw.dashboard.s003-modeling-consumer.v1");
  assert.equal(schema.objective.objectiveId, "MO-S003-DEBT-RISK-EARLY-WARNING-v1");
  assert.equal(schema.objective.kind, "SCORING");
  assert.deepEqual(schema.views.map((item) => item.id), ["formal", "candidate", "difference"]);
  assert.equal(schema.formalBinding.modelVersion, "1.0.2");
  assert.equal(schema.formalBinding.resultKind, "FACT");
  assert.deepEqual(schema.resultEnvelope.acceptedCandidateUseKinds, ["WHAT_IF", "SHADOW"]);
  for (const projection of ["riskDistribution", "industrySlices", "stageSlices", "enterpriseScores", "migrationMatrix", "contributionChanges", "benchmark"])
    assert.ok(schema.resultEnvelope.projectionRoles.includes(projection), `missing S003 projection: ${projection}`);
  for (const label of ["当前正式模型", "Binding", "DataVersion", "最近 Benchmark", "活动影子候选", "进入 M08 优化模型", "正式结果", "候选试算", "差异", "等级迁移矩阵", "逐户升降与贡献变化"])
    assert.ok(appSource.includes(label), `missing S003 consumer label: ${label}`);
});

test("S003 Dashboard no longer edits, publishes, versions or scores models locally", () => {
  assert.doesNotMatch(indexSource, /score-engine\.js/);
  assert.doesNotMatch(appSource, /S003ScoreEngine|scorePortfolio|nextPatchVersion|M01-PUBLISH|riskModelDraft|riskPublishedConfig|riskRerunRunId/);
  assert.doesNotMatch(appSource, /data-model-weight|data-model-factor|data-model-risk-tier|校验、发布并重评|调整模型配置/);
  assert.doesNotMatch(appSource, /scenarioRunId\s*=\s*`S003-RUN/);
  assert.match(appSource, /不写 C035、Published FACT、报告或处置状态/);
});

test("S003 Dashboard declares host messages for context, M08 navigation and recalculation", () => {
  const messages = candidate.consumerSchemas.s003Modeling.messages;
  assert.deepEqual(messages, {
    scenarioFocus: "OFW_DASHBOARD_SCENARIO_FOCUS",
    contextRequest: "OFW_S003_MODELING_CONTEXT_REQUEST",
    contextResponse: "OFW_S003_MODELING_CONTEXT",
    openObjective: "OFW_S003_OPEN_MODELING_OBJECTIVE",
    recalculateRequest: "OFW_S003_MODELING_RECALCULATE_REQUEST",
    resultResponse: "OFW_S003_MODELING_RESULT",
    errorResponse: "OFW_S003_MODELING_ERROR",
  });
  for (const token of ["returnRoute", "returnDashboardRoute", "usageIntent", "candidateId", "modelVersionId", "enterpriseScope"])
    assert.ok(appSource.includes(token), `missing host payload token: ${token}`);
});

test("S003 candidate Result Envelope enforces identity and non-fact boundaries", () => {
  const context = vm.createContext({
    console,
    location: { hash: "#/view/risk/operations", origin: "http://127.0.0.1:4342" },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => ({ innerHTML: "", className: "" }), addEventListener: () => {} },
    setTimeout: () => 0,
  });
  context.window = context;
  context.parent = context;
  context.addEventListener = () => {};
  context.scrollTo = () => {};
  context.__OFW_DASHBOARD_SKIP_RENDER__ = true;
  vm.runInContext(read(path.join(root, "data.js")), context);
  vm.runInContext(appSource, context);
  const api = context.OFW_RISK_DASHBOARD_TEST_API;
  const scenarioContext = JSON.parse(JSON.stringify(api.modelingContext));
  const resultEnvelope = {
    schemaVersion: "ofw.modeling.result-envelope.v1",
    resultId: "M08-S003-SHADOW-RESULT-001",
    resultKind: "PREDICTION",
    useKind: "SHADOW",
    objectiveId: "MO-S003-DEBT-RISK-EARLY-WARNING-v1",
    bindingRef: { bindingId: "CB-S003-DASHBOARD-DEBT-RISK-CANDIDATE", revision: "2" },
    releaseSelector: { modelVersionId: "MV-S003-CANDIDATE-A" },
    inputSnapshot: { scenarioContext, asOf: "2025-12-31", dataVersionId: "S003-T007-FORMAL-CANDIDATE-20251231-v1" },
    factWriteAllowed: false,
    actionWriteAllowed: false,
    actionSourceAllowed: false,
    outputs: [
      {
        enterpriseId: "S003-ENT-020",
        enterpriseName: "环保测试公司4",
        industry: "环保",
        operatingStage: "运营阶段",
        riskScore: 28.05,
        riskIndex: 71.95,
        predictedRiskTier: "YELLOW",
        baseline: { riskScore: 23.05, predictedRiskTier: "RED" },
        coverage: 1,
        topContributors: [
          { metricId: "MET-LIQUIDITY", name: "流动性覆盖", kind: "METRIC", contribution: -0.18, baselineContribution: -0.25, delta: 0.07 },
          { factorId: "FAC-MATURITY", name: "到期压力", kind: "FACTOR", contribution: -0.12, baselineContribution: -0.08, delta: -0.04 },
        ],
      },
      {
        enterpriseId: "S003-ENT-007",
        enterpriseName: "风电测试公司07",
        industry: "新能源产业-风电",
        operatingStage: "运营阶段",
        riskScore: 35.75,
        riskIndex: 64.25,
        predictedRiskTier: "YELLOW",
        baseline: { riskScore: 37.75, predictedRiskTier: "YELLOW" },
        coverage: 0.96,
        topContributors: [],
      },
    ],
    summaries: { benchmark: { status: "COMPLETED", metrics: { recallAtCapacity: 0.8, prAuc: 0.62 } } },
    evidenceRefs: ["BENCHMARK-RUN-001", "SHADOW-RUN-001"],
    formedAt: "2026-08-31T10:00:00+08:00",
  };
  assert.equal(api.validateCandidateEnvelope(resultEnvelope), "");
  assert.equal(api.validateCandidateEnvelope({
    ...resultEnvelope,
    inputSnapshot: { ...resultEnvelope.inputSnapshot, ...scenarioContext, scenarioContext: { ...scenarioContext, status: "active" } },
  }), "");
  assert.equal(api.acceptModelingResult({
    type: "OFW_S003_MODELING_RESULT",
    scenarioContext,
    objectiveId: "MO-S003-DEBT-RISK-EARLY-WARNING-v1",
    resultEnvelope,
  }), "");
  const projection = JSON.parse(JSON.stringify(api.normalizedEnvelope(resultEnvelope)));
  assert.equal(projection.resultKind, "PREDICTION");
  assert.equal(projection.useKind, "SHADOW");
  assert.equal(projection.distribution["黄灯"], 2);
  assert.deepEqual(projection.industrySlices.map((item) => item.name).sort(), ["新能源产业-风电", "环保"]);
  assert.equal(projection.stageSlices[0].name, "运营阶段");
  assert.equal(projection.migration["红灯"]["黄灯"], 1);
  assert.equal(projection.subjects[0].contributors[0].kind, "METRIC");
  assert.equal(projection.subjects[0].contributors[1].kind, "FACTOR");
  assert.match(api.validateCandidateEnvelope({ ...resultEnvelope, resultKind: "FACT" }), /PREDICTION/);
  assert.match(api.validateCandidateEnvelope({ ...resultEnvelope, actionWriteAllowed: true }), /三重禁写/);
  assert.match(api.validateCandidateEnvelope({ ...resultEnvelope, inputSnapshot: { ...resultEnvelope.inputSnapshot, scenarioContext: { ...scenarioContext, scenarioRunId: "S003-RUN-OTHER" } } }), /身份不匹配/);
});

test("S003 formal projection remains the immutable archived FACT", () => {
  const context = vm.createContext({
    console,
    location: { hash: "#/view/risk/operations", origin: "http://127.0.0.1:4342" },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => ({ innerHTML: "", className: "" }), addEventListener: () => {} },
    setTimeout: () => 0,
  });
  context.window = context;
  context.parent = context;
  context.addEventListener = () => {};
  context.scrollTo = () => {};
  context.__OFW_DASHBOARD_SKIP_RENDER__ = true;
  vm.runInContext(read(path.join(root, "data.js")), context);
  vm.runInContext(appSource, context);
  const api = context.OFW_RISK_DASHBOARD_TEST_API;
  const envelope = JSON.parse(JSON.stringify(api.formalEnvelope(candidate.dashboards.find((item) => item.id === "risk"))));
  assert.equal(envelope.resultKind, "FACT");
  assert.equal(envelope.releaseSelector.modelVersionId, "S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.equal(envelope.inputSnapshot.scenarioContext.scenarioRunId, "S003-RUN-20260817163000000-c02200000001");
  assert.equal(envelope.inputSnapshot.scenarioContext.status, "completed");
  assert.equal(envelope.outputs.length, 21);
  assert.equal(envelope.immutable, true);
});

test("S003 Dashboard accepts the deterministic M08 runtime envelope end to end", async () => {
  const { createS003Runtime } = await import(new URL("../modules/modeling/validation/src/s003-runtime.mjs", import.meta.url));
  const runtime = createS003Runtime();
  runtime.runBenchmark();
  runtime.generateInsights();
  runtime.generateCandidates();
  const evaluated = runtime.evaluateCandidates();
  const candidate = evaluated.candidates.find((item) => item.status === "EVALUATED");
  const response = runtime.recalculate({
    candidateId: candidate.candidateId,
    usageIntent: "WHAT_IF",
    asOf: "2025-12-31",
    dataVersion: "S003-T007-FORMAL-CANDIDATE-20251231-v1",
  });
  const context = vm.createContext({
    console,
    location: { hash: "#/view/risk/operations", origin: "http://127.0.0.1:4342" },
    localStorage: { getItem: () => null, setItem: () => {} },
    document: { getElementById: () => ({ innerHTML: "", className: "" }), addEventListener: () => {} },
    setTimeout: () => 0,
  });
  context.window = context;
  context.parent = context;
  context.addEventListener = () => {};
  context.scrollTo = () => {};
  context.__OFW_DASHBOARD_SKIP_RENDER__ = true;
  vm.runInContext(read(path.join(root, "data.js")), context);
  vm.runInContext(appSource, context);
  const api = context.OFW_RISK_DASHBOARD_TEST_API;
  const scenarioContext = JSON.parse(JSON.stringify(api.modelingContext));
  const resultEnvelope = {
    ...response.resultEnvelope,
    inputSnapshot: { ...response.resultEnvelope.inputSnapshot, ...scenarioContext },
  };
  assert.equal(api.acceptModelingResult({
    type: "OFW_S003_MODELING_RESULT",
    objectiveId: "MO-S003-DEBT-RISK-EARLY-WARNING-v1",
    scenarioContext,
    workspace: response.workspace,
    resultEnvelope,
  }), "");
  const projection = JSON.parse(JSON.stringify(api.normalizedEnvelope(resultEnvelope)));
  assert.equal(projection.resultKind, "PREDICTION");
  assert.equal(projection.useKind, "WHAT_IF");
  assert.equal(projection.subjects.length, 21);
  assert.equal(Object.values(projection.distribution).reduce((sum, count) => sum + count, 0), 21);
  assert.equal(Object.values(projection.migration).flatMap((row) => Object.values(row)).reduce((sum, count) => sum + count, 0), 21);
  assert.ok(projection.subjects.some((item) => item.contributors.some((entry) => entry.kind === "METRIC")));
  assert.ok(projection.subjects.some((item) => item.contributors.some((entry) => entry.kind === "FACTOR")));
  assert.equal(resultEnvelope.factWriteAllowed, false);
  assert.equal(resultEnvelope.actionWriteAllowed, false);
  assert.equal(resultEnvelope.actionSourceAllowed, false);
  assert.doesNotMatch(resultEnvelope.runId, /^S003-RUN/);
});
