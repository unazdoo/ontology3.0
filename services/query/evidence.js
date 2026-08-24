'use strict';

const identity = require('../../packages/identity');
const foundation = require('./foundation-compat');
const { fail } = require('./errors');
const {
  isRecord,
  clone,
  deepFreeze,
  requiredString,
  assertDateTime,
  contextTriple,
  normalizeEvidenceRefs,
  fingerprint,
  nowIso,
  firstString
} = require('./utils');

const C010_SCHEMA_VERSION = 'ofw.m03.c010.result-fact.v1';
const C018_SCHEMA_VERSION = 'ofw.m03.c018.query-view.v1';
const C011_SCHEMA_VERSION = 'ofw.m03.c011.action-request.v1';
const FACT_STATUSES = Object.freeze(['completed', 'partial', 'not-answerable', 'failed']);
const FORBIDDEN_RESULT_KEYS = new Set(['workbook', 'rawData', 'sourceFields', 'physicalFields', 'sourceRows', 'sql', 'querySql', 'formula', 'pythonCode', 'memory', 'conversationMemory', 'externalKnowledge', 'latestVersion']);

function assertNoSourceFields(value, path = 'structuredResult', seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) fail('ERR_C010_RESULT_INVALID', `${path} contains a cyclic value`);
  seen.add(value);
  Object.keys(value).forEach((key) => {
    if (FORBIDDEN_RESULT_KEYS.has(key) || FORBIDDEN_RESULT_KEYS.has(key.toLowerCase())) {
      fail('ERR_C010_SOURCE_DATA_FORBIDDEN', `${path}.${key} is outside the semantic result contract`, { path: `${path}.${key}` });
    }
    assertNoSourceFields(value[key], `${path}.${key}`, seen);
  });
  seen.delete(value);
}

function itemId(item, fallback) {
  if (!isRecord(item)) return fallback;
  return firstString(item, ['resultItemId', 'metricId', 'ruleId', 'evidenceId', 'id', 'key']) || fallback;
}

function refsFor(item) {
  return normalizeEvidenceRefs(item?.evidenceRefs || item?.evidence || []);
}

function normalizeMapping(mapping) {
  const result = [];
  if (mapping && !Array.isArray(mapping) && isRecord(mapping)) {
    Object.entries(mapping).forEach(([id, refs]) => result.push({ resultItemId: id, evidenceRefs: normalizeEvidenceRefs(refs) }));
  } else if (Array.isArray(mapping)) {
    mapping.forEach((entry, index) => {
      if (!isRecord(entry)) fail('ERR_C010_EVIDENCE_INVALID', `evidenceMapping[${index}] must be an object`);
      const id = itemId(entry, null);
      if (!id) fail('ERR_C010_EVIDENCE_INVALID', `evidenceMapping[${index}] has no result item identity`);
      result.push({ resultItemId: id, evidenceRefs: refsFor(entry) });
    });
  }
  const seen = new Set();
  result.forEach((entry) => {
    if (seen.has(entry.resultItemId)) fail('ERR_C010_EVIDENCE_DUPLICATE', `evidence mapping repeats ${entry.resultItemId}`);
    seen.add(entry.resultItemId);
    if (!entry.evidenceRefs.length) fail('ERR_C010_EVIDENCE_MISSING', `result item ${entry.resultItemId} has no evidence reference`);
  });
  return result.sort((a, b) => a.resultItemId.localeCompare(b.resultItemId));
}

function deriveEvidenceMapping(structured) {
  if (!isRecord(structured)) fail('ERR_C010_RESULT_INVALID', 'structured result must be an object');
  const items = [];
  const rows = Array.isArray(structured.rows) ? structured.rows : [];
  rows.forEach((row, index) => items.push({ resultItemId: itemId(row, `row-${index + 1}`), evidenceRefs: refsFor(row) }));
  const metrics = Array.isArray(structured.metrics || structured.metricResults) ? (structured.metrics || structured.metricResults) : [];
  metrics.forEach((metric, index) => items.push({ resultItemId: itemId(metric, `metric-${index + 1}`), evidenceRefs: refsFor(metric) }));
  const rules = Array.isArray(structured.rules || structured.ruleResults) ? (structured.rules || structured.ruleResults) : [];
  rules.forEach((rule, index) => items.push({ resultItemId: itemId(rule, `rule-${index + 1}`), evidenceRefs: refsFor(rule) }));
  return normalizeMapping(items);
}

function mergeEvidenceMapping(structured, supplied) {
  const derived = deriveEvidenceMapping(structured);
  const provided = normalizeMapping(supplied);
  const byId = new Map(provided.map((entry) => [entry.resultItemId, entry]));
  derived.forEach((entry) => {
    const existing = byId.get(entry.resultItemId);
    if (!existing) byId.set(entry.resultItemId, entry);
    else if (!existing.evidenceRefs.length && entry.evidenceRefs.length) byId.set(entry.resultItemId, entry);
  });
  return normalizeMapping([...byId.values()]);
}

function normalizeT008(input) {
  if (typeof input === 'string' && input.trim()) return { id: input.trim(), value: input.trim(), evidenceRefs: [] };
  if (!isRecord(input)) fail('ERR_C010_T008_REQUIRED', 'T008 must be a fixed object');
  const id = firstString(input, ['id', 't008Id', 'evidenceId', 'version']) || null;
  const value = firstString(input, ['value', 'asOf', 'dataAsOf', 'through']) || null;
  if (!id || !value) fail('ERR_C010_T008_REQUIRED', 'T008 must include an exact id and value');
  return { id, value, timezone: firstString(input, ['timezone', 'timeZone', 'tz']) || null, precision: firstString(input, ['precision', 'granularity']) || null, evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs || input.evidence || []) };
}

function extractConfiguration(input) {
  const config = input.configSnapshot || input.configuration || input.config || input.result?.configuration || input.run?.result?.configuration
    || (isRecord(input) && (input.configVersion || input.configurationVersion) ? input : null);
  if (!isRecord(config)) fail('ERR_C010_CONFIG_REQUIRED', 'C010 must include the fixed C009 configuration snapshot');
  const configVersion = firstString(config, ['configVersion', 'configurationVersion', 'version']);
  const promptVersion = firstString(config, ['promptVersion', 'systemPromptVersion']) || firstString(config.prompt, ['version', 'promptVersion']);
  const skills = config.skillVersions || config.skillSet || config.skills;
  const tools = config.toolAllowlist || config.toolWhitelist || config.tools;
  if (!configVersion || !promptVersion || !Array.isArray(skills) || !Array.isArray(tools)) fail('ERR_C010_CONFIG_INCOMPLETE', 'C010 configuration snapshot is missing Prompt, Skill or Tool versions');
  const skillVersions = skills.map((skill, index) => {
    if (typeof skill === 'string' && skill.trim()) return { skillId: skill.trim(), version: skill.trim() };
    if (!isRecord(skill)) fail('ERR_C010_CONFIG_INCOMPLETE', `skills[${index}] is invalid`);
    return { skillId: firstString(skill, ['skillId', 'id', 'stableId']), version: firstString(skill, ['version', 'skillVersion']) };
  });
  const toolAllowlist = tools.map((tool, index) => {
    if (typeof tool === 'string' && tool.trim()) return { toolId: tool.trim(), version: tool.trim() };
    if (!isRecord(tool)) fail('ERR_C010_CONFIG_INCOMPLETE', `tools[${index}] is invalid`);
    return { toolId: firstString(tool, ['toolId', 'id', 'stableId']), version: firstString(tool, ['version', 'toolVersion']) };
  });
  if (skillVersions.some((item) => !item.skillId || !item.version) || toolAllowlist.some((item) => !item.toolId || !item.version)) {
    fail('ERR_C010_CONFIG_INCOMPLETE', 'every Skill and Tool must pin an actual version');
  }
  return {
    configId: firstString(config, ['configId', 'agentId', 'id']) || null,
    configVersion,
    promptVersion,
    skillVersions,
    toolAllowlist,
    toolAllowlistVersion: firstString(config, ['toolAllowlistVersion', 'toolWhitelistVersion', 'toolsVersion']) || null,
    publishedOntologyVersion: firstString(config, ['publishedOntologyVersion', 'publishedVersion', 'semanticVersion', 'ontologyVersion']),
    resourceWhitelist: clone(config.resourceWhitelist || config.resourceAllowlist || config.resources || []),
    resourceWhitelistVersion: firstString(config, ['resourceWhitelistVersion', 'resourceVersion']) || null,
    capabilityProof: clone(config.capabilityProof || null),
    fingerprint: config.fingerprint || null
  };
}

function extractVersions(input, plan, c008, c017) {
  const sourceResult = input.result || input.queryResult || input.run?.result || {};
  const semanticVersion = firstString(input, ['publishedOntologyVersion', 'publishedVersionId', 'semanticVersionId', 'publishedVersion', 'semanticVersion'])
    || firstString(sourceResult, ['publishedOntologyVersion', 'publishedVersionId', 'semanticVersionId', 'publishedVersion', 'semanticVersion'])
    || firstString(plan?.semantic, ['semanticVersionId', 'publishedVersionId', 'publishedSemanticVersion', 'publishedVersion'])
    || firstString(c008?.current, ['semanticVersionId', 'publishedSemanticVersion']);
  const dataVersion = firstString(input, ['dataVersion', 'consumableDataVersion', 'exactDataVersion'])
    || firstString(sourceResult, ['dataVersion', 'consumableDataVersion', 'exactDataVersion'])
    || firstString(plan?.data, ['dataVersion', 'consumableDataVersion'])
    || firstString(c008?.current, ['dataVersion', 'consumableDataVersion'])
    || firstString(c017, ['dataVersion', 'assetVersionId']);
  const t019Id = firstString(input, ['t019Id', 'bindingId']) || firstString(sourceResult, ['t019Id', 'bindingId']) || firstString(plan?.semantic, ['t019Id', 'bindingId']) || firstString(c008?.current, ['t019Id']);
  const t019Version = firstString(input, ['t019Version', 'bindingVersion']) || firstString(sourceResult, ['t019Version', 'bindingVersion']) || firstString(plan?.semantic, ['t019Version']) || firstString(c008?.current, ['bindingVersion']);
  if (!semanticVersion || !dataVersion || !t019Id) fail('ERR_C010_VERSION_CONTEXT_MISSING', 'C010 must pin Published, T019 and exact data versions');
  return { publishedOntologyVersion: semanticVersion, dataVersion, t019Id, t019Version };
}

function extractQuality(c017, input) {
  const quality = clone(input.quality || c017?.quality || null);
  const freshness = clone(input.freshness || c017?.freshness || null);
  if (!isRecord(quality) || !firstString(quality, ['status', 'qualityStatus', 'state'])) fail('ERR_C010_QUALITY_MISSING', 'C010 must include quality status');
  if (!isRecord(freshness) || !firstString(freshness, ['status', 'freshnessStatus', 'state'])) fail('ERR_C010_FRESHNESS_MISSING', 'C010 must include freshness status');
  quality.status = firstString(quality, ['status', 'qualityStatus', 'state']);
  freshness.status = firstString(freshness, ['status', 'freshnessStatus', 'state']);
  const sharedEvidence = normalizeEvidenceRefs(c017?.evidence || c017?.evidenceRefs || []);
  if (!quality.evidenceRefs?.length && sharedEvidence.length) quality.evidenceRefs = sharedEvidence;
  if (!freshness.evidenceRefs?.length && sharedEvidence.length) freshness.evidenceRefs = sharedEvidence;
  return { quality, freshness };
}

function createResultFact(input = {}) {
  const run = input.run || input.queryRun || null;
  const context = contextTriple(input.scenarioContext || run?.scenarioContext);
  const historicalFact = Boolean(input.resultId || input.fingerprint || input.result?.resultId || input.result?.fingerprint || run?.resultId);
  if (!['active', 'running', 'ready', 'pending', 'restored', 'regression'].includes(String(context.status || '').toLowerCase()) && !historicalFact) fail('ERR_C010_CONTEXT_INVALID', 'C010 cannot be formed for a closed or unknown scenario run', { status: context.status });
  const plan = input.plan || run?.plan || null;
  const sourceResult = input.result || run?.result || {};
  const blockedSource = ['not-answerable', 'blocked', 'failed'].includes(String(input.status || sourceResult.status || '').toLowerCase()) || Boolean(input.notAnswerableReason || sourceResult.notAnswerableReason);
  const nestedResult = input.result?.contractCode === 'C010' && input.result.structuredResult ? input.result.structuredResult : input.result;
  const structured = input.structuredResult || nestedResult || run?.result?.structuredResult
    || (blockedSource ? { rows: [], metrics: [], rules: [], empty: true, blocked: true, evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs || []) } : null);
  if (!isRecord(structured)) fail('ERR_C010_RESULT_REQUIRED', 'C010 must include a fixed structured result');
  assertNoSourceFields(structured);
  const config = extractConfiguration(input);
  const c008Snapshot = input.c008 || run?.c008 || run?.c008Snapshot;
  const c017Snapshot = input.c017 || run?.c017 || run?.c017Snapshot;
  const versions = extractVersions(input, plan, c008Snapshot, c017Snapshot);
  const expectedSemantic = firstString(plan?.semantic, ['semanticVersionId', 'publishedVersionId']) || firstString(c008Snapshot?.current, ['semanticVersionId']);
  const expectedData = firstString(plan?.data, ['dataVersion']) || firstString(c008Snapshot?.current, ['dataVersion']) || firstString(c017Snapshot, ['dataVersion', 'assetVersionId']);
  if (expectedSemantic && versions.publishedOntologyVersion !== expectedSemantic) fail('ERR_C010_VERSION_MISMATCH', 'C010 Published version sources disagree', { expected: expectedSemantic, actual: versions.publishedOntologyVersion });
  if (expectedData && versions.dataVersion !== expectedData) fail('ERR_C010_VERSION_MISMATCH', 'C010 data version sources disagree', { expected: expectedData, actual: versions.dataVersion });
  const publishedDisplayVersion = firstString(input, ['publishedSemanticVersion', 'publishedVersion', 'semanticVersion'])
    || firstString(input.result || run?.result, ['publishedSemanticVersion', 'publishedVersion', 'semanticVersion'])
    || firstString(plan?.semantic, ['publishedSemanticVersion', 'publishedVersion'])
    || versions.publishedOntologyVersion;
  const t008 = normalizeT008(input.t008 || input.result?.t008 || run?.result?.t008 || plan?.data?.t008 || c017Snapshot?.t008);
  if (!t008.evidenceRefs.length) {
    t008.evidenceRefs = normalizeEvidenceRefs(input.t008Evidence || input.result?.t008Evidence || run?.result?.t008Evidence || plan?.data?.t008Evidence || []);
  }
  if (!t008.evidenceRefs.length) fail('ERR_C010_T008_EVIDENCE_REQUIRED', 'T008 must include a stable evidence reference');
  const generatedAt = input.generatedAt || run?.result?.generatedAt || run?.completedAt;
  assertDateTime(generatedAt, 'generatedAt');
  const evidenceMapping = mergeEvidenceMapping(structured, input.evidenceMapping || structured.evidenceMapping);
  if (structured.empty === true) {
    const existingEmpty = evidenceMapping.find((entry) => entry.resultItemId === 'RESULT_SET');
    const emptyRefs = existingEmpty?.evidenceRefs?.length
      ? existingEmpty.evidenceRefs
      : normalizeEvidenceRefs(input.evidenceRefs || structured.evidenceRefs || []);
    if (!emptyRefs.length && !blockedSource) fail('ERR_C010_EVIDENCE_MISSING', 'an empty semantic result requires a locatable evidence reference');
    if (!existingEmpty) evidenceMapping.push({ resultItemId: 'RESULT_SET', evidenceRefs: emptyRefs });
  }
  const requestedStatus = input.status || sourceResult.status || (input.notAnswerableReason || input.unanswerableReason ? 'not-answerable' : 'completed');
  const normalizedRequestedStatus = String(requestedStatus).toLowerCase();
  const status = normalizedRequestedStatus === 'blocked' ? 'not-answerable' : normalizedRequestedStatus;
  if (!FACT_STATUSES.includes(status)) fail('ERR_C010_STATUS_INVALID', 'C010 status is not recognized', { status });
  const notAnswerableReason = input.notAnswerableReason || input.unanswerableReason || sourceResult.notAnswerableReason || sourceResult.unanswerableReason || sourceResult.failure || (Array.isArray(sourceResult.unanswerableReasons) ? sourceResult.unanswerableReasons : null) || null;
  if (status === 'not-answerable' && !notAnswerableReason) fail('ERR_C010_REASON_REQUIRED', 'not-answerable C010 results require a reason');
  if (['completed', 'partial'].includes(status) && !evidenceMapping.length && structured.empty !== true) fail('ERR_C010_EVIDENCE_MISSING', 'answerable C010 result must include evidence mappings');
  const { quality, freshness } = extractQuality(input.c017 || c017Snapshot || input.result || run?.result, input);
  const qualityToken = String(quality.status || '').toLowerCase();
  const freshnessToken = String(freshness.status || '').toLowerCase();
  const qualityBlocked = quality.hardFailure === true || ['unknown', 'failed', 'hard-failed', 'quality-failed', 'pending', 'running', 'processing'].includes(qualityToken) || qualityToken.includes('失败');
  const freshnessBlocked = ['unknown', 'failed', 'pending', 'running', 'processing', 'refreshing'].includes(freshnessToken);
  if (['completed', 'partial'].includes(status) && (qualityBlocked || freshnessBlocked)) {
    fail('ERR_C010_QUALITY_BLOCKED', 'answerable C010 results cannot be formed from unknown or failed quality/freshness state', { quality: quality.status, freshness: freshness.status });
  }
  if (['completed', 'partial'].includes(status) && (!normalizeEvidenceRefs(quality.evidenceRefs || quality.evidence || []).length || !normalizeEvidenceRefs(freshness.evidenceRefs || freshness.evidence || []).length)) {
    fail('ERR_C010_QUALITY_EVIDENCE_MISSING', 'answerable C010 results require quality and freshness evidence references');
  }
  const contextEvidence = [
    { resultItemId: 'T008', evidenceRefs: t008.evidenceRefs },
    { resultItemId: 'QUALITY', evidenceRefs: normalizeEvidenceRefs(quality.evidenceRefs || quality.evidence || []) },
    { resultItemId: 'FRESHNESS', evidenceRefs: normalizeEvidenceRefs(freshness.evidenceRefs || freshness.evidence || []) }
  ].filter((entry) => entry.evidenceRefs.length);
  const mappingIds = new Set(evidenceMapping.map((entry) => entry.resultItemId));
  contextEvidence.forEach((entry) => { if (!mappingIds.has(entry.resultItemId)) evidenceMapping.push(entry); });
  evidenceMapping.sort((left, right) => left.resultItemId.localeCompare(right.resultItemId));
  const fact = {
    schemaVersion: C010_SCHEMA_VERSION,
    contractCode: 'C010',
    resultId: input.resultId || null,
    resultVersion: input.resultVersion || '1',
    status,
    answerable: status === 'completed' || status === 'partial',
    deterministic: true,
    scenarioContext: context,
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId,
    originalQuestion: input.originalQuestion || plan?.originalQuestion || input.query?.originalQuestion || null,
    finalUnderstanding: input.finalUnderstanding || plan?.finalUnderstanding || null,
    query: clone(input.query || plan?.query || null),
    plan: clone(plan),
    configuration: config,
    configVersion: config.configVersion,
    promptVersion: config.promptVersion,
    skillVersions: clone(config.skillVersions),
    toolAllowlist: clone(config.toolAllowlist),
    toolAllowlistVersion: config.toolAllowlistVersion || null,
    publishedOntologyVersion: versions.publishedOntologyVersion,
    publishedSemanticVersion: publishedDisplayVersion,
    publishedVersion: versions.publishedOntologyVersion,
    publishedVersionId: versions.publishedOntologyVersion,
    t019Id: versions.t019Id,
    t019Version: versions.t019Version,
    dataVersion: versions.dataVersion,
    t008,
    structuredResult: clone(structured),
    evidenceMapping,
    quality,
    freshness,
    notAnswerableReason: clone(notAnswerableReason),
    generatedAt,
    sourceRunId: input.sourceRunId || run?.runId || null,
    retryOf: input.retryOf || run?.retryOf || null
  };
  if (fact.query) assertNoSourceFields(fact.query, 'query');
  if (['completed', 'partial'].includes(status) && (!fact.originalQuestion || !fact.finalUnderstanding)) {
    fail('ERR_C010_QUERY_UNDERSTANDING_MISSING', 'answerable C010 results require the original question and final understanding');
  }
  const body = clone(fact);
  delete body.resultId;
  fact.resultId = fact.resultId || `C010-${fingerprint(body).slice(0, 32)}`;
  const fingerprintInput = clone(fact);
  delete fingerprintInput.resultId;
  fact.fingerprint = fingerprint(fingerprintInput);
  return deepFreeze(fact);
}

function validateResultFact(fact, options = {}) {
  try {
    const suppliedFingerprint = fact && fact.fingerprint;
    const suppliedResultId = fact && fact.resultId;
    const normalized = createResultFact(fact);
    if (suppliedFingerprint && suppliedFingerprint !== normalized.fingerprint) fail('ERR_C010_INTEGRITY_MISMATCH', 'C010 fingerprint does not match its fixed payload');
    if (suppliedResultId && suppliedResultId !== normalized.resultId) fail('ERR_C010_INTEGRITY_MISMATCH', 'C010 resultId does not match its fixed payload');
    if (options.scenarioContext) {
      const expected = contextTriple(options.scenarioContext);
      if (normalized.scenarioContext.scenarioId !== expected.scenarioId || normalized.scenarioRunId !== expected.scenarioRunId || normalized.scenarioContext.scenarioVersion !== expected.scenarioVersion) fail('ERR_C010_CONTEXT_MISMATCH', 'C010 result belongs to another scenario run');
    }
    if (options.publishedOntologyVersion && normalized.publishedOntologyVersion !== options.publishedOntologyVersion) fail('ERR_C010_VERSION_MISMATCH', 'C010 Published version differs from expected');
    if (options.dataVersion && normalized.dataVersion !== options.dataVersion) fail('ERR_C010_VERSION_MISMATCH', 'C010 data version differs from expected');
    return { valid: true, value: normalized, errors: [] };
  } catch (error) {
    return { valid: false, value: null, errors: [{ code: error.code || 'ERR_C010', message: error.message, details: error.details }] };
  }
}

function assertResultFact(fact, options = {}) {
  const result = validateResultFact(fact, options);
  if (!result.valid) fail(result.errors[0].code, result.errors[0].message, result.errors[0].details);
  return result.value;
}

function csvValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvEscape(value) {
  const text = csvValue(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function createCsv(factInput) {
  const fact = assertResultFact(factInput);
  if (!fact.answerable || !fact.structuredResult) fail('ERR_C018_CSV_BLOCKED', 'CSV is unavailable for a blocked result');
  if (fact.structuredResult.empty === true) fail('ERR_C018_CSV_BLOCKED', 'CSV is unavailable for a true empty semantic result');
  if (!fact.evidenceMapping.length && fact.structuredResult.empty !== true) fail('ERR_C018_CSV_EVIDENCE_MISSING', 'CSV requires evidence for every result item');
  const baseRows = Array.isArray(fact.structuredResult.rows) ? fact.structuredResult.rows : [];
  const rows = baseRows.length ? baseRows : [
    ...(Array.isArray(fact.structuredResult.metrics || fact.structuredResult.metricResults) ? (fact.structuredResult.metrics || fact.structuredResult.metricResults).map((metric) => ({ ...metric, resultItemId: itemId(metric, 'metric'), recordType: 'metric' })) : []),
    ...(Array.isArray(fact.structuredResult.rules || fact.structuredResult.ruleResults) ? (fact.structuredResult.rules || fact.structuredResult.ruleResults).map((rule) => ({ ...rule, resultItemId: itemId(rule, 'rule'), recordType: 'rule' })) : [])
  ];
  const declared = Array.isArray(fact.structuredResult.columns) ? fact.structuredResult.columns.map((item) => typeof item === 'string' ? item : item.id || item.key).filter(Boolean) : [];
  const forbidden = new Set(['sourceFields', 'physicalFields', 'workbook', 'rawData', 'sql', 'formula']);
  const discovered = new Set();
  rows.forEach((row) => Object.keys(row || {}).forEach((key) => { if (!forbidden.has(key) && key !== 'evidenceRefs') discovered.add(key); }));
  const businessColumns = [...new Set([...declared, ...discovered])].filter((key) => !forbidden.has(key));
  const fixedColumns = ['scenarioRunId', 'resultId', 'publishedOntologyVersion', 'dataVersion', 't008', 'generatedAt', 'qualityStatus', 'freshnessStatus', 'evidenceIds'];
  const columns = [...fixedColumns.slice(0, -1), ...businessColumns.filter((key) => !fixedColumns.includes(key)), fixedColumns[fixedColumns.length - 1]];
  const lines = [columns.map(csvEscape).join(',')];
  const mapById = new Map(fact.evidenceMapping.map((entry) => [entry.resultItemId, entry]));
  rows.forEach((row, index) => {
    const id = itemId(row, `row-${index + 1}`);
    const mapping = mapById.get(id);
    if (!mapping || !mapping.evidenceRefs.length) fail('ERR_C018_CSV_EVIDENCE_MISSING', `CSV row ${id} has no evidence mapping`);
    const values = [fact.scenarioRunId, fact.resultId, fact.publishedOntologyVersion, fact.dataVersion, fact.t008.value, fact.generatedAt, fact.quality.status || '', fact.freshness.status || '', ...businessColumns.map((key) => row?.[key]), mapping.evidenceRefs.map((ref) => ref.evidenceId).join('|')];
    lines.push(values.map(csvEscape).join(','));
  });
  return deepFreeze({ schemaVersion: 'ofw.m03.c018.csv.v1', resultId: fact.resultId, rowCount: rows.length, columns, content: `${lines.join('\r\n')}\r\n`, generatedAt: fact.generatedAt, sourceFingerprint: fact.fingerprint });
}

function createQueryView(input = {}) {
  const fact = assertResultFact(input.result || input.fact || input.c010);
  if (!fact.answerable) fail('ERR_C018_VIEW_BLOCKED', 'C018 query views require an answerable fixed result');
  const queryDefinition = clone(input.queryDefinition || fact.query || { originalQuestion: fact.originalQuestion, finalUnderstanding: fact.finalUnderstanding });
  const displayPreferences = clone(input.displayPreferences || input.presentation || {});
  assertNoSourceFields(queryDefinition, 'C018.queryDefinition');
  assertNoSourceFields(displayPreferences, 'C018.displayPreferences');
  const view = {
    schemaVersion: C018_SCHEMA_VERSION,
    contractCode: 'C018',
    viewId: input.viewId || null,
    viewVersion: input.viewVersion || '1',
    scenarioContext: fact.scenarioContext,
    queryDefinition,
    displayPreferences,
    sourceResultId: fact.resultId,
    sourceResultFingerprint: fact.fingerprint,
    resultSummary: {
      status: fact.status,
      answerable: fact.answerable,
      rowCount: Array.isArray(fact.structuredResult.rows) ? fact.structuredResult.rows.length : 0,
      metricCount: Array.isArray(fact.structuredResult.metrics || fact.structuredResult.metricResults) ? (fact.structuredResult.metrics || fact.structuredResult.metricResults).length : 0,
      ruleCount: Array.isArray(fact.structuredResult.rules || fact.structuredResult.ruleResults) ? (fact.structuredResult.rules || fact.structuredResult.ruleResults).length : 0
    },
    publishedOntologyVersion: fact.publishedOntologyVersion,
    dataVersion: fact.dataVersion,
    t008: fact.t008,
    quality: fact.quality,
    freshness: fact.freshness,
    evidenceRefs: fact.evidenceMapping.flatMap((entry) => entry.evidenceRefs),
    createdAt: input.createdAt || fact.generatedAt,
    updatedAt: input.updatedAt || fact.generatedAt,
    fixed: true
  };
  assertDateTime(view.createdAt, 'createdAt');
  assertDateTime(view.updatedAt, 'updatedAt');
  view.viewId = view.viewId || `C018-${fingerprint({ queryDefinition, displayPreferences, sourceResultId: fact.resultId }).slice(0, 32)}`;
  return deepFreeze(view);
}

function validateQueryView(value) {
  try {
    if (!isRecord(value) || value.contractCode !== 'C018') fail('ERR_C018_INVALID', 'C018 view must be a stable query view');
    ['viewId', 'sourceResultId', 'publishedOntologyVersion', 'dataVersion'].forEach((key) => {
      if (!firstString(value, [key])) fail('ERR_C018_INVALID', `C018.${key} is required`);
    });
    contextTriple(value.scenarioContext);
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code || 'ERR_C018_INVALID', message: error.message, details: error.details }] };
  }
}

class QueryViewRegistry {
  constructor(options = {}) {
    this.records = options.records instanceof Map ? new Map(options.records) : new Map();
  }

  save(input) {
    const view = createQueryView(input);
    const existing = this.records.get(view.viewId);
    if (existing) {
      if (existing.sourceResultFingerprint !== view.sourceResultFingerprint || fingerprint(existing.queryDefinition) !== fingerprint(view.queryDefinition) || fingerprint(existing.displayPreferences) !== fingerprint(view.displayPreferences)) {
        fail('ERR_C018_VIEW_CONFLICT', 'viewId identifies a different query definition or fixed result');
      }
      return { status: 'duplicate', view: existing };
    }
    this.records.set(view.viewId, view);
    return { status: 'created', view };
  }

  get(viewId) { return this.records.get(viewId) || null; }

  list() { return [...this.records.values()]; }
}

function buildC011Request(input = {}) {
  const fact = assertResultFact(input.result || input.fact || input.c010);
  if (!['active', 'running', 'ready', 'pending', 'restored', 'regression'].includes(String(fact.scenarioContext.status || '').toLowerCase())) fail('ERR_C011_CONTEXT_INVALID', 'historical/closed results cannot create a new C011 request');
  if (!fact.answerable || fact.status !== 'completed') fail('ERR_C011_NOT_ELIGIBLE', 'C011 requires a completed answerable C010 result');
  const target = input.target || input.subject;
  if (!isRecord(target)) fail('ERR_C011_TARGET_REQUIRED', 'C011 requires one stable target subject');
  assertNoSourceFields(target, 'target');
  const targetId = firstString(target, ['stableId', 'subjectId', 'objectId', 'id']);
  if (!targetId) fail('ERR_C011_TARGET_REQUIRED', 'C011 target must have a stable identity');
  const actionType = input.actionType || {};
  assertNoSourceFields(actionType, 'actionType');
  const actionTypeId = typeof actionType === 'string' ? actionType : firstString(actionType, ['actionTypeId', 'stableId', 'id']);
  if (!actionTypeId) fail('ERR_C011_ACTION_TYPE_REQUIRED', 'C011 requires a stable Published Action Type');
  if (isRecord(actionType)) {
    const lifecycle = String(actionType.status || actionType.lifecycleStatus || actionType.publicationStatus || 'PUBLISHED').toUpperCase();
    if (lifecycle !== 'PUBLISHED') fail('ERR_C011_ACTION_TYPE_NOT_PUBLISHED', 'C011 Action Type must be Published', { status: lifecycle });
    const actionVersion = firstString(actionType, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion']);
    if (actionVersion && actionVersion !== fact.publishedOntologyVersion) fail('ERR_C011_VERSION_MISMATCH', 'Action Type does not belong to the fixed Published ontology version', { expected: fact.publishedOntologyVersion, actual: actionVersion });
  }
  const allowedActionTypes = Array.isArray(fact.configuration.resourceWhitelist) ? fact.configuration.resourceWhitelist.map((item) => typeof item === 'string' ? item : item.resourceId || item.id).filter(Boolean) : [];
  if (!allowedActionTypes.length || !allowedActionTypes.includes(actionTypeId)) fail('ERR_C011_ACTION_TYPE_NOT_ALLOWED', 'Action Type is outside the C009 resource whitelist', { actionTypeId });
  const configuredAction = Array.isArray(fact.configuration.resourceWhitelist)
    ? fact.configuration.resourceWhitelist.find((item) => (typeof item === 'string' ? item : item.resourceId || item.id) === actionTypeId)
    : null;
  const configuredActionVersion = isRecord(configuredAction) ? firstString(configuredAction, ['version', 'resourceVersion', 'publishedVersion']) : null;
  const actualActionVersion = isRecord(actionType) ? firstString(actionType, ['publishedVersionId', 'semanticVersionId', 'version']) : null;
  if (configuredActionVersion && actualActionVersion !== configuredActionVersion) fail('ERR_C011_VERSION_MISMATCH', 'Action Type must pin its exact Published resource version', { expected: configuredActionVersion, actual: actualActionVersion || null });
  const rules = Array.isArray(fact.structuredResult.rules || fact.structuredResult.ruleResults) ? (fact.structuredResult.rules || fact.structuredResult.ruleResults) : [];
  const rule = input.rule || rules.find((candidate) => String(candidate.status || candidate.outcome || '').toLowerCase() === 'hit');
  if (!isRecord(rule)) fail('ERR_C011_RULE_REQUIRED', 'C011 requires a Rule hit');
  assertNoSourceFields(rule, 'rule');
  const ruleStatus = String(rule.status || rule.outcome || '').toLowerCase();
  if (!['hit', 'true'].includes(ruleStatus) || !firstString(rule, ['ruleVersion', 'version', 'publishedVersion'])) fail('ERR_C011_RULE_REQUIRED', 'C011 Rule must be a versioned hit');
  const ruleSemanticVersion = firstString(rule, ['publishedOntologyVersion', 'semanticVersion', 'ontologyVersion']);
  if (ruleSemanticVersion && ruleSemanticVersion !== fact.publishedOntologyVersion) fail('ERR_C011_VERSION_MISMATCH', 'Rule is not from the fixed Published ontology version', { expected: fact.publishedOntologyVersion, actual: ruleSemanticVersion });
  const evidenceRefs = normalizeEvidenceRefs([
    ...(input.evidenceRefs || []),
    ...(rule.evidenceRefs || []),
    ...fact.evidenceMapping.flatMap((entry) => entry.evidenceRefs || [])
  ]);
  if (!evidenceRefs.length) fail('ERR_C011_EVIDENCE_REQUIRED', 'C011 requires fixed evidence references');
  const requestId = input.requestId || `ACTION-${fingerprint({ resultId: fact.resultId, targetId, actionTypeId, ruleId: itemId(rule, 'rule') }).slice(0, 24)}`;
  const idempotencyInput = {
    scenarioContext: {
      scenarioId: fact.scenarioContext.scenarioId,
      scenarioVersion: fact.scenarioContext.scenarioVersion,
      scenarioRunId: fact.scenarioContext.scenarioRunId
    },
    requestId,
    targetId,
    actionTypeId,
    ruleId: itemId(rule, 'rule'),
    publishedOntologyVersion: fact.publishedOntologyVersion,
    dataVersion: fact.dataVersion,
    t019Version: fact.t019Version || null
  };
  const idempotencyKey = input.idempotencyKey || identity.generateIdempotencyKey(idempotencyInput, { fields: Object.keys(idempotencyInput) });
  if (!identity.validateIdempotencyKey(idempotencyKey).valid) fail('ERR_C011_IDEMPOTENCY_INVALID', 'C011 idempotency key is invalid');
  return deepFreeze({
    schemaVersion: C011_SCHEMA_VERSION,
    contractCode: 'C011',
    requestId,
    idempotencyKey,
    scenarioContext: fact.scenarioContext,
    scenarioId: fact.scenarioContext.scenarioId,
    scenarioVersion: fact.scenarioContext.scenarioVersion,
    scenarioRunId: fact.scenarioRunId,
    sourceModule: 'M03',
    sourceResultId: fact.resultId,
    sourceResultFingerprint: fact.fingerprint,
    target: clone(target),
    targetStableId: targetId,
    actionType: clone(actionType),
    actionTypeId,
    rule: clone(rule),
    metricSnapshot: clone(input.metricSnapshot || fact.structuredResult.metrics || fact.structuredResult.metricResults || []),
    publishedOntologyVersion: fact.publishedOntologyVersion,
    dataVersion: fact.dataVersion,
    t019Id: fact.t019Id,
    t019Version: fact.t019Version || null,
    t008: fact.t008,
    configVersion: fact.configuration.configVersion,
    promptVersion: fact.configuration.promptVersion,
    skillVersions: clone(fact.configuration.skillVersions),
    toolAllowlist: clone(fact.configuration.toolAllowlist),
    toolAllowlistVersion: fact.configuration.toolAllowlistVersion || null,
    quality: clone(fact.quality),
    freshness: clone(fact.freshness),
    evidenceRefs,
    requestedAt: input.requestedAt || nowIso(),
    status: 'pending',
    createsDecision: false,
    createsTodo: false,
    sendsNotification: false,
    m03CreatesDecision: false,
    m03CreatesTodo: false,
    m03SendsNotification: false
  });
}

function validateC011Request(value) {
  try {
    if (!isRecord(value) || value.contractCode !== 'C011') fail('ERR_C011_INVALID', 'C011 request must be a standard C011 object');
    ['requestId', 'idempotencyKey', 'scenarioRunId', 'targetStableId', 'actionTypeId', 'publishedOntologyVersion', 'dataVersion', 't019Id', 'requestedAt'].forEach((key) => {
      if (!firstString(value, [key])) fail('ERR_C011_INVALID', `C011.${key} is required`);
    });
    const context = contextTriple(value.scenarioContext);
    if (context.scenarioRunId !== value.scenarioRunId) fail('ERR_C011_CONTEXT_MISMATCH', 'C011 scenarioRunId must match its C033 context');
    if (!Array.isArray(value.evidenceRefs) || !value.evidenceRefs.length) fail('ERR_C011_EVIDENCE_REQUIRED', 'C011 requires evidence references');
    if (value.createsDecision !== false || value.createsTodo !== false || value.sendsNotification !== false) fail('ERR_C011_INVALID', 'M03 C011 request cannot create decision side effects');
    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code || 'ERR_C011_INVALID', message: error.message, details: error.details }] };
  }
}

function assertC011Request(value) {
  const result = validateC011Request(value);
  if (!result.valid) fail(result.errors[0].code, result.errors[0].message, result.errors[0].details);
  return deepFreeze(clone(value));
}

function submitC011(requestInput, submitter, seen) {
  const request = buildC011Request(requestInput);
  const envelope = isRecord(requestInput) && (requestInput.includeEnvelope === true || requestInput.envelopeOptions)
    ? foundation.createC011Envelope(request, requestInput.envelopeOptions || {})
    : null;
  const duplicate = identity.identifyDuplicateRequest(request, seen, {
    fields: [
      'contractCode', 'schemaVersion', 'requestId', 'scenarioContext', 'scenarioRunId',
      'sourceResultId', 'targetStableId', 'actionTypeId', 'rule',
      'publishedOntologyVersion', 'dataVersion', 't019Id', 't019Version', 't008', 'quality', 'freshness', 'evidenceRefs'
    ]
  });
  if (duplicate.conflict) fail('ERR_C011_IDEMPOTENCY_CONFLICT', 'C011 idempotency key conflicts with another request', duplicate);
  if (duplicate.duplicate) return { status: 'duplicate', request, ...(envelope ? { envelope } : {}), receipt: duplicate.existing || null, sideEffectAllowed: false };
  if (typeof submitter !== 'function') fail('ERR_C011_SUBMITTER_REQUIRED', 'C011 submission requires an owner API function');
  let response;
  try {
    response = submitter(clone(request));
  } catch (error) {
    // QA-X-007 is intentionally unresolved: an owner API failure/timeout is
    // preserved as unknown and is never converted into a blind retry.
    if (requestInput.throwOnSubmitError === true) throw error;
    return {
      status: 'unknown',
      conditional: true,
      request,
      error: { code: error.code || 'C011_SUBMISSION_UNKNOWN', message: error.message },
      retryAllowed: false,
      queryOriginalRequest: false,
      sideEffectAllowed: false,
      ...(envelope ? { envelope } : {})
    };
  }
  if (response && typeof response.then === 'function') fail('ERR_C011_ASYNC_SUBMITTER', 'use an async owner API for asynchronous C011 submission');
  if (response === undefined || response === null) return {
    status: 'unknown', conditional: true, request, response: null,
    error: { code: 'C011_EMPTY_RECEIPT', message: 'owner API returned no receipt' },
    retryAllowed: false, queryOriginalRequest: false, sideEffectAllowed: false,
    ...(envelope ? { envelope } : {})
  };
  return { status: 'submitted', request, ...(envelope ? { envelope } : {}), response: clone(response), sideEffectAllowed: true };
}

async function submitC011Async(requestInput, submitter, seen) {
  const request = buildC011Request(requestInput);
  const envelope = isRecord(requestInput) && (requestInput.includeEnvelope === true || requestInput.envelopeOptions)
    ? foundation.createC011Envelope(request, requestInput.envelopeOptions || {})
    : null;
  const duplicate = identity.identifyDuplicateRequest(request, seen, {
    fields: ['contractCode', 'schemaVersion', 'requestId', 'scenarioContext', 'scenarioRunId', 'sourceResultId', 'targetStableId', 'actionTypeId', 'rule', 'publishedOntologyVersion', 'dataVersion', 't019Id', 't019Version', 't008', 'quality', 'freshness', 'evidenceRefs']
  });
  if (duplicate.conflict) fail('ERR_C011_IDEMPOTENCY_CONFLICT', 'C011 idempotency key conflicts with another request', duplicate);
  if (duplicate.duplicate) return { status: 'duplicate', request, ...(envelope ? { envelope } : {}), receipt: duplicate.existing || null, sideEffectAllowed: false };
  if (typeof submitter !== 'function') fail('ERR_C011_SUBMITTER_REQUIRED', 'C011 submission requires an owner API function');
  try {
    const response = await submitter(clone(request));
    if (response === undefined || response === null) return { status: 'unknown', conditional: true, request, response: null, error: { code: 'C011_EMPTY_RECEIPT', message: 'owner API returned no receipt' }, retryAllowed: false, queryOriginalRequest: false, sideEffectAllowed: false, ...(envelope ? { envelope } : {}) };
    return { status: 'submitted', request, ...(envelope ? { envelope } : {}), response: clone(response), sideEffectAllowed: true };
  } catch (error) {
    if (requestInput.throwOnSubmitError === true) throw error;
    return { status: 'unknown', conditional: true, request, ...(envelope ? { envelope } : {}), error: { code: error.code || 'C011_SUBMISSION_UNKNOWN', message: error.message }, retryAllowed: false, queryOriginalRequest: false, sideEffectAllowed: false };
  }
}

class C011SubmissionLedger {
  constructor(options = {}) {
    this.records = options.records instanceof Map ? new Map(options.records) : new Map();
  }

  submit(requestInput, submitter) {
    const preview = buildC011Request(requestInput);
    const prior = this.records.get(preview.idempotencyKey);
    if (prior?.submissionStatus === 'unknown') return { status: 'unknown', conditional: true, request: preview, receipt: prior.receipt || null, retryAllowed: false, queryOriginalRequest: false, sideEffectAllowed: false };
    const result = submitC011(requestInput, submitter, this.records);
    if (result.status === 'submitted' || result.status === 'unknown') {
      this.records.set(result.request.idempotencyKey, {
        ...clone(result.request),
        receipt: clone(result.response || null),
        submissionStatus: result.status
      });
    }
    return result;
  }

  async submitAsync(requestInput, submitter) {
    const preview = buildC011Request(requestInput);
    const prior = this.records.get(preview.idempotencyKey);
    if (prior?.submissionStatus === 'unknown') return { status: 'unknown', conditional: true, request: preview, receipt: prior.receipt || null, retryAllowed: false, queryOriginalRequest: false, sideEffectAllowed: false };
    const result = await submitC011Async(requestInput, submitter, this.records);
    if (result.status === 'submitted' || result.status === 'unknown') {
      this.records.set(result.request.idempotencyKey, {
        ...clone(result.request),
        receipt: clone(result.response || null),
        submissionStatus: result.status
      });
    }
    return result;
  }

  get(idempotencyKey) {
    return this.records.get(idempotencyKey) ? clone(this.records.get(idempotencyKey)) : null;
  }

  snapshot() {
    return new Map([...this.records.entries()].map(([key, value]) => [key, clone(value)]));
  }
}

function createC011Submitter(options) {
  return new C011SubmissionLedger(options);
}

module.exports = Object.freeze({
  C010_SCHEMA_VERSION,
  C018_SCHEMA_VERSION,
  C011_SCHEMA_VERSION,
  deriveEvidenceMapping,
  normalizeMapping,
  createResultFact,
  createC010Result: createResultFact,
  createC010RunFact: createResultFact,
  createQueryResultFact: createResultFact,
  validateResultFact,
  validateC010Result: validateResultFact,
  assertC010Result: assertResultFact,
  assertResultFact,
  createCsv,
  exportCsv: createCsv,
  exportResultCsv: createCsv,
  createQueryView,
  validateQueryView,
  QueryViewRegistry,
  buildC011Request,
  createC011Request: buildC011Request,
  submitC011,
  createStandardC011: buildC011Request,
  validateC011Request,
  assertC011Request,
  submitStandardC011: submitC011,
  submitC011Async,
  submitStandardC011Async: submitC011Async,
  C011SubmissionLedger,
  createC011Submitter
});
