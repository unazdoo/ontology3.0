const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const Babel = require("./vendor/babel.min.js");

const root = __dirname;
const foundationSource = fs.readFileSync(path.join(root, "../foundation/ofw-scenario-foundation.js"), "utf8");
const adapterSource = fs.readFileSync(path.join(root, "s003-adapter.jsx"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.jsx"), "utf8");
const adapterScript = Babel.transform(adapterSource, { presets: ["react"] }).code;
const appScript = Babel.transform(appSource, { presets: ["react"] }).code;
const positionV1Path = path.join(root, "../scenarios/s003/resources/m05/agent-position.v1.json");
const positionV3Path = path.join(root, "../scenarios/s003/resources/m05/agent-position.v3.json");
const positionV4Path = path.join(root, "../scenarios/s003/resources/m05/agent-position.v4.json");
const historicalPositionV4 = JSON.parse(fs.readFileSync(positionV4Path, "utf8"));
const positionV7Path = path.join(root, "../scenarios/s003/resources/m05/agent-position.v7.json");
const positionV4 = JSON.parse(fs.readFileSync(positionV7Path, "utf8"));
const formalDocuments = {
  pointer: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m01/published-pointer.v2.json"), "utf8")),
  manifest: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m06/report-manifest.v9.json"), "utf8")),
  contents: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m06/report-contents.v9.json"), "utf8")),
  artifacts: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m06/report-artifacts.v9.json"), "utf8")),
  definition: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m06/report-definition.v2.json"), "utf8")),
  template: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m06/report-template.v2.json"), "utf8")),
  assurance: JSON.parse(fs.readFileSync(path.join(root, "../scenarios/s003/resources/m06/report-assurance-profile.v3.json"), "utf8"))
};

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function searchFor(context, extra = "") {
  const params = new URLSearchParams({
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId,
    scenarioContextFormedAt: context.formedAt,
    scenarioStatus: context.status
  });
  return `?${params.toString()}${extra}`;
}

function createAdapter(search, storage = createStorage()) {
  const React = {
    createElement() { return null; },
    useState(value) { return [value, () => {}]; },
    useEffect() {},
    useMemo(factory) { return factory(); }
  };
  const sandbox = {
    location: { search },
    URLSearchParams,
    localStorage: storage,
    React,
    fetch: async () => { throw new Error("resource fetch is not used by persistence tests"); },
    Notice() {},
    StatusBadge() {},
    Icon() {},
    console
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(foundationSource, sandbox, { filename: "ofw-scenario-foundation.js" });
  vm.runInContext(adapterScript, sandbox, { filename: "s003-adapter.jsx" });
  sandbox.S003AgentAdapter.installPositionForTesting(positionV4);
  return sandbox.S003AgentAdapter;
}

function toHost(value) {
  return JSON.parse(JSON.stringify(value));
}

function createAppRuntime(storage = createStorage()) {
  const noop = () => null;
  const sandbox = {
    console,
    URLSearchParams,
    Intl,
    Date,
    JSON,
    Math,
    setTimeout: () => 0,
    clearTimeout: noop,
    localStorage: storage,
    location: { search: searchFor(RUN_A), hash: "" },
    document: { getElementById: () => ({}) },
    React: {
      createElement: noop,
      Fragment: "fragment",
      useEffect: noop,
      useMemo(factory) { return factory(); },
      useRef(value) { return { current: value }; },
      useState(value) { return [typeof value === "function" ? value() : value, noop]; }
    },
    ReactDOM: { createRoot: () => ({ render: noop }) }
  };
  ["Icon", "Button", "StatusBadge", "Modal", "Drawer", "PageHeader", "EmptyState", "KeyValueList", "Tabs", "Notice", "ToastStack", "AppShell", "CredibilitySummary", "HistoryDimensions", "VersionIdentityGrid", "AgentUseGate"]
    .forEach((name) => { sandbox[name] = noop; });
  sandbox.window = sandbox;
  sandbox.AGENT_APP_INITIAL_STATE = { schemaVersion: 23, agents: [], evidencePackages: [] };
  sandbox.AGENT_WORKSPACE_CONFIG = { storageKey: "test-agent-model", initialRoute: "agents" };
  sandbox.S003AgentAdapter = { isActive: () => true, initialize: async () => {}, matchesIdentity: () => true };
  vm.createContext(sandbox);
  vm.runInContext(appScript, sandbox, { filename: "app.jsx" });
  return sandbox;
}

const RUN_A = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260817163000000-c02200000001",
  formedAt: "2026-08-17T16:30:00.000Z",
  status: "active"
});
const RUN_B = Object.freeze({
  scenarioId: "S003",
  scenarioVersion: "S003-v1",
  scenarioRunId: "S003-RUN-20260816090000000-aaaaaaaaaaaa",
  formedAt: "2026-08-16T09:00:00.000Z",
  status: "active"
});

function baselineAgentModel() {
  const reportRelease = {
    version: "1.0",
    inputContract: "Report Context Binding v1",
    outputContract: "Report Copilot Answer v1",
    prompt: { id: "prompt-report-reading", version: "1.0" },
    skills: [{ id: "skill-report-reading", version: "1.0" }],
    tools: ["tool-report-context", "tool-evidence-reader", "tool-verification-reader"],
    ontology: "由报告固定上下文提供精确 Published 版本",
    ontologyScope: "报告固定上下文",
    scenarioBinding: { id: "AG-SB-REPORT-CONTEXT", version: "1.0", mode: "request-context" }
  };
  return {
    schemaVersion: 23,
    agents: [
      { id: "financing-insight", name: "融资洞察与行动协作 Agent", status: "enabled", activeRelease: "1.2", releases: [{ version: "1.2" }] },
      { id: "report-copilot", name: "报告伴读与数据核验助手", shortName: "报告伴读", type: "报告伴读 Agent", purpose: "平台通用报告伴读", status: "enabled", activeRelease: "1.0", scenario: "报告上下文按请求绑定", releases: [reportRelease] },
      { id: "report-draft", name: "融资经营分析报告生成 Agent", status: "enabled", activeRelease: "1.0", releases: [{ version: "1.0" }] }
    ],
    evidencePackages: [],
    runs: [],
    sessions: [],
    inboundRequests: [],
    drafts: [],
    handoffs: [],
    orchestrations: []
  };
}

test("M05 Agent model projections are isolated by scenarioRunId and never use the S001 fixed key", () => {
  const storage = createStorage({ "ontology3.agent-application.catalog.v7": "s001-model" });
  const adapterA = createAdapter(searchFor(RUN_A), storage);
  const adapterB = createAdapter(searchFor(RUN_B), storage);
  adapterA.writeModel({ schemaVersion: 23, marker: "run-a" }, storage);
  adapterB.writeModel({ schemaVersion: 23, marker: "run-b" }, storage);

  assert.notEqual(adapterA.physicalKey(RUN_A), adapterB.physicalKey(RUN_B));
  assert.match(adapterA.physicalKey(RUN_A), /:S003-v1:S003-RUN-20260817163000000-c02200000001:m05:/);
  assert.deepEqual(toHost(adapterA.readModel({ schemaVersion: 23 }, storage)), { schemaVersion: 23, marker: "run-a" });
  assert.deepEqual(toHost(adapterB.readModel({ schemaVersion: 23 }, storage)), { schemaVersion: 23, marker: "run-b" });
  assert.equal(storage.getItem("ontology3.agent-application.catalog.v7"), "s001-model");
});

test("every non-active S003 context is read-only while the original run projection remains readable", () => {
  const storage = createStorage();
  createAdapter(searchFor(RUN_A), storage).writeModel({ schemaVersion: 23, marker: "published-view" }, storage);
  for (const status of ["restored", "regression", "migrated", "historical-readonly", "closed", "unknown"]) {
    const context = { ...RUN_A, status };
    const adapter = createAdapter(searchFor(context), storage);
    assert.equal(adapter.isReadOnly(), true, status);
    assert.deepEqual(toHost(adapter.readModel({ schemaVersion: 23 }, storage)), { schemaVersion: 23, marker: "published-view" });
    assert.throws(() => adapter.writeModel({ schemaVersion: 23, marker: "changed" }, storage), /只读/);
  }
});

test("incompatible M05 projection stays in place and the adapter exposes an isolation issue", () => {
  const storage = createStorage();
  const adapter = createAdapter(searchFor(RUN_A), storage);
  const key = adapter.physicalKey(RUN_A);
  const raw = JSON.stringify({
    schemaVersion: "ofw.namespaced-storage.v1",
    scenarioContext: RUN_A,
    savedAt: "2026-08-16T10:00:00.000Z",
    payload: { projectionSchemaVersion: "ofw.s003.m05.agent-model-projection.v0", scenarioContext: RUN_A, model: { schemaVersion: 22 } }
  });
  storage.setItem(key, raw);

  assert.deepEqual(toHost(adapter.readModel({ schemaVersion: 23, marker: "formal-catalog" }, storage)), { schemaVersion: 23, marker: "formal-catalog" });
  assert.equal(storage.getItem(key), raw);
  assert.equal(adapter.getProjectionIssue().isolated, true);
  assert.match(adapter.getProjectionIssue().reason, /schemaVersion 不兼容/);
  assert.throws(() => adapter.writeModel({ schemaVersion: 23, marker: "overwrite" }, storage), /禁止覆盖原记录/);
});

test("legacy C024 without reportContext is preserved and isolated without crashing M05 hydration", () => {
  const legacyCandidate = {
    requestId: "C024-LEGACY-001",
    receivedAt: "2026-08-15 16:20:00",
    persistedAsReference: true,
    payloadStoredIn: "ontology3.agent-application.c024-inbox.v1"
  };
  const rawInbox = JSON.stringify([legacyCandidate]);
  const storage = createStorage({ "ontology3.agent-application.c024-inbox.v1": rawInbox });
  const runtime = createAppRuntime(storage);
  const legacyModel = {
    schemaVersion: 23,
    agents: [],
    evidencePackages: [{
      id: "LEGACY-EVIDENCE-001",
      name: "旧版报告上下文",
      kind: "report",
      status: "ready",
      persistedAsReference: true,
      formedAt: "2026-08-15 16:20:00",
      requestContext: { id: legacyCandidate.requestId }
    }],
    inboundRequests: [{
      id: legacyCandidate.requestId,
      sourceRequestId: legacyCandidate.requestId,
      type: "report-copilot",
      status: "pending",
      currentProjection: true,
      projectionStatus: "current",
      c024: { requestId: legacyCandidate.requestId, persistedAsReference: true }
    }],
    sessions: [{
      id: "RSESSION-LEGACY-001",
      status: "active",
      currentProjection: true,
      projectionStatus: "current",
      requestContext: { id: legacyCandidate.requestId }
    }],
    runs: [{
      id: "RUN-LEGACY-001",
      requestId: legacyCandidate.requestId,
      status: "running",
      currentProjection: true,
      projectionStatus: "current",
      snapshot: { agentId: "report-copilot", requestContext: { id: legacyCandidate.requestId } }
    }],
    c024Rejections: []
  };

  const hydrated = toHost(runtime.hydratePersistedModel(legacyModel));

  assert.equal(storage.getItem("ontology3.agent-application.c024-inbox.v1"), rawInbox);
  assert.equal(hydrated.inboundRequests[0].status, "blocked");
  assert.equal(hydrated.inboundRequests[0].projectionStatus, "incompatible");
  assert.match(hydrated.inboundRequests[0].blockedReason, /缺少场景标识/);
  assert.equal(hydrated.evidencePackages[0].status, "blocked");
  assert.equal(hydrated.evidencePackages[0].projectionStatus, "incompatible");
  assert.equal(hydrated.evidencePackages[0].compatibilityIssue.isolated, true);
  assert.equal(hydrated.sessions[0].status, "stale");
  assert.equal(hydrated.sessions[0].projectionStatus, "history");
  assert.equal(hydrated.runs[0].status, "blocked");
  assert.equal(hydrated.runs[0].projectionStatus, "history");
  assert.equal(hydrated.c024Rejections[0].sourceRequestId, legacyCandidate.requestId);
  assert.equal(hydrated.c024Rejections[0].projectionStatus, "incompatible");
});

test("M05 filters cross-scenario inbox records and keeps non-active mutation/timers fail-closed", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  assert.equal(adapter.matchesIdentity(RUN_A), true);
  assert.equal(adapter.matchesIdentity({ ...RUN_A, scenarioRunId: RUN_B.scenarioRunId }), false);
  assert.match(appSource, /readC022Candidates[\s\S]*?matchesIdentity\?\.\(c022Identity/);
  assert.match(appSource, /readC024Candidates[\s\S]*?matchesIdentity\?\.\(c024Identity/);
  assert.match(appSource, /const s003ReadOnly = window\.S003AgentAdapter\?\.isReadOnly/);
  assert.match(appSource, /if \(s003ReadOnly\) return;[\s\S]*?advanceFormalRun/);
  assert.match(appSource, /function submitActionRequest\(run\) \{[\s\S]*?ensureWritable\("提交行动申请"\)/);
  assert.match(appSource, /function publishOrchestrationRelease\(orchestration\) \{[\s\S]*?ensureWritable\("发布协作编排 Release"\)/);
});

test("M05 only admits same-run C024 candidates and never materializes lifecycle records from the profile", () => {
  const matching = {
    requestId: "C024-S003-MATCHING",
    receivedAt: "2026-08-16 23:40:00",
    reportContext: { scenarioContext: RUN_A }
  };
  const otherRun = {
    requestId: "C024-S003-OTHER-RUN",
    receivedAt: "2026-08-16 23:41:00",
    reportContext: { scenarioContext: RUN_B }
  };
  const storage = createStorage({ "ontology3.agent-application.c024-inbox.v1": JSON.stringify([matching, otherRun]) });
  const runtime = createAppRuntime(storage);
  runtime.S003AgentAdapter.matchesIdentity = (identity) => ["scenarioId", "scenarioVersion", "scenarioRunId"].every((field) => identity?.[field] === RUN_A[field]);
  const candidates = toHost(runtime.readC024Candidates());
  assert.deepEqual(candidates.map((item) => item.requestId), [matching.requestId]);
  assert.equal("evidencePackage" in positionV4, false);
  assert.equal("runtimeExample" in positionV4, false);
  assert.match(appSource, /function receiveC024[\s\S]*?const evidence = evidenceFromC024\(candidate, receivedAt\)/);
  assert.match(appSource, /固定请求和证据投影已创建；Binding、Session、Run、Result 仍为 0/);
});

test("M05 keeps the baseline directory and installs the S003 report-copilot profile into native data", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  const baseModel = baselineAgentModel();
  const baselineRelease = toHost(baseModel.agents.find((item) => item.id === "report-copilot").releases[0]);
  const prepared = adapter.validateDocuments(positionV4, formalDocuments, RUN_A);
  const model = toHost(adapter.decorateModelForScenario(baseModel, RUN_A, baseModel, prepared));
  const agent = model.agents.find((item) => item.id === "report-copilot");
  assert.deepEqual(model.agents.map((item) => item.id), ["financing-insight", "report-copilot", "report-draft"]);
  assert.equal(agent.name, "报告伴读与数据核验助手");
  assert.equal(agent.s003ScenarioConfiguration, true);
  assert.equal(agent.activeRelease, "1.5");
  assert.deepEqual(agent.releases.find((item) => item.version === "1.0"), baselineRelease);
  assert.equal(agent.releases.find((item) => item.version === "1.5").basedOnRelease, "1.0");
  assert.equal(model.agents.find((item) => item.id === "financing-insight").scenarioAvailability.status, "not-bound");
  assert.equal(model.agents.find((item) => item.id === "report-draft").scenarioAvailability.status, "not-bound");
  assert.deepEqual(model.evidencePackages, []);
  assert.deepEqual(model.runs, []);
  assert.deepEqual(model.sessions, []);
  assert.deepEqual(model.inboundRequests, []);
  assert.equal(model.resourceReleases.prompts[0].id, "prompt-report-reading-s003");

  assert.match(appSource, /function AgentDirectory\(\)/);
  assert.match(appSource, /<S003BoundaryCard agents=\{model\.agents\}>/);
  assert.match(appSource, /正式目录/);
  assert.match(appSource, /配置草稿/);
  assert.match(adapterSource, /const reportAgent = agents\.find/);
  assert.match(adapterSource, /平台通用报告伴读 Agent/);
  assert.equal(positionV4.dedicatedAgent, false);
  assert.equal(positionV4.lifecyclePolicy.materializeFrom, "C024");
  assert.equal(positionV4.lifecyclePolicy.profileCreatesEvidenceRunSession, false);
  assert.match(appSource, /await window\.S003AgentAdapter\.initialize\(\)/);
  assert.match(appSource, /Binding、Session、Run、Result 仍为 0/);
});

test("M05 reclassifies legacy profile-generated lifecycle records without deleting their audit payload", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  const legacyEvidence = {
    id: "S003-M05-REPORT-EVIDENCE-001",
    kind: "report",
    status: "ready",
    scenarioContext: RUN_A
  };
  const legacyRun = {
    id: "S003-M05-RUN-REPORT-COPILOT-001",
    status: "completed",
    snapshot: {...RUN_A, agentId: "report-copilot"}
  };
  const legacySession = {
    id: "S003-M05-SESSION-REPORT-COPILOT-001",
    status: "active",
    scenarioContext: RUN_A
  };
  const legacyRequest = {
    id: "S003-C024-REPORT-COPILOT-001",
    type: "report-copilot",
    status: "received",
    scenarioContext: RUN_A
  };
  const modelWithLegacyRecords = {
    ...baselineAgentModel(),
    evidencePackages: [legacyEvidence],
    runs: [legacyRun],
    sessions: [legacySession],
    inboundRequests: [legacyRequest]
  };
  const prepared = adapter.validateDocuments(positionV4, formalDocuments, RUN_A);
  const migrated = toHost(adapter.decorateModelForScenario(modelWithLegacyRecords, RUN_A, modelWithLegacyRecords, prepared));

  assert.deepEqual(migrated.evidencePackages, []);
  assert.deepEqual(migrated.runs, []);
  assert.deepEqual(migrated.sessions, []);
  assert.deepEqual(migrated.inboundRequests, []);
  assert.equal(migrated.profileGeneratedLegacyRecords.evidencePackages[0].id, legacyEvidence.id);
  assert.equal(migrated.profileGeneratedLegacyRecords.runs[0].id, legacyRun.id);
  assert.equal(migrated.profileGeneratedLegacyRecords.sessions[0].id, legacySession.id);
  assert.equal(migrated.profileGeneratedLegacyRecords.inboundRequests[0].id, legacyRequest.id);
  Object.values(migrated.profileGeneratedLegacyRecords).flat().forEach((record) => {
    assert.equal(record.projectionStatus, "reclassified");
    assert.match(record.reclassificationReason, /未经过真实 C024 生命周期/);
  });
});

test("M05 does not rehydrate the S001 static catalog or financing evidence into S003", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  const reportCopilot = {
    id: "report-copilot",
    name: "报告伴读与数据核验助手",
    shortName: "报告伴读",
    type: "报告伴读 Agent",
    purpose: "平台通用报告伴读",
    status: "enabled",
    activeRelease: "1.0",
    scenario: "报告上下文按请求绑定",
    releases: [{
      version: "1.0",
      inputContract: "Report Context Binding v1",
      outputContract: "Report Copilot Answer v1",
      prompt: { id: "prompt-report-reading", version: "1.0" },
      skills: [{ id: "skill-report-reading", version: "1.0" }],
      tools: ["tool-report-context", "tool-evidence-reader", "tool-verification-reader"],
      ontology: "由报告固定上下文提供精确 Published 版本",
      ontologyScope: "报告固定上下文",
      scenarioBinding: { id: "AG-SB-REPORT-CONTEXT", version: "1.0", mode: "request-context" }
    }]
  };
  const s001Context = {
    scenarioId: "S001",
    scenarioVersion: "S001-v1",
    scenarioRunId: "S001-RUN-BASELINE"
  };
  const compactedProjection = {
    schemaVersion: 23,
    staticCatalogStoredAsReference: true,
    agents: [
      { id: "financing-insight", name: "融资洞察与行动协作 Agent", releases: [] },
      reportCopilot,
      { id: "report-draft", name: "融资经营分析报告生成 Agent", releases: [] }
    ],
    agentOverrides: [{ ...reportCopilot, name: "债务风险报告伴读助手" }],
    baseEvidenceOverrides: [{ id: "finance-2026-07-31", name: "集团融资证据包" }],
    evidencePackages: [
      { id: "finance-2026-07-31", kind: "finance", scenarioContext: s001Context },
      { id: "finance-candidate-2026-08-10", kind: "finance", scenarioContext: s001Context }
    ],
    runs: [{ id: "S001-RUN-AGENT", snapshot: { ...s001Context, agentId: "financing-insight" } }],
    sessions: [{ id: "S001-SESSION-AGENT", ...s001Context }],
    inboundRequests: [{ id: "S001-REQUEST", type: "insight", scenarioContext: s001Context }],
    drafts: [{ id: "S001-DRAFT", agentId: "financing-insight", scenarioContext: s001Context }],
    handoffs: [{ id: "S001-HANDOFF", scenarioContext: s001Context }],
    orchestrations: [{ id: "S001-ORCH", scenarioContext: s001Context }]
  };

  const prepared = adapter.validateDocuments(positionV4, formalDocuments, RUN_A);
  const model = toHost(adapter.decorateModelForScenario(compactedProjection, RUN_A, compactedProjection, prepared));
  assert.deepEqual(model.agents.map((item) => item.id), ["financing-insight", "report-copilot", "report-draft"]);
  assert.equal(model.agents.find((item) => item.id === "report-copilot").name, "报告伴读与数据核验助手");
  assert.equal(model.staticCatalogStoredAsReference, false);
  assert.equal("agentOverrides" in model, false);
  assert.equal("baseEvidenceOverrides" in model, false);
  assert.deepEqual(model.evidencePackages, []);
  assert.deepEqual(model.runs, []);
  assert.deepEqual(model.sessions, []);
  assert.deepEqual(model.inboundRequests, []);
  assert.deepEqual(model.drafts, []);
  assert.deepEqual(model.handoffs, []);
  assert.deepEqual(model.orchestrations, []);

  assert.match(appSource, /hydrated\.staticCatalogStoredAsReference && !s003ScenarioCatalog/);
  assert.match(appSource, /if \(s003ScenarioCatalog\) \{[\s\S]*?delete hydrated\.baseEvidenceOverrides;/);
});

test("M05 preserves the v1/v3/v4 resources and reads the v7 C024-only scenario profile", () => {
  const v1 = fs.readFileSync(positionV1Path);
  assert.equal(crypto.createHash("sha256").update(v1).digest("hex"), "9332d85160efb29e637de41f796ec92fb259f5b4dabe8b0f8f1001ad52084703");
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(positionV3Path)).digest("hex"), "6aab650385ba518f923e5067b8dec0e8c452808adbdfdb1d119ccdac51099052");
  assert.equal(historicalPositionV4.exportId, "S003-M05-REPORT-COPILOT-SCENARIO-PROFILE");
  assert.equal(historicalPositionV4.scenarioProfile.baseAgentId, "report-copilot");
  assert.equal(positionV4.scenarioProfile.baseReleaseVersion, "1.0");
  assert.equal(positionV4.scenarioProfile.derivedReleaseVersion, "1.5");
  assert.equal(positionV4.publishedModel.semanticVersionId, "S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.equal(positionV4.reportBinding.manifestId, "S003-M06-REPORT-MANIFEST-20260817-008");
  assert.equal(positionV4.reportBinding.manifestVersion, "1.7.0");
  assert.equal(positionV4.reportBinding.verificationRef, "resources/m06/report-contents.v9.json#/reports/0/content/verificationSummary");
  assert.equal("evidencePackage" in positionV4, false);
  assert.equal("runtimeExample" in positionV4, false);
  assert.match(adapterSource, /RESOURCE_PATH = .*agent-position\.v7\.json/);
  assert.doesNotMatch(adapterSource, /RESOURCE_PATH = .*agent-position\.v1\.json/);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(positionV4Path)).digest("hex");
  assert.match(fs.readFileSync(`${positionV4Path}.sha256`, "utf8"), new RegExp(`^${digest}  agent-position\\.v4\\.json`));
  const currentDigest = crypto.createHash("sha256").update(fs.readFileSync(positionV7Path)).digest("hex");
  assert.match(fs.readFileSync(`${positionV7Path}.sha256`, "utf8"), new RegExp(`^${currentDigest}  agent-position\\.v7\\.json`));
});

test("M05 validates the exact Published model and formal report resource identities", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  const prepared = toHost(adapter.validateDocuments(positionV4, formalDocuments, RUN_A));
  assert.equal(prepared.currentRunCompatible, true);
  assert.equal(prepared.resolvedResources.publishedTarget.packageId, "S003-M01-DEBT-RISK-PKG");
  assert.equal(prepared.resolvedResources.publishedTarget.packageVersion, "1.0.2");
  assert.equal(prepared.resolvedResources.manifestReport.reportId, positionV4.reportBinding.reportId);
  assert.equal(prepared.resolvedResources.reportContent.contentVersion, "1.7.0");
  assert.equal(prepared.resolvedResources.artifact.artifactId, positionV4.reportBinding.artifactId);
  assert.equal(prepared.resolvedResources.reportContent.verificationSummary.checkCount, 13);
  assert.equal(prepared.resolvedResources.reportContent.verificationSummary.passedCount, 13);
  assert.equal(prepared.resolvedResources.reportContent.verificationSummary.nonVacuousDecisionEvidenceRequired, true);
});

test("M05 Evidence workspace exposes verified formal report sources without fabricating lifecycle records", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  adapter.installPositionForTesting(positionV4, formalDocuments, RUN_A);
  const summary = toHost(adapter.getEvidenceSourceSummary());

  assert.equal(summary.status, "ready");
  assert.equal(summary.lifecycleStatus, "awaiting-c024");
  assert.match(summary.lifecycleBoundary, /不创建 Evidence、Request、Binding、Session、Run 或 Result/);
  assert.deepEqual(summary.scenarioIdentity, {
    scenarioId: RUN_A.scenarioId,
    scenarioVersion: RUN_A.scenarioVersion,
    scenarioRunId: RUN_A.scenarioRunId
  });
  assert.equal(summary.report.enterpriseName, "风电测试公司01");
  assert.equal(summary.report.reportId, positionV4.reportBinding.reportId);
  assert.equal(summary.report.contentVersion, "1.7.0");
  assert.equal(summary.publishedModel.semanticVersionId, "S003-M01-DEBT-RISK-PKG@1.0.2");
  assert.equal(summary.data.dataAssetId, "S003-T007-FORMAL-CANDIDATE-20251231-v1");
  assert.equal(summary.verification.passedCount, 13);
  assert.equal(summary.verification.checkCount, 13);
  assert.equal("evidencePackage" in positionV4, false);
  assert.equal("runtimeExample" in positionV4, false);
  assert.match(appSource, /const S003EvidenceSourceCard = window\.S003AgentAdapter\?\.isActive/);
  assert.match(appSource, /<S003EvidenceSourceCard><\/S003EvidenceSourceCard>/);
  assert.match(adapterSource, /S003 正式报告上下文来源/);
  assert.match(adapterSource, /只有报告中心提交同一 scenarioRunId 的真实 C024/);
});

test("M05 fails closed when the URL run differs from the formal report source run", () => {
  const adapter = createAdapter(searchFor(RUN_B));
  const prepared = adapter.validateDocuments(positionV4, formalDocuments, RUN_B);
  assert.equal(prepared.currentRunCompatible, false);
  const baseModel = {
    schemaVersion: 23,
    agents: [{
      id: "report-copilot",
      name: "报告伴读与数据核验助手",
      activeRelease: "1.0",
      releases: [{ version: "1.0", prompt: { id: "prompt-report-reading", version: "1.0" }, skills: [], tools: [] }]
    }]
  };
  assert.throws(() => adapter.decorateModelForScenario(baseModel, RUN_B, baseModel, prepared), /没有同身份正式报告/);
});

test("M05 keeps the complete baseline Prompt, Skill and Tool resource catalogs", () => {
  const adapter = createAdapter(searchFor(RUN_A));
  assert.deepEqual(toHost(adapter.filterPromptResources([
    { id: "prompt-finance-evidence" },
    { id: "prompt-report-reading" },
    { id: "prompt-report-draft" }
  ])).map((item) => item.id), ["prompt-finance-evidence", "prompt-report-reading", "prompt-report-draft"]);
  assert.deepEqual(toHost(adapter.filterSkillResources([
    { id: "skill-finance-explain" },
    { id: "skill-report-reading" },
    { id: "skill-semantic-rule-explain" },
    { id: "skill-verification-explain" }
  ])).map((item) => item.id), ["skill-finance-explain", "skill-report-reading", "skill-semantic-rule-explain", "skill-verification-explain"]);
  assert.deepEqual(toHost(adapter.filterToolResources([
    { id: "tool-action-submit" },
    { id: "tool-report-context" },
    { id: "tool-report-result-return" }
  ])).map((item) => item.id), ["tool-action-submit", "tool-report-context", "tool-report-result-return"]);
  assert.match(appSource, /function listSkillResources\(\)/);
  assert.match(appSource, /function listToolResources\(\)/);
});
