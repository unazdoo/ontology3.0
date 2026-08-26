'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const runtime = require('./index');

const CONTEXT = Object.freeze({
  scenarioId: 'S001',
  scenarioVersion: 'S001-v1',
  scenarioRunId: 'S001-RUN-PERSISTENCE-001',
  formedAt: '2026-08-25T12:00:00.000Z',
  status: 'active'
});
const NOW = () => '2026-08-25T12:01:00.000Z';

function key(...parts) { return parts.join('|'); }

class FakePostgres {
  constructor(owner = 'M02') {
    this.owner = owner;
    this.state = {
      aggregates: new Map(), audits: new Map(), outbox: new Map(),
      inbox: new Map(), operations: new Map(), checkpoints: new Map()
    };
    this.before = null;
    this.failOnce = null;
  }

  async query(source, params = []) {
    const sql = String(source).replace(/\s+/g, ' ').trim();
    if (sql === 'BEGIN') { this.before = structuredClone(this.state); return { rowCount: 0, rows: [] }; }
    if (sql === 'COMMIT') { this.before = null; return { rowCount: 0, rows: [] }; }
    if (sql === 'ROLLBACK') { if (this.before) this.state = this.before; this.before = null; return { rowCount: 0, rows: [] }; }
    if (typeof this.failOnce === 'function' && this.failOnce(sql, params)) {
      this.failOnce = null;
      throw Object.assign(new Error('injected PostgreSQL failure'), { code: 'XX999' });
    }
    if (sql.includes('FROM') && sql.includes('"schema_migrations"')) return { rowCount: 1, rows: [{ module_owner: this.owner }] };

    if (sql.startsWith('INSERT INTO') && sql.includes('"owner_operations"')) {
      const [idempotencyKey, owner, requestDigest, scenarioId, scenarioVersion,
        scenarioRunId, scenarioFormedAt, scenarioStatus, aggregateId, formedAt] = params;
      if (this.state.operations.has(idempotencyKey)) return { rowCount: 0, rows: [] };
      this.state.operations.set(idempotencyKey, {
        idempotency_key: idempotencyKey, module_owner: owner,
        request_digest: requestDigest, scenario_id: scenarioId,
        scenario_version: scenarioVersion, scenario_run_id: scenarioRunId,
        scenario_formed_at: scenarioFormedAt, scenario_status: scenarioStatus,
        aggregate_id: aggregateId, operation_status: 'processing',
        state_revision: null, state_digest: null, audit_id: null,
        result_json: null, formed_at: formedAt, completed_at: null
      });
      return { rowCount: 1, rows: [{ idempotency_key: idempotencyKey }] };
    }
    if (sql.startsWith('SELECT * FROM') && sql.includes('"owner_operations"')) {
      const record = this.state.operations.get(params[0]);
      return record ? { rowCount: 1, rows: [structuredClone(record)] } : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('UPDATE') && sql.includes('"owner_operations"')) {
      const [idempotencyKey, owner, requestDigest, revision, stateDigest,
        auditId, resultJson, completedAt] = params;
      const record = this.state.operations.get(idempotencyKey);
      if (!record || record.module_owner !== owner || record.request_digest !== requestDigest
          || record.operation_status !== 'processing') return { rowCount: 0, rows: [] };
      Object.assign(record, {
        operation_status: 'completed', state_revision: revision,
        state_digest: stateDigest, audit_id: auditId,
        result_json: JSON.parse(resultJson), completed_at: completedAt
      });
      return { rowCount: 1, rows: [{ idempotency_key: idempotencyKey }] };
    }

    if (sql.startsWith('INSERT INTO') && sql.includes('"aggregate_state"')) {
      const [scenarioId, scenarioVersion, scenarioRunId, formedAt, status, aggregateId, owner,
        revision, schemaVersion, stateJson, digest, updatedAt] = params;
      const id = key(scenarioId, scenarioVersion, scenarioRunId, aggregateId);
      if (this.state.aggregates.has(id)) return { rowCount: 0, rows: [] };
      this.state.aggregates.set(id, {
        scenario_id: scenarioId, scenario_version: scenarioVersion, scenario_run_id: scenarioRunId,
        scenario_formed_at: formedAt, scenario_status: status, aggregate_id: aggregateId,
        module_owner: owner, state_revision: revision, state_schema_version: schemaVersion,
        state_json: JSON.parse(stateJson), state_digest: digest, updated_at: updatedAt
      });
      return { rowCount: 1, rows: [{ state_revision: revision }] };
    }
    if (sql.startsWith('UPDATE') && sql.includes('"aggregate_state"')) {
      const [scenarioId, scenarioVersion, scenarioRunId, formedAt, status, aggregateId, owner,
        revision, schemaVersion, stateJson, digest, updatedAt, expected] = params;
      const id = key(scenarioId, scenarioVersion, scenarioRunId, aggregateId);
      const record = this.state.aggregates.get(id);
      if (!record || record.module_owner !== owner || record.state_revision !== expected
          || new Date(record.scenario_formed_at).toISOString() !== new Date(formedAt).toISOString()
          || record.scenario_status !== status) return { rowCount: 0, rows: [] };
      Object.assign(record, {
        state_revision: revision, state_schema_version: schemaVersion,
        state_json: JSON.parse(stateJson), state_digest: digest, updated_at: updatedAt
      });
      return { rowCount: 1, rows: [{ state_revision: revision }] };
    }
    if (sql.startsWith('SELECT state_revision FROM') && sql.includes('"aggregate_state"')) {
      const record = this.state.aggregates.get(key(...params));
      return record ? { rowCount: 1, rows: [{ state_revision: record.state_revision }] } : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('SELECT module_owner, state_revision') && sql.includes('"aggregate_state"')) {
      const [scenarioId, scenarioVersion, scenarioRunId, aggregateId, owner] = params;
      const record = this.state.aggregates.get(key(scenarioId, scenarioVersion, scenarioRunId, aggregateId));
      return record && record.module_owner === owner ? { rowCount: 1, rows: [structuredClone(record)] } : { rowCount: 0, rows: [] };
    }

    if (sql.startsWith('INSERT INTO') && sql.includes('"audit_log"')) {
      const [auditId, owner, scenarioId, scenarioVersion, scenarioRunId, formedAt, status,
        revision, eventType, operation, outcome, actorRef, traceId, correlationId,
        idempotencyKey, recordJson, auditFormedAt] = params;
      if (this.state.audits.has(auditId)) throw Object.assign(new Error('duplicate audit'), { code: '23505' });
      this.state.audits.set(auditId, {
        audit_sequence: this.state.audits.size + 1,
        audit_id: auditId, module_owner: owner, scenario_id: scenarioId,
        scenario_version: scenarioVersion, scenario_run_id: scenarioRunId,
        scenario_formed_at: formedAt, scenario_status: status, state_revision: revision,
        event_type: eventType, operation, outcome, actor_ref: actorRef, trace_id: traceId,
        correlation_id: correlationId, idempotency_key: idempotencyKey,
        record_json: JSON.parse(recordJson), formed_at: auditFormedAt
      });
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith('SELECT * FROM') && sql.includes('"audit_log"')) {
      const [owner, scenarioId, scenarioVersion, scenarioRunId, formedAt, status, limit] = params;
      const values = [...this.state.audits.values()].filter((item) => item.module_owner === owner
        && item.scenario_id === scenarioId && item.scenario_version === scenarioVersion
        && item.scenario_run_id === scenarioRunId
        && new Date(item.scenario_formed_at).toISOString() === new Date(formedAt).toISOString()
        && item.scenario_status === status).slice(0, limit);
      return { rowCount: values.length, rows: structuredClone(values) };
    }

    if (sql.startsWith('INSERT INTO') && sql.includes('"outbox_events"')) {
      const [eventId, owner, scenarioId, scenarioVersion, scenarioRunId, formedAt, status,
        eventType, contractCode, schemaVersion, payloadJson, digest, traceId,
        correlationId, idempotencyKey, createdAt] = params;
      if (this.state.outbox.has(eventId)) return { rowCount: 0, rows: [] };
      this.state.outbox.set(eventId, {
        event_id: eventId, module_owner: owner, scenario_id: scenarioId,
        scenario_version: scenarioVersion, scenario_run_id: scenarioRunId,
        scenario_formed_at: formedAt, scenario_status: status, event_type: eventType,
        contract_code: contractCode, schema_version: schemaVersion,
        payload_json: JSON.parse(payloadJson), payload_digest: digest, trace_id: traceId,
        correlation_id: correlationId, idempotency_key: idempotencyKey,
        created_at: createdAt, published_at: null, publish_attempts: 0, last_error: null
      });
      return { rowCount: 1, rows: [{ event_id: eventId }] };
    }
    if (sql.startsWith('SELECT module_owner, payload_digest') && sql.includes('"outbox_events"')) {
      const record = this.state.outbox.get(params[0]);
      return record ? { rowCount: 1, rows: [structuredClone(record)] } : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('SELECT * FROM') && sql.includes('"outbox_events"') && sql.includes('WHERE event_id = $1')) {
      const record = this.state.outbox.get(params[0]);
      return record ? { rowCount: 1, rows: [structuredClone(record)] } : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('SELECT * FROM') && sql.includes('"outbox_events"')) {
      const values = [...this.state.outbox.values()].filter((item) => item.module_owner === params[0] && item.published_at === null).slice(0, params[1]);
      return { rowCount: values.length, rows: structuredClone(values) };
    }
    if (sql.startsWith('UPDATE') && sql.includes('"outbox_events"') && sql.includes('COALESCE')) {
      const [eventId, owner, publishedAt] = params;
      const record = this.state.outbox.get(eventId);
      if (!record || record.module_owner !== owner) return { rowCount: 0, rows: [] };
      record.published_at ||= publishedAt; record.publish_attempts += 1; record.last_error = null;
      return { rowCount: 1, rows: [{ event_id: eventId, published_at: record.published_at, publish_attempts: record.publish_attempts }] };
    }
    if (sql.startsWith('UPDATE') && sql.includes('"outbox_events"') && sql.includes('last_error')) {
      const [eventId, owner, error] = params;
      const record = this.state.outbox.get(eventId);
      if (!record || record.module_owner !== owner || record.published_at) return { rowCount: 0, rows: [] };
      record.publish_attempts += 1; record.last_error = error;
      return { rowCount: 1, rows: [{ event_id: eventId, publish_attempts: record.publish_attempts }] };
    }

    if (sql.startsWith('INSERT INTO') && sql.includes('"inbox_dedup"')) {
      const [consumer, eventId, producer, digest, eventType, contractCode,
        schemaVersion, traceId, correlationId, idempotencyKey, scenarioId,
        scenarioVersion, scenarioRunId, formedAt, status, receivedAt] = params;
      const id = key(consumer, eventId);
      if (this.state.inbox.has(id)) return { rowCount: 0, rows: [] };
      this.state.inbox.set(id, {
        consumer_module: consumer, event_id: eventId, producer_module: producer,
        payload_digest: digest, event_type: eventType, contract_code: contractCode,
        schema_version: schemaVersion, trace_id: traceId, correlation_id: correlationId,
        idempotency_key: idempotencyKey, scenario_id: scenarioId, scenario_version: scenarioVersion,
        scenario_run_id: scenarioRunId, scenario_formed_at: formedAt,
        scenario_status: status, status: 'received', received_at: receivedAt,
        processed_at: null, result_ref: null
      });
      return { rowCount: 1, rows: [{ event_id: eventId, status: 'received' }] };
    }
    if (sql.startsWith('UPDATE') && sql.includes('"inbox_dedup"')) {
      const [consumer, eventId, processedAt, resultRef] = params;
      const record = this.state.inbox.get(key(consumer, eventId));
      if (!record || record.status !== 'received') return { rowCount: 0, rows: [] };
      record.status = 'processed'; record.processed_at = processedAt; record.result_ref = resultRef;
      return { rowCount: 1, rows: [{ event_id: eventId }] };
    }
    if (sql.startsWith('SELECT') && sql.includes('"inbox_dedup"')) {
      const record = this.state.inbox.get(key(...params.slice(0, 2)));
      return record ? { rowCount: 1, rows: [structuredClone(record)] } : { rowCount: 0, rows: [] };
    }

    if (sql.startsWith('INSERT INTO') && sql.includes('"checkpoint_catalog"')) {
      const [checkpointId, owner, scenarioId, scenarioVersion, scenarioRunId,
        scenarioFormedAt, scenarioStatus, sourceRunId, checkpointSchemaVersion,
        baselineVersion, baselineSnapshotId, storageUri, contentSha256,
        manifestSha256, readiness, metadataJson, formedAt] = params;
      if (this.state.checkpoints.has(checkpointId)) return { rowCount: 0, rows: [] };
      this.state.checkpoints.set(checkpointId, {
        checkpoint_id: checkpointId, module_owner: owner, scenario_id: scenarioId,
        scenario_version: scenarioVersion, scenario_run_id: scenarioRunId,
        scenario_formed_at: scenarioFormedAt, scenario_status: scenarioStatus,
        source_scenario_run_id: sourceRunId, checkpoint_schema_version: checkpointSchemaVersion,
        baseline_version: baselineVersion, baseline_snapshot_id: baselineSnapshotId,
        storage_uri: storageUri, content_sha256: contentSha256,
        manifest_sha256: manifestSha256, restore_readiness: readiness,
        metadata_json: JSON.parse(metadataJson), immutable: true, formed_at: formedAt
      });
      return { rowCount: 1, rows: [{ checkpoint_id: checkpointId }] };
    }
    if (sql.startsWith('SELECT * FROM') && sql.includes('"checkpoint_catalog"')) {
      const record = this.state.checkpoints.get(params[0]);
      if (!record || params[1] && record.module_owner !== params[1]) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [structuredClone(record)] };
    }
    throw new Error(`FakePostgres does not understand SQL: ${sql}`);
  }
}

class FakePool {
  constructor(database) {
    this.database = database;
    this.connectionCount = 0;
    this.tail = Promise.resolve();
  }

  async _lock() {
    const previous = this.tail;
    let release;
    this.tail = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  }

  async connect() {
    this.connectionCount += 1;
    const pool = this;
    let unlock = null;
    return {
      async query(sql, params) {
        if (String(sql).trim() === 'BEGIN') unlock = await pool._lock();
        try { return await pool.database.query(sql, params); }
        finally {
          if (['COMMIT', 'ROLLBACK'].includes(String(sql).trim()) && unlock) {
            const release = unlock; unlock = null; release();
          }
        }
      },
      release() {}
    };
  }
}

function store(client = new FakePostgres(), moduleId = 'M02') {
  return runtime.createPostgresModuleStore({
    client, prSchema: 'pr_4_3a4da92ac01c', moduleId, clock: NOW
  });
}

function audit(id) {
  return {
    auditId: id, eventType: 'M02.state.saved', operation: 'save-state',
    outcome: 'accepted', actorRef: 'M02-owner', traceId: 'TRACE-S001-PERSIST',
    correlationId: 'CORR-S001-PERSIST', idempotencyKey: `IDEM-${id}`,
    formedAt: NOW(), record: { stage: 'M02' }
  };
}

function event(payload = { deliveryId: 'C003-S001-1' }) {
  return {
    eventId: 'EV-C003-S001-1', eventType: 'C003.delivered', contractCode: 'C003',
    schemaVersion: 'draft-0.1.0', payload, scenarioContext: CONTEXT,
    traceId: 'TRACE-S001-PERSIST', correlationId: 'CORR-S001-PERSIST',
    idempotencyKey: 'IDEM-C003-S001-1', createdAt: NOW()
  };
}

test('module schemas and writes are owner isolated', async () => {
  const value = store();
  assert.equal(value.schemaName, 'pr_4_3a4da92ac01c_m02');
  await assert.rejects(() => value.hydrate({ ownerModule: 'M01', scenarioContext: CONTEXT }), { code: 'MODULE_OWNER_MISMATCH' });
  assert.throws(() => runtime.createPostgresModuleStore({ client: new FakePostgres(), prSchema: 'main', moduleId: 'M02' }), { code: 'PR_SCHEMA_INVALID' });
  assert.deepEqual(await value.healthCheck(), { status: 'ready', moduleId: 'M02', schemaName: value.schemaName });
});

test('save commits aggregate, audit and outbox atomically and hydrates after restart', async () => {
  const client = new FakePostgres();
  const firstProcess = store(client);
  const saved = await firstProcess.save({
    ownerModule: 'M02', scenarioContext: CONTEXT, expectedRevision: 0,
    stateSchemaVersion: 'ofw.m02.state.v1', state: { assetVersionId: 'T007-S001-1' },
    audit: audit('AUD-M02-1'), outbox: [event()]
  });
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.outboxEventIds, ['EV-C003-S001-1']);
  assert.equal(client.state.audits.size, 1);
  assert.equal((await firstProcess.listAudit({ ownerModule: 'M02', scenarioContext: CONTEXT }))[0].auditId, 'AUD-M02-1');

  const restarted = store(client);
  const hydrated = await restarted.hydrate({ ownerModule: 'M02', scenarioContext: CONTEXT });
  assert.equal(hydrated.revision, 1);
  assert.deepEqual(hydrated.state, { assetVersionId: 'T007-S001-1' });
  assert.equal((await restarted.listPendingOutbox({ ownerModule: 'M02' }))[0].scenarioContext.formedAt, CONTEXT.formedAt);
  assert.equal((await restarted.markOutboxFailed({ ownerModule: 'M02', eventId: 'EV-C003-S001-1', error: 'broker unavailable' })).attempts, 1);
  assert.equal((await restarted.markOutboxPublished({ ownerModule: 'M02', eventId: 'EV-C003-S001-1' })).attempts, 2);
  assert.equal((await restarted.listPendingOutbox({ ownerModule: 'M02' })).length, 0);
});

test('owner operation ledger returns an exact retry and rejects same key with changed input', async () => {
  const client = new FakePostgres();
  const value = store(client);
  const input = {
    ownerModule: 'M02', scenarioContext: CONTEXT, expectedRevision: 0,
    stateSchemaVersion: 'ofw.m02.state.v1', state: { version: 'T007-v1' },
    audit: audit('AUD-OP-1'), outbox: [event()]
  };
  const first = await value.save(input);
  const retry = await value.save(input);
  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.revision, first.revision);
  assert.equal(client.state.operations.size, 1);
  assert.equal(client.state.audits.size, 1);
  await assert.rejects(() => value.save({ ...input, state: { version: 'T007-v2' } }), { code: 'OPERATION_IDEMPOTENCY_CONFLICT' });
  assert.equal((await value.hydrate({ ownerModule: 'M02', scenarioContext: CONTEXT })).state.version, 'T007-v1');
});

test('CAS and outbox identity conflicts rollback state and audit together', async () => {
  const client = new FakePostgres();
  const value = store(client);
  await value.save({ ownerModule: 'M02', scenarioContext: CONTEXT, expectedRevision: 0, stateSchemaVersion: 'v1', state: { n: 1 }, audit: audit('AUD-CAS-1'), outbox: [event()] });
  await assert.rejects(() => value.save({ ownerModule: 'M02', scenarioContext: CONTEXT, expectedRevision: 0, stateSchemaVersion: 'v1', state: { n: 2 }, audit: audit('AUD-CAS-2') }), { code: 'STATE_REVISION_CONFLICT' });
  assert.equal(client.state.audits.size, 1);
  assert.equal((await value.hydrate({ ownerModule: 'M02', scenarioContext: CONTEXT })).revision, 1);

  await assert.rejects(() => value.save({
    ownerModule: 'M02', scenarioContext: CONTEXT, expectedRevision: 1,
    stateSchemaVersion: 'v1', state: { n: 2 }, audit: audit('AUD-CAS-3'),
    outbox: [event({ deliveryId: 'DIFFERENT' })]
  }), { code: 'OUTBOX_IDEMPOTENCY_CONFLICT' });
  assert.equal((await value.hydrate({ ownerModule: 'M02', scenarioContext: CONTEXT })).revision, 1);
  assert.equal(client.state.audits.size, 1);
});

test('inbox suppresses duplicates and rejects same event identity with different content', async () => {
  const value = store();
  const payload = { requestId: 'C028-S001-1' };
  const incoming = { ownerModule: 'M02', event: { ...event(payload), eventId: 'EV-C029-1', producerModule: 'M01' } };
  const first = await value.receiveInbox(incoming);
  assert.equal(first.duplicate, false);
  const duplicate = await value.receiveInbox(incoming);
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(() => value.receiveInbox({ ownerModule: 'M02', event: { ...incoming.event, payload: { requestId: 'OTHER' } } }), { code: 'INBOX_IDEMPOTENCY_CONFLICT' });
  const completed = await value.completeInbox({ ownerModule: 'M02', eventId: 'EV-C029-1', resultRef: 'C029-S001-1' });
  assert.equal(completed.duplicate, false);
  const completedAgain = await value.completeInbox({ ownerModule: 'M02', eventId: 'EV-C029-1', resultRef: 'C029-S001-1' });
  assert.equal(completedAgain.duplicate, true);
  await assert.rejects(() => value.completeInbox({ ownerModule: 'M02', eventId: 'EV-C029-1', resultRef: 'OTHER' }), { code: 'INBOX_RESULT_CONFLICT' });
});

test('consumeAndSave commits inbox, owner state, audit and next outbox before allowing ack', async () => {
  const client = new FakePostgres('M01');
  const value = store(client, 'M01');
  const incoming = {
    ...event({ deliveryId: 'C003-S001-ATOMIC' }),
    producerModule: 'M02', consumerModule: 'M01', eventId: 'EV-C003-S001-ATOMIC',
    idempotencyKey: 'IDEM-C003-S001-ATOMIC'
  };
  const outgoing = {
    ...event({ c008Id: 'C008-S001-ATOMIC' }),
    eventId: 'EV-C008-S001-ATOMIC', eventType: 'C008.ready', contractCode: 'C008',
    idempotencyKey: 'IDEM-C008-S001-ATOMIC'
  };
  const input = {
    ownerModule: 'M01', event: incoming, scenarioContext: CONTEXT,
    expectedRevision: 0, stateSchemaVersion: 'ofw.m01.state.v1',
    state: { publishedId: 'T017-S001-ATOMIC' },
    audit: { ...audit('AUD-CONSUME-1'), eventType: 'M01.C003.consumed', operation: 'consume-C003' },
    outbox: [outgoing], resultRef: 'C008-S001-ATOMIC', processedAt: NOW()
  };
  const first = await value.consumeAndSave(input);
  assert.equal(first.ackAllowed, true);
  assert.equal(first.duplicate, false);
  assert.equal(client.state.inbox.get('M01|EV-C003-S001-ATOMIC').status, 'processed');
  assert.equal(client.state.aggregates.size, 1);
  assert.equal(client.state.audits.size, 1);
  assert.equal(client.state.outbox.size, 1);
  assert.equal(client.state.operations.size, 1);

  const retry = await value.consumeAndSave(input);
  assert.equal(retry.ackAllowed, true);
  assert.equal(retry.duplicate, true);
  assert.equal(client.state.audits.size, 1);

  await assert.rejects(() => value.consumeAndSave({ ...input, state: { publishedId: 'T017-CHANGED' } }), { code: 'OPERATION_IDEMPOTENCY_CONFLICT' });
  await assert.rejects(() => value.consumeAndSave({
    ...input,
    outbox: [],
    event: { ...incoming, scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-OTHER' } },
    scenarioContext: { ...CONTEXT, scenarioRunId: 'S001-RUN-OTHER' }
  }), { code: 'INBOX_IDEMPOTENCY_CONFLICT' });
});

test('consumeAndSave failure rolls back inbox, state, audit, operation and outbox so no ack is returned', async () => {
  const client = new FakePostgres('M01');
  const value = store(client, 'M01');
  const incoming = { ...event(), producerModule: 'M02', eventId: 'EV-C003-FAIL', idempotencyKey: 'IDEM-C003-FAIL' };
  const input = {
    ownerModule: 'M01', event: incoming, scenarioContext: CONTEXT,
    expectedRevision: 0, stateSchemaVersion: 'ofw.m01.state.v1', state: { n: 1 },
    audit: { ...audit('AUD-CONSUME-FAIL'), operation: 'consume-C003-fail' },
    outbox: [{ ...event(), eventId: 'EV-NEXT-FAIL', idempotencyKey: 'IDEM-NEXT-FAIL' }],
    resultRef: 'RESULT-C003-FAIL'
  };
  client.failOnce = (sql) => sql.startsWith('UPDATE') && sql.includes('"inbox_dedup"');
  await assert.rejects(() => value.consumeAndSave(input), /injected PostgreSQL failure/);
  for (const collection of ['inbox', 'aggregates', 'audits', 'operations', 'outbox']) assert.equal(client.state[collection].size, 0, collection);
  const retry = await value.consumeAndSave(input);
  assert.equal(retry.ackAllowed, true);
  assert.equal(retry.duplicate, false);
});

test('two Store connections serialize identical retries and CAS rejects different concurrent writes', async () => {
  const duplicateDb = new FakePostgres();
  const duplicatePool = new FakePool(duplicateDb);
  const left = store(duplicatePool);
  const right = store(duplicatePool);
  const exact = {
    ownerModule: 'M02', scenarioContext: CONTEXT, expectedRevision: 0,
    stateSchemaVersion: 'v1', state: { n: 1 }, audit: audit('AUD-RACE-SAME'), outbox: []
  };
  const duplicateResults = await Promise.all([left.save(exact), right.save(exact)]);
  assert.deepEqual(duplicateResults.map((item) => item.duplicate).sort(), [false, true]);
  assert.equal(duplicatePool.connectionCount, 2);
  assert.equal(duplicateDb.state.audits.size, 1);

  const conflictDb = new FakePostgres();
  const conflictPool = new FakePool(conflictDb);
  const first = store(conflictPool);
  const second = store(conflictPool);
  const outcomes = await Promise.allSettled([
    first.save({ ...exact, audit: audit('AUD-RACE-A'), state: { writer: 'A' } }),
    second.save({ ...exact, audit: audit('AUD-RACE-B'), state: { writer: 'B' } })
  ]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  const rejected = outcomes.find((item) => item.status === 'rejected');
  assert.equal(rejected.reason.code, 'STATE_REVISION_CONFLICT');
  assert.equal(conflictPool.connectionCount, 2);
  assert.equal(conflictDb.state.audits.size, 1);
  assert.equal(conflictDb.state.operations.size, 1);
});

test('checkpoint catalog is immutable and bound to object hashes and strict C033', async () => {
  const value = store();
  const input = {
    ownerModule: 'M02', scenarioContext: CONTEXT, checkpointId: 'CP-M02-S001-1',
    checkpointSchemaVersion: 'ofw.c034.checkpoint.v1', baselineVersion: 'v1.1.0',
    baselineSnapshotId: 'BSL-OFW-V110-94ABD0E991B7',
    storageUri: 'minio://ofw/pr/4/checkpoints/CP-M02-S001-1.json',
    contentSha256: 'a'.repeat(64), manifestSha256: 'b'.repeat(64),
    restoreReadiness: 'verified', metadata: { count: 7 }, formedAt: NOW()
  };
  assert.equal((await value.registerCheckpoint(input)).duplicate, false);
  assert.equal((await value.registerCheckpoint(input)).duplicate, true);
  await assert.rejects(() => value.registerCheckpoint({ ...input, contentSha256: 'c'.repeat(64) }), { code: 'CHECKPOINT_IDENTITY_CONFLICT' });
  const stored = await value.getCheckpoint({ ownerModule: 'M02', checkpointId: input.checkpointId });
  assert.equal(stored.contentSha256, input.contentSha256);
  assert.deepEqual(stored.scenarioContext, CONTEXT);
  assert.equal(stored.immutable, true);
});
