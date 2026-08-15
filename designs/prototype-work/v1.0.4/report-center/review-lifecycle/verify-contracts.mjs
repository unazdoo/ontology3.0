import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const ownersSource = fs.readFileSync(`${root}/external-owners.js`, "utf8");
const appSource = fs.readFileSync(`${root}/app.js`, "utf8");

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
assert.match(appSource, /\["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"\]/);
assert.match(appSource, /anchorSnapshotVersion !== contentVersion/);
assert.match(appSource, /currentProjection: false, projectionStatus: "history"/);
const factResolverSource = appSource.slice(appSource.indexOf("function factPackageForBinding"), appSource.indexOf("function currentFactPackage"));
assert.match(factResolverSource, /projection\.factPackageStatus !== "ready"/);
assert.doesNotMatch(factResolverSource, /DATA\.reportEvidence\.factPackages/);
const generationSource = appSource.slice(appSource.indexOf("function beginGeneration"), appSource.indexOf("function completeEvidencePhase"));
assert.ok(generationSource.indexOf("readGenerationTrustGate") < generationSource.indexOf("report.requestId = requestId"), "generation gate must run before request identity is created");
const comparisonSource = appSource.slice(appSource.indexOf('if (action === "start-current-comparison")'), appSource.indexOf('if (action === "close-comparison")'));
assert.match(comparisonSource, /report\.comparisonRecords\.unshift\(clone\(comparison\)\)/);
assert.match(comparisonSource, /markPriorComparisonRecordsStale/);

console.log("M06 contract verification passed");
