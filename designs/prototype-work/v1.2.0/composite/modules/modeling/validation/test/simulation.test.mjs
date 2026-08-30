import test from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "../src/fixture.mjs";
import {
  assertFactWriteAllowed,
  compareThreeStates,
  createModelRegistry,
  derivePortfolioFeatures,
  runSimulation,
  validateModelGraph,
  validateParameters
} from "../src/simulation.mjs";

function find(items, field, value) {
  return items.find((item) => item[field] === value);
}

function runCase(fixture, caseId, options = {}) {
  const simulationCase = find(fixture.simulationCases, "caseId", caseId);
  const parameterSet = find(
    fixture.parameterSets,
    "parameterSetId",
    simulationCase.parameterSetId
  );
  const graph = find(fixture.modelGraphs, "graphId", simulationCase.graphId);
  return runSimulation({
    simulationCase,
    baseline: options.baseline || fixture.simulationBaseline,
    parameterSet,
    graph,
    registry: options.registry || createModelRegistry()
  });
}

test("parameter bounds reject out-of-range values", async () => {
  const fixture = await loadFixture();
  const parameterSet = find(
    fixture.parameterSets,
    "parameterSetId",
    "PS-S005-OUT-OF-RANGE-v1"
  );
  assert.throws(
    () => validateParameters(parameterSet.parameters),
    (error) => error.code === "PARAMETER_OUT_OF_RANGE"
  );
});

test("single-model market shock succeeds without changing its immutable baseline", async () => {
  const fixture = await loadFixture();
  const original = structuredClone(fixture.simulationBaseline);
  const run = runCase(fixture, "SC-S005-SINGLE-RATE-v1");
  assert.equal(run.status, "SUCCEEDED");
  assert.equal(run.nodeRuns.length, 1);
  assert.equal(run.result.resultKind, "SIMULATION");
  assert.equal(run.result.factWriteAllowed, false);
  assert.deepEqual(fixture.simulationBaseline, original);
});

test("minimal composite simulation runs in validated topological order", async () => {
  const fixture = await loadFixture();
  const run = runCase(fixture, "SC-S005-COMPOSITE-v1");
  assert.equal(run.status, "SUCCEEDED");
  assert.deepEqual(
    run.nodeRuns.map((item) => item.nodeId),
    ["marketShock", "evaluation"]
  );
  assert.equal(run.result.outputs.simulatedEvaluation.resultKind, "SIMULATION");
  assert.ok(Number.isFinite(run.result.outputs.simulatedEvaluation.score));
  assert.equal(run.result.promotable, true);
});

test("every forbidden side-effect capability remains disabled and unused", async () => {
  const fixture = await loadFixture();
  const run = runCase(fixture, "SC-S005-COMPOSITE-v1");
  assert.equal(run.sideEffectAudit.attempted, 0);
  assert.equal(run.sideEffectAudit.emitted, 0);
  assert.ok(Object.values(run.sideEffectAudit.capabilities).every((value) => value === false));
});

test("graph validation detects a type-compatible cycle", async () => {
  const registry = createModelRegistry();
  const graph = {
    graphId: "GRAPH-CYCLE-v1",
    nodes: [
      {
        nodeId: "a",
        modelVersionId: "MV-SIM-MARKET-SHOCK-0001",
        inputs: {
          portfolio: { source: "node", nodeId: "b", port: "portfolio" },
          parameters: { source: "parameterSet", port: "parameters" }
        }
      },
      {
        nodeId: "b",
        modelVersionId: "MV-SIM-MARKET-SHOCK-0001",
        inputs: {
          portfolio: { source: "node", nodeId: "a", port: "portfolio" },
          parameters: { source: "parameterSet", port: "parameters" }
        }
      }
    ],
    outputs: { portfolio: { nodeId: "b", port: "portfolio" } }
  };
  assert.throws(
    () => validateModelGraph(graph, registry),
    (error) => error.code === "CYCLE_DETECTED"
  );
});

test("graph validation rejects missing dependencies", async () => {
  const fixture = await loadFixture();
  const graph = structuredClone(find(fixture.modelGraphs, "graphId", "GRAPH-COMPOSITE-v1"));
  graph.nodes[1].inputs.portfolio.nodeId = "missing";
  assert.throws(
    () => validateModelGraph(graph, createModelRegistry()),
    (error) => error.code === "DEPENDENCY_NOT_FOUND"
  );
});

test("graph validation rejects unit mismatch", async () => {
  const fixture = await loadFixture();
  const graph = find(fixture.modelGraphs, "graphId", "GRAPH-COMPOSITE-v1");
  assert.throws(
    () => validateModelGraph(graph, createModelRegistry({ marketOutputUnit: "USD" })),
    (error) => error.code === "UNIT_MISMATCH"
  );
});

test("graph validation rejects time-grain mismatch", async () => {
  const fixture = await loadFixture();
  const graph = find(fixture.modelGraphs, "graphId", "GRAPH-COMPOSITE-v1");
  assert.throws(
    () =>
      validateModelGraph(
        graph,
        createModelRegistry({ marketOutputTimeGrain: "DAILY" })
      ),
    (error) => error.code === "TIME_GRAIN_MISMATCH"
  );
});

test("graph validation rejects incompatible model types", async () => {
  const fixture = await loadFixture();
  const graph = find(fixture.modelGraphs, "graphId", "GRAPH-COMPOSITE-v1");
  assert.throws(
    () =>
      validateModelGraph(
        graph,
        createModelRegistry({ marketOutputType: "PositionSet" })
      ),
    (error) => error.code === "MODEL_INCOMPATIBLE_TYPE"
  );
});

test("graph validation rejects a model that declares side effects", async () => {
  const fixture = await loadFixture();
  const graph = find(fixture.modelGraphs, "graphId", "GRAPH-COMPOSITE-v1");
  const registry = createModelRegistry();
  registry.get("MV-SIM-MARKET-SHOCK-0001").sideEffects.push("notification");
  assert.throws(
    () => validateModelGraph(graph, registry),
    (error) => error.code === "FORBIDDEN_MODEL_SIDE_EFFECT"
  );
});

test("insufficient baseline data fails honestly", async () => {
  const fixture = await loadFixture();
  const baseline = structuredClone(fixture.simulationBaseline);
  delete baseline.holdings[0].currentMarketValueCny;
  const run = runCase(fixture, "SC-S005-COMPOSITE-v1", { baseline });
  assert.equal(run.status, "FAILED");
  assert.equal(run.nodeRuns[0].errorCode, "DATA_INSUFFICIENT");
  assert.equal(run.nodeRuns[1].status, "SKIPPED_UPSTREAM_FAILED");
  assert.equal(run.result.promotable, false);
});

test("model failure propagates to downstream skip without a promotable partial result", async () => {
  const fixture = await loadFixture();
  const graph = {
    graphId: "GRAPH-FAIL-v1",
    nodes: [
      {
        nodeId: "fail",
        modelVersionId: "MV-SIM-FAIL-0001",
        inputs: { portfolio: { source: "baseline", port: "portfolio" } }
      },
      {
        nodeId: "downstream",
        modelVersionId: "MV-SIM-EVALUATION-0001",
        inputs: {
          portfolio: { source: "node", nodeId: "fail", port: "portfolio" }
        }
      }
    ],
    outputs: { evaluation: { nodeId: "downstream", port: "evaluation" } }
  };
  const parameterSet = fixture.parameterSets[0];
  const run = runSimulation({
    simulationCase: {
      caseId: "SC-FAIL-v1",
      baselineId: fixture.simulationBaseline.baselineId,
      parameterSetId: parameterSet.parameterSetId,
      graphId: graph.graphId
    },
    baseline: fixture.simulationBaseline,
    parameterSet,
    graph,
    registry: createModelRegistry()
  });
  assert.deepEqual(
    run.nodeRuns.map((item) => [item.status, item.errorCode]),
    [
      ["FAILED", "FORCED_MODEL_FAILURE"],
      ["SKIPPED_UPSTREAM_FAILED", "UPSTREAM_FAILED"]
    ]
  );
  assert.equal(run.result.promotable, false);
});

test("simulation and prediction writes to the fact store are rejected", async () => {
  const fixture = await loadFixture();
  const run = runCase(fixture, "SC-S005-COMPOSITE-v1");
  assert.throws(
    () => assertFactWriteAllowed(run.result),
    (error) => error.code === "NON_FACT_WRITE_REJECTED"
  );
  assert.equal(assertFactWriteAllowed(fixture.referenceFactResult), true);
});

test("fact, prediction and simulation remain distinct in side-by-side comparison", async () => {
  const fixture = await loadFixture();
  const run = runCase(fixture, "SC-S005-COMPOSITE-v1");
  const prediction = {
    resultId: "PRED-TEST-001",
    resultKind: "PREDICTION",
    score: 70,
    permissionScope: "prediction.read"
  };
  const comparison = compareThreeStates({
    fact: fixture.referenceFactResult,
    prediction,
    simulation: run.result
  });
  assert.deepEqual(
    comparison.columns.map((item) => item.resultKind),
    ["FACT", "PREDICTION", "SIMULATION"]
  );
  assert.equal(comparison.overwriteAllowed, false);
  assert.equal(new Set(comparison.columns.map((item) => item.resultId)).size, 3);
});

test("portfolio feature derivation is deterministic", async () => {
  const fixture = await loadFixture();
  assert.deepEqual(
    derivePortfolioFeatures(fixture.simulationBaseline),
    derivePortfolioFeatures(structuredClone(fixture.simulationBaseline))
  );
});
