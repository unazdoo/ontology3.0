'use strict';

const { clone, immutable, sha256, uuid, nowIso, isRecord, isNonEmptyString, fail } = require('./util');

const REDACT_KEYS = new Set(['prompt', 'systemPrompt', 'question', 'content', 'text', 'input', 'output', 'response', 'token', 'secret', 'credential']);

function redact(value, depth = 0) {
  if (depth > 8) return '[redacted-depth]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (!isRecord(value)) {
    if (typeof value === 'string' && value.length > 512) return `${value.slice(0, 128)}...[redacted-long]`;
    return value;
  }
  const result = {};
  Object.keys(value).forEach((key) => {
    if (REDACT_KEYS.has(key) || /secret|token|credential|password|authorization|prompt|question|content|text|input|output|response|raw|business|workbook|spreadsheet|t002|t007/i.test(key)) result[key] = '[redacted]';
    else result[key] = redact(value[key], depth + 1);
  });
  return result;
}

class AuditLog {
  constructor(options = {}) {
    this.clock = options.clock;
    this._records = [];
    this.lastDigest = options.genesisDigest || '0'.repeat(64);
    Object.defineProperty(this, 'appendOnly', { value: true, enumerable: true });
    Object.defineProperty(this, 'records', { enumerable: false, get: () => this._records.map((record) => record) });
  }

  append(event = {}) {
    if (!isRecord(event)) fail('AUDIT_INVALID', 'audit event must be an object');
    const occurredAt = event.occurredAt || nowIso(this.clock);
    const record = {
      auditId: event.auditId || uuid('audit'),
      occurredAt,
      operation: event.operation || 'm05.operation',
      outcome: event.outcome || 'unknown',
      actorRef: event.actorRef || 'system:m05',
      traceId: event.traceId || null,
      correlationId: event.correlationId || null,
      scenarioContext: event.scenarioContext ? clone(event.scenarioContext) : null,
      resourceRefs: clone(event.resourceRefs || []),
      details: redact(event.details || {}),
      previousDigest: this.lastDigest
    };
    record.digest = sha256(record);
    this.lastDigest = record.digest;
    const frozen = immutable(record);
    this._records.push(frozen);
    return frozen;
  }

  list() { return immutable(this._records); }

  verify() {
    let previous = '0'.repeat(64);
    for (const record of this._records) {
      const copy = clone(record);
      delete copy.digest;
      if (record.previousDigest !== previous || record.digest !== sha256(copy)) return { valid: false, auditId: record.auditId };
      previous = record.digest;
    }
    return { valid: true, count: this._records.length, lastDigest: previous };
  }
}

function createAuditLog(options) { return new AuditLog(options); }

module.exports = Object.freeze({ AuditLog, createAuditLog, redact });
