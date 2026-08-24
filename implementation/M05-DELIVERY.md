# M05 Implementation Delivery

Status: implementation skeleton complete; production connector evidence remains
open as required by `implementation/reconciliation-reports/M05-M06.md`.

## Scope

- `packages/agent-release`: immutable Agent Release and resource registry. A
  Release pins exact Agent, Prompt, Skill, Tool, Model, Published ontology,
  Scenario, validity window and read-only resource whitelist references.
- `packages/m05/report.js`: C024 receive/idempotency, fixed-context binding,
  report-reading sessions, Agent Runs and immutable C025 answer/verification
  explanation results. C017 and M06 ownership/identity are checked at the
  boundary.
- `packages/m05/orchestration.js`: constrained C014 DAG validation and an
  adapter-driven deterministic runner. Control nodes do not call a model.
- `packages/m05/gateway.js`: exact model/tool adapters, permission checks,
  read-only enforcement, prompt-injection rejection, timeout/retry policy and
  cumulative token/cost budgets.
- `packages/m05/evaluation.js`: injectable golden-case evaluation with
  grounding, contract, deterministic-state, security and latency evidence.
- `packages/m05/checkpoint.js`: C034 export/validation/clone-restore/isolated
  replay/migration comparison. Restores always get a new `scenarioRunId` and
  side effects remain disabled.

## Boundary Guarantees

The implementation has no filesystem, workbook, database or network reader. It
does not calculate Metric/Rule values, switch T019, publish reports, execute
Actions or create todos. Model/tool providers are injected callbacks and are
called only after the exact Release, context, permission and allowlist gates.
Audit entries are append-only and hash chained; prompt and report text are not
stored in the Release checkpoint state.

All contracts are draft implementation contracts. Real M06 C024, C017 and M06
verification exchanges, persistent storage and production provider evidence
remain integration gates rather than being represented by fixtures.

## Foundation Compatibility Baseline

The module consumes Foundation compatibility baseline `17ea7c7` fail closed:
nested C033 ScenarioContext objects reject unknown fields, public envelopes use
the exact Foundation `draft-0.1.0` schema and an explicitly expected event type,
and non-exact schema changes are rejected until separately reconciled. The M05
C034 adapter exposes a Foundation `c034.provider.v1` bridge with the canonical
checkpoint schema and side-effect guard; real Provider/Consumer exchange is a
later integration stage. The current adapter maps the immutable Agent Release
version/digest into Foundation baseline fields for structural recovery tests;
their production baseline semantics still require that joint validation.
