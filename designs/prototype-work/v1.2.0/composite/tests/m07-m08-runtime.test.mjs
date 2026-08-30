import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const compositeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(compositeRoot, relativePath), "utf8");

function loadM07Core() {
  const context = vm.createContext({ window: {}, console, URL, URLSearchParams });
  vm.runInContext(read("modules/m07/module/core.js"), context, { filename: "m07/core.js" });
  return context.window.M07Core;
}

function loadM08Bridge() {
  const context = vm.createContext({ console, URLSearchParams });
  vm.runInContext(read("modules/modeling/bridge/m07-m08-bridge.js"), context, { filename: "m08/bridge.js" });
  return context.OFW_M07_M08_BRIDGE;
}

test("actual M07 payload builder passes directly through M08 acceptM07Open", () => {
  const core = loadM07Core();
  const bridge = loadM08Bridge();
  const resource = JSON.parse(read("modules/m07/resources/s005.json"));
  const product = resource.objects.find((item) => item.id === "product-01");
  assert.ok(product?.canonicalObjectRef, "candidate M07 product must expose its canonical ObjectRef");
  const scenarioContext = {
    scenarioId: "S005",
    scenarioVersion: "S005-v1",
    scenarioRunId: "S005-RUN-20260827150000000-001122334455",
    formedAt: "2026-08-27T15:00:00.000Z",
    status: "active"
  };
  const payload = core.createModuleHandoffContext({
    objectRef: product.canonicalObjectRef,
    lensRef: { moduleId: "m07", lensId: "temporal", route: "#module/m07" },
    seriesRef: null,
    timeRange: { start: "2025-02-21", end: "2026-07-17" },
    dataVersionId: "S005-DATA-AUDIT-79-SNAPSHOTS",
    ontologyVersionId: "S005-SEMANTIC-CANDIDATE-v1",
    bindingId: "MB-S005-EVALUATION-v1",
    scenarioContext
  });
  const accepted = bridge.acceptM07Open({
    type: "OFW_M07_OPEN_M08",
    sourceModuleId: "m07",
    sourceRoute: "#module/m07",
    payload
  }, scenarioContext);
  assert.deepEqual(JSON.parse(JSON.stringify(bridge.scenarioIdentity(accepted))), scenarioContext);
  assert.equal(accepted.objectRef.id, "PRD-223C00000000A5FB");
  assert.equal(accepted.objectRef.objectTypeRef, "InvestmentProduct");
  assert.equal(accepted.lensRef.lensId, "temporal");
  assert.equal(accepted.seriesRef, null);
  assert.equal(Object.isFrozen(payload), true);
  assert.equal(Object.isFrozen(payload.scenarioContext), true);
  assert.throws(() => bridge.acceptM07Open({
    type: "OFW_M07_OPEN_M08",
    sourceModuleId: "m07",
    sourceRoute: "#module/m07",
    payload: {
      ...payload,
      scenarioRunId: "S005-RUN-20260827150000000-ffffffffffff",
      scenarioContext: { ...payload.scenarioContext, scenarioRunId: "S005-RUN-20260827150000000-ffffffffffff" }
    }
  }, scenarioContext), /does not match/);
});

test("M07 workspace uses the tested payload builder", () => {
  const workspace = read("modules/m07/module/workspace-v2.js");
  assert.match(workspace, /C\.createModuleHandoffContext\(\{/);
  assert.doesNotMatch(workspace, /const handoffContext = \{\s*objectRef/);
});
