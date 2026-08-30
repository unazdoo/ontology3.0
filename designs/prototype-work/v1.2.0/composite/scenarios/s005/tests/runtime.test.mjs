import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const configApi = require(path.join(root, "scenario-config.js"));
const adapter = require(path.join(root, "scenario-adapter.js"));
const fixture = JSON.parse(fs.readFileSync(path.join(root, "resources/s005-research-fixture.json"), "utf8"));
const bytes = (last) => () => Uint8Array.from([0, 1, 2, 3, 4, last]);

test("S005 identity and M08 enum contract are canonical", () => {
  const context = adapter.createScenarioContext({ now: new Date("2026-08-27T09:30:00.000Z"), randomBytes: bytes(5) });
  assert.deepEqual(context, {
    scenarioId: "S005",
    scenarioVersion: "S005-v1",
    scenarioRunId: "S005-RUN-20260827093000000-000102030405",
    formedAt: "2026-08-27T09:30:00.000Z",
    status: "active"
  });
  assert.deepEqual(configApi.config.optionalMounts.M08.allowedResultKinds, ["PREDICTION", "SIMULATION"]);
  assert.equal(fixture.versionRefs.modelingObjectiveRef, "MO-S005-POST-INVESTMENT-RESEARCH-v1");
});

test("host can persist, restore and extend S005 history", () => {
  const context = adapter.createScenarioContext({ now: new Date("2026-08-27T09:30:00.000Z"), randomBytes: bytes(5) });
  const persisted = [];
  const runtime = adapter.createRuntime({ context, persist: (state) => persisted.push(state) });
  runtime.updateStage("sourceBatch", "complete", "source://S005/snapshot", new Date("2026-08-27T09:31:00.000Z"));
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].stages.sourceBatch.status, "complete");

  const restored = adapter.createRuntime({ restoredState: persisted[0] });
  assert.equal(restored.getState().completed, 1);
  assert.equal(restored.getHistory().length, 0);

  const resetPersisted = [];
  const resumed = adapter.createRuntime({ restoredState: persisted[0], persist: (state) => resetPersisted.push(state) });
  const receipt = resumed.reset({ now: new Date("2026-08-27T09:35:00.000Z"), randomBytes: bytes(6) });
  assert.equal(receipt.previousScenarioRunId, context.scenarioRunId);
  assert.equal(receipt.scenarioRunId, "S005-RUN-20260827093500000-000102030406");
  assert.equal(receipt.preservedHistoricalRuns, 1);
  assert.deepEqual(receipt.touchedModules, []);
  assert.equal(receipt.externalSideEffects, 0);
  assert.equal(resetPersisted.at(-1).history.length, 1);
  assert.equal(resetPersisted.at(-1).scenarioContext.scenarioId, "S005");

  const restoredAgain = adapter.createRuntime({ restoredState: resetPersisted.at(-1) });
  assert.equal(restoredAgain.getState().completed, 0);
  assert.equal(restoredAgain.getHistory().length, 1);
});

test("navigation validates current S005 context without accepting fact results", () => {
  const scenarioContext = adapter.createScenarioContext({ now: new Date("2026-08-27T10:00:00.000Z"), randomBytes: bytes(7) });
  const input = {
    scenarioContext,
    objectRef: fixture.products[0].objectRef,
    modelingObjectiveRef: fixture.versionRefs.modelingObjectiveRef,
    dataVersionId: fixture.versionRefs.dataVersionId,
    ontologyVersionId: fixture.versionRefs.ontologyVersionId,
    evaluationInputRef: fixture.versionRefs.evaluationInputRef,
    resultKind: "SIMULATION"
  };
  assert.equal(adapter.validateMountInput("M08", input).ok, true);
  assert.equal(adapter.validateMountInput("M08", { ...input, resultKind: "FACT" }).ok, false);
  assert.equal(adapter.createNavigationEnvelope("M08", input).routeId, "module/modeling");
});
