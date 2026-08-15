(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.OFWScenarioFoundation = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FOUNDATION_VERSION = "1.0.0";
  const STORAGE_SCHEMA_VERSION = "ofw.namespaced-storage.v1";
  const CHECKPOINT_SCHEMA_VERSION = "ofw.c034.checkpoint.v1";
  const CURRENT_BASELINE_VERSION = "1.0.3";
  const CURRENT_BASELINE_SNAPSHOT_ID = "BSL-S001-V103-DE0119608E26";
  const STORAGE_ROOT = "ofw:v1.1.0";

  const MODULE_IDS = Object.freeze(["M01", "M02", "M03", "M04", "M05", "M06"]);
  const STATE_SECTION_NAMES = Object.freeze([
    "data",
    "semantics",
    "configurations",
    "results",
    "reports",
    "decisions",
    "testFixtures",
    "featureFlags",
    "evidence"
  ]);
  const CHECKPOINT_NODES = Object.freeze([
    "initial-configured",
    "data-connected",
    "published-switched",
    "query-integrated",
    "decision-chain-completed",
    "agent-report-dashboard-completed",
    "e2e-integrated",
    "pre-risk-change"
  ]);
  const CONTEXT_STATUSES = Object.freeze([
    "active",
    "restored",
    "regression",
    "migrated",
    "historical-readonly",
    "closed"
  ]);
  const SIDE_EFFECT_POLICY = deepFreeze({
    allowHistoricalActionRequestReplay: false,
    allowHistoricalNotificationReplay: false,
    allowHistoricalApprovalReplay: false,
    allowHistoricalTodoReplay: false,
    allowExternalDispatch: false
  });

  const SCENARIO_ID_RE = /^S\d{3}$/;
  const SCENARIO_VERSION_RE = /^(S\d{3})-v(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*))*$/;
  const SCENARIO_RUN_ID_RE = /^(S\d{3})-RUN-(\d{17})-([a-f0-9]{12})$/;
  const SEMVER_RE = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
  const SHA256_RE = /^[a-f0-9]{64}$/i;
  const BASELINE_SNAPSHOT_ID_RE = /^BSL-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
  const CHECKPOINT_ID_RE = /^CP-S\d{3}-\d{17}-[a-f0-9]{12}$/;
  const SCOPE_RE = /^[a-z][a-z0-9._-]{0,63}$/;
  const LOGICAL_KEY_RE = /^[A-Za-z][A-Za-z0-9._/-]{0,127}$/;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  const FORBIDDEN_SUCCESS_FIELDS = Object.freeze([
    "acceptanceReady",
    "businessSuccess",
    "successState",
    "completedSteps",
    "totalSteps",
    "decisionDistribution"
  ]);

  class FoundationError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "FoundationError";
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    throw new FoundationError(code, message, details);
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function cloneJson(value, label) {
    if (value === undefined) {
      fail("INVALID_JSON_VALUE", `${label || "值"}不能是 undefined`);
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail("INVALID_JSON_VALUE", `${label || "值"}必须可安全序列化为 JSON`, {
        cause: error && error.message
      });
    }
  }

  function deepFreeze(value, seen) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    const visited = seen || new Set();
    if (visited.has(value)) return value;
    visited.add(value);
    Object.keys(value).forEach(function (key) {
      deepFreeze(value[key], visited);
    });
    return Object.freeze(value);
  }

  function hasOnlyKeys(value, allowedKeys, errors, path) {
    if (!isPlainObject(value)) return;
    const allowed = new Set(allowedKeys);
    Object.keys(value).forEach(function (key) {
      if (!allowed.has(key)) {
        errors.push({
          code: "UNKNOWN_FIELD",
          path: `${path}.${key}`,
          message: "存在未定义字段"
        });
      }
    });
  }

  function addError(errors, code, path, message) {
    errors.push({ code: code, path: path, message: message });
  }

  function normalizeDate(value, fieldName) {
    const date = value === undefined ? new Date() : value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      fail("INVALID_TIME", `${fieldName || "时间"}无效`, { value: value });
    }
    return date;
  }

  function toIso(value, fieldName) {
    return normalizeDate(value, fieldName).toISOString();
  }

  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  function timestamp17(value) {
    const date = normalizeDate(value, "ID 时间");
    return [
      pad(date.getUTCFullYear(), 4),
      pad(date.getUTCMonth() + 1, 2),
      pad(date.getUTCDate(), 2),
      pad(date.getUTCHours(), 2),
      pad(date.getUTCMinutes(), 2),
      pad(date.getUTCSeconds(), 2),
      pad(date.getUTCMilliseconds(), 3)
    ].join("");
  }

  function secureRandomBytes(size, randomBytes) {
    let bytes;
    if (typeof randomBytes === "function") {
      bytes = randomBytes(size);
    } else if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      bytes = new Uint8Array(size);
      globalThis.crypto.getRandomValues(bytes);
    } else {
      fail("CRYPTO_UNAVAILABLE", "当前环境没有可用的安全随机数生成器");
    }
    if (!(bytes instanceof Uint8Array) || bytes.length !== size) {
      fail("INVALID_RANDOM_BYTES", `随机数生成器必须返回长度为 ${size} 的 Uint8Array`);
    }
    return bytes;
  }

  function randomHex(byteLength, randomBytes) {
    return Array.from(secureRandomBytes(byteLength, randomBytes))
      .map(function (value) {
        return value.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function validateScenarioIdentity(scenarioId, scenarioVersion, scenarioRunId) {
    const errors = [];
    if (typeof scenarioId !== "string" || !SCENARIO_ID_RE.test(scenarioId)) {
      addError(errors, "INVALID_SCENARIO_ID", "scenarioId", "必须使用 S 加三位数字，例如 S002");
    }

    const versionMatch = typeof scenarioVersion === "string" ? scenarioVersion.match(SCENARIO_VERSION_RE) : null;
    if (!versionMatch) {
      addError(errors, "INVALID_SCENARIO_VERSION", "scenarioVersion", "必须使用场景前缀和版本，例如 S002-v1");
    } else if (versionMatch[1] !== scenarioId) {
      addError(errors, "SCENARIO_VERSION_MISMATCH", "scenarioVersion", "场景版本前缀必须与 scenarioId 一致");
    }

    const runMatch = typeof scenarioRunId === "string" ? scenarioRunId.match(SCENARIO_RUN_ID_RE) : null;
    if (!runMatch) {
      addError(
        errors,
        "INVALID_SCENARIO_RUN_ID",
        "scenarioRunId",
        "必须使用 Sxxx-RUN-17位UTC时间-12位小写十六进制随机码"
      );
    } else if (runMatch[1] !== scenarioId) {
      addError(errors, "SCENARIO_RUN_MISMATCH", "scenarioRunId", "运行轮次前缀必须与 scenarioId 一致");
    }
    return errors;
  }

  function validateScenarioContext(value) {
    const errors = [];
    if (!isPlainObject(value)) {
      addError(errors, "INVALID_CONTEXT", "$", "场景上下文必须是普通对象");
      return { ok: false, errors: errors };
    }
    hasOnlyKeys(value, ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"], errors, "$context");
    validateScenarioIdentity(value.scenarioId, value.scenarioVersion, value.scenarioRunId).forEach(function (error) {
      errors.push(error);
    });
    if (typeof value.formedAt !== "string" || !ISO_RE.test(value.formedAt) || Number.isNaN(Date.parse(value.formedAt))) {
      addError(errors, "INVALID_FORMED_AT", "formedAt", "必须是带毫秒和 Z 的 UTC ISO 时间");
    }
    if (!CONTEXT_STATUSES.includes(value.status)) {
      addError(errors, "INVALID_CONTEXT_STATUS", "status", `必须是 ${CONTEXT_STATUSES.join("、")} 之一`);
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function assertScenarioContext(value) {
    const result = validateScenarioContext(value);
    if (!result.ok) {
      fail("INVALID_SCENARIO_CONTEXT", "场景上下文校验失败", result.errors);
    }
    return deepFreeze(cloneJson(value, "场景上下文"));
  }

  function createScenarioRunId(scenarioId, options) {
    const config = options || {};
    if (typeof scenarioId !== "string" || !SCENARIO_ID_RE.test(scenarioId)) {
      fail("INVALID_SCENARIO_ID", "scenarioId 必须使用 S 加三位数字，例如 S002");
    }
    return `${scenarioId}-RUN-${timestamp17(config.now)}-${randomHex(6, config.randomBytes)}`;
  }

  function createScenarioContext(input, options) {
    if (!isPlainObject(input)) {
      fail("INVALID_CONTEXT_INPUT", "创建场景上下文需要普通对象输入");
    }
    const config = options || {};
    const formedAt = toIso(config.now, "场景上下文形成时间");
    const context = {
      scenarioId: input.scenarioId,
      scenarioVersion: input.scenarioVersion,
      scenarioRunId: createScenarioRunId(input.scenarioId, config),
      formedAt: formedAt,
      status: input.status || "active"
    };
    return assertScenarioContext(context);
  }

  function assertScenarioContextMatch(expectedValue, actualValue, options) {
    const expected = assertScenarioContext(expectedValue);
    const actual = assertScenarioContext(actualValue);
    const config = options || {};
    const fields = config.allowDifferentRunId
      ? ["scenarioId", "scenarioVersion"]
      : ["scenarioId", "scenarioVersion", "scenarioRunId"];
    const mismatches = fields.filter(function (field) {
      return expected[field] !== actual[field];
    });
    if (mismatches.length) {
      fail("SCENARIO_CONTEXT_MISMATCH", "场景上下文错配，拒绝读取或写入", {
        mismatches: mismatches,
        expected: expected,
        actual: actual
      });
    }
    return true;
  }

  function assertStorageLike(storage) {
    if (
      !storage ||
      typeof storage.getItem !== "function" ||
      typeof storage.setItem !== "function" ||
      typeof storage.removeItem !== "function" ||
      typeof storage.key !== "function" ||
      typeof storage.length !== "number"
    ) {
      fail("INVALID_STORAGE", "storage 必须实现浏览器 Storage 的最小接口");
    }
    return storage;
  }

  function validateScope(scope) {
    if (typeof scope !== "string" || !SCOPE_RE.test(scope)) {
      fail("INVALID_STORAGE_SCOPE", "scope 必须以小写字母开头，仅包含小写字母、数字、点、下划线或连字符");
    }
    return scope;
  }

  function validateLogicalKey(key) {
    if (typeof key !== "string" || !LOGICAL_KEY_RE.test(key) || key.includes("..")) {
      fail("INVALID_STORAGE_KEY", "逻辑键必须是受限的相对键，禁止空值、冒号和 .. 路径");
    }
    return key;
  }

  function runStoragePrefix(context) {
    const value = assertScenarioContext(context);
    return `${STORAGE_ROOT}:${value.scenarioId}:${value.scenarioVersion}:${value.scenarioRunId}:`;
  }

  function namespacePrefix(context, scope) {
    return `${runStoragePrefix(context)}${validateScope(scope)}:`;
  }

  function collectStorageKeys(storage) {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (typeof key === "string") keys.push(key);
    }
    return keys;
  }

  function removeByExactPrefix(storage, prefix) {
    const removedKeys = collectStorageKeys(storage).filter(function (key) {
      return key.startsWith(prefix);
    });
    removedKeys.forEach(function (key) {
      storage.removeItem(key);
    });
    return removedKeys;
  }

  function createNamespacedStorage(input) {
    if (!isPlainObject(input)) {
      fail("INVALID_STORAGE_INPUT", "创建命名空间存储适配器需要普通对象输入");
    }
    const storage = assertStorageLike(input.storage);
    const context = assertScenarioContext(input.context);
    if (context.status === "historical-readonly" || context.status === "closed") {
      fail("READ_ONLY_CONTEXT", "只读历史或已关闭场景上下文不能创建可写存储适配器");
    }
    const scope = validateScope(input.scope);
    const prefix = namespacePrefix(context, scope);

    function keyFor(logicalKey) {
      return `${prefix}${encodeURIComponent(validateLogicalKey(logicalKey))}`;
    }

    function set(logicalKey, payload, options) {
      const savedAt = toIso(options && options.now, "存储时间");
      const envelope = {
        schemaVersion: STORAGE_SCHEMA_VERSION,
        scenarioContext: context,
        savedAt: savedAt,
        payload: cloneJson(payload, "存储载荷")
      };
      storage.setItem(keyFor(logicalKey), JSON.stringify(envelope));
      return deepFreeze(cloneJson(envelope));
    }

    function get(logicalKey) {
      const raw = storage.getItem(keyFor(logicalKey));
      if (raw === null) return null;
      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch (error) {
        fail("CORRUPT_STORAGE_RECORD", "命名空间记录不是有效 JSON", { key: logicalKey });
      }
      if (!isPlainObject(envelope) || envelope.schemaVersion !== STORAGE_SCHEMA_VERSION) {
        fail("CORRUPT_STORAGE_RECORD", "命名空间记录 schemaVersion 不兼容", { key: logicalKey });
      }
      assertScenarioContextMatch(context, envelope.scenarioContext);
      return deepFreeze(cloneJson(envelope.payload, "存储载荷"));
    }

    function remove(logicalKey) {
      storage.removeItem(keyFor(logicalKey));
    }

    function keys() {
      return collectStorageKeys(storage)
        .filter(function (key) {
          return key.startsWith(prefix);
        })
        .map(function (key) {
          const encoded = key.slice(prefix.length);
          try {
            return decodeURIComponent(encoded);
          } catch (error) {
            fail("CORRUPT_STORAGE_KEY", "命名空间内存在不可解码的键", { key: key });
          }
        })
        .sort();
    }

    function clearNamespace() {
      return Object.freeze(removeByExactPrefix(storage, prefix).slice());
    }

    return Object.freeze({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      context: context,
      scope: scope,
      keyFor: keyFor,
      set: set,
      get: get,
      remove: remove,
      has: function (logicalKey) {
        return storage.getItem(keyFor(logicalKey)) !== null;
      },
      keys: keys,
      clearNamespace: clearNamespace
    });
  }

  function createOperationId(scenarioId, options) {
    const config = options || {};
    return `OP-${scenarioId}-${timestamp17(config.now)}-${randomHex(6, config.randomBytes)}`;
  }

  function directionalReset(input, options) {
    if (!isPlainObject(input)) {
      fail("INVALID_RESET_INPUT", "定向重置需要普通对象输入");
    }
    const storage = assertStorageLike(input.storage);
    const currentContext = assertScenarioContext(input.currentContext);
    if (["historical-readonly", "closed"].includes(currentContext.status)) {
      fail("READ_ONLY_CONTEXT", "历史只读或已关闭轮次不能执行定向重置");
    }
    const config = options || {};
    const removedKeys = removeByExactPrefix(storage, runStoragePrefix(currentContext));
    const nextContext = createScenarioContext(
      {
        scenarioId: currentContext.scenarioId,
        scenarioVersion: currentContext.scenarioVersion,
        status: "active"
      },
      config
    );
    return deepFreeze({
      operationId: createOperationId(currentContext.scenarioId, config),
      mode: "directional-reset",
      previousContext: currentContext,
      context: nextContext,
      removedStorageKeys: removedKeys,
      removedStorageKeyCount: removedKeys.length,
      preservedHistory: true,
      sideEffectPolicy: SIDE_EFFECT_POLICY
    });
  }

  function findForbiddenSuccessFields(value, path, findings, seen) {
    if (!value || typeof value !== "object") return;
    const visited = seen || new Set();
    if (visited.has(value)) return;
    visited.add(value);
    Object.keys(value).forEach(function (key) {
      const childPath = `${path}.${key}`;
      if (FORBIDDEN_SUCCESS_FIELDS.includes(key)) findings.push(childPath);
      findForbiddenSuccessFields(value[key], childPath, findings, visited);
    });
  }

  function validateModuleEntry(moduleId, value, errors) {
    const path = `modules.${moduleId}`;
    if (!isPlainObject(value)) {
      addError(errors, "INVALID_MODULE_ENTRY", path, "模块条目必须是普通对象");
      return;
    }
    hasOnlyKeys(
      value,
      ["moduleId", "moduleVersion", "exportId", "exportRef", "exportSha256", "validation", "restoreMode"],
      errors,
      path
    );
    if (value.moduleId !== moduleId) addError(errors, "MODULE_ID_MISMATCH", `${path}.moduleId`, "必须与模块键一致");
    ["moduleVersion", "exportId", "exportRef"].forEach(function (field) {
      if (typeof value[field] !== "string" || !value[field].trim()) {
        addError(errors, "MISSING_MODULE_FIELD", `${path}.${field}`, "必须提供非空精确值");
      }
    });
    if (typeof value.exportSha256 !== "string" || !SHA256_RE.test(value.exportSha256)) {
      addError(errors, "INVALID_SHA256", `${path}.exportSha256`, "必须是 64 位 SHA-256");
    }
    if (!isPlainObject(value.validation)) {
      addError(errors, "INVALID_MODULE_VALIDATION", `${path}.validation`, "必须提供 Owner 校验回执");
    } else {
      hasOnlyKeys(value.validation, ["status", "validatedAt", "evidenceRef"], errors, `${path}.validation`);
      if (value.validation.status !== "verified") {
        addError(errors, "MODULE_NOT_VERIFIED", `${path}.validation.status`, "正式检查点只接受 verified 回执");
      }
      if (
        typeof value.validation.validatedAt !== "string" ||
        !ISO_RE.test(value.validation.validatedAt) ||
        Number.isNaN(Date.parse(value.validation.validatedAt))
      ) {
        addError(errors, "INVALID_VALIDATION_TIME", `${path}.validation.validatedAt`, "必须是 UTC ISO 时间");
      }
      if (typeof value.validation.evidenceRef !== "string" || !value.validation.evidenceRef.trim()) {
        addError(errors, "MISSING_EVIDENCE_REF", `${path}.validation.evidenceRef`, "必须提供稳定证据入口");
      }
    }
    if (value.restoreMode !== "isolated-clone") {
      addError(errors, "INVALID_RESTORE_MODE", `${path}.restoreMode`, "最小公共底座只接受 isolated-clone");
    }
  }

  function validateStateRefItem(value, errors, path) {
    if (!isPlainObject(value)) {
      addError(errors, "INVALID_STATE_REF", path, "状态引用必须是普通对象");
      return;
    }
    hasOnlyKeys(value, ["owner", "resourceId", "version", "ref", "sha256", "formedAt"], errors, path);
    ["owner", "resourceId", "version", "ref"].forEach(function (field) {
      if (typeof value[field] !== "string" || !value[field].trim()) {
        addError(errors, "MISSING_STATE_REF_FIELD", `${path}.${field}`, "必须提供非空稳定值");
      }
    });
    if (typeof value.sha256 !== "string" || !SHA256_RE.test(value.sha256)) {
      addError(errors, "INVALID_SHA256", `${path}.sha256`, "必须是 64 位 SHA-256");
    }
    if (typeof value.formedAt !== "string" || !ISO_RE.test(value.formedAt) || Number.isNaN(Date.parse(value.formedAt))) {
      addError(errors, "INVALID_STATE_REF_TIME", `${path}.formedAt`, "必须是 UTC ISO 时间");
    }
  }

  function validateStateSection(name, value, errors) {
    const path = `stateSections.${name}`;
    if (!isPlainObject(value)) {
      addError(errors, "INVALID_STATE_SECTION", path, "状态分区必须是普通对象");
      return;
    }
    hasOnlyKeys(value, ["status", "reason", "items"], errors, path);
    if (!["empty", "referenced", "unavailable"].includes(value.status)) {
      addError(errors, "INVALID_STATE_SECTION_STATUS", `${path}.status`, "必须是 empty、referenced 或 unavailable");
    }
    if (!Array.isArray(value.items)) {
      addError(errors, "INVALID_STATE_SECTION_ITEMS", `${path}.items`, "必须是数组");
      return;
    }
    if (value.status === "referenced" && value.items.length === 0) {
      addError(errors, "EMPTY_REFERENCED_SECTION", `${path}.items`, "referenced 分区必须至少包含一条引用");
    }
    if (["empty", "unavailable"].includes(value.status)) {
      if (value.items.length !== 0) {
        addError(errors, "NONEMPTY_DECLARED_SECTION", `${path}.items`, `${value.status} 分区不得携带引用`);
      }
      if (typeof value.reason !== "string" || !value.reason.trim()) {
        addError(errors, "MISSING_STATE_SECTION_REASON", `${path}.reason`, `${value.status} 分区必须明确说明原因`);
      }
    }
    value.items.forEach(function (item, index) {
      validateStateRefItem(item, errors, `${path}.items[${index}]`);
    });
  }

  function validateSideEffectPolicy(value, errors, path) {
    if (!isPlainObject(value)) {
      addError(errors, "INVALID_SIDE_EFFECT_POLICY", path, "必须显式提供副作用策略");
      return;
    }
    const expectedKeys = Object.keys(SIDE_EFFECT_POLICY);
    hasOnlyKeys(value, expectedKeys, errors, path);
    expectedKeys.forEach(function (key) {
      if (value[key] !== false) {
        addError(errors, "HISTORICAL_SIDE_EFFECT_ENABLED", `${path}.${key}`, "恢复和回归必须默认禁止历史副作用重放");
      }
    });
  }

  function validateCheckpointManifest(value, options) {
    const errors = [];
    const config = options || {};
    if (!isPlainObject(value)) {
      addError(errors, "INVALID_CHECKPOINT", "$", "Checkpoint 清单必须是普通对象");
      return { ok: false, errors: errors };
    }
    hasOnlyKeys(
      value,
      [
        "schemaVersion",
        "checkpointId",
        "checkpointNode",
        "baselineVersion",
        "baselineSnapshotId",
        "parentVersion",
        "scenarioContext",
        "sourceScenarioRunId",
        "createdAt",
        "immutable",
        "code",
        "modules",
        "stateSections",
        "restoreReadiness",
        "sideEffectPolicy"
      ],
      errors,
      "$checkpoint"
    );
    const forbidden = [];
    findForbiddenSuccessFields(value, "$checkpoint", forbidden);
    forbidden.forEach(function (path) {
      addError(errors, "FORBIDDEN_BUSINESS_SUCCESS_FIELD", path, "公共底座不得预造业务成功或验收状态");
    });
    if (value.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
      addError(errors, "INVALID_CHECKPOINT_SCHEMA", "schemaVersion", `必须是 ${CHECKPOINT_SCHEMA_VERSION}`);
    }
    if (typeof value.checkpointId !== "string" || !CHECKPOINT_ID_RE.test(value.checkpointId)) {
      addError(errors, "INVALID_CHECKPOINT_ID", "checkpointId", "Checkpoint ID 格式无效");
    }
    if (!CHECKPOINT_NODES.includes(value.checkpointNode)) {
      addError(errors, "INVALID_CHECKPOINT_NODE", "checkpointNode", "Checkpoint 节点不在允许清单内");
    }
    if (typeof value.baselineVersion !== "string" || !SEMVER_RE.test(value.baselineVersion)) {
      addError(errors, "INVALID_BASELINE_VERSION", "baselineVersion", "必须是不带 v 前缀的三段版本号");
    }
    if (typeof value.baselineSnapshotId !== "string" || !BASELINE_SNAPSHOT_ID_RE.test(value.baselineSnapshotId)) {
      addError(errors, "INVALID_BASELINE_SNAPSHOT_ID", "baselineSnapshotId", "基线快照标识格式无效");
    }
    const expectedBaselineSnapshotId = Object.prototype.hasOwnProperty.call(config, "expectedBaselineSnapshotId")
      ? config.expectedBaselineSnapshotId
      : CURRENT_BASELINE_SNAPSHOT_ID;
    if (expectedBaselineSnapshotId && value.baselineSnapshotId !== expectedBaselineSnapshotId) {
      addError(errors, "BASELINE_SNAPSHOT_MISMATCH", "baselineSnapshotId", `必须绑定 ${expectedBaselineSnapshotId}`);
    }
    if (typeof value.parentVersion !== "string" || !SEMVER_RE.test(value.parentVersion)) {
      addError(errors, "INVALID_PARENT_VERSION", "parentVersion", "必须是不带 v 前缀的三段版本号");
    }

    const contextResult = validateScenarioContext(value.scenarioContext);
    if (!contextResult.ok) {
      contextResult.errors.forEach(function (error) {
        errors.push({ code: error.code, path: `scenarioContext.${error.path}`, message: error.message });
      });
    }
    if (
      !value.scenarioContext ||
      typeof value.sourceScenarioRunId !== "string" ||
      value.sourceScenarioRunId !== value.scenarioContext.scenarioRunId
    ) {
      addError(errors, "SOURCE_RUN_MISMATCH", "sourceScenarioRunId", "必须精确等于清单的 scenarioRunId");
    }
    if (typeof value.createdAt !== "string" || !ISO_RE.test(value.createdAt) || Number.isNaN(Date.parse(value.createdAt))) {
      addError(errors, "INVALID_CHECKPOINT_TIME", "createdAt", "必须是 UTC ISO 时间");
    }
    if (value.immutable !== true) {
      addError(errors, "CHECKPOINT_NOT_IMMUTABLE", "immutable", "正式清单必须显式 immutable=true");
    }

    if (!isPlainObject(value.code)) {
      addError(errors, "INVALID_CODE_BINDING", "code", "必须固定原型、构建、入口和树哈希");
    } else {
      hasOnlyKeys(value.code, ["prototypeVersion", "buildVersion", "entryRef", "treeSha256"], errors, "code");
      ["prototypeVersion", "buildVersion", "entryRef"].forEach(function (field) {
        if (typeof value.code[field] !== "string" || !value.code[field].trim()) {
          addError(errors, "MISSING_CODE_FIELD", `code.${field}`, "必须提供非空精确值");
        }
      });
      if (typeof value.code.treeSha256 !== "string" || !SHA256_RE.test(value.code.treeSha256)) {
        addError(errors, "INVALID_SHA256", "code.treeSha256", "必须是 64 位 SHA-256");
      }
    }

    if (!isPlainObject(value.modules)) {
      addError(errors, "INVALID_MODULES", "modules", "必须包含 M01—M06 六个模块导出");
    } else {
      hasOnlyKeys(value.modules, MODULE_IDS, errors, "modules");
      MODULE_IDS.forEach(function (moduleId) {
        if (!Object.prototype.hasOwnProperty.call(value.modules, moduleId)) {
          addError(errors, "MISSING_MODULE", `modules.${moduleId}`, "缺少模块导出和 Owner 校验回执");
        } else {
          validateModuleEntry(moduleId, value.modules[moduleId], errors);
        }
      });
    }

    if (!isPlainObject(value.stateSections)) {
      addError(errors, "INVALID_STATE_SECTIONS", "stateSections", "必须显式声明全部 C034 状态分区");
    } else {
      hasOnlyKeys(value.stateSections, STATE_SECTION_NAMES, errors, "stateSections");
      STATE_SECTION_NAMES.forEach(function (name) {
        if (!Object.prototype.hasOwnProperty.call(value.stateSections, name)) {
          addError(errors, "MISSING_STATE_SECTION", `stateSections.${name}`, "缺少状态分区声明");
        } else {
          validateStateSection(name, value.stateSections[name], errors);
        }
      });
    }

    if (!isPlainObject(value.restoreReadiness)) {
      addError(errors, "INVALID_RESTORE_READINESS", "restoreReadiness", "必须提供恢复校验回执");
    } else {
      hasOnlyKeys(value.restoreReadiness, ["status", "verifiedAt", "evidenceRef"], errors, "restoreReadiness");
      if (!["verified", "not-verified"].includes(value.restoreReadiness.status)) {
        addError(errors, "INVALID_RESTORE_STATUS", "restoreReadiness.status", "必须是 verified 或 not-verified");
      }
      if (
        typeof value.restoreReadiness.verifiedAt !== "string" ||
        !ISO_RE.test(value.restoreReadiness.verifiedAt) ||
        Number.isNaN(Date.parse(value.restoreReadiness.verifiedAt))
      ) {
        addError(errors, "INVALID_RESTORE_TIME", "restoreReadiness.verifiedAt", "必须是 UTC ISO 时间");
      }
      if (typeof value.restoreReadiness.evidenceRef !== "string" || !value.restoreReadiness.evidenceRef.trim()) {
        addError(errors, "MISSING_RESTORE_EVIDENCE", "restoreReadiness.evidenceRef", "必须提供稳定恢复证据入口");
      }
      if (
        value.restoreReadiness.status === "verified" &&
        isPlainObject(value.stateSections) &&
        STATE_SECTION_NAMES.some(function (name) {
          return value.stateSections[name] && value.stateSections[name].status === "unavailable";
        })
      ) {
        addError(
          errors,
          "UNAVAILABLE_STATE_IN_RESTORABLE_CHECKPOINT",
          "restoreReadiness.status",
          "存在 unavailable 状态分区时不得宣称恢复已验证"
        );
      }
    }
    validateSideEffectPolicy(value.sideEffectPolicy, errors, "sideEffectPolicy");
    return { ok: errors.length === 0, errors: errors };
  }

  function assertCheckpointManifest(value, options) {
    const result = validateCheckpointManifest(value, options);
    if (!result.ok) {
      fail("INVALID_CHECKPOINT_MANIFEST", "Checkpoint 清单校验失败", result.errors);
    }
    return deepFreeze(cloneJson(value, "Checkpoint 清单"));
  }

  function assertRestorableCheckpoint(value, options) {
    const checkpoint = assertCheckpointManifest(value, options);
    if (checkpoint.restoreReadiness.status !== "verified") {
      fail("CHECKPOINT_NOT_RESTORABLE", "Checkpoint 尚未通过恢复校验，不能克隆恢复、回归或迁移", {
        checkpointId: checkpoint.checkpointId
      });
    }
    return checkpoint;
  }

  function createCheckpointManifest(input, options) {
    if (!isPlainObject(input)) {
      fail("INVALID_CHECKPOINT_INPUT", "创建 Checkpoint 需要普通对象输入");
    }
    const config = options || {};
    const allowedInputKeys = [
      "checkpointId",
      "checkpointNode",
      "baselineVersion",
      "baselineSnapshotId",
      "parentVersion",
      "scenarioContext",
      "code",
      "modules",
      "stateSections",
      "restoreReadiness"
    ];
    const inputErrors = [];
    hasOnlyKeys(input, allowedInputKeys, inputErrors, "$input");
    if (inputErrors.length) {
      fail("INVALID_CHECKPOINT_INPUT", "Checkpoint 输入包含未定义字段", inputErrors);
    }
    const context = assertScenarioContext(input.scenarioContext);
    const createdAt = toIso(config.now, "Checkpoint 形成时间");
    const checkpointId =
      input.checkpointId || `CP-${context.scenarioId}-${timestamp17(config.now)}-${randomHex(6, config.randomBytes)}`;
    const manifest = {
      schemaVersion: CHECKPOINT_SCHEMA_VERSION,
      checkpointId: checkpointId,
      checkpointNode: input.checkpointNode,
      baselineVersion: input.baselineVersion || CURRENT_BASELINE_VERSION,
      baselineSnapshotId: input.baselineSnapshotId || CURRENT_BASELINE_SNAPSHOT_ID,
      parentVersion: input.parentVersion,
      scenarioContext: context,
      sourceScenarioRunId: context.scenarioRunId,
      createdAt: createdAt,
      immutable: true,
      code: cloneJson(input.code, "代码绑定"),
      modules: cloneJson(input.modules, "模块导出"),
      stateSections: cloneJson(input.stateSections, "状态分区"),
      restoreReadiness: cloneJson(input.restoreReadiness, "恢复校验回执"),
      sideEffectPolicy: SIDE_EFFECT_POLICY
    };
    return assertCheckpointManifest(manifest);
  }

  function createHistoricalView(checkpointValue, options) {
    const checkpoint = assertCheckpointManifest(checkpointValue);
    const config = options || {};
    const context = deepFreeze({
      scenarioId: checkpoint.scenarioContext.scenarioId,
      scenarioVersion: checkpoint.scenarioContext.scenarioVersion,
      scenarioRunId: checkpoint.scenarioContext.scenarioRunId,
      formedAt: checkpoint.scenarioContext.formedAt,
      status: "historical-readonly"
    });
    return deepFreeze({
      operationId: createOperationId(context.scenarioId, config),
      mode: "historical-view",
      checkpointId: checkpoint.checkpointId,
      context: context,
      readOnly: true,
      writesCurrentProjection: false,
      rerunsBusinessLogic: false,
      checkpoint: checkpoint,
      sideEffectPolicy: SIDE_EFFECT_POLICY
    });
  }

  function createOperationContext(checkpoint, status, options) {
    return createScenarioContext(
      {
        scenarioId: checkpoint.scenarioContext.scenarioId,
        scenarioVersion: checkpoint.scenarioContext.scenarioVersion,
        status: status
      },
      options
    );
  }

  function cloneRestore(checkpointValue, options) {
    const checkpoint = assertRestorableCheckpoint(checkpointValue);
    const config = options || {};
    const context = createOperationContext(checkpoint, "restored", config);
    return deepFreeze({
      operationId: createOperationId(context.scenarioId, config),
      mode: "clone-restore",
      sourceCheckpointId: checkpoint.checkpointId,
      sourceScenarioRunId: checkpoint.scenarioContext.scenarioRunId,
      context: context,
      overwritesHistory: false,
      requiresEmptyIsolatedNamespace: true,
      moduleRestoreRefs: MODULE_IDS.reduce(function (result, moduleId) {
        result[moduleId] = {
          exportId: checkpoint.modules[moduleId].exportId,
          exportRef: checkpoint.modules[moduleId].exportRef,
          exportSha256: checkpoint.modules[moduleId].exportSha256
        };
        return result;
      }, {}),
      sideEffectPolicy: SIDE_EFFECT_POLICY
    });
  }

  function createIsolatedRegression(checkpointValue, options) {
    const checkpoint = assertRestorableCheckpoint(checkpointValue);
    const config = options || {};
    const context = createOperationContext(checkpoint, "regression", config);
    return deepFreeze({
      operationId: createOperationId(context.scenarioId, config),
      mode: "isolated-regression",
      sourceCheckpointId: checkpoint.checkpointId,
      sourceScenarioRunId: checkpoint.scenarioContext.scenarioRunId,
      context: context,
      isolationMode: "drill",
      requiresEmptyIsolatedNamespace: true,
      externalCapabilitiesDefault: "disabled",
      sideEffectPolicy: SIDE_EFFECT_POLICY
    });
  }

  function migrateBaseline(checkpointValue, input, options) {
    if (!isPlainObject(input)) {
      fail("INVALID_MIGRATION_INPUT", "基线迁移需要普通对象输入");
    }
    const checkpoint = assertRestorableCheckpoint(checkpointValue, { expectedBaselineSnapshotId: null });
    const config = options || {};
    const targetVersionMatch =
      typeof input.targetScenarioVersion === "string" ? input.targetScenarioVersion.match(SCENARIO_VERSION_RE) : null;
    if (!targetVersionMatch || targetVersionMatch[1] !== checkpoint.scenarioContext.scenarioId) {
      fail("INVALID_TARGET_SCENARIO_VERSION", "目标 scenarioVersion 必须合法且属于同一 scenarioId");
    }
    if (input.targetScenarioVersion === checkpoint.scenarioContext.scenarioVersion) {
      fail("IN_PLACE_SCENARIO_VERSION_MIGRATION", "基线迁移必须创建新的 scenarioVersion，禁止原地换父版本");
    }
    if (typeof input.targetBaselineVersion !== "string" || !SEMVER_RE.test(input.targetBaselineVersion)) {
      fail("INVALID_TARGET_BASELINE_VERSION", "目标 baselineVersion 必须是不带 v 前缀的三段版本号");
    }
    if (
      typeof input.targetBaselineSnapshotId !== "string" ||
      !BASELINE_SNAPSHOT_ID_RE.test(input.targetBaselineSnapshotId)
    ) {
      fail("INVALID_TARGET_BASELINE_SNAPSHOT_ID", "目标 baselineSnapshotId 格式无效");
    }
    if (
      input.targetBaselineVersion === checkpoint.baselineVersion &&
      input.targetBaselineSnapshotId === checkpoint.baselineSnapshotId
    ) {
      fail("UNCHANGED_BASELINE", "目标基线与来源基线完全相同，不构成迁移");
    }
    const context = createScenarioContext(
      {
        scenarioId: checkpoint.scenarioContext.scenarioId,
        scenarioVersion: input.targetScenarioVersion,
        status: "migrated"
      },
      config
    );
    return deepFreeze({
      operationId: createOperationId(context.scenarioId, config),
      mode: "baseline-migration",
      sourceCheckpointId: checkpoint.checkpointId,
      source: {
        baselineVersion: checkpoint.baselineVersion,
        baselineSnapshotId: checkpoint.baselineSnapshotId,
        scenarioVersion: checkpoint.scenarioContext.scenarioVersion,
        scenarioRunId: checkpoint.scenarioContext.scenarioRunId
      },
      target: {
        baselineVersion: input.targetBaselineVersion,
        baselineSnapshotId: input.targetBaselineSnapshotId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId
      },
      context: context,
      overwritesSource: false,
      requiresMigrationComparison: true,
      requiresNewCheckpoint: true,
      sideEffectPolicy: SIDE_EFFECT_POLICY
    });
  }

  return Object.freeze({
    FOUNDATION_VERSION: FOUNDATION_VERSION,
    STORAGE_SCHEMA_VERSION: STORAGE_SCHEMA_VERSION,
    CHECKPOINT_SCHEMA_VERSION: CHECKPOINT_SCHEMA_VERSION,
    CURRENT_BASELINE_VERSION: CURRENT_BASELINE_VERSION,
    CURRENT_BASELINE_SNAPSHOT_ID: CURRENT_BASELINE_SNAPSHOT_ID,
    MODULE_IDS: MODULE_IDS,
    STATE_SECTION_NAMES: STATE_SECTION_NAMES,
    CHECKPOINT_NODES: CHECKPOINT_NODES,
    SIDE_EFFECT_POLICY: SIDE_EFFECT_POLICY,
    FoundationError: FoundationError,
    validateScenarioContext: validateScenarioContext,
    assertScenarioContext: assertScenarioContext,
    createScenarioRunId: createScenarioRunId,
    createScenarioContext: createScenarioContext,
    assertScenarioContextMatch: assertScenarioContextMatch,
    createNamespacedStorage: createNamespacedStorage,
    directionalReset: directionalReset,
    validateCheckpointManifest: validateCheckpointManifest,
    assertCheckpointManifest: assertCheckpointManifest,
    createCheckpointManifest: createCheckpointManifest,
    createHistoricalView: createHistoricalView,
    cloneRestore: cloneRestore,
    createIsolatedRegression: createIsolatedRegression,
    migrateBaseline: migrateBaseline
  });
});
