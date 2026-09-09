import { readFileSync, writeFileSync } from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const seed = JSON.parse(read("enterprise-seed.json"));
const portfolioPath = new URL("../modules/m07/resources/portfolio.json", import.meta.url);
const portfolio = JSON.parse(readFileSync(portfolioPath, "utf8"));
const dashboard = { window: {} };
vm.runInNewContext(read("../dashboard/data.js"), dashboard);
const companies = dashboard.window.DASHBOARD_DATA.dashboards.find((item) => item.id === "risk").companies;
const masterId = (id) => `ENT-${id.slice(-3)}`;
const fingerprint = (value) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const originalFinance = (mapping) => portfolio.objects.find((item) => item.id === `financing::${mapping.sourceId}`)
  || portfolio.objects.find((item) => item.enterpriseId === masterId(mapping.riskSourceId))?.sourceFacets?.S001;
const originalRisk = (company) => portfolio.objects.find((item) => item.id === `risk::${company.enterpriseId}`)
  || portfolio.objects.find((item) => item.enterpriseId === masterId(company.enterpriseId))?.sourceFacets?.S003;
const makeLocation = (city, coordinates, province = null) => ({ city, province, geometry: { type: "Point", coordinates }, classification: seed.classification, kind: seed.locationKind, coordinateSystem: seed.coordinateSystem, sourceRef: seed.version, authoritativeAddress: false });

const enterprises = companies.map((company) => {
  const id = masterId(company.enterpriseId);
  const mapping = seed.financingMappings.find((item) => item.riskSourceId === company.enterpriseId);
  const finance = mapping ? originalFinance(mapping) : null;
  if (mapping && !finance) throw new Error(`Missing financing source ${mapping.sourceId}`);
  const risk = originalRisk(company) || {
    id: `risk::${company.enterpriseId}`, title: company.enterpriseName, scenarioId: "S003",
    objectTypeId: "m01.object-type.enterprise", quality: "passed",
    canonicalObjectRef: { id: company.enterpriseId, title: company.enterpriseName, objectTypeRef: "Enterprise", scenarioId: "S003", dataVersionId: "S003-T007-FORMAL-CANDIDATE-20251231-v1", ontologyVersionId: "SEM-S003-DEBT-RISK-v1", bindingId: "MB-S003-DEBT-RISK-v1" },
    sourceRefs: [`S003-C035-RISK-RESULTS-20251231-v2#${company.enterpriseId}`],
    properties: { industry: { value: company.category, quality: "passed" }, riskScore: { value: company.finalScore, unit: "score_0_100", quality: "passed" }, riskTier: { value: company.riskTier, quality: "passed" }, reportRef: { value: company.reportId, quality: "passed" } }
  };
  const [, province, city, longitude, latitude] = seed.locations.find((row) => row[0] === company.enterpriseId) || [];
  if (!city) throw new Error(`Missing location ${company.enterpriseId}`);
  const aliases = [company.enterpriseId, risk.id, ...(mapping ? [mapping.sourceId, finance.id, mapping.unitName, mapping.modelSubjectId, mapping.actionSubjectId] : [])];
  return {
    id, name: company.enterpriseName, aliases, aliasNames: [company.enterpriseName, ...(mapping ? [mapping.unitName] : [])],
    roles: ["DEBT_RISK_SUBJECT", ...(finance ? ["FINANCING_SUBJECT"] : [])],
    classification: seed.classification, identityBasis: seed.identityBasis,
    location: makeLocation(city, [longitude, latitude], province),
    sourceFacets: { S003: risk, ...(finance ? { S001: finance } : {}) }
  };
});
const aliases = new Map();
for (const enterprise of enterprises) for (const alias of [enterprise.id, ...enterprise.aliases]) {
  if (aliases.has(alias) && aliases.get(alias) !== enterprise.id) throw new Error(`Ambiguous enterprise alias ${alias}`);
  aliases.set(alias, enterprise.id);
}
const canonical = (id) => aliases.get(id) || id;
const enterpriseObjects = enterprises.map((enterprise) => {
  const { S003: risk, S001: financing } = enterprise.sourceFacets;
  const facetProperties = (facet) => Object.fromEntries(Object.entries(facet?.properties || {}).map(([key, property]) => [key, { ...property, sourceScenarioId: facet.scenarioId, dataVersionId: facet.canonicalObjectRef.dataVersionId, ontologyVersionId: facet.canonicalObjectRef.ontologyVersionId, sourceRefs: property.sourceRefs || facet.sourceRefs || [] }]));
  const properties = { ...facetProperties(financing), ...facetProperties(risk) };
  const defaultRef = financing?.canonicalObjectRef || risk.canonicalObjectRef;
  return {
    id: enterprise.id, enterpriseId: enterprise.id, objectTypeId: "m01.object-type.enterprise", title: enterprise.name,
    subtitle: `${enterprise.location.province} · ${enterprise.location.city} · ${financing ? "融资与债务风险" : "债务风险"} · 演示主体`,
    scenarioId: defaultRef.scenarioId, scenarioIds: Object.keys(enterprise.sourceFacets),
    aliases: enterprise.aliases, aliasNames: enterprise.aliasNames, roles: enterprise.roles,
    classification: enterprise.classification, identityBasis: enterprise.identityBasis, location: enterprise.location,
    sourceFacets: enterprise.sourceFacets, quality: risk.quality || "passed",
    canonicalObjectRef: { ...defaultRef, id: enterprise.id, title: enterprise.name, objectTypeRef: "Enterprise", enterpriseId: enterprise.id, sourceObjectId: defaultRef.id, identityVersionId: seed.version },
    sourceRefs: [...new Set([...(risk.sourceRefs || []), ...(financing?.sourceRefs || []), seed.version])],
    properties: {
      ...properties,
      enterpriseId: { value: enterprise.id, quality: "passed", sourceRefs: [seed.version] },
      sourceUnitName: { value: financing?.title || null, state: financing ? "observed" : "not_provided", sourceRefs: [seed.version] },
      financingCoverage: { value: financing ? "已关联融资明细" : "暂未提供融资数据", sourceRefs: [seed.version] },
      geometry: { value: enterprise.location.geometry, quality: "passed", state: "synthetic", note: "用户授权的城市级演示布点，不代表注册地址或经营地址。", sourceRefs: [seed.version] },
      mapLocation: { value: `${enterprise.location.province} · ${enterprise.location.city}`, sourceRefs: [seed.version] },
      identityBasis: { value: "演示身份统一，非工商主体核验", sourceRefs: [seed.version] }
    },
    stableKeyFingerprint: fingerprint({ id: enterprise.id, aliases: enterprise.aliases })
  };
});

const excluded = new Set(enterprises.flatMap((item) => [item.id, ...Object.values(item.sourceFacets).map((facet) => facet.id)]));
portfolio.objects = [...portfolio.objects.filter((item) => !excluded.has(item.id)), ...enterpriseObjects];
for (const [sourceId, city, longitude, latitude] of seed.bankLocations) {
  const bank = portfolio.objects.find((item) => item.canonicalObjectRef?.id === sourceId);
  if (!bank) throw new Error(`Missing bank ${sourceId}`);
  bank.location = makeLocation(city, [longitude, latitude]);
  bank.properties.geometry = { value: bank.location.geometry, quality: "passed", state: "synthetic", note: "银行演示布点，非实际总部或分支机构地址。", sourceRefs: [seed.version] };
  bank.properties.mapLocation = { value: city, sourceRefs: [seed.version] };
}
// Rewrite active object references, retaining versioned source evidence and original facets.
for (const link of portfolio.links) {
  if (canonical(link.from) !== link.from || canonical(link.to) !== link.to) link.sourceEndpoints ||= { from: link.from, to: link.to };
  link.from = canonical(link.from); link.to = canonical(link.to);
  if (link.linkRef) link.linkRef = { ...link.linkRef, from: canonical(link.linkRef.from), to: canonical(link.linkRef.to) };
}
for (const enterprise of enterprises) {
  if (!portfolio.links.some((link) => link.from === "risk::S003-ASSESSMENT-20251231" && link.to === enterprise.id)) portfolio.links.push({ id: `assessment:${enterprise.id}`, from: "risk::S003-ASSESSMENT-20251231", to: enterprise.id, label: "纳入评估", linkTypeId: "m07.link-type.assessment-has-enterprise", quality: "passed", sourceRefs: enterprise.sourceFacets.S003.sourceRefs });
}
for (const series of portfolio.series) {
  series.sourceOwnerObjectId ||= series.ownerObjectId;
  series.ownerObjectId = canonical(series.ownerObjectId);
  if (series.timeSeriesRef) series.timeSeriesRef = { ...series.timeSeriesRef, ownerObjectId: canonical(series.timeSeriesRef.ownerObjectId) };
}
for (const event of portfolio.events) {
  if (event.objectId) { event.sourceObjectId ||= event.objectId; event.objectId = canonical(event.objectId); }
  if (event.ownerObjectId) event.ownerObjectId = canonical(event.ownerObjectId);
}
for (const object of portfolio.objects.filter((item) => !item.enterpriseId)) for (const property of Object.values(object.properties || {})) {
  if (typeof property.value === "string" && aliases.has(property.value)) { property.sourceValue ||= property.value; property.value = canonical(property.value); }
}
portfolio.identityVersionId = seed.version;
portfolio.identityPolicy = { classification: seed.classification, enterpriseCount: enterprises.length, financingLinkedCount: seed.financingMappings.length, authoritativeLegalEntityMatch: false, geoCoordinatesAuthoritative: false, preservedHistoricalArtifacts: true };
const summary = { schemaVersion: "ofw.enterprise-master.v1", version: seed.version, classification: seed.classification, identityBasis: seed.identityBasis, enterprises: enterprises.map(({ sourceFacets, ...item }) => ({ ...item, sourceBindings: Object.fromEntries(Object.entries(sourceFacets).map(([scenario, facet]) => [scenario, { ...facet.canonicalObjectRef, objectId: facet.id, title: facet.title }])) })) };
writeFileSync(new URL("enterprise-master.json", import.meta.url), JSON.stringify(summary, null, 2) + "\n");
writeFileSync(new URL("enterprise-master.js", import.meta.url), `// Generated by build-enterprise-master.mjs; edit enterprise-seed.json and rebuild.\n(function(global){"use strict"; const data=${JSON.stringify(summary)}; const byId=new Map(data.enterprises.map(item=>[item.id,item])); const aliases=new Map(); for(const item of data.enterprises) for(const id of [item.id,...item.aliases]) aliases.set(id,item.id); global.OFW_ENTERPRISE_MASTER=Object.freeze({version:data.version,enterprises:data.enterprises,canonicalId:(id)=>aliases.get(id)||id,resolve:(id)=>byId.get(aliases.get(id)||id)||null});})(typeof window==="undefined"?globalThis:window);\n`);
writeFileSync(portfolioPath, JSON.stringify(portfolio, null, 2) + "\n");
console.log(JSON.stringify({ enterprises: enterprises.length, financingLinked: seed.financingMappings.length, objects: portfolio.objects.length, links: portfolio.links.length, located: portfolio.objects.filter((item) => item.properties?.geometry?.value).length }));
