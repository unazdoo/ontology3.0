# M01 Semantic Spine Runbook

## Health signals

- Count rejected/unknown C003 and C028 receipts by stable reason code.
- Alert on `C032_DRIFT`, `T019_REVISION_CONFLICT`, `PROJECTION_DUAL_SOURCE`,
  `PROJECTION_CORRUPT`, or a failed C008 projection.
- Track T019 revision, C008 projection version, previous-trusted availability,
  and checkpoint validation failures per C033 run.

## T019 incident response

1. Stop new formal consumption when C008 is `failed`.
2. Preserve the current T019 and Published history; never edit it in place.
3. Confirm the exact failed combination and evidence.
4. If M01 still has a compatible previous-trusted combination, use the
   guarded rollback operation. Otherwise remain failed until a new candidate
   completes C029/T018 and independent validation.
5. Consumers reread C008; they must not install a private pointer.

## C034 recovery

1. Export and validate the checkpoint digest before restore.
2. Clone into a newly generated `scenarioRunId`.
3. Verify the clone starts with C008 `empty` and no authoritative T019.
4. Historical Published/T019/audit evidence remains read-only.
5. Revalidate and explicitly adopt a new T019 in the restored run. Historical
   Action Requests, notifications, approvals, and todos are never replayed.

## Database rollback

The down migration removes only the M01 implementation schema. Before running
it, export and validate C034 checkpoints. Never run it as a mechanism for
rolling back a Published version or T019; those are append-only business
records and use semantic revision/previous-trusted operations instead.
