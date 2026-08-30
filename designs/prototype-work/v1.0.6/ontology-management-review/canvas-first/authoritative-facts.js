(() => {
  "use strict";

  const snapshot = Object.freeze({
    schemaVersion: "1.0",
    factInventoryVersion: "S001-FINANCE-FACTS-1.0",
    sceneId: "S001",
    asOf: "2025-12-31",
    source: Object.freeze({
      sha256: "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d",
      sizeBytes: 807264,
      rowCount: 5218,
      columnCount: 35,
      unitCount: 574,
      institutionCount: 24,
      ownerCount: 24,
      calculationBasis: "融资明细折合人民币余额与当前利率；比例指标均按折合人民币余额加权"
    }),
    groupMetrics: Object.freeze({
      balance: 21613.387,
      cost: 2.3722312046695873,
      floating: 95.14949230308049,
      shortTerm: 0.9118052621738555,
      foreign: 4.224132015958443,
      highCost: 9.859389460800383,
      credit: 34.68003881113127,
      unknownGuarantee: 27.432021644733425,
      loanCount: 5218
    }),
    units: Object.freeze({
      "单位553": Object.freeze({
        singleBusinessSubjectId: "UNIT-553",
        singleBusinessSubjectName: "单位553",
        singleBusinessSubjectObjectType: "OBJ-FINANCING-ENTITY",
        ownerId: "DEMO-OWNER-001",
        ownerName: "融资负责人001",
        board: "集团及直管公司",
        balance: 393.134,
        cost: 2.880984015628259,
        floating: 0,
        shortTerm: 0,
        foreign: 100,
        highCost: 77.33724378964933,
        credit: 0,
        loanCount: 75,
        ruleCode: "R01",
        ruleBranch: "主体融资成本高于集团基准 0.25 个百分点，且高成本融资余额占比大于 20%",
        institutions: Object.freeze([
          Object.freeze({ name: "欧陆银行", balance: 99.586, share: 32.75435059318048, cost: 2.9943927861345974, count: 16 }),
          Object.freeze({ name: "寰宇银行", balance: 65.494, share: 21.541315423350293, cost: 2.9, count: 11 }),
          Object.freeze({ name: "海联银行", balance: 58.476, share: 19.2330589167837, cost: 3.00447790546549, count: 10 })
        ]),
        loans: Object.freeze([
          Object.freeze({ id: "DEMO-DEBT-004848", institution: "欧陆银行", balance: 14.255, rate: 2.9, due: "2049-09-27", currency: "英镑" }),
          Object.freeze({ id: "DEMO-DEBT-004899", institution: "欧陆银行", balance: 13.616, rate: 2.9, due: "2049-09-27", currency: "英镑" }),
          Object.freeze({ id: "DEMO-DEBT-004845", institution: "亚太银行", balance: 13.245, rate: 2.9, due: "2049-09-27", currency: "英镑" })
        ])
      }),
      "单位465": Object.freeze({
        singleBusinessSubjectId: "UNIT-465",
        singleBusinessSubjectName: "单位465",
        singleBusinessSubjectObjectType: "OBJ-FINANCING-ENTITY",
        ownerId: "DEMO-OWNER-009",
        ownerName: "融资负责人009",
        board: "核能",
        balance: 770,
        cost: 2.1966171558441556,
        floating: 100,
        shortTerm: 1.1446753246753247,
        foreign: 0,
        highCost: 0,
        credit: 0,
        loanCount: 176,
        ruleCode: "R02",
        ruleBranch: "浮动利率余额占比大于 80%",
        institutions: Object.freeze([
          Object.freeze({ name: "融通银行", balance: 249.081, share: 32.34818181818182, cost: 2.153929284048161, count: 60 }),
          Object.freeze({ name: "启明银行", balance: 237.763, share: 30.87831168831169, cost: 2.2003307495278914, count: 46 }),
          Object.freeze({ name: "嘉禾银行", balance: 221.527, share: 28.76974025974026, cost: 2.2431167306919697, count: 55 })
        ]),
        loans: Object.freeze([
          Object.freeze({ id: "DEMO-DEBT-003625", institution: "启明银行", balance: 14.748, rate: 2.25, due: "2050-10-21", currency: "人民币" }),
          Object.freeze({ id: "DEMO-DEBT-003803", institution: "启明银行", balance: 14.233, rate: 2.55, due: "2050-10-21", currency: "人民币" }),
          Object.freeze({ id: "DEMO-DEBT-003815", institution: "融通银行", balance: 14.109, rate: 1.95, due: "2050-10-21", currency: "人民币" })
        ])
      }),
      "单位561": Object.freeze({
        singleBusinessSubjectId: "UNIT-561",
        singleBusinessSubjectName: "单位561",
        singleBusinessSubjectObjectType: "OBJ-FINANCING-ENTITY",
        ownerId: "DEMO-OWNER-009",
        ownerName: "融资负责人009",
        board: "核技术",
        balance: 20.016,
        cost: 2.2283802957633894,
        floating: 0,
        shortTerm: 93.54516386890488,
        foreign: 0,
        highCost: 0,
        credit: 41.91147082334133,
        loanCount: 50,
        ruleCode: "R03",
        ruleBranch: "短期债务余额占比大于 30%",
        institutions: Object.freeze([
          Object.freeze({ name: "同州银行", balance: 5.047, share: 26.95471053193762, cost: 2.241139290667723, count: 10 }),
          Object.freeze({ name: "星河银行", balance: 4.603, share: 24.58342234565264, cost: 2.226026504453617, count: 11 }),
          Object.freeze({ name: "恒信银行", balance: 3.662, share: 19.5577867976928, cost: 2.2058820316766794, count: 11 })
        ]),
        loans: Object.freeze([
          Object.freeze({ id: "DEMO-DEBT-005093", institution: "同州银行", balance: 1.115, rate: 2.26, due: "2027-03-06", currency: "人民币" }),
          Object.freeze({ id: "DEMO-DEBT-004948", institution: "鼎新银行", balance: 1.016, rate: 2.26, due: "2026-05-21", currency: "人民币" }),
          Object.freeze({ id: "DEMO-DEBT-005024", institution: "盛景银行", balance: 0.995, rate: 2.11, due: "2026-09-05", currency: "人民币" })
        ])
      })
    }),
    comparisons: Object.freeze({
      "单位465|单位553": Object.freeze({ balance: 1163.134, cost: 2.4279300407347733 }),
      "单位553|单位561": Object.freeze({ balance: 413.15, cost: 2.849367130582113 }),
      "单位465|单位561": Object.freeze({ balance: 790.016, cost: 2.1974219129739145 }),
      "单位465|单位553|单位561": Object.freeze({ balance: 1183.15, cost: 2.4245541478257193 })
    }),
    structures: Object.freeze({
      rate: Object.freeze([
        Object.freeze({ name: "浮动利率", value: 95.14949230308049 }),
        Object.freeze({ name: "固定利率", value: 4.288161776772887 }),
        Object.freeze({ name: "未知", value: 0.5623459201466202 })
      ]),
      term: Object.freeze([
        Object.freeze({ name: "长期", value: 95.02254320435756 }),
        Object.freeze({ name: "中期", value: 3.5033056133219658 }),
        Object.freeze({ name: "短期", value: 0.9118052621738555 }),
        Object.freeze({ name: "未知", value: 0.5623459201466202 })
      ]),
      currency: Object.freeze([
        Object.freeze({ name: "人民币", value: 95.77586798404155 }),
        Object.freeze({ name: "外币", value: 4.224132015958443 })
      ]),
      guarantee: Object.freeze([
        Object.freeze({ name: "信用", value: 34.68003881113127 }),
        Object.freeze({ name: "质押担保", value: 34.336719182421525 }),
        Object.freeze({ name: "未知", value: 27.432021644733425 }),
        Object.freeze({ name: "其他担保", value: 3.551220361713782 })
      ]),
      finance: Object.freeze([
        Object.freeze({ name: "间接融资", value: 98.4931283560508 }),
        Object.freeze({ name: "直接融资", value: 0.9445257238025674 }),
        Object.freeze({ name: "票据贴现", value: 0.5623459201466202 })
      ]),
      region: Object.freeze([
        Object.freeze({ name: "境内", value: 95.30274454438816 }),
        Object.freeze({ name: "境外", value: 4.697255455611839 })
      ])
    }),
    institutions: Object.freeze([
      Object.freeze({ name: "启明银行", balance: 2012.564, share: 9.311654855391243, cost: 2.2601987663497907, count: 439 }),
      Object.freeze({ name: "盛景银行", balance: 1830.405, share: 8.468848496535966, cost: 2.304003993651678, count: 430 }),
      Object.freeze({ name: "嘉禾银行", balance: 1820.424, share: 8.422668783934698, cost: 2.277054828984896, count: 439 }),
      Object.freeze({ name: "海川银行", balance: 1819.037, share: 8.416251464890719, cost: 2.2952054026388686, count: 413 }),
      Object.freeze({ name: "融通银行", balance: 1808.807, share: 8.368919688524525, cost: 2.2491499314188856, count: 423 }),
      Object.freeze({ name: "安泰银行", balance: 1747.87, share: 8.086978685941263, cost: 2.326359443208019, count: 392 }),
      Object.freeze({ name: "星河银行", balance: 1658.062, share: 7.671458434534115, cost: 2.2840195239984995, count: 384 }),
      Object.freeze({ name: "鼎新银行", balance: 1567.051, share: 7.250372188310883, cost: 2.3705726169729, count: 402 }),
      Object.freeze({ name: "同州银行", balance: 1558.98, share: 7.213029591336147, cost: 2.3035888529679664, count: 393 }),
      Object.freeze({ name: "远山银行", balance: 1555.984, share: 7.199167812060183, cost: 2.286849382770003, count: 362 }),
      Object.freeze({ name: "恒信银行", balance: 1546.278, share: 7.15426045903865, cost: 2.301384511711348, count: 386 }),
      Object.freeze({ name: "华辰银行", balance: 1478.541, share: 6.8408574741200905, cost: 2.3259402749061406, count: 362 })
    ]),
    trend: Object.freeze([])
  });

  window.S001_AUTHORITATIVE_FACT_SNAPSHOT = snapshot;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const token = (value) => String(value || "UNKNOWN").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
  const sameScenarioEnvelope = (left, right) => ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]
    .every((field) => (left?.scenarioContext?.[field] ?? left?.[field]) === (right?.scenarioContext?.[field] ?? right?.[field]));

  window.buildS001AuthoritativeFactPackage = ({ scenarioContext, version, binding, adoptionRecord, t018, sourceContract }) => {
    const requiredMetricIds = ["MET-FINANCING-BALANCE", "MET-WAVG-FINANCING-COST", "MET-FLOATING-RATE-BALANCE-RATIO", "MET-SHORT-TERM-DEBT-RATIO", "MET-FX-FINANCING-SHARE", "MET-HIGH-COST-BALANCE-RATIO", "MET-CREDIT-FINANCING-SHARE"];
    const requiredRuleIds = ["RULE-HIGH-FINANCING-COST", "RULE-FLOATING-RATE-EXPOSURE", "RULE-SHORT-TERM-DEBT-CONCENTRATION"];
    const requiredMemberIds = ["FIN-MEMBER-SUBJECT", "FIN-MEMBER-DETAIL", "FIN-MEMBER-INSTITUTION", "FIN-MEMBER-OWNER"];
    const requiredRelationIds = ["FIN-REL-DETAIL-SUBJECT", "FIN-REL-DETAIL-INSTITUTION", "FIN-REL-SUBJECT-OWNER"];
    const metricIds = new Set((version?.metrics || []).map((item) => item.id));
    const ruleIds = new Set((version?.rules || []).map((item) => item.id));
    const actionIds = new Set((version?.actions || []).map((item) => item.id));
    const memberIds = new Set((sourceContract?.members || []).map((item) => item.id));
    const relationIds = new Set((sourceContract?.relations || []).map((item) => item.id));
    const sourceIdentityReady = sourceContract?.sourceModule === "数据工程"
      && sourceContract?.contractCode === "C003"
      && sourceContract?.assetVersion === binding?.dataVersion
      && sourceContract?.asOf === snapshot.asOf
      && sourceContract?.sourceFingerprint?.algorithm === "SHA-256"
      && sourceContract?.sourceFingerprint?.value === snapshot.source.sha256
      && Number(sourceContract?.sourceFingerprint?.sizeBytes) === snapshot.source.sizeBytes
      && sourceContract?.t008Confirmation?.snapshotId === sourceContract?.sourceSnapshotId
      && sourceContract?.t008Confirmation?.sourceReadEventId === sourceContract?.sourceReadEventId
      && sourceContract?.t008Confirmation?.asOf === snapshot.asOf
      && Number(sourceContract?.t008Confirmation?.sizeBytes) === snapshot.source.sizeBytes;
    const semanticReady = version?.ontologyStableId === "ONT-GROUP-FINANCING-OPTIMIZATION"
      && version?.id === t018?.semanticVersionId
      && version?.semanticVersion === t018?.semanticVersion
      && binding?.semanticVersion === version?.semanticVersion
      && requiredMetricIds.length === metricIds.size && requiredMetricIds.every((id) => metricIds.has(id))
      && requiredRuleIds.length === ruleIds.size && requiredRuleIds.every((id) => ruleIds.has(id))
      && actionIds.size === 1 && actionIds.has("ACTION-FINANCING-OPTIMIZATION")
      && [...(version?.rules || []), ...(version?.actions || [])].every((resource) => !["recommended", "unknown"].includes(resource.businessBasis));
    const coverageReady = requiredMemberIds.length === memberIds.size && requiredMemberIds.every((id) => memberIds.has(id))
      && requiredRelationIds.length === relationIds.size && requiredRelationIds.every((id) => relationIds.has(id));
    const adoptionReady = t018?.status === "eligible"
      && t018?.dataVersion === binding?.dataVersion
      && t018?.evidenceLocator
      && adoptionRecord?.id === binding?.adoptionRecordId
      && adoptionRecord?.evidenceCode === binding?.adoptionEvidenceLocator
      && adoptionRecord?.semanticVersion === version?.semanticVersion
      && adoptionRecord?.dataVersion === binding?.dataVersion
      && binding?.asOf === snapshot.asOf;
    const scenarioReady = scenarioContext?.scenarioId === snapshot.sceneId
      && sameScenarioEnvelope(scenarioContext, version)
      && sameScenarioEnvelope(scenarioContext, binding)
      && sameScenarioEnvelope(scenarioContext, t018)
      && sameScenarioEnvelope(scenarioContext, adoptionRecord)
      && sameScenarioEnvelope(scenarioContext, sourceContract)
      && sameScenarioEnvelope(scenarioContext, sourceContract?.t008Confirmation);
    if (!sourceIdentityReady || !semanticReady || !coverageReady || !adoptionReady || !scenarioReady) return null;

    const semanticVersionId = version.id;
    const semanticVersion = version.semanticVersion;
    const dataVersion = binding.dataVersion;
    const t018EvidenceId = t018.evidenceLocator;
    const t019EvidenceId = adoptionRecord.evidenceCode;
    const evaluationAt = t018.checkedAt || t018.formedAt || binding.switchedAt;
    const metricResultVersion = `MR-${token(dataVersion)}-${token(semanticVersionId)}`;
    const ruleResultVersion = `RR-${token(dataVersion)}-${token(semanticVersionId)}`;
    const sourceEvidence = [
      sourceContract.t008Confirmation?.evidenceId,
      sourceContract.qualitySummary?.resultId,
      t018EvidenceId,
      t019EvidenceId
    ].filter(Boolean);
    const metrics = Object.fromEntries((version.metrics || []).map((item) => [item.id, item]));
    const rules = Object.fromEntries((version.rules || []).map((item) => [item.id, item]));
    const action = (version.actions || []).find((item) => item.id === "ACTION-FINANCING-OPTIMIZATION");
    const resourceById = new Map();
    [...(version.objects || []), ...(version.links || []), ...(version.metrics || []), ...(version.rules || []), ...(version.actions || [])]
      .forEach((resource) => { if (resource?.id) resourceById.set(resource.id, resource); });
    (version.objects || []).forEach((object) => (object.properties || []).forEach((property) => {
      if (property?.id) resourceById.set(property.id, { ...property, parentName: property.parentName || object.name, parentId: object.id });
    }));
    const facts = [];
    const addFact = ({ id, label, kind, value, unit = null, scope, resourceId = null, evidence = [], resultVersion = metricResultVersion, applicableChecks = null, details = {} }) => {
      const anchorId = `ontology-${id.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const evidenceRefs = [...new Set([resourceId, ...sourceEvidence, ...evidence].filter(Boolean))];
      const checks = applicableChecks || ["evidenceCompleteness", "valueConsistency", "semanticConsistency", "versionCompatibility", "trustDisclosure"];
      const resource = (resourceId && resourceById.get(resourceId)) || null;
      const effectiveFrom = resource?.effectiveFrom || version.effectiveFrom || version.publishedAt || snapshot.asOf;
      const effectiveTo = resource?.effectiveTo || version.effectiveTo || null;
      const semanticResourceId = resourceId || version.ontologyStableId || semanticVersionId;
      const semanticName = resource?.name || label;
      const semanticDefinition = resource?.definition || resource?.requirement || resource?.evidence || `${label}的业务定义`;
      const semanticApplicableObject = resource?.scope || resource?.appliesTo || resource?.target || resource?.parentName || scope || "集团融资业务";
      const semanticTimeRange = resource?.time || `数据截至 ${snapshot.asOf}；业务有效期 ${effectiveFrom} 至 ${effectiveTo || "未预设"}`;
      facts.push({
        id,
        label,
        kind,
        value,
        unit,
        scope,
        resultVersion,
        evidence: evidenceRefs,
        primaryAnchorId: anchorId,
        anchorIds: [anchorId],
        locations: [{ sectionId: "semantic-facts", anchorId, location: `权威事实 / ${label}` }],
        applicableChecks: checks,
        semanticSnapshot: {
          semanticVersionId,
          semanticVersion,
          publishedVersion: semanticVersion,
          resourceId: semanticResourceId,
          resourceName: semanticName,
          name: semanticName,
          definition: semanticDefinition,
          applicableObject: semanticApplicableObject,
          timeRange: semanticTimeRange,
          unit: unit || resource?.unit || null,
          baseUnit: resource?.unit || unit || null,
          effectiveFrom,
          effectiveTo,
          resourceType: resource?.type || resource?.kind || kind
        },
        trustSnapshot: {
          dataVersion,
          asOf: snapshot.asOf,
          qualityStatus: sourceContract.qualitySummary?.status || "通过",
          freshnessStatus: `截至 ${snapshot.asOf}`,
          consumptionReadiness: "可消费",
          sourceSha256: snapshot.source.sha256,
          t018EvidenceId,
          t019EvidenceId,
          limitations: []
        },
        ...clone(details)
      });
    };

    addFact({ id: "FACT-AS-OF", label: "数据截至时间", kind: "日期", value: snapshot.asOf, scope: "集团", resultVersion: t018EvidenceId });
    addFact({ id: "FACT-GROUP-BALANCE", label: "集团融资余额", kind: "Metric 结果", value: snapshot.groupMetrics.balance, unit: "亿元", scope: "集团", resourceId: "MET-FINANCING-BALANCE" });
    addFact({ id: "FACT-GROUP-COST", label: "集团余额加权融资成本", kind: "Metric 结果", value: snapshot.groupMetrics.cost, unit: "%", scope: "集团", resourceId: "MET-WAVG-FINANCING-COST" });
    addFact({ id: "FACT-GROUP-FLOATING", label: "集团浮动利率余额占比", kind: "Metric 结果", value: snapshot.groupMetrics.floating, unit: "%", scope: "集团", resourceId: "MET-FLOATING-RATE-BALANCE-RATIO" });
    addFact({ id: "FACT-GROUP-SHORT", label: "集团短期债务余额占比", kind: "Metric 结果", value: snapshot.groupMetrics.shortTerm, unit: "%", scope: "集团", resourceId: "MET-SHORT-TERM-DEBT-RATIO" });
    addFact({ id: "FACT-GROUP-FOREIGN", label: "集团外币融资余额占比", kind: "Metric 结果", value: snapshot.groupMetrics.foreign, unit: "%", scope: "集团", resourceId: "MET-FX-FINANCING-SHARE" });
    addFact({ id: "FACT-GROUP-HIGH-COST", label: "集团高成本融资余额占比", kind: "Metric 结果", value: snapshot.groupMetrics.highCost, unit: "%", scope: "集团", resourceId: "MET-HIGH-COST-BALANCE-RATIO" });
    addFact({ id: "FACT-GROUP-CREDIT", label: "集团信用融资余额占比", kind: "Metric 结果", value: snapshot.groupMetrics.credit, unit: "%", scope: "集团", resourceId: "MET-CREDIT-FINANCING-SHARE" });
    addFact({ id: "FACT-GUARANTEE-UNKNOWN", label: "担保方式未知余额占比", kind: "质量披露", value: snapshot.groupMetrics.unknownGuarantee, unit: "%", scope: "集团", resourceId: "PROP-FINANCING-DETAIL-GUARANTEE-TYPE" });
    addFact({ id: "FACT-THREE-UNIT-BALANCE", label: "三家重点单位组合融资余额", kind: "Metric 结果", value: snapshot.comparisons["单位465|单位553|单位561"].balance, unit: "亿元", scope: "单位553、单位465、单位561", resourceId: "MET-FINANCING-BALANCE" });
    addFact({ id: "FACT-THREE-UNIT-COST", label: "三家重点单位组合加权融资成本", kind: "Metric 结果", value: snapshot.comparisons["单位465|单位553|单位561"].cost, unit: "%", scope: "单位553、单位465、单位561", resourceId: "MET-WAVG-FINANCING-COST" });
    addFact({ id: "FACT-DISCLOSURE-WEIGHTED-METHOD", label: "余额加权口径说明", kind: "口径披露", value: "组合融资成本按所选融资明细折合人民币余额加权，不对单位成本做简单平均。", scope: "集团及主体集合", resourceId: "MET-WAVG-FINANCING-COST", resultVersion: semanticVersionId });
    addFact({ id: "FACT-PUBLISHED-SEMANTIC-VERSION", label: "已发布语义版本", kind: "版本披露", value: semanticVersion, scope: "当前权威组合", evidence: [semanticVersionId], resultVersion: semanticVersionId });
    addFact({ id: "FACT-DATA-VERSION", label: "可消费数据版本", kind: "版本披露", value: dataVersion, scope: "当前权威组合", resultVersion: t018EvidenceId });
    addFact({ id: "FACT-DATA-AS-OF-DISCLOSURE", label: "数据截至时间披露", kind: "日期", value: snapshot.asOf, scope: "当前权威组合", resultVersion: t018EvidenceId });
    addFact({ id: "FACT-DISCLOSURE-FIXED-RESULTS", label: "固定结果边界", kind: "边界披露", value: "指标与 Rule 结果固定于当前精确语义版本、数据版本和数据截至时间；权威组合变化不会改写本事实包。", scope: "当前权威组合", evidence: [semanticVersionId, dataVersion], resultVersion: adoptionRecord.id });

    const unitRuleConfig = {
      "单位553": { ruleId: "RULE-HIGH-FINANCING-COST", metricId: "MET-HIGH-COST-BALANCE-RATIO", metricName: "高成本融资余额占比", metricValue: snapshot.units["单位553"].highCost, threshold: "> 20%（高成本利率阈值 2.75%）" },
      "单位465": { ruleId: "RULE-FLOATING-RATE-EXPOSURE", metricId: "MET-FLOATING-RATE-BALANCE-RATIO", metricName: "浮动利率余额占比", metricValue: snapshot.units["单位465"].floating, threshold: "> 80%" },
      "单位561": { ruleId: "RULE-SHORT-TERM-DEBT-CONCENTRATION", metricId: "MET-SHORT-TERM-DEBT-RATIO", metricName: "短期债务余额占比", metricValue: snapshot.units["单位561"].shortTerm, threshold: "> 30%" }
    };
    Object.entries(snapshot.units).forEach(([unitName, unit]) => {
      const unitKey = unitName.replace("单位", "");
      const config = unitRuleConfig[unitName];
      const code = unit.ruleCode;
      const evaluationId = `RULE-EVAL-${code}-${token(unit.singleBusinessSubjectId)}-${token(dataVersion)}`;
      const ruleSnapshot = { ruleId: config.ruleId, ruleVersion: semanticVersion, evaluationRecordId: evaluationId, branch: unit.ruleBranch, threshold: config.threshold, evaluatedAt: evaluationAt, evaluationTime: evaluationAt, metricId: config.metricId, metricValue: config.metricValue, result: "命中" };
      addFact({ id: `FACT-UNIT-${unitKey}-BALANCE`, label: `${unitName}融资余额`, kind: "Metric 结果", value: unit.balance, unit: "亿元", scope: unitName, resourceId: "MET-FINANCING-BALANCE" });
      addFact({ id: `FACT-UNIT-${unitKey}-COST`, label: `${unitName}余额加权融资成本`, kind: "Metric 结果", value: unit.cost, unit: "%", scope: unitName, resourceId: "MET-WAVG-FINANCING-COST" });
      addFact({ id: `FACT-${code}-RESULT`, label: `${code} 命中结论`, kind: "Rule 结论", value: "命中", scope: unitName, resourceId: config.ruleId, evidence: [config.metricId, evaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "valueConsistency", "semanticConsistency", "versionCompatibility", "trustDisclosure", "ruleConsistency"], details: { evaluationId, ruleSnapshot } });
      addFact({ id: `FACT-${code}-BRANCH`, label: `${code} 触发分支`, kind: "Rule 命中证据", value: unit.ruleBranch, scope: unitName, resourceId: config.ruleId, evidence: [config.metricId, evaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "valueConsistency", "semanticConsistency", "versionCompatibility", "trustDisclosure", "ruleConsistency"], details: { evaluationId, ruleSnapshot } });
      addFact({ id: `FACT-${code}-THRESHOLD`, label: `${code} 阈值`, kind: "Rule 阈值", value: config.threshold, scope: unitName, resourceId: config.ruleId, evidence: [config.metricId, evaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "semanticConsistency", "versionCompatibility", "ruleConsistency"], details: { evaluationId, ruleSnapshot } });
      addFact({ id: `FACT-${code}-EVALUATED-AT`, label: `${code} 评估时间`, kind: "评估时间", value: evaluationAt, scope: unitName, resourceId: config.ruleId, evidence: [evaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "versionCompatibility", "ruleConsistency"], details: { evaluationId, ruleSnapshot } });
      addFact({ id: `FACT-${code}-INSTITUTIONS`, label: `${unitName}优先协商机构`, kind: "Rule 命中证据", value: unit.institutions.map((item) => item.name).join("、"), scope: unitName, resourceId: config.ruleId, evidence: [evaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "valueConsistency", "semanticConsistency", "versionCompatibility", "trustDisclosure", "ruleConsistency"], details: { evaluationId, ruleSnapshot } });
    });
    const r01EvaluationId = `RULE-EVAL-R01-${token(snapshot.units["单位553"].singleBusinessSubjectId)}-${token(dataVersion)}`;
    const r01RuleSnapshot = { ruleId: "RULE-HIGH-FINANCING-COST", ruleVersion: semanticVersion, evaluationRecordId: r01EvaluationId, branch: snapshot.units["单位553"].ruleBranch, threshold: unitRuleConfig["单位553"].threshold, evaluatedAt: evaluationAt, evaluationTime: evaluationAt, metricId: unitRuleConfig["单位553"].metricId, metricValue: unitRuleConfig["单位553"].metricValue, result: "命中" };
    addFact({ id: "FACT-R01-HIGH-COST-INSTITUTIONS", label: "单位553高成本融资重点机构", kind: "Rule 命中证据", value: snapshot.units["单位553"].institutions.map((item) => item.name).join("、"), scope: "单位553", resourceId: "RULE-HIGH-FINANCING-COST", evidence: ["MET-HIGH-COST-BALANCE-RATIO", r01EvaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "valueConsistency", "semanticConsistency", "versionCompatibility", "trustDisclosure", "ruleConsistency"], details: { evaluationId: r01EvaluationId, ruleSnapshot: r01RuleSnapshot } });
    addFact({ id: "FACT-UNIT553-FOREIGN-CURRENCY", label: "单位553外币融资占比", kind: "Metric 结果", value: snapshot.units["单位553"].foreign, unit: "%", scope: "单位553", resourceId: "MET-FX-FINANCING-SHARE" });
    addFact({ id: "FACT-INSTITUTION-PRIORITY-BASIS", label: "优先协商机构排序口径", kind: "Rule 口径", value: "R01 两条分支同时命中，按高成本融资余额贡献降序列出前三家机构。", scope: "单位553", resourceId: "RULE-HIGH-FINANCING-COST", evidence: [r01EvaluationId], resultVersion: ruleResultVersion, applicableChecks: ["evidenceCompleteness", "semanticConsistency", "versionCompatibility", "ruleConsistency"], details: { evaluationId: r01EvaluationId, ruleSnapshot: r01RuleSnapshot } });
    const suggestionEvidence = [...version.rules.map((item) => item.id), action.id];
    const suggestionDirections = {
      "单位553": "核对高成本借据置换空间",
      "单位465": "核对固定利率或利率上限条件",
      "单位561": "核对展期与中长期置换条件"
    };
    const suggestionBasis = Object.entries(unitRuleConfig).map(([unitName, config]) => {
      const unit = snapshot.units[unitName];
      const evaluationRecordId = `RULE-EVAL-${unit.ruleCode}-${token(unit.singleBusinessSubjectId)}-${token(dataVersion)}`;
      return { scope: unitName, ruleId: config.ruleId, ruleVersion: semanticVersion, evaluationRecordId, resultVersion: ruleResultVersion, direction: suggestionDirections[unitName] };
    });
    addFact({ id: "FACT-SUGGESTION-SCOPE", label: "行动建议使用边界", kind: "建议依据", value: "已识别的问题可以形成融资优化行动申请；必须经人工确认后，才由决策中心创建负责人待办。", scope: "三家重点单位", resourceId: action.id, evidence: suggestionEvidence, resultVersion: semanticVersionId });
    addFact({ id: "FACT-SUGGESTION-BASIS", label: "融资优化建议依据", kind: "建议依据", value: "单位553优先核对高成本借据降息或置换，单位465优先协商固定利率或利率上限，单位561优先协商展期或中长期置换。", scope: "三家重点单位", resourceId: action.id, evidence: suggestionEvidence, resultVersion: semanticVersionId, details: { basis: suggestionBasis, limitation: "仅用于人工复核参考，不等同于行动申请，不表示行动已执行。" } });

    const anchors = facts.map((fact) => ({
      id: fact.primaryAnchorId,
      sectionId: "semantic-facts",
      type: fact.kind,
      label: fact.label,
      factId: fact.id,
      factRefs: [fact.id],
      evidence: clone(fact.evidence),
      evidenceRefs: clone(fact.evidence),
      location: fact.locations[0].location
    }));
    const contentItems = facts.map((fact, index) => ({
      sourceItemId: `ONT-SOURCE-${String(index + 1).padStart(3, "0")}`,
      contentItemId: `ONT-CONTENT-${String(index + 1).padStart(3, "0")}`,
      anchorId: fact.primaryAnchorId,
      templateSlot: "semantic-fact-inventory",
      origin: "ontology",
      claimType: fact.kind,
      presentationType: "structured-fact",
      factRefs: [fact.id],
      evidenceRefs: clone(fact.evidence),
      requiresEvidence: true,
      bindingStatus: "bound",
      renderedValue: clone(fact.value),
      displayValue: clone(fact.value),
      displayUnit: fact.unit
    }));
    const units = clone(snapshot.units);
    Object.entries(units).forEach(([unitName, unit]) => {
      const config = unitRuleConfig[unitName];
      const code = unit.ruleCode;
      unit.rule = {
        id: config.ruleId,
        code,
        name: rules[config.ruleId]?.name,
        version: semanticVersion,
        publishedSemanticVersion: semanticVersion,
        publicationStatus: "Published",
        effective: version.effectiveFrom || version.publishedAt,
        status: "命中",
        branch: unit.ruleBranch,
        evaluatedAt: evaluationAt,
        evaluationId: `RULE-EVAL-${code}-${token(unit.singleBusinessSubjectId)}-${token(dataVersion)}`,
        resultVersion: ruleResultVersion,
        metricId: config.metricId,
        metric: config.metricName,
        metricValue: `${config.metricValue}%`,
        threshold: config.threshold
      };
      delete unit.ruleCode;
      delete unit.ruleBranch;
    });

    return {
      packageId: `AFP-${token(scenarioContext.scenarioRunId)}-${token(adoptionRecord.id)}`,
      packageVersion: "1.0",
      schemaVersion: snapshot.schemaVersion,
      factInventoryVersion: snapshot.factInventoryVersion,
      factPackageStatus: "available",
      sceneId: snapshot.sceneId,
      scenarioContext: clone(scenarioContext),
      authorityBindingId: adoptionRecord.id,
      semanticVersionId,
      semanticVersion,
      dataAssetId: sourceContract.assetId,
      dataAssetVersionId: dataVersion,
      dataVersion,
      consumableVersionId: t018EvidenceId,
      asOf: snapshot.asOf,
      formedAt: binding.switchedAt,
      resultVersions: { metric: metricResultVersion, rule: ruleResultVersion },
      semanticResources: [
        ...(version.objects || []),
        ...(version.links || []),
        ...(version.metrics || []),
        ...(version.rules || []),
        ...(version.actions || [])
      ],
      metrics: clone(version.metrics || []),
      rules: clone(version.rules || []),
      actionTypes: clone(version.actions || []),
      sourceProof: {
        sourceSnapshotId: sourceContract.sourceSnapshotId,
        sourceReadEventId: sourceContract.sourceReadEventId,
        sha256: snapshot.source.sha256,
        sizeBytes: snapshot.source.sizeBytes,
        rowCount: snapshot.source.rowCount,
        calculationBasis: snapshot.source.calculationBasis,
        t008EvidenceId: sourceContract.t008Confirmation?.evidenceId,
        t018EvidenceId,
        t019RecordId: adoptionRecord.id,
        t019EvidenceId
      },
      authoritativeBinding: {
        bindingId: adoptionRecord.id,
        semanticVersionId,
        semanticVersion,
        dataAssetId: sourceContract.assetId,
        dataAssetVersionId: dataVersion,
        dataVersion,
        consumableVersionId: t018EvidenceId,
        asOf: snapshot.asOf,
        adoptedAt: binding.switchedAt
      },
      contentFacts: facts,
      anchors,
      contentItems,
      renderManifest: {
        manifestId: `ONT-MANIFEST-${token(adoptionRecord.id)}`,
        version: "1.0",
        authoritativeBinding: { semanticVersionId, semanticVersion, dataVersion, asOf: snapshot.asOf },
        items: clone(contentItems)
      },
      groupMetrics: clone(snapshot.groupMetrics),
      units,
      comparisons: clone(snapshot.comparisons),
      structures: clone(snapshot.structures),
      institutions: clone(snapshot.institutions),
      trend: clone(snapshot.trend)
    };
  };
})();
