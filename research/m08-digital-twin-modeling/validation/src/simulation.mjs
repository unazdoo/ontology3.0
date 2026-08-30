import {
  FORBIDDEN_CAPABILITIES,
  NAMESPACE,
  RESULT_KINDS,
  SIMULATION_CAPABILITIES
} from "./constants.mjs";
import { assertContract, ContractError } from "./errors.mjs";
import { sha256 } from "./hash.mjs";

const PARAMETER_BOUNDS = Object.freeze({
  interestRateBps: [-300, 500],
  creditSpreadBps: [-200, 1000],
  ratingNotches: [-3, 0],
  liquidityHaircutPct: [0, 30],
  redemptionPct: [0, 50]
});

const BASELINE_PORT = Object.freeze({
  type: "PortfolioSnapshot",
  unit: "CNY",
  timeGrain: "AS_OF"
});
const PARAMETER_PORT = Object.freeze({
  type: "SimulationParameterSet",
  unit: "SCENARIO_PARAMETERS",
  timeGrain: "AS_OF"
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function requireFinite(value, field, context = {}) {
  if (!Number.isFinite(value)) {
    throw new ContractError("DATA_INSUFFICIENT", `${field} must be a finite number.`, {
      field,
      ...context
    });
  }
}

export function validateParameters(parameters) {
  const unknown = Object.keys(parameters).filter((name) => !(name in PARAMETER_BOUNDS));
  assertContract(
    unknown.length === 0,
    "UNKNOWN_SIMULATION_PARAMETER",
    "Simulation parameters contain unsupported fields.",
    { unknown }
  );

  for (const [name, [minimum, maximum]] of Object.entries(PARAMETER_BOUNDS)) {
    const value = parameters[name];
    assertContract(
      Number.isFinite(value),
      "SIMULATION_PARAMETER_REQUIRED",
      `Simulation parameter ${name} must be finite.`,
      { name, value }
    );
    assertContract(
      value >= minimum && value <= maximum,
      "PARAMETER_OUT_OF_RANGE",
      `Simulation parameter ${name} is outside the research bounds.`,
      { name, value, minimum, maximum }
    );
  }
  return true;
}

function runMarketShock({ portfolio, parameters }) {
  validateParameters(parameters);
  assertContract(
    portfolio?.immutable === true && Array.isArray(portfolio.holdings),
    "BASELINE_INVALID",
    "Market shock requires an immutable portfolio baseline."
  );
  assertContract(
    portfolio.holdings.length > 0,
    "DATA_INSUFFICIENT",
    "Portfolio baseline contains no holdings."
  );

  const holdings = portfolio.holdings.map((holding) => {
    for (const field of [
      "investmentAmountCny",
      "currentMarketValueCny",
      "durationYears",
      "spreadDurationYears",
      "ratingScore",
      "liquidityScore",
      "redemptionSensitivity"
    ]) {
      requireFinite(holding[field], field, { holdingId: holding.holdingId });
    }

    const rateImpact = -holding.durationYears * (parameters.interestRateBps / 10000);
    const spreadImpact =
      -holding.spreadDurationYears * (parameters.creditSpreadBps / 10000);
    const ratingImpact = parameters.ratingNotches * 0.015;
    const liquidityImpact =
      -(parameters.liquidityHaircutPct / 100) * (1.1 - holding.liquidityScore);
    const redemptionImpact =
      -(parameters.redemptionPct / 100) * holding.redemptionSensitivity * 0.05;
    const totalImpact = rateImpact + spreadImpact + ratingImpact + liquidityImpact + redemptionImpact;
    const shockedMarketValueCny = Math.max(
      0,
      holding.currentMarketValueCny * (1 + totalImpact)
    );

    return {
      ...structuredClone(holding),
      shockedMarketValueCny: round(shockedMarketValueCny, 2),
      valueImpactCny: round(shockedMarketValueCny - holding.currentMarketValueCny, 2),
      totalImpactRatio: round(totalImpact),
      simulatedRatingScore: clamp(holding.ratingScore + parameters.ratingNotches, 0, 5),
      simulatedLiquidityScore: round(
        clamp(
          holding.liquidityScore -
            parameters.liquidityHaircutPct / 100 -
            (parameters.redemptionPct / 100) * holding.redemptionSensitivity,
          0,
          1
        )
      )
    };
  });

  return {
    portfolio: {
      resourceKind: "SimulatedPortfolio",
      baselineId: portfolio.baselineId,
      resultKind: RESULT_KINDS.SIMULATION,
      asOf: portfolio.asOf,
      holdings
    }
  };
}

export function derivePortfolioFeatures(portfolio) {
  assertContract(
    Array.isArray(portfolio?.holdings) && portfolio.holdings.length > 0,
    "DATA_INSUFFICIENT",
    "Portfolio features require at least one holding."
  );
  const values = portfolio.holdings.map((holding) => {
    const marketValue = Number.isFinite(holding.shockedMarketValueCny)
      ? holding.shockedMarketValueCny
      : holding.currentMarketValueCny;
    requireFinite(marketValue, "marketValue", { holdingId: holding.holdingId });
    requireFinite(holding.investmentAmountCny, "investmentAmountCny", {
      holdingId: holding.holdingId
    });
    const liquidity = Number.isFinite(holding.simulatedLiquidityScore)
      ? holding.simulatedLiquidityScore
      : holding.liquidityScore;
    const rating = Number.isFinite(holding.simulatedRatingScore)
      ? holding.simulatedRatingScore
      : holding.ratingScore;
    requireFinite(liquidity, "liquidityScore", { holdingId: holding.holdingId });
    requireFinite(rating, "ratingScore", { holdingId: holding.holdingId });
    return {
      marketValue,
      investmentAmount: holding.investmentAmountCny,
      liquidity,
      rating
    };
  });

  const totalMarketValue = values.reduce((sum, item) => sum + item.marketValue, 0);
  const totalInvestment = values.reduce((sum, item) => sum + item.investmentAmount, 0);
  assertContract(
    totalMarketValue > 0 && totalInvestment > 0,
    "DATA_INSUFFICIENT",
    "Portfolio totals must be positive."
  );
  return {
    returnRatio: round((totalMarketValue - totalInvestment) / totalInvestment),
    concentrationRatio: round(
      Math.max(...values.map((item) => item.marketValue)) / totalMarketValue
    ),
    liquidityScore: round(
      values.reduce((sum, item) => sum + item.liquidity * item.marketValue, 0) /
        totalMarketValue
    ),
    ratingScore: round(
      values.reduce((sum, item) => sum + item.rating * item.marketValue, 0) /
        totalMarketValue
    )
  };
}

function runSimulationEvaluation({ portfolio }) {
  const features = derivePortfolioFeatures(portfolio);
  const returnQuality = clamp((features.returnRatio + 0.05) / 0.15, 0, 1);
  const diversification = clamp(1 - features.concentrationRatio, 0, 1);
  const score =
    returnQuality * 0.3 +
    diversification * 0.25 +
    features.liquidityScore * 0.2 +
    (features.ratingScore / 5) * 0.25;
  return {
    evaluation: {
      resourceKind: "SimulatedEvaluation",
      resultKind: RESULT_KINDS.SIMULATION,
      score: round(clamp(score * 100, 0, 100), 4),
      coverage: 1,
      features
    }
  };
}

export function createModelRegistry(overrides = {}) {
  const marketOutput = {
    type: overrides.marketOutputType || "PortfolioSnapshot",
    unit: overrides.marketOutputUnit || "CNY",
    timeGrain: overrides.marketOutputTimeGrain || "AS_OF"
  };
  const evaluationInput = {
    type: overrides.evaluationInputType || "PortfolioSnapshot",
    unit: overrides.evaluationInputUnit || "CNY",
    timeGrain: overrides.evaluationInputTimeGrain || "AS_OF"
  };
  return new Map([
    [
      "MV-SIM-MARKET-SHOCK-0001",
      {
        modelVersionId: "MV-SIM-MARKET-SHOCK-0001",
        immutable: true,
        inputPorts: {
          portfolio: BASELINE_PORT,
          parameters: PARAMETER_PORT
        },
        outputPorts: {
          portfolio: marketOutput
        },
        sideEffects: [],
        run: runMarketShock
      }
    ],
    [
      "MV-SIM-EVALUATION-0001",
      {
        modelVersionId: "MV-SIM-EVALUATION-0001",
        immutable: true,
        inputPorts: {
          portfolio: evaluationInput
        },
        outputPorts: {
          evaluation: {
            type: "EvaluationResult",
            unit: "score_0_100",
            timeGrain: "AS_OF"
          }
        },
        sideEffects: [],
        run: runSimulationEvaluation
      }
    ],
    [
      "MV-SIM-FAIL-0001",
      {
        modelVersionId: "MV-SIM-FAIL-0001",
        immutable: true,
        inputPorts: {
          portfolio: BASELINE_PORT
        },
        outputPorts: {
          portfolio: BASELINE_PORT
        },
        sideEffects: [],
        run() {
          throw new ContractError("FORCED_MODEL_FAILURE", "Forced failure fixture.");
        }
      }
    ]
  ]);
}

function sourcePortSpec(binding, nodeById, registry) {
  if (binding.source === "baseline") {
    assertContract(
      binding.port === "portfolio",
      "BASELINE_PORT_UNKNOWN",
      "Only the immutable portfolio baseline is exposed to models."
    );
    return BASELINE_PORT;
  }
  if (binding.source === "parameterSet") {
    assertContract(
      binding.port === "parameters",
      "PARAMETER_PORT_UNKNOWN",
      "Only the validated parameter set is exposed to models."
    );
    return PARAMETER_PORT;
  }
  assertContract(
    binding.source === "node",
    "INPUT_SOURCE_INVALID",
    "Model input source is not supported.",
    { binding }
  );
  const sourceNode = nodeById.get(binding.nodeId);
  assertContract(
    sourceNode,
    "DEPENDENCY_NOT_FOUND",
    "Model input references a missing dependency node.",
    { nodeId: binding.nodeId }
  );
  const sourceModel = registry.get(sourceNode.modelVersionId);
  const spec = sourceModel?.outputPorts[binding.port];
  assertContract(
    spec,
    "DEPENDENCY_PORT_NOT_FOUND",
    "Model input references a missing dependency output port.",
    { nodeId: binding.nodeId, port: binding.port }
  );
  return spec;
}

function comparePortSpecs(source, target, details) {
  assertContract(
    source.type === target.type,
    "MODEL_INCOMPATIBLE_TYPE",
    "Composite model ports have incompatible types.",
    { ...details, source, target }
  );
  assertContract(
    source.unit === target.unit,
    "UNIT_MISMATCH",
    "Composite model ports have incompatible units.",
    { ...details, source, target }
  );
  assertContract(
    source.timeGrain === target.timeGrain,
    "TIME_GRAIN_MISMATCH",
    "Composite model ports have incompatible time grains.",
    { ...details, source, target }
  );
}

export function validateModelGraph(graph, registry = createModelRegistry()) {
  assertContract(
    Array.isArray(graph.nodes) && graph.nodes.length > 0,
    "GRAPH_EMPTY",
    "A simulation graph requires at least one model node."
  );
  const nodeById = new Map();
  for (const node of graph.nodes) {
    assertContract(
      !nodeById.has(node.nodeId),
      "DUPLICATE_NODE_ID",
      "Composite model node IDs must be unique.",
      { nodeId: node.nodeId }
    );
    nodeById.set(node.nodeId, node);
    const model = registry.get(node.modelVersionId);
    assertContract(
      model,
      "MODEL_VERSION_NOT_FOUND",
      "Composite graph references an unknown model version.",
      { modelVersionId: node.modelVersionId }
    );
    assertContract(
      model.immutable === true,
      "MODEL_VERSION_MUTABLE",
      "Simulation requires immutable model versions.",
      { modelVersionId: node.modelVersionId }
    );
    assertContract(
      Array.isArray(model.sideEffects) && model.sideEffects.length === 0,
      "FORBIDDEN_MODEL_SIDE_EFFECT",
      "Simulation models must declare zero side effects.",
      { modelVersionId: node.modelVersionId, sideEffects: model.sideEffects }
    );
  }

  const dependencies = new Map(graph.nodes.map((node) => [node.nodeId, new Set()]));
  const dependents = new Map(graph.nodes.map((node) => [node.nodeId, new Set()]));
  for (const node of graph.nodes) {
    const model = registry.get(node.modelVersionId);
    const expectedInputs = Object.keys(model.inputPorts).sort();
    const actualInputs = Object.keys(node.inputs || {}).sort();
    assertContract(
      JSON.stringify(expectedInputs) === JSON.stringify(actualInputs),
      "MODEL_INPUT_BINDING_MISMATCH",
      "Graph node bindings do not match the model input contract.",
      { nodeId: node.nodeId, expectedInputs, actualInputs }
    );
    for (const [inputName, binding] of Object.entries(node.inputs)) {
      const sourceSpec = sourcePortSpec(binding, nodeById, registry);
      comparePortSpecs(sourceSpec, model.inputPorts[inputName], {
        nodeId: node.nodeId,
        inputName
      });
      if (binding.source === "node") {
        dependencies.get(node.nodeId).add(binding.nodeId);
        dependents.get(binding.nodeId).add(node.nodeId);
      }
    }
  }

  const queue = [...dependencies.entries()]
    .filter(([, items]) => items.size === 0)
    .map(([nodeId]) => nodeId)
    .sort();
  const executionOrder = [];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    executionOrder.push(nodeId);
    for (const dependentId of [...dependents.get(nodeId)].sort()) {
      dependencies.get(dependentId).delete(nodeId);
      if (dependencies.get(dependentId).size === 0) {
        queue.push(dependentId);
        queue.sort();
      }
    }
  }
  assertContract(
    executionOrder.length === graph.nodes.length,
    "CYCLE_DETECTED",
    "Composite model graph contains a dependency cycle."
  );

  for (const [outputName, output] of Object.entries(graph.outputs || {})) {
    const node = nodeById.get(output.nodeId);
    assertContract(
      node,
      "GRAPH_OUTPUT_NODE_NOT_FOUND",
      "Graph output references a missing node.",
      { outputName, nodeId: output.nodeId }
    );
    const model = registry.get(node.modelVersionId);
    assertContract(
      model.outputPorts[output.port],
      "GRAPH_OUTPUT_PORT_NOT_FOUND",
      "Graph output references a missing model port.",
      { outputName, port: output.port }
    );
  }

  return {
    graphId: graph.graphId,
    executionOrder,
    valid: true
  };
}

function resolveInput(binding, baseline, parameterSet, nodeOutputs, nodeStatuses) {
  if (binding.source === "baseline") return structuredClone(baseline);
  if (binding.source === "parameterSet") return structuredClone(parameterSet.parameters);
  if (nodeStatuses.get(binding.nodeId) !== "SUCCEEDED") return undefined;
  return structuredClone(nodeOutputs.get(binding.nodeId)[binding.port]);
}

export function runSimulation({
  simulationCase,
  baseline,
  parameterSet,
  graph,
  registry = createModelRegistry(),
  runNonce = null
}) {
  assertContract(
    simulationCase.baselineId === baseline.baselineId,
    "CASE_BASELINE_MISMATCH",
    "Simulation case references a different baseline."
  );
  assertContract(
    simulationCase.parameterSetId === parameterSet.parameterSetId,
    "CASE_PARAMETER_SET_MISMATCH",
    "Simulation case references a different parameter set."
  );
  assertContract(
    simulationCase.graphId === graph.graphId,
    "CASE_GRAPH_MISMATCH",
    "Simulation case references a different model graph."
  );
  assertContract(
    baseline.immutable === true,
    "BASELINE_MUTABLE",
    "Simulation baseline must be immutable."
  );
  validateParameters(parameterSet.parameters);
  const validation = validateModelGraph(graph, registry);
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const nodeOutputs = new Map();
  const nodeStatuses = new Map();
  const nodeRuns = [];

  for (const nodeId of validation.executionOrder) {
    const node = nodeById.get(nodeId);
    const model = registry.get(node.modelVersionId);
    const hasFailedDependency = Object.values(node.inputs).some(
      (binding) =>
        binding.source === "node" && nodeStatuses.get(binding.nodeId) !== "SUCCEEDED"
    );
    if (hasFailedDependency) {
      nodeStatuses.set(nodeId, "SKIPPED_UPSTREAM_FAILED");
      nodeRuns.push({
        nodeId,
        modelVersionId: node.modelVersionId,
        status: "SKIPPED_UPSTREAM_FAILED",
        errorCode: "UPSTREAM_FAILED"
      });
      continue;
    }

    const inputs = Object.fromEntries(
      Object.entries(node.inputs).map(([inputName, binding]) => [
        inputName,
        resolveInput(binding, baseline, parameterSet, nodeOutputs, nodeStatuses)
      ])
    );
    try {
      const output = model.run(inputs);
      nodeOutputs.set(nodeId, output);
      nodeStatuses.set(nodeId, "SUCCEEDED");
      nodeRuns.push({
        nodeId,
        modelVersionId: node.modelVersionId,
        status: "SUCCEEDED",
        outputHash: sha256(output)
      });
    } catch (error) {
      nodeStatuses.set(nodeId, "FAILED");
      nodeRuns.push({
        nodeId,
        modelVersionId: node.modelVersionId,
        status: "FAILED",
        errorCode: error.code || "MODEL_EXECUTION_FAILED",
        errorMessage: error.message
      });
    }
  }

  const status = nodeRuns.every((run) => run.status === "SUCCEEDED")
    ? "SUCCEEDED"
    : "FAILED";
  const outputs = {};
  for (const [name, outputRef] of Object.entries(graph.outputs || {})) {
    if (nodeStatuses.get(outputRef.nodeId) === "SUCCEEDED") {
      outputs[name] = structuredClone(nodeOutputs.get(outputRef.nodeId)[outputRef.port]);
    }
  }
  const identityHash = sha256({
    runNonce,
    caseId: simulationCase.caseId,
    baselineId: baseline.baselineId,
    parameterSetId: parameterSet.parameterSetId,
    graphId: graph.graphId,
    modelVersions: graph.nodes.map((node) => node.modelVersionId)
  });

  return {
    resourceKind: "SimulationRun",
    namespace: NAMESPACE,
    simulationRunId: `SIMRUN-${identityHash.slice(0, 20)}`,
    researchRunId: runNonce || `M08RUN-${identityHash.slice(0, 16)}`,
    caseId: simulationCase.caseId,
    baselineId: baseline.baselineId,
    parameterSetId: parameterSet.parameterSetId,
    graphId: graph.graphId,
    resultKind: RESULT_KINDS.SIMULATION,
    status,
    nodeRuns,
    result: {
      resourceKind: "SimulationResult",
      simulationResultId: `SIMRES-${identityHash.slice(0, 20)}`,
      resultKind: RESULT_KINDS.SIMULATION,
      permissionScope: "simulation.read",
      sourceFactSnapshotRef: baseline.sourceSnapshotRef,
      asOf: baseline.asOf,
      outputs,
      promotable: status === "SUCCEEDED",
      factWriteAllowed: false,
      actionWriteAllowed: false
    },
    sideEffectAudit: {
      capabilities: structuredClone(SIMULATION_CAPABILITIES),
      attempted: 0,
      emitted: 0,
      forbiddenCapabilityCount: FORBIDDEN_CAPABILITIES.length
    }
  };
}

export function assertFactWriteAllowed(result) {
  assertContract(
    result.resultKind === RESULT_KINDS.FACT,
    "NON_FACT_WRITE_REJECTED",
    "Prediction and simulation results cannot write to the fact store.",
    { resultKind: result.resultKind }
  );
  return true;
}

export function compareThreeStates({ fact, prediction, simulation }) {
  assertContract(
    fact.resultKind === RESULT_KINDS.FACT &&
      prediction.resultKind === RESULT_KINDS.PREDICTION &&
      simulation.resultKind === RESULT_KINDS.SIMULATION,
    "THREE_STATE_KIND_MISMATCH",
    "Three-state comparison requires FACT, PREDICTION and SIMULATION identities."
  );
  const simulatedScore = simulation.outputs?.simulatedEvaluation?.score ?? null;
  return {
    resourceKind: "ResultComparison",
    namespace: NAMESPACE,
    comparisonId: `STATECMP-${sha256([
      fact.resultId,
      prediction.resultId,
      simulation.simulationResultId
    ]).slice(0, 16)}`,
    overwriteAllowed: false,
    columns: [
      {
        resultKind: RESULT_KINDS.FACT,
        resultId: fact.resultId,
        score: fact.score,
        permissionScope: fact.permissionScope,
        visualSemantic: "OBSERVED_SOLID"
      },
      {
        resultKind: RESULT_KINDS.PREDICTION,
        resultId: prediction.resultId,
        score: prediction.score,
        permissionScope: prediction.permissionScope,
        visualSemantic: "PREDICTED_DASHED"
      },
      {
        resultKind: RESULT_KINDS.SIMULATION,
        resultId: simulation.simulationResultId,
        score: simulatedScore,
        permissionScope: simulation.permissionScope,
        visualSemantic: "SIMULATED_HATCHED"
      }
    ]
  };
}
