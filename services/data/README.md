# M02 Data Spine

`services/data` implements the data-engineering-owned spine for T001/T002/T003/T005/T006/T007/T008 and the metadata-only C001/C002/C003/C017 boundaries. It is dependency-light and keeps storage, queue and provider integrations behind adapters.

The runtime is append-only for raw snapshots, confirmations, formal runs, quality results, asset versions, delivery receipts, C017 summaries and refresh evidence. A formal run resolves every input slot at start and stores the exact T002/T007 identity, member range, T008 confirmation and reuse conditions. A retry must resolve the same semantic locks and C033 run or it is rejected.

`captureFile` and `discoverDirectory` read actual local bytes and derive the
SHA-256 fingerprint from those bytes. The default runtime store is in-memory so
tests and adapters remain dependency-free; `MIGRATION.md` describes the
append-only persistence boundary for a production store.

`C003Client`, `C032Client`, `C028Client` and `C029Client` are provider/consumer adapters. They validate echoed identifiers and C033 context, preserve unknown outcomes, and make duplicate calls side-effect free. `projectC017` exposes metadata and stable evidence references only; it rejects business rows, source content, implementation details, Metric/Rule fields and failure samples.

`envelope.js` binds M02 events to the Foundation Contract Envelope and accepts
only the registered `draft-0.1.0` schema version. Envelope, payload, provider
response and five-field C033 shapes fail closed on unknown or missing fields.
`checkpoint.js` supplies the M02 C034 owner adapter as a reference-only export;
Foundation still owns protected clone/replay plans and side-effect suppression.
Because this in-memory implementation has no persistence/hydration resolver,
restore readiness defaults to `not-verified` and no recovery call materializes
or executes module state.

The S003 compatibility version is represented with `compatibilityOnly: true`, `consumable: false`, and `reusable: false`. No method promotes it in place or submits it to C028/C029. A future formal S003 build must create a new T003/T007 chain.

A rejected or uncertain C003 attempt can only be queried by its original
delivery identifier. A new re-acceptance attempt is deliberately rejected until
the separately governed re-submission contract is defined; the runtime does
not silently implement that extension.

No code in this package computes Metric, Rule, risk scores or business conclusions. Quality checks are caller-supplied structural/contract checks; a hard failure blocks T007 publication.

## Verification

Run the complete suite with:

```sh
npm test
```

The M02 tests cover positive unit flow, provider contracts, context/identity negatives, cycle and hard-quality gates, immutable records, duplicate requests, retry drift, C003 receipt idempotency, C017 redaction and S003 non-consumption.
