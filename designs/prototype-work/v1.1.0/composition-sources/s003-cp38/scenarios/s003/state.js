(function () {
  "use strict";

  const DATA = window.S003Data;
  const FOUNDATION = window.OFWScenarioFoundation;
  const listeners = new Set();
  const PROJECTION_SCHEMA_VERSION = "ofw.s003.browser-projection.v1";
  const LEGACY_PROJECTION_SCHEMA_VERSION = "ofw.s003.browser-projection.v0";
  const RUNTIME_PROJECTION_SCHEMA_VERSION = "ofw.s003.runtime-projection.v1";
  const PROJECTION_RECOVERY_RECEIPT_SCHEMA_VERSION = "ofw.s003.projection-recovery-receipt.v1";
  const RUNTIME_STORAGE_KEY_RE = /^ofw:v1\.1\.0:S003:S003-v1:(S003-RUN-\d{17}-[0-9a-f]{12}):m06:runs%2Fcurrent$/;
  const INPUT_STORAGE_KEY_RE = /^ofw:v1\.1\.0:S003:S003-v1:(S003-RUN-\d{17}-[0-9a-f]{12}):m02:factor-inputs%2Fcurrent$/;
  const MODEL_STORAGE_KEY_RE = /^ofw:v1\.1\.0:S003:S003-v1:(S003-RUN-\d{17}-[0-9a-f]{12}):m01:config%2Fcurrent$/;
  const OPERATION_ID_RE = /^OP-S003-\d{17}-[0-9a-f]{12}$/;
  const SCENARIO_RUN_ID_RE = /^S003-RUN-\d{17}-[0-9a-f]{12}$/;
  const MODULE_IDS = Object.freeze(["M01", "M02", "M03", "M04", "M05", "M06"]);

  let bundle = null;
  let checkpointRuntime = null;
  let operationSequence = 0;
  let state = {
    ready: false,
    fatalError: null,
    context: null,
    currentView: "platform-home",
    activeModuleId: "M06",
    currentAnchor: null,
    selectedEnterpriseId: null,
    navCollapsed: false,
    mobileNavOpen: false,
    activeConfigTab: "weights",
    enterpriseSearch: "",
    enterpriseRiskFilter: "ALL",
    enterpriseSectorFilter: "ALL",
    enterpriseSort: "score-asc",
    factorEntrySearch: "",
    factorEntryStatus: "published",
    factorEntryValidation: null,
    factorInputSnapshot: null,
    factorInputs: {},
    configStatus: "published",
    configValidation: null,
    configDraft: null,
    publishedModel: null,
    activeRun: null,
    lastSuccessfulRun: null,
    runHistory: [],
    runStatus: "idle",
    runError: null,
    regressionRun: null,
    queryId: null,
    queryAnswer: null,
    decisions: [],
    actionRequests: [],
    pendingDecision: null,
    historicalView: null,
    requestedScenarioRunId: null,
    requestedReportId: null,
    restoredFromCheckpoint: null,
    operationLineage: null,
    operationNotice: null,
    projectionPersistence: null,
    projectionNotice: "浏览器存储仅保存可丢弃的当前工作投影，不作为正式快照真源。",
    projectionHealth: {},
    projectionRecoveryReceipts: [],
    checkpointCatalogIssues: [],
    runtimeHealth: null,
    acceptanceReady: false
  };

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function stableFingerprintValue(value) {
    if (Array.isArray(value)) return value.map(stableFingerprintValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce(function (result, key) {
      if (value[key] !== undefined) result[key] = stableFingerprintValue(value[key]);
      return result;
    }, {});
  }

  function contentFingerprint(prefix, value) {
    const text = JSON.stringify(stableFingerprintValue(value));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  // A version bump alone is not a scoring change.  Persist fingerprints of
  // the effective model configuration and T053 contents on every run so M06
  // can distinguish a real rerun requirement from a no-op Published version.
  function modelConfigurationFingerprint(model) {
    if (!model?.packageId || !model?.weights || !Array.isArray(model?.factors) || !Array.isArray(model?.riskTiers)) return null;
    return contentFingerprint("S003-MODEL", {
      packageId: model.packageId,
      resourceType: model.resourceType,
      indicatorOrder: model.indicatorOrder,
      weights: model.weights,
      factors: model.factors,
      riskTiers: model.riskTiers,
      formulas: model.formulas,
      scoreAnchors: model.scoreAnchors,
      profitStability: model.profitStability,
      actionTypes: model.actionTypes,
      assessment: model.assessment
    });
  }

  function inputConfigurationFingerprint(snapshot) {
    const values = Array.isArray(snapshot?.records) ? snapshot.records : snapshot?.values;
    if (!snapshot || (!values || typeof values !== "object")) return null;
    return contentFingerprint("S003-INPUT", {
      assessmentAt: snapshot.assessmentAt,
      enterpriseCount: snapshot.enterpriseCount,
      factorCount: snapshot.factorCount,
      values
    });
  }

  function publishedModelWithoutEnterpriseInputs(value) {
    const model = clone(value);
    if (model && typeof model === "object") delete model.enterpriseFactorInputs;
    return model;
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function hasOwn(value, key) {
    return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
  }

  function failProjection(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function serializableError(error) {
    return {
      code: error?.code || "S003_PROJECTION_PERSISTENCE_FAILED",
      name: error?.name || "Error",
      message: error?.message || String(error)
    };
  }

  function moduleIdForProjection(scope) {
    return { m01: "M01", m02: "M02", m04: "M04", m06: "M06" }[scope] || null;
  }

  function projectionHealthRecord(scope, key, status, detail, extra) {
    return {
      moduleId: moduleIdForProjection(scope),
      scope,
      key,
      status,
      readable: ["healthy", "missing", "migrated", "isolated-rebuilt"].includes(status),
      writable: ["healthy", "missing", "migrated", "isolated-rebuilt"].includes(status),
      detail: detail || null,
      checkedAt: new Date().toISOString(),
      ...(extra || {})
    };
  }

  function setProjectionHealthRecord(scope, key, record) {
    const moduleId = moduleIdForProjection(scope);
    if (!moduleId) return;
    state.projectionHealth = {
      ...state.projectionHealth,
      [moduleId]: clone(record)
    };
  }

  function exactContextMatch(expected, actual) {
    if (!expected || !actual) return false;
    return ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every(function (field) {
      return expected[field] === actual[field];
    });
  }

  function assertS003Context(context) {
    if (!FOUNDATION) failProjection("S003_PROJECTION_FOUNDATION_MISSING", "平台公共场景底座不可用。");
    const checked = FOUNDATION.assertScenarioContext(context);
    if (checked.scenarioId !== "S003" || checked.scenarioVersion !== "S003-v1") {
      failProjection("S003_PROJECTION_SCENARIO_MISMATCH", "浏览器投影不属于 S003 / S003-v1，已拒绝读取。");
    }
    return checked;
  }

  function assertExactContext(expected, actual, label) {
    assertS003Context(expected);
    assertS003Context(actual);
    if (!exactContextMatch(expected, actual)) {
      failProjection("S003_PROJECTION_CONTEXT_MISMATCH", `${label || "投影"}的完整场景上下文不一致。`);
    }
  }

  function semanticVersionParts(value) {
    const match = String(value || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
    return match ? match.slice(1).map(Number) : null;
  }

  function compareSemanticVersions(left, right) {
    const a = semanticVersionParts(left);
    const b = semanticVersionParts(right);
    if (!a || !b) return null;
    for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) return a[index] - b[index];
    }
    return 0;
  }

  function inputSnapshotSequence(snapshot) {
    const match = String(snapshot?.snapshotId || "").match(/^S003-T053-INPUT-\d{8}-v(\d+)$/);
    if (match) return Number(match[1]);
    return /^S003-M01-MODEL-CONFIG-\d+\.\d+\.\d+$/.test(String(snapshot?.snapshotId || "")) ? 1 : 0;
  }

  function isFormalSuccessfulRun(run) {
    const context = run?.scenarioContext;
    return Boolean(
      isPlainObject(run)
      && run.status === "succeeded"
      && run.authorityMode === "published-evidence"
      && run.projectionOnly !== true
      && run.raw?.immutable === true
      && context
      && run.runId === context.scenarioRunId
      && context.scenarioId === "S003"
      && context.scenarioVersion === "S003-v1"
      && !["regression", "restored", "historical-readonly", "closed"].includes(context.status)
    );
  }

  function formalSuccessfulRun(run) {
    return isFormalSuccessfulRun(run) ? run : null;
  }

  function isPublishedEvidenceArtifact(run) {
    return Boolean(
      isPlainObject(run)
      && run.status === "succeeded"
      && run.authorityMode === "published-evidence"
      && run.projectionOnly !== true
      && run.raw?.immutable === true
      && run.runId === run.scenarioContext?.scenarioRunId
      && run.raw?.scenarioIdentity
      && exactContextMatch(run.scenarioContext, run.raw.scenarioIdentity)
    );
  }

  function canConsumePublishedEvidence(run) {
    if (!isPublishedEvidenceArtifact(run)) return false;
    if (state.historicalView) return state.historicalView.projection?.exact === true;
    return isFormalSuccessfulRun(run);
  }

  function publishedConsumptionBlockMessage(moduleName, run) {
    const label = moduleName || "下游模块";
    if (!run) return `${label} 尚无可消费的 Published 运行证据。`;
    if (run.projectionOnly === true || run.authorityMode === "published-runtime") {
      return `${label} 已阻断：当前结果是浏览器工作投影，尚未提升为正式 Published 证据。`;
    }
    if (run.authorityMode === "isolated-regression" || run.scenarioContext?.status === "regression") {
      return `${label} 已阻断：隔离回归仅供演练，不得进入正式消费或触发副作用。`;
    }
    if (state.historicalView && state.historicalView.projection?.exact !== true) {
      return `${label} 已阻断：历史快照未通过锁定工件精确校验。`;
    }
    return `${label} 已阻断：当前运行不具备 published-evidence 权威身份。`;
  }

  function operationTimestamp17(value) {
    return new Date(value || Date.now()).toISOString().replace(/\D/g, "").slice(0, 17);
  }

  function nextOperationId() {
    operationSequence += 1;
    const bytes = new Uint8Array(6);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      let seed = (Date.now() ^ Math.imul(operationSequence, 2654435761)) >>> 0;
      for (let index = 0; index < bytes.length; index += 1) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        bytes[index] = seed & 0xff;
      }
    }
    const nonce = Array.from(bytes, function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
    return `OP-S003-${operationTimestamp17()}-${nonce}`;
  }

  function checkpointEvidenceFor(context) {
    const manifests = (bundle?.checkpoints || []).map(function (entry) { return entry.manifest; }).filter(Boolean);
    const sameRun = manifests.filter(function (manifest) {
      return manifest.scenarioContext?.scenarioRunId === context?.scenarioRunId;
    }).sort(function (left, right) { return Date.parse(left.createdAt) - Date.parse(right.createdAt); });
    const source = sameRun[sameRun.length - 1] || manifests[manifests.length - 1];
    return source?.restoreReadiness?.evidenceRef || "evidence/CP07-e2e-integration-validation.md";
  }

  function knownPublishedEvidenceMatch(run) {
    const raw = bundle?.c035Results;
    const model = bundle?.model;
    const inputSnapshot = bundle?.humanInputSnapshot;
    if (!raw?.scenarioIdentity || !model || !inputSnapshot) return false;
    return Boolean(
      run?.runId === raw.scenarioIdentity.scenarioRunId
      && run.modelVersion === model.packageVersion
      && run.publishedVersion === model.packageVersion
      && run.inputSnapshotId === inputSnapshot.snapshotId
      && JSON.stringify(run.raw) === JSON.stringify(raw)
    );
  }

  function defaultModuleRestoreReferences(input) {
    const config = input || {};
    const sourceScenarioRunId = config.sourceScenarioRunId || null;
    const model = config.model || null;
    const inputSnapshot = config.inputSnapshot || null;
    const run = config.run || null;
    return {
      M01: {
        sourceScenarioRunId,
        resourceType: "RiskModel",
        resourceId: model?.packageId || null,
        resourceVersion: model?.packageVersion || null,
        targetProjection: "m01/config/current"
      },
      M02: {
        sourceScenarioRunId,
        resourceType: "FormalDataAsset",
        resourceId: bundle?.formalDataAsset?.dataAssetId || bundle?.formalDataAsset?.assetId || null,
        resourceVersion: bundle?.formalDataAsset?.dataAssetVersion || null,
        restoreMode: "read-only-data-reference"
      },
      M03: {
        sourceScenarioRunId,
        resourceType: "PublishedFactConsumption",
        resourceId: run?.runId || sourceScenarioRunId,
        restoreMode: "derived-read-only"
      },
      M04: {
        sourceScenarioRunId,
        resourceType: "ActionRequestState",
        resourceId: null,
        restoreMode: "do-not-replay"
      },
      M05: {
        sourceScenarioRunId,
        resourceType: "AgentBoundary",
        resourceId: "S003-M05-REPORT-COPILOT-SCENARIO-PROFILE",
        restoreMode: "boundary-only"
      },
      M06: {
        sourceScenarioRunId,
        resourceType: "RuntimeProjection",
        resourceId: run?.runId || null,
        targetProjection: "m06/runs/current"
      }
    };
  }

  function normalizeModuleRestoreReferences(value, fallbackInput) {
    const source = isPlainObject(value) ? value : defaultModuleRestoreReferences(fallbackInput);
    const normalized = {};
    MODULE_IDS.forEach(function (moduleId) {
      if (!isPlainObject(source[moduleId])) {
        failProjection("S003_RUNTIME_MODULE_RESTORE_REF_MISSING", `运行谱系缺少 ${moduleId} 模块恢复引用。`);
      }
      normalized[moduleId] = clone(source[moduleId]);
    });
    return normalized;
  }

  function buildOperationLineage(operation, options) {
    const config = options || {};
    const operationId = operation?.operationId || config.operationId || nextOperationId();
    const operationMode = operation?.mode || config.operationMode || "runtime-evaluation";
    const sourceCheckpointId = operation?.sourceCheckpointId || config.sourceCheckpointId || null;
    const sourceScenarioRunId = operation?.sourceScenarioRunId || config.sourceScenarioRunId || null;
    const moduleRestoreReferences = normalizeModuleRestoreReferences(
      operation?.moduleRestoreRefs || config.moduleRestoreReferences,
      {
        sourceScenarioRunId,
        model: config.model,
        inputSnapshot: config.inputSnapshot,
        run: config.run
      }
    );
    return {
      operationId,
      operationMode,
      sourceCheckpointId,
      sourceScenarioRunId,
      moduleRestoreReferences
    };
  }

  function assertOperationLineage(payload, context) {
    if (!OPERATION_ID_RE.test(payload.operationId || "")) {
      failProjection("S003_RUNTIME_OPERATION_ID_INVALID", "M06 运行投影缺少合法 operationId。");
    }
    if (!["rerun", "clone-restore", "isolated-regression", "runtime-evaluation"].includes(payload.operationMode)) {
      failProjection("S003_RUNTIME_OPERATION_MODE_INVALID", "M06 运行投影缺少合法 operationMode。");
    }
    if (payload.sourceScenarioRunId !== null && !SCENARIO_RUN_ID_RE.test(payload.sourceScenarioRunId || "")) {
      failProjection("S003_RUNTIME_SOURCE_RUN_INVALID", "M06 运行投影 sourceScenarioRunId 不合法。");
    }
    if (payload.sourceScenarioRunId === context.scenarioRunId) {
      failProjection("S003_RUNTIME_SOURCE_RUN_REUSED", "运行操作不得复用来源 scenarioRunId。");
    }
    if (["clone-restore", "isolated-regression"].includes(payload.operationMode)) {
      if (typeof payload.sourceCheckpointId !== "string" || !payload.sourceCheckpointId.trim()) {
        failProjection("S003_RUNTIME_SOURCE_CHECKPOINT_MISSING", "快照恢复或隔离回归必须记录 sourceCheckpointId。");
      }
      if (!payload.sourceScenarioRunId) {
        failProjection("S003_RUNTIME_SOURCE_RUN_MISSING", "快照恢复或隔离回归必须记录 sourceScenarioRunId。");
      }
    } else if (payload.sourceCheckpointId !== null) {
      failProjection("S003_RUNTIME_SOURCE_CHECKPOINT_FORBIDDEN", "非快照操作不得伪造 sourceCheckpointId。");
    }
    normalizeModuleRestoreReferences(payload.moduleRestoreReferences);
    return {
      operationId: payload.operationId,
      operationMode: payload.operationMode,
      sourceCheckpointId: payload.sourceCheckpointId,
      sourceScenarioRunId: payload.sourceScenarioRunId,
      moduleRestoreReferences: clone(payload.moduleRestoreReferences)
    };
  }

  function bindCheckpointRuntime(run) {
    const service = bundle?.checkpointService || window.S003CheckpointService;
    const checkpointEntries = (bundle?.checkpoints || []).filter(function (entry) { return Boolean(entry?.manifest); });
    const checkpointCatalogIssues = [];
    const checkpoints = checkpointEntries.filter(function (entry) {
      const validation = FOUNDATION?.validateCheckpointManifest?.(entry.manifest);
      if (!validation || validation.ok === true) return true;
      checkpointCatalogIssues.push({
        code: entry.code,
        checkpointId: entry.manifest?.checkpointId || null,
        path: entry.path || null,
        status: "incompatible-historical-manifest",
        detail: "该历史文件不符合当前 C034 Checkpoint manifest 合同，已保留原文件并从查看、恢复和回归目录隔离。",
        errors: clone(validation.errors || [])
      });
      return false;
    }).map(function (entry) { return entry.manifest; });
    state.checkpointCatalogIssues = checkpointCatalogIssues;
    if (!service?.createCheckpointService || !checkpoints.length) {
      throw new Error("C034 Checkpoint 公共编排服务或正式快照目录不可用。");
    }
    const input = { checkpoints };
    if (run && !isFormalSuccessfulRun(run)) {
      throw new Error("regression、restored 或 historical 运行不得绑定为 C034 正式成功指针。");
    }
    if (run?.scenarioContext) {
      const completedAt = new Date(run.evaluatedAt || run.scenarioContext.formedAt).toISOString();
      input.lastSuccessfulRun = {
        scenarioContext: clone(run.scenarioContext),
        completedAt,
        evidenceRef: checkpointEvidenceFor(run.scenarioContext)
      };
    }
    checkpointRuntime = service.createCheckpointService(input);
    return checkpointRuntime;
  }

  function createCheckpointRuntime(run) {
    return bindCheckpointRuntime(run);
  }

  function requireCheckpointRuntime() {
    if (checkpointRuntime) return checkpointRuntime;
    const run = formalSuccessfulRun(state.lastSuccessfulRun) || formalSuccessfulRun(state.activeRun);
    if (!run) throw new Error("尚无可绑定 C034 编排服务的成功运行。");
    return createCheckpointRuntime(run);
  }

  function emit() {
    listeners.forEach(function (listener) { listener(getState()); });
  }

  function getState() {
    return state;
  }

  function getBundle() {
    return bundle;
  }

  function projectionRun() {
    return state.historicalView ? state.historicalView.projection?.run || null : state.activeRun;
  }

  function projectionModel() {
    return state.historicalView ? state.historicalView.projection?.model || null : state.publishedModel;
  }

  function projectionInputSnapshot() {
    return state.historicalView ? state.historicalView.projection?.inputSnapshot || null : state.factorInputSnapshot;
  }

  function projectionContext() {
    return state.historicalView?.context || state.context;
  }

  function projectionDecisions() {
    return state.historicalView ? state.historicalView.projection?.decisions || [] : state.decisions;
  }

  function projectionActionRequests() {
    return state.historicalView
      ? state.historicalView.projection?.actionRequests || state.historicalView.projection?.decisions || []
      : state.actionRequests || state.decisions;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }

  function set(patch, silent) {
    state = { ...state, ...patch };
    if (!silent) emit();
    return state;
  }

  function initialContext(manifest) {
    const scenario = manifest.scenario;
    const context = {
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      scenarioRunId: scenario.initialScenarioRunId,
      formedAt: scenario.formedAt,
      status: scenario.status || "active"
    };
    if (FOUNDATION) FOUNDATION.assertScenarioContext(context);
    return Object.freeze(context);
  }

  function expectedEnterpriseIds() {
    return (bundle?.fixture?.enterprises || []).map(function (enterprise) { return enterprise.enterpriseId; }).sort();
  }

  function assertEnterpriseIdSet(ids, label) {
    const expected = expectedEnterpriseIds();
    const actual = ids.slice().sort();
    if (actual.length !== expected.length || new Set(actual).size !== actual.length || actual.some(function (id, index) { return id !== expected[index]; })) {
      failProjection("S003_PROJECTION_ENTERPRISE_SET_MISMATCH", `${label}的企业数量、唯一性或企业集合与权威夹具不一致。`);
    }
  }

  function assertPublishedModel(model, label) {
    if (!isPlainObject(model) || typeof model.packageId !== "string" || !semanticVersionParts(model.packageVersion)) {
      failProjection("S003_PROJECTION_MODEL_INVALID", `${label || "Published 模型"}缺少合法 packageId 或 SemVer packageVersion。`);
    }
    if (String(model.lifecycleStatus || "").toLowerCase() !== "published") {
      failProjection("S003_PROJECTION_MODEL_NOT_PUBLISHED", `${label || "模型"}不是 Published 状态。`);
    }
    return model;
  }

  function assertInputSnapshot(snapshot, options) {
    const config = options || {};
    if (snapshot === null && config.allowNull) return null;
    const publishedStatus = ["published-input", "published-model-configuration"].includes(snapshot?.status);
    if (!isPlainObject(snapshot) || inputSnapshotSequence(snapshot) < 1 || !publishedStatus || snapshot.immutable !== true) {
      failProjection("S003_PROJECTION_INPUT_SNAPSHOT_INVALID", "企业因子输入缺少合法、不可变的 T053 Published 人工输入快照。");
    }
    const enterpriseCount = Number(snapshot.enterpriseCount ?? Object.keys(snapshot.values || {}).length);
    if (enterpriseCount !== bundle?.fixture?.enterpriseCount) {
      failProjection("S003_PROJECTION_INPUT_ENTERPRISE_COUNT_MISMATCH", "T053 企业因子输入的企业数量与权威夹具不一致。");
    }
    if (snapshot.values !== undefined && snapshot.values !== null) {
      if (!isPlainObject(snapshot.values)) failProjection("S003_PROJECTION_INPUT_VALUES_INVALID", "人工输入快照 values 必须是企业映射。");
      assertEnterpriseIdSet(Object.keys(snapshot.values), "人工输入快照");
    }
    return snapshot;
  }

  function assertRunIdentity(run, context, options) {
    const config = options || {};
    if (!isPlainObject(run) || run.status !== "succeeded" || run.runId !== context.scenarioRunId) {
      failProjection("S003_PROJECTION_RUN_IDENTITY_INVALID", `${config.label || "运行"}不是与投影轮次一致的成功运行。`);
    }
    assertExactContext(context, run.scenarioContext, `${config.label || "运行"} scenarioContext`);
    if (config.formal && !isFormalSuccessfulRun(run)) {
      failProjection("S003_PROJECTION_NON_FORMAL_SUCCESS_POINTER", `regression、restored 或 historical 运行不得成为正式成功指针（当前 status=${run.scenarioContext?.status || "unknown"}）。`);
    }
    if (!semanticVersionParts(run.modelVersion) || run.publishedVersion !== run.modelVersion || typeof run.inputSnapshotId !== "string") {
      failProjection("S003_PROJECTION_RUN_RESOURCE_IDENTITY_INVALID", `${config.label || "运行"}缺少精确模型或人工输入版本身份。`);
    }
    if (!Array.isArray(run.enterpriseResults)) {
      failProjection("S003_PROJECTION_RUN_RESULTS_INVALID", `${config.label || "运行"}缺少企业评估结果。`);
    }
    assertEnterpriseIdSet(run.enterpriseResults.map(function (item) { return item?.enterpriseId; }), `${config.label || "运行"}结果`);
    if (Number(run.reportCount) !== bundle?.fixture?.enterpriseCount) {
      failProjection("S003_PROJECTION_REPORT_COUNT_MISMATCH", `${config.label || "运行"}报告数量与企业数量不一致。`);
    }
    if (run.raw?.scenarioIdentity) assertExactContext(context, run.raw.scenarioIdentity, `${config.label || "运行"}原始结果`);
    return run;
  }

  function assertRunSummary(summary, label) {
    if (!isPlainObject(summary) || summary.runId !== summary.scenarioContext?.scenarioRunId || summary.status !== "succeeded") {
      failProjection("S003_PROJECTION_RUN_HISTORY_INVALID", `${label || "运行历史"}包含非法运行摘要。`);
    }
    assertS003Context(summary.scenarioContext);
    if (["restored", "historical-readonly"].includes(summary.scenarioContext.status)) {
      failProjection("S003_PROJECTION_RUN_HISTORY_INVALID", `${label || "运行历史"}不得把未评估恢复或历史查看登记为成功运行。`);
    }
    if (!["published-evidence", "published-runtime", "isolated-regression"].includes(summary.authorityMode)) {
      failProjection("S003_PROJECTION_RUN_AUTHORITY_INVALID", `${label || "运行历史"}缺少明确 authorityMode。`);
    }
    if (summary.authorityMode === "published-evidence" && summary.projectionOnly === true) {
      failProjection("S003_PROJECTION_RUN_AUTHORITY_INVALID", `${label || "运行历史"}不得把浏览器投影标记为正式 Published 证据。`);
    }
    if (summary.detailAvailable === true || Array.isArray(summary.enterpriseResults)) {
      if (!Array.isArray(summary.enterpriseResults)) {
        failProjection("S003_PROJECTION_RUN_HISTORY_DETAIL_INVALID", `${label || "运行历史"}标记明细可用但缺少 enterpriseResults。`);
      }
      assertEnterpriseIdSet(summary.enterpriseResults.map(function (item) { return item?.enterpriseId; }), `${label || "运行历史"}明细`);
      if (!Array.isArray(summary.reportBindings) || summary.reportBindings.length !== summary.enterpriseResults.length) {
        failProjection("S003_PROJECTION_RUN_HISTORY_REPORT_BINDING_INVALID", `${label || "运行历史"}逐户评分与报告绑定数量不一致。`);
      }
      const reportEnterpriseIds = summary.reportBindings.map(function (item) { return item?.enterpriseId; });
      assertEnterpriseIdSet(reportEnterpriseIds, `${label || "运行历史"}报告绑定`);
      if (new Set(summary.reportBindings.map(function (item) { return item?.reportId; })).size !== summary.reportBindings.length
        || summary.reportBindings.some(function (item) { return !item?.reportId || item.scenarioRunId !== summary.runId; })) {
        failProjection("S003_PROJECTION_RUN_HISTORY_REPORT_BINDING_INVALID", `${label || "运行历史"}报告绑定标识或 scenarioRunId 无效。`);
      }
      if (Number(summary.reportCount) !== summary.reportBindings.length) {
        failProjection("S003_PROJECTION_RUN_HISTORY_REPORT_COUNT_MISMATCH", `${label || "运行历史"}报告数量与逐户绑定不一致。`);
      }
    }
  }

  function assertProjectionPayload(context, scope, key, payload) {
    if (!isPlainObject(payload) || payload.projectionSchemaVersion !== PROJECTION_SCHEMA_VERSION) {
      failProjection("S003_PROJECTION_PAYLOAD_SCHEMA_INVALID", `${scope}/${key} 投影 payload schemaVersion 不兼容。`);
    }
    assertExactContext(context, payload.projectionContext, `${scope}/${key} payload`);
    if (scope === "m01" && key === "config/current") {
      if (!["draft", "validated", "published"].includes(payload.status) || !isPlainObject(payload.configDraft)) {
        failProjection("S003_PROJECTION_CONFIG_INVALID", "M01 配置投影状态或 Draft 结构无效。");
      }
      assertPublishedModel(payload.publishedModel, "M01 上一 Published 模型");
      if (!hasOwn(payload, "lastPublishedModel")) {
        failProjection("S003_PROJECTION_LAST_MODEL_MISSING", "M01 Draft 投影必须显式保留上一 Published 模型快照。");
      }
      assertPublishedModel(payload.lastPublishedModel, "M01 lastPublishedModel");
      if (payload.publishedModel.packageVersion !== payload.lastPublishedModel.packageVersion) {
        failProjection("S003_PROJECTION_LAST_MODEL_MISMATCH", "M01 publishedModel 与 lastPublishedModel 不一致。");
      }
      if (payload.configDraft.basedOnPackageId && payload.configDraft.basedOnPackageId !== payload.publishedModel.packageId) {
        failProjection("S003_PROJECTION_MODEL_BASE_MISMATCH", "M01 Draft 的 basedOnPackageId 与上一 Published 模型不一致。");
      }
      if (payload.configDraft.basedOnVersion && payload.configDraft.basedOnVersion !== payload.publishedModel.packageVersion) {
        failProjection("S003_PROJECTION_MODEL_BASE_MISMATCH", "M01 Draft 的 basedOnVersion 与上一 Published 模型不一致。");
      }
      const legacyInputFields = ["enterpriseFactorInputs", "modelConfigurationSnapshot", "lastPublishedConfiguration"];
      const hasLegacyInputProjection = legacyInputFields.some(function (field) { return hasOwn(payload, field); });
      if (hasLegacyInputProjection) {
        if (!legacyInputFields.every(function (field) { return hasOwn(payload, field); }) || !isPlainObject(payload.enterpriseFactorInputs)) {
          failProjection("S003_PROJECTION_MODEL_FACTOR_INPUT_INVALID", "旧版 M01 投影中的企业因子字段不完整，已拒绝静默迁移。");
        }
        assertEnterpriseIdSet(Object.keys(payload.enterpriseFactorInputs), "旧版 M01 企业因子投影");
        assertInputSnapshot(payload.modelConfigurationSnapshot);
        assertInputSnapshot(payload.lastPublishedConfiguration);
        if (JSON.stringify(payload.modelConfigurationSnapshot) !== JSON.stringify(payload.lastPublishedConfiguration)) {
          failProjection("S003_PROJECTION_MODEL_CONFIGURATION_SNAPSHOT_MISMATCH", "旧版 M01 当前与上一企业因子快照不一致。");
        }
      }
      const proposed = payload.configDraft.proposedVersion;
      if (proposed && compareSemanticVersions(proposed, payload.publishedModel.packageVersion) <= 0) {
        failProjection("S003_PROJECTION_MODEL_VERSION_NON_MONOTONIC", "M01 Draft proposedVersion 必须严格大于上一 Published 版本。");
      }
    } else if (scope === "m02" && key === "factor-inputs/current") {
      if (!["draft", "validated", "published"].includes(payload.status) || !isPlainObject(payload.values)) {
        failProjection("S003_PROJECTION_FACTOR_INPUT_INVALID", "M02 人工输入投影状态或企业映射无效。");
      }
      assertEnterpriseIdSet(Object.keys(payload.values), "当前人工输入");
      if (!hasOwn(payload, "snapshot") || !hasOwn(payload, "lastPublishedSnapshot")) {
        failProjection("S003_PROJECTION_LAST_INPUT_MISSING", "M02 投影必须显式保存 snapshot 与 lastPublishedSnapshot（允许为 null）。");
      }
      assertInputSnapshot(payload.snapshot, { allowNull: true });
      assertInputSnapshot(payload.lastPublishedSnapshot, { allowNull: true });
      if (JSON.stringify(payload.snapshot) !== JSON.stringify(payload.lastPublishedSnapshot)) {
        failProjection("S003_PROJECTION_LAST_INPUT_MISMATCH", "M02 snapshot 与 lastPublishedSnapshot 不一致。");
      }
      if (payload.status === "published" && payload.snapshot === null) {
        failProjection("S003_PROJECTION_PUBLISHED_INPUT_MISSING", "Published 人工输入状态不得使用 null snapshot。");
      }
    } else if (scope === "m04" && key === "action-requests/current") {
      if (!Array.isArray(payload.items)) failProjection("S003_PROJECTION_DECISIONS_INVALID", "M04 Action Request 投影必须是数组。");
      payload.items.forEach(function (item) {
        const normalized = normalizeDecisionRecord(item);
        if (!normalized) failProjection("S003_PROJECTION_DECISIONS_INVALID", "M04 Action Request 投影包含不可识别记录。");
        const identity = normalized.actionRequest.scenarioIdentity;
        assertExactContext(context, identity, "M04 Action Request");
        const isCurrentTwoStage = normalized.actionRequest.contractCode === "C011"
          || ["awaiting-member-unit-confirmation", "confirmed-to-owner-todo"].includes(normalized.actionRequest.status);
        if (isCurrentTwoStage && normalized.stage === "submitted") {
          if (normalized.actionRequest.owner != null
            || normalized.actionRequest.ownerId != null
            || normalized.actionRequest.todoId != null
            || normalized.todo != null) {
            failProjection("S003_PROJECTION_DECISION_STAGE_INVALID", "驾驶舱已提交 C011 在成员单位确认前不得包含 owner 或 todo。");
          }
          if (normalized.actionRequest.decisionRecipient?.role !== "成员单位债务风险接口人") {
            failProjection("S003_PROJECTION_DECISION_ROUTE_INVALID", "待确认 C011 必须直达对应成员单位债务风险接口人。");
          }
        } else if (isCurrentTwoStage && (!normalized.todo?.todoId || !normalized.actionRequest.owner)) {
          failProjection("S003_PROJECTION_DECISION_STAGE_INVALID", "成员单位确认记录必须包含负责人待办与负责人。");
        }
      });
    } else if (scope === "m06" && key === "runs/current") {
      if (payload.runtimeProjectionSchemaVersion !== RUNTIME_PROJECTION_SCHEMA_VERSION || payload.projectionComplete !== true) {
        failProjection("S003_RUNTIME_PROJECTION_INCOMPLETE", "M06 运行投影未声明完整、可恢复的 runtime schema。");
      }
      assertExactContext(context, payload.context, "M06 runtime context");
      assertOperationLineage(payload, context);
      if (!hasOwn(payload, "activeRun") || !hasOwn(payload, "lastSuccessfulRun")) {
        failProjection("S003_RUNTIME_POINTER_MISSING", "M06 运行投影必须显式包含 activeRun 与 lastSuccessfulRun 指针。");
      }
      const activeRun = payload.activeRun;
      if (activeRun === null) {
        if (context.status !== "restored" || payload.runStatus !== "restored" || typeof payload.restoredFromCheckpoint !== "string") {
          failProjection("S003_RUNTIME_EMPTY_ACTIVE_FORBIDDEN", "仅 C034 clone-restore 隔离轮次允许 activeRun=null；普通动态投影不得自动评估补齐。");
        }
      } else {
        const regression = context.status === "regression";
        if (regression !== (payload.runStatus === "regression")) {
          failProjection("S003_RUNTIME_MODE_MISMATCH", "M06 runStatus 与 scenarioContext.status 不一致。");
        }
        if (regression && activeRun.authorityMode !== "isolated-regression") {
          failProjection("S003_RUNTIME_AUTHORITY_MODE_MISMATCH", "隔离回归必须使用 isolated-regression authorityMode。");
        }
        if (regression && activeRun.projectionOnly !== true) {
          failProjection("S003_RUNTIME_AUTHORITY_MODE_MISMATCH", "隔离回归必须明确标记为 projectionOnly。");
        }
        if (!regression && (activeRun.authorityMode !== "published-runtime" || activeRun.projectionOnly !== true)) {
          failProjection("S003_RUNTIME_BROWSER_EVIDENCE_FORBIDDEN", "浏览器 M06 投影不得伪装为 published-evidence；普通动态运行只能是 published-runtime 工作投影。");
        }
        assertRunIdentity(activeRun, context, { formal: false, label: regression ? "隔离回归" : "运行投影" });
        if (payload.modelVersion !== activeRun.modelVersion || payload.inputSnapshotId !== activeRun.inputSnapshotId) {
          failProjection("S003_RUNTIME_RESOURCE_POINTER_MISMATCH", "M06 顶层模型/输入指针与 activeRun 不一致。");
        }
      }
      if (payload.lastSuccessfulRun !== null) {
        assertRunIdentity(payload.lastSuccessfulRun, payload.lastSuccessfulRun.scenarioContext, { formal: true, label: "lastSuccessfulRun" });
        if (!knownPublishedEvidenceMatch(payload.lastSuccessfulRun)) {
          failProjection("S003_RUNTIME_FORMAL_PROVENANCE_INVALID", "lastSuccessfulRun 未匹配静态权威 Published 证据，拒绝由 localStorage 提升正式成功指针。");
        }
      } else if (activeRun !== null && context.status !== "regression") {
        failProjection("S003_RUNTIME_FORMAL_SUCCESS_MISSING", "正式成功运行必须同时保存 lastSuccessfulRun，不得依靠隐式回退。");
      }
      if (context.status === "regression") {
        if (!isPlainObject(payload.regressionRun) || payload.regressionRun.runId !== activeRun?.runId) {
          failProjection("S003_RUNTIME_REGRESSION_POINTER_MISMATCH", "隔离回归指针与 activeRun 不一致。");
        }
      } else if (payload.regressionRun !== null) {
        failProjection("S003_RUNTIME_REGRESSION_POINTER_FORBIDDEN", "非 regression 投影不得保存 regressionRun 指针。");
      }
      if (!Array.isArray(payload.runHistory)) failProjection("S003_PROJECTION_RUN_HISTORY_INVALID", "M06 runHistory 必须是数组。");
      payload.runHistory.forEach(function (item, index) { assertRunSummary(item, `runHistory[${index}]`); });
    }
    return payload;
  }

  function projectionPayload(context, payload) {
    if (!isPlainObject(payload)) failProjection("S003_PROJECTION_PAYLOAD_INVALID", "浏览器投影 payload 必须是普通对象。");
    return {
      ...clone(payload),
      projectionSchemaVersion: PROJECTION_SCHEMA_VERSION,
      projectionContext: clone(context)
    };
  }

  function storage(scope, context) {
    const targetContext = context || state.context;
    if (!FOUNDATION) failProjection("S003_PROJECTION_FOUNDATION_MISSING", "平台公共场景底座不可用。");
    if (!targetContext) failProjection("S003_PROJECTION_CONTEXT_MISSING", "场景上下文尚未形成，不能访问浏览器投影。");
    if (!window.localStorage) failProjection("S003_PROJECTION_STORAGE_MISSING", "浏览器 localStorage 不可用。");
    if (state.historicalView && (!context || exactContextMatch(context, state.context))) {
      failProjection("S003_PROJECTION_HISTORICAL_WRITE_FORBIDDEN", "历史快照只读模式不得写入当前投影。");
    }
    return FOUNDATION.createNamespacedStorage({ storage: window.localStorage, context: targetContext, scope });
  }

  function persistBatch(records, context, options) {
    const config = options || {};
    const targetContext = clone(context || state.context);
    const receipt = { ok: false, atomic: true, requireEmpty: Boolean(config.requireEmpty), context: targetContext, writes: [], rollbackErrors: [] };
    try {
      assertS003Context(targetContext);
      const prepared = records.map(function (record) {
        const adapter = storage(record.scope, targetContext);
        const payload = projectionPayload(targetContext, record.payload);
        assertProjectionPayload(targetContext, record.scope, record.key, payload);
        const physicalKey = adapter.keyFor(record.key);
        return {
          ...record,
          adapter,
          payload,
          physicalKey,
          previousRaw: window.localStorage.getItem(physicalKey)
        };
      });
      const physicalKeys = prepared.map(function (item) { return item.physicalKey; });
      if (new Set(physicalKeys).size !== physicalKeys.length) {
        failProjection("S003_PROJECTION_DUPLICATE_WRITE", "同一原子投影批次包含重复物理键。");
      }
      if (config.requireEmpty && prepared.some(function (item) { return item.previousRaw !== null; })) {
        failProjection("S003_PROJECTION_TARGET_NOT_EMPTY", "C034 新运行要求空隔离命名空间，已拒绝覆盖既有投影。");
      }
      const completed = [];
      try {
        prepared.forEach(function (item) {
          const envelope = item.adapter.set(item.key, item.payload);
          completed.push(item);
          receipt.writes.push({ scope: item.scope, key: item.key, physicalKey: item.physicalKey, savedAt: envelope.savedAt });
        });
      } catch (writeError) {
        completed.slice().reverse().forEach(function (item) {
          try {
            if (item.previousRaw === null) window.localStorage.removeItem(item.physicalKey);
            else window.localStorage.setItem(item.physicalKey, item.previousRaw);
          } catch (rollbackError) {
            receipt.rollbackErrors.push({ physicalKey: item.physicalKey, error: serializableError(rollbackError) });
          }
        });
        throw writeError;
      }
      receipt.ok = true;
      if (state.context && exactContextMatch(state.context, targetContext)) {
        prepared.forEach(function (item) {
          const moduleId = moduleIdForProjection(item.scope);
          if (!moduleId) return;
          setProjectionHealthRecord(item.scope, item.key, projectionHealthRecord(
            item.scope,
            item.key,
            "healthy",
            "当前工作投影已按受支持 schema 保存并通过完整场景命名空间校验。",
            { physicalKey: item.physicalKey }
          ));
        });
      }
      return receipt;
    } catch (error) {
      receipt.error = serializableError(error);
      receipt.atomic = receipt.rollbackErrors.length === 0;
      return receipt;
    }
  }

  function persist(scope, key, payload, context) {
    return persistBatch([{ scope, key, payload }], context);
  }

  function rollbackPersistedBatch(receipt) {
    const result = { ok: false, atomic: true, removedKeys: [], errors: [] };
    if (!receipt?.ok || receipt.requireEmpty !== true) {
      result.errors.push({ code: "S003_PROJECTION_ROLLBACK_UNSAFE", message: "仅可回滚要求空目标命名空间且已成功的原子批次。" });
      result.atomic = false;
      return result;
    }
    receipt.writes.slice().reverse().forEach(function (write) {
      try {
        window.localStorage.removeItem(write.physicalKey);
        if (window.localStorage.getItem(write.physicalKey) !== null) throw new Error("删除后物理键仍然存在");
        result.removedKeys.push(write.physicalKey);
      } catch (error) {
        result.errors.push({ physicalKey: write.physicalKey, error: serializableError(error) });
      }
    });
    result.ok = result.errors.length === 0;
    result.atomic = result.ok;
    return result;
  }

  function readProjection(scope, key) {
    if (!state.context) return null;
    return readProjectionForContext(state.context, scope, key);
  }

  function requirePersistence(receipt, message) {
    if (receipt?.ok) return receipt;
    const detail = receipt?.error?.message || "未知存储错误";
    const error = new Error(`${message || "浏览器投影持久化失败"}：${detail}`);
    error.code = receipt?.error?.code || "S003_PROJECTION_PERSISTENCE_FAILED";
    error.persistenceReceipt = clone(receipt);
    throw error;
  }

  function sourceFactorInputs(fixture) {
    return Object.fromEntries(fixture.enterprises.map(function (enterprise) {
      return [enterprise.enterpriseId, clone(enterprise.factorInputs || {})];
    }));
  }

  function completeEnterpriseFactorInputs(values) {
    const source = isPlainObject(values) ? values : {};
    return Object.fromEntries((bundle?.fixture?.enterprises || []).map(function (enterprise) {
      return [enterprise.enterpriseId, clone(isPlainObject(source[enterprise.enterpriseId]) ? source[enterprise.enterpriseId] : {})];
    }));
  }

  function modelConfigurationSnapshotForPublished(model, values, formedAt) {
    if (!model) return null;
    return {
      schemaVersion: "ofw.s003.m01.enterprise-factor-configuration-snapshot.v1",
      snapshotId: `S003-M01-MODEL-CONFIG-${model.packageVersion}`,
      snapshotVersion: model.packageVersion,
      status: "published-model-configuration",
      immutable: true,
      formedAt: formedAt || model.publishedAt || new Date().toISOString(),
      owner: "M01 本体管理",
      businessOwner: "财务公司",
      assessmentAt: bundle?.fixture?.assessmentAt || null,
      enterpriseCount: bundle?.fixture?.enterpriseCount || Object.keys(values || {}).length,
      factorCount: Object.keys(DATA?.FACTOR_INPUT_CHOICES || {}).length,
      modelPackageId: model.packageId,
      modelPackageVersion: model.packageVersion,
      values: completeEnterpriseFactorInputs(values || model.enterpriseFactorInputs || {})
    };
  }

  function configProjectionPayload(configDraft, status, publishedModel, snapshot) {
    const lastPublishedModel = clone(publishedModel);
    return {
      configDraft: clone(configDraft),
      publishedModel: lastPublishedModel,
      lastPublishedModel: clone(lastPublishedModel),
      status
    };
  }

  function factorProjectionPayload(status, values, snapshot) {
    const lastPublishedSnapshot = snapshot === null ? null : clone(snapshot);
    return {
      status,
      values: clone(values),
      snapshot: clone(lastPublishedSnapshot),
      lastPublishedSnapshot: clone(lastPublishedSnapshot)
    };
  }

  function factorInputsFromSnapshot(snapshot) {
    if (!snapshot) return {};
    if (snapshot.values && typeof snapshot.values === "object" && !Array.isArray(snapshot.values)) {
      return clone(snapshot.values);
    }
    if (!Array.isArray(snapshot.records)) return {};
    return Object.fromEntries(snapshot.records.map(function (record) {
      const values = Object.fromEntries((record.values || []).map(function (item) {
        const stateCode = item.state || "EXPLICIT_VALUE";
        const value = stateCode === "NOT_APPLICABLE" || stateCode === "DEFAULTED_ZERO"
          ? null
          : item.normalizedValue ?? item.sourceValue ?? null;
        return [item.factorName, value];
      }));
      return [record.enterpriseId, values];
    }));
  }

  function normalizeDecisionRecord(record) {
    const source = record?.actionRequest || record;
    const actionRequestId = source?.actionRequestId || source?.requestId || source?.id;
    const scenarioIdentity = source?.scenarioContext || source?.scenarioIdentity;
    const enterpriseId = source?.enterpriseId || source?.subjectId;
    const enterpriseName = source?.enterpriseName || source?.subjectName;
    const actionTypeId = source?.actionTypeId || source?.actionType?.id;
    const assessmentAt = source?.assessmentAt || source?.metric?.evaluatedAt;
    const resultVersion = source?.resultVersion || source?.sourceResultVersion;
    if (!actionRequestId || !scenarioIdentity) return null;
    const todo = clone(record?.todo || source?.todo || null);
    const stage = todo ? "confirmed" : "submitted";
    const actionRequest = {
      ...clone(source),
      schemaVersion: source.schemaVersion || "ofw.s003.m04.action-request.v1",
      actionRequestId,
      scenarioIdentity: clone(scenarioIdentity),
      enterpriseId: enterpriseId || null,
      enterpriseName: enterpriseName || null,
      actionTypeId: actionTypeId || null,
      assessmentAt: assessmentAt || null,
      resultVersion: resultVersion || null,
      idempotencyKey: record?.idempotencyKey || source.idempotencyKey,
      owner: source.owner ?? null,
      ownerId: source.ownerId ?? null,
      todoId: source.todoId || todo?.todoId || null,
      confirmed: stage === "confirmed" ? source.confirmed !== false : false,
      requiresHumanConfirmation: stage === "submitted",
      decisionRecipient: clone(source.decisionRecipient || null)
    };
    return {
      ...clone(actionRequest),
      scenarioRunId: actionRequest.scenarioIdentity.scenarioRunId,
      actionRequest: clone(actionRequest),
      todo,
      idempotencyKey: record?.idempotencyKey || actionRequest.idempotencyKey,
      stage,
      created: record?.created !== false,
      idempotent: Boolean(record?.idempotent),
      duplicate: Boolean(record?.duplicate)
    };
  }

  function sourceDecisionRecords() {
    const pending = (bundle?.decisionInbox?.requests || []).map(normalizeDecisionRecord).filter(Boolean);
    const confirmed = (bundle?.decisionResults?.confirmations || []).map(normalizeDecisionRecord).filter(Boolean);
    const records = new Map();
    pending.forEach(function (item) { records.set(item.idempotencyKey, item); });
    confirmed.forEach(function (item) { records.set(item.idempotencyKey, item); });
    return [...records.values()];
  }

  function confirmedDecisionRecords(records) {
    return (records || []).filter(function (item) {
      return Boolean(item?.todo || item?.actionRequest?.todoId || item?.todoId);
    });
  }

  function createConfigDraft(model) {
    const service = bundle?.configService || window.S003ConfigService;
    if (service?.createDraft) {
      const draft = service.createDraft(model);
      return {
        schemaVersion: draft.schemaVersion,
        draftId: draft.draftId,
        lifecycleStatus: draft.lifecycleStatus,
        basedOnPackageId: draft.basedOnPackageId,
        basedOnVersion: draft.basedOnVersion,
        proposedVersion: draft.proposedVersion,
        owner: draft.owner,
        createdAt: draft.createdAt,
        weights: clone(draft.editable.weights),
        factors: clone(draft.editable.factors),
        riskTiers: clone(draft.editable.riskTiers),
        indicatorOrder: clone(draft.locked.indicatorOrder),
        assessment: clone(draft.locked.assessment),
        locked: clone(draft.locked),
        changedAt: null
      };
    }
    return {
      packageId: model.packageId,
      packageVersion: model.packageVersion,
      weights: clone(model.weights),
      factors: clone(model.factors),
      riskTiers: clone(model.riskTiers),
      indicatorOrder: clone(model.indicatorOrder),
      assessment: clone(model.assessment),
      changedAt: null
    };
  }

  function hydrateConfigDraft(value, model) {
    const baseline = createConfigDraft(model);
    if (!value) return baseline;
    const projected = clone(value);
    return {
      ...baseline,
      ...projected,
      weights: clone(projected.weights || baseline.weights),
      factors: clone(projected.factors || baseline.factors),
      riskTiers: clone(projected.riskTiers || baseline.riskTiers),
      indicatorOrder: clone(projected.indicatorOrder || baseline.indicatorOrder),
      assessment: clone(projected.assessment || baseline.assessment),
      locked: clone(projected.locked || baseline.locked)
    };
  }

  function canonicalConfigDraft(draft) {
    const source = draft || state.configDraft;
    const locked = source.locked || {
      resourceType: state.publishedModel.resourceType,
      indicatorOrder: clone(state.publishedModel.indicatorOrder),
      formulas: clone(state.publishedModel.formulas),
      scoreAnchors: clone(state.publishedModel.scoreAnchors),
      profitStability: clone(state.publishedModel.profitStability),
      actionTypes: clone(state.publishedModel.actionTypes),
      assessment: clone(state.publishedModel.assessment)
    };
    return {
      schemaVersion: source.schemaVersion || "ofw.s003.m01.config-draft.v1",
      draftId: source.draftId || `S003-MODEL-DRAFT-${Date.now()}`,
      lifecycleStatus: source.lifecycleStatus || (state.configStatus === "validated" ? "validated" : "draft"),
      basedOnPackageId: state.publishedModel.packageId,
      basedOnVersion: state.publishedModel.packageVersion,
      proposedVersion: nextMonotonicModelVersion(state.publishedModel.packageVersion, source.proposedVersion),
      owner: source.owner || state.publishedModel.businessOwner || "财务公司",
      createdAt: source.createdAt || source.changedAt || new Date().toISOString(),
      validatedAt: source.validatedAt || null,
      editable: {
        weights: clone(source.weights),
        factors: clone(source.factors),
        riskTiers: clone(source.riskTiers)
      },
      locked: clone(locked)
    };
  }

  function routeFromHash() {
    const raw = window.location.hash.replace(/^#/, "");
    const query = new URL(window.location.href).searchParams;
    if (raw.startsWith("report/")) {
      return {
        view: "report",
        enterpriseId: decodeURIComponent(raw.split("?")[0].slice(7)),
        scenarioId: query.get("scenarioId"),
        scenarioVersion: query.get("scenarioVersion"),
        scenarioRunId: query.get("scenarioRunId"),
        reportId: query.get("reportId"),
        prototypeVersion: query.get("prototypeVersion"),
        queryEnterpriseId: query.get("enterpriseId"),
        checkpointCode: query.get("checkpoint")
      };
    }
    const [requestedView, requestedAnchor] = raw.split("/");
    const view = DATA.VIEWS.some(function (item) { return item.id === requestedView; }) ? requestedView : "platform-home";
    const anchor = ["m03-query", "m04-decision", "m04-todos"].includes(requestedAnchor) ? requestedAnchor : null;
    const moduleId = anchor?.startsWith("m04-") ? "M04" : moduleForView(view);
    return {
      view,
      anchor,
      moduleId,
      scenarioId: query.get("scenarioId"),
      scenarioVersion: query.get("scenarioVersion"),
      scenarioRunId: query.get("scenarioRunId"),
      reportId: query.get("reportId"),
      prototypeVersion: query.get("prototypeVersion"),
      queryEnterpriseId: query.get("enterpriseId"),
      checkpointCode: query.get("checkpoint")
    };
  }

  function moduleForView(view) {
    return {
      "platform-home": "M06",
      "data-quality": "M02",
      "factor-entry": "M02",
      configuration: "M01",
      "query-decision": "M03",
      "agent-boundary": "M05",
      overview: "M06",
      enterprises: "M06",
      runs: "M06",
      checkpoints: "M06",
      report: "M06"
    }[view] || "M06";
  }

  function projectedRuntimeById(runId) {
    if (!runId || !window.localStorage) return { found: false, payload: null, error: null };
    const candidates = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      const match = typeof key === "string" ? key.match(RUNTIME_STORAGE_KEY_RE) : null;
      if (match && match[1] === runId) candidates.push(key);
    }
    if (!candidates.length) return { found: false, payload: null, error: null };
    if (candidates.length !== 1) {
      return { found: true, payload: null, error: { code: "S003_RUNTIME_NAMESPACE_AMBIGUOUS", message: "同一 scenarioRunId 存在多个 M06 运行投影命名空间。" } };
    }
    try {
      const physicalKey = candidates[0];
      const raw = window.localStorage.getItem(physicalKey);
      const envelope = JSON.parse(raw);
      const allowedEnvelopeKeys = ["payload", "savedAt", "scenarioContext", "schemaVersion"];
      const envelopeKeys = isPlainObject(envelope) ? Object.keys(envelope).sort() : [];
      if (!isPlainObject(envelope) || envelopeKeys.length !== allowedEnvelopeKeys.length || envelopeKeys.some(function (key, index) { return key !== allowedEnvelopeKeys[index]; })) {
        failProjection("S003_RUNTIME_ENVELOPE_INVALID", "M06 运行投影 envelope 字段集合不合法。");
      }
      if (envelope.schemaVersion !== FOUNDATION.STORAGE_SCHEMA_VERSION) {
        failProjection("S003_RUNTIME_ENVELOPE_SCHEMA_INVALID", "M06 运行投影 envelope schemaVersion 不兼容。");
      }
      if (typeof envelope.savedAt !== "string" || Number.isNaN(Date.parse(envelope.savedAt))) {
        failProjection("S003_RUNTIME_ENVELOPE_TIME_INVALID", "M06 运行投影 savedAt 不是合法时间。");
      }
      const context = assertS003Context(envelope.scenarioContext);
      if (context.scenarioRunId !== runId) failProjection("S003_RUNTIME_NAMESPACE_RUN_MISMATCH", "M06 命名空间 runId 与 envelope 上下文不一致。");
      const adapter = FOUNDATION.createNamespacedStorage({ storage: window.localStorage, context, scope: "m06" });
      if (adapter.keyFor("runs/current") !== physicalKey) {
        failProjection("S003_RUNTIME_NAMESPACE_INVALID", "M06 运行投影物理键不属于声明的精确场景命名空间。");
      }
      const payload = adapter.get("runs/current");
      assertProjectionPayload(context, "m06", "runs/current", payload);
      return { found: true, payload: clone(payload), error: null };
    } catch (error) {
      return { found: true, payload: null, error: serializableError(error) };
    }
  }

  function resetBootstrapRuntimeState() {
    checkpointRuntime = null;
    state = {
      ...state,
      ready: false,
      fatalError: null,
      context: null,
      currentView: "platform-home",
      activeModuleId: "M06",
      currentAnchor: null,
      selectedEnterpriseId: null,
      navCollapsed: false,
      mobileNavOpen: false,
      activeConfigTab: "weights",
      enterpriseSearch: "",
      enterpriseRiskFilter: "ALL",
      enterpriseSectorFilter: "ALL",
      enterpriseSort: "score-asc",
      factorEntrySearch: "",
      factorEntryStatus: "published",
      factorEntryValidation: null,
      factorInputSnapshot: null,
      factorInputs: {},
      configStatus: "published",
      configValidation: null,
      configDraft: null,
      publishedModel: null,
      activeRun: null,
      lastSuccessfulRun: null,
      runHistory: [],
      runStatus: "idle",
      runError: null,
      regressionRun: null,
      queryId: null,
      queryAnswer: null,
      decisions: [],
      actionRequests: [],
      pendingDecision: null,
      historicalView: null,
      requestedScenarioRunId: null,
      requestedReportId: null,
      restoredFromCheckpoint: null,
      operationLineage: null,
      operationNotice: null,
      projectionPersistence: null,
      projectionHealth: {},
      projectionRecoveryReceipts: [],
      checkpointCatalogIssues: [],
      runtimeHealth: null,
      acceptanceReady: false
    };
  }

  function assertProjectedRunResources(projectedRuntime, projectedConfig, projectedFactors) {
    if (!projectedRuntime) return;
    if (!projectedConfig) {
      failProjection("S003_RUNTIME_COMPANION_PROJECTION_MISSING", "动态运行缺少同轮次 M01 模型配置投影，拒绝恢复或回退静态资源。");
    }
    const run = projectedRuntime?.activeRun;
    if (!run) return;
    const model = projectedConfig.publishedModel;
    const snapshot = projectedFactors?.snapshot || projectedConfig.modelConfigurationSnapshot;
    if (!model || !snapshot) {
      failProjection("S003_RUNTIME_RESOURCE_PROJECTION_NULL", "已评估动态运行的 Published 模型或独立 T053 输入快照被显式置空，拒绝回退静态资源。");
    }
    assertPublishedModel(model, "动态运行模型");
    assertInputSnapshot(snapshot);
    if (run.modelVersion !== model.packageVersion || run.inputSnapshotId !== snapshot.snapshotId) {
      failProjection("S003_RUNTIME_RESOURCE_PROJECTION_MISMATCH", "动态运行与同轮次 M01 Published 模型及 M02/T053 输入版本不一致。");
    }
  }

  function projectionLookupForContext(context, scope, key) {
    if (!FOUNDATION || !window.localStorage) return { found: false, payload: null, error: null };
    let physicalKey = null;
    let raw = null;
    try {
      const adapter = FOUNDATION.createNamespacedStorage({ storage: window.localStorage, context, scope });
      physicalKey = adapter.keyFor(key);
      raw = window.localStorage.getItem(physicalKey);
      if (raw === null) return { found: false, payload: null, error: null, physicalKey };
      const payload = adapter.get(key);
      return {
        found: true,
        payload: assertProjectionPayload(context, scope, key, payload),
        error: null,
        physicalKey,
        raw
      };
    } catch (error) {
      return { found: true, payload: null, error: serializableError(error), physicalKey, raw };
    }
  }

  function recoveryReceiptId() {
    return nextOperationId().replace(/^OP-/, "PR-");
  }

  function writeProjectionRecoveryReceipt(context, input) {
    const receiptId = input.receiptId || recoveryReceiptId();
    const logicalKey = `projection-recovery/${receiptId}`;
    const adapter = storage("runtime-recovery", context);
    const receipt = {
      schemaVersion: PROJECTION_RECOVERY_RECEIPT_SCHEMA_VERSION,
      receiptId,
      scenarioContext: clone(context),
      scope: input.scope,
      logicalKey: input.key,
      originalPhysicalKey: input.originalPhysicalKey || null,
      originalRaw: input.originalRaw === null || input.originalRaw === undefined ? null : String(input.originalRaw),
      originalProjectionSchemaVersion: input.originalProjectionSchemaVersion || null,
      action: input.action,
      status: input.status,
      reason: input.reason || null,
      rebuiltFrom: input.rebuiltFrom || null,
      formalArtifactsUnaffected: true,
      formedAt: input.formedAt || new Date().toISOString()
    };
    const envelope = adapter.set(logicalKey, receipt);
    return { ...receipt, logicalReceiptKey: logicalKey, physicalReceiptKey: adapter.keyFor(logicalKey), savedAt: envelope.savedAt };
  }

  function rawProjectionPayload(lookup) {
    if (!lookup?.raw) return null;
    try {
      const envelope = JSON.parse(lookup.raw);
      return isPlainObject(envelope) && isPlainObject(envelope.payload) ? envelope.payload : null;
    } catch (_) {
      return null;
    }
  }

  function migrateKnownLegacyProjection(context, scope, key, lookup) {
    const legacy = rawProjectionPayload(lookup);
    if (scope !== "m02" || key !== "factor-inputs/current" || legacy?.projectionSchemaVersion !== LEGACY_PROJECTION_SCHEMA_VERSION) {
      return null;
    }
    try {
      const migrated = {
        ...clone(legacy),
        projectionSchemaVersion: PROJECTION_SCHEMA_VERSION,
        projectionContext: clone(context),
        lastPublishedSnapshot: hasOwn(legacy, "lastPublishedSnapshot")
          ? clone(legacy.lastPublishedSnapshot)
          : clone(legacy.snapshot ?? null)
      };
      assertProjectionPayload(context, scope, key, migrated);
      const preparedReceipt = writeProjectionRecoveryReceipt(context, {
        scope,
        key,
        originalPhysicalKey: lookup.physicalKey,
        originalRaw: lookup.raw,
        originalProjectionSchemaVersion: legacy.projectionSchemaVersion,
        action: "migrate-known-schema",
        status: "prepared",
        reason: `${LEGACY_PROJECTION_SCHEMA_VERSION} 已按显式兼容映射迁移到 ${PROJECTION_SCHEMA_VERSION}。`,
        rebuiltFrom: "legacy-current-projection"
      });
      const adapter = storage(scope, context);
      adapter.set(key, migrated);
      const completedReceipt = writeProjectionRecoveryReceipt(context, {
        ...preparedReceipt,
        receiptId: preparedReceipt.receiptId,
        scope,
        key,
        originalPhysicalKey: lookup.physicalKey,
        originalRaw: lookup.raw,
        originalProjectionSchemaVersion: legacy.projectionSchemaVersion,
        action: "migrate-known-schema",
        status: "completed",
        reason: `${LEGACY_PROJECTION_SCHEMA_VERSION} 已按显式兼容映射迁移到 ${PROJECTION_SCHEMA_VERSION}。`,
        rebuiltFrom: "legacy-current-projection",
        formedAt: preparedReceipt.formedAt
      });
      return { payload: migrated, receipt: completedReceipt };
    } catch (_) {
      return null;
    }
  }

  function isolateAndRebuildProjection(context, scope, key, lookup, fallbackFactory) {
    const unsafePayload = rawProjectionPayload(lookup);
    const preparedReceipt = writeProjectionRecoveryReceipt(context, {
      scope,
      key,
      originalPhysicalKey: lookup.physicalKey,
      originalRaw: lookup.raw,
      originalProjectionSchemaVersion: unsafePayload?.projectionSchemaVersion || null,
      action: "isolate-incompatible-projection",
      status: "prepared",
      reason: lookup.error?.message || "当前工作投影与受支持 schema 不兼容。",
      rebuiltFrom: "formal-published-inputs"
    });
    const rebuilt = projectionPayload(context, fallbackFactory());
    assertProjectionPayload(context, scope, key, rebuilt);
    storage(scope, context).set(key, rebuilt);
    const completedReceipt = writeProjectionRecoveryReceipt(context, {
      ...preparedReceipt,
      receiptId: preparedReceipt.receiptId,
      scope,
      key,
      originalPhysicalKey: lookup.physicalKey,
      originalRaw: lookup.raw,
      originalProjectionSchemaVersion: unsafePayload?.projectionSchemaVersion || null,
      action: "isolate-incompatible-projection",
      status: "completed",
      reason: lookup.error?.message || "当前工作投影与受支持 schema 不兼容。",
      rebuiltFrom: "formal-published-inputs",
      formedAt: preparedReceipt.formedAt
    });
    return { payload: rebuilt, receipt: completedReceipt };
  }

  function resolveProjectionForBootstrap(context, scope, key, fallbackFactory) {
    const lookup = projectionLookupForContext(context, scope, key);
    if (!lookup.found) {
      return {
        payload: null,
        health: projectionHealthRecord(scope, key, "missing", "当前工作投影尚未形成；正式 Published 资源可独立读取。")
      };
    }
    if (!lookup.error) {
      return {
        payload: lookup.payload,
        health: projectionHealthRecord(scope, key, "healthy", "当前工作投影 schema 与场景命名空间校验通过。", { physicalKey: lookup.physicalKey })
      };
    }
    if (typeof fallbackFactory === "function") {
      try {
        const migrated = lookup.error.code === "S003_PROJECTION_PAYLOAD_SCHEMA_INVALID"
          ? migrateKnownLegacyProjection(context, scope, key, lookup)
          : null;
        if (migrated) {
          return {
            payload: migrated.payload,
            receipt: migrated.receipt,
            health: projectionHealthRecord(scope, key, "migrated", "旧版当前工作投影已显式迁移；原始记录保存在恢复回执中。", {
              physicalKey: lookup.physicalKey,
              receiptId: migrated.receipt.receiptId
            })
          };
        }
        const isolated = isolateAndRebuildProjection(context, scope, key, lookup, fallbackFactory);
        return {
          payload: isolated.payload,
          receipt: isolated.receipt,
          health: projectionHealthRecord(scope, key, "isolated-rebuilt", "不兼容工作投影已原样隔离，并在同一 scenarioRunId 下从正式 Published 输入重建 Draft。", {
            physicalKey: lookup.physicalKey,
            receiptId: isolated.receipt.receiptId
          })
        };
      } catch (recoveryError) {
        return {
          payload: null,
          health: projectionHealthRecord(scope, key, "blocked", `工作投影隔离或重建失败：${recoveryError.message || String(recoveryError)}`, {
            physicalKey: lookup.physicalKey,
            error: serializableError(recoveryError)
          })
        };
      }
    }
    return {
      payload: null,
      health: projectionHealthRecord(scope, key, "blocked", `当前工作投影已存在但校验失败：${lookup.error.message}`, {
        physicalKey: lookup.physicalKey,
        error: clone(lookup.error)
      })
    };
  }

  function assertProjectionLookupHealthy(lookup, label) {
    if (lookup?.error) {
      failProjection(
        "S003_COMPANION_PROJECTION_CORRUPT",
        `${label}同轮次投影已存在但损坏：${lookup.error.message}。该状态不同于从未形成，已拒绝静默回退。`
      );
    }
    return lookup;
  }

  function buildRuntimeHealth() {
    const formalRun = formalSuccessfulRun(state.lastSuccessfulRun) || formalSuccessfulRun(state.activeRun);
    const currentFormalRun = Boolean(formalRun && state.context && exactContextMatch(formalRun.scenarioContext, state.context));
    const m01Projection = state.projectionHealth.M01 || projectionHealthRecord("m01", "config/current", "missing", "当前模型 Draft 尚未形成。");
    const m02Projection = state.projectionHealth.M02 || projectionHealthRecord("m02", "data-assets/current", "missing", "当前财务数据资产状态尚未检查。");
    const m04Projection = state.projectionHealth.M04 || projectionHealthRecord("m04", "action-requests/current", "missing", "当前 Action Request 工作投影尚未形成。");
    const recoveryStatuses = new Set(["migrated", "isolated-rebuilt"]);
    const blockedDraftStatuses = new Set(["blocked"]);
    const modules = {
      M01: {
        status: bundle?.model && bundle?.publishedPointer ? (blockedDraftStatuses.has(m01Projection.status) ? "warning" : "healthy") : "blocked",
        formalRead: bundle?.model && bundle?.publishedPointer ? "ready" : "blocked",
        draftProjection: clone(m01Projection),
        detail: bundle?.model && bundle?.publishedPointer ? "正式 Published 模型可独立读取。" : "正式 Published 模型或权威指针缺失。"
      },
      M02: {
        status: bundle?.formalDataAsset ? (blockedDraftStatuses.has(m02Projection.status) ? "warning" : "healthy") : "blocked",
        formalRead: bundle?.formalDataAsset ? "ready" : "blocked",
        dataAssetState: clone(m02Projection),
        detail: bundle?.formalDataAsset ? "正式财务数据资产可独立读取；企业当期因子取值由独立 T053 人工输入快照维护。" : "正式财务数据资产缺失。"
      },
      M03: {
        status: currentFormalRun ? "healthy" : "blocked",
        formalConsumption: currentFormalRun ? "ready" : "blocked",
        detail: currentFormalRun ? "Published C035 与正式事实可按当前 scenarioRunId 只读消费。" : "当前 scenarioRunId 尚无可消费的正式 Published 运行证据。"
      },
      M04: {
        status: currentFormalRun ? (blockedDraftStatuses.has(m04Projection.status) ? "warning" : "healthy") : "blocked",
        formalConsumption: currentFormalRun ? "ready" : "blocked",
        workProjection: clone(m04Projection),
        detail: currentFormalRun ? "当前正式结果可进入通用决策中心；负责人待办仍需人工确认。" : "当前 scenarioRunId 尚无可进入决策中心的正式 Published 结果。"
      },
      M05: {
        status: bundle?.agentPosition ? "healthy" : "blocked",
        detail: bundle?.agentPosition ? "平台通用报告伴读 Agent 的 S003 场景配置可读；不新增评分或处置 Agent。" : "Agent 能力边界资源缺失。"
      },
      M06: {
        status: currentFormalRun && state.runStatus === "succeeded" ? "healthy" : "blocked",
        currentRun: state.runStatus,
        authorityMode: state.activeRun?.authorityMode || null,
        detail: currentFormalRun && state.runStatus === "succeeded"
          ? "当前 scenarioRunId 已绑定正式 Published 结果与报告。"
          : state.runError || "当前运行身份尚未形成可正式消费的 Published 结果。"
      }
    };
    const warnings = [];
    [m01Projection, m02Projection, m04Projection].forEach(function (item) {
      if (recoveryStatuses.has(item.status) || blockedDraftStatuses.has(item.status)) warnings.push(item.detail);
    });
    // 已隔离的旧 Checkpoint 只属于历史目录审计，不代表当前六模块运行
    // 降级。完整问题仍通过 checkpointCatalogIssues 对外提供，但不再
    // 污染“当前运行健康”摘要。
    const blockingReasons = Object.entries(modules)
      .filter(function ([, value]) { return value.status === "blocked"; })
      .map(function ([moduleId, value]) { return `${moduleId}：${value.detail || "当前运行健康检查未通过。"}`; });
    if (state.fatalError) blockingReasons.unshift(state.fatalError);
    const status = blockingReasons.length ? "blocked" : warnings.length ? "degraded" : state.ready ? "healthy" : "checking";
    return {
      schemaVersion: "ofw.s003.runtime-health.v1",
      status,
      currentRunHealthy: status === "healthy",
      formalPublishedReadReady: Boolean(bundle?.model && bundle?.publishedPointer && bundle?.formalDataAsset),
      checkedAt: new Date().toISOString(),
      scenarioContext: clone(state.context),
      modules,
      projectionHealth: clone(state.projectionHealth),
      recoveryReceipts: clone(state.projectionRecoveryReceipts),
      checkpointCatalogIssues: clone(state.checkpointCatalogIssues),
      warnings: warnings.filter(Boolean),
      blockingReasons,
      acceptanceReady: false
    };
  }

  function refreshRuntimeHealthState() {
    state.runtimeHealth = buildRuntimeHealth();
    return state.runtimeHealth;
  }

  async function bootstrap() {
    try {
      resetBootstrapRuntimeState();
      bundle = null;
      bundle = await DATA.load();
      const route = routeFromHash();
      const staticRunId = bundle.c035Results?.scenarioIdentity?.scenarioRunId || null;
      const identityMismatch = route.scenarioId && route.scenarioId !== "S003"
        ? `深链 scenarioId=${route.scenarioId} 与当前 S003 场景不一致。`
        : route.scenarioVersion && route.scenarioVersion !== "S003-v1"
          ? `深链 scenarioVersion=${route.scenarioVersion} 与当前 S003-v1 不一致。`
          : route.prototypeVersion && route.prototypeVersion !== "1.1.0"
            ? `深链 prototypeVersion=${route.prototypeVersion} 与当前 v1.1.0 不一致。`
            : route.queryEnterpriseId && route.queryEnterpriseId !== route.enterpriseId
              ? "深链 enterpriseId 与报告路径不一致。"
              : null;
      if (identityMismatch) {
        set({ ready: false, fatalError: identityMismatch });
        return;
      }
      if (route.checkpointCode && !bundle.checkpoints.some(function (item) { return item.code === route.checkpointCode && item.manifest; })) {
        set({ ready: false, fatalError: `未找到正式 Checkpoint ${route.checkpointCode}，已拒绝构造历史状态。` });
        return;
      }
      if (route.checkpointCode && typeof bundle.ensureCheckpointArtifacts === "function") {
        await bundle.ensureCheckpointArtifacts(route.checkpointCode);
      }
      const projectedRuntimeLookup = projectedRuntimeById(route.scenarioRunId);
      if (route.scenarioRunId && projectedRuntimeLookup.error) {
        set({ ready: false, fatalError: `运行 ${route.scenarioRunId} 的浏览器投影无效：${projectedRuntimeLookup.error.message}` });
        return;
      }
      const projectedRuntime = projectedRuntimeLookup.payload;
      if (route.scenarioRunId && !projectedRuntime && route.scenarioRunId !== staticRunId) {
        set({ ready: false, fatalError: `未找到运行 ${route.scenarioRunId} 的隔离投影或正式证据，已拒绝静默回退其他轮次。` });
        return;
      }
      if (route.reportId && route.enterpriseId && route.reportId !== `S003-RPT-${route.scenarioRunId}-${route.enterpriseId}`) {
        set({ ready: false, fatalError: "深链 reportId 未精确绑定当前企业与 scenarioRunId。" });
        return;
      }
      const projectedRun = projectedRuntime?.activeRun || null;
      const context = projectedRuntime?.context
        ? Object.freeze(clone(projectedRuntime.context))
        : projectedRun?.scenarioContext
        ? Object.freeze(clone(projectedRun.scenarioContext))
        : bundle.c035Results?.scenarioIdentity
          ? Object.freeze(clone(bundle.c035Results.scenarioIdentity))
          : initialContext(bundle.manifest);
      if (FOUNDATION) FOUNDATION.assertScenarioContext(context);
      const staticContextRunMatches = staticRunId === context.scenarioRunId;
      const configResolution = resolveProjectionForBootstrap(context, "m01", "config/current", function () {
        return configProjectionPayload(createConfigDraft(bundle.model), "draft", bundle.model);
      });
      const factorResolution = resolveProjectionForBootstrap(context, "m02", "factor-inputs/current");
      const decisionResolution = resolveProjectionForBootstrap(context, "m04", "action-requests/current", function () {
        return { items: staticContextRunMatches ? sourceDecisionRecords() : [] };
      });
      const projectionRecoveryReceipts = [configResolution.receipt, factorResolution.receipt, decisionResolution.receipt].filter(Boolean);
      const projectionHealth = {
        M01: configResolution.health,
        M02: projectionHealthRecord("m02", "data-assets/current", bundle.formalDataAsset ? "healthy" : "blocked", bundle.formalDataAsset ? "财务工作簿、质量结果和数据资产可独立读取。" : "正式财务数据资产缺失。"),
        M04: decisionResolution.health
      };
      const projectedFactors = factorResolution.payload;
      const projectedConfig = configResolution.payload;
      const projectedDecisions = decisionResolution.payload;
      let runtimeProjectionResourceError = null;
      try {
        assertProjectedRunResources(projectedRuntime, projectedConfig, projectedFactors);
      } catch (error) {
        const companionProjectionRecoveredOrBlocked = [configResolution.health]
          .some(function (item) { return item && item.status !== "healthy"; });
        if (!companionProjectionRecoveredOrBlocked) throw error;
        runtimeProjectionResourceError = serializableError(error);
        projectionHealth.M06 = projectionHealthRecord("m06", "runs/current", "blocked", error.message || String(error), {
          error: runtimeProjectionResourceError
        });
      }
      if (!projectionHealth.M06) {
        projectionHealth.M06 = projectedRuntime
          ? projectionHealthRecord("m06", "runs/current", "healthy", "当前运行投影与同轮 M01 Published 模型、M02 财务数据及 T053 输入身份一致。")
          : projectionHealthRecord("m06", "runs/current", "missing", "当前正式轮次直接读取不可变 Published 结果，不依赖浏览器运行投影。");
      }
      const publishedModel = projectedConfig && hasOwn(projectedConfig, "publishedModel")
        ? publishedModelWithoutEnterpriseInputs(projectedConfig.publishedModel)
        : publishedModelWithoutEnterpriseInputs(bundle.model);
      const configDraft = projectedConfig && hasOwn(projectedConfig, "configDraft")
        ? hydrateConfigDraft(projectedConfig.configDraft, publishedModel)
        : createConfigDraft(publishedModel);
      const staticInputValues = factorInputsFromSnapshot(bundle.humanInputSnapshot);
      const factorInputs = projectedFactors && hasOwn(projectedFactors, "values")
        ? clone(projectedFactors.values)
        : projectedConfig && hasOwn(projectedConfig, "enterpriseFactorInputs")
          ? clone(projectedConfig.enterpriseFactorInputs)
          : Object.keys(staticInputValues).length
            ? staticInputValues
            : sourceFactorInputs(bundle.fixture);
      const factorInputSnapshot = projectedFactors && hasOwn(projectedFactors, "snapshot")
        ? clone(projectedFactors.snapshot)
        : projectedConfig && hasOwn(projectedConfig, "modelConfigurationSnapshot")
          ? clone(projectedConfig.modelConfigurationSnapshot)
          : clone(bundle.humanInputSnapshot);
      const currentDecisionRecords = Array.isArray(projectedDecisions?.items)
        ? projectedDecisions.items.map(normalizeDecisionRecord).filter(Boolean)
        : staticContextRunMatches ? sourceDecisionRecords() : [];
      state = {
        ...state,
        ready: true,
        context,
        currentView: route.view,
        activeModuleId: route.moduleId || moduleForView(route.view),
        currentAnchor: route.anchor || null,
        selectedEnterpriseId: route.enterpriseId || bundle.fixture.enterprises[0]?.enterpriseId || null,
        factorInputs,
        factorInputSnapshot,
        factorEntryStatus: projectedFactors?.status === "draft" || projectedFactors?.status === "validated" ? projectedFactors.status : "published",
        publishedModel,
        configDraft,
        configStatus: projectedConfig?.status === "draft" || projectedConfig?.status === "validated" ? projectedConfig.status : "published",
        requestedScenarioRunId: route.scenarioRunId || null,
        requestedReportId: route.reportId || null,
        restoredFromCheckpoint: projectedRuntime?.restoredFromCheckpoint || null,
        operationLineage: projectedRuntime ? assertOperationLineage(projectedRuntime, context) : null,
        historicalView: null,
        fatalError: null,
        projectionHealth,
        projectionRecoveryReceipts,
        projectionNotice: projectionRecoveryReceipts.length
          ? "检测到旧版或不兼容的当前工作投影；原始记录已保留在隔离回执中，正式 Checkpoint、Published 事实、报告和决策证据未改动。"
          : Object.values(projectionHealth).some(function (item) { return item?.status === "blocked"; })
            ? "部分当前工作投影校验失败；正式 Published 只读资源仍可使用，相关写操作已按模块 fail-closed。"
            : "浏览器存储仅保存可丢弃的当前工作投影，不作为正式快照真源。",
        decisions: confirmedDecisionRecords(currentDecisionRecords),
        actionRequests: currentDecisionRecords
      };
      emit();
      if (runtimeProjectionResourceError) {
        const formalContext = clone(bundle.c035Results?.scenarioIdentity);
        const formalRun = formalContext
          ? normalizeRun(bundle.c035Results, formalContext, { model: bundle.model, inputSnapshot: bundle.humanInputSnapshot })
          : null;
        if (formalRun) createCheckpointRuntime(formalRun);
        set({
          activeRun: null,
          regressionRun: null,
          lastSuccessfulRun: formalRun,
          runHistory: formalRun ? [formalRun] : [],
          runStatus: "blocked",
          runError: `当前运行投影与同轮 M01/M02 资源不一致：${runtimeProjectionResourceError.message}`,
          operationLineage: null,
          operationNotice: "当前动态运行已按模块阻断；正式 Published 模型和历史证据仍可只读查看，未触发自动重评。"
        });
      } else if (projectedRun) {
        const run = ensureRuntimeReports(projectedRun, context, { model: publishedModel, inputSnapshot: state.factorInputSnapshot });
        const regression = run.scenarioContext?.status === "regression" || projectedRuntime?.regressionRun?.runId === run.runId;
        const lastSuccessful = projectedRuntime.lastSuccessfulRun;
        if (lastSuccessful) createCheckpointRuntime(lastSuccessful);
        const projectedHistory = (projectedRuntime?.runHistory || []).filter(function (item) { return item.runId !== run.runId; });
        set({
          activeRun: run,
          regressionRun: regression ? run : null,
          lastSuccessfulRun: lastSuccessful,
          runHistory: [run, ...projectedHistory].slice(0, 20),
          runStatus: projectedRuntime.runStatus,
          runError: null,
          operationLineage: assertOperationLineage(projectedRuntime, context),
          operationNotice: regression
            ? `已按深链打开隔离演练运行 ${DATA.shortId(run.runId)}；未提升为正式成功运行。`
            : `已按深链打开运行 ${DATA.shortId(run.runId)} 的工作台投影。`
        });
      } else if (projectedRuntime && context.status === "restored") {
        const lastSuccessful = projectedRuntime.lastSuccessfulRun || null;
        if (lastSuccessful) createCheckpointRuntime(lastSuccessful);
        set({
          activeRun: null,
          regressionRun: null,
          lastSuccessfulRun: lastSuccessful,
          runHistory: projectedRuntime.runHistory || (lastSuccessful ? [lastSuccessful] : []),
          runStatus: "restored",
          runError: null,
          operationLineage: assertOperationLineage(projectedRuntime, context),
          operationNotice: `已恢复 ${projectedRuntime.restoredFromCheckpoint || "Checkpoint"} 的隔离副本；当前新 runId 尚未评估。`
        });
      } else if (bundle.c035Results?.scenarioIdentity?.scenarioRunId === context.scenarioRunId) {
        const run = normalizeRun(bundle.c035Results, context, { model: bundle.model, inputSnapshot: bundle.humanInputSnapshot });
        createCheckpointRuntime(run);
        set({
          activeRun: run,
          regressionRun: null,
          lastSuccessfulRun: run,
          runHistory: [run],
          runStatus: "succeeded",
          runError: null,
          restoredFromCheckpoint: null,
          operationLineage: null,
          operationNotice: "已读取 CP03 同轮次 Published C035 权威结果与 CP06 正式报告。"
        });
      } else {
        await evaluate(context, { initial: true, keepPrevious: false });
      }
      if (route.checkpointCode) await viewCheckpoint(route.checkpointCode);
      refreshRuntimeHealthState();
      emit();
    } catch (error) {
      set({ ready: false, fatalError: error.message || String(error) });
      refreshRuntimeHealthState();
    }
  }

  function readProjectionForContext(context, scope, key) {
    return projectionLookupForContext(context, scope, key).payload;
  }

  function validStoredProjectionPayloads(keyPattern, scope, logicalKey) {
    const payloads = [];
    if (!window.localStorage || !FOUNDATION) return payloads;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const physicalKey = window.localStorage.key(index);
      if (typeof physicalKey !== "string" || !keyPattern.test(physicalKey)) continue;
      try {
        const envelope = JSON.parse(window.localStorage.getItem(physicalKey));
        if (!isPlainObject(envelope) || envelope.schemaVersion !== FOUNDATION.STORAGE_SCHEMA_VERSION) continue;
        const context = assertS003Context(envelope.scenarioContext);
        const adapter = FOUNDATION.createNamespacedStorage({ storage: window.localStorage, context, scope });
        if (adapter.keyFor(logicalKey) !== physicalKey) continue;
        const payload = adapter.get(logicalKey);
        assertProjectionPayload(context, scope, logicalKey, payload);
        payloads.push(payload);
      } catch (_) {
        // 版本序列只统计通过完整命名空间、envelope、payload 校验的投影。
      }
    }
    return payloads;
  }

  function highestKnownInputSnapshotSequence() {
    const snapshots = [state.factorInputSnapshot, bundle?.humanInputSnapshot];
    validStoredProjectionPayloads(INPUT_STORAGE_KEY_RE, "m02", "factor-inputs/current").forEach(function (payload) {
      snapshots.push(payload.snapshot, payload.lastPublishedSnapshot);
    });
    return snapshots.reduce(function (highest, snapshot) {
      return Math.max(highest, inputSnapshotSequence(snapshot));
    }, 0);
  }

  function highestKnownModelVersion() {
    const versions = [state.publishedModel?.packageVersion, bundle?.model?.packageVersion];
    validStoredProjectionPayloads(MODEL_STORAGE_KEY_RE, "m01", "config/current").forEach(function (payload) {
      versions.push(payload.publishedModel?.packageVersion, payload.lastPublishedModel?.packageVersion);
    });
    return versions.filter(semanticVersionParts).reduce(function (highest, version) {
      return !highest || compareSemanticVersions(version, highest) > 0 ? version : highest;
    }, null);
  }

  function nextMonotonicModelVersion(baseVersion, proposedVersion) {
    const highest = highestKnownModelVersion() || baseVersion || "1.0.0";
    if (semanticVersionParts(proposedVersion) && compareSemanticVersions(proposedVersion, highest) > 0) return proposedVersion;
    return incrementVersion(highest);
  }

  function applyFactorInputsToFixture(values, sourceFixture) {
    const factorInputs = values || state.factorInputs;
    const fixture = clone(sourceFixture || bundle.fixture);
    fixture.enterprises = fixture.enterprises.map(function (enterprise) {
      return { ...enterprise, factorInputs: clone(factorInputs[enterprise.enterpriseId] || enterprise.factorInputs || {}) };
    });
    return fixture;
  }

  async function callEngine(context, options) {
    const config = options || {};
    const engine = bundle.engine || window.S003ScoreEngine;
    if (!engine) throw new Error("M01 评分引擎尚未加载；已保留上一成功运行，当前不可重评。");
    const model = clone(hasOwn(config, "model") ? config.model : state.publishedModel);
    let inputSnapshot = clone(hasOwn(config, "inputSnapshot") ? config.inputSnapshot : state.factorInputSnapshot || bundle.humanInputSnapshot);
    const snapshotValues = factorInputsFromSnapshot(inputSnapshot);
    const factorInputs = clone(hasOwn(config, "factorInputs") ? config.factorInputs : Object.keys(snapshotValues).length ? snapshotValues : state.factorInputs);
    if (!model) throw new Error("评估请求显式缺少 Published 模型，拒绝回退其他版本。");
    if (!inputSnapshot) throw new Error("评估请求缺少独立 T053 Published 人工输入快照，拒绝从模型定义推导企业取值。");
    assertInputSnapshot(inputSnapshot);
    const fixture = applyFactorInputsToFixture(factorInputs, config.fixture);
    const formalDataAsset = clone(config.formalDataAsset || bundle.formalDataAsset);
    const payload = {
      scenarioContext: clone(context),
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      assessmentAt: fixture.assessmentAt,
      modelPackage: clone(model),
      model: clone(model),
      fixture,
      enterprises: clone(fixture.enterprises),
      factorInputs: clone(factorInputs),
      humanInputSnapshot: clone(inputSnapshot),
      context: {
        ...clone(context),
        assessmentAt: fixture.assessmentAt,
        currency: fixture.currency,
        amountUnit: fixture.amountUnit,
        dataVersion: formalDataAsset?.dataAssetId || formalDataAsset?.assetId || fixture.fixtureId,
        manualInputVersion: inputSnapshot?.snapshotId,
        publishedVersion: model.packageVersion,
        resultVersion: "1.0.0"
      }
    };

    const portfolioMethod = ["evaluatePortfolio", "evaluateScenario", "runEvaluation", "runScenario", "evaluateAll", "run"]
      .find(function (name) { return typeof engine[name] === "function"; });
    if (portfolioMethod) {
      try {
        return await engine[portfolioMethod](payload);
      } catch (firstError) {
        try {
          return await engine[portfolioMethod](fixture, model, { scenarioContext: context, factorInputs });
        } catch (_) {
          throw firstError;
        }
      }
    }
    if (typeof engine.evaluateEnterprise === "function") {
      const results = [];
      for (const enterprise of fixture.enterprises) {
        results.push(await engine.evaluateEnterprise({
          enterprise,
          modelPackage: model,
          scenarioContext: context,
          assessmentAt: fixture.assessmentAt
        }));
      }
      return { enterpriseResults: results };
    }
    throw new Error("S003ScoreEngine 未暴露可识别的组合评估方法。");
  }

  function resultArray(raw) {
    if (Array.isArray(raw)) return raw;
    const candidates = [raw?.enterpriseResults, raw?.results, raw?.evaluations, raw?.records, raw?.portfolio?.enterprises, raw?.data?.enterpriseResults];
    return candidates.find(Array.isArray) || [];
  }

  function normalizeMetricDetails(result, model) {
    const activeModel = model || projectionModel() || bundle.model;
    const source = result.indicatorDetails || result.indicatorScores || result.indicatorResults || result.metricResults || result.metrics || [];
    function normalizeMetric(item, fallbackName) {
      const rawWeight = item.weightPercent ?? item.weight ?? null;
      const weight = rawWeight == null ? null : Number(rawWeight) <= 1 ? Number(rawWeight) * 100 : Number(rawWeight);
      const weighted = item.weightedScore ?? item.weightedPoints ?? null;
      const indicator = item.indicatorScore ?? item.metricScore ?? item.score ?? (weighted != null && Number.isFinite(weight) ? Number(weighted) / (Number(weight) / 100) : weighted);
      const indicatorScore = indicator == null ? null : Number(indicator);
      const weightedScore = weighted == null
        ? (indicatorScore != null && Number.isFinite(weight) ? indicatorScore * Number(weight) / 100 : null)
        : Number(weighted);
      return {
        name: item.name || item.metricName || item.indicatorName || fallbackName || "指标",
        value: item.value ?? item.metricValue ?? item.indicatorValue ?? item.actualValue ?? null,
        actualValue: item.actualValue ?? item.value ?? item.metricValue ?? item.indicatorValue ?? null,
        grade: item.grade ?? item.level ?? item.status ?? null,
        score: Number.isFinite(indicatorScore) ? indicatorScore : null,
        indicatorScore: Number.isFinite(indicatorScore) ? indicatorScore : null,
        weightedScore: Number.isFinite(weightedScore) ? weightedScore : null,
        weight: Number.isFinite(weight) ? weight : null,
        weightPercent: Number.isFinite(weight) ? weight : null,
        formula: item.formula || item.formulaRef || item.sourceField || "",
        note: item.note || item.reason || "",
        marker: item.marker || null,
        evidencePointer: item.evidencePointer || item.evidenceRef || null
      };
    }
    if (Array.isArray(source)) {
      return source.map(function (item, index) {
        const fallback = activeModel.indicatorOrder?.[index] || `指标${index + 1}`;
        const normalized = normalizeMetric(item, fallback);
        if (normalized.weight == null) {
          const categoryWeights = activeModel.weights?.[result.category] || [];
          const fallbackWeight = Number(categoryWeights[index]);
          if (Number.isFinite(fallbackWeight)) {
            normalized.weight = fallbackWeight;
            normalized.weightPercent = fallbackWeight;
            normalized.weightedScore = normalized.indicatorScore == null ? null : normalized.indicatorScore * fallbackWeight / 100;
          }
        }
        return normalized;
      });
    }
    return Object.entries(source || {}).map(function ([name, item]) {
      const value = typeof item === "object" ? item : { score: item };
      return normalizeMetric(value, name);
    });
  }

  function normalizeFactorDetails(result, enterprise, model) {
    const source = result.factorDetails || result.factorResults || result.adjustmentFactors || [];
    if (Array.isArray(source) && source.length) {
      return source.map(function (item) {
        const name = item.name || item.factorName || item.label || "调节因子";
        return {
          name,
          value: item.value ?? item.inputValue ?? item.selectedTier ?? item.tierLabel ?? enterprise.factorInputs?.[name] ?? null,
          inputValue: item.inputValue ?? item.value ?? enterprise.factorInputs?.[name] ?? null,
          tierId: item.tierId || null,
          tierLabel: item.tierLabel || item.selectedTier || null,
          applicable: item.applicable !== false,
          coefficient: Number(item.coefficient ?? item.factorCoefficient ?? item.adjustment ?? 0),
          state: item.state || item.applicability || (DATA.isNotApplicable(enterprise, name) ? "NOT_APPLICABLE" : "EXPLICIT_VALUE"),
          note: item.note || item.reason || "",
          marker: item.marker || null,
          evidencePointer: item.evidencePointer || item.evidenceRef || null
        };
      });
    }
    return Object.keys(DATA.FACTOR_INPUT_CHOICES).map(function (name) {
      const value = enterprise.factorInputs?.[name] ?? null;
      return {
        name,
        value,
        inputValue: value,
        tierId: null,
        tierLabel: null,
        applicable: !DATA.isNotApplicable(enterprise, name),
        coefficient: null,
        state: DATA.isNotApplicable(enterprise, name) ? "NOT_APPLICABLE" : value == null || value === "" ? "DEFAULTED_ZERO" : "EXPLICIT_VALUE",
        note: "系数以 M01 评估结果为准",
        marker: null,
        evidencePointer: null
      };
    });
  }

  function normalizeResult(result, index, options) {
    const config = options || {};
    const model = config.model || projectionModel() || bundle.model;
    const factorInputs = config.factorInputs || state.factorInputs;
    const fixture = config.fixture || bundle.fixture;
    const enterpriseId = result.enterpriseId || result.enterprise?.enterpriseId || result.entityId || result.companyId || fixture.enterprises[index]?.enterpriseId;
    const sourceEnterprise = fixture.enterprises.find(function (item) { return item.enterpriseId === enterpriseId; }) || fixture.enterprises[index] || {};
    const enterprise = { ...sourceEnterprise, factorInputs: clone(factorInputs?.[enterpriseId] || sourceEnterprise.factorInputs || {}) };
    const finalScore = Number(result.finalScore ?? result.adjustedScore ?? result.riskScore ?? result.score);
    const rawScore = Number(result.rawScore ?? result.baseScore ?? result.originalScore);
    const factorSum = Number(result.factorSum ?? result.adjustmentSum ?? result.totalFactorCoefficient);
    const risk = DATA.riskKey(result.riskTierId || result.riskTier || result.riskLevel || result.level);
    const metrics = normalizeMetricDetails({ ...result, category: enterprise.category }, model);
    const factors = normalizeFactorDetails(result, enterprise, model);
    const lowestMetrics = Array.isArray(result.lowestMetrics)
      ? result.lowestMetrics
      : Array.isArray(result.lowestThree)
        ? result.lowestThree
        : Array.isArray(result.keyRisks)
        ? result.keyRisks
        : metrics.slice().sort(function (a, b) { return a.score - b.score; }).slice(0, 3);
    const enrichedLowestMetrics = lowestMetrics.map(function (item) {
      const detail = metrics.find(function (metric) { return metric.name === (item.name || item.metricName); });
      return {
        ...(detail || {}),
        ...clone(item),
        actualValue: item.actualValue ?? item.value ?? detail?.actualValue ?? detail?.value ?? null,
        score: item.score ?? item.indicatorScore ?? detail?.score ?? null,
        indicatorScore: item.indicatorScore ?? item.score ?? detail?.indicatorScore ?? detail?.score ?? null,
        weightedScore: item.weightedScore ?? detail?.weightedScore ?? null,
        weightPercent: item.weightPercent ?? item.weight ?? detail?.weightPercent ?? detail?.weight ?? null,
        formula: item.formula ?? detail?.formula ?? "",
        evidencePointer: item.evidencePointer ?? detail?.evidencePointer ?? null
      };
    });
    return {
      enterpriseId: enterprise.enterpriseId,
      enterpriseName: enterprise.name,
      sector: enterprise.sector,
      category: enterprise.category,
      assessmentAt: result.assessmentAt || fixture.assessmentAt,
      rawScore: Number.isFinite(rawScore) ? rawScore : null,
      factorSum: Number.isFinite(factorSum) ? factorSum : null,
      compositeAdjustment: Number.isFinite(Number(result.compositeAdjustment))
        ? Number(result.compositeAdjustment)
        : Number.isFinite(factorSum) ? 1 + factorSum : null,
      finalScore: Number.isFinite(finalScore) ? finalScore : null,
      riskTier: risk,
      metrics,
      factors,
      lowestMetrics: enrichedLowestMetrics,
      candidateActions: clone(result.candidateActions || result.actionCandidates || result.dispositionCandidates || []),
      defaults: clone(result.defaults || result.defaultSemantics || []),
      report: clone(result.report || result.reportData || null),
      ruleExplanations: clone(result.ruleExplanations || result.report?.ruleExplanations || []),
      evidenceReferences: clone(result.evidenceReferences || result.report?.evidenceReferences || []),
      raw: clone(result)
    };
  }

  function normalizeRun(raw, context, options) {
    const config = options || {};
    const model = hasOwn(config, "model") ? config.model : state.publishedModel;
    const inputSnapshot = hasOwn(config, "inputSnapshot") ? config.inputSnapshot : state.factorInputSnapshot;
    const factorInputs = hasOwn(config, "factorInputs") ? config.factorInputs : inputSnapshot?.values ?? state.factorInputs;
    const fixture = hasOwn(config, "fixture") ? config.fixture : bundle.fixture;
    const formalDataAsset = hasOwn(config, "formalDataAsset") ? config.formalDataAsset : bundle.formalDataAsset;
    if (!model || !inputSnapshot) throw new Error("运行归一化缺少精确模型或人工输入快照，拒绝静态回退。");
    // The score engine's C035 runtime envelope carries the scenario identity
    // triple. Canonicalize it into the full Foundation context at the state
    // boundary so persisted runs and downstream assertions remain strict.
    const normalizedRaw = clone(raw);
    if (isPlainObject(normalizedRaw?.scenarioIdentity)) {
      normalizedRaw.scenarioIdentity = {
        ...normalizedRaw.scenarioIdentity,
        formedAt: normalizedRaw.scenarioIdentity.formedAt ?? context.formedAt,
        status: normalizedRaw.scenarioIdentity.status ?? context.status
      };
    }
    const results = resultArray(raw).map(function (result, index) {
      return normalizeResult(result, index, { model, factorInputs, fixture });
    });
    if (results.length !== fixture.enterpriseCount) {
      throw new Error(`M01 评估返回 ${results.length} 家企业，预期 ${fixture.enterpriseCount} 家；拒绝切换当前成功运行。`);
    }
    return {
      runId: context.scenarioRunId,
      scenarioContext: clone(context),
      assessmentAt: raw?.assessmentAt || fixture.assessmentAt,
      evaluatedAt: raw?.evaluatedAt || raw?.formedAt || new Date().toISOString(),
      status: "succeeded",
      modelVersion: raw?.modelIdentity?.packageVersion || model?.packageVersion,
      publishedVersion: raw?.modelIdentity?.publishedVersion || model?.packageVersion,
      inputSnapshotId: inputSnapshot?.snapshotId,
      modelConfigurationFingerprint: modelConfigurationFingerprint(model),
      inputConfigurationFingerprint: inputConfigurationFingerprint(inputSnapshot),
      dataAssetId: raw?.dataIdentity?.dataVersion || formalDataAsset?.dataAssetId || formalDataAsset?.assetId,
      enterpriseResults: results,
      reportCount: results.length,
      authorityMode: context.status === "regression" ? "isolated-regression" : raw?.immutable === true ? "published-evidence" : "published-runtime",
      projectionOnly: raw?.immutable !== true,
      refreshable: raw?.immutable === true,
      raw: normalizedRaw
    };
  }

  function checkpointProjection(code, manifest) {
    const resolver = bundle?.checkpointProjection || window.S003CheckpointProjection;
    if (!resolver?.resolveCheckpointProjection) {
      return {
        code,
        exact: false,
        restoreMode: "evidence-only",
        restorable: false,
        hasPublished: false,
        runnable: false,
        issues: [{ code: "CHECKPOINT_PROJECTION_UNAVAILABLE", message: "Checkpoint 精确工件解析器未加载。" }],
        model: null,
        inputSnapshot: null,
        run: null,
        decisions: [],
        actionRequests: [],
        reportCount: 0,
        evidenceRefs: [],
        moduleVersions: {},
        data: {},
        sectionRefs: {}
      };
    }
    const projection = resolver.resolveCheckpointProjection({
      code,
      manifest,
      artifacts: bundle.checkpointArtifacts
    });
    const sourceContext = clone(projection.sourceContext);
    const factorInputs = factorInputsFromSnapshot(projection.inputSnapshot);
    const run = projection.c035Results && sourceContext
      ? normalizeRun(projection.c035Results, sourceContext, {
          model: projection.model,
          inputSnapshot: projection.inputSnapshot,
          factorInputs,
          fixture: projection.fixture,
          formalDataAsset: projection.data.formalDataAsset
        })
      : null;
    const decisions = (projection.decisionResults?.confirmations || []).map(normalizeDecisionRecord).filter(Boolean);
    return {
      ...projection,
      factorInputs,
      run,
      decisions,
      actionRequests: decisions
    };
  }

  function historicalRunFor(code, manifest) {
    return checkpointProjection(code, manifest).run;
  }

  function runtimeReportsFor(raw, context, options) {
    const config = options || {};
    const service = bundle?.reportService || window.S003ReportService;
    const fixture = clone(hasOwn(config, "fixture") ? config.fixture : bundle.fixture);
    const formalDataAsset = clone(hasOwn(config, "formalDataAsset") ? config.formalDataAsset : bundle.formalDataAsset);
    const qualityResult = clone(hasOwn(config, "qualityResult") ? config.qualityResult : bundle.qualityResult);
    if (!service?.createReportService || !raw || !Array.isArray(raw.results) || raw.results.length !== fixture.enterpriseCount) return null;
    const model = clone(hasOwn(config, "model") ? config.model : state.publishedModel);
    const inputSnapshot = clone(hasOwn(config, "inputSnapshot") ? config.inputSnapshot : state.factorInputSnapshot);
    if (!model || !inputSnapshot) return null;
    model.lifecycleStatus = "PUBLISHED";
    const pointer = clone(bundle.publishedPointer);
    pointer.scenarioIdentity = clone(context);
    pointer.activeTarget = {
      ...pointer.activeTarget,
      lifecycleStatus: "PUBLISHED",
      packageVersion: model.packageVersion,
      publishedSnapshot: model
    };
    const c035 = {
      ...clone(raw),
      status: "PUBLISHED-RESULTS",
      immutable: true,
      contractId: "C035",
      scenarioIdentity: clone(context),
      enterpriseCount: raw.results.length,
      inputIdentity: {
        dataAssetId: formalDataAsset?.dataAssetId || formalDataAsset?.assetId,
        dataAssetVersion: formalDataAsset?.dataAssetVersion || "1.0.0",
        humanInputSnapshotId: inputSnapshot?.snapshotId || bundle.humanInputSnapshot?.snapshotId,
        humanInputSnapshotVersion: inputSnapshot?.snapshotVersion || bundle.humanInputSnapshot?.snapshotVersion,
        qualityResultId: qualityResult?.qualityResultId
      },
      results: raw.results.map(function (result) {
        return { ...clone(result), immutable: true, scenarioIdentity: clone(context), modelIdentity: { ...clone(result.modelIdentity), lifecycleStatus: "PUBLISHED" } };
      })
    };
    const facts = {
      schemaVersion: "ofw.s003.published-debt-risk-facts.v1",
      status: "PUBLISHED",
      immutable: true,
      scenarioIdentity: clone(context),
      facts: (Array.isArray(raw.publishedFacts) && raw.publishedFacts.length
        ? raw.publishedFacts
        : Array.isArray(raw.publishedFacts?.facts) && raw.publishedFacts.facts.length
          ? raw.publishedFacts.facts
          : Array.isArray(bundle.publishedFacts?.facts) && bundle.publishedFacts.facts.length
            ? bundle.publishedFacts.facts
            : raw.results.map(function (result) { return result.publishedFact; }))
        .map(function (fact) {
        return { ...clone(fact), scenarioIdentity: clone(context) };
      })
    };
    const decisionResults = { scenarioIdentity: clone(context), confirmations: [] };
    const reportRuntime = service.createReportService({
      scenarioContext: context,
      prototypeVersion: "1.1.0",
      generatedAt: raw.evaluatedAt || new Date().toISOString(),
      c035Results: c035,
      publishedFacts: facts,
      publishedPointer: pointer,
      reportContract: bundle.reportContract,
      decisionResults,
      sourceEvidence: {
        c035Results: { ref: "runtime/in-memory-c035-results", sha256: null },
        publishedFacts: { ref: "runtime/in-memory-published-risk-facts", sha256: null },
        publishedPointer: { ref: "resources/m01/published-pointer.v2.json", sha256: null },
        reportContract: { ref: "resources/m06/report-contract.v2.json", sha256: null }
      }
    });
    return reportRuntime.listReports().map(function (report) {
      return {
        ...clone(report),
        artifactHtml: reportRuntime.renderHtml(report.enterprise.enterpriseId),
        artifactSha256: null,
        projectionOnly: true
      };
    });
  }

  function riskCountsForRun(run) {
    const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
    (run?.enterpriseResults || []).forEach(function (item) {
      if (counts[item.riskTier] !== undefined) counts[item.riskTier] += 1;
    });
    return counts;
  }

  function runSummaryForStorage(run) {
    if (!run) return null;
    return {
      runId: run.runId,
      scenarioContext: clone(run.scenarioContext),
      assessmentAt: run.assessmentAt,
      evaluatedAt: run.evaluatedAt,
      status: run.status,
      modelVersion: run.modelVersion,
      publishedVersion: run.publishedVersion,
      inputSnapshotId: run.inputSnapshotId,
      modelConfigurationFingerprint: run.modelConfigurationFingerprint || null,
      inputConfigurationFingerprint: run.inputConfigurationFingerprint || null,
      dataAssetId: run.dataAssetId,
      reportCount: run.reportCount,
      authorityMode: run.authorityMode,
      projectionOnly: Boolean(run.projectionOnly),
      riskCounts: riskCountsForRun(run),
      detailAvailable: false
    };
  }

  function reportBindingsForRun(run) {
    if (!run) return [];
    const existing = Array.isArray(run.reportBindings) ? run.reportBindings : [];
    if (existing.length) return clone(existing);
    const reports = Array.isArray(run.reports) ? run.reports : [];
    const byEnterprise = new Map(reports.map(function (report) {
      const enterpriseId = report?.enterprise?.enterpriseId || report?.content?.enterprise?.enterpriseId || null;
      return [enterpriseId, report];
    }).filter(function (entry) { return entry[0]; }));
    return (run.enterpriseResults || []).map(function (item) {
      const report = byEnterprise.get(item.enterpriseId) || {};
      return {
        reportId: report.reportId || report.content?.reportId || `S003-RPT-${run.runId}-${item.enterpriseId}`,
        reportVersion: report.reportVersion || report.content?.reportVersion || "runtime-preview",
        contentVersion: report.contentVersion || report.content?.contentVersion || "runtime-preview",
        artifactVersion: report.artifactVersion || report.content?.artifactVersion || "browser-work-projection",
        enterpriseId: item.enterpriseId,
        enterpriseName: item.enterpriseName,
        finalScore: item.finalScore,
        riskTier: item.riskTier,
        scenarioRunId: run.runId
      };
    });
  }

  function historyEnterpriseResult(item) {
    return {
      enterpriseId: item.enterpriseId,
      enterpriseName: item.enterpriseName,
      sector: item.sector,
      category: item.category,
      assessmentAt: item.assessmentAt,
      rawScore: item.rawScore,
      factorSum: item.factorSum,
      compositeAdjustment: item.compositeAdjustment,
      finalScore: item.finalScore,
      riskTier: item.riskTier,
      metrics: clone(item.metrics || []),
      factors: clone(item.factors || []),
      lowestMetrics: clone(item.lowestMetrics || []),
      defaults: clone(item.defaults || []),
      ruleExplanations: clone(item.ruleExplanations || []),
      evidenceReferences: clone(item.evidenceReferences || [])
    };
  }

  function historyRunForStorage(run) {
    const stored = runSummaryForStorage(run);
    if (!stored || !Array.isArray(run.enterpriseResults) || !run.enterpriseResults.length) return stored;
    stored.enterpriseResults = run.enterpriseResults.map(historyEnterpriseResult);
    stored.reportBindings = reportBindingsForRun(run);
    stored.detailAvailable = stored.enterpriseResults.length === stored.reportBindings.length;
    return stored;
  }

  function activeRunForStorage(run) {
    if (!run) return null;
    const stored = clone(run);
    delete stored.reports;
    stored.riskCounts = riskCountsForRun(run);
    stored.reportBindings = reportBindingsForRun(run);
    stored.detailAvailable = Array.isArray(stored.enterpriseResults) && stored.enterpriseResults.length === stored.reportBindings.length;
    return stored;
  }

  function ensureRuntimeReports(run, context, options) {
    if (!run || run.reports?.length || !run.raw) return run;
    const reports = runtimeReportsFor(run.raw, context, options);
    if (reports) {
      run.reports = reports;
      run.reportCount = reports.length;
    }
    return run;
  }

  async function evaluate(context, options) {
    const config = options || {};
    const runtime = config.checkpointRuntime || null;
    const operationId = config.operationId || null;
    const operationReceipt = config.operationReceipt || null;
    const evaluationModel = publishedModelWithoutEnterpriseInputs(hasOwn(config, "model") ? config.model : state.publishedModel);
    let evaluationInputSnapshot = clone(hasOwn(config, "inputSnapshot") ? config.inputSnapshot : state.factorInputSnapshot || bundle.humanInputSnapshot);
    const snapshotValues = factorInputsFromSnapshot(evaluationInputSnapshot);
    const evaluationFactorInputs = clone(hasOwn(config, "factorInputs") ? config.factorInputs : Object.keys(snapshotValues).length ? snapshotValues : state.factorInputs);
    const evaluationFixture = clone(hasOwn(config, "fixture") ? config.fixture : bundle.fixture);
    const evaluationFormalDataAsset = clone(hasOwn(config, "formalDataAsset") ? config.formalDataAsset : bundle.formalDataAsset);
    const evaluationQualityResult = clone(hasOwn(config, "qualityResult") ? config.qualityResult : bundle.qualityResult);
    set({ runStatus: "running", runError: null });
    try {
      if (!evaluationModel) throw new Error("当前运行没有精确 Published 模型，拒绝隐式回退 bundle.model。");
      if (!evaluationInputSnapshot) throw new Error("当前运行没有精确 T053 Published 人工输入快照，拒绝从模型定义推导企业取值。");
      assertInputSnapshot(evaluationInputSnapshot);
      const raw = await callEngine(context, {
        model: evaluationModel,
        inputSnapshot: evaluationInputSnapshot,
        factorInputs: evaluationFactorInputs,
        fixture: evaluationFixture,
        formalDataAsset: evaluationFormalDataAsset
      });
      const run = normalizeRun(raw, context, {
        model: evaluationModel,
        inputSnapshot: evaluationInputSnapshot,
        factorInputs: evaluationFactorInputs,
        fixture: evaluationFixture,
        formalDataAsset: evaluationFormalDataAsset
      });
      const isolated = Boolean(config.isolatedRegression) || context.status === "regression";
      run.authorityMode = isolated ? "isolated-regression" : "published-runtime";
      run.projectionOnly = true;
      run.refreshable = false;
      const runtimeReports = runtimeReportsFor(raw, context, {
        model: evaluationModel,
        inputSnapshot: evaluationInputSnapshot,
        fixture: evaluationFixture,
        formalDataAsset: evaluationFormalDataAsset,
        qualityResult: evaluationQualityResult
      });
      if (runtimeReports) {
        run.reports = runtimeReports;
        run.reportCount = runtimeReports.length;
      }
      const existing = state.runHistory.filter(function (item) { return item.runId !== run.runId; });
      const history = [run, ...existing].slice(0, 20);
      const nextDraft = createConfigDraft(evaluationModel);
      const nextFactorStatus = ["published-input", "published-model-configuration"].includes(evaluationInputSnapshot.status) ? "published" : "draft";
      const previousFormalRun = formalSuccessfulRun(state.lastSuccessfulRun) || formalSuccessfulRun(state.activeRun);
      const storedRun = activeRunForStorage(run);
      storedRun.refreshable = true;
      const operationLineage = buildOperationLineage(operationReceipt, {
        operationId,
        operationMode: config.operationMode || (isolated ? "isolated-regression" : "runtime-evaluation"),
        sourceCheckpointId: config.sourceCheckpointId || null,
        sourceScenarioRunId: config.sourceScenarioRunId || previousFormalRun?.runId || null,
        moduleRestoreReferences: config.moduleRestoreReferences,
        model: evaluationModel,
        inputSnapshot: evaluationInputSnapshot,
        run
      });
      const persistence = persistBatch([
        {
          scope: "m01",
          key: "config/current",
          payload: configProjectionPayload(nextDraft, "published", evaluationModel, evaluationInputSnapshot)
        },
        {
          scope: "m02",
          key: "factor-inputs/current",
          payload: factorProjectionPayload(nextFactorStatus, evaluationFactorInputs, evaluationInputSnapshot)
        },
        {
          scope: "m06",
          key: "runs/current",
          payload: {
            runtimeProjectionSchemaVersion: RUNTIME_PROJECTION_SCHEMA_VERSION,
            projectionComplete: true,
            context: clone(context),
            activeRun: storedRun,
            regressionRun: isolated ? historyRunForStorage(run) : null,
            lastSuccessfulRun: activeRunForStorage(previousFormalRun),
            runHistory: history.filter(function (item) { return item.runId !== run.runId; }).map(historyRunForStorage),
            runStatus: isolated ? "regression" : "succeeded",
            restoredFromCheckpoint: null,
            ...clone(operationLineage),
            modelVersion: run.modelVersion,
            inputSnapshotId: run.inputSnapshotId,
            enterpriseCount: run.enterpriseResults.length
          }
        }
      ], context, { requireEmpty: true });
      requirePersistence(persistence, "运行结果与 M01/M02/M06 配套投影未能原子持久化");
      if (runtime && operationId && !isolated) {
        try {
          runtime.completeRunAttempt({
            operationId,
            status: "succeeded",
            completedAt: new Date().toISOString(),
            evidenceRef: `runtime/cp09-entry.v1.html#${run.runId}`
          });
        } catch (checkpointError) {
          const rollback = rollbackPersistedBatch(persistence);
          const completionError = new Error(`C034 成功回执未完成，已${rollback.ok ? "回滚" : "尝试回滚"}当前运行浏览器投影：${checkpointError.message || String(checkpointError)}`);
          completionError.code = "S003_C034_COMPLETION_FAILED";
          completionError.persistenceReceipt = {
            ...clone(persistence),
            ok: false,
            atomic: rollback.atomic,
            rolledBack: rollback.ok,
            rollback,
            error: serializableError(completionError)
          };
          throw completionError;
        }
      }
      run.refreshable = true;
      set(isolated ? {
        context,
        activeRun: run,
        regressionRun: run,
        runHistory: history,
        runStatus: "succeeded",
        runError: null,
        restoredFromCheckpoint: null,
        publishedModel: evaluationModel,
        configDraft: nextDraft,
        configStatus: "published",
        configValidation: null,
        factorInputs: evaluationFactorInputs,
        factorInputSnapshot: evaluationInputSnapshot,
        factorEntryStatus: nextFactorStatus,
        factorEntryValidation: null,
        decisions: [],
        actionRequests: [],
        operationLineage,
        projectionPersistence: persistence,
        operationNotice: `隔离回归完成，形成演练运行 ${DATA.shortId(run.runId)}；上一正式成功运行保持不变。`
      } : {
        context,
        activeRun: run,
        lastSuccessfulRun: previousFormalRun,
        regressionRun: null,
        runHistory: history,
        runStatus: "succeeded",
        runError: null,
        restoredFromCheckpoint: null,
        publishedModel: evaluationModel,
        configDraft: nextDraft,
        configStatus: "published",
        configValidation: null,
        factorInputs: evaluationFactorInputs,
        factorInputSnapshot: evaluationInputSnapshot,
        factorEntryStatus: nextFactorStatus,
        factorEntryValidation: null,
        decisions: [],
        actionRequests: [],
        operationLineage,
        projectionPersistence: persistence,
        operationNotice: config.initial
          ? "已形成当前运行工作投影。"
          : `重评完成，形成可刷新运行投影 ${DATA.shortId(run.runId)}；未提升为 M03/M04 可消费的正式 Published 事实。`
      });
      return run;
    } catch (error) {
      let failureMessage = error.message || String(error);
      if (runtime && operationId && !config.isolatedRegression) {
        try {
          runtime.completeRunAttempt({
            operationId,
            status: "failed",
            completedAt: new Date().toISOString(),
            errorCode: "S003_RUNTIME_EVALUATION_FAILED"
          });
        } catch (checkpointError) {
          failureMessage = `${failureMessage}；C034 失败回执登记异常：${checkpointError.message || String(checkpointError)}`;
        }
      }
      const previous = formalSuccessfulRun(state.lastSuccessfulRun) || formalSuccessfulRun(state.activeRun);
      set({
        activeRun: previous,
        regressionRun: null,
        context: previous?.scenarioContext ? Object.freeze(clone(previous.scenarioContext)) : state.context,
        runStatus: "failed",
        runError: failureMessage,
        projectionPersistence: error.persistenceReceipt || state.projectionPersistence,
        operationNotice: previous ? "本次重评未切换成功运行，工作台继续展示上一成功运行。" : "尚无可展示的成功运行。"
      });
      return null;
    }
  }

  function setView(view, enterpriseId, moduleId, anchor) {
    const next = view === "report" || DATA.VIEWS.some(function (item) { return item.id === view; }) ? view : "platform-home";
    const requestedModule = DATA.MODULES.some(function (item) { return item.id === moduleId; }) ? moduleId : moduleForView(next);
    const requestedAnchor = ["m03-query", "m04-decision", "m04-todos"].includes(anchor) ? anchor : null;
    set({ currentView: next, activeModuleId: requestedModule, currentAnchor: requestedAnchor, selectedEnterpriseId: enterpriseId || state.selectedEnterpriseId, mobileNavOpen: false });
  }

  function selectEnterprise(enterpriseId) {
    set({ selectedEnterpriseId: enterpriseId });
  }

  function setFilter(name, value) {
    if (!Object.prototype.hasOwnProperty.call(state, name)) return;
    set({ [name]: value });
  }

  function markFactorDraft(values) {
    const nextValues = completeEnterpriseFactorInputs(values || state.factorInputs);
    const persistence = persist(
      "m02",
      "factor-inputs/current",
      factorProjectionPayload("draft", nextValues, state.factorInputSnapshot)
    );
    requirePersistence(persistence, "企业因子 T053 工作投影未能持久化");
    set({
      factorInputs: nextValues,
      factorEntryStatus: "draft",
      factorEntryValidation: null,
      projectionPersistence: persistence
    });
    return persistence;
  }

  function updateFactorInput(enterpriseId, factorName, value) {
    if (state.historicalView) return false;
    const next = clone(state.factorInputs);
    next[enterpriseId] = { ...(next[enterpriseId] || {}), [factorName]: value === "__MISSING__" ? null : value };
    markFactorDraft(next);
    return true;
  }

  function replaceFactorInputs(values) {
    if (state.historicalView) throw new Error("历史快照只读，不能修改企业因子输入。");
    if (!isPlainObject(values)) throw new Error("企业因子输入必须是按企业标识组织的对象。");
    const expectedIds = new Set(expectedEnterpriseIds());
    const allowedFactors = new Set(Object.keys(DATA.FACTOR_INPUT_CHOICES));
    const unknownEnterpriseIds = Object.keys(values).filter(function (enterpriseId) { return !expectedIds.has(enterpriseId); });
    if (unknownEnterpriseIds.length) throw new Error(`企业因子输入包含未知企业：${unknownEnterpriseIds.join("、")}`);
    const next = {};
    bundle.fixture.enterprises.forEach(function (enterprise) {
      const incoming = isPlainObject(values[enterprise.enterpriseId]) ? values[enterprise.enterpriseId] : {};
      const unknownFactors = Object.keys(incoming).filter(function (factorName) { return !allowedFactors.has(factorName); });
      if (unknownFactors.length) throw new Error(`${enterprise.name} 包含未知调节因子：${unknownFactors.join("、")}`);
      next[enterprise.enterpriseId] = {};
      allowedFactors.forEach(function (factorName) {
        const incomingValue = hasOwn(incoming, factorName) ? incoming[factorName] : state.factorInputs?.[enterprise.enterpriseId]?.[factorName];
        next[enterprise.enterpriseId][factorName] = incomingValue === "__MISSING__" ? null : incomingValue ?? null;
      });
    });
    markFactorDraft(next);
    return clone(next);
  }

  function validateFactorInputValues(values) {
    const factorValues = values || {};
    const errors = [];
    bundle.fixture.enterprises.forEach(function (enterprise) {
      Object.entries(DATA.FACTOR_INPUT_CHOICES).forEach(function ([factorName, choices]) {
        const value = factorValues[enterprise.enterpriseId]?.[factorName];
        if (DATA.isNotApplicable(enterprise, factorName)) return;
        if (value == null || value === "") return;
        if (!choices.includes(value)) errors.push(`${enterprise.name} · ${factorName} 的取值“${value}”不在允许枚举内`);
      });
    });
    const result = {
      ok: errors.length === 0,
      errors,
      defaultedZeroCount: bundle.fixture.enterprises.reduce(function (count, enterprise) {
        return count + Object.keys(DATA.FACTOR_INPUT_CHOICES).filter(function (factorName) {
          const value = factorValues[enterprise.enterpriseId]?.[factorName];
          return !DATA.isNotApplicable(enterprise, factorName) && (value == null || value === "");
        }).length;
      }, 0),
      notApplicableCount: bundle.fixture.enterprises.reduce(function (count, enterprise) {
        return count + Object.keys(DATA.FACTOR_INPUT_CHOICES).filter(function (factorName) {
          return DATA.isNotApplicable(enterprise, factorName);
        }).length;
      }, 0),
      validatedAt: new Date().toISOString()
    };
    return result;
  }

  function validateFactorInputs() {
    const result = validateFactorInputValues(state.factorInputs);
    set({ factorEntryValidation: result, factorEntryStatus: result.ok ? "validated" : "draft" });
    return result;
  }

  function nextSnapshotVersion() {
    return highestKnownInputSnapshotSequence() + 1;
  }

  function publishFactorInputs() {
    if (state.historicalView) throw new Error("历史快照只读，不能发布企业因子输入快照。");
    const validation = state.factorEntryValidation?.ok ? state.factorEntryValidation : validateFactorInputs();
    if (!validation.ok) throw new Error("企业因子校验未通过，不能发布 T053 输入快照。");
    const sequence = nextSnapshotVersion();
    const formedAt = new Date().toISOString();
    const assessmentToken = String(bundle.fixture.assessmentAt || "2025-12-31").replaceAll("-", "");
    const snapshot = {
      schemaVersion: "ofw.s003.t053.human-input-snapshot.v1",
      snapshotId: `S003-T053-INPUT-${assessmentToken}-v${sequence}`,
      snapshotVersion: `1.0.${Math.max(0, sequence - 1)}`,
      status: "published-input",
      immutable: true,
      formedAt,
      owner: "M02 数据工程",
      businessOwner: "财务公司",
      reviewerRequired: false,
      assessmentAt: bundle.fixture.assessmentAt,
      enterpriseCount: bundle.fixture.enterpriseCount,
      factorCount: Object.keys(DATA.FACTOR_INPUT_CHOICES).length,
      records: bundle.fixture.enterprises.map(function (enterprise) {
        return {
          enterpriseId: enterprise.enterpriseId,
          enterpriseName: enterprise.name,
          category: enterprise.category,
          assessmentAt: bundle.fixture.assessmentAt,
          values: Object.keys(DATA.FACTOR_INPUT_CHOICES).map(function (factorName) {
            const notApplicable = DATA.isNotApplicable(enterprise, factorName);
            const value = state.factorInputs?.[enterprise.enterpriseId]?.[factorName] ?? null;
            const stateCode = notApplicable ? "NOT_APPLICABLE" : value == null || value === "" ? "DEFAULTED_ZERO" : "EXPLICIT_VALUE";
            return {
              factorName,
              sourceValue: stateCode === "EXPLICIT_VALUE" ? value : null,
              normalizedValue: stateCode === "EXPLICIT_VALUE" ? value : null,
              state: stateCode
            };
          })
        };
      })
    };
    const persistence = persist("m02", "factor-inputs/current", factorProjectionPayload("published", state.factorInputs, snapshot));
    requirePersistence(persistence, "T053 Published 人工输入快照未能持久化");
    set({ factorInputSnapshot: snapshot, factorEntryStatus: "published", factorEntryValidation: validation, projectionPersistence: persistence });
    return clone(snapshot);
  }

  function markConfigDraft(value) {
    const draft = clone(value || state.configDraft);
    draft.changedAt = new Date().toISOString();
    draft.lifecycleStatus = "draft";
    draft.basedOnPackageId = state.publishedModel.packageId;
    draft.basedOnVersion = state.publishedModel.packageVersion;
    draft.proposedVersion = nextMonotonicModelVersion(state.publishedModel.packageVersion, draft.proposedVersion);
    const persistence = persist(
      "m01",
      "config/current",
      configProjectionPayload(draft, "draft", state.publishedModel)
    );
    requirePersistence(persistence, "模型配置 Draft 未能持久化");
    set({ configDraft: draft, configStatus: "draft", configValidation: null, projectionPersistence: persistence });
    return persistence;
  }

  function updateWeight(category, index, value) {
    if (state.historicalView) return;
    const draft = clone(state.configDraft);
    draft.weights[category][Number(index)] = Number(value);
    markConfigDraft(draft);
  }

  function updateFactorCoefficient(factorId, tierId, value) {
    if (state.historicalView) return;
    const draft = clone(state.configDraft);
    const factor = draft.factors.find(function (item) { return item.factorId === factorId; });
    const tier = factor?.tiers?.find(function (item) { return item.tierId === tierId; });
    if (!tier) return;
    tier.coefficient = Number(value);
    markConfigDraft(draft);
  }

  function updateRiskThreshold(tierId, value) {
    if (state.historicalView) return;
    const draft = clone(state.configDraft);
    const tier = draft.riskTiers.find(function (item) { return item.tierId === tierId; });
    if (!tier || tierId === "BLACK") return;
    tier.minInclusive = Number(value);
    const byId = Object.fromEntries(draft.riskTiers.map(function (item) { return [item.tierId, item]; }));
    if (byId.GREEN) byId.GREEN.maxExclusive = null;
    if (byId.YELLOW && byId.GREEN) byId.YELLOW.maxExclusive = Number(byId.GREEN.minInclusive);
    if (byId.RED && byId.YELLOW) byId.RED.maxExclusive = Number(byId.YELLOW.minInclusive);
    if (byId.BLACK && byId.RED) {
      byId.BLACK.minInclusive = 0;
      byId.BLACK.maxExclusive = Number(byId.RED.minInclusive);
    }
    markConfigDraft(draft);
  }

  function replaceConfigurationDraft(value) {
    if (state.historicalView) throw new Error("历史快照只读，不能修改模型配置。");
    if (!isPlainObject(value)) throw new Error("模型配置 Draft 必须是对象。");
    const draft = clone(state.configDraft);
    if (isPlainObject(value.weights)) draft.weights = clone(value.weights);
    if (Array.isArray(value.factors)) draft.factors = clone(value.factors);
    if (Array.isArray(value.riskTiers)) draft.riskTiers = clone(value.riskTiers);
    if (value.proposedVersion) draft.proposedVersion = String(value.proposedVersion);
    markConfigDraft(draft);
    return clone(state.configDraft);
  }

  function validateConfiguration() {
    const service = bundle?.configService || window.S003ConfigService;
    if (service?.markValidated) {
      const outcome = service.markValidated(canonicalConfigDraft(state.configDraft));
      const serviceErrors = outcome.validation.errors.map(function (error) { return `${error.message}（${error.code}）`; });
      const result = {
        ok: outcome.validation.ok,
        errors: serviceErrors,
        details: clone(outcome.validation.errors),
        validatedAt: new Date().toISOString()
      };
      const nextDraft = {
        ...state.configDraft,
        lifecycleStatus: outcome.draft.lifecycleStatus,
        validatedAt: outcome.draft.validatedAt || null
      };
      set({ configDraft: nextDraft, configValidation: result, configStatus: result.ok ? "validated" : "draft" });
      return result;
    }
    const errors = [];
    Object.entries(state.configDraft.weights).forEach(function ([category, weights]) {
      if (weights.some(function (value) { return !Number.isFinite(Number(value)) || Number(value) < 0; })) errors.push(`${category} 权重必须为非负数`);
      const total = weights.reduce(function (sum, value) { return sum + Number(value || 0); }, 0);
      if (Math.abs(total - 100) > 0.0001) errors.push(`${category} 权重合计为 ${total}，必须等于 100`);
    });
    if (state.configDraft.factors.length !== 6) errors.push("一期固定六项调节因子，不允许新增或删除");
    state.configDraft.factors.forEach(function (factor) {
      factor.tiers.forEach(function (tier) {
        if (!Number.isFinite(Number(tier.coefficient)) || Number(tier.coefficient) < -1 || Number(tier.coefficient) > 1) {
          errors.push(`${factor.name} · ${tier.label} 的系数必须在 -1 至 1 之间`);
        }
      });
    });
    const fixed = ["GREEN", "YELLOW", "RED", "BLACK"];
    if (state.configDraft.riskTiers.length !== 4 || state.configDraft.riskTiers.some(function (tier, index) { return tier.tierId !== fixed[index]; })) {
      errors.push("一期固定绿、黄、红、黑四档及顺序，不允许新增、删除或改名");
    }
    const thresholds = Object.fromEntries(state.configDraft.riskTiers.map(function (tier) { return [tier.tierId, Number(tier.minInclusive)]; }));
    if (!(thresholds.GREEN > thresholds.YELLOW && thresholds.YELLOW > thresholds.RED && thresholds.RED > thresholds.BLACK && thresholds.BLACK === 0)) {
      errors.push("风险阈值必须满足：绿灯 > 黄灯 > 红灯 > 黑灯，且黑灯下限固定为 0");
    }
    const result = { ok: errors.length === 0, errors, validatedAt: new Date().toISOString() };
    set({ configValidation: result, configStatus: result.ok ? "validated" : "draft" });
    return result;
  }

  function incrementVersion(version) {
    const parts = String(version || "1.0.0").split(".").map(Number);
    return `${parts[0] || 1}.${parts[1] || 0}.${(parts[2] || 0) + 1}`;
  }

  function publishConfiguration() {
    if (state.historicalView) throw new Error("历史快照只读，不能发布模型配置。");
    const validation = state.configValidation?.ok ? state.configValidation : validateConfiguration();
    if (!validation.ok) throw new Error("配置校验未通过，不能切换 Published 指针。");
    const service = bundle?.configService || window.S003ConfigService;
    const publishedAt = new Date().toISOString();
    const canonicalDraft = canonicalConfigDraft(state.configDraft);
    const published = service?.publishDraft
      ? clone(service.publishDraft({ ...canonicalDraft, lifecycleStatus: "validated", validatedAt: state.configDraft.validatedAt || publishedAt }, state.publishedModel, { publishedAt }))
      : {
          ...clone(state.publishedModel),
          packageVersion: canonicalDraft.proposedVersion,
          lifecycleStatus: "published",
          weights: clone(state.configDraft.weights),
          factors: clone(state.configDraft.factors),
          riskTiers: clone(state.configDraft.riskTiers)
        };
    if (compareSemanticVersions(published.packageVersion, state.publishedModel.packageVersion) <= 0) {
      throw new Error("新 Published 模型版本必须严格大于上一 Published 版本。");
    }
    published.publishedAt = publishedAt;
    published.businessOwner = "财务公司";
    published.moduleOwner = "本体管理";
    delete published.enterpriseFactorInputs;
    const draft = createConfigDraft(published);
    const persistence = persist("m01", "config/current", configProjectionPayload(draft, "published", published));
    requirePersistence(persistence, "Published 模型与权威指针投影未能持久化");
    set({
      publishedModel: published,
      configDraft: draft,
      configStatus: "published",
      configValidation: validation,
      projectionPersistence: persistence
    });
    return published;
  }

  function resetConfiguration() {
    if (state.historicalView) return;
    const draft = createConfigDraft(state.publishedModel);
    const persistence = persist("m01", "config/current", configProjectionPayload(draft, "published", state.publishedModel));
    requirePersistence(persistence, "模型配置重置投影未能持久化");
    set({ configDraft: draft, configStatus: "published", configValidation: null, projectionPersistence: persistence });
  }

  async function quickRerun() {
    if (state.historicalView) throw new Error("历史快照只读，不能重评。");
    if (state.context.status === "regression") throw new Error("隔离回归必须从快照页重新创建新的回归运行，不能转为正式快速重评。");
    if (state.configStatus !== "published") throw new Error("配置仍为 Draft 或仅已校验；必须先发布模型版本再重评。");
    const runtime = requireCheckpointRuntime();
    const sourceRunId = runtime.getLastSuccessfulRun()?.scenarioContext?.scenarioRunId
      || formalSuccessfulRun(state.lastSuccessfulRun)?.runId
      || formalSuccessfulRun(state.activeRun)?.runId;
    if (!sourceRunId) throw new Error("没有可供快速重评保留的上一成功运行。");
    const operationId = nextOperationId();
    const receipt = runtime.beginRerun({ operationId, sourceScenarioRunId: sourceRunId });
    return evaluate(receipt.context, {
      initial: false,
      keepPrevious: true,
      checkpointRuntime: runtime,
      operationId,
      operationReceipt: receipt,
      operationMode: "rerun",
      sourceScenarioRunId: sourceRunId
    });
  }

  function runQuery(queryId) {
    const query = bundle.queryCatalog.queries.find(function (item) { return item.queryId === queryId; });
    if (!query) return null;
    const run = projectionRun();
    const context = state.historicalView ? run?.scenarioContext : projectionContext();
    const records = run?.enterpriseResults || [];
    let answer;
    if (!records.length) {
      answer = { type: "empty", title: "尚无 Published 风险事实", body: "问数不会自行重算风险分。请先完成模型发布与成功运行。" };
    } else if (!canConsumePublishedEvidence(run)) {
      answer = {
        type: "empty",
        title: "M03 正式 Published 消费已阻断",
        body: publishedConsumptionBlockMessage("M03 智能问数", run),
        blocked: true,
        authorityMode: run?.authorityMode || null,
        projectionOnly: Boolean(run?.projectionOnly)
      };
    } else {
      const service = bundle.queryService || window.S003QueryService;
      if (service?.createQueryService && run?.raw) {
        const runtime = service.createQueryService({
          scenarioContext: clone(context),
          portfolio: run.raw,
          c035Results: run.raw,
          publishedFacts: bundle.publishedFacts,
          publicationStatus: "PUBLISHED"
        });
        const definition = service.QUERY_DEFINITIONS.find(function (item) { return item.queryId === queryId; });
        const parameters = definition?.requiresEnterpriseId ? { enterpriseId: state.selectedEnterpriseId || records[0]?.enterpriseId } : {};
        const output = runtime.execute(queryId, parameters);
        answer = { type: output.result.type, title: output.question, result: clone(output.result), source: clone(output.source), readOnly: true };
      } else if (queryId === "S003-QRY-001") {
        const counts = { GREEN: 0, YELLOW: 0, RED: 0, BLACK: 0 };
        records.forEach(function (item) { if (counts[item.riskTier] !== undefined) counts[item.riskTier] += 1; });
        answer = { type: "risk-tier-distribution", title: query.question, result: { counts } };
      } else if (queryId === "S003-QRY-002") {
        answer = { type: "enterprise-list", title: query.question, result: { enterprises: records.filter(function (item) { return ["RED", "BLACK"].includes(item.riskTier); }) } };
      } else {
        answer = { type: "empty", title: "M03 查询服务不可用", body: "工作台不会回退为自行重算业务结论。" };
      }
    }
    set({ queryId, queryAnswer: answer });
    return answer;
  }

  function createDecisionRuntime() {
    const service = bundle?.decisionService || window.S003DecisionService;
    const run = projectionRun();
    if (!canConsumePublishedEvidence(run)) return null;
    const context = state.historicalView ? run?.scenarioContext : projectionContext();
    if (!service?.createDecisionService || !run?.raw || !context) return null;
    const sameRunRecords = projectionActionRequests().filter(function (item) {
      return item.scenarioRunId === context.scenarioRunId;
    }).map(function (item) {
      return item.actionRequest ? item : { actionRequest: item, todo: item.todo || null };
    });
    const mode = state.historicalView ? "historical-readonly" : context.status === "regression" ? "regression" : context.status;
    return service.createDecisionService({
      scenarioContext: clone(context),
      c035Results: clone(run.raw),
      enterpriseContactRouting: clone(bundle.enterpriseContactRouting),
      publicationStatus: "PUBLISHED",
      existingRecords: sameRunRecords,
      mode
    });
  }

  function listDecisionCandidates() {
    const runtime = createDecisionRuntime();
    return runtime ? clone(runtime.listCandidates()) : [];
  }

  function candidateFor(enterpriseId) {
    const candidates = listDecisionCandidates().filter(function (candidate) { return candidate.enterpriseId === enterpriseId; });
    if (!candidates.length) return null;
    const context = projectionContext();
    const confirmed = projectionActionRequests().find(function (item) {
      return item.scenarioRunId === context?.scenarioRunId && item.enterpriseId === enterpriseId;
    });
    return candidates.find(function (candidate) { return candidate.actionTypeId === confirmed?.actionTypeId; })
      || candidates.find(function (candidate) { return candidate.trigger?.type === "RISK_TIER"; })
      || candidates[0];
  }

  function decisionRecordForCandidate(candidate) {
    if (!candidate) return null;
    const context = projectionContext();
    return projectionActionRequests().find(function (item) {
      return item.scenarioRunId === context?.scenarioRunId
        && (item.idempotencyKey === candidate.idempotencyKey
          || item.actionRequest?.candidateId === candidate.candidateId
          || (item.enterpriseId === candidate.enterpriseId && item.actionTypeId === candidate.actionTypeId));
    }) || null;
  }

  function routeForEnterprise(enterpriseId) {
    const route = (bundle?.enterpriseContactRouting?.routes || []).find(function (item) {
      return item.enterpriseId === enterpriseId;
    });
    return route ? clone(route) : null;
  }

  function openDecision(reference) {
    const run = projectionRun();
    if (!canConsumePublishedEvidence(run)) {
      throw new Error(publishedConsumptionBlockMessage("M04 处置候选", run));
    }
    const candidates = listDecisionCandidates();
    const candidate = candidates.find(function (item) { return item.candidateId === reference || item.idempotencyKey === reference; })
      || candidateFor(reference);
    if (!candidate) throw new Error("该企业当前未命中处置候选，不创建 Action Request。");
    const record = decisionRecordForCandidate(candidate);
    const route = routeForEnterprise(candidate.enterpriseId);
    const pending = {
      ...candidate,
      decisionStage: record?.todo ? "confirmed" : record ? "submitted" : "candidate",
      actionRequest: clone(record?.actionRequest || null),
      todo: clone(record?.todo || null),
      decisionRecipient: clone(record?.actionRequest?.decisionRecipient || route?.decisionRecipient || null),
      memberUnitId: route?.memberUnitId || null,
      memberUnitName: route?.memberUnitName || route?.enterpriseName || candidate.enterpriseName
    };
    set({ pendingDecision: pending });
    return pending;
  }

  function openSubmittedActionRequest(reference) {
    const run = projectionRun();
    if (!canConsumePublishedEvidence(run)) {
      throw new Error(publishedConsumptionBlockMessage("M04 成员单位接口人确认", run));
    }
    const token = String(reference || "").trim();
    const record = projectionActionRequests().find(function (item) {
      const request = item.actionRequest || item;
      return request.actionRequestId === token
        || request.requestId === token
        || request.id === token
        || request.candidateId === token
        || request.sourceCandidateId === token
        || item.idempotencyKey === token
        || item.enterpriseId === token;
    });
    if (!record) throw new Error("未找到待成员单位接口人确认的行动申请。");
    if (record.todo) throw new Error("该行动申请已确认并形成负责人待办，无需重复分办。");
    const candidates = listDecisionCandidates();
    const request = record.actionRequest || record;
    const candidate = candidates.find(function (item) {
      return item.candidateId === request.candidateId
        || item.candidateId === request.sourceCandidateId
        || item.idempotencyKey === record.idempotencyKey
        || (item.enterpriseId === record.enterpriseId && item.actionTypeId === record.actionTypeId);
    });
    if (!candidate) throw new Error("行动申请无法关联当前 Published 亮灯预警候选，已拒绝确认分办。");
    const route = routeForEnterprise(candidate.enterpriseId);
    const pending = {
      ...candidate,
      decisionStage: "submitted",
      actionRequestStage: "submitted",
      isSubmittedActionRequest: true,
      actionRequest: clone(request),
      todo: null,
      decisionRecipient: clone(request.decisionRecipient || route?.decisionRecipient || null),
      memberUnitId: route?.memberUnitId || request.routingTarget?.organizationId || null,
      memberUnitName: route?.memberUnitName || request.routingTarget?.organizationName || candidate.enterpriseName
    };
    set({ pendingDecision: pending });
    return pending;
  }

  function closeDecision() {
    set({ pendingDecision: null });
  }

  function assertDecisionWriteAllowed(label) {
    if (state.historicalView) throw new Error("历史快照或隔离查看不得重放 Action Request。");
    if (state.context?.status === "regression") throw new Error("隔离回归为演练模式，不得创建 Action Request、通知或负责人待办。");
    if (["restored", "historical-readonly", "closed"].includes(state.context?.status)) throw new Error("恢复、历史或已关闭运行不得创建 Action Request、通知或负责人待办。");
    const run = projectionRun();
    if (!canConsumePublishedEvidence(run)) {
      throw new Error(publishedConsumptionBlockMessage(label || "M04 Action Request", run));
    }
    return run;
  }

  function persistDecisionReceipt(receipt, message, options) {
    const item = normalizeDecisionRecord(receipt);
    if (!item) throw new Error("M04 返回了不可识别的 Action Request 回执，已拒绝写入当前投影。");
    const actionRequests = [item, ...(state.actionRequests || state.decisions).filter(function (record) {
      return record.idempotencyKey !== item.idempotencyKey;
    })];
    const decisions = confirmedDecisionRecords(actionRequests);
    const persistence = persist("m04", "action-requests/current", { items: actionRequests });
    requirePersistence(persistence, message);
    const keepOpen = options?.keepOpen === true;
    set({
      decisions,
      actionRequests,
      pendingDecision: keepOpen ? {
        ...state.pendingDecision,
        decisionStage: item.todo ? "confirmed" : "submitted",
        actionRequest: clone(item.actionRequest),
        todo: clone(item.todo),
        decisionRecipient: clone(item.actionRequest?.decisionRecipient || state.pendingDecision?.decisionRecipient || null)
      } : null,
      projectionPersistence: persistence
    });
    return item;
  }

  function submitDecision(input) {
    assertDecisionWriteAllowed("M04 C011 行动申请");
    const candidate = state.pendingDecision;
    if (!candidate) throw new Error("没有待提交的亮灯预警行动。");
    if (candidate.decisionStage === "confirmed") throw new Error("该行动申请已由成员单位接口人确认并形成负责人待办。");
    const runtime = createDecisionRuntime();
    if (!runtime?.submitActionRequest) throw new Error("M04 两阶段行动服务不可用，拒绝提交 C011。");
    const receipt = runtime.submitActionRequest(candidate.candidateId, {
      submittedBy: input?.submittedBy || "集团债务风险管理人员",
      submittedById: input?.submittedById || null,
      note: input?.note || "",
      submittedAt: new Date().toISOString()
    });
    return persistDecisionReceipt(receipt, "C011 行动申请投影未能持久化", {keepOpen: Boolean(input?.keepOpen)});
  }

  function confirmMemberUnitDecision(input) {
    assertDecisionWriteAllowed("M04 成员单位接口人确认");
    const candidate = state.pendingDecision;
    if (!candidate) throw new Error("没有待成员单位接口人确认的行动申请。");
    if (!candidate.actionRequest && candidate.decisionStage !== "submitted") {
      throw new Error("请先由驾驶舱提交 C011 行动申请，再由成员单位接口人确认分办。");
    }
    if (!input?.confirmed) throw new Error("请先确认已核对企业、亮灯预警、Action Type 与负责人。");
    if (!String(input.owner || "").trim()) throw new Error("请选择负责人后再确认分办。");
    const runtime = createDecisionRuntime();
    if (!runtime?.confirmMemberUnitActionRequest) throw new Error("M04 两阶段行动服务不可用，拒绝形成负责人待办。");
    const recipient = candidate.actionRequest?.decisionRecipient || candidate.decisionRecipient || {};
    const receipt = runtime.confirmMemberUnitActionRequest(candidate.candidateId, {
      confirmed: true,
      recipientId: input.recipientId || recipient.recipientId,
      recipientName: input.recipientName || recipient.recipientName,
      confirmedBy: input.confirmedBy || recipient.recipientName,
      confirmedById: input.confirmedById || recipient.recipientId,
      owner: String(input.owner).trim(),
      ownerId: input.ownerId || null,
      note: input.note || "",
      confirmedAt: new Date().toISOString()
    });
    return persistDecisionReceipt(receipt, "成员单位确认与负责人待办投影未能持久化");
  }

  // 保留旧调用名作为兼容入口，但当前 v2 Published 流程只能在已提交 C011 后
  // 执行成员单位接口人确认，绝不再从候选直接同时创建 Action Request 和待办。
  function confirmDecision(input) {
    const runtime = createDecisionRuntime();
    if (runtime?.sourceMeta?.currentFlow) return confirmMemberUnitDecision(input);
    assertDecisionWriteAllowed("M04 Action Request");
    const candidate = state.pendingDecision;
    if (!candidate) throw new Error("没有待确认的处置候选。");
    if (!input?.confirmed) throw new Error("请先确认已核对企业、风险等级、Action Type 与负责人。");
    if (!runtime?.confirmCandidate) throw new Error("M04 通用决策服务不可用，拒绝创建 Action Request。");
    const receipt = runtime.confirmCandidate(candidate.candidateId, {
      confirmed: true,
      owner: input.owner || "集团债务风险负责人",
      note: input.note || "",
      confirmedAt: new Date().toISOString()
    });
    return persistDecisionReceipt(receipt, "Action Request 与负责人待办投影未能持久化");
  }

  function viewCheckpoint(code) {
    if (typeof bundle?.ensureCheckpointArtifacts === "function") {
      return bundle.ensureCheckpointArtifacts(code).then(function () { return viewCheckpointReady(code); });
    }
    return viewCheckpointReady(code);
  }

  function viewCheckpointReady(code) {
    const entry = bundle.checkpoints.find(function (item) { return item.code === code; });
    if (!entry?.manifest) throw new Error(`${code} 尚未形成正式不可变快照。`);
    const view = requireCheckpointRuntime().viewHistorical({ checkpointId: entry.manifest.checkpointId, operationId: nextOperationId() });
    const projection = checkpointProjection(code, entry.manifest);
    const notice = projection.exact
      ? `${code} 已按清单锁定工件与原 scenarioRunId 只读打开。`
      : `${code} 已进入证据只读视图；${projection.issues[0]?.message || "锁定工件不完整"}，恢复与回归已禁用。`;
    set({ historicalView: { ...view, checkpoint: entry.manifest, code, projection }, operationNotice: notice });
    return view;
  }

  function exitHistoricalView() {
    set({ historicalView: null, operationNotice: "已返回当前运行投影。" });
  }

  function cloneRestore(code) {
    if (typeof bundle?.ensureCheckpointArtifacts === "function") {
      return bundle.ensureCheckpointArtifacts(code).then(function () { return cloneRestoreReady(code); });
    }
    return cloneRestoreReady(code);
  }

  function cloneRestoreReady(code) {
    const entry = bundle.checkpoints.find(function (item) { return item.code === code; });
    if (!entry?.manifest) throw new Error(`${code} 尚未形成正式不可变快照。`);
    const projection = checkpointProjection(code, entry.manifest);
    if (!projection.restorable) {
      throw new Error(`${code} 锁定工件未通过精确哈希校验，仅可查看证据；${projection.issues[0]?.message || "禁止恢复"}`);
    }
    const operation = requireCheckpointRuntime().cloneRestore({ checkpointId: entry.manifest.checkpointId, operationId: nextOperationId() });
    const restoredModel = publishedModelWithoutEnterpriseInputs(projection.model);
    const restoredInputSnapshot = clone(projection.inputSnapshot);
    const restoredFactorInputs = clone(projection.factorInputs || {});
    // CP01 intentionally has no input snapshot yet. Keep that empty-input
    // meaning while giving the disposable M02 draft projection the complete
    // enterprise key set required by the projection contract.
    if (restoredInputSnapshot === null) {
      (bundle.fixture?.enterprises || []).forEach(function (enterprise) {
        if (!hasOwn(restoredFactorInputs, enterprise.enterpriseId)) restoredFactorInputs[enterprise.enterpriseId] = {};
      });
    }
    const previousSuccessfulRun = formalSuccessfulRun(state.lastSuccessfulRun) || formalSuccessfulRun(state.activeRun);
    const restoredDraft = createConfigDraft(restoredModel);
    const restoredConfigStatus = projection.hasPublished ? "published" : "draft";
    const restoredFactorStatus = restoredInputSnapshot?.status === "published-input" ? "published" : "draft";
    const restoredHistory = previousSuccessfulRun
      ? [previousSuccessfulRun, ...state.runHistory.filter(function (item) { return item.runId !== previousSuccessfulRun.runId; })].slice(0, 20)
      : [];
    const operationLineage = buildOperationLineage(operation, {
      operationMode: "clone-restore",
      sourceCheckpointId: entry.manifest.checkpointId,
      sourceScenarioRunId: entry.manifest.scenarioContext?.scenarioRunId || null,
      moduleRestoreReferences: operation.moduleRestoreRefs || entry.manifest.modules,
      model: restoredModel,
      inputSnapshot: restoredInputSnapshot,
      run: previousSuccessfulRun
    });
    const persistence = persistBatch([
      {
        scope: "m01",
        key: "config/current",
        payload: configProjectionPayload(restoredDraft, restoredConfigStatus, restoredModel, restoredInputSnapshot)
      },
      {
        scope: "m02",
        key: "factor-inputs/current",
        payload: factorProjectionPayload(restoredFactorStatus, restoredFactorInputs, restoredInputSnapshot)
      },
      {
        scope: "m06",
        key: "runs/current",
        payload: {
          runtimeProjectionSchemaVersion: RUNTIME_PROJECTION_SCHEMA_VERSION,
          projectionComplete: true,
          context: clone(operation.context),
          activeRun: null,
          regressionRun: null,
          lastSuccessfulRun: activeRunForStorage(previousSuccessfulRun),
          runHistory: restoredHistory.map(historyRunForStorage),
          runStatus: "restored",
          restoredFromCheckpoint: code,
          ...clone(operationLineage),
          modelVersion: restoredModel?.packageVersion || null,
          inputSnapshotId: restoredInputSnapshot?.snapshotId || null,
          enterpriseCount: bundle.fixture.enterpriseCount
        }
      }
    ], operation.context, { requireEmpty: true });
    requirePersistence(persistence, `${code} 克隆恢复投影未能原子持久化`);
    bindCheckpointRuntime(previousSuccessfulRun);
    set({
      context: operation.context,
      historicalView: null,
      activeRun: null,
      regressionRun: null,
      lastSuccessfulRun: activeRunForStorage(previousSuccessfulRun),
      runHistory: restoredHistory,
      decisions: [],
      actionRequests: [],
      pendingDecision: null,
      factorInputs: restoredFactorInputs,
      factorInputSnapshot: restoredInputSnapshot,
      factorEntryStatus: restoredFactorStatus,
      factorEntryValidation: null,
      publishedModel: restoredModel,
      configDraft: restoredDraft,
      configStatus: restoredConfigStatus,
      configValidation: null,
      queryId: null,
      queryAnswer: null,
      runStatus: "restored",
      restoredFromCheckpoint: code,
      operationLineage,
      projectionPersistence: persistence,
      operationNotice: `已从 ${code} 克隆恢复为新运行 ${DATA.shortId(operation.context.scenarioRunId)}；当前仅恢复配置与数据状态，尚未形成新评估结果。`
    });
    return operation;
  }

  function returnToLastSuccessfulRun() {
    if (state.historicalView) throw new Error("请先退出历史快照只读模式。");
    const run = formalSuccessfulRun(state.lastSuccessfulRun);
    if (!run?.scenarioContext) throw new Error("当前没有可返回的正式成功运行；regression/restored/historical 不可作为返回目标。");
    const context = Object.freeze(clone(run.scenarioContext));
    const configLookup = assertProjectionLookupHealthy(projectionLookupForContext(context, "m01", "config/current"), "M01 模型配置");
    const factorLookup = assertProjectionLookupHealthy(projectionLookupForContext(context, "m02", "factor-inputs/current"), "M02/T053 企业因子输入");
    const decisionLookup = assertProjectionLookupHealthy(projectionLookupForContext(context, "m04", "action-requests/current"), "M04 Action Request");
    const projectedConfig = configLookup.payload;
    const projectedFactors = factorLookup.payload;
    const projectedDecisions = decisionLookup.payload;
    const staticRun = run.runId === bundle.c035Results?.scenarioIdentity?.scenarioRunId;
    if (!staticRun && !projectedConfig) {
      throw new Error("上一动态成功运行缺少同轮次 M01 模型配置投影，拒绝静默回退静态资源。");
    }
    let publishedModel = projectedConfig && hasOwn(projectedConfig, "publishedModel")
      ? publishedModelWithoutEnterpriseInputs(projectedConfig.publishedModel)
      : publishedModelWithoutEnterpriseInputs(bundle.model);
    const fallbackFactors = factorInputsFromSnapshot(bundle.humanInputSnapshot);
    let factorInputs = projectedFactors && hasOwn(projectedFactors, "values")
      ? clone(projectedFactors.values)
      : projectedConfig && hasOwn(projectedConfig, "enterpriseFactorInputs")
        ? clone(projectedConfig.enterpriseFactorInputs)
      : Object.keys(fallbackFactors).length ? fallbackFactors : sourceFactorInputs(bundle.fixture);
    let factorInputSnapshot = projectedFactors && hasOwn(projectedFactors, "snapshot")
      ? clone(projectedFactors.snapshot)
      : projectedConfig && hasOwn(projectedConfig, "modelConfigurationSnapshot")
        ? clone(projectedConfig.modelConfigurationSnapshot)
      : staticRun ? clone(bundle.humanInputSnapshot) : null;
    if (staticRun && (run.modelVersion !== publishedModel?.packageVersion || run.inputSnapshotId !== factorInputSnapshot?.snapshotId)) {
      publishedModel = publishedModelWithoutEnterpriseInputs(bundle.model);
      factorInputSnapshot = clone(bundle.humanInputSnapshot);
      factorInputs = factorInputsFromSnapshot(factorInputSnapshot);
    }
    if (!publishedModel || !factorInputSnapshot) throw new Error("上一成功运行的 Published 模型或 T053 输入快照显式为空，拒绝静态回退。");
    if (run.modelVersion !== publishedModel.packageVersion || run.inputSnapshotId !== factorInputSnapshot.snapshotId) {
      throw new Error("上一成功运行与其 Published 模型及 T053 输入身份不一致，拒绝返回。");
    }
    ensureRuntimeReports(run, context, { model: publishedModel, inputSnapshot: factorInputSnapshot });
    bindCheckpointRuntime(run);
    const returnedActionRequests = Array.isArray(projectedDecisions?.items)
      ? projectedDecisions.items.map(normalizeDecisionRecord).filter(Boolean)
      : run.runId === bundle.c035Results?.scenarioIdentity?.scenarioRunId ? sourceDecisionRecords() : [];
    set({
      context,
      activeRun: run,
      regressionRun: null,
      runStatus: "succeeded",
      runError: null,
      restoredFromCheckpoint: null,
      factorInputs,
      factorInputSnapshot,
      factorEntryStatus: projectedFactors?.status === "draft" || projectedFactors?.status === "validated" ? projectedFactors.status : "published",
      factorEntryValidation: null,
      publishedModel,
      configDraft: projectedConfig && hasOwn(projectedConfig, "configDraft") ? hydrateConfigDraft(projectedConfig.configDraft, publishedModel) : createConfigDraft(publishedModel),
      configStatus: projectedConfig && hasOwn(projectedConfig, "status") ? projectedConfig.status : "published",
      configValidation: null,
      decisions: confirmedDecisionRecords(returnedActionRequests),
      actionRequests: returnedActionRequests,
      pendingDecision: null,
      queryId: null,
      queryAnswer: null,
      operationLineage: null,
      operationNotice: `已返回正式成功运行 ${DATA.shortId(run.runId)}；未执行重评或副作用重放。`
    });
    return run;
  }

  async function isolatedRegression(code) {
    if (typeof bundle?.ensureCheckpointArtifacts === "function") await bundle.ensureCheckpointArtifacts(code);
    const entry = bundle.checkpoints.find(function (item) { return item.code === code; });
    if (!entry?.manifest) throw new Error(`${code} 尚未形成正式不可变快照。`);
    const projection = checkpointProjection(code, entry.manifest);
    if (!projection.exact) {
      throw new Error(`${code} 锁定工件未通过精确哈希校验，仅可查看证据；${projection.issues[0]?.message || "禁止回归"}`);
    }
    if (!projection.runnable) throw new Error(`${code} 尚未形成 Published 模型、完整人工输入与 C035 结果，不能执行债务风险回归。`);
    const operation = requireCheckpointRuntime().createRegression({ checkpointId: entry.manifest.checkpointId, operationId: nextOperationId() });
    const run = await evaluate(operation.context, {
      initial: false,
      keepPrevious: true,
      isolatedRegression: true,
      operationId: operation.operationId,
      operationReceipt: operation,
      operationMode: "isolated-regression",
      sourceCheckpointId: entry.manifest.checkpointId,
      sourceScenarioRunId: entry.manifest.scenarioContext?.scenarioRunId || null,
      moduleRestoreReferences: operation.moduleRestoreRefs || entry.manifest.modules,
      model: projection.model,
      inputSnapshot: projection.inputSnapshot,
      factorInputs: projection.factorInputs,
      fixture: projection.fixture,
      formalDataAsset: projection.data.formalDataAsset,
      qualityResult: projection.data.qualityResult
    });
    if (run) {
      set({ historicalView: null, operationNotice: `${code} 隔离回归已完成；历史 Action Request、通知、审批和待办未重放。` });
    }
    return { ...operation, run };
  }

  async function resetCurrentScenario() {
    if (state.historicalView) throw new Error("历史快照只读模式不能重置；请先退出历史查看。");
    if (!FOUNDATION) throw new Error("平台公共场景底座不可用，不能安全重置场景。");
    const context = FOUNDATION.createScenarioContext({
      scenarioId: "S003",
      scenarioVersion: "S003-v1",
      status: "active"
    });
    // A new run inherits the currently Published model, including a model
    // version created after the static bootstrap bundle.  Falling back to the
    // immutable bundle is only valid when the runtime has not yet projected a
    // current model; otherwise a reset would silently roll the scenario back
    // to the bootstrap version and break the M01/C008 lineage.
    const model = publishedModelWithoutEnterpriseInputs(state.publishedModel || bundle?.model);
    const inputSnapshot = clone(bundle?.humanInputSnapshot || state.factorInputSnapshot);
    if (!model || !inputSnapshot) throw new Error("缺少可用于新场景轮次的 Published 模型或人工输入快照。");
    const nextDraft = createConfigDraft(model);
    set({
      context,
      currentView: "platform-home",
      activeModuleId: "M06",
      currentAnchor: null,
      selectedEnterpriseId: bundle?.fixture?.enterprises?.[0]?.enterpriseId || null,
      factorInputs: sourceFactorInputs(bundle.fixture),
      factorInputSnapshot: inputSnapshot,
      factorEntryStatus: "published",
      factorEntryValidation: null,
      publishedModel: model,
      configDraft: nextDraft,
      configStatus: "published",
      configValidation: null,
      activeRun: null,
      lastSuccessfulRun: null,
      runHistory: [],
      runStatus: "idle",
      runError: null,
      regressionRun: null,
      queryId: null,
      queryAnswer: null,
      decisions: [],
      actionRequests: [],
      pendingDecision: null,
      historicalView: null,
      requestedScenarioRunId: null,
      requestedReportId: null,
      restoredFromCheckpoint: null,
      operationLineage: null,
      operationNotice: `已开启新的 S003 场景轮次 ${DATA.shortId(context.scenarioRunId)}；原运行与历史快照保持不变。`
    });
    return context;
  }

  function toggleNav() {
    set({ navCollapsed: !state.navCollapsed, mobileNavOpen: false });
  }

  function toggleMobileNav() {
    set({ mobileNavOpen: !state.mobileNavOpen });
  }

  function getRuntimeSnapshot() {
    refreshRuntimeHealthState();
    return clone({
      ready: state.ready,
      fatalError: state.fatalError,
      context: state.context,
      configStatus: state.configStatus,
      configValidation: state.configValidation,
      configDraft: state.configDraft,
      publishedModel: state.publishedModel,
      factorEntryStatus: state.factorEntryStatus,
      factorEntryValidation: state.factorEntryValidation,
      factorInputSnapshot: state.factorInputSnapshot,
      factorInputs: state.factorInputs,
      runStatus: state.runStatus,
      runError: state.runError,
      activeRun: state.activeRun,
      lastSuccessfulRun: state.lastSuccessfulRun,
      runHistory: state.runHistory,
      decisions: state.decisions,
      actionRequests: state.actionRequests,
      operationLineage: state.operationLineage,
      operationNotice: state.operationNotice,
      projectionNotice: state.projectionNotice,
      projectionHealth: state.projectionHealth,
      projectionRecoveryReceipts: state.projectionRecoveryReceipts,
      runtimeHealth: state.runtimeHealth,
      acceptanceReady: false
    });
  }

  function getPublishedResourceSnapshot() {
    if (!bundle) {
      return {
        ready: false,
        error: state.fatalError || "S003 正式资源包尚未加载。",
        acceptanceReady: false
      };
    }
    const currentContext = clone(state.context || bundle.c035Results?.scenarioIdentity || initialContext(bundle.manifest));
    // Published facts/C035 remain immutable evidence from their source run.
    // A quick rerun may have a newer browser work projection, but it must not
    // be relabeled as the source of those formal artifacts.
    const formalContext = clone(bundle.c035Results?.scenarioIdentity || initialContext(bundle.manifest));
    const publishedModel = publishedModelWithoutEnterpriseInputs(state.publishedModel || bundle.model);
    const formalInputSnapshot = clone(state.factorInputSnapshot || bundle.humanInputSnapshot);
    const publishedPointer = clone(bundle.publishedPointer);
    if (publishedPointer && publishedModel) {
      publishedPointer.scenarioIdentity = clone(formalContext);
      publishedPointer.switchedAt = publishedModel.publishedAt || publishedPointer.switchedAt || formalContext.formedAt;
      publishedPointer.activeTarget = {
        ...(publishedPointer.activeTarget || {}),
        packageId: publishedModel.packageId,
        packageVersion: publishedModel.packageVersion,
        lifecycleStatus: "PUBLISHED",
        publishedSnapshot: clone(publishedModel)
      };
    }
    return clone({
      schemaVersion: "ofw.s003.published-resource-read.v1",
      ready: Boolean(publishedModel && publishedPointer && formalInputSnapshot),
      readMode: "published-only",
      scenarioContext: currentContext,
      sourceScenarioContext: formalContext,
      publishedModel,
      publishedPointer,
      publishedFacts: bundle.publishedFacts,
      formalInputSnapshot,
      formalDataAsset: bundle.formalDataAsset,
      c035Results: bundle.c035Results,
      reportManifest: bundle.reportManifest,
      draftProjectionHealth: {
        M01: state.projectionHealth.M01 || null,
        M02: state.projectionHealth.M02 || null
      },
      note: "正式 Published 读取不依赖 M01/M02 当前 Draft；草稿异常只阻断对应写操作。",
      acceptanceReady: false
    });
  }

  window.S003Store = Object.freeze({
    bootstrap,
    subscribe,
    getState,
    getBundle,
    setView,
    selectEnterprise,
    setFilter,
    updateFactorInput,
    replaceFactorInputs,
    validateFactorInputs,
    publishFactorInputs,
    updateWeight,
    updateFactorCoefficient,
    updateRiskThreshold,
    replaceConfigurationDraft,
    validateConfiguration,
    publishConfiguration,
    resetConfiguration,
    quickRerun,
    runQuery,
    listDecisionCandidates,
    candidateFor,
    openDecision,
    openSubmittedActionRequest,
    closeDecision,
    submitDecision,
    submitActionRequest: submitDecision,
    confirmMemberUnitDecision,
    confirmMemberUnitActionRequest: confirmMemberUnitDecision,
    confirmSubmittedActionRequest: confirmMemberUnitDecision,
    confirmDecision,
    viewCheckpoint,
    exitHistoricalView,
    cloneRestore,
    isolatedRegression,
    resetCurrentScenario,
    returnToLastSuccessfulRun,
    toggleNav,
    toggleMobileNav,
    getRuntimeSnapshot,
    getPublishedResourceSnapshot
  });
})();
