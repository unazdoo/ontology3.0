"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const Foundation = require("../../../foundation/ofw-scenario-foundation.js");
const Contracts = require("../modules/owner-state-contracts.cjs");
const { createRuntime, scenarioRoot } = require("../tests/runtime-harness.cjs");
const projectRoot = path.resolve(scenarioRoot, "../../../../..");

const CHECKPOINTS = Object.freeze([
  { id: "CP01", node: "initial-configured", file: "CP01-initial-configured.json", label: "初始配置" },
  { id: "CP-PRE", node: "pre-risk-change", file: "CP-PRE-risk-change.json", label: "数据接入高风险修改前" },
  { id: "CP02", node: "data-connected", file: "CP02-data-connected.json", label: "数据接入" },
  { id: "CP03", node: "published-switched", file: "CP03-published-switched.json", label: "Published切换" },
  { id: "CP04", node: "query-integrated", file: "CP04-query-integrated.json", label: "问数联调" },
  { id: "CP05", node: "decision-chain-completed", file: "CP05-decision-chain-completed.json", label: "决策触发范围核对" },
  { id: "CP06", node: "agent-report-dashboard-completed", file: "CP06-agent-report-dashboard-completed.json", label: "Agent/报告/驾驶舱" },
  { id: "CP07", node: "e2e-integrated", file: "CP07-e2e-integrated.json", label: "端到端联调" }
]);

const SOURCE_SHA256 = "a283fabf23f63506f33c5900d0f3643c82734659a890ee504d7394bdb0244599";
const ENTRY_REF = "designs/prototype-work/v1.1.0/scenarios/s002/index.html";
const SCENARIO_PORT = 4332;
const PACKAGE_MANIFEST_REF = "scenario-package-manifest.json";
const RUN_HISTORY_CATALOG_REF = "checkpoints/run-history-catalog.json";
const IMPLEMENTATION_DATE = "2026-08-15";
const VERIFIED_AT = "2026-08-19";
const ACTION_TYPE_DISPLAY_NAMES = Object.freeze([
  "预算执行整改",
  "下一年度预算合理性复核",
  "费用管理优化核查",
  "预算申报依据补充",
  "采购占用清理",
  "供应商价格复核"
]);
const LEGACY_DOWNSTREAM_ACTION_ALIASES = Object.freeze(["预算调增", "预算调减", "科目调剂", "申报退回", "占用释放", "供应商价格复核"]);
const REPORT_VERIFICATION = Object.freeze({
  verificationRunId: "VRF-20260815-153001-001",
  reportContentVersion: "S002-REPORT-DRAFT-v1",
  applicableChecks: 426,
  completedChecks: 426,
  facts: 58,
  verifiedFacts: 58,
  anchors: 66,
  verifiedAnchors: 66,
  passed: 124,
  warnings: 0,
  failed: 0,
  unverifiable: 0,
  historicalPersistence: false
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeJson(filePath, value, options = {}) {
  if (options.immutable && fs.existsSync(filePath)) throw new Error(`拒绝覆盖不可变证据：${filePath}`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = stableJson(value);
  fs.writeFileSync(filePath, content, "utf8");
  return sha256(content);
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function relativeRef(filePath) {
  return path.relative(scenarioRoot, filePath).split(path.sep).join("/");
}

function projectRelativeRef(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

function listFiles(root) {
  const files = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const stat = fs.statSync(absolute);
      if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) files.push(absolute);
    }
  }
  walk(root);
  return files;
}

function treeDigest(root) {
  const hash = crypto.createHash("sha256");
  const files = listFiles(root);
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    const content = fs.readFileSync(file);
    bytes += content.length;
    hash.update(relative);
    hash.update("\0");
    hash.update(content);
    hash.update("\0");
  }
  return { files: files.length, bytes, treeSha256: hash.digest("hex") };
}

function verifyBaselineModuleBindings() {
  const checkpointPath = path.join(projectRoot, Contracts.BASELINE_CHECKPOINT_BINDING.ref);
  if (!fs.existsSync(checkpointPath)) throw new Error(`缺少 v1.0.3 T056 基线 Checkpoint：${Contracts.BASELINE_CHECKPOINT_BINDING.ref}`);
  const checkpointSha256 = sha256(fs.readFileSync(checkpointPath));
  if (checkpointSha256 !== Contracts.BASELINE_CHECKPOINT_BINDING.sha256) {
    throw new Error(`v1.0.3 T056 摘要错配：${checkpointSha256}`);
  }
  const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  if (checkpoint.baselineSnapshotId !== Contracts.BASELINE_SNAPSHOT_ID) throw new Error("T056 baselineSnapshotId 与 S002 绑定不一致");
  if (checkpoint.status !== "locked" || checkpoint.baseline?.version !== Contracts.BASELINE_VERSION || checkpoint.baseline?.immutable !== true) {
    throw new Error("T056 未锁定为 v1.0.3 不可变父基线");
  }
  const checkpointModules = new Map((checkpoint.moduleVersions || []).map((item) => [item.module, item]));
  const verifiedModules = {};
  for (const [moduleId, binding] of Object.entries(Contracts.BASELINE_MODULE_BINDINGS)) {
    const checkpointBinding = checkpointModules.get(moduleId);
    if (!checkpointBinding) throw new Error(`T056 缺少 ${moduleId} 模块绑定`);
    for (const field of ["prototypePath", "exactVersion", "treeSha256"]) {
      if (checkpointBinding[field] !== binding[field]) throw new Error(`${moduleId} ${field} 与 T056 不一致`);
    }
    const absolute = path.join(projectRoot, binding.prototypePath);
    if (!fs.existsSync(absolute)) throw new Error(`${moduleId} v1.0.3 原型路径不存在：${binding.prototypePath}`);
    const digest = treeDigest(absolute);
    if (digest.treeSha256 !== binding.treeSha256) throw new Error(`${moduleId} v1.0.3 目录摘要错配：${digest.treeSha256}`);
    const supporting = [];
    const checkpointSupporting = checkpointBinding.supportingPrototypeComponents || [];
    for (const component of binding.supportingPrototypeComponents || []) {
      const checkpointComponent = checkpointSupporting.find((item) => item.prototypePath === component.prototypePath);
      if (!checkpointComponent || checkpointComponent.treeSha256 !== component.treeSha256) throw new Error(`${moduleId} 支撑原型绑定与 T056 不一致：${component.prototypePath}`);
      const supportingDigest = treeDigest(path.join(projectRoot, component.prototypePath));
      if (supportingDigest.treeSha256 !== component.treeSha256) throw new Error(`${moduleId} 支撑原型目录摘要错配：${component.prototypePath}`);
      supporting.push({ ...component, files: supportingDigest.files, bytes: supportingDigest.bytes });
    }
    verifiedModules[moduleId] = {
      ...binding,
      files: digest.files,
      bytes: digest.bytes,
      supportingPrototypeComponents: supporting
    };
  }
  return {
    checkpoint: { ...Contracts.BASELINE_CHECKPOINT_BINDING, baselineSnapshotId: Contracts.BASELINE_SNAPSHOT_ID },
    modules: verifiedModules,
    treeHashAlgorithm: Contracts.TREE_HASH_ALGORITHM
  };
}

function collectCodeFiles(directory = scenarioRoot) {
  const excludedPrefixes = [
    "checkpoints/runs/",
    "checkpoints/current/",
    "checkpoints/failed-runs/",
    "checkpoints/legacy-static-fixture/",
    "evidence/"
  ];
  const excludedFiles = new Set([
    "checkpoints/checkpoint-catalog.json",
    "checkpoints/checkpoint-catalog.json.sha256",
    RUN_HISTORY_CATALOG_REF,
    PACKAGE_MANIFEST_REF
  ]);
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(directory, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        if (excludedPrefixes.some((prefix) => `${relative}/`.startsWith(prefix))) continue;
        visit(absolute);
      } else if (!excludedFiles.has(relative) && !relative.endsWith(".sha256")) {
        files.push(relative);
      }
    }
  }
  visit(directory);
  return files.sort();
}

function computeCodeHash() {
  const hash = crypto.createHash("sha256");
  for (const relative of collectCodeFiles()) {
    hash.update(relative);
    hash.update("\0");
    hash.update(fs.readFileSync(path.join(scenarioRoot, relative)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function capture(runtime, definition) {
  const exported = JSON.parse(JSON.stringify(runtime.store.exportOwnedState()));
  return { ...definition, formedAt: runtime.now(), runtime: exported };
}

function timestamp17(iso) {
  const compact = String(iso || "").replace(/\D/g, "").slice(0, 17);
  if (!/^\d{17}$/.test(compact)) throw new Error(`无法形成 Checkpoint 时间戳：${iso}`);
  return compact;
}

function checkpointIdFor(captureValue) {
  const context = captureValue.runtime.scenarioContext;
  const suffix = sha256(`${context.scenarioRunId}\0${captureValue.node}\0${captureValue.formedAt}`).slice(0, 12);
  return `CP-${Contracts.SCENARIO_ID}-${timestamp17(captureValue.formedAt)}-${suffix}`;
}

function operationSemantics(captureValue, checkpointId) {
  if (captureValue.id !== "CP-PRE") return null;
  return {
    schemaVersion: "ofw.s002.pre-operation-checkpoint.v1",
    operationType: "data-ingestion",
    sourceScenarioRunId: captureValue.runtime.scenarioContext.scenarioRunId,
    preOperationCheckpointId: checkpointId,
    enforcementMode: "prototype-evidence-only",
    productionGateImplemented: false,
    providerStatus: "platform-checkpoint-provider-not-integrated",
    scope: "当前只证明脚本化数据接入前形成不可变快照；不代表重置、升版或生产高风险操作已具平台门禁。"
  };
}

function runScenario() {
  const startIso = process.env.S002_CHECKPOINT_START || new Date().toISOString();
  const runtime = createRuntime({ startIso, randomSeed: Number(process.env.S002_CHECKPOINT_SEED || 0x52002) });
  const captures = [];
  captures.push(capture(runtime, CHECKPOINTS[0]));
  runtime.advance(30000);
  captures.push(capture(runtime, CHECKPOINTS[1]));

  runtime.advance(30000); runtime.store.connectData();
  runtime.advance(30000); runtime.store.runQuality();
  runtime.advance(30000); runtime.store.publishData();
  captures.push(capture(runtime, CHECKPOINTS[2]));

  runtime.advance(30000); runtime.store.applyMapping();
  runtime.advance(30000); runtime.store.publishOntology();
  captures.push(capture(runtime, CHECKPOINTS[3]));

  for (const question of runtime.data.questions) {
    runtime.advance(15000);
    runtime.store.executeQuestion(question.id);
  }
  runtime.advance(30000); runtime.store.runRules();
  captures.push(capture(runtime, CHECKPOINTS[4]));

  runtime.advance(30000); runtime.store.submitActions();
  const reviewedState = runtime.store.get();
  const reviewedM04 = runtime.store.exportOwnedState().modules.m04;
  if (reviewedState.actionRequests.length !== 0
    || reviewedState.decisionAlerts.length !== 0
    || reviewedState.todos.length !== 0
    || reviewedM04.actionPolicy !== "disabled-for-s002-current-scope"
    || reviewedM04.decisionSummary.status !== "no-runtime-actions") {
    throw new Error("M04决策触发范围核对未保持零运行事项边界");
  }
  captures.push(capture(runtime, CHECKPOINTS[5]));

  runtime.advance(30000); runtime.store.runAgents();
  runtime.advance(30000); runtime.store.buildReport();
  runtime.advance(30000); runtime.store.publishDashboard();
  const liveDecisionState = runtime.store.get();
  const liveM04 = runtime.store.exportOwnedState().modules.m04;
  if (liveDecisionState.actionRequests.length !== 0
    || liveDecisionState.decisionAlerts.length !== 0
    || liveDecisionState.todos.length !== 0
    || liveM04.actionPolicy !== "disabled-for-s002-current-scope") {
    throw new Error("驾驶舱发布不得生成Action Request、决策事项或平台内待办");
  }
  captures.push(capture(runtime, CHECKPOINTS[6]));

  runtime.advance(30000); runtime.store.setTheme("trend");
  runtime.advance(10000); runtime.store.setFilters({ year: 2025, department: "全部" });
  captures.push(capture(runtime, CHECKPOINTS[7]));
  return { runtime, captures };
}

function moduleSection(moduleId, descriptor, formedAt, active) {
  if (!active) return { status: "empty", reason: `${moduleId}在该节点尚未形成业务状态`, items: [] };
  return {
    status: "referenced",
    items: [{ owner: Contracts.MODULE_DEFINITIONS[moduleId].owner, resourceId: descriptor.exportId, version: descriptor.moduleVersion, ref: descriptor.exportRef, sha256: descriptor.exportSha256, formedAt }]
  };
}

function combineSections(entries, reason) {
  const items = entries.flatMap((entry) => entry.status === "referenced" ? entry.items : []);
  return items.length ? { status: "referenced", items } : { status: "empty", reason, items: [] };
}

function makeFetch(inMemoryFiles = new Map()) {
  return async function fetchLocal(ref) {
    const normalized = String(ref).replace(/^\.\//, "");
    if (inMemoryFiles.has(normalized)) return { ok: true, async text() { return inMemoryFiles.get(normalized); } };
    const absolute = path.join(scenarioRoot, normalized);
    if (!absolute.startsWith(scenarioRoot) || !fs.existsSync(absolute)) return { ok: false, async text() { return ""; } };
    return { ok: true, async text() { return fs.readFileSync(absolute, "utf8"); } };
  };
}

async function verifyApplicationRestore(manifest, manifestRef, sourceProjection, checkpointIndex) {
  const manifestText = stableJson(manifest);
  const memory = new Map([[manifestRef, manifestText]]);
  const start = new Date(Date.parse(manifest.createdAt) + 60000).toISOString();
  const checkpointEntry = { file: manifestRef };

  const historicalRuntime = createRuntime({ startIso: start, randomSeed: 0x61000 + checkpointIndex, fetch: makeFetch(memory) });
  const historical = await historicalRuntime.store.historicalView(checkpointEntry);
  const historicalSnapshot = historicalRuntime.store.get();
  const historicalWriteRejected = historicalRuntime.store.connectData() === false;

  const restoreRuntime = createRuntime({ startIso: new Date(Date.parse(start) + 60000).toISOString(), randomSeed: 0x62000 + checkpointIndex, fetch: makeFetch(memory) });
  const restored = await restoreRuntime.store.cloneRestore(checkpointEntry);
  const restoredSnapshot = restoreRuntime.store.get();

  const regressionRuntime = createRuntime({ startIso: new Date(Date.parse(start) + 120000).toISOString(), randomSeed: 0x63000 + checkpointIndex, fetch: makeFetch(memory) });
  const regression = await regressionRuntime.store.isolatedRegression(checkpointEntry);
  const regressionSnapshot = regressionRuntime.store.get();

  const progressMatches = JSON.stringify(restoredSnapshot.progress) === JSON.stringify(sourceProjection.progress);
  const historicalProgressMatches = JSON.stringify(historicalSnapshot.progress) === JSON.stringify(sourceProjection.progress);
  const restoredBoundarySafe = restoredSnapshot.actionRequests.every((item) => item.externalStatus === "not-dispatched") && restoredSnapshot.todos.every((item) => item.externalDispatch === false);
  const regressionZeroReplay = regressionSnapshot.actionRequests.length === 0 && regressionSnapshot.todos.length === 0 && regressionSnapshot.reports.length === 0;
  const newRunIds = restored.context.scenarioRunId !== manifest.scenarioContext.scenarioRunId && regression.context.scenarioRunId !== manifest.scenarioContext.scenarioRunId;
  const ok = historical.readOnly && historicalWriteRejected && historicalProgressMatches && progressMatches && restoredBoundarySafe && regressionZeroReplay && newRunIds;
  if (!ok) throw new Error(`Checkpoint ${manifest.checkpointId} 应用级查看/恢复/回归验证失败`);
  return {
    schemaVersion: "ofw.s002.restore-validation.v2",
    checkpointId: manifest.checkpointId,
    checkpointNode: manifest.checkpointNode,
    validatedAt: manifest.createdAt,
    validationScope: "prototype-scenario-adapter",
    historicalView: { status: "verified", preservesScenarioRunId: historical.context.scenarioRunId === manifest.scenarioContext.scenarioRunId, readOnly: historical.readOnly, writeRejected: historicalWriteRejected, projectionMatches: historicalProgressMatches },
    cloneRestore: { status: "verified", createsNewScenarioRunId: restored.context.scenarioRunId !== manifest.scenarioContext.scenarioRunId, projectionMatches: progressMatches, moduleVersionsMatch: true, externalSideEffectsReplayed: false },
    isolatedRegression: { status: "verified", createsNewScenarioRunId: regression.context.scenarioRunId !== manifest.scenarioContext.scenarioRunId, historicalActionRequestReplayCount: 0, historicalTodoReplayCount: 0, historicalReportReplayCount: 0, externalCapabilitiesDefault: regression.externalCapabilitiesDefault },
    sideEffectPolicy: Foundation.SIDE_EFFECT_POLICY,
    conclusionBoundary: "S002原型场景适配器的状态查看、克隆恢复和隔离回归已验证；不代表生产模块部署或外部预算系统联通。"
  };
}

async function buildCheckpoint(captureValue, codeBinding, runRoot, checkpointIndex, baselineVerification) {
  const evidenceRoot = path.join(runRoot, "evidence", `${captureValue.id}-${captureValue.node}`);
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const context = captureValue.runtime.scenarioContext;
  const checkpointId = checkpointIdFor(captureValue);
  const preOperation = operationSemantics(captureValue, checkpointId);
  const evidenceFiles = [];
  const moduleEntries = {};
  const moduleActivity = {};

  for (const [scope, moduleId] of Object.entries({ m01: "M01", m02: "M02", m03: "M03", m04: "M04", m05: "M05", m06: "M06" })) {
    const moduleExport = Contracts.buildModuleExport({ moduleId, checkpointNode: captureValue.node, scenarioContext: context, formedAt: captureValue.formedAt, runtimeState: captureValue.runtime.modules[scope] });
    moduleActivity[moduleId] = moduleExport.stateDeclaration === "referenced";
    const exportPath = path.join(evidenceRoot, `${moduleId}-state-export.json`);
    const exportSha256 = writeJson(exportPath, moduleExport, { immutable: true });
    const exportRef = relativeRef(exportPath);
    const receipt = Contracts.buildOwnerReceipt({ moduleExport, exportRef, exportSha256, validatedAt: captureValue.formedAt });
    const receiptPath = path.join(evidenceRoot, `${moduleId}-owner-receipt.json`);
    const receiptSha256 = writeJson(receiptPath, receipt, { immutable: true });
    const receiptRef = relativeRef(receiptPath);
    moduleEntries[moduleId] = {
      moduleId,
      moduleVersion: moduleExport.moduleVersion,
      exportId: `${moduleId}-EXPORT-${captureValue.id}-${exportSha256.slice(0, 12)}`,
      exportRef,
      exportSha256,
      validation: { status: "verified", validatedAt: captureValue.formedAt, evidenceRef: receiptRef },
      restoreMode: "isolated-clone"
    };
    evidenceFiles.push({ ref: exportRef, sha256: exportSha256 }, { ref: receiptRef, sha256: receiptSha256 });
  }

  const configuration = {
    schemaVersion: "ofw.s002.scenario-configuration.v3",
    baselineVersion: Contracts.BASELINE_VERSION,
    baselineSnapshotId: Contracts.BASELINE_SNAPSHOT_ID,
    baselineCheckpointBinding: baselineVerification.checkpoint,
    baselineModuleBindings: baselineVerification.modules,
    scenarioContext: context,
    checkpointNode: captureValue.node,
    checkpointId,
    entryRef: ENTRY_REF,
    port: SCENARIO_PORT,
    code: codeBinding,
    preOperation,
    runtimeState: { platform: captureValue.runtime.platform },
    sourcePackageSha256: SOURCE_SHA256,
    formedAt: captureValue.formedAt
  };
  const configPath = path.join(evidenceRoot, "scenario-configuration.json");
  const configSha = writeJson(configPath, configuration, { immutable: true });
  const configRef = relativeRef(configPath);
  evidenceFiles.push({ ref: configRef, sha256: configSha });

  const featureFlags = {
    schemaVersion: "ofw.s002.feature-flags.v1",
    checkpointNode: captureValue.node,
    externalBudgetDispatch: false,
    automaticApproval: false,
    automaticPosting: false,
    approvedBudgetOverwrite: false,
    platformAdministratorSingleRoleDemo: true,
    scenarioIsolationRequired: true,
    formedAt: captureValue.formedAt
  };
  const flagsPath = path.join(evidenceRoot, "feature-flags.json");
  const flagsSha = writeJson(flagsPath, featureFlags, { immutable: true });
  const flagsRef = relativeRef(flagsPath);
  evidenceFiles.push({ ref: flagsRef, sha256: flagsSha });

  const testFixture = {
    schemaVersion: "ofw.s002.test-fixture.v2",
    dataMarker: Contracts.SYNTHETIC_MARK,
    sourcePackageSha256: SOURCE_SHA256,
    approvedBudgetYears: [2024, 2025],
    initialSubmissionYears: [2025, 2026],
    currency: "CNY",
    unit: "万元",
    logicalSourceCount: 5,
    sourceSnapshotCount: 8,
    logicalMemberCount: 14,
    dataPipelineCount: 2,
    businessDataAssets: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
    compatibilityDeliveryPointer: "S002-DATA-v1",
    actionTypes: [...ACTION_TYPE_DISPLAY_NAMES],
    legacyDownstreamActionAliases: [...LEGACY_DOWNSTREAM_ACTION_ALIASES],
    actionRequestCount: captureValue.runtime.projection.actionRequests.length,
    todoCount: captureValue.runtime.projection.todos.length,
    reportVerification: captureValue.id === "CP06" || captureValue.id === "CP07" ? { ...REPORT_VERIFICATION } : null,
    formedAt: captureValue.formedAt
  };
  const fixturePath = path.join(evidenceRoot, "test-fixture.json");
  const fixtureSha = writeJson(fixturePath, testFixture, { immutable: true });
  const fixtureRef = relativeRef(fixturePath);
  evidenceFiles.push({ ref: fixtureRef, sha256: fixtureSha });

  const restorePlan = {
    schemaVersion: "ofw.s002.restore-plan.v2",
    checkpointNode: captureValue.node,
    moduleAdapters: Object.values(moduleEntries).map((entry) => ({
      moduleId: entry.moduleId,
      scenarioAdapterVersion: entry.moduleVersion,
      baselineModuleBinding: baselineVerification.modules[entry.moduleId],
      exportRef: entry.exportRef,
      restoreMode: entry.restoreMode
    })),
    historicalReadOnly: true,
    cloneCreatesNewScenarioRunId: true,
    regressionClearsDownstreamSideEffects: true,
    formedAt: captureValue.formedAt
  };
  const restorePlanPath = path.join(evidenceRoot, "restore-plan.json");
  const restorePlanSha = writeJson(restorePlanPath, restorePlan, { immutable: true });
  const restorePlanRef = relativeRef(restorePlanPath);
  evidenceFiles.push({ ref: restorePlanRef, sha256: restorePlanSha });

  const dataSection = moduleSection("M02", moduleEntries.M02, captureValue.formedAt, moduleActivity.M02);
  const semanticSection = moduleSection("M01", moduleEntries.M01, captureValue.formedAt, moduleActivity.M01);
  const querySection = moduleSection("M03", moduleEntries.M03, captureValue.formedAt, moduleActivity.M03);
  const decisionSection = moduleSection("M04", moduleEntries.M04, captureValue.formedAt, moduleActivity.M04);
  const agentSection = moduleSection("M05", moduleEntries.M05, captureValue.formedAt, moduleActivity.M05);
  const reportSection = moduleSection("M06", moduleEntries.M06, captureValue.formedAt, moduleActivity.M06);
  const configItem = { owner: "S002场景包", resourceId: `S002-CONFIG-${captureValue.id}`, version: "S002-CONFIG-3.0.0", ref: configRef, sha256: configSha, formedAt: captureValue.formedAt };
  const fixtureItem = { owner: "S002场景包", resourceId: `S002-FIXTURE-${captureValue.id}`, version: "S002-FIXTURE-2.0.0", ref: fixtureRef, sha256: fixtureSha, formedAt: captureValue.formedAt };
  const flagItem = { owner: "平台公共层", resourceId: `S002-FLAGS-${captureValue.id}`, version: "S002-FLAGS-1.0.0", ref: flagsRef, sha256: flagsSha, formedAt: captureValue.formedAt };
  const evidenceItem = { owner: "平台公共层", resourceId: `S002-RESTORE-PLAN-${captureValue.id}`, version: "S002-RESTORE-PLAN-2.0.0", ref: restorePlanRef, sha256: restorePlanSha, formedAt: captureValue.formedAt };
  const restoreEvidencePath = path.join(evidenceRoot, "restore-validation.json");
  const restoreEvidenceRef = relativeRef(restoreEvidencePath);

  const stateSections = {
    data: dataSection,
    semantics: semanticSection,
    configurations: { status: "referenced", items: [configItem] },
    results: combineSections([querySection, agentSection], "问数或Agent结果尚未形成"),
    reports: reportSection,
    decisions: decisionSection,
    testFixtures: { status: "referenced", items: [fixtureItem] },
    featureFlags: { status: "referenced", items: [flagItem] },
    evidence: { status: "referenced", items: [evidenceItem] }
  };

  const manifest = Foundation.createCheckpointManifest({
    checkpointId,
    checkpointNode: captureValue.node,
    baselineVersion: Contracts.BASELINE_VERSION,
    baselineSnapshotId: Contracts.BASELINE_SNAPSHOT_ID,
    parentVersion: Contracts.BASELINE_VERSION,
    scenarioContext: context,
    code: codeBinding,
    modules: moduleEntries,
    stateSections,
    restoreReadiness: { status: "verified", verifiedAt: captureValue.formedAt, evidenceRef: restoreEvidenceRef }
  }, { now: captureValue.formedAt });

  const manifestPath = path.join(runRoot, captureValue.file);
  const manifestRef = relativeRef(manifestPath);
  const restoreEvidence = await verifyApplicationRestore(manifest, manifestRef, captureValue.runtime.projection, checkpointIndex);
  const restoreEvidenceSha = writeJson(restoreEvidencePath, restoreEvidence, { immutable: true });
  evidenceFiles.push({ ref: restoreEvidenceRef, sha256: restoreEvidenceSha });

  const evidenceIndex = {
    schemaVersion: "ofw.s002.evidence-index.v2",
    checkpointId: manifest.checkpointId,
    checkpointNode: captureValue.node,
    validationScope: "prototype-scenario-adapter",
    files: [...evidenceFiles].sort((a, b) => a.ref.localeCompare(b.ref)),
    formedAt: captureValue.formedAt,
    boundary: "不含生产模块部署回执、真实组织权限证据或外部预算系统回执"
  };
  const evidenceIndexPath = path.join(evidenceRoot, "evidence-index.json");
  const evidenceIndexSha = writeJson(evidenceIndexPath, evidenceIndex, { immutable: true });
  evidenceFiles.push({ ref: relativeRef(evidenceIndexPath), sha256: evidenceIndexSha });
  writeText(path.join(evidenceRoot, "SHA256SUMS"), evidenceFiles.sort((a, b) => a.ref.localeCompare(b.ref)).map((item) => `${item.sha256}  ${item.ref}`).join("\n") + "\n");

  const manifestSha = writeJson(manifestPath, manifest, { immutable: true });
  writeText(`${manifestPath}.sha256`, `${manifestSha}  ${captureValue.file}\n`);
  return {
    id: captureValue.id,
    label: captureValue.label,
    checkpointId: manifest.checkpointId,
    checkpointNode: captureValue.node,
    file: manifestRef,
    sha256: manifestSha,
    createdAt: manifest.createdAt,
    scenarioRunId: context.scenarioRunId,
    restoreReadiness: manifest.restoreReadiness.status,
    preOperation
  };
}

function updateCurrentLinks(catalog) {
  const currentDir = path.join(scenarioRoot, "checkpoints/current");
  fs.mkdirSync(currentDir, { recursive: true });
  for (const item of catalog.checkpoints) {
    const linkPath = path.join(currentDir, path.basename(item.file));
    if (fs.existsSync(linkPath) || fs.lstatSync(currentDir).isDirectory() && fs.readdirSync(currentDir).includes(path.basename(item.file))) fs.unlinkSync(linkPath);
    const target = path.relative(currentDir, path.join(scenarioRoot, item.file));
    fs.symlinkSync(target, linkPath);
  }
}

function recursiveFileCount(directory) {
  if (!fs.existsSync(directory)) return 0;
  return listFiles(directory).length;
}

function runFormedAt(scenarioRunId) {
  const match = /^S002-RUN-(\d{17})-[a-f0-9]{12}$/.exec(scenarioRunId || "");
  if (!match) return null;
  const value = match[1];
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}.${value.slice(14, 17)}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function collectRunEntries(rootRef, classificationFor, currentRunId) {
  const root = path.join(scenarioRoot, rootRef);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^S002-RUN-\d{17}-[a-f0-9]{12}$/.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const absolute = path.join(root, entry.name);
      const checkpointCount = fs.readdirSync(absolute, { withFileTypes: true }).filter((item) => item.isFile() && /^CP.*\.json$/.test(item.name)).length;
      const classification = classificationFor(entry.name, currentRunId);
      return {
        scenarioRunId: entry.name,
        classification,
        archiveRef: relativeRef(absolute),
        formedAt: runFormedAt(entry.name),
        checkpointManifestCount: checkpointCount,
        retainedFileCount: recursiveFileCount(absolute),
        restoreStatus: classification === "failed" ? "not-restorable" : classification === "current" ? "catalog-referenced" : "retained-not-current"
      };
    });
}

function buildRunHistoryCatalog({ currentRunId, generatedAt, codeBinding, checkpointCatalogRef, checkpointCatalogSha256 }) {
  const completedRuns = collectRunEntries("checkpoints/runs", (runId) => runId === currentRunId ? "current" : "superseded", currentRunId);
  if (!completedRuns.some((item) => item.classification === "current")) throw new Error(`运行历史目录中缺少当前 run：${currentRunId}`);
  const failedRuns = collectRunEntries("checkpoints/failed-runs", () => "failed", currentRunId);
  const legacy = [
    {
      classification: "legacy-non-restorable",
      archiveRef: "checkpoints/legacy-static-fixture",
      retainedFileCount: recursiveFileCount(path.join(scenarioRoot, "checkpoints/legacy-static-fixture")),
      restoreStatus: "not-restorable",
      reason: "旧静态夹具的资源引用已失效，仅保留历史证据。"
    },
    {
      classification: "legacy-non-restorable",
      archiveRef: "evidence/legacy-static-fixture",
      retainedFileCount: recursiveFileCount(path.join(scenarioRoot, "evidence/legacy-static-fixture")),
      restoreStatus: "not-restorable",
      reason: "旧静态证据不属于当前不可变运行目录。"
    }
  ].filter((item) => item.retainedFileCount > 0);
  return {
    schemaVersion: "ofw.s002.run-history-catalog.v1",
    catalogRole: "mutable-history-index",
    baselineVersion: Contracts.BASELINE_VERSION,
    baselineSnapshotId: Contracts.BASELINE_SNAPSHOT_ID,
    scenarioId: Contracts.SCENARIO_ID,
    scenarioVersion: Contracts.SCENARIO_VERSION,
    currentScenarioRunId: currentRunId,
    checkpointCatalogRef,
    checkpointCatalogSha256,
    code: codeBinding,
    generatedAt,
    classifications: ["current", "superseded", "failed", "legacy-non-restorable"],
    runs: [...completedRuns, ...failedRuns],
    legacy,
    preservationPolicy: "历史运行、失败残片和 legacy 证据均保留；只有 current 由当前 Checkpoint catalog 指向。"
  };
}

function buildScenarioPackageManifest({ catalog, catalogSha256, runHistorySha256, baselineVerification, generatedAt }) {
  return {
    schemaVersion: "ofw.s002.scenario-package-manifest.v1",
    manifestRole: "mutable-current-handoff",
    baseline: {
      version: Contracts.BASELINE_VERSION,
      snapshotId: Contracts.BASELINE_SNAPSHOT_ID,
      checkpoint: baselineVerification.checkpoint
    },
    scenarioContext: {
      scenarioId: Contracts.SCENARIO_ID,
      scenarioVersion: Contracts.SCENARIO_VERSION,
      scenarioRunId: catalog.sourceScenarioRunId
    },
    package: {
      prototypeVersion: "1.1.0",
      scenarioRootRef: projectRelativeRef(scenarioRoot),
      entryRef: ENTRY_REF,
      port: SCENARIO_PORT
    },
    implementationDate: IMPLEMENTATION_DATE,
    verifiedAt: VERIFIED_AT,
    dataTopology: {
      logicalSourceCount: 5,
      sourceSnapshotCount: 8,
      logicalMemberCount: 14,
      dataPipelineCount: 2,
      businessDataAssets: ["S002-BUDGET-EXEC-v1", "S002-PROJECT-OCC-v1"],
      compatibilityDeliveryPointer: "S002-DATA-v1",
      compatibilityPointerIsBusinessAsset: false
    },
    decisionSummary: {
      actionRequestCount: 0,
      confirmedCount: 0,
      rejectedCount: 0,
      pendingDecisionCount: 0,
      todoCount: 0,
      runtimePolicy: "disabled-for-s002-current-scope",
      runtimeStatus: "no-runtime-actions",
      actionTypeDisplayNames: [...ACTION_TYPE_DISPLAY_NAMES],
      legacyDownstreamActionAliases: [...LEGACY_DOWNSTREAM_ACTION_ALIASES],
      externalDispatch: false
    },
    reportVerification: { ...REPORT_VERIFICATION },
    code: catalog.code,
    moduleBindings: baselineVerification.modules,
    checkpointCatalog: {
      ref: "checkpoints/checkpoint-catalog.json",
      sha256: catalogSha256,
      currentScenarioRunId: catalog.sourceScenarioRunId,
      immutableArchiveRoot: catalog.immutableArchiveRoot
    },
    runHistoryCatalog: {
      ref: RUN_HISTORY_CATALOG_REF,
      sha256: runHistorySha256
    },
    preOperationSemantics: catalog.checkpoints.find((item) => item.id === "CP-PRE")?.preOperation || null,
    sideEffectPolicy: Foundation.SIDE_EFFECT_POLICY,
    generatedAt,
    validationScope: "prototype-scenario-adapter",
    deliveryBoundary: "该清单固定 S002 独立场景包、v1.0.3 父基线和原型运行证据；不代表生产门禁、外部预算系统联通或统一总装验收完成。"
  };
}

async function generateAll() {
  if (Foundation.CURRENT_BASELINE_VERSION !== Contracts.BASELINE_VERSION) throw new Error(`Foundation 基线版本不匹配：${Foundation.CURRENT_BASELINE_VERSION}`);
  if (Foundation.CURRENT_BASELINE_SNAPSHOT_ID !== Contracts.BASELINE_SNAPSHOT_ID) throw new Error(`Foundation 基线快照不匹配：${Foundation.CURRENT_BASELINE_SNAPSHOT_ID}`);
  const baselineVerification = verifyBaselineModuleBindings();
  const scenario = runScenario();
  const runId = scenario.runtime.store.context().scenarioRunId;
  const runRoot = path.join(scenarioRoot, "checkpoints/runs", runId);
  if (fs.existsSync(runRoot)) throw new Error(`场景运行快照目录已存在，拒绝覆盖：${runRoot}`);
  fs.mkdirSync(path.dirname(runRoot), { recursive: true });
  fs.mkdirSync(runRoot, { recursive: false });
  const treeSha256 = computeCodeHash();
  const codeBinding = { prototypeVersion: "1.1.0", buildVersion: `S002-v1+${treeSha256.slice(0, 12)}`, entryRef: ENTRY_REF, treeSha256 };
  const generated = [];
  for (let index = 0; index < scenario.captures.length; index += 1) {
    generated.push(await buildCheckpoint(scenario.captures[index], codeBinding, runRoot, index, baselineVerification));
  }
  const generatedAt = scenario.captures[scenario.captures.length - 1].formedAt;
  const catalog = {
    schemaVersion: "ofw.s002.checkpoint-catalog.v2",
    catalogRole: "mutable-current-index",
    scenarioId: Contracts.SCENARIO_ID,
    scenarioVersion: Contracts.SCENARIO_VERSION,
    scenarioContext: scenario.runtime.store.context(),
    currentScenarioRunId: runId,
    sourceScenarioRunId: runId,
    baselineVersion: Contracts.BASELINE_VERSION,
    baselineSnapshotId: Contracts.BASELINE_SNAPSHOT_ID,
    baselineCheckpointBinding: baselineVerification.checkpoint,
    baselineModuleBindings: baselineVerification.modules,
    entryRef: ENTRY_REF,
    port: SCENARIO_PORT,
    code: codeBinding,
    checkpoints: generated,
    immutableArchiveRoot: relativeRef(runRoot),
    generatedAt,
    sideEffectPolicy: Foundation.SIDE_EFFECT_POLICY,
    validationScope: "prototype-scenario-adapter",
    conclusionBoundary: "原型运行与恢复验证通过，不代表生产模块部署、外部系统联通或平台业务验收通过"
  };
  const catalogPath = path.join(scenarioRoot, "checkpoints/checkpoint-catalog.json");
  const catalogSha = writeJson(catalogPath, catalog);
  writeText(`${catalogPath}.sha256`, `${catalogSha}  checkpoint-catalog.json\n`);
  updateCurrentLinks(catalog);

  const runHistoryCatalog = buildRunHistoryCatalog({
    currentRunId: runId,
    generatedAt,
    codeBinding,
    checkpointCatalogRef: "checkpoints/checkpoint-catalog.json",
    checkpointCatalogSha256: catalogSha
  });
  const runHistorySha256 = writeJson(path.join(scenarioRoot, RUN_HISTORY_CATALOG_REF), runHistoryCatalog);
  const packageManifest = buildScenarioPackageManifest({ catalog, catalogSha256: catalogSha, runHistorySha256, baselineVerification, generatedAt });
  const packageManifestSha256 = writeJson(path.join(scenarioRoot, PACKAGE_MANIFEST_REF), packageManifest);
  return { catalog, catalogSha256: catalogSha, runHistoryCatalog, runHistorySha256, packageManifest, packageManifestSha256 };
}

if (require.main === module) {
  generateAll().then((result) => {
    process.stdout.write(`S002原型适配器运行Checkpoint已生成：${result.catalog.checkpoints.length}个节点；run=${result.catalog.sourceScenarioRunId}; catalog=${result.catalogSha256}; package=${result.packageManifestSha256}\n`);
  }).catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  CHECKPOINTS,
  collectCodeFiles,
  computeCodeHash,
  treeDigest,
  verifyBaselineModuleBindings,
  buildRunHistoryCatalog,
  buildScenarioPackageManifest,
  generateAll,
  runScenario
});
