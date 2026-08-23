# Contracts Package

This package contains the smallest public contracts needed by the v1.1.x
Foundation lane. It owns schemas and pure validation/normalization only. Domain
state, authorization, audit storage, queues and writable read models remain
with their owning modules.

## Status and version

The schemas use JSON Schema draft-07 and are explicitly marked
`x-contract-status: "draft"`. The package schema version is `draft-0.1.0`.
This is an implementation baseline and must not be treated as the final
platform contract without M01-M06 reconciliation and a separately registered
contract change.

The package has no runtime dependencies and uses CommonJS:

```js
const {
  validateContractEnvelope,
  assertScenarioContext,
  schemas,
  SCHEMA_VERSION
} = require('./packages/contracts');
```

The JSON files can also be loaded directly by a language-independent JSON
Schema validator. `schemas/registry.json` is the machine-readable index;
`$id` values are stable within this draft version.

## Public shapes

Every envelope carries the following required fields:

`eventId`, `eventType`, `schemaVersion`, `occurredAt`, `actorRef`,
`correlationId`, `traceId`, `idempotencyKey`, `scenarioContext`, `resourceRefs`,
`evidenceRefs`, and `payload`.

`scenarioContext` (C033) requires `scenarioId`, `scenarioVersion`,
`scenarioRunId`, `formedAt`, and `status`. The pure validator rejects missing
values and rejects a version or run identifier that does not use the
`scenarioId` prefix. Prefix checking can be disabled only for migration tooling
with `{ enforcePrefix: false }`; normal module calls should keep the default.

`ResourceRef` and `EvidenceRef` are stable references, not embedded domain
objects. The canonical fields are `refType`/`refId` and
`evidenceType`/`evidenceId` respectively. The normalizers accept common legacy
aliases (`resourceId`, `evidenceId`, `id`, `version`) and add canonical fields
without mutating the input.

`AuditFields` is only the shared metadata structure:
`actorRef`, `traceId`, `correlationId`, `scenarioContext`, `sourceVersion`,
`targetVersion`, `formedAt`, `operation`, and `outcome`. It does not create an
audit platform or define retention/authorization policy.

## Field ownership

| Field | Purpose | Contract owner / source owner |
| --- | --- | --- |
| `eventId`, `eventType`, `occurredAt`, `payload` | Identify and carry one API/event message | Producing module; payload meaning stays with its domain owner |
| `schemaVersion` | Select a registered schema revision | Foundation schema registry |
| `actorRef` | Reference the caller/actor without implementing identity | Caller/authentication boundary |
| `correlationId`, `traceId` | Join one request and its distributed trace | Foundation tracing boundary |
| `idempotencyKey` | Carry a caller-supplied duplicate-detection key | Producing caller and Foundation boundary |
| `scenarioContext` | Bind work to one C033 scenario/version/run | Foundation; scenario owner supplies scenario values |
| `resourceRefs` | Point to module-owned resources | Referenced resource owner |
| `evidenceRefs` | Point to immutable/append-only evidence | Evidence-producing owner |
| `sourceVersion`, `targetVersion` | Record version transition context in audit metadata | Producing and consuming module owners |
| `formedAt`, `operation`, `outcome` | Describe when and what an audited operation produced | Producing operation owner |

The older prototype wording `actor` is not added as a second Envelope field;
the implementation contract uses `actorRef`.

## API

Validation functions return `{ valid, errors }` and never mutate input:

- `validateContractEnvelope` / `assertContractEnvelope` /
  `createContractEnvelope`
- `validateScenarioContext` / `assertScenarioContext` /
  `normalizeScenarioContext`
- `validateResourceRef` / `assertResourceRef` /
  `normalizeResourceRef`
- `validateEvidenceRef` / `assertEvidenceRef` /
  `normalizeEvidenceRef`
- `validateAuditFields` / `assertAuditFields` /
  `normalizeAuditFields`

`assert*` functions throw `ContractValidationError` with a stable `code` and
an `errors` array. `validate*` accepts `{ path, enforcePrefix, allowUnknown }`
options; unknown fields are permitted by default for forward-compatible draft
extensions, while callers can fail closed with `{ allowUnknown: false }`.

The envelope schema intentionally does not define idempotency storage or
duplicate behavior. Those pure functions live in `packages/identity`.
