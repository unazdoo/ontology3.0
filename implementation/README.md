# v1.1.x Production Implementation Workspace

This workspace is the implementation integration branch for the immutable v1.1.0 product reference.
It is not the prototype release directory and must not modify the frozen prototype tree.

## Baseline

```text
sourceTag = prototype-v1.1.0-frozen
sourceVersion = v1.1.0
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
implementationVersion = implementation-0.1.0
acceptanceReady = false
```

The prototype remains the visual and interaction reference. Production state must be implemented with services, persistent storage, APIs, events, identity, authorization, audit, observability and recovery controls. Static HTML/JS, localStorage, temporary JSON and browser state are never production truth.

## Architecture Starting Point

Start with a modular monolith plus asynchronous workers:

- `services/data` owns T001-T008, C001-C003 and C017 projections.
- `services/ontology` owns T009-T019, C004-C008 and C028/C029.
- `services/query` owns C009/C010/C018 and query/Rule run facts.
- `services/decision` owns C011-C013, C019 and decision/task facts.
- `services/report` owns C018, C022/C023, T044/T049 and C027.
- `services/agent` owns C014/C020/C024/C025 and Agent run facts.
- `packages/contracts` owns versioned API/event schemas only.
- `packages/identity` owns C033 context and idempotency primitives.
- `packages/checkpoint` owns the C034 provider interface and recovery orchestration.
- `infra` owns database migrations, object storage, queues, IAM and observability wiring.

Pipeline, report rendering and Agent execution may scale as workers. Domain state remains owned by its module; cross-module read models are projections, not writable copies.

## First Vertical Slice

Implement S001 first, in this order:

```text
M02 -> M01 -> M03 -> M04 -> M06 -> M05 -> M06
```

Each lane may build schemas, adapters, mocks and contract tests in parallel. Real handoff only starts when the upstream exact version and evidence are available.

## Protected Workspaces

- `designs/prototype-releases/v1.1.0/` is immutable.
- The S001-S004 composite prototype worktree is source evidence only.
- S005, M07 and M08 research worktrees remain independent and retain their recorded v1.0.3 parent until an explicit migration record is approved.

Use `PARALLEL-IMPLEMENTATION-PROMPTS.md` to dispatch the lanes.
