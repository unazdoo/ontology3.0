import assert from "node:assert/strict";
import test from "node:test";
import { createModelPortfolioRuntime } from "../runtime/model-portfolio-engine.mjs";
import { createModelRepositoryService } from "../runtime/model-repository-service.mjs";
import { S003_REGISTRATION } from "../runtime/s003-registration.mjs";

function readyRuntime() {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  for (const action of ["build-data", "validate-data", "freeze-data", "create-contract"]) runtime.action(action);
  return runtime;
}

function service(runtime = readyRuntime()) {
  return createModelRepositoryService({ getScenarioState: () => runtime.state() });
}

test("S003 exposes ten Python repositories with README, model card and tests", () => {
  const repositories = service().list("S003").repositories;
  assert.equal(repositories.length, 10);
  assert.equal(repositories.filter((item) => item.role === "FORMAL_BASELINE").length, 1);
  for (const item of repositories) {
    const detail = service().detail("S003", item.modelId);
    const paths = detail.files.map((file) => file.path);
    for (const required of ["README.md", "model.py", "features.py", "model-card.json", "requirements.txt", "tests/test_model.py"]) assert.ok(paths.includes(required), `${item.modelId} ${required}`);
    assert.match(detail.files.find((file) => file.path === "README.md").content, /业务问题/);
  }
});

test("all ten repositories execute real Python tests and DataVersion-bound model runs", async () => {
  const runtime = readyRuntime();
  const repositoryService = service(runtime);
  for (const item of repositoryService.list("S003").repositories) {
    const tested = await repositoryService.testRepository("S003", item.modelId);
    assert.equal(tested.status, "PASSED", item.modelId);
    assert.match(tested.command, /^python3 -m unittest/);
    const run = await repositoryService.runRepository("S003", item.modelId);
    assert.equal(run.status, "SUCCEEDED", item.modelId);
    assert.equal(run.resultCount, 21);
    assert.equal(run.dataVersionId, runtime.state().data.dataVersionId);
    assert.equal(run.semanticContractVersionId, runtime.state().semanticContract.semanticContractVersionId);
    assert.equal(run.formalFactsMutated, false);
    assert.equal(run.sideEffectsEmitted, 0);
    assert.match(run.receiptDigest, /^[a-f0-9]{64}$/);
  }
});

test("model runs are blocked until M02 freezes data and M01 forms the semantic contract", async () => {
  const runtime = createModelPortfolioRuntime(S003_REGISTRATION);
  const repositoryService = service(runtime);
  await assert.rejects(repositoryService.runRepository("S003", "MODEL-S003-CALIBRATED-SCORE"), (error) => error.code === "FROZEN_DATA_VERSION_REQUIRED");
  for (const action of ["build-data", "validate-data", "freeze-data"]) runtime.action(action);
  await assert.rejects(repositoryService.runRepository("S003", "MODEL-S003-CALIBRATED-SCORE"), (error) => error.code === "SEMANTIC_CONTRACT_REQUIRED");
});

test("formal baseline and candidate main branches remain protected", () => {
  const repositoryService = service();
  assert.throws(() => repositoryService.createBranch("S003", "MODEL-S003-FORMAL-SCORE", { name: "feature/change-formal" }), (error) => error.code === "FORMAL_REPOSITORY_READ_ONLY");
  const candidate = repositoryService.detail("S003", "MODEL-S003-CALIBRATED-SCORE");
  const readme = candidate.files.find((file) => file.path === "README.md").content;
  assert.throws(() => repositoryService.commit("S003", candidate.modelId, { branch: "main", message: "Direct main change", files: { "README.md": `${readme}\nchange\n` } }), (error) => error.code === "PROTECTED_BRANCH");
});

test("branch, commit, tag and code release candidate form immutable history", () => {
  const repositoryService = service();
  const modelId = "MODEL-S003-CALIBRATED-SCORE";
  const initial = repositoryService.detail("S003", modelId);
  const initialReadme = initial.files.find((file) => file.path === "README.md").content;
  let branch = repositoryService.createBranch("S003", modelId, { name: "feature/calibration-review" });
  branch = repositoryService.commit("S003", modelId, { branch: "feature/calibration-review", message: "Document calibration review", files: { "README.md": `${initialReadme}\n## 校准复核\n\n记录同口径验证要求。\n` } });
  const committedId = branch.selectedCommitId;
  assert.notEqual(committedId, initial.selectedCommitId);
  assert.equal(repositoryService.detail("S003", modelId, { commitId: initial.selectedCommitId }).files.find((file) => file.path === "README.md").content, initialReadme);
  branch = repositoryService.tag("S003", modelId, { branch: "feature/calibration-review", name: "v0.2.0-rc.1" });
  assert.throws(() => repositoryService.tag("S003", modelId, { branch: "feature/calibration-review", name: "v0.2.0-rc.1" }), (error) => error.code === "TAG_IMMUTABLE");
  branch = repositoryService.releaseCandidate("S003", modelId, { branch: "feature/calibration-review", tag: "v0.2.0-rc.1" });
  assert.equal(branch.releaseCandidateCount, 1);
  assert.equal(branch.releaseCandidates[0].commitId, committedId);
  assert.equal(branch.releaseCandidates[0].automaticRelease, false);
  assert.equal(branch.releaseCandidates[0].formalPointerChanged, false);
  assert.throws(() => repositoryService.releaseCandidate("S003", modelId, { tag: "v0.2.0-rc.1" }), (error) => error.code === "RELEASE_CANDIDATE_IMMUTABLE");
});
