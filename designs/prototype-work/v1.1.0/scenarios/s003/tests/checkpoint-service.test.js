"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const scenarioRoot = path.resolve(__dirname, "..");
const servicePath = path.join(scenarioRoot, "domain", "checkpoint-service.js");
const serviceModule = require(servicePath);
const foundation = require(path.join(scenarioRoot, "..", "..", "foundation", "ofw-scenario-foundation.js"));
const checkpoint = require(path.join(scenarioRoot, "checkpoints", "CP05-decision-chain-completed.json"));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function initialSuccess() {
  return {
    scenarioContext: checkpoint.scenarioContext,
    completedAt: checkpoint.createdAt,
    evidenceRef: checkpoint.restoreReadiness.evidenceRef
  };
}

function createService(overrides) {
  return serviceModule.createCheckpointService({
    checkpoints: [checkpoint],
    lastSuccessfulRun: initialSuccess(),
    ...(overrides || {})
  });
}

function allDisabled(value) {
  return Object.values(value).every((item) => item === false);
}

test("暴露 CommonJS/浏览器 API，并固定 S001 v1.0.3 最终冻结快照", () => {
  assert.equal(serviceModule.SERVICE_VERSION, "1.0.0");
  assert.equal(serviceModule.BASELINE_VERSION, "1.0.3");
  assert.equal(serviceModule.BASELINE_SNAPSHOT_ID, "BSL-S001-V103-DE0119608E26");
  assert.equal(typeof serviceModule.createCheckpointService, "function");

  const browserContext = {OFWScenarioFoundation: foundation};
  browserContext.globalThis = browserContext;
  vm.runInNewContext(fs.readFileSync(servicePath, "utf8"), browserContext, {filename: "checkpoint-service.js"});
  assert.equal(typeof browserContext.S003CheckpointService.createCheckpointService, "function");
  assert.equal(browserContext.S003CheckpointService.BASELINE_VERSION, "1.0.3");
});

test("历史快照查看保留原 scenarioRunId、原命名空间且严格只读", () => {
  const runtime = createService();
  const view = runtime.viewHistorical({
    checkpointId: checkpoint.checkpointId,
    operationId: "OP-S003-20260815150000000-a1b2c3d4e5f6"
  });

  assert.equal(view.mode, "historical-view");
  assert.equal(view.context.scenarioRunId, checkpoint.scenarioContext.scenarioRunId);
  assert.equal(view.context.status, "historical-readonly");
  assert.equal(view.readOnly, true);
  assert.equal(view.writesCurrentProjection, false);
  assert.equal(view.rerunsBusinessLogic, false);
  assert.equal(view.runtimeContract.sourceNamespace, view.runtimeContract.targetNamespace);
  assert.equal(view.runtimeContract.sourceAccess, "read-only");
  assert.equal(view.runtimeContract.targetAccess, "read-only");
  assert.equal(view.runtimeContract.historyMutation, false);
  assert.equal(allDisabled(view.disabledCapabilities), true);
  assert.equal(allDisabled(view.sideEffectPolicy), true);
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.checkpoint), true);
});

test("克隆恢复按 operationId 确定性幂等，创建新 runId/命名空间且不覆盖历史", () => {
  const operationId = "OP-S003-20260815151000000-b1c2d3e4f506";
  const sourceBefore = JSON.stringify(checkpoint);
  const firstRuntime = createService();
  const first = firstRuntime.cloneRestore({checkpointId: checkpoint.checkpointId, operationId});
  const replay = firstRuntime.cloneRestore({checkpointId: checkpoint.checkpointId, operationId});
  const secondRuntime = createService();
  const crossInstanceReplay = secondRuntime.cloneRestore({checkpointId: checkpoint.checkpointId, operationId});

  assert.strictEqual(replay, first, "同一服务内重复 operationId 返回同一不可变回执");
  assert.deepEqual(crossInstanceReplay, first, "相同 operationId 跨实例仍生成相同 clone 身份");
  assert.equal(first.operationId, operationId);
  assert.equal(first.mode, "clone-restore");
  assert.equal(first.context.status, "restored");
  assert.notEqual(first.context.scenarioRunId, checkpoint.scenarioContext.scenarioRunId);
  assert.equal(first.sourceScenarioRunId, checkpoint.scenarioContext.scenarioRunId);
  assert.equal(first.overwritesHistory, false);
  assert.equal(first.runtimeContract.sourceAccess, "read-only");
  assert.equal(first.runtimeContract.targetAccess, "isolated-write");
  assert.equal(first.runtimeContract.requiresEmptyTargetNamespace, true);
  assert.notEqual(first.runtimeContract.sourceNamespace, first.runtimeContract.targetNamespace);
  assert.match(first.runtimeContract.targetNamespace, new RegExp(`${first.context.scenarioRunId}$`));
  assert.equal(allDisabled(first.disabledCapabilities), true);
  assert.equal(allDisabled(first.sideEffectPolicy), true);
  assert.equal(JSON.stringify(checkpoint), sourceBefore, "来源 Checkpoint 不得被原地修改");
});

test("同一 operationId 改做其他操作时阻断，错误场景身份也阻断", () => {
  const runtime = createService();
  const operationId = "OP-S003-20260815152000000-c1d2e3f40516";
  runtime.cloneRestore({checkpointId: checkpoint.checkpointId, operationId});
  assert.throws(
    () => runtime.createRegression({checkpointId: checkpoint.checkpointId, operationId}),
    (error) => error.code === "S003_CHECKPOINT_OPERATION_CONFLICT"
  );

  const wrongRun = {
    ...checkpoint.scenarioContext,
    scenarioRunId: "S003-RUN-20260815152100000-111111111111"
  };
  assert.throws(
    () => serviceModule.assertIdentityMatch(checkpoint.scenarioContext, wrongRun),
    (error) => error.code === "S003_CHECKPOINT_IDENTITY_MISMATCH"
  );

  const wrongBaseline = clone(checkpoint);
  wrongBaseline.parentVersion = "1.0.2";
  assert.throws(
    () => serviceModule.createCheckpointService({checkpoint: wrongBaseline}),
    (error) => error.code === "S003_CHECKPOINT_BASELINE_MISMATCH"
  );
});

test("隔离回归创建新 runId，Action Request/审批/通知/待办/外发全部关闭", () => {
  const runtime = createService();
  const regression = runtime.createRegression({
    checkpointId: checkpoint.checkpointId,
    operationId: "OP-S003-20260815153000000-d1e2f3041526"
  });

  assert.equal(regression.mode, "isolated-regression");
  assert.equal(regression.context.status, "regression");
  assert.notEqual(regression.context.scenarioRunId, checkpoint.scenarioContext.scenarioRunId);
  assert.equal(regression.isolationMode, "drill");
  assert.equal(regression.externalCapabilitiesDefault, "disabled");
  assert.equal(regression.runtimeContract.outboundMode, "drill-only");
  assert.equal(regression.runtimeContract.historyMutation, false);
  assert.equal(allDisabled(regression.disabledCapabilities), true);
  assert.equal(regression.disabledCapabilities.actionRequest, false);
  assert.equal(regression.disabledCapabilities.approval, false);
  assert.equal(regression.disabledCapabilities.notification, false);
  assert.equal(regression.disabledCapabilities.ownerTodo, false);
  assert.equal(regression.disabledCapabilities.externalDispatch, false);
  assert.equal(allDisabled(regression.sideEffectPolicy), true);
});

test("基线迁移禁止原地换父版本，并强制新 scenarioVersion/runId/命名空间", () => {
  const runtime = createService();
  assert.throws(
    () => runtime.migrateBaseline({
      checkpointId: checkpoint.checkpointId,
      operationId: "OP-S003-20260815154000000-e1f203142536",
      targetBaselineVersion: "1.0.4",
      targetBaselineSnapshotId: "BSL-S001-V104-ABCDEF123456",
      targetScenarioVersion: "S003-v1"
    }),
    (error) => error.code === "S003_CHECKPOINT_MIGRATION_REJECTED"
  );

  const migrated = runtime.migrateBaseline({
    checkpointId: checkpoint.checkpointId,
    operationId: "OP-S003-20260815154100000-f10213243546",
    targetBaselineVersion: "1.0.4",
    targetBaselineSnapshotId: "BSL-S001-V104-ABCDEF123456",
    targetScenarioVersion: "S003-v2"
  });
  assert.equal(migrated.mode, "baseline-migration");
  assert.equal(migrated.source.baselineVersion, "1.0.3");
  assert.equal(migrated.source.scenarioVersion, "S003-v1");
  assert.equal(migrated.target.baselineVersion, "1.0.4");
  assert.equal(migrated.target.scenarioVersion, "S003-v2");
  assert.notEqual(migrated.target.scenarioRunId, checkpoint.scenarioContext.scenarioRunId);
  assert.notEqual(migrated.runtimeContract.sourceNamespace, migrated.runtimeContract.targetNamespace);
  assert.equal(migrated.runtimeContract.migrationComparisonRequired, true);
  assert.equal(migrated.requiresNewCheckpoint, true);
  assert.equal(migrated.overwritesSource, false);
});

test("重评失败保留上一成功运行；失败重试创建新 runId，成功后才切换权威成功指针", () => {
  const runtime = createService();
  const originalSuccessRunId = checkpoint.scenarioContext.scenarioRunId;
  const failedAttempt = runtime.beginRerun({
    operationId: "OP-S003-20260815155000000-0123456789ab",
    sourceScenarioRunId: originalSuccessRunId
  });
  assert.notEqual(failedAttempt.context.scenarioRunId, originalSuccessRunId);
  assert.equal(failedAttempt.lastSuccessfulRunId, originalSuccessRunId);
  assert.equal(failedAttempt.lastSuccessfulRunPreservedUntilSuccess, true);

  const failure = runtime.completeRunAttempt({
    operationId: failedAttempt.operationId,
    status: "failed",
    completedAt: "2026-08-15T15:51:00.000Z",
    errorCode: "S003_EVALUATION_FAILED"
  });
  assert.equal(failure.previousSuccessfulRunPreserved, true);
  assert.equal(failure.retryAllowed, true);
  assert.equal(failure.lastSuccessfulRun.scenarioContext.scenarioRunId, originalSuccessRunId);
  assert.equal(runtime.getLastSuccessfulRun().scenarioContext.scenarioRunId, originalSuccessRunId);

  const retry = runtime.retryFailedRun({
    operationId: "OP-S003-20260815155200000-123456789abc",
    failedOperationId: failedAttempt.operationId
  });
  assert.equal(retry.mode, "retry");
  assert.equal(retry.retryOfOperationId, failedAttempt.operationId);
  assert.notEqual(retry.context.scenarioRunId, failedAttempt.context.scenarioRunId);
  assert.notEqual(retry.context.scenarioRunId, originalSuccessRunId);
  assert.notEqual(retry.runtimeContract.targetNamespace, failedAttempt.runtimeContract.targetNamespace);

  const successRequest = {
    operationId: retry.operationId,
    status: "succeeded",
    completedAt: "2026-08-15T15:53:00.000Z",
    evidenceRef: "evidence/CP07-rerun-retry-validation.md"
  };
  const success = runtime.completeRunAttempt(successRequest);
  const replay = runtime.completeRunAttempt(successRequest);
  const originalAttemptReplay = runtime.beginRerun({
    operationId: failedAttempt.operationId,
    sourceScenarioRunId: originalSuccessRunId
  });
  assert.strictEqual(replay, success);
  assert.strictEqual(originalAttemptReplay, failedAttempt, "后续成功指针变化不得破坏既有 operationId 幂等回放");
  assert.equal(success.previousSuccessfulRunId, originalSuccessRunId);
  assert.equal(success.lastSuccessfulRun.scenarioContext.scenarioRunId, retry.context.scenarioRunId);
  assert.equal(runtime.getLastSuccessfulRun().scenarioContext.scenarioRunId, retry.context.scenarioRunId);
});

test("错误来源 runId、未失败来源重试、非法 operationId 和冲突结果均阻断", () => {
  const runtime = createService();
  assert.throws(
    () => runtime.beginRerun({
      operationId: "OP-S003-20260815160000000-23456789abcd",
      sourceScenarioRunId: "S003-RUN-20260815160000000-deadbeef1234"
    }),
    (error) => error.code === "S003_CHECKPOINT_IDENTITY_MISMATCH"
  );
  assert.throws(
    () => runtime.viewHistorical({checkpointId: checkpoint.checkpointId, operationId: "OP-S003-invalid"}),
    (error) => error.code === "S003_CHECKPOINT_INVALID_OPERATION_ID"
  );

  const attempt = runtime.beginRerun({
    operationId: "OP-S003-20260815160100000-3456789abcde",
    sourceScenarioRunId: checkpoint.scenarioContext.scenarioRunId
  });
  assert.throws(
    () => runtime.retryFailedRun({
      operationId: "OP-S003-20260815160200000-456789abcdef",
      failedOperationId: attempt.operationId
    }),
    (error) => error.code === "S003_CHECKPOINT_RETRY_SOURCE_NOT_FAILED"
  );

  runtime.completeRunAttempt({
    operationId: attempt.operationId,
    status: "failed",
    completedAt: "2026-08-15T16:03:00.000Z",
    errorCode: "S003_TEST_FAILURE"
  });
  assert.throws(
    () => runtime.completeRunAttempt({
      operationId: attempt.operationId,
      status: "succeeded",
      completedAt: "2026-08-15T16:04:00.000Z",
      evidenceRef: "evidence/should-not-overwrite.md"
    }),
    (error) => error.code === "S003_CHECKPOINT_OUTCOME_CONFLICT"
  );
});
