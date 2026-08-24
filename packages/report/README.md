# M06 Report Center

`packages/report` is the storage- and framework-agnostic M06 implementation
for C018, C022/C023, T044/T049, C027, report/dashboard persistence and C034
module recovery.

`definition.js` contains the managed production contracts. `template.js`
retains a small renderer-compatible normalization API for callers using the
foundation prototype shape; the service uses the managed definitions/templates.

`boundary.js` pins the Foundation Contract Envelope to exact `draft-0.1.0`,
uses strict C033 validation and rejects envelope/schema/context mismatches.
`ReportService({ requireContractEnvelopes: true })` closes inbound M01/M02/M05
responses to that envelope. The raw-object ports used by `service.test.cjs`
are module fixtures only and are not Provider/Consumer integration evidence.

`copilot.js` is the official M06 C024/C025 adapter. The service APIs are:

- `createReportCopilotRequest(input)` resolves a published report, exact
  content version, evidence pack, selected T044 anchors and generation C017
  reference into an immutable FixedReportContext and strict C024 Envelope.
- `requestReportCopilot(input)` calls the injected M05
  `receiveReportCopilotRequest`, `runReportCopilot` and
  `readReportCopilotResult` ports.
- `readReportCopilotResult({ requestId })` re-reads the M05-owned C025 chain.
- `getReportCopilotReference(requestId)` returns only M06's stored read-only
  Binding/Session/Run/Result references.

C025 must return the exact report/content/evidence/anchor/C017/semantic/data/
T008/Agent Release identity. M06 never stores the answer body and never uses
C025 to modify report content, T049 or C027. Once M05 has accepted a request,
an idempotent retry only performs a read and cannot start another Run.

The service deliberately accepts live owner ports instead of static C008,
C017, T019 or T008 values:

- `c008Provider.readCurrentC008(request)` is the M01 authoritative read.
- `c017Provider.readCurrentC017(request)` is the M02 current summary read.
- `c017Provider.readC017ForVersion(request)` is the bound-version quality read.
- `m05Port.submitReportGeneration(c022)` returns the immutable C023 source draft.
- `m05Port.extractReportClaims(request)` returns extraction-only claims; it may
  not return T049 statuses.
- `authorizationPort.authorizeReportComparison(request)` is the platform
  authorization decision used by explicit C027 requests.

`ReportService.generateReport()` reads C008/C017 at three ordered gates. A
fixed context and evidence pack are created only when all three reads are
fresh, authoritative, consumable and exactly compatible. M06 then accepts
C023, forms the review copy, immutable content version and T044 anchors.

`verifyContent()` first accepts the M05 extraction and then runs five
deterministic rule groups. It stores T049 with item-level four-state results,
anchors, evidence references and report/section/group coverage. Explanations
are intentionally outside this package and cannot alter T049.

`compareWithCurrent()` is C027. It requires `explicitUserAction: true`, reads a
fresh C008/C017 pair, fixes the five comparison gates and appends staleness
events later; it never edits the original report or comparison record.

`publishReport()` renders one immutable source into controlled HTML and a
real PDF byte stream. A post-publication hard quality failure adds a warning
to the old report and blocks new generation/publication without changing the
old content or T049.

`createM06CheckpointProvider()` implements the Foundation C034 SPI. Exports
include report definitions/templates, C018 snapshots, dashboards, C022/C023,
T044/T049, C027 and artifacts. Clone restore creates a new scenario run and
keeps historical state read-only; it never replays side effects or auto-runs
publication, recalculation or comparison.

C034 exports also contain FixedReportContext, C024 handoff receipts, C025
stable references and readback receipts. They remain historical/read-only on
clone restore.

The C034 adapter records the exact Foundation contract, checkpoint schema and
SPI versions. Unknown module-export fields, store collections, pointer
namespaces and ScenarioContext fields fail validation before clone restore.
