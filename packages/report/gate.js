"use strict";

const { fail } = require("./errors");
const {
  assertObject,
  assertString,
  assertScenarioRun,
  immutableJson,
  sameScenarioRun,
  nowIso,
  stableSerialize,
  sha256
} = require("./utils");

const GENERATION_GATE_SCHEMA_VERSION = "ofw.m06.generation-gate-read.v1";
const FIXED_CONTEXT_SCHEMA_VERSION = "ofw.m06.fixed-report-context.v1";
const GATE_STAGES = Object.freeze(["before-evidence", "after-evidence", "before-agent"]);
const LIVE_READ_MODE = "authoritative-current-read";

function resolveReader(provider, method, owner) {
  const reader = typeof provider === "function" ? provider : provider && provider[method];
  if (typeof reader !== "function") {
    fail("LIVE_OWNER_READER_REQUIRED", `${owner} ${method} reader is required; static C008/C017/T019 input is forbidden`);
  }
  return reader.bind(provider);
}

function normalizeReceipt(value, expectedOwner, label) {
  const source = value?.authoritativeRead || value?.readReceipt || value?.payload?.authoritativeRead || value?.payload?.readReceipt;
  assertObject(source, `${label}.authoritativeRead`);
  const receipt = {
    receiptId: assertString(source.receiptId, `${label}.authoritativeRead.receiptId`),
    owner: assertString(source.owner, `${label}.authoritativeRead.owner`),
    source: assertString(source.source, `${label}.authoritativeRead.source`),
    mode: assertString(source.mode, `${label}.authoritativeRead.mode`),
    readAt: assertString(source.readAt, `${label}.authoritativeRead.readAt`)
  };
  if (receipt.owner !== expectedOwner || receipt.source !== "owner-api" || receipt.mode !== LIVE_READ_MODE) {
    fail("NON_AUTHORITATIVE_INPUT", `${label} must come from a live ${expectedOwner} owner-api read`, { receipt });
  }
  if (source.static === true || source.fixture === true || source.seed === true || source.cached === true) {
    fail("STATIC_AUTHORITY_FORBIDDEN", `${label} static, fixture, seeded or cached authority values cannot pass a generation gate`);
  }
  if (Number.isNaN(Date.parse(receipt.readAt))) fail("INVALID_OWNER_READ_TIME", `${label} readAt is invalid`);
  return receipt;
}

function normalizeC008(value, scenarioContext, options = {}) {
  assertObject(value, "C008");
  const source = value.payload && typeof value.payload === "object" && !Array.isArray(value.payload)
    ? { ...value.payload, scenarioContext: value.payload.scenarioContext || value.scenarioContext, authoritativeRead: value.payload.authoritativeRead || value.authoritativeRead, readReceipt: value.payload.readReceipt || value.readReceipt }
    : value;
  assertScenarioRun(source.scenarioContext, scenarioContext, "C008.scenarioContext");
  const receipt = normalizeReceipt(source, "M01", "C008");
  const authority = source.currentAuthority || source.authoritativeCombination || source;
  const t019 = authority.t019 || {};
  const semantic = authority.publishedSemanticVersion || {};
  const data = authority.dataVersion || authority.data || {};
  const normalized = {
    c008Id: assertString(source.c008Id || source.id, "C008.c008Id"),
    version: assertString(source.version, "C008.version"),
    status: assertString(source.status, "C008.status"),
    consumptionStatus: assertString(source.consumptionReadiness?.status, "C008.consumptionReadiness.status"),
    t019Id: assertString(t019.id || authority.t019Id, "C008.t019.id"),
    t019Version: assertString(t019.version || authority.t019Version, "C008.t019.version"),
    t019Status: assertString(t019.status || authority.t019Status, "C008.t019.status"),
    semanticVersionId: assertString(semantic.id || authority.semanticVersionId, "C008.publishedSemanticVersion.id"),
    semanticVersion: assertString(semantic.version || authority.semanticVersion, "C008.publishedSemanticVersion.version"),
    dataVersionId: assertString(data.id || data.versionId || authority.dataVersionId, "C008.dataVersion.id"),
    t008: assertString(data.t008 || authority.t008, "C008.dataVersion.t008"),
    facts: Array.isArray(source.facts) ? source.facts : Array.isArray(source.factBundle?.items) ? source.factBundle.items : Array.isArray(authority.facts) ? authority.facts : [],
    previousAuthority: source.previousAuthority || authority.previousAuthority || null,
    candidates: Array.isArray(source.candidates) ? source.candidates : [],
    receipt
  };
  if (options?.allowUnavailable !== true && (normalized.status !== "ready" || normalized.consumptionStatus !== "ready" || !["published", "active"].includes(normalized.t019Status))) {
    fail("C008_NOT_CONSUMABLE", "C008 current authority is not ready for report generation", normalized);
  }
  return normalized;
}

function normalizeC017(value, scenarioContext, options = {}) {
  assertObject(value, "C017");
  const source = value.payload && typeof value.payload === "object" && !Array.isArray(value.payload)
    ? { ...value.payload, scenarioContext: value.payload.scenarioContext || value.scenarioContext, authoritativeRead: value.payload.authoritativeRead || value.authoritativeRead, readReceipt: value.payload.readReceipt || value.readReceipt }
    : value;
  assertScenarioRun(source.scenarioContext, scenarioContext, "C017.scenarioContext");
  const receipt = normalizeReceipt(source, "M02", "C017");
  const binding = source.binding || source.versionBinding || {};
  const quality = source.quality && typeof source.quality === "object"
    ? source.quality
    : { status: source.qualityStatus };
  const normalized = {
    summaryId: assertString(source.summaryId || source.id, "C017.summaryId"),
    version: assertString(source.version, "C017.version"),
    summaryType: assertString(source.summaryType || source.type, "C017.summaryType"),
    formedAt: assertString(source.formedAt, "C017.formedAt"),
    status: assertString(source.status, "C017.status"),
    consumptionStatus: assertString(source.consumptionReadiness?.status, "C017.consumptionReadiness.status"),
    semanticVersionId: assertString(binding.semanticVersionId, "C017.binding.semanticVersionId"),
    semanticVersion: assertString(binding.semanticVersion, "C017.binding.semanticVersion"),
    dataVersionId: assertString(binding.dataVersionId, "C017.binding.dataVersionId"),
    t008: assertString(binding.t008, "C017.binding.t008"),
    qualityStatus: assertString(quality.status, "C017.quality.status"),
    hardFailure: quality.hardFailure === true || ["hard-fail", "failed", "失败"].includes(quality.status),
    failureId: quality.failureId || null,
    affectedScope: quality.affectedScope || null,
    qualityFactAt: quality.factAt || null,
    confirmedAt: quality.confirmedAt || null,
    freshness: source.freshness || null,
    reproducibility: source.reproducibility || null,
    candidates: Array.isArray(source.candidates) ? source.candidates : [],
    previousDataVersion: source.previousDataVersion || null,
    receipt
  };
  if (options?.allowUnavailable !== true && (normalized.status !== "ready" || normalized.consumptionStatus !== "ready")) {
    fail("C017_NOT_CONSUMABLE", "C017 summary is not ready for report generation", normalized);
  }
  if (options.allowHardFailure !== true && (normalized.hardFailure || normalized.qualityStatus === "hard-fail")) {
    fail("POST_QUALITY_HARD_FAILURE", "the exact data version has a post-publication hard quality failure", normalized);
  }
  return normalized;
}

function exactCombination(value) {
  return {
    t019Id: value.t019Id,
    t019Version: value.t019Version,
    semanticVersionId: value.semanticVersionId,
    semanticVersion: value.semanticVersion,
    dataVersionId: value.dataVersionId,
    t008: value.t008
  };
}

function assertExactBinding(c008, c017) {
  const fields = ["semanticVersionId", "semanticVersion", "dataVersionId", "t008"];
  const mismatches = fields.filter((field) => c008[field] !== c017[field]);
  if (mismatches.length) {
    fail("C008_C017_BINDING_MISMATCH", "C008 and C017 do not describe the same exact authority combination", {
      mismatches,
      c008: Object.fromEntries(fields.map((field) => [field, c008[field]])),
      c017: Object.fromEntries(fields.map((field) => [field, c017[field]]))
    });
  }
}

async function readGenerationGate(input) {
  assertObject(input, "generation gate input");
  const stage = assertString(input.stage, "generation gate stage");
  if (!GATE_STAGES.includes(stage)) fail("INVALID_GATE_STAGE", `generation gate stage must be one of ${GATE_STAGES.join(", ")}`);
  const scenarioContext = assertScenarioRun(input.scenarioContext, null);
  const requestedAt = nowIso(input.clock);
  const request = immutableJson({
    scenarioContext,
    purpose: "M06-report-generation",
    stage,
    requestedAt,
    requestId: input.requestId || null,
    idempotencyKey: input.idempotencyKey || null
  });
  const c008Reader = resolveReader(input.c008Provider, "readCurrentC008", "M01");
  const c017Reader = resolveReader(input.c017Provider, "readCurrentC017", "M02");
  const [rawC008, rawC017] = await Promise.all([c008Reader(request), c017Reader(request)]);
  const c008 = normalizeC008(rawC008, scenarioContext);
  const c017 = normalizeC017(rawC017, scenarioContext);
  assertExactBinding(c008, c017);
  const seenReceipts = input.seenReceiptIds || new Set();
  [c008.receipt.receiptId, c017.receipt.receiptId].forEach((receiptId) => {
    if (seenReceipts.has(receiptId)) {
      fail("OWNER_READ_RECEIPT_REUSED", "each generation gate must perform a fresh Owner API read", { receiptId, stage });
    }
    seenReceipts.add(receiptId);
  });
  const gate = {
    schemaVersion: GENERATION_GATE_SCHEMA_VERSION,
    gateReadId: `GATE-${stage}-${sha256({ stage, requestedAt, receipts: [c008.receipt.receiptId, c017.receipt.receiptId] }).slice(0, 20)}`,
    stage,
    scenarioContext,
    requestedAt,
    completedAt: nowIso(input.clock),
    status: "passed",
    c008,
    c017,
    exactCombination: {
      ...exactCombination(c008),
      c017SummaryId: c017.summaryId,
      c017SummaryVersion: c017.version
    }
  };
  return immutableJson(gate);
}

function formFixedReportContext(input) {
  const reads = input?.gateReads;
  if (!Array.isArray(reads) || reads.length !== GATE_STAGES.length) {
    fail("INCOMPLETE_GENERATION_GATES", "all three generation gate reads are required");
  }
  GATE_STAGES.forEach((stage, index) => {
    if (reads[index]?.stage !== stage || reads[index]?.status !== "passed") {
      fail("INCOMPLETE_GENERATION_GATES", `generation gate ${stage} did not pass in order`);
    }
  });
  const scenarioContext = reads[0].scenarioContext;
  if (!reads.every((read) => sameScenarioRun(read.scenarioContext, scenarioContext))) {
    fail("SCENARIO_CONTEXT_MISMATCH", "generation gate reads belong to different scenario runs");
  }
  const first = stableSerialize(reads[0].exactCombination);
  if (!reads.every((read) => stableSerialize(read.exactCombination) === first)) {
    fail("AUTHORITY_CHANGED_DURING_GENERATION", "C008/T019 or exact data binding changed during generation preparation", {
      combinations: reads.map((read) => read.exactCombination)
    });
  }
  const context = {
    schemaVersion: FIXED_CONTEXT_SCHEMA_VERSION,
    fixedContextId: `FCTX-${sha256(reads.map((read) => read.gateReadId)).slice(0, 24)}`,
    scenarioContext,
    exactCombination: reads[0].exactCombination,
    generationBindingSummary: {
      summaryId: reads[2].c017.summaryId,
      version: reads[2].c017.version,
      formedAt: reads[2].c017.formedAt
    },
    c008Refs: reads.map((read) => ({ c008Id: read.c008.c008Id, version: read.c008.version, t019Id: read.c008.t019Id, t019Version: read.c008.t019Version, readReceiptId: read.c008.receipt.receiptId })),
    c017Refs: reads.map((read) => ({ summaryId: read.c017.summaryId, version: read.c017.version, formedAt: read.c017.formedAt, readReceiptId: read.c017.receipt.receiptId })),
    gateReadIds: reads.map((read) => read.gateReadId),
    fixedAt: reads[2].completedAt,
    immutable: true
  };
  return immutableJson(context);
}

async function readCurrentComparisonContext(input) {
  assertObject(input, "comparison context input");
  const scenarioContext = assertScenarioRun(input.scenarioContext, null);
  const requestedAt = nowIso(input.clock);
  const request = immutableJson({ scenarioContext, purpose: input.purpose || "M06-current-comparison", requestedAt });
  const c008Reader = resolveReader(input.c008Provider, "readCurrentC008", "M01");
  const c017Reader = resolveReader(input.c017Provider, "readCurrentC017", "M02");
  const [rawC008, rawC017] = await Promise.all([c008Reader(request), c017Reader(request)]);
  let c008;
  let c017;
  try {
    c008 = normalizeC008(rawC008, scenarioContext, { allowUnavailable: true });
  } catch (error) {
    const source = rawC008?.payload && typeof rawC008.payload === "object" ? { ...rawC008.payload, scenarioContext: rawC008.payload.scenarioContext || rawC008.scenarioContext, authoritativeRead: rawC008.payload.authoritativeRead || rawC008.authoritativeRead } : rawC008;
    assertScenarioRun(source?.scenarioContext, scenarioContext, "C008.scenarioContext");
    c008 = { c008Id: source?.c008Id || source?.id || "C008-UNAVAILABLE", version: source?.version || "unknown", status: source?.status || "unavailable", consumptionStatus: source?.consumptionReadiness?.status || "unavailable", t019Id: null, t019Version: null, t019Status: source?.t019Status || "unavailable", semanticVersionId: null, semanticVersion: null, dataVersionId: null, t008: null, facts: [], previousAuthority: source?.previousAuthority || null, candidates: Array.isArray(source?.candidates) ? source.candidates : [], receipt: normalizeReceipt(source, "M01", "C008") };
  }
  try {
    c017 = normalizeC017(rawC017, scenarioContext, { allowHardFailure: true, allowUnavailable: true });
  } catch (error) {
    const source = rawC017?.payload && typeof rawC017.payload === "object" ? { ...rawC017.payload, scenarioContext: rawC017.payload.scenarioContext || rawC017.scenarioContext, authoritativeRead: rawC017.payload.authoritativeRead || rawC017.authoritativeRead } : rawC017;
    assertScenarioRun(source?.scenarioContext, scenarioContext, "C017.scenarioContext");
    c017 = { summaryId: source?.summaryId || source?.id || "C017-UNAVAILABLE", version: source?.version || "unknown", summaryType: source?.summaryType || "current-status", formedAt: source?.formedAt || nowIso(input.clock), status: source?.status || "unavailable", consumptionStatus: source?.consumptionReadiness?.status || "unavailable", semanticVersionId: null, semanticVersion: null, dataVersionId: null, t008: null, qualityStatus: "unknown", hardFailure: false, failureId: null, affectedScope: null, qualityFactAt: null, confirmedAt: null, freshness: null, reproducibility: null, candidates: [], previousDataVersion: null, receipt: normalizeReceipt(source, "M02", "C017") };
  }
  if ([c008.semanticVersionId, c008.dataVersionId, c008.t008, c017.semanticVersionId, c017.dataVersionId, c017.t008].every((value) => value !== null && value !== undefined)) {
    assertExactBinding(c008, c017);
  }
  return immutableJson({ requestedAt, readAt: nowIso(input.clock), scenarioContext, c008, c017 });
}

module.exports = Object.freeze({
  GENERATION_GATE_SCHEMA_VERSION,
  FIXED_CONTEXT_SCHEMA_VERSION,
  GATE_STAGES,
  LIVE_READ_MODE,
  normalizeC008,
  normalizeC017,
  assertExactBinding,
  readGenerationGate,
  formFixedReportContext,
  readCurrentComparisonContext
});
