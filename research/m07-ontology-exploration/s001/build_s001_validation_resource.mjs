#!/usr/bin/env node
/*
 * Build the M07 S001 financing validation resource from the read-only v1.1.0
 * S001 source package.  This adapter deliberately materialises only the
 * small, reviewable object projection needed by M07; it never copies the
 * source runtime or writes back to the source worktree.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
// Keep the adapter isolated to this research worktree by default. A caller can
// still point at another read-only source explicitly for comparison runs.
const DEFAULT_SOURCE_ROOT = path.join(REPO_ROOT, "designs/prototype-releases/v1.1.0");
const SOURCE_ROOT = path.resolve(process.env.M07_S001_SOURCE_ROOT || DEFAULT_SOURCE_ROOT);
const SOURCE_ID = process.env.M07_S001_SOURCE_ID || "prototype-v1.1.0-frozen:S001";
const OUTPUT_PATH = path.join(REPO_ROOT, "designs/m07-ontology-exploration-research/resources/s001/s001-financing-validation.json");

const SOURCE_FILES = {
  data: "s001-e2e-integration/data.js",
  scenarioReadme: "s001-e2e-integration/README.md",
  registry: "composite-resource-registry.js",
  ontologySeed: "ontology-management-review/canvas-first/portfolio-s001-seed.js",
  integrationNotes: "s001-e2e-integration/联调结果.md",
  version: "VERSION.json",
};

function read(file) {
  return fs.readFileSync(path.join(SOURCE_ROOT, file), "utf8");
}

function loadWindowExport(file, key) {
  const context = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(read(file), context, { filename: file, timeout: 5000 });
  if (!context.window[key]) throw new Error(`Missing ${key} in ${file}`);
  return context.window[key];
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileDigest(relativePath) {
  const absolutePath = path.join(SOURCE_ROOT, relativePath);
  const content = fs.readFileSync(absolutePath);
  const stat = fs.statSync(absolutePath);
  return {
    path: relativePath,
    sha256: sha256(content),
    bytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function numberFrom(value) {
  const match = String(value ?? "").replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function fingerprint(value) {
  return `sha256:${sha256(JSON.stringify(value)).slice(0, 16)}`;
}

function property(value, options = {}) {
  const result = { value };
  if (options.unit) result.unit = options.unit;
  if (options.state) result.state = options.state;
  result.quality = options.quality || "passed";
  if (options.sourceRefs?.length) result.sourceRefs = [...options.sourceRefs];
  if (options.note) result.note = options.note;
  return result;
}

function sourceRefs(...refs) {
  return refs.filter(Boolean);
}

function contextFrom(seed, scenario, registryScene) {
  const seedContext = seed.drafts?.[0]?.scenarioContext || {};
  return {
    scenarioId: scenario.id,
    scenarioVersion: scenario.scenarioVersion,
    scenarioRunId: registryScene.scenarioRunId || seedContext.scenarioRunId,
    scenarioName: registryScene.name || seedContext.scenarioName || scenario.name,
    formedAt: seedContext.formedAt || null,
    status: seedContext.status || "active",
  };
}

function ref(id, objectTypeId, context) {
  return {
    id,
    objectTypeId,
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    scenarioRunId: context.scenarioRunId,
  };
}

function makeObject({ id, objectTypeId, title, subtitle, context, properties, quality = "passed", qualityNotes = [], permissions, sourceObjectId, technicalFixture = false, sourceRefs: refs = [] }) {
  const object = {
    id,
    objectTypeId,
    title,
    subtitle,
    scenarioId: context.scenarioId,
    scenarioVersion: context.scenarioVersion,
    sourceObjectId: sourceObjectId || null,
    sourceRefs: refs,
    properties,
    quality,
    qualityNotes,
    permissions,
    technicalFixture,
    objectRef: ref(id, objectTypeId, context),
  };
  object.stableKeyFingerprint = fingerprint({ namespace: "ofw.m07.research.v1", scenario: context.scenarioId, id });
  return object;
}

function makeLink({ id, linkTypeId, from, to, label, quality = "passed", permissions, sourceRefs: refs = [], relationshipBasis = "published-link", failureCode = null, notes = null }) {
  const link = {
    id,
    linkTypeId,
    from,
    to,
    label,
    quality,
    permissions,
    sourceRefs: refs,
    relationshipBasis,
    sourceLinkId: null,
  };
  if (failureCode) link.failureCode = failureCode;
  if (notes) link.notes = notes;
  link.linkRef = { id, linkTypeId, from, to };
  return link;
}

function makeSeries({ id, ownerObjectId, propertyId, label, unit, value, context, sourceRefs: refs = [], note }) {
  const point = {
    t: context.dataAsOf,
    v: value,
    state: value == null ? "missing" : "observed",
    quality: value == null ? "unknown" : "passed",
    snapshotRef: "s001.snapshot:2025-12-31",
    sourceRefs: refs,
  };
  return {
    id,
    ownerObjectId,
    propertyId,
    label,
    unit,
    valueType: "number",
    granularity: "P1D-single-snapshot",
    calendar: "snapshot-business-date",
    timezone: "Asia/Shanghai",
    aggregationSemantics: "snapshot",
    missingSemantics: ["not_observed", "missing", "redacted", "quality_blocked", "not_applicable"],
    researchThreshold: null,
    sourceGrain: "single governed as-of date",
    versionRef: "FIN-ASSET-20251231-v02",
    points: [point],
    note,
    timeSeriesRef: {
      id,
      ownerObjectId,
      propertyId,
      granularity: "P1D-single-snapshot",
      asOf: context.dataAsOf,
      dataVersion: "FIN-ASSET-20251231-v02",
    },
  };
}

function buildResource({ data, registry, seed, version, sourceDigests, scenarioReadme, integrationNotes }) {
  const scenario = data.scenario;
  const registryScene = registry.scenes.find((item) => item.scenarioId === "S001");
  if (!registryScene) throw new Error("S001 is missing from the composite registry");
  const context = contextFrom(seed, scenario, registryScene);
  context.dataAsOf = registryScene.dataAsOf || scenario.dataAsOf;

  const sourceRefsCommon = sourceRefs("source:s001-data-js", "source:s001-registry", "source:s001-m01-seed");
  const allRoles = ["m07.analyst", "m07.auditor", "m07.restricted"];
  const reviewerRoles = ["m07.analyst", "m07.auditor"];
  const restrictedCoreRoles = ["m07.analyst", "m07.auditor", "m07.restricted"];
  const seedDraft = seed.drafts?.[0] || {};
  const seedObjects = Object.fromEntries((seedDraft.objects || []).map((item) => [item.id, item]));
  const seedMetrics = Object.fromEntries((seedDraft.metrics || []).map((item) => [item.id, item]));
  const seedRules = Object.fromEntries((seedDraft.rules || []).map((item) => [item.id, item]));
  const entities = data.entities || [];
  const groupMetrics = Object.fromEntries((data.groupMetrics || []).map((item) => [item.label, { value: numberFrom(item.value), unit: item.unit }]));

  const sourceObjectDefinitions = Object.values(seedObjects).map((item) => ({
    id: item.id,
    name: item.name,
    memberId: item.memberId,
    count: item.count,
    identity: item.identity,
    title: item.title,
  }));

  const objects = [];
  const links = [];
  const series = [];
  const events = [];

  const groupId = "s001.group";
  objects.push(makeObject({
    id: groupId,
    objectTypeId: "m01.object-type.financing-group",
    title: "集团融资板块",
    subtitle: "S001 · 集团融资成本与债务结构优化",
    context,
    sourceObjectId: null,
    permissions: allRoles,
    sourceRefs: sourceRefs(...sourceRefsCommon, "source:s001-readme", "source:s001-integration-notes"),
    properties: {
      scenario: property("S001", { sourceRefs: sourceRefsCommon }),
      dataAsOf: property(context.dataAsOf, { sourceRefs: ["source:s001-registry"] }),
      dataVersion: property(scenario.dataVersion, { sourceRefs: ["source:s001-data-js", "source:s001-registry"] }),
      ontologyVersion: property(scenario.ontologyVersion, { sourceRefs: ["source:s001-data-js"] }),
      sourceRows: property(scenario.sourceRows, { unit: "rows", sourceRefs: ["source:s001-data-js"] }),
      entityCount: property(entities.length, { unit: "entities", sourceRefs: ["source:s001-data-js"] }),
      financingBalance: property(groupMetrics["融资余额"]?.value, { unit: "亿元", sourceRefs: ["source:s001-data-js"] }),
      weightedAverageCost: property(groupMetrics["加权平均融资成本"]?.value, { unit: "%", sourceRefs: ["source:s001-data-js"] }),
      floatingRateRatio: property(groupMetrics["浮动利率余额占比"]?.value, { unit: "%", sourceRefs: ["source:s001-data-js"] }),
      shortTermDebtRatio: property(groupMetrics["短期债务余额占比"]?.value, { unit: "%", sourceRefs: ["source:s001-data-js"] }),
      geometry: property(null, { state: "not_applicable", note: "S001 融资资源没有权威空间字段；不生成伪位置。" }),
    },
    qualityNotes: ["单一受治理截至时点；M07 不据此推断趋势。"],
  }));

  const institutionObjects = new Map();
  const ownerObjects = new Map();
  const entityBySourceId = new Map();
  const loanBySourceId = new Map();

  for (const entity of entities) {
    const entityId = `s001.entity.${entity.id}`;
    const loanId = `s001.loanbook.${entity.id}`;
    const ruleCode = entity.id === "553" ? "R01" : entity.id === "465" ? "R02" : "R03";
    const ruleId = entity.id === "553" ? "RULE-HIGH-FINANCING-COST" : entity.id === "465" ? "RULE-FLOATING-RATE-EXPOSURE" : "RULE-SHORT-TERM-DEBT-CONCENTRATION";
    const ruleDefinition = seedRules[ruleId] || {};
    const ownerId = `s001.owner.${entity.owner.replace(/[^0-9]/g, "") || "unknown"}`;
    entityBySourceId.set(entity.id, entityId);
    loanBySourceId.set(entity.id, loanId);

    if (!ownerObjects.has(ownerId)) {
      objects.push(makeObject({
        id: ownerId,
        objectTypeId: "m01.object-type.financing-owner",
        title: entity.owner,
        subtitle: "融资优化行动承接负责人（脱敏显示）",
        context,
        sourceObjectId: "OBJ-FINANCING-OWNER",
        permissions: reviewerRoles,
        sourceRefs: sourceRefs("source:s001-data-js", "source:s001-m01-seed"),
        properties: {
          ownerRef: property(ownerId, { sourceRefs: ["source:s001-m01-seed"] }),
          displayName: property(entity.owner, { sourceRefs: ["source:s001-data-js"] }),
          geometry: property(null, { state: "not_applicable" }),
        },
      }));
      ownerObjects.set(ownerId, true);
    }

    const entityObject = makeObject({
      id: entityId,
      objectTypeId: "m01.object-type.financing-entity",
      title: entity.name,
      subtitle: `融资主体 · ${entity.loans} · 截至 ${context.dataAsOf}`,
      context,
      sourceObjectId: "OBJ-FINANCING-ENTITY",
      permissions: restrictedCoreRoles,
      sourceRefs: sourceRefs("source:s001-data-js", "source:s001-m01-seed", "source:s001-registry"),
      properties: {
        sourceObjectId: property("OBJ-FINANCING-ENTITY", { sourceRefs: ["source:s001-m01-seed"] }),
        unitRef: property(entityId, { sourceRefs: ["source:s001-data-js"] }),
        sourceCode: property(null, { state: "redacted", note: "M07 不读取原始单位编码；使用脱敏 ObjectRef。" }),
        balance: property(numberFrom(entity.balance), { unit: "亿元", sourceRefs: ["source:s001-data-js"] }),
        averageFinancingCost: property(numberFrom(entity.cost), { unit: "%", sourceRefs: ["source:s001-data-js"] }),
        loanCount: property(numberFrom(entity.loans), { unit: "笔", sourceRefs: ["source:s001-data-js"] }),
        ruleCode: property(ruleCode, { sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"] }),
        ruleName: property(entity.rule, { sourceRefs: ["source:s001-data-js"] }),
        ruleMetricLabel: property(entity.ruleMetricLabel, { sourceRefs: ["source:s001-data-js"] }),
        ruleMetricValue: property(numberFrom(entity.ruleMetricValue), { unit: "%", sourceRefs: ["source:s001-data-js"] }),
        ownerRef: property(ownerId, { sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"] }),
        dataAsOf: property(context.dataAsOf, { sourceRefs: ["source:s001-registry"] }),
        geometry: property(null, { state: "not_applicable", note: "无权威 geometry；空间 Lens 应显示不适用。" }),
      },
      qualityNotes: ["对象身份来自 Published 融资主体定义；原始单位编码在 M07 验证资源中拒绝显示。"],
    });
    objects.push(entityObject);

    objects.push(makeObject({
      id: loanId,
      objectTypeId: "m01.object-type.financing-detail",
      title: `${entity.name} · 融资明细集合`,
      subtitle: `${entity.loans} · 聚合投影，不展开单笔借据`,
      context,
      sourceObjectId: "OBJ-FINANCING-DETAIL",
      permissions: restrictedCoreRoles,
      sourceRefs: sourceRefs("source:s001-data-js", "source:s001-m01-seed"),
      properties: {
        sourceObjectId: property("OBJ-FINANCING-DETAIL", { sourceRefs: ["source:s001-m01-seed"] }),
        grain: property("聚合融资明细（单笔借据未物化）", { sourceRefs: ["source:s001-m01-seed"] }),
        recordCount: property(numberFrom(entity.loans), { unit: "笔", sourceRefs: ["source:s001-data-js"] }),
        dataAsOf: property(context.dataAsOf, { sourceRefs: ["source:s001-registry"] }),
        currency: property("CNY 等值（源口径）", { sourceRefs: ["source:s001-m01-seed"] }),
        rateType: property(null, { state: "not_provided", quality: "warning", note: "data.js 仅提供主体聚合结果，不提供该主体各借据利率形式。" }),
        termType: property(null, { state: "not_provided", quality: "warning", note: "data.js 仅提供主体聚合结果，不提供该主体各借据期限种类。" }),
        geometry: property(null, { state: "not_applicable" }),
      },
      qualityNotes: ["仅保留来源已证明的笔数与主体归属；不能将聚合对象解释为单笔贷款事实。"],
    }));

    links.push(makeLink({
      id: `link:${groupId}:contains:${entityId}`,
      linkTypeId: "m07.link-type.group-has-entity",
      from: groupId,
      to: entityId,
      label: "包含融资主体",
      permissions: restrictedCoreRoles,
      sourceRefs: ["source:s001-data-js", "source:s001-registry"],
    }));
    links.push(makeLink({
      id: `link:${entityId}:has:${loanId}`,
      linkTypeId: "m01.link-type.entity-has-financing-detail",
      from: entityId,
      to: loanId,
      label: "拥有融资明细",
      permissions: restrictedCoreRoles,
      sourceRefs: ["source:s001-m01-seed"],
    }));
    links.push(makeLink({
      id: `link:${entityId}:owner:${ownerId}`,
      linkTypeId: "m01.link-type.entity-owned-by-owner",
      from: entityId,
      to: ownerId,
      label: "由负责人承接",
      permissions: reviewerRoles,
      sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"],
      notes: "受限观察员不返回负责人节点或关系。",
    }));

    const ruleObjectId = `s001.rule.${ruleCode.toLowerCase()}.${entity.id}`;
    const evidenceObjectId = `s001.evidence.${ruleCode.toLowerCase()}.${entity.id}`;
    const observed = numberFrom(entity.ruleMetricValue);
    const threshold = ruleCode === "R01" ? 2.75 : ruleCode === "R02" ? 80 : 30;
    objects.push(makeObject({
      id: ruleObjectId,
      objectTypeId: "m01.object-type.financing-rule-result",
      title: `${ruleCode} · ${entity.rule}`,
      subtitle: `${entity.name} · 已发布规则求值结果`,
      context,
      sourceObjectId: ruleId,
      permissions: reviewerRoles,
      sourceRefs: sourceRefs("source:s001-data-js", "source:s001-m01-seed", "source:s001-integration-notes"),
      properties: {
        ruleId: property(ruleId, { sourceRefs: ["source:s001-m01-seed"] }),
        ruleCode: property(ruleCode, { sourceRefs: ["source:s001-m01-seed"] }),
        status: property("命中", { sourceRefs: ["source:s001-data-js", "source:s001-integration-notes"] }),
        metricLabel: property(entity.ruleMetricLabel, { sourceRefs: ["source:s001-data-js"] }),
        observedValue: property(observed, { unit: "%", sourceRefs: ["source:s001-data-js"] }),
        threshold: property(threshold, { unit: "%", quality: "warning", sourceRefs: ["source:s001-m01-seed"], note: "阈值属于 Published 规则定义，M07 不重算。" }),
        condition: property(ruleDefinition.condition || "Published 规则条件", { sourceRefs: ["source:s001-m01-seed"] }),
        evaluatedAt: property(context.dataAsOf, { sourceRefs: ["source:s001-data-js"] }),
        geometry: property(null, { state: "not_applicable" }),
      },
      qualityNotes: ["只读投影已发布规则求值结果；不在 M07 维护 Rule 定义、阈值或 Action 状态。"],
    }));
    objects.push(makeObject({
      id: evidenceObjectId,
      objectTypeId: "m07.object-type.report-evidence",
      title: `${entity.name} · ${ruleCode} 证据`,
      subtitle: "指标快照、关联融资明细与机构候选",
      context,
      sourceObjectId: null,
      permissions: reviewerRoles,
      sourceRefs: sourceRefs("source:s001-integration-notes", "source:s001-registry"),
      properties: {
        evidenceType: property("规则结果证据包", { sourceRefs: ["source:s001-integration-notes"] }),
        sourceRefs: property(["数据可信度摘要", "Published 本体", "融资明细聚合"], { sourceRefs: sourceRefsCommon }),
        reportRef: property("RPT-20260816-092626-010", { sourceRefs: ["source:s001-registry"] }),
        dataVersion: property("FIN-ASSET-20251231-v02", { sourceRefs: ["source:s001-registry"] }),
        geometry: property(null, { state: "not_applicable" }),
      },
    }));
    links.push(makeLink({
      id: `link:${entityId}:rule:${ruleObjectId}`,
      linkTypeId: "m07.link-type.entity-triggered-rule",
      from: entityId,
      to: ruleObjectId,
      label: "命中规则",
      permissions: reviewerRoles,
      sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"],
    }));
    links.push(makeLink({
      id: `link:${ruleObjectId}:evidence:${evidenceObjectId}`,
      linkTypeId: "m07.link-type.rule-supported-by-evidence",
      from: ruleObjectId,
      to: evidenceObjectId,
      label: "由证据支持",
      permissions: reviewerRoles,
      sourceRefs: ["source:s001-integration-notes", "source:s001-registry"],
    }));

    const balance = numberFrom(entity.balance);
    const cost = numberFrom(entity.cost);
    series.push(makeSeries({ id: `series:${entityId}:balance`, ownerObjectId: entityId, propertyId: "s001.property.financingBalance", label: "融资余额", unit: "亿元", value: balance, context, sourceRefs: ["source:s001-data-js"], note: "单一截至时点；不可用于趋势判断。" }));
    series.push(makeSeries({ id: `series:${entityId}:cost`, ownerObjectId: entityId, propertyId: "s001.property.averageFinancingCost", label: "余额加权平均融资成本", unit: "%", value: cost, context, sourceRefs: ["source:s001-data-js"], note: "单一截至时点；不可用于趋势判断。" }));
    if (ruleCode === "R02") series.push(makeSeries({ id: `series:${entityId}:floating-rate`, ownerObjectId: entityId, propertyId: "s001.property.floatingRateRatio", label: "浮动利率余额占比", unit: "%", value: observed, context, sourceRefs: ["source:s001-data-js"], note: "仅为已绑定规则结果中的主体指标。" }));
    if (ruleCode === "R03") series.push(makeSeries({ id: `series:${entityId}:short-term-debt`, ownerObjectId: entityId, propertyId: "s001.property.shortTermDebtRatio", label: "短期债务余额占比", unit: "%", value: observed, context, sourceRefs: ["source:s001-data-js"], note: "仅为已绑定规则结果中的主体指标。" }));
    events.push({
      id: `event:${ruleCode}:${entity.id}`,
      eventType: "rule-evaluation",
      t: context.dataAsOf,
      timeSemantics: "data-as-of",
      objectId: entityId,
      ruleId,
      state: "triggered",
      quality: "passed",
      sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"],
    });

    entity.banks.forEach((bank, index) => {
      const institutionId = `s001.institution.${entity.id}.${String(index + 1).padStart(2, "0")}`;
      if (!institutionObjects.has(institutionId)) {
        objects.push(makeObject({
          id: institutionId,
          objectTypeId: "m01.object-type.financial-institution",
          title: bank,
          subtitle: `优先协商候选 · ${entity.name} · 排名 ${index + 1}`,
          context,
          sourceObjectId: "OBJ-FINANCIAL-INSTITUTION",
          permissions: reviewerRoles,
          quality: "warning",
          qualityNotes: ["来源为问数/规则输出的优先协商机构候选；不等于已证明的存量借款关系。"],
          sourceRefs: sourceRefs("source:s001-data-js", "source:s001-m01-seed", "source:s001-integration-notes"),
          properties: {
            displayName: property(bank, { sourceRefs: ["source:s001-data-js"] }),
            candidateRole: property("优先协商候选", { quality: "warning", sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"] }),
            priorityRank: property(index + 1, { unit: "rank", sourceRefs: ["source:s001-data-js"] }),
            candidateFor: property(entityId, { sourceRefs: ["source:s001-data-js"] }),
            sourceInstitutionCode: property(null, { state: "redacted", note: "验证资源不复制机构编码。" }),
            geometry: property(null, { state: "not_applicable" }),
          },
        }));
        institutionObjects.set(institutionId, true);
      }
      links.push(makeLink({
        id: `link:${loanId}:candidate:${institutionId}`,
        linkTypeId: "m07.link-type.priority-negotiation-candidate",
        from: loanId,
        to: institutionId,
        label: "优先协商候选",
        quality: "warning",
        permissions: reviewerRoles,
        relationshipBasis: "published-rule-output",
        sourceRefs: ["source:s001-data-js", "source:s001-m01-seed"],
        notes: "未提供单笔融资与机构的可公开细粒度连接；仅展示规则结果候选。",
      }));
    });
  }

  series.push(makeSeries({ id: `series:${groupId}:balance`, ownerObjectId: groupId, propertyId: "s001.property.financingBalance", label: "集团融资余额", unit: "亿元", value: groupMetrics["融资余额"]?.value, context, sourceRefs: ["source:s001-data-js"], note: "单一截至时点；不可用于趋势判断。" }));
  series.push(makeSeries({ id: `series:${groupId}:cost`, ownerObjectId: groupId, propertyId: "s001.property.averageFinancingCost", label: "集团加权平均融资成本", unit: "%", value: groupMetrics["加权平均融资成本"]?.value, context, sourceRefs: ["source:s001-data-js"], note: "单一截至时点；不可用于趋势判断。" }));
  series.push(makeSeries({ id: `series:${groupId}:floating-rate`, ownerObjectId: groupId, propertyId: "s001.property.floatingRateRatio", label: "集团浮动利率余额占比", unit: "%", value: groupMetrics["浮动利率余额占比"]?.value, context, sourceRefs: ["source:s001-data-js"], note: "单一截至时点；不可用于趋势判断。" }));
  series.push(makeSeries({ id: `series:${groupId}:short-term-debt`, ownerObjectId: groupId, propertyId: "s001.property.shortTermDebtRatio", label: "集团短期债务余额占比", unit: "%", value: groupMetrics["短期债务余额占比"]?.value, context, sourceRefs: ["source:s001-data-js"], note: "单一截至时点；不可用于趋势判断。" }));

  const reportId = "s001.report.RPT-20260816-092626-010";
  const evidenceId = "s001.evidence.report.EP-20260816-092248-003";
  objects.push(makeObject({
    id: reportId,
    objectTypeId: "m07.object-type.report",
    title: "集团融资经营分析报告",
    subtitle: "RPT-20260816-092626-010 · 内容版本 2.0",
    context,
    sourceObjectId: null,
    permissions: reviewerRoles,
    sourceRefs: sourceRefs("source:s001-registry", "source:s001-integration-notes"),
    properties: {
      reportId: property("RPT-20260816-092626-010", { sourceRefs: ["source:s001-registry"] }),
      seedReportId: property(data.report?.id || null, { quality: "warning", sourceRefs: ["source:s001-data-js"], note: "data.js 为场景 seed 展示编号；组合 registry 的已发布报告引用优先。" }),
      version: property("2.0", { sourceRefs: ["source:s001-registry"] }),
      formats: property(["HTML", "PDF"], { sourceRefs: ["source:s001-data-js", "source:s001-registry"] }),
      dataVersion: property("FIN-ASSET-20251231-v02", { sourceRefs: ["source:s001-registry"] }),
      publishedSemanticVersionId: property("semantic-MSVJM48O-VJC6", { sourceRefs: ["source:s001-registry", "source:s001-m01-seed"] }),
      geometry: property(null, { state: "not_applicable" }),
    },
  }));
  objects.push(makeObject({
    id: evidenceId,
    objectTypeId: "m07.object-type.report-evidence",
    title: "集团融资经营分析固定证据",
    subtitle: "EP-20260816-092248-003 · 与报告版本绑定",
    context,
    sourceObjectId: null,
    permissions: reviewerRoles,
    sourceRefs: sourceRefs("source:s001-registry", "source:s001-integration-notes"),
    properties: {
      evidencePackId: property("EP-20260816-092248-003", { sourceRefs: ["source:s001-registry"] }),
      verificationRunId: property("VRF-20260816-092540-005", { sourceRefs: ["source:s001-integration-notes"] }),
      coverage: property("53 个事实 / 70 个锚点", { sourceRefs: ["source:s001-integration-notes"] }),
      quality: property("通过", { sourceRefs: ["source:s001-integration-notes"] }),
      dataAsOf: property(context.dataAsOf, { sourceRefs: ["source:s001-registry"] }),
      geometry: property(null, { state: "not_applicable" }),
    },
  }));
  links.push(makeLink({
    id: `link:${reportId}:evidence:${evidenceId}`,
    linkTypeId: "m06.link-type.report-has-evidence",
    from: reportId,
    to: evidenceId,
    label: "绑定固定证据",
    permissions: reviewerRoles,
    sourceRefs: ["source:s001-registry", "source:s001-integration-notes"],
  }));

  const moduleResources = {
    scene: clone(registryScene),
    dataEngineering: clone(registry.dataEngineering?.S001),
    ontology: clone(registry.ontology?.S001),
    query: clone(registry.query?.S001),
    decisions: clone(registry.decisions?.S001),
    agents: clone(registry.agents?.S001),
    reports: clone(registry.reports?.S001),
    chain: clone(registry.chain?.S001),
    workflow: clone(data.workflow),
    modules: clone(data.modules),
    reportSeed: clone(data.report),
    groupMetrics: clone(data.groupMetrics),
    combinations: clone(data.combinations),
  };

  const resource = {
    schemaVersion: "ofw.m07.validation-resource.v1",
    resourceVersion: "s001-financing-v1",
    namespace: "ofw.m07.research.v1",
    researchOnly: true,
    scenarioContext: context,
    sourceContext: {
      sourceProductBaseline: version.sourceProductBaseline || version.parentVersion || "unknown",
      sourceVersion: version.version,
      sourceStatus: version.status,
      candidateSnapshotStatus: version.promotion?.status || "not-frozen",
      acceptanceReady: version.acceptanceReady === true,
      sourceRoot: SOURCE_ID,
      sourceScenario: clone(registryScene),
    },
    ontologyContext: {
      publishedSemanticVersionId: "semantic-MSVJM48O-VJC6",
      publishedSemanticVersion: "V1",
      authoritativeBindingId: "T019-S001-v1",
      authoritativeBindingRecordId: seed.currentFormalVersionId || seed.selectedVersionId || "record-MSVJSKDO-EG5Q",
      publishedStatus: "published",
      consumptionStatus: "可消费",
      definitionMode: "published-reference",
      owner: "M01 本体管理",
      warning: "M07 只读消费 Published 对象与权威数据；不创建、修改或替换本体定义、Metric、Rule、Action Type 或报告事实。",
    },
    source: {
      root: SOURCE_ID,
      workbookCount: 1,
      dateRange: { from: context.dataAsOf, to: context.dataAsOf },
      asOf: context.dataAsOf,
      sourceAssetVersion: "FIN-ASSET-20251231-v02",
      sourceRows: scenario.sourceRows,
      deidentification: "仅保留 v1.1.0 S001 已展示的脱敏主体/机构别名和聚合指标；原始借据、单位编码、机构编码与工作簿内容不写入资源。",
      snapshots: [{ id: "s001.snapshot:2025-12-31", date: context.dataAsOf, file: scenario.sourceFile, version: "FIN-ASSET-20251231-v02", sourceRefs: ["source:s001-data-js", "source:s001-registry"] }],
      files: sourceDigests,
    },
    roles: [
      { id: "m07.analyst", label: "研究分析员", policyVersion: "research-policy-v1", objectVisibility: "all-resource-objects" },
      { id: "m07.auditor", label: "证据审计员", policyVersion: "research-policy-v1", objectVisibility: "all-resource-objects" },
      { id: "m07.restricted", label: "受限观察员", policyVersion: "research-policy-v1", objectVisibility: "group-entity-loan-only", redaction: "omit-unauthorized-nodes-and-links" },
    ],
    objects,
    links,
    series,
    events,
    lensDefinitions: [
      { id: "lens.catalog.v1", kind: "catalog", owner: "M07", version: "s001-v1", supports: ["ObjectRef", "quality", "permission", "sourceContext"] },
      { id: "lens.object360.v1", kind: "object360", owner: "M07", version: "s001-v1", supports: ["properties", "links", "quality", "version", "evidence"] },
      { id: "lens.graph.v1", kind: "graph", owner: "M07", version: "s001-v1", maxHops: 2, supports: ["LinkRef", "permission-filter", "quality-filter"] },
      { id: "lens.temporal.v1", kind: "temporal", owner: "M07", version: "s001-v1", supports: ["TimeSeriesRef", "single-snapshot", "raw", "rolling", "diff", "event-location"] },
      { id: "lens.spatial.v1", kind: "spatial", owner: "M07", version: "s001-v1", status: "not_applicable", reason: "S001 当前来源没有权威 geometry/GeoRef；不得生成伪位置。" },
    ],
    moduleResources,
    contracts: {
      objectRef: { namespace: "ofw.m07.research.v1", stableWithin: "scenarioId + scenarioVersion + publishedSemanticVersionId", format: "s001.<kind>.<source-key>", sourceOfTruth: "M01 Published ObjectRef" },
      linkRef: { sourceOfTruth: "M01 Published LinkRef or explicitly marked M07 recommendation projection", permissionRule: "both endpoints must be visible", qualityRule: "warning candidate links never become confirmed lender facts" },
      timeSeriesRef: { ownerRule: "series.ownerObjectId must point to visible ObjectRef", grain: "P1D-single-snapshot", missingRule: "missing/not_observed remain explicit; no interpolation", versionRule: "each point carries snapshotRef and dataVersion" },
      geoRef: { status: "not_applicable", reason: "S001 validation source does not prove geometry, CRS, valid time or layer membership", fallback: "show honest not-applicable state and return to graph/object 360" },
      deepLink: { required: ["scenarioId", "scenarioVersion", "scenarioRunId", "publishedSemanticVersionId", "object", "lens"], unauthorized: "re-authorize on open; never resolve by title or cached object" },
    },
    sourceDefinitions: sourceObjectDefinitions,
    sourceContract: {
      dataAssetVersion: "FIN-ASSET-20251231-v02",
      sourceRunId: "RUN-20251231-002",
      qualityResultId: "QUALITY-20251231-002",
      publishedSemanticVersionId: "semantic-MSVJM48O-VJC6",
      t019Pointer: "T019-S001-v1",
      memberCoverage: "4/4",
      relationshipCoverage: "3/3",
      metricCount: 7,
      ruleCount: 3,
      actionTypeCount: 1,
    },
    validationNotes: [
      "S001 资源是 M07 只读验证投影，不是新的业务事实真源。",
      "贷款对象是按主体聚合的融资明细集合；没有复制 5,218 行或伪造单笔借据。",
      "机构对象是已发布规则输出的优先协商候选；关系质量 warning，不等于实际存量 lender 关系。",
      "当前只有 2025-12-31 一个受治理时点；时序 Lens 可定位单点但不能宣称趋势。",
      "空间 Lens 返回 not_applicable，除非 M02/M01 后续提供带 CRS、有效时间和证据的 GeoRef。",
      "规则、行动和报告状态只显示来源引用；M07 不执行 Action 或修改报告。",
    ],
  };
  return resource;
}

function build() {
  const data = loadWindowExport(SOURCE_FILES.data, "S001_DATA");
  const registry = loadWindowExport(SOURCE_FILES.registry, "OFW_COMPOSITE_REGISTRY");
  const seed = loadWindowExport(SOURCE_FILES.ontologySeed, "OFW_M01_S001_SEED");
  const version = JSON.parse(read(SOURCE_FILES.version));
  const sourceDigests = Object.fromEntries(Object.entries(SOURCE_FILES).map(([key, relativePath]) => [key, fileDigest(relativePath)]));
  return buildResource({ data, registry, seed, version, sourceDigests, scenarioReadme: read(SOURCE_FILES.scenarioReadme), integrationNotes: read(SOURCE_FILES.integrationNotes) });
}

const resource = build();
const serialized = `${JSON.stringify(resource, null, 2)}\n`;
if (process.argv.includes("--stdout")) process.stdout.write(serialized);
if (!process.argv.includes("--check") && !process.argv.includes("--stdout")) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, serialized);
  process.stdout.write(`wrote ${OUTPUT_PATH}\n`);
}

export { build, OUTPUT_PATH, SOURCE_ID, SOURCE_ROOT };
