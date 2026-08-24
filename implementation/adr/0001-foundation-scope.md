# ADR-0001: Keep Foundation Pure and Minimal

- Status: accepted for `implementation-0.1.0`
- Date: 2026-08-24
- Baseline: `prototype-v1.1.0-frozen` / `BSL-OFW-V110-94ABD0E991B7`
- Owner: Foundation

## Decision

The v1.1.x Foundation lane publishes only dependency-free, language-neutral
contract shapes and pure safety primitives:

- the draft Contract Envelope and C033 scenario context;
- deterministic context comparison/fingerprints, idempotency and trace
  propagation;
- the C034 Provider SPI and recovery side-effect guard; and
- the minimum audit metadata structure.

`actorRef` is an identity reference only. Foundation does not resolve an
identity, grant access, or become the source of business state.

## Why full identity and governance are deferred

Authentication, SSO, RBAC/ABAC, organization matrices, approvals, notification
delivery, workflow execution, metrics and external adapters require product
owners, threat-model decisions, persistence/retention choices and cross-module
contracts that are not reconciled in this implementation slice. Introducing
them here would make a provisional Foundation schema authoritative before
M01-M06 agree on ownership and failure semantics. It would also create business
side effects in a package whose only safe guarantees are identity propagation,
duplicate suppression and isolated recovery.

The lane therefore exposes references and fail-closed hooks, while leaving
those systems to their later owners. A minimal configuration/feature-flag
reader may select an already-declared value, but it cannot persist flags,
roll out variants, or infer authorization.

## Consequences

- Consumers can validate and carry the same context and tracing identifiers
  without adopting a web framework, queue, database ORM or identity provider.
- A duplicate request is observable and can be short-circuited without mutating
  a business record.
- C034 restore/isolated replay always uses a new `scenarioRunId`, preserves the
  source, and blocks historical Action Request, notification, approval and todo
  side effects.
- M01-M06 must reconcile field meanings, retention, authorization and concrete
  persistence before promoting any schema beyond draft.

## Revisit trigger

Revisit this ADR only after M01-M06 return an agreed Owner/consumer matrix and
an explicit contract change for identity, authorization, audit storage or
governance behavior. No module may extend the shared Envelope silently.
