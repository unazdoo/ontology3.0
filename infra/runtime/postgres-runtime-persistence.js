'use strict';

const {
  fail,
  isRecord,
  text,
  moduleId,
  moduleSchema,
  quoteIdentifier,
  stableSerialize,
  sha256,
  clone,
  scenarioContext,
  sameScenarioRun,
  iso,
  sha
} = require('./common');

function parseJson(value, label) {
  if (isRecord(value) || Array.isArray(value)) return clone(value, label);
  try { return JSON.parse(value); } catch (error) {
    fail('PERSISTED_JSON_INVALID', `${label} is not valid JSON`, { cause: error.message });
  }
}

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function rowCount(result) {
  return Number.isInteger(result?.rowCount) ? result.rowCount : rows(result).length;
}

function requireQueryClient(value) {
  if (!value || (typeof value.query !== 'function' && typeof value.connect !== 'function')) {
    fail('POSTGRES_CLIENT_INVALID', 'PostgreSQL client must expose query() or connect()');
  }
  return value;
}

function auditRecord(input, context, owner, revision, clock) {
  if (!isRecord(input)) fail('AUDIT_REQUIRED', 'a state mutation requires an audit record');
  const formedAt = iso(input.formedAt === undefined ? clock() : input.formedAt, 'audit.formedAt');
  return {
    auditId: text(input.auditId, 'audit.auditId'),
    moduleOwner: owner,
    scenarioContext: context,
    stateRevision: revision,
    eventType: text(input.eventType, 'audit.eventType'),
    operation: text(input.operation, 'audit.operation'),
    outcome: text(input.outcome, 'audit.outcome'),
    actorRef: text(input.actorRef, 'audit.actorRef'),
    traceId: text(input.traceId, 'audit.traceId'),
    correlationId: text(input.correlationId, 'audit.correlationId'),
    idempotencyKey: text(input.idempotencyKey, 'audit.idempotencyKey'),
    record: clone(input.record || {}, 'audit.record'),
    formedAt
  };
}

function outboxRecord(input, context, owner, clock) {
  if (!isRecord(input)) fail('OUTBOX_EVENT_INVALID', 'outbox event must be an object');
  const eventContext = input.scenarioContext || context;
  if (!sameScenarioRun(context, eventContext)) fail('OUTBOX_CONTEXT_MISMATCH', 'outbox event must remain in the aggregate scenario run');
  const payload = clone(input.payload, 'outbox.payload');
  return {
    eventId: text(input.eventId, 'outbox.eventId'),
    moduleOwner: owner,
    scenarioContext: context,
    eventType: text(input.eventType, 'outbox.eventType'),
    contractCode: input.contractCode === undefined || input.contractCode === null ? null : text(input.contractCode, 'outbox.contractCode'),
    schemaVersion: text(input.schemaVersion, 'outbox.schemaVersion'),
    payload,
    payloadDigest: sha256(payload),
    traceId: text(input.traceId, 'outbox.traceId'),
    correlationId: text(input.correlationId, 'outbox.correlationId'),
    idempotencyKey: text(input.idempotencyKey, 'outbox.idempotencyKey'),
    createdAt: iso(input.createdAt === undefined ? clock() : input.createdAt, 'outbox.createdAt')
  };
}

function inboxEvent(input, owner, clock) {
  const event = isRecord(input?.event) ? input.event : input;
  if (!isRecord(event)) fail('INBOX_EVENT_INVALID', 'inbox event must be an object');
  const eventId = text(event.eventId, 'event.eventId');
  const producerModule = moduleId(event.producerModule || event.moduleOwner, 'event.producerModule');
  if (producerModule === owner) fail('INBOX_PRODUCER_INVALID', 'inbox producer must be another module');
  const context = scenarioContext(event.scenarioContext);
  const payload = clone(event.payload, 'event.payload');
  const payloadDigest = event.payloadDigest ? sha(event.payloadDigest, 'event.payloadDigest') : sha256(payload);
  if (payloadDigest !== sha256(payload)) fail('INBOX_PAYLOAD_DIGEST_MISMATCH', 'inbox payload does not match its digest');
  return Object.freeze({
    eventId,
    producerModule,
    consumerModule: owner,
    payload,
    payloadDigest,
    scenarioContext: context,
    eventType: text(event.eventType, 'event.eventType'),
    contractCode: event.contractCode === undefined || event.contractCode === null ? null : text(event.contractCode, 'event.contractCode'),
    schemaVersion: text(event.schemaVersion, 'event.schemaVersion'),
    traceId: text(event.traceId, 'event.traceId'),
    correlationId: text(event.correlationId, 'event.correlationId'),
    idempotencyKey: text(event.idempotencyKey, 'event.idempotencyKey'),
    receivedAt: iso(event.receivedAt === undefined ? clock() : event.receivedAt, 'receivedAt')
  });
}

class PostgresRuntimePersistence {
  constructor(options = {}) {
    this.client = requireQueryClient(options.client);
    this.moduleId = moduleId(options.moduleId);
    this.prSchema = text(options.prSchema, 'prSchema').toLowerCase();
    this.schemaName = moduleSchema(this.prSchema, this.moduleId);
    this.schemaSql = quoteIdentifier(this.schemaName);
    this.clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  }

  _table(name) {
    return `${this.schemaSql}.${quoteIdentifier(name)}`;
  }

  _owner(value) {
    const owner = moduleId(value, 'ownerModule');
    if (owner !== this.moduleId) fail('MODULE_OWNER_MISMATCH', `${this.moduleId} persistence rejects writes owned by ${owner}`);
    return owner;
  }

  async _connection(work) {
    if (typeof this.client.connect !== 'function') return work(this.client);
    const connection = await this.client.connect();
    try { return await work(connection); } finally {
      if (typeof connection.release === 'function') connection.release();
      else if (typeof connection.end === 'function') await connection.end();
    }
  }

  async _transaction(work) {
    return this._connection(async (connection) => {
      await connection.query('BEGIN');
      try {
        const result = await work(connection);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        try { await connection.query('ROLLBACK'); } catch (_) { /* preserve the original failure */ }
        throw error;
      }
    });
  }

  async healthCheck() {
    const result = await this._connection((connection) => connection.query(
      `SELECT module_owner FROM ${this._table('schema_migrations')} WHERE migration_id = $1`,
      ['002_runtime_persistence']
    ));
    const owner = rows(result)[0]?.module_owner;
    if (owner !== this.moduleId) fail('PERSISTENCE_SCHEMA_NOT_READY', `${this.moduleId} persistence schema is not migrated`, { schemaName: this.schemaName });
    return Object.freeze({ status: 'ready', moduleId: this.moduleId, schemaName: this.schemaName });
  }

  async hydrate(input = {}) {
    this._owner(input.ownerModule);
    const context = scenarioContext(input.scenarioContext);
    const aggregateId = text(input.aggregateId || 'root', 'aggregateId');
    const result = await this._connection((connection) => connection.query(
      `SELECT module_owner, state_revision, state_schema_version, state_json, state_digest, updated_at,
              scenario_formed_at, scenario_status
         FROM ${this._table('aggregate_state')}
        WHERE scenario_id = $1 AND scenario_version = $2 AND scenario_run_id = $3
          AND aggregate_id = $4 AND module_owner = $5`,
      [context.scenarioId, context.scenarioVersion, context.scenarioRunId, aggregateId, this.moduleId]
    ));
    const record = rows(result)[0];
    if (!record) return null;
    const storedFormedAt = new Date(record.scenario_formed_at).toISOString();
    if (storedFormedAt !== context.formedAt || record.scenario_status !== context.status) {
      fail('SCENARIO_CONTEXT_MISMATCH', 'persisted aggregate has a different strict C033 context', {
        requested: context,
        stored: { formedAt: storedFormedAt, status: record.scenario_status }
      });
    }
    const state = parseJson(record.state_json, 'aggregate_state.state_json');
    const digest = sha256(state);
    if (digest !== record.state_digest) fail('STATE_DIGEST_MISMATCH', 'persisted aggregate state failed its SHA-256 check', { aggregateId });
    return Object.freeze({
      moduleId: this.moduleId,
      scenarioContext: Object.freeze({
        ...context,
        formedAt: storedFormedAt,
        status: record.scenario_status
      }),
      aggregateId,
      revision: Number(record.state_revision),
      stateSchemaVersion: record.state_schema_version,
      state,
      stateDigest: digest,
      updatedAt: new Date(record.updated_at).toISOString()
    });
  }

  _normalizeSave(input = {}, options = {}) {
    const owner = this._owner(input.ownerModule);
    const context = scenarioContext(input.scenarioContext);
    const aggregateId = text(input.aggregateId || 'root', 'aggregateId');
    const expectedRevision = Number(input.expectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail('EXPECTED_REVISION_INVALID', 'expectedRevision must be a non-negative integer');
    const stateSchemaVersion = text(input.stateSchemaVersion, 'stateSchemaVersion');
    const state = clone(input.state, 'state');
    const stateDigest = sha256(state);
    const updatedAt = iso(input.updatedAt === undefined ? this.clock() : input.updatedAt, 'updatedAt');
    const nextRevision = expectedRevision + 1;
    const audit = auditRecord(input.audit, context, owner, nextRevision, this.clock);
    if (!Array.isArray(input.outbox || [])) fail('OUTBOX_EVENT_INVALID', 'outbox must be an array');
    const outbox = (input.outbox || []).map((event) => outboxRecord(event, context, owner, this.clock));
    if (new Set(outbox.map((event) => event.eventId)).size !== outbox.length) fail('OUTBOX_EVENT_DUPLICATE', 'one state mutation cannot contain duplicate outbox event IDs');
    const idempotencyKey = text(options.idempotencyKey || input.idempotencyKey || audit.idempotencyKey, 'idempotencyKey');
    if (input.idempotencyKey && input.idempotencyKey !== audit.idempotencyKey) {
      fail('OPERATION_IDEMPOTENCY_KEY_MISMATCH', 'save idempotencyKey must match audit.idempotencyKey');
    }
    const requestMaterial = {
      moduleOwner: owner,
      scenarioContext: context,
      aggregateId,
      stateSchemaVersion,
      state,
      audit: {
        eventType: audit.eventType,
        operation: audit.operation,
        outcome: audit.outcome,
        actorRef: audit.actorRef,
        traceId: audit.traceId,
        correlationId: audit.correlationId
      },
      outbox,
      extra: options.digestExtra || null
    };
    const requestDigest = sha256(requestMaterial);
    if (input.requestDigest && sha(input.requestDigest, 'requestDigest') !== requestDigest) {
      fail('OPERATION_REQUEST_DIGEST_MISMATCH', 'requestDigest does not match the exact owner operation input');
    }
    return Object.freeze({
      owner, context, aggregateId, expectedRevision, nextRevision,
      stateSchemaVersion, state, stateDigest, updatedAt, audit, outbox,
      idempotencyKey, requestDigest,
      formedAt: iso(input.operationFormedAt === undefined ? this.clock() : input.operationFormedAt, 'operationFormedAt')
    });
  }

  async _claimOperation(connection, operation) {
    const context = operation.context;
    const inserted = await connection.query(
      `INSERT INTO ${this._table('owner_operations')} (
         idempotency_key, module_owner, request_digest, scenario_id, scenario_version,
         scenario_run_id, scenario_formed_at, scenario_status, aggregate_id,
         operation_status, formed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'processing',$10)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
      [
        operation.idempotencyKey, operation.owner, operation.requestDigest,
        context.scenarioId, context.scenarioVersion, context.scenarioRunId,
        context.formedAt, context.status, operation.aggregateId, operation.formedAt
      ]
    );
    if (rowCount(inserted) === 1) return { duplicate: false, result: null };
    const existing = await connection.query(
      `SELECT * FROM ${this._table('owner_operations')} WHERE idempotency_key = $1 FOR UPDATE`,
      [operation.idempotencyKey]
    );
    const prior = rows(existing)[0];
    if (!prior || prior.module_owner !== operation.owner || prior.request_digest !== operation.requestDigest
        || prior.scenario_id !== context.scenarioId || prior.scenario_version !== context.scenarioVersion
        || prior.scenario_run_id !== context.scenarioRunId
        || new Date(prior.scenario_formed_at).toISOString() !== context.formedAt
        || prior.scenario_status !== context.status || prior.aggregate_id !== operation.aggregateId) {
      fail('OPERATION_IDEMPOTENCY_CONFLICT', 'idempotencyKey is already bound to another owner operation', {
        idempotencyKey: operation.idempotencyKey
      });
    }
    if (prior.operation_status !== 'completed' || prior.result_json === null || prior.result_json === undefined) {
      fail('OPERATION_IN_PROGRESS', 'owner operation exists without a completed result', { idempotencyKey: operation.idempotencyKey });
    }
    return { duplicate: true, result: parseJson(prior.result_json, 'owner_operations.result_json') };
  }

  async _completeOperation(connection, operation, result) {
    const completedAt = iso(this.clock(), 'operation.completedAt');
    const updated = await connection.query(
      `UPDATE ${this._table('owner_operations')}
          SET operation_status = 'completed', state_revision = $4, state_digest = $5,
              audit_id = $6, result_json = $7::jsonb, completed_at = $8
        WHERE idempotency_key = $1 AND module_owner = $2 AND request_digest = $3
          AND operation_status = 'processing'
      RETURNING idempotency_key`,
      [
        operation.idempotencyKey, operation.owner, operation.requestDigest,
        result.revision, result.stateDigest, result.auditId,
        JSON.stringify(result), completedAt
      ]
    );
    if (rowCount(updated) !== 1) fail('OPERATION_COMPLETION_CONFLICT', 'owner operation could not be completed atomically');
  }

  async _writeState(connection, operation) {
    const {
      context, aggregateId, owner, nextRevision, stateSchemaVersion, state,
      stateDigest, updatedAt, expectedRevision, audit, outbox
    } = operation;
    const params = [
      context.scenarioId, context.scenarioVersion, context.scenarioRunId,
      context.formedAt, context.status, aggregateId, owner, nextRevision, stateSchemaVersion,
      JSON.stringify(state), stateDigest, updatedAt
    ];
    const stateResult = expectedRevision === 0
      ? await connection.query(
        `INSERT INTO ${this._table('aggregate_state')} (
           scenario_id, scenario_version, scenario_run_id, scenario_formed_at, scenario_status,
           aggregate_id, module_owner, state_revision, state_schema_version, state_json,
           state_digest, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)
         ON CONFLICT (scenario_id, scenario_version, scenario_run_id, aggregate_id) DO NOTHING
         RETURNING state_revision`,
        params
      )
      : await connection.query(
        `UPDATE ${this._table('aggregate_state')}
            SET state_revision = $8, state_schema_version = $9, state_json = $10::jsonb,
                state_digest = $11, updated_at = $12
          WHERE scenario_id = $1 AND scenario_version = $2 AND scenario_run_id = $3
            AND scenario_formed_at = $4 AND scenario_status = $5
            AND aggregate_id = $6 AND module_owner = $7 AND state_revision = $13
        RETURNING state_revision`,
        [...params, expectedRevision]
      );
    if (rowCount(stateResult) !== 1) {
      const current = await connection.query(
        `SELECT state_revision FROM ${this._table('aggregate_state')}
          WHERE scenario_id = $1 AND scenario_version = $2 AND scenario_run_id = $3 AND aggregate_id = $4`,
        [context.scenarioId, context.scenarioVersion, context.scenarioRunId, aggregateId]
      );
      fail('STATE_REVISION_CONFLICT', 'aggregate state changed before the transaction committed', {
        expectedRevision,
        actualRevision: rows(current)[0] ? Number(rows(current)[0].state_revision) : null
      });
    }

    await connection.query(
      `INSERT INTO ${this._table('audit_log')} (
         audit_id, module_owner, scenario_id, scenario_version, scenario_run_id,
         scenario_formed_at, scenario_status, state_revision, event_type, operation,
         outcome, actor_ref, trace_id, correlation_id, idempotency_key, record_json, formed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17)`,
      [
        audit.auditId, owner, context.scenarioId, context.scenarioVersion,
        context.scenarioRunId, context.formedAt, context.status, nextRevision,
        audit.eventType, audit.operation, audit.outcome, audit.actorRef,
        audit.traceId, audit.correlationId, audit.idempotencyKey,
        JSON.stringify(audit.record), audit.formedAt
      ]
    );

    for (const event of outbox) {
      const inserted = await connection.query(
        `INSERT INTO ${this._table('outbox_events')} (
           event_id, module_owner, scenario_id, scenario_version, scenario_run_id,
           scenario_formed_at, scenario_status, event_type, contract_code, schema_version,
           payload_json, payload_digest, trace_id, correlation_id, idempotency_key, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16)
         ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
        [
          event.eventId, owner, context.scenarioId, context.scenarioVersion,
          context.scenarioRunId, context.formedAt, context.status,
          event.eventType, event.contractCode, event.schemaVersion,
          JSON.stringify(event.payload), event.payloadDigest, event.traceId,
          event.correlationId, event.idempotencyKey, event.createdAt
        ]
      );
      if (rowCount(inserted) === 0) {
        const existing = await connection.query(
          `SELECT * FROM ${this._table('outbox_events')} WHERE event_id = $1 FOR UPDATE`,
          [event.eventId]
        );
        const prior = rows(existing)[0];
        if (!prior || prior.module_owner !== owner || prior.payload_digest !== event.payloadDigest
            || prior.scenario_id !== context.scenarioId || prior.scenario_version !== context.scenarioVersion
            || prior.scenario_run_id !== context.scenarioRunId
            || new Date(prior.scenario_formed_at).toISOString() !== context.formedAt
            || prior.scenario_status !== context.status || prior.event_type !== event.eventType
            || prior.contract_code !== event.contractCode || prior.schema_version !== event.schemaVersion
            || prior.trace_id !== event.traceId || prior.correlation_id !== event.correlationId
            || prior.idempotency_key !== event.idempotencyKey) {
          fail('OUTBOX_IDEMPOTENCY_CONFLICT', 'outbox event ID is already bound to different content', { eventId: event.eventId });
        }
      }
    }
    return Object.freeze({
      status: 'saved', duplicate: false, moduleId: this.moduleId,
      schemaName: this.schemaName, scenarioContext: context, aggregateId,
      revision: nextRevision, stateDigest, auditId: audit.auditId,
      idempotencyKey: operation.idempotencyKey,
      requestDigest: operation.requestDigest,
      outboxEventIds: outbox.map((event) => event.eventId)
    });
  }

  async _saveWithin(connection, operation) {
    const claim = await this._claimOperation(connection, operation);
    if (claim.duplicate) {
      return Object.freeze({ ...claim.result, status: 'duplicate', duplicate: true });
    }
    const result = await this._writeState(connection, operation);
    await this._completeOperation(connection, operation, result);
    return result;
  }

  async save(input = {}) {
    const operation = this._normalizeSave(input);
    return this._transaction((connection) => this._saveWithin(connection, operation));
  }

  async listAudit(input = {}) {
    this._owner(input.ownerModule);
    const context = scenarioContext(input.scenarioContext);
    const limit = input.limit === undefined ? 1000 : Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000) fail('AUDIT_LIMIT_INVALID', 'audit limit must be between 1 and 10000');
    const result = await this._connection((connection) => connection.query(
      `SELECT * FROM ${this._table('audit_log')}
        WHERE module_owner = $1 AND scenario_id = $2 AND scenario_version = $3
          AND scenario_run_id = $4 AND scenario_formed_at = $5 AND scenario_status = $6
        ORDER BY audit_sequence LIMIT $7`,
      [
        this.moduleId, context.scenarioId, context.scenarioVersion,
        context.scenarioRunId, context.formedAt, context.status, limit
      ]
    ));
    return Object.freeze(rows(result).map((record) => Object.freeze({
      sequence: Number(record.audit_sequence),
      auditId: record.audit_id,
      moduleOwner: record.module_owner,
      scenarioContext: context,
      stateRevision: record.state_revision === null ? null : Number(record.state_revision),
      eventType: record.event_type,
      operation: record.operation,
      outcome: record.outcome,
      actorRef: record.actor_ref,
      traceId: record.trace_id,
      correlationId: record.correlation_id,
      idempotencyKey: record.idempotency_key,
      record: parseJson(record.record_json, 'audit.record_json'),
      formedAt: new Date(record.formed_at).toISOString()
    })));
  }

  async listPendingOutbox(input = {}) {
    this._owner(input.ownerModule);
    const limit = input.limit === undefined ? 100 : Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) fail('OUTBOX_LIMIT_INVALID', 'outbox limit must be between 1 and 1000');
    const result = await this._connection((connection) => connection.query(
      `SELECT * FROM ${this._table('outbox_events')}
        WHERE module_owner = $1 AND published_at IS NULL
        ORDER BY created_at, event_id LIMIT $2`,
      [this.moduleId, limit]
    ));
    return Object.freeze(rows(result).map((record) => Object.freeze({
      eventId: record.event_id,
      moduleOwner: record.module_owner,
      scenarioContext: Object.freeze({
        scenarioId: record.scenario_id,
        scenarioVersion: record.scenario_version,
        scenarioRunId: record.scenario_run_id,
        formedAt: new Date(record.scenario_formed_at).toISOString(),
        status: record.scenario_status
      }),
      eventType: record.event_type,
      contractCode: record.contract_code,
      schemaVersion: record.schema_version,
      payload: parseJson(record.payload_json, 'outbox.payload_json'),
      payloadDigest: record.payload_digest,
      traceId: record.trace_id,
      correlationId: record.correlation_id,
      idempotencyKey: record.idempotency_key,
      createdAt: new Date(record.created_at).toISOString(),
      publishAttempts: Number(record.publish_attempts)
    })));
  }

  async markOutboxPublished(input = {}) {
    this._owner(input.ownerModule);
    const eventId = text(input.eventId, 'eventId');
    const publishedAt = iso(input.publishedAt === undefined ? this.clock() : input.publishedAt, 'publishedAt');
    const result = await this._connection((connection) => connection.query(
      `UPDATE ${this._table('outbox_events')}
          SET published_at = COALESCE(published_at, $3), publish_attempts = publish_attempts + 1, last_error = NULL
        WHERE event_id = $1 AND module_owner = $2
      RETURNING event_id, published_at, publish_attempts`,
      [eventId, this.moduleId, publishedAt]
    ));
    if (rowCount(result) !== 1) fail('OUTBOX_EVENT_NOT_FOUND', `outbox event ${eventId} was not found`);
    const record = rows(result)[0];
    return Object.freeze({ eventId, status: 'published', publishedAt: new Date(record.published_at).toISOString(), attempts: Number(record.publish_attempts) });
  }

  async markOutboxFailed(input = {}) {
    this._owner(input.ownerModule);
    const eventId = text(input.eventId, 'eventId');
    const error = text(input.error, 'error').slice(0, 4000);
    const result = await this._connection((connection) => connection.query(
      `UPDATE ${this._table('outbox_events')}
          SET publish_attempts = publish_attempts + 1, last_error = $3
        WHERE event_id = $1 AND module_owner = $2 AND published_at IS NULL
      RETURNING event_id, publish_attempts`,
      [eventId, this.moduleId, error]
    ));
    if (rowCount(result) !== 1) fail('OUTBOX_EVENT_NOT_PENDING', `outbox event ${eventId} is missing or already published`);
    return Object.freeze({ eventId, status: 'failed', attempts: Number(rows(result)[0].publish_attempts) });
  }

  async _acceptInbox(connection, event) {
    const context = event.scenarioContext;
    const inserted = await connection.query(
      `INSERT INTO ${this._table('inbox_dedup')} (
         consumer_module, event_id, producer_module, payload_digest, event_type,
         contract_code, schema_version, trace_id, correlation_id, idempotency_key,
         scenario_id, scenario_version, scenario_run_id, scenario_formed_at,
         scenario_status, status, received_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'received',$16)
       ON CONFLICT (consumer_module, event_id) DO NOTHING
       RETURNING event_id, status`,
      [
        event.consumerModule, event.eventId, event.producerModule, event.payloadDigest,
        event.eventType, event.contractCode, event.schemaVersion, event.traceId,
        event.correlationId, event.idempotencyKey, context.scenarioId,
        context.scenarioVersion, context.scenarioRunId, context.formedAt,
        context.status, event.receivedAt
      ]
    );
    if (rowCount(inserted) === 1) return { duplicate: false, status: 'received', prior: null };
    const existing = await connection.query(
      `SELECT * FROM ${this._table('inbox_dedup')}
        WHERE consumer_module = $1 AND event_id = $2 FOR UPDATE`,
      [event.consumerModule, event.eventId]
    );
    const prior = rows(existing)[0];
    if (!prior || prior.producer_module !== event.producerModule || prior.payload_digest !== event.payloadDigest
        || prior.scenario_id !== context.scenarioId || prior.scenario_version !== context.scenarioVersion
        || prior.scenario_run_id !== context.scenarioRunId
        || new Date(prior.scenario_formed_at).toISOString() !== context.formedAt
        || prior.scenario_status !== context.status || prior.event_type !== event.eventType
        || prior.contract_code !== event.contractCode || prior.schema_version !== event.schemaVersion
        || prior.trace_id !== event.traceId || prior.correlation_id !== event.correlationId
        || prior.idempotency_key !== event.idempotencyKey) {
      fail('INBOX_IDEMPOTENCY_CONFLICT', 'inbox event ID is already bound to different content', { eventId: event.eventId });
    }
    return { duplicate: true, status: prior.status, prior };
  }

  async _finishInbox(connection, owner, eventId, resultRef, processedAt) {
    const result = await connection.query(
      `UPDATE ${this._table('inbox_dedup')}
          SET status = 'processed', processed_at = $3, result_ref = $4
        WHERE consumer_module = $1 AND event_id = $2 AND status = 'received'
      RETURNING event_id`,
      [owner, eventId, processedAt, resultRef]
    );
    if (rowCount(result) === 1) return { duplicate: false, processedAt };
    const existing = await connection.query(
      `SELECT status, result_ref, processed_at FROM ${this._table('inbox_dedup')}
        WHERE consumer_module = $1 AND event_id = $2 FOR UPDATE`,
      [owner, eventId]
    );
    const prior = rows(existing)[0];
    if (!prior) fail('INBOX_EVENT_NOT_FOUND', `inbox event ${eventId} was not found`);
    if (prior.status !== 'processed' || prior.result_ref !== resultRef) {
      fail('INBOX_RESULT_CONFLICT', 'inbox event already has another terminal result', { eventId });
    }
    return { duplicate: true, processedAt: new Date(prior.processed_at).toISOString() };
  }

  async receiveInbox(input = {}) {
    const owner = this._owner(input.ownerModule);
    const event = inboxEvent(input, owner, this.clock);
    return this._transaction(async (connection) => {
      const accepted = await this._acceptInbox(connection, event);
      return Object.freeze({
        status: accepted.status,
        duplicate: accepted.duplicate,
        eventId: event.eventId,
        payloadDigest: event.payloadDigest,
        resultRef: accepted.prior?.result_ref || null,
        scenarioContext: event.scenarioContext
      });
    });
  }

  async completeInbox(input = {}) {
    const owner = this._owner(input.ownerModule);
    const eventId = text(input.eventId, 'eventId');
    const resultRef = text(input.resultRef, 'resultRef');
    const processedAt = iso(input.processedAt === undefined ? this.clock() : input.processedAt, 'processedAt');
    return this._transaction(async (connection) => {
      const completed = await this._finishInbox(connection, owner, eventId, resultRef, processedAt);
      return Object.freeze({ status: 'processed', eventId, resultRef, ...completed });
    });
  }

  async consumeAndSave(input = {}) {
    const owner = this._owner(input.ownerModule);
    const event = inboxEvent(input, owner, this.clock);
    const context = input.scenarioContext ? scenarioContext(input.scenarioContext) : event.scenarioContext;
    if (stableSerialize(context) !== stableSerialize(event.scenarioContext)) {
      fail('INBOX_CONTEXT_MISMATCH', 'consumer state and inbox event must use the same strict C033 context');
    }
    const resultRef = text(input.resultRef, 'resultRef');
    const processedAt = iso(input.processedAt === undefined ? this.clock() : input.processedAt, 'processedAt');
    const operation = this._normalizeSave({ ...input, scenarioContext: context }, {
      idempotencyKey: event.idempotencyKey,
      digestExtra: {
        inbox: {
          eventId: event.eventId,
          producerModule: event.producerModule,
          payloadDigest: event.payloadDigest,
          eventType: event.eventType,
          contractCode: event.contractCode,
          schemaVersion: event.schemaVersion
        },
        resultRef
      }
    });
    const committed = await this._transaction(async (connection) => {
      const accepted = await this._acceptInbox(connection, event);
      const saved = await this._saveWithin(connection, operation);
      if (accepted.status === 'processed' && saved.duplicate !== true) {
        fail('INBOX_OPERATION_STATE_CONFLICT', 'processed inbox event has no matching completed owner operation', { eventId: event.eventId });
      }
      const completed = await this._finishInbox(connection, owner, event.eventId, resultRef, processedAt);
      return {
        ...saved,
        duplicate: accepted.duplicate || saved.duplicate === true || completed.duplicate,
        inbox: {
          eventId: event.eventId,
          producerModule: event.producerModule,
          payloadDigest: event.payloadDigest,
          status: 'processed',
          resultRef,
          processedAt: completed.processedAt
        }
      };
    });
    return Object.freeze({ ...committed, ackAllowed: true });
  }

  async registerCheckpoint(input = {}) {
    const owner = this._owner(input.ownerModule);
    const context = scenarioContext(input.scenarioContext);
    const checkpoint = {
      checkpointId: text(input.checkpointId, 'checkpointId'),
      sourceScenarioRunId: text(input.sourceScenarioRunId || context.scenarioRunId, 'sourceScenarioRunId'),
      checkpointSchemaVersion: text(input.checkpointSchemaVersion, 'checkpointSchemaVersion'),
      baselineVersion: text(input.baselineVersion, 'baselineVersion'),
      baselineSnapshotId: text(input.baselineSnapshotId, 'baselineSnapshotId'),
      storageUri: text(input.storageUri, 'storageUri'),
      contentSha256: sha(input.contentSha256, 'contentSha256'),
      manifestSha256: sha(input.manifestSha256, 'manifestSha256'),
      restoreReadiness: input.restoreReadiness || 'not-verified',
      metadata: clone(input.metadata || {}, 'checkpoint.metadata'),
      formedAt: iso(input.formedAt === undefined ? this.clock() : input.formedAt, 'checkpoint.formedAt')
    };
    if (checkpoint.sourceScenarioRunId !== context.scenarioRunId) fail('CHECKPOINT_SOURCE_RUN_MISMATCH', 'checkpoint source run must match scenarioContext');
    if (!['verified', 'not-verified'].includes(checkpoint.restoreReadiness)) fail('CHECKPOINT_READINESS_INVALID', 'restoreReadiness must be verified or not-verified');
    if (!/^(?:s3|minio):\/\//.test(checkpoint.storageUri)) fail('CHECKPOINT_STORAGE_URI_INVALID', 'checkpoint storageUri must be an object-storage URI');
    return this._transaction(async (connection) => {
      const result = await connection.query(
        `INSERT INTO ${this._table('checkpoint_catalog')} (
           checkpoint_id, module_owner, scenario_id, scenario_version, scenario_run_id,
           scenario_formed_at, scenario_status,
           source_scenario_run_id, checkpoint_schema_version, baseline_version,
           baseline_snapshot_id, storage_uri, content_sha256, manifest_sha256,
           restore_readiness, metadata_json, immutable, formed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,true,$17)
         ON CONFLICT (checkpoint_id) DO NOTHING RETURNING checkpoint_id`,
        [
          checkpoint.checkpointId, owner, context.scenarioId, context.scenarioVersion,
          context.scenarioRunId, context.formedAt, context.status,
          checkpoint.sourceScenarioRunId,
          checkpoint.checkpointSchemaVersion, checkpoint.baselineVersion,
          checkpoint.baselineSnapshotId, checkpoint.storageUri,
          checkpoint.contentSha256, checkpoint.manifestSha256,
          checkpoint.restoreReadiness, JSON.stringify(checkpoint.metadata), checkpoint.formedAt
        ]
      );
      if (rowCount(result) === 1) return Object.freeze({ status: 'registered', duplicate: false, moduleId: owner, scenarioContext: context, ...checkpoint });
      const existing = await connection.query(
        `SELECT * FROM ${this._table('checkpoint_catalog')} WHERE checkpoint_id = $1`,
        [checkpoint.checkpointId]
      );
      const prior = rows(existing)[0];
      if (!prior || prior.module_owner !== owner || prior.scenario_id !== context.scenarioId
          || prior.scenario_version !== context.scenarioVersion || prior.scenario_run_id !== context.scenarioRunId
          || new Date(prior.scenario_formed_at).toISOString() !== context.formedAt
          || prior.scenario_status !== context.status
          || prior.content_sha256 !== checkpoint.contentSha256 || prior.manifest_sha256 !== checkpoint.manifestSha256
          || prior.storage_uri !== checkpoint.storageUri
          || prior.source_scenario_run_id !== checkpoint.sourceScenarioRunId
          || prior.checkpoint_schema_version !== checkpoint.checkpointSchemaVersion
          || prior.baseline_version !== checkpoint.baselineVersion
          || prior.baseline_snapshot_id !== checkpoint.baselineSnapshotId
          || prior.restore_readiness !== checkpoint.restoreReadiness
          || stableSerialize(parseJson(prior.metadata_json, 'checkpoint.metadata_json')) !== stableSerialize(checkpoint.metadata)
          || new Date(prior.formed_at).toISOString() !== checkpoint.formedAt) {
        fail('CHECKPOINT_IDENTITY_CONFLICT', 'checkpoint ID is already bound to another immutable object', { checkpointId: checkpoint.checkpointId });
      }
      return Object.freeze({ status: 'registered', duplicate: true, moduleId: owner, scenarioContext: context, ...checkpoint });
    });
  }

  async getCheckpoint(input = {}) {
    this._owner(input.ownerModule);
    const checkpointId = text(input.checkpointId, 'checkpointId');
    const result = await this._connection((connection) => connection.query(
      `SELECT * FROM ${this._table('checkpoint_catalog')} WHERE checkpoint_id = $1 AND module_owner = $2`,
      [checkpointId, this.moduleId]
    ));
    const record = rows(result)[0];
    if (!record) return null;
    return Object.freeze({
      checkpointId: record.checkpoint_id,
      moduleId: record.module_owner,
      scenarioContext: Object.freeze({
        scenarioId: record.scenario_id,
        scenarioVersion: record.scenario_version,
        scenarioRunId: record.scenario_run_id,
        formedAt: new Date(record.scenario_formed_at).toISOString(),
        status: record.scenario_status
      }),
      sourceScenarioRunId: record.source_scenario_run_id,
      checkpointSchemaVersion: record.checkpoint_schema_version,
      baselineVersion: record.baseline_version,
      baselineSnapshotId: record.baseline_snapshot_id,
      storageUri: record.storage_uri,
      contentSha256: record.content_sha256,
      manifestSha256: record.manifest_sha256,
      restoreReadiness: record.restore_readiness,
      metadata: parseJson(record.metadata_json, 'checkpoint.metadata_json'),
      immutable: record.immutable === true,
      formedAt: new Date(record.formed_at).toISOString()
    });
  }
}

function createPostgresRuntimePersistence(options) {
  return new PostgresRuntimePersistence(options);
}

const PostgresModuleStore = PostgresRuntimePersistence;
const createPostgresModuleStore = createPostgresRuntimePersistence;

module.exports = Object.freeze({
  PostgresRuntimePersistence,
  PostgresModuleStore,
  createPostgresRuntimePersistence,
  createPostgresModuleStore
});
