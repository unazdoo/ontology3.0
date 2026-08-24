# M06 Implementation Notes

This branch adds the executable M06 boundary in `packages/report`, exposed
through the Owner entry point at `services/report`. It is a
storage-agnostic service with a JSON file store adapter; it does not silently
promote the frozen browser fixtures to runtime authority.

## Authority And Handoff

`ReportService.generateReport()` requires live M01 and M02 owner ports. It
reads C008/C017 in this order:

1. before evidence is fixed;
2. after evidence collection;
3. immediately before M05 is submitted.

Each read requires an owner API receipt and a consumable exact T019/semantic/
data/T008 combination. A static, seeded, cached or fixture-marked read is
rejected. Any identity change rejects the request before an evidence pack,
C022 record or M05 run is persisted.

The M05 port receives C022 and returns an immutable C023 source draft. M06
alone creates the review copy, immutable content version and T044 stable
anchors. M05 extraction is accepted only as claims; it cannot return a T049
decision.

## Verification And Comparison

T049 runs five deterministic groups and stores item-level `pass`, `warning`,
`fail` or `unverifiable` results with Chinese labels, T044/evidence references,
and report/section/group coverage. The result is independent of any optional
Agent explanation run.

C027 requires `explicitUserAction: true`, a fresh C008/C017 read and a platform
authorization receipt. It stores the report snapshot, current authority,
candidates and previous-trusted identities separately. A later authority
change appends a staleness event; it never rewrites the comparison or report.

## Immutable Outputs And Recovery

Confirmed content is rendered once into controlled HTML and a real PDF byte
stream from the same source hash. Published artifacts are append-only. A
post-publication hard quality failure appends a warning to the old artifact and
blocks new generation/publication for the failed exact data version.

The C034 provider exports definitions, templates, C018 snapshots, dashboards,
C022/C023, T044/T049, C027, evidence and HTML/PDF artifacts. Clone restore
creates a new scenario run and retains historical state as read-only; it does
not publish, recalculate, compare or replay historical side effects.

## Foundation Compatibility

M06 is pinned to the merged Foundation `draft-0.1.0` baseline. Public inbound
Envelope validation is strict and exact: unknown envelope/C033 fields,
scenario-run mismatch, malformed/downgraded/upgraded schema versions and
unregistered payload versions fail closed. C034 exports record the exact
Foundation contract, checkpoint schema and SPI versions; unknown module state
cannot pass validation or clone restore.

The current M05 implementation in tests remains a fixture. This stage proves
the M06 consumer boundary can validate a strict Foundation Envelope; it does
not prove that M01/M02/M05 providers emit those envelopes or that M06 outbound
C022/C024 requests are jointly accepted. Those exchanges remain for the next
Provider/Consumer integration stage.

## C024/C025 Official Adapter

M06 now exposes `createReportCopilotRequest`, `requestReportCopilot`,
`readReportCopilotResult` and `getReportCopilotReference`. C024 is built only
from an exact published report/content version, evidence pack, selected T044
snapshot, generation C017 reference, authorization result, purpose/question
and Agent Release. The outbound request is a strict Foundation Envelope.

The injected M05 port must implement `receiveReportCopilotRequest`,
`runReportCopilot` and `readReportCopilotResult`, returning strict C024/C025
Envelopes. M06 validates one C033 run and exact report/content/evidence,
semantic/data/T008, anchor snapshot and Agent Release identities across the
Binding, Session, Run and Result. It persists only stable M05 references and
M06 handoff/readback receipts; no answer body or M05 state is copied.

The contract fixture proves the M06 consumer path and idempotency behavior but
is not M05 joint evidence. Real M05 receive/run/read receipts and negative
cross-module runs remain required.

Verification commands:

```text
npm run check
npm test
node --test designs/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/tests/baseline-module-runtime-m06.test.cjs
```

The current package/service tests pass with 66 tests; the prototype regression suite
passes 40 tests. Real deployment still requires wiring the M01, M02, M05 and
platform authorization ports to their owning runtime APIs.
