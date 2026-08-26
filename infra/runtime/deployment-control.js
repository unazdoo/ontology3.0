'use strict';

const {
  fail,
  text,
  prSchema,
  moduleSchema,
  quoteIdentifier,
  stableSerialize,
  sha256,
  clone,
  iso
} = require('./common');

const CONTROL_ID = 'implementation';
const MAINTENANCE_VERSION = 'implementation-0.0.0';
const ACTIVE_VERSION = 'implementation-0.1.0';
const MODES = Object.freeze(['enabled', 'disabled']);
const MODULE_IDS = Object.freeze(['M01', 'M02', 'M03', 'M04', 'M05', 'M06']);
const BUSINESS_WRITE_METHODS = new Set([
  'save', 'consumeAndSave', 'receiveInbox', 'completeInbox',
  'registerCheckpoint', 'markOutboxPublished', 'markOutboxFailed'
]);

function rows(result) {
  return Array.isArray(result?.rows) ? result.rows : [];
}

function rowCount(result) {
  return Number.isInteger(result?.rowCount) ? result.rowCount : rows(result).length;
}

function parseJson(value, label) {
  if (value && typeof value === 'object') return clone(value, label);
  try { return JSON.parse(value); } catch (error) {
    fail('DEPLOYMENT_CONTROL_JSON_INVALID', `${label} is not valid JSON`, { cause: error.message });
  }
}

function requireClient(client) {
  if (!client || (typeof client.query !== 'function' && typeof client.connect !== 'function')) {
    fail('POSTGRES_CLIENT_INVALID', 'deployment control requires a PostgreSQL client or pool');
  }
  return client;
}

function deploymentMode(version, mode) {
  const targetVersion = text(version, 'targetVersion');
  const targetMode = text(mode, 'targetMode').toLowerCase();
  if (!MODES.includes(targetMode)) fail('DEPLOYMENT_MODE_INVALID', 'targetMode must be enabled or disabled');
  if (targetVersion === MAINTENANCE_VERSION && targetMode !== 'disabled') {
    fail('DEPLOYMENT_MODE_INVALID', `${MAINTENANCE_VERSION} is Foundation-only and must remain disabled`);
  }
  if (targetMode === 'disabled' && targetVersion !== MAINTENANCE_VERSION) {
    fail('DEPLOYMENT_MODE_INVALID', `disabled mode is reserved for ${MAINTENANCE_VERSION}`);
  }
  return { targetVersion, targetMode };
}

function renderDeploymentControlMigration(prSchemaValue) {
  const schema = quoteIdentifier(prSchema(prSchemaValue));
  return `
CREATE TABLE IF NOT EXISTS ${schema}.deployment_control (
  control_id text PRIMARY KEY,
  state_revision bigint NOT NULL CHECK (state_revision >= 1),
  active_version text NOT NULL,
  deployment_mode text NOT NULL CHECK (deployment_mode IN ('enabled', 'disabled')),
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS ${schema}.deployment_control_receipts (
  receipt_id text PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  from_version text NOT NULL,
  from_mode text NOT NULL,
  to_version text NOT NULL,
  to_mode text NOT NULL,
  expected_revision bigint NOT NULL,
  committed_revision bigint NOT NULL,
  actor_ref text NOT NULL,
  reason text NOT NULL,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  formed_at timestamptz NOT NULL,
  receipt_json jsonb NOT NULL,
  receipt_digest text NOT NULL CHECK (receipt_digest ~ '^[a-f0-9]{64}$')
);

CREATE OR REPLACE FUNCTION ${schema}.reject_deployment_receipt_mutation()
RETURNS trigger LANGUAGE plpgsql AS $ofw$
BEGIN
  RAISE EXCEPTION 'deployment control receipts are append-only' USING ERRCODE = '55000';
END;
$ofw$;

DROP TRIGGER IF EXISTS deployment_control_receipts_immutable ON ${schema}.deployment_control_receipts;
CREATE TRIGGER deployment_control_receipts_immutable
BEFORE UPDATE OR DELETE ON ${schema}.deployment_control_receipts
FOR EACH ROW EXECUTE FUNCTION ${schema}.reject_deployment_receipt_mutation();
`.trim();
}

class PostgresDeploymentControl {
  constructor(options = {}) {
    this.client = requireClient(options.client);
    this.prSchema = prSchema(options.prSchema);
    this.schemaSql = quoteIdentifier(this.prSchema);
    this.clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  }

  _table(name) {
    return `${this.schemaSql}.${quoteIdentifier(name)}`;
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
        try { await connection.query('ROLLBACK'); } catch (_) { /* retain original failure */ }
        throw error;
      }
    });
  }

  async install(input = {}) {
    const initialVersion = input.initialVersion || ACTIVE_VERSION;
    const initialMode = input.initialMode || 'enabled';
    deploymentMode(initialVersion, initialMode);
    const formedAt = iso(input.formedAt === undefined ? this.clock() : input.formedAt, 'formedAt');
    const actorRef = text(input.actorRef || 'platform-foundation', 'actorRef');
    return this._transaction(async (connection) => {
      await connection.query(renderDeploymentControlMigration(this.prSchema));
      await connection.query(
        `INSERT INTO ${this._table('deployment_control')} (
           control_id, state_revision, active_version, deployment_mode, updated_at, updated_by
         ) VALUES ($1,1,$2,$3,$4,$5)
         ON CONFLICT (control_id) DO NOTHING`,
        [CONTROL_ID, initialVersion, initialMode, formedAt, actorRef]
      );
      const current = await connection.query(
        `SELECT * FROM ${this._table('deployment_control')} WHERE control_id = $1`,
        [CONTROL_ID]
      );
      if (rowCount(current) !== 1) fail('DEPLOYMENT_CONTROL_INSTALL_FAILED', 'deployment control row was not created');
      return this._state(rows(current)[0]);
    });
  }

  _state(record) {
    return Object.freeze({
      controlId: record.control_id,
      revision: Number(record.state_revision),
      activeVersion: record.active_version,
      mode: record.deployment_mode,
      updatedAt: new Date(record.updated_at).toISOString(),
      updatedBy: record.updated_by
    });
  }

  async current() {
    const result = await this._connection((connection) => connection.query(
      `SELECT * FROM ${this._table('deployment_control')} WHERE control_id = $1`,
      [CONTROL_ID]
    ));
    if (rowCount(result) !== 1) fail('DEPLOYMENT_CONTROL_NOT_INSTALLED', 'deployment control is not installed in the PR base schema');
    return this._state(rows(result)[0]);
  }

  async switchDeployment(input = {}) {
    const expectedRevision = Number(input.expectedRevision);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) fail('DEPLOYMENT_REVISION_INVALID', 'expectedRevision must be a positive integer');
    const { targetVersion, targetMode } = deploymentMode(input.targetVersion, input.targetMode);
    const actorRef = text(input.actorRef, 'actorRef');
    const reason = text(input.reason, 'reason');
    const traceId = text(input.traceId, 'traceId');
    const correlationId = text(input.correlationId, 'correlationId');
    const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey');
    const formedAt = iso(input.formedAt === undefined ? this.clock() : input.formedAt, 'formedAt');
    const request = {
      expectedRevision, targetVersion, targetMode, actorRef, reason, traceId,
      correlationId, expectedSourceVersion: input.expectedSourceVersion || null
    };
    const requestDigest = sha256(request);
    return this._transaction(async (connection) => {
      const stateResult = await connection.query(
        `SELECT * FROM ${this._table('deployment_control')} WHERE control_id = $1 FOR UPDATE`,
        [CONTROL_ID]
      );
      if (rowCount(stateResult) !== 1) fail('DEPLOYMENT_CONTROL_NOT_INSTALLED', 'deployment control is not installed');
      const source = this._state(rows(stateResult)[0]);
      const priorResult = await connection.query(
        `SELECT request_digest, receipt_json, receipt_digest FROM ${this._table('deployment_control_receipts')}
          WHERE idempotency_key = $1 FOR UPDATE`,
        [idempotencyKey]
      );
      const prior = rows(priorResult)[0];
      if (prior) {
        if (prior.request_digest !== requestDigest) fail('DEPLOYMENT_IDEMPOTENCY_CONFLICT', 'deployment idempotency key is bound to another request');
        const receipt = parseJson(prior.receipt_json, 'deployment receipt');
        const integrity = { ...receipt };
        delete integrity.receiptDigest;
        if (receipt.receiptDigest !== prior.receipt_digest || sha256(integrity) !== prior.receipt_digest) {
          fail('DEPLOYMENT_RECEIPT_CORRUPT', 'stored deployment receipt failed its SHA-256 check');
        }
        return Object.freeze({ ...receipt, status: 'duplicate', duplicate: true });
      }
      if (source.revision !== expectedRevision) {
        fail('DEPLOYMENT_REVISION_CONFLICT', 'deployment state changed before the switch', { expectedRevision, actualRevision: source.revision });
      }
      if (input.expectedSourceVersion && source.activeVersion !== input.expectedSourceVersion) {
        fail('DEPLOYMENT_SOURCE_VERSION_MISMATCH', 'deployment source version differs from the requested rollback source');
      }
      if (source.activeVersion === targetVersion && source.mode === targetMode) fail('DEPLOYMENT_NOOP', 'deployment already has the requested version and mode');
      const committedRevision = source.revision + 1;
      const updated = await connection.query(
        `UPDATE ${this._table('deployment_control')}
            SET state_revision = $2, active_version = $3, deployment_mode = $4,
                updated_at = $5, updated_by = $6
          WHERE control_id = $1 AND state_revision = $7
        RETURNING *`,
        [CONTROL_ID, committedRevision, targetVersion, targetMode, formedAt, actorRef, expectedRevision]
      );
      if (rowCount(updated) !== 1) fail('DEPLOYMENT_REVISION_CONFLICT', 'deployment CAS update failed');
      const receiptBase = {
        schemaVersion: 'ofw.implementation.deployment-switch-receipt.v1',
        receiptId: `DEPLOY-${sha256({ idempotencyKey, requestDigest }).slice(0, 24).toUpperCase()}`,
        status: 'applied',
        duplicate: false,
        controlId: CONTROL_ID,
        fromVersion: source.activeVersion,
        fromMode: source.mode,
        toVersion: targetVersion,
        toMode: targetMode,
        expectedRevision,
        committedRevision,
        actorRef,
        reason,
        traceId,
        correlationId,
        idempotencyKey,
        requestDigest,
        formedAt,
        appendOnly: true,
        downMigrationApplied: false,
        historyDeleted: false
      };
      const receiptDigest = sha256(receiptBase);
      const receipt = { ...receiptBase, receiptDigest };
      await connection.query(
        `INSERT INTO ${this._table('deployment_control_receipts')} (
           receipt_id, idempotency_key, request_digest, from_version, from_mode,
           to_version, to_mode, expected_revision, committed_revision, actor_ref,
           reason, trace_id, correlation_id, formed_at, receipt_json, receipt_digest
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
        [
          receipt.receiptId, idempotencyKey, requestDigest, source.activeVersion,
          source.mode, targetVersion, targetMode, expectedRevision,
          committedRevision, actorRef, reason, traceId, correlationId,
          formedAt, JSON.stringify(receipt), receiptDigest
        ]
      );
      return Object.freeze(receipt);
    });
  }

  async health() {
    const state = await this.current();
    return Object.freeze({
      status: 'healthy',
      controlId: state.controlId,
      activeVersion: state.activeVersion,
      deploymentMode: state.mode,
      businessWritesAllowed: state.mode === 'enabled',
      consumerDispatchAllowed: state.mode === 'enabled',
      readOnlyAuditAllowed: true,
      checkedAt: iso(this.clock(), 'checkedAt')
    });
  }

  async assertBusinessWriteAllowed(input = {}) {
    const state = await this.current();
    if (state.mode !== 'enabled') {
      fail('DEPLOYMENT_BUSINESS_WRITE_DISABLED', 'business writes are disabled by the active Foundation maintenance release', {
        operation: input.operation || null,
        activeVersion: state.activeVersion,
        revision: state.revision
      });
    }
    return state;
  }

  async assertConsumerDispatchAllowed(input = {}) {
    const state = await this.current();
    if (state.mode !== 'enabled') {
      fail('DEPLOYMENT_CONSUMER_DISPATCH_DISABLED', 'consumer dispatch is disabled by the active Foundation maintenance release', {
        eventId: input.eventId || null,
        activeVersion: state.activeVersion,
        revision: state.revision
      });
    }
    return state;
  }

  guardModuleStore(store) {
    if (!store || typeof store !== 'object') fail('MODULE_STORE_INVALID', 'guardModuleStore requires a module Store');
    const control = this;
    return new Proxy(store, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== 'function' || !BUSINESS_WRITE_METHODS.has(property)) return typeof value === 'function' ? value.bind(target) : value;
        return async (...args) => {
          await control.assertBusinessWriteAllowed({ operation: String(property) });
          return value.apply(target, args);
        };
      }
    });
  }

  guardDispatch(dispatch) {
    if (typeof dispatch !== 'function') fail('DISPATCH_INVALID', 'guardDispatch requires a function');
    return async (event, ...args) => {
      await this.assertConsumerDispatchAllowed({ eventId: event?.eventId });
      return dispatch(event, ...args);
    };
  }

  async listReceipts(input = {}) {
    const limit = input.limit === undefined ? 100 : Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) fail('DEPLOYMENT_RECEIPT_LIMIT_INVALID', 'receipt limit must be between 1 and 1000');
    const result = await this._connection((connection) => connection.query(
      `SELECT receipt_json, receipt_digest FROM ${this._table('deployment_control_receipts')}
        ORDER BY committed_revision, receipt_id LIMIT $1`,
      [limit]
    ));
    return Object.freeze(rows(result).map((record) => {
      const receipt = parseJson(record.receipt_json, 'deployment receipt');
      const integrity = { ...receipt };
      delete integrity.receiptDigest;
      if (receipt.receiptDigest !== record.receipt_digest || sha256(integrity) !== record.receipt_digest) {
        fail('DEPLOYMENT_RECEIPT_CORRUPT', 'stored deployment receipt failed its SHA-256 check');
      }
      return Object.freeze(receipt);
    }));
  }
}

async function snapshotBusinessState(client, prSchemaValue) {
  requireClient(client);
  const base = prSchema(prSchemaValue);
  const tableOrders = Object.freeze({
    aggregate_state: 'scenario_id, scenario_version, scenario_run_id, aggregate_id',
    audit_log: 'audit_sequence',
    outbox_events: 'event_id',
    inbox_dedup: 'consumer_module, event_id',
    owner_operations: 'idempotency_key',
    checkpoint_catalog: 'checkpoint_id'
  });
  const modules = {};
  let totalRecords = 0;
  for (const moduleId of MODULE_IDS) {
    const schema = quoteIdentifier(moduleSchema(base, moduleId));
    const tables = {};
    for (const [table, order] of Object.entries(tableOrders)) {
      const result = await client.query(`SELECT * FROM ${schema}.${quoteIdentifier(table)} ORDER BY ${order}`);
      const values = rows(result);
      const normalized = JSON.parse(JSON.stringify(values));
      tables[table] = { count: values.length, digest: sha256(normalized) };
      totalRecords += values.length;
    }
    modules[moduleId] = { digest: sha256(tables), tables };
  }
  return Object.freeze({
    schemaVersion: 'ofw.implementation.business-state-fingerprint.v1',
    prSchema: base,
    moduleCount: MODULE_IDS.length,
    totalRecords,
    digest: sha256(modules),
    modules
  });
}

function binding(input = {}) {
  const pullRequestNumber = Number(input.pullRequestNumber || process.env.PR_NUMBER);
  const headSha = String(input.headSha || process.env.HEAD_SHA || '').toLowerCase();
  const environmentId = String(input.environmentId || process.env.PR_ENVIRONMENT_ID || '');
  const implementationRoundId = String(input.implementationRoundId || process.env.IMPLEMENTATION_ROUND_ID || '');
  if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) fail('ROLLBACK_BINDING_INVALID', 'pullRequestNumber is required');
  if (!/^[a-f0-9]{12,64}$/.test(headSha)) fail('ROLLBACK_BINDING_INVALID', 'exact headSha is required');
  if (environmentId !== `pr-${pullRequestNumber}-${headSha.slice(0, 12)}`) fail('ROLLBACK_BINDING_INVALID', 'environmentId does not match PR/head');
  if (!implementationRoundId) fail('ROLLBACK_BINDING_INVALID', 'implementationRoundId is required');
  return { pullRequest: { number: pullRequestNumber, headSha }, environmentId, implementationRoundId };
}

async function runRollbackProbe(options = {}) {
  const control = options.control;
  if (!(control instanceof PostgresDeploymentControl)) fail('DEPLOYMENT_CONTROL_INVALID', 'runRollbackProbe requires PostgresDeploymentControl');
  const receiptBinding = binding(options);
  const sourceVersion = options.sourceVersion || ACTIVE_VERSION;
  const restoredVersion = options.restoredVersion || ACTIVE_VERSION;
  const state = await control.current();
  if (state.activeVersion !== sourceVersion || state.mode !== 'enabled') fail('ROLLBACK_SOURCE_INVALID', 'rollback probe must start from the enabled implementation release');
  const before = await snapshotBusinessState(control.client, control.prSchema);
  if (before.totalRecords < 1) fail('ROLLBACK_BUSINESS_STATE_MISSING', 'rollback probe requires existing persisted business records');
  const keyPrefix = text(options.idempotencyPrefix || `ROLLBACK-${receiptBinding.implementationRoundId}`, 'idempotencyPrefix');
  const common = {
    actorRef: options.actorRef || 'platform-release-owner',
    traceId: options.traceId || `TRACE-${keyPrefix}`,
    correlationId: options.correlationId || `CORR-${keyPrefix}`
  };
  let disabled;
  let restored;
  try {
    disabled = await control.switchDeployment({
      ...common,
      expectedRevision: state.revision,
      expectedSourceVersion: sourceVersion,
      targetVersion: MAINTENANCE_VERSION,
      targetMode: 'disabled',
      reason: options.disableReason || 'first-release rollback probe: Foundation-only maintenance mode',
      idempotencyKey: `${keyPrefix}:disable`
    });
    const disabledHealth = await control.health();
    let businessWriteBlocked = false;
    let consumerDispatchBlocked = false;
    try { await control.assertBusinessWriteAllowed({ operation: 'rollback-probe' }); }
    catch (error) { businessWriteBlocked = error.code === 'DEPLOYMENT_BUSINESS_WRITE_DISABLED'; }
    try { await control.assertConsumerDispatchAllowed({ eventId: 'ROLLBACK-PROBE' }); }
    catch (error) { consumerDispatchBlocked = error.code === 'DEPLOYMENT_CONSUMER_DISPATCH_DISABLED'; }
    if (!businessWriteBlocked || !consumerDispatchBlocked) fail('ROLLBACK_GUARD_FAILED', 'maintenance release did not block writes and dispatch');
    if (disabledHealth.status !== 'healthy' || disabledHealth.readOnlyAuditAllowed !== true) fail('ROLLBACK_HEALTH_FAILED', 'maintenance health/read-only audit is unavailable');
    const during = await snapshotBusinessState(control.client, control.prSchema);
    if (during.digest !== before.digest || during.totalRecords !== before.totalRecords) fail('ROLLBACK_HISTORY_CHANGED', 'business history changed while maintenance release was active');

    restored = await control.switchDeployment({
      ...common,
      expectedRevision: disabled.committedRevision,
      expectedSourceVersion: MAINTENANCE_VERSION,
      targetVersion: restoredVersion,
      targetMode: 'enabled',
      reason: options.restoreReason || 'rollback probe complete: restore implementation release',
      idempotencyKey: `${keyPrefix}:restore`
    });
    const after = await snapshotBusinessState(control.client, control.prSchema);
    if (after.digest !== before.digest || after.totalRecords !== before.totalRecords) fail('ROLLBACK_HISTORY_CHANGED', 'business history changed after implementation release was restored');
    const readResult = typeof options.readProbe === 'function' ? await options.readProbe() : null;
    const readRecovered = readResult === true || readResult?.ok === true || readResult?.status === 'ready';
    if (!readRecovered) fail('ROLLBACK_READ_NOT_RECOVERED', 'implementation read probe did not recover after re-enable');
    const receipts = await control.listReceipts();
    const formedAt = iso(options.formedAt === undefined ? control.clock() : options.formedAt, 'formedAt');
    return Object.freeze({
      schemaVersion: 'ofw.implementation.rollback-probe-receipt.v1',
      receiptId: `ROLLBACK-${sha256({ keyPrefix, before: before.digest, headSha: receiptBinding.pullRequest.headSha }).slice(0, 24).toUpperCase()}`,
      status: 'verified',
      productionEvidence: options.productionEvidence === true,
      ...receiptBinding,
      sourceVersion,
      targetVersion: MAINTENANCE_VERSION,
      restoredVersion,
      mode: 'foundation-only-maintenance',
      before: { digest: before.digest, totalRecords: before.totalRecords },
      disabled: { digest: during.digest, totalRecords: during.totalRecords },
      after: { digest: after.digest, totalRecords: after.totalRecords },
      businessWriteBlocked: true,
      consumerDispatchBlocked: true,
      healthAvailable: true,
      readOnlyAuditAvailable: true,
      historicalStateUnchanged: true,
      readRecovered: true,
      downMigrationApplied: false,
      historyDeleted: false,
      switchReceiptIds: [disabled.receiptId, restored.receiptId],
      appendOnlyReceiptCount: receipts.length,
      formedAt,
      evidence: options.evidence || 'artifact://rollback-probe.json'
    });
  } catch (error) {
    if (disabled && !restored) {
      const current = await control.current().catch(() => null);
      if (current?.mode === 'disabled') {
        await control.switchDeployment({
          ...common,
          expectedRevision: current.revision,
          expectedSourceVersion: MAINTENANCE_VERSION,
          targetVersion: restoredVersion,
          targetMode: 'enabled',
          reason: 'rollback probe failed: restore implementation release before escalation',
          idempotencyKey: `${keyPrefix}:emergency-restore`
        }).catch((restoreError) => { error.restoreError = restoreError; });
      }
    }
    throw error;
  }
}

function createPostgresDeploymentControl(options) {
  return new PostgresDeploymentControl(options);
}

module.exports = Object.freeze({
  CONTROL_ID,
  MAINTENANCE_VERSION,
  ACTIVE_VERSION,
  MODULE_IDS,
  PostgresDeploymentControl,
  createPostgresDeploymentControl,
  renderDeploymentControlMigration,
  snapshotBusinessState,
  runRollbackProbe
});
