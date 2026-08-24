'use strict';

const foundationContracts = require('../contracts');
const identity = require('../identity');
const releaseBoundary = require('../agent-release');
const {
  isRecord, isNonEmptyString, immutable, stableSerialize, sha256, issue,
  validation, fail, nowIso, findForbiddenKeys
} = require('./util');

const EVIDENCE_PACK_SCHEMA_VERSION = 'ofw.c022.report-evidence-pack.v1';
const C022_SCHEMA_VERSION = 'ofw.c022.report-generation-request.v1';
const C023_SCHEMA_VERSION = 'ofw.c023.agent-report-draft.v1';
const EXTRACTION_REQUEST_SCHEMA_VERSION = 'ofw.c024.report-verification-extraction-request.v1';
const EXTRACTION_RESULT_SCHEMA_VERSION = 'ofw.c025.report-verification-extraction.v1';
const M06_DEFINITION_SCHEMA_VERSION = 'ofw.m06.report-definition.v1';
const M06_TEMPLATE_SCHEMA_VERSION = 'ofw.m06.report-template.v1';
const M06_FIXED_CONTEXT_SCHEMA_VERSION = 'ofw.m06.fixed-report-context.v1';
const T044_SCHEMA_VERSION = 'ofw.t044.stable-report-anchor.v1';
const SUCCESS_STATES = new Set(['completed', 'complete', 'succeeded']);
const FAILURE_STATES = new Set(['failed', 'error']);

const C022_FIELDS = new Set([
  'schemaVersion', 'contractId', 'requestId', 'scenarioContext', 'reportContext',
  'reportAggregateId', 'definitionRef', 'templateRef', 'reportDefinition', 'template',
  'objectScope', 'generationScope', 'evidencePack', 'evidencePackId', 'evidencePackVersion',
  'fixedContext', 'agentRef', 'skillRef', 'allowedContentTypes', 'requestedAt', 'status',
  'statusLabel', 'idempotencyKey', 'immutable'
]);
const DEFINITION_FIELDS = new Set([
  'schemaVersion', 'reportDefinitionId', 'version', 'status', 'title', 'purpose',
  'applicability', 'audience', 'templateRef', 'sections', 'evidenceSlots', 'contentPolicy',
  'coveragePolicy', 'calculationPolicy', 'agentRef', 'skillRef', 'verificationPolicy',
  'comparisonPolicy', 'presentationPolicy', 'reviewPolicy', 'publicationPolicy', 'enabledAt',
  'changeSummary', 'immutable'
]);
const TEMPLATE_FIELDS = new Set([
  'schemaVersion', 'templateId', 'version', 'reportDefinitionId', 'reportDefinitionVersion',
  'name', 'reportType', 'slots', 'page', 'styles', 'scriptAllowed',
  'externalDynamicContentAllowed', 'immutable'
]);
const EVIDENCE_PACK_FIELDS = new Set([
  'schemaVersion', 'evidencePackId', 'version', 'scenarioContext', 'definitionRef',
  'templateRef', 'fixedContextId', 'exactCombination', 'generationBindingSummary',
  'gateReadIds', 'items', 'completeness', 'fixedAt', 'contentHash', 'immutable'
]);
const EVIDENCE_ITEM_FIELDS = new Set([
  'evidenceId', 'version', 'evidenceType', 'evidenceSlotId', 'immutableRef', 'sourceOwner',
  'structuredValue', 'unit', 'precision', 'rounding', 'objectScope', 'semanticRef',
  'resultRef', 'semanticVersionId', 'dataVersionId', 't008', 'evidenceRefs', 'fixedAt',
  'accessible', 'authorized', 'immutable'
]);
const FIXED_CONTEXT_FIELDS = new Set([
  'schemaVersion', 'fixedContextId', 'scenarioContext', 'exactCombination',
  'generationBindingSummary', 'c008Refs', 'c017Refs', 'gateReadIds', 'fixedAt', 'immutable'
]);
const REPORT_CONTEXT_FIELDS = new Set(['scenarioContext', 'reportAggregateId', 'objectScope', 'generationScope']);
const RUNNER_GENERATION_FIELDS = new Set(['runId', 'status', 'completedAt', 'sourceDraftId', 'version', 'contentItems', 'missingSections', 'warnings']);
const CONTENT_ITEM_FIELDS = new Set([
  'sourceContentItemId', 'contentItemId', 'parentContentItemId', 'order',
  'templateSlotId', 'templateSlot', 'contentType', 'structuredContent', 'evidenceRefs', 'facts', 'warnings'
]);
const FACT_FIELDS = new Set([
  'factId', 'kind', 'value', 'unit', 'evidenceRefs', 'semanticRef', 'resultRef',
  'tolerance', 'required', 'humanConfirmationRequired', 'agentCalculated'
]);
const EXTRACTION_REQUEST_FIELDS = new Set([
  'schemaVersion', 'requestId', 'scenarioContext', 'contentVersionId', 'contentItems',
  'anchors', 'evidencePackRef', 'fixedContext', 'purpose'
]);
const EXTRACTION_CONTENT_FIELDS = new Set([
  'sourceContentItemId', 'parentContentItemId', 'order', 'sectionId', 'templateSlotId',
  'contentType', 'structuredContent', 'evidenceRefs', 'facts', 'warnings'
]);
const ANCHOR_FIELDS = new Set([
  'schemaVersion', 'contractId', 't044Id', 'reportAggregateId', 'contentVersionId',
  'sourceDraftId', 'sourceContentItemId', 'sectionId', 'templateSlotId', 'anchorKind',
  'stableLocation', 'factRefs', 'evidenceRefs', 'bindingVersion', 'immutable'
]);
const RUNNER_EXTRACTION_FIELDS = new Set([
  'runId', 'extractionRunId', 'resultId', 'extractionResultId', 'status', 'completedAt',
  'agentReleaseVersion', 'claims', 'extractedClaims'
]);
const CLAIM_FIELDS = new Set([
  'claimId', 'id', 'sourceContentItemId', 'contentItemId', 'factId', 't044Id',
  'anchorId', 'observedValue', 'observedUnit', 'evidenceRefs', 'semanticRef', 'claimKind'
]);
const RAW_INPUT_RE = /^(?:rawRows?|rows?|workbook|worksheet|filePath|sourceFile|sql|prompt|promptBody|t002|t007Members?|businessRows?)$/i;
const FORBIDDEN_DRAFT_RE = /^(?:html|pdf|script|javascript|t044|anchorId|domPath|pdfPage|formula|calculation|publishReport|reportPublication|action|actions|executeAction|actionRequest|actionExecution|actionDispatch|actionConfirmation|createTodo|todo|task|notification|approval|dispatch|t019Switch|switchT019)$/i;
const FORBIDDEN_CLAIM_DECISION_RE = /^(?:verificationStatus|verificationResult|comparisonResult|pass|passed|warning|fail|failed|outcome|t049|deterministicResults?|status)$/i;

function addUnknown(value, allowed, path, errors) {
  if (!isRecord(value)) {
    errors.push(issue(path, 'type', 'must be an object'));
    return;
  }
  Object.keys(value).forEach((field) => { if (!allowed.has(field)) errors.push(issue(`${path}.${field}`, 'unknown', 'is not allowed')); });
}

function strictScenario(value, path, errors, expected) {
  const result = identity.validateScenarioContext(value, { allowUnknown: false, enforcePrefix: true, path });
  errors.push(...result.errors);
  if (result.valid && expected) {
    for (const field of ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status']) {
      if (value[field] !== expected[field]) errors.push(issue(`${path}.${field}`, 'mismatch', 'must match the fixed C033 context'));
    }
  }
  return result.valid;
}

function requiredText(value, path, errors) {
  if (!isNonEmptyString(value) || /\s/.test(value)) errors.push(issue(path, 'required', 'must be a non-empty identity/version without whitespace'));
}

function dateTime(value, path, errors) {
  if (!identity.isDateTime(value)) errors.push(issue(path, 'format', 'must be an RFC 3339 date-time'));
}

function assertText(value, path) {
  const errors = [];
  requiredText(value, path, errors);
  if (errors.length) fail('PORT_OUTPUT_INVALID', `${path} is required`, errors);
  return value;
}

function findKeys(value, pattern, path = '$', findings = [], seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return findings;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => findKeys(item, pattern, `${path}[${index}]`, findings, seen));
    return findings;
  }
  Object.keys(value).forEach((key) => {
    pattern.lastIndex = 0;
    if (pattern.test(key)) findings.push(`${path}.${key}`);
    findKeys(value[key], pattern, `${path}.${key}`, findings, seen);
  });
  return findings;
}

function setEquals(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return stableSerialize([...new Set(left)].sort()) === stableSerialize([...new Set(right)].sort());
}

function addForbidden(value, path, errors) {
  const findings = findForbiddenKeys(value);
  if (findings.length) errors.push(issue(path, 'forbidden', 'contains prohibited business data or side-effect fields', { fields: findings }));
}

function explicitRunnerStatus(raw, operation) {
  if (!Object.prototype.hasOwnProperty.call(raw, 'status')) return;
  if (!isNonEmptyString(raw.status)) fail(`${operation}_EXECUTION_UNKNOWN`, `${operation.toLowerCase()} runner returned an invalid terminal state`, { status: raw.status });
  if (FAILURE_STATES.has(raw.status)) fail(operation === 'REPORT_GENERATION' ? 'REPORT_GENERATION_FAILED' : 'EXTRACTION_FAILED', `${operation.toLowerCase()} runner reported failure`);
  if (!SUCCESS_STATES.has(raw.status)) fail(`${operation}_EXECUTION_UNKNOWN`, `${operation.toLowerCase()} runner returned an unknown terminal state`, { status: raw.status });
}

function withinValidity(validity, at) {
  const time = Date.parse(at);
  const start = Date.parse(validity?.validFrom);
  const end = validity?.validTo === null ? Infinity : Date.parse(validity?.validTo);
  return Number.isFinite(time) && Number.isFinite(start) && time >= start && time < end;
}

function assertPortRelease(value, request, options = {}) {
  const label = options.label || 'Agent Release';
  if (!value) fail('AGENT_RELEASE_REQUIRED', `${label} must be configured for this M05 port operation`);
  let release;
  try { release = releaseBoundary.assertAgentRelease(value, { requirePublished: true }); }
  catch (error) { fail('AGENT_RELEASE_INVALID', `${label} failed exact published Release validation`, { code: error.code, details: error.details }); }
  const mismatches = [];
  if (release.scenario.id !== request.scenarioContext.scenarioId || release.scenario.version !== request.scenarioContext.scenarioVersion) {
    mismatches.push({ field: 'scenario', release: release.scenario, request: request.scenarioContext });
  }
  if (options.agentRef && (release.agent.id !== options.agentRef.agentId || release.releaseVersion !== options.agentRef.releaseVersion)) {
    mismatches.push({ field: 'agentRelease', release: { agentId: release.agent.id, releaseVersion: release.releaseVersion }, request: options.agentRef });
  }
  if (options.skillRef && !release.skills.some((ref) => ref.id === options.skillRef.skillId && ref.version === options.skillRef.version)) {
    mismatches.push({ field: 'skill', release: release.skills, request: options.skillRef });
  }
  const exact = request.fixedContext?.exactCombination;
  if (!exact || !release.publishedOntologies.some((ref) => ref.id === exact.semanticVersionId && ref.version === exact.semanticVersion)) {
    mismatches.push({ field: 'publishedOntology', release: release.publishedOntologies, request: exact && { id: exact.semanticVersionId, version: exact.semanticVersion } });
  }
  const times = [options.at, request.requestedAt].filter(Boolean);
  if (times.some((at) => !withinValidity(release.validity, at))) mismatches.push({ field: 'validity', release: release.validity, request: times });
  if (mismatches.length) fail('AGENT_RELEASE_MISMATCH', `${label} does not match the fixed M06 request`, { mismatches });
  return immutable(release);
}

function withExecutionTimeout(execution, timeoutMs, operation) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${operation} exceeded the M05 port deadline`);
      error.code = 'TIMEOUT';
      error.outcomeUnknown = true;
      reject(error);
    }, timeoutMs);
    Promise.resolve(execution).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

function validateC022Request(value) {
  const errors = [];
  if (!isRecord(value)) return validation(false, [issue('c022', 'type', 'C022 must be an object')]);
  addUnknown(value, C022_FIELDS, 'c022', errors);
  if (value.schemaVersion !== C022_SCHEMA_VERSION) errors.push(issue('c022.schemaVersion', 'version', `must equal ${C022_SCHEMA_VERSION}`));
  if (value.contractId !== 'C022') errors.push(issue('c022.contractId', 'mismatch', 'must equal C022'));
  requiredText(value.requestId, 'c022.requestId', errors);
  requiredText(value.reportAggregateId, 'c022.reportAggregateId', errors);
  requiredText(value.idempotencyKey, 'c022.idempotencyKey', errors);
  dateTime(value.requestedAt, 'c022.requestedAt', errors);
  if (value.status !== 'submitted' || value.immutable !== true) errors.push(issue('c022', 'lifecycle', 'C022 must be submitted and immutable'));
  strictScenario(value.scenarioContext, 'c022.scenarioContext', errors);

  addUnknown(value.reportContext, REPORT_CONTEXT_FIELDS, 'c022.reportContext', errors);
  if (isRecord(value.reportContext)) {
    strictScenario(value.reportContext.scenarioContext, 'c022.reportContext.scenarioContext', errors, value.scenarioContext);
    if (value.reportContext.reportAggregateId !== value.reportAggregateId
        || stableSerialize(value.reportContext.objectScope) !== stableSerialize(value.objectScope)
        || stableSerialize(value.reportContext.generationScope) !== stableSerialize(value.generationScope)) {
      errors.push(issue('c022.reportContext', 'mismatch', 'must match the fixed aggregate/object/generation scope'));
    }
  }

  const definition = value.reportDefinition;
  addUnknown(definition, DEFINITION_FIELDS, 'c022.reportDefinition', errors);
  if (definition?.schemaVersion !== M06_DEFINITION_SCHEMA_VERSION || definition?.status !== 'enabled' || definition?.immutable !== true) errors.push(issue('c022.reportDefinition', 'definition', 'must be the exact enabled immutable M06 definition'));
  requiredText(definition?.reportDefinitionId, 'c022.reportDefinition.reportDefinitionId', errors);
  requiredText(definition?.version, 'c022.reportDefinition.version', errors);
  if (!isRecord(value.definitionRef) || value.definitionRef.reportDefinitionId !== definition?.reportDefinitionId || value.definitionRef.version !== definition?.version) errors.push(issue('c022.definitionRef', 'mismatch', 'must match reportDefinition'));
  if (!Array.isArray(definition?.sections) || definition.sections.length === 0) errors.push(issue('c022.reportDefinition.sections', 'required', 'managed definition sections are required'));
  if (!Array.isArray(definition?.evidenceSlots) || definition.evidenceSlots.length === 0) errors.push(issue('c022.reportDefinition.evidenceSlots', 'required', 'managed definition evidence slots are required'));
  if (!Array.isArray(definition?.contentPolicy?.allowedContentTypes) || definition.contentPolicy.allowedContentTypes.length === 0) errors.push(issue('c022.reportDefinition.contentPolicy.allowedContentTypes', 'required', 'controlled content types are required'));
  if (definition?.calculationPolicy?.prohibitAgentCalculation !== true) errors.push(issue('c022.reportDefinition.calculationPolicy.prohibitAgentCalculation', 'owner-boundary', 'Agent calculation must be prohibited'));

  const template = value.template;
  addUnknown(template, TEMPLATE_FIELDS, 'c022.template', errors);
  if (template?.schemaVersion !== M06_TEMPLATE_SCHEMA_VERSION || template?.immutable !== true || template?.scriptAllowed !== false || template?.externalDynamicContentAllowed !== false) errors.push(issue('c022.template', 'template', 'must be the exact immutable non-executable M06 template'));
  requiredText(template?.templateId, 'c022.template.templateId', errors);
  requiredText(template?.version, 'c022.template.version', errors);
  if (!isRecord(value.templateRef) || value.templateRef.templateId !== template?.templateId || value.templateRef.version !== template?.version) errors.push(issue('c022.templateRef', 'mismatch', 'must match template'));
  if (template?.reportDefinitionId !== definition?.reportDefinitionId || template?.reportDefinitionVersion !== definition?.version) errors.push(issue('c022.template', 'mismatch', 'template must bind the exact definition'));
  if (!Array.isArray(template?.slots) || template.slots.length === 0) errors.push(issue('c022.template.slots', 'required', 'managed template slots are required'));

  const fixedContext = value.fixedContext;
  addUnknown(fixedContext, FIXED_CONTEXT_FIELDS, 'c022.fixedContext', errors);
  if (fixedContext?.schemaVersion !== M06_FIXED_CONTEXT_SCHEMA_VERSION || fixedContext?.immutable !== true) errors.push(issue('c022.fixedContext', 'fixed-context', 'must be the immutable M06 fixed report context'));
  if (isRecord(fixedContext)) strictScenario(fixedContext.scenarioContext, 'c022.fixedContext.scenarioContext', errors, value.scenarioContext);

  const pack = value.evidencePack;
  addUnknown(pack, EVIDENCE_PACK_FIELDS, 'c022.evidencePack', errors);
  if (pack?.schemaVersion !== EVIDENCE_PACK_SCHEMA_VERSION || pack?.immutable !== true) errors.push(issue('c022.evidencePack', 'evidence-pack', 'must be the immutable C022 evidence pack'));
  requiredText(pack?.evidencePackId, 'c022.evidencePack.evidencePackId', errors);
  requiredText(pack?.version, 'c022.evidencePack.version', errors);
  if (value.evidencePackId !== pack?.evidencePackId || value.evidencePackVersion !== pack?.version) errors.push(issue('c022.evidencePack', 'mismatch', 'top-level evidence pack identity must match'));
  if (isRecord(pack)) strictScenario(pack.scenarioContext, 'c022.evidencePack.scenarioContext', errors, value.scenarioContext);
  if (pack?.definitionRef !== `${definition?.reportDefinitionId}@${definition?.version}` || pack?.templateRef !== `${template?.templateId}@${template?.version}`) errors.push(issue('c022.evidencePack', 'mismatch', 'evidence pack must bind the exact definition/template'));
  if (pack?.fixedContextId !== fixedContext?.fixedContextId || stableSerialize(pack?.exactCombination) !== stableSerialize(fixedContext?.exactCombination)) errors.push(issue('c022.evidencePack', 'mismatch', 'evidence pack must bind the exact fixed context/combination'));
  if (stableSerialize(pack?.generationBindingSummary) !== stableSerialize(fixedContext?.generationBindingSummary)
      || stableSerialize(pack?.gateReadIds) !== stableSerialize(fixedContext?.gateReadIds)) {
    errors.push(issue('c022.evidencePack', 'mismatch', 'evidence pack must bind the exact generation summary and gate reads'));
  }

  if (!isRecord(value.agentRef) || value.agentRef.agentId !== definition?.agentRef?.agentId || value.agentRef.releaseVersion !== definition?.agentRef?.releaseVersion) errors.push(issue('c022.agentRef', 'mismatch', 'must match the fixed definition Agent release'));
  if (!isRecord(value.skillRef) || value.skillRef.skillId !== definition?.skillRef?.skillId || value.skillRef.version !== definition?.skillRef?.version) errors.push(issue('c022.skillRef', 'mismatch', 'must match the fixed definition Skill'));
  if (!Array.isArray(value.allowedContentTypes) || stableSerialize(value.allowedContentTypes) !== stableSerialize(definition?.contentPolicy?.allowedContentTypes)) errors.push(issue('c022.allowedContentTypes', 'mismatch', 'must match definition content policy'));

  const evidenceIds = new Set();
  const evidenceSlots = new Map(Array.isArray(definition?.evidenceSlots) ? definition.evidenceSlots.map((slot) => [slot?.evidenceSlotId, slot]) : []);
  if (!Array.isArray(pack?.items) || pack.items.length === 0) errors.push(issue('c022.evidencePack.items', 'required', 'must contain fixed evidence'));
  else pack.items.forEach((item, index) => {
    const path = `c022.evidencePack.items[${index}]`;
    addUnknown(item, EVIDENCE_ITEM_FIELDS, `c022.evidencePack.items[${index}]`, errors);
    requiredText(item?.evidenceId, `${path}.evidenceId`, errors);
    requiredText(item?.version, `${path}.version`, errors);
    requiredText(item?.evidenceType, `${path}.evidenceType`, errors);
    requiredText(item?.evidenceSlotId, `${path}.evidenceSlotId`, errors);
    requiredText(item?.immutableRef, `${path}.immutableRef`, errors);
    requiredText(item?.sourceOwner, `${path}.sourceOwner`, errors);
    dateTime(item?.fixedAt, `${path}.fixedAt`, errors);
    if (item?.immutable !== true) errors.push(issue(`${path}.immutable`, 'required', 'evidence item must be immutable'));
    if (item?.accessible !== true || item?.authorized !== true) errors.push(issue(path, 'permission', 'evidence item must be explicitly accessible and authorized'));
    const slot = evidenceSlots.get(item?.evidenceSlotId);
    if (!slot || !Array.isArray(slot.allowedEvidenceTypes) || !slot.allowedEvidenceTypes.includes(item?.evidenceType)) errors.push(issue(path, 'mismatch', 'evidence item must match an allowed fixed evidence slot/type'));
    for (const field of ['semanticVersionId', 'dataVersionId', 't008']) {
      if (item?.[field] !== null && item?.[field] !== undefined && item[field] !== fixedContext?.exactCombination?.[field]) errors.push(issue(`${path}.${field}`, 'mismatch', `must match fixedContext.exactCombination.${field}`));
    }
    if (evidenceIds.has(item?.evidenceId)) errors.push(issue(`${path}.evidenceId`, 'duplicate', 'evidence id must be unique'));
    evidenceIds.add(item?.evidenceId);
  });
  const rawFields = findKeys(value, RAW_INPUT_RE);
  if (rawFields.length) errors.push(issue('c022', 'raw-data-forbidden', 'C022 contains forbidden raw/unmanaged fields', { fields: rawFields }));
  addForbidden(value, 'c022', errors);
  const injection = releaseBoundary.detectPromptInjection({ reportDefinition: definition, template, evidenceItems: pack?.items });
  if (injection.detected) errors.push(issue('c022', 'prompt-injection', 'fixed generation input contains instruction injection patterns', injection));
  return validation(errors.length === 0, errors);
}

function assertC022Request(value) {
  const result = validateC022Request(value);
  if (!result.valid) fail('C022_INVALID', 'M05 rejected the C022 generation request', result.errors);
  return immutable(value);
}

function normalizeContentItems(items, c022) {
  if (!Array.isArray(items) || items.length === 0) fail('C023_CONTENT_REQUIRED', 'generation runner must return contentItems');
  const templateSlots = new Map(c022.template.slots.map((slot) => [slot.templateSlotId, slot]));
  const allowedContentTypes = new Set(c022.allowedContentTypes);
  const evidenceIds = new Set(c022.evidencePack.items.map((item) => item.evidenceId));
  const seenIds = new Set();
  const seenFactIds = new Set();
  return items.map((item, index) => {
    const errors = [];
    addUnknown(item, CONTENT_ITEM_FIELDS, `contentItems[${index}]`, errors);
    const forbidden = [...findKeys(item, FORBIDDEN_DRAFT_RE), ...findForbiddenKeys(item).map((finding) => finding.path)];
    if (forbidden.length) errors.push(issue(`contentItems[${index}]`, 'owner-boundary', 'C023 cannot contain T044, HTML/PDF, scripts or calculations', { fields: forbidden }));
    const id = item?.sourceContentItemId || item?.contentItemId;
    requiredText(id, `contentItems[${index}].sourceContentItemId`, errors);
    if (seenIds.has(id)) errors.push(issue(`contentItems[${index}].sourceContentItemId`, 'duplicate', 'content item id must be unique'));
    seenIds.add(id);
    const slotId = item?.templateSlotId || item?.templateSlot;
    const slot = templateSlots.get(slotId);
    if (!slot) errors.push(issue(`contentItems[${index}].templateSlotId`, 'mismatch', 'must target an exact template slot'));
    if (!slot || item?.contentType !== slot.contentType || !allowedContentTypes.has(item?.contentType)) errors.push(issue(`contentItems[${index}].contentType`, 'not-allowed', 'content type is outside the fixed definition/template'));
    const text = typeof item?.structuredContent === 'string' ? item.structuredContent : item?.structuredContent?.text;
    if (typeof text === 'string' && (/<\/?[A-Za-z][^>]*>/i.test(text) || /javascript:/i.test(text))) errors.push(issue(`contentItems[${index}].structuredContent`, 'html-forbidden', 'HTML or executable markup is forbidden'));
    if (item?.evidenceRefs !== undefined && !Array.isArray(item.evidenceRefs)) errors.push(issue(`contentItems[${index}].evidenceRefs`, 'type', 'must be an array'));
    if (item?.facts !== undefined && !Array.isArray(item.facts)) errors.push(issue(`contentItems[${index}].facts`, 'type', 'must be an array'));
    if (item?.warnings !== undefined && !Array.isArray(item.warnings)) errors.push(issue(`contentItems[${index}].warnings`, 'type', 'must be an array'));
    const evidenceRefs = Array.isArray(item?.evidenceRefs) ? item.evidenceRefs : [];
    evidenceRefs.forEach((ref) => { if (!evidenceIds.has(ref)) errors.push(issue(`contentItems[${index}].evidenceRefs`, 'out-of-pack', `unknown evidence ${ref}`)); });
    const facts = Array.isArray(item?.facts) ? item.facts.map((fact, factIndex) => {
      addUnknown(fact, FACT_FIELDS, `contentItems[${index}].facts[${factIndex}]`, errors);
      requiredText(fact?.factId, `contentItems[${index}].facts[${factIndex}].factId`, errors);
      requiredText(fact?.kind, `contentItems[${index}].facts[${factIndex}].kind`, errors);
      if (seenFactIds.has(fact?.factId)) errors.push(issue(`contentItems[${index}].facts[${factIndex}].factId`, 'duplicate', 'fact id must be globally unique'));
      seenFactIds.add(fact?.factId);
      if (fact?.agentCalculated === true) errors.push(issue(`contentItems[${index}].facts[${factIndex}].agentCalculated`, 'formal-calculation', 'M05 may not create formal calculated facts'));
      const refs = Array.isArray(fact?.evidenceRefs) ? fact.evidenceRefs : [];
      if (refs.length === 0) errors.push(issue(`contentItems[${index}].facts[${factIndex}].evidenceRefs`, 'required', 'facts must bind fixed evidence'));
      refs.forEach((ref) => { if (!evidenceIds.has(ref)) errors.push(issue(`contentItems[${index}].facts[${factIndex}].evidenceRefs`, 'out-of-pack', `unknown evidence ${ref}`)); });
      return {
        factId: fact.factId, kind: fact.kind, value: fact.value, unit: fact.unit || null,
        evidenceRefs: refs, semanticRef: fact.semanticRef || null, resultRef: fact.resultRef || null,
        tolerance: fact.tolerance ?? c022.reportDefinition.calculationPolicy.defaultTolerance,
        required: fact.required !== false, humanConfirmationRequired: fact.humanConfirmationRequired === true,
        agentCalculated: false
      };
    }) : [];
    if (errors.length) fail('C023_OUTPUT_INVALID', 'generation runner output violates C023', errors);
    return {
      sourceContentItemId: id,
      parentContentItemId: item.parentContentItemId || null,
      order: Number.isInteger(item.order) ? item.order : index + 1,
      templateSlotId: slotId,
      contentType: item.contentType,
      structuredContent: item.structuredContent,
      evidenceRefs,
      facts,
      warnings: Array.isArray(item.warnings) ? item.warnings : []
    };
  });
}

function validateExtractionRequest(value) {
  const errors = [];
  if (!isRecord(value)) return validation(false, [issue('extractionRequest', 'type', 'must be an object')]);
  addUnknown(value, EXTRACTION_REQUEST_FIELDS, 'extractionRequest', errors);
  if (value.schemaVersion !== EXTRACTION_REQUEST_SCHEMA_VERSION) errors.push(issue('extractionRequest.schemaVersion', 'version', `must equal ${EXTRACTION_REQUEST_SCHEMA_VERSION}`));
  requiredText(value.requestId, 'extractionRequest.requestId', errors);
  requiredText(value.contentVersionId, 'extractionRequest.contentVersionId', errors);
  if (value.purpose !== 'claim-extraction-only-no-deterministic-outcome') errors.push(issue('extractionRequest.purpose', 'purpose', 'must be claim extraction only'));
  strictScenario(value.scenarioContext, 'extractionRequest.scenarioContext', errors);
  if (!isRecord(value.evidencePackRef)) errors.push(issue('extractionRequest.evidencePackRef', 'required', 'must identify the exact evidence pack'));
  else {
    addUnknown(value.evidencePackRef, new Set(['evidencePackId', 'version']), 'extractionRequest.evidencePackRef', errors);
    requiredText(value.evidencePackRef.evidencePackId, 'extractionRequest.evidencePackRef.evidencePackId', errors);
    requiredText(value.evidencePackRef.version, 'extractionRequest.evidencePackRef.version', errors);
  }
  if (!isRecord(value.fixedContext)) errors.push(issue('extractionRequest.fixedContext', 'required', 'fixed context metadata is required'));
  else addUnknown(value.fixedContext, new Set(['exactCombination', 'generationBindingSummary']), 'extractionRequest.fixedContext', errors);
  const contentIds = new Set();
  const factIds = new Set();
  const contentById = new Map();
  if (!Array.isArray(value.contentItems) || value.contentItems.length === 0) errors.push(issue('extractionRequest.contentItems', 'required', 'content items are required'));
  else value.contentItems.forEach((item, index) => {
    addUnknown(item, EXTRACTION_CONTENT_FIELDS, `extractionRequest.contentItems[${index}]`, errors);
    const forbidden = findKeys(item, FORBIDDEN_DRAFT_RE);
    if (forbidden.length) errors.push(issue(`extractionRequest.contentItems[${index}]`, 'owner-boundary', 'content contains prohibited report artifacts or side effects', { fields: forbidden }));
    requiredText(item?.sourceContentItemId, `extractionRequest.contentItems[${index}].sourceContentItemId`, errors);
    requiredText(item?.sectionId, `extractionRequest.contentItems[${index}].sectionId`, errors);
    requiredText(item?.templateSlotId, `extractionRequest.contentItems[${index}].templateSlotId`, errors);
    if (contentIds.has(item?.sourceContentItemId)) errors.push(issue(`extractionRequest.contentItems[${index}].sourceContentItemId`, 'duplicate', 'must be unique'));
    contentIds.add(item?.sourceContentItemId);
    contentById.set(item?.sourceContentItemId, item);
    const text = typeof item?.structuredContent === 'string' ? item.structuredContent : item?.structuredContent?.text;
    if (typeof text === 'string' && (/<\/?[A-Za-z][^>]*>/i.test(text) || /javascript:/i.test(text))) errors.push(issue(`extractionRequest.contentItems[${index}].structuredContent`, 'html-forbidden', 'HTML or executable markup is forbidden'));
    if (!Array.isArray(item?.facts)) errors.push(issue(`extractionRequest.contentItems[${index}].facts`, 'type', 'must be an array'));
    else item.facts.forEach((fact, factIndex) => {
      addUnknown(fact, FACT_FIELDS, `extractionRequest.contentItems[${index}].facts[${factIndex}]`, errors);
      requiredText(fact?.factId, `extractionRequest.contentItems[${index}].facts[${factIndex}].factId`, errors);
      if (factIds.has(fact?.factId)) errors.push(issue(`extractionRequest.contentItems[${index}].facts[${factIndex}].factId`, 'duplicate', 'must be unique'));
      factIds.add(fact?.factId);
    });
  });
  const anchorIds = new Set();
  if (!Array.isArray(value.anchors) || value.anchors.length === 0) errors.push(issue('extractionRequest.anchors', 'required', 'T044 anchor references are required'));
  else value.anchors.forEach((anchor, index) => {
    const path = `extractionRequest.anchors[${index}]`;
    addUnknown(anchor, ANCHOR_FIELDS, `extractionRequest.anchors[${index}]`, errors);
    requiredText(anchor?.t044Id, `${path}.t044Id`, errors);
    for (const field of ['reportAggregateId', 'sourceDraftId', 'sourceContentItemId', 'sectionId', 'templateSlotId', 'anchorKind', 'stableLocation', 'bindingVersion']) requiredText(anchor?.[field], `${path}.${field}`, errors);
    if (anchor?.schemaVersion !== T044_SCHEMA_VERSION || anchor?.contractId !== 'T044' || anchor?.immutable !== true) errors.push(issue(path, 'contract', 'anchor must be an immutable T044'));
    const item = contentById.get(anchor?.sourceContentItemId);
    const expectedFacts = Array.isArray(item?.facts) ? item.facts.map((fact) => fact.factId) : [];
    const expectedEvidence = [...new Set([...(item?.evidenceRefs || []), ...(item?.facts || []).flatMap((fact) => fact.evidenceRefs || [])])];
    if (anchor?.contentVersionId !== value.contentVersionId || !item
        || anchor?.sectionId !== item?.sectionId || anchor?.templateSlotId !== item?.templateSlotId
        || anchor?.stableLocation !== `${item?.sectionId}:${item?.templateSlotId}:${item?.sourceContentItemId}`
        || !setEquals(anchor?.factRefs, expectedFacts) || !setEquals(anchor?.evidenceRefs, expectedEvidence)) {
      errors.push(issue(path, 'mismatch', 'anchor must bind the exact current content item, facts and evidence'));
    }
    if (anchorIds.has(anchor?.t044Id)) errors.push(issue(`${path}.t044Id`, 'duplicate', 'must be unique'));
    anchorIds.add(anchor?.t044Id);
  });
  addForbidden(value, 'extractionRequest', errors);
  const injection = releaseBoundary.detectPromptInjection({ contentItems: value.contentItems });
  if (injection.detected) errors.push(issue('extractionRequest.contentItems', 'prompt-injection', 'fixed extraction input contains instruction injection patterns', injection));
  return validation(errors.length === 0, errors);
}

function assertExtractionRequest(value) {
  const result = validateExtractionRequest(value);
  if (!result.valid) fail('EXTRACTION_REQUEST_INVALID', 'M05 rejected the claim extraction request', result.errors);
  return immutable(value);
}

function normalizeClaims(rawClaims, request) {
  if (!Array.isArray(rawClaims)) fail('EXTRACTION_OUTPUT_INVALID', 'extraction runner must return claims');
  const contentById = new Map(request.contentItems.map((item) => [item.sourceContentItemId, item]));
  const anchorById = new Map(request.anchors.map((anchor) => [anchor.t044Id, anchor]));
  const seen = new Set();
  const seenBindings = new Set();
  return rawClaims.map((claim, index) => {
    const errors = [];
    addUnknown(claim, CLAIM_FIELDS, `claims[${index}]`, errors);
    addForbidden(claim, `claims[${index}]`, errors);
    const decisions = isRecord(claim) ? Object.keys(claim).filter((field) => FORBIDDEN_CLAIM_DECISION_RE.test(field)) : [];
    if (decisions.length) errors.push(issue(`claims[${index}]`, 'deterministic-outcome-forbidden', 'claim extraction cannot decide pass/warning/fail', { fields: decisions }));
    const sourceContentItemId = claim?.sourceContentItemId || claim?.contentItemId;
    const t044Id = claim?.t044Id || claim?.anchorId;
    const item = contentById.get(sourceContentItemId);
    const anchor = anchorById.get(t044Id);
    requiredText(sourceContentItemId, `claims[${index}].sourceContentItemId`, errors);
    requiredText(t044Id, `claims[${index}].t044Id`, errors);
    if (!item || !anchor || anchor.sourceContentItemId !== sourceContentItemId) errors.push(issue(`claims[${index}]`, 'anchor-mismatch', 'claim must bind a current content item/T044 anchor'));
    const fact = claim?.factId ? item?.facts?.find((candidate) => candidate.factId === claim.factId) : null;
    if (claim?.factId && !fact) errors.push(issue(`claims[${index}].factId`, 'mismatch', 'claim references an unknown fact'));
    if (fact && !anchor?.factRefs?.includes(fact.factId)) errors.push(issue(`claims[${index}].factId`, 'anchor-mismatch', 'claim fact is not bound by the selected T044 anchor'));
    const allowedEvidence = new Set(fact?.evidenceRefs || item?.evidenceRefs || []);
    const anchorEvidence = new Set(anchor?.evidenceRefs || []);
    const evidenceRefs = Array.isArray(claim?.evidenceRefs) ? claim.evidenceRefs : [];
    if (evidenceRefs.length === 0) errors.push(issue(`claims[${index}].evidenceRefs`, 'required', 'claim must bind fixed evidence'));
    evidenceRefs.forEach((ref) => { if (!allowedEvidence.has(ref) || !anchorEvidence.has(ref)) errors.push(issue(`claims[${index}].evidenceRefs`, 'out-of-scope', `claim evidence ${ref} is outside the content/T044 binding`)); });
    const claimId = claim?.claimId || claim?.id || `CLAIM-${sha256({ requestId: request.requestId, index, sourceContentItemId, factId: claim?.factId || null, t044Id }).slice(0, 24)}`;
    requiredText(claimId, `claims[${index}].claimId`, errors);
    if (seen.has(claimId)) errors.push(issue(`claims[${index}].claimId`, 'duplicate', 'claim id must be unique'));
    seen.add(claimId);
    const bindingKey = stableSerialize([sourceContentItemId, claim?.factId || null, t044Id]);
    if (seenBindings.has(bindingKey)) errors.push(issue(`claims[${index}]`, 'duplicate', 'claim content/fact/T044 binding must be unique'));
    seenBindings.add(bindingKey);
    if (errors.length) fail('EXTRACTION_OUTPUT_INVALID', 'extraction runner output violates the extraction-only contract', errors);
    return {
      claimId,
      sourceContentItemId,
      factId: claim.factId || null,
      t044Id,
      observedValue: claim.observedValue,
      observedUnit: claim.observedUnit || null,
      evidenceRefs,
      semanticRef: claim.semanticRef || null,
      claimKind: claim.claimKind || 'fact'
    };
  });
}

class M05ReportPortStore {
  constructor() {
    this.generations = new Map();
    this.extractions = new Map();
  }

  getGeneration(requestId) { return this.generations.get(requestId) || null; }
  putGeneration(requestId, record) { this.generations.set(requestId, immutable(record)); return this.generations.get(requestId); }
  getExtraction(requestId) { return this.extractions.get(requestId) || null; }
  putExtraction(requestId, record) { this.extractions.set(requestId, immutable(record)); return this.extractions.get(requestId); }
  snapshot() { return immutable({ generations: [...this.generations.values()], extractions: [...this.extractions.values()] }); }
}

function createM05ReportPortStore() { return new M05ReportPortStore(); }

function resolveRunner(options, operation) {
  const direct = operation === 'report-generation' ? options.generationRunner : options.extractionRunner;
  if (typeof direct === 'function') return direct;
  const runner = options.agentRunner || options.runner || options.modelToolGateway;
  const method = operation === 'report-generation' ? 'runReportGeneration' : 'extractReportClaims';
  if (runner && typeof runner[method] === 'function') return runner[method].bind(runner);
  if (typeof runner === 'function') return runner;
  return null;
}

class M06ReportPortAdapter {
  constructor(options = {}) {
    this.store = options.store || createM05ReportPortStore();
    this.generationRunner = resolveRunner(options, 'report-generation');
    this.extractionRunner = resolveRunner(options, 'claim-extraction');
    this.generationRelease = options.generationRelease || options.agentRelease || null;
    this.extractionRelease = options.extractionRelease || options.claimExtractionRelease || options.agentRelease || null;
    this.runtime = options.runtime || null;
    this.modelGateway = options.modelGateway || null;
    this.toolGateway = options.toolGateway || null;
    this.clock = options.clock;
    this.idFactory = options.idFactory;
    this.extractionAgentReleaseVersion = options.extractionAgentReleaseVersion || null;
    this.executionTimeoutMs = options.executionTimeoutMs === undefined ? 30_000 : options.executionTimeoutMs;
    if (!Number.isInteger(this.executionTimeoutMs) || this.executionTimeoutMs <= 0) fail('REPORT_PORT_CONFIG_INVALID', 'executionTimeoutMs must be a positive integer');
    this.responseEnvelope = options.responseEnvelope || null;
    this.pendingGenerations = new Map();
    this.pendingExtractions = new Map();
  }

  _now() { return nowIso(this.clock); }
  _id(prefix, seed) { return typeof this.idFactory === 'function' ? this.idFactory(prefix, seed) : `${prefix}-${sha256(seed).slice(0, 24)}`; }

  _wrap(payload, kind, request) {
    if (!this.responseEnvelope) return payload;
    const eventType = kind === 'generation' ? this.responseEnvelope.generationEventType : this.responseEnvelope.extractionEventType;
    if (!isNonEmptyString(eventType) || this.responseEnvelope.actorRef === undefined) fail('RESPONSE_ENVELOPE_CONFIG_INVALID', 'strict response envelope requires eventType and actorRef');
    const id = kind === 'generation' ? payload.requestId : request.requestId;
    const envelope = {
      eventId: this._id(kind === 'generation' ? 'C023EV' : 'EXTREV', { id, result: payload.sourceDraftId || payload.extractionResultId }),
      eventType,
      schemaVersion: foundationContracts.CONTRACT_ENVELOPE_SCHEMA_VERSION,
      occurredAt: payload.generatedAt || payload.completedAt || payload.generationRun?.completedAt || this._now(),
      actorRef: this.responseEnvelope.actorRef,
      correlationId: request.correlationId || this._id('CORR', id),
      traceId: request.traceId || this._id('TRACE', id),
      idempotencyKey: request.idempotencyKey || `idem-v1:${sha256({ kind, id })}`,
      scenarioContext: payload.scenarioContext,
      resourceRefs: [],
      evidenceRefs: [],
      payload
    };
    return immutable(foundationContracts.assertContractEnvelope(envelope, { allowUnknown: false, enforcePrefix: true }));
  }

  async submitReportGeneration(input) {
    const c022 = assertC022Request(input);
    if (!this.generationRunner) fail('REPORT_GENERATION_RUNNER_NOT_CONFIGURED', 'a real report generation runner is required');
    const release = assertPortRelease(this.generationRelease, c022, { label: 'generation Agent Release', agentRef: c022.agentRef, skillRef: c022.skillRef, at: this._now() });
    const fingerprint = sha256(c022);
    const existing = this.store.getGeneration(c022.requestId);
    if (existing) {
      if (existing.inputFingerprint !== fingerprint || existing.idempotencyKey !== c022.idempotencyKey || existing.releaseDigest !== release.digest) fail('C022_IDEMPOTENCY_CONFLICT', 'C022 identity was reused with a different fixed request or Agent Release');
      if (existing.status === 'completed') return existing.response;
      if (existing.status === 'running') {
        const pending = this.pendingGenerations.get(c022.requestId);
        if (pending) return pending;
        fail('REPORT_GENERATION_EXECUTION_UNKNOWN', 'generation is marked running without a live execution handle');
      }
      if (existing.status === 'unknown') fail('REPORT_GENERATION_EXECUTION_UNKNOWN', 'generation outcome is unknown and cannot be retried implicitly', existing.error);
      fail('REPORT_GENERATION_FAILED', 'generation previously failed and requires an explicit new request', existing.error);
    }
    this.store.putGeneration(c022.requestId, { requestId: c022.requestId, idempotencyKey: c022.idempotencyKey, scenarioContext: c022.scenarioContext, inputFingerprint: fingerprint, releaseDigest: release.digest, status: 'running', startedAt: this._now() });
    const runnerInput = Object.freeze({
      operation: 'report-generation',
      c022,
      fixedInput: immutable({ reportDefinition: c022.reportDefinition, template: c022.template, evidencePack: c022.evidencePack, fixedContext: c022.fixedContext, scenarioContext: c022.scenarioContext }),
      agentRelease: release,
      releaseBinding: immutable(releaseBoundary.releaseRefs(release)),
      modelGateway: this.modelGateway,
      toolGateway: this.toolGateway,
      readOnly: true,
      sideEffectsSuppressed: true
    });
    const execution = Promise.resolve().then(() => this.generationRunner(runnerInput));
    const pending = withExecutionTimeout(execution, this.executionTimeoutMs, 'report generation').then((raw) => {
      if (!isRecord(raw)) fail('REPORT_GENERATION_EXECUTION_UNKNOWN', 'generation runner returned no structured execution result');
      const unknown = Object.keys(raw).filter((field) => !RUNNER_GENERATION_FIELDS.has(field));
      if (unknown.length) fail('C023_OUTPUT_INVALID', 'generation runner result contains unknown fields', { unknownFields: unknown });
      explicitRunnerStatus(raw, 'REPORT_GENERATION');
      const outputErrors = [];
      for (const field of ['runId', 'sourceDraftId', 'version']) if (raw[field] !== undefined) requiredText(raw[field], `generationRunnerResult.${field}`, outputErrors);
      if (raw.missingSections !== undefined && !Array.isArray(raw.missingSections)) outputErrors.push(issue('generationRunnerResult.missingSections', 'type', 'must be an array'));
      if (raw.warnings !== undefined && !Array.isArray(raw.warnings)) outputErrors.push(issue('generationRunnerResult.warnings', 'type', 'must be an array'));
      const sectionIds = new Set(c022.reportDefinition.sections.map((section) => section.sectionId));
      if (Array.isArray(raw.missingSections)) raw.missingSections.forEach((sectionId, index) => {
        if (!isNonEmptyString(sectionId) || !sectionIds.has(sectionId)) outputErrors.push(issue(`generationRunnerResult.missingSections[${index}]`, 'mismatch', 'must identify a fixed definition section'));
      });
      addForbidden({ missingSections: raw.missingSections, warnings: raw.warnings }, 'generationRunnerResult', outputErrors);
      const forbiddenMetadata = findKeys({ missingSections: raw.missingSections, warnings: raw.warnings }, FORBIDDEN_DRAFT_RE);
      if (forbiddenMetadata.length) outputErrors.push(issue('generationRunnerResult', 'owner-boundary', 'generation metadata contains prohibited side effects', { fields: forbiddenMetadata }));
      if (outputErrors.length) fail('C023_OUTPUT_INVALID', 'generation runner result metadata is invalid', outputErrors);
      const completedAt = raw.completedAt || this._now();
      if (!identity.isDateTime(completedAt)) fail('C023_OUTPUT_INVALID', 'generation completedAt must be an RFC 3339 date-time');
      const contentItems = normalizeContentItems(raw.contentItems, c022);
      const result = immutable({
        schemaVersion: C023_SCHEMA_VERSION,
        contractId: 'C023',
        requestId: c022.requestId,
        scenarioContext: c022.scenarioContext,
        evidencePackId: c022.evidencePack.evidencePackId,
        evidencePackVersion: c022.evidencePack.version,
        sourceDraftId: raw.sourceDraftId || this._id('C023-DRAFT', { requestId: c022.requestId, fingerprint }),
        version: raw.version || '1.0.0',
        generationRun: {
          runId: raw.runId || this._id('M05-GEN-RUN', { requestId: c022.requestId, fingerprint }),
          status: 'completed',
          agentId: release.agent.id,
          releaseVersion: release.releaseVersion,
          completedAt
        },
        contentItems,
        missingSections: Array.isArray(raw.missingSections) ? raw.missingSections : [],
        warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
        handoffReceipt: { receiptId: this._id('C023-RECEIPT', { requestId: c022.requestId, fingerprint }), acceptedAt: completedAt }
      });
      if (result.generationRun.runId === c022.requestId) fail('RUN_ID_REUSED', 'generation run identity must differ from C022 request identity');
      const response = this._wrap(result, 'generation', c022);
      this.store.putGeneration(c022.requestId, { requestId: c022.requestId, idempotencyKey: c022.idempotencyKey, scenarioContext: c022.scenarioContext, inputFingerprint: fingerprint, releaseDigest: release.digest, status: 'completed', result, response, completedAt });
      return response;
    }).catch((error) => {
      const failure = error instanceof Error ? error : Object.assign(new Error('generation runner rejected without a structured error'), { code: 'REPORT_GENERATION_EXECUTION_UNKNOWN', outcomeUnknown: true });
      const unknown = failure.code === 'REPORT_GENERATION_EXECUTION_UNKNOWN' || failure.outcomeUnknown === true || ['TIMEOUT', 'ETIMEDOUT'].includes(failure.code);
      this.store.putGeneration(c022.requestId, { requestId: c022.requestId, idempotencyKey: c022.idempotencyKey, scenarioContext: c022.scenarioContext, inputFingerprint: fingerprint, releaseDigest: release.digest, status: unknown ? 'unknown' : 'failed', error: { code: failure.code || 'REPORT_GENERATION_FAILED', message: failure.message }, completedAt: this._now() });
      throw failure;
    }).finally(() => this.pendingGenerations.delete(c022.requestId));
    this.pendingGenerations.set(c022.requestId, pending);
    return pending;
  }

  readReportGeneration(input) {
    if (!isRecord(input)) fail('REPORT_GENERATION_READ_INVALID', 'readReportGeneration request must be an object');
    const unknown = Object.keys(input).filter((field) => !['requestId', 'scenarioContext'].includes(field));
    if (unknown.length) fail('REPORT_GENERATION_READ_INVALID', 'readReportGeneration contains unknown fields', { unknownFields: unknown });
    assertText(input.requestId, 'readReportGeneration.requestId');
    const contextErrors = [];
    strictScenario(input.scenarioContext, 'readReportGeneration.scenarioContext', contextErrors);
    if (contextErrors.length) fail('REPORT_GENERATION_READ_INVALID', 'readReportGeneration scenario context is invalid', contextErrors);
    const record = this.store.getGeneration(input.requestId);
    if (!record) return null;
    const mismatches = [];
    strictScenario(input.scenarioContext, 'readReportGeneration.scenarioContext', mismatches, record.scenarioContext);
    if (mismatches.length) fail('CONTEXT_MISMATCH', 'readReportGeneration crosses scenario contexts', mismatches);
    if (record.status === 'completed') return record.response;
    if (record.status === 'running' && this.pendingGenerations.has(input.requestId)) fail('REPORT_GENERATION_PENDING', 'generation is still running');
    if (record.status === 'unknown' || record.status === 'running') fail('REPORT_GENERATION_EXECUTION_UNKNOWN', 'generation outcome is unknown', record.error);
    fail('REPORT_GENERATION_FAILED', 'generation failed', record.error);
  }

  async extractReportClaims(input) {
    const request = assertExtractionRequest(input);
    if (!this.extractionRunner) fail('EXTRACTION_RUNNER_NOT_CONFIGURED', 'a real claim extraction runner is required');
    const release = assertPortRelease(this.extractionRelease, request, { label: 'claim extraction Agent Release', at: this._now() });
    if (this.extractionAgentReleaseVersion && this.extractionAgentReleaseVersion !== release.releaseVersion) fail('AGENT_RELEASE_MISMATCH', 'legacy extractionAgentReleaseVersion differs from the exact extraction Agent Release');
    const fingerprint = sha256(request);
    const existing = this.store.getExtraction(request.requestId);
    if (existing) {
      if (existing.inputFingerprint !== fingerprint || existing.releaseDigest !== release.digest) fail('EXTRACTION_IDEMPOTENCY_CONFLICT', 'extraction request identity was reused with different fixed input or Agent Release');
      if (existing.status === 'completed') return existing.response;
      if (existing.status === 'running') {
        const pending = this.pendingExtractions.get(request.requestId);
        if (pending) return pending;
        fail('EXTRACTION_EXECUTION_UNKNOWN', 'extraction is marked running without a live execution handle');
      }
      if (existing.status === 'unknown') fail('EXTRACTION_EXECUTION_UNKNOWN', 'extraction outcome is unknown');
      fail('EXTRACTION_FAILED', 'extraction previously failed');
    }
    this.store.putExtraction(request.requestId, { requestId: request.requestId, scenarioContext: request.scenarioContext, inputFingerprint: fingerprint, releaseDigest: release.digest, status: 'running', startedAt: this._now() });
    const runnerInput = Object.freeze({
      operation: 'claim-extraction',
      request,
      fixedInput: immutable({ scenarioContext: request.scenarioContext, contentVersionId: request.contentVersionId, contentItems: request.contentItems, anchors: request.anchors, evidencePackRef: request.evidencePackRef, fixedContext: request.fixedContext }),
      agentRelease: release,
      releaseBinding: immutable(releaseBoundary.releaseRefs(release)),
      modelGateway: this.modelGateway,
      toolGateway: this.toolGateway,
      readOnly: true,
      sideEffectsSuppressed: true,
      deterministicOutcomeAllowed: false
    });
    const execution = Promise.resolve().then(() => this.extractionRunner(runnerInput));
    const pending = withExecutionTimeout(execution, this.executionTimeoutMs, 'claim extraction').then((raw) => {
      if (!isRecord(raw)) fail('EXTRACTION_EXECUTION_UNKNOWN', 'extraction runner returned no structured execution result');
      const unknown = Object.keys(raw).filter((field) => !RUNNER_EXTRACTION_FIELDS.has(field));
      if (unknown.length) fail('EXTRACTION_OUTPUT_INVALID', 'extraction runner result contains unknown fields', { unknownFields: unknown });
      explicitRunnerStatus(raw, 'EXTRACTION');
      if (raw.agentReleaseVersion !== undefined && raw.agentReleaseVersion !== release.releaseVersion) fail('AGENT_RELEASE_MISMATCH', 'extraction runner reported a different Agent Release version');
      const outputErrors = [];
      for (const field of ['runId', 'extractionRunId', 'resultId', 'extractionResultId']) if (raw[field] !== undefined) requiredText(raw[field], `extractionRunnerResult.${field}`, outputErrors);
      if (outputErrors.length) fail('EXTRACTION_OUTPUT_INVALID', 'extraction runner identities are invalid', outputErrors);
      const claims = normalizeClaims(raw.claims || raw.extractedClaims, request);
      const completedAt = raw.completedAt || this._now();
      if (!identity.isDateTime(completedAt)) fail('EXTRACTION_OUTPUT_INVALID', 'extraction completedAt must be an RFC 3339 date-time');
      const result = immutable({
        schemaVersion: EXTRACTION_RESULT_SCHEMA_VERSION,
        contractId: 'C025',
        extractionResultId: raw.extractionResultId || raw.resultId || this._id('M05-EXTRACT-RESULT', { requestId: request.requestId, fingerprint }),
        extractionRunId: raw.extractionRunId || raw.runId || this._id('M05-EXTRACT-RUN', { requestId: request.requestId, fingerprint }),
        scenarioContext: request.scenarioContext,
        contentVersionId: request.contentVersionId,
        evidencePackId: request.evidencePackRef.evidencePackId,
        agentReleaseVersion: release.releaseVersion,
        status: 'completed',
        claims,
        completedAt
      });
      const response = this._wrap(result, 'extraction', request);
      this.store.putExtraction(request.requestId, { requestId: request.requestId, scenarioContext: request.scenarioContext, inputFingerprint: fingerprint, releaseDigest: release.digest, status: 'completed', result, response, completedAt });
      return response;
    }).catch((error) => {
      const failure = error instanceof Error ? error : Object.assign(new Error('extraction runner rejected without a structured error'), { code: 'EXTRACTION_EXECUTION_UNKNOWN', outcomeUnknown: true });
      const unknown = failure.code === 'EXTRACTION_EXECUTION_UNKNOWN' || failure.outcomeUnknown === true || ['TIMEOUT', 'ETIMEDOUT'].includes(failure.code);
      this.store.putExtraction(request.requestId, { requestId: request.requestId, scenarioContext: request.scenarioContext, inputFingerprint: fingerprint, releaseDigest: release.digest, status: unknown ? 'unknown' : 'failed', error: { code: failure.code || 'EXTRACTION_FAILED', message: failure.message }, completedAt: this._now() });
      throw failure;
    }).finally(() => this.pendingExtractions.delete(request.requestId));
    this.pendingExtractions.set(request.requestId, pending);
    return pending;
  }

  receiveEnvelope(value, options) {
    if (!this.runtime || typeof this.runtime.receiveEnvelope !== 'function') fail('C024_RUNTIME_NOT_CONFIGURED', 'M05 Runtime is required to receive C024 envelopes');
    return this.runtime.receiveEnvelope(value, options);
  }

  readC025Result(resultId) {
    if (!this.runtime?.store || typeof this.runtime.store.getResult !== 'function') fail('C025_RUNTIME_NOT_CONFIGURED', 'M05 Runtime result store is required');
    assertText(resultId, 'readC025Result.resultId');
    return this.runtime.store.getResult(resultId);
  }
}

function createM06ReportPort(options) { return new M06ReportPortAdapter(options); }

module.exports = Object.freeze({
  EVIDENCE_PACK_SCHEMA_VERSION,
  C022_SCHEMA_VERSION,
  C023_SCHEMA_VERSION,
  EXTRACTION_REQUEST_SCHEMA_VERSION,
  EXTRACTION_RESULT_SCHEMA_VERSION,
  M06_DEFINITION_SCHEMA_VERSION,
  M06_TEMPLATE_SCHEMA_VERSION,
  M06_FIXED_CONTEXT_SCHEMA_VERSION,
  validateC022Request,
  assertC022Request,
  validateExtractionRequest,
  assertExtractionRequest,
  M05ReportPortStore,
  createM05ReportPortStore,
  M06ReportPortAdapter,
  createM06ReportPort,
  createM05Port: createM06ReportPort
});
