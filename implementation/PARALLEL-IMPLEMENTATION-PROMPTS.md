# Parallel Implementation Dispatch Prompts

All prompts assume:

```text
sourceTag = prototype-v1.1.0-frozen
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
implementationVersion = implementation-0.1.0
```

Do not edit `designs/prototype-releases/v1.1.0/`, module design documents, or the S005/M07/M08 research worktrees. Do not use static prototype success states as production evidence.

## 00 Foundation

Create branch `codex/implementation-foundation` from the frozen tag. Own `packages/contracts`, `packages/identity`, `packages/checkpoint`, shared audit primitives and the platform ADR index.

Implement versioned API/event schemas, C033 scenario context middleware, stable resource references, idempotency keys, trace propagation, C034 provider SPI, feature flags, RBAC hooks and append-only audit interfaces. Add missing/unknown/mismatch/replay negative tests. Do not take ownership of module business truth. Deliver ADRs, schemas, migrations/interfaces, contract tests and a recovery Runbook.

## 01 M02 Data Spine

Create branch `codex/implementation-m02-data`. Own T001-T008, C001-C003, C017 metadata projection and C032/C028/C029 clients.

Implement real source registration, immutable T002 snapshots, pipeline runs, quality, exact T007, T008 and delivery receipts. Lock the exact input version at run start, reject cycles and hard-quality failures, preserve retries without drift, and keep the S003 compatibility T007 permanently non-consumable. Do not calculate business Metric/Rule/score. Provide golden files and provider/consumer contract tests.

## 02 M01 Ontology

Create branch `codex/implementation-m01-ontology`. Own C004-C008, T017, T019 and Published lifecycle.

Accept only a valid same-context C003 delivery, expose T054/C032 discovery, create Draft and immutable Published versions, and atomically switch or roll back T019. Provide C008 empty/ready/failed/previous-trusted projections and candidate validation gates. Consumers are read-only; do not maintain private copies of T019 or Metric/Rule definitions.

## 03 M03 Query

Create branch `codex/implementation-m03-query`. Own C009/C010/C018 and query/Rule run facts.

Bind every run to Agent configuration, Prompt/Skill versions, Published semantic version, exact consumable data version, T008, structured result and evidence. Reject unknown, hard-failed or mismatched contexts. Submit only standard C011 requests and preserve run/result provenance. Do not switch T019 or read business detail around C008.

## 04 M04 Decision

Create branch `codex/implementation-m04-decision`. Own C011-C013, C019 and the three C017 safety gates.

Implement idempotent receipt, human confirmation and task creation as separate states. Reread C017 before receipt, confirmation and task formation; reject stale/unknown/mismatched contexts; preserve rejection and retry history without duplicate side effects. Keep C019 stable deep links and read-only summaries.

## 05 M06 Report

Create branch `codex/implementation-m06-report`. Own C018, C022/C023, T044/T049, C027 and report/dashboard persistence.

Freeze exact report context and evidence before generation, produce same-source HTML/PDF, run deterministic four-state verification, and record current comparisons independently. A later quality failure warns old reports but blocks new generation; regeneration creates a new run/content version. Do not let static C008/T019 values authorize generation.

## 06 M05 Agent

Create branch `codex/implementation-m05-agent`. Own C014/C020/C024/C025, model gateway, tool allowlists and Agent evaluation harness.

Accept only M06 fixed report context, C017 summaries and deterministic report results. Pin Prompt, Skill, tool, model, ontology and scenario versions. Return traceable explanations and evidence references; reject mismatches. Never calculate formal business results, switch T019, publish reports, execute Action or create tasks.

## 07 Quality and Release

Create branch `codex/implementation-quality-release`. Own golden datasets, contract compatibility, E2E, permission-negative, concurrency, performance, accessibility, SBOM/vulnerability, observability, C034 recovery, migration, rollback and CI/CD.

Build a short-lived integration environment per PR and a fixed S001 integration environment after merge. Each environment has separate database schema, object-store prefix, queue namespace and credentials. The release lane may create an implementation candidate only after the full vertical slice and recovery/security gates pass; it must never mutate the v1.1.0 prototype release.

## Integration Order

Merge foundation schemas first. Adapters and contract tests may run in parallel, but real handoff follows:

```text
M02 -> M01 -> M03 -> M04 -> M06 -> M05 -> M06
```

Start with S001. S002-S004 and the migrated S005/M07/M08 workspaces require their own data, semantic, scenario and migration gates before integration.
