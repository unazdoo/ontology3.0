import { mkdir, writeFile } from "node:fs/promises";
import { buildDemo } from "../src/demo.mjs";
import { loadFixture } from "../src/fixture.mjs";
import { sha256 } from "../src/hash.mjs";
import {
  assertFactWriteAllowed,
  createModelRegistry,
  runSimulation,
  validateModelGraph
} from "../src/simulation.mjs";
import {
  getObjective,
  listObjectives,
  projectObjectiveForConsumer,
  validateObjectiveBinding
} from "../src/objective-registry.mjs";

const evidenceUrl = new URL("../evidence/technical-validation-summary.json", import.meta.url);

function capture(name, expectedCode, operation) {
  try {
    operation();
    return { name, status: "FAILED", expectedCode, actualCode: null };
  } catch (error) {
    return {
      name,
      status: error.code === expectedCode ? "PASSED" : "FAILED",
      expectedCode,
      actualCode: error.code || error.name,
      message: error.message
    };
  }
}

const fixture = await loadFixture();
const demo = await buildDemo();
const combinedCase = fixture.simulationCases.find(
  (item) => item.caseId === "SC-S005-COMPOSITE-v1"
);
const combinedParameters = fixture.parameterSets.find(
  (item) => item.parameterSetId === combinedCase.parameterSetId
);
const combinedGraph = fixture.modelGraphs.find(
  (item) => item.graphId === combinedCase.graphId
);

const outOfRange = fixture.parameterSets.find(
  (item) => item.parameterSetId === "PS-S005-OUT-OF-RANGE-v1"
);
const outOfRangeCase = {
  ...combinedCase,
  caseId: "SC-S005-OUT-OF-RANGE-v1",
  parameterSetId: outOfRange.parameterSetId
};
const cycleGraph = {
  resourceKind: "CompositeModelGraph",
  graphId: "GRAPH-CYCLE-NEGATIVE-v1",
  nodes: [
    {
      nodeId: "cycleA",
      modelVersionId: "MV-SIM-MARKET-SHOCK-0001",
      inputs: {
        portfolio: { source: "node", nodeId: "cycleB", port: "portfolio" },
        parameters: { source: "parameterSet", port: "parameters" }
      }
    },
    {
      nodeId: "cycleB",
      modelVersionId: "MV-SIM-MARKET-SHOCK-0001",
      inputs: {
        portfolio: { source: "node", nodeId: "cycleA", port: "portfolio" },
        parameters: { source: "parameterSet", port: "parameters" }
      }
    }
  ],
  outputs: { portfolio: { nodeId: "cycleB", port: "portfolio" } }
};
const missingDataBaseline = structuredClone(fixture.simulationBaseline);
delete missingDataBaseline.holdings[0].currentMarketValueCny;
const insufficientDataRun = runSimulation({
  simulationCase: combinedCase,
  baseline: missingDataBaseline,
  parameterSet: combinedParameters,
  graph: combinedGraph,
  registry: createModelRegistry()
});
const failureGraph = {
  resourceKind: "CompositeModelGraph",
  graphId: "GRAPH-FAILURE-PROPAGATION-v1",
  nodes: [
    {
      nodeId: "forcedFailure",
      modelVersionId: "MV-SIM-FAIL-0001",
      inputs: {
        portfolio: { source: "baseline", port: "portfolio" }
      }
    },
    {
      nodeId: "downstreamEvaluation",
      modelVersionId: "MV-SIM-EVALUATION-0001",
      inputs: {
        portfolio: {
          source: "node",
          nodeId: "forcedFailure",
          port: "portfolio"
        }
      }
    }
  ],
  outputs: {
    simulatedEvaluation: {
      nodeId: "downstreamEvaluation",
      port: "evaluation"
    }
  }
};
const failureRun = runSimulation({
  simulationCase: { ...combinedCase, caseId: "SC-S005-FAILURE-v1", graphId: failureGraph.graphId },
  baseline: fixture.simulationBaseline,
  parameterSet: combinedParameters,
  graph: failureGraph,
  registry: createModelRegistry()
});
const objectiveCatalog = listObjectives();
const forecastObjective = getObjective("MO-S001-COST-FORECAST-v1");
const badObjectiveBinding = structuredClone(forecastObjective.bindingDraft);
badObjectiveBinding.inputMappings[0].unit = "ratio";
const m07Projection = projectObjectiveForConsumer({ objectiveId: forecastObjective.objectiveId, consumerId: "M07_EXPLORATION" });
const optimizationProjection = projectObjectiveForConsumer({ objectiveId: "MO-S001-DEBT-STRUCTURE-OPT-v1", consumerId: "M07_EXPLORATION" });
const m04Projection = projectObjectiveForConsumer({ objectiveId: forecastObjective.objectiveId, consumerId: "M04_DECISION" });

const negativeChecks = [
  capture("parameter-range", "PARAMETER_OUT_OF_RANGE", () =>
    runSimulation({
      simulationCase: outOfRangeCase,
      baseline: fixture.simulationBaseline,
      parameterSet: outOfRange,
      graph: combinedGraph,
      registry: createModelRegistry()
    })
  ),
  capture("cycle-detection", "CYCLE_DETECTED", () =>
    validateModelGraph(cycleGraph, createModelRegistry())
  ),
  capture("unit-mismatch", "UNIT_MISMATCH", () =>
    validateModelGraph(combinedGraph, createModelRegistry({ marketOutputUnit: "USD" }))
  ),
  capture("time-grain-mismatch", "TIME_GRAIN_MISMATCH", () =>
    validateModelGraph(
      combinedGraph,
      createModelRegistry({ marketOutputTimeGrain: "DAILY" })
    )
  ),
  capture("model-type-incompatibility", "MODEL_INCOMPATIBLE_TYPE", () =>
    validateModelGraph(
      combinedGraph,
      createModelRegistry({ marketOutputType: "PositionSet" })
    )
  ),
  {
    name: "data-insufficient",
    status:
      insufficientDataRun.status === "FAILED" &&
      insufficientDataRun.nodeRuns[0]?.errorCode === "DATA_INSUFFICIENT" &&
      insufficientDataRun.nodeRuns[1]?.status === "SKIPPED_UPSTREAM_FAILED" &&
      insufficientDataRun.result.promotable === false
        ? "PASSED"
        : "FAILED",
    expectedCode: "DATA_INSUFFICIENT",
    actualCode: insufficientDataRun.nodeRuns[0]?.errorCode || null,
    downstreamStatus: insufficientDataRun.nodeRuns[1]?.status || null,
    partialResultPromotable: insufficientDataRun.result.promotable
  },
  capture("simulation-fact-write", "NON_FACT_WRITE_REJECTED", () =>
    assertFactWriteAllowed(demo.simulationRuns[1].result)
  ),
  capture("prediction-fact-write", "NON_FACT_WRITE_REJECTED", () =>
    assertFactWriteAllowed(demo.prediction)
  ),
  capture("objective-binding-unit-drift", "BINDING_FIELD_MISMATCH", () =>
    validateObjectiveBinding({ objectiveId: forecastObjective.objectiveId, binding: badObjectiveBinding })
  )
];

const evidence = {
  schema: "ofw.m08.research.validation-evidence.v1",
  namespace: fixture.namespace,
  generatedAt: new Date().toISOString(),
  fixtureId: fixture.fixtureId,
  fixtureHash: sha256(fixture),
  sourceBusinessValuesCopied: false,
  baseline: {
    baselineCommit: "f3c80ba5e5e70929fd0628c798c4878048924bbd",
    governanceBaselineVersion: "v1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    productBaselineStatus: "NOT_FROZEN",
    rebaseRequired: true,
    acceptanceReady: false
  },
  positiveChecks: {
    candidateCount: demo.candidateComparison.ranking.length,
    fixedFairComparisonFingerprint:
      demo.candidateComparison.fairComparisonFingerprint,
    humanReviewStatus: demo.humanReview.status,
    releaseCandidateStatus: demo.releaseCandidate.status,
    published: demo.releaseCandidate.published,
    t019WriteAllowed: demo.releaseCandidate.t019WriteAllowed,
    concreteEndpointExposed: demo.consumerBinding.concreteEndpointExposed,
    singleModelSimulationStatus: demo.simulationRuns[0].status,
    compositeSimulationStatus: demo.simulationRuns[1].status,
    resultKinds: demo.threeStateComparison.columns.map((item) => item.resultKind),
    overwriteAllowed: demo.threeStateComparison.overwriteAllowed,
    sideEffectAttempts: demo.simulationRuns.reduce(
      (sum, run) => sum + run.sideEffectAudit.attempted,
      0
    ),
    sideEffectsEmitted: demo.simulationRuns.reduce(
      (sum, run) => sum + run.sideEffectAudit.emitted,
      0
    ),
    objectiveKinds: [...new Set(objectiveCatalog.map((item) => item.kind))].sort(),
    objectiveCount: objectiveCatalog.length,
    forecastConsumerDisplayMode: m07Projection.displayMode,
    optimizationResultKind: optimizationProjection.result.resultKind,
    m04ConsumerStatus: m04Projection.status,
    m04ConsumerCode: m04Projection.code
  },
  failurePropagation: {
    runStatus: failureRun.status,
    nodeStatuses: failureRun.nodeRuns.map((item) => ({
      nodeId: item.nodeId,
      status: item.status,
      errorCode: item.errorCode || null
    })),
    partialResultPromotable: failureRun.result.promotable
  },
  negativeChecks,
  overallStatus:
    negativeChecks.every((item) => item.status === "PASSED") &&
    demo.simulationRuns.every((run) => run.status === "SUCCEEDED") &&
    failureRun.status === "FAILED" &&
    objectiveCatalog.length === 4 &&
    m07Projection.displayMode === "TIMELINE_OVERLAY" &&
    optimizationProjection.result.resultKind === "SIMULATION" &&
    m04Projection.code === "NON_FACT_SOURCE_REJECTED"
      ? "PASSED"
      : "FAILED",
  conclusionBoundary:
    "Internal deterministic validation only; not user approval, M08 initiation, production readiness or phase-one acceptance."
};

await mkdir(new URL("../evidence/", import.meta.url), { recursive: true });
await writeFile(evidenceUrl, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
process.stdout.write(`${evidence.overallStatus} ${evidenceUrl.pathname}\n`);
