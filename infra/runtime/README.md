# Shared runtime persistence boundary

This directory provides the implementation adapter shared by M01-M06. Each
module receives a separate PostgreSQL schema named
`<prSchema>_<moduleId-lowercase>`. The adapter never performs a cross-module SQL
write and every mutating call requires the exact module Owner.

`PostgresRuntimePersistence` provides:

- optimistic CAS over one owner aggregate per C033 scenario run;
- an Owner operation ledger that returns exact retries without a second write
  and rejects the same idempotency key when its request digest changes;
- business state, append-only audit and outbound envelopes in one transaction;
- an outbox suitable for NATS JetStream `Nats-Msg-Id = eventId` publication;
- an inbox unique key for at-least-once delivery deduplication;
- an immutable checkpoint catalog whose payload and manifest remain in object
  storage.

The public construction API is
`createPostgresModuleStore({ client, prSchema, moduleId, clock })`. Runtime
owners use `hydrate()` and `save()` for state, `listAudit()` for durable evidence,
the `listPendingOutbox()` / `markOutbox*()` methods for publication, the
`receiveInbox()` / `completeInbox()` pair for idempotent consumption, and
`registerCheckpoint()` / `getCheckpoint()` for immutable C034 object references.

Business consumers should use `consumeAndSave()` instead of calling the Inbox
methods and `save()` separately. It receives or deduplicates the incoming event,
applies Owner CAS state, audit and next Outbox records, and marks the Inbox
processed in one database transaction. Its result exposes `ackAllowed: true`
only after commit. A thrown error means the caller must not acknowledge the
message. The separate Inbox methods remain low-level inspection/reconciliation
primitives and do not provide an atomic business-consumption boundary.

The adapter accepts a `pg`-compatible client or pool through dependency
injection; this package intentionally does not choose or install a database
driver. Module code should hydrate its owner state at process start, perform a
domain operation, then call `save()` with the expected revision, audit metadata
and outbound envelopes. A revision conflict fails closed.

The migration runner accepts only `pr_<number>_<sha>` namespaces. Down migration
requires an explicit environment guard and drops only those disposable,
module-specific PR schemas. It is not a business rollback mechanism and must
never be pointed at shared or production storage.
