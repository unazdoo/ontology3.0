# M08 deterministic validation service

This zero-dependency Node.js service backs the integrated M08 research module. It keeps the objective, candidate, binding and simulation contracts while accepting the active scenario identity from the integration host. It also exposes the deterministic S003 supervised-benchmark and continuous-optimization state chain.

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

S003 deterministic research endpoints:

- `GET /v1/s003/workspace`
- `POST /v1/s003/benchmark/run`
- `POST /v1/s003/insights/generate`
- `POST /v1/s003/candidates/generate`
- `POST /v1/s003/candidates/evaluate`
- `POST /v1/s003/shadow/start`
- `POST /v1/s003/shadow/advance`
- `POST /v1/s003/release-candidates/form`
- `POST /v1/s003/bindings/validate`
- `POST /v1/s003/bindings/apply-default`
- `POST /v1/s003/results/recalculate`
- `POST /v1/s003/m04/guard`
- `POST /v1/s003/reset`

The S003 baseline Model Version references `S003-M01-DEBT-RISK-PKG@1.0.2` by its frozen source path and SHA-256. The service verifies and reads that source without copying a second authoritative configuration. Benchmark labels come only from the explicit de-identified longitudinal synthetic fixture. Validation and candidate tuning never use the sealed holdout; forming the final research Release Candidate consumes it once.

The fixtures are synthetic and deterministic. Passing a scenario identity creates isolated research lineage; it does not turn the fixture into source scenario facts. S003 fixed-data recalculation reads the frozen 21-enterprise result set and emits a separate `PREDICTION` Result Envelope; the archived `S003-RUN` and its FACT records remain unchanged. The service does not register a Published model, write T019, run AutoML, expose a production model endpoint, or emit actions, approvals, todos, transactions or other external side effects.
