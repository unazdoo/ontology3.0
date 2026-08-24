# M05 Agent Release Boundary

`packages/agent-release` is the policy and identity boundary for M05. It is
storage/model-provider agnostic and never reads workbooks, T002/T007 business
detail, calculates Metric/Rule values, publishes reports, executes Actions, or
creates todos.

The package provides:

- immutable Agent Release snapshots with exact Agent, Prompt, Skill, Tool,
  Model, Published ontology, Scenario, validity-window and resource-allowlist
  references;
- an append-only `ResourceRegistry` that rejects `latest`/unversioned lookup,
  duplicate identity with a different digest, Draft ontology references and
  side-effect resources;
- C024 fixed report-context normalization/validation and release/context
  mismatch rejection. Only safe structured references for C017 and optional
  M06 deterministic verification results are accepted;
- exact tool and resource allowlist checks, role/scenario permission checks and
  a read-only tool operation set;
- prompt-injection detection for untrusted user/evidence text. Detected input
  is rejected before a model adapter can be called;
- hash-chained audit entries that retain references and reasons but never raw
  prompts, report text or business rows;
- C034 checkpoint export/validation/clone restore with a fresh
  `scenarioRunId`, side effects disabled, and no automatic model/tool call.

All functions are CommonJS and dependency-free apart from Node's built-in
`crypto` module. See `index.test.cjs` for contract and negative-path examples.
