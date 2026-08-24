# M04 Decision Service

This service is the implementation boundary for M04: C011 Action Request
receipt, C012 reminder and human decision, C013 owner task formation, C019
read-only summaries, and the three C017 safety gates.

```js
const { createDecisionService, GATES } = require('./index.js');

const service = createDecisionService({
  scenarioContext,
  // The reader is called for every gate with only this shape:
  // { contractCode, consumer, purpose, gate, t007, dataVersion,
  //   scenarioContext }
  c017Reader: (query) => c017Owner.read(query),
});

const received = service.receiveActionRequest(actionRequest);
const confirmed = service.confirmAction(received.request.requestId, {
  decision: 'confirm',
  reason: '人工核实完成',
  owner: 'owner-001',
});
const task = service.createTask(received.request.requestId);
const summary = service.readC019();
```

Set `strictContract: true` at the boundary when the caller requires the full
C011 evidence checklist (published status, subject name, metric snapshot,
evidence snapshot, and cutoff) before the request is accepted.

## State and safety rules

- `requests`, `reminders`, `confirmations`, and `todos` are separate facts in
  one M04 state store.  A task is never created before a positive human
  confirmation.
- When `taskWriter` is supplied, it is an adapter to that same C013 owner
  transaction (with the stable task idempotency key), not a second task truth
  store; M04 keeps only the returned authoritative task receipt/projection.
- C017 is never copied.  Only a minimum, gate-specific read receipt is kept:
  exact T007, summary identity/time, quality status, hard-failure metadata,
  read time, outcome, reason, recovery, and evidence locator.
- Receipt, confirmation, and task formation each read the current C017 state
  again.  Unknown, unlocatable, read-error, and version-conflict results fail
  closed.  A hard quality failure cannot be retried against the same fixed
  data version; a blocked read can be retried explicitly and retains history.
- The idempotency key contains scenario ID, scenario version, run ID, Action
  Request ID, semantic version, and exact data version.  A strict duplicate
  returns the existing references with zero side effects.  Reusing an Action
  Request ID with a different contract is a conflict and never overwrites the
  original record.
- C019 returns stable request/reminder/task/trace references and read-only
  detail entries.  Navigation context is filtered to source, subject,
  filters, and return position; it has no write capability.  An active-run
  detail link still opens the M04 page where the normal human decision action
  can be performed; only historical runs are read-only.
- C034 is exposed through `createCheckpointProvider()`.  Export contains an
  immutable M04 ledger and safety receipts, not a C017 projection.  Clone
  restore creates a new run through the Foundation SPI and suppresses all
  historical dispatches.

Q003 due-date calculation and CR008-CR010 extended lifecycle semantics are
intentionally outside this minimum state machine.  `dueDate` is an explicit
optional value supplied by the caller and is never calculated by M04.
