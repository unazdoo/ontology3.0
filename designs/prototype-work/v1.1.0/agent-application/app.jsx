const { useEffect, useMemo, useRef, useState } = React;
const {
  Icon,
  Button,
  StatusBadge,
  Modal,
  Drawer,
  PageHeader,
  EmptyState,
  KeyValueList,
  Tabs,
  Notice,
  ToastStack,
  AppShell,
  CredibilitySummary,
  HistoryDimensions,
  VersionIdentityGrid,
  AgentUseGate
} = window;

function deepClone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function nowText() {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(new Date()).replaceAll("/", "-");
}

function displayBusinessTerm(value) {
  if (typeof value !== "string") return value;
  return value
    .replaceAll("Generation Evidence Package v1", "固定证据输入 v1")
    .replaceAll("Report Context Binding v1", "报告固定上下文 v1")
    .replaceAll("Report Generation Request v1", "报告生成请求 v1")
    .replaceAll("Report Reading Request v1", "报告伴读请求 v1")
    .replaceAll("Report Copilot Answer v1", "报告伴读结果 v1")
    .replaceAll("Report Copilot Result v1", "报告伴读结果 v1")
    .replaceAll("Report Verification Request v1", "报告自动核验请求 v1")
    .replaceAll("Report Verification Extraction v1", "报告核验抽取结果 v1")
    .replaceAll("Report Verification Extraction", "报告核验抽取结果")
    .replaceAll("Agent Report Draft v1", "报告源草稿 v1")
    .replaceAll("Budget Evidence Package v1", "预算固定证据 v1")
    .replaceAll("Budget Report Evidence v1", "预算报告证据 v1")
    .replaceAll("AI Insight v1", "结构化洞察 v1")
    .replaceAll("Release", "版本")
    .replaceAll("C017", "数据可信度摘要")
    .replaceAll("C022", "报告生成请求")
    .replaceAll("C023", "报告草稿交接")
    .replaceAll("C024", "报告伴读请求")
    .replaceAll("C025", "报告伴读结果")
    .replaceAll("Action Request", "行动申请")
    .replaceAll("Action 请求", "行动申请")
    .replaceAll("行动请求", "行动申请")
    .replaceAll("Published", "已发布")
    .replaceAll("Draft", "草稿")
    .replaceAll("Owner", "责任人")
    .replaceAll("Action Type", "行动类型")
    .replaceAll("Metric", "指标")
    .replaceAll("Rule", "规则")
    .replaceAll("执行 Action", "执行行动")
    .replaceAll("确认 Action", "确认行动")
    .replaceAll("行动 或", "行动或")
    .replace(/([\u3400-\u9fff])\s+(已发布|草稿|责任人)/g, "$1$2")
    .replace(/(已发布|草稿|责任人)\s+([\u3400-\u9fff])/g, "$1$2");
}

function compactDate() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

const C022_INBOX_KEY = "ontology3.agent-application.c022-inbox.v1";
const C023_OUTBOX_KEY = "ontology3.agent-application.c023-outbox.v1";
const C024_INBOX_KEY = "ontology3.agent-application.c024-inbox.v1";
const REPORT_OWNER_RECORD_KEY = "ontology3.agent-application.owner-records.v1";
const PLATFORM_SCENARIO_CONTEXT_KEY = "ontology3.platform.scenario-runtime.v1";
const C033_HANDOFF_CONTEXT_KEY = "ontology3.0-s001-handoff-v1:scenario-context";
const C011_INBOX_KEY = "ontology3.decision-center.c011.inbox.v1";
const C019_PROJECTION_KEY = "ontology3.decision-center.c019.projection.v1";
const LEGACY_AGENT_STORAGE_KEYS = [
  "ontology3.agent-application.catalog.v7",
  "ontology3.agent-application.catalog.v8"
];
const SCENARIO_CONTEXT_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
const ACTIVE_SCENARIO_STATUSES = new Set(["active", "ready", "available", "有效", "启用", "进行中", "已启用", "可用"]);

function currentProjection(item) {
  return item?.currentProjection !== false && item?.projectionStatus !== "history";
}

function reportRun(run) {
  return ["report-copilot", "report-verification-agent", "report-draft"].includes(run?.snapshot?.agentId) || Boolean(run?.sessionId);
}

function reportEvidence(evidence) {
  return ["report", "report-verification", "report-generation"].includes(evidence?.kind);
}

function normalizeStatus(value) {
  return String(value == null ? "" : value).trim().toLowerCase();
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function normalizeScenarioContext(source = {}) {
  const value = source?.scenarioContext || source?.context || source || {};
  return {
    scenarioId: value.scenarioId || null,
    scenarioVersion: value.scenarioVersion || null,
    scenarioRunId: value.scenarioRunId || null,
    formedAt: value.formedAt || value.contextFormedAt || value.scenarioFormedAt || null,
    status: value.status || value.contextStatus || value.scenarioStatus || null
  };
}

function scenarioContextReady(context) {
  const normalized = normalizeScenarioContext(context);
  return Boolean(
    SCENARIO_CONTEXT_FIELDS.every((field) => normalized[field])
    && ACTIVE_SCENARIO_STATUSES.has(normalizeStatus(normalized.status))
  );
}

function sameScenarioContext(left, right) {
  const normalizedLeft = normalizeScenarioContext(left);
  const normalizedRight = normalizeScenarioContext(right);
  return scenarioContextReady(normalizedLeft)
    && scenarioContextReady(normalizedRight)
    && SCENARIO_CONTEXT_FIELDS.every((field) => normalizedLeft[field] === normalizedRight[field]);
}

function readActiveScenarioContext() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = normalizeScenarioContext({
    scenarioId: params.get("scenarioId"),
    scenarioVersion: params.get("scenarioVersion"),
    scenarioRunId: params.get("scenarioRunId"),
    formedAt: params.get("formedAt") || params.get("scenarioFormedAt") || params.get("scenarioContextFormedAt"),
    status: params.get("status") || params.get("scenarioStatus") || params.get("contextStatus")
  });
  const handoff = normalizeScenarioContext(safeJson(localStorage.getItem(C033_HANDOFF_CONTEXT_KEY), {}));
  const platform = normalizeScenarioContext(safeJson(localStorage.getItem(PLATFORM_SCENARIO_CONTEXT_KEY), {}));
  let parentContext = null;
  try {
    parentContext = normalizeScenarioContext(window.parent !== window ? window.parent.S001_STORE?.getScenario?.() : {});
  } catch (_) {}
  return [fromUrl, handoff, platform, parentContext].find(scenarioContextReady) || fromUrl;
}

function scenarioIdentityContext(identity = {}) {
  return normalizeScenarioContext({
    scenarioId: identity.scenarioId,
    scenarioVersion: identity.scenarioVersion,
    scenarioRunId: identity.scenarioRunId,
    formedAt: identity.scenarioFormedAt,
    status: identity.scenarioStatus
  });
}

function stableHash(value) {
  let hash = 2166136261;
  const source = String(value || "");
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => {
    if (typeof value[key] !== "undefined") result[key] = canonicalValue(value[key]);
    return result;
  }, {});
  if (typeof value === "number" && !Number.isFinite(value)) return String(value);
  return typeof value === "undefined" ? null : value;
}

function c011PayloadFingerprint(payload) {
  return JSON.stringify(canonicalValue(payload));
}

function mergeC011Request(payload) {
  const context = normalizeScenarioContext(payload?.scenarioContext);
  if (!scenarioContextReady(context)) return { status: "invalid", reason: "行动申请缺少完整可用的 C033 场景运行上下文。" };
  const existingEnvelope = safeJson(localStorage.getItem(C011_INBOX_KEY), null);
  if (existingEnvelope && existingEnvelope.contractCode !== "C011") return { status: "invalid", reason: "决策中心待接收区存在非 C011 内容，未覆盖原记录。" };
  const envelopeContext = normalizeScenarioContext(existingEnvelope?.scenarioContext || {});
  if (existingEnvelope && scenarioContextReady(envelopeContext) && !sameScenarioContext(envelopeContext, context)) {
    return { status: "context_mismatch", reason: "决策中心待接收区属于其他场景轮次，未覆盖或迁移原请求。" };
  }
  const requests = Array.isArray(existingEnvelope?.requests) ? existingEnvelope.requests : [];
  const existing = requests.find((item) => (item?.id || item?.requestId) === payload.id);
  if (existing) {
    return c011PayloadFingerprint(existing) === c011PayloadFingerprint(payload)
      ? { status: "duplicate", request: existing }
      : { status: "conflict", reason: "同一行动申请稳定标识已对应不同载荷，原请求保持不变。" };
  }
  const envelope = {
    ...(existingEnvelope || {}),
    contractCode: "C011",
    schemaVersion: Math.max(Number(existingEnvelope?.schemaVersion) || 0, 1),
    owner: existingEnvelope?.owner || "决策中心",
    providers: [...new Set([...(existingEnvelope?.providers || []), "Agent 应用"])],
    scenarioContext: context,
    formedAt: existingEnvelope?.formedAt || nowText(),
    updatedAt: nowText(),
    requests: [...requests, payload]
  };
  try {
    localStorage.setItem(C011_INBOX_KEY, JSON.stringify(envelope));
    window.dispatchEvent(new CustomEvent("ontology3:decision-center:c011-updated", { detail: { requestId: payload.id, scenarioContext: context } }));
    return { status: "submitted", request: payload };
  } catch (error) {
    return { status: "write_failed", reason: "行动申请未能写入决策中心待接收区，请释放浏览器存储空间后重试。" };
  }
}

function readC019Receipt(requestId, scenarioContext) {
  const projection = safeJson(localStorage.getItem(C019_PROJECTION_KEY), null);
  if (!projection) return { status: "waiting", reason: "决策中心尚未形成接收回执。" };
  if (projection.contractCode !== "C019") return { status: "invalid", reason: "当前决策投影不是 C019，只读回执未采用。" };
  if (!sameScenarioContext(projection.scenarioContext, scenarioContext)) return { status: "context_mismatch", reason: "C019 属于其他场景轮次，未用于当前行动申请。" };
  const record = (projection.records || []).find((item) => {
    const reference = item?.requestRef;
    return reference?.targetId === requestId || reference === requestId;
  });
  if (!record?.requestRef) return { status: "waiting", reason: "决策中心尚未接收该稳定行动申请。" };
  return {
    status: "received",
    receivedAt: projection.summaryAsOf || nowText(),
    requestRef: record.requestRef,
    reminderRef: record.reminderRef || null,
    taskRef: record.taskRef || null,
    traceRef: record.traceRef || null
  };
}

function readC022Candidates() {
  const direct = safeJson(localStorage.getItem(C022_INBOX_KEY), []);
  const items = Array.isArray(direct) ? direct : Array.isArray(direct?.requests) ? direct.requests : [];
  return items.filter((item) => item?.requestId && item.archived !== true)
    .sort((left, right) => String(left.submittedAt || "").localeCompare(String(right.submittedAt || "")));
}

function c022Identity(candidate = {}) {
  candidate = candidate || {};
  const context = candidate.reportContext || {};
  const scenario = context.scenarioContext || {};
  const evidence = context.evidencePack || {};
  const semantic = context.semanticBinding || candidate.semanticBinding || {};
  return {
    scenarioId: scenario.scenarioId || context.scenarioId || null,
    scenarioVersion: scenario.scenarioVersion || context.scenarioVersion || null,
    scenarioRunId: scenario.scenarioRunId || context.scenarioRunId || null,
    scenarioFormedAt: scenario.formedAt || context.scenarioFormedAt || null,
    scenarioStatus: scenario.status || context.scenarioStatus || null,
    requestId: candidate.requestId || context.reportRequestId || null,
    aggregateId: context.reportAggregateId || null,
    evidencePackageId: evidence.id || candidate.evidencePackId || null,
    evidencePackageVersion: evidence.version || null,
    semanticVersionId: semantic.semanticVersionId || null,
    semanticVersion: semantic.semanticVersion || null,
    dataAssetVersionId: semantic.dataAssetVersionId || null,
    dataVersion: semantic.dataVersion || null,
    consumableVersionId: semantic.consumableVersionId || null,
    dataAsOf: semantic.asOf || null,
    reportDefinitionId: context.reportDefinition?.id || candidate.reportDefinition?.id || null,
    reportDefinitionVersion: context.reportDefinition?.version || candidate.reportDefinition?.version || null,
    templateId: context.template?.id || candidate.template?.id || null,
    templateVersion: context.template?.version || candidate.template?.version || null,
    targetContentRevision: context.targetContentRevision || candidate.contentRevision || null
  };
}

function c022Fingerprint(candidate) {
  return JSON.stringify(c022Identity(candidate));
}

function compactC022ForStorage(candidate = {}) {
  const identity = c022Identity(candidate);
  const context = candidate.reportContext || {};
  return {
    requestId: identity.requestId,
    submittedAt: candidate.submittedAt || null,
    evidencePackId: identity.evidencePackageId,
    contentRevision: identity.targetContentRevision,
    reportDefinition: { id: identity.reportDefinitionId, version: identity.reportDefinitionVersion },
    template: { id: identity.templateId, version: identity.templateVersion },
    semanticBinding: {
      semanticVersionId: identity.semanticVersionId,
      semanticVersion: identity.semanticVersion,
      dataAssetVersionId: identity.dataAssetVersionId,
      dataVersion: identity.dataVersion,
      consumableVersionId: identity.consumableVersionId,
      asOf: identity.dataAsOf
    },
    reportContext: {
      scenarioContext: deepClone(context.scenarioContext || {
        scenarioId: identity.scenarioId,
        scenarioVersion: identity.scenarioVersion,
        scenarioRunId: identity.scenarioRunId,
        formedAt: identity.scenarioFormedAt,
        status: identity.scenarioStatus
      }),
      reportRequestId: identity.requestId,
      reportAggregateId: identity.aggregateId,
      targetContentRevision: identity.targetContentRevision,
      evidencePack: {
        id: identity.evidencePackageId,
        version: identity.evidencePackageVersion,
        fixedAt: context.evidencePack?.fixedAt || null
      },
      reportDefinition: { id: identity.reportDefinitionId, version: identity.reportDefinitionVersion },
      template: { id: identity.templateId, version: identity.templateVersion },
      semanticBinding: {
        semanticVersionId: identity.semanticVersionId,
        semanticVersion: identity.semanticVersion,
        dataAssetVersionId: identity.dataAssetVersionId,
        dataVersion: identity.dataVersion,
        consumableVersionId: identity.consumableVersionId,
        asOf: identity.dataAsOf
      }
    },
    persistedAsReference: true
  };
}

function resolveC022Reference(reference = {}) {
  const requestId = reference?.requestId || reference?.sourceRequestId || reference?.reportContext?.reportRequestId;
  if (!requestId) return reference;
  return readC022Candidates().find((candidate) => candidate.requestId === requestId) || reference;
}

function compactReportGenerationForStorage(generation = {}) {
  if (!generation) return generation;
  return {
    identity: deepClone(generation.identity || {}),
    reportDefinition: generation.reportDefinition ? { id: generation.reportDefinition.id, version: generation.reportDefinition.version } : null,
    template: generation.template ? { id: generation.template.id, version: generation.template.version } : null,
    contentRevision: generation.contentRevision || generation.identity?.targetContentRevision || null,
    c022RequestId: generation.c022RequestId || generation.identity?.requestId || null,
    reportEvidenceRef: generation.reportEvidenceRef || generation.identity?.evidencePackageId || null,
    persistedAsReference: true
  };
}

function hydrateReportGeneration(generation = {}, requestId = null) {
  if (!generation) return generation;
  if (generation.reportEvidence?.contentFacts?.length) return generation;
  const candidate = resolveC022Reference({ requestId: requestId || generation.c022RequestId || generation.identity?.requestId });
  if (!candidate?.reportEvidence) return generation;
  const context = candidate.reportContext || {};
  return {
    ...generation,
    identity: deepClone(generation.identity || c022Identity(candidate)),
    reportDefinition: deepClone(context.reportDefinition || candidate.reportDefinition || generation.reportDefinition),
    template: deepClone(context.template || candidate.template || generation.template),
    reportEvidence: deepClone(candidate.reportEvidence),
    contentRevision: generation.contentRevision || c022Identity(candidate).targetContentRevision,
    c022RequestId: candidate.requestId,
    reportEvidenceRef: c022Identity(candidate).evidencePackageId,
    persistedAsReference: false
  };
}

function compactReportDraftResultForStorage(result, keepTransferPayload) {
  if (!result || result.type !== "Agent Report Draft") return result;
  const sourceItems = Array.isArray(result.sourceItems) ? result.sourceItems : [];
  const contentFacts = Array.isArray(result.generatedContent?.contentFacts) ? result.generatedContent.contentFacts : [];
  if (!keepTransferPayload) {
    return {
      ...result,
      sourceItems: [],
      generatedContent: {
        contentRevision: result.generatedContent?.contentRevision || null,
        contentFacts: [],
        bindingGaps: deepClone(result.generatedContent?.bindingGaps || []),
        generatedNarratives: []
      },
      archivedPayload: {
        sourceItemCount: sourceItems.length,
        contentFactCount: contentFacts.length,
        acceptedBy: "报告中心评审副本",
        reason: "后续内容修订已形成；旧 C023 保留稳定标识、版本、摘要和审计关系。"
      }
    };
  }
  return {
    ...result,
    sourceItems: sourceItems.map((item) => ({
      sourceItemId: item.sourceItemId,
      parentId: item.parentId || null,
      contentItemId: item.contentItemId,
      anchorId: item.anchorId || null,
      templateSlot: item.templateSlot || null,
      contentType: item.contentType || item.presentationType || item.claimType || null,
      location: item.location || null,
      origin: item.origin || null,
      claimType: item.claimType || null,
      factRefs: deepClone(item.factRefs || []),
      intendedFactRefs: deepClone(item.intendedFactRefs || []),
      evidenceRefs: deepClone(item.evidenceRefs || []),
      bindingStatus: item.bindingStatus,
      requiresEvidence: item.requiresEvidence !== false,
      renderedValue: deepClone(item.renderedValue ?? item.value ?? null),
      displayValue: deepClone(item.displayValue ?? item.value ?? null),
      displayUnit: item.displayUnit ?? null,
      canonicalFactKey: item.canonicalFactKey || null,
      rendered: item.rendered !== false
    })),
    generatedContent: {
      contentRevision: result.generatedContent?.contentRevision || null,
      contentFacts: contentFacts.map((fact) => ({
        contentFactId: fact.contentFactId,
        sourceFactId: fact.sourceFactId,
        factId: fact.factId,
        intendedFactId: fact.intendedFactId,
        value: deepClone(fact.value),
        authoritativeValue: deepClone(fact.authoritativeValue),
        unit: fact.unit ?? null,
        scope: fact.scope || null,
        resultVersion: fact.resultVersion || null,
        evidenceRefs: deepClone(fact.evidenceRefs || []),
        anchorIds: deepClone(fact.anchorIds || []),
        bindingStatus: fact.bindingStatus,
        basis: deepClone(fact.basis || []),
        ruleSnapshot: deepClone(fact.ruleSnapshot || null),
        semanticSnapshot: deepClone(fact.semanticSnapshot || null),
        trustSnapshot: deepClone(fact.trustSnapshot || null)
      })),
      bindingGaps: deepClone(result.generatedContent?.bindingGaps || []),
      generatedNarratives: deepClone(result.generatedContent?.generatedNarratives || [])
    }
  };
}

function compactC023TransferForStorage(run, result) {
  if (!run || !result || result.type !== "Agent Report Draft") return null;
  return {
    contractCode: "C023",
    schemaVersion: 1,
    owner: "Agent 应用",
    consumer: "报告中心",
    run: {
      id: run.id || null,
      requestId: run.requestId || null,
      sessionId: run.sessionId || null,
      bindingId: run.bindingId || null,
      status: run.status || null,
      source: run.source || null,
      createdAt: run.createdAt || null,
      startedAt: run.startedAt || null,
      finishedAt: run.finishedAt || null,
      retryOf: run.retryOf || null,
      replacesRun: run.replacesRun || null,
      snapshot: compactRunIdentityForStorage(run.snapshot || {}),
    },
    result: compactReportDraftResultForStorage(result, true),
    writtenAt: nowText(),
    persistedAsReference: true,
  };
}

function writeC023Transfer(run, result) {
  const transfer = compactC023TransferForStorage(run, result);
  if (!transfer) return false;
  const serialized = JSON.stringify(transfer);
  const write = (storage) => {
    storage.setItem(C023_OUTBOX_KEY, serialized);
    return true;
  };
  try {
    write(localStorage);
    try { sessionStorage.removeItem(C023_OUTBOX_KEY); } catch (_) {}
    return true;
  } catch (_) {
    try {
      write(sessionStorage);
      return true;
    } catch (_) {
      return false;
    }
  }
}

function compactC024ForStorage(candidate = {}) {
  const identity = c024Identity(candidate);
  const context = candidate.reportContext || {};
  return {
    requestId: candidate.requestId || null,
    receivedAt: candidate.receivedAt || null,
    reportContext: {
      scenarioContext: deepClone(context.scenarioContext || {
        scenarioId: identity.scenarioId,
        scenarioVersion: identity.scenarioVersion,
        scenarioRunId: identity.scenarioRunId,
        formedAt: identity.scenarioFormedAt,
        status: identity.scenarioStatus
      }),
      reportNumber: identity.reportNumber,
      contentVersion: identity.contentVersion,
      evidencePack: { id: identity.evidencePackageId, version: identity.evidencePackageVersion },
      semanticBinding: {
        semanticVersionId: identity.semanticVersionId,
        semanticVersion: identity.semanticVersion,
        dataAssetVersionId: identity.dataAssetVersionId,
        dataVersion: identity.dataVersion,
        consumableVersionId: identity.consumableVersionId,
        asOf: identity.dataAsOf
      },
      anchorSnapshotId: identity.anchorSnapshotId,
      anchorSnapshotVersion: identity.anchorSnapshotVersion,
      selectedAnchor: identity.selectedAnchor
    },
    persistedAsReference: true,
    payloadStoredIn: C024_INBOX_KEY
  };
}

function compactCredibilityForStorage(credibility = null) {
  if (!credibility) return credibility;
  return {
    contract: credibility.contract || null,
    contextStatus: credibility.contextStatus || null,
    versionBindingSummary: deepClone(credibility.versionBindingSummary || null),
    currentStateSummary: deepClone(credibility.currentStateSummary || null),
    agentGates: deepClone(credibility.agentGates || []),
    historyDimensions: deepClone(credibility.historyDimensions || [])
  };
}

function compactEvidenceItemsForStorage(items = []) {
  return (items || []).map((item) => ({
    id: item.id || item.factId || null,
    factId: item.factId || null,
    type: item.type || item.kind || null,
    name: item.name || item.label || item.id || null,
    value: deepClone(item.value ?? item.displayValue ?? null),
    object: item.object || item.scope || null,
    source: item.source || (item.evidenceRefs || item.evidence || []).join("、") || null,
    resultVersion: item.resultVersion || null,
    evidenceRefs: deepClone(item.evidenceRefs || item.evidence || []),
    anchorIds: deepClone(item.anchorIds || []),
    persistedAsReference: true
  }));
}

function compactComparisonReferenceForStorage(comparison = null) {
  if (!comparison) return comparison;
  return {
    recordId: comparison.recordId || null,
    recordStatus: comparison.recordStatus || null,
    comparedAt: comparison.comparedAt || null,
    comparisonOutcome: comparison.comparisonOutcome || null,
    comparisonOutcomeReason: comparison.comparisonOutcomeReason || null,
    gate: comparison.gate || null,
    currentStatusSummaryRef: deepClone(comparison.currentStatusSummaryRef || null),
    counts: deepClone(comparison.counts || null),
    resultCount: Array.isArray(comparison.results) ? comparison.results.length : comparison.resultCount || 0,
    resultsStoredIn: "报告中心 C027 比较记录",
    persistedAsReference: true
  };
}

function compactReportEvidenceForStorage(evidence = {}) {
  return {
    ...evidence,
    itemCount: Array.isArray(evidence.items) ? evidence.items.length : evidence.itemCount || 0,
    items: [],
    credibility: compactCredibilityForStorage(evidence.credibility),
    externalCredibilityFeed: null,
    generation: evidence.kind === "report-generation" ? compactReportGenerationForStorage(evidence.generation) : evidence.generation,
    persistedAsReference: true
  };
}

function compactGenericEvidenceForStorage(evidence = {}) {
  return {
    ...evidence,
    items: compactEvidenceItemsForStorage(evidence.items),
    credibility: compactCredibilityForStorage(evidence.credibility),
    externalCredibilityFeed: null,
    persistedAsReference: true
  };
}

function compactReportRunSnapshotForStorage(snapshot = {}) {
  return {
    ...snapshot,
    evidenceItems: compactEvidenceItemsForStorage(snapshot.evidenceItems),
    credibility: compactCredibilityForStorage(snapshot.credibility),
    comparisonReference: compactComparisonReferenceForStorage(snapshot.comparisonReference),
    reportGeneration: compactReportGenerationForStorage(snapshot.reportGeneration)
  };
}

function compactReportCopilotResultForStorage(result = null) {
  if (!result || result.type !== "Report Copilot Result") return result;
  return {
    ...result,
    sections: (result.sections || []).map((section) => ({
      title: section.title,
      body: section.body,
      refs: deepClone(section.refs || [])
    })),
    currentComparison: result.currentComparison ? {
      id: result.currentComparison.id || null,
      owner: result.currentComparison.owner || null,
      label: result.currentComparison.label || null,
      status: result.currentComparison.status || null,
      comparedAt: result.currentComparison.comparedAt || null,
      currentSummaryId: result.currentComparison.currentSummaryId || null,
      currentSummaryVersion: result.currentComparison.currentSummaryVersion || null,
      currentSummaryObservedAt: result.currentComparison.currentSummaryObservedAt || null,
      conclusion: result.currentComparison.conclusion || null,
      counts: deepClone(result.currentComparison.counts || null),
      resultRefCount: Array.isArray(result.currentComparison.resultRefs) ? result.currentComparison.resultRefs.length : 0,
      resultsStoredIn: "报告中心 C027 比较记录"
    } : null,
    persistedAsReference: true
  };
}

function compactRunIdentityForStorage(snapshot = {}) {
  const keys = [
    "agentId", "agentName", "agentRelease", "scenarioBinding", "requestContext", "scenarioId", "scenarioVersion", "scenarioRunId", "scenarioFormedAt", "scenarioStatus", "scenarioContext",
    "scenario", "objectScope", "expectedOutput", "inputContract", "outputContract", "evidenceId", "evidencePackageId",
    "evidencePackageVersion", "evidenceName", "dataVersion", "dataAssetVersionId", "consumableVersionId", "dataAsOf",
    "ontology", "ontologyScope", "ontologyVersion", "semanticVersionId", "quality", "freshness", "evidenceStatus", "evidenceAuthority", "evidenceFormedAt",
    "requestId", "question", "reportAggregateId", "reportDefinitionId", "reportDefinitionVersion", "templateId", "templateVersion",
    "anchorSnapshotId", "anchorSnapshotVersion",
    "reportNumber", "contentVersion", "reportVersion", "anchor", "verificationSummary", "verificationRunRef", "contextIntent",
    "regenerationStatus", "regenerationRef"
  ];
  const compact = {};
  keys.forEach((key) => { if (snapshot[key] !== undefined) compact[key] = deepClone(snapshot[key]); });
  compact.prompt = deepClone(snapshot.prompt || null);
  compact.promptBinding = deepClone(snapshot.promptBinding || null);
  compact.skills = deepClone(snapshot.skills || []);
  compact.skillBindings = deepClone(snapshot.skillBindings || []);
  compact.tools = deepClone(snapshot.tools || []);
  compact.toolBindings = deepClone(snapshot.toolBindings || []);
  compact.credibility = compactCredibilityForStorage(snapshot.credibility);
  compact.reportGeneration = compactReportGenerationForStorage(snapshot.reportGeneration);
  compact.comparisonReference = compactComparisonReferenceForStorage(snapshot.comparisonReference);
  compact.evidenceItemCount = Array.isArray(snapshot.evidenceItems) ? snapshot.evidenceItems.length : snapshot.evidenceItemCount || 0;
  compact.evidenceItems = [];
  compact.persistedAsReference = true;
  return compact;
}

function compactHistoricalReportRunForStorage(run = {}) {
  const result = run.result ? {
    id: run.result.id || null,
    type: run.result.type || null,
    contract: run.result.contract || null,
    title: run.result.title || null,
    summary: run.result.summary || null,
    limitations: run.result.limitations || null,
    confidence: run.result.confidence || null,
    generatedAt: run.result.generatedAt || null,
    confirmation: run.result.confirmation || null,
    owner: run.result.owner || null,
    destination: run.result.destination || null,
    reportNumber: run.result.reportNumber || null,
    contentVersion: run.result.contentVersion || null,
    evidencePackageId: run.result.evidencePackageId || null,
    evidencePackageVersion: run.result.evidencePackageVersion || null,
    semanticVersionId: run.result.semanticVersionId || null,
    semanticVersion: run.result.semanticVersion || null,
    dataAssetVersionId: run.result.dataAssetVersionId || null,
    dataVersion: run.result.dataVersion || null,
    consumableVersionId: run.result.consumableVersionId || null,
    dataAsOf: run.result.dataAsOf || null,
    anchorSnapshotId: run.result.anchorSnapshotId || null,
    anchorSnapshotVersion: run.result.anchorSnapshotVersion || null,
    anchor: run.result.anchor || null,
    scenarioContext: deepClone(run.result.scenarioContext || null),
    scenarioId: run.result.scenarioId || null,
    scenarioVersion: run.result.scenarioVersion || null,
    scenarioRunId: run.result.scenarioRunId || null,
    scenarioFormedAt: run.result.scenarioFormedAt || run.result.scenarioContext?.formedAt || null,
    scenarioStatus: run.result.scenarioStatus || run.result.scenarioContext?.status || null,
    sourceDraftId: run.result.sourceDraftId || null,
    sections: deepClone(run.result.sections || []),
    currentComparison: deepClone(run.result.currentComparison || null),
    archivedPayload: deepClone(run.result.archivedPayload || null),
    persistedAsReference: true
  } : null;
  return {
    id: run.id,
    question: run.question || null,
    attempt: run.attempt,
    source: run.source,
    requestId: run.requestId || null,
    sessionId: run.sessionId || null,
    status: run.status,
    createdAt: run.createdAt || null,
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    completedAt: run.completedAt || null,
    currentProjection: run.currentProjection,
    projectionStatus: run.projectionStatus,
    scenarioContext: deepClone(run.scenarioContext || run.snapshot?.scenarioContext || null),
    archivedReason: run.archivedReason || null,
    retryOf: run.retryOf || null,
    replacesRun: run.replacesRun || null,
    snapshot: compactRunIdentityForStorage(run.snapshot),
    result,
    steps: deepClone(run.steps || []),
    toolCalls: deepClone(run.toolCalls || []),
    error: run.error || null,
    recovery: run.recovery || null,
    persistedAsReference: true
  };
}

function compactArchivedRunForStorage(run = {}) {
  return {
    id: run.id,
    question: run.question || null,
    attempt: run.attempt,
    source: run.source,
    requestId: run.requestId || null,
    sessionId: run.sessionId || null,
    status: run.status,
    createdAt: run.createdAt || null,
    startedAt: run.startedAt || null,
    finishedAt: run.finishedAt || null,
    completedAt: run.completedAt || null,
    currentProjection: run.currentProjection,
    projectionStatus: run.projectionStatus,
    scenarioContext: deepClone(run.scenarioContext || run.snapshot?.scenarioContext || null),
    snapshot: compactRunIdentityForStorage(run.snapshot),
    result: run.result ? {
      id: run.result.id || null,
      type: run.result.type || null,
      contract: run.result.contract || null,
      title: run.result.title || null,
      generatedAt: run.result.generatedAt || null,
      confirmation: run.result.confirmation || null,
      reportNumber: run.result.reportNumber || null,
      contentVersion: run.result.contentVersion || null,
      evidencePackageId: run.result.evidencePackageId || null,
      evidencePackageVersion: run.result.evidencePackageVersion || null,
      semanticVersionId: run.result.semanticVersionId || null,
      semanticVersion: run.result.semanticVersion || null,
      dataAssetVersionId: run.result.dataAssetVersionId || null,
      dataVersion: run.result.dataVersion || null,
      consumableVersionId: run.result.consumableVersionId || null,
      dataAsOf: run.result.dataAsOf || null,
      anchorSnapshotId: run.result.anchorSnapshotId || null,
      anchorSnapshotVersion: run.result.anchorSnapshotVersion || null,
      anchor: run.result.anchor || null,
      scenarioContext: deepClone(run.result.scenarioContext || null),
      sourceDraftId: run.result.sourceDraftId || null,
      persistedAsReference: true
    } : null,
    error: run.error || null,
    recovery: run.recovery || null,
    persistedAsReference: true
  };
}

function resolveC024Reference(reference = {}) {
  const requestId = reference.requestId || reference.id || null;
  if (!requestId) return reference;
  return readC024Candidates().find((candidate) => candidate.requestId === requestId) || reference;
}

function compactModelForStorage(model) {
  const persisted = deepClone(model);
  const initialAgents = window.AGENT_APP_INITIAL_STATE.agents || [];
  const initialEvidence = window.AGENT_APP_INITIAL_STATE.evidencePackages || [];
  const initialAgentById = new Map(initialAgents.map((agent) => [agent.id, agent]));
  const initialEvidenceById = new Map(initialEvidence.map((evidence) => [evidence.id, evidence]));
  persisted.staticCatalogStoredAsReference = true;
  persisted.agentOverrides = (persisted.agents || []).filter((agent) => {
    const initial = initialAgentById.get(agent.id);
    return !initial || JSON.stringify(agent) !== JSON.stringify(initial);
  });
  persisted.agents = [];
  persisted.baseEvidenceOverrides = (persisted.evidencePackages || [])
    .filter((evidence) => initialEvidenceById.has(evidence.id) && JSON.stringify(evidence) !== JSON.stringify(initialEvidenceById.get(evidence.id)))
    .map(compactGenericEvidenceForStorage);
  persisted.evidencePackages = (persisted.evidencePackages || []).filter((evidence) => !initialEvidenceById.has(evidence.id));
  const recentRunEvidenceIds = new Set((persisted.runs || []).slice(0, 1).flatMap((run) => [
    run.snapshot?.evidenceId,
    run.snapshot?.evidencePackageId,
    run.result?.evidencePackageId
  ].filter(Boolean)));
  const latestReportDraftRunId = (persisted.runs || []).find((run) => run.snapshot?.agentId === "report-draft" && currentProjection(run))?.id || null;
  const newestReportEvidenceId = (persisted.evidencePackages || []).find((evidence) => evidence.kind === "report")?.id || null;
  const newestGenerationEvidenceId = (persisted.evidencePackages || []).find((evidence) => evidence.kind === "report-generation")?.id || null;
  persisted.evidencePackages = (persisted.evidencePackages || [])
    .filter((evidence) => reportEvidence(evidence)
      ? evidence.id === newestReportEvidenceId || evidence.id === newestGenerationEvidenceId || recentRunEvidenceIds.has(evidence.id)
      : recentRunEvidenceIds.has(evidence.id))
    .map((evidence) => reportEvidence(evidence)
    ? compactReportEvidenceForStorage(evidence)
    : compactGenericEvidenceForStorage(evidence));
  persisted.inboundRequests = (persisted.inboundRequests || []).map((request) => request.type === "report-draft"
    ? { ...request, c022: compactC022ForStorage(request.c022 || request), c022PayloadStoredIn: C022_INBOX_KEY }
    : request.type === "report-copilot"
      ? { ...request, c024: compactC024ForStorage(request.c024 || { requestId: request.id }), c024PayloadStoredIn: C024_INBOX_KEY }
      : request);
  persisted.runs = (persisted.runs || []).map((run) => run.snapshot?.agentId === "report-draft"
    ? {
      ...run,
      snapshot: compactReportRunSnapshotForStorage(run.snapshot),
      result: compactReportDraftResultForStorage(run.result, run.id === latestReportDraftRunId)
    }
    : run.snapshot?.agentId === "report-copilot"
      ? compactHistoricalReportRunForStorage({ ...run, result: compactReportCopilotResultForStorage(run.result) })
      : run);
  persisted.runs = persisted.runs.map((run) => run.snapshot?.agentId === "report-draft" && run.id !== latestReportDraftRunId
    ? compactHistoricalReportRunForStorage(run)
    : run);
  const recentRunIds = new Set((persisted.runs || []).slice(0, 1).map((run) => run.id));
  persisted.runs = (persisted.runs || []).map((run) => recentRunIds.has(run.id)
    ? run
    : compactArchivedRunForStorage(run));
  const latestSessionId = (persisted.runs || []).find((run) => run.snapshot?.agentId === "report-copilot" && run.sessionId)?.sessionId || null;
  persisted.sessions = (persisted.sessions || []).map((session) => session.id === latestSessionId ? session : ({
    id: session.id,
    bindingId: session.bindingId || null,
    reportNumber: session.reportNumber || null,
    contentVersion: session.contentVersion || null,
    reportVersion: session.reportVersion || null,
    evidenceId: session.evidenceId || null,
    evidencePackageId: session.evidencePackageId || null,
    evidencePackageVersion: session.evidencePackageVersion || null,
    semanticVersionId: session.semanticVersionId || null,
    ontologyVersion: session.ontologyVersion || null,
    dataAssetVersionId: session.dataAssetVersionId || null,
    dataVersion: session.dataVersion || null,
    scenarioId: session.scenarioId || null,
    scenarioVersion: session.scenarioVersion || null,
    scenarioRunId: session.scenarioRunId || null,
    scenarioFormedAt: session.scenarioFormedAt || session.scenarioContext?.formedAt || null,
    scenarioStatus: session.scenarioStatus || session.scenarioContext?.status || null,
    scenarioContext: deepClone(session.scenarioContext || null),
    anchor: session.anchor || null,
    latestRunId: session.latestRunId || null,
    latestResultId: session.latestResultId || null,
    status: session.status,
    currentProjection: session.currentProjection,
    projectionStatus: session.projectionStatus,
    archivedReason: session.archivedReason || null,
    staleReason: session.staleReason || null,
    persistedAsReference: true
  }));
  return persisted;
}

function persistAgentModel(model) {
  const key = window.AGENT_WORKSPACE_CONFIG.storageKey;
  const payload = JSON.stringify(compactModelForStorage(model));
  const removeLegacyAgentDirectories = () => {
    LEGACY_AGENT_STORAGE_KEYS.filter((legacyKey) => legacyKey !== key).forEach((legacyKey) => {
      try { localStorage.removeItem(legacyKey); } catch (_) {}
    });
  };
  try {
    localStorage.setItem(key, payload);
    try { sessionStorage.removeItem(key); } catch (_) {}
    removeLegacyAgentDirectories();
    return;
  } catch (error) {
    if (error?.name !== "QuotaExceededError") throw error;
    const legacyPrototypeKeys = [
      // 仅清理已确认废弃的旧原型工作区；任务与编排工作区仍是有效入口。
      "ontology-management-product-state-v1",
      "ontology3-canvas-first-review-v16",
      "ontology3.intelligent-query.workspace.v1",
      "ontology3.iq.review.default.v1",
      "ontology3.iq.review.analysis.v1",
      "ontology3.iq.review.semantic.v1",
      "ontology3-decision-center-state-v1",
      "ontology3-decision-center-review-v2-queue-state-v6",
      "ontology3-decision-center-review-v2-continuous-state-v6",
      "ontology3.report-center.state.v1",
      "ontology3.report-center.review-evidence.v1",
      "ontology3.report-center.review-workspace.v2",
      "ontology3.report-center.lifecycle-review.v0",
      "ontology3.data-engineering.workspace.v4",
      "ontology3.data-engineering.workspace.v5",
      "ontology3.decision-center-review-v2-queue-state-v5",
      "ontology3.decision-center-review-v2-continuous-state-v5"
    ].filter((legacyKey) => legacyKey !== key);
    if (legacyPrototypeKeys.length) {
      legacyPrototypeKeys.forEach((legacyKey) => localStorage.removeItem(legacyKey));
      try {
        localStorage.setItem(key, payload);
        try { sessionStorage.removeItem(key); } catch (_) {}
        removeLegacyAgentDirectories();
        return;
      } catch (_) {}
    }
    // 迁移旧 Agent 目录键时，先保留内存中的完整模型，再释放旧键空间。
    // 若新键写入失败，恢复旧键，避免把已有运行历史丢失。
    const oldAgentKeys = LEGACY_AGENT_STORAGE_KEYS.filter((legacyKey) => legacyKey !== key);
    const oldAgentPayloads = oldAgentKeys.map((legacyKey) => ({ key: legacyKey, value: localStorage.getItem(legacyKey) }))
      .filter((entry) => entry.value);
    oldAgentPayloads.forEach((entry) => localStorage.removeItem(entry.key));
    try {
      localStorage.setItem(key, payload);
      try { sessionStorage.removeItem(key); } catch (_) {}
      removeLegacyAgentDirectories();
      return;
    } catch (migrationError) {
      oldAgentPayloads.forEach((entry) => {
        try { localStorage.setItem(entry.key, entry.value); } catch (_) {}
      });
    }
    // 浏览器 localStorage 已满时，使用同一标签页的 sessionStorage 保留完整工作区。
    // sessionStorage 会跨模块导航和刷新保留，报告中心与总控均通过同一只读回退读取。
    try {
      sessionStorage.setItem(key, payload);
      removeLegacyAgentDirectories();
      return;
    } catch (_) {}
    const previous = localStorage.getItem(key);
    if (!previous || payload.length >= previous.length) throw error;
    localStorage.removeItem(key);
    try {
      localStorage.setItem(key, payload);
    } catch (replacementError) {
      try { localStorage.setItem(key, previous); } catch (_) {}
      throw replacementError;
    }
  }
}

function hydratePersistedModel(model) {
  const hydrated = deepClone(model);
  if (hydrated.staticCatalogStoredAsReference) {
    const overrides = hydrated.agentOverrides || [];
    const overrideById = new Map(overrides.map((agent) => [agent.id, agent]));
    hydrated.agents = [
      ...(window.AGENT_APP_INITIAL_STATE.agents || []).map((agent) => deepClone(overrideById.get(agent.id) || agent)),
      ...overrides.filter((agent) => !(window.AGENT_APP_INITIAL_STATE.agents || []).some((initial) => initial.id === agent.id)).map(deepClone)
    ];
    const evidenceOverrides = hydrated.baseEvidenceOverrides || [];
    const evidenceOverrideById = new Map(evidenceOverrides.map((evidence) => [evidence.id, evidence]));
    hydrated.evidencePackages = [
      ...(window.AGENT_APP_INITIAL_STATE.evidencePackages || []).map((evidence) => ({
        ...deepClone(evidence),
        ...deepClone(evidenceOverrideById.get(evidence.id) || {})
      })),
      ...(hydrated.evidencePackages || [])
    ];
    delete hydrated.agentOverrides;
    delete hydrated.baseEvidenceOverrides;
  }
  hydrated.inboundRequests = (hydrated.inboundRequests || []).map((request) => request.type === "report-draft"
    ? { ...request, c022: deepClone(resolveC022Reference(request.c022 || request)) }
    : request.type === "report-copilot"
      ? (() => {
        const c024 = deepClone(resolveC024Reference(request.c024 || { requestId: request.id }));
        const identity = c024Identity(c024);
        return {
          ...request,
          consumableVersionId: request.consumableVersionId || identity.consumableVersionId || null,
          anchorSnapshotId: request.anchorSnapshotId || identity.anchorSnapshotId || null,
          anchorSnapshotVersion: request.anchorSnapshotVersion || identity.anchorSnapshotVersion || null,
          anchor: request.anchor || identity.selectedAnchor || null,
          c024,
        };
      })()
      : request);
  hydrated.evidencePackages = (hydrated.evidencePackages || []).map((evidence) => evidence.kind === "report-generation" && evidence.persistedAsReference
    ? (() => {
      const candidate = resolveC022Reference({ requestId: evidence.requestContext?.id || evidence.generation?.c022RequestId });
      return candidate?.requestId ? evidenceFromC022(candidate, evidence.formedAt || nowText()) : { ...evidence, generation: hydrateReportGeneration(evidence.generation, evidence.requestContext?.id) };
    })()
    : evidence.kind === "report-generation"
      ? { ...evidence, generation: hydrateReportGeneration(evidence.generation, evidence.requestContext?.id) }
    : evidence.kind === "report" && evidence.persistedAsReference
      ? (() => {
        const candidate = resolveC024Reference({ requestId: evidence.requestContext?.id });
        return candidate?.requestId ? evidenceFromC024(candidate, evidence.formedAt || nowText()) : evidence;
      })()
      : evidence);
  hydrated.runs = (hydrated.runs || []).map((run) => {
    if (run.snapshot?.agentId === "report-draft") {
      return { ...run, snapshot: { ...run.snapshot, reportGeneration: hydrateReportGeneration(run.snapshot.reportGeneration, run.requestId || run.snapshot.requestId) } };
    }
    if (run.snapshot?.agentId !== "report-copilot" || (run.snapshot.evidenceItems || []).length) return run;
    const requestId = run.requestId || run.snapshot.requestId || run.snapshot.requestContext?.id || null;
    const evidence = hydrated.evidencePackages.find((item) => item.kind === "report"
      && item.id === run.snapshot.evidenceId
      && item.requestContext?.id === requestId);
    if (!evidence || !sameScenarioContext(run.scenarioContext || run.snapshot.scenarioContext || run.snapshot, evidence.scenarioContext)) return run;
    const exactIdentityMatches = [
      [run.snapshot.reportNumber, evidence.report?.number],
      [run.snapshot.contentVersion, evidence.report?.contentVersion],
      [run.snapshot.evidencePackageId, evidence.evidencePackageId],
      [run.snapshot.evidencePackageVersion, evidence.evidencePackageVersion],
      [run.snapshot.semanticVersionId, evidence.semanticVersionId],
      [run.snapshot.ontologyVersion, evidence.ontologyVersion],
      [run.snapshot.dataAssetVersionId, evidence.dataAssetVersionId],
      [run.snapshot.dataVersion, evidence.dataVersion],
      [run.snapshot.consumableVersionId, evidence.consumableVersionId],
      [run.snapshot.dataAsOf, evidence.dataAsOf],
      [run.snapshot.anchorSnapshotId, evidence.report?.anchorSnapshotId],
      [run.snapshot.anchorSnapshotVersion, evidence.report?.anchorSnapshotVersion],
      [run.snapshot.anchor, evidence.report?.anchor]
    ].every(([fixed, current]) => fixed != null && current != null && String(fixed) === String(current));
    if (!exactIdentityMatches) return run;
    return {
      ...run,
      snapshot: {
        ...run.snapshot,
        evidenceItems: deepClone(evidence.items || []),
        evidenceItemCount: (evidence.items || []).length
      }
    };
  });
  return hydrated;
}

function scopeModelToActiveScenario(model) {
  const scoped = deepClone(window.AGENT_PORTFOLIO?.hydrateState?.(model) || model);
  const activeScenarioContext = readActiveScenarioContext();
  const aggregatePortfolio = Boolean(window.AGENT_PORTFOLIO) && !new URLSearchParams(window.location.search).has("scenarioId");
  const archivedAt = nowText();
  const archive = (item) => ({
    ...item,
    currentProjection: false,
    projectionStatus: "history",
    archivedAt: item.archivedAt || archivedAt,
    archivedReason: item.archivedReason || "记录不属于当前完整 C033 场景运行上下文，已保留为只读历史。"
  });
  // 组合目录没有全局场景切换时，各记录以自身完整场景身份保持可读；
  // 只有平台明确传入另一个场景上下文时才归档为历史。
  const outsideActiveScenario = (item) => !aggregatePortfolio && scenarioContextReady(activeScenarioContext)
    && !sameScenarioContext(item?.scenarioContext || item?.snapshot?.scenarioContext || item?.snapshot || item, activeScenarioContext);
  scoped.currentScenarioContext = !aggregatePortfolio && scenarioContextReady(activeScenarioContext) ? deepClone(activeScenarioContext) : null;
  scoped.evidencePackages = (scoped.evidencePackages || []).map((item) => reportEvidence(item) && currentProjection(item) && outsideActiveScenario(item) ? archive(item) : item);
  scoped.inboundRequests = (scoped.inboundRequests || []).map((item) => ["report-draft", "report-copilot", "report-verification"].includes(item?.type) && currentProjection(item) && outsideActiveScenario(item) ? archive(item) : item);
  scoped.runs = (scoped.runs || []).map((item) => reportRun(item) && currentProjection(item) && outsideActiveScenario(item) ? archive(item) : item);
  scoped.sessions = (scoped.sessions || []).map((item) => currentProjection(item) && outsideActiveScenario(item) ? { ...archive(item), status: "stale", staleAt: item.staleAt || archivedAt, staleReason: item.staleReason || "当前 C033 已变化；旧会话不能创建或重试新运行。", resultReturnStatus: "历史结果保持只读" } : item);
  return scoped;
}

function c022Issues(candidate, activeScenarioContext = null) {
  const identity = c022Identity(candidate);
  const candidateScenarioContext = scenarioIdentityContext(identity);
  const required = {
    requestId: identity.requestId,
    scenarioId: identity.scenarioId,
    scenarioVersion: identity.scenarioVersion,
    scenarioRunId: identity.scenarioRunId,
    scenarioFormedAt: identity.scenarioFormedAt,
    scenarioStatus: identity.scenarioStatus,
    aggregateId: identity.aggregateId,
    evidencePackageId: identity.evidencePackageId,
    evidencePackageVersion: identity.evidencePackageVersion,
    semanticVersionId: identity.semanticVersionId,
    semanticVersion: identity.semanticVersion,
    dataAssetVersionId: identity.dataAssetVersionId,
    dataVersion: identity.dataVersion,
    consumableVersionId: identity.consumableVersionId,
    dataAsOf: identity.dataAsOf,
    reportDefinitionId: identity.reportDefinitionId,
    reportDefinitionVersion: identity.reportDefinitionVersion,
    templateId: identity.templateId,
    templateVersion: identity.templateVersion,
    targetContentRevision: identity.targetContentRevision
  };
  const labels = {
    requestId: "请求标识", scenarioId: "场景标识", scenarioVersion: "场景版本", scenarioRunId: "场景轮次", scenarioFormedAt: "场景上下文形成时间", scenarioStatus: "场景状态", aggregateId: "报告聚合标识", evidencePackageId: "证据包标识", evidencePackageVersion: "证据包版本", semanticVersionId: "语义版本标识", semanticVersion: "精确语义版本", dataAssetVersionId: "数据资产版本标识", dataVersion: "精确数据版本", consumableVersionId: "可消费版本标识", dataAsOf: "数据截至时间", reportDefinitionId: "报告定义标识", reportDefinitionVersion: "报告定义版本", templateId: "模板标识", templateVersion: "模板版本", targetContentRevision: "目标内容修订号"
  };
  const issues = Object.entries(required).filter(([, value]) => value == null || String(value).trim() === "").map(([key]) => `缺少${labels[key]}`);
  if (!Array.isArray(candidate?.reportContext?.template?.slots || candidate?.template?.slots) || !(candidate?.reportContext?.template?.slots || candidate?.template?.slots).length) issues.push("缺少模板槽位");
  if (!Array.isArray(candidate?.reportEvidence?.contentFacts) || !candidate.reportEvidence.contentFacts.length) issues.push("缺少固定事实项");
  if (!Array.isArray(candidate?.reportEvidence?.contentItems) || !candidate.reportEvidence.contentItems.length) issues.push("缺少源内容项合同");
  if (!Array.isArray(candidate?.reportEvidence?.anchors) || !candidate.reportEvidence.anchors.length) issues.push("缺少锚点清单");
  if (!scenarioContextReady(candidateScenarioContext)) issues.push("请求未提供完整、已启用的 C033 场景运行上下文");
  if (candidate.evidencePackId && identity.evidencePackageId && candidate.evidencePackId !== identity.evidencePackageId) issues.push("请求外层证据包标识与固定上下文不一致");
  if (!scenarioContextReady(activeScenarioContext)) issues.push("当前平台 C033 场景运行上下文缺失、未知或未启用");
  else if (!sameScenarioContext(candidateScenarioContext, activeScenarioContext)) issues.push("场景标识、版本、轮次、形成时间或状态与当前平台 C033 不一致");
  const trust = candidate?.reportContext?.trustAtGeneration || {};
  if (/hard|失败|不可消费|blocked/.test(normalizeStatus(trust.status || trust.quality || trust.publishedQuality || trust.readiness))) issues.push("生成时数据可信度不允许形成新的正式草稿");
  return [...new Set(issues)];
}

function evidenceFromC022(candidate, receivedAt = nowText()) {
  const context = candidate.reportContext || {};
  const identity = c022Identity(candidate);
  const trust = context.trustAtGeneration || {};
  const facts = candidate.reportEvidence?.contentFacts || [];
  const statusLabel = trust.statusLabel || trust.label || trust.readiness || "可用于报告草稿生成";
  const currentSummaryId = trust.currentStatusSummaryId || trust.id || `C017-${identity.evidencePackageId}`;
  const currentSummaryVersion = trust.currentStatusSummaryVersion || trust.version || "来源未提供独立版本";
  const versionBinding = {
    id: trust.id || `C017-BINDING-${identity.evidencePackageId}`,
    version: trust.version || "1.0",
    formedAt: trust.formedAt || context.evidencePack?.fixedAt || receivedAt,
    status: "ready",
    label: "生成时绑定已固定",
    t007: identity.dataVersion,
    t008: identity.dataAsOf,
    t008Source: "报告中心 C022 固定上下文",
    ontology: identity.semanticVersion,
    binding: `${identity.semanticVersion} / ${identity.dataVersion}`,
    reason: "只用于本次报告生成请求，不随当前数据或语义版本变化。"
  };
  const currentSummary = {
    id: currentSummaryId,
    version: currentSummaryVersion,
    sourceOwner: "数据工程",
    sourceReference: "C022 中固定的 C017 只读摘要",
    observedAt: trust.formedAt || context.evidencePack?.fixedAt || receivedAt,
    status: "ready",
    label: statusLabel,
    quality: trust.publishedQuality || trust.quality || "质量门通过",
    freshness: trust.freshness || "截至时间已固定",
    factAge: trust.factAge || "按报告生成时点固定",
    applicableScope: identity.dataVersion,
    dataQualification: trust.readiness || "允许生成报告草稿",
    activeDataVersion: identity.dataVersion,
    activeDataAsOf: identity.dataAsOf,
    useConclusion: "允许在 C022 固定范围内生成结构化源草稿；不得扩展到包外业务明细。"
  };
  const identityItem = { role: "当前权威", status: "ready", label: "已固定", t006: identity.dataAssetVersionId, t007: identity.dataVersion, t008: identity.dataAsOf, reason: "由报告中心在提交 C022 前完成权威组合与可信度门校验。" };
  return {
    id: `${identity.evidencePackageId}@${identity.evidencePackageVersion}:generation`,
    evidencePackageId: identity.evidencePackageId,
    evidencePackageVersion: identity.evidencePackageVersion,
    name: `${identity.reportDefinitionId} 报告生成固定证据`,
    kind: "report-generation",
    currentProjection: true,
    projectionStatus: "current",
    status: "ready",
    statusLabel,
    dataVersion: identity.dataVersion,
    dataAssetVersionId: identity.dataAssetVersionId,
    consumableVersionId: identity.consumableVersionId,
    dataAsOf: identity.dataAsOf,
    ontologyVersion: identity.semanticVersion,
    semanticVersionId: identity.semanticVersionId,
    quality: currentSummary.quality,
    freshness: currentSummary.freshness,
    authority: "报告中心 C022 固定报告定义与证据；本体管理 C008/T019；数据工程 C017",
    formedAt: context.evidencePack?.fixedAt || receivedAt,
    previousId: null,
    scenarioContext: { scenarioId: identity.scenarioId, scenarioVersion: identity.scenarioVersion, scenarioRunId: identity.scenarioRunId, formedAt: identity.scenarioFormedAt, status: identity.scenarioStatus },
    requestContext: {
      id: identity.requestId,
      version: "1.0",
      sourceOwner: "报告中心",
      scenarioId: identity.scenarioId,
      scenarioVersion: identity.scenarioVersion,
      scenarioRunId: identity.scenarioRunId,
      scenarioLabel: context.scenarioLabel || `${identity.scenarioId} · 集团融资成本与债务结构优化`,
      requestedAt: candidate.submittedAt || receivedAt,
      objectScope: `${identity.aggregateId} / ${identity.reportDefinitionId} ${identity.reportDefinitionVersion} / ${identity.templateId} ${identity.templateVersion}`,
      expectedOutput: "Agent Report Draft v1"
    },
    credibility: {
      contract: "C017 报告生成固定上下文安全投影",
      lastReadAt: receivedAt,
      versionBindingSummary: versionBinding,
      currentStateSummary: currentSummary,
      identities: { current: identityItem, candidate: { role: "较新候选", status: "unknown", label: "本次不适用", reason: "C022 只绑定生成时权威组合。" }, previousQualified: { role: "上一具备采用资格", status: "unknown", label: "本次不适用", reason: "本次草稿不得改选其他版本。" }, previousAuthoritative: { role: "上一权威服务", status: "unknown", label: "本次不适用", reason: "本次草稿不得回退或改选。" } },
      refresh: { status: "complete", label: "提交前已读取", observedAt: receivedAt, resultState: "报告中心已完成 C008/C017 重读", recovery: "状态改变时由报告中心提交新的 C022。" },
      postQuality: { status: "complete", label: "未登记硬质量失败", checkedAt: currentSummary.observedAt, scope: identity.dataVersion, reason: "C022 提交时允许报告草稿用途。", recovery: "出现硬质量失败时阻断新 Run，旧 Run 保持只读。" },
      ontologyAdoption: { status: "ready", label: "已正式采用", observedAt: versionBinding.formedAt, source: "C008/T019 只读引用", recovery: "由本体管理形成新的权威组合后提交新 C022。" },
      consumptionReadiness: { status: "ready", label: "允许报告生成", observedAt: currentSummary.observedAt, allowedUse: "当前报告定义、模板槽位与固定证据包", reason: "精确可消费版本已固定。", recovery: "不可定位时拒绝新 Run。" },
      stableEvidence: { status: "available", label: "可定位", checkedAt: receivedAt, refs: [identity.evidencePackageId, identity.semanticVersionId, identity.dataAssetVersionId], recovery: "缺少稳定引用时由报告中心重交 C022。" },
      agentGates: [{ id: "report-draft-transfer", name: "报告草稿生成与移交", status: "allowed", label: "允许", reason: "C022 场景、报告根、证据包和精确双版本身份完整。", recovery: "身份或证据变化时创建新的 C022 与 C023 Run。" }],
      historyDimensions: [
        { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "精确语义、数据和证据包身份完整。", checkedAt: receivedAt, recovery: "不可定位时拒绝新 Run。" },
        { id: "content-access", name: "内容访问", status: "complete", label: "仅固定证据", reason: "只读取 C022 内结构化事实和内容项。", checkedAt: receivedAt, recovery: "缺少内容时由报告中心重交。" },
        { id: "evidence-completeness", name: "证据完整", status: "complete", label: "完整", reason: "事实项、内容项与锚点清单均已提供。", checkedAt: receivedAt, recovery: "缺失时拒绝接收。" },
        { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "不在本次授权", reason: "C022 不授权数据侧重放。", checkedAt: receivedAt, recovery: "由数据工程另行提供。" },
        { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "生成草稿不等于历史数据重放。", checkedAt: receivedAt, recovery: "由获准模块形成独立核验记录。" }
      ]
    },
    items: facts.map((fact) => ({ id: fact.id || fact.factId, type: fact.kind || "事实项", name: fact.label || fact.name || fact.id, value: displayFactValue(fact), object: fact.scope || "报告固定范围", source: (fact.evidence || fact.evidenceRefs || []).join("、") || identity.evidencePackageId })),
    generation: { identity: deepClone(identity), reportDefinition: deepClone(context.reportDefinition || candidate.reportDefinition), template: deepClone(context.template || candidate.template), reportEvidence: deepClone(candidate.reportEvidence || {}), contentRevision: identity.targetContentRevision, c022RequestId: identity.requestId, reportEvidenceRef: identity.evidencePackageId }
  };
}

function readC024Candidates() {
  const direct = safeJson(localStorage.getItem(C024_INBOX_KEY), []);
  const directItems = Array.isArray(direct) ? direct : Array.isArray(direct?.requests) ? direct.requests : [];
  const ownerStore = safeJson(localStorage.getItem(REPORT_OWNER_RECORD_KEY), {});
  const ownerItems = (ownerStore.questions || []).map((record) => ({
    requestId: record.requestId,
    receivedAt: record.submittedAt,
    question: record.payload?.question,
    selectedAnchor: record.payload?.selectedAnchor,
    evidencePackId: record.payload?.evidencePackId,
    reportContentVersion: record.payload?.reportContentVersion,
    reportContext: record.payload?.reportContext,
    fixedContextRef: record.fixedContextRef,
    sourceRecordId: record.runId,
    source: "报告中心"
  }));
  const byRequest = new Map();
  [...directItems, ...ownerItems].forEach((item) => {
    const requestId = item?.requestId || item?.id;
    if (!requestId) return;
    const existing = byRequest.get(requestId);
    const itemScore = item?.reportContext ? 2 : item?.fixedContextRef ? 1 : 0;
    const existingScore = existing?.reportContext ? 2 : existing?.fixedContextRef ? 1 : 0;
    if (!existing || itemScore > existingScore) byRequest.set(requestId, { ...item, requestId });
  });
  return [...byRequest.values()].sort((left, right) => String(left.receivedAt || "").localeCompare(String(right.receivedAt || "")));
}

function c024Identity(candidate) {
  candidate = candidate || {};
  const context = candidate?.reportContext || {};
  const scenario = context.scenarioContext || context.c033 || {};
  const evidencePack = context.evidencePack || {};
  const semantic = context.semanticBinding || {};
  return {
    scenarioId: scenario.scenarioId || context.scenarioId || candidate.scenarioId || null,
    scenarioVersion: scenario.scenarioVersion || context.scenarioVersion || candidate.scenarioVersion || null,
    scenarioRunId: scenario.scenarioRunId || context.scenarioRunId || candidate.scenarioRunId || null,
    scenarioFormedAt: scenario.formedAt || context.scenarioFormedAt || candidate.scenarioFormedAt || null,
    scenarioStatus: scenario.status || context.scenarioStatus || candidate.scenarioStatus || null,
    reportNumber: context.reportNumber || context.reportId || candidate.reportNumber || null,
    contentVersion: context.contentVersion || candidate.reportContentVersion || candidate.contentVersion || null,
    evidencePackageId: evidencePack.id || context.evidencePackId || candidate.evidencePackId || null,
    evidencePackageVersion: evidencePack.version || context.evidencePackVersion || candidate.evidencePackVersion || null,
    semanticVersionId: semantic.semanticVersionId || context.semanticVersionId || candidate.semanticVersionId || null,
    semanticVersion: semantic.semanticVersion || context.semanticVersion || candidate.semanticVersion || null,
    dataAssetVersionId: semantic.dataAssetVersionId || context.dataAssetVersionId || candidate.dataAssetVersionId || null,
    dataVersion: semantic.dataVersion || context.dataVersion || candidate.dataVersion || null,
    consumableVersionId: semantic.consumableVersionId || context.consumableVersionId || candidate.consumableVersionId || null,
    dataAsOf: semantic.asOf || context.asOf || candidate.dataAsOf || null,
    anchorSnapshotId: context.anchorSnapshotId || candidate.anchorSnapshotId || null,
    anchorSnapshotVersion: context.anchorSnapshotVersion || candidate.anchorSnapshotVersion || null,
    selectedAnchor: context.selectedAnchor || candidate.selectedAnchor || null
  };
}

function c024Fingerprint(candidate) {
  return JSON.stringify({ requestId: candidate?.requestId, ...c024Identity(candidate) });
}

function c024Issues(candidate, activeScenarioContext = null) {
  const context = candidate?.reportContext || {};
  const identity = c024Identity(candidate);
  const candidateScenarioContext = scenarioIdentityContext(identity);
  const required = {
    requestId: candidate?.requestId,
    scenarioId: identity.scenarioId,
    scenarioVersion: identity.scenarioVersion,
    scenarioRunId: identity.scenarioRunId,
    scenarioFormedAt: identity.scenarioFormedAt,
    scenarioStatus: identity.scenarioStatus,
    reportNumber: identity.reportNumber,
    contentVersion: identity.contentVersion,
    evidencePackageId: identity.evidencePackageId,
    evidencePackageVersion: identity.evidencePackageVersion,
    semanticVersionId: identity.semanticVersionId,
    semanticVersion: identity.semanticVersion,
    dataAssetVersionId: identity.dataAssetVersionId,
    dataVersion: identity.dataVersion,
    consumableVersionId: identity.consumableVersionId,
    dataAsOf: identity.dataAsOf,
    anchorSnapshotId: identity.anchorSnapshotId,
    anchorSnapshotVersion: identity.anchorSnapshotVersion,
    selectedAnchor: identity.selectedAnchor,
    question: candidate?.question
  };
  const labels = {
    requestId: "请求标识", scenarioId: "场景标识", scenarioVersion: "场景版本", scenarioRunId: "场景轮次", scenarioFormedAt: "场景上下文形成时间", scenarioStatus: "场景状态", reportNumber: "报告编号", contentVersion: "内容版本", evidencePackageId: "证据包标识", evidencePackageVersion: "证据包版本", semanticVersionId: "语义版本标识", semanticVersion: "精确语义版本", dataAssetVersionId: "数据资产版本标识", dataVersion: "精确数据版本", consumableVersionId: "可消费版本标识", dataAsOf: "数据截至时间", anchorSnapshotId: "锚点快照标识", anchorSnapshotVersion: "锚点快照版本", selectedAnchor: "稳定锚点", question: "问题"
  };
  const issues = Object.entries(required).filter(([, value]) => value == null || String(value).trim() === "").map(([key]) => `缺少${labels[key]}`);
  if (!scenarioContextReady(candidateScenarioContext)) issues.push("请求未提供完整、已启用的 C033 场景运行上下文");
  if (identity.anchorSnapshotVersion && identity.contentVersion && identity.anchorSnapshotVersion !== identity.contentVersion) issues.push("锚点快照版本与报告内容版本不一致");
  if (candidate?.evidencePackId && identity.evidencePackageId && candidate.evidencePackId !== identity.evidencePackageId) issues.push("请求外层证据包标识与固定上下文不一致");
  if (candidate?.reportContentVersion && identity.contentVersion && candidate.reportContentVersion !== identity.contentVersion) issues.push("请求外层内容版本与固定上下文不一致");
  if (context.evidencePackId && identity.evidencePackageId && context.evidencePackId !== identity.evidencePackageId) issues.push("上下文证据包回指不一致");
  const fixed = candidate?.fixedContextRef || {};
  [["reportId", "reportNumber", "报告编号"], ["contentVersion", "contentVersion", "内容版本"], ["evidencePackId", "evidencePackageId", "证据包标识"], ["evidencePackVersion", "evidencePackageVersion", "证据包版本"], ["semanticVersionId", "semanticVersionId", "语义版本标识"], ["semanticVersion", "semanticVersion", "语义版本"], ["dataAssetVersionId", "dataAssetVersionId", "数据资产版本标识"], ["dataVersion", "dataVersion", "数据版本"]].forEach(([fixedKey, identityKey, label]) => {
    if (fixed[fixedKey] && identity[identityKey] && fixed[fixedKey] !== identity[identityKey]) issues.push(`${label}与来源固定引用不一致`);
  });
  if (!scenarioContextReady(activeScenarioContext)) issues.push("当前平台 C033 场景运行上下文缺失、未知或未启用");
  else if (!sameScenarioContext(candidateScenarioContext, activeScenarioContext)) issues.push("场景标识、版本、轮次、形成时间或状态与当前平台 C033 不一致");
  return [...new Set(issues)];
}

function displayFactValue(fact) {
  if (fact?.displayValue != null) return String(fact.displayValue);
  if (fact?.value == null) return "未提供可解释值";
  return `${typeof fact.value === "object" ? JSON.stringify(fact.value) : fact.value}${fact.unit ? ` ${fact.unit}` : ""}`;
}

function evidenceFromC024(candidate, receivedAt = nowText()) {
  const context = candidate.reportContext;
  const identity = c024Identity(candidate);
  const trust = context.trustAtGeneration || context.dataTrustAtGeneration || {};
  const comparisonReference = context.comparisonReference || null;
  const explicitComparison = context.comparisonMode === "explicit" && Boolean(comparisonReference?.recordId);
  const permission = context.permission || {};
  const denied = ["denied", "blocked", "拒绝", "无权限"].includes(normalizeStatus(permission.status));
  const hardQualityFailure = /hard|失败|不可消费|blocked/.test(normalizeStatus(trust.status || trust.quality || trust.publishedQuality || trust.readiness));
  const allowed = !denied && !hardQualityFailure;
  const internalEvidenceId = `${identity.evidencePackageId}@${identity.evidencePackageVersion}`;
  const reportName = context.reportName || identity.reportNumber;
  const currentSummaryId = comparisonReference?.currentStatusSummaryRef?.id || trust.currentStatusSummaryId || trust.summaryId || trust.id || `C017-${identity.evidencePackageId}`;
  const currentSummaryVersion = comparisonReference?.currentStatusSummaryRef?.version || trust.currentStatusSummaryVersion || trust.version || "来源未提供独立版本";
  return {
    id: internalEvidenceId,
    evidencePackageId: identity.evidencePackageId,
    evidencePackageVersion: identity.evidencePackageVersion,
    name: `${reportName}固定证据上下文`,
    kind: "report",
    currentProjection: true,
    projectionStatus: "current",
    status: allowed ? "ready" : denied ? "permission" : "quality-blocked",
    statusLabel: allowed ? "可用于当前报告上下文" : denied ? "权限不足" : "当前不可消费",
    dataVersion: identity.dataVersion,
    dataAssetVersionId: identity.dataAssetVersionId,
    consumableVersionId: identity.consumableVersionId,
    dataAsOf: identity.dataAsOf,
    ontologyVersion: identity.semanticVersion,
    semanticVersionId: identity.semanticVersionId,
    quality: trust.publishedQuality || trust.quality || trust.status || "来源未提供质量结论",
    freshness: trust.freshness || "来源未提供新鲜度结论",
    authority: "报告中心 C024 固定上下文中的 C008/T019 与 C017 只读引用",
    formedAt: context.evidencePack?.fixedAt || receivedAt,
    previousId: null,
    scenarioContext: {
      scenarioId: identity.scenarioId,
      scenarioVersion: identity.scenarioVersion,
      scenarioRunId: identity.scenarioRunId,
      formedAt: identity.scenarioFormedAt,
      status: identity.scenarioStatus
    },
    requestContext: {
      id: candidate.requestId,
      version: context.contextVersion || "1.0",
      sourceOwner: "报告中心",
      scenarioId: identity.scenarioId,
      scenarioVersion: identity.scenarioVersion,
      scenarioRunId: identity.scenarioRunId,
      scenarioFormedAt: identity.scenarioFormedAt,
      scenarioStatus: identity.scenarioStatus,
      scenarioLabel: context.scenarioLabel || identity.scenarioId,
      requestedAt: candidate.receivedAt || receivedAt,
      objectScope: `${identity.reportNumber} / ${identity.contentVersion} / ${identity.selectedAnchor}`,
      expectedOutput: "Report Copilot Answer v1"
    },
    credibility: {
      contract: "C017 报告固定上下文安全投影",
      contextStatus: "report-snapshot",
      lastReadAt: receivedAt,
      externalAuthority: { owner: "数据工程", sourceReference: currentSummaryId, publishedAt: trust.formedAt || receivedAt, receivedAt },
      versionBindingSummary: {
        id: trust.bindingSummaryId || trust.versionBindingSummaryId || `C017-BIND-${identity.evidencePackageId}`,
        version: trust.bindingSummaryVersion || trust.version || "来源未提供独立版本",
        status: allowed ? "ready" : "blocked",
        label: "报告生成时版本绑定",
        formedAt: context.evidencePack?.fixedAt || receivedAt,
        observedAt: context.evidencePack?.fixedAt || receivedAt,
        t006: context.evidencePack?.factPackageId || "报告固定事实包",
        t007: identity.dataVersion,
        t008: identity.dataAsOf,
        t008Source: "报告中心 C024 固定上下文",
        ontology: identity.semanticVersion,
        binding: `${identity.reportNumber} / ${identity.contentVersion} / ${identity.evidencePackageId} ${identity.evidencePackageVersion}`,
        reason: "只固定本次报告内容版本、证据包及精确语义/数据版本。"
      },
      currentStateSummary: {
        id: currentSummaryId,
        version: currentSummaryVersion,
        status: allowed ? "ready" : denied ? "permission" : "quality-blocked",
        label: allowed ? "固定报告上下文可用" : denied ? "固定范围权限不足" : "固定版本质量受限",
        observedAt: trust.formedAt || receivedAt,
        quality: trust.publishedQuality || trust.quality || trust.status || "未知",
        freshness: trust.freshness || "未知",
        factAge: trust.factAge || "来源未提供",
        freshnessThreshold: trust.freshnessThreshold || "来源未提供",
        freshnessThresholdOwner: trust.freshnessThresholdOwner || "来源未提供",
        applicableScope: `${identity.reportNumber} / ${identity.contentVersion}`,
        dataQualification: allowed ? "允许固定快照伴读" : "禁止新正式输出",
        refresh: trust.refresh || "报告快照不随刷新改写",
        useConclusion: allowed ? "仅允许在 C024 固定范围内解释。" : "保留身份和限制，不形成新的正式回答。"
      },
      ontologyAdoption: { status: allowed ? "ready" : "blocked", label: allowed ? "报告生成时已采用" : "当前不可证明可消费", ontology: identity.semanticVersion, dataVersion: identity.dataVersion, observedAt: context.evidencePack?.fixedAt || receivedAt, source: "C024 只读引用" },
      consumptionReadiness: { status: allowed ? "ready" : "blocked", label: allowed ? "可供报告伴读使用" : "不可用于新回答", allowedUse: "当前报告内容版本、稳定锚点和固定证据范围", observedAt: trust.formedAt || receivedAt, reason: denied ? "报告中心权限结果拒绝当前范围。" : hardQualityFailure ? "固定版本存在硬质量或不可消费结论。" : "固定身份和用途门完整。" },
      stableEvidence: { status: "complete", label: "固定身份可核对", refs: [identity.reportNumber, identity.contentVersion, identity.evidencePackageId, identity.evidencePackageVersion, identity.semanticVersion, identity.dataVersion], reason: "不包含工作簿、T007 明细或报告正文副本。" },
      postQuality: { status: hardQualityFailure ? "quality-blocked" : "complete", label: hardQualityFailure ? "固定版本质量受限" : "未登记硬质量失败", checkedAt: trust.formedAt || receivedAt, scope: identity.dataVersion, reason: hardQualityFailure ? "来源可信度摘要禁止新的正式用途。" : "仅复用 C024 所带数据侧结论。", recovery: hardQualityFailure ? "由上游形成新的合格报告上下文后重新交接；旧记录保持只读。" : "状态变化时重新由报告中心提交上下文。" },
      agentGates: [
        { id: "report-question", name: "报告快照问答", status: allowed ? "ready" : "blocked", label: allowed ? "允许" : "阻断", reason: allowed ? "C024 固定身份、权限和用途门完整。" : denied ? "报告中心权限结果拒绝当前范围。" : "固定数据版本不可用于新的正式回答。", recovery: "由报告中心修复同一 C024 身份或提交新的完整上下文；Agent 不改选版本。" },
        { id: "verification-explain", name: "解释确定性核验", status: allowed && context.verificationReference?.runId ? "ready" : "blocked", label: allowed && context.verificationReference?.runId ? "允许" : "缺少可解释结果", reason: context.verificationReference?.runId ? "只读解释报告中心确定性结果。" : "报告中心未提供 T049 结果引用。", recovery: "报告中心形成确定性核验结果后提交新的 C024。" },
        { id: "comparison-explain", name: "解释当前比较", status: allowed && explicitComparison ? "ready" : "blocked", label: allowed && explicitComparison ? "允许" : "缺少可解释记录", reason: explicitComparison ? "只读解释报告中心固定的 C027 比较记录，不重新计算。" : "当前 C024 未包含显式 C027 比较记录。", recovery: "由报告中心先完成当前数据比较，再提交包含精确记录引用的新 C024。" }
      ],
      historyDimensions: [
        { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "C024 提供报告、证据、语义和数据精确身份。", checkedAt: receivedAt, recovery: "身份不可定位时拒绝新运行。" },
        { id: "content-access", name: "内容访问", status: allowed ? "available" : "limited", label: allowed ? "可访问安全投影" : "当前受限", reason: "仅访问固定结构化事实和证据引用，不复制报告正文。", checkedAt: receivedAt, recovery: "由报告中心修复权限或证据后新建交接。" },
        { id: "evidence-completeness", name: "证据完整", status: (context.contentFacts || []).length ? "complete" : "limited", label: (context.contentFacts || []).length ? "结构化证据已提供" : "未提供可解释事实", reason: "Agent 不从工作簿或 T007 明细补齐。", checkedAt: receivedAt, recovery: "报告中心补充固定事实引用后重新交接。" },
        { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "依赖不足", reason: "C024 不授权数据侧重放。", checkedAt: receivedAt, recovery: "由数据工程另行提供权威重放条件。" },
        { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "未收到真实重放记录。", checkedAt: receivedAt, recovery: "真实重放完成后才可更新。" }
      ],
      useFlags: { isCurrentAuthoritative: false, canStartNewRun: allowed, canConfirmNewResult: false, canPrepareActionRequest: false, historyDisclosureRequired: true, immutableReportFactRoot: true }
    },
    externalCredibilityFeed: null,
    report: {
      number: identity.reportNumber,
      name: reportName,
      contentVersion: identity.contentVersion,
      anchor: identity.selectedAnchor,
      anchorSnapshotId: identity.anchorSnapshotId,
      anchorSnapshotVersion: identity.anchorSnapshotVersion,
      scope: context.contextIntent || "报告固定上下文",
      question: candidate.question,
      verification: context.verificationReference?.runId ? "已提供确定性核验结果引用" : "报告中心未提供确定性核验结果引用",
      verificationRunRef: context.verificationReference?.runId || null,
      comparisonReference: deepClone(comparisonReference),
      comparisonMode: context.comparisonMode || "snapshot-only",
      contextIntent: context.contextIntent || "report-qa-fixed"
    },
    items: (context.contentFacts || []).map((fact, index) => ({
      id: fact.id || fact.contentFactId || `report-fact-${index + 1}`,
      factId: fact.factId || fact.sourceFactId || fact.id || null,
      type: fact.kind || fact.semanticResourceType || "结构化事实",
      name: fact.label || fact.name || fact.id || `证据项 ${index + 1}`,
      value: displayFactValue(fact),
      object: fact.scope || `${identity.reportNumber} / ${identity.contentVersion}`,
      source: `报告固定证据引用 ${(fact.evidenceRefs || fact.evidence || []).join("、") || "未提供稳定引用"}`
    }))
  };
}

function nextRelease(version) {
  const parts = String(version || "1.0").split(".").map(Number);
  return `${parts[0] || 1}.${(parts[1] || 0) + 1}`;
}

function listPromptResources(dynamic = []) {
  const resources = new Map(window.AGENT_PROMPTS.map((resource) => [resource.id, { ...resource, versions: [...resource.versions] }]));
  [...dynamic].reverse().forEach((entry) => {
    const existing = resources.get(entry.id);
    const versions = [entry.value, ...(existing?.versions || []).filter((version) => version.version !== entry.value.version)];
    resources.set(entry.id, {
      id: entry.id,
      name: entry.name || existing?.name || entry.id,
      owner: existing?.owner || "Agent 应用",
      versions
    });
  });
  return [...resources.values()];
}

function draftConfigurationFingerprint(draft) {
  return JSON.stringify({
    type: draft.type,
    proposedRelease: draft.proposedRelease,
    goal: draft.goal,
    purpose: draft.purpose,
    inputContract: draft.inputContract,
    outputContract: draft.outputContract,
    promptId: draft.prompt.id,
    promptContent: draft.promptContent,
    skills: [...draft.skills].sort((a, b) => `${a.id}:${a.version}`.localeCompare(`${b.id}:${b.version}`)),
    tools: [...draft.tools].sort(),
    ontology: draft.ontology,
    ontologyScope: draft.ontologyScope,
    scenarioBinding: draft.scenarioBinding
  });
}

function draftPublishIssue(draft, state) {
  if (!draft) return "配置草稿已不存在，请返回草稿目录刷新状态。";
  if (!draft.scenario?.trim() || draft.scenario === "待引用场景清单") return "尚未引用平台场景清单中的适用场景，不能发布 Agent Release。";
  const fingerprint = draftConfigurationFingerprint(draft);
  if (draft.validation?.status !== "validated" || draft.validation?.fingerprint !== fingerprint) return "当前配置与最近一次验证不一致，请重新调试并验证。";
  if (!draft.debugRuns?.some((run) => run.status === "complete" && run.snapshot.configFingerprint === fingerprint)) return "缺少与当前配置完全一致的成功调试，请重新调试并验证。";
  const existingAgent = state.agents.find((agent) => agent.id === draft.agentId);
  if (existingAgent?.releases.some((release) => release.version === draft.proposedRelease)) return `Agent Release ${draft.proposedRelease} 已存在，请调整目标版本并重新验证。`;
  if (getPrompt(draft.prompt.id, null, state.resourceReleases?.prompts || []).versions.some((version) => version.version === draft.proposedRelease)) return `Prompt 版本 ${draft.proposedRelease} 已存在，请调整目标版本并重新验证。`;
  return null;
}

function evidenceFromSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    id: snapshot.evidenceId,
    evidencePackageId: snapshot.evidencePackageId,
    evidencePackageVersion: snapshot.evidencePackageVersion,
    name: snapshot.evidenceName,
    status: snapshot.evidenceStatus,
    statusLabel: snapshot.evidenceStatus === "ready" ? "运行时可用" : "运行时受限",
    dataVersion: snapshot.dataVersion,
    dataAssetVersionId: snapshot.dataAssetVersionId,
    consumableVersionId: snapshot.consumableVersionId,
    dataAsOf: snapshot.dataAsOf,
    ontologyVersion: snapshot.ontologyVersion,
    semanticVersionId: snapshot.semanticVersionId,
    quality: snapshot.quality,
    freshness: snapshot.freshness,
    authority: snapshot.evidenceAuthority,
    formedAt: snapshot.evidenceFormedAt,
    previousId: snapshot.evidencePreviousId,
    requestContext: deepClone(snapshot.requestContext),
    scenarioContext: {
      scenarioId: snapshot.scenarioId,
      scenarioVersion: snapshot.scenarioVersion,
      scenarioRunId: snapshot.scenarioRunId
    },
    credibility: deepClone(snapshot.credibility),
    report: deepClone(snapshot.report),
    generation: deepClone(snapshot.reportGeneration),
    items: deepClone(snapshot.evidenceItems || [])
  };
}

function credibilityGate(credibility, purpose = "newInsight") {
  const purposeMap = {
    newInsight: "new-run",
    confirmInsight: "confirm-result",
    reportQuestion: "report-question",
    confirmReportAnswer: "report-question",
    reportVerification: "report-verification",
    reportDraft: "report-draft-transfer",
    actionRequest: "action-request"
  };
  const gate = credibility?.agentGates?.find((item) => item.id === purposeMap[purpose]);
  if (!credibility) return { allowed: false, status: "unknown", reason: "C017 可信度上下文缺失。", recovery: "重新读取当前状态摘要；字段仍不完整时阻断正式用途。" };
  if (!gate) return { allowed: false, status: "unknown", reason: "当前摘要未提供该用途的 Agent 门禁判断输入。", recovery: "重新读取 C017 并由 Agent 应用重新判断用途门。" };
  return { ...gate, allowed: ["allowed", "ready", "warning"].includes(gate.status) };
}

function currentCredibilityForRun(run, packages) {
  return packages.find((item) => item.id === run?.snapshot?.evidenceId)?.credibility || null;
}

function credibilityChanged(run, credibility) {
  const fixed = run?.snapshot?.credibility?.currentStateSummary;
  const current = credibility?.currentStateSummary;
  return Boolean(fixed && current && (fixed.id !== current.id || fixed.version !== current.version));
}

function usesReportContextOntology(agentOrDraft) {
  return ["报告伴读 Agent", "报告核验 Agent"].includes(agentOrDraft?.type)
    && ["由报告固定上下文提供精确 Published 版本", "由报告自动核验请求提供精确 Published 版本"].includes(agentOrDraft?.ontology);
}

function reportContextVersionIssue(agentOrDraft, evidence, request = null) {
  if (!usesReportContextOntology(agentOrDraft)) return null;
  if (!evidence?.report || !evidence?.ontologyVersion || !evidence?.semanticVersionId) return "报告固定上下文缺少精确的已发布语义版本标识或版本。";
  if (evidence.credibility?.versionBindingSummary?.ontology !== evidence.ontologyVersion) return "报告证据包与 C017 版本绑定摘要中的已发布语义版本不一致。";
  if (request && (request.reportNumber !== evidence.report.number || request.contentVersion !== evidence.report.contentVersion || request.evidencePackageId !== evidence.evidencePackageId || request.evidencePackageVersion !== evidence.evidencePackageVersion || request.semanticVersionId !== evidence.semanticVersionId || request.dataAssetVersionId !== evidence.dataAssetVersionId || request.consumableVersionId !== evidence.consumableVersionId || request.anchor !== evidence.report.anchor)) return "报告请求与固定证据包的报告、内容、证据、语义、数据、可消费版本或稳定锚点不一致。";
  return null;
}

function generationContextVersionIssue(agentOrDraft, evidence, request = null) {
  if (agentOrDraft?.type !== "报告草稿 Agent") return null;
  const generation = evidence?.generation;
  const identity = generation?.identity || {};
  if (!request || request.type !== "report-draft" || !generation) return "报告草稿生成缺少报告中心 C022 请求或固定生成上下文。";
  if (!identity.semanticVersionId || !identity.semanticVersion || !identity.dataAssetVersionId || !identity.dataVersion || !identity.consumableVersionId || !identity.dataAsOf) return "报告生成上下文缺少精确的已发布语义、可消费数据版本或截至时间。";
  if (request.reportAggregateId !== identity.aggregateId || request.evidencePackageId !== identity.evidencePackageId || request.evidencePackageVersion !== identity.evidencePackageVersion || request.semanticVersionId !== identity.semanticVersionId || request.semanticVersion !== identity.semanticVersion || request.dataAssetVersionId !== identity.dataAssetVersionId || request.dataVersion !== identity.dataVersion || request.consumableVersionId !== identity.consumableVersionId || request.dataAsOf !== identity.dataAsOf) return "C022 请求与固定证据包的报告根、证据、语义或数据身份不一致。";
  return null;
}

function scenarioBindingFromScenario(scenario, type, previous = null) {
  if (type === "报告草稿 Agent" || scenario === "报告生成上下文按请求绑定") {
    return {
      id: "AG-SB-REPORT-GENERATION",
      version: previous?.id === "AG-SB-REPORT-GENERATION" ? previous.version : "1.0",
      mode: "request-context",
      scenarioId: null,
      scenarioLabel: "由报告中心 C022 固定上下文继承",
      objectScope: null,
      status: "ready"
    };
  }
  if (type === "报告核验 Agent" || scenario === "报告核验上下文按请求绑定") {
    return {
      id: "AG-SB-REPORT-VERIFICATION",
      version: previous?.id === "AG-SB-REPORT-VERIFICATION" ? previous.version : "1.0",
      mode: "request-context",
      scenarioId: null,
      scenarioLabel: "由报告中心自动核验请求继承",
      objectScope: null,
      status: "ready"
    };
  }
  if (type === "报告伴读 Agent" || scenario === "报告上下文按请求绑定") {
    return {
      id: "AG-SB-REPORT-CONTEXT",
      version: previous?.id === "AG-SB-REPORT-CONTEXT" ? previous.version : "1.0",
      mode: "request-context",
      scenarioId: null,
      scenarioLabel: "由报告中心固定上下文继承",
      objectScope: null,
      status: "ready"
    };
  }
  if (scenario?.startsWith("S001")) {
    return {
      id: "AG-SB-S001-FINANCE",
      version: previous?.id === "AG-SB-S001-FINANCE" ? previous.version : "1.0",
      mode: "fixed",
      scenarioId: "S001",
      scenarioLabel: "S001 · 集团融资成本与债务结构优化",
      objectScope: "集团合并范围融资指标、Rule 命中主体与获准 Action Type",
      status: "ready"
    };
  }
  if (scenario?.startsWith("S004")) {
    return {
      id: "AG-SB-S004-REPORT-DRAFT",
      version: previous?.id === "AG-SB-S004-REPORT-DRAFT" ? previous.version : "1.0",
      mode: "fixed",
      scenarioId: "S004",
      scenarioLabel: "S004 · 待业务资料",
      objectScope: null,
      status: "waiting"
    };
  }
  return {
    id: null,
    version: null,
    mode: "fixed",
    scenarioId: null,
    scenarioLabel: scenario || "待引用场景清单",
    objectScope: null,
    status: "waiting"
  };
}

function scenarioBindingLabel(release, fallback = "未固定") {
  return release?.scenarioBinding?.scenarioLabel || fallback;
}

function scenarioReferenceLabel(scenarioId, scenarioLabel) {
  const label = scenarioLabel || "未提供";
  if (!scenarioId || label === scenarioId || label.startsWith(`${scenarioId} ·`)) return label;
  return `${scenarioId} · ${label}`;
}

function requestContextsMatch(left, right) {
  if (!left || !right) return false;
  return ["id", "version", "sourceOwner", "scenarioId", "scenarioVersion", "scenarioRunId", "scenarioFormedAt", "scenarioStatus", "requestedAt", "objectScope", "expectedOutput"].every((field) => left[field] === right[field]);
}

function requestContextIssue(release, evidence, request = null, requireInboundRequest = true) {
  const binding = release?.scenarioBinding;
  const context = evidence?.requestContext;
  const requiredBinding = ["id", "version", "mode", "status"];
  const requiredContext = ["id", "version", "sourceOwner", "requestedAt", "objectScope", "expectedOutput"];
  if (!binding || requiredBinding.some((field) => !binding[field])) return { mode: "missing", reason: "Agent Release 缺少完整的不可变场景绑定。" };
  if (binding.status !== "ready") return { mode: "version", reason: "Agent Release 的场景绑定尚未就绪。" };
  if (!context || requiredContext.some((field) => !context[field])) return { mode: "missing", reason: "固定证据包缺少发起方、场景、请求时间、对象范围或期望输出合同。" };
  if (context.expectedOutput !== release.outputContract) return { mode: "version", reason: `证据请求期望 ${context.expectedOutput}，与 Agent Release 输出 ${release.outputContract} 不一致。` };
  if (binding.mode === "fixed") {
    if (!binding.scenarioId || !binding.objectScope) return { mode: "missing", reason: "固定场景绑定缺少场景标识或目标对象范围。" };
    if (context.scenarioId !== binding.scenarioId) return { mode: "version", reason: `Agent Release 绑定 ${binding.scenarioId}，证据请求绑定 ${context.scenarioId || "未提供场景"}。` };
    if (context.objectScope !== binding.objectScope) return { mode: "version", reason: "证据请求的目标对象范围超出或不同于 Agent Release 固定范围。" };
  }
  if (binding.mode === "request-context") {
    if (requireInboundRequest && !request) return { mode: "missing", reason: "请求上下文型 Agent 必须由外部业务请求提供固定上下文。" };
    if (request) {
      const requestContext = request.requestContext;
      if (!requestContext) return { mode: "missing", reason: "外部业务请求缺少固定请求上下文。" };
      if (!requestContextsMatch(requestContext, context)) return { mode: "version", reason: "外部业务请求与证据包的上下文标识、版本、场景、对象范围或期望输出不一致。" };
      const identityIssues = request.type === "report-draft"
        ? c022Issues(request.c022, evidence.scenarioContext)
        : c024Issues(request.c024, evidence.scenarioContext);
      if (identityIssues.length) return request.type === "report-draft"
        ? { mode: "version", reason: `报告生成上下文身份不完整或不一致：${identityIssues.join("；")}`, recovery: "由报告中心按同一 C033 场景轮次和同一报告根、证据、语义、数据版本重新提交 C022；Agent 不改选或补造版本。" }
        : { mode: "version", reason: `报告固定上下文身份不完整或不一致：${identityIssues.join("；")}`, recovery: "由报告中心按同一 C033 场景轮次和同一报告、证据、语义、数据版本重新提交 C024；Agent 不改选或补造版本。" };
    }
  }
  return null;
}

function evidenceItemByName(items, name) {
  return (items || []).find((item) => item.name === name) || null;
}

function externalFactAge(snapshot, fallbackCurrent) {
  return snapshot?.dataSidePayload?.factAge || fallbackCurrent?.factAge || "上游未提供，按未知处理";
}

function projectExternalCredibilitySnapshot(evidence, scenarioId, observedAt, sequence) {
  const original = window.AGENT_APP_INITIAL_STATE.evidencePackages.find((item) => item.id === evidence.id) || evidence;
  const next = deepClone(evidence);
  const base = deepClone(original.credibility || evidence.credibility);
  if (!base) return next;
  next.credibility = base;
  const credibility = next.credibility;
  const current = credibility.currentStateSummary;
  current.id = `${evidence.id}-current-summary`;
  current.version = `${sequence}.0`;
  current.observedAt = observedAt;
  current.factAge = externalFactAge({ dataSidePayload: { factAge: null } }, current);
  current.freshnessThreshold = current.freshnessThreshold || "上游业务规则未提供标识";
  current.freshnessThresholdOwner = current.freshnessThresholdOwner || "业务责任人未提供";
  current.applicableScope = current.applicableScope || "当前固定证据包范围";
  current.dataQualification = current.dataQualification || "无法判断";
  credibility.contextStatus = scenarioId;
  credibility.refresh.observedAt = observedAt;
  credibility.postQuality.checkedAt = observedAt;
  credibility.currentComparison = credibility.currentComparison || {
    status: "not-run",
    label: "未执行当前比较",
    comparedAt: null,
    basedOnSummaryVersion: null,
    reason: "只有用户显式发起与当前数据比较后才形成比较结果。",
    recovery: "发起显式比较；不得把打开历史页面当作已比较。"
  };
  const applicableGateIds = next.kind === "report"
    ? new Set(["report-question", "verification-explain"])
    : new Set(["new-run", "confirm-result", "action-request"]);
  const setGate = (allowed, reason, recovery) => {
    credibility.agentGates = credibility.agentGates.map((gate) => ({
      ...gate,
      ...(applicableGateIds.has(gate.id) ? {
        status: allowed ? "allowed" : "blocked",
        label: allowed ? (scenarioId.includes("allowed") ? "允许，需展示警告" : "允许") : "阻断",
        reason,
        recovery
      } : {})
    }));
    credibility.useFlags.canStartNewRun = allowed;
    credibility.useFlags.canConfirmNewResult = allowed;
    credibility.useFlags.canPrepareActionRequest = next.kind === "report" ? false : allowed;
  };
  const allowReason = "当前权威组合仍具备数据侧资格；Agent 应用按具体用途决定是否继续并展示限制。";
  const allowRecovery = "在正式操作前重新读取当前状态摘要；状态变化时创建新运行。";
  const blockRecovery = "等待数据侧恢复资格和本体受控采用后重新读取摘要，并创建新运行；不得自行选择上一版本。";

  if (scenarioId === "normal") {
    credibility.contextStatus = "normal";
    current.status = "ready";
    current.label = "当前权威输入";
    current.quality = "通过固定证据门";
    current.freshness = "新鲜";
    current.dataQualification = "允许";
    current.refresh = "无待切换刷新";
    current.useConclusion = "可在本次固定范围内进入 Agent 用途判断。";
    credibility.postQuality = { status: "complete", label: "未发现新增硬质量问题", checkedAt: observedAt, scope: next.dataVersion, reason: "当前状态摘要未登记事后硬质量失败。", recovery: "后续摘要变化时重新判断用途门。" };
    setGate(true, allowReason, allowRecovery);
  }

  if (scenarioId === "refreshing") {
    current.status = "ready";
    current.label = "当前组合继续服务";
    current.refresh = "较新候选刷新中";
    current.useConclusion = "候选不得混入本次输入；当前权威组合可继续服务。";
    current.dataQualification = "允许；候选不参与";
    credibility.refresh = { ...credibility.refresh, status: "running", label: "候选刷新中", observedAt, requestState: "处理中", resultState: "尚未形成候选结果", recovery: "等待候选形成质量与采用结论；当前组合保持不变。" };
    credibility.identities.candidate = { ...credibility.identities.candidate, status: "running", label: "刷新中", reason: "尚未具备消费资格。" };
    setGate(true, allowReason, allowRecovery);
  }

  if (scenarioId === "candidate-failed") {
    current.status = "ready";
    current.label = "当前组合继续服务";
    current.refresh = "候选刷新失败";
    current.useConclusion = "候选失败不影响未受损的当前权威组合；不得混入候选内容。";
    current.dataQualification = "允许；候选禁止";
    credibility.refresh = { ...credibility.refresh, status: "failed", label: "候选刷新失败", observedAt, requestState: "已结束", resultState: "候选失败，未采用", recovery: "修复候选链路后形成新候选；当前组合继续服务。" };
    credibility.identities.candidate = { ...credibility.identities.candidate, status: "failed", label: "候选失败", reason: "未进入权威消费组合。" };
    setGate(true, allowReason, allowRecovery);
  }

  if (scenarioId === "warning-allowed") {
    current.status = "warning";
    current.label = "质量警告，允许使用";
    current.quality = "存在范围级质量警告";
    current.useConclusion = "数据侧资格为允许并携带警告；Agent 用途门允许，但必须展示影响范围。";
    current.dataQualification = "带警告允许";
    credibility.postQuality = { status: "warning", label: "质量警告", checkedAt: observedAt, scope: "部分融资主体属性", reason: "警告不影响本次固定指标和 Rule 证据范围。", recovery: "展示警告和影响范围；状态升级为硬失败时立即阻断后续正式用途。" };
    setGate(true, "数据侧允许使用但存在范围级警告；本次输出必须携带限制。", allowRecovery);
  }

  if (scenarioId === "stale-allowed") {
    current.status = "stale";
    current.label = "数据陈旧，允许使用";
    current.freshness = "陈旧";
    current.useConclusion = "数据侧资格允许；Agent 用途门允许并强制展示事实年龄和限制。";
    current.dataQualification = "带新鲜度警告允许";
    credibility.postQuality = { ...credibility.postQuality, status: "warning", label: "新鲜度警告", checkedAt: observedAt, scope: next.dataVersion, reason: "事实年龄已越过当前阈值，但数据侧资格仍允许本用途。", recovery: "获取新权威组合；采用前继续显示陈旧限制。" };
    setGate(true, "当前数据已陈旧但数据侧仍允许使用；所有新输出需明确限制。", allowRecovery);
    credibility.agentGates = credibility.agentGates.map((gate) => gate.id === "action-request" ? {
      ...gate,
      status: "blocked",
      label: "陈旧输入不允许发起",
      reason: "本用途要求新鲜数据；陈旧输入仅可形成带限制的洞察，不得据此发起行动申请。",
      recovery: "等待新权威组合具备消费资格后创建新运行；不得用当前结果直接提交。"
    } : gate);
    credibility.useFlags.canPrepareActionRequest = false;
  }

  if (["readiness-waiting", "readiness-timeout"].includes(scenarioId)) {
    const timedOut = scenarioId === "readiness-timeout";
    current.status = timedOut ? "blocked" : "waiting";
    current.label = timedOut ? "消费就绪等待超时" : "等待消费就绪";
    current.dataQualification = "无法判断";
    current.useConclusion = timedOut ? "未在约定等待窗口内取得消费就绪证据，阻断新的正式用途。" : "消费就绪证据尚未形成，保持等待且不启动正式运行。";
    credibility.consumptionReadiness = {
      ...credibility.consumptionReadiness,
      status: timedOut ? "blocked" : "waiting",
      label: current.label,
      observedAt,
      reason: current.useConclusion,
      recovery: timedOut ? "重新读取同一权威组合的就绪状态；状态或输入变化后创建新运行。" : "等待上游形成消费就绪证据，或取消本次发起。"
    };
    setGate(false, current.useConclusion, credibility.consumptionReadiness.recovery);
  }

  if (["scope-failure", "version-failure", "no-safe-combination"].includes(scenarioId)) {
    const scopeFailure = scenarioId === "scope-failure";
    const noSafe = scenarioId === "no-safe-combination";
    const scope = scopeFailure ? "高成本融资指标与命中主体范围" : "整个精确数据版本";
    current.status = "quality-blocked";
    current.label = noSafe ? "当前不可用于新的正式输出" : scopeFailure ? "范围级硬质量失败" : "版本级硬质量失败";
    current.quality = current.label;
    current.dataQualification = "禁止";
    current.useConclusion = "阻断新的正式洞察、报告生成、结果确认和行动申请。";
    credibility.postQuality = { status: "quality-blocked", label: current.label, checkedAt: observedAt, scope, reason: noSafe ? "当前权威组合受损，且未提供可被本体受控采用的安全组合。" : `数据工程在新当前状态摘要中登记${scopeFailure ? "范围级" : "版本级"}硬失败。`, recovery: blockRecovery };
    credibility.consumptionReadiness = { ...credibility.consumptionReadiness, status: "blocked", label: "不可用于新的正式输出", observedAt, reason: credibility.postQuality.reason };
    if (noSafe) {
      credibility.identities.previousQualified = { ...credibility.identities.previousQualified, status: "unknown", label: "无安全组合", reason: "未提供具备采用资格的安全版本。" };
      credibility.identities.previousAuthoritative = { ...credibility.identities.previousAuthoritative, status: "unavailable", label: "不可作为自动回退", reason: "历史身份不等于当前具备消费资格。" };
    }
    setGate(false, credibility.postQuality.reason, blockRecovery);
  }

  if (scenarioId === "ontology-rollback") {
    current.status = "ready";
    current.label = "受控回退组合可供后续运行";
    current.refresh = "本体已正式采用兼容的上一可信组合";
    current.useConclusion = "仅后续新运行可采用受控回退组合；旧运行和旧结果不改写。";
    current.dataQualification = "允许后续新运行";
    credibility.ontologyAdoption = { ...credibility.ontologyAdoption, status: "ready", label: "已受控回退并正式采用", observedAt, source: "本体管理正式采用证据" };
    credibility.consumptionReadiness = { ...credibility.consumptionReadiness, status: "ready", label: "可供后续新运行", observedAt, reason: "受控回退组合已具备本体正式采用和消费就绪证据。" };
    credibility.agentGates = credibility.agentGates.map((gate) => {
      if (gate.id === "new-run") return { ...gate, status: "allowed", label: "允许后续新运行", reason: "受控回退组合已由权威责任方正式采用。", recovery: "使用该摘要创建新运行；不得覆盖旧运行快照。" };
      if (["confirm-result", "action-request"].includes(gate.id)) return { ...gate, status: "blocked", label: "仅影响后续新运行", reason: "受控回退不改变旧运行固定的输入与结果资格。", recovery: "以回退后摘要创建新运行，再基于新结果执行后续操作。" };
      return gate;
    });
    credibility.useFlags.canStartNewRun = true;
    credibility.useFlags.canConfirmNewResult = false;
    credibility.useFlags.canPrepareActionRequest = false;
  }

  const history = Object.fromEntries(credibility.historyDimensions.map((item) => [item.id, item]));
  if (scenarioId === "history-not-run") {
    history["replay-capability"] = { ...history["replay-capability"], status: "replay-ready", label: "具备重放条件", reason: "依赖条件已被权威摘要确认。", checkedAt: observedAt, recovery: "用户显式发起重放核验。" };
    history["replay-verification"] = { ...history["replay-verification"], status: "not-run", label: "未执行", reason: "尚无重放运行证据。", checkedAt: observedAt, recovery: "执行重放后再判断一致性。" };
  }
  if (scenarioId === "history-dependency") history["replay-capability"] = { ...history["replay-capability"], status: "dependency-missing", label: "依赖不足", reason: "至少一项权威依赖当前不可定位。", checkedAt: observedAt, recovery: "补齐依赖后重新核对，不把依赖不足写成不一致。" };
  if (scenarioId === "history-unavailable") history["content-access"] = { ...history["content-access"], status: "unavailable", label: "内容当前不可访问", reason: "版本仍可定位，但固定内容读取当前受限。", checkedAt: observedAt, recovery: "恢复内容访问后重新核对；保留历史结果正文。" };
  if (scenarioId === "history-unknown") history["replay-verification"] = { ...history["replay-verification"], status: "unknown", label: "无法判断", reason: "未取得足以判断重放是否执行及其结论的权威证据。", checkedAt: observedAt, recovery: "补齐重放运行标识、时间、范围和结论后重新核对。" };
  if (scenarioId === "replay-consistent") {
    history["replay-capability"] = { ...history["replay-capability"], status: "replay-ready", label: "具备重放条件", reason: "权威重放运行所需依赖完整且已被固定。", checkedAt: observedAt, recovery: "依赖变化时重新评估重放能力。" };
    history["replay-verification"] = { ...history["replay-verification"], status: "consistent", label: "重放一致", reason: "权威重放核验已执行且结果一致；运行引用：DE-REPLAY-001。", checkedAt: observedAt, recovery: "保留核验运行引用；依赖变化后重新执行。" };
  }
  if (scenarioId === "replay-inconsistent") {
    history["replay-capability"] = { ...history["replay-capability"], status: "replay-ready", label: "具备重放条件", reason: "权威重放运行所需依赖完整且已被固定。", checkedAt: observedAt, recovery: "依赖变化时重新评估重放能力。" };
    history["replay-verification"] = { ...history["replay-verification"], status: "inconsistent", label: "重放不一致", reason: "权威重放核验已执行并发现差异；运行引用：DE-REPLAY-002。", checkedAt: observedAt, recovery: "保留差异证据并阻断将历史内容宣称为已复现。" };
  }
  credibility.historyDimensions = Object.values(history);

  return next;
}

function externalCredibilityFeedFor(evidence) {
  const initialEvidence = window.AGENT_APP_INITIAL_STATE.evidencePackages.find((item) => item.id === evidence?.id);
  return deepClone(evidence?.externalCredibilityFeed || initialEvidence?.externalCredibilityFeed || null);
}

function externalFeedCursor(evidence, feed) {
  const currentVersion = evidence?.credibility?.currentStateSummary?.version;
  const matchedIndex = feed?.timeline?.findIndex((entry) => entry.summaryVersion === currentVersion) ?? -1;
  return Math.max(Number(feed?.cursor) || 0, matchedIndex);
}

function normalizeExternalHistory(dimensions, observedAt, scenarioId) {
  return (dimensions || []).map((item) => {
    const next = {
      ...item,
      status: item.status || "unknown",
      label: item.label || "无法判断",
      reason: item.reason || "外部摘要未提供该维度的判断原因。",
      checkedAt: item.checkedAt || observedAt,
      recovery: item.recovery || "补齐权威状态后重新核对。"
    };
    const replayConcluded = ["replay-consistent", "replay-inconsistent"].includes(scenarioId);
    if (next.id === "replay-verification" && !replayConcluded && !["consistent", "inconsistent"].includes(next.status)) {
      if (next.status === "unknown") return next;
      return {
        ...next,
        status: "not-run",
        label: "未执行",
        reason: "当前外部摘要没有已执行重放的权威记录，不能据此宣称一致。",
        recovery: "只有真实重放运行完成并返回结论后，才可更新为一致或不一致。"
      };
    }
    return next;
  });
}

function applyExternalCredibilitySnapshot(evidence, feed, snapshot, snapshotIndex, readAt) {
  const next = projectExternalCredibilitySnapshot(evidence, snapshot.profile, snapshot.observedAt, snapshot.sequence);
  const current = next.credibility.currentStateSummary;
  current.id = snapshot.summaryId;
  current.version = snapshot.summaryVersion;
  current.observedAt = snapshot.observedAt;
  current.sourceOwner = snapshot.owner || feed.owner;
  current.sourceReference = snapshot.sourceReference;
  current.factAge = externalFactAge(snapshot, current);
  if (snapshot.dataSidePayload) {
    Object.assign(current, deepClone(snapshot.dataSidePayload.currentStateSummary || {}));
    if (snapshot.dataSidePayload.refresh) next.credibility.refresh = deepClone(snapshot.dataSidePayload.refresh);
    if (snapshot.dataSidePayload.postQuality) next.credibility.postQuality = deepClone(snapshot.dataSidePayload.postQuality);
    if (snapshot.dataSidePayload.consumptionReadiness) next.credibility.consumptionReadiness = deepClone(snapshot.dataSidePayload.consumptionReadiness);
    if (snapshot.dataSidePayload.identities) next.credibility.identities = deepClone(snapshot.dataSidePayload.identities);
    if (snapshot.dataSidePayload.historyDimensions) next.credibility.historyDimensions = deepClone(snapshot.dataSidePayload.historyDimensions);
  }
  if (snapshot.adoptedCombination) {
    const adopted = snapshot.adoptedCombination;
    const fixedBinding = next.credibility.versionBindingSummary;
    current.activeDataAsset = adopted.dataAsset;
    current.activeDataVersion = adopted.dataVersion;
    current.activeDataAsOf = adopted.dataAsOf;
    next.credibility.identities.current = {
      role: "当前已采用组合",
      status: "ready",
      label: "受控回退后服务",
      t006: adopted.dataAsset,
      t007: adopted.dataVersion,
      t008: adopted.dataAsOf,
      reason: "本体管理已正式采用该精确组合；它只用于后续新运行，不改写本证据包固定的原版本。"
    };
    next.credibility.identities.previousQualified = {
      role: "上一具备采用资格",
      status: "unknown",
      label: "未提供其他安全组合",
      t006: adopted.dataAsset,
      t007: null,
      t008: null,
      reason: "当前安全投影只证明受控回退组合可用，不推断其他历史版本仍具备采用资格。"
    };
    next.credibility.identities.previousAuthoritative = {
      role: "上一权威服务",
      status: "quality-blocked",
      label: "已退出服务",
      t006: fixedBinding?.t006,
      t007: fixedBinding?.t007,
      t008: fixedBinding?.t008,
      reason: "这是本证据包和旧运行固定的原权威组合；事后硬质量失败后仅保留追溯，不再用于新的正式输出。"
    };
    next.credibility.refresh = {
      status: "ready",
      label: "已受控回退",
      observedAt: snapshot.observedAt,
      requestState: "权威采用已完成",
      resultState: `${adopted.dataVersion} 正在服务`,
      recovery: "后续变化由上游形成新的权威摘要；Agent 应用只重新读取，不自行切换版本。"
    };
    next.credibility.postQuality = {
      status: "warning",
      label: "原组合受限，回退组合可用",
      checkedAt: snapshot.observedAt,
      scope: `${fixedBinding?.t007 || "原固定组合"} / ${adopted.dataVersion}`,
      reason: "原固定组合保留事后硬质量失败事实；当前已采用组合未登记同一硬失败，仅允许后续新运行。",
      recovery: "按已采用组合创建新证据包和新运行；旧结果继续保留并显示可信度变化。"
    };
    next.credibility.ontologyAdoption = {
      ...next.credibility.ontologyAdoption,
      status: "ready",
      label: "已受控回退并正式采用",
      ontology: adopted.ontologyVersion,
      dataVersion: adopted.dataVersion,
      observedAt: snapshot.observedAt,
      source: adopted.adoptionReference,
      recovery: "后续状态变化时重新读取当前摘要；旧运行和原证据绑定保持不变。"
    };
    next.credibility.consumptionReadiness = {
      ...next.credibility.consumptionReadiness,
      status: "ready",
      label: "回退组合可供后续新运行",
      allowedUse: `仅限 ${adopted.dataVersion} 与 ${adopted.ontologyVersion} 的精确组合`,
      observedAt: snapshot.observedAt,
      reason: "当前已采用组合具备消费就绪证据；原权威组合只保留历史追溯。",
      recovery: "创建新证据包和新运行；不得把当前组合回填到旧运行。"
    };
    next.credibility.agentGates = next.credibility.agentGates.map((gate) => {
      if (["new-run", "confirm-result", "action-request"].includes(gate.id)) return {
        ...gate,
        status: "blocked",
        label: "原组合仅供追溯",
        reason: "本证据包仍固定原权威组合；受控回退后的当前组合必须形成新的证据包和运行。",
        recovery: "使用“创建后续新运行”固定上游已采用组合；不得将当前摘要的用途资格套用到原证据包。"
      };
      return gate;
    });
    next.credibility.useFlags.canStartNewRun = false;
    next.credibility.useFlags.canConfirmNewResult = false;
    next.credibility.useFlags.canPrepareActionRequest = false;
  }
  next.credibility.lastReadAt = readAt;
  next.credibility.externalAuthority = {
    feedId: feed.id,
    owner: snapshot.owner || feed.owner,
    sourceReference: snapshot.sourceReference,
    publishedAt: snapshot.observedAt,
    receivedAt: readAt
  };
  next.credibility.historyDimensions = normalizeExternalHistory(next.credibility.historyDimensions, snapshot.observedAt, snapshot.profile);
  next.externalCredibilityFeed = { ...feed, cursor: snapshotIndex, lastReadAt: readAt, lastSnapshotId: snapshot.id };
  const useGate = credibilityGate(next.credibility, next.kind === "report" ? "reportQuestion" : "newInsight");
  next.status = useGate.allowed ? "ready" : current.status === "waiting" ? "waiting" : snapshot.adoptedCombination ? "historical" : "quality-blocked";
  next.statusLabel = current.label;
  next.quality = current.quality || next.quality;
  next.freshness = current.freshness || next.freshness;
  return next;
}

function evidenceFromAdoptedCombination(sourceEvidence, snapshot, readAt = nowText()) {
  const adopted = snapshot?.adoptedCombination;
  if (!adopted) return null;
  const adoptedFreshness = snapshot?.dataSidePayload?.currentStateSummary?.freshness || adopted.freshness || "未知";
  const adoptedFactAge = snapshot?.dataSidePayload?.factAge || adopted.factAge || "上游未随受控回退组合提供，按未知处理";
  const projected = projectExternalCredibilitySnapshot(sourceEvidence, "normal", snapshot.observedAt, snapshot.sequence);
  projected.id = adopted.evidenceId;
  projected.name = adopted.evidenceName;
  projected.dataVersion = adopted.dataVersion;
  projected.dataAsOf = adopted.dataAsOf;
  projected.ontologyVersion = adopted.ontologyVersion;
  projected.quality = "通过受控回退后的固定证据门";
  projected.freshness = adoptedFreshness;
  projected.authority = adopted.adoptionReference;
  projected.formedAt = adopted.formedAt;
  projected.previousId = sourceEvidence.id;
  projected.requestContext = {
    ...(sourceEvidence.requestContext || {}),
    id: `${sourceEvidence.requestContext?.id || "AG-CTX-S001-FINANCE"}-ROLLBACK-${snapshot.sequence}`,
    version: "1.0",
    sourceOwner: "Agent 应用（依据上游受控采用证据）",
    scenarioId: sourceEvidence.requestContext?.scenarioId || "S001",
    scenarioLabel: sourceEvidence.requestContext?.scenarioLabel || "集团融资成本与债务结构优化",
    requestedAt: adopted.formedAt,
    objectScope: sourceEvidence.requestContext?.objectScope || "集团合并范围融资指标、Rule 命中主体与获准 Action Type",
    expectedOutput: "AI Insight v1"
  };
  projected.items = deepClone(adopted.items || []);
  projected.externalCredibilityFeed = null;
  projected.credibility.versionBindingSummary = {
    ...projected.credibility.versionBindingSummary,
    id: adopted.bindingSummaryId,
    version: adopted.bindingSummaryVersion,
    formedAt: adopted.formedAt,
    observedAt: adopted.formedAt,
    t006: adopted.dataAsset,
    t007: adopted.dataVersion,
    t008: adopted.dataAsOf,
    ontology: adopted.ontologyVersion,
    binding: "本体管理已正式采用的受控回退组合",
    reason: "该组合由上游权威采用证据明确提供，Agent 应用未自行选择历史版本。"
  };
  projected.credibility.currentStateSummary = {
    ...projected.credibility.currentStateSummary,
    id: snapshot.summaryId,
    version: snapshot.summaryVersion,
    observedAt: snapshot.observedAt,
    factAge: adoptedFactAge,
    quality: projected.quality,
    freshness: projected.freshness,
    dataQualification: "允许后续新运行",
    refresh: "受控回退组合已正式采用",
    useConclusion: "可用该固定组合创建后续新运行；旧运行和旧结果保持不变。"
  };
  projected.credibility.identities.current = {
    role: "当前权威",
    status: "ready",
    label: "受控回退后正在服务",
    t006: adopted.dataAsset,
    t007: adopted.dataVersion,
    t008: adopted.dataAsOf,
    reason: "本体管理已正式采用，数据工程已提供消费就绪证据。"
  };
  projected.credibility.identities.previousQualified = {
    role: "上一具备采用资格",
    status: "quality-blocked",
    label: "原组合已受限",
    t006: sourceEvidence.credibility?.versionBindingSummary?.t006,
    t007: sourceEvidence.dataVersion,
    t008: sourceEvidence.dataAsOf,
    reason: "原组合保留用于历史追溯，不得作为本次新运行输入。"
  };
  projected.credibility.identities.previousAuthoritative = {
    role: "上一权威服务",
    status: "quality-blocked",
    label: "已退出服务",
    t006: sourceEvidence.credibility?.versionBindingSummary?.t006,
    t007: sourceEvidence.dataVersion,
    t008: sourceEvidence.dataAsOf,
    reason: "该组合的历史身份不改变其事后硬质量失败事实。"
  };
  projected.credibility.ontologyAdoption = { status: "ready", label: "已受控回退并正式采用", ontology: adopted.ontologyVersion, dataVersion: adopted.dataVersion, observedAt: snapshot.observedAt, source: adopted.adoptionReference, recovery: "后续状态变化时重新读取当前摘要；旧运行不换版。" };
  projected.credibility.consumptionReadiness = { status: "ready", label: "可供后续新运行", allowedUse: "仅限该精确受控回退组合", observedAt: snapshot.observedAt, reason: "本体采用和数据侧消费就绪证据均已形成。", recovery: "状态变化后重新执行用途门；不得回填旧运行。" };
  projected.credibility.postQuality = { status: "complete", label: "回退组合未登记硬质量问题", checkedAt: snapshot.observedAt, scope: adopted.dataVersion, reason: "当前摘要允许该组合用于后续新运行。", recovery: "如后续登记硬失败，保留结果并阻断新的正式用途。" };
  projected.credibility.externalAuthority = { feedId: sourceEvidence.externalCredibilityFeed?.id || sourceEvidence.credibility?.externalAuthority?.feedId || null, owner: snapshot.owner, sourceReference: snapshot.sourceReference, publishedAt: snapshot.observedAt, receivedAt: readAt };
  projected.credibility.lastReadAt = readAt;
  projected.credibility.agentGates = projected.credibility.agentGates.map((gate) => {
    if (gate.id === "new-run") return adoptedFreshness === "未知"
      ? { ...gate, status: "allowed", label: "允许后续受限运行", reason: "权威责任方已明确提供并采用该固定组合；新鲜度未知必须随结果披露。", recovery: "创建受限新运行；不得覆盖旧运行快照。" }
      : { ...gate, status: "allowed", label: "允许后续新运行", reason: "权威责任方已明确提供并采用该固定组合，且新鲜度状态已提供。", recovery: "创建新运行；不得覆盖旧运行快照。" };
    if (["confirm-result", "action-request"].includes(gate.id) && adoptedFreshness === "未知") return {
      ...gate,
      status: "blocked",
      label: "新鲜度未知，暂不可操作",
      reason: "上游未提供该回退组合的新鲜度结论，不能将未知默认解释为可确认或可发起 Action。",
      recovery: "取得权威新鲜度状态后，按同一精确组合创建新运行；不得将旧结果直接转为行动申请。"
    };
    return gate;
  });
  projected.credibility.useFlags.canStartNewRun = true;
  projected.credibility.useFlags.canConfirmNewResult = adoptedFreshness !== "未知";
  projected.credibility.useFlags.canPrepareActionRequest = adoptedFreshness !== "未知";
  projected.status = "ready";
  projected.statusLabel = "可用于后续新运行";
  return projected;
}

function readNextExternalCredibility(evidence, readAt = nowText()) {
  const feed = externalCredibilityFeedFor(evidence);
  if (!feed?.timeline?.length) {
    const unchanged = deepClone(evidence);
    if (unchanged.credibility) unchanged.credibility.lastReadAt = readAt;
    return { evidence: unchanged, changed: false, snapshot: null, readAt, reason: "外部能力提供方未发布新的摘要版本。" };
  }
  const cursor = externalFeedCursor(evidence, feed);
  const targetIndex = cursor + 1;
  if (targetIndex >= feed.timeline.length) {
    const unchanged = deepClone(evidence);
    unchanged.credibility.lastReadAt = readAt;
    unchanged.externalCredibilityFeed = { ...feed, cursor, lastReadAt: readAt };
    return { evidence: unchanged, changed: false, snapshot: null, readAt, reason: "外部权威摘要版本未变化。" };
  }
  const snapshot = feed.timeline[targetIndex];
  return {
    evidence: applyExternalCredibilitySnapshot(evidence, feed, snapshot, targetIndex, readAt),
    changed: true,
    snapshot,
    readAt,
    reason: snapshot.changeReason
  };
}

function readCurrentExternalCredibility(evidence, readAt = nowText()) {
  const unchanged = deepClone(evidence);
  if (unchanged.credibility) {
    unchanged.credibility.lastReadAt = readAt;
    unchanged.credibility.externalAuthority = {
      ...(unchanged.credibility.externalAuthority || {}),
      receivedAt: readAt
    };
  }
  if (unchanged.externalCredibilityFeed) unchanged.externalCredibilityFeed.lastReadAt = readAt;
  return { evidence: unchanged, changed: false, snapshot: null, readAt, reason: "已重新读取当前发布摘要，摘要标识和版本未变化。" };
}

function readExternalCredibilityForTrigger(evidence, trigger, readAt = nowText()) {
  const feed = externalCredibilityFeedFor(evidence);
  if (!feed?.timeline?.length) return readCurrentExternalCredibility(evidence, readAt);
  const cursor = externalFeedCursor(evidence, feed);
  const currentVersion = evidence?.credibility?.currentStateSummary?.version;
  const targetIndex = feed.timeline.findIndex((entry, index) => index > cursor
    && entry.trigger === trigger
    && (!entry.triggerFromSummaryVersion || entry.triggerFromSummaryVersion === currentVersion));
  if (targetIndex < 0) return readCurrentExternalCredibility(evidence, readAt);
  const snapshot = feed.timeline[targetIndex];
  return {
    evidence: applyExternalCredibilitySnapshot(evidence, feed, snapshot, targetIndex, readAt),
    changed: true,
    snapshot,
    readAt,
    reason: snapshot.changeReason
  };
}

function expectedContractsForType(type) {
  return {
    "洞察 Agent": { input: "Generation Evidence Package v1", output: "AI Insight v1" },
    "报告伴读 Agent": { input: "Report Context Binding v1", output: "Report Copilot Answer v1" },
    "报告核验 Agent": { input: "Report Verification Request v1", output: "Report Verification Extraction v1" },
    "报告草稿 Agent": { input: "Report Generation Request v1", output: "Agent Report Draft v1" }
  }[type] || null;
}

function resolveRoute() {
  const defaultRoot = window.AGENT_WORKSPACE_CONFIG.initialRoute;
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { screen: defaultRoot, id: null };
  if (parts[0] === "agents" && parts[1]) return { screen: "agent-detail", id: parts[1], version: parts[2] || null };
  if (parts[0] === "drafts" && parts[1]) return { screen: "draft-config", id: parts[1] };
  if (parts[0] === "resources" && parts[1] && parts[2]) return { screen: "resource-detail", kind: parts[1], id: parts[2], version: parts[3] || null };
  if (parts[0] === "runs" && parts[1]) return { screen: "run-detail", id: parts[1] };
  if (parts[0] === "evidence" && parts[1]) return { screen: "evidence-detail", id: parts[1] };
  if (parts[0] === "orchestrations" && parts[1]) return { screen: "orchestration-editor", id: parts[1] };
  const roots = ["agents", "resources", "runs", "evidence", "orchestrations"];
  return { screen: roots.includes(parts[0]) ? parts[0] : defaultRoot, id: null };
}

function routePath(screen, id = null, version = null) {
  const roots = {
    "agent-detail": "agents",
    "draft-config": "drafts",
    "run-detail": "runs",
    "evidence-detail": "evidence",
    "orchestration-editor": "orchestrations"
  };
  return `#/${roots[screen] || screen}${id ? `/${encodeURIComponent(id)}` : ""}${version ? `/${encodeURIComponent(version)}` : ""}`;
}

function loadState() {
  try {
    const configuredKey = window.AGENT_WORKSPACE_CONFIG.storageKey;
    const storageCandidates = [configuredKey, ...LEGACY_AGENT_STORAGE_KEYS.filter((key) => key !== configuredKey)];
    let saved = null;
    for (const key of storageCandidates) {
      saved = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (saved) break;
    }
    if (!saved) return scopeModelToActiveScenario(window.AGENT_APP_INITIAL_STATE);
    const parsed = JSON.parse(saved);
    if (parsed.schemaVersion === window.AGENT_APP_INITIAL_STATE.schemaVersion) return scopeModelToActiveScenario(hydratePersistedModel(parsed));
    if (parsed.schemaVersion === 22 && window.AGENT_APP_INITIAL_STATE.schemaVersion === 23) {
      const migrated = deepClone(parsed);
      const reportDraftAgent = deepClone(window.AGENT_APP_INITIAL_STATE.agents.find((agent) => agent.id === "report-draft"));
      migrated.schemaVersion = 23;
      migrated.agents = [...migrated.agents.filter((agent) => agent.id !== "report-draft"), reportDraftAgent];
      migrated.drafts = migrated.drafts.filter((draft) => draft.id !== "draft-report-generation");
      migrated.c022Rejections = migrated.c022Rejections || [];
      return scopeModelToActiveScenario(hydratePersistedModel(migrated));
    }
    return scopeModelToActiveScenario(window.AGENT_APP_INITIAL_STATE);
  } catch (error) {
    return scopeModelToActiveScenario(window.AGENT_APP_INITIAL_STATE);
  }
}

function getAgentRelease(agent, version) {
  if (!agent?.releases?.length) return null;
  const targetVersion = version || agent.activeRelease;
  return agent.releases.find((release) => release.version === targetVersion) || null;
}

function getPrompt(id, version, dynamic = []) {
  const resource = listPromptResources(dynamic).find((item) => item.id === id);
  const versions = resource?.versions || [];
  return { resource, value: version ? versions.find((item) => item.version === version) || null : versions[0] || null, versions };
}

function getSkill(id, version) {
  const resource = window.AGENT_SKILLS.find((item) => item.id === id);
  const versions = resource?.versions || [];
  return { resource, value: version ? versions.find((item) => item.version === version) || null : versions[0] || null, versions };
}

function orderOrchestrationNodes(nodes, connections) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  connections.forEach((connection) => {
    if (!nodeMap.has(connection.source) || !nodeMap.has(connection.target)) return;
    indegree.set(connection.target, (indegree.get(connection.target) || 0) + 1);
    outgoing.get(connection.source).push(connection.target);
  });
  const byPosition = (a, b) => a.x - b.x || a.y - b.y;
  const queue = nodes.filter((node) => indegree.get(node.id) === 0).sort(byPosition);
  const ordered = [];
  while (queue.length) {
    const node = queue.shift();
    ordered.push(node);
    outgoing.get(node.id).forEach((targetId) => {
      indegree.set(targetId, indegree.get(targetId) - 1);
      if (indegree.get(targetId) === 0) {
        queue.push(nodeMap.get(targetId));
        queue.sort(byPosition);
      }
    });
  }
  const seen = new Set(ordered.map((node) => node.id));
  return [...ordered, ...nodes.filter((node) => !seen.has(node.id)).sort(byPosition)];
}

function applyOrchestrationDraftChange(item, changes) {
  const archived = item.trace ? [deepClone(item.trace), ...(item.traceHistory || [])] : item.traceHistory || [];
  return { ...item, ...changes, status: "draft", release: null, validation: null, trace: null, traceHistory: archived, updatedAt: nowText() };
}

function getTool(id) {
  return window.AGENT_TOOLS.find((item) => item.id === id);
}

function formalRunGate(agent, release, evidence, request) {
  if (!agent || !release || !evidence) return { mode: "missing", reason: "Agent Release 或固定证据上下文不完整。" };
  const contextIssue = requestContextIssue(release, evidence, request);
  if (contextIssue) return contextIssue;
  if (evidence.status !== "ready") return { mode: "quality", reason: evidence.quality || "固定输入未通过质量门。" };
  if (!evidence.dataVersion || !evidence.dataAsOf || !evidence.ontologyVersion) return { mode: "missing", reason: "固定证据缺少数据版本、截至时间或已发布语义版本。" };
  const reportVersionIssue = reportContextVersionIssue({ type: agent.type, ontology: release.ontology }, evidence, request);
  if (reportVersionIssue) return { mode: "version", reason: reportVersionIssue };
  const generationVersionIssue = generationContextVersionIssue({ type: agent.type, ontology: release.ontology }, evidence, request);
  if (generationVersionIssue) return { mode: "version", reason: generationVersionIssue };
  if (!["报告伴读 Agent", "报告核验 Agent", "报告草稿 Agent"].includes(agent.type) && release.ontology?.includes("Published") && release.ontology !== evidence.ontologyVersion) return { mode: "version", reason: `Agent 版本固定的 ${displayBusinessTerm(release.ontology)} 与证据包 ${displayBusinessTerm(evidence.ontologyVersion)} 不一致。` };
  if (agent.type === "报告伴读 Agent" && (!request || !evidence.report)) return { mode: "missing", reason: "报告伴读缺少报告中心提供的报告版本、稳定锚点或固定证据。" };
  if (agent.type === "报告核验 Agent" && (!request || !evidence.report)) return { mode: "missing", reason: "报告自动核验缺少报告中心提供的报告内容版本、稳定锚点、核验定义或固定证据。" };
  if (agent.type === "报告草稿 Agent" && (!request || !evidence.generation)) return { mode: "missing", reason: "报告草稿生成缺少报告中心提供的 C022、报告定义、模板槽位或固定证据。" };
  const useGate = credibilityGate(evidence.credibility, agent.type === "报告伴读 Agent" ? "reportQuestion" : agent.type === "报告核验 Agent" ? "reportVerification" : agent.type === "报告草稿 Agent" ? "reportDraft" : "newInsight");
  if (!useGate.allowed) return { mode: "quality", reason: useGate.reason, recovery: useGate.recovery };
  const unavailableTool = release.tools.map(getTool).find((tool) => !tool || tool.availability !== "available");
  if (unavailableTool) return { mode: "tool", reason: `${unavailableTool?.name || "必需工具"}当前不可用。` };
  return { mode: "normal", reason: null };
}

function actionRequestEligibility(run, currentCredibility = run?.snapshot?.credibility) {
  if (!run?.result || run.result.type !== "AI Insight") return { allowed: false, reason: "当前结果不是可发起行动协作的 AI Insight。" };
  if (run.status !== "complete") return { allowed: false, reason: "仅完整完成并通过输出合同的运行可发起行动申请。" };
  if (run.result.confirmation !== "confirmed") return { allowed: false, reason: "请先完成“确认可作参考”，再进入独立的行动申请确认。" };
  if (run.result.actionHandoffIds?.length || run.result.actionRequestIds?.length || run.result.actionRequestId) return { allowed: false, reason: "该结果已经发起行动申请，不能重复提交。" };
  if (run.result.confirmation === "rejected") return { allowed: false, reason: "该结果已退回，需基于修正输入创建新运行。" };
  if (run.snapshot.evidenceStatus !== "ready") return { allowed: false, reason: "固定证据快照未处于可用状态。" };
  if (!run.snapshot.dataVersion || !run.snapshot.dataAsOf || !run.snapshot.ontologyVersion || !run.snapshot.quality || !run.snapshot.freshness) return { allowed: false, reason: "固定证据快照缺少版本、时点、质量或新鲜度。" };
  if (/候选|陈旧|过期|未知|无法判断/.test(run.snapshot.freshness)) return { allowed: false, reason: "固定证据快照的新鲜度为陈旧、候选或未知，不能据此发起行动申请。", recovery: "取得权威新鲜度状态后创建或重新评估后续运行；不得把未知默认解释为允许。" };
  const useGate = credibilityGate(currentCredibility, "actionRequest");
  if (!useGate.allowed) return { allowed: false, reason: useGate.reason, recovery: useGate.recovery, currentCredibility };
  const requiredTools = ["tool-action-discovery", "tool-action-submit"];
  const missingTool = requiredTools.find((toolId) => !run.snapshot.tools.includes(toolId));
  if (missingTool) return { allowed: false, reason: "本次 Agent 版本未同时固定行动类型发现与行动申请提交工具。" };
  const unavailableTool = requiredTools.map(getTool).find((tool) => !tool || tool.availability !== "available");
  if (unavailableTool) return { allowed: false, reason: `${unavailableTool?.name || "Action 工具"} 当前不可用。` };
  const actionType = (run.snapshot.evidenceItems || []).find((item) => item.type === "Action Type" && item.source?.includes("Published"));
  if (!actionType) return { allowed: false, reason: "固定证据快照中没有获准的已发布行动类型。" };
  if (!actionType.resourceId || !actionType.version?.includes("Published") || actionType.value !== "允许请求") return { allowed: false, reason: "行动类型缺少稳定标识、精确已发布版本或当前用途许可。" };
  if (!actionType.targets?.length || actionType.targets.some((target) => !target.id || !target.name)) return { allowed: false, reason: "行动申请缺少可选目标主体的稳定标识。" };
  const evidenceIds = new Set((run.snapshot.evidenceItems || []).map((item) => item.id));
  const evidenceRefs = [...(actionType.metricRefs || []), ...(actionType.ruleRefs || []), actionType.id];
  if (!actionType.metricRefs?.length || !actionType.ruleRefs?.length || evidenceRefs.some((ref) => !evidenceIds.has(ref))) return { allowed: false, reason: "行动申请所需的指标、规则或行动类型证据引用不完整。" };
  return { allowed: true, reason: null, actionType, targets: actionType.targets, evidenceRefs };
}

function buildAgentActionRequest(run, eligibility, target, reason, currentCredibility) {
  const scenarioContext = normalizeScenarioContext(run?.scenarioContext || run?.snapshot?.scenarioContext || run?.snapshot || {});
  const actionType = eligibility.actionType;
  const evidenceItems = run.snapshot.evidenceItems || [];
  const metricItem = evidenceItems.find((item) => (actionType.metricRefs || []).includes(item.id));
  const ruleItem = evidenceItems.find((item) => (actionType.ruleRefs || []).includes(item.id));
  const stableSeed = [
    ...SCENARIO_CONTEXT_FIELDS.map((field) => scenarioContext[field]),
    run.id,
    run.result.id,
    actionType.resourceId,
    actionType.version,
    target.id
  ].join("|");
  const requestId = `AR-AG-${stableHash(stableSeed)}`;
  return {
    id: requestId,
    requestId,
    scenario: run.snapshot.scenario || "S001 · 集团融资成本与债务结构优化",
    scenarioName: "集团融资成本与债务结构优化",
    scenarioContext: deepClone(scenarioContext),
    sourceType: "agent",
    sourceTypeLabel: "Agent 应用",
    sourceRef: run.result.id,
    sourceRecord: {
      agentId: run.snapshot.agentId,
      agentRelease: run.snapshot.agentRelease,
      runId: run.id,
      resultId: run.result.id
    },
    sourceScene: run.snapshot.scenario || scenarioContext.scenarioId,
    requester: "Agent 应用",
    initiator: "当前账号",
    requestTime: run.result.generatedAt || run.finishedAt || run.createdAt,
    subjectId: target.id,
    subjectName: target.name,
    subjectObjectType: "融资主体",
    actionType: {
      id: actionType.resourceId,
      name: actionType.name,
      version: actionType.version,
      status: "已发布",
      publishedSemanticVersion: run.snapshot.ontologyVersion
    },
    rule: ruleItem ? {
      id: ruleItem.id,
      name: ruleItem.name,
      version: run.snapshot.ontologyVersion,
      publishedSemanticVersion: run.snapshot.ontologyVersion,
      evaluationId: `${run.snapshot.evidenceId}:${ruleItem.id}`,
      evaluatedAt: run.snapshot.evidenceFormedAt || run.result.generatedAt,
      resultVersion: run.snapshot.evidencePackageVersion || run.snapshot.dataVersion,
      branch: "命中",
      hitEvidence: ruleItem.value
    } : null,
    ruleApplicability: ruleItem ? "作为 Agent 来源证据" : "不适用",
    metric: {
      id: metricItem?.id || actionType.metricRefs?.[0] || null,
      name: metricItem?.name || "行动申请指标证据",
      value: metricItem?.value || null,
      unit: metricItem?.unit || null,
      explanation: metricItem?.source || "固定 Agent 运行证据",
      evaluatedAt: run.snapshot.evidenceFormedAt || run.result.generatedAt,
      scope: metricItem?.object || target.name,
      resultVersion: run.snapshot.evidencePackageVersion || run.snapshot.dataVersion,
      evidenceRefs: [...(actionType.metricRefs || [])]
    },
    owner: "集团资金管理岗",
    recommendation: reason || `核实${target.name}的融资成本与期限结构，并评估优化安排。`,
    recommendedDirection: actionType.purpose || actionType.name,
    banks: [],
    loans: [],
    loanCount: 0,
    evidence: {
      snapshotId: run.result.id,
      cutoff: run.snapshot.dataAsOf,
      semanticVersion: run.snapshot.ontologyVersion,
      semanticVersionId: run.snapshot.semanticVersionId || null,
      dataVersion: run.snapshot.dataVersion,
      dataAssetVersionId: run.snapshot.dataAssetVersionId || null,
      quality: run.snapshot.quality,
      freshness: run.snapshot.freshness,
      evidenceIds: [...eligibility.evidenceRefs],
      ruleEvidenceId: ruleItem?.id || null,
      bindingId: run.bindingId || null,
      consumableVersionId: run.snapshot.consumableVersionId || null,
      trustSnapshot: deepClone(currentCredibility?.currentStateSummary || null),
      trustReadAt: currentCredibility?.currentStateSummary?.observedAt || run.result.generatedAt
    },
    returnRoute: `${window.location.pathname}#/runs/${encodeURIComponent(run.id)}`,
    filter: null,
    returnPosition: null
  };
}

function contractLabel(type) {
  const labels = { prompt: "Prompt", skill: "Skill", tool: "Tool" };
  return labels[type] || type;
}

function App() {
  const [model, setModel] = useState(loadState);
  const [route, setRoute] = useState(resolveRoute);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [catalogTab, setCatalogTab] = useState("released");
  const [catalogView, setCatalogView] = useState("cards");
  const [search, setSearch] = useState("");
  const [agentTab, setAgentTab] = useState("overview");
  const [resourceKind, setResourceKind] = useState("prompt");
  const [resourceTab, setResourceTab] = useState("detail");
  const [runTab, setRunTab] = useState("requests");
  const [c022Candidates, setC022Candidates] = useState(readC022Candidates);
  const [c022SelectedId, setC022SelectedId] = useState(null);
  const [c024Candidates, setC024Candidates] = useState(readC024Candidates);
  const [c024SelectedId, setC024SelectedId] = useState(null);
  const [runDetailTab, setRunDetailTab] = useState("summary");
  const [evidenceTab, setEvidenceTab] = useState("packages");
  const [debugRailOpen, setDebugRailOpen] = useState(true);
  const [debugForm, setDebugForm] = useState({ input: "请基于固定证据说明主要变化、风险关注和使用限制。", evidenceId: "finance-2026-07-31", condition: "normal" });
  const [runForm, setRunForm] = useState({ agentId: "financing-insight", evidenceId: "finance-2026-07-31", requestId: null, replacesRun: null, condition: "normal" });
  const [actionSubmitBlock, setActionSubmitBlock] = useState(null);
  const [newAgentForm, setNewAgentForm] = useState({ name: "", type: "洞察 Agent", purpose: "" });
  const [orchestrationForm, setOrchestrationForm] = useState({ name: "", purpose: "", template: "sequence" });
  const [selectedNode, setSelectedNode] = useState(null);
  const [connectionSource, setConnectionSource] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [actionTargetId, setActionTargetId] = useState("");
  const [storageFailure, setStorageFailure] = useState(null);
  const canvasRef = useRef(null);
  const publishLocksRef = useRef(new Set());
  const actionSubmitLocksRef = useRef(new Set());

  useEffect(() => {
    try {
      persistAgentModel(model);
      setStorageFailure(null);
    } catch (error) {
      setStorageFailure({
        message: error?.name === "QuotaExceededError" ? "浏览器工作区容量不足，当前内存状态尚未持久化。" : "当前状态保存失败。",
        recovery: "关闭不再使用的其他工作页面后点击重试；当前页面仍可继续查看，但刷新前应先确认保存成功。"
      });
    }
  }, [model]);

  // C023 是跨模块交接的最小结果包。即使完整 Agent 工作区因浏览器容量
  // 无法整体写回，也要保留当前报告草稿的可验证交接记录，供报告中心只读回读。
  useEffect(() => {
    const latestGeneration = (model.runs || []).find((run) => run.snapshot?.agentId === "report-draft"
      && run.status === "complete" && run.result?.type === "Agent Report Draft" && currentProjection(run));
    if (latestGeneration) writeC023Transfer(latestGeneration, latestGeneration.result);
  }, [model.runs.map((run) => `${run.id}:${run.status}:${run.result?.id || ""}`).join("|")]);

  useEffect(() => {
    const reconcileReceipts = () => {
      setModel((current) => {
        let next = current;
        (current.handoffs || []).filter((handoff) => handoff.status !== "received" && handoff.actionRequestId).forEach((handoff) => {
          const receipt = readC019Receipt(handoff.actionRequestId, handoff.scenarioContext);
          if (receipt.status === "received") next = applyActionReceipt(next, handoff.id, receipt);
        });
        return next;
      });
    };
    const storageHandler = (event) => { if (event.key === C019_PROJECTION_KEY) reconcileReceipts(); };
    window.addEventListener("storage", storageHandler);
    window.addEventListener("ontology3:decision-center:c019-updated", reconcileReceipts);
    reconcileReceipts();
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener("ontology3:decision-center:c019-updated", reconcileReceipts);
    };
  }, []);

  function retryPersistModel() {
    try {
      persistAgentModel(model);
      setStorageFailure(null);
      toast("状态已保存", "当前请求、运行和结果引用已写入工作区。", "success");
    } catch (error) {
      setStorageFailure({
        message: error?.name === "QuotaExceededError" ? "浏览器工作区容量仍不足，当前内存状态尚未持久化。" : "当前状态保存仍未完成。",
        recovery: "保留本页并关闭不再使用的其他工作页面后再次重试。"
      });
    }
  }

  useEffect(() => {
    const handler = () => setRoute(resolveRoute());
    window.addEventListener("hashchange", handler);
    window.addEventListener("popstate", handler);
    if (!window.location.hash) window.history.replaceState({}, "", routePath(window.AGENT_WORKSPACE_CONFIG.initialRoute));
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
    };
  }, []);

  useEffect(() => {
    if (route.screen !== "run-detail" || !route.id) return;
    setModel((current) => {
      const targetRun = current.runs.find((item) => item.id === route.id);
      const targetEvidence = current.evidencePackages.find((item) => item.id === targetRun?.snapshot?.evidenceId);
      if (!currentProjection(targetRun) || !currentProjection(targetEvidence) || !targetEvidence?.credibility) return current;
      const readResult = readCurrentExternalCredibility(targetEvidence);
      return {
        ...current,
        evidencePackages: current.evidencePackages.map((item) => item.id === targetEvidence.id ? readResult.evidence : item)
      };
    });
  }, [route.screen, route.id]);

  const runStateKey = model.runs.map((run) => `${run.id}:${run.status}`).join("|");
  useEffect(() => {
    const timers = [];
    model.runs.forEach((run) => {
      if (run.status === "waiting") timers.push(setTimeout(() => advanceFormalRun(run.id), 700));
      if (run.status === "running") timers.push(setTimeout(() => finishFormalRun(run.id), 4200));
    });
    return () => timers.forEach(clearTimeout);
  }, [runStateKey]);

  const debugStateKey = model.drafts.flatMap((draft) => (draft.debugRuns || []).map((run) => `${draft.id}:${run.id}:${run.status}`)).join("|");
  useEffect(() => {
    const timers = [];
    model.drafts.forEach((draft) => {
      (draft.debugRuns || []).forEach((run) => {
        if (run.status === "waiting") timers.push(setTimeout(() => advanceDebugRun(draft.id, run.id), 600));
        if (run.status === "running") timers.push(setTimeout(() => finishDebugRun(draft.id, run.id), 1600));
      });
    });
    return () => timers.forEach(clearTimeout);
  }, [debugStateKey]);

  const orchestrationTraceKey = model.orchestrations.map((item) => `${item.id}:${item.trace?.status || ""}`).join("|");
  useEffect(() => {
    const timers = [];
    model.orchestrations.forEach((item) => {
      if (item.trace?.status === "waiting") timers.push(setTimeout(() => advanceOrchestrationTrace(item.id), 700));
      if (item.trace?.status === "running") timers.push(setTimeout(() => finishOrchestrationTrace(item.id), 3200));
    });
    return () => timers.forEach(clearTimeout);
  }, [orchestrationTraceKey]);

  function navigate(screen, id = null, version = null) {
    const path = routePath(screen, id, version);
    window.history.pushState({}, "", path);
    setRoute(resolveRoute());
    setAgentTab("overview");
    setRunDetailTab("summary");
    setResourceTab("detail");
    setDrawer(null);
    requestAnimationFrame(() => document.querySelector(".main")?.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  function replaceNavigate(screen, id = null) {
    window.history.replaceState({}, "", routePath(screen, id));
    setRoute(resolveRoute());
    requestAnimationFrame(() => document.querySelector(".main")?.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  function navigateResource(kind, id, version = null) {
    const path = `#/resources/${encodeURIComponent(kind)}/${encodeURIComponent(id)}${version ? `/${encodeURIComponent(version)}` : ""}`;
    window.history.pushState({ returnHash: window.location.hash }, "", path);
    setRoute(resolveRoute());
    setResourceTab("detail");
    requestAnimationFrame(() => document.querySelector(".main")?.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  function toast(title, message = "", kind = "") {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, title, message, kind }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3600);
  }

  function refreshCredibility(evidenceId) {
    let readResult = null;
    setModel((current) => ({
      ...current,
      evidencePackages: current.evidencePackages.map((item) => {
        if (item.id !== evidenceId || !item.credibility) return item;
        readResult = readNextExternalCredibility(item);
        return readResult.evidence;
      })
    }));
    setTimeout(() => {
      if (!readResult?.changed) {
        toast("外部摘要未变化", readResult?.reason || "已记录本次读取时间，当前用途门保持不变。", "success");
        return;
      }
      const status = readResult.snapshot?.profile;
      const blocked = ["scope-failure", "version-failure", "no-safe-combination"].includes(status);
      toast("已读取新的外部摘要", `${readResult.snapshot?.summaryVersion} · ${readResult.reason}`, blocked ? "danger" : "success");
    }, 0);
  }

  function refreshC022Inbox() {
    const candidates = readC022Candidates();
    setC022Candidates(candidates);
    setC022SelectedId((current) => candidates.some((item) => item.requestId === current) ? current : candidates[0]?.requestId || null);
    if (!candidates.length) toast("尚未收到报告生成请求", "报告中心提交完整 C022 后才会在这里形成可接收请求。", "danger");
    else toast("已重新读取报告生成请求", `读取到 ${candidates.length} 条来源记录；未通过身份校验的记录不会进入当前工作投影。`, "success");
  }

  function selectedC022Candidate() {
    return c022Candidates.find((candidate) => candidate.requestId === c022SelectedId)
      || c022Candidates.find((candidate) => !model.inboundRequests.some((request) => request.sourceRequestId === candidate.requestId))
      || c022Candidates[0]
      || null;
  }

  function receiveC022(candidate = selectedC022Candidate()) {
    const receivedAt = nowText();
    if (!candidate) {
      toast("没有可接收的报告生成请求", "请先由报告中心提交 C022，再重新读取。", "danger");
      return;
    }
    const identity = c022Identity(candidate);
    const activeScenarioContext = readActiveScenarioContext();
    const issues = c022Issues(candidate, activeScenarioContext);
    if (issues.length) {
      setModel((current) => ({
        ...current,
        c022Rejections: [{ id: `C022-REJECT-${Date.now()}`, sourceRequestId: candidate.requestId, receivedAt, issues, recovery: "由报告中心按当前完整 C033 场景轮次修复缺失或错配字段后，以完整 C022 重新交接；Agent 不补齐身份、不改选版本。", identity }, ...(current.c022Rejections || [])]
      }));
      toast("报告生成请求已拒绝", `${issues.join("；")}。请由报告中心修复后重新提交。`, "danger");
      return;
    }
    const candidateFingerprint = c022Fingerprint(candidate);
    const existingRequest = model.inboundRequests.find((request) => request.sourceRequestId === candidate.requestId && currentProjection(request));
    const existingRun = existingRequest
      ? model.runs.find((run) => run.requestId === existingRequest.id && currentProjection(run) && ["waiting", "running"].includes(run.status))
      : null;
    const replacingReceivedRequest = Boolean(existingRequest && existingRequest.c022Fingerprint !== candidateFingerprint);
    const refreshingReceivedRequest = Boolean(existingRequest && !existingRun && !replacingReceivedRequest
      && ["pending", "failed", "blocked"].includes(existingRequest.status)
      && String(candidate.submittedAt || "") >= String(existingRequest.receivedAt || ""));
    if (existingRequest && !replacingReceivedRequest && !refreshingReceivedRequest) {
      toast("该生成请求已接收", `请求 ${existingRequest.id} 已存在，未重复创建当前资源。`, "success");
      return;
    }
    if (replacingReceivedRequest && existingRun) {
      toast("请求仍在运行", "同一请求已有运行中的固定上下文；请等待完成或先结束该运行，再重新交付新的 C022。", "danger");
      return;
    }
    const evidence = evidenceFromC022(candidate, receivedAt);
    evidence.scenarioContext = deepClone(activeScenarioContext);
    evidence.requestContext = { ...evidence.requestContext, scenarioFormedAt: activeScenarioContext.formedAt, scenarioStatus: activeScenarioContext.status };
    const request = {
      id: identity.requestId,
      sourceRequestId: identity.requestId,
      type: "report-draft",
      title: "融资经营分析报告生成",
      source: "报告中心",
      receivedAt,
      status: "pending",
      currentProjection: true,
      projectionStatus: "current",
      evidenceId: evidence.id,
      agentId: "report-draft",
      reportAggregateId: identity.aggregateId,
      reportDefinitionId: identity.reportDefinitionId,
      reportDefinitionVersion: identity.reportDefinitionVersion,
      templateId: identity.templateId,
      templateVersion: identity.templateVersion,
      evidencePackageId: identity.evidencePackageId,
      evidencePackageVersion: identity.evidencePackageVersion,
      semanticVersionId: identity.semanticVersionId,
      semanticVersion: identity.semanticVersion,
      dataAssetVersionId: identity.dataAssetVersionId,
      dataVersion: identity.dataVersion,
      consumableVersionId: identity.consumableVersionId,
      dataAsOf: identity.dataAsOf,
      scenarioContext: deepClone(evidence.scenarioContext),
      question: "按固定报告定义、模板槽位和证据包生成结构化源草稿",
      requestContext: deepClone(evidence.requestContext),
      c022: deepClone(candidate),
      c022Fingerprint: candidateFingerprint,
      blockedReason: null,
      recovery: null
    };
    setModel((current) => {
      const archive = (item, reason) => ({ ...item, currentProjection: false, projectionStatus: "history", archivedAt: receivedAt, archivedReason: reason });
      const activeGeneration = current.inboundRequests.find((item) => currentProjection(item) && item.type === "report-draft");
      const contextChanged = Boolean(activeGeneration && (!sameScenarioContext(activeGeneration.scenarioContext, activeScenarioContext)
        || activeGeneration.reportAggregateId !== identity.aggregateId
        || ((replacingReceivedRequest || refreshingReceivedRequest) && activeGeneration.id === existingRequest?.id)));
      const historyReason = replacingReceivedRequest || refreshingReceivedRequest
        ? `报告中心重新交付了同一请求的完整固定上下文；旧请求、运行和结果保持只读。`
        : `报告中心提交了新的场景轮次或报告生成根（新请求：${request.id}）；旧请求、运行和结果保持只读。`;
      return {
        ...current,
        currentScenarioContext: deepClone(activeScenarioContext),
        evidencePackages: [evidence, ...current.evidencePackages.map((item) => contextChanged && item.kind === "report-generation" && currentProjection(item) ? archive(item, historyReason) : item).filter((item) => item.id !== evidence.id)],
        inboundRequests: [request, ...current.inboundRequests.map((item) => contextChanged && item.type === "report-draft" && currentProjection(item) ? archive(item, historyReason) : item)],
        runs: current.runs.map((item) => contextChanged && item.snapshot?.agentId === "report-draft" && currentProjection(item) ? archive(item, historyReason) : item)
      };
    });
    setModal(null);
    setRunTab("requests");
    navigate("runs");
    toast("报告生成请求已接收", "当前只创建 Request 与固定证据投影；点击开始生成后才会形成独立 C023 Run 和源草稿。", "success");
  }

  function refreshC024Inbox() {
    const candidates = readC024Candidates();
    setC024Candidates(candidates);
    setC024SelectedId((current) => candidates.some((item) => item.requestId === current) ? current : candidates[0]?.requestId || null);
    if (!candidates.length) toast("尚未收到报告交接", "报告中心提交完整 C024 后才会在这里形成可接收请求。", "danger");
    else toast("已重新读取报告交接", `读取到 ${candidates.length} 条来源记录；未通过身份校验的记录不会进入当前工作投影。`, "success");
  }

  function selectedC024Candidate() {
    return c024Candidates.find((candidate) => candidate.requestId === c024SelectedId)
      || c024Candidates.find((candidate) => !model.inboundRequests.some((request) => request.sourceRequestId === candidate.requestId))
      || c024Candidates[0]
      || null;
  }

  function receiveC024(candidate = selectedC024Candidate()) {
    const receivedAt = nowText();
    if (!candidate) {
      toast("没有可接收的报告交接", "请先由报告中心提交 C024，再重新读取。", "danger");
      return;
    }
    const identity = c024Identity(candidate);
    const activeScenarioContext = readActiveScenarioContext();
    const issues = c024Issues(candidate, activeScenarioContext);
    if (issues.length) {
      setModel((current) => ({
        ...current,
        c024Rejections: [{ id: `C024-REJECT-${Date.now()}`, sourceRequestId: candidate.requestId, receivedAt, issues, recovery: "由报告中心按当前完整 C033 场景轮次修复缺失或错配字段后，以完整 C024 重新交接；旧会话和历史记录不迁移。", identity }, ...(current.c024Rejections || [])]
      }));
      toast("报告交接已拒绝", `${issues.join("；")}。请由报告中心修复后重新提交，Agent 不会静默补齐或改选版本。`, "danger");
      return;
    }
    const existingRequest = model.inboundRequests.find((request) => request.sourceRequestId === candidate.requestId);
    if (existingRequest) {
      if (existingRequest.c024Fingerprint === c024Fingerprint(candidate)) {
        toast("该报告交接已接收", `请求 ${existingRequest.id} 已存在，未重复创建当前资源。`, "success");
      } else {
        toast("同一请求标识发生冲突", "已接收记录保持不变；请报告中心使用新的请求标识和完整固定上下文重新提交。", "danger");
      }
      return;
    }
    const activeRequests = model.inboundRequests.filter(currentProjection);
    const sameReportIdentity = activeRequests.find((request) => sameScenarioContext(request.scenarioContext, activeScenarioContext)
      && request.reportNumber === identity.reportNumber
      && request.contentVersion === identity.contentVersion);
    if (sameReportIdentity && ["evidencePackageId", "evidencePackageVersion", "semanticVersionId", "semanticVersion", "dataAssetVersionId", "dataVersion", "dataAsOf", "anchor"].some((field) => {
      const incomingField = field === "anchor" ? identity.selectedAnchor : identity[field];
      return sameReportIdentity[field] !== incomingField;
    })) issues.push("同一场景轮次和报告内容版本下的证据、语义、数据版本或稳定锚点与当前固定身份不一致");
    if (issues.length) {
      setModel((current) => ({
        ...current,
        c024Rejections: [{ id: `C024-REJECT-${Date.now()}`, sourceRequestId: candidate.requestId, receivedAt, issues, recovery: "由报告中心按同一 C033 场景轮次修复缺失或错配字段后，以完整 C024 重新交接；旧会话和历史记录不迁移。", identity }, ...(current.c024Rejections || [])]
      }));
      toast("报告交接已拒绝", `${issues.join("；")}。请由报告中心修复后重新提交，Agent 不会静默补齐或改选版本。`, "danger");
      return;
    }
    const evidence = evidenceFromC024(candidate, receivedAt);
    evidence.scenarioContext = deepClone(activeScenarioContext);
    evidence.requestContext = { ...evidence.requestContext, scenarioFormedAt: activeScenarioContext.formedAt, scenarioStatus: activeScenarioContext.status };
    const request = {
      id: candidate.requestId,
      sourceRequestId: candidate.requestId,
      type: "report-copilot",
      title: candidate.title || "报告伴读请求",
      source: "报告中心",
      receivedAt,
      status: evidence.status === "ready" ? "pending" : "blocked",
      currentProjection: true,
      projectionStatus: "current",
      evidenceId: evidence.id,
      agentId: "report-copilot",
      reportNumber: identity.reportNumber,
      contentVersion: identity.contentVersion,
      reportVersion: `${identity.reportNumber} · ${identity.contentVersion}`,
      evidencePackageId: identity.evidencePackageId,
      evidencePackageVersion: identity.evidencePackageVersion,
      semanticVersionId: identity.semanticVersionId,
      semanticVersion: identity.semanticVersion,
      dataAssetVersionId: identity.dataAssetVersionId,
      dataVersion: identity.dataVersion,
      consumableVersionId: identity.consumableVersionId,
      dataAsOf: identity.dataAsOf,
      scenarioContext: deepClone(evidence.scenarioContext),
      anchorSnapshotId: identity.anchorSnapshotId,
      anchorSnapshotVersion: identity.anchorSnapshotVersion,
      anchor: identity.selectedAnchor,
      question: candidate.question,
      requestContext: deepClone(evidence.requestContext),
      c024: deepClone(candidate),
      c024Fingerprint: c024Fingerprint(candidate),
      blockedReason: evidence.status === "ready" ? null : evidence.credibility?.agentGates?.find((gate) => gate.id === "report-question")?.reason,
      recovery: evidence.status === "ready" ? null : "由报告中心修复权限或质量状态后，以新的完整 C024 创建新请求；本记录保留。",
      regenerationStatus: "尚未请求",
      regenerationRef: null
    };
    setModel((current) => {
      const archiveAt = receivedAt;
      const archive = (item, reason) => ({ ...item, currentProjection: false, projectionStatus: "history", archivedAt: archiveAt, archivedReason: reason });
      const currentRequest = current.inboundRequests.find(currentProjection);
      const contextChanged = Boolean(currentRequest && (
        !sameScenarioContext(currentRequest.scenarioContext, activeScenarioContext)
        || currentRequest.reportNumber !== identity.reportNumber
        || currentRequest.contentVersion !== identity.contentVersion
      ));
      const historyReason = `报告中心提交了新的场景轮次或报告内容版本（新请求：${request.id}）；旧会话、运行和结果保持只读，不迁移到新上下文。`;
      const evidencePackages = contextChanged
        ? current.evidencePackages.map((item) => reportEvidence(item) && currentProjection(item) ? archive(item, historyReason) : item)
        : current.evidencePackages;
      const inboundRequests = contextChanged
        ? current.inboundRequests.map((item) => currentProjection(item) ? archive(item, historyReason) : item)
        : current.inboundRequests;
      const runs = contextChanged
        ? current.runs.map((item) => reportRun(item) && currentProjection(item) ? archive(item, historyReason) : item)
        : current.runs;
      const sessions = contextChanged
        ? current.sessions.map((item) => currentProjection(item) ? { ...archive(item, historyReason), status: "stale", staleAt: archiveAt, staleReason: historyReason, resultReturnStatus: "历史结果保持只读" } : item)
        : current.sessions;
      return {
        ...current,
        currentScenarioContext: deepClone(activeScenarioContext),
        evidencePackages: [evidence, ...evidencePackages.filter((item) => item.id !== evidence.id)],
        inboundRequests: [request, ...inboundRequests],
        runs,
        sessions
      };
    });
    setModal(null);
    setRunTab("requests");
    navigate("runs");
    toast(evidence.status === "ready" ? "报告交接已接收" : "报告交接已登记为阻断", evidence.status === "ready" ? "固定请求和证据投影已创建；Binding、Session、Run、Result 仍为 0，开始处理后才创建。" : `${request.blockedReason} 未创建 Binding、Session、Run 或 Result。`, evidence.status === "ready" ? "success" : "danger");
  }

  function createRunFromAdoptedRollback(evidenceId) {
    const sourceEvidence = model.evidencePackages.find((item) => item.id === evidenceId);
    const feed = externalCredibilityFeedFor(sourceEvidence);
    const currentVersion = sourceEvidence?.credibility?.currentStateSummary?.version;
    const snapshot = feed?.timeline?.find((item) => item.summaryVersion === currentVersion && item.adoptedCombination);
    const adoptedEvidence = evidenceFromAdoptedCombination(sourceEvidence, snapshot);
    const affectedRun = model.runs.find((run) => run.snapshot?.evidenceId === sourceEvidence?.id && ["complete", "partial", "blocked", "failed"].includes(run.status)) || null;
    if (!adoptedEvidence) {
      toast("不能创建后续运行", "当前摘要未提供已正式采用且消费就绪的固定组合。", "danger");
      return;
    }
    if (model.evidencePackages.some((item) => item.id === adoptedEvidence.id)) {
      setRunForm({ agentId: "financing-insight", evidenceId: adoptedEvidence.id, requestId: null, replacesRun: affectedRun?.id || null, condition: "normal" });
      setModal({ type: "run" });
      toast("已定位受控回退组合", "请核对固定版本后创建新的 Agent Run；旧运行保持不变。", "success");
      return;
    }
    setModel((current) => ({ ...current, evidencePackages: [adoptedEvidence, ...current.evidencePackages] }));
    setRunForm({ agentId: "financing-insight", evidenceId: adoptedEvidence.id, requestId: null, replacesRun: affectedRun?.id || null, condition: "normal" });
    setModal({ type: "run" });
    toast("受控回退组合已固定", "已按上游采用证据形成新的固定证据包；请核对后创建新运行。", "success");
  }

  function openActionRequest(run) {
    const evidence = model.evidencePackages.find((item) => item.id === run.snapshot.evidenceId);
    if (!evidence) {
      toast("无法读取当前状态", "来源证据包无法定位，行动申请保持阻断。", "danger");
      return;
    }
    const readResult = readCurrentExternalCredibility(evidence);
    const currentEvidence = readResult.evidence;
    const eligibility = actionRequestEligibility(run, currentEvidence.credibility);
    setModel((current) => ({
      ...current,
      evidencePackages: current.evidencePackages.map((item) => item.id === evidence.id ? currentEvidence : item)
    }));
    if (!eligibility.allowed) {
      toast("当前不能发起行动申请", `${eligibility.reason} ${eligibility.recovery || ""}`.trim(), "danger");
      return;
    }
    setActionTargetId(eligibility.targets[0]?.id || "");
    setActionSubmitBlock(null);
    setModal({ type: "action", runId: run.id, openedSummary: deepClone(currentEvidence.credibility?.currentStateSummary) });
  }

  function runCurrentCredibility(run) {
    if (!currentProjection(run)) return run?.snapshot?.credibility || null;
    return currentCredibilityForRun(run, model.evidencePackages) || run?.snapshot?.credibility || null;
  }

  function runCredibilityState(run) {
    const current = runCurrentCredibility(run);
    return { current, changed: credibilityChanged(run, current) };
  }

  function updateDraft(draftId, updater, markDirty = true) {
    setModel((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => {
        if (draft.id !== draftId) return draft;
        const next = updater(draft);
        return markDirty ? { ...next, dirty: true, validation: { status: "draft", at: null, issues: [] } } : next;
      })
    }));
  }

  function updateAgent(agentId, updater) {
    setModel((current) => ({ ...current, agents: current.agents.map((agent) => agent.id === agentId ? updater(agent) : agent) }));
  }

  function createDraftFromRelease(agent, release = getAgentRelease(agent)) {
    const existing = model.drafts.find((draft) => draft.agentId === agent.id && draft.basedOn === release.version);
    if (existing) {
      navigate("draft-config", existing.id);
      toast("已打开现有草稿", "同一来源 Release 不重复创建草稿。", "success");
      return;
    }
    const prompt = getPrompt(release.prompt.id, release.prompt.version, model.resourceReleases?.prompts || []).value;
    const reportInput = model.evidencePackages.find((item) => item.kind === "report" && currentProjection(item));
    const id = `${agent.id}-draft-${Date.now()}`;
    const draft = {
      id,
      agentId: agent.id,
      name: agent.name,
      type: agent.type,
      basedOn: release.version,
      proposedRelease: nextRelease(agent.activeRelease),
      goal: agent.purpose,
      purpose: agent.purpose,
      inputContract: release.inputContract,
      outputContract: release.outputContract,
      prompt: { id: release.prompt.id, version: "草稿" },
      promptName: getPrompt(release.prompt.id, release.prompt.version, model.resourceReleases?.prompts || []).resource?.name || release.prompt.id,
      promptBaseVersion: release.prompt.version,
      promptContent: (prompt?.sections || []).map((section) => `${section.title}\n${section.body}`).join("\n\n"),
      skills: deepClone(release.skills),
      tools: [...release.tools],
      ontology: release.ontology,
      ontologyScope: release.ontologyScope,
      scenario: scenarioBindingLabel(release, agent.scenario),
      scenarioBinding: deepClone(release.scenarioBinding || scenarioBindingFromScenario(agent.scenario, agent.type)),
      status: "draft",
      dirty: false,
      validation: { status: "draft", at: null, issues: [] },
      debugRuns: []
    };
    setModel((current) => ({ ...current, drafts: [draft, ...current.drafts] }));
    setCatalogTab("drafts");
    setDebugForm({ input: agent.id === "report-copilot" ? "请解释当前章节的主要结论、核验结果和限制。" : "请基于固定证据说明主要变化、风险关注和使用限制。", evidenceId: agent.id === "report-copilot" ? (reportInput?.id || "") : "finance-2026-07-31", condition: "normal" });
    navigate("draft-config", id);
    toast("配置草稿已创建", `已固定来源 Release ${release.version}，原版本保持不变。`, "success");
  }

  function createNewAgentDraft() {
    if (!newAgentForm.name.trim() || !newAgentForm.purpose.trim()) {
      toast("信息不完整", "请填写 Agent 名称和业务用途。", "danger");
      return;
    }
    const createdAt = Date.now();
    const id = `new-agent-draft-${createdAt}`;
    const promptKind = newAgentForm.type === "报告伴读 Agent" ? "report-reading" : newAgentForm.type === "报告核验 Agent" ? "report-verification" : newAgentForm.type === "报告草稿 Agent" ? "report-draft" : "insight";
    const draft = {
      id,
      agentId: null,
      name: newAgentForm.name.trim(),
      type: newAgentForm.type,
      basedOn: null,
      proposedRelease: "1.0",
      goal: newAgentForm.purpose.trim(),
      purpose: newAgentForm.purpose.trim(),
      inputContract: "待配置",
      outputContract: "待配置",
      prompt: { id: `prompt-${promptKind}-${createdAt}`, version: "草稿" },
      promptName: `${newAgentForm.name.trim()}任务边界`,
      promptBaseVersion: null,
      promptContent: "",
      skills: [],
      tools: [],
      ontology: "待配置精确 Published 版本",
      ontologyScope: "待配置",
      scenario: newAgentForm.type === "报告伴读 Agent" ? "报告上下文按请求绑定" : newAgentForm.type === "报告核验 Agent" ? "报告核验上下文按请求绑定" : "待引用场景清单",
      scenarioBinding: scenarioBindingFromScenario(newAgentForm.type === "报告伴读 Agent" ? "报告上下文按请求绑定" : newAgentForm.type === "报告核验 Agent" ? "报告核验上下文按请求绑定" : "待引用场景清单", newAgentForm.type),
      status: "draft",
      dirty: false,
      validation: { status: "draft", at: null, issues: [] },
      debugRuns: []
    };
    setModel((current) => ({ ...current, drafts: [draft, ...current.drafts] }));
    setNewAgentForm({ name: "", type: "洞察 Agent", purpose: "" });
    setModal(null);
    setCatalogTab("drafts");
    navigate("draft-config", id);
    toast("配置草稿已创建", "完成资源绑定、调试和验证后才能发布。", "success");
  }

  function startDebugRun(draft) {
    const evidence = model.evidencePackages.find((item) => item.id === debugForm.evidenceId);
    if (!debugForm.input.trim() || !evidence) {
      toast("调试输入不完整", "请输入测试任务并选择固定证据包。", "danger");
      return;
    }
    const debugContextIssue = requestContextIssue({ ...draft, scenarioBinding: draft.scenarioBinding }, evidence, null, false);
    if (debugContextIssue) {
      toast("调试输入被阻断", debugContextIssue.reason, "danger");
      return;
    }
    const number = model.sequence.debug + 1;
    const id = `DBG-${compactDate()}-${String(number).padStart(3, "0")}`;
    const run = {
      id,
      status: "waiting",
      createdAt: nowText(),
      finishedAt: null,
      input: debugForm.input,
      evidenceId: evidence.id,
      condition: debugForm.condition,
      snapshot: {
        draftId: draft.id,
        proposedRelease: draft.proposedRelease,
        prompt: `${draft.prompt.id} · 草稿`,
        skills: deepClone(draft.skills),
        tools: [...draft.tools],
        toolBindings: draft.tools.map((toolId) => { const tool = getTool(toolId); return { id: toolId, version: tool?.version || "无法定位", name: tool?.name || toolId, owner: tool?.owner || "无法定位" }; }),
        ontology: draft.ontology,
        scenarioBinding: deepClone(draft.scenarioBinding),
        inputContract: draft.inputContract,
        outputContract: draft.outputContract,
        requestContext: deepClone(evidence.requestContext),
        dataVersion: evidence.dataVersion,
        dataAsOf: evidence.dataAsOf,
        configFingerprint: draftConfigurationFingerprint(draft),
        evidence: deepClone(evidence)
      },
      toolCalls: draft.tools.slice(0, 5).map((toolId, index) => { const tool = getTool(toolId); return { id: `${id}-tool-${index + 1}`, toolId, toolVersion: tool?.version || "无法定位", toolName: tool?.name || toolId, toolOwner: tool?.owner || "无法定位", status: "waiting", duration: null, input: "等待输入门通过", output: null }; }),
      result: null,
      error: null,
      recovery: null
    };
    setModel((current) => ({
      ...current,
      sequence: { ...current.sequence, debug: number },
      drafts: current.drafts.map((item) => item.id === draft.id ? { ...item, debugRuns: [run, ...(item.debugRuns || [])] } : item)
    }));
    toast("调试已进入等待", "本次配置、证据与版本已固定。", "success");
  }

  function advanceDebugRun(draftId, runId) {
    setModel((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => draft.id === draftId ? {
        ...draft,
        debugRuns: draft.debugRuns.map((run) => run.id === runId && run.status === "waiting" ? {
          ...run,
          status: "running",
          toolCalls: run.toolCalls.map((call, index) => index === 0 ? { ...call, status: "running", input: "固定证据包与版本摘要" } : call)
        } : run)
      } : draft)
    }));
  }

  function finishDebugRun(draftId, runId) {
    setModel((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => {
        if (draft.id !== draftId) return draft;
        return {
          ...draft,
          debugRuns: draft.debugRuns.map((run) => {
            if (run.id !== runId || run.status !== "running") return run;
            const evidence = run.snapshot.evidence || current.evidencePackages.find((item) => item.id === run.evidenceId);
            const unavailableTool = run.snapshot.tools.map(getTool).find((tool) => tool && tool.availability !== "available");
            const reportMismatch = draft.type === "报告伴读 Agent" && !evidence?.report;
            const blockedCondition = ["quality", "permission", "missing", "version"].includes(run.condition) || evidence?.status !== "ready" || reportMismatch || unavailableTool;
            const failed = run.condition === "tool";
            const partial = run.condition === "partial";
            const status = failed ? "failed" : blockedCondition ? "blocked" : partial ? "partial" : "complete";
            const reasons = {
              quality: "固定输入未通过质量门，当前证据不能用于生成。",
              permission: "当前账号无权读取选定证据范围。",
              missing: "固定证据包缺少输出合同要求的必填证据。",
              version: "Agent 草稿的已发布本体绑定与证据包版本不兼容。",
              tool: "工具调用超时，未取得可验证输出。",
              partial: "部分证据可读取，结果仅覆盖已验证范围。"
            };
            const error = unavailableTool ? `${unavailableTool.name} 当前${unavailableTool.availabilityLabel}，不能加入可发布配置。` : reportMismatch ? "报告伴读 Agent 只能使用报告中心提交的固定报告上下文。" : reasons[run.condition] || (evidence?.status !== "ready" ? evidence?.quality : null);
            const toolCalls = run.toolCalls.map((call, index) => {
              if (status === "complete" || status === "partial") return { ...call, status: index === run.toolCalls.length - 1 && partial ? "partial" : "complete", duration: `${160 + index * 91} ms`, input: index === 0 ? "固定证据包与版本摘要" : "上一步获准结构化输出", output: index === run.toolCalls.length - 1 ? "输出结构与证据引用校验结果" : "获准结构化摘要" };
              if (index === 0) return { ...call, status, duration: "184 ms", output: error };
              return { ...call, status: "skipped", output: "输入门未通过" };
            });
            return {
              ...run,
              status,
              finishedAt: nowText(),
              toolCalls,
              error: status === "complete" ? null : error,
              recovery: status === "complete" ? null : unavailableTool ? "移除不可用工具或等待合同完成后创建新工具版本，再重新调试。" : run.condition === "version" ? "选择与证据包一致的精确已发布版本后重新调试。" : run.condition === "quality" || evidence?.status !== "ready" ? "改用当前可信固定证据，或等待质量问题解决后创建新的调试运行。" : run.condition === "permission" ? "申请获准证据范围后创建新的调试运行。" : "修正输入或配置后重新调试。",
              result: status === "complete" || status === "partial" ? {
                title: draft.type === "报告伴读 Agent" ? "当前章节结论与证据说明" : "融资成本与债务结构关注项",
                summary: draft.type === "报告伴读 Agent" ? "固定报告证据显示，高成本融资余额较上期增加，变化集中在已命中关注规则的主体；该回答仅解释当前报告版本。" : "固定证据显示融资成本、期限结构与高成本融资主体需要共同关注；以下内容仍需人工确认。",
                citations: evidence.items.slice(0, 3).map((item) => item.id),
                outputValidation: status === "complete" ? "结构、必填项与证据引用通过" : "仅通过已验证范围",
                confirmation: "unconfirmed"
              } : null
            };
          })
        };
      })
    }));
    setTimeout(() => {
      const draft = model.drafts.find((item) => item.id === draftId);
      const run = draft?.debugRuns.find((item) => item.id === runId);
      if (run?.status === "running") toast("调试已完成", "请查看工具轨迹、输出合同和限制。", "success");
    }, 0);
  }

  function cancelDebugRun(draftId, runId) {
    updateDraft(draftId, (draft) => ({
      ...draft,
      debugRuns: draft.debugRuns.map((run) => run.id === runId && ["waiting", "running"].includes(run.status) ? {
        ...run,
        status: "cancelled",
        finishedAt: nowText(),
        toolCalls: run.toolCalls.map((call) => ["complete", "failed"].includes(call.status) ? call : { ...call, status: "cancelled" })
      } : run)
    }), false);
    toast("调试已取消", "已完成的工具调用和输入快照仍保留。", "success");
  }

  function clearDebugRuns(draftId) {
    updateDraft(draftId, (draft) => ({ ...draft, debugRuns: [] }));
    toast("本次调试已清空", "配置草稿未改变；发布验证已失效，需要重新调试。", "success");
  }

  function validateDraft(draft) {
    updateDraft(draft.id, (item) => ({ ...item, validation: { status: "validating", at: nowText(), issues: [] } }), false);
    toast("正在验证配置", "检查精确版本、工具、证据边界、本体兼容与输出合同。");
    setTimeout(() => {
      setModel((current) => ({
        ...current,
        drafts: current.drafts.map((item) => {
          if (item.id !== draft.id) return item;
          const issues = [];
          if (!item.scenarioBinding?.id || !item.scenarioBinding?.version || item.scenarioBinding?.status !== "ready") issues.push("未固定可用的场景绑定版本");
          if (item.scenarioBinding?.mode === "fixed" && (!item.scenarioBinding.scenarioId || !item.scenarioBinding.objectScope)) issues.push("固定场景绑定缺少场景标识或目标对象范围");
          if (["待配置", ""].includes(item.inputContract)) issues.push("输入合同未固定");
          if (["待配置", ""].includes(item.outputContract)) issues.push("输出合同未固定");
          if (!/^\d+\.\d+$/.test(item.proposedRelease || "")) issues.push("目标 Agent Release 需使用主版本.次版本格式");
          if (!item.promptContent?.trim()) issues.push("Prompt 内容为空");
          if (!item.skills.length) issues.push("未绑定可用 Skill");
          if (!item.tools.length) issues.push("工具白名单为空");
          const expectedContracts = expectedContractsForType(item.type);
          if (expectedContracts && item.inputContract !== expectedContracts.input) issues.push(`${item.type} 的输入合同应为 ${expectedContracts.input}`);
          if (expectedContracts && item.outputContract !== expectedContracts.output) issues.push(`${item.type} 的输出合同应为 ${expectedContracts.output}`);
          item.skills.forEach((binding) => {
            const skill = getSkill(binding.id, binding.version);
            if (!skill.value) issues.push(`${binding.id} 的精确版本 ${binding.version} 无法定位`);
            else {
              if (skill.value.status !== "published") issues.push(`${skill.resource.name} ${binding.version} 尚未发布`);
              if (!skill.value.compatibleTypes.includes(item.type)) issues.push(`${skill.resource.name} 与 ${item.type} 不兼容`);
              skill.value.toolIds.forEach((toolId) => {
                if (!item.tools.includes(toolId)) issues.push(`${skill.resource.name} 所需工具 ${getTool(toolId)?.name || toolId} 未加入白名单`);
              });
            }
          });
          item.tools.forEach((toolId) => {
            const tool = getTool(toolId);
            if (!tool || tool.availability !== "available") issues.push(`${tool?.name || toolId} 当前不可用于发布`);
            if (tool && !tool.compatible.includes(item.type.replace(" Agent", "")) && tool.compatible !== "全部 Agent 类型" && !tool.compatible.includes(item.type)) issues.push(`${tool.name} 与 ${item.type} 不兼容`);
          });
          const successfulDebug = item.debugRuns.find((run) => run.status === "complete" && run.snapshot.configFingerprint === draftConfigurationFingerprint(item));
          if (usesReportContextOntology(item)) {
            const reportVersionIssue = reportContextVersionIssue(item, successfulDebug?.snapshot?.evidence);
            if (reportVersionIssue) issues.push(reportVersionIssue);
          } else if (!item.ontology.includes("Published")) issues.push("未固定精确的已发布本体版本");
          const currentFingerprint = draftConfigurationFingerprint(item);
          if (!successfulDebug) issues.push("缺少与当前 Prompt、Skill、工具、本体和合同完全一致的成功调试");
          const existingAgent = current.agents.find((agent) => agent.id === item.agentId);
          if (existingAgent?.releases.some((release) => release.version === item.proposedRelease)) issues.push(`Agent Release ${item.proposedRelease} 已存在`);
          if (getPrompt(item.prompt.id, null, current.resourceReleases?.prompts || []).versions.some((version) => version.version === item.proposedRelease)) issues.push(`Prompt 版本 ${item.proposedRelease} 已存在`);
          if (item.id === "draft-report-generation") issues.push("报告定义、章节和评审副本接收合同尚未完成");
          return { ...item, dirty: false, validation: { status: issues.length ? "blocked" : "validated", at: nowText(), fingerprint: currentFingerprint, issues } };
        })
      }));
      toast("验证完成", "请查看验证结果与需要恢复的配置项。", "success");
    }, 1100);
  }

  function publishDraft(draft) {
    const issue = draftPublishIssue(model.drafts.find((item) => item.id === draft.id), model);
    if (issue) {
      toast("发布被阻断", issue, "danger");
      return;
    }
    if (publishLocksRef.current.has(draft.id)) return;
    publishLocksRef.current.add(draft.id);
    const agentId = draft.agentId || `agent-${Date.now()}`;
    let committed = false;
    let blockedReason = null;
    let releasedVersion = draft.proposedRelease;
    setModel((current) => {
      const currentDraft = current.drafts.find((item) => item.id === draft.id);
      blockedReason = draftPublishIssue(currentDraft, current);
      if (blockedReason) return current;
      const newPromptVersion = currentDraft.proposedRelease;
      releasedVersion = newPromptVersion;
      const promptLookup = getPrompt(currentDraft.prompt.id, currentDraft.promptBaseVersion, current.resourceReleases?.prompts || []);
      const dynamicPrompt = {
        id: currentDraft.prompt.id,
        value: {
          version: newPromptVersion,
          status: "published",
          validatedAt: currentDraft.validation.at,
          change: `由 ${currentDraft.basedOn ? `Release ${currentDraft.basedOn}` : "新配置"} 验证发布`,
          variables: promptLookup.value?.variables || ["任务输入", "固定证据包", "输出合同"],
          contextBoundary: "只使用运行时固定的获准上下文，不自行扩大证据或选择版本。",
          outputContracts: [currentDraft.outputContract],
          sections: currentDraft.promptContent.split(/\n\n+/).map((block, index) => {
            const lines = block.split("\n");
            return { title: lines[0] || `配置段 ${index + 1}`, body: lines.slice(1).join("\n") || lines[0] };
          })
        },
        name: currentDraft.promptName || promptLookup.resource?.name || currentDraft.prompt.id
      };
      const release = {
        version: currentDraft.proposedRelease,
        releasedAt: nowText(),
        validationAt: currentDraft.validation.at,
        inputContract: currentDraft.inputContract,
        outputContract: currentDraft.outputContract,
        prompt: { id: currentDraft.prompt.id, version: newPromptVersion },
        skills: deepClone(currentDraft.skills),
        tools: [...currentDraft.tools],
        ontology: currentDraft.ontology,
        ontologyScope: currentDraft.ontologyScope,
        scenarioBinding: deepClone(currentDraft.scenarioBinding),
        change: currentDraft.basedOn ? `基于 Release ${currentDraft.basedOn} 的配置更新` : "首次发布"
      };
      const existing = current.agents.find((agent) => agent.id === currentDraft.agentId);
      const agents = existing ? current.agents.map((agent) => agent.id === existing.id ? {
        ...agent,
        name: currentDraft.name,
        purpose: currentDraft.purpose,
        activeRelease: release.version,
        status: "enabled",
        scenario: scenarioBindingLabel(release, agent.scenario),
        releases: [release, ...agent.releases]
      } : agent) : [{
        id: agentId,
        name: currentDraft.name,
        shortName: currentDraft.name,
        type: currentDraft.type,
        purpose: currentDraft.purpose,
        status: "enabled",
        activeRelease: release.version,
        scenario: scenarioBindingLabel(release, currentDraft.scenario),
        releases: [release]
      }, ...current.agents];
      committed = true;
      return {
        ...current,
        agents,
        drafts: current.drafts.filter((item) => item.id !== currentDraft.id),
        resourceReleases: { ...(current.resourceReleases || {}), prompts: [dynamicPrompt, ...((current.resourceReleases || {}).prompts || [])] }
      };
    });
    setTimeout(() => {
      publishLocksRef.current.delete(draft.id);
      if (!committed) {
        toast("发布被阻断", blockedReason || "配置状态已变化，请刷新后重新验证。", "danger");
        return;
      }
      setCatalogTab("released");
      replaceNavigate("agent-detail", agentId);
      toast("新 Release 已发布并启用", `正式目录已切换到 Release ${releasedVersion}；历史运行和编排引用保持原版本。`, "success");
    }, 0);
  }

  function setAgentStatus(agent, enabled) {
    updateAgent(agent.id, (item) => ({ ...item, status: enabled ? "enabled" : "disabled" }));
    setModal(null);
    toast(enabled ? "Agent 已重新启用" : "Agent 已停用", enabled ? "可继续创建新运行。" : "不能创建新运行；历史 Release、运行和结果保留。", "success");
  }

  function openRunModal(defaults = {}) {
    const requestedAgent = defaults.agentId ? model.agents.find((item) => item.id === defaults.agentId) : null;
    if (["报告伴读 Agent", "报告核验 Agent", "报告草稿 Agent"].includes(requestedAgent?.type) && !defaults.requestId) {
      setRunTab("requests");
      navigate("runs");
      toast("请从报告请求开始", requestedAgent.type === "报告草稿 Agent" ? "报告草稿正式运行必须使用报告中心提交的 C022、报告定义、模板槽位和固定证据上下文。" : requestedAgent.type === "报告核验 Agent" ? "报告自动核验必须使用报告中心提交的报告内容版本、稳定锚点、核验定义和固定证据上下文。" : "报告伴读正式运行必须使用报告中心提交的报告版本、章节锚点和固定证据上下文。", "danger");
      return;
    }
    const fallbackAgent = model.agents.find((item) => item.status === "enabled" && !["报告伴读 Agent", "报告核验 Agent", "报告草稿 Agent"].includes(item.type));
    const agentId = defaults.agentId || fallbackAgent?.id || "";
    const agent = model.agents.find((item) => item.id === agentId);
    const evidenceKind = agent?.type === "报告伴读 Agent" ? "report" : agent?.type === "报告核验 Agent" ? "report-verification" : agent?.type === "报告草稿 Agent" ? "report-generation" : "finance";
    const evidenceOptions = model.evidencePackages.filter((item) => currentProjection(item) && item.kind === evidenceKind);
    const evidenceId = defaults.evidenceId || evidenceOptions[0]?.id || "";
    const evidence = model.evidencePackages.find((item) => item.id === evidenceId);
    if (evidence) {
      const readResult = readCurrentExternalCredibility(evidence);
      setModel((current) => ({
        ...current,
        evidencePackages: current.evidencePackages.map((item) => item.id === evidence.id ? readResult.evidence : item)
      }));
    }
    setRunForm({ agentId, evidenceId, requestId: defaults.requestId || null, replacesRun: defaults.replacesRun || null, condition: defaults.condition || "normal" });
    setModal({ type: "run" });
  }

  function makeRunSnapshot(agent, release, evidence, request = null) {
    const prompt = getPrompt(release.prompt.id, release.prompt.version, model.resourceReleases?.prompts || []);
    const requestContext = evidence.requestContext;
    const suppliedScenarioContext = normalizeScenarioContext(request?.scenarioContext || evidence.scenarioContext || requestContext || {});
    const activeScenarioContext = readActiveScenarioContext();
    const scenarioContext = scenarioContextReady(suppliedScenarioContext)
      ? suppliedScenarioContext
      : scenarioContextReady(activeScenarioContext) && (!requestContext?.scenarioId || requestContext.scenarioId === activeScenarioContext.scenarioId)
        ? activeScenarioContext
        : suppliedScenarioContext;
    const fixedRequestContext = {
      ...requestContext,
      scenarioId: scenarioContext.scenarioId || requestContext?.scenarioId || null,
      scenarioVersion: scenarioContext.scenarioVersion || requestContext?.scenarioVersion || null,
      scenarioRunId: scenarioContext.scenarioRunId || requestContext?.scenarioRunId || null,
      scenarioFormedAt: scenarioContext.formedAt || requestContext?.scenarioFormedAt || null,
      scenarioStatus: scenarioContext.status || requestContext?.scenarioStatus || null
    };
    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRelease: release.version,
      scenarioBinding: deepClone(release.scenarioBinding),
      requestContext: deepClone(fixedRequestContext),
      scenarioId: fixedRequestContext.scenarioId,
      scenarioVersion: fixedRequestContext.scenarioVersion,
      scenarioRunId: fixedRequestContext.scenarioRunId,
      scenarioFormedAt: scenarioContext.formedAt,
      scenarioStatus: scenarioContext.status,
      scenarioContext: deepClone(scenarioContext),
      scenario: fixedRequestContext.scenarioLabel,
      objectScope: fixedRequestContext.objectScope,
      expectedOutput: fixedRequestContext.expectedOutput,
      prompt: deepClone(release.prompt),
      promptBinding: { id: release.prompt.id, version: release.prompt.version, name: prompt.resource?.name || release.prompt.id },
      skills: deepClone(release.skills),
      skillBindings: release.skills.map((binding) => { const skill = getSkill(binding.id, binding.version); return { ...deepClone(binding), name: skill.resource?.name || binding.id }; }),
      tools: [...release.tools],
      toolBindings: release.tools.map((toolId) => { const tool = getTool(toolId); return { id: toolId, version: tool?.version || "无法定位", name: tool?.name || toolId, owner: tool?.owner || "无法定位" }; }),
      ontology: release.ontology,
      ontologyScope: release.ontologyScope,
      inputContract: release.inputContract,
      outputContract: release.outputContract,
      evidenceId: evidence.id,
      evidencePackageId: evidence.evidencePackageId || evidence.id,
      evidencePackageVersion: evidence.evidencePackageVersion || null,
      evidenceName: evidence.name,
      dataVersion: evidence.dataVersion,
      dataAssetVersionId: evidence.dataAssetVersionId || null,
      consumableVersionId: evidence.consumableVersionId || null,
      dataAsOf: evidence.dataAsOf,
      ontologyVersion: evidence.ontologyVersion,
      semanticVersionId: evidence.semanticVersionId || null,
      quality: evidence.quality,
      freshness: evidence.freshness,
      evidenceStatus: evidence.status,
      evidencePreviousId: evidence.previousId || null,
      evidenceAuthority: evidence.authority,
      evidenceFormedAt: evidence.formedAt,
      credibility: deepClone(evidence.credibility),
      evidenceItems: deepClone(evidence.items),
      report: deepClone(evidence.report),
      reportGeneration: deepClone(evidence.generation),
      requestId: request?.id || null,
      question: request?.question || (agent.type === "报告伴读 Agent" ? evidence.report?.question : agent.type === "报告草稿 Agent" ? "按固定报告定义、模板槽位和证据包生成结构化源草稿" : "识别融资成本与债务结构关注项"),
      reportAggregateId: request?.reportAggregateId || evidence.generation?.identity?.aggregateId || null,
      reportDefinitionId: request?.reportDefinitionId || evidence.generation?.identity?.reportDefinitionId || null,
      reportDefinitionVersion: request?.reportDefinitionVersion || evidence.generation?.identity?.reportDefinitionVersion || null,
      templateId: request?.templateId || evidence.generation?.identity?.templateId || null,
      templateVersion: request?.templateVersion || evidence.generation?.identity?.templateVersion || null,
      reportNumber: request?.reportNumber || evidence.report?.number || null,
      contentVersion: request?.contentVersion || evidence.report?.contentVersion || null,
      reportVersion: request?.reportVersion || (evidence.report ? `${evidence.report.number || evidence.report.name} · ${evidence.report.contentVersion}` : null),
      anchorSnapshotId: request?.anchorSnapshotId || evidence.report?.anchorSnapshotId || null,
      anchorSnapshotVersion: request?.anchorSnapshotVersion || evidence.report?.anchorSnapshotVersion || null,
      anchor: request?.anchor || evidence.report?.anchor || null,
      verificationSummary: evidence.report?.verification || null,
      verificationRunRef: evidence.report?.verificationRunRef || null,
      contextIntent: request?.c024?.reportContext?.contextIntent || evidence.report?.contextIntent || "report-qa-fixed",
      comparisonReference: deepClone(request?.c024?.reportContext?.comparisonReference || evidence.report?.comparisonReference || null),
      regenerationStatus: request?.regenerationStatus || "尚未请求",
      regenerationRef: request?.regenerationRef || null
    };
  }

  function startFormalRun(form = runForm, relation = {}) {
    const agent = model.agents.find((item) => item.id === form.agentId);
    const release = getAgentRelease(agent, relation.snapshot?.agentRelease);
    const currentEvidence = model.evidencePackages.find((item) => item.id === form.evidenceId);
    const readResult = !relation.snapshot && currentEvidence ? readCurrentExternalCredibility(currentEvidence) : null;
    const evidence = relation.snapshot ? evidenceFromSnapshot(relation.snapshot) : readResult?.evidence || currentEvidence;
    const retrySource = relation.retryOf ? model.runs.find((item) => item.id === relation.retryOf) : null;
    const requestId = form.requestId || relation.snapshot?.requestId || null;
    const request = model.inboundRequests.find((item) => item.id === requestId);
    const activeScenarioContext = readActiveScenarioContext();
    if (!agent || !release || !evidence) {
      toast("无法创建运行", "Agent Release 或固定证据上下文不完整。", "danger");
      return;
    }
    if (readResult) {
      setModel((current) => ({
        ...current,
        evidencePackages: current.evidencePackages.map((item) => item.id === evidence.id ? readResult.evidence : item)
      }));
    }
    if (agent.status !== "enabled") {
      toast("无法创建运行", "该 Agent 当前已停用；可查看历史 Release、运行和结果，重新启用后再创建新运行。", "danger");
      return;
    }
    if (agent.type === "报告伴读 Agent") {
      if (!request) {
        toast("缺少报告上下文请求", "正式报告伴读只能从报告中心提交的报告版本、锚点与固定证据上下文开始。", "danger");
        return;
      }
      if (!currentProjection(request) || !currentProjection(currentEvidence)) {
        toast("历史上下文只读", "当前场景工作投影已重置或切换；历史请求与固定证据不能创建或重试新的报告伴读运行。", "danger");
        return;
      }
      if (!retrySource && request.status !== "pending") {
        toast("报告请求已处理", "同一报告中心请求不能重复创建新的 Session；请查看关联运行。", "danger");
        return;
      }
      if (model.runs.some((run) => run.requestId === request.id && ["waiting", "running"].includes(run.status))) {
        toast("报告请求正在处理", "请查看已创建的运行，不要重复提交同一上下文。", "danger");
        return;
      }
      const reportIdentityMatches = evidence.report
        && request.reportNumber === evidence.report.number
        && request.contentVersion === evidence.report.contentVersion
        && request.evidencePackageId === evidence.evidencePackageId
        && request.evidencePackageVersion === evidence.evidencePackageVersion
        && request.semanticVersionId === evidence.semanticVersionId
        && request.semanticVersion === evidence.ontologyVersion
        && request.dataAssetVersionId === evidence.dataAssetVersionId
        && request.dataVersion === evidence.dataVersion
        && request.dataAsOf === evidence.dataAsOf
        && request.anchor === evidence.report.anchor;
      const requestMatchesSnapshot = !relation.snapshot || (relation.snapshot.requestId === request.id
        && sameScenarioContext(relation.snapshot.scenarioContext || relation.snapshot, request.scenarioContext)
        && relation.snapshot.reportNumber === request.reportNumber
        && relation.snapshot.contentVersion === request.contentVersion
        && relation.snapshot.evidencePackageId === request.evidencePackageId
        && relation.snapshot.evidencePackageVersion === request.evidencePackageVersion
        && relation.snapshot.semanticVersionId === request.semanticVersionId
        && relation.snapshot.dataAssetVersionId === request.dataAssetVersionId
        && relation.snapshot.anchor === request.anchor
        && relation.snapshot.question === request.question
        && requestContextsMatch(relation.snapshot.requestContext, request.requestContext));
      const identityIssues = c024Issues(request.c024, activeScenarioContext);
      if (request.agentId !== agent.id || request.evidenceId !== evidence.id || !reportIdentityMatches || !requestMatchesSnapshot || identityIssues.length) {
        toast("报告上下文不一致", `${identityIssues.join("；") || "报告、内容、证据、场景轮次、语义或数据身份已经变化"}；请由报告中心提交新的完整 C024，Agent 不会静默改选。`, "danger");
        return;
      }
    }
    if (agent.type === "报告草稿 Agent") {
      if (!request) {
        toast("缺少报告生成请求", "正式报告草稿只能从报告中心提交的 C022、报告定义、模板槽位与固定证据开始。", "danger");
        return;
      }
      if (!currentProjection(request) || !currentProjection(currentEvidence)) {
        toast("历史上下文只读", "当前场景工作投影已重置或切换；历史 C022 与固定证据不能创建新的报告草稿运行。", "danger");
        return;
      }
      if (!retrySource && request.status !== "pending") {
        toast("生成请求已处理", "同一 C022 只能形成一个当前 C023 Run；请查看关联运行。", "danger");
        return;
      }
      if (model.runs.some((run) => run.requestId === request.id && ["waiting", "running"].includes(run.status))) {
        toast("生成请求正在处理", "请查看已创建的运行，不要重复提交同一固定上下文。", "danger");
        return;
      }
      const generation = evidence.generation;
      const identity = generation?.identity || {};
      const identityMatches = generation
        && request.reportAggregateId === identity.aggregateId
        && request.evidencePackageId === evidence.evidencePackageId
        && request.evidencePackageVersion === evidence.evidencePackageVersion
        && request.semanticVersionId === evidence.semanticVersionId
        && request.semanticVersion === evidence.ontologyVersion
        && request.dataAssetVersionId === evidence.dataAssetVersionId
        && request.dataVersion === evidence.dataVersion
        && request.consumableVersionId === evidence.consumableVersionId
        && request.dataAsOf === evidence.dataAsOf;
      const requestMatchesSnapshot = !relation.snapshot || (relation.snapshot.requestId === request.id
        && sameScenarioContext(relation.snapshot.scenarioContext || relation.snapshot, request.scenarioContext)
        && relation.snapshot.reportAggregateId === request.reportAggregateId
        && relation.snapshot.evidencePackageId === request.evidencePackageId
        && relation.snapshot.evidencePackageVersion === request.evidencePackageVersion
        && relation.snapshot.semanticVersionId === request.semanticVersionId
        && relation.snapshot.dataAssetVersionId === request.dataAssetVersionId
        && relation.snapshot.consumableVersionId === request.consumableVersionId
        && requestContextsMatch(relation.snapshot.requestContext, request.requestContext));
      const identityIssues = c022Issues(resolveC022Reference(request.c022 || request), activeScenarioContext);
      if (request.agentId !== agent.id || request.evidenceId !== evidence.id || !identityMatches || !requestMatchesSnapshot || identityIssues.length) {
        toast("报告生成上下文不一致", `${identityIssues.join("；") || "报告根、证据、场景轮次、语义或数据身份已经变化"}；请由报告中心提交新的完整 C022，Agent 不会静默改选。`, "danger");
        return;
      }
    }
    const replacesRun = relation.replacesRun || form.replacesRun || null;
    const baseRunGate = relation.snapshot
      ? (replacesRun ? formalRunGate(agent, release, evidence, request) : { mode: retrySource?.failureMode === "tool" ? "normal" : retrySource?.failureMode || "normal", reason: retrySource?.failureMode === "tool" ? null : retrySource?.error || null })
      : formalRunGate(agent, release, evidence, request);
    const requestedCondition = !relation.snapshot ? (form.condition || "normal") : "normal";
    const runGate = baseRunGate.mode === "normal" && ["tool", "partial"].includes(requestedCondition)
      ? { mode: requestedCondition, reason: requestedCondition === "tool" ? "受控工具调用超时，未取得可验证输出。" : "部分工具返回受限，只形成已验证范围内的结果。" }
      : baseRunGate;
    const number = model.sequence.run + 1;
    const retrySession = agent.type === "报告伴读 Agent" && retrySource?.sessionId ? model.sessions.find((item) => item.id === retrySource.sessionId) : null;
    if (retrySource?.sessionId && retrySession?.status !== "active") {
      toast("不能重试旧 Binding", "报告上下文已陈旧；请由报告中心提交新的上下文选择，再创建新 Session、Binding 和 Run。", "danger");
      return;
    }
    const reusableSession = retrySession?.status === "active" ? retrySession : null;
    const createsSession = agent.type === "报告伴读 Agent" && !reusableSession;
    const sessionNumber = model.sequence.session + (createsSession ? 1 : 0);
    const id = `RUN-${compactDate()}-${String(number).padStart(3, "0")}`;
    const snapshot = relation.snapshot || makeRunSnapshot(agent, release, evidence, request);
    const sessionId = reusableSession?.id || (createsSession ? `RSESSION-${compactDate()}-${String(sessionNumber).padStart(3, "0")}` : null);
    const bindingId = reusableSession?.bindingId || (createsSession ? `RBIND-${compactDate()}-${String(sessionNumber).padStart(3, "0")}` : null);
    const run = {
      id,
      status: "waiting",
      createdAt: nowText(),
      finishedAt: null,
      source: request ? "报告中心请求" : "Agent 应用",
      currentProjection: true,
      projectionStatus: "current",
      scenarioContext: deepClone(snapshot.scenarioContext || request?.scenarioContext || evidence.scenarioContext || null),
      requestId: request?.id || null,
      question: snapshot.question,
      failureMode: runGate.mode,
      gateReason: runGate.reason,
      gateRecovery: runGate.recovery || null,
      retryOf: relation.retryOf || null,
      replacesRun,
      attempt: relation.retryOf ? (model.runs.find((item) => item.id === relation.retryOf)?.attempt || 1) + 1 : 1,
      snapshot,
      sessionId,
      bindingId,
      orchestrationRunId: relation.orchestrationRunId || null,
      stepRunId: relation.stepRunId || null,
      steps: [
        { id: "input", name: "输入与版本校验", status: "running", detail: "核对 Agent Release、证据、本体和数据版本" },
        { id: "tools", name: "受控工具调用", status: "waiting", detail: "仅调用 Release 白名单内工具" },
        { id: "generate", name: "结构化生成", status: "waiting", detail: agent.type === "报告草稿 Agent" ? "只按报告定义和模板槽位组织固定证据" : "LLM 只解释固定证据" },
        { id: "output", name: "输出合同校验", status: "waiting", detail: snapshot.outputContract }
      ],
      toolCalls: snapshot.tools.map((toolId, index) => { const binding = snapshot.toolBindings?.find((item) => item.id === toolId); return { id: `${id}-TC-${index + 1}`, toolId, toolVersion: binding?.version || "无法定位", toolName: binding?.name || toolId, toolOwner: binding?.owner || "无法定位", status: "waiting", duration: null, input: "等待输入门通过", output: null }; }),
      result: null,
      error: null,
          recovery: runGate.recovery || null
    };
    const session = createsSession ? {
      id: sessionId,
      bindingId,
      requestContext: deepClone(snapshot.requestContext),
      currentProjection: true,
      projectionStatus: "current",
      scenarioContext: deepClone(request.scenarioContext),
      scenarioId: snapshot.scenarioId,
      scenarioVersion: snapshot.scenarioVersion,
      scenarioRunId: snapshot.scenarioRunId,
      scenarioFormedAt: snapshot.scenarioFormedAt,
      scenarioStatus: snapshot.scenarioStatus,
      reportNumber: snapshot.reportNumber,
      contentVersion: snapshot.contentVersion,
      reportVersion: snapshot.reportVersion,
      anchor: snapshot.anchor,
      evidenceId: snapshot.evidenceId,
      evidencePackageId: snapshot.evidencePackageId,
      evidencePackageVersion: snapshot.evidencePackageVersion,
      semanticVersionId: snapshot.semanticVersionId,
      ontologyVersion: snapshot.ontologyVersion,
      dataAssetVersionId: snapshot.dataAssetVersionId,
      dataVersion: snapshot.dataVersion,
      status: "active",
      createdAt: nowText(),
      latestRunId: id,
      latestResultId: null,
      resultReturnStatus: "等待运行结果",
      verificationSummary: snapshot.verificationSummary || "报告中心未随上下文提供确定性核验结果",
      verificationRunRef: snapshot.verificationRunRef,
      currentComparisonRef: snapshot.comparisonReference?.recordId || null,
      regenerationStatus: snapshot.regenerationStatus,
      regenerationRef: snapshot.regenerationRef
    } : null;
    setModel((current) => ({
      ...current,
      sequence: { ...current.sequence, run: number, session: sessionNumber },
      runs: [run, ...current.runs],
      sessions: session ? [session, ...current.sessions] : reusableSession ? current.sessions.map((item) => item.id === reusableSession.id ? { ...item, latestRunId: id } : item) : current.sessions,
      inboundRequests: current.inboundRequests.map((item) => item.id === form.requestId ? { ...item, status: "running", runId: id } : item)
    }));
    setModal(null);
    setRunTab("history");
    navigate("run-detail", id);
    toast("运行已进入等待", "本次 Agent Release、资源绑定和输入上下文已固定。", "success");
  }

  function advanceFormalRun(runId) {
    setModel((current) => ({
      ...current,
      runs: current.runs.map((run) => run.id === runId && run.status === "waiting" ? {
        ...run,
        status: "running",
        steps: run.steps.map((step, index) => index === 0 ? { ...step, status: "complete" } : index === 1 ? { ...step, status: "running" } : step),
        toolCalls: run.toolCalls.map((call, index) => index === 0 ? { ...call, status: "running", input: "固定输入与版本摘要" } : call)
      } : run)
    }));
  }

  function buildReportDraftResult(run, number) {
    const generation = hydrateReportGeneration(run.snapshot.reportGeneration || {}, run.requestId || run.snapshot.requestId);
    const reportEvidence = generation.reportEvidence || {};
    const fixedFacts = Array.isArray(reportEvidence.contentFacts) ? reportEvidence.contentFacts : [];
    const declaredItems = Array.isArray(reportEvidence.contentItems) ? reportEvidence.contentItems : [];
    const sourceItems = declaredItems.map((item, index) => {
      const factRefs = deepClone(item.factRefs || []);
      const evidenceRefs = deepClone(item.evidenceRefs || []);
      const requiresEvidence = item.requiresEvidence !== false;
      return {
        ...deepClone(item),
        sourceItemId: item.sourceItemId || `SRC-ITEM-${String(index + 1).padStart(3, "0")}`,
        contentItemId: item.contentItemId || `CONTENT-${String(index + 1).padStart(3, "0")}`,
        anchorId: item.anchorId || null,
        templateSlot: item.templateSlot || item.slot || null,
        factRefs,
        evidenceRefs,
        bindingStatus: requiresEvidence ? (factRefs.length && evidenceRefs.length ? "bound" : "missing") : "not-required",
        rendered: true
      };
    });
    const contentFacts = fixedFacts.map((fact, index) => ({
      ...deepClone(fact),
      contentFactId: `GCF-${String(index + 1).padStart(3, "0")}`,
      sourceFactId: fact.id || fact.factId,
      factId: fact.id || fact.factId,
      intendedFactId: fact.id || fact.factId,
      label: fact.label || fact.name || fact.id,
      kind: fact.kind || "事实项",
      value: deepClone(fact.value),
      authoritativeValue: deepClone(fact.value),
      unit: fact.unit || null,
      scope: fact.scope || "报告固定范围",
      resultVersion: fact.resultVersion || run.snapshot.dataVersion,
      evidenceRefs: deepClone(fact.evidence || fact.evidenceRefs || []),
      anchorIds: deepClone(fact.anchorIds || []),
      basis: deepClone(fact.basis || []),
      ruleSnapshot: deepClone(fact.ruleSnapshot || null),
      semanticSnapshot: deepClone(fact.semanticSnapshot || null),
      trustSnapshot: deepClone(fact.trustSnapshot || null),
      bindingStatus: "bound"
    }));
    const bindingGaps = sourceItems.filter((item) => item.bindingStatus === "missing").map((item) => ({ contentItemId: item.contentItemId, anchorId: item.anchorId, intendedFactRefs: deepClone(item.factRefs || []), reason: "来源内容项缺少事实或证据绑定" }));
    const suggestion = fixedFacts.find((fact) => fact.id === "FACT-SUGGESTION-BASIS" || fact.kind === "建议依据");
    const generatedNarratives = suggestion ? [{ id: "suggestion", text: String(suggestion.value ?? suggestion.displayValue ?? "") }] : [];
    const sourceDraftId = `SRC-DRAFT-${compactDate()}-${String(number).padStart(3, "0")}`;
    return {
      id: `RES-${compactDate()}-${String(number).padStart(3, "0")}`,
      version: "1.0",
      type: "Agent Report Draft",
      contract: run.snapshot.outputContract,
      title: "融资经营分析报告结构化源草稿",
      summary: `已按固定报告定义和模板槽位组织 ${sourceItems.length} 个源内容项、${contentFacts.length} 个事实绑定；${bindingGaps.length ? `${bindingGaps.length} 个内容项保留绑定缺口` : "全部需证据内容项已形成绑定"}。`,
      sections: [
        { title: "固定输入", body: `${run.snapshot.reportDefinitionId} ${run.snapshot.reportDefinitionVersion} / ${run.snapshot.templateId} ${run.snapshot.templateVersion} / 证据包 ${run.snapshot.evidencePackageId} ${run.snapshot.evidencePackageVersion}`, refs: [run.snapshot.evidencePackageId].filter(Boolean) },
        { title: "源内容项", body: `已形成 ${sourceItems.length} 个不可变源内容项，保持原模板槽位、事实引用、证据引用和锚点声明。`, refs: sourceItems.slice(0, 3).map((item) => item.sourceItemId) },
        { title: "绑定检查", body: bindingGaps.length ? `${bindingGaps.length} 个内容项缺少完整事实或证据绑定，报告中心复核副本应保留缺口并阻断发布。` : "所有需要证据的内容项均已绑定固定事实和证据引用。", refs: bindingGaps.map((item) => item.contentItemId) }
      ],
      limitations: "仅组织 C022 固定证据；不创建报告中心稳定锚点，不执行确定性核验，不确认内容，不发布 HTML 或 PDF。",
      confidence: bindingGaps.length ? "源草稿已形成；存在需报告中心复核的绑定缺口" : "源内容项、事实和证据引用已通过输出合同校验",
      generatedAt: nowText(),
      confirmation: "not-required",
      freshness: run.snapshot.freshness,
      owner: "Agent 应用",
      destination: "报告中心可按 C023 Run 与 Result 标识读取并形成独立评审副本",
      scenarioContext: deepClone(run.scenarioContext || run.snapshot.scenarioContext || {
        scenarioId: run.snapshot.scenarioId,
        scenarioVersion: run.snapshot.scenarioVersion,
        scenarioRunId: run.snapshot.scenarioRunId,
        formedAt: run.snapshot.scenarioFormedAt,
        status: run.snapshot.scenarioStatus
      }),
      scenarioId: run.snapshot.scenarioId,
      scenarioVersion: run.snapshot.scenarioVersion,
      scenarioRunId: run.snapshot.scenarioRunId,
      scenarioFormedAt: run.snapshot.scenarioFormedAt,
      scenarioStatus: run.snapshot.scenarioStatus,
      reportAggregateId: run.snapshot.reportAggregateId,
      evidencePackageId: run.snapshot.evidencePackageId,
      evidencePackageVersion: run.snapshot.evidencePackageVersion,
      semanticVersionId: run.snapshot.semanticVersionId,
      semanticVersion: run.snapshot.ontologyVersion,
      dataAssetVersionId: run.snapshot.dataAssetVersionId,
      dataVersion: run.snapshot.dataVersion,
      consumableVersionId: run.snapshot.consumableVersionId,
      dataAsOf: run.snapshot.dataAsOf,
      sourceDraftId,
      sourceItems,
      generatedContent: {
        contentRevision: generation.contentRevision || 1,
        contentFacts,
        bindingGaps,
        generatedNarratives,
        anchors: deepClone(reportEvidence.anchors || []),
        renderManifest: deepClone(reportEvidence.renderManifest || null)
      }
    };
  }

  function buildFormalResult(run, evidence, number) {
    if (run.snapshot.agentId === "report-draft") return buildReportDraftResult(run, number);
    const isReport = Boolean(run.sessionId);
    const hasVerificationReference = Boolean(run.snapshot.verificationRunRef);
    const items = run.snapshot.evidenceItems || [];
    const byId = (id, fallbackName = null) => items.find((item) => item.id === id || item.factId === id) || (fallbackName ? evidenceItemByName(items, fallbackName) : null);
    const highCost = byId("FACT-GROUP-HIGH-COST", "高成本融资余额");
    const highCostRule = evidenceItemByName(items, "高成本融资关注规则");
    const reportChange = evidenceItemByName(items, "较上期增加");
    const reportAnchor = items.find((item) => item.type === "报告锚点") || null;
    const balance = byId("FACT-GROUP-BALANCE", "集团融资余额");
    const cost = byId("FACT-GROUP-COST", "余额加权融资成本");
    const floating = byId("FACT-GROUP-FLOATING", "浮动利率余额占比");
    const shortDebt = byId("FACT-GROUP-SHORT", "短期债务余额占比");
    const institutionPriority = byId("FACT-R01-INSTITUTIONS");
    const r01Result = byId("FACT-R01-RESULT");
    const unit465Balance = byId("GCF-024");
    const unit465Cost = byId("GCF-025");
    const r02Result = byId("GCF-026");
    const r02Branch = byId("GCF-027");
    const r02Threshold = byId("GCF-028");
    const unit561Balance = byId("GCF-031");
    const unit561Cost = byId("GCF-032");
    const r03Result = byId("GCF-033");
    const r03Branch = byId("GCF-034");
    const r03Threshold = byId("GCF-035");
    const actionSuggestion = byId("GCF-042");
    const costTrend = byId("GCF-MIGRATED-FACT-JUDGMENT-COST-TREND");
    const actionType = items.find((item) => item.type === "Action Type") || null;
    const validRefs = (...refs) => refs.filter(Boolean).map((item) => item.id);
    const comparison = run.snapshot.comparisonReference;
    const explicitComparison = isReport && run.snapshot.contextIntent === "c027-explanation" && Boolean(comparison?.recordId);
    const reportQuestion = String(run.snapshot.question || "").trim();
    const asksUnit465Floating = /单位465/.test(reportQuestion) && /(浮动利率|利率暴露|重定价|R02)/i.test(reportQuestion);
    const asksUnit561ShortDebt = /单位561/.test(reportQuestion) && /(短期债务|期限|展期|R03)/i.test(reportQuestion);
    const asksUnit553Institutions = /单位553/.test(reportQuestion) && /(银行|机构|协商|高成本|R01)/i.test(reportQuestion);
    const asksCostTrend = /(融资成本).*(下降|变化|趋势)|为什么.*融资成本/i.test(reportQuestion);
    const comparisonCounts = comparison?.counts || { same: 0, changed: 0, unverifiable: 0 };
    const comparisonRecord = explicitComparison ? {
      id: comparison.recordId,
      owner: "报告中心",
      label: comparison.comparisonOutcome || comparison.gate || "确定性比较已完成",
      status: comparison.recordStatus || "当前",
      comparedAt: comparison.comparedAt,
      currentSummaryId: comparison.currentStatusSummaryRef?.id || null,
      currentSummaryVersion: comparison.currentStatusSummaryRef?.version || null,
      currentSummaryObservedAt: comparison.currentStatusSummaryRef?.formedAt || null,
      conclusion: comparison.comparisonOutcomeReason || null,
      counts: deepClone(comparisonCounts),
      resultRefs: (comparison.results || []).map((item) => item.factId || item.label).filter(Boolean)
    } : null;
    const missingOfficialValues = !isReport && (!balance || !cost || !highCost || !highCostRule || !shortDebt);
    const freshnessUnknown = evidence.freshness === "未知";
    let reportTitle = explicitComparison ? "报告快照与当前数据比较说明" : "集团融资成本与债务结构说明";
    let reportSummary = balance && cost && floating && highCost && shortDebt && r01Result && institutionPriority
      ? `截至 ${run.snapshot.dataAsOf}，集团融资余额 ${balance.value}，余额加权融资成本 ${cost.value}；浮动利率余额占比 ${floating.value}，高成本融资余额占比 ${highCost.value}。单位553的 R01 结论为${r01Result.value}，应优先与${institutionPriority.value}核对高成本融资置换空间。`
      : "报告固定证据不包含形成完整回答所需的全部事实，本次只返回可定位证据与限制。";
    let reportSections = explicitComparison ? [
      { title: "确定性比较结论", body: `${comparison.comparisonOutcome || comparison.gate}：${comparison.comparisonOutcomeReason || "报告中心未提供补充说明"}`, refs: [comparison.recordId] },
      { title: "逐项比较结果", body: `报告中心固定了 ${comparisonCounts.same || 0} 项无变化、${comparisonCounts.changed || 0} 项变化、${comparisonCounts.unverifiable || 0} 项无法比较；Agent 未重新计算任何事实。`, refs: (comparison.results || []).slice(0, 5).map((item) => item.factId || item.label).filter(Boolean) },
      { title: "使用边界", body: "该说明只解释已固定的 C027 比较记录；后续数据或可信度摘要变化只会使原记录陈旧，不会覆盖原比较结果。", refs: [comparison.recordId, comparison.currentStatusSummaryRef?.id].filter(Boolean) }
    ] : [
      { title: "集团融资与债务结构", body: balance && cost && floating && highCost && shortDebt ? `报告固定结果显示：集团融资余额 ${balance.value}，余额加权融资成本 ${cost.value}，浮动利率余额占比 ${floating.value}，高成本融资余额占比 ${highCost.value}，短期债务余额占比 ${shortDebt.value}。` : "固定报告证据未提供完整的融资与债务结构事实，本次不补写缺失数值。", refs: validRefs(balance, cost, floating, highCost, shortDebt) },
      { title: "单位553与协商机构", body: r01Result && institutionPriority ? `单位553的 R01 结论为${r01Result.value}；应优先核对并协商的机构为${institutionPriority.value}。该机构排序来自单位553的 R01 命中证据，不代表集团总体融资余额排名。` : "固定报告证据未同时提供单位553的 R01 结论和机构排序，本次不推断协商对象。", refs: validRefs(r01Result, institutionPriority) },
      hasVerificationReference
        ? { title: "核验解释", body: "金额和主体数量与报告中心提供的确定性核验结果一致；变化原因只在当前证据范围内解释。", refs: validRefs(reportAnchor, reportChange) }
        : { title: "回答边界", body: "本次只解释正式报告固定内容、稳定锚点和证据引用，不读取当前业务数据，不把建议写成已执行行动。", refs: validRefs(reportAnchor) }
    ];
    if (isReport && explicitComparison) {
      reportSummary = `报告中心比较记录 ${comparison.recordId} 显示：${comparisonCounts.same || 0} 项无变化、${comparisonCounts.changed || 0} 项变化、${comparisonCounts.unverifiable || 0} 项无法比较；结论为“${comparison.comparisonOutcome || comparison.gate}”。Agent 仅解释该记录。`;
    } else if (isReport && asksUnit465Floating) {
      reportTitle = "单位465浮动利率融资关注说明";
      reportSummary = r02Result && r02Branch && r02Threshold
        ? `单位465的 R02 结论为${r02Result.value}；报告固定触发条件为“${r02Branch.value}”，阈值为 ${r02Threshold.value}。因此应优先关注重定价风险，并按报告固定建议评估固定利率或利率上限安排。`
        : "报告固定证据未完整提供单位465的 R02 结果、触发条件和阈值，本次不补写缺失结论。";
      reportSections = [
        { title: "为什么需要优先关注", body: r02Result && r02Branch && r02Threshold ? `单位465的 R02 结论为${r02Result.value}；触发条件为“${r02Branch.value}”，阈值为 ${r02Threshold.value}。该结论说明当前固定报告范围内存在需要优先核对的浮动利率暴露。` : "固定报告证据未同时提供 R02 结果、触发条件和阈值，本次不推断原因。", refs: validRefs(r02Result, r02Branch, r02Threshold) },
        { title: "相关融资背景", body: unit465Balance && unit465Cost && floating ? `单位465融资余额为 ${unit465Balance.value}，加权融资成本为 ${unit465Cost.value}；集团浮动利率余额占比为 ${floating.value}。集团比例只用于说明报告背景，不替代单位465的 R02 正式结果。` : "固定报告证据未提供完整的单位余额、成本或集团浮动利率背景。", refs: validRefs(unit465Balance, unit465Cost, floating) },
        { title: "建议与边界", body: actionSuggestion ? `${actionSuggestion.value} 该建议尚未形成已执行行动，后续仍需通过受控行动申请和人工确认。` : "报告固定证据未提供可解释的建议依据；本回答不执行行动或创建待办。", refs: validRefs(actionSuggestion, reportAnchor) }
      ];
    } else if (isReport && asksUnit561ShortDebt) {
      reportTitle = "单位561短期债务关注说明";
      reportSummary = r03Result && r03Branch && r03Threshold
        ? `单位561的 R03 结论为${r03Result.value}；报告固定触发条件为“${r03Branch.value}”，阈值为 ${r03Threshold.value}。因此应优先核对集中到期压力和展期、置换安排。`
        : "报告固定证据未完整提供单位561的 R03 结果、触发条件和阈值，本次不补写缺失结论。";
      reportSections = [
        { title: "为什么需要优先关注", body: r03Result && r03Branch && r03Threshold ? `单位561的 R03 结论为${r03Result.value}；触发条件为“${r03Branch.value}”，阈值为 ${r03Threshold.value}。` : "固定报告证据未同时提供 R03 结果、触发条件和阈值，本次不推断原因。", refs: validRefs(r03Result, r03Branch, r03Threshold) },
        { title: "相关融资背景", body: unit561Balance && unit561Cost && shortDebt ? `单位561融资余额为 ${unit561Balance.value}，加权融资成本为 ${unit561Cost.value}；集团短期债务余额占比为 ${shortDebt.value}。集团比例只用于说明报告背景。` : "固定报告证据未提供完整的单位余额、成本或集团期限背景。", refs: validRefs(unit561Balance, unit561Cost, shortDebt) },
        { title: "建议与边界", body: actionSuggestion ? `${actionSuggestion.value} 该建议尚未形成已执行行动，后续仍需通过受控行动申请和人工确认。` : "报告固定证据未提供可解释的建议依据；本回答不执行行动或创建待办。", refs: validRefs(actionSuggestion, reportAnchor) }
      ];
    } else if (isReport && asksUnit553Institutions) {
      reportTitle = "单位553高成本融资协商说明";
      reportSummary = r01Result && institutionPriority
        ? `单位553的 R01 结论为${r01Result.value}，报告固定的优先协商机构为${institutionPriority.value}。该排序来自单位553的 R01 命中证据。`
        : "报告固定证据未同时提供单位553的 R01 结果和机构排序，本次不推断协商对象。";
      reportSections = [
        { title: "规则结论", body: r01Result ? `单位553的 R01 结论为${r01Result.value}。` : "固定报告证据未提供单位553的 R01 结果。", refs: validRefs(r01Result) },
        { title: "优先协商机构", body: institutionPriority ? `应优先核对并协商的机构为${institutionPriority.value}。该排序来自单位553的 R01 命中证据，不代表集团总体融资余额排名。` : "固定报告证据未提供可核对的机构排序。", refs: validRefs(institutionPriority) },
        { title: "回答边界", body: "本次只解释报告固定的规则和机构证据；不代表已经发起协商、确认行动或创建待办。", refs: validRefs(reportAnchor) }
      ];
    } else if (isReport && asksCostTrend) {
      reportTitle = "集团融资成本趋势说明";
      reportSummary = costTrend ? String(costTrend.value) : "报告固定证据未提供可解释的融资成本趋势判断。";
      reportSections = [
        { title: "趋势结论", body: costTrend ? String(costTrend.value) : "固定报告证据未提供趋势判断，本次不自行计算变化。", refs: validRefs(costTrend) },
        { title: "当前固定结果", body: cost ? `报告固定的余额加权融资成本为 ${cost.value}。` : "固定报告证据未提供当前余额加权融资成本。", refs: validRefs(cost) },
        { title: "回答边界", body: "趋势说明只使用报告固定序列和已有判断，不读取当前业务数据，不重新计算或外推原因。", refs: validRefs(reportAnchor) }
      ];
    }
    return {
      id: `RES-${compactDate()}-${String(number).padStart(3, "0")}`,
      type: isReport ? "Report Copilot Result" : "AI Insight",
      contract: run.snapshot.outputContract,
      title: isReport ? reportTitle : "融资成本与债务结构关注项",
      summary: isReport
        ? reportSummary
        : (missingOfficialValues ? "本次固定证据未提供形成完整正式洞察所需的全部指标或 Rule 值；结果仅说明缺失范围，不沿用其他版本数值。" : `集团融资余额为 ${balance.value}，余额加权融资成本为 ${cost.value}。高成本融资余额 ${highCost.value}，${highCostRule.value}；短期债务余额占比 ${shortDebt.value}，建议优先核对命中主体的融资结构与可替代融资安排。`),
      sections: isReport ? reportSections : [
        { title: "高成本融资集中", body: highCost && highCostRule ? `高成本融资余额 ${highCost.value}，${highCostRule.value}。` : "本次固定证据缺少完整的高成本融资指标或 Rule 命中结果。", refs: validRefs(highCost, highCostRule) },
        { title: "期限结构关注", body: shortDebt ? `短期债务余额占比为 ${shortDebt.value}，需结合到期分布安排融资衔接。` : "本次固定证据未提供短期债务余额占比。", refs: validRefs(shortDebt) },
        { title: "行动候选", body: actionType ? (freshnessUnknown ? `已发现固定的 ${actionType.name}，但数据新鲜度未知，本结果不得据此确认或发起行动申请。` : `可按固定的 ${actionType.name} 形成申请候选，后续人工确认与待办由决策中心处理。`) : "本次固定证据未提供可用的已发布行动类型，不形成行动候选。", refs: validRefs(actionType) }
      ],
      limitations: isReport ? (explicitComparison ? "只解释报告中心固定的当前数据比较记录；不重新读取业务明细、不重新计算比较、不修改原报告或原记录。" : `不扩展到报告固定证据包之外；不修改报告，不执行行动或创建待办。${freshnessUnknown ? " 数据新鲜度未知，不得将本回答解释为当前事实。" : ""}`) : `${missingOfficialValues ? "固定证据缺少正式输出所需值；不得借用其他版本补齐。" : ""}${freshnessUnknown ? "数据新鲜度未知，本结果仅供查看且不得确认或发起行动申请。" : ""}结果不是已确认业务事实，不替代指标、规则或人工决策。`,
      confidence: explicitComparison ? "报告中心确定性比较记录和精确版本引用完整；Agent 未生成新的比较事实" : isReport ? "报告固定事实和证据引用完整；业务解释不替代人工决策" : freshnessUnknown ? "证据引用完整；新鲜度未知，不能进入人工确认" : "证据引用完整；业务建议需人工确认",
      generatedAt: nowText(),
      confirmation: "unconfirmed",
      freshness: evidence.freshness,
      owner: "Agent 应用",
      scenarioContext: deepClone(run.scenarioContext || run.snapshot.scenarioContext || {
        scenarioId: run.snapshot.scenarioId,
        scenarioVersion: run.snapshot.scenarioVersion,
        scenarioRunId: run.snapshot.scenarioRunId,
        formedAt: run.snapshot.scenarioFormedAt,
        status: run.snapshot.scenarioStatus
      }),
      scenarioId: run.snapshot.scenarioId,
      scenarioVersion: run.snapshot.scenarioVersion,
      scenarioRunId: run.snapshot.scenarioRunId,
      scenarioFormedAt: run.snapshot.scenarioFormedAt,
      scenarioStatus: run.snapshot.scenarioStatus,
      reportNumber: run.snapshot.reportNumber,
      contentVersion: run.snapshot.contentVersion,
      anchorSnapshotId: run.snapshot.anchorSnapshotId,
      anchorSnapshotVersion: run.snapshot.anchorSnapshotVersion,
      anchor: run.snapshot.anchor,
      evidencePackageId: run.snapshot.evidencePackageId,
      evidencePackageVersion: run.snapshot.evidencePackageVersion,
      semanticVersionId: run.snapshot.semanticVersionId,
      semanticVersion: run.snapshot.ontologyVersion,
      dataAssetVersionId: run.snapshot.dataAssetVersionId,
      dataVersion: run.snapshot.dataVersion,
      consumableVersionId: run.snapshot.consumableVersionId,
      dataAsOf: run.snapshot.dataAsOf,
      destination: isReport ? "报告中心可按运行与结果标识只读引用" : freshnessUnknown ? "保留在 Agent 应用；取得明确新鲜度后须创建新运行，旧结果不可确认或发起行动申请" : "保留在 Agent 应用；可人工确认或发起行动申请",
      currentComparison: comparisonRecord
    };
  }

  function finishFormalRun(runId) {
    setModel((current) => {
      const source = current.runs.find((run) => run.id === runId);
      if (!source || source.status !== "running") return current;
      const activeScenarioContext = readActiveScenarioContext();
      const currentRequest = current.inboundRequests.find((request) => request.id === source.requestId);
      const fixedContextIssues = source.snapshot.agentId === "report-copilot"
        ? c024Issues(resolveC024Reference(currentRequest?.c024 || { requestId: currentRequest?.id }), activeScenarioContext)
        : source.snapshot.agentId === "report-draft"
          ? c022Issues(resolveC022Reference(currentRequest?.c022 || currentRequest || {}), activeScenarioContext)
          : [];
      if (["report-copilot", "report-draft"].includes(source.snapshot.agentId)) {
        if (!currentProjection(source) || !currentProjection(currentRequest)) fixedContextIssues.push("当前报告请求或运行已退出工作投影");
        if (!sameScenarioContext(source.scenarioContext || source.snapshot.scenarioContext || source.snapshot, activeScenarioContext)) fixedContextIssues.push("Run 固定的 C033 与当前平台场景上下文不一致");
        if (!sameScenarioContext(source.scenarioContext || source.snapshot.scenarioContext || source.snapshot, currentRequest?.scenarioContext)) fixedContextIssues.push("Run 与来源请求的 C033 不一致");
      }
      const evidence = {
        id: source.snapshot.evidenceId,
        status: source.snapshot.evidenceStatus || "ready",
        previousId: source.snapshot.evidencePreviousId || null,
        quality: source.snapshot.quality,
        freshness: source.snapshot.freshness
      };
      const hardBlock = source.failureMode === "quality" || source.failureMode === "permission" || source.failureMode === "missing" || source.failureMode === "version" || evidence.status !== "ready" || fixedContextIssues.length > 0;
      const failed = source.failureMode === "tool";
      const partial = source.failureMode === "partial";
      const resultNumber = current.sequence.result + (!hardBlock && !failed ? 1 : 0);
      const reasons = {
        quality: "固定输入未通过质量门，禁止形成新的正式结果。",
        permission: "当前运行无权读取固定证据中的必要范围。",
        missing: "证据包缺少输出合同要求的必填证据。",
        version: "Agent Release 的本体绑定与证据包版本不兼容。",
        tool: "受控工具调用超时，未取得可验证输出。",
        partial: "部分工具返回受限，只形成已验证范围内的结果。"
      };
      const error = fixedContextIssues.length ? `固定身份复核失败：${[...new Set(fixedContextIssues)].join("；")}` : source.gateReason || (evidence.status !== "ready" ? evidence.quality : reasons[source.failureMode] || null);
      const status = failed ? "failed" : hardBlock ? "blocked" : partial ? "partial" : "complete";
      const result = !hardBlock && !failed ? buildFormalResult(source, evidence, resultNumber) : null;
      const finishedAt = nowText();
      const runs = current.runs.map((run) => {
        if (run.id !== runId) return run;
        return {
          ...run,
          status,
          finishedAt,
          result,
          error,
          recovery: status === "blocked" ? (source.gateRecovery || (evidence?.previousId ? "等待上游明确提供并采用新的固定证据包后创建新运行；当前运行快照不改写，Agent 不自行选择上一版本。" : "补齐权限、证据或兼容版本后创建新运行。")) : status === "failed" ? "按相同快照重试工具调用；若配置或证据改变则创建新运行。" : partial ? "可保留部分结果，或修复受限工具后以新运行替代。" : null,
          steps: run.steps.map((step, index) => {
            if (status === "complete" || status === "partial") return { ...step, status: index === run.steps.length - 1 && partial ? "partial" : "complete" };
            if (index === 0) return { ...step, status: "complete" };
            if (index === 1) return { ...step, status };
            return { ...step, status: "skipped" };
          }),
          toolCalls: run.toolCalls.map((call, index) => {
            if (status === "complete" || status === "partial") return { ...call, status: index === run.toolCalls.length - 1 && partial ? "partial" : "complete", duration: `${210 + index * 73} ms`, input: index === 0 ? "固定输入与版本摘要" : "前序获准结构化输出", output: index === run.toolCalls.length - 1 ? "输出合同与证据引用校验结果" : "获准结构化摘要" };
            if (index === 0) return { ...call, status, duration: "238 ms", output: error };
            return { ...call, status: "skipped", output: "前置步骤未通过" };
          })
        };
      });
      return {
        ...current,
        sequence: { ...current.sequence, result: resultNumber },
        runs,
        sessions: current.sessions.map((session) => session.id === source.sessionId ? {
          ...session,
          latestRunId: runId,
          lastRunStatus: status,
          ...(result ? { latestResultId: result.id, resultReturnStatus: status === "partial" ? "部分结果引用已返回" : "Run 与 Result 引用已返回", resultReturnedAt: finishedAt } : { resultReturnStatus: "本次运行未形成可返回结果" })
        } : session),
        inboundRequests: current.inboundRequests.map((request) => request.id === source.requestId ? { ...request, status, runId, sessionId: source.sessionId, bindingId: source.bindingId, resultId: result?.id || null } : request)
      };
    });
    setTimeout(() => toast("运行状态已更新", "可查看结果、证据、工具轨迹和恢复操作。", "success"), 0);
  }

  function cancelFormalRun(runId) {
    setModel((current) => {
      const source = current.runs.find((run) => run.id === runId);
      return {
        ...current,
        runs: current.runs.map((run) => run.id === runId && ["waiting", "running"].includes(run.status) ? {
          ...run,
          status: "cancelled",
          finishedAt: nowText(),
          steps: run.steps.map((step) => ["complete", "failed"].includes(step.status) ? step : { ...step, status: "cancelled" }),
          toolCalls: run.toolCalls.map((call) => call.status === "complete" ? call : { ...call, status: "cancelled" })
        } : run),
        sessions: current.sessions.map((session) => session.id === source?.sessionId ? { ...session, latestRunId: runId, lastRunStatus: "cancelled", resultReturnStatus: "本次运行已取消，未返回结果" } : session),
        inboundRequests: current.inboundRequests.map((request) => request.id === source?.requestId ? { ...request, status: "cancelled", runId, sessionId: source?.sessionId, bindingId: source?.bindingId, resultId: null } : request)
      };
    });
    toast("运行已取消", "已完成步骤、输入快照和证据引用仍保留。", "success");
  }

  function retryFormalRun(run) {
    const session = run.sessionId ? model.sessions.find((item) => item.id === run.sessionId) : null;
    if (!currentProjection(run) || (session && !currentProjection(session))) {
      toast("历史运行不能重试", "定向重置或上下文切换后，原 Run 与证据仅供追溯；请由报告中心提交当前轮次的新 C024。", "danger");
      return;
    }
    if (session && session.status !== "active") {
      toast("不能重试旧 Binding", "旧会话与回答保持只读；请从报告中心的新上下文请求开始。", "danger");
      return;
    }
    const currentEvidence = model.evidencePackages.find((item) => item.id === run.snapshot.evidenceId && currentProjection(item));
    const readResult = currentEvidence ? readCurrentExternalCredibility(currentEvidence) : null;
    if (readResult) {
      setModel((current) => ({
        ...current,
        evidencePackages: current.evidencePackages.map((item) => item.id === currentEvidence.id ? readResult.evidence : item)
      }));
    }
    if (!readResult) {
      toast("不能重试原快照", "当前证据上下文无法定位；请恢复权威上下文后创建新运行。", "danger");
      return;
    }
    if (credibilityChanged(run, readResult.evidence.credibility)) {
      toast("当前状态已变化", "原快照保持不变，不能作为本次故障重试继续使用；请按新的当前摘要创建新运行。", "danger");
      return;
    }
    const retryPurpose = run.snapshot.agentId === "report-copilot" ? "reportQuestion" : "newInsight";
    const retryGate = credibilityGate(readResult.evidence.credibility, retryPurpose);
    if (!retryGate.allowed) {
      toast("不能重试原快照", `${retryGate.reason} ${retryGate.recovery || ""}`.trim(), "danger");
      return;
    }
    startFormalRun({ agentId: run.snapshot.agentId, evidenceId: run.snapshot.evidenceId, requestId: run.requestId }, { retryOf: run.id, snapshot: deepClone(run.snapshot) });
  }

  function replacePartialRun(run) {
    const currentEvidence = model.evidencePackages.find((item) => item.id === run.snapshot.evidenceId);
    if (!currentEvidence || credibilityChanged(run, currentEvidence.credibility)) {
      toast("需要新的固定上下文", "当前证据或摘要已变化；请重新核对后创建新运行。", "danger");
      return;
    }
    openRunModal({ agentId: run.snapshot.agentId, evidenceId: run.snapshot.evidenceId, requestId: run.requestId, replacesRun: run.id });
  }

  function setResultConfirmation(runId, confirmation) {
    const source = model.runs.find((run) => run.id === runId);
    if (source?.status === "partial") {
      toast("部分结果不可确认或退回", "只保留已验证范围；修复受限工具后创建替代运行。", "danger");
      return;
    }
    const currentEvidence = model.evidencePackages.find((item) => item.id === source?.snapshot?.evidenceId);
    const readResult = currentEvidence ? readCurrentExternalCredibility(currentEvidence) : null;
    const currentCredibility = readResult?.evidence?.credibility || null;
    if (readResult) {
      setModel((current) => ({
        ...current,
        evidencePackages: current.evidencePackages.map((item) => item.id === currentEvidence.id ? readResult.evidence : item)
      }));
    }
    const useGate = credibilityGate(currentCredibility, source?.result?.type === "Report Copilot Result" ? "confirmReportAnswer" : "confirmInsight");
    if (confirmation === "confirmed" && !useGate.allowed) {
      toast("不能确认当前结果", `${useGate.reason} ${useGate.recovery || ""}`.trim(), "danger");
      return;
    }
    const session = source?.sessionId ? model.sessions.find((item) => item.id === source.sessionId) : null;
    if (session?.status === "stale") {
      toast("旧回答只读", "报告上下文已经变化，不能再确认或退回旧回答。", "danger");
      return;
    }
    const handoffs = source?.result ? model.handoffs.filter((item) => item.runId === runId && item.resultId === source.result.id) : [];
    if (handoffs.length) {
      toast("结果状态已锁定", "行动申请已进入移交，不能再确认或退回来源结果。", "danger");
      return;
    }
    setModel((current) => ({
      ...current,
      runs: current.runs.map((run) => run.id === runId && run.result ? { ...run, result: { ...run.result, confirmation, confirmedAt: nowText() } } : run)
    }));
    toast(confirmation === "confirmed" ? "已确认可作业务参考" : "结果已退回", confirmation === "confirmed" ? "确认不改变 Metric、Rule、报告或决策状态。" : "原结果和证据已保留，可基于修正输入创建新运行。", "success");
  }

  function submitActionRequest(run) {
    if (!actionReason.trim()) {
      toast("请填写请求说明", "请求说明将随固定证据引用一起移交。", "danger");
      return;
    }
    const source = model.runs.find((item) => item.id === run.id);
    const currentEvidence = model.evidencePackages.find((item) => item.id === source?.snapshot?.evidenceId);
    if (!source || !currentEvidence) {
      toast("最终提交已阻断", "来源运行或证据包无法定位；未创建行动申请。", "danger");
      setModal(null);
      return;
    }
    const readResult = readExternalCredibilityForTrigger(currentEvidence, "action-submit");
    const latestEvidence = readResult.evidence;
    const currentCredibility = latestEvidence.credibility;
    setModel((current) => ({
      ...current,
      evidencePackages: current.evidencePackages.map((item) => item.id === latestEvidence.id ? latestEvidence : item)
    }));
    const eligibility = actionRequestEligibility(source, currentCredibility);
    if (!eligibility.allowed) {
      const block = `${eligibility.reason || "当前可信度状态无法确认。"} ${eligibility.recovery || ""} 未创建行动申请或移交回执。`.trim();
      setActionSubmitBlock(block);
      toast("最终提交已阻断", block, "danger");
      return;
    }
    const target = eligibility.targets.find((item) => item.id === actionTargetId);
    if (!target) {
      setActionSubmitBlock("请选择一个获准目标主体；未创建行动申请或移交回执。");
      toast("最终提交已阻断", "请选择一个获准目标主体。", "danger");
      return;
    }
    const openedSummary = modal?.openedSummary;
    const latestSummary = currentCredibility?.currentStateSummary;
    if (openedSummary && (!latestSummary || openedSummary.id !== latestSummary.id || openedSummary.version !== latestSummary.version)) {
      const block = "打开确认页后当前状态摘要发生变化；未创建行动申请或移交回执。请查看新状态后重新发起。";
      setActionSubmitBlock(block);
      toast("最终提交已阻断", block, "danger");
      return;
    }
    run = source;
    const activeScenarioContext = readActiveScenarioContext();
    if (!sameScenarioContext(run.scenarioContext || run.snapshot.scenarioContext || run.snapshot, activeScenarioContext)) {
      const block = "来源运行的 C033 与当前平台场景上下文不一致；未写入 C011。请在当前场景轮次创建新的 Agent Run。";
      setActionSubmitBlock(block);
      toast("最终提交已阻断", block, "danger");
      return;
    }
    const requestKey = `${run.id}:${run.result.id}:${eligibility.actionType.resourceId}@${eligibility.actionType.version}:${target.id}`;
    const existing = model.handoffs.find((item) => item.idempotencyKey === requestKey);
    if (existing) {
      setActionReason("");
      setModal({ type: "handoff", handoffId: existing.id });
      refreshActionReceipt(existing.id, true);
      toast("请求已存在", "同一来源、行动类型与主体不重复提交；已重新读取决策中心回执。", "success");
      return;
    }
    if (actionSubmitLocksRef.current.has(requestKey)) {
      toast("请求正在提交", "请等待当前移交完成。", "danger");
      return;
    }
    actionSubmitLocksRef.current.add(requestKey);
    const number = model.sequence.handoff + 1;
    const c011Payload = buildAgentActionRequest(run, eligibility, target, actionReason.trim(), currentCredibility);
    const writeResult = mergeC011Request(c011Payload);
    if (!["submitted", "duplicate"].includes(writeResult.status)) {
      actionSubmitLocksRef.current.delete(requestKey);
      const block = `${writeResult.reason || "C011 写入未完成。"} 未创建本地移交记录，也未改写来源结果。`;
      setActionSubmitBlock(block);
      toast("行动申请未提交", block, "danger");
      return;
    }
    const receipt = readC019Receipt(c011Payload.id, activeScenarioContext);
    const handoffId = `AH-AG-${stableHash(requestKey)}`;
    const handoff = {
      id: handoffId,
      actionRequestId: c011Payload.id,
      decisionCenterUrl: receipt.status === "received" ? receipt.requestRef?.stableDetailEntry || null : null,
      idempotencyKey: requestKey, runId: run.id, resultId: run.result.id,
      scenarioContext: deepClone(activeScenarioContext),
      actionType: eligibility.actionType.name, actionTypeId: eligibility.actionType.resourceId, actionTypeVersion: eligibility.actionType.version,
      targets: [deepClone(target)], target: `${target.name}（${target.id}）`, targetId: target.id,
      status: receipt.status === "received" ? "received" : "submitted", submittedAt: nowText(), receivedAt: receipt.status === "received" ? receipt.receivedAt : null, reason: actionReason,
      receiptStatus: receipt.status,
      receiptReason: receipt.reason || null,
      requestRef: receipt.requestRef || null,
      reminderRef: receipt.reminderRef || null,
      taskRef: receipt.taskRef || null,
      traceRef: receipt.traceRef || null,
      c011Fingerprint: c011PayloadFingerprint(c011Payload),
      evidenceRefs: [...eligibility.evidenceRefs], ontologyVersion: run.snapshot.ontologyVersion,
      dataVersion: run.snapshot.dataVersion, dataAsOf: run.snapshot.dataAsOf, quality: run.snapshot.quality, freshness: run.snapshot.freshness,
      currentSummaryId: currentCredibility?.currentStateSummary?.id || null,
      currentSummaryVersion: currentCredibility?.currentStateSummary?.version || null,
      currentSummaryObservedAt: currentCredibility?.currentStateSummary?.observedAt || null
    };
    setModel((current) => {
      if (current.handoffs.some((item) => item.idempotencyKey === handoff.idempotencyKey)) return current;
      return {
        ...current,
        sequence: { ...current.sequence, handoff: number },
        handoffs: [handoff, ...current.handoffs],
        runs: current.runs.map((item) => item.id === run.id && item.result?.id === run.result.id ? { ...item, result: { ...item.result, actionHandoffIds: [handoff.id], actionRequestId: c011Payload.id, actionRequestIds: receipt.status === "received" ? [c011Payload.id] : [], actionRequestStatus: receipt.status === "received" ? "received" : "submitted" } } : item)
      };
    });
    actionSubmitLocksRef.current.delete(requestKey);
    setActionReason("");
    setActionSubmitBlock(null);
    setModal({ type: "handoff", handoffId: handoff.id });
    toast(receipt.status === "received" ? "已读取决策中心接收回执" : "行动申请已提交", receipt.status === "received" ? "C019 已返回稳定详情入口；后续人工确认与待办状态仍由决策中心维护。" : "C011 已写入待接收区，当前等待决策中心接收；不会预先创建提醒或待办。", "success");
  }

  function applyActionReceipt(current, handoffId, receipt) {
    const handoff = current.handoffs.find((item) => item.id === handoffId);
    if (!handoff || receipt.status !== "received") return current;
    return {
      ...current,
      handoffs: current.handoffs.map((item) => item.id === handoffId ? {
        ...item,
        status: "received",
        receiptStatus: "received",
        receiptReason: null,
        receivedAt: receipt.receivedAt,
        decisionCenterUrl: receipt.requestRef?.stableDetailEntry || null,
        requestRef: receipt.requestRef,
        reminderRef: receipt.reminderRef,
        taskRef: receipt.taskRef,
        traceRef: receipt.traceRef
      } : item),
      runs: current.runs.map((item) => item.id === handoff.runId && item.result?.id === handoff.resultId ? {
        ...item,
        result: { ...item.result, actionRequestId: handoff.actionRequestId, actionRequestIds: [handoff.actionRequestId], actionRequestStatus: "received" }
      } : item)
    };
  }

  function refreshActionReceipt(handoffId, quiet = false) {
    const handoff = model.handoffs.find((item) => item.id === handoffId);
    if (!handoff) {
      if (!quiet) toast("无法读取回执", "本地移交记录无法定位。", "danger");
      return;
    }
    const receipt = readC019Receipt(handoff.actionRequestId, handoff.scenarioContext);
    if (receipt.status !== "received") {
      setModel((current) => ({
        ...current,
        handoffs: current.handoffs.map((item) => item.id === handoffId ? { ...item, receiptStatus: receipt.status, receiptReason: receipt.reason || null } : item)
      }));
      if (!quiet) toast("决策中心尚未返回接收回执", `${receipt.reason || "请在决策中心接收行动申请后重新读取。"} 当前仍保持“等待接收”。`, "danger");
      return;
    }
    setModel((current) => applyActionReceipt(current, handoffId, receipt));
    if (!quiet) toast("已读取决策中心接收回执", "C019 已返回稳定行动申请详情入口；Agent 应用不维护后续决策状态。", "success");
  }

  function acceptReportCenterComparison(run, comparisonRecord) {
    const source = model.runs.find((item) => item.id === run?.id);
    const currentEvidence = model.evidencePackages.find((item) => item.id === source?.snapshot?.evidenceId);
    const currentSummary = currentEvidence?.credibility?.currentStateSummary;
    if (!source?.result || source.result.type !== "Report Copilot Result" || !currentSummary) {
      toast("比较记录不能接收", "报告伴读结果或当前 C017 摘要无法定位。", "danger");
      return;
    }
    if (comparisonRecord?.owner !== "报告中心" || comparisonRecord.currentSummaryId !== currentSummary.id || comparisonRecord.currentSummaryVersion !== currentSummary.version) {
      toast("比较记录版本不一致", "只接收报告中心提供且精确绑定当前状态摘要的比较记录；Agent 不自行重算。", "danger");
      return;
    }
    setModel((current) => ({
      ...current,
      runs: current.runs.map((item) => item.id === source.id && item.result ? {
        ...item,
        result: { ...item.result, currentComparison: deepClone(comparisonRecord) }
      } : item),
      sessions: current.sessions.map((item) => item.id === source.sessionId ? { ...item, currentComparisonRef: comparisonRecord.id } : item)
    }));
    setModal(null);
    toast("已接收当前比较记录", "记录由报告中心拥有；Agent 应用只保留引用并在 C017 摘要变化后标记陈旧。", "success");
  }

  function createOrchestration() {
    if (!orchestrationForm.name.trim() || !orchestrationForm.purpose.trim()) {
      toast("信息不完整", "请填写编排名称和真实业务用途。", "danger");
      return;
    }
    const number = model.sequence.orchestration + 1;
    const id = `ORCH-${compactDate()}-${String(number).padStart(3, "0")}`;
    const finalContract = orchestrationForm.template === "parallel" ? "Approved Summary Contract" : "AI Insight v1";
    const nodes = [
      { id: "input", type: "input", name: "固定输入", x: 42, y: 150, inputContract: null, outputContract: "Fixed Context", status: "idle" },
      ...(orchestrationForm.template === "parallel" ? [{ id: "collector", type: "collector", name: "指定汇总", x: 630, y: 150, inputContract: "Parallel Member Result", outputContract: "Approved Summary Contract", status: "idle" }] : []),
      ...(orchestrationForm.template === "branch" ? [{ id: "condition", type: "condition", name: "确定性分流", x: 630, y: 150, inputContract: "Structured Status", outputContract: "Route Token", branchRule: "status = complete", status: "idle" }] : []),
      { id: "result", type: "result", name: "最终结果", x: 880, y: 150, inputContract: finalContract, outputContract: null, status: "idle" }
    ];
    const orchestration = {
      id,
      name: orchestrationForm.name.trim(),
      purpose: orchestrationForm.purpose.trim(),
      template: orchestrationForm.template,
      status: "draft",
      release: null,
      createdAt: nowText(),
      updatedAt: nowText(),
      nodes,
      connections: [],
      inputEvidenceId: null,
      failurePolicy: "任一步骤失败时停止并保留已完成结果",
      partialPolicy: "明确显示部分结果，不进入最终结果合同",
      validation: null,
      releases: [],
      trace: null,
      traceHistory: []
    };
    setModel((current) => ({ ...current, sequence: { ...current.sequence, orchestration: number }, orchestrations: [orchestration, ...current.orchestrations] }));
    setOrchestrationForm({ name: "", purpose: "", template: "sequence" });
    setModal(null);
    setSelectedNode("input");
    navigate("orchestration-editor", id);
    toast("编排草稿已创建", "从“可用 Agent”加入精确 Release，再按输入输出合同建立连接。", "success");
  }

  function updateOrchestration(id, updater) {
    setModel((current) => ({ ...current, orchestrations: current.orchestrations.map((item) => item.id === id ? updater(item) : item) }));
  }

  function addAgentNode(orchestration, agent, release, position = null) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) {
      toast("当前不能修改", "路径检查运行中，请先取消或等待结束。", "danger");
      return;
    }
    const existingCount = orchestration.nodes.filter((node) => node.type === "agent").length;
    const node = {
      id: `node-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "agent",
      name: agent.shortName,
      agentId: agent.id,
      agentName: agent.name,
      agentRelease: release.version,
      x: Math.max(170, Math.min(position?.x || 260 + existingCount * 220, 760)),
      y: Math.max(36, Math.min(position?.y || 70 + existingCount * 150, 360)),
      inputContract: release.inputContract,
      outputContract: release.outputContract,
      baseTools: [...release.tools],
      baseToolBindings: release.tools.map((toolId) => { const tool = getTool(toolId); return { id: toolId, version: tool?.version || "无法定位", name: tool?.name || toolId }; }),
      allowedTools: [...release.tools],
      evidenceScope: "仅使用编排固定输入中的获准证据",
      status: "idle"
    };
    updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, { nodes: [...item.nodes, node] }));
    setSelectedNode(node.id);
    toast("Agent Release 已加入", `${agent.name} Release ${release.version} 以精确引用加入，未复制配置。`, "success");
  }

  function addControlNode(orchestration, type) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) {
      toast("当前不能修改", "路径检查运行中，请先取消或等待结束。", "danger");
      return;
    }
    const definitions = {
      condition: { name: "确定性分流", inputContract: "Structured Status", outputContract: "Route Token", branchRule: "status = complete" },
      pause: { name: "人工暂停", inputContract: "Passthrough", outputContract: "Passthrough" },
      collector: { name: "指定汇总", inputContract: "Parallel Member Result", outputContract: "Approved Summary Contract" },
      failure: { name: "失败结束", inputContract: "Failure Status", outputContract: null },
      partial: { name: "部分结果结束", inputContract: "Partial Status", outputContract: null }
    };
    const def = definitions[type];
    const node = { id: `node-${Date.now()}-${type}`, type, ...def, x: 470, y: 320, status: "idle" };
    updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, { nodes: [...item.nodes, node] }));
    setSelectedNode(node.id);
    toast("受控节点已加入", "节点只能使用结构化状态和已固定合同。", "success");
  }

  function moveCanvasNode(orchestration, nodeId, x, y) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) return;
    updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, {
      nodes: item.nodes.map((node) => node.id === nodeId ? { ...node, x: Math.max(12, Math.min(x, 900)), y: Math.max(12, Math.min(y, 410)) } : node)
    }));
  }

  function removeCanvasNode(orchestration, nodeId) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) {
      toast("当前不能修改", "路径检查运行中，请先取消或等待结束。", "danger");
      return;
    }
    const node = orchestration.nodes.find((item) => item.id === nodeId);
    if (["input", "result"].includes(node?.type)) return;
    updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, {
      nodes: item.nodes.filter((entry) => entry.id !== nodeId),
      connections: item.connections.filter((connection) => connection.source !== nodeId && connection.target !== nodeId)
    }));
    setSelectedNode(null);
    toast("节点已移除", "关联连接已同步移除，Agent Release 本身未改变。", "success");
  }

  function connectionCompatibility(orchestration, source, target) {
    if (!source || !target) return { ok: false, reason: "请选择完整的来源和目标节点。" };
    if (source.id === target.id) return { ok: false, reason: "节点不能连接到自身。" };
    if (source.type === "result") return { ok: false, reason: "最终结果节点不能继续输出。" };
    if (target.type === "input") return { ok: false, reason: "固定输入节点不能接收上游输出。" };
    if (target.x <= source.x) return { ok: false, reason: "当前编排禁止循环、回边和递归连接。" };
    if (orchestration.connections.some((connection) => connection.source === source.id && connection.target === target.id)) return { ok: false, reason: "该连接已经存在。" };
    if (source.type === "input" && target.type === "agent") return { ok: true, reason: "固定输入可按目标 Agent 的输入映射装配。" };
    if (target.type === "pause") {
      const existingInput = orchestration.connections.some((connection) => connection.target === target.id);
      if (existingInput) return { ok: false, reason: "人工暂停只接受一条已固定的结构化输入。" };
      return source.outputContract ? { ok: true, reason: "人工暂停继承上游结构化合同，不执行格式转换。" } : { ok: false, reason: "来源节点没有可传递的结构化输出合同。" };
    }
    if (target.type === "condition") return source.outputContract === "Structured Status" ? { ok: true, reason: "结构化状态可进入确定性分流。" } : { ok: false, reason: `${source.outputContract || "当前输出"} 不提供确定性分流要求的 Structured Status。` };
    if (target.type === "collector") return source.outputContract === "Parallel Member Result" ? { ok: true, reason: "并行成员结果合同匹配。" } : { ok: false, reason: `${source.outputContract || "当前输出"} 不能进入 Parallel Member Result 汇总输入。` };
    if (target.type === "failure") return source.outputContract === "Failure Status" ? { ok: true, reason: "失败状态合同匹配。" } : { ok: false, reason: "目标只接受结构化 Failure Status。" };
    if (target.type === "partial") return source.outputContract === "Partial Status" ? { ok: true, reason: "部分结果状态合同匹配。" } : { ok: false, reason: "目标只接受结构化 Partial Status。" };
    if (target.type === "result") return source.outputContract === target.inputContract ? { ok: true, reason: "输出与最终结果合同一致。" } : { ok: false, reason: `${source.outputContract || "当前输出"} 不能落入 ${target.inputContract}。` };
    if (source.type === "agent" && target.type === "agent") return source.outputContract === target.inputContract ? { ok: true, reason: "Agent 输出与目标输入合同一致。" } : { ok: false, reason: `${source.agentName} Release ${source.agentRelease} 输出 ${source.outputContract}，而 ${target.agentName} Release ${target.agentRelease} 需要 ${target.inputContract}。` };
    return source.outputContract === target.inputContract ? { ok: true, reason: "结构化合同一致。" } : { ok: false, reason: `${source.outputContract || "当前输出"} 与 ${target.inputContract || "目标输入"} 不兼容。` };
  }

  function attemptConnection(orchestration, targetId) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) {
      toast("当前不能修改", "路径检查运行中，请先取消或等待结束。", "danger");
      return;
    }
    if (!connectionSource) {
      setConnectionSource(targetId);
      toast("已选择连接来源", "请选择右侧节点的输入端口。", "success");
      return;
    }
    const source = orchestration.nodes.find((node) => node.id === connectionSource);
    const target = orchestration.nodes.find((node) => node.id === targetId);
    const check = connectionCompatibility(orchestration, source, target);
    if (!check.ok) {
      setDrawer({ type: "connection-error", source, target, reason: check.reason });
      setConnectionSource(null);
      return;
    }
    const connection = { id: `edge-${Date.now()}`, source: source.id, target: target.id, contract: source.type === "input" ? target.inputContract : source.outputContract, evidence: "仅传递来源步骤已获准引用" };
    updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, {
      nodes: target.type === "pause" ? item.nodes.map((node) => node.id === target.id ? { ...node, inputContract: source.outputContract, outputContract: source.outputContract } : node) : item.nodes,
      connections: [...item.connections, connection]
    }));
    setConnectionSource(null);
    toast("连接已建立", check.reason, "success");
  }

  function deleteConnection(orchestration, connectionId) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) return;
    updateOrchestration(orchestration.id, (item) => {
      const removed = item.connections.find((connection) => connection.id === connectionId);
      const remaining = item.connections.filter((connection) => connection.id !== connectionId);
      return applyOrchestrationDraftChange(item, {
        connections: remaining,
        nodes: item.nodes.map((node) => node.id === removed?.target && node.type === "pause" && !remaining.some((connection) => connection.target === node.id) ? { ...node, inputContract: "Passthrough", outputContract: "Passthrough" } : node)
      });
    });
    toast("连接已移除", "步骤资源和版本保持不变。", "success");
  }

  function updateNodeRestriction(orchestration, nodeId, updater) {
    if (orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)) return;
    updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, { nodes: item.nodes.map((node) => node.id === nodeId ? updater(node) : node) }));
  }

  function validateOrchestration(orchestration) {
    const errors = [];
    const agentNodes = orchestration.nodes.filter((node) => node.type === "agent");
    const inputEvidence = model.evidencePackages.find((item) => item.id === orchestration.inputEvidenceId);
    if (!inputEvidence) errors.push("未固定编排输入证据包");
    else if (inputEvidence.status !== "ready") errors.push(`固定输入当前不可用：${inputEvidence.quality}`);
    if (agentNodes.length < 2) errors.push("至少需要两个具有真实协作价值的精确 Agent Release");
    agentNodes.forEach((node) => {
      const agent = model.agents.find((item) => item.id === node.agentId);
      if (!agent || agent.status !== "enabled") errors.push(`${node.agentName} 当前已停用或不可用`);
      if (!getAgentRelease(agent, node.agentRelease)) errors.push(`${node.agentName} Release ${node.agentRelease} 无法定位`);
      if (node.allowedTools.some((toolId) => !node.baseTools.includes(toolId))) errors.push(`${node.name} 的步骤权限超出 Agent Release 白名单`);
    });
    orchestration.connections.forEach((connection) => {
      const source = orchestration.nodes.find((node) => node.id === connection.source);
      const target = orchestration.nodes.find((node) => node.id === connection.target);
      const check = connectionCompatibility({ ...orchestration, connections: orchestration.connections.filter((item) => item.id !== connection.id) }, source, target);
      if (!check.ok) errors.push(check.reason);
      if (source?.type === "input" && target?.type === "agent" && inputEvidence) {
        const requiresReport = target.inputContract === "Report Context Binding v1";
        const requiresGeneration = target.inputContract === "Generation Evidence Package v1";
        if (requiresReport && inputEvidence.kind !== "report") errors.push(`${target.name} 需要报告固定上下文，当前输入为${inputEvidence.name}`);
        if (requiresGeneration && inputEvidence.kind !== "finance") errors.push(`${target.name} 需要洞察生成证据包，当前输入为${inputEvidence.name}`);
      }
    });
    agentNodes.forEach((node) => {
      if (!orchestration.connections.some((connection) => connection.target === node.id)) errors.push(`${node.name} 缺少输入连接`);
      if (!orchestration.connections.some((connection) => connection.source === node.id)) errors.push(`${node.name} 缺少输出或失败路径`);
    });
    const resultNode = orchestration.nodes.find((node) => node.type === "result");
    if (!resultNode || !orchestration.connections.some((connection) => connection.target === resultNode.id)) errors.push("最终结果合同未连接");
    const reachable = new Set(["input"]);
    let changed = true;
    while (changed) {
      changed = false;
      orchestration.connections.forEach((connection) => {
        if (reachable.has(connection.source) && !reachable.has(connection.target)) {
          reachable.add(connection.target);
          changed = true;
        }
      });
    }
    if (resultNode && !reachable.has(resultNode.id)) errors.push("最终结果无法从固定输入到达");
    orchestration.nodes.filter((node) => ["condition", "pause", "collector"].includes(node.type)).forEach((node) => {
      if (!orchestration.connections.some((connection) => connection.target === node.id)) errors.push(`${node.name} 缺少输入连接`);
      if (!orchestration.connections.some((connection) => connection.source === node.id)) errors.push(`${node.name} 缺少后续路径`);
    });
    if (orchestration.template === "sequence" && agentNodes.length >= 2) {
      const compatiblePair = agentNodes.some((source) => agentNodes.some((target) => source.id !== target.id && source.outputContract === target.inputContract));
      if (!compatiblePair) errors.push("当前没有两个输出/输入合同兼容且具有真实协作价值的 Agent Release");
    }
    const validation = { status: errors.length ? "blocked" : "validated", at: nowText(), errors };
    updateOrchestration(orchestration.id, (item) => ({ ...item, validation, updatedAt: nowText() }));
    toast(errors.length ? "编排验证已阻断" : "编排验证通过", errors.length ? "查看问题清单并修正连接、版本或权限。" : "可固定为不可变编排 Release 并试运行。", errors.length ? "danger" : "success");
  }

  function publishOrchestrationRelease(orchestration) {
    if (orchestration.validation?.status !== "validated") {
      toast("不能发布编排 Release", "请先修正阻断项并完成验证。", "danger");
      return;
    }
    const version = `${(orchestration.releases?.length || 0) + 1}.0`;
    const snapshot = makeOrchestrationRunSnapshot({ ...orchestration, release: version });
    const release = { version, status: "enabled", releasedAt: nowText(), snapshot: deepClone(snapshot) };
    updateOrchestration(orchestration.id, (item) => ({ ...item, release: version, status: "enabled", releases: [...(item.releases || []), release], updatedAt: nowText() }));
    toast("编排 Release 已启用", `Release ${version} 已固定所有 Agent Release、连接、权限与证据范围。`, "success");
  }

  function makeOrchestrationRunSnapshot(orchestration) {
    const evidence = model.evidencePackages.find((item) => item.id === orchestration.inputEvidenceId);
    const orderedNodes = orderOrchestrationNodes(orchestration.nodes, orchestration.connections).map((node) => {
      if (node.type !== "agent") return deepClone(node);
      const agent = model.agents.find((item) => item.id === node.agentId);
      return { ...deepClone(node), releaseBinding: deepClone(getAgentRelease(agent, node.agentRelease)) };
    });
    return {
      definitionId: orchestration.id,
      release: orchestration.release || "草稿快照",
      template: orchestration.template,
      nodes: orderedNodes,
      connections: deepClone(orchestration.connections),
      validation: deepClone(orchestration.validation),
      inputContext: evidence ? {
        evidenceId: evidence.id,
        evidenceName: evidence.name,
        requestContext: deepClone(evidence.requestContext),
        status: evidence.status,
        ontologyVersion: evidence.ontologyVersion,
        dataVersion: evidence.dataVersion,
        dataAsOf: evidence.dataAsOf,
        quality: evidence.quality,
        freshness: evidence.freshness
      } : null,
      failurePolicy: orchestration.failurePolicy,
      partialPolicy: orchestration.partialPolicy
    };
  }

  function startOrchestrationTrace(orchestration, fixedSnapshot = null, retryOf = null) {
    const number = model.sequence.orchestrationRun + 1;
    const runId = `ORUN-${compactDate()}-${String(number).padStart(3, "0")}`;
    const enabledRelease = orchestration.releases?.find((item) => item.version === orchestration.release && item.status === "enabled");
    const snapshot = fixedSnapshot ? deepClone(fixedSnapshot) : enabledRelease ? deepClone(enabledRelease.snapshot) : makeOrchestrationRunSnapshot(orchestration);
    const stepRuns = snapshot.nodes.map((node, index) => ({ id: `SRUN-${compactDate()}-${String(number).padStart(3, "0")}-${index + 1}`, nodeId: node.id, name: node.name, type: node.type, status: "waiting", agentRunId: null }));
    updateOrchestration(orchestration.id, (item) => ({
      ...item,
      traceHistory: item.trace ? [deepClone(item.trace), ...(item.traceHistory || [])] : item.traceHistory || [],
      trace: { id: runId, status: "waiting", startedAt: nowText(), finishedAt: null, release: snapshot.release, retryOf, stepRuns, snapshot, result: null, error: null, outcome: null }
    }));
    setModel((current) => ({ ...current, sequence: { ...current.sequence, orchestrationRun: number } }));
    toast(enabledRelease ? "编排运行已进入等待" : "路径检查已进入等待", enabledRelease ? "本次不可变 Release、节点版本、权限和输入摘要已固定。" : "本次草稿、节点版本、权限和连接快照已固定。", "success");
  }

  function advanceOrchestrationTrace(orchestrationId) {
    updateOrchestration(orchestrationId, (item) => ({
      ...item,
      trace: item.trace?.status === "waiting" ? {
        ...item.trace,
        status: "running",
        stepRuns: item.trace.stepRuns.map((step, index) => index === 0 ? { ...step, status: "running" } : step)
      } : item.trace
    }));
  }

  function finishOrchestrationTrace(orchestrationId) {
    updateOrchestration(orchestrationId, (item) => {
      if (item.trace?.status !== "running") return item;
      const validation = item.trace.snapshot.validation;
      const errors = validation?.errors?.length ? validation.errors : ["编排尚未通过完整验证"];
      const hasAgentSteps = item.trace.snapshot.nodes.some((node) => node.type === "agent");
      const blocked = validation?.status !== "validated" || hasAgentSteps;
      const inputReady = item.trace.snapshot.inputContext?.status === "ready";
      return {
        ...item,
        trace: {
          ...item.trace,
          status: blocked ? "blocked" : "complete",
          finishedAt: nowText(),
          error: blocked ? (validation?.status !== "validated" ? errors[0] : "Agent 步骤尚未产生真实 Agent Run，不能将路径检查冒充正式编排完成。") : null,
          result: null,
          outcome: blocked ? (validation?.status !== "validated" ? "未启动任何 Agent Run；修正草稿后创建新的路径检查。" : "固定 Release 已核对，但没有真实 Agent Run 与最终结果，不标记业务完成。") : "无 Agent 步骤的确定性路径检查完成；未生成业务结果。",
          stepRuns: item.trace.stepRuns.map((step, index) => {
            if (!blocked) return { ...step, status: "complete", agentRunId: null };
            if (index === 0) return { ...step, status: inputReady ? "complete" : "blocked" };
            if (step.type === "agent") return { ...step, status: "blocked", agentRunId: null };
            return { ...step, status: "skipped" };
          })
        }
      };
    });
    setTimeout(() => toast("路径检查已结束", "在固定编排快照上查看逐节点状态和阻断原因。", "success"), 0);
  }

  function cancelOrchestrationTrace(orchestration) {
    updateOrchestration(orchestration.id, (item) => ({
      ...item,
      trace: item.trace && ["waiting", "running"].includes(item.trace.status) ? {
        ...item.trace,
        status: "cancelled",
        finishedAt: nowText(),
        outcome: "检查已取消；固定快照和已完成步骤保留。",
        stepRuns: item.trace.stepRuns.map((step) => step.status === "complete" ? step : { ...step, status: "cancelled" })
      } : item.trace
    }));
    toast("路径检查已取消", "固定快照和已完成步骤仍可追溯。", "success");
  }

  function resetState() {
    const resetAt = nowText();
    setModel((current) => {
      const archive = (item) => ({
        ...item,
        currentProjection: false,
        projectionStatus: "history",
        archivedAt: item.archivedAt || resetAt,
        archivedReason: item.archivedReason || "当前场景工作轮次已定向重置；历史记录保留且不回填当前状态。"
      });
      return {
        ...current,
        currentScenarioContext: null,
        evidencePackages: current.evidencePackages.map((item) => reportEvidence(item) && currentProjection(item) ? archive(item) : item),
        inboundRequests: current.inboundRequests.map((item) => currentProjection(item) ? archive(item) : item),
        runs: current.runs.map((item) => reportRun(item) && currentProjection(item) ? archive(item) : item),
        sessions: current.sessions.map((item) => currentProjection(item) ? archive(item) : item),
        c022Rejections: current.c022Rejections || [],
        c024Rejections: current.c024Rejections || []
      };
    });
    setModal(null);
    setDrawer(null);
    setCatalogTab("released");
    setCatalogView("cards");
    setSearch("");
    setAgentTab("overview");
    setResourceKind("prompt");
    setResourceTab("detail");
    setRunTab("requests");
    setC022Candidates(readC022Candidates());
    setC022SelectedId(null);
    setC024Candidates(readC024Candidates());
    setC024SelectedId(null);
    setRunDetailTab("summary");
    setEvidenceTab("packages");
    setDebugRailOpen(true);
    setDebugForm({ input: "请基于固定证据说明主要变化、风险关注和使用限制。", evidenceId: "finance-2026-07-31", condition: "normal" });
    setRunForm({ agentId: "financing-insight", evidenceId: "finance-2026-07-31", condition: "normal", requestId: null, replacesRun: null });
    setNewAgentForm({ name: "", type: "洞察 Agent", purpose: "" });
    setOrchestrationForm({ name: "", purpose: "", template: "sequence" });
    setSelectedNode(null);
    setConnectionSource(null);
    setActionReason("");
    setActionTargetId("");
    publishLocksRef.current.clear();
    actionSubmitLocksRef.current.clear();
    replaceNavigate(window.AGENT_WORKSPACE_CONFIG.initialRoute);
    toast("当前报告工作已重置", "当前报告生成与伴读请求、固定输入、Binding、Session、Run 和 Result 已归零；历史运行与证据仍可追溯，不会回填当前状态。", "success");
  }

  const counts = useMemo(() => ({
    agents: model.agents.length + model.drafts.length,
    resources: window.AGENT_PORTFOLIO ? 0 : window.AGENT_TOOLS.filter((tool) => tool.availability !== "available").length,
    runs: model.inboundRequests.filter((request) => currentProjection(request) && request.status === "pending").length + model.runs.filter((run) => currentProjection(run) && ["waiting", "running"].includes(run.status)).length,
    evidence: model.runs.filter((run) => currentProjection(run) && run.result).length,
    orchestrations: model.orchestrations.filter((item) => item.status === "draft").length
  }), [model]);

  function AgentDirectory() {
    const released = catalogTab === "released";
    const candidates = released ? model.agents : model.drafts;
    const filtered = candidates.filter((item) => {
      const release = released ? getAgentRelease(item) : item;
      return `${item.name} ${item.type} ${scenarioBindingLabel(release, item.scenario || "")}`.toLowerCase().includes(search.trim().toLowerCase());
    });
    return (
      <div className="page" data-screen-label="Agent 目录">
        <PageHeader
          title="Agent 目录"
          description="统一管理四个业务场景的洞察、报告生成、自动核验与报告伴读能力；问数配置仍在智能问数中维护。"
          actions={<><Button icon="plus" kind="primary" onClick={() => setModal({ type: "new-agent" })}>创建配置草稿</Button><Button icon="play" onClick={() => openRunModal()}>发起运行</Button></>}
        ></PageHeader>
        <div className="summary-grid agent-directory-summary">
          <div className="summary-cell"><span>可用 Agent</span><strong>{model.agents.filter((agent) => agent.status === "enabled").length}</strong><small>洞察、生成、核验与伴读</small></div>
          <div className="summary-cell"><span>配置草稿</span><strong>{model.drafts.length}</strong><small>不进入正式目录</small></div>
        </div>
        <div className="toolbar">
          <div className="toolbar-group">
            <div className="segmented"><button className={released ? "active" : ""} onClick={() => setCatalogTab("released")}>正式目录</button><button className={!released ? "active" : ""} onClick={() => setCatalogTab("drafts")}>配置草稿</button></div>
            <label className="search-box"><Icon name="search"></Icon><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索名称、类型或场景" /></label>
          </div>
          <div className="segmented icon-segmented"><button className={catalogView === "cards" ? "active" : ""} onClick={() => setCatalogView("cards")} title="卡片视图"><Icon name="layout-grid"></Icon></button><button className={catalogView === "list" ? "active" : ""} onClick={() => setCatalogView("list")} title="列表视图"><Icon name="list"></Icon></button></div>
        </div>
        {!filtered.length ? <EmptyState icon="search-x" title="没有匹配内容" description={released ? "调整搜索条件，或查看配置草稿。" : "创建新草稿，或基于正式 Release 创建新版本。"}></EmptyState> : catalogView === "cards" ? (
          <div className="agent-grid">{filtered.map((item) => released ? <AgentCard key={item.id} agent={item}></AgentCard> : <DraftCard key={item.id} draft={item}></DraftCard>)}</div>
        ) : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Agent</th><th>类型</th><th>{released ? "当前 Release" : "目标 Release"}</th><th>场景</th><th>输入 / 输出合同</th><th>状态</th><th></th></tr></thead><tbody>{filtered.map((item) => { const release = released ? getAgentRelease(item) : item; return <tr key={item.id}><td className="primary-cell"><strong>{item.name}</strong><small>{item.purpose || item.goal}</small></td><td>{item.type}</td><td>{released ? item.activeRelease : item.proposedRelease}</td><td>{scenarioBindingLabel(release, item.scenario)}</td><td>{release?.inputContract}<small className="table-sub">{release?.outputContract}</small></td><td><StatusBadge status={released ? item.status : item.validation?.status || item.status}></StatusBadge></td><td><button className="text-button" onClick={() => navigate(released ? "agent-detail" : "draft-config", item.id)}>查看详情</button></td></tr>; })}</tbody></table></div>
        )}
      </div>
    );
  }

  function AgentCard({ agent }) {
    const release = getAgentRelease(agent);
    return (
      <article className="agent-card">
        <div className="agent-card-head"><div className="agent-avatar"><Icon name={agent.type === "报告伴读 Agent" ? "book-open-check" : agent.type === "报告核验 Agent" ? "scan-search" : "sparkles"} size={19}></Icon></div><div><span>{agent.type}</span><h2>{agent.name}</h2></div><StatusBadge status={agent.status}></StatusBadge></div>
        <p>{displayBusinessTerm(agent.purpose)}</p>
        <div className="card-meta"><div><span>当前 Release</span><strong>{agent.activeRelease}</strong></div><div><span>输入合同</span><strong>{release.inputContract}</strong></div><div><span>输出合同</span><strong>{release.outputContract}</strong></div><div><span>场景</span><strong>{scenarioBindingLabel(release, agent.scenario)}</strong></div></div>
        <div className="card-foot"><span>{release.skills.length} 个 Skill · {release.tools.length} 个工具</span><button className="text-button" onClick={() => navigate("agent-detail", agent.id)}>查看详情</button></div>
      </article>
    );
  }

  function DraftCard({ draft }) {
    return (
      <article className="agent-card draft-card">
        <div className="agent-card-head"><div className="agent-avatar"><Icon name="file-pen-line" size={19}></Icon></div><div><span>{draft.type}</span><h2>{draft.name}</h2></div><StatusBadge status={draft.validation?.status || draft.status}></StatusBadge></div>
        <p>{displayBusinessTerm(draft.purpose || draft.goal)}</p>
        <div className="card-meta"><div><span>目标 Release</span><strong>{draft.proposedRelease}</strong></div><div><span>输入合同</span><strong>{draft.inputContract}</strong></div><div><span>输出合同</span><strong>{draft.outputContract}</strong></div><div><span>场景</span><strong>{draft.scenario}</strong></div></div>
        <div className="card-foot"><span>{draft.basedOn ? `来源 ${draft.basedOn}` : "新建"} · {draft.validation?.issues?.length ? `${draft.validation.issues.length} 项待处理` : `${draft.debugRuns?.length || 0} 次调试`}</span><button className="text-button" onClick={() => navigate("draft-config", draft.id)}>查看详情</button></div>
      </article>
    );
  }

  function AgentDetail() {
    const agent = model.agents.find((item) => item.id === route.id);
    if (!agent) return <NotFound title="Agent 不存在"></NotFound>;
    const release = getAgentRelease(agent, route.version);
    if (!release) return <NotFound title="Agent Release 不存在"></NotFound>;
    const isCurrentRelease = release.version === agent.activeRelease;
    const linkedRuns = model.runs.filter((run) => run.snapshot.agentId === agent.id && run.snapshot.agentRelease === release.version);
    return (
      <div className="page" data-screen-label="Agent 详情">
        <PageHeader
          back={() => navigate("agents")}
          eyebrow={`${agent.type} · Release ${release.version}`}
          title={agent.name}
          description={displayBusinessTerm(agent.purpose)}
          actions={<><Button icon="copy-plus" onClick={() => createDraftFromRelease(agent, release)}>基于此版本创建新草稿</Button>{isCurrentRelease ? <>{agent.status === "enabled" ? <Button icon="circle-stop" kind="danger-soft" onClick={() => setModal({ type: "agent-status", agentId: agent.id, enabled: false })}>停用</Button> : <Button icon="play" kind="primary" onClick={() => setAgentStatus(agent, true)}>重新启用</Button>}{["报告伴读 Agent", "报告核验 Agent"].includes(agent.type) ? <Button icon="inbox" kind="primary" onClick={() => { setRunTab("requests"); navigate("runs"); }}>{agent.type === "报告核验 Agent" ? "查看核验请求" : "查看报告请求"}</Button> : <Button icon="play" kind="primary" disabled={agent.status !== "enabled"} onClick={() => openRunModal({ agentId: agent.id })}>发起运行</Button>}</> : null}</>}
        ></PageHeader>
        {!isCurrentRelease ? <Notice kind="info" title="正在查看历史 Release">该精确版本保持只读；当前启用版本为 {agent.activeRelease}，历史运行不会改链。</Notice> : null}
        <div className="detail-hero compact-hero"><div className="detail-title"><span className="agent-avatar large"><Icon name={agent.type === "报告伴读 Agent" ? "book-open-check" : agent.type === "报告核验 Agent" ? "scan-search" : "sparkles"} size={23}></Icon></span><div><strong>{isCurrentRelease ? "当前不可变版本" : "历史不可变版本"}</strong><h2>{release.version}</h2><p>发布于 {release.releasedAt} · 验证于 {release.validationAt}</p></div></div><div className="hero-facts"><div className="fact"><span>输入合同</span><strong>{displayBusinessTerm(release.inputContract)}</strong></div><div className="fact"><span>输出合同</span><strong>{displayBusinessTerm(release.outputContract)}</strong></div><div className="fact"><span>已发布本体</span><strong>{displayBusinessTerm(release.ontology)}</strong></div></div></div>
        <Tabs value={agentTab} onChange={setAgentTab} items={[{ id: "overview", label: "概览" }, { id: "resources", label: "资源与权限" }, { id: "versions", label: "版本记录", count: agent.releases.length }, { id: "runs", label: "运行记录", count: linkedRuns.length }]}></Tabs>
        {agentTab === "overview" ? <AgentOverview agent={agent} release={release}></AgentOverview> : null}
        {agentTab === "resources" ? <ReleaseResources release={release}></ReleaseResources> : null}
        {agentTab === "versions" ? <ReleaseHistory agent={agent}></ReleaseHistory> : null}
        {agentTab === "runs" ? <RunTable runs={linkedRuns}></RunTable> : null}
      </div>
    );
  }

  function AgentOverview({ agent, release }) {
    return <div className="detail-grid"><section className="panel"><div className="panel-head"><div><h2>任务与边界</h2><p>当前版本固定的业务合同</p></div></div><div className="panel-body"><KeyValueList rows={[{ label: "Agent 定义", value: agent.name }, { label: "适用场景", value: scenarioBindingLabel(release, agent.scenario) }, { label: "场景绑定版本", value: release.scenarioBinding ? `${release.scenarioBinding.id} · ${release.scenarioBinding.version}` : "缺失" }, { label: "绑定方式", value: release.scenarioBinding?.mode === "request-context" ? "按外部固定请求上下文" : "固定场景与对象范围" }, { label: "允许输入", value: displayBusinessTerm(release.inputContract) }, { label: "结构化输出", value: displayBusinessTerm(release.outputContract) }, { label: "本体范围", value: release.ontologyScope }, { label: "版本变更", value: release.change }]}></KeyValueList></div></section><div className="stack"><Notice kind="info" title="权威边界">{agent.type === "报告核验 Agent" ? "LLM 只抽取报告声明、定位锚点并建立固定证据映射；不读取业务明细、不重算指标，也不决定核验通过或失败。" : "LLM 只解释固定证据，不作为数据源、正式计算层或确定性路由规则责任方。"}</Notice><section className="panel"><div className="panel-head"><h2>发布状态</h2></div><div className="panel-body"><div className="status-line"><StatusBadge status={agent.status}></StatusBadge><span>{agent.status === "enabled" ? "可使用当前版本创建新运行" : "历史记录可读，新运行已停止"}</span></div><p className="muted-copy">修改提示词、技能、工具或绑定必须创建新的 Agent 草稿，验证后发布新版本；当前版本不会原地变化。</p></div></section></div></div>;
  }

  function ReleaseResources({ release }) {
    const prompt = getPrompt(release.prompt.id, release.prompt.version, model.resourceReleases?.prompts || []);
    return <div className="resource-sections"><section className="panel"><div className="panel-head"><div><h2>系统提示词</h2><p>只读精确版本</p></div></div><div className="panel-body"><ResourceRow icon="message-square-text" title={prompt.resource?.name || release.prompt.id} subtitle={`版本 ${release.prompt.version} · ${displayBusinessTerm(release.outputContract)}`} status="published" onOpen={() => navigateResource("prompt", release.prompt.id, release.prompt.version)}></ResourceRow></div></section><section className="panel"><div className="panel-head"><div><h2>技能绑定</h2><p>{release.skills.length} 个精确版本</p></div></div><div className="panel-body resource-list">{release.skills.map((binding) => { const skill = getSkill(binding.id, binding.version); return <ResourceRow key={`${binding.id}-${binding.version}`} icon="blocks" title={skill.resource?.name || binding.id} subtitle={`版本 ${binding.version} · ${displayBusinessTerm(skill.value?.outputContract || "")}`} status={skill.value?.status} onOpen={() => navigateResource("skill", binding.id, binding.version)}></ResourceRow>; })}</div></section><section className="panel"><div className="panel-head"><div><h2>工具白名单</h2><p>运行时不能动态扩大</p></div></div><div className="panel-body resource-list">{release.tools.map((toolId) => { const tool = getTool(toolId); return <ResourceRow key={toolId} icon={tool.category.includes("内部") ? "shield-check" : "plug"} title={displayBusinessTerm(tool.name)} subtitle={`${tool.version} · ${displayBusinessTerm(tool.owner)}`} status={tool.availability} statusLabel={tool.availabilityLabel} onOpen={() => navigateResource("tool", tool.id, tool.version)}></ResourceRow>; })}</div></section><section className="panel"><div className="panel-head"><h2>已发布本体绑定</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "精确版本", value: displayBusinessTerm(release.ontology) }, { label: "获准范围", value: release.ontologyScope }, { label: "消费方式", value: "只读固定引用；不自行选择当前或最新版本" }]}></KeyValueList></div></section></div>;
  }

  function ResourceRow({ icon, title, subtitle, status, statusLabel, onOpen }) {
    return <div className="resource-row"><div className="resource-icon"><Icon name={icon}></Icon></div><div><strong>{title}</strong><small>{subtitle}</small></div>{status ? <StatusBadge status={status} label={statusLabel}></StatusBadge> : null}<button className="text-button" onClick={onOpen}>查看详情</button></div>;
  }

  function ReleaseHistory({ agent }) {
    return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Release</th><th>发布时间</th><th>Prompt</th><th>场景绑定</th><th>Skill / Tool</th><th>变更</th><th></th></tr></thead><tbody>{agent.releases.map((release, index) => <tr key={release.version}><td><strong>{release.version}</strong>{release.version === agent.activeRelease ? <StatusBadge status="enabled" label="当前"></StatusBadge> : <StatusBadge status="history"></StatusBadge>}</td><td>{release.releasedAt}</td><td>{getPrompt(release.prompt.id, release.prompt.version, model.resourceReleases?.prompts || []).resource?.name}<small className="table-sub">版本 {release.prompt.version}</small></td><td>{scenarioBindingLabel(release)}<small className="table-sub">{release.scenarioBinding?.id} · {release.scenarioBinding?.version}</small></td><td>{release.skills.length} / {release.tools.length}</td><td>{release.change}</td><td><div className="inline-actions"><button className="text-button" onClick={() => navigate("agent-detail", agent.id, release.version)}>查看详情</button><button className="text-button" onClick={() => setDrawer({ type: "release-diff", agent, release, previous: agent.releases[index + 1] || null })}>查看差异</button><button className="text-button" onClick={() => createDraftFromRelease(agent, release)}>创建草稿</button></div></td></tr>)}</tbody></table></div>;
  }

  function DraftConfig() {
    const draft = model.drafts.find((item) => item.id === route.id);
    if (!draft) return <NotFound title="配置草稿不存在"></NotFound>;
    const latestDebug = draft.debugRuns?.[0] || null;
    const compatibleSkills = window.AGENT_SKILLS.filter((skill) => skill.versions.some((version) => version.compatibleTypes.includes(draft.type)));
    return (
      <div className={`page config-page ${debugRailOpen ? "debug-open" : ""}`} data-screen-label="Agent 配置工作区">
        <PageHeader
          back={() => window.history.back()}
          eyebrow={`${draft.type} · ${draft.basedOn ? `基于 Release ${draft.basedOn}` : "新配置"}`}
          title={draft.name}
          description={`目标 Release ${draft.proposedRelease} · 草稿与正式目录分离`}
          actions={<><Button icon="panel-right" onClick={() => setDebugRailOpen(!debugRailOpen)}>{debugRailOpen ? "收起调试" : "展开调试"}</Button><Button icon="shield-check" onClick={() => validateDraft(draft)}>验证配置</Button><Button icon="rocket" kind="primary" disabled={draft.validation.status !== "validated"} onClick={() => publishDraft(draft)}>发布 Release</Button></>}
        ></PageHeader>
        {draft.validation.status === "blocked" ? <Notice kind="danger" title="当前不能发布">{draft.validation.issues.join("；")}</Notice> : draft.validation.status === "validated" ? <Notice kind="success" title="配置验证通过">版本已固定，可发布为新的不可变 Agent Release。</Notice> : draft.validation.status === "validating" ? <Notice kind="info" title="正在验证">检查工具可用性、本体兼容、证据边界和输出合同。</Notice> : null}
        <div className="config-workspace">
          <section className="config-main">
            <div className="config-section">
              <div className="section-title"><span>01</span><div><h2>目标与业务合同</h2><p>明确任务、输入和输出，不把业务公式写入 Agent。</p></div></div>
              <div className="form-grid"><div className="form-field full"><label>Agent 目标</label><input value={draft.goal} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, goal: event.target.value }))} /></div><div className="form-field full"><label>业务说明</label><textarea value={draft.purpose} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, purpose: event.target.value }))}></textarea></div><div className="form-field"><label>目标 Release</label><input value={draft.proposedRelease} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, proposedRelease: event.target.value.trim() }))} placeholder="例如 1.3" /></div><div className="form-field"><label>场景引用</label><select value={draft.scenario} onChange={(event) => updateDraft(draft.id, (item) => { const scenario = event.target.value; return { ...item, scenario, scenarioBinding: scenarioBindingFromScenario(scenario, item.type, item.scenarioBinding) }; })}><option>待引用场景清单</option><option>S001 · 集团融资成本与债务结构优化</option>{draft.type === "报告伴读 Agent" ? <option>报告上下文按请求绑定</option> : null}{draft.type === "报告核验 Agent" ? <option>报告核验上下文按请求绑定</option> : null}{draft.type === "报告草稿 Agent" ? <option>S004 · 待业务资料</option> : null}</select><small>发布时固定为场景绑定版本；不复制场景清单或其他模块状态。</small></div><div className="form-field"><label>输入合同</label><select value={draft.inputContract} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, inputContract: event.target.value }))}><option>Generation Evidence Package v1</option><option>Report Context Binding v1</option><option>Report Verification Request v1</option><option>Report Generation Request v1</option><option>待配置</option></select></div><div className="form-field"><label>输出合同</label><select value={draft.outputContract} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, outputContract: event.target.value }))}><option>AI Insight v1</option><option>Report Copilot Answer v1</option><option>Report Verification Extraction v1</option><option value="Agent Report Draft v1">Agent 报告草稿 v1</option><option>待配置</option></select></div></div>
            </div>
            <div className="config-section">
              <div className="section-title"><span>02</span><div><h2>系统 Prompt</h2><p>{draft.promptName || draft.prompt.id} · 草稿内容可编辑；发布后形成新精确版本。</p></div>{draft.promptBaseVersion ? <button className="text-button" onClick={() => navigateResource("prompt", draft.prompt.id, draft.promptBaseVersion)}>查看历史版本</button> : <span className="version-pill">新 Prompt 标识</span>}</div>
              <textarea className="prompt-editor" value={draft.promptContent} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, promptContent: event.target.value }))} placeholder="按任务、证据边界、输出要求和禁止事项组织内容"></textarea>
              <div className="inline-note"><Icon name="shield-alert" size={14}></Icon>不得写入 Metric 公式、Rule 阈值、权威业务结论或绕过固定证据的全局指令。</div>
            </div>
            <div className="config-section">
              <div className="section-title"><span>03</span><div><h2>Skill Binding</h2><p>选择精确 Skill 版本；修改不影响来源 Release。</p></div></div>
              <div className="binding-grid">{compatibleSkills.map((skill) => {
                const binding = draft.skills.find((item) => item.id === skill.id);
                const defaultVersion = skill.versions.find((item) => item.status === "published") || skill.versions[0];
                const selectedVersion = skill.versions.find((item) => item.version === binding?.version) || defaultVersion;
                const checked = Boolean(binding);
                return <div className={`binding-card ${checked ? "selected" : ""}`} key={skill.id}>
                  <input aria-label={`绑定${skill.name}`} type="checkbox" checked={checked} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, skills: event.target.checked ? [...item.skills.filter((entry) => entry.id !== skill.id), { id: skill.id, version: selectedVersion.version }] : item.skills.filter((entry) => entry.id !== skill.id) }))} />
                  <span className="resource-icon"><Icon name="blocks"></Icon></span>
                  <span><strong>{skill.name}</strong><small>{selectedVersion.outputContract}</small></span>
                  <select aria-label={`${skill.name}精确版本`} value={selectedVersion.version} disabled={!checked} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, skills: item.skills.map((entry) => entry.id === skill.id ? { ...entry, version: event.target.value } : entry) }))}>{skill.versions.map((version) => <option key={version.version} value={version.version}>{version.version} · {version.status === "published" ? "已发布" : version.status === "history" ? "历史" : "草稿"}</option>)}</select>
                  <button type="button" className="text-button" onClick={() => navigateResource("skill", skill.id, selectedVersion.version)}>查看详情</button>
                </div>;
              })}</div>
            </div>
            <div className="config-section">
              <div className="section-title"><span>04</span><div><h2>工具白名单</h2><p>只允许配置与 Agent 类型兼容的受控工具；不可用工具会阻断发布。</p></div></div>
              <div className="tool-config-table"><div className="tool-config-head"><span>启用</span><span>工具</span><span>责任方 / 作用</span><span>状态</span><span></span></div>{window.AGENT_TOOLS.filter((tool) => tool.compatible === "全部 Agent 类型" || tool.compatible.includes(draft.type.replace(" Agent", "")) || tool.compatible.includes(draft.type)).map((tool) => { const checked = draft.tools.includes(tool.id); return <div className="tool-config-row" key={tool.id}><span><input type="checkbox" checked={checked} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, tools: event.target.checked ? [...item.tools, tool.id] : item.tools.filter((id) => id !== tool.id) }))} /></span><span><strong>{displayBusinessTerm(tool.name)}</strong><small>{tool.version} · {tool.category}</small></span><span><strong>{displayBusinessTerm(tool.owner)}</strong><small>{displayBusinessTerm(tool.purpose)}</small></span><span><StatusBadge status={tool.availability} label={tool.availabilityLabel}></StatusBadge></span><span><button className="text-button" onClick={() => navigateResource("tool", tool.id, tool.version)}>查看详情</button></span></div>; })}</div>
            </div>
            <div className="config-section">
              <div className="section-title"><span>05</span><div><h2>本体与证据范围</h2><p>只引用精确的已发布版本，不提供“自动最新”选项。</p></div></div>
              <div className="form-grid"><div className="form-field full"><label>已发布本体绑定</label><select value={draft.ontology} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, ontology: event.target.value }))}><option value="企业融资语义 · Published 2026.07">企业融资语义 · 已发布 2026.07</option><option value="由报告固定上下文提供精确 Published 版本">由报告固定上下文提供精确已发布版本</option><option value="待配置精确 Published 版本">待配置精确已发布版本</option></select></div><div className="form-field full"><label>获准资源与证据范围</label><textarea value={draft.ontologyScope} onChange={(event) => updateDraft(draft.id, (item) => ({ ...item, ontologyScope: event.target.value }))}></textarea></div></div>
            </div>
          </section>
          {debugRailOpen ? <DebugRail draft={draft} run={latestDebug}></DebugRail> : null}
        </div>
      </div>
    );
  }

  function DebugRail({ draft, run }) {
    const evidenceOptions = model.evidencePackages.filter((item) => currentProjection(item) && (draft.type === "报告伴读 Agent" ? item.kind === "report" : draft.type === "报告草稿 Agent" ? false : item.kind === "finance"));
    const evidence = model.evidencePackages.find((item) => item.id === debugForm.evidenceId);
    return <aside className="debug-rail"><div className="debug-head"><div><span className="live-dot"></span><strong>实时调试</strong><small>仅生成草稿试运行记录</small></div><button className="btn icon-only" onClick={() => setDebugRailOpen(false)} title="收起"><Icon name="panel-right-close"></Icon></button></div><div className="debug-scroll"><div className="debug-section"><label>测试任务输入</label><textarea value={debugForm.input} onChange={(event) => setDebugForm({ ...debugForm, input: event.target.value })}></textarea></div><div className="debug-section"><label>固定证据包</label>{evidenceOptions.length ? <><select value={debugForm.evidenceId} onChange={(event) => setDebugForm({ ...debugForm, evidenceId: event.target.value })}>{evidenceOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.dataAsOf}</option>)}</select>{evidence ? <div className="context-preview"><strong>{evidence.statusLabel}</strong><span>{displayBusinessTerm(evidence.ontologyVersion)}</span><span>{evidence.dataVersion} · 截至 {evidence.dataAsOf}</span><span>{evidence.quality} · {evidence.freshness}</span>{evidence.report ? <span>{evidence.report.contentVersion} · {evidence.report.anchor}</span> : null}</div> : null}</> : <Notice kind="danger" title="缺少可调试输入">报告定义、章节合同与固定证据包尚未接入。</Notice>}</div><div className="debug-section"><label>输入状态</label><select value={debugForm.condition} onChange={(event) => setDebugForm({ ...debugForm, condition: event.target.value })}><option value="normal">合同完整</option><option value="quality">质量异常</option><option value="permission">权限不足</option><option value="missing">证据缺失</option><option value="version">版本不兼容</option><option value="tool">工具调用失败</option><option value="partial">部分结果</option></select></div><div className="button-row stretch"><Button icon="play" kind="primary" disabled={!evidenceOptions.length || (run && ["waiting", "running"].includes(run.status))} onClick={() => startDebugRun(draft)}>开始调试</Button>{run && ["waiting", "running"].includes(run.status) ? <Button icon="square" onClick={() => cancelDebugRun(draft.id, run.id)}>取消</Button> : null}<Button icon="eraser" disabled={!draft.debugRuns.length} onClick={() => clearDebugRuns(draft.id)}>清空</Button></div>{run ? <DebugRunView run={run}></DebugRunView> : <EmptyState icon="terminal-square" title="尚未开始调试" description={evidenceOptions.length ? "选择固定输入后开始；调试通过不会自动发布。" : "输入合同补齐后才能开始调试。"}></EmptyState>}</div></aside>;
  }

  function DebugRunView({ run }) {
    return <div className="debug-run"><div className="debug-run-head"><div><strong className="mono">{run.id}</strong><small>{run.createdAt}</small></div><StatusBadge status={run.status}></StatusBadge></div>{run.error ? <Notice kind="danger" title="本次调试未通过">{run.error}</Notice> : null}{run.recovery ? <div className="recovery-box"><strong>恢复方式</strong><span>{run.recovery}</span></div> : null}<div className="mini-trace"><h3>工具调用轨迹</h3>{run.toolCalls.map((call) => <div className="mini-trace-row" key={call.id}><span className={`trace-dot ${call.status}`}></span><div><strong>{call.toolName || call.toolId}</strong><small>{call.toolVersion} · {call.toolOwner}</small><small>{call.input}</small>{call.output ? <small>{call.output}</small> : null}</div><StatusBadge status={call.status}></StatusBadge>{call.duration ? <em>{call.duration}</em> : null}</div>)}</div>{run.result ? <div className="debug-result"><div className="result-title"><Icon name="sparkles"></Icon><div><strong>{run.result.title}</strong><span>{run.result.outputValidation}</span></div></div><p>{run.result.summary}</p><div className="citation-chips">{run.result.citations.map((ref) => <span key={ref}><Icon name="link-2" size={12}></Icon>{ref}</span>)}</div><div className="confirmation-line"><StatusBadge status="pending" label="未人工确认"></StatusBadge></div></div> : null}</div>;
  }

  function ResourceDirectory() {
    const promptResources = listPromptResources(model.resourceReleases?.prompts || []);
    const availableTools = window.AGENT_TOOLS.filter((item) => item.availability === "available");
    const resources = resourceKind === "prompt" ? promptResources : resourceKind === "skill" ? window.AGENT_SKILLS : availableTools;
    return <div className="page" data-screen-label="配置资源"><PageHeader title="配置资源" description="Prompt 规定任务和表达边界，Skill 固化可复用方法，Tool 提供受控能力；Agent Release 只引用经过核对的精确版本。"></PageHeader><ResourceRoleGuide></ResourceRoleGuide><Tabs value={resourceKind} onChange={setResourceKind} items={[{ id: "prompt", label: "Prompt", count: promptResources.length }, { id: "skill", label: "Skill", count: window.AGENT_SKILLS.length }, { id: "tool", label: "Tool", count: availableTools.length }]}></Tabs><div className="resource-directory">{resources.map((resource) => { const version = resourceKind === "tool" ? resource.version : resource.versions[0].version; const status = resourceKind === "tool" ? resource.availability : resource.versions[0].status; const subtitle = resourceKind === "tool" ? `${resource.category} · ${resource.owner}` : resourceKind === "prompt" ? `${resource.owner} · ${resource.versions.length} 个版本` : `${resource.versions[0].purpose}`; return <div className="resource-directory-row" key={resource.id}><span className="resource-icon"><Icon name={resourceKind === "prompt" ? "message-square-text" : resourceKind === "skill" ? "blocks" : "plug"}></Icon></span><div><strong>{resource.name}</strong><small>{subtitle}</small></div><span className="version-pill">{version}</span><StatusBadge status={status} label={resourceKind === "tool" ? resource.availabilityLabel : null}></StatusBadge><button className="text-button" onClick={() => navigateResource(resourceKind, resource.id, version)}>查看详情</button></div>; })}</div></div>;
  }

  function ResourceRoleGuide() {
    const roles = [
      { icon: "message-square-text", name: "Prompt", text: "规定角色、问题理解、证据边界、回答结构和失败表达，不保存业务公式或权威结论。" },
      { icon: "blocks", name: "Skill", text: "把可重复的方法封装成有输入、输出、前置条件和失败规则的能力，并声明可调用工具。" },
      { icon: "plug", name: "Tool", text: "连接确定性能力或跨模块只读资源，记录输入、输出、状态、耗时和恢复路径。" },
      { icon: "package-check", name: "Agent Release", text: "锁定 Prompt、Skill、Tool、场景绑定和权限的精确组合；新版本不会改写历史运行。" }
    ];
    return <section className="resource-role-guide" aria-label="配置资源工作原理">{roles.map((role, index) => <React.Fragment key={role.name}><div className="resource-role"><span><Icon name={role.icon} size={16}></Icon></span><div><strong>{role.name}</strong><p>{role.text}</p></div></div>{index < roles.length - 1 ? <Icon className="resource-role-arrow" name="chevron-right" size={15}></Icon> : null}</React.Fragment>)}</section>;
  }

  function ResourceDetail() {
    const kind = route.kind;
    if (kind === "tool") {
      const tool = getTool(route.id);
      if (!tool || (route.version && route.version !== tool.version)) return <NotFound title="工具精确版本不存在"></NotFound>;
      return <ToolDetail tool={tool}></ToolDetail>;
    }
    const lookup = kind === "prompt" ? getPrompt(route.id, route.version, model.resourceReleases?.prompts || []) : getSkill(route.id, route.version);
    if (!lookup.resource || !lookup.value) return <NotFound title={`${contractLabel(kind)} 不存在`}></NotFound>;
    return <div className="page" data-screen-label={`${contractLabel(kind)} 详情`}><PageHeader back={() => window.history.back()} eyebrow={`${contractLabel(kind)} · 版本 ${lookup.value.version}`} title={lookup.resource.name} description={kind === "prompt" ? "系统任务边界与生成约束" : lookup.value.purpose} actions={<StatusBadge status={lookup.value.status}></StatusBadge>}></PageHeader><Tabs value={resourceTab} onChange={setResourceTab} items={[{ id: "detail", label: "配置详情" }, { id: "versions", label: "版本记录", count: lookup.versions.length }, { id: "diff", label: "版本差异" }]}></Tabs>{resourceTab === "detail" ? (kind === "prompt" ? <PromptDetail value={lookup.value}></PromptDetail> : <SkillDetail value={lookup.value}></SkillDetail>) : null}{resourceTab === "versions" ? <ResourceVersions kind={kind} resource={lookup.resource} versions={lookup.versions}></ResourceVersions> : null}{resourceTab === "diff" ? <ResourceDiff kind={kind} versions={lookup.versions}></ResourceDiff> : null}</div>;
  }

  function PromptDetail({ value }) {
    return <div className="resource-detail-layout"><section className="panel"><div className="panel-head"><div><h2>结构化内容</h2><p>运行时按顺序执行的只读指令</p></div></div><div className="panel-body prompt-sections">{value.sections.map((section, index) => <div className="prompt-section" key={section.title}><span>{String(index + 1).padStart(2, "0")} · {section.title}</span><p>{section.body}</p></div>)}</div></section><div className="stack"><section className="panel"><div className="panel-head"><h2>上下文合同</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "变量", value: value.variables.join("、") }, { label: "上下文边界", value: value.contextBoundary }, { label: "适用输出合同", value: value.outputContracts.join("、") }, { label: "最近验证", value: value.validatedAt }, { label: "版本变更", value: value.change }]}></KeyValueList></div></section><section className="panel"><div className="panel-head"><div><h2>运行时如何生效</h2><p>Prompt 不是一段自由文案</p></div></div><div className="panel-body"><ol className="mechanism-steps"><li><strong>装配</strong><span>先由平台固定场景、Agent Release、证据和精确版本。</span></li><li><strong>核对</strong><span>执行身份、权限、质量和用途门；失败时不进入生成。</span></li><li><strong>生成</strong><span>模型只能在结构化指令和获准证据范围内组织语言。</span></li><li><strong>校验</strong><span>检查输出合同、证据引用、限制和禁止项，再保存结果。</span></li></ol></div></section><Notice kind="info" title="配置约束">Prompt 不保存 Metric 公式、Rule 阈值、权威业务结论或绕过固定证据的全局指令；模型内部思维过程也不作为运行结果保存。</Notice></div></div>;
  }

  function SkillDetail({ value }) {
    return <div className="resource-detail-layout"><section className="panel"><div className="panel-head"><h2>能力合同</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "用途", value: value.purpose }, { label: "前置条件", value: value.prerequisites }, { label: "输入合同", value: value.inputContract }, { label: "输出合同", value: value.outputContract }, { label: "证据引用要求", value: value.evidenceRule }, { label: "兼容 Agent", value: value.compatibleTypes.join("、") }, { label: "依赖资源", value: value.dependencies }, { label: "失败限制", value: value.failureLimits }, { label: "最近验证", value: value.validatedAt }]}></KeyValueList><div className="skill-principle"><strong>工作原理</strong><p>Skill 接收已通过门禁的结构化输入，按固定步骤组织证据、调用白名单工具并校验输出。它不保存权威业务状态，也不能越过 Agent Release 扩大数据或工具权限。</p></div></div></section><section className="panel"><div className="panel-head"><div><h2>允许调用的工具</h2><p>由 Skill 声明，Agent Release 再收窄</p></div></div><div className="panel-body resource-list">{value.toolIds.map((toolId) => { const tool = getTool(toolId); return <ResourceRow key={toolId} icon="plug" title={tool?.name || toolId} subtitle={`${tool?.version || ""} · ${tool?.owner || ""}`} status={tool?.availability} statusLabel={tool?.availabilityLabel} onOpen={() => navigateResource("tool", toolId, tool?.version)}></ResourceRow>; })}</div></section></div>;
  }

  function ResourceVersions({ kind, resource, versions }) {
    return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>版本</th><th>状态</th><th>最近验证</th><th>变更</th><th></th></tr></thead><tbody>{versions.map((version) => <tr key={version.version}><td><strong>{version.version}</strong></td><td><StatusBadge status={version.status}></StatusBadge></td><td>{version.validatedAt || "尚未验证"}</td><td>{version.change}</td><td><button className="text-button" onClick={() => { window.history.pushState({}, "", `#/resources/${kind}/${resource.id}/${encodeURIComponent(version.version)}`); setRoute(resolveRoute()); setResourceTab("detail"); }}>查看详情</button></td></tr>)}</tbody></table></div>;
  }

  function ResourceDiff({ kind, versions }) {
    if (versions.length < 2) return <EmptyState icon="git-compare-arrows" title="没有可比较的历史版本" description="新版本发布后可在此查看精确差异。"></EmptyState>;
    const current = versions[0];
    const previous = versions[1];
    return <div className="diff-grid"><section className="panel"><div className="panel-head"><h2>版本 {previous.version}</h2></div><div className="panel-body"><KeyValueList rows={kind === "prompt" ? [{ label: "变量", value: previous.variables.join("、") }, { label: "上下文边界", value: previous.contextBoundary }, { label: "输出合同", value: previous.outputContracts.join("、") }, { label: "变更说明", value: previous.change }] : [{ label: "输入", value: previous.inputContract }, { label: "输出", value: previous.outputContract }, { label: "工具", value: previous.toolIds.join("、") }, { label: "限制", value: previous.failureLimits }]}></KeyValueList></div></section><section className="panel current-diff"><div className="panel-head"><h2>版本 {current.version}</h2></div><div className="panel-body"><KeyValueList rows={kind === "prompt" ? [{ label: "变量", value: current.variables.join("、") }, { label: "上下文边界", value: current.contextBoundary }, { label: "输出合同", value: current.outputContracts.join("、") }, { label: "变更说明", value: current.change }] : [{ label: "输入", value: current.inputContract }, { label: "输出", value: current.outputContract }, { label: "工具", value: current.toolIds.join("、") }, { label: "限制", value: current.failureLimits }]}></KeyValueList></div></section></div>;
  }

  function ToolDetail({ tool }) {
    const unresolved = "合同未完成；当前不可启用";
    return <div className="page" data-screen-label="Tool 详情"><PageHeader back={() => window.history.back()} eyebrow={`${tool.category} · 版本 ${tool.version}`} title={displayBusinessTerm(tool.name)} description={displayBusinessTerm(tool.purpose)} actions={<StatusBadge status={tool.availability} label={tool.availabilityLabel}></StatusBadge>}></PageHeader>{tool.availability !== "available" ? <Notice kind="danger" title={`${tool.availabilityLabel}：当前不能加入可发布 Agent 版本`}>{tool.recovery}</Notice> : null}<div className="tool-call-flow" aria-label="工具调用过程"><span>固定运行快照</span><Icon name="chevron-right" size={14}></Icon><span>权限与用途校验</span><Icon name="chevron-right" size={14}></Icon><span>按精确版本调用</span><Icon name="chevron-right" size={14}></Icon><span>保存输出与审计</span></div><div className="resource-detail-layout"><section className="panel"><div className="panel-head"><h2>业务与权限合同</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "能力提供方", value: tool.provider }, { label: "Owner", value: tool.owner }, { label: "业务用途", value: tool.purpose }, { label: "允许动作", value: tool.allowed }, { label: "禁止动作", value: tool.forbidden }, { label: "可访问范围", value: tool.scope }, { label: "风险等级", value: tool.risk }]}></KeyValueList></div></section><div className="stack"><section className="panel"><div className="panel-head"><h2>输入输出与恢复</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "输入合同", value: tool.input }, { label: "输出合同", value: tool.output }, { label: "前置条件", value: tool.prerequisites }, { label: "超时规则", value: tool.timeoutRule || unresolved }, { label: "失败规则", value: tool.failureRule || unresolved }, { label: "重试规则", value: tool.retryRule || unresolved }, { label: "部分结果规则", value: tool.partialRule || unresolved }, { label: "恢复方式", value: tool.recovery }, { label: "审计留痕", value: tool.audit }, { label: "兼容 Agent", value: tool.compatible }, { label: "适用合同", value: tool.contracts }, { label: "最近验证", value: tool.validatedAt || "尚未验证" }]}></KeyValueList></div></section><Notice kind="info" title={tool.category.includes("内部") ? "内部校验器" : "跨模块资源"}>{tool.category.includes("内部") ? "校验器只判断结构和引用，不产生业务事实。" : "Agent 应用只使用获准引用，不复制能力提供方的权威状态。"}</Notice></div></div></div>;
  }

  function RunCenter() {
    if (window.AGENT_WORKSPACE_CONFIG.variant === "task") return <TaskWorkbench></TaskWorkbench>;
    const currentRequests = model.inboundRequests.filter(currentProjection);
    const currentRuns = model.runs.filter(currentProjection);
    const historyRuns = window.AGENT_PORTFOLIO ? model.runs.filter((run) => run.portfolioRecord) : model.runs;
    return <div className="page" data-screen-label="运行中心"><PageHeader title="运行中心" description="从真实跨模块请求或固定输入创建运行，统一追踪结果、证据与恢复。" actions={<><Button icon="file-plus-2" onClick={() => { const candidates = readC022Candidates(); setC022Candidates(candidates); setC022SelectedId(candidates[0]?.requestId || null); setModal({ type: "c022-receive" }); }}>接收生成请求</Button><Button icon="messages-square" onClick={() => { const candidates = readC024Candidates(); setC024Candidates(candidates); setC024SelectedId(candidates[0]?.requestId || null); setModal({ type: "c024-receive" }); }}>接收伴读请求</Button><Button icon="play" kind="primary" onClick={() => openRunModal()}>发起运行</Button></>}></PageHeader><Tabs value={runTab} onChange={setRunTab} items={[{ id: "requests", label: "当前请求", count: currentRequests.length }, { id: "history", label: "运行记录", count: historyRuns.length }]}></Tabs>{runTab === "requests" ? <RequestList></RequestList> : <RunTable runs={historyRuns}></RunTable>}</div>;
  }

  function TaskWorkbench() {
    const pending = model.inboundRequests.filter((request) => request.status === "pending");
    const latest = model.runs[0] || null;
    const contextEvidenceId = latest?.snapshot.evidenceId || pending[0]?.evidenceId;
    const evidence = latest ? evidenceFromSnapshot(latest.snapshot) : model.evidencePackages.find((item) => item.id === contextEvidenceId) || null;
    return <div className="page task-page" data-screen-label="Agent 任务工作台"><PageHeader title="任务工作台" description="处理外部请求或发起固定输入运行，在一个工作区查看结果和恢复。" actions={<Button icon="plus" kind="primary" onClick={() => openRunModal()}>新建任务</Button>}></PageHeader><div className="task-workspace"><section className="task-column queue-column"><div className="column-head"><div><h2>待处理</h2><span>{pending.length} 项</span></div></div><div className="column-scroll">{pending.length ? pending.map((request) => <article className="task-item" key={request.id}><div><StatusBadge status="pending"></StatusBadge><span>{request.source}</span></div><h3>{request.title}</h3><p>{request.question}</p><small>{request.reportVersion}</small><Button icon="arrow-right" kind="soft" onClick={() => openRunModal({ agentId: request.agentId, evidenceId: request.evidenceId, requestId: request.id })}>开始处理</Button></article>) : <EmptyState icon="inbox" title="没有待处理请求" description="新的外部请求会进入这里。"></EmptyState>}<div className="column-divider"><span>最近任务</span></div>{model.runs.slice(0, 5).map((run) => <button className={`task-history-item ${latest?.id === run.id ? "active" : ""}`} key={run.id} onClick={() => navigate("run-detail", run.id)}><Icon name="activity"></Icon><span><strong>{run.snapshot.agentName}</strong><small>{run.id}</small></span><StatusBadge status={run.status}></StatusBadge></button>)}</div></section><section className="task-column focus-column">{latest ? <><div className="column-head"><div><h2>{latest.snapshot.agentName}</h2><span className="mono">{latest.id}</span></div><Button icon="external-link" onClick={() => navigate("run-detail", latest.id)}>查看详情</Button></div><div className="column-scroll"><RunFocus run={latest}></RunFocus></div></> : <EmptyState icon="play-circle" title="尚无运行" description="处理左侧请求，或新建一个固定输入任务。" action={<Button icon="play" kind="primary" onClick={() => openRunModal()}>新建任务</Button>}></EmptyState>}</section><aside className="task-column context-column"><div className="column-head"><div><h2>固定输入</h2><span>只读快照</span></div></div><div className="column-scroll">{evidence ? <><KeyValueList compact rows={[{ label: "证据包", value: evidence.name }, { label: "已发布语义", value: displayBusinessTerm(evidence.ontologyVersion) }, { label: "数据版本", value: evidence.dataVersion }, { label: "截至时间", value: evidence.dataAsOf }, { label: "质量", value: evidence.quality }, { label: "新鲜度", value: evidence.freshness }]}></KeyValueList><div className="evidence-mini-list">{evidence.items.slice(0, 5).map((item) => <div key={item.id}><span>{displayBusinessTerm(item.type)}</span><strong>{displayBusinessTerm(item.name)}</strong><small>{displayBusinessTerm(item.value)}</small></div>)}</div><Button icon="files" onClick={() => latest ? setDrawer({ type: "run-evidence-snapshot", run: latest }) : navigate("evidence-detail", evidence.id)}>查看详情</Button></> : null}</div></aside></div></div>;
  }

  function RunFocus({ run }) {
    return <div className="run-focus"><div className="run-focus-status"><span className={`big-status ${run.status}`}><Icon name={["waiting", "running"].includes(run.status) ? "loader-circle" : ["complete", "partial"].includes(run.status) ? "circle-check" : run.status === "cancelled" ? "circle-slash" : "circle-alert"} size={24} className={["waiting", "running"].includes(run.status) ? "spin" : ""}></Icon></span><div><StatusBadge status={run.status}></StatusBadge><h3>{run.question}</h3><p>{run.createdAt}</p></div></div><div className="timeline compact-timeline">{run.steps.map((step) => <div className="timeline-step" key={step.id}><span className={`timeline-dot ${step.status}`}><Icon name={step.status === "complete" ? "check" : step.status === "running" ? "loader-circle" : step.status === "blocked" || step.status === "failed" ? "x" : "minus"} size={12}></Icon></span><div className="timeline-copy"><strong>{step.name}</strong><span>{displayBusinessTerm(step.detail)}</span></div><StatusBadge status={step.status}></StatusBadge></div>)}</div>{run.error ? <Notice kind="danger" title="任务未完成">{displayBusinessTerm(run.error)}</Notice> : null}{run.result ? <div className="result-summary focus-result"><span>{displayBusinessTerm(run.result.type)}</span><h2>{run.result.title}</h2><p>{displayBusinessTerm(run.result.summary)}</p><Button icon="arrow-right" kind="primary" onClick={() => navigate("run-detail", run.id)}>查看结果</Button></div> : null}</div>;
  }

  function RequestList() {
    const requests = model.inboundRequests.filter(currentProjection);
    return requests.length ? <div className="request-grid">{requests.map((request) => {
      const generationRequest = request.type === "report-draft";
      const verificationRequest = request.type === "report-verification";
      const rows = generationRequest
        ? [{ label: "场景 / 轮次", value: `${request.scenarioContext?.scenarioId} / ${request.scenarioContext?.scenarioVersion} / ${request.scenarioContext?.scenarioRunId}` }, { label: "报告根", value: request.reportAggregateId }, { label: "报告定义 / 模板", value: `${request.reportDefinitionId} ${request.reportDefinitionVersion} / ${request.templateId} ${request.templateVersion}` }, { label: "证据包 / 版本", value: `${request.evidencePackageId} / ${request.evidencePackageVersion}` }, { label: "语义 / 数据版本", value: `${request.semanticVersion} / ${request.dataVersion}` }, { label: "可消费版本 / 截至", value: `${request.consumableVersionId} / ${request.dataAsOf}` }]
        : [{ label: "场景 / 轮次", value: `${request.scenarioContext?.scenarioId} / ${request.scenarioContext?.scenarioVersion} / ${request.scenarioContext?.scenarioRunId}` }, { label: "报告编号 / 内容版本", value: `${request.reportNumber} / ${request.contentVersion}` }, { label: "证据包 / 版本", value: `${request.evidencePackageId} / ${request.evidencePackageVersion}` }, { label: "语义 / 数据版本", value: `${request.semanticVersion} / ${request.dataVersion}` }, { label: "稳定锚点", value: request.anchor }];
      return <article className="request-card" key={request.id}><div className="request-head"><StatusBadge status={request.status}></StatusBadge><span>{request.source} · {request.receivedAt}</span></div><h2>{request.title}</h2><p>{request.question}</p><KeyValueList compact rows={rows}></KeyValueList>{request.status === "pending" ? <Button icon="play" kind="primary" onClick={() => openRunModal({ agentId: request.agentId, evidenceId: request.evidenceId, requestId: request.id })}>{generationRequest ? "开始生成报告草稿" : verificationRequest ? "开始抽取" : "开始处理"}</Button> : <Notice kind={request.status === "complete" ? "success" : "danger"} title={request.status === "complete" ? "请求已完成" : "当前请求不能处理"}>{request.status === "complete" ? verificationRequest ? "已形成独立 Run 与核验抽取 Result，并回传报告中心等待确定性规则引擎判定。" : generationRequest ? "已形成独立 Run、Result 与源草稿，可从运行记录查看。" : "已形成独立 Run 与伴读 Result，可从运行记录查看。" : `${request.blockedReason || "固定上下文当前不可用"} ${request.recovery || ""}`}</Notice>}</article>;
    })}</div> : <EmptyState icon="inbox" title="当前没有待接收请求" description="报告中心提交报告生成或报告伴读请求后，会在这里形成待接收事项和固定输入。" action={<div className="button-row"><Button icon="file-plus-2" kind="primary" onClick={() => { const candidates = readC022Candidates(); setC022Candidates(candidates); setC022SelectedId(candidates[0]?.requestId || null); setModal({ type: "c022-receive" }); }}>接收生成请求</Button><Button icon="messages-square" onClick={() => { const candidates = readC024Candidates(); setC024Candidates(candidates); setC024SelectedId(candidates[0]?.requestId || null); setModal({ type: "c024-receive" }); }}>接收伴读请求</Button></div>}></EmptyState>;
  }

  function RunTable({ runs }) {
    if (!runs.length) return <EmptyState icon="activity" title="尚无运行记录" description="发起运行后，这里会按真实状态显示等待、处理中、完成、失败、阻断或取消。" action={<Button icon="play" kind="primary" onClick={() => openRunModal()}>发起运行</Button>}></EmptyState>;
    return <div className="data-table-wrap"><table className="data-table"><thead><tr><th>运行标识</th><th>Agent / Release</th><th>来源</th><th>固定输入</th><th>创建 / 完成</th><th>输出与落位</th><th>状态</th><th></th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><strong className="mono">{run.id}</strong><small className="table-sub">{currentProjection(run) ? `第 ${run.attempt} 次` : "历史记录"}</small></td><td>{run.snapshot.agentName}<small className="table-sub">Release {run.snapshot.agentRelease}</small></td><td>{run.source}</td><td>{run.snapshot.evidenceName}<small className="table-sub">{run.snapshot.dataVersion}</small></td><td>{run.createdAt}<small className="table-sub">{run.finishedAt || "尚未结束"}</small></td><td>{displayBusinessTerm(run.result?.type || run.snapshot.outputContract)}<small className="table-sub">{run.result?.destination || "等待结果"}</small></td><td><StatusBadge status={currentProjection(run) ? run.status : "history"} label={currentProjection(run) ? null : "历史"}></StatusBadge></td><td><button className="text-button" onClick={() => navigate("run-detail", run.id)}>查看详情</button></td></tr>)}</tbody></table></div>;
  }

  function RunDetail() {
    const run = model.runs.find((item) => item.id === route.id);
    if (!run) return <NotFound title="运行不存在"></NotFound>;
    const evidence = model.evidencePackages.find((item) => item.id === run.snapshot.evidenceId) || evidenceFromSnapshot(run.snapshot);
    const session = model.sessions.find((item) => item.id === run.sessionId);
    const runHandoffs = (model.handoffs || []).filter((item) => item.runId === run.id && item.resultId === run.result?.id);
    const handoff = runHandoffs[0] || null;
    const credibilityState = runCredibilityState(run);
    const detailPurpose = run.result?.type === "Report Copilot Result" ? "confirmReportAnswer" : run.result?.type === "Report Verification Extraction" ? "reportVerification" : run.result?.type === "Agent Report Draft" ? "reportDraft" : "confirmInsight";
    const detailGate = credibilityGate(credibilityState.current, detailPurpose);
    const historical = !currentProjection(run);
    const canRetry = !historical && ["failed", "cancelled"].includes(run.status) && (!session || session.status === "active");
    return <div className="page" data-screen-label="运行详情"><PageHeader back={() => window.history.back()} eyebrow={`${run.source} · ${run.snapshot.agentName} 版本 ${run.snapshot.agentRelease}`} title={run.id} description={run.question} actions={<><StatusBadge status={historical ? "history" : run.status} label={historical ? "已归档" : null}></StatusBadge>{!historical && ["waiting", "running"].includes(run.status) ? <Button icon="square" kind="danger-soft" onClick={() => cancelFormalRun(run.id)}>取消运行</Button> : null}{canRetry ? <Button icon="rotate-cw" onClick={() => retryFormalRun(run)}>重试原快照</Button> : null}{!historical && run.status === "partial" ? <Button icon="plus" onClick={() => replacePartialRun(run)}>创建替代运行</Button> : null}</>}></PageHeader>{historical ? <Notice kind="info" title="已完成运行只读归档">运行使用的配置、固定依据、工具轨迹、结果和下游回执均按原身份保留；查看不会重新执行或触发业务动作。</Notice> : null}{credibilityState.changed && !run.portfolioRecord ? <Notice kind={detailGate.allowed ? "warning" : "danger"} title={detailGate.allowed ? "数据可信度已变化" : "当前结果已受限"}>原运行内容和固定摘要不改写；后续确认、报告移交与行动使用当前摘要重新判断。</Notice> : null}{session?.status === "stale" ? <Notice kind="warning" title="报告上下文已变化">旧会话与回答保持只读；不能确认、退回或重试，需从报告中心的新上下文请求开始。</Notice> : null}{run.error ? <Notice kind={run.status === "partial" ? "warning" : "danger"} title={run.status === "failed" ? "运行失败" : run.status === "partial" ? "部分完成" : "运行已阻断"}>{run.error}</Notice> : null}{run.recovery ? <Notice kind="warning" title="恢复建议">{run.recovery}</Notice> : null}<Tabs value={runDetailTab} onChange={setRunDetailTab} items={[{ id: "summary", label: "处理步骤" }, { id: "result", label: "生成结果", count: run.result ? 1 : 0 }, { id: "evidence", label: "固定依据", count: evidence?.items?.length || evidence?.itemCount || run.snapshot?.evidenceItemCount || 0 }, { id: "tools", label: "工具轨迹", count: (run.toolCalls || []).length }, { id: "relations", label: "下游落位" }]}></Tabs>{runDetailTab === "summary" ? <RunSummary run={run}></RunSummary> : null}{runDetailTab === "result" ? <RunResult run={run} session={session} handoff={handoff} handoffs={runHandoffs}></RunResult> : null}{runDetailTab === "evidence" ? <RunEvidence run={run} evidence={evidence}></RunEvidence> : null}{runDetailTab === "tools" ? <ToolTrace calls={run.toolCalls || []}></ToolTrace> : null}{runDetailTab === "relations" ? <RunRelations run={run} session={session} handoff={handoff}></RunRelations> : null}</div>;
  }

  function RunSummary({ run }) {
    return <div className="run-layout"><section className="panel"><div className="panel-head"><div><h2>处理步骤</h2><p>按固定运行快照推进</p></div></div><div className="panel-body"><div className="timeline">{(run.steps || []).map((step) => <div className="timeline-step" key={step.id}><span className={`timeline-dot ${step.status}`}><Icon name={step.status === "complete" ? "check" : step.status === "running" ? "loader-circle" : step.status === "blocked" || step.status === "failed" ? "x" : "minus"} size={12} className={step.status === "running" ? "spin" : ""}></Icon></span><div className="timeline-copy"><strong>{step.name}</strong><span>{displayBusinessTerm(step.detail)}</span></div><StatusBadge status={step.status}></StatusBadge></div>)}</div></div></section><section className="panel"><div className="panel-head"><h2>固定输入上下文</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "请求上下文", value: run.snapshot.requestContext ? `${run.snapshot.requestContext.id} · ${run.snapshot.requestContext.version}` : "缺失" }, { label: "发起方 / 请求时间", value: run.snapshot.requestContext ? `${run.snapshot.requestContext.sourceOwner} / ${run.snapshot.requestContext.requestedAt}` : "缺失" }, { label: "场景引用", value: scenarioReferenceLabel(run.snapshot.scenarioId, run.snapshot.scenario) }, { label: "目标对象范围", value: run.snapshot.objectScope }, { label: "Agent Release", value: `${run.snapshot.agentName} · ${run.snapshot.agentRelease}` }, { label: "场景绑定版本", value: run.snapshot.scenarioBinding ? `${run.snapshot.scenarioBinding.id} · ${run.snapshot.scenarioBinding.version}` : "缺失" }, { label: "输入合同", value: run.snapshot.inputContract }, { label: "期望输出", value: run.snapshot.expectedOutput || run.snapshot.outputContract }, { label: "证据包", value: run.snapshot.evidenceName }, { label: "Published 本体", value: run.snapshot.ontology || run.snapshot.ontologyVersion }, { label: "数据版本", value: run.snapshot.dataVersion }, { label: "截至时间", value: run.snapshot.dataAsOf }, { label: "质量", value: run.snapshot.quality }, { label: "新鲜度", value: run.snapshot.freshness }]}></KeyValueList></div></section></div>;
  }

  function RunResult({ run, session, handoff, handoffs = [] }) {
    if (!run.result) return <EmptyState icon={run.status === "cancelled" ? "circle-slash" : "hourglass"} title={run.status === "cancelled" ? "运行已取消" : "尚未形成结果"} description={run.error || "结果将在运行完成并通过输出合同校验后显示。"}></EmptyState>;
    const result = run.result;
    const resultSections = Array.isArray(result.sections) && result.sections.length
      ? result.sections
      : [{ title: "回答摘要", body: result.summary || "本次运行已形成结果，详细结构化内容未随历史恢复点保留。", refs: [] }];
    const isDraftResult = result.type === "Agent Report Draft";
    const isVerificationResult = result.type === "Report Verification Extraction";
    const readOnly = !currentProjection(run) || (session && !currentProjection(session)) || session?.status === "stale" || result.contextStatus === "stale";
    const actionLocked = Boolean(handoff);
    const currentCredibility = runCurrentCredibility(run);
    const changed = credibilityChanged(run, currentCredibility);
    const confirmationGate = credibilityGate(currentCredibility, result.type === "Report Copilot Result" ? "confirmReportAnswer" : isVerificationResult ? "reportVerification" : isDraftResult ? "reportDraft" : "confirmInsight");
    const action = actionRequestEligibility(run, currentCredibility);
    const currentComparison = result.currentComparison;
    const comparisonStale = Boolean(currentComparison && currentComparison.currentSummaryVersion !== currentCredibility?.currentStateSummary?.version);
    const confirmationLabel = isVerificationResult ? "无需人工确认；等待确定性判定" : result.confirmation === "confirmed" ? "已确认可作复核参考" : result.confirmation === "rejected" ? "已退回" : "未确认";
    return (
      <div className="result-layout">
        <section className="panel result-panel">
          <div className="result-header"><div><span>{displayBusinessTerm(result.type)} · {displayBusinessTerm(result.contract || result.resultContract)}</span><h2>{result.title}</h2><p>{displayBusinessTerm(result.summary)}</p></div><div className="result-status-stack"><StatusBadge status={readOnly ? "stale" : isVerificationResult ? "complete" : result.confirmation === "confirmed" ? "confirmed" : result.confirmation === "rejected" ? "rejected" : "pending"} label={readOnly ? "上下文陈旧" : isVerificationResult ? "抽取完成" : result.confirmation === "unconfirmed" ? "未人工确认" : null}></StatusBadge>{changed ? <StatusBadge status={confirmationGate.allowed ? "stale" : "blocked"} label={confirmationGate.allowed ? "数据可信度已变化" : "受限"}></StatusBadge> : null}</div></div>
          <div className="insight-list">{resultSections.map((section) => <article className="insight-item" key={section.title}><div><h3>{displayBusinessTerm(section.title)}</h3><p>{displayBusinessTerm(section.body)}</p></div><div className="citation-chips">{(section.refs || []).map((ref) => <button key={ref} onClick={() => setModal({ type: "evidence-item", snapshot: run.snapshot, ref })}><Icon name="link-2" size={12}></Icon>{ref}</button>)}</div></article>)}</div>
          <div className="result-limits"><strong>限制</strong><p>{displayBusinessTerm(result.limitations)}</p><strong>置信说明</strong><p>{displayBusinessTerm(result.confidence)}</p></div>
          {readOnly ? <Notice kind="warning" title="历史结果只读">固定上下文已经变化，结果与证据继续保留但不能形成新的交接。</Notice> : isDraftResult ? <Notice kind="success" title="源草稿已形成">报告中心只能按当前运行、结果与源草稿标识重新读取，并创建自己的复核副本；Agent 不维护复核、核验或发布状态。</Notice> : isVerificationResult ? <Notice kind="info" title="等待确定性规则引擎判定">本结果只包含报告声明、稳定锚点和固定证据比对请求。通过、失败、容差和最终核验记录由报告中心规则引擎形成，Agent 应用不提供确认或退回控件。</Notice> : run.status === "partial" ? <Notice kind="warning" title="部分结果仅供核对">只保留已验证范围和证据引用；不能确认、退回或发起后续申请。修复受限工具后创建替代运行。</Notice> : <div className="result-actions"><Button icon="check" kind="primary" disabled={actionLocked || result.confirmation === "confirmed" || !confirmationGate.allowed} title={!confirmationGate.allowed ? confirmationGate.reason : null} onClick={() => setResultConfirmation(run.id, "confirmed")}>确认可作参考</Button><Button icon="undo-2" disabled={actionLocked || result.confirmation === "rejected"} onClick={() => setResultConfirmation(run.id, "rejected")}>退回结果</Button>{result.type === "AI Insight" && result.confirmation === "confirmed" && !handoff ? <Button icon="send" disabled={!action.allowed} title={!action.allowed ? `${action.reason || "当前不能发起行动申请。"} ${action.recovery || ""}`.trim() : null} onClick={() => openActionRequest(run)}>发起行动申请</Button> : null}{handoff ? <Button icon="receipt-text" onClick={() => setModal({ type: "handoff", handoffId: handoff.id })}>查看移交回执</Button> : null}</div>}
        </section>
        <aside className="stack">
          <CredibilitySummary credibility={currentCredibility} title="操作时可信度"></CredibilitySummary>
          {currentProjection(run) ? <Button icon="refresh-cw" onClick={() => refreshCredibility(run.snapshot.evidenceId)}>重新读取当前状态</Button> : null}
          <section className="panel"><div className="panel-head"><h2>结果信息</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "Result 标识", value: <span className="mono">{result.id}</span> }, { label: "结果 Owner", value: result.owner }, { label: "后续落位", value: result.destination }, { label: "生成时间", value: result.generatedAt }, { label: "运行时新鲜度", value: result.freshness }, { label: "当前可信度", value: changed ? (confirmationGate.allowed ? "已变化，仍允许受限使用" : "已变化，当前受限") : "与运行时摘要一致" }, { label: "确认状态", value: readOnly ? `上下文陈旧（原状态：${confirmationLabel}）` : confirmationLabel }, ...(currentComparison ? [{ label: "当前比较", value: comparisonStale ? "比较已陈旧" : currentComparison.label }, { label: "比较 Owner", value: currentComparison.owner }, { label: "比较记录", value: currentComparison.id }, { label: "绑定摘要", value: `${currentComparison.currentSummaryId} · ${currentComparison.currentSummaryVersion}` }, { label: "比较时间", value: currentComparison.comparedAt }] : []), ...(readOnly ? [{ label: "陈旧时间", value: result.staleAt || session?.staleAt }, { label: "陈旧原因", value: result.staleReason || session?.staleReason }] : [])]}></KeyValueList>{comparisonStale ? <Notice kind="warning" title="当前比较记录已陈旧">C017 当前状态摘要已变化；保留报告中心原比较记录，不由 Agent 重新计算。需要新比较时由报告中心提供新记录。</Notice> : null}</div></section>
          {isDraftResult ? <Notice kind="info" title="报告草稿边界">源草稿归 Agent 应用；报告中心读取后形成独立复核副本，并独立负责核验、确认与正式发布。</Notice> : isVerificationResult ? <Notice kind="info" title="职责分离">Agent 应用拥有抽取 Run 与 Result；报告中心读取这些引用后执行确定性比较，并唯一维护正式核验状态。</Notice> : handoff ? <Notice kind={handoff.status === "received" ? "success" : "info"} title={handoff.status === "received" ? "行动申请已移交" : "行动申请等待决策中心接收"}>来源结果状态已锁定；C011 已提交，但只有读取到 C019 回执后才显示“已接收”。Agent 应用不维护后续确认、提醒或待办。</Notice> : run.status === "partial" ? <Notice kind="warning" title="仅保留已验证范围">部分结果不能发起行动申请；修复受限工具后创建新运行。</Notice> : result.type === "Report Copilot Result" ? <Notice kind="info" title="报告中心引用边界">报告中心只保存运行与结果标识并回读权威状态；不维护运行状态副本，不自动修改或发布报告。</Notice> : !confirmationGate.allowed ? <Notice kind="danger" title="当前结果受限">{confirmationGate.reason} {confirmationGate.recovery}</Notice> : !action.allowed ? <Notice kind="warning" title="行动申请受限">{action.reason}</Notice> : <Notice kind="info" title="AI 洞察落位">结果保留在 Agent 应用，不自动进入报告中心；行动只能通过标准申请移交决策中心。</Notice>}
        </aside>
      </div>
    );
  }

  function RunEvidence({ run, evidence }) {
    const currentCredibility = runCurrentCredibility(run);
    const evidenceItems = evidence?.items || [];
    return <div className="stack"><div className="evidence-layout"><section className="panel"><div className="panel-head"><div><h2>固定证据项</h2><p>每项生成内容只回指本次包内证据</p></div><Button icon="external-link" onClick={() => setDrawer({ type: "run-evidence-snapshot", run })}>查看固定包快照</Button></div><div className="panel-body">{evidenceItems.length ? <div className="evidence-list">{evidenceItems.map((item) => <div className="evidence-row" key={item.id}><span className="evidence-type">{displayBusinessTerm(item.type)}</span><div><strong>{displayBusinessTerm(item.name)}</strong><small>{displayBusinessTerm(item.object)} · {displayBusinessTerm(item.source)}</small></div><b>{displayBusinessTerm(item.value)}</b><button className="text-button" onClick={() => setModal({ type: "evidence-item", snapshot: run.snapshot, ref: item.id })}>查看详情</button></div>)}</div> : <EmptyState icon="package-search" title="固定证据明细暂不可定位" description="运行标识、版本与证据包引用继续保留；请从报告中心固定上下文重新读取。"></EmptyState>}</div></section><section className="panel"><div className="panel-head"><h2>运行时版本</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "证据包", value: evidence?.name }, { label: "已发布语义", value: displayBusinessTerm(evidence?.ontologyVersion) }, { label: "数据版本", value: evidence?.dataVersion }, { label: "数据截至时间", value: evidence?.dataAsOf }, { label: "质量", value: evidence?.quality }, { label: "新鲜度", value: evidence?.freshness }, { label: "权威关系", value: evidence?.authority }, { label: "形成时间", value: evidence?.formedAt }]}></KeyValueList></div></section></div><section className="panel"><div className="panel-head"><div><h2>C017 可信度上下文</h2><p>{currentProjection(run) ? "左侧为运行固定摘要，右侧为操作时重新读取的当前摘要" : "历史运行只展示当时固定摘要，不重新读取或改写当前状态"}</p></div>{currentProjection(run) ? <Button icon="refresh-cw" onClick={() => refreshCredibility(run.snapshot.evidenceId)}>重新读取状态</Button> : null}</div><div className="panel-body credibility-pair"><CredibilitySummary credibility={run.snapshot.credibility} title="运行固定摘要"></CredibilitySummary><CredibilitySummary credibility={currentCredibility} title={currentProjection(run) ? "当前状态摘要" : "历史固定摘要"}></CredibilitySummary></div></section><HistoryDimensions dimensions={run.snapshot.credibility?.historyDimensions} title="运行时历史五维状态"></HistoryDimensions><HistoryDimensions dimensions={currentCredibility?.historyDimensions} title={currentProjection(run) ? "当前历史五维状态" : "历史固定五维状态"}></HistoryDimensions></div>;
  }

  function ToolTrace({ calls }) {
    return <section className="panel"><div className="panel-head"><div><h2>工具调用轨迹</h2><p>输入摘要、输出摘要、状态和耗时均随运行保留</p></div></div><div className="panel-body">{calls.length ? <div className="tool-trace-list">{calls.map((call) => { const tool = getTool(call.toolId); return <article className="tool-trace-card" key={call.id}><div className="tool-trace-head"><span className="resource-icon"><Icon name={tool?.category.includes("内部") ? "shield-check" : "plug"}></Icon></span><div><strong>{displayBusinessTerm(call.toolName || call.toolId)}</strong><small>{call.toolVersion} · {displayBusinessTerm(call.toolOwner)}</small></div><StatusBadge status={call.status}></StatusBadge>{call.duration ? <em>{call.duration}</em> : null}<button className="text-button" onClick={() => navigateResource("tool", call.toolId, call.toolVersion)}>查看详情</button></div><div className="trace-io"><div><span>输入摘要</span><p>{displayBusinessTerm(call.input)}</p></div><Icon name="arrow-right" size={14}></Icon><div><span>输出摘要</span><p>{displayBusinessTerm(call.output || "尚无输出")}</p></div></div></article>; })}</div> : <EmptyState icon="shield-check" title="本次未调用外部工具" description="结果仅解释报告中心提供的固定证据与确定性核验信息。"></EmptyState>}</div></section>;
  }

  function RunRelations({ run, session, handoff }) {
    run = { ...run, snapshot: { ...run.snapshot, ontology: run.snapshot.ontology || run.snapshot.ontologyVersion || "缺失" } };
    const toolBindings = run.snapshot.toolBindings || (run.snapshot.tools || []).map((id) => ({ id, name: id, version: "快照未记录" }));
    const promptBinding = run.snapshot.promptBinding || { ...run.snapshot.prompt, name: run.snapshot.prompt?.id || "快照未记录" };
    const skillBindings = run.snapshot.skillBindings || (run.snapshot.skills || []).map((binding) => ({ ...binding, name: binding.id }));
    return <div className="detail-grid"><section className="panel"><div className="panel-head"><h2>版本追溯</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "请求上下文", value: run.snapshot.requestContext ? `${run.snapshot.requestContext.id} · ${run.snapshot.requestContext.version}` : "缺失" }, { label: "场景身份", value: `${run.snapshot.scenarioId || "缺失"} / ${run.snapshot.scenarioVersion || "缺失"} / ${run.snapshot.scenarioRunId || "缺失"}` }, { label: "报告编号 / 内容版本", value: run.snapshot.reportNumber ? `${run.snapshot.reportNumber} / ${run.snapshot.contentVersion}` : "不适用" }, { label: "证据包 / 版本", value: `${run.snapshot.evidencePackageId || run.snapshot.evidenceId} / ${run.snapshot.evidencePackageVersion || "缺失"}` }, { label: "语义标识 / 版本", value: `${run.snapshot.semanticVersionId || "缺失"} / ${run.snapshot.ontologyVersion || "缺失"}` }, { label: "数据资产标识 / 版本", value: `${run.snapshot.dataAssetVersionId || "缺失"} / ${run.snapshot.dataVersion || "缺失"}` }, { label: "场景绑定版本", value: run.snapshot.scenarioBinding ? `${run.snapshot.scenarioBinding.id} · ${run.snapshot.scenarioBinding.version}` : "缺失" }, { label: "目标对象范围", value: run.snapshot.objectScope }, { label: "期望输出合同", value: run.snapshot.expectedOutput || run.snapshot.outputContract }, { label: "Agent Release", value: `${run.snapshot.agentName} · ${run.snapshot.agentRelease}` }, { label: "Prompt", value: `${promptBinding.name} · ${promptBinding.version}` }, { label: "Skill", value: skillBindings.map((binding) => `${binding.name || binding.id} ${binding.version}`).join("；") }, { label: "工具", value: toolBindings.map((binding) => `${binding.name || binding.id} ${binding.version || "快照未记录"}`).join("；") }, { label: "本体绑定", value: run.snapshot.ontology }, { label: "重试来源", value: run.retryOf || "无" }, { label: "替代运行", value: run.replacesRun || "无" }, { label: "编排 Run", value: run.orchestrationRunId || "未关联" }, { label: "Step Run", value: run.stepRunId || "未关联" }]}></KeyValueList></div></section><div className="stack">{session ? <><CredibilitySummary credibility={runCurrentCredibility(run)} title="报告伴读当前可信度"></CredibilitySummary><section className="panel"><div className="panel-head"><div><h2>报告伴读会话</h2><p>Agent 应用权威状态</p></div><StatusBadge status={currentProjection(session) ? session.status : "history"} label={currentProjection(session) && session.status === "active" ? "活跃" : !currentProjection(session) ? "历史" : null}></StatusBadge></div><div className="panel-body"><KeyValueList rows={[{ label: "Session", value: <span className="mono">{session.id}</span> }, { label: "Context Binding", value: <span className="mono">{session.bindingId}</span> }, { label: "场景身份", value: `${session.scenarioId} / ${session.scenarioVersion} / ${session.scenarioRunId}` }, { label: "请求上下文", value: session.requestContext ? `${session.requestContext.id} · ${session.requestContext.version}` : "缺失" }, { label: "报告编号 / 内容版本", value: `${session.reportNumber} / ${session.contentVersion}` }, { label: "证据包 / 版本", value: `${session.evidencePackageId} / ${session.evidencePackageVersion}` }, { label: "语义标识 / 版本", value: `${session.semanticVersionId} / ${session.ontologyVersion}` }, { label: "数据标识 / 版本", value: `${session.dataAssetVersionId} / ${session.dataVersion}` }, { label: "稳定锚点", value: session.anchor }]}></KeyValueList>{currentProjection(session) && session.status === "active" ? <Button icon="inbox" onClick={() => { const candidates = readC024Candidates(); setC024Candidates(candidates); setC024SelectedId(candidates[0]?.requestId || null); setModal({ type: "c024-receive" }); }}>读取报告交接</Button> : <Notice kind="warning" title="旧会话只读">{session.staleReason || session.archivedReason}</Notice>}</div></section><section className="panel"><div className="panel-head"><div><h2>报告运行关联</h2><p>外部状态只读引用</p></div></div><div className="panel-body"><KeyValueList rows={[{ label: "确定性核验结果", value: session.verificationSummary }, { label: "核验运行标识", value: session.verificationRunRef || "报告中心未提供" }, { label: "当前比较记录", value: session.currentComparisonRef || "报告中心尚未提供" }, { label: "当前问答 Run", value: <span className="mono">{session.latestRunId}</span> }, { label: "本次问答 Run", value: <span className="mono">{run.id}</span> }, { label: "最新 Result", value: session.latestResultId ? <span className="mono">{session.latestResultId}</span> : "尚未形成" }, { label: "结果返回", value: session.resultReturnStatus || "等待运行结果" }, { label: "返回时间", value: session.resultReturnedAt || "尚未返回" }, { label: "重新生成状态", value: `${session.regenerationStatus}（入口在报告中心）` }, { label: "重新生成引用", value: session.regenerationRef || "尚无外部引用" }]}></KeyValueList></div></section></> : null}{handoff ? <section className="panel"><div className="panel-head"><h2>Action 移交</h2><StatusBadge status={handoff.status}></StatusBadge></div><div className="panel-body"><KeyValueList rows={[{ label: "请求标识", value: <span className="mono">{handoff.id}</span> }, { label: "Action Type", value: `${handoff.actionType} · ${handoff.actionTypeVersion}` }, { label: "接收结果", value: handoff.status === "received" ? "决策中心已接收" : "等待决策中心接收" }, { label: "后续状态", value: "由决策中心维护，Agent 应用不复制" }]}></KeyValueList></div></section> : null}<Notice kind="info" title="历史快照不变">新 Agent Release、Prompt、Skill、工具或证据版本不会静默改写本次运行。</Notice></div></div>;
  }

  function EvidenceWorkspace() {
    const packages = model.evidencePackages.filter((item) => item.portfolioRecord && item.status === "ready");
    const results = model.runs.filter((run) => run.portfolioRecord && run.status === "complete" && run.result);
    const sessions = model.sessions.filter((item) => item.portfolioRecord);
    const handoffs = model.handoffs.filter((item) => item.portfolioRecord || currentProjection(item));
    return <div className="page" data-screen-label="证据与结果">
      <PageHeader title="证据与结果" description="集中查看 Agent 运行固定的输入依据、生成结果、报告伴读会话、工具轨迹和下游接收结果。"></PageHeader>
      <section className="evidence-purpose-strip" aria-label="Agent 运行证据链">
        <div className="evidence-purpose-head"><strong>一次 Agent 运行如何被复核</strong><p>四类记录共同回答“用了什么、生成了什么、怎样生成、交给了谁”；它们保存引用和过程，不复制上游业务真值。</p></div>
        <div className="evidence-purpose-flow">
          <div><span><Icon name="package-check" size={17}></Icon></span><strong>固定依据</strong><p>运行开始时锁定场景、对象、数据、本体、报告版本和证据引用，证明答案基于哪一组事实。</p></div>
          <Icon className="purpose-arrow" name="chevron-right" size={16}></Icon>
          <div><span><Icon name="sparkles" size={17}></Icon></span><strong>Agent 结果</strong><p>保存结构化结论、限制与证据引用；它是 Agent 产出，不自动成为报告、决策或业务事实。</p></div>
          <Icon className="purpose-arrow" name="chevron-right" size={16}></Icon>
          <div><span><Icon name="wrench" size={17}></Icon></span><strong>工具轨迹</strong><p>记录实际调用的工具版本、输入输出摘要、状态与耗时，用于核对执行过程和定位失败。</p></div>
          <Icon className="purpose-arrow" name="chevron-right" size={16}></Icon>
          <div><span><Icon name="send" size={17}></Icon></span><strong>下游回执</strong><p>证明结果已被报告中心或决策中心按原标识接收；回执不代表报告已发布或行动已完成。</p></div>
        </div>
      </section>
      <Tabs value={evidenceTab} onChange={setEvidenceTab} items={[{ id: "packages", label: "固定依据", count: packages.length }, { id: "results", label: "Agent 结果", count: results.length }, { id: "sessions", label: "伴读会话", count: sessions.length }, { id: "handoffs", label: "下游回执", count: handoffs.length }]}></Tabs>
      {evidenceTab === "packages" ? (packages.length ? <div className="resource-directory">{packages.map((evidence) => <div className="resource-directory-row" key={evidence.id}><span className="resource-icon"><Icon name="package-check"></Icon></span><div><strong>{evidence.name}</strong><small>{displayBusinessTerm(evidence.ontologyVersion)} · {evidence.dataVersion} · 截至 {evidence.dataAsOf}</small></div><span>{evidence.quality}</span><StatusBadge status="complete" label="已固定"></StatusBadge><button className="text-button" onClick={() => navigate("evidence-detail", evidence.id)}>查看详情</button></div>)}</div> : <EmptyState icon="package-check" title="尚无固定依据" description="Agent 运行固定输入后会在此保留只读引用。"></EmptyState>) : null}
      {evidenceTab === "results" ? (results.length ? <div className="resource-directory">{results.map((run) => <div className="resource-directory-row" key={run.result.id}><span className="resource-icon"><Icon name="sparkles"></Icon></span><div><strong>{run.result.title}</strong><small>{run.snapshot.scenarioId} · {run.snapshot.agentName} 版本 {run.snapshot.agentRelease}</small><small>{run.toolCalls?.length || 0} 次工具调用 · {run.result.returnReceipt || run.result.destination}</small></div><span>{displayBusinessTerm(run.result.type)}</span><StatusBadge status="complete" label="已完成"></StatusBadge><button className="text-button" onClick={() => navigate("run-detail", run.id)}>查看详情</button></div>)}</div> : <EmptyState icon="sparkles" title="尚无 Agent 结果" description="运行完成且结果与引用核对通过后会进入此目录。"></EmptyState>) : null}
      {evidenceTab === "sessions" ? (sessions.length ? <div className="resource-directory">{sessions.map((session) => <div className="resource-directory-row" key={session.id}><span className="resource-icon"><Icon name="messages-square"></Icon></span><div><strong>{session.reportVersion}</strong><small>{session.id} · {session.anchor}</small></div><span>{session.bindingId}</span><StatusBadge status={session.status} label={session.status === "active" ? "活跃" : null}></StatusBadge><button className="text-button" onClick={() => navigate("run-detail", session.latestRunId)}>查看详情</button></div>)}</div> : <EmptyState icon="messages-square" title="尚无当前报告伴读会话" description="处理报告中心请求后，会话与正式上下文绑定才会形成；历史会话不回填当前目录。"></EmptyState>) : null}
      {evidenceTab === "handoffs" ? (handoffs.length ? <div className="resource-directory">{handoffs.map((handoff) => <div className="resource-directory-row" key={handoff.id}><span className="resource-icon"><Icon name="send"></Icon></span><div><strong>{handoff.actionType}</strong><small>{handoff.runId} · {handoff.resultId}</small></div><span>{handoff.target}</span><StatusBadge status={handoff.status}></StatusBadge><button className="text-button" onClick={() => setModal({ type: "handoff", handoffId: handoff.id })}>查看详情</button></div>)}</div> : <EmptyState icon="send" title="尚无下游回执" description="结果被报告中心或决策中心接收后，会按原运行和结果标识保留回执。"></EmptyState>) : null}
    </div>;
  }

  function EvidenceDetail() {
    const evidence = model.evidencePackages.find((item) => item.id === route.id);
    if (!evidence) return <NotFound title="证据包不存在"></NotFound>;
    const linkedRuns = model.runs.filter((run) => run.snapshot.evidenceId === evidence.id);
    const evidencePurpose = evidence.kind === "report" ? "reportQuestion" : evidence.kind === "report-verification" ? "reportVerification" : "newInsight";
    const evidenceGate = credibilityGate(evidence.credibility, evidencePurpose);
    const rollbackSnapshot = externalCredibilityFeedFor(evidence)?.timeline?.find((item) => item.summaryVersion === evidence.credibility?.currentStateSummary?.version && item.adoptedCombination);
    const rollbackReady = evidence.credibility?.contextStatus === "ontology-rollback"
      && Boolean(rollbackSnapshot)
      && evidence.credibility?.ontologyAdoption?.status === "ready"
      && evidence.credibility?.consumptionReadiness?.status === "ready";
    return <div className="page" data-screen-label="证据包详情"><PageHeader back={() => window.history.back()} eyebrow={evidence.kind === "report" ? "报告固定依据" : "运行固定依据"} title={evidence.name} description={`${evidence.dataVersion} · 截至 ${evidence.dataAsOf}`} actions={<>{!evidence.portfolioRecord ? <Button icon="refresh-cw" onClick={() => refreshCredibility(evidence.id)}>重新读取状态</Button> : null}{rollbackReady ? <Button icon="play" kind="primary" onClick={() => createRunFromAdoptedRollback(evidence.id)}>创建后续新运行</Button> : null}<StatusBadge status="complete" label="已固定"></StatusBadge></>}></PageHeader>{evidence.portfolioRecord ? <Notice kind="info" title="运行固定依据">以下数据、本体、报告和核验引用属于已完成运行；不会随当前数据变化，也不会在此复制正式业务明细。</Notice> : rollbackReady ? <Notice kind="info" title="受控回退只影响后续运行">上游已明确提供并采用固定组合。创建操作会形成新证据包和新 Agent Run，不改变任何旧运行或结果。</Notice> : evidenceGate.allowed ? null : <Notice kind="danger" title="当前不可用于新的正式输出">{evidenceGate.reason} {evidenceGate.recovery}</Notice>}<section className="panel credibility-control-panel"><div className="panel-head"><div><h2>版本与质量摘要</h2><p>只读保存本次运行实际使用的版本、时点和质量结论</p></div><StatusBadge status="complete" label="已核对"></StatusBadge></div><div className="panel-body"><CredibilitySummary credibility={evidence.credibility} title="运行固定摘要"></CredibilitySummary>{!evidence.portfolioRecord ? <AgentUseGate gates={evidence.credibility?.agentGates}></AgentUseGate> : null}</div></section><div className="evidence-layout"><section className="panel"><div className="panel-head"><div><h2>依据目录</h2><p>{evidence.items.length} 项固定引用</p></div></div><div className="panel-body"><div className="evidence-list">{evidence.items.map((item) => <div className="evidence-row" key={item.id}><span className="evidence-type">{displayBusinessTerm(item.type)}</span><div><strong>{displayBusinessTerm(item.name)}</strong><small>{displayBusinessTerm(item.object)} · {displayBusinessTerm(item.source)}</small></div><b>{displayBusinessTerm(item.value)}</b><button className="text-button" onClick={() => setModal({ type: "evidence-item", evidenceId: evidence.id, ref: item.id })}>查看详情</button></div>)}</div></div></section><div className="stack">{evidence.report ? <section className="panel"><div className="panel-head"><h2>报告上下文</h2></div><div className="panel-body"><KeyValueList rows={[{ label: "报告", value: evidence.report.name }, { label: "内容版本", value: evidence.report.contentVersion }, { label: "稳定锚点", value: evidence.report.anchor }, { label: "确定性核验", value: evidence.report.verification }]}></KeyValueList></div></section> : null}<section className="panel"><div className="panel-head"><h2>关联运行</h2></div><div className="panel-body">{linkedRuns.length ? linkedRuns.map((run) => <ResourceRow key={run.id} icon="activity" title={run.id} subtitle={`${run.snapshot.agentName} · ${run.createdAt}`} status={run.status} onOpen={() => navigate("run-detail", run.id)}></ResourceRow>) : <p className="muted-copy">尚无运行引用该固定依据。</p>}</div></section></div></div><HistoryDimensions dimensions={evidence.credibility?.historyDimensions}></HistoryDimensions></div>;
  }

  function OrchestrationDirectory() {
    return <div className="page" data-screen-label="协作编排"><PageHeader title={window.AGENT_WORKSPACE_CONFIG.variant === "orchestration" ? "协作工作台" : "协作编排"} description="从受控模板开始，精确引用 Agent Release；当前没有兼容团队时只保留草稿和阻断记录。" actions={<Button icon="plus" kind="primary" onClick={() => setModal({ type: "orchestration" })}>创建编排</Button>}></PageHeader>{!model.orchestrations.length ? <div className="orchestration-empty"><div className="template-strip"><button onClick={() => { setOrchestrationForm({ ...orchestrationForm, template: "sequence" }); setModal({ type: "orchestration" }); }}><Icon name="arrow-right"></Icon><strong>顺序协作</strong><span>按固定输出合同逐步传递</span></button><button onClick={() => { setOrchestrationForm({ ...orchestrationForm, template: "parallel" }); setModal({ type: "orchestration" }); }}><Icon name="git-fork"></Icon><strong>并行协作</strong><span>共享固定上下文后指定汇总</span></button><button onClick={() => { setOrchestrationForm({ ...orchestrationForm, template: "branch" }); setModal({ type: "orchestration" }); }}><Icon name="split"></Icon><strong>确定性分流</strong><span>只依据结构化状态或枚举</span></button></div><EmptyState icon="workflow" title="尚无编排草稿" description="当前两个可用 Agent 的输入输出合同不兼容；可创建草稿验证真实阻断，但不能发布生产编排。" action={<Button icon="plus" kind="primary" onClick={() => setModal({ type: "orchestration" })}>创建编排</Button>}></EmptyState></div> : <div className="orchestration-grid">{model.orchestrations.map((item) => <article className="orchestration-card" key={item.id}><div className="orchestration-card-head"><span className="resource-icon"><Icon name="workflow"></Icon></span><div><strong>{item.name}</strong><small>{item.template === "sequence" ? "顺序协作" : item.template === "parallel" ? "并行协作" : "确定性分流"}</small></div><StatusBadge status={item.validation?.status || item.status}></StatusBadge></div><p>{item.purpose}</p><div className="card-meta"><div><span>Agent 步骤</span><strong>{item.nodes.filter((node) => node.type === "agent").length}</strong></div><div><span>连接</span><strong>{item.connections.length}</strong></div><div><span>当前 Release</span><strong>{item.release || "未发布"}</strong></div></div><div className="card-foot"><span>{item.trace ? `${item.trace.id} · ${item.trace.status}` : "尚未检查运行路径"}</span><button className="text-button" onClick={() => navigate("orchestration-editor", item.id)}>查看详情</button></div></article>)}</div>}</div>;
  }

  function OrchestrationEditor() {
    const orchestration = model.orchestrations.find((item) => item.id === route.id);
    if (!orchestration) return <NotFound title="编排不存在"></NotFound>;
    const selected = orchestration.nodes.find((node) => node.id === selectedNode) || orchestration.nodes[0];
    const releaseLibrary = model.agents.filter((agent) => agent.status === "enabled").map((agent) => ({ agent, release: getAgentRelease(agent) }));
    const orderedNodes = orderOrchestrationNodes(orchestration.nodes, orchestration.connections);
    const activeRelease = orchestration.releases?.find((item) => item.version === orchestration.release);
    return <div className="page orchestration-page" data-screen-label="协作编排编辑"><PageHeader back={() => window.history.back()} eyebrow={`${orchestration.template === "sequence" ? "顺序协作" : orchestration.template === "parallel" ? "并行协作" : "确定性分流"} · ${orchestration.release ? `Release ${orchestration.release}` : "草稿"}`} title={orchestration.name} description={orchestration.purpose} actions={<><Button icon="save" onClick={() => { updateOrchestration(orchestration.id, (item) => ({ ...item, updatedAt: nowText() })); toast("草稿已保存", "节点、连接、收窄权限和证据范围已保存。", "success"); }}>保存草稿</Button><Button icon="shield-check" onClick={() => validateOrchestration(orchestration)}>验证</Button>{orchestration.validation?.status === "validated" && !activeRelease ? <Button icon="package-check" kind="primary" onClick={() => publishOrchestrationRelease(orchestration)}>启用 Release</Button> : null}<Button icon="play" kind={activeRelease ? "primary" : ""} disabled={orchestration.trace && ["waiting", "running"].includes(orchestration.trace.status)} onClick={() => startOrchestrationTrace(orchestration)}>{activeRelease ? "运行固定 Release" : "试运行草稿"}</Button></>}></PageHeader>{orchestration.validation ? <Notice kind={orchestration.validation.status === "validated" ? "success" : "danger"} title={orchestration.validation.status === "validated" ? "编排验证通过" : "当前不能发布编排 Release"}>{orchestration.validation.errors.length ? orchestration.validation.errors.join("；") : "全部 Agent Release、连接、权限、证据与失败路径已固定。"}</Notice> : <Notice kind="info" title="受约束协作">编排只能进一步收窄 Agent Release 的工具和证据范围；当前资源不兼容时保持草稿和阻断，不创建生产编排。</Notice>}<div className="orchestration-workbench"><aside className="orchestration-library"><div className="editor-head"><div><strong>可用 Agent</strong><small>加入后固定当前 Release</small></div></div><div className="editor-body">{releaseLibrary.map(({ agent, release }) => <div className="library-agent" key={agent.id} draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-agent-release", JSON.stringify({ agentId: agent.id, release: release.version })); event.dataTransfer.effectAllowed = "copy"; }}><span className="resource-icon"><Icon name={agent.type === "报告伴读 Agent" ? "book-open-check" : "sparkles"}></Icon></span><div><strong>{agent.shortName}</strong><small>固定 Release {release.version}</small><em>输入：{release.inputContract}</em><em>输出：{release.outputContract}</em></div><button className="mini-button" onClick={() => addAgentNode(orchestration, agent, release)} title="加入步骤"><Icon name="plus" size={14}></Icon></button></div>)}<div className="library-divider">受控节点</div><div className="control-node-buttons"><Button icon="split" onClick={() => addControlNode(orchestration, "condition")}>确定性分流</Button><Button icon="pause" onClick={() => addControlNode(orchestration, "pause")}>人工暂停</Button><Button icon="git-merge" onClick={() => addControlNode(orchestration, "collector")}>指定汇总</Button><Button icon="octagon-x" onClick={() => addControlNode(orchestration, "failure")}>失败结束</Button><Button icon="circle-dot-dashed" onClick={() => addControlNode(orchestration, "partial")}>部分结果结束</Button></div></div></aside><section className="canvas-column"><div className="canvas-toolbar"><div><strong>流程图</strong><span>{connectionSource ? "已选择来源，请点击目标输入端口" : "结构化步骤与连接同步展示"}</span></div>{connectionSource ? <Button icon="x" onClick={() => setConnectionSource(null)}>取消连接</Button> : null}</div><div className="canvas-stage" ref={canvasRef} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); const agentData = event.dataTransfer.getData("application/x-agent-release"); const nodeId = event.dataTransfer.getData("application/x-canvas-node"); if (agentData) { const data = JSON.parse(agentData); const agent = model.agents.find((item) => item.id === data.agentId); const release = getAgentRelease(agent, data.release); addAgentNode(orchestration, agent, release, { x: event.clientX - rect.left - 70, y: event.clientY - rect.top - 34 }); } else if (nodeId) { moveCanvasNode(orchestration, nodeId, event.clientX - rect.left - 70, event.clientY - rect.top - 34); } }}><svg className="edge-layer" aria-hidden="true">{orchestration.connections.map((connection) => { const source = orchestration.nodes.find((node) => node.id === connection.source); const target = orchestration.nodes.find((node) => node.id === connection.target); if (!source || !target) return null; const x1 = source.x + 152; const y1 = source.y + 39; const x2 = target.x; const y2 = target.y + 39; const middle = (x1 + x2) / 2; return <path key={connection.id} d={`M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`} />; })}</svg>{orchestration.nodes.map((node) => <div key={node.id} className={`canvas-node node-${node.type} ${selected?.id === node.id ? "selected" : ""} ${orchestration.trace?.stepRuns.find((step) => step.nodeId === node.id)?.status || ""}`} style={{ left: node.x, top: node.y }} draggable={!(["input", "result"].includes(node.type))} onDragStart={(event) => { event.dataTransfer.setData("application/x-canvas-node", node.id); event.dataTransfer.effectAllowed = "move"; }} onClick={() => setSelectedNode(node.id)}><button className="node-port input-port" onClick={(event) => { event.stopPropagation(); attemptConnection(orchestration, node.id); }} title="连接到此输入"></button><div className="canvas-node-head"><Icon name={node.type === "agent" ? "bot" : node.type === "input" ? "log-in" : node.type === "result" ? "flag" : node.type === "condition" ? "split" : node.type === "pause" ? "pause" : node.type === "collector" ? "git-merge" : node.type === "partial" ? "circle-dot-dashed" : "octagon-x"}></Icon><span>{node.type === "agent" ? "Agent Release" : node.type === "input" ? "输入" : node.type === "result" ? "最终结果" : "受控节点"}</span>{orchestration.trace ? <StatusBadge status={orchestration.trace.stepRuns.find((step) => step.nodeId === node.id)?.status || "waiting"}></StatusBadge> : null}</div><strong>{node.name}</strong><small>{node.type === "agent" ? `Release ${node.agentRelease}` : node.outputContract || node.inputContract}</small>{!(["input", "result"].includes(node.type)) ? <button className="node-delete" onClick={(event) => { event.stopPropagation(); removeCanvasNode(orchestration, node.id); }} title="删除节点"><Icon name="x" size={12}></Icon></button> : null}{node.type !== "result" ? <button className={`node-port output-port ${connectionSource === node.id ? "active" : ""}`} onClick={(event) => { event.stopPropagation(); setConnectionSource(node.id); }} title="从此输出连接"></button> : null}</div>)}</div><div className="steps-panel"><div className="steps-panel-head"><strong>结构化步骤</strong><span>权威编辑区</span></div><div className="structured-steps">{orderedNodes.map((node, index) => <button key={node.id} className={selected?.id === node.id ? "active" : ""} onClick={() => setSelectedNode(node.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{node.name}</strong><small>{node.type === "agent" ? `Release ${node.agentRelease}` : node.type}</small></div><em>{node.outputContract || "结束"}</em></button>)}</div></div>{orchestration.trace ? <TracePanel orchestration={orchestration}></TracePanel> : null}</section><aside className="node-inspector"><div className="editor-head"><div><strong>步骤详情</strong><small>输入、输出与收窄权限</small></div></div><div className="editor-body">{selected ? <NodeInspector orchestration={orchestration} node={selected}></NodeInspector> : <EmptyState icon="mouse-pointer-2" title="选择一个节点" description="选择后查看精确版本与步骤合同。"></EmptyState>}</div></aside></div></div>;
  }

  function NodeInspector({ orchestration, node }) {
    if (node.type !== "agent") {
      const evidence = model.evidencePackages.find((item) => item.id === orchestration.inputEvidenceId);
      const typeLabel = node.type === "input" ? "已确认输入" : node.type === "result" ? "既有最终结果合同" : node.type === "condition" ? "确定性条件分流" : node.type === "pause" ? "人工暂停" : node.type === "collector" ? "指定汇总" : node.type === "partial" ? "部分结果结束" : "失败结束";
      return <><KeyValueList rows={[{ label: "步骤类型", value: typeLabel }, { label: "输入合同", value: node.inputContract || "不适用" }, { label: "输出合同", value: node.outputContract || "结束" }, { label: "证据范围", value: "不扩大编排固定输入" }]}></KeyValueList>{node.type === "input" ? <div className="form-field inspector-field"><label>固定证据包</label><select value={orchestration.inputEvidenceId || ""} onChange={(event) => updateOrchestration(orchestration.id, (item) => applyOrchestrationDraftChange(item, { inputEvidenceId: event.target.value || null }))}><option value="">请选择固定输入</option>{model.evidencePackages.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.statusLabel}</option>)}</select>{evidence ? <div className="context-preview"><strong>{evidence.statusLabel}</strong><span>{displayBusinessTerm(evidence.ontologyVersion)}</span><span>{evidence.dataVersion} · 截至 {evidence.dataAsOf}</span><span>{evidence.quality} · {evidence.freshness}</span></div> : <small>验证前必须固定证据包、已发布语义、数据版本、时点、质量与新鲜度。</small>}</div> : null}{node.type === "condition" ? <div className="form-field inspector-field"><label>分流条件</label><select value={node.branchRule} onChange={(event) => updateNodeRestriction(orchestration, node.id, (item) => ({ ...item, branchRule: event.target.value }))}><option>status = complete</option><option>status = partial</option><option>quality_gate = blocked</option><option>permission = denied</option></select><small>只允许结构化状态或枚举，不接受临时自然语言规则。</small></div> : null}</>;
    }
    const agent = model.agents.find((item) => item.id === node.agentId);
    const release = getAgentRelease(agent, node.agentRelease);
    if (!release) return <Notice kind="danger" title="精确 Agent Release 无法定位">该步骤保持阻断，不会回退到当前 Release 或其他历史版本。</Notice>;
    return <><div className="inspector-agent"><span className="resource-icon"><Icon name="bot"></Icon></span><div><strong>{node.agentName}</strong><small>Release {node.agentRelease}</small></div><button className="text-button" onClick={() => navigate("agent-detail", node.agentId, node.agentRelease)}>查看 Agent 详情</button></div><KeyValueList compact rows={[{ label: "输入合同", value: node.inputContract }, { label: "输出合同", value: node.outputContract }, { label: "Published 本体", value: release.ontology }, { label: "Prompt", value: `${getPrompt(release.prompt.id, release.prompt.version, model.resourceReleases?.prompts || []).resource?.name} ${release.prompt.version}` }]}></KeyValueList><div className="inspector-section"><h3>步骤工具权限</h3><p>只能从 Release 白名单继续收窄。</p>{node.baseTools.map((toolId) => { const tool = getTool(toolId); return <label className="check-row" key={toolId}><input type="checkbox" checked={node.allowedTools.includes(toolId)} onChange={(event) => updateNodeRestriction(orchestration, node.id, (item) => ({ ...item, allowedTools: event.target.checked ? [...item.allowedTools, toolId] : item.allowedTools.filter((id) => id !== toolId) }))} /><span><strong>{displayBusinessTerm(tool.name)}</strong><small>{tool.version}</small></span></label>; })}</div><div className="form-field inspector-field"><label>证据范围</label><select value={node.evidenceScope} onChange={(event) => updateNodeRestriction(orchestration, node.id, (item) => ({ ...item, evidenceScope: event.target.value }))}><option>仅使用编排固定输入中的获准证据</option><option>仅使用当前步骤指定证据子集</option><option>仅传递上一步已引用证据</option></select></div><div className="inspector-section"><h3>连接</h3>{orchestration.connections.filter((connection) => connection.source === node.id || connection.target === node.id).map((connection) => { const otherId = connection.source === node.id ? connection.target : connection.source; const other = orchestration.nodes.find((item) => item.id === otherId); return <div className="connection-row" key={connection.id}><span>{connection.source === node.id ? "输出到" : "输入自"}</span><strong>{other?.name}</strong><button className="mini-button" onClick={() => deleteConnection(orchestration, connection.id)} title="移除连接"><Icon name="trash-2" size={13}></Icon></button></div>; })}</div></>;
  }

  function TracePanel({ orchestration }) {
    const trace = orchestration.trace;
    const active = ["waiting", "running"].includes(trace.status);
    return <section className="trace-panel"><div className="trace-panel-head"><div><strong>运行追踪</strong><span className="mono">{trace.id} · {trace.release}</span></div><div className="inline-actions"><StatusBadge status={trace.status}></StatusBadge>{active ? <Button icon="square" kind="danger-soft" onClick={() => cancelOrchestrationTrace(orchestration)}>取消检查</Button> : <Button icon="rotate-cw" onClick={() => startOrchestrationTrace(orchestration, trace.snapshot, trace.id)}>重试原快照</Button>}</div></div>{trace.error ? <Notice kind="danger" title="路径检查停止">{trace.error}</Notice> : null}<div className="trace-steps">{trace.stepRuns.map((step) => <div key={step.id}><span className={`trace-dot ${step.status}`}></span><div><strong>{step.name}</strong><small>{step.id}{step.agentRunId ? ` · ${step.agentRunId}` : step.type === "agent" ? " · 未启动 Agent Run" : ""}</small></div><StatusBadge status={step.status}></StatusBadge></div>)}</div>{trace.outcome ? <Notice kind={trace.status === "complete" ? "success" : "info"} title="检查结论">{trace.outcome}</Notice> : null}<p className="muted-copy">未形成最终业务结果；固定快照及已完成步骤引用保留。</p>{orchestration.traceHistory?.length ? <details className="trace-history"><summary>历史路径检查（{orchestration.traceHistory.length}）</summary>{orchestration.traceHistory.map((item) => <button key={item.id} className="task-history-item" onClick={() => setDrawer({ type: "trace-history", trace: item })}><Icon name="history"></Icon><span><strong>{item.id}</strong><small>{item.startedAt}</small></span><StatusBadge status={item.status}></StatusBadge></button>)}</details> : null}</section>;
  }

  function NotFound({ title }) {
    return <div className="page"><EmptyState icon="file-question" title={title} description="该资源可能已被重置或移除。" action={<Button icon="arrow-left" onClick={() => window.history.back()}>返回</Button>}></EmptyState></div>;
  }

  function renderScreen() {
    if (route.screen === "agents") return <AgentDirectory></AgentDirectory>;
    if (route.screen === "agent-detail") return <AgentDetail></AgentDetail>;
    if (route.screen === "draft-config") return <DraftConfig></DraftConfig>;
    if (route.screen === "resources") return <ResourceDirectory></ResourceDirectory>;
    if (route.screen === "resource-detail") return <ResourceDetail></ResourceDetail>;
    if (route.screen === "runs") return <RunCenter></RunCenter>;
    if (route.screen === "run-detail") return <RunDetail></RunDetail>;
    if (route.screen === "evidence") return <EvidenceWorkspace></EvidenceWorkspace>;
    if (route.screen === "evidence-detail") return <EvidenceDetail></EvidenceDetail>;
    if (route.screen === "orchestrations") return <OrchestrationDirectory></OrchestrationDirectory>;
    if (route.screen === "orchestration-editor") return <OrchestrationEditor></OrchestrationEditor>;
    return <AgentDirectory></AgentDirectory>;
  }

  function routeTitle() {
    if (route.screen === "agent-detail") return model.agents.find((item) => item.id === route.id)?.name || "Agent 详情";
    if (route.screen === "draft-config") return "Agent 配置";
    if (route.screen === "resource-detail") return `${contractLabel(route.kind)} 详情`;
    if (route.screen === "run-detail") return route.id;
    if (route.screen === "evidence-detail") return model.evidencePackages.find((item) => item.id === route.id)?.name || "证据详情";
    if (route.screen === "orchestration-editor") return model.orchestrations.find((item) => item.id === route.id)?.name || "编排编辑";
    return { agents: "Agent 目录", resources: "配置资源", runs: window.AGENT_WORKSPACE_CONFIG.variant === "task" ? "任务工作台" : "运行中心", evidence: "证据与结果", orchestrations: window.AGENT_WORKSPACE_CONFIG.variant === "orchestration" ? "协作工作台" : "协作编排" }[route.screen] || "Agent 应用";
  }

  function renderModal() {
    if (!modal) return null;
    if (modal.type === "c022-receive") {
      const candidate = selectedC022Candidate();
      const identity = c022Identity(candidate);
      const issues = candidate ? c022Issues(candidate, readActiveScenarioContext()) : [];
      const latestRejection = model.c022Rejections?.[0];
      return <Modal title="接收报告生成请求" subtitle="只读取报告中心提交的完整请求；身份校验未通过时记录原因，不创建运行资源。" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>关闭</Button><Button icon="refresh-cw" onClick={refreshC022Inbox}>重新读取</Button><Button icon="inbox" kind="primary" disabled={!candidate} title={issues.length ? issues.join("；") : null} onClick={() => receiveC022(candidate)}>{issues.length ? "拒绝并记录" : "接收请求"}</Button></>}>
        {!c022Candidates.length ? <EmptyState icon="inbox" title="尚未收到报告生成请求" description="报告中心提交完整的场景身份、报告定义、模板、证据包和精确版本后，可在此重新读取。"></EmptyState> : <div className="stack">
          <div className="form-field"><label>来源记录</label><select value={candidate?.requestId || ""} onChange={(event) => setC022SelectedId(event.target.value)}>{c022Candidates.map((item) => <option key={item.requestId} value={item.requestId}>{item.requestId} · {item.submittedAt || "来源未提供时间"}</option>)}</select></div>
          {issues.length ? <Notice kind="danger" title="当前请求不能接收">{issues.join("；")}。请由报告中心按同一场景轮次修复后重新提交；Agent 不补齐身份、不改选版本。</Notice> : <Notice kind="success" title="固定身份校验通过">接收后只形成待处理 Request 和固定证据投影；用户点击“开始生成报告草稿”后才创建独立 C023 Run。</Notice>}
          <KeyValueList rows={[{ label: "请求标识", value: identity.requestId || "缺失" }, { label: "场景身份", value: `${identity.scenarioId || "缺失"} / ${identity.scenarioVersion || "缺失"} / ${identity.scenarioRunId || "缺失"}` }, { label: "报告根", value: identity.aggregateId || "缺失" }, { label: "报告定义", value: `${identity.reportDefinitionId || "缺失"} / ${identity.reportDefinitionVersion || "缺失"}` }, { label: "模板", value: `${identity.templateId || "缺失"} / ${identity.templateVersion || "缺失"}` }, { label: "证据包 / 版本", value: `${identity.evidencePackageId || "缺失"} / ${identity.evidencePackageVersion || "缺失"}` }, { label: "语义标识 / 版本", value: `${identity.semanticVersionId || "缺失"} / ${identity.semanticVersion || "缺失"}` }, { label: "数据资产标识 / 版本", value: `${identity.dataAssetVersionId || "缺失"} / ${identity.dataVersion || "缺失"}` }, { label: "可消费版本 / 截至", value: `${identity.consumableVersionId || "缺失"} / ${identity.dataAsOf || "缺失"}` }, { label: "目标内容修订", value: identity.targetContentRevision || "缺失" }]}></KeyValueList>
          {latestRejection ? <Notice kind="warning" title="最近一次拒绝">{latestRejection.sourceRequestId}：{latestRejection.issues.join("；")}。{latestRejection.recovery}</Notice> : null}
        </div>}
      </Modal>;
    }
    if (modal.type === "c024-receive") {
      const candidate = selectedC024Candidate();
      const identity = c024Identity(candidate);
      const issues = candidate ? c024Issues(candidate, readActiveScenarioContext()) : [];
      const latestRejection = model.c024Rejections?.[0];
      return <Modal title="接收报告伴读请求" subtitle="只读取报告中心提交的完整报告上下文；身份校验未通过时记录原因，不创建会话。" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>关闭</Button><Button icon="refresh-cw" onClick={refreshC024Inbox}>重新读取</Button><Button icon="inbox" kind="primary" disabled={!candidate} title={issues.length ? issues.join("；") : null} onClick={() => receiveC024(candidate)}>{issues.length ? "拒绝并记录" : "接收交接"}</Button></>}>
        {!c024Candidates.length ? <EmptyState icon="inbox" title="尚未收到报告伴读请求" description="报告中心提交完整的场景身份、报告内容版本、证据包和精确语义/数据版本后，可在此重新读取。"></EmptyState> : <div className="stack">
          <div className="form-field"><label>来源记录</label><select value={candidate?.requestId || ""} onChange={(event) => setC024SelectedId(event.target.value)}>{c024Candidates.map((item) => <option key={item.requestId} value={item.requestId}>{item.requestId} · {item.receivedAt || "来源未提供时间"}</option>)}</select></div>
          {issues.length ? <Notice kind="danger" title="当前交接不能接收">{issues.join("；")}。请由报告中心按同一场景轮次修复后重新提交；Agent 不补齐身份、不改选版本。</Notice> : <Notice kind="success" title="固定身份校验通过">接收后仅创建当前 Request 和固定证据投影；开始处理时才创建 Context Binding、Session 与 Run，完成后才形成 C025 Result。</Notice>}
          <KeyValueList rows={[{ label: "请求标识", value: candidate?.requestId || "缺失" }, { label: "场景身份", value: `${identity.scenarioId || "缺失"} / ${identity.scenarioVersion || "缺失"} / ${identity.scenarioRunId || "缺失"}` }, { label: "报告编号 / 内容版本", value: `${identity.reportNumber || "缺失"} / ${identity.contentVersion || "缺失"}` }, { label: "证据包 / 版本", value: `${identity.evidencePackageId || "缺失"} / ${identity.evidencePackageVersion || "缺失"}` }, { label: "语义标识 / 版本", value: `${identity.semanticVersionId || "缺失"} / ${identity.semanticVersion || "缺失"}` }, { label: "数据资产标识 / 版本", value: `${identity.dataAssetVersionId || "缺失"} / ${identity.dataVersion || "缺失"}` }, { label: "数据截至时间", value: identity.dataAsOf || "缺失" }, { label: "稳定锚点", value: `${identity.anchorSnapshotId || "缺失"} / ${identity.anchorSnapshotVersion || "缺失"} / ${identity.selectedAnchor || "缺失"}` }, { label: "问题", value: candidate?.question || "缺失" }]}></KeyValueList>
          {latestRejection ? <Notice kind="warning" title="最近一次拒绝">{latestRejection.sourceRequestId}：{latestRejection.issues.join("；")}。{latestRejection.recovery}</Notice> : null}
        </div>}
      </Modal>;
    }
    if (modal.type === "reset") return <Modal title="重置当前报告工作" subtitle="仅清理当前场景轮次的报告生成与伴读工作，历史记录保持可追溯。" size="small" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>取消</Button><Button icon="rotate-ccw" kind="danger" onClick={resetState}>确认重置</Button></>}><Notice kind="warning" title="当前工作将归零">待接收请求、固定输入、伴读会话、运行和结果将退出当前工作区；历史运行与依据不删除，Agent 配置和其他业务资源不受影响。</Notice></Modal>;
    if (modal.type === "new-agent") return <Modal title="创建 Agent 配置草稿" subtitle="可创建洞察、报告生成、报告自动核验或报告伴读配置。" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>取消</Button><Button icon="save" kind="primary" onClick={createNewAgentDraft}>创建草稿</Button></>}><div className="form-grid"><div className="form-field full"><label>Agent 名称</label><input value={newAgentForm.name} onChange={(event) => setNewAgentForm({ ...newAgentForm, name: event.target.value })} placeholder="输入业务可理解的名称" /></div><div className="form-field"><label>Agent 类型</label><select value={newAgentForm.type} onChange={(event) => setNewAgentForm({ ...newAgentForm, type: event.target.value })}><option>洞察 Agent</option><option>报告伴读 Agent</option><option>报告核验 Agent</option><option>报告草稿 Agent</option></select></div><div className="form-field full"><label>业务用途</label><textarea value={newAgentForm.purpose} onChange={(event) => setNewAgentForm({ ...newAgentForm, purpose: event.target.value })} placeholder="说明固定输入、结构化输出和明确禁止事项"></textarea></div></div></Modal>;
    if (modal.type === "agent-status") { const agent = model.agents.find((item) => item.id === modal.agentId); return <Modal title="停用 Agent" subtitle={`${agent?.name} · Release ${agent?.activeRelease}`} size="small" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>取消</Button><Button icon="circle-stop" kind="danger" onClick={() => setAgentStatus(agent, false)}>确认停用</Button></>}><Notice kind="warning" title="停用后不能创建新运行">历史 Release、运行、结果与编排精确引用仍保留。</Notice></Modal>; }
    if (modal.type === "run") {
      const agent = model.agents.find((item) => item.id === runForm.agentId);
      const request = model.inboundRequests.find((item) => item.id === runForm.requestId);
      const evidenceKind = agent?.type === "报告伴读 Agent" ? "report" : agent?.type === "报告草稿 Agent" ? "report-generation" : "finance";
      const evidenceOptions = model.evidencePackages.filter((item) => currentProjection(item) && item.kind === evidenceKind);
      const evidence = model.evidencePackages.find((item) => item.id === runForm.evidenceId && currentProjection(item));
      const release = getAgentRelease(agent);
      const gate = formalRunGate(agent, release, evidence, request);
      const draftRequest = request?.type === "report-draft";
      return <Modal title={request ? draftRequest ? "生成报告结构化源草稿" : "处理报告伴读请求" : "发起 Agent 运行"} subtitle="开始前读取当前 C017 摘要；开始后固定场景、对象范围、Agent Release 和证据快照。" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>取消</Button><Button icon="play" kind="primary" disabled={gate.mode !== "normal"} title={gate.mode !== "normal" ? gate.reason : null} onClick={() => startFormalRun()}>{draftRequest ? "开始生成" : "开始运行"}</Button></>}><div className="form-grid"><div className="form-field"><label>Agent Release</label><select value={runForm.agentId} disabled={Boolean(request)} onChange={(event) => { const nextId = event.target.value; const nextAgent = model.agents.find((item) => item.id === nextId); const nextKind = nextAgent.type === "报告伴读 Agent" ? "report" : nextAgent.type === "报告草稿 Agent" ? "report-generation" : "finance"; const nextEvidence = model.evidencePackages.find((item) => item.kind === nextKind); setRunForm({ ...runForm, agentId: nextId, evidenceId: nextEvidence?.id || "" }); }}>{model.agents.filter((item) => item.status === "enabled" && (request || !["报告伴读 Agent", "报告草稿 Agent"].includes(item.type))).map((item) => <option key={item.id} value={item.id}>{item.name} · Release {item.activeRelease}</option>)}</select></div><div className="form-field"><label>固定证据包</label><select value={runForm.evidenceId} disabled={Boolean(request)} onChange={(event) => setRunForm({ ...runForm, evidenceId: event.target.value })}>{evidenceOptions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.dataAsOf} · {item.statusLabel}</option>)}</select></div>{!request ? <div className="form-field"><label>本次处理</label><select value={runForm.condition || "normal"} onChange={(event) => setRunForm({ ...runForm, condition: event.target.value })}><option value="normal">标准处理</option><option value="tool">验证工具失败与原快照重试</option><option value="partial">验证部分结果与替代运行</option></select></div> : null}{request ? <div className="form-field full"><label>{draftRequest ? "生成任务" : "问题"}</label><textarea readOnly value={request.question}></textarea></div> : null}</div>{agent && release && evidence ? <div className="run-input-preview"><div><StatusBadge status={evidence.credibility?.currentStateSummary?.status || evidence.status} label={evidence.credibility?.currentStateSummary?.label || evidence.statusLabel}></StatusBadge><strong>{evidence.name}</strong></div><KeyValueList compact rows={[{ label: "上下文标识 / 版本", value: evidence.requestContext ? `${evidence.requestContext.id} · ${evidence.requestContext.version}` : "缺失" }, { label: "发起方 / 请求时间", value: evidence.requestContext ? `${evidence.requestContext.sourceOwner} / ${evidence.requestContext.requestedAt}` : "缺失" }, { label: "场景引用", value: evidence.requestContext?.scenarioId ? `${evidence.requestContext.scenarioId} · ${evidence.requestContext.scenarioLabel}` : evidence.requestContext?.scenarioLabel || "未提供" }, { label: "目标对象范围", value: evidence.requestContext?.objectScope || "缺失" }, { label: "期望输出", value: evidence.requestContext?.expectedOutput || "缺失" }, { label: "版本绑定摘要", value: `${evidence.credibility?.versionBindingSummary?.id || "缺失"} · ${evidence.credibility?.versionBindingSummary?.version || "缺失"}` }, { label: "当前状态摘要", value: `${evidence.credibility?.currentStateSummary?.id || "缺失"} · ${evidence.credibility?.currentStateSummary?.version || "缺失"}` }, { label: "Published 语义", value: evidence.ontologyVersion }, { label: "数据版本 / 截至", value: `${evidence.dataVersion} / ${evidence.dataAsOf}` }, { label: "质量 / 新鲜度", value: `${evidence.credibility?.currentStateSummary?.quality || evidence.quality} / ${evidence.credibility?.currentStateSummary?.freshness || evidence.freshness}` }]}></KeyValueList></div> : null}{evidence?.credibility ? <AgentUseGate gates={evidence.credibility.agentGates} compact></AgentUseGate> : null}{gate.mode !== "normal" ? <Notice kind="danger" title="当前不能开始正式运行">{gate.reason} {gate.recovery || "重新读取当前状态摘要后再判断。"}</Notice> : <Notice kind="success" title="输入门已满足">固定请求上下文、证据、精确版本与用途门可用；运行结果仍需经输出合同校验。</Notice>}</Modal>;
    }
    if (modal.type === "action") { const run = model.runs.find((item) => item.id === modal.runId); const currentCredibility = runCurrentCredibility(run); const action = actionRequestEligibility(run, currentCredibility); const selectedTarget = action.targets?.find((target) => target.id === actionTargetId); const blocked = actionSubmitBlock || (!action.allowed ? `${action.reason || "当前不能提交"} ${action.recovery || ""}`.trim() : null); return <Modal title="发起行动申请" subtitle="打开页面和最终提交时均重新读取当前状态；后续确认、提醒和待办由决策中心处理。" onClose={() => { setActionSubmitBlock(null); setActionTargetId(""); setModal(null); }} actions={<><Button onClick={() => { setActionSubmitBlock(null); setActionTargetId(""); setModal(null); }}>{blocked ? "关闭" : "取消"}</Button><Button icon="refresh-cw" onClick={() => { setActionSubmitBlock(null); refreshCredibility(run.snapshot.evidenceId); }}>重新读取状态</Button>{!blocked && action.allowed ? <Button icon="send" kind="primary" disabled={!selectedTarget} onClick={() => submitActionRequest(run)}>提交申请</Button> : null}</>}>{blocked ? <><Notice kind="danger" title="当前不能提交">{blocked}</Notice><CredibilitySummary credibility={currentCredibility} title="提交前当前可信度"></CredibilitySummary><AgentUseGate gates={currentCredibility?.agentGates} highlightId="action-request"></AgentUseGate></> : <><Notice kind="info" title="本次只提交一个目标主体">当前按最小业务合同形成一条单主体、单次来源申请；不会创建待办或代替人工确认。</Notice><CredibilitySummary credibility={currentCredibility} title="提交前当前可信度"></CredibilitySummary><div className="form-field modal-field"><label>目标主体</label><select value={actionTargetId} onChange={(event) => setActionTargetId(event.target.value)}>{action.targets.map((target) => <option key={target.id} value={target.id}>{target.name}（{target.id}）</option>)}</select></div><KeyValueList rows={[{ label: "行动类型", value: action.actionType.name }, { label: "稳定标识 / 版本", value: `${action.actionType.resourceId} / ${action.actionType.version}` }, { label: "目标对象", value: selectedTarget ? `${selectedTarget.name}（${selectedTarget.id}）` : "请选择" }, { label: "来源运行", value: run?.id }, { label: "来源结果", value: run?.result?.id }, { label: "固定数据版本", value: run?.snapshot.dataVersion }, { label: "数据截至时间", value: run?.snapshot.dataAsOf }, { label: "当前状态摘要", value: `${currentCredibility?.currentStateSummary?.id || "缺失"} · ${currentCredibility?.currentStateSummary?.version || "缺失"}` }, { label: "摘要观察时间", value: currentCredibility?.currentStateSummary?.observedAt }]}></KeyValueList><AgentUseGate gates={currentCredibility?.agentGates} highlightId="action-request"></AgentUseGate><div className="form-field modal-field"><label>申请说明</label><textarea value={actionReason} onChange={(event) => setActionReason(event.target.value)} placeholder="说明希望业务负责人核对或评估的事项"></textarea></div></>}</Modal>; }
    if (modal.type === "handoff") {
      const handoff = model.handoffs.find((item) => item.id === (modal.handoffId || modal.handoff?.id));
      if (!handoff) return null;
      const received = handoff.status === "received";
      const receiptAction = received ? null : <Button icon="refresh-cw" onClick={() => refreshActionReceipt(handoff.id)}>重新读取回执</Button>;
      const decisionEntry = handoff.decisionCenterUrl ? <a href={handoff.decisionCenterUrl}>查看详情</a> : "等待 C019 返回";
      return <Modal title="行动申请移交回执" subtitle={handoff.id} size="small" onClose={() => setModal(null)} actions={<>{receiptAction}<Button kind="primary" onClick={() => setModal(null)}>关闭</Button></>}><Notice kind={received ? "success" : "info"} title={received ? "决策中心已接收申请" : "行动申请等待决策中心接收"}>{received ? "本模块只保留 C019 返回的稳定详情入口与来源证据，不维护后续人工确认、提醒或待办状态。" : `C011 已写入决策中心待接收区；${handoff.receiptReason || "尚未读取到 C019 接收回执"}。`}</Notice><KeyValueList rows={[{ label: "移交标识", value: handoff.id }, { label: "行动申请标识", value: handoff.actionRequestId }, { label: "状态", value: <StatusBadge status={handoff.status}></StatusBadge> }, { label: "行动类型", value: `${handoff.actionType} · ${handoff.actionTypeVersion}` }, { label: "稳定标识", value: handoff.actionTypeId }, { label: "目标对象", value: handoff.target }, { label: "来源运行", value: handoff.runId }, { label: "来源结果", value: handoff.resultId }, { label: "场景身份", value: `${handoff.scenarioContext?.scenarioId || "缺失"} / ${handoff.scenarioContext?.scenarioVersion || "缺失"} / ${handoff.scenarioContext?.scenarioRunId || "缺失"}` }, { label: "证据引用", value: handoff.evidenceRefs.join("；") }, { label: "已发布语义", value: displayBusinessTerm(handoff.ontologyVersion) }, { label: "数据版本 / 截至", value: `${handoff.dataVersion} / ${handoff.dataAsOf}` }, { label: "质量 / 新鲜度", value: `${handoff.quality} / ${handoff.freshness}` }, { label: "提交时间", value: handoff.submittedAt }, { label: "接收时间", value: handoff.receivedAt || "等待接收" }, { label: "决策中心入口", value: decisionEntry }, { label: "申请说明", value: handoff.reason }]}></KeyValueList></Modal>;
    }
    if (modal.type === "report-comparison") {
      const run = model.runs.find((item) => item.id === modal.runId);
      const evidence = model.evidencePackages.find((item) => item.id === run?.snapshot?.evidenceId);
      const currentSummary = evidence?.credibility?.currentStateSummary;
      const comparisonRecord = {
        id: `RC-CURRENT-COMPARISON-${run?.requestId || run?.id}`,
        owner: "报告中心",
        label: "报告中心当前比较记录已接收",
        status: "received",
        comparedAt: nowText(),
        reportVersion: run?.snapshot?.reportVersion,
        reportEvidenceId: run?.snapshot?.evidenceId,
        currentSummaryId: currentSummary?.id,
        currentSummaryVersion: currentSummary?.version,
        currentSummaryObservedAt: currentSummary?.observedAt,
        comparisonRunRef: `RC-COMPARE-${run?.requestId || run?.id}`,
        conclusion: "报告中心提供的确定性比较记录已固定；Agent 只解释该记录，不生成比较事实。"
      };
      return <Modal title="接收报告中心当前比较记录" subtitle={run?.snapshot?.reportVersion} size="small" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>取消</Button><Button icon="download" kind="primary" disabled={!currentSummary} onClick={() => acceptReportCenterComparison(run, comparisonRecord)}>接收记录</Button></>}><Notice kind="info" title="比较责任方为报告中心">Agent 应用不创建或重算比较，只接收记录引用并精确绑定当前 C017 摘要；摘要变化后旧记录只标记陈旧。</Notice><KeyValueList rows={[{ label: "比较记录", value: comparisonRecord.id }, { label: "比较运行引用", value: comparisonRecord.comparisonRunRef }, { label: "报告版本", value: comparisonRecord.reportVersion }, { label: "报告证据包", value: comparisonRecord.reportEvidenceId }, { label: "当前状态摘要", value: currentSummary ? `${currentSummary.id} · ${currentSummary.version}` : "缺失" }, { label: "摘要观察时间", value: currentSummary?.observedAt }, { label: "来源 Owner", value: comparisonRecord.owner }, { label: "记录说明", value: comparisonRecord.conclusion }]}></KeyValueList></Modal>;
    }
    if (modal.type === "orchestration") return <Modal title="创建协作编排" subtitle="从受控模式开始，不提供空白自由画布。" onClose={() => setModal(null)} actions={<><Button onClick={() => setModal(null)}>取消</Button><Button icon="arrow-right" kind="primary" onClick={createOrchestration}>创建草稿</Button></>}><div className="template-picker"><label className={orchestrationForm.template === "sequence" ? "selected" : ""}><input type="radio" name="template" value="sequence" checked={orchestrationForm.template === "sequence"} onChange={(event) => setOrchestrationForm({ ...orchestrationForm, template: event.target.value })} /><Icon name="arrow-right"></Icon><strong>顺序协作</strong><span>上一步结构化输出进入下一步</span></label><label className={orchestrationForm.template === "parallel" ? "selected" : ""}><input type="radio" name="template" value="parallel" checked={orchestrationForm.template === "parallel"} onChange={(event) => setOrchestrationForm({ ...orchestrationForm, template: event.target.value })} /><Icon name="git-fork"></Icon><strong>并行协作</strong><span>共享固定上下文后指定汇总</span></label><label className={orchestrationForm.template === "branch" ? "selected" : ""}><input type="radio" name="template" value="branch" checked={orchestrationForm.template === "branch"} onChange={(event) => setOrchestrationForm({ ...orchestrationForm, template: event.target.value })} /><Icon name="split"></Icon><strong>确定性分流</strong><span>只依据结构化状态或枚举</span></label></div><div className="form-grid"><div className="form-field full"><label>编排名称</label><input value={orchestrationForm.name} onChange={(event) => setOrchestrationForm({ ...orchestrationForm, name: event.target.value })} placeholder="输入真实业务用途对应的名称" /></div><div className="form-field full"><label>业务用途</label><textarea value={orchestrationForm.purpose} onChange={(event) => setOrchestrationForm({ ...orchestrationForm, purpose: event.target.value })} placeholder="说明为什么需要多个 Agent 协作，以及最终落入哪个既有输出合同"></textarea></div></div></Modal>;
    if (modal.type === "evidence-item") { const evidence = modal.snapshot ? evidenceFromSnapshot(modal.snapshot) : model.evidencePackages.find((item) => item.id === modal.evidenceId); const item = evidence?.items.find((entry) => entry.id === modal.ref); return <Modal title={item?.name || "证据详情"} subtitle={`${evidence?.name || "固定证据"}${modal.snapshot ? " · 运行快照" : ""}`} size="small" onClose={() => setModal(null)} actions={<Button kind="primary" onClick={() => setModal(null)}>关闭</Button>}><KeyValueList rows={[{ label: "证据引用", value: item?.id }, { label: "类型", value: item?.type }, { label: "值", value: item?.value }, { label: "对象范围", value: item?.object }, { label: "来源", value: item?.source }, { label: "Published 语义", value: evidence?.ontologyVersion }, { label: "数据版本", value: evidence?.dataVersion }, { label: "截至时间", value: evidence?.dataAsOf }]}></KeyValueList></Modal>; }
    return null;
  }

  function renderDrawer() {
    if (!drawer) return null;
    if (drawer.type === "connection-error") return <Drawer title="连接被阻断" subtitle={`${drawer.source?.name || "来源"} → ${drawer.target?.name || "目标"}`} onClose={() => setDrawer(null)} actions={<Button kind="primary" onClick={() => setDrawer(null)}>返回画布</Button>}><Notice kind="danger" title="输出合同不兼容">{drawer.reason}</Notice><KeyValueList rows={[{ label: "来源输出", value: drawer.source?.outputContract }, { label: "目标输入", value: drawer.target?.inputContract }, { label: "证据传递", value: "连接未建立，未传递任何上下文" }, { label: "恢复方式", value: "选择兼容的精确 Agent Release 或已确认转换合同；不得让 LLM 临时改写接口。" }]}></KeyValueList></Drawer>;
    if (drawer.type === "run-evidence-snapshot") { const evidence = evidenceFromSnapshot(drawer.run.snapshot); return <Drawer wide title="运行固定证据快照" subtitle={`${drawer.run.id} · ${evidence.name}`} onClose={() => setDrawer(null)} actions={<Button kind="primary" onClick={() => setDrawer(null)}>关闭</Button>}><Notice kind="info" title="快照不可变">以下场景、对象、证据、版本、时点和可信度来自运行创建时，不读取当前证据包状态。</Notice><CredibilitySummary credibility={evidence.credibility} title="运行固定 C017 摘要"></CredibilitySummary><KeyValueList rows={[{ label: "请求上下文", value: evidence.requestContext ? `${evidence.requestContext.id} · ${evidence.requestContext.version}` : "缺失" }, { label: "发起方 / 请求时间", value: evidence.requestContext ? `${evidence.requestContext.sourceOwner} / ${evidence.requestContext.requestedAt}` : "缺失" }, { label: "场景引用", value: drawer.run.snapshot.scenarioId ? `${drawer.run.snapshot.scenarioId} · ${drawer.run.snapshot.scenario}` : drawer.run.snapshot.scenario }, { label: "场景绑定版本", value: drawer.run.snapshot.scenarioBinding ? `${drawer.run.snapshot.scenarioBinding.id} · ${drawer.run.snapshot.scenarioBinding.version}` : "缺失" }, { label: "目标对象范围", value: drawer.run.snapshot.objectScope }, { label: "期望输出合同", value: drawer.run.snapshot.expectedOutput || drawer.run.snapshot.outputContract }, { label: "已发布语义", value: displayBusinessTerm(evidence.ontologyVersion) }, { label: "数据版本 / 截至", value: `${evidence.dataVersion} / ${evidence.dataAsOf}` }, { label: "质量 / 新鲜度", value: `${evidence.quality} / ${evidence.freshness}` }, { label: "权威关系", value: evidence.authority }, { label: "形成时间", value: evidence.formedAt }]}></KeyValueList><div className="evidence-list drawer-evidence-list">{evidence.items.map((item) => <div className="evidence-row" key={item.id}><span className="evidence-type">{displayBusinessTerm(item.type)}</span><div><strong>{displayBusinessTerm(item.name)}</strong><small>{displayBusinessTerm(item.object)} · {displayBusinessTerm(item.source)}</small></div><b>{displayBusinessTerm(item.value)}</b><button className="text-button" onClick={() => setModal({ type: "evidence-item", snapshot: drawer.run.snapshot, ref: item.id })}>查看详情</button></div>)}</div><HistoryDimensions dimensions={evidence.credibility?.historyDimensions} title="运行固定历史五维状态"></HistoryDimensions></Drawer>; }
    if (drawer.type === "trace-history") { const trace = drawer.trace; return <Drawer title="历史路径检查" subtitle={`${trace.id} · ${trace.release}`} onClose={() => setDrawer(null)} actions={<Button kind="primary" onClick={() => setDrawer(null)}>关闭</Button>}><KeyValueList rows={[{ label: "状态", value: <StatusBadge status={trace.status}></StatusBadge> }, { label: "开始时间", value: trace.startedAt }, { label: "完成时间", value: trace.finishedAt || "未结束" }, { label: "重试来源", value: trace.retryOf || "无" }, { label: "固定证据包", value: trace.snapshot?.inputContext?.evidenceName || "未固定" }, { label: "Published 语义", value: trace.snapshot?.inputContext?.ontologyVersion || "未固定" }, { label: "数据版本 / 截至", value: trace.snapshot?.inputContext ? `${trace.snapshot.inputContext.dataVersion} / ${trace.snapshot.inputContext.dataAsOf}` : "未固定" }, { label: "检查结论", value: trace.outcome || trace.error || "未形成" }]}></KeyValueList><div className="trace-steps drawer-trace-steps">{trace.stepRuns.map((step) => <div key={step.id}><span className={`trace-dot ${step.status}`}></span><div><strong>{step.name}</strong><small>{step.id}</small></div><StatusBadge status={step.status}></StatusBadge></div>)}</div><Notice kind="info" title="历史快照不变">该记录使用当时节点、连接、Agent Release、权限与固定输入，不以当前草稿覆盖。</Notice></Drawer>; }
    if (drawer.type === "release-diff") { const { agent, release, previous } = drawer; return <Drawer title={`Release ${release.version} 版本差异`} subtitle={agent.name} onClose={() => setDrawer(null)} actions={<><Button onClick={() => setDrawer(null)}>关闭</Button><Button icon="copy-plus" kind="primary" onClick={() => { setDrawer(null); createDraftFromRelease(agent, release); }}>基于此版本创建草稿</Button></>}><div className="diff-summary"><div><span>比较版本</span><strong>{previous ? `${previous.version} → ${release.version}` : `首次 Release ${release.version}`}</strong></div></div><KeyValueList rows={[{ label: "Prompt", value: previous ? `${previous.prompt.version} → ${release.prompt.version}` : release.prompt.version }, { label: "Skill", value: previous ? `${previous.skills.length} → ${release.skills.length}` : release.skills.length }, { label: "工具白名单", value: previous ? `${previous.tools.length} → ${release.tools.length}` : release.tools.length }, { label: "场景绑定", value: previous ? `${scenarioBindingLabel(previous)} → ${scenarioBindingLabel(release)}` : scenarioBindingLabel(release) }, { label: "场景绑定版本", value: release.scenarioBinding ? `${release.scenarioBinding.id} · ${release.scenarioBinding.version}` : "缺失" }, { label: "输入合同", value: release.inputContract }, { label: "输出合同", value: release.outputContract }, { label: "Published 本体", value: release.ontology }, { label: "变更说明", value: release.change }]}></KeyValueList><Notice kind="info" title="历史不变">该 Release 的配置和引用不可变；创建草稿不会影响历史运行或已启用编排。</Notice></Drawer>; }
    return null;
  }

  return <><AppShell route={route} title={routeTitle()} counts={counts} onNavigate={navigate} onReset={() => setModal({ type: "reset" })}>{storageFailure ? <div className="page"><Notice kind="danger" title="状态尚未保存">{storageFailure.message} {storageFailure.recovery}</Notice><div className="page-actions"><Button icon="refresh-cw" kind="primary" onClick={retryPersistModel}>重试保存</Button></div></div> : null}{renderScreen()}</AppShell>{renderModal()}{renderDrawer()}<ToastStack toasts={toasts}></ToastStack></>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App></App>);
