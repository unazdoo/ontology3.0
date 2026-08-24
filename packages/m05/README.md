# M05 Agent Runtime

This package is the storage-agnostic M05 boundary for C014, C020, C024 and
C025. It accepts only a fixed M06 report context, a C017 credibility summary,
and (for explanation runs) a M06 deterministic verification result. Inputs are
copied and frozen before use.

The runtime does not read workbooks/T002/T007, calculate Metric or Rule values,
switch T019, publish reports, execute Actions, or create todos. Model and tool
calls require an exact enabled Agent Release, an explicit permission decision,
and an allowlisted read-only adapter. Timeouts, retry attempts, token/cost
budgets, prompt-injection rejection and append-only audit records are exposed
as pure/injectable boundaries.

```js
const m05 = require('./packages/m05');
const store = m05.createReportCopilotStore();
const request = store.receiveC024(c024Payload);
// Binding/session/run are created only after the request passes the gates.
const chain = store.start(request.requestId, exactAgentRelease);
```

`packages/agent-release` is the canonical immutable resource and permission
boundary. `packages/agent-runtime`, `packages/agent`, and
`packages/agent-gateway` are compatibility entry points to this implementation.

`createM06ReportPort()` exposes the production-facing M06 adapter. It validates
and stores C022 generation requests before invoking an injected Agent runner,
produces the existing C023 source-draft shape, resumes completed generations by
request identity, and performs extraction-only C024/C025 claim binding. M06
continues to own T044, HTML/PDF, review/publication and deterministic T049. Each
runner is bound to an injected exact active Agent Release (including Prompt,
Skill, Tool, Model, Published ontology, validity and resource whitelist) and a
fixed port deadline; timed-out or unknown executions cannot be retried
implicitly.
