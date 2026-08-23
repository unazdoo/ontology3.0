import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../..");
const snapshotPath = path.join(workspace, "runtime-snapshots/S001-RUN-20260816081748567-705ac89fb83a.runtime.json");
const outputPath = path.join(here, "shared/portfolio-integration.js");
const sourceStorageKey = "ontology3-decision-center-review-v2-portfolio-state-v6";
const storageKey = "ontology3-decision-center-review-v2-portfolio-state-v8";

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const source = JSON.parse(snapshot.localStorage[sourceStorageKey]);
const s001C017 = JSON.parse(snapshot.localStorage["ontology3.c017.decision-center.projection.v1"] || "null");
const requestIds = new Set([
  "AR-RUN-MSVJWKPO-002-UNIT-553",
  "AR-RUN-MSVJWKPO-002-UNIT-465",
  "AR-RUN-MSVJWKPO-002-UNIT-561",
]);
const requests = source.requests.filter((item) => requestIds.has(item.id));
const taskIds = new Set(requests.map((item) => item.taskId).filter(Boolean));
const tasks = source.tasks.filter((item) => taskIds.has(item.id));

const s001Seed = {
  ...source,
  requests,
  tasks,
  activity: source.activity.filter((item) => requests.some((request) => item.detail?.includes(request.subjectName))).slice(0, 8),
};

const output = `(function () {
  "use strict";

  const STORAGE_KEY = ${JSON.stringify(storageKey)};
  const INTEGRATION_VERSION = "ofw.decision.portfolio.v3";
  const PORTFOLIO_CONTEXT = Object.freeze({
    scenarioId: "PORTFOLIO",
    scenarioVersion: "v1.1.0-rc.3",
    scenarioRunId: "PORTFOLIO-RUN-CURRENT",
    formedAt: "2026-08-22T00:00:00.000Z",
    status: "active",
    source: "四场景组合资源注册表"
  });
  const S001_SEED = ${JSON.stringify(s001Seed)};
  const S001_C017 = ${JSON.stringify(s001C017)};

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const stampRecord = (record, scenarioId) => ({
    ...clone(record),
    scenarioId,
    scenarioLabel: window.OFW_COMPOSITE_REGISTRY?.scene?.(scenarioId)?.name || scenarioId,
  });

  const sameScenario = (left, right) => Boolean(
    left && right &&
    left.scenarioId === right.scenarioId &&
    left.scenarioVersion === right.scenarioVersion &&
    left.scenarioRunId === right.scenarioRunId
  );

  function normalizedDataVersion(value, scenarioId) {
    const aliases = window.OFW_COMPOSITE_REGISTRY?.dataEngineering?.[scenarioId]?.sourceVersionAliases || {};
    return aliases[value] || value;
  }

  function c017ReadForRequest(request, c017) {
    const requestVersion = normalizedDataVersion(request?.evidence?.dataVersion, request?.scenarioContext?.scenarioId);
    const projection = (c017?.projections || []).find((item) => sameScenario(item?.scenarioContext, request?.scenarioContext) && normalizedDataVersion(item?.dataVersion, request?.scenarioContext?.scenarioId) === requestVersion);
    const gate = projection?.gates?.request_receipt;
    const summary = gate?.currentStateSummary;
    const allowed = gate?.qualityStatus === "允许推进" && gate?.hardQualityFailure !== true && Boolean(summary?.id && summary?.version && summary?.formedAt);
    return {
      gate: "request_receipt",
      gateLabel: "行动申请接收前",
      t007: request?.evidence?.dataVersion || "未定位",
      sourceT007: projection?.dataVersion || "未定位",
      versionAliasApplied: Boolean(projection?.dataVersion && projection.dataVersion !== request?.evidence?.dataVersion),
      summaryId: summary?.id || "未定位",
      summaryVersion: summary?.version || "未定位",
      summaryFormedAt: summary?.formedAt || "未定位",
      readAt: new Date().toISOString(),
      qualityStatus: allowed ? "允许推进" : gate?.hardQualityFailure === true ? "事后硬质量失败" : "状态未知",
      hardFailure: gate?.hardQualityFailure === true ? "是" : allowed ? "否" : "未能确认",
      detectedAt: gate?.detectedAt || "不适用",
      impactScope: gate?.impactScope || "当前无法判定",
      businessFieldCategories: gate?.businessFieldCategories || "当前无法判定",
      reason: allowed ? gate.reason : gate?.reason || "未能读取与行动申请精确数据版本一致的 C017 当前摘要",
      recovery: allowed ? "无需恢复" : gate?.recovery || "重新读取同一精确数据版本的 C017 当前摘要",
      evidenceLocator: gate?.evidenceLocator || "未定位",
      outcome: allowed ? "allowed" : gate?.hardQualityFailure === true ? "rejected" : "blocked"
    };
  }

  function normalizeDynamicS003Request(request, context, c017) {
    const requestContext = request?.scenarioContext || request?.scenarioIdentity;
    if (request?.schemaVersion !== "ofw.s003.c011.action-request.v2" || !request?.id || !sameScenario(requestContext, context) || request?.sourceType !== "report" || request?.clientWorkspaceVersion !== "ofw.dashboard.workspace.v7") return null;
    if (!request?.subjectId || !request?.subjectName || !request?.actionType?.id || !request?.actionType?.version || request?.actionType?.status !== "已发布") return null;
    if (!request?.evidence?.snapshotId || !request?.evidence?.dataVersion || !request?.evidence?.semanticVersion || !request?.evidence?.cutoff) return null;
    if (!request?.decisionRecipient?.memberUnitId || !request?.decisionRecipient?.recipientId || !request?.decisionRecipient?.recipientName || request?.decisionRecipient?.role !== "成员单位债务风险接口人") return null;
    const read = c017ReadForRequest(request, c017);
    const accepted = read.outcome === "allowed";
    const now = read.readAt.replace("T", " ").replace(/[.][0-9]{3}Z$/, "");
    return {
      ...clone(request),
      id: request.id,
      requestId: request.requestId || request.id,
      scenarioContext: clone(context),
      scenarioIdentity: clone(context),
      scenarioId: "S003",
      status: accepted ? "awaiting" : "c017_blocked",
      reminderId: accepted ? request.reminderId || ("DR-" + String(request.id).replace(/^AR-/, "")) : null,
      traceId: request.traceId || ("TR-" + String(request.id).replace(/^AR-/, "")),
      requestGate: { status: accepted ? "accepted" : read.outcome === "rejected" ? "rejected" : "blocked", checkedAt: now, reason: read.reason, reminderCreated: accepted },
      formation: { requestGateStatus: accepted ? "accepted" : read.outcome, requestGateCheckedAt: now, requestGateReason: read.reason, reminderCreated: accepted, confirmationGateStatus: "not_reached", confirmationGateReason: accepted ? ("等待" + request.decisionRecipient.recipientName + "人工确认并选择实际负责人") : "行动申请接收门尚未通过" },
      confirmationEligibility: { allowed: accepted, requiresAcknowledgement: false, reason: accepted ? ("已送达" + request.decisionRecipient.recipientName + "，待人工确认后分办") : read.reason },
      c017SafetyReads: [...(request.c017SafetyReads || []), read],
      c017ReadAttempts: { ...(request.c017ReadAttempts || {}), request_receipt: Number(request.c017ReadAttempts?.request_receipt || 0) + 1, confirmation_submit: Number(request.c017ReadAttempts?.confirmation_submit || 0), task_formation: Number(request.c017ReadAttempts?.task_formation || 0) },
      duplicateRequests: Array.isArray(request.duplicateRequests) ? request.duplicateRequests : [],
      supplementRequests: Array.isArray(request.supplementRequests) ? request.supplementRequests : [],
      sourceEvents: Array.isArray(request.sourceEvents) ? request.sourceEvents : [],
      taskId: null,
      taskCreating: false,
      decision: null,
      automatic: false,
      actionRequestImmutable: false,
      projectionOnly: false,
      contractFingerprint: request.contractFingerprint || ("c011-dashboard:" + (request.idempotencyKey || request.id))
    };
  }

  function dynamicS003Requests(context) {
    if (!window.S003DecisionAdapter?.readContractRecord) return [];
    const key = "ofw:v1.1.0:" + context.scenarioId + ":" + context.scenarioVersion + ":" + context.scenarioRunId + ":m04:" + encodeURIComponent("decision-center.c011.inbox.v3");
    let envelope = null;
    try { envelope = JSON.parse(window.localStorage.getItem(key) || "null"); } catch (_) {}
    const inbox = envelope?.payload || null;
    const c017 = window.S003DecisionAdapter.readContractRecord(context, "c017", window.localStorage);
    if (inbox?.schemaVersion !== "ofw.s003.c011.dashboard-inbox.v2" || inbox?.contractCode !== "C011" || !sameScenario(inbox?.scenarioContext, context)) return [];
    return (inbox.requests || []).map((request) => normalizeDynamicS003Request(request, context, c017)).filter(Boolean);
  }

  function emptyS003State() {
    return {
      schemaVersion: 6,
      stateModelVersion: 2,
      variant: "portfolio",
      stateRevision: 1,
      scenarioContext: {
        scenarioId: "S003",
        scenarioVersion: "S003-v1",
        scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
        formedAt: "2026-08-17T16:30:00.000Z",
        status: "active",
        source: "S003 CP38"
      },
      requests: [], tasks: [], receipts: [], auditHistory: [], activity: [],
      aiSummaries: clone(S001_SEED.aiSummaries || {}),
      pageStates: clone(S001_SEED.pageStates || {})
    };
  }

  function installContext(context, portfolio = false) {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    params.set("scenarioId", context.scenarioId);
    params.set("scenarioVersion", context.scenarioVersion);
    params.set("scenarioRunId", context.scenarioRunId);
    params.set("formedAt", context.formedAt);
    params.set("scenarioStatus", context.status);
    window.history.replaceState({ ...(window.history.state || {}), ofwDecisionPortfolio: portfolio }, "", url);
  }

  async function bootstrap() {
    let s003 = emptyS003State();
    if (window.S003DecisionAdapter?.hydrateNativeState) {
      installContext(s003.scenarioContext, false);
      s003 = await window.S003DecisionAdapter.hydrateNativeState(s003);
    }
    s003.requests = (s003.requests || []).filter((item) => item?.subjectId !== "S003-ENT-019");
    const dynamicRequests = dynamicS003Requests(s003.scenarioContext);
    const s003Requests = new Map((s003.requests || []).map((item) => [item.id, item]));
    dynamicRequests.forEach((item) => { if (!s003Requests.has(item.id)) s003Requests.set(item.id, item); });
    s003 = {
      ...s003,
      requests: [...s003Requests.values()],
      activity: [
        ...dynamicRequests.filter((item) => !(s003.requests || []).some((existing) => existing.id === item.id)).map((item) => ({ time: item.requestTime || item.generatedTime, label: item.requestGate?.status === "accepted" ? "驾驶舱行动申请已接收" : "驾驶舱行动申请接收阻断", detail: item.subjectName + " · " + item.id, scenarioContext: clone(s003.scenarioContext), requestId: item.id, reminderId: item.reminderId || null, traceId: item.traceId || null })),
        ...(s003.activity || [])
      ]
    };
    installContext(PORTFOLIO_CONTEXT, true);
    if (S001_C017) window.localStorage.setItem("ontology3.c017.decision-center.projection.v1", JSON.stringify(S001_C017));
    let existing = null;
    try { existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null"); } catch (_) {}
    const existingIsPortfolio = existing?.portfolioIntegrationVersion === INTEGRATION_VERSION;
    const sourceStateRaw = existingIsPortfolio ? existing : S001_SEED;
    const dynamicRequestIds = new Set(dynamicRequests.map((item) => item.id));
    const sourceState = {
      ...sourceStateRaw,
      requests: (sourceStateRaw.requests || []).filter((item) => item?.subjectId !== "S003-ENT-019" || (item?.clientWorkspaceVersion === "ofw.dashboard.workspace.v7" && dynamicRequestIds.has(item.id)))
    };
    const requestsById = new Map([
      ...s003.requests.map((item) => [item.id, stampRecord(item, "S003")]),
      ...sourceState.requests.map((item) => [item.id, stampRecord(item, item.scenarioContext?.scenarioId || item.scenarioId || "S001")]),
    ]);
    const tasksById = new Map([
      ...s003.tasks.map((item) => [item.id, stampRecord(item, "S003")]),
      ...sourceState.tasks.map((item) => [item.id, stampRecord(item, item.scenarioContext?.scenarioId || item.scenarioId || "S001")]),
    ]);
    const state = {
      ...clone(sourceState),
      schemaVersion: 6,
      stateModelVersion: 2,
      variant: "portfolio",
      portfolioIntegrationVersion: INTEGRATION_VERSION,
      stateRevision: Number(sourceState.stateRevision || 0) + 1,
      scenarioContext: clone(PORTFOLIO_CONTEXT),
      requests: [...requestsById.values()],
      tasks: [...tasksById.values()],
      receipts: [...(sourceState.receipts || [])],
      activity: [
        ...(s003.activity || []).map((item) => stampRecord(item, "S003")),
        ...(sourceState.activity || []).map((item) => stampRecord(item, item.scenarioContext?.scenarioId || item.scenarioId || "S001")),
      ].slice(0, 24),
      portfolioBoundaries: {
        S001: "3 条 Action Request；1 条已确认并形成负责人待办",
        S002: "当前授权范围 0 条 Action Request / 0 条待办",
        S003: "CP38 既有 4 条 Action Request；1 条已确认并形成负责人待办",
        S004: "报告内人工复核，不进入通用行动队列"
      }
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return clone(state);
  }

  window.OFW_DECISION_PORTFOLIO = Object.freeze({
    version: INTEGRATION_VERSION,
    context: PORTFOLIO_CONTEXT,
    storageKey: STORAGE_KEY,
    bootstrap,
    scenarioIdFor: (record) => record?.scenarioId || record?.scenarioContext?.scenarioId || record?.scenarioIdentity?.scenarioId || "UNKNOWN",
    scenes: () => (window.OFW_COMPOSITE_REGISTRY?.scenes || []).map((item) => ({ value: item.scenarioId, label: item.scenarioId + " · " + item.name }))
  });
})();
`;

fs.writeFileSync(outputPath, output);
console.log(`wrote ${path.relative(process.cwd(), outputPath)}`);
