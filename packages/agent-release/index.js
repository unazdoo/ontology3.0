'use strict';

/*
 * M05 Agent Release boundary.
 *
 * This package deliberately contains no model client, database adapter, queue,
 * business-data reader, metric/rule evaluator, report writer, or Action
 * dispatcher.  It owns the immutable resource references and the policy gates
 * that an execution adapter must apply before it calls a model or a tool.
 */

const crypto = require('node:crypto');

let identity;
try {
  // Keep this package usable on its own while sharing the Foundation C033
  // validator when it is available.
  identity = require('../identity');
} catch (_) {
  identity = null;
}

const AGENT_RELEASE_SCHEMA_VERSION = 'ofw.m05.agent-release.v1';
const AGENT_RELEASE_CONTRACT_VERSION = 'draft-0.1.0';
const RESOURCE_REGISTRY_SCHEMA_VERSION = 'ofw.m05.resource-registry.v1';
const AUDIT_SCHEMA_VERSION = 'ofw.m05.agent-audit.v1';
const CHECKPOINT_SCHEMA_VERSION = 'ofw.m05.agent-checkpoint.v1';

const RESOURCE_TYPES = Object.freeze([
  'agent',
  'prompt',
  'skill',
  'tool',
  'model',
  'publishedOntology',
  'scenario',
  'evidence',
  'reportContext',
  'credibilitySummary',
  'verificationResult'
]);

const RELEASE_STATUSES = Object.freeze(['draft', 'validated', 'active', 'disabled', 'retired']);
const TERMINAL_RELEASE_STATUSES = Object.freeze(['disabled', 'retired']);

// These are intentionally narrow.  A caller can register a new read-only
// adapter, but it still has to name the operation and resource explicitly.
const SAFE_TOOL_OPERATIONS = Object.freeze([
  'read',
  'read-context',
  'read-evidence',
  'read-ontology',
  'read-credibility',
  'read-verification',
  'lookup',
  'cite',
  'validate-reference',
  'emit-result'
]);

const FORBIDDEN_TOOL_RE = /(?:workbook|spreadsheet|excel|raw[-_ ]?data|business[-_ ]?detail|t002|t007|t019|sql|database|query[-_ ]?business|code[-_ ]?exec|shell|filesystem|file[-_ ]?write|network|http|fetch|action|todo|task|notification|approval|dispatch|publish|report[-_ ]?(?:write|update|create)|ontology[-_ ]?(?:write|update|create)|metric[-_ ]?(?:calculate|compute|write)|rule[-_ ]?(?:calculate|compute|write))/i;
const FORBIDDEN_RESOURCE_RE = /^(?:workbook|spreadsheet|excel|raw(?:[-_ ]?data)?|business[-_ ]?detail|t002|t007|t019(?:[-_ ]?(?:switch|write|update))?|sql|database|action(?:[-_ ]?request)?|todo|task|notification|approval|dispatch|report[-_ ]?(?:write|draft-write|publish)|ontology[-_ ]?(?:write|draft)|metric[-_ ]?(?:compute|write)|rule[-_ ]?(?:compute|write))$/i;
const EXACT_VERSION_RE = /^(?!latest$)(?!current$)(?!head$)(?!tip$)(?!master$)(?!main$)[^\s]+$/i;
const ID_RE = /^[A-Za-z][A-Za-z0-9._:/-]{0,255}$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

const REPORT_CONTEXT_FIELDS = Object.freeze([
  'scenarioId',
  'scenarioVersion',
  'scenarioRunId',
  'formedAt',
  'status',
  'reportId',
  'contentVersion',
  'evidencePackageId',
  'evidencePackageVersion',
  'semanticResourceId',
  'semanticVersion',
  'dataAssetVersion',
  'dataAsOf',
  'anchorSnapshotId',
  'anchorSnapshotVersion',
  'selectedAnchor',
  'credibilitySummaryRef',
  'verificationResultRef',
  'permission'
]);

const REQUIRED_REPORT_CONTEXT_FIELDS = Object.freeze([
  'scenarioId',
  'scenarioVersion',
  'scenarioRunId',
  'reportId',
  'contentVersion',
  'evidencePackageId',
  'evidencePackageVersion',
  'semanticVersion',
  'dataAssetVersion',
  'dataAsOf',
  'anchorSnapshotId',
  'anchorSnapshotVersion',
  'selectedAnchor',
  'credibilitySummaryRef'
]);

const FORBIDDEN_CONTEXT_KEYS = Object.freeze([
  'workbook',
  'workbooks',
  'spreadsheet',
  'rows',
  'columns',
  'rawData',
  'rawRows',
  'businessDetails',
  'businessDetail',
  'T002',
  'T007',
  'T019',
  't019Switch',
  'switchT019',
  'candidate',
  'candidateVersion',
  'candidateAsset',
  'fallbackVersion',
  'previousTrusted',
  'systemPrompt',
  'promptOverride',
  'question',
  'userInput',
  'externalContent',
  't002',
  't007',
  'metricFormula',
  'ruleFormula',
  'promptOverride',
  'systemPromptOverride',
  'modelOverride',
  'toolOverride',
  'executeAction',
  'createTodo',
  'publishReport',
  'sql',
  'query'
]);

const SUMMARY_FORBIDDEN_KEY_RE = /^(?:metrics?|rules?|objects?|properties?|values?|records?|rows?|columns?|transactions?|amounts?|entities?|facts?|raw|payload|evidence(?:Items?|Payload)?|business(?:Details?)?|query|sql|formula|threshold|calculation|computed|question|userInput|externalContent)/i;
const VERIFICATION_FORBIDDEN_KEY_RE = /^(?:metric(?:Value|Result)?|rule(?:Value|Result)?|actualValue|expectedValue|rawValue|business(?:Detail|Data)|rows?|columns?|transactions?|amounts?|query|sql|formula|threshold|calculation|computed|question|userInput|externalContent)/i;

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  viewer: Object.freeze(['agent.release.read', 'agent.context.read', 'agent.result.read']),
  operator: Object.freeze(['agent.release.read', 'agent.context.read', 'agent.result.read', 'agent.run.execute', 'agent.tool.read']),
  editor: Object.freeze(['agent.release.read', 'agent.context.read', 'agent.result.read', 'agent.release.create', 'agent.release.validate', 'agent.run.execute', 'agent.tool.read']),
  publisher: Object.freeze(['agent.release.read', 'agent.context.read', 'agent.result.read', 'agent.release.create', 'agent.release.validate', 'agent.release.publish', 'agent.run.execute', 'agent.tool.read']),
  admin: Object.freeze(['*'])
});

const DEFAULT_RELEASE_PERMISSIONS = Object.freeze({
  allowedRoles: Object.freeze(['operator', 'publisher', 'admin']),
  required: Object.freeze(['agent.run.execute']),
  denied: Object.freeze(['agent.action.execute', 'agent.report.publish', 'agent.ontology.write', 'agent.data.read'])
});

const PROMPT_INJECTION_PATTERNS = Object.freeze([
  { code: 'IGNORE_PRIOR_INSTRUCTIONS', re: /\b(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|prior|above|system|developer)\s+(?:instructions?|messages?|rules?)/i },
  { code: 'IGNORE_PRIOR_INSTRUCTIONS_ZH', re: /(?:忽略|无视|忘记|覆盖).{0,12}(?:之前|上面|系统|开发者).{0,12}(?:指令|提示|规则|消息)/i },
  { code: 'ROLE_ESCALATION', re: /\b(?:you are now|act as|assume the role|new system message|developer message)\b/i },
  { code: 'ROLE_ESCALATION_ZH', re: /(?:你现在是|请充当|扮演|新的系统消息|开发者消息)/i },
  { code: 'SECRET_OR_PROMPT_EXFILTRATION', re: /\b(?:reveal|print|show|leak|expose|dump)\s+(?:the\s+)?(?:system|developer|hidden|secret|prompt|instructions?)/i },
  { code: 'SECRET_OR_PROMPT_EXFILTRATION_ZH', re: /(?:泄露|输出|打印|展示|告诉我).{0,10}(?:系统提示|开发者提示|隐藏提示|秘密|密钥|内部指令)/i },
  { code: 'UNTRUSTED_TOOL_COMMAND', re: /\b(?:run|execute|call|invoke)\s+(?:this\s+)?(?:tool|function|command|script)\b/i },
  { code: 'UNTRUSTED_TOOL_COMMAND_ZH', re: /(?:执行|调用|运行).{0,8}(?:工具|函数|命令|脚本)/i },
  { code: 'SAFETY_BYPASS', re: /\b(?:jailbreak|bypass\s+(?:safety|policy|guard)|do\s+anything\s+now|DAN)\b/i },
  { code: 'SAFETY_BYPASS_ZH', re: /(?:绕过|解除|关闭).{0,8}(?:安全|策略|权限|防护)/i }
]);

class AgentReleaseError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AgentReleaseError';
    this.code = code;
    this.details = details || null;
  }
}

class AgentPermissionError extends AgentReleaseError {
  constructor(code, message, details) {
    super(code, message, details);
    this.name = 'AgentPermissionError';
  }
}

function fail(code, message, details) {
  throw new AgentReleaseError(code, message, details);
}

function permissionFail(code, message, details) {
  throw new AgentPermissionError(code, message, details);
}

function issue(path, code, message, details) {
  return { path, code, message, ...(details ? { details } : {}) };
}

function validationResult(valid, errors = []) {
  const output = { valid, errors };
  Object.defineProperty(output, 'ok', { value: valid, enumerable: false, configurable: true });
  return output;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactString(value) {
  return text(value) && !/\s/.test(value.trim()) && EXACT_VERSION_RE.test(value.trim());
}

function validId(value) {
  return typeof value === 'string' && ID_RE.test(value.trim());
}

function isDateTime(value) {
  if (typeof value !== 'string' || !DATE_TIME_RE.test(value) || Number.isNaN(Date.parse(value))) return false;
  const m = DATE_TIME_RE.exec(value);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const days = new Date(Date.UTC(Number(m[1]), month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= days && hour < 24 && minute < 60 && second < 60;
}

function cloneJson(value, label = 'value') {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    fail('INVALID_JSON', `${label} must be JSON serializable`, { cause: error.message });
  }
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}

function immutable(value, label) {
  return deepFreeze(cloneJson(value, label));
}

function sortedValue(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') fail('INVALID_JSON', 'stable serialization only accepts JSON values');
    if (typeof value === 'number' && !Number.isFinite(value)) fail('INVALID_JSON', 'stable serialization rejects non-finite numbers');
    return value;
  }
  if (seen.has(value)) fail('INVALID_JSON', 'stable serialization rejects cyclic values');
  seen.add(value);
  const result = Array.isArray(value) ? value.map((item) => sortedValue(item, seen)) : Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortedValue(value[key], seen)]));
  seen.delete(value);
  return result;
}

function stableSerialize(value) {
  return JSON.stringify(sortedValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableSerialize(value), 'utf8').digest('hex');
}

function nowIso(clock) {
  const value = typeof clock === 'function' ? clock() : (clock || new Date().toISOString());
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_TIME', 'clock must return a valid date-time');
  return date.toISOString();
}

function first(value, names) {
  for (const name of names) if (value && value[name] !== undefined && value[name] !== null) return value[name];
  return undefined;
}

function canonicalResourceType(value, fallback) {
  const raw = text(value) ? value.trim() : fallback;
  const key = String(raw || '').toLowerCase().replace(/[._\s-]/g, '');
  const aliases = {
    agent: 'agent', prompt: 'prompt', skill: 'skill', tool: 'tool',
    toolallowlist: 'tool', model: 'model', publishedontology: 'publishedOntology',
    ontology: 'publishedOntology', scenario: 'scenario', outputcontract: 'outputContract',
    evidence: 'evidence', evidencepackage: 'evidence', reportcontext: 'reportContext',
    credibilitysummary: 'credibilitySummary', c017summary: 'credibilitySummary', c017: 'credibilitySummary',
    verificationresult: 'verificationResult', deterministicverificationresult: 'verificationResult', m06verification: 'verificationResult'
  };
  return aliases[key] || raw;
}

function normalizeRef(value, type, path = type, options = {}) {
  const source = typeof value === 'string' ? { id: value } : value;
  if (!isRecord(source)) return null;
  const id = first(source, ['id', 'resourceId', 'refId', 'stableId', 'toolId', 'agentId', 'promptId', 'skillId', 'modelId', 'ontologyId', 'scenarioId']);
  const version = first(source, ['version', 'resourceVersion', 'refVersion', 'exactVersion', 'toolVersion', 'agentVersion', 'promptVersion', 'skillVersion', 'modelVersion', 'ontologyVersion', 'scenarioVersion']);
  const refType = canonicalResourceType(first(source, ['type', 'resourceType', 'refType']), type);
  if (!validId(id)) return null;
  // Keep an invalid/missing version in the normalized shape so validation can
  // report the precise `<field>.version` mismatch instead of collapsing the
  // whole reference to a generic "required" error.
  if (!exactString(version)) {
    if (options.allowUnversioned && version === undefined) return { type: refType, id: id.trim() };
    return { type: refType, id: id.trim(), version };
  }
  const output = { type: refType, id: id.trim(), version: version.trim() };
  const owner = first(source, ['owner', 'ownerModule']);
  const digest = first(source, ['digest', 'contentDigest', 'sha256']);
  if (text(owner)) output.owner = owner.trim();
  if (text(digest)) output.digest = digest.trim();
  if (source.status !== undefined) output.status = source.status;
  return output;
}

function refKey(ref) {
  return `${ref.type}:${ref.id}:${ref.version}`;
}

function normalizeRefList(value, type, path, options = {}) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => normalizeRef(item, type, `${path}[${index}]`, options)).filter(Boolean);
}

function normalizeValidity(value) {
  const source = isRecord(value) ? value : {};
  const validFrom = first(source, ['validFrom', 'effectiveFrom', 'startsAt']);
  const validTo = first(source, ['validTo', 'effectiveTo', 'endsAt']);
  return { validFrom, validTo: validTo === undefined ? null : validTo };
}

function validateValidity(value, path = 'validity') {
  const errors = [];
  const validity = normalizeValidity(value);
  if (!isDateTime(validity.validFrom)) errors.push(issue(`${path}.validFrom`, 'format', 'must be an RFC 3339 date-time'));
  if (validity.validTo !== null && !isDateTime(validity.validTo)) errors.push(issue(`${path}.validTo`, 'format', 'must be an RFC 3339 date-time or null'));
  if (isDateTime(validity.validFrom) && isDateTime(validity.validTo) && Date.parse(validity.validTo) <= Date.parse(validity.validFrom)) errors.push(issue(`${path}.validTo`, 'range', 'must be later than validFrom'));
  return errors;
}

function isWithinValidity(validity, at) {
  const time = Date.parse(at || new Date().toISOString());
  const from = Date.parse(validity.validFrom);
  const to = validity.validTo === null ? Infinity : Date.parse(validity.validTo);
  return Number.isFinite(time) && Number.isFinite(from) && time >= from && time < to;
}

function forbiddenKey(path, key) {
  return FORBIDDEN_CONTEXT_KEYS.some((item) => item.toLowerCase() === String(key).toLowerCase()) || FORBIDDEN_RESOURCE_RE.test(String(key));
}

function findForbiddenKeys(value, path = '$', found = []) {
  if (!isRecord(value) && !Array.isArray(value)) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, `${path}[${index}]`, found));
    return found;
  }
  Object.keys(value).forEach((key) => {
    if (forbiddenKey(path, key)) found.push({ path: `${path}.${key}`, key });
    findForbiddenKeys(value[key], `${path}.${key}`, found);
  });
  return found;
}

function findForbiddenContractFields(value, path, pattern, found = []) {
  if (!isRecord(value) && !Array.isArray(value)) return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenContractFields(item, `${path}[${index}]`, pattern, found));
    return found;
  }
  Object.keys(value).forEach((key) => {
    if (pattern.test(key)) found.push({ path: `${path}.${key}`, key });
    findForbiddenContractFields(value[key], `${path}.${key}`, pattern, found);
  });
  return found;
}

function normalizeWhitelist(value) {
  let list = Array.isArray(value) ? value : [];
  if (!Array.isArray(value) && isRecord(value)) {
    list = [];
    Object.entries(value).forEach(([kind, entries]) => {
      if (!Array.isArray(entries)) return;
      entries.forEach((entry) => {
        const source = typeof entry === 'string' ? { id: entry } : (isRecord(entry) ? entry : {});
        list.push({ ...source, resourceType: source.resourceType || (kind === 'tools' ? 'tool' : 'evidence') });
      });
    });
  }
  return list.map((item) => {
    const source = typeof item === 'string' ? { resourceType: item } : (isRecord(item) ? item : {});
    const resourceType = canonicalResourceType(first(source, ['resourceType', 'type', 'kind']), undefined);
    const resourceId = first(source, ['resourceId', 'id', 'refId', 'stableId']);
    const resourceVersion = first(source, ['resourceVersion', 'version', 'refVersion', 'exactVersion']);
    const operations = first(source, ['operations', 'allowedOperations', 'actions']);
    const scope = first(source, ['scope', 'resourceScope']);
    const readOnly = source.readOnly === undefined ? true : source.readOnly;
    return {
      resourceType: text(resourceType) ? resourceType.trim() : resourceType,
      resourceId: text(resourceId) ? resourceId.trim() : resourceId,
      resourceVersion: text(resourceVersion) ? resourceVersion.trim() : resourceVersion,
      operations: Array.isArray(operations) ? operations.map((op) => String(op).trim()) : [],
      scope: scope === undefined ? null : cloneJson(scope, 'resource whitelist scope'),
      readOnly
    };
  });
}

function validateWhitelist(value, path = 'resourceWhitelist') {
  const errors = [];
  if (!Array.isArray(value) || value.length === 0) return [issue(path, 'required', 'must contain at least one explicit resource')];
  value.forEach((item, index) => {
    const p = `${path}[${index}]`;
    if (!isRecord(item)) {
      errors.push(issue(p, 'type', 'must be an object'));
      return;
    }
    if (!text(item.resourceType) || FORBIDDEN_RESOURCE_RE.test(item.resourceType) || item.resourceType === '*' || item.resourceType === 'all') errors.push(issue(`${p}.resourceType`, 'forbidden', 'must name a permitted read-only resource type'));
    if (!text(item.resourceId) || item.resourceId === '*' || item.resourceId === 'all' || !validId(item.resourceId)) errors.push(issue(`${p}.resourceId`, 'format', 'must name one explicit resource; wildcards are forbidden'));
    if (!exactString(item.resourceVersion)) errors.push(issue(`${p}.resourceVersion`, 'required', 'must pin an exact resource version'));
    if (!Array.isArray(item.operations) || item.operations.length === 0) errors.push(issue(`${p}.operations`, 'required', 'must name allowed operations'));
    else item.operations.forEach((operation, opIndex) => {
      if (!SAFE_TOOL_OPERATIONS.includes(operation)) errors.push(issue(`${p}.operations[${opIndex}]`, 'forbidden', `operation ${operation} is not allowed`));
    });
    if (item.readOnly !== true) errors.push(issue(`${p}.readOnly`, 'forbidden', 'M05 resource access is read-only'));
    const scopeText = item.scope === null || item.scope === undefined ? '' : JSON.stringify(item.scope);
    if (/\*/.test(scopeText)) errors.push(issue(`${p}.scope`, 'forbidden', 'resource scope wildcards are not allowed'));
    if (findForbiddenKeys(item, p).length) errors.push(issue(p, 'forbidden', 'resource whitelist contains a business-detail or side-effect field'));
  });
  return errors;
}

function normalizeReleaseInput(input = {}) {
  if (!isRecord(input)) return input;
  const allowlistInput = first(input, ['resourceWhitelist', 'resourceAllowlist', 'allowlist']);
  const groupedTools = isRecord(allowlistInput) && Array.isArray(allowlistInput.tools) ? allowlistInput.tools : [];
  const agent = normalizeRef(first(input, ['agent', 'agentRef']), 'agent');
  const prompt = normalizeRef(first(input, ['prompt', 'promptRef']), 'prompt');
  const skills = normalizeRefList(first(input, ['skills', 'skillRefs', 'skillVersions']), 'skill', 'skills');
  const tools = normalizeRefList(first(input, ['tools', 'toolRefs', 'toolVersions']), 'tool', 'tools');
  const toolAllowlistRef = normalizeRef(first(input, ['toolAllowlist', 'toolAllowlistRef', 'allowlistRef']), 'tool');
  const normalizedTools = tools.length ? tools : (groupedTools.length ? normalizeRefList(groupedTools, 'tool', 'tools') : (toolAllowlistRef ? [toolAllowlistRef] : []));
  const model = normalizeRef(first(input, ['model', 'modelRef']), 'model');
  const publishedOntologies = normalizeRefList(first(input, ['publishedOntologies', 'ontologyRefs', 'ontologies']), 'publishedOntology', 'publishedOntologies');
  const singularOntology = first(input, ['publishedOntology', 'publishedOntologyRef', 'ontology']);
  const normalizedOntologies = publishedOntologies.length ? publishedOntologies : (singularOntology ? [normalizeRef(singularOntology, 'publishedOntology')].filter(Boolean) : []);
  const scenario = normalizeRef(first(input, ['scenario', 'scenarioRef', 'scenarioBinding']), 'scenario');
  const validity = normalizeValidity(first(input, ['validity', 'effectiveTime', 'effectiveWindow']) || input.effectiveWindow);
  const resourceWhitelist = normalizeWhitelist(allowlistInput);
  const releaseVersion = first(input, ['releaseVersion', 'version']);
  const releaseId = first(input, ['releaseId', 'id']);
  const output = {
    schemaVersion: input.schemaVersion || AGENT_RELEASE_SCHEMA_VERSION,
    releaseId,
    releaseVersion,
    version: releaseVersion,
    status: input.status || input.lifecycleStatus || (input.state === 'enabled' ? 'active' : input.state) || 'draft',
    agent,
    prompt,
    skills,
    tools: normalizedTools,
    model,
    publishedOntologies: normalizedOntologies,
    ontology: normalizedOntologies,
    scenario,
    validity,
    resourceWhitelist,
    permissions: isRecord(input.permissions) ? cloneJson(input.permissions, 'permissions') : cloneJson(DEFAULT_RELEASE_PERMISSIONS, 'permissions'),
    outputContract: input.outputContract || input.outputType || null,
    validation: isRecord(input.validation) ? cloneJson(input.validation, 'validation') : null,
    createdAt: input.createdAt,
    publishedAt: input.publishedAt === undefined ? null : input.publishedAt,
    disabledAt: input.disabledAt === undefined ? null : input.disabledAt,
    disabledReason: input.disabledReason === undefined ? null : input.disabledReason,
    metadata: isRecord(input.metadata) ? cloneJson(input.metadata, 'metadata') : {},
    digest: input.digest
  };
  return output;
}

function validateResourceRef(value, type, path, options = {}) {
  const errors = [];
  if (!isRecord(value)) return [issue(path, 'required', `exact ${type} reference is required` )];
  if (!validId(value.id)) errors.push(issue(`${path}.id`, 'format', 'must be a stable non-empty identifier'));
  if (!exactString(value.version)) errors.push(issue(`${path}.version`, 'required', 'must pin an exact immutable version'));
  if (value.type && canonicalResourceType(value.type, value.type) !== canonicalResourceType(type, type)) errors.push(issue(`${path}.type`, 'mismatch', `must have type ${type}`));
  if (value.status !== undefined && ['draft', 'disabled', 'retired', 'deprecated'].includes(String(value.status).toLowerCase())) errors.push(issue(`${path}.status`, 'not-consumable', 'release references must point to a consumable immutable resource'));
  if (options.published && value.status && String(value.status).toLowerCase() !== 'published') errors.push(issue(`${path}.status`, 'not-published', 'Published ontology reference is not published'));
  return errors;
}

function validateAgentRelease(input, options = {}) {
  const source = normalizeReleaseInput(input);
  const errors = [];
  if (!isRecord(source)) return validationResult(false, [issue('$', 'type', 'Agent Release must be an object')]);
  if (source.schemaVersion !== AGENT_RELEASE_SCHEMA_VERSION) errors.push(issue('schemaVersion', 'version', `must equal ${AGENT_RELEASE_SCHEMA_VERSION}`));
  if (!validId(source.releaseId)) errors.push(issue('releaseId', 'format', 'must be a stable release identifier'));
  if (!exactString(source.releaseVersion)) errors.push(issue('releaseVersion', 'required', 'must pin an exact release version'));
  if (!RELEASE_STATUSES.includes(source.status)) errors.push(issue('status', 'enum', `must be one of ${RELEASE_STATUSES.join(', ')}`));
  errors.push(...validateResourceRef(source.agent, 'agent', 'agent'));
  errors.push(...validateResourceRef(source.prompt, 'prompt', 'prompt'));
  if (!Array.isArray(source.skills) || source.skills.length === 0) errors.push(issue('skills', 'required', 'at least one exact Skill reference is required'));
  else source.skills.forEach((ref, i) => errors.push(...validateResourceRef(ref, 'skill', `skills[${i}]`)));
  if (!Array.isArray(source.tools) || source.tools.length === 0) errors.push(issue('tools', 'required', 'at least one exact Tool reference is required'));
  else source.tools.forEach((ref, i) => errors.push(...validateResourceRef(ref, 'tool', `tools[${i}]`)));
  errors.push(...validateResourceRef(source.model, 'model', 'model'));
  if (!Array.isArray(source.publishedOntologies) || source.publishedOntologies.length === 0) errors.push(issue('publishedOntologies', 'required', 'at least one exact Published ontology reference is required'));
  else source.publishedOntologies.forEach((ref, i) => errors.push(...validateResourceRef(ref, 'publishedOntology', `publishedOntologies[${i}]`, { published: true })));
  errors.push(...validateResourceRef(source.scenario, 'scenario', 'scenario'));
  if (source.scenario && ['disabled', 'paused', 'retired', 'revoked', 'not-ready'].includes(String(source.scenario.status || '').toLowerCase())) errors.push(issue('scenario.status', 'inactive', 'scenario is not ready for new Agent runs'));
  if (source.scenario && source.scenario.status !== undefined && ['disabled', 'paused', 'retired', 'not-ready', 'unknown'].includes(String(source.scenario.status).toLowerCase())) errors.push(issue('scenario.status', 'inactive', 'Agent Release cannot bind an inactive scenario'));
  errors.push(...validateValidity(source.validity));
  errors.push(...validateWhitelist(source.resourceWhitelist));
  if (source.createdAt !== undefined && !isDateTime(source.createdAt)) errors.push(issue('createdAt', 'format', 'must be an RFC 3339 date-time'));
  if (source.publishedAt !== null && !isDateTime(source.publishedAt)) errors.push(issue('publishedAt', 'format', 'must be an RFC 3339 date-time or null'));
  if (source.disabledAt !== null && !isDateTime(source.disabledAt)) errors.push(issue('disabledAt', 'format', 'must be an RFC 3339 date-time or null'));
  if (source.permissions && isRecord(source.permissions)) {
    if (source.permissions.allowedRoles !== undefined && (!Array.isArray(source.permissions.allowedRoles) || source.permissions.allowedRoles.length === 0)) errors.push(issue('permissions.allowedRoles', 'required', 'must contain explicit roles'));
    if (source.permissions.denied !== undefined && !Array.isArray(source.permissions.denied)) errors.push(issue('permissions.denied', 'type', 'must be an array'));
  }
  if (source.validation !== null && (!isRecord(source.validation) || (source.validation.passed !== undefined && typeof source.validation.passed !== 'boolean'))) errors.push(issue('validation', 'format', 'validation must carry a boolean passed result'));
  if (source.digest !== undefined && (!text(source.digest) || !/^[a-f0-9]{64}$/i.test(source.digest) || source.digest !== digestRelease(source))) errors.push(issue('digest', 'integrity', 'Agent Release digest does not match its immutable resource tuple'));
  const forbidden = findForbiddenKeys(source, '$');
  // `metadata` is intentionally allowed, but never as a route to raw business
  // details or side effects.
  if (forbidden.length) errors.push(issue('$', 'forbidden', 'Agent Release contains forbidden business-detail or side-effect fields', { fields: forbidden }));
  if (options.requirePublished && source.status !== 'active') errors.push(issue('status', 'not-active', 'release must be active'));
  return validationResult(errors.length === 0, errors);
}

function assertAgentRelease(input, options = {}) {
  const source = normalizeReleaseInput(input);
  const result = validateAgentRelease(source, options);
  if (!result.valid) fail('INVALID_AGENT_RELEASE', 'Agent Release validation failed', result.errors);
  return source;
}

function digestRelease(release) {
  const source = normalizeReleaseInput(release) || {};
  const canonical = { ...source };
  delete canonical.digest;
  if (canonical.metadata && isRecord(canonical.metadata)) delete canonical.metadata.digest;
  return sha256(canonical);
}

function createAgentRelease(input, options = {}) {
  const source = normalizeReleaseInput(input);
  if (!source.releaseId) source.releaseId = `AR-${source.agent?.id || 'unknown'}-${source.releaseVersion || sha256(source).slice(0, 12)}`;
  if (!source.createdAt) source.createdAt = nowIso(options.clock || options.now);
  if (!source.status) source.status = 'draft';
  const result = validateAgentRelease(source);
  if (!result.valid) fail('INVALID_AGENT_RELEASE', 'cannot create invalid Agent Release', result.errors);
  source.digest = digestRelease(source);
  return immutable(source, 'Agent Release');
}

function publishAgentRelease(release, options = {}) {
  const source = assertAgentRelease(release);
  if (TERMINAL_RELEASE_STATUSES.includes(source.status)) fail('RELEASE_TERMINAL', 'a disabled or retired release cannot be published');
  if (!['validated', 'active'].includes(source.status)) fail('RELEASE_NOT_VALIDATED', 'only a validated Agent Release can be published');
  if (source.validation && source.validation.passed === false) fail('RELEASE_VALIDATION_REQUIRED', 'Agent Release evaluation has not passed');
  if (source.status === 'active' && options.republish !== true) return source;
  const publishedAt = nowIso(options.clock || options.now);
  if (!isWithinValidity(source.validity, publishedAt)) fail('RELEASE_OUTSIDE_VALIDITY', 'release validity window does not include publish time', { publishedAt, validity: source.validity });
  const nextWithoutDigest = { ...source, status: 'active', publishedAt };
  const next = { ...nextWithoutDigest, digest: digestRelease(nextWithoutDigest) };
  return immutable(next, 'published Agent Release');
}

function disableAgentRelease(release, reason, options = {}) {
  const source = assertAgentRelease(release);
  if (!text(reason)) fail('DISABLE_REASON_REQUIRED', 'disabling a release requires a reason');
  const disabledAt = nowIso(options.clock || options.now);
  return immutable({ ...source, status: 'disabled', disabledAt, disabledReason: reason.trim(), digest: digestRelease({ ...source, status: 'disabled', disabledAt, disabledReason: reason.trim() }) }, 'disabled Agent Release');
}

function releaseRefs(release) {
  const source = assertAgentRelease(release);
  return {
    release: { type: 'agentRelease', id: source.releaseId, version: source.releaseVersion, digest: source.digest || digestRelease(source) },
    agent: source.agent,
    prompt: source.prompt,
    skills: source.skills,
    tools: source.tools,
    model: source.model,
    publishedOntologies: source.publishedOntologies,
    scenario: source.scenario,
    validity: source.validity,
    resourceWhitelist: source.resourceWhitelist
  };
}

function normalizeScenarioContext(value) {
  const source = isRecord(value?.scenarioContext) ? value.scenarioContext : value;
  if (!isRecord(source)) return null;
  return {
    scenarioId: first(source, ['scenarioId']),
    scenarioVersion: first(source, ['scenarioVersion']),
    scenarioRunId: first(source, ['scenarioRunId']),
    formedAt: first(source, ['formedAt']),
    status: first(source, ['status'])
  };
}

function validateScenario(value, path = 'scenarioContext') {
  const context = normalizeScenarioContext(value);
  if (!context) return [issue(path, 'type', 'C033 scenario context must be an object')];
  if (identity && typeof identity.validateScenarioContext === 'function') {
    const result = identity.validateScenarioContext(context);
    return result.valid ? [] : result.errors.map((item) => ({ ...item, path: item.path || path }));
  }
  const errors = [];
  ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'formedAt', 'status'].forEach((field) => {
    if (!text(context[field])) errors.push(issue(`${path}.${field}`, 'required', 'is required'));
  });
  if (context.formedAt && !isDateTime(context.formedAt)) errors.push(issue(`${path}.formedAt`, 'format', 'must be RFC 3339 date-time'));
  return errors;
}

function normalizeRefField(value, aliases, type) {
  const candidate = first(value, aliases);
  if (candidate === undefined || candidate === null) return null;
  const ref = normalizeRef(candidate, type, type, { allowUnversioned: false });
  if (ref && exactString(ref.version)) return ref;
  if (isRecord(candidate)) {
    const id = first(candidate, ['id', 'refId', 'resourceId', 'summaryId', 'verificationId', 'resultId', 'evidenceId']);
    const version = first(candidate, ['version', 'refVersion', 'resourceVersion', 'summaryVersion', 'verificationVersion', 'resultVersion', 'evidenceVersion']);
    const owner = first(candidate, ['owner', 'ownerModule', 'source', 'sourceModule']);
    return { type, id, version, ...(text(owner) ? { owner } : {}) };
  }
  return { type, id: candidate };
}

function normalizeFixedReportContext(input = {}) {
  const source = isRecord(input) ? input : {};
  const scenario = normalizeScenarioContext(source);
  const evidence = first(source, ['evidencePackage', 'evidencePackageRef']);
  const anchor = first(source, ['stableAnchor', 'anchor', 'anchorSnapshot']);
  const ontology = first(source, ['publishedOntology', 'ontologyBinding', 'ontology']);
  const context = {
  scenarioId: first(source, ['scenarioId']) || scenario?.scenarioId,
  scenarioVersion: first(source, ['scenarioVersion']) || scenario?.scenarioVersion,
  scenarioRunId: first(source, ['scenarioRunId']) || scenario?.scenarioRunId,
    formedAt: first(source, ['formedAt']) || scenario?.formedAt,
    status: first(source, ['status']) || scenario?.status,
    reportId: first(source, ['reportId', 'reportNumber', 'reportRefId']),
    contentVersion: first(source, ['contentVersion', 'reportContentVersion', 'contentVersionId']),
    evidencePackageId: first(source, ['evidencePackageId', 'evidenceId']) || (isRecord(evidence) ? first(evidence, ['id', 'refId', 'evidenceId']) : undefined),
    evidencePackageVersion: first(source, ['evidencePackageVersion', 'evidenceVersion']) || (isRecord(evidence) ? first(evidence, ['version', 'refVersion', 'evidenceVersion']) : undefined),
    semanticResourceId: first(source, ['semanticResourceId', 'publishedOntologyId', 'ontologyId', 'semanticResourceRefId']) || (isRecord(ontology) ? first(ontology, ['id', 'refId', 'resourceId']) : undefined),
    semanticVersion: first(source, ['semanticVersion', 'publishedOntologyVersion', 'ontologyVersion', 'semanticResourceVersion']) || (isRecord(ontology) ? first(ontology, ['version', 'refVersion', 'resourceVersion']) : undefined),
    dataAssetVersion: first(source, ['dataAssetVersion', 'dataVersion', 'exactDataVersion']),
    dataAsOf: first(source, ['dataAsOf', 'dataCutoffAt', 'asOf']),
    anchorSnapshotId: first(source, ['anchorSnapshotId', 'stableAnchorSnapshotId']) || (isRecord(anchor) ? first(anchor, ['id', 'refId', 'snapshotId']) : undefined),
    anchorSnapshotVersion: first(source, ['anchorSnapshotVersion', 'stableAnchorVersion']) || (isRecord(anchor) ? first(anchor, ['version', 'refVersion', 'snapshotVersion']) : undefined),
    selectedAnchor: first(source, ['selectedAnchor', 'selectedAnchorId', 'anchorId']) || (isRecord(anchor) ? first(anchor, ['selected', 'selectedAnchor']) : undefined),
    credibilitySummaryRef: normalizeRefField(source, ['credibilitySummaryRef', 'credibilitySummary', 'c017Summary', 'c017'], 'credibilitySummary'),
    verificationResultRef: normalizeRefField(source, ['verificationResultRef', 'deterministicVerificationResultRef', 'verificationResult', 'm06Verification'], 'verificationResult'),
    permission: source.permission === undefined ? (source.permissions === undefined ? null : cloneJson(source.permissions, 'permission')) : cloneJson(source.permission, 'permission')
  };
  return context;
}

function validateSafeReference(value, type, path, options = {}) {
  if (value === null || value === undefined) return options.required ? [issue(path, 'required', `${type} reference is required`)] : [];
  const errors = validateResourceRef(value, type, path);
  if (options.owner && value.owner && value.owner !== options.owner) errors.push(issue(`${path}.owner`, 'owner-mismatch', `must be owned by ${options.owner}`));
  return errors;
}

function validateFixedReportContext(input, options = {}) {
  const source = isRecord(input) ? input : {};
  const context = normalizeFixedReportContext(source);
  const errors = [];
  const forbidden = findForbiddenKeys(source, '$');
  if (forbidden.length) errors.push(issue('$', 'forbidden-input', 'C024 must contain safe structured references only', { fields: forbidden }));
  const summaryFields = first(source, ['credibilitySummary', 'c017Summary', 'c017']);
  if (summaryFields && findForbiddenContractFields(summaryFields, 'credibilitySummary', SUMMARY_FORBIDDEN_KEY_RE).length) errors.push(issue('credibilitySummary', 'forbidden-input', 'C017 input must be a metadata summary, not business detail'));
  const verificationFields = first(source, ['verificationResult', 'deterministicVerificationResult', 'm06Verification']);
  if (verificationFields && findForbiddenContractFields(verificationFields, 'verificationResult', VERIFICATION_FORBIDDEN_KEY_RE).length) errors.push(issue('verificationResult', 'forbidden-input', 'M06 input must preserve deterministic states and references only'));
  validateScenario(context).forEach((item) => errors.push(item));
  if (['disabled', 'paused', 'retired', 'revoked', 'unknown'].includes(String(context.status || '').toLowerCase())) errors.push(issue('status', 'inactive', 'scenario context is not active for a new Agent run'));
  REQUIRED_REPORT_CONTEXT_FIELDS.forEach((field) => {
    const value = context[field];
    if (value === undefined || value === null || value === '') errors.push(issue(field, 'required', 'fixed report context field is required'));
  });
  ['scenarioId', 'scenarioVersion', 'scenarioRunId', 'reportId', 'contentVersion', 'evidencePackageId', 'evidencePackageVersion', 'semanticResourceId', 'semanticVersion', 'dataAssetVersion', 'anchorSnapshotId', 'anchorSnapshotVersion', 'selectedAnchor'].forEach((field) => {
    if (context[field] !== undefined && !exactString(String(context[field]))) errors.push(issue(field, 'format', 'must be an exact non-whitespace identifier/version'));
  });
  if (context.dataAsOf !== undefined && !isDateTime(context.dataAsOf)) errors.push(issue('dataAsOf', 'format', 'must be an RFC 3339 date-time'));
  const ontology = first(source, ['publishedOntology', 'ontologyBinding', 'ontology']);
  if (isRecord(ontology) && ontology.status !== undefined && String(ontology.status).toLowerCase() !== 'published') errors.push(issue('publishedOntology.status', 'not-published', 'only a Published ontology may enter a fixed report context'));
  if (isRecord(ontology) && ontology.owner && !/^M01(?:$|[/:_-])/i.test(String(ontology.owner))) errors.push(issue('publishedOntology.owner', 'owner-mismatch', 'Published ontology must be supplied by M01'));
  errors.push(...validateSafeReference(context.credibilitySummaryRef, 'credibilitySummary', 'credibilitySummaryRef', { required: true }));
  if (context.credibilitySummaryRef && context.credibilitySummaryRef.owner && !/^M02(?:$|[/:_-])/i.test(context.credibilitySummaryRef.owner)) errors.push(issue('credibilitySummaryRef.owner', 'owner-mismatch', 'C017 summary must be supplied by M02/data engineering'));
  if (options.requireVerification === true) errors.push(...validateSafeReference(context.verificationResultRef, 'verificationResult', 'verificationResultRef', { required: true }));
  if (context.verificationResultRef && context.verificationResultRef.owner && !/^M06(?:$|[/:_-])/i.test(context.verificationResultRef.owner)) errors.push(issue('verificationResultRef.owner', 'owner-mismatch', 'deterministic verification result must be supplied by M06'));
  if (options.requireAllowed !== false && context.permission !== null && (!isRecord(context.permission) || context.permission.allowed !== true)) errors.push(issue('permission', 'denied', 'C024 permission result must explicitly allow the fixed context'));
  if (options.allowedFields) {
    const allowed = new Set(REPORT_CONTEXT_FIELDS.concat(options.allowedFields));
    Object.keys(source).forEach((key) => {
      if (key !== 'scenarioContext' && !allowed.has(key) && !['evidencePackage', 'evidencePackageRef', 'stableAnchor', 'anchor', 'anchorSnapshot', 'permissions', 'c017Summary', 'c017', 'verificationResult', 'm06Verification'].includes(key)) errors.push(issue(key, 'unknown', 'field is not allowed in fixed report context'));
    });
  }
  return validationResult(errors.length === 0, errors);
}

function assertFixedReportContext(input, options = {}) {
  const result = validateFixedReportContext(input, options);
  if (!result.valid) fail('INVALID_FIXED_REPORT_CONTEXT', 'fixed report context validation failed', result.errors);
  return immutable(normalizeFixedReportContext(input), 'fixed report context');
}

function compareFixedReportContext(left, right, options = {}) {
  const a = normalizeFixedReportContext(left);
  const b = normalizeFixedReportContext(right);
  const fields = options.fields || REPORT_CONTEXT_FIELDS.filter((field) => field !== 'permission');
  const mismatches = [];
  fields.forEach((field) => {
    const av = field.endsWith('Ref') ? refKeySafe(a[field]) : (a[field] === undefined ? null : a[field]);
    const bv = field.endsWith('Ref') ? refKeySafe(b[field]) : (b[field] === undefined ? null : b[field]);
    if (stableSerialize(av) !== stableSerialize(bv)) mismatches.push({ field, left: av, right: bv });
  });
  return { same: mismatches.length === 0, mismatches };
}

function refKeySafe(ref) {
  if (!ref) return null;
  return isRecord(ref) ? `${ref.type || ''}:${ref.id || ref.refId || ''}:${ref.version || ref.refVersion || ''}` : String(ref);
}

function assertReleaseContext(release, context, options = {}) {
  const source = assertAgentRelease(release, { requirePublished: options.requirePublished !== false });
  const fixed = assertFixedReportContext(context, options);
  const mismatches = [];
  if (source.scenario.id !== fixed.scenarioId || source.scenario.version !== fixed.scenarioVersion) mismatches.push({ field: 'scenario', release: source.scenario, context: { id: fixed.scenarioId, version: fixed.scenarioVersion } });
  const validityAt = options.at || new Date().toISOString();
  if (options.checkValidity !== false && !isWithinValidity(source.validity, validityAt)) mismatches.push({ field: 'validity', at: validityAt, validity: source.validity });
  const ontologyVersions = source.publishedOntologies.map((ref) => ref.version);
  const ontologyIds = source.publishedOntologies.map((ref) => ref.id);
  if (!ontologyVersions.includes(fixed.semanticVersion) && options.requireOntologyMatch !== false) mismatches.push({ field: 'semanticVersion', release: ontologyVersions, context: fixed.semanticVersion });
  if (fixed.semanticResourceId && !ontologyIds.includes(fixed.semanticResourceId) && options.requireOntologyMatch !== false) mismatches.push({ field: 'semanticResourceId', release: ontologyIds, context: fixed.semanticResourceId });
  if (mismatches.length) fail('CONTEXT_MISMATCH', 'Agent Release does not match fixed report context', { mismatches });
  return immutable({ release: releaseRefs(source), context: fixed, bindingDigest: sha256({ release: releaseRefs(source), context: fixed }) }, 'release context binding');
}

function matchWhitelistEntry(entry, request) {
  if (!entry || !request) return false;
  const type = request.resourceType || request.type;
  const id = request.resourceId || request.id || request.refId;
  const version = request.resourceVersion || request.version || request.refVersion;
  if (entry.resourceType !== type || entry.resourceId !== id || entry.resourceVersion !== version) return false;
  const operation = request.operation || request.action;
  if (!entry.operations.includes(operation)) return false;
  if (request.scope !== undefined && entry.scope !== null && entry.scope !== undefined && !scopeWithin(request.scope, entry.scope)) return false;
  return true;
}

function scopeWithin(actual, allowed) {
  if (actual === undefined || actual === null) return true;
  if (allowed === undefined || allowed === null) return false;
  if (Array.isArray(actual)) return Array.isArray(allowed) && actual.every((item) => allowed.includes(item));
  if (isRecord(actual) && isRecord(allowed)) return Object.keys(actual).every((key) => Object.prototype.hasOwnProperty.call(allowed, key) && scopeWithin(actual[key], allowed[key]));
  return actual === allowed;
}

function actorRoles(actor) {
  if (!isRecord(actor)) return [];
  const roles = Array.isArray(actor.roles) ? actor.roles : (text(actor.role) ? [actor.role] : []);
  return roles.map((role) => String(role).trim());
}

function hasPermission(actor, permission, options = {}) {
  const roles = actorRoles(actor);
  const explicit = Array.isArray(actor?.permissions) ? actor.permissions : [];
  if (roles.includes('admin') || explicit.includes('*') || explicit.includes(permission)) return true;
  return roles.some((role) => (DEFAULT_ROLE_PERMISSIONS[role] || []).includes('*') || (DEFAULT_ROLE_PERMISSIONS[role] || []).includes(permission));
}

function authorize(actor, permission, options = {}) {
  const allowedRoles = options.allowedRoles || null;
  const roles = actorRoles(actor);
  if (allowedRoles && !roles.some((role) => allowedRoles.includes(role)) && !roles.includes('admin')) return { allowed: false, code: 'ROLE_NOT_ALLOWED', reason: 'actor role is not allowed for this operation', roles, permission };
  if (Array.isArray(options.denied) && (options.denied.includes('*') || options.denied.includes(permission))) return { allowed: false, code: 'PERMISSION_DENIED', reason: `permission ${permission} is denied by the release policy`, roles, permission };
  if (!hasPermission(actor, permission, options)) return { allowed: false, code: 'PERMISSION_DENIED', reason: `missing permission ${permission}`, roles, permission };
  if (options.scenarioId && !roles.includes('admin')) {
    const scopedIds = Array.isArray(actor?.scenarioIds) ? actor.scenarioIds : (text(actor?.scenarioId) ? [actor.scenarioId] : null);
    if (scopedIds && !scopedIds.includes(options.scenarioId)) return { allowed: false, code: 'SCENARIO_SCOPE_DENIED', reason: 'actor is not scoped to this scenario', roles, permission };
  }
  return { allowed: true, code: 'ALLOWED', roles, permission };
}

function assertPermission(actor, permission, options = {}) {
  const decision = authorize(actor, permission, options);
  if (!decision.allowed) permissionFail(decision.code, decision.reason, decision);
  return decision;
}

function validateToolCall(release, request, options = {}) {
  const source = normalizeReleaseInput(release) || {};
  const call = isRecord(request) ? request : {};
  const errors = [];
  const toolId = first(call, ['toolId', 'id', 'tool']);
  const toolVersion = first(call, ['toolVersion', 'version']);
  const operation = first(call, ['operation', 'action']);
  const resourceType = first(call, ['resourceType', 'targetType', 'type']);
  const resourceId = first(call, ['resourceId', 'targetId', 'refId']);
  const resourceVersion = first(call, ['resourceVersion', 'targetVersion', 'refVersion', 'version']);
  if (!text(toolId) || !validId(toolId)) errors.push(issue('toolId', 'required', 'exact tool id is required'));
  if (!exactString(toolVersion)) errors.push(issue('toolVersion', 'required', 'exact tool version is required'));
  if (!SAFE_TOOL_OPERATIONS.includes(operation)) errors.push(issue('operation', 'forbidden', 'tool operation is not on the safe allowlist'));
  if (FORBIDDEN_TOOL_RE.test(String(toolId || '')) || FORBIDDEN_TOOL_RE.test(String(operation || ''))) errors.push(issue('toolId', 'forbidden', 'tool or operation is prohibited by M05 boundary'));
  const boundTool = source.tools?.find((ref) => ref.id === toolId && ref.version === toolVersion);
  if (!boundTool) errors.push(issue('tool', 'mismatch', 'tool is not bound to this exact Agent Release'));
  const whitelistRequest = { resourceType, resourceId, resourceVersion, operation, scope: call.scope };
  if (!source.resourceWhitelist?.some((entry) => matchWhitelistEntry(entry, whitelistRequest))) errors.push(issue('resource', 'not-allowlisted', 'resource and operation are not explicitly allowlisted'));
  if (!text(resourceId) || resourceId === '*' || FORBIDDEN_RESOURCE_RE.test(String(resourceType || '')) || FORBIDDEN_RESOURCE_RE.test(String(resourceId || ''))) errors.push(issue('resource', 'forbidden', 'resource is not an allowed structured reference'));
  if (call.payload !== undefined && findForbiddenKeys(call.payload, 'payload').length) errors.push(issue('payload', 'forbidden', 'tool payload contains business detail or side-effect fields'));
  const permission = authorize(options.actor || call.actor, options.permission || 'agent.tool.read', { allowedRoles: source.permissions?.allowedRoles, denied: source.permissions?.denied, scenarioId: options.scenarioId || source.scenario?.id });
  if (!permission.allowed) errors.push(issue('actor', permission.code, permission.reason));
  return validationResult(errors.length === 0, errors);
}

function assertToolCall(release, request, options = {}) {
  const result = validateToolCall(release, request, options);
  if (!result.valid) permissionFail('TOOL_NOT_ALLOWLISTED', 'tool call rejected by Agent Release policy', result.errors);
  const call = isRecord(request) ? request : {};
  return immutable({ allowed: true, toolId: call.toolId || call.id, toolVersion: call.toolVersion || call.version, operation: call.operation || call.action, resourceType: call.resourceType, resourceId: call.resourceId, resourceVersion: call.resourceVersion, readOnly: true }, 'tool authorization');
}

function scanPromptInjection(value, options = {}, path = '$', findings = []) {
  if (typeof value === 'string') {
    PROMPT_INJECTION_PATTERNS.forEach((pattern) => {
      if (pattern.re.test(value)) findings.push({ path, code: pattern.code, evidence: options.includeEvidence ? value.slice(0, 160) : undefined });
    });
    return findings;
  }
  if (Array.isArray(value)) value.forEach((item, index) => scanPromptInjection(item, options, `${path}[${index}]`, findings));
  else if (isRecord(value)) Object.keys(value).forEach((key) => scanPromptInjection(value[key], options, `${path}.${key}`, findings));
  return findings;
}

function detectPromptInjection(value, options = {}) {
  const findings = scanPromptInjection(value, options);
  return { detected: findings.length > 0, findings };
}

function assertNoPromptInjection(value, options = {}) {
  const result = detectPromptInjection(value, options);
  if (result.detected) fail('PROMPT_INJECTION_DETECTED', 'untrusted prompt/context content contains an instruction injection pattern', result.findings);
  return true;
}

function preparePromptInput(input = {}, options = {}) {
  const source = isRecord(input) ? input : {};
  const untrusted = {
    userInput: source.userInput === undefined ? '' : String(source.userInput),
    evidenceText: source.evidenceText === undefined ? '' : String(source.evidenceText),
    externalContent: source.externalContent === undefined ? '' : String(source.externalContent)
  };
  const scan = detectPromptInjection(untrusted, options);
  if (scan.detected && options.reject !== false) fail('PROMPT_INJECTION_DETECTED', 'untrusted content rejected before model invocation', scan.findings);
  const promptCandidate = source.systemPromptRef || source.promptRef;
  const trustedSystemPromptRef = promptCandidate === undefined ? null : normalizeRef(promptCandidate, 'prompt');
  if (promptCandidate !== undefined && !trustedSystemPromptRef) fail('PROMPT_REFERENCE_REQUIRED', 'prompt input must pin an exact Prompt version');
  return immutable({
    schemaVersion: 'ofw.m05.prompt-input.v1',
    trustedSystemPromptRef,
    untrustedSections: Object.freeze(Object.fromEntries(Object.entries(untrusted).map(([key, value]) => [key, { value, delimiter: `BEGIN_UNTRUSTED_${key.toUpperCase()}` }]))),
    injection: scan,
    instructionPriority: ['trusted-system-prompt', 'fixed-structured-context', 'user-question', 'untrusted-evidence-text'],
    noToolAuthorityFromContent: true
  }, 'prompt input');
}

function safeAuditReference(value, label) {
  if (value === null || value === undefined) return null;
  const source = isRecord(value) ? value : { id: value };
  const id = first(source, ['id', 'refId', 'resourceId', 'stableId']);
  const version = first(source, ['version', 'refVersion', 'resourceVersion']);
  const type = first(source, ['type', 'refType', 'resourceType']);
  if (!text(id) || !exactString(version)) return { redacted: true, label, digest: sha256(value) };
  return {
    ...(text(type) ? { type: type.trim() } : {}),
    id: id.trim(),
    version: version.trim(),
    ...(text(source.digest) ? { digest: source.digest.trim() } : {})
  };
}

function createAuditEntry(event, state) {
  const source = isRecord(event) ? event : {};
  const seq = state.nextSequence;
  const formedAt = source.formedAt || state.clock();
  if (!isDateTime(formedAt)) fail('INVALID_AUDIT_TIME', 'audit formedAt must be RFC 3339 date-time');
  const context = source.scenarioContext ? normalizeScenarioContext(source.scenarioContext) : null;
  if (context) {
    const contextErrors = validateScenario(context);
    if (contextErrors.length) fail('INVALID_AUDIT_CONTEXT', 'audit scenario context is invalid', contextErrors);
  }
  const safe = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    auditId: source.auditId || `AUD-${crypto.randomUUID()}`,
    sequence: seq,
    eventType: text(source.eventType) ? source.eventType.trim() : 'agent.operation',
    operation: text(source.operation) ? source.operation.trim() : 'unknown',
    actorRef: source.actorRef === undefined ? null : (text(source.actorRef) ? source.actorRef.trim() : safeAuditReference(source.actorRef, 'actorRef')),
    traceId: text(source.traceId) ? source.traceId.trim() : null,
    correlationId: text(source.correlationId) ? source.correlationId.trim() : null,
    scenarioContext: context,
    releaseRef: source.releaseRef ? safeAuditReference(source.releaseRef, 'releaseRef') : null,
    resourceRef: source.resourceRef ? safeAuditReference(source.resourceRef, 'resourceRef') : null,
    outcome: text(source.outcome) ? source.outcome.trim() : 'recorded',
    reasonCode: text(source.reasonCode) ? source.reasonCode.trim() : null,
    redactedFields: [],
    formedAt,
    previousHash: state.previousHash || null
  };
  const forbidden = findForbiddenKeys(source, '$');
  if (forbidden.length) safe.redactedFields = forbidden.map((item) => item.path);
  safe.hash = sha256(safe);
  return immutable(safe, 'audit entry');
}

class AppendOnlyAuditLog {
  constructor(options = {}) {
    this._clock = () => nowIso(options.clock || options.now);
    this._entries = [];
    this._previousHash = null;
    this._sink = typeof options.sink === 'function' ? options.sink : null;
  }

  append(event) {
    const entry = createAuditEntry(event, { nextSequence: this._entries.length + 1, previousHash: this._previousHash, clock: this._clock });
    this._entries.push(entry);
    this._previousHash = entry.hash;
    if (this._sink) this._sink(cloneJson(entry, 'audit sink entry'));
    return entry;
  }

  record(event) { return this.append(event); }
  get length() { return this._entries.length; }
  entries() { return this._entries.map((entry) => cloneJson(entry, 'audit entry')); }
  snapshot() { return immutable({ schemaVersion: AUDIT_SCHEMA_VERSION, entries: this._entries, tailHash: this._previousHash }, 'audit snapshot'); }
  verify() { return verifyAuditChain(this._entries); }

  static fromSnapshot(snapshot, options = {}) {
    if (!isRecord(snapshot) || snapshot.schemaVersion !== AUDIT_SCHEMA_VERSION || !Array.isArray(snapshot.entries)) fail('INVALID_AUDIT_SNAPSHOT', 'audit snapshot is invalid');
    const verification = verifyAuditChain(snapshot.entries);
    if (!verification.valid) fail('INVALID_AUDIT_SNAPSHOT', 'audit snapshot hash chain is invalid', verification.errors);
    if (snapshot.tailHash !== undefined && (snapshot.entries.at(-1)?.hash || null) !== snapshot.tailHash) fail('INVALID_AUDIT_SNAPSHOT', 'audit snapshot tail hash does not match entries');
    const log = new AppendOnlyAuditLog(options);
    log._entries = snapshot.entries.map((entry) => immutable(entry, 'audit entry'));
    log._previousHash = snapshot.entries.at(-1)?.hash || null;
    return log;
  }
}

function verifyAuditChain(entries) {
  if (!Array.isArray(entries)) return validationResult(false, [issue('$', 'type', 'audit entries must be an array')]);
  const errors = [];
  let previous = null;
  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(issue(`[${index}]`, 'type', 'audit entry must be an object'));
      return;
    }
    if (entry.sequence !== index + 1) errors.push(issue(`[${index}].sequence`, 'chain', 'audit sequence is not contiguous'));
    if ((entry.previousHash || null) !== previous) errors.push(issue(`[${index}].previousHash`, 'chain', 'audit previous hash mismatch'));
    const copy = { ...entry };
    delete copy.hash;
    if (sha256(copy) !== entry.hash) errors.push(issue(`[${index}].hash`, 'integrity', 'audit hash mismatch'));
    previous = entry.hash;
  });
  return validationResult(errors.length === 0, errors);
}

class ResourceRegistry {
  constructor(options = {}) {
    const initialResources = Array.isArray(options) ? options : (Array.isArray(options.resources) ? options.resources : []);
    const config = Array.isArray(options) ? {} : options;
    this.schemaVersion = RESOURCE_REGISTRY_SCHEMA_VERSION;
    this._resources = new Map();
    this._releases = new Map();
    this._audit = config.auditLog || new AppendOnlyAuditLog(config);
    initialResources.forEach((resource) => {
      const type = resource.type || resource.resourceType || resource.refType;
      const ref = normalizeRef(resource, type);
      if (!ref || !exactString(ref.version)) fail('INVALID_RESOURCE_REF', 'initial registry resources require exact id/version');
      if (type === 'prompt' || type === 'skill') {
        const promptBody = first(resource, ['body', 'text', 'content', 'instructions', 'description']);
        if (text(promptBody)) assertNoPromptInjection(promptBody, { includeEvidence: false });
      }
      const base = { ...cloneJson(resource, 'resource'), type: canonicalResourceType(type, type), id: ref.id, version: ref.version };
      const normalized = immutable({ ...base, digest: resource.digest || sha256(base) }, 'resource');
      const key = refKey({ type: normalized.type, id: normalized.id, version: normalized.version });
      if (this._resources.has(key)) fail('RESOURCE_DUPLICATE', `duplicate resource ${key}`);
      this._resources.set(key, normalized);
    });
  }

  register(type, value, options = {}) {
    if (!RESOURCE_TYPES.includes(type)) fail('UNKNOWN_RESOURCE_TYPE', `resource type ${type} is not supported`);
    const ref = normalizeRef(value, type);
    if (!ref) fail('INVALID_RESOURCE_REF', `resource ${type} must provide exact id and version`);
    if (!exactString(ref.version)) fail('EXACT_VERSION_REQUIRED', `resource ${type} requires an exact immutable version`, { type, id: ref.id, version: ref.version });
    if (FORBIDDEN_RESOURCE_RE.test(ref.id) || FORBIDDEN_RESOURCE_RE.test(type)) fail('FORBIDDEN_RESOURCE', 'business-detail or side-effect resource cannot be registered');
    if (value.digest !== undefined && (!text(value.digest) || !/^[a-f0-9]{64}$/i.test(value.digest))) fail('INVALID_RESOURCE_DIGEST', 'resource digest must be a SHA-256 hex string');
    if (type === 'prompt' || type === 'skill') {
      const promptBody = first(value, ['body', 'text', 'content', 'instructions', 'description']);
      if (text(promptBody)) assertNoPromptInjection(promptBody, { includeEvidence: false });
    }
    const resourceBase = { ...cloneJson(value, 'resource'), id: ref.id, version: ref.version, type };
    const resource = immutable({ ...resourceBase, digest: value.digest || sha256(resourceBase) }, 'resource');
    const key = refKey(ref);
    const existing = this._resources.get(key);
    if (existing) {
      if (existing.digest !== resource.digest) fail('RESOURCE_IDENTITY_CONFLICT', 'same resource identity has a different digest', { key });
      return existing;
    }
    this._resources.set(key, resource);
    this._audit.append({ eventType: 'agent.resource.register', operation: 'register-resource', actorRef: options.actorRef, traceId: options.traceId, correlationId: options.correlationId, resourceRef: ref, outcome: 'accepted', reasonCode: 'RESOURCE_REGISTERED' });
    return resource;
  }

  resolve(type, id, version) {
    if (!exactString(version)) fail('EXACT_VERSION_REQUIRED', 'resource resolution requires an exact version');
    const value = this._resources.get(refKey({ type, id, version }));
    if (!value) fail('RESOURCE_NOT_FOUND', 'exact resource version is not registered', { type, id, version });
    return value;
  }

  get(type, id, version) {
    try { return this.resolve(type, id, version); } catch (_) { return null; }
  }

  has(value) {
    const ref = normalizeRef(value, value?.type || value?.resourceType || value?.refType);
    return Boolean(ref && exactString(ref.version) && this._resources.has(refKey(ref)));
  }

  list(type) {
    return Array.from(this._resources.values()).filter((resource) => !type || resource.type === type).map((resource) => cloneJson(resource));
  }

  createRelease(input, options = {}) {
    const release = createAgentRelease(input, options);
    const refs = [release.agent, release.prompt, ...release.skills, ...release.tools, release.model, ...release.publishedOntologies, release.scenario];
    refs.forEach((ref) => {
      const resource = this.resolve(ref.type, ref.id, ref.version);
      if (['draft', 'disabled', 'retired', 'deprecated'].includes(String(resource.status || '').toLowerCase())) fail('RESOURCE_NOT_CONSUMABLE', 'Agent Release may only bind a consumable resource', { ref, status: resource.status });
      if (ref.type === 'publishedOntology' && String(resource.status || '').toLowerCase() !== 'published') fail('ONTOLOGY_NOT_PUBLISHED', 'Agent Release may only bind a Published ontology', { ref });
      if (ref.type === 'publishedOntology' && resource.owner && !/^M01(?:$|[/:_-])/i.test(String(resource.owner))) fail('ONTOLOGY_OWNER_MISMATCH', 'Published ontology must be owned by M01', { ref, owner: resource.owner });
    });
    const existing = this._releases.get(`${release.releaseId}:${release.releaseVersion}`);
    if (existing && existing.digest !== release.digest) fail('RELEASE_IDENTITY_CONFLICT', 'same release identity has a different digest');
    this._releases.set(`${release.releaseId}:${release.releaseVersion}`, release);
    this._audit.append({ eventType: 'agent.release.create', operation: 'create-release', actorRef: options.actorRef, traceId: options.traceId, correlationId: options.correlationId, releaseRef: releaseRefs(release).release, outcome: 'accepted', reasonCode: 'RELEASE_CREATED' });
    return release;
  }

  publish(releaseOrId, version, options = {}) {
    if (isRecord(version) && arguments.length < 3) {
      options = version;
      version = undefined;
    }
    const release = isRecord(releaseOrId) ? releaseOrId : this.getRelease(releaseOrId, version);
    const published = publishAgentRelease(release, options);
    // Keep one default active Release per Agent + Scenario while retaining
    // every prior immutable snapshot as historical. Existing runs continue
    // to reference their original digest.
    for (const [key, existing] of this._releases) {
      if (existing.status !== 'active' || existing.releaseId === published.releaseId && existing.releaseVersion === published.releaseVersion) continue;
      if (existing.agent?.id === published.agent?.id && existing.scenario?.id === published.scenario?.id) {
        const historicalBase = { ...existing, status: 'retired', retiredAt: published.publishedAt, retiredBy: { id: published.releaseId, version: published.releaseVersion } };
        this._releases.set(key, immutable({ ...historicalBase, digest: digestRelease(historicalBase) }, 'historical Agent Release'));
      }
    }
    this._releases.set(`${published.releaseId}:${published.releaseVersion}`, published);
    this._audit.append({ eventType: 'agent.release.publish', operation: 'publish-release', actorRef: options.actorRef, traceId: options.traceId, correlationId: options.correlationId, releaseRef: releaseRefs(published).release, outcome: 'accepted', reasonCode: 'RELEASE_PUBLISHED' });
    return published;
  }

  disable(releaseOrId, version, reason, options = {}) {
    if (isRecord(version) && reason === undefined) {
      options = version;
      version = undefined;
      reason = options.reason;
    }
    const release = isRecord(releaseOrId) ? releaseOrId : this.getRelease(releaseOrId, version);
    const disabled = disableAgentRelease(release, reason, options);
    this._releases.set(`${disabled.releaseId}:${disabled.releaseVersion}`, disabled);
    this._audit.append({ eventType: 'agent.release.disable', operation: 'disable-release', actorRef: options.actorRef, traceId: options.traceId, correlationId: options.correlationId, releaseRef: releaseRefs(disabled).release, outcome: 'accepted', reasonCode: 'RELEASE_DISABLED' });
    return disabled;
  }

  getRelease(id, version) {
    if (!exactString(version)) fail('EXACT_VERSION_REQUIRED', 'release resolution requires an exact version');
    const value = this._releases.get(`${id}:${version}`);
    if (!value) fail('RELEASE_NOT_FOUND', 'exact Agent Release is not registered', { id, version });
    return value;
  }

  listReleases(options = {}) {
    return Array.from(this._releases.values()).filter((release) => !options.status || release.status === options.status).map((release) => cloneJson(release));
  }

  auditLog() { return this._audit; }
  snapshot() {
    return immutable({ schemaVersion: RESOURCE_REGISTRY_SCHEMA_VERSION, resources: Array.from(this._resources.values()), releases: Array.from(this._releases.values()), audit: this._audit.snapshot() }, 'resource registry snapshot');
  }

  export() { return this.snapshot(); }

  static fromSnapshot(snapshot, options = {}) {
    if (!isRecord(snapshot) || snapshot.schemaVersion !== RESOURCE_REGISTRY_SCHEMA_VERSION || !Array.isArray(snapshot.resources) || !Array.isArray(snapshot.releases)) fail('INVALID_RESOURCE_REGISTRY_SNAPSHOT', 'resource registry snapshot is invalid');
    const registry = new ResourceRegistry(options);
    snapshot.resources.forEach((resource) => {
      const ref = normalizeRef(resource, resource.type);
      const resourceDigestInput = { ...resource };
      delete resourceDigestInput.digest;
      if (!ref || resource.digest !== sha256(resourceDigestInput)) fail('INVALID_RESOURCE_REGISTRY_SNAPSHOT', 'resource digest mismatch', { type: resource.type, id: resource.id, version: resource.version });
      registry._resources.set(refKey(ref), immutable(resource, 'resource'));
    });
    snapshot.releases.forEach((release) => {
      const normalized = createAgentRelease(release, options);
      if (release.digest && normalized.digest !== release.digest) fail('INVALID_RESOURCE_REGISTRY_SNAPSHOT', 'release digest mismatch', { releaseId: release.releaseId, releaseVersion: release.releaseVersion });
      registry._releases.set(`${normalized.releaseId}:${normalized.releaseVersion}`, normalized);
    });
    return registry;
  }
}

function createResourceRegistry(options) { return new ResourceRegistry(options); }

function exportAgentReleaseCheckpoint(release, options = {}) {
  const source = assertAgentRelease(release);
  const formedAt = nowIso(options.clock || options.now);
  const scenarioContext = options.scenarioContext ? normalizeScenarioContext(options.scenarioContext) : null;
  if (!scenarioContext) fail('CHECKPOINT_CONTEXT_REQUIRED', 'Agent Release checkpoint export requires a C033 scenario context');
  const contextErrors = validateScenario(scenarioContext);
  if (contextErrors.length) fail('INVALID_CHECKPOINT_CONTEXT', 'checkpoint scenario context is invalid', contextErrors);
  if (scenarioContext.scenarioId !== source.scenario.id || scenarioContext.scenarioVersion !== source.scenario.version) fail('CONTEXT_MISMATCH', 'checkpoint context does not match release scenario');
  const stateRefs = Array.isArray(options.stateRefs) ? options.stateRefs.map((ref) => cloneJson(ref)) : [];
  const stateForbidden = findForbiddenKeys(stateRefs, 'stateRefs');
  if (stateForbidden.length) fail('FORBIDDEN_CHECKPOINT_STATE', 'checkpoint state may contain references only; side-effect/business payload was supplied', stateForbidden);
  const checkpoint = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    checkpointId: options.checkpointId || `CP-${source.releaseId}-${source.releaseVersion}`,
    immutable: true,
    formedAt,
    scenarioContext,
    agentRelease: source,
    releaseRef: releaseRefs(source).release,
    // Runtime state is deliberately reference-only.  Secrets, prompt bodies,
    // report text, business rows and side-effect collections are not exported.
    stateRefs,
    sideEffectsSuppressed: true,
    replayHistoricalSideEffects: false,
    externalCapabilitiesDefault: 'disabled',
    digest: null
  };
  const digestInput = { ...checkpoint };
  delete digestInput.digest;
  checkpoint.digest = sha256(digestInput);
  return immutable(checkpoint, 'Agent checkpoint');
}

function validateAgentReleaseCheckpoint(value) {
  const errors = [];
  if (!isRecord(value)) return validationResult(false, [issue('$', 'type', 'checkpoint must be an object')]);
  if (value.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) errors.push(issue('schemaVersion', 'version', `must equal ${CHECKPOINT_SCHEMA_VERSION}`));
  if (value.immutable !== true) errors.push(issue('immutable', 'required', 'checkpoint must be immutable'));
  if (value.sideEffectsSuppressed !== true || value.replayHistoricalSideEffects !== false || value.externalCapabilitiesDefault !== 'disabled') errors.push(issue('$', 'side-effect-policy', 'checkpoint restore must suppress side effects'));
  errors.push(...validateAgentRelease(value.agentRelease).errors);
  if (value.releaseRef && value.agentRelease) {
    const expectedReleaseDigest = value.agentRelease.digest || digestRelease(value.agentRelease);
    if (value.releaseRef.id !== value.agentRelease.releaseId || value.releaseRef.version !== value.agentRelease.releaseVersion || (value.releaseRef.digest && value.releaseRef.digest !== expectedReleaseDigest)) errors.push(issue('releaseRef', 'mismatch', 'checkpoint releaseRef must match the embedded immutable Agent Release'));
  }
  if (value.scenarioContext) {
    errors.push(...validateScenario(value.scenarioContext));
    const releaseScenario = value.agentRelease?.scenario;
    const checkpointScenario = normalizeScenarioContext(value.scenarioContext);
    if (releaseScenario && checkpointScenario && (releaseScenario.id !== checkpointScenario.scenarioId || releaseScenario.version !== checkpointScenario.scenarioVersion)) {
      errors.push(issue('scenarioContext', 'mismatch', 'checkpoint context must match the Agent Release scenario'));
    }
  }
  if (value.targetScenarioRunId && value.scenarioContext && value.targetScenarioRunId !== value.scenarioContext.scenarioRunId) errors.push(issue('targetScenarioRunId', 'mismatch', 'targetScenarioRunId must match checkpoint scenarioContext'));
  const copy = cloneJson(value, 'checkpoint');
  const digest = copy.digest;
  delete copy.digest;
  if (!text(digest) || sha256(copy) !== digest) errors.push(issue('digest', 'integrity', 'checkpoint digest mismatch'));
  if (findForbiddenKeys(value, '$').length) errors.push(issue('$', 'forbidden', 'checkpoint contains forbidden business detail or side-effect data'));
  const rawState = [];
  if (Array.isArray(value.stateRefs)) value.stateRefs.forEach((ref, index) => {
    if (isRecord(ref) && Object.keys(ref).some((key) => /^(?:question|prompt|answer|explanation|reportText|reportBody|generatedText|response|rawOutput)$/i.test(key))) rawState.push(`stateRefs[${index}]`);
  });
  if (rawState.length) errors.push(issue('stateRefs', 'forbidden', 'checkpoint stateRefs may contain references only', { fields: rawState }));
  return validationResult(errors.length === 0, errors);
}

function cloneAgentReleaseCheckpoint(checkpoint, options = {}) {
  const validation = validateAgentReleaseCheckpoint(checkpoint);
  if (!validation.valid) fail('INVALID_CHECKPOINT', 'checkpoint cannot be restored', validation.errors);
  const source = cloneJson(checkpoint, 'checkpoint');
  const oldContext = source.scenarioContext;
  if (!oldContext) fail('CHECKPOINT_CONTEXT_REQUIRED', 'checkpoint restore requires a scenario context');
  const runId = typeof options.runIdFactory === 'function' ? options.runIdFactory(oldContext.scenarioId, { operation: 'agent-release-restore', sourceScenarioRunId: oldContext.scenarioRunId }) : `${oldContext.scenarioId}-RUN-restore-${crypto.randomUUID()}`;
  if (runId === oldContext.scenarioRunId) fail('SCENARIO_RUN_REUSED', 'restore must create a new scenarioRunId');
  if (!text(runId) || !(runId === oldContext.scenarioId || runId.startsWith(`${oldContext.scenarioId}-`) || runId.startsWith(`${oldContext.scenarioId}_`) || runId.startsWith(`${oldContext.scenarioId}/`))) fail('SCENARIO_MISMATCH', 'restored scenarioRunId must remain in the source scenario namespace');
  const formedAt = nowIso(options.clock || options.now);
  const restored = {
    ...source,
    checkpointId: options.checkpointId || `${source.checkpointId}-RESTORED-${runId}`,
    formedAt,
    scenarioContext: { ...oldContext, scenarioRunId: runId, formedAt, status: 'restored' },
    sourceScenarioRunId: oldContext.scenarioRunId,
    targetScenarioRunId: runId,
    restored: true,
    overwritesSource: false,
    autoRun: false,
    autoToolInvocation: false,
    digest: null
  };
  const restoredDigestInput = { ...restored };
  delete restoredDigestInput.digest;
  restored.digest = sha256(restoredDigestInput);
  return immutable(restored, 'restored Agent checkpoint');
}

function assertC034ReplaySafe(value) {
  const forbidden = findForbiddenKeys(value, '$').filter((item) => /action|todo|task|notification|approval|dispatch|write|publish/i.test(item.key));
  if (forbidden.length) fail('HISTORICAL_SIDE_EFFECT_REPLAY', 'Agent checkpoint replay contains a side-effect collection', forbidden);
  return true;
}

module.exports = Object.freeze({
  AGENT_RELEASE_SCHEMA_VERSION,
  AGENT_RELEASE_CONTRACT_VERSION,
  RESOURCE_REGISTRY_SCHEMA_VERSION,
  AUDIT_SCHEMA_VERSION,
  CHECKPOINT_SCHEMA_VERSION,
  RESOURCE_TYPES,
  RELEASE_STATUSES,
  SAFE_TOOL_OPERATIONS,
  FORBIDDEN_TOOL_RE,
  FORBIDDEN_RESOURCE_RE,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_RELEASE_PERMISSIONS,
  PROMPT_INJECTION_PATTERNS,
  REPORT_CONTEXT_FIELDS,
  REQUIRED_REPORT_CONTEXT_FIELDS,
  AgentReleaseError,
  AgentPermissionError,
  stableSerialize,
  sha256,
  immutable,
  isDateTime,
  normalizeRef,
  normalizeReleaseInput,
  normalizeWhitelist,
  validateAgentRelease,
  isValidAgentRelease: (value, options) => validateAgentRelease(value, options).valid,
  assertAgentRelease,
  AgentRelease: createAgentRelease,
  createRelease: createAgentRelease,
  validateRelease: validateAgentRelease,
  assertRelease: assertAgentRelease,
  createAgentRelease,
  digestRelease,
  publishAgentRelease,
  disableAgentRelease,
  releaseRefs,
  normalizeFixedReportContext,
  validateFixedReportContext,
  isValidFixedReportContext: (value, options) => validateFixedReportContext(value, options).valid,
  assertFixedReportContext,
  validateReportContext: validateFixedReportContext,
  assertReportContext: assertFixedReportContext,
  compareFixedReportContext,
  assertReleaseContext,
  bindReleaseToContext: assertReleaseContext,
  validateReleaseContext: (release, context, options) => {
    try {
      return { valid: true, errors: [], binding: assertReleaseContext(release, context, options) };
    } catch (error) {
      return validationResult(false, [{ path: '$', code: error.code || 'CONTEXT_MISMATCH', message: error.message, details: error.details }]);
    }
  },
  actorRoles,
  hasPermission,
  authorize,
  assertPermission,
  validateToolCall,
  scopeWithin,
  isToolCallAllowed: (release, request, options) => validateToolCall(release, request, options).valid,
  assertToolCall,
  checkToolCall: validateToolCall,
  checkToolPermission: validateToolCall,
  authorizeToolCall: assertToolCall,
  detectPromptInjection,
  scanPromptInjection: detectPromptInjection,
  assertNoPromptInjection,
  preparePromptInput,
  AppendOnlyAuditLog,
  AuditLog: AppendOnlyAuditLog,
  createAuditLog: (options) => new AppendOnlyAuditLog(options),
  restoreAuditLog: AppendOnlyAuditLog.fromSnapshot,
  verifyAuditChain,
  ResourceRegistry,
  AgentReleaseRegistry: ResourceRegistry,
  createResourceRegistry,
  createAgentReleaseRegistry: createResourceRegistry,
  restoreResourceRegistry: ResourceRegistry.fromSnapshot,
  exportAgentReleaseCheckpoint,
  exportCheckpoint: exportAgentReleaseCheckpoint,
  validateAgentReleaseCheckpoint,
  validateCheckpoint: validateAgentReleaseCheckpoint,
  cloneAgentReleaseCheckpoint,
  cloneRestore: cloneAgentReleaseCheckpoint,
  restoreCheckpoint: cloneAgentReleaseCheckpoint,
  assertC034ReplaySafe
});
