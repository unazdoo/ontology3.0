import { NAMESPACE, RESULT_KINDS } from "./constants.mjs";
import { assertContract, ContractError } from "./errors.mjs";
import { canonicalJson, sha256 } from "./hash.mjs";

const FEATURE_ORDER = Object.freeze([
  "returnQuality",
  "diversification",
  "liquidity",
  "creditQuality"
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizedFeatures(features) {
  return {
    returnQuality: Number.isFinite(features.returnRatio)
      ? clamp((features.returnRatio + 0.05) / 0.15, 0, 1)
      : undefined,
    diversification: Number.isFinite(features.concentrationRatio)
      ? clamp(1 - features.concentrationRatio, 0, 1)
      : undefined,
    liquidity: Number.isFinite(features.liquidityScore)
      ? clamp(features.liquidityScore, 0, 1)
      : undefined,
    creditQuality: Number.isFinite(features.ratingScore)
      ? clamp(features.ratingScore / 5, 0, 1)
      : undefined
  };
}

function validateCandidate(candidate, objective) {
  assertContract(
    candidate.objectiveId === objective.objectiveId,
    "OBJECTIVE_MISMATCH",
    "Candidate is not attached to the requested modeling objective.",
    { candidateId: candidate.candidateId }
  );
  assertContract(
    candidate.modelVersion?.immutable === true,
    "MODEL_VERSION_MUTABLE",
    "Candidate comparison requires an immutable model version.",
    { candidateId: candidate.candidateId }
  );
  assertContract(
    candidate.modelVersion.trainingDataVersionId === objective.trainingDataVersionId,
    "TRAINING_DATA_VERSION_MISMATCH",
    "Candidate was not trained against the fixed training data version.",
    { candidateId: candidate.candidateId }
  );
  assertContract(
    candidate.modelVersion.featureSchemaVersion === objective.featureSchemaVersion,
    "FEATURE_SCHEMA_MISMATCH",
    "Candidate feature schema differs from the objective comparison schema.",
    { candidateId: candidate.candidateId }
  );

  const weightKeys = Object.keys(candidate.weights).sort();
  assertContract(
    canonicalJson(weightKeys) === canonicalJson([...FEATURE_ORDER].sort()),
    "WEIGHT_SCHEMA_INVALID",
    "Candidate weights do not cover the fixed feature schema.",
    { candidateId: candidate.candidateId, weightKeys }
  );
  const weightSum = Object.values(candidate.weights).reduce((sum, value) => sum + value, 0);
  assertContract(
    Math.abs(weightSum - 1) < 1e-9,
    "WEIGHTS_NOT_NORMALIZED",
    "Candidate weights must sum to one.",
    { candidateId: candidate.candidateId, weightSum }
  );
}

export function scoreCandidate(candidate, rawFeatures) {
  const features = normalizedFeatures(rawFeatures);
  const missing = FEATURE_ORDER.filter((name) => features[name] === undefined);
  const coverage = round((FEATURE_ORDER.length - missing.length) / FEATURE_ORDER.length);

  if (missing.length > 0 && candidate.missingPolicy === "BLOCK") {
    return {
      status: "DATA_INSUFFICIENT",
      score: null,
      coverage,
      missingFeatures: missing,
      reasonCode: "MISSING_APPLICABLE_DIMENSION"
    };
  }

  const available = FEATURE_ORDER.filter((name) => features[name] !== undefined);
  const availableWeight = available.reduce((sum, name) => sum + candidate.weights[name], 0);
  assertContract(
    availableWeight > 0,
    "DATA_INSUFFICIENT",
    "No candidate features are available for evaluation."
  );
  const denominator = candidate.missingPolicy === "REWEIGHT" ? availableWeight : 1;
  const score = available.reduce(
    (sum, name) => sum + (features[name] * candidate.weights[name]) / denominator,
    0
  );

  return {
    status: missing.length > 0 ? "DEGRADED_RESEARCH_ONLY" : "SUCCEEDED",
    score: round(clamp(score * 100, 0, 100), 4),
    coverage,
    missingFeatures: missing,
    reasonCode: missing.length > 0 ? "MISSING_DIMENSION_REWEIGHTED" : null
  };
}

function mean(values) {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length === 0) return null;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

export function evaluateCandidate({ objective, candidate, evaluationSamples, monotonicityPairs }) {
  validateCandidate(candidate, objective);
  const firstPass = evaluationSamples.map((sample) => ({
    sampleId: sample.sampleId,
    ...scoreCandidate(candidate, sample.features)
  }));
  const secondPass = evaluationSamples.map((sample) => ({
    sampleId: sample.sampleId,
    ...scoreCandidate(candidate, sample.features)
  }));
  const succeeded = firstPass.filter((result) => Number.isFinite(result.score));
  const monotonicity = monotonicityPairs.map((pair) => {
    const better = scoreCandidate(candidate, pair.better);
    const worse = scoreCandidate(candidate, pair.worse);
    return {
      pairId: pair.pairId,
      passed:
        Number.isFinite(better.score) &&
        Number.isFinite(worse.score) &&
        better.score >= worse.score,
      betterScore: better.score,
      worseScore: worse.score
    };
  });
  const violations = [];
  if (candidate.missingPolicy === "REWEIGHT") {
    violations.push("MISSING_DIMENSION_REWEIGHT_FORBIDDEN");
  }
  if (succeeded.some((result) => result.score < 0 || result.score > 100)) {
    violations.push("SCORE_OUT_OF_RANGE");
  }
  if (canonicalJson(firstPass) !== canonicalJson(secondPass)) {
    violations.push("NON_DETERMINISTIC_OUTPUT");
  }

  const scores = succeeded.map((result) => result.score);
  return {
    resourceKind: "Experiment",
    namespace: NAMESPACE,
    experimentId: `EXP-${candidate.candidateId}-${objective.evaluationTransactionId}`,
    objectiveId: objective.objectiveId,
    candidateId: candidate.candidateId,
    modelVersionId: candidate.modelVersion.modelVersionId,
    status: "SUCCEEDED",
    authorId: candidate.modelVersion.authorId,
    environment: candidate.modelVersion.environment,
    lineage: {
      trainingDataVersionId: objective.trainingDataVersionId,
      evaluationDataVersionId: objective.evaluationDataVersionId,
      evaluationTransactionId: objective.evaluationTransactionId,
      featureSchemaVersion: objective.featureSchemaVersion,
      metricSchemaVersion: objective.metricSchemaVersion,
      evaluatorVersion: objective.evaluatorVersion
    },
    metrics: {
      coverageRate: round(succeeded.length / evaluationSamples.length),
      repeatabilityRate: canonicalJson(firstPass) === canonicalJson(secondPass) ? 1 : 0,
      boundednessRate: round(
        succeeded.filter((result) => result.score >= 0 && result.score <= 100).length /
          Math.max(1, succeeded.length)
      ),
      monotonicityRate: round(
        monotonicity.filter((item) => item.passed).length / Math.max(1, monotonicity.length)
      ),
      meanScore: scores.length ? round(mean(scores), 4) : null,
      scoreStdDev: scores.length ? round(standardDeviation(scores), 4) : null,
      constraintViolationCount: violations.length
    },
    violations,
    sampleResults: firstPass,
    monotonicity
  };
}

export function compareCandidates(fixture) {
  const { objective, candidates, evaluationSamples, monotonicityPairs } = fixture;
  assertContract(
    objective.businessTargetStatus === "PENDING_USER_DECISION",
    "UNEXPECTED_BUSINESS_TARGET_STATE",
    "This fixture is designed to prove engineering fitness without an approved business target."
  );
  const fingerprintInput = {
    objectiveId: objective.objectiveId,
    trainingDataVersionId: objective.trainingDataVersionId,
    evaluationDataVersionId: objective.evaluationDataVersionId,
    evaluationTransactionId: objective.evaluationTransactionId,
    featureSchemaVersion: objective.featureSchemaVersion,
    metricSchemaVersion: objective.metricSchemaVersion,
    evaluatorVersion: objective.evaluatorVersion
  };
  const fairComparisonFingerprint = sha256(fingerprintInput);
  const experiments = candidates.map((candidate) =>
    evaluateCandidate({
      objective,
      candidate,
      evaluationSamples,
      monotonicityPairs
    })
  );

  const ranking = [...experiments]
    .sort((left, right) => {
      return (
        left.metrics.constraintViolationCount - right.metrics.constraintViolationCount ||
        right.metrics.repeatabilityRate - left.metrics.repeatabilityRate ||
        right.metrics.monotonicityRate - left.metrics.monotonicityRate ||
        right.metrics.coverageRate - left.metrics.coverageRate ||
        left.candidateId.localeCompare(right.candidateId)
      );
    })
    .map((experiment, index) => ({
      rank: index + 1,
      candidateId: experiment.candidateId,
      modelVersionId: experiment.modelVersionId,
      metrics: experiment.metrics,
      violations: experiment.violations
    }));

  return {
    resourceKind: "CandidateComparison",
    namespace: NAMESPACE,
    comparisonId: `CMP-${fairComparisonFingerprint.slice(0, 16)}`,
    objectiveId: objective.objectiveId,
    claimScope: "ENGINEERING_FITNESS_ONLY",
    fairComparisonFingerprint,
    fixedContext: fingerprintInput,
    experiments,
    ranking,
    topCandidateId: ranking[0].candidateId,
    businessBestModelSelected: false
  };
}

export function requestHumanReview(comparison, candidateId) {
  const rankedCandidate = comparison.ranking.find((item) => item.candidateId === candidateId);
  assertContract(
    rankedCandidate,
    "CANDIDATE_NOT_IN_COMPARISON",
    "Review candidate must come from the fixed candidate comparison.",
    { candidateId }
  );
  return {
    resourceKind: "ModelReview",
    namespace: NAMESPACE,
    reviewId: `REVIEW-${sha256([comparison.comparisonId, candidateId]).slice(0, 16)}`,
    comparisonId: comparison.comparisonId,
    objectiveId: comparison.objectiveId,
    candidateId,
    modelVersionId: rankedCandidate.modelVersionId,
    status: "PENDING_HUMAN_REVIEW",
    decision: null,
    reviewerId: null,
    rationale: null
  };
}

export function decideHumanReview(review, { decision, reviewerId, rationale }) {
  assertContract(
    review.status === "PENDING_HUMAN_REVIEW",
    "REVIEW_NOT_PENDING",
    "Only a pending review can receive a decision."
  );
  assertContract(
    ["APPROVED", "REJECTED", "CHANGES_REQUIRED"].includes(decision),
    "REVIEW_DECISION_INVALID",
    "Review decision is not supported."
  );
  assertContract(
    typeof reviewerId === "string" && reviewerId.length > 0,
    "HUMAN_REVIEWER_REQUIRED",
    "A human reviewer identity is required."
  );
  return {
    ...structuredClone(review),
    status: decision === "APPROVED" ? "HUMAN_APPROVED" : "HUMAN_REVIEW_CLOSED",
    decision,
    reviewerId,
    rationale: rationale || ""
  };
}

export function createReleaseCandidate({ review, candidate }) {
  assertContract(
    review.status === "HUMAN_APPROVED" && review.decision === "APPROVED",
    "HUMAN_APPROVAL_REQUIRED",
    "A release candidate cannot be formed without explicit human approval."
  );
  assertContract(
    candidate.candidateId === review.candidateId &&
      candidate.modelVersion.modelVersionId === review.modelVersionId,
    "REVIEW_CANDIDATE_MISMATCH",
    "Review and candidate model version do not match."
  );
  return {
    resourceKind: "ModelReleaseCandidate",
    namespace: NAMESPACE,
    releaseCandidateId: `RC-${sha256([review.reviewId, review.modelVersionId]).slice(0, 16)}`,
    objectiveId: review.objectiveId,
    candidateId: review.candidateId,
    modelVersionId: review.modelVersionId,
    reviewId: review.reviewId,
    status: "RESEARCH_RELEASE_CANDIDATE",
    environmentTag: "RESEARCH",
    published: false,
    productionEligible: false,
    t019WriteAllowed: false
  };
}

function assertNoEndpoint(value, path = "binding") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assertContract(
      !/(endpoint|token|credential|secret|url)$/i.test(key),
      "CONCRETE_ENDPOINT_EXPOSED",
      "Consumer binding must not expose a concrete model endpoint or credential.",
      { path: `${path}.${key}` }
    );
    assertNoEndpoint(child, `${path}.${key}`);
  }
}

export function bindReleaseCandidate({ bindingDraft, releaseCandidate }) {
  assertContract(
    releaseCandidate.status === "RESEARCH_RELEASE_CANDIDATE",
    "RELEASE_CANDIDATE_REQUIRED",
    "Binding requires an approved research release candidate."
  );
  assertContract(
    bindingDraft.objectiveId === releaseCandidate.objectiveId,
    "BINDING_OBJECTIVE_MISMATCH",
    "Binding and release candidate objectives differ."
  );
  assertNoEndpoint(bindingDraft);
  return {
    ...structuredClone(bindingDraft),
    namespace: NAMESPACE,
    status: "VALIDATED_RESEARCH_BINDING_REQUIRES_M01_CR",
    releaseSelector: {
      kind: "RESEARCH_RELEASE_CANDIDATE",
      releaseCandidateId: releaseCandidate.releaseCandidateId,
      modelVersionId: releaseCandidate.modelVersionId
    },
    concreteEndpointExposed: false,
    t019WriteAllowed: false
  };
}

export function projectBindingForConsumer(binding) {
  assertNoEndpoint(binding);
  return {
    resourceKind: binding.resourceKind,
    namespace: binding.namespace,
    bindingId: binding.bindingId,
    status: binding.status,
    objectiveId: binding.objectiveId,
    publishedOntologyRef: binding.publishedOntologyRef,
    inputMappings: structuredClone(binding.inputMappings),
    outputMappings: structuredClone(binding.outputMappings),
    releaseSelector: structuredClone(binding.releaseSelector),
    concreteEndpointExposed: false,
    t019WriteAllowed: false
  };
}

export function createPredictionResult({ candidate, features, dataVersionId, asOf }) {
  const output = scoreCandidate(candidate, features);
  if (!Number.isFinite(output.score)) {
    throw new ContractError(
      "PREDICTION_DATA_INSUFFICIENT",
      "Prediction result cannot be formed from incomplete required features.",
      output
    );
  }
  return {
    resourceKind: "ModelResult",
    namespace: NAMESPACE,
    resultId: `PRED-${sha256([candidate.modelVersion.modelVersionId, dataVersionId, asOf]).slice(0, 16)}`,
    resultKind: RESULT_KINDS.PREDICTION,
    modelVersionId: candidate.modelVersion.modelVersionId,
    dataVersionId,
    asOf,
    score: output.score,
    coverage: output.coverage,
    permissionScope: "prediction.read",
    factWriteAllowed: false
  };
}
