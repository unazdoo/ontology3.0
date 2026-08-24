# Implementation quality gates

`verify-pr-evidence.mjs` is the fail-closed boundary for implementation PRs.
It validates a machine-readable evidence manifest; it does not manufacture
runtime evidence or turn prototype tests into production proof.

## Manifest shape

Use `quality-gates/pr-evidence.schema.json` as the wire contract. A manifest
must carry the immutable `baselineSnapshotId`, the changed Schema version and
compatibility receipt, an accountable Owner, database up/down migration
evidence, an SHA-256 object-storage fingerprint, a tested rollback target, at
least one real run ID, an append-only audit receipt, negative-test evidence, a
C034 recovery receipt, and four isolated PR resources.

The `checks` object has one entry for every required gate:

`goldenData`, `contractCompatibility`, `e2e`, `permissionNegative`,
`concurrencyIdempotency`, `performance`, `accessibility`, `security`, `sbom`,
`observability`, `c034Recovery`, `migration`, `rollback`, and `ciCd`.

Each entry must be `passed` or `verified` and point at durable evidence. A
missing, placeholder, shared, historical, or fixture-only value fails the PR.
The negative-test receipt must cover all cases in
[`required-negative-cases.json`](./required-negative-cases.json), including
missing/unknown context, unauthorized Owner, cross-scenario access, duplicate
idempotency, and recovery side-effect suppression.

## Commands

```bash
node scripts/quality-gate/verify-pr-evidence.mjs \
  --manifest path/to/pr-evidence.json \
  --pr-number 123 \
  --head-sha "$GITHUB_SHA" \
  --report quality-gate-report.json
```

The command exits non-zero for an invalid manifest. `candidateEligible` is
computed, never trusted from a submitted flag. It is true only when every
required check passes and S001's fixed vertical order, the security gate, and
the C034 recovery gate have passing evidence from the same implementation
round. Use `--github-output` in Actions to expose that decision.

PR resources are deterministic and short-lived. For a PR number and commit
SHA, the required values are derived by `buildPrEnvironment` in the validator:

```text
database schema      pr_<number>_<sha12>
object-store prefix  pr/<number>/<sha12>/
queue namespace      pr-<number>-<sha12>
credential reference pr/<number>/<sha12>
```

The credentials are references only. Secret values must never enter a manifest,
log, PR comment, or artifact.

The repository's frozen prototype baseline remains read-only. A green static
or prototype regression suite cannot close the real-run, security, migration,
or C034 gates.
