(() => {
  "use strict";

  const RESOURCE_PATHS = {
    binding: "../../scenarios/s003/resources/m04/decision-binding.v2.json",
    runtime: "../../scenarios/s003/resources/m04/decision-runtime.v2.json",
    results: "../../scenarios/s003/resources/m04/decision-results.v3.json",
    inbox: "../../scenarios/s003/resources/m04/decision-inbox.v3.json",
    routing: "../../scenarios/s003/resources/m04/enterprise-contact-routing.v1.json",
    riskResults: "../../scenarios/s003/resources/m01/c035-risk-results.v2.json",
    publishedPointer: "../../scenarios/s003/resources/m01/published-pointer.v2.json",
    actionTypeCatalog: "../../scenarios/s003/resources/m01/action-type-catalog.v2.json",
    c017: "../../scenarios/s003/resources/m02/c017-decision-projection.v2.json"
  };
  const STORAGE_SCOPE = "m04";
  const STORAGE_ROOT = "ofw:v1.1.0";
  const SCENARIO_SHELL_CHANNEL = "ontology3.0-scenario-shell-v1";
  const GENERIC_WORKSPACE_LABEL = "通用决策工作区";
  const STORAGE_KEYS = Object.freeze({
    state: "decision-center.portfolio.state.v6",
    view: "decision-center.portfolio.view.v2",
    projection: "decision-center.c019.projection.v1",
    c011: "decision-center.c011.inbox.v1",
    c017: "decision-center.c017.projection.v1"
  });
  const RECOVERY_STORAGE_KEYS = Object.freeze({
    state: "decision-center.portfolio.state.recovered.v1",
    view: "decision-center.portfolio.view.recovered.v1",
    projection: "decision-center.c019.projection.recovered.v1",
    c011: "decision-center.c011.inbox.recovered.v1",
    c017: "decision-center.c017.projection.recovered.v1"
  });
  const LEGACY_CONTRACT_KEYS = Object.freeze({
    c011: "ontology3.decision-center.c011.inbox.v1",
    c017: "ontology3.c017.decision-center.projection.v1"
  });
  let resourcePromise = null;
  const formalContractRecords = Object.create(null);
  let currentProjectionIssue = null;
  const projectionIssuesByKind = Object.create(null);
  let moduleHealth = { status: "checking", detail: "S003 通用决策资源正在装载。", error: null };

  function readUrlContext() {
    const params = new URLSearchParams(window.location.search);
    return {
      scenarioId: params.get("scenarioId"),
      scenarioVersion: params.get("scenarioVersion"),
      scenarioRunId: params.get("scenarioRunId"),
      formedAt: params.get("scenarioContextFormedAt") || params.get("formedAt"),
      status: params.get("scenarioStatus") || "active"
    };
  }

  function isActive(context) {
    return (context?.scenarioId || readUrlContext().scenarioId) === "S003";
  }

  function isReadOnlyContext(context) {
    const value = context || readUrlContext();
    const params = new URLSearchParams(window.location.search);
    return isActive(value) && (value?.status !== "active"
      || params.has("checkpoint")
      || params.get("mode") === "historical-readonly");
  }

  function isolateProjection(kind, error, options = {}) {
    const issue = {
      code: error?.code || "INCOMPATIBLE_PROJECTION",
      kind,
      isolated: true,
      writeBlocked: options.writeBlocked === true,
      recoveryRecordCorrupt: options.recoveryRecordCorrupt === true,
      reason: `S003 M04 ${kind} 工作投影不可兼容读取：${error?.message || "记录损坏"}`,
      recovery: options.recoveryRecordCorrupt
        ? `原恢复记录保持不变且写操作已阻断；请保留该记录并由受控恢复流程创建新的工作投影，正式决策结果仍可只读。`
        : `原命名空间记录保持不变；当前通用决策工作区将从不可变正式结果重新装入 ${RECOVERY_STORAGE_KEYS[kind] || "独立恢复逻辑键"}，只读证据不会被覆盖。`,
      originalLogicalKey: STORAGE_KEYS[kind] || null,
      rebuiltLogicalKey: RECOVERY_STORAGE_KEYS[kind] || null,
      detectedAt: new Date().toISOString()
    };
    projectionIssuesByKind[kind] = issue;
    currentProjectionIssue = issue;
    if (moduleHealth.status !== "blocked") moduleHealth = { status: "warning", detail: `${issue.reason}；正式决策结果将装入独立恢复逻辑键。`, error: null };
    return null;
  }

  function getProjectionIssue(kind = null) {
    const issue = kind ? projectionIssuesByKind[kind] : currentProjectionIssue;
    return issue ? clone(issue) : null;
  }

  function markProjectionIssue(kind, reason, code = "INCOMPATIBLE_PROJECTION") {
    const error = new Error(reason || "记录结构不兼容");
    error.code = code;
    isolateProjection(kind, error);
    return getProjectionIssue(kind);
  }

  function assertIdentity(context) {
    if (!context?.scenarioId || !context?.scenarioVersion || !context?.scenarioRunId) {
      throw new Error("S003 M04 命名空间缺少完整场景运行身份");
    }
    return context;
  }

  function storageContext(context) {
    const value = assertIdentity(context);
    return {
      scenarioId: value.scenarioId,
      scenarioVersion: value.scenarioVersion,
      scenarioRunId: value.scenarioRunId,
      formedAt: value.formedAt,
      status: value.status
    };
  }

  function physicalKey(context, kind) {
    const value = assertIdentity(context);
    const logicalKey = STORAGE_KEYS[kind];
    if (!logicalKey) throw new Error(`未知的 S003 M04 存储类型：${kind}`);
    return `${STORAGE_ROOT}:${value.scenarioId}:${value.scenarioVersion}:${value.scenarioRunId}:${STORAGE_SCOPE}:${encodeURIComponent(logicalKey)}`;
  }

  function recoveryPhysicalKey(context, kind) {
    const value = assertIdentity(context);
    const logicalKey = RECOVERY_STORAGE_KEYS[kind];
    if (!logicalKey) throw new Error(`未知的 S003 M04 恢复存储类型：${kind}`);
    return `${STORAGE_ROOT}:${value.scenarioId}:${value.scenarioVersion}:${value.scenarioRunId}:${STORAGE_SCOPE}:${encodeURIComponent(logicalKey)}`;
  }

  function parseEnvelope(raw, context, kind) {
    if (raw === null) return null;
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch (_) {
      throw new Error(`S003 M04 ${kind} 命名空间记录不是有效 JSON`);
    }
    if (envelope?.schemaVersion !== window.OFWScenarioFoundation?.STORAGE_SCHEMA_VERSION
      || !sameScenario(envelope?.scenarioContext, context)) {
      throw new Error(`S003 M04 ${kind} 命名空间记录与当前 scenarioRunId 不一致`);
    }
    return clone(envelope.payload);
  }

  function namespaceAdapter(context, storage) {
    if (!window.OFWScenarioFoundation?.createNamespacedStorage) {
      throw new Error("S003 M04 未加载场景 Foundation，拒绝回退 S001 固定键");
    }
    return window.OFWScenarioFoundation.createNamespacedStorage({ storage, context: storageContext(context), scope: STORAGE_SCOPE });
  }

  function readRecord(context, kind, storage) {
    if (!isActive(context)) return null;
    const recoveryKey = RECOVERY_STORAGE_KEYS[kind];
    try {
      const recoveryRaw = storage.getItem(recoveryPhysicalKey(context, kind));
      if (recoveryRaw !== null) {
        return isReadOnlyContext(context)
          ? parseEnvelope(recoveryRaw, context, `${kind} recovery`)
          : namespaceAdapter(context, storage).get(recoveryKey);
      }
    } catch (error) {
      isolateProjection(kind, error, { writeBlocked: true, recoveryRecordCorrupt: true });
      return null;
    }
    try {
      if (isReadOnlyContext(context)) return parseEnvelope(storage.getItem(physicalKey(context, kind)), context, kind);
      return namespaceAdapter(context, storage).get(STORAGE_KEYS[kind]);
    } catch (error) {
      return isolateProjection(kind, error);
    }
  }

  function assertProjectionPayloadCompatible(kind, payload, context) {
    const valid = kind === "projection"
      ? payload?.contractCode === "C019" && payload?.schemaVersion === 1 && Array.isArray(payload?.records)
      : kind === "c011"
        ? payload?.contractCode === "C011" && Array.isArray(payload?.requests)
        : kind === "c017"
          ? payload?.contractCode === "C017" && payload?.consumer === "决策中心" && Array.isArray(payload?.projections)
          : true;
    if (!valid || (["projection", "c011", "c017"].includes(kind) && !sameScenario(payload?.scenarioContext, context))) {
      const error = new Error(`${kind.toUpperCase()} payload 结构或场景运行身份不兼容`);
      error.code = "INCOMPATIBLE_PROJECTION_PAYLOAD";
      throw error;
    }
  }

  function parseLegacyContract(raw, context, kind) {
    if (raw === null) return null;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (_) {
      const error = new Error(`${kind.toUpperCase()} 旧投影不是有效 JSON`);
      error.code = "INVALID_LEGACY_CONTRACT_JSON";
      throw error;
    }
    assertProjectionPayloadCompatible(kind, payload, context);
    return clone(payload);
  }

  function readContractRecord(context, kind, storage = window.localStorage) {
    if (!["c011", "c017"].includes(kind)) throw new Error(`未知的 S003 M04 合同类型：${kind}`);
    const namespaced = readRecord(context, kind, storage);
    const legacyKey = LEGACY_CONTRACT_KEYS[kind];
    const legacyRaw = storage.getItem(legacyKey);
    if (namespaced && (kind !== "c011" || isReadOnlyContext(context) || legacyRaw === null)) return namespaced;
    const formal = formalContractRecords[kind] && sameScenario(formalContractRecords[kind].scenarioContext, context)
      ? clone(formalContractRecords[kind])
      : null;
    if (legacyRaw === null) return namespaced || formal || null;
    try {
      const payload = parseLegacyContract(legacyRaw, context, kind);
      if (kind === "c011" && namespaced && !isReadOnlyContext(context)) {
        const requests = new Map((namespaced.requests || []).map((request) => [request.id || request.requestId, clone(request)]));
        (payload.requests || []).forEach((request) => requests.set(request.id || request.requestId, clone(request)));
        const merged = {
          ...clone(namespaced),
          ...clone(payload),
          scenarioContext: clone(context),
          requests: [...requests.values()].filter(Boolean)
        };
        writeRecord(context, kind, merged, storage);
        return merged;
      }
      if (!namespaced && !isReadOnlyContext(context)) writeRecord(context, kind, payload, storage);
      return namespaced || payload || formal;
    } catch (error) {
      isolateProjection(kind, error);
      return namespaced || formal || null;
    }
  }

  function writeContractRecord(context, kind, payload, storage = window.localStorage) {
    if (!["c011", "c017"].includes(kind)) throw new Error(`未知的 S003 M04 合同类型：${kind}`);
    assertProjectionPayloadCompatible(kind, payload, context);
    return writeRecord(context, kind, payload, storage);
  }

  function writableLogicalKey(context, kind, storage) {
    const recoveryKey = RECOVERY_STORAGE_KEYS[kind];
    const primaryKey = STORAGE_KEYS[kind];
    const recoveryRaw = storage.getItem(recoveryPhysicalKey(context, kind));
    if (recoveryRaw !== null) {
      try {
        const recoveryPayload = parseEnvelope(recoveryRaw, context, `${kind} recovery`);
        assertProjectionPayloadCompatible(kind, recoveryPayload, context);
      } catch (error) {
        isolateProjection(kind, error, { writeBlocked: true, recoveryRecordCorrupt: true });
        throw new Error(`S003 M04 ${kind} 恢复投影损坏，拒绝覆盖原记录`);
      }
      return recoveryKey;
    }
    if (projectionIssuesByKind[kind]) return recoveryKey;
    const primaryRaw = storage.getItem(physicalKey(context, kind));
    if (primaryRaw === null) return primaryKey;
    try {
      const primaryPayload = parseEnvelope(primaryRaw, context, kind);
      assertProjectionPayloadCompatible(kind, primaryPayload, context);
      return primaryKey;
    } catch (error) {
      isolateProjection(kind, error);
      return recoveryKey;
    }
  }

  function writeRecord(context, kind, payload, storage) {
    if (!isActive(context)) return false;
    if (isReadOnlyContext(context)) throw new Error("历史、Checkpoint、恢复或回归上下文为只读，M04 写入已拒绝");
    const logicalKey = writableLogicalKey(context, kind, storage);
    namespaceAdapter(context, storage).set(logicalKey, payload);
    return true;
  }

  function removeRecord(context, kind, storage) {
    if (!isActive(context)) return false;
    if (isReadOnlyContext(context)) throw new Error("历史、Checkpoint、恢复或回归上下文为只读，M04 清理已拒绝");
    const logicalKey = writableLogicalKey(context, kind, storage);
    namespaceAdapter(context, storage).remove(logicalKey);
    return true;
  }

  function sameScenario(left, right) {
    return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((key) => left[key] && left[key] === right[key]));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizedDecisionRecipient(record = {}) {
    const rawRecipient = record?.decisionRecipient && typeof record.decisionRecipient === "object"
      ? record.decisionRecipient
      : record?.recipient && typeof record.recipient === "object"
        ? record.recipient
        : {};
    const routingTarget = record?.routingTarget && typeof record.routingTarget === "object" ? record.routingTarget : {};
    const recipient = {
      enterpriseId: rawRecipient.enterpriseId || record.enterpriseId || record.subjectId || null,
      memberUnitId: rawRecipient.memberUnitId || routingTarget.organizationId || null,
      memberUnitName: rawRecipient.memberUnitName || routingTarget.organizationName || null,
      recipientId: rawRecipient.recipientId || rawRecipient.id || record.recipientId || null,
      recipientName: rawRecipient.recipientName || rawRecipient.name || record.recipientName || null,
      role: rawRecipient.role || record.recipientRole || null
    };
    return Object.values(recipient).some(Boolean) ? recipient : null;
  }

  function decisionRecipientName(record) {
    return normalizedDecisionRecipient(record)?.recipientName || null;
  }

  function recommendedTaskOwner(record) {
    const recipientName = decisionRecipientName(record);
    if (record?.recommendedTaskOwner) return record.recommendedTaskOwner;
    if (record?.owner && record.owner !== recipientName) return record.owner;
    return `${record?.subjectName || record?.enterpriseName || "对应成员单位"}债务风险责任人`;
  }

  function immutableFingerprint(record, kind) {
    if (!record) return null;
    const recipient = normalizedDecisionRecipient(record);
    const common = {
      id: record.id || null,
      scenarioId: record.scenarioContext?.scenarioId || null,
      scenarioVersion: record.scenarioContext?.scenarioVersion || null,
      scenarioRunId: record.scenarioContext?.scenarioRunId || null,
      subjectId: record.subjectId || null,
      subjectName: record.subjectName || null,
      actionTypeId: record.actionType?.id || null,
      actionTypeVersion: record.actionType?.version || null,
      sourceRef: record.sourceRef || null,
      submittedBy: record.submittedBy || record.requester || null,
      memberUnitId: recipient?.memberUnitId || null,
      recipientId: recipient?.recipientId || null,
      recipientRole: recipient?.role || null,
      recommendedTaskOwner: record.recommendedTaskOwner || null,
      reportId: record.evidence?.reportId || record.reportId || null,
      reportRoute: record.evidence?.reportRoute || record.reportRoute || null
    };
    if (kind === "request") {
      return JSON.stringify({
        ...common,
        taskId: record.taskId || null,
        metricId: record.metric?.id || null,
        metricValue: record.metric?.value || null,
        decisionType: record.decision?.type || null,
        decisionTime: record.decision?.time || null,
        sourceResultVersion: record.sourceResultVersion || null,
        sourceCandidateId: record.sourceCandidateId || null
      });
    }
    return JSON.stringify({
      ...common,
      requestId: record.requestId || null,
      metricSnapshotId: record.metricSnapshotId || null,
      semanticVersion: record.semanticVersion || null,
      dataVersion: record.dataVersion || null,
      cutoff: record.cutoff || null,
      createdAt: record.createdAt || null
    });
  }

  function immutableRecordMatches(existing, expected, kind) {
    return immutableFingerprint(existing, kind) === immutableFingerprint(expected, kind);
  }

  function requestScenarioRerun(context, payload = {}) {
    if (!isActive(context) || isReadOnlyContext(context) || window.parent === window) return false;
    window.parent.postMessage({
      channel: SCENARIO_SHELL_CHANNEL,
      operation: "requestScenarioRerun",
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      sourceModule: "M04",
      requestedAt: new Date().toISOString(),
      payload
    }, window.location.origin);
    return true;
  }

  function openDashboardCandidate(candidate, context = readUrlContext()) {
    if (!candidate || !isActive(context) || isReadOnlyContext(context) || !sameScenario(candidate.scenarioIdentity, context)) return false;
    if (window.parent === window) return false;
    window.parent.postMessage({
      channel: SCENARIO_SHELL_CHANNEL,
      operation: "openS003DashboardCandidate",
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      sourceModule: "M04",
      candidateId: candidate.candidateId,
      actionTypeId: candidate.actionTypeId,
      enterpriseId: candidate.enterpriseId,
      requestedAt: new Date().toISOString()
    }, window.location.origin);
    return true;
  }

  function openEnterpriseReport(record, context = readUrlContext()) {
    const enterpriseId = record?.enterpriseId || record?.subjectId || record?.singleBusinessSubjectId || null;
    const recordContext = record?.scenarioContext || record?.scenarioIdentity || context;
    if (!enterpriseId || !isActive(context) || !sameScenario(recordContext, context)) return false;
    const reportId = record?.evidence?.reportId || record?.reportId || null;
    const exactRoute = record?.evidence?.reportRoute || record?.reportRoute || null;
    const query = new URLSearchParams({ enterpriseId, runId: context.scenarioRunId });
    if (reportId) query.set("reportId", reportId);
    let exactRouteMatches = false;
    if (typeof exactRoute === "string" && exactRoute.startsWith("#/reports/")) {
      const routeQuery = new URLSearchParams(exactRoute.split("?")[1] || "");
      exactRouteMatches = routeQuery.get("enterpriseId") === enterpriseId
        && routeQuery.get("runId") === context.scenarioRunId
        && (!reportId || routeQuery.get("reportId") === reportId);
    }
    const reportHash = exactRouteMatches ? exactRoute : `#/reports/view?${query}`;
    if (window.parent !== window) {
      window.parent.postMessage({
        channel: SCENARIO_SHELL_CHANNEL,
        operation: "navigateScenarioModule",
        moduleId: "report",
        hash: reportHash,
        scenarioId: context.scenarioId,
        scenarioVersion: context.scenarioVersion,
        scenarioRunId: context.scenarioRunId,
        sourceModule: "M04",
        enterpriseId,
        requestedAt: new Date().toISOString()
      }, window.location.origin);
      return true;
    }
    const pageQuery = new URLSearchParams({
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      scenarioContextFormedAt: context.formedAt || "",
      scenarioStatus: context.status || "active",
      enterpriseId
    });
    const href = `../../report-center/review-lifecycle/index.html?${pageQuery}${reportHash}`;
    if (typeof window.location.assign === "function") window.location.assign(href);
    else window.location.href = href;
    return true;
  }

  function displayTime(value) {
    if (!value) return "—";
    return String(value).replace("T", " ").replace(/\.\d{3}Z$/, "");
  }

  function actionTypeMeta(actionTypeId, resources) {
    const source = (resources?.actionTypeCatalog?.actionTypes || []).find((item) => item.actionTypeId === actionTypeId) || null;
    if (!source) return null;
    const trigger = String(source.triggerSummary || "").trim();
    const tier = trigger.match(/黄灯|红灯|黑灯/)?.[0] || "风险分档";
    return {
      ...source,
      // 旧 catalog 的 managementHint 只影响展示，不能让用户误解为
      // 集团管理员统一收件或需要多级审批；当前 S003 采用两阶段定向路由。
      description: `${tier}按亮灯形成一条预警候选；驾驶舱显式提交后直接送达对应成员单位接口人（债务风险）。`,
      managementHint: "接口人核实预警依据并选择本单位负责人后，沿用通用决策中心形成负责人待办；不经过集团管理员统一收件，不启动多级审批。"
    };
  }

  function actionTypeName(actionTypeId, resources) {
    return actionTypeMeta(actionTypeId, resources)?.displayName || actionTypeId;
  }

  function assertResourceContracts(resources, currentContext) {
    const identities = [
      resources.binding?.scenarioIdentity,
      resources.runtime?.scenarioIdentity,
      resources.results?.scenarioIdentity,
      resources.inbox?.scenarioIdentity,
      resources.routing?.scenarioIdentity,
      resources.riskResults?.scenarioIdentity,
      resources.publishedPointer?.scenarioIdentity,
      resources.actionTypeCatalog?.scenarioIdentity,
      resources.c017?.scenarioContext,
      resources.results?.confirmedDecision?.scenarioIdentity,
      resources.results?.confirmedDecision?.actionRequest?.scenarioIdentity,
      resources.results?.confirmedDecision?.todo?.scenarioIdentity
    ];
    if (!identities.every((identity) => sameScenario(currentContext, identity))) {
      throw new Error("S003 决策资源与当前 C033 场景运行身份不一致，已拒绝装入");
    }
    if (resources.inbox?.schemaVersion !== "ofw.s003.m04.manual-action-inbox.v2"
      || resources.inbox?.immutable !== true
      || resources.inbox?.submissionPolicy?.manualOnly !== true
      || resources.inbox?.submissionPolicy?.automaticCreation !== false
      || resources.inbox?.submissionPolicy?.requiresHumanConfirmation !== true
      || resources.inbox?.submissionPolicy?.multiLevelApproval !== false
      || resources.inbox?.submissionPolicy?.externalDispatch !== false
      || resources.inbox?.submissionPolicy?.recipientRoutingRequired !== true
      || resources.inbox?.submissionPolicy?.recipientRole !== "成员单位债务风险接口人"
      || resources.inbox?.submissionPolicy?.todoCreatedOnlyAfterRecipientConfirmation !== true
      || !Array.isArray(resources.inbox?.requests)
      || resources.inbox.requests.length !== 3) {
      throw new Error("S003 M04 人工提交行动申请投影不符合 C011 手工提交与人工判断边界");
    }
    const candidates = resources.results?.candidatesBeforeConfirmation || [];
    const candidatesById = new Map(candidates.map((item) => [item.candidateId, item]));
    const riskResultsByEnterprise = new Map((resources.riskResults?.results || []).map((item) => [item.enterprise?.enterpriseId, item]));
    if (!resources.inbox.requests.every((item) => {
      const candidate = candidatesById.get(item.candidateId);
      const result = riskResultsByEnterprise.get(item.subjectId);
      return sameScenario(resources.inbox.scenarioIdentity, item.scenarioIdentity)
        && item.status === "awaiting"
        && item.automatic === false
        && item.actionRequestImmutable === false
        && item.confirmationEligibility?.allowed === true
        && item.requestGate?.status === "accepted"
        && item.submittedBy === "集团债务风险管理人员"
        && item.owner === null
        && item.ownerId === null
        && item.decisionRecipient?.memberUnitId
        && item.decisionRecipient?.recipientId
        && item.decisionRecipient?.recipientName
        && item.decisionRecipient?.role === "成员单位债务风险接口人"
        && item.decision === null
        && item.taskId === null
        && candidate
        && result
        && item.id === `AR-${candidate.candidateId}`
        && item.requestId === item.id
        && item.sourceCandidateId === candidate.candidateId
        && item.subjectId === candidate.enterpriseId
        && item.sourceResultId === candidate.sourceResultId
        && item.sourceResultId === result.resultId
        && item.evidence?.snapshotId === result.resultId
        && item.actionType?.id === candidate.actionTypeId
        && item.idempotencyKey === candidate.idempotencyKey;
    })) {
      throw new Error("S003 M04 待决策行动申请缺少同轮身份、人工提交或确认门字段");
    }
    const routes = resources.routing?.routes || [];
    const routingByEnterprise = new Map(routes.map((item) => [item.enterpriseId, item]));
    const routingMemberUnits = new Set(routes.map((item) => item.memberUnitId));
    const routingRecipients = new Set(routes.map((item) => item.decisionRecipient?.recipientId));
    if (resources.routing?.schemaVersion !== "ofw.s003.m04.enterprise-contact-routing.v1"
      || resources.routing?.immutable !== true
      || resources.routing?.missingRoutePolicy !== "FAIL_CLOSED"
      || routes.length !== resources.riskResults?.enterpriseCount
      || routingByEnterprise.size !== resources.riskResults?.enterpriseCount
      || routingMemberUnits.size !== resources.riskResults?.enterpriseCount
      || routingRecipients.size !== resources.riskResults?.enterpriseCount
      || routes.some((item) => !item.enterpriseId || !item.enterpriseName || !item.memberUnitId || !item.memberUnitName
        || !item.decisionRecipient?.recipientId || !item.decisionRecipient?.recipientName
        || item.decisionRecipient?.role !== "成员单位债务风险接口人")
      || !resources.inbox.requests.every((item) => {
        const route = routingByEnterprise.get(item.subjectId);
        return route
          && route.memberUnitId === item.decisionRecipient.memberUnitId
          && route.decisionRecipient?.recipientId === item.decisionRecipient.recipientId;
      })) {
      throw new Error("S003 M04 成员单位接口人路由不完整，已拒绝回退给集团管理员");
    }
    const c017Projection = resources.c017?.projections?.find((item) => item.dataVersion === resources.riskResults?.inputIdentity?.dataAssetId);
    if (resources.c017?.schemaVersion !== 1
      || resources.c017?.resourceSchemaVersion !== "ofw.s003.m02.c017-decision-projection.v1"
      || resources.c017?.contractCode !== "C017"
      || resources.c017?.sourceModule !== "数据工程"
      || resources.c017?.consumer !== "决策中心"
      || resources.c017?.immutable !== true
      || resources.c017?.readStatus !== "ready"
      || !c017Projection
      || !["request_receipt", "confirmation_submit", "task_formation"].every((gate) => {
        const item = c017Projection.gates?.[gate];
        return item?.currentStateSummary?.id
          && item.currentStateSummary.version
          && item.currentStateSummary.formedAt
          && item.qualityStatus === "允许推进"
          && item.hardQualityFailure === false
          && item.evidenceLocator;
      })) {
      throw new Error("S003 M02 C017 决策最小安全投影不完整，已拒绝装入");
    }
    if (resources.binding?.schemaVersion !== "ofw.s003.m04.decision-binding.v2"
      || resources.binding?.bindingVersion !== "1.1.0"
      || resources.binding?.uiMode !== "reuse-generic-decision-center-no-dedicated-page"
      || resources.binding?.entry !== "Action Request"
      || resources.binding?.requiresHumanConfirmation !== true
      || resources.binding?.confirmationActor !== "成员单位债务风险接口人"
      || resources.binding?.todoCreatedOnlyAfterRecipientConfirmation !== true
      || resources.binding?.routing?.resourceRef !== "resources/m04/enterprise-contact-routing.v1.json"
      || resources.binding?.routing?.missingRoutePolicy !== "FAIL_CLOSED"
      || resources.binding?.routing?.fallbackToGroupAdministrator !== false
      || !resources.binding?.contracts?.includes("C017")
      || resources.binding?.automaticCreation !== false) {
      throw new Error(`S003 决策绑定不符合${GENERIC_WORKSPACE_LABEL}复用边界，已拒绝装入`);
    }
    if (resources.results?.immutable !== true
      || resources.results?.candidateSummary?.total !== 5
      || resources.results?.candidateSummary?.alertEnterpriseCount !== 5
      || resources.results?.candidateSummary?.oneAlertPerEnterprise !== true
      || resources.results?.candidateSummary?.actionRequestsCreated !== 4
      || resources.results?.candidateSummary?.todosCreated !== 1
      || resources.results?.candidateSummary?.notificationsDispatched !== 0
      || resources.results?.candidateSummary?.approvalsStarted !== 0) {
      throw new Error("S003 不可变决策结果或副作用计数不符合已确认快照，已拒绝装入");
    }
    if (resources.runtime?.schemaVersion !== "ofw.s003.m04.decision-runtime.v2"
      || resources.runtime?.runtimeVersion !== "1.1.0"
      || resources.runtime?.source?.resultSetId !== resources.riskResults?.resultSetId
      || resources.runtime?.source?.resultSetVersion !== resources.riskResults?.resultSetVersion
      || resources.runtime?.source?.schemaVersion !== resources.riskResults?.schemaVersion
      || resources.runtime?.source?.ref !== "resources/m01/c035-risk-results.v2.json"
      || !resources.runtime?.source?.sha256
      || resources.runtime?.binding?.ref !== "resources/m04/decision-binding.v2.json"
      || resources.runtime?.binding?.bindingId !== resources.binding?.bindingId
      || resources.runtime?.binding?.bindingVersion !== resources.binding?.bindingVersion
      || !resources.runtime?.binding?.sha256
      || resources.runtime?.sideEffects?.actionRequestCreatedAtDashboardSubmission !== true
      || resources.runtime?.sideEffects?.actionRequestCreatedOnlyAfterConfirmation !== false
      || resources.runtime?.sideEffects?.todoCreatedOnlyAfterConfirmation !== true) {
      throw new Error("S003 决策运行未绑定当前 Published C035 结果集，已拒绝装入");
    }
    const receipt = resources.results?.confirmedDecision;
    if (!receipt?.created
      || receipt?.sideEffects?.actionRequestCreated !== false
      || receipt?.sideEffects?.todoCreated !== true
      || receipt?.sideEffects?.notificationSent !== false
      || receipt?.sideEffects?.externalDispatch !== false
      || receipt?.actionRequest?.automatic !== false
      || receipt?.todo?.automatic !== false
      || receipt?.actionRequest?.decisionRecipient?.role !== "成员单位债务风险接口人"
      || receipt?.actionRequest?.confirmedBy !== receipt?.actionRequest?.decisionRecipient?.recipientName
      || !receipt?.todo?.owner
      || receipt?.todo?.owner === receipt?.actionRequest?.decisionRecipient?.recipientName
      || receipt?.actionRequest?.actionRequestId !== receipt?.todo?.actionRequestId) {
      throw new Error("S003 已确认 Action Request 与负责人待办快照不完整，已拒绝装入");
    }
    const target = resources.publishedPointer?.activeTarget;
    if (resources.publishedPointer?.status !== "active"
      || target?.lifecycleStatus !== "published"
      || !target?.packageId
      || !target?.packageVersion) {
      throw new Error("S003 Published 模型权威指针不可用，已拒绝装入");
    }
    const catalogBinding = resources.actionTypeCatalog?.publishedModelBinding;
    if (resources.actionTypeCatalog?.lifecycleStatus !== "published"
      || catalogBinding?.packageId !== target.packageId
      || catalogBinding?.packageVersion !== target.packageVersion
      || (resources.actionTypeCatalog?.actionTypes || []).length !== 3
      || (resources.actionTypeCatalog?.actionTypes || []).length !== (target.publishedSnapshot?.actionTypes || []).length) {
      throw new Error("S003 Published Action Type 展示目录与当前模型版本不一致，已拒绝装入");
    }
    if (candidates.length !== 5
      || new Set(candidates.map((item) => item.enterpriseId)).size !== 5
      || candidates.some((item) => !["YELLOW", "RED", "BLACK"].includes(item.riskTier)
        || item.trigger?.type !== "RISK_TIER"
        || item.actionTypeId === "S003_FACTOR_EMERGENCY"
        || item.actionTypeId !== ({ YELLOW: "S003_RISK_FOLLOW_UP", RED: "S003_SPECIAL_DISPOSAL", BLACK: "S003_EMERGENCY_RESPONSE" })[item.riskTier])) {
      throw new Error("S003 亮灯预警必须按黄灯、红灯、黑灯一企一条形成，已拒绝装入");
    }
    const actionRequestIds = [...resources.inbox.requests.map((item) => item.id), receipt?.actionRequest?.actionRequestId].filter(Boolean);
    if (actionRequestIds.length !== 4
      || new Set(actionRequestIds).size !== 4
      || resources.inbox.requests.some((item) => item.candidateId === receipt?.candidateId)) {
      throw new Error("S003 Action Request 数量或幂等身份不一致，已拒绝装入");
    }
  }

  function semanticPackage(resources) {
    const target = resources.publishedPointer.activeTarget;
    return {
      id: target.packageId,
      version: target.packageVersion,
      label: `${target.packageId} ${target.packageVersion}`
    };
  }

  function loadResources() {
    if (resourcePromise) return resourcePromise;
    moduleHealth = { status: "checking", detail: "S003 通用决策资源正在装载。", error: null };
    resourcePromise = Promise.all(Object.entries(RESOURCE_PATHS).map(async ([key, path]) => {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`${key} 读取失败（HTTP ${response.status}）`);
      return [key, await response.json()];
    })).then((entries) => {
      const resources = Object.fromEntries(entries);
      const context = readUrlContext();
      assertResourceContracts(resources, context);
      formalContractRecords.c017 = clone(resources.c017);
      moduleHealth = currentProjectionIssue
        ? { status: "warning", detail: `${currentProjectionIssue.reason}；正式决策结果仍可装入通用工作区。`, error: null }
        : { status: "healthy", detail: "基线通用决策工作区已装入 S003 Action Request 与负责人待办。", error: null };
      return resources;
    }).catch((error) => {
      moduleHealth = { status: "blocked", detail: error?.message || "S003 决策资源读取失败", error: error?.message || String(error) };
      throw error;
    });
    return resourcePromise;
  }

  async function loadCandidateSnapshot(context = readUrlContext()) {
    if (!isActive(context)) return null;
    const resources = await loadResources();
    assertResourceContracts(resources, context);
    const confirmed = resources.results?.confirmedDecision || null;
    return clone({
      scenarioIdentity: resources.results?.scenarioIdentity,
      resultSetId: resources.results?.resultSetId,
      resultSetVersion: resources.results?.resultSetVersion,
      formedAt: resources.results?.formedAt,
      assessmentAt: resources.results?.assessmentAt,
      summary: resources.results?.candidateSummary || {},
      candidates: resources.results?.candidatesBeforeConfirmation || [],
      pendingRequests: resources.inbox?.requests || [],
      confirmedCandidateId: confirmed?.candidateId || null,
      actionRequestId: confirmed?.actionRequest?.actionRequestId || null,
      todoId: confirmed?.todo?.todoId || null,
      sideEffects: resources.results?.sideEffects || null
    });
  }

  function nativeRequest(resources, currentContext) {
    const confirmed = resources.results.confirmedDecision;
    const source = confirmed?.actionRequest;
    if (!source) return null;
    const candidate = (resources.results.candidatesBeforeConfirmation || []).find((item) => item.candidateId === confirmed.candidateId) || {};
    const riskEvidence = riskEvidenceForRequest({ subjectId: source?.enterpriseId, evidence: { reportId: source?.reportId } }, resources);
    const semantic = semanticPackage(resources);
    const actionType = {
      id: source.actionTypeId,
      name: actionTypeName(source.actionTypeId, resources),
      description: actionTypeMeta(source.actionTypeId, resources)?.description || null,
      managementHint: actionTypeMeta(source.actionTypeId, resources)?.managementHint || null,
      version: semantic.version,
      status: "已发布"
    };
    const confirmedAt = displayTime(source.confirmedAt);
    const c017SafetyReads = clone(confirmed?.c017SafetyReads || []);
    const c017ReceiptRead = c017SafetyReads.find((item) => item.gate === "request_receipt") || null;
    const c017ReadAttempts = clone(confirmed?.c017ReadAttempts || {
      request_receipt: c017ReceiptRead ? 1 : 0,
      confirmation_submit: c017SafetyReads.some((item) => item.gate === "confirmation_submit") ? 1 : 0,
      task_formation: c017SafetyReads.some((item) => item.gate === "task_formation") ? 1 : 0
    });
    const reminderId = source.actionRequestId.replace(/^AR-/, "DR-");
    const taskId = source.todoId || confirmed.todo?.todoId;
    const recipient = normalizedDecisionRecipient(source) || normalizedDecisionRecipient(confirmed) || null;
    const formalDecision = confirmed?.decision || null;
    const taskOwner = formalDecision?.owner || confirmed?.todo?.owner || recommendedTaskOwner(source);
    const taskOwnerId = source.recommendedTaskOwnerId || null;
    return {
      id: source.actionRequestId,
      reminderId,
      subjectId: source.enterpriseId,
      subjectName: source.enterpriseName,
      scenario: "债务风险监测",
      scenarioContext: clone(currentContext),
      sourceType: "report",
      sourceRef: `债务风险仪表盘 · ${source.sourceResultId}`,
      requester: source.requester || confirmed.requester || "集团债务风险管理人员",
      submittedBy: source.submittedBy || source.requester || confirmed.requester || "集团债务风险管理人员",
      requestTime: confirmedAt,
      generatedTime: confirmedAt,
      actionType,
      rule: null,
      ruleApplicability: "不适用；本次为集团债务风险管理人员从仪表盘提交的亮灯预警",
      metric: {
        id: "MET-S003-FINAL-RISK-SCORE",
        name: "企业最终风险评分",
        value: `${source.finalScore} 分`,
        explanation: `${candidate.riskTierName || candidate.trigger?.tierName || "本轮风险评估"}预警已由对应成员单位接口人核实，并分办负责人落实改善措施。`,
        evaluatedAt: confirmedAt,
        scope: `${source.enterpriseName} · ${source.category}`
      },
      loanCount: 0,
      balance: "不适用",
      routingTarget: source.routingTarget ? clone(source.routingTarget) : recipient ? {
        type: "member-unit-decision-center",
        organizationId: recipient.memberUnitId,
        organizationName: recipient.memberUnitName
      } : null,
      decisionRecipient: clone(recipient),
      recipientRole: recipient?.role || null,
      recipientName: recipient?.recipientName || null,
      recipientId: recipient?.recipientId || null,
      recommendedTaskOwner: taskOwner,
      recommendedTaskOwnerId: taskOwnerId,
      owner: taskOwner,
      ownerId: taskOwnerId,
      recommendation: source.note,
      riskEvidence,
      banks: [],
      loans: [],
      evidence: {
        semanticVersion: semantic.label,
        dataVersion: resources.riskResults?.inputIdentity?.dataAssetVersion || "未定位",
        dataAssetId: resources.riskResults?.inputIdentity?.dataAssetId || "未定位",
        resultVersion: source.resultVersion,
        cutoff: source.assessmentAt,
        quality: c017ReceiptRead?.qualityStatus || "C017 接收安全回执未定位",
        qualitySource: c017ReceiptRead ? {
          contractCode: "C017",
          gate: c017ReceiptRead.gate,
          summaryId: c017ReceiptRead.summaryId,
          summaryVersion: c017ReceiptRead.summaryVersion,
          summaryFormedAt: c017ReceiptRead.summaryFormedAt,
          evidenceLocator: c017ReceiptRead.evidenceLocator
        } : null,
        availability: "已按正式运行证据固定",
        availableSections: ["企业风险评分", "风险分档", "Action Type", "人工确认回执"],
        missingItems: [],
        ready: "消费就绪",
        snapshotId: source.sourceResultId,
        freshness: "固定运行证据"
      },
      status: "confirmed",
      confirmationEligibility: { allowed: true, requiresAcknowledgement: false, reason: recipient?.recipientName ? `已由${recipient.recipientName}核实确认并分办` : "历史快照未记录成员单位接口人路由，当前仅按不可变结果只读展示" },
      sourceEvents: [],
      supplementRequests: [],
      duplicateRequests: [],
      c017SafetyReads,
      c017ReadAttempts,
      taskId,
      traceId: source.actionRequestId.replace(/^AR-/, "TR-"),
      requestGate: {
        status: "accepted",
        checkedAt: confirmedAt,
        reason: "从已有不可变决策结果只读装入；本次界面未重新接收或确认",
        reminderCreated: true
      },
      formation: {
        requestGateStatus: "accepted",
        requestGateCheckedAt: confirmedAt,
        requestGateReason: "已存在正式 Action Request 快照",
        reminderCreated: true,
        confirmationGateStatus: "passed",
        confirmationGateReason: "已存在人工确认回执与负责人待办快照"
      },
      decision: {
        type: formalDecision?.type || "confirm",
        reason: formalDecision?.reason || source.note,
        operator: formalDecision?.operator || source.confirmedBy || recipient?.recipientName || "历史快照未记录操作者",
        operatorRole: formalDecision?.operatorRole || recipient?.role || null,
        time: formalDecision?.time || confirmedAt,
        scenarioContext: clone(currentContext),
        owner: taskOwner,
        dueDate: formalDecision?.dueDate || "未设置",
        instructions: formalDecision?.instructions || source.note,
        banks: clone(formalDecision?.banks || [])
      },
      actionRequestImmutable: true,
      formationEvidenceImmutable: true,
      snapshotProjection: isReadOnlyContext(currentContext),
      projectionMode: isReadOnlyContext(currentContext) ? "historical-readonly" : "active-existing-result",
      sourceCandidateId: candidate.candidateId || confirmed.candidateId,
      sourceResultVersion: source.resultVersion
    };
  }

  function nativeTask(request, resources) {
    const source = resources.results.confirmedDecision?.todo;
    if (!request || !source) return null;
    const createdAt = displayTime(source.createdAt);
    return {
      id: source.todoId,
      requestId: request.id,
      reminderId: request.reminderId,
      subjectId: source.enterpriseId,
      subjectName: source.enterpriseName,
      sourceType: request.sourceType,
      scenarioContext: clone(request.scenarioContext),
      owner: source.owner,
      ownerId: request.recommendedTaskOwnerId || null,
      assignedBy: request.decision?.operator || decisionRecipientName(request) || null,
      title: `推进${source.enterpriseName}${actionTypeName(source.actionTypeId, resources)}`,
      actionType: clone(request.actionType),
      ruleLabel: request.rule ? `${request.rule.name} · ${request.rule.branch}` : "不适用",
      metricLabel: `${request.metric.name} ${request.metric.value}`,
      metricSnapshotId: request.evidence.snapshotId,
      semanticVersion: request.evidence.semanticVersion,
      dataVersion: request.evidence.dataVersion,
      cutoff: source.assessmentAt,
      sourceRef: request.sourceRef,
      createdAt,
      dueDate: request.decision.dueDate,
      status: "pending",
      overdue: false,
      instructions: source.note,
      banks: [],
      decisionReason: request.decision.reason,
      progress: [],
      history: [
        { time: request.decision.time, label: "成员单位接口人确认并交办", detail: `${request.decision?.operator || decisionRecipientName(request) || "接口人"} → ${source.owner}` },
        { time: createdAt, label: "负责人待办创建", detail: "沿用决策中心通用框架；未触发通知或审批" }
      ],
      sourceChanged: false,
      failure: null,
      result: null,
      correction: null,
      updateAttempts: 0,
      c017SafetyRead: clone(source.c017SafetyRead || resources.results.confirmedDecision?.c017SafetyReads?.find((item) => item.gate === "task_formation") || null),
      snapshotProjection: isReadOnlyContext(request.scenarioContext),
      projectionMode: isReadOnlyContext(request.scenarioContext) ? "historical-readonly" : "active-owner-todo"
    };
  }

  // Explicitly submitted C011 requests are seeded as a read-only source snapshot
  // and then projected into the generic active workbench. M04 never derives them
  // from disposition candidates and never creates notifications, approvals, or
  //负责人待办 until the ordinary human-decision flow is used.
  function riskEvidenceForRequest(item, resources) {
    const riskResult = (resources?.riskResults?.results || []).find((result) => result.enterprise?.enterpriseId === item?.subjectId || result.enterprise?.enterpriseId === item?.enterpriseId) || null;
    return riskResult ? {
      rawScore: riskResult.rawScore,
      factorSum: riskResult.factorSum,
      compositeAdjustment: riskResult.compositeAdjustment,
      finalScore: riskResult.finalScore,
      riskTier: clone(riskResult.riskTier),
      lowestIndicators: clone(riskResult.lowestThree || []),
      factors: clone(riskResult.factorResults || []),
      resultId: riskResult.resultId,
      resultVersion: riskResult.resultVersion,
      assessmentAt: riskResult.assessmentAt,
      reportId: item?.evidence?.reportId || null
    } : null;
  }

  function pendingReceiptState(item) {
    const reads = Array.isArray(item?.c017SafetyReads) ? clone(item.c017SafetyReads) : [];
    const receipt = [...reads].reverse().find((read) => read?.gate === "request_receipt") || null;
    const expectedT007 = item?.evidence?.dataAssetId || item?.evidence?.dataVersion || null;
    const complete = Boolean(receipt
      && receipt.t007
      && (!expectedT007 || receipt.t007 === expectedT007)
      && receipt.summaryId
      && receipt.summaryVersion
      && receipt.summaryFormedAt
      && receipt.readAt
      && receipt.qualityStatus
      && receipt.evidenceLocator
      && ["allowed", "rejected", "blocked", "read_failed"].includes(receipt.outcome));
    const outcome = complete ? receipt.outcome : "blocked";
    const allowed = outcome === "allowed"
      && receipt.hardFailure === "否"
      && ["允许推进", "可消费", "通过", "正常"].includes(receipt.qualityStatus);
    const rejected = outcome === "rejected" || receipt?.hardFailure === "是";
    return {
      reads,
      receipt,
      complete,
      allowed,
      rejected,
      status: allowed ? "accepted" : rejected ? "rejected" : "blocked",
      reason: allowed
        ? receipt.reason
        : rejected
          ? receipt?.reason || "C017 接收安全回执明确拒绝推进"
          : complete
            ? receipt?.reason || "C017 接收安全回执状态未知"
            : "C017 request_receipt 最小安全读取回执不完整，按保守原则阻断"
    };
  }

  function nativePendingRequests(resources, currentContext) {
    return (resources.inbox?.requests || []).map((item) => {
      const actionMeta = actionTypeMeta(item.actionType?.id, resources);
      const riskEvidence = riskEvidenceForRequest(item, resources);
      const safety = pendingReceiptState(item);
      const recipient = normalizedDecisionRecipient(item);
      const routeReady = Boolean(recipient?.memberUnitId && recipient?.recipientId && recipient?.recipientName && recipient?.role);
      const taskOwner = recommendedTaskOwner(item);
      const requestGate = safety.allowed ? clone(item.requestGate) : {
        status: safety.status,
        checkedAt: safety.receipt?.readAt || item.requestGate?.checkedAt || null,
        reason: safety.reason,
        reminderCreated: false
      };
      const formation = safety.allowed ? clone(item.formation) : {
        requestGateStatus: safety.status,
        requestGateCheckedAt: requestGate.checkedAt,
        requestGateReason: safety.reason,
        reminderCreated: false,
        confirmationGateStatus: "not_reached",
        confirmationGateReason: "C017 接收安全门未通过，未到达人工确认"
      };
      const confirmationEligibility = safety.allowed
        ? clone(item.confirmationEligibility)
        : { allowed: false, requiresAcknowledgement: false, reason: safety.reason };
      return {
        ...clone(item),
        scenarioContext: clone(currentContext),
        actionType: {
          ...clone(item.actionType || {}),
          name: actionMeta?.displayName || item.actionType?.name || item.actionType?.id,
          description: actionMeta?.description || null,
          managementHint: actionMeta?.managementHint || item.actionType?.managementHint || null
        },
        projectionOnly: false,
        projectionMode: isReadOnlyContext(currentContext) ? "historical-readonly" : "active-submitted-request",
        snapshotProjection: isReadOnlyContext(currentContext),
        status: safety.allowed ? item.status : safety.rejected ? "rejected_by_gate" : "c017_blocked",
        evidence: {
          ...clone(item.evidence || {}),
          quality: safety.receipt?.qualityStatus || "C017 接收安全回执未定位",
          qualitySource: safety.receipt ? {
            contractCode: "C017",
            gate: safety.receipt.gate,
            summaryId: safety.receipt.summaryId,
            summaryVersion: safety.receipt.summaryVersion,
            summaryFormedAt: safety.receipt.summaryFormedAt,
            evidenceLocator: safety.receipt.evidenceLocator
          } : null,
          ready: safety.allowed ? "C017 接收安全门通过" : "C017 接收安全门未通过",
          freshness: safety.receipt?.summaryFormedAt ? `C017 摘要形成于 ${safety.receipt.summaryFormedAt}` : "C017 当前状态不可确认"
        },
        riskEvidence,
        requestGate,
        formation,
        confirmationEligibility,
        c017SafetyReads: safety.reads,
        c017ReadAttempts: clone(item.c017ReadAttempts || { request_receipt: safety.receipt ? 1 : 0, confirmation_submit: 0, task_formation: 0 }),
        blockReason: safety.allowed ? null : safety.reason,
        recovery: safety.allowed ? null : "保留原 Action Request 与历史投影；取得同一 scenarioRunId、精确数据版本的 C017 接收回执后再形成新的当前工作投影。",
        actionRequestImmutable: false,
        automatic: false,
        requester: item.requester || item.submittedBy || "集团债务风险管理人员",
        submittedBy: item.submittedBy || "集团债务风险管理人员",
        routingTarget: item.routingTarget ? clone(item.routingTarget) : recipient ? {
          type: "member-unit-decision-center",
          organizationId: recipient.memberUnitId,
          organizationName: recipient.memberUnitName
        } : null,
        decisionRecipient: clone(recipient),
        recipientRole: recipient?.role || null,
        recipientName: recipient?.recipientName || null,
        recipientId: recipient?.recipientId || null,
        routingStatus: routeReady ? "member-unit-recipient-ready" : "legacy-route-unresolved",
        recommendedTaskOwner: taskOwner,
        recommendedTaskOwnerId: item.recommendedTaskOwnerId || null,
        owner: null,
        ownerId: null,
        sourceEvents: Array.isArray(item.sourceEvents) ? clone(item.sourceEvents) : [],
        decision: null,
        taskId: null,
        taskCreating: false,
      };
    });
  }

  function pendingRecordMatches(existing, seed) {
    if (!existing || !seed) return false;
    const existingBase = clone(existing);
    const seedBase = clone(seed);
    // Human decision and task fields are mutable generic-workbench projection
    // state; compare only the immutable Action Request source identity.
    existingBase.decision = null;
    existingBase.taskId = null;
    existingBase.taskCreating = false;
    seedBase.decision = null;
    seedBase.taskId = null;
    seedBase.taskCreating = false;
    return immutableRecordMatches(existingBase, seedBase, "request");
  }

  function requestReceiptFingerprint(record) {
    const read = [...(record?.c017SafetyReads || [])].reverse().find((item) => item?.gate === "request_receipt") || null;
    if (!read) return null;
    return JSON.stringify({
      t007: read.t007 || null,
      summaryId: read.summaryId || null,
      summaryVersion: read.summaryVersion || null,
      summaryFormedAt: read.summaryFormedAt || null,
      readAt: read.readAt || null,
      qualityStatus: read.qualityStatus || null,
      hardFailure: read.hardFailure || null,
      evidenceLocator: read.evidenceLocator || null,
      outcome: read.outcome || null
    });
  }

  function pendingReceiptAligned(existing, seed) {
    return requestReceiptFingerprint(existing) === requestReceiptFingerprint(seed)
      && existing?.evidence?.qualitySource?.summaryId === seed?.evidence?.qualitySource?.summaryId;
  }

  function pendingPresentationAligned(existing, seed) {
    return existing?.recommendation === seed?.recommendation
      && existing?.sourceRef === seed?.sourceRef
      && existing?.ruleApplicability === seed?.ruleApplicability
      && existing?.actionType?.name === seed?.actionType?.name
      && existing?.actionType?.description === seed?.actionType?.description
      && existing?.metric?.name === seed?.metric?.name
      && existing?.metric?.explanation === seed?.metric?.explanation;
  }

  function pendingRecordProgressed(record) {
    return Boolean(record?.decision || record?.taskId || ["confirmed", "decision_saved", "create_failed"].includes(record?.status));
  }

  function mergePendingSeed(existing, seed) {
    const progressed = pendingRecordProgressed(existing);
    return {
      ...existing,
      sourceRef: seed.sourceRef || existing.sourceRef,
      requester: seed.requester || existing.requester,
      submittedBy: seed.submittedBy || existing.submittedBy || existing.requester,
      actionType: clone(seed.actionType || existing.actionType || {}),
      metric: clone(seed.metric || existing.metric || {}),
      recommendation: seed.recommendation || existing.recommendation,
      ruleApplicability: seed.ruleApplicability || existing.ruleApplicability,
      routingTarget: clone(seed.routingTarget || null),
      decisionRecipient: clone(seed.decisionRecipient || null),
      recipientRole: seed.recipientRole || null,
      recipientName: seed.recipientName || null,
      recipientId: seed.recipientId || null,
      routingStatus: seed.routingStatus || null,
      recommendedTaskOwner: seed.recommendedTaskOwner || existing.recommendedTaskOwner || existing.owner,
      recommendedTaskOwnerId: seed.recommendedTaskOwnerId || existing.recommendedTaskOwnerId || null,
      owner: progressed ? existing.owner || seed.owner || null : null,
      ownerId: progressed ? existing.ownerId || seed.ownerId || null : null,
      evidence: {
        ...(existing?.evidence || {}),
        quality: seed.evidence?.quality,
        qualitySource: clone(seed.evidence?.qualitySource || null),
        ready: seed.evidence?.ready,
        freshness: seed.evidence?.freshness,
        reportId: seed.evidence?.reportId || existing.evidence?.reportId || null,
        contentVersion: seed.evidence?.contentVersion || existing.evidence?.contentVersion || null,
        artifactVersion: seed.evidence?.artifactVersion || existing.evidence?.artifactVersion || null,
        artifactSha256: seed.evidence?.artifactSha256 || existing.evidence?.artifactSha256 || null,
        reportRoute: seed.evidence?.reportRoute || existing.evidence?.reportRoute || null
      },
      c017SafetyReads: clone(seed.c017SafetyReads || []),
      c017ReadAttempts: {
        ...(seed.c017ReadAttempts || {}),
        ...(existing?.c017ReadAttempts || {})
      },
      ...(progressed ? {} : {
        status: seed.status,
        requestGate: clone(seed.requestGate),
        formation: clone(seed.formation),
        confirmationEligibility: clone(seed.confirmationEligibility),
        blockReason: seed.blockReason || null,
        recovery: seed.recovery || null
      })
    };
  }

  function mergeFormalRequestEvidence(existing, expected) {
    return {
      ...existing,
      requester: expected.requester || existing.requester,
      submittedBy: expected.submittedBy || existing.submittedBy || existing.requester,
      routingTarget: clone(expected.routingTarget || null),
      decisionRecipient: clone(expected.decisionRecipient || null),
      recipientRole: expected.recipientRole || null,
      recipientName: expected.recipientName || null,
      recipientId: expected.recipientId || null,
      recommendedTaskOwner: expected.recommendedTaskOwner || existing.recommendedTaskOwner || existing.owner,
      recommendedTaskOwnerId: expected.recommendedTaskOwnerId || existing.recommendedTaskOwnerId || null,
      evidence: {
        ...(existing?.evidence || {}),
        quality: expected.evidence?.quality,
        qualitySource: clone(expected.evidence?.qualitySource || null),
        reportId: expected.evidence?.reportId || existing.evidence?.reportId || null,
        contentVersion: expected.evidence?.contentVersion || existing.evidence?.contentVersion || null,
        artifactVersion: expected.evidence?.artifactVersion || existing.evidence?.artifactVersion || null,
        artifactSha256: expected.evidence?.artifactSha256 || existing.evidence?.artifactSha256 || null,
        reportRoute: expected.evidence?.reportRoute || existing.evidence?.reportRoute || null
      },
      c017SafetyReads: clone(expected.c017SafetyReads || []),
      c017ReadAttempts: clone(expected.c017ReadAttempts || {})
    };
  }

  function mergeFormalTaskEvidence(existing, expected) {
    return {
      ...existing,
      c017SafetyRead: clone(expected.c017SafetyRead || null)
    };
  }

  function normalizeCurrentActionCopy(value) {
    if (typeof value !== "string") return value;
    return value
      .replaceAll("集团风险管理员统一收件后再分办", "集团债务风险管理人员从驾驶舱提交后直接送达对应成员单位接口人，接口人确认后再分办本单位负责人")
      .replaceAll("集团债务风险管理员统一收件后再分办", "集团债务风险管理人员从驾驶舱提交后直接送达对应成员单位接口人，接口人确认后再分办本单位负责人")
      .replaceAll("集团债务风险管理人员统一收件后再分办", "集团债务风险管理人员从驾驶舱提交后直接送达对应成员单位接口人，接口人确认后再分办本单位负责人")
      .replaceAll("集团管理员统一收件后再分办", "集团债务风险管理人员从驾驶舱提交后直接送达对应成员单位接口人，接口人确认后再分办本单位负责人")
      .replaceAll("集团风险管理员统一接收", "对应成员单位接口人接收并确认")
      .replaceAll("集团债务风险管理员统一接收", "对应成员单位接口人接收并确认")
      .replaceAll("集团债务风险管理人员统一接收", "对应成员单位接口人接收并确认")
      .replaceAll("集团风险管理员", "集团债务风险管理人员")
      .replaceAll("集团债务风险管理员", "集团债务风险管理人员");
  }

  function normalizeActiveRequestPresentation(record) {
    const next = clone(record);
    if (next.recommendation) next.recommendation = normalizeCurrentActionCopy(next.recommendation);
    if (next.ruleApplicability) next.ruleApplicability = normalizeCurrentActionCopy(next.ruleApplicability);
    const actionId = next.actionType?.id || next.actionTypeId || "";
    const actionTier = ({
      S003_RISK_FOLLOW_UP: "黄灯",
      S003_SPECIAL_DISPOSAL: "红灯",
      S003_EMERGENCY_RESPONSE: "黑灯"
    })[actionId];
    if (actionTier) {
      next.actionType = {
        ...next.actionType,
        description: `${actionTier}按亮灯形成一条预警候选；驾驶舱显式提交后直接送达对应成员单位接口人（债务风险）。`,
        managementHint: "接口人核实预警依据并选择本单位负责人后，沿用通用决策中心形成负责人待办；不经过集团管理员统一收件，不启动多级审批。"
      };
    } else if (next.actionType?.description) {
      next.actionType.description = normalizeCurrentActionCopy(next.actionType.description);
    }
    if (next.metric?.explanation) next.metric.explanation = normalizeCurrentActionCopy(next.metric.explanation);
    return next;
  }

  async function hydrateNativeState(baseState) {
    if (!isActive(baseState?.scenarioContext)) return baseState;
    const resources = await loadResources();
    const identity = resources.results?.scenarioIdentity;
    if (!sameScenario(baseState?.scenarioContext, identity)) {
      return {
        ...baseState,
        scenarioBootstrap: {
          kind: "isolated-run-no-replay",
          sourceScenarioRunId: identity?.scenarioRunId || null,
          scenarioRunId: baseState?.scenarioContext?.scenarioRunId || null,
          actionRequestCount: 0,
          todoCount: 0,
          notificationsDispatched: 0,
          approvalsStarted: 0,
          historicalReplayAllowed: false,
          regressionReplayAllowed: false
        }
      };
    }
    assertResourceContracts(resources, baseState?.scenarioContext);
    const bootstrapId = resources.results.resultSetId;
    const pendingRequests = nativePendingRequests(resources, baseState.scenarioContext);
    const rawRequests = Array.isArray(baseState.requests) ? baseState.requests : [];
    const activeRequestPresentationMigrations = isReadOnlyContext(baseState.scenarioContext) ? [] : rawRequests.map((existing) => {
      const normalized = normalizeActiveRequestPresentation(existing);
      return JSON.stringify(normalized) === JSON.stringify(existing)
        ? null
        : {
            id: existing.id || existing.requestId || null,
            before: {
              recommendation: existing.recommendation || null,
              actionTypeDescription: existing.actionType?.description || null,
              metricExplanation: existing.metric?.explanation || null
            },
            after: {
              recommendation: normalized.recommendation || null,
              actionTypeDescription: normalized.actionType?.description || null,
              metricExplanation: normalized.metric?.explanation || null
            }
          };
    }).filter(Boolean);
    const requests = activeRequestPresentationMigrations.length
      ? rawRequests.map((item) => normalizeActiveRequestPresentation(item))
      : rawRequests;
    const pendingOwnerMigrationRequired = pendingRequests.some((seed) => {
      const existing = requests.find((item) => item.id === seed.id);
      return Boolean(existing && !pendingRecordProgressed(existing) && (existing.owner != null || existing.ownerId != null));
    });
    const pendingPresentationMigrations = isReadOnlyContext(baseState.scenarioContext) ? [] : pendingRequests.map((seed) => {
      const existing = requests.find((item) => item.id === seed.id);
      return existing && pendingRecordMatches(existing, seed) && !pendingPresentationAligned(existing, seed)
        ? {
            id: existing.id,
            before: {
              recommendation: existing.recommendation || null,
              actionTypeName: existing.actionType?.name || null,
              actionTypeDescription: existing.actionType?.description || null,
              metricExplanation: existing.metric?.explanation || null
            },
            after: {
              recommendation: seed.recommendation || null,
              actionTypeName: seed.actionType?.name || null,
              actionTypeDescription: seed.actionType?.description || null,
              metricExplanation: seed.metric?.explanation || null
            }
          }
        : null;
    }).filter(Boolean);
    const pendingPresentationMigrationRequired = pendingPresentationMigrations.length > 0;
    const alreadyBootstrapped = baseState?.scenarioBootstrap?.resultSetId === bootstrapId
      && baseState?.scenarioBootstrap?.scenarioRunId === identity.scenarioRunId
      && pendingRequests.every((item) => requests.some((existing) => existing.id === item.id && pendingReceiptAligned(existing, item)));
    const request = nativeRequest(resources, baseState.scenarioContext);
    const task = nativeTask(request, resources);
    const tasks = Array.isArray(baseState.tasks) ? baseState.tasks : [];
    const existingRequest = request ? requests.find((item) => item.id === request.id) || null : null;
    const existingTask = task ? tasks.find((item) => item.id === task.id) || null : null;
    const requestCompatible = existingRequest ? immutableRecordMatches(existingRequest, request, "request") : false;
    const taskCompatible = existingTask ? immutableRecordMatches(existingTask, task, "task") : false;
    const pendingIncompatible = pendingRequests.map((seed) => {
      const existing = requests.find((item) => item.id === seed.id);
      return existing && !pendingRecordMatches(existing, seed)
        ? { kind: "待决策 Action Request", id: existing.id, record: clone(existing) }
        : null;
    }).filter(Boolean);
    const incompatibleRecords = [
      existingRequest && !requestCompatible ? { kind: "Action Request", id: existingRequest.id, record: clone(existingRequest) } : null,
      existingTask && !taskCompatible ? { kind: "负责人待办", id: existingTask.id, record: clone(existingTask) } : null,
      ...pendingIncompatible,
    ].filter(Boolean);
    if (alreadyBootstrapped
      && !pendingOwnerMigrationRequired
      && !pendingPresentationMigrationRequired
      && !activeRequestPresentationMigrations.length
      && !incompatibleRecords.length
      && (!request || (existingRequest && existingTask))) return baseState;
    const formedAt = displayTime(resources.results.formedAt);
    const nextRequests = pendingRequests.reduce((list, seed) => {
      const existing = list.find((item) => item.id === seed.id);
      if (!existing) return [seed, ...list];
      if (pendingIncompatible.some((item) => item.id === seed.id)) {
        return list.map((item) => item.id === seed.id ? seed : item);
      }
      return list.map((item) => item.id === seed.id ? mergePendingSeed(item, seed) : item);
    }, requests);
    return {
      ...baseState,
      stateRevision: Number(baseState.stateRevision || 0) + 1,
      requests: request ? (existingRequest
        ? nextRequests.map((item) => item.id === request.id ? (requestCompatible ? mergeFormalRequestEvidence(item, request) : request) : item)
        : [request, ...nextRequests]) : nextRequests,
      tasks: task ? (existingTask
        ? tasks.map((item) => item.id === task.id ? (taskCompatible ? mergeFormalTaskEvidence(item, task) : task) : item)
        : [task, ...tasks]) : tasks,
      auditHistory: [
        ...(baseState.auditHistory || []),
        ...(incompatibleRecords.length ? [{
          archivedAt: new Date().toISOString(),
          reason: "同标识工作投影与不可变正式决策结果指纹不一致，已隔离并恢复正式记录",
          scenarioContext: clone(baseState.scenarioContext),
          records: incompatibleRecords
        }] : []),
        ...(pendingPresentationMigrationRequired ? [{
          archivedAt: new Date().toISOString(),
          reason: "旧版当前工作投影的行动展示文案已按同一 C011 正式来源刷新；人工决定、负责人待办和历史证据保持不变",
          scenarioContext: clone(baseState.scenarioContext),
          records: clone(pendingPresentationMigrations)
        }] : []),
        ...(activeRequestPresentationMigrations.length ? [{
          archivedAt: new Date().toISOString(),
          reason: "旧版当前 C011 工作投影的角色展示文案已显式迁移为集团提交、成员单位接口人确认分办；人工决定、负责人待办和历史证据保持不变",
          scenarioContext: clone(baseState.scenarioContext),
          records: clone(activeRequestPresentationMigrations)
        }] : [])
      ],
      activity: alreadyBootstrapped ? (baseState.activity || []) : [
        { time: formedAt, label: "读取 S003 决策链结果", detail: `${isReadOnlyContext(baseState.scenarioContext) ? "以历史只读方式" : "作为当前运行记录"}装入既有 1 条已由成员单位接口人确认的 Action Request、${pendingRequests.length} 条待对应接口人核实的 Action Request 与 1 条负责人待办；其余亮灯预警仍在驾驶舱等待提交。`, scenarioContext: clone(baseState.scenarioContext) },
        ...(baseState.activity || [])
      ],
      scenarioBootstrap: {
        kind: isReadOnlyContext(baseState.scenarioContext) ? "immutable-snapshot-projection" : "active-generic-decision-binding",
        resultSetId: bootstrapId,
        resultSetVersion: resources.results.resultSetVersion,
        scenarioRunId: identity.scenarioRunId,
        candidateCount: resources.results.candidateSummary?.total || 0,
        unconfirmedCandidateCount: resources.results.candidateSummary?.awaitingHumanConfirmation || 0,
        actionRequestCount: (request ? 1 : 0) + pendingRequests.length,
        confirmedActionRequestCount: request ? 1 : 0,
        pendingDecisionRequestCount: pendingRequests.length,
        todoCount: task ? 1 : 0,
        notificationsDispatched: 0,
        approvalsStarted: 0,
        formedAt: resources.results.formedAt,
        actionRequestEvidenceImmutable: true,
        taskOperationsReadOnly: isReadOnlyContext(baseState.scenarioContext),
        readOnlySource: isReadOnlyContext(baseState.scenarioContext)
      }
    };
  }

  window.S003DecisionAdapter = Object.freeze({
    STORAGE_SCOPE,
    STORAGE_KEYS,
    RECOVERY_STORAGE_KEYS,
    isActive,
    isReadOnlyContext,
    physicalKey,
    recoveryPhysicalKey,
    readRecord,
    writeRecord,
    removeRecord,
    readContractRecord,
    writeContractRecord,
    getProjectionIssue,
    getHealth: () => ({
      moduleId: "M04",
      ...clone(moduleHealth),
      projectionIssue: getProjectionIssue(),
      scenarioContext: clone(readUrlContext()),
      acceptanceReady: false
    }),
    markProjectionIssue,
    immutableFingerprint,
    immutableRecordMatches,
    normalizeCurrentActionCopy,
    normalizeActiveRequestPresentation,
    requestScenarioRerun,
    openDashboardCandidate,
    openEnterpriseReport,
    loadCandidateSnapshot,
    hydrateNativeState
  });
})();
