import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const ownersSource = fs.readFileSync(`${root}/external-owners.js`, "utf8");
const appSource = fs.readFileSync(`${root}/app.js`, "utf8");
const dataSource = fs.readFileSync(`${root}/data.js`, "utf8");

const dataContext = vm.createContext({ window: {}, console });
vm.runInContext(dataSource, dataContext, { filename: "data.js" });
const reportEvidenceInventory = dataContext.window.RC_DATA.reportEvidence;
assert.equal(reportEvidenceInventory.facts.length, 60, "报告中心 canonical facts 必须为 60 条");
assert.equal(reportEvidenceInventory.anchors.length, 77, "报告中心 canonical anchors 必须为 77 条");
assert.equal(reportEvidenceInventory.contentItems.length, 85, "报告中心 canonical content items 必须为 85 条");
assert.equal(reportEvidenceInventory.renderManifest.items.length, 85, "报告中心 renderManifest 必须覆盖 85 条 content items");

const overlayStart = appSource.indexOf("function reportFactPackageFor");
const overlayEnd = appSource.indexOf("function factPackageForReport");
assert.ok(overlayStart >= 0 && overlayEnd > overlayStart, "报告事实叠加 helper 必须存在");
const overlayFunctionSource = appSource.slice(overlayStart, overlayEnd);
const overlayBinding = {
  bindingId: "T019-S001-001",
  semanticVersionId: "PUB-S001-001",
  semanticVersion: "1.0.1",
  dataAssetVersionId: "FIN-ASSET-20251231-v03",
  dataVersion: "FIN-ASSET-20251231-v03",
  consumableVersionId: "T018-S001-001",
  asOf: "2025-12-31",
  readiness: "可消费",
};
const overlayTrust = {
  id: "C017-CURRENT-S001-001",
  version: "1.0",
  formedAt: "2026-08-15 20:00:00",
  publishedQuality: "有提示",
  publishedQualityDetails: "担保方式存在未知值",
  freshness: "当前",
  readiness: "可消费",
};
const overlayReport = { bindingSnapshot: overlayBinding, evidencePacks: [] };
const overlaySourcePackage = {
  packageId: "AFP-SR-S001-M06-001-T019-S001-001",
  packageVersion: "1.0",
  schemaVersion: "1.0",
  factInventoryVersion: "S001-FINANCE-FACTS-1.0",
  factPackageStatus: "available",
  sceneId: "S001",
  authorityBindingId: overlayBinding.bindingId,
  semanticVersionId: overlayBinding.semanticVersionId,
  semanticVersion: overlayBinding.semanticVersion,
  dataAssetVersionId: overlayBinding.dataAssetVersionId,
  dataVersion: overlayBinding.dataVersion,
  consumableVersionId: overlayBinding.consumableVersionId,
  asOf: overlayBinding.asOf,
  contentFacts: [{ id: "FACT-GROUP-COST", value: 2.35, unit: "%", evidence: ["M01-EVIDENCE"] }],
  anchors: [{ id: "ontology-group-cost", factId: "FACT-GROUP-COST", factRefs: ["FACT-GROUP-COST"], evidence: ["M01-EVIDENCE"] }],
  contentItems: [{ contentItemId: "ONT-CONTENT-001", anchorId: "ontology-group-cost", factRefs: ["FACT-GROUP-COST"], evidenceRefs: ["M01-EVIDENCE"], requiresEvidence: true }],
  renderManifest: { manifestId: "M01-MANIFEST", version: "1.0", items: [] },
};
const overlayReportFactPackageFor = new Function(
  "DATA", "clone", "bindingFor", "evidencePackFor", "factPackageForBinding", "currentTrust", "readingReport", "formatNumber",
  `${overlayFunctionSource}\nreturn reportFactPackageFor;`,
)(
  dataContext.window.RC_DATA,
  (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
  () => overlayBinding,
  () => null,
  () => null,
  () => overlayTrust,
  () => overlayReport,
  (value) => String(value),
);
const overlayPackage = overlayReportFactPackageFor(overlayReport, overlaySourcePackage);
assert.equal(overlayPackage.contentFacts.length, 60, "叠加后的报告事实库存必须为 60 条");
assert.equal(overlayPackage.anchors.length, 77, "叠加后的报告锚点库存必须为 77 条");
assert.equal(overlayPackage.contentItems.length, 85, "叠加后的报告内容项库存必须为 85 条");
assert.equal(overlayPackage.renderManifest.items.length, 85, "叠加后的 renderManifest 必须为 85 条");
assert.equal(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-GROUP-COST").value, 2.35, "M01 事实值应覆盖报告静态值");
assert.equal(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-DATA-VERSION").value, overlayBinding.dataVersion, "数据版本应按报告绑定动态回填");
assert.equal(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-DATA-QUALITY-STATUS").value, overlayTrust.publishedQuality, "C017 质量应按报告固定摘要动态回填");
const unavailableOverlayPackage = overlayReportFactPackageFor(overlayReport, null);
assert.notEqual(unavailableOverlayPackage.factPackageStatus, "available", "缺少 C008 精确事实包时不得以报告静态库存冒充可消费事实包");

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const keys = {
  c008: "ontology3-c008-authoritative-projection-v1",
  c017: "ontology3.c017.report-center.projection.v1",
  scenario: "ontology3.platform.scenario-runtime.v1",
  handoff: "ontology3.0-s001-handoff-v1:scenario-context",
  agent: "ontology3.agent-application.catalog.v7",
};

const scenario = Object.freeze({
  scenarioId: "S001",
  scenarioVersion: "1.0",
  scenarioRunId: "SR-S001-M06-001",
  formedAt: "2026-08-15 20:00:00",
  status: "active",
});

function buildProjection({ includeFactPackage = true, factPackagePatch = {} } = {}) {
  const binding = {
    bindingId: "T019-S001-001",
    semanticVersionId: "PUB-S001-001",
    semanticVersion: "1.0.1",
    dataAssetVersionId: "FIN-ASSET-20251231-v03",
    dataVersion: "FIN-ASSET-20251231-v03",
    consumableVersionId: "T018-S001-001",
    asOf: "2025-12-31",
  };
  const factPackage = {
    packageId: "RFP-S001-FIN-ASSET-20251231-v03",
    packageVersion: "1.0",
    schemaVersion: "1.1",
    factInventoryVersion: "1.1",
    factPackageStatus: "available",
    sceneId: scenario.scenarioId,
    authorityBindingId: binding.bindingId,
    semanticVersionId: binding.semanticVersionId,
    semanticVersion: binding.semanticVersion,
    dataAssetVersionId: binding.dataAssetVersionId,
    dataVersion: binding.dataVersion,
    consumableVersionId: binding.consumableVersionId,
    asOf: binding.asOf,
    contentFacts: [{ id: "FACT-GROUP-COST", value: 2.35, unit: "%" }],
    anchors: [{ id: "metric-cost", factRefs: ["FACT-GROUP-COST"] }],
    contentItems: [{ contentItemId: "metric-cost", anchorId: "metric-cost", factRefs: ["FACT-GROUP-COST"] }],
    renderManifest: { manifestId: "RM-S001-001", version: "1.0", items: [] },
    ...factPackagePatch,
  };
  const c008 = {
    projectionId: keys.c008,
    projectionVersion: "3",
    schemaVersion: 1,
    formedAt: "2026-08-15 20:01:00",
    sourceModule: "本体管理",
    contractCode: "C008",
    readStatus: "available",
    scenarioContext: scenario,
    current: {
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataVersion: binding.dataVersion,
      asOf: binding.asOf,
      switchedAt: "2026-08-15 20:01:00",
      t019: { recordId: binding.bindingId, evidenceId: "EV-T019-S001-001" },
      ...(includeFactPackage ? { authoritativeFactPackage: factPackage } : {}),
    },
  };
  const c017 = {
    projectionId: keys.c017,
    projectionVersion: "3",
    schemaVersion: 1,
    formedAt: "2026-08-15 20:01:00",
    sourceModule: "数据工程",
    contractCode: "C017",
    consumer: "报告中心",
    readStatus: "ready",
    scenarioContext: scenario,
    projections: [{
      scenarioContext: scenario,
      assetId: "T006-S001-FIN",
      dataVersion: binding.dataVersion,
      asOf: binding.asOf,
      allowConsumption: true,
      quality: { status: "通过", warnings: [] },
      freshness: { status: "当前", label: "当前" },
      currentStateSummary: {
        id: "C017-CURRENT-S001-001",
        version: "1.0",
        formedAt: "2026-08-15 20:01:00",
        qualityStatus: "通过",
        hardQualityFailure: false,
        detectedAt: "不适用",
        impactScope: "无",
        reason: "未发现硬质量失败",
        recovery: "无需恢复",
      },
      versionBindingSummary: { id: "C017-BIND-S001-001", version: "1.0", formedAt: "2026-08-15 20:01:00" },
      refresh: { t018EvidenceId: binding.consumableVersionId },
      fiveDimensions: [],
    }],
  };
  return { c008, c017, binding, factPackage };
}

function createOwners(entries = {}) {
  const storage = new MemoryStorage({
    [keys.scenario]: JSON.stringify({ scenarioContext: scenario }),
    [keys.handoff]: JSON.stringify({ scenarioContext: scenario }),
    ...entries,
  });
  const window = {
    location: { search: "" },
    structuredClone,
  };
  const context = vm.createContext({
    window,
    localStorage: storage,
    structuredClone,
    Intl,
    URLSearchParams,
    console,
  });
  vm.runInContext(ownersSource, context, { filename: "external-owners.js" });
  return { owners: window.RC_EXTERNAL_OWNERS, storage };
}

function buildAgentModel(binding, overrides = {}) {
  const requestId = "C024-S001-001";
  const reportNumber = "RPT-S001-001";
  const contentVersion = "1.0";
  const evidencePackId = "EP-S001-001";
  const evidencePackVersion = "1.0";
  const anchorSnapshotId = "SNAP-S001-001";
  const anchor = "metric-cost";
  const request = {
    id: requestId,
    scenarioContext: scenario,
    reportNumber,
    contentVersion,
    evidencePackageId: evidencePackId,
    evidencePackageVersion: evidencePackVersion,
    semanticVersionId: binding.semanticVersionId,
    semanticVersion: binding.semanticVersion,
    dataAssetVersionId: binding.dataAssetVersionId,
    dataVersion: binding.dataVersion,
    consumableVersionId: binding.consumableVersionId,
    dataAsOf: binding.asOf,
    anchorSnapshotId,
    anchorSnapshotVersion: contentVersion,
    anchor,
    c024: {
      reportContext: {
        scenarioContext: scenario,
        reportNumber,
        contentVersion,
        evidencePack: { id: evidencePackId, version: evidencePackVersion },
        semanticBinding: binding,
        anchorSnapshotId,
        anchorSnapshotVersion: contentVersion,
        selectedAnchor: anchor,
      },
    },
  };
  const run = {
    id: "RUN-S001-001",
    requestId,
    status: "complete",
    scenarioContext: scenario,
    snapshot: {
      reportNumber,
      contentVersion,
      evidencePackageId: evidencePackId,
      evidencePackageVersion: evidencePackVersion,
      semanticVersionId: binding.semanticVersionId,
      ontologyVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      consumableVersionId: binding.consumableVersionId,
      dataAsOf: binding.asOf,
      anchor,
      report: { anchorSnapshotId, anchorSnapshotVersion: contentVersion },
      agentId: "report-copilot",
      agentRelease: "3.1.0",
    },
    result: {
      id: "RES-S001-001",
      version: "1.0",
      scenarioContext: scenario,
      reportNumber,
      contentVersion,
      evidencePackageId: evidencePackId,
      evidencePackageVersion: evidencePackVersion,
      semanticVersionId: binding.semanticVersionId,
      semanticVersion: binding.semanticVersion,
      dataAssetVersionId: binding.dataAssetVersionId,
      dataVersion: binding.dataVersion,
      ...overrides.result,
    },
    ...overrides.run,
  };
  return { inboundRequests: [request], runs: [run], sessions: [], c024Rejections: [] };
}

{
  const { c008, c017 } = buildProjection({ includeFactPackage: false });
  const { owners } = createOwners({ [keys.c008]: JSON.stringify(c008), [keys.c017]: JSON.stringify(c017) });
  const projection = owners.trust.peekCurrent();
  assert.equal(projection.readStatus, "ready");
  assert.equal(projection.factPackageStatus, "missing");
  assert.equal(projection.factPackage, null);
}

{
  const { c008, c017, factPackage } = buildProjection();
  const { owners } = createOwners({ [keys.c008]: JSON.stringify(c008), [keys.c017]: JSON.stringify(c017) });
  const projection = owners.trust.peekCurrent();
  assert.equal(projection.factPackageStatus, "ready");
  assert.equal(projection.factPackage.packageId, factPackage.packageId);
}

{
  const { c008, c017 } = buildProjection({ factPackagePatch: { dataVersion: "FIN-ASSET-WRONG" } });
  const { owners } = createOwners({ [keys.c008]: JSON.stringify(c008), [keys.c017]: JSON.stringify(c017) });
  const projection = owners.trust.peekCurrent();
  assert.equal(projection.factPackageStatus, "invalid");
  assert.equal(projection.factPackage, null);
}

{
  const { c008, c017, binding } = buildProjection();
  const model = buildAgentModel(binding);
  const { owners } = createOwners({
    [keys.c008]: JSON.stringify(c008),
    [keys.c017]: JSON.stringify(c017),
    [keys.agent]: JSON.stringify(model),
  });
  assert.equal(owners.agent.getC025("C024-S001-001").status, "已完成");
}

{
  const { c008, c017, binding } = buildProjection();
  const model = buildAgentModel(binding, { result: { dataVersion: "FIN-ASSET-WRONG" } });
  const { owners } = createOwners({
    [keys.c008]: JSON.stringify(c008),
    [keys.c017]: JSON.stringify(c017),
    [keys.agent]: JSON.stringify(model),
  });
  assert.match(owners.agent.getC025("C024-S001-001").failure, /C025 Result/);
}

{
  const { c008, c017, binding } = buildProjection();
  const { owners, storage } = createOwners({ [keys.c008]: JSON.stringify(c008), [keys.c017]: JSON.stringify(c017) });
  const basePayload = {
    requestId: "C022-S001-001",
    reportContext: {
      scenarioContext: scenario,
      reportAggregateId: "AGG-S001-001",
      evidencePack: { id: "EP-S001-001", version: "1.0" },
      semanticBinding: binding,
    },
  };
  assert.equal(owners.agent.submitGeneration(basePayload).status, "等待 Agent 应用接收");
  const retry = owners.agent.submitGeneration({ ...basePayload, retryOfRunId: "RUN-OLD" });
  assert.equal(retry.status, "等待 Agent 应用接收");
  assert.equal(retry.retryOfRunId, "RUN-OLD");
  const inbox = JSON.parse(storage.getItem("ontology3.agent-application.c022-inbox.v1"));
  assert.equal(inbox.requests.length, 2);
  assert.equal(inbox.requests[0].archived, true);
  assert.equal(inbox.requests[1].retryOfRunId, "RUN-OLD");
  const fixedSnapshot = {
    scenarioContext: scenario,
    reportRequestId: basePayload.requestId,
    reportAggregateId: "AGG-S001-001",
    evidencePackageId: "EP-S001-001",
    evidencePackageVersion: "1.0",
    semanticVersionId: binding.semanticVersionId,
    ontologyVersion: binding.semanticVersion,
    dataAssetVersionId: binding.dataAssetVersionId,
    dataVersion: binding.dataVersion,
    consumableVersionId: binding.consumableVersionId,
    dataAsOf: binding.asOf,
  };
  storage.setItem(keys.agent, JSON.stringify({
    inboundRequests: [],
    runs: [
      { id: "RUN-OLD", requestId: basePayload.requestId, retryOf: null, status: "failed", snapshot: fixedSnapshot, error: "首次失败" },
      { id: "RUN-NEW", requestId: basePayload.requestId, retryOf: "RUN-OLD", status: "complete", snapshot: fixedSnapshot, result: { id: "RES-NEW", version: "1.0" } },
    ],
  }));
  const latest = owners.agent.getGeneration(basePayload.requestId);
  assert.equal(latest.status, "已完成");
  assert.equal(latest.runId, "RUN-NEW");
  assert.equal(latest.retryOfRunId, "RUN-OLD");
}

{
  const { c008, c017, binding } = buildProjection();
  const mismatchedScenario = { ...scenario, formedAt: "2026-08-15 20:00:01" };
  const model = buildAgentModel(binding, { run: { scenarioContext: mismatchedScenario } });
  const { owners } = createOwners({
    [keys.c008]: JSON.stringify(c008),
    [keys.c017]: JSON.stringify(c017),
    [keys.agent]: JSON.stringify(model),
  });
  assert.match(owners.agent.getC025("C024-S001-001").failure, /C025 Run/);
}

assert.doesNotMatch(appSource, /materializeS001FactPackage|runtimeFactPackages/);
assert.match(appSource, /if \(typeof value === "undefined"\) return undefined;/);
assert.match(appSource, /bindingId: factPackage\.bindingId \|\| factPackage\.authorityBindingId \|\| null/);
assert.match(appSource, /bindingId: reference\.bindingId \|\| reference\.authorityBindingId \|\| null/);
assert.match(appSource, /function factPackageIdentityMatches/);
assert.match(appSource, /\["semanticVersion", expected\.semanticVersion, candidate\.semanticVersion\]/);
assert.match(appSource, /\["asOf", expected\.asOf, candidate\.asOf\]/);
assert.match(appSource, /const candidates = \[staticCandidate, currentCandidate\]/);
assert.match(appSource, /item\?\.packageId && item\.packageId === candidate\.packageId/);
assert.match(appSource, /\[\.\.\.references\]\.reverse\(\)\.find/);
assert.match(appSource, /retryOfRunId: external\.retryOfRunId \|\| retryOf \|\| null/);
assert.match(appSource, /reference\.completedAt = reference\.completedAt \|\|/);
assert.match(appSource, /\["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"\]/);
assert.match(appSource, /anchorSnapshotVersion !== contentVersion/);
assert.match(appSource, /currentProjection: false, projectionStatus: "history"/);
const reportFactOverlaySource = appSource.slice(appSource.indexOf("function reportFactPackageFor"), appSource.indexOf("function factPackageForReport"));
assert.match(reportFactOverlaySource, /canonicalEvidence\.facts/);
assert.match(reportFactOverlaySource, /canonicalEvidence\.anchors/);
assert.match(reportFactOverlaySource, /canonicalEvidence\.contentItems/);
assert.match(reportFactOverlaySource, /FACT-DATA-QUALITY-STATUS/);
assert.match(reportFactOverlaySource, /FACT-DATA-FRESHNESS/);
assert.match(reportFactOverlaySource, /FACT-DATA-READINESS/);
assert.match(reportFactOverlaySource, /sourceItemByFact/);
assert.match(appSource, /const generatedById = new Map\(\(generatedContent\?\.contentFacts \|\| \[\]\)/);
assert.match(appSource, /reportFactPackageFor\(report, evidencePack\.authoritativeFactPackage\)/);
const factResolverSource = appSource.slice(appSource.indexOf("function factPackageForBinding"), appSource.indexOf("function currentFactPackage"));
assert.match(factResolverSource, /projection\.factPackageStatus !== "ready"/);
assert.doesNotMatch(factResolverSource, /DATA\.reportEvidence\.factPackages/);
assert.match(ownersSource, /generationAttemptKey/);
assert.match(ownersSource, /retryOfRunId: actual\.retryOfRunId \|\| expected\.retryOfRunId \|\| null/);
const generationSource = appSource.slice(appSource.indexOf("function beginGeneration"), appSource.indexOf("function completeEvidencePhase"));
assert.ok(generationSource.indexOf("readGenerationTrustGate") < generationSource.indexOf("report.requestId = requestId"), "generation gate must run before request identity is created");
const comparisonSource = appSource.slice(appSource.indexOf('if (action === "start-current-comparison")'), appSource.indexOf('if (action === "close-comparison")'));
assert.match(comparisonSource, /report\.comparisonRecords\.unshift\(clone\(comparison\)\)/);
assert.match(comparisonSource, /markPriorComparisonRecordsStale/);

console.log("M06 contract verification passed");
