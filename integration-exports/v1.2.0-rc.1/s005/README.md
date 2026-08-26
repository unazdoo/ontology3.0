# S005 v1.2.0-rc.1 minimal scenario package

This directory is the mergeable S005 prototype delta for the shared product Shell. It contains no product Shell, M01-M08 implementation, frozen baseline copy, archived prototype, screenshot, or source business document.

## Baseline contract

| Field | Value |
|---|---|
| Source tag | `prototype-v1.1.0-frozen` |
| Parent version | `v1.1.0` |
| Baseline snapshot | `BSL-OFW-V110-94ABD0E991B7` |
| Target prototype | `v1.2.0-rc.1` |
| Scenario | `S005 / S005-v1` |
| Namespace | `ofw.s005.research.v1` |
| Status | `research-candidate` |
| Acceptance | `acceptanceReady=false` |

## Host integration

The host Shell registers the scenario from `INTEGRATION-MANIFEST.json` and mounts `content.html` as the S005 content route. The content page does not render product navigation or a second Shell.

The host should send an `OFW_S005_CONTEXT` message after the content frame reports `OFW_S005_READY`. The payload must contain the five-field scenario context:

```json
{
  "scenarioId": "S005",
  "scenarioVersion": "S005-v1",
  "scenarioRunId": "S005-RUN-20260827093000000-012345abcdef",
  "formedAt": "2026-08-27T09:30:00.000Z",
  "status": "active"
}
```

Module buttons emit `OFW_S005_OPEN_MODULE`. Optional M07 and M08 mounts use the same event and the input contracts declared in the manifest. The host remains responsible for route changes and for supplying authoritative M01/M02 references. S005 never treats research fixture values as Published facts.

`OFW_S005_RESET_REQUEST` asks the host to reset only the current S005 run. The content runtime can also create an in-memory replacement run for preview. Neither path deletes or rewrites M01-M08 facts, historical scenario runs, reports, actions, tasks, or transactions.

## Local preview

From this directory:

```bash
python3 -m http.server 4360 --bind 127.0.0.1
```

Open `http://127.0.0.1:4360/content.html`. Without a parent Shell the page creates a valid preview run in memory and keeps all host navigation requests local.

## Verification

The package has no install step and uses only Node.js built-ins:

```bash
npm test
```

Individual commands:

```bash
npm run verify:package
npm run verify:research
npm run verify:full-chain
```

`verify:package` checks integrity and forbidden package content. `verify:research` replays the deterministic fixture summary. `verify:full-chain` verifies identity, seven-stage workflow, module mapping, M07/M08 inputs, and the S005-only reset boundary.

## Known boundaries

- This is a research prototype package, not a production data or model release.
- The 79-snapshot and 15-candidate values are pseudonymous research evidence summaries; no raw workbook rows or business identities are included.
- M07 and M08 are optional host mounts. Their code and services are not part of this package.
- M03-M06 screens remain baseline module routes; S005 only supplies scenario context and research-stage state.
- User review, module review, scenario acceptance, production integration, and phase-one acceptance are not asserted.
