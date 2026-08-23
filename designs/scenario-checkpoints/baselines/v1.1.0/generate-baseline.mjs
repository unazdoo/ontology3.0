import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../../../..");
const releaseRoot = path.join(projectRoot, "designs/prototype-releases/v1.1.0");
const manifestPath = path.join(releaseRoot, "manifest.json");
const versionPath = path.join(releaseRoot, "VERSION.json");
const checkpointPath = path.join(scriptDir, "T056-baseline-checkpoint.json");
const detachedDigestPath = path.join(scriptDir, "T056-baseline-checkpoint.sha256");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function component(manifest, name) {
  const value = manifest.components?.[name];
  if (!value) throw new Error(`发布清单缺少组件：${name}`);
  return value;
}

const version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const modules = [
  ["M01", "本体管理", "ontology-management-review"],
  ["M02", "数据工程", "data-engineering-prototype-review"],
  ["M03", "智能问数", "intelligent-query-prototype"],
  ["M04", "决策中心", "decision-center-prototype"],
  ["M05", "Agent 应用", "agent-application"],
  ["M06", "报告中心", "report-center"],
];

const checkpoint = {
  schemaVersion: 2,
  resourceType: "T056",
  resourceName: "场景快照",
  checkpointType: "frozen-implementation-reference-baseline",
  checkpointId: version.baselineSnapshotId,
  baselineSnapshotId: version.baselineSnapshotId,
  identitySeed: {
    source: "v1.1.0-rc.10 RC10-INTEGRITY.json SHA-256 prefix",
    sha256: "94abd0e991b7f71a504bd1f517879d65fe8c6ecf526a82b119fd8ba949cff233",
  },
  status: "locked",
  formedAt: "2026-08-24T00:00:00+08:00",
  owner: {
    catalogAndManifest: "平台公共层",
    baselineBindingAndMigrationApproval: "平台总控",
    moduleStateAndEvidence: "M01—M06 各资源 Owner",
  },
  contract: "C034",
  decisionRefs: ["D076", "D077", "D079", "D100"],
  baseline: {
    version: version.version,
    sourceCandidate: version.sourceCandidate,
    sourceProductBaseline: version.sourceProductBaseline,
    parentVersion: version.parentVersion,
    governanceBaselineVersion: version.governanceBaselineVersion,
    governanceBaselineSnapshotId: version.governanceBaselineSnapshotId,
    path: "designs/prototype-releases/v1.1.0",
    entry: `designs/prototype-releases/v1.1.0/${version.entry}`,
    manifest: "designs/prototype-releases/v1.1.0/manifest.json",
    manifestSha256: sha256(manifestPath),
    versionFileSha256: sha256(versionPath),
    releaseTreeSha256: manifest.releaseTree.treeSha256,
    releaseFileCount: manifest.releaseTree.files,
    releaseBytes: manifest.releaseTree.bytes,
    gitTag: version.releaseTag,
    rollbackVersion: version.rollbackVersion,
    immutable: true,
  },
  scenarioScope: Object.entries(version.sourceScenarioRunIds).map(([scenarioId, sourceScenarioRunId]) => ({
    scenarioId,
    scenarioVersion: scenarioId === "S004" ? "S004-v2.1.0" : `${scenarioId}-v1`,
    sourceScenarioRunId,
    historicalViewMode: "read-only-source-evidence",
    recoveryRule: "正式恢复必须克隆为新的 scenarioRunId，不得覆盖来源轮次",
  })),
  prototypeBuild: {
    version: version.version,
    sourceCandidate: version.sourceCandidate,
    componentCount: Object.keys(manifest.components).length,
    entryCount: Object.keys(manifest.entries).length,
    fileCount: manifest.releaseTree.files,
    integrityStatus: "verified-by-manifest-v2",
  },
  platformComponents: [
    ["统一产品 Shell", "s001-e2e-integration"],
    ["场景公共 Foundation", "foundation"],
    ["一级仪表盘", "dashboard"],
  ].map(([name, prototypePath]) => ({
    name,
    prototypePath: `designs/prototype-releases/v1.1.0/${prototypePath}`,
    treeSha256: component(manifest, prototypePath).treeSha256,
  })),
  moduleVersions: modules.map(([module, name, prototypePath]) => ({
    module,
    name,
    owner: name,
    prototypePath: `designs/prototype-releases/v1.1.0/${prototypePath}`,
    treeSha256: component(manifest, prototypePath).treeSha256,
    exactVersion: `v1.1.0#${component(manifest, prototypePath).treeSha256.slice(0, 16)}`,
  })),
  lockedReferences: {
    scenarioRegistry: "designs/prototype-releases/v1.1.0/SCENARIO-REGISTRY.json",
    checkpointRegistry: "designs/prototype-releases/v1.1.0/CHECKPOINT-REGISTRY.md",
    regressionMatrix: "designs/prototype-releases/v1.1.0/COMPOSITE-REGRESSION-MATRIX.json",
    sourceCandidateIntegrity: "designs/prototype-releases/v1.1.0/RC10-INTEGRITY.json",
    compositeRunEvidence: "designs/prototype-releases/v1.1.0/COMPOSITE-RUN-RC4.json",
  },
  runtimeBoundary: {
    runtimeSnapshotIncluded: false,
    formalFourScenarioRecoveryReady: false,
    historicalS001RuntimeReference: version.historicalRuntimeReferences.S001,
    s004PublicCheckpoint: "not-created",
    meaning: "本清单锁定产品代码、模块树、四个来源轮次和证据索引，不声称已经形成四场景生产级可恢复运行快照。",
  },
  moduleInterfaceReadiness: {
    status: "contract-confirmed-implementation-evidence-pending",
    meaning: "M01—M06 正式 C034 导出、校验、克隆恢复和隔离回归接口证据仍待项目实施。",
  },
  immutability: {
    detachedDigest: "T056-baseline-checkpoint.sha256",
    releaseManifest: "designs/prototype-releases/v1.1.0/manifest.json",
    verificationScript: "verify-baseline.mjs",
    changeRule: "本清单和发布目录不得原地修改；任何变化必须形成新版本和新 baselineSnapshotId。",
  },
  acceptance: {
    acceptanceReady: false,
    meaning: "仅冻结实施参考原型，不表示用户评审、模块评审、场景验收、生产技术联调或一期验收通过。",
  },
};

fs.writeFileSync(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
const digest = sha256(checkpointPath);
fs.writeFileSync(detachedDigestPath, `${digest}  T056-baseline-checkpoint.json\n`, "utf8");
console.log(`v1.1.0 T056 已生成：${checkpoint.baselineSnapshotId}；${digest}`);
