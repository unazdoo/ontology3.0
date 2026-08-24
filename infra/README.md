# Infrastructure Boundary

Infrastructure owns migrations, object storage, queues, IAM and observability
wiring. Module-owned data remains in module-owned schemas; cross-module writes
use owner APIs or events, never direct SQL writes.

This Foundation slice intentionally ships no database, queue, IAM, storage or
observability adapter. The operational procedure is documented in
[`FOUNDATION-RUNBOOK.md`](./FOUNDATION-RUNBOOK.md) and is limited to validation,
registration, recovery safety and rollback decisions.

The runbook is read-only with respect to the repository's frozen prototype,
module documents, total-control ledger and research workspaces. Any operation
that would rewrite historical state, publish a draft schema as final, or replay
an external side effect must stop and return to the owning module/change record.
