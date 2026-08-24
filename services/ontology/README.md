# M01 Ontology Spine

`services/ontology` is the M01 owner boundary for C003 intake, C004-C008
read models, T017 Published semantic versions, T018 candidate qualification,
T019 authoritative adoption, and T054/C032 refresh-target discovery.

The service is storage-agnostic. `OntologyService` uses the in-memory
repository by default and accepts a repository implementing the same
`registerScenario/read/transaction/importState` methods. Every mutation is
transactional, carries the complete C033 context, and returns an immutable
copy.

Important boundaries:

- C003 acceptance is not C028/C029 success, T018 eligibility, or T019 adoption.
- Consumers can use `consumerReader()` for C004-C008/T019 reads only. They have
  no write path for Draft, T054, or T019.
- C008 has one M01 source and returns `empty`, `ready`, `failed`, or
  `previous-trusted`; it never falls back to a static pointer.
- C034 export/validate/clone-restore/isolated-replay/migration-compare are
  exposed by `createM01CheckpointProvider`. Clone restore always targets a new
  `restored` scenario run and starts without an authoritative T019. Isolated
  replay is a separate read-only plan targeting a new `regression` run; it
  never materializes state and always carries the Foundation side-effect guard.

The module intentionally does not encode Q001-Q004 or create new CRs.
