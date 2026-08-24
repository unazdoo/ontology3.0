# Checkpoint Package

This package is the minimal C034 Provider SPI. It is storage-agnostic and has
no module, database, queue, or workflow implementation. The public version is
`ofw.c034.checkpoint.v1` and the SPI version is `c034.provider.v1`.
Both identifiers are implementation compatibility names under draft contract
version `draft-0.1.0`; they are not a final platform contract.

Checkpoint C033 validation requires all five context fields and rejects unknown
context fields by default. An adapter may pass
`contextOptions: { allowUnknown: true }` only when it owns an explicitly
reconciled extension.

```js
const {
  createProvider,
  cloneRestore,
  isolatedReplay,
  migrationCompare,
  SIDE_EFFECT_POLICY
} = require("./index.js");

const provider = createProvider({
  export(request) { /* module-owned export */ },
  validate(checkpoint) { /* module-owned validation */ },
  cloneRestore(request) { /* optional isolated materialization */ },
  isolatedReplay(request) { /* optional isolated replay */ },
  migrationCompare(request) { /* optional comparison */ }
});
```

The five methods are deliberately references/hooks. Missing implementation
methods return a `NOT_IMPLEMENTED` error for `export` and use the pure safety
receipts for recovery/comparison. `assertProvider()` can be used to require
all five methods before registration.

| Method | Purpose | Owner |
| --- | --- | --- |
| `export` | Return an immutable, versioned checkpoint reference | Owning module |
| `validate` | Check structure and owner integrity evidence | Owning module + Foundation boundary |
| `cloneRestore` | Prepare an isolated restore with a new run | Owning module, guarded by Foundation |
| `isolatedReplay` | Prepare a side-effect-suppressed replay context | Owning module, guarded by Foundation |
| `migrationCompare` | Compare source/target versions without writing either | Owning module + Foundation boundary |

Recovery rules are enforced by the wrapper:

- `cloneRestore` and `isolatedReplay` always derive a new `scenarioRunId`;
- source checkpoints are cloned and sanitized, never mutated or overwritten;
- historical Action Requests, notifications, approvals, and todos are not
  passed as replayable collections;
- `SIDE_EFFECT_POLICY` keeps all historical replay and external dispatch flags
  false; the operation guard throws `HISTORICAL_SIDE_EFFECT_REPLAY` on use;
- an adapter result that reports replay or history overwrite is rejected.

`migrationCompare(source, target)` fails closed for missing metadata, cross-
scenario targets, in-place versions, unchanged baselines, reused run IDs, and
version regressions. It returns a comparison receipt and requires a new
checkpoint; it does not perform migration or write state.

Run the package tests with:

```bash
node --test packages/checkpoint/index.test.cjs
```
