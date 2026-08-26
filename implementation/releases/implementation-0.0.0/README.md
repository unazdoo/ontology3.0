# implementation-0.0.0

`implementation-0.0.0` is the controlled rollback target for the first
implementation release. It is a Foundation-only maintenance release, not a
second business implementation.

When active, health and read-only audit access remain available. New business
writes and consumer dispatch are blocked. The switch changes only the
deployment-control row in the isolated PR base schema and appends an immutable
receipt. It never runs a down migration, deletes module schemas, or rewrites
historical business state.

The rollback probe fingerprints all six module schemas before the switch,
while maintenance mode is active, and after `implementation-0.1.0` is restored.
It passes only when counts and digests remain identical, both write gates reject,
health/read-only audit remain available, and an implementation read succeeds
after restoration.

```bash
OFW_REAL_ENVIRONMENT=1 \
PR_DATABASE_URL="$PR_DATABASE_URL" \
PR_DB_SCHEMA="$PR_DB_SCHEMA" \
PR_NUMBER="$PR_NUMBER" HEAD_SHA="$HEAD_SHA" \
PR_ENVIRONMENT_ID="$PR_ENVIRONMENT_ID" \
IMPLEMENTATION_ROUND_ID="$IMPLEMENTATION_ROUND_ID" \
node implementation/releases/implementation-0.0.0/rollback-probe.mjs \
  --receipt artifacts/receipts/rollback-probe.json
```

The resulting receipt is evidence for a maintenance-mode rollback exercise. It
does not indicate module review, production deployment, or scenario acceptance.
