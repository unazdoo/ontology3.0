# M02 Migration and Rollback

This implementation has no destructive data migration. Persistent adapters may
add tables/collections for the append-only records represented by the runtime:
T001, T002, T003, T005, T006/T007, T008, read events, C003 receipts, C017
summaries/reads, C028 requests and C029 results.

Migration rules:

1. Add new versioned records beside any existing reader. Do not rewrite a
   historical T002, T005, T007, delivery receipt, summary or refresh result.
2. Store SHA-256 content fingerprints and the full C033 context with every
   formal run and cross-module record.
3. Keep the prior reader and provider contract available during rollout.
4. On rollback, stop new writes, keep immutable records, and restore the
   previous code/schema registration. Never promote a rejected/unknown receipt
   or a S003 compatibility T007 during rollback.

Adapters should implement up/down migrations transactionally. A down migration
may remove only newly created empty structures; it must refuse to delete
historical records or overwrite source/asset versions.
