# ADR-0002: Conservative Draft Schema Compatibility

- Status: accepted for `implementation-0.1.0`
- Date: 2026-08-24
- Baseline: `prototype-v1.1.0-frozen` / `BSL-OFW-V110-94ABD0E991B7`
- Owner: Foundation; consumers and resource owners review changes

## Decision

Foundation schemas are published as `draft-0.1.0` and are never promoted to a
final platform contract implicitly. A consumer must register the exact schema
version it validates and use the pure compatibility helper in
`packages/contracts/compatibility.js` before accepting a different version.

The compatibility policy is deliberately conservative:

| Change | Default result | Required action |
| --- | --- | --- |
| Same schema version | `exact` | Validate normally |
| Higher draft patch with the same declared shape | `review` | Keep the old reader and obtain owner review |
| Higher draft minor with only optional/additive fields | `review` | Register both versions and verify consumer tolerance |
| Required field, type, meaning, enum, identity or side-effect change | `breaking` | New major contract/CR; no in-place replacement |
| Lower version, malformed version, or draft/final mixing | `incompatible` | Reject at the boundary |

`review` is not an automatic approval. The implementation may expose an
explicit opt-in for a reconciled additive change, but the default is fail
closed. Unknown fields remain acceptable only in the draft forward-compatible
validator; strict consumers pass `{ allowUnknown: false }`.

## Rollout rule

Register a new draft schema beside the previous one, validate incoming data
against the declared version, and retain the previous reader until all
consumers acknowledge the new version. Never rewrite historical envelopes or
reinterpret an old `scenarioContext` in place. A migration creates a new
scenario version/run and a new checkpoint comparison receipt.

## Consequences

- M01-M06 can review a concrete diff without silently changing a shared
  contract.
- A failed compatibility check has no business side effect and no persistence
  requirement.
- Final promotion, retention, authorization and semantic enum decisions remain
  with the relevant owners and an explicit contract-change record.
