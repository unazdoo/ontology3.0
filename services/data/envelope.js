'use strict';

const foundation = require('../../packages/contracts');
const {
  DATA_SCHEMA_VERSION,
  DataContractError,
  clone,
  deepFreeze,
  assertAllowedFields,
  assertExactSchemaVersion
} = require('./contracts');

const M02_EVENT_TYPES = Object.freeze([
  'T002_READ',
  'T008_CONFIRMED',
  'T008_READ',
  'T003_RUN_STARTED',
  'T005_QUALITY_RECORDED',
  'T007_PUBLISHED',
  'C003_DELIVERY',
  'C003_RECEIPT',
  'C017_READ',
  'C032_DISCOVERY',
  'C028_REQUEST',
  'C028_RECEIPT',
  'C029_RESULT'
]);

const ENVELOPE_FIELDS = Object.freeze([
  'eventId', 'eventType', 'schemaVersion', 'occurredAt', 'actorRef',
  'correlationId', 'traceId', 'idempotencyKey', 'scenarioContext',
  'resourceRefs', 'evidenceRefs', 'payload'
]);
const RESOURCE_REF_FIELDS = Object.freeze(['refType', 'refId', 'refVersion']);
const EVIDENCE_REF_FIELDS = Object.freeze([
  'evidenceType', 'evidenceId', 'evidenceVersion', 'refType', 'refId',
  'refVersion', 'locator', 'fingerprint'
]);
const EVENT_PAYLOAD_FIELDS = Object.freeze({
  T002_READ: ['snapshotId', 'sourceId', 'contentFingerprint', 'readEventId', 'status'],
  T008_CONFIRMED: ['confirmationId', 'snapshotId', 'asOfTime', 't008', 'confirmedBy', 'confirmedAt', 'basis'],
  T008_READ: ['readEventId', 'confirmationId', 'snapshotId', 'asOfTime', 't008', 'requester', 'status'],
  T003_RUN_STARTED: ['runId', 'pipelineId', 'pipelineVersion', 'inputLockFingerprint', 'status'],
  T005_QUALITY_RECORDED: ['runId', 'qualityId', 'status', 'hardFailure', 'summary'],
  T007_PUBLISHED: ['assetId', 'assetVersionId', 't006Id', 't007Id', 'asOfTime', 't008', 'status'],
  C003_DELIVERY: ['contractCode', 'deliveryId', 'assetId', 'assetVersionId', 't006Id', 't007Id', 'asOfTime', 't008', 'status'],
  C003_RECEIPT: ['contractCode', 'receiptId', 'deliveryId', 'assetVersionId', 't007Id', 'status', 'receivedAt', 'reasonCode', 'reason'],
  C017_READ: ['contractCode', 'readId', 'summaryId', 'summaryVersion', 'assetVersionId', 't007Id', 'consumer', 'status'],
  C032_DISCOVERY: ['contractCode', 'requestId', 'responseId', 'responseVersion', 'assetId', 't006Id', 'status'],
  C028_REQUEST: ['contractCode', 'requestId', 'deliveryId', 'assetVersionId', 't007Id', 'status'],
  C028_RECEIPT: ['contractCode', 'requestId', 'assetVersionId', 't007Id', 'status', 'receivedAt', 'reasonCode', 'reason'],
  C029_RESULT: ['contractCode', 'resultId', 'requestId', 'assetVersionId', 't007Id', 'status', 'formedAt', 'reasonCode', 'reason']
});

function assertM02Envelope(value, options = {}) {
  assertAllowedFields(value, ENVELOPE_FIELDS, 'M02_ENVELOPE', { required: ENVELOPE_FIELDS });
  assertExactSchemaVersion(value.schemaVersion, DATA_SCHEMA_VERSION);
  if (!M02_EVENT_TYPES.includes(value.eventType)) {
    throw new DataContractError('M02_EVENT_TYPE_UNKNOWN', `unregistered M02 eventType ${value.eventType}`);
  }
  const envelope = foundation.assertContractEnvelope(value, { allowUnknown: false });
  for (const ref of envelope.resourceRefs) {
    if (typeof ref !== 'string') assertAllowedFields(ref, RESOURCE_REF_FIELDS, 'M02_RESOURCE_REF', { required: ['refType', 'refId'] });
  }
  for (const ref of envelope.evidenceRefs) {
    if (typeof ref !== 'string') assertAllowedFields(ref, EVIDENCE_REF_FIELDS, 'M02_EVIDENCE_REF', { required: ['evidenceType', 'evidenceId'] });
  }
  if (!envelope.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)) {
    throw new DataContractError('M02_PAYLOAD_INVALID', 'M02 envelope payload must be an object');
  }
  const payloadFields = options.payloadFields || EVENT_PAYLOAD_FIELDS[envelope.eventType];
  if (!payloadFields) throw new DataContractError('M02_PAYLOAD_SCHEMA_MISSING', `no payload schema is registered for ${envelope.eventType}`);
  if (payloadFields) {
    assertAllowedFields(envelope.payload, payloadFields, `${envelope.eventType}_PAYLOAD`, {
      required: options.requiredPayloadFields || []
    });
  }
  return deepFreeze(clone(envelope));
}

function createM02Envelope(value, options) {
  return assertM02Envelope(clone(value), options);
}

function validateM02Envelope(value, options) {
  try {
    return { valid: true, errors: [], value: assertM02Envelope(value, options) };
  } catch (error) {
    return { valid: false, errors: [{ code: error.code, message: error.message, details: error.details || error.errors || null }] };
  }
}

module.exports = Object.freeze({
  M02_EVENT_TYPES,
  ENVELOPE_FIELDS,
  RESOURCE_REF_FIELDS,
  EVIDENCE_REF_FIELDS,
  EVENT_PAYLOAD_FIELDS,
  assertM02Envelope,
  createM02Envelope,
  validateM02Envelope
});
