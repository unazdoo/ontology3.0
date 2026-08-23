"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const ARTIFACT_NAMES = [
  "sourceSnapshot", "publishedResources", "c008Facts", "quality", "c017",
  "agentConfig", "reportDefinition", "evidencePackage", "draftOutput", "reportData",
  "deterministicVerification", "humanConfirmation", "publicationManifest"
];

function inlineDemoArtifacts() {
  return Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, { artifact: name, source: "inline-demo" }]));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

class MemoryStorage {
  constructor() { this.records = new Map(); }
  get length() { return this.records.size; }
  key(index) { return Array.from(this.records.keys())[index] ?? null; }
  getItem(key) { return this.records.has(String(key)) ? this.records.get(String(key)) : null; }
  setItem(key, value) { this.records.set(String(key), String(value)); }
  removeItem(key) { this.records.delete(String(key)); }
}

function createSandbox() {
  const sandbox = {
    location: { protocol: "http:", origin: "http://127.0.0.1:4339", href: "http://127.0.0.1:4339/x/index.html" },
    localStorage: new MemoryStorage(),
    document: {
      body: { innerHTML: "", appendChild() {} },
      createElement: () => ({ src: "" }),
      getElementById: () => null,
      addEventListener() {}
    },
    fetch: () => Promise.resolve({ ok: false }),
    addEventListener() {},
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    dispatchEvent() {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.crypto = require("node:crypto").webcrypto;
  sandbox.TextEncoder = TextEncoder;
  const load = (file) => {
    const moduleObj = { exports: {} };
    new Function("window", "globalThis", "module", "self", fs.readFileSync(file, "utf8"))(sandbox, sandbox, moduleObj, sandbox);
    return moduleObj.exports;
  };
  load(path.resolve(RUNTIME_DIR, "../../foundation/ofw-scenario-foundation.js"));
  const adapterApi = load(path.join(RUNTIME_DIR, "ofw-baseline-module-adapter.js"));
  load(path.join(RUNTIME_DIR, "seed-data.js"));
  return { sandbox, adapterApi };
}

function scenarioConfig() {
  return {
    scenarioId: "S004", scenarioVersion: "S004-v2.1.0", baselineVersion: "v1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26", name: "财务公司贷款贷前调查",
    organization: "财务公司", focus: "贷前调查", dataAsOf: "2026-08-15",
    moduleSources: { M01: "a", M02: "b", M03: "c", M04: "d", M05: "e", M06: "f" }, workflow: [],
    runtimeConfig: { artifactMode: "inline-demo", inlineArtifacts: inlineDemoArtifacts() }
  };
}

async function installAndBootNativeSeeder(sandbox, adapter) {
  sandbox.__OFW_S004_NATIVE_SEEDER_DISABLE_AUTOBOOT__ = true;
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  await sandbox.OFW_S004_NativeSeeder.boot(adapter, { storage: sandbox.localStorage });
}

test("S004 种子写入六模块原生存储键且身份一致", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  const context = adapter.context();

  await installAndBootNativeSeeder(sandbox, adapter);

  const S = sandbox.OFW_S004_SeedData;
  const read = (key) => JSON.parse(sandbox.localStorage.getItem(key));
  const keys = S.keys;
  for (const key of [keys.C033_PLATFORM_KEY, keys.SCENARIO_RUNTIME_KEY, keys.C008_PROJECTION_KEY, keys.C017_REPORT_KEY, keys.M01_STATE_KEY, keys.M02_FLOW_KEY, keys.M03_STATE_KEY, keys.M03_WORKSPACE_KEY, keys.M03_C017_KEY, keys.M04_STATE_KEY, keys.M04_INBOX_KEY, keys.M04_C017_KEY, keys.M04_C019_KEY, keys.M05_STATE_KEY, keys.M06_STATE_KEY]) {
    assert.ok(sandbox.localStorage.getItem(key), `缺少种子键 ${key}`);
  }

  const runId = context.scenarioRunId;
  const expectCtx = (value, label) => {
    assert.equal(value.scenarioId, "S004", label);
    assert.equal(value.scenarioRunId, runId, label);
  };

  expectCtx(read(keys.C033_PLATFORM_KEY), "C033 平台键");
  expectCtx(read(keys.SCENARIO_RUNTIME_KEY), "平台场景运行键");
  const c008 = read(keys.C008_PROJECTION_KEY);
  expectCtx(c008.scenarioContext, "C008 包络");
  assert.equal(c008.schemaVersion, 1);
  assert.equal(c008.contractCode, "C008");
  assert.equal(c008.sourceModule, "本体管理");
  assert.ok(c008.current.t019.recordId && c008.current.t019.evidenceId);
  assert.equal(c008.artifactProjection.mode, "EXPLICIT_IMMUTABLE_ARTIFACT_PROJECTION");
  assert.equal(c008.artifactProjection.sourceScenarioContext.scenarioVersion, "S004-v2");
  assert.equal(c008.artifactProjection.sourceScenarioContext.scenarioRunId, "S004-RUN-20260815233000000-7f3c8e42a1b6");
  assert.equal(c008.artifactProjection.targetRuntimeScenarioContext.scenarioRunId, runId);
  assert.equal(c008.artifactProjection.sourceMutationAllowed, false);
  const c017 = read(keys.C017_REPORT_KEY);
  assert.equal(c017.consumer, "报告中心");
  assert.equal(c017.projections[0].dataVersion, c008.current.dataVersion);
  assert.equal(c017.projections[0].refresh.t018EvidenceId, S.identities.T018_EVIDENCE_ID);
  assert.equal(c017.projections[0].versionBindingSummary.t006, S.identities.M02_T006);
  assert.equal(c017.projections[0].versionBindingSummary.t007, S.identities.M02_ASSET_VERSION);
  assert.notEqual(c017.projections[0].refresh.t018EvidenceId, c008.current.t019.evidenceId);
  const c022Inbox = read(keys.C022_INBOX_KEY);
  assert.equal(c022Inbox.length, 1);
  assert.match(c022Inbox[0].reportContext.trustAtGeneration.currentStatusSummaryId, new RegExp(runId));
  assert.equal(c022Inbox[0].reportContext.trustAtGeneration.owner, "本制品未声明");

  const m01 = read(keys.M01_STATE_KEY);
  assert.equal(m01.activeScenarioId, "S004");
  assert.equal(m01.drafts.length, 1);
  assert.equal(m01.publishedVersions.length, 1);
  expectCtx(m01.scenarioContexts.S004, "M01 场景上下文");
  [m01.drafts[0].scenarioContext, m01.publishedVersions[0].scenarioContext].forEach((value, index) => {
    ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].forEach((field) => {
      assert.equal(value[field], m01.scenarioContexts.S004[field], `M01 第 ${index} 处场景五字段不一致`);
    });
  });
  const draft = m01.drafts[0];
  assert.ok(draft.objects.length === 8 && draft.links.length === 5 && draft.metrics.length === 6 && draft.rules.length === 4);
  const published = m01.publishedVersions[0];
  assert.equal(published.validationSnapshot.status, "passed");
  assert.equal(published.validationSnapshot.groups.every((group) => group.status === "passed"), true);
  assert.equal(published.resourceManifestSnapshot.resources.length, published.objects.length + published.properties.length + published.links.length + published.metrics.length + published.rules.length + published.actions.length);
  assert.ok(m01.recordsByVersion[published.id].some((record) => record.contractCode === "C029" && record.formsContract));
  assert.ok(m01.recordsByVersion[published.id].some((record) => record.resourceRef === "T018" && record.formsContract));
  assert.ok(m01.recordsByVersion[published.id].some((record) => record.resourceRef === "T019" && record.formsContract));

  const m02 = read(keys.M02_FLOW_KEY);
  expectCtx(m02.scenarioContext, "M02 flow 场景上下文");
  assert.equal(m02.customSources.length, 2);
  const officialSource = m02.customSources.find((item) => item.id === "s004-official-annual-reports");
  assert.equal(officialSource.category, "正式财务报告");
  assert.equal(officialSource.access, "既有权威资料复用");
  assert.doesNotMatch(officialSource.access, /上传/);
  assert.equal(m02.customAssets.length, 1);
  assert.equal(m02.assetVersions.length, 1);
  assert.equal(m02.assetVersions[0].t019Status, "已采用");
  assert.equal(m02.consumptionStatus, "ready");
  assert.equal(m02.authorityVersionIds[S.identities.M02_T006], S.identities.M02_ASSET_VERSION);

  const m03 = read(keys.M03_STATE_KEY);
  expectCtx(m03.scenarioContext, "M03 问数场景");
  assert.equal(m03.schemaVersion, 20);
  assert.equal(m03.currentScenario, "S004");
  assert.equal(m03.scenarioApplicability.status, "NOT_APPLICABLE");
  assert.equal(m03.activeConfig.status, "不适用");
  assert.deepEqual(m03.activeConfig.allowedResources, []);
  assert.deepEqual(m03.activeConfig.allowedActions, []);
  assert.equal(m03.activeConfig.executionPolicy.mayRun, false);
  assert.equal(m03.activeConfig.executionPolicy.maySubmitActionRequest, false);
  assert.deepEqual(m03.liveRuns, []);
  assert.deepEqual(m03.historyRuns, []);
  assert.deepEqual(m03.savedViews, []);
  assert.deepEqual(m03.pins, []);
  const m03c017 = read(keys.M03_C017_KEY);
  assert.equal(m03c017.contractCode, "C017");
  assert.equal(m03c017.consumer, "智能问数");
  assert.equal(m03c017.readStatus, "empty");
  assert.equal(m03c017.applicability, "NOT_APPLICABLE");
  assert.equal(m03c017.allowConsumption, false);
  assert.equal(m03c017.mayRun, false);
  assert.equal(m03c017.maySubmitActionRequest, false);
  assert.deepEqual(m03c017.projections, []);
  expectCtx(m03c017.scenarioContext, "M03 C017 场景");

  const m04 = read(keys.M04_STATE_KEY);
  expectCtx(m04.scenarioContext, "M04 决策场景");
  assert.equal(m04.schemaVersion, 6);
  assert.equal(m04.currentScenario, "S004");
  assert.equal(m04.scenarioApplicability.status, "EMPTY_ACTION_REQUEST_QUEUE");
  assert.deepEqual(m04.requests, []);
  assert.deepEqual(m04.tasks, []);
  assert.deepEqual(m04.activity, []);
  const m04Inbox = read(keys.M04_INBOX_KEY);
  assert.equal(m04Inbox.contractCode, "C011");
  assert.deepEqual(m04Inbox.requests, []);
  expectCtx(m04Inbox.scenarioContext, "M04 C011 场景");
  const m04c017 = read(keys.M04_C017_KEY);
  assert.equal(m04c017.contractCode, "C017");
  assert.equal(m04c017.consumer, "决策中心");
  expectCtx(m04c017.scenarioContext, "M04 C017 场景");
  const m04c019 = read(keys.M04_C019_KEY);
  assert.equal(m04c019.contractCode, "C019");
  assert.deepEqual(m04c019.records, []);

  const m05 = read(keys.M05_STATE_KEY);
  assert.equal(m05.schemaVersion, 23);
  assert.equal(m05.staticCatalogStoredAsReference, true);
  assert.equal(m05.artifactProjection.sourceScenarioContext.scenarioRunId, "S004-RUN-20260815233000000-7f3c8e42a1b6");
  assert.equal(m05.artifactProjection.targetRuntimeScenarioContext.scenarioRunId, runId);
  assert.equal(m05.evidencePackages[0].sourceArtifactScenarioContext.scenarioVersion, "S004-v2");
  assert.equal(m05.scenarioAccess.mode, "APPEND_NEW_RUNS_PRESERVE_HISTORY");
  assert.match(m05.scenarioAccess.label, /当前隔离轮次可运行/);
  assert.ok(m05.scenarioAccess.allowedActions.includes("接收完整 C022/C024"));
  assert.ok(m05.scenarioAccess.allowedActions.includes("基于当前 Release 创建新草稿"));
  assert.ok(m05.scenarioAccess.allowedActions.includes("验证草稿并发布新的 Agent Release"));
  assert.ok(m05.scenarioAccess.blockedActions.includes("覆盖历史 Run/Result/Session"));
  assert.ok(m05.scenarioAccess.blockedActions.includes("原地修改已发布 Agent Release"));
  assert.equal(m05.scenarioAccess.blockedActions.includes("修改或发布 Agent Release"), false);
  assert.equal(m05.agentOverrides[0].status, "enabled");
  assert.deepEqual(m05.agentOverrides[0].releases[0].aiSuggestionSlots, ["riskControllabilityJudgements", "creditComprehensiveJudgement"]);
  assert.equal(m05.agentOverrides[0].purpose, "依据报告中心固定的证据包，生成贷前调查报告结构化草稿。");
  assert.match(m05.agentOverrides[0].releases[0].confirmationPolicy, /AI 建议.*必须人工确认/);
  assert.equal(m05.agentOverrides[0].releases[0].scenarioBinding.status, "ready");
  expectCtx(m05.currentScenarioContext, "M05 当前场景");
  assert.equal(m05.runs[0].snapshot.evidenceId, m05.evidencePackages[0].id);
  const draftRun = m05.runs.find((item) => item.snapshot?.agentId === "report-draft");
  const companionRun = m05.runs.find((item) => item.snapshot?.agentId === "report-copilot");
  assert.equal(draftRun.sessionId, null, "报告草稿 Run 不得冒充报告伴读 Session");
  assert.equal(draftRun.snapshot.reportNumber, S.identities.REPORT_NO);
  assert.equal(draftRun.snapshot.semanticVersionId, c008.current.semanticVersionId);
  assert.equal(draftRun.snapshot.dataAssetVersionId, m05.evidencePackages[0].dataAssetVersionId);
  assert.equal(draftRun.snapshot.credibility.currentStateSummary.sourceOwner, "本制品未声明");
  assert.equal(draftRun.snapshot.credibility.agentGates.find((gate) => gate.id === "new-run").status, "ready");
  assert.equal(draftRun.snapshot.credibility.agentGates.find((gate) => gate.id === "report-draft-transfer").status, "ready");
  assert.match(draftRun.result.summary, /AI 建议/);
  assert.match(draftRun.result.sections.find((section) => section.title.includes("授信结论")).body, /人工确认/);
  assert.equal(companionRun.result.destination, "已返回报告中心伴读界面");
  assert.equal(companionRun.result.owner, "Agent 应用（M05）");
  assert.equal(companionRun.result.generatedAt != null, true);
  assert.equal(companionRun.result.freshness, "截至时间已确认");
  assert.equal(companionRun.result.confidence, "固定证据引用完整；不重算正式指标");
  assert.equal(m05.sessions.length, 1);
  assert.equal(m05.sessions[0].latestRunId, companionRun.id);
  assert.match(m05.sessions[0].verificationRunRef, /S004/);
  assert.equal(m05.sessions[0].currentComparisonRef, null);
  assert.match(m05.sessions[0].regenerationStatus, /可接收新的完整 C024/);

  const m06 = read(keys.M06_STATE_KEY);
  assert.equal(m06.artifactProjection.mode, "EXPLICIT_IMMUTABLE_ARTIFACT_PROJECTION");
  assert.equal(m06.report.sourceArtifactScenarioContext.scenarioVersion, "S004-v2");
  assert.equal(m06.report.sourceArtifactScenarioContext.scenarioRunId, "S004-RUN-20260815233000000-7f3c8e42a1b6");
  assert.equal(m06.report.runtimeProjectionContext.scenarioRunId, runId);
  assert.equal(m06.report.artifactProjectionId, m06.artifactProjection.projectionId);
  assert.equal(m06.stateVersion, 4);
  assert.equal(m06.report.stage, "published");
  assert.equal(m06.report.reportNo, S.identities.REPORT_NO);
  assert.equal(m06.report.evidencePackId, S.identities.EVIDENCE_PACK_ID);
  assert.ok(m06.report.frozenHtml.length > 0);
  assert.equal(m06.report.evidencePacks[0].template.downloads.html, "RT-S004-PREFLIGHT-002-v2.0.0.html");
  assert.equal(m06.report.evidencePacks[0].template.confirmationLabel, "【需人工确认】");
  assert.match(m06.customDefinitions[0].review, /基于已固化资料与系统事实的 AI 建议/);
  assert.equal(m06.report.bindingSnapshot.dataVersion, c008.current.dataVersion);

  const marker = JSON.parse(sandbox.localStorage.getItem("ofw:v1.1.0:s004-runtime:native-seed"));
  assert.equal(marker.scenarioRunId, runId);
  assert.equal(marker.phase, "seeded");
  assert.equal(marker.recovery.version, 2);
  assert.equal(marker.recovery.scenarioContext.scenarioRunId, runId);
  assert.equal(marker.recovery.mode, "PARENT_NATIVE_RESEED");
  assert.equal(marker.recovery.source, "immutable-http-artifacts");
  assert.ok(marker.recovery.stateKeys.includes(keys.M05_STATE_KEY));
  assert.ok(marker.recovery.stateKeys.includes(keys.M06_STATE_KEY));
  assert.equal(marker.seedVersion, 22);
  assert.equal(marker.artifactFingerprint.algorithm, "SHA-256");
  assert.deepEqual(Object.keys(marker.artifactFingerprint.items).sort(), ARTIFACT_NAMES.slice().sort());
  assert.match(marker.artifactFingerprint.items.publishedResources.sha256, /^[a-f0-9]{64}$/);
  assert.match(marker.artifactFingerprint.items.c008Facts.sha256, /^[a-f0-9]{64}$/);
  assert.equal(marker.artifactManifestSha256, marker.artifactFingerprint.manifestSha256);
  assert.equal(Object.prototype.hasOwnProperty.call(marker.recovery, "m05"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(marker.recovery, "m06"), false);
});

test("正式 HTML 在报告中心以受控正文片段呈现并标注 AI 建议需人工确认", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  await installAndBootNativeSeeder(sandbox, adapter);

  const raw = "<!doctype html><html><head><style>body{width:210mm}</style></head><body><main class='report'><div class='no-print'>已发布</div><section><p class='human-input'><span>【人工输入】</span>建议正文</p></section></main></body></html>";
  const prepared = sandbox.OFW_S004_NativeSeeder.prepareReportHtmlForReader(raw);
  assert.match(prepared, /class="report-paper s004-formal-report"/);
  assert.match(prepared, /【需人工确认】/);
  assert.match(prepared, /AI 建议（基于已固化资料与系统事实生成）/);
  assert.doesNotMatch(prepared, /【人工输入】/);
  assert.doesNotMatch(prepared, /class=['"]no-print/);
  assert.doesNotMatch(prepared, /<html|<body|body\{width:210mm/);
});

test("同一轮次不重复播种，重置换轮次后重播", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  await installAndBootNativeSeeder(sandbox, adapter);

  const M06_KEY = "ontology3.report-center.lifecycle-review.v1";
  const firstRunId = JSON.parse(sandbox.localStorage.getItem("ofw:v1.1.0:s004-runtime:native-seed")).scenarioRunId;
  const mutated = JSON.parse(sandbox.localStorage.getItem(M06_KEY));
  mutated.report.reportNo = "MUTATED-BY-USER";
  sandbox.localStorage.setItem(M06_KEY, JSON.stringify(mutated));

  await sandbox.OFW_S004_NativeSeeder.boot(adapter, { storage: sandbox.localStorage });
  assert.equal(JSON.parse(sandbox.localStorage.getItem(M06_KEY)).report.reportNo, "MUTATED-BY-USER");

  const S = sandbox.OFW_S004_SeedData;
  const pendingRequestId = "C024-S004-PENDING-TEST";
  const pendingM06 = JSON.parse(sandbox.localStorage.getItem(M06_KEY));
  pendingM06.assistant.requestRef = { requestId: pendingRequestId, runId: null, resultId: null, sessionId: null };
  pendingM06.report.postPublicationVerification = {
    status: "run_failed",
    runId: "VRF-S004-FAILED-CURRENT",
    results: [],
    coverage: { status: "error", pending: 0, error: 1 }
  };
  sandbox.localStorage.setItem(M06_KEY, JSON.stringify(pendingM06));
  const pendingM05 = JSON.parse(sandbox.localStorage.getItem(S.keys.M05_STATE_KEY));
  pendingM05.agentOverrides.forEach((agent) => { agent.status = "disabled"; });
  pendingM05.inboundRequests.unshift({
    id: pendingRequestId,
    sourceRequestId: pendingRequestId,
    type: "report-copilot",
    status: "received",
    scenarioContext: { ...adapter.context() }
  });
  sandbox.localStorage.setItem(S.keys.M05_STATE_KEY, JSON.stringify(pendingM05));
  sandbox.localStorage.setItem(S.keys.C024_INBOX_KEY, JSON.stringify([{
    requestId: pendingRequestId,
    status: "received",
    reportContext: { scenarioContext: { ...adapter.context() } }
  }]));
  assert.equal(
    sandbox.OFW_S004_NativeSeeder.shouldSeed(sandbox.localStorage, adapter.context()),
    false,
    "待处理 C024、人工停用 Agent 或当前失败核验均属于合法运行状态，不得回播旧结果"
  );
  await sandbox.OFW_S004_NativeSeeder.boot(adapter, { storage: sandbox.localStorage });
  const preserved = JSON.parse(sandbox.localStorage.getItem(M06_KEY));
  assert.equal(preserved.assistant.requestRef.requestId, pendingRequestId);
  assert.equal(preserved.report.postPublicationVerification.runId, "VRF-S004-FAILED-CURRENT");

  const compacted = JSON.parse(sandbox.localStorage.getItem(M06_KEY));
  delete compacted.report.evidencePacks[0].authoritativeFactPackage;
  sandbox.localStorage.setItem(M06_KEY, JSON.stringify(compacted));
  assert.equal(sandbox.OFW_S004_NativeSeeder.shouldSeed(sandbox.localStorage, adapter.context()), true, "基线归一化移除完整事实包后应恢复同轮次权威投影");
  await sandbox.OFW_S004_NativeSeeder.boot(adapter, { storage: sandbox.localStorage });
  assert.ok(JSON.parse(sandbox.localStorage.getItem(M06_KEY)).report.evidencePacks[0].authoritativeFactPackage.packageId);

  adapter.store.resetCurrentScenario();
  await sandbox.OFW_S004_NativeSeeder.boot(adapter, { storage: sandbox.localStorage });
  assert.equal(JSON.parse(sandbox.localStorage.getItem(M06_KEY)).report.reportNo, "S004-PLR-2026-0001");
  const secondRunId = JSON.parse(sandbox.localStorage.getItem("ofw:v1.1.0:s004-runtime:native-seed")).scenarioRunId;
  assert.notEqual(secondRunId, firstRunId);
});

test("父窗口原生重播只恢复当前场景轮次，不在 marker 中复制 M05/M06 大状态", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  await installAndBootNativeSeeder(sandbox, adapter);

  const installedContexts = [];
  sandbox.OFWRuntimeStorage = {
    install({ context }) { installedContexts.push({ ...context }); }
  };

  const markerBefore = JSON.parse(sandbox.localStorage.getItem("ofw:v1.1.0:s004-runtime:native-seed"));
  const runId = markerBefore.scenarioRunId;
  const m06Key = "ontology3.report-center.lifecycle-review.v1";
  const mutated = JSON.parse(sandbox.localStorage.getItem(m06Key));
  mutated.report.reportNo = "MUTATED-BEFORE-RESEED";
  sandbox.localStorage.setItem(m06Key, JSON.stringify(mutated));

  await sandbox.OFW_S004_NativeSeeder.reseedCurrent(adapter, { storage: sandbox.localStorage });

  const restored = JSON.parse(sandbox.localStorage.getItem(m06Key));
  const markerAfter = JSON.parse(sandbox.localStorage.getItem("ofw:v1.1.0:s004-runtime:native-seed"));
  assert.equal(restored.report.reportNo, "S004-PLR-2026-0001");
  assert.equal(markerAfter.scenarioRunId, runId);
  assert.equal(markerAfter.phase, "seeded");
  assert.equal(markerAfter.recovery.version, 2);
  assert.equal(Object.prototype.hasOwnProperty.call(markerAfter.recovery, "m05"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(markerAfter.recovery, "m06"), false);
  assert.equal(installedContexts.at(-1).scenarioRunId, runId);
});

test("定向重置后先切换存储代理命名空间，再向新 scenarioRunId 重播六模块状态", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  await installAndBootNativeSeeder(sandbox, adapter);

  const firstRunId = adapter.context().scenarioRunId;
  const installedContexts = [];
  sandbox.OFWRuntimeStorage = {
    install({ context }) { installedContexts.push({ ...context }); }
  };
  adapter.store.resetCurrentScenario();
  const secondContext = adapter.context();
  assert.notEqual(secondContext.scenarioRunId, firstRunId);

  await sandbox.OFW_S004_NativeSeeder.reseedCurrent(adapter, { storage: sandbox.localStorage });
  const marker = JSON.parse(sandbox.localStorage.getItem("ofw:v1.1.0:s004-runtime:native-seed"));
  const m01 = JSON.parse(sandbox.localStorage.getItem(sandbox.OFW_S004_SeedData.keys.M01_STATE_KEY));
  assert.equal(installedContexts.at(-1).scenarioRunId, secondContext.scenarioRunId);
  assert.equal(marker.scenarioRunId, secondContext.scenarioRunId);
  assert.equal(m01.scenarioContexts.S004.scenarioRunId, secondContext.scenarioRunId);
});

test("M01 Published 画布为全部 Object、Link、Metric、Rule 提供稳定且不越界的位置", () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  const S = sandbox.OFW_S004_SeedData;
  const base = path.resolve(RUNTIME_DIR, "../s004/artifacts");
  const artifacts = {
    publishedResources: JSON.parse(fs.readFileSync(path.join(base, "ontology/published-resources-v2.json"), "utf8")),
    c008Facts: JSON.parse(fs.readFileSync(path.join(base, "ontology/c008-authoritative-facts-v2.json"), "utf8")),
    reportData: JSON.parse(fs.readFileSync(path.join(base, "report/report-data-v2.json"), "utf8")),
    reportDefinition: JSON.parse(fs.readFileSync(path.join(base, "report/report-definition-v2.json"), "utf8")),
    evidencePackage: JSON.parse(fs.readFileSync(path.join(base, "agent/evidence-package-v2.json"), "utf8")),
    draftOutput: JSON.parse(fs.readFileSync(path.join(base, "agent/draft-output-v2.json"), "utf8"))
  };
  const m01 = S.buildM01State(adapter.context(), artifacts);
  const published = m01.publishedVersions[0];
  assert.equal(published.objects.length, 8);
  assert.equal(published.links.length, 5);
  assert.equal(published.metrics.length, 17);
  assert.equal(published.rules.length, 9);
  // Published artifacts are intentionally compact; the v1.0.3 canvas still
  // needs the complete Metric/Rule display contract.  Verify the runtime
  // merge never leaves `undefined` labels or subtitles behind.
  published.metrics.forEach((metric) => {
    assert.ok(metric.name && metric.name !== "undefined", `Metric ${metric.id} 缺少名称`);
    assert.ok(metric.unit && metric.scope && metric.time, `Metric ${metric.id} 显示字段不完整`);
    assert.ok(metric.formula && metric.definition, `Metric ${metric.id} 缺少计算定义`);
  });
  published.rules.forEach((rule) => {
    assert.ok(rule.name && rule.name !== "undefined", `Rule ${rule.id} 缺少名称`);
    assert.ok(rule.code && rule.appliesTo && rule.condition, `Rule ${rule.id} 显示字段不完整`);
  });
  assert.equal(published.metrics.find((metric) => metric.id === "MET-RETURN-ON-PARENT-EQUITY").scope, "借款人");
  assert.equal(published.metrics.find((metric) => metric.id === "MET-MAX-NEW-WORKING-CAPITAL-LOAN").scope, "贷款申请");
  const facilityRule = published.rules.find((rule) => rule.id === "RULE-S004-AMOUNT-WITHIN-FACILITY");
  assert.equal(facilityRule.appliesTo, "贷款申请");
  assert.match(facilityRule.condition, /requestedAmount <= availableFacility/);
  assert.equal(facilityRule.evidence, "SIM_INTERNAL_CREDIT");
  const traceRule = published.rules.find((rule) => rule.id === "RULE-S004-REPORT-FACT-TRACEABLE");
  assert.equal(traceRule.appliesTo, "贷前调查报告");
  assert.match(traceRule.condition, /Published\/C008/);
  const sizes = { object: [210, 104], link: [220, 74], metric: [190, 82], rule: [190, 82] };
  const resources = [
    ...published.objects.map((item) => ({ ...item, kind: "object" })),
    ...published.links.map((item) => ({ ...item, kind: "link" })),
    ...published.metrics.map((item) => ({ ...item, kind: "metric" })),
    ...published.rules.map((item) => ({ ...item, kind: "rule" }))
  ];
  resources.forEach((resource) => {
    const position = published.positions[resource.id];
    assert.ok(position, `缺少资源 ${resource.id} 的画布位置`);
    const [width, height] = sizes[resource.kind];
    assert.ok(position[0] >= 0 && position[0] + width <= 2140, `${resource.id} 横向越出 Published 世界`);
    assert.ok(position[1] >= 0 && position[1] + height <= 1120, `${resource.id} 纵向越出 Published 世界`);
  });
  published.links.forEach((link) => assert.ok(published.positions[link.id], `Link ${link.id} 不得回退到随机位置`));
  assert.equal(new Set(resources.map((resource) => published.positions[resource.id].join(","))).size, resources.length);
});

test("M05/M06 使用正式制品身份、完整报告定义与发布链而非内联占位", () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  const S = sandbox.OFW_S004_SeedData;
  const base = path.resolve(RUNTIME_DIR, "../s004/artifacts");
  const readArtifact = (file) => JSON.parse(fs.readFileSync(path.join(base, file), "utf8"));
  const artifacts = {
    sourceSnapshot: readArtifact("data/source-snapshot-v2.json"),
    publishedResources: readArtifact("ontology/published-resources-v2.json"),
    c008Facts: readArtifact("ontology/c008-authoritative-facts-v2.json"),
    quality: readArtifact("data/data-quality-v2.json"),
    c017: readArtifact("data/c017-confidence-summary-v2.json"),
    agentConfig: readArtifact("agent/report-agent-config-v2.json"),
    reportDefinition: readArtifact("report/report-definition-v2.json"),
    evidencePackage: readArtifact("agent/evidence-package-v2.json"),
    draftOutput: readArtifact("agent/draft-output-v2.json"),
    reportData: readArtifact("report/report-data-v2.json"),
    deterministicVerification: readArtifact("report/deterministic-verification-v2.json"),
    humanConfirmation: readArtifact("report/human-confirmation-v2.json"),
    publicationManifest: readArtifact("report/publication-manifest-v2.json")
  };

  const context = adapter.context();
  const c008 = S.buildC008Envelope(context, artifacts);
  const evidence = S.buildReportFactPackage(context, artifacts);
  sandbox.__OFW_S004_NATIVE_SEEDER_DISABLE_AUTOBOOT__ = true;
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  sandbox.OFW_S004_NativeSeeder.seed(sandbox.localStorage, context, "<article id=\"report-cover\">S004</article>", artifacts);
  const seededC022 = JSON.parse(sandbox.localStorage.getItem(S.keys.C022_INBOX_KEY))[0];
  assert.equal(seededC022.reportContext.trustAtGeneration.currentStatusSummaryId, artifacts.c017.summaryId);
  assert.equal(seededC022.reportContext.trustAtGeneration.owner, artifacts.c017.owner);
  assert.equal(seededC022.reportContext.trustAtGeneration.formedAt, artifacts.c017.formedAt);
  assert.equal(seededC022.reportContext.trustAtGeneration.status, "warning");
  const definitionAnchors = artifacts.reportDefinition.sections.flatMap((section) => [
    section.stableAnchor,
    ...(section.subsections || []).map((subsection) => subsection.stableAnchor)
  ]).filter(Boolean);
  definitionAnchors.forEach((anchor) => assert.ok(evidence.template.slots.includes(anchor), `报告模板缺少权威锚点 ${anchor}`));
  assert.equal(evidence.packageValue.packageId, artifacts.evidencePackage.evidencePackageId);
  assert.equal(evidence.packageValue.semanticVersionId, artifacts.publishedResources.publishedPointer);

  const m05 = S.buildM05State(context, artifacts);
  assert.equal(m05.agentOverrides[0].releases[0].ontology.includes(artifacts.publishedResources.resourcePackageVersion), true);
  assert.equal(m05.evidencePackages[0].evidencePackageId, artifacts.evidencePackage.evidencePackageId);
  const draftRelease = m05.agentOverrides.find((agent) => agent.id === "report-draft").releases[0];
  assert.deepEqual(draftRelease.prompt, { id: "prompt-report-draft", version: "1.0" });
  assert.deepEqual(draftRelease.skills, [{ id: "skill-report-organization", version: "1.0" }]);
  assert.deepEqual(draftRelease.tools, [
    "tool-evidence-reader",
    "tool-ontology-reader",
    "tool-citation-validator",
    "tool-output-validator",
    "tool-report-draft-handoff"
  ]);
  assert.equal(draftRelease.artifactMetadata.agentDefinitionId, artifacts.agentConfig.agentDefinitionId);
  assert.equal(draftRelease.artifactMetadata.promptVersion, artifacts.agentConfig.promptVersion);
  assert.equal(draftRelease.artifactMetadata.skillVersion, artifacts.agentConfig.skillVersion);
  assert.deepEqual(draftRelease.artifactMetadata.toolWhitelist, artifacts.agentConfig.toolWhitelist);
  const copilotRelease = m05.agentOverrides.find((agent) => agent.id === "report-copilot").releases[0];
  assert.deepEqual(copilotRelease.prompt, { id: "prompt-report-reading", version: "1.0" });
  assert.deepEqual(copilotRelease.skills, [
    { id: "skill-report-reading", version: "1.0" },
    { id: "skill-semantic-rule-explain", version: "1.0" },
    { id: "skill-verification-explain", version: "1.0" }
  ]);
  assert.deepEqual(copilotRelease.tools, [
    "tool-report-context",
    "tool-evidence-reader",
    "tool-ontology-reader",
    "tool-verification-reader",
    "tool-citation-validator",
    "tool-output-validator",
    "tool-report-result-return"
  ]);
  const draftRun = m05.runs.find((run) => run.snapshot.agentId === "report-draft");
  assert.equal(draftRun.sessionId, null);
  assert.equal(draftRun.snapshot.reportNumber, artifacts.reportData.reportNumber);
  assert.equal(draftRun.snapshot.contentVersion, artifacts.reportData.contentVersion);
  assert.equal(draftRun.snapshot.semanticVersionId, artifacts.publishedResources.publishedPointer);
  assert.equal(draftRun.snapshot.dataAssetVersionId, m05.evidencePackages[0].dataAssetVersionId);
  assert.equal(draftRun.snapshot.credibility.externalAuthority.owner, artifacts.c017.owner);
  const c022Trust = m05.inboundRequests.find((request) => request.type === "report-draft").c022.reportContext.trustAtGeneration;
  assert.equal(draftRun.snapshot.credibility.currentStateSummary.id, artifacts.c017.summaryId);
  assert.equal(draftRun.snapshot.credibility.currentStateSummary.sourceReference, artifacts.c017.summaryId);
  assert.equal(draftRun.snapshot.credibility.currentStateSummary.version, c022Trust.currentStatusSummaryVersion);
  assert.equal(draftRun.snapshot.credibility.currentStateSummary.sourceFormedAt, artifacts.c017.formedAt);
  assert.match(draftRun.snapshot.credibility.currentStateSummary.applicableScope, /当前隔离轮次固定证据消费/);
  assert.match(draftRun.snapshot.credibility.currentStateSummary.freshness, /本制品未声明/);
  assert.equal(draftRun.snapshot.credibility.agentGates.find((gate) => gate.id === "new-run").status, "ready");
  assert.equal(draftRun.snapshot.credibility.agentGates.find((gate) => gate.id === "report-draft-transfer").status, "ready");
  const copilotRun = m05.runs.find((run) => run.snapshot.agentId === "report-copilot");
  assert.equal(copilotRun.result.destination, "已返回报告中心伴读界面");
  assert.equal(copilotRun.result.owner, "Agent 应用（M05）");
  assert.equal(copilotRun.result.generatedAt != null, true);
  assert.equal(copilotRun.result.freshness, "截至时间已确认");
  assert.equal(copilotRun.result.confidence, "固定证据引用完整；不重算正式指标");
  assert.equal(copilotRun.requestId, "C024-S004-20260815-0001");
  assert.equal(copilotRun.snapshot.anchor, "sec-03-financial");
  assert.equal(copilotRun.snapshot.semanticVersionId, artifacts.publishedResources.publishedPointer);
  assert.equal(copilotRun.snapshot.semanticVersion, m05.evidencePackages[0].semanticVersion);
  assert.equal(copilotRun.snapshot.dataAssetVersionId, m05.evidencePackages[0].dataAssetVersionId);
  assert.equal(copilotRun.snapshot.consumableVersionId, m05.evidencePackages[0].consumableVersionId);
  assert.equal(copilotRun.snapshot.consumableVersionId, S.identities.T018_EVIDENCE_ID);
  assert.notEqual(copilotRun.snapshot.consumableVersionId, c008.current.t019.evidenceId);
  assert.equal(copilotRun.snapshot.credibility.contract, "C017 Agent 安全投影");
  assert.equal(copilotRun.snapshot.credibility.currentStateSummary.id, artifacts.c017.summaryId);
  assert.equal(copilotRun.snapshot.credibility.currentStateSummary.sourceReference, artifacts.c017.summaryId);
  assert.equal(m05.sessions.length, 1);
  assert.equal(m05.sessions[0].latestRunId, "ARUN-S004-20260815-0002-COPILOT");
  assert.equal(m05.sessions[0].latestResultId, copilotRun.result.id);
  assert.equal(m05.sessions[0].semanticVersion, m05.evidencePackages[0].semanticVersion);
  assert.equal(m05.sessions[0].consumableVersionId, m05.evidencePackages[0].consumableVersionId);
  assert.equal(m05.sessions[0].verificationSummary, "PASS · 确定性核验已完成（18 项检查）");
  assert.equal(m05.sessions[0].verificationRunRef, artifacts.deterministicVerification.verificationRunId);
  assert.equal(m05.sessions[0].currentComparisonRef, null);
  assert.equal(m05.sessions[0].currentComparisonStatus, "本制品未声明 C027 当前比较记录");
  assert.equal(m05.sessions[0].resultReturnedAt != null, true);
  assert.match(m05.sessions[0].regenerationStatus, /可接收新的完整 C024/);
  assert.equal(m05.sessions[0].regenerationRef, null);

  const m06 = S.buildM06State(context, "<article id=\"report-cover\">S004</article>", artifacts);
  const allDefinitionAnchors = artifacts.reportDefinition.sections.flatMap((section) => [
    section.stableAnchor,
    ...(section.subsections || []).map((subsection) => subsection.stableAnchor)
  ]).filter(Boolean);
  assert.equal(m06.customDefinitions[0].id, artifacts.reportDefinition.reportDefinitionId);
  assert.equal(m06.customDefinitions[0].sections.length, artifacts.reportDefinition.sections.length);
  assert.equal(m06.report.reportNo, artifacts.reportData.reportNumber);
  assert.equal(m06.report.reportId, artifacts.reportData.reportId);
  assert.equal(m06.report.publicationId, artifacts.publicationManifest.publicationId);
  assert.equal(m06.report.bindingSnapshot.consumableVersionId, S.identities.T018_EVIDENCE_ID);
  assert.equal(m06.report.evidencePacks[0].authoritativeFactPackage.consumableVersionId, S.identities.T018_EVIDENCE_ID);
  assert.equal(m06.report.evidencePacks[0].semanticBinding.t019.evidenceId, c008.current.t019.evidenceId);
  assert.notEqual(m06.report.bindingSnapshot.consumableVersionId, m06.report.evidencePacks[0].semanticBinding.t019.evidenceId);
  assert.equal(m06.report.verificationRuns[0].runId, artifacts.deterministicVerification.verificationRunId);
  assert.equal(m06.report.humanReview.confirmationId, artifacts.humanConfirmation.confirmationId);
  assert.equal(m06.report.artifactManifest.html.output.sha256, artifacts.publicationManifest.formalOutputs[0].sha256);
  assert.deepEqual(m06.report.artifactManifest.stableAnchors, allDefinitionAnchors);
  assert.deepEqual(m06.report.artifactManifest.publishedTopLevelAnchors, artifacts.publicationManifest.stableAnchors);
  assert.equal(m06.report.contentVersions[0].t044Bindings.length, allDefinitionAnchors.length);
  assert.deepEqual(m06.report.contentVersions[0].t044Bindings.map((item) => item.anchorId), allDefinitionAnchors);
  assert.equal(m06.report.contentVersions[0].verificationPlan.length, artifacts.deterministicVerification.checks.length);
  assert.equal(m06.report.verificationRuns[0].coverage.factTotal, m06.report.contentVersions[0].factInventory.length);
  assert.equal(m06.report.verificationRuns[0].coverage.anchorTotal, allDefinitionAnchors.length);
  assert.equal(m06.report.verificationRuns[0].coverage.anchorCovered, allDefinitionAnchors.length);
  assert.equal(m06.report.postPublicationVerification.status, "completed");
  assert.equal(m06.report.postPublicationVerification.coverage.status, "complete");
  assert.equal(m06.report.postPublicationVerification.results.length, artifacts.deterministicVerification.checks.length);
  assert.equal(m06.assistant.requestRef.requestId, "C024-S004-20260815-0001");
  assert.equal(m06.assistant.requestRef.runId, "ARUN-S004-20260815-0002-COPILOT");
  const c024 = S.buildC024Request(context, evidence);
  assert.equal(c024.fixedContextRef.reportId, artifacts.reportData.reportId);
  assert.equal(c024.fixedContextRef.reportNumber, artifacts.reportData.reportNumber);
  assert.equal(m06.publishedReports.length, 1);
});

test("M06 运行时仅按精确 S004 身份恢复完整交互，不伪装跨模块 Owner", () => {
  const moduleRuntime = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-runtime.js"), "utf8");
  assert.match(moduleRuntime, /a\[href\^="#\/"\]/, "M06 should keep hash-only baseline routes inside the scenario loader");
  assert.match(moduleRuntime, /root\.location\.hash = href/, "M06 should preserve the frozen hash router while preventing base URL escape");
  const nativeSeeder = fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8");
  const reportPatch = nativeSeeder.slice(nativeSeeder.indexOf("function patchReportFrame"), nativeSeeder.indexOf("function EVIDENCE_PACK_ID_SAFE"));
  assert.doesNotMatch(nativeSeeder, /replaceVisibleText/);
  assert.doesNotMatch(nativeSeeder, /\[\s*["']S001["']\s*,\s*["']S004["']\s*\]/);
  assert.doesNotMatch(moduleRuntime, /replaceText\(/);
  assert.doesNotMatch(reportPatch, /replaceVisibleText\(/);
  assert.doesNotMatch(reportPatch, /badge\.textContent\s*=\s*["']已发布["']/);
  assert.match(reportPatch, /全链路已装配/);
  assert.match(reportPatch, /当前隔离轮次可追加新运行/);
  assert.match(nativeSeeder, /RDEF-S004-PREFLIGHT-002|projection\.definition\.id/);
  assert.match(nativeSeeder, /s004-formal-output-links/);
  assert.match(moduleRuntime, /let reportResourcesCache = null/);
  assert.match(moduleRuntime, /ofwS004ReportPrewarm/);
  assert.match(moduleRuntime, /reader-toolbar \.reader-title/);
  assert.match(moduleRuntime, /s004-formal-output-links/);
  assert.match(moduleRuntime, /ofwS004TraceIdentity/);
  assert.match(moduleRuntime, /reportCopilotFromState/);
  assert.match(moduleRuntime, /completeS004C024InAgentOwner/);
  assert.match(moduleRuntime, /APPEND_NEW_RUNS_PRESERVE_HISTORY|m05ScenarioReadOnly/);
  assert.match(moduleRuntime, /open-published-report/);
  assert.match(moduleRuntime, /ofwS004PublishedOpen = "preserved-c024"/);
  assert.match(moduleRuntime, /root\.location\.hash = "#\/reports\/view"/);
  assert.match(moduleRuntime, /contract: "C024 → C025"/);
  assert.match(moduleRuntime, /resultReturnStatus: "已通过 C025 返回报告中心"/);
  assert.match(moduleRuntime, /sec-03-financial/);
  assert.match(moduleRuntime, /data-action="ask-report"|\[data-action="ask-report"\]/);
  assert.match(moduleRuntime, /completeS004C024InAgentOwner/);
  assert.doesNotMatch(moduleRuntime, /M06_READONLY_ACTIONS[^;]+ask-report/s);
});

test("M05 Release 的 Prompt、Skill、Tool 主引用均存在于 v1.0.3 冻结目录", () => {
  const baselineAgentData = fs.readFileSync(path.resolve(
    RUNTIME_DIR,
    "../../../../prototype-releases/v1.0.3/agent-application/data.jsx"
  ), "utf8");
  const resourceIds = [
    "prompt-report-draft",
    "skill-report-organization",
    "tool-evidence-reader",
    "tool-ontology-reader",
    "tool-citation-validator",
    "tool-output-validator",
    "tool-report-draft-handoff",
    "prompt-report-reading",
    "skill-report-reading",
    "skill-semantic-rule-explain",
    "skill-verification-explain",
    "tool-report-context",
    "tool-verification-reader",
    "tool-report-result-return"
  ];
  resourceIds.forEach((id) => {
    assert.match(baselineAgentData, new RegExp(`id:\\s*["']${id}["']`), `v1.0.3 缺少 M05 资源 ${id}`);
  });
});

test("artifact loader 在 formal-http 模式完整读取全部 HTTP 制品并形成 SHA-256 指纹", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const refs = Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, `/artifacts/${name}.json`]));
  const payloads = Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, JSON.stringify({ source: "http", ref: refs[name] })]));
  sandbox.fetch = async (ref) => {
    const name = ARTIFACT_NAMES.find((item) => refs[item] === ref);
    return { ok: true, text: async () => payloads[name] };
  };
  const config = {
    ...scenarioConfig(),
    runtimeConfig: {
      configVersion: "TEST-RUNTIME-CONFIG",
      artifactMode: "formal-http",
      artifactRefs: refs,
      artifactIntegrity: {
        algorithm: "SHA-256",
        required: true,
        expected: Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, sha256(payloads[name])]))
      },
      inlineArtifacts: Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, { source: "inline" }]))
    }
  };
  const adapter = adapterApi.createAdapter(config, { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  const loaded = await sandbox.OFW_S004_NativeSeeder.loadArtifacts(adapter);
  assert.equal(loaded.source, "http-artifacts");
  assert.equal(loaded.formalEligible, true);
  assert.match(loaded.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(loaded.integrity.algorithm, "SHA-256");
  assert.equal(loaded.integrity.required, true);
  assert.equal(loaded.integrity.verified, true);
  assert.equal(loaded.integrity.itemCount, ARTIFACT_NAMES.length);
  ARTIFACT_NAMES.forEach((name) => {
    assert.equal(loaded[name].source, "http", `${name} 未使用 HTTP 制品`);
    assert.equal(loaded[name].ref, refs[name]);
    assert.match(loaded.integrity.items[name].sha256, /^[a-f0-9]{64}$/);
  });
});

test("formal-http 任一制品失败时整体拒绝且不得回退 inline", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const refs = Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, `/artifacts/${name}.json`]));
  sandbox.fetch = async (ref) => ref.includes("quality")
    ? { ok: false, status: 503, text: async () => "" }
    : { ok: true, text: async () => JSON.stringify({ source: "http", ref }) };
  const config = {
    ...scenarioConfig(),
    runtimeConfig: {
      artifactMode: "formal-http",
      artifactRefs: refs,
      artifactIntegrity: {
        algorithm: "SHA-256",
        required: true,
        expected: Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, "0".repeat(64)]))
      },
      inlineArtifacts: inlineDemoArtifacts()
    }
  };
  const adapter = adapterApi.createAdapter(config, { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  await assert.rejects(
    sandbox.OFW_S004_NativeSeeder.loadArtifacts(adapter),
    /禁止与 inline 混用/
  );
});

test("formal-http 制品摘要与预期清单不一致时失败关闭", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const refs = Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, `/artifacts/${name}.json`]));
  sandbox.fetch = async (ref) => ({ ok: true, text: async () => JSON.stringify({ source: "http", ref }) });
  const config = {
    ...scenarioConfig(),
    runtimeConfig: {
      artifactMode: "formal-http",
      artifactRefs: refs,
      artifactIntegrity: {
        algorithm: "SHA-256",
        required: true,
        expected: Object.fromEntries(ARTIFACT_NAMES.map((name) => [name, "f".repeat(64)]))
      }
    }
  };
  const adapter = adapterApi.createAdapter(config, { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  await assert.rejects(
    sandbox.OFW_S004_NativeSeeder.loadArtifacts(adapter),
    /SHA-256 校验失败/
  );
});

test("inline-demo 只按整包加载并明确标记为非正式", async () => {
  const { sandbox, adapterApi } = createSandbox();
  let fetchCount = 0;
  sandbox.fetch = async () => { fetchCount += 1; throw new Error("inline-demo 不应读取 HTTP"); };
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });
  // Isolate loadArtifacts without starting the separate report HTML boot path.
  sandbox.__OFW_S004_NATIVE_SEEDER_DISABLE_AUTOBOOT__ = true;
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  const loaded = await sandbox.OFW_S004_NativeSeeder.loadArtifacts(adapter);
  assert.equal(fetchCount, 0);
  assert.equal(loaded.source, "inline-demo-artifacts");
  assert.equal(loaded.formalEligible, false);
  assert.match(loaded.fingerprint, /^[a-f0-9]{64}$/);
  ARTIFACT_NAMES.forEach((name) => assert.equal(loaded[name].source, "inline-demo"));
});

test("Agent iframe 在 body 尚未创建时延迟完成接入且不改写基线 DOM", async () => {
  const { sandbox, adapterApi } = createSandbox();
  const adapter = adapterApi.createAdapter(scenarioConfig(), { storage: sandbox.localStorage });
  adapterApi.install(adapter, { root: sandbox });

  const documentListeners = new Map();
  const frameListeners = new Map();
  const observedTargets = [];
  const frameDocument = {
    body: null,
    readyState: "loading",
    defaultView: { NodeFilter: { SHOW_TEXT: 4 } },
    createTreeWalker: () => ({ nextNode: () => false }),
    addEventListener(type, listener) { documentListeners.set(type, listener); }
  };
  const frame = {
    src: "http://127.0.0.1:4339/prototype-releases/v1.0.3/agent-application/Agent应用.html",
    contentDocument: frameDocument,
    addEventListener(type, listener) { frameListeners.set(type, listener); }
  };
  sandbox.document.getElementById = (id) => id === "module-frame" ? frame : null;
  sandbox.setTimeout = (fn) => { fn(); return 1; };
  sandbox.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target) {
      assert.ok(target, "MutationObserver 不得接收 null body");
      observedTargets.push(target);
    }
  };

  // Await the public boot path explicitly.  The integrity fingerprint is
  // asynchronous and a fixed wall-clock sleep makes this regression flaky
  // when the whole suite runs in parallel.
  sandbox.__OFW_S004_NATIVE_SEEDER_DISABLE_AUTOBOOT__ = true;
  new Function("window", fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8"))(sandbox);
  await sandbox.OFW_S004_NativeSeeder.boot(adapter, { storage: sandbox.localStorage });
  assert.ok(frameListeners.has("load"));
  frameListeners.get("load")();
  assert.equal(observedTargets.includes(null), false);
  assert.ok(documentListeners.has("DOMContentLoaded"));

  frameDocument.body = {};
  documentListeners.get("DOMContentLoaded")();
  assert.equal(observedTargets.includes(frameDocument.body), false);
  assert.equal(frame.__s004AgentPatch, true);
});
