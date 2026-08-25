# Foundation v1.1.x Delivery

## Baseline and scope

```text
sourceTag = prototype-v1.1.0-frozen
sourceVersion = v1.1.0
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
implementationVersion = implementation-0.1.0
branch = codex/implementation-foundation
```

This delivery is a pure, dependency-free public contract layer. It does not
modify `designs/prototype-releases/v1.1.0`, M01-M06 primary documents, or the
S005/M07/M08 research workspaces, and it does not own module business truth.

## Change list

| Area | Files | Delivered behavior |
| --- | --- | --- |
| Contracts | `packages/contracts/schemas/*.json`, `index.js`, `validation.js` | JSON Schema draft-07 Envelope, C033 context, resource/evidence references and minimum audit fields; pure validators, normalizers and fail-closed `assert*` helpers |
| Identity | `packages/identity/index.js` | C033 validation/comparison, stable JSON serialization and SHA-256 fingerprints, deterministic idempotency keys, read-only duplicate detection, trace/correlation propagation |
| Checkpoint | `packages/checkpoint/index.js` | C034 `export`/`validate`/`cloneRestore`/`isolatedReplay`/`migrationCompare` SPI wrappers, immutable receipts, new-run recovery and side-effect guard |
| Tests | package tests and `packages/foundation-contract.test.cjs` | Positive/negative context, missing fields, mismatch, duplicate key, schema-version conflict, trace propagation, new-run restore, side-effect suppression and illegal migration cases |
| ADR | `implementation/adr/` | Scope decision and index; full identity/permission/governance intentionally deferred |

## Schema and ownership

The public JSON Schemas are `draft-0.1.0` and carry
`x-contract-status: "draft"`; C034/identity runtime constants retain their
named `*.v1` compatibility identifiers but are also marked draft in their
package metadata. Promotion requires M01-M06 reconciliation.

Every field has an owner documented in the schema `x-field-owners` metadata and
the contracts README. The minimum Envelope fields are:

```text
eventId, eventType, schemaVersion, occurredAt, actorRef,
correlationId, traceId, idempotencyKey, scenarioContext,
resourceRefs, evidenceRefs, payload
```

`scenarioContext` is exactly the minimum C033 structure:
`scenarioId`, `scenarioVersion`, `scenarioRunId`, `formedAt`, `status`.

## M01/M02 next-step dependency

M02 may first consume `validateContractEnvelope`, `assertScenarioContext`,
`generateIdempotencyKey`, `identifyDuplicateRequest` and
`propagateTraceContext` for a read/receipt boundary. M01 may consume the same
Envelope/context validators and `createAuditFields` for a reference-only
handoff. Both must use one identical C033 context, keep `actorRef` opaque, and
short-circuit duplicates before creating business state. They must not add
Envelope fields locally.

Before a real M02 -> M01 exchange, reconcile at least the exact resource
reference identity/version, evidence reference form, source/target version
semantics, actor reference shape, outcome vocabulary, retention and owner
acknowledgement fields. These remain open until the M01-M06 owners confirm
them; this Foundation lane does not invent a CR.

## Migration and rollback

This release adds no database, queue or object-store migration. Consumers should
register the draft schema beside existing contracts, validate at the boundary,
and keep the previous reader available during rollout. Rollback is a code/schema
registration rollback to the prior implementation; no historical records are
rewritten. C034 migration comparison is read-only, rejects in-place or
cross-scenario changes, and requires a new checkpoint/run. Recovery always
creates a new `scenarioRunId` and cannot overwrite the source or replay
historical Action Requests, notifications, approvals or todos.
