BEGIN;

DO $ofw$
BEGIN
  IF '{{PR_SCHEMA}}' !~ '^pr_[1-9][0-9]*_[a-f0-9]{7,40}$' THEN
    RAISE EXCEPTION 'runtime persistence down migration is restricted to isolated PR schemas';
  END IF;
END;
$ofw$;

DROP SCHEMA IF EXISTS {{MODULE_SCHEMA}} CASCADE;

COMMIT;
