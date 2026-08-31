import assert from "node:assert/strict";
import test from "node:test";
import { startCandidate } from "../start-candidate.mjs";

test("one candidate launcher serves the unified shell and deterministic M08 service", async (t) => {
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  t.after(() => runtime.close());
  const entry = await fetch(runtime.entryUrl);
  const health = await fetch(`${runtime.modelingUrl}/health`);
  assert.equal(entry.status, 200);
  assert.match(await entry.text(), /id="app"/);
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.factWriteAllowed, false);
  assert.match(runtime.entryUrl, /s001-e2e-integration\/index\.html#home$/);
});
