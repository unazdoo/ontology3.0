import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const factsSource = fs.readFileSync(new URL("./authoritative-facts.js", import.meta.url), "utf8");
const appSource = fs.readFileSync(new URL("./app.js", import.meta.url), "utf8");
const indexSource = fs.readFileSync(new URL("./index.html", import.meta.url), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(factsSource, sandbox, { filename: "authoritative-facts.js" });

const scenarioContext = {
  scenarioId: "S001",
  scenarioVersion: "S001-v1",
  scenarioRunId: "S001-RUN-VALID-001",
  formedAt: "2026-08-15 09:00:00",
  status: "进行中"
};
const withScenario = (value) => ({ ...value, scenarioContext: { ...scenarioContext } });
const version = withScenario({
  id: "PUB-S001-FIN-002",
  semanticVersion: "V2",
  ontologyStableId: "ONT-GROUP-FINANCING-OPTIMIZATION",
  effectiveFrom: "2026-08-15 09:20:00",
  publishedAt: "2026-08-15 09:20:00",
  metrics: [
    "MET-FINANCING-BALANCE",
    "MET-WAVG-FINANCING-COST",
    "MET-FLOATING-RATE-BALANCE-RATIO",
    "MET-SHORT-TERM-DEBT-RATIO",
    "MET-FX-FINANCING-SHARE",
    "MET-HIGH-COST-BALANCE-RATIO",
    "MET-CREDIT-FINANCING-SHARE"
  ].map((id) => ({ id, name: id })),
  rules: [
    ["RULE-HIGH-FINANCING-COST", "融资成本偏高"],
    ["RULE-FLOATING-RATE-EXPOSURE", "浮动利率暴露"],
    ["RULE-SHORT-TERM-DEBT-CONCENTRATION", "短期债务集中"]
  ].map(([id, name]) => ({ id, name, businessBasis: "confirmed" })),
  actions: [{ id: "ACTION-FINANCING-OPTIMIZATION", name: "发起融资优化建议", businessBasis: "confirmed" }]
});
const binding = withScenario({
  semanticVersion: version.semanticVersion,
  dataVersion: "FIN-ASSET-20251231-v01",
  asOf: "2025-12-31",
  switchedAt: "2026-08-15 10:00:00",
  adoptionRecordId: "REC-T019-001",
  adoptionEvidenceLocator: "EVD-T019-001"
});
const t018 = withScenario({
  status: "eligible",
  semanticVersionId: version.id,
  semanticVersion: version.semanticVersion,
  dataVersion: binding.dataVersion,
  evidenceLocator: "EVD-T018-001",
  checkedAt: "2026-08-15 09:50:00"
});
const adoptionRecord = withScenario({
  id: binding.adoptionRecordId,
  evidenceCode: binding.adoptionEvidenceLocator,
  semanticVersion: version.semanticVersion,
  dataVersion: binding.dataVersion,
  createdAt: binding.switchedAt
});
const sourceContract = withScenario({
  sourceModule: "数据工程",
  contractCode: "C003",
  assetId: "FIN-ASSET",
  assetVersion: binding.dataVersion,
  asOf: binding.asOf,
  sourceSnapshotId: "T002-FIN-001",
  sourceReadEventId: "READ-FIN-001",
  sourceFingerprint: {
    algorithm: "SHA-256",
    value: "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d",
    sizeBytes: 807264
  },
  t008Confirmation: withScenario({
    snapshotId: "T002-FIN-001",
    sourceReadEventId: "READ-FIN-001",
    asOf: "2025-12-31",
    sizeBytes: 807264,
    evidenceId: "EVD-T008-001"
  }),
  members: ["FIN-MEMBER-SUBJECT", "FIN-MEMBER-DETAIL", "FIN-MEMBER-INSTITUTION", "FIN-MEMBER-OWNER"].map((id) => ({ id })),
  relations: ["FIN-REL-DETAIL-SUBJECT", "FIN-REL-DETAIL-INSTITUTION", "FIN-REL-SUBJECT-OWNER"].map((id) => ({ id }))
});

const build = sandbox.window.buildS001AuthoritativeFactPackage;
assert.equal(typeof build, "function");
const validInput = { scenarioContext, version, binding, adoptionRecord, t018, sourceContract };
const factPackage = build(validInput);
assert.ok(factPackage, "valid exact context should form a fact package");
assert.equal(factPackage.factPackageStatus, "available");
assert.equal(factPackage.authorityBindingId, adoptionRecord.id);
assert.equal(factPackage.semanticVersionId, version.id);
assert.equal(factPackage.dataVersion, binding.dataVersion);
assert.equal(factPackage.consumableVersionId, t018.evidenceLocator);
assert.equal(factPackage.asOf, "2025-12-31");
assert.equal(factPackage.sourceProof.sha256, sourceContract.sourceFingerprint.value);
assert.equal(factPackage.groupMetrics.balance, 21613.387);
assert.equal(factPackage.groupMetrics.cost, 2.3722312046695873);
assert.equal(factPackage.units["单位553"].rule.id, "RULE-HIGH-FINANCING-COST");
assert.equal(factPackage.units["单位465"].rule.id, "RULE-FLOATING-RATE-EXPOSURE");
assert.equal(factPackage.units["单位561"].rule.id, "RULE-SHORT-TERM-DEBT-CONCENTRATION");
assert.equal(factPackage.units["单位553"].institutions[0].name, "欧陆银行");
assert.equal(factPackage.contentFacts.length, 42);
assert.equal(factPackage.anchors.length, factPackage.contentFacts.length);
assert.equal(factPackage.contentItems.length, factPackage.contentFacts.length);
assert.equal(new Set(factPackage.contentFacts.map((fact) => fact.id)).size, factPackage.contentFacts.length, "fact ids must be unique");
assert.equal(new Set(factPackage.anchors.map((anchor) => anchor.id)).size, factPackage.anchors.length, "anchor ids must be unique");
assert.equal(new Set(factPackage.contentItems.map((item) => item.contentItemId)).size, factPackage.contentItems.length, "content item ids must be unique");
assert.ok(factPackage.contentFacts.some((fact) => fact.id === "FACT-R01-INSTITUTIONS"));
assert.ok(factPackage.contentFacts.some((fact) => fact.id === "FACT-R01-HIGH-COST-INSTITUTIONS"));
assert.ok(factPackage.contentItems.every((item) => item.bindingStatus === "bound" && item.factRefs.length && item.evidenceRefs.length));
assert.ok(factPackage.contentFacts.some((fact) => fact.semanticSnapshot?.resourceId === "MET-CREDIT-FINANCING-SHARE"));
assert.ok(factPackage.contentFacts.some((fact) => fact.semanticSnapshot?.resourceId === "RULE-SHORT-TERM-DEBT-CONCENTRATION"));
assert.doesNotMatch(JSON.stringify(factPackage), /RD-FIN|RT-FIN|2026\.08\.09|PUB-SEM-FIN-3\.8\.1|T007-FIN-20260809/);

const mutate = (path, value) => {
  const input = structuredClone(validInput);
  let cursor = input;
  for (const key of path.slice(0, -1)) cursor = cursor[key];
  cursor[path.at(-1)] = value;
  return input;
};
assert.equal(build(mutate(["sourceContract", "sourceFingerprint", "value"], "0".repeat(64))), null, "SHA mismatch must block");
assert.equal(build(mutate(["sourceContract", "t008Confirmation", "asOf"], "2025-11-30")), null, "T008 mismatch must block");
assert.equal(build(mutate(["sourceContract", "scenarioContext", "scenarioRunId"], "S001-RUN-WRONG")), null, "C033 mismatch must block");
assert.equal(build(mutate(["t018", "dataVersion"], "FIN-ASSET-WRONG")), null, "T018 mismatch must block");
assert.equal(build(mutate(["adoptionRecord", "evidenceCode"], "EVD-T019-WRONG")), null, "T019 mismatch must block");
assert.equal(build(mutate(["version", "metrics"], version.metrics.slice(0, 6))), null, "missing Metric must block");
assert.equal(build(mutate(["version", "rules", 0, "businessBasis"], "recommended")), null, "unconfirmed Rule basis must block");

assert.match(appSource, /authoritativeFactPackageFor\(version, binding, update, adoptionRecord\)/);
assert.match(appSource, /sourceFingerprint\.value === snapshot\.source\.sha256/);
assert.match(appSource, /authoritativeFactPackage: readStatus === "available"/);
assert.ok(indexSource.indexOf("authoritative-facts.js") < indexSource.indexOf("app.js"), "facts must load before app");

console.log(`M01 authoritative fact package verified: ${factPackage.contentFacts.length} facts, ${factPackage.anchors.length} anchors, ${factPackage.contentItems.length} content items.`);
