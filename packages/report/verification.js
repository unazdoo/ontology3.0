"use strict";

const { fail } = require("./errors");
const { assertAllowedKeys } = require("./handoff");
const {
  assertObject,
  assertString,
  assertArray,
  sameScenarioRun,
  immutableJson,
  stableSerialize,
  contentId
} = require("./utils");

const EXTRACTION_RESULT_SCHEMA_VERSION = "ofw.c025.report-verification-extraction.v1";
const T049_SCHEMA_VERSION = "ofw.t049.deterministic-report-verification.v1";
const VERIFICATION_STATUSES = Object.freeze(["pass", "warning", "fail", "unverifiable"]);
const VERIFICATION_GROUPS = Object.freeze([
  Object.freeze({
    groupId: "evidence-binding",
    name: "证据与绑定完整性",
    checks: Object.freeze(["evidence-completeness", "unbound-content-detection"])
  }),
  Object.freeze({
    groupId: "value-internal",
    name: "数值与报告内部一致性",
    checks: Object.freeze(["value-consistency", "cross-content-consistency"])
  }),
  Object.freeze({
    groupId: "semantic-version",
    name: "语义与版本兼容性",
    checks: Object.freeze(["semantic-consistency", "version-compatibility"])
  }),
  Object.freeze({
    groupId: "trust-disclosure",
    name: "可信度与时点披露",
    checks: Object.freeze(["trust-disclosure"])
  }),
  Object.freeze({
    groupId: "rule-human-boundary",
    name: "Rule 结论与人工边界",
    checks: Object.freeze(["rule-consistency", "human-confirmation-boundary"])
  })
]);
const GROUP_CHECK_ALIASES = Object.freeze({
  "evidence-binding": ["evidenceCompleteness", "unboundContentDetection"],
  "value-internal": ["valueConsistency", "crossContentConsistency"],
  "semantic-version": ["semanticConsistency", "versionCompatibility"],
  "trust-disclosure": ["trustDisclosure"],
  "rule-human-boundary": ["ruleConsistency", "humanConfirmationBoundary"]
});
const PRIORITY = Object.freeze({ fail: 4, unverifiable: 3, warning: 2, pass: 1 });
const STATUS_LABELS = Object.freeze({ pass: "通过", warning: "警告", fail: "失败", unverifiable: "无法核验", incomplete: "核验未完整" });

function forbiddenClaimDecision(claim) {
  const forbidden = ["verificationStatus", "verificationResult", "comparisonResult", "pass", "passed", "outcome", "t049", "status"];
  return forbidden.filter((key) => Object.prototype.hasOwnProperty.call(claim, key));
}

function acceptM05Extraction(raw, input) {
  assertObject(raw, "M05 verification extraction");
  assertAllowedKeys(raw, [
    "schemaVersion", "contractId", "extractionResultId", "resultId", "extractionRunId", "runId",
    "scenarioContext", "contentVersionId", "evidencePackId", "agentReleaseVersion", "status",
    "claims", "extractedClaims", "completedAt", "verificationResults", "deterministicResults", "t049"
  ], "M05 verification extraction");
  if (raw.verificationResults || raw.deterministicResults || raw.t049) {
    fail("EXTRACTION_DETERMINISTIC_RESULT_FORBIDDEN", "M05 extraction response may not carry deterministic verification results");
  }
  if (raw.schemaVersion !== EXTRACTION_RESULT_SCHEMA_VERSION) {
    fail("EXTRACTION_SCHEMA_MISMATCH", `M05 extraction schemaVersion must be ${EXTRACTION_RESULT_SCHEMA_VERSION}`);
  }
  const contentVersion = input.contentVersion;
  if (!sameScenarioRun(raw.scenarioContext, contentVersion.scenarioContext)) {
    fail("EXTRACTION_CONTEXT_MISMATCH", "M05 extraction belongs to another scenario run");
  }
  if (raw.contentVersionId !== contentVersion.contentVersionId || raw.evidencePackId !== contentVersion.evidencePackRef.evidencePackId) {
    fail("EXTRACTION_REPORT_MISMATCH", "M05 extraction must bind the exact content version and evidence pack");
  }
  if (!['completed', 'complete', 'succeeded'].includes(raw.status)) fail("EXTRACTION_INCOMPLETE", "five deterministic groups require a completed M05 extraction result");
  const contentItemIds = new Set(contentVersion.contentItems.map((item) => item.sourceContentItemId));
  const factIds = new Set(contentVersion.factInventory.map((fact) => fact.factId));
  const anchorIds = new Set(input.anchors.map((anchor) => anchor.t044Id));
  const claims = assertArray(raw.claims || raw.extractedClaims, "M05 extraction claims").map((claim, index) => {
    assertObject(claim, `M05 extraction claims[${index}]`);
    assertAllowedKeys(claim, [
      "claimId", "id", "sourceContentItemId", "contentItemId", "factId", "t044Id", "anchorId",
      "observedValue", "observedUnit", "evidenceRefs", "semanticRef", "claimKind"
    ], `M05 extraction claims[${index}]`);
    const forbidden = forbiddenClaimDecision(claim);
    if (forbidden.length) {
      fail("EXTRACTION_DETERMINISTIC_RESULT_FORBIDDEN", "M05 extraction may identify claims but may not decide T049 outcomes", { forbidden });
    }
    const normalized = {
      claimId: assertString(claim.claimId || claim.id, `claims[${index}].claimId`),
      sourceContentItemId: assertString(claim.sourceContentItemId || claim.contentItemId, `claims[${index}].sourceContentItemId`),
      factId: claim.factId || null,
      t044Id: assertString(claim.t044Id || claim.anchorId, `claims[${index}].t044Id`),
      observedValue: claim.observedValue,
      observedUnit: claim.observedUnit || null,
      evidenceRefs: Array.isArray(claim.evidenceRefs) ? claim.evidenceRefs : [],
      semanticRef: claim.semanticRef || null,
      claimKind: claim.claimKind || "fact"
    };
    if (!contentItemIds.has(normalized.sourceContentItemId) || !anchorIds.has(normalized.t044Id)) {
      fail("EXTRACTION_ANCHOR_MISMATCH", `claim ${normalized.claimId} does not bind a current T044/content item`);
    }
    if (normalized.factId && !factIds.has(normalized.factId)) fail("EXTRACTION_FACT_MISMATCH", `claim ${normalized.claimId} references an unknown fact`);
    return normalized;
  });
  const extraction = {
    schemaVersion: EXTRACTION_RESULT_SCHEMA_VERSION,
    extractionResultId: assertString(raw.extractionResultId || raw.resultId, "extractionResultId"),
    extractionRunId: assertString(raw.extractionRunId || raw.runId, "extractionRunId"),
    sourceOwner: "M05",
    scenarioContext: contentVersion.scenarioContext,
    contentVersionId: contentVersion.contentVersionId,
    evidencePackId: contentVersion.evidencePackRef.evidencePackId,
    agentReleaseVersion: assertString(raw.agentReleaseVersion, "agentReleaseVersion"),
    status: "completed",
    claims,
    completedAt: assertString(raw.completedAt, "extraction completedAt"),
    immutable: true
  };
  if (extraction.extractionRunId === contentVersion.sourceDraftRef.generationRunId) {
    fail("RUN_ID_REUSED", "M05 extraction Run must be independent of the report generation Run");
  }
  return immutableJson(extraction);
}

function statusResult(status, code, message, details = {}) {
  if (!VERIFICATION_STATUSES.includes(status)) fail("INVALID_VERIFICATION_STATUS", `unknown verification status ${status}`);
  return { status, code, message, ...details };
}

function evidenceForFact(fact, evidencePack) {
  const byId = new Map(evidencePack.items.map((item) => [item.evidenceId, item]));
  return fact.evidenceRefs.map((id) => byId.get(id)).filter(Boolean);
}

function claimForFact(fact, extraction) {
  return extraction.claims.find((claim) => claim.factId === fact.factId && claim.sourceContentItemId === fact.sourceContentItemId) || null;
}

function expectedValue(evidence, fact) {
  if (!evidence) return undefined;
  const value = evidence.structuredValue;
  if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "value")) {
    return value.value;
  }
  return value === null || value === undefined ? fact.value : value;
}

function numericDelta(left, right) {
  return typeof left === "number" && Number.isFinite(left) && typeof right === "number" && Number.isFinite(right)
    ? Math.abs(left - right)
    : null;
}

function evaluateEvidenceBinding(fact, context) {
  const anchor = context.anchorById.get(fact.t044Ids[0]);
  const evidence = evidenceForFact(fact, context.evidencePack);
  if (!anchor || fact.evidenceRefs.length === 0 || evidence.length !== fact.evidenceRefs.length) {
    return statusResult("fail", "STRUCTURED_BINDING_MISSING", "required fact, T044 and evidence binding is incomplete");
  }
  if (evidence.some((item) => item.authorized === false || item.accessible === false)) {
    return statusResult("unverifiable", "EVIDENCE_NOT_ACCESSIBLE", "fixed evidence exists but is not accessible or authorized");
  }
  return statusResult("pass", "EVIDENCE_BOUND", "fact is bound to a stable T044 anchor and fixed evidence");
}

function evaluateValueInternal(fact, context) {
  const claim = claimForFact(fact, context.extraction);
  if (!claim) return statusResult("unverifiable", "CLAIM_NOT_EXTRACTED", "M05 did not extract this structured claim from the fixed content version");
  const evidence = evidenceForFact(fact, context.evidencePack)[0];
  if (!evidence) return statusResult("unverifiable", "FIXED_VALUE_UNAVAILABLE", "fixed evidence value cannot be located");
  const expected = expectedValue(evidence, fact);
  const delta = numericDelta(claim.observedValue, expected);
  const tolerance = Number(fact.tolerance || 0);
  if (claim.observedUnit !== (fact.unit || evidence.unit || null)) {
    return statusResult("fail", "UNIT_MISMATCH", "report claim unit differs from its fixed evidence", { expectedUnit: fact.unit || evidence.unit || null, actualUnit: claim.observedUnit });
  }
  if (delta !== null) {
    if (delta === 0) return statusResult("pass", "VALUE_MATCH", "report value equals the fixed deterministic value", { delta: 0, tolerance });
    if (delta <= tolerance) return statusResult("warning", "AUTHORIZED_ROUNDING", "report value differs only within the governed tolerance", { delta, tolerance });
    return statusResult("fail", "VALUE_MISMATCH", "report value differs from the fixed deterministic value", { delta, tolerance });
  }
  if (stableSerialize(claim.observedValue) !== stableSerialize(expected) || stableSerialize(fact.value) !== stableSerialize(expected)) {
    return statusResult("fail", "VALUE_MISMATCH", "report claim differs from the fixed deterministic value");
  }
  const siblingValues = context.extraction.claims.filter((item) => item.factId === fact.factId).map((item) => stableSerialize(item.observedValue));
  if (new Set(siblingValues).size > 1) return statusResult("fail", "CROSS_CONTENT_MISMATCH", "the same fact differs across report positions");
  return statusResult("pass", "VALUE_MATCH", "report claim and repeated positions match the fixed value");
}

function semanticIdentity(ref) {
  if (!ref || typeof ref !== "object") return null;
  return { resourceId: ref.resourceId || ref.id || null, version: ref.version || ref.publishedVersion || null };
}

function evaluateSemanticVersion(fact, context) {
  const evidence = evidenceForFact(fact, context.evidencePack)[0];
  const requiresSemantic = !["footnote", "narrative", "ai-suggestion"].includes(fact.kind);
  const reportSemantic = semanticIdentity(fact.semanticRef);
  const evidenceSemantic = semanticIdentity(evidence?.semanticRef);
  if (requiresSemantic && (!reportSemantic?.resourceId || !reportSemantic?.version || !evidenceSemantic?.resourceId || !evidenceSemantic?.version)) {
    return statusResult("unverifiable", "SEMANTIC_IDENTITY_UNAVAILABLE", "the historical Published semantic identity cannot be located");
  }
  if (reportSemantic && evidenceSemantic && stableSerialize(reportSemantic) !== stableSerialize(evidenceSemantic)) {
    return statusResult("fail", "SEMANTIC_IDENTITY_MISMATCH", "report and evidence bind different semantic resources or versions");
  }
  if (evidence?.semanticRef?.deprecated === true && evidence?.semanticRef?.historicalResolvable !== false) {
    return statusResult("warning", "HISTORICAL_SEMANTIC_DEPRECATED", "historical semantic identity is still resolvable but is now deprecated");
  }
  const fixed = context.evidencePack.exactCombination;
  if (!fixed.semanticVersionId || !fixed.dataVersionId || !fixed.t019Id) {
    return statusResult("fail", "FIXED_VERSION_BINDING_INCOMPLETE", "the generation-time authority combination is incomplete");
  }
  if (context.currentContext.c017.dataVersionId !== fixed.dataVersionId || context.currentContext.c017.semanticVersionId !== fixed.semanticVersionId) {
    return statusResult("warning", "CURRENT_AUTHORITY_CHANGED", "current authority differs from the report generation snapshot; the fixed report remains unchanged");
  }
  return statusResult("pass", "SEMANTIC_VERSION_MATCH", "semantic identity and generation-time version binding are consistent");
}

function affectedByHardFailure(fact, summary) {
  const scope = summary.affectedScope;
  if (!summary.hardFailure && !["hard-fail", "failed", "失败"].includes(summary.qualityStatus)) return false;
  if (!scope) return null;
  const ids = Array.isArray(scope.factIds) ? scope.factIds : [];
  const evidenceIds = Array.isArray(scope.evidenceIds) ? scope.evidenceIds : [];
  if (ids.length === 0 && evidenceIds.length === 0) return null;
  return ids.includes(fact.factId) || fact.evidenceRefs.some((id) => evidenceIds.includes(id));
}

function evaluateTrustDisclosure(fact, context) {
  const summary = context.currentContext.c017;
  if (summary.status !== "ready" || summary.consumptionStatus !== "ready") {
    return statusResult("unverifiable", "CURRENT_TRUST_SUMMARY_UNAVAILABLE", "the verification-time C017 status summary is unavailable or not consumable");
  }
  if (!context.evidencePack.generationBindingSummary?.summaryId || !summary?.summaryId) {
    return statusResult("fail", "TRUST_SUMMARY_MISSING", "generation binding or verification-time current summary is missing");
  }
  const affected = affectedByHardFailure(fact, summary);
  if (affected === true) return statusResult("fail", "POST_QUALITY_HARD_FAILURE", "a confirmed post-publication hard quality failure affects this fact");
  if (affected === null) return statusResult("unverifiable", "QUALITY_IMPACT_UNKNOWN", "hard quality failure scope cannot be reliably mapped to this fact");
  if (["warning", "warn", "警告", "stale", "陈旧"].includes(summary.qualityStatus) || ["stale", "陈旧"].includes(summary.freshness?.status)) {
    return statusResult("warning", "TRUST_WARNING_DISCLOSED", "a non-blocking quality or freshness warning applies and remains disclosed");
  }
  return statusResult("pass", "TRUST_DISCLOSED", "generation and verification-time trust summaries are independently fixed and disclosed");
}

function evaluateRuleHumanBoundary(fact, context) {
  const evidence = evidenceForFact(fact, context.evidencePack)[0];
  if (fact.agentCalculated) return statusResult("fail", "AGENT_FORMAL_CALCULATION", "Agent-generated formal calculations are forbidden");
  const isRule = ["rule", "rule-result", "Rule 结论"].includes(fact.kind);
  const isSuggestion = ["ai-suggestion", "suggestion", "建议"].includes(fact.kind);
  if (!isRule && !isSuggestion) return { applicable: false };
  if (isSuggestion) {
    return fact.humanConfirmationRequired
      ? statusResult("pass", "HUMAN_BOUNDARY_PRESERVED", "AI suggestion remains explicitly subject to human confirmation")
      : statusResult("fail", "HUMAN_BOUNDARY_MISSING", "AI suggestion is not marked as requiring human confirmation");
  }
  const claim = claimForFact(fact, context.extraction);
  if (!claim || !evidence) return statusResult("unverifiable", "RULE_EVIDENCE_UNAVAILABLE", "fixed Rule evaluation or extracted conclusion is unavailable");
  const expected = expectedValue(evidence, fact);
  return stableSerialize(claim.observedValue) === stableSerialize(expected)
    ? statusResult("pass", "RULE_RESULT_MATCH", "Rule conclusion matches the fixed evaluation evidence")
    : statusResult("fail", "RULE_RESULT_MISMATCH", "Rule conclusion differs from the fixed evaluation evidence");
}

const EVALUATORS = Object.freeze({
  "evidence-binding": evaluateEvidenceBinding,
  "value-internal": evaluateValueInternal,
  "semantic-version": evaluateSemanticVersion,
  "trust-disclosure": evaluateTrustDisclosure,
  "rule-human-boundary": evaluateRuleHumanBoundary
});

function countsFor(results) {
  const applicable = results.filter((result) => result.applicability === "applicable");
  const completed = applicable.filter((result) => result.executionState === "completed");
  const counts = { planned: results.length, applicable: applicable.length, completed: completed.length, pending: applicable.filter((result) => result.executionState === "pending").length, executionErrors: applicable.filter((result) => result.executionState === "error").length, notApplicable: results.length - applicable.length };
  VERIFICATION_STATUSES.forEach((status) => { counts[status] = completed.filter((result) => result.status === status).length; });
  counts.warn = counts.warning;
  return counts;
}

function aggregateStatus(results, coverageStatus) {
  if (coverageStatus !== "complete") return "incomplete";
  const applicable = results.filter((result) => result.applicability === "applicable");
  if (!applicable.length) return "incomplete";
  return applicable.reduce((worst, result) => PRIORITY[result.status] > PRIORITY[worst] ? result.status : worst, "pass");
}

function groupSummaries(results) {
  return VERIFICATION_GROUPS.map((group) => {
    const items = results.filter((result) => result.groupId === group.groupId);
    const coverage = countsFor(items);
    return { groupId: group.groupId, name: group.name, checks: group.checks, checkTypes: GROUP_CHECK_ALIASES[group.groupId], coverage, status: aggregateStatus(items, coverage.pending || coverage.executionErrors ? "limited" : "complete") };
  });
}

function sectionSummaries(results) {
  const sections = [...new Set(results.map((result) => result.sectionId))];
  return sections.map((sectionId) => {
    const items = results.filter((result) => result.sectionId === sectionId);
    const coverage = countsFor(items);
    return { sectionId, coverage, status: aggregateStatus(items, "complete") };
  });
}

function runDeterministicVerification(input) {
  assertObject(input, "T049 verification input");
  const { contentVersion, evidencePack, anchors, extraction, currentContext, definition } = input;
  if (!sameScenarioRun(contentVersion.scenarioContext, currentContext.scenarioContext)) {
    fail("T049_CONTEXT_MISMATCH", "T049 current summary and content version belong to different scenario runs");
  }
  const context = {
    contentVersion,
    evidencePack,
    anchors,
    extraction,
    currentContext,
    definition,
    anchorById: new Map(anchors.map((anchor) => [anchor.t044Id, anchor]))
  };
  const scope = input.scope || { type: "whole-report" };
  const scopeFactIds = new Set(Array.isArray(scope.factIds) ? scope.factIds : []);
  const scopeSectionIds = new Set(Array.isArray(scope.sectionIds) ? scope.sectionIds : []);
  const scopeAnchorIds = new Set(Array.isArray(scope.t044Ids || scope.anchorIds) ? (scope.t044Ids || scope.anchorIds) : []);
  const scopedFacts = contentVersion.factInventory.filter((fact) => {
    if (scope.type === "whole-report" || (!scope.type && !scopeFactIds.size && !scopeSectionIds.size && !scopeAnchorIds.size)) return true;
    if (!scope.type && scopeFactIds.size) return scopeFactIds.has(fact.factId);
    if (scope.type === "facts" || scope.type === "fact") return scopeFactIds.has(fact.factId);
    if (scope.type === "sections" || scope.type === "section") return scopeSectionIds.has(fact.sectionId);
    if (scope.type === "anchors" || scope.type === "anchor") return fact.t044Ids.some((id) => scopeAnchorIds.has(id));
    return false;
  });
  if (!scopedFacts.length) fail("VERIFICATION_SCOPE_EMPTY", "verification scope does not select any fact items");
  const results = [];
  const executionErrors = new Set(Array.isArray(input.executionErrors) ? input.executionErrors : []);
  scopedFacts.forEach((fact) => {
    VERIFICATION_GROUPS.forEach((group) => {
      const evaluated = EVALUATORS[group.groupId](fact, context);
      const applicable = evaluated.applicable === false ? "not-applicable" : "applicable";
      const executionError = executionErrors.has(fact.factId) || executionErrors.has(group.groupId) || executionErrors.has(`${fact.factId}:${group.groupId}`);
      results.push({
        resultId: contentId("T049I", { runId: input.verificationRunId, factId: fact.factId, groupId: group.groupId }),
        verificationRunId: input.verificationRunId,
        groupId: group.groupId,
        groupName: group.name,
        checks: group.checks,
        checkTypes: GROUP_CHECK_ALIASES[group.groupId],
        checkType: group.groupId,
        checkName: group.name,
        applicability: applicable,
        executionState: applicable === "applicable" ? executionError ? "error" : "completed" : "not-applicable",
        status: applicable === "applicable" && !executionError ? evaluated.status : null,
        legacyStatus: applicable === "applicable" && !executionError ? evaluated.status === "warning" ? "warn" : evaluated.status : null,
        state: applicable === "applicable" && !executionError ? evaluated.status : null,
        statusLabel: applicable === "applicable" && !executionError ? STATUS_LABELS[evaluated.status] : executionError ? "执行异常" : "不适用",
        stateLabel: applicable === "applicable" && !executionError ? STATUS_LABELS[evaluated.status] : executionError ? "执行异常" : "不适用",
        code: executionError ? "EXECUTION_ERROR" : evaluated.code || "NOT_APPLICABLE",
        message: executionError ? "deterministic check execution failed before a four-state result was formed" : evaluated.message || "check group is not applicable to this fact",
        details: Object.fromEntries(Object.entries(evaluated).filter(([key]) => !["status", "code", "message", "applicable"].includes(key))),
        factId: fact.factId,
        sourceContentItemId: fact.sourceContentItemId,
        sectionId: fact.sectionId,
        t044Ids: fact.t044Ids,
        evidenceRefs: fact.evidenceRefs,
        contentVersionId: contentVersion.contentVersionId,
        evidencePackId: evidencePack.evidencePackId,
        verifiedAt: input.completedAt
      });
    });
  });
  contentVersion.contentItems
    .filter((item) => item.contentType !== "heading" && (!item.evidenceRefs || item.evidenceRefs.length === 0) && (!item.facts || item.facts.length === 0))
    .forEach((item) => {
      const group = VERIFICATION_GROUPS[0];
      results.push({
        resultId: contentId("T049I", { runId: input.verificationRunId, contentItemId: item.sourceContentItemId, groupId: group.groupId }),
        verificationRunId: input.verificationRunId,
        groupId: group.groupId,
        groupName: group.name,
        checks: group.checks,
        checkTypes: GROUP_CHECK_ALIASES[group.groupId],
        checkType: group.groupId,
        checkName: group.name,
        applicability: "applicable",
        executionState: "completed",
        status: "fail",
        state: "fail",
        statusLabel: STATUS_LABELS.fail,
        code: "UNBOUND_CONTENT",
        message: "rendered content item has no structured fact or fixed evidence binding",
        details: {},
        factId: null,
        sourceContentItemId: item.sourceContentItemId,
        sectionId: item.sectionId,
        t044Ids: [],
        evidenceRefs: [],
        contentVersionId: contentVersion.contentVersionId,
        evidencePackId: evidencePack.evidencePackId,
        verifiedAt: input.completedAt
      });
    });
  const coverage = countsFor(results);
  const factCoverage = {
    planned: contentVersion.factInventory.length,
    applicable: contentVersion.factInventory.length,
    covered: new Set(results.filter((result) => result.applicability === "applicable" && result.executionState === "completed").map((result) => result.factId)).size,
    anchorTotal: anchors.length,
    anchorCovered: new Set(results.flatMap((result) => result.t044Ids)).size
  };
  const complete = coverage.pending === 0 && coverage.executionErrors === 0 && factCoverage.covered === factCoverage.applicable
    && contentVersion.coverage.coverageRate >= definition.coveragePolicy.minimumRequiredCoverage;
  coverage.factTotal = factCoverage.planned;
  coverage.factCovered = factCoverage.covered;
  coverage.anchorTotal = factCoverage.anchorTotal;
  coverage.anchorCovered = factCoverage.anchorCovered;
  coverage.contentPlanned = contentVersion.coverage?.planned || 0;
  coverage.contentBound = contentVersion.coverage?.bound || 0;
  coverage.unboundContent = contentVersion.coverage?.unbound || 0;
  coverage.status = complete ? "complete" : "limited";
  const t049 = {
    schemaVersion: T049_SCHEMA_VERSION,
    contractId: "T049",
    verificationRunId: assertString(input.verificationRunId, "verificationRunId"),
    runId: input.verificationRunId,
    verificationResultId: `T049-RESULT-${input.verificationRunId}`,
    version: assertString(input.version || "1.0.0", "verification version"),
    scenarioContext: contentVersion.scenarioContext,
    reportAggregateId: contentVersion.reportAggregateId,
    contentVersionId: contentVersion.contentVersionId,
    factInventoryVersion: contentVersion.contentVersionId,
    bindingVersion: "1.0.0",
    ruleVersion: definition.verificationPolicy.rulesVersion,
    evidencePackRef: contentVersion.evidencePackRef,
    scope: { ...scope, factIds: scopedFacts.map((fact) => fact.factId) },
    missingSections: Array.isArray(contentVersion.missingSections) ? contentVersion.missingSections : [],
    unboundContentCount: Number(contentVersion.coverage?.unbound || 0),
    initiatedBy: assertString(input.initiatedBy, "T049.initiatedBy"),
    initiatedAt: assertString(input.initiatedAt, "T049.initiatedAt"),
    completedAt: assertString(input.completedAt, "T049.completedAt"),
    runStatus: "completed",
    coverageStatus: complete ? "complete" : "limited",
    coverage,
    factCoverage,
    status: aggregateStatus(results, complete ? "complete" : "limited"),
    statusLabel: STATUS_LABELS[aggregateStatus(results, complete ? "complete" : "limited")],
    groups: groupSummaries(results),
    sections: sectionSummaries(results),
    results,
    extractionRef: { extractionRunId: extraction.extractionRunId, extractionResultId: extraction.extractionResultId },
    generationRunId: contentVersion.sourceDraftRef.generationRunId,
    currentStatusSummaryRef: {
      summaryId: currentContext.c017.summaryId,
      version: currentContext.c017.version,
      formedAt: currentContext.c017.formedAt,
      readReceiptId: currentContext.c017.receipt.receiptId
    },
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
    generationBindingSummaryRef: evidencePack.generationBindingSummary,
    immutable: true
  };
  if ([t049.generationRunId, extraction.extractionRunId].includes(t049.verificationRunId)) {
    fail("RUN_ID_REUSED", "T049 Run must be independent from M05 generation and extraction Runs");
  }
  return immutableJson(t049);
}

function canConfirmOrPublish(t049, definition) {
  if (!t049 || t049.runStatus !== "completed" || t049.coverageStatus !== "complete" || t049.status === "incomplete") return false;
  if (t049.scope?.type && t049.scope.type !== "whole-report") return false;
  if (Array.isArray(t049.missingSections) && t049.missingSections.length) return false;
  if (Number(t049.unboundContentCount || 0) > 0) return false;
  if (["fail", "unverifiable"].includes(t049.status)) return false;
  return !(t049.status === "warning" && definition.verificationPolicy.warningBlocksPublication);
}

module.exports = Object.freeze({
  EXTRACTION_RESULT_SCHEMA_VERSION,
  T049_SCHEMA_VERSION,
  VERIFICATION_STATUSES,
  VERIFICATION_GROUPS,
  STATUS_LABELS,
  GROUP_CHECK_ALIASES,
  acceptM05Extraction,
  runDeterministicVerification,
  canConfirmOrPublish
});
