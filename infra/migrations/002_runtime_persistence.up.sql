BEGIN;

CREATE OR REPLACE FUNCTION {{MODULE_SCHEMA}}.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $ofw$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$ofw$;

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.aggregate_state (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  scenario_formed_at timestamptz NOT NULL,
  scenario_status text NOT NULL,
  aggregate_id text NOT NULL DEFAULT 'root',
  module_owner text NOT NULL CHECK (module_owner = '{{MODULE_ID}}'),
  state_revision bigint NOT NULL CHECK (state_revision >= 1),
  state_schema_version text NOT NULL,
  state_json jsonb NOT NULL,
  state_digest text NOT NULL CHECK (state_digest ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, aggregate_id)
);

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.audit_log (
  audit_sequence bigint GENERATED ALWAYS AS IDENTITY,
  audit_id text NOT NULL,
  module_owner text NOT NULL CHECK (module_owner = '{{MODULE_ID}}'),
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  scenario_formed_at timestamptz NOT NULL,
  scenario_status text NOT NULL,
  state_revision bigint,
  event_type text NOT NULL,
  operation text NOT NULL,
  outcome text NOT NULL,
  actor_ref text NOT NULL,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  record_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (audit_sequence),
  UNIQUE (audit_id)
);

DROP TRIGGER IF EXISTS audit_log_immutable ON {{MODULE_SCHEMA}}.audit_log;
CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON {{MODULE_SCHEMA}}.audit_log
FOR EACH ROW EXECUTE FUNCTION {{MODULE_SCHEMA}}.reject_append_only_mutation();

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.outbox_events (
  event_id text NOT NULL,
  module_owner text NOT NULL CHECK (module_owner = '{{MODULE_ID}}'),
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  scenario_formed_at timestamptz NOT NULL,
  scenario_status text NOT NULL,
  event_type text NOT NULL,
  contract_code text,
  schema_version text NOT NULL,
  payload_json jsonb NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL,
  published_at timestamptz,
  publish_attempts integer NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
  last_error text,
  PRIMARY KEY (event_id)
);

CREATE INDEX IF NOT EXISTS outbox_pending_idx
ON {{MODULE_SCHEMA}}.outbox_events (created_at, event_id)
WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.inbox_dedup (
  consumer_module text NOT NULL CHECK (consumer_module = '{{MODULE_ID}}'),
  event_id text NOT NULL,
  producer_module text NOT NULL,
  payload_digest text NOT NULL CHECK (payload_digest ~ '^[a-f0-9]{64}$'),
  event_type text NOT NULL,
  contract_code text,
  schema_version text NOT NULL,
  trace_id text NOT NULL,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  scenario_formed_at timestamptz NOT NULL,
  scenario_status text NOT NULL,
  status text NOT NULL CHECK (status IN ('received', 'processed', 'rejected')),
  received_at timestamptz NOT NULL,
  processed_at timestamptz,
  result_ref text,
  PRIMARY KEY (consumer_module, event_id)
);

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.owner_operations (
  idempotency_key text NOT NULL,
  module_owner text NOT NULL CHECK (module_owner = '{{MODULE_ID}}'),
  request_digest text NOT NULL CHECK (request_digest ~ '^[a-f0-9]{64}$'),
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  scenario_formed_at timestamptz NOT NULL,
  scenario_status text NOT NULL,
  aggregate_id text NOT NULL,
  operation_status text NOT NULL CHECK (operation_status IN ('processing', 'completed')),
  state_revision bigint,
  state_digest text CHECK (state_digest IS NULL OR state_digest ~ '^[a-f0-9]{64}$'),
  audit_id text,
  result_json jsonb,
  formed_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (idempotency_key)
);

CREATE OR REPLACE FUNCTION {{MODULE_SCHEMA}}.guard_owner_operation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $ofw$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'owner_operations is append-only after completion' USING ERRCODE = '55000';
  END IF;
  IF OLD.module_owner <> NEW.module_owner
     OR OLD.idempotency_key <> NEW.idempotency_key
     OR OLD.request_digest <> NEW.request_digest
     OR OLD.scenario_id <> NEW.scenario_id
     OR OLD.scenario_version <> NEW.scenario_version
     OR OLD.scenario_run_id <> NEW.scenario_run_id
     OR OLD.scenario_formed_at <> NEW.scenario_formed_at
     OR OLD.scenario_status <> NEW.scenario_status
     OR OLD.aggregate_id <> NEW.aggregate_id
     OR OLD.operation_status <> 'processing'
     OR NEW.operation_status <> 'completed'
     OR OLD.state_revision IS NOT NULL
     OR OLD.state_digest IS NOT NULL
     OR OLD.audit_id IS NOT NULL
     OR OLD.result_json IS NOT NULL
     OR OLD.completed_at IS NOT NULL
     OR NEW.state_revision IS NULL
     OR NEW.state_digest IS NULL
     OR NEW.audit_id IS NULL
     OR NEW.result_json IS NULL
     OR NEW.completed_at IS NULL THEN
    RAISE EXCEPTION 'owner operation identity/result is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$ofw$;

DROP TRIGGER IF EXISTS owner_operations_guard ON {{MODULE_SCHEMA}}.owner_operations;
CREATE TRIGGER owner_operations_guard
BEFORE UPDATE OR DELETE ON {{MODULE_SCHEMA}}.owner_operations
FOR EACH ROW EXECUTE FUNCTION {{MODULE_SCHEMA}}.guard_owner_operation_mutation();

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.checkpoint_catalog (
  checkpoint_id text NOT NULL,
  module_owner text NOT NULL CHECK (module_owner = '{{MODULE_ID}}'),
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  scenario_formed_at timestamptz NOT NULL,
  scenario_status text NOT NULL,
  source_scenario_run_id text NOT NULL,
  checkpoint_schema_version text NOT NULL,
  baseline_version text NOT NULL,
  baseline_snapshot_id text NOT NULL,
  storage_uri text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text NOT NULL CHECK (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  restore_readiness text NOT NULL CHECK (restore_readiness IN ('verified', 'not-verified')),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  immutable boolean NOT NULL DEFAULT true CHECK (immutable = true),
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (checkpoint_id)
);

DROP TRIGGER IF EXISTS checkpoint_catalog_immutable ON {{MODULE_SCHEMA}}.checkpoint_catalog;
CREATE TRIGGER checkpoint_catalog_immutable
BEFORE UPDATE OR DELETE ON {{MODULE_SCHEMA}}.checkpoint_catalog
FOR EACH ROW EXECUTE FUNCTION {{MODULE_SCHEMA}}.reject_append_only_mutation();

CREATE TABLE IF NOT EXISTS {{MODULE_SCHEMA}}.schema_migrations (
  migration_id text PRIMARY KEY,
  module_owner text NOT NULL CHECK (module_owner = '{{MODULE_ID}}'),
  applied_at timestamptz NOT NULL,
  migration_digest text NOT NULL CHECK (migration_digest ~ '^[a-f0-9]{64}$')
);

INSERT INTO {{MODULE_SCHEMA}}.schema_migrations (
  migration_id, module_owner, applied_at, migration_digest
) VALUES (
  '002_runtime_persistence', '{{MODULE_ID}}', CURRENT_TIMESTAMP, '{{MIGRATION_DIGEST}}'
)
ON CONFLICT (migration_id) DO UPDATE
SET migration_digest = EXCLUDED.migration_digest
WHERE {{MODULE_SCHEMA}}.schema_migrations.migration_digest = EXCLUDED.migration_digest;

DO $ofw$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM {{MODULE_SCHEMA}}.schema_migrations
     WHERE migration_id = '002_runtime_persistence'
       AND migration_digest = '{{MIGRATION_DIGEST}}'
  ) THEN
    RAISE EXCEPTION 'migration digest conflict for 002_runtime_persistence';
  END IF;
END;
$ofw$;

COMMIT;
