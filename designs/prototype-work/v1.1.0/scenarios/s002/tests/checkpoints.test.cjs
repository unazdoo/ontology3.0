"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const Foundation = require("../../../foundation/ofw-scenario-foundation.js");
const Contracts = require("../modules/owner-state-contracts.cjs");
const Generator = require("../checkpoints/generate-checkpoints.cjs");
const Validator = require("../checkpoints/validate-checkpoints.cjs");
const { createMemoryStorage, createRuntime, scenarioRoot } = require("./runtime-harness.cjs");

function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
function catalog() { return readJson(path.join(scenarioRoot, "checkpoints/checkpoint-catalog.json")); }
function checkpoint(id) { const item = catalog().checkpoints.find((entry) => entry.id === id); return readJson(path.join(scenarioRoot, item.file)); }
function localFetch(ref) {
  const absolute = path.resolve(scenarioRoot, String(ref).replace(/^\.\//, ""));
  return Promise.resolve({ ok: absolute.startsWith(scenarioRoot) && fs.existsSync(absolute), text: async () => fs.readFileSync(absolute, "utf8") });
}

function tamperedFetch(ref) {
  const absolute = path.resolve(scenarioRoot, String(ref).replace(/^\.\//, ""));
  const ok = absolute.startsWith(scenarioRoot) && fs.existsSync(absolute);
  return Promise.resolve({
    ok,
    text: async () => {
      const content = fs.readFileSync(absolute, "utf8");
      return String(ref).includes("M01-state-export.json") ? `${content} ` : content;
    }
  });
}

function runToActions(runtime) {
  assert.equal(runtime.store.connectData(), true);
  assert.equal(runtime.store.runQuality(), true);
  assert.equal(runtime.store.publishData(), true);
  assert.equal(runtime.store.applyMapping(), true);
  assert.equal(runtime.store.publishOntology(), true);
  assert.ok(runtime.store.executeQuestion("Q-EXECUTION"));
  assert.equal(runtime.store.runRules().length, 6);
  return runtime.store.submitActions();
}

test("当前不可变Checkpoint归档、Owner回执和代码哈希全部有效", function () {
  const result = Validator.validateAll();
  assert.equal(result.catalog.checkpoints.length, 8);
  assert.equal(result.ownerReceiptCount, 48);
  assert.equal(result.currentCodeHash, Generator.computeCodeHash());
});

test("当前Checkpoint便捷指针禁止浏览器缓存，避免升版后继续装载旧runId", function () {
  const stateSource = fs.readFileSync(path.join(scenarioRoot, "state.js"), "utf8");
  assert.match(stateSource, /normalized\.startsWith\("checkpoints\/current\/"\) \? \{ cache: "no-store" \}/);
  assert.match(stateSource, /checkpoints\/current 是指向最新不可变运行的可变便捷指针/);
});

test("运行前置门拒绝越级，正常链形成13项进度且决策运行示例保持关闭", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:00:00.000Z", randomSeed: 100 });
  assert.equal(runtime.store.runQuality(), false);
  assert.equal(runtime.store.publishData(), false);
  assert.equal(runtime.store.publishOntology(), false);
  assert.equal(runtime.store.executeQuestion("Q-EXECUTION"), false);
  assert.equal(runtime.store.submitActions(), false);
  const requests = runToActions(runtime);
  assert.equal(requests.length, 0);
  assert.equal(runtime.store.exportOwnedState().modules.m04.actionPolicy, "disabled-for-s002-current-scope");
  assert.equal(runtime.store.exportOwnedState().modules.m04.decisionSummary.status, "no-runtime-actions");
  assert.ok(runtime.store.runAgents());
  assert.ok(runtime.store.buildReport());
  assert.ok(runtime.store.publishDashboard());
  const finalDecisionState = runtime.store.get();
  assert.equal(finalDecisionState.actionRequests.length, 0);
  assert.equal(finalDecisionState.decisionAlerts.length, 0);
  assert.equal(finalDecisionState.todos.length, 0);
  assert.equal(Object.values(runtime.store.get().progress).every(Boolean), true);
});

test("页面刷新复用同一当前runId，只有定向重置才创建新轮次", function () {
  const storage = createMemoryStorage();
  const first = createRuntime({ storage, startIso: "2026-08-15T03:05:00.000Z", randomSeed: 110 });
  assert.equal(first.store.connectData(), true);
  const originalRunId = first.store.context().scenarioRunId;
  const reloaded = createRuntime({ storage, startIso: "2026-08-15T03:06:00.000Z", randomSeed: 111 });
  assert.equal(reloaded.store.context().scenarioRunId, originalRunId);
  assert.equal(reloaded.store.get().progress.dataConnected, true);
  const reset = reloaded.store.reset();
  assert.notEqual(reset.context.scenarioRunId, originalRunId);
  const afterResetReload = createRuntime({ storage, startIso: "2026-08-15T03:07:00.000Z", randomSeed: 112 });
  assert.equal(afterResetReload.store.context().scenarioRunId, reset.context.scenarioRunId);
  assert.equal(afterResetReload.store.get().progress.dataConnected, false);
});

test("实施基准日固定为2026-08-15，实际复验日期不得漂移进场景状态", function () {
  const runtime = createRuntime({ startIso: "2026-08-16T03:00:00.000Z", randomSeed: 136 });
  const context = runtime.store.context();
  assert.equal(context.formedAt, "2026-08-15T08:00:00.000Z");
  assert.ok(context.scenarioRunId.startsWith("S002-RUN-20260815080000000-"));
  runToActions(runtime);
  assert.equal(runtime.store.get().actionRequests.every((item) => item.createdAt.startsWith("2026-08-15T")), true);
});

test("M01—M06命名空间只保存各自Owned State，平台投影不复制业务真值", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:10:00.000Z", randomSeed: 101 });
  runToActions(runtime);
  runtime.store.runAgents();
  runtime.store.buildReport();
  runtime.store.publishDashboard();
  const entries = runtime.storage.entries();
  const platformEntry = entries.find(([key]) => key.includes(":platform:"));
  assert.ok(platformEntry);
  const platformPayload = JSON.parse(platformEntry[1]).payload;
  assert.equal("actionRequests" in platformPayload, false);
  assert.equal("todos" in platformPayload, false);
  assert.equal("reports" in platformPayload, false);
  for (const scope of ["m01", "m02", "m03", "m04", "m05", "m06"]) {
    const entry = entries.find(([key]) => key.includes(`:${scope}:`));
    assert.ok(entry, `${scope}存储不存在`);
    const owned = JSON.parse(entry[1]).payload;
    assert.equal(owned.moduleId, scope.toUpperCase());
  }
  const m06 = JSON.parse(entries.find(([key]) => key.includes(":m06:"))[1]).payload;
  assert.equal("actionRequests" in m06, false);
  assert.equal("todos" in m06, false);
  assert.equal(m06.dashboardView.queryViewRef, "C018-S002-v1");
  assert.equal("annualFacts" in m06.dashboardView, false);
  assert.equal("submissionFacts" in m06.dashboardView, false);
  assert.equal("projects" in m06.dashboardView, false);
  assert.equal("ruleHits" in m06.dashboardView, false);
  assert.equal("actionRequests" in m06.dashboardView, false);
  assert.equal("todos" in m06.dashboardView, false);
  const m03 = JSON.parse(entries.find(([key]) => key.includes(":m03:"))[1]).payload;
  assert.equal(m03.fixedView.contractId, "C018-S002-v1");
  assert.equal(m03.fixedView.annualFacts.length, 6);
  assert.equal(m03.fixedView.projects.length, 21);
  assert.equal(m03.ruleEvaluations.length, 2);
  assert.equal(m03.ruleEvaluations[0].status, "evaluated-no-hit");
  assert.equal(m03.ruleEvaluations[1].ruleId, "RULE-005");
  assert.equal(m03.ruleEvaluations[1].status, "evaluated-no-hit");
});

test("D081九项Metric、D082五项Rule与六类Action严格分离", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:20:00.000Z", randomSeed: 102 });
  assert.equal(runtime.data.metrics.length, 9);
  assert.equal(runtime.data.rules.length, 5);
  assert.equal(runtime.data.actionTypes.length, 6);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.data.metrics.map((item) => item.name))), ["成本占收比", "真正毛利率", "净在途占用", "正向采购发起量", "12月正向采购发起占比", "项目可用立项余额", "预算执行率", "预算差异额", "年末采购/预算占用集中度"]);
  assert.equal(runtime.data.actionSuggestions.every((item) => !item.ruleId), true);
  assert.equal(runtime.data.occupancy.examples.every((item) => item.dataMarker === "SYNTHETIC_FOR_DEMO"), true);
});

test("预算事实、Rule命中与项目已使用口径均可回链复算", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:25:00.000Z", randomSeed: 109 });
  assert.equal(runtime.data.ruleHitInputs.some((item) => item.id === "HIT-003"), false);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.data.ruleEvaluations[0])), {
    evaluationId: "EVAL-ACCRUAL-001",
    ruleId: null,
    ruleName: "跨年计提配对质量核验",
    evaluationPurpose: "计提配对差异解释与质量核验",
    actionPolicy: "no-action",
    status: "evaluated-no-hit",
    years: [2024, 2025],
    subjectCategories: ["项目实施成本"],
    periods: ["全年"],
    pairedAccrualCount: 14,
    unmatchedAccrualCount: 0,
    maxAbsoluteVariance: 0,
    threshold: 0.5,
    unit: "万元",
    dataMarker: "DERIVED",
    note: "2024计提与2025冲回/实际确认已逐条配对；不存在达到0.5万元关注线的差异。本项属于数据质量与业务解释核验，不占用5项正式Rule，也不生成Action Request。"
  });
  assert.equal(runtime.data.occupancy.budgetOccupancyDecemberAmount, 23.45);
  assert.equal(runtime.data.occupancy.budgetOccupancyDenominator, "全年净在途占用");
  assert.ok(Math.abs(runtime.data.occupancy.budgetOccupancyDecemberShare - (23.45 / 163.38)) < 0.000001);
  assert.equal(runtime.data.ruleHitInputs.some((item) => item.id === "HIT-005"), false);
  const priceBoundary = runtime.data.supplierBenchmarkGroups.find((item) => item.year === 2026 && item.supplier === "供应商3" && item.level === "初级");
  assert.equal(priceBoundary.maxMinRatio, 1.2);
  assert.equal(priceBoundary.anomaly, false);
  assert.equal(runtime.data.projects.reduce((sum, item) => sum + item.sourceUsedAmount, 0), 3080);
  assert.ok(Math.abs(runtime.data.projects.reduce((sum, item) => sum + item.recalculatedUsed, 0) - 2159.9813) < 0.000001);
  assert.ok(Math.abs(runtime.data.projects.reduce((sum, item) => sum + item.usedAmountVariance, 0) - (-920.0187)) < 0.000001);
  assert.equal(runtime.data.projects.every((item) => Number((item.recalculatedUsed - item.sourceUsedAmount).toFixed(4)) === item.usedAmountVariance), true);
});

test("M04保留基线能力但当前S002运行不形成Action Request、提醒或待办", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:30:00.000Z", randomSeed: 103 });
  const requests = runToActions(runtime);
  assert.equal(requests.length, 0);
  const snapshot = runtime.store.get();
  assert.equal(snapshot.actionRequests.length, 0);
  assert.equal(snapshot.decisionAlerts.length, 0);
  assert.equal(snapshot.todos.length, 0);
  assert.equal(runtime.store.exportOwnedState().modules.m04.actionPolicy, "disabled-for-s002-current-scope");
  assert.equal(runtime.store.confirmAction("AR-NOT-CREATED"), false);
  assert.equal(runtime.store.rejectAction("AR-NOT-CREATED"), false);
});

test("Dashboard Version发布不会把报告草稿冒充正式报告或T049", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:40:00.000Z", randomSeed: 104 });
  runToActions(runtime);
  assert.ok(runtime.store.runAgents());
  assert.ok(runtime.store.buildReport(), "无待办也应可生成诚实的报告草稿");
  assert.ok(runtime.store.publishDashboard());
  const snapshot = runtime.store.get();
  assert.equal(snapshot.reports[0].status, "draft");
  assert.equal(snapshot.reports[0].t049Ref, null);
  assert.equal(snapshot.dashboardVersions[0].status, "published");
  assert.equal(snapshot.dashboardView.contractId, "C018-S002-DASHBOARD-v1");
});

test("驾驶舱发布与卡片点击均不生成决策事项", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:45:00.000Z", randomSeed: 141 });
  runToActions(runtime);
  assert.equal(runtime.store.submitDashboardAction("DASH-EXEC-AQ-2025"), false, "驾驶舱版本发布前不得形成请求");
  runtime.store.runAgents();
  runtime.store.buildReport();
  runtime.store.publishDashboard();
  assert.equal(runtime.store.get().actionRequests.length, 0, "发布驾驶舱不得自动新增Action Request");
  const created = Array.from(runtime.data.dashboardActionCandidates, (candidate) => runtime.store.submitDashboardAction(candidate.id));
  assert.equal(created.length, runtime.data.dashboardActionCandidates.length);
  assert.equal(created.every((value) => value === false), true);
  assert.equal(runtime.store.submitDashboardAction("DASH-EXEC-AQ-2025"), false);
  const snapshot = runtime.store.get();
  assert.equal(snapshot.actionRequests.length, 0);
  assert.equal(snapshot.decisionAlerts.length, 0);
  assert.equal(snapshot.todos.length, 0);
  assert.equal(runtime.store.exportOwnedState().modules.m04.decisionSummary.status, "no-runtime-actions");
});

test("历史查看保留原runId且拒绝写入；克隆恢复新runId并恢复模块状态", async function () {
  const runtime = createRuntime({ startIso: "2026-08-15T03:50:00.000Z", randomSeed: 105, fetch: localFetch });
  const cp07Entry = { file: "checkpoints/current/CP07-e2e-integrated.json" };
  const source = checkpoint("CP07");
  const historical = await runtime.store.historicalView(cp07Entry);
  assert.equal(historical.context.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(runtime.store.mode(), "historical");
  assert.equal(runtime.store.connectData(), false);

  const restoredRuntime = createRuntime({ startIso: "2026-08-15T03:55:00.000Z", randomSeed: 106, fetch: localFetch });
  const restored = await restoredRuntime.store.cloneRestore(cp07Entry);
  assert.notEqual(restored.context.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(restoredRuntime.store.mode(), "restored");
  assert.equal(restoredRuntime.store.get().progress.dashboardPublished, true);
  assert.equal(restoredRuntime.store.get().actionRequests.every((item) => item.externalStatus === "not-dispatched"), true);
  const restoredOwned = restoredRuntime.store.exportOwnedState();
  assert.equal(restoredOwned.modules.m01.c003Receipt.scenarioContext.scenarioRunId, restored.context.scenarioRunId);
  assert.equal(restoredOwned.modules.m01.c003Receipt.sourceScenarioContext.scenarioRunId, source.scenarioContext.scenarioRunId);
  assert.equal(restoredOwned.modules.m01.targetDraftBinding.scenarioContext.scenarioRunId, restored.context.scenarioRunId);
  assert.equal(restoredOwned.modules.m01.targetDraftBinding.sourceScenarioContext.scenarioRunId, source.scenarioContext.scenarioRunId);
});

test("隔离回归只恢复数据与Published前置，历史Action/待办/报告零重放", async function () {
  const runtime = createRuntime({ startIso: "2026-08-15T04:00:00.000Z", randomSeed: 107, fetch: localFetch });
  const regression = await runtime.store.isolatedRegression({ file: "checkpoints/current/CP07-e2e-integrated.json" });
  const snapshot = runtime.store.get();
  assert.equal(regression.externalCapabilitiesDefault, "disabled");
  assert.equal(snapshot.mode, "regression");
  assert.equal(snapshot.progress.assetPublished, true);
  assert.equal(snapshot.progress.ontologyPublished, true);
  assert.equal(snapshot.progress.queryRun, false);
  assert.equal(snapshot.actionRequests.length, 0);
  assert.equal(snapshot.todos.length, 0);
  assert.equal(snapshot.reports.length, 0);
});

test("恢复拒绝跨场景路径和摘要被篡改的Owner导出", async function () {
  const traversal = createRuntime({ startIso: "2026-08-15T04:05:00.000Z", randomSeed: 132, fetch: localFetch });
  assert.throws(() => traversal.store.historicalView({ file: "../s003/checkpoints/current/CP07-e2e-integrated.json" }), /路径越界|不可变运行目录/);
  const tampered = createRuntime({ startIso: "2026-08-15T04:06:00.000Z", randomSeed: 133, fetch: tamperedFetch });
  await assert.rejects(() => tampered.store.cloneRestore({ file: "checkpoints/current/CP07-e2e-integrated.json" }), /摘要错配/);
});

test("Foundation拒绝错误基线、副作用放开与未验证恢复", function () {
  const cp07 = checkpoint("CP07");
  const wrong = JSON.parse(JSON.stringify(cp07));
  wrong.baselineSnapshotId = "BSL-S001-V104-INVALID000001";
  assert.equal(Foundation.validateCheckpointManifest(wrong).ok, false);
  const sideEffect = JSON.parse(JSON.stringify(cp07));
  sideEffect.sideEffectPolicy.allowExternalDispatch = true;
  assert.equal(Foundation.validateCheckpointManifest(sideEffect).ok, false);
  const notVerified = JSON.parse(JSON.stringify(cp07));
  notVerified.restoreReadiness.status = "not-verified";
  assert.equal(Foundation.createHistoricalView(notVerified).readOnly, true);
  assert.throws(() => Foundation.cloneRestore(notVerified), (error) => error.code === "CHECKPOINT_NOT_RESTORABLE");
});

test("Owner边界拒绝M02业务Rule、M04外部派发和M06决策真值", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T04:10:00.000Z", randomSeed: 108 });
  runToActions(runtime);
  const exported = runtime.store.exportOwnedState();
  const context = JSON.parse(JSON.stringify(exported.scenarioContext));
  const m02 = Contracts.buildModuleExport({ moduleId: "M02", checkpointNode: "data-connected", scenarioContext: context, formedAt: "2026-08-15T04:11:00.000Z", runtimeState: JSON.parse(JSON.stringify(exported.modules.m02)) });
  m02.resources[0].resourceType = "rule";
  assert.equal(Contracts.validateModuleExport(m02).some((message) => message.includes("Owner")), true);
  const m04 = Contracts.buildModuleExport({ moduleId: "M04", checkpointNode: "decision-chain-completed", scenarioContext: context, formedAt: "2026-08-15T04:12:00.000Z", runtimeState: JSON.parse(JSON.stringify(exported.modules.m04)) });
  m04.ownerBoundary.externalBudgetSystemDispatch = true;
  assert.equal(Contracts.validateModuleExport(m04).some((message) => message.includes("外部预算系统")), true);
  const m06 = Contracts.buildModuleExport({ moduleId: "M06", checkpointNode: "agent-report-dashboard-completed", scenarioContext: context, formedAt: "2026-08-15T04:13:00.000Z", runtimeState: JSON.parse(JSON.stringify(exported.modules.m06)) });
  m06.ownerBoundary.ownsDecisionState = true;
  assert.equal(Contracts.validateModuleExport(m06).some((message) => message.includes("决策状态")), true);
});
