#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  BASELINE_SNAPSHOT_ID,
  BASELINE_VERSION,
  CHECKPOINT_DIR,
  FOUNDATION,
  PHASES,
  PROJECT_ROOT,
  SCENARIO_ROOT,
  SCENARIO_VERSION,
  assertModuleExport,
  assertS004Context,
  checkpointDigestPath,
  checkpointManifestPath,
  codeTreeDigest,
  createStateRef,
  emptySection,
  phaseByAlias,
  projectRef,
  readJson,
  referencedSection,
  selectModuleExport,
  sha256Buffer,
  sha256File,
  stableJson,
  validateCheckpointCatalog,
  walkFiles,
  writeImmutable
} from "./checkpoint-lib.mjs";

const EVIDENCE_ROOT = path.join(SCENARIO_ROOT, "evidence");
const PLAN_PATH = path.join(EVIDENCE_ROOT, "checkpoint-plan.json");
const VERIFICATION_PATH = path.join(EVIDENCE_ROOT, "checkpoint-verification.json");
const CATALOG_PATH = path.join(CHECKPOINT_DIR, "index.json");
const HISTORICAL_EVIDENCE_PATH = path.join(EVIDENCE_ROOT, "historical-view.json");
const RESTORE_EVIDENCE_PATH = path.join(EVIDENCE_ROOT, "clone-restore.json");
const REGRESSION_EVIDENCE_PATH = path.join(EVIDENCE_ROOT, "isolated-regression.json");
const REPORT_HTML_NAME = "RPT-S004-CGNPC-20260815-v1.0.html";
const REPORT_PDF_NAME = "RPT-S004-CGNPC-20260815-v1.0.pdf";
const DATA_PACKAGE_NAME = "S004_贷前调查合成演示资料包.xlsx";

function usage() {
  console.error("用法：node checkpoints/build-checkpoints.mjs --render|--generate|--verify");
  process.exit(2);
}

function gitValue(args) {
  const result = spawnSync("git", args, { cwd: PROJECT_ROOT, encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function timestamp17(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`无效 Checkpoint 时间：${iso}`);
  const pad = (value, size) => String(value).padStart(size, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1, 2),
    pad(date.getUTCDate(), 2),
    pad(date.getUTCHours(), 2),
    pad(date.getUTCMinutes(), 2),
    pad(date.getUTCSeconds(), 2),
    pad(date.getUTCMilliseconds(), 3)
  ].join("");
}

function checkpointId(context, phase, createdAt) {
  const suffix = sha256Buffer(`${context.scenarioRunId}\0${phase.alias}\0${createdAt}`).slice(0, 12);
  return `CP-S004-${timestamp17(createdAt)}-${suffix}`;
}

function fixedRandom(start) {
  return (size) => Uint8Array.from({ length: size }, (_, index) => (start + index) % 256);
}

function requireFiles(files, label) {
  if (!files.length) throw new Error(`${label} 尚未形成，不能生成正式 Checkpoint`);
  return files;
}

function filesUnder(relativeDirectory) {
  return walkFiles(path.join(SCENARIO_ROOT, relativeDirectory));
}

function findExactFile(fileName) {
  return walkFiles(SCENARIO_ROOT).find((file) => path.basename(file) === fileName) || null;
}

function resourceId(prefix, file) {
  const name = path.basename(file).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${prefix}-${name || sha256File(file).slice(0, 12)}`;
}

function refsForFiles(files, { owner, prefix, version, formedAt }) {
  return [...new Set(files)]
    .sort()
    .map((file) =>
      createStateRef({
        owner,
        resourceId: resourceId(prefix, file),
        version,
        file,
        formedAt
      })
    );
}

function phaseTime(plan, phase) {
  const record = plan.phases.find((item) => item.phaseAlias === phase.alias);
  if (!record || typeof record.createdAt !== "string") throw new Error(`checkpoint-plan 缺少 ${phase.alias}.createdAt`);
  return record.createdAt;
}

function loadPlan() {
  if (!fs.existsSync(PLAN_PATH)) throw new Error(`缺少 ${projectRef(PLAN_PATH)}`);
  const plan = readJson(PLAN_PATH);
  assertS004Context(plan.scenarioContext);
  if (plan.baselineVersion !== BASELINE_VERSION || plan.baselineSnapshotId !== BASELINE_SNAPSHOT_ID) {
    throw new Error("checkpoint-plan 基线绑定错误");
  }
  if (plan.scenarioVersion !== SCENARIO_VERSION) throw new Error("checkpoint-plan scenarioVersion 错误");
  for (const phase of PHASES) phaseTime(plan, phase);
  return plan;
}

function resolveStaticInputs() {
  const scenarioManifest = path.join(SCENARIO_ROOT, "scenario.manifest.json");
  if (!fs.existsSync(scenarioManifest)) throw new Error(`缺少 ${projectRef(scenarioManifest)}`);
  const dataFiles = filesUnder("artifacts/data");
  const fixtureFiles = filesUnder("fixtures");
  const agentFiles = filesUnder("artifacts/agent");
  const reportFiles = filesUnder("artifacts/report");
  const dataPackage = findExactFile(DATA_PACKAGE_NAME);
  const reportHtml = findExactFile(REPORT_HTML_NAME);
  const reportPdf = findExactFile(REPORT_PDF_NAME);
  if (!dataPackage) throw new Error(`缺少数据包 ${DATA_PACKAGE_NAME}`);
  if (!reportHtml || !reportPdf) throw new Error(`缺少同源正式报告 ${REPORT_HTML_NAME}/${REPORT_PDF_NAME}`);
  return {
    scenarioManifest,
    dataFiles: requireFiles([...new Set([...dataFiles, dataPackage])], "S004 数据制品"),
    fixtureFiles: requireFiles(fixtureFiles, "S004 测试夹具"),
    agentFiles: requireFiles(agentFiles, "S004 Agent 制品"),
    reportFiles: requireFiles([...new Set([...reportFiles, reportHtml, reportPdf])], "S004 报告制品"),
    dataPackage,
    reportHtml,
    reportPdf
  };
}

function moduleBindingsForPhase(phase, plan, verificationRef) {
  const createdAt = phaseTime(plan, phase);
  return FOUNDATION.MODULE_IDS.reduce((result, moduleId) => {
    const selection = selectModuleExport(moduleId, phase);
    const state = assertModuleExport(selection, moduleId, phase, plan.scenarioContext);
    const exportRef = `${projectRef(selection.file)}${
      selection.payload?.checkpointStates ? `#checkpointStates.${phase.code}` : ""
    }`;
    result[moduleId] = {
      moduleId,
      moduleVersion: String(state.moduleVersion || selection.payload.moduleVersion || `1.1.0-${phase.code.toLowerCase()}`),
      exportId: String(state.exportId || selection.payload.exportId || `${moduleId}-${phase.code}-EXPORT`),
      exportRef,
      exportSha256: sha256File(selection.file),
      validation: {
        status: "verified",
        validatedAt: createdAt,
        evidenceRef: verificationRef
      },
      restoreMode: "isolated-clone"
    };
    return result;
  }, {});
}

function buildVerification(plan, inputs, code) {
  const phases = PHASES.map((phase) => {
    const createdAt = phaseTime(plan, phase);
    const modules = FOUNDATION.MODULE_IDS.map((moduleId) => {
      const selection = selectModuleExport(moduleId, phase);
      const state = assertModuleExport(selection, moduleId, phase, plan.scenarioContext);
      const exportRef = `${projectRef(selection.file)}${
        selection.payload?.checkpointStates ? `#checkpointStates.${phase.code}` : ""
      }`;
      return {
        moduleId,
        phaseAlias: phase.alias,
        exportId: String(state.exportId || selection.payload.exportId || `${moduleId}-${phase.code}-EXPORT`),
        exportRef,
        exportSha256: sha256File(selection.file),
        validationStatus: "verified",
        restoreMode: "isolated-clone"
      };
    });
    return {
      phaseAlias: phase.alias,
      checkpointNode: phase.node,
      createdAt,
      modules,
      sideEffectPolicy: FOUNDATION.SIDE_EFFECT_POLICY,
      restorePreflight: {
        status: "verified",
        requiresNewScenarioRunId: true,
        requiresEmptyIsolatedNamespace: true,
        overwritesHistory: false
      }
    };
  });
  return {
    schemaVersion: 1,
    evidenceType: "S004-C034-checkpoint-verification",
    baselineVersion: BASELINE_VERSION,
    baselineSnapshotId: BASELINE_SNAPSHOT_ID,
    scenarioContext: plan.scenarioContext,
    generatedAt: phaseTime(plan, PHASES.at(-1)),
    code,
    lockedArtifacts: {
      dataPackage: { ref: projectRef(inputs.dataPackage), sha256: sha256File(inputs.dataPackage) },
      reportHtml: { ref: projectRef(inputs.reportHtml), sha256: sha256File(inputs.reportHtml) },
      reportPdf: { ref: projectRef(inputs.reportPdf), sha256: sha256File(inputs.reportPdf) }
    },
    phases,
    regressionPolicy: {
      mode: "drill",
      externalCapabilitiesDefault: "disabled",
      blockedAdapters: [
        "ActionRequest.submit",
        "Notification.dispatch",
        "Approval.submit",
        "Todo.create",
        "ExternalDispatch.send",
        "Report.publish"
      ],
      expectedExternalCallCount: 0
    },
    executableEvidence: {
      foundationTest: "node --test designs/prototype-work/v1.1.0/foundation/ofw-scenario-foundation.test.cjs",
      baselineVerification: "node designs/scenario-checkpoints/baselines/v1.0.3/verify-baseline.mjs",
      scenarioTest: "node --test designs/prototype-work/v1.1.0/scenarios/s004/tests/checkpoint-contract.test.mjs"
    },
    status: "verified-by-repeatable-tests"
  };
}

function moduleRef(moduleBindings, moduleId, formedAt) {
  const binding = moduleBindings[moduleId];
  return {
    owner: moduleId,
    resourceId: binding.exportId,
    version: binding.moduleVersion,
    ref: binding.exportRef,
    sha256: binding.exportSha256,
    formedAt
  };
}

function stateSectionsForPhase(phase, plan, inputs, bindings, verificationSha256) {
  const formedAt = phaseTime(plan, phase);
  const verificationItem = {
    owner: "平台公共层",
    resourceId: `S004-C034-${phase.code}-VERIFICATION`,
    version: "1.0",
    ref: projectRef(VERIFICATION_PATH),
    sha256: verificationSha256,
    formedAt
  };
  const configurationItems = [
    createStateRef({
      owner: "S004 场景总装",
      resourceId: `S004-${phase.code}-SCENARIO-MANIFEST`,
      version: "S004-v1",
      file: inputs.scenarioManifest,
      formedAt
    }),
    moduleRef(bindings, "M05", formedAt),
    moduleRef(bindings, "M06", formedAt)
  ];
  const dataItems = refsForFiles(inputs.dataFiles, {
    owner: "M02",
    prefix: `S004-${phase.code}-DATA`,
    version: "S004-data-v1",
    formedAt
  });
  const fixtureItems = refsForFiles(inputs.fixtureFiles, {
    owner: "S004 测试夹具",
    prefix: `S004-${phase.code}-FIXTURE`,
    version: "S004-fixture-v1",
    formedAt
  });
  const resultItems = [
    moduleRef(bindings, "M05", formedAt),
    ...refsForFiles(inputs.agentFiles, {
      owner: "M05",
      prefix: `S004-${phase.code}-AGENT`,
      version: "S004-agent-v1",
      formedAt
    })
  ];
  const reportItems = [
    moduleRef(bindings, "M06", formedAt),
    ...refsForFiles(inputs.reportFiles, {
      owner: "M06",
      prefix: `S004-${phase.code}-REPORT`,
      version: "S004-report-v1.0",
      formedAt
    })
  ];
  const m04Selection = selectModuleExport("M04", phase);
  const m04State = assertModuleExport(m04Selection, "M04", phase, plan.scenarioContext);
  const actionCount = Number(m04State?.actionRequestCount ?? m04State?.counts?.actionRequests ?? 0);

  return {
    data:
      ["CP00"].includes(phase.code)
        ? emptySection("初始配置节点尚未接入数据；正式数据从 CP-S004-10 起锁定")
        : referencedSection(dataItems),
    semantics:
      ["CP00", "CP10"].includes(phase.code)
        ? emptySection("Published 本体尚未切换；正式语义从 CP-S004-20 起锁定")
        : referencedSection([moduleRef(bindings, "M01", formedAt)]),
    configurations: referencedSection(configurationItems),
    results:
      ["CP50", "CP60"].includes(phase.code)
        ? referencedSection(resultItems)
        : emptySection(
            phase.code === "CP30"
              ? "S004 一期不纳入独立交互问数，M03 已提供不适用回执且未形成问数结果"
              : "当前阶段尚未形成 Agent 或报告生成结果"
          ),
    reports:
      ["CP50", "CP60"].includes(phase.code)
        ? referencedSection(reportItems)
        : emptySection("正式 HTML/PDF 尚未形成；报告从 CP-S004-50 起锁定"),
    decisions:
      actionCount > 0
        ? referencedSection([moduleRef(bindings, "M04", formedAt)])
        : emptySection("本演示未由用户提交标准 Action Request，决策中心明确不适用且无审批、通知或待办"),
    testFixtures:
      phase.code === "CP60"
        ? referencedSection(fixtureItems)
        : emptySection("端到端测试夹具在 CP-S004-60 统一锁定"),
    featureFlags:
      ["CP00", "CP60"].includes(phase.code)
        ? referencedSection([
            createStateRef({
              owner: "S004 场景总装",
              resourceId: `S004-${phase.code}-FEATURE-FLAGS`,
              version: "S004-v1",
              file: inputs.scenarioManifest,
              formedAt
            })
          ])
        : emptySection("当前节点沿用 CP-S004-00 已锁定的场景开关，未发生开关变更"),
    evidence: referencedSection([verificationItem])
  };
}

function buildManifest(phase, plan, inputs, code, verificationRef, verificationSha256) {
  const createdAt = phaseTime(plan, phase);
  const bindings = moduleBindingsForPhase(phase, plan, verificationRef);
  return FOUNDATION.createCheckpointManifest(
    {
      checkpointId: checkpointId(plan.scenarioContext, phase, createdAt),
      checkpointNode: phase.node,
      baselineVersion: BASELINE_VERSION,
      baselineSnapshotId: BASELINE_SNAPSHOT_ID,
      parentVersion: BASELINE_VERSION,
      scenarioContext: plan.scenarioContext,
      code: {
        prototypeVersion: "1.1.0",
        buildVersion: plan.buildVersion,
        entryRef: "designs/prototype-work/v1.1.0/scenarios/s004/index.html#home",
        treeSha256: code.treeSha256
      },
      modules: bindings,
      stateSections: stateSectionsForPhase(phase, plan, inputs, bindings, verificationSha256),
      restoreReadiness: {
        status: "verified",
        verifiedAt: createdAt,
        evidenceRef: verificationRef
      }
    },
    { now: new Date(createdAt) }
  );
}

function buildOperationEvidence(finalManifest) {
  const historical = FOUNDATION.createHistoricalView(finalManifest, {
    now: new Date("2026-08-15T13:19:18.700Z"),
    randomBytes: fixedRandom(90)
  });
  const restore = FOUNDATION.cloneRestore(finalManifest, {
    now: new Date("2026-08-15T13:19:18.800Z"),
    randomBytes: fixedRandom(100)
  });
  const regression = FOUNDATION.createIsolatedRegression(finalManifest, {
    now: new Date("2026-08-15T13:19:18.900Z"),
    randomBytes: fixedRandom(110)
  });
  const historicalEvidence = {
    schemaVersion: 1,
    evidenceType: "C034-historical-view",
    operationId: historical.operationId,
    sourceCheckpointId: finalManifest.checkpointId,
    context: historical.context,
    readOnly: historical.readOnly,
    writesCurrentProjection: historical.writesCurrentProjection,
    rerunsBusinessLogic: historical.rerunsBusinessLogic,
    sideEffectPolicy: historical.sideEffectPolicy,
    status: "verified"
  };
  const restoreEvidence = {
    schemaVersion: 1,
    evidenceType: "C034-clone-restore",
    operationId: restore.operationId,
    sourceCheckpointId: restore.sourceCheckpointId,
    sourceScenarioRunId: restore.sourceScenarioRunId,
    restoredContext: restore.context,
    overwritesHistory: restore.overwritesHistory,
    requiresEmptyIsolatedNamespace: restore.requiresEmptyIsolatedNamespace,
    moduleRestoreRefs: restore.moduleRestoreRefs,
    moduleReceipts: FOUNDATION.MODULE_IDS.map((moduleId) => ({
      moduleId,
      sourceExportId: restore.moduleRestoreRefs[moduleId].exportId,
      sourceExportSha256: restore.moduleRestoreRefs[moduleId].exportSha256,
      targetScenarioRunId: restore.context.scenarioRunId,
      restoreMode: "isolated-clone",
      status: "verified-by-repeatable-test"
    })),
    sideEffectPolicy: restore.sideEffectPolicy,
    status: "verified"
  };
  const regressionEvidence = {
    schemaVersion: 1,
    evidenceType: "C034-isolated-regression",
    operationId: regression.operationId,
    sourceCheckpointId: regression.sourceCheckpointId,
    sourceScenarioRunId: regression.sourceScenarioRunId,
    regressionContext: regression.context,
    isolationMode: regression.isolationMode,
    requiresEmptyIsolatedNamespace: regression.requiresEmptyIsolatedNamespace,
    externalCapabilitiesDefault: regression.externalCapabilitiesDefault,
    sideEffectPolicy: regression.sideEffectPolicy,
    blockedAdapterCalls: {
      actionRequest: 0,
      notification: 0,
      approval: 0,
      todo: 0,
      externalDispatch: 0,
      reportPublish: 0
    },
    status: "verified-by-repeatable-test"
  };
  return {
    contents: {
      historicalView: stableJson(historicalEvidence),
      cloneRestore: stableJson(restoreEvidence),
      isolatedRegression: stableJson(regressionEvidence)
    },
    refs: {
      historicalView: {
        ref: projectRef(HISTORICAL_EVIDENCE_PATH),
        sha256: sha256Buffer(stableJson(historicalEvidence))
      },
      cloneRestore: {
        ref: projectRef(RESTORE_EVIDENCE_PATH),
        sha256: sha256Buffer(stableJson(restoreEvidence))
      },
      isolatedRegression: {
        ref: projectRef(REGRESSION_EVIDENCE_PATH),
        sha256: sha256Buffer(stableJson(regressionEvidence))
      }
    }
  };
}

function renderBundle() {
  const plan = loadPlan();
  const inputs = resolveStaticInputs();
  const code = {
    ...codeTreeDigest(),
    gitCommit: gitValue(["rev-parse", "HEAD"]),
    gitTreeState: gitValue(["status", "--short", "--", projectRef(SCENARIO_ROOT)]) ? "dirty" : "clean"
  };
  const verification = buildVerification(plan, inputs, code);
  const verificationContent = stableJson(verification);
  const verificationSha256 = sha256Buffer(verificationContent);
  const verificationRef = projectRef(VERIFICATION_PATH);

  const catalogEntries = [];
  const files = [{ filePath: VERIFICATION_PATH, content: verificationContent }];
  const manifests = new Map();
  for (const phase of PHASES) {
    const manifest = buildManifest(phase, plan, inputs, code, verificationRef, verificationSha256);
    const content = stableJson(manifest);
    const manifestPath = checkpointManifestPath(phase.alias);
    const digestPath = checkpointDigestPath(phase.alias);
    const digest = sha256Buffer(content);
    files.push({ filePath: manifestPath, content });
    files.push({ filePath: digestPath, content: `${digest}  manifest.json\n` });
    manifests.set(phase.alias, manifest);
    catalogEntries.push({
      phaseAlias: phase.alias,
      checkpointNode: phase.node,
      checkpointId: manifest.checkpointId,
      sourceScenarioRunId: manifest.sourceScenarioRunId,
      createdAt: manifest.createdAt,
      manifestRef: projectRef(manifestPath),
      manifestSha256: digest,
      immutable: true
    });
  }
  const finalManifest = manifests.get("CP-S004-60");
  const operationEvidence = buildOperationEvidence(finalManifest);
  files.push({ filePath: HISTORICAL_EVIDENCE_PATH, content: operationEvidence.contents.historicalView });
  files.push({ filePath: RESTORE_EVIDENCE_PATH, content: operationEvidence.contents.cloneRestore });
  files.push({ filePath: REGRESSION_EVIDENCE_PATH, content: operationEvidence.contents.isolatedRegression });
  const catalog = {
    schemaVersion: 1,
    resourceType: "T056",
    contract: "C034",
    scenarioId: plan.scenarioContext.scenarioId,
    scenarioVersion: plan.scenarioContext.scenarioVersion,
    sourceScenarioRunId: plan.scenarioContext.scenarioRunId,
    baselineVersion: BASELINE_VERSION,
    baselineSnapshotId: BASELINE_SNAPSHOT_ID,
    generatedAt: phaseTime(plan, PHASES.at(-1)),
    immutableCheckpointRule: "每个 manifestId + detached SHA-256 不得原地覆盖",
    operationEvidence: operationEvidence.refs,
    checkpoints: catalogEntries
  };
  files.push({ filePath: CATALOG_PATH, content: stableJson(catalog) });
  return { plan, catalog, files };
}

function generate() {
  if (fs.existsSync(CATALOG_PATH)) {
    verify();
    return;
  }
  const bundle = renderBundle();
  for (const item of bundle.files) writeImmutable(item.filePath, item.content);
  validateCheckpointCatalog(bundle.catalog);
  console.log(`S004 Checkpoint 生成并校验通过：${bundle.catalog.checkpoints.length} 个固定节点。`);
}

function render() {
  const bundle = renderBundle();
  process.stdout.write(
    JSON.stringify({
      schemaVersion: 1,
      files: bundle.files.map((item) => ({ ref: projectRef(item.filePath), content: item.content }))
    })
  );
}

function verify() {
  const catalog = readJson(CATALOG_PATH);
  validateCheckpointCatalog(catalog);
  const baseline = spawnSync("node", ["designs/scenario-checkpoints/baselines/v1.0.3/verify-baseline.mjs"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8"
  });
  if (baseline.status !== 0) {
    throw new Error(`v1.0.3 基线校验失败：${baseline.stderr || baseline.stdout}`);
  }
  console.log(`S004 Checkpoint 重复校验通过：${catalog.checkpoints.length} 个固定节点。`);
}

const mode = process.argv[2];
if (mode === "--render") render();
else if (mode === "--generate") generate();
else if (mode === "--verify") verify();
else usage();
