# Contracts Package

Only versioned API/event schemas belong here. Domain implementations and writable read models belong to their owning module.

Every envelope carries `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `actor`, `correlationId`, `traceId`, `idempotencyKey`, `scenarioContext`, `resourceRefs`, `evidenceRefs` and `payload`.
