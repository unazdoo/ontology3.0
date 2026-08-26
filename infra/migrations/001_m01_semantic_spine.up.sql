BEGIN;

CREATE SCHEMA IF NOT EXISTS m01;

CREATE TABLE m01.scenario_runs (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  formed_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'restored', 'regression', 'historical-readonly', 'closed')),
  state_revision bigint NOT NULL DEFAULT 0 CHECK (state_revision >= 0),
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id)
);

CREATE TABLE m01.c003_deliveries (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  delivery_id text NOT NULL,
  input_digest char(64) NOT NULL,
  canonical_digest char(64),
  t006_id text,
  t007_version text,
  t008_as_of date,
  outcome text NOT NULL CHECK (outcome IN ('accepted', 'rejected', 'unknown')),
  payload jsonb,
  receipt jsonb NOT NULL,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, delivery_id),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TABLE m01.drafts (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  draft_id text NOT NULL,
  ontology_id text NOT NULL,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('draft', 'validated', 'blocked', 'published', 'abandoned')),
  based_on_published_id text,
  source_delivery_id text,
  current_content_revision bigint NOT NULL CHECK (current_content_revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, draft_id),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TABLE m01.draft_revisions (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  draft_id text NOT NULL,
  content_revision bigint NOT NULL CHECK (content_revision > 0),
  content_digest char(64) NOT NULL,
  content jsonb NOT NULL,
  validation jsonb,
  saved_at timestamptz NOT NULL,
  actor_ref jsonb NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, draft_id, content_revision),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id, draft_id)
    REFERENCES m01.drafts (scenario_id, scenario_version, scenario_run_id, draft_id)
);

CREATE TABLE m01.published_versions (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  published_id text NOT NULL,
  t017_id text NOT NULL,
  ontology_id text NOT NULL,
  semantic_version text NOT NULL,
  source_draft_id text NOT NULL,
  source_delivery_id text,
  source_mapping_version text,
  content_digest char(64) NOT NULL,
  snapshot jsonb NOT NULL,
  published_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, published_id),
  UNIQUE (scenario_id, scenario_version, scenario_run_id, t017_id),
  UNIQUE (scenario_id, scenario_version, scenario_run_id, ontology_id, semantic_version),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE OR REPLACE FUNCTION m01.reject_update_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER published_versions_immutable
BEFORE UPDATE OR DELETE ON m01.published_versions
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

CREATE TRIGGER c003_deliveries_immutable
BEFORE UPDATE OR DELETE ON m01.c003_deliveries
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

CREATE TABLE m01.t054_versions (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  t054_id text NOT NULL,
  binding_version text NOT NULL,
  t017_id text,
  t006_id text,
  mapping_version text,
  status text NOT NULL,
  allow_submit boolean NOT NULL,
  target_digest char(64) NOT NULL,
  snapshot jsonb NOT NULL,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, t054_id, binding_version),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TRIGGER t054_versions_immutable
BEFORE UPDATE OR DELETE ON m01.t054_versions
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

CREATE TABLE m01.refresh_exchanges (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  request_id text NOT NULL,
  request_digest char(64) NOT NULL,
  c028_request jsonb NOT NULL,
  c028_receipt jsonb NOT NULL,
  c029_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  t018_qualifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, request_id),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TRIGGER refresh_exchanges_immutable
BEFORE UPDATE OR DELETE ON m01.refresh_exchanges
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

CREATE TABLE m01.t019_heads (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  current_combination_id text,
  previous_trusted_combination_id text,
  transition text NOT NULL CHECK (transition IN ('empty', 'switch', 'rollback', 'failed')),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE OR REPLACE FUNCTION m01.enforce_t019_head_cas()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'T019 revision must advance by exactly one (expected %, got %)', OLD.revision + 1, NEW.revision USING ERRCODE = '40001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER t019_heads_cas
BEFORE UPDATE ON m01.t019_heads
FOR EACH ROW EXECUTE FUNCTION m01.enforce_t019_head_cas();

CREATE TABLE m01.t019_history (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  t019_id text,
  combination_id text,
  transition text NOT NULL CHECK (transition IN ('switch', 'rollback', 'failed')),
  record jsonb NOT NULL,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, revision),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TRIGGER t019_history_immutable
BEFORE UPDATE OR DELETE ON m01.t019_history
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

CREATE TABLE m01.c008_projections (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  projection_id text NOT NULL,
  projection_version bigint NOT NULL CHECK (projection_version > 0),
  t019_revision bigint NOT NULL CHECK (t019_revision >= 0),
  read_status text NOT NULL CHECK (read_status IN ('empty', 'ready', 'failed', 'previous-trusted')),
  digest char(64) NOT NULL,
  projection jsonb NOT NULL,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, projection_version),
  UNIQUE (scenario_id, scenario_version, scenario_run_id, projection_id, projection_version),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TRIGGER c008_projections_immutable
BEFORE UPDATE OR DELETE ON m01.c008_projections
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

CREATE TABLE m01.audit_log (
  scenario_id text NOT NULL,
  scenario_version text NOT NULL,
  scenario_run_id text NOT NULL,
  sequence bigint NOT NULL CHECK (sequence > 0),
  audit_id text NOT NULL,
  operation text NOT NULL,
  outcome text NOT NULL,
  record jsonb NOT NULL,
  formed_at timestamptz NOT NULL,
  PRIMARY KEY (scenario_id, scenario_version, scenario_run_id, sequence),
  UNIQUE (audit_id),
  FOREIGN KEY (scenario_id, scenario_version, scenario_run_id)
    REFERENCES m01.scenario_runs (scenario_id, scenario_version, scenario_run_id)
);

CREATE TRIGGER audit_log_immutable
BEFORE UPDATE OR DELETE ON m01.audit_log
FOR EACH ROW EXECUTE FUNCTION m01.reject_update_delete();

COMMIT;
