import assert from "node:assert/strict";
import test from "node:test";
import { startCandidate } from "../start-candidate.mjs";

test("v1.4 candidate serves the local Shell and reused model runtime", async (t) => {
  const runtime = await startCandidate({ staticPort: 0, modelingPort: 0 });
  t.after(() => runtime.close());

  assert.match(runtime.entryUrl, /v1\.4\/composite\/s001-e2e-integration\/index\.html/);
  const shell = await fetch(runtime.entryUrl.split("#")[0]);
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /智财问策/);

  const catalog = await fetch(`${runtime.modelingUrl}/v1/model-management/scenarios`);
  assert.equal(catalog.status, 200);
  const body = await catalog.json();
  assert.deepEqual(body.scenarios.map((item) => item.scenario.scenarioId), ["S001", "S002", "S003", "S004", "S005"]);
  assert.equal(body.acceptanceReady, false);
});
