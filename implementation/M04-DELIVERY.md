# M04 Implementation Delivery

This implementation window owns C011-C013, C019, and the three C017 safety
gates.  The runtime is in `services/decision/index.js`; the package alias in
`packages/decision` is a re-export and does not own state.

## Delivered

- Separate C011 receipt, C012 reminder/human decision, and C013 owner-task
  facts in one M04 state store.
- Fresh C017 reads at `request_receipt`, `confirmation_submit`, and
  `task_formation`.  The reader receives only the exact T007 and C033 run
  identity; M04 stores the minimum safety receipt, never a C017 projection.
- Stable idempotency for the same scenario, run, semantic/data versions and
  Action Request ID.  Contract/version/run conflicts append a rejection
  receipt and cannot overwrite the original.
- Explicit retry APIs for blocked receipt/confirmation/task gates.  Unknown,
  read-error and hard-quality outcomes retain attempts and recovery history;
  hard failure is not retried on the same fixed version.
- C019 read-only summary, four stable detail entries, and filtered return
  context.  Navigation has no write capabilities.
- C034 provider export, validation, clone restore and isolated replay through
  the Foundation checkpoint SPI.  Recovery creates a new run and suppresses
  historical dispatches.

## Deliberately deferred

Q003 due-date calculation and the CR008-CR010 extended lifecycle/aggregation
semantics are not implemented.  A caller may supply an explicit due date, but
M04 does not calculate or reinterpret it.

## Verification

`npm test` and `npm run check` include the M04 contract, negative, idempotency,
gate-retry, read-only C019, and C034 recovery tests.  No prototype release
directory was modified, and no historical Action Request, notification, or
task is replayed during recovery.
