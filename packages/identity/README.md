# Identity Package

The Foundation identity package provides the minimum C033 context, idempotency,
and trace primitives. It is CommonJS, has no runtime dependencies beyond Node's
built-in `crypto`, and never creates business records, dispatches messages, or
assigns module ownership.

```js
const identity = require('./packages/identity');
const check = identity.validateScenarioContext(context);
const key = identity.generateIdempotencyKey(request);
const duplicate = identity.identifyDuplicateRequest(request, readOnlySeenIndex);
```

## C033 context

The required fields are `scenarioId`, `scenarioVersion`, `scenarioRunId`,
`formedAt`, and `status`. Validation rejects missing fields, malformed times,
and an explicitly recognizable version/run prefix belonging to another
scenario. IDs are not restricted to the frozen prototype's `Sxxx` format.
Unknown fields are rejected by default; migration tooling can opt into
`{ allowUnknown: true }` without changing the public draft schema.

`normalizeScenarioContext` returns a deep copy. `compareScenarioContext` and
`sameRunContext` compare the stable three-part run identity
(`scenarioId`, `scenarioVersion`, `scenarioRunId`) and do not compare lifecycle
status unless `{ includeLifecycle: true }` is supplied. `stableSerialize` sorts
object keys recursively; `contextFingerprint` returns a deterministic SHA-256
hex digest of all five context fields by default. Pass
`{ includeLifecycle: false }` for a run-identity-only fingerprint.

## Idempotency and trace

`generateIdempotencyKey` deterministically produces `idem-v1:<sha256>` from the
request's semantic fields. `validateIdempotencyKey` accepts generated keys and
bounded caller tokens; pass `{ strictGenerated: true }` to require the generated
form. `identifyDuplicateRequest` is read-only: it returns `status: "new"`,
`"duplicate"`, or `"conflict"`, plus `sideEffectAllowed`. A same-key request
with a different schema version is a `schema-version-conflict`; no map or
business record is changed. `rememberRequest` returns a new caller-owned index
when a test or adapter explicitly wants to stage a record.

`createTraceContext`, `extractTraceContext`, `propagateTraceContext`, and
`createTraceHeaders` carry `traceId` and `correlationId` without implementing a
tracing backend. Existing IDs are preserved; missing IDs are generated with
Node's secure UUID source.

Validation results contain `{ valid, errors }` and expose a non-enumerable
`ok` compatibility property. `assert*` functions throw
`IdentityValidationError` with a stable `code` and error list.
