# Foundation Runbook

This runbook covers the `implementation-0.1.0` public contract slice. It does
not deploy a platform and does not authorize changes to module business truth.

## Inputs

```text
sourceTag=prototype-v1.1.0-frozen
parentVersion=v1.1.0
baselineSnapshotId=BSL-OFW-V110-94ABD0E991B7
implementationVersion=implementation-0.1.0
branch=codex/implementation-foundation
schemaVersion=draft-0.1.0
```

## Preflight

Run from the Foundation worktree:

```bash
git status --short --branch
npm test
node --test infra/runbook.test.cjs
npm run check
git diff --check
```

Expected result: the Foundation tests pass, syntax checks pass, and the diff
has no whitespace errors. A dirty worktree or a failing negative test is a
stop condition.

Confirm that the change list contains only `packages/contracts`,
`packages/identity`, `packages/checkpoint`, `infra`, and `implementation/adr`
(plus their tests). Do not use a prototype fixture as a production evidence
source.

## Schema registration

1. Register `packages/contracts/schemas/registry.json` as draft metadata beside
   the currently deployed reader.
2. Load the exact `schemaVersion` named by an envelope. Do not infer a version
   from payload fields or silently substitute the latest draft.
3. Run the compatibility classifier before accepting a different version.
   Exact matches may proceed; `review` requires owner acknowledgement; breaking,
   malformed, downgraded or draft/final-mixed versions are rejected.
4. Keep the previous reader and registry entry during the rollout window.
5. Record the registry version, compatibility result, trace/correlation IDs and
   C033 context in the caller-owned evidence/audit stream.

No step in this runbook writes a database, queue, object store or IAM policy.

## Request boundary

Before a module handler creates business state:

- validate the full Contract Envelope and all five C033 context fields;
- propagate the incoming `traceId` and `correlationId`;
- validate or generate the idempotency key;
- call duplicate detection using a caller-owned read-only index;
- short-circuit `duplicate` and `conflict` results without creating an Action
  Request, task, notification, approval, report or other business record.

The Foundation layer does not decide authorization. `actorRef` remains opaque.

## C034 recovery

1. Validate the source checkpoint and its restore readiness.
2. Use `cloneRestore` or `isolatedReplay` through the Provider wrapper.
3. Confirm a new `scenarioRunId`, an isolated namespace, and
   `overwritesSource=false` / `overwritesHistory=false`.
4. Confirm the side-effect policy is all false and the restore input contains
   no historical Action Requests, notifications, approvals or todos.
5. If an adapter reports replay, dispatch, or history overwrite, reject the
   operation and retain the source checkpoint unchanged.

Historical viewing is read-only. Recovery never replays external calls or
implicitly publishes, approves, notifies, or creates a task.

## Migration

Run `migrationCompare` before any migration. Reject in-place scenario versions,
cross-scenario targets, unchanged baselines, reused run IDs, malformed metadata
and version regressions. A permitted comparison only produces a receipt; the
owning module must create a new checkpoint and new run explicitly.

## Rollback

Rollback is a code and schema-registration rollback:

1. Stop accepting the new draft version.
2. Restore the previous reader/registry entry and keep historical records
   untouched.
3. Re-run the preflight commands and verify duplicate/recovery negative tests.
4. Reconcile any partially formed new run by its new `scenarioRunId`; never
   overwrite or rename the source run.
5. Record the rollback outcome with the minimum audit fields and return any
   contract change to the ADR/CR process.

There is no database down-migration in this slice. If a future adapter adds
one, it must supply an owner-approved up/down migration and a separate review.

## Evidence and escalation

Retain command output, schema registry version, compatibility classification,
source/target run IDs, trace/correlation IDs and the negative-test result. Stop
and escalate when ownership, retention, authorization, semantic enums or
external side effects are unclear. Do not resolve those questions by adding a
field locally.
