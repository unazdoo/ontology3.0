'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const deployment = require('./deployment-control');

const NOW = () => '2026-08-25T15:00:00.000Z';
const PR_SCHEMA = 'pr_4_3a4da92ac01c';

class FakeDeploymentPostgres {
  constructor() {
    this.control = null;
    this.receipts = new Map();
    this.moduleTables = Object.fromEntries(deployment.MODULE_IDS.map((moduleId) => [moduleId, {
      aggregate_state: [{ scenario_id: 'S001', scenario_version: 'S001-v1', scenario_run_id: 'S001-RUN-ROLLBACK', aggregate_id: 'root', state_revision: 1, state_digest: moduleId.toLowerCase() }],
      audit_log: [], outbox_events: [], inbox_dedup: [], owner_operations: [], checkpoint_catalog: []
    }]));
    this.before = null;
  }

  async query(source, params = []) {
    const sql = String(source).replace(/\s+/g, ' ').trim();
    if (sql === 'BEGIN') {
      this.before = structuredClone({ control: this.control, receipts: this.receipts, moduleTables: this.moduleTables });
      return { rowCount: 0, rows: [] };
    }
    if (sql === 'COMMIT') { this.before = null; return { rowCount: 0, rows: [] }; }
    if (sql === 'ROLLBACK') {
      if (this.before) Object.assign(this, this.before);
      this.before = null;
      return { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS') && sql.includes('deployment_control')) return { rowCount: 0, rows: [] };
    if (sql.startsWith('INSERT INTO') && sql.includes('"deployment_control"') && !sql.includes('deployment_control_receipts')) {
      if (!this.control) {
        this.control = {
          control_id: params[0], state_revision: 1, active_version: params[1],
          deployment_mode: params[2], updated_at: params[3], updated_by: params[4]
        };
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('SELECT request_digest, receipt_json') && sql.includes('deployment_control_receipts')) {
      const receipt = this.receipts.get(params[0]);
      return receipt ? { rowCount: 1, rows: [{ request_digest: receipt.request_digest, receipt_json: structuredClone(receipt.receipt_json), receipt_digest: receipt.receipt_digest }] } : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('SELECT * FROM') && sql.includes('"deployment_control"')) {
      return this.control ? { rowCount: 1, rows: [structuredClone(this.control)] } : { rowCount: 0, rows: [] };
    }
    if (sql.startsWith('UPDATE') && sql.includes('"deployment_control"')) {
      const [controlId, revision, version, mode, updatedAt, updatedBy, expected] = params;
      if (!this.control || this.control.control_id !== controlId || this.control.state_revision !== expected) return { rowCount: 0, rows: [] };
      Object.assign(this.control, { state_revision: revision, active_version: version, deployment_mode: mode, updated_at: updatedAt, updated_by: updatedBy });
      return { rowCount: 1, rows: [structuredClone(this.control)] };
    }
    if (sql.startsWith('INSERT INTO') && sql.includes('deployment_control_receipts')) {
      const [receiptId, idempotencyKey, requestDigest, fromVersion, fromMode,
        toVersion, toMode, expectedRevision, committedRevision, actorRef, reason,
        traceId, correlationId, formedAt, receiptJson, receiptDigest] = params;
      if (this.receipts.has(idempotencyKey)) throw Object.assign(new Error('duplicate'), { code: '23505' });
      this.receipts.set(idempotencyKey, {
        receipt_id: receiptId, idempotency_key: idempotencyKey,
        request_digest: requestDigest, from_version: fromVersion, from_mode: fromMode,
        to_version: toVersion, to_mode: toMode, expected_revision: expectedRevision,
        committed_revision: committedRevision, actor_ref: actorRef, reason,
        trace_id: traceId, correlation_id: correlationId, formed_at: formedAt,
        receipt_json: JSON.parse(receiptJson), receipt_digest: receiptDigest
      });
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith('SELECT receipt_json') && sql.includes('deployment_control_receipts')) {
      const values = [...this.receipts.values()].sort((a, b) => a.committed_revision - b.committed_revision).slice(0, params[0]);
      return { rowCount: values.length, rows: values.map((item) => ({ receipt_json: structuredClone(item.receipt_json), receipt_digest: item.receipt_digest })) };
    }
    const moduleMatch = /FROM "pr_4_3a4da92ac01c_(m0[1-6])"\."([a-z_]+)"/.exec(sql);
    if (moduleMatch) {
      const moduleId = moduleMatch[1].toUpperCase();
      const values = this.moduleTables[moduleId][moduleMatch[2]];
      return { rowCount: values.length, rows: structuredClone(values) };
    }
    throw new Error(`FakeDeploymentPostgres does not understand SQL: ${sql}`);
  }
}

function switchInput(overrides = {}) {
  return {
    expectedRevision: 1,
    expectedSourceVersion: deployment.ACTIVE_VERSION,
    targetVersion: deployment.MAINTENANCE_VERSION,
    targetMode: 'disabled',
    actorRef: 'platform-owner',
    reason: 'first-release rollback',
    traceId: 'TRACE-ROLLBACK',
    correlationId: 'CORR-ROLLBACK',
    idempotencyKey: 'IDEM-ROLLBACK-DISABLE',
    formedAt: NOW(),
    ...overrides
  };
}

test('deployment control persists enabled/disabled state and immutable switch receipts', async () => {
  const database = new FakeDeploymentPostgres();
  const control = deployment.createPostgresDeploymentControl({ client: database, prSchema: PR_SCHEMA, clock: NOW });
  assert.match(deployment.renderDeploymentControlMigration(PR_SCHEMA), /deployment_control_receipts_immutable/);
  assert.match(deployment.renderDeploymentControlMigration(PR_SCHEMA), /append-only/);
  assert.equal((await control.install({ actorRef: 'platform-owner', formedAt: NOW() })).mode, 'enabled');
  const disabled = await control.switchDeployment(switchInput());
  assert.equal(disabled.toVersion, deployment.MAINTENANCE_VERSION);
  assert.match(disabled.receiptDigest, /^[a-f0-9]{64}$/);
  assert.equal((await control.current()).mode, 'disabled');
  assert.equal((await control.health()).status, 'healthy');
  assert.equal((await control.listReceipts()).length, 1);
  const duplicate = await control.switchDeployment(switchInput());
  assert.equal(duplicate.duplicate, true);
  assert.equal(database.receipts.size, 1);
  await assert.rejects(() => control.switchDeployment(switchInput({ reason: 'different' })), { code: 'DEPLOYMENT_IDEMPOTENCY_CONFLICT' });
});

test('maintenance release blocks guarded writes and dispatch while health and read methods remain available', async () => {
  const database = new FakeDeploymentPostgres();
  const control = deployment.createPostgresDeploymentControl({ client: database, prSchema: PR_SCHEMA, clock: NOW });
  await control.install({ actorRef: 'platform-owner', formedAt: NOW() });
  await control.switchDeployment(switchInput());
  let writes = 0;
  let reads = 0;
  let dispatches = 0;
  const guarded = control.guardModuleStore({
    async save() { writes += 1; return true; },
    async hydrate() { reads += 1; return { ok: true }; }
  });
  await assert.rejects(() => guarded.save({}), { code: 'DEPLOYMENT_BUSINESS_WRITE_DISABLED' });
  assert.deepEqual(await guarded.hydrate({}), { ok: true });
  const dispatch = control.guardDispatch(async () => { dispatches += 1; });
  await assert.rejects(() => dispatch({ eventId: 'EV-1' }), { code: 'DEPLOYMENT_CONSUMER_DISPATCH_DISABLED' });
  assert.equal(writes, 0);
  assert.equal(reads, 1);
  assert.equal(dispatches, 0);
  assert.equal((await control.listReceipts()).length, 1);
});

test('rollback probe preserves populated module history and restores implementation reads without down migration', async () => {
  const database = new FakeDeploymentPostgres();
  const control = deployment.createPostgresDeploymentControl({ client: database, prSchema: PR_SCHEMA, clock: NOW });
  await control.install({ actorRef: 'platform-owner', formedAt: NOW() });
  const before = await deployment.snapshotBusinessState(database, PR_SCHEMA);
  const receipt = await deployment.runRollbackProbe({
    control,
    pullRequestNumber: 4,
    headSha: '3a4da92ac01c4ea80764778478894738a0826fa7',
    environmentId: 'pr-4-3a4da92ac01c',
    implementationRoundId: 'IMPL-ROLLBACK-001',
    productionEvidence: false,
    formedAt: NOW(),
    readProbe: async () => ({ ok: true })
  });
  const after = await deployment.snapshotBusinessState(database, PR_SCHEMA);
  assert.equal(before.totalRecords > 0, true);
  assert.equal(receipt.status, 'verified');
  assert.equal(receipt.targetVersion, deployment.MAINTENANCE_VERSION);
  assert.equal(receipt.downMigrationApplied, false);
  assert.equal(receipt.historyDeleted, false);
  assert.equal(receipt.historicalStateUnchanged, true);
  assert.equal(before.digest, after.digest);
  assert.equal((await control.current()).activeVersion, deployment.ACTIVE_VERSION);
  assert.equal((await control.current()).mode, 'enabled');
  assert.equal((await control.listReceipts()).length, 2);
});

test('rollback probe refuses an empty business state and deployment CAS is fail-closed', async () => {
  const database = new FakeDeploymentPostgres();
  for (const tables of Object.values(database.moduleTables)) for (const name of Object.keys(tables)) tables[name] = [];
  const control = deployment.createPostgresDeploymentControl({ client: database, prSchema: PR_SCHEMA, clock: NOW });
  await control.install({ actorRef: 'platform-owner', formedAt: NOW() });
  await assert.rejects(() => deployment.runRollbackProbe({
    control,
    pullRequestNumber: 4,
    headSha: '3a4da92ac01c4ea80764778478894738a0826fa7',
    environmentId: 'pr-4-3a4da92ac01c',
    implementationRoundId: 'IMPL-ROLLBACK-EMPTY',
    readProbe: async () => true
  }), { code: 'ROLLBACK_BUSINESS_STATE_MISSING' });
  await assert.rejects(() => control.switchDeployment(switchInput({ expectedRevision: 99 })), { code: 'DEPLOYMENT_REVISION_CONFLICT' });
});
