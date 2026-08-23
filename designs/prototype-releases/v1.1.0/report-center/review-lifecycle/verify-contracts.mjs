import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const ownersSource = fs.readFileSync(`${root}/external-owners.js`, "utf8");
const appSource = fs.readFileSync(`${root}/app.js`, "utf8");
const dataSource = fs.readFileSync(`${root}/data.js`, "utf8");
const canonicalSource = fs.readFileSync(`${root}/canonical-app.js`, "utf8");
const canonicalCssSource = fs.readFileSync(`${root}/canonical.css`, "utf8");
const indexSource = fs.readFileSync(`${root}/index.html`, "utf8");
const s003Source = fs.readFileSync(`${root}/s003-app.js`, "utf8");
const portfolioSource = fs.readFileSync(`${root}/portfolio-integration.js`, "utf8");
const canonicalDataSource = fs.readFileSync(`${root}/canonical-data.js`, "utf8");

const canonicalContext = vm.createContext({ window: {}, console });
vm.runInContext(portfolioSource, canonicalContext, { filename: "portfolio-integration.js" });
vm.runInContext(canonicalDataSource, canonicalContext, { filename: "canonical-data.js" });
const canonicalReports = canonicalContext.window.RC_CANONICAL_DATA.reports;
assert.equal(canonicalReports.length, 24, "统一报告目录必须包含 24 份正式报告");
for (const report of canonicalReports) {
  assert.ok(report.html && fs.existsSync(path.resolve(root, report.html)), `${report.reportNo} 的正式 HTML 必须存在`);
  assert.ok(report.pdf && fs.existsSync(path.resolve(root, report.pdf)), `${report.reportNo} 的正式 PDF 必须存在`);
}
const canonicalS001 = canonicalReports.find((report) => report.definitionId === "RD-FIN-001");
assert.equal(canonicalS001?.reportNo, "RPT-20260816-092626-010", "S001 正式报告号必须保持权威口径");
const canonicalEnt020 = canonicalReports.find((report) => report.scope === "环保测试公司4");
assert.equal(canonicalEnt020?.reportNo, "RISK-020-2025", "S003 ENT020 正式报告号必须保持短编号");
assert.equal(canonicalEnt020?.version, "1.7.0", "S003 ENT020 内容版本必须保持 1.7.0");
assert.equal(canonicalEnt020?.evidenceId, "企业风险证据包 · S003-ENT-020", "S003 ENT020 必须绑定精确企业证据包");

const headingTexts = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))]
  .map((match) => match[1].replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim())
  .filter(Boolean);
const representativeReports = {
  S001: canonicalReports.find((report) => report.definitionId === "RD-FIN-001"),
  S002: canonicalReports.find((report) => report.definitionId === "RD-BUDGET-001"),
  S003: canonicalReports.find((report) => report.definitionId === "RD-RISK-001"),
  S004: canonicalReports.find((report) => report.definitionId === "RDEF-S004-PREFLIGHT-002"),
};
const representativeHtml = Object.fromEntries(Object.entries(representativeReports).map(([scenarioId, report]) => [scenarioId, fs.readFileSync(path.resolve(root, report.html), "utf8")]));
assert.equal(headingTexts(representativeHtml.S001, "h2").length, 4, "S001 阅读目录必须服从正式正文的 4 个实际章节");
assert.equal(headingTexts(representativeHtml.S002, "h2").length, 1, "S002 正文必须保留专题总标题");
assert.equal(headingTexts(representativeHtml.S002, "h3").length, 6, "S002 阅读目录必须派生 6 个实际专题标题");
assert.equal(headingTexts(representativeHtml.S003, "h2").filter((title) => /^\d{1,2}\b/.test(title)).length, 9, "S003 阅读目录必须派生 9 个编号主章节");
assert.equal(headingTexts(representativeHtml.S004, "h2").length, 6, "S004 阅读目录必须派生 6 个实际章节");

const dataContext = vm.createContext({ window: {}, console });
vm.runInContext(dataSource, dataContext, { filename: "data.js" });
const reportEvidenceInventory = dataContext.window.RC_DATA.reportEvidence;
const s001Template = dataContext.window.RC_DATA.templates.find((item) => item.id === "RT-FIN-002");
assert.ok(s001Template, "S001 报告模板必须登记为 RT-FIN-002");
assert.equal(s001Template.templateFile, "templates/s001-financing-report-template.html", "S001 模板文件路径必须稳定");
assert.equal(s001Template.downloadName, "S001-集团融资成本与债务结构分析报告模板-v2.2.0.html", "S001 模板下载名称必须包含场景与版本");
assert.ok(fs.existsSync(`${root}/${s001Template.templateFile}`), "S001 可下载模板文件必须真实存在");
const s001TemplateHtml = fs.readFileSync(`${root}/${s001Template.templateFile}`, "utf8");
assert.match(s001TemplateHtml, /集团融资成本与债务结构分析报告/, "模板标题必须与正式报告一致");
for (const chapter of s001Template.chapters) assert.ok(s001TemplateHtml.includes(chapter), `模板缺少章节：${chapter}`);
assert.match(appSource, /download="\$\{esc\(template\.downloadName\)\}"/, "报告定义详情必须提供模板下载入口");
assert.match(appSource, /查看模板/, "报告定义或模板详情必须提供模板查看入口");
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
assert.equal(overlayPackage.contentFacts.length, 53, "单一受治理时点不得保留 7 条静态趋势事实");
assert.equal(overlayPackage.anchors.length, 70, "单一受治理时点不得保留静态趋势图和数据点锚点");
assert.equal(overlayPackage.contentItems.length, 78, "单一受治理时点不得保留静态趋势内容项");
assert.equal(overlayPackage.renderManifest.items.length, 78, "单一受治理时点的 renderManifest 必须排除静态趋势内容项");
assert.equal(overlayPackage.trend.length, 0, "没有上游受治理趋势时不得回退到报告中心静态趋势");
assert.match(String(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-JUDGMENT-COST-TREND")?.value || ""), /单一受治理时点.*暂无历史趋势/, "无真实趋势时必须形成诚实空状态判断");
assert.equal(overlayPackage.contentFacts.some((fact) => /^FACT-COST-TREND(?:-|$)/.test(fact.id)), false, "无真实趋势时不得保留静态趋势序列或数据点事实");
assert.equal(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-GROUP-COST").value, 2.35, "M01 事实值应覆盖报告静态值");
assert.equal(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-DATA-VERSION").value, overlayBinding.dataVersion, "数据版本应按报告绑定动态回填");
assert.equal(overlayPackage.contentFacts.find((fact) => fact.id === "FACT-DATA-QUALITY-STATUS").value, overlayTrust.publishedQuality, "C017 质量应按报告固定摘要动态回填");
const governedTrendOverlayPackage = overlayReportFactPackageFor(overlayReport, {
  ...overlaySourcePackage,
  trend: dataContext.window.RC_DATA.trend.slice(-6).map((item) => ({ ...item })),
});
assert.equal(governedTrendOverlayPackage.contentFacts.length, 60, "取得至少两个上游受治理时点后应恢复完整趋势事实库存");
assert.equal(governedTrendOverlayPackage.anchors.length, 77, "取得上游受治理趋势后应恢复完整趋势锚点库存");
assert.equal(governedTrendOverlayPackage.contentItems.length, 85, "取得上游受治理趋势后应恢复完整趋势内容项库存");
assert.equal(governedTrendOverlayPackage.trend.length, 6, "报告只能展示上游明确提供的受治理趋势点");
const unavailableOverlayPackage = overlayReportFactPackageFor(overlayReport, null);
assert.notEqual(unavailableOverlayPackage.factPackageStatus, "available", "缺少 C008 精确事实包时不得以报告静态库存冒充可消费事实包");

const contentSnapshotStart = appSource.indexOf("function createContentSnapshot");
const contentSnapshotEnd = appSource.indexOf("function snapshotContentFact", contentSnapshotStart);
assert.ok(contentSnapshotStart >= 0 && contentSnapshotEnd > contentSnapshotStart, "报告内容快照 helper 必须存在");
const contentSnapshotSource = appSource.slice(contentSnapshotStart, contentSnapshotEnd);
assert.doesNotMatch(contentSnapshotSource, /ruleId\.slice\(-3\)/, "建议依据不得再从 Rule ID 尾缀推导事实 ID");
assert.match(contentSnapshotSource, /\["R01", "R02", "R03"\]/, "建议依据必须显式锁定 R01、R02、R03 三条结果事实");
assert.match(contentSnapshotSource, /authoritativeFactById\.get\(`FACT-\$\{code\}-RESULT`\)/, "建议依据必须按 FACT-R01\/R02\/R03-RESULT 查找权威事实");

const createContentSnapshot = new Function(
  "factPackageForReport", "factPackageIsAvailable", "clone", "makeId", "nowText",
  `${contentSnapshotSource}\nreturn createContentSnapshot;`,
)(
  (report) => report.factPackage,
  (factPackage) => factPackage?.factPackageStatus === "available",
  (value) => (value == null ? value : JSON.parse(JSON.stringify(value))),
  (prefix) => `${prefix}-VERIFY-SUGGESTION-BASIS`,
  () => "2026-08-15 20:10:00",
);

const m01RuleResults = [
  {
    factId: "FACT-R01-RESULT",
    scope: "单位553",
    ruleId: "RULE-HIGH-FINANCING-COST",
    ruleVersion: "V2",
    evaluationRecordId: "RULE-EVAL-R01-UNIT-553-FIN-ASSET-20251231-V01",
    resultVersion: "RR-FIN-ASSET-20251231-V01-PUB-S001-FIN-002",
    direction: "核对高成本借据置换空间",
  },
  {
    factId: "FACT-R02-RESULT",
    scope: "单位465",
    ruleId: "RULE-FLOATING-RATE-EXPOSURE",
    ruleVersion: "V2",
    evaluationRecordId: "RULE-EVAL-R02-UNIT-465-FIN-ASSET-20251231-V01",
    resultVersion: "RR-FIN-ASSET-20251231-V01-PUB-S001-FIN-002",
    direction: "核对固定利率或利率上限条件",
  },
  {
    factId: "FACT-R03-RESULT",
    scope: "单位561",
    ruleId: "RULE-SHORT-TERM-DEBT-CONCENTRATION",
    ruleVersion: "V2",
    evaluationRecordId: "RULE-EVAL-R03-UNIT-561-FIN-ASSET-20251231-V01",
    resultVersion: "RR-FIN-ASSET-20251231-V01-PUB-S001-FIN-002",
    direction: "核对展期与中长期置换条件",
  },
];
const suggestionEvidence = [...m01RuleResults.map((item) => item.ruleId), "ACTION-FINANCING-OPTIMIZATION"];
const legacyGeneratedSuggestionBasis = m01RuleResults.map((item, index) => ({
  scope: item.scope,
  ruleId: `RULE-FIN-R0${index + 1}`,
  ruleVersion: "旧版本",
  evaluationRecordId: `OLD-EVAL-R0${index + 1}`,
  resultVersion: "OLD-RESULT",
  direction: item.direction,
}));
const authoritativeSuggestionFacts = [
  ...m01RuleResults.map((item) => ({
    id: item.factId,
    label: `${item.factId} 命中结论`,
    kind: "Rule 结论",
    value: "命中",
    unit: null,
    scope: item.scope,
    resultVersion: item.resultVersion,
    evidence: [item.ruleId, item.evaluationRecordId],
    ruleSnapshot: {
      ruleId: item.ruleId,
      ruleVersion: item.ruleVersion,
      evaluationRecordId: item.evaluationRecordId,
      evaluationTime: "2026-08-15 09:50:00",
      branch: "命中分支",
      metricId: `MET-${item.factId.slice(5, 8)}`,
      result: "命中",
    },
  })),
  {
    id: "FACT-SUGGESTION-BASIS",
    label: "融资优化建议依据",
    kind: "建议依据",
    value: "三家重点单位融资优化建议",
    unit: null,
    scope: "三家重点单位",
    resultVersion: "PUB-S001-FIN-002",
    evidence: suggestionEvidence,
    basis: m01RuleResults.map((item) => ({
      scope: item.scope,
      ruleId: item.ruleId,
      ruleVersion: item.ruleVersion,
      evaluationRecordId: item.evaluationRecordId,
      resultVersion: item.resultVersion,
      direction: item.direction,
    })),
  },
];
const suggestionFactPackage = {
  factPackageStatus: "available",
  packageId: "AFP-S001-SUGGESTION-VERIFY",
  packageVersion: "1.0",
  schemaVersion: "1.0",
  factInventoryVersion: "S001-FINANCE-FACTS-1.0",
  authorityBindingId: "T019-S001-VERIFY",
  bindingId: "T019-S001-VERIFY",
  semanticVersionId: "PUB-S001-FIN-002",
  semanticVersion: "V2",
  dataAssetVersionId: "FIN-ASSET-20251231-v01",
  dataVersion: "FIN-ASSET-20251231-v01",
  consumableVersionId: "EVD-T018-VERIFY",
  asOf: "2025-12-31",
  contentFacts: authoritativeSuggestionFacts,
  anchors: [],
  contentItems: [],
  renderManifest: { manifestId: "RM-S001-SUGGESTION-VERIFY", version: "1.0", items: [] },
  rules: m01RuleResults.map((item) => ({ id: item.ruleId, kind: "Rule", status: "Published" })),
  actionTypes: [{
    id: "ACTION-FINANCING-OPTIMIZATION",
    type: "Action Type",
    status: "Published",
    publishedSemanticVersion: "V2",
  }],
};
const suggestionSnapshot = createContentSnapshot(
  { factPackage: suggestionFactPackage, revisionNumber: 1 },
  {
    contentRevision: 1,
    contentFacts: [{
      sourceFactId: "FACT-SUGGESTION-BASIS",
      factId: "FACT-SUGGESTION-BASIS",
      value: "三家重点单位融资优化建议",
      scope: "三家重点单位",
      resultVersion: "PUB-S001-FIN-002",
      evidenceRefs: suggestionEvidence,
      // 模拟 Agent 返回旧静态 Rule ID；内容快照必须由 M01 Rule 结果快照纠正。
      basis: legacyGeneratedSuggestionBasis,
      bindingStatus: "bound",
    }],
  },
);
assert.ok(suggestionSnapshot, "可用权威事实包必须形成报告内容快照");
const snapshottedSuggestion = suggestionSnapshot.contentFacts.find((fact) => fact.factId === "FACT-SUGGESTION-BASIS");
assert.equal(snapshottedSuggestion.basis.length, 3, "建议依据必须固定三条 Rule 结果");
m01RuleResults.forEach((expected) => {
  const resultFact = suggestionSnapshot.authoritativeFacts.find((fact) => fact.id === expected.factId);
  assert.ok(resultFact, `${expected.factId} 必须存在于固定权威事实中`);
  assert.equal(resultFact.ruleSnapshot.ruleId, expected.ruleId, `${expected.factId} 必须匹配 M01 稳定 Rule ID`);
  const actual = snapshottedSuggestion.basis.find((item) => item.ruleId === expected.ruleId);
  assert.deepEqual(
    actual,
    {
      scope: expected.scope,
      ruleId: expected.ruleId,
      ruleVersion: expected.ruleVersion,
      evaluationRecordId: expected.evaluationRecordId,
      resultVersion: expected.resultVersion,
      direction: expected.direction,
    },
    `${expected.factId} 的主体、Rule 版本、评估记录、结果版本和方向必须全部来自固定 Rule 结果`,
  );
});

const ruleConsistencyStart = appSource.indexOf("function evaluateRuleConsistency");
const ruleConsistencyEnd = appSource.indexOf("function comparableRenderedValue", ruleConsistencyStart);
assert.ok(ruleConsistencyStart >= 0 && ruleConsistencyEnd > ruleConsistencyStart, "Rule 一致性核验 helper 必须存在");
const evaluateRuleConsistency = new Function(
  "DATA", "outcome", "snapshotBindingGap", "comparisonValueEqual",
  `${appSource.slice(ruleConsistencyStart, ruleConsistencyEnd)}\nreturn evaluateRuleConsistency;`,
)(
  { semanticResources: [], rules: [], actionTypes: [] },
  (status, code, message, impact, recovery, owner) => ({ status, code, message, impact, recovery, owner }),
  () => false,
  (left, right) => JSON.stringify(left) === JSON.stringify(right),
);
const suggestionVerification = evaluateRuleConsistency(
  { factId: "FACT-SUGGESTION-BASIS" },
  {
    semanticMissing: false,
    exactEvidenceAvailable: true,
    snapshot: suggestionSnapshot,
    facts: new Map(suggestionSnapshot.authoritativeFacts.map((fact) => [fact.id, fact])),
    contentFacts: new Map(suggestionSnapshot.contentFacts.map((fact) => [fact.factId, fact])),
    factPackage: suggestionFactPackage,
    evidencePack: { semanticResourceIds: suggestionEvidence },
    binding: { semanticVersion: "V2" },
  },
);
assert.equal(suggestionVerification.status, "pass", "三条建议依据逐项一致时 Rule 一致性核验必须通过");
assert.equal(suggestionVerification.code, "SUGGESTION_BASIS_MATCH", "建议依据通过必须返回稳定核验代码");

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

assert.match(canonicalSource, /getAgentRuntime\(\)/, "统一报告中心必须通过 M05 Owner 服务提交报告运行");
assert.match(canonicalSource, /waitForReceipt\(runtime, receipt\.requestId/, "生成与伴读必须轮询 M05 回执而不是静态直出");
assert.match(canonicalSource, /\["submitting", "running"\]\.includes\(wizard\.status\)/, "报告生成必须呈现提交和处理中状态");
assert.match(canonicalSource, /runtime\.retry\(wizard\.requestId\)/, "报告生成失败必须支持基于原请求重试");
assert.match(canonicalSource, /state\.reports\.unshift\(report\)/, "人工确认后必须把新正式版本加入统一报告目录");
assert.match(canonicalSource, /persistCreatedReports\(state\.reports\)/, "新正式版本必须由报告中心持久化");
assert.match(canonicalSource, /class="report-document-frame"/, "正式报告内容页必须直接呈现正式 HTML 正文");
assert.match(canonicalSource, /class="reader-workspace"/, "正式报告必须使用统一阅读工作台而不是简化详情卡片");
assert.match(canonicalSource, /function readerToc\(report\)/, "正式报告必须提供与报告定义一致的章节目录");
assert.match(canonicalSource, /function deriveReaderSectionNodes\(doc\)/, "阅读目录必须从正式 HTML DOM 派生");
assert.match(canonicalSource, /function syncReaderTocFromDocument\(frame, report\)/, "正文加载后必须同步实际可见章节");
assert.match(canonicalSource, /if \(!node\.id\) node\.id = anchor;/, "缺少原生 id 的正式标题必须获得稳定阅读锚点");
assert.match(canonicalSource, /doc\.getElementById\(targetId\)/, "目录点击必须按精确正文锚点定位");
const readerTocSource = canonicalSource.slice(canonicalSource.indexOf("function readerToc(report)"), canonicalSource.indexOf("function readerAssistantQa", canonicalSource.indexOf("function readerToc(report)")));
assert.doesNotMatch(readerTocSource, /report\.chapters|definitionById/, "阅读目录不得复制报告定义章节或显示无正文目标的项目");
assert.match(canonicalSource, /function readerAssistant\(report\)/, "正式报告必须在同一阅读页提供报告问答与自动核验");
assert.doesNotMatch(indexSource, /\["s003-app\.js"/, "统一报告入口不得按 S003 再加载第二套报告中心应用");
assert.match(canonicalSource, /function normalizeLegacyRoute\(\)/, "S003 历史报告深链必须归一到统一阅读器");
assert.match(canonicalSource, /function syncReportScenarioIdentity\(report\)/, "统一阅读器必须把报告自身场景三元身份同步到当前地址");
assert.match(canonicalSource, /syncReportScenarioIdentity\(report\);/, "报告详情打开时必须固定自身场景身份");
assert.match(canonicalSource, /return `#\/report\/\$\{encodeURIComponent\(report\.id\)\}`;/, "四场景报告详情必须使用同一阅读路由");
assert.match(canonicalSource, /<nav class="module-nav" aria-label="报告中心导航">/, "统一报告中心必须使用模块一致的上方横向导航栏");
assert.match(canonicalSource, /data-action="catalog-focus" data-focus="group"/, "报告目录必须提供跨场景通用的集团经营报告筛选");
assert.doesNotMatch(canonicalSource, /亮灯企业报告/, "债务风险专属亮灯术语不得成为通用报告目录标签");
assert.match(canonicalSource, /data-action="run-verification"/, "报告阅读器必须支持重新发起确定性核验");
assert.match(canonicalSource, /data-tab="evidence">.*?<strong>查看证据<\/strong>/s, "报告阅读器更多菜单必须统一使用查看证据术语");
assert.doesNotMatch(canonicalSource, /<strong>查看追溯<\/strong>/, "报告阅读器入口不得混用查看追溯术语");
assert.doesNotMatch(s003Source, />查看追溯</, "S003 报告阅读器入口不得混用查看追溯术语");
assert.match(s003Source, /data-section="s003-report-evidence">查看证据/, "S003 报告助手必须提供统一查看证据入口");
for (const phrase of ["一期处置边界", "一期不建设", "S003 一期报告", "原型记录路由"]) assert.equal(s003Source.includes(phrase), false, `S003 页面含评审态文案：${phrase}`);
assert.match(canonicalSource, /data-action="jump-report-chapter"/, "章节目录必须支持定位正文");
assert.doesNotMatch(canonicalSource, /data-tab="comparison"/, "正式报告阅读器不得再展示与自动核验重复的当前数据比较入口");
assert.match(canonicalSource, /data-tab="evidence"/, "正式报告必须提供证据追溯入口");
assert.match(canonicalSource, /function refreshAssistantOnly\(\)/, "报告问答状态更新必须局部刷新，避免重建正文 iframe 造成闪烁");
assert.match(canonicalSource, /function updateAssistantProgressOnly\(message\)/, "报告问答过程必须原位更新进度卡而不是反复重建助手栏");
assert.match(canonicalSource, /updateAssistantProgressOnly\(message\);/, "伴读运行回执必须驱动原位进度更新");
assert.match(canonicalSource, /function updateVerificationProgressOnly\(report\)/, "自动核验过程必须原位更新进度而不是反复重建助手栏");
assert.match(canonicalSource, /updateVerificationProgressOnly\(report\);/, "自动核验阶段切换必须驱动原位进度更新");
const readerAssistantQaSource = canonicalSource.slice(canonicalSource.indexOf("function readerAssistantQa(report)"), canonicalSource.indexOf("function verificationNumbers", canonicalSource.indexOf("function readerAssistantQa(report)")));
assert.doesNotMatch(readerAssistantQaSource, /run-verification|重新核验/, "报告问答页不得混入自动核验操作");
assert.match(readerAssistantQaSource, /class="question-rail"/, "推荐问题必须使用紧凑横向问题栏而不是占用独立宽列");
assert.match(readerAssistantQaSource, /class="question-chip"/, "推荐问题必须使用紧凑可操作问题标签");
assert.match(canonicalSource, /data-action="open-new-version"/, "正式报告必须通过确认弹窗发起新内容版本");
assert.match(canonicalSource, /function startQuickVersionGeneration\(report, isRetry = false\)/, "确认新版本信息后必须直接创建隔离生成运行");
assert.match(canonicalSource, /function verificationAgentFor\(report\)/, "自动核验必须显式读取独立核验 Agent 配置");
assert.match(canonicalSource, /function startReportVerification\(report\)/, "自动核验必须通过真实 Agent 运行进入抽取链");
assert.match(canonicalSource, /runtime\.submitVerification|kind: "report-verification"/, "报告中心必须提交独立报告核验 Agent 请求");
assert.match(canonicalSource, /Report Verification Extraction/, "报告中心必须校验核验 Agent 的抽取结果合同");
assert.match(canonicalSource, /determinationStatus !== "not-evaluated"/, "报告中心必须拒绝 Agent 越权给出正式判定");
assert.match(canonicalSource, /window\.OFW_REPORT_VERIFICATION_AGENT/, "自动核验必须允许接入平台核验 Agent 运行配置");
assert.match(canonicalSource, /Agent 抽取声明[\s\S]*证据定位与规则方法[\s\S]*确定性通过判据[\s\S]*逐项比对结果/, "每个核验分类必须展示 Agent 抽取、证据定位、确定性判据和逐项结果");
assert.match(canonicalSource, /核验 Agent 先抽取报告声明并定位证据[\s\S]*Agent 不直接给出正式通过结论/, "自动核验必须解释 Agent 抽取与确定性规则判定的责任边界");
assert.match(canonicalSource, /1 个 Agent 抽取批次[\s\S]*\$\{rules\.length\} 个规则组[\s\S]*\$\{total\} 个核验项/, "自动核验必须明确一个抽取批次、规则组和逐条核验项的层级");
assert.match(canonicalSource, /核验分类[\s\S]*通过核验项/, "自动核验摘要必须区分规则分类和逐条核验项");
assert.match(canonicalSource, /新增报告定义/, "报告定义页必须提供新增报告定义入口");
assert.match(canonicalCssSource, /overflow-y:\s*auto\s*!important/, "报告目录和创建页必须允许纵向滚动");
assert.match(canonicalCssSource, /\.report-document-frame\s*\{[^}]*height:\s*100%/s, "报告正文 iframe 必须填满阅读视口且不被固定高度截断");
assert.match(canonicalCssSource, /\.verification-item\s*\{[^}]*display:\s*block/s, "核验详情不得沿用旧三列网格把展开内容压成零宽度");
assert.doesNotMatch(canonicalCssSource, /\.verification-item\s*\{[^}]*grid-template-columns/s, "核验详情容器不得恢复旧三列网格");
assert.match(canonicalCssSource, /\.reader-assistant[^}]*overflow-wrap:\s*anywhere/s, "报告助手长标题、回答与证据标识必须允许安全断行");
assert.match(canonicalCssSource, /\.assistant-qa-content\s*\{[^}]*overflow:\s*hidden/s, "报告助手输入与操作区必须留在固定三栏边界内");
assert.match(canonicalCssSource, /--reader-assistant-width:\s*440px/, "报告助手桌面默认宽度必须为问答提供足够可读空间");
assert.match(canonicalCssSource, /\.question-rail\s*\{[^}]*overflow-x:\s*auto/s, "推荐问题必须横向浏览且不压缩问答内容");
assert.match(canonicalCssSource, /@media \(prefers-reduced-motion: reduce\)/, "报告问答与自动核验动效必须支持减少动态效果偏好");
assert.match(canonicalCssSource, /@media \(max-width: 1080px\)[\s\S]*?\.reader-workspace/, "统一壳 1440 宽屏必须保留章节、正文和报告助手三栏");
assert.match(canonicalCssSource, /@media \(max-width: 860px\)[\s\S]*?\.reader-page\s*\{[^}]*height:\s*auto/s, "移动端阅读页必须回到可纵向滚动布局");
assert.match(canonicalSource, /state\.wizard\.result\.sections/, "待复核草稿必须读取 M05 Result 正文而不是章节占位句");
assert.doesNotMatch(canonicalSource, /本章节内容已固定到内容版本/, "正式报告内容页不得继续显示章节占位句");

console.log("M06 contract verification passed");
