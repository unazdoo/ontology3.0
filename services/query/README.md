# M03 Query Runtime

`services/query` owns the implementation-side C009/C010/C018 query facts and
Rule run facts. It is provider-agnostic and dependency-free beyond the shared
Foundation identity/contracts packages.

## Boundaries

- `adapters.js` reads the M01 C008/T019 authoritative projection and the M02
  C017 restricted quality projection. Reads are repeated per operation; no
  local T019/C017 truth or business-detail cache is maintained.
- `config.js` creates immutable C009 configuration snapshots and checks actual
  Skill/Tool loading proof.
- `planner.js` fixes the C033 run, configuration, Prompt/Skill/Tool versions,
  Published semantic version, exact data/T008 and deterministic query plan.
  It owns retry/idempotency and candidate validation, but never switches T019.
- `rule-runtime.js` evaluates only caller-supplied Published, parameterized
  Rule definitions. It contains no S001 thresholds and treats unresolved
  values as `UNKNOWN`.
- `evidence.js` builds immutable C010 result facts, C018 query views, a CSV
  projection of the fixed result, and standard C011 requests. It does not
  confirm Actions, create reminders/todos, or query C011 outcome state.
  `QueryViewRegistry` and `C011SubmissionLedger` are caller-owned in-memory
  adapters for contract tests; they are not production persistence.

All blocking paths are fail-closed for unknown state, version mismatch, hard
quality failure, missing evidence, and denied permission. Candidate expiry and
the richer C011 result-query extension remain conditional until QA-X-010 and
QA-X-007 are resolved; no recommendation threshold is promoted to a business
Rule.

The public entry point is `require('./services/query')`. `createM03Runtime`
composes the read-only adapters and planner while leaving persistence and
owner APIs to the caller.
