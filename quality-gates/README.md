# Implementation quality gates

`verify-pr-evidence.mjs` is the fail-closed boundary for implementation PRs.
It validates a machine-readable evidence manifest; it does not manufacture
runtime evidence or turn prototype tests into production proof.

## Manifest shape

Use `quality-gates/pr-evidence.schema.json` as the wire contract. A v2 manifest
must carry the immutable `baselineSnapshotId`, the changed Schema version and
compatibility receipt, an accountable Owner, database up/down migration
evidence, an SHA-256 object-storage fingerprint, a tested rollback target, at
least one real run ID, an append-only audit receipt, negative-test evidence, a
C034 recovery receipt, and four isolated PR resources.

The `receipts` index is mandatory. It binds every projected manifest section to
the exact source JSON by repository-relative path and SHA-256, and repeats the
PR number, exact head SHA, environment ID and implementation round. The verifier
reopens these files; an evidence URI string without a matching source receipt
cannot close a gate.

The `checks` object has one entry for every required gate:

`goldenData`, `contractCompatibility`, `e2e`, `permissionNegative`,
`concurrencyIdempotency`, `performance`, `accessibility`, `security`, `sbom`,
`observability`, `c034Recovery`, `migration`, `rollback`, and `ciCd`.

The implementation-candidate hard gates are `goldenData`,
`contractCompatibility`, `e2e`, baseline `security`, `c034Recovery`,
`migration`, `rollback`, and `ciCd`; each must be `passed` or `verified` and
point at durable evidence. `permissionNegative`, `concurrencyIdempotency`,
`performance`, `accessibility`, `sbom`, and `observability` are diagnostics.
They remain mandatory records but may be `blocked` or `not-applicable` with a
non-empty reason and durable evidence; their disposition does not by itself
block candidate eligibility.

Idempotency is not waived by moving its standalone check to diagnostics. The
hard contract/E2E receipts must still prove same-key replay, different-content
conflict, CAS rejection, outbox/inbox deduplication, and retry without duplicate
side effects, together with C033, Owner and exact-version boundaries. Baseline
security is deliberately limited to a clean secret scan and zero high/critical
dependency vulnerabilities.

A missing, placeholder, shared, historical, or fixture-only value still fails
the PR.
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
computed, never trusted from a submitted flag. It is true only when all hard
gates pass and S001's fixed vertical order, the security gate, and the C034
recovery gate have passing evidence from the same implementation round. Use
`--github-output` in Actions to expose that decision.

For a backend-only slice, accessibility uses a strict deferred receipt:
`status=not-applicable`, `scope=backend-only`, `uiChangesDetected=false`, and
`nextGate=first-ui-candidate`. `findingEvidence` must be a digest-bound reference
to the real production axe receipt that remains `blocked`. A frozen UI finding
is never rewritten as a pass.

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
