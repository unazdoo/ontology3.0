(function (root, factory) {
  "use strict";

  const foundation = typeof module === "object" && module.exports
    ? require("../../../foundation/ofw-scenario-foundation.js")
    : root && root.OFWScenarioFoundation;
  const api = factory(foundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.S003CheckpointService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (foundation) {
  "use strict";

  const SERVICE_VERSION = "1.0.0";
  const SCENARIO_ID = "S003";
  const BASELINE_VERSION = "1.0.3";
  const BASELINE_SNAPSHOT_ID = "BSL-S001-V103-DE0119608E26";
  const PROTOTYPE_VERSION = "1.1.0";
  const STORAGE_ROOT = "ofw:v1.1.0";
  const OPERATION_ID_RE = /^OP-S003-(\d{17})-([a-f0-9]{12})$/;
  const SCENARIO_RUN_ID_RE = /^S003-RUN-\d{17}-[a-f0-9]{12}$/;
  const SCENARIO_VERSION_RE = /^S003-v(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*$/;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  const DISABLED_CAPABILITIES = deepFreeze({
    actionRequest: false,
    approval: false,
    notification: false,
    ownerTodo: false,
    externalDispatch: false
  });

  class S003CheckpointError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "S003CheckpointError";
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    throw new S003CheckpointError(code, message, details);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value, label) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail("S003_CHECKPOINT_INVALID_JSON", `${label || "值"}必须可安全序列化为 JSON`, {
        cause: error && error.message
      });
    }
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.values(value).forEach((child) => deepFreeze(child, visited));
    return Object.freeze(value);
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (isObject(value)) {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function assertFoundation() {
    if (
      !foundation
      || typeof foundation.assertCheckpointManifest !== "function"
      || typeof foundation.createHistoricalView !== "function"
      || typeof foundation.cloneRestore !== "function"
      || typeof foundation.createIsolatedRegression !== "function"
      || typeof foundation.migrateBaseline !== "function"
    ) {
      fail("S003_CHECKPOINT_FOUNDATION_UNAVAILABLE", "场景公共底座未加载，CP07 运行编排已拒绝启动");
    }
    if (
      foundation.CURRENT_BASELINE_VERSION !== BASELINE_VERSION
      || foundation.CURRENT_BASELINE_SNAPSHOT_ID !== BASELINE_SNAPSHOT_ID
    ) {
      fail("S003_CHECKPOINT_FOUNDATION_BASELINE_MISMATCH", "公共底座未绑定 S001 v1.0.3 最终冻结快照", {
        expected: {
          baselineVersion: BASELINE_VERSION,
          baselineSnapshotId: BASELINE_SNAPSHOT_ID
        },
        actual: {
          baselineVersion: foundation.CURRENT_BASELINE_VERSION,
          baselineSnapshotId: foundation.CURRENT_BASELINE_SNAPSHOT_ID
        }
      });
    }
    return foundation;
  }

  function assertScenarioContext(value, label) {
    let context;
    try {
      context = assertFoundation().assertScenarioContext(value);
    } catch (error) {
      fail("S003_CHECKPOINT_INVALID_SCENARIO_CONTEXT", `${label || "场景上下文"}不合法`, {
        causeCode: error && error.code,
        cause: error && error.message
      });
    }
    if (context.scenarioId !== SCENARIO_ID || !SCENARIO_VERSION_RE.test(context.scenarioVersion)) {
      fail("S003_CHECKPOINT_SCENARIO_MISMATCH", `${label || "场景上下文"}不是 S003 独立身份`, {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion
      });
    }
    return context;
  }

  function assertIdentityMatch(expectedValue, actualValue, options) {
    const expected = assertScenarioContext(expectedValue, "期望场景上下文");
    if (!isObject(actualValue)) {
      fail("S003_CHECKPOINT_IDENTITY_MISSING", "待校验资源缺少场景三元身份");
    }
    const fields = options && options.allowDifferentRunId
      ? ["scenarioId", "scenarioVersion"]
      : ["scenarioId", "scenarioVersion", "scenarioRunId"];
    const mismatches = fields.filter((field) => actualValue[field] !== expected[field]);
    if (mismatches.length) {
      fail("S003_CHECKPOINT_IDENTITY_MISMATCH", "场景身份错配，拒绝查看、恢复、回归或写入", {
        mismatches,
        expected: {
          scenarioId: expected.scenarioId,
          scenarioVersion: expected.scenarioVersion,
          scenarioRunId: expected.scenarioRunId
        },
        actual: {
          scenarioId: actualValue.scenarioId,
          scenarioVersion: actualValue.scenarioVersion,
          scenarioRunId: actualValue.scenarioRunId
        }
      });
    }
    return true;
  }

  function assertCheckpoint(value) {
    let checkpoint;
    try {
      checkpoint = assertFoundation().assertCheckpointManifest(value);
    } catch (error) {
      fail("S003_CHECKPOINT_INVALID_MANIFEST", "S003 Checkpoint 清单校验失败", {
        causeCode: error && error.code,
        cause: error && error.message,
        details: error && error.details
      });
    }
    if (
      checkpoint.baselineVersion !== BASELINE_VERSION
      || checkpoint.parentVersion !== BASELINE_VERSION
      || checkpoint.baselineSnapshotId !== BASELINE_SNAPSHOT_ID
    ) {
      fail("S003_CHECKPOINT_BASELINE_MISMATCH", "S003 只能从 S001 v1.0.3 最终冻结快照执行 CP07 运行语义", {
        expected: {
          baselineVersion: BASELINE_VERSION,
          parentVersion: BASELINE_VERSION,
          baselineSnapshotId: BASELINE_SNAPSHOT_ID
        },
        actual: {
          baselineVersion: checkpoint.baselineVersion,
          parentVersion: checkpoint.parentVersion,
          baselineSnapshotId: checkpoint.baselineSnapshotId
        }
      });
    }
    const context = assertScenarioContext(checkpoint.scenarioContext, "Checkpoint 场景上下文");
    if (checkpoint.sourceScenarioRunId !== context.scenarioRunId) {
      fail("S003_CHECKPOINT_IDENTITY_MISMATCH", "Checkpoint 来源 runId 与锁定场景 runId 不一致");
    }
    return checkpoint;
  }

  function parseTimestamp17(value) {
    const iso = [
      value.slice(0, 4), "-", value.slice(4, 6), "-", value.slice(6, 8), "T",
      value.slice(8, 10), ":", value.slice(10, 12), ":", value.slice(12, 14), ".",
      value.slice(14, 17), "Z"
    ].join("");
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()) || date.toISOString() !== iso) {
      fail("S003_CHECKPOINT_INVALID_OPERATION_ID", "operationId 中的 UTC 时间无效", {timestamp17: value});
    }
    return date;
  }

  function parseOperationId(value) {
    const match = typeof value === "string" ? value.match(OPERATION_ID_RE) : null;
    if (!match) {
      fail(
        "S003_CHECKPOINT_INVALID_OPERATION_ID",
        "operationId 必须使用 OP-S003-17位UTC时间-12位小写十六进制随机码"
      );
    }
    return {
      operationId: value,
      timestamp17: match[1],
      nonceHex: match[2],
      now: parseTimestamp17(match[1])
    };
  }

  function fnv32(value, seed) {
    let hash = seed === undefined ? 2166136261 : seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function deterministicBytes(operation, purpose, size) {
    const nonce = Uint8Array.from(operation.nonceHex.match(/../g).map((part) => Number.parseInt(part, 16)));
    let state = fnv32(`${operation.operationId}|${purpose}`);
    const bytes = new Uint8Array(size);
    for (let index = 0; index < size; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      bytes[index] = nonce[index % nonce.length] ^ ((state >>> ((index % 4) * 8)) & 0xff);
    }
    return bytes;
  }

  function foundationOptions(operation, purpose) {
    return {
      now: operation.now,
      randomBytes(size) {
        return deterministicBytes(operation, purpose, size);
      }
    };
  }

  function namespaceFor(context) {
    return `${STORAGE_ROOT}:${context.scenarioId}:${context.scenarioVersion}:${context.scenarioRunId}`;
  }

  function withRuntimeContract(receipt, operationId, sourceContext, extra) {
    const result = {
      ...cloneJson(receipt, "公共底座运行回执"),
      operationId,
      runtimeContract: {
        sourceNamespace: namespaceFor(sourceContext),
        sourceAccess: "read-only",
        historyMutation: false,
        ...(extra || {})
      },
      disabledCapabilities: DISABLED_CAPABILITIES
    };
    return deepFreeze(result);
  }

  function normalizeLastSuccessfulRun(value, expectedScenarioVersion) {
    if (value === undefined || value === null) return null;
    if (!isObject(value)) {
      fail("S003_CHECKPOINT_INVALID_SUCCESS_RECORD", "lastSuccessfulRun 必须是普通对象");
    }
    const context = assertScenarioContext(value.scenarioContext, "上一成功运行身份");
    if (context.scenarioVersion !== expectedScenarioVersion) {
      fail("S003_CHECKPOINT_IDENTITY_MISMATCH", "上一成功运行与 Checkpoint 的 scenarioVersion 不一致", {
        expectedScenarioVersion,
        actualScenarioVersion: context.scenarioVersion
      });
    }
    if (typeof value.completedAt !== "string" || !ISO_RE.test(value.completedAt) || Number.isNaN(Date.parse(value.completedAt))) {
      fail("S003_CHECKPOINT_INVALID_SUCCESS_RECORD", "上一成功运行 completedAt 必须是 UTC ISO 时间");
    }
    if (typeof value.evidenceRef !== "string" || !value.evidenceRef.trim()) {
      fail("S003_CHECKPOINT_INVALID_SUCCESS_RECORD", "上一成功运行必须提供 evidenceRef");
    }
    return deepFreeze({
      scenarioContext: context,
      completedAt: value.completedAt,
      evidenceRef: value.evidenceRef.trim(),
      sourceOperationId: value.sourceOperationId || null
    });
  }

  function createCheckpointService(input) {
    assertFoundation();
    if (!isObject(input)) {
      fail("S003_CHECKPOINT_INVALID_INPUT", "创建 S003 Checkpoint 服务需要普通对象输入");
    }
    const sourceCheckpoints = Array.isArray(input.checkpoints)
      ? input.checkpoints
      : input.checkpoint
        ? [input.checkpoint]
        : [];
    if (!sourceCheckpoints.length) {
      fail("S003_CHECKPOINT_MISSING_MANIFEST", "至少需要一个已封存的 S003 Checkpoint 清单");
    }

    const checkpoints = new Map();
    sourceCheckpoints.forEach((value) => {
      const checkpoint = assertCheckpoint(value);
      if (checkpoints.has(checkpoint.checkpointId)) {
        fail("S003_CHECKPOINT_DUPLICATE_MANIFEST", "Checkpoint ID 重复", {checkpointId: checkpoint.checkpointId});
      }
      checkpoints.set(checkpoint.checkpointId, checkpoint);
    });
    const scenarioVersions = new Set(Array.from(checkpoints.values()).map((item) => item.scenarioContext.scenarioVersion));
    if (scenarioVersions.size !== 1) {
      fail("S003_CHECKPOINT_IDENTITY_MISMATCH", "同一运行服务不得混装多个 scenarioVersion 的 Checkpoint");
    }
    const scenarioVersion = Array.from(scenarioVersions)[0];
    let lastSuccessfulRun = normalizeLastSuccessfulRun(input.lastSuccessfulRun, scenarioVersion);
    const operations = new Map();
    const attempts = new Map();

    function checkpointById(checkpointId) {
      const checkpoint = checkpoints.get(checkpointId);
      if (!checkpoint) {
        fail("S003_CHECKPOINT_NOT_FOUND", "未找到指定 Checkpoint", {checkpointId});
      }
      return checkpoint;
    }

    function executeIdempotent(mode, operationId, payload, executor) {
      const operation = parseOperationId(operationId);
      const signature = stableJson({mode, payload});
      const existing = operations.get(operationId);
      if (existing) {
        if (existing.signature !== signature) {
          fail("S003_CHECKPOINT_OPERATION_CONFLICT", "同一 operationId 不得用于不同操作或不同输入", {
            operationId,
            existingMode: existing.mode,
            requestedMode: mode
          });
        }
        return existing.receipt;
      }
      const receipt = deepFreeze(executor(operation));
      operations.set(operationId, {mode, signature, receipt});
      return receipt;
    }

    function createFreshContext(operation, purpose, version, status) {
      const context = assertFoundation().createScenarioContext(
        {scenarioId: SCENARIO_ID, scenarioVersion: version, status},
        foundationOptions(operation, purpose)
      );
      if (!SCENARIO_RUN_ID_RE.test(context.scenarioRunId)) {
        fail("S003_CHECKPOINT_INVALID_SCENARIO_CONTEXT", "公共底座生成了非法 scenarioRunId");
      }
      return context;
    }

    function viewHistorical(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "历史查看需要普通对象输入");
      const checkpoint = checkpointById(request.checkpointId);
      return executeIdempotent("historical-view", request.operationId, {checkpointId: checkpoint.checkpointId}, (operation) => {
        const receipt = assertFoundation().createHistoricalView(
          checkpoint,
          foundationOptions(operation, `historical-view|${checkpoint.checkpointId}`)
        );
        return withRuntimeContract(receipt, operation.operationId, checkpoint.scenarioContext, {
          targetNamespace: namespaceFor(checkpoint.scenarioContext),
          targetAccess: "read-only",
          cloneMode: "none"
        });
      });
    }

    function cloneRestore(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "克隆恢复需要普通对象输入");
      const checkpoint = checkpointById(request.checkpointId);
      return executeIdempotent("clone-restore", request.operationId, {checkpointId: checkpoint.checkpointId}, (operation) => {
        const receipt = assertFoundation().cloneRestore(
          checkpoint,
          foundationOptions(operation, `clone-restore|${checkpoint.checkpointId}`)
        );
        if (receipt.context.scenarioRunId === checkpoint.scenarioContext.scenarioRunId) {
          fail("S003_CHECKPOINT_RUN_ID_REUSE", "克隆恢复不得复用来源 scenarioRunId");
        }
        return withRuntimeContract(receipt, operation.operationId, checkpoint.scenarioContext, {
          targetNamespace: namespaceFor(receipt.context),
          targetAccess: "isolated-write",
          requiresEmptyTargetNamespace: true,
          cloneMode: "isolated-clone"
        });
      });
    }

    function createRegression(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "隔离回归需要普通对象输入");
      const checkpoint = checkpointById(request.checkpointId);
      return executeIdempotent("isolated-regression", request.operationId, {checkpointId: checkpoint.checkpointId}, (operation) => {
        const receipt = assertFoundation().createIsolatedRegression(
          checkpoint,
          foundationOptions(operation, `isolated-regression|${checkpoint.checkpointId}`)
        );
        if (receipt.context.scenarioRunId === checkpoint.scenarioContext.scenarioRunId) {
          fail("S003_CHECKPOINT_RUN_ID_REUSE", "隔离回归不得复用来源 scenarioRunId");
        }
        return withRuntimeContract(receipt, operation.operationId, checkpoint.scenarioContext, {
          targetNamespace: namespaceFor(receipt.context),
          targetAccess: "isolated-write",
          requiresEmptyTargetNamespace: true,
          cloneMode: "isolated-regression",
          outboundMode: "drill-only"
        });
      });
    }

    function migrateBaseline(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "基线迁移需要普通对象输入");
      const checkpoint = checkpointById(request.checkpointId);
      const payload = {
        checkpointId: checkpoint.checkpointId,
        targetBaselineVersion: request.targetBaselineVersion,
        targetBaselineSnapshotId: request.targetBaselineSnapshotId,
        targetScenarioVersion: request.targetScenarioVersion
      };
      return executeIdempotent("baseline-migration", request.operationId, payload, (operation) => {
        let receipt;
        try {
          receipt = assertFoundation().migrateBaseline(
            checkpoint,
            {
              targetBaselineVersion: request.targetBaselineVersion,
              targetBaselineSnapshotId: request.targetBaselineSnapshotId,
              targetScenarioVersion: request.targetScenarioVersion
            },
            foundationOptions(operation, `baseline-migration|${stableJson(payload)}`)
          );
        } catch (error) {
          fail("S003_CHECKPOINT_MIGRATION_REJECTED", "基线迁移不满足新版本/新运行身份约束", {
            causeCode: error && error.code,
            cause: error && error.message
          });
        }
        if (
          receipt.context.scenarioVersion === checkpoint.scenarioContext.scenarioVersion
          || receipt.context.scenarioRunId === checkpoint.scenarioContext.scenarioRunId
        ) {
          fail("S003_CHECKPOINT_IN_PLACE_MIGRATION", "基线迁移必须同时创建新的 scenarioVersion 和 scenarioRunId");
        }
        return withRuntimeContract(receipt, operation.operationId, checkpoint.scenarioContext, {
          targetNamespace: namespaceFor(receipt.context),
          targetAccess: "isolated-write",
          requiresEmptyTargetNamespace: true,
          cloneMode: "baseline-migration",
          migrationComparisonRequired: true
        });
      });
    }

    function beginRerun(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "开始重评需要普通对象输入");
      const payload = {sourceScenarioRunId: request.sourceScenarioRunId};
      return executeIdempotent("rerun", request.operationId, payload, (operation) => {
        if (!lastSuccessfulRun) {
          fail("S003_CHECKPOINT_NO_SUCCESSFUL_RUN", "没有可保留的上一成功运行，不能开始快速重评");
        }
        if (request.sourceScenarioRunId !== lastSuccessfulRun.scenarioContext.scenarioRunId) {
          fail("S003_CHECKPOINT_IDENTITY_MISMATCH", "快速重评来源必须精确指向上一成功 scenarioRunId", {
            expected: lastSuccessfulRun.scenarioContext.scenarioRunId,
            actual: request.sourceScenarioRunId
          });
        }
        const context = createFreshContext(operation, `rerun|${request.sourceScenarioRunId}`, scenarioVersion, "active");
        if (context.scenarioRunId === request.sourceScenarioRunId) {
          fail("S003_CHECKPOINT_RUN_ID_REUSE", "快速重评必须创建新的 scenarioRunId");
        }
        const receipt = deepFreeze({
          operationId: operation.operationId,
          mode: "rerun",
          sourceScenarioRunId: request.sourceScenarioRunId,
          context,
          runtimeContract: {
            sourceNamespace: namespaceFor(lastSuccessfulRun.scenarioContext),
            sourceAccess: "read-only",
            targetNamespace: namespaceFor(context),
            targetAccess: "isolated-write",
            requiresEmptyTargetNamespace: true,
            historyMutation: false
          },
          lastSuccessfulRunId: lastSuccessfulRun.scenarioContext.scenarioRunId,
          lastSuccessfulRunPreservedUntilSuccess: true,
          disabledCapabilities: DISABLED_CAPABILITIES,
          sideEffectPolicy: assertFoundation().SIDE_EFFECT_POLICY
        });
        attempts.set(operation.operationId, {receipt, completion: null, completionSignature: null});
        return receipt;
      });
    }

    function retryFailedRun(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "失败重试需要普通对象输入");
      const failedAttempt = attempts.get(request.failedOperationId);
      if (!failedAttempt || !failedAttempt.completion || failedAttempt.completion.status !== "failed") {
        fail("S003_CHECKPOINT_RETRY_SOURCE_NOT_FAILED", "只能从已经明确失败的运行创建重试", {
          failedOperationId: request.failedOperationId
        });
      }
      const payload = {failedOperationId: request.failedOperationId};
      return executeIdempotent("retry", request.operationId, payload, (operation) => {
        const sourceContext = failedAttempt.receipt.context;
        const context = createFreshContext(operation, `retry|${request.failedOperationId}`, sourceContext.scenarioVersion, "active");
        if (context.scenarioRunId === sourceContext.scenarioRunId) {
          fail("S003_CHECKPOINT_RUN_ID_REUSE", "失败重试必须创建新的 scenarioRunId");
        }
        const receipt = deepFreeze({
          operationId: operation.operationId,
          mode: "retry",
          retryOfOperationId: request.failedOperationId,
          sourceScenarioRunId: sourceContext.scenarioRunId,
          context,
          runtimeContract: {
            sourceNamespace: namespaceFor(sourceContext),
            sourceAccess: "read-only",
            targetNamespace: namespaceFor(context),
            targetAccess: "isolated-write",
            requiresEmptyTargetNamespace: true,
            historyMutation: false
          },
          lastSuccessfulRunId: lastSuccessfulRun && lastSuccessfulRun.scenarioContext.scenarioRunId,
          lastSuccessfulRunPreservedUntilSuccess: true,
          disabledCapabilities: DISABLED_CAPABILITIES,
          sideEffectPolicy: assertFoundation().SIDE_EFFECT_POLICY
        });
        attempts.set(operation.operationId, {receipt, completion: null, completionSignature: null});
        return receipt;
      });
    }

    function completeRunAttempt(request) {
      if (!isObject(request)) fail("S003_CHECKPOINT_INVALID_INPUT", "运行完成登记需要普通对象输入");
      parseOperationId(request.operationId);
      const attempt = attempts.get(request.operationId);
      if (!attempt) {
        fail("S003_CHECKPOINT_ATTEMPT_NOT_FOUND", "未找到对应运行尝试", {operationId: request.operationId});
      }
      if (!['succeeded', 'failed'].includes(request.status)) {
        fail("S003_CHECKPOINT_INVALID_OUTCOME", "运行结果必须是 succeeded 或 failed");
      }
      if (typeof request.completedAt !== "string" || !ISO_RE.test(request.completedAt) || Number.isNaN(Date.parse(request.completedAt))) {
        fail("S003_CHECKPOINT_INVALID_OUTCOME", "completedAt 必须是 UTC ISO 时间");
      }
      if (request.status === "succeeded" && (typeof request.evidenceRef !== "string" || !request.evidenceRef.trim())) {
        fail("S003_CHECKPOINT_INVALID_OUTCOME", "成功运行必须提供 evidenceRef");
      }
      if (request.status === "failed" && (typeof request.errorCode !== "string" || !request.errorCode.trim())) {
        fail("S003_CHECKPOINT_INVALID_OUTCOME", "失败运行必须提供 errorCode");
      }
      const signature = stableJson({
        status: request.status,
        completedAt: request.completedAt,
        evidenceRef: request.evidenceRef || null,
        errorCode: request.errorCode || null
      });
      if (attempt.completion) {
        if (attempt.completionSignature !== signature) {
          fail("S003_CHECKPOINT_OUTCOME_CONFLICT", "同一运行尝试不得登记冲突结果", {
            operationId: request.operationId,
            existingStatus: attempt.completion.status,
            requestedStatus: request.status
          });
        }
        return attempt.completion;
      }

      const previousSuccessfulRun = lastSuccessfulRun;
      if (request.status === "succeeded") {
        lastSuccessfulRun = deepFreeze({
          scenarioContext: attempt.receipt.context,
          completedAt: request.completedAt,
          evidenceRef: request.evidenceRef.trim(),
          sourceOperationId: request.operationId
        });
      }
      const completion = deepFreeze({
        operationId: request.operationId,
        status: request.status,
        scenarioContext: attempt.receipt.context,
        completedAt: request.completedAt,
        evidenceRef: request.status === "succeeded" ? request.evidenceRef.trim() : null,
        errorCode: request.status === "failed" ? request.errorCode.trim() : null,
        previousSuccessfulRunId: previousSuccessfulRun && previousSuccessfulRun.scenarioContext.scenarioRunId,
        lastSuccessfulRun,
        previousSuccessfulRunPreserved: request.status === "failed",
        retryAllowed: request.status === "failed",
        historyMutation: false,
        disabledCapabilities: DISABLED_CAPABILITIES
      });
      attempt.completion = completion;
      attempt.completionSignature = signature;
      return completion;
    }

    function getLastSuccessfulRun() {
      return lastSuccessfulRun;
    }

    function getAttempt(operationId) {
      parseOperationId(operationId);
      const attempt = attempts.get(operationId);
      if (!attempt) return null;
      return deepFreeze({receipt: attempt.receipt, completion: attempt.completion});
    }

    return Object.freeze({
      serviceVersion: SERVICE_VERSION,
      scenarioId: SCENARIO_ID,
      scenarioVersion,
      baselineVersion: BASELINE_VERSION,
      baselineSnapshotId: BASELINE_SNAPSHOT_ID,
      listCheckpointIds() {
        return Object.freeze(Array.from(checkpoints.keys()).sort());
      },
      viewHistorical,
      cloneRestore,
      createRegression,
      migrateBaseline,
      beginRerun,
      retryFailedRun,
      completeRunAttempt,
      getLastSuccessfulRun,
      getAttempt,
      assertIdentityMatch
    });
  }

  return Object.freeze({
    SERVICE_VERSION,
    SCENARIO_ID,
    BASELINE_VERSION,
    BASELINE_SNAPSHOT_ID,
    PROTOTYPE_VERSION,
    STORAGE_ROOT,
    DISABLED_CAPABILITIES,
    S003CheckpointError,
    assertIdentityMatch,
    createCheckpointService
  });
});
