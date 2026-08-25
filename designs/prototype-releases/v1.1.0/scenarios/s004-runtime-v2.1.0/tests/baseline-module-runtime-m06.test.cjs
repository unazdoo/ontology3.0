"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const RUNTIME_DIR = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(RUNTIME_DIR, "baseline-module-runtime.js"), "utf8");
const nativeSeederSource = fs.readFileSync(path.join(RUNTIME_DIR, "native-seeder.js"), "utf8");
const templateDir = path.join(RUNTIME_DIR, "artifacts", "templates");
const M06_STATE_KEY = "ontology3.report-center.lifecycle-review.v1";
const M05_STATE_KEY = "ontology3.agent-application.catalog.v7";
const C024_INBOX_KEY = "ontology3.agent-application.c024-inbox.v1";
const C008_STATE_KEY = "ontology3-c008-authoritative-projection-v1";
const C017_REPORT_KEY = "ontology3.c017.report-center.projection.v1";
const NATIVE_SEED_MARKER_KEY = "ofw:v1.1.0:s004-runtime:native-seed";
const VERIFICATION_CONTEXT_KEY = "ofw:v1.1.0:s004-runtime:verification-context.v1";
const SOURCE_ARTIFACT_DIR = path.resolve(RUNTIME_DIR, "../s004/artifacts");
const c008Artifact = JSON.parse(fs.readFileSync(path.join(SOURCE_ARTIFACT_DIR, "ontology/c008-authoritative-facts-v2.json"), "utf8"));
const reportDefinitionArtifact = JSON.parse(fs.readFileSync(path.join(SOURCE_ARTIFACT_DIR, "report/report-definition-v2.json"), "utf8"));
const evidencePackageArtifact = JSON.parse(fs.readFileSync(path.join(SOURCE_ARTIFACT_DIR, "agent/evidence-package-v2.json"), "utf8"));
const verificationArtifact = JSON.parse(fs.readFileSync(path.join(SOURCE_ARTIFACT_DIR, "report/deterministic-verification-v2.json"), "utf8"));
const SEMANTIC_VERSION_ID = "T019-S004-PUBLISHED-002";
const SEMANTIC_VERSION = "2.0.0";
const DATA_VERSION = "DATA-ASSET-S004-20260815-V01";
const DATA_ASSET_VERSION_ID = "DATA-ASSET-S004-20260815-V01";
const CONSUMABLE_VERSION_ID = "T018-S004-20260815-001";
const DATA_AS_OF = "2026-08-15";
const FORMAL_ARTIFACT_DIR = path.resolve(RUNTIME_DIR, "../s004/artifacts");
const FORMAL_ARTIFACT_FILES = Object.freeze({
  sourceSnapshot: "data/source-snapshot-v2.json",
  publishedResources: "ontology/published-resources-v2.json",
  c008Facts: "ontology/c008-authoritative-facts-v2.json",
  quality: "data/data-quality-v2.json",
  c017: "data/c017-confidence-summary-v2.json",
  agentConfig: "agent/report-agent-config-v2.json",
  reportDefinition: "report/report-definition-v2.json",
  evidencePackage: "agent/evidence-package-v2.json",
  draftOutput: "agent/draft-output-v2.json",
  reportData: "report/report-data-v2.json",
  deterministicVerification: "report/deterministic-verification-v2.json",
  humanConfirmation: "report/human-confirmation-v2.json",
  publicationManifest: "report/publication-manifest-v2.json"
});

const scenario = Object.freeze({
  scenarioId: "S004",
  scenarioVersion: "S004-v2.1.0",
  scenarioRunId: "S004-RUN-20260816000000000-m06test",
  formedAt: "2026-08-16T00:00:00.000Z",
  status: "active"
});

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formalArtifacts() {
  return Object.fromEntries(Object.entries(FORMAL_ARTIFACT_FILES).map(([name, file]) => [
    name,
    JSON.parse(fs.readFileSync(path.join(FORMAL_ARTIFACT_DIR, file), "utf8"))
  ]));
}

function formalIntegrity() {
  const items = Object.fromEntries(Object.entries(FORMAL_ARTIFACT_FILES).map(([name, file]) => {
    const raw = fs.readFileSync(path.join(FORMAL_ARTIFACT_DIR, file));
    return [name, { sha256: crypto.createHash("sha256").update(raw).digest("hex") }];
  }));
  return {
    expected: Object.fromEntries(Object.entries(items).map(([name, item]) => [name, item.sha256])),
    marker: {
      scenarioId: scenario.scenarioId,
      scenarioVersion: scenario.scenarioVersion,
      scenarioRunId: scenario.scenarioRunId,
      formedAt: scenario.formedAt,
      phase: "seeded",
      artifactFingerprint: { items }
    }
  };
}

function buildFormalRuntimeFixture() {
  const seedRoot = {};
  seedRoot.window = seedRoot;
  seedRoot.globalThis = seedRoot;
  new Function("window", "globalThis", fs.readFileSync(path.join(RUNTIME_DIR, "seed-data.js"), "utf8"))(seedRoot, seedRoot);
  const builders = seedRoot.OFW_S004_SeedData;
  const artifacts = formalArtifacts();
  const c008 = builders.buildC008Envelope(scenario, artifacts);
  const c017 = builders.buildC017ReportProjection(scenario, c008, artifacts);
  const m06 = builders.buildM06State(scenario, '<article id="report-cover">S004</article>', artifacts);
  const integrity = formalIntegrity();
  return { builders, artifacts, c008, c017, m06, marker: integrity.marker, expectedIntegrity: integrity.expected };
}

function buildActiveDraftRuntimeFixture() {
  const fixture = buildFormalRuntimeFixture();
  const published = jsonClone(fixture.m06.report);
  const report = jsonClone(published);
  const evidencePackId = "EP-20260816-DRAFT-001";
  const draftId = "DRAFT-S004-20260816-001";
  const reviewCopyId = "RCP-S004-20260816-001";
  report.stage = "draft";
  report.requestId = "RGEN-20260816-DRAFT-001";
  report.replacedReportNo = published.reportNo;
  report.reportNo = null;
  report.publicationId = null;
  report.publishedAt = null;
  report.artifactManifest = null;
  report.frozenHtml = null;
  report.evidencePackId = evidencePackId;
  report.evidencePacks = [{
    ...jsonClone(published.evidencePacks[0]),
    id: evidencePackId,
    version: "1.0",
    fixedAt: "2026-08-16T08:10:00.000Z"
  }];
  report.draftId = draftId;
  report.reviewCopyId = reviewCopyId;
  report.draftVersion = "0.1";
  report.contentVersion = "0.1";
  report.generatedAt = "2026-08-16T08:12:00.000Z";
  report.confirmedAt = null;
  report.humanReview = { status: "pending", contentVersion: "0.1", reviewer: null, completedAt: null, note: null };
  report.verification = { status: "idle", scope: "整份报告", results: [], coverage: {} };
  report.postPublicationVerification = null;
  report.verificationRuns = [];
  report.reviewHistory = [];
  report.issues = [];
  report.contentSnapshot = { ...jsonClone(published.contentSnapshot), snapshotId: "CNT-S004-DRAFT-001", revisionNumber: 1 };
  report.contentVersions = [{
    ...jsonClone(published.contentVersions[0]),
    reviewCopyId,
    draftId,
    draftVersion: "0.1",
    contentVersion: "0.1",
    evidencePackId,
    status: "草稿待复核",
    snapshot: jsonClone(report.contentSnapshot),
    verificationPlan: [],
    verificationRunIds: []
  }];
  const state = {
    ...jsonClone(fixture.m06),
    report,
    publishedReports: [published],
    regenerationRequest: null,
    assistant: { ...(fixture.m06.assistant || {}), tab: "verification" }
  };
  return { ...fixture, state, report, published };
}

function runtimeConfig(reportTitle = "中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）") {
  const lockedByType = Object.fromEntries((evidencePackageArtifact.lockedResources || []).map((item) => [item.resourceType, item]));
  return {
    demoClock: {
      enabled: true,
      scenarioId: "S004",
      mode: "FIXED",
      date: "2026-08-16",
      now: "2026-08-16T08:00:00.000Z",
      timeZone: "Asia/Shanghai"
    },
    artifactIntegrity: {
      expected: {
        publishedResources: lockedByType.PUBLISHED_ONTOLOGY?.sha256,
        c008Facts: lockedByType.C008_FACT_BUNDLE?.sha256
      }
    },
    borrowerProfiles: {
      activeBorrowerId: "BORR-CN-USCC-91440300093677087R",
      profiles: [{
        borrowerId: "BORR-CN-USCC-91440300093677087R",
        legalName: "中国广核电力股份有限公司",
        unifiedSocialCreditCode: "91440300093677087R",
        memberId: "MEM-CGN-003816",
        groupName: "中国广核集团有限公司",
        currency: "CNY",
        reportDisplayUnit: "万元",
        financialStatementPeriods: [2023, 2024, 2025],
        financialStatementAsOf: "2025-12-31"
      }]
    },
    applicationProfiles: {
      activeApplicationId: "APP-S004-20260815-0001",
      applications: [{
        applicationId: "APP-S004-20260815-0001",
        borrowerId: "BORR-CN-USCC-91440300093677087R",
        productType: "一年期流动资金贷款",
        requestedAmount: 100000,
        amountUnit: "万元",
        termMonths: 12,
        loanType: "流动资金信用贷款",
        guaranteeMode: "CREDIT",
        guaranteeStatus: "NOT_APPLICABLE",
        collateralStatus: "NOT_APPLICABLE",
        purpose: "核电运营相关日常经营周转",
        purposeDetail: "核燃料、备品备件及运维服务采购",
        repaymentMode: "本金到期一次偿还、按季付息",
        repaymentSource: "核电运营收入和经营活动现金流",
        purposeContractCoverageRatio: 1.2,
        supportingMaterialStatus: {
          creditSummary: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
          internalRating: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
          internalFacility: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
          historicalFinancing: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
          onsiteInvestigation: "REGISTERED_REQUIRES_HUMAN_VERIFICATION"
        },
        internalFacility: { approvedAmount: 300000, usedAmount: 120000, availableAmount: 180000, asOf: "2026-08-14" },
        dataAsOf: DATA_AS_OF,
        reportingYear: 2025
      }]
    },
    stableIdentities: {
      borrowerId: "BORR-CN-USCC-91440300093677087R",
      memberId: "MEM-CGN-003816",
      applicationId: "APP-S004-20260815-0001",
      reportNumber: "S004-PLR-2026-0001"
    },
    sourceSlotDefinitions: [
      { name: "正式财务报告", sourceClass: "official-public" },
      { name: "贷款调查补充资料", sourceClass: "synthetic-demo / authorized-external / human-input" }
    ],
    reportNamingPolicy: { currentIssueDate: "2026-08-15", currentTitle: reportTitle }
  };
}

function verificationRun() {
  return {
    runId: "VRF-S004-COMPLETE",
    status: "completed",
    scope: "整份报告",
    attempt: 1,
    coverage: {
      status: "complete", planned: 2, applicable: 2, completed: 2, pending: 0, error: 0,
      notApplicable: 0, skipped: 0, factTotal: 1, factCovered: 1, anchorTotal: 1, anchorCovered: 1
    },
    results: [{ id: "T049-1", name: "报告身份", status: "pass", anchor: "sec-03-financial" }],
    scenarioContext: { ...scenario }
  };
}

function reportState() {
  const contentFacts = [
    { id: "FACT-S004-V2-BORROWER-001", label: "借款人", value: "中国广核电力股份有限公司", scope: "借款人评价", evidence: ["SRC-CGN-AR-2025"] },
    { id: "FACT-S004-V2-OWNERSHIP-001", label: "股权与控制关系", value: "中国广核集团有限公司为控股股东", scope: "借款人评价", evidence: ["SRC-CGN-AR-2025"] },
    { id: "MET-DEBT-ASSET-RATIO", label: "资产负债率", value: 0.6515, scope: "财务报表事实", evidence: ["MET-DEBT-ASSET-RATIO", "SRC-CGN-AR-2025"] },
    { id: "MET-CURRENT-RATIO", label: "流动比率", value: 0.66, scope: "财务报表事实", evidence: ["MET-CURRENT-RATIO", "SRC-CGN-AR-2025"] },
    { id: "FACT-S004-V2-WORKING-CAPITAL-001", label: "新增流动资金贷款测算上限", value: "257901 万元", scope: "贷款申请", evidence: ["SIM_LOAN_APPLICATION", "SIM_LOAN_LEDGER"] },
    { id: "RISK-S004-V2-001", label: "短期偿债压力", value: "AI 建议：需结合现金流与到期债务人工判断", scope: "借款风险分析", evidence: ["SRC-CGN-AR-2025"], humanInputRequired: true, aiSuggestion: true, confirmationRequired: true },
    { id: "HCONF-S004-TEST", label: "授信结论", value: "AI 建议：由有权人员确认", scope: "授信结论", evidence: ["HCONF-S004-TEST"], humanInputRequired: true, aiSuggestion: true, confirmationRequired: true }
  ];
  const t044Bindings = contentFacts.map((fact, index) => ({
    id: `T044-S004-TEST-${index + 1}`,
    contentItemId: `CONTENT-S004-TEST-${index + 1}`,
    anchorId: fact.scope === "授信结论" ? "sec-05-credit-conclusion"
      : fact.scope === "借款风险分析" ? "sec-04-risk"
        : fact.scope === "贷款申请" ? "sec-03-02-funding"
          : fact.scope === "财务报表事实" ? "sec-03-01-basic-financial"
            : "sec-01-borrower-evaluation",
    templateSlot: fact.scope,
    factRefs: [fact.id],
    evidenceRefs: [...fact.evidence],
    bindingStatus: "bound"
  }));
  const verificationPlan = verificationArtifact.checks.map((check, index) => ({
    id: check.checkId,
    checkType: check.checkId,
    checkName: check.detail,
    owner: "报告中心",
    applicability: "applicable",
    executionState: "planned",
    t044Ids: [t044Bindings[index % t044Bindings.length].id]
  }));
  const report = {
    scenarioContext: { ...scenario },
    reportNo: "S004-PLR-2026-0001",
    contentVersion: "2.0.0",
    evidencePackId: "EVID-S004-20260815-0002",
    stage: "published",
    bindingSnapshot: {
      semanticVersionId: SEMANTIC_VERSION_ID,
      semanticVersion: SEMANTIC_VERSION,
      dataAssetVersionId: DATA_ASSET_VERSION_ID,
      dataVersion: DATA_VERSION,
      consumableVersionId: CONSUMABLE_VERSION_ID,
      asOf: DATA_AS_OF
    },
    evidencePacks: [{
      id: "EVID-S004-20260815-0002",
      version: "2.0.0",
      authoritativeFactPackage: {
        packageId: "EVID-S004-20260815-0002",
        packageVersion: "2.0.0",
        readiness: "可消费",
        scenarioContext: { ...scenario },
        semanticVersionId: SEMANTIC_VERSION_ID,
        semanticVersion: SEMANTIC_VERSION,
        dataVersion: DATA_VERSION,
        consumableVersionId: CONSUMABLE_VERSION_ID,
        asOf: DATA_AS_OF,
        authoritativeBinding: {
          semanticVersionId: SEMANTIC_VERSION_ID,
          semanticVersion: SEMANTIC_VERSION,
          dataAssetVersionId: DATA_ASSET_VERSION_ID,
          dataVersion: DATA_VERSION,
          consumableVersionId: CONSUMABLE_VERSION_ID,
          asOf: DATA_AS_OF
        },
        contentFacts,
        anchors: [{ stableAnchor: "sec-03-financial" }],
        contentItems: t044Bindings.map((binding) => ({
          id: binding.contentItemId,
          contentItemId: binding.contentItemId,
          anchorId: binding.anchorId,
          factRefs: binding.factRefs,
          evidenceRefs: binding.evidenceRefs,
          bindingStatus: "bound"
        })),
        deterministicInputs: {
          stableIdentities: {
            borrowerId: "BORR-CN-USCC-91440300093677087R",
            memberId: "MEM-CGN-003816",
            applicationId: "APP-S004-20260815-0001",
            reportNumber: "S004-PLR-2026-0001"
          },
          formalBusinessSubject: c008Artifact.facts.formalBusinessSubject,
          memberStatus: c008Artifact.facts.memberStatus,
          borrower: c008Artifact.facts.borrower,
          ownership: c008Artifact.facts.ownership,
          operations: c008Artifact.facts.operations,
          loanApplication: c008Artifact.facts.loanApplication,
          internalFacility: c008Artifact.facts.internalFacility,
          financialStatements: c008Artifact.facts.financialStatements,
          metricOpeningBalances2022: c008Artifact.facts.metricOpeningBalances2022,
          metricResults: c008Artifact.metricRun.results,
          metricRunId: c008Artifact.metricRun.metricRunId,
          workingCapital: c008Artifact.facts.workingCapital,
          riskThemes: c008Artifact.facts.riskThemes,
          sourceCatalogue: c008Artifact.facts.sourceCatalogue,
          ruleRun: c008Artifact.ruleRun
        }
      },
      artifactEvidencePackage: evidencePackageArtifact,
      template: { id: "RT-S004-PREFLIGHT-002", version: "2.0.0", slots: [] }
    }],
    reviewCopyId: "RC-S004-TEST",
    contentVersions: [{
      reviewCopyId: "RC-S004-TEST",
      contentVersion: "2.0.0",
      factInventory: contentFacts,
      t044Bindings,
      verificationPlan
    }],
    humanReview: { status: "confirmed", confirmationId: "HCONF-S004-TEST" },
    verificationRuns: [verificationRun()],
    postPublicationVerification: { status: "run_failed", runId: "VRF-S004-FAILED", results: [], coverage: { status: "error", error: 1 } },
    artifactManifest: {
      reportNo: "S004-PLR-2026-0001",
      contentVersion: "2.0.0",
      evidencePackId: "EVID-S004-20260815-0002",
      stableAnchors: reportDefinitionArtifact.sections.map((section) => section.stableAnchor),
      html: { output: { format: "CONTROLLED_HTML", file: "report.html" } },
      pdf: { output: { format: "SAME_SOURCE_PDF", file: "report.pdf" } }
    }
  };
  return {
    customDefinitions: [{
      id: "RDEF-S004-PREFLIGHT-002",
      version: "2.0.0",
      formalPageSystem: reportDefinitionArtifact.formalPageSystem,
      sections: reportDefinitionArtifact.sections
    }],
    report,
    publishedReports: [JSON.parse(JSON.stringify(report))],
    assistant: { tab: "qa", selectedAnchor: "sec-03-financial", qaDraft: "", requestRef: null },
    ui: { viewingReportNo: report.reportNo }
  };
}

function c024Request(overrides = {}) {
  const binding = {
    semanticVersionId: SEMANTIC_VERSION_ID,
    semanticVersion: SEMANTIC_VERSION,
    dataAssetVersionId: DATA_ASSET_VERSION_ID,
    dataVersion: DATA_VERSION,
    consumableVersionId: CONSUMABLE_VERSION_ID,
    asOf: DATA_AS_OF
  };
  return {
    requestId: "C024-S004-QA-TEST",
    receivedAt: "2026-08-16T01:00:00.000Z",
    question: "2025 年偿债能力的关键指标和变化是什么？",
    selectedAnchor: "sec-03-financial",
    reportContext: {
      scenarioContext: { ...scenario },
      reportNumber: "S004-PLR-2026-0001",
      reportId: "S004-PLR-2026-0001",
      contentVersion: "2.0.0",
      evidencePack: { id: "EVID-S004-20260815-0002", version: "2.0.0" },
      selectedAnchor: "sec-03-financial",
      semanticResolution: "resolved",
      semanticBinding: binding,
      ...overrides
    }
  };
}

function createSandbox({
  request = c024Request(),
  m06 = reportState(),
  m05 = null,
  reportTitle = null,
  moduleId = "M06",
  deferM06 = false,
  withRuntimeConfig = true,
  runtimeProfile = null,
  c008State = null,
  c017State = null,
  seedMarker = null,
  parentProjection = null,
  verificationContext = null
} = {}) {
  const defaultC008 = {
    projectionId: C008_STATE_KEY,
    scenarioContext: { ...scenario },
    current: {
      semanticVersionId: SEMANTIC_VERSION_ID,
      semanticVersion: SEMANTIC_VERSION,
      dataVersion: DATA_VERSION,
      asOf: DATA_AS_OF,
      t019: { recordId: "T019-S004-PUBLISHED-002", evidenceId: "EVID-T019-S004-001" }
    }
  };
  const defaultC017 = {
    projectionId: C017_REPORT_KEY,
    scenarioContext: { ...scenario },
    projections: [{
      scenarioContext: { ...scenario },
      dataVersion: DATA_VERSION,
      allowConsumption: true,
      currentStateSummary: { id: `C017-S004-${scenario.scenarioRunId}`, hardQualityFailure: false }
    }]
  };
  const records = new Map([
    [M05_STATE_KEY, JSON.stringify(m05 || { inboundRequests: [], runs: [], sessions: [], c024Rejections: [], runtimeActivity: [] })],
    [C024_INBOX_KEY, JSON.stringify({ contractCode: "C024", requests: [request] })],
    [C008_STATE_KEY, JSON.stringify(c008State || defaultC008)],
    [C017_REPORT_KEY, JSON.stringify(c017State || defaultC017)]
  ]);
  const sessionRecords = new Map();
  if (!deferM06) records.set(M06_STATE_KEY, JSON.stringify(m06));
  if (seedMarker) records.set(NATIVE_SEED_MARKER_KEY, JSON.stringify(seedMarker));
  if (verificationContext) sessionRecords.set(VERIFICATION_CONTEXT_KEY, JSON.stringify(verificationContext));
  const search = new URLSearchParams({ moduleId, ...scenario }).toString();
  const documentListeners = {};
  const document = {
    currentScript: { src: "http://127.0.0.1:4339/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/baseline-module-runtime.js" },
    documentElement: { dataset: {} },
    body: {},
    head: { append() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    createElement() { return { dataset: {}, style: {}, setAttribute() {} }; },
    addEventListener(type, listener) { (documentListeners[type] ||= []).push(listener); }
  };
  const sandbox = {
    document,
    location: { href: `http://127.0.0.1:4339/module?${search}`, search: `?${search}`, hash: "" },
    localStorage: {
      getItem(key) { return records.get(String(key)) ?? null; },
      setItem(key, value) { records.set(String(key), String(value)); },
      removeItem(key) { records.delete(String(key)); }
    },
    sessionStorage: {
      getItem(key) { return sessionRecords.get(String(key)) ?? null; },
      setItem(key, value) { sessionRecords.set(String(key), String(value)); },
      removeItem(key) { sessionRecords.delete(String(key)); }
    },
    MutationObserver: class { observe() {} },
    URL,
    URLSearchParams,
    setTimeout() { return 0; },
    addEventListener() {},
    OFW_ACTIVE_SCENARIO_ADAPTER: withRuntimeConfig ? { config: { runtimeConfig: runtimeProfile || runtimeConfig(reportTitle || undefined) } } : null,
    __OFW_BASELINE_MODULE_RUNTIME_TEST__: true
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.parent = parentProjection ? {
    OFW_S004_NativeSeeder: {
      currentProjection() { return jsonClone(parentProjection); }
    }
  } : sandbox;
  new Function("window", "globalThis", "MutationObserver", runtimeSource)(sandbox, sandbox, sandbox.MutationObserver);
  return { sandbox, api: sandbox.OFWBaselineModuleRuntimeTestApi, records, documentListeners };
}

function createFormalVerificationSandbox(mutator = null) {
  const fixture = buildFormalRuntimeFixture();
  const m06 = jsonClone(fixture.m06);
  const c008 = jsonClone(fixture.c008);
  const c017 = jsonClone(fixture.c017);
  const marker = jsonClone(fixture.marker);
  const runtimeProfile = { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } };
  if (mutator) mutator({ fixture, m06, c008, c017, marker, runtimeProfile });
  const created = createSandbox({ m06, c008State: c008, c017State: c017, seedMarker: marker, runtimeProfile });
  return { ...created, fixture, m06, c008, c017, marker, runtimeProfile };
}

test("M06 报告阅读适配使用受控正文片段并保持历史正式制品只读", () => {
  assert.match(runtimeSource, /s004-formal-report\.report-paper/);
  assert.match(runtimeSource, /fit-a4-fragment/);
  assert.match(runtimeSource, /已发布制品只读呈现|immutable-artifact-interactive-assistant/);
  assert.match(runtimeSource, /s004-human-confirmation/);
  assert.match(runtimeSource, /s004-ai-suggestion-label/);
  assert.doesNotMatch(runtimeSource, /RPT-S004-CGNPC-20260815-v2\.0\.html[^\n]*writeFile|writeFile[^\n]*RPT-S004-CGNPC-20260815-v2\.0\.html/);
});

test("S004 报告模板提供 HTML 查看下载与 JSON 字段定义", () => {
  const htmlPath = path.join(templateDir, "RT-S004-PREFLIGHT-002-v2.0.0.html");
  const jsonPath = path.join(templateDir, "RT-S004-PREFLIGHT-002-v2.0.0.json");
  assert.equal(fs.existsSync(htmlPath), true);
  assert.equal(fs.existsSync(jsonPath), true);
  const html = fs.readFileSync(htmlPath, "utf8");
  const definition = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  [
    "第一部分 借款人评价（工商信息）",
    "第二部分 借款人经营情况",
    "第三部分 借款人财务情况",
    "第四部分 借款风险分析",
    "第五部分 授信结论",
    "数据来源"
  ].forEach((title) => assert.match(html, new RegExp(title.replace(/[()]/g, "\\$&"))));
  assert.match(html, /【需人工确认】/);
  assert.match(html, /AI 建议（基于已固化资料与系统事实生成）/);
  assert.match(html, /报告生成阶段不直接联网搜索/);
  assert.equal(definition.templateId, "RT-S004-PREFLIGHT-002");
  assert.equal(definition.templateVersion, "2.0.0");
  assert.equal(definition.formalOutputs.join("|"), "CONTROLLED_HTML|SAME_SOURCE_PDF");
  assert.equal(definition.docxOutput, "NOT_IN_PHASE_ONE");
  assert.equal(definition.sections.length, 7);
});

test("报告定义模板详情暴露可下载链接且不把 DOCX 自动纳入一期", () => {
  assert.match(runtimeSource, /data-s004-template-download="html"/);
  assert.match(runtimeSource, /data-s004-template-download="json"/);
  assert.match(runtimeSource, /data-s004-template-download="catalog"/);
  assert.match(runtimeSource, /下载模板/);
  assert.match(runtimeSource, /DOCX 仍不纳入一期/);
  assert.match(runtimeSource, /RT-S004-PREFLIGHT-002-v2\.0\.0\.html/);
  assert.match(runtimeSource, /RT-S004-PREFLIGHT-002-v2\.0\.0\.json/);
});

test("报告助手保留 24 个问答池、每页显示 6 个并支持刷新和清空会话", () => {
  const { api } = createSandbox();
  const recommendedQuestions = [
    "借款人的成员单位身份和基本情况是什么？",
    "2025 年偿债能力的关键指标和变化是什么？",
    "报告识别出的主要风险和缓释依据有哪些？",
    "哪些内容是 AI 建议，哪些必须人工确认？",
    "本报告使用了哪些数据版本和证据？",
    "自动核验检查了什么，当前结果如何？",
    "请解释本报告第三部分财务情况与第四部分风险分析的主要证据、核验状态和人工判断边界。",
    "后续为其他集团成员单位出具报告，需要替换什么？",
    "本次贷款申请的金额、期限、用途和还款来源是什么？",
    "担保、抵质押、征信和历史融资资料是否齐全？",
    "哪些数据来自财务报告，哪些来自外部或内部合成资料？",
    "报告的币种、单位、数据截至时间和报告日期如何确定？",
    "如果更换借款人，数据源、本体和报告定义哪些可以复用？",
    "财务公司如何确认借款人属于集团成员单位？",
    "财务指标从哪里来，如何追溯到 Metric 和原始证据？",
    "如果自动核验未通过，应该如何处理？",
    "征信资料已核验什么，哪些内容仍待人工核对？",
    "本次申请是否有保证、抵押或质押安排？",
    "历史融资和财务公司内部授信占用情况如何？",
    "股权结构、控股股东和集团成员资格如何联合核验？",
    "新增流动资金贷款额度上限是如何测算的？",
    "数据或模板更新后，已发布报告为什么不会原地变化？",
    "从数据接入到 HTML/PDF 发布，完整控制链是什么？",
    "哪些资料或状态缺口会阻断生成、核验或人工确认？"
  ];
  const answers = recommendedQuestions.map((question) => api.m06AnswerForQuestion(question));
  assert.equal(answers.length, 24);
  assert.equal(new Set(answers.map((item) => item.intent)).size, 24);
  answers.forEach((item) => {
    assert.match(item.answer, /^结论：[^\n]+\n依据：[^\n]+\n边界：[^\n]+$/);
    assert.doesNotMatch(item.answer, /2026-08-17|2026 年 8 月 17 日/);
  });

  const finance = answers.find((item) => item.intent === "solvency");
  assert.match(finance.answer, /65\.15%/);
  assert.match(finance.answer, /60\.19% → 61\.2% → 65\.15%/);
  assert.match(finance.answer, /由1,425,461\.42 万元增至4,215,111\.99 万元/);
  assert.match(finance.answer, /2,997,052\.94 万元/);
  const credit = api.m06AnswerForQuestion("请直接给出授信额度和最终授信决定");
  assert.match(credit.answer, /必须由财务公司人员/);
  assert.match(credit.answer, /(?:不得形成最终|不能形成正式)授信决定/);
  const application = answers.find((item) => item.intent === "loan-application");
  assert.equal(application.anchor, "sec-03-02-funding");
  assert.match(application.answer, /100,000 万元/);
  assert.match(application.answer, /期限 12 个月/);
  assert.match(application.answer, /核燃料、备品备件及运维服务采购/);
  assert.match(application.answer, /核电运营收入和经营活动现金流/);
  assert.match(application.answer, /用途合同覆盖率为 120%/);
  assert.match(application.answer, /不等于财务公司已批准额度、利率或授信条件/);
  const reusable = answers.find((item) => item.intent === "reusable-resources");
  assert.match(reusable.answer, /通用来源槽位/);
  assert.match(reusable.answer, /不能覆盖中国广核电力股份有限公司本次正式报告 S004-PLR-2026-0001/);
  const rephrasedBorrower = api.m06AnswerForQuestion("换借款人以后需要重新形成哪些实例？");
  assert.match(rephrasedBorrower.answer, /新的 borrowerId、applicationId、scenarioRunId/);
  const otherCompany = answers.find((item) => item.intent === "next-borrower");
  assert.match(otherCompany.answer, /报告定义、模板、Agent Release、工具白名单和确定性核验规则可以跨集团成员单位复用/);
  assert.match(otherCompany.answer, /不能覆盖中国广核电力股份有限公司本次正式报告/);
  assert.match(otherCompany.answer, /不能把其事实带入新公司/);
  const rephrasedApplication = api.m06AnswerForQuestion("贷款申请金额和期限是什么？");
  assert.match(rephrasedApplication.answer, /100,000 万元、期限 12 个月/);
  const supporting = answers.find((item) => item.intent === "supporting-materials");
  assert.match(supporting.answer, /保证人和抵质押物均明确登记为 NOT_APPLICABLE/);
  assert.match(supporting.answer, /内部批准额度 300,000 万元/);
  assert.match(supporting.answer, /资料“已登记”不等于征信无风险或授信可批准/);
  const sourceClasses = answers.find((item) => item.intent === "source-classes");
  assert.match(sourceClasses.answer, /2023、2024、2025 年财务报表/);
  const dates = answers.find((item) => item.intent === "dates-units");
  assert.match(dates.answer, /正式报告出具日期为 2026 年 8 月 15 日/);
  const eligibility = answers.find((item) => item.intent === "member-eligibility");
  assert.match(eligibility.answer, /成员资格状态为 ACTIVE/);
  const lineage = answers.find((item) => item.intent === "metric-lineage");
  assert.match(lineage.answer, /Published Metric/);
  assert.match(lineage.answer, /Agent 不直接读取年报或工作簿，也不重新计算正式指标/);
  const remediation = answers.find((item) => item.intent === "verification-remediation");
  assert.match(remediation.answer, /保留当前运行记录/);
  assert.match(remediation.answer, /新的独立核验运行/);
  const creditInvestigation = answers.find((item) => item.intent === "credit-investigation");
  assert.match(creditInvestigation.answer, /REGISTERED_REQUIRES_HUMAN_VERIFICATION/);
  assert.match(creditInvestigation.answer, /不能证明借款人“无征信风险”/);
  assert.match(creditInvestigation.answer, /不得把“已登记”解释为“无风险”/);
  const guaranteeCollateral = answers.find((item) => item.intent === "guarantee-collateral");
  assert.match(guaranteeCollateral.answer, /保证、抵押和质押均为 NOT_APPLICABLE/);
  assert.match(guaranteeCollateral.answer, /不等于风险较低或信用方式可以批准/);
  const historicalFinancing = answers.find((item) => item.intent === "historical-financing");
  assert.match(historicalFinancing.answer, /300,000 万元/);
  assert.match(historicalFinancing.answer, /120,000 万元/);
  assert.match(historicalFinancing.answer, /180,000 万元/);
  assert.match(historicalFinancing.answer, /2026-08-14/);
  assert.match(historicalFinancing.answer, /Agent 不得据此形成正式额度/);
  const ownershipMembership = answers.find((item) => item.intent === "ownership-membership");
  assert.match(ownershipMembership.answer, /中国广核集团有限公司/);
  assert.match(ownershipMembership.answer, /Published 成员资格 Rule/);
  assert.match(ownershipMembership.answer, /授信准入仍须财务公司人工复核/);
  const workingCapital = answers.find((item) => item.intent === "working-capital-calculation");
  assert.match(workingCapital.answer, /257,901 万元/);
  assert.match(workingCapital.answer, /2,340,573 万元/);
  assert.match(workingCapital.answer, /不是已批准授信额度/);
  const immutable = answers.find((item) => item.intent === "publication-immutability");
  assert.match(immutable.answer, /已发布的 HTML\/PDF/);
  assert.match(immutable.answer, /只能创建新的内容版本或替代报告/);
  const chain = answers.find((item) => item.intent === "end-to-end-chain");
  assert.match(chain.answer, /数据来源\/合成节点 → 不可变快照与质量/);
  assert.match(chain.answer, /同源 HTML\/PDF 发布 → 报告伴读/);
  const blockers = answers.find((item) => item.intent === "blocking-gates");
  assert.match(blockers.answer, /18 \/ 18 检查单元/);
  assert.match(blockers.answer, /不得用其他公司、其他时点或“最新数据”替补缺口/);
  assert.match(runtimeSource, /M06_QA_CATALOG\.map/);
  assert.match(runtimeSource, /formatM06QaAnswer/);
  assert.match(runtimeSource, /data-s004-refresh-qa/);
  assert.match(runtimeSource, /data-s004-clear-qa/);
  assert.match(runtimeSource, /pageSize = 6/);
  assert.doesNotMatch(runtimeSource, /data-s004-qa-group=/);
  assert.match(runtimeSource, /renderM06QaAnswer/);
  assert.match(runtimeSource, /cleared-recommendations-preserved/);
  assert.match(runtimeSource, /hidden-from-business-user/);
  assert.match(runtimeSource, /ofwS004SuggestedAnchor = selectedAnchor/);
  assert.match(runtimeSource, /rebindS004C024Anchor\(requestId, suggestedAnchor\)/);
  assert.match(runtimeSource, /reportState\.assistant\.requestRef\.selectedAnchor = suggestedAnchor/);
  assert.doesNotMatch(runtimeSource, /setText\(qaContext\.querySelector\("strong"\), `sec-03-financial/);
  const termAndRate = api.m06AnswerForQuestion("请确定最终授信额度、期限、利率和条件");
  assert.match(termAndRate.answer, /必须由财务公司人员/);
  const unknown = api.m06AnswerForQuestion("请预测明年股价");
  assert.match(unknown.answer, /不会据此猜测或补造业务事实/);
  assert.match(unknown.answer, /固定证据包/);
});

test("报告助手 DOM 投影按内容签名幂等写入，MutationObserver 使用单帧调度且不监听文本回写", () => {
  const { api } = createSandbox();
  let answerWrites = 0;
  const answerNode = {
    dataset: {},
    value: "",
    get innerHTML() { return this.value; },
    set innerHTML(value) { answerWrites += 1; this.value = value; }
  };
  const answer = "结论：测试结论\n依据：测试依据\n边界：测试边界";
  api.renderM06QaAnswer(answerNode, answer);
  api.renderM06QaAnswer(answerNode, answer);
  assert.equal(answerWrites, 1, "相同答案不得重复改写 innerHTML");
  api.renderM06QaAnswer(answerNode, `${answer}更新`);
  assert.equal(answerWrites, 2, "答案变化时应允许一次新渲染");

  let citationWrites = 0;
  const citations = {
    dataset: {},
    value: "",
    get innerHTML() { return this.value; },
    set innerHTML(value) { citationWrites += 1; this.value = value; }
  };
  api.renderM06QaCitations(citations, ["FACT-1", "METRIC-1"]);
  api.renderM06QaCitations(citations, ["FACT-1", "METRIC-1"]);
  assert.equal(citationWrites, 1, "相同引用不得重复改写 innerHTML");
  api.renderM06QaCitations(citations, ["FACT-1", "METRIC-1", "RULE-1"]);
  assert.equal(citationWrites, 2, "引用变化时应允许一次新渲染");

  assert.match(runtimeSource, /new MutationObserver\(schedulePatch\)/);
  assert.match(runtimeSource, /observer\?\.disconnect\?\.\(\)/);
  assert.match(runtimeSource, /requestAnimationFrame\(runScheduledPatch\)/);
  assert.match(runtimeSource, /Object\.freeze\(\{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(runtimeSource, /observer\.observe\([^\n]+characterData: true/);
});

test("报告助手和自动核验采用业务用户交互，不展示 Agent 回读技术提示", () => {
  assert.match(runtimeSource, /每次显示 6 个/);
  assert.match(runtimeSource, /清空会话/);
  assert.match(runtimeSource, /回答依据/);
  assert.match(runtimeSource, /hidden-from-business-user/);
  assert.doesNotMatch(runtimeSource, /Agent 运行回读（C024 → C025）/);
  assert.match(runtimeSource, /beginS004VerificationRerun/);
  assert.match(runtimeSource, /animated-in-place/);
  assert.match(runtimeSource, /正在重新核验当前版本/);
  assert.match(runtimeSource, /s004-verification-pass-compact/);
  assert.match(runtimeSource, /查看核验说明/);
  assert.match(runtimeSource, /与当前权威数据比较/);
  assert.match(runtimeSource, /报告数据一致性核验规则与执行口径/);
  assert.match(runtimeSource, /报告财务指标是否与本体计算结果一致/);
  assert.match(runtimeSource, /报告数据的时点、期间、币种和单位是否一致/);
  assert.match(runtimeSource, /M06_VERIFICATION_CHECK_LABELS/);
  assert.match(runtimeSource, /s004VerificationBusinessLabel/);
  assert.match(runtimeSource, /报告内部链路完整，不代表当前权威数据未变化，也不代表授信已经批准/);
  assert.match(runtimeSource, /报告生成阶段不直接联网搜索/);
});

test("M06 生成向导只替换空值或 v1.0.3 默认值，不覆盖用户自定义文本", () => {
  const { api } = createSandbox();
  assert.equal(api.isM06BaselineDefaultValue("", ["基线默认"]), true);
  assert.equal(api.isM06BaselineDefaultValue("基线默认", ["基线默认"]), true);
  assert.equal(api.isM06BaselineDefaultValue("用户已填写的贷前调查说明", ["基线默认"]), false);
  assert.match(runtimeSource, /baseline-state-machine-s004-copy/);
  assert.match(runtimeSource, /财务公司贷款贷前调查报告 · \$\{definitionVersion\}/);
  assert.match(runtimeSource, /财务公司贷款贷前调查报告模板 · \$\{templateVersion\}/);
  assert.match(runtimeSource, /基于当前固定证据包形成新的贷前调查内容版本/);
  assert.match(runtimeSource, /enabled-baseline-state-machine/);
});

test("M06 新内容版本处于证据、Agent、草稿或发布准备阶段时不触发历史种子恢复", () => {
  const { api } = createSandbox();
  const active = reportState();
  active.report.reportNo = null;
  active.report.requestId = "RGEN-20260816-160101-001";
  active.report.replacedReportNo = "S004-PLR-2026-0001";
  [
    "evidence", "generating", "draft", "returned", "confirmed", "publishing",
    "evidence_missing", "generation_failed", "publish_failed"
  ].forEach((stage) => {
    active.report.stage = stage;
    assert.equal(api.isM06ActiveScenarioWorkState(active), true, `${stage} 应被识别为当前轮次有效工作态`);
  });
  active.report.stage = "published";
  assert.equal(api.isM06ActiveScenarioWorkState(active), false);
  active.report.stage = "evidence";
  active.report.requestId = null;
  assert.equal(api.isM06ActiveScenarioWorkState(active), false);
  assert.match(runtimeSource, /suppressed-active-generation/);
  assert.match(runtimeSource, /preserved-for-active-generation/);
});

test("M06 活动 Draft 合并保留新证据包和草稿身份，不回落到历史正式报告", () => {
  const fixture = buildActiveDraftRuntimeFixture();
  const compactActive = jsonClone(fixture.report);
  compactActive.evidencePacks[0].authoritativeFactPackageRef = {
    packageId: fixture.published.evidencePacks[0].authoritativeFactPackage.packageId,
    semanticVersionId: SEMANTIC_VERSION_ID,
    dataAssetVersionId: DATA_ASSET_VERSION_ID,
    dataVersion: DATA_VERSION,
    consumableVersionId: CONSUMABLE_VERSION_ID,
    asOf: DATA_AS_OF
  };
  delete compactActive.evidencePacks[0].authoritativeFactPackage;
  const { api } = createSandbox();
  const merged = api.mergeS004CompleteReport(fixture.published, compactActive);
  assert.equal(merged.stage, "draft");
  assert.equal(merged.reportNo, null);
  assert.equal(merged.requestId, "RGEN-20260816-DRAFT-001");
  assert.equal(merged.evidencePackId, "EP-20260816-DRAFT-001");
  assert.equal(merged.evidencePacks[0].id, "EP-20260816-DRAFT-001");
  assert.equal(merged.evidencePacks[0].authoritativeFactPackage.packageId, "EVID-S004-20260815-0002");
  assert.equal(merged.artifactManifest, null);
  assert.equal(merged.contentVersions[0].verificationPlan.length, 18);
  assert.equal(merged.contentVersions[0].verificationPlan.every((item) => item.id.startsWith("VER-V2-")), true);
});

test("M06 新内容版本可完成 S004 确定性核验并由人工确认停在待发布", () => {
  const fixture = buildActiveDraftRuntimeFixture();
  const runtimeProfile = { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } };
  const { api, records, sandbox } = createSandbox({
    m06: fixture.state,
    c008State: fixture.c008,
    c017State: fixture.c017,
    seedMarker: fixture.marker,
    runtimeProfile,
    parentProjection: { m06: fixture.m06 },
    verificationContext: {
      schemaVersion: "ofw.s004.verification-context.v1",
      scenarioContext: { ...scenario },
      evidencePackId: fixture.published.evidencePacks[0].authoritativeFactPackage.packageId,
      semanticVersionId: SEMANTIC_VERSION_ID,
      semanticVersion: SEMANTIC_VERSION,
      dataAssetVersionId: DATA_ASSET_VERSION_ID,
      dataVersion: DATA_VERSION,
      consumableVersionId: CONSUMABLE_VERSION_ID,
      asOf: DATA_AS_OF,
      deterministicInputs: fixture.published.evidencePacks[0].authoritativeFactPackage.deterministicInputs,
      artifactIntegrity: fixture.artifacts.integrity,
      definition: {
        id: fixture.m06.customDefinitions[0].id,
        version: fixture.m06.customDefinitions[0].version,
        formalPageSystem: "A4_PORTRAIT",
        sections: reportDefinitionArtifact.sections
      }
    }
  });
  const run = api.runS004DraftDeterministicVerification();
  assert.ok(run?.runId);
  assert.equal(run.status, "completed-s004-deterministic");
  assert.equal(run.results.length, 18);
  assert.equal(run.results.every((item) => item.status === "pass"), true, JSON.stringify(run.results.map((item) => ({ id: item.id, status: item.status, issue: item.issue }))));
  assert.equal(run.coverage.planned, 18);
  assert.equal(run.coverage.factTotal, 19);
  assert.equal(run.coverage.anchorTotal, 19);
  assert.equal(run.publicationEligible, true);
  let stored = JSON.parse(records.get(M06_STATE_KEY));
  assert.equal(stored.report.stage, "draft");
  assert.equal(stored.report.reportNo, null);
  assert.equal(stored.report.evidencePackId, "EP-20260816-DRAFT-001");
  assert.equal(stored.report.contentVersions[0].verificationPlan.length, 18);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004DraftVerification, "completed-eligible-for-human-review");

  const confirmation = api.confirmS004DraftAfterVerification();
  assert.equal(confirmation.status, "confirmed");
  assert.equal(confirmation.reviewer, "财务公司调查复核岗");
  assert.match(confirmation.confirmationId, /^HCONF-S004-DRAFT-20260816-/);
  stored = JSON.parse(records.get(M06_STATE_KEY));
  assert.equal(stored.report.stage, "confirmed");
  assert.equal(stored.report.reportNo, null);
  assert.equal(stored.report.humanReview.status, "confirmed");
  assert.match(stored.report.humanReview.note, /尚未发布正式报告/);
  assert.equal(stored.report.contentVersions[0].status, "已确认");
  assert.equal(stored.report.reviewHistory.at(-1).type, "人工确认");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004DraftConfirmation, "confirmed-awaiting-publication");
  assert.match(runtimeSource, /if \(confirmDraft && draftReaderActive\) \{\s*event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);/);
});

test("推荐问答锚点在 M05 消费前写回同一 C024 请求", () => {
  const { api, records, sandbox } = createSandbox();
  assert.equal(api.rebindS004C024Anchor("C024-S004-QA-TEST", "sec-04-risk"), true);
  const inbox = JSON.parse(records.get(C024_INBOX_KEY));
  assert.equal(inbox.requests[0].selectedAnchor, "sec-04-risk");
  assert.equal(inbox.requests[0].reportContext.selectedAnchor, "sec-04-risk");
  assert.equal(inbox.requests[0].fixedContextRef.selectedAnchor, "sec-04-risk");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004C024AnchorRebound, "sec-04-risk");
});

test("C024 伴读投影按精确场景身份回读 Session、Run、Result，并允许新锚点问题", () => {
  const m06 = reportState();
  m06.assistant.requestRef = {
    requestId: "C024-S004-STALE",
    runId: "RUN-S004-STALE",
    sessionId: "SESSION-S004-STALE",
    resultId: "RESULT-S004-STALE"
  };
  const binding = m06.report.bindingSnapshot;
  const request = {
    id: "C024-S004-NEW",
    sourceRequestId: "C024-S004-NEW",
    type: "report-copilot",
    status: "complete",
    reportNumber: m06.report.reportNo,
    contentVersion: m06.report.contentVersion,
    evidencePackageId: m06.report.evidencePackId,
    semanticVersionId: binding.semanticVersionId,
    semanticVersion: binding.semanticVersion,
    dataAssetVersionId: binding.dataAssetVersionId,
    dataVersion: binding.dataVersion,
    consumableVersionId: binding.consumableVersionId,
    dataAsOf: binding.asOf,
    anchor: "sec-04-risk",
    scenarioContext: { ...scenario },
    question: "报告识别出的主要风险和缓释依据有哪些？"
  };
  const result = { id: "RESULT-S004-NEW", summary: "结论：风险与缓释依据已按固定证据返回。" };
  const run = {
    id: "RUN-S004-NEW",
    requestId: request.id,
    status: "complete",
    scenarioContext: { ...scenario },
    result,
    snapshot: {
      agentId: "report-copilot",
      anchor: "sec-04-risk",
      reportNumber: m06.report.reportNo,
      contentVersion: m06.report.contentVersion,
      evidencePackageId: m06.report.evidencePackId,
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      consumableVersionId: binding.consumableVersionId,
      dataAsOf: binding.asOf
    }
  };
  const session = {
    id: "SESSION-S004-NEW",
    latestRunId: run.id,
    latestResultId: result.id,
    anchor: "sec-04-risk",
    scenarioContext: { ...scenario }
  };
  const { api } = createSandbox({ m06, m05: { inboundRequests: [request], runs: [run], sessions: [session] } });
  const projection = api.locateS004CopilotProjection(JSON.parse(JSON.stringify({ inboundRequests: [request], runs: [run], sessions: [session] })), m06);
  assert.equal(projection.anchor, "sec-04-risk");
  assert.equal(projection.session.id, session.id);
  assert.equal(projection.run.id, run.id);
  assert.equal(projection.result.id, result.id);
  assert.equal(api.hasFullCopilotProjection({ inboundRequests: [request], runs: [run], sessions: [session] }, m06), true);
});

test("M06 报告结构完整性不要求已经存在成功伴读 Session、Run 或 Result", () => {
  const fixture = buildFormalRuntimeFixture();
  const m06 = jsonClone(fixture.m06);
  m06.assistant.requestRef = null;
  const { api, sandbox } = createSandbox({
    m06,
    m05: { inboundRequests: [], runs: [], sessions: [], evidencePackages: [] },
    c008State: fixture.c008,
    c017State: fixture.c017,
    seedMarker: fixture.marker,
    runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } }
  });
  assert.equal(api.reseedProjectionIsValid(), true);
  assert.ok(api.reportResourcesFromState()?.report?.reportNo);
  assert.equal(api.hasFullCopilotProjection({ inboundRequests: [], runs: [], sessions: [] }, m06), false);
  const hasFullReportBody = runtimeSource.match(/function hasFullReportProjection\(state\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.doesNotMatch(hasFullReportBody, /assistant|requestRef|sessionId|runId|resultId/);
});

test("M06 首屏数据投影把 S004 固定事实包置于生成数据源首位并标记可消费", () => {
  const m06 = reportState();
  m06.customDefinitions[0].sections = [{ sectionId: "sec-01-borrower-evaluation", title: "第一部分 借款人评价" }];
  m06.report.evidencePacks[0].authoritativeFactPackage = {
    packageId: m06.report.evidencePackId,
    packageVersion: "2.0.0",
    schemaVersion: "2.0.0",
    factInventoryVersion: "2.0.0",
    factPackageStatus: "available",
    scenarioContext: { ...scenario },
    semanticVersionId: SEMANTIC_VERSION_ID,
    semanticVersion: SEMANTIC_VERSION,
    dataVersion: DATA_VERSION,
    readiness: "可消费",
    asOf: DATA_AS_OF,
    contentFacts: [{ id: "FACT-S004-1", label: "借款人", value: "中国广核电力股份有限公司" }],
    anchors: [{ stableAnchor: "sec-01-borrower-evaluation" }],
    contentItems: [],
    renderManifest: { items: [] },
    authoritativeBinding: { semanticVersionId: SEMANTIC_VERSION_ID, semanticVersion: SEMANTIC_VERSION, dataAssetVersionId: DATA_ASSET_VERSION_ID, dataVersion: DATA_VERSION, consumableVersionId: CONSUMABLE_VERSION_ID, asOf: DATA_AS_OF }
  };
  const { api } = createSandbox({ m06 });
  const projected = api.projectS004ReportData({
    definitions: [{ id: "RD-FIN-001", scene: "S001", name: "集团融资经营分析报告" }],
    templates: [{ id: "RT-FIN-002", name: "S001 模板" }],
    scenes: [{ id: "S001", name: "集团融资" }, { id: "S004", name: "S004" }],
    reportEvidence: { facts: [{ id: "FACT-S001" }], factPackages: { "2026.08.09-01": { dataVersion: "2026.08.09-01" } } }
  });
  assert.equal(projected.definitions.length, 1);
  assert.equal(projected.definitions[0].id, "RDEF-S004-PREFLIGHT-002");
  assert.equal(projected.definitions[0].templateId, "RT-S004-PREFLIGHT-002");
  assert.equal(projected.templates[0].id, "RT-S004-PREFLIGHT-002");
  assert.equal(projected.reportEvidence.factPackages[DATA_VERSION].readiness, "可消费");
  assert.equal(projected.reportEvidence.authoritativeBinding.consumableVersionId, "T018-S004-20260815-001");
  assert.equal(projected.reportEvidence.facts[0].id, "FACT-S004-1");
  assert.equal(projected.s004RuntimeProjection.dataVersion, DATA_VERSION);
  assert.equal(projected.s004RuntimeProjection.identityStatus, "exact-match");
  assert.equal(projected.s004RuntimeProjection.reportDefinitionId, "RDEF-S004-PREFLIGHT-002");
  assert.equal(projected.s004RuntimeProjection.reportTemplateId, "RT-S004-PREFLIGHT-002");
  assert.equal(projected.s004RuntimeProjection.injectedBeforeApp, true);
  assert.doesNotMatch(JSON.stringify(projected), /RD-FIN-001|RT-FIN-002|融资经营分析/);
});

test("M06 在 RC_DATA 先到、原生种子后到时幂等补投影精确事实包", () => {
  const m06 = reportState();
  const { api, records, sandbox } = createSandbox({ m06, deferM06: true });
  sandbox.RC_DATA = {
    definitions: [{ id: "RD-FIN-001", scene: "S001" }],
    templates: [{ id: "RT-FIN-002", name: "S001 模板" }],
    scenes: [{ id: "S001", name: "集团融资" }, { id: "S004", name: "S004" }],
    reportEvidence: { factPackages: {} }
  };
  assert.deepEqual(sandbox.RC_DATA.reportEvidence.factPackages, {});

  records.set(M06_STATE_KEY, JSON.stringify(m06));
  const synchronized = api.synchronizeM06ReportDataProjection("test-delayed-native-seed");
  const installed = sandbox.RC_DATA.reportEvidence.factPackages[DATA_VERSION];
  assert.equal(synchronized.ready, true);
  assert.equal(synchronized.packageKey, DATA_VERSION);
  assert.equal(synchronized.identity.valid, true);
  assert.deepEqual(synchronized.identity.issues, []);
  assert.equal(installed.packageId, "EVID-S004-20260815-0002");
  assert.equal(installed.semanticVersionId, SEMANTIC_VERSION_ID);
  assert.equal(installed.dataVersion, DATA_VERSION);
  assert.equal(installed.authoritativeBinding.semanticVersionId, SEMANTIC_VERSION_ID);
  assert.equal(installed.authoritativeBinding.dataVersion, DATA_VERSION);
  assert.equal(installed.scenarioContext.scenarioRunId, scenario.scenarioRunId);
  assert.equal(api.s004ReportFactsConsumable(synchronized.resources), true);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004ReportDataSync, "exact-fact-package-installed");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004ReportDataIdentity, "exact-match");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004ReportFactPackageKey, DATA_VERSION);
});

test("M06 新内容版本空聚合不会覆盖不可变生成来源事实包", () => {
  const fixture = buildFormalRuntimeFixture();
  const active = jsonClone(fixture.m06);
  active.report = {
    scenarioContext: { ...scenario },
    aggregateId: "RAG-S004-20260816-001",
    stage: "evidence_missing",
    definitionId: "RDEF-S004-PREFLIGHT-002",
    generationMode: "standard",
    progress: 18,
    requestId: "RGEN-20260816-160308-001",
    evidencePackId: null,
    generationRunId: null,
    agentGenerationRefs: [],
    contentVersions: [],
    verificationRuns: [],
    evidencePacks: [],
    reviewHistory: [],
    publicationRuns: [],
    activeOperation: null,
    reportNo: null,
    contentVersion: null,
    bindingSnapshot: null,
    artifactManifest: null,
    humanReview: { status: "pending" },
    issues: [],
    verification: { status: "idle", results: [], coverage: {} }
  };
  active.publishedReports = [];
  const { api, sandbox } = createSandbox({
    m06: active,
    parentProjection: { scenarioContext: { ...scenario }, m06: fixture.m06 },
    c008State: fixture.c008,
    c017State: fixture.c017,
    seedMarker: fixture.marker,
    runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } }
  });

  const resources = api.reportResourcesFromState();
  assert.equal(resources.report.requestId, "RGEN-20260816-160308-001");
  assert.equal(resources.report.stage, "evidence_missing");
  assert.equal(resources.report.evidencePacks.length, 0);
  assert.equal(resources.generationSource.report.reportNo, "S004-PLR-2026-0001");
  assert.equal(resources.factPackage.packageId, "EVID-S004-20260815-0002");
  assert.equal(resources.factPackage.contentFacts.length, 19);
  assert.equal(resources.factPackage.anchors.length, 19);

  sandbox.RC_DATA = {
    definitions: [{ id: "RD-FIN-001", scene: "S001" }],
    templates: [{ id: "RT-FIN-002", name: "S001 模板" }],
    scenes: [{ id: "S001", name: "集团融资" }],
    reportEvidence: { factPackages: {} }
  };
  const synchronized = api.synchronizeM06ReportDataProjection("test-active-empty-aggregate");
  assert.equal(synchronized.ready, true);
  assert.deepEqual(synchronized.identity.issues, []);
  assert.equal(sandbox.RC_DATA.reportEvidence.factPackages[DATA_VERSION].contentFacts.length, 19);
  assert.equal(sandbox.RC_DATA.reportEvidence.factPackages[DATA_VERSION].anchors.length, 19);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004GenerationSource, "immutable-exact-package-captured");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004ReportDataSync, "exact-fact-package-installed");
});

test("M06 生成动作在基线安全门执行前同步精确 S004 事实包", () => {
  const fixture = buildFormalRuntimeFixture();
  const { sandbox, documentListeners } = createSandbox({
    m06: fixture.m06,
    c008State: fixture.c008,
    c017State: fixture.c017,
    seedMarker: fixture.marker,
    runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } }
  });
  sandbox.RC_DATA = {
    definitions: [{ id: "RD-FIN-001", scene: "S001" }],
    templates: [{ id: "RT-FIN-002", name: "S001 模板" }],
    scenes: [{ id: "S001", name: "集团融资" }],
    reportEvidence: { factPackages: {} }
  };
  assert.equal(sandbox.RC_DATA.reportEvidence.factPackages[DATA_VERSION]?.packageId, "EVID-S004-20260815-0002");

  // Simulate the first-click race observed in a real browser: the frozen
  // generation workspace has kept the RC_DATA object, but its exact package
  // map is momentarily empty before the native safety gate reads it.
  sandbox.RC_DATA.reportEvidence.factPackages = {};
  const generationCapture = (documentListeners.click || []).find((listener) =>
    String(listener).includes("before-generation-action"));
  assert.ok(generationCapture);
  generationCapture({
    target: {
      closest(selector) {
        return selector === "[data-action]"
          ? { dataset: { action: "start-pending-regeneration" } }
          : null;
      }
    }
  });

  assert.equal(sandbox.RC_DATA.reportEvidence.factPackages[DATA_VERSION].packageId, "EVID-S004-20260815-0002");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004GenerationActionData, "exact-fact-package-ready");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004ReportDataSyncReason, "before-generation-action:start-pending-regeneration");
});

test("M06 新 C022 在 Owner 提交前原生投影 S004 定义、模板、Published/C008 与 19 事实锚点", () => {
  const fixture = buildFormalRuntimeFixture();
  const { api, sandbox } = createSandbox({
    m06: fixture.m06,
    c008State: fixture.c008,
    c017State: fixture.c017,
    seedMarker: fixture.marker,
    runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } }
  });
  const binding = fixture.m06.report.bindingSnapshot;
  const baselinePayload = {
    requestId: "RGEN-20260817-020601-001",
    submittedAt: "2026-08-17 02:06:01",
    evidencePackId: "EP-20260817-020601-003",
    reportDefinition: { id: "RD-FIN-001", version: "1.0.0" },
    template: { id: "RT-FIN-002", version: "2.2.0", slots: ["finance-cover"] },
    semanticBinding: binding,
    reportContext: {
      scenarioContext: { ...scenario },
      reportAggregateId: "RAG-20260817-020601-002",
      reportRequestId: "RGEN-20260817-020601-001",
      reportDefinition: { id: "RD-FIN-001", version: "1.0.0" },
      template: { id: "RT-FIN-002", version: "2.2.0", slots: ["finance-cover"] },
      evidencePack: { id: "EP-20260817-020601-003", version: "1.0" },
      semanticBinding: binding
    },
    reportEvidence: {
      sections: [{ id: "finance-cover", title: "融资经营分析" }],
      anchors: [{ stableAnchor: "finance-cover" }],
      contentFacts: [{ id: "FACT-S001" }]
    }
  };
  const projected = api.normalizeS004GenerationRequest(baselinePayload);
  const validation = api.assertS004GenerationProjection(projected);
  assert.deepEqual(validation.issues, []);
  assert.equal(validation.valid, true);
  assert.equal(projected.requestId, "RGEN-20260816-020601-001");
  assert.equal(projected.submittedAt, "2026-08-16 02:06:01");
  assert.equal(projected.reportDefinition.id, "RDEF-S004-PREFLIGHT-002");
  assert.equal(projected.reportContext.reportDefinition.id, "RDEF-S004-PREFLIGHT-002");
  assert.equal(projected.template.id, "RT-S004-PREFLIGHT-002");
  assert.equal(projected.reportContext.template.id, "RT-S004-PREFLIGHT-002");
  assert.equal(projected.reportContext.evidencePack.id, "EP-20260816-020601-003");
  assert.equal(projected.reportContext.evidencePack.factPackageId, "EVID-S004-20260815-0002");
  assert.equal(projected.scenarioLabel, "S004 · 财务公司贷款贷前调查");
  assert.equal(projected.reportContext.scenarioLabel, "S004 · 财务公司贷款贷前调查");
  assert.equal(projected.reportEvidence.contentFacts.length, 19);
  assert.equal(projected.reportEvidence.anchors.length, 19);
  assert.equal(projected.reportEvidence.contentItems.length, 19);
  assert.ok(projected.reportEvidence.publishedResourceRefs.includes("MET-DEBT-ASSET-RATIO"));
  assert.ok(projected.reportEvidence.publishedResourceRefs.includes("RULE-S004-MEMBER-ACTIVE"));
  assert.equal(projected.reportContext.semanticBinding.semanticVersionId, SEMANTIC_VERSION_ID);
  assert.equal(projected.reportContext.semanticBinding.dataVersion, DATA_VERSION);
  assert.equal(projected.reportContext.semanticBinding.consumableVersionId, CONSUMABLE_VERSION_ID);
  assert.doesNotMatch(JSON.stringify(projected), /RD-FIN-001|RT-FIN-002|融资经营分析|20260817|2026-08-17/);

  let submittedPayload = null;
  sandbox.RC_EXTERNAL_OWNERS = {
    agent: {
      submitGeneration(payload) {
        submittedPayload = payload;
        return { owner: "Agent 应用", requestId: payload.requestId, status: "等待 Agent 应用接收", submittedAt: "2026-08-17 02:06:01" };
      }
    },
    trust: {},
    decision: {}
  };
  const ownerResult = sandbox.RC_EXTERNAL_OWNERS.agent.submitGeneration(baselinePayload);
  assert.equal(api.assertS004GenerationProjection(submittedPayload).valid, true);
  assert.equal(ownerResult.requestId, "RGEN-20260816-020601-001");
  assert.equal(ownerResult.submittedAt, "2026-08-16 02:06:01");
  assert.equal(sandbox.document.documentElement.dataset.ofwS004GenerationProjection, "valid");
});

test("M06 生成态校正只替换当前泄漏的 S001 证据包，不改写历史报告或旧 C022", () => {
  const fixture = buildFormalRuntimeFixture();
  const { api } = createSandbox({
    m06: fixture.m06,
    c008State: fixture.c008,
    c017State: fixture.c017,
    seedMarker: fixture.marker,
    runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } }
  });
  const state = {
    report: {
      scenarioContext: { ...scenario },
      requestId: "RGEN-20260817-030000-001",
      definitionId: "RD-FIN-001",
      evidencePacks: [{
        id: "EP-20260817-030000-002",
        reportDefinition: { id: "RD-FIN-001", version: "1.0.0" },
        template: { id: "RT-FIN-002", version: "2.2.0", slots: ["finance-cover"] },
        semanticBinding: fixture.m06.report.bindingSnapshot,
        authoritativeFactPackage: { contentFacts: [{ id: "FACT-S001" }], anchors: [{ stableAnchor: "finance-cover" }] },
        agentReference: { release: "融资报告生成助手 3.1.0", skill: "融资经营分析生成 1.0" }
      }]
    },
    publishedReports: [{ reportNo: "HIST-S004", marker: "RD-FIN-001", recordedAt: "2026-08-17 00:00:00" }]
  };
  const normalized = api.normalizeS004GenerationReportState(state);
  assert.equal(normalized.report.requestId, "RGEN-20260816-030000-001");
  assert.equal(normalized.report.definitionId, "RDEF-S004-PREFLIGHT-002");
  assert.equal(normalized.report.evidencePacks[0].reportDefinition.id, "RDEF-S004-PREFLIGHT-002");
  assert.equal(normalized.report.evidencePacks[0].template.id, "RT-S004-PREFLIGHT-002");
  assert.equal(normalized.report.evidencePacks[0].authoritativeFactPackage.contentFacts.length, 19);
  assert.equal(normalized.report.evidencePacks[0].authoritativeFactPackage.anchors.length, 19);
  assert.deepEqual(normalized.publishedReports, state.publishedReports);

  const historical = {
    requestId: "RGEN-S004-HISTORICAL",
    reportDefinition: { id: "RDEF-S004-PREFLIGHT-002", version: "2.0.0" },
    template: { id: "RT-S004-PREFLIGHT-002", version: "2.0.0" },
    reportContext: { scenarioContext: { ...scenario } },
    recordedAt: "2026-08-17 00:00:00"
  };
  const leaked = {
    requestId: "RGEN-20260817-040000-001",
    reportDefinition: { id: "RD-FIN-001", version: "1.0.0" },
    template: { id: "RT-FIN-002", version: "2.2.0" },
    reportContext: { scenarioContext: { ...scenario }, reportDefinition: { id: "RD-FIN-001" }, template: { id: "RT-FIN-002" }, evidencePack: { id: "EP-20260817-040000-002", version: "1.0" } },
    semanticBinding: fixture.m06.report.bindingSnapshot
  };
  const envelope = api.normalizeS004C022Envelope({ contractCode: "C022", formedAt: "2026-08-17 04:00:00", requests: [historical, leaked] });
  assert.deepEqual(envelope.requests[0], historical);
  assert.equal(envelope.requests[1].requestId, "RGEN-20260816-040000-001");
  assert.equal(envelope.requests[1].reportDefinition.id, "RDEF-S004-PREFLIGHT-002");
  assert.equal(envelope.formedAt, "2026-08-16 04:00:00");
});

test("S004 六模块共用演示时钟固定 2026-08-16，当前 Request/Run/Result 禁止越日", () => {
  for (const moduleId of ["M01", "M02", "M03", "M04", "M05", "M06"]) {
    const { api, sandbox } = createSandbox({ moduleId });
    const now = new sandbox.Date();
    assert.equal(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`, "2026-08-16");
    assert.equal(now.toISOString().slice(0, 10), "2026-08-16");
    assert.equal(api.s004NowIso().slice(0, 10), "2026-08-16");
    assert.equal(sandbox.__OFW_S004_DEMO_CLOCK__.date, "2026-08-16");
    assert.equal(sandbox.__OFW_S004_DEMO_CLOCK__.anchorIso, "2026-08-16T08:00:00.000Z");
    assert.equal(sandbox.document.documentElement.dataset.ofwS004DemoClock, "2026-08-16");
    assert.equal(api.normalizeS004DemoClockText("RGEN-20260817-235959-001"), "RGEN-20260816-235959-001");
    assert.equal(api.normalizeS004DemoClockText("2026-08-17 23:59:59"), "2026-08-16 23:59:59");
  }

  const { api, sandbox } = createSandbox();
  const invalidCurrentRun = {
    scenarioContext: { ...scenario },
    requests: [{ requestId: "RGEN-20260817-010101-001", scenarioContext: { ...scenario } }],
    runs: [{ id: "RUN-20260817-010102-001", runId: "RUN-20260817-010102-001", scenarioContext: { ...scenario }, result: { id: "RESULT-20260817-010103-001", resultId: "RESULT-20260817-010103-001" } }]
  };
  // requestId + Run.id + runId + Result.id + resultId are five distinct
  // persisted identity fields; every one must be rejected when it crosses
  // the S004 demonstration date boundary.
  assert.equal(api.s004RuntimeClockViolations(invalidCurrentRun).length, 5);
  const projectedM05State = api.normalizeS004CurrentRuntimeClockRecords({
    currentScenarioContext: { ...scenario },
    inboundRequests: [{
      id: "RGEN-20260817-010101-001",
      requestId: "RGEN-20260817-010101-001",
      receivedAt: "2026-08-17T01:01:01.000Z",
      scenarioContext: { ...scenario }
    }],
    runs: [{
      id: "RUN-20260817-010102-001",
      requestId: "RGEN-20260817-010101-001",
      startedAt: "2026-08-17T01:01:02.000Z",
      finishedAt: "2026-08-17T01:01:03.000Z",
      scenarioContext: { ...scenario },
      result: {
        id: "RESULT-20260817-010103-001",
        resultId: "RESULT-20260817-010103-001",
        generatedAt: "2026-08-17T01:01:03.000Z",
        scenarioContext: { ...scenario }
      }
    }]
  });
  assert.deepEqual(api.s004RuntimeClockViolations(projectedM05State), []);
  assert.equal(projectedM05State.inboundRequests[0].requestId, "RGEN-20260816-010101-001");
  assert.equal(projectedM05State.inboundRequests[0].receivedAt, "2026-08-16T01:01:01.000Z");
  assert.equal(projectedM05State.runs[0].id, "RUN-20260816-010102-001");
  assert.equal(projectedM05State.runs[0].startedAt, "2026-08-16T01:01:02.000Z");
  assert.equal(projectedM05State.runs[0].result.id, "RESULT-20260816-010103-001");
  assert.equal(projectedM05State.runs[0].result.generatedAt, "2026-08-16T01:01:03.000Z");
  assert.deepEqual(api.auditS004RuntimeClock(), []);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004RuntimeClockIntegrity, "2026-08-16-only");
});

test("M06 C008 或 C017 身份不一致时不把固定事实包暴露为可消费", () => {
  const { api, records } = createSandbox();
  const c017 = JSON.parse(records.get(C017_REPORT_KEY));
  c017.projections[0].dataVersion = "DATA-ASSET-S004-WRONG";
  records.set(C017_REPORT_KEY, JSON.stringify(c017));
  const projected = api.projectS004ReportData({ reportEvidence: { factPackages: {} }, scenes: [], templates: [], definitions: [] });
  const identity = api.m06ReportDataProjectionIdentity();
  assert.equal(identity.valid, false);
  assert.match(identity.issues.join("|"), /c017-projection-not-located/);
  assert.deepEqual(projected.reportEvidence.factPackages, {});
  assert.equal(projected.s004RuntimeProjection.identityStatus, "blocked");
});

test("M06 信任条在精确 S004 固定事实包可消费时不再显示事实不可定位", () => {
  const { api } = createSandbox();
  assert.equal(api.s004ReportFactsConsumable(), true);
  assert.match(runtimeSource, /ofwS004ReportConsumption = "consumable"/);
  assert.match(runtimeSource, /setText\(value, "可消费"\)/);
  assert.match(runtimeSource, /synchronizeM06ReportDataProjection\("report-render"\)/);
  assert.match(runtimeSource, /if \(!s004ReportFactsConsumable\(resources\)\) return/);
});

test("旧只读访问投影在完整 S004 运行资源存在时恢复为可追加运行", () => {
  const legacy = {
    scenarioAccess: { mode: "READ_ONLY_EXISTING_ARTIFACTS", label: "旧状态" },
    currentScenarioContext: { ...scenario },
    agentOverrides: [
      { id: "report-draft", status: "enabled" },
      { id: "report-copilot", status: "enabled" }
    ],
    evidencePackages: [{ id: "EVID-S004", status: "ready", scenarioContext: { ...scenario } }],
    inboundRequests: [], runs: [], sessions: []
  };
  const { api, records, sandbox } = createSandbox({ moduleId: "M05", m05: legacy });
  assert.equal(api.m05ScenarioReadOnly(), false);
  const restored = JSON.parse(records.get(M05_STATE_KEY));
  assert.equal(restored.scenarioAccess.mode, "APPEND_NEW_RUNS_PRESERVE_HISTORY");
  assert.equal(restored.scenarioAccess.previousMode, "READ_ONLY_EXISTING_ARTIFACTS");
  assert.match(restored.scenarioAccess.reason, /可在当前轮次追加运行/);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004M05AccessRecovery, "append-mode-restored");
});

test("当前 run_failed、pending、running 核验生命周期不被历史 PASS 覆盖", () => {
  const fixture = buildFormalRuntimeFixture();
  for (const status of ["run_failed", "pending", "running"]) {
    const m06 = jsonClone(fixture.m06);
    const historicalRunIds = m06.report.verificationRuns.map((item) => item.runId);
    const current = {
      scenarioContext: { ...scenario },
      runId: `VRF-S004-CURRENT-${status.toUpperCase()}`,
      status,
      attempt: 2,
      retryOf: historicalRunIds[0],
      coverage: { status: status === "run_failed" ? "error" : "pending", pending: status === "run_failed" ? 0 : 18, error: status === "run_failed" ? 1 : 0 },
      results: []
    };
    m06.report.postPublicationVerification = jsonClone(current);
    m06.publishedReports[0].postPublicationVerification = jsonClone(current);
    const { api, records, sandbox } = createSandbox({
      m06,
      c008State: fixture.c008,
      c017State: fixture.c017,
      seedMarker: fixture.marker,
      runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } }
    });
    const stored = JSON.parse(records.get(M06_STATE_KEY));
    assert.equal(stored.report.postPublicationVerification.status, status);
    assert.equal(stored.report.postPublicationVerification.runId, current.runId);
    assert.equal(stored.publishedReports[0].postPublicationVerification.status, status);
    historicalRunIds.forEach((runId) => assert.ok(stored.report.verificationRuns.some((item) => item.runId === runId)));
    assert.equal(api.ensureS004CompletedVerificationProjection(), false);
    assert.equal(sandbox.document.documentElement.dataset.ofwS004VerificationRecovery, "current-lifecycle-preserved");
  }
  assert.match(runtimeSource, /current-lifecycle-preserved/);
  assert.match(runtimeSource, /核验规则与执行口径/);
  assert.match(runtimeSource, /failed-history-preserved-completed-results-visible/);
  assert.match(runtimeSource, /最近完成核验结果可用；失败尝试已保留/);
  assert.match(runtimeSource, /data-s004-last-completed-verification/);
  assert.match(runtimeSource, /重新核验当前版本/);
  assert.match(runtimeSource, /!currentStatus && assistantContent\.textContent\?\.includes\("核验任务中断"\)/);
  assert.match(runtimeSource, /details\.dataset\.s004VerificationSignature/);
  assert.match(runtimeSource, /当前任务：/);
});

test("旧轮次精简事实包从受控运行上下文补齐后可独立重跑且不覆盖失败历史", () => {
  const fixture = buildFormalRuntimeFixture();
  const compact = jsonClone(fixture.m06);
  const current = {
    scenarioContext: { ...scenario },
    runId: "VRF-S004-LEGACY-COMPACT-FAILED",
    status: "run_failed",
    attempt: 2,
    coverage: { status: "error", pending: 0, error: 1 },
    results: []
  };
  [compact.report, ...compact.publishedReports].forEach((report) => {
    delete report.evidencePacks[0].authoritativeFactPackage.deterministicInputs;
    report.postPublicationVerification = jsonClone(current);
  });
  const { api, records } = createSandbox({
    m06: compact,
    c008State: fixture.c008,
    c017State: fixture.c017,
    runtimeProfile: { ...runtimeConfig(), artifactIntegrity: { expected: fixture.expectedIntegrity } },
    verificationContext: {
      schemaVersion: "ofw.s004.verification-context.v1",
      scenarioContext: { ...scenario },
      evidencePackId: fixture.m06.report.evidencePackId,
      semanticVersionId: SEMANTIC_VERSION_ID,
      dataVersion: DATA_VERSION,
      deterministicInputs: fixture.m06.report.evidencePacks[0].authoritativeFactPackage.deterministicInputs,
      artifactIntegrity: fixture.marker.artifactFingerprint,
      definition: fixture.m06.customDefinitions[0]
    }
  });
  const hydrated = api.reportResourcesFromState();
  assert.equal(
    hydrated.factPackage.deterministicInputs.metricResults.length,
    fixture.m06.report.evidencePacks[0].authoritativeFactPackage.deterministicInputs.metricResults.length
  );
  assert.equal(hydrated.factPackage.deterministicInputs.riskThemes.length, 4);
  assert.equal(hydrated.factPackage.deterministicInputs.ownership.topShareholders.length, 10);

  const rerun = api.rerunS004DeterministicVerification();
  assert.ok(rerun);
  assert.equal(rerun.sourceMode, "recomputed-from-fixed-context");
  assert.equal(rerun.results.length, 18);
  assert.equal(rerun.results.every((item) => item.status === "pass"), true);
  assert.equal(rerun.publicationEligible, true);

  const stored = JSON.parse(records.get(M06_STATE_KEY));
  assert.ok(stored.report.verificationRuns.some((item) => item.runId === current.runId));
  assert.equal(stored.report.postPublicationVerification.runId, rerun.runId);
  assert.equal(
    stored.report.evidencePacks[0].authoritativeFactPackage.deterministicInputs.metricResults.length,
    fixture.m06.report.evidencePacks[0].authoritativeFactPackage.deterministicInputs.metricResults.length
  );
});

test("确定性核验从固定上下文逐项执行 18 个 VER-V2 检查并映射 V01—V08", () => {
  const { api, fixture, m06 } = createFormalVerificationSandbox();
  const run = api.executeS004DeterministicVerification(m06.report, {
    definition: m06.customDefinitions[0],
    runId: "VRF-S004-DETAIL-20260816-001",
    completedAt: "2026-08-16T10:00:00.000Z"
  });
  const expectedCheckIds = fixture.artifacts.deterministicVerification.checks.map((item) => item.checkId);
  assert.equal(run.status, "completed-s004-deterministic");
  assert.equal(run.deterministicStatus, "completed");
  assert.equal(run.sourceMode, "recomputed-from-fixed-context");
  assert.equal(run.results.length, 18);
  assert.deepEqual(run.results.map((item) => item.checkId), expectedCheckIds);
  assert.equal(run.unitResults.length, 18);
  assert.equal(run.planSnapshot.length, 18);
  assert.deepEqual([...new Set(run.results.map((item) => item.ruleCode))].sort(), ["V01", "V02", "V03", "V04", "V05", "V06", "V07", "V08"]);
  assert.equal(run.results.every((item) => item.status === "pass"), true);
  assert.equal(run.results.every((item) => item.issue && item.evidence && item.version && item.responsibility && item.recommendation), true);
  assert.equal(run.coverage.planned, 18);
  assert.equal(run.coverage.completed, 18);
  assert.equal(run.coverage.factCovered, run.coverage.factTotal);
  assert.equal(run.coverage.anchorCovered, run.coverage.anchorTotal);
  assert.equal(run.publicationEligible, true);
  assert.equal(run.completedAt, "2026-08-16T10:00:00.000Z");

  const metricRecalculation = run.results.find((item) => item.checkId === "VER-V2-METRIC-RECALCULATION");
  assert.equal(metricRecalculation.ruleCode, "V04");
  assert.match(metricRecalculation.issue, /14 项 × 3 年 Metric/);
  assert.match(metricRecalculation.evidence, /42 个复算单元/);
  const workingCapital = run.results.find((item) => item.checkId === "VER-V2-WORKING-CAPITAL-CALCULATION");
  assert.equal(workingCapital.ruleCode, "V04");
  assert.match(workingCapital.issue, /营运资金周转次数、营运资金量和新增流动资金贷款额度/);
  assert.match(workingCapital.evidence, /周转次数 2\.238/);
  assert.match(workingCapital.evidence, /营运资金量 2340573/);
  assert.match(workingCapital.evidence, /新增额度 257901/);
});

test("确定性核验在 C008、证据包、T044 或人工确认边界被篡改时失败关闭", () => {
  const cases = [
    {
      name: "C008",
      expectedRule: "V02",
      mutate({ c008 }) { c008.current.dataVersion = "DATA-ASSET-S004-TAMPERED"; }
    },
    {
      name: "证据包 Owner",
      expectedRule: "V06",
      mutate({ m06 }) { m06.report.evidencePacks[0].artifactEvidencePackage.owner = "M05"; }
    },
    {
      name: "T044",
      expectedRule: "V07",
      mutate({ m06 }) {
        const bindings = m06.report.contentVersions[0].t044Bindings || [];
        bindings.forEach((binding) => {
          binding.bindingStatus = "missing";
          binding.factRefs = ["FACT-S004-TAMPERED-NOT-IN-INVENTORY"];
        });
        const packageItems = m06.report.evidencePacks[0].authoritativeFactPackage.contentItems || [];
        packageItems.forEach((item) => {
          item.bindingStatus = "missing";
          item.factRefs = ["FACT-S004-TAMPERED-NOT-IN-INVENTORY"];
        });
      }
    },
    {
      name: "人工确认边界",
      expectedRule: "V08",
      mutate({ m06 }) {
        const fact = m06.report.contentVersions[0].factInventory.find((item) => item.aiSuggestion === true);
        fact.aiSuggestion = false;
      }
    }
  ];
  cases.forEach(({ name, expectedRule, mutate }, index) => {
    const { api, m06 } = createFormalVerificationSandbox(mutate);
    const run = api.executeS004DeterministicVerification(m06.report, {
      definition: m06.customDefinitions[0],
      runId: `VRF-S004-TAMPER-20260816-${String(index + 1).padStart(3, "0")}`,
      completedAt: "2026-08-16T10:05:00.000Z"
    });
    assert.equal(run.publicationEligible, false, name);
    assert.equal(run.deterministicStatus, "completed-with-findings", name);
    assert.ok(run.results.some((item) => item.ruleCode === expectedRule && ["fail", "unverifiable"].includes(item.status)), name);
  });

  const missingC008 = createFormalVerificationSandbox(({ c008 }) => {
    c008.current = {};
  });
  const unverifiable = missingC008.api.executeS004DeterministicVerification(missingC008.m06.report, {
    definition: missingC008.m06.customDefinitions[0],
    runId: "VRF-S004-MISSING-C008-20260816-001",
    completedAt: "2026-08-16T10:06:00.000Z"
  });
  assert.ok(unverifiable.results.some((item) => item.ruleCode === "V02" && item.status === "unverifiable"));
  assert.equal(unverifiable.publicationEligible, false);
});

test("营运资金复算篡改会使 VER-V2-WORKING-CAPITAL-CALCULATION 失败", () => {
  const { api, m06 } = createFormalVerificationSandbox(({ m06 }) => {
    m06.report.evidencePacks[0].authoritativeFactPackage.deterministicInputs.workingCapital.maximumNewWorkingCapitalLoan = "257902";
  });
  const run = api.executeS004DeterministicVerification(m06.report, {
    definition: m06.customDefinitions[0],
    runId: "VRF-S004-WORKING-CAPITAL-20260816-001",
    completedAt: "2026-08-16T10:10:00.000Z"
  });
  const result = run.results.find((item) => item.checkId === "VER-V2-WORKING-CAPITAL-CALCULATION");
  assert.equal(result.ruleCode, "V04");
  assert.equal(result.status, "fail");
  assert.match(result.issue, /营运资金复算不一致/);
  assert.equal(run.publicationEligible, false);
});

test("重新核验保留当前失败 Run 并新增独立运行记录", () => {
  const created = createFormalVerificationSandbox(({ m06 }) => {
    const failed = {
      scenarioContext: { ...scenario },
      runId: "VRF-S004-FAILED-20260816-001",
      status: "run_failed",
      attempt: 2,
      coverage: { status: "error", pending: 0, error: 1 },
      results: []
    };
    m06.report.postPublicationVerification = jsonClone(failed);
    m06.publishedReports[0].postPublicationVerification = jsonClone(failed);
  });
  const { api, records } = created;
  const before = JSON.parse(records.get(M06_STATE_KEY));
  const beforeRunIds = before.report.verificationRuns.map((item) => item.runId);
  const run = api.rerunS004DeterministicVerification();
  assert.match(run.runId, /^VRF-S004-RERUN-20260816-/);
  assert.equal(run.retryOf, "VRF-S004-FAILED-20260816-001");
  assert.equal(run.attempt, 3);
  assert.equal(run.status, "completed-s004-deterministic");
  assert.equal(run.deterministicStatus, "completed");
  assert.equal(run.coverage.status, "complete");
  assert.equal(run.results.length, 18);
  assert.equal(run.results.every((item) => item.status === "pass"), true);
  assert.equal(run.results.every((item) => item.location && !String(item.location).includes("undefined")), true);
  const state = JSON.parse(records.get(M06_STATE_KEY));
  assert.equal(state.report.postPublicationVerification.runId, run.runId);
  assert.equal(state.publishedReports[0].postPublicationVerification.runId, run.runId);
  assert.equal(state.report.verificationRuns.at(-1).runId, run.runId);
  assert.equal(state.report.verificationRuns.at(-1).status, "completed-s004-deterministic");
  assert.ok(state.report.verificationRuns.some((item) => item.runId === "VRF-S004-FAILED-20260816-001" && item.status === "run_failed"));
  beforeRunIds.forEach((runId) => assert.ok(state.report.verificationRuns.some((item) => item.runId === runId)));
  assert.notEqual(run.runId, "VRF-S004-FAILED-20260816-001");
});

test("C024 新问答按现有最大序号递增，页面重载后也不覆盖历史 Session、Run、Result", () => {
  const { api } = createSandbox();
  assert.equal(api.nextS004CopilotOrdinal({
    runs: [
      { id: "RUN-S004-COPILOT-20260816-002", result: { id: "RESULT-S004-COPILOT-20260816-002" } },
      { id: "RUN-S004-REPORT-20260816-099" }
    ],
    sessions: [{ id: "SESSION-S004-COPILOT-20260816-004" }],
    runtimeActivity: [{ runId: "RUN-S004-COPILOT-20260816-003" }]
  }), 5);
  assert.equal(api.nextS004CopilotOrdinal({ runs: [], sessions: [], runtimeActivity: [] }), 1);
  assert.match(runtimeSource, /nextS004CopilotOrdinal\(model\)/);
});

test("C024 页面投影优先使用递增 Run 序号，不被重载后回退的演示时间戳误导", () => {
  const firstRequest = c024Request();
  const { api, records } = createSandbox({ request: firstRequest });
  const first = api.completeS004C024InAgentOwner(firstRequest.requestId);
  const staleReportPointer = reportState();
  staleReportPointer.assistant.requestRef = {
    requestId: first.request.id,
    runId: first.run.id,
    resultId: first.result.id,
    sessionId: first.session.id
  };

  const secondRequest = {
    ...c024Request(),
    requestId: "C024-S004-QA-RELOADED-002",
    receivedAt: "2026-08-16T00:59:00.000Z",
    question: "股权结构、控股股东和集团成员资格如何联合核验？"
  };
  records.set(C024_INBOX_KEY, JSON.stringify({ contractCode: "C024", requests: [firstRequest, secondRequest] }));
  const second = api.completeS004C024InAgentOwner(secondRequest.requestId);
  assert.equal(second.run.id, "RUN-S004-COPILOT-20260816-002");
  assert.ok(Date.parse(second.request.receivedAt) < Date.parse(first.request.receivedAt));

  const projection = api.locateS004CopilotProjection(JSON.parse(records.get(M05_STATE_KEY)), staleReportPointer);
  assert.equal(projection.request.id, secondRequest.requestId);
  assert.equal(projection.run.id, second.run.id);
  assert.equal(projection.result.id, second.result.id);
  assert.equal(projection.session.id, second.session.id);
  assert.match(projection.result.summary, /控股股东为\s*中国广核集团有限公司/);
  assert.match(runtimeSource, /s004CopilotOrdinalFromId/);
});

test("C024 独立历史账本在原生种子状态回退后恢复新增问答运行", () => {
  const historyRequest = {
    id: "C024-S004-HISTORY-004",
    sourceRequestId: "C024-S004-HISTORY-004",
    type: "report-copilot",
    scenarioContext: { ...scenario }
  };
  const historyRun = {
    id: "RUN-S004-COPILOT-20260816-004",
    requestId: historyRequest.id,
    status: "complete",
    scenarioContext: { ...scenario },
    snapshot: { agentId: "report-copilot" },
    result: { id: "RESULT-S004-COPILOT-20260816-004" }
  };
  const historySession = {
    id: "SESSION-S004-COPILOT-20260816-004",
    latestRunId: historyRun.id,
    latestResultId: historyRun.result.id,
    scenarioContext: { ...scenario }
  };
  const { api, records } = createSandbox({
    m05: {
      inboundRequests: [historyRequest],
      runs: [historyRun],
      sessions: [historySession],
      c024Rejections: [],
      runtimeActivity: [{ id: "ACT-004", contract: "C024 → C025", requestId: historyRequest.id, runId: historyRun.id, scenarioContext: { ...scenario } }]
    }
  });
  const historyKey = api.s004QaHistoryKey();
  assert.ok(records.has(historyKey));
  const seededReset = { inboundRequests: [], runs: [], sessions: [], c024Rejections: [], runtimeActivity: [] };
  records.set(M05_STATE_KEY, JSON.stringify(seededReset));
  const restored = api.mergeS004QaHistory(seededReset);
  assert.equal(restored.inboundRequests[0].id, historyRequest.id);
  assert.equal(restored.runs[0].id, historyRun.id);
  assert.equal(restored.sessions[0].id, historySession.id);
  assert.equal(api.nextS004CopilotOrdinal(restored), 5);
  assert.match(runtimeSource, /ofw\.s004\.qa-history\.v1/);
});

test("M05 Owner 消费 C024 并幂等形成 Session、Run、Result，M06 可按 requestId 回读", () => {
  const { api, records, sandbox } = createSandbox();
  const first = api.completeS004C024InAgentOwner("C024-S004-QA-TEST");
  assert.equal(first.run.status, "complete");
  assert.match(first.result.summary, /资产负债率/);
  assert.equal(first.result.contextSnapshot.reportNumber, "S004-PLR-2026-0001");
  assert.equal(first.result.contextSnapshot.contentVersion, "2.0.0");
  assert.equal(first.result.contextSnapshot.evidencePackageId, "EVID-S004-20260815-0002");
  assert.equal(first.result.contextSnapshot.dataVersion, DATA_VERSION);
  assert.ok(first.result.citations.includes("MET-DEBT-ASSET-RATIO"));
  assert.ok(first.result.citations.includes("BS-ST-BORROWINGS"));
  assert.equal(first.result.confirmation, "credit-decision-human-only");
  assert.match(first.result.limitations, /不形成授信决定/);
  const afterFirst = JSON.parse(records.get(M05_STATE_KEY));
  assert.equal(afterFirst.inboundRequests.filter((item) => item.id === "C024-S004-QA-TEST").length, 1);
  assert.equal(afterFirst.runs.filter((item) => item.requestId === "C024-S004-QA-TEST").length, 1);
  assert.equal(afterFirst.sessions.filter((item) => item.latestRunId === first.run.id).length, 1);
  assert.equal(afterFirst.runtimeActivity.length, 1);
  assert.doesNotMatch(JSON.stringify(afterFirst), /20260817|2026-08-17/);
  assert.deepEqual(api.s004RuntimeClockViolations(afterFirst), []);
  assert.equal(String(first.run.startedAt || first.run.createdAt).startsWith("2026-08-16"), true);
  assert.equal(String(first.run.finishedAt || first.run.completedAt).startsWith("2026-08-16"), true);
  assert.equal(String(first.result.generatedAt || first.result.completedAt).startsWith("2026-08-16"), true);
  const second = api.completeS004C024InAgentOwner("C024-S004-QA-TEST");
  assert.equal(second.run.id, first.run.id);
  const afterSecond = JSON.parse(records.get(M05_STATE_KEY));
  assert.equal(afterSecond.runs.filter((item) => item.requestId === "C024-S004-QA-TEST").length, 1);
  assert.equal(afterSecond.runtimeActivity.length, 1);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004C024OwnerState, "idempotent-existing-result");
  assert.match(runtimeSource, /immutable-m05-result/);
  assert.match(runtimeSource, /legacy-result-fixed-evidence-projection/);
  assert.match(runtimeSource, /回答依据/);
});

test("C024 答案以固定证据包覆盖活动借款人配置，切换配置不会串入其他公司事实", () => {
  const driftingProfile = runtimeConfig();
  driftingProfile.borrowerProfiles.profiles[0].legalName = "错误活动借款人有限公司";
  driftingProfile.borrowerProfiles.profiles[0].unifiedSocialCreditCode = "911111111111111111";
  driftingProfile.applicationProfiles.applications[0].requestedAmount = 999;
  const request = c024Request();
  request.question = "本次贷款申请的金额、期限、用途和还款来源是什么？";
  const { api } = createSandbox({ request, runtimeProfile: driftingProfile });
  const completed = api.completeS004C024InAgentOwner(request.requestId);
  assert.match(completed.result.summary, /100,000 万元/);
  assert.doesNotMatch(completed.result.summary, /999 万元|错误活动借款人/);
  assert.equal(completed.result.contextSnapshot.factPackageId, "EVID-S004-20260815-0002");
});

test("成员资格缺少固定事实时显示未定位，不得默认 ACTIVE", () => {
  const m06 = reportState();
  delete m06.report.evidencePacks[0].authoritativeFactPackage.deterministicInputs.memberStatus;
  const { api } = createSandbox({ m06 });
  const answer = api.m06AnswerForQuestion("财务公司如何确认借款人属于集团成员单位？");
  assert.match(answer.answer, /成员资格状态为 未定位/);
  assert.match(answer.answer, /不得默认 ACTIVE/);
  assert.doesNotMatch(answer.answer, /成员资格状态为 ACTIVE/);
});

test("多意图自由问题优先匹配征信与担保资料，不被宽泛贷款申请意图截获", () => {
  const { api } = createSandbox();
  const answer = api.m06AnswerForQuestion("本次贷款申请的征信和担保资料是否齐全？");
  assert.equal(answer.intent, "credit-investigation");
  assert.match(answer.answer, /已登记、待人工核验/);
  assert.doesNotMatch(answer.answer, /申请金额为/);
});

test("C024 场景、报告、证据或双版本身份不一致时拒绝且不生成 Run", () => {
  const bad = c024Request({
    scenarioContext: { ...scenario, scenarioRunId: "S004-RUN-WRONG" },
    evidencePack: { id: "EVID-WRONG", version: "9.9.9" },
    semanticBinding: {
      semanticVersionId: "SEM-WRONG", semanticVersion: "9.9.9",
      dataAssetVersionId: "DAV-WRONG", dataVersion: "DATA-WRONG",
      consumableVersionId: "T019-WRONG", asOf: "2099-12-31"
    }
  });
  const { api, records, sandbox } = createSandbox({ request: bad });
  const result = api.completeS004C024InAgentOwner("C024-S004-QA-TEST");
  assert.equal(result.rejected, true);
  assert.match(result.rejection.issues.join("；"), /场景五字段/);
  assert.match(result.rejection.issues.join("；"), /固定证据包/);
  const model = JSON.parse(records.get(M05_STATE_KEY));
  assert.equal(model.runs.length, 0);
  assert.equal(model.c024Rejections.length, 1);
  assert.equal(sandbox.document.documentElement.dataset.ofwS004C024OwnerState, "rejected-identity-mismatch");
});

test("M06 不再阻断基线原生运行、升版或撤回动作，历史正式内容仍保持不可变语义", () => {
  assert.doesNotMatch(runtimeSource, /M06_READONLY_ACTIONS/);
  assert.doesNotMatch(runtimeSource, /ofwS004ReadOnlyBlocked/);
  assert.match(runtimeSource, /历史正式 HTML\/PDF 不原地改写/);
  assert.match(runtimeSource, /immutable-artifact-interactive-assistant/);
  assert.match(runtimeSource, /当前隔离轮次可追加新的问答、Agent Run、内容版本和确定性核验记录/);
  assert.match(runtimeSource, /当前固定证据与闭环可用于形成新的草稿、运行和核验记录；本轮不执行正式发布/);
});

test("报告名称优先读取场景命名策略并保留通用 fallback", () => {
  const currentTitle = "中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）";
  assert.equal(createSandbox({ reportTitle: currentTitle }).api.currentS004ReportTitle(), currentTitle);
  assert.equal(createSandbox({ withRuntimeConfig: false }).api.currentS004ReportTitle(), "集团成员单位贷款贷前调查报告");
  assert.match(runtimeSource, /reportNamingPolicy\?\.currentTitle/);
  assert.doesNotMatch(runtimeSource, /const reportTitle = "财务公司贷款贷前调查报告"/);
  assert.match(runtimeSource, /新建贷前调查报告生成运行/);
  assert.match(runtimeSource, /data-s004-generation-borrower/);
  assert.match(runtimeSource, /其他集团成员单位/);
  assert.match(runtimeSource, /前往数据工程准备/);
  assert.match(runtimeSource, /dedupeM06ReportDefinitions/);
  assert.doesNotMatch(runtimeSource, /S004 当前固定事实包与多借款人装配/);
  assert.doesNotMatch(runtimeSource, /集团成员单位通用适配/);
});

test("正式报告工具栏取消查看 PDF 按钮并保留包含公司、年份和出具日期的下载入口", () => {
  assert.match(runtimeSource, /"查看 PDF", true/);
  assert.doesNotMatch(runtimeSource, /preview\.dataset\.s004PreviewPdf = "true"/);
  assert.match(runtimeSource, /querySelectorAll\?\.\("\[data-s004-preview-pdf\]"\)/);
  assert.match(runtimeSource, /download\.download = formalReportDownloadName\("pdf"\)/);
  assert.match(runtimeSource, /download\.textContent = "下载 PDF"/);
  assert.match(runtimeSource, /s004FormalOutputDownload/);
  assert.match(runtimeSource, /data-s004-open-pdf-original/);
  assert.match(runtimeSource, /新窗口打开 PDF 原件/);
  assert.match(runtimeSource, /data-s004-download-pdf-original/);
  const currentTitle = "中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）";
  assert.equal(createSandbox({ reportTitle: currentTitle }).api.formalReportDownloadName("pdf"), `${currentTitle}.pdf`);
  assert.match(runtimeSource, /opened-in-page-images/);
  assert.match(runtimeSource, /<h2>\$\{escapeHtml\(reportTitle\)\}<\/h2>/);
  assert.doesNotMatch(runtimeSource, /<iframe class="s004-pdf-viewer-frame"/);
  assert.match(runtimeSource, /s004-pdf-page-stack/);
  assert.match(runtimeSource, /逐页图像由不可变 PDF 确定性渲染，仅用于兼容查看，正式产物仍以原 PDF 文件为准/);
  for (let page = 1; page <= 11; page += 1) {
    const filename = `RPT-S004-CGNPC-20260815-v2.0-page-${String(page).padStart(2, "0")}.png`;
    assert.ok(fs.existsSync(path.join(RUNTIME_DIR, "artifacts/pdf-preview", filename)), `缺少 PDF 预览页 ${filename}`);
  }
  assert.doesNotMatch(runtimeSource, /在新标签页打开/);
  assert.match(runtimeSource, /下载 PDF 原件/);
  assert.match(runtimeSource, /data-s004-close-pdf/);
  assert.match(runtimeSource, /\[data-action=\"open-pdf\"\], \[data-action=\"open-export-pdf\"\]/);
  assert.match(runtimeSource, /ofwS004PdfEntry/);
});
