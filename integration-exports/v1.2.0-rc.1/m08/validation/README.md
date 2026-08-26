# M08 deterministic validation service

This zero-dependency Node.js service backs the exported M08 research module. It keeps the synthetic objective, candidate, binding and simulation contracts while accepting the active scenario identity from the integration host.

## Run

```bash
npm test
npm start
```

The default endpoint is `http://127.0.0.1:4357`. Set `M08_PORT` to use another local port and pass the same URL to the module as its `apiBase` query parameter.

Integration calls carry all three identity fields:

- `scenarioId`
- `scenarioVersion`
- `scenarioRunId`

Primary endpoints:

- `GET /health`
- `GET /v1/demo`
- `POST /v1/simulations/run`

The fixtures are synthetic and deterministic. Passing a scenario identity creates isolated research lineage; it does not turn the fixture into source scenario facts. The service does not register a Published model, write T019, or emit actions, approvals, todos, transactions or other external side effects.
