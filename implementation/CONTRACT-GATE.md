# Implementation Contract Gate

Every implementation PR must include the following before merge:

1. `baselineSnapshotId`, source tag and implementation version.
2. Contract Owner, consumer/provider list and changed schema version.
3. API or event schema plus compatibility statement.
4. State machine, error codes and fail-closed behavior.
5. Idempotency, retry, concurrency and duplicate-event tests.
6. Database migration up/down and object-store fingerprint policy.
7. Audit fields: actor, trace/correlation ID, C033 context, source/target versions and formed time.
8. Unit, contract, negative, security and integration tests.
9. C034 export/validate/clone-restore adapter or an explicit documented blocker.
10. Metrics, logs, alerts, Runbook, rollback and data migration notes.

## Common Envelope

Commands and events use a versioned envelope containing:

```text
eventId, eventType, schemaVersion, occurredAt, actor,
correlationId, traceId, idempotencyKey,
scenarioContext { scenarioId, scenarioVersion, scenarioRunId, formedAt, status },
resourceRefs[], evidenceRefs[], payload
```

Events notify; authoritative reads and writes remain at the owning module API. A duplicate envelope must not create a second Action Request, confirmation, task, report, Agent run or notification.

## Non-negotiable Boundaries

- M01 alone owns T019 and Published semantic lifecycle.
- M02 exposes C017 metadata but never business detail to consumers.
- M03 and M04 reread C017 at every Action safety gate.
- M05 explains fixed evidence and deterministic results; it does not calculate, publish, switch T019 or execute Action.
- M06 keeps reports and comparisons immutable; regeneration creates a new version and run.
- C034 recovery clones a new `scenarioRunId` and never replays historical side effects.
