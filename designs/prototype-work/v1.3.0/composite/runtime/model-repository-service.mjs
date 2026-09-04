import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getS003DatasetSnapshot, S003_REGISTRATION } from "./s003-registration.mjs";

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(runtimeDir, "../model-repositories");
const MAX_EDIT_BYTES = 96 * 1024;
const ALLOWED_FILE = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;
const ALLOWED_EXTENSION = new Set([".py", ".md", ".json", ".txt"]);

function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function digest(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(stable(value))).digest("hex");
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function languageFor(file) {
  if (file.endsWith(".py")) return "python";
  if (file.endsWith(".md")) return "markdown";
  if (file.endsWith(".json")) return "json";
  return "text";
}

function readSnapshot(directory, prefix = "") {
  const files = {};
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["__pycache__", ".DS_Store"].includes(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, readSnapshot(absolute, relative));
    else if (entry.isFile() && statSync(absolute).size <= MAX_EDIT_BYTES) files[relative] = readFileSync(absolute, "utf8");
  }
  return files;
}

function validateRefName(value, label) {
  const name = String(value || "").trim();
  if (!name || name.length > 64 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) || name.includes("..") || name.endsWith("/")) fail("INVALID_GIT_REF", `${label}格式无效。`);
  return name;
}

function validateFiles(files) {
  if (!files || typeof files !== "object" || Array.isArray(files)) fail("FILES_REQUIRED", "提交必须包含文件快照。 ");
  let bytes = 0;
  const normalized = {};
  for (const [file, content] of Object.entries(files)) {
    if (!ALLOWED_FILE.test(file) || file.includes("..") || path.isAbsolute(file) || !ALLOWED_EXTENSION.has(path.extname(file))) fail("INVALID_MODEL_FILE", `文件路径不可提交：${file}`);
    if (typeof content !== "string") fail("INVALID_MODEL_FILE", `${file} 必须是文本内容。`);
    bytes += Buffer.byteLength(content);
    if (bytes > MAX_EDIT_BYTES) fail("MODEL_EDIT_TOO_LARGE", "单次提交内容超过 96 KiB。 ");
    normalized[file] = content;
  }
  return normalized;
}

async function materializeSnapshot(snapshot, directory) {
  for (const [relative, content] of Object.entries(snapshot)) {
    const target = path.join(directory, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

async function runProcess(command, args, options = {}) {
  const timeoutMs = options.timeoutMs || 12_000;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUNBUFFERED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (current, chunk) => `${current}${chunk}`.slice(-256 * 1024);
    child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk.toString("utf8")); });
    child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk.toString("utf8")); });
    child.once("error", reject);
    const timeout = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code: Number(code ?? -1), signal, stdout: stdout.trim(), stderr: stderr.trim(), timedOut });
    });
  });
}

function repositoryDefinition(definition) {
  const directory = path.join(repositoryRoot, "s003", definition.repositorySlug);
  const snapshot = readSnapshot(directory);
  const snapshotDigest = digest(snapshot);
  const commitId = `c${snapshotDigest.slice(0, 12)}`;
  const committedAt = "2026-09-03T00:00:00.000Z";
  const readOnly = definition.modelRole === "FORMAL_BASELINE";
  const initialCommit = Object.freeze({
    commitId,
    parentCommitIds: [],
    message: readOnly ? "Import formal 1.0.2 read-only baseline" : `Seed ${definition.name} ${definition.version}`,
    author: "智财问策模型治理",
    committedAt,
    snapshotDigest,
    immutable: true,
    files: Object.freeze({ ...snapshot })
  });
  const repository = {
    scenarioId: "S003",
    repositoryId: `REPO-${definition.modelId}`,
    slug: definition.repositorySlug,
    modelId: definition.modelId,
    modelVersionId: definition.modelVersionId,
    name: definition.name,
    role: definition.modelRole,
    objectiveId: definition.objectiveId,
    businessQuestion: definition.businessQuestion,
    outputIdentity: definition.outputIdentity,
    readOnly,
    defaultBranch: "main",
    branches: new Map([["main", commitId]]),
    commits: new Map([[commitId, initialCommit]]),
    tags: new Map([[`v${definition.version}`, { name: `v${definition.version}`, commitId, createdAt: committedAt, immutable: true }]]),
    releaseCandidates: readOnly ? [{ releaseCandidateId: "REL-S003-FORMAL-1.0.2", tag: "v1.0.2", commitId, status: "FORMAL_READ_ONLY", createdAt: committedAt, immutable: true }] : [],
    runs: [],
    tests: []
  };
  return repository;
}

function repositorySummary(repository) {
  const headCommitId = repository.branches.get(repository.defaultBranch);
  return {
    scenarioId: repository.scenarioId,
    repositoryId: repository.repositoryId,
    slug: repository.slug,
    modelId: repository.modelId,
    modelVersionId: repository.modelVersionId,
    name: repository.name,
    role: repository.role,
    objectiveId: repository.objectiveId,
    businessQuestion: repository.businessQuestion,
    outputIdentity: repository.outputIdentity,
    readOnly: repository.readOnly,
    defaultBranch: repository.defaultBranch,
    headCommitId,
    branchCount: repository.branches.size,
    commitCount: repository.commits.size,
    tagCount: repository.tags.size,
    releaseCandidateCount: repository.releaseCandidates.length,
    latestRun: clone(repository.runs.at(-1) || null),
    latestTest: clone(repository.tests.at(-1) || null)
  };
}

export function createModelRepositoryService({ getScenarioState } = {}) {
  const repositories = new Map(S003_REGISTRATION.modelDefinitions.map((definition) => [definition.modelId, repositoryDefinition(definition)]));
  let operationSequence = 0;

  function at() {
    operationSequence += 1;
    return new Date(Date.parse("2026-09-03T00:00:00.000Z") + operationSequence * 60_000).toISOString();
  }

  function operationId(prefix) {
    return `${prefix}-${String(operationSequence + 1).padStart(4, "0")}`;
  }

  function selectRepository(scenarioId, modelId) {
    if (String(scenarioId || "").toUpperCase() !== "S003") fail("MODEL_REPOSITORIES_NOT_REGISTERED", "当前业务场景尚未登记 Python 模型代码仓。 ");
    const repository = repositories.get(String(modelId || ""));
    if (!repository) fail("MODEL_REPOSITORY_NOT_FOUND", `未找到模型代码仓：${modelId || "未提供"}`);
    return repository;
  }

  function resolveCommit(repository, { branch, commitId } = {}) {
    const resolvedCommitId = commitId || repository.branches.get(branch || repository.defaultBranch);
    const commit = repository.commits.get(resolvedCommitId);
    if (!commit) fail("MODEL_COMMIT_NOT_FOUND", `提交不存在：${resolvedCommitId || "未提供"}`);
    return commit;
  }

  function stateForRun(scenarioId) {
    const state = getScenarioState?.(scenarioId);
    if (!state?.data?.immutable) fail("FROZEN_DATA_VERSION_REQUIRED", "请先在 M02 构建、校验并冻结 DataVersion。 ");
    if (!state?.semanticContract?.semanticContractVersionId) fail("SEMANTIC_CONTRACT_REQUIRED", "请先在 M01 形成当前周期语义合同。 ");
    return state;
  }

  function list(scenarioId) {
    if (String(scenarioId || "").toUpperCase() !== "S003") return { schemaVersion: "ofw.model-repository-catalog.v1", scenarioId, repositories: [], registered: false };
    return { schemaVersion: "ofw.model-repository-catalog.v1", scenarioId: "S003", repositories: [...repositories.values()].map(repositorySummary), registered: true };
  }

  function detail(scenarioId, modelId, options = {}) {
    const repository = selectRepository(scenarioId, modelId);
    const commit = resolveCommit(repository, options);
    return {
      schemaVersion: "ofw.model-repository.v1",
      ...repositorySummary(repository),
      selectedBranch: options.branch || repository.defaultBranch,
      selectedCommitId: commit.commitId,
      files: Object.entries(commit.files).sort(([left], [right]) => left.localeCompare(right)).map(([file, content]) => ({ path: file, language: languageFor(file), content, readOnly: repository.readOnly })),
      branches: [...repository.branches.entries()].map(([name, headCommitId]) => ({ name, headCommitId, protected: repository.readOnly || name === "main" })),
      commits: [...repository.commits.values()].map(({ files, ...item }) => clone(item)).sort((left, right) => right.committedAt.localeCompare(left.committedAt)),
      tags: [...repository.tags.values()].map(clone),
      releaseCandidates: repository.releaseCandidates.map(clone),
      recentRuns: repository.runs.slice(-6).reverse().map(clone),
      recentTests: repository.tests.slice(-6).reverse().map(clone)
    };
  }

  function createBranch(scenarioId, modelId, payload = {}) {
    const repository = selectRepository(scenarioId, modelId);
    if (repository.readOnly) fail("FORMAL_REPOSITORY_READ_ONLY", "正式 1.0.2 模型仓为只读镜像，不能创建研发分支。 ");
    const name = validateRefName(payload.name, "分支名");
    if (repository.branches.has(name)) fail("BRANCH_ALREADY_EXISTS", `分支已存在：${name}`);
    const source = resolveCommit(repository, { branch: payload.fromBranch, commitId: payload.fromCommitId });
    repository.branches.set(name, source.commitId);
    return detail(scenarioId, modelId, { branch: name });
  }

  function commit(scenarioId, modelId, payload = {}) {
    const repository = selectRepository(scenarioId, modelId);
    if (repository.readOnly) fail("FORMAL_REPOSITORY_READ_ONLY", "正式 1.0.2 模型仓为只读镜像，不能提交修改。 ");
    const branch = validateRefName(payload.branch || repository.defaultBranch, "分支名");
    if (!repository.branches.has(branch)) fail("BRANCH_NOT_FOUND", `分支不存在：${branch}`);
    if (branch === repository.defaultBranch) fail("PROTECTED_BRANCH", "默认 main 分支受保护，请先创建研发分支再提交。 ");
    const message = String(payload.message || "").trim();
    if (!message || message.length > 160) fail("COMMIT_MESSAGE_REQUIRED", "请输入 1—160 字符的提交说明。 ");
    const edits = validateFiles(payload.files);
    const parent = resolveCommit(repository, { branch });
    const nextFiles = { ...parent.files, ...edits };
    const snapshotDigest = digest(nextFiles);
    if (snapshotDigest === parent.snapshotDigest) fail("EMPTY_COMMIT", "文件内容没有变化。 ");
    const commitId = `c${digest({ parent: parent.commitId, branch, message, snapshotDigest }).slice(0, 12)}`;
    if (repository.commits.has(commitId)) fail("COMMIT_ALREADY_EXISTS", `相同提交已存在：${commitId}`);
    const next = Object.freeze({
      commitId,
      parentCommitIds: [parent.commitId],
      message,
      author: String(payload.author || "当前模型维护人").slice(0, 60),
      committedAt: at(),
      snapshotDigest,
      immutable: true,
      files: Object.freeze({ ...nextFiles })
    });
    repository.commits.set(commitId, next);
    repository.branches.set(branch, commitId);
    return detail(scenarioId, modelId, { branch, commitId });
  }

  function tag(scenarioId, modelId, payload = {}) {
    const repository = selectRepository(scenarioId, modelId);
    if (repository.readOnly) fail("FORMAL_REPOSITORY_READ_ONLY", "正式模型标签为只读，不能新增或移动。 ");
    const name = validateRefName(payload.name, "标签名");
    if (repository.tags.has(name)) fail("TAG_IMMUTABLE", `标签已存在且不可移动：${name}`);
    const commit = resolveCommit(repository, payload);
    repository.tags.set(name, { name, commitId: commit.commitId, createdAt: at(), immutable: true });
    return detail(scenarioId, modelId, { commitId: commit.commitId, branch: payload.branch });
  }

  function releaseCandidate(scenarioId, modelId, payload = {}) {
    const repository = selectRepository(scenarioId, modelId);
    if (repository.readOnly) fail("FORMAL_REPOSITORY_READ_ONLY", "当前正式模型仓为只读，不能在原仓形成候选发布。 ");
    const tagName = validateRefName(payload.tag, "发布标签");
    const tagRecord = repository.tags.get(tagName);
    if (!tagRecord) fail("TAG_REQUIRED", "请先为目标提交创建不可变标签。 ");
    if (repository.releaseCandidates.some((item) => item.tag === tagName)) fail("RELEASE_CANDIDATE_IMMUTABLE", `该标签已形成发布候选：${tagName}`);
    const createdAt = at();
    const record = {
      releaseCandidateId: `RC-${repository.modelId}-${tagName.replace(/[^A-Za-z0-9]/g, "-")}-${String(repository.releaseCandidates.length + 1).padStart(2, "0")}`,
      tag: tagName,
      commitId: tagRecord.commitId,
      status: "CODE_RELEASE_CANDIDATE",
      createdAt,
      immutable: true,
      automaticRelease: false,
      formalPointerChanged: false
    };
    repository.releaseCandidates.push(record);
    return detail(scenarioId, modelId, { commitId: tagRecord.commitId, branch: payload.branch });
  }

  async function testRepository(scenarioId, modelId, payload = {}) {
    const repository = selectRepository(scenarioId, modelId);
    const commit = resolveCommit(repository, payload);
    const workspace = await mkdtemp(path.join(os.tmpdir(), "ofw-model-test-"));
    const testRunId = operationId("MODEL-TEST");
    try {
      await materializeSnapshot(commit.files, workspace);
      const processResult = await runProcess("python3", ["-m", "unittest", "discover", "-s", "tests", "-v"], { cwd: workspace });
      const testedAt = at();
      const receipt = {
        testRunId,
        status: processResult.code === 0 && !processResult.timedOut ? "PASSED" : "FAILED",
        modelId: repository.modelId,
        commitId: commit.commitId,
        snapshotDigest: commit.snapshotDigest,
        testedAt,
        command: "python3 -m unittest discover -s tests -v",
        stdout: processResult.stdout,
        stderr: processResult.stderr,
        exitCode: processResult.code,
        timedOut: processResult.timedOut,
        immutable: true
      };
      repository.tests.push(receipt);
      return clone(receipt);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  async function runRepository(scenarioId, modelId, payload = {}) {
    const repository = selectRepository(scenarioId, modelId);
    const commit = resolveCommit(repository, payload);
    const state = stateForRun(scenarioId);
    const dataset = getS003DatasetSnapshot(state.data.dataVersionId);
    const workspace = await mkdtemp(path.join(os.tmpdir(), "ofw-model-run-"));
    const modelRunId = operationId("PY-MODEL-RUN");
    try {
      await materializeSnapshot(commit.files, workspace);
      const inputPath = path.join(workspace, "input.json");
      const outputPath = path.join(workspace, "result.json");
      const input = { ...dataset, semanticContractVersionId: state.semanticContract.semanticContractVersionId, modelCommitId: commit.commitId };
      await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
      const processResult = await runProcess("python3", ["model.py", "--input", inputPath, "--output", outputPath], { cwd: workspace });
      let resultEnvelope = null;
      if (processResult.code === 0 && !processResult.timedOut) resultEnvelope = JSON.parse(await readFile(outputPath, "utf8"));
      const succeeded = Boolean(resultEnvelope)
        && resultEnvelope.modelId === repository.modelId
        && resultEnvelope.dataVersionId === state.data.dataVersionId
        && resultEnvelope.semanticContractVersionId === state.semanticContract.semanticContractVersionId
        && resultEnvelope.formalFactsMutated === false
        && resultEnvelope.sideEffectsEmitted === 0;
      const completedAt = at();
      const receiptCore = {
        modelRunId,
        status: succeeded ? "SUCCEEDED" : "FAILED",
        modelId: repository.modelId,
        modelVersionId: repository.modelVersionId,
        repositoryId: repository.repositoryId,
        commitId: commit.commitId,
        snapshotDigest: commit.snapshotDigest,
        dataVersionId: state.data.dataVersionId,
        semanticContractVersionId: state.semanticContract.semanticContractVersionId,
        dataBuildRunId: state.data.dataBuildRunId,
        qualityResultId: state.data.qualityResultId,
        leakageCheckId: state.data.leakageCheckId,
        completedAt,
        command: "python3 model.py --input input.json --output result.json",
        stdout: processResult.stdout,
        stderr: processResult.stderr,
        exitCode: processResult.code,
        timedOut: processResult.timedOut,
        inputRecordCount: dataset.recordCount,
        resultCount: resultEnvelope?.resultCount || 0,
        resultEnvelope,
        evidenceRefs: [`MODEL-COMMIT:${commit.commitId}`, state.data.dataVersionId, state.semanticContract.semanticContractVersionId, state.data.qualityResultId, state.data.leakageCheckId],
        formalFactsMutated: false,
        sideEffectsEmitted: 0,
        immutable: true
      };
      const receipt = { ...receiptCore, receiptDigest: digest(receiptCore) };
      repository.runs.push(receipt);
      return clone(receipt);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }

  return Object.freeze({ list, detail, createBranch, commit, tag, releaseCandidate, testRepository, runRepository });
}
