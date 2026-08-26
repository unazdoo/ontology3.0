import test from "node:test";
import assert from "node:assert/strict";
import { loadFixture } from "../src/fixture.mjs";
import {
  bindReleaseCandidate,
  compareCandidates,
  createPredictionResult,
  createReleaseCandidate,
  decideHumanReview,
  projectBindingForConsumer,
  requestHumanReview,
  scoreCandidate
} from "../src/model-governance.mjs";

test("candidate comparison fixes the same objective and exact evaluation transaction", async () => {
  const fixture = await loadFixture();
  const comparison = compareCandidates(fixture);
  assert.equal(comparison.ranking.length, 3);
  assert.equal(
    comparison.fixedContext.evaluationTransactionId,
    fixture.objective.evaluationTransactionId
  );
  assert.equal(comparison.fixedContext.evaluatorVersion, fixture.objective.evaluatorVersion);
  assert.equal(comparison.businessBestModelSelected, false);
  assert.equal(comparison.claimScope, "ENGINEERING_FITNESS_ONLY");
});

test("comparison is deterministic and the legacy reweight candidate is penalized", async () => {
  const fixture = await loadFixture();
  const first = compareCandidates(fixture);
  const second = compareCandidates(fixture);
  assert.deepEqual(first, second);
  assert.equal(first.topCandidateId, "CM-S005-BALANCED-v1");
  const legacy = first.ranking.find(
    (item) => item.candidateId === "CM-S005-LEGACY-REWEIGHT-v1"
  );
  assert.deepEqual(legacy.violations, ["MISSING_DIMENSION_REWEIGHT_FORBIDDEN"]);
});

test("strict candidate blocks an applicable missing feature without reallocating weights", async () => {
  const fixture = await loadFixture();
  const candidate = fixture.candidates[0];
  const result = scoreCandidate(candidate, {
    returnRatio: 0.03,
    concentrationRatio: 0.3,
    ratingScore: 4.1
  });
  assert.equal(result.status, "DATA_INSUFFICIENT");
  assert.equal(result.score, null);
  assert.deepEqual(result.missingFeatures, ["liquidity"]);
});

test("candidate trace records model, data, feature, evaluator, author and environment versions", async () => {
  const fixture = await loadFixture();
  const comparison = compareCandidates(fixture);
  const experiment = comparison.experiments[0];
  assert.match(experiment.experimentId, /^EXP-/);
  assert.equal(experiment.authorId, fixture.candidates[0].modelVersion.authorId);
  assert.equal(experiment.environment, fixture.candidates[0].modelVersion.environment);
  assert.deepEqual(experiment.lineage, {
    trainingDataVersionId: fixture.objective.trainingDataVersionId,
    evaluationDataVersionId: fixture.objective.evaluationDataVersionId,
    evaluationTransactionId: fixture.objective.evaluationTransactionId,
    featureSchemaVersion: fixture.objective.featureSchemaVersion,
    metricSchemaVersion: fixture.objective.metricSchemaVersion,
    evaluatorVersion: fixture.objective.evaluatorVersion
  });
});

test("release candidate is blocked until a human approves the exact model version", async () => {
  const fixture = await loadFixture();
  const comparison = compareCandidates(fixture);
  const candidate = fixture.candidates.find(
    (item) => item.candidateId === comparison.topCandidateId
  );
  const pending = requestHumanReview(comparison, candidate.candidateId);
  assert.throws(
    () => createReleaseCandidate({ review: pending, candidate }),
    (error) => error.code === "HUMAN_APPROVAL_REQUIRED"
  );
  const approved = decideHumanReview(pending, {
    decision: "APPROVED",
    reviewerId: "reviewer-001",
    rationale: "Research candidate only"
  });
  const release = createReleaseCandidate({ review: approved, candidate });
  assert.equal(release.status, "RESEARCH_RELEASE_CANDIDATE");
  assert.equal(release.published, false);
  assert.equal(release.productionEligible, false);
  assert.equal(release.t019WriteAllowed, false);
});

test("rejected review cannot form a release candidate", async () => {
  const fixture = await loadFixture();
  const comparison = compareCandidates(fixture);
  const candidate = fixture.candidates[0];
  const rejected = decideHumanReview(
    requestHumanReview(comparison, candidate.candidateId),
    {
      decision: "REJECTED",
      reviewerId: "reviewer-001",
      rationale: "Rejected"
    }
  );
  assert.throws(
    () => createReleaseCandidate({ review: rejected, candidate }),
    (error) => error.code === "HUMAN_APPROVAL_REQUIRED"
  );
});

test("consumer binding exposes a stable release selector and no concrete endpoint", async () => {
  const fixture = await loadFixture();
  const comparison = compareCandidates(fixture);
  const candidate = fixture.candidates[0];
  const review = decideHumanReview(
    requestHumanReview(comparison, candidate.candidateId),
    {
      decision: "APPROVED",
      reviewerId: "reviewer-001",
      rationale: "Research only"
    }
  );
  const releaseCandidate = createReleaseCandidate({ review, candidate });
  const projection = projectBindingForConsumer(
    bindReleaseCandidate({
      bindingDraft: fixture.ontologyBindingDraft,
      releaseCandidate
    })
  );
  assert.equal(projection.releaseSelector.modelVersionId, review.modelVersionId);
  assert.equal(projection.concreteEndpointExposed, false);
  assert.equal(projection.t019WriteAllowed, false);
  assert.doesNotMatch(JSON.stringify(projection), /https?:\/\//i);
  assert.doesNotMatch(JSON.stringify(projection), /credential|secret|token/i);
});

test("binding contract rejects accidental endpoint fields", async () => {
  const fixture = await loadFixture();
  const comparison = compareCandidates(fixture);
  const candidate = fixture.candidates[0];
  const review = decideHumanReview(
    requestHumanReview(comparison, candidate.candidateId),
    {
      decision: "APPROVED",
      reviewerId: "reviewer-001",
      rationale: "Research only"
    }
  );
  const releaseCandidate = createReleaseCandidate({ review, candidate });
  const badBinding = {
    ...fixture.ontologyBindingDraft,
    concreteEndpoint: "https://example.invalid/model"
  };
  assert.throws(
    () => bindReleaseCandidate({ bindingDraft: badBinding, releaseCandidate }),
    (error) => error.code === "CONCRETE_ENDPOINT_EXPOSED"
  );
});

test("prediction results retain a separate identity and cannot claim fact status", async () => {
  const fixture = await loadFixture();
  const prediction = createPredictionResult({
    candidate: fixture.candidates[0],
    features: fixture.evaluationSamples[0].features,
    dataVersionId: fixture.objective.evaluationDataVersionId,
    asOf: "2026-06-30"
  });
  assert.equal(prediction.resultKind, "PREDICTION");
  assert.equal(prediction.factWriteAllowed, false);
  assert.match(prediction.resultId, /^PRED-/);
});
