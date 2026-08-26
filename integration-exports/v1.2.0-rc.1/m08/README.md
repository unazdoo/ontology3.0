# M08 minimal integration export

This package is the additive M08 modeling contribution for the `v1.2.0-rc.1` prototype candidate. It is derived from `prototype-v1.1.0-frozen` without copying or modifying that frozen release.

## Identity

- Source tag: `prototype-v1.1.0-frozen`
- Parent version: `v1.1.0`
- Baseline snapshot: `BSL-OFW-V110-94ABD0E991B7`
- Target prototype: `v1.2.0-rc.1`
- Acceptance ready: `false`

The package contains only the embedded M08 modeling workspace, a canonical M07-to-M08 bridge, and the deterministic validation service. It deliberately contains no M07 page, platform Shell, M01-M06 module copy, scenario package, archive, screenshot or frozen release artifact.

## Layout

- `module/content.html`: M08 iframe entry.
- `bridge/m07-m08-bridge.js`: scenario identity and M07/M08 message adapter.
- `validation/`: zero-dependency Node.js research service and its 43 tests.
- `test/static-contract.test.mjs`: export scope, bridge, portability and integrity checks.
- `INTEGRATION-MANIFEST.json`: machine-readable mount and message contract.
- `SHA256SUMS`: hashes for every package file except the checksum file itself.

## Host integration

1. Keep the frozen v1.1.0 release read-only and mount this package in the new candidate workspace.
2. Register M08 as `moduleId=modeling`, `route=#module/modeling`, with iframe entry `module/content.html`.
3. Preserve canonical M07 as `moduleId=m07`, `route=#module/m07`.
4. Build the iframe URL with `OFW_M07_M08_BRIDGE.moduleUrl()`. The URL must include `scenarioId`, `scenarioVersion` and `scenarioRunId`; `apiBase` defaults to `http://127.0.0.1:4357`.
5. On `OFW_M07_OPEN_M08`, call `acceptM07Open()` against the active scenario, store the returned handoff in candidate-owned session state, then navigate to `#module/modeling`.
6. After the M08 iframe loads, post `deliveryMessage()` with the active scenario, read-only projection and stored M07 handoff.
7. On `OFW_M08_RETURN_TO_M07`, preserve the returned result envelope, navigate to `#module/m07`, and deliver it to canonical M07. Do not mount a second exploration implementation.

The iframe accepts host messages only from the same origin. The validation service may run on its separate local port and already returns CORS headers for prototype use.

## Run and verify

From this directory:

```bash
node --test test/static-contract.test.mjs
(cd validation && npm test)
(cd validation && npm start)
```

Serve the candidate workspace with any static HTTP server, then open the host's single prototype entry. Do not open `module/content.html` as the product entry; it is an embedded module surface.

## Boundary

The data and model outputs are synthetic research fixtures. This export does not register Published models, write T019, modify facts, create actions, or prove production integration. M03/M05/M06 consumer cards remain contract previews until their owners integrate the shared result envelope. `acceptanceReady=false` remains authoritative.
