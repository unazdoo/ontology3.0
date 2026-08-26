# PR evidence

The canonical `pr-quality.json` manifest is created per pull request from the
receipts produced by one CI run; it is never seeded with a passing fixture. Use
`generate-pr-evidence.mjs` with the contract from
[`../../quality-gates/pr-evidence.schema.json`](../../quality-gates/pr-evidence.schema.json)
and attach only real, durable receipts from the isolated PR environment.

The quality workflow fails closed when this file is absent. Never commit
credentials, prototype snapshots, screenshots, or placeholder run IDs here.
A descriptor from `provision-pr-environment.mjs` is not evidence by itself. The
provider receipt must prove live PostgreSQL, MinIO and NATS health, the exact
isolated database schema/object prefix/queue namespace, and a short-lived
least-privilege credential reference. `descriptor-only`, fixture sources, and
any receipt declaring `productionEvidence=false` are rejected.

## CI receipt bundle

Keep source receipts under a single workspace root, normally:

```text
artifacts/receipts/
  metadata.json
  index.json
  provisioning.json
  database-migration.json
  object-storage-fingerprint.json
  rollback.json
  s001-runtime.json
  audit.json
  negative-tests.json
  c034-recovery.json
  check-*.json
```

`index.json` maps the roles `provisioning`, `databaseMigration`,
`objectStorageFingerprint`, `rollback`, `runtime`, `audit`, `negativeTests`, and
`recovery` to repository-relative JSON paths. Its `checks` object maps all 14
named checks from `quality-gates/policy.json` to their receipt paths.

Every source receipt carries a non-placeholder `receiptId`, exact
`pullRequest.number`, exact `pullRequest.headSha`, `environmentId`, and
`implementationRoundId`. The five live evidence roles (provisioning, object
storage, runtime, audit and recovery) additionally declare
`productionEvidence=true`. Receipt paths cannot be absolute, traverse with
`..`, or use Windows separators.

```bash
node scripts/quality-gate/generate-pr-evidence.mjs \
  --metadata artifacts/receipts/metadata.json \
  --index artifacts/receipts/index.json \
  --receipt-root "$GITHUB_WORKSPACE" \
  --pr-number "$PR_NUMBER" \
  --head-sha "$HEAD_SHA" \
  --round-id "$IMPLEMENTATION_ROUND_ID" \
  --output implementation/evidence/pr-quality.json

node scripts/quality-gate/verify-pr-evidence.mjs \
  --manifest implementation/evidence/pr-quality.json \
  --receipt-root "$GITHUB_WORKSPACE" \
  --pr-number "$PR_NUMBER" \
  --head-sha "$HEAD_SHA"
```

Generation calculates SHA-256 over the exact bytes of every receipt. Verification
reopens each file, checks its digest, parses its identity and proves that all
receipts belong to the same PR, head SHA, environment and implementation round.
Moving only `pr-quality.json` without its source receipt bundle therefore fails
closed.
