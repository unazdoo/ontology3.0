const { useCallback, useEffect, useMemo, useState } = React;

const DC_UI_VARIANT = window.DC_VARIANT || "queue";
const DC_VIEW_STORAGE_KEY = `ontology3-decision-center-view-v2-${DC_UI_VARIANT}`;
const DECISION_CHANGE_STATUSES = ["blocked", "stale", "missing_evidence", "rejected_by_gate", "create_failed", "replaced", "withdrawn"];
const OPERATIONS_ATTENTION_STATUSES = ["awaiting", ...DECISION_CHANGE_STATUSES, "supplement_requested"];
const PORTFOLIO_TASK_CATEGORIES = ["assigned", "pending", "in_progress", "overdue", "execution_failed", "correcting"];
const PORTFOLIO_TASK_CATEGORY_META = {
  assigned: { label: "待承接", icon: "UserRoundCheck" },
  pending: { label: "待开始", icon: "CircleDashed" },
  in_progress: { label: "处理中", icon: "LoaderCircle" },
  overdue: { label: "已逾期", icon: "AlarmClock" },
  execution_failed: { label: "执行失败", icon: "CircleX" },
  correcting: { label: "纠正中", icon: "RefreshCw" },
};
const PORTFOLIO_EXCEPTION_META = {
  request_validation: { label: "请求校验异常", description: "未通过请求校验", icon: "ShieldX" },
  evidence_exception: { label: "证据异常", description: "关键证据缺失、版本不兼容或证据陈旧", icon: "FileWarning" },
  withdrawal_replacement: { label: "撤回或替代", description: "上游撤回、纠正或形成替代请求", icon: "Replace" },
  assignment_creation: { label: "交办创建异常", description: "人工确认已保存，但负责人待办未创建", icon: "ListX" },
};
const C017_GATE_META = {
  request_receipt: { label: "行动申请接收前", next: "形成决策事项" },
  confirmation_submit: { label: "人工确认提交前", next: "保存人工确认" },
  task_formation: { label: "负责人待办形成前", next: "创建负责人待办" },
};

function c017OutcomeMeta(outcome) {
  return {
    allowed: { label: "允许推进", tone: "success", icon: "ShieldCheck" },
    rejected: { label: "拒绝推进", tone: "danger", icon: "ShieldX" },
    blocked: { label: "状态未知，已阻断", tone: "warning", icon: "ShieldAlert" },
    read_failed: { label: "权威读取失败，已阻断", tone: "danger", icon: "CloudOff" },
  }[outcome] || { label: "未读取", tone: "neutral", icon: "CircleDashed" };
}

function latestC017Read(request, gate) {
  return [...(request?.c017SafetyReads || [])].reverse().find((item) => !gate || item.gate === gate) || null;
}

function sameScenarioContext(left, right) {
  return Boolean(left && right && ["scenarioId", "scenarioVersion", "scenarioRunId"].every((key) => left[key] && left[key] === right[key]));
}

const C011_CONTRACT_FINGERPRINT_VERSION = "c011-v2:";

function c011CanonicalValue(value) {
  if (Array.isArray(value)) return value.map(c011CanonicalValue);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => {
    if (typeof value[key] !== "undefined") result[key] = c011CanonicalValue(value[key]);
    return result;
  }, {});
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return typeof value === "undefined" ? null : value;
}

function c011IdempotencyKey(payload) {
  const context = normalizedScenarioContext(payload?.scenarioContext || payload);
  const evidence = payload?.evidence || {};
  return [context.scenarioId, context.scenarioRunId, payload?.id || payload?.requestId, evidence.semanticVersion || payload?.semanticVersion, evidence.dataVersion || payload?.dataVersion].join("|");
}

function c011ContractFingerprint(payload) {
  const context = normalizedScenarioContext(payload?.scenarioContext || payload);
  const evidence = payload?.evidence || {};
  const actionType = payload?.actionType && typeof payload.actionType === "object" ? payload.actionType : {};
  const rule = payload?.rule || null;
  const metric = payload?.metric || payload?.metricEvidence || {};
  const semanticVersion = evidence.semanticVersion || payload?.semanticVersion || null;
  const dataVersion = evidence.dataVersion || payload?.dataVersion || null;
  const subjectId = payload?.subjectId || payload?.singleBusinessSubjectId || null;
  const subjectName = payload?.subjectName || payload?.singleBusinessSubjectName || payload?.singleBusinessSubject || payload?.unit || null;
  const banks = Array.isArray(payload?.banks) ? payload.banks : [];
  const loans = Array.isArray(payload?.loans) ? payload.loans : [];
  const snapshot = {
    scenarioContext: {
      scenarioId: context.scenarioId,
      scenarioVersion: context.scenarioVersion,
      scenarioRunId: context.scenarioRunId,
      formedAt: context.formedAt,
      status: context.status,
      source: context.source,
    },
    requestId: payload?.id || payload?.requestId || null,
    scenario: payload?.scenario || payload?.scenarioName || "集团融资成本与债务结构优化",
    source: {
      type: payload?.sourceType || null,
      typeLabel: payload?.sourceTypeLabel || null,
      ref: payload?.sourceRef || payload?.sourceId || "来源记录",
      record: payload?.sourceRecord || null,
      scene: payload?.sourceScene || null,
      requester: payload?.requester || SOURCE_META[payload?.sourceType]?.label || "获准来源",
      initiator: payload?.initiator || null,
      requesterId: payload?.initiatorId || null,
      requestTime: payload?.requestTime || payload?.createdAt || null,
    },
    subject: {
      id: subjectId,
      name: subjectName,
      objectType: payload?.subjectObjectType || payload?.singleBusinessSubjectObjectType || null,
    },
    actionType: {
      id: actionType.id || payload?.actionTypeId || null,
      name: actionType.name || (typeof payload?.actionType === "string" ? payload.actionType : null),
      version: actionType.version || payload?.actionTypeVersion || null,
      status: actionType.status || null,
      publishedSemanticVersion: actionType.publishedSemanticVersion || payload?.actionTypePublishedSemanticVersion || semanticVersion,
    },
    rule: rule ? {
      id: rule.id || payload?.ruleId || null,
      code: rule.code || payload?.ruleCode || null,
      name: rule.name || payload?.ruleName || null,
      version: rule.version || payload?.ruleVersion || null,
      publishedSemanticVersion: rule.publishedSemanticVersion || payload?.rulePublishedSemanticVersion || semanticVersion,
      evaluationId: rule.evaluationId || payload?.ruleEvaluationId || null,
      evaluatedAt: rule.evaluatedAt || payload?.ruleEvaluatedAt || null,
      resultVersion: rule.resultVersion || payload?.ruleResultVersion || null,
      branch: rule.branch || payload?.ruleBranch || null,
      hitEvidence: rule.hitEvidence || null,
      evidence: payload?.ruleEvidence || null,
    } : null,
    metric: {
      id: metric.id || payload?.metricId || null,
      name: metric.name || null,
      value: metric.value ?? null,
      unit: metric.unit || null,
      explanation: metric.explanation || metric.triggerExplanation || null,
      evaluatedAt: metric.evaluatedAt || null,
      scope: metric.scope || null,
      snapshot: payload?.metricSnapshot || null,
      resultVersion: metric.resultVersion || payload?.metricResultVersion || null,
      evidenceRefs: metric.evidenceRefs || payload?.metricEvidenceRefs || null,
    },
    assignment: {
      owner: payload?.owner || "集团资金管理岗",
      recommendation: payload?.recommendation || `核实${subjectName || "当前主体"}的融资异常并形成受控优化方案`,
      recommendedDirection: payload?.recommendedDirection || null,
    },
    targets: {
      banks,
      loans,
      loanCount: Number.isFinite(Number(payload?.loanCount)) ? Number(payload.loanCount) : loans.length,
      preferredInstitutions: payload?.preferredInstitutions || null,
      candidateLoans: payload?.candidateLoans || null,
    },
    evidence: {
      snapshotId: evidence.snapshotId || payload?.fixedResultId || null,
      cutoff: evidence.cutoff || payload?.asOf || null,
      semanticVersion,
      declaredSemanticVersion: payload?.semanticVersion || null,
      semanticVersionId: evidence.semanticVersionId || payload?.semanticVersionId || null,
      dataVersion,
      declaredDataVersion: payload?.dataVersion || null,
      dataAssetVersionId: evidence.dataAssetVersionId || payload?.dataAssetVersionId || null,
      quality: evidence.quality || null,
      freshness: evidence.freshness || null,
      evidenceIds: evidence.evidenceIds || payload?.evidenceIds || null,
      ruleEvidenceId: evidence.ruleEvidenceId || payload?.ruleEvidenceId || null,
      t019EvidenceCode: evidence.t019EvidenceCode || payload?.t019EvidenceCode || null,
      bindingId: payload?.bindingId || null,
      consumableVersionId: payload?.consumableVersionId || null,
      trustSnapshot: payload?.currentTrustSnapshot || null,
      trustReadAt: payload?.currentTrustReadAt || null,
      fingerprint: payload?.evidenceFingerprint || null,
      allowUncertainResult: payload?.allowUncertainResult ?? null,
    },
    navigation: {
      returnRoute: payload?.returnRoute || null,
      filter: payload?.filter || null,
      returnPosition: payload?.returnPosition || null,
    },
  };
  return `${C011_CONTRACT_FINGERPRINT_VERSION}${JSON.stringify(c011CanonicalValue(snapshot))}`;
}

function storedC011ContractFingerprint(request) {
  const stored = request?.contractFingerprint;
  return typeof stored === "string" && stored.startsWith(C011_CONTRACT_FINGERPRINT_VERSION)
    ? stored
    : c011ContractFingerprint(request);
}

function findC011RequestByStableId(data, requestId) {
  const currentRequest = (data?.requests || []).find((item) => item?.id === requestId);
  if (currentRequest) {
    const task = (data?.tasks || []).find((item) => item?.requestId === requestId) || null;
    return { request: currentRequest, task, historical: false, archivedAt: null, archiveScenarioContext: null };
  }
  const history = Array.isArray(data?.auditHistory) ? data.auditHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const archive = history[index] || {};
    const requests = Array.isArray(archive.records?.requests) ? archive.records.requests : [];
    const request = requests.find((item) => item?.id === requestId);
    if (request) {
      const tasks = Array.isArray(archive.records?.tasks) ? archive.records.tasks : [];
      const task = tasks.find((item) => item?.requestId === requestId) || null;
      return { request, task, historical: true, archivedAt: archive.archivedAt || null, archiveScenarioContext: archive.scenarioContext || null };
    }
  }
  return null;
}

function c011StableReferences(match) {
  if (!match?.request) return { requestRef: null, reminderRef: null, taskRef: null, traceRef: null };
  return {
    requestRef: match.request.id,
    reminderRef: match.request.reminderId || null,
    taskRef: match.request.taskId || match.task?.id || null,
    traceRef: match.request.traceId || null,
  };
}

function reconcileC011StableIdentity(data, payload) {
  const requestId = payload?.id || payload?.requestId || "未提供";
  const fingerprint = c011ContractFingerprint(payload);
  const match = findC011RequestByStableId(data, requestId);
  if (!match) return { outcome: "new", requestId, fingerprint, match: null, references: c011StableReferences(null) };
  return {
    outcome: storedC011ContractFingerprint(match.request) === fingerprint ? "duplicate" : "conflict",
    requestId,
    fingerprint,
    match,
    references: c011StableReferences(match),
  };
}

function validateC011Payload(payload, currentContext) {
  const problems = [];
  const context = normalizedScenarioContext(payload?.scenarioContext || payload);
  const requestId = payload?.id || payload?.requestId;
  const subjectId = payload?.subjectId || payload?.singleBusinessSubjectId;
  const subjectName = payload?.subjectName || payload?.singleBusinessSubjectName;
  const sourceType = payload?.sourceType;
  const actionType = payload?.actionType || {};
  const semanticVersion = payload?.evidence?.semanticVersion || payload?.semanticVersion;
  const dataVersion = payload?.evidence?.dataVersion || payload?.dataVersion;
  if (!scenarioContextReady(currentContext)) problems.push("当前 C033 场景运行上下文缺失、未知或未启用");
  if (!scenarioContextReady(context)) problems.push("请求缺少完整可用的 C033 场景运行上下文");
  else if (scenarioContextReady(currentContext) && !sameScenarioContext(context, currentContext)) problems.push("请求场景、场景版本或运行轮次与当前工作投影不一致");
  if (!requestId) problems.push("缺少行动申请稳定标识");
  if (!subjectId || !subjectName) problems.push("缺少单一业务主体稳定标识或名称");
  if (!Object.keys(SOURCE_META).includes(sourceType)) problems.push("请求来源不属于四类获准来源");
  if (!actionType.id || !actionType.version || actionType.status !== "已发布") problems.push("缺少已发布 Action Type 的稳定标识或精确版本");
  if (!semanticVersion || !dataVersion) problems.push("缺少精确已发布语义版本或精确数据版本");
  if (sourceType === "rule") {
    const rule = payload?.rule;
    if (!rule?.id || !rule?.version || !rule?.evaluatedAt || !rule?.branch || !rule?.hitEvidence) problems.push("Rule 来源缺少完整条件引用和命中证据");
  }
  if (!payload?.metric?.id || !payload?.metric?.value || !payload?.evidence?.snapshotId || !payload?.evidence?.cutoff) problems.push("缺少指标快照、证据快照或数据截至时间");
  return { ok: problems.length === 0, problems, context, requestId, subjectId, subjectName, semanticVersion, dataVersion, actionType };
}

function readC017SafetyProjection(request, gate) {
  const raw = window.localStorage.getItem(DC_C017_PROJECTION_KEY);
  if (!raw) return buildC017Read(request, gate, "blocked", { summaryId: "未定位", summaryVersion: "未定位", summaryFormedAt: "未定位", qualityStatus: "摘要不可定位", reason: "数据工程尚未提供面向决策中心的 C017 最小安全投影", evidenceLocator: "未定位" });
  const envelope = parseJsonValue(raw);
  if (!envelope) return buildC017Read(request, gate, "read_failed", { reason: "C017 权威投影无法解析" });
  if (envelope.contractCode !== "C017" || envelope.consumer !== "决策中心") return buildC017Read(request, gate, "blocked", { summaryId: "未定位", summaryVersion: "未定位", summaryFormedAt: "未定位", qualityStatus: "摘要不可定位", reason: "当前 C017 投影不是面向决策中心三道安全门的最小投影", evidenceLocator: "未定位" });
  const envelopeContext = normalizedScenarioContext(envelope.scenarioContext || envelope);
  if (!sameScenarioContext(envelopeContext, request.scenarioContext)) return buildC017Read(request, gate, "blocked", { summaryId: "未定位", summaryVersion: "未定位", summaryFormedAt: "未定位", qualityStatus: "场景上下文不匹配", reason: "C017 投影的场景、版本或运行轮次与请求不一致", evidenceLocator: "未定位" });
  const projections = Array.isArray(envelope.projections) ? envelope.projections : [];
  const projection = projections.find((item) => item?.dataVersion === request.evidence.dataVersion) || null;
  if (!projection) return buildC017Read(request, gate, "blocked", { summaryId: "未定位", summaryVersion: "未定位", summaryFormedAt: "未定位", qualityStatus: "摘要不可定位", reason: "C017 无法定位请求引用的精确数据版本", evidenceLocator: "未定位" });
  const scoped = projection.scopes?.[request.subjectId] || {};
  const hasScopedOverride = Object.keys(scoped).some((key) => key !== "gates") || Boolean(scoped.gates?.[gate]);
  const gateProjection = scoped.gates?.[gate] || projection.gates?.[gate] || (hasScopedOverride ? scoped : projection);
  if (gateProjection.readFailure === true) return buildC017Read(request, gate, "read_failed", { reason: gateProjection.reason || "本次未能读取数据工程权威 C017 当前摘要" });
  const summary = gateProjection.currentStateSummary || projection.currentStateSummary || projection.summary || {};
  const minimal = {
    summaryId: summary.id || projection.summaryId || "未定位",
    summaryVersion: summary.version || projection.summaryVersion || "未定位",
    summaryFormedAt: summary.formedAt || projection.formedAt || "未定位",
    qualityStatus: gateProjection.qualityStatus || gateProjection.status || "状态未知",
    hardFailure: gateProjection.hardQualityFailure === true ? "是" : gateProjection.hardQualityFailure === false ? "否" : "未能确认",
    detectedAt: gateProjection.detectedAt || "不适用",
    impactScope: gateProjection.impactScope || "当前无法判定",
    businessFieldCategories: gateProjection.businessFieldCategories || "当前无法判定",
    reason: gateProjection.reason || "权威摘要未提供可解释结论",
    recovery: gateProjection.recovery || "由数据工程恢复同一精确版本的权威摘要后重读",
    evidenceLocator: gateProjection.evidenceLocator || projection.evidenceLocator || "未定位",
  };
  if (!summary.id || !summary.version || !summary.formedAt) return buildC017Read(request, gate, "blocked", { ...minimal, qualityStatus: "摘要不可定位", reason: "C017 当前状态摘要身份、版本或形成时间不完整" });
  if (gateProjection.hardQualityFailure === true) return buildC017Read(request, gate, "rejected", minimal);
  if (gateProjection.hardQualityFailure === false && ["允许推进", "可消费", "通过", "正常"].includes(minimal.qualityStatus)) return buildC017Read(request, gate, "allowed", minimal);
  return buildC017Read(request, gate, "blocked", { ...minimal, qualityStatus: minimal.qualityStatus || "状态未知" });
}

function buildC017Read(request, gate, outcome, overrides = {}) {
  const now = formatNow();
  const allowed = outcome === "allowed";
  const readFailed = outcome === "read_failed";
  const rejected = outcome === "rejected";
  return {
    gate,
    gateLabel: C017_GATE_META[gate]?.label || gate,
    t007: request.evidence.dataVersion,
    summaryId: readFailed ? "未取得" : "未定位",
    summaryVersion: readFailed ? "未取得" : "未定位",
    summaryFormedAt: readFailed ? "未取得" : "未定位",
    readAt: now,
    qualityStatus: allowed ? "允许推进" : rejected ? "事后硬质量失败" : readFailed ? "权威读取失败" : "状态未知",
    hardFailure: rejected ? "是" : allowed ? "否" : "未能确认",
    detectedAt: rejected ? now : "不适用",
    impactScope: rejected ? "所引数据版本及其固定证据" : allowed ? "无硬质量失败影响" : "当前无法判定",
    businessFieldCategories: rejected ? "金融机构标识、融资归属" : allowed ? "无受影响业务字段类别" : "当前无法判定",
    reason: allowed ? "当前摘要未标记版本级或范围级硬质量失败" : rejected ? "精确 T007 已被数据工程当前摘要标记为事后硬质量失败" : readFailed ? "本次未能读取数据工程权威 C017 当前摘要" : "权威摘要返回状态未知",
    recovery: rejected ? "来源改用恢复后的可信版本重新发起行动申请" : allowed ? "无需恢复" : "保留当前事实，重新读取同一精确 T007 的当前摘要",
    evidenceLocator: readFailed ? "读取未完成" : "未定位",
    outcome,
    ...overrides,
  };
}
function parseDecisionRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "workbench";
  const [path, queryString = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return { path, parts, query: Object.fromEntries(new URLSearchParams(queryString)) };
}

function decisionQueryValue(query, key, fallback) {
  return Object.prototype.hasOwnProperty.call(query, key) ? query[key] : fallback;
}

function requestStatusLabel(request) {
  if (request.taskCreating) return "待办创建中";
  if (DC_UI_VARIANT === "portfolio" && request?.duplicateOf) return "已关联既有决策事项";
  return (DC_STATUS_META[request.status] || {}).label || request.status;
}

function requestHasReminder(request) {
  return Boolean(request.reminderId) && request.status !== "rejected_by_gate";
}

function requestCanDecide(request) {
  return request?.status === "awaiting" && !request.duplicateOf && requestHasReminder(request) && request.confirmationEligibility?.allowed !== false;
}

function isPortfolioHandled(request) {
  if (!request || request.duplicateOf) return false;
  return ["supplement_requested", "decision_saved", "confirmed", "create_failed", "rejected"].includes(request.status) || request.taskCreating;
}

function isPortfolioWorkbenchRequest(request) {
  return ["awaiting", "submitting"].includes(request.status) || isPortfolioHandled(request);
}

function portfolioBasisChanged(request) {
  return Boolean(request?.reminderId) && ["stale", "withdrawn", "replaced"].includes(request.status);
}

function portfolioTaskCategory(task) {
  if (!task || ["completed", "cancelled", "corrected"].includes(task.status)) return null;
  if (task.status === "correcting") return "correcting";
  if (task.status === "execution_failed") return "execution_failed";
  if (task.overdue) return "overdue";
  if (["assigned", "pending", "in_progress"].includes(task.status)) return task.status;
  return null;
}

function portfolioExceptionCategory(request) {
  if (!request) return null;
  if (["rejected_by_gate", "c017_blocked"].includes(request.status)) return "request_validation";
  if (["blocked", "missing_evidence", "stale"].includes(request.status)) return "evidence_exception";
  if (["withdrawn", "replaced"].includes(request.status)) return "withdrawal_replacement";
  if (request.status === "create_failed") return "assignment_creation";
  return null;
}

function portfolioReminderLabel(request) {
  if (request?.duplicateOf) return "已关联既有决策事项";
  if (request?.status === "validating") return "校验中";
  if (request?.status === "rejected_by_gate") return "校验未通过，未形成";
  if (request?.status === "c017_blocked") return "安全读取阻断，未形成";
  if (request?.status === "withdrawn") return "已形成，后续已撤回";
  if (request?.status === "replaced") return "已形成，已有替代请求";
  if (request?.status === "stale") return "已形成，依据已陈旧";
  if (["blocked", "missing_evidence"].includes(request?.status)) return "已形成，证据异常";
  return requestHasReminder(request) ? "已形成决策事项" : "未形成决策事项";
}

function portfolioDecisionLabel(request) {
  if (request?.duplicateOf) {
    if (request?.decision?.type === "confirm") return "关联事项已处理";
    if (request?.decision?.type === "reject") return "关联事项已拒绝";
    return "随关联事项处理";
  }
  if (request?.status === "supplement_requested") return "已请求补充信息";
  if (request?.decision?.type === "confirm") return "已处理";
  if (request?.decision?.type === "reject" || request?.status === "rejected") return "已拒绝";
  if (["awaiting", "submitting"].includes(request?.status)) return "未决定";
  return "不适用";
}

function portfolioRequestDisplayLabel(request) {
  if (request?.duplicateOf) return "已关联既有决策事项";
  if (request?.status === "validating") return "校验中";
  if (request?.status === "c017_blocked") return request?.requestGate?.status === "reading" ? "安全状态读取中" : "安全读取阻断";
  if (request?.requestGate?.status === "rejected") return "校验未通过";
  if (["blocked", "missing_evidence"].includes(request?.status)) return "证据异常";
  if (request?.status === "stale") return "证据已陈旧";
  if (request?.status === "withdrawn") return "已撤回";
  if (request?.status === "replaced") return "已有替代请求";
  if (request?.requestGate?.status === "accepted") return "校验通过";
  return undefined;
}

function portfolioRequestDisplayTone(request) {
  if (request?.duplicateOf) return "info";
  if (request?.status === "validating") return "info";
  if (request?.status === "c017_blocked" && request?.requestGate?.status === "reading") return "info";
  if (request?.requestGate?.status === "rejected" || ["blocked", "missing_evidence", "c017_blocked"].includes(request?.status)) return "danger";
  if (request?.status === "stale") return "warning";
  if (request?.status === "withdrawn") return "neutral";
  if (request?.status === "replaced") return "info";
  if (request?.requestGate?.status === "accepted") return "success";
  return undefined;
}

function portfolioDisplayText(value) {
  if (typeof value !== "string" || DC_UI_VARIANT !== "portfolio") return value;
  return value.replaceAll("决策提醒", "决策事项").replaceAll("提醒", "决策事项").replaceAll("Action Request", "行动申请").replaceAll("行动请求", "行动申请");
}

function portfolioDecisionItemLabel(request) {
  if (request?.status === "submitting") return "提交中";
  if (request?.status === "supplement_requested") return "已请求补充信息";
  if (request?.decision?.type === "confirm" || ["decision_saved", "confirmed", "create_failed"].includes(request?.status) || request?.taskCreating) return "已处理";
  if (request?.decision?.type === "reject" || request?.status === "rejected") return "已拒绝";
  return "待我决策";
}

function portfolioDecisionItemStatus(request) {
  if (request?.status === "submitting") return { status: "submitting", label: "提交中" };
  if (request?.status === "supplement_requested") return { status: "supplement_requested", label: "已请求补充信息" };
  if (request?.decision?.type === "confirm" || ["decision_saved", "confirmed", "create_failed"].includes(request?.status) || request?.taskCreating) return { status: "confirmed", label: "已处理" };
  if (request?.decision?.type === "reject" || request?.status === "rejected") return { status: "rejected", label: "已拒绝" };
  return { status: request?.status || "awaiting", label: "待我决策" };
}

function portfolioDecisionGuidance(request) {
  const evidenceComplete = request?.evidence?.availability === "完整可用" && request?.evidence?.ready === "消费就绪";
  const hasBankEvidence = Boolean(request?.banks?.length && request?.loans?.length);
  const needsSupplement = request?.confirmationEligibility?.allowed === false
    || request?.evidence?.availability === "部分可用"
    || !hasBankEvidence;
  if (needsSupplement) {
    return {
      direction: "建议请求补充信息",
      reason: !hasBankEvidence
        ? "当前无法同时核对优先银行与贷款明细，补齐后再判断更稳妥。"
        : portfolioDisplayText(request?.confirmationEligibility?.reason || request?.evidence?.affectedScope || "仍有关键证据需要补齐。"),
      evidence: request?.evidence?.freshness || request?.evidence?.availability || "证据待补充",
    };
  }
  return {
    direction: "建议确认",
    reason: evidenceComplete
      ? "主体、指标、银行归因和贷款明细均可核对，具备交办条件。"
      : "核心证据可核对；确认时需在理由中记录已知证据影响。",
    evidence: evidenceComplete ? "证据充分且当前可信" : request?.evidence?.freshness || "核心证据可用",
  };
}

function portfolioExpectedImpact(request) {
  const bank = request?.banks?.[0];
  if (!bank) return "补齐银行与贷款证据后再评估预期影响。";
  return `优先覆盖${bank.name}的 ${bank.balance} 问题余额（当前证据贡献 ${bank.contribution}），实际结果以协商回填为准。`;
}

function getStoredView() {
  try {
    return JSON.parse(window.sessionStorage.getItem(DC_VIEW_STORAGE_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

function saveStoredView(patch) {
  const next = { ...getStoredView(), ...patch };
  window.sessionStorage.setItem(DC_VIEW_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function portfolioRequestDirectoryTarget(context = {}, selectedId = "") {
  const stored = getStoredView().requestDirectory || {};
  const next = { ...stored, ...context, selectedId: selectedId || context.selectedId || stored.selectedId || "" };
  const params = new URLSearchParams({ from: "overview" });
  if (next.search) params.set("q", next.search);
  if (next.source && next.source !== "all") params.set("source", next.source);
  if (next.range && next.range !== "all") params.set("range", next.range);
  if (next.exception && next.exception !== "all") params.set("exception", next.exception);
  if (next.reminder && next.reminder !== "all") params.set("reminder", next.reminder);
  if (next.decision && next.decision !== "all") params.set("decision", next.decision);
  if (next.selectedId) params.set("selected", next.selectedId);
  return `operations/requests?${params}`;
}

function portfolioSafeReturnTarget(value, fallback) {
  return typeof value === "string" && value.startsWith("operations/requests?") ? value : fallback;
}

function decisionScrollRouteKey(hash) {
  const raw = String(hash || "#workbench").replace(/^#/, "");
  const [path, queryString = ""] = raw.split("?");
  if (DC_UI_VARIANT !== "portfolio" || path !== "operations/requests") return `#${raw}`;
  const params = new URLSearchParams(queryString);
  params.delete("from");
  params.sort();
  return `#${path}${params.toString() ? `?${params}` : ""}`;
}

function taskVisualStatus(task) {
  if (task.overdue && !["completed", "cancelled", "corrected"].includes(task.status)) {
    return { status: task.status, suffix: " · 已逾期" };
  }
  return { status: task.status, suffix: "" };
}

function inDecisionRange(value, range) {
  if (!range || range === "all") return true;
  const days = range === "7d" ? 7 : 30;
  const parsed = new Date(String(value).replace(" ", "T"));
  const now = new Date();
  return !Number.isNaN(parsed.getTime()) && now - parsed <= days * 86400000;
}

function expandDecisionRequests(requests) {
  return requests.flatMap((request) => [
    request,
    ...request.duplicateRequests.map((duplicate) => ({
      ...request,
      id: duplicate.id,
      sourceType: duplicate.sourceType,
      sourceRef: duplicate.sourceRef,
      requester: duplicate.requester || "业务用户",
      requestTime: duplicate.time,
      generatedTime: duplicate.time,
      reminderId: request.reminderId,
      decision: request.decision,
      supplement: request.supplement,
      taskId: request.taskId,
      taskCreating: request.taskCreating,
      duplicateOf: request.id,
      canonicalRequestId: request.id,
      duplicateRelation: duplicate.relation,
      duplicateRequests: [],
      requestGate: {
        status: "accepted",
        checkedAt: duplicate.time,
        reason: `固定证据与开放${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}完全一致，已关联现有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}`,
        reminderCreated: true,
      },
      formation: {
        requestGateStatus: "accepted",
        requestGateCheckedAt: duplicate.time,
        requestGateReason: `固定证据与开放${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}完全一致，已关联现有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}`,
        reminderCreated: true,
        confirmationGateStatus: "passed",
        confirmationGateReason: `复用同一固定证据和开放${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}，不重复形成${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}`,
      },
    })),
  ]);
}

function readC011Inbox(currentContext = null) {
  const envelope = parseJsonValue(window.localStorage.getItem(DC_C011_INBOX_KEY));
  if (!envelope) return { status: "empty", requests: [], reason: "当前没有待接收的行动申请" };
  if (envelope.contractCode !== "C011") return { status: "invalid", requests: [], reason: "待接收内容不是标准行动申请包" };
  const envelopeContext = normalizedScenarioContext(envelope.scenarioContext || envelope);
  if (currentContext && scenarioContextReady(currentContext) && !sameScenarioContext(envelopeContext, currentContext)) {
    return { status: "context_mismatch", requests: [], sourceRequests: Array.isArray(envelope.requests) ? envelope.requests.length : 0, scenarioContext: envelopeContext, reason: "上游请求包属于其他场景运行轮次，未进入当前待接收范围" };
  }
  const requests = Array.isArray(envelope.requests) ? envelope.requests : [];
  return { status: requests.length ? "ready" : "empty", requests, scenarioContext: envelopeContext, receivedAt: envelope.formedAt || null, reason: requests.length ? "可读取" : "当前没有待接收的行动申请" };
}

function stableResourceId(prefix, requestId) {
  return `${prefix}-${String(requestId || "").replace(/^AR-/, "")}`;
}

function normalizeReceivedRequest(payload, context, read) {
  const now = read.readAt || formatNow();
  const hardRejected = read.outcome === "rejected";
  const allowed = read.outcome === "allowed";
  const requestId = payload.id || payload.requestId;
  const reminderId = allowed ? stableResourceId("DR", requestId) : null;
  const traceId = stableResourceId("TR", requestId);
  const evidence = payload.evidence || {};
  const actionType = payload.actionType || {};
  const banks = Array.isArray(payload.banks) ? payload.banks : [];
  const loans = Array.isArray(payload.loans) ? payload.loans : [];
  const missingBankEvidence = banks.length === 0;
  return {
    ...JSON.parse(JSON.stringify(payload)),
    id: requestId,
    scenario: payload.scenario || payload.scenarioName || "集团融资成本与债务结构优化",
    scenarioContext: context,
    subjectId: payload.subjectId || payload.singleBusinessSubjectId,
    subjectName: payload.subjectName || payload.singleBusinessSubjectName,
    sourceType: payload.sourceType,
    sourceRef: payload.sourceRef || payload.sourceId || "来源记录",
    requester: payload.requester || SOURCE_META[payload.sourceType]?.label || "获准来源",
    requestTime: payload.requestTime || payload.createdAt || now,
    generatedTime: allowed ? now : null,
    actionType: { ...actionType, status: "已发布", publishedSemanticVersion: evidence.semanticVersion },
    rule: payload.rule ? { ...payload.rule, publishedSemanticVersion: evidence.semanticVersion } : null,
    ruleApplicability: payload.rule ? "适用" : "不适用",
    metric: payload.metric,
    owner: payload.owner || "集团资金管理岗",
    recommendation: payload.recommendation || `核实${payload.subjectName || payload.singleBusinessSubjectName || "当前主体"}的融资异常并形成受控优化方案`,
    banks,
    loans,
    loanCount: Number.isFinite(Number(payload.loanCount)) ? Number(payload.loanCount) : loans.length,
    evidence: {
      availability: "完整可用",
      availableSections: ["指标快照", "主体范围", ...(banks.length ? ["银行归因"] : []), ...(loans.length ? ["贷款明细"] : []), "双版本证明"],
      missingItems: missingBankEvidence ? ["银行归因与贷款明细尚未随本次请求提供"] : [],
      ...evidence,
    },
    reminderId,
    traceId,
    status: hardRejected ? "rejected_by_gate" : allowed ? "awaiting" : "c017_blocked",
    requestGate: {
      status: hardRejected ? "rejected" : allowed ? "accepted" : "blocked",
      checkedAt: now,
      reason: read.reason,
      reminderCreated: allowed,
    },
    formation: {
      requestGateStatus: hardRejected ? "rejected" : allowed ? "accepted" : "blocked",
      requestGateCheckedAt: now,
      requestGateReason: read.reason,
      reminderCreated: allowed,
      confirmationGateStatus: allowed ? "not_reached" : "not_reached",
      confirmationGateReason: allowed ? "等待用户提交正向人工确认时重新读取" : "请求接收安全门未通过，未到达人工确认门",
    },
    confirmationEligibility: { allowed, requiresAcknowledgement: allowed && missingBankEvidence, reason: allowed ? (missingBankEvidence ? "行动申请已通过接收门，但本次固定证据未包含银行归因；确认时需知情说明" : "行动申请已通过接收门，可进入人工判断") : "行动申请尚未通过 C017 接收安全门" },
    c017SafetyReads: [read],
    c017ReadAttempts: { request_receipt: 1, confirmation_submit: 0, task_formation: 0 },
    s001DataStructure: S001_DATA_STRUCTURE,
    sourceEvents: [],
    supplementPolicy: { canRequest: allowed, editableUpstream: false, resolutionMode: "等待新申请或替代行动申请" },
    supplementRequests: [],
    duplicateRequests: [],
    decision: null,
    taskId: null,
    taskCreating: false,
    contractFingerprint: c011ContractFingerprint(payload),
    idempotencyKey: c011IdempotencyKey(payload),
    blockReason: allowed ? null : read.reason,
    recovery: allowed ? null : read.recovery,
  };
}

function c019TargetRef(type, id, context, routeId = id) {
  if (!id) return null;
  const route = { request: "request", reminder: "reminder", task: "task", trace: "trace/request" }[type];
  const params = new URLSearchParams({ scenarioId: context.scenarioId, scenarioVersion: context.scenarioVersion, scenarioRunId: context.scenarioRunId, scenarioStatus: context.status || "active" });
  return { targetType: type, targetId: id, stableDetailEntry: `/decision-center-prototype/index.html?${params}#${route}/${encodeURIComponent(routeId)}` };
}

function buildC019Projection(data) {
  const context = data.scenarioContext;
  const summaryAsOf = formatNow();
  return {
    contractCode: "C019",
    schemaVersion: 1,
    owner: "决策中心",
    consumer: "报告中心",
    scenarioContext: context,
    summaryAsOf,
    status: scenarioContextReady(context) ? "可读取" : "场景运行上下文不可用",
    records: data.requests.map((request) => {
      const task = data.tasks.find((item) => item.requestId === request.id) || null;
      return {
        scenarioContext: request.scenarioContext,
        requestStatus: request.status,
        reminderStatus: request.reminderId ? (request.decision ? "已处理" : "待决策") : null,
        decisionStatus: request.decision?.type || null,
        taskStatus: task?.status || null,
        businessSubject: { id: request.subjectId, name: request.subjectName },
        semanticVersion: request.evidence.semanticVersion,
        dataVersion: request.evidence.dataVersion,
        requestRef: c019TargetRef("request", request.id, context),
        reminderRef: c019TargetRef("reminder", request.reminderId, context),
        taskRef: c019TargetRef("task", task?.id || null, context),
        traceRef: c019TargetRef("trace", request.traceId || null, context, request.id),
        navigationContext: {
          sourceScene: request.scenario,
          businessSubject: request.subjectName,
          filter: null,
          returnRoute: null,
          returnPosition: null,
        },
      };
    }),
  };
}

function buildTaskFromDecision(request, form) {
  const now = formatNow();
  const id = `TD-${Date.now().toString().slice(-10)}`;
  const task = {
    id,
    requestId: request.id,
    reminderId: request.reminderId,
    subjectId: request.subjectId,
    subjectName: request.subjectName,
    sourceType: request.sourceType,
    scenarioContext: request.scenarioContext,
    owner: form.owner,
    ownerId: form.owner === request.owner ? request.ownerId : null,
    title: `推进${request.subjectName}${request.actionType.name}`,
    actionType: request.actionType,
    ruleLabel: request.rule ? `${request.rule.id} ${request.rule.name} · ${request.rule.version}` : "Rule 条件引用：不适用",
    metricLabel: `${request.metric.name} ${request.metric.value}`,
    dataVersion: request.evidence.dataVersion,
    cutoff: request.evidence.cutoff,
    createdAt: now,
    dueDate: form.dueDate,
    status: DC_UI_VARIANT === "portfolio" ? "assigned" : "pending",
    overdue: form.dueDate < dateOnly(new Date()),
    instructions: form.instructions,
    banks: form.banks,
    decisionReason: form.reason,
    progress: [],
    history: [
      { time: request.decision.time, label: "人工确认", detail: `${form.owner} · ${form.reason}` },
      { time: now, label: "负责人待办创建", detail: DC_UI_VARIANT === "portfolio" ? `等待 ${form.owner} 确认承接 · 到期日 ${form.dueDate}` : `${form.owner} · 到期日 ${form.dueDate}` },
    ],
    sourceChanged: false,
    sourceChangeEvent: null,
    failure: null,
    result: null,
    correction: null,
    updateAttempts: 0,
  };
  if (DC_UI_VARIANT === "portfolio") {
    Object.assign(task, {
      metricSnapshotId: request.evidence.snapshotId,
      semanticVersion: request.evidence.semanticVersion,
      sourceRef: request.sourceRef,
      sourceRequestTime: request.requestTime,
    });
  }
  return task;
}

function DecisionRail({ onReset, onNavigate }) {
  return (
    <aside className="app-rail" aria-label="平台模块栏">
      <div className="rail-logo" title="智财问策"><DCIcon name="Orbit" size={18} /></div>
      <button type="button" className="active" title="决策中心" aria-label="决策中心" onClick={() => onNavigate("workbench")}><DCIcon name="Scale" size={18} /></button>
      <div className="rail-spacer"></div>
      <button type="button" onClick={onReset} title="重置状态" aria-label="重置状态"><DCIcon name="RotateCcw" size={17} /></button>
    </aside>
  );
}

function DecisionProductNav({ route, onNavigate }) {
  const active = ["overview", "operations"].includes(route.parts[0]) ? "overview" : "workbench";
  const items = [
    { id: "workbench", label: "决策工作台", icon: "Inbox" },
    { id: "overview", label: "决策运营概览", icon: "Gauge" },
  ];
  return (
    <nav className="product-nav" aria-label="决策中心导航">
      <div className="product-nav-head">
        <span><DCIcon name="Scale" size={17} /></span>
        <div><strong>决策中心</strong><small>判断 · 交办 · 执行 · 追溯</small></div>
      </div>
      <div className="product-nav-list">
        <div className="product-nav-label">工作区</div>
        {items.map((item) => (
          <button type="button" key={item.id} className={`product-nav-item ${active === item.id ? "active" : ""}`} aria-label={item.label} title={item.label} onClick={() => onNavigate(item.id)}>
            <DCIcon name={item.icon} size={16} />
            <span>{item.label}</span>
            <DCIcon name="ChevronRight" size={13} className="nav-chevron" />
          </button>
        ))}
      </div>
    </nav>
  );
}

function routeTitle(route, data) {
  const [root, type, id] = route.parts;
  if (root === "overview") return ["决策中心", "决策运营概览"];
  if (root === "operations" && type === "intake") return ["决策运营概览", "接收行动申请"];
  if (root === "operations" && type === "requests") return ["决策运营概览", "行动申请目录"];
  if (root === "operations" && type === "assignment-recovery") return ["决策运营概览", "交办异常恢复"];
  if (root === "tasks") return ["决策工作台", "负责人待办"];
  if (root === "request") return [DC_UI_VARIANT === "portfolio" ? "决策运营概览" : "决策工作台", expandDecisionRequests(data.requests).find((item) => item.id === type)?.subjectName || "行动申请"];
  if (root === "reminder") return ["决策工作台", data.requests.find((item) => item.reminderId === type)?.subjectName || (DC_UI_VARIANT === "portfolio" ? "决策事项详情" : "提醒详情")];
  if (root === "task") return ["决策工作台", data.tasks.find((item) => item.id === type)?.subjectName || "待办详情"];
  if (root === "trace") return [route.parts[1] === "request" && DC_UI_VARIANT === "portfolio" ? "决策运营概览" : "决策工作台", "全链路追溯"];
  return ["决策中心", "决策工作台"];
}

function portfolioContextReturn(route, fallback, fallbackTarget) {
  if (DC_UI_VARIANT !== "portfolio") return null;
  if (window.history.state?.dcFromRoute) return { label: fallback, action: () => window.history.back() };
  if (route.query.from === "overview") return { label: "返回运营概览", target: "overview" };
  return fallbackTarget ? { label: fallback, target: fallbackTarget } : null;
}

function portfolioRequestDetailTarget(requestId, returnTo = "") {
  if (DC_UI_VARIANT !== "portfolio") return `request/${requestId}`;
  const params = new URLSearchParams({ from: "decision-item" });
  if (returnTo) params.set("returnTo", returnTo);
  return `request/${requestId}?${params}`;
}

function portfolioDecisionItemTarget(reminderId, from = "request", returnTo = "") {
  if (DC_UI_VARIANT !== "portfolio") return `reminder/${reminderId}`;
  const params = new URLSearchParams({ from });
  if (returnTo) params.set("returnTo", returnTo);
  return `reminder/${reminderId}?${params}`;
}

function DecisionTopbar({ route, data }) {
  const [parent, title] = routeTitle(route, data);
  const context = data.scenarioContext || {};
  return (
    <header className="app-topbar">
      <div className="breadcrumb"><span>智财问策</span><DCIcon name="ChevronRight" size={12} /><span>{parent}</span><DCIcon name="ChevronRight" size={12} /><strong>{title}</strong></div>
      <div className={`runtime-context-chip ${scenarioContextReady(context) ? "ready" : "blocked"}`} title={scenarioContextReady(context) ? `${context.scenarioVersion} · ${context.scenarioRunId}` : "缺少可用场景运行上下文"}><DCIcon name={scenarioContextReady(context) ? "CircleCheck" : "ShieldAlert"} size={14} /><span>{context.scenarioId || "场景未知"}</span><small>{scenarioContextReady(context) ? context.scenarioRunId : "当前写入已阻断"}</small></div>
    </header>
  );
}

function buildPortfolioDecisionSummary(requests, contextLabel) {
  const awaiting = requests.filter((item) => item.status === "awaiting");
  const priorityScore = (item) => {
    const numeric = Number.parseFloat(String(item.metric?.value || "0").replace(/[^0-9.]/g, "")) || 0;
    const metricWeight = item.metric?.name.includes("成本") ? 15 : 1;
    const evidencePenalty = item.evidence?.availability === "部分可用" ? 24 : 0;
    const replacementBoost = item.replacementOf ? 4 : 0;
    return numeric * metricWeight - evidencePenalty + replacementBoost;
  };
  const ranked = [...awaiting].sort((a, b) => priorityScore(b) - priorityScore(a));
  const items = ranked.map((item, index) => {
    const fullEvidence = item.evidence?.availability === "完整可用" && item.evidence?.ready === "消费就绪";
    const hasBanks = Boolean(item.banks?.length);
    const needsSupplement = !hasBanks || item.confirmationEligibility?.requiresAcknowledgement || item.evidence?.availability === "部分可用";
    const direction = needsSupplement
      ? "请求补充信息"
      : fullEvidence
        ? "建议确认"
        : "可确认，但需在理由中说明已知证据缺口";
    const directionReason = needsSupplement
      ? (!hasBanks ? "尚不能核对优先协商银行" : item.evidence?.missingItems?.join("、") || item.evidence?.affectedScope || "仍有证据需要补齐")
      : fullEvidence
        ? "主体、指标、银行归因和贷款证据可核对"
        : item.evidence?.affectedScope || "部分非关键证据尚未补齐";
    const topBank = item.banks?.[0];
    return {
      rank: index + 1,
      id: item.id,
      reminderId: item.reminderId,
      subjectName: item.subjectName,
      metricName: item.metric.name,
      metricValue: item.metric.value,
      cause: item.rule?.hitEvidence || item.metric.explanation,
      evidence: fullEvidence ? "证据完整" : item.evidence?.availability || item.evidence?.freshness,
      direction,
      directionReason,
      priorityReason: index === 0
        ? `${item.metric.name}偏离在当前范围最突出，且优先银行证据可直接核对`
        : `${item.metric.name} ${item.metric.value}，${fullEvidence ? "证据充分，可直接判断" : "存在已知证据缺口"}`,
      banks: (item.banks || []).slice(0, 3).map((bank) => bank.name),
      expectedImpact: topBank
        ? `优先覆盖${topBank.name}的 ${topBank.balance} 问题余额（贡献 ${topBank.contribution}），实际结果以协商回填为准`
        : "需先补齐银行证据，暂不估计协商影响",
    };
  });
  const metricGroups = Object.entries(awaiting.reduce((acc, item) => {
    (acc[item.metric.name] ||= []).push(item.subjectName);
    return acc;
  }, {})).filter(([, subjects]) => subjects.length > 1);
  const evidenceComplete = awaiting.filter((item) => item.evidence?.availability === "完整可用" && item.evidence?.ready === "消费就绪").length;
  const directionCounts = items.reduce((acc, item) => {
    if (item.direction === "建议确认") acc.confirm += 1;
    else if (item.direction === "请求补充信息") acc.supplement += 1;
    else if (item.direction.includes("拒绝")) acc.reject += 1;
    else acc.conditional += 1;
    return acc;
  }, { confirm: 0, supplement: 0, reject: 0, conditional: 0 });
  const generatedAt = formatNow();
  const cutoff = awaiting.map((item) => item.evidence?.cutoff).filter(Boolean).sort().at(-1) || "当前范围无待决策事项";
  return {
    awaitingCount: awaiting.length,
    items,
    evidenceComplete,
    evidenceTotal: awaiting.length,
    affectedSubjects: awaiting.map((item) => item.subjectName),
    mainIssues: Object.entries(awaiting.reduce((acc, item) => { acc[item.metric.name] = (acc[item.metric.name] || 0) + 1; return acc; }, {})).map(([name, count]) => `${name} ${count} 项`),
    directionCounts,
    similarities: metricGroups.map(([metric, subjects]) => `${subjects.join("、")}均涉及${metric}，但主体与固定证据不同，必须逐项决定`),
    generatedAt,
    cutoff,
    contextLabel,
  };
}

function AISummaryPanel({ scope, requests, tasks = [], contextLabel, contextSignature, onNavigate, persisted, onPersist }) {
  const record = persisted || { status: "idle", summary: null, attempts: 0, generatedFor: "" };
  const status = record.status || "idle";
  const summary = record.summary;

  useEffect(() => {
    if (summary && record.generatedFor && record.generatedFor !== contextSignature && status === "success") {
      onPersist({ ...record, status: "stale" });
    }
  }, [contextSignature, onPersist, record, status, summary]);

  const generate = () => {
    const attempts = record.attempts || 0;
    onPersist({ ...record, status: "generating", error: null });
    window.setTimeout(() => {
      if (attempts === 0) {
        onPersist({ ...record, status: "error", attempts: 1, error: "服务暂时繁忙" });
        return;
      }
      if (DC_UI_VARIANT === "portfolio" && scope === "workbench") {
        const nextSummary = buildPortfolioDecisionSummary(requests, contextLabel);
        onPersist({ scope, status: "success", summary: nextSummary, attempts: attempts + 1, generatedFor: contextSignature, filterSnapshot: contextLabel, dataCutoff: nextSummary.cutoff, generatedAt: nextSummary.generatedAt, error: null });
        return;
      }
      const awaiting = requests.filter((item) => item.status === "awaiting");
      const blocked = requests.filter((item) => ["blocked", "stale", "missing_evidence", "rejected_by_gate", "withdrawn", "replaced"].includes(item.status));
      const supplement = requests.filter((item) => item.status === "supplement_requested");
      const activeTasks = tasks.filter((item) => ["assigned", "pending", "in_progress", "execution_failed", "correcting"].includes(item.status));
      const overdue = activeTasks.filter((item) => item.overdue);
      const failedTasks = tasks.filter((item) => item.status === "execution_failed");
      const corrections = tasks.filter((item) => ["correcting", "corrected"].includes(item.status));
      const first = awaiting[0] || blocked[0] || requests[0];
      const task = overdue[0] || failedTasks[0] || activeTasks[0] || tasks[0];
      const generatedAt = formatNow();
      const cutoff = requests.map((item) => item.evidence?.cutoff).filter(Boolean).sort().at(-1) || "当前筛选无固定数据时点";
      const affectedSubjects = [...new Set([...awaiting, ...blocked].map((item) => item.subjectName))];
      const causeLabels = [...new Set(blocked.map((item) => requestStatusLabel(item)))];
      const evidenceComplete = requests.filter((item) => item.evidence?.availability === "完整可用" && !["不可消费", "已撤回证据"].includes(item.evidence?.ready)).length;
      const ownerCounts = Object.entries(activeTasks.reduce((acc, item) => { acc[item.owner] = (acc[item.owner] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]);
      const compactRequest = first ? { id: first.id, reminderId: first.reminderId, subjectName: first.subjectName, metricName: first.metric.name, metricValue: first.metric.value } : null;
      const compactTask = task ? { id: task.id, subjectName: task.subjectName, status: task.status } : null;
      const nextSummary = {
        awaitingCount: awaiting.length,
        blockedCount: blocked.length,
        supplementCount: supplement.length,
        activeTaskCount: activeTasks.length,
        overdueCount: overdue.length,
        failedTaskCount: failedTasks.length,
        correctionCount: corrections.length,
        evidenceComplete,
        evidenceTotal: requests.length,
        affectedSubjects,
        causeLabels,
        ownerCounts,
        first: compactRequest,
        task: compactTask,
        recovery: blocked[0]?.recovery || (supplement.length ? "等待上游形成新的或替代的行动申请。" : "当前没有需要恢复的证据异常。"),
        generatedAt,
        cutoff,
        contextLabel,
      };
      onPersist({ scope, status: "success", summary: nextSummary, attempts: attempts + 1, generatedFor: contextSignature, filterSnapshot: contextLabel, dataCutoff: cutoff, generatedAt, error: null });
    }, 950);
  };

  return (
    <section className={`ai-summary content-panel ${status}`} aria-live="polite">
      <div className="ai-summary-head">
        <span className="ai-summary-icon"><DCIcon name="Sparkles" size={17} /></span>
        <div><strong>AI 摘要</strong><small>{contextLabel}</small></div>
        {status === "idle" ? <DCButton size="sm" icon="Sparkles" onClick={generate}>生成 AI 摘要</DCButton> : null}
        {status === "success" ? <DCButton size="sm" icon="RefreshCw" onClick={generate}>重新生成</DCButton> : null}
        {status === "stale" ? <DCButton size="sm" variant="primary" icon="RefreshCw" onClick={generate}>按当前状态重新生成</DCButton> : null}
        {status === "error" ? <DCButton size="sm" variant="primary" icon="RefreshCw" onClick={generate}>重试</DCButton> : null}
      </div>
      {status === "idle" ? <div className="ai-summary-placeholder"><span>尚未生成</span><p>{DC_UI_VARIANT === "portfolio" && scope === "workbench" ? "将围绕当前“待我决策”事项提炼优先级、关键证据、建议方向和预期影响。" : "将使用当前页面中的提醒、证据完整性和待办状态形成只读摘要。"}</p></div> : null}
      {status === "generating" ? <div className="ai-summary-loading"><DCIcon name="LoaderCircle" className="spin" /><div><strong>正在整理当前范围</strong><span>{DC_UI_VARIANT === "portfolio" && scope === "workbench" ? "正在比较事项优先级与证据充分程度" : "页面操作不受影响"}</span></div></div> : null}
      {status === "error" ? <DCAlert tone="danger" title="摘要生成失败">本次未能形成摘要，原始记录和筛选条件均已保留，可直接重试。</DCAlert> : null}
      {status === "stale" && summary ? <DCAlert tone="warning" title="页面状态已变化">下方内容基于 {summary.generatedAt} 的页面状态，请重新生成后再参考。</DCAlert> : null}
      {["success", "stale"].includes(status) && summary && DC_UI_VARIANT === "portfolio" && scope === "workbench" ? <div className="ai-summary-result portfolio-ai-result">
        <div className="portfolio-ai-lead">
          <div><span>当前需要决策</span><strong>{summary.awaitingCount} 项</strong><small>{summary.evidenceComplete} 项证据完整，{summary.evidenceTotal - summary.evidenceComplete} 项需关注证据说明</small></div>
          <div><span>主要业务问题</span><strong>{summary.mainIssues?.length ? summary.mainIssues.join(" · ") : "当前摘要口径已更新，请重新生成"}</strong><small>受影响单位：{summary.affectedSubjects?.length ? summary.affectedSubjects.join("、") : "无"}</small></div>
        </div>
        {summary.items?.length ? <div className="portfolio-ai-priorities">
          {summary.items.slice(0, 5).map((item) => <article key={item.id}>
            <span className="ai-rank">{item.rank}</span>
            <div className="ai-priority-main"><header><strong>{item.subjectName} · {item.metricName} {item.metricValue}</strong><span>{item.evidence}</span></header><p>{item.priorityReason}</p><small>核心原因：{item.cause}</small></div>
            <div className="ai-direction"><span>{item.direction}</span><strong>{item.directionReason}</strong><small>{item.banks?.length ? `优先银行：${item.banks.join("、")}` : "优先银行：待补充"}</small><em>{item.expectedImpact}</em></div>
            <DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`reminder/${item.reminderId}`)}>查看决策事项</DCButton>
          </article>)}
        </div> : <DCEmpty icon="CircleCheckBig" title="当前没有待我决策事项" description="新的决策事项形成后，可按当前筛选范围重新生成摘要。" />}
        {summary.similarities?.length ? <div className="portfolio-ai-similarity"><DCIcon name="Split" /><div><strong>相似事项仍需独立判断</strong>{summary.similarities.map((item) => <p key={item}>{item}</p>)}</div></div> : null}
        {summary.directionCounts ? <div className="ai-summary-meta"><span>判断方向：{summary.directionCounts.confirm} 项建议确认 · {summary.directionCounts.supplement} 项建议补充信息{summary.directionCounts.conditional ? ` · ${summary.directionCounts.conditional} 项附条件确认` : ""} · {summary.directionCounts.reject ? `${summary.directionCounts.reject} 项建议拒绝` : "当前无建议拒绝事项"}</span><span>范围：{summary.contextLabel}</span><span>数据截至：{summary.cutoff}</span><span>生成时间：{summary.generatedAt}</span><span>AI 建议不替代人工决定，也不修改权威证据</span></div> : <div className="ai-summary-meta"><span>当前摘要的判断口径已更新，请按当前状态重新生成</span><span>AI 建议不替代人工决定，也不修改权威证据</span></div>}
      </div> : null}
      {["success", "stale"].includes(status) && summary && !(DC_UI_VARIANT === "portfolio" && scope === "workbench") ? <div className="ai-summary-result">
        <div className="ai-summary-copy">
          {scope === "workbench" ? <>
            <p><strong>{summary.awaitingCount} 条提醒等待人工判断</strong>；另有 {summary.blockedCount} 条证据或版本异常，{summary.supplementCount} 条正在等待上游补充。</p>
            <p>{summary.first ? `建议先查看 ${summary.first.subjectName}：${summary.first.metricName} ${summary.first.metricValue}。` : "当前筛选范围没有需要处理的提醒。"}</p>
          </> : <>
            <p><strong>{summary.awaitingCount} 条提醒待判断，{summary.activeTaskCount} 条负责人待办尚未结束</strong>；{summary.overdueCount} 条已逾期，{summary.failedTaskCount} 条执行失败，{summary.correctionCount} 条正在或已经纠正。</p>
            <p>{summary.task ? `建议关注 ${summary.task.subjectName} 的 ${{ execution_failed: "失败恢复", correcting: "纠正处理", corrected: "纠正记录", completed: "完成结果", cancelled: "取消记录" }[summary.task.status] || "执行进展"}。` : "当前没有运行中的负责人待办。"}</p>
          </>}
        </div>
        <div className="ai-summary-insights">
          <div><span>主要原因</span><strong>{summary.causeLabels?.length ? summary.causeLabels.slice(0, 3).join("、") : "当前无阻断原因"}</strong></div>
          <div><span>受影响单位</span><strong>{summary.affectedSubjects?.length ? summary.affectedSubjects.slice(0, 4).join("、") : "当前无异常单位"}</strong></div>
          <div><span>证据完整性</span><strong>{summary.evidenceComplete} / {summary.evidenceTotal} 条完整可用</strong></div>
          <div><span>恢复建议</span><strong>{portfolioDisplayText(summary.recovery)}</strong></div>
        </div>
        <div className="ai-summary-links">
          {summary.first ? <button type="button" onClick={() => onNavigate(summary.first.reminderId ? `reminder/${summary.first.reminderId}` : `request/${summary.first.id}`)}><DCIcon name="Building2" />{summary.first.subjectName}<DCIcon name="ChevronRight" /></button> : null}
          {summary.task ? <button type="button" onClick={() => onNavigate(`task/${summary.task.id}`)}><DCIcon name="ListTodo" />{summary.task.subjectName}待办<DCIcon name="ChevronRight" /></button> : null}
        </div>
        <div className="ai-summary-meta"><span>筛选：{summary.contextLabel}</span><span>数据截至：{summary.cutoff}</span><span>生成时间：{summary.generatedAt}</span><span>AI 建议，不替代人工决定</span></div>
      </div> : null}
    </section>
  );
}

function WorkbenchScreen(props) {
  return DC_UI_VARIANT === "portfolio" ? <PortfolioWorkbenchScreen {...props} /> : <LegacyWorkbenchScreen {...props} />;
}

function PortfolioWorkbenchScreen({ data, onNavigate, submitDecision, updateAISummary }) {
  const route = parseDecisionRoute();
  const stored = getStoredView().workbench || {};
  const storedLayout = ["groups", "list"].includes(stored.layout) ? stored.layout : "groups";
  const [search, setSearch] = useState(decisionQueryValue(route.query, "q", stored.search || ""));
  const [sourceFilter, setSourceFilter] = useState(decisionQueryValue(route.query, "source", stored.source || "all"));
  const [subjectFilter, setSubjectFilter] = useState(decisionQueryValue(route.query, "subject", stored.subject || "all"));
  const initialScope = decisionQueryValue(route.query, "scope", route.query.status === "processed_today" ? "handled" : route.query.status === "awaiting" ? "pending" : stored.scope || "pending");
  const [scope, setScope] = useState(["pending", "handled"].includes(initialScope) ? initialScope : "pending");
  const [rangeFilter, setRangeFilter] = useState(decisionQueryValue(route.query, "range", stored.range || "all"));
  const [layout, setLayout] = useState(decisionQueryValue(route.query, "layout", storedLayout));
  const [selectedId, setSelectedId] = useState(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
  const [portfolioDimension, setPortfolioDimension] = useState(decisionQueryValue(route.query, "group", stored.portfolioDimension || "subject"));
  const [decisionMode, setDecisionMode] = useState(null);

  useEffect(() => {
    setSearch(decisionQueryValue(route.query, "q", stored.search || ""));
    setSourceFilter(decisionQueryValue(route.query, "source", stored.source || "all"));
    setSubjectFilter(decisionQueryValue(route.query, "subject", stored.subject || "all"));
    const nextScope = decisionQueryValue(route.query, "scope", route.query.status === "processed_today" ? "handled" : route.query.status === "awaiting" ? "pending" : stored.scope || "pending");
    setScope(["pending", "handled"].includes(nextScope) ? nextScope : "pending");
    setRangeFilter(decisionQueryValue(route.query, "range", stored.range || "all"));
    setLayout(decisionQueryValue(route.query, "layout", storedLayout));
    setSelectedId(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
    setPortfolioDimension(decisionQueryValue(route.query, "group", stored.portfolioDimension || "subject"));
  }, [route.query.q, route.query.source, route.query.subject, route.query.scope, route.query.status, route.query.range, route.query.layout, route.query.selected, route.query.group]);

  const changeContext = (patch) => {
    const next = { scope, search, source: sourceFilter, subject: subjectFilter, range: rangeFilter, layout, selectedId, portfolioDimension, ...patch };
    setScope(next.scope); setSearch(next.search); setSourceFilter(next.source); setSubjectFilter(next.subject); setRangeFilter(next.range); setLayout(next.layout); setSelectedId(next.selectedId); setPortfolioDimension(next.portfolioDimension);
    saveStoredView({ workbench: next });
    const params = new URLSearchParams();
    if (next.scope !== "pending") params.set("scope", next.scope);
    if (next.search) params.set("q", next.search);
    if (next.source !== "all") params.set("source", next.source);
    if (next.subject !== "all") params.set("subject", next.subject);
    if (next.range !== "all") params.set("range", next.range);
    if (next.layout !== "groups") params.set("layout", next.layout);
    if (next.selectedId) params.set("selected", next.selectedId);
    if (next.portfolioDimension !== "subject") params.set("group", next.portfolioDimension);
    if (route.query.from) params.set("from", route.query.from);
    onNavigate(`workbench${params.toString() ? `?${params}` : ""}`, {}, true);
  };

  const leaderRequests = data.requests.filter(isPortfolioWorkbenchRequest);
  const subjects = [...new Set(leaderRequests.map((item) => item.subjectName))].sort();
  const matchesCommon = (item) => {
    const haystack = `${item.subjectName} ${item.id} ${item.reminderId || ""} ${item.metric.name} ${item.actionType.name} ${item.owner}`.toLowerCase();
    return haystack.includes(search.toLowerCase())
      && (sourceFilter === "all" || item.sourceType === sourceFilter)
      && (subjectFilter === "all" || item.subjectName === subjectFilter)
      && inDecisionRange(item.generatedTime || item.requestTime, rangeFilter);
  };
  const filteredRequests = leaderRequests.filter((item) => requestHasReminder(item)
    && matchesCommon(item)
    && (scope === "pending" ? requestCanDecide(item) || item.status === "submitting" : isPortfolioHandled(item)));
  const selected = filteredRequests.find((item) => item.id === selectedId) || filteredRequests[0] || null;
  const pendingWithinFilters = data.requests.filter((item) => requestCanDecide(item) && matchesCommon(item));
  const handledRequests = leaderRequests.filter((item) => isPortfolioHandled(item) && matchesCommon(item));
  const handledBreakdown = {
    confirmed: handledRequests.filter((item) => item.decision?.type === "confirm").length,
    rejected: handledRequests.filter((item) => item.decision?.type === "reject").length,
    supplement: handledRequests.filter((item) => item.status === "supplement_requested").length,
  };
  const aiContextLabel = `待我决策 · ${sourceFilter === "all" ? "全部来源" : SOURCE_META[sourceFilter].label} · ${subjectFilter === "all" ? "全部主体" : subjectFilter} · ${rangeFilter === "7d" ? "近 7 日" : rangeFilter === "30d" ? "近 30 日" : "全部时间"}${search ? ` · 搜索“${search}”` : ""}`;
  const aiSignature = `${aiContextLabel}|${pendingWithinFilters.map((item) => `${item.id}:${item.status}:${item.evidence.dataVersion}`).join(",")}`;

  const toolbar = <div className="panel-toolbar split portfolio-filter-bar">
    <div className="portfolio-directory-title"><span>决策事项</span><strong>{scope === "pending" ? "待我决策" : "已处理"}</strong><small>{filteredRequests.length} 条独立事项</small></div>
    <div className="toolbar-actions">
      <DCSearch value={search} onChange={(value) => changeContext({ search: value, selectedId: "" })} placeholder="搜索主体、指标或行动类型" />
      <DCSelect label="来源" value={sourceFilter} onChange={(value) => changeContext({ source: value, selectedId: "" })} options={[{ value: "all", label: "全部来源" }, ...Object.entries(SOURCE_META).map(([value, item]) => ({ value, label: item.label }))]} />
      <DCSelect label="业务主体" value={subjectFilter} onChange={(value) => changeContext({ subject: value, selectedId: "" })} options={[{ value: "all", label: "全部主体" }, ...subjects.map((subject) => ({ value: subject, label: subject }))]} />
      <DCSelect label="事项形成时间" value={rangeFilter} onChange={(value) => changeContext({ range: value, selectedId: "" })} options={[{ value: "all", label: "全部时间" }, { value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }]} />
    </div>
  </div>;

  return <div className="page-shell workbench-page portfolio-leader-workbench">
    <DCPageHeader eyebrow="决策工作台" title={scope === "pending" ? "待我决策" : "已处理"} description={scope === "pending" ? "聚焦需要您判断的决策事项；链路异常由决策运营概览集中处理。" : "查看已处理、已拒绝或已请求补充信息的决定。"} actions={<><DCButton icon="ListTodo" onClick={() => onNavigate("tasks")}>追踪待办</DCButton><DCButton icon="Gauge" onClick={() => onNavigate("overview")}>查看运营概览</DCButton></>} />
    {route.query.from === "overview" ? <div className="return-context content-panel"><div><DCIcon name="CornerUpLeft" /><span>已沿用运营概览的来源与时间范围</span></div><DCButton size="sm" onClick={() => window.history.back()}>返回运营概览</DCButton></div> : null}
    <div className="portfolio-leader-metrics">
      <button type="button" className={`decision-count ${scope === "pending" ? "active" : ""}`} onClick={() => changeContext({ scope: "pending", selectedId: "" })}><span><DCIcon name="Scale" /></span><div><small>待我决策</small><strong>{pendingWithinFilters.length}</strong><em>只包含可以进入人工判断的决策事项</em></div><DCIcon name="ChevronRight" /></button>
      <button type="button" className={`handled-count ${scope === "handled" ? "active" : ""}`} onClick={() => changeContext({ scope: "handled", selectedId: "" })}><span><DCIcon name="CheckCheck" /></span><div><small>已处理</small><strong>{handledRequests.length}</strong><em>{handledBreakdown.confirmed} 已处理 · {handledBreakdown.rejected} 已拒绝 · {handledBreakdown.supplement} 已请求补充信息</em></div><DCIcon name="ChevronRight" /></button>
    </div>
    {scope === "pending" ? <AISummaryPanel scope="workbench" requests={pendingWithinFilters} contextLabel={aiContextLabel} contextSignature={aiSignature} onNavigate={onNavigate} persisted={data.aiSummaries?.workbench} onPersist={(next) => updateAISummary("workbench", next)} /> : null}
    <PortfolioDecisionWorkspace requests={filteredRequests} tasks={data.tasks} selected={selected} scope={scope} layout={layout} dimension={portfolioDimension} toolbar={toolbar} onLayout={(next) => changeContext({ layout: next })} onDimension={(next) => changeContext({ portfolioDimension: next })} onSelect={(item) => changeContext({ selectedId: item.id })} onNavigate={onNavigate} onDecision={setDecisionMode} onClearFilters={() => changeContext({ search: "", source: "all", subject: "all", range: "all", selectedId: "" })} />
    {selected ? <DecisionModal open={Boolean(decisionMode)} request={selected} mode={decisionMode || "confirm"} onClose={() => setDecisionMode(null)} onSubmit={async (mode, form, onProgress) => { const result = await submitDecision(selected.id, mode, form, onProgress); if (result.ok) setDecisionMode(null); return result; }} /> : null}
  </div>;
}

function LegacyWorkbenchScreen({ data, onNavigate, submitDecision, updateAISummary }) {
  const route = parseDecisionRoute();
  const stored = getStoredView().workbench || {};
  const requestedView = ["reminders", "requests"].includes(route.query.view) ? route.query.view : stored.view || "reminders";
  const [view, setView] = useState(requestedView);
  const [search, setSearch] = useState(decisionQueryValue(route.query, "q", stored.search || ""));
  const [sourceFilter, setSourceFilter] = useState(decisionQueryValue(route.query, "source", stored.source || "all"));
  const [statusFilter, setStatusFilter] = useState(decisionQueryValue(route.query, "status", stored.status || "all"));
  const [rangeFilter, setRangeFilter] = useState(decisionQueryValue(route.query, "range", stored.range || "all"));
  const [layout, setLayout] = useState(decisionQueryValue(route.query, "layout", stored.layout || (window.innerWidth <= 760 ? "cards" : "list")));
  const [selectedId, setSelectedId] = useState(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
  const [portfolioDimension, setPortfolioDimension] = useState(decisionQueryValue(route.query, "group", stored.portfolioDimension || "subject"));
  const [decisionMode, setDecisionMode] = useState(null);

  useEffect(() => {
    setView(requestedView);
    setSearch(decisionQueryValue(route.query, "q", stored.search || ""));
    setSourceFilter(decisionQueryValue(route.query, "source", stored.source || "all"));
    setStatusFilter(decisionQueryValue(route.query, "status", stored.status || "all"));
    setRangeFilter(decisionQueryValue(route.query, "range", stored.range || "all"));
    setSelectedId(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
  }, [requestedView, route.query.q, route.query.source, route.query.status, route.query.range, route.query.selected]);

  const changeContext = (patch) => {
    const next = { view, search, source: sourceFilter, status: statusFilter, range: rangeFilter, layout, selectedId, portfolioDimension, ...patch };
    setView(next.view); setSearch(next.search); setSourceFilter(next.source); setStatusFilter(next.status); setRangeFilter(next.range); setLayout(next.layout); setSelectedId(next.selectedId); setPortfolioDimension(next.portfolioDimension);
    saveStoredView({ workbench: next });
    const params = new URLSearchParams();
    if (next.view !== "reminders") params.set("view", next.view);
    if (next.search) params.set("q", next.search);
    if (next.source !== "all") params.set("source", next.source);
    if (next.status !== "all") params.set("status", next.status);
    if (next.range !== "all") params.set("range", next.range);
    if (next.layout !== "list") params.set("layout", next.layout);
    if (next.selectedId) params.set("selected", next.selectedId);
    if (next.portfolioDimension !== "subject") params.set("group", next.portfolioDimension);
    onNavigate(`workbench${params.toString() ? `?${params.toString()}` : ""}`, {}, true);
  };

  const awaitingCount = data.requests.filter((item) => item.status === "awaiting").length;
  const supplementCount = data.requests.filter((item) => item.status === "supplement_requested").length;
  const blockedCount = data.requests.filter((item) => DECISION_CHANGE_STATUSES.includes(item.status)).length;
  const today = dateOnly(new Date());
  const confirmedCount = data.requests.filter((item) => ["decision_saved", "confirmed", "create_failed"].includes(item.status) && item.decision?.type === "confirm" && item.decision.time.startsWith(today)).length;
  const rejectedCount = data.requests.filter((item) => item.status === "rejected" && item.decision?.time.startsWith(today)).length;
  const directoryRequests = view === "requests" ? expandDecisionRequests(data.requests) : data.requests.filter(requestHasReminder);
  const filteredRequests = directoryRequests.filter((item) => {
    const haystack = `${item.subjectName} ${item.id} ${item.reminderId || ""} ${item.metric.name} ${item.actionType.name} ${item.owner}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesSource = sourceFilter === "all" || item.sourceType === sourceFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "attention" ? DECISION_CHANGE_STATUSES.includes(item.status)
        : statusFilter === "operations_attention" ? OPERATIONS_ATTENTION_STATUSES.includes(item.status)
        : statusFilter === "decided" ? ["decision_saved", "confirmed", "create_failed", "rejected"].includes(item.status)
          : item.status === statusFilter);
    const matchesRange = inDecisionRange(item.requestTime, rangeFilter);
    return matchesSearch && matchesSource && matchesStatus && matchesRange;
  });
  const selected = filteredRequests.find((item) => item.id === selectedId) || filteredRequests[0] || null;
  const contextLabel = `${view === "requests" ? "行动申请" : "决策提醒"} · ${sourceFilter === "all" ? "全部来源" : SOURCE_META[sourceFilter].label} · ${statusFilter === "all" ? "全部状态" : statusFilter === "attention" ? "异常与变化" : statusFilter === "operations_attention" ? "需要关注" : statusFilter === "decided" ? "已决定" : requestStatusLabel({ status: statusFilter })} · ${rangeFilter === "7d" ? "近 7 日" : rangeFilter === "30d" ? "近 30 日" : "全部时间"}${search ? ` · 搜索“${search}”` : ""}`;
  const signature = `${contextLabel}|${filteredRequests.map((item) => `${item.id}:${item.status}`).join(",")}`;

  const toolbar = <div className="panel-toolbar split">
    <DCTabs value={view} onChange={(next) => changeContext({ view: next, status: "all", selectedId: "" })} items={[
      { value: "reminders", label: "决策提醒", icon: "BellRing", count: data.requests.filter(requestHasReminder).length },
      { value: "requests", label: "行动申请", icon: "Waypoints", count: data.requests.length + data.requests.reduce((sum, item) => sum + item.duplicateRequests.length, 0) },
    ]} />
    <div className="toolbar-actions">
      <DCSearch value={search} onChange={(value) => changeContext({ search: value })} placeholder="搜索主体、请求或指标" />
      <DCSelect label="来源" value={sourceFilter} onChange={(value) => changeContext({ source: value })} options={[
        { value: "all", label: "全部来源" }, { value: "rule", label: "Rule 自动命中" }, { value: "qa", label: "智能问数" }, { value: "agent", label: "Agent 应用" }, { value: "report", label: "报告中心仪表盘" },
      ]} />
      <DCSelect label="状态" value={statusFilter} onChange={(value) => changeContext({ status: value })} options={[
        { value: "all", label: "全部状态" }, { value: "awaiting", label: "待确认" }, { value: "supplement_requested", label: "待补充信息" }, { value: "decided", label: "已决定" }, { value: "confirmed", label: "已处理" }, { value: "rejected", label: "已拒绝" }, { value: "attention", label: "异常与变化" }, { value: "operations_attention", label: "需要关注" },
      ]} />
      <DCSelect label="请求时间" value={rangeFilter} onChange={(value) => changeContext({ range: value })} options={[{ value: "all", label: "全部时间" }, { value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }]} />
      {DC_UI_VARIANT === "queue" ? <div className="layout-toggle" aria-label="展示方式"><DCIconButton icon="Rows3" label="列表展示" active={layout === "list"} onClick={() => changeContext({ layout: "list" })} /><DCIconButton icon="LayoutGrid" label="卡片展示" active={layout === "cards"} onClick={() => changeContext({ layout: "cards" })} /></div> : null}
    </div>
  </div>;

  return (
    <div className="page-shell workbench-page">
      <DCPageHeader eyebrow="决策工作台" title="需要人工判断的行动" description="按业务主体核对触发原因、固定证据和建议，再决定是否交给负责人执行。" actions={<><DCButton icon="ListTodo" onClick={() => onNavigate("tasks")}>追踪待办</DCButton><DCButton icon="Gauge" onClick={() => onNavigate("overview")}>查看运营概览</DCButton></>} />
      <div className="exclusive-metrics workbench-summary">
        <button type="button" onClick={() => changeContext({ view: "reminders", status: "awaiting", selectedId: "" })}><span className="summary-icon warning"><DCIcon name="Clock3" /></span><div><strong>{awaitingCount}</strong><small>待确认提醒</small></div><DCIcon name="ChevronRight" /></button>
        <button type="button" onClick={() => changeContext({ view: "reminders", status: "supplement_requested", selectedId: "" })}><span className="summary-icon blue"><DCIcon name="MessageSquarePlus" /></span><div><strong>{supplementCount}</strong><small>待补充信息</small></div><DCIcon name="ChevronRight" /></button>
        <button type="button" onClick={() => changeContext({ view: "requests", status: "attention", selectedId: "" })}><span className="summary-icon danger"><DCIcon name="ShieldAlert" /></span><div><strong>{blockedCount}</strong><small>阻断与变化</small></div><DCIcon name="ChevronRight" /></button>
        <button type="button" onClick={() => changeContext({ view: "reminders", status: "confirmed", selectedId: "" })}><span className="summary-icon success"><DCIcon name="CircleCheck" /></span><div><strong>{confirmedCount}</strong><small>已处理</small></div><DCIcon name="ChevronRight" /></button>
        <button type="button" onClick={() => changeContext({ view: "reminders", status: "rejected", selectedId: "" })}><span className="summary-icon neutral"><DCIcon name="CircleMinus" /></span><div><strong>{rejectedCount}</strong><small>已拒绝</small></div><DCIcon name="ChevronRight" /></button>
      </div>
      <AISummaryPanel scope="workbench" requests={filteredRequests} contextLabel={contextLabel} contextSignature={signature} onNavigate={onNavigate} persisted={data.aiSummaries?.workbench} onPersist={(next) => updateAISummary("workbench", next)} />

      {DC_UI_VARIANT === "queue" ? <div className="queue-workspace">
        <section className="content-panel queue-list workbench-panel">{toolbar}<RequestDirectory requests={filteredRequests} mode={view} layout={layout} onNavigate={onNavigate} onSelect={(item) => changeContext({ selectedId: item.id })} selectedId={selected?.id} onClearFilters={() => changeContext({ search: "", source: "all", status: "all", range: "all", selectedId: "" })} /></section>
        <WorkbenchPreview request={selected} view={view} onNavigate={onNavigate} onDecision={setDecisionMode} />
      </div> : null}
      {DC_UI_VARIANT === "continuous" ? <ContinuousWorkbench requests={filteredRequests} selected={selected} view={view} toolbar={toolbar} onSelect={(item) => changeContext({ selectedId: item.id })} onNavigate={onNavigate} onDecision={setDecisionMode} /> : null}
      {DC_UI_VARIANT === "portfolio" ? <PortfolioWorkbench requests={filteredRequests} dimension={portfolioDimension} onDimension={(value) => changeContext({ portfolioDimension: value })} toolbar={toolbar} onNavigate={onNavigate} /> : null}
      {selected ? <DecisionModal open={Boolean(decisionMode)} request={selected} mode={decisionMode || "confirm"} onClose={() => setDecisionMode(null)} onSubmit={async (mode, form, onProgress) => { const result = await submitDecision(selected.id, mode, form, onProgress); if (result.ok) setDecisionMode(null); return result; }} /> : null}
    </div>
  );
}

function RequestDirectory({ requests, mode, layout, onNavigate, onSelect, selectedId, onClearFilters }) {
  if (!requests.length) return <DCEmpty title="没有符合条件的记录" description="调整搜索词或筛选条件后重新查看。" action={<DCButton icon="RotateCcw" onClick={onClearFilters}>清除筛选</DCButton>} />;
  if (layout === "list" && onSelect && DC_UI_VARIANT === "queue") {
    return (
      <div className="queue-records">
        {requests.map((item) => (
          <article className={`queue-item ${selectedId === item.id ? "selected" : ""}`} key={item.id} role="button" tabIndex="0" onClick={() => onSelect(item)} onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) onSelect(item); }}>
            <header><DCSourceBadge type={item.sourceType} compact /><DCStatus status={item.status} compact /></header>
            <div className="queue-item-title"><strong>{item.subjectName}</strong><span>{item.metric.name} {item.metric.value}</span></div>
            <p>{item.rule?.hitEvidence || item.metric.explanation}</p>
            <footer><span>{item.owner} · 截至 {item.evidence.cutoff.split(" ")[0]}</span><DCButton size="sm" icon="ArrowRight" onClick={(event) => { event.stopPropagation(); onNavigate(mode === "requests" || !item.reminderId ? `request/${item.id}` : `reminder/${item.reminderId}`); }}>查看详情</DCButton></footer>
          </article>
        ))}
      </div>
    );
  }
  if (layout === "cards") {
    return (
      <div className="record-card-grid">
        {requests.map((item) => (
          <article className={`record-card ${selectedId === item.id ? "selected" : ""}`} key={item.id} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={() => onSelect && onSelect(item)} onKeyDown={(event) => { if (onSelect && ["Enter", " "].includes(event.key)) onSelect(item); }}>
            <header><DCSourceBadge type={item.sourceType} compact /><DCStatus status={item.status} compact /></header>
            <div className="record-card-title"><span>{item.subjectName}</span><strong>{item.metric.name}</strong></div>
            <div className="record-primary"><strong>{item.metric.value}</strong><span>{item.metric.explanation}</span></div>
            <dl><div><dt>行动类型</dt><dd>{item.actionType.name}</dd></div><div><dt>负责人</dt><dd>{item.owner}</dd></div><div><dt>数据截至</dt><dd>{item.evidence.cutoff}</dd></div></dl>
            <footer><span>{mode === "requests" ? item.id : item.reminderId}</span><DCButton size="sm" icon="ArrowRight" onClick={(event) => { event.stopPropagation(); onNavigate(mode === "requests" || !item.reminderId ? `request/${item.id}` : `reminder/${item.reminderId}`); }}>查看详情</DCButton></footer>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="record-table-wrap">
      <table className="record-table">
        <thead><tr><th>业务主体</th><th>触发原因 / 指标</th><th>来源</th><th>建议负责人</th><th>状态</th><th>生成时间</th><th></th></tr></thead>
        <tbody>{requests.map((item) => (
          <tr key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => onSelect && onSelect(item)}>
            <td><strong>{item.subjectName}</strong><small>{item.subjectId}</small></td>
            <td><strong>{item.rule ? `${item.rule.id} ${item.rule.name}` : item.metric.name}</strong><small>{item.metric.name} {item.metric.value}</small></td>
            <td><DCSourceBadge type={item.sourceType} compact /><small>{item.id}</small></td>
            <td><span>{item.owner}</span><small>{item.actionType.name}</small></td>
            <td><DCStatus status={item.status} compact />{item.duplicateRequests.length ? <small>{item.duplicateRequests.length + 1} 个来源请求</small> : null}</td>
            <td><span className="mono table-time">{item.generatedTime}</span><small>截至 {item.evidence.cutoff.split(" ")[0]}</small></td>
            <td><DCButton size="sm" icon="ArrowRight" onClick={(event) => { event.stopPropagation(); onNavigate(mode === "requests" || !item.reminderId ? `request/${item.id}` : `reminder/${item.reminderId}`); }}>查看详情</DCButton></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function DecisionLifecycle({ request, compact = false }) {
  if (DC_UI_VARIANT === "portfolio" && request.duplicateOf) {
    return <div className={`decision-lifecycle ${compact ? "compact" : ""}`}>
      <span className="done"><DCIcon name={SOURCE_META[request.sourceType].icon} /><em>来源</em></span><i></i>
      <span className="done"><DCIcon name="Waypoints" /><em>行动申请</em></span><i></i>
      <span className="done"><DCIcon name="Link2" /><em>关联既有事项</em></span><i></i>
      <span className="future"><DCIcon name="Scale" /><em>不单独决定</em></span><i></i>
      <span className="future"><DCIcon name="ListTodo" /><em>不重复建待办</em></span>
    </div>;
  }
  const decided = ["decision_saved", "confirmed", "create_failed", "rejected"].includes(request.status) || request.taskCreating;
  const confirmed = ["decision_saved", "confirmed", "create_failed"].includes(request.status) || request.taskCreating;
  return <div className={`decision-lifecycle ${compact ? "compact" : ""}`}>
    <span className="done"><DCIcon name={SOURCE_META[request.sourceType].icon} /><em>来源</em></span><i></i>
    <span className="done"><DCIcon name="Waypoints" /><em>行动申请</em></span><i></i>
    <span className={requestHasReminder(request) ? "done" : "stopped"}><DCIcon name="BellRing" /><em>{DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}</em></span><i></i>
    <span className={decided ? "done" : request.status === "awaiting" ? "current" : "stopped"}><DCIcon name="Scale" /><em>{decided ? (confirmed ? "已确认" : "已拒绝") : "人工判断"}</em></span><i></i>
    <span className={request.taskId ? "done" : confirmed ? "current" : "future"}><DCIcon name="ListTodo" /><em>{request.taskCreating ? "创建中" : "负责人待办"}</em></span>
  </div>;
}

function WorkbenchPreview({ request, view, onNavigate, onDecision }) {
  if (!request) return <aside className="content-panel queue-preview"><DCEmpty icon="MousePointer2" title="选择一条记录" description="当前筛选没有可预览内容。" /></aside>;
  const blocked = !requestCanDecide(request) && !["decision_saved", "confirmed", "rejected", "create_failed"].includes(request.status) && !request.taskCreating;
  return <aside className="content-panel queue-preview">
    <header className="preview-head"><div><DCSourceBadge type={request.sourceType} compact /><h2>{request.subjectName}</h2><p>{request.metric.name} {request.metric.value}</p></div><DCStatus status={request.status} compact /></header>
    <DecisionLifecycle request={request} compact />
    {blocked ? <DCAlert tone="warning" title="当前不能确认">{request.blockReason || "需要先处理证据或来源变化。"}</DCAlert> : null}
    <div className="preview-facts">
      <div><span>触发原因</span><strong>{request.rule ? `${request.rule.id} ${request.rule.name}` : `${SOURCE_META[request.sourceType].label}提出建议`}</strong><p>{request.rule?.hitEvidence || request.metric.explanation}</p></div>
      <div><span>推荐决策</span><strong>{request.recommendation}</strong><p>{request.banks.length ? `优先协商 ${request.banks.map((item) => item.name).join("、")}` : "等待可核对的银行证据"}</p></div>
      <dl><div><dt>行动类型</dt><dd>{request.actionType.name} · {request.actionType.version}</dd></div><div><dt>建议负责人</dt><dd>{request.owner}</dd></div><div><dt>数据截至</dt><dd>{request.evidence.cutoff}</dd></div><div><dt>证据状态</dt><dd>{request.evidence.freshness}</dd></div></dl>
    </div>
    <footer className="preview-actions"><DCButton icon="Route" onClick={() => onNavigate(`trace/${view === "requests" || !request.reminderId ? "request" : "reminder"}/${view === "requests" || !request.reminderId ? request.id : request.reminderId}`)}>查看追溯</DCButton><DCButton variant="primary" icon="ArrowRight" onClick={() => onNavigate(view === "requests" || !request.reminderId ? `request/${request.id}` : `reminder/${request.reminderId}`)}>查看详情</DCButton></footer>
    {requestCanDecide(request) ? <div className="preview-decision-actions"><DCButton onClick={() => onDecision("reject")}>拒绝</DCButton><DCButton variant="primary" onClick={() => onDecision("confirm")}>确认并交办</DCButton></div> : null}
  </aside>;
}

function ContinuousWorkbench({ requests, selected, view, toolbar, onSelect, onNavigate, onDecision }) {
  return <section className="content-panel continuous-workspace">
    {toolbar}
    <div className="continuous-body">
      <aside className="continuous-queue" aria-label="待判断队列">
        <div className="continuous-queue-head"><strong>当前范围</strong><span>{requests.length} 条</span></div>
        {requests.length ? requests.map((item) => <button type="button" key={item.id} className={selected?.id === item.id ? "active" : ""} onClick={() => onSelect(item)}><span className={`attention-icon ${SOURCE_META[item.sourceType].tone}`}><DCIcon name={SOURCE_META[item.sourceType].icon} /></span><div><strong>{item.subjectName}</strong><small>{item.metric.name} {item.metric.value}</small><em>{item.owner}</em></div><DCStatus status={item.status} compact /></button>) : <DCEmpty icon="Inbox" title="当前没有记录" description="调整筛选条件后重新查看。" />}
      </aside>
      {selected ? <main className="continuous-canvas">
        <header className="continuous-title"><div><span>当前问题</span><h2>{selected.subjectName} · {selected.metric.name} {selected.metric.value}</h2><p>{selected.metric.explanation}</p></div><DCStatus status={selected.status} /></header>
        <DecisionLifecycle request={selected} />
        <div className="continuous-context-grid">
          <section><span>为什么产生</span><strong>{selected.rule ? selected.rule.name : `${SOURCE_META[selected.sourceType].label}提出建议`}</strong><p>{selected.rule?.hitEvidence || "规则条件引用：不适用。当前依据来自已固定的来源证据。"}</p></section>
          <section><span>建议怎么处理</span><strong>{selected.recommendation}</strong><p>{selected.banks.length ? `优先银行：${selected.banks.map((item) => item.name).join("、")}` : "银行证据尚不可核对"}</p></section>
        </div>
        <div className="continuous-evidence-strip"><div><span>行动类型</span><strong>{selected.actionType.name} · {selected.actionType.version}</strong></div><div><span>负责人</span><strong>{selected.owner}</strong></div><div><span>语义 / 数据版本</span><strong>{selected.evidence.semanticVersion} / {selected.evidence.dataVersion}</strong></div><div><span>数据截至</span><strong>{selected.evidence.cutoff}</strong></div><div><span>证据状态</span><strong>{selected.evidence.freshness}</strong></div></div>
        {!["awaiting", "confirmed", "rejected", "create_failed"].includes(selected.status) ? <DCAlert tone="warning" title="当前行动需要先恢复证据">{selected.blockReason || selected.recovery || "请查看来源变化和恢复建议。"}</DCAlert> : null}
        <div className="continuous-actions"><DCButton icon="Route" onClick={() => onNavigate(`trace/${view === "requests" || !selected.reminderId ? "request" : "reminder"}/${view === "requests" || !selected.reminderId ? selected.id : selected.reminderId}`)}>查看追溯</DCButton><DCButton icon="FileSearch" onClick={() => onNavigate(view === "requests" || !selected.reminderId ? `request/${selected.id}` : `reminder/${selected.reminderId}`)}>查看全部证据</DCButton>{requestCanDecide(selected) ? <><DCButton onClick={() => onDecision("reject")}>拒绝</DCButton><DCButton variant="primary" icon="CircleCheckBig" onClick={() => onDecision("confirm")}>确认并交办</DCButton></> : null}</div>
      </main> : <main className="continuous-canvas"><DCEmpty icon="Inbox" title="当前没有待判断内容" description="切换来源、状态或清除搜索条件后重新查看。" /></main>}
    </div>
  </section>;
}

function PortfolioDecisionWorkspace({ requests, tasks, selected, scope, layout, dimension, toolbar, onLayout, onDimension, onSelect, onNavigate, onDecision, onClearFilters }) {
  const groupLabel = { subject: "单位组合", owner: "负责人组合", action: "行动组合" };
  const groups = requests.reduce((acc, item) => {
    const key = dimension === "owner" ? item.owner : dimension === "action" ? item.actionType.name : item.subjectName;
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  const taskByRequest = Object.fromEntries(tasks.map((task) => [task.requestId, task]));
  const taskFor = (request) => taskByRequest[request.canonicalRequestId || request.duplicateOf || request.id] || null;
  const detailTarget = (item) => `reminder/${item.reminderId}`;

  const card = (item) => {
    const task = taskFor(item);
    return <article className={`portfolio-card decision-portfolio-card ${selected?.id === item.id ? "selected" : ""}`} key={item.id} role="button" tabIndex="0" onClick={() => onSelect(item)} onKeyDown={(event) => { if (["Enter", " "].includes(event.key)) onSelect(item); }}>
      <div className="portfolio-card-head"><DCSourceBadge type={item.sourceType} compact /><DCStatus {...portfolioDecisionItemStatus(item)} compact /></div>
      <h3>{item.subjectName} · {item.metric.name}</h3>
      <p className="portfolio-metric"><strong>{item.metric.value}</strong><span>{item.metric.explanation}</span></p>
      <dl><div><dt>负责人</dt><dd>{item.owner}</dd></div><div><dt>行动类型</dt><dd>{item.actionType.name}</dd></div><div><dt>事项状态</dt><dd>{portfolioDecisionItemLabel(item)}</dd></div><div><dt>来源</dt><dd>{SOURCE_META[item.sourceType].label}</dd></div><div><dt>负责人待办</dt><dd>{task ? PORTFOLIO_TASK_CATEGORY_META[portfolioTaskCategory(task)]?.label || requestStatusLabel(task) : "未形成"}</dd></div><div><dt>事项形成时间</dt><dd>{item.generatedTime}</dd></div></dl>
      <footer><span className="mono">{item.reminderId}</span><DCButton size="sm" icon="ArrowRight" onClick={(event) => { event.stopPropagation(); onSelect(item); onNavigate(detailTarget(item)); }}>查看详情</DCButton></footer>
    </article>;
  };

  return <section className="content-panel portfolio-workspace portfolio-decision-workspace">
    {toolbar}
    <div className="portfolio-viewbar portfolio-viewbar-controls-only">
      <div className="portfolio-view-controls">
        <DCTabs value={dimension} onChange={onDimension} items={[{ value: "subject", label: "单位组合", icon: "Building2" }, { value: "owner", label: "负责人组合", icon: "Users" }, { value: "action", label: "行动组合", icon: "Target" }]} />
        <DCTabs value={layout} onChange={onLayout} items={[{ value: "groups", label: "组合视图", icon: "LayoutGrid" }, { value: "list", label: "列表视图", icon: "Rows3" }]} />
      </div>
    </div>
    <div className="portfolio-master-detail">
      <main className="portfolio-directory">
        {!requests.length ? <DCEmpty icon={scope === "pending" ? "CircleCheckBig" : "History"} title={scope === "pending" ? "当前没有待我决策事项" : "当前没有已处理事项"} description={scope === "pending" ? "调整筛选，或等待新的决策事项形成。" : "确认、拒绝或请求补充信息后，记录会出现在这里。"} action={<DCButton icon="RotateCcw" onClick={onClearFilters}>清除筛选</DCButton>} /> : null}
        {requests.length && layout === "groups" ? <div className="portfolio-grid">{Object.entries(groups).map(([key, items]) => <section className="portfolio-group" key={key}><header><div><span>{groupLabel[dimension]}</span><h2>{key}</h2></div><strong>{items.length} 条独立记录</strong></header><div>{items.map(card)}</div></section>)}</div> : null}
        {requests.length && layout === "list" ? <div className="record-table-wrap portfolio-decision-table"><table className="record-table"><thead><tr><th>业务主体</th><th>负责人</th><th>行动类型</th><th>来源</th><th>事项状态</th><th>决定状态</th><th>待办状态</th><th>形成时间</th><th></th></tr></thead><tbody>{requests.map((item) => { const task = taskFor(item); return <tr key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => onSelect(item)}><td><strong>{item.subjectName}</strong><small>{item.metric.name} {item.metric.value}</small></td><td><span>{item.owner}</span><small>{item.subjectId}</small></td><td><span>{item.actionType.name}</span><small>{item.actionType.version}</small></td><td><DCSourceBadge type={item.sourceType} compact /><small className="mono">请求 {item.id}</small></td><td><DCStatus {...portfolioDecisionItemStatus(item)} compact /><small>{item.reminderId}</small></td><td><span>{portfolioDecisionLabel(item)}</span><small>{item.decision?.time || item.supplement?.time || "尚未决定"}</small></td><td>{task ? <DCStatus status={task.status} suffix={task.overdue ? " · 已逾期" : ""} compact /> : <span className="plain-chip">未形成</span>}</td><td><span className="mono table-time">{item.generatedTime}</span><small>数据截至 {item.evidence.cutoff.split(" ")[0]}</small></td><td><DCButton size="sm" icon="ArrowRight" onClick={(event) => { event.stopPropagation(); onSelect(item); onNavigate(detailTarget(item)); }}>查看详情</DCButton></td></tr>; })}</tbody></table></div> : null}
      </main>
      <PortfolioDecisionPreview request={selected} task={selected ? taskFor(selected) : null} onNavigate={onNavigate} onDecision={onDecision} />
    </div>
  </section>;
}

function PortfolioDecisionPreview({ request, task, onNavigate, onDecision }) {
  if (!request) return <aside className="portfolio-decision-preview"><DCEmpty icon="MousePointer2" title="当前没有可查看事项" description="调整筛选条件后重新查看。" /></aside>;
  const guidance = portfolioDecisionGuidance(request);
  return <aside className="portfolio-decision-preview">
    <header><div><span>当前决策事项</span><h2>{request.subjectName}</h2><p>{request.metric.name} {request.metric.value}</p></div><DCStatus {...portfolioDecisionItemStatus(request)} /></header>
    {portfolioBasisChanged(request) ? <DCAlert tone="warning" title="依据已变化">本记录保留送达时的固定证据，不会重新进入“待我决策”。请从变更记录核对撤回、纠正或替代事实。</DCAlert> : null}
    <DecisionLifecycle request={request} compact />
    <div className="portfolio-preview-sections">
      <section><span>为什么产生</span><strong>{request.rule ? request.rule.name : `${SOURCE_META[request.sourceType].label}提出建议`}</strong><p>{request.rule?.hitEvidence || request.metric.explanation}</p></section>
      <section><span>推荐决策</span><strong>{guidance.direction}</strong><p>{guidance.reason}</p></section>
      <section><span>建议怎么做</span><strong>{request.recommendation}</strong><p>{request.banks.length ? `优先协商：${request.banks.slice(0, 3).map((item) => item.name).join("、")}` : "尚缺可核对的银行证据"}</p></section>
      <section><span>预期影响</span><strong>{portfolioExpectedImpact(request)}</strong><p>证据状态：{guidance.evidence}</p></section>
    </div>
    <dl className="portfolio-preview-facts"><div><dt>负责人</dt><dd>{request.owner}</dd></div><div><dt>行动类型</dt><dd>{request.actionType.name} · {request.actionType.version}</dd></div><div><dt>事项状态</dt><dd>{portfolioReminderLabel(request)}</dd></div><div><dt>决定状态</dt><dd>{portfolioDecisionLabel(request)}</dd></div><div><dt>负责人待办</dt><dd>{task ? PORTFOLIO_TASK_CATEGORY_META[portfolioTaskCategory(task)]?.label || DC_STATUS_META[task.status]?.label : "未形成"}</dd></div><div><dt>数据截至</dt><dd>{request.evidence.cutoff}</dd></div></dl>
    <div className="portfolio-preview-actions">
      <DCButton icon="Waypoints" onClick={() => onNavigate(portfolioRequestDetailTarget(request.id))}>查看原始行动申请</DCButton>
      {task ? <DCButton icon="ListTodo" onClick={() => onNavigate(`task/${task.id}`)}>查看执行进展</DCButton> : null}
      <DCButton variant="primary" icon="ArrowRight" onClick={() => onNavigate(`reminder/${request.reminderId}`)}>查看详情</DCButton>
    </div>
    {requestCanDecide(request) ? <div className="preview-decision-actions"><DCButton onClick={() => onDecision("reject")}>拒绝</DCButton><DCButton icon="MessageSquarePlus" onClick={() => onNavigate(`reminder/${request.reminderId}`)}>请求补充信息</DCButton><DCButton variant="primary" onClick={() => onDecision("confirm")}>确认并交办</DCButton></div> : null}
  </aside>;
}

function PortfolioWorkbench({ requests, dimension, onDimension, toolbar, onNavigate }) {
  const groupLabel = { subject: "单位组合", owner: "负责人组合", action: "行动组合" };
  const groups = requests.reduce((acc, item) => {
    const key = dimension === "owner" ? item.owner : dimension === "action" ? `${item.actionType.name} · ${item.rule ? item.rule.name : "非 Rule 建议"}` : item.subjectName;
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
  return <section className="content-panel portfolio-workspace">
    {toolbar}
    <div className="portfolio-toolbar"><div><strong>组合视图</strong><span>分组只改变展示，不合并不同主体的提醒、决定或待办。</span></div><DCTabs value={dimension} onChange={onDimension} items={[{ value: "subject", label: "单位组合", icon: "Building2" }, { value: "owner", label: "负责人组合", icon: "Users" }, { value: "action", label: "行动组合", icon: "Target" }]} /></div>
    {Object.keys(groups).length ? <div className="portfolio-grid">{Object.entries(groups).map(([key, items]) => <section className="portfolio-group" key={key}><header><div><span>{groupLabel[dimension]}</span><h2>{key}</h2></div><strong>{items.length} 项</strong></header><div>{items.map((item) => <article className="portfolio-card" key={item.id}><div className="portfolio-card-head"><DCSourceBadge type={item.sourceType} compact /><DCStatus status={item.status} compact /></div><h3>{item.subjectName} · {item.metric.name}</h3><p className="portfolio-metric"><strong>{item.metric.value}</strong><span>{item.metric.explanation}</span></p><dl><div><dt>行动类型</dt><dd>{item.actionType.name}</dd></div><div><dt>Rule 条件</dt><dd>{item.rule ? `${item.rule.id} ${item.rule.name}` : "不适用"}</dd></div><div><dt>负责人</dt><dd>{item.owner}</dd></div><div><dt>数据截至</dt><dd>{item.evidence.cutoff}</dd></div></dl><footer><span className="mono">{item.reminderId || item.id}</span><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(requestHasReminder(item) ? `reminder/${item.reminderId}` : `request/${item.id}`)}>查看详情</DCButton></footer></article>)}</div></section>)}</div> : <DCEmpty icon="Layers3" title="当前没有组合记录" description="调整搜索或筛选条件后重新查看。" />}
  </section>;
}

function TaskDirectory({ tasks, layout, onNavigate }) {
  if (!tasks.length) return <DCEmpty icon="ListTodo" title="没有符合条件的待办" description="待办只会在人工确认成功后创建。" />;
  if (layout === "cards") {
    return <div className="record-card-grid">{tasks.map((task) => {
      const visual = taskVisualStatus(task);
      return <article className="record-card task-card" key={task.id}>
        <header>{task.sourceType ? <DCSourceBadge type={task.sourceType} compact /> : <span className="plain-chip"><DCIcon name="Building2" size={12} />{task.subjectName}</span>}<DCStatus status={visual.status} suffix={visual.suffix} compact /></header>
        <div className="record-card-title"><strong>{task.title}</strong></div>
        <div className="task-owner"><span className="avatar-small">{task.owner.slice(-2)}</span><div><strong>{task.owner}</strong><small>到期 {task.dueDate}</small></div></div>
        <dl><div><dt>来源提醒</dt><dd>{task.reminderId}</dd></div><div><dt>行动类型</dt><dd>{task.actionType.name}</dd></div><div><dt>确认理由</dt><dd>{task.decisionReason}</dd></div><div><dt>优先银行</dt><dd>{task.banks.slice(0, 2).join("、")}</dd></div><div><dt>创建时间</dt><dd>{task.createdAt}</dd></div><div><dt>最近进展</dt><dd>{task.progress.at(-1)?.content || task.failure?.reason || task.result?.summary || task.correction?.result || "尚无进展记录"}</dd></div></dl>
        <footer><span>{task.id}</span><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`task/${task.id}`)}>查看详情</DCButton></footer>
      </article>;
    })}</div>;
  }
  return (
    <div className="record-table-wrap"><table className="record-table task-table"><thead><tr><th>待办与来源</th><th>业务主体与行动</th><th>负责人及决定</th><th>创建与到期</th><th>状态</th><th>银行与最近进展</th><th></th></tr></thead><tbody>
      {tasks.map((task) => { const visual = taskVisualStatus(task); return <tr key={task.id}>
        <td><strong>{task.title}</strong>{task.sourceType ? <DCSourceBadge type={task.sourceType} compact /> : null}<small>{task.id} · 提醒 {task.reminderId}</small></td><td><strong>{task.subjectName}</strong><small>{task.actionType.name} · {task.metricLabel}</small></td><td><span>{task.owner}</span><small>{task.decisionReason}</small></td>
        <td><span className={task.overdue ? "danger-text" : ""}>{task.dueDate}</span><small>创建 {task.createdAt}{task.overdue ? " · 已超过到期时间" : ""}</small></td>
        <td><DCStatus status={visual.status} suffix={visual.suffix} compact /></td><td><span>{task.progress.at(-1)?.content || task.failure?.reason || task.result?.summary || task.correction?.result || "尚无进展记录"}</span><small>优先银行：{task.banks.slice(0, 2).join("、")}</small></td>
        <td><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`task/${task.id}`)}>查看详情</DCButton></td>
      </tr>; })}
    </tbody></table></div>
  );
}

function TaskWorkspaceScreen(props) {
  return DC_UI_VARIANT === "portfolio" ? <PortfolioTaskWorkspaceScreen {...props} /> : <LegacyTaskWorkspaceScreen {...props} />;
}

function PortfolioTaskWorkspaceScreen({ data, onNavigate }) {
  const route = parseDecisionRoute();
  const stored = getStoredView().tasks || {};
  const storedLayout = ["groups", "list"].includes(stored.layout) ? stored.layout : "groups";
  const [search, setSearch] = useState(decisionQueryValue(route.query, "q", stored.search || ""));
  const [ownerFilter, setOwnerFilter] = useState(decisionQueryValue(route.query, "owner", stored.owner || "all"));
  const [subjectFilter, setSubjectFilter] = useState(decisionQueryValue(route.query, "subject", stored.subject || "all"));
  const [statusFilter, setStatusFilter] = useState(decisionQueryValue(route.query, "status", stored.status || "all"));
  const [dueFilter, setDueFilter] = useState(decisionQueryValue(route.query, "due", stored.due || "all"));
  const [actionFilter, setActionFilter] = useState(decisionQueryValue(route.query, "action", stored.action || "all"));
  const [sourceFilter, setSourceFilter] = useState(decisionQueryValue(route.query, "source", stored.source || "all"));
  const [rangeFilter, setRangeFilter] = useState(decisionQueryValue(route.query, "range", stored.range || "all"));
  const [layout, setLayout] = useState(decisionQueryValue(route.query, "layout", storedLayout));
  const [dimension, setDimension] = useState(decisionQueryValue(route.query, "group", stored.dimension || "owner"));

  useEffect(() => {
    setSearch(decisionQueryValue(route.query, "q", stored.search || ""));
    setOwnerFilter(decisionQueryValue(route.query, "owner", stored.owner || "all"));
    setSubjectFilter(decisionQueryValue(route.query, "subject", stored.subject || "all"));
    setStatusFilter(decisionQueryValue(route.query, "status", stored.status || "all"));
    setDueFilter(decisionQueryValue(route.query, "due", stored.due || "all"));
    setActionFilter(decisionQueryValue(route.query, "action", stored.action || "all"));
    setSourceFilter(decisionQueryValue(route.query, "source", stored.source || "all"));
    setRangeFilter(decisionQueryValue(route.query, "range", stored.range || "all"));
    setLayout(decisionQueryValue(route.query, "layout", storedLayout));
    setDimension(decisionQueryValue(route.query, "group", stored.dimension || "owner"));
  }, [route.query.q, route.query.owner, route.query.subject, route.query.status, route.query.due, route.query.action, route.query.source, route.query.range, route.query.layout, route.query.group]);

  const update = (patch) => {
    const next = { search, owner: ownerFilter, subject: subjectFilter, status: statusFilter, due: dueFilter, action: actionFilter, source: sourceFilter, range: rangeFilter, layout, dimension, ...patch };
    setSearch(next.search); setOwnerFilter(next.owner); setSubjectFilter(next.subject); setStatusFilter(next.status); setDueFilter(next.due); setActionFilter(next.action); setSourceFilter(next.source); setRangeFilter(next.range); setLayout(next.layout); setDimension(next.dimension);
    saveStoredView({ tasks: next });
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search);
    if (next.owner !== "all") params.set("owner", next.owner);
    if (next.subject !== "all") params.set("subject", next.subject);
    if (next.status !== "all") params.set("status", next.status);
    if (next.due !== "all") params.set("due", next.due);
    if (next.action !== "all") params.set("action", next.action);
    if (next.source !== "all") params.set("source", next.source);
    if (next.range !== "all") params.set("range", next.range);
    if (next.layout !== "groups") params.set("layout", next.layout);
    if (next.dimension !== "owner") params.set("group", next.dimension);
    onNavigate(`tasks${params.toString() ? `?${params}` : ""}`, {}, true);
  };

  const requestById = Object.fromEntries(data.requests.map((item) => [item.id, item]));
  const expandedRequests = expandDecisionRequests(data.requests);
  const owners = [...new Set(data.tasks.map((item) => item.owner))].sort();
  const subjects = [...new Set(data.tasks.map((item) => item.subjectName))].sort();
  const actionTypes = [...new Set(data.tasks.map((item) => item.actionType.name))].sort();
  const baseFiltered = data.tasks.filter((task) => {
    const request = requestById[task.requestId];
    const matchingSourceRequest = expandedRequests.some((item) => (item.canonicalRequestId || item.duplicateOf || item.id) === task.requestId
      && (sourceFilter === "all" || item.sourceType === sourceFilter)
      && inDecisionRange(item.requestTime, rangeFilter));
    const dueDays = Math.ceil((new Date(`${task.dueDate}T23:59:59`) - new Date()) / 86400000);
    return `${task.title} ${task.subjectName} ${task.owner} ${task.id}`.toLowerCase().includes(search.toLowerCase())
      && (ownerFilter === "all" || task.owner === ownerFilter)
      && (subjectFilter === "all" || task.subjectName === subjectFilter)
      && (dueFilter === "all" || (dueFilter === "overdue" ? task.overdue : dueFilter === "7d" ? !task.overdue && dueDays <= 7 : dueFilter === "later" ? dueDays > 7 : true))
      && (actionFilter === "all" || task.actionType.name === actionFilter)
      && (request ? matchingSourceRequest : sourceFilter === "all" && rangeFilter === "all");
  });
  const filtered = baseFiltered.filter((task) => statusFilter === "all"
    || (PORTFOLIO_TASK_CATEGORIES.includes(statusFilter) ? portfolioTaskCategory(task) === statusFilter
      : statusFilter === "ended" ? ["completed", "cancelled", "corrected"].includes(task.status)
        : task.status === statusFilter)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const counts = Object.fromEntries(PORTFOLIO_TASK_CATEGORIES.map((category) => [category, baseFiltered.filter((task) => portfolioTaskCategory(task) === category).length]));

  const toolbar = <div className="task-filters portfolio-task-filters">
    <DCSearch value={search} onChange={(value) => update({ search: value })} placeholder="搜索单位、待办或负责人" />
    <DCSelect label="负责人" value={ownerFilter} onChange={(value) => update({ owner: value })} options={[{ value: "all", label: "全部负责人" }, ...owners.map((owner) => ({ value: owner, label: owner }))]} />
    <DCSelect label="业务主体" value={subjectFilter} onChange={(value) => update({ subject: value })} options={[{ value: "all", label: "全部主体" }, ...subjects.map((subject) => ({ value: subject, label: subject }))]} />
    <DCSelect label="待办状态" value={statusFilter} onChange={(value) => update({ status: value })} options={[{ value: "all", label: "全部状态" }, ...PORTFOLIO_TASK_CATEGORIES.map((value) => ({ value, label: PORTFOLIO_TASK_CATEGORY_META[value].label })), { value: "completed", label: "已完成" }, { value: "cancelled", label: "已取消" }, { value: "corrected", label: "已纠正" }, { value: "ended", label: "已结束" }]} />
    <DCSelect label="到期时间" value={dueFilter} onChange={(value) => update({ due: value })} options={[{ value: "all", label: "全部到期时间" }, { value: "overdue", label: "已逾期" }, { value: "7d", label: "未来 7 日内" }, { value: "later", label: "7 日以后" }]} />
    <DCSelect label="行动类型" value={actionFilter} onChange={(value) => update({ action: value })} options={[{ value: "all", label: "全部行动类型" }, ...actionTypes.map((action) => ({ value: action, label: action }))]} />
    <DCSelect label="来源" value={sourceFilter} onChange={(value) => update({ source: value })} options={[{ value: "all", label: "全部来源" }, ...Object.entries(SOURCE_META).map(([value, item]) => ({ value, label: item.label }))]} />
    <DCSelect label="请求时间" value={rangeFilter} onChange={(value) => update({ range: value })} options={[{ value: "all", label: "全部时间" }, { value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }]} />
  </div>;

  return <div className="page-shell task-workspace-page portfolio-task-page">
    <DCPageHeader eyebrow="待办工作" title="负责人待办" description="每次人工确认形成一条独立执行记录；组合只用于组织查看，不合并主体或固定证据。" actions={<><DCButton icon="Inbox" onClick={() => onNavigate("workbench")}>返回决策工作台</DCButton><DCButton icon="Gauge" onClick={() => onNavigate("overview")}>查看运营概览</DCButton></>} />
    <div className="portfolio-task-summary">{PORTFOLIO_TASK_CATEGORIES.map((category) => <button type="button" key={category} className={counts[category] ? "has-records" : ""} onClick={() => update({ status: category })}><span><DCIcon name={PORTFOLIO_TASK_CATEGORY_META[category].icon} /></span><div><small>{PORTFOLIO_TASK_CATEGORY_META[category].label}</small><strong>{counts[category]}</strong></div><DCIcon name="ChevronRight" /></button>)}</div>
    <section className="content-panel portfolio-task-workspace">{toolbar}<PortfolioTaskDirectory tasks={filtered} requestById={requestById} layout={layout} dimension={dimension} onLayout={(next) => update({ layout: next })} onDimension={(next) => update({ dimension: next })} onNavigate={onNavigate} onClearFilters={() => update({ search: "", owner: "all", subject: "all", status: "all", due: "all", action: "all", source: "all", range: "all" })} /></section>
  </div>;
}

function PortfolioTaskDirectory({ tasks, requestById, layout, dimension, onLayout, onDimension, onNavigate, onClearFilters }) {
  const groupLabel = { subject: "单位组合", owner: "负责人组合", action: "行动组合" };
  const groups = tasks.reduce((acc, task) => {
    const key = dimension === "owner" ? task.owner : dimension === "action" ? task.actionType.name : task.subjectName;
    (acc[key] ||= []).push(task);
    return acc;
  }, {});
  const card = (task) => {
    const request = requestById[task.requestId];
    return <article className="portfolio-card task-portfolio-card" key={task.id}>
      <div className="portfolio-card-head">{request ? <DCSourceBadge type={request.sourceType} compact /> : <span className="plain-chip">来源不可用</span>}<DCStatus status={task.status} suffix={task.overdue ? " · 已逾期" : ""} compact /></div>
      <h3>{task.subjectName} · {task.actionType.name}</h3>
      <div className="task-portfolio-owner"><span className="avatar-small">{task.owner.slice(-2)}</span><div><strong>{task.owner}</strong><small>{task.id}</small></div></div>
      <dl><div><dt>决策事项</dt><dd>{task.reminderId}</dd></div><div><dt>决定状态</dt><dd>已处理</dd></div><div><dt>创建时间</dt><dd>{task.createdAt}</dd></div><div><dt>到期时间</dt><dd>{task.dueDate}</dd></div><div><dt>最近进展</dt><dd>{task.progress.at(-1)?.content || task.failure?.reason || task.result?.summary || task.correction?.result || "尚无进展"}</dd></div><div><dt>涉及银行</dt><dd>{task.banks.slice(0, 2).join("、") || "不适用"}</dd></div></dl>
      <footer><span>{task.subjectId}</span><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`task/${task.id}`)}>查看详情</DCButton></footer>
    </article>;
  };
  return <div className="portfolio-task-directory">
    <div className="portfolio-viewbar"><div><strong>负责人行动</strong><span>{tasks.length} 条独立待办</span></div><div className="portfolio-view-controls"><DCTabs value={dimension} onChange={onDimension} items={[{ value: "subject", label: "单位组合", icon: "Building2" }, { value: "owner", label: "负责人组合", icon: "Users" }, { value: "action", label: "行动组合", icon: "Target" }]} /><DCTabs value={layout} onChange={onLayout} items={[{ value: "groups", label: "组合视图", icon: "LayoutGrid" }, { value: "list", label: "列表视图", icon: "Rows3" }]} /></div></div>
    {!tasks.length ? <DCEmpty icon="ListTodo" title="当前范围没有负责人待办" description="待办只在决策中心人工确认成功后形成；可调整筛选或返回工作台处理决策事项。" action={<DCButton icon="RotateCcw" onClick={onClearFilters}>清除筛选</DCButton>} /> : null}
    {tasks.length && layout === "groups" ? <div className="portfolio-grid portfolio-task-groups">{Object.entries(groups).map(([key, items]) => <section className="portfolio-group" key={key}><header><div><span>{groupLabel[dimension]}</span><h2>{key}</h2></div><strong>{items.length} 条独立待办</strong></header><div>{items.map(card)}</div></section>)}</div> : null}
    {tasks.length && layout === "list" ? <div className="record-table-wrap portfolio-task-table"><table className="record-table"><thead><tr><th>业务主体</th><th>负责人</th><th>行动类型</th><th>来源</th><th>决策事项</th><th>决定状态</th><th>待办状态</th><th>时间</th><th></th></tr></thead><tbody>{tasks.map((task) => { const request = requestById[task.requestId]; return <tr key={task.id}><td><strong>{task.subjectName}</strong><small>{task.subjectId}</small></td><td><span>{task.owner}</span><small>{task.id}</small></td><td><span>{task.actionType.name}</span><small>{task.actionType.version}</small></td><td>{request ? <DCSourceBadge type={request.sourceType} compact /> : <span>来源不可用</span>}<small>{task.requestId}</small></td><td><span className="plain-chip">已形成决策事项</span><small>{task.reminderId}</small></td><td><span>已处理</span><small>{task.decisionReason}</small></td><td><DCStatus status={task.status} suffix={task.overdue ? " · 已逾期" : ""} compact /></td><td><span>创建 {task.createdAt}</span><small>到期 {task.dueDate}</small></td><td><DCButton size="sm" icon="ArrowRight" onClick={() => onNavigate(`task/${task.id}`)}>查看详情</DCButton></td></tr>; })}</tbody></table></div> : null}
  </div>;
}

function LegacyTaskWorkspaceScreen({ data, onNavigate }) {
  const route = parseDecisionRoute();
  const stored = getStoredView().tasks || {};
  const [search, setSearch] = useState(decisionQueryValue(route.query, "q", stored.search || ""));
  const [ownerFilter, setOwnerFilter] = useState(decisionQueryValue(route.query, "owner", stored.owner || "all"));
  const [subjectFilter, setSubjectFilter] = useState(decisionQueryValue(route.query, "subject", stored.subject || "all"));
  const [statusFilter, setStatusFilter] = useState(decisionQueryValue(route.query, "status", stored.status || "all"));
  const [dueFilter, setDueFilter] = useState(decisionQueryValue(route.query, "due", stored.due || "all"));
  const [actionFilter, setActionFilter] = useState(decisionQueryValue(route.query, "action", stored.action || "all"));
  const [sourceFilter, setSourceFilter] = useState(decisionQueryValue(route.query, "source", stored.source || "all"));
  const [requestRangeFilter, setRequestRangeFilter] = useState(decisionQueryValue(route.query, "range", stored.range || "all"));
  const [selectedId, setSelectedId] = useState(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
  const [layout, setLayout] = useState(decisionQueryValue(route.query, "layout", stored.layout || (window.innerWidth <= 760 ? "cards" : "list")));

  useEffect(() => {
    setSearch(decisionQueryValue(route.query, "q", stored.search || ""));
    setOwnerFilter(decisionQueryValue(route.query, "owner", stored.owner || "all"));
    setSubjectFilter(decisionQueryValue(route.query, "subject", stored.subject || "all"));
    setStatusFilter(decisionQueryValue(route.query, "status", stored.status || "all"));
    setDueFilter(decisionQueryValue(route.query, "due", stored.due || "all"));
    setActionFilter(decisionQueryValue(route.query, "action", stored.action || "all"));
    setSourceFilter(decisionQueryValue(route.query, "source", stored.source || "all"));
    setRequestRangeFilter(decisionQueryValue(route.query, "range", stored.range || "all"));
    setSelectedId(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
    setLayout(decisionQueryValue(route.query, "layout", stored.layout || (window.innerWidth <= 760 ? "cards" : "list")));
  }, [route.query.q, route.query.owner, route.query.subject, route.query.status, route.query.due, route.query.action, route.query.source, route.query.range, route.query.selected, route.query.layout]);

  const update = (patch) => {
    const next = { search, owner: ownerFilter, subject: subjectFilter, status: statusFilter, due: dueFilter, action: actionFilter, source: sourceFilter, range: requestRangeFilter, selectedId, layout, ...patch };
    setSearch(next.search); setOwnerFilter(next.owner); setSubjectFilter(next.subject); setStatusFilter(next.status); setDueFilter(next.due); setActionFilter(next.action); setSourceFilter(next.source); setRequestRangeFilter(next.range); setSelectedId(next.selectedId); setLayout(next.layout);
    saveStoredView({ tasks: next });
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search); if (next.owner !== "all") params.set("owner", next.owner); if (next.subject !== "all") params.set("subject", next.subject); if (next.status !== "all") params.set("status", next.status); if (next.due !== "all") params.set("due", next.due); if (next.action !== "all") params.set("action", next.action); if (next.source !== "all") params.set("source", next.source); if (next.range !== "all") params.set("range", next.range); if (next.selectedId) params.set("selected", next.selectedId); if (next.layout !== "list") params.set("layout", next.layout);
    onNavigate(`tasks${params.toString() ? `?${params}` : ""}`, {}, true);
  };
  const requestById = Object.fromEntries(data.requests.map((item) => [item.id, item]));
  const owners = [...new Set(data.tasks.map((item) => item.owner))];
  const subjects = [...new Set(data.tasks.map((item) => item.subjectName))];
  const actionTypes = [...new Set(data.tasks.map((item) => item.actionType.name))];
  const filtered = data.tasks.filter((task) => {
    const request = requestById[task.requestId];
    const matchesSearch = `${task.title} ${task.subjectName} ${task.owner} ${task.id}`.toLowerCase().includes(search.toLowerCase());
    const matchesOwner = ownerFilter === "all" || task.owner === ownerFilter;
    const matchesSubject = subjectFilter === "all" || task.subjectName === subjectFilter;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "overdue" ? task.overdue && !["completed", "cancelled", "corrected"].includes(task.status)
        : statusFilter === "active" ? ["assigned", "pending", "in_progress", "correcting"].includes(task.status)
          : statusFilter === "correction" ? ["correcting", "corrected"].includes(task.status)
          : statusFilter === "closed_changes" ? ["cancelled", "correcting", "corrected"].includes(task.status)
            : statusFilter === "ended" ? ["completed", "cancelled", "corrected"].includes(task.status)
              : task.status === statusFilter);
    const dueDays = Math.ceil((new Date(`${task.dueDate}T23:59:59`) - new Date()) / 86400000);
    const matchesDue = dueFilter === "all" || (dueFilter === "overdue" ? task.overdue : dueFilter === "7d" ? !task.overdue && dueDays <= 7 : dueFilter === "later" ? dueDays > 7 : true);
    const matchesAction = actionFilter === "all" || task.actionType.name === actionFilter;
    const matchesSource = sourceFilter === "all" || request?.sourceType === sourceFilter;
    const matchesRequestRange = request ? inDecisionRange(request.requestTime, requestRangeFilter) : requestRangeFilter === "all";
    return matchesSearch && matchesOwner && matchesSubject && matchesStatus && matchesDue && matchesAction && matchesSource && matchesRequestRange;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;
  const counts = {
    assigned: data.tasks.filter((item) => item.status === "assigned").length,
    pending: data.tasks.filter((item) => item.status === "pending").length,
    inProgress: data.tasks.filter((item) => item.status === "in_progress").length,
    overdue: data.tasks.filter((item) => item.overdue && !["completed", "cancelled", "corrected"].includes(item.status)).length,
    failed: data.tasks.filter((item) => item.status === "execution_failed").length,
    completed: data.tasks.filter((item) => item.status === "completed").length,
    corrected: data.tasks.filter((item) => ["correcting", "corrected", "cancelled"].includes(item.status)).length,
  };
  const groups = filtered.reduce((acc, task) => { (acc[task.owner] ||= []).push(task); return acc; }, {});
  const lanes = [
    { id: "assigned", label: "待承接", tasks: filtered.filter((item) => item.status === "assigned") },
    { id: "in_progress", label: "待开始 / 处理中", tasks: filtered.filter((item) => ["pending", "in_progress"].includes(item.status) && !item.overdue) },
    { id: "attention", label: "需要恢复", tasks: filtered.filter((item) => item.status === "execution_failed" || item.overdue) },
    { id: "done", label: "已结束 / 纠正", tasks: filtered.filter((item) => ["completed", "cancelled", "correcting", "corrected"].includes(item.status)) },
  ];

  const toolbar = <div className="task-filters"><DCSearch value={search} onChange={(value) => update({ search: value })} placeholder="搜索单位、待办或负责人" /><DCSelect label="负责人" value={ownerFilter} onChange={(value) => update({ owner: value })} options={[{ value: "all", label: "全部负责人" }, ...owners.map((owner) => ({ value: owner, label: owner }))]} /><DCSelect label="业务主体" value={subjectFilter} onChange={(value) => update({ subject: value })} options={[{ value: "all", label: "全部业务主体" }, ...subjects.map((subject) => ({ value: subject, label: subject }))]} /><DCSelect label="状态" value={statusFilter} onChange={(value) => update({ status: value })} options={[{ value: "all", label: "全部状态" }, { value: "active", label: "尚未结束" }, { value: "assigned", label: "待承接" }, { value: "pending", label: "待开始" }, { value: "in_progress", label: "处理中" }, { value: "overdue", label: "已逾期" }, { value: "execution_failed", label: "执行失败" }, { value: "completed", label: "已完成" }, { value: "cancelled", label: "已取消" }, { value: "correcting", label: "纠正中" }, { value: "corrected", label: "已纠正" }, { value: "correction", label: "纠正中或已纠正" }, { value: "closed_changes", label: "已取消或纠正" }, { value: "ended", label: "已结束" }]} /><DCSelect label="到期时间" value={dueFilter} onChange={(value) => update({ due: value })} options={[{ value: "all", label: "全部到期时间" }, { value: "overdue", label: "已逾期" }, { value: "7d", label: "未来 7 日内" }, { value: "later", label: "7 日以后" }]} /><DCSelect label="行动类型" value={actionFilter} onChange={(value) => update({ action: value })} options={[{ value: "all", label: "全部行动类型" }, ...actionTypes.map((action) => ({ value: action, label: action }))]} /><DCSelect label="来源" value={sourceFilter} onChange={(value) => update({ source: value })} options={[{ value: "all", label: "全部来源" }, ...Object.entries(SOURCE_META).map(([value, item]) => ({ value, label: item.label }))]} /><DCSelect label="请求时间" value={requestRangeFilter} onChange={(value) => update({ range: value })} options={[{ value: "all", label: "全部时间" }, { value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }]} />{DC_UI_VARIANT === "queue" ? <div className="layout-toggle"><DCIconButton icon="Rows3" label="列表展示" active={layout === "list"} onClick={() => update({ layout: "list" })} /><DCIconButton icon="LayoutGrid" label="卡片展示" active={layout === "cards"} onClick={() => update({ layout: "cards" })} /></div> : null}</div>;

  return <div className="page-shell task-workspace-page">
    <DCPageHeader eyebrow="待办工作" title="负责人待办" description="确认后的每个业务主体形成独立待办，按负责人和到期时间推进执行。" actions={<><DCButton icon="Inbox" onClick={() => onNavigate("workbench")}>返回决策工作台</DCButton><DCButton icon="Gauge" onClick={() => onNavigate("overview")}>查看运营概览</DCButton></>} />
    <div className="task-summary exclusive-metrics"><button onClick={() => update({ status: "assigned" })}><span>待承接</span><strong>{counts.assigned}</strong></button><button onClick={() => update({ status: "pending" })}><span>待开始</span><strong>{counts.pending}</strong></button><button onClick={() => update({ status: "in_progress" })}><span>处理中</span><strong>{counts.inProgress}</strong></button><button onClick={() => update({ status: "overdue" })}><span>已逾期</span><strong>{counts.overdue}</strong></button><button onClick={() => update({ status: "execution_failed" })}><span>执行失败</span><strong>{counts.failed}</strong></button><button onClick={() => update({ status: "completed" })}><span>已完成</span><strong>{counts.completed}</strong></button><button onClick={() => update({ status: "closed_changes" })}><span>取消或纠正</span><strong>{counts.corrected}</strong></button></div>
    <section className="content-panel task-workspace">{toolbar}
      {DC_UI_VARIANT === "queue" ? <div className="owner-groups">{Object.entries(groups).length ? Object.entries(groups).map(([owner, tasks]) => <section className="owner-group" key={owner}><header><div><span className="avatar-small">{owner.slice(-2)}</span><div><h2>{owner}</h2><p>{tasks.length} 条独立待办 · 按到期时间排序</p></div></div><span>{tasks.filter((item) => item.overdue).length} 条逾期</span></header><TaskDirectory tasks={tasks} layout={layout} onNavigate={onNavigate} /></section>) : <DCEmpty icon="ListTodo" title="没有符合条件的待办" description="调整筛选条件，或先在决策工作台完成人工确认。" action={<DCButton icon="RotateCcw" onClick={() => update({ search: "", owner: "all", subject: "all", status: "all", due: "all", action: "all", source: "all", range: "all", selectedId: "" })}>清除筛选</DCButton>} />}</div> : null}
      {DC_UI_VARIANT === "continuous" ? <div className="task-continuous"><div className="task-list-panel"><TaskDirectory tasks={filtered} layout="cards" onNavigate={onNavigate} /></div><aside className="task-preview">{selected ? <><header><div><span>当前待办</span><h2>{selected.subjectName}</h2><p>{selected.title}</p></div><DCStatus {...taskVisualStatus(selected)} /></header><div className="task-preview-facts"><div><span>负责人</span><strong>{selected.owner}</strong></div><div><span>到期时间</span><strong>{selected.dueDate}</strong></div><div><span>最近进展</span><strong>{selected.progress.at(-1)?.content || selected.failure?.reason || selected.result?.summary || selected.correction?.result || "尚无进展"}</strong></div><div><span>确认理由</span><strong>{selected.decisionReason}</strong></div></div><DCButton variant="primary" icon="ArrowRight" onClick={() => onNavigate(`task/${selected.id}`)}>查看详情并处理</DCButton></> : <DCEmpty icon="ListTodo" title="没有待办" description="当前筛选范围没有可处理记录。" />}</aside></div> : null}
      {DC_UI_VARIANT === "portfolio" ? <div className="task-lanes">{lanes.map((lane) => <section className="task-lane" key={lane.id}><header><h2>{lane.label}</h2><span>{lane.tasks.length}</span></header><div>{lane.tasks.length ? lane.tasks.map((task) => <button type="button" key={task.id} onClick={() => onNavigate(`task/${task.id}`)}><div><strong>{task.subjectName}</strong><small>{task.owner}</small></div><DCStatus {...taskVisualStatus(task)} compact /><p>{task.title}</p><footer><span>{task.dueDate}</span><DCIcon name="ArrowRight" /></footer></button>) : <div className="lane-empty">暂无记录</div>}</div></section>)}</div> : null}
    </section>
  </div>;
}

function RequestDetailScreen({ request, onNavigate, data, retryCreateTask, retryC017Receipt }) {
  if (!request) return <MissingScreen onNavigate={onNavigate} />;
  const route = parseDecisionRoute();
  const directoryFallback = portfolioRequestDirectoryTarget({}, request.id);
  const directoryReturnTarget = portfolioSafeReturnTarget(route.query.returnTo, directoryFallback);
  const directReturnTarget = route.query.from === "decision-item" && request.reminderId
    ? `reminder/${request.reminderId}`
    : directoryReturnTarget;
  const contextReturn = portfolioContextReturn(route, route.query.from === "decision-item" ? "返回决策事项" : "返回请求目录", directReturnTarget);
  const sourceRuleLabel = request.rule ? `${request.rule.id} ${request.rule.name} · ${request.rule.version}` : "不适用";
  const requestValidationLabel = request.duplicateOf
    ? "校验通过，严格重复"
    : request.requestGate?.status === "accepted"
      ? "校验通过"
      : request.requestGate?.status === "rejected"
        ? "校验未通过"
        : "校验中";
  const relatedRequest = request.duplicateOf ? data?.requests?.find((item) => item.id === request.duplicateOf) : request;
  const relatedTask = relatedRequest?.taskId ? data?.tasks?.find((item) => item.id === relatedRequest.taskId) : null;
  return (
    <div className="page-shell detail-page">
      <DCPageHeader
        onBack={() => contextReturn?.action ? contextReturn.action() : contextReturn?.target ? onNavigate(contextReturn.target) : window.history.back()}
        eyebrow={DC_UI_VARIANT === "portfolio" ? "行动申请" : "行动申请"}
        title={`${request.subjectName} · ${request.actionType.name}`}
        description={DC_UI_VARIANT === "portfolio" ? `${SOURCE_META[request.sourceType].label}于 ${request.requestTime} 发起；这是业务链路记录，不在此进行人工决定。` : `${SOURCE_META[request.sourceType].label}于 ${request.requestTime} 发起，当前状态：${requestStatusLabel(request)}。`}
        meta={<><span className="mono">{request.id}</span><DCSourceBadge type={request.sourceType} compact />{DC_UI_VARIANT === "portfolio" ? <DCStatus status={request.status} label={portfolioRequestDisplayLabel(request)} tone={portfolioRequestDisplayTone(request)} compact /> : <DCStatus status={request.status} compact />}</>}
        actions={<><DCButton icon="Route" onClick={() => onNavigate(`trace/request/${request.id}`)}>查看追溯</DCButton>{requestHasReminder(request) ? <DCButton variant="primary" icon={DC_UI_VARIANT === "portfolio" ? "Scale" : "BellRing"} onClick={() => onNavigate(portfolioDecisionItemTarget(request.reminderId, route.query.from === "request-directory" ? "request-directory" : "request", route.query.returnTo || ""))}>{DC_UI_VARIANT === "portfolio" ? "查看决策事项" : "查看提醒"}</DCButton> : null}</>}
      />
      {DC_UI_VARIANT === "portfolio" && route.query.from === "decision-item" ? <div className="return-context content-panel"><div><DCIcon name="CornerUpLeft" /><span>已从决策事项的“来源与追溯”进入；行动申请只读展示来源与链路状态。</span></div><DCButton size="sm" onClick={() => window.history.back()}>返回决策事项</DCButton></div> : null}

      {DC_UI_VARIANT === "portfolio" ? <section className="content-panel request-relation-summary">
        <div><span>请求校验结果</span><strong>{requestValidationLabel}</strong><p>{portfolioDisplayText(request.requestGate?.reason || request.formation?.requestGateReason || "等待请求与证据校验。")}</p></div>
        <div><span>决策事项</span><strong>{portfolioReminderLabel(request)}</strong><p>{request.reminderId ? `${request.reminderId} · ${portfolioDecisionLabel(request)}` : "当前没有关联决策事项"}</p></div>
        <div><span>负责人待办</span><strong>{relatedTask ? `${relatedTask.id} · ${DC_STATUS_META[relatedTask.status]?.label}` : "未形成"}</strong><p>{relatedTask ? `${relatedTask.owner} · 到期 ${relatedTask.dueDate}` : "只有人工确认成功后才会创建"}</p></div>
      </section> : null}

      {request.status === "blocked" ? <DCAlert tone="danger" title="当前请求不能进入人工确认" actions={request.evidence.previousTrusted ? <DCButton size="sm" onClick={() => document.getElementById("previous-trusted")?.scrollIntoView({ behavior: "smooth" })}>查看上一可信证据</DCButton> : null}>{portfolioDisplayText(request.blockReason)} {portfolioDisplayText(request.recovery)}</DCAlert> : null}
      {request.status === "rejected_by_gate" ? <DCAlert tone="danger" title="行动申请已被拒绝">{portfolioDisplayText(request.blockReason || "当前数据版本发生硬质量失败。") } 已保留失败回执，不形成{DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}或负责人待办。{portfolioDisplayText(request.recovery)}</DCAlert> : null}
      {request.status === "c017_blocked" ? <DCAlert tone="warning" title="当前质量状态无法确认" actions={<DCButton size="sm" variant="primary" icon="RefreshCw" onClick={() => retryC017Receipt(request.id)}>重新读取安全状态</DCButton>}>{portfolioDisplayText(request.blockReason)} 已保留行动申请和本次阻断回执，但未形成决策事项；只有重新读取到明确允许状态后才会继续。</DCAlert> : null}
      {request.status === "stale" ? <DCAlert tone="warning" title="固定证据已经陈旧">{portfolioDisplayText(request.confirmationEligibility?.reason || request.blockReason || "当前证据已超过业务时效要求。")} 可从对应{DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}请求补充信息，原请求保持只读。</DCAlert> : null}
      {request.status === "missing_evidence" ? <DCAlert tone="danger" title="必要证据缺失">{portfolioDisplayText(request.blockReason)} {portfolioDisplayText(request.recovery)}</DCAlert> : null}
      {request.status === "withdrawn" ? <DCAlert tone="warning" title="来源已撤回本次请求">{portfolioDisplayText(request.blockReason)} 原请求和固定证据继续保留，但不再形成可确认事项。</DCAlert> : null}
      {request.status === "replaced" ? <DCAlert tone="warning" title="原证据已被纠正" actions={<DCButton size="sm" onClick={() => onNavigate(DC_UI_VARIANT === "portfolio" ? "operations/requests?from=overview&exception=withdrawal_replacement" : "workbench?view=requests")}>查看请求目录</DCButton>}>{portfolioDisplayText(request.blockReason)} {portfolioDisplayText(request.recovery)}</DCAlert> : null}
      {DC_UI_VARIANT === "portfolio" && request.status === "create_failed" ? <DCAlert tone="danger" title="人工确认已保存，但交办创建失败" actions={<DCButton size="sm" variant="primary" icon="Wrench" onClick={() => onNavigate(`operations/assignment-recovery/${request.id}?from=request-detail`)}>进入异常恢复</DCButton>}>原人工决定、负责人和期限均已固定；行动申请保持只读，恢复操作在决策运营概览下属处理页完成。</DCAlert> : null}
      {request.evidence.availability === "部分可用" ? <DCAlert tone="warning" title="当前固定证据部分可用">缺失：{request.evidence.missingItems.join("、")}。{request.evidence.affectedScope}；是否继续由人工在{DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}中判断。</DCAlert> : null}
      {request.duplicateOf ? DC_UI_VARIANT === "portfolio" ? <DCAlert tone="info" title="已关联既有决策事项" actions={<><DCButton size="sm" onClick={() => onNavigate(`request/${request.duplicateOf}`)}>查看最早请求</DCButton><DCButton size="sm" variant="primary" onClick={() => onNavigate(portfolioDecisionItemTarget(request.reminderId))}>查看决策事项</DCButton></>}>{request.id} 作为独立来源记录保留，但固定证据与最早请求完全一致，不形成新的“待我决策”事项，也不重复创建负责人待办。</DCAlert> : <DCAlert tone="info" title="严格重复请求已关联到现有提醒" actions={<DCButton size="sm" onClick={() => onNavigate(`request/${request.duplicateOf}`)}>查看最早请求</DCButton>}>{request.id} 保留独立来源记录，并关联到提醒 {request.reminderId}；不会重复创建提醒或待办。</DCAlert> : null}

      <div className="two-column-detail">
        <main className="detail-main">
          <section className="content-panel section-card">
            <DCSectionHeader title="请求目标" />
            <DCKeyValues columns={2} items={[
              { label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` },
              { label: "所属场景", value: request.scenario },
              { label: "行动类型", value: `${request.actionType.name} · ${request.actionType.id}` },
              { label: "发布版本", value: `${request.actionType.version} · ${request.actionType.status}` },
              { label: "建议负责人", value: request.owner },
              { label: "请求时间", value: request.requestTime, mono: true },
            ]} />
          </section>
          <section className="content-panel section-card">
            <DCSectionHeader title="来源与条件引用" />
            <div className="source-detail-head"><DCSourceBadge type={request.sourceType} /><div><strong>{request.sourceRef}</strong><span>发起者：{request.requester}</span></div></div>
            <DCKeyValues columns={2} items={[
              { label: "Rule 条件引用", value: sourceRuleLabel },
              { label: "评估时间", value: request.rule?.evaluatedAt || "不适用" },
              { label: "触发分支或条件", value: request.rule?.branch || "不适用" },
              { label: "命中证据", value: request.rule?.hitEvidence || "不适用" },
            ]} />
          </section>
          <section className="content-panel section-card">
            <DCSectionHeader title="固定指标证据" />
            <div className="metric-focus"><div><span>{request.metric.name}</span><strong>{request.metric.value}</strong></div><p>{request.metric.explanation}</p></div>
            <DCKeyValues columns={3} items={[
              { label: "指标引用", value: request.metric.id, mono: true },
              { label: "对象范围", value: request.metric.scope },
              { label: "评估时间", value: request.metric.evaluatedAt, mono: true },
            ]} />
          </section>
          {DC_UI_VARIANT === "portfolio" ? <section className="content-panel section-card"><DCSectionHeader title="C017 安全门读取" description="只读取当前质量安全最小字段；不读取融资明细，不维护质量副本，也不修改数据工程状态。" /><C017SafetyReadPanel request={request} gate="request_receipt" actions={request.status === "c017_blocked" ? <DCButton variant="primary" icon="RefreshCw" onClick={() => retryC017Receipt(request.id)}>重新读取安全状态</DCButton> : null} /></section> : null}
          {request.evidence.previousTrusted ? <section className="content-panel section-card" id="previous-trusted">
            <DCSectionHeader title="上一可信证据" description="当前候选版本不可消费时，已确认的上一可信结果继续只读服务。" />
            <DCKeyValues columns={2} items={[
              { label: "数据版本", value: request.evidence.previousTrusted.dataVersion, mono: true },
              { label: "数据截至时间", value: request.evidence.previousTrusted.cutoff },
              { label: "指标结果", value: request.evidence.previousTrusted.metricValue },
              { label: "服务状态", value: request.evidence.previousTrusted.status },
            ]} />
          </section> : null}
        </main>
        <aside className="detail-aside">
          <section className="content-panel sticky-card">
            <DCSectionHeader title="证据可信度" />
            <div className="trust-list">
              <div><span><DCIcon name="BookOpenCheck" />已发布语义版本</span><strong>{request.evidence.semanticVersion}</strong></div>
              <div><span><DCIcon name="Database" />数据版本</span><strong>{request.evidence.dataVersion}</strong></div>
              <div><span><DCIcon name="CalendarClock" />数据截至</span><strong>{request.evidence.cutoff}</strong></div>
              <div><span><DCIcon name="ShieldCheck" />质量</span><strong>{request.evidence.quality}</strong></div>
              <div><span><DCIcon name="PlugZap" />可用状态</span><strong>{request.evidence.ready}</strong></div>
              <div><span><DCIcon name="Fingerprint" />快照标识</span><strong className="mono">{request.evidence.snapshotId}</strong></div>
            </div>
          </section>
          {request.duplicateRequests.length ? <section className="content-panel section-card compact-card"><DCSectionHeader title="关联来源请求" count={request.duplicateRequests.length + 1} /><p className="support-copy">固定证据完全一致的开放请求关联到同一提醒，原请求仍逐条保留。</p>{request.duplicateRequests.map((item) => <div className="linked-request" key={item.id}><DCSourceBadge type={item.sourceType} compact /><div><strong>{item.id}</strong><small>{item.relation} · {item.time}</small></div></div>)}</section> : null}
        </aside>
      </div>
    </div>
  );
}

function PortfolioAssignmentRecoveryScreen({ request, onNavigate, retryCreateTask }) {
  const [recovering, setRecovering] = useState(false);
  if (!request || request.status !== "create_failed" || !request.decision) return <MissingScreen onNavigate={onNavigate} />;
  const recover = () => {
    setRecovering(true);
    retryCreateTask(request.id).then((result) => {
      if (!result?.ok) setRecovering(false);
    });
  };
  return <div className="page-shell detail-page">
    <DCPageHeader onBack={() => window.history.back()} eyebrow="决策运营概览 · 异常恢复" title={`${request.subjectName} · 交办创建失败`} description="只恢复人工确认后的交办创建，不重新确认、不修改原决定。" actions={<DCButton icon="Waypoints" onClick={() => onNavigate(`request/${request.id}?from=request-directory`)}>查看行动申请</DCButton>} />
    <DCAlert tone="danger" title="负责人待办尚未创建">人工确认已保存，当前只缺负责人待办。每次重试都会按精确数据版本重新读取 C017，不使用页面缓存放行。</DCAlert>
    <div className="two-column-detail">
      <main className="detail-main">
        <section className="content-panel section-card"><DCSectionHeader title="已保存的人工决定" /><DCKeyValues columns={2} items={[{ label: "决策事项", value: request.reminderId }, { label: "行动申请", value: request.id }, { label: "确认理由", value: request.decision.reason }, { label: "负责人", value: request.decision.owner }, { label: "到期时间", value: request.decision.dueDate }, { label: "确认时间", value: request.decision.time }]} /></section>
        <section className="content-panel section-card"><DCSectionHeader title="恢复范围" /><DCAlert tone="info" title="不会重复人工决定">本次仅依据已保存的负责人、期限、执行说明和固定证据创建一条负责人待办；若已存在待办，系统会打开既有记录。</DCAlert><C017SafetyReadPanel request={request} gate="task_formation" compact /></section>
      </main>
      <aside className="detail-aside"><section className="content-panel sticky-card"><DCSectionHeader title="恢复操作" /><div className="decision-checklist"><div><DCIcon name="UserRound" /><span>负责人</span><strong>{request.decision.owner}</strong></div><div><DCIcon name="CalendarClock" /><span>到期时间</span><strong>{request.decision.dueDate}</strong></div><div><DCIcon name="ShieldCheck" /><span>人工决定</span><strong>已确认并固定</strong></div></div><div className="sticky-actions"><DCButton variant="primary" icon="RefreshCw" loading={recovering} onClick={recover}>重试创建负责人待办</DCButton></div></section></aside>
    </div>
  </div>;
}

function C017SafetyReadPanel({ request, gate, compact = false, actions = null }) {
  const reads = (request?.c017SafetyReads || []).filter((item) => !gate || item.gate === gate);
  const latest = reads.at(-1);
  if (!latest) return <DCEmpty icon="ShieldQuestion" title="尚未读取当前质量安全状态" description="到达对应写入边界时，将按精确数据版本读取 C017。" action={actions} />;
  const outcome = c017OutcomeMeta(latest.outcome);
  return <section className={`c017-safety-read ${compact ? "compact" : ""}`}>
    <header><div><span><DCIcon name="ShieldCheck" />数据质量安全读取</span><strong>{latest.gateLabel}</strong></div><DCStatus status={latest.outcome} label={outcome.label} tone={outcome.tone} icon={outcome.icon} /></header>
    <DCKeyValues columns={compact ? 2 : 3} items={[
      { label: "精确数据版本", value: latest.t007 },
      { label: "摘要标识 / 版本", value: `${latest.summaryId} / ${latest.summaryVersion}` },
      { label: "摘要形成时间", value: latest.summaryFormedAt, mono: true },
      { label: "本次读取时间", value: latest.readAt, mono: true },
      { label: "当前质量状态", value: latest.qualityStatus },
      { label: "硬质量失败", value: latest.hardFailure },
      { label: "发现时间", value: latest.detectedAt },
      { label: "影响范围", value: latest.impactScope },
      { label: "业务字段类别", value: latest.businessFieldCategories },
      { label: "原因", value: latest.reason },
      { label: "恢复建议", value: latest.recovery },
      { label: "稳定证据定位", value: latest.evidenceLocator },
    ]} />
    {reads.length > 1 ? <p className="c017-read-history">本阶段已读取 {reads.length} 次；每次结果独立留痕，最新一次不覆盖历史回执。</p> : null}
    {actions ? <div className="source-trace-actions">{actions}</div> : null}
  </section>;
}

function EvidencePanel({ request }) {
  const [loanSearch, setLoanSearch] = useState("");
  const loans = request.loans.filter((loan) => `${loan.id} ${loan.bank} ${loan.type}`.toLowerCase().includes(loanSearch.toLowerCase()));
  return (
    <div className="evidence-stack">
      <section className="content-panel section-card">
        <DCSectionHeader title={DC_UI_VARIANT === "portfolio" ? "为什么形成决策事项" : "为什么提醒"} description="先看行动类型，再看适用的 Rule 条件和指标证据。" />
        <div className="why-grid">
          <article><span className="step-kicker">行动类型</span><strong>{request.actionType.name}</strong><p>{request.actionType.id} · {request.actionType.version} · {request.actionType.status}</p></article>
          <article><span className="step-kicker">Rule 条件引用</span><strong>{request.rule ? `${request.rule.id} ${request.rule.name}` : "不适用"}</strong><p>{request.rule ? request.rule.hitEvidence : "当前来源证据没有引用 Rule，不补造 Rule 条件。"}</p></article>
          <article className="metric-article"><span className="step-kicker">指标快照</span><strong>{request.metric.value}</strong><p>{request.metric.name} · {request.metric.explanation}</p></article>
        </div>
      </section>
      <section className="content-panel section-card">
        <DCSectionHeader title="先和谁协商" description="排序来自固定证据，确认时可以调整本次执行顺序，但不会改写原始排名。" />
        {request.banks.length ? <div className="bank-rank-list">{request.banks.map((bank, index) => <article key={bank.name}><span className="rank-number">{index + 1}</span><div className="bank-name"><strong>{bank.name}</strong><small>{bank.note}</small></div><div><strong>{bank.balance}</strong><small>问题余额</small></div><div><strong>{bank.contribution}</strong><small>贡献占比</small></div><div><strong>{bank.loanCount} 笔</strong><small>关联借据</small></div></article>)}</div> : <DCEmpty icon="Landmark" title="建议银行证据缺失" description="当前版本无法核对金融机构映射，因此不会生成银行排名。" />}
      </section>
      <section className="content-panel section-card">
        <DCSectionHeader title="涉及哪些贷款" count={request.loanCount} actions={<DCSearch value={loanSearch} onChange={setLoanSearch} placeholder="搜索借据、银行或类型" />} />
        {loans.length ? <div className="loan-table-wrap"><table className="loan-table"><thead><tr><th>借据编号</th><th>金融机构</th><th>贷款类型</th><th>余额</th><th>利率 / 定价</th></tr></thead><tbody>{loans.map((loan) => <tr key={loan.id}><td className="mono">{loan.id}</td><td>{loan.bank}</td><td>{loan.type}</td><td>{loan.balance}</td><td>{loan.rate}</td></tr>)}</tbody></table><div className="table-footnote">当前显示证据包中的高贡献借据；共关联 {request.loanCount} 笔。</div></div> : <DCEmpty icon="FileSearch" title="没有匹配的借据" description="调整搜索词后重新查看。" />}
      </section>
      <section className="content-panel section-card">
        <DCSectionHeader title="证据是否可信" />
        <div className="trust-cards"><article><DCIcon name="BookOpenCheck" /><span>语义版本</span><strong>{request.evidence.semanticVersion}</strong></article><article><DCIcon name="Database" /><span>数据版本</span><strong>{request.evidence.dataVersion}</strong></article><article><DCIcon name="CalendarClock" /><span>数据截至时间</span><strong>{request.evidence.cutoff}</strong></article><article><DCIcon name="ShieldCheck" /><span>质量与可用</span><strong>{request.evidence.quality} · {request.evidence.ready}</strong></article></div>
      </section>
    </div>
  );
}

function DecisionModal({ open, request, mode, onClose, onSubmit }) {
  const initialDue = addWorkdays(new Date(), 5);
  const [stage, setStage] = useState("form");
  const [reason, setReason] = useState("");
  const [owner, setOwner] = useState(request.owner);
  const [dueDate, setDueDate] = useState(initialDue);
  const [instructions, setInstructions] = useState(request.recommendation);
  const [banks, setBanks] = useState(request.banks.map((item) => item.name));
  const [ownerChangeReason, setOwnerChangeReason] = useState("");
  const [partialAcknowledged, setPartialAcknowledged] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("form"); setReason(""); setOwner(request.owner); setDueDate(addWorkdays(new Date(), 5));
    setInstructions(request.recommendation); setBanks(request.banks.map((item) => item.name)); setOwnerChangeReason(""); setPartialAcknowledged(false); setError("");
  }, [open, request.id, mode]);

  const confirmationAllowed = request.confirmationEligibility?.allowed !== false;
  const requiresAcknowledgement = Boolean(request.confirmationEligibility?.requiresAcknowledgement);
  const versionsPresent = Boolean(request.evidence.semanticVersion && request.evidence.dataVersion);
  const form = { reason, owner, dueDate, instructions, banks, ownerChangeReason, partialAcknowledged };
  const validate = () => {
    if (!reason.trim()) return "请填写本次决定理由。";
    if (mode === "confirm" && !confirmationAllowed) return request.confirmationEligibility?.reason || "当前证据不能提交确认。";
    if (mode === "confirm" && requiresAcknowledgement && !partialAcknowledged) return "请确认已了解部分证据缺失及其影响范围。";
    if (mode === "confirm" && !owner.trim()) return "请选择明确负责人。";
    if (mode === "confirm" && owner !== request.owner && !ownerChangeReason.trim()) return "修改负责人时必须填写修改理由。";
    if (mode === "confirm" && !dueDate) return "请选择到期时间。";
    if (mode === "confirm" && dueDate < dateOnly(new Date())) return "到期时间不能早于今天。";
    if (mode === "confirm" && !instructions.trim()) return "请填写执行说明。";
    if (mode === "confirm" && request.banks.length && !banks.length) return "至少保留一家本次协商银行。";
    return "";
  };
  const goReview = () => { const message = validate(); if (message) { setError(message); return; } setError(""); setStage("review"); };
  const submit = async () => {
    setStage("submitting");
    const result = await onSubmit(mode, form, (nextStage) => setStage(nextStage));
    if (!result.ok) { setError(result.message); setStage("error"); }
  };

  const checks = [
    ["业务主体唯一", `${request.subjectName} · ${request.subjectId}`, true],
    ["行动类型已发布", `${request.actionType.name} · ${request.actionType.version}`, true],
    ["Rule 条件引用", request.rule ? `${request.rule.id} · ${request.rule.version} · 命中证据完整` : "不适用，来源证据未引用 Rule", true],
    ["指标快照完整", `${request.metric.name} ${request.metric.value}`, true],
    ["双版本可读取", `${request.evidence.semanticVersion} / ${request.evidence.dataVersion}`, versionsPresent],
    ["当前证据允许判断", `${request.evidence.quality} · ${request.evidence.ready} · ${request.evidence.freshness}`, confirmationAllowed],
    ...(mode === "confirm" ? [["提交时重新读取 C017", `将按精确数据版本 ${request.evidence.dataVersion} 读取当前质量安全状态`, true]] : []),
  ];

  return (
    <DCModal open={open} onClose={() => !["submitting", "decision_saved", "task_creating"].includes(stage) && onClose()} title={mode === "confirm" ? "确认并交办" : "拒绝本次行动建议"} description={`${request.subjectName} · ${request.actionType.name}`} icon={mode === "confirm" ? "CircleCheckBig" : "CircleMinus"} width="820px" footer={stage === "form" ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant="primary" icon="ArrowRight" onClick={goReview}>核对提交内容</DCButton></> : stage === "review" ? <><DCButton onClick={() => setStage("form")}>返回修改</DCButton><DCButton variant={mode === "confirm" ? "primary" : "danger"} icon={mode === "confirm" ? "Check" : "CircleMinus"} onClick={submit}>{mode === "confirm" ? "确认并交办" : "确认拒绝"}</DCButton></> : stage === "error" ? <><DCButton onClick={onClose}>暂时关闭</DCButton><DCButton onClick={() => { setError(""); setStage("form"); }}>返回修改</DCButton><DCButton variant="primary" icon="RefreshCw" onClick={submit}>重试提交</DCButton></> : null}>
      {stage === "submitting" ? <DCLoadingBlock title={mode === "confirm" ? "正在读取当前质量安全状态" : "正在保存拒绝决定"} description={mode === "confirm" ? `正按精确数据版本 ${request.evidence.dataVersion} 读取 C017；通过后才会保存人工确认。` : "正在保存拒绝理由和本次固定证据；拒绝不会创建负责人待办。"} /> : null}
      {stage === "decision_saved" ? <DCLoadingBlock title="人工确认已保存" description="决定理由、负责人、到期时间和固定证据已锁定，下一步创建负责人待办。" /> : null}
      {stage === "task_creating" ? <DCLoadingBlock title="正在创建负责人待办" description={`正在为 ${owner} 创建 ${request.subjectName} 的独立待办。`} /> : null}
      {stage === "error" ? <div className="submission-error"><DCAlert tone="danger" title="提交没有完成">{error} 已保留表单内容，请核对后重试；{mode === "confirm" ? "重试会再次读取 C017。" : "重试只会再次保存本次拒绝决定。"}</DCAlert><DCKeyValues columns={2} items={[{ label: "业务主体", value: request.subjectName }, { label: "本次决定", value: mode === "confirm" ? "确认" : "拒绝" }, { label: "负责人", value: mode === "confirm" ? owner : "不创建待办" }, { label: "到期时间", value: mode === "confirm" ? dueDate : "不适用" }]} />{mode === "confirm" && latestC017Read(request, "confirmation_submit") ? <C017SafetyReadPanel request={request} gate="confirmation_submit" compact /> : null}</div> : null}
      {stage === "form" && mode === "confirm" && requiresAcknowledgement ? <DCAlert tone="warning" title="部分证据可用">{request.confirmationEligibility.reason}。请在确认理由中说明已知影响，并勾选知情确认。</DCAlert> : null}
      {stage === "form" ? <div className="decision-form-layout">
        <div className="validation-panel"><h3>确认前校验</h3><div className="validation-list">{checks.map(([label, detail, pass]) => <div key={label} className={pass ? "pass" : "fail"}><DCIcon name={pass ? "CircleCheck" : "CircleX"} /><div><strong>{label}</strong><small>{detail}</small></div></div>)}</div></div>
        <div className="form-panel"><DCTextarea label={mode === "confirm" ? "确认理由" : "拒绝理由"} value={reason} onChange={setReason} required placeholder={mode === "confirm" ? "说明为什么需要推进这项行动" : "说明本次不推进的业务原因"} error={error} />
          {mode === "confirm" && requiresAcknowledgement ? <label className="acknowledgement-check"><input type="checkbox" checked={partialAcknowledged} onChange={(event) => setPartialAcknowledged(event.target.checked)} /><span><strong>我已了解证据缺失范围</strong><small>{request.evidence.affectedScope || request.confirmationEligibility.reason}</small></span></label> : null}
          {mode === "confirm" ? <>
            <DCField label="负责人" value={owner} onChange={setOwner} required hint="默认取主体—负责人关系，本次修改不会回写本体。" />
            {owner !== request.owner ? <DCTextarea label="负责人修改理由" value={ownerChangeReason} onChange={setOwnerChangeReason} required placeholder="说明本次为何改由其他负责人承接" /> : null}
            <DCField label="到期时间" type="date" value={dueDate} onChange={setDueDate} min={dateOnly(new Date())} required hint="默认：确认成功后的第 5 个工作日；确认日不计，周末不计。" />
            <DCTextarea label="执行说明" value={instructions} onChange={setInstructions} required />
            <fieldset className="bank-selector"><legend>本次协商银行</legend>{request.banks.map((bank, index) => <label key={bank.name}><input type="checkbox" checked={banks.includes(bank.name)} onChange={(event) => setBanks((current) => event.target.checked ? [...current, bank.name] : current.filter((name) => name !== bank.name))} /><span className="rank-number small">{index + 1}</span><strong>{bank.name}</strong><small>{bank.note}</small></label>)}</fieldset>
          </> : null}
        </div>
      </div> : null}
      {stage === "review" ? <div className="decision-review"><DCAlert tone={mode === "confirm" ? "info" : "warning"} title={mode === "confirm" ? "人工确认成功后会创建一条独立待办" : "拒绝后不会创建待办"}>{mode === "confirm" ? "本次确认只影响这条主体记录，不会修改 Rule、指标或原始证据。" : "原请求、证据和拒绝理由会继续保留在追溯中。"}</DCAlert><DCKeyValues columns={2} items={[
        { label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` }, { label: "本次决定", value: mode === "confirm" ? "确认" : "拒绝" },
        { label: "决定理由", value: reason }, { label: "负责人", value: mode === "confirm" ? owner : "不创建待办" },
        { label: "到期时间", value: mode === "confirm" ? dueDate : "不适用" }, { label: "协商银行", value: mode === "confirm" ? banks.join("、") : "不适用" },
      ]} />{mode === "confirm" ? <div className="review-instructions"><span>执行说明</span><p>{instructions}</p></div> : null}</div> : null}
    </DCModal>
  );
}

function SupplementModal({ open, request, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [items, setItems] = useState(["最新贷款明细", "金融机构归属说明"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setReason(""); setItems(["最新贷款明细", "金融机构归属说明"]); setSubmitting(false); setError(""); } }, [open, request.id]);
  const submit = async () => {
    if (!reason.trim()) return setError("请说明为什么当前证据不足。"), undefined;
    if (!items.length) return setError("请至少选择一项需要补充的内容。"), undefined;
    setSubmitting(true); setError("");
    const result = await onSubmit({ reason, items });
    if (!result.ok) { setSubmitting(false); setError(result.message); return; }
    onClose();
  };
  return <DCModal open={open} onClose={() => !submitting && onClose()} title="请求补充信息" description={`${request.subjectName} · ${request.reminderId}`} icon="MessageSquarePlus" width="620px" footer={!submitting ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant="primary" icon="Send" onClick={submit}>发送补充请求</DCButton></> : null}>
    {submitting ? <DCLoadingBlock title="正在发送补充请求" description={`发送成功后，本${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}将等待上游形成新的或替代的行动申请。`} /> : <div className="supplement-panel">
      <DCAlert tone="info" title="原固定证据保持只读">这里仅记录需要补充的内容，不会在决策中心修改上游指标、Rule、贷款或银行证据。</DCAlert>
      {error ? <DCAlert tone="danger" title="补充请求尚未发送">{error} 已保留填写内容。</DCAlert> : null}
      <DCTextarea label="请求原因" value={reason} onChange={setReason} required placeholder="说明还缺少哪些事实，为什么会影响本次判断" />
      <fieldset className="bank-selector supplement-request"><legend>需要补充的内容</legend>{["最新贷款明细", "金融机构归属说明", "指标评估时点", "负责人关系", "来源说明"].map((item) => <label key={item}><input type="checkbox" checked={items.includes(item)} onChange={(event) => setItems((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} /><strong>{item}</strong></label>)}</fieldset>
    </div>}
  </DCModal>;
}

function ReminderDetailScreen({ request, data, onNavigate, submitDecision, retryCreateTask, requestSupplement, refreshSupplement }) {
  const [tab, setTab] = useState("decision");
  const [decisionMode, setDecisionMode] = useState(null);
  const [supplementOpen, setSupplementOpen] = useState(false);
  if (!request) return <MissingScreen onNavigate={onNavigate} />;
  const canDecide = requestCanDecide(request);
  const canRequestSupplement = request.supplementPolicy?.canRequest !== false && ["awaiting", "blocked", "stale", "missing_evidence"].includes(request.status);
  const task = request.taskId ? data?.tasks?.find((item) => item.id === request.taskId) : null;
  const guidance = portfolioDecisionGuidance(request);
  const tabItems = DC_UI_VARIANT === "portfolio"
    ? [{ value: "decision", label: "决策建议", icon: "Scale" }, { value: "evidence", label: "关键证据", icon: "FileSearch" }, { value: "sources", label: "来源与追溯", icon: "Route", count: request.duplicateRequests.length + 1 }, { value: "changes", label: "变更记录", icon: "History" }]
    : [{ value: "decision", label: "处置建议", icon: "Scale" }, { value: "evidence", label: "证据", icon: "FileSearch" }, { value: "sources", label: "关联请求", icon: "Waypoints", count: request.duplicateRequests.length + 1 }, { value: "changes", label: "变更记录", icon: "History" }];
  const route = parseDecisionRoute();
  const fromRequestDirectory = route.query.from === "request-directory" || route.query.origin === "request-directory";
  const directoryFallback = portfolioRequestDirectoryTarget({}, request.id);
  const directoryReturnTarget = portfolioSafeReturnTarget(route.query.returnTo, directoryFallback);
  const directReturnTarget = fromRequestDirectory ? directoryReturnTarget : route.query.from === "request" ? `request/${request.id}?from=request-directory${route.query.returnTo ? `&returnTo=${encodeURIComponent(route.query.returnTo)}` : ""}` : "workbench";
  const contextReturn = portfolioContextReturn(route, fromRequestDirectory ? "返回行动申请目录" : route.query.from === "request" ? "返回行动申请" : "返回决策工作台", directReturnTarget);
  const detailTitle = DC_UI_VARIANT === "portfolio"
    ? `${request.subjectName} · ${request.actionType.name}`
    : `${request.subjectName}需要判断：${request.actionType.name}`;
  return (
    <div className="page-shell detail-page">
      <DCPageHeader
        onBack={() => contextReturn?.action ? contextReturn.action() : contextReturn?.target ? onNavigate(contextReturn.target) : window.history.back()}
        eyebrow={DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}
        title={detailTitle}
        description={request.metric.explanation}
        meta={<><span className="mono">{request.reminderId}</span><DCSourceBadge type={request.sourceType} compact />{DC_UI_VARIANT === "portfolio" ? <DCStatus {...portfolioDecisionItemStatus(request)} compact /> : <DCStatus status={request.status} compact />}</>}
        actions={DC_UI_VARIANT === "portfolio" ? <><DCButton icon="Waypoints" onClick={() => onNavigate(portfolioRequestDetailTarget(request.id, route.query.returnTo || ""))}>查看原始行动申请</DCButton>{task ? <DCButton icon="ListTodo" onClick={() => onNavigate(`task/${task.id}`)}>查看执行进展</DCButton> : null}{canRequestSupplement ? <DCButton icon="MessageSquarePlus" onClick={() => setSupplementOpen(true)}>请求补充信息</DCButton> : null}{canDecide ? <DCButton icon="CircleMinus" onClick={() => setDecisionMode("reject")}>拒绝</DCButton> : null}{canDecide ? <DCButton variant="primary" icon="CircleCheckBig" onClick={() => setDecisionMode("confirm")}>确认</DCButton> : null}</> : <><DCButton icon="Route" onClick={() => onNavigate(`trace/reminder/${request.reminderId}`)}>查看追溯</DCButton>{canDecide ? <DCButton icon="CircleMinus" onClick={() => setDecisionMode("reject")}>拒绝</DCButton> : null}{canDecide ? <DCButton variant="primary" icon="CircleCheckBig" onClick={() => setDecisionMode("confirm")}>确认</DCButton> : null}</>}
      />
      {DC_UI_VARIANT === "portfolio" && ["request", "request-directory"].includes(route.query.from) ? <div className="return-context content-panel"><div><DCIcon name="CornerUpLeft" /><span>{fromRequestDirectory ? "已从行动申请目录进入；事项与申请读取同一条业务链路。" : "已从原始行动申请进入；两处读取同一条业务链路。"}</span></div><DCButton size="sm" onClick={() => contextReturn?.action ? contextReturn.action() : onNavigate(directReturnTarget)}>{fromRequestDirectory ? "返回行动申请目录" : "返回行动申请"}</DCButton></div> : null}

      {DC_UI_VARIANT === "portfolio" && portfolioBasisChanged(request) ? <DCAlert tone="warning" title="依据已变化">本决策事项保留送达时的固定证据，并已移出“待我决策”。来源变化不会自动形成第二次领导判断；如有替代请求，可从“来源与追溯”或变更记录继续核对。</DCAlert> : null}
      {request.status === "blocked" ? <DCAlert tone="danger" title="证据门阻断人工确认">{portfolioDisplayText(request.blockReason)} {portfolioDisplayText(request.recovery)}</DCAlert> : null}
      {request.status === "stale" ? <DCAlert tone="warning" title="证据已陈旧">{portfolioDisplayText(request.confirmationEligibility?.reason)}。可请求补充信息，原固定证据继续只读保留。</DCAlert> : null}
      {request.status === "withdrawn" ? <DCAlert tone="warning" title="来源已撤回本次请求">{portfolioDisplayText(request.blockReason)} {portfolioDisplayText(request.recovery)}</DCAlert> : null}
      {request.evidence.availability === "部分可用" ? <DCAlert tone="warning" title="部分证据可用">{request.evidence.missingItems.join("、")}尚未补齐；{request.evidence.affectedScope}。{DC_UI_VARIANT === "portfolio" ? "本决策事项" : "本提醒"}仍可人工判断，确认时必须说明已知影响。</DCAlert> : null}
      {request.status === "replaced" ? <DCAlert tone="warning" title="证据已被上游纠正" actions={<DCButton size="sm" onClick={() => onNavigate(DC_UI_VARIANT === "portfolio" ? "operations/requests?from=overview&exception=withdrawal_replacement" : "workbench?view=requests")}>查看替代请求</DCButton>}>{portfolioDisplayText(request.blockReason)} 原证据保持只读，不能继续确认。</DCAlert> : null}
      {request.status === "create_failed" && DC_UI_VARIANT !== "portfolio" ? <DCAlert tone="danger" title="人工确认已保存，但待办创建失败" actions={<DCButton size="sm" variant="primary" icon="RefreshCw" onClick={() => retryCreateTask(request.id)}>重试创建待办</DCButton>}>负责人目录在首次创建时未返回明确结果。人工决定保持有效；修复后可直接重试。</DCAlert> : null}
      {request.status === "supplement_requested" ? <DCAlert tone={request.sourceReadStatus === "failed" ? "danger" : "info"} title={request.sourceReadStatus === "failed" ? "读取上游状态失败" : "正在等待上游补充信息"} actions={<DCButton size="sm" variant={request.sourceReadStatus === "failed" ? "primary" : "secondary"} icon="RefreshCw" loading={request.sourceReadStatus === "loading"} onClick={() => refreshSupplement(request.id)}>{request.sourceReadStatus === "failed" ? "重试读取" : "重新读取上游状态"}</DCButton>}>{request.sourceReadStatus === "failed" ? `暂时无法读取来源更新，原${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}和补充请求均已保留。` : <>{request.supplement?.reason || "已记录补充请求"}<br />收到新的或替代的行动申请后，可继续人工判断。</>}</DCAlert> : null}
      {request.taskCreating ? <DCAlert tone="info" title="正在创建负责人待办"><span className="inline-loading"><DCIcon name="LoaderCircle" className="spin" />人工决定已固定，正在形成独立待办。</span></DCAlert> : null}
      {request.status === "decision_saved" && !request.taskCreating && request.decision ? <DCAlert tone="info" title="人工确认已保存">正在准备创建 {request.decision.owner} 的独立待办，无需再次确认。</DCAlert> : null}
      {request.status === "confirmed" && request.decision ? <DCAlert tone="success" title="待办已创建" actions={<DCButton size="sm" onClick={() => request.taskId && onNavigate(`task/${request.taskId}`)}>查看待办</DCButton>}>已分派给 {request.decision.owner}，{DC_UI_VARIANT === "portfolio" ? "等待负责人确认承接" : "待负责人开始处理"}；到期时间 {request.decision.dueDate}。</DCAlert> : null}
      {request.status === "rejected" && request.decision ? <DCAlert tone="info" title="已拒绝本次行动建议">{request.decision.reason} · {request.decision.time}</DCAlert> : null}

      {DC_UI_VARIANT === "portfolio" ? <div className="reminder-hero content-panel">
        <div className="hero-fact"><span>哪个主体需要决策</span><strong>{request.subjectName} · {request.metric.name} {request.metric.value}</strong><p>{request.metric.explanation}；涉及 {request.loanCount} 笔贷款，余额 {request.balance}。</p></div>
        <div className="hero-fact"><span>为什么产生</span><strong>{request.rule ? request.rule.name : `${SOURCE_META[request.sourceType].label}提出建议`}</strong><p>{request.rule ? request.rule.hitEvidence : "当前来源证据未引用规则"}</p></div>
        <div className="hero-fact recommendation"><span>推荐决策</span><strong>{guidance.direction}</strong><p>{guidance.reason}</p></div>
        <div className="hero-fact"><span>建议行动与预期影响</span><strong>{request.recommendation}</strong><p>{request.banks.length ? `优先银行：${request.banks.map((item) => item.name).join("、")}。` : "当前缺少可核对的银行证据。"}{portfolioExpectedImpact(request)}</p></div>
      </div> : <div className="reminder-hero content-panel"><div className="hero-fact"><span>发生了什么</span><strong>{request.metric.name} {request.metric.value}</strong><p>{request.metric.explanation}</p></div><div className="hero-fact"><span>为什么产生</span><strong>{request.rule ? request.rule.name : `${SOURCE_META[request.sourceType].label}提出建议`}</strong><p>{request.rule ? request.rule.hitEvidence : "当前来源证据未引用规则"}</p></div><div className="hero-fact recommendation"><span>推荐决策</span><strong>{request.recommendation}</strong><p>优先银行：{request.banks.length ? request.banks.map((item) => item.name).join("、") : "待证据恢复后生成"}</p></div></div>}
      {DC_UI_VARIANT === "portfolio" ? <section className="content-panel decision-readiness">
        <DCSectionHeader title="判断前先核对" description="先看证据是否充分、是否陈旧，再决定确认、拒绝或请求补充信息。" />
        <div className="decision-readiness-grid"><div><span>证据充分程度</span><strong>{guidance.evidence}</strong><p>{request.evidence.quality} · {request.evidence.ready}</p></div><div><span>数据截至时间</span><strong>{request.evidence.cutoff}</strong><p>{request.evidence.freshness}</p></div><div><span>建议负责人</span><strong>{request.owner}</strong><p>确认时可修改并填写原因</p></div><div><span>推荐方向</span><strong>{guidance.direction}</strong><p>{guidance.reason}</p></div></div>
      </section> : null}
      {DC_UI_VARIANT === "portfolio" ? <section className="content-panel reminder-metadata">
        <DCSectionHeader title={DC_UI_VARIANT === "portfolio" ? "决策事项形成信息" : "提醒形成信息"} description="固定引用来源、行动类型、适用条件、版本和形成时间。" />
        <DCKeyValues columns={4} items={[
          { label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` },
          { label: "行动类型", value: `${request.actionType.name} · ${request.actionType.version}` },
          { label: "Rule 条件引用", value: request.rule ? `${request.rule.id} ${request.rule.name}` : "不适用" },
          { label: "Rule 版本", value: request.rule?.version || "不适用" },
          { label: "评估时间", value: request.rule?.evaluatedAt || request.metric.evaluatedAt, mono: true },
          { label: "触发分支或条件", value: request.rule?.branch || "不适用" },
          { label: "指标快照", value: `${request.metric.name} ${request.metric.value}` },
          { label: "语义 / 数据版本", value: `${request.evidence.semanticVersion} / ${request.evidence.dataVersion}` },
          { label: "数据截至时间", value: request.evidence.cutoff, mono: true },
          { label: "请求来源", value: SOURCE_META[request.sourceType].label },
          { label: "生成时间", value: request.generatedTime, mono: true },
          { label: "证据状态", value: `${request.evidence.quality} · ${request.evidence.ready}` },
        ]} />
      </section> : null}
      {DC_UI_VARIANT === "portfolio" && latestC017Read(request, "confirmation_submit") ? <section className="content-panel section-card"><DCSectionHeader title="最近一次人工确认安全读取" description="提交确认时按本事项引用的精确数据版本重新读取；请求接收结果和页面缓存不能授权本次推进。" /><C017SafetyReadPanel request={request} gate="confirmation_submit" compact /></section> : null}

      <DCTabs items={tabItems} value={tab} onChange={setTab} />
      {tab === "decision" ? <div className="decision-tab-layout">
        <main className="detail-main">
          <section className="content-panel section-card"><DCSectionHeader title="建议怎么做" description="建议只辅助判断，最终决定由用户提交。" /><div className="recommendation-box"><span><DCIcon name="Sparkles" /></span><div><strong>{request.recommendation}</strong><p>{DC_UI_VARIANT === "portfolio" ? `${guidance.direction}：${guidance.reason} ` : ""}建议按证据贡献从高到低协商，并在待办中记录实际银行、范围和结果。</p></div></div></section>
          <section className="content-panel section-card"><DCSectionHeader title="优先协商银行" />{request.banks.length ? <div className="bank-rank-list compact">{request.banks.map((bank, index) => <article key={bank.name}><span className="rank-number">{index + 1}</span><div className="bank-name"><strong>{bank.name}</strong><small>{bank.note}</small></div><div><strong>{bank.balance}</strong><small>问题余额</small></div><div><strong>{bank.contribution}</strong><small>贡献占比</small></div></article>)}</div> : <DCEmpty icon="Landmark" title="暂无可确认的银行建议" description="当前证据无法核对机构映射。" />}</section>
        </main>
        <aside className="detail-aside"><section className="content-panel sticky-card"><DCSectionHeader title="判断前先核对" /><div className="decision-checklist"><div><DCIcon name="Building2" /><span>业务主体</span><strong>{request.subjectName}</strong></div><div><DCIcon name="UserRound" /><span>建议负责人</span><strong>{request.owner}</strong></div><div><DCIcon name="Database" /><span>数据版本</span><strong>{request.evidence.dataVersion}</strong></div><div><DCIcon name="CalendarClock" /><span>数据截至</span><strong>{request.evidence.cutoff}</strong></div><div><DCIcon name="ShieldCheck" /><span>证据状态</span><strong>{request.evidence.freshness}</strong></div></div>{canDecide ? <div className="sticky-actions"><DCButton onClick={() => setDecisionMode("reject")}>拒绝</DCButton><DCButton variant="primary" onClick={() => setDecisionMode("confirm")}>确认并交办</DCButton></div> : null}</section></aside>
      </div> : null}
      {tab === "evidence" ? <EvidencePanel request={request} /> : null}
      {tab === "sources" && DC_UI_VARIANT === "portfolio" ? <div className="source-trace-stack">
        <section className="content-panel section-card"><DCSectionHeader title="来源与追溯" description="行动申请记录事项从哪里提出、建议做什么以及如何通过校验；它不是需要再次处理的任务。" /><DCKeyValues columns={3} items={[{ label: "请求来源", value: SOURCE_META[request.sourceType].label }, { label: "来源场景", value: request.scenario }, { label: "行动类型", value: `${request.actionType.name} · ${request.actionType.version}` }, { label: "原始建议", value: request.recommendation }, { label: "请求时间", value: request.requestTime, mono: true }, { label: "请求校验结果", value: request.requestGate?.status === "accepted" ? "校验通过" : request.requestGate?.status === "rejected" ? "校验未通过" : "校验中" }, { label: "规则引用及命中条件", value: request.rule ? `${request.rule.id} · ${request.rule.version} · ${request.rule.branch}` : "不适用" }, { label: "原始证据", value: `${request.metric.name} ${request.metric.value} · ${request.evidence.snapshotId}` }, { label: "事项形成时间", value: request.generatedTime, mono: true }]} /><div className="source-trace-actions"><DCButton icon="Waypoints" variant="primary" onClick={() => onNavigate(portfolioRequestDetailTarget(request.id, route.query.returnTo || ""))}>查看原始行动申请</DCButton><DCButton icon="Route" onClick={() => onNavigate(`trace/reminder/${request.reminderId}`)}>查看完整追溯</DCButton></div></section>
        <section className="content-panel section-card"><DCSectionHeader title="关联的来源记录" description="严格重复请求保留独立来源记录，但只关联当前决策事项，不形成新的待我决策。" count={request.duplicateRequests.length + 1} /><div className="request-chain-list"><button type="button" onClick={() => onNavigate(portfolioRequestDetailTarget(request.id, route.query.returnTo || ""))}><DCSourceBadge type={request.sourceType} /><div><strong>{request.id}</strong><span>{request.sourceRef}</span></div><span className="plain-chip">形成当前事项</span><DCIcon name="ChevronRight" /></button>{request.duplicateRequests.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(portfolioRequestDetailTarget(item.id, route.query.returnTo || ""))}><DCSourceBadge type={item.sourceType} /><div><strong>{item.id}</strong><span>{item.sourceRef}</span></div><span className="plain-chip">已关联既有决策事项</span><DCIcon name="ChevronRight" /></button>)}</div></section>
      </div> : null}
      {tab === "sources" && DC_UI_VARIANT !== "portfolio" ? <section className="content-panel section-card"><DCSectionHeader title="关联行动申请" description="所有原申请逐条保留；严格重复只关联开放提醒，不合并业务主体或待办。" count={request.duplicateRequests.length + 1} /><div className="request-chain-list"><button type="button" onClick={() => onNavigate(`request/${request.id}`)}><DCSourceBadge type={request.sourceType} /><div><strong>{request.id}</strong><span>{request.sourceRef}</span></div><DCStatus status={request.status} compact /><DCIcon name="ChevronRight" /></button>{request.duplicateRequests.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(`request/${item.id}`)}><DCSourceBadge type={item.sourceType} /><div><strong>{item.id}</strong><span>{item.sourceRef}</span></div><span className="plain-chip">{item.relation}</span><DCIcon name="ChevronRight" /></button>)}</div></section> : null}
      {tab === "changes" ? <section className="content-panel section-card"><DCSectionHeader title="变更记录" description="撤回、纠正和替代只追加事实，不覆盖原证据和人工决定。" />{request.sourceEvents.length ? <DCTimeline items={request.sourceEvents.map((event) => ({ time: event.time, label: event.type, detail: `${portfolioDisplayText(event.reason)}${event.replacementId ? ` · 替代请求 ${event.replacementId}` : ""}`, icon: "RefreshCw", tone: "warning" }))} /> : <DCEmpty icon="History" title="没有来源变更" description="当前请求的固定证据尚未收到撤回、纠正或替代事实。" />}</section> : null}
      <DecisionModal open={Boolean(decisionMode)} request={request} mode={decisionMode || "confirm"} onClose={() => setDecisionMode(null)} onSubmit={async (mode, form, onProgress) => { const result = await submitDecision(request.id, mode, form, onProgress); if (result.ok) setDecisionMode(null); return result; }} />
      <SupplementModal open={supplementOpen} request={request} onClose={() => setSupplementOpen(false)} onSubmit={(form) => requestSupplement(request.id, form)} />
    </div>
  );
}

function TaskActionModal({ open, type, task, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState("");
  const [bank, setBank] = useState(task.banks[0] || "");
  const [nextStep, setNextStep] = useState("");
  const [owner, setOwner] = useState(task.owner);
  const [dueDate, setDueDate] = useState(task.dueDate);
  const [instructions, setInstructions] = useState(task.instructions);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setReason(""); setResult(""); setBank(task.banks[0] || ""); setNextStep(""); setOwner(task.owner); setDueDate(task.dueDate); setInstructions(task.instructions); setSubmitting(false); setError("");
  }, [open, type, task.id]);
  const config = {
    progress: { title: "记录处理进展", icon: "MessageSquarePlus", action: "保存进展" },
    complete: { title: "完成待办", icon: "CircleCheckBig", action: "确认完成" },
    fail: { title: "记录执行失败", icon: "CircleX", action: "确认失败" },
    cancel: { title: "取消待办", icon: "Ban", action: "确认取消" },
    edit: { title: "修改执行安排", icon: "PencilLine", action: "保存修改" },
    correct: { title: "发起结果纠正", icon: "RefreshCw", action: "提交纠正" },
    source_continue: { title: "确认继续执行", icon: "PlayCircle", action: "继续执行" },
  }[type] || { title: "更新待办", icon: "Pencil", action: "保存" };
  const submit = async () => {
    if (type === "progress" && !result.trim()) return setError("请填写本次处理进展。"), undefined;
    if (["complete", "correct"].includes(type) && !result.trim()) return setError("请填写可核对的结果说明。"), undefined;
    if (["fail", "cancel", "source_continue", "correct"].includes(type) && !reason.trim()) return setError("请填写本次操作原因。"), undefined;
    if (type === "fail" && !nextStep.trim()) return setError("请填写恢复建议或下一步安排。"), undefined;
    if (type === "edit" && (!reason.trim() || !owner.trim() || !dueDate || !instructions.trim())) return setError("负责人、到期时间、执行说明和修改理由均为必填。"), undefined;
    if (type === "edit" && dueDate < dateOnly(new Date())) return setError("到期时间不能早于今天。"), undefined;
    setSubmitting(true); setError("");
    const response = await onSubmit(type, { reason, result, bank, nextStep, owner, dueDate, instructions });
    if (!response.ok) { setSubmitting(false); setError(response.message); return; }
    onClose();
  };
  return (
    <DCModal open={open} onClose={() => !submitting && onClose()} title={config.title} description={`${task.subjectName} · ${task.id}`} icon={config.icon} width="640px" footer={!submitting ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant={["fail", "cancel"].includes(type) ? "danger" : "primary"} icon={config.icon} onClick={submit}>{config.action}</DCButton></> : null}>
      {submitting ? <DCLoadingBlock title="正在保存操作" description="完成后会同步更新待办状态和追溯记录。" /> : <div className="task-action-form">
        {error ? <DCAlert tone="danger" title="本次操作没有完成">{error} 已保留填写内容，可修改后重试。</DCAlert> : null}
        {type === "progress" ? <DCTextarea label="进展说明" value={result} onChange={setResult} required placeholder="记录已联系对象、当前反馈和下一步" /> : null}
        {type === "complete" ? <><DCTextarea label="完成结果" value={result} onChange={setResult} required placeholder="说明实际完成内容、协商结果和后续安排" /><DCSelect label="主要协商银行" value={bank} onChange={setBank} options={task.banks.length ? task.banks : ["不适用"]} /></> : null}
        {type === "fail" ? <><DCTextarea label="失败原因" value={reason} onChange={setReason} required placeholder="说明本次执行未达到预期的原因" /><DCTextarea label="恢复建议" value={nextStep} onChange={setNextStep} required placeholder="说明可重试条件、责任人或下一步安排" /></> : null}
        {type === "cancel" ? <DCTextarea label="取消原因" value={reason} onChange={setReason} required placeholder="说明为什么不再继续本次待办" /> : null}
        {type === "edit" ? <><div className="form-grid"><DCField label="负责人" value={owner} onChange={setOwner} required /><DCField label="到期时间" type="date" value={dueDate} onChange={setDueDate} min={dateOnly(new Date())} required /></div><DCTextarea label="执行说明" value={instructions} onChange={setInstructions} required /><DCTextarea label="修改理由" value={reason} onChange={setReason} required placeholder="说明本次修改原因；原值会保留在追溯中" /></> : null}
        {type === "correct" ? <><DCTextarea label="纠正原因" value={reason} onChange={setReason} required placeholder="说明原记录需要纠正的原因" /><DCTextarea label="纠正后的结果" value={result} onChange={setResult} required placeholder="填写应当保留的新结果" /></> : null}
        {type === "source_continue" ? <><DCAlert tone="warning" title="上游证据已发生变化">继续执行不会覆盖原固定证据；本次理由将与上游变化一并保留。</DCAlert><DCTextarea label="继续执行理由" value={reason} onChange={setReason} required placeholder="说明为什么仍按原人工决定继续" /></> : null}
      </div>}
    </DCModal>
  );
}

function TaskDetailScreen({ task, request, onNavigate, runTaskAction, refreshSource }) {
  const [tab, setTab] = useState("overview");
  const [action, setAction] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [directAction, setDirectAction] = useState(null);
  const directActionRef = React.useRef(null);
  if (!task) return <MissingScreen onNavigate={onNavigate} />;
  const visual = taskVisualStatus(task);
  const canAccept = DC_UI_VARIANT === "portfolio" && task.status === "assigned";
  const canStart = task.status === "pending";
  const canWork = ["in_progress", "execution_failed"].includes(task.status);
  const canEdit = ["assigned", "pending", "in_progress", "execution_failed"].includes(task.status);
  const canCorrect = ["completed", "cancelled"].includes(task.status);

  const doDirect = async (type) => {
    if (directActionRef.current) return { ok: false };
    directActionRef.current = type;
    setDirectAction(type);
    const result = await runTaskAction(task.id, type, {});
    directActionRef.current = null;
    setDirectAction(null);
    return result;
  };
  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSource(task.id);
    setRefreshing(false);
  };

  const primaryAction = canAccept ? <DCButton variant="primary" icon="UserCheck" loading={directAction === "accept"} disabled={Boolean(directAction)} onClick={() => doDirect("accept")}>确认承接</DCButton>
    : canStart ? <DCButton variant="primary" icon="Play" loading={directAction === "start"} disabled={Boolean(directAction)} onClick={() => doDirect("start")}>开始处理</DCButton>
    : task.status === "in_progress" ? <DCButton variant="primary" icon="CircleCheckBig" onClick={() => setAction("complete")}>完成待办</DCButton>
      : task.status === "execution_failed" ? <DCButton variant="primary" icon="RefreshCw" loading={directAction === "retry"} disabled={Boolean(directAction)} onClick={() => doDirect("retry")}>重试执行</DCButton>
        : null;

  return (
    <div className="page-shell detail-page">
      <DCPageHeader
        onBack={() => window.history.back()}
        eyebrow="负责人待办"
        title={task.title}
        description={`${task.subjectName} · ${task.owner} · 到期 ${task.dueDate}`}
        meta={<><span className="mono">{task.id}</span><DCStatus status={visual.status} suffix={visual.suffix} compact /></>}
        actions={<><DCButton icon="Route" onClick={() => onNavigate(`trace/task/${task.id}`)}>查看追溯</DCButton><DCButton icon="RefreshCw" loading={refreshing} onClick={handleRefresh}>重新读取来源</DCButton>{primaryAction}</>}
      />
      {task.overdue && !["completed", "cancelled", "corrected"].includes(task.status) ? <DCAlert tone="warning" title={`已逾期，仍保持${DC_STATUS_META[task.status]?.label || "当前"}状态`} actions={<DCButton size="sm" onClick={() => setAction("edit")}>调整到期时间</DCButton>}>到期日为 {task.dueDate}。逾期是时间提示，不会覆盖真实执行进度。</DCAlert> : null}
      {task.failure && task.status === "execution_failed" ? <DCAlert tone="danger" title="最近一次执行失败" actions={<DCButton size="sm" variant="primary" icon="RefreshCw" loading={directAction === "retry"} disabled={Boolean(directAction)} onClick={() => doDirect("retry")}>重试执行</DCButton>}>{task.failure.reason} 恢复建议：{task.failure.nextStep}</DCAlert> : null}
      {task.sourceChanged ? <DCAlert tone="warning" title="上游证据发生变化" actions={<>{!["cancelled", "corrected"].includes(task.status) ? <DCButton size="sm" onClick={() => setAction("source_continue")}>继续执行</DCButton> : null}{!["cancelled", "completed", "corrected"].includes(task.status) ? <DCButton size="sm" variant="danger" onClick={() => setAction("cancel")}>取消待办</DCButton> : null}{["completed", "cancelled"].includes(task.status) ? <DCButton size="sm" variant="primary" onClick={() => setAction("correct")}>发起纠正</DCButton> : null}</>}>{task.sourceChangeEvent?.detail} 上游变化不会自动取消已有人工决定。</DCAlert> : null}
      {task.status === "correcting" ? <DCAlert tone="info" title="正在形成纠正记录"><span className="inline-loading"><DCIcon name="LoaderCircle" className="spin" />原结果保持只读，纠正完成后会并列展示新旧值。</span></DCAlert> : null}

      <div className="task-command-bar content-panel">
        <div className="task-command-main"><span className="avatar-large">{task.owner.slice(-2)}</span><div><span>当前负责人</span><strong>{task.owner}</strong></div><div><span>到期时间</span><strong className={task.overdue ? "danger-text" : ""}>{task.dueDate}</strong></div><div><span>当前状态</span><DCStatus status={visual.status} suffix={visual.suffix} compact /></div></div>
        <div className="task-command-actions">{canEdit ? <DCButton icon="PencilLine" disabled={Boolean(directAction)} onClick={() => setAction("edit")}>修改安排</DCButton> : null}{task.status === "in_progress" ? <DCButton icon="MessageSquarePlus" disabled={Boolean(directAction)} onClick={() => setAction("progress")}>记录进展</DCButton> : null}{canWork && task.status !== "execution_failed" ? <DCButton variant="danger-ghost" icon="CircleX" disabled={Boolean(directAction)} onClick={() => setAction("fail")}>记录失败</DCButton> : null}{["assigned", "pending", "in_progress", "execution_failed"].includes(task.status) ? <DCButton variant="danger-ghost" icon="Ban" disabled={Boolean(directAction)} onClick={() => setAction("cancel")}>取消</DCButton> : null}{canCorrect ? <DCButton icon="RefreshCw" disabled={Boolean(directAction)} onClick={() => setAction("correct")}>发起纠正</DCButton> : null}</div>
      </div>

      <DCTabs value={tab} onChange={setTab} items={[{ value: "overview", label: "执行信息", icon: "ClipboardList" }, { value: "progress", label: "进展与结果", icon: "MessagesSquare", count: task.progress.length }, { value: "basis", label: "决策依据", icon: "FileCheck2" }, { value: "history", label: "状态记录", icon: "History", count: task.history.length }]} />
      {tab === "overview" ? <div className="two-column-detail"><main className="detail-main"><section className="content-panel section-card"><DCSectionHeader title="执行说明" /><p className="task-instructions">{task.instructions}</p><DCKeyValues columns={2} items={[{ label: "确认理由", value: task.decisionReason }, { label: "优先协商银行", value: task.banks.join("、") }, { label: "创建时间", value: task.createdAt, mono: true }, { label: "到期时间", value: task.dueDate }]} /></section><section className="content-panel section-card"><DCSectionHeader title="本次协商范围" /><div className="bank-chip-list">{task.banks.map((bank, index) => <span key={bank}><em>{index + 1}</em>{bank}</span>)}</div></section>{task.result || task.correction ? <section className="content-panel section-card result-card"><DCSectionHeader title={task.correction ? "当前有效结果" : "完成结果"} /><div className="result-summary"><span><DCIcon name="BadgeCheck" /></span><div><strong>{task.correction?.result || task.result?.summary}</strong><p>{task.correction ? `纠正原因：${task.correction.reason}` : `主要协商银行：${task.result?.bank}`}</p></div></div></section> : null}</main><aside className="detail-aside"><section className="content-panel sticky-card"><DCSectionHeader title="不可修改的决策依据" /><div className="immutable-list"><div><span>业务主体</span><strong>{task.subjectName} · {task.subjectId}</strong></div><div><span>行动类型</span><strong>{task.actionType.name} · {task.actionType.version}</strong></div><div><span>Rule 条件</span><strong>{task.ruleLabel}</strong></div><div><span>指标快照</span><strong>{task.metricLabel}{DC_UI_VARIANT === "portfolio" && (task.metricSnapshotId || request?.evidence?.snapshotId) ? ` · ${task.metricSnapshotId || request.evidence.snapshotId}` : ""}</strong></div>{DC_UI_VARIANT === "portfolio" ? <div><span>语义版本</span><strong>{task.semanticVersion || request?.evidence?.semanticVersion || "引用不可用"}</strong></div> : null}<div><span>数据版本</span><strong>{task.dataVersion}</strong></div><div><span>数据截至</span><strong>{task.cutoff}</strong></div>{DC_UI_VARIANT === "portfolio" ? <div><span>来源记录</span><strong>{task.sourceRef || request?.sourceRef || "引用不可用"}</strong></div> : null}</div></section></aside></div> : null}
      {tab === "progress" ? <section className="content-panel section-card"><DCSectionHeader title="进展与结果" actions={task.status === "in_progress" ? <DCButton size="sm" icon="MessageSquarePlus" onClick={() => setAction("progress")}>记录进展</DCButton> : null} />{task.progress.length || task.result || task.correction ? <div className="progress-feed">{task.progress.map((item, index) => <article key={`${item.time}-${index}`}><span className="avatar-small">{item.author.slice(-2)}</span><div><header><strong>{item.author}</strong><time>{item.time}</time></header><p>{item.content}</p></div></article>)}{task.result ? <article className="final-result"><span><DCIcon name="CircleCheckBig" /></span><div><header><strong>完成结果</strong><time>{task.result.time}</time></header><p>{task.result.summary}</p><small>主要协商银行：{task.result.bank}</small></div></article> : null}{task.correction ? <article className="correction-result"><span><DCIcon name="RefreshCw" /></span><div><header><strong>纠正结果</strong><time>{task.correction.time}</time></header><p>{task.correction.result}</p><small>原因：{task.correction.reason}</small></div></article> : null}</div> : <DCEmpty icon="MessagesSquare" title="尚无处理进展" description="开始待办后，可逐次记录联系情况和阶段结果。" />}</section> : null}
      {tab === "basis" ? <section className="content-panel section-card"><DCSectionHeader title="确认时固定的决策依据" /><DCKeyValues columns={3} items={[{ label: DC_UI_VARIANT === "portfolio" ? "决策事项" : "原提醒", value: task.reminderId, mono: true }, { label: "行动申请", value: task.requestId, mono: true }, { label: DC_UI_VARIANT === "portfolio" ? "行动类型" : "行动类型", value: `${task.actionType.name} · ${task.actionType.version}` }, { label: "规则条件引用", value: task.ruleLabel }, { label: DC_UI_VARIANT === "portfolio" ? "指标快照" : "指标快照", value: DC_UI_VARIANT === "portfolio" && (task.metricSnapshotId || request?.evidence?.snapshotId) ? `${task.metricLabel} · ${task.metricSnapshotId || request.evidence.snapshotId}` : task.metricLabel }, ...(DC_UI_VARIANT === "portfolio" ? [{ label: "语义版本", value: task.semanticVersion || request?.evidence?.semanticVersion || "引用不可用", mono: true }] : []), { label: "数据版本", value: task.dataVersion, mono: true }, { label: "数据截至时间", value: task.cutoff }, ...(DC_UI_VARIANT === "portfolio" ? [{ label: "来源记录", value: task.sourceRef || request?.sourceRef || "引用不可用" }, { label: "来源请求时间", value: task.sourceRequestTime || request?.requestTime || "引用不可用", mono: true }] : []), { label: "人工确认理由", value: task.decisionReason }, { label: "确认后负责人", value: task.owner }]} /><div className="center-action"><DCButton icon="Route" onClick={() => onNavigate(`trace/task/${task.id}`)}>查看完整追溯</DCButton></div></section> : null}
      {tab === "history" ? <section className="content-panel section-card"><DCSectionHeader title="状态记录" description="每次更新保留原状态、目标状态、操作内容和结果。" /><DCTimeline items={[...task.history].reverse().map((item) => ({ ...item, icon: item.label.includes("失败") ? "CircleX" : item.label.includes("纠正") ? "RefreshCw" : "CircleCheck" }))} /></section> : null}
      <TaskActionModal open={Boolean(action)} type={action} task={task} onClose={() => setAction(null)} onSubmit={(type, payload) => runTaskAction(task.id, type, payload)} />
    </div>
  );
}

function OperationsOverviewScreen(props) {
  return DC_UI_VARIANT === "portfolio" ? <PortfolioOperationsOverviewScreen {...props} /> : <LegacyOperationsOverviewScreen {...props} />;
}

function PortfolioOperationsOverviewScreen({ data, onNavigate, updateAISummary }) {
  const route = parseDecisionRoute();
  const stored = getStoredView().overview || {};
  const [source, setSource] = useState(route.query.source || stored.source || "all");
  const [range, setRange] = useState(route.query.range || stored.range || "30d");
  useEffect(() => {
    setSource(route.query.source || stored.source || "all");
    setRange(route.query.range || stored.range || "30d");
  }, [route.query.source, route.query.range]);
  const changeFilter = (patch) => {
    const next = { source, range, ...patch };
    setSource(next.source); setRange(next.range); saveStoredView({ overview: next });
    const params = new URLSearchParams();
    if (next.source !== "all") params.set("source", next.source);
    if (next.range !== "30d") params.set("range", next.range);
    onNavigate(`overview${params.toString() ? `?${params}` : ""}`, {}, true);
  };
  const inRange = (value) => inDecisionRange(value, range);
  const expanded = expandDecisionRequests(data.requests).filter((item) => (source === "all" || item.sourceType === source) && inRange(item.requestTime));
  const canonicalIds = new Set(expanded.map((item) => item.canonicalRequestId || item.duplicateOf || item.id));
  const requests = data.requests.filter((item) => canonicalIds.has(item.id));
  const tasks = data.tasks.filter((item) => canonicalIds.has(item.requestId));
  const sourceCounts = Object.keys(SOURCE_META).map((type) => ({ type, count: expandDecisionRequests(data.requests).filter((item) => item.sourceType === type && inRange(item.requestTime)).length }));
  const taskCategoryCounts = Object.fromEntries(PORTFOLIO_TASK_CATEGORIES.map((category) => [category, tasks.filter((task) => portfolioTaskCategory(task) === category).length]));
  const taskCategories = PORTFOLIO_TASK_CATEGORIES.map((category) => ({ category, ...PORTFOLIO_TASK_CATEGORY_META[category], count: taskCategoryCounts[category] }));
  const exceptionCounts = Object.fromEntries(Object.keys(PORTFOLIO_EXCEPTION_META).map((category) => [category, requests.filter((request) => portfolioExceptionCategory(request) === category).length]));
  const exceptionRequests = requests.filter((request) => portfolioExceptionCategory(request));
  const contextLabel = `${source === "all" ? "全部来源" : SOURCE_META[source].label} · ${range === "7d" ? "近 7 日" : range === "30d" ? "近 30 日" : "全部时间"}`;
  const signature = `${contextLabel}|${requests.map((item) => `${item.id}:${item.status}`).join(",")}|${tasks.map((item) => `${item.id}:${item.status}:${item.overdue}`).join(",")}`;
  const counts = {
    awaiting: requests.filter((item) => item.status === "awaiting").length,
    confirmed: requests.filter((item) => item.decision?.type === "confirm").length,
    rejected: requests.filter((item) => item.decision?.type === "reject").length,
    reminders: requests.filter(requestHasReminder).length,
    decisions: requests.filter((item) => item.decision || item.status === "supplement_requested").length,
    ended: tasks.filter((item) => ["completed", "cancelled", "corrected"].includes(item.status)).length,
  };
  const ownerNames = [...new Set(tasks.map((item) => item.owner))].sort();
  const scopedTaskRoute = (extra = {}) => {
    const params = new URLSearchParams();
    if (source !== "all") params.set("source", source);
    if (range !== "all") params.set("range", range);
    Object.entries(extra).forEach(([key, value]) => value === null || value === undefined || value === "all" ? params.delete(key) : params.set(key, value));
    return `tasks${params.toString() ? `?${params}` : ""}`;
  };
  const requestDirectoryRoute = (extra = {}) => {
    const params = new URLSearchParams({ from: "overview" });
    if (source !== "all") params.set("source", source);
    if (range !== "all") params.set("range", range);
    Object.entries(extra).forEach(([key, value]) => value === null || value === undefined || value === "all" ? params.delete(key) : params.set(key, value));
    return `operations/requests${params.toString() ? `?${params}` : ""}`;
  };
  const activity = data.activity.filter((item) => inRange(item.time) && (source === "all" || requests.some((request) => item.detail.includes(request.subjectName)))).slice(0, 6).map((item) => ({ ...item, label: item.label.replaceAll("提醒", "决策事项"), detail: item.detail.replaceAll("提醒", "决策事项") }));

  const inbox = readC011Inbox(data.scenarioContext);
  return <div className="page-shell overview-page portfolio-overview-page">
    <DCPageHeader eyebrow="决策运营概览" title="决策链路与负责人行动" description="将负责人待办状态与决策链路异常分开管理；每个数量均可下钻到同一统计口径。" actions={<><DCButton icon="Inbox" onClick={() => onNavigate("operations/intake")}>接收行动申请{inbox.requests.length ? `（${inbox.requests.length}）` : ""}</DCButton><DCButton icon="ListTodo" onClick={() => onNavigate(scopedTaskRoute())}>追踪待办</DCButton><DCButton variant="primary" icon="Scale" onClick={() => onNavigate("workbench")}>进入待我决策</DCButton></>} />
    <div className="ops-context-bar content-panel"><div><DCIcon name="Filter" /><strong>统计范围</strong><span>{contextLabel}</span></div><div><DCSelect label="来源" value={source} onChange={(value) => changeFilter({ source: value })} options={[{ value: "all", label: "全部来源" }, ...Object.entries(SOURCE_META).map(([value, item]) => ({ value, label: item.label }))]} /><DCSelect label="时间" value={range} onChange={(value) => changeFilter({ range: value })} options={[{ value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }, { value: "all", label: "全部时间" }]} /></div></div>

    <section className="content-panel portfolio-task-health"><DCSectionHeader title="负责人待办状态" description="六类互斥口径；逾期按时间优先归类，不与执行进度重复计数。" /><div>{taskCategories.map((item) => <button type="button" key={item.category} className={item.count ? "has-records" : ""} onClick={() => onNavigate(scopedTaskRoute({ status: item.category }))}><span><DCIcon name={item.icon} /></span><div><small>{item.label}</small><strong>{item.count}</strong></div><DCIcon name="ChevronRight" /></button>)}</div></section>

    <div className="portfolio-ops-grid">
      <section className="content-panel portfolio-exceptions"><DCSectionHeader title="决策链路异常" description="请求、证据、撤回替代和交办创建异常，不计入领导待决策队列。" count={exceptionRequests.length} actions={<DCButton size="sm" onClick={() => onNavigate(requestDirectoryRoute({ exception: "exceptions" }))}>查看全部</DCButton>} /><div>{Object.entries(PORTFOLIO_EXCEPTION_META).map(([category, meta]) => <button type="button" key={category} onClick={() => onNavigate(requestDirectoryRoute({ exception: category }))}><span className={exceptionCounts[category] ? "attention" : ""}><DCIcon name={meta.icon} /></span><div><strong>{meta.label}</strong><small>{meta.description}</small></div><em>{exceptionCounts[category]}</em><DCIcon name="ChevronRight" /></button>)}</div></section>
      <section className="content-panel source-board"><DCSectionHeader title="申请来源" description="点击后进入行动申请目录，并保留当前统计范围与返回位置。" /><div className="source-count-grid">{sourceCounts.map((item) => <button type="button" key={item.type} onClick={() => onNavigate(requestDirectoryRoute({ source: item.type }))}><DCSourceBadge type={item.type} /><strong>{item.count}</strong><small>条行动申请</small><span>查看来源记录 <DCIcon name="ArrowRight" /></span></button>)}</div></section>
    </div>

    <section className="operations-funnel content-panel" aria-label="行动全链路"><button className="funnel-stage" onClick={() => onNavigate(requestDirectoryRoute())}><span>行动申请</span><strong>{expanded.length}</strong><small>四类来源统一进入</small></button><DCIcon name="ChevronRight" /><button className="funnel-stage" onClick={() => onNavigate(requestDirectoryRoute({ reminder: "formed" }))}><span>形成决策事项</span><strong>{counts.reminders}</strong><small>申请与证据校验通过后形成</small></button><DCIcon name="ChevronRight" /><button className="funnel-stage" onClick={() => onNavigate(requestDirectoryRoute({ decision: "handled" }))}><span>人工决定</span><strong>{counts.decisions}</strong><small>{counts.confirmed} 已处理 · {counts.rejected} 已拒绝</small></button><DCIcon name="ChevronRight" /><button className="funnel-stage" onClick={() => onNavigate(scopedTaskRoute())}><span>负责人待办</span><strong>{tasks.length}</strong><small>人工确认后独立形成</small></button><DCIcon name="ChevronRight" /><button className="funnel-stage" onClick={() => onNavigate(scopedTaskRoute({ status: "ended" }))}><span>执行结果</span><strong>{counts.ended}</strong><small>完成、取消或纠正</small></button></section>

    <AISummaryPanel scope="overview" requests={requests} tasks={tasks} contextLabel={contextLabel} contextSignature={signature} onNavigate={onNavigate} persisted={data.aiSummaries?.operationsOverview} onPersist={(next) => updateAISummary("overview", next)} />

    <div className="overview-grid portfolio-overview-detail">
      <section className="content-panel portfolio-owner-matrix"><DCSectionHeader title="负责人行动组合" description="按负责人查看独立待办、涉及单位和六类运行状态。" />{ownerNames.length ? <div className="record-table-wrap"><table className="record-table"><thead><tr><th>负责人</th><th>独立待办</th><th>涉及单位</th><th>待承接</th><th>待开始</th><th>处理中</th><th>逾期</th><th>失败</th><th>纠正</th><th></th></tr></thead><tbody>{ownerNames.map((owner) => { const ownerTasks = tasks.filter((item) => item.owner === owner); const units = [...new Set(ownerTasks.map((item) => item.subjectName))]; return <tr key={owner}><td><strong>{owner}</strong><small>{ownerTasks.length} 条独立执行记录</small></td><td>{ownerTasks.length}</td><td><span>{units.join("、")}</span><small>{units.length} 个单位</small></td>{PORTFOLIO_TASK_CATEGORIES.map((category) => <td key={category}>{ownerTasks.filter((item) => portfolioTaskCategory(item) === category).length}</td>)}<td><DCButton size="sm" onClick={() => onNavigate(scopedTaskRoute({ owner }))}>查看详情</DCButton></td></tr>; })}</tbody></table></div> : <DCEmpty icon="Users" title="当前范围没有负责人待办" description="人工确认成功并创建独立待办后，这里会按负责人展示行动组合。" action={<DCButton icon="Scale" onClick={() => onNavigate("workbench")}>进入待我决策</DCButton>} />}</section>
      <section className="content-panel activity-board"><DCSectionHeader title="最近运行记录" description={contextLabel} actions={requests[0] ? <DCButton size="sm" icon="Route" onClick={() => onNavigate(`trace/request/${requests[0].id}`)}>查看追溯</DCButton> : null} />{activity.length ? <DCTimeline compact items={activity.map((item) => ({ ...item, icon: item.label.includes("失败") || item.label.includes("阻断") ? "CircleX" : "CircleCheck" }))} /> : <DCEmpty icon="History" title="当前范围暂无运行记录" description="调整来源或时间范围后重新查看。" />}</section>
    </div>
  </div>;
}

function PortfolioRequestDirectoryScreen({ data, onNavigate }) {
  const route = parseDecisionRoute();
  const stored = getStoredView().requestDirectory || {};
  const [search, setSearch] = useState(decisionQueryValue(route.query, "q", stored.search || ""));
  const [source, setSource] = useState(decisionQueryValue(route.query, "source", stored.source || "all"));
  const [range, setRange] = useState(decisionQueryValue(route.query, "range", stored.range || "all"));
  const [exception, setException] = useState(decisionQueryValue(route.query, "exception", stored.exception || "all"));
  const [reminder, setReminder] = useState(decisionQueryValue(route.query, "reminder", stored.reminder || "all"));
  const [decision, setDecision] = useState(decisionQueryValue(route.query, "decision", stored.decision || "all"));
  const [selectedId, setSelectedId] = useState(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
  const [readState, setReadState] = useState("ready");
  const [readAttempts, setReadAttempts] = useState(0);
  useEffect(() => {
    setSearch(decisionQueryValue(route.query, "q", stored.search || ""));
    setSource(decisionQueryValue(route.query, "source", stored.source || "all"));
    setRange(decisionQueryValue(route.query, "range", stored.range || "all"));
    setException(decisionQueryValue(route.query, "exception", stored.exception || "all"));
    setReminder(decisionQueryValue(route.query, "reminder", stored.reminder || "all"));
    setDecision(decisionQueryValue(route.query, "decision", stored.decision || "all"));
    setSelectedId(decisionQueryValue(route.query, "selected", stored.selectedId || ""));
  }, [route.query.q, route.query.source, route.query.range, route.query.exception, route.query.reminder, route.query.decision, route.query.selected]);
  const requestDirectoryHash = (context) => {
    const params = new URLSearchParams({ from: "overview" });
    if (context.search) params.set("q", context.search);
    if (context.source !== "all") params.set("source", context.source);
    if (context.range !== "all") params.set("range", context.range);
    if (context.exception !== "all") params.set("exception", context.exception);
    if (context.reminder !== "all") params.set("reminder", context.reminder);
    if (context.decision !== "all") params.set("decision", context.decision);
    if (context.selectedId) params.set("selected", context.selectedId);
    return `operations/requests?${params}`;
  };
  const update = (patch) => {
    const next = { search, source, range, exception, reminder, decision, selectedId, ...patch };
    setSearch(next.search); setSource(next.source); setRange(next.range); setException(next.exception); setReminder(next.reminder); setDecision(next.decision); setSelectedId(next.selectedId);
    saveStoredView({ requestDirectory: next });
    onNavigate(requestDirectoryHash(next), {}, true);
  };
  const syncSelectionBeforeLeaving = (item) => {
    const next = { search, source, range, exception, reminder, decision, selectedId: item.id };
    setSelectedId(item.id);
    saveStoredView({ requestDirectory: next });
    const hash = `#${requestDirectoryHash(next)}`;
    window.history.replaceState({ ...(window.history.state || {}), dcRoute: hash }, "", hash);
    return next;
  };
  const refreshDirectory = () => {
    setReadState("loading");
    window.setTimeout(() => {
      if (readAttempts === 0) {
        setReadAttempts(1);
        setReadState("error");
        return;
      }
      setReadAttempts((value) => value + 1);
      setReadState("ready");
    }, 650);
  };
  const inRange = (value) => range === "all" || inDecisionRange(value, range);
  const records = expandDecisionRequests(data.requests).filter((item) => {
    const category = portfolioExceptionCategory(item);
    return `${item.subjectName} ${item.id} ${item.metric.name} ${item.actionType.name} ${item.owner}`.toLowerCase().includes(search.toLowerCase())
      && (source === "all" || item.sourceType === source)
      && inRange(item.requestTime)
      && (exception === "all" || (exception === "exceptions" ? Boolean(category) : category === exception))
      && (reminder === "all" || (reminder === "formed" ? requestHasReminder(item) : reminder === "not_formed" ? !requestHasReminder(item) : true))
      && (decision === "all" || (decision === "handled" ? Boolean(item.decision || item.status === "supplement_requested") : decision === "unhandled" ? !item.decision && item.status !== "supplement_requested" : true));
  });
  const selected = records.find((item) => item.id === selectedId) || records[0] || null;
  const openDetail = (item) => {
    if (!item) return;
    const context = syncSelectionBeforeLeaving(item);
    const returnTo = requestDirectoryHash(context);
    onNavigate(`request/${item.id}?from=request-directory&returnTo=${encodeURIComponent(returnTo)}`);
  };
  const openDecisionItem = (item) => {
    if (!item?.reminderId) return;
    const context = syncSelectionBeforeLeaving(item);
    onNavigate(portfolioDecisionItemTarget(item.reminderId, "request-directory", requestDirectoryHash(context)));
  };
  return <div className="page-shell operations-request-page">
    <DCPageHeader onBack={() => window.history.back()} eyebrow="决策运营概览 · 下钻" title="行动申请目录" description="集中查看四类来源和链路异常；这里只处理申请与异常，不会直接确认或创建负责人待办。" actions={<><DCButton icon="RefreshCw" loading={readState === "loading"} onClick={refreshDirectory}>{readState === "error" ? "重试读取" : "重新读取"}</DCButton><DCButton icon="Gauge" onClick={() => window.history.back()}>返回运营概览</DCButton></>} />
    {readState === "error" ? <DCAlert tone="danger" title="行动申请读取失败" actions={<DCButton size="sm" variant="primary" icon="RefreshCw" onClick={refreshDirectory}>重试读取</DCButton>}>筛选、选中记录和上一批结果均已保留；恢复连接后可继续读取。</DCAlert> : null}
    <section className="content-panel portfolio-request-directory">
      <div className="task-filters portfolio-request-filters"><DCSearch value={search} onChange={(value) => update({ search: value, selectedId: "" })} placeholder="搜索主体、请求或指标" /><DCSelect label="来源" value={source} onChange={(value) => update({ source: value, selectedId: "" })} options={[{ value: "all", label: "全部来源" }, ...Object.entries(SOURCE_META).map(([value, item]) => ({ value, label: item.label }))]} /><DCSelect label="时间" value={range} onChange={(value) => update({ range: value, selectedId: "" })} options={[{ value: "all", label: "全部时间" }, { value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }]} /><DCSelect label="链路异常" value={exception} onChange={(value) => update({ exception: value, selectedId: "" })} options={[{ value: "all", label: "全部记录" }, { value: "exceptions", label: "全部链路异常" }, ...Object.entries(PORTFOLIO_EXCEPTION_META).map(([value, item]) => ({ value, label: item.label }))]} /><DCSelect label="决策事项" value={reminder} onChange={(value) => update({ reminder: value, selectedId: "" })} options={[{ value: "all", label: "全部" }, { value: "formed", label: "已形成或已关联" }, { value: "not_formed", label: "未形成" }]} /><DCSelect label="决定状态" value={decision} onChange={(value) => update({ decision: value, selectedId: "" })} options={[{ value: "all", label: "全部决定" }, { value: "handled", label: "已处理" }, { value: "unhandled", label: "未处理" }]} /></div>
      <div className="portfolio-master-detail"><main className="portfolio-directory">{records.length ? <div className="record-table-wrap"><table className="record-table"><thead><tr><th>业务主体</th><th>来源</th><th>行动类型</th><th>决策事项</th><th>决定</th><th>校验 / 申请状态</th><th>申请时间</th><th></th></tr></thead><tbody>{records.map((item) => <tr key={item.id} className={selected?.id === item.id ? "selected" : ""} onClick={() => update({ selectedId: item.id })}><td><strong>{item.subjectName}</strong><small>{item.metric.name} {item.metric.value}</small></td><td><DCSourceBadge type={item.sourceType} compact /><small>{item.id}</small></td><td><span>{item.actionType.name}</span><small>{item.actionType.version}</small></td><td><span>{portfolioReminderLabel(item)}</span><small>{item.reminderId || "无关联事项"}</small></td><td><span>{portfolioDecisionLabel(item)}</span><small>{item.decision?.time || item.supplement?.time || (item.duplicateOf ? "不单独决定" : "未处理")}</small></td><td><DCStatus status={item.status} label={portfolioRequestDisplayLabel(item)} tone={portfolioRequestDisplayTone(item)} compact /></td><td><span className="mono">{item.requestTime}</span><small>截至 {item.evidence.cutoff.split(" ")[0]}</small></td><td><DCButton size="sm" icon="ArrowRight" onClick={(event) => { event.stopPropagation(); openDetail(item); }}>查看详情</DCButton></td></tr>)}</tbody></table></div> : <DCEmpty icon="Waypoints" title="当前范围没有行动申请" description="调整来源、时间、事项或异常类型后重新查看。" action={<DCButton icon="RotateCcw" onClick={() => update({ search: "", source: "all", range: "all", exception: "all", reminder: "all", decision: "all", selectedId: "" })}>清除筛选</DCButton>} />}</main><PortfolioRequestPreview request={selected} onOpenDetail={openDetail} onOpenDecisionItem={openDecisionItem} onNavigate={onNavigate} /></div>
    </section>
  </div>;
}

function PortfolioActionIntakeScreen({ data, onNavigate, receiveActionRequests }) {
  const [inbox, setInbox] = useState(() => readC011Inbox(data.scenarioContext));
  const [receiving, setReceiving] = useState(false);
  const [result, setResult] = useState(null);
  const context = data.scenarioContext;
  const refresh = () => { setInbox(readC011Inbox(data.scenarioContext)); setResult(null); };
  const receive = async () => {
    setReceiving(true);
    const next = await receiveActionRequests(inbox.requests);
    setResult(next);
    setInbox(readC011Inbox(data.scenarioContext));
    setReceiving(false);
  };
  const validations = inbox.requests.map((item) => ({ item, validation: validateC011Payload(item, context) }));
  return <div className="page-shell operations-request-page">
    <DCPageHeader onBack={() => window.history.back()} eyebrow="决策运营概览 · 申请接收" title="接收行动申请" description="按当前场景轮次、主体、行动类型、规则条件和精确双版本幂等接收；接收前重新读取数据安全状态。" actions={<><DCButton icon="RefreshCw" onClick={refresh}>重新读取</DCButton><DCButton icon="Gauge" onClick={() => onNavigate("overview")}>返回运营概览</DCButton></>} />
    {!scenarioContextReady(context) ? <DCAlert tone="danger" title="当前场景运行上下文不可用">缺少或无法确认场景标识、场景版本、运行轮次和启用状态。当前不会接收请求，也不会形成决策事项。</DCAlert> : <section className="content-panel section-card"><DCSectionHeader title="当前工作轮次" description="请求、决策事项、人工决定、负责人待办和运行记录均固定在同一上下文。" /><DCKeyValues columns={3} items={[{ label: "场景", value: context.scenarioId }, { label: "场景版本", value: context.scenarioVersion }, { label: "运行轮次", value: context.scenarioRunId }, { label: "上下文状态", value: context.status }, { label: "形成时间", value: context.formedAt || "由平台当前上下文提供" }, { label: "来源", value: context.source }]} /></section>}
    {result ? <DCAlert tone={result.conflicts || result.rejected || result.blocked ? "warning" : "success"} title="本次接收结果">新增 {result.created} 条，幂等返回 {result.duplicates} 条，冲突拒绝 {result.conflicts} 条，质量硬失败拒绝 {result.rejected} 条，安全状态阻断 {result.blocked} 条。</DCAlert> : null}
    <section className="content-panel portfolio-request-directory">
      <DCSectionHeader title="待接收请求" description="来源只提交标准请求；本页不能人工确认或直接创建负责人待办。" count={inbox.requests.length} actions={inbox.requests.length ? <DCButton variant="primary" icon="Inbox" loading={receiving} disabled={!scenarioContextReady(context)} onClick={receive}>接收当前请求</DCButton> : null} />
      {inbox.status === "invalid" ? <DCAlert tone="danger" title="请求包无法识别">{inbox.reason}</DCAlert> : null}
      {inbox.status === "context_mismatch" ? <DCAlert tone="warning" title="未读取其他运行轮次的请求">{inbox.reason}。原请求包保持不变，等待上游按当前 {context.scenarioRunId} 重新提交。</DCAlert> : null}
      {validations.length ? <div className="record-table-wrap"><table className="record-table"><thead><tr><th>申请标识</th><th>业务主体</th><th>来源</th><th>行动类型</th><th>规则条件</th><th>精确双版本</th><th>合同检查</th></tr></thead><tbody>{validations.map(({ item, validation }, index) => <tr key={`${item.id || item.requestId}-${c011ContractFingerprint(item)}-${index}`}><td><strong>{item.id || item.requestId || "缺失"}</strong><small>{normalizedScenarioContext(item.scenarioContext || item).scenarioRunId || "轮次缺失"}</small></td><td><span>{item.subjectName || item.singleBusinessSubjectName || "缺失"}</span><small>{item.subjectId || item.singleBusinessSubjectId || "标识缺失"}</small></td><td><DCSourceBadge type={item.sourceType} compact /></td><td><span>{item.actionType?.name || "缺失"}</span><small>{item.actionType?.id || "标识缺失"} · {item.actionType?.version || "版本缺失"}</small></td><td><span>{item.rule ? `${item.rule.id} · ${item.rule.version}` : "不适用"}</span><small>{item.rule?.branch || "非规则来源不虚构条件"}</small></td><td><span>{item.evidence?.semanticVersion || item.semanticVersion || "缺失"}</span><small>{item.evidence?.dataVersion || item.dataVersion || "缺失"}</small></td><td><DCStatus status={validation.ok ? "confirmed" : "rejected_by_gate"} label={validation.ok ? "可进入安全读取" : "合同不完整"} tone={validation.ok ? "success" : "danger"} compact />{validation.problems.length ? <small>{validation.problems.join("；")}</small> : null}</td></tr>)}</tbody></table></div> : <DCEmpty icon="Inbox" title="当前没有待接收的行动申请" description="规则触发、智能问数、Agent 应用或报告中心仪表盘提交同一场景轮次的标准申请后，可在这里重新读取并接收。" action={<DCButton icon="RefreshCw" onClick={refresh}>重新读取</DCButton>} />}
    </section>
  </div>;
}

function PortfolioRequestPreview({ request, onNavigate, onOpenDetail, onOpenDecisionItem }) {
  if (!request) return <aside className="portfolio-decision-preview"><DCEmpty icon="MousePointer2" title="选择一条请求" description="当前范围没有可预览内容。" /></aside>;
  return <aside className="portfolio-decision-preview"><header><div><span>行动申请</span><h2>{request.subjectName}</h2><p>{request.metric.name} {request.metric.value}</p></div><DCStatus status={request.status} label={portfolioRequestDisplayLabel(request)} tone={portfolioRequestDisplayTone(request)} /></header>{portfolioExceptionCategory(request) ? <DCAlert tone="warning" title={PORTFOLIO_EXCEPTION_META[portfolioExceptionCategory(request)].label}>{portfolioDisplayText(request.blockReason || request.recovery || "请查看申请详情中的异常与恢复建议。")}</DCAlert> : null}{request.duplicateOf ? <DCAlert tone="info" title="不形成新的待我决策">固定证据与最早申请一致，已关联既有决策事项，由同一人工决定继续处理。</DCAlert> : null}<DecisionLifecycle request={request} compact /><div className="portfolio-preview-sections"><section><span>从哪里提出</span><strong>{SOURCE_META[request.sourceType].label}</strong><p>{request.sourceRef}</p></section><section><span>申请与证据校验</span><strong>{request.duplicateOf ? "校验通过，严格重复" : request.requestGate?.status === "accepted" ? "校验通过" : request.requestGate?.status === "rejected" ? "校验未通过" : "校验中"}</strong><p>{portfolioDisplayText(request.requestGate?.reason || request.formation?.requestGateReason)}</p></section><section><span>决策事项</span><strong>{portfolioReminderLabel(request)}</strong><p>{requestHasReminder(request) ? `${request.reminderId} · ${portfolioDecisionLabel(request)}` : "当前未形成领导判断事项"}</p></section></div><dl className="portfolio-preview-facts"><div><dt>行动类型</dt><dd>{request.actionType.name} · {request.actionType.version}</dd></div><div><dt>建议负责人</dt><dd>{request.owner}</dd></div><div><dt>申请时间</dt><dd>{request.requestTime}</dd></div><div><dt>数据截至</dt><dd>{request.evidence.cutoff}</dd></div></dl><div className="portfolio-preview-actions"><DCButton icon="Route" onClick={() => onNavigate(`trace/request/${request.id}`)}>查看追溯</DCButton>{requestHasReminder(request) ? <DCButton icon="Scale" onClick={() => onOpenDecisionItem(request)}>查看决策事项</DCButton> : null}<DCButton variant="primary" icon="ArrowRight" onClick={() => onOpenDetail(request)}>查看详情</DCButton></div></aside>;
}

function LegacyOperationsOverviewScreen({ data, onNavigate, updateAISummary }) {
  const route = parseDecisionRoute();
  const [source, setSource] = useState(route.query.source || "all");
  const [range, setRange] = useState(route.query.range || "30d");
  const changeFilter = (patch) => {
    const next = { source, range, ...patch };
    setSource(next.source); setRange(next.range);
    const params = new URLSearchParams();
    if (next.source !== "all") params.set("source", next.source);
    if (next.range !== "30d") params.set("range", next.range);
    onNavigate(`overview${params.toString() ? `?${params}` : ""}`, {}, true);
  };
  const inRange = (value) => {
    if (range === "all") return true;
    const days = range === "7d" ? 7 : 30;
    const parsed = new Date(String(value).replace(" ", "T"));
    return !Number.isNaN(parsed.getTime()) && (new Date("2026-08-12T23:59:59") - parsed) <= days * 86400000;
  };
  const requests = data.requests.filter((item) => (source === "all" || item.sourceType === source) && inRange(item.requestTime));
  const requestIds = new Set(requests.map((item) => item.id));
  const tasks = data.tasks.filter((item) => requestIds.has(item.requestId));
  const allRequests = expandDecisionRequests(requests);
  const counts = {
    requests: allRequests.length,
    reminders: requests.filter(requestHasReminder).length,
    awaiting: requests.filter((item) => item.status === "awaiting").length,
    confirmed: requests.filter((item) => item.decision?.type === "confirm").length,
    rejected: requests.filter((item) => item.status === "rejected").length,
    activeTasks: tasks.filter((item) => ["assigned", "pending", "in_progress", "correcting"].includes(item.status)).length,
    overdue: tasks.filter((item) => item.overdue && !["completed", "cancelled", "corrected"].includes(item.status)).length,
    failed: tasks.filter((item) => item.status === "execution_failed").length,
    blocked: requests.filter((item) => DECISION_CHANGE_STATUSES.includes(item.status)).length,
    corrected: tasks.filter((item) => ["correcting", "corrected"].includes(item.status)).length,
  };
  const attentionRequests = requests.filter((item) => OPERATIONS_ATTENTION_STATUSES.includes(item.status));
  const queue = attentionRequests.slice(0, 8);
  const sourceCounts = Object.keys(SOURCE_META).map((type) => ({ type, count: allRequests.filter((item) => item.sourceType === type).length }));
  const taskStates = ["assigned", "pending", "in_progress", "execution_failed", "completed", "cancelled", "correcting", "corrected"].map((status) => ({ status, count: tasks.filter((item) => item.status === status).length }));
  const contextLabel = `融资优化 · ${source === "all" ? "全部来源" : SOURCE_META[source].label} · ${range === "7d" ? "近 7 日" : range === "30d" ? "近 30 日" : "全部时间"}`;
  const signature = `${contextLabel}|${requests.map((item) => `${item.id}:${item.status}`).join(",")}|${tasks.map((item) => `${item.id}:${item.status}`).join(",")}`;
  const owners = [...new Set(tasks.map((item) => item.owner))];
  const scopedRoute = (base, extra = {}) => {
    const [path, query = ""] = base.split("?");
    const params = new URLSearchParams(query);
    params.set("source", source);
    params.set("range", range);
    params.set("status", "all");
    params.set("q", "");
    params.set("selected", "");
    if (path === "workbench") params.set("view", "reminders");
    if (path === "tasks") {
      params.set("owner", "all");
      params.set("subject", "all");
      params.set("due", "all");
      params.set("action", "all");
    }
    Object.entries(extra).forEach(([key, value]) => {
      if (value === null || value === undefined) params.delete(key);
      else params.set(key, value);
    });
    return `${path}${params.toString() ? `?${params}` : ""}`;
  };
  const scopedActivity = data.activity.filter((item) => inRange(item.time) && (source === "all" || requests.some((request) => item.detail.includes(request.subjectName)))).slice(0, 5);
  return (
    <div className="page-shell overview-page">
      <DCPageHeader eyebrow="决策运营概览" title="行动处理运行情况" description="查看需要判断、执行中和异常状态，并下钻到同一条运行记录。" actions={<><DCButton icon="ListTodo" onClick={() => onNavigate(scopedRoute("tasks"))}>追踪待办</DCButton><DCButton variant="primary" icon="Inbox" onClick={() => onNavigate(scopedRoute("workbench"))}>进入决策工作台</DCButton></>} />
      <div className="ops-context-bar content-panel"><div><DCIcon name="Filter" /><strong>统计范围</strong><span>{contextLabel}</span></div><div><DCSelect label="来源" value={source} onChange={(value) => changeFilter({ source: value })} options={[{ value: "all", label: "全部来源" }, ...Object.entries(SOURCE_META).map(([value, item]) => ({ value, label: item.label }))]} /><DCSelect label="时间" value={range} onChange={(value) => changeFilter({ range: value })} options={[{ value: "7d", label: "近 7 日" }, { value: "30d", label: "近 30 日" }, { value: "all", label: "全部时间" }]} /></div></div>
      <div className="operations-metrics">
        <button type="button" onClick={() => onNavigate(scopedRoute("workbench", { status: "awaiting" }))}><span>待确认提醒</span><strong>{counts.awaiting}</strong><small>{contextLabel}</small><DCIcon name="Clock3" /></button>
        <button type="button" onClick={() => onNavigate(scopedRoute("workbench", { status: "decided" }))}><span>已处理 / 已拒绝</span><strong>{counts.confirmed}<em>/</em>{counts.rejected}</strong><small>{contextLabel}</small><DCIcon name="Scale" /></button>
        <button type="button" onClick={() => onNavigate(scopedRoute("tasks", { status: "active" }))}><span>运行中待办</span><strong>{counts.activeTasks}</strong><small>待承接、待开始、处理中与纠正中</small><DCIcon name="ListTodo" /></button>
        <button type="button" onClick={() => onNavigate(scopedRoute("tasks", { status: "overdue" }))} className={counts.overdue ? "warning" : ""}><span>已逾期</span><strong>{counts.overdue}</strong><small>保留真实执行状态</small><DCIcon name="AlarmClock" /></button>
        <button type="button" onClick={() => onNavigate(scopedRoute("workbench", { view: "requests", status: "attention" }))} className={counts.blocked ? "warning" : ""}><span>决策异常</span><strong>{counts.blocked}</strong><small>请求门拒绝、证据异常、撤回、纠正或创建失败</small><DCIcon name="ShieldAlert" /></button>
        <button type="button" onClick={() => onNavigate(scopedRoute("tasks", { status: "execution_failed" }))} className={counts.failed ? "danger" : ""}><span>执行失败</span><strong>{counts.failed}</strong><small>可重试、取消或调整安排</small><DCIcon name="CircleX" /></button>
        <button type="button" onClick={() => onNavigate(scopedRoute("tasks", { status: "correction" }))}><span>待办纠正</span><strong>{counts.corrected}</strong><small>纠正中与已纠正</small><DCIcon name="RefreshCw" /></button>
      </div>
      <AISummaryPanel scope="overview" requests={requests} tasks={tasks} contextLabel={contextLabel} contextSignature={signature} onNavigate={onNavigate} persisted={data.aiSummaries?.operationsOverview} onPersist={(next) => updateAISummary("overview", next)} />
      <section className="operations-funnel content-panel" aria-label="行动全链路">
        <button className="funnel-stage" onClick={() => onNavigate(scopedRoute("workbench", { view: "requests" }))}><span>行动申请</span><strong>{counts.requests}</strong><small>四类来源统一进入</small></button><DCIcon name="ChevronRight" />
        <button className="funnel-stage" onClick={() => onNavigate(scopedRoute("workbench", { view: "reminders" }))}><span>形成提醒</span><strong>{counts.reminders}</strong><small>通过校验后形成</small></button><DCIcon name="ChevronRight" />
        <button className="funnel-stage" onClick={() => onNavigate(scopedRoute("workbench", { status: "decided" }))}><span>人工决定</span><strong>{counts.confirmed + counts.rejected}</strong><small>{counts.confirmed} 确认 · {counts.rejected} 拒绝</small></button><DCIcon name="ChevronRight" />
        <button className="funnel-stage" onClick={() => onNavigate(scopedRoute("tasks"))}><span>负责人待办</span><strong>{tasks.length}</strong><small>不同主体保持独立</small></button><DCIcon name="ChevronRight" />
        <button className="funnel-stage" onClick={() => onNavigate(scopedRoute("tasks", { status: "ended" }))}><span>执行结果</span><strong>{tasks.filter((item) => ["completed", "cancelled", "corrected"].includes(item.status)).length}</strong><small>完成、取消或纠正</small></button>
      </section>
      <div className="overview-grid">
        <section className="content-panel overview-queue"><DCSectionHeader title="需要关注" description="按待确认、失败、阻断和上游变化聚合显示。" count={attentionRequests.length} actions={<DCButton size="sm" onClick={() => onNavigate(scopedRoute("workbench", { view: "requests", status: "operations_attention" }))}>查看全部</DCButton>} /><div className="attention-list">{queue.length ? queue.map((item) => <button type="button" key={item.id} onClick={() => onNavigate(requestHasReminder(item) ? `reminder/${item.reminderId}` : `request/${item.id}`)}><span className={`attention-icon ${SOURCE_META[item.sourceType].tone}`}><DCIcon name={SOURCE_META[item.sourceType].icon} /></span><div><strong>{item.subjectName} · {item.metric.name}</strong><small>{item.metric.value} · {item.owner}</small></div><DCStatus status={item.status} compact /><DCIcon name="ChevronRight" /></button>) : <DCEmpty icon="Inbox" title="当前没有需要关注的记录" description="切换统计范围后重新查看。" />}</div></section>
        <section className="content-panel status-board"><DCSectionHeader title="待办状态" description="负责人待办的当前运行状态。" /><div className="status-count-list">{taskStates.map((item) => <button type="button" key={item.status} onClick={() => onNavigate(scopedRoute("tasks", { status: item.status }))}><DCStatus status={item.status} compact /><strong>{item.count}</strong><span>条</span></button>)}</div><div className="overdue-callout"><span><DCIcon name="AlarmClock" /></span><div><strong>{counts.overdue} 条待办已逾期</strong><small>逾期不覆盖处理中等执行事实</small></div><DCButton size="sm" onClick={() => onNavigate(scopedRoute("tasks", { status: "overdue" }))}>查看详情</DCButton></div></section>
        <section className="content-panel source-board"><DCSectionHeader title="申请来源" description="四类来源统一形成行动申请。" /><div className="source-count-grid">{sourceCounts.map((item) => <button type="button" key={item.type} onClick={() => onNavigate(scopedRoute("workbench", { view: "requests", source: item.type }))}><DCSourceBadge type={item.type} /><strong>{item.count}</strong><small>条申请</small></button>)}</div></section>
        <section className="content-panel activity-board"><DCSectionHeader title="最近运行记录" description={contextLabel} actions={requests[0] ? <DCButton size="sm" icon="Route" onClick={() => onNavigate(`trace/request/${requests[0].id}`)}>查看追溯</DCButton> : null} />{scopedActivity.length ? <DCTimeline compact items={scopedActivity.map((item) => ({ ...item, icon: item.label.includes("失败") || item.label.includes("阻断") ? "CircleX" : "CircleCheck" }))} /> : <DCEmpty icon="History" title="当前范围暂无运行记录" description="调整来源或时间范围后重新查看。" />}</section>
        {DC_UI_VARIANT === "portfolio" ? <section className="content-panel portfolio-matrix"><DCSectionHeader title="负责人行动组合" description="组合统计不合并不同主体记录。" /><table><thead><tr><th>负责人</th><th>独立待办</th><th>处理中</th><th>逾期</th><th>失败</th><th></th></tr></thead><tbody>{owners.map((owner) => { const ownerTasks = tasks.filter((item) => item.owner === owner); return <tr key={owner}><td data-label="负责人">{owner}</td><td data-label="独立待办">{ownerTasks.length}</td><td data-label="处理中">{ownerTasks.filter((item) => item.status === "in_progress").length}</td><td data-label="逾期">{ownerTasks.filter((item) => item.overdue).length}</td><td data-label="失败">{ownerTasks.filter((item) => item.status === "execution_failed").length}</td><td><DCButton size="sm" onClick={() => onNavigate(scopedRoute("tasks", { owner }))}>查看详情</DCButton></td></tr>; })}</tbody></table></section> : null}
      </div>
    </div>
  );
}

function TraceStep({ state, icon, title, subtitle, details, active, onClick, actionLabel }) {
  return (
    <button type="button" className={`trace-step ${state} ${active ? "active" : ""}`} onClick={onClick}>
      <span className="trace-step-icon"><DCIcon name={icon} size={18} /></span>
      <div><small>{subtitle}</small><strong>{title}</strong><p>{details}</p>{actionLabel ? <em>{actionLabel}<DCIcon name="ChevronRight" size={12} /></em> : null}</div>
    </button>
  );
}

function TraceScreen({ kind, id, data, onNavigate }) {
  let request = null;
  let task = null;
  const [selected, setSelected] = useState(kind === "task" ? "task" : "source");
  if (kind === "request") request = expandDecisionRequests(data.requests).find((item) => item.id === id);
  if (kind === "reminder") request = data.requests.find((item) => item.reminderId === id);
  if (kind === "task") { task = data.tasks.find((item) => item.id === id); request = data.requests.find((item) => item.id === task?.requestId); }
  if (!request && !task) return <MissingScreen onNavigate={onNavigate} />;
  const subjectName = request?.subjectName || task.subjectName;
  const actionType = request?.actionType || task.actionType;
  const canonicalRequest = request?.canonicalRequestId ? data.requests.find((item) => item.id === request.canonicalRequestId) : request;
  const traceTask = task || data.tasks.find((item) => item.requestId === canonicalRequest?.id);
  const decision = canonicalRequest?.decision || request?.decision;
  const formation = request?.formation || {
    requestGateStatus: request?.requestGate?.status || "accepted",
    requestGateCheckedAt: request?.requestGate?.checkedAt || request?.generatedTime,
    requestGateReason: request?.requestGate?.reason || "已完成请求门校验",
    reminderCreated: Boolean(request?.reminderId),
    confirmationGateStatus: request?.status === "rejected_by_gate" ? "not_reached" : "passed",
    confirmationGateReason: request?.confirmationEligibility?.reason || "固定证据可进入人工判断",
  };

  const sourceTitle = request ? SOURCE_META[request.sourceType].label : "来源记录";
  const sourceDetails = request ? request.sourceRef : "原来源记录已固定在待办依据中";
  const requestGateRejected = formation.requestGateStatus === "rejected";
  const requestGateBlocked = formation.requestGateStatus === "blocked" || request?.status === "c017_blocked";
  const confirmationBlockedAtFormation = formation.confirmationGateStatus === "blocked";
  const duplicateLinked = Boolean(request?.duplicateOf);
  const reminderFormed = Boolean((formation.reminderCreated || duplicateLinked) && request?.reminderId);
  const requestState = requestGateRejected || requestGateBlocked ? "failed" : "done";
  const validationState = requestGateRejected || requestGateBlocked || confirmationBlockedAtFormation ? "failed" : "done";
  const reminderState = reminderFormed ? "done" : "stopped";
  const noDecisionTitle = duplicateLinked ? (DC_UI_VARIANT === "portfolio" ? "随关联事项处理" : "随关联提醒处理")
    : request?.status === "awaiting" ? "等待人工判断"
    : ["blocked", "missing_evidence", "stale", "supplement_requested"].includes(request?.status) ? "暂不能判断"
      : "未形成决定";
  const noDecisionReason = duplicateLinked ? `严格重复请求已关联既有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"} ${request.reminderId}，本请求不单独进入人工判断。`
    : requestGateRejected ? "请求门已拒绝，未到达人工判断。"
    : requestGateBlocked ? "C017 当前状态不可确认，请求接收安全门已阻断。"
    : confirmationBlockedAtFormation ? portfolioDisplayText(formation.confirmationGateReason)
      : request?.status === "withdrawn" ? "来源已撤回，本次请求不再进入人工判断。"
        : request?.status === "replaced" ? "原请求已由替代请求承接，不能继续判断。"
          : request?.status === "stale" ? "证据时效已变化，需核对新证据后再判断。"
            : request?.status === "supplement_requested" ? "已请求补充信息，等待上游形成新的或替代的行动申请。"
              : request?.confirmationEligibility?.reason || "尚未提交人工决定。";
  const decisionStopped = noDecisionTitle !== "等待人工判断";
  const decisionState = decision ? "done" : duplicateLinked ? "future" : request?.status === "awaiting" ? "current" : "stopped";
  const taskState = traceTask ? (["completed", "corrected"].includes(traceTask.status) ? "done" : traceTask.status === "execution_failed" ? "failed" : "current") : decision?.type === "reject" || decisionStopped ? "stopped" : canonicalRequest?.status === "create_failed" ? "failed" : decision?.type === "confirm" || canonicalRequest?.taskCreating ? "current" : "future";
  const resultState = traceTask ? (["completed", "cancelled", "corrected"].includes(traceTask.status) ? "done" : traceTask.status === "execution_failed" ? "failed" : "current") : decision?.type === "reject" || decisionStopped ? "stopped" : "future";

  const selectedContent = {
    source: { title: "从哪里来", text: sourceDetails, fields: request ? [{ label: "来源类型", value: sourceTitle }, { label: "来源记录", value: request.sourceRef }, { label: "发起者", value: request.requester }, { label: "请求时间", value: request.requestTime }] : [] },
    request: { title: "如何进入决策中心", text: request ? `行动申请 ${request.id} 引用已发布行动类型“${actionType.name}”${request.duplicateOf ? `，并关联最早申请 ${request.duplicateOf} 的既有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}，不单独决定` : ""}。` : `原行动申请：${task.requestId}`, fields: request ? [{ label: "业务主体", value: `${request.subjectName} · ${request.subjectId}` }, { label: "行动类型", value: `${actionType.name} · ${actionType.version}` }, { label: "规则条件引用", value: request.rule ? `${request.rule.id} · ${request.rule.version}` : "不适用" }, { label: "指标快照", value: `${request.metric.name} ${request.metric.value}` }] : [] },
    validation: { title: "三道质量安全门如何推进或阻断", text: portfolioDisplayText(requestGateRejected || requestGateBlocked ? formation.requestGateReason : confirmationBlockedAtFormation ? formation.confirmationGateReason : "接收、人工确认提交和待办形成前均按精确数据版本重新读取 C017；页面缓存不能授权推进。"), fields: request ? [{ label: "申请接收门", value: requestGateRejected ? "已拒绝" : requestGateBlocked ? "已阻断" : "通过" }, { label: "人工确认门", value: latestC017Read(request, "confirmation_submit") ? c017OutcomeMeta(latestC017Read(request, "confirmation_submit").outcome).label : "尚未到达" }, { label: "待办形成门", value: latestC017Read(request, "task_formation") ? c017OutcomeMeta(latestC017Read(request, "task_formation").outcome).label : "尚未到达" }, { label: "已发布语义版本", value: request.evidence.semanticVersion }, { label: "精确数据版本", value: request.evidence.dataVersion }, { label: "安全读取次数", value: `${request.c017SafetyReads?.length || 0} 次` }] : [] },
    reminder: { title: duplicateLinked ? `为什么关联既有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}` : reminderFormed ? (DC_UI_VARIANT === "portfolio" ? "为什么形成决策事项" : "为什么形成提醒") : (DC_UI_VARIANT === "portfolio" ? "为什么没有形成决策事项" : "为什么没有形成提醒"), text: duplicateLinked ? `固定证据与最早请求 ${request.duplicateOf} 完全一致，因此关联${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"} ${request.reminderId}，不重复进入${DC_UI_VARIANT === "portfolio" ? "待我决策" : "待确认提醒"}。` : reminderFormed ? (request ? (request.rule?.hitEvidence || request.metric.explanation) : task.metricLabel) : (formation.requestGateReason || "请求未通过请求门。"), fields: request ? [{ label: DC_UI_VARIANT === "portfolio" ? "决策事项标识" : "提醒标识", value: request.reminderId || "未形成" }, { label: duplicateLinked ? "关联时间" : "生成时间", value: reminderFormed ? request.generatedTime : "不适用" }, { label: "数据版本", value: request.evidence.dataVersion }, { label: "数据截至时间", value: request.evidence.cutoff }] : [] },
    decision: { title: "人工如何决定", text: decision ? `${decision.operator}已${decision.type === "confirm" ? "确认" : "拒绝"}：${decision.reason}` : noDecisionReason, fields: decision ? [{ label: "决定", value: decision.type === "confirm" ? "确认" : "拒绝" }, { label: "操作者", value: decision.operator }, { label: "负责人", value: decision.owner || "不适用" }, { label: "决定时间", value: decision.time }] : [] },
    task: { title: "由谁承接、执行到哪一步", text: traceTask ? `${traceTask.owner} · ${DC_STATUS_META[traceTask.status]?.label || "未知状态"}${traceTask.overdue ? " · 已逾期" : ""}` : decision?.type === "reject" ? "本次行动已拒绝，不创建负责人待办。" : decisionStopped ? `${noDecisionReason} 因此未创建负责人待办。` : "只有人工确认成功后才创建负责人待办。", fields: traceTask ? [{ label: "待办标识", value: traceTask.id }, { label: "负责人", value: traceTask.owner }, { label: "到期时间", value: traceTask.dueDate }, { label: "当前状态", value: `${DC_STATUS_META[traceTask.status]?.label || "未知状态"}${traceTask.overdue ? " · 已逾期" : ""}` }] : [] },
    result: { title: "最终执行结果", text: traceTask?.correction?.result || traceTask?.result?.summary || traceTask?.failure?.reason || (traceTask ? "负责人待办尚未形成最终结果。" : decision?.type === "reject" || decisionStopped ? "未进入负责人执行，因此没有执行结果。" : "尚未创建负责人待办。"), fields: traceTask ? [{ label: "结果状态", value: DC_STATUS_META[traceTask.status]?.label || "未知状态" }, { label: "完成或更新时间", value: traceTask.result?.time || traceTask.correction?.time || traceTask.history.at(-1)?.time || "尚未形成" }, { label: "主要协商银行", value: traceTask.result?.bank || traceTask.banks?.join("、") || "尚未形成" }, { label: "纠正关系", value: traceTask.correction ? `已关联原待办 ${traceTask.id}` : "暂无纠正" }] : [] },
  }[selected];

  const traceEvents = [
    ...(request ? [
      { time: request.requestTime, label: "来源发起行动申请", detail: `${sourceTitle} · ${request.sourceRef}` },
      { time: formation.requestGateCheckedAt || request.generatedTime, label: requestGateRejected ? "行动申请未通过接收门" : request.duplicateOf ? `严格重复申请关联既有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}` : "行动申请通过接收门", detail: portfolioDisplayText(formation.requestGateReason) },
      ...(reminderFormed && !request.duplicateOf ? [{ time: request.generatedTime, label: confirmationBlockedAtFormation ? (DC_UI_VARIANT === "portfolio" ? "形成决策事项，确认门阻断" : "形成决策提醒，确认门阻断") : (DC_UI_VARIANT === "portfolio" ? "形成决策事项" : "形成决策提醒"), detail: confirmationBlockedAtFormation ? portfolioDisplayText(formation.confirmationGateReason) : `${request.subjectName} · ${request.metric.name} ${request.metric.value}` }] : []),
    ] : []),
    ...(request?.sourceEvents || []).map((event) => ({ time: event.time, label: event.type, detail: portfolioDisplayText(event.reason), tone: "warning" })),
    ...(request?.c017SafetyReads || []).map((read) => ({ time: read.readAt, label: `${read.gateLabel} · ${c017OutcomeMeta(read.outcome).label}`, detail: `${read.t007} · ${read.summaryId}/${read.summaryVersion} · ${read.reason}`, tone: read.outcome === "allowed" ? "success" : "warning" })),
    ...(decision ? [{ time: decision.time, label: decision.type === "confirm" ? "人工确认" : "人工拒绝", detail: decision.reason }] : []),
    ...(traceTask?.history || []).filter((event) => !(decision && event.label === "人工确认")).map((event) => ({ time: event.time, label: event.label, detail: event.detail })),
  ].sort((a, b) => b.time.localeCompare(a.time));
  const replacementEvents = [...new Map((request?.sourceEvents || [])
    .filter((event) => event.replacementId)
    .map((event) => [event.replacementId, event])).values()];

  return (
    <div className="page-shell trace-page">
      <DCPageHeader onBack={() => window.history.back()} eyebrow="全链路追溯" title={`${subjectName} · 这项行动是如何产生的`} description="从来源证据到人工决定和执行结果，所有变化按发生顺序保留。" actions={<>{requestHasReminder(request || {}) ? <DCButton icon="Scale" onClick={() => onNavigate(portfolioDecisionItemTarget(request.reminderId))}>{DC_UI_VARIANT === "portfolio" ? "查看决策事项" : "查看提醒"}</DCButton> : null}{traceTask ? <DCButton variant="primary" icon="ListTodo" onClick={() => onNavigate(`task/${traceTask.id}`)}>查看待办</DCButton> : null}</>} />
      <section className="trace-answer content-panel">
        <div><span>发生了什么</span><strong>{request ? `${request.metric.name} ${request.metric.value}` : task.metricLabel}</strong><p>{request ? request.metric.explanation : task.instructions}</p></div>
        <div><span>原因是什么</span><strong>{request?.rule ? `${request.rule.id} ${request.rule.name}` : request ? `${sourceTitle}提出行动建议` : task.ruleLabel}</strong><p>{request?.rule ? request.rule.hitEvidence : "Rule 条件引用不适用或已固定在原请求中"}</p></div>
        <div><span>推荐决策</span><strong>{request?.recommendation || task?.instructions || "暂无可用建议"}</strong><p>{request ? (request.banks?.length ? `优先协商：${request.banks.map((bank) => bank.name).join("、")}` : "当前银行证据不可用") : `协商范围：${task?.banks?.join("、") || "尚未形成"}`}</p></div>
        <div><span>最终决定</span><strong>{decision ? (decision.type === "confirm" ? "已确认并交办" : "已拒绝") : traceTask ? "已确认并交办" : noDecisionTitle}</strong><p>{decision?.reason || traceTask?.decisionReason || noDecisionReason}</p></div>
      </section>

      <section className="trace-flow" aria-label="行动产生链路">
        <TraceStep state="done" icon={request ? SOURCE_META[request.sourceType].icon : "Waypoints"} subtitle="来源" title={sourceTitle} details={sourceDetails} active={selected === "source"} onClick={() => setSelected("source")} actionLabel="查看来源证据" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={requestState} icon="Waypoints" subtitle="唯一标准入口" title="行动申请" details={request?.id || task?.requestId || "记录不可用"} active={selected === "request"} onClick={() => setSelected("request")} actionLabel="查看申请" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={validationState} icon="ShieldCheck" subtitle="C017 三道质量安全门" title={requestGateRejected ? "请求接收门已拒绝" : requestGateBlocked ? "请求接收门已阻断" : confirmationBlockedAtFormation ? "确认门已阻断" : "已按阶段重新读取"} details={request?.evidence ? `${request.evidence.semanticVersion} / ${request.evidence.dataVersion}` : "固定在原记录"} active={selected === "validation"} onClick={() => setSelected("validation")} actionLabel="查看安全门读取" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={reminderState} icon="BellRing" subtitle={DC_UI_VARIANT === "portfolio" ? "领导判断事项" : "带证据提醒"} title={duplicateLinked ? `已关联既有${DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒"}` : reminderFormed || task?.reminderId ? (DC_UI_VARIANT === "portfolio" ? "决策事项" : "决策提醒") : (DC_UI_VARIANT === "portfolio" ? "未形成决策事项" : "未形成提醒")} details={request?.reminderId || task?.reminderId || "请求门未通过"} active={selected === "reminder"} onClick={() => setSelected("reminder")} actionLabel="查看形成原因" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={decisionState} icon="Scale" subtitle="人工判断" title={decision ? (decision.type === "confirm" ? "已确认" : "已拒绝") : traceTask ? "已确认" : noDecisionTitle} details={decision?.time || traceTask?.createdAt || noDecisionReason.replace(/。$/, "")} active={selected === "decision"} onClick={() => setSelected("decision")} actionLabel={duplicateLinked ? "查看关联方式" : "查看决定"} />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={taskState} icon="ListTodo" subtitle="负责人承接" title={traceTask ? (DC_STATUS_META[traceTask.status]?.label || "待办") : "未创建待办"} details={traceTask?.id || (decision?.type === "reject" ? "本次已拒绝" : decisionStopped ? "未形成人工确认" : "确认后创建")} active={selected === "task"} onClick={() => setSelected("task")} actionLabel="查看执行状态" />
        <span className="trace-connector"><DCIcon name="ChevronRight" /></span>
        <TraceStep state={resultState} icon="BadgeCheck" subtitle="执行与纠正" title={traceTask ? (DC_STATUS_META[traceTask.status]?.label || "结果未形成") : "结果未形成"} details={traceTask?.correction?.result || traceTask?.result?.summary || traceTask?.failure?.reason || (traceTask ? "等待负责人处理" : decision?.type === "reject" || decisionStopped ? "未进入负责人执行" : "等待负责人处理")} active={selected === "result"} onClick={() => setSelected("result")} actionLabel="查看结果" />
      </section>

      {request?.duplicateOf || request?.duplicateRequests?.length || request?.replacementOf || replacementEvents.length ? <section className="trace-relations">{request.duplicateOf ? <button type="button" className="trace-relation-card" onClick={() => onNavigate(`request/${request.duplicateOf}`)}><span>关联的最早请求</span><strong>{request.duplicateOf}</strong><p>共享同一开放{DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}，原请求独立保留</p></button> : null}{request.duplicateRequests.map((item) => <button type="button" className="trace-relation-card" key={item.id} onClick={() => onNavigate(`request/${item.id}`)}><span>严格重复 · 独立保留</span><strong>{item.id}</strong><p>{SOURCE_META[item.sourceType].label} · {item.time}</p></button>)}{request.replacementOf ? <button type="button" className="trace-relation-card" onClick={() => onNavigate(`request/${request.replacementOf}`)}><span>替代原请求</span><strong>{request.replacementOf}</strong><p>原固定证据保持只读</p></button> : null}{replacementEvents.map((event) => <button type="button" className="trace-relation-card" key={event.replacementId} onClick={() => onNavigate(`request/${event.replacementId}`)}><span>新的替代请求</span><strong>{event.replacementId}</strong><p>{event.reason}</p></button>)}</section> : null}

      <div className="trace-detail-grid">
        <section className="content-panel trace-selected"><DCSectionHeader title={selectedContent.title} /><p className="trace-selected-copy">{selectedContent.text}</p>{selectedContent.fields.length ? <DCKeyValues columns={2} items={selectedContent.fields} /> : <DCEmpty icon="FileSearch" title="当前仅保留待办中的固定引用" description="可从状态记录继续查看原决定和执行变化。" />}</section>
        <section className="content-panel trace-events"><DCSectionHeader title="全程记录" count={traceEvents.length} /><DCTimeline compact items={traceEvents.map((event) => ({ ...event, icon: event.label.includes("失败") ? "CircleX" : event.label.includes("纠正") ? "RefreshCw" : "CircleCheck" }))} /></section>
      </div>
      {request?.c017SafetyReads?.length ? <section className="content-panel section-card"><DCSectionHeader title="C017 安全读取回执" description="每道门保留本次读取身份、时间和结论；只读最小质量安全字段，不形成决策中心质量副本。" />{Object.keys(C017_GATE_META).map((gate) => latestC017Read(request, gate) ? <C017SafetyReadPanel key={gate} request={request} gate={gate} compact /> : null)}</section> : null}
    </div>
  );
}

function MissingScreen({ onNavigate }) {
  return <div className="page-shell missing-screen"><DCEmpty icon="FileQuestion" title="记录不存在或已无法访问" description="返回决策工作台重新选择一条记录。" action={<DCButton variant="primary" icon="Inbox" onClick={() => onNavigate("workbench")}>返回工作台</DCButton>} /></div>;
}

function ResetModal({ open, onClose, onReset }) {
  const [resetting, setResetting] = useState(false);
  const execute = () => { setResetting(true); window.setTimeout(() => { onReset(); setResetting(false); onClose(); }, 800); };
  return <DCModal open={open} onClose={() => !resetting && onClose()} title="重置当前工作轮次" description="为当前场景形成新的运行轮次，并清空新的工作投影。" icon="RotateCcw" width="520px" footer={!resetting ? <><DCButton onClick={onClose}>取消</DCButton><DCButton variant="danger" icon="RotateCcw" onClick={execute}>确认重置</DCButton></> : null}>{resetting ? <DCLoadingBlock title="正在形成新的工作轮次" /> : <DCAlert tone="warning" title="历史证据不会删除">当前申请、决策事项、人工决定、负责人待办和活动会转为只读历史审计；新轮次从 0 开始，只有接收真实行动申请后才增长。</DCAlert>}</DCModal>;
}

function DecisionApp() {
  const [data, setData] = useState(loadDecisionState);
  const dataRef = React.useRef(data);
  const [route, setRoute] = useState(parseDecisionRoute);
  const [toast, setToast] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const scrollPositionsRef = React.useRef(getStoredView().scrollPositions || {});
  const scrollActivityRef = React.useRef({ route: "", at: 0 });

  useEffect(() => {
    dataRef.current = data;
    window.localStorage.setItem(DC_STORAGE_KEY, JSON.stringify(data));
    window.localStorage.setItem(DC_C019_PROJECTION_KEY, JSON.stringify(buildC019Projection(data)));
    window.dispatchEvent(new CustomEvent("ontology3:decision-center:c019-updated", { detail: { scenarioContext: data.scenarioContext, stateRevision: data.stateRevision } }));
  }, [data]);
  useEffect(() => { const timer = window.setTimeout(() => setBooting(false), 420); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    if (!window.location.hash) window.history.replaceState({}, "", "#workbench");
    window.history.replaceState({ ...(window.history.state || {}), dcRoute: window.location.hash || "#workbench" }, "", window.location.hash || "#workbench");
    const onPop = () => setRoute(parseDecisionRoute());
    window.addEventListener("popstate", onPop);
    window.addEventListener("hashchange", onPop);
    return () => { window.history.scrollRestoration = previousRestoration; window.removeEventListener("popstate", onPop); window.removeEventListener("hashchange", onPop); };
  }, []);
  const activeRoute = window.location.hash || "#workbench";
  const activeRouteKey = decisionScrollRouteKey(activeRoute);
  useEffect(() => {
    const stage = document.getElementById("screen-stage");
    if (!stage) return;
    const saved = getStoredView().scrollPositions || {};
    const desiredTop = Number(window.history.state?.dcScrollTop ?? scrollPositionsRef.current[activeRouteKey] ?? saved[activeRouteKey] ?? saved[activeRoute] ?? 0);
    let cancelledByUser = false;
    let restoring = DC_UI_VARIANT === "portfolio" && desiredTop > 0;
    const frames = [];
    const timers = [];
    let settleTimer = 0;
    const restore = () => {
      if (!cancelledByUser) stage.scrollTo({ top: desiredTop, left: 0 });
    };
    const rememberSettledPosition = () => {
      if (restoring) return;
      const top = stage.scrollTop;
      scrollPositionsRef.current = { ...scrollPositionsRef.current, [activeRouteKey]: top };
      const current = getStoredView();
      saveStoredView({ scrollPositions: { ...(current.scrollPositions || {}), [activeRouteKey]: top } });
    };
    const onStageScroll = () => {
      scrollActivityRef.current = { route: activeRouteKey, at: Date.now() };
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(rememberSettledPosition, 90);
    };
    const cancelRestore = () => { cancelledByUser = true; restoring = false; };
    const cancelOnScrollKey = (event) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancelRestore();
    };

    frames.push(window.requestAnimationFrame(() => {
      frames.push(window.requestAnimationFrame(restore));
    }));
    const restoreDelays = DC_UI_VARIANT === "portfolio" ? [80, 220, 460, 720, 960] : [460];
    restoreDelays.forEach((delay) => timers.push(window.setTimeout(restore, delay)));
    if (restoring) timers.push(window.setTimeout(() => { restore(); restoring = false; rememberSettledPosition(); }, 1040));
    if (DC_UI_VARIANT === "portfolio" && desiredTop > 0) {
      stage.addEventListener("wheel", cancelRestore, { passive: true });
      stage.addEventListener("touchstart", cancelRestore, { passive: true });
      stage.addEventListener("pointerdown", cancelRestore, { passive: true });
      window.addEventListener("keydown", cancelOnScrollKey);
    }
    if (DC_UI_VARIANT === "portfolio") stage.addEventListener("scroll", onStageScroll, { passive: true });
    return () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(settleTimer);
      stage.removeEventListener("wheel", cancelRestore);
      stage.removeEventListener("touchstart", cancelRestore);
      stage.removeEventListener("pointerdown", cancelRestore);
      stage.removeEventListener("scroll", onStageScroll);
      window.removeEventListener("keydown", cancelOnScrollKey);
    };
  }, [activeRouteKey, resetKey]);

  const showToast = useCallback((message, tone = "info") => setToast({ id: Date.now(), message, tone }), []);
  const commitData = useCallback((next) => { dataRef.current = next; setData(next); }, []);
  const navigate = useCallback((target, state = {}, replace = false) => {
    const stage = document.getElementById("screen-stage");
    const currentRoute = window.location.hash || "#workbench";
    const currentKey = decisionScrollRouteKey(currentRoute);
    const currentTop = stage?.scrollTop || 0;
    const settledTop = Number(scrollPositionsRef.current[currentKey]);
    const recentAutomaticScroll = DC_UI_VARIANT === "portfolio"
      && scrollActivityRef.current.route === currentKey
      && Date.now() - scrollActivityRef.current.at < 140
      && Number.isFinite(settledTop);
    const returnTop = recentAutomaticScroll ? settledTop : currentTop;
    const stored = getStoredView();
    scrollPositionsRef.current = { ...scrollPositionsRef.current, [currentKey]: returnTop };
    saveStoredView({ scrollPositions: { ...(stored.scrollPositions || {}), [currentKey]: returnTop } });
    window.history.replaceState({ ...(window.history.state || {}), dcScrollTop: returnTop, dcRoute: currentRoute }, "", currentRoute);
    const hash = `#${target}`;
    if (replace) window.history.replaceState({ ...(window.history.state || {}), ...state, dcScrollTop: returnTop, dcRoute: hash }, "", hash);
    else window.history.pushState({ ...state, dcScrollTop: 0, dcRoute: hash, dcFromRoute: currentRoute }, "", hash);
    setRoute(parseDecisionRoute());
  }, []);
  const addActivity = (current, label, detail, time = formatNow(), refs = {}) => ({ ...current, activity: [{ time, label, detail, scenarioContext: current.scenarioContext, ...refs }, ...current.activity].slice(0, 20) });
  const updateAISummary = useCallback((scope, record) => {
    const key = scope === "overview" ? "operationsOverview" : "workbench";
    const current = dataRef.current;
    commitData({ ...current, aiSummaries: { ...current.aiSummaries, [key]: record } });
  }, [commitData]);

  const appendC017Read = (request, read, patch = {}) => ({
    ...request,
    ...patch,
    c017SafetyReads: [...(request.c017SafetyReads || []), read],
    c017ReadAttempts: {
      ...(request.c017ReadAttempts || {}),
      [read.gate]: (request.c017ReadAttempts?.[read.gate] || 0) + 1,
    },
  });

  const receiveActionRequests = useCallback((payloads = []) => new Promise((resolve) => {
    const current = dataRef.current;
    const result = { created: 0, duplicates: 0, conflicts: 0, rejected: 0, blocked: 0, invalid: 0, returned: [] };
    if (!scenarioContextReady(current.scenarioContext)) {
      resolve({ ...result, blocked: payloads.length || 1 });
      return;
    }
    let next = { ...current, requests: [...current.requests], receipts: [...(current.receipts || [])], activity: [...current.activity] };
    let mutated = false;
    payloads.forEach((payload) => {
      const identity = reconcileC011StableIdentity(next, payload);
      if (identity.outcome === "duplicate") {
        result.duplicates += 1;
        result.returned.push({ outcome: "duplicate", ...identity.references, historical: identity.match.historical, archivedAt: identity.match.archivedAt });
        return;
      }
      const validation = validateC011Payload(payload, current.scenarioContext);
      const requestId = identity.requestId;
      const now = formatNow();
      const receiptBase = { receiptId: `ARR-${Date.now().toString().slice(-8)}-${String(next.receipts.length + 1).padStart(2, "0")}`, requestId, receivedAt: now, scenarioContext: validation.context, idempotencyKey: c011IdempotencyKey(payload), contractFingerprint: identity.fingerprint };
      if (identity.outcome === "conflict") {
        result.conflicts += 1;
        result.returned.push({ outcome: "conflict", ...identity.references, historical: identity.match.historical, archivedAt: identity.match.archivedAt });
        mutated = true;
        next.receipts.unshift({
          ...receiptBase,
          outcome: "conflict",
          status: "标识冲突",
          reason: "同一行动申请标识的场景上下文、来源、主体、行动类型、规则条件、指标或证据载荷不同，原记录未覆盖",
          ...identity.references,
          originalHistorical: identity.match.historical,
          originalArchivedAt: identity.match.archivedAt,
          originalScenarioContext: identity.match.request.scenarioContext || identity.match.archiveScenarioContext,
        });
        next = addActivity(next, "行动申请标识冲突", `${requestId} · 原记录保持不变${identity.match.historical ? "（历史审计）" : ""}`, now, { requestId, ...identity.references });
        return;
      }
      if (!validation.ok) {
        result.invalid += 1;
        mutated = true;
        next.receipts.unshift({ ...receiptBase, outcome: "contract_rejected", status: "请求合同拒绝", reason: validation.problems.join("；"), requestRef: null, reminderRef: null, taskRef: null });
        next = addActivity(next, "行动申请合同拒绝", `${requestId} · ${validation.problems.join("；")}`, now, { requestId });
        return;
      }
      const shell = { ...payload, scenarioContext: validation.context, evidence: { ...(payload.evidence || {}), semanticVersion: validation.semanticVersion, dataVersion: validation.dataVersion }, c017SafetyReads: [] };
      const read = readC017SafetyProjection(shell, "request_receipt");
      const request = normalizeReceivedRequest(payload, validation.context, read);
      mutated = true;
      next.requests.unshift(request);
      if (read.outcome === "allowed") result.created += 1;
      else if (read.outcome === "rejected") result.rejected += 1;
      else result.blocked += 1;
      next.receipts.unshift({ ...receiptBase, outcome: read.outcome === "allowed" ? "accepted" : read.outcome === "rejected" ? "quality_rejected" : "quality_blocked", status: read.outcome === "allowed" ? "请求已接收" : read.outcome === "rejected" ? "请求已拒绝" : "请求已阻断", reason: read.reason, requestRef: request.id, reminderRef: request.reminderId || null, taskRef: null, traceRef: request.traceId });
      next = addActivity(next, read.outcome === "allowed" ? "行动申请接收并形成决策事项" : read.outcome === "rejected" ? "行动申请被质量安全门拒绝" : "行动申请被质量安全门阻断", `${request.subjectName} · ${request.id}`, now, { requestId: request.id, reminderId: request.reminderId, traceId: request.traceId });
    });
    if (mutated) {
      next.stateRevision = current.stateRevision + 1;
      commitData(next);
    }
    showToast(`接收完成：新增 ${result.created}，幂等 ${result.duplicates}，冲突 ${result.conflicts}，拒绝/阻断 ${result.rejected + result.blocked + result.invalid}`, result.conflicts || result.rejected || result.blocked || result.invalid ? "warning" : "success");
    window.setTimeout(() => resolve(result), 650);
  }), [commitData, showToast]);

  const retryC017Receipt = useCallback((requestId) => new Promise((resolve) => {
    const current = dataRef.current;
    const request = current.requests.find((item) => item.id === requestId);
    if (!request || request.status !== "c017_blocked") { resolve({ ok: false }); return; }
    commitData({ ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, requestGate: { ...item.requestGate, status: "reading" } } : item) });
    showToast("正在按精确数据版本重新读取当前质量安全状态", "info");
    window.setTimeout(() => {
      const latest = dataRef.current;
      const target = latest.requests.find((item) => item.id === requestId);
      const read = readC017SafetyProjection(target, "request_receipt");
      if (read.outcome !== "allowed") {
        const next = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? appendC017Read(item, read, { requestGate: { status: "blocked", checkedAt: read.readAt, reason: read.reason, reminderCreated: false }, blockReason: "本次未能读取数据工程权威 C017 当前状态摘要，请求继续阻断。" }) : item) };
        commitData(addActivity(next, read.outcome === "rejected" ? "C017 接收门硬失败拒绝" : "C017 接收门仍阻断", `${target.subjectName} · ${target.evidence.dataVersion}`, read.readAt, { requestId: target.id }));
        showToast(read.outcome === "rejected" ? "数据版本已发生硬质量失败，请求拒绝推进" : "权威摘要仍不可安全解释，请求保持阻断", "danger");
        resolve({ ok: false, outcome: read.outcome });
        return;
      }
      const reminderId = stableResourceId("DR", target.id);
      const next = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? appendC017Read(item, read, {
        status: "awaiting",
        reminderId,
        generatedTime: read.readAt,
        requestGate: { status: "accepted", checkedAt: read.readAt, reason: "C017 接收安全门重读通过，已形成决策事项", reminderCreated: true },
        formation: { requestGateStatus: "accepted", requestGateCheckedAt: read.readAt, requestGateReason: "C017 接收安全门重读通过", reminderCreated: true, confirmationGateStatus: "passed", confirmationGateReason: "固定证据可进入人工判断" },
        confirmationEligibility: { allowed: true, reason: "C017 接收安全门已明确允许" },
        blockReason: null,
        recovery: null,
        evidence: { ...item.evidence, quality: "当前状态允许推进", ready: "安全读取通过", freshness: "当前可信" },
      }) : item) };
      commitData(addActivity(next, "C017 接收门恢复", `${target.subjectName} · 形成决策事项 ${reminderId}`, read.readAt, { requestId: target.id, reminderId }));
      showToast("安全读取通过，已形成决策事项", "success");
      resolve({ ok: true, outcome: "allowed", reminderId });
    }, 900);
  }), [commitData, showToast]);

  const submitDecision = useCallback((requestId, mode, form, onProgress = () => {}) => new Promise((resolve) => {
    const starting = dataRef.current;
    const startingRequest = starting.requests.find((item) => item.id === requestId);
    if (!startingRequest || !requestCanDecide(startingRequest)) {
      resolve({ ok: false, message: startingRequest?.confirmationEligibility?.reason || `当前${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}状态已经变化，不能提交决定。` });
      return;
    }
    commitData({ ...starting, requests: starting.requests.map((item) => item.id === requestId ? { ...item, status: "submitting" } : item) });
    window.setTimeout(() => {
      const current = dataRef.current;
      const request = current.requests.find((item) => item.id === requestId);
      const attempts = request.decisionAttempts || 0;
      const now = formatNow();
      const decision = { type: mode, reason: form.reason, operator: "财务运营账号", time: now, scenarioContext: request.scenarioContext, owner: mode === "confirm" ? form.owner : null, dueDate: mode === "confirm" ? form.dueDate : null, instructions: form.instructions, banks: form.banks };
      if (mode === "reject") {
        const next = { ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, status: "rejected", decision, decisionAttempts: attempts + 1 } : item) };
        commitData(addActivity(next, "人工拒绝行动建议", `${request.subjectName} · ${form.reason}`, now));
        resolve({ ok: true });
        return;
      }
      const confirmationRead = readC017SafetyProjection(request, "confirmation_submit");
      if (confirmationRead.outcome !== "allowed") {
        const read = confirmationRead;
        const failed = { ...current, requests: current.requests.map((item) => item.id === requestId ? appendC017Read(item, read, { status: "awaiting", decisionAttempts: 1 }) : item) };
        commitData(addActivity(failed, read.outcome === "rejected" ? "C017 人工确认门硬失败拒绝" : "C017 人工确认门阻断", `${request.subjectName} · 表单内容未提交`, read.readAt, { requestId, reminderId: request.reminderId }));
        resolve({ ok: false, message: read.outcome === "rejected" ? "当前精确数据版本已发生硬质量失败，人工确认没有保存。" : "当前 C017 摘要不可定位、未知或读取失败，人工确认没有保存。" });
        return;
      }
      const saved = { ...current, requests: current.requests.map((item) => item.id === requestId ? appendC017Read(item, confirmationRead, { status: "decision_saved", decision, decisionAttempts: attempts + 1, taskCreating: false }) : item) };
      commitData(addActivity(saved, "人工确认已保存", `${request.subjectName} · ${form.owner}`, now, { requestId, reminderId: request.reminderId }));
      onProgress("decision_saved");
      window.setTimeout(() => {
        const afterSaved = dataRef.current;
        const creating = { ...afterSaved, requests: afterSaved.requests.map((item) => item.id === requestId ? { ...item, status: "decision_saved", taskCreating: true } : item) };
        commitData(creating);
        onProgress("task_creating");
        window.setTimeout(() => {
          const latest = dataRef.current;
          const latestRequest = latest.requests.find((item) => item.id === requestId);
          const taskRead = readC017SafetyProjection(latestRequest, "task_formation");
          if (taskRead.outcome !== "allowed") {
            const failedAt = taskRead.readAt;
            const blockedRead = taskRead;
            const failed = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? appendC017Read(item, blockedRead, { status: "create_failed", taskCreating: false, taskCreateAttempts: 1, taskCreateFailureReason: "C017 当前状态未知" }) : item) };
            commitData(addActivity(failed, blockedRead.outcome === "rejected" ? "C017 待办形成门硬失败拒绝" : "C017 待办形成门阻断", `${latestRequest.subjectName} · 人工确认保持有效`, failedAt, { requestId, reminderId: latestRequest.reminderId }));
            showToast("人工确认已保存，但待办形成前的安全状态不允许推进，已转决策运营恢复", "warning");
            resolve({ ok: true, outcome: "create_failed" });
            return;
          }
          const task = buildTaskFromDecision(latestRequest, form);
          const completedAt = formatNow();
          task.c017SafetyRead = taskRead;
          const next = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? appendC017Read(item, taskRead, { status: "confirmed", taskCreating: false, taskId: task.id }) : item), tasks: [task, ...latest.tasks] };
          commitData(addActivity(next, "负责人待办创建成功", `${latestRequest.subjectName} · ${form.owner} · ${DC_UI_VARIANT === "portfolio" ? "等待承接" : "待开始处理"}`, completedAt, { requestId, reminderId: latestRequest.reminderId, taskId: task.id }));
          showToast(`${latestRequest.subjectName}待办已创建，${DC_UI_VARIANT === "portfolio" ? "等待负责人确认承接" : "待负责人开始处理"}`, "success");
          navigate(`task/${task.id}`);
          resolve({ ok: true, outcome: "task_created" });
        }, 800);
      }, 600);
    }, 1200);
  }), [commitData, navigate, showToast]);

  const requestSupplement = useCallback((requestId, form) => new Promise((resolve) => {
    window.setTimeout(() => {
      const current = dataRef.current;
      const request = current.requests.find((item) => item.id === requestId);
      if (!request || !["awaiting", "blocked", "stale", "missing_evidence"].includes(request.status)) { resolve({ ok: false, message: `当前${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}状态已经变化，请重新打开后核对。` }); return; }
      const now = formatNow();
      const event = { type: "请求补充信息", time: now, reason: `${form.reason}；需要补充：${form.items.join("、")}` };
      const supplementRecord = { id: `INFO-${Date.now().toString().slice(-8)}`, status: "waiting_for_source", requestedAt: now, requestedBy: "财务运营账号", targetSource: SOURCE_META[request.sourceType].label, reason: form.reason, requestedItems: form.items, resolution: null, replacementRequestId: null };
      const next = { ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, status: "supplement_requested", supplement: { ...form, operator: "财务运营账号", time: now }, supplementRequests: [...(item.supplementRequests || []), supplementRecord], sourceEvents: [...item.sourceEvents, event], sourceReadStatus: "idle", sourceReadAttempts: 0 } : item) };
      commitData(addActivity(next, "请求补充信息", `${request.subjectName} · ${form.items.join("、")}`, now));
      showToast("补充请求已记录，等待上游形成新的行动申请", "success");
      resolve({ ok: true });
    }, 850);
  }), [commitData, showToast]);

  const refreshSupplement = useCallback((requestId) => {
    const current = dataRef.current;
    const request = current.requests.find((item) => item.id === requestId);
    if (!request || request.sourceReadStatus === "loading") return;
    commitData({ ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, sourceReadStatus: "loading" } : item) });
    window.setTimeout(() => {
      const latest = dataRef.current;
      const original = latest.requests.find((item) => item.id === requestId);
      if (!original) return;
      if ((original.sourceReadAttempts || 0) === 0) {
        commitData({ ...latest, requests: latest.requests.map((item) => item.id === requestId ? { ...item, sourceReadStatus: "failed", sourceReadAttempts: 1 } : item) });
        showToast("上游状态读取失败，补充请求和原证据已保留", "danger");
        return;
      }
      if (DC_UI_VARIANT !== "portfolio") {
        const stamp = Date.now().toString().slice(-8);
        const now = formatNow();
        const replacementId = `AR-${stamp}`;
        const reminderId = `DR-${stamp}`;
        const replacement = {
          ...JSON.parse(JSON.stringify(original)),
          id: replacementId,
          reminderId,
          requestTime: now,
          generatedTime: now,
          sourceRef: `${original.sourceRef} · 补充结果`,
          status: "awaiting",
          evidence: { ...original.evidence, dataVersion: `${original.evidence.dataVersion}-N${stamp.slice(-2)}`, cutoff: `${now.slice(0, 10)} 23:59`, freshness: "当前可信", snapshotId: `MS-${stamp}` },
          duplicateRequests: [],
          sourceEvents: [{ type: "替代请求", time: now, reason: `回应 ${original.id} 的补充信息请求`, replacementOf: original.id }],
          decision: null,
          supplement: null,
          sourceReadStatus: "idle",
          sourceReadAttempts: 0,
          replacementOf: original.id,
          taskId: null,
        };
        const next = { ...latest, requests: [replacement, ...latest.requests.map((item) => item.id === requestId ? { ...item, status: "replaced", sourceReadStatus: "idle", sourceEvents: [...item.sourceEvents, { type: "已被替代", time: now, reason: "上游已返回补充后的固定证据", replacementId }] } : item)] };
        commitData(addActivity(next, "收到替代行动申请", `${original.subjectName} · ${replacementId}`, now));
        showToast("已收到替代行动申请，可继续人工判断", "success");
        navigate(`reminder/${reminderId}`);
        return;
      }
      commitData({ ...latest, requests: latest.requests.map((item) => item.id === requestId ? { ...item, sourceReadStatus: "idle", sourceReadAttempts: (item.sourceReadAttempts || 0) + 1 } : item) });
      showToast(`尚未收到新的行动申请，原${DC_UI_VARIANT === "portfolio" ? "决策事项" : "提醒"}和补充请求继续保留`, "info");
    }, 900);
  }, [commitData, navigate, showToast]);

  const retryCreateTask = useCallback((requestId) => new Promise((resolve) => {
    const current = dataRef.current;
    const existing = current.requests.find((item) => item.id === requestId);
    if (!existing || existing.taskCreating) { resolve({ ok: false }); return; }
    if (existing.taskId && current.tasks.some((item) => item.id === existing.taskId)) {
      showToast("负责人待办已存在，已打开现有记录", "info");
      navigate(`task/${existing.taskId}`);
      resolve({ ok: true, outcome: "existing" });
      return;
    }
    commitData({ ...current, requests: current.requests.map((item) => item.id === requestId ? { ...item, taskCreating: true } : item) });
    showToast("正在根据已保存的人工确认重试创建待办", "info");
    window.setTimeout(() => {
      const latest = dataRef.current;
      const request = latest.requests.find((item) => item.id === requestId);
      const read = readC017SafetyProjection(request, "task_formation");
      if (read.outcome !== "allowed") {
        const failed = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? appendC017Read(item, read, { status: "create_failed", taskCreating: false, taskCreateFailureReason: "C017 权威读取失败" }) : item) };
        commitData(addActivity(failed, read.outcome === "rejected" ? "C017 待办形成门硬失败拒绝" : "C017 待办形成门仍阻断", `${request.subjectName} · 人工确认保持有效`, read.readAt, { requestId, reminderId: request.reminderId }));
        showToast("安全状态仍不允许推进，人工确认已保留，未创建待办", "danger");
        resolve({ ok: false, outcome: read.outcome });
        return;
      }
      const form = { owner: request.decision.owner, dueDate: request.decision.dueDate, instructions: request.decision.instructions, banks: request.decision.banks, reason: request.decision.reason };
      const task = buildTaskFromDecision(request, form);
      task.c017SafetyRead = read;
      const next = { ...latest, requests: latest.requests.map((item) => item.id === requestId ? appendC017Read(item, read, { status: "confirmed", taskCreating: false, taskId: task.id, taskCreateAttempts: (item.taskCreateAttempts || 0) + 1, taskCreateFailureReason: null }) : item), tasks: [task, ...latest.tasks] };
      commitData(addActivity(next, "重试创建待办成功", `${request.subjectName} · ${task.id}`, formatNow(), { requestId, reminderId: request.reminderId, taskId: task.id }));
      showToast("待办创建成功，原人工确认保持不变", "success");
      navigate(`task/${task.id}`);
      resolve({ ok: true, outcome: "task_created" });
    }, 1100);
  }), [commitData, navigate, showToast]);

  const runTaskAction = useCallback((taskId, type, payload) => new Promise((resolve) => {
    window.setTimeout(() => {
      const current = dataRef.current;
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) { resolve({ ok: false, message: "待办已无法访问，请返回目录重新核对。" }); return; }
      const allowedStatuses = {
        accept: ["assigned"], start: ["pending"], retry: ["execution_failed"],
        progress: ["in_progress"], complete: ["in_progress"], fail: ["in_progress"],
        cancel: ["assigned", "pending", "in_progress", "execution_failed"],
        edit: ["assigned", "pending", "in_progress", "execution_failed"],
        source_continue: ["assigned", "pending", "in_progress", "execution_failed", "completed"],
        correct: ["completed", "cancelled"],
      };
      if (allowedStatuses[type] && !allowedStatuses[type].includes(task.status)) {
        resolve({ ok: false, message: "待办状态已经变化，本次重复操作未执行。" });
        return;
      }
      if (type === "complete" && task.subjectId === "UNIT-465" && (task.updateAttempts || 0) === 0) {
        commitData({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? { ...item, updateAttempts: 1 } : item) });
        resolve({ ok: false, message: "保存结果时连接中断，系统核对后确认待办仍保持处理中。" });
        return;
      }
      const now = formatNow();
      let label = "更新待办"; let detail = "";
      const updated = { ...task, history: [...task.history] };
      if (type === "accept") { updated.status = "pending"; label = "确认承接"; detail = `${task.owner}已确认承接，等待开始处理`; }
      if (type === "start") { updated.status = "in_progress"; label = "开始处理"; detail = `${task.owner}开始处理`; }
      if (type === "retry") { updated.status = "in_progress"; label = "重试执行"; detail = task.failure?.nextStep || "按恢复建议重新开始"; }
      if (type === "progress") { updated.progress = [...task.progress, { time: now, author: task.owner, content: payload.result }]; label = "记录进展"; detail = payload.result; }
      if (type === "complete") { updated.status = "completed"; updated.overdue = false; updated.result = { summary: payload.result, bank: payload.bank, time: now }; label = "完成待办"; detail = payload.result; }
      if (type === "fail") { updated.status = "execution_failed"; updated.failure = { reason: payload.reason, nextStep: payload.nextStep, time: now }; label = "执行失败"; detail = `${payload.reason} · ${payload.nextStep}`; }
      if (type === "cancel") { updated.status = "cancelled"; updated.overdue = false; label = "取消待办"; detail = payload.reason; }
      if (type === "edit") { const old = `${task.owner} / ${task.dueDate} / ${task.instructions}`; updated.owner = payload.owner; updated.dueDate = payload.dueDate; updated.instructions = payload.instructions; updated.overdue = payload.dueDate < dateOnly(new Date()); label = "修改执行安排"; detail = `${old} → ${payload.owner} / ${payload.dueDate} / ${payload.instructions}；原因：${payload.reason}`; }
      if (type === "source_continue") { updated.sourceChanged = false; label = "确认继续执行"; detail = payload.reason; }
      if (type === "correct") { updated.status = "correcting"; label = "发起纠正"; detail = payload.reason; updated.correction = { reason: payload.reason, result: payload.result, time: now, pending: true }; }
      updated.history.push({ time: now, label, detail });
      const next = { ...current, tasks: current.tasks.map((item) => item.id === taskId ? updated : item) };
      commitData(addActivity(next, label, `${task.subjectName} · ${detail}`, now));
      const messages = { accept: "已确认承接，可开始处理", start: "待办已进入处理中", retry: "已按恢复建议重新进入处理中", progress: "处理进展已保存", complete: "完成结果已保存", fail: "执行失败已记录，可重试或取消", cancel: "待办已取消，原记录继续保留", edit: "执行安排已更新并保留原值", source_continue: "继续执行理由已记录", correct: "正在形成纠正记录" };
      showToast(messages[type] || "待办已更新", ["fail", "cancel"].includes(type) ? "warning" : "success");
      if (type === "correct") window.setTimeout(() => {
        const latest = dataRef.current;
        const corrected = { ...latest, tasks: latest.tasks.map((item) => item.id === taskId ? { ...item, status: "corrected", correction: { ...item.correction, pending: false, time: formatNow() }, history: [...item.history, { time: formatNow(), label: "完成纠正", detail: item.correction.result }] } : item) };
        commitData(corrected);
        showToast("纠正记录已完成，新旧结果均已保留", "success");
      }, 1200);
      resolve({ ok: true });
    }, ["accept", "start", "retry"].includes(type) ? 650 : 900);
  }), [commitData, showToast]);

  const refreshSource = useCallback((taskId) => new Promise((resolve) => {
    window.setTimeout(() => {
      const current = dataRef.current;
      let changed = false;
      const next = { ...current, tasks: current.tasks.map((item) => {
        if (item.id !== taskId) return item;
        if (DC_UI_VARIANT !== "portfolio" && item.subjectId === "UNIT-561" && !item.sourceChanged) {
          changed = true;
          return { ...item, sourceChanged: true, sourceChangeEvent: { time: formatNow(), type: "证据纠正", detail: "上游已形成新的固定证据：短期余额范围减少 1 笔，建议银行顺序发生变化。" }, history: [...item.history, { time: formatNow(), label: "收到上游证据纠正", detail: "原待办不自动取消，等待人工选择" }] };
        }
        const request = current.requests.find((candidate) => candidate.id === item.requestId);
        const receivedEvent = (request?.sourceEvents || []).find((event) => event.time > item.createdAt && ["证据纠正", "已被替代", "来源撤回", "替代请求"].includes(event.type));
        if (receivedEvent && !item.sourceChanged) {
          changed = true;
          return { ...item, sourceChanged: true, sourceChangeEvent: { time: receivedEvent.time, type: receivedEvent.type, detail: receivedEvent.reason }, history: [...item.history, { time: formatNow(), label: "读取到上游证据变化", detail: "原待办不自动取消，等待人工选择" }] };
        }
        return item;
      }) };
      commitData(next);
      showToast(changed ? "已读取到上游证据变化，请选择继续、取消或纠正" : "来源状态已重新读取，当前没有新的变化", changed ? "warning" : "success");
      resolve();
    }, 850);
  }), [commitData, showToast]);

  const resetState = useCallback(() => {
    const current = dataRef.current;
    const archived = [...(current.auditHistory || [])];
    if (current.requests.length || current.tasks.length || current.activity.length || (current.receipts || []).length) archived.push({
      archivedAt: formatNow(),
      reason: "定向重置形成新工作投影，原轮次记录保留为历史审计",
      scenarioContext: current.scenarioContext,
      counts: {
        requests: current.requests.length,
        reminders: current.requests.filter((item) => item.reminderId).length,
        confirmations: current.requests.filter((item) => item.decision).length,
        tasks: current.tasks.length,
        activity: current.activity.length,
      },
      records: { requests: current.requests, tasks: current.tasks, receipts: current.receipts || [], activity: current.activity },
    });
    const oldContext = current.scenarioContext || {};
    const initial = createInitialDecisionState({
      ...oldContext,
      scenarioRunId: `${oldContext.scenarioId || "SCENE"}-RUN-${Date.now().toString(36).toUpperCase()}`,
      formedAt: formatNow(),
      status: scenarioContextReady(oldContext) ? "active" : "unknown",
      source: "决策中心定向重置结果，等待平台公共层原样接收",
    }, archived);
    initial.resetAt = formatNow();
    const resetUrl = new URL(window.location.href);
    resetUrl.searchParams.set("scenarioId", initial.scenarioContext.scenarioId || "");
    resetUrl.searchParams.set("scenarioVersion", initial.scenarioContext.scenarioVersion || "");
    resetUrl.searchParams.set("scenarioRunId", initial.scenarioContext.scenarioRunId || "");
    resetUrl.searchParams.set("scenarioStatus", initial.scenarioContext.status || "unknown");
    window.history.replaceState({ ...(window.history.state || {}), dcResetRun: initial.scenarioContext.scenarioRunId }, "", `${resetUrl.pathname}${resetUrl.search}#workbench`);
    window.sessionStorage.removeItem(DC_VIEW_STORAGE_KEY);
    scrollPositionsRef.current = {};
    scrollActivityRef.current = { route: "", at: 0 };
    commitData(initial);
    setResetKey((value) => value + 1);
    navigate("workbench", {}, true);
    showToast("当前轮次工作投影已归零，历史审计证据仍保留", "success");
  }, [commitData, navigate, showToast]);

  const renderScreen = () => {
    const [root, second, third] = route.parts;
    if (root === "overview") return <OperationsOverviewScreen data={data} onNavigate={navigate} updateAISummary={updateAISummary} />;
    if (root === "operations" && second === "intake" && DC_UI_VARIANT === "portfolio") return <PortfolioActionIntakeScreen data={data} onNavigate={navigate} receiveActionRequests={receiveActionRequests} />;
    if (root === "operations" && second === "requests" && DC_UI_VARIANT === "portfolio") return <PortfolioRequestDirectoryScreen data={data} onNavigate={navigate} />;
    if (root === "operations" && second === "assignment-recovery" && DC_UI_VARIANT === "portfolio") return <PortfolioAssignmentRecoveryScreen request={data.requests.find((item) => item.id === third)} onNavigate={navigate} retryCreateTask={retryCreateTask} />;
    if (root === "tasks") return <TaskWorkspaceScreen data={data} onNavigate={navigate} />;
    if (root === "request") return <RequestDetailScreen request={expandDecisionRequests(data.requests).find((item) => item.id === second)} data={data} onNavigate={navigate} retryCreateTask={retryCreateTask} retryC017Receipt={retryC017Receipt} />;
    if (root === "reminder") return <ReminderDetailScreen request={data.requests.find((item) => item.reminderId === second)} data={data} onNavigate={navigate} submitDecision={submitDecision} retryCreateTask={retryCreateTask} requestSupplement={requestSupplement} refreshSupplement={refreshSupplement} />;
    if (root === "task") { const task = data.tasks.find((item) => item.id === second); return <TaskDetailScreen task={task} request={data.requests.find((item) => item.id === task?.requestId)} onNavigate={navigate} runTaskAction={runTaskAction} refreshSource={refreshSource} />; }
    if (root === "trace") return <TraceScreen kind={second} id={third} data={data} onNavigate={navigate} />;
    return <WorkbenchScreen data={data} onNavigate={navigate} submitDecision={submitDecision} updateAISummary={updateAISummary} />;
  };

  return (
    <div className={`decision-app variant-${DC_UI_VARIANT}`}>
      <DecisionRail onReset={() => setResetOpen(true)} onNavigate={navigate} />
      <DecisionProductNav route={route} onNavigate={navigate} />
      <main className="app-workspace"><DecisionTopbar route={route} data={data} /><div className="screen-stage" id="screen-stage">{booting ? <div className="page-shell"><DCLoadingBlock title="正在读取决策运行记录" description={DC_UI_VARIANT === "portfolio" ? "加载决策事项、负责人待办和固定证据。" : "加载提醒、负责人待办和固定证据。"} /></div> : <React.Fragment key={resetKey}>{renderScreen()}</React.Fragment>}</div></main>
      <ResetModal open={resetOpen} onClose={() => setResetOpen(false)} onReset={resetState} />
      <DCToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<DecisionApp />);
