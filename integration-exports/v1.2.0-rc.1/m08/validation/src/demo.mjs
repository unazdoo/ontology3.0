import { loadFixture } from "./fixture.mjs";
import {
  bindReleaseCandidate,
  compareCandidates,
  createPredictionResult,
  createReleaseCandidate,
  decideHumanReview,
  projectBindingForConsumer,
  requestHumanReview
} from "./model-governance.mjs";
import {
  compareThreeStates,
  createModelRegistry,
  derivePortfolioFeatures,
  runSimulation
} from "./simulation.mjs";

function byId(items, field, value) {
  const item = items.find((candidate) => candidate[field] === value);
  if (!item) throw new Error(`Fixture item not found: ${field}=${value}`);
  return item;
}

export async function buildDemo({ scenarioId = "S005", sourceContext = null } = {}) {
  const fixture = await loadFixture({ scenarioId });
  const comparison = compareCandidates(fixture);
  const candidate = byId(
    fixture.candidates,
    "candidateId",
    comparison.topCandidateId
  );
  const pendingReview = requestHumanReview(comparison, comparison.topCandidateId);
  const approvedReview = decideHumanReview(pendingReview, {
    decision: "APPROVED",
    reviewerId: "reviewer-research-001",
    rationale: "Approved only for isolated research release-candidate validation."
  });
  const releaseCandidate = createReleaseCandidate({
    review: approvedReview,
    candidate
  });
  const binding = bindReleaseCandidate({
    bindingDraft: fixture.ontologyBindingDraft,
    releaseCandidate
  });
  const registry = createModelRegistry();
  const caseRuns = fixture.simulationCases.map((simulationCase) => {
    const parameterSet = byId(
      fixture.parameterSets,
      "parameterSetId",
      simulationCase.parameterSetId
    );
    const graph = byId(fixture.modelGraphs, "graphId", simulationCase.graphId);
    return runSimulation({
      simulationCase,
      baseline: fixture.simulationBaseline,
      parameterSet,
      graph,
      registry
    });
  });
  const prediction = createPredictionResult({
    candidate,
    features: derivePortfolioFeatures(fixture.simulationBaseline),
    dataVersionId: fixture.objective.evaluationDataVersionId,
    asOf: fixture.simulationBaseline.asOf
  });
  const compositeRun = caseRuns.find(
    (run) => run.graphId === "GRAPH-COMPOSITE-v1"
  );
  const threeStateComparison = compareThreeStates({
    fact: fixture.referenceFactResult,
    prediction,
    simulation: compositeRun.result
  });

  return {
    sourceContext: sourceContext ? structuredClone(sourceContext) : null,
    fixture: {
      fixtureId: fixture.fixtureId,
      classification: fixture.classification,
      containsSourceBusinessValues: fixture.containsSourceBusinessValues,
      namespace: fixture.namespace
    },
    objective: fixture.objective,
    candidateComparison: comparison,
    humanReview: approvedReview,
    releaseCandidate,
    consumerBinding: projectBindingForConsumer(binding),
    prediction,
    simulationRuns: caseRuns,
    threeStateComparison
  };
}

export async function runFixtureCase(caseId, { scenarioId = "S005", runNonce = null, sourceContext = null } = {}) {
  const fixture = await loadFixture({ scenarioId });
  const simulationCase = byId(fixture.simulationCases, "caseId", caseId);
  const parameterSet = byId(
    fixture.parameterSets,
    "parameterSetId",
    simulationCase.parameterSetId
  );
  const graph = byId(fixture.modelGraphs, "graphId", simulationCase.graphId);
  const result = runSimulation({
    simulationCase,
    baseline: fixture.simulationBaseline,
    parameterSet,
    graph,
    registry: createModelRegistry(),
    runNonce
  });
  return { ...result, sourceContext: sourceContext ? structuredClone(sourceContext) : null };
}

export async function requestReviewForScenario({ scenarioId = "S005", candidateId, sourceContext = null } = {}) {
  const fixture = await loadFixture({ scenarioId });
  const comparison = compareCandidates(fixture);
  const selectedCandidateId = candidateId || comparison.topCandidateId;
  const review = requestHumanReview(comparison, selectedCandidateId);
  return { objective: fixture.objective, comparison, review, sourceContext: sourceContext ? structuredClone(sourceContext) : null };
}

export async function decideReviewForScenario({ scenarioId = "S005", candidateId, reviewerId, rationale, decision, sourceContext = null } = {}) {
  const fixture = await loadFixture({ scenarioId });
  const comparison = compareCandidates(fixture);
  const selectedCandidateId = candidateId || comparison.topCandidateId;
  const candidate = byId(fixture.candidates, "candidateId", selectedCandidateId);
  const pending = requestHumanReview(comparison, selectedCandidateId);
  const review = decideHumanReview(pending, {
    decision: decision || "APPROVED",
    reviewerId: reviewerId || "reviewer-native-s001",
    rationale: rationale || "Research candidate only."
  });
  const releaseCandidate = review.decision === "APPROVED"
    ? createReleaseCandidate({ review, candidate })
    : null;
  return { objective: fixture.objective, comparison, review, releaseCandidate, sourceContext: sourceContext ? structuredClone(sourceContext) : null };
}

export async function validateBindingForScenario({ scenarioId = "S005", candidateId, reviewerId, rationale, sourceContext = null } = {}) {
  const decision = await decideReviewForScenario({
    scenarioId,
    candidateId,
    reviewerId,
    rationale,
    decision: "APPROVED",
    sourceContext
  });
  const fixture = await loadFixture({ scenarioId });
  const binding = bindReleaseCandidate({
    bindingDraft: fixture.ontologyBindingDraft,
    releaseCandidate: decision.releaseCandidate
  });
  return {
    ...decision,
    binding: projectBindingForConsumer(binding),
    sourceContext: sourceContext ? structuredClone(sourceContext) : null
  };
}
