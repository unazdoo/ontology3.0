"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createRuntime, scenarioRoot } = require("./runtime-harness.cjs");

function plain(value) { return JSON.parse(JSON.stringify(value)); }
function localFetch(ref) {
  const absolute = path.resolve(scenarioRoot, String(ref).replace(/^\.\//, ""));
  return Promise.resolve({ ok: absolute.startsWith(scenarioRoot) && fs.existsSync(absolute), text: async () => fs.readFileSync(absolute, "utf8") });
}

function runToActions(runtime) {
  assert.equal(runtime.store.connectData(), true);
  assert.equal(runtime.store.runQuality(), true);
  assert.equal(runtime.store.publishData(), true);
  assert.equal(runtime.store.applyMapping(), true);
  assert.equal(runtime.store.publishOntology(), true);
  assert.ok(runtime.store.executeQuestion("Q-EXECUTION"));
  assert.equal(runtime.store.runRules().length, 6);
  const requests = runtime.store.submitActions();
  assert.equal(requests.length, 0);
  return requests;
}

test("M01映射完成时形成同轮C003接收回执和目标Draft精确绑定", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T06:40:00.000Z", randomSeed: 200 });
  assert.equal(runtime.store.connectData(), true);
  assert.equal(runtime.store.runQuality(), true);
  assert.equal(runtime.store.publishData(), true);
  assert.equal(runtime.store.applyMapping(), true);

  const exported = runtime.store.exportOwnedState();
  const mapped = exported.modules.m01;
  assert.equal(mapped.c003Receipt.contractCode, "C003");
  assert.equal(mapped.c003Receipt.status, "accepted");
  assert.equal(mapped.c003Receipt.t007Version, "S002-DATA-v1");
  assert.equal(mapped.c003Receipt.scenarioContext.scenarioRunId, exported.scenarioContext.scenarioRunId);
  assert.equal(mapped.targetDraftBinding.deliveryId, mapped.c003Receipt.deliveryId);
  assert.equal(mapped.targetDraftBinding.assetVersion, "S002-DATA-v1");
  assert.equal(mapped.targetDraftBinding.targetDraftId, "DRAFT-S002-BUDGET-v1");
  assert.equal(mapped.targetDraftBinding.targetDraftRevision, 1);
});

test("当前范围关闭Action运行示例，确认和拒绝均不能凭空创建事项", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T07:00:00.000Z", randomSeed: 201 });
  const requests = runToActions(runtime);
  assert.equal(requests.length, 0);
  const before = plain(runtime.store.get());
  assert.equal(runtime.store.confirmAction("AR-NOT-CREATED"), false);
  assert.equal(runtime.store.rejectAction("AR-NOT-CREATED"), false);
  const after = runtime.store.get();
  assert.equal(after.actionRequests.length, 0);
  assert.equal(after.decisionAlerts.length, 0);
  assert.equal(after.todos.length, 0);
  assert.equal(runtime.store.exportOwnedState().modules.m04.actionPolicy, "disabled-for-s002-current-scope");
  assert.deepEqual(plain(after.actionRequests), plain(before.actionRequests));
});

test("历史只读运行拒绝Action确认或拒绝且内存状态不变", async function () {
  const runtime = createRuntime({ startIso: "2026-08-15T07:10:00.000Z", randomSeed: 211, fetch: localFetch });
  await runtime.store.historicalView({ file: "checkpoints/current/CP07-e2e-integrated.json" });
  const before = plain(runtime.store.get());
  assert.equal(before.actionRequests.length, 0);
  assert.equal(runtime.store.confirmAction("AR-NOT-CREATED", { reason: "不应写入" }), false);
  assert.equal(runtime.store.rejectAction("AR-NOT-CREATED", { reason: "不应写入" }), false);
  assert.deepEqual(plain(runtime.store.get()), before);
});

test("报告和已发布驾驶舱冻结形成时的C018/C019内容投影", function () {
  const runtime = createRuntime({ startIso: "2026-08-15T07:20:00.000Z", randomSeed: 202 });
  runToActions(runtime);
  assert.ok(runtime.store.runAgents());

  const report = runtime.store.buildReport();
  assert.equal(report.status, "draft");
  assert.equal(report.formalArtifactPublished, false);
  assert.equal(report.t049Ref, null);
  assert.equal(report.contentSnapshot.c018.contractId, "C018-S002-v1");
  assert.equal(report.contentSnapshot.c019.contractId, "C019-S002-NOT-APPLICABLE");
  assert.equal(report.contentSnapshot.c019.actionRequests.length, 0);
  assert.equal(report.contentSnapshot.c019.decisionSummary.status, "no-runtime-actions");

  const version = runtime.store.publishDashboard();
  assert.equal(version.status, "published");
  assert.equal(version.reportStatusAtPublish, "draft");
  assert.equal(version.formalReportPublished, false);
  assert.equal(version.t049Ref, null);
  assert.equal(version.contentSnapshotRef, `${report.reportId}#contentSnapshot`);

  const published = runtime.store.get();
  const reportSnapshotBefore = JSON.stringify(published.reports[0].contentSnapshot);
  const dashboardVersionBefore = JSON.stringify(published.dashboardVersions[0].contentSnapshot);
  const dashboardViewBefore = JSON.stringify(published.dashboardView.contentSnapshot);
  runtime.advance(60000);
  assert.equal(runtime.store.rejectAction("AR-NOT-CREATED"), false);
  const afterLiveDecision = runtime.store.get();
  assert.equal(afterLiveDecision.actionRequests.length, 0);
  assert.equal(afterLiveDecision.decisionSummary.status, "no-runtime-actions");
  assert.equal(JSON.stringify(afterLiveDecision.reports[0].contentSnapshot), reportSnapshotBefore);
  assert.equal(JSON.stringify(afterLiveDecision.dashboardVersions[0].contentSnapshot), dashboardVersionBefore);
  assert.equal(JSON.stringify(afterLiveDecision.dashboardView.contentSnapshot), dashboardViewBefore);
  assert.equal(afterLiveDecision.reports[0].contentSnapshot.c019.actionRequests.length, 0);
  assert.equal(afterLiveDecision.dashboardVersions[0].contentSnapshot.c019.actionRequests.length, 0);
  assert.equal(afterLiveDecision.reports[0].status, "draft");
  assert.equal(afterLiveDecision.dashboardVersions[0].status, "published");
});
