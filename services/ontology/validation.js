'use strict';

const {
  C029_STATUSES,
  RESOURCE_TYPES,
  assertArray,
  assertDateTime,
  assertEnum,
  assertText,
  assertUnique,
  cloneJson,
  fail,
  isRecord,
  sealIntegrity,
  text,
  token,
  verifyIntegrity
} = require('./domain');

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DELIVERY_STATUSES = Object.freeze(['delivered', 'sent', 'published', 'ready', '已交付', '已发送']);
const PUBLICATION_STATUSES = Object.freeze(['published']);
const QUALITY_STATUSES = Object.freeze(['passed', 'warning', 'failed', 'unknown']);
const LINEAGE_STATUSES = Object.freeze(['passed', 'failed', 'unknown']);
const CHECK_STATUSES = Object.freeze(['passed', 'failed', 'unknown']);
const S001_MEMBER_IDS = Object.freeze(['FIN-MEMBER-SUBJECT', 'FIN-MEMBER-DETAIL', 'FIN-MEMBER-INSTITUTION', 'FIN-MEMBER-OWNER']);
const S001_RELATION_IDS = Object.freeze(['FIN-REL-DETAIL-SUBJECT', 'FIN-REL-DETAIL-INSTITUTION', 'FIN-REL-SUBJECT-OWNER']);

function assertDate(value, path) {
  const candidate = typeof value === 'string' && value.includes('T') ? value.slice(0, 10) : value;
  const match = DATE_RE.exec(candidate || '');
  if (!match) fail('VALIDATION_FAILED', `${path} must be an ISO date`, { path });
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > days) fail('VALIDATION_FAILED', `${path} must be a real calendar date`, { path });
  return candidate;
}

function first(value, keys) {
  for (const key of keys) if (value?.[key] !== undefined && value?.[key] !== null) return value[key];
  return undefined;
}

function normalizeField(field, memberPath, index) {
  const path = `${memberPath}.fields[${index}]`;
  if (Array.isArray(field)) {
    if (field.length < 2) fail('C003_INVALID', `${path} must contain a stable field id and type`, { path });
    return {
      id: assertText(field[3] || field[0], `${path}.id`, { token: true, code: 'C003_INVALID' }),
      name: assertText(field[0], `${path}.name`, { code: 'C003_INVALID' }),
      dataType: assertText(field[1], `${path}.dataType`, { code: 'C003_INVALID' }),
      description: field[2] || null
    };
  }
  if (!isRecord(field)) fail('C003_INVALID', `${path} must be an object`, { path });
  return {
    id: assertText(first(field, ['id', 'fieldId', 'stableId']), `${path}.id`, { token: true, code: 'C003_INVALID' }),
    name: assertText(first(field, ['name', 'displayName']), `${path}.name`, { code: 'C003_INVALID' }),
    dataType: assertText(first(field, ['dataType', 'type']), `${path}.dataType`, { code: 'C003_INVALID' }),
    description: first(field, ['description', 'meaning']) || null,
    nullable: field.nullable === undefined ? null : Boolean(field.nullable)
  };
}

function normalizeMember(member, index) {
  const path = `payload.members[${index}]`;
  if (!isRecord(member)) fail('C003_INVALID', `${path} must be an object`, { path });
  const fields = assertArray(member.fields, `${path}.fields`, { nonEmpty: true, code: 'C003_INVALID' })
    .map((field, fieldIndex) => normalizeField(field, path, fieldIndex));
  assertUnique(fields, (field) => field.id, `${path}.fields`, 'C003_DUPLICATE_FIELD');
  const primaryKey = first(member, ['primaryKey', 'identityFieldId', 'identity']);
  if (!text(primaryKey)) fail('C003_INVALID', `${path}.primaryKey is required`, { path: `${path}.primaryKey` });
  if (!fields.some((field) => field.id === String(primaryKey) || field.name === String(primaryKey))) {
    fail('C003_INVALID', `${path}.primaryKey must identify a field in the member contract`, { path: `${path}.primaryKey` });
  }
  const foreignKeys = Array.isArray(member.foreignKeys) ? member.foreignKeys.map(String) : [];
  return {
    id: assertText(first(member, ['id', 'memberId', 'stableId']), `${path}.id`, { token: true, code: 'C003_INVALID' }),
    name: assertText(first(member, ['name', 'displayName']), `${path}.name`, { code: 'C003_INVALID' }),
    grain: assertText(member.grain, `${path}.grain`, { code: 'C003_INVALID' }),
    rowCount: Number(first(member, ['rowCount', 'rows'])),
    primaryKey: String(primaryKey),
    foreignKeys,
    fields,
    qualityStatus: first(member, ['qualityStatus', 'memberQualityStatus']) || 'passed'
  };
}

function normalizeRelation(relation, index) {
  const path = `payload.relations[${index}]`;
  if (!isRecord(relation)) fail('C003_INVALID', `${path} must be an object`, { path });
  return {
    id: assertText(first(relation, ['id', 'relationId', 'stableId']), `${path}.id`, { token: true, code: 'C003_INVALID' }),
    name: assertText(first(relation, ['name', 'displayName']), `${path}.name`, { code: 'C003_INVALID' }),
    sourceMemberId: assertText(first(relation, ['sourceMemberId', 'source']), `${path}.sourceMemberId`, { token: true, code: 'C003_INVALID' }),
    targetMemberId: assertText(first(relation, ['targetMemberId', 'target']), `${path}.targetMemberId`, { token: true, code: 'C003_INVALID' }),
    sourceFieldId: assertText(first(relation, ['sourceFieldId', 'sourceField']), `${path}.sourceFieldId`, { token: true, code: 'C003_INVALID' }),
    targetFieldId: assertText(first(relation, ['targetFieldId', 'targetField']), `${path}.targetFieldId`, { token: true, code: 'C003_INVALID' }),
    endpointCheckStatus: first(relation, ['endpointCheckStatus', 'status']) || 'passed'
  };
}

function sourceFingerprint(payload) {
  const value = payload.sourceFingerprint || payload.fileFingerprint;
  if (!isRecord(value) || value.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(value.value || value.digest || '')) {
    fail('C003_INVALID', 'payload.sourceFingerprint must be a SHA-256 reference');
  }
  const sizeBytes = Number(value.sizeBytes);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) fail('C003_INVALID', 'payload.sourceFingerprint.sizeBytes must be a positive integer');
  return { algorithm: 'SHA-256', value: value.value || value.digest, sizeBytes };
}

function normalizeC003Payload(payload) {
  if (!isRecord(payload)) fail('C003_INVALID', 'C003 payload must be an object');
  verifyIntegrity(payload, { label: 'C003 payload', code: 'C003_CORRUPT' });
  const deliveryId = assertText(payload.deliveryId, 'payload.deliveryId', { token: true, code: 'C003_INVALID' });
  const rawDeliveryStatus = first(payload, ['deliveryStatus', 'status']);
  assertEnum(rawDeliveryStatus, DELIVERY_STATUSES, 'payload.deliveryStatus', 'C003_UNKNOWN_STATUS');
  const deliveryStatus = ['delivered', 'published', 'ready', '已交付'].includes(rawDeliveryStatus) ? 'delivered' : 'sent';
  assertDateTime(payload.deliveredAt, 'payload.deliveredAt', 'C003_INVALID');

  const t006 = isRecord(payload.t006) ? payload.t006 : {};
  const t007 = isRecord(payload.t007) ? payload.t007 : {};
  const t008 = isRecord(payload.t008) ? payload.t008 : {};
  const t006Id = assertText(first(t006, ['id', 'assetId']) || first(payload, ['t006Id', 'assetId']), 'payload.t006Id', { token: true, code: 'C003_INVALID' });
  const t007Version = assertText(first(t007, ['version', 'id']) || first(payload, ['t007Version', 'assetVersion']), 'payload.t007Version', { token: true, code: 'C003_INVALID' });
  const t008AsOf = assertDate(first(t008, ['asOf', 'value']) || first(payload, ['t008AsOf', 'asOf']), 'payload.t008.asOf');
  const immutableVersion = first(t007, ['immutable']) ?? payload.t007Immutable;
  if (immutableVersion !== true) fail('C003_NOT_IMMUTABLE', 'C003 must reference an immutable T007');
  const publicationStatus = first(t007, ['publicationStatus', 'status']) || payload.publicationState;
  assertEnum(publicationStatus, PUBLICATION_STATUSES, 'payload.t007.publicationStatus', 'C003_UNKNOWN_STATUS');
  const publishedAt = first(t007, ['publishedAt']) || payload.publishedAt;
  assertDateTime(publishedAt, 'payload.t007.publishedAt', 'C003_INVALID');

  const members = assertArray(payload.members, 'payload.members', { nonEmpty: true, code: 'C003_INVALID' }).map(normalizeMember);
  const relations = assertArray(payload.relations, 'payload.relations', { code: 'C003_INVALID' }).map(normalizeRelation);
  const memberIds = assertUnique(members, (member) => member.id, 'payload.members', 'C003_DUPLICATE_MEMBER');
  assertUnique(relations, (relation) => relation.id, 'payload.relations', 'C003_DUPLICATE_RELATION');
  members.forEach((member, index) => {
    if (!Number.isSafeInteger(member.rowCount) || member.rowCount < 0) fail('C003_INVALID', `payload.members[${index}].rowCount must be a non-negative integer`);
    assertEnum(member.qualityStatus, QUALITY_STATUSES, `payload.members[${index}].qualityStatus`, 'C003_UNKNOWN_STATUS');
    if (member.qualityStatus !== 'passed' && member.qualityStatus !== 'warning') fail('C003_QUALITY_BLOCKED', `payload member ${member.id} is not quality-qualified`);
  });
  relations.forEach((relation, index) => {
    const sourceMember = members.find((member) => member.id === relation.sourceMemberId);
    const targetMember = members.find((member) => member.id === relation.targetMemberId);
    if (!sourceMember || !targetMember) {
      fail('C003_RELATION_ENDPOINT_MISMATCH', `payload.relations[${index}] references a member outside the locked T007 scope`);
    }
    if (!sourceMember.fields.some((field) => field.id === relation.sourceFieldId)
        || !targetMember.fields.some((field) => field.id === relation.targetFieldId)) {
      fail('C003_RELATION_ENDPOINT_MISMATCH', `payload.relations[${index}] references a field outside the locked member contract`);
    }
    assertEnum(relation.endpointCheckStatus, CHECK_STATUSES, `payload.relations[${index}].endpointCheckStatus`, 'C003_UNKNOWN_STATUS');
    if (relation.endpointCheckStatus !== 'passed') fail('C003_RELATION_ENDPOINT_MISMATCH', `payload relation ${relation.id} did not pass endpoint checks`);
  });

  const expectedScope = isRecord(payload.expectedScope) ? payload.expectedScope : null;
  if (!expectedScope || !Array.isArray(expectedScope.memberIds) || !Array.isArray(expectedScope.relationIds)) {
    fail('C003_SCOPE_REQUIRED', 'C003 must carry an explicit locked member/relation scope');
  }
  const requiredMemberIds = expectedScope.memberIds.map(String);
  const requiredRelationIds = expectedScope.relationIds.map(String);
  assertUnique(requiredMemberIds, String, 'payload.expectedScope.memberIds');
  assertUnique(requiredRelationIds, String, 'payload.expectedScope.relationIds');
  if (requiredMemberIds.some((id) => !memberIds.has(id)) || requiredMemberIds.length !== members.length) {
    fail('C003_MEMBER_SCOPE_MISMATCH', 'C003 members do not exactly match the locked required scope');
  }
  const relationIds = new Set(relations.map((item) => item.id));
  if (requiredRelationIds.some((id) => !relationIds.has(id)) || requiredRelationIds.length !== relations.length) {
    fail('C003_RELATION_SCOPE_MISMATCH', 'C003 relations do not exactly match the locked required scope');
  }

  const quality = payload.qualitySummary;
  if (!isRecord(quality)) fail('C003_INVALID', 'payload.qualitySummary is required');
  assertEnum(quality.status, QUALITY_STATUSES, 'payload.qualitySummary.status', 'C003_UNKNOWN_STATUS');
  if (quality.status !== 'passed' && quality.status !== 'warning') fail('C003_QUALITY_BLOCKED', 'C003 quality does not allow ontology mapping');
  if (quality.status === 'warning' && !text(payload.warningAcknowledgement || quality.warningAcknowledgement)) fail('C003_QUALITY_WARNING_ACK_REQUIRED', 'a warning-quality C003 requires an explicit acknowledgement');
  const qualityEvidenceRef = assertText(first(quality, ['evidenceRef', 'evidenceLocator', 'resultId']), 'payload.qualitySummary.evidenceRef', { code: 'C003_INVALID' });

  const lineage = payload.lineage || {
    status: payload.lineageCheckStatus,
    nodes: payload.sourceChain,
    evidenceRef: payload.lineageEvidenceLocator,
    cycleDetected: payload.cycleDetected
  };
  if (!isRecord(lineage)) fail('C003_INVALID', 'payload.lineage is required');
  assertEnum(lineage.status, LINEAGE_STATUSES, 'payload.lineage.status', 'C003_UNKNOWN_STATUS');
  if (lineage.status !== 'passed') fail('C003_LINEAGE_BLOCKED', 'C003 lineage is not verified');
  if (lineage.cycleDetected === true) fail('C003_LINEAGE_CYCLE', 'C003 lineage contains a cycle');
  const lineageNodes = assertArray(lineage.nodes, 'payload.lineage.nodes', { nonEmpty: true, code: 'C003_INVALID' }).map((item, index) => assertText(String(item), `payload.lineage.nodes[${index}]`, { code: 'C003_INVALID' }));
  if (lineage.cycleDetected === true) fail('C003_LINEAGE_CYCLE', 'C003 lineage contains a cycle');
  const uniqueLineageNodes = [...new Set(lineageNodes)];
  const lineageEvidenceRef = assertText(first(lineage, ['evidenceRef', 'evidenceLocator']), 'payload.lineage.evidenceRef', { code: 'C003_INVALID' });

  return {
    deliveryId,
    deliveryStatus,
    deliveredAt: payload.deliveredAt,
    sourceModule: assertText(payload.sourceModule, 'payload.sourceModule', { token: true, code: 'C003_INVALID' }),
    t006Id,
    t007Version,
    t007Immutable: true,
    publicationStatus,
    publishedAt,
    purpose: first(t007, ['purpose']) || payload.purpose || null,
    consumptionRestriction: first(t007, ['consumptionRestriction']) || payload.consumptionRestriction || null,
    versionDescription: first(t007, ['description']) || payload.versionDescription || null,
    t008: {
      asOf: t008AsOf,
      evidenceRef: assertText(first(t008, ['evidenceRef', 'evidenceLocator']) || payload.t008EvidenceRef, 'payload.t008.evidenceRef', { code: 'C003_INVALID' })
    },
    sourceFingerprint: sourceFingerprint(payload),
    members,
    relations,
    expectedScope: { memberIds: requiredMemberIds, relationIds: requiredRelationIds },
    qualitySummary: {
      status: quality.status,
      evidenceRef: qualityEvidenceRef,
      checkedAt: quality.checkedAt || null,
      warningAcknowledgement: payload.warningAcknowledgement || quality.warningAcknowledgement || null
    },
    lineage: {
      status: 'passed',
      nodes: uniqueLineageNodes,
      evidenceRef: lineageEvidenceRef,
      cycleDetected: false
    },
    retryOf: payload.retryOf || null,
    scenarioContext: payload.scenarioContext ? cloneJson(payload.scenarioContext) : null,
    integrity: cloneJson(payload.integrity)
  };
}

function sealC003Payload(payload) {
  return sealIntegrity(payload);
}

function resourceArray(content, type) {
  const mapping = {
    ObjectType: 'objectTypes',
    Property: 'properties',
    LinkType: 'linkTypes',
    Metric: 'metrics',
    Rule: 'rules',
    ActionType: 'actionTypes'
  };
  return Array.isArray(content?.[mapping[type]]) ? content[mapping[type]] : [];
}

function normalizeResource(resource, index, explicitType) {
  const path = `content.resources[${index}]`;
  if (!isRecord(resource)) fail('DRAFT_INVALID', `${path} must be an object`, { path });
  const type = explicitType || resource.type || resource.resourceType;
  assertEnum(type, RESOURCE_TYPES, `${path}.type`, 'DRAFT_RESOURCE_TYPE_UNKNOWN');
  if (resource.owner && resource.owner !== 'M01') fail('OWNER_BOUNDARY_VIOLATION', 'semantic definitions owned by M01 cannot be assigned to a consumer', { path: `${path}.owner`, owner: resource.owner });
  const normalized = {
    id: assertText(first(resource, ['id', 'resourceId', 'stableId']), `${path}.id`, { token: true, code: 'DRAFT_INVALID' }),
    type,
    name: assertText(first(resource, ['name', 'displayName']), `${path}.name`, { code: 'DRAFT_INVALID' }),
    definition: assertText(first(resource, ['definition', 'description']), `${path}.definition`, { code: 'DRAFT_INVALID' }),
    owner: 'M01',
    effectiveFrom: resource.effectiveFrom || null,
    effectiveTo: resource.effectiveTo || null,
    dependencyIds: Array.isArray(resource.dependencyIds) ? resource.dependencyIds.map(String) : [],
    metadata: isRecord(resource.metadata) ? cloneJson(resource.metadata) : {}
  };
  if (normalized.effectiveFrom) assertDateTime(normalized.effectiveFrom, `${path}.effectiveFrom`, 'DRAFT_INVALID');
  if (normalized.effectiveTo) assertDateTime(normalized.effectiveTo, `${path}.effectiveTo`, 'DRAFT_INVALID');
  if (type === 'Property') normalized.objectTypeId = assertText(resource.objectTypeId, `${path}.objectTypeId`, { token: true, code: 'DRAFT_INVALID' });
  if (type === 'LinkType') {
    normalized.sourceObjectTypeId = assertText(resource.sourceObjectTypeId, `${path}.sourceObjectTypeId`, { token: true, code: 'DRAFT_INVALID' });
    normalized.targetObjectTypeId = assertText(resource.targetObjectTypeId, `${path}.targetObjectTypeId`, { token: true, code: 'DRAFT_INVALID' });
    normalized.allowedDirections = Array.isArray(resource.allowedDirections) ? resource.allowedDirections.map(String) : ['source-to-target'];
  }
  if (type === 'Metric') {
    normalized.formula = resource.formula || null;
    normalized.unit = resource.unit || null;
    normalized.applicableObjectTypeId = resource.applicableObjectTypeId || null;
  }
  if (type === 'Rule') {
    normalized.condition = resource.condition || null;
    normalized.applicableObjectTypeId = resource.applicableObjectTypeId || null;
  }
  if (type === 'ActionType') {
    normalized.targetObjectTypeId = assertText(resource.targetObjectTypeId, `${path}.targetObjectTypeId`, { token: true, code: 'DRAFT_INVALID' });
    normalized.parameters = Array.isArray(resource.parameters) ? cloneJson(resource.parameters) : [];
    normalized.confirmationRequired = resource.confirmationRequired !== false;
  }
  assertUnique(normalized.dependencyIds, String, `${path}.dependencyIds`);
  return normalized;
}

function normalizeSemanticContent(content, defaults = {}) {
  if (!isRecord(content)) fail('DRAFT_INVALID', 'Draft content must be an object');
  const resources = Array.isArray(content.resources)
    ? content.resources.map((item, index) => normalizeResource(item, index))
    : RESOURCE_TYPES.flatMap((type) => resourceArray(content, type).map((item, index) => normalizeResource(item, index, type)));
  assertUnique(resources, (resource) => resource.id, 'content.resources', 'DRAFT_DUPLICATE_RESOURCE');
  if (content.effectiveFrom) assertDateTime(content.effectiveFrom, 'content.effectiveFrom', 'DRAFT_INVALID');
  if (content.effectiveTo) assertDateTime(content.effectiveTo, 'content.effectiveTo', 'DRAFT_INVALID');
  return {
    ontologyId: assertText(content.ontologyId || defaults.ontologyId, 'content.ontologyId', { token: true, code: 'DRAFT_INVALID' }),
    name: text(content.name) ? content.name.trim() : (defaults.name || ''),
    description: text(content.description) ? content.description.trim() : (defaults.description || ''),
    resources,
    sourceMappingVersion: content.sourceMappingVersion || defaults.sourceMappingVersion || null,
    mapping: isRecord(content.mapping) ? cloneJson(content.mapping) : (defaults.mapping ? cloneJson(defaults.mapping) : null),
    effectiveFrom: content.effectiveFrom || null,
    effectiveTo: content.effectiveTo || null
  };
}

function validateSemanticContent(content) {
  const issues = [];
  if (!text(content.name)) issues.push({ code: 'NAME_REQUIRED', path: 'content.name', message: 'ontology name is required' });
  if (!text(content.description)) issues.push({ code: 'DESCRIPTION_REQUIRED', path: 'content.description', message: 'ontology description is required' });
  const resources = Array.isArray(content.resources) ? content.resources : [];
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));
  if (!resources.some((resource) => resource.type === 'ObjectType')) {
    issues.push({ code: 'OBJECT_TYPE_REQUIRED', path: 'content.resources', message: 'at least one ObjectType is required' });
  }
  resources.forEach((resource, index) => {
    const path = `content.resources[${index}]`;
    const references = [...(resource.dependencyIds || [])];
    if (resource.objectTypeId) references.push(resource.objectTypeId);
    if (resource.sourceObjectTypeId) references.push(resource.sourceObjectTypeId);
    if (resource.targetObjectTypeId) references.push(resource.targetObjectTypeId);
    if (resource.applicableObjectTypeId) references.push(resource.applicableObjectTypeId);
    references.forEach((id) => {
      if (!resourcesById.has(id)) issues.push({ code: 'DEPENDENCY_UNRESOLVED', path, message: `resource ${resource.id} references missing ${id}` });
    });
    const expectType = (id, expectedType, field) => {
      if (id && resourcesById.has(id) && resourcesById.get(id).type !== expectedType) {
        issues.push({ code: 'DEPENDENCY_TYPE_MISMATCH', path: `${path}.${field}`, message: `${id} must be ${expectedType}` });
      }
    };
    expectType(resource.objectTypeId, 'ObjectType', 'objectTypeId');
    expectType(resource.sourceObjectTypeId, 'ObjectType', 'sourceObjectTypeId');
    expectType(resource.targetObjectTypeId, 'ObjectType', 'targetObjectTypeId');
    expectType(resource.applicableObjectTypeId, 'ObjectType', 'applicableObjectTypeId');
  });
  const visiting = new Set();
  const visited = new Set();
  const visit = (resourceId, path = []) => {
    if (visiting.has(resourceId)) {
      issues.push({ code: 'DEPENDENCY_CYCLE', path: 'content.resources', message: `semantic dependency cycle: ${path.concat(resourceId).join(' -> ')}` });
      return;
    }
    if (visited.has(resourceId)) return;
    visiting.add(resourceId);
    const resource = resourcesById.get(resourceId);
    (resource?.dependencyIds || []).filter((id) => resourcesById.has(id)).forEach((id) => visit(id, path.concat(resourceId)));
    visiting.delete(resourceId);
    visited.add(resourceId);
  };
  resources.forEach((resource) => visit(resource.id));
  // A semantic-only Draft may be published before a data asset is attached;
  // once either mapping field is present, both become a hard pair and must be
  // backed by an accepted C003 delivery.
  const mappingStarted = text(content.sourceMappingVersion) || isRecord(content.mapping);
  if (mappingStarted && !text(content.sourceMappingVersion)) issues.push({ code: 'MAPPING_VERSION_REQUIRED', path: 'content.sourceMappingVersion', message: 'an exact source mapping version is required' });
  if (mappingStarted && !isRecord(content.mapping)) issues.push({ code: 'MAPPING_REQUIRED', path: 'content.mapping', message: 'a frozen source mapping is required' });
  return { valid: issues.length === 0, errors: issues };
}

function splitResources(resources) {
  const result = {
    objectTypes: [],
    properties: [],
    linkTypes: [],
    metrics: [],
    rules: [],
    actionTypes: []
  };
  const keyByType = {
    ObjectType: 'objectTypes',
    Property: 'properties',
    LinkType: 'linkTypes',
    Metric: 'metrics',
    Rule: 'rules',
    ActionType: 'actionTypes'
  };
  resources.forEach((resource) => result[keyByType[resource.type]].push(cloneJson(resource)));
  return result;
}

function normalizeCheck(check, path) {
  if (!isRecord(check)) fail('C029_INVALID', `${path} must be an object`);
  const status = assertEnum(check.status, CHECK_STATUSES, `${path}.status`, 'C029_UNKNOWN_STATUS');
  return {
    id: assertText(check.id, `${path}.id`, { token: true, code: 'C029_INVALID' }),
    status,
    reason: check.reason || null,
    evidenceRef: check.evidenceRef || check.evidenceLocator || null
  };
}

function normalizeC029Command(command) {
  if (!isRecord(command)) fail('C029_INVALID', 'C029 command must be an object');
  const rawStatus = command.status || command.resultStatus || command.outcome;
  const statusAliases = {
    success: 'succeeded',
    succeeded: 'succeeded',
    '成功': 'succeeded',
    passed: 'succeeded',
    pass: 'succeeded',
    '通过': 'succeeded',
    processing: 'processing',
    '处理中': 'processing',
    failed: 'failed',
    '失败': 'failed',
    incompatible: 'incompatible',
    unknown: 'unknown',
    '未知': 'unknown'
  };
  const status = statusAliases[rawStatus] || statusAliases[String(rawStatus || '').toLowerCase()] || rawStatus;
  assertEnum(status, C029_STATUSES, 'status', 'C029_UNKNOWN_STATUS');
  const objectChecks = assertArray(command.objectChecks || [], 'objectChecks').map((item, index) => normalizeCheck(item, `objectChecks[${index}]`));
  const relationChecks = assertArray(command.relationChecks || [], 'relationChecks').map((item, index) => normalizeCheck(item, `relationChecks[${index}]`));
  assertUnique(objectChecks, (item) => item.id, 'objectChecks');
  assertUnique(relationChecks, (item) => item.id, 'relationChecks');
  if (status === 'succeeded' && [...objectChecks, ...relationChecks].some((item) => item.status !== 'passed')) {
    fail('C029_CHECK_MISMATCH', 'a succeeded C029 result requires every object and relation check to pass');
  }
  if (status === 'succeeded' && command.allowEmptyChecks !== true && objectChecks.length + relationChecks.length === 0) {
    fail('C029_CHECK_REQUIRED', 'a succeeded C029 result must carry object or relation validation evidence');
  }
  if (['failed', 'incompatible', 'unknown'].includes(status) && !text(command.reason)) {
    fail('C029_REASON_REQUIRED', `C029 ${status} requires a reason`);
  }
  return {
    resultId: command.resultId || command.id || null,
    requestId: assertText(command.requestId, 'requestId', { token: true, code: 'C029_INVALID' }),
    status,
    objectChecks,
    relationChecks,
    reason: command.reason || command.failureReason || command.error || null,
    recoverySuggestion: command.recoverySuggestion || command.recovery || null,
    evidenceRefs: Array.isArray(command.evidenceRefs) ? cloneJson(command.evidenceRefs) : []
  };
}

module.exports = Object.freeze({
  DATE_RE,
  DELIVERY_STATUSES,
  PUBLICATION_STATUSES,
  QUALITY_STATUSES,
  LINEAGE_STATUSES,
  CHECK_STATUSES,
  S001_MEMBER_IDS,
  S001_RELATION_IDS,
  assertDate,
  normalizeC003Payload,
  sealC003Payload,
  normalizeSemanticContent,
  validateSemanticContent,
  splitResources,
  normalizeC029Command
});
