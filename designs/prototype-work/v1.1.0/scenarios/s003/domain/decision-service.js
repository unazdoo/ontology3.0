(function (root, factory) {
  "use strict";

  const foundation = typeof module === "object" && module.exports
    ? require("../../../foundation/ofw-scenario-foundation.js")
    : root && root.OFWScenarioFoundation;
  const api = factory(foundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.S003DecisionService = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (foundation) {
  "use strict";

  const SERVICE_VERSION = "1.0.0";
  const DECISION_RUNTIME_SCHEMA_VERSION = "ofw.s003.m04.decision-runtime.v1";
  const ACTION_REQUEST_SCHEMA_VERSION = "ofw.s003.m04.action-request.v1";
  const TODO_SCHEMA_VERSION = "ofw.s003.m04.owner-todo.v1";
  const CONFIRMATION_SCHEMA_VERSION = "ofw.s003.m04.confirmation-receipt.v1";
  const SUBMISSION_SCHEMA_VERSION = "ofw.s003.m04.submission-receipt.v1";
  const MEMBER_CONFIRMATION_SCHEMA_VERSION = "ofw.s003.m04.member-confirmation-receipt.v1";
  const C035_SCHEMA_VERSION = "ofw.s003.c035.assessment-result.v1";
  const CANDIDATE_SCHEMA_VERSION = "ofw.s003.disposition-candidate.v1";
  const RISK_TIER_IDS = Object.freeze(["GREEN", "YELLOW", "RED", "BLACK"]);
  const ACTION_TYPE_IDS = Object.freeze([
    "S003_RISK_FOLLOW_UP",
    "S003_SPECIAL_DISPOSAL",
    "S003_EMERGENCY_RESPONSE",
    "S003_FACTOR_EMERGENCY"
  ]);
  // 历史 CP05/早期 v1 证据仍可被只读校验；当前 v2 Published 结果只允许
  // 按黄、红、黑风险分档形成一企一条预警，重大因子仅作为诊断证据。
  const CURRENT_ACTION_TYPE_IDS = Object.freeze([
    "S003_RISK_FOLLOW_UP",
    "S003_SPECIAL_DISPOSAL",
    "S003_EMERGENCY_RESPONSE"
  ]);
  const IDEMPOTENCY_FIELDS = Object.freeze([
    "scenarioRunId",
    "enterpriseId",
    "actionTypeId",
    "assessmentAt",
    "resultVersion"
  ]);
  const SIDE_EFFECT_DISABLED_STATUSES = Object.freeze([
    "historical-readonly",
    "regression",
    "restored",
    "closed"
  ]);
  const UNSUPPORTED_AUTHORITY_FIELDS = Object.freeze([
    "approver",
    "approval",
    "approvalLevel",
    "reviewer",
    "reviewerId",
    "userId",
    "role",
    "permission"
  ]);
  const MEMBER_CONFIRMATION_FIELDS = Object.freeze([
    "confirmed",
    "owner",
    "ownerId",
    "note",
    "confirmedAt",
    "recipientId",
    "recipientName",
    "confirmedBy",
    "confirmedById"
  ]);

  class S003DecisionError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = "S003DecisionError";
      this.code = code;
      this.details = details || null;
    }
  }

  function fail(code, message, details) {
    throw new S003DecisionError(code, message, details);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function cloneJson(value, label) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      fail("S003_DECISION_INVALID_JSON", `${label || "决策来源"}必须可安全序列化为 JSON`, {
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

  function token(value) {
    return String(value || "").trim().toUpperCase();
  }

  function stableToken(value) {
    const source = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(8, "0");
  }

  function assertFoundation() {
    if (!foundation || typeof foundation.assertScenarioContext !== "function") {
      fail("S003_DECISION_FOUNDATION_UNAVAILABLE", "场景公共底座未加载，M04 已拒绝写入");
    }
    return foundation;
  }

  function assertContext(value) {
    let context;
    try {
      context = assertFoundation().assertScenarioContext(value);
    } catch (error) {
      fail("S003_DECISION_INVALID_SCENARIO_CONTEXT", "M04 必须携带合法的场景三元身份", {
        causeCode: error && error.code,
        cause: error && error.message
      });
    }
    if (context.scenarioId !== "S003" || !String(context.scenarioVersion).startsWith("S003-v")) {
      fail("S003_DECISION_SCENARIO_MISMATCH", "M04 债务风险决策只接受 S003 场景身份", {
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion
      });
    }
    return context;
  }

  function triple(context) {
    return {
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId
    };
  }

  function assertIdentity(context, identity, path) {
    if (!isObject(identity)) fail("S003_DECISION_MISSING_IDENTITY", `${path}缺少场景三元身份`);
    const expected = triple(context);
    const mismatches = Object.keys(expected).filter((field) => identity[field] !== expected[field]);
    if (mismatches.length) {
      fail("S003_DECISION_SCENARIO_MISMATCH", `${path}与当前场景运行轮次不一致`, {
        path,
        mismatches,
        expected,
        actual: {
          scenarioId: identity.scenarioId,
          scenarioVersion: identity.scenarioVersion,
          scenarioRunId: identity.scenarioRunId
        }
      });
    }
  }

  function assertString(value, code, message, details) {
    if (typeof value !== "string" || !value.trim()) fail(code, message, details);
    return value.trim();
  }

  function assertSafeText(value, field, maxLength, required) {
    if (value === undefined || value === null) {
      if (required) fail("S003_DECISION_INVALID_CONFIRMATION", `${field}不能为空`);
      return "";
    }
    if (typeof value !== "string") {
      fail("S003_DECISION_INVALID_CONFIRMATION", `${field}必须是文本`);
    }
    const normalized = value.trim();
    if (required && !normalized) fail("S003_DECISION_INVALID_CONFIRMATION", `${field}不能为空`);
    if (normalized.length > maxLength) {
      fail("S003_DECISION_INVALID_CONFIRMATION", `${field}长度不能超过${maxLength}个字符`);
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) {
      fail("S003_DECISION_INVALID_CONFIRMATION", `${field}包含非法控制字符`);
    }
    return normalized;
  }

  function normalizedIdempotencyKey(parts) {
    const missing = IDEMPOTENCY_FIELDS.filter((field) => !String(parts[field] || "").trim());
    if (missing.length) {
      fail("S003_DECISION_INVALID_IDEMPOTENCY_KEY", "Action Request 缺少完整幂等键字段", {missing});
    }
    return IDEMPOTENCY_FIELDS.map((field) => String(parts[field]).trim()).join("|");
  }

  function deriveCandidateId(idempotencyKey) {
    return `S003-CAND-${stableToken(idempotencyKey)}`;
  }

  function deriveActionRequestId(idempotencyKey) {
    return `AR-S003-${stableToken(idempotencyKey)}`;
  }

  function deriveTodoId(idempotencyKey) {
    return `TODO-S003-${stableToken(idempotencyKey)}`;
  }

  function sourceStatus(input, container) {
    const value = token(input.publicationStatus || input.lifecycleStatus || container.status);
    if (value && !["PUBLISHED", "PUBLISHED-RESULTS", "SUCCEEDED"].includes(value)) {
      fail("S003_DECISION_SOURCE_NOT_PUBLISHED", "M04 只能消费 Published C035 候选", {status: value});
    }
  }

  // C011 的收件路由只允许使用确定性的成员单位接口人映射。
  // 路由是决策中心的运行元数据，不等同于权限系统；一期不回退集团管理员。
  function normalizeRouting(input, context, currentFlow) {
    const raw = input?.enterpriseContactRouting || input?.contactRouting || input?.routing || null;
    if (!raw) {
      if (currentFlow) {
        fail("S003_DECISION_ROUTING_REQUIRED", "当前 Published 运行缺少成员单位接口人路由，已拒绝创建 C011");
      }
      return {schemaVersion: null, routes: new Map(), source: null, required: false};
    }
    if (!isObject(raw) || !Array.isArray(raw.routes)) {
      fail("S003_DECISION_INVALID_ROUTING", "成员单位接口人路由必须包含 routes 数组");
    }
    const routes = new Map();
    raw.routes.forEach((route, index) => {
      if (!isObject(route)) fail("S003_DECISION_INVALID_ROUTING", `routing.routes[${index}]必须是普通对象`);
      const enterpriseId = assertString(
        route.enterpriseId,
        "S003_DECISION_INVALID_ROUTING",
        `routing.routes[${index}].enterpriseId 不能为空`
      );
      if (routes.has(enterpriseId)) {
        fail("S003_DECISION_INVALID_ROUTING", `routing.routes[${index}]企业路由重复`, {enterpriseId});
      }
      const recipient = route.decisionRecipient || route.recipient;
      if (!isObject(recipient)) {
        fail("S003_DECISION_INVALID_ROUTING", `routing.routes[${index}]缺少 decisionRecipient`, {enterpriseId});
      }
      const recipientId = assertString(
        recipient.recipientId,
        "S003_DECISION_INVALID_ROUTING",
        `routing.routes[${index}].decisionRecipient.recipientId 不能为空`
      );
      const recipientName = assertString(
        recipient.recipientName,
        "S003_DECISION_INVALID_ROUTING",
        `routing.routes[${index}].decisionRecipient.recipientName 不能为空`
      );
      const role = assertString(
        recipient.role,
        "S003_DECISION_INVALID_ROUTING",
        `routing.routes[${index}].decisionRecipient.role 不能为空`
      );
      if (role !== "成员单位债务风险接口人") {
        fail("S003_DECISION_INVALID_ROUTING", `routing.routes[${index}]收件人角色必须是成员单位债务风险接口人`, {
          enterpriseId,
          role
        });
      }
      routes.set(enterpriseId, deepFreeze({
        enterpriseId,
        enterpriseName: route.enterpriseName || null,
        memberUnitId: route.memberUnitId || null,
        memberUnitName: route.memberUnitName || route.enterpriseName || null,
        decisionRecipient: {recipientId, recipientName, role}
      }));
    });
    if (currentFlow && !routes.size) {
      fail("S003_DECISION_ROUTING_REQUIRED", "当前 Published 运行缺少有效成员单位接口人路由，已拒绝创建 C011");
    }
    return {
      schemaVersion: raw.schemaVersion || null,
      routes,
      source: cloneJson(raw),
      required: Boolean(currentFlow || raw.missingRoutePolicy === "FAIL_CLOSED")
    };
  }

  function routeFor(routing, candidate) {
    const route = routing?.routes?.get(candidate.enterpriseId);
    if (!route) {
      fail("S003_DECISION_ROUTE_NOT_FOUND", "当前企业没有成员单位接口人路由，已拒绝提交 C011", {
        enterpriseId: candidate.enterpriseId
      });
    }
    return route;
  }

  function normalizeSource(input, context) {
    if (!isObject(input)) fail("S003_DECISION_INVALID_INPUT", "创建 M04 服务需要普通对象输入");
    const raw = cloneJson(input, "M04 决策来源");
    const container = isObject(raw.c035Results)
      ? raw.c035Results
      : isObject(raw.c035ResultSet)
        ? raw.c035ResultSet
        : isObject(raw.portfolio)
          ? raw.portfolio
        : raw;
    const legacySource = container.schemaVersion === "ofw.s003.c035.assessment-result.v1"
      || String(container.resultSetVersion || "") === "1.0.0";
    sourceStatus(raw, container);
    if (container.scenarioIdentity) assertIdentity(context, container.scenarioIdentity, "c035ResultSet.scenarioIdentity");
    const results = Array.isArray(raw.c035Results)
      ? raw.c035Results
      : Array.isArray(container.results)
        ? container.results
        : [];
    if (!results.length) fail("S003_DECISION_SOURCE_EMPTY", "M04 必须消费至少一条 C035 结果");

    const resultById = new Map();
    const resultByEnterpriseId = new Map();
    results.forEach((result, index) => {
      const path = `c035Results[${index}]`;
      if (!isObject(result) || result.schemaVersion !== C035_SCHEMA_VERSION || result.contractId !== "C035") {
        fail("S003_DECISION_INVALID_C035", `${path}不是合法 C035 结果`);
      }
      if (token(result.status) !== "SUCCEEDED") {
        fail("S003_DECISION_INVALID_C035", `${path}尚未成功完成评估`, {status: result.status || null});
      }
      if (token(result.modelIdentity && result.modelIdentity.lifecycleStatus) !== "PUBLISHED") {
        fail("S003_DECISION_SOURCE_NOT_PUBLISHED", `${path}引用的模型不是 Published 版本`, {
          lifecycleStatus: result.modelIdentity && result.modelIdentity.lifecycleStatus
        });
      }
      assertIdentity(context, result.scenarioIdentity, `${path}.scenarioIdentity`);
      const enterpriseId = assertString(
        result.enterprise && result.enterprise.enterpriseId,
        "S003_DECISION_INVALID_C035",
        `${path}缺少企业稳定 ID`
      );
      if (!result.resultId || resultById.has(result.resultId)) {
        fail("S003_DECISION_INVALID_C035", `${path}.resultId 必须非空且唯一`);
      }
      if (resultByEnterpriseId.has(enterpriseId)) {
        fail("S003_DECISION_INVALID_C035", `${path}企业稳定 ID重复`, {enterpriseId});
      }
      if (!Number.isFinite(result.finalScore) || result.finalScore < 0 || result.finalScore > 100) {
        fail("S003_DECISION_INVALID_C035", `${path}.finalScore 必须是0—100的有限数值`);
      }
      if (!result.riskTier || !RISK_TIER_IDS.includes(result.riskTier.tierId)) {
        fail("S003_DECISION_INVALID_C035", `${path}.riskTier 不是固定风险档`);
      }
      resultById.set(result.resultId, result);
      resultByEnterpriseId.set(enterpriseId, result);
    });

    const candidates = [];
    const seenCandidateIds = new Set();
    const seenKeys = new Set();
    function addCandidate(rawCandidate, result, path) {
      const candidate = rawCandidate || {};
      if (!isObject(candidate)) fail("S003_DECISION_INVALID_CANDIDATE", `${path}必须是普通对象`);
      const enterpriseId = String(candidate.enterpriseId || result.enterprise.enterpriseId || "").trim();
      if (!enterpriseId || enterpriseId !== result.enterprise.enterpriseId) {
        fail("S003_DECISION_CANDIDATE_MISMATCH", `${path}企业身份与 C035 不一致`, {enterpriseId});
      }
      if (candidate.scenarioIdentity) assertIdentity(context, candidate.scenarioIdentity, `${path}.scenarioIdentity`);
      if (candidate.scenarioRunId && candidate.scenarioRunId !== context.scenarioRunId) {
        fail("S003_DECISION_SCENARIO_MISMATCH", `${path}.scenarioRunId 与当前运行不一致`);
      }
      const actionTypeId = assertString(
        candidate.actionTypeId,
        "S003_DECISION_INVALID_CANDIDATE",
        `${path}.actionTypeId 不能为空`
      );
      if (!ACTION_TYPE_IDS.includes(actionTypeId)
        || (!legacySource && !CURRENT_ACTION_TYPE_IDS.includes(actionTypeId))) {
        fail("S003_DECISION_INVALID_CANDIDATE", `${path}.actionTypeId 不在一期 Action Type 清单中`, {actionTypeId});
      }
      if (candidate.status !== undefined && candidate.status !== "CANDIDATE_AWAITING_HUMAN_CONFIRMATION") {
        fail("S003_DECISION_INVALID_CANDIDATE", `${path}必须保持待人工确认状态`, {status: candidate.status});
      }
      if (candidate.requiresHumanConfirmation !== undefined && candidate.requiresHumanConfirmation !== true) {
        fail("S003_DECISION_INVALID_CANDIDATE", `${path}必须要求人工确认`);
      }
      if (
        candidate.autoCreateActionRequest === true
        || candidate.autoCreateTodo === true
        || candidate.actionRequestId != null
        || candidate.todoId != null
      ) {
        fail("S003_DECISION_SIDE_EFFECT_SOURCE", `${path}已经包含自动派发或既有副作用状态`);
      }
      const key = normalizedIdempotencyKey({
        scenarioRunId: context.scenarioRunId,
        enterpriseId,
        actionTypeId,
        assessmentAt: candidate.assessmentAt || result.assessmentAt,
        resultVersion: candidate.resultVersion || result.resultVersion
      });
      if (candidate.idempotencyKey && candidate.idempotencyKey !== key) {
        fail("S003_DECISION_INVALID_IDEMPOTENCY_KEY", `${path}.idempotencyKey 与标准幂等键不一致`);
      }
      const candidateId = String(candidate.candidateId || deriveCandidateId(key)).trim();
      if (!candidateId || seenCandidateIds.has(candidateId)) {
        fail("S003_DECISION_DUPLICATE_CANDIDATE", `${path}.candidateId 必须唯一`, {candidateId});
      }
      if (seenKeys.has(key)) {
        fail("S003_DECISION_DUPLICATE_CANDIDATE", `${path}与已有候选共享幂等键`, {idempotencyKey: key});
      }
      seenCandidateIds.add(candidateId);
      seenKeys.add(key);
      candidates.push({
        schemaVersion: CANDIDATE_SCHEMA_VERSION,
        candidateId,
        idempotencyKey: key,
        status: "CANDIDATE_AWAITING_HUMAN_CONFIRMATION",
        requiresHumanConfirmation: true,
        scenarioIdentity: triple(context),
        enterpriseId,
        enterpriseName: result.enterprise.name,
        category: result.enterprise.category || null,
        riskTier: result.riskTier.tierId,
        riskTierName: result.riskTier.name,
        finalScore: result.finalScore,
        actionTypeId,
        trigger: cloneJson(candidate.trigger || null),
        assessmentAt: candidate.assessmentAt || result.assessmentAt,
        resultVersion: candidate.resultVersion || result.resultVersion,
        sourceResultId: result.resultId,
        sourceResultVersion: result.resultVersion,
        owner: null,
        actionRequestId: null,
        todoId: null,
        autoCreateActionRequest: false,
        autoCreateTodo: false,
        source: {
          c035ResultId: result.resultId,
          c035SchemaVersion: result.schemaVersion
        }
      });
    }
    results.forEach((result, index) => {
      const resultCandidates = Array.isArray(result.dispositionCandidates) ? result.dispositionCandidates : [];
      resultCandidates.forEach((candidate, candidateIndex) => addCandidate(
        candidate,
        result,
        `c035Results[${index}].dispositionCandidates[${candidateIndex}]`
      ));
    });
    const directCandidates = Array.isArray(raw.candidates)
      ? raw.candidates
      : Array.isArray(raw.dispositionCandidates)
        ? raw.dispositionCandidates
        : [];
    directCandidates.forEach((candidate, index) => {
      const result = candidate && candidate.sourceResultId
        ? resultById.get(candidate.sourceResultId)
        : resultByEnterpriseId.get(candidate && candidate.enterpriseId);
      if (!result) fail("S003_DECISION_CANDIDATE_MISMATCH", `candidates[${index}]无法关联 C035 结果`);
      if (result.dispositionCandidates && result.dispositionCandidates.some((item) => item.candidateId === candidate.candidateId)) return;
      addCandidate(candidate, result, `candidates[${index}]`);
    });

    return deepFreeze({
      results,
      candidates,
      resultById,
      resultByEnterpriseId,
      sourceMeta: {
        resultSetId: container.resultSetId || null,
        resultSetVersion: container.resultSetVersion || null,
        c035ResultCount: results.length,
        candidateCount: candidates.length,
        currentFlow: !legacySource
      }
    });
  }

  function normalizeMode(input, context) {
    const mode = String(input.mode || context.status || "active").trim().toLowerCase();
    if (mode === "isolated-regression" || mode === "drill") return "regression";
    if (["historical-readonly", "regression", "restored", "active", "closed"].includes(mode)) return mode;
    fail("S003_DECISION_INVALID_MODE", "M04 运行模式不受支持", {mode});
  }

  function normalizeExistingRecords(records, context) {
    if (records === undefined) return [];
    if (!Array.isArray(records)) fail("S003_DECISION_INVALID_EXISTING_RECORDS", "existingRecords 必须是数组");
    const result = [];
    const keys = new Set();
    records.forEach((item, index) => {
      const record = isObject(item) && item.actionRequest ? item : {actionRequest: item, todo: item && item.todo};
      const action = record.actionRequest;
      if (!isObject(action)) fail("S003_DECISION_INVALID_EXISTING_RECORDS", `existingRecords[${index}]缺少 Action Request`);
      assertIdentity(context, action.scenarioIdentity, `existingRecords[${index}].actionRequest.scenarioIdentity`);
      const key = normalizedIdempotencyKey({
        scenarioRunId: action.scenarioIdentity.scenarioRunId,
        enterpriseId: action.enterpriseId,
        actionTypeId: action.actionTypeId,
        assessmentAt: action.assessmentAt,
        resultVersion: action.resultVersion
      });
      if (keys.has(key)) fail("S003_DECISION_DUPLICATE_CONFIRMATION", "existingRecords 中存在重复幂等键", {idempotencyKey: key});
      const todo = cloneJson(record.todo || null);
      const pending = action.status === "awaiting-member-unit-confirmation" || action.confirmed === false;
      if (pending && (action.owner != null || action.ownerId != null || action.todoId != null || todo != null)) {
        fail(
          "S003_DECISION_INVALID_EXISTING_RECORDS",
          `existingRecords[${index}]待成员单位确认记录不得预置 owner 或 todo`
        );
      }
      if (todo && action.todoId && todo.todoId !== action.todoId) {
        fail("S003_DECISION_INVALID_EXISTING_RECORDS", `existingRecords[${index}]的 todoId 与 Action Request 不一致`);
      }
      keys.add(key);
      result.push(deepFreeze({
        idempotencyKey: key,
        stage: todo ? "confirmed" : "submitted",
        actionRequest: cloneJson(action),
        todo,
        created: false,
        idempotent: true,
        duplicate: true
      }));
    });
    return result;
  }

  function assertConfirmation(confirmation) {
    if (!isObject(confirmation)) fail("S003_DECISION_INVALID_CONFIRMATION", "人工确认必须是普通对象");
    UNSUPPORTED_AUTHORITY_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(confirmation, field)) {
        fail("S003_DECISION_UNSUPPORTED_AUTHORITY", `一期不支持${field}或多级审批权限`);
      }
    });
    if (confirmation.confirmed !== true) {
      fail("S003_DECISION_CONFIRMATION_REQUIRED", "只有 confirmed=true 的人工确认才能创建 Action Request");
    }
    const owner = assertSafeText(confirmation.owner, "owner", 120, true);
    const note = assertSafeText(confirmation.note, "note", 2000, false);
    let confirmedAt = confirmation.confirmedAt;
    if (confirmedAt !== undefined) {
      if (typeof confirmedAt !== "string" || Number.isNaN(Date.parse(confirmedAt))) {
        fail("S003_DECISION_INVALID_CONFIRMATION", "confirmedAt 必须是有效时间");
      }
      confirmedAt = new Date(confirmedAt).toISOString();
    }
    return {owner, note, confirmedAt};
  }

  function assertMemberConfirmation(confirmation, route) {
    if (!isObject(confirmation)) fail("S003_DECISION_INVALID_MEMBER_CONFIRMATION", "成员单位接口人确认必须是普通对象");
    UNSUPPORTED_AUTHORITY_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(confirmation, field)) {
        fail("S003_DECISION_UNSUPPORTED_AUTHORITY", `一期不支持${field}或多级审批权限`);
      }
    });
    if (confirmation.confirmed !== true) {
      fail("S003_DECISION_MEMBER_CONFIRMATION_REQUIRED", "只有成员单位接口人 confirmed=true 才能形成负责人待办");
    }
    const recipientId = assertSafeText(confirmation.recipientId || route?.decisionRecipient?.recipientId, "recipientId", 160, true);
    if (route?.decisionRecipient?.recipientId && recipientId !== route.decisionRecipient.recipientId) {
      fail("S003_DECISION_RECIPIENT_MISMATCH", "确认收件人不是该企业当前成员单位接口人", {
        expected: route.decisionRecipient.recipientId,
        actual: recipientId
      });
    }
    const recipientName = assertSafeText(
      confirmation.recipientName || route?.decisionRecipient?.recipientName,
      "recipientName",
      200,
      true
    );
    const confirmedBy = assertSafeText(confirmation.confirmedBy || recipientName, "confirmedBy", 200, true);
    const confirmedById = assertSafeText(confirmation.confirmedById || recipientId, "confirmedById", 160, true);
    const owner = assertSafeText(confirmation.owner, "owner", 120, true);
    const ownerId = assertSafeText(confirmation.ownerId, "ownerId", 160, false);
    const note = assertSafeText(confirmation.note, "note", 2000, false);
    let confirmedAt = confirmation.confirmedAt;
    if (confirmedAt !== undefined) {
      if (typeof confirmedAt !== "string" || Number.isNaN(Date.parse(confirmedAt))) {
        fail("S003_DECISION_INVALID_MEMBER_CONFIRMATION", "confirmedAt 必须是有效时间");
      }
      confirmedAt = new Date(confirmedAt).toISOString();
    }
    return {
      confirmed: true,
      recipientId,
      recipientName,
      confirmedBy,
      confirmedById,
      owner,
      ownerId: ownerId || null,
      note,
      confirmedAt
    };
  }

  function assertSubmission(submission) {
    const raw = submission === undefined ? {} : submission;
    if (!isObject(raw)) fail("S003_DECISION_INVALID_SUBMISSION", "驾驶舱行动申请提交参数必须是普通对象");
    UNSUPPORTED_AUTHORITY_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(raw, field)) {
        fail("S003_DECISION_UNSUPPORTED_AUTHORITY", `一期不支持${field}或多级审批权限`);
      }
    });
    if (raw.confirmed === true || raw.owner != null || raw.ownerId != null || raw.todoId != null) {
      fail(
        "S003_DECISION_SUBMISSION_STAGE_VIOLATION",
        "驾驶舱提交 C011 时不得确认、指定负责人或创建待办"
      );
    }
    const submittedBy = assertSafeText(raw.submittedBy || "集团债务风险管理人员", "submittedBy", 160, true);
    const submittedById = assertSafeText(raw.submittedById, "submittedById", 160, false);
    const note = assertSafeText(raw.note, "note", 2000, false);
    let submittedAt = raw.submittedAt;
    if (submittedAt !== undefined) {
      if (typeof submittedAt !== "string" || Number.isNaN(Date.parse(submittedAt))) {
        fail("S003_DECISION_INVALID_SUBMISSION", "submittedAt 必须是有效时间");
      }
      submittedAt = new Date(submittedAt).toISOString();
    }
    return {submittedBy, submittedById: submittedById || null, note, submittedAt};
  }

  function findCandidate(source, reference) {
    if (typeof reference === "string") {
      const tokenValue = reference.trim();
      return source.candidates.find((candidate) => candidate.candidateId === tokenValue || candidate.idempotencyKey === tokenValue) || null;
    }
    if (isObject(reference)) {
      if (reference.candidateId) return findCandidate(source, String(reference.candidateId));
      if (reference.idempotencyKey) return findCandidate(source, String(reference.idempotencyKey));
      if (reference.enterpriseId && reference.actionTypeId) {
        return source.candidates.find((candidate) => (
          candidate.enterpriseId === reference.enterpriseId && candidate.actionTypeId === reference.actionTypeId
        )) || null;
      }
    }
    return null;
  }

  function makeActionRequest(candidate, confirmation, confirmedAt, actionRequestId, todoId) {
    return {
      schemaVersion: ACTION_REQUEST_SCHEMA_VERSION,
      actionRequestId,
      status: "pending-generic-decision-handoff",
      entry: "Action Request",
      scenarioIdentity: cloneJson(candidate.scenarioIdentity),
      enterpriseId: candidate.enterpriseId,
      enterpriseName: candidate.enterpriseName,
      category: candidate.category,
      riskTier: candidate.riskTier,
      riskTierName: candidate.riskTierName,
      finalScore: candidate.finalScore,
      actionTypeId: candidate.actionTypeId,
      candidateId: candidate.candidateId,
      sourceCandidateId: candidate.candidateId,
      sourceResultId: candidate.sourceResultId,
      assessmentAt: candidate.assessmentAt,
      resultVersion: candidate.resultVersion,
      idempotencyKey: candidate.idempotencyKey,
      owner: confirmation.owner,
      note: confirmation.note,
      confirmed: true,
      confirmedAt,
      todoId,
      requiresHumanConfirmation: false,
      approvalRequired: false,
      permissionModel: "single-owner-todo",
      automatic: false,
      projectionOnly: true,
      multiLevelApproval: false,
      multiUserPermissionModel: false,
      externalDispatch: "generic-decision-center"
    };
  }

  function makeTodo(candidate, confirmation, confirmedAt, actionRequestId, todoId) {
    return {
      schemaVersion: TODO_SCHEMA_VERSION,
      todoId,
      actionRequestId,
      status: "pending",
      target: "负责人待办",
      scenarioIdentity: cloneJson(candidate.scenarioIdentity),
      enterpriseId: candidate.enterpriseId,
      enterpriseName: candidate.enterpriseName,
      actionTypeId: candidate.actionTypeId,
      candidateId: candidate.candidateId,
      sourceResultId: candidate.sourceResultId,
      assessmentAt: candidate.assessmentAt,
      resultVersion: candidate.resultVersion,
      idempotencyKey: candidate.idempotencyKey,
      owner: confirmation.owner,
      note: confirmation.note,
      createdAt: confirmedAt,
      automatic: false,
      approvalRequired: false,
      multiLevelApproval: false,
      externalDispatch: false
    };
  }

  function makeSubmittedActionRequest(candidate, route, submission, submittedAt, actionRequestId) {
    return {
      schemaVersion: ACTION_REQUEST_SCHEMA_VERSION,
      actionRequestId,
      status: "awaiting-member-unit-confirmation",
      entry: "Action Request",
      contractCode: "C011",
      scenarioIdentity: cloneJson(candidate.scenarioIdentity),
      enterpriseId: candidate.enterpriseId,
      enterpriseName: candidate.enterpriseName,
      category: candidate.category,
      riskTier: candidate.riskTier,
      riskTierName: candidate.riskTierName,
      finalScore: candidate.finalScore,
      actionTypeId: candidate.actionTypeId,
      candidateId: candidate.candidateId,
      sourceCandidateId: candidate.candidateId,
      sourceResultId: candidate.sourceResultId,
      assessmentAt: candidate.assessmentAt,
      resultVersion: candidate.resultVersion,
      idempotencyKey: candidate.idempotencyKey,
      submitted: true,
      submittedBy: submission.submittedBy,
      submittedById: submission.submittedById || null,
      submittedAt,
      confirmed: false,
      confirmedBy: null,
      confirmedById: null,
      confirmedAt: null,
      owner: null,
      ownerId: null,
      note: submission.note || "",
      todoId: null,
      requiresHumanConfirmation: true,
      confirmationActor: "成员单位债务风险接口人",
      approvalRequired: false,
      permissionModel: "single-owner-todo",
      automatic: false,
      projectionOnly: true,
      multiLevelApproval: false,
      multiUserPermissionModel: false,
      externalDispatch: "member-unit-decision-center",
      delivery: {
        status: "routed",
        target: "member-unit-decision-center",
        targetName: route.memberUnitName || route.enterpriseName || null,
        recipientRole: route.decisionRecipient.role,
        recordedOnly: true,
        externalSideEffect: false
      },
      decisionRecipient: cloneJson(route.decisionRecipient),
      routingTarget: {
        type: "member-unit-decision-center",
        organizationId: route.memberUnitId || null,
        organizationName: route.memberUnitName || route.enterpriseName || null
      },
      recipientRole: route.decisionRecipient.role,
      recommendedTaskOwner: null,
      recommendedTaskOwnerId: null,
      todo: null
    };
  }

  function makeMemberTodo(actionRequest, confirmation, confirmedAt, todoId) {
    return {
      schemaVersion: TODO_SCHEMA_VERSION,
      todoId,
      actionRequestId: actionRequest.actionRequestId,
      status: "pending",
      target: "负责人待办",
      scenarioIdentity: cloneJson(actionRequest.scenarioIdentity),
      enterpriseId: actionRequest.enterpriseId,
      enterpriseName: actionRequest.enterpriseName,
      actionTypeId: actionRequest.actionTypeId,
      candidateId: actionRequest.candidateId,
      sourceResultId: actionRequest.sourceResultId,
      assessmentAt: actionRequest.assessmentAt,
      resultVersion: actionRequest.resultVersion,
      idempotencyKey: actionRequest.idempotencyKey,
      owner: confirmation.owner,
      ownerId: confirmation.ownerId,
      note: confirmation.note,
      createdAt: confirmedAt,
      assignedBy: confirmation.confirmedBy,
      assignedById: confirmation.confirmedById,
      recipientId: confirmation.recipientId,
      recipientName: confirmation.recipientName,
      automatic: false,
      approvalRequired: false,
      multiLevelApproval: false,
      externalDispatch: false
    };
  }

  function confirmationReceipt(context, candidate, record, sideEffects) {
    return deepFreeze({
      schemaVersion: CONFIRMATION_SCHEMA_VERSION,
      serviceVersion: SERVICE_VERSION,
      mode: "generic-decision-center",
      scenarioIdentity: triple(context),
      candidateId: candidate.candidateId,
      idempotencyKey: candidate.idempotencyKey,
      created: Boolean(record.created),
      idempotent: Boolean(record.idempotent),
      duplicate: Boolean(record.duplicate),
      sideEffects: {
        actionRequestCreated: Boolean(sideEffects.actionRequestCreated),
        todoCreated: Boolean(sideEffects.todoCreated),
        notificationSent: false,
        externalDispatch: false
      },
      actionRequest: cloneJson(record.actionRequest),
      todo: cloneJson(record.todo)
    });
  }

  function submissionReceipt(context, candidate, record, sideEffects) {
    return deepFreeze({
      schemaVersion: SUBMISSION_SCHEMA_VERSION,
      serviceVersion: SERVICE_VERSION,
      mode: "dashboard-to-member-unit",
      stage: "submitted",
      scenarioIdentity: triple(context),
      candidateId: candidate.candidateId,
      idempotencyKey: candidate.idempotencyKey,
      created: Boolean(record.created),
      idempotent: Boolean(record.idempotent),
      duplicate: Boolean(record.duplicate),
      sideEffects: {
        actionRequestCreated: Boolean(sideEffects.actionRequestCreated),
        todoCreated: false,
        notificationSent: false,
        externalDispatch: false,
        routedToMemberUnit: Boolean(sideEffects.routedToMemberUnit),
        routingRecorded: Boolean(sideEffects.routedToMemberUnit)
      },
      actionRequest: cloneJson(record.actionRequest),
      todo: null
    });
  }

  function memberConfirmationReceipt(context, candidate, record, sideEffects) {
    return deepFreeze({
      schemaVersion: MEMBER_CONFIRMATION_SCHEMA_VERSION,
      serviceVersion: SERVICE_VERSION,
      mode: "member-unit-to-owner-todo",
      stage: "confirmed",
      scenarioIdentity: triple(context),
      candidateId: candidate.candidateId,
      idempotencyKey: candidate.idempotencyKey,
      created: Boolean(record.created),
      idempotent: Boolean(record.idempotent),
      duplicate: Boolean(record.duplicate),
      sideEffects: {
        actionRequestCreated: false,
        todoCreated: Boolean(sideEffects.todoCreated),
        notificationSent: false,
        externalDispatch: false
      },
      actionRequest: cloneJson(record.actionRequest),
      todo: cloneJson(record.todo)
    });
  }

  function createDecisionService(input) {
    if (!isObject(input)) fail("S003_DECISION_INVALID_INPUT", "创建 M04 服务需要普通对象输入");
    const context = assertContext(input.scenarioContext);
    const mode = normalizeMode(input, context);
    const source = normalizeSource(input, context);
    const routing = normalizeRouting(input, context, source.sourceMeta.currentFlow);
    const recordsByKey = new Map();
    normalizeExistingRecords(input.existingRecords, context).forEach((record) => {
      recordsByKey.set(record.idempotencyKey, record);
    });
    const clock = typeof input.now === "function" ? input.now : () => new Date();

    function listCandidates() {
      return deepFreeze(cloneJson(source.candidates));
    }

    function listConfirmed() {
      return deepFreeze([...recordsByKey.values()].map((record) => {
        const output = {
          idempotencyKey: record.idempotencyKey,
          created: record.created,
          idempotent: record.idempotent,
          duplicate: record.duplicate,
          actionRequest: cloneJson(record.actionRequest),
          todo: cloneJson(record.todo)
        };
        // v1 CP05 资源字节保持不变；两阶段 v2 运行才公开 stage。
        if (source.sourceMeta.currentFlow) output.stage = record.stage || (record.todo ? "confirmed" : "submitted");
        return output;
      }));
    }

    function listActionRequests() {
      return listConfirmed();
    }

    function ensureSideEffectsAllowed(operation) {
      if (SIDE_EFFECT_DISABLED_STATUSES.includes(mode) || SIDE_EFFECT_DISABLED_STATUSES.includes(context.status)) {
        fail("S003_DECISION_SIDE_EFFECT_DISABLED", `历史查看、恢复、回归或已关闭轮次禁止${operation || "创建 Action Request、待办和外发副作用"}`, {
          mode,
          contextStatus: context.status
        });
      }
    }

    function eventTime(value, label) {
      if (value) return value;
      try {
        return new Date(clock()).toISOString();
      } catch (error) {
        fail("S003_DECISION_INVALID_CONFIRMATION", `无法形成合法${label || "操作"}时间`, {cause: error.message});
      }
    }

    function submitActionRequest(reference, submission) {
      if (!source.sourceMeta.currentFlow) {
        fail(
          "S003_DECISION_LEGACY_FLOW_ONLY",
          "历史 v1 候选保持原人工确认合同只读兼容；不得用当前两阶段接口改写历史证据"
        );
      }
      ensureSideEffectsAllowed("提交 C011 行动申请");
      const candidate = findCandidate(source, reference);
      if (!candidate) fail("S003_DECISION_CANDIDATE_NOT_FOUND", "当前 Published 运行中不存在该亮灯预警候选");
      const existing = recordsByKey.get(candidate.idempotencyKey);
      if (existing) {
        return submissionReceipt(context, candidate, {
          ...existing,
          created: false,
          idempotent: true,
          duplicate: true
        }, {actionRequestCreated: false, routedToMemberUnit: false});
      }
      const route = routeFor(routing, candidate);
      const normalizedSubmission = assertSubmission(submission);
      const submittedAt = eventTime(normalizedSubmission.submittedAt, "提交");
      const actionRequestId = deriveActionRequestId(candidate.idempotencyKey);
      const actionRequest = makeSubmittedActionRequest(
        candidate,
        route,
        normalizedSubmission,
        submittedAt,
        actionRequestId
      );
      const record = deepFreeze({
        idempotencyKey: candidate.idempotencyKey,
        stage: "submitted",
        created: true,
        idempotent: false,
        duplicate: false,
        actionRequest,
        todo: null
      });
      recordsByKey.set(candidate.idempotencyKey, record);
      return submissionReceipt(context, candidate, record, {
        actionRequestCreated: true,
        routedToMemberUnit: true
      });
    }

    function confirmMemberUnitActionRequest(reference, confirmation) {
      if (!source.sourceMeta.currentFlow) {
        fail(
          "S003_DECISION_LEGACY_FLOW_ONLY",
          "历史 v1 候选保持原人工确认合同只读兼容；不得用当前两阶段接口改写历史证据"
        );
      }
      ensureSideEffectsAllowed("确认行动申请或形成负责人待办");
      const candidate = findCandidate(source, reference);
      if (!candidate) fail("S003_DECISION_CANDIDATE_NOT_FOUND", "当前 Published 运行中不存在该亮灯预警候选");
      const existing = recordsByKey.get(candidate.idempotencyKey);
      if (!existing?.actionRequest) {
        fail("S003_DECISION_ACTION_REQUEST_REQUIRED", "成员单位接口人确认前必须先由驾驶舱提交 C011 行动申请");
      }
      if (existing.todo) {
        return memberConfirmationReceipt(context, candidate, {
          ...existing,
          created: false,
          idempotent: true,
          duplicate: true
        }, {todoCreated: false});
      }
      const route = routeFor(routing, candidate);
      const normalizedConfirmation = assertMemberConfirmation(confirmation, route);
      const confirmedAt = eventTime(normalizedConfirmation.confirmedAt, "确认");
      const todoId = deriveTodoId(candidate.idempotencyKey);
      const actionRequest = deepFreeze({
        ...cloneJson(existing.actionRequest),
        status: "confirmed-to-owner-todo",
        confirmed: true,
        confirmedBy: normalizedConfirmation.confirmedBy,
        confirmedById: normalizedConfirmation.confirmedById,
        confirmedAt,
        owner: normalizedConfirmation.owner,
        ownerId: normalizedConfirmation.ownerId,
        note: normalizedConfirmation.note || existing.actionRequest.note || "",
        todoId,
        requiresHumanConfirmation: false,
        decisionRecipient: cloneJson(route.decisionRecipient),
        todo: null
      });
      const todo = deepFreeze(makeMemberTodo(actionRequest, normalizedConfirmation, confirmedAt, todoId));
      const record = deepFreeze({
        idempotencyKey: candidate.idempotencyKey,
        stage: "confirmed",
        created: true,
        idempotent: false,
        duplicate: false,
        actionRequest,
        todo
      });
      recordsByKey.set(candidate.idempotencyKey, record);
      return memberConfirmationReceipt(context, candidate, record, {todoCreated: true});
    }

    function confirmCandidate(reference, confirmation) {
      if (source.sourceMeta.currentFlow) {
        fail(
          "S003_DECISION_MEMBER_UNIT_CONFIRMATION_REQUIRED",
          "当前 Published 运行必须先由驾驶舱提交 C011 行动申请，直达对应成员单位接口人的通用决策中心；接口人确认后再形成负责人待办。"
        );
      }
      ensureSideEffectsAllowed("创建 Action Request、待办和外发副作用");
      const candidate = findCandidate(source, reference);
      if (!candidate) fail("S003_DECISION_CANDIDATE_NOT_FOUND", "当前 Published 运行中不存在该处置候选");
      const normalizedConfirmation = assertConfirmation(confirmation);
      let confirmedAt = normalizedConfirmation.confirmedAt;
      if (!confirmedAt) {
        try {
          confirmedAt = new Date(clock()).toISOString();
        } catch (error) {
          fail("S003_DECISION_INVALID_CONFIRMATION", "无法形成合法确认时间", {cause: error.message});
        }
      }
      const existing = recordsByKey.get(candidate.idempotencyKey);
      if (existing) {
        return confirmationReceipt(context, candidate, {
          ...existing,
          created: false,
          idempotent: true,
          duplicate: true
        }, {actionRequestCreated: false, todoCreated: false});
      }
      const actionRequestId = deriveActionRequestId(candidate.idempotencyKey);
      const todoId = deriveTodoId(candidate.idempotencyKey);
      const actionRequest = makeActionRequest(candidate, normalizedConfirmation, confirmedAt, actionRequestId, todoId);
      const todo = makeTodo(candidate, normalizedConfirmation, confirmedAt, actionRequestId, todoId);
      const record = deepFreeze({
        idempotencyKey: candidate.idempotencyKey,
        created: true,
        idempotent: false,
        duplicate: false,
        actionRequest,
        todo
      });
      recordsByKey.set(candidate.idempotencyKey, record);
      return confirmationReceipt(context, candidate, record, {actionRequestCreated: true, todoCreated: true});
    }

    return Object.freeze({
      SERVICE_VERSION,
      DECISION_RUNTIME_SCHEMA_VERSION,
      mode,
      scenarioContext: context,
      sourceMeta: source.sourceMeta,
      listCandidates,
      listConfirmed,
      listActionRequests,
      submitActionRequest,
      confirmMemberUnitActionRequest,
      confirmCandidate
    });
  }

  return Object.freeze({
    SERVICE_VERSION,
    DECISION_RUNTIME_SCHEMA_VERSION,
    ACTION_REQUEST_SCHEMA_VERSION,
    TODO_SCHEMA_VERSION,
    CONFIRMATION_SCHEMA_VERSION,
    SUBMISSION_SCHEMA_VERSION,
    MEMBER_CONFIRMATION_SCHEMA_VERSION,
    IDEMPOTENCY_FIELDS,
    ACTION_TYPE_IDS,
    CURRENT_ACTION_TYPE_IDS,
    MEMBER_CONFIRMATION_FIELDS,
    S003DecisionError,
    createDecisionService
  });
});
