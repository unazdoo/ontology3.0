"use strict";

const { fail } = require("./errors");
const {
  assertObject,
  assertString,
  assertArray,
  sameScenarioRun,
  immutableJson,
  stableSerialize,
  contentId,
  sha256
} = require("./utils");

const C027_SCHEMA_VERSION = "ofw.c027.report-current-comparison.v1";
const COMPARISON_STALENESS_SCHEMA_VERSION = "ofw.c027.comparison-staleness-event.v1";
const COMPARISON_RESULTS = Object.freeze([
  "comparable",
  "comparable-with-warning",
  "fixed-result-only",
  "not-comparable"
]);
const COMPARISON_GATES = Object.freeze([
  "report-snapshot-identity",
  "current-t019-authority",
  "quality-scope",
  "semantic-compatibility",
  "evidence-and-authorization"
]);
const RESULT_PRIORITY = Object.freeze({ "not-comparable": 4, "fixed-result-only": 3, "comparable-with-warning": 2, comparable: 1 });
const RESULT_LABELS = Object.freeze({
  comparable: "可以比较",
  "comparable-with-warning": "可以比较但有警告",
  "fixed-result-only": "仅可做固定结果比较",
  "not-comparable": "无法比较"
});

function semanticIdentity(ref) {
  if (!ref || typeof ref !== "object") return null;
  return { resourceId: ref.resourceId || ref.id || null, version: ref.version || ref.publishedVersion || null };
}

function factKey(fact) {
  return fact.compatibilityGroupId || semanticIdentity(fact.semanticRef)?.resourceId || fact.factId;
}

function currentFacts(c008) {
  const map = new Map();
  assertArray(c008.facts, "C008 current facts").forEach((fact, index) => {
    assertObject(fact, `C008.facts[${index}]`);
    const key = fact.compatibilityGroupId || semanticIdentity(fact.semanticRef)?.resourceId || fact.factId || fact.id;
    if (key) map.set(key, fact);
  });
  return map;
}

function qualityImpact(fact, c017) {
  if (c017.status !== "ready" || c017.consumptionStatus !== "ready") return "unknown";
  if (!c017.hardFailure && !["hard-fail", "failed", "失败"].includes(c017.qualityStatus)) {
    return ["warning", "warn", "警告", "stale", "陈旧"].includes(c017.qualityStatus) || ["stale", "陈旧"].includes(c017.freshness?.status) ? "warning" : "pass";
  }
  const scope = c017.affectedScope;
  if (!scope) return "unknown";
  const factIds = Array.isArray(scope.factIds) ? scope.factIds : [];
  const evidenceIds = Array.isArray(scope.evidenceIds) ? scope.evidenceIds : [];
  if (factIds.length === 0 && evidenceIds.length === 0) return "unknown";
  return factIds.includes(fact.factId) || fact.evidenceRefs.some((id) => evidenceIds.includes(id)) ? "fail" : "pass";
}

function compareScope(left, right) {
  if (left == null && right == null) return true;
  return stableSerialize(left) === stableSerialize(right);
}

function gateRecords(fact, currentFact, context) {
  const reportIdentityPass = Boolean(context.contentVersion.contentVersionId && context.evidencePack.evidencePackId && fact.t044Ids?.length && fact.evidenceRefs?.length);
  const quality = qualityImpact(fact, context.currentContext.c017);
  const semantic = semanticIdentity(fact.semanticRef);
  const currentSemantic = semanticIdentity(currentFact?.semanticRef);
  const semanticCompatibility = currentFact?.semanticCompatibility || (
    semantic && currentSemantic && semantic.resourceId === currentSemantic.resourceId ? "compatible" : "unknown"
  );
  const semanticPass = semanticCompatibility === "compatible"
    && (fact.unit || null) === (currentFact?.unit || null)
    && compareScope(fact.objectScope || null, currentFact?.objectScope || null);
  const authorization = context.authorization;
  const authorized = authorization.allowed === true && !authorization.deniedFactIds.includes(fact.factId);
  const fixedEvidence = context.evidencePack.items.filter((item) => fact.evidenceRefs.includes(item.evidenceId));
  const evidencePass = fixedEvidence.length === fact.evidenceRefs.length && fixedEvidence.every((item) => item.accessible !== false && item.authorized !== false);
  return [
    { gateId: COMPARISON_GATES[0], status: reportIdentityPass ? "pass" : "fail", reason: reportIdentityPass ? null : "report snapshot identity or T044/evidence binding is incomplete" },
    { gateId: COMPARISON_GATES[1], status: currentFact && context.currentContext.c008.status === "ready" && context.currentContext.c008.consumptionStatus === "ready" && ["active", "published"].includes(context.currentContext.c008.t019Status) ? "pass" : "fail", reason: currentFact ? "current C008/T019 is not an active consumable authority" : "current T019 has no authoritative compatible fact" },
    { gateId: COMPARISON_GATES[2], status: quality, reason: quality === "fail" ? "post-publication hard quality failure affects this fact" : quality === "unknown" ? "quality impact cannot be mapped" : quality === "warning" ? "non-blocking quality or freshness warning" : null },
    { gateId: COMPARISON_GATES[3], status: semanticPass ? "pass" : semanticCompatibility === "incompatible" ? "fail" : "unknown", reason: semanticPass ? null : "semantic identity, unit, object scope or business grain is incompatible or unknown" },
    { gateId: COMPARISON_GATES[4], status: evidencePass && authorized ? "pass" : "fail", reason: evidencePass ? authorized ? null : "user is not authorized for this comparison" : "fixed structured evidence is unavailable" }
  ];
}

function determineResult(fact, gates, context) {
  if (gates.some((gate) => ["fail", "unknown"].includes(gate.status))) return "not-comparable";
  const replayStatus = context.currentContext.c017.reproducibility?.replayVerification;
  if (["not-run", "not-executed", "未执行", "unavailable", "dependency-missing", "unknown"].includes(replayStatus)) return "fixed-result-only";
  if (gates.some((gate) => gate.status === "warning") || context.currentContext.c017.freshness?.status === "stale") {
    return context.definition.comparisonPolicy.qualityWarningBlocks ? "not-comparable" : "comparable-with-warning";
  }
  return "comparable";
}

function deterministicDifference(left, right, result) {
  if (result === "not-comparable") return null;
  if (typeof left === "number" && Number.isFinite(left) && typeof right === "number" && Number.isFinite(right)) {
    return { kind: "numeric", absolute: right - left, changed: right !== left };
  }
  return { kind: "equality", changed: stableSerialize(left) !== stableSerialize(right) };
}

function normalizeAuthorization(value, scenarioContext) {
  assertObject(value, "comparison authorization");
  if (value.owner !== "platform" || value.source !== "authorization-api") {
    fail("AUTHORIZATION_OWNER_MISMATCH", "comparison authorization must come from the platform authorization API");
  }
  if (!sameScenarioRun(value.scenarioContext, scenarioContext)) fail("AUTHORIZATION_CONTEXT_MISMATCH", "authorization belongs to another scenario run");
  return {
    decisionId: assertString(value.decisionId, "authorization.decisionId"),
    owner: "platform",
    source: "authorization-api",
    decidedAt: assertString(value.decidedAt, "authorization.decidedAt"),
    allowed: value.allowed === true,
    deniedFactIds: Array.isArray(value.deniedFactIds) ? value.deniedFactIds : []
  };
}

function createC027Comparison(input) {
  assertObject(input, "C027 comparison input");
  if (input.explicitUserAction !== true) {
    fail("EXPLICIT_USER_ACTION_REQUIRED", "C027 may only be started by an explicit user action");
  }
  const initiatedBy = assertString(input.initiatedBy, "C027.initiatedBy");
  const { contentVersion, evidencePack, currentContext, definition } = input;
  if (!sameScenarioRun(contentVersion.scenarioContext, currentContext.scenarioContext)) {
    fail("C027_CONTEXT_MISMATCH", "report snapshot and current authority belong to different scenario runs");
  }
  const authorization = normalizeAuthorization(input.authorization, contentVersion.scenarioContext);
  const currentByKey = currentFacts(currentContext.c008);
  const items = contentVersion.factInventory
    .filter((fact) => definition.comparisonPolicy.allowedFactKinds.includes(fact.kind))
    .map((fact) => {
      const currentFact = currentByKey.get(factKey(fact)) || null;
      const context = { contentVersion, evidencePack, currentContext, definition, authorization };
      const gates = gateRecords(fact, currentFact, context);
      const result = determineResult(fact, gates, context);
      const authorizedForFact = authorization.allowed === true && !authorization.deniedFactIds.includes(fact.factId);
      return {
        comparisonItemId: contentId("C027I", { comparisonRunId: input.comparisonRunId, factId: fact.factId }),
        factId: fact.factId,
        compatibilityGroupId: fact.compatibilityGroupId || factKey(fact),
        sectionId: fact.sectionId,
        t044Ids: fact.t044Ids,
        evidenceRefs: fact.evidenceRefs,
        reportSnapshot: {
          value: authorizedForFact ? fact.value : null,
          unit: fact.unit,
          semanticRef: fact.semanticRef,
          dataVersionId: evidencePack.exactCombination.dataVersionId,
          t008: evidencePack.exactCombination.t008
        },
        currentAuthority: currentFact ? {
          value: authorizedForFact ? (currentFact.value === undefined ? currentFact.structuredValue : currentFact.value) : null,
          unit: authorizedForFact ? currentFact.unit || null : null,
          semanticRef: authorizedForFact ? currentFact.semanticRef || null : null,
          dataVersionId: currentContext.c008.dataVersionId,
          t008: currentContext.c008.t008,
          t019Id: currentContext.c008.t019Id
        } : null,
        gates,
        result,
        resultLabel: RESULT_LABELS[result],
        redacted: !authorizedForFact,
        difference: authorizedForFact ? deterministicDifference(fact.value, currentFact?.value === undefined ? currentFact?.structuredValue : currentFact.value, result) : null
      };
    });
  if (!items.length) fail("C027_SCOPE_EMPTY", "no fixed facts are eligible under the report definition comparison policy");
  const counts = Object.fromEntries(COMPARISON_RESULTS.map((status) => [status, items.filter((item) => item.result === status).length]));
  const summaryResult = items.reduce((worst, item) => RESULT_PRIORITY[item.result] > RESULT_PRIORITY[worst] ? item.result : worst, "comparable");
  const authorityFingerprint = sha256({
    t019Id: currentContext.c008.t019Id,
    t019Version: currentContext.c008.t019Version,
    semanticVersionId: currentContext.c008.semanticVersionId,
    dataVersionId: currentContext.c008.dataVersionId,
    c017SummaryId: currentContext.c017.summaryId,
    c017Version: currentContext.c017.version
  });
  return immutableJson({
    schemaVersion: C027_SCHEMA_VERSION,
    contractId: "C027",
    comparisonRecordId: assertString(input.comparisonRecordId || contentId("C027", { runId: input.comparisonRunId, comparedAt: input.comparedAt }), "comparisonRecordId"),
    comparisonRunId: assertString(input.comparisonRunId, "comparisonRunId"),
    idempotencyKey: input.idempotencyKey || null,
    scenarioContext: contentVersion.scenarioContext,
    reportAggregateId: contentVersion.reportAggregateId,
    contentVersionId: contentVersion.contentVersionId,
    evidencePackRef: contentVersion.evidencePackRef,
    initiatedBy,
    explicitUserAction: true,
    initiatedAt: assertString(input.initiatedAt, "C027.initiatedAt"),
    comparedAt: assertString(input.comparedAt, "C027.comparedAt"),
    runStatus: "completed",
    recordStatus: "completed",
    comparisonStatus: summaryResult,
    result: summaryResult,
    resultLabel: RESULT_LABELS[summaryResult],
    counts,
    items,
    identities: {
      reportSnapshot: { contentVersionId: contentVersion.contentVersionId, exactCombination: evidencePack.exactCombination },
      currentAuthority: { t019Id: currentContext.c008.t019Id, t019Version: currentContext.c008.t019Version, semanticVersionId: currentContext.c008.semanticVersionId, dataVersionId: currentContext.c008.dataVersionId },
      candidates: currentContext.c008.candidates,
      previousTrusted: { data: currentContext.c017.previousDataVersion, authority: currentContext.c008.previousAuthority }
    },
    currentStatusSummaryRef: { summaryId: currentContext.c017.summaryId, version: currentContext.c017.version, formedAt: currentContext.c017.formedAt },
    currentStatusSummary: {
      summaryId: currentContext.c017.summaryId,
      version: currentContext.c017.version,
      formedAt: currentContext.c017.formedAt,
      qualityStatus: currentContext.c017.qualityStatus,
      hardFailure: currentContext.c017.hardFailure,
      affectedScope: currentContext.c017.affectedScope,
      freshness: currentContext.c017.freshness,
      reproducibility: currentContext.c017.reproducibility,
      qualityFactAt: currentContext.c017.qualityFactAt,
      confirmedAt: currentContext.c017.confirmedAt
    },
    c008Ref: { c008Id: currentContext.c008.c008Id, version: currentContext.c008.version, readReceiptId: currentContext.c008.receipt.receiptId },
    authorizationRef: { decisionId: authorization.decisionId, decidedAt: authorization.decidedAt },
    comparisonPolicy: definition.comparisonPolicy,
    authorityFingerprint,
    stale: false,
    staleLabel: "当前",
    staleReason: null,
    staleObservedAt: null,
    regenerationRequestId: null,
    immutable: true
  });
}

function currentAuthorityFingerprint(currentContext) {
  return sha256({
    t019Id: currentContext.c008.t019Id,
    t019Version: currentContext.c008.t019Version,
    semanticVersionId: currentContext.c008.semanticVersionId,
    dataVersionId: currentContext.c008.dataVersionId,
    c017SummaryId: currentContext.c017.summaryId,
    c017Version: currentContext.c017.version
  });
}

function createComparisonStalenessEvent(comparison, currentContext, observedAt) {
  if (comparison.authorityFingerprint === currentAuthorityFingerprint(currentContext)) return null;
  return immutableJson({
    schemaVersion: COMPARISON_STALENESS_SCHEMA_VERSION,
    stalenessEventId: contentId("C027S", { comparisonRecordId: comparison.comparisonRecordId, observedAt, fingerprint: currentAuthorityFingerprint(currentContext) }),
    comparisonRecordId: comparison.comparisonRecordId,
    previousAuthorityFingerprint: comparison.authorityFingerprint,
    observedAuthorityFingerprint: currentAuthorityFingerprint(currentContext),
    reason: "current C008/T019 or C017 summary changed after this comparison",
    observedAt: assertString(observedAt, "comparison stale observedAt"),
    immutable: true
  });
}

function materializeComparison(comparison, stalenessEvents) {
  const event = (stalenessEvents || []).filter((item) => item.comparisonRecordId === comparison.comparisonRecordId)
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt))[0];
  return immutableJson(event ? {
    ...comparison,
    stale: true,
    staleLabel: "比较陈旧",
    staleReason: event.reason,
    staleObservedAt: event.observedAt
  } : comparison);
}

module.exports = Object.freeze({
  C027_SCHEMA_VERSION,
  COMPARISON_STALENESS_SCHEMA_VERSION,
  COMPARISON_RESULTS,
  COMPARISON_GATES,
  RESULT_LABELS,
  createC027Comparison,
  createComparisonStalenessEvent,
  materializeComparison,
  currentAuthorityFingerprint
});
