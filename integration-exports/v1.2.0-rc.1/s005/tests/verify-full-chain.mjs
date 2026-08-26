#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const configApi = require(path.join(root, "scenario-config.js"));
const adapter = require(path.join(root, "scenario-adapter.js"));

const fixedBytes = (offset) => () => Uint8Array.from([0, 1, 2, 3, 4, offset]);
const firstContext = adapter.createScenarioContext({ now: new Date("2026-08-27T09:30:00.000Z"), randomBytes: fixedBytes(5) });
assert.deepEqual(firstContext, {
  scenarioId: "S005",
  scenarioVersion: "S005-v1",
  scenarioRunId: "S005-RUN-20260827093000000-000102030405",
  formedAt: "2026-08-27T09:30:00.000Z",
  status: "active"
});
assert.equal(adapter.validateScenarioContext(firstContext).ok, true);
assert.equal(adapter.validateScenarioContext({ ...firstContext, scenarioVersion: "S005-research-v1" }).ok, false);

const emitted = [];
const runtime = adapter.createRuntime({ context: firstContext, emit: (type, detail) => emitted.push({ type, detail }) });
assert.throws(() => runtime.updateStage("classification", "complete"), /requires sourceBatch/);
const completed = runtime.completeAll({ now: new Date("2026-08-27T09:31:00.000Z") });
assert.equal(completed.completed, 7);
assert.equal(completed.total, 7);
assert.equal(completed.status, "research-draft");
assert.deepEqual(configApi.workflow.map((step) => step.moduleId), ["M02", "M01", "M03", "M03", "M04", "M05", "M06"]);
assert.ok(emitted.every((event) => event.type === "OFW_S005_STATE_CHANGED"));

const baseInput = {
  scenarioContext: firstContext,
  objectRef: { id: "PRD-223C00000000A5FB", objectTypeRef: "InvestmentProduct", title: "基金 A" },
  dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
  ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1"
};
const m07Input = { ...baseInput, asOf: "2026-07-17", lensIntent: "POST_INVESTMENT_OBJECT_360" };
const m08Input = { ...baseInput, modelingObjectiveRef: "S005-POST-INVESTMENT-EVALUATION-RESEARCH-v1", evaluationInputRef: "S005-EVAL-INPUT-RESEARCH-v1", resultKind: "SIMULATED" };
assert.equal(adapter.validateMountInput("M07", m07Input).ok, true);
assert.equal(adapter.validateMountInput("M08", m08Input).ok, true);
assert.equal(adapter.validateMountInput("M08", { ...m08Input, resultKind: "FACT" }).ok, false);
assert.equal(adapter.createNavigationEnvelope("M07", m07Input).routeId, "module/exploration");
assert.equal(adapter.createNavigationEnvelope("M08", m08Input).routeId, "module/modeling");

const receipt = runtime.reset({ now: new Date("2026-08-27T09:35:00.000Z"), randomBytes: fixedBytes(6) });
assert.equal(receipt.previousScenarioRunId, firstContext.scenarioRunId);
assert.equal(receipt.scenarioRunId, "S005-RUN-20260827093500000-000102030406");
assert.equal(receipt.preservedHistoricalRuns, 1);
assert.deepEqual(receipt.touchedModules, []);
assert.equal(receipt.externalSideEffects, 0);
assert.equal(runtime.getState().completed, 0);
assert.equal(runtime.getHistory()[0].completed, 7);

console.log(JSON.stringify({
  status: "ok",
  check: "full-chain-minimal-contract",
  workflowStages: completed.total,
  modules: configApi.config.modules,
  optionalMounts: Object.keys(configApi.config.optionalMounts),
  resetReceipt: receipt
}));
